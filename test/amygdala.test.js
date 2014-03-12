/* global describe, it, before */
'use strict';

var expect = require('chai').expect;
var Amygdala = require('../amygdala');

// fixtures
var teamFixtures = require('./fixtures/teams');
var userFixtures = require('./fixtures/users');
var discussionFixtures = require('./fixtures/discussions');

describe('Amygdala Tests', function() {

  var store;

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
    // TODO: get a better API in place without needing AJAX requests
    // to populate the store.
    store._set('users', userFixtures);
    store._set('teams', teamFixtures);
    store._set('discussions', discussionFixtures);
  });

  describe('#_set', function() {

    it('loads simple models correctly', function() {
      expect(Object.keys(store._store['teams'])).to.have.length(1);
    });

    it('populates tables based on one-to-many relations', function() {
      expect(Object.keys(store._store['members'])).to.have.length(3);
    });

    it ('replaces objects by id\'s in one-to-many relations', function() {
      expect(
        store._store.teams['/api/v2/team/9/'].members
          .indexOf('/api/v2/team/9/member/f31abb30271cdecae75a6227128c8fd9/')
      ).to.not.equal(-1);
    });

    it ('replaces objects by id\'s in foreign-key relations', function() {
      expect(
        store._store.discussions['/api/v2/discussion/595/'].message
      ).to.equal('/api/v2/message/3798/');
    });

    it ('uses data parsers when they are defined', function() {
      // discussions have a non-standard data structure due to pagintation,
      // so the schema provides a `parse` method.
      // for storage purposes we only want the objects, not the meta data.
      expect(Object.keys(store._store['discussions'])).to.have.length(4);
    });

  });

  describe('#findAll()', function() {

    it('can find a list of type', function() {
      expect(
        store.findAll('discussions')
      ).to.have.length(4);
    });


    it('can find a list of type with filters', function() {
      expect(
        store.findAll('discussions', {'intro': 'unicode'})
      ).to.have.length(1);
    });

  });

  describe('#find()', function() {

    it('can find an object by id', function() {
      expect(
        store.find('teams', '/api/v2/team/9/').name
      ).to.equal('Test Sandbox');
    });

    it('can find an object with filters', function() {
      expect(
        store.find('discussions', {'intro': 'unicode'}).title
      ).to.equal('unicode');
    });

  });

});
