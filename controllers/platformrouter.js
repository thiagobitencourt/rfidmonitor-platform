var express = require('express');

var logger = require('winston');
var BearerStrategy = require('passport-http-bearer').Strategy
var passport = require('passport');

var User = require('../models/user');
var UserDao = require('../dao/userdao');

var AppClient = require('../models/appclient');
var AppClientDao = require('../dao/appclientdao');

var AccessToken = require('../models/accesstoken');
var AccessTokenDao = require('../dao/accesstokendao');

var RouterAccess = require('../models/routeraccess');
var RouterAccessDao = require('../dao/routeraccessdao');

var routes = require('../utils/routes');



var PlatformRouter = function(){

	router = express.Router();
	userDao = new UserDao();
	appClientDao = new AppClientDao();
	accessTokenDao = new AccessTokenDao();
	routerAccessDao = new RouterAccessDao();

	passport.use('api-bearer', new BearerStrategy({}, validateBearer));
	setAuthorization();

	setRouteUsers();

	return router;
}

var validateBearer = function(token, done) {
	logger.debug('validateBearer');

	accessTokenDao.getByValue(token, function (err, token) {

        if (err) { return done(err); }

        // No token found
        if (!token) { return done(null, false); }

        appClientDao.getById(token.appClientId , function (err, client) {
            if (err) { return done(err); }

            // No user found
            if (!client) { return done(null, false); }

            // Simple example with no scope
            logger.debug("BearerStrategy : SUCCESS");
            done(null, {clientId: client.id, clientName: client.clientName}, { scope: '*' });
        });
    });
}

var setAuthorization = function(){
	router.all(
		'*', 
		passport.authenticate('api-bearer', { session: false }), 
		function(req, res, next){
			var requestInfo = {
				clientId: req.user.clientId,
				route: req._parsedOriginalUrl.pathname,
				methodName: req.method
			};
			routerAccessDao.getAccess(requestInfo, function(err, result){

                if(err) {
                	logger.error("setAuthorization routerAccessDao ");
                	return res.status(501).send("INTERNAL ERROR");
				}

                if(result){
                	//ACCESS GRANTED.
                    next();
                }else{
                    res.status(403).send("YOU DONT HAVE THE AUTH. GET OUT DOG....");
                }
       		});			
			
		}
	);
}

var setRouteUsers = function(){
	// api/users
	var route = '/users';
	routes.register('/api' + route, 'GET');

	router.get(route, 
		function(req, res, next){
			//VALIDATION OF THE REQUEST

			logger.debug('validateUsersGet');

			next();
		},
		function(req, res){
	  		//PROCESS REQUEST

	  		//find all users.

			userDao.getAll(function(err, users){
	  		if(err)
	  			return res.json(err)

	  		res.json(users);

			});
		}
	);

	routes.register('/api' + route, 'POST');
	router.post(route, function(req, res){
	  	//insert user;

			var user = new User();
			user.username = req.body.username;
			user.password = req.body.password;
			user.name = req.body.name;
			user.email = req.body.email;

			userDao.insert(user, function(err, id){
				if(err)
		  			return res.json(err)

		  		user.id = id;
		  		res.json(user);
			});

		});

}

// var routeAppClients = function(){
// 	/*
// 	Get all clients
// 	Ex: api/clients
// 	*/
// 	router.route('/clients')

// 		.get(authController.isAuthenticated, function(req, res){
// 			//find all users;

// 			appClientDao.getAll(function(err, appClient){
// 				if(err)
// 					return res.json(err)

// 				res.json(appClient);
// 			});
// 		})

// 		.post(authController.isAuthenticated, function(req, res){
// 			//insert user;
// 			var client = new AppClient();
// 			client.name = req.body.name;
// 			client.oauthId = req.body.oauthId;
// 			client.oauthSecret = req.body.oauthSecret;
// 			client.userId = req.user.id;
			
// 			appClientDao.insert(client, function(err, id){
// 				if(err)
// 						return res.json(err)

// 					client.id = id;
// 					res.json(client);
// 			});
// 		}
// 	);

	// /*
	// get a client by id
	// Ex: api/clients/45
	// */
	// router.route('/clients/:client_id')

	// 	.get(authController.isAuthenticated, function(req, res){
	// 		//find all users;

	// 		appClientDao.getById(req.params.client_id, function(err, appClient){
	// 			if(err)
	// 				return res.json(err)

	// 			res.json(appClient);
	// 		});

	// 	})
	// );
//}

module.exports = PlatformRouter;