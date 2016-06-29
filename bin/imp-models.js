#! /usr/bin/env node

// Get a list of models in the user's account

var program = require("commander");
var prompt = require("cli-prompt");
var Table = require("cli-table");
var fs = require("fs");

var ImpConfig = require("../lib/impConfig.js");
var config = new ImpConfig();

program
    .option("--active", "Filters list to only display active models")
    .option("--inactive", "Filters list to only display inactive models")
    .option("-d, --device <deviceID/deviceName>", "Lists the model to which the device is assigned (if any)")

program.parse(process.argv);

config.init(["apiKey"], function(err, success) {
    if (err) {
        console.log("ERROR: Global Build API key is not set - run 'imp setup' then try 'imp models' again");
        return;
    }

    imp = config.createImpWithConfig();

    if ("active" in program && "inactive" in program) {
        console.log("ERROR: You cannot specify --active and --inactive");
        return;
    }

    if ("inactive" in program && "device" in program) {
        console.log("ERROR: You cannot specify --device and --inactive");
        return;
    }

    var activeState = null;
    if ("active" in program) activeState = true;
    if ("inactive" in program) activeState = false;
    if ("device" in program) activeState = null;

    imp.getModels(null, function(err, modelData) {
        if (err) {
            console.log("ERROR: " + err.message_short);
            return;
        }

        imp.getDevices(null, function(err, deviceData) {
            if (err) {
                console.log("ERROR: " + err.message_short);
                return;
            }

            var filteredModels = [];
            modelData.models.some(function(model) {
                if (activeState == null) {
                    // Not filtering by state, so just push it to the list
                    if ("device" in program) {
                        // We have a device specified is it an ID?
                        deviceData.devices.some(function(device) {
                            if (device.id == program.device) {
                                if (device.model_id == model.id) filteredModels.push(model);
                                return true;
                            }
                        });

                        // An ID has been passed, but it didn't match,
                        // so was it a device name? Match on lower case
                        deviceData.devices.some(function(device) {
                            if (device.name.toLowerCase() == program.device.toLowerCase()) {
                                if (device.model_id == model.id) filteredModels.push(model);
                                return true;
                            }
                        });
                    } else {
                        filteredModels.push(model);
                    }
                } else if (activeState) {
                    // Filtering by state == active, so check for
                    // device associations
                    deviceData.devices.some(function(device) {
                        if (device.model_id == model.id) {
                            // At least one device is listing this as its model,
                            // so this model is active - push it to the list
                            filteredModels.push(model);
                            return true;
                        }
                    });
                } else {
                    // Filtering by state == inactive
                    var found = false;
                    deviceData.devices.some(function(device) {
                        if (device.model_id == model.id) {
                            found = true;
                            return true;
                        }
                    });

                    // Model is not associated with any device, ie. it's inactive
                    // so push it to the list
                    if (!found) filteredModels.push(model);
                }
            });

            if (filteredModels.length > 0) {
                if ("device" in program) {
                    // A device can only have one model, so list that
                    console.log("Device '" + program.device + "' is assigned to model '" + filteredModels[0].name + "' (ID: " + filteredModels[0].id + ")");
                    return;
                }

                // We have models to list, so create the list as a table
                var table = new Table({
                    head: ['Model ID', 'Model Name']
                    , colWidths: [20, 30]
                });

                filteredModels.forEach(function(model) {
                    table.push([model.id, model.name]);
                })

                console.log(table.toString());
            } else {
                // Report there are no found models
                console.log("No models meet your search criteria");
            }
        });
    });
});
