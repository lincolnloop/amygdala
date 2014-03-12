Amygdala
========

Amygdala is a library for API driven web applications that makes it simple to
query your API server and also handles offline and session caching on the browser.

## The overview

Amygdala requires you to define a schema of how your API and data relations look like.
With the schema defined, Amygdala gives you some very `simple methods to access your API`,
and `stores the data locally` in the browser session (and eventually in localStorage) for
`easy and fast data access`. 

NOTE: Amygdala is under heavy development, and schema support is limited.

## How it works

### 1. Install Amygdala

If you're using npm, you can just `npm install amygdala`. Otherwise download amygdala.js from the [github repo](https://github.com/lincolnloop/amygdala).

### 2. Create your instance and define your schema

```javascript
  var store = new Amygdala({
    'apiUrl': 'http://localhost:8000',
    'idAttribute': 'url',
    'users': {
      'url': '/api/v2/user/'
    },
    'teams': {
      'url': '/api/v2/team/',
      'oneToMany': {
        'members': 'members'
      }
    },
    'members': {
      'foreignKey': {
        'user': 'users'
      }
    },
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