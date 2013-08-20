function log(type, args) {
    args = Array.prototype.slice.call(args);
    var logbody = document.querySelector('#log');
    var line = document.createElement('div');
    line.setAttribute('class', type);
    logbody.appendChild(line);
    console[type].apply(console, args);
    for (var i = 0; i < args.length; ++i) {
        var span = document.createElement('span');
        line.appendChild(span);
        span.innerText = "" + args[i];
    }
}

function debug() {
    log('debug', arguments);
}
function error() {
    log('error', arguments);
}

function test() {
    var promises = [];
    function savepromise(p) {
        promises.push(p);
    }
    debug("Creating cache..");
    var caches = new CacheList();
    debug("Grabbing cache 'main'");
    var main = caches.get("main");
    debug("Adding file1.txt to the cache");
    var p;
    p = main.add("file1.txt").then(function(response) {
        debug("  file1.txt loaded and placed in cache: ", response);
    });
    savepromise(p);
    debug("Fetching file1.txt");
    p = main.match("file1.txt").then(
        function(response) {
            debug("  file1.txt loaded from the cache: ", response);
        },
        function(error) {
            debug("  file1.txt not found in cache: ", error);
        });
    savepromise(p);
    debug("=====");
    debug("Creating new cache");
    cache = new Cache("shellResources", "file1.txt", "file2.txt", "file3.txt");
    p = cache.match("file2.txt").then(function(response) {
        debug("Have file2.txt: ", response);
        return response;
    }).catch(function(ex) {
        error("Error from cache: ", ex, " in ", ex.stack);
    });
    savepromise(p);

    Promise.every.apply(Promise, promises).then(function(results) {
        debug("Done with ", results.length, " results");
    });
}