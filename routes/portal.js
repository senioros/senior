'use strict';

var express = require('express'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    MongoStore = require('connect-mongo')(session),
    passport = require('passport'),
    uuid = require('uuid'),
    path = require('path'),
    less = require('less-middleware'),
    favicon = require('serve-favicon'),
    LocalStrategy = require('passport-local').Strategy,
    bodyParser = require('body-parser'),
    login = require('connect-ensure-login'),
    methodOverride = require('method-override'),
    flash = require('connect-flash'),
    config = require('../config'),
    db = require('../services/db'),
    devices = require('../services/devices'),
    users = require('../services/users'),
    logger = require('../services/logger'),
    hasher = require('../services/hasher');

passport.use(new LocalStrategy(
    function(username, password, done) {
        users.find(username, hasher.hash(password), function(err, user) {
            if (err) {
                logger.info('user auth failed %j', err);
                return done(null, false, err);
            }

            logger.info('user info %j', user);
            return done(null, user);
        })
    }
));

passport.serializeUser(function serialize(user, done) {
    logger.debug('serialize %j', user);
    done(null, user);
});

passport.deserializeUser(function deserialize(user, done) {
    logger.debug('deserialize %j', user);
    return done(null, user);
});

function initializeRouter() {
    var router = express.Router();

    router.use(favicon(path.join(__dirname, '..', 'public', 'favicon.ico')));
    router.use(less(path.join(__dirname, '..', 'public')));
    router.use(express.static(path.join(__dirname, '..', 'public')));

    router.use(cookieParser());

    router.use(session({
        store: new MongoStore({ db: db.get() }),
        saveUninitialized: false,
        resave: false,
        secret: 'senior-secret'
    }));

    router.use(flash());

    router.use(passport.initialize());
    router.use(passport.session());

    router.use(function populateLocals(req, res, next) {
        res.locals.user = req.user;
        res.locals.config = config;
        res.locals.flash_error = req.flash('error');
        res.locals.flash_info = req.flash('info');

        res.locals.facet = req.query.facet || 'contacts';
        next();
    });

    router.use(bodyParser.urlencoded({ extended: true }));
    router.use(methodOverride(function(req, res) {
        // see http://stackoverflow.com/a/24020025/12388
        if (req.body && typeof req.body === 'object' && '_method' in req.body) {
            var method = req.body._method;
            delete req.body._method;
            return method;
        }
    }));

    router.get('/',
        login.ensureNotLoggedIn('/devices'),
        function(req, res, next) {
            res.render('index');
        }
    );

    router.get('/devices',
        login.ensureLoggedIn(),
        function(req, res, next) {
            devices.all(function(err, result) {
                if (err) {
                    return next(err);
                }
                res.render('home', {devices: result});
            });
        }
    );

    router.get('/devices/:uid',
        login.ensureLoggedIn(),
        function(req, res, next) {
            devices.find(req.params.uid, function(err, device) {
                if (err) {
                  return next(err);
                }
                res.render('device', {device: device});
            });
        }
    );

    router.get('/devices/:uid/status/:facet',
        login.ensureLoggedIn(),
        function(req, res, next) {
            var channel = 'status/' + req.params.facet;
            devices.refresh(req.params.uid, channel, function(err, result) {
                res.locals.facet = req.params.facet;
                var url = '/devices/' + req.params.uid + '?facet=' + req.params.facet;

                if (err) {
                    logger.warn('Warning refresh %s', req.params.facet, err);

                    // XXX i18n, remove script
                    req.flash('error', 'No se pudo consultar la información solicitada en este momento');
                } else {
                    // XXX i18n, remove script
                    req.flash('info', ' Información solicitada al teléfono. <strong><a href=' + url + '>Refresque la página</a></strong> en unos momentos');
                }

                res.redirect(url);
            });
        }
    );

    router.post('/devices/:uid/contacts',
        login.ensureLoggedIn(),
        function(req, res, next) {
            var contact = {
                "id": uuid.v4(),
                "givenName": [ req.body.name ],
                "tel": [
                    {
                        "value": req.body.msisdn
                    }
                ],
                "photo": [ req.body.photo ]
            };

            devices.contacts.insert(req.params.uid, contact, function(err, device) {
                if (err) {
                  return next(err);
                }
                res.redirect('/devices/' + req.params.uid);
            });
        }
    );

    router.put('/devices/:uid/contacts/:id',
        login.ensureLoggedIn(),
        function(req, res, next) {
            var contact = {
                "givenName": [ req.body.name ],
                "tel": [
                    {
                        "value": req.body.msisdn
                    }
                ],
                "photo": [ req.body.photo ]
            };

            devices.contacts.update(req.params.uid, req.params.id, contact, function(err, device) {
                if (err) {
                  return next(err);
                }
                res.redirect('/devices/' + req.params.uid);
            });
        }
    );

    router.delete('/devices/:uid/contacts/:id',
        login.ensureLoggedIn(),
        function(req, res, next) {
            devices.contacts.remove(req.params.uid, req.params.id, function(err, device) {
                if (err) {
                  return next(err);
                }
                res.redirect('/devices/' + req.params.uid);
            });
        }
    );

    router.get('/login',
        login.ensureNotLoggedIn('/devices'),
        function(req, res, next) {
            res.render('login');
        }
    );

    router.post('/login',
        login.ensureNotLoggedIn(),
        passport.authenticate('local', {
            successRedirect: '/devices',
            failureRedirect: '/login?unauthorized'
        })
    );

    router.get('/logout',
        function(req, res) {
            req.session.destroy(function(err) {
                if (err) {
                    logger.warn('Not able to destroy session: %s', err.message);
                }
                res.redirect('/?logout');
            });
        }
    );

    router.get('/signup',
        login.ensureNotLoggedIn('/devices'),
        function(req, res, next) {
            res.render('signup');
        }
    );

    router.post('/signup',
        function(req, res, next) {
            var user = {
                username: req.body.username,
                password: hash(req.body.password),
                createdAt: new Date()
            };

            users.insert(user, function(err, result) {
                if (err) {
                    return next(err);
                }

                return res.redirect('/login');
            });
        }
    );

    router.all('*', function notFound(req, res, next) {
        var err = new Error('Resource not Found');
        err.status = 404;
        next(err);
    });

    router.use(function(err, req, res, next) {
        logger.warn(err);

        res.status(err.status || 500);

        if (req.xhr) {
            res.json({'error': err.message});
        } else {
            res.render('error', {
                message: err.message
            });
        }
    });

    return router;
}

module.exports = initializeRouter;
