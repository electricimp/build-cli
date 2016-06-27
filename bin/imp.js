#! /usr/bin/env node

var program = require("commander");
var pkg = require("../package.json");

program
    .version(pkg.version)

    .command("setup [options]", "Sets your global Build API Key")
    .command("new", "Create a new imp project, or reinitialize an existing one")
    .command("init", "Create a new imp project, or reinitialize an existing one")
    .command("devices [options]", "List and manage devices")
    .command("models [options]", "List and manage models")
    .command("log [options]", "Display logs from a specified device")
    .command("pull [options]", "Fetch latest build from the server")
    .command("push [options]", "Update the build, and push code to developer devices")
    .command("migrate [options]", "Migrates a model from one account to another")

program.parse(process.argv);
