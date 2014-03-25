'use strict';

var _ = require('underscore');
var log = require('loglevel');
var Q = require('q');


// ------------------------------
// Utility functions
// ------------------------------

function serialize(obj) {
  // Translates an object to a querystring
  if (!_.isObject(obj)) {
    return obj;
  }
  var pairs = [];
  for (var key in obj) {
    if (!_.isEmpty(obj[key])) {
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
    }
  }
  return pairs.join('&');
}

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

  if (!_.isEmpty(options.data)) {
    query = serialize(options.data);
    url = url + '?' + query;
  }

  var request = new XMLHttpRequest();
  var deferred = Q.defer();

  request.open(method, url, true);

  request.onload = function() {
    if (request.status === 200) {
      deferred.resolve(request.response, request.responseType);
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

  request.send();

  return deferred.promise;
}


var Amygdala = function(schema) {
  // Session/browser key/value store with remote sync capabilities.
  //
  //
  // API examples - reading data
  // this.store.findAll('teams'); // returns the teams list in JSON
  // this.store.find('teams', {'url': '/api/v2/team-xpto' }); // returns team xpto in JSON

  // --------------------------
  // Internal variables
  // --------------------------
  // schema
  this._schema = schema;
  // memory data storage
  this._store = {};

  // --------------------------
  // Internal utils methods
  // --------------------------
  // get absolute uri for api endpoint
  this._getURI = function(type) {
    if (!this._schema[type] || !this._schema[type].url) {
      throw new Error('Invalid type. Acceptable types are: ' + Object.keys(this._schema));
    }
    return this._schema.apiUrl + this._schema[type].url;
  },

  // ------------------------------
  // Internal data sync methods
  // ------------------------------
  this._set = function(type, response, responseType) {
    // Adds or Updates an item of `type` in this._store.
    //
    // type: schema key/store (teams, users)
    // response: response to store in local cache
    // responseType: success/fail

    // initialize store for this type (if needed)
    // and store it under `store` for easy access.
    if (responseType && responseType === "error") {
      return;
    }
    var store = this._store[type] ? this._store[type] : this._store[type] = {};
    var schema = this._schema[type];

    // check if response is an array, or just a simple object
    if (!Array.isArray(response)) {
      // isArray === false, try to parse response into an Array
      // schema.parse translates non-standard data into a list
      // format than can be stored.
      response = schema.parse ? schema.parse(response) : [response];
    }

    if (Object.prototype.toString.call(response) === '[object Object]') {
      response = [response];
    }
    _.each(response, function(obj) {
      // handle oneToMany relations
      _.each(this._schema[type].oneToMany, function(relatedType, relatedAttr) {
        var related = obj[relatedAttr];
        // check if obj has a `relatedAttr` that is defined as a relation
        if (related) {
          // check if attr value is an array,
          // if it's not empty, and if the content is an object and not a string
          if (Object.prototype.toString.call(related) === '[object Array]' &&
            related.length > 0 &&
            Object.prototype.toString.call(related[0]) === '[object Object]') {
            // if related is a list of objects,
            // populate the relation `table` with this data
            this._set(relatedType, related);
            // and replace the list of objects within `obj`
            // by a list of `id's
            obj[relatedAttr] = _.map(related, function(item) {
              return item[this._schema.idAttribute];
            }.bind(this));
          }
        }
      }.bind(this));

      // handle foreignKey relations
      _.each(this._schema[type].foreignKey, function(relatedType, relatedAttr) {
        var related = obj[relatedAttr];
        // check if obj has a `relatedAttr` that is defined as a relation
        if (related) {
          // check if `obj[relatedAttr]` value is an object (FK should not be arrays),
          // if it's not empty, and if the content is an object and not a string
          if (Object.prototype.toString.call(related) === '[object Object]') {
            // if related is an object,
            // populate the relation `table` with this data
            this._set(relatedType, [related]);
            // and replace the list of objects within `item`
            // by a list of `id's
            obj[relatedAttr] = related[this._schema.idAttribute];
          }
        }
      }.bind(this));

      // store the object under this._store['type']['id']
      store[obj[this._schema.idAttribute]] = obj;
      // TODO: compare the previous object and trigger change events

    }.bind(this));
  };

  this._remove = function(type, key, response, responseType) {
    log.debug(type, key, response, responseType);
    // Removes an item of `type` from this._store.
    //
    // type: schema key/store (teams, users)
    // key: key to remove
    // response: response to store in local cache
    // responseType: success/fail

    // TODO
  };

  // ------------------------------
  // Public data sync methods
  // ------------------------------
  this.get = function(type, params, options) {
    // GET request for `type` with optional `params`
    //
    // type: schema key/store (teams, users)
    // params: extra queryString params (?team=xpto&user=xyz)
    // options: extra options
    // - url: url override
    log.info('store:get', type, params);

    // Default to the URI for 'type'
    options = options || {};
    _.defaults(options, {'url': this._getURI(type)});

    // Request settings
    var settings = {
      'data': params
    };

    return ajax('GET', options.url, settings)
      .then(_.partial(this._set, type).bind(this));
  };

  this.add = function(type, object, options) {
    // POST/PUT request for `object` in `type`
    //
    // type: schema key/store (teams, users)
    // object: object to update local and remote
    // options: extra options
    // -  url: url override
    log.info('store:add', type, object);

    // Default to the URI for 'type'
    options = options || {};
    _.defaults(options, {'url': this._getURI(type)});

    // Request settings
    var settings = {
      'data': JSON.stringify(object),
      'contentType': 'application/json'
    };

    return ajax('POST', options.url, settings)
      .then(_.partial(this._set, type).bind(this));
  };

  this.update = function(type, object) {
    // POST/PUT request for `object` in `type`
    //
    // type: schema key/store (teams, users)
    // object: object to update local and remote
    log.info('store:update', type, object);

    if (!object.url) {
      throw new Error('Missing object.url attribute. A url attribute is required for a PUT request.');
    }

    // Request settings
    var settings = {
      'data': JSON.stringify(object),
      'contentType': 'application/json'
    };

    return ajax('PUT', object.url, settings)
      .then(_.partial(this._set, type).bind(this));
  };

  this.remove = function(type, object) {
    // DELETE request for `object` in `type`
    //
    // type: schema key/store (teams, users)
    // object: object to update local and remote
    log.info('store:delete', type, object);

    if (!object.url) {
      throw new Error('Missing object.url attribute. A url attribute is required for a DELETE request.');
    }

    // Request settings
    var settings = {
      'data': JSON.stringify(object),
      'contentType': 'application/json'
    };

    return ajax('DELETE', object.url, settings)
      .then(_.partial(this._remove, type).bind(this));
  };

  // ------------------------------
  // Public query methods
  // ------------------------------
  this.findAll = function(type, query) {
    // find a list of items within the store. (THAT ARE NOT STORED IN BACKBONE COLLECTIONS)
    var store = this._store[type];
    if (!store || !Object.keys(store).length) {
      return [];
    }
    if (query === undefined) {
      // query is empty, no object is returned
      return _.map(store, function(item) { return item; });
    } else if (Object.prototype.toString.call(query) === '[object Object]') {
      // if query is an object, assume it specifies filters.
      return _.filter(store, function(item) { return _.findWhere([item], query); });
    } else {
      throw new Error('Invalid query for findAll.');
    }
  };

  this.find = function(type, query) {
    // find a specific within the store. (THAT ARE NOT STORED IN BACKBONE COLLECTIONS)
    var store = this._store[type];
    if (!store || !Object.keys(store).length) {
      return undefined;
    }
    if (query === undefined) {
      // query is empty, no object is returned
      return  undefined;
    } else if (Object.prototype.toString.call(query) === '[object Object]') {
      // if query is an object, return the first match for the query
      return _.findWhere(store, query);
    } else if (Object.prototype.toString.call(query) === '[object String]') {
      // if query is a String, assume it stores the key/url value
      return store[query];
    }
  };
};

module.exports = Amygdala;
