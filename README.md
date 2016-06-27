# build-cli 0.3.0

*build-cli* allows you to manage your Electric Imp development from a command line through Electric Imp’s [Build API](https://electricimp.com/docs/buildapi).

# Installation

```
npm install -g build-cli
```

# Usage

After installation, the `imp` program will be available from your command prompt. From there you should be able to use all of the tools (which are self documented as shown below).

```
imp [command] [options]

Commands:

    devices     List and manage devices
    log         Display logs from the specified device
    migrate     Migrates a model from one account to another
    models      List and manage models
    new         Create an new, empty imp project, or reinitialize an existing one
    pull        Fetch latest build from the server
    push        Update the build, and push code to developer devices
    setup       Sets your global Build API key
    help        Display help for [cmd]

Options:

    -h, help     output usage information
    -V, version  output the version number
```

# Introduction

In your home directory, run `imp setup` to set up your development environment. You will need a Build API key, which you can obtain by logging in to the [Electric Imp IDE](https://ide-electricimp.com/ide/) with your account credentials, and selecting ‘Build API Keys’ from the ‘username‘ menu on the top far right of the workspace.

Now you can create individual directories for each of your imp-based projects. To prepare a directory for use, change to the relevant directory and run `imp new`. You’ll be asked for a Build API key &mdash; just hit Enter to use the default value, the one you entered during the setup phase &mdash; and then for the name of the project. This can match an existing imp application (‘model’) or be entirely new if you want to create a project from scratch. You will also be asked to provide filenames &mdash; just hit Enter to use the default values &mdash; for your agent and device code files. These will be populated with the latest build from the Electric Imp impCloud&trade; if your project is derived from an existing model.

# Release History

### 0.3.0

- *init* command renamed *new*
- *login* command renamed *setup*
- Improved feedback messaging
- *log* now has `-t`, `--title` option to log devices by name rather than device ID (`-d`, `--device`)
- Support for *build-api* 0.3.0

### 0.2.8

- Initial release of Electric Imp fork of *imp-cli*, *build-cli*.

# License

*build-cli* is licensed under the [MIT License](./LICENSE).

*build-cli* is based on [*imp-cli*](https://github.com/cat-haines/imp-cli) and [*imp-api*](https://github.com/cat-haines/imp-api) by Cat Haines. *imp-cli* and *imp-api* are copyright &copy; Cat Haines, 2015. *build-cli* is copyright &copy; cat Haines, 2015 and copyright &copy; Electrc Imp Inc., 2015-16.
