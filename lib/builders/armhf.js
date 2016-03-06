'use strict';

var common = require('../common');

module.exports = function (options) {
  return common.build(options, '/armhf', [
    'sed -i "/source-root-users/d" /etc/schroot/chroot.d/click-ubuntu-sdk-14.04-armhf;',
    'cd "${BUILD_DIR}";',
    [
      'click chroot -aarmhf -fubuntu-sdk-14.04 -s trusty run',
      'PKG_CONFIG_LIBDIR=/usr/lib/arm-linux-gnueabihf/pkgconfig:/usr/lib/pkgconfig:/usr/share/pkgconfig',
      'PATH=' + options.contHome + '/node/bin:' + options.contToolsPath + ':$PATH',
      'CC=arm-linux-gnueabihf-gcc',
      'CXX=arm-linux-gnueabihf-g++',
      'AR=arm-linux-gnueabihf-ar',
      'LINK=arm-linux-gnueabihf-g++',
      'npm_config_arch=arm',
      'npm_config_nodedir=' + options.contHome + '/node-src',
      'npm rebuild --production --unsafe-perm --arch=arm --target_arch=arm;'
    ].join(' ')
  ]);
};
