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

          var arrow = document.createElement('span');
          arrow.className = 'arrow';
          arrow.setAttribute('aria-hidden', 'true');
          arrow.textContent = '\u2192';

          a.appendChild(title);
          a.appendChild(arrow);
          text.appendChild(a);
          li.appendChild(where);
          li.appendChild(text);
          return li;
        });
        feed.replaceChildren.apply(feed, rows);
      })
      .catch(function () { /* the server-rendered list stays in place */ });
  }

  function init() {
    initReveal();
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
