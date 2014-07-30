Amygdala
========

Amygdala is a RESTful HTTP client for JavaScript powered web applications. Simply configure it once
with your API schema, and easily do GET, POST, PUT and DELETE requests with minimal effort and a consistent API.
Amygdala also handles session-based caching on the browser for fast access to your data, and
aims to have offline through indexedDB and localStorage.

[![browser support](https://ci.testling.com/lincolnloop/amygdala.png)
](https://ci.testling.com/lincolnloop/amygdala)

## The overview

Amygdala requires you to define a schema of how your API and data relations
look like. With the schema defined, Amygdala gives you some very **simple
methods to access your API**, and **stores the data locally** in the browser
session (and eventually in localStorage) for **easy and fast data access**.

NOTE: Amygdala is under heavy development, and schema support is limited.

## How it works

### 1. Install Amygdala

If you're using npm, you can just `npm install amygdala`. Otherwise, download
the browser version of from the [dist directory](https://github.com/lincolnloop/amygdala/tree/master/dist).

### 2. Create your instance and define your schema

```javascript
  var store = new Amygdala({
    'config': {
      'apiUrl': 'http://localhost:8000',
      'idAttribute': 'url',
      'headers': {
        'X-CSRFToken': getCookie('csrftoken')
      },
      'localStorage': true
    },
    'schema': {
      'users': {
        'url': '/api/v2/user/'
      },
      'teams': {
        'url': '/api/v2/team/',
        'orderBy': 'name',
        'oneToMany': {
          'members': 'members'
        }
      },
      'members': {
        'foreignKey': {
          'user': 'users'
        }
      }
    }
  });

```

### 3. Use it

```javascript

  // Get a list of users from the remote server
  var users = store.get('users');

  // Get the list of active users from the local cache
  var users = store.findAll('users', {'active': true});

  // Get a single user from the local cache
  var user = store.find('users', {'username': 'amy82'});

  // Add a new user
  store.add('users', {'username': 'gdala67', 'active': false});

  // update an existing user
  // NOTE: At the moment we rely on the url attribute containing
  // the API endpoint for the user.
  store.update('users', {'url': '/api/v2/user/32/', 'active': true});

  // delete a user
  store.remove('users', {'url': '/api/v2/user/32/'});

```

## Configuration

Here are the few configuration settings you can set:

* apiUrl // your base API url (protocol, domain name, port).
* idAttribute // if you want to use a custom "primary key"
* headers // holds a key/value list of headers to be sent on every request
* localStorage // If set to `true`, all your data will be persist across sessions (read-only).

## Events

Amygdala uses [https://www.npmjs.org/package/event-emitter](Event Emitter) under the hood
to trigger some very basic events. Right now it only triggers two different events:

* change
* change:type

To listen to these events, you can use any of [https://www.npmjs.org/package/event-emitter](Event Emitter)'s binding methods, the most common being `on`:

```javascript

  // Listen to any change in the store
  store.on('change', function() { ... });

  // Listen to any change of a specific type
  store.on('change:users', function() { ... });

```