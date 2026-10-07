/* Bootstrap: shell, one delegated click handler, the wish / login sheets, toast, PWA. */
(function (PD) {
  'use strict';
  var esc = PD.esc, icon = PD.icon;
  var $ = function (id) { return document.getElementById(id); };
  var installEvt = null;

  /* ---------------------------------------------------------- shell */
  function renderHeader() {
    $('site-header').innerHTML = PD.header();
    if (installEvt) $('installBtn').hidden = false;
    PD.markNav();
  }

  /* ---------------------------------------------------------- toast */
  var toastTimer = null;
  PD.toast = function (html, ms) {
    var t = $('toast');
    t.innerHTML = html;
    t.hidden = false;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.hidden = true; }, 250); }, ms || 3200);
  };

  /* ---------------------------------------------------------- sheet */
  var lastFocus = null;
  PD.openSheet = function (html, mount) {
    var sheet = $('sheet'), panel = $('sheet-panel');
    lastFocus = document.activeElement;
    panel.innerHTML = '<button class="sheet-x" type="button" data-action="sheet-close" aria-label="Затвори">' + icon('x') + '</button>' +
      '<span class="sheet-grip" aria-hidden="true"></span>' + html;
    sheet.hidden = false;
    document.body.classList.add('locked');
    void sheet.offsetWidth;            // commit the closed state so the slide-in transition runs
    sheet.classList.add('open');
    if (mount) mount(panel);
    var first = panel.querySelector('[autofocus]') || panel.querySelector('input:not([type=hidden]), button:not(.sheet-x)');
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
  };
  PD.closeSheet = function (instant) {
    var sheet = $('sheet');
    if (sheet.hidden) return;
    sheet.classList.remove('open');
    document.body.classList.remove('locked');
    var done = function () { sheet.hidden = true; $('sheet-panel').innerHTML = ''; };
    if (instant) done(); else setTimeout(done, 220);
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  };

  /* keep keyboard focus inside the open sheet */
  document.addEventListener('keydown', function (e) {
    if ($('sheet').hidden) return;
    if (e.key === 'Escape') { PD.closeSheet(); return; }
    if (e.key !== 'Tab') return;
    var f = $('sheet-panel').querySelectorAll('button, [href], input, select, textarea, summary');
    f = Array.prototype.filter.call(f, function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });

  /* ---------------------------------------------------------- form bits */
  function nameField() {
    if (PD.user()) return '';
    return '<div class="field">' +
      '<label for="ws-name">Как се казваш?</label>' +
      '<input id="ws-name" type="text" autocomplete="nickname" placeholder="напр. Мария" maxlength="40" autofocus />' +
      '<p class="hint">Без парола. Желанията ти се пазят под това име в този браузър.</p>' +
    '</div>';
  }

  function priceField(value, chips) {
    return '<div class="field">' +
      '<label for="ws-price">До колко € си готова да дадеш?</label>' +
      '<div class="stepper">' +
        '<button type="button" class="step" data-step="-1" aria-label="С 1 € по-малко">' + icon('minus') + '</button>' +
        '<div class="step-val"><input id="ws-price" type="number" inputmode="decimal" min="0" step="1" value="' + (value == null ? '' : value) + '" placeholder="0" /><span>€</span></div>' +
        '<button type="button" class="step" data-step="1" aria-label="С 1 € повече">' + icon('plus') + '</button>' +
      '</div>' +
      '<div class="quick" role="group" aria-label="Бърз избор на цена">' + chips.map(function (c) {
        return '<button type="button" class="qchip" data-v="' + c.v + '">' + c.label + '</button>';
      }).join('') + '</div>' +
    '</div>';
  }

  function bindPrice(panel) {
    var input = panel.querySelector('#ws-price');
    var mark = function () {
      var v = parseFloat(input.value);
      panel.querySelectorAll('.qchip[data-v]').forEach(function (c) { c.setAttribute('aria-pressed', String(+c.dataset.v === v)); });
    };
    panel.querySelectorAll('.step').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = parseFloat(input.value) || 0;
        input.value = Math.max(0, Math.round(v + (+b.dataset.step)));
        mark();
      });
    });
    panel.querySelectorAll('.qchip[data-v]').forEach(function (c) {
      c.addEventListener('click', function () { input.value = c.dataset.v; mark(); });
    });
    input.addEventListener('input', mark);
    mark();
  }

  /* returns the signed-in user, signing in with the typed name if needed */
  function ensureUser(panel, err) {
    var u = PD.user();
    if (u) return u;
    var nameInput = panel.querySelector('#ws-name');
    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) { err('Напиши името си, за да запазим желанието под него.', nameInput); return null; }
    PD.login(name);
    return PD.user();
  }

  function readPrice(panel, err) {
    var input = panel.querySelector('#ws-price');
    var v = parseFloat(String(input.value).replace(',', '.'));
    if (!isFinite(v) || v <= 0) { err('Напиши до колко € си готова да дадеш, например 25.', input); return null; }
    return Math.round(v * 100) / 100;
  }

  function errorFn(panel) {
    return function (msg, focusEl) {
      var e = panel.querySelector('.form-err');
      e.textContent = msg;
      if (focusEl) focusEl.focus();
    };
  }

  function saved(text) {
    PD.closeSheet();
    PD.toast(icon('check') + '<span>' + text + '</span>' +
      (PD.route() !== 'wishes' ? '<a href="#/wishes">Виж списъка</a>' : ''));
  }

  function storageFailed(panel) {
    errorFn(panel)('Не успях да запазя. Браузърът може да е в режим „инкогнито“ или паметта му да е пълна.');
  }

  /* ---------------------------------------------------------- sheet: wish for a catalogue product */
  function productSheet(p, wish) {
    var base = Math.ceil(p.price);
    var step5 = Math.ceil((base + 1) / 5) * 5;
    var chips = [{ v: base, label: base + ' € · цената' }, { v: step5, label: step5 + ' €' },
      { v: step5 + 5, label: (step5 + 5) + ' €' }, { v: step5 + 10, label: (step5 + 10) + ' €' }];

    PD.openSheet(
      '<div class="ws-prod">' +
        '<span class="ws-img"><img src="' + PD.img(p.image, 200) + '" alt="" /></span>' +
        '<div><div class="eyebrow">' + esc(p.brand) + '</div><h2 id="sheet-title">' + esc(p.name) + '</h2>' +
        '<div class="muted">' + (p.shade ? esc(p.shade) + ' · ' : '') + 'цена ≈ ' + PD.eur(p.price) + '</div></div>' +
      '</div>' +
      '<form id="ws-form" class="ws-form" novalidate>' +
        nameField() +
        priceField(wish ? wish.maxPrice : base, chips) +
        '<div class="field"><label for="ws-note">Бележка <span class="opt">по желание</span></label>' +
          '<input id="ws-note" type="text" maxlength="200" placeholder="напр. за подарък, друг нюанс" value="' + esc(wish ? wish.note || '' : '') + '" /></div>' +
        '<p class="form-err" role="alert"></p>' +
        '<button class="btn btn-primary btn-block btn-lg" type="submit">' + icon('heart') + (wish ? 'Запази промените' : 'Запази в желанията') + '</button>' +
        (wish ? '<button class="link danger center" type="button" id="ws-remove">' + icon('trash') + 'Махни от желанията</button>' : '') +
      '</form>',
      function (panel) {
        bindPrice(panel);
        var err = errorFn(panel);
        var rm = panel.querySelector('#ws-remove');
        if (rm) rm.addEventListener('click', function () {
          try { PD.removeWish(wish.id); saved('Махнато от желанията'); } catch (e) { storageFailed(panel); }
        });
        panel.querySelector('#ws-form').addEventListener('submit', function (e) {
          e.preventDefault();
          var price = readPrice(panel, err);
          if (price == null) return;
          if (!ensureUser(panel, err)) return;
          var note = panel.querySelector('#ws-note').value.trim();
          try {
            if (wish) PD.updateWish(wish.id, { maxPrice: price, note: note });
            else {
              var existing = PD.wishFor(p.id);
              if (existing) PD.updateWish(existing.id, { maxPrice: price, note: note });
              else PD.addWish({ productId: p.id, category: p.category, name: p.name, brand: p.brand, shade: p.shade || '', color: '', maxPrice: price, note: note });
            }
            saved(wish ? 'Запазено' : 'Добавено в желанията');
          } catch (ex) { storageFailed(panel); }
        });
      }
    );
  }

  /* ---------------------------------------------------------- sheet: your own wish */
  var POPULAR = ['MAC', 'Maybelline', "L'Oréal Paris", 'NYX', 'Dior', 'Charlotte Tilbury', 'Essence', 'Catrice', 'Rare Beauty', 'Fenty Beauty'];

  function customSheet(wish) {
    var w = wish || {};
    var cats = PD.CATS.map(function (c) {
      var cover = PD.catCover(c.key);
      return '<button type="button" class="cp" data-cat="' + c.key + '" aria-pressed="' + (w.category === c.key) + '">' +
        '<span class="cp-img">' + (cover ? '<img src="' + PD.img(cover.image, 140) + '" alt="" loading="lazy" />' : icon('sparkle')) + '</span>' +
        '<span class="cp-label">' + c.one + '</span></button>';
    }).join('');
    var hasMore = !!(w.shade || w.note || w.color);

    PD.openSheet(
      '<h2 id="sheet-title" class="sheet-title">' + (wish ? 'Промени желанието' : 'Свое желание') + '</h2>' +
      '<p class="muted sheet-sub">За продукт, който го няма в каталога. Само вид и цена са задължителни.</p>' +
      '<form id="ws-form" class="ws-form" novalidate>' +
        nameField() +
        '<fieldset class="field"><legend>Какво търсиш?</legend><div class="cat-pick" id="ws-cats">' + cats + '</div></fieldset>' +
        '<div class="field"><label for="ws-brand">Марка <span class="opt">по желание</span></label>' +
          '<input id="ws-brand" type="text" maxlength="60" placeholder="Напиши или избери отдолу" value="' + esc(w.brand || '') + '" />' +
          '<div class="quick" id="ws-brands">' + POPULAR.map(function (b) {
            return '<button type="button" class="qchip" data-brand="' + esc(b) + '">' + esc(b) + '</button>';
          }).join('') + '</div></div>' +
        '<div class="field"><label for="ws-pname">Кой продукт? <span class="opt">по желание</span></label>' +
          '<input id="ws-pname" type="text" maxlength="80" placeholder="напр. Ruby Woo, Lash Sensational" value="' + esc(w.name || '') + '" /></div>' +
        priceField(w.maxPrice != null ? w.maxPrice : 20, [10, 20, 30, 50].map(function (v) { return { v: v, label: v + ' €' }; })) +
        '<details class="ws-more"' + (hasMore ? ' open' : '') + '><summary>Още детайли: нюанс и бележка</summary>' +
          '<div class="field"><label for="ws-shade">Нюанс</label><div class="shade-row">' +
            '<input id="ws-color" type="color" value="' + esc(w.color || '#C2185B') + '" aria-label="Цвят на нюанса" />' +
            '<input id="ws-shade" type="text" maxlength="60" placeholder="напр. 120 Classic Ivory" value="' + esc(w.shade || '') + '" /></div></div>' +
          '<div class="field"><label for="ws-note">Бележка</label><input id="ws-note" type="text" maxlength="200" placeholder="напр. за суха кожа" value="' + esc(w.note || '') + '" /></div>' +
        '</details>' +
        '<p class="form-err" role="alert"></p>' +
        '<button class="btn btn-primary btn-block btn-lg" type="submit">' + icon('heart') + (wish ? 'Запази промените' : 'Запази желанието') + '</button>' +
      '</form>',
      function (panel) {
        bindPrice(panel);
        var err = errorFn(panel);
        var chosen = w.category || '';
        var colorTouched = !!w.color;
        panel.querySelector('#ws-color').addEventListener('input', function () { colorTouched = true; });

        panel.querySelectorAll('.cp').forEach(function (b) {
          b.addEventListener('click', function () {
            chosen = b.dataset.cat;
            panel.querySelectorAll('.cp').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            panel.querySelector('.form-err').textContent = '';
          });
        });
        var brandInput = panel.querySelector('#ws-brand');
        var markBrand = function () {
          panel.querySelectorAll('#ws-brands .qchip').forEach(function (c) {
            c.setAttribute('aria-pressed', String(c.dataset.brand.toLowerCase() === brandInput.value.trim().toLowerCase()));
          });
        };
        panel.querySelectorAll('#ws-brands .qchip').forEach(function (c) {
          c.addEventListener('click', function () { brandInput.value = c.dataset.brand; markBrand(); });
        });
        brandInput.addEventListener('input', markBrand);
        markBrand();

        panel.querySelector('#ws-form').addEventListener('submit', function (e) {
          e.preventDefault();
          if (!chosen) { err('Избери какво търсиш: червило, спирала и т.н.', panel.querySelector('.cp')); return; }
          var price = readPrice(panel, err);
          if (price == null) return;
          if (!ensureUser(panel, err)) return;
          var data = {
            category: chosen,
            brand: brandInput.value.trim(),
            name: panel.querySelector('#ws-pname').value.trim(),
            shade: panel.querySelector('#ws-shade').value.trim(),
            color: colorTouched ? panel.querySelector('#ws-color').value : '',
            note: panel.querySelector('#ws-note').value.trim(),
            maxPrice: price
          };
          try {
            if (wish) PD.updateWish(wish.id, data); else PD.addWish(data);
            saved(wish ? 'Запазено' : 'Желанието е добавено');
          } catch (ex) { storageFailed(panel); }
        });
      }
    );
  }

  /* ---------------------------------------------------------- sheet: sign in / account */
  function loginSheet(then) {
    PD.openSheet(
      '<h2 id="sheet-title" class="sheet-title">Влез с името си</h2>' +
      '<p class="muted sheet-sub">Без парола. Всяко име има свой списък с желания в този браузър.</p>' +
      '<form id="login-form" class="ws-form" novalidate>' +
        '<div class="field"><label for="login-name">Име</label><input id="login-name" type="text" autocomplete="nickname" placeholder="напр. Мария" maxlength="40" autofocus /></div>' +
        '<p class="form-err" role="alert"></p>' +
        '<button class="btn btn-primary btn-block btn-lg" type="submit">Влез</button>' +
      '</form>',
      function (panel) {
        panel.querySelector('#login-form').addEventListener('submit', function (e) {
          e.preventDefault();
          var input = panel.querySelector('#login-name');
          if (!PD.login(input.value)) { errorFn(panel)('Напиши име, за да влезеш.', input); return; }
          PD.closeSheet();
          PD.toast(icon('check') + '<span>Здравей, ' + esc(PD.user().name) + '!</span>');
          if (then) then();
        });
      }
    );
  }

  function accountSheet() {
    var u = PD.user();
    var n = PD.myWishes().length;
    PD.openSheet(
      '<div class="acc"><span class="avatar lg" aria-hidden="true">' + esc(u.name.charAt(0).toUpperCase()) + '</span>' +
      '<div><h2 id="sheet-title" class="sheet-title">' + esc(u.name) + '</h2><p class="muted">' + n + ' ' + PD.plural(n, 'желание', 'желания') + ' в списъка</p></div></div>' +
      '<div class="acc-actions">' +
        '<a class="btn btn-primary btn-block" href="#/wishes">' + icon('heart') + 'Моите желания</a>' +
        '<button class="btn btn-ghost btn-block" type="button" id="acc-switch">Влез с друго име</button>' +
        '<button class="link center" type="button" id="acc-out">Изход</button>' +
      '</div>',
      function (panel) {
        panel.querySelector('#acc-switch').addEventListener('click', function () { PD.logout(); PD.closeSheet(true); loginSheet(); });
        panel.querySelector('#acc-out').addEventListener('click', function () {
          PD.logout(); PD.closeSheet(); PD.toast('<span>Излезе от профила си</span>');
        });
      }
    );
  }

  /* ---------------------------------------------------------- delegated clicks */
  var armed = null, armedTimer = null;
  function onClick(e) {
    var el = e.target.closest('[data-action]');
    if (!el) {
      // links inside the sheet close it on the way out
      if (e.target.closest('#sheet-panel a[href^="#"]')) PD.closeSheet(true);
      return;
    }
    var a = el.getAttribute('data-action'), id = el.getAttribute('data-id');

    if (a === 'sheet-close') { PD.closeSheet(); return; }
    if (a === 'theme') { PD.toggleTheme(); renderHeader(); return; }
    if (a === 'login') { loginSheet(); return; }
    if (a === 'account') { accountSheet(); return; }
    if (a === 'install' && installEvt) {
      installEvt.prompt();
      installEvt.userChoice.finally(function () { installEvt = null; renderHeader(); });
      return;
    }
    if (a === 'custom-wish') { e.preventDefault(); customSheet(null); return; }
    if (a === 'wish') {
      var p = PD.byId(id);
      if (p) productSheet(p, PD.wishFor(id));
      return;
    }

    var wish = PD.myWishes().filter(function (w) { return w.id === id; })[0];
    if (!wish) return;
    if (a === 'wish-edit') {
      var prod = wish.productId && PD.byId(wish.productId);
      if (prod) productSheet(prod, wish); else customSheet(wish);
      return;
    }
    try {
      if (a === 'wish-bought') {
        PD.updateWish(wish.id, { bought: !wish.bought });
        PD.toast(icon('check') + '<span>' + (wish.bought ? 'Върнато в чакащите' : 'Отбелязано като купено') + '</span>');
      }
      if (a === 'wish-del') {
        if (armed !== el) {
          if (armed) { armed.classList.remove('armed'); armed.innerHTML = icon('trash') + 'Изтрий'; }
          armed = el;
          el.classList.add('armed');
          el.innerHTML = icon('trash') + 'Сигурна ли си? Изтрий';
          clearTimeout(armedTimer);
          armedTimer = setTimeout(function () {
            if (armed) { armed.classList.remove('armed'); armed.innerHTML = icon('trash') + 'Изтрий'; armed = null; }
          }, 3500);
          return;
        }
        armed = null;
        PD.removeWish(wish.id);
        PD.toast('<span>Желанието е изтрито</span>');
      }
    } catch (ex) {
      PD.toast('<span>Не успях да запазя промяната.</span>');
    }
  }

  /* ---------------------------------------------------------- PWA */
  function initPWA() {
    var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && secure) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('service-worker.js').catch(function () {}); });
    }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      installEvt = e;
      var b = $('installBtn');
      if (b) b.hidden = false;
    });
    window.addEventListener('appinstalled', function () { installEvt = null; renderHeader(); });
  }

  /* ---------------------------------------------------------- boot */
  function init() {
    renderHeader();
    $('site-footer').innerHTML = PD.footer();
    document.addEventListener('click', onClick);
    PD.on('wishes', function () { renderHeader(); PD.refreshView(); });
    PD.on('user', function () { renderHeader(); });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onMq = function () { if (!document.documentElement.getAttribute('data-theme')) renderHeader(); };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
    }
    initPWA();
    PD.startRouter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.PD = window.PD || {});
