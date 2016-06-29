#! /usr/bin/env node

var program = require("commander");
var prompt = require("cli-prompt");
var Table = require("cli-table");
var fs = require("fs");

var ImpConfig = require("../lib/impConfig.js");
var config = new ImpConfig();
var modelID = null;

program
    .option("-a, --add <deviceID>", "Adds a device to the current model")
    .option("-r, --remove <deviceID>", "Removes a device from the current model")
    .option("-m, --model <modelID/modelName>", "List devices assigned to the specified model")
    .option("-c, --current", "Filters list to only display devices assigned to the current model")
    .option("--online", "Filters list to only display online devices")
    .option("--offline", "Filters list to only display offline devices")
    .option("--assigned", "Filters list to only display assigned devices")
    .option("--unassigned", "Filters list to only display unassigned devices")

program.parse(process.argv);

function checkModelName(next) {
    // User may have passed in a model ID or a model name - check which it is
    imp.getModel(program.model, function(err, data) {
        if (!err) {
            // The user DID supply a model ID and it matches an existing one
            modelID = program.model;
            next();
            return;
        } else {
            // An error means there was no match to a model ID,
            // so perhaps a name was supplied: compare it to the list of models
            imp.getModels({ "name": program.model }, function(err, data) {
                if (err) {
                    console.log("ERROR: '" + program.model + "' does not match any of your models");
                    return;
                }

                // See if the supplied model name matches an existing one
                var foundMatch = false;
                for (var i = 0 ; i < data.models.length ; i++) {
                    if (data.models[i].name.toLowerCase() == program.model.toLowerCase()) {
                        modelID = data.models[i].id;
                        foundMatch = true;
                        break;
                    }
                }

                if (foundMatch) {
                    // The user has supplied a name that already exists
                    next();
                } else {
                    // The user has supplied a name that doesn't exist
                    console.log("ERROR: '" + program.model + "' does not match any of your models");
                    return;
                }
            });
        }
    });
}

function listModelDevices() {
    imp.getDevices(null, function(err, data) {
        if (err) {
            console.log("ERROR: " + err.message_short);
            return;
        }

        var filteredDevices = [];
        var powerState = null;

        if ("online" in program) powerState = "online";
        if ("offline" in program) powerState = "offline";

        data.devices.forEach(function(device) {
            if (device.model_id == modelID) {
                if ((powerState && device.powerstate == powerState) || (powerState == null)) {
                    filteredDevices.push(device);
                }
            }
        });

        if (filteredDevices.length > 0) {
            // We have at least one device to list, so build the display table
            var table = new Table({
                head: ['Device ID', 'Device Name', 'State'],
                colWidths: [20, 30, 10]
            });

            filteredDevices.forEach(function(device) {
                table.push([
                    device.id,
                    (device.name || "Unnamed"),
                    (device.powerstate || "Unknown")
                ]);
            });

            console.log(table.toString());
        } else {
            // Report that there are no found devices
            if (data.devices.length == 0) {
                console.log("There are no devices assigned to model '" + program.model + "'");
                return;
            }

            var message = "There are no ";
            if (powerState) message = message + powerState + " ";
            message += "devices that are assigned to model '" + program.model + "'"
            console.log(message);
        }
    });
}

function listDevices() {
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
            // We have at least one device to list, so build the display table
            var table = new Table({
                head: ['Device ID', 'Device Name', 'Model ID', 'State']
                , colWidths: [20, 30, 14, 10]
            });

            filteredDevices.forEach(function(device) {
                // Skip devices with null ID (can't do anything with them anyway)
                if (!device.id) return;

                table.push([
                    device.id,
                    (device.name || "Unnamed"),
                    (device.model_id || "Unassigned"),
                    (device.powerstate || "Unknown")
                ]);
            })

            console.log(table.toString());
        } else {
            // Report that there are no found devices
            if (data.devices.length == 0) {
                console.log("There are no devices assigned to model '" + program.model + "'");
                return;
            }

            var message = "There are no ";

            if (assignedState != null) {
                message += (assignedState) ? "assigned devices" : "unassigned devices";
            } else {
                message += "devices";
            }

            if (powerState) message += " that are " + powerState;
            if ("current" in program) message += " for model '" + config.getLocal("modelName") + "'";
            console.log(message);
        }
    });
}

config.init(["apiKey"], function(err, success) {
    if (err) {
        console.log("ERROR: Global Build API key is not set - run 'imp setup' then try 'imp devices' again");
        return;
    }

    if ("add" in program && "remove" in program) {
        console.log("ERROR: You cannot specifiy -a and -d");
        return;
    }

    imp = config.createImpWithConfig();
    var modelName = config.getLocal("modelName");

    // Add a device to the current project's model
    if ("add" in program) {
        if (!config.getLocal("devices")) {
            console.log("ERROR: Devices list missing from local .impconfig");
            console.log("       Run 'imp pull -d' to update this project's list of devices");
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

            if (!found) {
                // Added device is not in the list of assigned devices so add it
                devices.push(program.add);
                config.saveLocalConfig(function(err) {
                    if (err) {
                        console.log("ERROR: " + err);
                        return;
                    }
                    console.log("The device '" + program.add + "' is now assigned to model '" + modelName + "'");
                });
            } else {
                console.log("The device '" + program.add + "' is already assigned to model '" + modelName + "'");
            }
        });
        return;
    }

    // Remove a device from the current project's model
    if ("remove" in program) {
        if (!config.get("devices")) {
            console.log("ERROR: Devices list missing from local .impconfig");
            console.log("       Run 'imp pull -d' to update this project's list of devices");
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
            console.log("The device '" + program.remove + "' is not assigned to this model");
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

                console.log("The device '" + program.remove + "' is no longer assigned to model '" + modelName + "'");
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

    if ("unassigned" in program && "model" in program) {
        console.log("ERROR: You cannot specify --model and --unassigned");
        return;
    }

    if ("unassigned" in program && "model" in program) {
        console.log("ERROR: You cannot specify --unassigned and --model");
        return;
    }

    if ("current" in program && !(config.getLocal("modelId"))) {
        console.log("ERROR: You cannot use --current outside of a project directory");
        return;
    }

    if ("model" in program && !("current" in program)) {
        checkModelName(function() {
            listModelDevices();
        });
        return;
    } else {
        listDevices();
    }
});
