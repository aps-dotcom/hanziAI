/* =====================================================================
   HZ — данные, прогресс, интервальное повторение, звук, сохранность.

   Прогресс живёт в localStorage этого устройства. Если задан код доступа,
   он шифруется AES-GCM ключом, выведенным из кода (PBKDF2); сам код нигде
   не хранится. Рядом держатся три последние резервные копии.
   ================================================================== */
(function () {
  'use strict';

  var KEY = 'hz.v1';
  var LOCK = 'hz.lock';
  var BAK = 'hz.bak';
  var SESS = 'hz.session';
  var DAY = 86400000;

  /* =============================================== загрузка чанков */
  window.HZ_GR = window.HZ_GR || {};
  window.HZ_DET = window.HZ_DET || {};
  window.HZ_AU = window.HZ_AU || {};

  var waiters = {};     // ключ -> [{res, rej}]
  var loaded = {};
  var tries = {};

  window.hzChunk = function (kind, n) {
    var k = kind + n;
    loaded[k] = true;
    if (waiters[k]) {
      var w = waiters[k];
      waiters[k] = null;
      w.forEach(function (p) { p.res(); });
    }
  };

  function loadChunk(kind, n) {
    var k = kind + n;
    if (loaded[k]) return Promise.resolve();
    if (waiters[k]) {
      return new Promise(function (res, rej) { waiters[k].push({ res: res, rej: rej }); });
    }
    waiters[k] = [];
    var p = new Promise(function (res, rej) {
      waiters[k].push({ res: res, rej: rej });
      inject(k, kind, n, 0, rej);
    });
    return p;
  }

  function inject(k, kind, n, attempt, rej) {
    var s = document.createElement('script');
    s.src = 'data/' + kind + '-' + n + '.js' + (attempt ? '?r=' + attempt : '');
    s.async = true;
    s.onerror = function () {
      s.remove();
      if (attempt < 2) {
        setTimeout(function () { inject(k, kind, n, attempt + 1, rej); }, 700 * (attempt + 1));
        return;
      }
      var w = waiters[k];
      waiters[k] = null;
      tries[k] = (tries[k] || 0) + 1;
      var err = new Error('Не удалось загрузить данные (' + kind + '-' + n + ')');
      if (w) w.forEach(function (q) { q.rej(err); });
      else rej(err);
    };
    document.head.appendChild(s);
  }

  /* ======================================================= индекс */
  var IDX = [], BY = {}, POS = {};
  function initIndex() {
    IDX = window.HZ_INDEX || [];
    BY = {}; POS = {};
    IDX.forEach(function (r, i) { BY[r[0]] = r; POS[r[0]] = i; });
  }

  /* ====================================================== пиньинь */
  var TONE_MARKS = {
    'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4, 'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
    'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4, 'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
    'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4, 'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4,
    'ń': 2, 'ň': 3, 'ǹ': 4, 'ḿ': 2
  };
  var PLAIN = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a', 'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i', 'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
    'ü': 'v', 'ń': 'n', 'ň': 'n', 'ǹ': 'n', 'ḿ': 'm'
  };
  function toneOf(py) {
    for (var i = 0; i < py.length; i++) if (TONE_MARKS[py[i]]) return TONE_MARKS[py[i]];
    return 5;
  }
  function plainPy(py) {
    var out = '';
    for (var i = 0; i < py.length; i++) out += (PLAIN[py[i]] || py[i]);
    return out.toLowerCase();
  }
  var TONE_RU = {
    1: ['1-й тон', 'ровный высокий — ā'],
    2: ['2-й тон', 'восходящий — á'],
    3: ['3-й тон', 'низкий с подъёмом — ǎ'],
    4: ['4-й тон', 'резко нисходящий — à'],
    5: ['нейтральный', 'лёгкий, без тона']
  };

  /* ========================================================= звук */
  var audioCache = {};
  var audioEl = null;
  function playKey(key) {
    if (!key) return Promise.resolve(false);
    var chunk = (window.HZ_AUMAP || {})[key];
    if (chunk == null) return Promise.resolve(false);
    return loadChunk('au', chunk).then(function () {
      var b64 = (window.HZ_AU[chunk] || {})[key];
      if (!b64) return false;
      if (!audioCache[key]) audioCache[key] = 'data:audio/mpeg;base64,' + b64;
      try {
        if (!audioEl) audioEl = new Audio();
        audioEl.pause();
        audioEl.src = audioCache[key];
        audioEl.currentTime = 0;
        var p = audioEl.play();
        if (p && p.catch) p.catch(function () { });
      } catch (e) { return false; }
      return true;
    }).catch(function () { return false; });
  }

  /** Проиграть слоги подряд — так звучит слово целиком. */
  function playSeq(keys, gap) {
    keys = (keys || []).filter(Boolean);
    if (!keys.length) return Promise.resolve(false);
    gap = gap == null ? 90 : gap;
    var stop = false;
    seqStop = function () { stop = true; };
    return keys.reduce(function (chain, key, i) {
      return chain.then(function (okAll) {
        if (stop) return okAll;
        return playKeyWait(key).then(function (ok) {
          if (i < keys.length - 1 && !stop) {
            return new Promise(function (r) { setTimeout(function () { r(okAll && ok); }, gap); });
          }
          return okAll && ok;
        });
      });
    }, Promise.resolve(true));
  }
  var seqStop = null;

  /** Как playKey, но ждёт окончания записи. */
  function playKeyWait(key) {
    var chunk = (window.HZ_AUMAP || {})[key];
    if (chunk == null) return Promise.resolve(false);
    return loadChunk('au', chunk).then(function () {
      var b = (window.HZ_AU[chunk] || {})[key];
      if (!b) return false;
      if (!audioCache[key]) audioCache[key] = 'data:audio/mpeg;base64,' + b;
      return new Promise(function (res) {
        try {
          var a = new Audio(audioCache[key]);
          var done = false;
          var fin = function (ok) { if (!done) { done = true; res(ok); } };
          a.onended = function () { fin(true); };
          a.onerror = function () { fin(false); };
          setTimeout(function () { fin(true); }, 2600);   // на случай зависшей записи
          var p = a.play();
          if (p && p.catch) p.catch(function () { fin(false); });
        } catch (e) { res(false); }
      });
    }).catch(function () { return false; });
  }

  function speak(text) {
    try {
      if (!window.speechSynthesis) return false;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.75;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  /* ========================================================= слова */
  window.HZ_WD = window.HZ_WD || {};
  var WORDS = [], WPOS = {}, wordsP = null;

  function loadScript(src, attempt) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src + (attempt ? '?r=' + attempt : '');
      s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () {
        s.remove();
        if ((attempt || 0) < 2) {
          setTimeout(function () { loadScript(src, (attempt || 0) + 1).then(res, rej); }, 700 * ((attempt || 0) + 1));
        } else {
          rej(new Error('Не удалось загрузить словарь слов'));
        }
      };
      document.head.appendChild(s);
    });
  }

  /** Словарь слов грузится по требованию: на запуске он не нужен. */
  function loadWords() {
    if (WORDS.length) return Promise.resolve(WORDS);
    if (wordsP) return wordsP;
    wordsP = loadScript('data/words.js', 0).then(function () {
      WORDS = window.HZ_WORDS || [];
      WPOS = {};
      WORDS.forEach(function (r, i) { WPOS[r[0]] = i; });
      return WORDS;
    }).catch(function (e) { wordsP = null; throw e; });
    return wordsP;
  }

  /** Слоги слова: [{s:'lǎo', key:'lao3', tone:3, gen:false}] */
  function sylls(pinyin) {
    return String(pinyin || '').trim().split(/\s+/).filter(Boolean).map(function (s) {
      var tone = toneOf(s);
      var key = plainPy(s).replace(/[1-5]$/, '') + tone;
      var have = (window.HZ_AUMAP || {})[key] != null;
      return {
        s: s, tone: tone,
        key: have ? key : '',
        gen: have && (window.HZ_GEN5 || []).indexOf(key) >= 0
      };
    });
  }
  function wordKeys(pinyin) {
    return sylls(pinyin).map(function (x) { return x.key; });
  }
  function playWord(pinyin) { return playSeq(wordKeys(pinyin)); }

  function wordRow(w) { return WPOS[w] != null ? WORDS[WPOS[w]] : null; }

  function wordDetail(w) {
    var n = (window.HZ_WDMAP || {})[w];
    if (n == null) return Promise.resolve({});
    return loadChunk('wd', n).then(function () { return (window.HZ_WD[n] || {})[w] || {}; });
  }

  function wordSearch(q, filters) {
    filters = filters || {};
    var res = WORDS;
    if (filters.level) res = res.filter(function (r) { return r[3] === filters.level; });
    if (filters.multi) res = res.filter(function (r) { return r[0].length > 1; });
    if (filters.only) res = res.filter(function (r) { return filters.only.indexOf(r[0]) >= 0; });
    if (filters.has) res = res.filter(function (r) { return r[0].indexOf(filters.has) >= 0; });
    q = (q || '').trim().toLowerCase();
    if (q) {
      var han = q.split('').filter(function (c) { return c >= '㐀' && c <= '鿿'; }).join('');
      var scored = [];
      if (han) {
        res.forEach(function (r) {
          if (r[0] === han) scored.push([0, r]);
          else if (r[0].indexOf(han) === 0) scored.push([1, r]);
          else if (r[0].indexOf(han) >= 0) scored.push([2, r]);
        });
      } else {
        var qp = plainPy(q).replace(/\s+/g, '');
        res.forEach(function (r) {
          var flat = plainPy(r[1]).replace(/\s+/g, '').replace(/[1-5]/g, '');
          var gl = (r[2] || '').toLowerCase();
          var rank = -1;
          if (qp && flat === qp) rank = 0;
          else if (qp && qp.length > 1 && flat.indexOf(qp) === 0) rank = 1;
          if (rank < 0) {
            if (gl === q) rank = 0;
            else if (gl.indexOf(q) === 0) rank = 2;
            else if (gl.indexOf(' ' + q) >= 0 || gl.indexOf(', ' + q) >= 0) rank = 3;
            else if (gl.indexOf(q) >= 0) rank = 4;
            else if (qp && qp.length > 1 && flat.indexOf(qp) > 0) rank = 5;
          }
          if (rank >= 0) scored.push([rank, r]);
        });
      }
      scored.sort(function (a, b) { return a[0] - b[0] || a[1][3] - b[1][3] || a[1][0].length - b[1][0].length; });
      return scored.map(function (x) { return x[1]; });
    }
    var arr = res.slice();
    var sort = filters.sort || 'hsk';
    if (sort === 'hsk') arr.sort(function (a, b) { return a[3] - b[3] || a[0].length - b[0].length; });
    else if (sort === 'len') arr.sort(function (a, b) { return a[0].length - b[0].length || a[3] - b[3]; });
    return arr;
  }

  /* ===================================================== хранилище */
  var DEFAULT = {
    v: 3,
    ts: 0,
    fav: [],
    favw: [],
    sets: [],
    srs: {},
    wsrs: {},
    settings: {
      grid: 'tian',
      numbers: true,
      tolerance: 'normal',
      autoAudio: true,
      hintAfter: 3,
      sync: false,
      confirmExit: true
    },
    stats: { days: {}, strokes: 0 }
  };

  var state = null;
  var cryptoKey = null;       // CryptoKey, когда задан код доступа
  var lockMeta = null;        // {salt, verifier, iter}
  var db = null;
  var saveTimer = null;
  var storageOk = true;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { storageOk = false; return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { storageOk = false; return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

  function merge(base, over) {
    Object.keys(over || {}).forEach(function (k) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') {
        merge(base[k], over[k]);
      } else if (over[k] !== undefined) {
        base[k] = over[k];
      }
    });
    return base;
  }

  /** Проверка и починка структуры: повреждённые поля заменяются умолчаниями. */
  function sanitize(raw) {
    var s = clone(DEFAULT);
    if (!raw || typeof raw !== 'object') return s;
    if (Array.isArray(raw.fav)) s.fav = raw.fav.filter(function (c) { return typeof c === 'string' && c.length === 1; });
    if (Array.isArray(raw.favw)) {
      s.favw = raw.favw.filter(function (c) { return typeof c === 'string' && c.length > 1 && c.length <= 8; });
    }
    if (Array.isArray(raw.sets)) {
      s.sets = raw.sets.filter(function (x) { return x && typeof x.id === 'string'; }).map(function (x) {
        return {
          id: String(x.id).slice(0, 40),
          name: String(x.name == null ? 'Набор' : x.name).slice(0, 60),
          chars: Array.isArray(x.chars) ? x.chars.filter(function (c) { return typeof c === 'string' && c.length === 1; }) : [],
          words: Array.isArray(x.words) ? x.words.filter(function (c) { return typeof c === 'string' && c.length > 1 && c.length <= 8; }) : []
        };
      });
    }
    if (raw.srs && typeof raw.srs === 'object') {
      Object.keys(raw.srs).forEach(function (c) {
        var r = raw.srs[c];
        if (!r || typeof r !== 'object') return;
        s.srs[c] = {
          b: Math.max(0, Math.min(6, +r.b || 0)),
          d: +r.d || 0,
          n: Math.max(0, +r.n || 0),
          e: Math.max(0, +r.e || 0),
          ok: Math.max(0, +r.ok || 0),
          t: +r.t || 0
        };
      });
    }
    if (raw.wsrs && typeof raw.wsrs === 'object') {
      Object.keys(raw.wsrs).forEach(function (w) {
        var r = raw.wsrs[w];
        if (!r || typeof r !== 'object' || w.length > 8) return;
        s.wsrs[w] = {
          b: Math.max(0, Math.min(6, +r.b || 0)),
          d: +r.d || 0,
          n: Math.max(0, +r.n || 0),
          ok: Math.max(0, +r.ok || 0),
          t: +r.t || 0
        };
      });
    }
    if (raw.settings) merge(s.settings, raw.settings);
    if (raw.stats) {
      if (raw.stats.days && typeof raw.stats.days === 'object') s.stats.days = raw.stats.days;
      s.stats.strokes = Math.max(0, +raw.stats.strokes || 0);
    }
    s.ts = +raw.ts || 0;
    return s;
  }

  /* -------------------------------------------------- шифрование */
  var SUB = (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;
  function cryptoAvailable() { return !!SUB; }

  function b64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function randBytes(n) {
    var b = new Uint8Array(n);
    window.crypto.getRandomValues(b);
    return b;
  }

  var ITER = 150000;

  function deriveKey(code, salt, iter) {
    return SUB.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
      .then(function (base) {
        return SUB.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iter || ITER, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }
  function deriveVerifier(code, salt, iter) {
    return SUB.importKey('raw', new TextEncoder().encode(code + '|v'), 'PBKDF2', false, ['deriveBits'])
      .then(function (base) {
        return SUB.deriveBits({ name: 'PBKDF2', salt: salt, iterations: iter || ITER, hash: 'SHA-256' }, base, 256);
      }).then(b64);
  }

  function encryptJson(obj) {
    var iv = randBytes(12);
    var data = new TextEncoder().encode(JSON.stringify(obj));
    return SUB.encrypt({ name: 'AES-GCM', iv: iv }, cryptoKey, data).then(function (ct) {
      return JSON.stringify({ enc: 1, iv: b64(iv), ct: b64(ct) });
    });
  }
  function decryptJson(str) {
    var box = JSON.parse(str);
    if (!box || !box.enc) return Promise.resolve(box);
    return SUB.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, cryptoKey, unb64(box.ct))
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }

  /* ------------------------------------------------ чтение и запись */
  function readLock() {
    var raw = lsGet(LOCK);
    if (!raw) { lockMeta = null; return null; }
    try { lockMeta = JSON.parse(raw); } catch (e) { lockMeta = null; }
    return lockMeta;
  }
  function isLocked() { return !!readLock(); }

  /** Загрузить прогресс. Если задан код — сначала нужен unlock(code). */
  function load() {
    var raw = lsGet(KEY);
    var parsed = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    }
    if (parsed && parsed.enc) {
      state = clone(DEFAULT);       // зашифровано — ждём кода
      return state;
    }
    state = sanitize(parsed);
    ensureSets();
    return state;
  }

  function ensureSets() {
    if (!state.sets.length) state.sets = [{ id: 'set1', name: 'Мой набор', chars: [] }];
  }

  /** Расшифровать хранилище введённым кодом. Промис → true/false. */
  function unlock(code) {
    var meta = readLock();
    if (!meta) return Promise.resolve(false);
    var salt = unb64(meta.salt);
    return deriveVerifier(code, salt, meta.iter).then(function (v) {
      if (v !== meta.verifier) return false;
      return deriveKey(code, salt, meta.iter).then(function (k) {
        cryptoKey = k;
        var raw = lsGet(KEY);
        if (!raw) { state = sanitize(null); ensureSets(); return true; }
        return decryptJson(raw).then(function (obj) {
          state = sanitize(obj);
          ensureSets();
          return true;
        }).catch(function () {
          state = sanitize(null);
          ensureSets();
          return true;
        });
      });
    });
  }

  /** Установить код доступа (или сменить). code === null — снять. */
  function setCode(code) {
    if (!SUB) return Promise.reject(new Error('Шифрование недоступно в этом браузере'));
    if (code === null) {
      cryptoKey = null;
      lsDel(LOCK);
      lockMeta = null;
      return persist(true);
    }
    var salt = randBytes(16);
    return Promise.all([deriveKey(code, salt, ITER), deriveVerifier(code, salt, ITER)])
      .then(function (r) {
        cryptoKey = r[0];
        lockMeta = { salt: b64(salt), verifier: r[1], iter: ITER, v: 1 };
        lsSet(LOCK, JSON.stringify(lockMeta));
        return persist(true);
      });
  }

  function persist(alsoBackup) {
    state.ts = Date.now();
    var done;
    if (cryptoKey) {
      done = encryptJson(state).then(function (s) { lsSet(KEY, s); return s; });
    } else {
      var s = JSON.stringify(state);
      lsSet(KEY, s);
      done = Promise.resolve(s);
    }
    return done.then(function (payload) {
      if (alsoBackup) writeBackup(payload);
      return true;
    });
  }

  function save(opts) {
    opts = opts || {};
    if (saveTimer) clearTimeout(saveTimer);
    persist(opts.backup).then(function () {
      saveTimer = setTimeout(pushRemote, 1500);
    }).catch(function () { });
  }

  /* ------------------------------------------------- резервные копии */
  function backupList() {
    var out = [];
    for (var i = 1; i <= 3; i++) {
      var raw = lsGet(BAK + '.' + i);
      if (!raw) continue;
      try {
        var o = JSON.parse(raw);
        out.push({ slot: i, at: o.at, enc: !!o.enc, chars: o.chars || 0 });
      } catch (e) { }
    }
    return out.sort(function (a, b) { return b.at - a.at; });
  }

  function writeBackup(payload) {
    var last = null;
    try { last = JSON.parse(lsGet(BAK + '.1') || 'null'); } catch (e) { }
    // не чаще раза в 6 часов
    if (last && Date.now() - last.at < 6 * 3600000) return;
    for (var i = 3; i > 1; i--) {
      var prev = lsGet(BAK + '.' + (i - 1));
      if (prev) lsSet(BAK + '.' + i, prev);
    }
    lsSet(BAK + '.1', JSON.stringify({
      at: Date.now(), enc: !!cryptoKey, chars: Object.keys(state.srs).length, body: payload
    }));
  }

  function restoreBackup(slot) {
    var raw = lsGet(BAK + '.' + slot);
    if (!raw) return Promise.reject(new Error('Копия не найдена'));
    var o = JSON.parse(raw);
    var body = o.body;
    var p;
    if (o.enc) {
      if (!cryptoKey) return Promise.reject(new Error('Нужен код доступа'));
      p = decryptJson(body);
    } else {
      p = Promise.resolve(JSON.parse(body));
    }
    return p.then(function (obj) {
      state = sanitize(obj);
      ensureSets();
      return persist(false);
    });
  }

  /** Полный снимок для файла/буфера. */
  function exportJson() {
    return JSON.stringify({ app: 'hanzi-propisi', v: 2, at: Date.now(), data: state }, null, 1);
  }
  function importJson(text) {
    var o = JSON.parse(text);
    var data = (o && o.data) ? o.data : o;
    var next = sanitize(data);
    if (!Object.keys(next.srs).length && !next.fav.length && !next.sets.length) {
      throw new Error('В файле нет прогресса');
    }
    state = next;
    ensureSets();
    return persist(true);
  }

  /* ------------------------------------------------- сеанс (черновик) */
  function saveSession(s) {
    try { lsSet(SESS, JSON.stringify(s)); } catch (e) { }
  }
  function loadSession() {
    var raw = lsGet(SESS);
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.list) || Date.now() - (s.at || 0) > DAY) { lsDel(SESS); return null; }
      return s;
    } catch (e) { lsDel(SESS); return null; }
  }
  function clearSession() { lsDel(SESS); }

  /* ------------------------------------------------------- облако */
  function pushRemote() {
    if (!db || !state.settings.sync) return;
    try {
      db.doc('progress/main').set({ ts: state.ts, json: JSON.stringify(state) }).catch(function () { });
    } catch (e) { }
  }

  function initSync(onChange, onFail) {
    if (!window.claude || !window.claude.use) { if (onFail) onFail('Синхронизация доступна только при открытии из Claude'); return; }
    window.claude.use('db').then(function (d) {
      if (!d) { if (onFail) onFail('Не удалось подключиться'); return; }
      db = d;
      return d.doc('progress/main').get().then(function (snap) {
        if (snap && snap.exists) {
          var data = snap.data() || {};
          if (data.ts && data.ts > (state.ts || 0) && data.json) {
            try {
              state = sanitize(JSON.parse(data.json));
              ensureSets();
              persist(true);
              if (onChange) onChange();
              return;
            } catch (e) { }
          }
        }
        pushRemote();
        if (onChange) onChange();
      });
    }).catch(function () { if (onFail) onFail('Не удалось подключиться'); });
  }

  /* ========================================== интервальное повторение */
  var STEPS = [0, 1, 3, 7, 16, 35, 75];
  function today() { return Math.floor(Date.now() / DAY); }
  function rec(ch) { return state.srs[ch] || null; }
  function isDue(ch) {
    var r = rec(ch);
    return !r || r.d <= today();
  }

  function grade(ch, res) {
    var r = state.srs[ch] || { b: 0, d: 0, n: 0, e: 0, ok: 0 };
    var clean = res.errors === 0 && res.hints === 0;
    if (clean) r.b = Math.min(STEPS.length - 1, r.b + 1);
    else if (res.errors <= 2 && res.hints === 0) r.b = Math.max(1, r.b);
    else r.b = Math.max(0, r.b - 1);
    r.n++;
    r.e += res.errors;
    if (clean) r.ok++;
    r.d = today() + STEPS[r.b];
    r.t = Date.now();
    state.srs[ch] = r;

    var dk = new Date().toISOString().slice(0, 10);
    state.stats.days[dk] = (state.stats.days[dk] || 0) + 1;
    state.stats.strokes += res.strokes || 0;
    save({ backup: true });
    return r;
  }
  function stepDays(box) { return STEPS[Math.max(0, Math.min(STEPS.length - 1, box))]; }

  /* --------------------------------- повторение слов (узнавание) */
  function wrec(w) { return state.wsrs[w] || null; }
  function wordDue(w) {
    var r = wrec(w);
    return !r || r.d <= today();
  }
  /** res: 'know' — вспомнил, 'soon' — почти, 'no' — не вспомнил. */
  function wgrade(w, res) {
    var r = state.wsrs[w] || { b: 0, d: 0, n: 0, ok: 0 };
    if (res === 'know') r.b = Math.min(STEPS.length - 1, r.b + 1);
    else if (res === 'soon') r.b = Math.max(1, Math.min(STEPS.length - 1, r.b));
    else r.b = 0;
    r.n++;
    if (res === 'know') r.ok++;
    r.d = today() + STEPS[r.b];
    r.t = Date.now();
    state.wsrs[w] = r;
    var dk = new Date().toISOString().slice(0, 10);
    state.stats.days[dk] = (state.stats.days[dk] || 0) + 1;
    save({ backup: true });
    return r;
  }
  function wordsKnown() { return Object.keys(state.wsrs).length; }
  function wordsDue() {
    return Object.keys(state.wsrs).filter(function (w) { return wordDue(w); }).length;
  }

  /* ======================================================= наборы */
  function virtualSets() {
    var out = [];
    for (var l = 1; l <= 6; l++) out.push({ id: 'hsk' + l, name: 'HSK ' + l, level: l });
    return out;
  }
  function setChars(id) {
    if (id === 'fav') return state.fav.slice();
    if (id === 'due') return IDX.filter(function (r) { return rec(r[0]) && isDue(r[0]); }).map(function (r) { return r[0]; });
    if (id === 'hard') {
      return Object.keys(state.srs)
        .filter(function (c) { return state.srs[c].e >= 2 && BY[c]; })
        .sort(function (a, b) { return state.srs[b].e - state.srs[a].e; });
    }
    var m = /^hsk(\d)$/.exec(id);
    if (m) return IDX.filter(function (r) { return r[5] === +m[1]; }).map(function (r) { return r[0]; });
    var s = state.sets.filter(function (x) { return x.id === id; })[0];
    return s ? s.chars.slice() : [];
  }
  function setName(id) {
    if (id === 'fav') return 'Избранное';
    if (id === 'due') return 'К повторению';
    if (id === 'hard') return 'Трудные';
    var m = /^hsk(\d)$/.exec(id);
    if (m) return 'HSK ' + m[1];
    var s = state.sets.filter(function (x) { return x.id === id; })[0];
    return s ? s.name : 'Набор';
  }
  function isOwnSet(id) {
    return state.sets.some(function (x) { return x.id === id; });
  }

  /* ------------------------------------------- слова внутри наборов */
  function setWords(id) {
    if (id === 'fav') return state.favw.slice();
    if (id === 'dueW') return Object.keys(state.wsrs).filter(function (w) { return wordDue(w); });
    var m = /^hsk(\d)$/.exec(id);
    if (m) return WORDS.filter(function (r) { return r[3] === +m[1] && r[0].length > 1; }).map(function (r) { return r[0]; });
    var s = state.sets.filter(function (x) { return x.id === id; })[0];
    return s && s.words ? s.words.slice() : [];
  }
  function toggleFavWord(w) {
    var i = state.favw.indexOf(w);
    if (i >= 0) state.favw.splice(i, 1); else state.favw.push(w);
    save();
    return i < 0;
  }
  function addWordsTo(setId, list) {
    if (setId === 'fav') {
      var k = 0;
      list.forEach(function (w) { if (state.favw.indexOf(w) < 0) { state.favw.push(w); k++; } });
      save();
      return k;
    }
    var s = state.sets.filter(function (x) { return x.id === setId; })[0];
    if (!s) return 0;
    if (!s.words) s.words = [];
    var n = 0;
    list.forEach(function (w) { if (s.words.indexOf(w) < 0) { s.words.push(w); n++; } });
    save();
    return n;
  }
  function removeWordFrom(setId, w) {
    if (setId === 'fav') {
      var i = state.favw.indexOf(w);
      if (i >= 0) state.favw.splice(i, 1);
      save();
      return;
    }
    var s = state.sets.filter(function (x) { return x.id === setId; })[0];
    if (!s || !s.words) return;
    var j = s.words.indexOf(w);
    if (j >= 0) s.words.splice(j, 1);
    save();
  }
  function toggleFav(ch) {
    var i = state.fav.indexOf(ch);
    if (i >= 0) state.fav.splice(i, 1); else state.fav.push(ch);
    save();
    return i < 0;
  }
  function addTo(setId, chars) {
    if (setId === 'fav') {
      var k = 0;
      chars.forEach(function (c) { if (state.fav.indexOf(c) < 0) { state.fav.push(c); k++; } });
      save();
      return k;
    }
    var s = state.sets.filter(function (x) { return x.id === setId; })[0];
    if (!s) return 0;
    var n = 0;
    chars.forEach(function (c) { if (s.chars.indexOf(c) < 0) { s.chars.push(c); n++; } });
    save();
    return n;
  }
  function removeFrom(setId, ch) {
    if (setId === 'fav') {
      var i = state.fav.indexOf(ch);
      if (i >= 0) state.fav.splice(i, 1);
      save();
      return;
    }
    var s = state.sets.filter(function (x) { return x.id === setId; })[0];
    if (!s) return;
    var j = s.chars.indexOf(ch);
    if (j >= 0) s.chars.splice(j, 1);
    save();
  }
  function createSet(name) {
    var id = 'set' + Date.now().toString(36);
    state.sets.push({ id: id, name: (name || 'Набор').slice(0, 60), chars: [] });
    save();
    return id;
  }
  function renameSet(id, name) {
    var s = state.sets.filter(function (x) { return x.id === id; })[0];
    if (s) { s.name = (name || s.name).slice(0, 60); save(); }
  }
  function deleteSet(id) {
    var removed = state.sets.filter(function (x) { return x.id === id; })[0];
    state.sets = state.sets.filter(function (x) { return x.id !== id; });
    save();
    return removed ? clone(removed) : null;
  }
  function restoreSet(obj) {
    if (!obj) return;
    state.sets.push(obj);
    save();
  }

  /* ======================================================== поиск */
  function search(q, filters) {
    filters = filters || {};
    var res = IDX;
    if (filters.level) res = res.filter(function (r) { return r[5] === filters.level; });
    if (filters.radical) res = res.filter(function (r) { return r[4] === filters.radical; });
    if (filters.only) res = res.filter(function (r) { return filters.only.indexOf(r[0]) >= 0; });
    q = (q || '').trim().toLowerCase();
    if (q) {
      var han = q.split('').filter(function (c) { return c >= '㐀' && c <= '鿿'; });
      if (han.length) {
        res = res.filter(function (r) { return han.indexOf(r[0]) >= 0; });
      } else {
        var pp = plainPy(q);
        var tone = /[1-5]$/.test(pp) ? pp.slice(-1) : '';
        var qp = pp.replace(/[1-5]$/, '');
        var scored = [];
        res.forEach(function (r) {
          var b = plainPy(r[1]);
          var gl = r[3].toLowerCase();
          var rank = -1;
          if (b === qp) rank = tone ? (String(toneOf(r[1])) === tone ? 0 : -1) : 0;
          else if (qp.length > 1 && b.indexOf(qp) === 0) rank = tone ? (String(toneOf(r[1])) === tone ? 1 : -1) : 1;
          if (rank < 0) {
            if (gl === q) rank = 0;
            else if (gl.indexOf(q) === 0) rank = 2;
            else if (gl.indexOf(' ' + q) >= 0 || gl.indexOf(', ' + q) >= 0) rank = 3;
            else if (gl.indexOf(q) >= 0) rank = 4;
          }
          if (rank >= 0) scored.push([rank, r]);
        });
        scored.sort(function (a, b2) { return a[0] - b2[0] || a[1][7] - b2[1][7]; });
        return scored.map(function (x) { return x[1]; });
      }
    }
    var sort = filters.sort || 'freq';
    var arr = res.slice();
    if (sort === 'freq') arr.sort(function (a, b) { return a[7] - b[7]; });
    else if (sort === 'hsk') arr.sort(function (a, b) { return a[5] - b[5] || a[7] - b[7]; });
    else if (sort === 'strokes') arr.sort(function (a, b) { return a[6] - b[6] || a[7] - b[7]; });
    return arr;
  }

  /* ===================================================== получение */
  function graphics(ch) {
    var i = POS[ch];
    if (i == null) return Promise.reject(new Error('Знак не входит в базу'));
    var n = Math.floor(i / window.HZ_CFG.gr);
    return loadChunk('gr', n).then(function () {
      var d = (window.HZ_GR[n] || {})[ch];
      if (!d) throw new Error('Нет данных о написании');
      return d;
    });
  }
  function detail(ch) {
    var i = POS[ch];
    if (i == null) return Promise.reject(new Error('Знак не входит в базу'));
    var n = Math.floor(i / window.HZ_CFG.det);
    return loadChunk('det', n).then(function () { return (window.HZ_DET[n] || {})[ch] || {}; });
  }
  function prefetch(chars) {
    var gr = {}, det = {};
    (chars || []).slice(0, 40).forEach(function (c) {
      var i = POS[c];
      if (i == null) return;
      gr[Math.floor(i / window.HZ_CFG.gr)] = 1;
      det[Math.floor(i / window.HZ_CFG.det)] = 1;
    });
    Object.keys(gr).forEach(function (n) { loadChunk('gr', +n).catch(function () { }); });
    Object.keys(det).forEach(function (n) { loadChunk('det', +n).catch(function () { }); });
  }

  window.HZ = {
    initIndex: initIndex,
    get idx() { return IDX; },
    by: function (ch) { return BY[ch]; },
    pos: function (ch) { return POS[ch]; },
    comp: function (c) { return (window.HZ_COMPS || {})[c]; },
    rads: function () { return window.HZ_RADS || []; },
    graphics: graphics,
    detail: detail,
    prefetch: prefetch,
    search: search,
    playKey: playKey,
    speak: speak,

    loadWords: loadWords,
    get words() { return WORDS; },
    wordRow: wordRow,
    wordDetail: wordDetail,
    wordSearch: wordSearch,
    sylls: sylls,
    wordKeys: wordKeys,
    playWord: playWord,
    playSeq: playSeq,
    wrec: wrec,
    wgrade: wgrade,
    wordDue: wordDue,
    wordsKnown: wordsKnown,
    wordsDue: wordsDue,
    setWords: setWords,
    toggleFavWord: toggleFavWord,
    addWordsTo: addWordsTo,
    removeWordFrom: removeWordFrom,
    toneOf: toneOf,
    plainPy: plainPy,
    TONE_RU: TONE_RU,

    load: load,
    save: save,
    persist: persist,
    get state() { return state; },
    storageOk: function () { return storageOk; },

    isLocked: isLocked,
    unlock: unlock,
    setCode: setCode,
    cryptoAvailable: cryptoAvailable,
    hasKey: function () { return !!cryptoKey; },

    backupList: backupList,
    restoreBackup: restoreBackup,
    exportJson: exportJson,
    importJson: importJson,

    saveSession: saveSession,
    loadSession: loadSession,
    clearSession: clearSession,

    initSync: initSync,
    grade: grade,
    rec: rec,
    isDue: isDue,
    today: today,
    stepDays: stepDays,

    virtualSets: virtualSets,
    setChars: setChars,
    setName: setName,
    isOwnSet: isOwnSet,
    toggleFav: toggleFav,
    addTo: addTo,
    removeFrom: removeFrom,
    createSet: createSet,
    renameSet: renameSet,
    deleteSet: deleteSet,
    restoreSet: restoreSet,

    TOL: { easy: 215, normal: 175, strict: 142 }
  };
})();
