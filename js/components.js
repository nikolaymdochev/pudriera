/* Reusable pieces of markup. Each function returns an HTML string. */
(function (PD) {
  'use strict';
  var esc = PD.esc, icon = PD.icon;

  /* ---------- header ---------- */
  PD.NAV = [
    { href: '#/catalog', label: 'Каталог', route: 'catalog' },
    { href: '#/catalog?group=lips', label: 'Устни' },
    { href: '#/catalog?group=face', label: 'Лице' },
    { href: '#/catalog?group=cheeks', label: 'Бузи' },
    { href: '#/catalog?group=eyes', label: 'Очи' },
    { href: '#/brands', label: 'Марки' }
  ];

  PD.header = function () {
    var u = PD.user();
    var n = PD.myWishes().filter(function (w) { return !w.bought; }).length;
    return '' +
      '<div class="strip"><div class="wrap strip-in">' +
        '<span>' + PD.products().length + ' продукта · ' + PD.brands().length + ' марки</span>' +
        '<span class="strip-sep" aria-hidden="true"></span>' +
        '<span>Снимки и информация от официалните сайтове на марките</span>' +
      '</div></div>' +
      '<div class="head"><div class="wrap head-in">' +
        '<a class="logo" href="#/" aria-label="Пудриера, начало"><span class="logo-dot" aria-hidden="true"></span>ПУДРИЕРА</a>' +
        '<nav class="nav" aria-label="Основно меню">' +
          PD.NAV.map(function (l) {
            return '<a href="' + l.href + '" data-nav="' + esc(l.href) + '">' + l.label + '</a>';
          }).join('') +
        '</nav>' +
        '<div class="head-tools">' +
          '<button class="icon-btn" type="button" data-action="install" id="installBtn" hidden aria-label="Инсталирай приложението">' + icon('download') + '</button>' +
          '<button class="icon-btn" type="button" data-action="theme" aria-label="Смени темата">' + icon(PD.theme() === 'dark' ? 'sun' : 'moon') + '</button>' +
          (u
            ? '<button class="user-chip" type="button" data-action="account" aria-label="Профил: ' + esc(u.name) + '">' +
                '<span class="avatar" aria-hidden="true">' + esc(u.name.charAt(0).toUpperCase()) + '</span><span class="user-name">' + esc(u.name) + '</span></button>'
            : '<button class="user-chip" type="button" data-action="login">' + icon('user') + '<span class="user-name">Влез</span></button>') +
          '<a class="wish-link" href="#/wishes" data-nav="#/wishes" aria-label="Моите желания' + (n ? ', ' + n : '') + '">' +
            icon('heart') + '<span class="wish-link-label">Желания</span>' +
            (n ? '<span class="badge">' + n + '</span>' : '') +
          '</a>' +
        '</div>' +
      '</div></div>';
  };

  /* ---------- footer ---------- */
  PD.footer = function () {
    return '<div class="wrap foot">' +
      '<div class="foot-brand">' +
        '<a class="logo" href="#/"><span class="logo-dot" aria-hidden="true"></span>ПУДРИЕРА</a>' +
        '<p>Личен списък с желани гримове. Избираш продукт, казваш до колко € си готова да дадеш и виждаш веднага кое е в бюджета ти.</p>' +
      '</div>' +
      '<div class="foot-col"><div class="eyebrow">Разгледай</div>' +
        PD.GROUPS.map(function (g) { return '<a href="#/catalog?group=' + g.key + '">' + g.label + '</a>'; }).join('') +
      '</div>' +
      '<div class="foot-col"><div class="eyebrow">Твоето</div>' +
        '<a href="#/wishes">Моите желания</a>' +
        '<a href="#/wishes" data-action="custom-wish">Свое желание</a>' +
      '</div>' +
      '<div class="foot-note">' +
        '<p>Снимките, имената и нюансите са от официалните онлайн магазини на марките. Цените са ориентировъчни, превърнати от щатски долари в евро. Списъкът с желания се пази само в този браузър.</p>' +
        '<p>© 2026 Пудриера</p>' +
      '</div>' +
    '</div>';
  };

  /* ---------- product card ---------- */
  PD.productCard = function (p, opts) {
    opts = opts || {};
    var wished = !!PD.wishFor(p.id);
    var alt = p.gallery[1] || p.image;
    return '<article class="pc">' +
      '<a class="pc-media" href="#/product/' + p.id + '" aria-label="' + esc(p.brand + ' ' + p.name) + '">' +
        '<img class="pc-main" src="' + PD.img(p.image, 500) + '" srcset="' + PD.img(p.image, 360) + ' 360w, ' + PD.img(p.image, 640) + ' 640w" sizes="(max-width: 640px) 50vw, 300px" alt="" loading="' + (opts.eager ? 'eager' : 'lazy') + '" decoding="async" />' +
        '<img class="pc-alt" src="' + PD.img(alt, 500) + '" alt="" loading="lazy" decoding="async" />' +
        (p.gallery.length > 2 ? '<span class="pc-count">' + p.gallery.length + ' снимки</span>' : '') +
      '</a>' +
      '<button class="pc-heart' + (wished ? ' on' : '') + '" type="button" data-action="wish" data-id="' + p.id + '" aria-pressed="' + wished + '" aria-label="' + (wished ? 'В желанията ти' : 'Искам го') + '">' + icon('heart') + '</button>' +
      '<div class="pc-body">' +
        '<div class="pc-brand">' + esc(p.brand) + '</div>' +
        '<a class="pc-name" href="#/product/' + p.id + '">' + esc(p.name) + '</a>' +
        (p.shade ? '<div class="pc-shade">' + esc(p.shade) + '</div>' : '') +
        '<div class="pc-foot">' +
          '<span class="pc-price">≈ ' + PD.eur(p.price) + '</span>' +
          (wished ? '<span class="pill pill-accent">' + icon('check') + 'В желанията</span>' : '') +
        '</div>' +
      '</div>' +
    '</article>';
  };

  PD.productGrid = function (list, opts) {
    return '<div class="grid">' + list.map(function (p, i) {
      return PD.productCard(p, { eager: opts && opts.eager && i < 4 });
    }).join('') + '</div>';
  };

  /* ---------- brand marquee ---------- */
  PD.marquee = function () {
    var names = PD.brands().map(function (b) {
      return '<a href="#/catalog?brand=' + encodeURIComponent(b.name) + '">' + esc(b.name) + '</a><span class="mq-dot" aria-hidden="true"></span>';
    }).join('');
    return '<div class="marquee" aria-label="Марки в каталога">' +
      '<div class="mq-track"><div class="mq-set">' + names + '</div><div class="mq-set" aria-hidden="true">' + names + '</div></div>' +
    '</div>';
  };

  /* ---------- category circle ---------- */
  PD.catTile = function (key, count) {
    var c = PD.cat(key), cover = PD.catCover(key);
    return '<a class="cat-tile" href="#/catalog?cat=' + key + '">' +
      '<span class="cat-img">' + (cover ? '<img src="' + PD.img(cover.image, 240) + '" alt="" loading="lazy" />' : '') + '</span>' +
      '<span class="cat-label">' + c.label + '</span>' +
      (count != null ? '<span class="cat-n">' + count + '</span>' : '') +
    '</a>';
  };

  /* ---------- wish card (my list) ---------- */
  PD.wishCard = function (w) {
    var p = w.productId ? PD.byId(w.productId) : null;
    var c = PD.cat(w.category);
    var b = PD.budget(w);
    var media = p
      ? '<a class="wc-media" href="#/product/' + p.id + '"><img src="' + PD.img(p.image, 240) + '" alt="" loading="lazy" /></a>'
      : '<div class="wc-media wc-swatch"><span style="background:' + esc(w.color || '#C9A3AF') + '"></span></div>';
    var title = (w.name || c.one);
    var status = '';
    if (w.bought) status = '<span class="pill pill-ok">' + PD.icon('check') + 'Купено</span>';
    else if (b && b.fits) status = '<span class="pill pill-ok">' + PD.icon('check') + 'В бюджета</span>';
    else if (b) status = '<span class="pill pill-warn">Над бюджета с ' + PD.eur(b.over) + '</span>';

    return '<article class="wc' + (w.bought ? ' bought' : '') + '" data-wish="' + esc(w.id) + '">' +
      media +
      '<div class="wc-body">' +
        '<div class="wc-top"><span class="eyebrow">' + esc(w.brand || 'Без марка') + ' · ' + esc(c.one) + '</span>' + status + '</div>' +
        (p ? '<a class="wc-title" href="#/product/' + p.id + '">' + esc(title) + '</a>' : '<div class="wc-title">' + esc(title) + '</div>') +
        (w.shade ? '<div class="wc-meta">Нюанс: ' + esc(w.shade) + '</div>' : '') +
        (w.note ? '<div class="wc-note">' + esc(w.note) + '</div>' : '') +
        '<div class="wc-actions">' +
          '<button class="link" type="button" data-action="wish-bought" data-id="' + esc(w.id) + '">' + (w.bought ? 'Върни в списъка' : PD.icon('check') + 'Купих го') + '</button>' +
          '<button class="link" type="button" data-action="wish-edit" data-id="' + esc(w.id) + '">' + PD.icon('edit') + 'Промени</button>' +
          '<button class="link danger" type="button" data-action="wish-del" data-id="' + esc(w.id) + '">' + PD.icon('trash') + 'Изтрий</button>' +
        '</div>' +
      '</div>' +
      '<div class="wc-price">' +
        '<span class="wc-lbl">твоят максимум</span>' +
        '<span class="wc-max">' + PD.eur(w.maxPrice) + '</span>' +
        (b ? '<span class="wc-cat">цена ≈ ' + PD.eur(b.price) + '</span>' : '') +
      '</div>' +
    '</article>';
  };

  PD.empty = function (title, text, action) {
    return '<div class="empty"><span class="empty-ic">' + icon('sparkle') + '</span><h2>' + title + '</h2><p>' + text + '</p>' + (action || '') + '</div>';
  };
})(window.PD = window.PD || {});
