# adm-build [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url] [![Coverage percentage][coveralls-image]][coveralls-url]
> Build nodejs application to arm or amd64 package

## Installation

```sh
$ npm install --save adm-build
```

## Usage

### deb before|after scripts

Template context:

* apphome: application home path.
* approot: application root path. default is `/opt`
* svcname: service name. same as package name
* deployname: deploy directory name. same as the basename of the package local path

## License

MIT © [taoyuan]()


[npm-image]: https://badge.fury.io/js/adm-build.svg
[npm-url]: https://npmjs.org/package/adm-build
[travis-image]: https://travis-ci.org/taoyuan/adm-build.svg?branch=master
[travis-url]: https://travis-ci.org/taoyuan/adm-build
[daviddm-image]: https://david-dm.org/taoyuan/adm-build.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/taoyuan/adm-build
[coveralls-image]: https://coveralls.io/repos/taoyuan/adm-build/badge.svg
[coveralls-url]: https://coveralls.io/r/taoyuan/adm-build
