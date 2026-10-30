// Service Worker: hält die ganze App inkl. Barcode- und Texterkennung offline bereit.
const VERSION = 'kk-v3';
const ASSETS = [
  './', 'index.html', 'app.css', 'app.js', 'profiles.js', 'sujets.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'vendor/zxing.min.js', 'vendor/JsBarcode.all.min.js', 'vendor/qrcode.js',
  'vendor/ocr/tesseract.min.js', 'vendor/ocr/worker.min.js',
  'vendor/ocr/tesseract-core-simd-lstm.wasm.js', 'vendor/ocr/tesseract-core-lstm.wasm.js',
  'vendor/ocr/deu.traineddata.gz',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache zuerst, Netzwerk nur als Ergänzung
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
