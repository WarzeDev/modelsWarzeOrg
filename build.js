#!/usr/bin/env bun
/**
 * build.js — generates a fully static index.html for the Blockbench model gallery.
 *
 *   bun run build.js
 *
 * - reads ./models.json
 * - verifies ./webp/<slug>.webp and ./apng/<slug>.png exist
 * - writes ./index.html with every card, meta tag and inline CSS/JS baked in
 *   (no client-side JSON fetching, no extra requests, great for SEO + load time)
 *
 * Interaction:
 *   - WebP thumbnail always visible on each card
 *   - clicking a card opens the APNG in a fullscreen lightbox
 *   - clicking anywhere (or pressing Escape) closes it
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = import.meta.dir;

/* ------------------------------------------------------------------ *
 * CONFIG — tweak these
 * ------------------------------------------------------------------ */
const SITE_URL = "https://models.warze.org"; // canonical URL of the gallery
const HOME_URL = "https://warze.org"; // "back to homepage" target
const SITE_NAME = "WarzeDev's Blockbench Models";
const AUTHOR = "WarzeDev";
const EAGER_COUNT = 6; // first N thumbnails load eagerly (rest are lazy)

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

const anchorOf = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

/* ------------------------------------------------------------------ *
 * Load + normalise models.json
 * ------------------------------------------------------------------ */
const rawFile = JSON.parse(readFileSync(join(ROOT, "models.json"), "utf8"));
const rawModels = Array.isArray(rawFile) ? rawFile : rawFile.models ?? [];

const models = rawModels.map((m, i) => {
  const name = m.name ?? m.title ?? `Model ${i + 1}`;
  const slug = m.slug || slugify(name);
  const label = m.label ? String(m.label) : null;
  return {
    name,
    label,
    slug,
    id: m.id || anchorOf(name),
    webp: `webp/${slug}.webp`,
    apng: `apng/${slug}.png`,
  };
});

if (!models.length) {
  console.error("✖ models.json contains no models.");
  process.exit(1);
}

/* verify assets */
const missing = [];
for (const m of models) {
  for (const p of [m.webp, m.apng]) {
    if (!existsSync(join(ROOT, p))) missing.push(p);
  }
}
if (missing.length) {
  console.warn(
    `⚠ ${missing.length} file(s) referenced by models.json were not found:\n` +
      missing.map((p) => "   " + p).join("\n")
  );
}

/* ------------------------------------------------------------------ *
 * SEO copy
 * ------------------------------------------------------------------ */
const description =
  `Browse ${models.length} custom Minecraft Blockbench models by ${AUTHOR} — ` +
  `katanas, totems, hats, staves and more. Click a model to view its animation.`;

const keywords = [
  "Blockbench",
  "Minecraft models",
  "Minecraft item models",
  "custom Minecraft models",
  "model previews",
  "animated models",
  "APNG",
  "Minecraft resource pack",
  AUTHOR,
].join(", ");

/* ------------------------------------------------------------------ *
 * Card markup
 * ------------------------------------------------------------------ */
function renderCard(m, i) {
  const eager = i < EAGER_COUNT;
  const badge = m.label
    ? `<span class="badge ${esc(m.label.toLowerCase())}">${esc(m.label)}</span>`
    : "";
  const aria = `${m.name}${m.label ? ", " + m.label : ""}. Click to view the animation.`;

  return `        <button type="button" class="model" id="${esc(m.id)}" data-apng="${esc(
    m.apng
  )}" data-name="${esc(m.name)}" aria-label="${esc(aria)}">
          <span class="thumb">
            <img class="still" src="${m.webp}" alt="${esc(
    m.name
  )} — Minecraft Blockbench model preview"${
    eager ? ' fetchpriority="high"' : ' loading="lazy"'
  } decoding="async">
            ${badge}
            <span class="anim-chip" aria-hidden="true">&#9654; anim</span>
          </span>
          <span class="meta"><span class="name">${esc(m.name)}</span></span>
        </button>`;
}

const cards = models.map(renderCard).join("\n");

/* ------------------------------------------------------------------ *
 * <head>
 * ------------------------------------------------------------------ */
const preloads = models
  .slice(0, EAGER_COUNT)
  .map((m) => `<link rel="preload" as="image" href="${m.webp}" fetchpriority="high">`)
  .join("\n");

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: SITE_NAME,
  description,
  url: `${SITE_URL}/`,
  inLanguage: "en",
  isPartOf: { "@type": "WebSite", name: "Warze", url: HOME_URL },
  about: { "@type": "Thing", name: "Minecraft Blockbench models" },
  author: { "@type": "Person", name: AUTHOR, url: HOME_URL },
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: models.length,
    itemListElement: models.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.name,
      url: `${SITE_URL}/#${m.id}`,
      image: `${SITE_URL}/${m.webp}`,
    })),
  },
};

const head = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(SITE_NAME)} — Minecraft Blockbench Model Previews</title>
<meta name="description" content="${esc(description)}">
<meta name="keywords" content="${esc(keywords)}">
<meta name="author" content="${esc(AUTHOR)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${SITE_URL}/">
<meta name="theme-color" content="#0a0002">
<meta name="color-scheme" content="dark">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(SITE_NAME)} — Minecraft Blockbench Model Previews">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:image" content="${SITE_URL}/avatar.png">
<meta property="og:image:alt" content="${esc(AUTHOR)} avatar">
<meta property="og:locale" content="en_US">

<!-- Twitter -->
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(SITE_NAME)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE_URL}/avatar.png">

<!-- Icons -->
<link rel="icon" href="avatar.png" type="image/png">
<link rel="apple-touch-icon" href="avatar.png">

<!-- Resource hints -->
<link rel="preload" as="image" href="avatar.png" fetchpriority="high">
${preloads}

<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2).replace(
  /</g,
  "\\u003c"
)}</script>`;

/* ------------------------------------------------------------------ *
 * CSS — performance-tuned (no background-attachment:fixed, no backdrop-filter)
 * ------------------------------------------------------------------ */
const CSS = `
@font-face{
  font-family:"Minecraft";
  src:url("font.otf") format("opentype");
  font-weight:400;
  font-style:normal;
  font-display:swap;
}

*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#040004;
  --line:#2a1014;
  --red:#ff2d2d;
  --red-soft:#ff6b6b;
  --red-glow:rgba(255,45,45,.55);
  --amber:#ffb020;
  --text:#f4e8e8;
  --muted:#9b8285;
  --font:"Minecraft",ui-monospace,"SFMono-Regular","Cascadia Mono","Roboto Mono",Menlo,Consolas,"Liberation Mono",monospace;
}
html{color-scheme:dark;-webkit-text-size-adjust:100%;scroll-behavior:smooth;background:var(--bg)}
body{
  margin:0;min-height:100vh;
  font-family:var(--font);color:var(--text);
  background:var(--bg);
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}

/* ---------- fixed, GPU-composited background layers ---------- */
.bg,.stars,.scanlines{position:fixed;inset:0;pointer-events:none}
.bg{
  z-index:-3;
  background-image:
    radial-gradient(1100px 520px at 50% -12%,rgba(150,10,25,.5),transparent 70%),
    radial-gradient(900px 700px at 108% 108%,rgba(90,6,18,.42),transparent 62%),
    radial-gradient(760px 520px at -8% 32%,rgba(70,0,26,.35),transparent 65%);
}
.stars{
  z-index:-2;
  background-image:
    radial-gradient(1px 1px at 15% 25%,#fff,transparent),
    radial-gradient(1px 1px at 65% 15%,#ffd2d2,transparent),
    radial-gradient(1.5px 1.5px at 42% 72%,#fff,transparent),
    radial-gradient(1px 1px at 88% 58%,#ffb0b0,transparent),
    radial-gradient(1px 1px at 8% 88%,#fff,transparent),
    radial-gradient(1.5px 1.5px at 74% 92%,#fff,transparent),
    radial-gradient(1px 1px at 30% 5%,#fff,transparent),
    radial-gradient(1px 1px at 55% 45%,#ffc9c9,transparent);
  background-size:300px 300px;
  opacity:.4;
}
.scanlines{
  z-index:9999;
  background:repeating-linear-gradient(to bottom,rgba(0,0,0,.22) 0 1px,transparent 1px 3px);
  opacity:.55;
}

.wrap{position:relative;z-index:1;max-width:1400px;margin:0 auto;padding:26px 20px 90px}

/* ---------- header ---------- */
.site-header{
  display:flex;align-items:center;gap:16px;flex-wrap:wrap;
  padding:16px 18px;margin:0 0 24px;border-radius:12px;
  border:1px solid var(--line);
  background:linear-gradient(180deg,rgba(34,9,13,.85),rgba(8,2,4,.85));
  box-shadow:inset 0 1px 0 rgba(255,80,80,.08),0 0 44px -18px var(--red-glow);
}
.avatar{
  width:56px;height:56px;flex:0 0 auto;border-radius:10px;
  object-fit:cover;background:#0a0203;
  border:1px solid #3a1116;
  image-rendering:pixelated;
  box-shadow:0 0 20px -4px var(--red-glow);
}
.brand-text{min-width:0}
h1{
  margin:0;font-size:clamp(17px,2.5vw,27px);line-height:1.15;
  letter-spacing:.06em;color:#fff;
  text-shadow:0 0 12px rgba(255,45,45,.55),0 0 34px rgba(255,0,0,.25);
}
.home-btn{
  margin-left:auto;display:inline-flex;align-items:center;gap:8px;
  padding:10px 16px;border-radius:8px;text-decoration:none;white-space:nowrap;
  font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  color:#ffd9d9;border:1px solid rgba(255,45,45,.45);
  background:linear-gradient(180deg,rgba(255,45,45,.14),rgba(255,45,45,.04));
  transition:color .18s,border-color .18s,background .18s,box-shadow .18s,transform .18s;
}
.home-btn:hover,.home-btn:focus-visible{
  color:#fff;border-color:var(--red);transform:translateY(-1px);
  background:linear-gradient(180deg,rgba(255,45,45,.3),rgba(255,45,45,.1));
  box-shadow:0 0 26px -4px var(--red-glow);outline:none;
}

/* ---------- toolbar ---------- */
.toolbar{
  display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  margin:0 0 18px;padding:0 4px;
}
.count{
  margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--red-soft);
}

/* ---------- badges ---------- */
.badge{
  display:inline-block;padding:3px 7px;border-radius:3px;border:1px solid;
  font-family:var(--font);font-size:10px;font-weight:700;line-height:1.4;
  letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;
}
.badge.reskin{color:#ff7b7b;border-color:rgba(255,45,45,.55);background:rgba(255,45,45,.14)}
.badge.edit{color:#ffcb5c;border-color:rgba(255,176,32,.55);background:rgba(255,176,32,.14)}
.model .badge{position:absolute;top:8px;right:8px;z-index:2}

/* ---------- grid ---------- */
.models{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}

/* ---------- card ---------- */
.model{
  position:relative;display:block;width:100%;margin:0;padding:0;
  font:inherit;color:inherit;text-align:left;cursor:pointer;appearance:none;
  background:linear-gradient(180deg,#120709,#0a0406);
  border:1px solid var(--line);border-radius:10px;overflow:hidden;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;
  transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;
}
.model:hover,.model:focus-visible{
  border-color:rgba(255,45,45,.7);
  box-shadow:0 0 0 1px rgba(255,45,45,.18),0 12px 34px -16px var(--red-glow);
  transform:translateY(-3px);outline:none;
}
.model:focus-visible{outline:2px solid var(--red);outline-offset:3px}

.thumb{
  position:relative;display:block;aspect-ratio:1/1;overflow:hidden;
  background:
    radial-gradient(circle at 50% 52%,#1d070a 0%,#0a0305 72%),
    repeating-linear-gradient(0deg,rgba(255,45,45,.05) 0 1px,transparent 1px 22px),
    repeating-linear-gradient(90deg,rgba(255,45,45,.05) 0 1px,transparent 1px 22px);
}
.thumb::after{
  content:"";position:absolute;inset:6px;border-radius:6px;
  border:1px solid rgba(255,45,45,.12);pointer-events:none;
}
.thumb img{
  position:absolute;inset:0;display:block;width:100%;height:100%;
  object-fit:contain;
}

.anim-chip{
  position:absolute;bottom:8px;right:9px;z-index:2;
  font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  color:rgba(255,150,150,.5);pointer-events:none;
  transition:color .18s,text-shadow .18s;
}
.model:hover .anim-chip,.model:focus-visible .anim-chip{
  color:var(--red);text-shadow:0 0 10px var(--red-glow);
}

.meta{
  display:block;padding:10px 12px 12px;
  border-top:1px solid var(--line);
  background:linear-gradient(180deg,rgba(255,45,45,.04),transparent);
}
.name{
  display:block;font-size:12.5px;letter-spacing:.05em;color:#f0dede;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}

/* ---------- lightbox ---------- */
.viewer{
  position:fixed;inset:0;
  width:auto;height:auto;max-width:none;max-height:none;
  border:none;padding:0;margin:0;
  background:transparent;overflow:hidden;
  cursor:zoom-out;
}
.viewer::backdrop{background:rgba(0,0,0,.85)}
.viewer img{
  position:absolute;top:50%;left:50%;
  transform:translate(-50%,-50%);
  max-width:92vw;max-height:92vh;
  image-rendering:pixelated;
  display:block;
}
.viewer-close{
  position:absolute;top:16px;right:16px;z-index:2;
  width:40px;height:40px;padding:0;
  display:flex;align-items:center;justify-content:center;
  border:1px solid rgba(255,45,45,.5);border-radius:8px;
  background:rgba(20,4,6,.7);color:#ffd9d9;
  font:inherit;font-size:22px;line-height:1;cursor:pointer;
  transition:color .18s,border-color .18s,background .18s;
}
.viewer-close:hover,.viewer-close:focus-visible{
  color:#fff;border-color:var(--red);background:rgba(255,45,45,.25);outline:none;
}

/* ---------- footer ---------- */
.site-footer{
  display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between;
  margin-top:48px;padding-top:20px;border-top:1px solid var(--line);
  font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);
}
.site-footer p{margin:0}
.site-footer a{color:var(--red-soft);text-decoration:none;transition:color .18s,text-shadow .18s}
.site-footer a:hover{color:#fff;text-shadow:0 0 12px var(--red-glow)}

/* ---------- responsive ---------- */
@media (max-width:560px){
  .wrap{padding:18px 14px 70px}
  h1{font-size:16px}
  .avatar{width:44px;height:44px}
  .home-btn{margin-left:0;width:100%;justify-content:center}
  .models{grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px}
}
@media (prefers-reduced-motion:reduce){
  .model{transition:none}
  html{scroll-behavior:auto}
}
`;

/* ------------------------------------------------------------------ *
 * Client JS — lightbox only (no hover animation)
 * ------------------------------------------------------------------ */
const JS = `
(function () {
  var dialog = document.getElementById('viewer');
  var img = document.getElementById('viewer-img');
  if (!dialog || !img) return;

  var cards = document.querySelectorAll('.model');
  Array.prototype.forEach.call(cards, function (card) {
    card.addEventListener('click', function () {
      var src = card.getAttribute('data-apng');
      if (!src) return;
      img.removeAttribute('src');
      img.alt = card.getAttribute('data-name') || 'Model preview';
      img.src = src;
      dialog.showModal();
    });
  });

  dialog.addEventListener('click', function () {
    dialog.close();
  });

  dialog.addEventListener('close', function () {
    img.removeAttribute('src');
  });
})();
`;

/* ------------------------------------------------------------------ *
 * Assemble + write
 * ------------------------------------------------------------------ */
const html = `<!doctype html>
<html lang="en">
<head>
${head}
<style>${CSS}</style>
</head>
<body>
<div class="bg" aria-hidden="true"></div>
<div class="stars" aria-hidden="true"></div>

<div class="wrap">

  <header class="site-header">
    <img class="avatar" src="avatar.png" alt="${esc(AUTHOR)} avatar" width="56" height="56" fetchpriority="high">
    <div class="brand-text">
      <h1>${esc(SITE_NAME)}</h1>
    </div>
    <a class="home-btn" href="${HOME_URL}" rel="home">&#8592; Go back</a>
  </header>

  <div class="toolbar">
    <p class="count">${models.length} models</p>
  </div>

  <main class="models">
${cards}
  </main>

  <footer class="site-footer">
    <p>Modeled in <a href="https://www.blockbench.net/" target="_blank" rel="noopener">Blockbench</a> by ${esc(AUTHOR)}</p>
    <p><a href="${HOME_URL}">warze.org</a></p>
  </footer>

</div>

<dialog id="viewer" class="viewer" aria-label="Model preview">
  <button type="button" class="viewer-close" aria-label="Close preview">&#215;</button>
  <img id="viewer-img" alt="">
</dialog>

<div class="scanlines" aria-hidden="true"></div>
<script>${JS}</script>
</body>
</html>
`;

writeFileSync(join(ROOT, "index.html"), html, "utf8");

console.log(
  `✔ index.html written — ${models.length} models, ${(html.length / 1024).toFixed(1)} kB`
);
if (missing.length) console.log(`⚠ ${missing.length} missing asset(s) — see warnings above.`);