'use strict';

var _ = require('underscore');
var Q = require('q');
var serialize = require('./serialize');

function ajax(method, url, options) {
  /**
   * Sends an Ajax request, converting the data into a querystring if the
   * method is GET.
   *
   * method: GET, POST, PUT, DELETE
   * url: The url to send the request to.
   * options: Extra options.
   * - data: Converted to a querystring for GET requests.
   * - contentType: A value for the Content-Type request header.
   * - headers: Additional headers to add to the request. Should be passed as
   *            an object with header names as keys.
   */
  var query;
  options = options || {};

  if (!_.isEmpty(options.data) && method === 'GET') {
    query = serialize(options.data);
    url = url + '?' + query;
  }

  var request = new XMLHttpRequest();
  var deferred = Q.defer();

  request.open(method, url, true);

  request.onload = function() {
    if (request.status === 200) {
      deferred.resolve(request.response);
    } else {
      deferred.reject(new Error('Request failed with status code ' + request.status));
    }
  };

  request.onerror = function() {
    deferred.reject(new Error('Unabe to send request to ' + JSON.stringify(url)));
  };

  if (!_.isEmpty(options.contentType)) {
    request.setRequestHeader('Content-Type', options.contentType);
  }

  if (!_.isEmpty(options.headers)) {
    _.each(options.headers, function(value, key) {
      request.setRequestHeader(key, value);
    });
  }

  request.send(method === 'GET' ? null : options.data);

  return deferred.promise;
}

module.exports = ajax;
