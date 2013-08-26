
onfetch = function(event) {
    console.log("Fetch event: ", event);
    var cache = new Cache("cats",
                          "creepy-cat-1.jpeg",
                          "creepy-cat-2.jpeg");
    if (/cat.*jpeg$/.exec(event.request.url)) {
        event.request.url = event.request.url.replace("cute", "creepy");
        console.log("Found cute cat, replacing with ", event.request.url);
        var response = cache.match(event.request);
        response.then(function(v) {
            console.log("From cache for ", event.request.url, ": ", v);
            return v;
        });
        event.respondWith(response);
    }
};
