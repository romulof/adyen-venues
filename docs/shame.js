/**
 * Here I hide all the bad thing needed to run on IE9
 */

!(function(){ // Protect global scope with an IIFE
  // Crappy polyfill to allow IE9 to do CORS
  window.fetchJson = function fetchJson(url) {
    return new Promise(function (resolve, reject) {
      var xdr = new XDomainRequest();
      xdr.open("get", url);
      
      xdr.onprogress = function (e) {}
      xdr.ontimeout = function (e) { reject('timeout'); };
      xdr.onerror = reject
      xdr.onload = function() {
        var status = xdr.status === undefined ? 200 : xdr.status;
        if (status < 200 || status >= 300) {
          reject(xdr);
          returnl
        }
        var body = 'response' in xdr ? xdr.response : xdr.responseText;
        var data = JSON.parse(body);
        resolve(data);
      };

      setTimeout(function () {
        xdr.send();
      }, 0);
    });
  }
})();
