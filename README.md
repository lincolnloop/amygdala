![Amygdala logo](https://raw.githubusercontent.com/lincolnloop/amygdala/master/static/logo.png)

Amygdala is a RESTful HTTP library for JavaScript powered web applications. Simply configure it once with your API schema, and easily do GET, POST, PUT and DELETE requests with minimal effort and a consistent API.

Examples:

```javascript
// GET
store.get('users').done(function() { ... });

// POST
store.add('teams', {'name': 'Lincoln Loop', 'active': true}).done(function() { ... });
```

[![browser support](https://ci.testling.com/lincolnloop/amygdala.png)
](https://ci.testling.com/lincolnloop/amygdala)

## How it works

### 1. INSTALL


#### NPM/Browserify

`npm install amygdala`.


#### Bower

`bower install amygdala`


#### Browser

Download the latest [amygdala.js](https://github.com/lincolnloop/amygdala/blob/master/amygdala.js) file. Minified/build version coming soon.

##### Dependencies:

* [underscore](https://github.com/jashkenas/underscore): ^1.6.0
* [q](https://github.com/kriskowal/q): ^1.0.1
* [Wolfy87/EventEmitter](https://github.com/Wolfy87/EventEmitter): ^4.2.6


### 2. SETUP

To create a new store, define the few possible settings listed below and your API schema.

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
      },
      parse: function(data) {
        return data.results ? data.results : data;
      },
    },
    'members': {
      'foreignKey': {
        'user': 'users'
      }
    }
  }
});
```

#### Configuration options:

  * apiUrl - Full path to your base API url (required).
  * idAttribute - global primary key attribute (required). 
  * headers - Any headers that you need to pass on each API request.
  * localStorage - enable/disable the persistent localStorage cache.

#### Schema options:
  
  * url - relative path for each "table" (required)
  * orderBy - order by which you want to retrieve local cached data. eg (name, -name (for reverse))
  * parse - Accepts a parse method for cases when your API also returns extra meta data.
  * idAttribute - overrides key attribute (if different in this schema)


#### Schema relations:

When you want to include related data under a single request, for example, to minimize HTTP requests, having schema relations allows you to still have a clean separation when interacting with the data locally.

Consider the following schema, that defines discussions that have messages, and messages that have votes:

```javascript
var store = new Amygdala({
    'config': {
      'apiUrl': 'http://localhost:8000',
      'idAttribute': 'url'
    },
    'schema': {
      'discussions': {
        'url': '/api/v2/discussion/',
        'oneToMany': {
          'children': 'messages'
        }
      },
      'messages': {
        'url': '/api/v2/message/',
        'oneToMany': {
          'votes': 'votes'
        },
        'foreignKey': {
          'discussion': 'discussions'
        }
      },
      'votes': {
        'url': '/api/v2/vote/'
      }
    }
  }
);
```

In this scenario, doing a query on a discussion will retrieve all messages and votes for that discussion:

```javascript
store.get('discussions', {'url': '/api/v2/discussion/85273/'}).then(function(){ ... });
```

Since we defined relations on our schema, the message and vote data won't be stored on the discussion "table", but on it's own "table" instead.

##### OneToMany:

```javascript
'oneToMany': {
  'children': 'messages'
}
```

`OneToMany` relations are the most common, and should be used when you have related data in form of an array. In this case, `children` is the attribute name on the response, and `messages` is the destination "table" for the array data.


##### foreignKey:

```javascript
'foreignKey': {
  'discussion': 'discussions'
}
```

`foreignKey` relations are basically for one to one relations. In this case Amygdala will look for an object as value of `discussion` and move it over to the `discussions` "table" if one is found.


### 3. USAGE

#### Querying the remote API server:

The methods below, allow you to make remote calls to your API server.

```javascript
// GET
store.get('users').done(function() { ... });

// POST
store.add('teams', {'name': 'Lincoln Loop', 'active': true}).done(function() { ... });

// PUT
store.update('users', {'url': '/api/v2/user/32/', 'username': 'amy82', 'active': true}).done(function() { ... });

// DELETE
store.remove('users', {'url': '/api/v2/user/32/'}).done(function() { ... });
```


#### In memory storage API:

On top of this, Amygdala also stores a copy of your data locally, which you can access through a couple different methods:


###### Find and filtering:

```javascript
// Get the list of active users from memory
var users = store.findAll('users', {'active': true});

// Get a single user from memory
var user = store.find('users', {'username': 'amy82'});

// Get a single user by id for memory
var user = store.find('users', 1103747470);
```

If you enable `localStorage`, the data is kept persistently. Because of this, once you instantiate Amygdala, your cached data will be loaded, and you can use it right away without having to wait for the remote calls. (We do not recommend using `localStorage` for production yet)


##### Fetching related data:

By defining your schema and creating relations between data, you are then able to query your data objects for the related objects.

In the example schema above, discussions have a oneToMany relation with messages, and messages have a foreignKey relation back to discussions. This is how it you can use them.

```javascript
// Fetching related messages for a discussion (oneToMay)
var messages = store.find('discussions', '/api/v2/discussion/85273/').getRelated('messages');

// Getting the discussion object from a message (foreignKey)
var discussion = store.find('message', '/api/v2/message/81273/').getRelated('discussion');
```

Note that Amygdala doesn't fetch data automagically for you here, so it's up you to fetch it before running the query.

## Events

Amygdala uses [Wolfy87/EventEmitter](https://github.com/Wolfy87/EventEmitter) under the hood
to trigger some very basic events. Right now it only triggers two different events:

* change
* change:type

To listen to these events, you can use any of [Event Emitter's](https://github.com/Wolfy87/EventEmitter/blob/master/docs/guide.md#using-eventemitterr) binding methods or the [aliases](https://github.com/Wolfy87/EventEmitter/blob/master/docs/guide.md#method-aliases), the most common one being `on`:

```javascript
// Listen to any change in the store
store.on('change', function() { ... });

// Listen to any change of a specific type
store.on('change:users', function() { ... });
```
