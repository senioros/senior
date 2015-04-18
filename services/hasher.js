'use strict';

var crypto = require('crypto'),
    config = require('../config');

function hash(str) {
    var salt = config.salt || '';
    var hashed = crypto.createHash('sha256').update(salt + str, 'utf8').digest('base64');
    return hashed;
}

module.exports = {
    hash: hash
};
