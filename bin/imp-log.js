#! /usr/bin/env node

// Get logs for the a device running the current model

var program = require("commander");
var prompt = require("cli-prompt");
var colors = require("colors");
var fs = require("fs");
var Spinner = require("cli-spinner").Spinner;
var ImpConfig = require("../lib/impConfig.js");

var config = new ImpConfig();
var spinner = new Spinner("Contacting the impCloud... %s");
spinner.setSpinnerString(5);

var messageFormat = {
    "agent.log":    { message: "[Agent]", color: colors.cyan },
    "agent.error":  { message: "[Agent]", color: colors.red },
    "server.log":   { message: "[Device]", color: colors.blue },
    "server.error": { message: "[Device]", color: colors.red },
    "server.sleep": { message: "[Device]", color: colors.blue },
    "powerstate":   { message: "[Device]", color: colors.blue },
    "lastexitcode": { message: "[Device]", color: colors.blue },
    "firmware":     { message: "[Device]", color: colors.blue },
    "status":       { message: "[Status]", color: colors.yellow }
};

program
    .option("-d, --device <deviceID>", "The device ID you would like to see logs for")
    .option("-t, --title <deviceName>", "The device name you would like to see logs for")
    .option("-l, --list", "Present the most recent logs rather than a stream")
    // Note: can't use 'name' as an option - it's reserved

program.parse(process.argv);

if (!("device" in program || "title" in program)) {
    // log requires a device name or a device ID
    console.log("ERROR: You must specify a device with either '-d <deviceID>' or '-t <deviceName>'");
    return;
}

function formatDate(d) {
    var pad = function(num, size) {
        if (!size) size = 2;
        var s = "000000000" + num;
        return s.substr(s.length-size);
    };

    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " "
        + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + " "
        + "UTC" + (d.getTimezoneOffset() / -60)
}

function formatMessage(log) {
    var format = messageFormat[log.type];
    return colors.grey(formatDate(new Date(log.timestamp))) + " "
         + format.color(format.message) + "\t"
         + colors.grey(log.message);
}

function startLogStream(deviceID) {
    imp.streamDeviceLogs(deviceID, function(err, data) {
        if (err) {
            console.log("ERROR: " + err.message_short);
            return;
        }

        if ("logs" in data) {
            data.logs.forEach(function(log) {
                console.log(formatMessage(log));
            });
        }
    });
}

function getLogs(deviceID) {
    if (!spinner.isSpinning()) spinner.start();
    imp.getDeviceLogs(deviceID, null, function(err, data) {
        spinner.stop(true);
        if (err) {
            console.log("ERROR: " + err.message_short);
            return setTimeout(function() {
                getLogs(deviceID);
            }, 1000);
        }

        if ("logs" in data) {
            data.logs.forEach(function(log) {
                console.log(formatMessage(log));
            });
        }
    });
}

function selectLogType(deviceID) {
    if ("list" in program) {
        // User wants a log dump
        getLogs(deviceID);
    } else {
        if (spinner.isSpinning()) spinner.stop(true);
        if ("title" in program) {
            console.log("Opening stream for device name '" + program.title + "'. Hit Ctrl-C to quit logging");
        } else {
            console.log("Opening stream for device ID '" + program.device + "'. Hit Ctrl-C to quit logging");
        }

        startLogStream(deviceID);
    }
}

config.init(["apiKey"], function(err, success) {
    if (err) {
        console.log("ERROR: Global Build API key is not set. Run 'imp setup' then try 'imp log' again");
        return;
    }

    imp = config.createImpWithConfig();

    if ("title" in program) {
        // Convert passed in device name to a device ID and then start logging
        spinner.start();
        imp.getDevices(null, function(err, data) {
            if (err) {
                spinner.stop(true);
                console.log("ERROR: " + err.message_short);
                return;
            }

            var devId = null;
            data.devices.forEach(function(device) {
                if (device.name.toLowerCase() == program.title.toLowerCase()) devId = device.id;
            });

            if (devId == null) {
                spinner.stop(true);
                console.log("ERROR: There is no device of name '" + program.title + "'");
                return;
            }

            selectLogType(devId);
        });
    } else if ("device" in program) {
        // Just use the passed in ID; we'll check for a valid ID later
        selectLogType(program.device);
    }
});
