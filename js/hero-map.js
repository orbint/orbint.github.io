/* ORBINT — the hero map.

   The hero field has always stood in for an equirectangular projection of
   the globe; script.js reads the pointer out as a latitude and a longitude.
   This draws that projection: the land as a field of small square dots in a
   grey lighter than the rules, under the type and under the constellation.

   On load a scan crosses the map from west to east and lays the dots down
   behind it, and once it has passed, a few emitters light up on the sea in
   the accent. The map then holds still: it is a drawing, not a screensaver.

   The projection is published on the field as `field.heroMap.locate`, so the
   cursor readout and the map can never disagree about where a point is.

   Progressive enhancement: without modules or a 2D canvas the hero is the
   type on the paper, as before. */

import { LAND } from './land-mask.js';

/* What the map shows, top to bottom. The high Arctic and Antarctica are left
   off: they are a third of the projection and none of the story. */
const NORTH = 84;
const SOUTH = -60;

/* A degree may be drawn up to this much taller than it is wide. Past that the
   map keeps its proportions and is cropped east and west instead, centred
   on Europe — which is what a phone held upright gets. */
const STRETCH = 1.4;
const CENTRE = 15;

/* The dot grid, in CSS pixels. */
const PITCH = { min: 7, max: 11, per: 150 };   /* spacing: the field's width over `per` */
const DOT = 2;

/* The scan. */
const SCAN_MS = 1500;
const TRAIL = 56;          /* px behind the scan line still drawn in the accent */

/* Emitters, on the sea. Those that would land under the type or off the
   field are not shown, so the list carries more than any one layout uses. */
const EMITTERS = [
  [57.6, 19.4],     /* Baltic Sea, east of Gotland */
  [39.5, 134.5],    /* Sea of Japan */
  [3.0, 3.5],       /* Gulf of Guinea */
  [14.5, -74.0],    /* Caribbean Sea */
  [-38.0, -56.0],   /* South Atlantic, off the River Plate */
];
const CLEARANCE = 20;      /* px an emitter keeps from the type */

/* ── the mask ──────────────────────────────────────────────────────────── */

const bits = Uint8Array.from(atob(LAND), (c) => c.charCodeAt(0));

function isLand(lat, lon) {
  const row = Math.floor(90 - lat);
  if (row < 0 || row >= 180) return false;
  const col = ((Math.floor(lon + 180) % 360) + 360) % 360;
  const i = row * 360 + col;
  return (bits[i >> 3] & (0x80 >> (i & 7))) !== 0;
}

/* ── colour ────────────────────────────────────────────────────────────── */

function token(styles, name, fallback) {
  return styles.getPropertyValue(name).trim() || fallback;
}

/* ── timing ────────────────────────────────────────────────────────────── */

/* While the boot screen holds the page, the scan waits, and starts as it
   lifts — on its timer or on a click, whichever comes first. */
function afterIntro(fn) {
  const root = document.documentElement;
  const done = () => !root.classList.contains('has-intro') || root.classList.contains('intro-lifted');
  if (done()) return fn();
  const observer = new MutationObserver(() => {
    if (!done()) return;
    observer.disconnect();
    fn();
  });
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
}

/* ── the map ───────────────────────────────────────────────────────────── */

function start(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const field = canvas.parentElement;
  const styles = getComputedStyle(document.documentElement);
  const grey = token(styles, '--rule', '#C4C4C4');
  const accent = token(styles, '--accent', '#F2641C');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width = 0, height = 0, dpr = 1;
  let ky = 1, kx = 1, lon0 = 0;
  let dots = [];
  let sweep = reduceMotion ? Infinity : -1;    /* the scan line's x; -1 before it starts */

  /* The projection: a point in the field, in CSS pixels from its top left,
     to a place on Earth, and back. */
  function locate(x, y) {
    return { lat: NORTH - y / ky, lon: lon0 + (x - width / 2) / kx };
  }
  function place(lat, lon) {
    return [width / 2 + (lon - lon0) * kx, (NORTH - lat) * ky];
  }
  field.heroMap = { locate };

  function layout() {
    const box = canvas.getBoundingClientRect();
    width = box.width; height = box.height;
    if (!width || !height) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ky = height / (NORTH - SOUTH);
    kx = Math.max(width / 360, ky / STRETCH);
    const half = width / (2 * kx);
    lon0 = Math.min(Math.max(CENTRE, -180 + half), 180 - half);

    /* The grid is centred on the field, so its margins match left and right. */
    const pitch = Math.min(PITCH.max, Math.max(PITCH.min, width / PITCH.per));
    const x0 = (width % pitch) / 2 + pitch / 2;
    const y0 = (height % pitch) / 2 + pitch / 2;
    dots = [];
    for (let y = y0; y < height; y += pitch) {
      for (let x = x0; x < width; x += pitch) {
        const { lat, lon } = locate(x, y);
        if (isLand(lat, lon)) dots.push(x, y);
      }
    }
    return true;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const settled = new Path2D();
    const fresh = new Path2D();
    for (let i = 0; i < dots.length; i += 2) {
      const x = dots[i], y = dots[i + 1];
      if (x > sweep) continue;
      (sweep - x < TRAIL ? fresh : settled).rect(x - DOT / 2, y - DOT / 2, DOT, DOT);
    }
    ctx.fillStyle = grey;
    ctx.globalAlpha = 0.85;
    ctx.fill(settled);
    if (sweep < width + TRAIL) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 1;
      ctx.fill(fresh);
      ctx.fillRect(Math.round(sweep), 0, 1, height);
    }
    ctx.globalAlpha = 1;
  }

  /* ── emitters ────────────────────────────────────────────────────────── */

  const layer = document.createElement('div');
  layer.className = 'hero-pings';
  layer.setAttribute('aria-hidden', 'true');
  const pings = EMITTERS.map(([lat, lon], i) => {
    const ping = document.createElement('span');
    ping.className = 'hero-ping';
    ping.style.setProperty('--i', i);
    layer.appendChild(ping);
    return { ping, lat, lon };
  });
  canvas.after(layer);

  const type = ['.hero-headline', '.hero-lede', '.hero-actions', '.hero-colophon']
    .map((s) => field.querySelector(s)).filter(Boolean);

  function pin() {
    const origin = field.getBoundingClientRect();
    const keepOut = type.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - origin.left - CLEARANCE, right: r.right - origin.left + CLEARANCE,
        top: r.top - origin.top - CLEARANCE, bottom: r.bottom - origin.top + CLEARANCE,
      };
    });
    let shown = 0;
    for (const { ping, lat, lon } of pings) {
      const [x, y] = place(lat, lon);
      const clear = x > CLEARANCE && x < width - CLEARANCE && y > CLEARANCE && y < height - CLEARANCE &&
        !keepOut.some((r) => x > r.left && x < r.right && y > r.top && y < r.bottom);
      ping.hidden = !clear;
      if (!clear) continue;
      ping.style.left = `${x}px`;
      ping.style.top = `${y}px`;
      ping.style.setProperty('--n', shown++);
    }
  }

  /* ── run ─────────────────────────────────────────────────────────────── */

  function refresh() {
    if (!layout()) return;
    draw();
    pin();
  }

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(refresh);
    observer.observe(canvas);
    type.forEach((el) => observer.observe(el));
  } else {
    window.addEventListener('resize', refresh);
  }
  refresh();
  canvas.classList.add('is-ready');

  if (reduceMotion) { field.classList.add('is-scanned'); return; }

  function scan(begin) {
    function frame(now) {
      const t = Math.min(1, (now - begin) / SCAN_MS);
      /* Eased in and out, so the line leaves and arrives rather than ticks. */
      const e = 0.5 - Math.cos(Math.PI * t) / 2;
      sweep = e * (width + TRAIL);
      draw();
      if (t < 1) requestAnimationFrame(frame);
      else { sweep = Infinity; draw(); field.classList.add('is-scanned'); }
    }
    requestAnimationFrame(frame);
  }
  afterIntro(() => requestAnimationFrame(scan));
}

/* ── entry ─────────────────────────────────────────────────────────────── */

const canvas = document.querySelector('.hero-map');
if (canvas) start(canvas);
