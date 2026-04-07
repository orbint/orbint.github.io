document.addEventListener('DOMContentLoaded', () => {
    const textElement = document.getElementById('typewriter');
    const fullText = textElement.textContent.trim();
    
    // Clear and fill with invisible spans to "hold" the layout space
    textElement.innerHTML = fullText.split('').map(char => 
        `<span style="visibility: hidden;">${char}</span>`
    ).join('');

    const spans = textElement.querySelectorAll('span');
    let index = 0;

    function typeEffect() {
        if (index < spans.length) {
            spans[index].style.visibility = 'visible';
            index++;
            let typingSpeed = Math.floor(Math.random() * 5 + 15);
            setTimeout(typeEffect, typingSpeed);
        }
    }

    typeEffect();
});

function toggleArticle(card) {
    // Toggle the 'active' class on the clicked card
    card.classList.toggle('active');
    
    // Change button text
    const btn = card.querySelector('.read-more-btn');
    if (card.classList.contains('active')) {
        btn.innerText = "Close Article -";
    } else {
        btn.innerText = "Read Full Article +";
    }
}

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
                // Mock: simulate network delay
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

const isLightTheme = document.body.classList.contains('light-theme');
const footerLogo = isLightTheme
    ? '/assets/images/black_black_logo.png'
    : '/assets/images/white_white_logo.png';

const footerTemplate = `
    <footer>
        <div class="container">
            <div class="accent-card footer-card">
                <div class="footer-grid">
                    <div class="footer-col footer-col-brand">
                        <a href="/index.html">
                            <img src="${footerLogo}" alt="Orbint" class="footer-logo">
                        </a>
                        <div class="footer-legal mono">© 2026 Orbint GmbH</div>
                    </div>

                    <div class="footer-col">
                        <div class="footer-label mono">Sitemap</div>
                        <div class="footer-nav">
                            <a href="/index.html" class="footer-link footer-nav-link">Mission</a>
                            <a href="/news.html" class="footer-link footer-nav-link">News</a>
                            <a href="/career.html" class="footer-link footer-nav-link">Career</a>
                            <a href="/company.html" class="footer-link footer-nav-link">About Us</a>
                            <a href="/contact.html" class="footer-link footer-nav-link">Contact</a>
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

document.getElementById('footer-placeholder').innerHTML = footerTemplate;

const navFade = document.createElement('div');
navFade.className = 'nav-fade';
document.body.appendChild(navFade);


