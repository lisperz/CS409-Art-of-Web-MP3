var User = require('../models/user');
var Task = require('../models/task');

module.exports = function (router) {

    // Base route for /api/users
    var usersRoute = router.route('/users');

    // GET /api/users - List all users with query parameters
    usersRoute.get(function (req, res) {
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
                User.countDocuments(query, function (err, count) {
                    if (err) {
                        return res.status(500).json({
                            message: "Error counting users",
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
                var mongooseQuery = User.find(query);

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

                // Apply limit (no default for users)
                if (req.query.limit) {
                    var limit = parseInt(req.query.limit);
                    if (isNaN(limit)) {
                        return res.status(400).json({
                            message: "Invalid 'limit' parameter",
                            data: {}
                        });
                    }
                    mongooseQuery = mongooseQuery.limit(limit);
                }

                // Execute query
                mongooseQuery.exec(function (err, users) {
                    if (err) {
                        return res.status(500).json({
                            message: "Error retrieving users",
                            data: {}
                        });
                    }
                    return res.status(200).json({
                        message: "OK",
                        data: users
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

    // POST /api/users - Create a new user
    usersRoute.post(function (req, res) {
        // Validation
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({
                message: "Name and email are required",
                data: {}
            });
        }

        var user = new User();
        user.name = req.body.name;
        user.email = req.body.email;

        var pendingTasks = req.body.pendingTasks || [];
        // Handle form-encoded data where pendingTasks might be a string
        if (typeof pendingTasks === 'string') {
            pendingTasks = pendingTasks ? pendingTasks.split(',') : [];
        }
        // Ensure it's an array
        if (!Array.isArray(pendingTasks)) {
            pendingTasks = [pendingTasks];
        }
        user.pendingTasks = pendingTasks;

        user.save(function (err, savedUser) {
            if (err) {
                if (err.code === 11000) {
                    return res.status(400).json({
                        message: "User with this email already exists",
                        data: {}
                    });
                }
                return res.status(500).json({
                    message: "Error creating user",
                    data: {}
                });
            }

            // If pendingTasks were provided, update those tasks
            if (req.body.pendingTasks && req.body.pendingTasks.length > 0) {
                Task.updateMany(
                    { _id: { $in: req.body.pendingTasks } },
                    {
                        assignedUser: savedUser._id.toString(),
                        assignedUserName: savedUser.name
                    },
                    function (err) {
                        if (err) {
                            // Task update failed, but user was created
                            return res.status(201).json({
                                message: "User created but task assignment failed",
                                data: savedUser
                            });
                        }
                        return res.status(201).json({
                            message: "User created successfully",
                            data: savedUser
                        });
                    }
                );
            } else {
                return res.status(201).json({
                    message: "User created successfully",
                    data: savedUser
                });
            }
        });
    });

    // Routes for specific user by ID
    var userRoute = router.route('/users/:id');

    // GET /api/users/:id - Get a specific user
    userRoute.get(function (req, res) {
        var query = User.findById(req.params.id);

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

        query.exec(function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: "Error retrieving user",
                    data: {}
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }
            return res.status(200).json({
                message: "OK",
                data: user
            });
        });
    });

    // PUT /api/users/:id - Replace entire user
    userRoute.put(function (req, res) {
        // Validation
        if (!req.body.name || !req.body.email) {
            return res.status(400).json({
                message: "Name and email are required",
                data: {}
            });
        }

        User.findById(req.params.id, function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: "Error retrieving user",
                    data: {}
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            var oldPendingTasks = user.pendingTasks || [];
            var newPendingTasks = req.body.pendingTasks || [];

            // Handle form-encoded data where pendingTasks might be a string
            if (typeof newPendingTasks === 'string') {
                newPendingTasks = newPendingTasks ? newPendingTasks.split(',') : [];
            }
            // Ensure it's an array
            if (!Array.isArray(newPendingTasks)) {
                newPendingTasks = [newPendingTasks];
            }

            // Update user fields
            user.name = req.body.name;
            user.email = req.body.email;
            user.pendingTasks = newPendingTasks;

            user.save(function (err, updatedUser) {
                if (err) {
                    if (err.code === 11000) {
                        return res.status(400).json({
                            message: "User with this email already exists",
                            data: {}
                        });
                    }
                    return res.status(500).json({
                        message: "Error updating user",
                        data: {}
                    });
                }

                // Handle two-way references
                // Remove this user from tasks no longer in pendingTasks
                var tasksToUnassign = oldPendingTasks.filter(function(taskId) {
                    return newPendingTasks.indexOf(taskId) === -1;
                });

                // Add this user to new tasks
                var tasksToAssign = newPendingTasks.filter(function(taskId) {
                    return oldPendingTasks.indexOf(taskId) === -1;
                });

                // Unassign removed tasks
                if (tasksToUnassign.length > 0) {
                    Task.updateMany(
                        { _id: { $in: tasksToUnassign } },
                        { assignedUser: "", assignedUserName: "unassigned" },
                        function (err) {
                            // Continue even if this fails
                        }
                    );
                }

                // Assign new tasks
                if (tasksToAssign.length > 0) {
                    Task.updateMany(
                        { _id: { $in: tasksToAssign } },
                        {
                            assignedUser: updatedUser._id.toString(),
                            assignedUserName: updatedUser.name
                        },
                        function (err) {
                            // Continue even if this fails
                        }
                    );
                }

                return res.status(200).json({
                    message: "User updated successfully",
                    data: updatedUser
                });
            });
        });
    });

    // DELETE /api/users/:id - Delete a user
    userRoute.delete(function (req, res) {
        User.findByIdAndDelete(req.params.id, function (err, user) {
            if (err) {
                return res.status(500).json({
                    message: "Error deleting user",
                    data: {}
                });
            }
            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            }

            // Unassign all tasks that were assigned to this user
            Task.updateMany(
                { assignedUser: req.params.id },
                { assignedUser: "", assignedUserName: "unassigned" },
                function (err) {
                    // Continue even if task update fails
                    return res.status(200).json({
                        message: "User deleted successfully",
                        data: user
                    });
                }
            );
        });
    });

    return router;
};
