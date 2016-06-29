#! /usr/bin/env node

// Get logs for the a device running the current model

var program = require("commander");
var prompt = require("cli-prompt");
var colors = require("colors");
var fs = require("fs");

var ImpConfig = require("../lib/impConfig.js");
var config = new ImpConfig();

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
    console.log("ERROR: You must specify a device with '-d <deviceID>' or '-t <deviceName>'");
    return;
}

function formatDate(d) {
    var pad = function(num, size) {
        if (!size) size = 2;
        var s = "000000000" + num;
        return s.substr(s.length-size);
    };

    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDay()) + " "
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
    imp.getDeviceLogs(deviceID, null, function(err, data) {
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

config.init(["apiKey"], function(err, success) {
    if (err) {
        console.log("ERROR: Global Build API key is not set - run 'imp setup' then try 'imp log' again");
        return;
    }

    imp = config.createImpWithConfig();
    var devId = null;

    if ("title" in program) {
        // Convert passed in device name to a device ID and then start logging
        imp.getDevices(null, function(err, data) {
            if (err) {
                console.log("ERROR: " + err.message_short);
                return;
            }

            data.devices.forEach(function(device) {
                if (device.name == program.title) devId = device.id;
            });

            if (!devId) {
                console.log("ERROR: There is no device of name '" + program.title + "'");
                return;
            }
        });
    } else if ("device" in program) {
        // Just use the passed in ID; we'll check for a valid ID later
        devId = program.device;
    }

    if ("list" in program) {
        // User wants a log dump
        getLogs(devId);
    } else {
        if ("title" in program) {
            console.log("Opening stream for device '" + program.title + "'. Hit Ctrl-C to quit logging");
        } else {
            console.log("Opening stream for device '" + program.device + "'. Hit Ctrl-C to quit logging");
        }

        startLogStream(devId);
    }
});
