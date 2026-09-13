/* =====================================================================
   HZWriter — отрисовка, анимация и проверка написания иероглифа.

   Данные: контуры черт (SVG path) и «медианы» — осевые линии черт
   из проекта Make Me a Hanzi. Система координат 1024×1024 с осью Y,
   направленной вверх, поэтому группа рисуется с transform
   translate(0,900) scale(1,-1).
   ================================================================== */
(function () {
  'use strict';

  var SIZE = 1024;
  var YOFF = 900;          // сдвиг при перевороте оси Y
  var PEN = 190;           // толщина «пера» при анимации (перекрывает контур)
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---------------------------------------------------- геометрия */
  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }

  function pathLen(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
    return L;
  }

  /** Равномерно разложить ломаную на n точек по длине. */
  function resample(pts, n) {
    if (pts.length === 1) {
      var one = [];
      for (var q = 0; q < n; q++) one.push([pts[0][0], pts[0][1]]);
      return one;
    }
    var total = pathLen(pts);
    if (total === 0) return resample([pts[0]], n);
    var step = total / (n - 1);
    var out = [[pts[0][0], pts[0][1]]];
    var i = 1, acc = 0, cur = pts[0];
    while (out.length < n && i < pts.length) {
      var seg = dist(cur, pts[i]);
      if (acc + seg >= step - 1e-9) {
        var t = (step - acc) / seg;
        var np = [cur[0] + (pts[i][0] - cur[0]) * t, cur[1] + (pts[i][1] - cur[1]) * t];
        out.push(np);
        cur = np;
        acc = 0;
      } else {
        acc += seg;
        cur = pts[i];
        i++;
      }
    }
    while (out.length < n) out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    return out;
  }

  function meanDist(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += dist(a[i], b[i]);
    return s / a.length;
  }

  /** Продлить концы медианы, чтобы круглый торец пера закрыл контур. */
  function extend(pts, by) {
    if (pts.length < 2) return pts.slice();
    var r = pts.map(function (p) { return [p[0], p[1]]; });
    function push(from, to, out) {
      var d = dist(from, to);
      if (d < 1e-6) return;
      out[0] = to[0] + (to[0] - from[0]) / d * by;
      out[1] = to[1] + (to[1] - from[1]) / d * by;
    }
    push(r[1], r[0], r[0]);
    push(r[r.length - 2], r[r.length - 1], r[r.length - 1]);
    return r;
  }

  function toPathD(pts) {
    return 'M ' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L ');
  }

  /** Сгладить ломаную в кривую (квадратичные Безье через середины отрезков) —
      убирает «ломаный» вид пальцевого ввода, сохраняя отклик в реальном времени. */
  function smoothPathD(pts) {
    if (pts.length < 3) return toPathD(pts);
    var d = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    var i, mx, my;
    for (i = 1; i < pts.length - 1; i++) {
      mx = (pts[i][0] + pts[i + 1][0]) / 2;
      my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ' Q ' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1);
    }
    var last = pts[pts.length - 1];
    d += ' T ' + last[0].toFixed(1) + ' ' + last[1].toFixed(1);
    return d;
  }

  /* --------------------------------------- определение типа черты
     Тип черты выводится из формы её осевой линии: сначала линия
     разбивается на прямые куски по настоящим углам (плавная кривизна
     углом не считается), затем каждый кусок получает направление.
     Названия собираются как в китайской традиции: 横 + 折 + 钩. */

  var BASE_RU = {
    '横': 'горизонтальная', '竖': 'вертикальная', '撇': 'откидная влево',
    '捺': 'откидная вправо', '点': 'точка', '提': 'восходящая', '斜': 'наклонная'
  };
  var SUFF_RU = {
    '折': 'с изломом', '钩': 'с крюком', '弯': 'с изгибом',
    '撇': 'с откидной влево', '点': 'с точкой', '提': 'с подъёмом',
    '捺': 'с откидной вправо', '横': 'с горизонталью', '竖': 'с вертикалью'
  };
  var BASE_PY = {
    '横': 'héng', '竖': 'shù', '撇': 'piě', '捺': 'nà', '点': 'diǎn',
    '提': 'tí', '折': 'zhé', '钩': 'gōu', '弯': 'wān', '斜': 'xié'
  };

  /** Угол хорды в «экранных» координатах: 0° — вправо, 90° — вниз. */
  function chordAngle(p0, p1) {
    return Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]) * 180 / Math.PI;
  }
  function turnBetween(a, b) { return Math.abs(((b - a) + 540) % 360 - 180); }

  function dirName(p0, p1, len, scale, endAng, solo, first) {
    var A = chordAngle(p0, p1);
    if (solo && ((len < 0.47 * scale && A > 18 && A < 62) || (len < 0.22 * scale && A > 20 && A < 110))) return '点';
    if (A > -24 && A < 24) return '横';
    if (A >= 62 && A <= 118) {
      if ((solo || first) && endAng != null && endAng > 113) return '撇';
      return '竖';
    }
    if (A > 118) return '撇';
    if (A >= 24 && A < 62) return '捺';
    if (A > -85 && A <= -24) return '提';
    return '横';
  }

  /** Индексы настоящих углов (не более двух). */
  function corners(pts, minTurn) {
    var n = pts.length, W = 2, turns = new Array(n).fill(0);
    for (var i = W; i < n - W; i++) {
      turns[i] = turnBetween(chordAngle(pts[i - W], pts[i]), chordAngle(pts[i], pts[i + W]));
    }
    var found = [], k = W;
    while (k < n - W) {
      if (turns[k] >= minTurn) {
        var j = k, best = k;
        while (j < n - W && turns[j] >= minTurn * 0.6) {
          if (turns[j] > turns[best]) best = j;
          j++;
        }
        found.push(best);
        k = j + 1;
      } else k++;
    }
    found.sort(function (a, b) { return turns[b] - turns[a]; });
    found = found.slice(0, 2).sort(function (a, b) { return a - b; });
    return [0].concat(found, [n - 1]);
  }

  /** Тип черты по её осевой линии. scale — длина самой длинной черты знака. */
  function classify(median, scale) {
    var pts = resample(median, 24);
    var tot = pathLen(pts);
    if (!scale) scale = tot;
    if (tot < 1) return named('点');
    var chord0 = dist(pts[0], pts[pts.length - 1]);
    var idx = (chord0 / tot) < 0.86 ? corners(pts, 46) : [0, pts.length - 1];

    var segs = [];
    for (var k = 0; k < idx.length - 1; k++) {
      segs.push({ i: idx[k], j: idx[k + 1], len: pathLen(pts.slice(idx[k], idx[k + 1] + 1)) });
    }
    // «заход пера»: очень короткий первый участок — часть следующего
    while (segs.length > 1 && segs[0].len < tot * 0.15) {
      segs[1].i = segs[0].i;
      segs[1].len += segs[0].len;
      segs.shift();
    }
    var m = 1;
    while (segs.length > 2 && m < segs.length - 1) {
      if (segs[m].len < tot * 0.16) {
        segs[m + 1].i = segs[m].i;
        segs[m + 1].len += segs[m].len;
        segs.splice(m, 1);
      } else m++;
    }
    segs.forEach(function (s, si) {
      s.a = pts[s.i]; s.b = pts[s.j];
      s.ang = chordAngle(s.a, s.b);
      var sub = pts.slice(s.i, s.j + 1);
      var k0 = Math.max(0, sub.length - 1 - Math.max(1, Math.round(sub.length * 0.35)));
      s.endAng = sub.length > 2 ? chordAngle(sub[k0], sub[sub.length - 1]) : s.ang;
      s.dir = dirName(s.a, s.b, s.len, scale, s.endAng, segs.length === 1, si === 0);
    });

    if (segs.length === 1) return named(segs[0].dir);

    // плавная длинная дуга вниз-вправо с подъёмом в конце — 斜钩
    var smooth = true;
    for (var q = 0; q < segs.length - 1; q++) {
      if (turnBetween(segs[q].ang, segs[q + 1].ang) >= 55) smooth = false;
    }
    if (smooth && (segs[0].dir === '捺' || segs[0].dir === '竖') && tot > 0.9 * scale
        && segs[segs.length - 1].ang < segs[0].ang - 25) {
      return named('斜钩');
    }

    var name = segs[0].dir;
    for (var t = 1; t < segs.length; t++) {
      var prev = segs[t - 1], cur = segs[t];
      var turn = turnBetween(prev.ang, cur.ang);
      var isLast = (t === segs.length - 1);
      var shortTail = cur.len < tot * 0.30;
      var back = cur.ang < prev.ang - 40 || cur.dir === '提';
      if (isLast && shortTail && turn > 38 && (back || cur.dir === '提' || cur.dir === '横' || cur.dir === '撇')) {
        name += '钩';
        continue;
      }
      var down = cur.ang >= 55 && cur.ang <= 155;
      var flat = cur.ang >= -32 && cur.ang <= 32;
      if (prev.dir === '撇' && cur.ang > 20 && cur.ang < 80) name += '点';
      else if (prev.dir === '横' && down) name += '折';
      else if ((prev.dir === '竖' || prev.dir === '撇') && flat) name += '折';
      else if (cur.dir === '横' || cur.dir === '竖') name += '折';
      else name += cur.dir;
    }
    if (name.length > 4) return { zh: name, ru: 'составная черта', py: '' };
    return named(name);
  }

  function named(zh) {
    var parts = zh.split('');
    var base = parts[0] === '斜' ? 'наклонная' : (BASE_RU[parts[0]] || 'черта');
    var ru = base;
    for (var i = 1; i < parts.length; i++) {
      ru += ' ' + (i > 1 ? 'и ' : '') + (SUFF_RU[parts[i]] || '');
    }
    var py = parts.map(function (c) { return BASE_PY[c] || ''; }).filter(Boolean).join('');
    return { zh: zh, ru: ru.trim(), py: py };
  }

  /** Названия всех черт знака (с учётом его масштаба). */
  function classifyAll(medians) {
    var scale = 0;
    medians.forEach(function (m) { scale = Math.max(scale, pathLen(m)); });
    return medians.map(function (m) { return classify(m, scale); });
  }

  /* --------------------------------------------------- сама сцена */
  /**
   * @param {HTMLElement} host       контейнер .paper
   * @param {Object} opts { grid:'tian'|'mi'|'none', onStroke, showNumbers }
   */
  function Writer(host, opts) {
    this.host = host;
    this.opts = Object.assign({ grid: 'tian', tolerance: 175 }, opts || {});
    this.data = null;
    this.done = [];
    this.userPts = null;
    this.animTimer = null;
    this.locked = true;
    this._build();
  }

  Writer.prototype._build = function () {
    var id = 'hzw' + (++uid);
    this.id = id;
    this.host.textContent = '';
    var svg = el('svg', { viewBox: '0 0 ' + SIZE + ' ' + SIZE, 'aria-hidden': 'true' });
    this.svg = svg;

    var g = el('g', { class: 'gridlayer' });
    this.gridLayer = g;
    svg.appendChild(g);

    var defs = el('defs');
    this.defs = defs;
    svg.appendChild(defs);

    var flip = el('g', { transform: 'translate(0,' + YOFF + ') scale(1,-1)' });
    this.hintLayer = el('g');
    this.inkLayer = el('g');
    this.animLayer = el('g');
    flip.appendChild(this.hintLayer);
    flip.appendChild(this.inkLayer);
    flip.appendChild(this.animLayer);
    svg.appendChild(flip);

    this.numLayer = el('g');
    svg.appendChild(this.numLayer);

    this.traceLayer = el('g');
    svg.appendChild(this.traceLayer);

    this.host.appendChild(svg);
    this._grid();
    this._bindInput();
  };

  Writer.prototype._grid = function () {
    var g = this.gridLayer;
    g.textContent = '';
    var mode = this.opts.grid;
    if (mode === 'none') return;
    var mid = SIZE / 2;
    g.appendChild(el('line', { x1: mid, y1: 0, x2: mid, y2: SIZE, class: 'grid-line dash' }));
    g.appendChild(el('line', { x1: 0, y1: mid, x2: SIZE, y2: mid, class: 'grid-line dash' }));
    if (mode === 'mi') {
      g.appendChild(el('line', { x1: 0, y1: 0, x2: SIZE, y2: SIZE, class: 'grid-line dash' }));
      g.appendChild(el('line', { x1: SIZE, y1: 0, x2: 0, y2: SIZE, class: 'grid-line dash' }));
    }
  };

  Writer.prototype.setGrid = function (mode) { this.opts.grid = mode; this._grid(); };

  /** Загрузить знак. mode: 'trace' (с подсказкой) | 'blind' (без) | 'view' */
  Writer.prototype.load = function (charData, mode) {
    this.stop();
    this.data = charData;
    this.mode = mode || 'trace';
    this.done = [];
    this.attempts = 0;
    this.errors = 0;
    this.revealed = {};
    this._render();
  };

  Writer.prototype._render = function (justIdx) {
    var d = this.data;
    this.hintLayer.textContent = '';
    this.inkLayer.textContent = '';
    this.animLayer.textContent = '';
    this.numLayer.textContent = '';
    this.traceLayer.textContent = '';
    if (!d) return;
    var showHint = this.mode === 'trace' || this.mode === 'view';
    for (var i = 0; i < d.s.length; i++) {
      var isDone = this.done.indexOf(i) >= 0 || this.mode === 'ref';
      if (isDone) {
        var cls = i === justIdx ? 'ink-path bloom' : 'ink-path';
        this.inkLayer.appendChild(el('path', { d: d.s[i], class: cls }));
      } else if (showHint || this.revealed[i]) {
        this.hintLayer.appendChild(el('path', { d: d.s[i], class: 'hint-path' }));
      }
    }
    if (this.opts.showNumbers && (showHint || this.mode === 'ref')) this._numbers();
  };

  Writer.prototype._numbers = function () {
    var d = this.data;
    for (var i = 0; i < d.m.length; i++) {
      if (this.done.indexOf(i) >= 0) continue;
      var p = d.m[i][0];
      var t = el('text', {
        x: p[0], y: YOFF - p[1], class: 'stroke-num',
        'text-anchor': 'middle', 'dominant-baseline': 'central'
      });
      t.textContent = String(i + 1);
      this.numLayer.appendChild(t);
    }
  };

  /* ------------------------------------------------------ анимация */
  Writer.prototype.stop = function () {
    if (this.animTimer) { clearTimeout(this.animTimer); this.animTimer = null; }
    this.animating = false;
  };

  /** Показать написание от начала до конца. */
  Writer.prototype.animate = function (opts) {
    opts = opts || {};
    var self = this;
    var d = this.data;
    if (!d) return;
    this.stop();
    this.animating = true;
    this.done = [];
    this.mode = opts.ghost === false ? 'blind' : 'view';
    this._render();

    var i = 0;
    function next() {
      if (!self.animating || !self.data) return;
      if (i >= d.s.length) {
        self.animating = false;
        if (opts.onEnd) opts.onEnd();
        return;
      }
      var idx = i++;
      self.drawStroke(idx, opts.speed || 1, function () {
        self.done.push(idx);
        self._render();
        self.animTimer = setTimeout(next, 130 / (opts.speed || 1));
      });
    }
    next();
  };

  /** Нарисовать одну черту «пером» по её медиане. */
  Writer.prototype.drawStroke = function (idx, speed, cb) {
    var d = this.data;
    if (!d || !d.m[idx]) { if (cb) cb(); return; }
    var med = extend(resample(d.m[idx], Math.max(6, d.m[idx].length * 2)), PEN * 0.42);
    var L = pathLen(med);
    var clipId = this.id + '-c' + idx;
    var clip = el('clipPath', { id: clipId, clipPathUnits: 'userSpaceOnUse' });
    clip.appendChild(el('path', { d: d.s[idx] }));
    this.defs.appendChild(clip);

    var p = el('path', {
      d: toPathD(med),
      fill: 'none',
      'stroke-width': PEN,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'clip-path': 'url(#' + clipId + ')'
    });
    p.style.stroke = 'var(--ink)';
    p.style.strokeDasharray = L + ' ' + (L + 4);
    p.style.strokeDashoffset = L;
    this.animLayer.appendChild(p);

    var dur = Math.max(190, Math.min(820, L * 0.95)) / (speed || 1);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) dur = 60;
    // форсируем reflow, чтобы переход сработал
    void p.getBoundingClientRect();
    p.style.transition = 'stroke-dashoffset ' + dur + 'ms linear';
    p.style.strokeDashoffset = '0';
    var self = this;
    this.animTimer = setTimeout(function () {
      if (p.parentNode) p.parentNode.removeChild(p);
      if (clip.parentNode) clip.parentNode.removeChild(clip);
      if (cb) cb();
    }, dur + 30);
  };

  /** Кратко подсветить нужную черту (подсказка). */
  Writer.prototype.reveal = function (idx) {
    this.revealed[idx] = true;
    this._render();
    var self = this;
    this.drawStroke(idx, 1.2, function () { self._render(); });
  };

  /* ------------------------------------------------------- ввод */
  Writer.prototype.setLocked = function (v) { this.locked = v; };

  Writer.prototype._toChar = function (ev) {
    var r = this.host.getBoundingClientRect();
    var t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
    var x = (t.clientX - r.left) / r.width * SIZE;
    var y = (t.clientY - r.top) / r.height * SIZE;
    return [x, YOFF - y];        // в координаты данных (Y вверх)
  };

  Writer.prototype._bindInput = function () {
    var self = this;
    var host = this.host;

    function start(ev) {
      if (self.locked || !self.data) return;
      ev.preventDefault();
      self.stop();
      try { host.setPointerCapture(ev.pointerId); } catch (e) { }
      self.userPts = [self._toChar(ev)];
      self.traceLayer.textContent = '';
      self.tracePath = el('path', {
        fill: 'none', 'stroke-width': 26, class: 'trace-path',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '.85'
      });
      self.tracePath.style.stroke = 'var(--trace)';
      self.traceLayer.appendChild(self.tracePath);
      self._trace();
    }
    function move(ev) {
      if (!self.userPts) return;
      ev.preventDefault();
      var p = self._toChar(ev);
      var last = self.userPts[self.userPts.length - 1];
      if (dist(p, last) > 4) { self.userPts.push(p); self._trace(); }
    }
    function end(ev) {
      if (!self.userPts) return;
      ev.preventDefault();
      var pts = self.userPts;
      self.userPts = null;
      setTimeout(function () { self.traceLayer.textContent = ''; }, 120);
      self._submit(pts);
    }

    host.addEventListener('pointerdown', start);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
    host.addEventListener('pointerleave', function (e) { if (self.userPts) end(e); });
  };

  Writer.prototype._trace = function () {
    if (!this.tracePath) return;
    var pts = this.userPts.map(function (p) { return [p[0], YOFF - p[1]]; });
    this.tracePath.setAttribute('d', pts.length === 1
      ? 'M ' + pts[0][0] + ' ' + pts[0][1] + ' l 0.1 0.1'
      : smoothPathD(pts));
  };

  /* ------------------------------------------------------ проверка */
  /**
   * Сравнить нарисованную черту с ожидаемой.
   * @returns {{score:number, okStart:boolean, okDir:boolean, okLen:boolean}}
   */
  Writer.prototype.compare = function (userPts, idx) {
    var med = this.data.m[idx];
    var N = 16;
    var a = resample(userPts, N);
    var b = resample(med, N);
    var bRev = b.slice().reverse();
    var fwd = meanDist(a, b);
    var rev = meanDist(a, bRev);
    var uLen = pathLen(userPts);
    var eLen = pathLen(med);
    var isDot = eLen < 150;
    var lenRatio = eLen > 0 ? uLen / eLen : 1;
    return {
      score: fwd,
      rev: rev,
      okDir: isDot || fwd <= rev * 1.05,
      okStart: dist(a[0], b[0]) < (isDot ? 260 : 300),
      okLen: isDot ? uLen < 420 : (lenRatio > 0.42 && lenRatio < 2.4),
      isDot: isDot
    };
  };

  Writer.prototype._submit = function (pts) {
    var d = this.data;
    if (!d) return;
    var expect = this._nextIndex();
    if (expect < 0) return;

    var tol = this.opts.tolerance;
    var eLenSmall = pathLen(d.m[expect]) < 150;
    // случайное касание: слишком короткое движение — просто не считаем попыткой
    if ((pts.length < 3 || pathLen(pts) < 40) && !eLenSmall) {
      this._emit({ ok: false, ignored: true, expect: expect });
      return;
    }

    var mine = this.compare(pts, expect);
    var okSelf = mine.score < tol && mine.okDir && mine.okStart && mine.okLen;

    // не перепутана ли черта с другой, ещё не написанной?
    var better = -1, bestScore = mine.score;
    for (var i = 0; i < d.m.length; i++) {
      if (i === expect || this.done.indexOf(i) >= 0) continue;
      var c = this.compare(pts, i);
      if (c.score < bestScore * 0.68 && c.okDir && c.okStart && c.score < tol) {
        bestScore = c.score;
        better = i;
      }
    }

    if (okSelf && better < 0) {
      this.done.push(expect);
      this.attempts = 0;
      this._render(expect);
      this._emit({ ok: true, index: expect, total: d.s.length, done: this.done.length, score: mine.score });
      return;
    }

    this.attempts++;
    this.errors++;
    var reason = 'miss';
    if (better >= 0) reason = 'order';
    else if (!mine.okDir) reason = 'dir';
    else if (!mine.okStart) reason = 'start';
    else if (!mine.okLen) reason = 'len';
    this._emit({
      ok: false, reason: reason, expect: expect, confused: better,
      attempts: this.attempts, score: mine.score
    });
  };

  Writer.prototype._nextIndex = function () {
    for (var i = 0; i < this.data.s.length; i++) if (this.done.indexOf(i) < 0) return i;
    return -1;
  };

  Writer.prototype._emit = function (res) {
    if (this.opts.onStroke) this.opts.onStroke(res);
  };

  Writer.prototype.nextIndex = function () { return this._nextIndex(); };
  Writer.prototype.progress = function () {
    return { done: this.done.length, total: this.data ? this.data.s.length : 0, errors: this.errors };
  };
  Writer.prototype.shake = function () {
    var h = this.host;
    h.classList.remove('shake');
    void h.offsetWidth;
    h.classList.add('shake');
    setTimeout(function () { h.classList.remove('shake'); }, 320);
  };
  /** Дописать всё до конца (сдаться). */
  Writer.prototype.solve = function () {
    var d = this.data;
    if (!d) return;
    this.done = d.s.map(function (_, i) { return i; });
    this._render();
  };

  window.HZWriter = Writer;
  window.HZWriter.classify = classify;
  window.HZWriter.classifyAll = classifyAll;
})();
