#!/usr/bin/env node

'use strict';

var path = require('path');
var yargs = require('yargs');
var logger = require('adm-logger');
var pkg = require('../package.json');

var argv = process.argv;
var $0 = process.env.CMD ? process.env.CMD : path.basename(argv[1]);

logger.log = logger.createLog($0, {level: logger.log.level});

yargs
  .usage('Usage: ' + $0 + ' <target> [options]')
  .version(pkg.version)
  .alias('V', 'version')
  .help('h')
  .alias('h', 'help')
  .options({
    'a': {
      alias: 'arch',
      choices: ['all', 'armhf', 'amd64', 'none'],
      default: 'armhf',
      describe: 'Set target arch'
    },
    'f': {
      alias: 'format',
      choices: ['all', 'deb', 'snappy', 'none'],
      default: 'deb',
      describe: 'Specify the package format'
    },
    't': {
      alias: 'type',
      choices: ['auto', 'driver', 'app', 'core'],
      default: 'auto',
      describe: 'Specify the package type for dobox'
    },
    'r': {
      alias: 'root',
      type: 'string',
      default: '/opt/dolink',
      describe: 'Set the installation root path'
    }
  });

var options = yargs.argv;

if (!options._.length) {
  return yargs.showHelp();
}

require('..')(options);



