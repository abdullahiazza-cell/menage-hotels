"use strict";
/* Ma Réception — vue 3D des hôtels (v81), chargé après plus.js.
   Une maquette de chaque hôtel, tracée d'après les plans (dossiers de travaux 2024 pour l'Archange et l'Hôtel de Paris,
   plans d'évacuation 2025 pour Châteaudun), avec ce qui se passe vraiment : ménage en cours, chambres à faire ou à contrôler,
   chambres bloquées ou occupées, problèmes signalés.
   Réservé aux gérants. Interrupteur dans Réglages → Nouveautés : éteint, seul le propriétaire la voit.
   Aucune donnée n'est gardée ici : tout vient de l'état déjà chargé par l'appli (S.rooms, S.issues, S.occRooms).
   Le rattachement « pièce du plan → chambre de l'appli » se corrige dans la vue et s'enregistre dans la configuration (cfg.v3d.map). */
(function () {
  if (typeof S === 'undefined' || typeof SECTIONS === 'undefined' || typeof PLUS_TABS === 'undefined' || typeof plusView !== 'function') return;

  const FH = 3.0; // hauteur d'un étage, en mètres
  const R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const TF = (pts, ax, bx, ay, by) => pts.map((p) => [ax * p[0] + bx, ay * p[1] + by]);

  /* ---------- Hôtel Archange : plans PREVENTI 2024 (110 dpi, 49,3 px par mètre) ---------- */
  const t = (x) => 165 - (x - 40) * 30 / 1210;
  const Rt = (x0, x1, y1) => [[x0, t(x0)], [x1, t(x1)], [x1, y1], [x0, y1]];
  const ARC = { pxm: 49.3, yaw: -0.62, floors: [
    { lvl: 0, name: 'Rez-de-chaussée', chip: 'RDC', flat: true, spaces: [
      { key: 'L0-RDC', k: 'rdc', name: 'Rez-de-chaussée (pas de plan)', show: 'RDC', rid: 'arc__c_entreeetescalier', pts: [[40, 165], [1250, 135], [1250, 640], [280, 640], [50, 425]], anchor: [1150, 540] }] },
    { lvl: 1, name: '1er étage', chip: '1er', spaces: [
      { key: 'L1-TL', k: 'ch', n: '7', pts: [[40, 165], [345, t(345)], [345, 345], [47, 345]] },
      { key: 'L1-S', k: 'ch', n: '8', pts: Rt(345, 655, 345) },
      { key: 'L1-WC', k: 'svc', name: 'Sanitaires', pts: R(745, 290, 868, 345) },
      { key: 'L1-CU', k: 'svc', name: 'Cuisine', pts: [[845, t(845)], [1250, t(1250)], [1250, 262], [1068, 262], [1068, 345], [868, 345], [868, 290], [845, 290]], anchor: [960, 215] },
      { key: 'L1-ST', k: 'st', name: 'Escalier principal', pts: R(1068, 262, 1250, 437) },
      { key: 'L1-COR', k: 'cor', name: 'Couloir 1er', rid: 'arc__c_couloir1er', pts: R(228, 345, 1068, 405), anchor: [640, 375] },
      { key: 'L1-C', k: 'ch', n: '5', pts: [[47, 345], [228, 345], [228, 405], [275, 405], [281, 640], [50, 425]], anchor: [150, 455] },
      { key: 'L1-B1', k: 'ch', n: '6', pts: [[275, 405], [415, 405], [415, 640], [281, 640]] },
      { key: 'L1-B2', k: 'ch', n: '4', pts: R(418, 405, 640, 640) },
      { key: 'L1-B3', k: 'ch', n: '3', pts: R(645, 405, 842, 640) },
      { key: 'L1-B4', k: 'ch', n: '2', pts: R(845, 405, 1042, 640) },
      { key: 'L1-B5', k: 'ch', n: '1', pts: [[1045, 405], [1068, 405], [1068, 437], [1250, 437], [1250, 640], [1045, 640]], anchor: [1148, 540] }] },
    { lvl: 2, name: '2e étage', chip: '2e', spaces: [
      { key: 'L2-TL', k: 'ch', n: '16', pts: [[40, 165], [352, t(352)], [352, 325], [46, 325]] },
      { key: 'L2-S2', k: 'st', name: 'Escalier vers le 3e', pts: Rt(355, 507, 345) },
      { key: 'L2-T2', k: 'ch', n: '17', pts: Rt(510, 657, 345) },
      { key: 'L2-WC', k: 'svc', name: 'Sanitaires', pts: R(745, 290, 868, 345) },
      { key: 'L2-T1', k: 'ch', n: '9', pts: [[845, t(845)], [1012, t(1012)], [1012, 345], [868, 345], [868, 290], [845, 290]], anchor: [930, 225] },
      { key: 'L2-LS', k: 'svc', name: 'Local de service', pts: [[1016, t(1016)], [1250, t(1250)], [1250, 262], [1016, 262]] },
      { key: 'L2-ST', k: 'st', name: 'Escalier principal', pts: R(1068, 262, 1250, 437) },
      { key: 'L2-COR', k: 'cor', name: 'Couloir 2e', rid: 'arc__c_couloiretescalier2e', pts: [[240, 345], [1016, 345], [1016, 262], [1068, 262], [1068, 405], [240, 405]], anchor: [640, 375] },
      { key: 'L2-C', k: 'ch', n: '15', pts: [[46, 325], [240, 325], [240, 405], [352, 405], [352, 640], [280, 640], [50, 425]], anchor: [190, 470] },
      { key: 'L2-B1', k: 'ch', n: '14', pts: R(355, 405, 500, 640) },
      { key: 'L2-B2', k: 'ch', n: '12 bis', pts: R(503, 405, 657, 640) },
      { key: 'L2-B3', k: 'ch', n: '12', pts: R(660, 405, 852, 640) },
      { key: 'L2-B4', k: 'ch', n: '11', pts: R(855, 405, 1045, 640) },
      { key: 'L2-B5', k: 'ch', n: '10', pts: [[1048, 405], [1068, 405], [1068, 437], [1250, 437], [1250, 640], [1048, 640]], anchor: [1150, 540] }] },
    { lvl: 3, name: '3e étage', chip: '3e', spaces: [
      { key: 'L3-TL', k: 'ch', n: '22', pts: [[40, 165], [352, t(352)], [352, 322], [46, 322]] },
      { key: 'L3-S2', k: 'st', name: 'Escalier du 3e', pts: Rt(355, 508, 340) },
      { key: 'L3-TR', k: 'ch', n: '18', pts: Rt(511, 660, 337) },
      { key: 'L3-COR', k: 'cor', name: 'Couloir 3e', rid: 'arc__c_couloiretescalier3e', pts: [[240, 322], [352, 322], [352, 340], [660, 340], [660, 398], [240, 398]], anchor: [450, 369] },
      { key: 'L3-C', k: 'ch', n: '21', pts: [[46, 322], [240, 322], [240, 398], [352, 398], [352, 640], [280, 640], [50, 425]], anchor: [190, 470] },
      { key: 'L3-BL', k: 'ch', n: '20', pts: R(355, 398, 503, 640) },
      { key: 'L3-BR', k: 'ch', n: '19', pts: R(506, 398, 660, 640) }] },
    { lvl: 4, name: '4e étage', chip: '4e', spaces: [
      { key: 'L4-TL', k: 'ch', n: '25', pts: [[40, 165], [352, t(352)], [352, 318], [46, 318]] },
      { key: 'L4-S2', k: 'st', name: 'Escalier du 4e', pts: Rt(355, 510, 318) },
      { key: 'L4-R', k: 'ch', n: '23', pts: [[513, t(513)], [660, t(660)], [660, 640], [472, 640], [472, 505], [513, 505]], anchor: [588, 360] },
      { key: 'L4-COR', k: 'cor', name: 'Palier 4e', rid: 'arc__c_couloiretescalier4e', pts: R(235, 318, 513, 390), anchor: [380, 354] },
      { key: 'L4-C', k: 'ch', n: '24', pts: [[46, 318], [235, 318], [235, 390], [302, 390], [302, 640], [280, 640], [50, 425]], anchor: [165, 455] },
      { key: 'L4-P', k: 'ch', n: '23 bis', pts: [[305, 393], [510, 393], [510, 505], [469, 505], [469, 640], [305, 640]], anchor: [388, 500] }] }] };

  /* ---------- Hôtel de Paris : plans PREVENTI 2024 (100 dpi, environ 54 px par mètre) ---------- */
  const parLeft = (p, nTL, nC, nR, hall) => [
    { key: p + '-TL', k: 'ch', n: nTL, pts: [[98, 238], [340, 246], [340, 362], [292, 395], [98, 395]], anchor: [215, 315] },
    { key: p + '-HA', k: 'cor', name: 'Palier', rid: hall, pts: [[340, 248], [410, 250], [410, 398], [322, 398], [294, 394], [340, 362]], anchor: [370, 340] },
    { key: p + '-STA', k: 'st', name: 'Escalier', pts: R(412, 252, 540, 342) },
    { key: p + '-R', k: 'ch', n: nR, pts: [[322, 400], [412, 400], [412, 345], [540, 345], [540, 565], [322, 565]], anchor: [432, 470] },
    { key: p + '-C', k: 'ch', n: nC, pts: [[98, 398], [318, 398], [318, 565], [200, 565], [98, 462]], anchor: [215, 480] }];
  const pr = (pts) => TF(pts, 1 / 1.045, 65 - 60 / 1.045, 1 / 1.045, 600 - 590 / 1.045);
  const PAR = { pxm: 54, yaw: -0.5, floors: [
    { lvl: 0, name: 'Rez-de-chaussée', chip: 'RDC', spaces: [
      { key: 'P0-REST', k: 'svc', name: 'Salle de restaurant', rid: 'par__c_salledrestaurant', pts: pr([[98, 205], [555, 222], [555, 455], [500, 455], [500, 550], [200, 550], [98, 430]]), anchor: [330, 395] },
      { key: 'P0-CUI', k: 'svc', name: 'Cuisine', rid: 'par__c_cuisine', pts: pr([[585, 228], [1110, 245], [1110, 355], [775, 355], [745, 385], [655, 385], [655, 290], [585, 290]]), anchor: [870, 300] },
      { key: 'P0-ST', k: 'st', name: 'Escalier', pts: pr(R(585, 295, 650, 415)) },
      { key: 'P0-ENT', k: 'cor', name: 'Entrée et couloir RDC', rid: 'par__c_entreeetcouloirrdc', pts: pr([[585, 418], [650, 418], [650, 390], [745, 390], [775, 360], [875, 360], [875, 440], [800, 440], [800, 462], [700, 462], [700, 550], [600, 550]]), anchor: [650, 480] },
      { key: 'P0-WC', k: 'svc', name: 'WC', pts: pr(R(703, 465, 800, 550)) },
      { key: 'P0-SDE', k: 'svc', name: 'Salle d’eau PMR', pts: pr([[803, 442], [875, 442], [945, 490], [945, 550], [803, 550]]) },
      { key: 'P0-PMR', k: 'svc', name: 'Chambre PMR (plan de 2024)', show: 'PMR', pts: pr([[880, 360], [1108, 360], [1108, 550], [948, 550], [948, 488], [880, 442]]), anchor: [1030, 460] }] },
    { lvl: 1, name: '1er étage', chip: '1er', spaces: parLeft('P1', '3', '2', '1', null).concat([
      { key: 'P1-STB', k: 'st', name: 'Escalier', pts: R(570, 255, 636, 440) },
      { key: 'P1-DG1', k: 'cor', name: 'Couloir 1er', rid: 'par__c_couloiretescalier1er', pts: [[636, 256], [958, 264], [958, 306], [636, 306]] },
      { key: 'P1-10', k: 'ch', n: '10', pts: [[636, 309], [756, 309], [756, 565], [570, 565], [570, 443], [636, 443]], anchor: [665, 480] },
      { key: 'P1-11', k: 'ch', n: '11', pts: R(766, 310, 914, 565) },
      { key: 'P1-12', k: 'ch', n: '12', pts: [[920, 310], [960, 310], [960, 266], [1065, 270], [1065, 565], [920, 565]], anchor: [995, 440] }]) },
    { lvl: 2, name: '2e étage', chip: '2e', spaces: parLeft('P2', '6', '5', '4', 'par__c_couloiretescalier2e') },
    { lvl: 3, name: '3e étage', chip: '3e', spaces: parLeft('P3', '9', '8', '7', 'par__c_couloiretescalier3e') },
    { lvl: 4, name: 'Grenier', chip: 'Grenier', spaces: [
      { key: 'P4-G2', k: 'ch', n: 'Grenier 2', pts: R(195, 235, 340, 490) },
      { key: 'P4-HA', k: 'cor', name: 'Palier du grenier', rid: 'par__c_couloiretescalierdugrenier', pts: R(343, 235, 415, 338) },
      { key: 'P4-ST', k: 'st', name: 'Escalier du grenier', pts: R(417, 245, 540, 338) },
      { key: 'P4-G1', k: 'ch', n: 'Grenier 1', pts: R(343, 341, 540, 490) }] }] };

  /* ---------- Châteaudun : plans d'évacuation 2025 (90 dpi, 57 px par mètre) ---------- */
  const ce = (pts) => TF(pts, 0.965, 163 - 165 * 0.965, 0.965, 905 - 985 * 0.965);
  const CHA = { pxm: 57, yaw: -0.55, floors: [
    { lvl: 0, name: 'Rez-de-chaussée', chip: 'RDC', spaces: [
      { key: 'C0-LT', k: 'svc', name: 'Local technique', pts: R(176, 150, 358, 212) },
      { key: 'C0-3', k: 'ch', n: '3', pts: R(176, 216, 358, 622) },
      { key: 'C0-2', k: 'ch', n: '2', pts: R(176, 630, 530, 885) },
      { key: 'C0-COUR', k: 'cour', name: 'Cour', show: 'Cour', rid: 'cha__c_cour', pts: [[368, 152], [825, 152], [862, 200], [640, 398], [545, 622], [368, 622]], anchor: [500, 340] },
      { key: 'C0-ENT', k: 'cor', name: 'Entrée', rid: 'cha__c_entree', pts: [[538, 630], [1010, 632], [1010, 700], [645, 700], [645, 885], [538, 885]], anchor: [592, 770] },
      { key: 'C0-ST', k: 'st', name: 'Escaliers', rid: 'cha__c_escaliers', pts: R(618, 560, 810, 628) },
      { key: 'C0-1', k: 'ch', n: '1', pts: R(650, 705, 1068, 885) },
      { key: 'C0-4', k: 'ch', n: '4', pts: [[645, 400], [870, 210], [1160, 540], [950, 540], [950, 600], [815, 600], [815, 556], [645, 556]], anchor: [890, 420] },
      { key: 'C0-BUR', k: 'svc', name: 'Bureau', show: 'Bureau', pts: [[1015, 612], [1215, 612], [1290, 690], [1205, 885], [1072, 885], [1072, 702], [1015, 702]], anchor: [1160, 750] }] },
    { lvl: 1, name: 'Étage', chip: 'Étage', spaces: [
      { key: 'C1-10', k: 'ch', n: '10', pts: ce(R(178, 192, 372, 585)) },
      { key: 'C1-9', k: 'ch', n: '9', pts: ce(R(178, 598, 372, 955)) },
      { key: 'C1-8', k: 'ch', n: '8', pts: ce(R(383, 708, 735, 965)) },
      { key: 'C1-7', k: 'ch', n: '7', pts: ce(R(745, 770, 1105, 965)) },
      { key: 'C1-6', k: 'ch', n: '6', pts: ce([[1115, 768], [1255, 768], [1350, 778], [1400, 860], [1350, 935], [1262, 968], [1115, 968]]), anchor: [1166, 792] },
      { key: 'C1-5', k: 'ch', n: '5', pts: ce([[700, 440], [910, 260], [1205, 600], [1110, 690], [1022, 690], [1022, 636], [905, 636], [905, 690], [850, 690], [850, 600]]), anchor: [900, 430] },
      { key: 'C1-ST', k: 'st', name: 'Escaliers', pts: ce([[676, 692], [842, 692], [848, 602], [760, 560], [726, 600]]) },
      { key: 'C1-CRS', k: 'cor', name: 'Coursives du haut', rid: 'cha__c_coursivesduhaut', pts: ce([[383, 192], [435, 192], [435, 585], [600, 585], [560, 695], [1110, 695], [1110, 765], [740, 765], [740, 705], [383, 705]]), anchor: [470, 595] }] }] };

  const GEO = { arc: ARC, par: PAR, cha: CHA };
  Object.keys(GEO).forEach((hk) => {
    const h = GEO[hk]; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; h.SP = {};
    h.floors.forEach((f) => f.spaces.forEach((s) => s.pts.forEach((p) => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; })));
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    h.ext = [(x1 - x0) / 2 / h.pxm, (z1 - z0) / 2 / h.pxm];
    h.floors.forEach((f) => f.spaces.forEach((s) => {
      s.lvl = f.lvl; s.floor = f;
      s.m = s.pts.map((p) => [(p[0] - cx) / h.pxm, (p[1] - cz) / h.pxm]);
      let a = s.anchor;
      if (!a) { let sx = 0, sz = 0; s.pts.forEach((p) => { sx += p[0]; sz += p[1]; }); a = [sx / s.pts.length, sz / s.pts.length]; }
      s.c = [(a[0] - cx) / h.pxm, (a[1] - cz) / h.pxm];
      h.SP[s.key] = s;
    }));
  });

  /* ---------- Rattachement plan → chambres de l'appli ---------- */
  const slug = (n) => String(n).toLowerCase().replace(/[^a-z0-9]/g, '');
  const vMap = (hk) => (((S.cfg || {}).v3d || {}).map || {})[hk] || {};
  const ridOf = (hk, s) => { const m = vMap(hk); if (Object.prototype.hasOwnProperty.call(m, s.key)) return m[s.key] || null; return s.rid || (s.n ? hk + '__' + slug(s.n) : null); };
  const roomOf = (hk, s) => { const id = ridOf(hk, s); return id ? (S.rooms[id] || null) : null; };
  const spaceOfRoom = (hk, rid) => { const g = GEO[hk]; for (const k in g.SP) if (ridOf(hk, g.SP[k]) === rid) return g.SP[k]; return null; };
  const shown = (hk, s) => { const r = roomOf(hk, s); if (s.k === 'ch') return r ? r.num : s.n; return s.show || ''; };
  const titleOf = (hk, s) => { const r = roomOf(hk, s); if (r) return placeName(r); return s.k === 'ch' ? 'Chambre ' + s.n + ' (plan)' : s.name; };
  // Un problème signalé donne son lieu en texte libre (« 7 – salle de bain », « 23 et 23 bis »…) : on cherche la chambre ou le lieu qui correspond.
  function roomOfIssue(i) {
    const txt = String(i.room || '').trim().toLowerCase(); if (!txt) return null;
    const L = Object.values(S.rooms).filter((r) => r.hotel === i.hotel);
    const exact = L.find((r) => String(r.num).toLowerCase() === txt); if (exact) return exact;
    const m = txt.match(/^(\d+(?:\s*bis)?)/); if (!m) return null;
    const n = m[1].replace(/\s+/g, ' ');
    return L.find((r) => String(r.num).toLowerCase() === n) || L.find((r) => String(r.num).toLowerCase() === n.replace(/\s*bis$/, '')) || null;
  }

  /* ---------- État de la vue ---------- */
  const V = { hotel: LS.get('mh-v3d-hotel', null), style: LS.get('mh-v3d-style', 'maquette'), fig: LS.get('mh-v3d-fig', true), iso: null, spread: 1.7, top: false, sel: null,
    cam: { yaw: -0.62, pitch: 0.62, zoom: 1, px: 0, py: 0 }, tgt: null, before: null, ents: [], lost: [], dirty: true };
  let cv = null, ctx = null, W = 0, Hc = 0, dpr = 1, raf = 0, lastTs = 0, lastDraw = 0, ro = null;
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const on = () => typeof pOn === 'function' && pOn('v3d') && role() === 'mgr';
  const hotelsShown = () => HOTELS.filter((h) => GEO[h.id] && (S.scope === 'all' || S.scope === h.id));
  function curHotel() { const L = hotelsShown(); if (!L.some((h) => h.id === V.hotel)) { V.hotel = (L.find((h) => h.id === S.hotel) || L[0] || { id: 'arc' }).id; V.cam.yaw = GEO[V.hotel].yaw; V.iso = null; V.sel = null; V.ents = []; } return V.hotel; }
  const HT = () => GEO[curHotel()];

  /* ---------- Styles de rendu ---------- */
  const hex = (c) => { c = c.replace('#', ''); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]; return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)]; };
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * k) + ',' + Math.round(A[1] + (B[1] - A[1]) * k) + ',' + Math.round(A[2] + (B[2] - A[2]) * k) + ')'; };
  const STY = {
    maquette: { l: 'Maquette', wallH: 0.95, shadow: true, pal: () => dark()
      ? { ch: '#23444a', cor: '#34413a', svc: '#2a3539', st: '#2b3e57', rdc: '#1b2d30', cour: '#1f3a2c', blocked: '#3b4246', todo: '#5c2f2f', doing: '#5d4c1d', check: '#1f4d36', wallA: '#7b9a96', wallB: '#3d5d5c', slab: '#081214', edge: '#0b1719', label: '#f2f7f6', labelBg: '#14282c', alert: '#ff5a4d', sel: '#e3b95c', men: '#5cc4b3', ring: '#14282c' }
      : { ch: '#dcece6', cor: '#f3efe2', svc: '#e4e7ea', st: '#cdd8e6', rdc: '#e7e9e6', cour: '#cfe3c8', blocked: '#c6c9ce', todo: '#f6d2cb', doing: '#f8e7a6', check: '#c9edd5', wallA: '#ffffff', wallB: '#bccbc6', slab: '#93a9a2', edge: '#7d928c', label: '#14272b', labelBg: '#ffffff', alert: '#d92d20', sel: '#f0b429', men: '#1c7468', ring: '#ffffff' } },
    poupee: { l: 'Maison de poupée', wallH: 2.3, cut: true, beds: true, shadow: true, bg: ['#f8f0e3', '#ead9bf'], pal: () => ({ ch: '#e4c497', cor: '#d9d3c5', svc: '#cdd5d6', st: '#c8b79e', rdc: '#ddd6c8', cour: '#b7d1a5', blocked: '#c8c2b9', todo: '#ebb7a5', doing: '#f1da8c', check: '#bfe0b3', wallA: '#fffaf2', wallB: '#dfcfb8', slab: '#a3876a', edge: '#8b7355', label: '#3a2c1c', labelBg: '#fffaf2', alert: '#d92d20', sel: '#f0b429', men: '#1c8f80', ring: '#ffffff' }) },
    nuit: { l: 'Nuit', wallH: 0.95, lit: true, bg: ['#070b1c', '#1a2145'], pal: () => ({ ch: '#1d2547', cor: '#262e55', svc: '#20284b', st: '#2f3970', rdc: '#151b37', cour: '#16302c', blocked: '#12162a', todo: '#1d2547', doing: '#1d2547', check: '#1d2547', lit: '#ffcf6e', wallA: '#4d5890', wallB: '#2a3262', slab: '#070a18', edge: '#0a0d20', label: '#eef0ff', labelBg: '#0b0f24', alert: '#ff5a4d', sel: '#7fe0d0', men: '#7fe0d0', ring: '#0b0f24' }) },
    holo: { l: 'Hologramme', wallH: 1.1, wire: true, grid: true, bg: ['#03101a', '#082033'], pal: () => ({ ch: 'rgba(70,225,255,0.13)', cor: 'rgba(70,225,255,0.05)', svc: 'rgba(130,160,255,0.09)', st: 'rgba(160,130,255,0.18)', rdc: 'rgba(70,225,255,0.04)', cour: 'rgba(70,255,190,0.07)', blocked: 'rgba(255,255,255,0.03)', todo: 'rgba(255,90,110,0.24)', doing: 'rgba(255,210,90,0.24)', check: 'rgba(90,255,170,0.22)', wallA: 'rgba(70,225,255,0.07)', wallB: 'rgba(70,225,255,0.07)', slab: null, edge: 'rgba(110,235,255,0.85)', label: '#c8f6ff', labelBg: '#04131f', alert: '#ff4d6a', sel: 'rgba(255,209,102,0.45)', men: '#5ef2c7', ring: '#04131f' }) },
  };
  if (!STY[V.style]) V.style = 'maquette';
  let PAL = STY[V.style].pal();

  /* ---------- Projection ---------- */
  const B = {};
  const elev = (l) => l * FH * V.spread;
  function setBasis() {
    const c = V.cam, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    B.r = [cy, 0, -sy]; B.u = [-sy * sp, cp, -cy * sp]; B.d = [sy * cp, sp, cy * cp];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const top = Math.max(2.6, STY[V.style].wallH + 0.4);
    HT().floors.forEach((f) => {
      if (V.iso !== null && V.iso !== f.lvl) return;
      const e = elev(f.lvl);
      f.spaces.forEach((s) => s.m.forEach((p) => [e - 0.3, e + top].forEach((y) => {
        const sx = p[0] * B.r[0] + p[1] * B.r[2], sy2 = -(p[0] * B.u[0] + y * B.u[1] + p[1] * B.u[2]);
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy2 < y0) y0 = sy2; if (sy2 > y1) y1 = sy2;
      })));
    });
    B.s = Math.min((W - 28) / (x1 - x0), (Hc - 60) / (y1 - y0)) * c.zoom;
    B.ox = W / 2 - B.s * (x0 + x1) / 2 + c.px; B.oy = (Hc - 14) / 2 - B.s * (y0 + y1) / 2 + c.py;
  }
  const P = (x, y, z) => [B.ox + B.s * (x * B.r[0] + z * B.r[2]), B.oy - B.s * (x * B.u[0] + y * B.u[1] + z * B.u[2]), x * B.d[0] + y * B.d[1] + z * B.d[2]];
  function pathPoly(pts) { ctx.beginPath(); for (let i = 0; i < pts.length; i++) { if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); } ctx.closePath(); }
  function rrect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

  const occupied = (r) => !!r && (S.occRooms || []).includes(r.id);
  function fillFor(hk, s) {
    if (V.sel === s.key) return PAL.sel;
    const r = roomOf(hk, s);
    if (s.k === 'ch') {
      if (r && r.blocked) return PAL.blocked;
      if (STY[V.style].lit) return occupied(r) ? PAL.lit : PAL.ch;
      if (r && r.status === 'a_faire') return PAL.todo;
      if (r && r.status === 'en_cours') return PAL.doing;
      if (r && r.status === 'a_controler') return PAL.check;
      return PAL.ch;
    }
    return PAL[s.k] || PAL.svc;
  }
  function box(quads, x, z, w, l, y0, h, colTop, colSide) {
    const c = [[x - w / 2, z - l / 2], [x + w / 2, z - l / 2], [x + w / 2, z + l / 2], [x - w / 2, z + l / 2]];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4;
      const a = P(c[i][0], y0, c[i][1]), b = P(c[j][0], y0, c[j][1]), cc = P(c[j][0], y0 + h, c[j][1]), d = P(c[i][0], y0 + h, c[i][1]);
      quads.push({ q: [a, b, cc, d], z: (a[2] + b[2] + cc[2] + d[2]) / 4, fill: colSide }); }
    const tp = c.map((p) => P(p[0], y0 + h, p[1]));
    quads.push({ q: tp, z: (tp[0][2] + tp[1][2] + tp[2][2] + tp[3][2]) / 4 + 0.4, fill: colTop });
  }
  function drawFloor(hk, f, alpha) {
    const St = STY[V.style], y = elev(f.lvl), wallH = f.flat ? 0 : St.wallH;
    ctx.globalAlpha = alpha;
    if (PAL.slab) f.spaces.forEach((s) => { pathPoly(s.m.map((p) => P(p[0], y - 0.28, p[1]))); ctx.fillStyle = PAL.slab; ctx.fill(); });
    f.spaces.forEach((s) => {
      s.scr = s.m.map((p) => P(p[0], y, p[1]));
      pathPoly(s.scr); ctx.fillStyle = fillFor(hk, s);
      const r = roomOf(hk, s);
      if (St.lit && V.sel !== s.key && s.k === 'ch' && r && !r.blocked && occupied(r)) { ctx.shadowColor = 'rgba(255,200,100,0.85)'; ctx.shadowBlur = 16; }
      ctx.fill(); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      ctx.lineWidth = St.wire ? 1.2 : 1; ctx.strokeStyle = PAL.edge; ctx.stroke();
      if (s.k === 'st') {
        const xs = s.m.map((p) => p[0]), zs = s.m.map((p) => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), n = 7;
        ctx.beginPath();
        for (let i = 1; i < n; i++) { let a, b;
          if (x1 - x0 > z1 - z0) { a = P(x0 + (x1 - x0) * i / n, y, z0 + 0.15); b = P(x0 + (x1 - x0) * i / n, y, z1 - 0.15); }
          else { a = P(x0 + 0.15, y, z0 + (z1 - z0) * i / n); b = P(x1 - 0.15, y, z0 + (z1 - z0) * i / n); }
          ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        ctx.lineWidth = 1; ctx.stroke();
      }
    });
    if (wallH) {
      const quads = []; let dmin = 1e9, dmax = -1e9;
      if (St.cut) f.spaces.forEach((s) => s.m.forEach((p) => { const d = p[0] * B.d[0] + p[1] * B.d[2]; if (d < dmin) dmin = d; if (d > dmax) dmax = d; }));
      f.spaces.forEach((s) => {
        if (s.k === 'cour') return;
        const m = s.m;
        for (let i = 0; i < m.length; i++) { const j = (i + 1) % m.length; let h = wallH;
          if (St.cut) { const dm = ((m[i][0] + m[j][0]) / 2) * B.d[0] + ((m[i][1] + m[j][1]) / 2) * B.d[2]; const tt = (dmax - dm) / ((dmax - dmin) || 1); h = 0.3 + (wallH - 0.3) * Math.pow(tt, 1.15); }
          const a = P(m[i][0], y, m[i][1]), b = P(m[j][0], y, m[j][1]), c = P(m[j][0], y + h, m[j][1]), d = P(m[i][0], y + h, m[i][1]);
          const dx = m[j][0] - m[i][0], dz = m[j][1] - m[i][1], L = Math.sqrt(dx * dx + dz * dz) || 1;
          quads.push({ q: [a, b, c, d], z: (a[2] + b[2] + c[2] + d[2]) / 4, k: Math.abs(dz / L * 0.35 + dx / L * 0.94), wall: true }); }
        if (St.beds && s.k === 'ch') { const r = roomOf(hk, s), off = !!(r && r.blocked);
          box(quads, s.c[0], s.c[1], 1.5, 2.0, y, 0.32, '#8a6a4a', '#7a5c40');
          box(quads, s.c[0], s.c[1], 1.4, 1.9, y + 0.32, 0.2, off ? '#e9e4dc' : '#ffffff', '#efe8dc');
          box(quads, s.c[0], s.c[1] + 0.35, 1.42, 1.2, y + 0.52, 0.05, off ? '#b9b3aa' : '#7fb7a8', '#6aa293');
          box(quads, s.c[0], s.c[1] - 0.68, 0.9, 0.36, y + 0.52, 0.1, '#fbf6ee', '#e9e0d2'); }
      });
      quads.sort((p, q) => p.z - q.z);
      quads.forEach((w) => { pathPoly(w.q);
        if (w.wall) { if (St.wire) { ctx.fillStyle = PAL.wallA; ctx.fill(); ctx.strokeStyle = 'rgba(110,235,255,0.45)'; ctx.lineWidth = 1; ctx.stroke(); }
          else { ctx.fillStyle = mix(PAL.wallB, PAL.wallA, w.k); ctx.fill(); ctx.strokeStyle = PAL.edge; ctx.lineWidth = 0.6; ctx.stroke(); } }
        else { ctx.fillStyle = w.fill; ctx.fill(); } });
    }
    const sel = V.sel && HT().SP[V.sel];
    if (sel && sel.floor === f) { pathPoly(sel.m.map((p) => P(p[0], y + (St.cut ? 0.05 : wallH), p[1]))); ctx.strokeStyle = '#f0b429'; ctx.lineWidth = 3; ctx.stroke(); }
    if (alpha > 0.5) {
      const fs = Math.max(10, Math.min(17, B.s * 1.05)), ly = y + Math.min(wallH, 1.0) + 0.05;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      f.spaces.forEach((s) => {
        const txt = shown(hk, s); if (!txt) return;
        const p = P(s.c[0], ly, s.c[1] + ((St.beds && s.k === 'ch') ? 1.45 : 0));
        const f2 = txt.length > 6 ? Math.max(9, fs * 0.72) : fs;
        ctx.font = '700 ' + f2 + 'px system-ui,-apple-system,"Segoe UI",sans-serif';
        const tw = ctx.measureText(txt).width + 8;
        ctx.globalAlpha = alpha * 0.84; ctx.fillStyle = PAL.labelBg; rrect(p[0] - tw / 2, p[1] - f2 * 0.72, tw, f2 * 1.44, 4); ctx.fill();
        ctx.globalAlpha = alpha; ctx.fillStyle = PAL.label; ctx.fillText(txt, p[0], p[1] + 0.5);
      });
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Ce qui se passe vraiment : ménages en cours et problèmes signalés ---------- */
  function buildEnts() {
    const hk = curHotel(), want = [], lost = [];
    Object.values(S.rooms).filter((r) => r.hotel === hk && r.status === 'en_cours' && !r.blocked).forEach((r) => {
      const sp = spaceOfRoom(hk, r.id); const who = r.assignee ? first(nameOf(r.assignee)) : '';
      if (!sp) { lost.push({ ty: 'men', room: r, who }); return; }
      let id = 'm:' + (r.assignee || r.id); if (want.some((w) => w.id === id)) id = 'm:' + r.id;
      want.push({ id, ty: 'men', sp, tag: who || 'Ménage', room: r, who });
    });
    const byKey = {};
    (S.issues || []).filter((i) => i.hotel === hk && repEtat(i) !== 'fait').forEach((i) => {
      const r = roomOfIssue(i), sp = r ? spaceOfRoom(hk, r.id) : null;
      if (!sp) { lost.push({ ty: 'iss', issue: i }); return; }
      const e = byKey[sp.key] || (byKey[sp.key] = { id: 'i:' + sp.key, ty: 'iss', sp, issues: [], urgent: false });
      e.issues.push(i); if (i.priority === 'urgent') e.urgent = true;
    });
    Object.values(byKey).forEach((e) => want.push(e));
    const seen = {};
    want.forEach((w) => { seen[w.id] = true;
      let en = V.ents.find((x) => x.id === w.id);
      if (!en) { en = { id: w.id, from: w.sp, to: w.sp, t: 1, a: V.ents.length || lastDraw ? 0 : 1, gone: false }; V.ents.push(en); }
      else if (en.to !== w.sp) { en.from = en.to; en.to = w.sp; en.t = 0; }
      Object.assign(en, { ty: w.ty, tag: w.tag, room: w.room, who: w.who, issues: w.issues, urgent: w.urgent, gone: false });
    });
    V.ents.forEach((x) => { if (!seen[x.id]) x.gone = true; });
    V.lost = lost; V.dirty = true;
  }
  function entPos(e) { const k = e.t < 1 ? (e.t * e.t * (3 - 2 * e.t)) : 1, a = e.from, b = e.to; return [a.c[0] + (b.c[0] - a.c[0]) * k, elev(a.lvl) + (elev(b.lvl) - elev(a.lvl)) * k, a.c[1] + (b.c[1] - a.c[1]) * k]; }
  function stepEnts(dt) {
    let moving = false;
    V.ents.forEach((e) => { if (e.t < 1) { e.t = Math.min(1, e.t + dt / 1800); moving = true; }
      const ta = e.gone ? 0 : 1; if (e.a !== ta) { e.a += (ta > e.a ? 1 : -1) * dt / 500; e.a = Math.max(0, Math.min(1, e.a)); moving = true; } });
    V.ents = V.ents.filter((e) => !(e.gone && e.a <= 0));
    return moving;
  }
  function drawEnts(ts) {
    const St = STY[V.style];
    V.ents.forEach((e) => {
      const p = entPos(e), al = ((V.iso === null || V.iso === e.to.lvl) ? 1 : 0.28) * e.a;
      if (al <= 0.01) { e.scr = null; return; }
      const a = P(p[0], p[1], p[2]), ph = reduce ? 0.45 : ((ts || 0) % (e.urgent ? 1000 : 1600)) / (e.urgent ? 1000 : 1600);
      if (V.fig && e.ty === 'men') {
        const col = PAL.men, bob = (e.t < 1 && !reduce) ? Math.abs(Math.sin((ts || 0) / 110)) * 0.08 : 0;
        const top = P(p[0], p[1] + 1.25 + bob, p[2]), head = P(p[0], p[1] + 1.55 + bob, p[2]);
        const rw = Math.max(4.5, B.s * 0.27), rh = Math.max(4, B.s * 0.21);
        ctx.globalAlpha = al * 0.28; ctx.beginPath(); ctx.ellipse(a[0], a[1], rw * 1.15, rw * 0.55, 0, 0, 6.283); ctx.fillStyle = '#000'; ctx.fill();
        ctx.globalAlpha = al; ctx.beginPath(); ctx.moveTo(a[0] - rw, a[1]); ctx.quadraticCurveTo(a[0] - rw * 0.9, top[1], a[0] - rw * 0.45, top[1]); ctx.lineTo(a[0] + rw * 0.45, top[1]); ctx.quadraticCurveTo(a[0] + rw * 0.9, top[1], a[0] + rw, a[1]); ctx.closePath();
        ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.ring; ctx.stroke();
        ctx.beginPath(); ctx.arc(head[0], head[1] - rh * 0.2, rh, 0, 6.283); ctx.fillStyle = col; ctx.fill(); ctx.stroke();
        if (St.wire || St.lit) { ctx.globalAlpha = al * (1 - ph) * 0.5; ctx.beginPath(); ctx.ellipse(a[0], a[1], rw * (1.2 + 1.6 * ph), rw * (0.6 + 0.8 * ph), 0, 0, 6.283); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
        const tag = e.tag || 'Ménage'; ctx.font = '700 11px system-ui,-apple-system,"Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(tag).width + 10, ty = head[1] - rh * 1.2 - 12;
        ctx.globalAlpha = al; ctx.fillStyle = col; rrect(head[0] - tw / 2, ty - 8, tw, 16, 8); ctx.fill();
        ctx.fillStyle = PAL.ring; ctx.fillText(tag, head[0], ty + 0.5);
        e.scr = [head[0], (head[1] + a[1]) / 2];
      } else {
        const b = P(p[0], p[1] + 2.1, p[2]), n = e.issues ? e.issues.length : 0;
        ctx.globalAlpha = al; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = PAL.alert; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(a[0], a[1], 3, 0, 6.283); ctx.fillStyle = PAL.alert; ctx.fill();
        ctx.globalAlpha = al * (1 - ph) * 0.55; ctx.beginPath(); ctx.arc(b[0], b[1], 8 + 16 * ph, 0, 6.283); ctx.fill();
        ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(b[0], b[1], 8, 0, 6.283); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = PAL.ring; ctx.stroke();
        if (n > 1) { ctx.font = '700 10px system-ui,-apple-system,"Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(String(n), b[0], b[1] + 0.5); }
        e.scr = b;
      }
    });
    ctx.globalAlpha = 1;
  }
  function drawBackdrop() {
    const St = STY[V.style];
    if (St.bg) { const g = ctx.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, St.bg[0]); g.addColorStop(1, St.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hc); }
    const f0 = HT().floors.find((f) => V.iso === null || V.iso === f.lvl); if (!f0) return;
    const y = elev(f0.lvl) - 0.45;
    if (St.grid) { const ex = HT().ext[0] + 4, ez = HT().ext[1] + 4; ctx.beginPath();
      for (let v = -Math.ceil(ex / 2) * 2; v <= ex; v += 2) { const a = P(v, y, -ez), b = P(v, y, ez); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      for (let v = -Math.ceil(ez / 2) * 2; v <= ez; v += 2) { const c = P(-ex, y, v), d = P(ex, y, v); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); }
      ctx.strokeStyle = 'rgba(110,235,255,0.13)'; ctx.lineWidth = 1; ctx.stroke(); }
    if (St.shadow) { ctx.save(); ctx.beginPath();
      f0.spaces.forEach((s) => { s.m.forEach((p, i) => { const q = P(p[0], y, p[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); });
      ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12; ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fill(); ctx.restore(); }
  }
  function draw(ts) {
    if (!ctx || W < 10) return;
    const hk = curHotel();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hc); ctx.lineJoin = 'round';
    setBasis(); drawBackdrop();
    HT().floors.forEach((f) => drawFloor(hk, f, (V.iso === null || V.iso === f.lvl) ? 1 : 0.1));
    drawEnts(ts);
  }
  function loop(ts) {
    raf = 0;
    if (!cv || !document.body.contains(cv)) { cv = null; ctx = null; return; }
    const dt = Math.min(100, (ts - lastTs) || 16); lastTs = ts;
    if (V.tgt) { let done = true;
      ['yaw', 'pitch', 'zoom', 'px', 'py'].forEach((n) => { if (V.tgt[n] === undefined) return; const d = V.tgt[n] - V.cam[n]; if (Math.abs(d) > 0.002) { V.cam[n] += d * 0.16; done = false; } else V.cam[n] = V.tgt[n]; });
      if (done) V.tgt = null; V.dirty = true; }
    if (stepEnts(dt)) V.dirty = true;
    const pulse = !reduce && V.ents.length && document.visibilityState === 'visible' && ts - lastDraw > 40;
    if (V.dirty || pulse) { draw(ts); V.dirty = false; lastDraw = ts; }
    raf = requestAnimationFrame(loop);
  }
  const kick = () => { V.dirty = true; if (!raf && cv) raf = requestAnimationFrame(loop); };

  /* ---------- Toucher, tourner, zoomer ---------- */
  function inside(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function pick(x, y) {
    for (const e of V.ents) if (e.scr && Math.hypot(e.scr[0] - x, e.scr[1] - y) < 18) return e.to;
    const F = HT().floors;
    for (let l = F.length - 1; l >= 0; l--) { const f = F[l]; if (V.iso !== null && V.iso !== f.lvl) continue;
      for (let i = f.spaces.length - 1; i >= 0; i--) if (f.spaces[i].scr && inside([x, y], f.spaces[i].scr)) return f.spaces[i]; }
    return null;
  }
  const ptrs = {}; let moved = 0, pinch = null;
  function bind(c) {
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', (e) => { try { c.setPointerCapture(e.pointerId); } catch (_) {} ptrs[e.pointerId] = pos(e); moved = 0; pinch = null; V.tgt = null; if (V.top) { V.top = false; syncCtl(); } });
    c.addEventListener('pointermove', (e) => {
      if (!ptrs[e.pointerId]) return;
      const p = pos(e), o = ptrs[e.pointerId], ids = Object.keys(ptrs);
      if (ids.length === 1) { const dx = p[0] - o[0], dy = p[1] - o[1]; moved += Math.abs(dx) + Math.abs(dy);
        V.cam.yaw -= dx * 0.008; V.cam.pitch = Math.max(0.22, Math.min(1.553, V.cam.pitch + dy * 0.006)); ptrs[e.pointerId] = p; kick(); }
      else if (ids.length === 2) { ptrs[e.pointerId] = p; moved += 10;
        const a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (pinch) { V.cam.zoom = Math.max(0.6, Math.min(4, V.cam.zoom * d / pinch.d)); V.cam.px += mx - pinch.mx; V.cam.py += my - pinch.my; }
        pinch = { d, mx, my }; kick(); }
    });
    const up = (e) => { if (!ptrs[e.pointerId]) return; const p = pos(e), n = Object.keys(ptrs).length; delete ptrs[e.pointerId]; pinch = null;
      if (n === 1 && moved < 7 && e.type === 'pointerup') { const s = pick(p[0], p[1]); V.sel = s ? s.key : null; syncInfo(); kick(); } };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); V.cam.zoom = Math.max(0.6, Math.min(4, V.cam.zoom * (e.deltaY < 0 ? 1.1 : 0.91))); kick(); }, { passive: false });
    c.addEventListener('keydown', (e) => { const k = e.key; let used = true;
      if (k === 'ArrowLeft') V.cam.yaw += 0.12; else if (k === 'ArrowRight') V.cam.yaw -= 0.12;
      else if (k === 'ArrowUp') V.cam.pitch = Math.min(1.553, V.cam.pitch + 0.08); else if (k === 'ArrowDown') V.cam.pitch = Math.max(0.22, V.cam.pitch - 0.08);
      else if (k === '+' || k === '=') V.cam.zoom = Math.min(4, V.cam.zoom * 1.1); else if (k === '-') V.cam.zoom = Math.max(0.6, V.cam.zoom * 0.91); else used = false;
      if (used) { e.preventDefault(); kick(); } });
  }
  function resize() { if (!cv) return; const r = cv.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2.5); W = Math.max(10, r.width); Hc = Math.max(10, r.height); cv.width = Math.round(W * dpr); cv.height = Math.round(Hc * dpr); kick(); }

  /* ---------- Écran ---------- */
  const seg = (a, items, cur) => `<div class="seg">${items.map(([k, l]) => `<button data-a="${a}" data-k="${k}" aria-pressed="${String(k) === String(cur)}">${esc(l)}</button>`).join('')}</div>`;
  function ctlHtml() {
    const F = HT().floors;
    return `<div class="v3d-row"><span class="v3d-lab">Étage</span>${seg('v3dIso', [['all', 'Tous']].concat(F.slice().reverse().map((f) => [f.lvl, f.chip])), V.iso === null ? 'all' : V.iso)}</div>
      <div class="v3d-row"><span class="v3d-lab">Style</span>${seg('v3dStyle', Object.keys(STY).map((k) => [k, STY[k].l]), V.style)}</div>
      <div class="v3d-row"><label class="v3d-lab" for="v3dSpread">Écart</label><input type="range" id="v3dSpread" min="100" max="260" value="${Math.round(V.spread * 100)}" aria-label="Écart entre les étages"></div>
      <div class="v3d-row"><button class="toggle" data-a="v3dFig" aria-pressed="${!!V.fig}">Personnages</button><button class="toggle" data-a="v3dTop" aria-pressed="${!!V.top}">Vue de dessus</button><button class="btn small" data-a="v3dReset">Recentrer</button></div>`;
  }
  function infoHtml() {
    const hk = curHotel(), s = V.sel && HT().SP[V.sel]; if (!s) return '';
    const r = roomOf(hk, s), chips = [];
    if (r) {
      if (r.blocked) chips.push(`<span class="chip">Bloquée${r.blockReason ? ' : ' + esc(r.blockReason) : ''}</span>`);
      else if (ST[r.status]) chips.push(`<span class="chip c-${ST[r.status].c}">${esc(ST[r.status].l)}</span>`);
      if (r.status === 'en_cours' && r.assignee) chips.push(`<span class="chip c-amber">🧹 ${esc(first(nameOf(r.assignee)))}</span>`);
      if (occupied(r)) { const n = typeof occOfRoom === 'function' ? occOfRoom(r.id).length : 0; chips.push(`<span class="chip">Occupée${n ? ' · ' + n + ' personne' + (n > 1 ? 's' : '') : ''}</span>`); }
    }
    const iss = (V.ents.find((e) => e.ty === 'iss' && e.to === s && !e.gone) || {}).issues || [];
    const all = Object.values(S.rooms).filter((x) => x.hotel === hk).sort((a, b) => a.order - b.order), cur = ridOf(hk, s) || '';
    return `<div class="card"><div class="row between"><h3>${esc(titleOf(hk, s))}</h3><button class="btn small" data-a="v3dClose">Fermer</button></div>
      <p class="muted">${esc(s.floor.name)} · ${esc(hotelName(hk))}</p>
      ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
      ${iss.length ? `<div class="list">${iss.map((i) => `<div class="li"><span class="t">🔧 ${esc(repTitle(i))}${i.priority === 'urgent' ? ' <span class="chip c-red">urgent</span>' : ''}</span></div>`).join('')}</div>` : ''}
      ${r ? `<div class="row"><button class="btn small" data-a="roomSheet" data-id="${r.id}">📋 Ouvrir la fiche</button></div>` : (s.k === 'ch' ? '<p class="muted">Cette pièce du plan n’est rattachée à aucune chambre de l’appli.</p>' : '')}
      <label class="v3d-map">Sur le plan, cette pièce est
        <select id="v3dMap"><option value="">(aucune chambre)</option>${all.map((x) => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(placeName(x))}</option>`).join('')}</select></label>
      <p class="muted">Si le numéro est faux, choisissez la bonne chambre : les deux pièces échangent leur place sur le plan, pour tous les gérants.</p></div>`;
  }
  function listHtml() {
    const hk = curHotel(), rows = [];
    V.ents.filter((e) => !e.gone).forEach((e) => {
      if (e.ty === 'men') rows.push(`<button class="li v3d-li" data-a="v3dPick" data-k="${e.to.key}"><span class="v3d-dot men"></span><span class="t"><b>Ménage en cours${e.who ? ' · ' + esc(e.who) : ''}</b><br><span class="muted">${esc(titleOf(hk, e.to))} · ${esc(e.to.floor.name)}${e.room && e.room.startedAt && typeof hm === 'function' ? ' · depuis ' + hm(e.room.startedAt) : ''}</span></span></button>`);
      else (e.issues || []).forEach((i) => rows.push(`<button class="li v3d-li" data-a="v3dPick" data-k="${e.to.key}"><span class="v3d-dot"></span><span class="t"><b>${esc(repTitle(i))}</b>${i.priority === 'urgent' ? ' <span class="chip c-red">urgent</span>' : ''}<br><span class="muted">${esc(titleOf(hk, e.to))} · ${esc(e.to.floor.name)}</span></span></button>`));
    });
    V.lost.forEach((x) => rows.push(x.ty === 'men'
      ? `<div class="li"><span class="v3d-dot men"></span><span class="t"><b>Ménage en cours${x.who ? ' · ' + esc(x.who) : ''}</b><br><span class="muted">${esc(placeName(x.room))} · pas encore placé sur le plan</span></span></div>`
      : `<div class="li"><span class="v3d-dot"></span><span class="t"><b>${esc(repTitle(x.issue))}</b>${x.issue.priority === 'urgent' ? ' <span class="chip c-red">urgent</span>' : ''}<br><span class="muted">${esc(x.issue.room || 'Lieu non précisé')} · pas placé sur le plan</span></span></div>`));
    return rows.length ? `<div class="list">${rows.join('')}</div>` : '<p class="muted">Aucun ménage en cours et aucun problème ouvert dans cet hôtel.</p>';
  }
  function legHtml() {
    const sw = (c, l, dot) => `<span class="v3d-leg"><i class="${dot ? 'dot' : ''}" style="background:${c}"></i>${l}</span>`;
    const St = STY[V.style];
    return sw(PAL.alert, 'Problème signalé, pas encore réglé', true) + sw(PAL.men, V.fig ? 'Personnage : ménage en cours' : 'Ménage en cours', true)
      + (St.lit ? sw(PAL.lit, 'Chambre éclairée : occupée') + sw(PAL.ch, 'Chambre libre')
        : sw(PAL.ch, 'Chambre prête') + sw(PAL.todo, 'À faire') + sw(PAL.doing, 'En cours') + sw(PAL.check, 'À contrôler'))
      + sw(PAL.blocked, 'Chambre bloquée') + sw(PAL.cor, 'Couloir, entrée') + sw(PAL.st, 'Escalier');
  }
  function view() {
    const hk = curHotel(), L = hotelsShown();
    return `<div class="v3d">
      ${L.length > 1 ? seg('v3dHotel', L.map((h) => [h.id, h.name]), hk) : ''}
      <div class="card v3d-stage"><div class="v3d-wrap"><canvas id="v3dCanvas" tabindex="0" role="img" aria-label="Maquette 3D de l’hôtel : étages, chambres numérotées, ménages en cours et problèmes signalés. La liste « En ce moment », plus bas, donne les mêmes informations en texte."></canvas><span class="v3d-hint">Glissez pour tourner, touchez une pièce</span></div>
        <div id="v3dCtl" class="v3d-ctl">${ctlHtml()}</div></div>
      <div id="v3dInfo">${infoHtml()}</div>
      <div class="card"><h3>En ce moment · ${esc(hotelName(hk))}</h3><div id="v3dList">${listHtml()}</div></div>
      <div class="card"><h3>Légende</h3><div id="v3dLeg" class="v3d-legs">${legHtml()}</div>
        <p class="muted">Plans : dossiers de travaux 2024 (Archange, Hôtel de Paris) et plans d’évacuation 2025 (Châteaudun). Proportions justes à quelques dizaines de centimètres près. Les caméras ne sont pas encore branchées.</p></div>
    </div>`;
  }
  const put = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  function bindCtl() {
    const sp = document.getElementById('v3dSpread'); if (sp && !sp.dataset.b) { sp.dataset.b = '1'; sp.addEventListener('input', () => { V.spread = sp.value / 100; kick(); }); }
    const mp = document.getElementById('v3dMap'); if (mp && !mp.dataset.b) { mp.dataset.b = '1'; mp.addEventListener('change', () => remap(mp.value)); }
  }
  function syncCtl() { put('v3dCtl', ctlHtml()); bindCtl(); }
  function syncInfo() { put('v3dInfo', infoHtml()); bindCtl(); }
  function syncAll() { PAL = STY[V.style].pal(); put('v3dCtl', ctlHtml()); put('v3dInfo', infoHtml()); put('v3dList', listHtml()); put('v3dLeg', legHtml()); bindCtl(); kick(); }
  // Appelé après chaque affichage de l'appli : raccroche le dessin au nouveau canevas.
  function mount() {
    const c = document.getElementById('v3dCanvas');
    if (!c) { cv = null; ctx = null; return; }
    PAL = STY[V.style].pal();
    if (c !== cv) { cv = c; ctx = c.getContext('2d'); bind(c); if (ro) ro.disconnect(); if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(c); } }
    buildEnts(); put('v3dList', listHtml()); put('v3dInfo', infoHtml()); bindCtl(); resize();
    if (ctx) draw(performance.now());
  }
  window.addEventListener('resize', () => { if (cv) resize(); });

  // Corriger un numéro : la pièce touchée prend la chambre choisie, et la pièce qui l'avait prend l'ancienne (échange).
  async function remap(rid) {
    const hk = curHotel(), s = V.sel && HT().SP[V.sel]; if (!s) return;
    const old = ridOf(hk, s), m = { ...vMap(hk) }, other = rid ? spaceOfRoom(hk, rid) : null;
    if ((rid || null) === (old || null)) return;
    m[s.key] = rid || '';
    if (other && other !== s) m[other.key] = old || '';
    const v3d = { ...((S.cfg || {}).v3d || {}) }; v3d.map = { ...(v3d.map || {}), [hk]: m };
    S.cfg = { ...S.cfg, v3d };
    syncAll(); buildEnts(); put('v3dList', listHtml());
    await saveCfg(S.cfg);
  }

  /* ---------- Branchements dans l'appli ---------- */
  const st = document.createElement('style');
  st.textContent = `.v3d{display:flex;flex-direction:column;gap:12px;min-width:0}
    .v3d-stage{padding:0;overflow:hidden;gap:0}
    .v3d-wrap{position:relative;height:min(58vh,560px);min-height:320px}
    .v3d-wrap canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}
    .v3d-wrap canvas:focus-visible{outline:3px solid var(--accent);outline-offset:-3px}
    .v3d-hint{position:absolute;left:10px;bottom:8px;font-size:12px;color:#fff;background:rgba(20,20,40,.6);padding:2px 8px;border-radius:6px;pointer-events:none}
    .v3d-ctl{display:flex;flex-direction:column;gap:10px;padding:12px;border-top:1px solid var(--line)}
    .v3d-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-width:0}
    .v3d-lab{font-size:13px;font-weight:700;color:var(--ink2);min-width:46px}
    .v3d-row input[type=range]{flex:1;min-width:140px;height:32px;accent-color:var(--accent)}
    .v3d-li{width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer}
    .v3d-dot{width:12px;height:12px;border-radius:50%;background:#d92d20;flex:none;box-shadow:0 0 0 4px rgba(217,45,32,.2)}
    .v3d-dot.men{background:#1c7468;box-shadow:0 0 0 4px rgba(28,116,104,.2)}
    .v3d-map{display:flex;flex-direction:column;gap:4px;font-size:14px;font-weight:700;color:var(--ink2)}
    .v3d-map select{font:inherit;min-height:42px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);padding:6px 10px}
    .v3d-legs{display:flex;flex-wrap:wrap;gap:8px 14px;font-size:14px}
    .v3d-leg{display:inline-flex;align-items:center;gap:6px}
    .v3d-leg i{width:16px;height:13px;border-radius:3px;border:1px solid var(--ink2);display:inline-block}
    .v3d-leg i.dot{width:13px;border-radius:50%;border-color:transparent}`;
  document.head.appendChild(st);

  if (typeof PLUS_F !== 'undefined') PLUS_F.push(['v3d', '🏨 Vue 3D des hôtels', 'Maquette des étages avec les ménages en cours et les problèmes signalés (gérants)']);
  Object.assign(ICO, { cube: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5"/><path d="M12 12v10"/>' });
  SECTIONS.vue3d = { t: 'Vue 3D', i: 'cube', c: 't-teal' };
  PLUS_TABS.push('vue3d');
  const _view = plusView, _tiles = plusTiles, _right = plusRight;
  plusView = function (tab) { if (tab !== 'vue3d') return _view(tab); if (!on()) return null; try { return view(); } catch (e) { return '<div class="card"><p>La vue 3D n’a pas pu s’afficher.</p></div>'; } };
  plusRight = function (tab) { return tab === 'vue3d' ? '' : _right(tab); };
  plusTiles = function () {
    let extra = '';
    try { if (on()) {
      const rs = scoped(Object.values(S.rooms)), men = rs.filter((r) => r.status === 'en_cours' && !r.blocked).length, iss = scoped(S.issues || []).filter((i) => repEtat(i) !== 'fait').length;
      const sub = men || iss ? [men ? men + ' ménage' + (men > 1 ? 's' : '') + ' en cours' : '', iss ? iss + ' problème' + (iss > 1 ? 's' : '') + ' ouvert' + (iss > 1 ? 's' : '') : ''].filter(Boolean).join(' · ') : 'Les étages et ce qui s’y passe';
      extra = tile('vue3d', sub);
    } } catch (e) { extra = ''; }
    return _tiles() + extra;
  };
  // À chaque fois que l'appli redessine son écran, on raccroche la maquette au nouveau canevas (sans jamais bloquer l'appli).
  const appEl = document.getElementById('app');
  if (appEl && window.MutationObserver) new MutationObserver(() => { try { mount(); } catch (e) { /* rien */ } }).observe(appEl, { childList: true });

  Object.assign(A, {
    v3dHotel(d) { if (!GEO[d.k]) return; V.hotel = d.k; LS.set('mh-v3d-hotel', d.k); V.cam = { yaw: GEO[d.k].yaw, pitch: 0.62, zoom: 1, px: 0, py: 0 }; V.tgt = null; V.top = false; V.iso = null; V.sel = null; V.ents = []; render(); },
    v3dIso(d) { V.iso = d.k === 'all' ? null : +d.k; syncCtl(); kick(); },
    v3dStyle(d) { if (!STY[d.k]) return; V.style = d.k; LS.set('mh-v3d-style', d.k); syncAll(); },
    v3dFig() { V.fig = !V.fig; LS.set('mh-v3d-fig', V.fig); syncAll(); },
    v3dTop() { V.top = !V.top; if (V.top) { V.before = { yaw: V.cam.yaw, pitch: V.cam.pitch }; V.tgt = { yaw: 0, pitch: 1.553, px: 0, py: 0 }; } else V.tgt = V.before ? { ...V.before } : { yaw: HT().yaw, pitch: 0.62 }; syncCtl(); kick(); },
    v3dReset() { V.top = false; V.tgt = { yaw: HT().yaw, pitch: 0.62, zoom: 1, px: 0, py: 0 }; syncCtl(); kick(); },
    v3dPick(d) { const s = HT().SP[d.k]; if (!s) return; if (V.iso !== null && V.iso !== s.lvl) { V.iso = null; syncCtl(); } V.sel = s.key; syncInfo(); kick(); if (cv) cv.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); },
    v3dClose() { V.sel = null; syncInfo(); kick(); },
  });
})();
