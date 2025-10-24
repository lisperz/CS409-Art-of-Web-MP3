var Task = require('../models/task');
var User = require('../models/user');

module.exports = function (router) {

    // Base route for /api/tasks
    var tasksRoute = router.route('/tasks');

    // GET /api/tasks - List all tasks with query parameters
    tasksRoute.get(function (req, res) {
        try {
            // Build query
            var query = {};
            if (req.query.where) {
                try {
                    query = JSON.parse(req.query.where);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid JSON in 'where' parameter",
                        data: {}
                    });
                }
            }

            // Check if count is requested
            if (req.query.count === 'true') {
                Task.countDocuments(query, function (err, count) {
                    if (err) {
                        return res.status(500).json({
                            message: "Error counting tasks",
                            data: {}
                        });
                    }
                    return res.status(200).json({
                        message: "OK",
                        data: count
                    });
                });
            } else {
                // Build the query with Mongoose methods
                var mongooseQuery = Task.find(query);

                // Apply select
                if (req.query.select) {
                    try {
                        var select = JSON.parse(req.query.select);
                        mongooseQuery = mongooseQuery.select(select);
                    } catch (e) {
                        return res.status(400).json({
                            message: "Invalid JSON in 'select' parameter",
                            data: {}
                        });
                    }
                }

                // Apply sort
                if (req.query.sort) {
                    try {
                        var sort = JSON.parse(req.query.sort);
                        mongooseQuery = mongooseQuery.sort(sort);
                    } catch (e) {
                        return res.status(400).json({
                            message: "Invalid JSON in 'sort' parameter",
                            data: {}
                        });
                    }
                }

                // Apply skip
                if (req.query.skip) {
                    var skip = parseInt(req.query.skip);
                    if (isNaN(skip)) {
                        return res.status(400).json({
                            message: "Invalid 'skip' parameter",
                            data: {}
                        });
                    }
                    mongooseQuery = mongooseQuery.skip(skip);
                }

                // Apply limit (default 100 for tasks)
                var limit = 100;
                if (req.query.limit) {
                    limit = parseInt(req.query.limit);
                    if (isNaN(limit)) {
                        return res.status(400).json({
                            message: "Invalid 'limit' parameter",
                            data: {}
                        });
                    }
                }
                mongooseQuery = mongooseQuery.limit(limit);

                // Execute query
                mongooseQuery.exec(function (err, tasks) {
                    if (err) {
                        return res.status(500).json({
                            message: "Error retrieving tasks",
                            data: {}
                        });
                    }
                    return res.status(200).json({
                        message: "OK",
                        data: tasks
                    });
                });
            }
        } catch (err) {
            return res.status(500).json({
                message: "Server error",
                data: {}
            });
        }
    });

    // POST /api/tasks - Create a new task
    tasksRoute.post(function (req, res) {
        // Validation
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({
                message: "Name and deadline are required",
                data: {}
            });
        }

        var task = new Task();
        task.name = req.body.name;
        task.description = req.body.description || "";
        task.deadline = req.body.deadline;
        task.completed = req.body.completed !== undefined ? req.body.completed : false;
        task.assignedUser = req.body.assignedUser || "";
        task.assignedUserName = req.body.assignedUserName || "unassigned";

        task.save(function (err, savedTask) {
            if (err) {
                return res.status(500).json({
                    message: "Error creating task",
                    data: {}
                });
            }

            // If task is assigned to a user, add to user's pendingTasks
            if (savedTask.assignedUser && savedTask.assignedUser !== "") {
                User.findById(savedTask.assignedUser, function (err, user) {
                    if (!err && user) {
                        if (user.pendingTasks.indexOf(savedTask._id.toString()) === -1) {
                            user.pendingTasks.push(savedTask._id.toString());
                            user.save(function () {
                                // Continue even if save fails
                            });
                        }
                    }
                });
            }

            return res.status(201).json({
                message: "Task created successfully",
                data: savedTask
            });
        });
    });

    // Routes for specific task by ID
    var taskRoute = router.route('/tasks/:id');

    // GET /api/tasks/:id - Get a specific task
    taskRoute.get(function (req, res) {
        var query = Task.findById(req.params.id);

        // Apply select if provided
        if (req.query.select) {
            try {
                var select = JSON.parse(req.query.select);
                query = query.select(select);
            } catch (e) {
                return res.status(400).json({
                    message: "Invalid JSON in 'select' parameter",
                    data: {}
                });
            }
        }

        query.exec(function (err, task) {
            if (err) {
                return res.status(500).json({
                    message: "Error retrieving task",
                    data: {}
                });
            }
            if (!task) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }
            return res.status(200).json({
                message: "OK",
                data: task
            });
        });
    });

    // PUT /api/tasks/:id - Replace entire task
    taskRoute.put(function (req, res) {
        // Validation
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({
                message: "Name and deadline are required",
                data: {}
            });
        }

        Task.findById(req.params.id, function (err, task) {
            if (err) {
                return res.status(500).json({
                    message: "Error retrieving task",
                    data: {}
                });
            }
            if (!task) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            var oldAssignedUser = task.assignedUser;
            var newAssignedUser = req.body.assignedUser || "";
            var newAssignedUserName = req.body.assignedUserName || "unassigned";

            // Update task fields
            task.name = req.body.name;
            task.description = req.body.description || "";
            task.deadline = req.body.deadline;
            task.completed = req.body.completed !== undefined ? req.body.completed : false;
            task.assignedUser = newAssignedUser;
            task.assignedUserName = newAssignedUserName;

            task.save(function (err, updatedTask) {
                if (err) {
                    return res.status(500).json({
                        message: "Error updating task",
                        data: {}
                    });
                }

                // Handle two-way references
                // Remove task from old user's pendingTasks
                if (oldAssignedUser && oldAssignedUser !== "" && oldAssignedUser !== newAssignedUser) {
                    User.findById(oldAssignedUser, function (err, oldUser) {
                        if (!err && oldUser) {
                            var index = oldUser.pendingTasks.indexOf(req.params.id);
                            if (index > -1) {
                                oldUser.pendingTasks.splice(index, 1);
                                oldUser.save(function () {
                                    // Continue even if save fails
                                });
                            }
                        }
                    });
                }

                // Add task to new user's pendingTasks
                if (newAssignedUser && newAssignedUser !== "" && oldAssignedUser !== newAssignedUser) {
                    User.findById(newAssignedUser, function (err, newUser) {
                        if (!err && newUser) {
                            if (newUser.pendingTasks.indexOf(req.params.id) === -1) {
                                newUser.pendingTasks.push(req.params.id);
                                newUser.save(function () {
                                    // Continue even if save fails
                                });
                            }
                        }
                    });
                }

                return res.status(200).json({
                    message: "Task updated successfully",
                    data: updatedTask
                });
            });
        });
    });

    // DELETE /api/tasks/:id - Delete a task
    taskRoute.delete(function (req, res) {
        Task.findByIdAndDelete(req.params.id, function (err, task) {
            if (err) {
                return res.status(500).json({
                    message: "Error deleting task",
                    data: {}
                });
            }
            if (!task) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            // Remove task from assigned user's pendingTasks
            if (task.assignedUser && task.assignedUser !== "") {
                User.findById(task.assignedUser, function (err, user) {
                    if (!err && user) {
                        var index = user.pendingTasks.indexOf(req.params.id);
                        if (index > -1) {
                            user.pendingTasks.splice(index, 1);
                            user.save(function () {
                                // Continue even if save fails
                            });
                        }
                    }
                });
            }

            return res.status(200).json({
                message: "Task deleted successfully",
                data: task
            });
        });
    });

    return router;
};
