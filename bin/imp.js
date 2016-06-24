#! /usr/bin/env node

var program = require("commander");
var pkg = require("../package.json");

program
  .version(pkg.version)

  .command("devices [options]", "List and manage devices")
  .command("new", "Create a new imp project, or reinitialize an existing one")
  .command("log [options]", "Display logs from a specified device")
  .command("setup [options]", "Sets your global Build API Key")
  .command("migrate [options]", "Migrates a model from one account to another")
  .command("models [options]", "List and manage models")
  .command("pull [options]", "Fetch latest build from the server")
  .command("push [options]", "Update the build, and push code to developer devices")

program.parse(process.argv);
