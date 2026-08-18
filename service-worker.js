// Service worker: cache "khung" app (app shell) để mở được PWA khi mất mạng.
// Dữ liệu (giao dịch, ví...) KHÔNG cache ở đây - được quản lý riêng bằng
// localStorage + hàng đợi đồng bộ trong app.js.
//
// QUY ƯỚC: đổi CACHE_NAME mỗi khi bump APP_VERSION trong config.js, để
// trình duyệt biết app đã có bản mới và tải lại app shell thay vì dùng
// bản cache cũ.

const CACHE_NAME = "projectfinance-shell-v1.03";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Không can thiệp vào các gọi API của Google (auth, sheets, drive) -
  // luôn để chúng đi thẳng ra mạng, KHÔNG cache.
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("google.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return;
  }

  // App shell: cache-first, fallback network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match("./index.html"));
    })
  );
});
