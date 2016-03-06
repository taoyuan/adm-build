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

  var packageDir = '.';
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
      packageDir = 'drivers';
      break;
    case 'app':
      packageDir = 'apps';
      break;
  }

  var root = options.root || DEFAULT_ROOT;
  console.log('install root', root);

  // Copy built files to dist path
  var targetPath = path.join(hostDist, root, packageDir, pkg.name);
  fs.ensureDirSync(targetPath);
  fs.copySync(hostBuildPath, targetPath);

  // Prepare template context
  var tplctx = {
    basePath: root, // installation path
    packageDir: packageDir, // package dir
    name: pkg.name // module name
  };

  //
  // TODO startup

  // Post Install
  // try load custom postinstall script or using template to generate a postinstall script
  var hostPostInstallPath = path.join(ctx.hostDistRoot, 'postinstall-deb-' + arch);
  var contPostInstallPath = path.join(ctx.contDistRoot, 'postinstall-deb-' + arch);
  var customPostInstallPath = path.join(customPackConf, 'postinstall-deb');

  if (fs.existsSync(customPostInstallPath)) {
    log.debug('pack-deb', 'Copying custom post install script form "%s" to "%s"', customPostInstallPath, hostPostInstallPath);
    fs.copySync(customPostInstallPath, hostPostInstallPath);
  } else {
    log.debug('pack-deb', 'Generating default post install script to "%s"', hostPostInstallPath);
    var source = fs.readFileSync(path.resolve(__dirname, '../templates/postinstall.hbs'), "utf-8");
    var template = Handlebars.compile(source);
    var data = template(tplctx);
    fs.writeFileSync(hostPostInstallPath, data);
  }

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
    '-p', utils.quote(path.join(ctx.contDistRoot, packageFileName)),
    '--after-install', utils.quote(contPostInstallPath),
    '.'
  ].join(' ');

  log.info('deb', 'Packing %s for architecture %s in formatting %s to %s', pkg.name, arch, 'deb', packageFilePath);
  return docker.runNativeDockerCommand(ctx.mountArgs, cmd).then(function () {
    // fs.removeSync(hostDist);
  });
};
