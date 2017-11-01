/**
 * Created by marekt on 19.10.17.
 */
const TRITS_DEPOSIT     = 'DEPOSITXXX99999999999999999999999999999999999999999999999999999999999999999999999';
const TRITS_WITHDRAWAL  = 'WIDTHDRAWALXXX9999999999999999999999999999999999999999999999999999999999999999999';
const TRITS_NEO         = 'NEO999999999999999999999999999999999999999999999999999999999999999999999999999999';
const TRITS_TRINITY     = 'TRINITY99999999999999999999999999999999999999999999999999999999999999999999999999';
const TRITS_MORPHEUS    = 'MORPHEUS9999999999999999999999999999999999999999999999999999999999999999999999999';
const TRITS_UNKNOWN     = 'UNKNOWN99999999999999999999999999999999999999999999999999999999999999999999999999';
const TRITS_OVERSPEND   = 'OVERSPEND999999999999999999999999999999999999999999999999999999999999999999999999';
const TRITS_UNSEEN      = 'UNSEEN999999999999999999999999999999999999999999999999999999999999999999999999999';

var assert = require('assert');

var port = 57241;
var host = "127.0.0.1";

var api_root = 'http://' + host + ':' + port + '/foo';
var request = require('request');
var async = require('async');

request(api_root + '/test', { json: true }, function (err, res, body) {
    if (err || body.message == undefined) {
        console.log("Error: Can't reach " + api_root+ '/test');
        console.log("Note: You must have trits-foo-tangle service running, started with -t option at htttp://127.0.0.1:57241");
        console.log("Example: node index.js -t -p "+ host + ':' + port);
        process.exit(0)
    }
});

describe('Trist Foo Tangle', function(){
    before(function(done) {
        request.get(api_root + '/wipe', { json: true } , function (err, res, body) {
            done();
        });
    });
    describe('Ping', function(){
        it('Should return SUCCESS: TEST OK', function (done) {
            request.get(api_root + '/test', { json: true } , function (err, res, body) {
                assert.equal(body.message,'SUCCESS: TEST OK');
                done();
            });
        });
    });

    describe('Generate Random Address', function(){
        it('Should return an address', function (done) {
            request.get(api_root + '/random', { json: true } , function (err, res, body) {
                assert.notEqual(false,body.address);
                done();
            });
        });
    });

    describe('Deposit and withdrawal', function(){
        it('Should return SUCCESS: DEPOSIT OK and then SUCCESS: WITHDRAWAL OK', function (done) {
            var options = {
                method: 'POST',
                uri: api_root + '/transfer',
                body: {
                    from: TRITS_DEPOSIT,
                    to: TRITS_MORPHEUS,
                    value: 100
                },
                json: true
            };
            request.post(options, function(err,res,body){
                assert.equal(body.message,'SUCCESS: DEPOSIT OK');
                options.body.from = TRITS_MORPHEUS;
                options.body.to = TRITS_WITHDRAWAL;
                options.body.value = 50;
                request.post(options, function(err,res,body){
                    assert.equal(body.message,'SUCCESS: WITHDRAWAL OK');
                    done();
                })
            })
        });
    });
    describe('An attempt to post to an unknown address', function(){
        it('Should return ERROR: UNSEEN ADDRESS', function (done) {
            var options = {
                method: 'POST',
                uri: api_root + '/transfer',
                body: {
                    from: TRITS_MORPHEUS,
                    to: TRITS_UNSEEN,
                    value: 40
                },
                json: true
            };
            request.post(options, function(err,res,body){
                assert.equal(body.message,'ERROR: UNSEEN ADDRESS');
                done();
            })
        })
    });

    describe('An attempt to overspend', function(){
        it('Should return ERROR: INSUFFICIENT BALANCE', function (done) {
            var options = {
                method: 'POST',
                uri: api_root + '/transfer',
                body: {
                    from: TRITS_DEPOSIT,
                    to: TRITS_OVERSPEND,
                    value: 100
                },
                json: true
            };
            request.post(options, function(err,res,body){
                //assert.equal(body.message,'SUCCESS: DEPOSIT OK');
                options.body.from = TRITS_OVERSPEND;
                options.body.to = TRITS_MORPHEUS;
                options.body.value = 150;
                request.post(options, function(err,res,body){
                    assert.equal(body.message,'ERROR: INSUFFICIENT BALANCE');
                    done();
                })
            })
        });
    });

    describe('An attempt to transfer negative value', function(){
        it('Should return ERROR: INVALID FORMAT', function (done) {
            var options = {
                method: 'POST',
                uri: api_root + '/transfer',
                body: {
                    from: TRITS_MORPHEUS,
                    to: TRITS_UNKNOWN,
                    value: -100
                },
                json: true
            };
            request.post(options, function(err,res,body){
                assert.equal(body.message,'ERROR: INVALID FORMAT');
                done();
            })
        })
    });

    describe('A chain of transactions', function(){
        it('Should return correct balances', function (done) {
            var ops = {
                method: 'POST',
                uri: api_root + '/transfer',
                body: {from: '', to: '', value: 0},
                json: true
            };

            async.series([
                function(callback){ops.body.from = TRITS_DEPOSIT;ops.body.to = TRITS_TRINITY;ops.body.value = 100; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_DEPOSIT; ops.body.to = TRITS_NEO; ops.body.value = 100; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_DEPOSIT; ops.body.to = TRITS_MORPHEUS; ops.body.value = 100; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_TRINITY; ops.body.to = TRITS_NEO; ops.body.value = 30; request.post(ops, callback)},
                function(callback){ ops.body.from = TRITS_TRINITY; ops.body.to = TRITS_MORPHEUS; ops.body.value = 30; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_TRINITY; ops.body.to = TRITS_MORPHEUS; ops.body.value = 30000 ; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_TRINITY; ops.body.to = TRITS_MORPHEUS; ops.body.value = -30000; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_NEO; ops.body.to = TRITS_MORPHEUS; ops.body.value = 20; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_NEO; ops.body.to = TRITS_MORPHEUS; ops.body.value = 30; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_NEO; ops.body.to = TRITS_TRINITY; ops.body.value = 10; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_MORPHEUS; ops.body.to = TRITS_TRINITY; ops.body.value = 30; request.post(ops,callback)},
                function(callback){ ops.body.from = TRITS_MORPHEUS; ops.body.to = TRITS_WITHDRAWAL; ops.body.value = 10; request.post(ops,callback)},
                ],
            // optional callback
                function (err, res) {
                    request.get( api_root + '/balance/' + TRITS_TRINITY, { json: true } , function (err, res, body) {
                        assert.equal(body.balance,80);
                        done();
                    })
                }
            );
        })
    });
});

