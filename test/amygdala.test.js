/* global describe, it, before, after, beforeEach */
'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var Amygdala = require('../amygdala');

// fixtures
var teamFixtures = require('./fixtures/teams');
var userFixtures = require('./fixtures/users');
var discussionFixtures = require('./fixtures/discussions');

// Setup
var expect = chai.expect;
chai.use(sinonChai);
// log.setLevel('debug');

describe('Amygdala', function() {

  var store, authStore, xhr;
  var settings = {
    'config': {
      'apiUrl': 'http://localhost:8000',
      'idAttribute': 'url'
    },
    'schema': {
      'teams': {
        'url': '/api/v2/team/',
        'oneToMany': {
          'members': 'members'
        }
      },
      'users': {
        'url': '/api/v2/user/'
      },
      'members': {
        'foreignKey': {
          'user': 'users'
        }
      },
      'attachments': {
        'url': '/api/v2/attachment/',
        'foreignKey': {
          'user': 'users',
          'message': 'messages'
        }
      },
      'discussions': {
        'url': '/api/v2/discussion/',
        'orderBy': 'title',
        'foreignKey': {
          'message': 'messages',
          'team': 'teams'
        },
        parse: function(data) {
          return data.results;
        },
      },
      'messages': {
        'url': '/api/v2/message/',
        'oneToMany': {
          'attachments': 'attachments',
          'votes': 'votes'
        },
        'foreignKey': {
          'user': 'users',
          'discussion': 'discussions'
        }
      },
      'votes': {
        'url': '/api/v2/vote/',
        'foreignKey': {
          'message': 'messages'
        }
      }
    }
  };

  before(function() {
    store = new Amygdala(settings);
    store._set('users', userFixtures);
    store._set('teams', teamFixtures);
    store._set('discussions', discussionFixtures);

    var authSettings = {
      'config': {
        'apiUrl': 'http://localhost:8000',
        'idAttribute': 'url',
        'headers': {'Authorization': 'alpha'}
      },
      'schema': settings.schema
    };

    authStore = new Amygdala(authSettings);
    authStore._set('users', userFixtures);
    authStore._set('teams', teamFixtures);
    authStore._set('discussions', discussionFixtures);

    global.XMLHttpRequest = function() {
      return xhr;
    };
  });

  beforeEach(function() {
    // Reset the xhr spy between each test
    xhr = {
      'open': sinon.spy(),
      'send': sinon.spy(),
      'setRequestHeader': sinon.spy()
    };
  });

  after(function() {
    delete global.XMLHttpRequest;
  });

  describe('#_set()', function() {

    it('loads simple models correctly', function() {
      expect(Object.keys(store._store['teams'])).to.have.length(1);
    });

    it('populates tables based on one-to-many relations', function() {
      expect(Object.keys(store._store['members'])).to.have.length(3);
    });

    it('replaces objects by id\'s in one-to-many relations', function() {
      expect(
        store._store.teams['/api/v2/team/9/'].members
          .indexOf('/api/v2/team/9/member/f31abb30271cdecae75a6227128c8fd9/')
      ).to.not.equal(-1);
    });

    it('replaces objects by id\'s in foreign-key relations', function() {
      expect(
        store._store.discussions['/api/v2/discussion/595/'].message
      ).to.equal('/api/v2/message/3798/');
    });

    it('sets up a helper method to get related objects', function() {
      expect(store.find('teams', '/api/v2/team/9/').getRelated).to.exist;
    });

    it('uses data parsers when they are defined', function() {
      // discussions have a non-standard data structure due to pagintation,
      // so the schema provides a `parse` method.
      // for storage purposes we only want the objects, not the meta data.
      expect(Object.keys(store._store['discussions'])).to.have.length(4);
    });

    it('attempts to parse JSON if the format of the response is a string', function() {
      // Create an empty store for this test
      var jsonStore = new Amygdala(settings);

      // Set the users with a JSON string
      jsonStore._set('users', JSON.stringify(userFixtures));

      expect(Object.keys(jsonStore._store['users'])).to.have.length(3);
      expect(_.pluck(jsonStore._store['users'], 'name')).to.contain('Brandon Konkle');
    });

    it('Single item result lists are returned correctly', function() {
      // Create an empty store for this test
      var jsonStore = new Amygdala(settings);

      // Set the users with a JSON string
      jsonStore._set('users', [userFixtures[0]]);

      expect(Object.keys(jsonStore._store['users'])).to.have.length(1);
      expect(_.pluck(jsonStore._store['users'], 'name')).to.contain('Martin');
    });

    it('Single item result is returned correctly', function() {
      // Create an empty store for this test
      var jsonStore = new Amygdala(settings);

      // Set the users with a JSON string
      jsonStore._set('users', userFixtures[0]);
      expect(Object.keys(jsonStore._store['users'])).to.have.length(1);
      
      jsonStore._set('users', userFixtures[1]);
      expect(Object.keys(jsonStore._store['users'])).to.have.length(2);
      
      expect(_.pluck(jsonStore._store['users'], 'name')).to.contain('Martin');
    });

    it('will throw an error including the string if the JSON parse fails', function() {
      // Create an empty store for this test
      var jsonStore = new Amygdala(settings);

      // Set the users with an invalid string
      var invalidSet = function() {
        jsonStore._set('users', 'JSON fiesta!');
      };

      expect(invalidSet).to.throw('Invalid JSON from the API response.');
    });

  });

  describe('#<obj>.getRelated(<attributeName>)', function() {

    it('returns a list of objects based on the oneToMany relation', function() {
      expect(store.find('messages', '/api/v2/message/3798/').getRelated('votes')).to.have.length(1);
    });

    it('returns an object for foreignKey relations', function() {
      expect(store.find('messages', '/api/v2/message/3789/').getRelated('discussion').title)
        .to.equal('unicode');
    });

  });

  describe('#get()', function() {

    it('triggers an Ajax GET request', function() {
      store.get('discussions', {'id': 1});

      expect(xhr.open).to.have.been.calledOnce;
      expect(xhr.open).to.have.been.calledWith('GET', 'http://localhost:8000/api/v2/discussion/?id=1', true);
      expect(xhr.send).to.have.been.calledOnce;
      expect(xhr.send).to.have.been.calledWith(null);
    });

    it('calls #_set() with the given type', function(done) {
      var originalSet = store._set;
      store._set = sinon.spy();

      store.get('discussions', {'id': 1})
        .then(function() {
          expect(store._set).to.have.been.calledWith('discussions', 'response');

          // Clean up
          store._set = originalSet;
          done();
        }).catch(function(error) {
          // Catch and report errors
          done(error);
        });

      // Set the status, then trigger the resolution of the promise so the
      // 'then' block above is executed.
      xhr.status = 200;
      xhr.response = 'response';
      xhr.onload();
    });

    it('doesn\'t add any headers by default', function() {
      store.get('discussions', {'id': 1});

      expect(xhr.setRequestHeader).to.not.have.been.called;
    });

    it('will add headers if Amygdala was initialized with some', function() {
      authStore.get('discussions', {'id': 1});

      expect(xhr.setRequestHeader).to.have.been.calledOnce
        .and.have.been.calledWith('Authorization', 'alpha');
    });

  });

  describe('#add()', function() {
    var obj = {'name': 'The Alliance'};

    it('triggers an Ajax POST request', function() {
      store.add('teams', obj);

      expect(xhr.open).to.have.been.calledOnce
        .and.have.been.calledWith('POST', 'http://localhost:8000/api/v2/team/', true);
      expect(xhr.send).to.have.been.calledOnce
        .and.have.been.calledWith(JSON.stringify(obj));
    });

    it('calls #_set() with the given type', function(done) {
      var originalSet = store._set;
      store._set = sinon.spy();

      store.add('teams', obj)
        .then(function() {
          expect(store._set).to.have.been.calledWith('teams', 'response');

          // Clean up
          store._set = originalSet;
          done();
        }).catch(function(error) {
          // Catch and report errors
          done(error);
        });

      // Set the status, then trigger the resolution of the promise so the
      // 'then' block above is executed.
      xhr.status = 200;
      xhr.response = 'response';
      xhr.onload();
    });

    it('only adds the Content-Type header by deault', function() {
      store.add('teams', obj);

      expect(xhr.setRequestHeader).to.have.been.calledOnce
        .and.have.been.calledWith('Content-Type', 'application/json');
    });

    it('will add headers if Amygdala was initialized with some', function() {
      authStore.add('teams', obj);

      expect(xhr.setRequestHeader).to.have.been.calledTwice
        .and.have.been.calledWith('Authorization', 'alpha');
    });

  });

  describe('#update()', function() {
    var obj = {'title': 'Rise of the Horde', 'url': '/draenor/'};

    it('triggers an Ajax PUT request', function() {

      store.update('messages', obj);

      expect(xhr.open).to.have.been.calledOnce;
      expect(xhr.open).to.have.been.calledWith('PUT', 'http://localhost:8000/draenor/', true);
      expect(xhr.send).to.have.been.calledOnce;
      expect(xhr.send).to.have.been.calledWith(JSON.stringify(obj));
    });

    it('calls #_set() with the given type', function(done) {
      var originalSet = store._set;
      store._set = sinon.spy();

      store.update('messages', obj)
        .then(function() {
          expect(store._set).to.have.been.calledWith('messages', 'response');

          // Clean up
          store._set = originalSet;
          done();
        }).catch(function(error) {
          // Catch and report errors
          done(error);
        });

      // Set the status, then trigger the resolution of the promise so the
      // 'then' block above is executed.
      xhr.status = 200;
      xhr.response = 'response';
      xhr.onload();
    });

    it('only adds the Content-Type header by deault', function() {
      store.update('messages', obj);

      expect(xhr.setRequestHeader).to.have.been.calledOnce
        .and.have.been.calledWith('Content-Type', 'application/json');
    });

    it('will add headers if Amygdala was initialized with some', function() {
      authStore.update('messages', obj);

      expect(xhr.setRequestHeader).to.have.been.calledTwice
        .and.have.been.calledWith('Authorization', 'alpha');
    });

  });

  describe('#remove()', function() {
    var obj = discussionFixtures.results[0];

    it('triggers an Ajax DELETE request', function() {
      store.remove('discussions', obj);

      expect(xhr.open).to.have.been.calledOnce;
      expect(xhr.open).to.have.been.calledWith('DELETE', 'http://localhost:8000/api/v2/discussion/595/', true);
      expect(xhr.send).to.have.been.calledOnce;
      expect(xhr.send).to.have.been.calledWith(JSON.stringify(obj));
    });

    it('calls #_remove() with the given type', function(done) {
      var originalRemove = store._remove;
      store._remove = sinon.spy();

      store.remove('discussions', obj)
        .then(function() {
          expect(store._remove).to.have.been.calledWith('discussions', obj);
          // Clean up
          store._remove = originalRemove;
          done();
        }).catch(function(error) {
          // Catch and report errors
          done(error);
        });

      // Set the status, then trigger the resolution of the promise so the
      // 'then' block above is executed.
      xhr.status = 200;
      xhr.response = 'response';
      xhr.onload();
    });

    it('removes the object from the cached store', function(done) {

      store.remove('discussions', obj)
        .then(function() {
          expect(store.find('discussions', obj.url)).to.equal(undefined);
          // add the discussion back into the store
          store._set('discussions', discussionFixtures);
          done();
        }).catch(function(error) {
          // Catch and report errors
          done(error);
        });

      // Set the status, then trigger the resolution of the promise so the
      // 'then' block above is executed.
      xhr.status = 200;
      xhr.response = 'response';
      xhr.onload();
    });

    it('only adds the Content-Type header by deault', function() {
      store.remove('discussions', obj);

      expect(xhr.setRequestHeader).to.have.been.calledOnce
        .and.have.been.calledWith('Content-Type', 'application/json');
    });

    it('will add headers if Amygdala was initialized with some', function() {
      authStore.remove('discussions', obj);

      expect(xhr.setRequestHeader).to.have.been.calledTwice
        .and.have.been.calledWith('Authorization', 'alpha');
    });

  });

  describe('#findAll()', function() {

    it('can find a list of type', function() {
      expect(store.findAll('discussions'))
        .to.have.length(4);
    });

    it('can find a list of type with filters', function() {
      expect(store.findAll('discussions', {'intro': 'unicode'}))
        .to.have.length(1);
    });

  });

  describe('#find()', function() {

    it('can find an object by id', function() {
      expect(store.find('teams', '/api/v2/team/9/').name)
        .to.equal('Test Sandbox');
    });

    it('can find an object with filters', function() {
      expect(store.find('discussions', {'intro': 'unicode'}).title)
        .to.equal('unicode');
    });

  });

  describe('#orderBy', function() {

    it('can sort', function() {
      expect(store.findAll('discussions')[0].title)
        .to.equal('bleep bloop');
    });

    it('can reverse sort', function() {
      expect(store.find('discussions', {'intro': 'unicode'}).title)
        .to.equal('unicode');
    });

  });

  describe('custom idAttribute', function() {
    // clone the settings, so changes don't affect the other tests
    var customSettings = _.clone(settings);
    // make sure we clone config too, so it does not override
    // the default config for the other tests.
    customSettings.config = _.extend(_.clone(customSettings.config), {'idAttribute': 'id'});
    // instatiate the customStore
    var customStore = new Amygdala(customSettings);

    it('is sent on GET requests as part of the url and not as a query string', function() {
      customStore.get('teams', {'id': 31});

      expect(xhr.open).to.have.been.calledOnce
        .and.have.been.calledWith('GET', 'http://localhost:8000/api/v2/team/31', true);
    });

    it('is set on PUT requests as part of the url and not as data', function() {
      customStore.update('teams', {'id': 31});

      expect(xhr.open).to.have.been.calledOnce
        .and.have.been.calledWith('PUT', 'http://localhost:8000/api/v2/team/31', true);
    });

    it('is set on DELETE requests as part of the url and not as data', function() {
      customStore.remove('teams', {'id': 31});

      expect(xhr.open).to.have.been.calledOnce
        .and.have.been.calledWith('DELETE', 'http://localhost:8000/api/v2/team/31', true);
    });

  });

  /*
  describe('^events', function() {

    it('triggers a change:<type> event when an object of <type> is added', function() {
      var callback = sinon.spy();
      // register the event
      store.on('change:teams', callback);
      // trigger the event on add
      store._set('teams', {'name': 'The <type> Event Team'});

      expect(callback).to.have.been.calledOnce;
    });

    it('triggers a change event when an object is changed', function() {
      var callback = sinon.spy();
      // register the event
      store.on('change', callback);
      // trigger the event on add
      store._set('teams', {
        'url': '/api/v2/team/9/',
        'name': 'The Event Team'
      });

      expect(callback).to.have.been.calledOnce;
    });

    it('triggers one change event for multiple changes of the same type', function() {
      var callback = sinon.spy();
      // register the event
      store.on('change', callback);
      // trigger the event on add
      store._set('teams', {
        'url': '/api/v2/team/9/',
        'name': 'The Event Team'
      });
      store._set('teams', {
        'url': '/api/v2/team/10/',
        'name': 'Zee Loop'
      });

      expect(callback).to.have.been.calledOnce;
    });

    it('triggers two events for changes in different types', function() {
      var callback = sinon.spy();
      // register the event
      store.on('change', callback);
      // trigger the event on add
      store._set('teams', {
        'url': '/api/v2/team/9/',
        'name': 'The Event Team'
      });
      store._set('users', {
        'url': '/api/v2/user/10/',
        'name': 'Me Robot'
      });

      expect(callback).to.have.been.calledTwice;
    });

    it('triggers a change event when an object is deleted', function() {
      var callback = sinon.spy();
      // register the event
      store.on('change', callback);
      // trigger the event on add
      store._remove('teams', {
        'url': '/api/v2/team/9/',
        'name': 'The Event Team'
      });

      expect(callback).to.have.been.calledOnce;
    });

  });
  */

});
