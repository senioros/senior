'use strict';

var express = require('express'),
    cors = require('cors'),
    passport = require('passport'),
    BasicStrategy = require('passport-http').BasicStrategy,
    bodyParser = require('body-parser'),
    devices = require('../services/devices'),
    simplepush = require('../services/simplepush'),
    users = require('../services/users'),
    logger = require('../services/logger'),
    hasher = require('../services/hasher');

passport.use(new BasicStrategy(
    function auth(username, password, done) {
        users.find(username, hasher.hash(password), function(err, user) {
            if (err) {
                logger.info('api user auth failed %j', err);
                return done(null, false);
            }

            logger.info('user info %j', user);
            return done(null, user);
        });
    }
));

function initializeRouter() {
    var router = express.Router();

    router.use(cors());

    router.use(passport.initialize());
    router.use(passport.authenticate('basic', {session: false}));

    router.use(bodyParser.urlencoded({ extended: true }));
    router.use(bodyParser.json({ limit: '1kb' }));

    router.get('/devices/:uid', function(req, res, next) {
        devices.find(req.params.uid, function(err, device) {
            if (err) {
                return next(err);
            }

            if (!device) {
                return next();
            }

            return res.json(device);
        });
    });

    router.post('/devices/:uid/status', function(req, res, next) {
        var update = {
            status: req.body
        };

        update.status.timestamp = new Date();

        devices.update(req.params.uid, update, function(err, result) {
            if (err) {
                return next(err);
            }

            return res.json(null);
        });
    });

    router.post('/devices/:uid/status/:facet', function(req, res, next) {
        var update = {};
        update['status.' + req.params.facet] = req.body;

        // TODO
        // update['status.' + req.params.facet + '.timestamp'] = new Date();

        devices.update(req.params.uid, update, function(err, result) {
            if (err) {
                return next(err);
            }

            return res.json(null);
        });
    });

    router.post('/devices/:uid/contacts', function(req, res, next) {
        devices.contacts.insert(req.params.uid, req.body, function(err, result) {
            if (err) {
                return next(err);
            }

            return res.json(result);
        });
    });

    router.put('/devices/:uid/contacts/:id', function(req, res, next) {
        devices.contacts.update(req.params.uid, req.params.id, req.body, function(err, result) {
            if (err) {
                return next(err);
            }

            return res.json(result);
        });
    });

    router.delete('/devices/:uid/contacts/:id', function(req, res, next) {
        devices.contacts.remove(req.params.uid, req.params.id, function(err, result) {
            if (err) {
                return next(err);
            }

            return res.status(204).json(null);
        });
    });

    router.post('/v1/register', function(req, res, next) {
        simplepush.register(req.body, function(err, result) {
            if (err) {
                return next(err);
            }

            logger.info('registered channel', result);
            return res.json(null);
        })
    });

    router.get('/geo', function(req, res, next) {
        return res.json({'city': 'Valladolid', 'temperature': 16});
    });

    router.all('*', function notFound(req, res, next) {
        var err = new Error('Resource not Found');
        err.status = 404;
        next(err);
    });

    router.use(function(err, req, res, next) {
        logger.warn(err);
        res.status(err.status || 500).json({'error': err.message});
    });

    return router;
}

module.exports = initializeRouter;
