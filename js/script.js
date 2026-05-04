// ── TYPEWRITER ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const textElement = document.getElementById('typewriter');
    if (!textElement) return;
    const fullText = textElement.textContent.trim();
    textElement.innerHTML = fullText.split('').map(char =>
        `<span style="visibility: hidden;">${char}</span>`
    ).join('');
    const spans = textElement.querySelectorAll('span');
    let index = 0;
    function typeEffect() {
        if (index < spans.length) {
            spans[index].style.visibility = 'visible';
            index++;
            setTimeout(typeEffect, Math.floor(Math.random() * 5 + 15));
        }
    }
    typeEffect();
});

// ── CONTACT FORM ──────────────────────────────────────────────────────────────
// Set to live URL when server is deployed:
// const CONTACT_ENDPOINT = 'https://api.orbint.de/contact';
const CONTACT_ENDPOINT = null; // mock mode

const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('form-submit');
        const errorBox = document.getElementById('form-error');
        const successBox = document.getElementById('form-success');
        errorBox.hidden = true;
        successBox.hidden = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        const payload = {
            name: contactForm.name.value.trim(),
            email: contactForm.email.value.trim(),
            phone: contactForm.phone.value.trim(),
            message: contactForm.message.value.trim(),
        };
        try {
            if (CONTACT_ENDPOINT) {
                const res = await fetch(CONTACT_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Server error');
            } else {
                console.log('Contact form payload (mock):', payload);
                await new Promise(r => setTimeout(r, 1000));
            }
            contactForm.reset();
            successBox.hidden = false;
        } catch {
            errorBox.textContent = 'Something went wrong. Please try again or email us directly at info@orbint.de.';
            errorBox.hidden = false;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Message';
        }
    });
}

// ── HAMBURGER ─────────────────────────────────────────────────────────────────
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('open');
            navLinks.classList.remove('open');
        });
    });
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
const isLightTheme = document.body.classList.contains('light-theme');
const isSinglePage = !!document.getElementById('mission');

function makeNavHref(section) {
    return isSinglePage ? `#${section}` : `/#${section}`;
}

const footerLogo = isLightTheme
    ? '/assets/images/black_black_logo.png'
    : '/assets/images/white_white_logo.png';

const footerTemplate = `
    <footer>
        <div class="container">
            <div class="accent-card footer-card">
                <div class="footer-grid">
                    <div class="footer-col footer-col-brand">
                        <a href="${makeNavHref('mission')}">
                            <img src="${footerLogo}" alt="Orbint" class="footer-logo" id="footer-logo-img">
                        </a>
                        <div class="footer-legal mono">© 2026 Orbint GmbH</div>
                    </div>
                    <div class="footer-col">
                        <div class="footer-label mono">Sitemap</div>
                        <div class="footer-nav">
                            <a href="${makeNavHref('mission')}" class="footer-link footer-nav-link">Mission</a>
                            <a href="${makeNavHref('about')}" class="footer-link footer-nav-link">About Us</a>
                            <a href="${makeNavHref('career')}" class="footer-link footer-nav-link">Career</a>
                            <a href="${makeNavHref('news')}" class="footer-link footer-nav-link">News</a>
                            <a href="${makeNavHref('contact')}" class="footer-link footer-nav-link">Contact</a>
                        </div>
                    </div>
                    <div class="footer-col">
                        <div class="footer-label mono">Email</div>
                        <a href="mailto:info@orbint.de" class="footer-link footer-value mono">info@orbint.de</a>
                        <div class="footer-label mono" style="margin-top: 2rem;">Address</div>
                        <div class="footer-value mono">
                            Orbint GmbH<br>
                            Lilienthalstr. 9<br>
                            85579 Neubiberg<br>
                            Germany
                        </div>
                        <div class="footer-meta mono">
                            <a href="/privacy.html" class="footer-link">Privacy Policy</a>
                            &nbsp;·&nbsp;
                            <a href="/impressum.html" class="footer-link">Impressum</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </footer>
`;

const footerPlaceholder = document.getElementById('footer-placeholder');
if (footerPlaceholder) footerPlaceholder.innerHTML = footerTemplate;

const navFade = document.createElement('div');
navFade.className = 'nav-fade';
document.body.appendChild(navFade);

// ── SCROLL-DRIVEN THEME INTERPOLATION (single-page only) ──────────────────────
if (isSinglePage) {
    const root = document.documentElement;

    // Dark theme colour stops
    const DARK = {
        bg:      [11,  14,  20],
        text:    [226, 232, 240],
        heading: [234, 236, 238],
        navLink: [226, 232, 240],
    };
    // Light theme colour stops
    const LIGHT = {
        bg:      [234, 236, 238],
        text:    [26,  26,  26],
        heading: [11,  14,  20],
        navLink: [68,  68,  68],
    };

    function lerp(a, b, t) { return a + (b - a) * t; }
    function smoothstep(t) { return t * t * (3 - 2 * t); }

    function lerpRgb(a, b, t) {
        return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
    }

    function getThemeT() {
        const partnersEl = document.getElementById('partners');
        const aboutEl    = document.getElementById('about');
        if (!partnersEl || !aboutEl) return 0;

        const scrollY        = window.scrollY;
        const wH             = window.innerHeight;
        // Document-relative positions
        const partnersBottom = partnersEl.getBoundingClientRect().bottom + scrollY;
        const aboutMid       = aboutEl.getBoundingClientRect().top   + scrollY + aboutEl.offsetHeight * 0.35;

        const startScroll = partnersBottom - wH;   // partners enters bottom of viewport
        const endScroll   = aboutMid       - wH * 0.5; // about midpoint at viewport center

        if (scrollY <= startScroll) return 0;
        if (scrollY >= endScroll)   return 1;
        return smoothstep((scrollY - startScroll) / (endScroll - startScroll));
    }

    const logoDark  = document.getElementById('nav-logo-dark');
    const logoLight = document.getElementById('nav-logo-light');

    function applyTheme(t) {
        root.style.setProperty('--page-bg',      lerpRgb(DARK.bg,      LIGHT.bg,      t));
        root.style.setProperty('--page-text',     lerpRgb(DARK.text,    LIGHT.text,    t));
        root.style.setProperty('--page-heading',  lerpRgb(DARK.heading, LIGHT.heading, t));
        root.style.setProperty('--page-nav-link', lerpRgb(DARK.navLink, LIGHT.navLink, t));
        root.style.setProperty('--page-nav-link-opacity', lerp(0.6, 0.85, t));
        root.style.setProperty('--page-hamburger',  lerpRgb(DARK.text, LIGHT.heading, t));
        root.style.setProperty('--page-overlay-opacity', lerp(1, 0, t));
        root.style.setProperty('--dark-video-opacity',   lerp(1, 0, t));
        root.style.setProperty('--light-video-opacity',  lerp(0, 0.35, t));

        if (logoDark)  logoDark.style.opacity  = 1 - t;
        if (logoLight) logoLight.style.opacity  = t;

        const footerLogoImg = document.getElementById('footer-logo-img');
        if (footerLogoImg) {
            footerLogoImg.src = t > 0.5
                ? '/assets/images/black_black_logo.png'
                : '/assets/images/white_white_logo.png';
        }
    }

    // ── NAV ACTIVE STATE ──────────────────────────────────────────────────────
    const sections = ['mission', 'news', 'career', 'about', 'contact'];

    function updateNavActive() {
        const wH = window.innerHeight;
        let active = sections[0];
        for (const id of sections) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (el.getBoundingClientRect().top <= wH * 0.4) active = id;
        }
        navLinks.querySelectorAll('a[data-section]').forEach(a => {
            a.classList.toggle('active', a.dataset.section === active);
        });
    }

    // ── SCROLL HANDLER ────────────────────────────────────────────────────────
    let raf = null;
    function onScroll() {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            applyTheme(getThemeT());
            updateNavActive();
            raf = null;
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // Apply immediately on load
    applyTheme(getThemeT());
    updateNavActive();
}
