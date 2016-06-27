#! /usr/bin/env node

// Set up your system to use build-cli
// Requires a Build API key (see https://electricimp.com/docs/resources/ideuserguide/#2-2)
// Creates .impconfig for global settings in your home directory

var program = require("commander");
var prompt = require("cli-prompt");

var ImpConfig = require("../lib/impConfig.js");
var config = new ImpConfig();

var imp;

program
  .option("-u, --url [baseUrl]", "Overrides base URL for the API (eg. -u build.myprivatecloud.com)")

program.parse(process.argv);

function apiKeyPrompt(apiKey) {
    var promptText = "Build API Key";
    if (apiKey) {
        promptText += " (" + apiKey + "): ";
    } else {
        promptText += ": ";
    }

    prompt(promptText, function(val) {
        if (apiKey && !val) val = apiKey;

        var url = "build.electricimp.com";
        if ("url" in program) url = program.url;

        config.setGlobal("apiKey", val);
        config.setGlobal("apiBase", url);
        imp = config.createImpWithConfig();

        // For Setup, is { "device_id": "garbage" } the intended set of options, or is this left over from testing?
        imp.getDevices({ "device_id" : "garbage" }, function(err, data) {
            if (err) {
                // Clear API key and try again
                imp.apiKey = null;
                console.log("ERROR: Invalid API Key");
                apiKeyPrompt(apiKey);
                return;
            }

            config.saveGlobalConfig(function(err) {
                if (err) {
                    console.log("ERROR: " + err);
                    return;
                }

                console.log("Wrote global configuration to ~/.impconfig");
                console.log("To create a new project, create a directory for the project,");
            });
        });
    });
}

config.init(null, function(err, success) {
    apiKeyPrompt(config.getGlobal("apiKey"));
});
