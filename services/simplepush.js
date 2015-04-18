var assert = require('assert'),
    request = require('request'),
    logger = require('./logger');
    db = require('./db');

var COLLECTION_CHANNEL = 'channels';

var sendNotification = function sendNotification(channel, callback) {
    var options = {
        method: 'PUT',
        uri: channel.endpoint
    };

    request(options, function onRequest(err, response, body) {
        if (err) {
            return callback(err);
        }

        if (response.statusCode >= 300) {
            return callback(new Error('Notification failed'));
        }

        return callback();
    });
};

var register = function register(params, callback) {
    assert.ok(params);
    assert.ok(params.endpoint);
    assert.ok(params.imei);
    assert.ok(params.channel);

    var criteria = {
        'imei': params.imei,
        'channel': params.channel
    };

    var update = {
        '$set': {
            'endpoint': params.endpoint
        }
    };

    var options = {
        'update': true,
        'upsert': true,
        'new': true
    };

    db.get().collection(COLLECTION_CHANNEL).findAndModify(
        criteria,
        [],
        update,
        options,
        function(err, result) {
            if (err) {
                return callback(err);
            }
            return callback(null, result);
        }
    );
};

var notify = function notify(params, callback) {
    assert.ok(params);
    assert.ok(params.imei);
    assert.ok(params.channel);

    var criteria = {
        'imei': params.imei,
        'channel': params.channel
    };

    db.get().collection(COLLECTION_CHANNEL).findOne(criteria, function(err, channel) {
        if (err) {
            return callback(err);
        }

        if (!channel) {
            return callback(new Error('No channel found'));
        } else {
            return sendNotification(channel, callback);
        }
    });
};


module.exports = {
    register: register,
    notify: notify,
};
