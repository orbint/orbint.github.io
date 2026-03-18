document.addEventListener('DOMContentLoaded', () => {
    const textElement = document.getElementById('typewriter');
    const textToType = "We detect, identify, and locate signals around the globe.";
    let index = 0;

    function typeEffect() {
        textElement.classList.add('typing');

        if (index < textToType.length) {
            textElement.textContent += textToType.charAt(index);
            index++;
            let typingSpeed = Math.floor(Math.random() * 5 + 30); 
            setTimeout(typeEffect, typingSpeed);
        } else {
            setTimeout(() => {
                textElement.classList.remove('typing');
            }, 1000);
        }
    }

    // Start typing
    typeEffect();
});