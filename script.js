// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const projectile = document.getElementById('projectile');
const hoop = document.getElementById('hoop');
const netWrapper = document.getElementById('net-wrapper');
const ground = document.getElementById('ground');
const successMsg = document.getElementById('success-msg');

// Game State
let isLoaded = false;
let isDragging = false;
let isFlying = false;

let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

// Physics constants
const maxDragDistance = 150;
const throwPowerMultiplier = 0.35;
const gravity = 0.5;

// Trajectory Setup
const numDots = 15;
const dots = [];
for (let i = 0; i < numDots; i++) {
    const dot = document.createElement('div');
    dot.classList.add('trajectory-dot');
    document.body.appendChild(dot);
    dots.push(dot);
}

// --- FILE LOADING ---
dropZone.addEventListener('dragover', (e) => { 
    e.preventDefault(); 
    dropZone.classList.add('dragover'); 
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) loadProjectile(e.dataTransfer.files[0]);
});

browseBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) loadProjectile(fileInput.files[0]);
});

function loadProjectile(file) {
    if (isFlying) return;
    
    successMsg.classList.remove('show');
    dropZone.style.opacity = '0.3';
    dropZone.style.pointerEvents = 'none';
    
    const dropRect = dropZone.getBoundingClientRect();
    const pWidth = 60;
    const pHeight = 60;
    
    startX = dropRect.left + (dropRect.width / 2) - (pWidth / 2);
    startY = dropRect.top + (dropRect.height / 2) - (pHeight / 2);

    projectile.style.left = `${startX}px`;
    projectile.style.top = `${startY}px`;
    projectile.style.display = 'flex';
    projectile.style.transition = 'none';
    projectile.style.transform = 'scale(1) rotate(0deg)';
    projectile.style.opacity = '1';

    isLoaded = true;
    isDragging = false;
    isFlying = false;
    currentX = startX;
    currentY = startY;
}

// --- DRAG & AIM ---
projectile.addEventListener('mousedown', (e) => {
    if (!isLoaded || isFlying) return;
    isDragging = true;
    e.preventDefault(); 
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging || !isLoaded) return;

    let deltaX = e.clientX - (startX + 30);
    let deltaY = e.clientY - (startY + 30);

    // Limit drag distance (slingshot limit)
    const distance = Math.hypot(deltaX, deltaY);
    if (distance > maxDragDistance) {
        const angle = Math.atan2(deltaY, deltaX);
        deltaX = Math.cos(angle) * maxDragDistance;
        deltaY = Math.sin(angle) * maxDragDistance;
    }

    currentX = startX + deltaX;
    currentY = startY + deltaY;

    projectile.style.left = `${currentX}px`;
    projectile.style.top = `${currentY}px`;

    // Calculate trajectory based on drag vector
    const velocityX = (startX - currentX) * throwPowerMultiplier;
    const velocityY = (startY - currentY) * throwPowerMultiplier;

    drawTrajectory(velocityX, velocityY);
});

window.addEventListener('mouseup', () => {
    if (!isDragging || !isLoaded) return;
    isDragging = false;
    
    dots.forEach(dot => dot.style.opacity = '0');

    const velocityX = (startX - currentX) * throwPowerMultiplier;
    const velocityY = (startY - currentY) * throwPowerMultiplier;

    // Only shoot if dragged far enough
    if (Math.hypot(currentX - startX, currentY - startY) > 20) {
        shoot(velocityX, velocityY);
    } else {
        // Snap back if barely moved
        projectile.style.transition = 'all 0.2s ease-out';
        projectile.style.left = `${startX}px`;
        projectile.style.top = `${startY}px`;
    }
});

// --- TRAJECTORY PREDICTION ---
function drawTrajectory(vx, vy) {
    let simX = currentX + 30;
    let simY = currentY + 30;
    let simVx = vx;
    let simVy = vy;

    dots.forEach((dot, index) => {
        // Skip ahead for faster simulation
        for (let i = 0; i < 3; i++) {
            simX += simVx;
            simY += simVy;
            simVy += gravity;
        }
        dot.style.left = `${simX}px`;
        dot.style.top = `${simY}px`;
        dot.style.opacity = 1 - (index / numDots); // Fade dots
    });
}

// --- SHOOTING & COLLISION ---
function shoot(vx, vy) {
    isFlying = true;
    isLoaded = false;

    let posX = currentX;
    let posY = currentY;
    let velX = vx;
    let velY = vy;
    let rotation = 0;

    projectile.style.cursor = 'default';

    // Get physical boundaries
    const hoopRect = hoop.getBoundingClientRect();
    const rimY = hoopRect.top + hoopRect.height - 40; 
    const rimXStart = hoopRect.left + (hoopRect.width / 2) - 45; 
    const rimXEnd = hoopRect.left + (hoopRect.width / 2) + 45;   
    
    const groundRect = ground.getBoundingClientRect();
    const groundY = groundRect.top;

    function animate() {
        posX += velX;
        posY += velY;
        velY += gravity;
        rotation += velX * 2; // Spin based on horizontal speed

        projectile.style.left = `${posX}px`;
        projectile.style.top = `${posY}px`;
        projectile.style.transform = `rotate(${rotation}deg)`;

        const ballCenterX = posX + 30;
        const ballCenterY = posY + 30;

        // 1. Check for Score (Passing through rim X/Y bounds)
        if (ballCenterY > rimY && ballCenterY < rimY + 20) {
            if (ballCenterX > rimXStart && ballCenterX < rimXEnd) {
                score(ballCenterX, posY);
                return;
            }
        }

        // 2. Check for Ground Collision
        if (ballCenterY >= groundY - 30) { 
            bounceOffGround(posX, groundY - 60); 
            return;
        }

        // Stop if it goes off screen horizontally
        if (posX > window.innerWidth + 100 || posX < -100) {
            resetGame();
            return;
        }

        requestAnimationFrame(animate);
    }

    animate();
}

// --- SCORING EFFECT ---
function score(hitX, hitY) {
    // Move ball to rim center
    projectile.style.left = `${hitX - 30}px`;
    projectile.style.top = `${hitY}px`;
    
    // 1. Trigger Net Animation
    netWrapper.classList.remove('swish');
    void netWrapper.offsetWidth; // Trigger reflow to restart animation
    netWrapper.classList.add('swish');

    // 2. Animate ball falling through the net
    projectile.style.transition = 'top 0.4s cubic-bezier(0.5, 0, 1, 1), opacity 0.4s ease-in';
    void projectile.offsetWidth;
    projectile.style.top = `${hitY + 80}px`;
    projectile.style.opacity = '0';

    // 3. Show Success Message
    setTimeout(() => {
        successMsg.classList.add('show');
        projectile.style.display = 'none';
        setTimeout(resetGame, 2000);
    }, 300);
}

// --- GROUND BOUNCE EFFECT ---
function bounceOffGround(hitX, groundY) {
    projectile.style.left = `${hitX}px`;
    projectile.style.top = `${groundY - 20}px`; // Bounce up
    
    projectile.style.transition = 'top 0.3s cubic-bezier(0.5, 0, 1, 1), opacity 0.3s ease-in';
    void projectile.offsetWidth;
    
    // Fall back down and fade
    setTimeout(() => {
        projectile.style.top = `${groundY}px`;
        projectile.style.opacity = '0';
    }, 10);

    setTimeout(resetGame, 500);
}

// --- RESET STATE ---
function resetGame() {
    isFlying = false;
    isLoaded = false;
    
    successMsg.classList.remove('show');
    dropZone.style.opacity = '1';
    dropZone.style.pointerEvents = 'auto';
    
    projectile.style.display = 'none';
    projectile.style.opacity = '1';
    projectile.style.transition = 'none';
    projectile.style.cursor = 'grab';
    
    netWrapper.classList.remove('swish');
    fileInput.value = '';
}
