/* =====================================================================
   Ханьцзы Прописи — интерфейс.
   ================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------- мелочи */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (k) {
      if (k == null || k === false) return;
      e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    });
    return e;
  }
  function icon(d, cls) {
    var w = document.createElement('span');
    w.innerHTML = '<svg viewBox="0 0 24 24">' + d + '</svg>';
    var s = w.firstChild;
    if (cls) s.setAttribute('class', cls);
    return s;
  }
  var I = {
    sound: '<path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5H4z"/><path d="M15.8 9a4.4 4.4 0 0 1 0 6"/><path d="M18.4 6.4a8 8 0 0 1 0 11.2"/>',
    play: '<path d="M7.5 4.5l11.5 7.5-11.5 7.5z"/>',
    star: '<path class="fill" d="M12 3.6l2.55 5.4 5.85.78-4.3 4.12 1.1 5.9L12 16.94 6.8 19.8l1.1-5.9-4.3-4.12 5.85-.78z"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="M15.8 15.8L21 21"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    chev: '<path d="M9 4.5l7.5 7.5L9 19.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13"/>',
    back: '<path d="M15 4.5L7.5 12 15 19.5"/>',
    eye: '<path d="M2.2 12S6 6.2 12 6.2 21.8 12 21.8 12 18 17.8 12 17.8 2.2 12 2.2 12z"/><circle cx="12" cy="12" r="2.6"/>',
    check: '<path d="M4.5 12.5l5 5L20 6.5"/>',
    pen: '<path d="M4 20l4.2-1.1L19 8.1l-3.1-3.1L5.1 15.8 4 20z"/><path d="M14.6 5.9l3.5 3.5"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="1"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>',
    down: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
    up: '<path d="M12 20V9M7 13.5l5-5 5 5M4.5 4h15"/>'
  };

  var TABS = [
    ['train', 'Тренировка', '写'],
    ['browse', 'Иероглифы', '字'],
    ['rads', 'Ключи', '部'],
    ['sets', 'Наборы', '集'],
    ['ref', 'Справочник', '书']
  ];

  var root = document.getElementById('app');
  var headEl, mainEl, tabEl;
  var current = 'train';
  var session = null;
  var refPage = null;
  var panels = [];

  /* ================================================= уведомления */
  var toastTimer = null;
  function toast(msg, action) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var kids = [h('span', { class: 'grow', text: msg })];
    var t;
    if (action) {
      kids.push(h('button', {
        text: action.label, onclick: function () { t.remove(); action.fn(); }
      }));
    }
    t = h('div', { class: 'toast', role: 'status' }, kids);
    document.body.appendChild(t);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, action ? 7000 : 2600);
  }

  /* ============================ собственные диалоги (без prompt/confirm) */
  function dialog(opts) {
    return new Promise(function (resolve) {
      var input = null;
      if (opts.input) {
        input = h('input', {
          id: 'dlg-input', type: opts.inputType || 'text', value: opts.value || '',
          placeholder: opts.placeholder || '', maxlength: opts.maxlength || 60,
          autocomplete: 'off', spellcheck: 'false',
          inputmode: opts.inputType === 'password' ? 'numeric' : null
        });
      }
      function close(val) {
        wrap.remove();
        document.removeEventListener('keydown', onKey, true);
        if (!panels.length) document.body.style.overflow = '';
        resolve(val);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); close(null); }
        else if (e.key === 'Enter' && input) { e.preventDefault(); close(input.value.trim()); }
      }
      var box = h('div', { class: 'box' }, [
        h('h2', { text: opts.title }),
        opts.text ? h('p', { class: 'small muted', text: opts.text }) : null,
        input ? h('label', { class: 'fld', for: 'dlg-input' }, [input]) : null,
        h('div', { class: 'row', style: 'justify-content:flex-end;gap:8px' }, [
          h('button', { class: 'btn s quiet', text: opts.cancel || 'Отмена', onclick: function () { close(null); } }),
          h('button', {
            class: 'btn s ' + (opts.danger ? 'danger' : 'seal'),
            text: opts.ok || 'Готово',
            onclick: function () { close(input ? input.value.trim() : true); }
          })
        ])
      ]);
      var wrap = h('div', { class: 'panel dlg', onclick: function (e) { if (e.target === wrap) close(null); } }, [box]);
      document.body.appendChild(wrap);
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey, true);
      if (input) setTimeout(function () { input.focus(); input.select(); }, 30);
    });
  }
  function askText(title, value, opts) {
    return dialog(Object.assign({ title: title, input: true, value: value, ok: 'Сохранить' }, opts || {}));
  }
  function askYes(title, text, opts) {
    return dialog(Object.assign({ title: title, text: text, ok: 'Да' }, opts || {}))
      .then(function (v) { return v === true; });
  }

  /* ================================================== экран-панель */
  function openPanel(title, sub, build, onClose) {
    var inner = h('div', { class: 'in' });
    var bar = h('div', { class: 'bar' }, [
      h('button', { class: 'ib', 'aria-label': 'Закрыть', onclick: function () { closePanel(); } }, [icon(I.x)]),
      h('div', { class: 'grow' }, [h('b', { text: title }), sub ? h('span', { text: sub }) : null])
    ]);
    var box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [bar, inner]);
    var wrap = h('div', { class: 'panel', onclick: function (e) { if (e.target === wrap) closePanel(); } }, [box]);
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    panels.push({ el: wrap, onClose: onClose });
    try { build(inner, bar); } catch (err) {
      inner.appendChild(h('p', { class: 'note bad', text: 'Не удалось показать этот раздел.' }));
      if (window.console) console.error(err);
    }
    return inner;
  }
  function closePanel() {
    var p = panels.pop();
    if (!p) return false;
    p.el.remove();
    if (!panels.length) document.body.style.overflow = '';
    if (p.onClose) p.onClose();
    return true;
  }
  function closeAllPanels() { while (panels.length) closePanel(); }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panels.length && !document.querySelector('.dlg')) {
      e.preventDefault();
      closePanel();
    }
  });

  /* ====================================================== каркас */
  function buildShell() {
    headEl = h('div', { class: 'head' });
    mainEl = h('main');
    tabEl = h('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'Разделы' });
    TABS.forEach(function (t) {
      tabEl.appendChild(h('button', {
        role: 'tab', id: 'tab-' + t[0], 'aria-selected': current === t[0] ? 'true' : 'false',
        onclick: function () { go(t[0]); }
      }, [h('span', { class: 'mark han', text: t[2] }), h('span', { class: 'nm', text: t[1] })]));
    });
    root.textContent = '';
    root.appendChild(headEl);
    root.appendChild(mainEl);
    root.appendChild(tabEl);
  }

  function go(tab) {
    if (session && !session.done && tab !== 'train' && HZ.state.settings.confirmExit) {
      askYes('Прервать занятие?', 'Написанное сохранится — вернуться к сеансу можно в любой момент.', { ok: 'Выйти' })
        .then(function (yes) {
          if (!yes) return;
          persistSession();
          session = null;
          switchTo(tab);
        });
      return;
    }
    if (session && !session.done) persistSession();
    switchTo(tab);
  }
  function switchTo(tab) {
    if (tab !== 'train') session = null;
    if (tab !== 'ref' || current === 'ref') refPage = null;
    current = tab;
    Array.prototype.forEach.call(tabEl.children, function (b) {
      b.setAttribute('aria-selected', b.id === 'tab-' + tab ? 'true' : 'false');
    });
    render();
    window.scrollTo(0, 0);
  }

  function setHead(kicker, title, acts) {
    headEl.textContent = '';
    headEl.appendChild(h('div', { class: 'head-txt' }, [
      kicker ? h('span', { class: 'kicker', text: kicker }) : null,
      h('h1', { text: title })
    ]));
    if (acts && acts.length) headEl.appendChild(h('div', { class: 'acts' }, acts));
  }

  function render() {
    mainEl.textContent = '';
    try {
      if (current === 'train') renderTrain();
      else if (current === 'browse') renderBrowse();
      else if (current === 'rads') renderRads();
      else if (current === 'sets') renderSets();
      else renderRef();
    } catch (err) {
      mainEl.appendChild(h('p', { class: 'note bad', text: 'Что-то пошло не так при отрисовке этого раздела.' }));
      if (window.console) console.error(err);
    }
  }

  function section(label, body, note) {
    return h('section', {}, [
      h('div', { class: 'label' }, [h('span', { text: label })]),
      body,
      note ? h('p', { class: 'tiny dim', style: 'margin-top:10px', text: note }) : null
    ]);
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }
  function loadingBlock(text) {
    return h('div', { class: 'loading' }, [h('div', { class: 'spin' }), text || 'Загружаю…']);
  }
  function errorBlock(msg, retry) {
    return h('div', { class: 'stack s' }, [
      h('p', { class: 'note bad', text: msg }),
      retry ? h('button', { class: 'btn', onclick: retry, text: 'Попробовать снова' }) : null
    ]);
  }

  /* ============================================= общие компоненты */
  function toneTag(py) {
    var t = HZ.toneOf(py);
    return h('span', { class: 'tag t' + t, text: HZ.TONE_RU[t][0] });
  }
  function soundBtn(row) {
    return h('button', {
      class: 'ib', 'aria-label': 'Прослушать произношение',
      title: row[8] ? 'Прослушать' : 'Запись слога в исходном тоне (в речи знак читается нейтрально)',
      onclick: function (e) {
        e.stopPropagation();
        if (row[2]) {
          HZ.playKey(row[2]).then(function (ok) { if (!ok && !HZ.speak(row[0])) toast('Звук недоступен'); });
        } else if (!HZ.speak(row[0])) toast('Записи для этого слога нет');
      }
    }, [icon(I.sound)]);
  }

  function cell(row, opts) {
    opts = opts || {};
    var r = HZ.rec(row[0]);
    var kids = [
      h('span', { class: 'lv', text: 'HSK' + row[5] }),
      h('span', { class: 'g han', text: row[0] }),
      h('span', { class: 'p', text: row[1] }),
      h('span', { class: 'r', text: row[3] })
    ];
    if (HZ.state.fav.indexOf(row[0]) >= 0) kids.unshift(icon(I.star, 'fav'));
    if (r) {
      kids.push(h('span', { class: 'box', title: 'Закрепление ' + r.b + ' из 6' },
        [h('i', { style: 'width:' + Math.round(r.b / 6 * 100) + '%' })]));
    }
    var el = h('button', {
      class: 'cell', 'aria-pressed': (opts.isSelected && opts.isSelected(row[0])) ? 'true' : null,
      onclick: function () { opts.onClick ? opts.onClick(row, el) : openChar(row[0]); }
    }, kids);
    return el;
  }

  var observers = [];
  function grid(rows, opts) {
    var wrap = h('div');
    var g = h('div', { class: 'sheetgrid' });
    var n = 0, STEP = 120;
    var sentinel = h('div', { style: 'height:1px' });
    var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) more(); }, { rootMargin: '500px' });
    function more() {
      var end = Math.min(rows.length, n + STEP);
      for (; n < end; n++) g.appendChild(cell(rows[n], opts));
      if (n >= rows.length) { io.disconnect(); sentinel.remove(); }
    }
    wrap.appendChild(g);
    wrap.appendChild(sentinel);
    more();
    io.observe(sentinel);
    observers.push(io);
    if (observers.length > 6) observers.shift().disconnect();
    HZ.prefetch(rows.slice(0, 30).map(function (r) { return r[0]; }));
    return wrap;
  }

  /* ========================================== карточка иероглифа */
  var ETY = {
    pictographic: ['Пиктограмма', 'знак — упрощённый рисунок предмета'],
    ideographic: ['Идеограмма', 'значение складывается из смысла частей'],
    pictophonetic: ['Фоноидеограмма', 'одна часть даёт значение, другая — звучание']
  };
  var IDC_RU = {
    '⿰': 'слева направо', '⿱': 'сверху вниз', '⿲': 'три части слева направо',
    '⿳': 'три части сверху вниз', '⿴': 'полное обрамление', '⿵': 'обрамление сверху',
    '⿶': 'обрамление снизу', '⿷': 'обрамление слева', '⿸': 'обрамление сверху-слева',
    '⿹': 'обрамление сверху-справа', '⿺': 'обрамление снизу-слева', '⿻': 'наложение частей'
  };

  function openChar(ch) {
    var row = HZ.by(ch);
    if (!row) { toast('Знака ' + ch + ' нет в HSK 1–6'); return; }
    openPanel('Разбор знака', row[0] + ' · ' + row[1], function (inner, bar) {
      bar.appendChild(favBtn(ch));
      bar.appendChild(h('button', {
        class: 'ib', 'aria-label': 'Добавить в набор', title: 'Добавить в набор',
        onclick: function () { chooseSet([ch]); }
      }, [icon(I.plus)]));
      fill();
      function fill() {
        inner.textContent = '';
        inner.appendChild(loadingBlock('Собираю разбор…'));
        Promise.all([HZ.graphics(ch), HZ.detail(ch)]).then(function (res) {
          inner.textContent = '';
          buildCharSheet(inner, row, res[0], res[1]);
          if (HZ.state.settings.autoAudio && row[2]) HZ.playKey(row[2]);
        }).catch(function (e) {
          inner.textContent = '';
          inner.appendChild(errorBlock((e && e.message) || 'Не удалось загрузить знак.', fill));
        });
      }
    });
  }

  function favBtn(ch) {
    var b = h('button', {
      class: 'ib' + (HZ.state.fav.indexOf(ch) >= 0 ? ' on' : ''),
      'aria-label': 'В избранное', title: 'В избранное',
      onclick: function () {
        var now = HZ.toggleFav(ch);
        b.className = 'ib' + (now ? ' on' : '');
        toast(now ? 'В избранном' : 'Убрано из избранного', {
          label: 'Отменить',
          fn: function () { HZ.toggleFav(ch); b.className = 'ib' + (now ? '' : ' on'); }
        });
      }
    }, [icon(I.star)]);
    return b;
  }

  function buildCharSheet(inner, row, gr, det) {
    det = det || {};
    var clsAll = HZWriter.classifyAll(gr.m);

    var readings = h('div', { class: 'row wrap s' });
    ((det.a && det.a.length) ? det.a : [[row[1], row[2], row[8]]]).forEach(function (a) {
      readings.appendChild(h('button', {
        class: 'strokebtn', title: a[2] ? 'Прослушать' : 'Запись слога в исходном тоне',
        onclick: function () {
          if (a[1]) HZ.playKey(a[1]).then(function (ok) { if (!ok) HZ.speak(row[0]); });
          else HZ.speak(row[0]);
        }
      }, [icon(I.sound), h('span', { class: 'py', text: a[0] }), toneTag(a[0])]));
    });

    inner.appendChild(h('div', { class: 'glyph' }, [
      h('div', { class: 'big han', text: row[0] }),
      h('div', { class: 'm' }, [
        h('div', { class: 'row wrap s' }, [
          h('span', { class: 'tag hsk', text: 'HSK ' + row[5] }),
          h('span', { class: 'tag', text: row[6] + ' ' + plural(row[6], 'черта', 'черты', 'черт') }),
          h('span', { class: 'tag', text: '№' + row[7] + ' по частоте' })
        ]),
        h('div', { class: 'gloss', text: row[3] }),
        readings
      ])
    ]));

    var paper = h('div', { class: 'sheet big' });
    var writer = new HZWriter(paper, { grid: HZ.state.settings.grid, showNumbers: false });
    writer.load(gr, 'ref');
    writer.setLocked(true);

    inner.appendChild(h('div', { class: 'paper-wrap' }, [
      paper,
      h('div', { class: 'row wrap s', style: 'justify-content:center' }, [
        h('button', {
          class: 'btn s seal', onclick: function () { writer.opts.showNumbers = false; writer.animate({ speed: 1 }); }
        }, [icon(I.play), 'Показать написание']),
        h('button', {
          class: 'btn s', onclick: function () {
            writer.opts.showNumbers = !writer.opts.showNumbers;
            writer.load(gr, 'ref');
          }
        }, [icon(I.eye), 'Номера черт']),
        h('button', {
          class: 'btn s', onclick: function () { closeAllPanels(); startSession([row[0]], 'learn'); }
        }, [icon(I.pen), 'Писать'])
      ])
    ]));

    var strokes = h('div', { class: 'row wrap s' });
    clsAll.forEach(function (cls, i) {
      strokes.appendChild(h('button', {
        class: 'strokebtn', title: 'Показать эту черту',
        onclick: function () { writer.load(gr, 'blind'); writer.reveal(i); }
      }, [
        h('span', { class: 'n', text: String(i + 1) }),
        h('span', { class: 'z han', text: cls.zh }),
        h('span', { text: cls.ru })
      ]));
    });
    inner.appendChild(section('Черты по порядку', strokes,
      'Порядок взят из данных о написании и точен. Название типа черты выводится автоматически по её форме — иногда приблизительно.'));

    var parts = h('div', {});
    var radical = row[4];
    var top = det.d ? det.d.p.map(function (x) { return x.c; }) : [];
    if (top.indexOf(radical) < 0) parts.appendChild(partRow(radical, true, 0));
    if (det.d) {
      det.d.p.forEach(function (p) {
        parts.appendChild(partRow(p.c, p.c === radical, 0));
        if (p.d) p.d.p.forEach(function (q) { parts.appendChild(partRow(q.c, false, 1)); });
      });
    } else {
      parts.appendChild(h('p', { class: 'note', text: 'Знак не делится на части — это простой знак или сам ключ.' }));
    }
    inner.appendChild(section('Ключ и части', parts,
      det.d && det.d.i ? 'Строение: ' + (IDC_RU[det.d.i] || 'составное') : null));

    if (det.e && det.e.type) {
      var e = ETY[det.e.type] || ['Составной знак', ''];
      var kids = [h('p', { class: 'lede', text: e[1] })];
      if (det.e.semantic) {
        var sc = HZ.comp(det.e.semantic) || {};
        kids.push(h('p', { class: 'small' }, [
          h('b', { text: 'Значение — ' }), h('span', { class: 'han', text: det.e.semantic }),
          h('span', { text: ' ' + (sc.r || '') })
        ]));
      }
      if (det.e.phonetic) {
        var pc = HZ.comp(det.e.phonetic) || {};
        kids.push(h('p', { class: 'small' }, [
          h('b', { text: 'Звучание — ' }), h('span', { class: 'han', text: det.e.phonetic }),
          h('span', { class: 'py', text: pc.p ? ' ' + pc.p : '' })
        ]));
      }
      inner.appendChild(section(e[0], h('div', { class: 'stack xs' }, kids)));
    }

    if (det.f && det.f.length) {
      inner.appendChild(section('Значения · БКРС',
        h('ol', { class: 'defs' }, det.f.map(function (s) { return h('li', {}, [h('span', { text: s })]); }))));
    }

    if (det.w && det.w.length) {
      var box = h('div', {});
      det.w.forEach(function (w) {
        box.appendChild(h('div', { class: 'word' }, [
          h('button', {
            class: 'ib', style: 'width:30px;height:30px', 'aria-label': 'Произнести слово',
            onclick: function () { if (!HZ.speak(w[0])) toast('Синтез речи недоступен'); }
          }, [icon(I.sound)]),
          h('span', { class: 'w han', text: w[0] }),
          h('span', { class: 'p', text: w[1] }),
          h('span', { class: 'r', text: w[2] }),
          h('span', { class: 'tag hsk', text: 'HSK' + w[3] })
        ]));
      });
      inner.appendChild(section('Слова с этим знаком', box,
        'Слова произносит синтез речи устройства — отдельных записей для слов нет.'));
    }
  }

  function partRow(ch, isRadical, depth) {
    var c = HZ.comp(ch) || {};
    return h('button', {
      class: 'part' + (depth ? ' sub' : ''),
      onclick: function () {
        if (HZ.by(ch)) openChar(ch);
        else toast(ch + ' — ' + (c.r || 'часть знака') + (c.p ? ' · ' + c.p : ''));
      }
    }, [
      h('span', { class: 'g han', text: ch }),
      h('span', { class: 't' }, [
        h('b', { text: c.r || '—' }),
        h('span', {
          text: [c.p, c.n ? c.n + ' ' + plural(c.n, 'черта', 'черты', 'черт') : '', c.b ? 'от ' + c.b : '']
            .filter(Boolean).join(' · ')
        })
      ]),
      isRadical ? h('span', { class: 'key', text: 'КЛЮЧ' }) : null
    ]);
  }

  /* ================================================ выбор набора */
  function chooseSet(chars) {
    openPanel('В какой набор?', chars.length + ' ' + plural(chars.length, 'знак', 'знака', 'знаков'), function (inner) {
      function pick(id, name) {
        var have = HZ.setChars(id);
        var all = chars.every(function (c) { return have.indexOf(c) >= 0; });
        return h('button', {
          class: 'rowitem', onclick: function () {
            var n = HZ.addTo(id, chars);
            closePanel();
            toast(n ? 'В «' + name + '» добавлено: ' + n : 'Уже в наборе', n ? {
              label: 'Отменить',
              fn: function () {
                chars.forEach(function (c) { HZ.removeFrom(id, c); });
                if (current === 'sets') render();
              }
            } : null);
            if (current === 'sets') render();
          }
        }, [
          h('span', { class: 'lead sm', text: all ? '✓' : '+' }),
          h('span', { class: 'm' }, [
            h('b', { text: name }),
            h('span', { text: have.length + ' ' + plural(have.length, 'знак', 'знака', 'знаков') })
          ]),
          icon(I.chev, 'chev')
        ]);
      }
      var rows = h('div', { class: 'rows' }, [pick('fav', 'Избранное')].concat(
        HZ.state.sets.map(function (s) { return pick(s.id, s.name); })));
      inner.appendChild(rows);
      inner.appendChild(h('button', {
        class: 'btn wide', onclick: function () {
          askText('Новый набор', 'Набор ' + (HZ.state.sets.length + 1), { placeholder: 'Название' })
            .then(function (name) {
              if (name == null) return;
              var id = HZ.createSet(name || 'Набор');
              HZ.addTo(id, chars);
              closePanel();
              toast('Создан набор «' + HZ.setName(id) + '»');
              if (current === 'sets') render();
            });
        }
      }, [icon(I.plus), 'Новый набор']));
    });
  }

  /* =================================================== ТРЕНИРОВКА */
  var MODES = {
    learn: ['Знакомство', 'Показываю написание, вы обводите по контуру'],
    memory: ['По памяти', 'Даю чтение и перевод — пишете сами, подсказка по запросу'],
    test: ['Проверка', 'Только перевод, без контура и подсказок']
  };
  var pickMode = 'learn';
  var pickSet = 'hsk1';

  function renderTrain() {
    if (session) { renderSession(); return; }
    setHead('занятие', 'Тренировка');

    var draft = HZ.loadSession();
    var dueAll = HZ.idx.filter(function (r) { return HZ.rec(r[0]) && HZ.isDue(r[0]); }).length;
    var known = Object.keys(HZ.state.srs).length;
    var dk = new Date().toISOString().slice(0, 10);
    var todayN = HZ.state.stats.days[dk] || 0;
    var body = h('div', { class: 'stack' });

    if (draft && draft.i < draft.list.length) {
      body.appendChild(h('div', { class: 'stack s' }, [
        h('p', {
          class: 'note warn',
          text: 'Незаконченное занятие: ' + MODES[draft.mode][0].toLowerCase() + ', ' +
            (draft.i + 1) + ' из ' + draft.list.length + '.'
        }),
        h('div', { class: 'row s' }, [
          h('button', { class: 'btn s seal', text: 'Продолжить', onclick: function () { resumeSession(draft); } }),
          h('button', { class: 'btn s quiet', text: 'Забыть', onclick: function () { HZ.clearSession(); render(); } })
        ])
      ]));
    }

    body.appendChild(h('div', { class: 'figures' }, [
      fig(todayN, 'сегодня'), fig(dueAll, 'повторить'),
      fig(known, 'начато'), fig(HZ.state.stats.strokes, 'черт')
    ]));

    body.appendChild(section('Как тренируем', h('div', { class: 'stack s' }, [
      h('div', { class: 'seg' }, Object.keys(MODES).map(function (m) {
        return h('button', {
          'aria-pressed': pickMode === m ? 'true' : 'false', text: MODES[m][0],
          onclick: function () { pickMode = m; render(); }
        });
      })),
      h('p', { class: 'tiny dim', text: MODES[pickMode][1] })
    ])));

    var chipsRow = h('div', { class: 'chips' });
    [{ id: 'due', n: 'К повторению' }, { id: 'fav', n: 'Избранное' }, { id: 'hard', n: 'Трудные' }]
      .concat(HZ.virtualSets().map(function (s) { return { id: s.id, n: s.name }; }))
      .concat(HZ.state.sets.map(function (s) { return { id: s.id, n: s.name }; }))
      .forEach(function (s) {
        chipsRow.appendChild(h('button', {
          class: 'chip', 'aria-pressed': pickSet === s.id ? 'true' : 'false',
          text: s.n + ' · ' + HZ.setChars(s.id).length,
          onclick: function () { pickSet = s.id; render(); }
        }));
      });
    body.appendChild(section('Что тренируем', chipsRow));
    setTimeout(function () {
      var on = chipsRow.querySelector('[aria-pressed="true"]');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, 0);

    var chars = HZ.setChars(pickSet);
    body.appendChild(h('button', {
      class: 'btn seal wide', disabled: chars.length ? null : 'disabled',
      onclick: function () { if (chars.length) startSession(chars, pickMode); }
    }, [icon(I.pen), 'Начать · ' + HZ.setName(pickSet)]));

    if (chars.length) {
      var queue = orderChars(chars).slice(0, 12).map(function (c) { return HZ.by(c); }).filter(Boolean);
      body.appendChild(section('Первые в очереди', grid(queue, {}),
        chars.length > 24 ? 'За один сеанс — до 24 знаков, остальные в следующий раз.' : null));
    } else {
      body.appendChild(h('div', { class: 'empty' }, [
        h('span', { class: 'mk han', text: '空' }),
        h('p', { text: 'В наборе «' + HZ.setName(pickSet) + '» пока нет знаков. Найдите их во вкладке «Иероглифы» и добавьте.' })
      ]));
    }
    mainEl.appendChild(body);
  }

  function fig(n, label) {
    return h('div', { class: 'fig' }, [h('b', { class: 'num', text: String(n) }), h('span', { text: label })]);
  }

  function orderChars(chars) {
    return chars.slice().sort(function (a, b) {
      var ra = HZ.rec(a), rb = HZ.rec(b);
      var da = ra ? ra.d : 1e9, dbb = rb ? rb.d : 1e9;
      if (da !== dbb) return da - dbb;
      var A = HZ.by(a), B = HZ.by(b);
      return (A ? A[7] : 9999) - (B ? B[7] : 9999);
    });
  }

  /* ------------------------------------------------------- сеанс */
  function startSession(chars, mode) {
    var list = orderChars((chars || []).filter(function (c) { return HZ.by(c); }));
    if (!list.length) { toast('Нечего тренировать'); return; }
    if (list.length > 24) list = list.slice(0, 24);
    session = { list: list, i: 0, mode: mode, res: [], errors: 0, hints: 0, startedAt: Date.now(), done: false };
    persistSession();
    HZ.prefetch(list);
    current = 'train';
    refPage = null;
    Array.prototype.forEach.call(tabEl.children, function (b) {
      b.setAttribute('aria-selected', b.id === 'tab-train' ? 'true' : 'false');
    });
    render();
    window.scrollTo(0, 0);
  }
  function resumeSession(draft) {
    session = {
      list: draft.list, i: draft.i, mode: draft.mode, res: draft.res || [],
      errors: draft.errors || 0, hints: draft.hints || 0,
      startedAt: draft.startedAt || Date.now(), done: false
    };
    HZ.prefetch(session.list);
    render();
    window.scrollTo(0, 0);
  }
  function persistSession() {
    if (!session) return;                       // вне сеанса черновик не трогаем
    if (session.done || session.i >= session.list.length) { HZ.clearSession(); return; }
    HZ.saveSession({
      at: Date.now(), list: session.list, i: session.i, mode: session.mode,
      res: session.res, errors: session.errors, hints: session.hints, startedAt: session.startedAt
    });
  }
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { persistSession(); HZ.save(); }
  });
  window.addEventListener('pagehide', function () { persistSession(); });

  function renderSession() {
    var s = session;
    if (s.i >= s.list.length) { s.done = true; HZ.clearSession(); renderSummary(); return; }
    var ch = s.list[s.i];
    var row = HZ.by(ch);
    setHead(MODES[s.mode][0].toLowerCase(), (s.i + 1) + ' из ' + s.list.length, [
      h('button', { class: 'ib', 'aria-label': 'Закончить занятие', onclick: function () { go('train'); } }, [icon(I.x)])
    ]);
    var host = h('div');
    mainEl.appendChild(host);
    function load() {
      host.textContent = '';
      host.appendChild(loadingBlock('Готовлю пропись…'));
      HZ.graphics(ch).then(function (gr) {
        host.textContent = '';
        buildTask(host, row, gr);
      }).catch(function (e) {
        host.textContent = '';
        host.appendChild(errorBlock(((e && e.message) || 'Не удалось загрузить знак.') + ' Проверьте соединение.', load));
        host.appendChild(h('button', {
          class: 'btn quiet', style: 'margin-top:12px', text: 'Пропустить знак',
          onclick: function () { s.i++; persistSession(); mainEl.textContent = ''; renderSession(); }
        }));
      });
    }
    load();
  }

  function buildTask(host, row, gr) {
    var s = session;
    var clsAll = HZWriter.classifyAll(gr.m);
    var st = { errors: 0, hints: 0, done: false };

    var paper = h('div', { class: 'sheet' });
    var dots = h('div', { class: 'dots' });
    var verdict = h('div', { class: 'verdict', role: 'status' });
    var controls = h('div', { class: 'stack s' });

    var writer = new HZWriter(paper, {
      grid: HZ.state.settings.grid,
      showNumbers: s.mode === 'learn' && HZ.state.settings.numbers,
      tolerance: HZ.TOL[HZ.state.settings.tolerance] || 175,
      onStroke: onStroke
    });
    writer.load(gr, s.mode === 'learn' ? 'trace' : 'blind');
    writer.setLocked(true);

    function drawDots() {
      dots.textContent = '';
      var p = writer.progress();
      for (var i = 0; i < p.total; i++) {
        dots.appendChild(h('i', { class: i < p.done ? 'done' : (i === p.done ? 'now' : '') }));
      }
    }
    function say(cls, text) {
      verdict.className = 'verdict' + (cls ? ' ' + cls : '');
      verdict.textContent = text;
    }

    function onStroke(r) {
      if (r.ignored) return;
      if (r.ok) {
        var c = clsAll[r.index];
        say('good', 'Верно · черта ' + (r.index + 1) + ': ' + c.ru + ' ' + c.zh);
        drawDots();
        if (r.done >= r.total) finish();
        return;
      }
      st.errors++; s.errors++;
      writer.shake();
      say('bad', reasonText(r));
      drawDots();
      var limit = HZ.state.settings.hintAfter || 3;
      if (s.mode !== 'test' && r.attempts >= limit) {
        st.hints++; s.hints++;
        say('hint', 'Смотрите, как ведётся черта ' + (r.expect + 1) + ': ' + clsAll[r.expect].ru);
        writer.reveal(r.expect);
      }
    }
    function reasonText(r) {
      var n = r.expect + 1;
      if (r.reason === 'order' && r.confused >= 0) return 'Это черта № ' + (r.confused + 1) + '. Сейчас нужна ' + n + '-я.';
      if (r.reason === 'dir') return 'Черта ' + n + ' ведётся в другую сторону.';
      if (r.reason === 'start') return 'Черта ' + n + ' начинается в другом месте.';
      if (r.reason === 'len') return 'Черта ' + n + ': не та длина — проведите её целиком.';
      return 'Не та черта. Нужна ' + n + '-я: ' + clsAll[r.expect].ru + ' ' + clsAll[r.expect].zh;
    }

    function finish() {
      st.done = true;
      writer.setLocked(true);
      writer.load(gr, 'ref');
      say('good', st.errors === 0 ? 'Безошибочно.' : 'Готово · ошибок: ' + st.errors);
      if (HZ.state.settings.autoAudio && row[2]) HZ.playKey(row[2]);
      var g = HZ.grade(row[0], { errors: st.errors, hints: st.hints, strokes: gr.s.length });
      s.res.push({ ch: row[0], errors: st.errors, hints: st.hints, box: g.b });
      s.i++;
      persistSession();

      var d = HZ.stepDays(g.b);
      controls.textContent = '';
      controls.appendChild(h('div', { class: 'row' }, [
        h('span', { class: 'han', style: 'font-size:36px;line-height:1', text: row[0] }),
        h('div', { class: 'grow' }, [
          h('div', { class: 'row s' }, [h('span', { class: 'py', text: row[1] }), toneTag(row[1])]),
          h('div', { class: 'small muted', text: row[3] })
        ]),
        soundBtn(row)
      ]));
      controls.appendChild(h('p', {
        class: 'tiny dim',
        text: 'Следующее повторение: ' + (d === 0 ? 'ещё раз сегодня' : 'через ' + d + ' ' + plural(d, 'день', 'дня', 'дней'))
      }));
      controls.appendChild(h('div', { class: 'row wrap s' }, [
        h('button', { class: 'btn s', onclick: function () { openChar(row[0]); } }, [icon(I.eye), 'Разбор']),
        h('button', { class: 'btn s', onclick: again }, [icon(I.pen), 'Ещё раз']),
        h('span', { class: 'grow' }),
        h('button', {
          class: 'btn s seal', onclick: function () { mainEl.textContent = ''; renderSession(); }
        }, [s.i >= s.list.length ? 'Итоги' : 'Дальше', icon(I.chev)])
      ]));
    }

    function again() {
      s.i = Math.max(0, s.i - 1);
      if (s.res.length) s.res.pop();
      st = { errors: 0, hints: 0, done: false };
      writer.load(gr, s.mode === 'learn' ? 'trace' : 'blind');
      writer.setLocked(false);
      say('', '');
      drawDots();
      buildControls();
      persistSession();
    }

    function buildControls() {
      controls.textContent = '';
      controls.appendChild(h('div', { class: 'row wrap s' }, [
        h('button', {
          class: 'btn s', onclick: function () {
            writer.load(gr, 'view');
            writer.animate({
              speed: 1, onEnd: function () {
                writer.load(gr, s.mode === 'learn' ? 'trace' : 'blind');
                writer.setLocked(false);
                drawDots();
              }
            });
          }
        }, [icon(I.play), 'Показать']),
        h('button', {
          class: 'btn s', onclick: function () {
            var n = writer.nextIndex();
            if (n < 0) return;
            st.hints++; s.hints++;
            writer.reveal(n);
            say('hint', 'Черта ' + (n + 1) + ': ' + clsAll[n].ru);
          }
        }, [icon(I.eye), 'Подсказка']),
        h('button', {
          class: 'btn s quiet', text: 'Сбросить', onclick: function () {
            writer.load(gr, s.mode === 'learn' ? 'trace' : 'blind');
            writer.setLocked(false);
            say('', '');
            drawDots();
          }
        }),
        h('span', { class: 'grow' }),
        h('button', {
          class: 'btn s quiet', text: 'Пропустить', onclick: function () {
            s.i++; persistSession(); mainEl.textContent = ''; renderSession();
          }
        })
      ]));
    }

    var task = h('div', { class: 'stack xs' }, [
      h('div', { class: 'label' }, [h('span', { text: 'Напишите знак' })]),
      h('div', { class: 'row wrap s' }, [
        s.mode !== 'test' ? h('span', { class: 'py', style: 'font-size:19px', text: row[1] }) : null,
        s.mode !== 'test' ? toneTag(row[1]) : null,
        s.mode !== 'test' ? soundBtn(row) : null,
        h('span', { class: 'tag', text: row[6] + ' ' + plural(row[6], 'черта', 'черты', 'черт') })
      ].filter(Boolean)),
      h('p', { class: 'lede', text: row[3] })
    ]);

    host.appendChild(h('div', { class: 'practice' }, [
      h('div', { class: 'stack s', style: 'align-items:center' }, [paper, dots, verdict]),
      h('div', { class: 'stack', style: 'gap:20px' }, [task, controls])
    ]));

    drawDots();
    buildControls();

    if (s.mode === 'learn') {
      writer.load(gr, 'view');
      writer.animate({
        speed: 1.3, onEnd: function () {
          writer.load(gr, 'trace');
          writer.setLocked(false);
          drawDots();
        }
      });
    } else {
      writer.setLocked(false);
    }
  }

  function renderSummary() {
    var s = session;
    setHead('занятие окончено', 'Итоги');
    var clean = s.res.filter(function (r) { return r.errors === 0 && r.hints === 0; }).length;
    var mins = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
    var hard = s.res.filter(function (r) { return r.errors >= 3 || r.hints > 0; });
    var mode = s.mode;

    mainEl.appendChild(h('div', { class: 'stack' }, [
      h('div', { class: 'figures' }, [
        fig(s.res.length, 'знаков'), fig(clean, 'без ошибок'),
        fig(s.errors, 'ошибок'), fig(mins, plural(mins, 'минута', 'минуты', 'минут'))
      ]),
      hard.length
        ? section('Стоит повторить', grid(hard.map(function (r) { return HZ.by(r.ch); }).filter(Boolean), {}))
        : h('p', { class: 'note', text: 'Ни одной заминки — можно двигаться дальше.' }),
      h('div', { class: 'row wrap s' }, [
        hard.length ? h('button', {
          class: 'btn', text: 'Повторить трудные',
          onclick: function () { startSession(hard.map(function (r) { return r.ch; }), mode); }
        }) : null,
        h('span', { class: 'grow' }),
        h('button', { class: 'btn seal', onclick: function () { session = null; render(); } }, [icon(I.check), 'Завершить'])
      ].filter(Boolean))
    ]));
  }

  /* ==================================================== ИЕРОГЛИФЫ */
  var bq = '', bfilter = { sort: 'freq' }, bselect = null;

  function renderBrowse() {
    var chipsEl = h('div', { class: 'stack xs' });
    var selBar = h('div');
    var results = h('div');
    var cntEl = null;

    var input = h('input', {
      id: 'q', type: 'search', value: bq, placeholder: 'иероглиф, пиньинь или перевод',
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false'
    });
    var t = null;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { bq = input.value; refresh(); }, 230);
    });

    var selBtn = h('button', {
      class: 'ib', 'aria-label': 'Выбрать несколько', title: 'Выбрать несколько',
      onclick: function () { bselect = bselect ? null : []; refresh(); }
    }, [icon(I.check)]);

    mainEl.appendChild(h('div', { class: 'stack s' }, [
      h('label', { class: 'fld', for: 'q' }, [icon(I.search), input]),
      h('p', { class: 'tiny dim', text: 'Пиньинь — как удобно: hao, hao3 или hǎo. Перевод — по части слова.' }),
      chipsEl
    ]));
    mainEl.appendChild(selBar);
    mainEl.appendChild(h('div', { style: 'height:18px' }));
    mainEl.appendChild(results);

    function refresh() {
      var res = HZ.search(bq, bfilter);
      setHead(res.length + ' из ' + HZ.idx.length, 'Иероглифы', [selBtn]);
      selBtn.className = 'ib' + (bselect ? ' on' : '');

      chipsEl.textContent = '';
      var lv = h('div', { class: 'chips' });
      lv.appendChild(chip('Все уровни', !bfilter.level, function () { delete bfilter.level; refresh(); }));
      for (var l = 1; l <= 6; l++) (function (l) {
        lv.appendChild(chip('HSK ' + l, bfilter.level === l, function () {
          if (bfilter.level === l) delete bfilter.level; else bfilter.level = l;
          refresh();
        }));
      })(l);
      var so = h('div', { class: 'chips' });
      [['freq', 'по частоте'], ['hsk', 'по HSK'], ['strokes', 'по числу черт']].forEach(function (x) {
        so.appendChild(chip(x[1], bfilter.sort === x[0], function () { bfilter.sort = x[0]; refresh(); }));
      });
      if (bfilter.radical) {
        so.appendChild(chip('ключ ' + bfilter.radical + ' ✕', true, function () { delete bfilter.radical; refresh(); }));
      }
      chipsEl.appendChild(lv);
      chipsEl.appendChild(so);

      selBar.textContent = '';
      cntEl = null;
      if (bselect) {
        cntEl = h('span', { class: 'grow small', text: 'Отмечено: ' + bselect.length });
        selBar.appendChild(h('div', {
          class: 'row wrap s', style: 'padding:12px 0;border-bottom:1px solid var(--rule)'
        }, [
          cntEl,
          h('button', {
            class: 'btn s', onclick: function () {
              if (!bselect.length) { toast('Сначала отметьте знаки'); return; }
              chooseSet(bselect.slice());
            }
          }, [icon(I.plus), 'В набор']),
          h('button', {
            class: 'btn s', onclick: function () {
              if (!bselect.length) { toast('Сначала отметьте знаки'); return; }
              startSession(bselect.slice(), pickMode);
            }
          }, [icon(I.pen), 'Писать'])
        ]));
      }

      results.textContent = '';
      if (!res.length) {
        results.appendChild(h('div', { class: 'empty' }, [
          h('span', { class: 'mk han', text: '無' }),
          h('p', { text: 'Ничего не нашлось. Попробуйте пиньинь без тонов или часть перевода.' })
        ]));
        return;
      }
      results.appendChild(grid(res, {
        isSelected: bselect ? function (c) { return bselect.indexOf(c) >= 0; } : null,
        onClick: bselect ? function (row, el) {
          var i = bselect.indexOf(row[0]);
          if (i >= 0) { bselect.splice(i, 1); el.removeAttribute('aria-pressed'); }
          else { bselect.push(row[0]); el.setAttribute('aria-pressed', 'true'); }
          if (cntEl) cntEl.textContent = 'Отмечено: ' + bselect.length;
        } : null
      }));
    }
    refresh();
  }

  function chip(label, on, fn) {
    return h('button', { class: 'chip', 'aria-pressed': on ? 'true' : 'false', text: label, onclick: fn });
  }

  /* ======================================================= КЛЮЧИ */
  function renderRads() {
    var rads = HZ.rads();
    setHead(rads.length + ' ключей в HSK', 'Ключи');
    mainEl.appendChild(h('div', { class: 'stack' }, [
      h('p', { class: 'note', text: 'Ключ (部首) — часть знака, которая обычно отвечает за смысл. Зная полторы сотни ключей, вы начинаете угадывать значение незнакомых иероглифов. Ниже — ключи, встречающиеся в HSK 1–6, от самых частых.' }),
      h('div', { class: 'rows' }, rads.map(function (r) {
        return h('button', {
          class: 'rowitem', onclick: function () {
            bfilter = { sort: 'freq', radical: r[0] };
            bq = '';
            switchTo('browse');
          }
        }, [
          h('span', { class: 'lead han', text: r[0] }),
          h('span', { class: 'm' }, [
            h('b', { text: r[2] || '—' }),
            h('span', {
              text: [r[1], r[3] + ' ' + plural(r[3], 'черта', 'черты', 'черт'), r[5] ? 'от ' + r[5] : '']
                .filter(Boolean).join(' · ')
            })
          ]),
          h('span', { class: 'tr', text: r[4] + ' зн.' }),
          icon(I.chev, 'chev')
        ]);
      }))
    ]));
  }

  /* ====================================================== НАБОРЫ */
  function renderSets() {
    setHead('списки для тренировки', 'Наборы', [
      h('button', {
        class: 'ib', 'aria-label': 'Новый набор', title: 'Новый набор',
        onclick: function () {
          askText('Новый набор', 'Набор ' + (HZ.state.sets.length + 1), { placeholder: 'Название' })
            .then(function (n) { if (n == null) return; HZ.createSet(n || 'Набор'); render(); });
        }
      }, [icon(I.plus)])
    ]);
    mainEl.appendChild(h('div', { class: 'stack' }, [
      section('Собираются сами', h('div', { class: 'rows' }, [
        setRow('due', 'К повторению', 'по расписанию'),
        setRow('fav', 'Избранное', 'помеченные звёздочкой'),
        setRow('hard', 'Трудные', 'где было больше всего ошибок')
      ])),
      section('Уровни HSK', h('div', { class: 'rows' },
        HZ.virtualSets().map(function (s) { return setRow(s.id, s.name, 'официальный список'); }))),
      section('Мои наборы', HZ.state.sets.length
        ? h('div', { class: 'rows' }, HZ.state.sets.map(function (s) { return setRow(s.id, s.name, 'мой набор'); }))
        : h('div', { class: 'empty' }, [
          h('span', { class: 'mk han', text: '集' }),
          h('p', { text: 'Своих наборов пока нет. Отметьте иероглифы во вкладке «Иероглифы» и соберите свой список.' })
        ]))
    ]));
  }

  function setRow(id, name, note) {
    var chars = HZ.setChars(id);
    return h('button', { class: 'rowitem', onclick: function () { openSet(id); } }, [
      h('span', { class: 'lead han', text: chars.length ? chars[0] : '·' }),
      h('span', { class: 'm' }, [
        h('b', { text: name }),
        h('span', { text: note + ' · ' + chars.length + ' ' + plural(chars.length, 'знак', 'знака', 'знаков') })
      ]),
      icon(I.chev, 'chev')
    ]);
  }

  function openSet(id) {
    var editable = HZ.isOwnSet(id) || id === 'fav';
    openPanel(HZ.setName(id), null, function (inner) {
      var editing = false;
      function draw() {
        var chars = HZ.setChars(id);
        var rows = chars.map(function (c) { return HZ.by(c); }).filter(Boolean);
        inner.textContent = '';
        inner.appendChild(h('div', { class: 'row wrap s' }, [
          h('button', {
            class: 'btn s seal', onclick: function () {
              if (!chars.length) { toast('Набор пуст'); return; }
              pickSet = id;
              closeAllPanels();
              startSession(chars, pickMode);
            }
          }, [icon(I.pen), 'Тренировать']),
          editable && chars.length ? h('button', {
            class: 'btn s', 'aria-pressed': editing ? 'true' : 'false',
            text: editing ? 'Готово' : 'Убрать знаки',
            onclick: function () { editing = !editing; draw(); }
          }) : null,
          HZ.isOwnSet(id) ? h('button', {
            class: 'btn s quiet', text: 'Переименовать', onclick: function () {
              askText('Название набора', HZ.setName(id)).then(function (n) {
                if (n == null) return;
                HZ.renameSet(id, n);
                closePanel();
                render();
              });
            }
          }) : null,
          HZ.isOwnSet(id) ? h('button', {
            class: 'btn s danger', onclick: function () {
              askYes('Удалить набор «' + HZ.setName(id) + '»?', 'Сами иероглифы останутся в базе.',
                { ok: 'Удалить', danger: true }).then(function (yes) {
                  if (!yes) return;
                  var backup = HZ.deleteSet(id);
                  closePanel();
                  render();
                  toast('Набор удалён', {
                    label: 'Вернуть', fn: function () { HZ.restoreSet(backup); render(); }
                  });
                });
            }
          }, [icon(I.trash), 'Удалить']) : null
        ].filter(Boolean)));

        if (!rows.length) {
          inner.appendChild(h('div', { class: 'empty' }, [
            h('span', { class: 'mk han', text: '空' }),
            h('p', { text: 'Здесь пока пусто.' })
          ]));
          return;
        }
        if (editing) inner.appendChild(h('p', { class: 'note warn', text: 'Нажмите на знак, чтобы убрать его из набора.' }));
        inner.appendChild(grid(rows, {
          onClick: editing ? function (row) {
            HZ.removeFrom(id, row[0]);
            draw();
            toast('Знак ' + row[0] + ' убран', {
              label: 'Вернуть', fn: function () { HZ.addTo(id, [row[0]]); draw(); }
            });
          } : null
        }));
      }
      draw();
    }, function () { if (current === 'sets') render(); });
  }

  /* ================================================== СПРАВОЧНИК */
  var RULES = [
    ['Сверху вниз', 'Верхние части знака пишутся раньше нижних.', '二'],
    ['Слева направо', 'Левая часть — раньше правой.', '叶'],
    ['Горизонталь раньше вертикали', 'Если черты пересекаются, сначала горизонтальная.', '十'],
    ['Откидная влево раньше откидной вправо', 'Сначала 撇, затем 捺.', '人'],
    ['Снаружи внутрь', 'Охватывающие черты — до внутренних.', '同'],
    ['Изнутри наружу', 'Для рамок, открытых сверху, внутреннее — раньше.', '凶'],
    ['Рамка закрывается последней', 'Нижняя черта обрамления — самая последняя.', '国'],
    ['Сначала центр, потом боковые', 'Центральная вертикаль — раньше точек по бокам.', '小'],
    ['Пронизывающая черта — последней', 'Вертикаль, проходящая сквозь знак, пишется в конце.', '中'],
    ['Левая вертикаль раньше закрытия', 'В 口 и 日 сначала левая вертикаль.', '日'],
    ['Точка сверху или слева — первой', 'Верхняя точка пишется до остального.', '衣'],
    ['Точка справа или внутри — последней', 'Такая точка завершает знак.', '我']
  ];
  var BASIC = [
    ['横', 'héng', 'горизонтальная', 'слева направо, чуть вверх', '一'],
    ['竖', 'shù', 'вертикальная', 'строго сверху вниз', '十'],
    ['撇', 'piě', 'откидная влево', 'сверху вниз-влево, с утончением', '人'],
    ['捺', 'nà', 'откидная вправо', 'сверху вниз-вправо, с нажимом', '八'],
    ['点', 'diǎn', 'точка', 'короткое движение с нажимом', '小'],
    ['提', 'tí', 'восходящая', 'снизу вверх-вправо', '打'],
    ['折', 'zhé', 'ломаная', 'одна черта с изломом, без отрыва', '口'],
    ['钩', 'gōu', 'крюк', 'резкий крючок в конце черты', '你']
  ];

  function renderRef() {
    if (refPage === 'rules') return pageRules();
    if (refPage === 'basic') return pageBasic();
    if (refPage === 'tones') return pageTones();
    if (refPage === 'settings') return pageSettings();
    if (refPage === 'safety') return pageSafety();
    if (refPage === 'about') return pageAbout();

    setHead('правила, настройки, итоги', 'Справочник');
    var known = Object.keys(HZ.state.srs).length;
    var mastered = Object.keys(HZ.state.srs).filter(function (c) { return HZ.state.srs[c].b >= 4; }).length;
    var days = Object.keys(HZ.state.stats.days).length;

    mainEl.appendChild(h('div', { class: 'stack' }, [
      h('div', { class: 'figures' }, [
        fig(known, 'знаков начато'), fig(mastered, 'закрепилось'),
        fig(HZ.state.stats.strokes, 'черт написано'), fig(days, plural(days, 'день', 'дня', 'дней'))
      ]),
      section('Как писать', h('div', { class: 'rows' }, [
        refRow('rules', '順', 'Порядок черт', '12 правил с примерами'),
        refRow('basic', '永', 'Восемь базовых черт', 'название и движение каждой'),
        refRow('tones', '声', 'Четыре тона', 'послушать и различить')
      ])),
      section('Приложение', h('div', { class: 'rows' }, [
        refRow('settings', '設', 'Настройки', 'клетка, строгость проверки, звук'),
        refRow('safety', '守', 'Сохранность и доступ', 'копии, код доступа, перенос'),
        refRow('about', '源', 'Источники', 'откуда данные, словарь и записи')
      ]))
    ]));
  }
  function refRow(page, mark, title, note) {
    return h('button', {
      class: 'rowitem', onclick: function () { refPage = page; render(); window.scrollTo(0, 0); }
    }, [
      h('span', { class: 'lead han', text: mark }),
      h('span', { class: 'm' }, [h('b', { text: title }), h('span', { text: note })]),
      icon(I.chev, 'chev')
    ]);
  }
  function refHead(kicker, title) {
    setHead(kicker, title, []);
    headEl.insertBefore(h('button', {
      class: 'ib', 'aria-label': 'Назад',
      onclick: function () { refPage = null; render(); window.scrollTo(0, 0); }
    }, [icon(I.back)]), headEl.firstChild);
  }

  function pageRules() {
    refHead('笔顺 bǐshùn', 'Порядок черт');
    mainEl.appendChild(h('div', { class: 'stack' }, [
      h('p', { class: 'note', text: 'Порядок черт — не формальность: от него зависят форма знака, скорость письма и то, поймёт ли вас носитель. Нажмите на пример справа, чтобы увидеть написание.' }),
      h('ol', { class: 'rules' }, RULES.map(function (r) {
        return h('li', {}, [
          h('div', { class: 't' }, [h('b', { text: r[0] }), h('span', { text: r[1] })]),
          h('button', { class: 'ex han', title: 'Показать написание', text: r[2], onclick: function () { showAnim(r[2]); } })
        ]);
      }))
    ]));
  }
  function pageBasic() {
    refHead('из них собрано всё', 'Восемь базовых черт');
    mainEl.appendChild(h('div', { class: 'stack' }, [
      h('p', { class: 'note', text: 'Любой иероглиф — последовательность простых черт. Научитесь вести каждую из восьми, и порядок начнёт запоминаться сам.' }),
      h('div', { class: 'rows' }, BASIC.map(function (b) {
        return h('button', { class: 'rowitem', onclick: function () { showAnim(b[4]); } }, [
          h('span', { class: 'lead han', text: b[0] }),
          h('span', { class: 'm' }, [h('b', { text: b[2] }), h('span', { text: b[1] + ' · ' + b[3] })]),
          h('span', { class: 'tr han', style: 'font-size:19px', text: b[4] }),
          icon(I.chev, 'chev')
        ]);
      }))
    ]));
  }
  function pageTones() {
    refHead('один слог — четыре слова', 'Четыре тона');
    var demo = [['mā', 'ma1', '妈', 'мама'], ['má', 'ma2', '麻', 'конопля'],
                ['mǎ', 'ma3', '马', 'лошадь'], ['mà', 'ma4', '骂', 'ругать']];
    mainEl.appendChild(h('div', { class: 'stack' }, [
      h('p', { class: 'note', text: 'В китайском тон — часть слова. Слог ma, произнесённый четырьмя способами, даёт четыре разных значения. Нажмите строку, чтобы услышать.' }),
      h('div', { class: 'rows' }, demo.map(function (d) {
        var t = HZ.toneOf(d[0]);
        return h('button', {
          class: 'rowitem',
          onclick: function () { HZ.playKey(d[1]).then(function (ok) { if (!ok) HZ.speak(d[2]); }); }
        }, [
          h('span', { class: 'lead han', text: d[2] }),
          h('span', { class: 'm' }, [
            h('b', {}, [h('span', { class: 'py', text: d[0] }), document.createTextNode(' — ' + d[3])]),
            h('span', { text: HZ.TONE_RU[t][1] })
          ]),
          icon(I.sound, 'chev')
        ]);
      })),
      section('Пятый, нейтральный', h('p', {
        class: 'lede muted',
        text: 'Некоторые слоги произносятся коротко и без тона: 吗 ma в вопросе, 的 de, 了 le. Такие знаки помечены как «нейтральный», а запись для них даётся в исходном тоне слога — отдельных записей нейтрального тона почти не существует.'
      }))
    ]));
  }

  function showAnim(ch) {
    if (!HZ.by(ch)) { toast('Знака ' + ch + ' нет в базе'); return; }
    openPanel('Написание ' + ch, null, function (inner) {
      var paper = h('div', { class: 'sheet big' });
      var load = loadingBlock();
      inner.appendChild(h('div', { class: 'paper-wrap' }, [paper]));
      inner.appendChild(load);
      HZ.graphics(ch).then(function (gr) {
        load.remove();
        var w = new HZWriter(paper, { grid: HZ.state.settings.grid, showNumbers: true });
        w.load(gr, 'view');
        w.setLocked(true);
        inner.appendChild(h('div', { class: 'row wrap s' }, [
          h('button', { class: 'btn s seal', onclick: function () { w.animate({ speed: .9 }); } }, [icon(I.play), 'Ещё раз']),
          h('span', { class: 'grow' }),
          h('button', { class: 'btn s', text: 'Разбор знака', onclick: function () { closePanel(); openChar(ch); } })
        ]));
        w.animate({ speed: .9 });
      }).catch(function () {
        load.remove();
        inner.appendChild(errorBlock('Не удалось загрузить написание.'));
      });
    });
  }

  /* ----------------------------------------------------- настройки */
  function pageSettings() {
    refHead('под себя', 'Настройки');
    var s = HZ.state.settings;
    function sw(title, note, key) {
      var b = h('button', {
        class: 'sw', 'aria-pressed': s[key] ? 'true' : 'false', 'aria-label': title,
        onclick: function () { s[key] = !s[key]; HZ.save(); b.setAttribute('aria-pressed', s[key] ? 'true' : 'false'); }
      });
      return h('div', { class: 'swrow' }, [h('div', { class: 't' }, [h('b', { text: title }), h('span', { text: note })]), b]);
    }
    function seg(opts, key) {
      return h('div', { class: 'seg' }, opts.map(function (o) {
        return h('button', {
          'aria-pressed': s[key] === o[0] ? 'true' : 'false', text: o[1],
          onclick: function () { s[key] = o[0]; HZ.save(); render(); }
        });
      }));
    }
    mainEl.appendChild(h('div', { class: 'stack' }, [
      section('Пропись', h('div', { class: 'stack s' }, [
        h('p', { class: 'tiny dim', text: 'Разметка клетки' }),
        seg([['tian', '田字格'], ['mi', '米字格'], ['none', 'без линий']], 'grid'),
        sw('Номера черт', 'подписывать начало каждой черты в режиме «Знакомство»', 'numbers')
      ])),
      section('Проверка', h('div', { class: 'stack s' }, [
        h('p', { class: 'tiny dim', text: 'Насколько точно нужно попадать в черту' }),
        seg([['easy', 'свободно'], ['normal', 'обычно'], ['strict', 'строго']], 'tolerance'),
        h('p', { class: 'tiny dim', text: 'Подсказка после скольких неудачных попыток' }),
        h('div', { class: 'seg' }, [2, 3, 5, 99].map(function (n) {
          return h('button', {
            'aria-pressed': s.hintAfter === n ? 'true' : 'false', text: n === 99 ? 'никогда' : String(n),
            onclick: function () { s.hintAfter = n; HZ.save(); render(); }
          });
        }))
      ])),
      section('Звук и выход', h('div', { class: 'stack xs' }, [
        sw('Проигрывать автоматически', 'при открытии знака и после написания', 'autoAudio'),
        sw('Спрашивать при выходе', 'чтобы случайно не прервать занятие', 'confirmExit')
      ]))
    ]));
  }

  /* ------------------------------------------ сохранность и доступ */
  function pageSafety() {
    refHead('чтобы ничего не пропало', 'Сохранность и доступ');
    var box = h('div', { class: 'stack' });
    mainEl.appendChild(box);
    drawSafety(box);
  }

  function drawSafety(box) {
    box.textContent = '';
    var locked = HZ.isLocked();
    var baks = HZ.backupList();

    if (!HZ.storageOk()) {
      box.appendChild(h('p', {
        class: 'note bad',
        text: 'Браузер не даёт сохранять данные на этом устройстве (возможно, режим инкогнито). Прогресс не переживёт закрытие вкладки — выгрузите его в файл.'
      }));
    }

    box.appendChild(section('Код доступа', h('div', { class: 'stack s' }, [
      h('p', {
        class: 'lede muted', text: locked
          ? 'Код включён. Прогресс хранится на устройстве в зашифрованном виде: без кода его не прочитать и приложение не открыть.'
          : 'Можно закрыть приложение кодом из 4–6 цифр. Тогда прогресс шифруется прямо на устройстве. Сам код нигде не сохраняется — восстановить его невозможно.'
      }),
      !HZ.cryptoAvailable()
        ? h('p', { class: 'note warn', text: 'Этот браузер не поддерживает шифрование — код доступа недоступен.' })
        : h('div', { class: 'row wrap s' }, [
          h('button', {
            class: 'btn s' + (locked ? '' : ' seal'), onclick: function () { setupCode(box); }
          }, [icon(I.lock), locked ? 'Сменить код' : 'Поставить код']),
          locked ? h('button', {
            class: 'btn s quiet', text: 'Снять код', onclick: function () {
              askYes('Снять код доступа?', 'Прогресс перестанет шифроваться, приложение будет открываться сразу.', { ok: 'Снять' })
                .then(function (yes) {
                  if (!yes) return;
                  HZ.setCode(null).then(function () { toast('Код снят'); drawSafety(box); });
                });
            }
          }) : null
        ].filter(Boolean))
    ])));

    box.appendChild(section('Резервные копии', h('div', { class: 'stack s' }, [
      h('p', { class: 'lede muted', text: 'Приложение само хранит три последние копии прогресса — не чаще раза в шесть часов. Их можно вернуть, если что-то пошло не так.' }),
      baks.length
        ? h('div', { class: 'rows' }, baks.map(function (b) {
          return h('button', {
            class: 'rowitem', onclick: function () {
              askYes('Вернуть копию от ' + fmtDate(b.at) + '?', 'Текущий прогресс будет заменён — но сначала я сохраню его ещё одной копией.', { ok: 'Вернуть' })
                .then(function (yes) {
                  if (!yes) return;
                  HZ.persist(true)
                    .then(function () { return HZ.restoreBackup(b.slot); })
                    .then(function () { toast('Прогресс восстановлен'); drawSafety(box); })
                    .catch(function (e) { toast((e && e.message) || 'Не удалось восстановить'); });
                });
            }
          }, [
            h('span', { class: 'lead sm', text: '↺' }),
            h('span', { class: 'm' }, [
              h('b', { text: fmtDate(b.at) }),
              h('span', { text: b.chars + ' ' + plural(b.chars, 'знак', 'знака', 'знаков') + (b.enc ? ' · зашифровано' : '') })
            ]),
            icon(I.chev, 'chev')
          ]);
        }))
        : h('p', { class: 'tiny dim', text: 'Копий пока нет — первая появится после занятия.' })
    ])));

    box.appendChild(section('Перенос на другое устройство', h('div', { class: 'stack s' }, [
      h('p', { class: 'lede muted', text: 'Выгрузите прогресс в файл и загрузите его на втором устройстве. Либо включите синхронизацию — тогда наборы и расписание повторений будут общими.' }),
      h('div', { class: 'row wrap s' }, [
        h('button', { class: 'btn s', onclick: doExport }, [icon(I.down), 'Выгрузить в файл']),
        h('button', { class: 'btn s', onclick: doImport }, [icon(I.up), 'Загрузить из файла']),
        h('button', { class: 'btn s quiet', text: 'Скопировать текстом', onclick: doCopy })
      ]),
      h('div', { class: 'swrow' }, [
        h('div', { class: 't' }, [
          h('b', { text: 'Синхронизация через Claude' }),
          h('span', { text: HZ.state.settings.sync ? 'включена' : 'выключена' })
        ]),
        h('button', {
          class: 'sw', 'aria-pressed': HZ.state.settings.sync ? 'true' : 'false', 'aria-label': 'Синхронизация',
          onclick: function () {
            var on = !HZ.state.settings.sync;
            HZ.state.settings.sync = on;
            HZ.save();
            if (on) {
              HZ.initSync(
                function () { toast('Синхронизация включена'); drawSafety(box); },
                function (msg) { HZ.state.settings.sync = false; HZ.save(); toast(msg); drawSafety(box); });
            } else {
              toast('Синхронизация выключена');
              drawSafety(box);
            }
          }
        })
      ])
    ])));

    box.appendChild(section('Опасная зона', h('button', {
      class: 'btn wide danger', onclick: function () {
        askText('Стереть весь прогресс?', '', {
          text: 'Исчезнут занятия, избранное, наборы и резервные копии. Чтобы подтвердить, введите слово СТЕРЕТЬ.',
          ok: 'Стереть', placeholder: 'СТЕРЕТЬ', danger: true
        }).then(function (v) {
          if (v == null) return;
          if (String(v).trim().toUpperCase() !== 'СТЕРЕТЬ') { toast('Не совпало — ничего не тронул'); return; }
          ['hz.v1', 'hz.bak.1', 'hz.bak.2', 'hz.bak.3', 'hz.session', 'hz.lock', 'hz.att'].forEach(function (k) {
            try { localStorage.removeItem(k); } catch (e) { }
          });
          HZ.load();
          HZ.save();
          toast('Всё стёрто');
          refPage = null;
          render();
        });
      }
    }, [icon(I.trash), 'Стереть весь прогресс'])));
  }

  function fmtDate(ts) {
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function doExport() {
    var text = HZ.exportJson();
    var name = 'hanzi-progress-' + new Date().toISOString().slice(0, 10) + '.json';
    if (window.claude && window.claude.use) {
      window.claude.use('downloads').then(function (d) {
        if (!d) { doCopy(); return; }
        d.save({ filename: name, data: text })
          .then(function () { toast('Файл сохранён'); })
          .catch(function () { doCopy(); });
      }).catch(function () { doCopy(); });
    } else doCopy();
  }
  function doCopy() {
    var text = HZ.exportJson();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast('Прогресс скопирован — вставьте его в заметку'); },
        function () { showText(text); });
    } else showText(text);
  }
  function showText(text) {
    openPanel('Прогресс текстом', 'скопируйте и сохраните', function (inner) {
      var ta = h('textarea', {
        readonly: 'readonly', rows: '12',
        style: 'width:100%;font-family:var(--mono);font-size:11px;border:1px solid var(--rule-2);background:var(--paper-2);color:var(--ink);padding:10px'
      });
      ta.value = text;
      inner.appendChild(ta);
      setTimeout(function () { ta.focus(); ta.select(); }, 50);
    });
  }
  function doImport() {
    var inp = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) { inp.remove(); return; }
      var rd = new FileReader();
      rd.onload = function () {
        HZ.persist(true)
          .then(function () { return HZ.importJson(String(rd.result)); })
          .then(function () { toast('Прогресс загружен'); refPage = 'safety'; render(); })
          .catch(function (e) { toast((e && e.message) || 'Файл не подошёл'); });
        inp.remove();
      };
      rd.onerror = function () { toast('Не удалось прочитать файл'); inp.remove(); };
      rd.readAsText(f);
    });
    document.body.appendChild(inp);
    inp.click();
  }

  function setupCode(box) {
    askText('Новый код', '', {
      text: 'От 4 до 6 цифр. Запомните его — восстановить нельзя.',
      inputType: 'password', placeholder: '••••', maxlength: 6, ok: 'Дальше'
    }).then(function (a) {
      if (a == null) return;
      if (!/^\d{4,6}$/.test(a)) { toast('Нужны 4–6 цифр'); return; }
      askText('Повторите код', '', { inputType: 'password', placeholder: '••••', maxlength: 6, ok: 'Поставить' })
        .then(function (b2) {
          if (b2 == null) return;
          if (a !== b2) { toast('Коды не совпали'); return; }
          HZ.setCode(a)
            .then(function () { toast('Код доступа установлен'); drawSafety(box); })
            .catch(function (e) { toast((e && e.message) || 'Не получилось'); });
        });
    });
  }

  function pageAbout() {
    refHead('данные и лицензии', 'Источники');
    function src(title, body) {
      return h('div', { class: 'stack xs' }, [h('b', { text: title }), h('p', { class: 'small muted', text: body })]);
    }
    mainEl.appendChild(h('div', { class: 'stack' }, [
      src('Порядок черт и разбор на части',
        'Проект Make Me a Hanzi: контуры черт, осевые линии, декомпозиция и тип знака. Данные производны от шрифта Arphic по лицензии Arphic Public License.'),
      src('Русские значения и чтения',
        'Большой китайско-русский словарь 大БКРС (bkrs.info) — значения знаков, чтения и переводы слов. Пиньинь сверен с CC-CEDICT.'),
      src('Произношение',
        'Записи отдельных слогов с тонами: набор mp3-chinese-pinyin-sound (общественное достояние), дополнен несколькими слогами из подборки Chinese-Pinyin-Audio. Слова озвучивает синтез речи устройства.'),
      src('Списки и частотность',
        'Официальные списки слов HSK 1–6 (2012) — 2663 иероглифа. Частота по корпусу субтитров SUBTLEX-CH.'),
      h('p', { class: 'note', text: 'На домашний экран: в Safari — «Поделиться» → «На экран „Домой“»; в Chrome — меню → «Добавить на главный экран». Всё открытое кэшируется, дальше приложение работает и без сети.' })
    ]));
  }

  /* ======================================================== ЗАМОК */
  function renderLock(onOk) {
    var code = '';
    var attempts = 0;
    var blockedUntil = 0;
    try {
      var a = JSON.parse(localStorage.getItem('hz.att') || 'null');
      if (a) { attempts = a.n || 0; blockedUntil = a.until || 0; }
    } catch (e) { }

    var pins = h('div', { class: 'pins' });
    var msg = h('p', { class: 'tiny dim', style: 'min-height:20px;text-align:center' });

    function drawPins() {
      pins.textContent = '';
      for (var i = 0; i < 6; i++) pins.appendChild(h('i', { class: i < code.length ? 'on' : '' }));
    }
    function press(d) {
      if (Date.now() < blockedUntil || code.length >= 6) return;
      code += d;
      drawPins();
      if (code.length >= 4) tryCode();
    }
    function tryCode() {
      if (code.length < 4) return;
      msg.textContent = 'Проверяю…';
      HZ.unlock(code).then(function (ok) {
        if (ok) {
          try { localStorage.removeItem('hz.att'); } catch (e) { }
          document.removeEventListener('keydown', onKey);
          wrap.remove();
          onOk();
          return;
        }
        if (code.length < 6) { msg.textContent = ''; return; }
        fail();
      }).catch(fail);
    }
    function fail() {
      attempts++;
      code = '';
      drawPins();
      var wait = attempts >= 5 ? Math.min(300, 15 * Math.pow(2, attempts - 5)) : 0;
      blockedUntil = wait ? Date.now() + wait * 1000 : 0;
      try { localStorage.setItem('hz.att', JSON.stringify({ n: attempts, until: blockedUntil })); } catch (e) { }
      if (wait) tick();
      else msg.textContent = 'Неверный код. Попыток подряд: ' + attempts;
    }
    function tick() {
      var left = Math.ceil((blockedUntil - Date.now()) / 1000);
      if (left <= 0) { msg.textContent = 'Можно попробовать снова'; return; }
      msg.textContent = 'Слишком много попыток. Подождите ' + left + ' с.';
      setTimeout(tick, 500);
    }

    var pad = h('div', { class: 'pad' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (d) {
      pad.appendChild(h('button', { text: d, onclick: function () { press(d); } }));
    });
    pad.appendChild(h('button', { class: 'aux', text: 'СБРОС', onclick: function () { code = ''; drawPins(); msg.textContent = ''; } }));
    pad.appendChild(h('button', { text: '0', onclick: function () { press('0'); } }));
    pad.appendChild(h('button', { class: 'aux', text: '⌫', onclick: function () { code = code.slice(0, -1); drawPins(); } }));

    function onKey(e) {
      if (!document.body.contains(wrap)) { document.removeEventListener('keydown', onKey); return; }
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') { code = code.slice(0, -1); drawPins(); }
      else if (e.key === 'Enter') tryCode();
    }

    var wrap = h('div', { class: 'lock' }, [
      h('span', { class: 'seal-mark han', text: '守' }),
      h('h2', { text: 'Код доступа' }),
      pins,
      msg,
      pad,
      h('button', {
        class: 'btn s quiet', text: 'Забыли код?', onclick: function () {
          askText('Сбросить всё?', '', {
            text: 'Код восстановить нельзя. Можно только стереть зашифрованный прогресс и начать заново. Введите слово СТЕРЕТЬ.',
            placeholder: 'СТЕРЕТЬ', ok: 'Стереть', danger: true
          }).then(function (v) {
            if (v == null) return;
            if (String(v).trim().toUpperCase() !== 'СТЕРЕТЬ') { toast('Не совпало'); return; }
            ['hz.v1', 'hz.bak.1', 'hz.bak.2', 'hz.bak.3', 'hz.session', 'hz.lock', 'hz.att'].forEach(function (k) {
              try { localStorage.removeItem(k); } catch (e) { }
            });
            HZ.load();
            document.removeEventListener('keydown', onKey);
            wrap.remove();
            onOk();
          });
        }
      })
    ]);
    drawPins();
    if (blockedUntil > Date.now()) tick();
    document.body.appendChild(wrap);
    document.addEventListener('keydown', onKey);
  }

  /* ========================================================= старт */
  function boot() {
    HZ.initIndex();
    HZ.load();
    if (HZ.isLocked()) renderLock(start);
    else start();
  }

  function start() {
    buildShell();
    render();
    if (HZ.state.settings.sync) HZ.initSync(function () { render(); }, function () { });
    HZ.prefetch(HZ.setChars('hsk1').slice(0, 20));
    if ('serviceWorker' in navigator) {
      try { navigator.serviceWorker.register('sw.js').catch(function () { }); } catch (e) { }
    }
    if (!HZ.storageOk()) {
      setTimeout(function () { toast('Браузер не даёт сохранять прогресс на этом устройстве'); }, 1500);
    }
  }

  function failToLoad() {
    root.textContent = '';
    root.appendChild(h('div', { class: 'empty' }, [
      h('span', { class: 'mk han', text: '斷' }),
      h('p', { text: 'Не удалось загрузить базу иероглифов. Проверьте соединение и обновите страницу.' }),
      h('button', {
        class: 'btn seal', style: 'margin-top:18px', text: 'Обновить',
        onclick: function () { location.reload(); }
      })
    ]));
  }

  window.addEventListener('error', function (e) {
    if (window.console) console.error('hz', e.message);
  });

  if (window.HZ_INDEX) boot();
  else {
    window.addEventListener('hz-index', boot, { once: true });
    setTimeout(function () { if (!window.HZ_INDEX) failToLoad(); }, 15000);
  }
})();
