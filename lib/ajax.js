'use strict';

var _ = require('underscore');
var Q = require('q');
var serialize = require('./serialize');

function ajax(method, url, options) {
   // Sends an Ajax request, converting the data into a querystring if the
   // method is GET.
   //
   // params:
   // -method (string): GET, POST, PUT, DELETE
   // -url (string): The url to send the request to.
   // -options (Object)
   //
   // options
   // - data (Object): Will be converted to a querystring for GET requests.
   // - contentType (string): A value for the Content-Type request header.
   // - headers (Object): Additional headers to add to the request.
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
    // status 200 OK, 201 CREATED
    if (request.status === 200 || request.status === 201) {
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
