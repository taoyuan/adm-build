'use strict';

var debug = require('debug')('adm-build');
var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var ncp = require('ncp');
var async = require('async');
var P = require('bluebird');
var needs = require('needs');
var tmp = require('tmp');
var sh = require('shelljs');
var common = require('./common');

var utils = require('./utils');
var log = require('adm-logger').log;
var docker = require('./docker');

build.options = {
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
    describe: 'Set the installation root path'
  },
  'm': {
    alias: 'maintainer',
    default: 'djhaskin987@djhaskin987-S301LA',
    describe: 'The maintainer of this package.'
  },
  'url': {
    default: 'http://example.com/no-uri-given',
    describe: 'Add a url for this package.'
  },
  'pack': {
    default: true,
    describe: 'Pack module'
  }
};

function build(options) {
  debug('options', options);

  var target = options._[0];
  target = path.resolve(process.cwd(), target);
  var pkg = require('./pkg')(target);

  return docker.verifyDockerImages().then(function () {

    var archs = [], formats = [];
    if (options.arch === 'all') {
      archs = ['armhf', 'amd64'];
    } else if (options.arch === 'none') {
      archs = [];
    } else if (_.includes(build.options.a.choices, options.arch)) {
      archs = [options.arch];
    }

    utils.infoprop('Target arch    :', archs);

    if (options.format === 'all') {
      formats = ['deb', 'snappy'];
    } else if (options.format === 'none') {
      formats = [];
    } else if (_.includes(build.options.f.choices, options.format)) {
      formats = [options.format];
    }
    utils.infoprop('Build type     :', formats);

    utils.infoprop('Package Type   :', options.type);
    utils.infoprop('Package name   :', pkg.name);
    utils.infoprop('Package title  :', pkg.title);
    utils.infoprop('Version        :', pkg.version);

    var contHome = '/home/builder';

    var hostAppRoot = target;
    var contAppRoot = path.join(contHome, pkg.name);

    var hostToolsPath = path.join(__dirname, 'tools');
    var contToolsPath = path.join(contHome, 'tools');

    var mountArgs = [
      // '-v', hostToolsPath + ':' + contToolsPath,
      '-v', hostAppRoot + ':' + contAppRoot
    ];

    var stagingobj = tmp.dirSync({unsafeCleanup: true});
    var staging = stagingobj.name;

    var context = {
      mountArgs: mountArgs,
      contHome: contHome,
      staging: staging, // staging path
      hostAppRoot: hostAppRoot,
      contAppRoot: contAppRoot,
      hostToolsPath: hostToolsPath,
      contToolsPath: contToolsPath,
      hostBuildRoot: path.join(hostAppRoot, '.build'),
      contBuildRoot: path.join(contAppRoot, '.build')
    };

    var promise = P.resolve();

    promise = promise.then(function () {
      log.debug('build', 'Copying application files to staging path %s', staging);
      // npm install in production
      return common.copy(hostAppRoot, staging, {ignore: 'node_modules'});
    });

    promise = promise.then(function () {
      log.debug('build', 'Fetching production dependencies for staging');
      // only install dependencies without running scripts.
      sh.exec('npm install --production --unsafe-perm --ignore-scripts', {async: false, cwd: staging});
    });

    var builders = needs(__dirname, 'builders');
    promise = promise.then(function () {
      log.debug('build', 'Building application for architectures %j', archs);
      return P.each(archs, function (arch) {
        if (!builders[arch]) throw new Error('Unknown architecture: ' + arch);
        log.info('build', 'Building for architecture ' + arch);
        return builders[arch](context, log);
      });
    });

    _.assign(context, {
      hostDistRoot: path.join(hostAppRoot, '.dist'),
      contDistRoot: path.join(contAppRoot, '.dist'),
      options: options,
      pkg: pkg,
      log: log
    });

    if (options.pack) {
      var packagers = needs(__dirname, 'packagers');
      promise = promise.then(function () {
        return P.each(formats, function (format) {
          if (!packagers[format]) throw new Error('Unknown package format: ' + format);
          log.info('pack', 'Packing to ' + format);
          return P.each(archs, function (arch) {
            return packagers[format](context, arch, log);
          });
        });
      });
    }

    return promise.then(function () {
      stagingobj.removeCallback();
      log.info('build', 'Built successful!');
    });
  });

}

module.exports = build;
