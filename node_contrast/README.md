# Node.js Contrast Agent
[![codecov](https://codecov.io/gh/Contrast-Security-Inc/node-agent/branch/develop/graph/badge.svg?token=iHNKZlqEdP)](https://codecov.io/gh/Contrast-Security-Inc/node-agent)
[![Build Status](https://github.com/Contrast-Security-Inc/node-agent/workflows/test/badge.svg)](https://github.com/Contrast-Security-Inc/node-agent/actions)

## Installation

First make sure you have installed the latest version of [node.js](http://nodejs.org/)
(You may need to restart your computer after this step).

From NPM for use as a command line app:

    npm install node_contrast -g

From NPM for programmatic use:

    npm install node_contrast


## Usage
```
    Usage: node-contrast run <app.js> [arguments]

    Commands:

        run <script.js> [options]  run the application with the Contrast Agent.
        instrument <script.js>     instrument the script and show the transformed source.
        libraries <script.js>      show the library information for the given script.
        setup [options]            run setup commands for all envs

    Options:

        -h, --help           output usage information
        -V, --version        output the version number
        -c, --config <path>  set
```

## Creating and deploy new release
See the Wiki's [Release Runbook](https://github.com/Contrast-Security-Inc/node-agent/wiki/Release-Runbook)

## Development Setup

```
git clone git@github.com:Contrast-Security-Inc/node-agent.git
npm ci
```

Make sure your editor is configured to read from the ```.editorconfig``` and ```.eslintrc.json``` files.

## Submodules
This repo makes use of git submodules for testing protect.  To initialize the submodule run this command
after cloning repo

```
git submodule update --init
```

We will currently have to keep this submodule up to date. To do so

```
cd test/resources/contrast-protect-rules
git checkout master
git pull
cd ../../../
git add test/resources/contrast-protect-rules
git commit -m 'bumping contrast-protect-rules commit hash'
git push origin <ticket>
```

## Testing

```
npm test
```

## Internal Docs
[jsdoc](http://usejsdoc.org/) is used to create internal documentation.
To build documentation, run ```npm run docs```

## Docker
To build the image run `./docker-image-builder.sh` from the project root.
You can optionally include a node version like so:
```
./docker-image-builder.sh 12
```
By default, the build script uses node 12

The script will tag the image with the following:
```
contrast/node-agent:latest
contrast/node-agent:<current git branch>
contrast/node-agent:<latest git commit hash>

Example:
contrast/node-agent:latest
contrast/node-agent:develop
contrast/node-agent:735e5187b093d6bb4ba575f413149c913ec8ff84
```
