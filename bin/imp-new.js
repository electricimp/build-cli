#! /usr/bin/env node

// Create a new, empty imp project, or reinitialize and existing one

var program = require("commander");
var prompt = require("cli-prompt");
var fs = require("fs");

var ImpConfig = require("../lib/impConfig.js");
var config = new ImpConfig();

var imp;

program
    .option("-f, --force", "Overwrites existing .impconfig file")
    .option("-g, --global", "Uses your global API key and prevents a local API key from being written to .impconfig")
    .option("-k, --keep [options]", "Prevents code files from being overwritten during initialization")
    .option("-t, --title <projectName>", "Create a new project and model with the supplied name")

    .on("--help", function() {
        console.log("  Usage:");
        console.log("");
        console.log("    imp new -k\t\tAgent and device code files will not be overwritten");
        console.log("    imp new -k device\tDevice code file will not be overwritten");
        console.log("    imp new -k agent\tAgent code file will not be overwritten");
    });

program.parse(process.argv);

function apiKeyPrompt(apiKey, next) {
    if ("global" in program) {
        // If 'apiKey' isn't set in the global config, log error and return
        if (!config.getGlobal("apiKey")) {
            console.log("ERROR: Global Build API key is not set. Run 'imp setup' then try 'imp new' again");
            return;
        }

        imp = config.createImpWithConfig();
        // Use a false value to test the API key
        imp.getDevices({ "device_id" : "garbage" }, function(err, data) {
            if (err) {
                // API key is wrong, so ask again
                imp.apiKey = null;
                console.log("ERROR: Invalid Build API key");
                apiKeyPrompt(apiKey, next);
                return;
            }

            next();
        });

        return;
    }

    // Display/request local Build API key
    var promptText = "Build API key";
    if (apiKey) {
        promptText += " (" + apiKey + "): ";
    } else {
        promptText += ": ";
    }

    prompt(promptText, function(val) {
        if (apiKey && !val) val = apiKey;
        config.setLocal("apiKey", val);
        imp = config.createImpWithConfig();

        // Use a false value to test the API key
        imp.getDevices({ "device_id" : "garbage" }, function(err, data) {
            if (err) {
                // API key is wrong, so ask again
                imp.apiKey = null;
                console.log("ERROR: Invalid Build API key");
                apiKeyPrompt(apiKey, next);
                return;
            }

            next();
        });
    });
}

function modelPrompt(next) {
    prompt("Model ID or name: ", function(val) {
        if (!val) {
            modelPrompt(next);
            return;
        }

        // Assume the user has passed in an ID - check if it exists
        imp.getModel(val, function(err, data) {
            if (!err) {
                // The user DID supply a model ID and it matches an existing one
                prompt("There is an existing model, '" + data.model.name + "', with the ID you supplied. Use this? (y/n) ", function(confirm) {
                    if (confirm && confirm.toLowerCase()[0] != "y") {
                        // User doesn't want to use the existing model,
                        // so force them to choose a new name
                        modelPrompt(next);
                        return;
                    }

                    config.setLocal("modelId", data.model.id);
                    config.setLocal("modelName", data.model.name);
                    next();
                    return;
                });
            } else {
                // An error means there was no match to a model ID,
                // so perhaps a name was supplied: compare it to the list of models
                imp.getModels({ "name": val }, function(err, data) {
                    if (err) {
                        console.log("ERROR: Could not get a list of your models from the impCloud");
                        return;
                    }

                    // See if the supplied model name matches an existing one
                    var foundMatch = false;
                    for (var i = 0 ; i < data.models.length ; i++) {
                        if (data.models[i].name.toLowerCase() == val.toLowerCase()) {
                            foundMatch = true;
                            break;
                        }
                    }

                    if (foundMatch) {
                        // The user has supplied a name that already exists
                        prompt("There is an existing model, '" + data.models[i].name + "', with the ID you supplied. Use this? (y/n) ", function(confirm){
                            if (confirm && confirm.toLowerCase()[0] != "y") {
                                // User doesn't want to use the existing model,
                                // so force them to choose a new name
                                modelPrompt(next);
                                return;
                            }

                            config.setLocal("modelId", data.models[i].id);
                            config.setLocal("modelName", data.models[i].name);
                            next();
                            return;
                        });
                    } else {
                        // The user has supplied a name that doesn't exist, so
                        // create a new model with that name
                        prompt("Create model '" + val + "'? (y/n) ", function(confirm) {
                            if (confirm && confirm.toLowerCase()[0] != "y") {
                                modelPrompt(next);
                                return;
                            }

                            imp.createModel(val, function(err, data) {
                                if (err) {
                                    console.log("ERROR: Could not create model '" + data.model.name + "'");
                                    return;
                                }

                                config.setLocal("modelName", data.model.name);
                                config.setLocal("modelId", data.model.id);
                                next();
                            });

                            return;
                        });
                    }
                });
            }
        });
    });
}

function newModelPrompt(next) {
    // We have a model name, parsed as 'program.title'
    imp.getModels({ "name": program.title }, function(err, data) {
        if (err) {
            console.log("ERROR: Could not get a list of your models from the impCloud");
            return;
        }

        // See if the supplied model name matches an existing one
        var foundMatch = false;
        for (var i = 0 ; i < data.models.length ; i++) {
            if (data.models[i].name.toLowerCase() == program.title.toLowerCase()) {
                foundMatch = true;
                break;
            }
        }

        if (foundMatch) {
            // The user has supplied a name that already exists
            prompt("You already have a model with the name '" + data.models[i].name + "'. Use this? (y/n) ", function(confirm) {
                if (confirm && confirm.toLowerCase()[0] != "y") {
                    // User doesn't want to use the existing model, so get a new name
                    modelPrompt(next);
                    return;
                }

                config.setLocal("modelId", data.models[i].id);
                config.setLocal("modelName", data.models[i].name);
                next();
                return;
            });
        } else {
            // The user has supplied a name that doesn't exist, so
            // create a new model with that name
            imp.createModel(program.title, function(err, data) {
                if (err) {
                    console.log("ERROR: Could not create model '" + program.title + "'");
                    return;
                }

                config.setLocal("modelName", data.model.name);
                config.setLocal("modelId", data.model.id);
                next();
            });

            return;
        }
    });
}

function getDevices(next) {
    var modelId = config.getLocal("modelId");
    var modelName = config.getLocal("modelName");
    if (modelId == null) {
        next();
        return;
    }

    imp.getDevices({ "model_id": modelId }, function(err, data) {
        if (err) {
            console.log("ERROR: Could not fetch a list of devices assigned to model '" + modelName + "'");
            next();
        }

        var devices = [];
        for (var i = 0 ; i < data.devices.length ; i++) {
            if (data.devices[i].model_id == modelId) {
                devices.push(data.devices[i].id);
            }
        }

        // Save current list of model's devices locally
        config.setLocal("devices", devices);

        // Display number of devices (if any) associated with this model
        var devicesText = devices.length == 1 ? "device" : "devices";
        var devicesLen = devices.length == 0 ? "no" : devices.length;
        console.log("Found " + devicesLen + " " + devicesText + " associated with model '" + modelName + "'");
        next();
    });
}

function fileNamePrompt(next) {
    var modelName = config.getLocal("modelName");
    var baseFileName = modelName.split(" ").join("_").toLowerCase();
    var defaultDeviceFileName = config.getLocal("deviceFile") || (baseFileName + ".device.nut");
    var defaultAgentFileName = config.getLocal("agentFile") || (baseFileName + ".agent.nut");

    prompt.multi([
        {
            label: "Device code file (" + defaultDeviceFileName + ")",
            key: "deviceFile"
        },
        {
            label: "Agent code file (" + defaultAgentFileName + ")",
            key: "agentFile"
        }
    ], function(data){
        config.setLocal("deviceFile", data.deviceFile || defaultDeviceFileName);
        config.setLocal("agentFile", data.agentFile || defaultAgentFileName);
        next();
    });
}

function makeFiles() {
    var deviceCode = "# Device Code";
    var agentCode = "# Agent Code";
    var modelId = config.getLocal("modelId");
    var modelName = config.getLocal("modelName");
    var agentFile = config.getLocal("agentFile");
    var deviceFile = config.getLocal("deviceFile");

    if (modelId != null) {
        if ("keep" in program && keep === true) {
            // Don't overwrite any saved code UNLESS files don't exist
            if (!fs.existsSync(agentFile)) fs.writeFile(agentFile, agentCode);
            if (!fs.existsSync(deviceFile)) fs.writeFile(deviceFile, deviceCode);
        } else if ("keep" in program && program.keep == "device") {
            // Only overwrite the agent code
            fs.writeFile(agentFile, agentCode);
        } else if ("keep" in program && program.keep == "agent") {
            // Only overwrite the device code
            fs.writeFile(deviceFile, deviceCode);
        } else {
            // Overwrite both agent code and device code
            fs.writeFile(deviceFile, deviceCode);
            fs.writeFile(agentFile, agentCode);
        }

        config.saveLocalConfig(function(err) {
            if (err) {
                console.log("ERROR: " + err);
                return;
            }

            console.log("Model '" + modelName + "' initialized. To add a device run: 'imp devices -a <deviceID>'");
        });
    } else {
        console.log("ERROR: Could not create model's code files");
    }
}

function finalize() {
    var deviceCode = "";
    var agentCode = "";
    var modelId = config.getLocal("modelId");
    var modelName = config.getLocal("modelName");
    var agentFile = config.getLocal("agentFile");
    var deviceFile = config.getLocal("deviceFile");

    if (modelId != null) {
        imp.getModelRevisions(modelId, null, function(err, data) {
            if (err) {
                console.log("ERROR: Could not fetch code revisions for model '" + modelName + "'");
                return;
            }

            if (data.revisions.length == 0) {
                config.saveLocalConfig(function(err) {
                    if (err) {
                        console.log("ERROR: " + err);
                        return;
                    }

                    console.log("Model '" + modelName + "' initialized. To add a device run: 'imp devices -a <deviceID>'");
                });

                return;
            }

            imp.getModelRevision(modelId, data.revisions[0].version, function(err, data) {
                if (err) {
                    console.log("ERROR: Could not fetch the latest build for model '" + modelName + "'");
                    return;
                }

                deviceCode = data.revision.device_code;
                agentCode = data.revision.agent_code;

                if ("keep" in program && keep === true) {
                    // Don't overwrite any saved code
                } else if ("keep" in program && program.keep == "device") {
                    // Only overwrite the agent code
                    fs.writeFile(agentFile, agentCode);
                } else if ("keep" in program && program.keep == "agent") {
                    // Only overwrite the device code
                    fs.writeFile(deviceFile, deviceCode);
                } else {
                    // Overwrite both agent code and device code
                    fs.writeFile(deviceFile, deviceCode);
                    fs.writeFile(agentFile, agentCode);
                }

                config.saveLocalConfig(function(err) {
                    if (err) {
                        console.log("ERROR: " + err);
                        return;
                    }

                    console.log("Model '" + modelName + "' initialized. To add a device run: 'imp devices -a <deviceID>'");
                });
            });
        });
    } else {
        imp.createModel(modelName, function(err, data) {
            if (err) {
                console.log("ERROR: Could not create model");
                return;
            }

            config.setLocal("modelId", data.model.id);

            fs.writeFile(deviceFile, deviceCode);
            fs.writeFile(agentFile, agentCode);

            config.saveLocalConfig(function(err) {
                if (err) {
                    console.log("ERROR: " + err);
                    return;
                }

                console.log("Model '" + modelName + "' initialized. To add a device run: 'imp devices -a <deviceId>'");
            });
        });
    }
}

config.init(null, function() {
    // Make sure this folder doesn't already have a config file
    if (this.getLocalConfig() && !("force" in program)) {
        console.log("ERROR: .impconfig already exists. Specify '-f' to re-initialize model");
        return;
    }

    if ("title" in program) {
        // User has supplied a specific model name, so use this rather
        // than ask for one
        apiKeyPrompt(this.get("apiKey"), function() {
            newModelPrompt(function() {
                fileNamePrompt(function() {
                    makeFiles();
                });
            });
        });
    } else {
        apiKeyPrompt(this.get("apiKey"), function() {
            modelPrompt(function() {
                getDevices(function() {
                    fileNamePrompt(function() {
                        finalize();
                    });
                });
            });
        });
    }
}.bind(config));
