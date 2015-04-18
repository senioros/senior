'use strict';

var assert = require('assert'),
    ObjectID = require('mongodb').ObjectID,
    simplepush = require('./simplepush'),
    db = require('./db'),
    logger = require('./logger');

var COLLECTION_DEVICE = 'devices';

function all(callback) {
    var criteria = {};

    db.get().collection(COLLECTION_DEVICE).find(criteria).toArray(function(err, device) {
        if (err) {
            return callback(err);
        }

        return callback(null, device);
    });
}

function find(uid, callback) {
    assert.ok(uid);

    var criteria = {
        'uid': uid
    };

    db.get().collection(COLLECTION_DEVICE).findOne(criteria, function(err, device) {
        if (err) {
            return callback(err);
        }

        return callback(null, device);
    });
}

function update(uid, device, callback) {
    assert.ok(uid);
    assert.ok(device);
    assert.equal(false, !!device.uid);

    var criteria = {
        'uid': uid
    };

    var update = {
        '$set': device
    };

    var options = {
        'update': true,
        'new': true
    };

    db.get().collection(COLLECTION_DEVICE).findAndModify(
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
}

function refresh(uid, channel, callback) {
    callback = callback || function noop() {};

    var channel = {
        imei: uid,
        channel: channel
    };
    simplepush.notify(channel, function(err) {
        if (err) {
            return callback(err);
        }

        return callback();
    });
}

function insert_contact(uid, contact, callback) {
    assert.ok(uid);
    assert.ok(contact);
    assert.ok(contact.id);

    var criteria = {
        'uid': uid
    };

    var update = {
        '$push': {
            'contacts': contact
        }
    };

    var options = {
        'update': true,
        'new': true
    };

    db.get().collection(COLLECTION_DEVICE).findAndModify(
        criteria,
        [],
        update,
        options,
        function(err, result) {
            if (err) {
                return callback(err);
            }

            refresh(uid, 'contacts'); // XXX best effort notification

            return callback(null, result);
        }
    );
}

function remove_contact(uid, id, callback) {
    assert.ok(uid);
    assert.ok(id);

    var criteria = {
        'uid': uid
    };

    var update = {
        '$pull': {
            contacts: {
                'id': id
            }
        }
    };

    var options = {
        'update': true,
        'new': true
    };

    db.get().collection(COLLECTION_DEVICE).findAndModify(
        criteria,
        [],
        update,
        options,
        function(err, result) {
            if (err) {
                return callback(err);
            }

            refresh(uid, 'contacts'); // XXX best effort notification

            return callback(null, result);
        }
    );
}

function update_contact(uid, id, contact, callback) {
    assert.ok(uid);
    assert.ok(id);
    assert.ok(contact);
    assert.equal(false, !!contact.id);

    var criteria = {
        'uid': uid,
        'contacts': {
            '$elemMatch': {
                'id': id
            }
        }
    };

    // XXX this is a bit tricky
    //     parameters shouldn't be modified here to avoid side effects.
    contact.id = id;

    var update = {
        '$set': {
            'contacts.$': contact
        }
    };

    var options = {
        'update': true,
        'new': true
    };

    db.get().collection(COLLECTION_DEVICE).findAndModify(
        criteria,
        [],
        update,
        options,
        function(err, result) {
            if (err) {
                return callback(err);
            }

            refresh(uid, 'contacts'); // XXX best effort notification

            return callback(null, result);
        }
    );
}

module.exports = {
    all: all,
    find: find,
    update: update,
    refresh: refresh,
    contacts: {
        insert: insert_contact,
        remove: remove_contact,
        update: update_contact
    }
};
