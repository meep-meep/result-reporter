var express = require('express');


var app = express.Router();


app.get(
    '/report',
    function(request, response, next) {
        return actions.GETreport(request.url, request.headers['user-agent'])
            .then(function() {
                next();
            })
            .catch(function(error) {
                console.error(error);
            });
    });

app.get(
    '/results/raw.json',
    function(request, response, next) {
        actions.GETraw()
            .then(function(raw) {
                response.send({
                    rawResults: raw.results,
                    stats: raw.stats
                });
            })
            .catch(function(error) {
                console.error(error);
            });
    });

app.get(
    '/results',
    function(request, response, next) {
        actions.GETresults()
            .then(function(rendererView) {
                response.send(rendererView);
            });
    });


module.exports = {
    middleware: app,
    setDataAdapter: actions.setDataAdapter,
    setReader: actions.setCustomReader,
    addWriter: actions.addWriter,

    on: actions.triggers.on.bind(actions.triggers),
    once: actions.triggers.once.bind(actions.triggers),
    removeListener: actions.triggers.removeListener.bind(actions.triggers),
    removeAllListeners: actions.triggers.removeAllListeners.bind(actions.triggers)
};
