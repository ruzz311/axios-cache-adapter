'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _readCache = require('./read-cache');

var _readCache2 = _interopRequireDefault(_readCache);

var _serialize = require('./serialize');

var _serialize2 = _interopRequireDefault(_serialize);

var _memory = require('./memory');

var _memory2 = _interopRequireDefault(_memory);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function cache() {
  var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  config.store = config.store || _memory2.default;
  var key = config.key || cache.key;

  config.maxAge = config.maxAge || 0;
  config.readCache = config.readCache || _readCache2.default;
  config.serialize = config.serialize || _serialize2.default;

  config.exclude = config.exclude || {};
  config.exclude.query = config.exclude.query || true;
  config.exclude.paths = config.exclude.paths || [];

  if (config.log !== false) {
    config.log = typeof config.log === 'function' ? config.log : console.log.bind(console);
  }

  return function (req, next, service) {
    if (service) {
      var useCache = !service.use || service.use && service.use.cache !== false;

      if (!useCache) {
        return null;
      }
    }

    // do not cache request with query
    if (config.exclude.query && req.url.match(/\?.*$/)) {
      return null;
    }

    var found = false;

    config.exclude.paths.forEach(function (regexp) {
      if (req.url.match(regexp)) {
        found = true;
        return false;
      }
    });

    if (found) {
      return null;
    }

    var uuid = key(req);

    // clear cache if method different from GET
    if (req.method.toLowerCase() !== 'get') {
      config.store.removeItem(uuid);
      return null;
    }

    var f = function f() {
      return next().then(function (res) {
        return config.store.setItem(uuid, {
          expires: config.maxAge === 0 ? 0 : Date.now() + config.maxAge,
          data: config.serialize(req, res)
        });
      });
    };

    return config.store.getItem(uuid).then(function (value) {
      return config.readCache(req, config.log)(value).catch(function (err) {
        // clean up cache if stale
        err.reason === 'cache-stale' ? config.store.removeItem(uuid).then(f) : f();
      });
    });
  };
}

cache.readCache = _readCache2.default;
cache.serialize = _serialize2.default;

cache.key = function (req) {
  return req.url;
};

exports.default = cache;
module.exports = exports['default'];