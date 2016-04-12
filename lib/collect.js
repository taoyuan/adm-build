'use strict';

var _ = require('lodash');
var path = require('path');
var fs = require('fs-extra');
var util = require('util');
var Promise = require('bluebird');
var ndir = require('node-dir');
var paths = Promise.promisify(ndir.paths);
var chalk = require('chalk');


function collect(modspaths, options) {
  var output = options.output || 'dist';

  if (typeof modspaths === 'string') {
    modspaths = [modspaths];
  }

  var result = {};
  return Promise.each(modspaths, function (modpath) {
    var dir = path.resolve(modpath, 'dist');
    if (!fs.existsSync(dir)) {
      console.log(chalk.yellow('WARN'), 'No dist folder found in', modpath);
    }

    return paths(dir).then(function (paths) {
      var files = _.filter(paths.files, function (p) {
        return _.endsWith(p, '.deb');
      });

      _.forEach(files, function (src) {
        var dest, arch = '';
        var p1 = src.lastIndexOf('_');
        var p2 = src.lastIndexOf('.');
        if (p2 > p1 && p1 > -1) {
          arch = src.substring(p1 + 1, p2);
        }
        dest = path.join(output, arch);
        fs.ensureDirSync(dest);
        dest = path.join(dest, path.basename(src));

        console.log(chalk.green('Copying'), src, '->', dest);
        fs.copySync(src, dest);

        arch = arch || '-';
        result[arch] = result[arch] || [];
        result[arch].push(path.basename(src));
      });
    });

  }).then(function () {
    _.forEach(result, function (mods, name) {
      name = name.replace(/^[_-]$/, '');
      generateInstallScript(name, mods, output);
    });

    console.log(chalk.bold('Generated install script'));
  });
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
