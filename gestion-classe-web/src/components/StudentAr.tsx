import { useCallback, useEffect, useRef, useState } from 'react';

// Réalité augmentée par reconnaissance d'image (MindAR + A-Frame).
//
// Les librairies pèsent ~5 Mo : elles ne sont PAS dans le bundle React. Elles sont
// servies depuis public/ar/vendor et chargées à la demande, uniquement quand
// l'élève ouvre cet onglet et lance la caméra. Le banc d'essai (public/ar-lab)
// partage exactement les mêmes fichiers.
//
// Un seul fichier .mind contient TOUTES les images reconnues : MindAR n'en charge
// qu'un par scène. L'ordre des cibles ci-dessous doit rester synchronisé avec
// SOURCES dans public/ar-lab/batch.html, qui produit ce fichier.

const BASE = import.meta.env.BASE_URL;
const TARGET_URL = `${BASE}ar/targets/targets.mind`;
const MODEL_URL = `${BASE}ar/models/demodex.glb`;
// Version allégée (81 Ko) : elle sert d'étalon sur les trois cibles microbiennes,
// où le détail du maillage complet n'apporterait rien.
const REF_MODEL_URL = `${BASE}ar/models/demodex-ref.glb`;
const DRACO_PATH = `${BASE}ar/vendor/draco/`;

const T = {
  card: '#2a2018',
  cardBorder: '#3a2e22',
  text: '#e8dcc8',
  textMuted: '#a09080',
  gold: '#d4a843',
  goldBright: '#e8c066',
  neg: '#f87171',
  pos: '#4ade80',
} as const;

// ── Mise en page commune sur l'image ────────────────────────────────────────
// L'image cible vaut 1 unité de large. Tout doit tenir dedans, sinon le contenu
// sort du champ dès que l'élève cadre l'image de près.
const LABEL_Y = 0.27;   // nom de l'organisme, en haut
const BAR_Y = -0.26;    // barre d'échelle, en bas
// Coordonnées et dimensions A-Frame : séparateur décimal POINT obligatoire.
// Une virgule y est lue comme une troncature à l'entier (0,196 → 0), ce qui
// donne des objets de taille nulle, donc invisibles.
const num = (v: number) => String(Math.round(v * 10000) / 10000);

// ── Modèles 3D générés en code ──────────────────────────────────────────────
// Pas de fichier à télécharger : des primitives A-Frame suffisent pour des formes
// aussi simples que des coques, un virion ou des levures. Seul le Demodex, dont
// la morphologie ne se réduit pas à des sphères, reste un .glb.

const sphere = (x: number, y: number, z: number, r: number, color: string, extra = '') =>
  `<a-sphere position="${num(x)} ${num(y)} ${num(z)}" radius="${num(r)}"
             material="color: ${color}; roughness: 0.45; metalness: 0.02" ${extra}></a-sphere>`;

// Amas de coques, en diamètres de coque : trois couches décalées, comme la grappe
// caractéristique des staphylocoques.
const STAPH_CLUSTER: [number, number, number][] = [
  [0, 0.5, 0], [0.9, 0.5, 0.2], [-0.9, 0.5, -0.1], [0.45, 0.5, 0.85],
  [-0.45, 0.5, -0.85], [0.4, 0.5, -0.8], [-0.5, 0.5, 0.8],
  [0.45, 1.35, 0.25], [-0.45, 1.35, 0.25], [0, 1.35, -0.6], [0.9, 1.35, -0.4],
  [0, 2.2, 0], [0.6, 2.2, 0.4],
];

function staphylocoque(u: number) {
  // u = unités de scène par µm ; une coque mesure 1 µm de diamètre.
  return STAPH_CLUSTER
    .map(([x, y, z]) => sphere(x * u, y * u, z * u, 0.5 * u, '#35c98f'))
    .join('\n');
}

function herpesvirus(u: number) {
  // Virion enveloppé de 0,2 µm : capside icosaédrique, enveloppe translucide,
  // spicules réparties sur la sphère (répartition de Fibonacci).
  const R = 0.1 * u;
  const spikes = Array.from({ length: 40 }, (_, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / 40);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    return sphere(
      R * Math.sin(phi) * Math.cos(theta),
      R * Math.cos(phi) + R,
      R * Math.sin(phi) * Math.sin(theta),
      0.008 * u, '#8d7fa8',
    );
  }).join('\n');

  return `
    <a-icosahedron position="0 ${num(R)} 0" radius="${num(0.05 * u)}" detail="0"
                   material="color: #4b4258; roughness: 0.5; flatShading: true"></a-icosahedron>
    <a-sphere position="0 ${num(R)} 0" radius="${num(R)}"
              material="color: #b9aecd; opacity: 0.32; transparent: true; side: double"></a-sphere>
    ${spikes}`;
}

function candida(u: number) {
  // Levures ovoïdes de 5 µm, chacune portant un bourgeon — la multiplication
  // par bourgeonnement est le trait à faire voir.
  const cells: [number, number, number, number][] = [
    [-2.6, 2.4, 0.4, 2.4], [2.4, 2.2, -0.8, 2.2], [0.2, 2.6, 1.6, 2.6],
  ];
  return cells.map(([x, y, z, r]) => {
    const cell = `<a-sphere position="${num(x * u)} ${num(y * u)} ${num(z * u)}" radius="${num(r * u)}"
                    scale="1 1.35 1"
                    material="color: #d9d0e4; roughness: 0.5; metalness: 0.02"></a-sphere>`;
    const bud = sphere((x + r * 0.9) * u, (y + r * 0.95) * u, z * u, r * 0.42 * u, '#e6d6e0');
    return cell + '\n' + bud;
  }).join('\n');
}

type TargetDef = {
  key: string;
  name: string;
  size: string;
  um?: number;              // taille réelle en µm (microbes seulement)
  ratio?: number;           // combien de fois plus petit que le Demodex
  build: () => string;      // contenu 3D, dressé sur l'image
  reference: () => string;  // repère de comparaison, à plat sur l'image
};

// ── Mise en regard avec le Demodex ──────────────────────────────────────────
// L'acarien domine l'image : c'est lui le géant de la série. Le microbe est
// montré à sa taille RÉELLE près de lui — un point minuscule, cerclé — puis
// repris en agrandissement à droite, comme sur une planche de SVT. Afficher les
// deux à la même taille laissait croire qu'ils sont comparables.
const REF_X = -0.25;      // Demodex étalon, à gauche
const REF_SIZE = 0.46;
const SPOT_X = 0.04;      // emplacement du microbe à l'échelle du Demodex
const SPOT_Y = 0.02;
const SPOT_R = 0.035;     // rayon du cercle qui signale ce point
const MICROBE_X = 0.32;   // agrandissement, à droite
const MICROBE_SIZE = 0.26;
const DEMODEX_UM = 300;   // 0,3 mm, l'étalon de toutes les comparaisons

const demodexReference = () => `
  <a-entity gltf-model="${REF_MODEL_URL}" position="${num(REF_X)} 0 0"
            fit-to-target="size: ${num(REF_SIZE)}"></a-entity>`;

// Segment tracé à plat sur l'image, entre deux points du plan.
function line2d(x1: number, y1: number, x2: number, y2: number, w = 0.006) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return `<a-box position="${num((x1 + x2) / 2)} ${num((y1 + y2) / 2)} 0.011"
                 rotation="0 0 ${num(angle)}"
                 width="${num(len)}" height="${num(w)}" depth="0.001"
                 material="color: #ffffff; opacity: 0.75; transparent: true"></a-box>`;
}

// Le microbe à sa taille réelle par rapport au Demodex affiché, le cercle qui
// le rend repérable, et les traits vers son agrandissement.
function magnifier(microbeUm: number) {
  const realR = (REF_SIZE / DEMODEX_UM) * microbeUm / 2;
  return `
    <a-circle position="${num(SPOT_X)} ${num(SPOT_Y)} 0.012" radius="${num(Math.max(realR, 0.0006))}"
              material="color: #ffe08a"></a-circle>
    <a-ring position="${num(SPOT_X)} ${num(SPOT_Y)} 0.011"
            radius-inner="${num(SPOT_R)}" radius-outer="${num(SPOT_R + 0.005)}"
            material="color: #ffe08a"></a-ring>
    ${line2d(SPOT_X + SPOT_R, SPOT_Y + SPOT_R * 0.7, MICROBE_X - MICROBE_SIZE / 2, SPOT_Y + MICROBE_SIZE / 2)}
    ${line2d(SPOT_X + SPOT_R, SPOT_Y - SPOT_R * 0.7, MICROBE_X - MICROBE_SIZE / 2, SPOT_Y - MICROBE_SIZE / 2)}`;
}

// Échelles de l'agrandissement, en unités de scène par µm : l'organisme y occupe
// MICROBE_SIZE, quelle que soit sa taille réelle.
const U_STAPH = MICROBE_SIZE / 2.8;   // amas d'environ 2,8 µm
const U_HERPES = MICROBE_SIZE / 0.2;  // virion de 0,2 µm
const U_CANDIDA = MICROBE_SIZE / 12;  // groupe d'environ 12 µm

// Demodex : le grain de sel (1 mm) sert d'étalon, c'est le seul organisme de
// taille comparable à un objet familier.
const DEMODEX_MM = 0.3;
const SALT_MM = 1;
const GAP = 0.06;
const SPAN = 0.9;
const MODEL_SIZE = (SPAN - GAP) / (1 + SALT_MM / DEMODEX_MM);
const SALT_SIZE = (SALT_MM / DEMODEX_MM) * MODEL_SIZE;
const MODEL_X = -SPAN / 2 + MODEL_SIZE / 2;
const SALT_X = SPAN / 2 - SALT_SIZE / 2;

const TARGETS: TargetDef[] = [
  {
    key: 'demodex',
    name: 'Demodex folliculorum',
    size: '≈ 0,3 mm',
    build: () => `<a-entity gltf-model="${MODEL_URL}" fit-to-target="size: ${num(MODEL_SIZE)}"></a-entity>`,
    reference: () => `
      <a-image src="${labelTexture('grain de sel', '≈ 1 mm')}"
               position="${num(SALT_X)} ${num(BAR_Y)} 0.011" width="0.5" height="0.155"
               material="transparent: true"></a-image>`,
  },
  {
    key: 'staphylocoque',
    name: 'Staphylocoque',
    size: '≈ 1 µm',
    um: 1,
    ratio: 300,
    build: () => staphylocoque(U_STAPH),
    reference: demodexReference,
  },
  {
    key: 'herpesvirus',
    name: 'Herpèsvirus',
    size: '≈ 0,15 µm',
    um: 0.15,
    ratio: 2000,
    build: () => herpesvirus(U_HERPES),
    reference: demodexReference,
  },
  {
    key: 'candida',
    name: 'Candida albicans',
    size: '≈ 5 µm',
    um: 5,
    ratio: 60,
    build: () => candida(U_CANDIDA),
    reference: demodexReference,
  },
];

// <a-text> télécharge sa police depuis cdn.aframe.io : inutilisable hors ligne
// et derrière le filtrage du collège. Les étiquettes sont donc dessinées dans
// un canvas et appliquées comme texture.
function labelTexture(title: string, subtitle: string): string {
  const W = 512, H = 160;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 12;
  if (title) {
    ctx.font = 'italic 46px Georgia, serif';
    ctx.fillText(title, W / 2, 62);
  }
  ctx.font = '600 44px system-ui, sans-serif';
  ctx.fillText(subtitle, W / 2, title ? 124 : 100);
  return c.toDataURL('image/png');
}

declare global {
  interface Window {
    AFRAME?: any;
    THREE?: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error(src)));
      }
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = false; // A-Frame doit être prêt avant MindAR
    el.addEventListener('load', () => { el.dataset.loaded = '1'; resolve(); });
    el.addEventListener('error', () => reject(new Error(src)));
    document.head.appendChild(el);
  });
}

let libsPromise: Promise<void> | null = null;
function loadLibs(): Promise<void> {
  if (!libsPromise) {
    libsPromise = (async () => {
      await loadScript(`${BASE}ar/vendor/aframe.min.js`);
      await loadScript(`${BASE}ar/vendor/mindar-image-aframe.prod.js`);
      registerFitComponent();
    })().catch((err) => {
      libsPromise = null; // permet une nouvelle tentative après un échec réseau
      throw err;
    });
  }
  return libsPromise;
}

// Matrice d'un nœud exprimée dans le repère d'un de ses ancêtres.
function localMatrix(node: any, root: any) {
  const THREE = window.THREE;
  const m = new THREE.Matrix4().identity();
  let cur = node;
  while (cur && cur !== root) {
    cur.updateMatrix();
    m.premultiply(cur.matrix);
    cur = cur.parent;
  }
  return m;
}

// Un .glb arrive dans une échelle arbitraire : sans normalisation il est soit
// invisible, soit gigantesque. On le ramène à la largeur voulue et on pose sa
// base sur le plan de l'image.
function registerFitComponent() {
  const AFRAME = window.AFRAME;
  if (!AFRAME || AFRAME.components['fit-to-target']) return;

  AFRAME.registerComponent('fit-to-target', {
    schema: { size: { default: 0.8 } },
    init(this: any) {
      this.el.addEventListener('model-loaded', () => {
        const THREE = window.THREE;
        const o = this.el.object3D;
        o.position.set(0, 0, 0);
        o.scale.setScalar(1);
        o.quaternion.identity();

        // Mesure dans le repère local : l'ancre MindAR n'a pas de matrice monde
        // exploitable tant que la cible n'est pas détectée.
        const box = new THREE.Box3();
        const tmp = new THREE.Box3();
        let meshCount = 0;
        o.traverse((n: any) => {
          if (!n.isMesh || !n.geometry) return;
          meshCount++;
          if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
          tmp.copy(n.geometry.boundingBox).applyMatrix4(localMatrix(n, o));
          box.union(tmp);
        });
        if (!meshCount || box.isEmpty()) return;

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const s = this.data.size / (Math.max(size.x, size.y, size.z) || 1);
        o.scale.setScalar(s);
        o.position.set(-center.x * s, -box.min.y * s, -center.z * s);
      });
    },
  });
}

// Une cible = son contenu 3D dressé sur l'image, son repère d'échelle et son
// étiquette, le tout dans un groupe commun que les gestes déplacent et zooment.
function targetMarkup(def: TargetDef, index: number) {
  const isDemodex = def.key === 'demodex';
  const objectX = isDemodex ? MODEL_X : MICROBE_X;

  // Bandeau du haut : le rapport de taille pour les microbes, sinon rien —
  // sur la cible Demodex, c'est le grain de sel qui porte la comparaison.
  const banner = def.ratio
    ? `<a-image src="${labelTexture(`${def.ratio} fois plus petit`, "qu'un Demodex")}"
                position="0 ${num(LABEL_Y)} 0.011" width="0.78" height="0.24"
                material="transparent: true"></a-image>`
    : '';

  // Étiquette de l'étalon, sous celui-ci, plus le repérage du microbe à sa
  // taille réelle et les traits vers son agrandissement.
  const refLabel = def.ratio
    ? `<a-image src="${labelTexture('Demodex', '≈ 0,3 mm')}"
                position="${num(REF_X)} ${num(BAR_Y)} 0.011" width="0.44" height="0.135"
                material="transparent: true"></a-image>
       ${magnifier(def.um ?? 1)}`
    : '';

  return `
    <a-entity id="t${index}" mindar-image-target="targetIndex: ${index}">
      <a-entity id="rig${index}">
        <a-entity rotation="90 0 0">
          <a-entity id="spin${index}" position="${num(objectX)} 0 0">
            ${def.build()}
          </a-entity>
          ${isDemodex ? `
            <a-box position="${num(SALT_X)} ${num(SALT_SIZE / 2)} 0"
                   width="${num(SALT_SIZE)}" height="${num(SALT_SIZE)}" depth="${num(SALT_SIZE)}"
                   material="color: #f2f2f2; roughness: 0.25; metalness: 0.05"></a-box>` : ''}
          ${def.ratio ? def.reference() : ''}
        </a-entity>
        ${banner}
        <a-image src="${labelTexture(def.name, def.size)}"
                 position="${num(objectX)} ${num(BAR_Y)} 0.011"
                 width="${def.ratio ? '0.44' : '0.6'}" height="${def.ratio ? '0.135' : '0.185'}"
                 material="transparent: true"></a-image>
        ${refLabel}
        ${isDemodex ? def.reference() : ''}
      </a-entity>
    </a-entity>`;
}

type Phase = 'idle' | 'loading' | 'active' | 'error';

export function StudentAr() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [foundName, setFoundName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const systemRef = useRef<any>(null);
  const spinRef = useRef<any>(null);
  const rigRef = useRef<any>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  // Gestes : un doigt fait tourner l'organisme, deux doigts déplacent et zooment
  // l'ensemble. Le zoom porte sur le groupe entier (objet + repère d'échelle) :
  // agrandir le seul objet fausserait la mesure annoncée.
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pts = pointers.current;
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId)!;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size === 1 && spinRef.current) {
      // ~un demi-tour par largeur d'écran balayée ; le glissement vertical
      // bascule l'objet pour en voir le dessus et le dessous.
      const rot = spinRef.current.object3D.rotation;
      rot.y += (dx / window.innerWidth) * Math.PI;
      rot.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rot.x + (dy / window.innerHeight) * Math.PI));
      return;
    }

    if (pts.size >= 2 && rigRef.current) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const last = pinch.current;
      if (last) {
        const rig = rigRef.current.object3D;
        const k = Math.min(6, Math.max(0.25, rig.scale.x * (dist / last.dist)));
        rig.scale.setScalar(k);
        // Déplacement dans le plan de l'image ; l'axe Y de la cible pointe vers
        // le haut de l'image, d'où l'inversion de dy.
        rig.position.x += ((cx - last.cx) / window.innerWidth) * 2;
        rig.position.y -= ((cy - last.cy) / window.innerWidth) * 2;
      }
      pinch.current = { dist, cx, cy };
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
  };

  const recenter = () => {
    const rig = rigRef.current?.object3D;
    if (rig) {
      rig.position.set(0, 0, 0);
      rig.scale.setScalar(1);
    }
    if (spinRef.current) spinRef.current.object3D.rotation.set(0, 0, 0);
  };

  const stop = useCallback(() => {
    try {
      systemRef.current?.stop();
    } catch {
      // le système peut déjà être arrêté
    }
    systemRef.current = null;
    spinRef.current = null;
    rigRef.current = null;
    if (containerRef.current) containerRef.current.innerHTML = '';
    // A-Frame bascule le document en plein écran : il faut le rendre à la page.
    document.documentElement.classList.remove('a-fullscreen');
    document.body.classList.remove('a-fullscreen');
    setFoundName(null);
    setPhase('idle');
  }, []);

  // Toujours relâcher la caméra si l'élève change d'onglet ou quitte la page.
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const head = await fetch(TARGET_URL, { method: 'HEAD' });
      if (!head.ok) throw new Error("Les images à reconnaître ne sont pas encore installées.");
      await loadLibs();
      // La scène est montée par l'effet ci-dessous, une fois le conteneur visible.
      setPhase('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lancer la réalité augmentée.');
      setPhase('error');
    }
  }, []);

  // A-Frame dimensionne son canvas à l'attachement : monter la scène dans un
  // conteneur encore masqué donnerait un rendu 0 × 0 — caméra visible, mais
  // aucun objet 3D dessiné.
  useEffect(() => {
    if (phase !== 'active') return;
    const container = containerRef.current;
    if (!container || container.childElementCount > 0) return;

    try {
      container.innerHTML = `
        <a-scene mindar-image="imageTargetSrc: ${TARGET_URL}; autoStart: false; uiScanning: no; uiLoading: no; uiError: no; filterMinCF: 0.0001; filterBeta: 0.001"
                 gltf-model="dracoDecoderPath: ${DRACO_PATH}"
                 color-space="sRGB" embedded renderer="colorManagement: true, physicallyCorrectLights"
                 vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
          <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
          <a-entity light="type: ambient; intensity: 1.2"></a-entity>
          <a-entity light="type: directional; intensity: 0.8" position="1 1 2"></a-entity>
          ${TARGETS.map(targetMarkup).join('\n')}
        </a-scene>`;

      const scene = container.querySelector('a-scene') as any;

      scene.addEventListener('renderstart', () => {
        scene.resize(); // garde-fou : le canvas doit couvrir tout le conteneur
        systemRef.current = scene.systems['mindar-image-system'];
        systemRef.current.start();
      });
      scene.addEventListener('arError', () => {
        setError("La caméra n'a pas pu démarrer. Vérifie l'autorisation dans ton navigateur.");
        stop();
        setPhase('error');
      });
      scene.addEventListener('model-error', () => {
        setError("Le modèle 3D n'a pas pu être chargé.");
      });

      TARGETS.forEach((def, i) => {
        const el = scene.querySelector(`#t${i}`);
        el.addEventListener('targetFound', () => {
          // Les gestes agissent sur la cible actuellement reconnue.
          rigRef.current = scene.querySelector(`#rig${i}`);
          spinRef.current = scene.querySelector(`#spin${i}`);
          setFoundName(def.name);
        });
        el.addEventListener('targetLost', () => setFoundName(null));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lancer la réalité augmentée.');
      setPhase('error');
    }
  }, [phase, stop]);

  return (
    <>
      {phase !== 'active' && (
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 16, padding: 24, textAlign: 'center', color: T.text,
        }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
          <h2 style={{ fontSize: 20, margin: '0 0 8px', color: T.goldBright, fontStyle: 'italic' }}>
            Réalité augmentée
          </h2>
          <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, margin: '0 0 20px' }}>
            Vise une image de ton cours avec la caméra : l'organisme apparaît en 3D,
            avec sa taille réelle.
          </p>

          {error && (
            <p style={{ fontSize: 13, color: T.neg, lineHeight: 1.5, margin: '0 0 16px' }}>{error}</p>
          )}

          <button
            onClick={start}
            disabled={phase === 'loading'}
            style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: T.gold, color: '#241a0c', fontSize: 15, fontWeight: 700,
              cursor: phase === 'loading' ? 'default' : 'pointer', opacity: phase === 'loading' ? 0.6 : 1,
            }}
          >
            {phase === 'loading' ? 'Chargement…' : '📷 Activer la caméra'}
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: 'fixed', inset: 0, zIndex: 50, background: '#000',
          display: phase === 'active' ? 'block' : 'none',
          touchAction: 'none', // sinon le glissement fait défiler la page
        }}
      />

      {phase === 'active' && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
        }}>
          <span style={{
            flex: 1, fontSize: 14, color: foundName ? T.pos : T.text, textShadow: '0 1px 4px #000',
          }}>
            {foundName ? `${foundName} · glisse pour tourner` : 'Vise une image de ton cours…'}
          </span>
          <button
            onClick={recenter}
            style={{
              padding: '10px 14px', borderRadius: 10, fontSize: 14,
              background: 'transparent', border: `1px solid ${T.cardBorder}`, color: T.text,
            }}
          >
            ⟳
          </button>
          <button
            onClick={stop}
            style={{
              padding: '10px 16px', borderRadius: 10, fontSize: 14,
              background: 'transparent', border: `1px solid ${T.cardBorder}`, color: T.text,
            }}
          >
            Fermer
          </button>
        </div>
      )}
    </>
  );
}
