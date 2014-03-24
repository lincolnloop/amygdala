/*
 * Itinerary v0.0.4
 * (c) 2014 Marco Louro <marco@lincolnloop.com> (http://lincolnloop.com)
 * https://github.com/lincolnloop/amygdala
 * Licensed under the BSD license.
 * http://github.com/lincolnloop/amygdala/blob/master/LICENSE
 *
 * Forked from:
 *
 *   Backbone.js (commit 722bee4684)
 *     (c) 2010-2011 Jeremy Ashkenas, DocumentCloud Inc.
 *     (c) 2011-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 *     https://github.com/jashkenas/backbone
 */



(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(underscore, backbone, loglevelfactory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require('underscore'), require('backbone'), require('loglevel'));
  } else {
    // Browser globals (root is window)
    root.Amygdala = factory(root._, root.backbone, root.loglevel);
  }
}(this, function (_, backbone, loglevel) {

  // A shim for 'require' so that it will work universally for externals
  var require = function(name) {
    return {underscore: _, backbone: backbone, loglevel: loglevel}[name];
  };

/*
 * -------- Begin module --------
 */
'use strict';

var _ = require('underscore');
// TODO: backbone dependency is temporary until we find a better ajax lib
var backbone = require('backbone');
var log = require('loglevel');

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
    //console.log(type, response, responseType, xhr);
    // Adds or Updates an item of `type` in this._store.
    //
    // type: schema key/store (teams, users)
    // response: response to store in local cache
    // responseType: success/fail
    // xhr: XHR response object

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

  this._remove = function(type, key, responseType, xhr) {
    console.log(type, key, responseType, xhr);
    // Removes an item of `type` from this._store.
    //
    // type: schema key/store (teams, users)
    // key: key to remove
    // responseType: success/fail
    // xhr: XHR response object

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
    // -  url: url override
    log.info('store:get', type, params);
    // request settings
    var settings = {
      'type': 'GET',
      'url': options && options.url ? options.url : this._getURI(type),
      'data': params
    };
    return backbone.ajax(settings).always(_.partial(this._set, type).bind(this));
  };

  this.add = function(type, object, options) {
    // POST/PUT request for `object` in `type`
    //
    // type: schema key/store (teams, users)
    // object: object to update local and remote
    // options: extra options
    // -  url: url override
    log.info('store:add', type, object);
    // request settings
    var settings = {
      'type': 'POST',
      'url': options && options.url ? options.url : this._getURI(type),
      'data': JSON.stringify(object),
      'contentType': 'application/json'
    };
    return backbone.ajax(settings).always(_.partial(this._set, type).bind(this));
  };

  this.update = function(type, object, options) {
    // POST/PUT request for `object` in `type`
    //
    // type: schema key/store (teams, users)
    // object: object to update local and remote
    // options: extra options
    // -  url: url override
    log.info('store:update', type, object, options);
    if (!object.url) {
      throw new Error('Missing object.url attribute. A url attribute is required for a PUT request.');
    }
    var settings = {
      'type': 'PUT',
      'url': object.url,
      'data': JSON.stringify(object),
      'contentType': 'application/json'
    };
    return backbone.ajax(settings).always(_.partial(this._set, type).bind(this));
  };

  this.remove = function(type, object, options) {
    // DELETE request for `object` in `type`
    log.info('store:delete', type, object, options);
    if (!object.url) {
      throw new Error('Missing object.url attribute. A url attribute is required for a DELETE request.');
    }
    var settings = {
      'type': 'DELETE',
      'url': object.url,
      'data': JSON.stringify(object),
      'contentType': 'application/json'
    };
    return backbone.ajax(settings).always(_.partial(this._remove, type).bind(this));
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

/*
 * -------- End module --------
 */

  return require('amygdala');

}));
