/* Page renderers. Each returns { title, html, mount(root), refresh?(), unmount?() }. */
(function (PD) {
  'use strict';
  var esc = PD.esc, icon = PD.icon;
  PD.pages = {};

  /* model shots for the home banner: [product id, gallery index] */
  var HERO = [
    ['rare-kind-words', 5], ['natasha-biba', 3], ['tower28-shineon', 1],
    ['fenty-killawatt', 1], ['huda-pretty-grunge', 1], ['merit-flush-balm', 4], ['tarte-in-bloom', 2]
  ];
  var FEATURED = ['rare-soft-pinch', 'fenty-gloss-bomb', 'summer-lip-butter', 'natasha-biba',
    'abh-brow-wiz', 'tarte-shape-tape', 'fenty-killawatt', 'glossier-cloud-paint'];

  function heroSlides() {
    return HERO.map(function (h) {
      var p = PD.byId(h[0]);
      return p && p.gallery[h[1]] ? { p: p, src: p.gallery[h[1]] } : null;
    }).filter(Boolean);
  }

  function crumbs(items) {
    return '<nav class="crumbs" aria-label="Навигация">' + items.map(function (it, i) {
      return (i ? '<span aria-hidden="true">/</span>' : '') + (it[1] ? '<a href="' + it[1] + '">' + esc(it[0]) + '</a>' : '<span>' + esc(it[0]) + '</span>');
    }).join('') + '</nav>';
  }

  /* =========================================================== HOME */
  PD.pages.home = function () {
    var slides = heroSlides();
    var counts = PD.catCounts();
    var featured = FEATURED.map(PD.byId).filter(Boolean);
    var first = slides[0];
    var timer = null, idx = 0;

    var html =
      '<section class="hero">' +
        '<div class="wrap hero-in">' +
          '<div class="hero-copy">' +
            '<div class="eyebrow">Списък с желани гримове</div>' +
            '<h1>Гримът, който искаш. <em>На цената, която избираш.</em></h1>' +
            '<p class="lead">Любими продукти от Rare Beauty, Fenty Beauty, Huda Beauty и още ' + (PD.brands().length - 3) + ' марки. Отбележи какво искаш, кажи до колко € си готова да дадеш и виж веднага кое е в бюджета ти.</p>' +
            '<div class="hero-cta">' +
              '<a class="btn btn-primary" href="#/catalog">Разгледай каталога ' + icon('arrow') + '</a>' +
              '<a class="btn btn-ghost" href="#/wishes">' + icon('heart') + 'Моите желания</a>' +
            '</div>' +
            '<dl class="hero-stats">' +
              '<div><dt>' + PD.products().length + '</dt><dd>продукта</dd></div>' +
              '<div><dt>' + PD.brands().length + '</dt><dd>марки</dd></div>' +
              '<div><dt>3–6</dt><dd>снимки на продукт</dd></div>' +
            '</dl>' +
          '</div>' +
          '<div class="hero-stage">' +
            '<div class="hero-slides">' + slides.map(function (s, i) {
              return '<a class="hs' + (i === 0 ? ' on' : '') + '" href="#/product/' + s.p.id + '" tabindex="' + (i === 0 ? 0 : -1) + '" aria-label="' + esc(s.p.brand + ' ' + s.p.name) + '">' +
                '<img src="' + PD.img(s.src, 1000) + '" alt="" ' + (i === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + ' /></a>';
            }).join('') + '</div>' +
            (first ? '<a class="hero-chip" id="heroChip" href="#/product/' + first.p.id + '">' + chipInner(first.p) + '</a>' : '') +
            '<div class="hero-dots" role="tablist" aria-label="Снимки в банера">' + slides.map(function (s, i) {
              return '<button type="button" role="tab" data-i="' + i + '" aria-selected="' + (i === 0) + '" aria-label="Снимка ' + (i + 1) + '"></button>';
            }).join('') + '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +
      PD.marquee() +

      '<section class="wrap section">' +
        '<div class="sec-head"><h2>Пазарувай по категория</h2><a class="more" href="#/catalog">Всички продукти ' + icon('arrow') + '</a></div>' +
        '<div class="cat-row">' + PD.CATS.filter(function (c) { return counts[c.key]; }).map(function (c) {
          return PD.catTile(c.key, counts[c.key]);
        }).join('') + '</div>' +
      '</section>' +

      '<section class="wrap section">' +
        '<div class="sec-head"><h2>Най-желани сега</h2><a class="more" href="#/catalog">Целият каталог ' + icon('arrow') + '</a></div>' +
        '<div id="featured">' + PD.productGrid(featured, { eager: false }) + '</div>' +
      '</section>' +

      '<section class="how"><div class="wrap">' +
        '<h2>Как работи</h2>' +
        '<ol class="steps">' +
          '<li><span class="step-n">1</span><h3>Избери продукт</h3><p>Разгледай каталога или добави свое желание с марка и вид грим.</p></li>' +
          '<li><span class="step-n">2</span><h3>Кажи бюджета си</h3><p>Натисни „Искам го“ и напиши до колко € си готова да дадеш. Това е всичко.</p></li>' +
          '<li><span class="step-n">3</span><h3>Виж кое е в бюджета</h3><p>Списъкът ти показва кое струва по-малко от максимума ти и кое е над него.</p></li>' +
        '</ol>' +
        '<button class="btn btn-primary" type="button" data-action="custom-wish">' + icon('plus') + 'Добави свое желание</button>' +
      '</div></section>';

    function chipInner(p) {
      return '<span class="hc-img"><img src="' + PD.img(p.image, 160) + '" alt="" /></span>' +
        '<span class="hc-txt"><span class="hc-brand">' + esc(p.brand) + '</span><span class="hc-name">' + esc(p.name) + '</span><span class="hc-price">≈ ' + PD.eur(p.price) + '</span></span>' +
        '<span class="hc-go">' + icon('arrow') + '</span>';
    }

    function show(root, n) {
      var items = root.querySelectorAll('.hs'), dots = root.querySelectorAll('.hero-dots button');
      if (!items.length) return;
      idx = (n + items.length) % items.length;
      items.forEach(function (el, i) { el.classList.toggle('on', i === idx); el.tabIndex = i === idx ? 0 : -1; });
      dots.forEach(function (d, i) { d.setAttribute('aria-selected', String(i === idx)); });
      var chip = root.querySelector('#heroChip'), s = slides[idx];
      if (chip && s) {
        chip.classList.remove('in'); void chip.offsetWidth; chip.classList.add('in');
        chip.href = '#/product/' + s.p.id;
        chip.innerHTML = chipInner(s.p);
      }
    }

    return {
      title: 'Пудриера · гримове и списък с желания',
      html: html,
      mount: function (root) {
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var start = function () {
          clearInterval(timer);
          timer = setInterval(function () { if (!document.hidden) show(root, idx + 1); }, reduce ? 7000 : 4800);
        };
        root.querySelectorAll('.hero-dots button').forEach(function (b) {
          b.addEventListener('click', function () { show(root, +b.dataset.i); start(); });
        });
        // preload the rest of the banner photos after first paint
        setTimeout(function () { slides.forEach(function (s) { var i = new Image(); i.src = PD.img(s.src, 1000); }); }, 1200);
        start();
      },
      refresh: function (root) {
        var f = root.querySelector('#featured');
        if (f) f.innerHTML = PD.productGrid(featured);
      },
      unmount: function () { clearInterval(timer); }
    };
  };

  /* ======================================================== CATALOG */
  var SORTS = [
    ['rec', 'Препоръчани'], ['price-asc', 'Цена: от ниска'], ['price-desc', 'Цена: от висока'],
    ['brand', 'Марка А–Я'], ['name', 'Име А–Я']
  ];

  function priceBounds() {
    var prices = PD.products().map(function (p) { return p.price || 0; });
    return { min: Math.floor(Math.min.apply(null, prices)), max: Math.ceil(Math.max.apply(null, prices)) };
  }

  function applyFilters(st) {
    var q = st.q.trim().toLowerCase();
    var list = PD.products().filter(function (p) {
      if (q && (p.brand + ' ' + p.name + ' ' + (p.shade || '') + ' ' + PD.cat(p.category).label).toLowerCase().indexOf(q) < 0) return false;
      if (st.cat && p.category !== st.cat) return false;
      if (!st.cat && st.group && PD.cat(p.category).group !== st.group) return false;
      if (st.brand && p.brand !== st.brand) return false;
      if (p.price > st.max) return false;
      return true;
    });
    var by = {
      'price-asc': function (a, b) { return a.price - b.price; },
      'price-desc': function (a, b) { return b.price - a.price; },
      brand: function (a, b) { return a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name); },
      name: function (a, b) { return a.name.localeCompare(b.name); }
    }[st.sort];
    return by ? list.slice().sort(by) : list;
  }

  PD.pages.catalog = function (params) {
    var b = priceBounds();
    var qp = params.query || {};
    var st = {
      q: qp.q || '', cat: qp.cat || '', group: qp.group || '', brand: qp.brand || '',
      max: qp.max ? Math.min(+qp.max, b.max) : b.max, sort: qp.sort || 'rec'
    };

    function titleFor() {
      if (st.cat) return PD.cat(st.cat).label;
      if (st.brand && !st.group) return st.brand;
      if (st.group) return PD.groupLabel(st.group);
      return 'Каталог';
    }

    var catOptions = '<option value="">Всички категории</option>' + PD.GROUPS.map(function (g) {
      return '<optgroup label="' + g.label + '">' + PD.CATS.filter(function (c) { return c.group === g.key; }).map(function (c) {
        return '<option value="' + c.key + '">' + c.label + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    var brandOptions = '<option value="">Всички марки</option>' + PD.brands().map(function (br) {
      return '<option value="' + esc(br.name) + '">' + esc(br.name) + ' (' + br.count + ')</option>';
    }).join('');

    var html =
      '<section class="wrap page">' +
        crumbs([['Начало', '#/'], ['Каталог', null]]) +
        '<div class="page-head"><h1 id="catTitle">' + esc(titleFor()) + '</h1><p class="muted" id="catCount"></p></div>' +
        '<div class="chips" id="groupChips" role="group" aria-label="Част от лицето">' +
          '<button type="button" class="chip" data-g="">Всичко</button>' +
          PD.GROUPS.map(function (g) { return '<button type="button" class="chip" data-g="' + g.key + '">' + g.label + '</button>'; }).join('') +
        '</div>' +
        '<div class="filters">' +
          '<label class="f-search">' + icon('search') + '<input id="f-q" type="search" placeholder="Търси продукт, марка или нюанс" autocomplete="off" aria-label="Търсене" /></label>' +
          '<select id="f-cat" aria-label="Категория">' + catOptions + '</select>' +
          '<select id="f-brand" aria-label="Марка">' + brandOptions + '</select>' +
          '<label class="f-range"><span>Цена до <b id="f-max-v"></b></span><input id="f-max" type="range" min="' + b.min + '" max="' + b.max + '" step="1" aria-label="Максимална цена" /></label>' +
          '<select id="f-sort" aria-label="Подреди">' + SORTS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select>' +
          '<button type="button" class="link" id="f-reset">Изчисти</button>' +
        '</div>' +
        '<div id="catGrid"></div>' +
      '</section>';

    var root;
    function syncUrl() {
      var q = [];
      if (st.q) q.push('q=' + encodeURIComponent(st.q));
      if (st.cat) q.push('cat=' + st.cat);
      if (st.group && !st.cat) q.push('group=' + st.group);
      if (st.brand) q.push('brand=' + encodeURIComponent(st.brand));
      if (st.max < b.max) q.push('max=' + st.max);
      if (st.sort !== 'rec') q.push('sort=' + st.sort);
      var h = '#/catalog' + (q.length ? '?' + q.join('&') : '');
      if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (e) {} }
      PD.markNav && PD.markNav();
    }
    function renderGrid() {
      var list = applyFilters(st);
      root.querySelector('#catTitle').textContent = titleFor();
      root.querySelector('#catCount').textContent = list.length + ' ' + PD.plural(list.length, 'продукт', 'продукта') +
        (st.brand && (st.cat || st.group) ? ' от ' + st.brand : '');
      root.querySelector('#f-max-v').textContent = PD.eur(st.max);
      root.querySelectorAll('#groupChips .chip').forEach(function (c) {
        c.setAttribute('aria-pressed', String(!st.cat && c.dataset.g === st.group));
      });
      root.querySelector('#catGrid').innerHTML = list.length
        ? PD.productGrid(list, { eager: true })
        : PD.empty('Няма такива продукти', 'Пробвай с друга марка, категория или по-висока цена.',
            '<button class="btn btn-ghost" type="button" id="f-reset2">Изчисти филтрите</button>');
      var r2 = root.querySelector('#f-reset2');
      if (r2) r2.addEventListener('click', reset);
      syncUrl();
    }
    function fillControls() {
      root.querySelector('#f-q').value = st.q;
      root.querySelector('#f-cat').value = st.cat;
      root.querySelector('#f-brand').value = st.brand;
      root.querySelector('#f-max').value = st.max;
      root.querySelector('#f-sort').value = st.sort;
    }
    function reset() {
      st = { q: '', cat: '', group: '', brand: '', max: b.max, sort: 'rec' };
      fillControls();
      renderGrid();
    }

    return {
      title: 'Каталог · Пудриера',
      html: html,
      mount: function (r) {
        root = r;
        fillControls();
        var t = null;
        root.querySelector('#f-q').addEventListener('input', function (e) {
          clearTimeout(t);
          t = setTimeout(function () { st.q = e.target.value; renderGrid(); }, 160);
        });
        root.querySelector('#f-cat').addEventListener('change', function (e) {
          st.cat = e.target.value;
          if (st.cat) st.group = PD.cat(st.cat).group;
          renderGrid();
        });
        root.querySelector('#f-brand').addEventListener('change', function (e) { st.brand = e.target.value; renderGrid(); });
        root.querySelector('#f-sort').addEventListener('change', function (e) { st.sort = e.target.value; renderGrid(); });
        var mt = null;
        root.querySelector('#f-max').addEventListener('input', function (e) {
          st.max = +e.target.value;
          root.querySelector('#f-max-v').textContent = PD.eur(st.max);
          clearTimeout(mt);
          mt = setTimeout(renderGrid, 90);
        });
        root.querySelector('#f-reset').addEventListener('click', reset);
        root.querySelectorAll('#groupChips .chip').forEach(function (c) {
          c.addEventListener('click', function () {
            st.group = c.dataset.g; st.cat = '';
            root.querySelector('#f-cat').value = '';
            renderGrid();
          });
        });
        renderGrid();
      },
      refresh: function () { if (root) renderGrid(); }
    };
  };

  /* ======================================================== PRODUCT */
  PD.pages.product = function (params) {
    var p = PD.byId(params.id);
    if (!p) return PD.pages.notFound();
    var c = PD.cat(p.category);
    var gal = p.gallery;
    var idx = 0, keyHandler = null;

    var similar = PD.products().filter(function (x) { return x.id !== p.id && x.category === p.category; });
    if (similar.length < 4) {
      similar = similar.concat(PD.products().filter(function (x) {
        return x.id !== p.id && x.category !== p.category && PD.cat(x.category).group === c.group;
      }));
    }
    similar = similar.slice(0, 4);

    function ctaHtml() {
      var w = PD.wishFor(p.id);
      if (!w) {
        return '<button class="btn btn-primary btn-lg" type="button" data-action="wish" data-id="' + p.id + '">' + icon('heart') + 'Искам го</button>' +
          '<p class="hint">Едно докосване: казваш до колко € си готова да дадеш и готово.</p>';
      }
      var b = PD.budget(w);
      return '<div class="pd-wished">' +
        '<div class="pd-wished-top">' + icon('heart', 'ic-fill') + '<span>В желанията ти, до <b>' + PD.eur(w.maxPrice) + '</b></span>' +
          (b ? (b.fits ? '<span class="pill pill-ok">' + icon('check') + 'В бюджета</span>' : '<span class="pill pill-warn">Над бюджета с ' + PD.eur(b.over) + '</span>') : '') +
        '</div>' +
        '<div class="pd-wished-actions"><button class="btn btn-ghost" type="button" data-action="wish-edit" data-id="' + esc(w.id) + '">' + icon('edit') + 'Промени бюджета</button>' +
        '<a class="btn btn-ghost" href="#/wishes">Към списъка</a></div>' +
      '</div>';
    }

    var html =
      '<section class="wrap page">' +
        crumbs([['Начало', '#/'], ['Каталог', '#/catalog'], [c.label, '#/catalog?cat=' + p.category], [p.name, null]]) +
        '<div class="pd">' +
          '<div class="pd-gallery">' +
            '<div class="pd-main" id="galMain">' +
              gal.map(function (u, i) {
                return '<img class="pd-img' + (i === 0 ? ' on' : '') + '" src="' + PD.img(u, 1100) + '" alt="' + esc(p.brand + ' ' + p.name + ', снимка ' + (i + 1)) + '"' + (i ? ' loading="lazy"' : '') + ' />';
              }).join('') +
              '<button class="gal-nav prev" type="button" data-gal="-1" aria-label="Предишна снимка">' + icon('left') + '</button>' +
              '<button class="gal-nav next" type="button" data-gal="1" aria-label="Следваща снимка">' + icon('right') + '</button>' +
              '<span class="gal-count" id="galCount">1 / ' + gal.length + '</span>' +
            '</div>' +
            '<div class="pd-thumbs" id="galThumbs">' + gal.map(function (u, i) {
              return '<button type="button" class="pd-thumb' + (i === 0 ? ' on' : '') + '" data-i="' + i + '" aria-label="Снимка ' + (i + 1) + '"><img src="' + PD.img(u, 200) + '" alt="" /></button>';
            }).join('') + '</div>' +
          '</div>' +
          '<div class="pd-info">' +
            '<a class="pd-brand" href="#/catalog?brand=' + encodeURIComponent(p.brand) + '">' + esc(p.brand) + '</a>' +
            '<h1 class="pd-name">' + esc(p.name) + '</h1>' +
            (p.shade ? '<div class="pd-shade">Нюанс на снимките: <b>' + esc(p.shade) + '</b></div>' : '') +
            '<div class="pd-price">≈ ' + PD.eur(p.price) + '<span>ориентировъчна цена</span></div>' +
            '<p class="pd-desc">' + esc(p.description) + '</p>' +
            '<div class="pd-cta" id="pdCta">' + ctaHtml() + '</div>' +
            '<div class="pd-buy">' +
              '<div class="eyebrow">Къде да го купиш</div>' +
              '<div class="buy-links">' +
                '<a href="' + esc(p.buy.official) + '" target="_blank" rel="noopener">Официален сайт на ' + esc(p.brand) + icon('external') + '</a>' +
                '<a href="' + esc(p.buy.notino) + '" target="_blank" rel="noopener">Notino.bg' + icon('external') + '</a>' +
                '<a href="' + esc(p.buy.emag) + '" target="_blank" rel="noopener">eMAG.bg' + icon('external') + '</a>' +
              '</div>' +
            '</div>' +
            '<dl class="pd-spec">' +
              '<div><dt>Категория</dt><dd><a href="#/catalog?cat=' + p.category + '">' + c.one + '</a></dd></div>' +
              '<div><dt>Марка</dt><dd><a href="#/catalog?brand=' + encodeURIComponent(p.brand) + '">' + esc(p.brand) + '</a></dd></div>' +
              (p.shade ? '<div><dt>Нюанс</dt><dd>' + esc(p.shade) + '</dd></div>' : '') +
              '<div><dt>Снимки</dt><dd>' + gal.length + ', от официалния сайт</dd></div>' +
            '</dl>' +
          '</div>' +
        '</div>' +
      '</section>' +
      (similar.length ? '<section class="wrap section"><div class="sec-head"><h2>Може да харесаш и</h2></div><div id="similar">' + PD.productGrid(similar) + '</div></section>' : '');

    function show(root, n) {
      idx = (n + gal.length) % gal.length;
      root.querySelectorAll('.pd-img').forEach(function (im, i) { im.classList.toggle('on', i === idx); });
      root.querySelectorAll('.pd-thumb').forEach(function (t, i) { t.classList.toggle('on', i === idx); });
      root.querySelector('#galCount').textContent = (idx + 1) + ' / ' + gal.length;
    }

    return {
      title: p.brand + ' ' + p.name + ' · Пудриера',
      html: html,
      mount: function (root) {
        root.querySelectorAll('.pd-thumb').forEach(function (t) {
          t.addEventListener('click', function () { show(root, +t.dataset.i); });
        });
        root.querySelectorAll('[data-gal]').forEach(function (bt) {
          bt.addEventListener('click', function () { show(root, idx + (+bt.dataset.gal)); });
        });
        // swipe on touch screens
        var main = root.querySelector('#galMain'), x0 = null;
        main.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
        main.addEventListener('pointerup', function (e) {
          if (x0 == null) return;
          var dx = e.clientX - x0; x0 = null;
          if (Math.abs(dx) > 40) show(root, idx + (dx < 0 ? 1 : -1));
        });
        keyHandler = function (e) {
          if (document.getElementById('sheet').hidden === false) return;
          if (e.key === 'ArrowRight') show(root, idx + 1);
          if (e.key === 'ArrowLeft') show(root, idx - 1);
        };
        document.addEventListener('keydown', keyHandler);
      },
      refresh: function (root) {
        root.querySelector('#pdCta').innerHTML = ctaHtml();
        var s = root.querySelector('#similar');
        if (s) s.innerHTML = PD.productGrid(similar);
      },
      unmount: function () { document.removeEventListener('keydown', keyHandler); }
    };
  };

  /* ========================================================= WISHES */
  PD.pages.wishes = function () {
    var tab = 'open', sort = 'new';

    function body() {
      var u = PD.user();
      if (!u) {
        return PD.empty('Влез, за да видиш желанията си',
          'Без парола: пишеш само името си. Списъкът се пази под него в този браузър.',
          '<button class="btn btn-primary" type="button" data-action="login">' + icon('user') + 'Влез с име</button>');
      }
      var all = PD.myWishes();
      if (!all.length) {
        return PD.empty('Списъкът ти е празен',
          'Натисни сърцето на продукт в каталога или добави свое желание с марка и цена.',
          '<div class="empty-cta"><a class="btn btn-primary" href="#/catalog">Разгледай каталога</a>' +
          '<button class="btn btn-ghost" type="button" data-action="custom-wish">' + icon('plus') + 'Свое желание</button></div>');
      }
      var open = all.filter(function (w) { return !w.bought; });
      var bought = all.length - open.length;
      var budget = open.reduce(function (s, w) { return s + (+w.maxPrice || 0); }, 0);
      var fits = open.filter(function (w) { var b = PD.budget(w); return b && b.fits; }).length;

      var list = tab === 'open' ? open : tab === 'bought' ? all.filter(function (w) { return w.bought; }) : all.slice();
      list.sort({
        'new': function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); },
        'price-asc': function (a, b) { return a.maxPrice - b.maxPrice; },
        'price-desc': function (a, b) { return b.maxPrice - a.maxPrice; }
      }[sort]);

      return '<div class="summary">' +
          '<div><span class="sum-n">' + open.length + '</span><span class="sum-l">' + PD.plural(open.length, 'чакащо желание', 'чакащи желания') + '</span></div>' +
          '<div><span class="sum-n">' + PD.eur(budget) + '</span><span class="sum-l">общ бюджет</span></div>' +
          '<div><span class="sum-n">' + fits + '</span><span class="sum-l">в бюджета по каталожна цена</span></div>' +
          '<div><span class="sum-n">' + bought + '</span><span class="sum-l">купени</span></div>' +
        '</div>' +
        '<div class="list-tools">' +
          '<div class="tabs" role="tablist">' +
            [['open', 'Чакащи', open.length], ['bought', 'Купени', bought], ['all', 'Всички', all.length]].map(function (t) {
              return '<button type="button" role="tab" class="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + ' <span>' + t[2] + '</span></button>';
            }).join('') +
          '</div>' +
          '<select id="w-sort" aria-label="Подреди"><option value="new">Най-нови</option><option value="price-asc">Бюджет: от нисък</option><option value="price-desc">Бюджет: от висок</option></select>' +
        '</div>' +
        (list.length ? '<div class="wish-list">' + list.map(PD.wishCard).join('') + '</div>'
          : PD.empty(tab === 'bought' ? 'Още нищо не е купено' : 'Всичко е купено', tab === 'bought' ? 'Когато купиш нещо, натисни „Купих го“ и ще се появи тук.' : 'Браво! Добави ново желание, когато решиш.', ''));
    }

    var root;
    function paint() {
      var u = PD.user();
      root.querySelector('#wHello').textContent = u ? 'Списъкът на ' + u.name : 'Твоят личен списък';
      root.querySelector('#wActions').hidden = !u;
      root.querySelector('#wBody').innerHTML = body();
      var s = root.querySelector('#w-sort');
      if (s) {
        s.value = sort;
        s.addEventListener('change', function () { sort = s.value; paint(); });
      }
      root.querySelectorAll('.tab').forEach(function (t) {
        t.addEventListener('click', function () { tab = t.dataset.tab; paint(); });
      });
    }

    return {
      title: 'Моите желания · Пудриера',
      html: '<section class="wrap page">' +
          crumbs([['Начало', '#/'], ['Моите желания', null]]) +
          '<div class="page-head row">' +
            '<div><div class="eyebrow" id="wHello"></div><h1>Моите желания</h1></div>' +
            '<div class="head-actions" id="wActions">' +
              '<button class="btn btn-primary" type="button" data-action="custom-wish">' + icon('plus') + 'Свое желание</button>' +
              '<a class="btn btn-ghost" href="#/catalog">Добави от каталога</a>' +
            '</div>' +
          '</div>' +
          '<div id="wBody"></div>' +
        '</section>',
      mount: function (r) { root = r; paint(); },
      refresh: function () { if (root) paint(); }
    };
  };

  /* ========================================================= BRANDS */
  PD.pages.brands = function () {
    var html = '<section class="wrap page">' +
      crumbs([['Начало', '#/'], ['Марки', null]]) +
      '<div class="page-head"><h1>Марки</h1><p class="muted">' + PD.brands().length + ' марки, всички с продукти и снимки от официалните им сайтове.</p></div>' +
      '<div class="brand-grid">' + PD.brands().map(function (b) {
        var items = PD.products().filter(function (p) { return p.brand === b.name; }).slice(0, 3);
        return '<a class="brand-card" href="#/catalog?brand=' + encodeURIComponent(b.name) + '">' +
          '<div class="bc-imgs">' + items.map(function (p) { return '<span><img src="' + PD.img(p.image, 220) + '" alt="" loading="lazy" /></span>'; }).join('') + '</div>' +
          '<div class="bc-name">' + esc(b.name) + '</div>' +
          '<div class="bc-n">' + b.count + ' ' + PD.plural(b.count, 'продукт', 'продукта') + icon('arrow') + '</div>' +
        '</a>';
      }).join('') + '</div>' +
    '</section>';
    return { title: 'Марки · Пудриера', html: html, mount: function () {} };
  };

  /* ====================================================== NOT FOUND */
  PD.pages.notFound = function () {
    return {
      title: 'Няма такава страница · Пудриера',
      html: '<section class="wrap page">' + PD.empty('Няма такава страница', 'Връзката може да е стара или продуктът да е махнат от каталога.',
        '<a class="btn btn-primary" href="#/catalog">Към каталога</a>') + '</section>',
      mount: function () {}
    };
  };
})(window.PD = window.PD || {});
