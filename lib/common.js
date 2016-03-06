'use strict';

var path = require('path');
var fs = require('fs-extra');
var ignore = require('ignore');
var P = require('bluebird');
var ncp = require('ncp');

var docker = require('./docker');

function createIgnore(ignores) {
  var ig = ignore();

  if (ignores) {
    ig.addPattern(ignores);
  }
  
  ig.addIgnoreFile(ignore.select([path.resolve(__dirname, 'ignore')]));

  return ig;
}

exports.copy = copy;
function copy(source, target, options) {
  options = options || {};

  var ig = createIgnore(options.ignores || options.ignore);

  return new Promise(function (resolve, reject) {
    ncp(source, target, {filter: ig.createFilter()}, function (err) {
      if (err) return reject(err);
      return resolve();
    });
  });
}

exports.build = build;
function build(options, arch, cmd) {
  var hostBuildPath = path.join(options.hostBuildRoot, arch);
  var contBuildPath = path.join(options.contBuildRoot, arch);
  return P.resolve()

    .then(function () {
      if (fs.existsSync(hostBuildPath)) {
        fs.removeSync(hostBuildPath);
      }
      fs.ensureDirSync(hostBuildPath);
      // copy staging files to host building path
      return copy(options.staging, hostBuildPath);
    })
    .then(function () {
      cmd = [
        '/bin/bash', '-c', '\'',
        'BUILD_DIR="' + contBuildPath + '";',
        'TOOLS_DIR="' + options.contToolsPath + '";'
      ].concat(cmd).concat(['\'']);
      return docker.runNativeDockerCrossCommand(options.mountArgs, cmd);
    });
}

