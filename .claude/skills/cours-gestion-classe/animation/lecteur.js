/* Lecteur « gc-anim » v1 : joue une scène étape par étape, seul ou piloté par le tableau de Gestion Classe.
   - Les textes des étapes (titre, légende) viennent du bloc JSON #gc-anim : on les réécrit sans toucher au dessin.
   - Le dessin vient de GC.play({ identifiant: { dur, draw(t) } }) : draw rend le SVG de l'instant t (secondes).
   - Dans le tableau (cadre), pas de boutons : le tableau envoie { gc:'anim', cmd:'init'|'goto'|'replay'|'play'|'pause'|'toggle', step }.
   - Ouvert seul : boutons et clavier (← → espace R). Adresse #4,2.5 : fige l'étape 4 à 2,5 s (contrôle du rendu). */
const GC = (() => {
  'use strict';
  const data = JSON.parse(document.getElementById('gc-anim').textContent);
  const embedded = window.parent !== window;
  const $ = (id) => document.getElementById(id);
  const scene = $('gc-scene'), titleEl = $('gc-title'), numEl = $('gc-num'), capEl = $('gc-caption-text'), bar = $('gc-progress');
  let steps = [], step = 0, t = 0, playing = true, frozen = false, last = null, drawnStep = -1, drawnT = -1;

  // Légendes : texte, gras, italique et retour à la ligne seulement
  const safe = (s) => String(s == null ? '' : s)
    .replace(/&(?!(amp|lt|gt|nbsp|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/&lt;(\/?)(b|i|br)\s*\/?&gt;/gi, '<$1$2>');

  function show() {
    const s = steps[step];
    numEl.textContent = (step + 1) + ' / ' + steps.length;
    titleEl.textContent = s.title;
    titleEl.style.color = s.color || '';
    capEl.innerHTML = safe(s.caption);
    capEl.style.color = s.captionColor || '';
    const play = $('gc-play');
    if (play) play.textContent = playing ? '⏸ Pause' : '▶ Lecture';
  }
  function go(i, force) {
    i = Math.max(0, Math.min(steps.length - 1, i | 0));
    if (i === step && !force) return;
    step = i; t = 0; playing = true; frozen = false; show(); render();
  }
  // Dessin immédiat, sans attendre l'image suivante : une page en arrière-plan n'en reçoit pas
  function render() {
    const s = steps[step];
    scene.innerHTML = s.draw(t);
    bar.style.width = (100 * t / s.dur) + '%';
    drawnStep = step; drawnT = t;
  }
  function frame(now) {
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    const s = steps[step];
    if (playing && !frozen) t = Math.min(s.dur, t + dt);
    if (step !== drawnStep || t !== drawnT) render();
    requestAnimationFrame(frame);
  }

  function play(scenes) {
    steps = (data.steps || []).map((d, i) => {
      const sc = (d.id && scenes[d.id]) || (Array.isArray(scenes) ? scenes[i] : null);
      if (!sc || d.hidden) return null;
      const draw = typeof sc === 'function' ? sc : sc.draw;
      return { title: d.title || '', caption: d.caption || '', color: d.color, captionColor: d.captionColor, dur: Math.max(0.1, d.dur || sc.dur || 6), draw };
    }).filter(Boolean);
    if (steps.length === 0) return;
    const seek = /^#(\d+)(?:,([\d.]+))?/.exec(location.hash || '');
    if (embedded || seek) document.documentElement.classList.add('gc-embedded');
    if (seek) { step = Math.max(0, Math.min(steps.length - 1, seek[1] - 1)); t = Math.min(steps[step].dur, parseFloat(seek[2] || '0')); frozen = true; }
    show();
    render();
    requestAnimationFrame(frame);
    if (embedded) window.parent.postMessage({ gc: 'anim', ev: 'ready', steps: steps.length }, '*');
  }

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.gc !== 'anim' || steps.length === 0) return;
    if (m.cmd === 'init') { if ((m.step | 0) !== step) go(m.step, true); }
    else if (m.cmd === 'goto') go(m.step, false);
    else if (m.cmd === 'replay') go(step, true);
    else if (m.cmd === 'pause') { playing = false; show(); }
    else if (m.cmd === 'play') { playing = true; show(); }
    else if (m.cmd === 'toggle') { playing = !playing; show(); }
  });

  // Ouvert seul : boutons et clavier
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  on('gc-prev', () => go(step - 1));
  on('gc-next', () => go(step + 1));
  on('gc-replay', () => go(step, true));
  on('gc-play', () => { if (t >= steps[step].dur) go(step, true); else { playing = !playing; show(); } });
  document.addEventListener('keydown', (e) => {
    if (embedded || steps.length === 0) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(step + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(step - 1);
    else if (e.key === ' ') { e.preventDefault(); playing = !playing; show(); }
    else if (e.key === 'r' || e.key === 'R') go(step, true);
  });

  return { play, data, embedded };
})();
