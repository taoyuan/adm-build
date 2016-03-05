'use strict';

var _ = require('lodash');
var P = require('bluebird');
var sh = require('shelljs');
var util = require('util');
var log = require('adm-logger').log;
var utils = require('./utils');

var docker = exports;

var developerCrossPackageName = docker.developerCrossPackageName = "dobox/dobox-developer-cross-base";
var developerPackageName = docker.developerPackageName = "dobox/dobox-developer";

docker.verifyDockerRunning = verifyDockerRunning;
function verifyDockerRunning() {
  if (!utils.isInstalled("docker")) {
    throw new Error("Could not find a local installation of 'docker', is it installed and in your PATH?");
  }

  // This will throw error is docker is not running
  return exec('docker version', {silent: true});
}

docker.verifyDockerImages = verifyDockerImages;
function verifyDockerImages() {
  return verifyDockerRunning()
    .then(function () {
      return P.each([
        developerCrossPackageName,
        developerPackageName
      ], ensureDockerImage);
    });
}

docker.ensureDockerImage = ensureDockerImage;
function ensureDockerImage(image) {
  return exec('docker inspect ' + image, {silent: true})
    .catch(function () {
      log.info('docker', util.format("Docker package '%s' does not exist, pulling...\n", image));
      return exec('docker pull ' + image);
    })
    .catch(function (err) {
      console.error("Could not retrieve docker package, see above log output for details.");
      throw err;
    });
}

docker.runNativeDockerCrossCommand = runNativeDockerCrossCommand;
function runNativeDockerCrossCommand(args, command) {
  var cmd = ['docker', 'run', '--rm', '--privileged', '-i']
    .concat(args, [developerCrossPackageName], command)
    .join(' ');

  return exec(cmd);
}

docker.runNativeDockerCommand = runNativeDockerCommand;
function runNativeDockerCommand(args, command) {
  var cmd = ['docker', 'run', '--rm', '-i']
    .concat(args, [developerPackageName], command)
    .join(' ');

  return exec(cmd);
}

function exec(cmd, options) {
  options = _.assign({}, options, {async: true});
  log.debug('docker', cmd);
  return new P(function (resolve, reject) {
    sh.exec(cmd, options, function (code, stdout, stderr) {
      if (code) return reject(new Error(stderr));
      return resolve();
    });
  });
}
