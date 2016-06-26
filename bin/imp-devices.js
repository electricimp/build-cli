#! /usr/bin/env node

var program = require("commander");
var prompt = require("cli-prompt");
var Table = require("cli-table");
var fs = require("fs");

var ImpConfig = require("../lib/impConfig.js");
var config = new ImpConfig();

program
    .option("-a, --add <deviceID>", "Adds a device to the current model")
    .option("-r, --remove <deviceID>", "Removes a device from the current model")
    .option("-c, --current", "Filters list to only display devices assigned to the current model")
    .option("--online", "Filters list to only display online devices")
    .option("--offline", "Filters list to only display offline devices")
    .option("--assigned", "Filters list to only display assigned devices")
    .option("--unassigned", "Filters list to only display unassigned devices")

program.parse(process.argv);

config.init(["apiKey"], function(err, success) {
    if (err) {
        console.log("ERROR: Could not find a Build API key. Run 'imp setup' to set your global Build API key");
        return;
    }

    if ("add" in program && "remove" in program) {
        console.log("ERROR: You cannot specifiy -a and -d");
        return;
    }

    imp = config.createImpWithConfig();

    // Add
    if ("add" in program) {
        if (!config.getLocal("devices")) {
            console.log("ERROR: 'devices' key missing from .impconfig");
            return;
        }

        if (typeof program.add != "string") {
            console.log("ERROR: Invalid or missing device ID. Use 'imp devices -a <deviceID>'")
            return;
        }

        imp.assignDevice(program.add, config.get("modelId"), function(err, data) {
            if (err) {
                console.log("ERROR: " + err.message_short);
                return;
            }

            // Check if the added device is in config.devices already
            var found = false;
            var devices = config.get("devices");
            for (var i = 0 ; i < devices.length ; i++) {
                if (devices[i] == program.add) found = true;
            }

            var modelName = config.getLocal("modelName");
            if (!found) {
                devices.push(program.add);
                config.saveLocalConfig(function(err) {
                    if (err) {
                        console.log("ERROR: " + err);
                        return;
                    }
                    console.log("The device is now assigned to this model (" + modelName + ")");
                });
            } else {
                console.log("The device is already assigned to this model (" + modelName + ")");
            }
        });
        return;
    }

    // Remove
    if ("remove" in program) {
        if (!config.get("devices")) {
            console.log("ERROR: 'devices' key missing from .impconfig");
            return;
        }

        if (typeof program.remove != "string") {
            console.log("ERROR: Invalid or missing device ID. Use 'imp devices -r <deviceID>'")
            return;
        }

        // Check that the device we're removing is in config.devices
        var index = null;
        var devices = config.get("devices");
        for (var i = 0 ; i < devices.length ; i++) {
            if (devices[i] == program.remove) {
                index = i;
                break;
            }
        }

        if (index == null) {
            console.log("WARNING: " + program.remove + " is not assigned to this model");
            return;
        }

        imp.assignDevice(program.remove, null, function(err,data) {
            if (err) {
                console.log("ERROR: " + err.message_short);
                return;
            }

            devices.splice(index, 1);
            config.saveLocalConfig(function(err) {
                if (err) {
                    console.log("ERROR: " + err);
                    return;
                }

                var modelName = config.getLocal("modelName");
                console.log("The device is no longer assigned to this model (" + modelName + ")");
            });
        });

        return;
    }

    // List devices
    if ("unassigned" in program && "assigned" in program) {
        console.log("ERROR: You cannot specify --assigned and --unassigned");
        return;
    }

    if ("online" in program && "offline" in program) {
        console.log("ERROR: You cannot specify --offline and --online");
        return;
    }

    if ("unassigned" in program && "current" in program) {
        console.log("ERROR: You cannot specify --current and --unassigned");
        return;
    }

    imp.getDevices(null, function(err, data) {
        if (err) {
            console.log("ERROR: " + err.message_short);
            return;
        }

        var filteredDevices = [];
        var powerState = null;
        var assignedState = null;

        if ("online" in program) powerState = "online";
        if ("offline" in program) powerState = "offline";
        if ("assigned" in program || "current" in program) assignedState = true;
        if ("unassigned" in program) assignedState = false;

        data.devices.forEach(function(device) {
            if ((powerState == null || device.powerstate == powerState) && (assignedState == null || (device.model_id != null) == assignedState)) {
                if ("current" in program) {
                    if (device.model_id == config.getLocal("modelId")) {
                        filteredDevices.push(device);
                    }
                } else {
                    filteredDevices.push(device);
                }
            }
        });

        if (filteredDevices.length > 0) {
            // Build the devices list as a table
            var table = new Table({
                head: ['Device ID', 'Device Name', 'Model ID', 'State']
                , colWidths: [20, 30, 14, 10]
            });

            filteredDevices.forEach(function(device){
                // Skip devices with null ID (can't do anything with them anyway)
                if (!device.id) return;

                table.push([
                    device.id,
                    (device.name || device.id),
                    (device.model_id || "Unassigned"),
                    (device.powerstate || "Unknown")
                ]);
            })

            console.log(table.toString());
        } else {
            // Report there are no found devices
            var message = "There are no ";
            (assignedState) ? message += "assigned devices" : "unassigned devices";
            if (powerState) message += " that are " + powerState;
            if ("current" in program) message += " for model '" + config.getLocal("modelName") + "'";
            console.log(message);
        }
    });
});
