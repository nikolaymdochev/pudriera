/* Data access, formatting, the signed-in name, the wish list and the theme.
   Everything lives in this browser's localStorage. */
(function (PD) {
  'use strict';

  /* ---------- tiny event bus ---------- */
  var listeners = {};
  PD.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); };
  PD.emit = function (ev, data) { (listeners[ev] || []).forEach(function (fn) { fn(data); }); };

  /* ---------- categories ---------- */
  PD.GROUPS = [
    { key: 'lips', label: 'Устни' },
    { key: 'face', label: 'Лице' },
    { key: 'cheeks', label: 'Бузи' },
    { key: 'eyes', label: 'Очи' }
  ];
  PD.CATS = [
    { key: 'lipstick',    label: 'Червила',            one: 'Червило',           group: 'lips' },
    { key: 'gloss',       label: 'Гланцове и балсами', one: 'Гланц / балсам',    group: 'lips' },
    { key: 'lipliner',    label: 'Моливи за устни',    one: 'Молив за устни',    group: 'lips' },
    { key: 'foundation',  label: 'Фон дьо тен',        one: 'Фон дьо тен',       group: 'face' },
    { key: 'concealer',   label: 'Коректори',          one: 'Коректор',          group: 'face' },
    { key: 'powder',      label: 'Пудри',              one: 'Пудра',             group: 'face' },
    { key: 'primer',      label: 'Праймери',           one: 'Праймер',           group: 'face' },
    { key: 'setting',     label: 'Фиксиращи спрейове', one: 'Фиксиращ спрей',    group: 'face' },
    { key: 'blush',       label: 'Ружове',             one: 'Руж',               group: 'cheeks' },
    { key: 'bronzer',     label: 'Бронзанти',          one: 'Бронзант',          group: 'cheeks' },
    { key: 'highlighter', label: 'Хайлайтъри',         one: 'Хайлайтър',         group: 'cheeks' },
    { key: 'eyeshadow',   label: 'Сенки',              one: 'Сенки',             group: 'eyes' },
    { key: 'mascara',     label: 'Спирали',            one: 'Спирала',           group: 'eyes' },
    { key: 'liner',       label: 'Очни линии',         one: 'Очна линия',        group: 'eyes' },
    { key: 'brows',       label: 'За вежди',           one: 'За вежди',          group: 'eyes' },
    { key: 'other',       label: 'Друго',              one: 'Друго',             group: null }
  ];
  var CAT = {};
  PD.CATS.forEach(function (c) { CAT[c.key] = c; });
  PD.cat = function (key) { return CAT[key] || CAT.other; };
  PD.groupLabel = function (g) {
    for (var i = 0; i < PD.GROUPS.length; i++) if (PD.GROUPS[i].key === g) return PD.GROUPS[i].label;
    return '';
  };

  /* ---------- products ---------- */
  var BY_ID = {};
  (window.PRODUCTS || []).forEach(function (p) { BY_ID[p.id] = p; });
  PD.products = function () { return window.PRODUCTS || []; };
  PD.byId = function (id) { return BY_ID[id] || null; };
  PD.brands = function () {
    var m = {};
    PD.products().forEach(function (p) { m[p.brand] = (m[p.brand] || 0) + 1; });
    return Object.keys(m).sort(function (a, b) { return a.localeCompare(b); })
      .map(function (b) { return { name: b, count: m[b] }; });
  };
  PD.catCounts = function () {
    var m = {};
    PD.products().forEach(function (p) { m[p.category] = (m[p.category] || 0) + 1; });
    return m;
  };
  /* first product of a category: its packshot represents the category */
  PD.catCover = function (key) {
    var list = PD.products();
    for (var i = 0; i < list.length; i++) if (list[i].category === key) return list[i];
    return null;
  };

  /* Shopify CDN resizes on the fly: ?width=N */
  PD.img = function (url, w) {
    if (!url) return '';
    return url + (url.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
  };

  /* ---------- formatting ---------- */
  var NF = new Intl.NumberFormat('bg-BG', { maximumFractionDigits: 2 });
  PD.eur = function (n) { return NF.format(n) + ' €'; };
  PD.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  PD.plural = function (n, one, many) { return n === 1 ? one : many; };

  /* ---------- localStorage helpers ---------- */
  function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function rawSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* ---------- who is signed in (name only, no password) ---------- */
  var NAME_KEY = 'pudriera-name';
  PD.keyOf = function (name) { return String(name || '').trim().toLowerCase().replace(/\s+/g, ' '); };
  PD.user = function () {
    var n = rawGet(NAME_KEY);
    return n && PD.keyOf(n) ? { name: n, key: PD.keyOf(n) } : null;
  };
  PD.login = function (name) {
    var clean = String(name || '').trim().replace(/\s+/g, ' ');
    if (!clean) return false;
    rawSet(NAME_KEY, clean);
    PD.emit('user');
    PD.emit('wishes');
    return true;
  };
  PD.logout = function () {
    rawDel(NAME_KEY);
    PD.emit('user');
    PD.emit('wishes');
  };

  /* ---------- wishes ----------
     { id, owner, ownerName, productId?, category, name, brand, shade, color,
       maxPrice, note, bought, createdAt }                                   */
  var WISH_KEY = 'pudriera-local-wishes';
  function readAll() {
    try { var a = JSON.parse(rawGet(WISH_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function writeAll(arr) {
    if (!rawSet(WISH_KEY, JSON.stringify(arr))) throw new Error('storage');
    PD.emit('wishes');
  }
  PD.myWishes = function () {
    var u = PD.user();
    if (!u) return [];
    return readAll().filter(function (w) { return w.owner === u.key; });
  };
  PD.wishFor = function (productId) {
    var mine = PD.myWishes();
    for (var i = 0; i < mine.length; i++) if (mine[i].productId === productId) return mine[i];
    return null;
  };
  PD.addWish = function (data) {
    var u = PD.user();
    if (!u) throw new Error('no-user');
    var w = Object.assign({
      id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      owner: u.key, ownerName: u.name, bought: false, createdAt: Date.now()
    }, data);
    var all = readAll();
    all.push(w);
    writeAll(all);
    return w;
  };
  PD.updateWish = function (id, patch) {
    writeAll(readAll().map(function (w) { return w.id === id ? Object.assign({}, w, patch) : w; }));
  };
  PD.removeWish = function (id) {
    writeAll(readAll().filter(function (w) { return w.id !== id; }));
  };

  /* Compare the catalogue price with the wish's max price. */
  PD.budget = function (w) {
    var p = w.productId ? PD.byId(w.productId) : null;
    if (!p || p.price == null || w.maxPrice == null) return null;
    var diff = Math.round((p.price - w.maxPrice) * 100) / 100;
    return { price: p.price, fits: diff <= 0, over: diff };
  };

  /* ---------- theme ---------- */
  var THEME_KEY = 'pudriera-theme';
  PD.theme = function () {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  PD.toggleTheme = function () {
    var next = PD.theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    rawSet(THEME_KEY, next);
    PD.emit('theme', next);
  };
})(window.PD = window.PD || {});
