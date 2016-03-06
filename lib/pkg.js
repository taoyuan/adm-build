'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');

module.exports = function (location) {
  var pkgdir = path.resolve(location, 'package.json');
  if (!fs.existsSync(pkgdir)) {
    throw new Error(util.format('Could not find package.json in "%s"', location));
  }
  try {
    var pkg = require(pkgdir);
    pkg.location = path.resolve(location);
    pkg.title = pkg.title || pkg.name;
    return pkg;
  } catch (e) {
    throw new Error(util.format("Could not parse package metadata: %j", e));
  }
};
