/* Hash router: #/  #/catalog?brand=…  #/product/:id  #/wishes  #/brands */
(function (PD) {
  'use strict';
  var current = null, currentRoute = '';

  function parse() {
    var h = (location.hash || '#/').replace(/^#/, '');
    var qi = h.indexOf('?');
    var path = qi > -1 ? h.slice(0, qi) : h;
    var query = {};
    if (qi > -1) {
      h.slice(qi + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var i = kv.indexOf('=');
        var k = decodeURIComponent(i > -1 ? kv.slice(0, i) : kv);
        try { query[k] = decodeURIComponent((i > -1 ? kv.slice(i + 1) : '').replace(/\+/g, ' ')); } catch (e) { query[k] = ''; }
      });
    }
    var parts = path.split('/').filter(Boolean);
    return { parts: parts, query: query };
  }

  function resolve(r) {
    var p = r.parts;
    if (!p.length) return { name: 'home', page: PD.pages.home, params: {} };
    if (p[0] === 'catalog') return { name: 'catalog', page: PD.pages.catalog, params: { query: r.query } };
    if (p[0] === 'product' && p[1]) return { name: 'product', page: PD.pages.product, params: { id: p[1] } };
    if (p[0] === 'wishes') return { name: 'wishes', page: PD.pages.wishes, params: {} };
    if (p[0] === 'brands') return { name: 'brands', page: PD.pages.brands, params: {} };
    return { name: 'notFound', page: PD.pages.notFound, params: {} };
  }

  /* highlight the nav link that matches the current location */
  PD.markNav = function () {
    var h = location.hash || '#/';
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var target = a.getAttribute('data-nav');
      var on = target === '#/catalog' ? (h === '#/catalog' || /^#\/catalog\?(?!.*group=)/.test(h)) : h.indexOf(target) === 0 && target !== '#/';
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  };

  PD.render = function () {
    var r = resolve(parse());
    var app = document.getElementById('app');
    if (current && current.unmount) current.unmount();
    PD.closeSheet && PD.closeSheet(true);
    current = r.page(r.params);
    currentRoute = r.name;
    app.innerHTML = current.html;
    document.title = current.title;
    window.scrollTo(0, 0);
    if (current.mount) current.mount(app);
    app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter');
    PD.markNav();
  };

  /* re-draw parts of the current page after wishes/user change */
  PD.refreshView = function () {
    if (current && current.refresh) current.refresh(document.getElementById('app'));
  };
  PD.route = function () { return currentRoute; };

  PD.go = function (hash) {
    if (location.hash === hash) PD.render();
    else location.hash = hash;
  };

  PD.startRouter = function () {
    window.addEventListener('hashchange', PD.render);
    PD.render();
  };
})(window.PD = window.PD || {});
