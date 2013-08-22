// Polyfill for networkFetch() API. Does not handle cross-origin
// requests, because it uses XHR to emulate.
if (!('SameOriginResponse' in this))
    SameOriginResponse = function() { };

function networkFetch(urlOrRequest) {
    function createBlob(msg, type) {
        type = type ? type : "text/plain";
        return new Blob([msg], {"type" : type});
    }
    return new Promise(function(resolver) {
        var url;
        var method = 'GET';
        var body;
        if (typeof urlOrRequest == "string") {
            url = urlOrRequest;
        } else {
            url = urlOrRequest.url;
            method = urlOrRequest.method || method;
            body = urlOrRequest.body;
        }
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        if (body)
            xhr.send(body);
        else
            xhr.send();
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                try {
                    var response = new SameOriginResponse();
                    // need to .reject based on statusCode?
                    response.statusCode = xhr.status;
                    response.statusText = xhr.statusText;
                    response.encoding = '';
                    response.method = method;

                    var headers = xhr.getAllResponseHeaders().split('\n'); //probably should be a dict?
                    response.headers = headers;
                    if ('setHeader' in response) {
                        for (var i = 0; i < headers.length; ++i) {
                            if (!headers[i])
                                continue;
                            var kv = response.headers[i].split(':');
                            if (kv && kv.length > 1) {
                                response.setHeader(kv[0], kv[1].slice(1).trim());
                                LOG.push("Setting header = " + kv[0] +
                                         ": '" + kv[1].slice(1).trim() + "'");
                            }
                        }
                    }
                    response.body = xhr.response;
                    if ('setBody' in response)
                        response.setBody(createBlob(xhr.response, xhr.getResponseHeader('content-type')));
                    resolver.fulfill(response);
                } catch (e) {
                    resolver.reject(e);
                }
            }
        };
    });
}
