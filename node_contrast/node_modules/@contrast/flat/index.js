'use strict';

const { Domain } = require('domain');

/**
 * Modified version of `flat' library on npm that now supports our
 * specific use-case where objects have a domain property that can
 * be a circular reference that would (because this uses recursion)
 * lead to a stack overflow.
 *
 * @param {Object} target the object we want to flatten
 * @param {Object} opts   flattening options
 */
function flatten(target, opts) {
  opts = opts || {};

  const delimiter = opts.delimiter || '.';
  const maxDepth = opts.maxDepth;
  const output = {};

  function step(object, prev, currentDepth) {
    currentDepth = currentDepth || 1;
    Object.keys(object).forEach((key) => {
      const value = object[key];
      const isArray = opts.safe && Array.isArray(value);
      const type = Object.prototype.toString.call(value);
      const isBuffer = Buffer.isBuffer(value);
      const isObject = type === '[object Object]' || type === '[object Array]';
      const isDomain = object[key] instanceof Domain;

      const newKey = prev ? prev + delimiter + key : key;

      if (
        !isArray &&
        !isBuffer &&
        isObject &&
        Object.keys(value).length &&
        !isDomain &&
        (!opts.maxDepth || currentDepth < maxDepth)
      ) {
        return step(value, newKey, currentDepth + 1);
      }

      output[newKey] = value;
      return null;
    });
  }

  step(target);

  return output;
}

module.exports = flatten;
