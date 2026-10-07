/* Пудриера PWA service worker — offline app shell + runtime caching.
   Works only over a secure context (https or http://localhost), not file://. */
'use strict';

var VERSION = 'v2';
var SHELL   = 'pud-shell-' + VERSION;     // app shell (precached)
var RUNTIME = 'pud-runtime-' + VERSION;   // product photos + fonts (cached on use)
var RUNTIME_MAX = 400;

var SHELL_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/data.js',
  './js/icons.js',
  './js/store.js',
  './js/components.js',
  './js/pages.js',
  './js/router.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL)
      .then(function (c) { return c.addAll(SHELL_ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== RUNTIME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function trim(cache) {
  cache.keys().then(function (keys) {
    if (keys.length > RUNTIME_MAX) cache.delete(keys[0]).then(function () { trim(cache); });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(RUNTIME).then(function (c) { c.put(req, copy); trim(c); });
      }
      return res;
    });
  });
}

/* own files: serve fresh when online, fall back to the cache offline */
function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(SHELL).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (url.hostname === 'cdn.shopify.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
});
