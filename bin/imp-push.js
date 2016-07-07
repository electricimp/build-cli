#! /usr/bin/env node

var program = require("commander");
var colors = require("colors");
var fs = require("fs");
var Spinner = require("cli-spinner").Spinner;
var ImpConfig = require("../lib/impConfig.js");

var config = new ImpConfig();
var spinner = new Spinner("Contacting the impCloud... %s");
spinner.setSpinnerString(5);

program.parse(process.argv);

config.init(["apiKey", "modelId", "agentFile", "deviceFile",], function(err, success) {
    var model = {
        device_code: null,
        agent_code: null
    };

    // Make sure the code files exist
    if (!fs.existsSync(config.get("agentFile"))) {
        console.log("ERROR: Could not find agent code file: " + config.get("deviceFile"));
        return;
    }

    if (!fs.existsSync(config.get("deviceFile"))) {
        console.log("ERROR: Could not find device code file: " + config.get("deviceFile"));
        return;
    }

    model.agent_code = fs.readFileSync(config.get("agentFile"), "utf8");
    model.device_code = fs.readFileSync(config.get("deviceFile"), "utf8");

    imp = config.createImpWithConfig();
    if (!spinner.isSpinning()) spinner.start();
    imp.createModelRevision(config.get("modelId"), model, function(err, data) {
        if (err) {
            spinner.stop(true);
            if (err.code != "CompileFailed") {
                console.log(colors.red("ERROR: " + err.message_short));
                return;
            }

            if (err.details.agent_errors) {
                // List out agent code compilation errors (returned by server)
                for (var i = 0 ; i < err.details.agent_errors.length ; i++) {
                    var thisErr = err.details.agent_errors[i];
                    console.log(colors.red("ERROR: " + thisErr.error));
                    console.log("   at: " + config.get("agentFile") + ":" + thisErr.row + " (col " + thisErr.column + ")");
                }
            }

            if (err.details.device_errors) {
                // List out device code compilation errors (returned by server)
                for (var i = 0 ; i < err.details.device_errors.length ; i++) {
                    var thisErr = err.details.device_errors[i];
                    console.log(colors.red("ERROR: " + thisErr.error));
                    console.log("   at: " + config.get("deviceFile") + ":" + thisErr.row + " (col " + thisErr.column + ")");
                }
            }

            return;
        }

        // Now we have uploaded code, restart the model
        imp.restartModel(config.get("modelId"), function(err, restartData) {
            spinner.stop(true);
            console.log("Uploaded the latest '" + config.getLocal("modelName") + "' code as build " + data.revision.version);
            if (err) {
                console.log("WARNING: Could not restart the devices assigned to model '" + config.getLocal("modelName") + "'");
            } else {
                console.log("Restarted the devices assigned to model '" + config.getLocal("modelName") + "' with the new code");
            }
        });
    });
});
