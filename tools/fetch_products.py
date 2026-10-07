#!/usr/bin/env python3
"""
Build the Пудриера product catalogue from the brands' own online stores.

Every brand below runs on Shopify, which publishes its catalogue at
/products.json. For each product in CATALOG the script reads that feed, picks
one shade, and keeps only that shade's photos (packshot, swatch, texture,
model) plus the product's shade-neutral photos — so a gallery shows the same
product in the same shade from different angles, never a different product.

Writes js/data.js (window.PRODUCTS) and data/products.json.
Usage:  python3 tools/fetch_products.py
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0 Safari/537.36")
USD_TO_EUR = 0.92
MIN_PHOTOS, MAX_PHOTOS = 3, 6

STORES = {
    "rare":      ("Rare Beauty",             "https://www.rarebeauty.com"),
    "fenty":     ("Fenty Beauty",            "https://fentybeauty.com"),
    "huda":      ("Huda Beauty",             "https://hudabeauty.com/en-us"),
    "kylie":     ("Kylie Cosmetics",         "https://kyliecosmetics.com"),
    "milk":      ("Milk Makeup",             "https://milkmakeup.com"),
    "patrickta": ("Patrick Ta",              "https://patrickta.com"),
    "natasha":   ("Natasha Denona",          "https://natashadenona.com"),
    "summer":    ("Summer Fridays",          "https://summerfridays.com"),
    "saie":      ("Saie",                    "https://saiehello.com"),
    "glossier":  ("Glossier",                "https://glossier.com"),
    "abh":       ("Anastasia Beverly Hills", "https://anastasiabeverlyhills.com"),
    "tarte":     ("Tarte",                   "https://tartecosmetics.com"),
    "haus":      ("Haus Labs",               "https://hauslabs.com"),
    "merit":     ("Merit",                   "https://meritbeauty.com"),
    "westman":   ("Westman Atelier",         "https://westman-atelier.com"),
    "tower28":   ("Tower 28",                "https://tower28beauty.com"),
    "morphe":    ("Morphe",                  "https://morphe.com"),
}

# id, store, Shopify handle, category, preferred shade (substring) or None, description (BG)
CATALOG = [
    # --- Червила ---
    ("rare-kind-words", "rare", "kind-words-matte-lipstick", "lipstick", None,
     "Матово червило с мек, кадифен финиш, което не изсушава. Нюансите са подбрани за ежедневен, естествен вид."),
    ("fenty-icon-velvet", "fenty", "fenty-icon-velvet-liquid-lipstick-the-mvp", "lipstick", None,
     "Течно червило с кадифено-матов финиш и наситен цвят с едно нанасяне. Леко е на устните и не се напуква."),
    ("natasha-nude-lipstick", "natasha", "i-need-a-nude-lipstick", "lipstick", None,
     "Кремообразно червило от колекцията „I Need a Nude“: нюдови нюанси, подбрани за различни тонове кожа."),
    ("patrickta-matte-suede", "patrickta", "matte-suede-lipstick", "lipstick", None,
     "Матово червило с велурена текстура от гримьора на звездите Патрик Та. Плътен цвят и комфорт цял ден."),
    ("westman-lip-suede", "westman", "lip-suede-matte-lipstick-mimi", "lipstick", None,
     "Луксозно матово червило с подхранващи масла. Елегантна опаковка и мек, замъглен финиш."),
    ("merit-signature-lip", "merit", "signature-lip", "lipstick", None,
     "Червило-балсам с лек сатенен финиш. Създадено за бърз грим „без грим“ в рамките на минута."),
    # --- Моливи за устни ---
    ("huda-lip-contour", "huda", "lip-contour-2-0-automatic-matte-lip-pencil-hb00390m", "lipliner", None,
     "Автоматичен матов молив за устни, който не се остри. Очертава и запълва, издържа цял ден."),
    ("abh-lip-liner", "abh", "lip-liner", "lipliner", None,
     "Кремообразен молив за устни в десетки нюанси. Прецизен контур, който не се разлива."),
    ("kylie-precision-pout", "kylie", "precision-pout-lip-liner", "lipliner", None,
     "Молив за устни с прецизен връх за дефинирани устни. Плътен цвят, който пасва на червилата на Kylie."),
    ("tarte-maracuja-liner", "tarte", "maracuja-juicy-lip-plump-liner", "lipliner", None,
     "Молив за устни с маракуя, който едновременно очертава и визуално уголемява устните."),
    # --- Гланцове и балсами ---
    ("fenty-gloss-bomb", "fenty", "gloss-bomb-universal-lip-luminizer-fenty-glow", "gloss", None,
     "Гланцът, който подхожда на всички. Голям апликатор, бляскав финиш без лепкавост и аромат на праскова и ванилия."),
    ("rare-lip-oil", "rare", "soft-pinch-tinted-lip-oil", "gloss", None,
     "Оцветено масло за устни с лек блясък. Хидратира и дава свеж, естествен цвят."),
    ("summer-lip-butter", "summer", "lip-butter-balm-pink-sugar", "gloss", None,
     "Вирусният балсам за устни с масло от шеа. Дава мек блясък и лек оттенък, без лепкавост."),
    ("glossier-balm-dotcom", "glossier", "balm-dotcom", "gloss", None,
     "Култовият балсам на Glossier за сухи устни. Лек блясък, хидратация и приятни аромати."),
    ("haus-phd-lip-glaze", "haus", "phd-hybrid-lip-glaze", "gloss", None,
     "Гланц-хибрид от марката на Лейди Гага. Стъклен блясък, пептиди за обем и грижа за устните."),
    ("tower28-shineon", "tower28", "shine-on-lip-gloss-jelly", "gloss", None,
     "Желиран гланц-масло с прозрачен цвят и стъклен блясък. Подходящ и за чувствителна кожа."),
    ("kylie-lip-butter", "kylie", "lip-butter", "gloss", None,
     "Масло за устни с лек оттенък, което подхранва и придава мек блясък. Ухае сладко."),
    # --- Фон дьо тен ---
    ("fenty-pro-filtr", "fenty", "pro-filtr-soft-matte-longwear-foundation-235", "foundation", None,
     "Матов фон дьо тен със средно до пълно покритие в 50 нюанса. Издържа цял ден, без да лъщи."),
    ("rare-liquid-touch", "rare", "liquid-touch-weightless-foundation-1", "foundation", None,
     "Безтегловен фон дьо тен с естествен финиш. Изглежда като кожа, а не като маска."),
    ("haus-triclone", "haus", "triclone-skin-tech-medium-coverage-foundation", "foundation", None,
     "Фон дьо тен с ферментирала арника, който прикрива и успокоява кожата. Средно, изграждащо се покритие."),
    ("natasha-hy-glam", "natasha", "hy-glam-foundation", "foundation", None,
     "Хидратиращ фон дьо тен с изглаждащ ефект. Естествено сияние и комфорт за сухата кожа."),
    ("westman-vital-skin", "westman", "vital-skin-foundation-stick-atelier-iv", "foundation", None,
     "Фон дьо тен в стик, с който се гримираш за секунди. Лек, кремообразен и с грижовни съставки."),
    ("saie-slip-tint", "saie", "slip-tint-tinted-moisturizer", "foundation", None,
     "Тониращ крем с лек цвят и SPF защита. За свеж вид с „кожа като кожа“."),
    # --- Коректори ---
    ("tarte-shape-tape", "tarte", "shape-tape-radiant-concealer", "concealer", None,
     "Сияйната версия на легендарния Shape Tape. Пълно покритие с озаряващ, хидратиращ финиш."),
    ("rare-brightening-concealer", "rare", "liquid-touch-brightening-concealer", "concealer", None,
     "Озаряващ коректор с лека текстура. Прикрива и освежава зоната под очите."),
    ("haus-triclone-concealer", "haus", "triclone-skin-tech-concealer", "concealer", None,
     "Коректор с високо покритие и успокояващи съставки. Не се набира в бръчиците и издържа цял ден."),
    ("milk-hydro-grip-concealer", "milk", "hydro-grip-gel-concealer", "concealer", None,
     "Гел коректор, който се слива с кожата. Хидратира и покрива, без да натежава."),
    ("natasha-hy-glam-concealer", "natasha", "hy-glam-concealer", "concealer", None,
     "Кремообразен коректор от линията Hy-Glam. Покрива тъмни кръгове и несъвършенства с естествен финиш."),
    # --- Пудри ---
    ("abh-loose-powder", "abh", "loose-setting-powder", "powder", None,
     "Фина насипна пудра за фиксиране и „печене“. Матира и задържа грима на място цял ден."),
    ("tarte-shape-tape-powder", "tarte", "shape-tape-pressed-powder", "powder", None,
     "Компактна пудра от серията Shape Tape. Замъглява порите и матира без ефект на маска."),
    ("saie-slip-tint-powder", "saie", "slip-tint-undetectable-baked-setting-powder", "powder", None,
     "Невидима печена пудра, която фиксира, без да утежнява. Мек, естествен финиш."),
    # --- Ружове ---
    ("rare-soft-pinch", "rare", "soft-pinch-liquid-blush", "blush", "Hope",
     "Вирусният течен руж: една капка стига за цялата буза. Изключително пигментиран и лесен за размазване."),
    ("patrickta-double-take", "patrickta", "creme-powder-blush-duos", "blush", None,
     "Двоен руж: кремообразен и пудрен в една опаковка. Наслояват се за наситен, дълготраен цвят."),
    ("huda-blush-filter", "huda", "blush-filter-liquid-blush-hb01345m", "blush", None,
     "Течен руж с ефект на филтър. Замъглява и дава свеж, естествен цвят на бузите."),
    ("milk-lip-cheek", "milk", "lip-cheek", "blush", None,
     "Кремообразен стик за устни и бузи. Нанасяш с пръсти за свеж цвят за секунди."),
    ("glossier-cloud-paint", "glossier", "cloud-paint", "blush", None,
     "Гел-крем руж в тубичка, като боя. Размазва се лесно и дава естествен, „вътрешен“ цвят."),
    ("saie-dew-blush", "saie", "dew-blush", "blush", None,
     "Течен руж с влажен, сияен финиш. Лек, хидратиращ и изграждащ се цвят."),
    ("westman-baby-cheeks", "westman", "baby-cheeks-blush-stick-dou-dou", "blush", None,
     "Кремообразен руж в стик за мек, детски свеж вид. Нанася се директно и се размазва с пръсти."),
    ("haus-color-fuse", "haus", "color-fuse-glassy-blush-balm-stick", "blush", None,
     "Руж-балсам в стик със стъклен финиш. Сочен цвят и сияние в едно."),
    ("merit-flush-balm", "merit", "flush-balm", "blush", None,
     "Кремообразен руж-балсам, който се слива с кожата. Естествена руменина в минималистичен стил."),
    ("tower28-beachplease", "tower28", "beachplease-luminous-tinted-balm-blush", "blush", None,
     "Сияен кремообразен руж за устни и бузи. Нежна формула, подходяща за чувствителна кожа."),
    # --- Бронзанти ---
    ("fenty-sun-stalkr", "fenty", "sun-stalkr-instant-warmth-bronzer-caramel-cutie", "bronzer", None,
     "Кремообразен пудрен бронзант за топъл, сияен загар. Лесно се размазва и изгражда."),
    ("rare-warm-wishes", "rare", "warm-wishes-effortless-bronzer-stick", "bronzer", None,
     "Бронзант в стик за бърз, естествен загар. Нанасяш, размазваш и си готова."),
    ("merit-bronze-balm", "merit", "bronze-balm", "bronzer", None,
     "Кремообразен бронзант-балсам, който стопля лицето с естествен, слънчев цвят."),
    ("milk-bionic-bronzer", "milk", "bionic-bronzer", "bronzer", None,
     "Течен бронзант, който се смесва лесно с фон дьо тен или се носи самостоятелно."),
    # --- Хайлайтъри ---
    ("fenty-killawatt", "fenty", "killawatt-freestyle-highlighter-trophy-wife", "highlighter", None,
     "Хайлайтърът, който направи Fenty известна. От фин блясък до ослепителен ефект с едно прекарване."),
    ("rare-positive-light", "rare", "positive-light-liquid-luminizer-1", "highlighter", None,
     "Течен хайлайтър за мек, „отвътре“ сияен ефект. Нанася се самостоятелно или се смесва с фон дьо тен."),
    ("haus-bio-radiant", "haus", "bio-radiant-gel-powder-highlighter", "highlighter", None,
     "Гел-пудра хайлайтър със стъклен блясък. Лек, без видими частици."),
    ("abh-glow-seeker", "abh", "glow-seeker-highlighter", "highlighter", None,
     "Пудрен хайлайтър с наситен, перлен блясък. Наслоява се от фин до ослепителен ефект."),
    # --- Сенки ---
    ("abh-soft-glam", "abh", "soft-glam-palette", "eyeshadow", None,
     "Една от най-обичаните палитри: 14 топли, неутрални и розови нюанса за ежедневен и вечерен грим."),
    ("natasha-i-need-a-nude", "natasha", "i-need-a-nude-eyeshadow-palette", "eyeshadow", None,
     "Палитра с нюдови нюанси в матов и сатенен финиш. Луксозни, силно пигментирани сенки."),
    ("natasha-biba", "natasha", "biba-eyeshadow-palette", "eyeshadow", None,
     "Култовата палитра Biba: топли кафяви и розови нюанси, вдъхновени от модата на 60-те."),
    ("huda-pretty-grunge", "huda", "pretty-grunge-eyeshadow-palette-hb01058", "eyeshadow", None,
     "Палитра с 18 нюанса между нежни нюдови и смели гръндж тонове. Матови, металически и бляскави сенки."),
    ("tarte-in-bloom", "tarte", "tartelette-in-bloom-amazonian-clay-palette", "eyeshadow", None,
     "Палитра с амазонска глина: 12 матови и бляскави нюанса за естествен и вечерен грим."),
    ("westman-eye-pods", "westman", "eye-pods-eye-shadow-toujours", "eyeshadow", None,
     "Кремообразни сенки в луксозна кутийка. Нанасят се с пръст за мек, „размит“ ефект."),
    # --- Спирали ---
    ("huda-1-coat-wow", "huda", "huda-beauty-1-coat-wow-extra-volumizing-and-lifting-mascara-hb01021", "mascara", None,
     "Спирала, която обемира и повдига миглите само с едно нанасяне. Не се разтича и не прави бучки."),
    ("rare-perfect-strokes", "rare", "perfect-strokes-universal-volumizing-mascara", "mascara", None,
     "Универсална спирала за обем, дължина и извивка. Четката е подходяща за всякакъв тип мигли."),
    ("fenty-hella-thicc", "fenty", "hella-thicc-volumizing-mascara-letz-be-blunt", "mascara", None,
     "Спирала за драматичен обем още от първото нанасяне. Плътно черен цвят."),
    ("milk-kush", "milk", "kush-big-hit-volumizing-mascara", "mascara", None,
     "Обемираща спирала с конопено масло. Плътни, меки мигли без бучки."),
    ("tarte-tubing", "tarte", "tartelette-tubing-mascara", "mascara", None,
     "Спирала с технология „тубинг“: обвива всяка мигла, не се размазва и се маха лесно с топла вода."),
    ("glossier-lash-slick", "glossier", "lash-slick", "mascara", None,
     "Спирала за естествено дълги и разделени мигли. Издържа цял ден без да се рони."),
    # --- Очни линии ---
    ("rare-perfect-strokes-liner", "rare", "perfect-strokes-matte-liquid-liner-black", "liner", None,
     "Матова течна очна линия с гъвкав връх. Лесна за котешка линия, не се размазва."),
    ("abh-dramaline", "abh", "dramaline-longwear-eyeliner", "liner", None,
     "Кремообразен дълготраен молив за очи в смели и класически цветове. Водоустойчив."),
    ("tarte-tubing-liner", "tarte", "tartelette-tubing-liquid-eyeliner", "liner", None,
     "Течна очна линия с прецизен връх, която издържа цял ден. Маха се лесно с топла вода."),
    # --- Вежди ---
    ("abh-brow-wiz", "abh", "brow-wiz", "brows", None,
     "Ултратънък молив за вежди за естествени, косъм по косъм щрихи. С четка в другия край."),
    ("abh-dipbrow", "abh", "dipbrow-pomade", "brows", None,
     "Помада за вежди за плътни, оформени вежди. Водоустойчива и издържа цял ден."),
    ("glossier-boy-brow", "glossier", "boy-brow-arch", "brows", None,
     "Гел за вежди с цвят, който оформя и сгъстява. Естествен, „рошав“ вид за секунди."),
    ("milk-kush-fiber", "milk", "kush-fiber-brow-gel", "brows", None,
     "Гел за вежди с влакна, който сгъстява и оформя. Задържа веждите на място цял ден."),
    # --- Праймери ---
    ("milk-hydro-grip", "milk", "hydro-grip-hydrating-face-primer", "primer", None,
     "Хидратиращ гел-праймер, който „залепва“ грима за кожата. Подходящ за суха и нормална кожа."),
    # --- Фиксиращи спрейове ---
    ("huda-easy-bake-spray", "huda", "easy-bake-setting-spray-with-16-hour-wear-hb01028", "setting", None,
     "Фиксиращ спрей от серията Easy Bake. Задържа грима до 16 часа и намалява блясъка."),
    ("morphe-continuous", "morphe", "continuous-setting-mist", "setting", None,
     "Фин спрей с непрекъсната мъгла, който фиксира и освежава грима."),
]


# Hand-picked photos (indices into the fetched gallery) where the store mixes in
# text-heavy ads or other shades. Reviewed on a contact sheet; products not
# listed keep every photo.
PICK = {
    "fenty-icon-velvet": [0, 2, 3, 4], "merit-signature-lip": [0, 1, 2, 3],
    "huda-lip-contour": [0, 1, 2, 3], "abh-lip-liner": [0, 1, 2],
    "tarte-maracuja-liner": [0, 1, 2], "rare-lip-oil": [0, 1, 2, 4],
    "summer-lip-butter": [0, 1, 2, 3, 4], "haus-phd-lip-glaze": [0, 1, 2],
    "fenty-pro-filtr": [0, 1, 2, 5], "natasha-hy-glam": [0, 1, 2, 4],
    "westman-vital-skin": [0, 1, 2, 3, 4], "rare-brightening-concealer": [0, 1, 2, 4],
    "milk-hydro-grip-concealer": [0, 1, 2, 3], "rare-soft-pinch": [0, 1, 2, 3],
    "patrickta-double-take": [0, 1, 2, 5], "huda-blush-filter": [0, 1, 2, 3, 4],
    "milk-lip-cheek": [0, 1, 2, 3], "haus-color-fuse": [0, 1, 2, 3],
    "fenty-sun-stalkr": [0, 1, 5, 2], "milk-bionic-bronzer": [0, 1, 2, 4],
    "fenty-killawatt": [0, 1, 2, 3, 4], "abh-glow-seeker": [0, 2, 4, 1],
    "tarte-in-bloom": [0, 1, 2, 3, 5], "westman-eye-pods": [0, 1, 2, 3, 4],
    "huda-1-coat-wow": [0, 2, 1, 5], "fenty-hella-thicc": [0, 1, 2, 5],
    "milk-kush": [0, 2, 3, 1], "tarte-tubing": [0, 1, 3, 5],
    "abh-dramaline": [0, 1, 2, 3, 5], "tarte-tubing-liner": [0, 1, 3, 5],
    "milk-hydro-grip": [0, 1, 2, 3, 5], "huda-easy-bake-spray": [0, 1, 2, 4],
    "morphe-continuous": [0, 1, 3, 4],
}

NAMES = {
    "huda-1-coat-wow": "1 Coat Wow! Volumizing & Lifting Mascara",
    "summer-lip-butter": "Lip Butter Balm",
    "natasha-i-need-a-nude": "I Need a Nude Eyeshadow Palette",
    "natasha-nude-lipstick": "I Need a Nude Lipstick",
}

NOT_A_SHADE = re.compile(r"^(full( size)?|multi|default title|mini\b.*|standard)$", re.I)


def tidy_name(s):
    """'BIBA EYESHADOW PALETTE' / 'shape tape pressed powder' -> Title Case."""
    if s.isupper():
        return s.title()
    if s[:1].islower():
        return " ".join(w[:1].upper() + w[1:] for w in s.split())
    return s


def tidy_shade(s):
    if not s:
        return None
    s = re.sub(r"\s*/\s*(full size|mini|standard)$", "", s.strip(), flags=re.I)
    if NOT_A_SHADE.match(s):
        return None
    return s[:1].upper() + s[1:] if s[:1].islower() else s


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def load_feed(base):
    allp = []
    for page in range(1, 8):
        ps = get_json("%s/products.json?limit=250&page=%d" % (base, page))["products"]
        allp += ps
        if len(ps) < 250:
            break
        time.sleep(0.8)
    return {p["handle"]: p for p in allp}


def clean(s):
    s = re.sub(r"[™®©]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def split_shade(title):
    """'Gloss Bomb … — Fenty Glow' -> ('Gloss Bomb …', 'Fenty Glow')"""
    m = re.match(r"^(.*?)\s+[—–-]\s+(.+)$", title)
    return (m.group(1), m.group(2)) if m else (title, None)


def https(src):
    return "https:" + src if src.startswith("//") else src


def is_photo(src):
    return re.search(r"\.(jpe?g|png|webp)(\?|$)", src, re.I) is not None


def choose(p, shade_hint):
    variants = p["variants"]
    imgs = sorted(p["images"], key=lambda i: i["position"])
    linked = [i for i in imgs if i["variant_ids"]]
    if not linked:                       # one product per shade: every photo is that shade
        return variants[0], [https(i["src"]) for i in imgs if is_photo(i["src"])]

    def photos_for(v):
        own = [i for i in imgs if v["id"] in i["variant_ids"]]
        generic = [i for i in imgs if not i["variant_ids"]]
        return [https(i["src"]) for i in own + generic if is_photo(i["src"])]

    pool = [v for v in variants if v.get("available", True)] or variants
    if shade_hint:
        hinted = [v for v in pool if shade_hint.lower() in v["title"].lower()]
        pool = hinted + [v for v in pool if v not in hinted]
    first_img = imgs[0]["id"] if imgs else None
    pool.sort(key=lambda v: (
        not (shade_hint and shade_hint.lower() in v["title"].lower()),
        -len([i for i in imgs if v["id"] in i["variant_ids"]]),
        (v.get("featured_image") or {}).get("id") != first_img,
    ))
    best = pool[0]
    return best, photos_for(best)


def price_eur(p):
    usd = 0.0
    for v in p["variants"]:
        for k in ("price", "compare_at_price"):
            try:
                usd = max(usd, float(v.get(k) or 0))
            except ValueError:
                pass
    return round(usd * USD_TO_EUR) if usd else None


def alive(url):
    try:
        req = urllib.request.Request(url + ("&" if "?" in url else "?") + "width=120",
                                     headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status == 200 and r.headers.get("Content-Type", "").startswith("image")
    except Exception:
        return False


def build(entry, feeds):
    pid, store, handle, cat, hint, desc = entry
    brand, base = STORES[store]
    p = feeds[store].get(handle)
    if not p:
        return None, "handle not found"
    variant, photos = choose(p, hint)
    photos = list(dict.fromkeys(photos))                       # de-dupe, keep order
    with ThreadPoolExecutor(6) as ex:
        ok = list(ex.map(alive, photos[:MAX_PHOTOS + 3]))
    photos = [u for u, good in zip(photos, ok) if good][:MAX_PHOTOS]
    if pid in PICK:
        photos = [photos[i] for i in PICK[pid] if i < len(photos)]
    if len(photos) < MIN_PHOTOS:
        return None, "only %d photos" % len(photos)

    name, shade_from_title = split_shade(clean(p["title"]))
    name = NAMES.get(pid) or tidy_name(name)
    shade = shade_from_title or variant["title"]
    if shade and "/" in shade and len(shade) > 40:
        shade = shade.split("/")[0].strip()
    shade = tidy_shade(clean(shade)) if shade else None
    term = "%s %s" % (brand, name)
    rec = {
        "id": pid,
        "name": name,
        "brand": brand,
        "category": cat,
        "shade": shade,
        "price": price_eur(p),
        "description": desc,
        "image": photos[0],
        "gallery": photos,
        "buy": {
            "official": base + "/products/" + handle,
            "notino": "https://www.notino.bg/search.asp?exps=" + urllib.parse.quote(term),
            "emag": "https://www.emag.bg/search/" + urllib.parse.quote(term),
        },
    }
    return rec, "%d photos · %s · %s%s" % (len(photos), brand, name, (" · " + rec["shade"]) if rec["shade"] else "")


def main():
    feeds = {}
    for key in sorted({e[1] for e in CATALOG}):
        feeds[key] = load_feed(STORES[key][1])
        print("feed %-10s %4d products" % (key, len(feeds[key])))
        time.sleep(0.8)

    ok, missed = [], 0
    for entry in CATALOG:
        rec, msg = build(entry, feeds)
        print(("  ok   " if rec else "  MISS ") + entry[0].ljust(30) + msg)
        if rec:
            ok.append(rec)
        else:
            missed += 1
    print("\n%d products, %d missed" % (len(ok), missed))

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    pretty = json.dumps(ok, ensure_ascii=False, indent=2)
    with open(os.path.join(ROOT, "data", "products.json"), "w", encoding="utf-8") as f:
        f.write(pretty + "\n")
    with open(os.path.join(ROOT, "js", "data.js"), "w", encoding="utf-8") as f:
        f.write("/* Generated by tools/fetch_products.py — photos from the brands' official stores, "
                "prices ≈ EUR. */\nwindow.PRODUCTS = " + pretty + ";\n")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
