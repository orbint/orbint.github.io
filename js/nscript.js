
// ── USE CASE CANVAS animated waterfall / emitter map ──
(function() {
  const canvas = document.getElementById('uc-canvas');
  if (!canvas) return;
  let W, H, rows = [], frame = 0;
  const COLORS = ['#2A2724','#3A2E28','#5C3A1E','#8B4513','#C45A1A','#F2641C','#FFD700'];

  function resize() {
    W = canvas.width = canvas.offsetWidth || 400;
    H = canvas.height = canvas.offsetHeight || 300;
    rows = [];
  }
  resize();

  // Signal emitters (freq bands)
  const emitters = [
    { freqFrac: 0.3, width: 0.04, power: 0.9, active: true },
    { freqFrac: 0.55, width: 0.02, power: 0.6, active: true },
    { freqFrac: 0.72, width: 0.06, power: 0.4, active: true },
  ];

  function makeRow() {
    const row = new Float32Array(Math.floor(W));
    // Base noise
    for (let i = 0; i < row.length; i++) row[i] = Math.random() * 0.08;
    // Emitter signals
    emitters.forEach(e => {
      if (!e.active) return;
      const cx = Math.floor(e.freqFrac * W);
      const hw = Math.floor(e.width * W / 2);
      for (let i = cx - hw * 3; i <= cx + hw * 3; i++) {
        if (i < 0 || i >= row.length) continue;
        const d = Math.abs(i - cx) / hw;
        row[i] += e.power * Math.exp(-d * d * 0.8) * (0.85 + Math.random() * 0.15);
      }
    });
    return row;
  }

  const MAX_ROWS = 120;

  function draw() {
    frame++;
    if (frame % 3 === 0) {
      rows.unshift(makeRow());
      if (rows.length > MAX_ROWS) rows.pop();
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const rowH = H / MAX_ROWS;
    rows.forEach((row, ri) => {
      for (let xi = 0; xi < row.length; xi++) {
        const v = Math.min(1, row[xi]);
        const ci = Math.floor(v * (COLORS.length - 1));
        const cf = v * (COLORS.length - 1) - ci;
        // Simple color interp using CSS parse
        ctx.fillStyle = COLORS[Math.min(ci, COLORS.length - 1)];
        ctx.fillRect(xi, ri * rowH, 1, rowH + 1);
      }
    });

    // Frequency axis labels
    ctx.font = '9px "IBM Plex Sans", monospace';
    ctx.fillStyle = 'rgba(158,150,144,0.7)';
    ['437.0', '437.5', '438.0'].forEach((label, i) => {
      ctx.fillText(label, 10 + i * (W / 3) - 14, H - 6);
    });

    // Highlight boxes on emitters
    emitters.forEach(e => {
      const ex = e.freqFrac * W;
      const ew = e.width * W * 3;
      ctx.strokeStyle = `rgba(242,100,28,0.35)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(ex - ew / 2, 0, ew, H - 16);
    });

    requestAnimationFrame(draw);
  }
  draw();
})();

// ── WATERFALL MINI (product section) ──
(function() {
  const canvas = document.getElementById('waterfall-mini');
  if (!canvas) return;
  let W = 0, H = 0, rows = [], frame = 0;
  const COLORS = ['#121110','#1C1A18','#3A2E28','#8B4513','#F2641C','#FFD700'];

  function resize() {
    const parent = canvas.parentElement;
    const w = parent.offsetWidth;
    const h = parent.offsetHeight;
    if (w < 4 || h < 4) return; // not laid out yet
    if (w === W && h === H) return;
    W = canvas.width = w;
    H = canvas.height = h;
    rows = []; // reset on resize
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas.parentElement);
  // Also try after a short delay in case layout isn't settled
  setTimeout(resize, 100);
  resize();

  function makeRow() {
    const row = new Float32Array(Math.floor(W));
    for (let i = 0; i < row.length; i++) row[i] = Math.random() * 0.05;
    const cx = Math.floor(W * 0.45);
    for (let i = cx - 20; i <= cx + 20; i++) {
      if (i < 0 || i >= row.length) continue;
      const d = Math.abs(i - cx) / 12;
      row[i] += 0.85 * Math.exp(-d * d) * (0.9 + Math.random() * 0.1);
    }
    return row;
  }

  const MAX = 60;

  function draw() {
    requestAnimationFrame(draw);
    if (W < 4 || H < 4) return; // not ready yet
    frame++;
    if (frame % 2 === 0) {
      rows.unshift(makeRow());
      if (rows.length > MAX) rows.pop();
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const rh = H / MAX;
    rows.forEach((row, ri) => {
      for (let xi = 0; xi < row.length; xi++) {
        const v = Math.min(1, row[xi]);
        const ci = Math.floor(v * (COLORS.length - 1));
        ctx.fillStyle = COLORS[Math.min(ci, COLORS.length - 1)];
        ctx.fillRect(xi, ri * rh, 1, rh + 1);
      }
    });

    ctx.font = '8px IBM Plex Sans, monospace';
    ctx.fillStyle = 'rgba(158,150,144,0.6)';
    ctx.fillText('437.525 MHz  LIVE', 8, H - 5);
  }
  draw();
})();

// ── SCROLL FADE-IN ──
(function() {
  const els = document.querySelectorAll('.fade-up:not(.visible)');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), 0);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
})();

// ── USE CASE TABS ──
(function() {
  const items = document.querySelectorAll('.usecase-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
})();

// ── FORM SUBMIT ──
function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  const success = document.getElementById('form-success');
  btn.textContent = 'Sending…';
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';
  setTimeout(() => {
    btn.style.display = 'none';
    success.style.display = 'block';
  }, 1200);
}

// ── LIVE metric ticker ──
(function() {
  function tick() {
    const t = document.getElementById('metric-tracking');
    const a = document.getElementById('metric-acquiring');
    if (t) t.textContent = (2 + Math.floor(Math.random() * 3));
    if (a) a.textContent = Math.floor(Math.random() * 2);
  }
  setInterval(tick, 3000);
})();

// ── CSS pulse animation ──
const style = document.createElement('style');
style.textContent = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`;
document.head.appendChild(style);

// ── HAMBURGER MENU ──
(function() {
  const btn = document.getElementById('hamburger');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;

  function toggleMenu(open) {
    btn.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  btn.addEventListener('click', () => toggleMenu(!menu.classList.contains('open')));

  // Close on link click
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => toggleMenu(false));
  });

  // Close on resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) toggleMenu(false);
  });
})();

// ── HERO HEADLINE AUTOSCALE ────────────────────────────────────────────────────
(function() {
  function fitHeroHeadline() {
    const el = document.querySelector('.hero-headline');
    const hero = document.querySelector('.hero');
    if (!el || !hero) return;

    const targetH = hero.offsetHeight / 4;
    let lo = 10, hi = 400;

    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = mid + 'px';
      if (el.offsetHeight <= targetH) lo = mid;
      else hi = mid;
    }
    el.style.fontSize = lo + 'px';
  }

  fitHeroHeadline();
  window.addEventListener('resize', fitHeroHeadline);
})();

// ── NAVBAR SCROLL & SCROLL SPY ──
(function() {
  const nav = document.getElementById('main-nav');
  const navLinks = document.querySelectorAll('.nav-links a');
  const mobileLinks = document.querySelectorAll('.mobile-menu a');
  const sections = Array.from(navLinks).map(link => {
    const id = link.getAttribute('href').substring(1);
    return document.getElementById(id);
  }).filter(s => s);

  if (!nav) return;

  function updateActiveLink() {
    const scrollPos = window.scrollY + 100; // Offset for nav height

    // Update nav background
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }

    // Scroll spy logic: find the last section that started above the current scroll position
    let currentSectionId = '';
    sections.forEach(section => {
      if (scrollPos >= section.offsetTop) {
        currentSectionId = section.getAttribute('id');
      }
    });

    // Special case for bottom of page
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 20) {
      currentSectionId = sections[sections.length - 1].getAttribute('id');
    }

    if (currentSectionId) {
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${currentSectionId}`);
      });
      mobileLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${currentSectionId}`);
      });
    }
  }

  window.addEventListener('scroll', updateActiveLink);
  // Initial check
  updateActiveLink();
})();