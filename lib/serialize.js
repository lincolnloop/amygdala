'use strict';

var _ = require('underscore');
var log = require('loglevel');

function serialize(obj) {
  log.debug('serialize', obj);
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
