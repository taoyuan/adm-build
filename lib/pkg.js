'use strict';

var path = require('path');
var util = require('util');

module.exports = function (location) {
  try {
    var pkg = require(path.resolve(location, 'package.json'));
    pkg.location = path.resolve(location);
    pkg.title = pkg.title || pkg.name;
    return pkg;
  } catch (e) {
    throw new Error(util.format("Could not parse package metadata: %j", e));
  }
};
