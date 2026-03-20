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

const footerTemplate = `
    <footer>
        <div class="container">
            <div class="mono">© 2026 ORBINT GmbH</div>
        </div>
    </footer>
`;

document.getElementById('footer-placeholder').innerHTML = footerTemplate;