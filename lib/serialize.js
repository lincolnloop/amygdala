'use strict';

var _ = require('underscore');

function serialize(obj) {
  // Translates an object to a querystring

  if (!_.isObject(obj)) {
    return obj;
  }
  var pairs = [];
  _.each(obj, function(value, key) {
    pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
  });
  return pairs.join('&');
}

module.exports = serialize;
