'use strict';

var _ = require('lodash');
var util = require('util');
var path = require('path');
var fs = require('fs-extra');
var Handlebars = require('handlebars');
var docker = require('../docker');
var utils = require('../utils');

var DEFAULT_ROOT = process.env.ADM_PATH || '/opt';

module.exports = function (ctx, arch, log) {
  var pkg = ctx.pkg;
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

  if (fs.existsSync(customPackRoot)) {
    // copy [PROJ]/admpack/root -> [PROJ]/.dist/debian-[arch]
    log.debug('pack-deb', 'Copying custom root files from "%s" to "%s"', customPackRoot, hostDist);
    fs.copySync(customPackRoot, hostDist);
  }

  var category = '.';
  var type = options.type;
  if (type === 'auto') {
    if (_.startsWith(pkg.name, 'driver-')) {
      type = 'driver'
    } else if (_.startsWith(pkg.name, 'app-')) {
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
  var hostAppPath = path.join(hostDist, root, category, pkg.name);
  var contAppPath = path.join(contDist, root, category, pkg.name);
  fs.ensureDirSync(hostAppPath);
  fs.copySync(hostBuildPath, hostAppPath);

  // Prepare template context
  var tplctx = {
    apphome: path.join(root, category, pkg.name),
    basepath: root, // installation path
    category: category, // package dir
    name: pkg.name // module name
  };

  //
  // TODO startup

  // After Install
  // try load custom postinstall script or using template to generate a postinstall script
  var hostAfterInstallPath, contAfterInstallPath;
  var customAfterInstallPath = path.join(customPackConf, 'after-install-deb');

  var source, template, data;
  if (fs.existsSync(customAfterInstallPath)) {
    hostAfterInstallPath = path.join(ctx.hostDistRoot, 'after-install-deb-' + arch);
    contAfterInstallPath = path.join(ctx.contDistRoot, 'after-install-deb-' + arch);

    log.debug('pack-deb', 'Generating post install script according "%s" to "%s"', customAfterInstallPath, hostAfterInstallPath);

    source = fs.readFileSync(customAfterInstallPath, "utf-8");
    template = Handlebars.compile(source);
    data = template(tplctx);
    fs.writeFileSync(hostAfterInstallPath, data);
  }
  // else {
  //   log.debug('pack-deb', 'Generating default post install script to "%s"', hostAfterInstallPath);
  //   source = fs.readFileSync(path.resolve(__dirname, '../templates/after-install.hbs'), "utf-8");
  //   template = Handlebars.compile(source);
  //   data = template(tplctx);
  //   fs.writeFileSync(hostAfterInstallPath, data);
  // }

  // Packing
  var packageFileName = util.format('%s_%s_%s.deb', pkg.name, pkg.version, arch);
  var packageFilePath = path.join(ctx.hostAppRoot, packageFileName);

  var cmd = [
    'fpm', '-s', 'dir', '-t', 'deb',
    '--deb-compression', 'xz',
    '--deb-user', 'root',
    '--deb-group', 'root',
    '--category', 'web',
    '-m', utils.quote(options.maintainer),
    '--url', utils.quote(options.url),
    '-n', utils.quote(pkg.name),
    '-v', utils.quote(pkg.version),
    '--description', utils.quote(pkg.title),
    '-C', utils.quote(contDist),
    '-a', utils.quote(arch),
    // '-d', utils.quote('dobox-minimal'),
    '-f',
    '-p', utils.quote(path.join(ctx.contDistRoot, packageFileName))
  ];

  if (contAfterInstallPath) {
    cmd = cmd.concat(['--after-install', utils.quote(contAfterInstallPath)]);
  }

  cmd.push('.');

  log.info('deb', 'Packing %s for architecture %s in formatting %s to %s', pkg.name, arch, 'deb', packageFilePath);
  return docker.runNativeDockerCommand(ctx.mountArgs, cmd.join(' ')).then(function () {
    
  });
};
