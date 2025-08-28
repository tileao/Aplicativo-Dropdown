
const CACHE = "aw139-ux-v7";
const ASSETS = ["./","./index.html","./app.js","./styles.css","./manifest.json","./db.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE && caches.delete(k)))); });
self.addEventListener("fetch", e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
