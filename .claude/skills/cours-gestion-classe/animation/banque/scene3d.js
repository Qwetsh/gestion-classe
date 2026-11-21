/* Banque « scene3d » : une scène 3D (three.js) sous les étiquettes SVG de l'animation.
   Demande la bibliothèque three : assembler(..., bibliotheques=['three'], banques=['scene3d']).

   const s3d = S3D.create({ fond: '#F4F7FB' });                 // rendu, caméra, lumières, rotation à la souris
   const patient = await s3d.load('patient.glb');                // fichier joint (assets), décodé (meshopt)
   const box = s3d.fit(patient.root);                            // cadre le modèle ; box.at(0.5, 0.92, 0.5) = un point du modèle
   GC.play({
     vue: { dur: 6, live: true,
       update(t) { s3d.view(t, [{ t: 0, pos: [0, 1, 4], target: [0, 1, 0] }, { t: 2, pos: [0, 1.6, 1.2], target: box.at(.5, .9, .5) }]); },
       draw(t) { const p = s3d.toStage(box.at(.5, .92, .5)); return txt(p.x + 40, p.y, 'Fièvre : 39,5 °C', 30, ROUGE, 'start', 700, seg(t, 1.5, 2.2)); } },
   });

   Tout ce qui bouge dépend de t (caméra, poses) : une étape se rejoue à l'identique et se photographie
   figée (#4,2.5). Après la dernière image-clé, la caméra est libre : on peut faire tourner le modèle
   (objet « interactive » du tableau). */
const S3D = (() => {
  'use strict';
  const v3 = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));

  function create(opts = {}) {
    const host = document.getElementById('gc-3d');
    const stage = document.getElementById('gc-stage');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposition ?? 1;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    if (opts.fond !== null) scene.background = new THREE.Color(opts.fond ?? '#F4F7FB');
    const camera = new THREE.PerspectiveCamera(opts.champ ?? 35, 1, 0.01, 200);
    camera.position.set(0, 1.2, 4);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight('#ffffff', '#b8c4d6', 0.6));
    const sun = new THREE.DirectionalLight('#ffffff', 1.4);
    sun.position.set(2, 4, 3);
    scene.add(sun);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    const clock = new THREE.Clock();
    const mixers = [];
    const pulses = [];

    function resize() {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(host);
    resize();

    function render() { renderer.render(scene, camera); }
    (function loop() {
      clock.getDelta();
      for (const p of pulses) p.tick(clock.elapsedTime);
      controls.update();
      render();
      requestAnimationFrame(loop);
    })();

    /** Fichier GLB joint → { root, gltf, clips } ; le modèle est ajouté à la scène. */
    async function load(name, { ajouter = true } = {}) {
      const file = await gcAsset(name);
      const loader = new THREE.GLTFLoader();
      loader.setMeshoptDecoder(THREE.MeshoptDecoder);
      const gltf = await new Promise((ok, ko) => loader.parse(file.buffer, '', ok, ko));
      const root = gltf.scene;
      if (ajouter) scene.add(root);
      const mixer = gltf.animations.length ? new THREE.AnimationMixer(root) : null;
      if (mixer) mixers.push(mixer);
      return { root, gltf, mixer, clips: gltf.animations.map((c) => c.name) };
    }

    /** Boîte d'un objet ; at(fx, fy, fz) donne le point aux fractions (0…1) de la boîte (tête ≈ at(.5, .93, .5)). */
    function box(object) {
      const b = new THREE.Box3().setFromObject(object);
      const size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3());
      return { box: b, size, center, at: (fx, fy, fz) => new THREE.Vector3(b.min.x + size.x * fx, b.min.y + size.y * fy, b.min.z + size.z * fz) };
    }

    /** Cadre l'objet de face, à `marge` près ; rend sa boîte. */
    function fit(object, { marge = 1.25, hauteur = 0.55, cote = 0 } = {}) {
      const b = box(object);
      const radius = b.size.length() / 2;
      const dist = (radius * marge) / Math.sin((camera.fov * Math.PI) / 360);
      const target = b.at(0.5, hauteur, 0.5);
      camera.position.set(target.x + Math.sin(cote) * dist, target.y, target.z + Math.cos(cote) * dist);
      controls.target.copy(target);
      camera.near = dist / 100; camera.far = dist * 20; camera.updateProjectionMatrix();
      return b;
    }

    /**
     * Caméra à l'instant t le long d'images-clés [{ t, pos, target }] (lissées). Une fois la dernière
     * passée, la caméra n'est plus commandée : on peut faire tourner le modèle.
     */
    function view(t, K) {
      const end = K[K.length - 1].t;
      if (K.__done && t >= end) return;
      let a = K[0], b = K[0], p = 0;
      if (t >= end) a = b = K[K.length - 1];
      else for (let i = 1; i < K.length; i++) if (t <= K[i].t) { a = K[i - 1]; b = K[i]; p = ease((t - a.t) / Math.max(1e-6, b.t - a.t)); break; }
      camera.position.copy(v3(a.pos).lerp(v3(b.pos), p));
      controls.target.copy(v3(a.target).lerp(v3(b.target), p));
      camera.lookAt(controls.target);
      K.__done = t >= end;
    }

    /** Pose d'une animation du modèle à l'instant t (secondes dans le clip ; boucle si `boucle`). */
    function pose(model, clipName, t, { boucle = true } = {}) {
      if (!model.mixer) return;
      const clip = THREE.AnimationClip.findByName(model.gltf.animations, clipName) || model.gltf.animations[0];
      const action = model.mixer.clipAction(clip);
      if (!action.isRunning()) { model.mixer.stopAllAction(); action.play(); }
      const time = boucle ? t % clip.duration : Math.min(t, clip.duration);
      model.mixer.setTime(time);
    }

    /** Point 3D → coordonnées de la scène SVG (pour une étiquette ou une flèche qui suit le modèle). */
    function toStage(point) {
      const p = v3(point).project(camera);
      const r = host.getBoundingClientRect();
      const pt = stage.createSVGPoint();
      pt.x = r.left + ((p.x + 1) / 2) * r.width;
      pt.y = r.top + ((1 - p.y) / 2) * r.height;
      const m = stage.getScreenCTM();
      const q = m ? pt.matrixTransform(m.inverse()) : pt;
      return { x: q.x, y: q.y, visible: p.z < 1 };
    }

    /** Fait luire les maillages choisis (predicat(mesh) → vrai), en rythme ; rend une fonction pour arrêter. */
    function glow(object, predicat, couleur = '#FF3B30', force = 0.9) {
      const meshes = [];
      object.traverse((o) => { if (o.isMesh && predicat(o)) meshes.push(o); });
      const saved = meshes.map((m) => { m.material = m.material.clone(); return [m, m.material.emissive?.clone(), m.material.emissiveIntensity]; });
      const col = new THREE.Color(couleur);
      const pulse = { tick: (time) => { const k = force * (0.55 + 0.45 * Math.sin(time * 4)); for (const [m] of saved) if (m.material.emissive) { m.material.emissive.copy(col); m.material.emissiveIntensity = k; } } };
      pulses.push(pulse);
      return () => { pulses.splice(pulses.indexOf(pulse), 1); for (const [m, e, i] of saved) if (m.material.emissive && e) { m.material.emissive.copy(e); m.material.emissiveIntensity = i; } };
    }

    /** Sphère lumineuse posée sur un point du modèle (repère d'un symptôme) ; rend l'objet three. */
    function spot(point, { couleur = '#FF3B30', rayon = 0.04 } = {}) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rayon, 24, 16), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.85 }));
      m.position.copy(v3(point));
      scene.add(m);
      return m;
    }

    return { THREE, renderer, scene, camera, controls, load, box, fit, view, pose, toStage, glow, spot, render };
  }

  return { create };
})();
