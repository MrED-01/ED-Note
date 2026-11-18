/* ED Note service worker: works offline, picks up new versions when online. */
const CACHE = "ednote-v6.9.9c";
const SHELL = ["./", "index.html", "style.css", "app.js", "config.js", "manifest.webmanifest",
  "vendor/pdf.min.js", "vendor/pdf.worker.min.js", "vendor/jszip.min.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png", "icons/favicon.svg", "icons/logo.svg",
  "vendor/pdf-lib.min.js", "vendor/fontkit.umd.min.js", "vendor/fonts/DejaVuSans.ttf", "vendor/fonts/DejaVuSans-Bold.ttf", "vendor/fonts/ed/fonts.css", "vendor/mathjax/tex-svg.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const isVendor = req.url.includes("/vendor/") || req.url.includes("/icons/");
  if (isVendor){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
    return;
  }
  /* always ask the server whether the app changed (cheap: an unchanged file answers "not modified"), so a new version shows up at once */
  e.respondWith(fetch(req, { cache:"no-cache" }).then(res => {
    if (res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch:true }).then(hit => hit || caches.match("index.html"))));
});
