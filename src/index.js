var fs = require('fs');
var path = require('path');

var express = require('express');
var querystring = require('querystring');
var RSVP = require('rsvp');
var ejs = require('ejs');
var useragent = require('express-useragent');
var EventEmitter = require('events').EventEmitter;


var customwriters = [];
var customReader = null;
var triggers = new EventEmitter();
var results = {};


var app = express();

app.get(
    '/report',
    function(request, response, next) {
        var qs = querystring.parse(request.url.split('?')[1]);
        qs.failures = parseInt(qs.failures);
        qs.testIndex = parseInt(qs.testIndex);

        var ua = useragent.parse(request.headers['user-agent']);
        var os = ua.OS;
        if(ua.isAndroid) {
            os = 'Android ' + ua.Version;
        }
        else if(ua.isiPhone || ua.isiPad || ua.isiPod) {
            os = 'IOS ' + ua.Version;
        }
        if(!results[ua.Browser + '-' + os]) {
            results[ua.Browser + '-' + os] = {};
        }
        if(!results[ua.Browser + '-' + os][qs.testRunnerSession]) {
            results[ua.Browser + '-' + os][qs.testRunnerSession] = {};
        }
        results[ua.Browser + '-' + os][qs.testRunnerSession][qs.testIndex] = qs;
        
        qs.ua = ua;
        customwriters.forEach(function(writer) {
            writer(qs);
        });
    });

app.get(
    '/results/raw.json',
    function(request, response, next) {
        response.send({
                rawResults: results,
                stats: makeStats(getResults())
            });
    });

app.get(
    '/results',
    function(request, response, next) {
        getRenderedMarkup(
            {stats: makeStats(results)},
            '../templates/results.html'
            )
            .then(function(rendererView) {
                response.send(rendererView);
            })
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

function makeStats(results) {
    var stats = {};

    for(var ua in results) {
        if(!stats[ua]) {
            stats[ua] = {
                tests: [],
                status: 0,
                'full-failure': [],
                'partial-failure': []
            };
        }
        // aggregate result sets
        for(var resultSet in results[ua]) {
            for(var testIndex in results[ua][resultSet]) {
                results[ua][resultSet][testIndex].failures = parseInt(results[ua][resultSet][testIndex].failures);
                if(stats[ua].tests[parseInt(testIndex)] === undefined) {
                    stats[ua].tests[parseInt(testIndex)] = {
                        conditions: results[ua][resultSet][testIndex],
                        min: results[ua][resultSet][testIndex].failures,
                        max: results[ua][resultSet][testIndex].failures,
                        total: 1,
                        failures: (results[ua][resultSet][testIndex].failures) ? 1 : 0
                    };
                }
                else {
                    stats[ua].tests[parseInt(testIndex)].min = Math.min(stats[ua].tests[parseInt(testIndex)], results[ua][resultSet][testIndex].failures);
                    stats[ua].tests[parseInt(testIndex)].max = Math.max(stats[ua].tests[parseInt(testIndex)], results[ua][resultSet][testIndex].failures);
                    stats[ua].tests[parseInt(testIndex)].total += 1;
                    stats[ua].tests[parseInt(testIndex)].failures += (results[ua][resultSet][testIndex].failures) ? 1 : 0;
                }
            }
        }

        stats[ua].tests.forEach(function(testStats, index) {
            var ratio = testStats.failures / testStats.total;
            stats[ua].status = Math.max(stats[ua].status, ratio);
            if(ratio === 1) {
                stats[ua]['full-failure'].push(stats[ua].tests[index].conditions);
            }
            else if(ratio > 0) {
                stats[ua]['partial-failure'].push(stats[ua].tests[index].conditions);
            }
        });
    }

    return stats;
}

function getResults() {
    if(customReader) {
        return customReader();
    }
    return results;
}

function setCustomReader(reader) {
    customReader = reader;
}

function addCustomWriter(writer) {
    customwriters.push(writer);
}

function addTrigger(eventName, callback) {
    triggers[eventName].push(callback);
}

function trigger(eventName) {
    triggers[eventName].forEach(function(trigger) {
        trigger();
    });
}


module.exports = {
    middleware: app,
    setReader: setCustomReader,
    addWriter: addCustomWriter,

    on: triggers.on.bind(triggers),
    once: triggers.once.bind(triggers),
    removeListener: triggers.removeListener.bind(triggers),
    removeAllListeners: triggers.removeAllListeners.bind(triggers)
};
