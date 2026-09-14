/* Офлайн-кэш.

   Файлы приложения (страница, скрипты, стили) берём сначала из сети: иначе
   после обновления на экране остаётся старая версия, пока кэш не протухнет.
   Файлы данных (иероглифы, слова, звук) неизменны внутри версии, поэтому их
   отдаём из кэша сразу — это и делает приложение быстрым и рабочим без сети. */
var CACHE = 'hanzi-v3';

/** Файлы самого приложения — их всегда проверяем в сети. */
function isShell(url) {
  var p = url.pathname;
  return p.charAt(p.length - 1) === '/' ||
    /\/(index\.html|app\.js|app\.css|store\.js|writer\.js|manifest\.json)$/.test(p);
}

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isShell(url)) {
    // сеть вперёд: свежая версия сразу, кэш — запасной вариант без сети
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('index.html') || Response.error();
        });
      })
    );
    return;
  }

  // данные: из кэша сразу, обновление подтягиваем в фоне
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }).catch(function () { });
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
