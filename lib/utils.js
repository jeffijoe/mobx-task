"use strict";

/**
 * Proxies getters on the target to the object.
 *
 * @param  {Object} target
 * The proxy to add getters to.
 *
 * @param  {Object} obj
 * Object with properties we want to proxy getters to.
 *
 * @params {string[]} keys
 * The keys to proxy.
 */
module.exports.proxyGetters = function proxyGetters(target, obj, keys) {
  keys.map(function (key) {
    Object.defineProperty(target, key, {
      get: function get() {
        return obj[key];
      }
    });
  });
};

/**
 * Invokes the function in a promise-safe way.
 */
module.exports.promiseTry = function promiseTry(fn) {
  return new Promise(function (resolve, reject) {
    try {
      resolve(fn());
    } catch (err) {
      reject(err);
    }
  });
};
//# sourceMappingURL=utils.js.map