// MIT License 2017
// Author: Jay Randez github.com/jayrandez

var https = require('https')
var xml = require('xml2js');
var fs = require('fs');
var timers = require('timers');
var dateformat = require('dateformat');
var prompt = require('prompt');
var colors = require('colors/safe');
main();

function main() {
    var schema = {
        properties: {
            username: { required: true },
            password: {
                hidden: true,
                replace: "*",
                required: true
            },
            page: { required: true },
            logfile: { required: false },
            start: { required: false },
            interval: { required: true }
        },
        message: "",
        delimiter: "> "
    };

    prompt.message = "";
    prompt.delimiter = ">";
    prompt.start();
    
    console.log(colors.cyan(
        "\nActBlue Contributions Logger\n\nExpress time and time intervals as 24 Hour - Hour:Minute:Second\n"
    ));
    console.log(colors.cyan(
        "The following parameters are optional:\n   - start (default = immediate)\n   - logfile (default = log.csv)\n"
    ));
    
    prompt.get(schema, function (err, result) {
        if(err) {
            console.log(err.message);
            return;
        }
        startRoutine(result);
    });
}

function startRoutine(param) {
    var delay = param.start.split(":");
    var period = param.interval.split(":")
    
    var options = {
        host: 'secure.actblue.com',
        path: '/api/2009-08/pages/' + param.page,
        method: 'GET',
        headers: {
            'Authorization': 'Basic ' + new Buffer(param.username + ':' + param.password).toString('base64'),
            'Accept' : 'application/xml'
        }
    };

    for(var i = 0; i < 3; i++)
        period[i] = parseInt(period[i], 10);
    var period = ((period[0] * 60 + period[1]) * 60 + period[2]) * 1000;
    if(period < 1000) {
        console.error("\nPeriod is in Hours:Minutes:Seconds, must be at least 1000 ms.");
        return;
    }
    else {
        console.log(colors.cyan("\nRequest will repeat with period of " + period + " ms."));
    }
    var scheduleFunc = function() {
        timers.setInterval(request, period, options, param.logfile);
        request(options, param.logfile);
    }
    
    if(!param.start) {
        console.log(colors.cyan("Starting immediately.\n"));
        timers.setImmediate(scheduleFunc);
    }
    else {
        for (var i = 0; i < 3; i++)
            delay[i] = parseInt(delay[i], 10);
        var delayTime = new Date();
        delayTime.setHours(delay[0], delay[1], delay[2]);
        var delay = delayTime - (new Date());
        
        console.log(colors.cyan("Delayed start in " + delay + " ms.\n"));
        timers.setTimeout(scheduleFunc, delay);
    }
}

function request(options, logfile) {
    var date = new Date();
    var req = https.request(options, function(res) {
        if(res.statusCode == 200) {
            var body = "";
            res.setEncoding('utf-8');
            res.on('data', function(chunk) { body = body + chunk; });
            res.on('end', function() { responseBody(body, date, logfile); });
        }
        else {
            responseError(null);
        }
    });
    req.on('error', responseError);
    req.end();
}

function responseBody(body, date, logfile) {
    xml.parseString(body, function(err, result) {
        if(err != null) {
            responseError(err);
            return;
        }
        
        if(!logfile)
            logfile = "log.csv"
        
        var goal = result.page.goal[0];
        var amount = goal.amount[0];
        var total = goal.total[0];
        var count = goal.count[0];
        
        var line = dateformat(date, "mmm-dd-yyyy,HH:MM:ss Z") + "," + total + "," + count;
        fs.appendFile(logfile, line + "\n", logError);
        console.log(line)
    });
}

function responseError(err) {
    console.error('Problem with request/response: ' + err.message);
}

function logError(err) {
    if(err)
        console.error('Problem writing to log: ' + err);
}
