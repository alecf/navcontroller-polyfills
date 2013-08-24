
LOG = [];

onfetch = function(event) {
    LOG.push(["Fetch event: ", event]);
    var cache = new Cache("cats",
                          "creepy-cat-1.jpeg",
                          "creepy-cat-2.jpeg");
    if (/cat.*jpeg$/.exec(event.request.url)) {
        event.request.url = event.request.url.replace("cute", "creepy");
        LOG.push("Found cute cat, replacing with ", event.request.url);
        event.respondWith(cache.match(event.request));
    }
};
