#! /usr/bin/env node

// Pulls latest version of a model down from server

var program = require("commander");
var fs = require("fs");
var Spinner = require("cli-spinner").Spinner;
var ImpConfig = require("../lib/impConfig.js");

var config = new ImpConfig();
var spinner = new Spinner("Contacting the impCloud... %s");
spinner.setSpinnerString(5);

var imp;

program
    .option("-r, --revision <revision>", "Pulls the specified revision (build)")
    .option("-d, --devices", "Pulls and syncs the model's list of assigned devices")

program.parse(process.argv);

function getVersion(ver, cb) {
    imp.getModelRevision(config.get("modelId"), ver, cb);
}

function done(err, data) {
    spinner.stop(true);
    if (err) {
        console.log("ERROR: " + err.message_short);
        return;
    } else {
        if ("revision" in data) {
            fs.writeFile(config.get("deviceFile"), data.revision.device_code);
            fs.writeFile(config.get("agentFile"), data.revision.agent_code);
            console.log("Updated local code to build " + data.revision.version);
        }
    }
}

config.init(["apiKey", "modelId", "devices", "agentFile", "deviceFile"], function(err, success) {
    if (err) {
        console.log("ERROR: " + err);
        return;
    }

    imp = config.createImpWithConfig();
    spinner.start();
    if ("devices" in program) {
        imp.getDevices({ "model_id": config.get("modelId") }, function(err, data) {
            if (err) {
                spinner.stop(true);
                console.log("ERROR: " + err);
                return;
            } else {
                var devices = [];
                data.devices.forEach(function(device) {
                    devices.push(device.id);
                });

                config.setLocal("devices", devices);
                config.saveLocalConfig(function(err, success) {
                    spinner.stop(true);
                    if (err) {
                        console.log("ERROR: " + err);
                        return;
                    }

                    var modelName = config.getLocal("modelName");
                    console.log("Updated the list of devices associated with model '" + modelName + "'");
                });
            }
        });
    } else {
        if ("revision" in program) {
            getVersion(program.revision, done);
        } else {
            imp.getModelRevisions(config.get("modelId"), null, function(err, data) {
                if (err) {
                    spinner.stop(true);
                    console.log("ERROR: " + err);
                    return;
                }

                if ("revisions" in data && data.revisions.length > 0) {
                    getVersion(data.revisions[0].version, done);
                }
            });
        }
    }
});
