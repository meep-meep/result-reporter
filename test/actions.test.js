var RSVP = require('rsvp');
var expect = require('expect.js');
var mockery = require('mockery');


var actions;


describe('actions', function() {
    before(function() {
        mockery.enable({useCleanCache: true});
        mockery.registerMock('fs', {readFile:function(path, options, callback) {
            process.nextTick(function() {
                return callback(null, 'file data');
            });
        }});
        mockery.registerMock('path', {join: function(a, b) {return a + b;}});
        mockery.registerAllowable('rsvp');
        mockery.registerAllowable('events');
        mockery.registerAllowable('../src/actions');
        mockery.registerMock('ejs', {compile: function() {return function(string) {return string;};}});
        mockery.registerMock('express-useragent', {});
    });

    after(function() {
        mockery.deregisterMock('fs');
        mockery.deregisterMock('path');
        mockery.deregisterAllowable('rsvp');
        mockery.deregisterAllowable('events');
        mockery.deregisterAllowable('../src/actions');
        mockery.deregisterMock('ejs');
        mockery.deregisterMock('express-useragent');
        mockery.deregisterMock('querystring');
        mockery.disable();
    });

    describe('GETreport', function() {
        before(function() {
            mockery.registerMock('querystring', {
                parse: function() {return {failures: 4, testIndex: 5};}
            });
            actions = require('../src/actions');
        });

        after(function() {
            mockery.deregisterMock('querystring');
        });

        it('should call the writer with the right data', function() {
            actions.addWriter(function(report) {
                expect(report).to.eql({
                    failures: 4,
                    testIndex: 5,
                    ua: 'user agent',
                    reportTime: report.reportTime
                });
                return RSVP.Promise.resolve();
            });
            return actions.GETreport('http://my-url.com', 'user agent');
        });
    });

    describe('GETraw', function() {
        before(function() {
            mockery.registerMock('querystring', {});
            actions = require('../src/actions');
        });

        after(function() {
            mockery.deregisterMock('querystring');
        });

        describe('with no reader set', function() {
            it('should fail', function(done) {
                return actions.GETraw()
                    .catch(function(error) {
                        expect(!!error).to.be(true);
                        done();
                    });
            });
        });

        describe('with a reader set', function() {
            it('should return data from the reader and stats', function() {
                var testResult = {
                            testIndex: 0,
                            testRunnerSession: 'ee',
                            target: 'target',
                            ua: 'ua',
                            failures: 3
                        };
                actions.setCustomReader(function() {
                    return [testResult];
                });
                return actions.GETraw()
                    .then(function(result) {
                        expect(result.results).to.eql([testResult]);
                        expect(result.stats).to.eql({
                            target: {
                                tests: [
                                    {
                                        conditions: testResult,
                                        min: 3,
                                        max: 3,
                                        total: 1,
                                        failures: 1
                                    }
                                ],
                                status: 1,
                                'full-failure': [testResult],
                                'partial-failure': []
                            }
                        });
                    });
            });
        });      
    });

    describe('GETresults', function() {
        before(function() {
            mockery.registerMock('querystring', {});
            actions = require('../src/actions');
        });

        after(function() {
            mockery.deregisterMock('querystring');
        });

        it('should not throw any error', function() {
            return actions.GETresults();
        });
    });
});
