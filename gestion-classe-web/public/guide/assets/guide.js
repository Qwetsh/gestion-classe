/*
 * Guide animé de Gestion Classe : moteur des fiches.
 *
 * Une fiche (section.fiche) associe une liste d'étapes (ol.etapes > li) à une scène (div.scene)
 * qui contient une maquette d'écran (div.ecran, dessinée à taille fixe puis mise à l'échelle).
 * À l'étape n (comptée à partir de 1), dans la scène :
 *   data-from="n"  / data-to="m"   visible de l'étape n à l'étape m (bornes incluses)
 *   data-at="2,4-6"                visible seulement à ces étapes
 *   data-on="2,4-6"                reçoit la classe .is-on à ces étapes (surbrillance, état enfoncé…)
 *   data-type="texte" data-type-at="n"   texte tapé lettre à lettre à l'étape n, affiché ensuite
 * Sur une étape (li) :
 *   data-cursor="sélecteur"        le pointeur (souris, ou doigt sur téléphone) va sur cet élément
 *   data-action="click|tap|long|drag"   geste joué une fois le pointeur arrivé
 *   data-drag-to="sélecteur"       pour drag : point d'arrivée
 *   data-duration="ms"             durée de l'étape (2800 par défaut)
 * La lecture démarre quand la fiche est à l'écran, boucle, et s'arrête si l'on clique une étape.
 * Avec « réduire les animations », rien ne défile seul : on avance avec les boutons.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEFAULT_MS = 2800;

  function parseSet(value) {
    var set = {};
    String(value || '').split(',').forEach(function (part) {
      part = part.trim();
      if (!part) return;
      var m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        for (var i = +m[1]; i <= +m[2]; i++) set[i] = true;
      } else {
        set[+part] = true;
      }
    });
    return set;
  }

  /* ------------------------------------------------------------------ mise à l'échelle */
  function fitScreens(root) {
    var screens = (root || document).querySelectorAll('.ecran');
    function fit(screen) {
      var frame = screen.parentElement;
      var w = +screen.dataset.w || screen.offsetWidth;
      var h = +screen.dataset.h || screen.offsetHeight;
      var avail = frame.clientWidth;
      var k = Math.min(1, avail / w);
      screen.style.width = w + 'px';
      screen.style.height = h + 'px';
      screen.style.transform = 'scale(' + k + ')';
      frame.style.height = Math.ceil(h * k) + 'px';
      screen.dataset.k = k;
    }
    Array.prototype.forEach.call(screens, function (screen) {
      fit(screen);
      if (window.ResizeObserver) {
        new ResizeObserver(function () { fit(screen); }).observe(screen.parentElement);
      }
    });
  }

  /* ------------------------------------------------------------------ texte tapé */
  function typeText(el, full, total) {
    var token = (el._typeToken || 0) + 1;
    el._typeToken = token;
    el.textContent = '';
    var per = Math.max(35, Math.min(90, (total || 1200) / Math.max(1, full.length)));
    var i = 0;
    (function next() {
      if (el._typeToken !== token) return;
      el.textContent = full.slice(0, ++i);
      if (i < full.length) setTimeout(next, per);
    })();
  }

  /* ------------------------------------------------------------------ une fiche */
  function Fiche(el) {
    this.el = el;
    this.steps = Array.prototype.slice.call(el.querySelectorAll('.etapes > li'));
    this.scene = el.querySelector('.scene');
    this.screen = this.scene ? this.scene.querySelector('.ecran') : null;
    if (!this.steps.length || !this.screen) return;
    this.index = 0;
    this.playing = !reduceMotion;
    this.visible = false;
    this.timer = null;
    this.moveTimer = null;

    var touch = this.scene.classList.contains('scene--tel') || this.scene.classList.contains('scene--eleve');
    this.pointer = document.createElement('div');
    this.pointer.className = 'pointeur' + (touch ? ' pointeur--doigt' : '');
    this.pointer.setAttribute('aria-hidden', 'true');
    this.screen.appendChild(this.pointer);

    this.buildControls();
    var self = this;
    this.steps.forEach(function (li, k) {
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.addEventListener('click', function () { self.pause(); self.go(k, true); });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.pause(); self.go(k, true); }
      });
    });
    this.apply(0, false);
  }

  Fiche.prototype.buildControls = function () {
    var self = this;
    var bar = document.createElement('div');
    bar.className = 'commandes';
    bar.innerHTML =
      '<button type="button" class="commandes__b" data-c="prev" aria-label="Étape précédente">◀</button>' +
      '<button type="button" class="commandes__b commandes__lecture" data-c="play" aria-label="Lecture ou pause"><span class="ic"></span></button>' +
      '<button type="button" class="commandes__b" data-c="next" aria-label="Étape suivante">▶</button>' +
      '<button type="button" class="commandes__b" data-c="restart" aria-label="Revoir depuis le début">↺</button>' +
      '<span class="commandes__n" aria-live="polite"></span>' +
      '<span class="commandes__barre"><span></span></span>';
    this.scene.appendChild(bar);
    this.counter = bar.querySelector('.commandes__n');
    this.progress = bar.querySelector('.commandes__barre > span');
    this.playBtn = bar.querySelector('[data-c=play]');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var c = b.dataset.c;
      if (c === 'prev') { self.pause(); self.go(self.index - 1, true); }
      if (c === 'next') { self.pause(); self.go(self.index + 1, true); }
      if (c === 'restart') { self.playing = true; self.go(0, true); }
      if (c === 'play') { if (self.playing) self.pause(); else { self.playing = true; self.go(self.index + 1 >= self.steps.length ? 0 : self.index + 1, true); } }
      self.syncPlay();
    });
    this.syncPlay();
  };

  Fiche.prototype.syncPlay = function () {
    this.playBtn.classList.toggle('is-playing', this.playing);
    this.playBtn.setAttribute('aria-pressed', this.playing ? 'true' : 'false');
  };

  Fiche.prototype.pause = function () {
    this.playing = false;
    clearTimeout(this.timer);
    this.syncPlay();
  };

  Fiche.prototype.setVisible = function (v) {
    this.visible = v;
    if (v && this.playing) this.schedule();
    if (!v) clearTimeout(this.timer);
  };

  Fiche.prototype.go = function (k, animate) {
    var n = this.steps.length;
    this.index = ((k % n) + n) % n;
    this.apply(this.index, animate);
    this.schedule();
  };

  Fiche.prototype.schedule = function () {
    clearTimeout(this.timer);
    if (!this.playing || !this.visible) return;
    var self = this;
    var li = this.steps[this.index];
    var ms = +li.dataset.duration || DEFAULT_MS;
    if (this.index === this.steps.length - 1) ms += 1600;
    this.timer = setTimeout(function () { self.go(self.index + 1, true); }, ms);
  };

  Fiche.prototype.apply = function (k, animate) {
    var n = k + 1;
    var scene = this.scene;
    this.steps.forEach(function (li, j) {
      li.classList.toggle('is-current', j === k);
      li.classList.toggle('is-done', j < k);
    });

    Array.prototype.forEach.call(scene.querySelectorAll('[data-from],[data-to],[data-at]'), function (e) {
      var visible;
      if (e.dataset.at) {
        visible = !!parseSet(e.dataset.at)[n];
      } else {
        var from = e.dataset.from ? +e.dataset.from : 1;
        var to = e.dataset.to ? +e.dataset.to : 9999;
        visible = n >= from && n <= to;
      }
      e.classList.toggle('is-hidden', !visible);
    });

    Array.prototype.forEach.call(scene.querySelectorAll('[data-on]'), function (e) {
      e.classList.toggle('is-on', !!parseSet(e.dataset.on)[n]);
    });

    var li = this.steps[k];
    var ms = +li.dataset.duration || DEFAULT_MS;
    Array.prototype.forEach.call(scene.querySelectorAll('[data-type-at]'), function (e) {
      var at = +e.dataset.typeAt;
      var full = e.dataset.type || '';
      if (n < at) { e._typeToken = (e._typeToken || 0) + 1; e.textContent = ''; }
      else if (n === at && animate && !reduceMotion) typeText(e, full, ms * 0.55);
      else { e._typeToken = (e._typeToken || 0) + 1; e.textContent = full; }
    });

    this.counter.textContent = n + ' / ' + this.steps.length;
    var bar = this.progress;
    bar.style.transition = 'none';
    bar.style.width = (k / this.steps.length * 100) + '%';
    if (this.playing && this.visible && !reduceMotion) {
      void bar.offsetWidth;
      bar.style.transition = 'width ' + ms + 'ms linear';
      bar.style.width = (n / this.steps.length * 100) + '%';
    } else {
      bar.style.width = (n / this.steps.length * 100) + '%';
    }

    this.movePointer(li, animate);
  };

  Fiche.prototype.pointAt = function (target) {
    var screen = this.screen;
    var k = +screen.dataset.k || 1;
    var s = screen.getBoundingClientRect();
    var r = target.getBoundingClientRect();
    return {
      x: (r.left - s.left + r.width / 2) / k,
      y: (r.top - s.top + r.height / 2) / k
    };
  };

  Fiche.prototype.movePointer = function (li, animate) {
    var p = this.pointer;
    var self = this;
    clearTimeout(this.moveTimer);
    p.classList.remove('is-click', 'is-long');
    var sel = li.dataset.cursor;
    var target = sel ? this.screen.querySelector(sel) : null;
    if (!target) { p.classList.add('is-away'); return; }
    // laisser la scène se mettre en place (éléments qui apparaissent) avant de viser
    requestAnimationFrame(function () {
      var pt = self.pointAt(target);
      p.classList.remove('is-away');
      p.style.transitionDuration = (animate && !reduceMotion) ? '' : '0s';
      p.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px)';
      var action = li.dataset.action;
      if (!action) return;
      var delay = (animate && !reduceMotion) ? 750 : 0;
      self.moveTimer = setTimeout(function () {
        if (action === 'drag' && li.dataset.dragTo) {
          var to = self.screen.querySelector(li.dataset.dragTo);
          if (!to) return;
          p.classList.add('is-hold');
          var pt2 = self.pointAt(to);
          p.style.transitionDuration = (animate && !reduceMotion) ? '900ms' : '0s';
          p.style.transform = 'translate(' + pt2.x + 'px,' + pt2.y + 'px)';
          self.moveTimer = setTimeout(function () { p.classList.remove('is-hold'); p.style.transitionDuration = ''; }, 950);
          return;
        }
        void p.offsetWidth;
        p.classList.add(action === 'long' ? 'is-long' : 'is-click');
      }, delay);
    });
  };

  /* ------------------------------------------------------------------ démarrage */
  function start() {
    fitScreens(document);
    var fiches = [];
    Array.prototype.forEach.call(document.querySelectorAll('.fiche'), function (el) {
      var f = new Fiche(el);
      if (f.steps && f.steps.length && f.screen) fiches.push(f);
    });
    // ?fige=3 : toutes les fiches arrêtées à l'étape 3 (relecture, captures d'écran)
    var fige = /[?&]fige=(\d+)/.exec(location.search);
    if (fige) {
      document.documentElement.classList.add('fige');
      fiches.forEach(function (f) {
        f.playing = false;
        f.syncPlay();
        f.go(Math.min(+fige[1], f.steps.length) - 1, false);
      });
      return;
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var f = en.target._fiche;
          if (f) f.setVisible(en.isIntersecting);
        });
      }, { threshold: 0.35 });
      fiches.forEach(function (f) { f.el._fiche = f; io.observe(f.scene); f.scene._fiche = f; });
    } else {
      fiches.forEach(function (f) { f.setVisible(true); });
    }
    // recalcul du pointeur après une mise à l'échelle
    window.addEventListener('resize', function () {
      fiches.forEach(function (f) { f.movePointer(f.steps[f.index], false); });
    });

    // sommaire de la page : section en cours surlignée
    var liens = document.querySelectorAll('.toc a[href^="#"]');
    if (liens.length && 'IntersectionObserver' in window) {
      var byId = {};
      Array.prototype.forEach.call(liens, function (a) { byId[a.getAttribute('href').slice(1)] = a; });
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var a = byId[en.target.id];
          if (a && en.isIntersecting) {
            Array.prototype.forEach.call(liens, function (x) { x.classList.remove('is-current'); });
            a.classList.add('is-current');
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      Array.prototype.forEach.call(document.querySelectorAll('.fiche[id]'), function (s) { io2.observe(s); });
    }

    // filtre du sommaire général
    var filtre = document.querySelector('[data-filtre]');
    if (filtre) {
      filtre.addEventListener('input', function () {
        var q = filtre.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        Array.prototype.forEach.call(document.querySelectorAll('[data-cherche]'), function (item) {
          var t = (item.textContent + ' ' + (item.dataset.cherche || '')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          item.classList.toggle('is-filtered', q && t.indexOf(q) === -1);
        });
        Array.prototype.forEach.call(document.querySelectorAll('.partie'), function (p) {
          var any = p.querySelector('[data-cherche]:not(.is-filtered)');
          p.classList.toggle('is-filtered', !any);
        });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
