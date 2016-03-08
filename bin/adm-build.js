#!/usr/bin/env node

'use strict';

var path = require('path');
var yargs = require('yargs');
var logger = require('adm-logger');
var pkg = require('../package.json');

var argv = process.argv;
var $0 = process.env.CMD ? process.env.CMD : path.basename(argv[1]);
var app = $0.split(' ')[0];
logger.log = logger.createLog(app, {level: logger.log.level});

argv = argv.slice(2);

var build = require('..');
yargs(argv)
  .usage('Usage: ' + $0 + ' <target> [options]')
  .version(pkg.version)
  .alias('V', 'version')
  .help('h')
  .alias('h', 'help')
  .options(build.options || {});

var options = yargs.argv;

if (!options._.length) {
  return yargs.showHelp();
}

build(options);



