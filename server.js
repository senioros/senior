'use strict';

var express = require('express'),
    http = require('http'),
    path = require('path'),
    engine = require('ejs-locals'),
    logger = require('./services/logger'),
    db = require('./services/db'),
    portal = require('./routes/portal'),
    api = require('./routes/api');

function initializeApplication() {
    var app = express();

    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');
    app.engine('ejs', engine);

    app.use('/api', api());
    app.use('/', portal());

    var server = http.createServer(app);
    var port = process.env.PORT || 2200;
    var host = process.env.HOST || '0.0.0.0';

    server.listen(port, host, function() {
        logger.info('senior listening on', server.address());
    });
}

db.connect(function(err) {
    if (err) {
        process.exit(1);
    }

    initializeApplication();
});
