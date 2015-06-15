'use strict';

// CommonJS check so we can require dependencies
if (typeof module === 'object' && module.exports) {
  var _ = require('underscore');
  var Q = require('q');
  var EventEmitter = require('wolfy87-eventemitter');
}

var Amygdala = function(options) {
  // Initialize a new Amygdala instance with the given schema and options.
  //
  // params:
  // - options (Object)
  //   - config (apiUrl, headers)
  //   - schema
  this._config = options.config;
  this._schema = options.schema;
  this._headers = this._config.headers;

  // if not apiUrl is defined, use current location origin
  if (!this._config.apiUrl) {
    this._config.apiUrl = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
  }

  // memory data storage
  this._store = {};
  this._changeEvents = {};

  if (this._config.localStorage) {
    _.each(this._schema, function(value, key) {
      // check each schema entry for localStorage data
      // TODO: filter out apiUrl and idAttribute 
      var storageCache = window.localStorage.getItem('amy-' + key);
      if (storageCache) {
        this._set(key, JSON.parse(storageCache), {'silent': true} );
      }
    }.bind(this));

    // store every change on local storage
    // when localStorage is set to true
    this.on('change', function(type) {
      this.setCache(type, this.findAll(type));
    }.bind(this));
  }
};

Amygdala.prototype = _.clone(EventEmitter.prototype);

// ------------------------------
// Helper methods
// ------------------------------
Amygdala.prototype.serialize = function serialize(obj) {
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

Amygdala.prototype.ajax = function ajax(method, url, options) {
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
    query = this.serialize(options.data);
    url = url + '?' + query;
  }

  var request = new XMLHttpRequest();
  var deferred = Q.defer();

  request.open(method, url, true);

  request.onload = function() {
    // status 200 OK, 201 CREATED, 20* ALL OK
    if (request.status.toString().substr(0, 2) === '20') {
      deferred.resolve(request);
    } else {
      deferred.reject(request);
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
      if (_.isFunction(value)) {
        request.setRequestHeader(key,value());
      }
      else {
        request.setRequestHeader(key, value);
      }
    });
  }

  request.send(method === 'GET' ? null : options.data);

  return deferred.promise;
}

// ------------------------------
// Internal utils methods
// ------------------------------
Amygdala.prototype._getURI = function(type, params) {
  var url;
  // get absolute uri for api endpoint
  if (!this._schema[type] || !this._schema[type].url) {
    throw new Error('Invalid type. Acceptable types are: ' + Object.keys(this._schema));
  }
  url = this._config.apiUrl + this._schema[type].url;

  // if the `idAttribute` specified by the schema or config
  // exists as a key in `params` append it's value to the url,
  // and remove it from `params` so it's not sent in the query string.
  if (params && this._getIdAttribute(type) in params) {
    url += params[this._getIdAttribute(type)];
    delete params[this._getIdAttribute(type)];
  }

  return url;
},

Amygdala.prototype._getIdAttribute = function(type) {
  // schema may override idAttribute
  return this._schema[type].idAttribute || this._config.idAttribute;
},

Amygdala.prototype._emitChange = function(type) {

  // TODO: Add tests for debounced events
  if (!this._changeEvents[type]) {
    this._changeEvents[type] = _.debounce(_.partial(function(type) {
      // emit changes events
      this.emit('change', type);
      // change:<type>
      this.emit('change:' + type);
      // TODO: compare the previous object and trigger change events
    }.bind(this), type), 150);
  }
  
  this._changeEvents[type]();
}

// ------------------------------
// Internal data sync methods
// ------------------------------
Amygdala.prototype._set = function(type, response, options) {
  // Adds or Updates an item of `type` in this._store.
  //
  // type: schema key/store (teams, users)
  // ajaxResponse: response to store in local cache

  // initialize store for this type (if needed)
  // and store it under `store` for easy access.
  var store = this._store[type] ? this._store[type] : this._store[type] = {};
  var schema = this._schema[type];
  var wrappedResponse = false;

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
      wrappedResponse = true;
    }
  }

  _.each(response, function(obj) {
    // store the object under this._store['type']['id']
    store[obj[this._getIdAttribute(type)]] = obj;

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
            return item[this._getIdAttribute(type)];
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
          obj[relatedAttr] = related[this._getIdAttribute(type)];
        }
      }
    }.bind(this));

    // obj.related()
    // set up a related method to fetch other related objects
    // as defined in the schema for the store.
    obj.getRelated = _.partial(function(schema, obj, attributeName) {
      if (schema.oneToMany && attributeName in schema.oneToMany) {
        //
        // if oneToMany relation
        //
        // loop through each id in the obj
        // and return the full related object list as the response
        return obj[attributeName].map(function(value) {
          // find in related `table` by id
          return this.find(schema.oneToMany[attributeName], value);
        }.bind(this)).filter(function(value) {
          // filter out undefined/null values
          return !!value;
        });
      } else if (schema.foreignKey && attributeName in schema.foreignKey) {
        //
        // else, if foreignKey relation
        //
        //
        // find in related `table` by id
        return this.find(schema.foreignKey[attributeName], obj[attributeName]);
      }
      return null;
    }.bind(this), schema, obj);

    // emit change events
    if (!options || options.silent !== true) {
      this._emitChange(type);
    }

  }.bind(this));

  // return our data as the original api call's response
  return wrappedResponse && response.length === 1 ? response[0] : response;
};

Amygdala.prototype._setAjax = function(type, request, options) {
  return this._set(type, request.response, options);
}

Amygdala.prototype._remove = function(type, object) {
  // Removes an item of `type` from this._store.
  //
  // type: schema key/store (teams, users)
  // response: response to store in local cache

  this._emitChange(type);

  // delete object of type by id
  delete this._store[type][object[this._getIdAttribute(type)]]
};

Amygdala.prototype._validateURI = function(url) {
  // convert paths to full URLs
  // TODO: DRY UP
  if (url.indexOf('/') === 0) {
    return this._config.apiUrl + url;
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

  return this.ajax('GET', this._validateURI(url), settings);
}

Amygdala.prototype.get = function(type, params, options) {
  // GET request for `type` with optional `params`
  //
  // type: schema key/store (teams, users)
  // params: extra queryString params (?team=xpto&user=xyz)
  // options: extra options
  // - url: url override

  // Default to the URI for 'type'
  options = options || {};
  _.defaults(options, {'url': this._getURI(type, params)});

  return this._get(options.url, params)
    .then(_.partial(this._setAjax, type).bind(this));
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

  return this.ajax('POST', this._validateURI(url), settings);
}

Amygdala.prototype.add = function(type, object, options) {
  // POST/PUT request for `object` in `type`
  //
  // type: schema key/store (teams, users)
  // object: object to update local and remote
  // options: extra options
  // -  url: url override

  // Default to the URI for 'type'
  options = options || {};
  _.defaults(options, {'url': this._getURI(type)});

  return this._post(options.url, object)
    .then(_.partial(this._setAjax, type).bind(this));
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

  return this.ajax('PUT', this._validateURI(url), settings);
}

Amygdala.prototype.update = function(type, object) {
  // POST/PUT request for `object` in `type`
  //
  // type: schema key/store (teams, users)
  // object: object to update local and remote
  var url = object.url;

  if (!url && this._getIdAttribute(type) in object) {
    url = this._getURI(type, object);
  }

  if (!url) {
    throw new Error('Missing required object.url or ' + this._getIdAttribute(type) + ' attribute.');
  }

  return this._put(url, object)
    .then(_.partial(this._setAjax, type).bind(this));
};

Amygdala.prototype._delete = function(url, data) {
  // AJAX delete request wrapper
  // TODO: make this method public in the future
  var settings = {
    'data': JSON.stringify(data),
    'contentType': 'application/json',
    'headers': this._headers
  };

  return this.ajax('DELETE', this._validateURI(url), settings);
}

Amygdala.prototype.remove = function(type, object) {
  // DELETE request for `object` in `type`
  //
  // type: schema key/store (teams, users)
  // object: object to update local and remote
  var url = object.url;

  if (!url && this._getIdAttribute(type) in object) {
    url = this._getURI(type, object);
  }

  if (!url) {
    throw new Error('Missing required object.url or ' + this._getIdAttribute(type) + ' attribute.');
  }

  return this._delete(url, object)
    .then(_.partial(this._remove, type, object).bind(this));
};

// ------------------------------
// Public cache methods
// ------------------------------
Amygdala.prototype.setCache = function(type, objects) {
  if (!type) {
    throw new Error('Missing schema type parameter.');
  }
  if (!this._schema[type]) {
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
  return JSON.parse(window.localStorage.getItem('amy-' + type));
};

// ------------------------------
// Public query methods
// ------------------------------
Amygdala.prototype.findAll = function(type, query) {
  // find a list of items within the store. (THAT ARE NOT STORED IN BACKBONE COLLECTIONS)
  var store = this._store[type];
  var orderBy;
  var reverseMatch;
  var results;
  if (!store || !Object.keys(store).length) {
    return [];
  }
  if (query === undefined) {
    // query is empty, no object is returned
    results = _.map(store, function(item) { return item; });
  } else if (Object.prototype.toString.call(query) === '[object Object]') {
    // if query is an object, assume it specifies filters.
    results = _.filter(store, function(item) { return _.findWhere([item], query); });
  } else {
    throw new Error('Invalid query for findAll.');
  }
  orderBy = this._schema[type].orderBy;
  if (orderBy) {
    // match the orderBy attribute for the presence
    // of a reverse flag
    reverseMatch = orderBy.match(/^-([\w-]{0,})$/);
    if (reverseMatch !== null) {
      // if we have two matches, we have a reverse flag
      orderBy = orderBy.replace('-', '');
    }
    results = _.sortBy(results, function(item) {
      return item[orderBy].toString().toLowerCase();
    }.bind(this));

    if (reverseMatch !== null) {
      // reverse the results
      results = results.reverse();
    }
  }
  return results;
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
  } else {
    // if query is a String or Number, assume it stores the key/url value
    // Object.prototype.toString.call(query) === '[object String]'
    // Object.prototype.toString.call(query) === '[object Number]'
    return store[query];
  }
};

// expose via CommonJS, AMD or as a global object
if (typeof module === 'object' && module.exports) {
  module.exports = Amygdala;
} else if (typeof define === 'function' && define.amd) {
  define(function() {
    return Amygdala;
  });
} else {
  window.Amygdala = Amygdala;
}
