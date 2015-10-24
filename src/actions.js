var fs = require('fs');
var path = require('path');

var querystring = require('querystring');
var RSVP = require('rsvp');
var ejs = require('ejs');
var useragent = require('express-useragent');
var EventEmitter = require('events').EventEmitter;


var triggers = new EventEmitter();
var customWriters = [];
var customReader = null;


module.exports = {
    triggers: triggers,

    GETreport: function GETreport(url, userAgent) {
        var qs = querystring.parse(url.split('?')[1]);
        qs.failures = parseInt(qs.failures);
        qs.testIndex = parseInt(qs.testIndex);
        qs.ua = userAgent;
        qs.reportTime = +(new Date());
        
        return RSVP.all(customWriters.map(function(customWriter) {
            return customWriter(qs);
        }));
    },

    GETraw: function GETraw() {
        return this._getResults()
            .then(function(results) {
                return {
                    results: results,
                    stats: this._makeStats(results)
                };
            }.bind(this));
    },

    GETresults: function GETresults() {
        return this._getResults()
            .then(function(results) {
                return this._getRenderedMarkup(
                    {stats: this._makeStats(results)},
                    '../templates/results.html'
                );
            }.bind(this));
    },

    _getFileContent: function _getFileContent(filename) {
        return new RSVP.Promise(function(resolve, reject) {
            fs.readFile(
                path.join(__dirname, filename),
                {encoding: 'utf8'},
                function(error, result) {
                    if(error) {
                        reject(error);
                        return;
                    }
                    resolve(result.toString());
                }
            );
        });
    },

    _getRenderedMarkup: function _getRenderedMarkup(templateData, templateFileName) {
        return this._getFileContent(templateFileName)
            .then(function(templateString) {
                return (ejs.compile(templateString))(templateData);
            });
    },

    _formatUa: function _formatUa(ua) {
        var parsedUa = useragent.parse(ua);
        var os = parsedUa.OS;
        if(parsedUa.isAndroid) {
            os = 'Android ' + parsedUa.Version;
        }
        else if(parsedUa.isiPhone || parsedUa.isiPad || parsedUa.isiPod) {
            os = 'IOS ' + parsedUa.Version;
        }

        return parsedUa.Browser + '-' + os;
    },

    _makeStats: function _makeStats(results) {
        var stats = {};

        results.forEach(function(result) {
            var testIndex = result.testIndex;
            var testRunnerSession = result.testRunnerSession;
            var target = result.target;
            if(!target) {
                target = this._formatUa(result.ua);
            }
            if(!stats[target]) {
                stats[target] = {
                    tests: [],
                    status: 0,
                    'full-failure': [],
                    'partial-failure': []
                };
            }

            if(stats[target].tests[testIndex] === undefined) {
                stats[target].tests[testIndex] = {
                    conditions: result,
                    min: result.failures,
                    max: result.failures,
                    total: 1,
                    failures: result.failures ? 1 : 0
                };
            }
            else {
                stats[target].tests[testIndex].min = Math.min(stats[target].tests[testIndex].min, result.failures);
                stats[target].tests[testIndex].max = Math.max(stats[target].tests[testIndex].max, result.failures);
                stats[target].tests[testIndex].total += 1;
                stats[target].tests[testIndex].failures += result.failures ? 1 : 0;
            }
        });

        Object.keys(stats)
            .map(function(statName) {
                return stats[statName];
            })
            .forEach(function(target) {
                // aggregate result sets
                target.tests.forEach(function(testStats, index) {
                    var ratio = testStats.failures / testStats.total;
                    target.status = Math.max(target.status, ratio);
                    if(ratio === 1) {
                        target['full-failure'].push(target.tests[index].conditions);
                    }
                    else if(ratio > 0) {
                        target['partial-failure'].push(target.tests[index].conditions);
                    }
                });
            });

        return stats;
    },

    _getResults: function _getResults() {
        return RSVP.Promise.resolve()
            .then(function() {
                if(!customReader) {
                    throw(new Error('no reader set'));
                }
                return customReader();
            });
    },

    setCustomReader: function setCustomReader(reader) {
        customReader = reader;
    },

    addWriter: function addWriter(writer) {
        customWriters.push(writer);
    },

    addTrigger: function addTrigger(eventName, callback) {
        triggers[eventName].push(callback);
    },

    trigger: function trigger(eventName) {
        triggers[eventName].forEach(function(trigger) {
            trigger();
        });
    },

    setDataAdapter: function setDataAdapter(adapter) {
        setCustomReader(adapter.reader.bind(adapter));
        addWriter(adapter.writer.bind(adapter));
    }
};
