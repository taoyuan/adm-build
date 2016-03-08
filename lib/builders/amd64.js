'use strict';

var common = require('../common');

module.exports = function (options) {
  return common.build(options, 'amd64', [
    'cd "${BUILD_DIR}";',
    [
      'PATH=' + options.contHome + '/node/bin:' + options.contToolsPath + ':$PATH',
      'npm rebuild --production --unsafe-perm;'
    ].join(' ')
  ]);
};
