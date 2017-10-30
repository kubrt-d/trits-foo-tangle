#!/usr/bin/env node

"use strict";

const TRITS_DB_NAME = 'foongle';
const TRITS_TEST_DB_NAME = 'foongle_test_delete_me';
const TRITS_DEPOSIT_ADDRESS  = 'DEPOSITXXX99999999999999999999999999999999999999999999999999999999999999999999999';
const TRITS_WITHDRAWAL_ADDRESS  = 'WIDTHDRAWALXXX9999999999999999999999999999999999999999999999999999999999999999999';


var express = require('express');
var app = express();
var minimist = require('minimist');
var bodyParser = require('body-parser');
var moment = require('moment');
var generateSeed = require ('iota-seed-generator');


var design = {
    "_id": "_design/search",
    "language": "javascript",
    "views": {
        "to": {
            "map": "function(doc) { if (doc.to) {emit(doc.to,doc)}}"
        },
        "sum": {
            "map": "function(doc) { if (doc.to) {emit(doc.to,doc.value)}}",
            "reduce": "_sum"
        }
    }
};

async function seed(cb) {
    try {
        var seed = await generateSeed();
        cb(seed);
    }
    catch (err) {
        cb(null);
    }
}


// Process the command line arguments
var argv = minimist(process.argv.slice(2), {
    string: [ 'iri' ],
    alias: {
        h: 'help',
        t: 'test',
        p: 'port'
    }
});

if (argv.hasOwnProperty('help')) printHelp();


// Defaults
var port = 56241;
var host = "127.0.0.1";

if (typeof argv.port === 'string'){
    var portArgs = argv.port.split(':');
    port = portArgs[1];
    host = portArgs[0];
}
else if (argv.port){
    port = argv.port;
}

var test_mode = argv.hasOwnProperty('test');



// CouchDB connection

// TODO: This err callback doesn't seem to work, it throws error earlier, even try-catch doesn't seem to work
var nano = require('nano')('http://localhost:5984', function (err) {
    if (err) {
        console.log("Can't connect to CouchDB, exiting !");
        return;
    }
});

// Open the database, alternatively create it if it doesn't exist, also support test mode
if (test_mode) {
    var db_name = '';
    nano.db.destroy(TRITS_TEST_DB_NAME);
    db_name = TRITS_TEST_DB_NAME;
} else {
    db_name = TRITS_DB_NAME;
}

/// TODO: This is not very nice, should find a better check if database already exists
nano.db.get(db_name, function(err, body) {
    if (err) {
        nano.db.create(db_name);
        var foongle = nano.db.use(db_name);
        foongle.insert(design, function (err, body) {
            if (err)
                console.log(err)
        });
    }
});

var foongle = nano.db.use(db_name);

// Router
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
var router = express.Router();
app.use('/foo', router);

// ROUTES FOR OUR API
// =============================================================================

// <-- route middleware and first route are here

// more routes for our API will happen here

// Welcome route
router.get('/', function(req, res) {
    res.json({ message: 'SUCCESS: Welcome to Foo Tangle api!' });
});

// Test route
if (test_mode) {
    router.get('/test', function(req, res) {
        res.json({ message: 'SUCCESS: TEST OK' });
    });
    router.get('/wipe', function(req, res) {
        nano.db.destroy(db_name,function() {
            nano.db.create(db_name, function (){
                var foongle = nano.db.use(db_name);
                foongle.insert(design, function (err, body) {
                    res.json({ message: 'SUCCESS: DATABASE WIPED' });
                });
            });
        });
    });
}

// Transfer route - Transfer coins from one address to another

router.route('/transfer').post(function(req, res) {
    var from = req.body.from;
    var to = req.body.to;
    var value = parseInt(req.body.value);
    var now = moment();
    var timestamp = now.format('x');


    if (isAddress(from) && isAddress(to) && isValue(value) && value > 0 ) {
        //console.log('Request transfer from: ' + from + ' to ' + to + ' , value: ' + value);
        // Deposit - From deposit to someone
        if (from == TRITS_DEPOSIT_ADDRESS) {
            foongle.insert({timestamp: timestamp, from: TRITS_DEPOSIT_ADDRESS, to: to, value: value}, function (err,body,header) {
                if (!err) {
                    res.json({ message: 'SUCCESS: DEPOSIT OK' });
                } else {
                    res.json({ message: 'ERROR: Error storing in CouchDB' });
                }
            });
        }

        // For any other transactions apart from deposit, check the senders balance first
        checkFoongleBalance(from, function (balance) {

            // Withdrawal - From someone to withdrawal (internally written other way around with a negative value
            if (balance >= value ) {

                if (to == TRITS_WITHDRAWAL_ADDRESS) {
                    foongle.insert({timestamp: timestamp, from: TRITS_WITHDRAWAL_ADDRESS, to: from, value: -value}, function (err,body,header) {
                        if (!err) {
                            res.json({ message: 'SUCCESS: WITHDRAWAL OK' });
                        } else {
                            res.json({ message: 'ERROR: Error storing in CouchDB' });
                        }
                    });

                    return;
                }

                // Other transfers

                foongle.view('search', 'to', {key : to}, function(err, body) {
                    if (!err) {
                        // We only allow transfers to previously registered addresses unless it's a deposit
                        // Players register by depositing
                        if (body.rows.length > 0 ) {

                            foongle.insert({timestamp: timestamp, from: from, to: to, value: value}, function (err, body) {
                                if (!err) {
                                    foongle.insert({timestamp: timestamp, from: to, to: from, value: -value}, function (err, body) {
                                        if (!err){
                                            res.json({ message: 'SUCCESS: Transaction registered' });
                                        } else {
                                            res.json({ message: 'ERROR: Error storing in CouchDB' });
                                        }
                                    });
                                } else {
                                    res.json({ message: 'ERROR: Error storing in CouchDB' });
                                }
                            });
                        } else {
                            res.json({message: 'ERROR: UNSEEN ADDRESS'});
                        }
                    }
                });
            } else { // Insufficient funds
                res.json({message: 'ERROR: INSUFFICIENT BALANCE'});
            }
        });
    }
    else {
        res.json({ message: 'ERROR: INVALID FORMAT' });
    }
});

// List all transaction to the  address

router.route('/to/:address').get(function(req, res) {
    var address = req.params.address;
    if (isAddress (address) ) {
        foongle.view('search', 'to', {key : req.params.address}, function(err, body) {
            if (!err) {
                res.json(body);
            }
        });
    }
});

// Get balance for address

router.route('/balance/:address').get(function(req, res) {

    var address = req.params.address;
    //console.log('Request balance check for: ' + address);
    checkFoongleBalance(address,function(balance){
        if (balance >= 0) {
            res.json({balance: balance});
        } else {
            res.json({balance: false});
        }
    })
});

// Generate random address

router.route('/random').get(function(req, res) {
    seed(function (new_address){
        if (new_address != null){
            res.json({address: new_address});
        } else {
            res.json({address: false});
        }
    });
});

var checkFoongleBalance = function (address, callback) {
    if (isAddress (address) ) {
        foongle.view('search', 'sum', {key : address}, function(err, body) {
            if (!err && body.hasOwnProperty('rows') && body.rows.length > 0 ) {
                callback(body.rows[0].value);
            } else {
                callback(false);
            }
        });
    }
}

//process.exit(0);



app.listen(port,host);
if (test_mode) {
    console.log("Serving Foo Tangle in TEST MODE at http://" + host + ":" + port);
} else {
    console.log("Serving Foo Tangle at http://" + host + ":" + port);
}

process.on('SIGINT', function() {
    if (test_mode) {
        // In test mode ONLY!!!, clean up after yourself
        nano.db.destroy(TRITS_TEST_DB_NAME,function (err,body) {
            console.log("");
            console.log("Cleaning up");
            process.exit(0);
        });
    } else {
        console.log("");
        console.log("Bye.");
        process.exit(0);
    }
});


// Helper functions
// =============================================================================

// Validations borrowed from https://github.com/iotaledger/iota.lib.js/blob/master/lib/utils/inputValidator.js
/**
 *   checks if input is correct address
 *
 *   @method isAddress
 *   @param {string} address
 *   @returns {boolean}
 **/

var isAddress = function(address) {
    // TODO: In the future check checksum

    // Check if address with checksum
    if (address.length === 90) {

        if (!isTrytes(address, 90)) {
            return false;
        }
    } else {

        if (!isTrytes(address, 81)) {
            return false;
        }
    }

    return true;
}


/**
 *   checks if input is correct trytes consisting of A-Z9
 *   optionally validate length
 *
 *   @method isTrytes
 *   @param {string} trytes
 *   @param {integer} length optional
 *   @returns {boolean}
 **/

var isTrytes = function(trytes, length) {

    // If no length specified, just validate the trytes
    if (!length) length = "0,"

    var regexTrytes = new RegExp("^[9A-Z]{" + length +"}$");
    return regexTrytes.test(trytes) && isString(trytes);
}

/**
 *   checks whether input is a string or not
 *
 *   @method isString
 *   @param {string}
 *   @returns {boolean}
 **/

var isString = function(string) {

    return typeof string === 'string';
}

var isString = function(string) {

    return typeof string === 'string';
}

/**
 *   checks if integer value
 *
 *   @method isValue
 *   @param {string} value
 *   @returns {boolean}
 **/
var isValue = function(value) {

    // check if correct number
    return Number.isInteger(value)
}

/**
 *   prints usage and help message
 *
 **/

function printHelp()
{
    console.log("");
    console.log("Trits Foo Tangle - sandbox transaction storage with REST api and CouchDB backend");
    console.log("");
    console.log("Usage:");
    console.log("trits-foo-tangle [--port=your_local_port] [--test]");
    console.log("  -t --test      = Run in test mode to allow local Mocha tests to pass");
    console.log("  -p --port      = Local server IP and port");
    console.log("  -h --help      = print this message");
    console.log("");
    console.log("Examples:");
    console.log("trits-foo-tangle -p 127.0.0.1:56241");
    console.log("trits-foo-tangle -t ");
    console.log("");
    process.exit(0);
};
