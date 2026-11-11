/* Ma Réception — mode travaux : rendu 3D soigné d'une chambre, avec la bibliothèque libre three.js (licence MIT, dossier vendor/three).
   Matières réalistes, lumière du jour qui entre par la fenêtre, ombres douces, reflets sur le sol, meubles aux arêtes adoucies.
   Effets de jeu vidéo par-dessus : ombres de contact dans les angles (occlusion ambiante), halo des lumières, léger étalonnage,
   rideaux plissés, plante, ambiance du jour ou du soir.
   Chargé à la demande par travaux3d.js, qui garde son propre dessin simple en secours si ce fichier ne peut pas se charger. */
import * as THREE from './vendor/three/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { EffectComposer } from './vendor/three/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/postprocessing/RenderPass.js';
import { GTAOPass } from './vendor/three/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from './vendor/three/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/postprocessing/OutputPass.js';
import { ShaderPass } from './vendor/three/postprocessing/ShaderPass.js';

const col = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
const rnd = (a, b) => a + Math.random() * (b - a);
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// Parquet : 8 lames de 13 cm sur la largeur de l'image (1,04 m), 2,08 m de long, avec des teintes et des joints qui varient.
const planks = () => canvasTex(512, 1024, (x, w, h) => {
  const pw = w / 8;
  for (let i = 0; i < 8; i++) {
    let y = -rnd(0, 400);
    while (y < h) {
      const len = rnd(300, 620), g = Math.round(rnd(222, 255));
      x.fillStyle = `rgb(${g},${g},${g})`; x.fillRect(i * pw, y, pw, len);
      for (let k = 0; k < 26; k++) { x.strokeStyle = `rgba(${rnd(0, 1) > 0.5 ? 255 : 60},${rnd(0, 1) > 0.5 ? 255 : 60},60,${rnd(0.015, 0.05)})`; x.lineWidth = rnd(0.6, 2.2); const gx = i * pw + rnd(2, pw - 2); x.beginPath(); x.moveTo(gx, y); x.bezierCurveTo(gx + rnd(-4, 4), y + len * 0.3, gx + rnd(-4, 4), y + len * 0.7, gx + rnd(-3, 3), y + len); x.stroke(); }
      x.fillStyle = 'rgba(40,28,18,0.55)'; x.fillRect(i * pw, y + len - 1.5, pw, 1.5);
      y += len;
    }
    x.fillStyle = 'rgba(40,28,18,0.5)'; x.fillRect(i * pw - 0.8, 0, 1.6, h);
  }
});
const tiles = () => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 500; k++) { x.fillStyle = `rgba(${rnd(0, 1) > 0.5 ? 255 : 120},${rnd(0, 1) > 0.5 ? 255 : 120},120,0.035)`; x.fillRect(rnd(0, w), rnd(0, h), rnd(2, 14), rnd(2, 14)); }
  x.fillStyle = 'rgba(120,118,112,0.85)'; x.fillRect(0, 0, w, 3); x.fillRect(0, 0, 3, h);
});
const woodGrain = () => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#ededed'; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 90; k++) { x.strokeStyle = `rgba(${rnd(0, 1) > 0.45 ? 70 : 255},${rnd(0, 1) > 0.45 ? 60 : 255},50,${rnd(0.03, 0.10)})`; x.lineWidth = rnd(0.5, 2.5); const gy = rnd(0, h); x.beginPath(); x.moveTo(0, gy); x.bezierCurveTo(w * 0.3, gy + rnd(-5, 5), w * 0.7, gy + rnd(-5, 5), w, gy + rnd(-3, 3)); x.stroke(); }
});
const weave = () => canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#f6f6f6'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 2) for (let j = 0; j < h; j += 2) { const g = Math.round(rnd(238, 255)); x.fillStyle = `rgb(${g},${g},${g})`; x.fillRect(i, j, 2, 2); }
});

const sky = (a, b) => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256; const x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
// Dernière passe : un peu de contraste et de couleur, et les bords de l'image légèrement assombris, comme dans un jeu.
const GRADE = {
  uniforms: { tDiffuse: { value: null }, vig: { value: 0.2 }, sat: { value: 1.08 }, con: { value: 1.05 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: 'uniform sampler2D tDiffuse;uniform float vig;uniform float sat;uniform float con;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(0.2126,0.7152,0.0722));c.rgb=mix(vec3(l),c.rgb,sat);c.rgb=(c.rgb-0.5)*con+0.5;vec2 q=vUv-0.5;c.rgb*=1.0-vig*smoothstep(0.12,0.5,dot(q,q));gl_FragColor=vec4(clamp(c.rgb,0.0,1.0),1.0);}',
};

export function trRendu(o) {
  const { canvas, sc, cam } = o;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer), envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture; scene.environmentIntensity = 0.5;
  const trash = [envRT.texture, pmrem];

  /* ----- matières ----- */
  const T = { wood: woodGrain(), weave: weave() }; trash.push(T.wood, T.weave);
  T.weave.repeat.set(18, 18);
  const mats = new Map();
  // Abat-jour et vitres : leur éclat change entre le jour et le soir (réglé à chaque image).
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), skyMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); trash.push(lampMat, skyMat);
  const isMetal = (c) => Math.abs(c[0] - 0.72) < 0.01 && Math.abs(c[1] - 0.72) < 0.01 && Math.abs(c[2] - 0.75) < 0.01;
  function matFor(b) {
    const key = b.k + '|' + b.c.join(',') + (b.lamp ? 'L' : '');
    if (mats.has(key)) return mats.get(key);
    let m;
    if (b.k === 6) return b.lamp ? lampMat : skyMat;
    else if (b.k === 3) m = new THREE.MeshStandardMaterial({ color: col(b.c), map: T.wood, roughness: 0.52, metalness: 0 });
    else if (b.k === 4) m = new THREE.MeshStandardMaterial({ color: col(b.c), map: T.weave, roughness: 0.97, metalness: 0 });
    else if (b.k === 5) m = new THREE.MeshStandardMaterial({ color: col(b.c), roughness: 0.94, metalness: 0 });
    else if (isMetal(b.c)) m = new THREE.MeshStandardMaterial({ color: col(b.c), roughness: 0.28, metalness: 0.9 });
    else m = new THREE.MeshStandardMaterial({ color: col(b.c), roughness: b.c[0] < 0.3 ? 0.35 : 0.62, metalness: 0 });
    mats.set(key, m); trash.push(m); return m;
  }
  const geos = [];
  function mesh(b, opts) {
    const [sx, sy, sz] = b.s, mn = Math.min(sx, sy, sz); let g;
    const r = opts && opts.sharp ? 0 : (b.soft ? mn * 0.49 : (b.k === 4 ? Math.min(0.03, mn * 0.42) : (b.k === 3 || b.k === 0 ? Math.min(0.007, mn * 0.3) : 0)));
    if (b.lamp) g = new THREE.CylinderGeometry(sx * 0.36, sx * 0.52, sy, 28, 1, true); // abat-jour
    else g = r > 0.002 ? new RoundedBoxGeometry(sx, sy, sz, b.soft ? 7 : (b.k === 4 ? 4 : 2), r) : new THREE.BoxGeometry(sx, sy, sz);
    geos.push(g);
    const m = new THREE.Mesh(g, (opts && opts.mat) || matFor(b)); m.position.set(b.t[0], b.t[1], b.t[2]);
    m.castShadow = !!(opts && opts.cast); m.receiveShadow = b.k !== 6; return m;
  }
  const caster = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); trash.push(caster);
  const noAO = []; // ce qui ne doit pas compter dans les ombres de contact : doubles invisibles, verre, voilages
  const ghost = (t, s) => { const g = new THREE.BoxGeometry(s[0], s[1], s[2]); geos.push(g); const m = new THREE.Mesh(g, caster); m.position.set(t[0], t[1], t[2]); m.castShadow = true; scene.add(m); noAO.push(m); };
  // Un rideau : une vraie surface plissée, plus serrée en haut (là où il est accroché) qu'en bas.
  function curtain(cu, mat, amp) {
    const along = cu.s[0] > cu.s[2] ? 0 : 2, L = cu.s[along], hh = cu.s[1], g = new THREE.PlaneGeometry(L, hh, Math.max(32, Math.round(L * 110)), 12), pos = g.attributes.position, folds = Math.max(3, Math.round(L / 0.105));
    for (let i = 0; i < pos.count; i++) { const u = pos.getX(i) / L + 0.5, v = pos.getY(i) / hh + 0.5, a = amp * (0.5 + 0.5 * (1 - v)); pos.setZ(i, Math.sin(u * folds * 6.2832 + Math.sin(v * 2.6) * 0.5) * a + Math.sin(u * folds * 2.3 + 1.3) * a * 0.4); }
    g.computeVertexNormals(); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.set(cu.t[0], cu.t[1], cu.t[2]); if (along === 2) m.rotation.y = Math.PI / 2; return m;
  }

  /* ----- sol ----- */
  const f0 = sc.B[0], fk = f0.k;
  let fmat;
  if (fk === 1) { const t = planks(); t.repeat.set(f0.s[0] / 1.04, f0.s[2] / 2.08); trash.push(t); fmat = new THREE.MeshStandardMaterial({ color: col(f0.c), map: t, roughness: 0.36, metalness: 0 }); }
  else if (fk === 2) { const t = tiles(); t.repeat.set(f0.s[0] / 0.6, f0.s[2] / 0.6); trash.push(t); fmat = new THREE.MeshStandardMaterial({ color: col(f0.c), map: t, roughness: 0.22, metalness: 0 }); }
  else { const t = weave(); t.repeat.set(f0.s[0] * 14, f0.s[2] * 14); trash.push(t); fmat = new THREE.MeshStandardMaterial({ color: col(f0.c), map: t, roughness: 1, metalness: 0 }); }
  trash.push(fmat);
  { const g = new THREE.PlaneGeometry(f0.s[0], f0.s[2]); geos.push(g); const m = new THREE.Mesh(g, fmat); m.rotation.x = -Math.PI / 2; m.position.set(f0.t[0], 0, f0.t[2]); m.receiveShadow = true; scene.add(m); }

  /* ----- murs : celui de la fenêtre est percé, pour que le jour entre vraiment ----- */
  const wallGroups = sc.walls.map((wl, i) => {
    const grp = new THREE.Group(), body = wl.boxes[0], along = i % 2 ? 2 : 0, parts = [];
    if (sc.win && sc.win.wall === i) {
      const L = (i % 2 ? sc.Dc : sc.Wc) / 100, c = sc.win.pos / 100 - L / 2, hw = sc.win.w / 200, y0 = sc.win.z0 / 100, y1 = sc.win.z1 / 100, lo = body.t[along] - body.s[along] / 2, hi = body.t[along] + body.s[along] / 2;
      const part = (a0, a1, b0, b1) => { if (a1 - a0 < 0.005 || b1 - b0 < 0.005) return; const t = [...body.t], s = [...body.s]; t[along] = (a0 + a1) / 2; s[along] = a1 - a0; t[1] = (b0 + b1) / 2; s[1] = b1 - b0; parts.push({ t, s, c: body.c, k: 5 }); };
      part(lo, c - hw, 0, sc.H); part(c + hw, hi, 0, sc.H); part(c - hw, c + hw, 0, y0); part(c - hw, c + hw, y1, sc.H);
    } else parts.push(body);
    parts.forEach((b) => { grp.add(mesh(b, { sharp: true })); ghost(b.t, b.s); });
    for (let j = 1; j < wl.boxes.length; j++) { const b = wl.boxes[j]; if (b.cur) continue; grp.add(mesh(b, { cast: b.k === 4 || b.k === 3 })); }
    (wl.curt || []).forEach((cu) => { const cm = new THREE.MeshStandardMaterial({ color: col(cu.c), map: T.weave, roughness: 0.96, metalness: 0, side: THREE.DoubleSide }); trash.push(cm); const m = curtain(cu, cm, 0.034); m.castShadow = true; m.receiveShadow = true; grp.add(m); });
    const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1, depthWrite: false, side: THREE.DoubleSide }); trash.push(gm);
    wl.glass.forEach((b) => { const m = curtain(b, gm, 0.018); m.position.x -= wl.n[0] * 0.055; m.position.z -= wl.n[1] * 0.055; grp.add(m); noAO.push(m); }); // le voilage pend devant la vitre, pas dedans
    scene.add(grp); return grp;
  });
  ghost(sc.ceil.t, sc.ceil.s);
  const ceilMat = new THREE.MeshBasicMaterial({ color: 0xe9e8e4 }); trash.push(ceilMat);
  const ceil = mesh(sc.ceil, { mat: ceilMat, sharp: true }); ceil.visible = false; scene.add(ceil);
  // Plafonnier : un disque lumineux au milieu du plafond.
  const plafMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); trash.push(plafMat);
  const plaf = (() => { const g = new THREE.CylinderGeometry(0.19, 0.21, 0.05, 36); geos.push(g); const m = new THREE.Mesh(g, plafMat); m.position.set(0, sc.H - 0.026, 0); m.visible = false; scene.add(m); return m; })();
  /* ----- meubles ----- */
  const lamps = [];
  for (let i = 1; i < sc.B.length; i++) { const b = sc.B[i]; scene.add(mesh(b, { cast: !!b.cast && b.k !== 6 })); if (b.lamp) lamps.push(b.t); }
  const lampL = lamps.slice(0, 4).map((t) => { const l = new THREE.PointLight(0xffc988, 0.55, 3.4, 2); l.position.set(t[0], t[1] - 0.02, t[2]); scene.add(l); return l; });
  /* ----- plante verte ----- */
  (sc.plants || []).forEach(([px, pz]) => {
    let sd = 7; const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const add = (g, m, x, y, z, cast) => { geos.push(g); const me = new THREE.Mesh(g, m); me.position.set(px + x, y, pz + z); me.castShadow = cast !== false; me.receiveShadow = true; scene.add(me); return me; };
    const pot = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.55 }), soil = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 1 }), stem = new THREE.MeshStandardMaterial({ color: 0x5a4a32, roughness: 0.9 });
    trash.push(pot, soil, stem);
    add(new THREE.CylinderGeometry(0.15, 0.11, 0.3, 28), pot, 0, 0.15, 0); add(new THREE.CylinderGeometry(0.135, 0.135, 0.02, 24), soil, 0, 0.295, 0, false);
    const lg = new THREE.SphereGeometry(1, 12, 8); geos.push(lg);
    for (let sI = 0; sI < 5; sI++) {
      const a0 = rr() * 6.2832, lean = 0.05 + rr() * 0.13, hgt = 0.55 + rr() * 0.5, sx = Math.cos(a0) * lean, sz = Math.sin(a0) * lean;
      const st = add(new THREE.CylinderGeometry(0.008, 0.012, hgt, 6), stem, sx * hgt / 2, 0.3 + hgt / 2, sz * hgt / 2); st.rotation.set(sz, 0, -sx);
      for (let k = 0; k < 5; k++) {
        const f = 0.35 + 0.65 * (k + rr() * 0.6) / 5, y = 0.3 + hgt * f, a = a0 + k * 2.4 + rr(), g = 0.20 + rr() * 0.16;
        const lm = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.10 + rr() * 0.05, g + 0.12, 0.10 + rr() * 0.04, THREE.SRGBColorSpace), roughness: 0.42 }); trash.push(lm);
        const lf = new THREE.Mesh(lg, lm), ln = 0.13 + rr() * 0.07; lf.scale.set(ln, 0.006, ln * 0.52);
        lf.position.set(px + sx * hgt * f + Math.cos(a) * ln * 0.85, y, pz + sz * hgt * f + Math.sin(a) * ln * 0.85); lf.rotation.set(0, -a, 0.35 + rr() * 0.5, 'YXZ'); lf.castShadow = true; lf.receiveShadow = true; scene.add(lf);
      }
    }
  });
  /* ----- salle de bain : verre dépoli vu de dehors, cloison vue de dedans ----- */
  const sdbMat = new THREE.MeshStandardMaterial({ color: col([0.72, 0.82, 0.9]), transparent: true, opacity: 0.34, roughness: 0.4, depthWrite: false }); trash.push(sdbMat);
  const sdbGlass = sc.glass.map((b) => { const m = mesh(b, { mat: sdbMat, sharp: true }); scene.add(m); noAO.push(m); return m; });
  let sdbWall = null; if (sc.sdbWall) { sdbWall = mesh(sc.sdbWall, { sharp: true }); sdbWall.visible = false; scene.add(sdbWall); }

  /* ----- lumière du jour : le soleil entre par la fenêtre et dessine sa tache sur le sol ----- */
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.0);
  if (sc.win) {
    const wl = sc.walls[sc.win.wall], i = sc.win.wall, L = (i % 2 ? sc.Dc : sc.Wc) / 100, c = sc.win.pos / 100 - L / 2;
    const wx = i % 2 ? (i === 1 ? sc.W / 2 : -sc.W / 2) : c, wz = i % 2 ? c : (i === 0 ? -sc.D / 2 : sc.D / 2), n = wl.n, tx = -n[1], tz = n[0];
    sun.position.set(wx + n[0] * 6 + tx * 2.2, (sc.win.z0 + sc.win.z1) / 200 + 4.6, wz + n[1] * 6 + tz * 2.2);
    sun.target.position.set(wx - n[0] * 1.9, 0, wz - n[1] * 1.9);
  } else { sun.position.set(-3, 6, 2); sun.target.position.set(0, 0, 0); }
  const R = Math.hypot(sc.W, sc.D) / 2 + 1.2;
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.025;
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.5, far: 30 });
  scene.add(sun, sun.target);
  // Un peu de lumière diffuse qui vient du plafond, sans ombre, pour que rien ne soit bouché.
  const fill = new THREE.HemisphereLight(0xffffff, 0xe6ddd0, 0.42); scene.add(fill);
  // Le soir : le plafonnier éclaire la pièce (avec ses ombres), les lampes de chevet prennent le relais du soleil.
  const spot = new THREE.SpotLight(0xffd6a6, 11, 0, 1.28, 0.95, 2); spot.position.set(0, sc.H - 0.1, 0); spot.target.position.set(0, 0, 0);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0008; spot.shadow.normalBias = 0.02; spot.shadow.camera.near = 0.1; spot.shadow.camera.far = 12; spot.visible = false; scene.add(spot, spot.target);
  const bgDay = sky('#dfe7ee', '#f4f1ec'), bgNight = sky('#070a12', '#1b1f2b'); trash.push(bgDay, bgNight);
  let mood = null;
  function setMood(soir) {
    if (mood === soir) return; mood = soir;
    sun.visible = !soir; spot.visible = soir; fill.intensity = soir ? 0.16 : 0.42; scene.environmentIntensity = soir ? 0.14 : 0.5;
    lampL.forEach((l) => { l.intensity = soir ? 2.1 : 0.45; });
    lampMat.color.setRGB(soir ? 3.4 : 1.25, soir ? 2.5 : 1.13, soir ? 1.45 : 0.92); plafMat.color.setRGB(soir ? 3.2 : 0.98, soir ? 2.8 : 0.97, soir ? 2.2 : 0.95);
    skyMat.color.setRGB(soir ? 0.035 : 1.85, soir ? 0.05 : 2.0, soir ? 0.10 : 2.25); ceilMat.color.set(soir ? 0x6f675c : 0xe9e8e4);
    scene.background = soir ? bgNight : bgDay; renderer.toneMappingExposure = soir ? 1.12 : 1.0;
  }

  /* ----- effets : ombres de contact, halo des lumières, étalonnage. Si le téléphone ne suit pas, on dessine sans. ----- */
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
  let fx = null;
  try {
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, rt);
    const gtao = new GTAOPass(scene, camera, 4, 4, undefined, { radius: 0.38, distanceExponent: 1.2, thickness: 1.1, scale: 1.25, samples: 16 }, { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 9, radiusExponent: 1.4, rings: 3, samples: 24 });
    const ov = gtao._overrideVisibility.bind(gtao);
    gtao._overrideVisibility = () => { ov(); noAO.forEach((m) => { if (m.visible) { m.visible = false; gtao._visibilityCache.push(m); } }); };
    const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.32, 0.55, 1.05), grade = new ShaderPass(GRADE), rp = new RenderPass(scene, camera);
    composer.addPass(rp); composer.addPass(gtao); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grade);
    fx = { composer, gtao, bloom, grade, rp, w: 0, h: 0, d: 0 };
  } catch (e) { console.warn('effets', e); fx = null; }

  /* ----- caméra et dessin ----- */
  let raf = 0, dead = false;
  function frame(hi) {
    raf = 0; if (dead || !canvas.isConnected) return;
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    // Netteté : jusqu'à 3× pour l'image enregistrée, 2× à l'écran, sans dépasser ce qu'un téléphone encaisse.
    const dpr = Math.max(1, Math.min(hi === true ? 3 : Math.min(2, window.devicePixelRatio || 1), Math.sqrt((hi === true ? 4.2e6 : 2.6e6) / (w * h))));
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    const soir = !!(o.soir && o.soir()); setMood(soir);
    const inside = cam.mode === 'porte'; let eye, tg, fov = 42;
    if (inside) { const yaw = sc.dYaw + cam.ly, cp = Math.cos(cam.lp); eye = sc.dEye; tg = [eye[0] + cp * Math.sin(yaw), eye[1] + Math.sin(cam.lp), eye[2] + cp * Math.cos(yaw)]; fov = Math.min(100, Math.max(50, 2 * Math.atan(Math.tan(36 * Math.PI / 180) / (w / h)) * 180 / Math.PI)); }
    else { const cp = Math.cos(cam.pitch), ty = sc.H * 0.32; eye = [cam.dist * cp * Math.sin(cam.yaw), ty + cam.dist * Math.sin(cam.pitch), cam.dist * cp * Math.cos(cam.yaw)]; tg = [0, ty, 0]; }
    camera.fov = fov; camera.aspect = w / h; camera.position.set(eye[0], eye[1], eye[2]); camera.up.set(0, 1, 0); camera.lookAt(tg[0], tg[1], tg[2]); camera.updateProjectionMatrix();
    // Vue d'ensemble : les murs entre l'œil et la pièce s'effacent. De l'intérieur : tout est là, plafond compris.
    sc.walls.forEach((wl, i) => { wallGroups[i].visible = inside || !((eye[0] - wl.c[0]) * wl.n[0] + (eye[2] - wl.c[1]) * wl.n[1] > 0); });
    ceil.visible = inside; plaf.visible = inside; sdbGlass.forEach((m) => { m.visible = !inside; }); if (sdbWall) sdbWall.visible = inside;
    if (fx) {
      try {
        if (fx.w !== w || fx.h !== h || fx.d !== dpr) { fx.composer.setPixelRatio(dpr); fx.composer.setSize(w, h); fx.w = w; fx.h = h; fx.d = dpr; }
        fx.gtao.enabled = hi === true || pts.size === 0; // pendant qu'on tourne, on allège ; l'image complète revient dès qu'on lâche
        fx.bloom.strength = soir ? 0.55 : 0.2; fx.bloom.threshold = soir ? 0.95 : 1.55; fx.grade.uniforms.vig.value = inside ? 0.42 : 0.16; fx.grade.uniforms.sat.value = soir ? 1.12 : 1.08;
        fx.composer.render();
      } catch (e) { console.warn('effets', e); fx = null; renderer.setRenderTarget(null); renderer.render(scene, camera); }
    } else renderer.render(scene, camera);
    if (o.lab) {
      const out = [];
      if (!inside && (!o.cotes || o.cotes())) {
        const pr = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return v.z > 1 ? null : [(v.x * 0.5 + 0.5) * w, (1 - (v.y * 0.5 + 0.5)) * h]; };
        const hw = sc.W / 2, hd = sc.D / 2, edge = [[0, 0.02, -hd, o.fmt(sc.Wc)], [hw, 0.02, 0, o.fmt(sc.Dc)], [0, 0.02, hd, o.fmt(sc.Wc)], [-hw, 0.02, 0, o.fmt(sc.Dc)]];
        [eye[2] > 0 ? 2 : 0, eye[0] > 0 ? 1 : 3].forEach((i) => { const q = pr(edge[i][0], edge[i][1], edge[i][2]); if (q) out.push([q, edge[i][3]]); });
        const q = pr(eye[0] > 0 ? -hw : hw, sc.H / 2, eye[2] > 0 ? -hd : hd); if (q) out.push([q, 'h ' + o.fmt(sc.Hc)]);
      }
      o.lab.innerHTML = out.map(([q2, t]) => `<span style="left:${q2[0].toFixed(1)}px;top:${q2[1].toFixed(1)}px">${t}</span>`).join('');
    }
  }
  const ask = () => { if (!raf && !dead) raf = requestAnimationFrame(frame); };
  // Un doigt pour tourner autour de la chambre (ou regarder autour de soi depuis la porte), deux doigts ou la molette pour s'approcher.
  const pts = new Map(); let pinch = 0;
  const down = (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); try { canvas.setPointerCapture(e.pointerId); } catch (_) {} pinch = 0; e.preventDefault(); };
  const move = (e) => {
    const p = pts.get(e.pointerId); if (!p) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    const dx = e.clientX - p[0], dy = e.clientY - p[1];
    if (pts.size === 1) {
      if (cam.mode === 'porte') { cam.ly += dx * 0.005; cam.lp = Math.min(0.7, Math.max(-0.8, cam.lp + dy * 0.004)); }
      else { cam.yaw -= dx * 0.008; cam.pitch = Math.min(1.5, Math.max(0.12, cam.pitch + dy * 0.006)); }
    } else if (pts.size === 2 && cam.mode !== 'porte') { const [a, b] = [...pts.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.dist = Math.min(30, Math.max(1.5, cam.dist * pinch / dd)); pinch = dd; }
    ask();
  };
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; ask(); };
  const wheel = (e) => { if (cam.mode !== 'porte') cam.dist = Math.min(30, Math.max(1.5, cam.dist * (e.deltaY > 0 ? 1.08 : 0.93))); e.preventDefault(); ask(); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('wheel', wheel, { passive: false });
  ask();
  return {
    ask,
    snap: () => new Promise((res) => { if (raf) { cancelAnimationFrame(raf); raf = 0; } frame(true); canvas.toBlob((b) => { ask(); res(b); }, 'image/jpeg', 0.93); }),
    stop() {
      dead = true; if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('wheel', wheel);
      geos.forEach((g) => g.dispose()); trash.forEach((t) => t && t.dispose && t.dispose());
      try { if (fx) { fx.composer.dispose(); fx.gtao.dispose(); fx.bloom.dispose(); } } catch (_) {}
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (_) {}
    },
  };
}
