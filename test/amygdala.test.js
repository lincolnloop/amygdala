/* global describe, it, before, after, beforeEach */
'use strict';

var _ = require('underscore');
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

  var schema = {
    // TODO: Mock API
    'apiUrl': 'http://localhost:8000',
    'idAttribute': 'url',
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
        'attachments': 'attachments'
      },
      'foreignKey': {
        'user': 'users',
        'discussion': 'discussions'
      }
    }
  };

  before(function() {
    store = new Amygdala(schema);
    store._set('users', userFixtures);
    store._set('teams', teamFixtures);
    store._set('discussions', discussionFixtures);

    var headers = {'Authorization': 'alpha'};
    authStore = new Amygdala(schema, {'headers': headers});
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

    it('uses data parsers when they are defined', function() {
      // discussions have a non-standard data structure due to pagintation,
      // so the schema provides a `parse` method.
      // for storage purposes we only want the objects, not the meta data.
      expect(Object.keys(store._store['discussions'])).to.have.length(4);
    });

    it('attempts to parse JSON if the format of the response is a string', function() {
      // Create an empty store for this test
      var jsonStore = new Amygdala(schema);

      // Set the users with a JSON string
      jsonStore._set('users', JSON.stringify(userFixtures));

      expect(Object.keys(jsonStore._store['users'])).to.have.length(3);
      expect(_.pluck(jsonStore._store['users'], 'name')).to.contain('Brandon Konkle');
    });

    it('will throw an error including the string if the JSON parse fails', function() {
      expect(false).to.be.true;
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
      expect(xhr.open).to.have.been.calledWith('PUT', '/draenor/', true);
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
    var obj = {'title': 'Garrosh', 'url': '/orgrimmar/'};

    it('triggers an Ajax DELETE request', function() {
      store.remove('messages', obj);

      expect(xhr.open).to.have.been.calledOnce;
      expect(xhr.open).to.have.been.calledWith('DELETE', '/orgrimmar/', true);
      expect(xhr.send).to.have.been.calledOnce;
      expect(xhr.send).to.have.been.calledWith(JSON.stringify(obj));
    });

    it('calls #_remove() with the given type', function(done) {
      var originalRemove = store._remove;
      store._remove = sinon.spy();

      store.remove('messages', obj)
        .then(function() {
          expect(store._remove).to.have.been.calledWith('messages', 'response');

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

    it('only adds the Content-Type header by deault', function() {
      store.remove('messages', obj);

      expect(xhr.setRequestHeader).to.have.been.calledOnce
        .and.have.been.calledWith('Content-Type', 'application/json');
    });

    it('will add headers if Amygdala was initialized with some', function() {
      authStore.remove('messages', obj);

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

});
