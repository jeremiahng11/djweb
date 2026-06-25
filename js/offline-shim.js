// Offline shim: makes the game runnable straight from file:// (no server).
//
// Phaser loads atlases/fonts/audio/JSON via XMLHttpRequest, which browsers
// block on file:// URLs. Here we override the loader's URL resolver so any
// asset path it asks for is swapped for the matching inlined data: URI from
// offline-assets.js. data: URIs are exempt from the file:// XHR restriction,
// and Phaser's transformUrl already passes data:/http(s):/blob: through as-is.
(function () {
  if (typeof Phaser === "undefined" || !Phaser.Loader) return;
  var assets = window.__DJ_ASSETS || {};
  var original = Phaser.Loader.prototype.transformUrl;
  Phaser.Loader.prototype.transformUrl = function (url, file) {
    if (url && assets[url]) return assets[url];
    return original.call(this, url, file);
  };
})();
