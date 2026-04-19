// ===== STAR FIELD =====
let starfieldPanning = false;
let starfieldAnimId = null;

function createStarfield(container) {
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Générer les étoiles sur une zone plus haute (2x la hauteur)
  // pour avoir du contenu quand on pan vers le bas
  const fieldHeight = canvas.height * 3;

  const layers = [
    { count: 600, size: 1, opacity: 0.6, speed: 1 },
    { count: 200, size: 1.5, opacity: 0.8, speed: 1.5 },
    { count: 80,  size: 2, opacity: 1, speed: 2 },
  ];

  const stars = [];
  layers.forEach(layer => {
    for (let i = 0; i < layer.count; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * fieldHeight,
        size: layer.size,
        opacity: layer.opacity * (0.5 + Math.random() * 0.5),
        speed: layer.speed,
      });
    }
  });

  let offsetY = 0;
  let panSpeed = 0;
  const maxPanSpeed = 3;
  starfieldPanning = false;

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Accélération progressive du pan
    if (starfieldPanning && panSpeed < maxPanSpeed) {
      panSpeed += 0.02;
    }

    if (panSpeed > 0) {
      offsetY += panSpeed;
    }

    stars.forEach(s => {
      // Position Y avec parallaxe (les grosses étoiles bougent plus vite)
      let drawY = s.y - offsetY * s.speed;
      // Wrap-around pour que les étoiles réapparaissent en haut
      drawY = ((drawY % fieldHeight) + fieldHeight) % fieldHeight;
      // Ne dessiner que si visible
      if (drawY >= 0 && drawY <= canvas.height) {
        ctx.globalAlpha = s.opacity;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, drawY, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    starfieldAnimId = requestAnimationFrame(draw);
  }

  draw();

  const onResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', onResize);

  return () => {
    window.removeEventListener('resize', onResize);
    if (starfieldAnimId) cancelAnimationFrame(starfieldAnimId);
    starfieldAnimId = null;
    starfieldPanning = false;
  };
}

// ===== INTRO LOGIC =====
let cleanupStarfield = null;
let audioElement = null;

function startIntro() {
  const introText   = document.getElementById('introText').value;
  const logoUrl     = document.getElementById('logoUrl').value.trim();
  const episode     = document.getElementById('episode').value;
  const title       = document.getElementById('title').value;
  const crawlText   = document.getElementById('crawlText').value;
  const duration    = parseInt(document.getElementById('crawlDuration').value) || 80;
  const musicUrl    = document.getElementById('musicUrl').value.trim();
  const musicFile   = document.getElementById('musicFile').files[0];
  const centerText  = document.getElementById('centerText').checked;

  // Populate animation elements
  document.getElementById('intro-text').textContent = introText;

  // Logo
  const defaultLogo = document.getElementById('default-logo');
  const customLogo  = document.getElementById('custom-logo');
  if (logoUrl) {
    customLogo.src = logoUrl;
    customLogo.classList.remove('hidden');
    defaultLogo.classList.add('hidden');
  } else {
    customLogo.classList.add('hidden');
    defaultLogo.classList.remove('hidden');
  }

  // Crawl content
  document.getElementById('crawl-episode').textContent = episode;
  document.getElementById('crawl-title').textContent = title;

  const crawlBody = document.getElementById('crawl-body');
  crawlBody.innerHTML = '';
  crawlText.split('\n\n').forEach(para => {
    if (para.trim()) {
      const p = document.createElement('p');
      p.textContent = para.trim();
      crawlBody.appendChild(p);
    }
  });

  const crawlContent = document.getElementById('crawl-content');
  if (centerText) {
    crawlContent.classList.add('centered');
  } else {
    crawlContent.classList.remove('centered');
  }

  // Set crawl animation dynamically
  const crawlDelay = 16; // seconds after start
  crawlContent.style.animation = 'none';
  crawlContent.offsetHeight; // force reflow

  // Inject dynamic keyframes
  const styleId = 'dynamic-crawl-style';
  let existingStyle = document.getElementById(styleId);
  if (existingStyle) existingStyle.remove();

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes crawlScroll {
      0%   { top: 100%; }
      100% { top: -170%; }
    }
  `;
  document.head.appendChild(style);

  crawlContent.style.animation = `crawlScroll ${duration}s linear ${crawlDelay}s forwards`;

  // Hide crawl container until logo is gone
  const crawlContainer = document.getElementById('crawl-container');
  crawlContainer.style.visibility = 'hidden';
  setTimeout(() => {
    crawlContainer.style.visibility = 'visible';
  }, 15000); // Show after 15s (logo finishes at ~16s)

  // Reset animations on intro-text and logo
  resetAnimation('intro-text');
  resetAnimation('logo-container');

  // Show animation screen
  document.getElementById('editor').classList.add('hidden');
  const animScreen = document.getElementById('animation');
  animScreen.classList.remove('hidden');

  // Create starfield
  const starfield = document.getElementById('starfield');
  starfield.innerHTML = '';
  cleanupStarfield = createStarfield(starfield);

  // Audio
  audioElement = document.getElementById('audio');
  audioElement.pause();
  audioElement.currentTime = 0;

  if (musicFile) {
    audioElement.src = URL.createObjectURL(musicFile);
  } else if (musicUrl) {
    audioElement.src = musicUrl;
  }
  // Calage musique/logo — l'accord doit tomber pile avec le logo à 7s
  playAudioDelayed(audioElement, 5000);

  // Pan des étoiles vers la fin — commence quand le crawl touche à sa fin
  const panStartTime = (crawlDelay + duration - 14) * 1000; // 14s avant la fin du crawl
  setTimeout(() => {
    starfieldPanning = true;
  }, panStartTime);
}

function playAudioDelayed(audio, delayMs) {
  setTimeout(() => {
    audio.play().catch(() => {
      // Autoplay blocked — ignore silently
    });
  }, delayMs);
}

function resetAnimation(elementId) {
  const el = document.getElementById(elementId);
  el.style.animation = 'none';
  el.offsetHeight; // force reflow
  el.style.animation = '';
}

function stopIntro() {
  // Stop audio
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }

  // Cleanup starfield
  if (cleanupStarfield) {
    cleanupStarfield();
    cleanupStarfield = null;
  }

  // Hide animation, show editor
  document.getElementById('animation').classList.add('hidden');
  document.getElementById('editor').classList.remove('hidden');
}

// Escape key to quit
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('animation').classList.contains('hidden')) {
    stopIntro();
  }
});
