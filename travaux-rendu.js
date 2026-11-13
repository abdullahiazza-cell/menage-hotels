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
import { GLTFLoader } from './vendor/three/loaders/GLTFLoader.js';

// Vrais modèles 3D (libres, dossier vendor/modeles) : ils remplacent les blocs dès qu'ils sont chargés. Gardés en mémoire d'une chambre à l'autre.
const MODELES = { fauteuil: 'SheenChair.glb', plante: 'DiffuseTransmissionPlant.glb' };
const glbCache = new Map(); // (le tissu du fauteuil est reteint en bleu gris, comme les chaises)
function glb(f) {
  if (!glbCache.has(f)) glbCache.set(f, new GLTFLoader().loadAsync('./vendor/modeles/' + f).then((g) => { g.scene.traverse((x) => { if (x.isMesh && x.material && /^fabric/i.test(x.material.name || '')) x.material.color.setRGB(0.26, 0.44, 0.66, THREE.SRGBColorSpace); }); return g.scene; }).catch((e) => { glbCache.delete(f); throw e; }));
  return glbCache.get(f);
}

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
    if (b.k === 6) return b.lamp || b.glow ? lampMat : skyMat;
    else if (b.k === 7) m = new THREE.MeshStandardMaterial({ color: col(b.c), transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false }); // paroi de douche
    else if (b.k === 3) m = new THREE.MeshStandardMaterial({ color: col(b.c), map: T.wood, roughness: 0.52, metalness: 0 });
    else if (b.k === 4) m = new THREE.MeshStandardMaterial({ color: col(b.c), map: T.weave, roughness: 0.97, metalness: 0 });
    else if (b.k === 5) m = new THREE.MeshStandardMaterial({ color: col(b.c), roughness: 0.94, metalness: 0 });
    else if (isMetal(b.c)) m = new THREE.MeshStandardMaterial({ color: col(b.c), roughness: 0.28, metalness: 0.9 });
    else m = new THREE.MeshStandardMaterial({ color: col(b.c), roughness: b.c[0] < 0.3 ? 0.35 : 0.62, metalness: 0 });
    mats.set(key, m); trash.push(m); return m;
  }
  const geos = [], unitGeos = new Map();
  // Formes rondes de taille 1, partagées : un cylindre (éventuellement plus fin en haut, ou couché) ou une sphère.
  function unitGeo(b) {
    const t = b.top === undefined || b.top === null ? 1 : b.top, key = b.sph ? 'S' : `C${t}|${b.ax || ''}`;
    if (unitGeos.has(key)) return unitGeos.get(key);
    let g;
    if (b.sph) g = new THREE.SphereGeometry(0.5, 20, 14);
    else { g = new THREE.CylinderGeometry(0.5 * Math.min(1, t), 0.5 * Math.min(1, 1 / t), 1, 24); if (b.ax === 'x') g.rotateZ(Math.PI / 2); else if (b.ax === 'y') g.rotateX(Math.PI / 2); }
    unitGeos.set(key, g); geos.push(g); return g;
  }
  function mesh(b, opts) {
    const [sx, sy, sz] = b.s, mn = Math.min(sx, sy, sz); let g;
    const r = opts && opts.sharp ? 0 : (b.soft ? mn * 0.49 : (b.k === 4 ? Math.min(0.03, mn * 0.42) : (b.k === 3 || b.k === 0 ? Math.min(0.007, mn * 0.3) : 0)));
    let unit = false;
    if (b.lamp) g = new THREE.CylinderGeometry(sx * 0.36, sx * 0.52, sy, 28, 1, true); // abat-jour
    else if (b.cyl || b.sph) { g = unitGeo(b); unit = true; } // pieds ronds, tringles, plateaux ronds, boutons, feuillages : forme unitaire mise à l'échelle
    else { g = r > 0.002 ? new RoundedBoxGeometry(sx, sy, sz, b.soft ? 7 : (b.k === 4 ? 4 : 2), r) : new THREE.BoxGeometry(sx, sy, sz); geos.push(g); }
    const m = new THREE.Mesh(g, (opts && opts.mat) || matFor(b)); m.position.set(b.t[0], b.t[1], b.t[2]); if (unit) m.scale.set(sx, sy, sz);
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
  const byItem = {}, later = [], lampOf = [];
  const wallGroups = sc.walls.map((wl, i) => {
    const grp = new THREE.Group(), body = wl.boxes[0], along = i % 2 ? 2 : 0, parts = [];
    if (sc.win && sc.win.wall === i) {
      const L = (i % 2 ? sc.Dc : sc.Wc) / 100, c = sc.win.pos / 100 - L / 2, hw = sc.win.w / 200, y0 = sc.win.z0 / 100, y1 = sc.win.z1 / 100, lo = body.t[along] - body.s[along] / 2, hi = body.t[along] + body.s[along] / 2;
      const part = (a0, a1, b0, b1) => { if (a1 - a0 < 0.005 || b1 - b0 < 0.005) return; const t = [...body.t], s = [...body.s]; t[along] = (a0 + a1) / 2; s[along] = a1 - a0; t[1] = (b0 + b1) / 2; s[1] = b1 - b0; parts.push({ t, s, c: body.c, k: 5 }); };
      part(lo, c - hw, 0, sc.H); part(c + hw, hi, 0, sc.H); part(c - hw, c + hw, 0, y0); part(c - hw, c + hw, y1, sc.H);
    } else parts.push(body);
    parts.forEach((b) => { grp.add(mesh(b, { sharp: true })); ghost(b.t, b.s); });
    for (let j = 1; j < wl.boxes.length; j++) { const b = wl.boxes[j]; if (b.cur) continue; const m = mesh(b, { cast: b.k === 4 || b.k === 3 }); grp.add(m); if (b.mi >= 0) { m.userData.mi = b.mi; (byItem[b.mi] = byItem[b.mi] || []).push(m); } }
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
  // Éclairage choisi dans les finitions : spots encastrés et corniche lumineuse, visibles quand on regarde depuis l'intérieur.
  const L = sc.lum || { plaf: true, spots: [], corniche: false }, ceilLights = [];
  { const g = new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20); geos.push(g); L.spots.forEach(([x, z]) => { const m = new THREE.Mesh(g, plafMat); m.position.set(x, sc.H - 0.007, z); m.visible = false; scene.add(m); ceilLights.push(m); }); }
  if (L.corniche) [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([nx, nz]) => { const along = nz ? sc.W - 0.24 : sc.D - 0.24, g = new THREE.BoxGeometry(nz ? along : 0.035, 0.02, nz ? 0.035 : along); geos.push(g); const m = new THREE.Mesh(g, plafMat); m.position.set(nx * (sc.W / 2 - 0.12), sc.H - 0.11, nz * (sc.D / 2 - 0.12)); m.visible = false; scene.add(m); ceilLights.push(m); });
  /* ----- meubles ----- */
  const lamps = [];
  for (let i = 1; i < sc.B.length; i++) { const b = sc.B[i], m = mesh(b, { cast: !!b.cast && b.k !== 6 }); scene.add(m); if (b.mi >= 0) { m.userData.mi = b.mi; (byItem[b.mi] = byItem[b.mi] || []).push(m); } if (b.lamp || b.glow) { lamps.push(b.glow ? [b.t[0], b.t[1] + 0.12, b.t[2]] : b.t); lampOf.push(b.mi === undefined ? -1 : b.mi); } }
  // Pose un modèle à la place d'un meuble en blocs : même emplacement, même orientation, à l'échelle de son emprise au sol.
  function poser(f, it, olds) {
    glb(f).then((src) => {
      if (dead) return;
      const inner = src.clone(true), kill = []; inner.traverse((x) => { if (x.isLight || x.isCamera) kill.push(x); else if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } }); kill.forEach((x) => x.removeFromParent());
      inner.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(inner), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      const u = it.fitH ? it.h / sz.y : Math.min(1.15, it.w / sz.x); // jamais plus large que la place prévue sur le plan inner.position.set(-c.x, -bb.min.y, -c.z);
      const g = new THREE.Group(); g.add(inner); g.scale.setScalar(u); g.position.set(it.cx !== undefined ? it.cx : it.x, 0, it.cz !== undefined ? it.cz : it.z); if (it.mi >= 0) { g.userData.mi = it.mi; olds.push(g); } g.rotation.y = -(it.r || 0) * Math.PI / 180; scene.add(g);
      olds.forEach((m) => { if (m !== g && !m.isLight) m.visible = false; }); ask();
    }).catch((e) => console.warn('modèle', f, e));
  }
  const bills = [];
  (sc.models || []).forEach((it, i) => { it.mi = i; it.cx = it.x; it.cz = it.z; byItem[i] = byItem[i] || [];
    if (it.img) later.push(() => photo(it, byItem[i]));
    else if (MODELES[it.t] && !it.own) later.push(() => poser(MODELES[it.t], it.t === 'plante' ? Object.assign(it, { fitH: true }) : it, byItem[i])); });
  // Un meuble du catalogue : sa vraie photo IKEA, détourée (le fond blanc devient transparent), à sa taille réelle.
  // Debout dans la pièce, elle se tourne vers l'œil ; un tableau ou un miroir est plaqué sur son mur. Vue du dessus : on revient aux blocs.
  function photo(it, olds) {
    fetch(it.img).then((r) => { if (!r.ok) throw new Error('img ' + r.status); return r.blob(); }).then((b) => createImageBitmap(b)).then((bmp) => {
      if (dead) return;
      const cw = bmp.width, ch = bmp.height, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0);
      const im = cx.getImageData(0, 0, cw, ch), px = im.data, bg = (k) => { const r = px[k], g = px[k + 1], b2 = px[k + 2]; return r > 228 && g > 228 && b2 > 228 && Math.max(r, g, b2) - Math.min(r, g, b2) < 14; };
      if (!it.tv) { // détourage : on part des bords et on efface le fond clair qui les touche (le blanc du meuble lui-même reste)
        const seen = new Uint8Array(cw * ch), st = []; for (let x = 0; x < cw; x++) st.push(x, (ch - 1) * cw + x); for (let y = 0; y < ch; y++) st.push(y * cw, y * cw + cw - 1);
        while (st.length) { const q = st.pop(); if (seen[q]) continue; seen[q] = 1; if (!bg(q * 4)) continue; px[q * 4 + 3] = 0; const x = q % cw, y = (q - x) / cw; if (x > 0) st.push(q - 1); if (x < cw - 1) st.push(q + 1); if (y > 0) st.push(q - cw); if (y < ch - 1) st.push(q + cw); }
      }
      let x0 = cw, y0 = ch, x1 = -1, y1 = -1; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (px[(y * cw + x) * 4 + 3] > 20 && !(it.tv && bg((y * cw + x) * 4))) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < x0) return; cx.putImageData(im, 0, 0);
      const ow = x1 - x0 + 1, oh = y1 - y0 + 1, out = document.createElement('canvas'); out.width = ow; out.height = oh; out.getContext('2d').drawImage(cv, x0, y0, ow, oh, 0, 0, ow, oh);
      const tex = new THREE.CanvasTexture(out); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; trash.push(tex);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, toneMapped: false }); trash.push(mat);
      const asp = ow / oh; let pw, ph;
      if (it.tv) { pw = it.w; ph = Math.min(it.h * 1.15, pw / asp); }
      else { ph = it.h; pw = ph * asp; const mx = Math.max(it.w, it.d) * 1.35; if (pw > mx) { pw = mx; ph = pw / asp; } }
      const g = new THREE.PlaneGeometry(pw, ph); geos.push(g); const m = new THREE.Mesh(g, mat); m.userData.mi = it.mi; m.castShadow = !it.tv;
      m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.35 }); trash.push(m.customDepthMaterial);
      if (it.tv) { const a = (it.r || 0) * Math.PI / 180, nx = Math.sin(a), nz = Math.cos(a); m.rotation.y = -a; m.position.set(it.cx + nx * 0.02, (it.wz || 1.2) + ph / 2, it.cz + nz * 0.02);
        const grp = olds.length && olds[0].parent ? olds[0].parent : scene; grp.add(m); olds.forEach((o) => { if (!o.isLight) o.visible = false; }); olds.push(m); }
      else { m.position.set(it.cx, (it.zb || 0) + ph / 2, it.cz); scene.add(m); const boxes = olds.filter((o) => !o.isLight); olds.push(m); bills.push({ m, boxes }); }
      ask();
    }).catch((e) => console.warn('photo', it.img, e));
  }
  // Meuble choisi : une plaque de couleur au sol, sous lui.
  const selMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.38, depthWrite: false }); trash.push(selMat);
  const selGeo = new THREE.PlaneGeometry(1, 1); geos.push(selGeo);
  const selMesh = new THREE.Mesh(selGeo, selMat); selMesh.rotation.x = -Math.PI / 2; selMesh.visible = false; selMesh.renderOrder = 5; scene.add(selMesh); noAO.push(selMesh);
  const half = (it) => ((it.r || 0) % 180 ? [it.d / 2, it.w / 2] : [it.w / 2, it.d / 2]);
  const lampL = lamps.slice(0, 6).map((t, i) => { const l = new THREE.PointLight(0xffc988, 0.55, 3.4, 2); l.position.set(t[0], t[1] - 0.02, t[2]); scene.add(l); if (lampOf[i] >= 0) (byItem[lampOf[i]] = byItem[lampOf[i]] || []).push(l); return l; });
  /* ----- plante verte ----- */
  (sc.plants || []).forEach(([px, pz]) => {
    let sd = 7; const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const olds = [], add = (g, m, x, y, z, cast) => { geos.push(g); const me = new THREE.Mesh(g, m); me.position.set(px + x, y, pz + z); me.castShadow = cast !== false; me.receiveShadow = true; scene.add(me); olds.push(me); return me; };
    later.push(() => poser(MODELES.plante, { x: px, z: pz, r: 0, h: 1.25, fitH: true }, olds));
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
        lf.position.set(px + sx * hgt * f + Math.cos(a) * ln * 0.85, y, pz + sz * hgt * f + Math.sin(a) * ln * 0.85); lf.rotation.set(0, -a, 0.35 + rr() * 0.5, 'YXZ'); lf.castShadow = true; lf.receiveShadow = true; scene.add(lf); olds.push(lf);
      }
    }
  });
  /* ----- salle de bain : verre dépoli vu de dehors, cloison vue de dedans ----- */
  const sdbMat = new THREE.MeshStandardMaterial({ color: col([0.72, 0.82, 0.9]), transparent: true, opacity: 0.34, roughness: 0.4, depthWrite: false }); trash.push(sdbMat);
  const sdbGlass = sc.glass.map((b) => { const m = mesh(b, { mat: sdbMat, sharp: true }); scene.add(m); noAO.push(m); return m; });
  let sdbWall = null; if (sc.sdbWall) { sdbWall = mesh(sc.sdbWall, { sharp: true }); sdbWall.visible = false; scene.add(sdbWall); }
  // Cloisons de la salle de bain : basses en vue d'ensemble, entières quand on est dans la pièce.
  const sdbLow = (sc.sdbLow || []).map((b) => { const m = mesh(b, { sharp: true, cast: true }); scene.add(m); return m; }), sdbHigh = (sc.sdbHigh || []).map((b) => { const m = mesh(b, { sharp: true, cast: true }); m.visible = false; scene.add(m); return m; });

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
  let f = 1;
  function setMood(soir, pw) {
    const key = soir + '|' + pw; if (mood === key) return; mood = key; f = pw;
    sun.visible = !soir; spot.visible = soir; spot.intensity = (L.plaf ? 11 : L.spots.length ? 9 : 2.5) * f; fill.intensity = soir ? 0.16 + (L.corniche ? 0.34 : 0) : 0.42; fill.color.set(soir && L.corniche ? 0xffe2bd : 0xffffff); scene.environmentIntensity = soir ? 0.14 : 0.5;
    lampL.forEach((l) => { l.intensity = (soir ? 2.1 : 0.45) * f; }); sun.intensity = 2.0 * (0.5 + 0.5 * f);
    const e = soir ? Math.max(0.3, f) : 1; lampMat.color.setRGB((soir ? 3.4 : 1.25) * e, (soir ? 2.5 : 1.13) * e, (soir ? 1.45 : 0.92) * e); plafMat.color.setRGB((soir ? 3.2 : 0.98) * e, (soir ? 2.8 : 0.97) * e, (soir ? 2.2 : 0.95) * e);
    { const k = soir ? 1 : 0.55 + 0.45 * f; skyMat.color.setRGB((soir ? 0.035 : 1.85) * k, (soir ? 0.05 : 2.0) * k, (soir ? 0.10 : 2.25) * k); } ceilMat.color.set(soir ? 0x6f675c : 0xe9e8e4);
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
    const soir = !!(o.soir && o.soir()); setMood(soir, o.lumi ? Math.min(1.4, Math.max(0.1, o.lumi())) : 1);
    const inside = cam.mode === 'porte'; let eye, tg, fov = 42;
    if (inside) { const yaw = sc.dYaw + cam.ly, cp = Math.cos(cam.lp); eye = sc.dEye; tg = [eye[0] + cp * Math.sin(yaw), eye[1] + Math.sin(cam.lp), eye[2] + cp * Math.cos(yaw)]; fov = Math.min(100, Math.max(50, 2 * Math.atan(Math.tan(36 * Math.PI / 180) / (w / h)) * 180 / Math.PI)); }
    else { const cp = Math.cos(cam.pitch), ty = sc.H * 0.32; eye = [cam.dist * cp * Math.sin(cam.yaw), ty + cam.dist * Math.sin(cam.pitch), cam.dist * cp * Math.cos(cam.yaw)]; tg = [0, ty, 0]; }
    camera.fov = fov; camera.aspect = w / h; camera.position.set(eye[0], eye[1], eye[2]); camera.up.set(0, 1, 0); camera.lookAt(tg[0], tg[1], tg[2]); camera.updateProjectionMatrix();
    // Vue d'ensemble : les murs entre l'œil et la pièce s'effacent. De l'intérieur : tout est là, plafond compris.
    sc.walls.forEach((wl, i) => { wallGroups[i].visible = inside || !((eye[0] - wl.c[0]) * wl.n[0] + (eye[2] - wl.c[1]) * wl.n[1] > 0); });
    { const top = !inside && cam.pitch > 1.1; bills.forEach((bb) => { bb.m.visible = !top; bb.boxes.forEach((x) => { x.visible = top; }); if (!top) bb.m.rotation.y = Math.atan2(eye[0] - bb.m.position.x, eye[2] - bb.m.position.z); }); }
    ceil.visible = inside; plaf.visible = inside && L.plaf; ceilLights.forEach((m) => { m.visible = inside; }); sdbGlass.forEach((m) => { m.visible = !inside; }); if (sdbWall) sdbWall.visible = inside; sdbLow.forEach((m) => { m.visible = !inside; }); sdbHigh.forEach((m) => { m.visible = inside; });
    { const id = o.sel ? o.sel() : null, it = id ? (sc.models || []).find((m) => m.id === id) : null;
      if (grab && grab.door && grab.f) { selMesh.visible = true; selMesh.scale.set(0.6, 0.6, 1); selMesh.position.set(grab.f[0], 0.02, grab.f[1]); }
      else if (it && !it.tv) { const [hx, hz] = half(it); selMesh.visible = true; selMesh.scale.set(hx * 2 + 0.14, hz * 2 + 0.14, 1); selMesh.position.set(it.cx, 0.016, it.cz); } else selMesh.visible = false; }
    if (fx) {
      try {
        if (fx.w !== w || fx.h !== h || fx.d !== dpr) { fx.composer.setPixelRatio(dpr); fx.composer.setSize(w, h); fx.w = w; fx.h = h; fx.d = dpr; }
        fx.gtao.enabled = hi === true || pts.size === 0; // pendant qu'on tourne, on allège ; l'image complète revient dès qu'on lâche
        fx.bloom.strength = (soir ? 0.55 : 0.2) * Math.min(1.2, f); fx.bloom.threshold = soir ? 0.95 : 1.55; fx.grade.uniforms.vig.value = inside ? 0.42 : 0.16; fx.grade.uniforms.sat.value = soir ? 1.12 : 1.08;
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
  // Toucher un meuble : le choisir. Le glisser : il suit le doigt sur le sol, sans sortir de la pièce, et se colle aux murs.
  const ray = new THREE.Raycaster(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v2 = new THREE.Vector2(), v3 = new THREE.Vector3();
  const aim = (e) => { const r = canvas.getBoundingClientRect(); v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(v2, camera); };
  const pick = (e) => {
    aim(e); const list = []; Object.values(byItem).forEach((a) => a.forEach((m) => { if (!m.isLight && m.visible && m.parent && (m.parent === scene || m.parent.visible)) list.push(m); }));
    const hit = ray.intersectObjects(list, true)[0]; if (!hit) return -1;
    for (let x = hit.object; x; x = x.parent) if (x.userData && x.userData.mi >= 0) return x.userData.mi; return -1;
  };
  const onFloor = (e) => { aim(e); return ray.ray.intersectPlane(floor, v3) ? [v3.x, v3.z] : null; };
  // Portes saisissables en mode « Déplacer » : des volumes invisibles dans l'encadrement.
  const doorMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }); trash.push(doorMat);
  const doorMeshes = (sc.doorPick || []).map((dp) => { const g = new THREE.BoxGeometry(dp.b.s[0], dp.b.s[1], dp.b.s[2]); geos.push(g); const m = new THREE.Mesh(g, doorMat); m.position.set(dp.b.t[0], dp.b.t[1], dp.b.t[2]); m.userData.door = dp.kind; scene.add(m); noAO.push(m); return m; });
  const pickDoor = (e) => { if (!doorMeshes.length) return null; aim(e); const h = ray.intersectObjects(doorMeshes, false)[0]; return h ? h.object.userData.door : null; };
  let grab = null, tap = null;
  const down = (e) => {
    pts.set(e.pointerId, [e.clientX, e.clientY]); try { canvas.setPointerCapture(e.pointerId); } catch (_) {} pinch = 0; e.preventDefault();
    grab = null; tap = pts.size === 1 ? [e.clientX, e.clientY, false] : null;
    if (pts.size === 1 && o.onDoor && o.move && o.move()) { const k = pickDoor(e); if (k) { grab = { door: k }; return; } }
    if (pts.size === 1 && o.onSelect && (!o.move || o.move())) { const mi = pick(e); if (mi >= 0) { const it = sc.models[mi], f = onFloor(e); grab = { it, f, ox: it.cx, oz: it.cz, moved: false }; } }
  };
  const move = (e) => {
    const p = pts.get(e.pointerId); if (!p) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    const dx = e.clientX - p[0], dy = e.clientY - p[1];
    if (tap && Math.hypot(e.clientX - tap[0], e.clientY - tap[1]) > 7) tap[2] = true;
    if (grab && grab.door && pts.size === 1) {
      if (!tap || !tap[2]) return; const f = onFloor(e); if (!f) return; grab.f = f; grab.moved = true;
      ask(); return;
    }
    if (grab && pts.size === 1) {
      if (!tap || !tap[2] || !o.edit || grab.it.tv || !grab.f) return;
      const f = onFloor(e); if (!f) return; grab.moved = true;
      const it = grab.it, [hx, hz] = half(it), lim = it.lim || [-sc.W / 2, -sc.D / 2, sc.W / 2, sc.D / 2]; // un équipement de salle de bain reste dans la salle de bain
      const ax = lim[0] + hx, bx = lim[2] - hx, az = lim[1] + hz, bz = lim[3] - hz;
      let nx = Math.round((grab.ox + f[0] - grab.f[0]) * 100) / 100, nz = Math.round((grab.oz + f[1] - grab.f[1]) * 100) / 100;
      nx = ax > bx ? (ax + bx) / 2 : Math.min(bx, Math.max(ax, nx)); nz = az > bz ? (az + bz) / 2 : Math.min(bz, Math.max(az, nz));
      if (ax <= bx) { if (bx - nx < 0.08) nx = bx; if (nx - ax < 0.08) nx = ax; } if (az <= bz) { if (bz - nz < 0.08) nz = bz; if (nz - az < 0.08) nz = az; }
      const mx = nx - it.cx, mz = nz - it.cz; if (mx || mz) { (byItem[it.mi] || []).forEach((m) => { m.position.x += mx; m.position.z += mz; }); it.cx = nx; it.cz = nz; }
      ask(); return;
    }
    if (pts.size === 1) {
      if (cam.mode === 'porte') { cam.ly += dx * 0.005; cam.lp = Math.min(0.7, Math.max(-0.8, cam.lp + dy * 0.004)); }
      else { cam.yaw -= dx * 0.008; cam.pitch = Math.min(1.5, Math.max(0.12, cam.pitch + dy * 0.006)); }
    } else if (pts.size === 2 && cam.mode !== 'porte') { const [a, b] = [...pts.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.dist = Math.min(30, Math.max(1.5, cam.dist * pinch / dd)); pinch = dd; }
    ask();
  };
  const up = (e) => {
    pts.delete(e.pointerId); pinch = 0;
    if (grab && grab.door) { const g = grab; grab = null; tap = null; if (g.moved && g.f) o.onDoor(g.door, Math.round((g.f[0] + sc.W / 2) * 100), Math.round((g.f[1] + sc.D / 2) * 100)); ask(); return; }
    if (grab && grab.moved && o.onMove) o.onMove(grab.it.id, Math.round((grab.it.cx + sc.W / 2) * 100), Math.round((grab.it.cz + sc.D / 2) * 100));
    else if (tap && !tap[2] && o.onSelect && e.type === 'pointerup' && (!o.move || o.move())) o.onSelect(grab ? grab.it.id : null);
    grab = null; tap = null; ask();
  };
  const wheel = (e) => { if (cam.mode !== 'porte') cam.dist = Math.min(30, Math.max(1.5, cam.dist * (e.deltaY > 0 ? 1.08 : 0.93))); e.preventDefault(); ask(); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('wheel', wheel, { passive: false });
  ask(); later.forEach((fn) => fn());
  return {
    ask,
    whereDoor: (k) => { const m = doorMeshes.find((x) => x.userData.door === k); if (!m) return null; const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(m.position.x, 0.9, m.position.z).project(camera); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (1 - (v.y * 0.5 + 0.5)) * r.height]; },
    // Où un meuble se trouve à l'écran (pour les essais automatiques).
    where: (id) => { const it = (sc.models || []).find((m) => m.id === id); if (!it) return null; const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(it.cx, it.tv ? 1.2 : Math.min(0.4, it.h * 0.6), it.cz).project(camera); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (1 - (v.y * 0.5 + 0.5)) * r.height]; },
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


/* Scan 3D réel (maillage texturé, fichier GLB d'une appli de scan LiDAR) : affiché tel quel, on tourne autour et on zoome.
   Les textures du scan contiennent déjà la lumière de la pièce : on les montre sans éclairage ajouté. */
export function trMaille({ canvas, url, lab }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0xeeeae4, 1);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.02, 200);
  let dead = false, raf = 0, ctr = new THREE.Vector3(), rad = 3, yaw = 0.6, pitch = 0.5, dist = 6;
  const draw = () => {
    raf = 0; if (dead) return;
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.set(ctr.x + Math.sin(yaw) * Math.cos(pitch) * dist, ctr.y + Math.sin(pitch) * dist, ctr.z + Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(ctr);
    renderer.render(scene, camera);
  };
  const ask = () => { if (!raf && !dead) raf = requestAnimationFrame(draw); };
  if (lab) lab.textContent = 'Chargement du scan…';
  new GLTFLoader().load(url, (g) => {
    if (dead) return;
    g.scene.traverse((m) => { if (!m.isMesh) return; const old = Array.isArray(m.material) ? m.material[0] : m.material; const nm = new THREE.MeshBasicMaterial({ map: old && old.map ? old.map : null, color: old && old.map ? 0xffffff : (old && old.color ? old.color : 0xcccccc), vertexColors: !!(m.geometry && m.geometry.attributes.color && !(old && old.map)), side: THREE.DoubleSide }); m.material = nm; });
    scene.add(g.scene); const bb = new THREE.Box3().setFromObject(g.scene); bb.getCenter(ctr); rad = Math.max(0.5, bb.getSize(new THREE.Vector3()).length() / 2); dist = rad * 2.3;
    if (lab) lab.textContent = ''; ask();
  }, (e) => { if (lab && e.total) lab.textContent = `Chargement du scan… ${Math.round(e.loaded / e.total * 100)} %`; }, () => { if (lab) lab.textContent = 'Ce fichier n’a pas pu être ouvert. Il faut un export GLB.'; });
  const pts = new Map(); let pinch = 0;
  const down = (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); try { canvas.setPointerCapture(e.pointerId); } catch (_) {} pinch = 0; e.preventDefault(); };
  const move = (e) => {
    const p = pts.get(e.pointerId); if (!p) return; e.preventDefault();
    if (pts.size === 1) { yaw -= (e.clientX - p[0]) * 0.008; pitch = Math.max(-1.45, Math.min(1.45, pitch + (e.clientY - p[1]) * 0.006)); }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) dist = Math.max(0.05, Math.min(rad * 6, dist * pinch / dd)); pinch = dd; }
    ask();
  };
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  const wheel = (e) => { e.preventDefault(); dist = Math.max(0.05, Math.min(rad * 6, dist * (1 + e.deltaY * 0.001))); ask(); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('wheel', wheel, { passive: false });
  const ro = new ResizeObserver(ask); ro.observe(canvas);
  return {
    ask, info: () => ({ ctr: ctr.toArray(), rad, dist, cw: canvas.clientWidth, ch: canvas.clientHeight, w: canvas.width, h: canvas.height }),
    stop() { dead = true; if (raf) cancelAnimationFrame(raf); ro.disconnect(); scene.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }); try { renderer.dispose(); renderer.forceContextLoss(); } catch (_) {} },
  };
}
