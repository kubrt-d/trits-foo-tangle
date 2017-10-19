/**
 * Created by marekt on 19.10.17.
 */

var assert = require('assert');

var port = 56241;
var host = "127.0.0.1";

var api_root = 'http://' + host + ':' + port + '/foo';
var request = require('request');

request(api_root + '/test', { json: true }, function (err, res, body) {
    if (err || body.message == undefined) {
        console.log("Error: Can't reach " + api_root+ '/test');
        console.log("Note: You must have trits-foo-tangle service running, started with -t option on a standard port");
        console.log("Example: node index.js -t -p "+ host + ':' + port);
        process.exit(0)
    }
});

describe('Trist Foo Tangle', function(){
    describe('Ping', function(){
        it('Should return SUCCESS: TEST OK', function (done) {
            request.get(api_root + '/test', { json: true } , function (err, res, body) {
                assert.equal(body.message,'SUCCESS: TEST OK');
                done();
            });
        });
    });
});

