
if (!('Request' in this))
    Request = function() {};


function CacheList() {
    this.caches = {};
}

CacheList.prototype._getCache = function(cache_name) {
    if (!(cache_name in this.caches))
        this.caches[cache_name] = new Cache(cache_name);
    return this.caches[cache_name];
};

CacheList.prototype.forEach = function(callback) {
    for (var name in this.caches) {
        callback(name, this.caches[name], this);
    }
};

CacheList.prototype.delete = function(name) {
    if (name in this.caches)
        delete this.caches.name;
};

CacheList.prototype.match = function(cache_name, url) {
    return this._getCache(cache_name).match(url);
};

CacheList.prototype.get = function(cache_name) {
    return this._getCache(cache_name);
};

CacheList.prototype.set = function(cache_name, cache) {
    if (cache.name != cache_name)
        throw "Cache names must match [polyfill restriction]";
    if (cache_name in this.caches &&
        this.caches[cache_name] !== cache)
        throw "Already have a cache named '" + cache_name + "'";

    this.caches[cache_name] = cache;
    return cache;
};

// translates a string or a request object into an object with a .url
// property
function _getRequest(urlOrRequest) {
    if (urlOrRequest.url) return urlOrRequest;
    var request = new Request();
    request.url = urlOrRequest;
    request.method = 'GET';
    return request;
}

// This differs slightly from the the explainer, in that the 'name' is
// passed as the first parameter - vastly simplified the implementation.
function Cache(name /*, url, url, ...*/) {
    var cache = this;
    var requestsOrUrls = Array.prototype.slice.call(arguments, 1);
    this.name = name;

    // These are promises we want to resolve before any future cache action.
    var pending = [];
    this.readyPromise = this._open().then(function(cache) {
        return cache._add(requestsOrUrls).then(function(addresults) {
            return addresults;
        });
    }).then(function(results) {
        // throw away the pending promises
        return cache;
    }).catch(function(e) {
        lasterr = e;
    });
}

// TODO - a basic cache consistency thing needs to be exposed here,
// since our promises may include network requests that may result in our gets/puts
// being executed slightly out of order from IDB itself.
//
// Consider:
// p1 = cache.add("http://google.com/");
// p2 = cache.match("http://google.com/");
//
// The add step may actually mean:
// networkFetch("http://google.com/").then(saveToIDB)
//
// But I think the effect we want is that p2 resolves after p1, which
// is how IDB works. Not sure.
//
// If this is how it should be implemented, then all outstanding
// requests need to be (functionally, if not actually) resolved before
// resolution of the next promise.
//
// Here is what needs to happen to make that work:
//
// 1) every time this api creats a new promise to write, it needs to
//    add it to a 'pending' list on Cache.
//
// 2) The first thing that such a promise needs to do when resolved is clear
//    itself from the pending promises list.
//
// 3) Every time ready() is called, we snapshot the outstanding
//    promises, and call Q.all() on them, probably returning that
//    here.
//
// [1] because promises are resolved with a separate resolver function, resolution doesn't technically even need to run until the first person calls then(), so
Cache.prototype.ready = function() {
    return this.readyPromise;
};

Cache.prototype._open = function () {
    var cache = this;
    if (!cache.db) {
        cache.db = new Promise(function(resolver) {
            var openReq = indexedDB.open("cache-" + cache.name, 1);
            openReq.onupgradeneeded = function(e) {
                var db = e.target.result;
                db.createObjectStore(cache.name);
            };
            openReq.onsuccess = function(e) {
                var db = cache.db = e.target.result;
                resolver.resolve(cache);
            };
            openReq.onerror = function(e) {
                resolver.reject("Error opening " + cache.name + ": " + e.name);
            };
        });
    }
    return cache.db;
};


// _get and _set are generic wrappers around idb, that assume the db is open and ready.
Cache.prototype._get = function(key) {
    var cache = this;
    return new Promise(function(resolver) {
        var req = cache.db.transaction(cache.name)
                .objectStore(cache.name).get(key);
        req.onsuccess = function(e) {
            var result = {
                request: e.target.result.request,
                response: cache._makeResponse(e.target.result.response)
            };
            resolver.resolve(result);
        };
        req.onerror = function(e) {
            resolver.reject("Error in _get for " + key + ": " + e.name);
        };
    });
};

Cache.prototype._set = function(key, value) {
    var cache = this;
    return new Promise(function(resolver) {
        var req = cache.db.transaction(cache.name, 'readwrite')
                .objectStore(cache.name).put(value, key);
        req.onsuccess = function(e) {
            resolver.resolve(e.target.result);
        };
        req.onerror = function(e) {
            resolver.reject("Error in _get for " + key + ": " + e.name);
        };
    });
};

Cache.prototype._getKeys = function() {
    var cache = this;
    return new Promise(function(resolver) {
        var req = cache.db.transaction(cache.name)
                .objectStore(cache.name).openCursor();
        var resultkeys = [];
        req.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor == null) {
                resolver.resolve(resultkeys);
                return;
            }
            resultkeys.push(cursor.key);
            cursor.continue();
        };
        req.onerror = function(e) {
            resolve.reject(e);
        };
    });
};

// Not sure what iteration looks like, so for now we just iterate here
Cache.prototype.getKeys = function() {
    return this.ready().then(function(cache) {
        return cache._getKeys();
    });
};

Cache.prototype._makeResponse = function (responseObj) {
    var response = new SameOriginResponse();
    for (var k in responseObj)
        response[k] = responseObj[k];
    if ('setHeader' in response) {
        responseObj.headers.forEach(function(header) {
            response.setHeader(header[0], header[1]);
        });
    }
    if ('setBody' in response) {
        response.setBody(response.body);
    }
    return response;
};

// Gives a response object suitable for passing to respondWith()
Cache.prototype.match = function(url) {
    var cache = this;
    return this.ready()
        .then(function(cache) {
            return cache._get(url).response;
        });
};

// Gets the full entry, including a request and response object
Cache.prototype.get = function(url) {
    var cache = this;
    return this.ready()
        .then(function(cache) {
            return cache._get(url);
        });
};

// This returns a callback which binds the request to the response
Cache.prototype._setResponse = function(request) {
    var cache = this;
    request = JSON.parse(JSON.stringify(request));
    return function(response) {
        response = JSON.parse(JSON.stringify(response));
        return cache._set(request.url,
                          { request: request, response: response });
    };
};

// Given a set of requests, fetch them and store them in the cache.
Cache.prototype._add = function(requests) {
    var pending = [];
    var cache = this;
    for (var i = 0; i < requests.length; ++i) {
        var request = _getRequest(requests[i]);
        pending.push(networkFetch(request.url)
                     .then(cache._setResponse(request)));
    }
    return Promise.every.apply(Promise, pending);
};

// Add one or more urls to the cache.
Cache.prototype.add = function(/* request, request, request, ...*/) {
    var requests = arguments;
    return this.ready().then(function(cache) {
        var result = cache._add(requests);
        if (requests.length == 1)
            return result[0];
        return result;
    });
};

Cache.prototype.addResponse = function(urlOrRequest, response) {
    var request = _getRequest(urlOrRequest);
    return this.ready().then(function(cache) {
        request = JSON.parse(JSON.stringify(request));
        response = JSON.parse(JSON.stringify(response));
        cache._set(request.url, { request: request, response: response });
    });
};
