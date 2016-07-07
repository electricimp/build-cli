#! /usr/bin/env node

// Get a list of models in the user's account

var program = require("commander");
var prompt = require("cli-prompt");
var Table = require("cli-table");
var colors = require("colors");
var ImpConfig = require("../lib/impConfig.js");
var Spinner = require("cli-spinner").Spinner;

var spinner = new Spinner("Contacting the impCloud... %s");
spinner.setSpinnerString(5);
var config = new ImpConfig();

program
    .option("-a, --active", "Lists only active models (those with assigned devices)")
    .option("-i, --inactive", "Lists only inactive models (those with no assigned devices)")
    .option("-d, --device <deviceID/deviceName>", "Lists the model to which the device is assigned (if any)")

program.parse(process.argv);

config.init(["apiKey"], function(err, success) {
    if (err) {
        console.log("ERROR: Global Build API key is not set. Run 'imp setup' then try 'imp models' again");
        return;
    }

    imp = config.createImpWithConfig();

    if ("active" in program && "inactive" in program) {
        console.log("ERROR: You cannot specify the options --active and --inactive");
        return;
    }

    if ("inactive" in program && "device" in program) {
        console.log("ERROR: You cannot specify the options --device and --inactive");
        return;
    }

    spinner.start();
    var activeState = null;
    if ("active" in program) activeState = true;
    if ("inactive" in program) activeState = false;
    if ("device" in program) activeState = null;

    imp.getModels(null, function(err, modelData) {
        if (err) {
            spinner.stop(true);
            console.log("ERROR: " + err.message_short);
            return;
        }

        imp.getDevices(null, function(err, deviceData) {
            if (err) {
                spinner.stop(true);
                console.log("ERROR: " + err.message_short);
                return;
            }

            var filteredModels = [];
            modelData.models.some(function(model) {
                if (activeState == null) {
                    // Not filtering models by state (active/inactive)
                    if ("device" in program) {
                        // We have a device specified - is it specified by an ID?
                        deviceData.devices.some(function(device) {
                            if (device.id == program.device) {
                                if (device.model_id == model.id) filteredModels.push(model);
                                return true;
                            }
                        });

                        // The passed device specifier didn't match any device ID,
                        // so perhaps was it a device name? Match on lower case
                        deviceData.devices.some(function(device) {
                            if (device.name.toLowerCase() == program.device.toLowerCase()) {
                                if (device.model_id == model.id) filteredModels.push(model);
                                return true;
                            }
                        });
                    } else {
                        // Listing all models so just push this model to the list
                        filteredModels.push(model);
                    }
                } else if (activeState) {
                    // Filtering by state == active, so check for device associations
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

                    // Model is not associated with any device (found == false)
                    // ie. it's inactive, so push it to the list
                    if (!found) filteredModels.push(model);
                }
            });

            if (filteredModels.length > 0) {
                // We have model(s) to display
                if ("device" in program) {
                    // A device can only have one model, so display that
                    spinner.stop(true);
                    console.log("Device '" + program.device + "' is assigned to model '" + filteredModels[0].name + "' (ID: " + filteredModels[0].id + ")");
                    return;
                }

                var header = ['Model Name', 'Model ID'];
                if ("inactive" in program) header[0] = "Inactive Model Name";
                if ("active" in program) header[0] = "Active Model Name";
                for (var index in header) {
                    // Set the header colour
                    header[index] = header[index].cyan;
                }

                var table = new Table({
                    head: header
                    , colWidths: [30, 20]
                });

                filteredModels.forEach(function(model) {
                    table.push([model.name, model.id]);
                })

                spinner.stop(true);
                console.log(table.toString());
            } else {
                // Report there are no found models
                var message = "There are no models ";

                if (activeState != null)  {
                    message += (activeState) ? "that are active " : "that are inactive ";
                    if (program.device) message += "and ";
                }

                if (program.device) message += "assigned to device '" + program.device + "'";
                spinner.stop(true);
                console.log(message);
            }
        });
    });
});
