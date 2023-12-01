# solid-auth-service

# Redis setup

To setup the the Redis and to run it, please type the following commando:
```
npm run redis-start
```

If you want to stop the Redis:
```
npm run redis-stop
```
To clear your Redis data, remove the Redis container by run:
```
npm run redis-remove
```

The removal of the Redis Docker image can be done by run:
```
npm run redis-remove-image
```

To open the redis-cli run
```
npm run redis-cli
```

### Dependencies
These above scripts rely on Docker being installed on your system. Make sure Docker is set up and running before using these commands.


# Run Authorization service
Ensure you did [Redis setup](#redis-setup) first.

Run the following command to build and start the authorization service:
```
npm run dev
```

# Endpoints

### GET http://localhost:3001/agents/new
When a Social Agent wants to use this as its authorization agent, it requests to this endpoint.

When an application wants access to the Social Agent's Pod, it checks who the Social Agent's authorization agent is by 
looking at the **hasAuthorizationAgent** predicate in the Social Agent's profile document.

### GET http://localhost:3001/agents/<agent_id>
It gives the authorization agent's profile document for the Social Agent. As an application, it can see 
what endpoint to call when it wants access to the Social Agent's Pod.

### HEAD http://localhost:3001/agents/<agent_id>?client_id=<client_id>
With this request, the application with```<client_id>``` can get a link to its Application Registration.
Gives status code 400 if it has no Application Registration.

### POST http://localhost:3001/agents/<agent_id>/wants-access?client_id=<client_id>
With this request, the application with```<client_id>``` will get access to the Social Agent's Pod.
It requires that by derefecering
