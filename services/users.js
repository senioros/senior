'use strict';

var assert = require('assert'),
    db = require('./db'),
    logger = require('./logger');

var COLLECTION_USER = 'users';

function find(username, password, callback) {
    assert.ok(username);
    assert.ok(password);

    var criteria = {
        'username': username,
        'password': password
    };

    db.get().collection(COLLECTION_USER).findOne(criteria, function(err, user) {
        if (err) {
            return callback(err);
        }

        return callback(null, user);
    });
}

module.exports = {
    find: find
};
