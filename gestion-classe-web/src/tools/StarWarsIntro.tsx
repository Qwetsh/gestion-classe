import { useState, useRef, useCallback, useEffect } from 'react';

// ===== TYPES =====
interface StarWarsConfig {
  introText: string;
  episode: string;
  title: string;
  crawlText: string;
  duration: number;
  centerText: boolean;
  musicFile: File | null;
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
}

// ===== CONSTANTS =====
const INTRO_FADE_IN_START = 0;
const INTRO_FADE_IN_END = 2;
const INTRO_VISIBLE_END = 4.5;
const INTRO_FADE_OUT_END = 6;
const LOGO_START = 7;
const LOGO_END = 16;
const CRAWL_START = 16;
const STAR_LAYERS = [
  { count: 400, size: 1, opacity: 0.6, speed: 0.3 },
  { count: 150, size: 1.5, opacity: 0.8, speed: 0.6 },
  { count: 60, size: 2.2, opacity: 1, speed: 1.0 },
];
const LOGO_FONT_URL = 'https://cdn.jsdelivr.net/gh/nicholasgasior/gfonts@master/dist/Star%20Jedi/StarJedi-DGRW.ttf';

// ===== COMPONENT =====
export default function StarWarsIntro() {
  const [config, setConfig] = useState<StarWarsConfig>({
    introText: 'Il y a bien longtemps, dans une salle de classe\nlointaine, tres lointaine...',
    episode: 'Episode I',
    title: 'LA MENACE FANTOME',
    crawlText:
      'La classe est en proie au chaos. Les bavardages incessants menacent de submerger le cours.\n\nMais un espoir subsiste. Un professeur courageux a decide de retablir l\'ordre grace a une nouvelle methode revolutionnaire.\n\nArmé de son application de gestion de classe, il se prepare a affronter les forces du desordre...',
    duration: 60,
    centerText: false,
    musicFile: null,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);

  // Load Star Jedi font
  useEffect(() => {
    const font = new FontFace('StarJedi', `url(${LOGO_FONT_URL})`);
    font
      .load()
      .then((loaded) => {
        (document.fonts as any).add(loaded);
        setFontLoaded(true);
      })
      .catch(() => {
        // Fallback: font won't load, we'll use Impact
        setFontLoaded(true);
      });
  }, []);

  // Generate stars
  const generateStars = useCallback((width: number, height: number) => {
    const fieldHeight = height * 3;
    const stars: Star[] = [];
    STAR_LAYERS.forEach((layer) => {
      for (let i = 0; i < layer.count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * fieldHeight,
          size: layer.size * (0.8 + Math.random() * 0.4),
          opacity: layer.opacity * (0.5 + Math.random() * 0.5),
          speed: layer.speed,
        });
      }
    });
    starsRef.current = stars;
  }, []);

  // Draw starfield
  const drawStarfield = (
    ctx: CanvasRenderingContext2D,
    _w: number,
    h: number,
    time: number,
    totalDuration: number
  ) => {
    const fieldHeight = h * 3;
    const panStartTime = totalDuration - 14;
    let panOffset = 0;

    if (time > panStartTime) {
      const panElapsed = time - panStartTime;
      const panSpeed = Math.min(panElapsed * 0.15, 3);
      panOffset = panElapsed * panSpeed;
    }

    starsRef.current.forEach((star) => {
      let drawY = star.y - panOffset * star.speed;
      drawY = ((drawY % fieldHeight) + fieldHeight) % fieldHeight;
      if (drawY <= h) {
        ctx.globalAlpha = star.opacity;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(star.x, drawY, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  };

  // Draw blue intro text
  const drawIntroText = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    time: number
  ) => {
    if (time < INTRO_FADE_IN_START || time > INTRO_FADE_OUT_END) return;

    let alpha = 0;
    if (time < INTRO_FADE_IN_END) {
      alpha = (time - INTRO_FADE_IN_START) / (INTRO_FADE_IN_END - INTRO_FADE_IN_START);
    } else if (time < INTRO_VISIBLE_END) {
      alpha = 1;
    } else {
      alpha = 1 - (time - INTRO_VISIBLE_END) / (INTRO_FADE_OUT_END - INTRO_VISIBLE_END);
    }

    alpha = Math.max(0, Math.min(1, alpha));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#4eb5f5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = config.introText.split('\n');
    const fontSize = Math.min(w * 0.035, 28);
    ctx.font = `${fontSize}px "Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif`;

    const lineHeight = fontSize * 1.6;
    const totalHeight = lines.length * lineHeight;
    const startY = h / 2 - totalHeight / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, startY + i * lineHeight + lineHeight / 2);
    });

    ctx.globalAlpha = 1;
  };

  // Draw STAR WARS logo
  const drawLogo = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    time: number
  ) => {
    if (time < LOGO_START || time > LOGO_END) return;

    const progress = (time - LOGO_START) / (LOGO_END - LOGO_START);
    // Logo starts large and shrinks to vanishing point
    const scale = Math.max(0.01, 1 - progress * 0.95);
    const alpha = progress < 0.1 ? progress / 0.1 : progress > 0.85 ? (1 - progress) / 0.15 : 1;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);

    // Try Star Jedi font, fallback to Impact
    const logoFont = document.fonts.check('1px StarJedi') ? 'StarJedi' : 'Impact';
    const baseFontSize = Math.min(w * 0.18, 180);

    ctx.fillStyle = '#FFE81F';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${baseFontSize}px "${logoFont}"`;

    // Draw "STAR" and "WARS" on two lines
    ctx.fillText('STAR', 0, -baseFontSize * 0.55);
    ctx.fillText('WARS', 0, baseFontSize * 0.55);

    // Outline
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 2;
    ctx.strokeText('STAR', 0, -baseFontSize * 0.55);
    ctx.strokeText('WARS', 0, baseFontSize * 0.55);

    ctx.restore();
  };

  // Draw crawl text with perspective
  const drawCrawl = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    time: number,
    totalDuration: number
  ) => {
    if (time < CRAWL_START) return;

    const crawlElapsed = time - CRAWL_START;
    const crawlDuration = totalDuration - CRAWL_START;
    const progress = crawlElapsed / crawlDuration;

    ctx.save();

    // Perspective parameters
    const vanishY = h * 0.15; // Vanishing point Y
    const bottomY = h * 1.1; // Where text starts from
    const perspectiveDepth = 0.7; // How strong the perspective is

    // Parse crawl text
    const allLines: { text: string; type: 'episode' | 'title' | 'body' | 'space' }[] = [];
    allLines.push({ text: config.episode, type: 'episode' });
    allLines.push({ text: '', type: 'space' });
    allLines.push({ text: config.title, type: 'title' });
    allLines.push({ text: '', type: 'space' });
    allLines.push({ text: '', type: 'space' });

    // Word wrap body text
    const maxCharsPerLine = 45;
    const paragraphs = config.crawlText.split('\n\n');
    paragraphs.forEach((para, pIdx) => {
      if (pIdx > 0) {
        allLines.push({ text: '', type: 'space' });
      }
      const words = para.replace(/\n/g, ' ').split(' ');
      let currentLine = '';
      words.forEach((word) => {
        if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
          allLines.push({ text: currentLine.trim(), type: 'body' });
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      });
      if (currentLine.trim()) {
        allLines.push({ text: currentLine.trim(), type: 'body' });
      }
    });

    // Calculate scroll
    const lineSpacing = 42;
    const totalTextHeight = allLines.length * lineSpacing + h;
    const scrollOffset = progress * totalTextHeight;

    // Draw each line with perspective
    const textAlign = config.centerText ? 'center' : 'center';
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';

    allLines.forEach((line, i) => {
      // Position in world space (from bottom to top)
      const worldY = bottomY + i * lineSpacing - scrollOffset;

      // Skip if out of bounds
      if (worldY < vanishY - 50 || worldY > h + 50) return;

      // Perspective projection
      const relativeY = (worldY - vanishY) / (bottomY - vanishY);
      if (relativeY <= 0) return;

      const perspectiveScale = Math.pow(relativeY, perspectiveDepth);
      const screenY = vanishY + (worldY - vanishY) * perspectiveScale;

      // Alpha based on position (fade near vanishing point)
      let alpha = 1;
      if (relativeY < 0.2) {
        alpha = relativeY / 0.2;
      }
      // Also fade if below screen
      if (worldY > h) {
        alpha = Math.max(0, 1 - (worldY - h) / 100);
      }

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      // Font size based on type and perspective
      let baseFontSize: number;
      switch (line.type) {
        case 'episode':
          baseFontSize = 22;
          ctx.fillStyle = '#4eb5f5';
          break;
        case 'title':
          baseFontSize = 44;
          ctx.fillStyle = '#FFE81F';
          break;
        case 'space':
          return;
        default:
          baseFontSize = 26;
          ctx.fillStyle = '#FFE81F';
      }

      const scaledFontSize = baseFontSize * perspectiveScale;
      if (scaledFontSize < 2) return;

      const fontWeight = line.type === 'title' ? 'bold' : 'normal';
      ctx.font = `${fontWeight} ${scaledFontSize}px "Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif`;

      // Horizontal scaling for perspective (narrower at top)
      const horizontalScale = perspectiveScale;
      ctx.save();
      ctx.translate(w / 2, screenY);
      ctx.scale(horizontalScale, 1);
      ctx.fillText(line.text, 0, 0);
      ctx.restore();
    });

    ctx.restore();
  };

  // Main animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlayingRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const totalDuration = CRAWL_START + config.duration;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Draw layers
    drawStarfield(ctx, w, h, elapsed, totalDuration);
    drawIntroText(ctx, w, h, elapsed);
    drawLogo(ctx, w, h, elapsed);
    drawCrawl(ctx, w, h, elapsed, totalDuration);

    // Check if animation is done
    if (elapsed >= totalDuration + 5) {
      stopAnimation();
      return;
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [config]);

  // Start animation
  const startAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas to full screen size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    generateStars(canvas.width, canvas.height);
    startTimeRef.current = performance.now();
    isPlayingRef.current = true;
    setIsPlaying(true);

    // Start audio after 5 seconds
    if (config.musicFile) {
      const audio = new Audio(URL.createObjectURL(config.musicFile));
      audioRef.current = audio;
      setTimeout(() => {
        if (isPlayingRef.current) {
          audio.play().catch(() => {});
        }
      }, 5000);
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [config, generateStars, animate]);

  // Stop animation
  const stopAnimation = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasStream = canvas.captureStream(30);
    let combinedStream = canvasStream;

    // Add audio track if available
    if (audioRef.current && (audioRef.current as any).captureStream) {
      try {
        const audioStream = (audioRef.current as any).captureStream() as MediaStream;
        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const tracks = [...canvasStream.getVideoTracks(), ...audioTracks];
          combinedStream = new MediaStream(tracks);
        }
      } catch {
        // Audio capture not supported, video only
      }
    }

    recordedChunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 5_000_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      setIsRecording(false);
      if (recordedChunksRef.current.length > 0) {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'star-wars-intro.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      recordedChunksRef.current = [];
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  // Play + Record
  const handlePlayAndRecord = useCallback(() => {
    startAnimation();
    // Small delay to ensure canvas is rendering
    setTimeout(() => {
      startRecording();
    }, 100);
  }, [startAnimation, startRecording]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPlayingRef.current) {
        stopAnimation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stopAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Editor Form */}
      {!isPlaying && (
        <div className="space-y-6">
          {/* Intro Text */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Texte d'introduction (bleu)
            </label>
            <textarea
              value={config.introText}
              onChange={(e) => setConfig((c) => ({ ...c, introText: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-y"
              placeholder="Il y a bien longtemps, dans une galaxie..."
            />
          </div>

          {/* Episode + Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Episode
              </label>
              <input
                type="text"
                value={config.episode}
                onChange={(e) => setConfig((c) => ({ ...c, episode: e.target.value }))}
                className="w-full px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Titre
              </label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
                className="w-full px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Crawl Text */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Texte defilant (separer les paragraphes par une ligne vide)
            </label>
            <textarea
              value={config.crawlText}
              onChange={(e) => setConfig((c) => ({ ...c, crawlText: e.target.value }))}
              rows={8}
              className="w-full px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-y"
            />
          </div>

          {/* Duration + Center */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                Duree du defilement (secondes)
              </label>
              <input
                type="number"
                min={20}
                max={300}
                value={config.duration}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, duration: parseInt(e.target.value) || 60 }))
                }
                className="w-full px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="centerText"
                checked={config.centerText}
                onChange={(e) => setConfig((c) => ({ ...c, centerText: e.target.checked }))}
                className="w-5 h-5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
              />
              <label htmlFor="centerText" className="text-sm text-[var(--color-text)]">
                Centrer le texte
              </label>
            </div>
          </div>

          {/* Music Upload */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              Musique (MP3) — optionnel
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setConfig((c) => ({ ...c, musicFile: file }));
              }}
              className="w-full px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--color-primary)] file:text-white file:cursor-pointer"
            />
            {!config.musicFile && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Sans fichier, l'animation sera muette.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={startAnimation}
              disabled={!fontLoaded}
              className="px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Lancer l'animation
            </button>
            <button
              onClick={handlePlayAndRecord}
              disabled={!fontLoaded}
              className="px-6 py-3 rounded-xl bg-red-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Lancer + Enregistrer (.webm)
            </button>
          </div>

          <p className="text-xs text-[var(--color-text-tertiary)]">
            Appuyez sur <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] font-mono">Echap</kbd> pour arreter l'animation.
          </p>
        </div>
      )}

      {/* Canvas Overlay (fullscreen when playing) */}
      {isPlaying && (
        <div
          className="fixed inset-0 z-[9999] bg-black"
          style={{ cursor: 'none' }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            style={{ background: '#000' }}
          />

          {/* Floating controls */}
          <div className="fixed top-4 right-4 z-[10000] flex gap-2">
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600/80 text-white text-sm">
                <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                REC
              </div>
            )}
            <button
              onClick={stopAnimation}
              className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur text-white text-sm hover:bg-white/20 transition-colors"
            >
              Fermer (Echap)
            </button>
          </div>
        </div>
      )}

      {/* Hidden canvas for when not playing (needed for ref) */}
      {!isPlaying && <canvas ref={canvasRef} className="hidden" />}
    </div>
  );
}
