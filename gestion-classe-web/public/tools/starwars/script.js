// ===== STAR FIELD =====
let starfieldPanning = false;
let starfieldAnimId = null;

function createStarfield(container) {
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

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

    if (starfieldPanning && panSpeed < maxPanSpeed) {
      panSpeed += 0.02;
    }

    if (panSpeed > 0) {
      offsetY += panSpeed;
    }

    stars.forEach(s => {
      let drawY = s.y - offsetY * s.speed;
      drawY = ((drawY % fieldHeight) + fieldHeight) % fieldHeight;
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

// ===== RECORDING (Tab Capture) =====
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

async function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    // Capture current tab with audio
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: true,
      preferCurrentTab: true,
    });

    // Also capture the <audio> element
    const audioEl = document.getElementById('audio');
    let combinedStream = displayStream;

    if (audioEl && audioEl.captureStream) {
      const audioStream = audioEl.captureStream();
      const audioTracks = audioStream.getAudioTracks();
      if (audioTracks.length > 0 && displayStream.getAudioTracks().length === 0) {
        audioTracks.forEach(t => displayStream.addTrack(t));
      }
      combinedStream = displayStream;
    }

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 5000000,
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      // Stop all tracks
      combinedStream.getTracks().forEach(t => t.stop());

      if (recordedChunks.length > 0) {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'star-wars-intro.webm';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      recordedChunks = [];
      updateRecordBtn(false);
    };

    // If user stops sharing, handle it
    combinedStream.getVideoTracks()[0].onended = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      isRecording = false;
      updateRecordBtn(false);
    };

    mediaRecorder.start(1000);
    isRecording = true;
    updateRecordBtn(true);

  } catch (err) {
    console.warn('Recording failed:', err);
    // User cancelled or browser doesn't support it
    isRecording = false;
    updateRecordBtn(false);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  isRecording = false;
}

function updateRecordBtn(recording) {
  const btn = document.getElementById('recordBtn');
  if (!btn) return;
  if (recording) {
    btn.textContent = '⏹ Arrêter et télécharger';
    btn.classList.add('recording');
  } else {
    btn.textContent = '⏺ Enregistrer la vidéo';
    btn.classList.remove('recording');
  }
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
  const crawlDelay = 16;
  crawlContent.style.animation = 'none';
  crawlContent.offsetHeight;

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
  }, 15000);

  // Reset animations
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
  playAudioDelayed(audioElement, 5000);

  // Pan stars near end
  const panStartTime = (crawlDelay + duration - 14) * 1000;
  setTimeout(() => {
    starfieldPanning = true;
  }, panStartTime);
}

function playAudioDelayed(audio, delayMs) {
  setTimeout(() => {
    audio.play().catch(() => {});
  }, delayMs);
}

function resetAnimation(elementId) {
  const el = document.getElementById(elementId);
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
}

function stopIntro() {
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }

  if (cleanupStarfield) {
    cleanupStarfield();
    cleanupStarfield = null;
  }

  // Stop recording if active
  if (isRecording) {
    stopRecording();
  }

  document.getElementById('animation').classList.add('hidden');
  document.getElementById('editor').classList.remove('hidden');
}

// Escape key to quit
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('animation').classList.contains('hidden')) {
    stopIntro();
  }
});
