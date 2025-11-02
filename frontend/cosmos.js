// Cosmic Background Animation with Mouse Interaction
(function() {
    const canvas = document.getElementById('stars-canvas');
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    // Star particles
    const stars = [];
    const numStars = 500;

    // Shooting stars
    const shootingStars = [];

    class Star {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.z = Math.random() * width;
            this.size = Math.random() * 2;
            this.brightness = Math.random();
            this.twinkleSpeed = Math.random() * 0.02 + 0.01;
        }

        update() {
            // Mouse parallax effect
            const dx = (mouseX - width / 2) * 0.02;
            const dy = (mouseY - height / 2) * 0.02;

            this.z -= 0.5;
            if (this.z <= 0) {
                this.reset();
                this.z = width;
            }

            // Twinkle effect
            this.brightness += this.twinkleSpeed;
            if (this.brightness > 1 || this.brightness < 0) {
                this.twinkleSpeed = -this.twinkleSpeed;
            }
        }

        draw() {
            const x = (this.x - width / 2) * (width / this.z) + width / 2;
            const y = (this.y - height / 2) * (width / this.z) + height / 2;

            // Add mouse parallax offset
            const parallaxX = (mouseX - width / 2) * (this.z / width) * 0.05;
            const parallaxY = (mouseY - height / 2) * (this.z / width) * 0.05;

            if (x < 0 || x > width || y < 0 || y > height) {
                return;
            }

            const size = this.size * (width / this.z);
            const opacity = Math.min(this.brightness, 1 - this.z / width);

            ctx.beginPath();
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.arc(x + parallaxX, y + parallaxY, size, 0, Math.PI * 2);
            ctx.fill();

            // Add glow for brighter stars
            if (this.brightness > 0.7) {
                const gradient = ctx.createRadialGradient(
                    x + parallaxX, y + parallaxY, 0,
                    x + parallaxX, y + parallaxY, size * 3
                );
                gradient.addColorStop(0, `rgba(147, 51, 234, ${opacity * 0.5})`);
                gradient.addColorStop(1, 'transparent');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x + parallaxX, y + parallaxY, size * 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    class ShootingStar {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height / 2;
            this.length = Math.random() * 80 + 40;
            this.speed = Math.random() * 8 + 4;
            this.angle = Math.PI / 4 + Math.random() * Math.PI / 6;
            this.opacity = 1;
            this.decay = Math.random() * 0.015 + 0.01;
        }

        update() {
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;
            this.opacity -= this.decay;

            if (this.opacity <= 0 || this.x > width || this.y > height) {
                // Random chance to create a new shooting star
                if (Math.random() < 0.01) {
                    this.reset();
                } else {
                    return false;
                }
            }
            return true;
        }

        draw() {
            const gradient = ctx.createLinearGradient(
                this.x, this.y,
                this.x - Math.cos(this.angle) * this.length,
                this.y - Math.sin(this.angle) * this.length
            );

            gradient.addColorStop(0, `rgba(255, 255, 255, ${this.opacity})`);
            gradient.addColorStop(0.5, `rgba(147, 51, 234, ${this.opacity * 0.8})`);
            gradient.addColorStop(1, 'transparent');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(
                this.x - Math.cos(this.angle) * this.length,
                this.y - Math.sin(this.angle) * this.length
            );
            ctx.stroke();
        }
    }

    // Initialize stars
    for (let i = 0; i < numStars; i++) {
        stars.push(new Star());
    }

    // Create initial shooting stars
    for (let i = 0; i < 3; i++) {
        shootingStars.push(new ShootingStar());
    }

    // Mouse tracking with smooth interpolation
    document.addEventListener('mousemove', (e) => {
        targetMouseX = e.clientX;
        targetMouseY = e.clientY;
    });

    // Touch support for mobile
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            targetMouseX = e.touches[0].clientX;
            targetMouseY = e.touches[0].clientY;
        }
    });

    // Smooth mouse interpolation
    function updateMouse() {
        mouseX += (targetMouseX - mouseX) * 0.1;
        mouseY += (targetMouseY - mouseY) * 0.1;
    }

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, width, height);

        updateMouse();

        // Update and draw stars
        stars.forEach(star => {
            star.update();
            star.draw();
        });

        // Update and draw shooting stars
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            if (!shootingStars[i].update()) {
                shootingStars.splice(i, 1);
            } else {
                shootingStars[i].draw();
            }
        }

        // Randomly add new shooting stars
        if (Math.random() < 0.02 && shootingStars.length < 5) {
            shootingStars.push(new ShootingStar());
        }

        requestAnimationFrame(animate);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;

        // Reset stars on resize
        stars.forEach(star => star.reset());
    });

    // Start animation
    animate();

    // Interactive galaxy elements - follow mouse
    const galaxies = document.querySelectorAll('.galaxy');
    const nebulas = document.querySelectorAll('.nebula');

    document.addEventListener('mousemove', (e) => {
        const mouseXPercent = (e.clientX / window.innerWidth - 0.5) * 2;
        const mouseYPercent = (e.clientY / window.innerHeight - 0.5) * 2;

        galaxies.forEach((galaxy, index) => {
            const speed = (index + 1) * 15;
            const rotation = mouseXPercent * 30;
            const scale = 1 + Math.abs(mouseXPercent) * 0.15;
            const x = mouseXPercent * speed;
            const y = mouseYPercent * speed;
            galaxy.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
            galaxy.style.opacity = 0.4 + Math.abs(mouseXPercent) * 0.2;
        });

        nebulas.forEach((nebula, index) => {
            const speed = (index + 1) * 8;
            const scale = 1 + Math.abs(mouseYPercent) * 0.2;
            const x = mouseXPercent * speed;
            const y = mouseYPercent * speed;
            nebula.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${mouseYPercent * 10}deg)`;
            nebula.style.opacity = 0.2 + Math.abs(mouseYPercent) * 0.15;
        });
    });

    // Touch support for mobile interactivity
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const mouseXPercent = (touch.clientX / window.innerWidth - 0.5) * 2;
            const mouseYPercent = (touch.clientY / window.innerHeight - 0.5) * 2;

            galaxies.forEach((galaxy, index) => {
                const speed = (index + 1) * 15;
                const rotation = mouseXPercent * 30;
                const scale = 1 + Math.abs(mouseXPercent) * 0.15;
                const x = mouseXPercent * speed;
                const y = mouseYPercent * speed;
                galaxy.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
            });

            nebulas.forEach((nebula, index) => {
                const speed = (index + 1) * 8;
                const scale = 1 + Math.abs(mouseYPercent) * 0.2;
                const x = mouseXPercent * speed;
                const y = mouseYPercent * speed;
                nebula.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${mouseYPercent * 10}deg)`;
            });
        }
    });
})();
