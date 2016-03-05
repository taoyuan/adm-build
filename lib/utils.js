'use strict';

var sh = require('shelljs');
var chalk = require('chalk');

exports.infoprop = function (name, value) {
  console.log(chalk.blue(name), value);
};

exports.isInstalled = function isInstalled(cmd) {
  return !!sh.which(cmd);
};

exports.quote = function (text) {
  return '"' + text + '"';
};
