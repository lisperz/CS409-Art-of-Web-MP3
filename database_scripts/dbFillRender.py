#!/usr/bin/env python

"""
 * @file dbFillRender.py
 * Modified version of dbFill.py for HTTPS connections (Render deployment)
 * Used to populate database with randomly generated users and tasks.
"""

import sys
import getopt
import http.client
import urllib
import json
from random import randint
from random import choice
from datetime import date
from time import mktime

def usage():
    print('dbFillRender.py -u <baseurl> -n <numUsers> -t <numTasks>')
    print('Example: python3 dbFillRender.py -u "myapp.onrender.com" -n 20 -t 100')

def getUsers(conn):
    # Retrieve the list of users
    conn.request("GET","""/api/users?filter={"_id":1}""")
    response = conn.getresponse()
    data = response.read()
    d = json.loads(data)

    # Array of user IDs
    users = [str(d['data'][x]['_id']) for x in range(len(d['data']))]

    return users

def main(argv):

    # Server Base URL (no port needed for HTTPS)
    baseurl = ""

    # Number of POSTs that will be made to the server
    userCount = 20
    taskCount = 100

    try:
        opts, args = getopt.getopt(argv,"hu:n:t:",["url=","users=","tasks="])
    except getopt.GetoptError:
        usage()
        sys.exit(2)
    for opt, arg in opts:
        if opt == '-h':
            usage()
            sys.exit()
        elif opt in ("-u", "--url"):
             baseurl = arg
        elif opt in ("-n", "--users"):
             userCount = int(arg)
        elif opt in ("-t", "--tasks"):
             taskCount = int(arg)

    if not baseurl:
        print("Error: Base URL is required!")
        usage()
        sys.exit(2)

    # Python array containing common first names and last names
    firstNames = ["james","john","robert","michael","william","david","richard","charles","joseph","thomas","christopher","daniel","paul","mark","donald","george","kenneth","steven","edward","brian","ronald","anthony","kevin","jason","matthew","gary","timothy","jose","larry","jeffrey","frank","scott","eric","stephen","andrew","raymond","gregory","joshua","jerry","dennis","walter","patrick","peter","harold","douglas","henry","carl","arthur","ryan","roger","joe","juan","jack","albert","jonathan","justin","terry","gerald","keith","samuel","willie","ralph","lawrence","nicholas","roy","benjamin","bruce","brandon","adam","harry","fred","wayne","billy","steve","louis","jeremy","aaron","randy","howard","eugene","carlos","russell","bobby","victor","martin","ernest","phillip","todd","jesse","craig","alan","shawn","clarence","sean","philip","chris","johnny","earl","jimmy","antonio","danny","bryan","tony","luis","mike","stanley","leonard","nathan","dale","manuel","rodney","curtis","norman","allen","marvin","vincent","glenn","jeffery","travis","jeff","chad","jacob","lee","melvin","alfred","kyle","francis","bradley","jesus","herbert","frederick","ray","joel","edwin","don","eddie","ricky","troy","randall","barry","alexander","bernard","mario","leroy","francisco","marcus","micheal","theodore","clifford","miguel","oscar","jay","jim","tom","calvin","alex","jon","ronnie","bill","lloyd","tommy","leon","derek","warren","darrell","jerome","floyd","leo","alvin","tim","wesley","gordon","dean","greg","jorge","dustin","pedro","derrick","dan","lewis","zachary","corey","herman","maurice","vernon","roberto","clyde","glen","hector","shane","ricardo","sam","rick","lester","brent","ramon","charlie","tyler","gilbert","gene"]
    lastNames = ["smith","johnson","williams","jones","brown","davis","miller","wilson","moore","taylor","anderson","thomas","jackson","white","harris","martin","thompson","garcia","martinez","robinson","clark","rodriguez","lewis","lee","walker","hall","allen","young","hernandez","king","wright","lopez","hill","scott","green","adams","baker","gonzalez","nelson","carter","mitchell","perez","roberts","turner","phillips","campbell","parker","evans","edwards","collins","stewart","sanchez","morris","rogers","reed","cook","morgan","bell","murphy","bailey","rivera","cooper","richardson","cox","howard","ward","torres","peterson","gray","ramirez","james","watson","brooks","kelly","sanders","price","bennett","wood","barnes","ross","henderson","coleman","jenkins","perry","powell","long","patterson","hughes","flores","washington","butler","simmons","foster","gonzales","bryant","alexander","russell","griffin","diaz","hayes"]

    # Load task descriptions
    f = open('tasks.txt','r')
    tasks = f.read().split('\n')
    f.close()

    # HTTPS Connection for Render
    print(f"Connecting to {baseurl} via HTTPS...")
    conn = http.client.HTTPSConnection(baseurl)

    # HTTP Headers for JSON
    headers = {"Content-type": "application/json","Accept": "application/json"}

    # Array of user IDs
    userIDs = []
    userNames = []
    userEmails = []

    print(f"Creating {userCount} users...")
    # Loop 'userCount' number of times
    for i in range(userCount):

        # Pick a random first name and last name
        x = randint(0,99)
        y = randint(0,99)
        name = firstNames[x] + " " + lastNames[y]
        email = firstNames[x] + "@" + lastNames[y] + ".com"
        
        # Create JSON body
        body = json.dumps({'name': name, 'email': email})

        # POST the user
        conn.request("POST", "/api/users", body, headers)
        response = conn.getresponse()
        data = response.read()
        d = json.loads(data)

        # Store the user's _id
        userID = str(d['data']['_id'])
        userIDs.append(userID)
        userNames.append(name)
        userEmails.append(email)

        print(f"  Created user {i+1}/{userCount}: {name}")

    print(f"\nCreating {taskCount} tasks...")
    # Loop 'taskCount' number of times
    for i in range(taskCount):

        # Generate a random task
        name = choice(tasks)
        description = "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English."
        
        # Random deadline (1-10 days from now)
        deadline = date.fromtimestamp(mktime(date.today().timetuple())+(randint(1,10)*86400))
        deadlineString = deadline.isoformat() + "T" + str(randint(0,23)).zfill(2) + ":" + str(randint(0,59)).zfill(2) + ":" + str(randint(0,59)).zfill(2) + ".000Z"
        
        # Random completion status (50% chance)
        completed = choice([True, False])
        
        # Create JSON body for task
        task_data = {
            'name': name,
            'description': description,
            'deadline': deadlineString,
            'completed': completed
        }
        
        # 60% chance of assigning to a user
        if randint(0,99) < 60 and len(userIDs) > 0:
            userIndex = randint(0, len(userIDs)-1)
            task_data['assignedUser'] = userIDs[userIndex]
            task_data['assignedUserName'] = userNames[userIndex]

        body = json.dumps(task_data)

        # POST the task
        conn.request("POST", "/api/tasks", body, headers)
        response = conn.getresponse()
        data = response.read()
        d = json.loads(data)
        
        print(f"  Created task {i+1}/{taskCount}: {name[:50]}...")

    # Exit gracefully
    conn.close()
    print(f"\n✅ Success! Created {userCount} users and {taskCount} tasks at https://{baseurl}")


if __name__ == "__main__":
     main(sys.argv[1:])
