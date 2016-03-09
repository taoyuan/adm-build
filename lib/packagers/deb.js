'use strict';

var _ = require('lodash');
var util = require('util');
var path = require('path');
var fs = require('fs-extra');
var Handlebars = require('handlebars');
var docker = require('../docker');
var utils = require('../utils');

var DEFAULT_ROOT = process.env.ADM_PATH || '/opt';
var SCRIPTS = ['before-install', 'after-install', 'before-remove', 'after-remove', 'before-upgrade', 'after-upgrade'];

module.exports = function (ctx, arch, log) {
  var options = ctx.options;
  var hostBuildPath = path.join(ctx.hostBuildRoot, arch);

  var hostDist = path.join(ctx.hostDistRoot, 'debian-' + arch);
  var contDist = path.join(ctx.contDistRoot, 'debian-' + arch);
  if (fs.existsSync(hostDist)) {
    fs.removeSync(hostDist);
  }
  fs.ensureDirSync(hostDist);

  var customPackConf = path.join(ctx.hostAppRoot, 'admpack', 'conf');
  var customPackRoot = path.join(ctx.hostAppRoot, 'admpack', 'root');

  // read packing metadata from admpack/conf/packing.json
  var metadata = ctx.metadata;
  var packing = metadata.packing || {};
  // var metadataFilePath = path.join(customPackConf, 'packing.json');
  // if (fs.existsSync(metadataFilePath)) {
  //   _.assign(metadata, fs.readJsonSync(metadataFilePath));
  // }

  // copy [PROJ]/admpack/root -> [PROJ]/.dist/debian-[arch]
  if (fs.existsSync(customPackRoot)) {
    log.debug('pack-deb', 'Copying custom root files from "%s" to "%s"', customPackRoot, hostDist);
    fs.copySync(customPackRoot, hostDist);
  }

  var category = '';
  var type = options.type;
  if (type === 'auto') {
    if (_.startsWith(metadata.deployname, 'driver-')) {
      type = 'driver'
    } else if (_.startsWith(metadata.deployname, 'app-')) {
      type = 'app';
    } else {
      type = 'core'
    }
  }
  switch (type) {
    case 'driver':
      category = 'drivers';
      break;
    case 'app':
      category = 'apps';
      break;
  }

  var root = options.root || DEFAULT_ROOT;

  // Copy built files to dist path
  var hostAppPath = path.join(hostDist, root, category, metadata.deployname);
  var contAppPath = path.join(contDist, root, category, metadata.deployname);
  fs.ensureDirSync(hostAppPath);
  fs.copySync(hostBuildPath, hostAppPath);

  // Prepare template context
  var tplctx = {
    apphome: path.join(root, category, metadata.deployname), // application install path
    approot: root, // installation path
    svcname: metadata.name,
    deployname: metadata.deployname // deploy name
  };

  //
  // TODO startup

  // After Install
  // try load custom postinstall script or using template to generate a postinstall script
  // var hostAfterInstallPath, contAfterInstallPath;
  // var customAfterInstallPath = path.join(customPackConf, 'after-install-deb');
  //
  // var source, template, data;
  // if (fs.existsSync(customAfterInstallPath)) {
  //   hostAfterInstallPath = path.join(ctx.hostDistRoot, 'after-install-deb-' + arch);
  //   contAfterInstallPath = path.join(ctx.contDistRoot, 'after-install-deb-' + arch);
  //
  //   log.debug('pack-deb', 'Generating post install script according "%s" to "%s"', customAfterInstallPath, hostAfterInstallPath);
  //
  //   source = fs.readFileSync(customAfterInstallPath, "utf-8");
  //   template = Handlebars.compile(source);
  //   data = template(tplctx);
  //   fs.writeFileSync(hostAfterInstallPath, data);
  // }

  // Packing
  var packageFileName = util.format('%s_%s_%s.deb', metadata.name, metadata.version, arch);
  var packageFilePath = path.join(ctx.hostAppRoot, packageFileName);

  var cmd = [
    'fpm', '-s', 'dir', '-t', 'deb',
    '--deb-compression', 'xz',
    '--deb-user', 'root',
    '--deb-group', 'root',
    '--category', 'web',
    '-m', utils.quote(options.maintainer),
    '--url', utils.quote(options.url),
    '-n', utils.quote(metadata.name),
    '-v', utils.quote(metadata.version),
    '--description', utils.quote(metadata.title),
    '-C', utils.quote(contDist),
    '-a', utils.quote(arch),
    '-f',
    '-p', utils.quote(path.join(ctx.contDistRoot, packageFileName))
  ];

  // dependencies
  if (packing.dependencies) {
    _.forEach(packing.dependencies, function (d) {
      cmd = cmd.concat(['-d', utils.quote(d)]);
    });
  }

  // scripts
  var scripts = loadScripts(customPackConf, ctx.hostDistRoot, tplctx, SCRIPTS, log);
  _.forEach(scripts, function (file, name) {
    cmd = cmd.concat(['--' + name, utils.quote(path.join(ctx.contDistRoot, file))]);
  });

  cmd.push('.');

  log.info('deb', 'Packing %s for architecture %s in formatting %s to %s', metadata.name, arch, 'deb', packageFilePath);
  return docker.runNativeDockerCommand(ctx.mountArgs, cmd.join(' ')).then(function () {

  });
};

function loadScripts(source, target, ctx, scripts, log) {
  var loaded = {}, sourceFile, filename, template, parsed;
  _.forEach(scripts, function (script) {
    filename = script + '-deb';
    sourceFile = path.join(source, filename);
    if (fs.existsSync(sourceFile)) {
      log.debug('deb', 'Loading script', script);
      source = fs.readFileSync(sourceFile, "utf-8");
      template = Handlebars.compile(source);
      parsed = template(ctx);
      fs.writeFileSync(path.join(target, filename), parsed);
      loaded[script] = filename;
    }
  });
  return loaded;
}
