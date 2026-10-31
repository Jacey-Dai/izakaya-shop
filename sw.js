/*
 * 小舟 · 离线缓存（PRD T-59）
 * 页面本身走“网络优先”，断网时用缓存；其余同源文件走“缓存优先”，没有时再联网并存一份。
 * 发布新版本时把 VERSION 改成和 index.html 的 ?v= 一样，旧缓存会在激活时删掉。
 */
const VERSION = "20261031-7";
const CACHE = "kobune-" + VERSION;
const CORE = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css?v=" + VERSION,
  "js/i18n.js?v=" + VERSION,
  "js/data.js?v=" + VERSION,
  "js/data.en.js?v=" + VERSION,
  "js/art.js?v=" + VERSION,
  "js/app.js?v=" + VERSION,
  "assets/favicon.svg",
  "assets/icon-192.png",
  "assets/art/izakaya-room.webp",
  "assets/art/tatami-room.webp",
  "assets/art/haruta.webp",
  "assets/art/guest-dolls.webp",
  "assets/art/guest-accessories.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("kobune-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 谷歌字体等外站资源：能联网就用，断网时浏览器退回系统字体
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("index.html", copy));
          return res;
        })
        .catch(() => caches.match("index.html")),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    })),
  );
});
