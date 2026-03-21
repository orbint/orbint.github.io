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

const footerTemplate = `
    <footer>
        <div class="container">
            <div class="mono">© 2026 ORBINT GmbH</div>
            <div class="mono" style="margin-top: 0.5rem;">
                <a href="impressum.html" class="footer-link">Impressum</a>
                &nbsp;·&nbsp;
                <a href="privacy.html" class="footer-link">Privacy Policy</a>
            </div>
        </div>
    </footer>
`;

document.getElementById('footer-placeholder').innerHTML = footerTemplate;