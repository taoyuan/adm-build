'use strict';

var debug = require('debug')('adm-build');
var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var sh = require('shelljs');
var ncp = require('ncp');
var async = require('async');
var P = require('bluebird');
var needs = require('needs');
var tmp = require('tmp');

var utils = require('./utils');
var log = require('adm-logger').log;
var docker = require('./docker');

build.describe = ['build <target> [options]', 'Build the project'];
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
    type: 'string',
    default: '/opt/dolink',
    describe: 'Set the installation root path'
  }
};

function build(options) {
  debug('options', options);

  var cwd = options._[0];
  cwd = path.resolve(process.cwd(), cwd);

  var pkg = require('./pkg')(cwd);

  return docker.verifyDockerImages().then(function () {

    var archs = [], formats = [];
    if (options.arch === 'all') {
      archs = ['armhf', 'amd64'];
    } else if (options.arch === 'none') {
      archs = [];
    } else if (_.includes(build.options.a.choices, options.arch)) {
      archs = [options.arch];
    }

    utils.infoprop('Target arch:    ', archs);

    if (options.format === 'all') {
      formats = ['deb', 'snappy'];
    } else if (options.format === 'none') {
      formats = [];
    } else if (_.includes(build.options.f.choices, options.format)) {
      formats = [options.format];
    }
    utils.infoprop('Build type:     ', formats);

    utils.infoprop('Package Type:   ', options.type);
    utils.infoprop('Package name:   ', pkg.name);
    utils.infoprop('Package title:  ', pkg.title);
    utils.infoprop('Version:        ', pkg.version);

    var contHome = '/home/builder';

    var hostRoot = cwd;
    var contRoot = path.join(contHome, pkg.name);

    var buildOptions = {
      mountArgs: ['-v', hostRoot + ':' + contRoot],
      contHome: contHome,
      hostRoot: hostRoot,
      contRoot: contRoot,
      hostBuildRoot: path.join(hostRoot, '.build'),
      contBuildRoot: path.join(contRoot, '.build')
    };

    var promise = P.resolve();

    var builders = needs(__dirname, 'builders');
    promise = promise.then(function () {
      return P.each(archs, function (arch) {
        if (!builders[arch]) throw new Error('Unknown architecture: ' + arch);
        log.info('build', 'Building for architecture ' + arch);
        return builders[arch](buildOptions, log);
      });
    });

    var context = _.assign({}, buildOptions, {
      hostDistRoot: path.join(hostRoot, '.dist'),
      contDistRoot: path.join(contRoot, '.dist'),
      options: options,
      pkg: pkg,
      log: log
    });

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

    return promise.then(function () {
      log.info('build', 'Built successful');
    });
  });

}

module.exports = build;


