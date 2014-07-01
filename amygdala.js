'use strict';

var _ = require('underscore');
var ajax = require('./lib/ajax');
var log = require('loglevel');
var Q = require('q');
var EventEmitter = require('event-emitter');

var Amygdala = function(schema, options) {
  // Initialize a new Amygdala instance with the given schema and options.
  //
  // params:
  // - schema (Object): Details about the data structure.
  // - options (Object)
  //
  // options:
  // - options.headers (Object): Additional headers to provide with each
  //                             request, such as auth headers.
  log.debug('Amygdala#constructor', schema, options);
  options = options || {};

  this._schema = schema;
  this._headers = options.headers;

  // memory data storage
  this._store = {};
};

Amygdala.prototype = EventEmitter({});

// ------------------------------
// Internal utils methods
// ------------------------------
Amygdala.prototype._getURI = function(type) {
  // get absolute uri for api endpoint
  if (!this._schema[type] || !this._schema[type].url) {
    throw new Error('Invalid type. Acceptable types are: ' + Object.keys(this._schema));
  }
  return this._schema.apiUrl + this._schema[type].url;
},

// ------------------------------
// Internal data sync methods
// ------------------------------
Amygdala.prototype._set = function(type, response) {
  // Adds or Updates an item of `type` in this._store.
  //
  // type: schema key/store (teams, users)
  // ajaxResponse: response to store in local cache

  // initialize store for this type (if needed)
  // and store it under `store` for easy access.
  var store = this._store[type] ? this._store[type] : this._store[type] = {};
  var schema = this._schema[type];
  var deferred = Q.defer();

  if (_.isString(response)) {
    // If the response is a string, try JSON.parse.
    try {
      response = JSON.parse(response);
    } catch(e) {
      throw('Invalid JSON from the API response.');
    }
  }

  if (!_.isArray(response)) {
    // The response isn't an array. We need to figure out how to handle it.
    if (schema.parse) {
      // Prefer the schema's parse method if one exists.
      response = schema.parse(response);
      // if it's still not an array, wrap it around one
      if (!_.isArray(response)) {
        response = [response];
      }
    } else {
      // Otherwise, just wrap it in an array and hope for the best.
      response = [response];
    }
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
    // emit changes events
    this.emit('change');
    // change:<type>
    this.emit('change:' + type);
    // TODO: compare the previous object and trigger change events
  }.bind(this));

  // return our data as the original api call's response
  return response.length === 1 ? response[0] : response;
};

Amygdala.prototype._remove = function(type, object) {
  // Removes an item of `type` from this._store.
  //
  // type: schema key/store (teams, users)
  // response: response to store in local cache
  log.debug('Amygdala#_remove', type, object);

  // emit changes events
  this.emit('change');
  // change:<type>
  this.emit('change:' + type);

  // delete object of type by id
  delete this._store[type][object[this._schema.idAttribute]]
};

Amygdala.prototype._validateURI = function(url) {
  // convert paths to full URLs
  // TODO: DRY UP
  if (url.indexOf('/') === 0) {
    return this._schema.apiUrl + url;
  }

  return url;
}

// ------------------------------
// Public data sync methods
// ------------------------------
Amygdala.prototype._get = function(url, params) {
  // AJAX post request wrapper
  // TODO: make this method public in the future

  // Request settings
  var settings = {
    'data': params,
    'headers': this._headers
  };

  return ajax('GET', this._validateURI(url), settings);
}

Amygdala.prototype.get = function(type, params, options) {
  // GET request for `type` with optional `params`
  //
  // type: schema key/store (teams, users)
  // params: extra queryString params (?team=xpto&user=xyz)
  // options: extra options
  // - url: url override
  log.debug('Amygdala#get', type, params, options);

  // Default to the URI for 'type'
  options = options || {};
  _.defaults(options, {'url': this._getURI(type)});

  return this._get(options.url, params)
    .then(_.partial(this._set, type).bind(this));
};

Amygdala.prototype._post = function(url, data) {
  // AJAX post request wrapper
  // TODO: make this method public in the future

  // Request settings
  var settings = {
    'data': data ? JSON.stringify(data) : null,
    'contentType': 'application/json',
    'headers': this._headers
  };

  return ajax('POST', this._validateURI(url), settings);
}

Amygdala.prototype.add = function(type, object, options) {
  // POST/PUT request for `object` in `type`
  //
  // type: schema key/store (teams, users)
  // object: object to update local and remote
  // options: extra options
  // -  url: url override
  log.debug('Amygdala#add', type, object, options);

  // Default to the URI for 'type'
  options = options || {};
  _.defaults(options, {'url': this._getURI(type)});

  return this._post(options.url, object)
    .then(_.partial(this._set, type).bind(this));
};

Amygdala.prototype._put = function(url, data) {
  // AJAX put request wrapper
  // TODO: make this method public in the future

  // Request settings
  var settings = {
    'data': JSON.stringify(data),
    'contentType': 'application/json',
    'headers': this._headers
  };

  return ajax('PUT', this._validateURI(url), settings);
}

Amygdala.prototype.update = function(type, object) {
  // POST/PUT request for `object` in `type`
  //
  // type: schema key/store (teams, users)
  // object: object to update local and remote
  log.debug('Amygdala#update', type, object);

  if (!object.url) {
    throw new Error('Missing object.url attribute. A url attribute is required for a PUT request.');
  }

  return this._put(object.url, object)
    .then(_.partial(this._set, type).bind(this));
};

Amygdala.prototype._delete = function(url, data) {
  // AJAX delete request wrapper
  // TODO: make this method public in the future
  var settings = {
    'data': JSON.stringify(data),
    'contentType': 'application/json',
    'headers': this._headers
  };

  return ajax('DELETE', this._validateURI(url), settings);
}

Amygdala.prototype.remove = function(type, object) {
  // DELETE request for `object` in `type`
  //
  // type: schema key/store (teams, users)
  // object: object to update local and remote
  log.debug('Amygdala#delete', type, object);

  if (!object.url) {
    throw new Error('Missing object.url attribute. A url attribute is required for a DELETE request.');
  }

  return this._delete(object.url, object)
    .then(_.partial(this._remove, type, object).bind(this));
};

// ------------------------------
// Public cache methods
// ------------------------------
Amygdala.prototype.setCache = function(type, values) {
  if (!type) {
    throw new Error('Missing schema type parameter.');
  }
  if (!this._schema[type] || !this._schema[type].url) {
    throw new Error('Invalid type. Acceptable types are: ' + Object.keys(this._schema));
  }
  return window.localStorage.setItem('amy-' + type, JSON.stringify(objects));
};

Amygdala.prototype.getCache = function(type) {
  if (!type) {
    throw new Error('Missing schema type parameter.');
  }
  if (!this._schema[type] || !this._schema[type].url) {
    throw new Error('Invalid type. Acceptable types are: ' + Object.keys(this._schema));
  }
  return window.localStorage.getItem('amy-' + type);
};

// ------------------------------
// Public query methods
// ------------------------------
Amygdala.prototype.findAll = function(type, query) {
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

Amygdala.prototype.find = function(type, query) {
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

module.exports = Amygdala;
