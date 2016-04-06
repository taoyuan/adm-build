'use strict';

var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var util = require('util');
var ndir = require('node-dir');
var chalk = require('chalk');
var Promise = require('bluebird');

function collect(modspaths, options) {
  var output = options.output || 'dist';
  var flat = options.flat;

  if (fs.existsSync(output)) {
    fs.removeSync(output);
  }

  if (typeof modspaths === 'string') {
    modspaths = [modspaths];
  }

  var promise = Promise.all(_.map(modspaths, function (modpath) {
    return move(modpath, output, flat);
  }));

  return promise
    .each(function (result) {
      _.forEach(result, function (mods, name) {
        name = name.replace(/^[_-]$/, '');
        generateInstallScript(name, mods, output);
      });
    })
    .then(function () {
      console.log(chalk.green('Generated install script'));
    });
}

function move(modpath, dest, flat) {
  var result = {};

  return _move(modpath).then(function () {
    return result;
  });

  function _move(modpath) {

    if (Array.isArray(modpath)) {
      return Promise.each(modpath, function (m) {
        return _move(m)
      });
    }

    if (typeof modpath !== 'string') {
      return Promise.reject(new Error('modpath must be string'));
    }

    var dir = path.resolve(modpath, 'dist');
    if (!fs.existsSync(dir)) {
      console.log(chalk.yellow('WARN'), 'No dist folder found in', modpath);
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      ndir.paths(dir, function (err, paths) {
        paths.files
          .filter(function (f) {
            return _.endsWith(f, '.deb');
          })
          .map(function (f) {
            var target, arch = '';
            var p1 = f.lastIndexOf('_');
            var p2 = f.lastIndexOf('.');
            if (p2 > p1 && p1 > -1) {
              arch = f.substring(p1 + 1, p2);
            }
            target = path.join(dest, arch, flat ? '' : subdir);
            fs.ensureDirSync(target);
            target = path.join(target, path.basename(f));
            console.log(chalk.green('Copying'), f, '->', target);
            fs.copySync(f, target);

            if (!arch) {
              arch = '-';
            }
            result[arch] = result[arch] || [];
            result[arch].push(flat ? path.basename(f) : path.join(subdir, path.basename(f)));
          });
        resolve();
      });
    });
  }
}

function generateInstallScript(name, pkgs, dest) {
  var script = '#!/bin/bash\n';
  var template = 'sudo dpkg -i %s\n';
  var file = path.join(dest, name, 'install');
  _.forEach(pkgs, function (pkg) {
    script += util.format(template, pkg);
  });
  fs.writeFileSync(file, script, 'utf-8');
  fs.chmodSync(file, '0755');
}


module.exports = collect;
