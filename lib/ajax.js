'use strict';

var _ = require('underscore');
var Q = require('q');
var serialize = require('./serialize');

function ajax(method, url, options) {
  // Sends a GET request, converting the data into a querystring
  //
  // method: GET, POST, PUT, DELETE
  // url: the url to send the request to
  // options: extra options
  // - data: converted to a querystring for GET requests
  // - contentType: a value for the Content-Type request header
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

  request.send(method === 'GET' ? null : options.data);

  return deferred.promise;
}

module.exports = ajax;
