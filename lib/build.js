'use strict';

var debug = require('debug')('adm-build');
var _ = require('lodash');
var util = require('util');
var path = require('path');
var fs = require('fs-extra');
var ncp = require('ncp');
var async = require('async');
var Promise = require('bluebird');
var needs = require('needs');
var tmp = require('tmp');
var sh = require('shelljs');
var chalk = require('chalk');
var Yaml = require('yamljs');
var log = require('adm-logger').log;

var common = require('./common');
var utils = require('./utils');
var docker = require('./docker');

build.options = {
  deployment: {
    alias: 'd',
    describe: 'Build modules defined in deployment.yml with deployment specified. Could be "prod" or "dev" and so on.'
  },
  arch: {
    alias: 'a',
    choices: ['all', 'armhf', 'amd64', 'none'],
    default: 'armhf',
    describe: 'Set target arch'
  },
  format: {
    alias: 'f',
    choices: ['all', 'deb', /*'snappy', */'none'],
    default: 'deb',
    describe: 'Specify the package format'
  },
  type: {
    alias: 't',
    choices: ['auto', 'driver', 'app', 'core'],
    default: 'auto',
    describe: 'Specify the package type for dobox'
  },
  root: {
    describe: 'Set the installation root path'
  },
  maintainer: {
    alias: 'm',
    describe: 'The maintainer of this package.'
  },
  url: {
    describe: 'Add a url for this package.'
  },
  pack: {
    default: true,
    describe: 'Package module to deb. disable to pack using --no-pack'
  },
  collect: {
    alias: 'C',
    describe: 'Just collect packages built to dist.'
  }
};

function build(options) {
  options = _.defaults(options, process.env);

  debug('options', options);

  var target = options.target || options._[0] || '.';
  target = path.resolve(process.cwd(), target);

  var hasDeploymentFile = fs.existsSync(path.join(target, 'deployment.yml'));

  // *******************
  // Single project mode

  if (!hasDeploymentFile) {
    return docker.verifyDockerImages().then(function () {
      return _build(target, options);
    });
  }

  // ************
  // Modules mode

  var info;
  loadDeployment(target, options).then(function (_info) {
    info = _info;
  }).then(function () {
    return createBuildDir(info);
  }).then(function () {
    return fetchAndBuild(info, options);
  }).then(function () {
    return collect(info, options);
  }).then(function () {
    return removeBuildDir(info);
  }).then(function () {
    console.log(chalk.bold('Build successful. All packages could be found in ' + options.output));
  }).catch(function (error) {
    if (/Cannot connect to the Docker daemon/.test(error.message)) {
      console.error(chalk.red('[ERROR] ' + error.message));
      return process.exit(1);
    }
    throw error;
  });
}

function loadDeployment(dir, options) {
  var depfile = path.join(dir, 'deployment.yml');
  if (!fs.existsSync(depfile)) {
    return Promise.reject(new Error('deployment.yml not found in ' + dir + ', it is required'));
  }
  var dep = Yaml.parseFile(depfile);

  var group = options.deployment || 'prod';
  if (!dep.modules || !dep.modules[group]) {
    return Promise.reject(new Error('No modules named "' + group + '" found in deployment.yml'));
  }

  var buildDir = path.join(dir, 'build');
  var pkg = _.pick(dep, ['name', 'version']);
  pkg.dependencies = dep.modules[group];
  return Promise.resolve({
    dir: buildDir,
    pkg: pkg
  });
}

function createBuildDir(info) {
  fs.mkdirp(info.dir);
  fs.writeJsonSync(path.join(info.dir, 'package.json'), info.pkg);
}

function removeBuildDir(info) {
  fs.removeSync(info.dir)
}

function fetchAndBuild(info, options) {
  var dir = info.dir;
  var modules = info.modules;

  var names = _.keys(modules);
  var cmd = 'npm install --production --unsafe-perm --ignore-scripts';
  log.info('build', 'Fetching modules:', cmd);

  var result = sh.exec(cmd, {cwd: dir});
  if (result.code) {
    return Promise.reject(new Error('npm install failed'));
  }

  return docker.verifyDockerImages().then(function () {
    return Promise.each(names, function (name, index, length) {
      var version = modules[name];

      console.log(chalk.bold(chalk.green('==>') + ' (' + (index + 1) + '/' + length + ') Building %s@%s'), name, version);

      var mod = path.join(dir, 'node_modules', name);

      if (!fs.existsSync(mod)) {
        var error = new Error(util.format('Module not found, %s', mod));
        log.error('build', error.message);
        return Promise.reject(error);
      }

      return _build(mod, options);
    });
  });
}

function collect(info, options) {
  var modpaths = _.map(info.modules, function (m) {
    return path.join(info.dir, 'node_modules', m);
  });

  options.output = path.resolve(options.output || 'dist');

  if (fs.existsSync(options.output)) {
    log.info('build', 'The output directory "%s" exists, remove it now.', options.output);
    fs.removeSync(options.output);
  }

  console.log(chalk.bold(chalk.blue('==>') + ' Collecting all packages to ' + options.output));
  return require('./collect')(modpaths, options);
}

function _build(target, options) {
  var metadata = require('./pkg')(target);
  var packing = metadata.packing || {};
  metadata.deployname = path.basename(target);

  var archs = [], formats = [];
  if (options.arch === 'all') {
    archs = ['armhf', 'amd64'];
  } else if (options.arch === 'none') {
    archs = [];
  } else if (_.includes(build.options.arch.choices, options.arch)) {
    archs = [options.arch];
  }

  utils.infoprop('Target arch    :', archs);

  if (options.format === 'all') {
    formats = ['deb', 'snappy'];
  } else if (options.format === 'none') {
    formats = [];
  } else if (_.includes(build.options.format.choices, options.format)) {
    formats = [options.format];
  }
  utils.infoprop('Build type     :', formats);

  utils.infoprop('Package Type   :', options.type);
  utils.infoprop('Package name   :', metadata.name);
  utils.infoprop('Package title  :', metadata.title);
  utils.infoprop('Version        :', metadata.version);

  var contHome = '/home/builder';

  var hostAppRoot = target;
  var contAppRoot = path.join(contHome, metadata.name);

  var hostToolsPath = path.join(__dirname, 'tools');
  var contToolsPath = path.join(contHome, 'tools');

  var hostBuildRoot = path.join(hostAppRoot, '.build');
  var contBuildRoot = path.join(contAppRoot, '.build');

  var hostDistRoot = path.join(hostAppRoot, 'dist');
  var contDistRoot = path.join(contAppRoot, 'dist');

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
    hostBuildRoot: hostBuildRoot,
    contBuildRoot: contBuildRoot,
    rebuild: packing.rebuild !== false
  };

  var promise = Promise.resolve();

  promise = promise.then(function () {
    log.debug('build', 'Cleaning build and dist content');
    if (fs.existsSync(hostBuildRoot)) {
      fs.removeSync(hostBuildRoot);
    }
    if (fs.existsSync(hostDistRoot)) {
      fs.removeSync(hostDistRoot);
    }
  });

  promise = promise.then(function () {
    log.debug('build', 'Copying application files to staging path \n%s ' + chalk.bold('->') + ' %s', hostAppRoot, staging);
    // npm install in production
    return common.copy(hostAppRoot, staging, {ignore: 'node_modules'});
  });

  promise = promise.then(function () {
    log.debug('build', 'Patching bundle dependencies to package.json');
    var file = path.join(staging, 'package.json');
    var metadata = fs.readJsonSync(file, 'utf-8');
    var changed = false;
    _.forEach(metadata.dependencies, function (__, name) {
      metadata.bundleDependencies = metadata.bundleDependencies || [];
      if (!_.includes(metadata.bundleDependencies, name)) {
        metadata.bundleDependencies.push(name);
        changed = true;
      }
    });
    if (changed) {
      fs.writeJsonSync(file, metadata, {spaces: 2});
    }
  });

  promise = promise.then(function () {
    log.debug('build', 'Fetching production dependencies for staging');
    // only install dependencies without running scripts.
    sh.exec('npm install --silent --production --unsafe-perm --ignore-scripts', {async: false, cwd: staging});
  });

  var builders = needs(__dirname, 'builders');
  promise = promise
    .then(function () {
      log.debug('build', 'Building application for architectures', archs);
      return Promise.each(archs, function (arch) {
        if (!builders[arch]) throw new Error('Unknown architecture: ' + arch);
        log.info('build', 'Building for architecture ' + arch);
        return builders[arch](context, log);
      });
    })
    .then(function () {
      if (!options.rebuild) {
        log.info('build', 'Skipped `npm rebuild`');
      }
    });

  _.assign(context, {
    hostDistRoot: hostDistRoot,
    contDistRoot: contDistRoot,
    options: options,
    metadata: metadata,
    log: log
  });

  if (options.pack) {
    var packagers = needs(__dirname, 'packagers');
    promise = promise.then(function () {
      return Promise.each(formats, function (format) {
        if (!packagers[format]) throw new Error('Unknown package format: ' + format);
        log.info('pack', 'Packing to ' + format);
        return Promise.each(archs, function (arch) {
          return packagers[format](context, arch, log);
        });
      });
    });
  }

  return promise.then(function () {
    stagingobj.removeCallback();
    if (fs.existsSync(hostBuildRoot)) {
      fs.removeSync(hostBuildRoot);
    }
    log.info('build', 'Built successful!');
  });

}

module.exports = build;
