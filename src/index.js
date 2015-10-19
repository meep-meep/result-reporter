var fs = require('fs');
var path = require('path');

var express = require('express');
var querystring = require('querystring');
var RSVP = require('rsvp');
var ejs = require('ejs');
var useragent = require('express-useragent');
var EventEmitter = require('events').EventEmitter;


var customWriters = [];
var customReader = null;
var triggers = new EventEmitter();


var app = express.Router();


app.get(
    '/report',
    function(request, response, next) {
        var qs = querystring.parse(request.url.split('?')[1]);
        qs.failures = parseInt(qs.failures);
        qs.testIndex = parseInt(qs.testIndex);
        qs.ua = request.headers['user-agent'];
        qs.reportTime = +(new Date());
        
        RSVP.all(customWriters.map(function(customWriter) {
            return customWriter(qs);
        }));
    });

app.get(
    '/results/raw.json',
    function(request, response, next) {
        getResults().then(function(results) {
            response.send({
                rawResults: results,
                stats: makeStats(results)
            });
        });
    });

app.get(
    '/results',
    function(request, response, next) {
        getResults()
            .then(function(results) {
                return getRenderedMarkup(
                    {stats: makeStats(results)},
                    '../templates/results.html'
                    )
                    .then(function(rendererView) {
                        response.send(rendererView);
                    });
            });
    });


function getRenderedMarkup(templateData, templateFileName) {
    return new RSVP.Promise(function(resolve, reject) {
        fs.readFile(
            path.join(__dirname, templateFileName),
            {encoding: 'utf8'},
            function(error, result) {
                if(error) {
                    reject(error);
                    return;
                }
                resolve((ejs.compile(result.toString()))(templateData));
            }
        );
    });
}

function formatUa(ua) {
    var parsedUa = useragent.parse(ua);
    var os = parsedUa.OS;
    if(parsedUa.isAndroid) {
        os = 'Android ' + parsedUa.Version;
    }
    else if(parsedUa.isiPhone || parsedUa.isiPad || parsedUa.isiPod) {
        os = 'IOS ' + parsedUa.Version;
    }

    return parsedUa.Browser + '-' + os;
}

function makeStats(results) {
    var stats = {};

    results.forEach(function(result) {
        var testIndex = result.testIndex;
        var testRunnerSession = result.testRunnerSession;
        var target = result.target;
        if(!target) {
            target = formatUa(result.ua);
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
            stats[target].tests[testIndex].min = Math.min(stats[target].tests[testIndex], result.failures);
            stats[target].tests[testIndex].max = Math.max(stats[target].tests[testIndex], result.failures);
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
}

function getResults() {
    if(!customReader) {
        throw(new Error('no reader set'));
    }
    return customReader();
}

function setCustomReader(reader) {
    customReader = reader;
}

function addWriter(writer) {
    customWriters.push(writer);
}

function addTrigger(eventName, callback) {
    triggers[eventName].push(callback);
}

function trigger(eventName) {
    triggers[eventName].forEach(function(trigger) {
        trigger();
    });
}

function setDataAdapter(adapter) {
    setCustomReader(adapter.reader.bind(adapter));
    addWriter(adapter.writer.bind(adapter));
}


module.exports = {
    middleware: app,
    setDataAdapter: setDataAdapter,
    setReader: setCustomReader,
    addWriter: addWriter,

    on: triggers.on.bind(triggers),
    once: triggers.once.bind(triggers),
    removeListener: triggers.removeListener.bind(triggers),
    removeAllListeners: triggers.removeAllListeners.bind(triggers)
};
