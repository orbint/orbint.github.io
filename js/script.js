/* ORBINT — site behaviour.
   Everything here is progressive enhancement: the page is complete without it. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── REVEAL ──────────────────────────────────────────────────────────────
     `html.js` (set inline in <head>) is what hides .reveal elements, so a
     failed observer can never leave content invisible. The timeout below is a
     second net for hidden tabs and headless renderers, where transitions and
     IntersectionObserver callbacks can be deferred indefinitely. */
  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.reveal, .reveal-rule'));
    if (!els.length) return;

    function show(el) { el.classList.add('is-in'); }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(show);
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    els.forEach(function (el) { obs.observe(el); });

    // Stagger siblings that opt in, so a list arrives as a list.
    document.querySelectorAll('[data-stagger]').forEach(function (group) {
      var step = parseInt(group.getAttribute('data-stagger'), 10) || 70;
      Array.prototype.slice.call(group.children).forEach(function (child, i) {
        child.style.setProperty('--reveal-delay', (i * step) + 'ms');
      });
    });

    setTimeout(function () { els.forEach(show); }, 2500);
  }

  /* ── MOBILE MENU ─────────────────────────────────────────────────────── */
  function initMenu() {
    var btn = document.getElementById('hamburger');
    var menu = document.getElementById('mobile-menu');
    if (!btn || !menu) return;

    function setOpen(open) {
      btn.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      menu.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
    }

    setOpen(false);

    btn.addEventListener('click', function () {
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });

    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        btn.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) setOpen(false);
    });
  }

  /* ── SCROLL SPY ──────────────────────────────────────────────────────── */
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var byId = {};
    var sections = [];
    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (!section) return;
      byId[id] = link;
      sections.push(section);
    });
    if (!sections.length) return;

    var visible = new Set();

    function paint() {
      // The topmost section currently in the band wins.
      var winner = sections.filter(function (s) { return visible.has(s.id); })[0];
      links.forEach(function (link) {
        var on = !!winner && link.getAttribute('href') === '#' + winner.id;
        link.classList.toggle('is-active', on);
        if (on) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      paint();
    }, { rootMargin: '-20% 0px -60% 0px' });

    sections.forEach(function (s) { obs.observe(s); });
  }

  /* ── CONTACT FORM ────────────────────────────────────────────────────── */
  function initForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;

    var btn = form.querySelector('[type="submit"]');
    var ok = document.getElementById('form-success');
    var bad = document.getElementById('form-error');
    var label = btn ? btn.textContent : '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      if (bad) bad.hidden = true;

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: new FormData(form)
      })
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (!json.success) throw new Error(json.message || 'Submission failed');
          form.reset();
          if (btn) btn.hidden = true;
          if (ok) {
            ok.hidden = false;
            ok.focus();
          }
        })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          if (bad) bad.hidden = false;
        });
    });
  }

  /* ── JOB FEED ────────────────────────────────────────────────────────── */
  function initJobFeed() {
    var feed = document.getElementById('job-feed');
    if (!feed) return;

    var slugs = (feed.getAttribute('data-slugs') || '').split(',').filter(Boolean);
    if (!slugs.length) return;

    Promise.all(slugs.map(function (slug) {
      return fetch('jobs/posts/' + slug + '.json')
        .then(function (r) { if (!r.ok) throw new Error(slug); return r.json(); })
        .then(function (job) { job.slug = slug; return job; });
    }))
      .then(function (jobs) {
        var rows = jobs.map(function (job) {
          var li = document.createElement('li');
          li.className = 'row subgrid';

          var where = document.createElement('span');
          where.className = 'label label--muted';
          where.textContent = job.location || '';

          var text = document.createElement('div');
          text.className = 'row-text';

          var a = document.createElement('a');
          a.className = 'job-link';
          a.href = 'jobs/job.html?slug=' + encodeURIComponent(job.slug);

          var title = document.createElement('span');
          title.className = 'title';
          title.textContent = job.title;

          a.appendChild(title);
          text.appendChild(a);
          li.appendChild(where);
          li.appendChild(text);
          return li;
        });
        feed.replaceChildren.apply(feed, rows);
      })
      .catch(function () { /* the server-rendered list stays in place */ });
  }

  /* ── HERO CURSOR ──────────────────────────────────────────────────────────
     The hero field stands in for an equirectangular projection of the globe:
     its left edge is 180° W, its top edge 90° N. Inside it the arrow is
     replaced by an instrument — a point and its readout — that names the place
     under the pointer. Mouse only: a finger has no hover position to report,
     and none of this carries meaning. */

  function initHeroCursor() {
    var field = document.querySelector('.hero-type');
    var cursor = document.getElementById('hero-cursor');
    if (!field || !cursor) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var lat = cursor.querySelector('[data-lat]');
    var lon = cursor.querySelector('[data-lon]');
    var box = cursor.querySelector('.hero-readout');
    if (!lat || !lon || !box) return;

    var GAP = 10;             // the readout clears the point, never covers it
    var x = 0, y = 0, inside = false, queued = false;

    // Fixed width of the integer part, so tabular figures never reflow the box.
    function degrees(value, digits) {
      var s = Math.abs(value).toFixed(4);
      while (s.indexOf('.') < digits) s = '0' + s;
      return s + '° ';
    }

    function clamp(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

    function set(name, px) { cursor.style.setProperty(name, Math.round(px) + 'px'); }

    function paint() {
      queued = false;
      var r = field.getBoundingClientRect();
      if (!r.width || !r.height) return;

      var u = (x - r.left) / r.width;
      var v = (y - r.top) / r.height;
      // Scrolling moves the field out from under a resting pointer.
      var over = inside && u >= 0 && u <= 1 && v >= 0 && v <= 1;
      cursor.classList.toggle('is-on', over);
      if (!over) return;

      var lonDeg = clamp(u) * 360 - 180;
      var latDeg = 90 - clamp(v) * 180;
      lat.textContent = degrees(latDeg, 2) + (latDeg < 0 ? 'S' : 'N');
      lon.textContent = degrees(lonDeg, 3) + (lonDeg < 0 ? 'W' : 'E');

      set('--x', x); set('--y', y);

      // The readout hangs below the point, its left edge on the point's, and
      // flips at the viewport edge rather than let itself be clipped.
      var w = box.offsetWidth, h = box.offsetHeight;
      set('--bx', x + w > window.innerWidth ? x + 3 - w : x - 3);
      set('--by', y + GAP + h > window.innerHeight ? y - GAP - h : y + GAP);
    }

    function queue() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }

    function track(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      inside = true;
      cursor.classList.toggle('is-over-link', !!e.target.closest('a, button'));
      queue();
    }

    field.addEventListener('pointerenter', track);
    field.addEventListener('pointermove', track);

    field.addEventListener('pointerleave', function () {
      inside = false;
      cursor.classList.remove('is-on');
    });

    window.addEventListener('scroll', function () { if (inside) queue(); }, { passive: true });

    field.classList.add('is-tracked');
  }

  function init() {
    initReveal();
    initHeroCursor();
    initMenu();
    initScrollSpy();
    initForm();
    initJobFeed();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
