'use strict';

var path = require('path');
var fs = require('fs-extra');
var ignore = require('ignore');
var P = require('bluebird');
var ncp = require('ncp');
var docker = require('./docker');

var ig = ignore().addIgnoreFile(
  ignore.select([path.resolve(__dirname, 'ignore')])
);

function copy(source, target) {
  return new Promise(function (resolve, reject) {
    ncp(source, target, {filter: ig.createFilter()}, function (err) {
      if (err) return reject(err);
      return resolve();
    });
  });
}

exports.build = function (options, arch, cmd) {
  var hostBuildPath = path.join(options.hostBuildRoot, arch);
  var contBuildPath = path.join(options.contBuildRoot, arch);
  return P.resolve()
    .then(function () {
      // log.debug('copy', 'Copying %s -> %s', options.hostRoot, hostBuildPath);
      if (fs.existsSync(hostBuildPath)) {
        fs.removeSync(hostBuildPath);
      }
      fs.ensureDirSync(hostBuildPath);
      // copy host root sources to build path ignore .build
      return copy(options.hostRoot, hostBuildPath);
    })
    .then(function () {
      cmd = ['/bin/bash', '-c', '\'', 'BUILD_DIR="' + contBuildPath + '";'].concat(cmd).concat(['\'']);
      return docker.runNativeDockerCrossCommand(options.mountArgs, cmd);
    });
};
