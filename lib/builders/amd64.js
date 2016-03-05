'use strict';

var common = require('../common');

module.exports = function (options) {
  return common.build(options, 'amd64', [
    'cd "${BUILD_DIR}";',
    [
      'PATH=' + options.contHome + '/node/bin:$PATH',
      'npm install --production --unsafe-perm;'
    ].join(' ')
  ]);
};
