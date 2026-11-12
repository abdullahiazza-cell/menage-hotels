"use strict";
/* Ma Réception — mode travaux : plan à l'échelle et vue 3D d'une chambre, à partir des mesures de la fiche.
   On glisse la porte, la fenêtre et les meubles à leur place ; l'appli propose des dispositions (1 lit double, 2 lits simples…)
   et vérifie que tout tient. Aucune bibliothèque externe : le dessin 3D est fait ici, en WebGL. Chargé après travaux.js. */

// Dimensions en centimètres : largeur (w), profondeur (d), hauteur (h). La tête d'un lit et le dos d'un meuble sont du côté « haut » (−d/2).
const TR_FURN = {
  lit_s: { l: 'Lit simple', s: 'Lit 90', w: 90, d: 190, h: 55 }, lit_d: { l: 'Lit double', s: 'Lit 140', w: 140, d: 190, h: 55 },
  chevet: { l: 'Chevet', s: '', w: 40, d: 40, h: 50 }, bureau: { l: 'Bureau', s: 'Bureau', w: 100, d: 50, h: 75 },
  chaise: { l: 'Chaise', s: '', w: 45, d: 45, h: 85 }, fauteuil: { l: 'Fauteuil', s: 'Faut.', w: 75, d: 75, h: 80 },
  armoire: { l: 'Armoire', s: 'Armoire', w: 100, d: 60, h: 200 }, tv: { l: 'Télé murale', s: 'TV', w: 100, d: 8, h: 56 },
  bagages: { l: 'Porte-bagages', s: 'Bag.', w: 60, d: 45, h: 50 }, meuble: { l: 'Meuble', s: 'Meuble', w: 80, d: 40, h: 80 },
  // Salle de bain
  wc: { l: 'WC', s: 'WC', w: 38, d: 62, h: 80, san: 1 }, lavabo: { l: 'Lavabo', s: 'Lav.', w: 60, d: 46, h: 88, san: 1 },
  baignoire: { l: 'Baignoire', s: 'Bain', w: 170, d: 70, h: 55, san: 1 }, douche: { l: 'Douche', s: 'Douche', w: 90, d: 120, h: 4, san: 1 },
};
const trIsSan = (it) => !!(TR_FURN[it.t] && TR_FURN[it.t].san);
const TR_CFG = [['d', '1 lit double', ['lit_d']], ['ss', '2 lits simples', ['lit_s', 'lit_s']], ['ds', '1 double + 1 simple', ['lit_d', 'lit_s']], ['sss', '3 lits simples', ['lit_s', 'lit_s', 'lit_s']], ['s', '1 lit simple', ['lit_s']]];
const TR_BANK_MAP = { lit_simple: 'lit_s', lit_double: 'lit_d', bureau: 'bureau', chaise: 'chaise', fauteuil: 'fauteuil', armoire: 'armoire', chevet: 'chevet', tv: 'tv' };
const TR_DOOR_W = 90;
// Largeur de la porte d'entrée de la pièce (réglable : 70, 80, 90… cm).
const trDW = (p) => (p && p.door && trNum(p.door.w)) || TR_DOOR_W;
// Finitions du projet : teintes sobres, actuelles, qui ne se démodent pas. [clé, nom, couleur, motif du sol]
const TR_DECO_MUR = [['blanc', 'Blanc cassé', [0.98, 0.97, 0.94]], ['lin', 'Lin', [0.93, 0.90, 0.84]], ['grege', 'Grège', [0.86, 0.83, 0.77]], ['sauge', 'Vert sauge', [0.76, 0.81, 0.74]], ['bleugris', 'Bleu gris', [0.72, 0.78, 0.83]], ['terracotta', 'Terracotta doux', [0.86, 0.68, 0.58]]];
const TR_DECO_ACCENT = [['', 'Aucun', null], ['sauge', 'Vert sauge', [0.66, 0.74, 0.65]], ['vertprofond', 'Vert profond', [0.29, 0.40, 0.36]], ['bleunuit', 'Bleu nuit', [0.20, 0.27, 0.38]], ['terracotta', 'Terracotta', [0.78, 0.52, 0.40]], ['grege', 'Grège foncé', [0.72, 0.68, 0.61]]];
const TR_DECO_SOL = [['chene', 'Parquet chêne clair', [0.80, 0.64, 0.46], 1], ['chenefume', 'Parquet chêne fumé', [0.55, 0.42, 0.31], 1], ['lvtchene', 'Vinyle imitation chêne', [0.76, 0.62, 0.46], 1], ['pvcgris', 'PVC gris clair', [0.76, 0.74, 0.71], 1], ['moquette', 'Moquette grise', [0.56, 0.58, 0.62], 0], ['carrelage', 'Carrelage clair', [0.86, 0.85, 0.82], 2]];
const TR_DECO_LUM = [['plafonnier', 'Plafonnier LED'], ['spots', 'Spots encastrés'], ['corniche', 'Corniche LED (lumière indirecte)'], ['appliques', 'Appliques liseuses au mur'], ['ruban', 'Ruban LED derrière la tête de lit']];
const trLum = (deco) => (Array.isArray(deco && deco.lum) ? deco.lum : ['plafonnier']);
// Trois niveaux d'aménagement : ce qu'on pose, les finitions et l'éclairage. Les prix ne sont pas ici : ils viennent avec les références, dans la liste.
const TR_NIVEAUX = [
  { k: 'eco', l: 'Essentiel', e: '💶', lvl: 0, deco: { mur: 'blanc', accent: 'sauge', rideau: 'occultant', tissu: 'gris', linge: 'blanc', lum: ['plafonnier', 'appliques'] },
    txt: 'Le moins cher qui fait propre et net : on garde le sol et les meubles en bon état, on repeint en blanc avec le mur de la tête de lit en couleur, rideaux occultants, linge blanc, plafonnier LED et une liseuse par personne.' },
  { k: 'confort', l: 'Confort', e: '⭐', lvl: 1, deco: { mur: 'lin', accent: 'vertprofond', sol: 'lvtchene', rideau: 'double', tissu: 'lin', linge: 'blanc', lum: ['spots', 'appliques', 'ruban'] },
    txt: 'Le meilleur rapport qualité-prix : sol vinyle imitation chêne (solide, facile à laver), voilage + occultants, fauteuil et porte-bagages, spots au plafond, liseuses et ruban LED derrière la tête de lit pour une lumière douce le soir.' },
  { k: 'prestige', l: 'Prestige', e: '💎', lvl: 2, deco: { mur: 'grege', accent: 'bleunuit', sol: 'chenefume', rideau: 'double', tissu: 'anthracite', linge: 'blanc', lum: ['corniche', 'spots', 'appliques', 'ruban'] },
    txt: 'Le haut de gamme : grand lit de 160 quand la pièce le permet, parquet chêne fumé, doubles rideaux épais, mur de tête de lit bleu nuit, corniche LED qui éclaire le plafond sans éblouir, spots, liseuses et ruban LED.' },
];
const TR_DECO_RIDEAU = [['aucun', 'Rien'], ['voilage', 'Voilage'], ['occultant', 'Occultants'], ['double', 'Voilage + occultants']];
const TR_DECO_TISSU = [['lin', 'Lin', [0.88, 0.84, 0.76]], ['gris', 'Gris perle', [0.74, 0.75, 0.77]], ['sauge', 'Vert sauge', [0.60, 0.69, 0.62]], ['bleunuit', 'Bleu nuit', [0.22, 0.29, 0.40]], ['terracotta', 'Terracotta', [0.76, 0.50, 0.38]], ['blanc', 'Blanc', [0.97, 0.97, 0.96]], ['anthracite', 'Anthracite', [0.27, 0.28, 0.30]]];
const trDecoOf = (list, k) => list.find((x) => x[0] === k) || null;
const trCss = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

S.trP = null; // plan ouvert : { rid, view, sel, p (copie de travail), cam }
const trPid = () => 'i' + Math.random().toString(36).slice(2, 8);
const trWDH = (d) => ({ W: trNum(d.len), D: trNum(d.wid), H: trNum(d.hei) || 250 });
const trHasPlan = (d) => !!(trNum(d.len) && trNum(d.wid));
const trM = (cm) => (cm / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';

/* ---------- géométrie du plan ---------- */
function trPlanOf(roomId, src) {
  const d = trData(roomId), { W } = trWDH(d);
  const p = src || d.plan ? JSON.parse(JSON.stringify(src || d.plan)) : {};
  p.items = Array.isArray(p.items) ? p.items.filter((i) => i && TR_FURN[i.t]) : [];
  p.door = p.door && p.door.wall >= 0 ? p.door : { wall: 2, pos: Math.min(W - TR_DOOR_W / 2, 75) };
  p.win = p.win && p.win.wall >= 0 ? p.win : { wall: 0, pos: W / 2 };
  p.sdb = p.sdb || { c: '' };
  return p;
}
const trDim = (it) => { const F = TR_FURN[it.t]; return { w: it.w || F.w, d: it.d || F.d, h: it.h || F.h }; };
const trRot = (lx, ly, r) => r === 90 ? [-ly, lx] : r === 180 ? [-lx, -ly] : r === 270 ? [ly, -lx] : [lx, ly];
// Rectangle (aligné sur les murs) d'une zone définie dans le repère du meuble : centre (lx, ly), taille (sx, sy).
function trLocal(it, lx, ly, sx, sy) {
  const [ox, oy] = trRot(lx, ly, it.r || 0), sw = (it.r || 0) % 180 ? sy : sx, sh = (it.r || 0) % 180 ? sx : sy;
  return { x0: it.x + ox - sw / 2, y0: it.y + oy - sh / 2, x1: it.x + ox + sw / 2, y1: it.y + oy + sh / 2 };
}
const trRect = (it) => { const m = trDim(it); return trLocal(it, 0, 0, m.w, m.d); };
const trHit = (a, b) => a.x0 < b.x1 - 0.5 && a.x1 > b.x0 + 0.5 && a.y0 < b.y1 - 0.5 && a.y1 > b.y0 + 0.5;
const trInside = (r, W, D) => r.x0 >= -0.5 && r.y0 >= -0.5 && r.x1 <= W + 0.5 && r.y1 <= D + 0.5;
const trFree = (r, obs, W, D) => trInside(r, W, D) && !obs.some((o) => trHit(r, o));
const trWallLen = (wall, W, D) => wall % 2 ? D : W;
// Zone de profondeur « depth » à l'intérieur de la pièce, devant une ouverture (porte, fenêtre) posée sur un mur.
function trOpening(o, width, W, D, depth) {
  const a = o.pos - width / 2, b = o.pos + width / 2;
  return o.wall === 0 ? { x0: a, y0: 0, x1: b, y1: depth } : o.wall === 1 ? { x0: W - depth, y0: a, x1: W, y1: b } : o.wall === 2 ? { x0: a, y0: D - depth, x1: b, y1: D } : { x0: 0, y0: a, x1: depth, y1: b };
}
/* ---------- murs intérieurs, zones hors chambre, fenêtres en plus : le scan fidèle, ou corrigé à la main ---------- */
// d.cl : segments d'équerre {x0,y0,x1,y1,k} ; k absent = mur, 'p' = porte intérieure, 'o' = ouverture sans porte.
// d.hors : rectangles compris dans longueur × largeur mais hors de la chambre (pièce en L, recoin). d.fen2 : fenêtres en plus.
const TR_CL_T = 8;
const trCls = (d) => (Array.isArray(d.cl) ? d.cl : []).filter((c) => c && [c.x0, c.y0, c.x1, c.y1].every((v) => typeof v === 'number' && isFinite(v)));
const trClV = (c) => Math.abs(c.x1 - c.x0) < Math.abs(c.y1 - c.y0);
const trClLen = (c) => Math.round(Math.hypot(c.x1 - c.x0, c.y1 - c.y0));
const trClRect = (c, e) => { const t = (e || 2) / 2; return trClV(c) ? { x0: c.x0 - t, x1: c.x0 + t, y0: Math.min(c.y0, c.y1), y1: Math.max(c.y0, c.y1) } : { x0: Math.min(c.x0, c.x1), x1: Math.max(c.x0, c.x1), y0: c.y0 - t, y1: c.y0 + t }; };
const trHors = (d) => (Array.isArray(d.hors) ? d.hors : []).filter((r) => r && r.x1 > r.x0 && r.y1 > r.y0);
const trFen2 = (d) => (Array.isArray(d.fen2) ? d.fen2 : []).filter((f) => f && f.wall >= 0 && f.wall <= 3);
// Ce qui est bâti : murs intérieurs, zones hors chambre, et 50 cm de passage de chaque côté d’une porte ou d'une ouverture intérieure.
const trBatiMurs = (d) => [...trCls(d).filter((c) => !c.k).map((c) => trClRect(c)), ...trHors(d)];
const trBatiPass = (d) => trCls(d).filter((c) => c.k).map((c) => trClRect(c, 100));
const trBati = (d) => [...trBatiMurs(d), ...trBatiPass(d)];
// Zones devant chaque fenêtre (la principale et les autres) : rien ne s'y pose.
const trWinZs = (p, W, D, d) => [trWinZone(p, W, D, trNum(d.fen_w)), ...trFen2(d).map((f) => trOpening(f, (trNum(f.w) || 120) + 40, W, D, 70))];
function trSdbRect(d, p, W, D) {
  if (!p.sdb || !p.sdb.c) return null;
  // Salle de bain repérée par le scan là où elle est vraiment (pas forcément dans un coin) ; sa porte est une porte intérieure.
  if (p.sdb.c === 'z') {
    const z = d.sdbz; if (!z || !(z.x1 > z.x0 && z.y1 > z.y0)) return null;
    const s = { x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, z: 1, door: null };
    const dr = trCls(d).find((c) => c.k && (trClV(c) ? Math.min(Math.abs(c.x0 - s.x0), Math.abs(c.x0 - s.x1)) < 12 : Math.min(Math.abs(c.y0 - s.y0), Math.abs(c.y0 - s.y1)) < 12) && trHit(trClRect(c, 20), s));
    if (dr) { const r = trClRect(dr, 2 * Math.max(60, trClLen(dr))); s.door = { x0: Math.max(s.x0, r.x0), y0: Math.max(s.y0, r.y0), x1: Math.min(s.x1, r.x1), y1: Math.min(s.y1, r.y1) }; }
    return s;
  }
  let a = trNum(d.sdb_len), b = trNum(d.sdb_wid); if (!a || !b) return null;
  if (p.sdb.rot) { const t = a; a = b; b = t; }
  a = Math.min(a, W); b = Math.min(b, D);
  const x0 = p.sdb.c[1] === 'o' ? 0 : W - a, y0 = p.sdb.c[0] === 'n' ? 0 : D - b;
  return { x0, y0, x1: x0 + a, y1: y0 + b };
}
// Pose un meuble dos au mur : mur 0 = haut du plan, 1 = droite, 2 = bas, 3 = gauche ; pos = distance le long du mur.
function trAtWall(t, wall, pos, W, D, extra) {
  const it = { id: trPid(), t, r: wall * 90, ...(extra || {}) }, dp = trDim(it).d / 2;
  if (wall === 0) { it.x = pos; it.y = dp; } else if (wall === 1) { it.x = W - dp; it.y = pos; } else if (wall === 2) { it.x = pos; it.y = D - dp; } else { it.x = dp; it.y = pos; }
  return it;
}
const trIsBed = (it) => it.t === 'lit_s' || it.t === 'lit_d';
/* ---------- salle de bain dans un coin : cloisons, porte, équipements ---------- */
// Les deux cloisons qui la séparent de la chambre, et la porte (70 cm) sur la plus longue, près de leur jonction.
function trSdbDoor(s, p, W, D) {
  if (!s || !p.sdb || !p.sdb.c) return null;
  if (s.z) return s.door ? { side: 'z', zone: s.door } : null;
  const c = p.sdb.c, vx = c[1] === 'e' ? s.x0 : s.x1, hy = c[0] === 's' ? s.y0 : s.y1, vIn = vx > 0.5 && vx < W - 0.5, hIn = hy > 0.5 && hy < D - 0.5;
  const lv = s.y1 - s.y0, lh = s.x1 - s.x0, side = p.sdb.dw && ((p.sdb.dw === 'v' && vIn) || (p.sdb.dw === 'h' && hIn)) ? p.sdb.dw : (vIn && (!hIn || lv >= lh) ? 'v' : (hIn ? 'h' : null));
  if (!side) return null;
  const dw = trNum(p.sdb.dwid) || 70, at = trNum(p.sdb.dpos), cl = (v, lo, hi) => Math.min(Math.max(lo, hi), Math.max(lo, v));
  if (side === 'v') { const y = at && side === p.sdb.dw ? cl(at, s.y0 + dw / 2 + 2, s.y1 - dw / 2 - 2) : c[0] === 's' ? Math.min(s.y1 - dw / 2 - 5, s.y0 + dw / 2 + 12) : Math.max(s.y0 + dw / 2 + 5, s.y1 - dw / 2 - 12); return { side, vx, hy, vIn, hIn, a: y - dw / 2, b: y + dw / 2, zone: { x0: c[1] === 'e' ? vx : vx - dw, x1: c[1] === 'e' ? vx + dw : vx, y0: y - dw / 2, y1: y + dw / 2 } }; }
  const x = at && side === p.sdb.dw ? cl(at, s.x0 + dw / 2 + 2, s.x1 - dw / 2 - 2) : c[1] === 'e' ? Math.min(s.x1 - dw / 2 - 5, s.x0 + dw / 2 + 12) : Math.max(s.x0 + dw / 2 + 5, s.x1 - dw / 2 - 12);
  return { side, vx, hy, vIn, hIn, a: x - dw / 2, b: x + dw / 2, zone: { y0: c[0] === 's' ? hy : hy - dw, y1: c[0] === 's' ? hy + dw : hy, x0: x - dw / 2, x1: x + dw / 2 } };
}
// Place un équipement contre un mur de la salle de bain, sans gêner la porte ni les autres, avec de la place devant.
function trSdbPut(s, door, t, sizes, others, pref) {
  const a = s.x1 - s.x0, b = s.y1 - s.y0; let best = null;
  const front = t === 'wc' || t === 'lavabo' ? 55 : t === 'baignoire' ? 50 : 0;
  for (const [w, dp] of sizes) {
  for (let wall = 0; wall < 4; wall++) {
    const L = wall % 2 ? b : a; if (w > L + 0.5) continue;
    for (let pos = w / 2; pos <= L - w / 2 + 0.1; pos += 5) {
      const it = trAtWall(t, wall, pos, a, b, { w, d: dp }); it.x += s.x0; it.y += s.y0;
      const r = trRect(it); if (r.x0 < s.x0 - 0.5 || r.y0 < s.y0 - 0.5 || r.x1 > s.x1 + 0.5 || r.y1 > s.y1 + 0.5) continue;
      if (door && trHit(r, door.zone)) continue;
      if (others.some((o) => trHit(r, trRect(o)))) continue;
      if (front) { const f = trLocal(it, 0, dp / 2 + front / 2, Math.max(50, w - 10), front); if (f.x0 < s.x0 - 0.5 || f.y0 < s.y0 - 0.5 || f.x1 > s.x1 + 0.5 || f.y1 > s.y1 + 0.5 || others.some((o) => trHit(f, trRect(o)))) continue; }
      const corner = (pos - w / 2 < 1 ? 1 : 0) + (L - pos - w / 2 < 1 ? 1 : 0), dd = door ? Math.hypot(it.x - (door.zone.x0 + door.zone.x1) / 2, it.y - (door.zone.y0 + door.zone.y1) / 2) : 0;
      let sc = (t === 'baignoire' || t === 'douche' ? corner * 30 + dd / 10 : t === 'wc' ? corner * 12 + dd / 20 : -dd / 15) + w * dp / 2000 + ((pref || 0) % 3 === wall % 3 ? 4 : 0);
      if (!best || sc > best.sc) best = { sc, it };
    }
  }
    if (best) break; // la plus grande taille qui tient
  }
  return best ? best.it : null;
}
// Équipements d'une salle de bain : baignoire, douche classique ou douche à l'italienne ; WC et lavabo (meuble vasque en haut de gamme).
function trSdbAuto(roomId, p, style, opt) {
  const d = trData(roomId), { W, D } = trWDH(d), s = trSdbRect(d, p, W, D); if (!s) return { items: [], note: '' };
  const door = trSdbDoor(s, p, W, D), out = [], o = opt || {}; let note = '';
  const bath = style === 'bain' ? trSdbPut(s, door, 'baignoire', [[170, 70], [160, 70], [150, 70]], out, o.n) : null;
  if (bath) out.push(bath); else {
    if (style === 'bain') note = 'Pas la place pour une baignoire : douche à la place.';
    const sh = trSdbPut(s, door, 'douche', style === 'italienne' ? [[160, 90], [140, 90], [120, 90], [100, 90], [90, 90], [80, 80]] : [[120, 90], [100, 80], [90, 90], [80, 80]], out, o.n);
    if (sh) { if (style === 'italienne') sh.n = 'Douche à l’italienne'; out.push(sh); } else note = 'La salle de bain est trop petite pour une douche.';
  }
  const lav = trSdbPut(s, door, 'lavabo', o.vasque ? [[80, 46], [60, 46], [50, 40]] : [[60, 46], [50, 40]], out, o.n); if (lav) { if (o.vasque && lav.w >= 80) lav.n = 'Meuble vasque'; out.push(lav); }
  const wc = trSdbPut(s, door, 'wc', [[38, 62], [36, 55]], out, o.n); if (wc) out.push(wc); else note = (note ? note + ' ' : '') + 'Pas de place pour les WC.';
  return { items: out, note };
}
const trItName = (it) => it.n || TR_FURN[it.t].l;
// Zones d'accès d'un lit : au pied, et le long de chaque côté (sur la moitié basse, là où l'on passe).
const trBedFoot = (it, deep) => { const m = trDim(it); return trLocal(it, 0, m.d / 2 + deep / 2, m.w, deep); };
const trBedSide = (it, sign, wide) => { const m = trDim(it); return trLocal(it, sign * (m.w / 2 + wide / 2), m.d / 2 - 55, wide, 110); };

// La zone devant la fenêtre, où l'on ne pose rien.
const trWinZone = (p, W, D, winW) => trOpening(p.win, (winW || 120) + 40, W, D, 70);
/* ---------- déplacer une porte, et adapter l'aménagement autour ---------- */
// kind 'room' : la porte de la pièce va sur le mur le plus proche du point (x, y) ; kind 'sdb' : celle de la salle de bain, sur la cloison la plus proche.
function trDoorAt(p, roomId, kind, x, y) {
  const d = trData(roomId), { W, D } = trWDH(d);
  if (kind === 'room') { const dw = trDW(p), ds = [y, W - x, D - y, x], wall = ds.indexOf(Math.min(...ds)), L = trWallLen(wall, W, D), h = Math.min(dw, L) / 2; p.door = { ...p.door, wall, pos: Math.round(Math.min(L - h, Math.max(h, wall % 2 ? y : x)) / 5) * 5 }; return true; }
  const s = trSdbRect(d, p, W, D); if (!s || !p.sdb || !p.sdb.c || s.z) return false;
  const c = p.sdb.c, vx = c[1] === 'e' ? s.x0 : s.x1, hy = c[0] === 's' ? s.y0 : s.y1, vIn = vx > 0.5 && vx < W - 0.5, hIn = hy > 0.5 && hy < D - 0.5;
  const dv = vIn ? Math.abs(x - vx) + Math.max(0, s.y0 - y, y - s.y1) : 1e9, dh = hIn ? Math.abs(y - hy) + Math.max(0, s.x0 - x, x - s.x1) : 1e9; if (dv === 1e9 && dh === 1e9) return false;
  const side = dv <= dh ? 'v' : 'h', w = trNum(p.sdb.dwid) || 70, lo = (side === 'v' ? s.y0 : s.x0) + w / 2 + 2, hi = (side === 'v' ? s.y1 : s.x1) - w / 2 - 2;
  p.sdb = { ...p.sdb, dw: side, dpos: Math.round(Math.min(hi, Math.max(lo, side === 'v' ? y : x)) / 5) * 5 }; return true;
}
// Après un déplacement de porte : ce qui la gêne est déplacé (équipements de la salle de bain replacés, meubles poussés à la place libre la plus proche).
function trDoorToast() { const P = S.trP; if (!P) return; const m = trDoorAdapt(P.p, P.rid); if (m.length) toast('Porte déplacée : ' + m.join(', ') + '.', 5000); }
function trDoorAdapt(p, roomId) {
  const d = trData(roomId), { W, D } = trWDH(d), s = trSdbRect(d, p, W, D), moved = [];
  const sd = s && trSdbDoor(s, p, W, D), san = p.items.filter(trIsSan);
  if (sd && san.some((i) => trHit(trRect(i), sd.zone))) {
    const style = san.some((i) => i.t === 'baignoire') ? 'bain' : san.some((i) => /italienne/.test(i.n || '')) ? 'italienne' : 'douche';
    const r = trSdbAuto(roomId, { ...p, items: [] }, style, { vasque: san.some((i) => i.n === 'Meuble vasque') });
    if (r.items.length) { p.items = [...p.items.filter((i) => !trIsSan(i)), ...r.items]; moved.push('salle de bain réaménagée'); if (r.note) moved.push(r.note.toLowerCase()); }
  }
  const dz = trOpening(p.door, trDW(p), W, D, 80), wzs = trWinZs(p, W, D, d), bati = trBati(d);
  const gene = p.items.filter((i) => i.t !== 'tv' && !trIsSan(i) && [dz, ...wzs, ...bati].some((z) => trHit(trRect(i), z)));
  // Un lit gêne : on refait la disposition de la chambre (mêmes lits), la salle de bain ne bouge pas.
  if (gene.some(trIsBed)) {
    const nv = TR_NIVEAUX.find((x) => x.k === p.niv), beds = p.items.filter(trIsBed).map((i) => i.t), big = p.items.some((i) => i.t === 'lit_d' && trNum(i.w) >= 160);
    beds.sort((x, y) => (y === 'lit_d') - (x === 'lit_d'));
    for (const b of big ? [true, false] : [false]) for (let alt = 0; alt < 4; alt++) {
      const a = trAuto(roomId, beds, p, { lvl: nv ? nv.lvl : 1, big: b, alt });
      if (a.bedsOk) { p.items = [...a.p.items, ...p.items.filter(trIsSan)]; moved.push(big && !b ? 'chambre réaménagée (lit double ramené à 140 pour que tout tienne)' : 'chambre réaménagée autour'); return moved; }
    }
  }
  gene.forEach((it) => {
    const obs = [dz, ...wzs, ...bati, ...(s ? [s] : []), ...p.items.filter((o) => o !== it && o.t !== 'tv').map(trRect)];
    let best = null;
    for (const r of [it.r || 0, ((it.r || 0) + 90) % 360, ((it.r || 0) + 180) % 360, ((it.r || 0) + 270) % 360]) {
      const q = { ...it, r }, rc0 = trRect({ ...q, x: 0, y: 0 }), hw = (rc0.x1 - rc0.x0) / 2, hh = (rc0.y1 - rc0.y0) / 2;
      for (let x = hw; x <= W - hw + 0.1; x += 5) for (let y = hh; y <= D - hh + 0.1; y += 5) {
        const rr = { x0: x - hw, y0: y - hh, x1: x + hw, y1: y + hh }; if (!trFree(rr, obs, W, D)) continue;
        if (trIsBed(it)) { const nb = { ...q, x, y }, ob2 = obs.filter((o) => !wzs.includes(o)); if (![1, -1].some((sg) => trFree(trBedSide(nb, sg, 50), ob2, W, D)) && !trFree(trBedFoot(nb, 55), ob2, W, D)) continue; }
        const wallTouch = (x - hw < 1 || W - x - hw < 1 || y - hh < 1 || D - y - hh < 1) ? 0 : 60, dd = Math.hypot(x - it.x, y - it.y) + wallTouch + (r !== (it.r || 0) ? 40 : 0);
        if (!best || dd < best.dd) best = { dd, x, y, r };
      }
    }
    if (best) { it.x = best.x; it.y = best.y; it.r = best.r; moved.push(trItName(it).toLowerCase() + ' déplacé'); } else moved.push(trItName(it).toLowerCase() + ' sans place libre');
  });
  return moved;
}
/* ---------- vérification d'une disposition ---------- */
function trPlanCheck(roomId, p) {
  const d = trData(roomId), { W, D } = trWDH(d), bad = new Set(), lines = [];
  const sdb = trSdbRect(d, p, W, D), doorZ = trOpening(p.door, trDW(p), W, D, 80), winZs = trWinZs(p, W, D, d);
  const murs = trCls(d).filter((c) => !c.k).map((c) => trClRect(c)), hors = trHors(d), pass = trBatiPass(d);
  const solid = p.items.filter((i) => i.t !== 'tv'), rc = new Map(solid.map((i) => [i.id, trRect(i)]));
  solid.forEach((i) => {
    const r = rc.get(i.id);
    if (!trInside(r, W, D)) { bad.add(i.id); lines.push(`${trItName(i)} dépasse du mur`); }
    if (trIsSan(i)) { if (sdb && !(r.x0 >= sdb.x0 - 1 && r.y0 >= sdb.y0 - 1 && r.x1 <= sdb.x1 + 1 && r.y1 <= sdb.y1 + 1)) { bad.add(i.id); lines.push(`${trItName(i)} sort de la salle de bain`); } const sd = sdb && trSdbDoor(sdb, p, W, D); if (sd && trHit(r, sd.zone)) { bad.add(i.id); lines.push(`${trItName(i)} gêne la porte de la salle de bain`); } }
    else if (sdb && trHit(r, sdb)) { bad.add(i.id); lines.push(`${trItName(i)} est dans la salle de bain`); }
    if (trHit(r, doorZ)) { bad.add(i.id); lines.push(`${trItName(i)} gêne l’ouverture de la porte`); }
    if (!trIsSan(i) && winZs.some((z) => trHit(r, z))) { bad.add(i.id); lines.push(`${trItName(i)} est devant la fenêtre`); }
    if (hors.some((z) => trHit(r, z))) { bad.add(i.id); lines.push(`${trItName(i)} est hors de la chambre`); }
    else if (!trIsSan(i) && murs.some((z) => trHit(r, z))) { bad.add(i.id); lines.push(`${trItName(i)} traverse un mur`); }
    else if (pass.some((z) => trHit(r, z)) && !(trIsSan(i) && sdb && sdb.z)) { bad.add(i.id); lines.push(`${trItName(i)} bloque un passage`); }
  });
  p.items.filter((i) => i.t === 'tv').forEach((i) => { if (i.r / 90 === p.win.wall && trHit(trRect(i), trOpening(p.win, (trNum(d.fen_w) || 120), W, D, 30))) { bad.add(i.id); lines.push('La télé est sur la fenêtre'); } });
  for (let a = 0; a < solid.length; a++) for (let b = a + 1; b < solid.length; b++) {
    const A = solid[a], B = solid[b];
    if ((A.t === 'chaise' && B.t === 'bureau') || (A.t === 'bureau' && B.t === 'chaise')) continue;
    if (trHit(rc.get(A.id), rc.get(B.id))) { bad.add(A.id); bad.add(B.id); lines.push(`${trItName(A)} et ${trItName(B)} se chevauchent`); }
  }
  solid.filter(trIsBed).forEach((i) => {
    const obs = solid.filter((o) => o.id !== i.id).map((o) => rc.get(o.id)); if (sdb) obs.push(sdb); obs.push(...murs, ...hors);
    const sides = [1, -1].filter((sg) => trFree(trBedSide(i, sg, 50), obs, W, D)).length, foot = trFree(trBedFoot(i, 55), obs, W, D);
    if (!sides && !foot) { bad.add(i.id); lines.push(`${trItName(i)} : on ne peut pas y accéder`); }
    else if (!sides) lines.push(`${trItName(i)} : accessible seulement par le pied`);
    else if (i.t === 'lit_d' && sides < 2) lines.push('Lit double accessible d’un seul côté');
  });
  return { bad, lines };
}

/* ---------- proposition automatique d'une disposition ---------- */
// Règles tenues par toutes les propositions : rien dans l'ouverture de la porte ni devant la fenêtre (rideaux, radiateur, lumière),
// 50 cm au minimum autour des lits et 90 cm sur un grand côté dès que la pièce le permet (la mesure des chambres adaptées), surface 3★.
function trAuto(roomId, beds, base, opt) {
  const lvl = opt && opt.lvl !== undefined ? opt.lvl : 1, big = !!(opt && opt.big), alt = (opt && opt.alt) || 0, bare = !!(opt && opt.bare);
  const d = trData(roomId), { W, D } = trWDH(d), p = { door: base.door, win: base.win, sdb: base.sdb, items: [] }, miss = [];
  const sdb = trSdbRect(d, p, W, D), winW = trNum(d.fen_w) || 120;
  // Règle absolue : rien devant la fenêtre (elle s'ouvre), ni lit, ni chevet, ni meuble. 20 cm de marge de chaque côté, 70 cm de profondeur.
  const winZs = trWinZs(p, W, D, d), winZ = winZs[0];
  const fixed = [trOpening(p.door, trDW(p) + 10, W, D, 95), ...trBati(d)]; if (sdb) fixed.push(sdb);
  const solid = () => [...occ(), ...winZs]; // pour poser un meuble ; la zone de la fenêtre reste un passage possible
  const occ = () => [...fixed, ...p.items.filter((i) => i.t !== 'tv').map(trRect)];
  const bedExtra = (t) => t !== 'lit_d' ? {} : big ? { w: 160, d: 200 } : trNum(d.lit_d_w) >= 140 ? { w: trNum(d.lit_d_w), d: trNum(d.lit_d_w) >= 160 ? 200 : 190 } : {};
  const bedW = (t) => bedExtra(t).w || TR_FURN[t].w;
  const span = (wall, o, width) => o.wall === wall ? [o.pos - width / 2, o.pos + width / 2] : null;
  const GAP = 50;
  // Une rangée de lits côte à côte, têtes contre le même mur.
  function tryRow(types) {
    let best = null; const walls = {};
    const orders = new Set(types).size > 1 ? [types, [...types].reverse()] : [types];
    for (const ord of orders) {
      const ws = ord.map(bedW), total = ws.reduce((a, b) => a + b, 0) + GAP * (ord.length - 1);
      for (let wall = 0; wall < 4; wall++) {
        const L = trWallLen(wall, W, D); if (total > L + 0.5) continue;
        const cs = []; for (let c = total / 2; c <= L - total / 2 + 0.01; c += 10) cs.push(c); cs.push(L - total / 2, L / 2);
        for (const c of cs) {
          let off = c - total / 2;
          const its = ord.map((t, i) => { const it = trAtWall(t, wall, off + ws[i] / 2, W, D, bedExtra(t)); off += ws[i] + GAP; return it; });
          const o = occ(); let sidesAll = 0, ok = true, wide = 0;
          for (const it of its) {
            const others = [...o, ...its.filter((x) => x !== it).map(trRect)];
            if (!trFree(trRect(it), [...others, ...winZs], W, D) || !trFree(trBedFoot(it, 50), o, W, D)) { ok = false; break; }
            const sides = [1, -1].filter((sg) => trFree(trBedSide(it, sg, 50), others, W, D)).length;
            if (!sides) { ok = false; break; }
            sidesAll += sides * (it.t === 'lit_d' ? 2 : 1); // un lit double mérite un passage de chaque côté
            if ([1, -1].some((sg) => trFree(trBedSide(it, sg, 90), others, W, D))) wide += 1; if (trFree(trBedFoot(it, 90), o, W, D)) wide += 0.5;
          }
          if (!ok) continue;
          let sc = -Math.abs(c - L / 2) / L * 30 + sidesAll * 6 + wide * 6 + Math.min((wall % 2 ? W : D) - 190, 200) / 10;
          const ws2 = span(wall, p.win, winW); if (ws2 && ws2[0] < c + total / 2 && ws2[1] > c - total / 2) sc -= 35;
          if (p.door.wall === wall) sc -= 15;
          if (!best || sc > best.sc) best = { sc, its }; if (!walls[wall] || sc > walls[wall].sc) walls[wall] = { sc, its };
        }
      }
    }
    // Variante demandée : un autre mur pour les têtes de lit, s'il s'en trouve un presque aussi bon.
    if (best && alt) { const c = Object.values(walls).filter((w) => w.sc >= best.sc - 45).sort((a, b) => b.sc - a.sc); return c[alt % c.length].its; }
    return best ? best.its : null;
  }
  let rest = [...beds];
  while (rest.length) {
    let done = false;
    for (let k = rest.length; k >= 1 && !done; k--) { const its = tryRow(rest.slice(0, k)); if (its) { p.items.push(...its); rest = rest.slice(k); done = true; } }
    if (!done) { miss.push(TR_FURN[rest[0]].l); rest.shift(); }
  }
  const placed = p.items.filter(trIsBed);
  // Chevets : de chaque côté de la tête, là où il reste de la place.
  placed.forEach((b) => [1, -1].forEach((sg) => {
    const m = trDim(b), [ox, oy] = trRot(sg * (m.w / 2 + 22), -m.d / 2 + 20, b.r);
    const it = { id: trPid(), t: 'chevet', r: b.r, x: b.x + ox, y: b.y + oy };
    if (trFree(trRect(it), solid(), W, D)) p.items.push(it);
  }));
  // Meuble dos à un mur, avec de la place devant pour s'en servir.
  function putWall(t, o) {
    let best = null; const F = TR_FURN[t];
    for (let wall = 0; wall < 4; wall++) {
      const L = trWallLen(wall, W, D); if (F.w > L) continue;
      const cs = []; for (let c = F.w / 2; c <= L - F.w / 2 + 0.01; c += 10) cs.push(c); cs.push(L - F.w / 2);
      for (const c of cs) {
        const it = trAtWall(t, wall, c, W, D), r = trRect(it), ob = solid();
        if (!trFree(r, ob, W, D) || !trFree(trLocal(it, 0, F.d / 2 + o.front / 2, F.w, o.front), occ(), W, D)) continue;
        if (o.noWin && winZs.some((z) => trHit(r, z))) continue;
        const sc = o.score(it, wall, c, L);
        if (!best || sc > best.sc) best = { sc, it };
      }
    }
    if (best) p.items.push(best.it); else if (!o.optional) miss.push(F.l);
    return best ? best.it : null;
  }
  const mid = (z) => [(z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2];
  const dist = (it, pt) => Math.hypot(it.x - pt[0], it.y - pt[1]);
  const doorPt = mid(trOpening(p.door, trDW(p), W, D, 10)), winPt = mid(winZ);
  const corner = (c, L, w) => (c <= w / 2 + 1 || c >= L - w / 2 - 1 ? 8 : 0);
  if (placed.length && !bare) {
    putWall('armoire', { front: 60, noWin: true, score: (it, wall, c, L) => -dist(it, doorPt) / 12 + corner(c, L, 100) });
    const desk = putWall('bureau', { front: 70, noWin: true, score: (it, wall, c, L) => Math.min(dist(it, doorPt), 300) / 60 + corner(c, L, 100) });
    if (desk) { const [ox, oy] = trRot(0, 50 / 2 + 45 / 2 - 15, desk.r); p.items.push({ id: trPid(), t: 'chaise', r: (desk.r + 180) % 360, x: desk.x + ox, y: desk.y + oy }); }
    // Télé au mur, face au premier lit.
    const b = placed[0], wall = ((b.r / 90) + 2) % 4, L = trWallLen(wall, W, D), target = wall % 2 ? b.y : b.x;
    let tv = null;
    for (let k = 0; k <= L && !tv; k += 10) for (const c of [target - k, target + k]) {
      if (c < 50 || c > L - 50) continue;
      const it = trAtWall('tv', wall, c, W, D), r = trRect(it);
      const blocked = [trOpening(p.door, trDW(p) + 20, W, D, 10), trOpening(p.win, winW + 10, W, D, 10), ...(sdb ? [sdb] : []), ...p.items.filter((i) => i.t === 'armoire').map(trRect)];
      if (trInside(r, W, D) && !blocked.some((o) => trHit(r, o))) { tv = it; break; }
    }
    if (tv) p.items.push(tv); else miss.push('Télé murale');
    putWall('bagages', { front: 50, optional: true, noWin: true, score: (it) => -dist(it, doorPt) / 12 });
    if (W * D >= 110000) putWall('fauteuil', { front: 45, optional: true, noWin: true, score: (it) => -dist(it, winPt) / 12 });
  }
  const n = beds.reduce((a, t) => a + (t === 'lit_d' ? 2 : 1), 0), need = TR_SURF3[Math.min(3, n)], s = trSurf({ ...d, plan: p });
  const pass90 = placed.length > 0 && placed.every((b) => { const ob = [...fixed, ...p.items.filter((i) => i !== b && i.t !== 'tv' && i.t !== 'chevet').map(trRect)]; return [1, -1].some((sg) => trFree(trBedSide(b, sg, 90), ob, W, D)); });
  return { p, miss, pass90, bedsOk: placed.length === beds.length, people: n, need, surf: s.tot, surfOk: s.tot >= need * 0.9 };
}
// Une proposition complète pour un niveau : la disposition (avec le nombre de lits de la fiche, sinon la plus grande qui tient en 3★) et ses finitions.
const TR_NIV_VAR = {
  eco: { pal: [{ mur: 'blanc', accent: 'sauge', tissu: 'gris' }, { mur: 'blanc', accent: 'terracotta', tissu: 'lin' }, { mur: 'lin', accent: 'grege', tissu: 'gris' }, { mur: 'blanc', accent: 'bleunuit', tissu: 'gris' }], lum: [['plafonnier', 'appliques'], ['plafonnier', 'appliques', 'ruban']] },
  confort: { pal: [{ mur: 'lin', accent: 'vertprofond', tissu: 'lin' }, { mur: 'blanc', accent: 'bleunuit', tissu: 'gris' }, { mur: 'grege', accent: 'terracotta', tissu: 'lin' }, { mur: 'sauge', accent: 'vertprofond', sol: 'chene', tissu: 'lin' }], lum: [['spots', 'appliques', 'ruban'], ['plafonnier', 'appliques', 'ruban'], ['corniche', 'appliques']] },
  prestige: { pal: [{ mur: 'grege', accent: 'bleunuit', tissu: 'anthracite' }, { mur: 'lin', accent: 'vertprofond', tissu: 'sauge' }, { mur: 'blanc', accent: 'grege', sol: 'chene', tissu: 'bleunuit' }, { mur: 'grege', accent: 'terracotta', tissu: 'lin' }], lum: [['corniche', 'spots', 'appliques', 'ruban'], ['corniche', 'appliques', 'ruban'], ['spots', 'appliques', 'ruban']] },
};
// Finitions d'un niveau pour la variante n : chaque nouvel appui change les couleurs, l'éclairage et, si possible, le mur des lits.
const trNivDeco = (nv, n) => { const v = TR_NIV_VAR[nv.k]; return { ...nv.deco, ...v.pal[n % v.pal.length], lum: v.lum[n % v.lum.length] }; };
function trNiveau(roomId, nv, base, n) {
  const d = trData(roomId), want = [...Array(trNum(d.lits_d) || 0).fill('lit_d'), ...Array(trNum(d.lits_s) || 0).fill('lit_s')];
  const cands = want.length ? [want] : (base.cfg && TR_CFG.find((c) => c[0] === base.cfg) ? [TR_CFG.find((c) => c[0] === base.cfg)[2]] : [['lit_d', 'lit_s'], ['lit_d'], ['lit_s', 'lit_s'], ['lit_s']]);
  let best = null;
  for (const beds of cands) {
    for (const bigTry of (nv.lvl === 2 && beds.includes('lit_d') ? [true, false] : [false])) {
      const a = trAuto(roomId, beds, base, { lvl: nv.lvl, big: bigTry, alt: n || 0 }); a.big = bigTry; a.beds = beds;
      if (bigTry && (!a.bedsOk || trPlanCheck(roomId, { ...base, items: a.p.items }).lines.length)) continue; // le lit de 160 seulement s'il ne gêne rien
      if (a.bedsOk && a.surfOk) return a; if (!best && a.bedsOk) best = a;
    }
  }
  return best || trAuto(roomId, cands[0], base, { lvl: nv.lvl });
}

/* ---------- plan vu de dessus (SVG, à l'échelle) ---------- */
function trPlanSvg() {
  const P = S.trP, d = trData(P.rid), { W, D } = trWDH(d), p = P.p, chk = trPlanCheck(P.rid, p);
  const sdb = trSdbRect(d, p, W, D), winW = trNum(d.fen_w) || 120, fs = Math.max(11, Math.round(Math.max(W, D) / 26));
  const seg = (o, width) => { const z = trOpening(o, width, W, D, 0); return o.wall % 2 ? `x1="${z.x0}" y1="${z.y0}" x2="${z.x0}" y2="${z.y1}"` : `x1="${z.x0}" y1="${z.y0}" x2="${z.x1}" y2="${z.y0}"`; };
  // Arc d'ouverture de la porte, vers l'intérieur.
  const dz = trOpening(p.door, trDW(p), W, D, trDW(p));
  const arc = p.door.wall === 0 ? `M${dz.x0},0 L${dz.x0},${trDW(p)} A${trDW(p)},${trDW(p)} 0 0 0 ${dz.x1},0` : p.door.wall === 2 ? `M${dz.x0},${D} L${dz.x0},${D - trDW(p)} A${trDW(p)},${trDW(p)} 0 0 1 ${dz.x1},${D}`
    : p.door.wall === 3 ? `M0,${dz.y0} L${trDW(p)},${dz.y0} A${trDW(p)},${trDW(p)} 0 0 1 0,${dz.y1}` : `M${W},${dz.y0} L${W - trDW(p)},${dz.y0} A${trDW(p)},${trDW(p)} 0 0 0 ${W},${dz.y1}`;
  const labels = [];
  const items = p.items.map((it) => {
    const m = trDim(it), F = TR_FURN[it.t], cls = `pi ${trIsBed(it) ? 'bed' : ''} ${chk.bad.has(it.id) ? 'bad' : ''} ${P.sel === it.id ? 'sel' : ''}`;
    let inner = `<rect x="${-m.w / 2}" y="${-m.d / 2}" width="${m.w}" height="${m.d}" rx="${it.t === 'tv' ? 2 : 6}"/>`;
    if (trIsBed(it)) inner += it.t === 'lit_d' ? `<rect class="pp" x="${-m.w / 2 + 8}" y="${-m.d / 2 + 10}" width="${m.w / 2 - 12}" height="34" rx="6"/><rect class="pp" x="4" y="${-m.d / 2 + 10}" width="${m.w / 2 - 12}" height="34" rx="6"/>` : `<rect class="pp" x="${-m.w / 2 + 12}" y="${-m.d / 2 + 10}" width="${m.w - 24}" height="34" rx="6"/>`;
    const lab = it.n ? String(it.n).slice(0, 12) : F.s;
    if (lab) labels.push(`<text class="pt" x="${it.x}" y="${it.y + fs * 0.35}" font-size="${fs}" text-anchor="middle">${esc(lab)}</text>`);
    return `<g class="${cls}" data-it="${it.id}" transform="translate(${it.x},${it.y}) rotate(${it.r || 0})">${inner}</g>`;
  }).join('') + labels.join('');
  return `<rect class="pf" x="0" y="0" width="${W}" height="${D}"/>
    ${sdb ? `<rect class="psdb" x="${sdb.x0}" y="${sdb.y0}" width="${sdb.x1 - sdb.x0}" height="${sdb.y1 - sdb.y0}"/>${(() => { const sd = !sdb.z && trSdbDoor(sdb, p, W, D); const ln = sd ? (sd.side === 'v' ? `x1="${sd.vx}" y1="${sd.a}" x2="${sd.vx}" y2="${sd.b}"` : `x1="${sd.a}" y1="${sd.hy}" x2="${sd.b}" y2="${sd.hy}"`) : ''; return sd ? `<g data-op="sdbdoor"><line ${ln} stroke="#B07A3F" stroke-width="${fs * 0.6}" stroke-linecap="round"/><line class="phit" ${ln}/></g>` : ''; })()}<text class="pt" x="${(sdb.x0 + sdb.x1) / 2}" y="${(sdb.y0 + sdb.y1) / 2 + fs * 0.35}" font-size="${fs}" text-anchor="middle">SdB</text>` : ''}
    <rect class="pw" x="0" y="0" width="${W}" height="${D}"/>
    ${trPlanBatiSvg(d, W, D, fs)}
    <path class="parc" d="${arc}"/>${P.edit ? `<g style="pointer-events:none;opacity:.3">${items}</g>${trPlanEditSvg(d, W, D, fs)}` : items}
    <g data-op="win"><line class="pwin" ${seg(p.win, winW)}/><line class="phit" ${seg(p.win, winW)}/></g>
    ${trFen2(d).map((f, i) => `<g ${trCan() ? `data-op="fen:${i}"` : ''}><line class="pwin" ${seg(f, trNum(f.w) || winW)}/><line class="phit" ${seg(f, trNum(f.w) || winW)}/></g>`).join('')}
    <g data-op="door"><line class="pdoor" ${seg(p.door, trDW(p))}/><line class="phit" ${seg(p.door, trDW(p))}/></g>
    ${(() => { const sd = sdb && !sdb.z && !P.edit && trSdbDoor(sdb, p, W, D); if (!sd) return ''; const ln = sd.side === 'v' ? `x1="${sd.vx}" y1="${sd.a}" x2="${sd.vx}" y2="${sd.b}"` : `x1="${sd.a}" y1="${sd.hy}" x2="${sd.b}" y2="${sd.hy}"`; return `<g data-op="sdbdoor"><line class="phit" style="stroke-width:44" ${ln}/></g>`; })()}
    <text class="pdim" x="${W / 2}" y="${-fs * 0.9}" font-size="${fs}" text-anchor="middle">${trM(W)}</text>
    <text class="pdim" x="${-fs * 0.9}" y="${D / 2}" font-size="${fs}" text-anchor="middle" transform="rotate(-90 ${-fs * 0.9} ${D / 2})">${trM(D)}</text>`;
}
// Murs intérieurs, portes et ouvertures intérieures, zones hors chambre.
function trPlanBatiSvg(d, W, D) {
  const P = S.trP, sel = P && P.edit && P.esel;
  const hz = trHors(d).map((r, i) => `<rect x="${r.x0}" y="${r.y0}" width="${r.x1 - r.x0}" height="${r.y1 - r.y0}" fill="url(#tr-hach)" stroke="${sel && sel.t === 'hz' && sel.i === i ? '#E8590C' : '#8A8A86'}" stroke-width="${sel && sel.t === 'hz' && sel.i === i ? 5 : 2}"/>`).join('');
  const cl = trCls(d).map((c, i) => { const on = sel && sel.t === 'cl' && sel.i === i, col = on ? '#E8590C' : c.k === 'p' ? '#A8703A' : c.k === 'o' ? '#8A8A86' : '#2F2E2B';
    return `<line x1="${c.x0}" y1="${c.y0}" x2="${c.x1}" y2="${c.y1}" stroke="${col}" stroke-width="${c.k ? 5 : TR_CL_T + 2}" ${c.k === 'o' ? 'stroke-dasharray="10 8"' : ''} stroke-linecap="butt"/>`; }).join('');
  return `<defs><pattern id="tr-hach" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#E4E3DF"/><line x1="0" y1="0" x2="0" y2="14" stroke="#B9B8B3" stroke-width="4"/></pattern></defs>${hz}${cl}`;
}
// Mode correction : poignées des murs, des murs intérieurs et des zones, avec leurs mesures.
function trPlanEditSvg(d, W, D, fs) {
  const P = S.trP, sel = P.esel, lab = (x, y, t, rot) => `<text class="pedim" x="${x}" y="${y}" font-size="${fs * 0.95}" text-anchor="middle"${rot ? ` transform="rotate(-90 ${x} ${y})"` : ''}>${t}</text>`;
  let h = [[0, 0, W, 0], [W, 0, W, D], [0, D, W, D], [0, 0, 0, D]].map(([x1, y1, x2, y2], k) => `<g data-op="mur:${k}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#E8590C" stroke-width="5" stroke-dasharray="14 10"/><line class="phit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/></g>`).join('');
  const sdb = trSdbRect(d, S.trP.p, W, D);
  if (sdb) {
    h += lab((sdb.x0 + sdb.x1) / 2, sdb.y0 + fs * 2.4, `SdB ${trM(sdb.x1 - sdb.x0)} × ${trM(sdb.y1 - sdb.y0)}`);
    if (sdb.z) h += `<g data-op="sz"><rect x="${sdb.x0}" y="${sdb.y0}" width="${sdb.x1 - sdb.x0}" height="${sdb.y1 - sdb.y0}" fill="transparent" stroke="${sel && sel.t === 'sz' ? '#E8590C' : 'none'}" stroke-width="5"/></g>`;
    else { const c = S.trP.p.sdb.c, vx = c[1] === 'e' ? sdb.x0 : sdb.x1, hy = c[0] === 's' ? sdb.y0 : sdb.y1;
      if (vx > 1 && vx < W - 1) h += `<g data-op="sdbw:v"><line x1="${vx}" y1="${sdb.y0}" x2="${vx}" y2="${sdb.y1}" stroke="#E8590C" stroke-width="4" stroke-dasharray="8 8"/><line class="phit" x1="${vx}" y1="${sdb.y0}" x2="${vx}" y2="${sdb.y1}"/></g>`;
      if (hy > 1 && hy < D - 1) h += `<g data-op="sdbw:h"><line x1="${sdb.x0}" y1="${hy}" x2="${sdb.x1}" y2="${hy}" stroke="#E8590C" stroke-width="4" stroke-dasharray="8 8"/><line class="phit" x1="${sdb.x0}" y1="${hy}" x2="${sdb.x1}" y2="${hy}"/></g>`; }
  }
  trHors(d).forEach((r, i) => { h += `<g data-op="hz:${i}"><rect x="${r.x0}" y="${r.y0}" width="${r.x1 - r.x0}" height="${r.y1 - r.y0}" fill="transparent"/></g>` + lab((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, `${trM(r.x1 - r.x0)} × ${trM(r.y1 - r.y0)}`); });
  trCls(d).forEach((c, i) => {
    const v = trClV(c), mx = (c.x0 + c.x1) / 2, my = (c.y0 + c.y1) / 2;
    h += `<g data-op="cl:${i}:m"><line class="phit" style="stroke-width:34" x1="${c.x0}" y1="${c.y0}" x2="${c.x1}" y2="${c.y1}"/></g>`;
    if (sel && sel.t === 'cl' && sel.i === i) h += ['a', 'b'].map((e) => `<circle data-op="cl:${i}:${e}" cx="${e === 'a' ? c.x0 : c.x1}" cy="${e === 'a' ? c.y0 : c.y1}" r="${fs * 0.9}" fill="#E8590C" stroke="#fff" stroke-width="3"/>`).join('');
    h += lab(v ? mx - fs * 0.9 : mx, v ? my : my - fs * 0.7, trM(trClLen(c)), v);
  });
  return h;
}
function trPlanDraw() { const g = $('tr-plan-g'); if (g && S.trP) g.innerHTML = trPlanSvg(); trPlanBar(); }
function trPlanBar() {
  const P = S.trP, bar = $('tr-plan-bar'), chkEl = $('tr-plan-chk'); if (!P) return;
  const it = P.p.items.find((i) => i.id === P.sel);
  if (P.edit && bar) { bar.innerHTML = trEditBar(); bar.classList.add('on'); }
  else if (bar) bar.innerHTML = it && trPlanCan() ? `<div class="row between"><b>${esc(trItName(it))} <span class="muted sm">${trDim(it).w} × ${trDim(it).d} cm</span></b><span class="row"><button class="btn small soft" data-a="trPlanRot">⟳ Tourner</button><button class="btn small ghost bad-t" data-a="trPlanDel">Enlever</button></span></div>` : (trPlanCan() && P.view === 'plan' ? '<p class="muted sm">Glisse la porte (marron), la fenêtre (bleue) et les meubles à leur place. Touche un meuble pour le tourner ou l’enlever.</p>' : '');
  if (bar && !P.edit) bar.classList.toggle('on', !!(it && trPlanCan()));
  if (chkEl && !trIsTest(P.rid)) { const a = trPmr(P.rid); chkEl.dataset.pmr = a.ok ? '♿ Cette chambre pourrait devenir une chambre adaptée (à confirmer : accès, porte de 83 cm, salle d’eau).' : `♿ Pas adaptable telle quelle : ${a.why}.`; } else if (chkEl) chkEl.dataset.pmr = '';
  if (chkEl) {
    const c = trPlanCheck(P.rid, P.p), beds = P.p.items.filter(trIsBed), n = beds.reduce((a, b) => a + (b.t === 'lit_d' ? 2 : 1), 0), s = trSurf({ ...trData(P.rid), plan: P.p });
    const need = n ? TR_SURF3[Math.min(3, n)] : 0, sOk = !n || s.tot >= need * 0.9;
    chkEl.innerHTML = !P.p.items.length ? '<p class="muted">Choisis une disposition ci-dessous, ou ajoute les meubles un par un.</p>'
      : `${c.lines.length ? `<ul class="tr-gaps">${c.lines.map((l) => `<li>⚠️ ${esc(l)}</li>`).join('')}</ul>${trPlanCan() && c.lines.some((l) => /fenêtre|porte/.test(l)) ? '<button class="btn small soft" data-a="trFreeOpen">Dégager la porte et la fenêtre</button>' : ''}` : '<p class="banner sm c-green">Tout tient : rien ne se chevauche, la porte s’ouvre, les lits sont accessibles ✓</p>'}
        ${chkEl.dataset.pmr ? `<p class="muted sm">${esc(chkEl.dataset.pmr)}</p>` : ''}
        ${n ? `<p class="${sOk ? 'muted' : 'banner sm c-red'}">${n} couchage${n > 1 ? 's' : ''} · ${trFr(s.tot)} m² pour ${trFr(need)} m² demandés en 3★${sOk ? (s.tot < need ? ' (dans la tolérance)' : ' ✓') : ' : trop petit'}</p>` : ''}`;
  }
}
/* ---------- versions : chacun la sienne, personne n'écrase celle d'un autre ---------- */
const trVPend = {}, trVTimer = {};
const trVGet = (id) => (S.tr.plans || []).find((v) => v.id === id);
const trVName = (rid, vid) => { if (vid) { const v = trVGet(vid); return v ? v.name : 'Version'; } const by = ((trData(rid).plan || {}).by); return by ? 'Version ' + trDe(by) : 'Plan de base'; };
function trPlansMerge() { Object.values(trVPend).forEach((v) => { const i = S.tr.plans.findIndex((x) => x.id === v.id); if (i >= 0) S.tr.plans[i] = v; else S.tr.plans.push(v); }); }
function trVSave(v) {
  trVPend[v.id] = v; clearTimeout(trVTimer[v.id]);
  trVTimer[v.id] = setTimeout(async () => { const sent = JSON.stringify(v.plan) + v.name; try { await api('tr_plan_save', { id: v.id, room_id: v.room_id, name: v.name, plan: v.plan }); if (trVPend[v.id] === v && JSON.stringify(v.plan) + v.name === sent) delete trVPend[v.id]; } catch (e) { toast('Version pas encore enregistrée : ' + errMsg(e)); } }, 700);
}
// Modifier la version de quelqu'un d'autre en crée une copie à son propre nom ; l'originale reste intacte.
function trFork(name) {
  const P = S.trP, me = trPrenom(S.me.label), src = trVName(P.rid, P.vid).replace(/ modifiée? par .*$/, ''), mine = 'Version ' + trDe(me);
  let nm = name || (src === mine ? mine : `${src} ${/^Plan/.test(src) ? 'modifié' : 'modifiée'} par ${me}`); const taken = (x) => S.tr.plans.some((v) => v.room_id === P.rid && v.name === x) || (!P.vid && x === src);
  if (taken(nm)) { let k = 2; while (taken(`${nm} (${k})`)) k++; nm = `${nm} (${k})`; }
  const v = { id: crypto.randomUUID(), room_id: P.rid, owner_id: S.tr.me_id, owner_label: S.me.label, name: nm, plan: JSON.parse(JSON.stringify(P.p)) };
  S.tr.plans.push(v); P.vid = v.id; if (!name) toast(`Ta version est créée : « ${nm} ». L’originale n’est pas touchée.`, 6000); return v;
}
function trPlanSave() {
  const P = S.trP; if (!P || !trPlanCan()) return;
  if (!P.vid) { if (trCan()) { P.p.by = trPrenom(S.me.label); trPatch(P.rid, { plan: P.p }); return; } trFork(); }
  let v = trVGet(P.vid); if (v && v.owner_id !== S.tr.me_id) v = trFork();
  if (!v) return; v.plan = JSON.parse(JSON.stringify(P.p)); trVSave(v); trVersDraw();
}
function trVersHtml() {
  const P = S.trP, vs = (S.tr.plans || []).filter((v) => v.room_id === P.rid), cur = P.vid ? trVGet(P.vid) : null, mine = cur && cur.owner_id === S.tr.me_id;
  const chip = (id, l) => `<button class="tr-sw" data-a="trVer" data-id="${esc(id)}" aria-pressed="${(P.vid || '') === id}">${esc(l)}</button>`;
  return `<div class="tr-sws tr-vers">${chip('', trVName(P.rid, null))}${vs.map((v) => chip(v.id, v.name)).join('')}</div>
    ${trPlanCan() ? `<div class="row tr-vact"><button class="btn small soft" data-a="trVerNew">＋ Ma version à partir de celle-ci</button>${mine ? '<button class="btn small" data-a="trVerName">Renommer</button><button class="btn small ghost bad-t" data-a="trVerDel">Supprimer</button>' : ''}</div>` : ''}
    <p class="muted sm">${cur ? (mine ? 'C’est ta version : tu la modifies librement.' : `Version ${trDe(cur.owner_label)}. Si tu la modifies, une copie à ton nom est créée ; la sienne ne bouge pas.`) : (trCan() ? 'Le plan de base : celui de la fiche.' : 'Le plan de base. Si tu le modifies, une copie à ton nom est créée ; l’original ne bouge pas.')}</p>`;
}
function trVersDraw() { const el = $('tr-vers'); if (el && S.trP) el.innerHTML = trVersHtml(); }
// Une chambre peut-elle devenir une chambre adaptée ? Un lit de 140, 90 cm le long d'un grand côté, un rond de 1,50 m libre.
function trPmr(roomId) {
  const d = trData(roomId); if (!trNum(d.len) || !trNum(d.wid)) return { ok: false, why: 'pas encore mesurée' };
  const { W, D } = trWDH(d), base = trPlanOf(roomId), a = trAuto(roomId, ['lit_d'], base, { lvl: 0, bare: true });
  if (!a.bedsOk) return { ok: false, why: 'un lit de 140 ne rentre pas' }; if (!a.pass90) return { ok: false, why: 'pas 90 cm le long du lit' };
  const sdb = trSdbRect(d, a.p, W, D), obs = [...a.p.items.filter((i) => i.t !== 'tv').map(trRect), ...(sdb ? [sdb] : []), trOpening(base.door, trDW(base), W, D, 60), ...trBati(d)];
  for (let x = 0; x + 150 <= W + 0.5; x += 10) for (let y = 0; y + 150 <= D + 0.5; y += 10) if (trFree({ x0: x, y0: y, x1: x + 150, y1: y + 150 }, obs, W, D)) return { ok: true, why: '' };
  return { ok: false, why: 'pas de rond de 1,50 m libre' };
}
/* ---------- corriger le plan : murs, murs intérieurs, zones hors chambre, salle de bain, fenêtres ---------- */
const trR5 = (v) => Math.round(v / 5) * 5;
const trEdKeys = ['len', 'wid', 'cl', 'hors', 'sdbz', 'fen2', 'sdb_len', 'sdb_wid'];
// Décale tout ce qui est posé dans la pièce (quand on déplace le mur de gauche ou du haut).
function trShiftAll(d, plans, dx, dy) {
  const mv = (o) => { if (!o) return; if (o.wall % 2) o.pos += dy; else o.pos += dx; };
  plans.forEach((p) => { if (!p) return; (p.items || []).forEach((i) => { i.x += dx; i.y += dy; }); mv(p.door); mv(p.win); if (p.sdb && p.sdb.dpos) p.sdb.dpos += p.sdb.dw === 'v' ? dy : dx; });
  trCls(d).forEach((c) => { c.x0 += dx; c.x1 += dx; c.y0 += dy; c.y1 += dy; });
  trHors(d).forEach((r) => { r.x0 += dx; r.x1 += dx; r.y0 += dy; r.y1 += dy; });
  if (d.sdbz) { d.sdbz.x0 += dx; d.sdbz.x1 += dx; d.sdbz.y0 += dy; d.sdbz.y1 += dy; }
  trFen2(d).forEach(mv);
  const z = (o) => ['x0', 'y0', 'x1', 'y1'].forEach((k) => { if (o[k] < 0) o[k] = 0; });
  trCls(d).forEach(z); trHors(d).forEach(z); if (d.sdbz) z(d.sdbz);
}
// Le mur de droite (ou du bas) bouge : ce qui y était collé (murs intérieurs, zones, salle de bain) suit.
function trStretch(d, ax, old, nw) {
  const ks = ax === 'x' ? ['x0', 'x1'] : ['y0', 'y1'], f = (o) => ks.forEach((k) => { if (Math.abs(o[k] - old) <= 2 || o[k] > nw) o[k] = Math.min(nw, Math.abs(o[k] - old) <= 2 ? nw : o[k]); });
  trCls(d).forEach(f); trHors(d).forEach(f); if (d.sdbz) f(d.sdbz);
}
// Un mur intérieur change de longueur : le morceau qui le prolongeait (après une coupe) suit son bout.
function trClFollow(cl, c, old) {
  const v = trClV(c);
  cl.forEach((o) => { if (o === c || trClV(o) !== v || (v ? Math.abs(o.x0 - c.x0) > 1 : Math.abs(o.y0 - c.y0) > 1)) return;
    ['0', '1'].forEach((e) => { const k = (v ? 'y' : 'x') + e; ['0', '1'].forEach((e2) => { const kc = (v ? 'y' : 'x') + e2; if (Math.abs(o[k] - old[kc]) <= 1 && Math.abs(c[kc] - old[kc]) > 0.5) o[k] = c[kc]; }); }); });
  for (let i = cl.length - 1; i >= 0; i--) if (trClLen(cl[i]) < 3) cl.splice(i, 1);
}
function trEditStart(dr) {
  const P = S.trP, d = trData(P.rid), [k, i, e] = dr.op.split(':');
  dr.k = k; dr.i = +i; dr.e = e;
  dr.snap = JSON.stringify({ d: Object.fromEntries(trEdKeys.map((x) => [x, d[x] === undefined ? null : d[x]])), p: P.p, base: P.vid ? d.plan || null : null });
}
// Pendant le glisser : la pièce est recalculée et redessinée, mesures comprises.
function trEditMove(dr, x, y) {
  const P = S.trP, d = trData(P.rid), sn = JSON.parse(dr.snap);
  if (!dr.moved && Math.hypot(x - dr.sx, y - dr.sy) < 6) return true;
  dr.moved = true; Object.assign(d, sn.d); P.p = sn.p; if (sn.base) d.plan = sn.base;
  const W0 = trNum(d.len), D0 = trNum(d.wid), g = $('tr-plan-g'), dx = trR5(x - dr.sx), dy = trR5(y - dr.sy);
  let tx = 0, ty = 0;
  if (dr.k === 'mur') {
    if (dr.i === 1) { d.len = Math.max(100, trR5(x)); trStretch(d, 'x', W0, d.len); } else if (dr.i === 2) { d.wid = Math.max(100, trR5(y)); trStretch(d, 'y', D0, d.wid); }
    else if (dr.i === 3) { tx = Math.min(W0 - 100, trR5(x)); d.len = W0 - tx; trShiftAll(d, [P.p, sn.base ? d.plan : null], -tx, 0); }
    else { ty = Math.min(D0 - 100, trR5(y)); d.wid = D0 - ty; trShiftAll(d, [P.p, sn.base ? d.plan : null], 0, -ty); }
  } else if (dr.k === 'sdbw') {
    const c = P.p.sdb.c, rot = !!P.p.sdb.rot;
    if (dr.op === 'sdbw:v') d[rot ? 'sdb_wid' : 'sdb_len'] = Math.max(60, Math.min(W0, c[1] === 'o' ? trR5(x) : W0 - trR5(x)));
    else d[rot ? 'sdb_len' : 'sdb_wid'] = Math.max(60, Math.min(D0, c[0] === 'n' ? trR5(y) : D0 - trR5(y)));
  } else if (dr.k === 'cl') {
    const c = trCls(d)[dr.i]; if (!c) return true; const v = trClV(c), cl = (q, M) => Math.max(0, Math.min(M, q));
    if (dr.e === 'm') { if (v) { const nx = cl(c.x0 + dx, W0); c.x0 = c.x1 = nx; const L = c.y1 - c.y0, ny = cl(c.y0 + dy, D0 - Math.abs(L)); c.y1 = ny + L; c.y0 = ny; } else { const ny = cl(c.y0 + dy, D0); c.y0 = c.y1 = ny; const L = c.x1 - c.x0, nx = cl(c.x0 + dx, W0 - Math.abs(L)); c.x1 = nx + L; c.x0 = nx; } }
    else {
      // Bout d'un mur intérieur : il glisse dans son axe et s'accroche aux murs qu'il touche (à 10 cm près).
      const lines = v ? [0, D0, ...trCls(d).filter((o) => o !== c && !trClV(o)).map((o) => o.y0)] : [0, W0, ...trCls(d).filter((o) => o !== c && trClV(o)).map((o) => o.x0)];
      let q = v ? cl(trR5(y), D0) : cl(trR5(x), W0); const raw = v ? y : x, near = lines.find((l) => Math.abs(l - raw) < 10); if (near !== undefined) q = Math.round(near);
      const old = { ...c }; if (v) c[dr.e === 'a' ? 'y0' : 'y1'] = q; else c[dr.e === 'a' ? 'x0' : 'x1'] = q;
      trClFollow(trCls(d), c, old);
    }
  } else if (dr.k === 'hz' || dr.k === 'sz') {
    const r = dr.k === 'sz' ? d.sdbz : trHors(d)[dr.i]; if (!r) return true; const w = r.x1 - r.x0, h = r.y1 - r.y0;
    let nx = Math.max(0, Math.min(W0 - w, r.x0 + dx)), ny = Math.max(0, Math.min(D0 - h, r.y0 + dy));
    if (nx < 10) nx = 0; if (W0 - nx - w < 10) nx = W0 - w; if (ny < 10) ny = 0; if (D0 - ny - h < 10) ny = D0 - h;
    r.x0 = nx; r.y0 = ny; r.x1 = nx + w; r.y1 = ny + h;
  } else if (dr.k === 'fen') {
    const f = trFen2(d)[dr.i]; if (!f) return true; const width = trNum(f.w) || trNum(d.fen_w) || 120;
    const ds = [y, W0 - x, D0 - y, x], wall = ds.indexOf(Math.min(...ds)), L = trWallLen(wall, W0, D0), half = Math.min(width, L) / 2;
    f.wall = wall; f.pos = trR5(Math.min(L - half, Math.max(half, wall % 2 ? y : x)));
  }
  if (g) { g.innerHTML = trPlanSvg(); g.setAttribute('transform', tx || ty ? `translate(${tx},${ty})` : ''); }
  trPlanBar(); return true;
}
function trEditEnd(dr) {
  const P = S.trP, d = trData(P.rid), g = $('tr-plan-g'); if (g) g.removeAttribute('transform');
  if (!dr.moved) { if (['cl', 'hz', 'sz'].includes(dr.k)) { const same = P.esel && P.esel.t === dr.k && P.esel.i === dr.i; P.esel = same ? null : { t: dr.k, i: dr.i }; } trPlanDraw(); return; }
  if (['cl', 'hz', 'sz'].includes(dr.k)) P.esel = { t: dr.k, i: dr.i };
  const patch = Object.fromEntries(trEdKeys.filter((k) => d[k] !== undefined && d[k] !== null).map((k) => [k, d[k]]));
  if (P.vid && dr.k === 'mur' && d.plan) patch.plan = d.plan;
  trPatch(P.rid, patch);
  if (dr.k === 'mur') { trPlanSave(); trPlanSheet(P.rid, true); toast(`Chambre : ${trM(trNum(d.len))} × ${trM(trNum(d.wid))}`); return; }
  trPlanDraw();
}
// Barre du mode correction : ce qui est sélectionné, avec ses mesures exactes.
function trEditBar() {
  const P = S.trP, d = trData(P.rid), { W, D } = trWDH(d), e = P.esel, num = (k, v, l) => `<label class="tr-num"><span>${l}</span><input type="number" inputmode="numeric" min="10" step="1" value="${Math.round(v)}" data-change="trEdNum" data-k="${k}"> cm</label>`;
  if (e && e.t === 'cl') {
    const c = trCls(d)[e.i]; if (!c) return '';
    const v = trClV(c), a = v ? c.x0 : c.y0, b = (v ? W : D) - a;
    return `<div class="row between"><b>${c.k === 'p' ? 'Porte intérieure' : c.k === 'o' ? 'Ouverture sans porte' : 'Mur intérieur'} · ${trM(trClLen(c))}</b><button class="btn small ghost bad-t" data-a="trClDel">Supprimer</button></div>
      <p class="muted sm">${v ? `À ${trM(a)} du mur de gauche, ${trM(b)} de celui de droite` : `À ${trM(a)} du mur du haut, ${trM(b)} de celui du bas`}.</p>
      <div class="segc" role="group">${[['', 'Mur'], ['p', 'Porte'], ['o', 'Ouverture']].map(([k, l]) => `<button data-a="trClKind" data-k="${k}" aria-pressed="${(c.k || '') === k}">${l}</button>`).join('')}</div>
      <div class="row">${num('cl', trClLen(c), 'Longueur')}${num('clpos', a, v ? 'Depuis la gauche' : 'Depuis le haut')}</div>
      <div class="row"><button class="btn small soft" data-a="trClCut">✂ Couper en deux</button><button class="btn small soft" data-a="trClTurn">⟳ Tourner</button></div>`;
  }
  if (e && (e.t === 'hz' || e.t === 'sz')) {
    const r = e.t === 'sz' ? d.sdbz : trHors(d)[e.i]; if (!r) return '';
    return `<div class="row between"><b>${e.t === 'sz' ? 'Salle de bain' : 'Hors de la chambre'} · ${trM(r.x1 - r.x0)} × ${trM(r.y1 - r.y0)}</b>${e.t === 'hz' ? '<button class="btn small ghost bad-t" data-a="trHzDel">Supprimer</button>' : ''}</div>
      <div class="row">${num('zw', r.x1 - r.x0, 'Largeur')}${num('zd', r.y1 - r.y0, 'Profondeur')}</div><p class="muted sm">Glisse-la à sa place : elle se colle aux murs.</p>`;
  }
  return '<p class="muted sm">Glisse un mur (pointillés orange) : sa mesure s’affiche en direct. Touche un mur intérieur pour le régler, le couper, en faire une porte ou une ouverture.</p>';
}
function trPlanBind() {
  const svg = $('tr-svg'); if (!svg || !S.trP) return;
  const pt = (e) => { const m = svg.getScreenCTM(); if (!m) return [0, 0]; const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return [q.x, q.y]; };
  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    const P = S.trP, el = e.target.closest('[data-it],[data-op]');
    if (!el) { if (P.sel) { P.sel = null; trPlanDraw(); } return; }
    if (!trPlanCan()) return;
    const [x, y] = pt(e);
    if (el.dataset.op) { drag = { op: el.dataset.op, moved: false, sx: x, sy: y }; if (!['door', 'sdbdoor', 'win'].includes(drag.op)) { if (!trCan()) { drag = null; return; } trEditStart(drag); } }
    else { const it = P.p.items.find((i) => i.id === el.dataset.it); if (!it) return; drag = { it, dx: it.x - x, dy: it.y - y, sx: x, sy: y, moved: false }; }
    try { svg.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return; const P = S.trP, d = trData(P.rid), { W, D } = trWDH(d), [x, y] = pt(e);
    if (drag.op === 'door' || drag.op === 'sdbdoor') { trDoorAt(P.p, P.rid, drag.op === 'door' ? 'room' : 'sdb', x, y); drag.moved = true; }
    else if (drag.op !== 'win' && drag.op) { if (trEditMove(drag, x, y)) return; }
    else if (drag.op) {
      const o = P.p.win, width = trNum(d.fen_w) || 120;
      const ds = [y, W - x, D - y, x], wall = ds.indexOf(Math.min(...ds)), L = trWallLen(wall, W, D), half = Math.min(width, L) / 2;
      o.wall = wall; o.pos = Math.round(Math.min(L - half, Math.max(half, wall % 2 ? y : x)) / 5) * 5; drag.moved = true;
    } else {
      if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) < 6) return;
      drag.moved = true; const it = drag.it;
      if (it.t === 'tv') { const ds = [y, W - x, D - y, x], wall = ds.indexOf(Math.min(...ds)), L = trWallLen(wall, W, D), n = trAtWall('tv', wall, Math.min(L - 50, Math.max(50, wall % 2 ? y : x)), W, D); it.x = n.x; it.y = n.y; it.r = n.r; }
      else {
        const r = trRect(it), hw = (r.x1 - r.x0) / 2, hh = (r.y1 - r.y0) / 2;
        const cl = (v, h, max) => (2 * h >= max ? max / 2 : Math.min(max - h, Math.max(h, v)));
        it.x = cl(Math.round((x + drag.dx) / 5) * 5, hw, W); it.y = cl(Math.round((y + drag.dy) / 5) * 5, hh, D);
        // Aimant : un meuble à moins de 8 cm d'un mur se colle au mur.
        if (it.x - hw < 8) it.x = hw; if (W - it.x - hw < 8) it.x = W - hw; if (it.y - hh < 8) it.y = hh; if (D - it.y - hh < 8) it.y = D - hh;
      }
    }
    const g = $('tr-plan-g'); if (g) g.innerHTML = trPlanSvg();
  });
  const end = () => {
    if (!drag) return; const P = S.trP, dr = drag; drag = null;
    if (dr.it && !dr.moved) { P.sel = P.sel === dr.it.id ? null : dr.it.id; trPlanDraw(); return; }
    if (dr.op && !['door', 'sdbdoor', 'win'].includes(dr.op)) { trEditEnd(dr); return; }
    if (dr.it) P.sel = dr.it.id;
    if (dr.moved && dr.op) { const m = trDoorAdapt(P.p, P.rid); if (m.length) toast((dr.op === 'win' ? 'Fenêtre déplacée : ' : 'Porte déplacée : ') + m.join(', ') + '.', 5000); }
    trPlanDraw(); if (dr.moved) trPlanSave();
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
}

/* ---------- vue 3D (WebGL, sans bibliothèque) ---------- */
const TR_COL = {
  wood: [0.74, 0.58, 0.42], woodD: [0.50, 0.37, 0.26], white: [0.97, 0.96, 0.94], pillow: [1, 1, 1], duvet: [0.60, 0.69, 0.62], dark: [0.20, 0.20, 0.22],
  wall: [0.99, 0.97, 0.93], glass: [0.84, 0.92, 0.99], frame: [1, 1, 1], door: [0.66, 0.49, 0.32], lamp: [1.0, 0.93, 0.74], textile: [0.50, 0.58, 0.68], metal: [0.72, 0.72, 0.75], rug: [0.88, 0.84, 0.77],
};
const TR_FLOOR = { parquet: [[0.80, 0.64, 0.46], 1], pvc: [[0.74, 0.70, 0.64], 1], moquette: [[0.56, 0.60, 0.68], 4], carrelage: [[0.86, 0.85, 0.82], 2], autre: [[0.78, 0.74, 0.68], 0] };
// Matières (dernier champ d'une pièce) : 0 uni, 1 parquet, 2 carrelage, 3 bois veiné, 4 tissu, 5 mur, 6 lumineux (vitre, abat-jour).
// Les pièces d'un meuble : [centre x, centre y (repère du meuble), largeur, profondeur, bas, haut, couleur, matière], en cm.
function trParts(it, duvet, noLamp) {
  const m = trDim(it), w = m.w, d = m.d, h = m.h, C = TR_COL, legs = (ix, iy, top, c, k) => [[-ix, -iy], [ix, -iy], [-ix, iy], [ix, iy]].map(([x, y]) => [x, y, 4, 4, 0, top, c, k || 0]);
  const dark = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  if (trIsBed(it)) {
    const dv = duvet || C.duvet, pw = it.t === 'lit_d' ? w / 2 - 14 : w - 26, px = it.t === 'lit_d' ? [-w / 4, w / 4] : [0];
    const pil = px.flatMap((x) => [[x, -d / 2 + 30, pw, 36, 50, 59, C.pillow, 4], [x, -d / 2 + 31, pw - 6, 30, 59, 62, C.pillow, 4]]);
    return [[0, 0, w, d, 10, 28, C.wood, 3], ...legs(w / 2 - 5, d / 2 - 5, 10, C.woodD, 3), [0, 2, w - 4, d - 8, 28, 50, C.white, 4],
      [0, -d / 2 + 4, w + 6, 8, 0, 108, C.woodD, 3], [0, -d / 2 + 8.5, w - 10, 1, 58, 102, dark(C.woodD, 1.18), 3],
      [0, d * 0.17, w, d * 0.64, 50, 55, dv, 4], [0, -d * 0.145, w, 9, 50, 56, C.white, 4], [0, d / 2 - 24, w + 0.6, 34, 50, 55.6, dark(dv, 0.78), 4], ...pil];
  }
  if (it.t === 'chevet') return [[0, 0, w, d, 4, h, C.wood, 3], ...legs(w / 2 - 4, d / 2 - 4, 4, C.woodD, 3), [0, d / 2 + 0.4, w - 8, 0.8, h - 17, h - 15.5, C.woodD, 0], ...(noLamp ? [] : [[0, 0, 11, 11, h, h + 2, C.metal, 0], [0, 0, 3, 3, h + 2, h + 20, C.metal, 0], [0, 0, 20, 20, h + 20, h + 38, C.lamp, 6]])];
  if (it.t === 'bureau') return [[0, 0, w, d, h - 4, h, C.wood, 3], [0, -d / 2 + 2, w - 12, 2, h - 16, h - 4, C.wood, 3], ...legs(w / 2 - 4, d / 2 - 4, h - 4, C.dark)];
  if (it.t === 'chaise') return [[0, 1, w - 4, d - 6, 42, 47, C.textile, 4], [0, -d / 2 + 4, w - 6, 4, 52, h, C.textile, 4], [-w / 2 + 5, -d / 2 + 4, 3, 3, 42, 52, C.dark, 0], [w / 2 - 5, -d / 2 + 4, 3, 3, 42, 52, C.dark, 0], ...legs(w / 2 - 5, d / 2 - 5, 42, C.dark)];
  if (it.t === 'fauteuil') return [[0, 2, w, d - 4, 12, 38, C.textile, 4], [0, 6, w - 30, d - 26, 38, 46, dark(C.textile, 1.08), 4], [0, -d / 2 + 9, w, 18, 38, h, C.textile, 4], [-w / 2 + 7, 4, 14, d - 10, 38, 58, C.textile, 4], [w / 2 - 7, 4, 14, d - 10, 38, 58, C.textile, 4], ...legs(w / 2 - 6, d / 2 - 6, 12, C.woodD, 3)];
  if (it.t === 'armoire') return [[0, 0, w, d, 6, h, C.wood, 3], [0, 0, w - 6, d - 6, 0, 6, C.woodD, 0], [0, d / 2 + 0.3, 0.8, 0.6, 10, h - 4, C.woodD, 0], [-5, d / 2 + 1.5, 1.6, 3, h / 2 - 9, h / 2 + 9, C.metal, 0], [5, d / 2 + 1.5, 1.6, 3, h / 2 - 9, h / 2 + 9, C.metal, 0]];
  if (it.t === 'tv') return [[0, 0, w, 5, 100, 100 + h, C.dark, 0], [0, 2.8, w - 4, 0.6, 102, 98 + h, [0.07, 0.08, 0.11], 0]];
  const CER = [0.95, 0.95, 0.93], WAT = [0.80, 0.88, 0.93];
  if (it.t === 'wc') return [[0, -d / 2 + 9, w - 2, 18, 38, 78, CER, 0], [0, 6, w - 4, d - 22, 0, 38, CER, 0], [0, 6, w, d - 20, 38, 41, [0.98, 0.98, 0.97], 0], [0, -d / 2 + 9, 8, 3, 78, 79.5, C.metal, 0]];
  if (it.t === 'lavabo') return [...(w >= 80 ? [[0, 0, w, d, 12, 80, C.wood, 3], [0, d / 2 + 0.4, w - 10, 0.8, 46, 47, C.woodD, 0]] : [[0, -d / 2 + 12, 18, 18, 0, 78, CER, 0]]), [0, 0, w, d, 78, 88, CER, 0], [0, 2, w - 16, d - 18, 87.5, 88.3, WAT, 0], [0, -d / 2 + 5, 4, 12, 88, 102, C.metal, 0], [0, -d / 2 + 1.2, Math.min(w - 4, 70), 2, 108, 178, [0.78, 0.82, 0.85], 0], ...(it.n ? [[0, -d / 2 + 2.4, Math.min(w - 4, 70) + 6, 1, 105, 181, C.metal, 0]] : [])];
  if (it.t === 'baignoire') return [[0, 0, w, d, 0, 55, CER, 0], [0, 0, w - 14, d - 14, 54.5, 55.4, WAT, 0], [-w / 2 + 12, -d / 2 + 4, 5, 8, 55, 72, C.metal, 0], [-w / 2 + 12, -d / 2 + 2, 4, 3, 72, 190, C.metal, 0], [-w / 2 + 12, -d / 2 + 10, 14, 14, 186, 189, C.metal, 0]];
  if (it.t === 'douche') { const ita = /italienne/.test(it.n || ''); return [[0, 0, w, d, 0, ita ? 1 : 4, ita ? [0.55, 0.55, 0.53] : CER, ita ? 2 : 0], [0, 0, 10, 10, ita ? 1 : 4, ita ? 1.4 : 4.4, C.metal, 0], [w / 2 - 1, d / 4, 1.2, d / 2, ita ? 1 : 4, 200, [0.70, 0.84, 0.90], 7], [w / 2 - 1, d / 2 - 1, 2, 2, 0, 200, C.metal, 0], [0, -d / 2 + 2, 4, 3, 100, 200, C.metal, 0], [0, -d / 2 + 14, 22, 22, 196, 199, C.metal, 0]]; }
  if (it.t === 'bagages') return [[0, 0, w, d, 40, 44, C.wood, 3], [0, -d / 2 + 2, w, 3, 44, 52, C.wood, 3], ...legs(w / 2 - 4, d / 2 - 4, 40, C.woodD, 3)];
  return [[0, 0, w, d, 0, h, C.wood, 3]];
}
function trScene(roomId, p) {
  const d = trData(roomId), { W, D, H } = trWDH(d), cm = 0.01, B = [], walls = [];
  const box = (x0, y0, z0, x1, y1, z1, c, k, extra) => ({ t: [((x0 + x1) / 2 - W / 2) * cm, ((z0 + z1) / 2) * cm, ((y0 + y1) / 2 - D / 2) * cm], s: [Math.max(0.2, x1 - x0) * cm, Math.max(0.2, z1 - z0) * cm, Math.max(0.2, y1 - y0) * cm], c, k: k || 0, ...(extra || {}) });
  const deco = p.deco || {}, dsol = trDecoOf(TR_DECO_SOL, deco.sol), fl = dsol ? [dsol[2], dsol[3] === 0 ? 4 : dsol[3]] : (TR_FLOOR[d.sol] || TR_FLOOR.parquet);
  B.push(box(-8, -8, -6, W + 8, D + 8, 0, fl[0], fl[1]));
  const dmur = trDecoOf(TR_DECO_MUR, deco.mur), dacc = trDecoOf(TR_DECO_ACCENT, deco.accent), bed0 = p.items.find(trIsBed);
  const headWall = bed0 ? ((bed0.r || 0) / 90) % 4 : -1, accWall = dacc && dacc[2] ? headWall : -1; // le mur d'accent est celui de la tête de lit
  const T = 8, wc = dmur ? dmur[2] : (d.murs === 'papier' ? [0.93, 0.90, 0.84] : TR_COL.wall);
  const wdef = [[-T, -T, W + T, 0, [0, -1]], [W, -T, W + T, D + T, [1, 0]], [-T, D, W + T, D + T, [0, 1]], [-T, -T, 0, D + T, [-1, 0]]];
  wdef.forEach(([x0, y0, x1, y1, n], i) => walls.push({ i, n, c: [((x0 + x1) / 2 - W / 2) * cm, ((y0 + y1) / 2 - D / 2) * cm], glass: [], curt: [], boxes: [box(x0, y0, 0, x1, y1, H, i === accWall ? dacc[2] : wc, 5)] }));
  // Tout ce qui est plaqué sur un mur (plinthe, porte, fenêtre, rideaux, cadre, télé) disparaît avec lui.
  const onWall = (o, width, z0, z1, deep, c, k) => { const z = trOpening(o, width, W, D, deep); return box(z.x0, z.y0, z0, z.x1, z.y1, z1, c, k); };
  walls.forEach((wl, i) => { const L = trWallLen(i, W, D); wl.boxes.push(onWall({ wall: i, pos: L / 2 }, L, 0, 8, 1.4, [0.97, 0.97, 0.96])); });
  const fw = trNum(d.fen_w) || 120, fh = trNum(d.fen_h) || 120, al = trNum(d.fen_allege) || 90, ft = Math.min(H - 11, al + fh), wwl = walls[p.win.wall];
  wwl.boxes.push(onWall(p.win, fw + 14, al - 7, Math.min(H - 4, ft + 7), 2.2, TR_COL.frame), onWall(p.win, fw, al, ft, 3, TR_COL.glass, 6), onWall(p.win, 4, al, ft, 4, TR_COL.frame), onWall(p.win, fw + 20, al - 9, al - 6, 7, TR_COL.frame));
  trFen2(d).forEach((f) => { const w2 = trNum(f.w) || fw; walls[f.wall].boxes.push(onWall(f, w2 + 14, al - 7, Math.min(H - 4, ft + 7), 2.2, TR_COL.frame), onWall(f, w2, al, ft, 3, TR_COL.glass, 6), onWall(f, 4, al, ft, 4, TR_COL.frame), onWall(f, w2 + 20, al - 9, al - 6, 7, TR_COL.frame)); });
  if (deco.rideau && deco.rideau !== 'aucun') {
    const tis = trDecoOf(TR_DECO_TISSU, deco.tissu) || TR_DECO_TISSU[0], top = Math.min(H - 4, al + fh + 22), pw = Math.max(34, fw * 0.32), n = Math.max(4, Math.round(pw / 7)), sw = pw / n;
    wwl.boxes.push(onWall(p.win, fw + 2 * pw - 6, top, top + 2.5, 9, TR_COL.metal));
    // Rideaux à plis : des bandes de profondeur et de teinte alternées.
    if (deco.rideau !== 'voilage') [-1, 1].forEach((sg) => { for (let i = 0; i < n; i++) { const c = p.win.pos + sg * (fw / 2 - 10 + sw * (i + 0.5)), f = i % 2 ? 0.90 : 1; const bx = onWall({ wall: p.win.wall, pos: c }, sw + 0.3, 3, top, i % 2 ? 7.5 : 10.5, [tis[2][0] * f, tis[2][1] * f, tis[2][2] * f], 4); bx.cur = 1; wwl.boxes.push(bx); }
      // Pour le rendu soigné : un vrai panneau plissé à la place des bandes.
      wwl.curt.push(onWall({ wall: p.win.wall, pos: p.win.pos + sg * (fw / 2 - 10 + pw / 2) }, pw, 3, top, 14, tis[2], 4)); });
    if (deco.rideau !== 'occultant') wwl.glass.push(onWall(p.win, fw + 16, 3, top, 5.5, [1, 1, 1]));
  }
  const dh = Math.min(204, H - 10), dwl = walls[p.door.wall], dL = trWallLen(p.door.wall, W, D);
  dwl.boxes.push(onWall(p.door, trDW(p) + 12, 0, dh + 6, 2, TR_COL.frame), onWall(p.door, trDW(p), 0, dh, 3.4, TR_COL.door, 3), onWall({ wall: p.door.wall, pos: Math.min(dL - 6, p.door.pos + trDW(p) / 2 - 9) }, 3, 98, 102, 9, TR_COL.metal), onWall({ wall: p.door.wall, pos: Math.min(dL - 10, p.door.pos + trDW(p) / 2 - 14) }, 12, 99, 101, 9.5, TR_COL.metal));
  // Un cadre au-dessus de la tête de lit, s'il n'y a pas de fenêtre à cet endroit.
  if (bed0 && H >= 225) {
    const pos = headWall % 2 ? bed0.y : bed0.x, clear = p.win.wall !== headWall || Math.abs(p.win.pos - pos) > fw / 2 + 50;
    if (clear) walls[headWall].boxes.push(onWall({ wall: headWall, pos }, 74, 138, 190, 2.4, [0.16, 0.15, 0.14]), onWall({ wall: headWall, pos }, 66, 142, 186, 2.9, [0.94, 0.92, 0.87]), onWall({ wall: headWall, pos: pos - 6 }, 26, 152, 176, 3.2, dacc && dacc[2] ? dacc[2] : [0.60, 0.69, 0.62]));
  }
  const sdb = trSdbRect(d, p, W, D), glass = [], sdbLow = [], sdbHigh = [];
  // Salle de bain : sol carrelé, cloisons avec leur porte. Vue d'ensemble : cloisons coupées à mi-hauteur pour voir dedans.
  if (sdb) {
    B.push(box(sdb.x0, sdb.y0, 0, sdb.x1, sdb.y1, 0.5, [0.86, 0.85, 0.82], 2));
    const sd = sdb.z ? null : trSdbDoor(sdb, p, W, D), T2 = 4, tile = [0.93, 0.93, 0.91];
    const part = (vertical, at, lo, hi) => {
      const seg = (a0, a1, z0, z1, list) => { if (a1 - a0 < 1) return; list.push(vertical ? box(at - T2, a0, z0, at + T2, a1, z1, tile, 5) : box(a0, at - T2, z0, a1, at + T2, z1, tile, 5)); };
      const gap = sd && sd.side === (vertical ? 'v' : 'h') ? [sd.a, sd.b] : null;
      [[sdbHigh, H], [sdbLow, Math.min(H, 105)]].forEach(([list, top]) => {
        if (gap) { seg(lo, gap[0], 0, top, list); seg(gap[1], hi, 0, top, list); if (top > 205) seg(gap[0], gap[1], 205, top, list); } else seg(lo, hi, 0, top, list);
      });
      if (gap) sdbHigh.push(vertical ? box(at - T2 - 1, gap[0], 0, at + T2 + 1, gap[0] + 3, 205, TR_COL.frame) : box(gap[0], at - T2 - 1, 0, gap[0] + 3, at + T2 + 1, 205, TR_COL.frame));
    };
    if (!sdb.z) {
    if (sd ? sd.vIn : (sdb.x0 > 0.5 && sdb.x0 < W - 0.5) || (sdb.x1 > 0.5 && sdb.x1 < W - 0.5)) { const vx = sd ? sd.vx : (p.sdb.c[1] === 'e' ? sdb.x0 : sdb.x1); part(true, vx, sdb.y0, sdb.y1); }
    if (sd ? sd.hIn : true) { const hy = sd ? sd.hy : (p.sdb.c[0] === 's' ? sdb.y0 : sdb.y1); if (hy > 0.5 && hy < D - 0.5) part(false, hy, sdb.x0, sdb.x1); }
    }
  }
  // Murs intérieurs du scan (ou ajoutés) : pleine hauteur dedans, coupés à mi-hauteur en vue d'ensemble. Porte : linteau au-dessus.
  trCls(d).forEach((c) => {
    const r = trClRect(c, TR_CL_T);
    if (c.k) { if (c.k === 'p' && H > 212) sdbHigh.push(box(r.x0, r.y0, 205, r.x1, r.y1, H, wc, 5)); if (c.k === 'p') { const q = trClV(c) ? box(r.x0 - 1, Math.min(c.y0, c.y1), 0, r.x1 + 1, Math.min(c.y0, c.y1) + 3, 205, TR_COL.frame) : box(Math.min(c.x0, c.x1), r.y0 - 1, 0, Math.min(c.x0, c.x1) + 3, r.y1 + 1, 205, TR_COL.frame); sdbHigh.push(q); } return; }
    sdbHigh.push(box(r.x0, r.y0, 0, r.x1, r.y1, H, wc, 5)); sdbLow.push(box(r.x0, r.y0, 0, r.x1, r.y1, Math.min(H, 105), wc, 5));
  });
  // Ce qui n'est pas la chambre : un bloc plein, pour lire la vraie forme de la pièce.
  trHors(d).forEach((r) => { sdbHigh.push(box(r.x0, r.y0, 0, r.x1, r.y1, H, wc, 5)); sdbLow.push(box(r.x0, r.y0, 0, r.x1, r.y1, Math.min(H, 105), [0.55, 0.55, 0.54], 5)); });
  // Un tapis au pied du lit, s'il tient dans la pièce.
  if (bed0) {
    const m = trDim(bed0), q = trLocal(bed0, 0, m.d / 2 - 25, m.w + 90, 150), r = { x0: Math.max(6, q.x0), y0: Math.max(6, q.y0), x1: Math.min(W - 6, q.x1), y1: Math.min(D - 6, q.y1) };
    if (r.x1 - r.x0 > 90 && r.y1 - r.y0 > 90 && !(sdb && trHit(r, sdb))) B.push(box(r.x0, r.y0, 0, r.x1, r.y1, 1.2, TR_COL.rug, 4));
  }
  const dl = trDecoOf(TR_DECO_TISSU, deco.linge), duvet = dl ? dl[2] : null;
  const lum = trLum(deco);
  const models = []; // pour le rendu soigné : où poser un vrai modèle 3D à la place des blocs
  p.items.forEach((it) => {
    const dest = it.t === 'tv' ? walls[((it.r || 0) / 90) % 4].boxes : B, mi = models.length;
    { const m = trDim(it); models.push({ id: it.id, tv: it.t === 'tv', t: it.t, x: (it.x - W / 2) * cm, z: (it.y - D / 2) * cm, r: it.r || 0, w: m.w * cm, d: m.d * cm, h: m.h * cm, lim: trIsSan(it) && sdb ? [(sdb.x0 - W / 2) * cm, (sdb.y0 - D / 2) * cm, (sdb.x1 - W / 2) * cm, (sdb.y1 - D / 2) * cm] : null }); }
    trParts(it, duvet, lum.includes('appliques')).forEach(([lx, ly, sx, sy, z0, z1, c, k]) => { const q = trLocal(it, lx, ly, sx, sy); dest.push(box(q.x0, q.y0, z0, q.x1, q.y1, z1, c, k, { cast: it.t !== 'tv', lamp: c === TR_COL.lamp, soft: c === TR_COL.pillow, mi })); });
  });
  // Éclairage choisi : appliques liseuses de chaque côté de la tête de lit, ruban LED derrière la tête de lit.
  p.items.filter(trIsBed).forEach((b) => {
    const m = trDim(b), put = (lx, ly, sx, sy, z0, z1, c, k, extra) => { const q = trLocal(b, lx, ly, sx, sy); B.push(box(q.x0, q.y0, z0, q.x1, q.y1, z1, c, k, extra)); };
    if (lum.includes('appliques')) [-1, 1].forEach((sg) => { const lx = sg * (m.w / 2 + 16), q = trLocal(b, lx, -m.d / 2 + 6, 12, 12); if (q.x0 < 0 || q.y0 < 0 || q.x1 > W || q.y1 > D) return; put(lx, -m.d / 2 + 2, 7, 4, 112, 124, TR_COL.metal, 0); put(lx, -m.d / 2 + 8, 12, 12, 110, 126, TR_COL.lamp, 6, { lamp: true }); });
    if (lum.includes('ruban')) put(0, -m.d / 2 + 1.2, m.w + 14, 2.4, 108.5, 111, TR_COL.lamp, 6, { glow: true });
  });
  const spots = []; if (lum.includes('spots')) { const nx = Math.max(1, Math.round(W / 160)), ny = Math.max(1, Math.round(D / 160)); for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) spots.push([((i + 0.5) / nx - 0.5) * W * cm, ((j + 0.5) / ny - 0.5) * D * cm]); }
  // Une plante verte dans un coin libre (rendu soigné seulement) : jamais devant la porte, la fenêtre ou un meuble.
  const plants = [];
  if (bed0) {
    const obs = p.items.filter((it) => it.t !== 'tv').map(trRect).concat(sdb ? [sdb] : [], trBati(d), [trOpening(p.door, trDW(p) + 30, W, D, 110), trOpening(p.win, fw + 110, W, D, 45)]);
    p.items.filter((it) => it.t === 'tv').forEach((it) => obs.push(trLocal(it, 0, 0, trDim(it).w, 40)));
    const cs = [[30, 30], [W - 30, 30], [W - 30, D - 30], [30, D - 30]].filter(([x, y]) => trFree({ x0: x - 24, y0: y - 24, x1: x + 24, y1: y + 24 }, obs, W, D));
    if (cs.length) { const far = (q) => Math.hypot(q[0] - bed0.x, q[1] - bed0.y); cs.sort((a, b) => far(a) - far(b)); const q = cs[cs.length - 1]; plants.push([(q[0] - W / 2) * cm, (q[1] - D / 2) * cm]); }
  }
  // Point de vue « depuis la porte » : à 50 cm à l'intérieur, à hauteur des yeux, tourné vers le milieu de la pièce.
  const dz = trOpening(p.door, 10, W, D, 50), de = [(((dz.x0 + dz.x1) / 2) - W / 2) * cm, 1.55, (((dz.y0 + dz.y1) / 2) - D / 2) * cm];
  const inward = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.door.wall], dEye = [de[0] + inward[0] * 0.25, 1.55, de[2] + inward[1] * 0.25];
  const doorPick = [];
  { const q = trOpening(p.door, trDW(p), W, D, 30); doorPick.push({ kind: 'room', b: box(q.x0, q.y0, 0, q.x1, q.y1, 205, [1, 1, 1]) }); }
  if (sdb && !sdb.z) { const sd = trSdbDoor(sdb, p, W, D); if (sd) doorPick.push({ kind: 'sdb', b: sd.side === 'v' ? box(sd.vx - 15, sd.a, 0, sd.vx + 15, sd.b, 205, [1, 1, 1]) : box(sd.a, sd.hy - 15, 0, sd.b, sd.hy + 15, 205, [1, 1, 1]) }); }
  return { doorPick, W: W * cm, D: D * cm, H: H * cm, B, glass, walls, plants, models, lum: { plaf: lum.includes('plafonnier'), corniche: lum.includes('corniche'), spots }, ceil: box(-T, -T, H, W + T, D + T, H + 6, [0.955, 0.955, 0.95], 6), sdbWall: null, sdbLow, sdbHigh, Wc: W, Dc: D, Hc: H, win: { wall: p.win.wall, pos: p.win.pos, w: fw, z0: al, z1: ft }, dEye, dYaw: Math.atan2(-dEye[0], -dEye[2]) };
}
const TR_GL = { gl: null, raf: 0, ask: null, snap: null, three: null, token: null };
window.addEventListener('resize', () => { if (TR_GL.gl && TR_GL.ask) TR_GL.ask(); });
function trGlStop() { TR_GL.token = null; if (TR_GL.three) { try { TR_GL.three.stop(); } catch (_) {} TR_GL.three = null; } if (TR_GL.raf) cancelAnimationFrame(TR_GL.raf); TR_GL.raf = 0; if (TR_GL.gl) { const x = TR_GL.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } TR_GL.gl = null; TR_GL.ask = null; TR_GL.snap = null; }
// Petites matrices 4×4 (colonnes d'abord), juste ce qu'il faut pour une caméra et une lampe.
const trM4 = {
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
  look(eye, tg, up) {
    const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const f = nrm([tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]]), s = nrm(cr(f, up)), u = cr(s, f);
    return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, eye), -dot(u, eye), dot(f, eye), 1];
  },
  persp(fovDeg, aspect, n, f) { const t = 1 / Math.tan((fovDeg * Math.PI / 180) / 2); return [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; },
  ortho(r, t, n, f) { return [1 / r, 0, 0, 0, 0, 1 / t, 0, 0, 0, 0, -2 / (f - n), 0, 0, 0, -(f + n) / (f - n), 1]; },
};
const TR_VS = 'attribute vec3 p;attribute vec3 n;uniform mat4 uM;uniform mat4 uL;uniform vec3 uT;uniform vec3 uS;varying vec3 vN;varying vec3 vW;varying vec4 vL;void main(){vec3 w=p*uS+uT;vW=w;vN=n;vL=uL*vec4(w,1.0);gl_Position=uM*vec4(w,1.0);}';
const TR_HP = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
const TR_FS = TR_HP + 'uniform vec4 uC;uniform float uK;uniform sampler2D uSh;uniform vec3 uLd;uniform vec2 uR;uniform float uTx;varying vec3 vN;varying vec3 vW;varying vec4 vL;'
  + 'float unp(vec4 c){return dot(c,vec4(1.0,1.0/255.0,1.0/65025.0,1.0/16581375.0));}'
  + 'float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}'
  // Ombre portée adoucie : 25 lectures autour du point dans la carte de profondeur de la lampe.
  + 'float shadow(float nl){vec3 q=vL.xyz/vL.w*0.5+0.5;if(q.x<0.0||q.x>1.0||q.y<0.0||q.y>1.0||q.z>1.0)return 1.0;float bias=mix(0.0045,0.0018,nl);float s=0.0;for(int i=-2;i<=2;i++){for(int j=-2;j<=2;j++){float d=unp(texture2D(uSh,q.xy+vec2(float(i),float(j))*uTx*1.4));s+=(q.z-bias>d)?0.0:1.0;}}return s/25.0;}'
  + 'void main(){vec3 N=normalize(vN);vec3 c=uC.rgb;'
  + 'if(uK>5.5){gl_FragColor=vec4(c,uC.a);return;}'
  + 'if(uK>0.5&&uK<1.5&&N.y>0.5){float u=vW.x/0.13;float pl=floor(u);float v=vW.z/1.15+hash(vec2(pl,3.0));float tone=hash(vec2(pl,floor(v)));c*=0.89+0.17*tone;float g=sin(vW.z*52.0+tone*31.0+sin(vW.x*33.0)*1.6)*0.5+0.5;c*=0.975+0.025*g;float a=smoothstep(0.455,0.5,abs(fract(u)-0.5));float b=smoothstep(0.989,1.0,fract(v));c*=1.0-0.24*max(a,b);}'
  + 'if(uK>1.5&&uK<2.5&&N.y>0.5){vec2 t=vW.xz/0.6;c*=0.96+0.05*hash(floor(t));float a=smoothstep(0.478,0.5,abs(fract(t.x)-0.5));float b=smoothstep(0.478,0.5,abs(fract(t.y)-0.5));c*=1.0-0.20*max(a,b);}'
  + 'if(uK>2.5&&uK<3.5){float along=abs(N.y)>0.5?vW.x:vW.y;float across=abs(N.x)>0.5?vW.z:(abs(N.y)>0.5?vW.z:vW.x);float g=sin(across*38.0+sin(along*5.0)*2.6+sin(along*1.7)*4.0)*0.5+0.5;c*=0.955+0.045*g;}'
  + 'if(uK>3.5&&uK<4.5){vec3 f=floor(vW*260.0);c*=0.955+0.045*hash(f.xz+f.y*1.7);}'
  + 'float nl=max(dot(N,uLd),0.0);float sh=shadow(nl);'
  + 'vec3 lit=c*(vec3(0.745,0.74,0.75)+0.095*N.y+vec3(0.33,0.315,0.29)*nl*sh);'
  // Assombrissement doux dans les angles et au pied des murs : ce qui donne du relief à une pièce.
  + 'float dx=uR.x-abs(vW.x);float dz=uR.y-abs(vW.z);'
  + 'if(uK>4.5&&uK<5.5){lit*=0.85+0.15*smoothstep(0.0,0.55,max(dx,dz));lit*=0.91+0.09*smoothstep(0.0,0.4,vW.y);}'
  + 'else if(N.y>0.5&&vW.y<0.03){lit*=0.82+0.18*smoothstep(0.0,0.5,min(dx,dz));}'
  + 'gl_FragColor=vec4(lit,uC.a);}';
const TR_DVS = 'attribute vec3 p;attribute vec3 n;uniform mat4 uL;uniform vec3 uT;uniform vec3 uS;void main(){gl_Position=uL*vec4(p*uS+uT,1.0);}';
const TR_DFS = TR_HP + 'void main(){float z=gl_FragCoord.z;vec4 e=fract(vec4(1.0,255.0,65025.0,16581375.0)*z);e-=e.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);gl_FragColor=e;}';
// Le rendu soigné (three.js) se charge à la demande ; s'il ne peut pas (vieux téléphone, pas de réseau au premier essai), le dessin simple prend le relais.
function trGlStart() {
  let cv = $('tr-gl'); const P = S.trP; if (!cv || !P) return;
  if (TR_GL.three || TR_GL.gl) { trGlStop(); const fresh = cv.cloneNode(false); cv.replaceWith(fresh); cv = fresh; } // une toile neuve : l'ancienne a rendu son contexte
  trGlStop();
  if (!P.cam) { const { W, D, H } = trWDH(trData(P.rid)); P.cam = { mode: 'orbit', yaw: 0.65, pitch: 0.58, dist: Math.max(W, D) / 100 * 1.3 + H / 100 * 0.75 + 0.9, ly: 0, lp: -0.1 }; }
  const token = TR_GL.token = {};
  const basic = () => { if (TR_GL.token !== token) return; const old = $('tr-gl'); if (!old) return; const fresh = old.cloneNode(false); old.replaceWith(fresh); trGlStartBasic(); };
  import('./travaux-rendu.js?v=' + APP_V).then((mod) => {
    if (TR_GL.token !== token || !cv.isConnected) return;
    try { const h = mod.trRendu({ canvas: cv, lab: $('tr-lab'), sc: trScene(P.rid, P.p), cam: P.cam, fmt: trM, cotes: () => P.cotes !== false, soir: () => !!P.soir, move: () => !!P.move,
      onDoor: (kind, x, y) => { if (!trPlanCan()) return; if (!trDoorAt(P.p, P.rid, kind, x, y)) return; const m = trDoorAdapt(P.p, P.rid); toast(m.length ? 'Porte déplacée : ' + m.join(', ') + '.' : 'Porte déplacée ✓', 4000); trPlanSave(); trPlanBar(); trGlStart(); }, lumi: () => (P.lumi || 100) / 100, edit: trPlanCan(), sel: () => P.sel,
      onSelect: (id) => { P.sel = id && id !== P.sel ? id : null; trPlanBar(); if (TR_GL.ask) TR_GL.ask(); },
      onMove: (id, x, y) => { const it = P.p.items.find((i) => i.id === id); if (!it) return; it.x = x; it.y = y; P.sel = id; trPlanSave(); trPlanBar(); if (trIsBed(it) && trLum(P.p.deco).some((k) => k === 'appliques' || k === 'ruban')) trGlStart(); } }); TR_GL.three = h; TR_GL.ask = h.ask; TR_GL.snap = h.snap; }
    catch (e) { console.warn('rendu', e); basic(); }
  }).catch((e) => { console.warn('rendu', e); basic(); });
}
function trGlStartBasic() {
  const cv = $('tr-gl'), P = S.trP; if (!cv || !P) return;
  trGlStop();
  const gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) { const l = $('tr-lab'); if (l) l.innerHTML = '<span style="left:50%;top:50%">La 3D n’est pas disponible sur cet appareil</span>'; return; }
  TR_GL.gl = gl;
  const sc = trScene(P.rid, P.p);
  const mk = (vs, fs) => { const pr = gl.createProgram(); [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([t, src]) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('shader', gl.getShaderInfoLog(s)); gl.attachShader(pr, s); }); gl.bindAttribLocation(pr, 0, 'p'); gl.bindAttribLocation(pr, 1, 'n'); gl.linkProgram(pr); return pr; };
  const prog = mk(TR_VS, TR_FS), dprog = mk(TR_DVS, TR_DFS);
  // Cube unité : 6 faces, 4 sommets chacune, avec leur normale.
  const F = [[0, 0, 1, [-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1]], [0, 0, -1, [1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1]], [1, 0, 0, [1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1]], [-1, 0, 0, [-1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1]], [0, 1, 0, [-1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1]], [0, -1, 0, [-1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1]]];
  const vb = [], ib = [];
  F.forEach(([nx, ny, nz, q], f) => { for (let i = 0; i < 4; i++) vb.push(q[i * 3] / 2, q[i * 3 + 1] / 2, q[i * 3 + 2] / 2, nx, ny, nz); ib.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3); });
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vb), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ib), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  const uni = (pr, names) => { const o = {}; names.forEach((k) => o[k] = gl.getUniformLocation(pr, k)); return o; };
  const U = uni(prog, ['uM', 'uL', 'uT', 'uS', 'uC', 'uK', 'uSh', 'uLd', 'uR', 'uTx']), DU = uni(dprog, ['uL', 'uT', 'uS']);
  // La lampe : une lumière douce qui tombe du plafond, légèrement de biais. Seuls les meubles portent une ombre.
  const ld = [-0.42, 0.86, 0.29], half = Math.hypot(sc.W, sc.D) / 2 + 0.7, reach = half + sc.H / 2 + 0.6, SZ = 1024;
  const LM = trM4.mul(trM4.ortho(half, half, 14 - reach, 14 + reach), trM4.look([ld[0] * 14, sc.H / 2 + ld[1] * 14, ld[2] * 14], [0, sc.H / 2, 0], [0, 0, -1]));
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SZ, SZ, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  const fbo = gl.createFramebuffer(), rb = gl.createRenderbuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SZ, SZ); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  gl.useProgram(dprog); gl.viewport(0, 0, SZ, SZ); gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.uniformMatrix4fv(DU.uL, false, LM);
  sc.B.forEach((b) => { if (!b.cast) return; gl.uniform3fv(DU.uT, b.t); gl.uniform3fv(DU.uS, b.s); gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0); });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.useProgram(prog); gl.uniformMatrix4fv(U.uL, false, LM); gl.uniform3fv(U.uLd, ld); gl.uniform2f(U.uR, sc.W / 2, sc.D / 2); gl.uniform1f(U.uTx, 1 / SZ); gl.uniform1i(U.uSh, 0);
  if (!P.cam) P.cam = { mode: 'orbit', yaw: 0.65, pitch: 0.58, dist: Math.max(sc.W, sc.D) * 1.3 + sc.H * 0.75 + 0.9, ly: 0, lp: -0.1 };
  const cam = P.cam;
  const drawBox = (b, a) => { gl.uniform3fv(U.uT, b.t); gl.uniform3fv(U.uS, b.s); gl.uniform4f(U.uC, b.c[0], b.c[1], b.c[2], a == null ? 1 : a); gl.uniform1f(U.uK, a == null ? b.k : 6); gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0); };
  function frame(hi) {
    TR_GL.raf = 0; if (TR_GL.gl !== gl || !cv.isConnected) return;
    const dpr = hi === true ? 3 : Math.min(2, window.devicePixelRatio || 1), w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const inside = cam.mode === 'porte';
    let eye, tg, fov = 42;
    if (inside) { const yaw = sc.dYaw + cam.ly, cp = Math.cos(cam.lp); eye = sc.dEye; tg = [eye[0] + cp * Math.sin(yaw), eye[1] + Math.sin(cam.lp), eye[2] + cp * Math.cos(yaw)]; fov = Math.min(100, Math.max(50, 2 * Math.atan(Math.tan(36 * Math.PI / 180) / (w / h)) * 180 / Math.PI)); }
    else { const cp = Math.cos(cam.pitch), ty = sc.H * 0.32; eye = [cam.dist * cp * Math.sin(cam.yaw), ty + cam.dist * Math.sin(cam.pitch), cam.dist * cp * Math.cos(cam.yaw)]; tg = [0, ty, 0]; }
    const M = trM4.mul(trM4.persp(fov, w / h, inside ? 0.05 : 0.1, 60), trM4.look(eye, tg, [0, 1, 0]));
    gl.uniformMatrix4fv(U.uM, false, M);
    gl.disable(gl.BLEND); gl.depthMask(true);
    drawBox(sc.B[0]);
    // Vue d'ensemble : les murs entre l'œil et la pièce s'effacent, comme une maison de poupée. De l'intérieur : tout est là, plafond compris.
    const hidden = sc.walls.map((wl) => !inside && (eye[0] - wl.c[0]) * wl.n[0] + (eye[2] - wl.c[1]) * wl.n[1] > 0);
    sc.walls.forEach((wl, i) => { if (!hidden[i]) wl.boxes.forEach((b) => drawBox(b)); });
    if (inside) { drawBox(sc.ceil); (sc.sdbHigh || []).forEach((b) => drawBox(b)); } else (sc.sdbLow || []).forEach((b) => drawBox(b));
    for (let i = 1; i < sc.B.length; i++) drawBox(sc.B[i]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    if (!inside) sc.glass.forEach((b) => drawBox(b, 0.38)); sc.walls.forEach((wl, i) => { if (!hidden[i]) wl.glass.forEach((b) => drawBox(b, 0.5)); });
    gl.depthMask(true); gl.disable(gl.BLEND);
    // Cotes : longueur, largeur et hauteur, posées sur les arêtes visibles (vue d'ensemble seulement).
    const lab = $('tr-lab');
    if (lab) {
      const out = [];
      if (!inside && P.cotes !== false) {
        const pr = (x, y, z) => { const cw = M[3] * x + M[7] * y + M[11] * z + M[15]; if (cw <= 0) return null; return [((M[0] * x + M[4] * y + M[8] * z + M[12]) / cw * 0.5 + 0.5) * cv.clientWidth, (1 - ((M[1] * x + M[5] * y + M[9] * z + M[13]) / cw * 0.5 + 0.5)) * cv.clientHeight]; };
        const hw = sc.W / 2, hd = sc.D / 2, edge = [[0, 0.02, -hd, trM(sc.Wc)], [hw, 0.02, 0, trM(sc.Dc)], [0, 0.02, hd, trM(sc.Wc)], [-hw, 0.02, 0, trM(sc.Dc)]];
        [eye[2] > 0 ? 2 : 0, eye[0] > 0 ? 1 : 3].forEach((i) => { const q = pr(edge[i][0], edge[i][1], edge[i][2]); if (q) out.push([q, edge[i][3]]); });
        const q = pr(eye[0] > 0 ? -hw : hw, sc.H / 2, eye[2] > 0 ? -hd : hd); if (q) out.push([q, 'h ' + trM(sc.Hc)]);
      }
      lab.innerHTML = out.map(([q2, t]) => `<span style="left:${q2[0].toFixed(1)}px;top:${q2[1].toFixed(1)}px">${t}</span>`).join('');
    }
  }
  const ask = () => { if (!TR_GL.raf) TR_GL.raf = requestAnimationFrame(frame); };
  // Un doigt pour tourner autour de la chambre (ou regarder autour de soi depuis la porte), deux doigts ou la molette pour s'approcher.
  const pts = new Map(); let pinch = 0;
  cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); try { cv.setPointerCapture(e.pointerId); } catch (_) {} pinch = 0; e.preventDefault(); });
  cv.addEventListener('pointermove', (e) => {
    const o = pts.get(e.pointerId); if (!o) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    const dx = e.clientX - o[0], dy = e.clientY - o[1];
    if (pts.size === 1) {
      if (cam.mode === 'porte') { cam.ly += dx * 0.005; cam.lp = Math.min(0.7, Math.max(-0.8, cam.lp + dy * 0.004)); }
      else { cam.yaw -= dx * 0.008; cam.pitch = Math.min(1.5, Math.max(0.12, cam.pitch + dy * 0.006)); }
    } else if (pts.size === 2 && cam.mode !== 'porte') { const [a, b] = [...pts.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.dist = Math.min(30, Math.max(1.5, cam.dist * pinch / dd)); pinch = dd; }
    ask();
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { if (cam.mode !== 'porte') cam.dist = Math.min(30, Math.max(1.5, cam.dist * (e.deltaY > 0 ? 1.08 : 0.93))); e.preventDefault(); ask(); }, { passive: false });
  TR_GL.ask = ask;
  // Image en haute définition de la vue en cours, pour la montrer ou l'envoyer.
  TR_GL.snap = () => new Promise((res) => { if (TR_GL.raf) { cancelAnimationFrame(TR_GL.raf); TR_GL.raf = 0; } frame(true); cv.toBlob((b) => { ask(); res(b); }, 'image/jpeg', 0.92); });
  ask();
}

/* ---------- finitions : quantités à prévoir ---------- */
function trDecoQty(roomId, p) {
  const d = trData(roomId), { W, D, H } = trWDH(d), fw = trNum(d.fen_w) || 120, fh = trNum(d.fen_h) || 120, al = trNum(d.fen_allege) || 90, n = trNum(d.fen_n) || 1;
  const murs = Math.max(0, (2 * (W + D) * H - n * fw * fh - trDW(p) * 204) / 10000), bed0 = p.items.find(trIsBed);
  const accLen = bed0 ? trWallLen(((bed0.r || 0) / 90) % 4, W, D) : 0;
  return { murs, sol: (W * D) / 10000, accent: (accLen * H) / 10000, tringle: Math.round((fw + 60) / 10) * 10, tombee: Math.round(Math.min(H - 8, al + fh + 20)), fen: n };
}
function trDecoLines(roomId, p) {
  const deco = p.deco || {}, q = trDecoQty(roomId, p), out = [];
  const mur = trDecoOf(TR_DECO_MUR, deco.mur), acc = trDecoOf(TR_DECO_ACCENT, deco.accent), sol = trDecoOf(TR_DECO_SOL, deco.sol), tis = trDecoOf(TR_DECO_TISSU, deco.tissu) || TR_DECO_TISSU[0], lin = trDecoOf(TR_DECO_TISSU, deco.linge);
  if (mur) out.push({ label: `Peinture murs ${mur[1].toLowerCase()}`, qty: 1, note: `${trFr(acc && acc[2] ? Math.max(0, q.murs - q.accent) : q.murs)} m² à peindre, 2 couches` });
  if (acc && acc[2] && q.accent) out.push({ label: `Mur de tête de lit ${acc[1].toLowerCase()}`, qty: 1, note: `${trFr(q.accent)} m², peinture ou papier peint` });
  if (sol) out.push({ label: sol[1], qty: 1, note: `${trFr(q.sol)} m² au sol, prévoir 10 % de chutes soit ${trFr(q.sol * 1.1)} m²` });
  if (deco.rideau && deco.rideau !== 'aucun') {
    out.push({ label: `Tringle à rideaux ${q.tringle} cm`, qty: q.fen, note: deco.rideau === 'double' ? 'Tringle double (voilage + occultants)' : '' });
    if (deco.rideau !== 'voilage') out.push({ label: `Rideau occultant ${tis[1].toLowerCase()}, hauteur ${q.tombee} cm`, qty: 2 * q.fen, note: '2 panneaux par fenêtre ; tissu classé non feu, classement à confirmer pour un hôtel' });
    if (deco.rideau !== 'occultant') out.push({ label: `Voilage blanc, hauteur ${q.tombee} cm`, qty: q.fen, note: 'Tissu classé non feu, classement à confirmer pour un hôtel' });
  }
  { const lum = trLum(deco), beds = p.items.filter(trIsBed), d = trData(roomId), { W, D } = trWDH(d), ppl = beds.reduce((a, b) => a + (b.t === 'lit_d' ? 2 : 1), 0), chaud = 'Blanc chaud (2700 K)';
    if (deco.lum) {
      if (lum.includes('plafonnier')) out.push({ label: 'Plafonnier LED', qty: 1, note: chaud });
      if (lum.includes('spots')) out.push({ label: 'Spot LED encastré', qty: Math.max(1, Math.round(W / 160)) * Math.max(1, Math.round(D / 160)), note: `${chaud}, sur variateur si possible ; demande un faux plafond` });
      if (lum.includes('corniche')) out.push({ label: 'Ruban LED pour corniche de plafond', qty: 1, note: `${trFr(2 * (W + D) / 100)} m de tour de pièce, ${chaud.toLowerCase()}, avec profilé et alimentation` });
      if (lum.includes('appliques') && ppl) out.push({ label: 'Applique liseuse orientable', qty: ppl, note: 'Une par personne, avec son interrupteur (demandé pour le classement)' });
      if (lum.includes('ruban') && beds.length) out.push({ label: 'Ruban LED tête de lit', qty: beds.length, note: beds.map((b) => `${trFr((trDim(b).w + 14) / 100)} m`).join(', ') + ', ' + chaud.toLowerCase() });
    } }
  if (lin) { const beds = p.items.filter(trIsBed); if (beds.length) out.push({ label: `Dessus de lit ${lin[1].toLowerCase()}`, qty: beds.length, note: beds.map((b) => `${trDim(b).w} × ${trDim(b).d} cm`).join(', ') }); }
  return out;
}

/* ---------- import d'un scan de pièce (iPhone avec LiDAR, appli OpenPlan3D : « Export Editable Plan (JSON) ») ---------- */
// Le fichier suit le format RoomPlan d'Apple : murs, portes, fenêtres et objets reconnus, en mètres, avec une matrice 4×4 par élément.
const TR_SCAN_FR = { bed: 'Lit', chair: 'Chaise', sofa: 'Canapé / fauteuil', table: 'Table', storage: 'Rangement', television: 'Télévision', toilet: 'WC', sink: 'Lavabo', bathtub: 'Baignoire / douche', refrigerator: 'Réfrigérateur', stove: 'Plaque de cuisson', oven: 'Four', dishwasher: 'Lave-vaisselle', washerDryer: 'Lave-linge', fireplace: 'Cheminée', stairs: 'Escalier' };
function trScanParse(j) {
  const num = (v) => typeof v === 'number' && isFinite(v);
  const okEl = (e) => e && Array.isArray(e.dimensions) && Array.isArray(e.transform) && e.transform.length === 16 && e.dimensions.every(num) && e.transform.every(num);
  if (!j || !Array.isArray(j.walls)) throw new Error('format');
  const walls = j.walls.filter((w) => okEl(w) && w.dimensions[0] > 0.05).map((w) => { const t = w.transform, l = Math.hypot(t[0], t[2]) || 1; return { x: t[12], y: t[13], z: t[14], dx: t[0] / l, dz: t[2] / l, len: w.dimensions[0], h: w.dimensions[1] }; });
  if (walls.length < 3) throw new Error('murs');
  // Direction dominante des murs (à 90° près), pour remettre la pièce droite.
  let sn = 0, cs = 0; walls.forEach((w) => { const a = Math.atan2(w.dz, w.dx) * 4; sn += Math.sin(a) * w.len; cs += Math.cos(a) * w.len; });
  const th = Math.atan2(sn, cs) / 4, c = Math.cos(-th), s = Math.sin(-th), rot = (x, z) => [x * c - z * s, x * s + z * c];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  walls.forEach((w) => [-1, 1].forEach((sg) => { const [rx, rz] = rot(w.x + sg * w.dx * w.len / 2, w.z + sg * w.dz * w.len / 2); x0 = Math.min(x0, rx); x1 = Math.max(x1, rx); z0 = Math.min(z0, rz); z1 = Math.max(z1, rz); }));
  const W0 = (x1 - x0) * 100, D0 = (z1 - z0) * 100, swap = D0 > W0, W = Math.round(swap ? D0 : W0), D = Math.round(swap ? W0 : D0);
  // Coordonnées du plan (cm) et cap (degrés, sens horaire) : la longueur de la pièce est toujours à l'horizontale.
  const P = (x, z) => { const [rx, rz] = rot(x, z), px = (rx - x0) * 100, py = (rz - z0) * 100; return swap ? [py, W0 - px] : [px, py]; };
  const head = (t) => { let a = (Math.atan2(t[2], t[0]) - th) * 180 / Math.PI - (swap ? 90 : 0); a = ((a % 360) + 360) % 360; return a; };
  const med = (a) => { const b = [...a].sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; };
  const H = Math.round(med(walls.map((w) => w.h)) * 100), floorY = med(walls.map((w) => w.y - w.h / 2));
  const onEdge = (e) => { const [px, py] = P(e.transform[12], e.transform[14]), ds = [py, W - px, D - py, px], dist = Math.min(...ds), wall = ds.indexOf(dist), L = wall % 2 ? D : W, width = e.dimensions[0] * 100; return { wall, dist, width, height: e.dimensions[1] * 100, pos: Math.min(L - Math.min(width, L) / 2, Math.max(Math.min(width, L) / 2, wall % 2 ? py : px)), y: e.transform[13] }; };
  const doors = [...(j.doors || []), ...(j.openings || [])].filter(okEl).map(onEdge), wins = (j.windows || []).filter(okEl).map((e) => ({ ...onEdge(e), sill: num(e.sillHeight) ? e.sillHeight * 100 : (e.transform[13] - e.dimensions[1] / 2 - floorY) * 100 }));
  const outer = doors.filter((d) => d.dist <= 40).sort((a, b) => a.dist - b.dist), door = outer[0] || [...doors].sort((a, b) => a.dist - b.dist)[0] || null;
  // Tous les murs, remis d'équerre, en cm sur le plan. Ceux qui ne sont pas sur le pourtour deviennent des murs intérieurs.
  const sg = walls.map((w) => { const a = P(w.x - w.dx * w.len / 2, w.z - w.dz * w.len / 2), b = P(w.x + w.dx * w.len / 2, w.z + w.dz * w.len / 2), v = Math.abs(a[0] - b[0]) < Math.abs(a[1] - b[1]);
    if (v) { const x = Math.round((a[0] + b[0]) / 2); return { v, x0: x, x1: x, y0: Math.round(Math.min(a[1], b[1])), y1: Math.round(Math.max(a[1], b[1])) }; }
    const y = Math.round((a[1] + b[1]) / 2); return { v, y0: y, y1: y, x0: Math.round(Math.min(a[0], b[0])), x1: Math.round(Math.max(a[0], b[0])) }; });
  // Portes et ouvertures : leur place et leur sens sur le plan. Pour le remplissage, elles ferment le mur comme une cloison.
  const inner = [...(j.doors || []).filter(okEl).map((e) => ({ e, k: 'p' })), ...(j.openings || []).filter(okEl).map((e) => ({ e, k: 'o' }))].map(({ e, k }) => { const [px, py] = P(e.transform[12], e.transform[14]); return { px, py, w: e.dimensions[0] * 100, k, v: Math.round(head(e.transform) / 90) % 2 === 1 }; });
  const shut = inner.map((o) => o.v ? { v: true, x0: Math.round(o.px), x1: Math.round(o.px), y0: Math.round(o.py - o.w / 2), y1: Math.round(o.py + o.w / 2) } : { v: false, y0: Math.round(o.py), y1: Math.round(o.py), x0: Math.round(o.px - o.w / 2), x1: Math.round(o.px + o.w / 2) });
  const border = (g) => g.v ? (g.x0 < 15 || g.x0 > W - 15) : (g.y0 < 15 || g.y0 > D - 15);
  // Grille de 5 cm : on remplit depuis l'extérieur ; ce qu'on atteint dans le rectangle n'est pas la chambre (pièce en L, recoin).
  const Q = 5, PD = 5, nx = Math.ceil(W / Q) + 2 * PD + 1, ny = Math.ceil(D / Q) + 2 * PD + 1, wallG = new Uint8Array(nx * ny), ci = (x) => Math.floor(x / Q) + PD, cx = (i) => (i - PD) * Q;
  [...sg, ...shut].forEach((g) => { const ext = 12; if (g.v) { const i = ci(g.x0); for (let y = g.y0 - ext; y <= g.y1 + ext; y += Q / 2) { const j = ci(y); for (let k = -1; k <= 1; k++) if (i + k >= 0 && i + k < nx && j >= 0 && j < ny) wallG[j * nx + i + k] = 1; } }
    else { const j = ci(g.y0); for (let x = g.x0 - ext; x <= g.x1 + ext; x += Q / 2) { const i = ci(x); for (let k = -1; k <= 1; k++) if (i >= 0 && i < nx && j + k >= 0 && j + k < ny) wallG[(j + k) * nx + i] = 1; } } });
  const fill = (i0, j0) => { const seen = new Uint8Array(nx * ny), st = [j0 * nx + i0]; if (wallG[st[0]]) return seen; seen[st[0]] = 1;
    while (st.length) { const c = st.pop(), i = c % nx, j = (c - i) / nx; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) return; const n = jj * nx + ii; if (!seen[n] && !wallG[n]) { seen[n] = 1; st.push(n); } }); }
    return seen; };
  const ext = fill(0, 0), lx = [0, W, ...sg.filter((g) => g.v).map((g) => g.x0)], ly = [0, D, ...sg.filter((g) => !g.v).map((g) => g.y0)];
  const snap = (v, ls) => { const n = ls.reduce((b, l) => (Math.abs(l - v) < Math.abs(b - v) ? l : b), Infinity); return Math.abs(n - v) <= 14 ? n : Math.round(v); };
  // Des cases en rectangles : on étend chaque case vers la droite, puis vers le bas, tant que tout est hors chambre.
  const rects = (mask) => { const used = new Uint8Array(nx * ny), out = [];
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { if (!mask[j * nx + i] || used[j * nx + i]) continue; let i1 = i; while (i1 + 1 < nx - 1 && mask[j * nx + i1 + 1] && !used[j * nx + i1 + 1]) i1++;
      let j1 = j; const rowOk = (jj) => { for (let k = i; k <= i1; k++) if (!mask[jj * nx + k] || used[jj * nx + k]) return false; return true; }; while (j1 + 1 < ny - 1 && rowOk(j1 + 1)) j1++;
      for (let jj = j; jj <= j1; jj++) for (let k = i; k <= i1; k++) used[jj * nx + k] = 1; out.push({ x0: cx(i), y0: cx(j), x1: cx(i1 + 1), y1: cx(j1 + 1) }); }
    return out; };
  const inBox = new Uint8Array(nx * ny); for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const x = cx(i) + Q / 2, y = cx(j) + Q / 2; if (x > 0 && x < W && y > 0 && y < D && ext[j * nx + i]) inBox[j * nx + i] = 1; }
  let hors = rects(inBox).map((r) => ({ x0: Math.max(0, snap(r.x0, lx)), y0: Math.max(0, snap(r.y0, ly)), x1: Math.min(W, snap(r.x1, lx)), y1: Math.min(D, snap(r.y1, ly)) })).filter((r) => r.x1 - r.x0 >= 30 && r.y1 - r.y0 >= 30);
  if (hors.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0) > 0.5 * W * D) hors = [];
  // Portes et ouvertures posées sur un mur intérieur : le mur est coupé, la porte garde sa place.
  const cl = [], placed = new Set();
  sg.filter((g) => !border(g) && Math.max(g.x1 - g.x0, g.y1 - g.y0) >= 20).forEach((g) => {
    const on = inner.filter((o) => g.v ? Math.abs(o.px - g.x0) < 15 && o.py > g.y0 && o.py < g.y1 : Math.abs(o.py - g.y0) < 15 && o.px > g.x0 && o.px < g.x1).map((o) => { placed.add(o); const c = g.v ? o.py : o.px; return { a: Math.round(c - o.w / 2), b: Math.round(c + o.w / 2), k: o.k }; }).sort((p1, p2) => p1.a - p2.a);
    let at = g.v ? g.y0 : g.x0; const end = g.v ? g.y1 : g.x1, put = (a, b, k) => { if (b - a < 3) return; cl.push(g.v ? { x0: g.x0, y0: a, x1: g.x0, y1: b, ...(k ? { k } : {}) } : { x0: a, y0: g.y0, x1: b, y1: g.y0, ...(k ? { k } : {}) }); };
    on.forEach((o) => { const a = Math.max(at, o.a), b = Math.min(end, o.b); put(at, a); put(a, b, o.k); at = b; }); put(at, end);
  });
  // Une porte entre deux bouts de mur (le scan a coupé le mur à la porte) : elle devient une porte intérieure à part entière.
  inner.forEach((o, n) => { if (placed.has(o)) return; const g = shut[n]; if (g.v ? (g.x0 < 40 || g.x0 > W - 40) : (g.y0 < 40 || g.y0 > D - 40)) return; cl.push({ x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, k: o.k }); });
  // Salle de bain scannée avec la chambre : on la reconnaît à ses sanitaires (ou à l'étiquette « bathroom » du scan),
  // puis on cherche les cloisons qui la séparent de la chambre. Elle devient un bloc dans un coin du plan.
  const SAN = ['toilet', 'sink', 'bathtub'], sanPts = (j.objects || []).filter((o) => okEl(o) && SAN.includes(Object.keys(o.category || {})[0])).map((o) => P(o.transform[12], o.transform[14]));
  (j.sections || []).forEach((sx) => { if (sx && /bath/i.test(String(sx.label || '')) && Array.isArray(sx.center) && sx.center.length >= 3 && sx.center.every(num)) sanPts.push(P(sx.center[0], sx.center[2])); });
  let sdb = null;
  // D'abord la vraie pièce où sont les sanitaires (entourée de murs), où qu'elle soit ; sinon, un bloc dans un coin.
  if (sanPts.length && cl.length) {
    const [qx, qy] = sanPts[0], reg = fill(ci(Math.max(1, Math.min(W - 1, qx))), ci(Math.max(1, Math.min(D - 1, qy))));
    let x0r = Infinity, y0r = Infinity, x1r = -Infinity, y1r = -Infinity, n = 0;
    for (let jj = 1; jj < ny - 1; jj++) for (let ii = 1; ii < nx - 1; ii++) if (reg[jj * nx + ii] && !ext[jj * nx + ii]) { n++; x0r = Math.min(x0r, cx(ii)); x1r = Math.max(x1r, cx(ii + 1)); y0r = Math.min(y0r, cx(jj)); y1r = Math.max(y1r, cx(jj + 1)); }
    const area = n * Q * Q;
    if (n && !reg[0] && area >= 10000 && area < 0.45 * W * D) {
      const rect = { x0: Math.max(0, snap(x0r, lx)), y0: Math.max(0, snap(y0r, ly)), x1: Math.min(W, snap(x1r, lx)), y1: Math.min(D, snap(y1r, ly)) };
      sdb = { c: 'z', len: rect.x1 - rect.x0, wid: rect.y1 - rect.y0, rect, inside: 0 };
    }
  }
  if (sanPts.length && !sdb) {
    const bx = sanPts.reduce((a, q) => a + q[0], 0) / sanPts.length, by = sanPts.reduce((a, q) => a + q[1], 0) / sanPts.length, west = bx < W / 2, north = by < D / 2;
    const segs = walls.map((w) => { const a = P(w.x - w.dx * w.len / 2, w.z - w.dz * w.len / 2), b = P(w.x + w.dx * w.len / 2, w.z + w.dz * w.len / 2); return { a, b }; });
    // Cloison verticale (sur le plan) la plus proche des sanitaires, du côté opposé au coin ; puis la même chose à l'horizontale.
    const vert = segs.filter((g) => Math.abs(g.a[0] - g.b[0]) < 20).map((g) => ({ v: (g.a[0] + g.b[0]) / 2, lo: Math.min(g.a[1], g.b[1]), hi: Math.max(g.a[1], g.b[1]) })).filter((g) => g.v > 30 && g.v < W - 30 && g.lo - 30 < by && g.hi + 30 > by && (west ? g.v > bx : g.v < bx)).sort((p1, p2) => Math.abs(p1.v - bx) - Math.abs(p2.v - bx))[0];
    const horiz = segs.filter((g) => Math.abs(g.a[1] - g.b[1]) < 20).map((g) => ({ v: (g.a[1] + g.b[1]) / 2, lo: Math.min(g.a[0], g.b[0]), hi: Math.max(g.a[0], g.b[0]) })).filter((g) => g.v > 30 && g.v < D - 30 && g.lo - 30 < bx && g.hi + 30 > bx && (north ? g.v > by : g.v < by)).sort((p1, p2) => Math.abs(p1.v - by) - Math.abs(p2.v - by))[0];
    if (vert || horiz) {
      const a = Math.round(vert ? (west ? vert.v : W - vert.v) : W), b = Math.round(horiz ? (north ? horiz.v : D - horiz.v) : D);
      const x0s = west ? 0 : W - a, y0s = north ? 0 : D - b;
      sdb = { c: (north ? 'n' : 's') + (west ? 'o' : 'e'), len: a, wid: b, rect: { x0: x0s, y0: y0s, x1: x0s + a, y1: y0s + b }, inside: 0 };
    }
  }
  const inSdb = (px, py) => !!sdb && px >= sdb.rect.x0 - 5 && px <= sdb.rect.x1 + 5 && py >= sdb.rect.y0 - 5 && py <= sdb.rect.y1 + 5;
  const counts = {}, items = [];
  (j.objects || []).filter(okEl).forEach((o) => {
    const cat = Object.keys(o.category || {})[0] || 'autre'; counts[cat] = (counts[cat] || 0) + 1;
    let w = Math.round(o.dimensions[0] * 100), h = Math.round(o.dimensions[1] * 100), dp = Math.round(o.dimensions[2] * 100), r = (Math.round(head(o.transform) / 90) * 90) % 360;
    const [px, py] = P(o.transform[12], o.transform[14]);
    if (w < 5 || dp < 2) return;
    if (inSdb(px, py)) {
      sdb.inside++;
      // WC, lavabo et baignoire repérés dans la salle de bain : gardés, contre le mur le plus proche.
      const st = { toilet: 'wc', sink: 'lavabo', bathtub: 'baignoire' }[cat]; if (!st) return;
      let ww = w, dd = dp; if (st === 'baignoire' && dd > ww) { const k = ww; ww = dd; dd = k; }
      const R = sdb.rect, ds = [py - R.y0, R.x1 - px, R.y1 - py, px - R.x0], wall = ds.indexOf(Math.min(...ds));
      const it = trAtWall(st, wall, 0, R.x1 - R.x0, R.y1 - R.y0, { w: Math.max(30, ww), d: Math.max(30, dd), scan: 1 }), rc0 = trRect({ ...it, x: 0, y: 0 }), hw = (rc0.x1 - rc0.x0) / 2, hh = (rc0.y1 - rc0.y0) / 2;
      it.x = Math.round(Math.min(R.x1 - hw, Math.max(R.x0 + hw, wall % 2 ? R.x0 + (wall === 1 ? R.x1 - R.x0 - hw : hw) : px)));
      it.y = Math.round(Math.min(R.y1 - hh, Math.max(R.y0 + hh, wall % 2 ? py : R.y0 + (wall === 2 ? R.y1 - R.y0 - hh : hh))));
      items.push(it); return;
    }
    let it;
    if (cat === 'television') {
      const ds = [py, W - px, D - py, px], wall = ds.indexOf(Math.min(...ds)), L = wall % 2 ? D : W, ww = Math.max(w, dp);
      it = trAtWall('tv', wall, Math.min(L - ww / 2, Math.max(ww / 2, wall % 2 ? py : px)), W, D, { w: ww });
    } else {
      let t = 'meuble', n = TR_SCAN_FR[cat] || 'Meuble';
      if (cat === 'bed') { if (dp < w) { const k = w; w = dp; dp = k; r = (r + 90) % 360; } t = w >= 120 ? 'lit_d' : 'lit_s'; n = null; }
      else if (cat === 'chair') { t = 'chaise'; n = null; }
      else if (cat === 'sofa') { t = 'fauteuil'; n = w > 110 ? 'Canapé' : null; }
      else if (cat === 'table') { t = 'bureau'; n = 'Table'; }
      else if (cat === 'storage') { if (h >= 120) { t = 'armoire'; n = null; } else if (Math.max(w, dp) <= 65) { t = 'chevet'; n = null; } else n = 'Commode'; }
      it = { id: trPid(), t, r, x: px, y: py, w, d: dp, h };
      if (n) it.n = n;
      // Dos (ou tête de lit) tourné vers le mur le plus proche dans son axe.
      const back = (rr) => { const [bx, by] = trRot(0, -1, rr); return bx > 0 ? W - px : bx < 0 ? px : by > 0 ? D - py : py; };
      if (back((r + 180) % 360) < back(r)) it.r = (r + 180) % 360;
      const rc = trRect(it), hw = (rc.x1 - rc.x0) / 2, hh = (rc.y1 - rc.y0) / 2;
      it.x = Math.round(2 * hw >= W ? W / 2 : Math.min(W - hw, Math.max(hw, px))); it.y = Math.round(2 * hh >= D ? D / 2 : Math.min(D - hh, Math.max(hh, py)));
    }
    it.scan = 1; items.push(it);
  });
  // Fenêtre principale : la plus large du pourtour, en préférant celles de la chambre à celle de la salle de bain.
  const wpt = (w) => (w.wall === 0 ? [w.pos, 0] : w.wall === 1 ? [W, w.pos] : w.wall === 2 ? [w.pos, D] : [0, w.pos]);
  const owins = wins.filter((w) => w.dist <= 60).sort((a, b) => (inSdb(...wpt(a)) - inSdb(...wpt(b))) || (b.width - a.width)), win = owins[0] || null;
  const fen2 = owins.slice(1).map((w) => ({ wall: w.wall, pos: Math.round(w.pos), w: Math.round(w.width) }));
  return { W, D, H, sdb, cl, hors, fen2, door: door ? { wall: door.wall, pos: Math.round(door.pos), w: Math.max(60, Math.min(160, Math.round(door.width / 10) * 10)) } : null, win: win ? { wall: win.wall, pos: Math.round(win.pos) } : null,
    fen: win ? { w: Math.round(win.width), h: Math.round(win.height), allege: Math.max(0, Math.round(win.sill)), n: owins.length } : null,
    items, counts, nWalls: walls.length, nDoors: doors.length, nRooms: Array.isArray(j.sections) ? j.sections.length : 0 };
}
function trScanSheet(roomId) {
  S.trCtx = roomId;
  const sc = S.trScan, r = trRoomGet(roomId); if (!sc || !r) { closeSheet(); return; }
  const lst = Object.entries(sc.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} × ${(TR_SCAN_FR[k] || k).toLowerCase()}`);
  openSheet('trscan', `<div class="row between"><h2>Scan lu · ${esc(trPlace(r))}</h2><button class="btn small" data-a="trRoom" data-id="${esc(roomId)}">Annuler</button></div>
    <div class="card"><h3>📏 ${trM(sc.W)} × ${trM(sc.D)} · hauteur ${trM(sc.H)}</h3>
      <p class="muted">${sc.nWalls} murs, ${sc.nDoors} porte${sc.nDoors > 1 ? 's' : ''}${sc.fen ? `, ${sc.fen.n} fenêtre${sc.fen.n > 1 ? 's' : ''} (la plus grande : ${sc.fen.w} × ${sc.fen.h} cm, à ${sc.fen.allege} cm du sol)` : ', pas de fenêtre vue'}.</p>
      ${lst.length ? `<p><b>Reconnu :</b> ${esc(lst.join(', '))}.</p>` : '<p class="muted">Aucun meuble reconnu dans ce scan.</p>'}
      ${(sc.cl || []).length || (sc.hors || []).length ? `<p><b>Forme réelle gardée :</b> ${sc.cl.filter((c) => !c.k).length} mur${sc.cl.filter((c) => !c.k).length > 1 ? 's' : ''} intérieur${sc.cl.filter((c) => !c.k).length > 1 ? 's' : ''}, ${sc.cl.filter((c) => c.k).length} porte${sc.cl.filter((c) => c.k).length > 1 ? 's' : ''} intérieure${sc.cl.filter((c) => c.k).length > 1 ? 's' : ''}${sc.hors.length ? `, ${trFr(sc.hors.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0) / 10000)} m² hors de la chambre (non comptés)` : ''}. Tu pourras tout corriger dans le plan.</p>` : ''}
      ${sc.sdb && sc.sdb.c === 'z' ? `<p><b>Salle de bain repérée :</b> ${trM(sc.sdb.len)} × ${trM(sc.sdb.wid)}, à sa vraie place.</p>` : ''}
      ${sc.sdb && sc.sdb.c !== 'z' ? `<p><b>Salle de bain repérée</b> dans un coin : ${trM(sc.sdb.len)} × ${trM(sc.sdb.wid)}, soit ${trFr(sc.sdb.len * sc.sdb.wid / 10000)} m² compris dans la surface.</p>` : ''}
      ${(sc.nWalls > 4 || sc.nRooms > 1) && !(sc.cl || []).length ? `<p class="banner sm c-slate">Le scan compte plus de 4 murs : l’ensemble est ramené au rectangle qui l’entoure${sc.sdb ? ', salle de bain comprise' : ''}. S’il reste un recoin, la surface réelle est un peu plus petite ; corrige-la dans la fiche.</p>` : ''}</div>
    <p class="muted">Les mesures de la fiche, la fenêtre et le plan de cette chambre seront remplacés par le scan. Les photos, l’état et les notes ne bougent pas.</p>
    <button class="btn big pri" data-a="trScanApply" data-id="${esc(roomId)}">Utiliser ce scan</button>`);
}

/* ---------- l'écran « Plan et 3D » d'une chambre ---------- */
function trDecoCard(roomId) {
  const P = S.trP, deco = P.p.deco || {}, can = trPlanCan(), q = trDecoQty(roomId, P.p), lines = trDecoLines(roomId, P.p);
  const sw = (key, list, cur) => `<div class="tr-sws">${list.map(([k, l, c]) => `<button class="tr-sw" ${can ? '' : 'disabled'} data-a="trDeco" data-k="${key}" data-v="${k}" aria-pressed="${(cur || '') === k}">${c ? `<i style="background:${trCss(c)}"></i>` : ''}${l}</button>`).join('')}</div>`;
  return `<div class="card"><h3>🎨 Finitions du projet</h3><p class="muted">Choisis, puis regarde le résultat en vue 3D. Rien n’est acheté tant que ce n’est pas dans la liste.</p>
    <p class="tr-cap">Murs · ${trFr(q.murs)} m²</p>${sw('mur', TR_DECO_MUR, deco.mur)}
    <p class="tr-cap">Mur de la tête de lit${q.accent ? ` · ${trFr(q.accent)} m²` : ''}</p>${sw('accent', TR_DECO_ACCENT, deco.accent)}
    <p class="tr-cap">Sol · ${trFr(q.sol)} m²</p>${sw('sol', TR_DECO_SOL, deco.sol)}
    <p class="tr-cap">Rideaux · fenêtre de ${trNum(trData(roomId).fen_w) || 120} cm</p>${sw('rideau', TR_DECO_RIDEAU, deco.rideau || 'aucun')}
    ${deco.rideau && deco.rideau !== 'aucun' && deco.rideau !== 'voilage' ? `<p class="tr-cap">Tissu des rideaux</p>${sw('tissu', TR_DECO_TISSU, deco.tissu || 'lin')}` : ''}
    <p class="tr-cap">Dessus de lit</p>${sw('linge', TR_DECO_TISSU, deco.linge)}
    <p class="tr-cap">Éclairage · à voir en 🌙 Soir, depuis la porte</p><div class="tr-sws">${TR_DECO_LUM.map(([k, l]) => `<button class="tr-sw" ${can ? '' : 'disabled'} data-a="trDecoLum" data-v="${k}" aria-pressed="${trLum(deco).includes(k)}">${l}</button>`).join('')}</div>
    ${lines.length ? `<p class="tr-cap">À prévoir</p><ul class="tr-gaps">${lines.map((l) => `<li>${l.qty > 1 ? l.qty + ' × ' : ''}${esc(l.label)}${l.note ? ` <span class="muted sm">· ${esc(l.note)}</span>` : ''}</li>`).join('')}</ul>${trCan() && !trIsTest(roomId) ? '<button class="btn small soft" data-a="trDecoList">＋ Mettre ces finitions dans la liste</button>' : ''}` : ''}</div>`;
}
function trPlanSheet(roomId, keep) {
  S.trCtx = roomId;
  const r = trRoomGet(roomId), d = trData(roomId); if (!r || !S.tr || !trHasPlan(d)) { closeSheet(); return; }
  const { W, D } = trWDH(d);
  if (!keep || !S.trP || S.trP.rid !== roomId) S.trP = { rid: roomId, view: (S.trP && S.trP.rid === roomId && S.trP.view) || 'plan', sel: null, p: trPlanOf(roomId), vid: null, cam: null, soir: !!(S.trP && S.trP.rid === roomId && S.trP.soir), lumi: (S.trP && S.trP.lumi) || 100 };
  const P = S.trP, can = trPlanCan(), hasSdb = trNum(d.sdb_len) && trNum(d.sdb_wid), fs = Math.max(11, Math.round(Math.max(W, D) / 26)), pad = fs * 2.2;
  const cfgs = TR_CFG.map(([k, l, beds]) => { const a = trAuto(roomId, beds, P.p); return { k, l, a, ok: a.bedsOk && a.surfOk }; });
  const bank = S.tr.items.filter((i) => i.etat !== 'a_jeter' && i.w_cm && i.d_cm);
  trGlStop(); if (!S.trCat) trIkLoad();
  const ikN = P.p.items.filter((i) => i.ik).length;
  openSheet('trplan:' + roomId, `<div class="row between"><h2>${esc(trPlace(r))} · ${trM(W)} × ${trM(D)}</h2><button class="btn small" data-a="trRoom" data-id="${esc(roomId)}">‹ Fiche</button></div>
    <div id="tr-vers">${trVersHtml()}</div>
    <div class="segc" role="group"><button data-a="trPlanView" data-k="plan" aria-pressed="${P.view === 'plan'}">Plan</button><button data-a="trPlanView" data-k="3d" aria-pressed="${P.view === '3d'}">Vue 3D</button></div>
    ${P.view === 'plan' && trCan() ? `<button class="btn small ${P.edit ? 'pri' : 'soft'}" style="margin-bottom:8px" data-a="trEdit">${P.edit ? '✓ Terminer les corrections' : '✏️ Corriger murs, cloisons et fenêtres'}</button>` : ''}
    <div class="tr-stage${P.big && P.view === '3d' ? ' big' : ''}">${P.view === 'plan'
      ? `<svg id="tr-svg" viewBox="${-pad} ${-pad} ${W + pad * 1.4} ${D + pad * 1.4}" preserveAspectRatio="xMidYMid meet"><g id="tr-plan-g"></g></svg>`
      : `<div class="tr-3d"><canvas id="tr-gl"></canvas><div id="tr-lab"></div><div class="tr-tools"><button data-a="trFull" aria-label="Plein écran">⤢</button><button data-a="trSnap" aria-label="Enregistrer l’image">📸</button></div>
        <div class="tr-acts">${can ? `${TR_NIVEAUX.map((nv) => `<button data-a="trNiveauGo" data-k="${nv.k}" aria-pressed="${P.p.niv === nv.k}">${nv.e} ${nv.l}</button>`).join('')}<button data-a="trMove" aria-pressed="${!!P.move}">${P.move ? '✋ Déplacer : oui' : '🔒 Déplacer : non'}</button>` : ''}</div>
        <div id="tr-plan-bar" class="tr-selbar"></div></div>`}</div>
    ${P.view === '3d' ? `<div class="segc" role="group" aria-label="Point de vue">${[['orbit', 'Vue d’ensemble'], ['porte', 'Depuis la porte'], ['dessus', 'Du dessus']].map(([k, l]) => `<button data-a="trCam" data-k="${k}" aria-pressed="${((P.cam && P.cam.mode) || 'orbit') === k}">${l}</button>`).join('')}</div>
    <div class="segc" role="group" aria-label="Ambiance">${[['', '☀️ Jour'], ['1', '🌙 Soir']].map(([k, l]) => `<button data-a="trAmb" data-k="${k}" aria-pressed="${!!P.soir === !!k}">${l}</button>`).join('')}</div>
    <label class="tr-lumi"><span>💡 Puissance des lumières</span><input type="range" min="15" max="130" step="5" value="${P.lumi || 100}" data-input="trLumi" aria-label="Puissance des lumières"></label>
    <p class="muted sm">${can ? 'Les trois boutons sur l’image : une nouvelle proposition à chaque appui. « Déplacer : oui » pour toucher, glisser, tourner ou enlever un meuble. ' : ''}Un doigt pour tourner la vue, deux doigts pour s’approcher. ⤢ plein écran, 📸 garder l’image.</p>` : ''}
    ${P.view === 'plan' ? '<div id="tr-plan-bar"></div>' : ''}
    ${P.view === 'plan' && P.edit ? `<div class="card"><h3>✏️ Corriger le plan</h3><p class="muted sm">Ces corrections changent la chambre elle-même : toutes les versions en tiennent compte.</p>
      <p class="tr-cap">Mesures de la chambre</p><div class="row"><label class="tr-num"><span>Longueur</span><input type="number" inputmode="numeric" min="100" value="${W}" data-change="trEdNum" data-k="len"> cm</label><label class="tr-num"><span>Largeur</span><input type="number" inputmode="numeric" min="100" value="${D}" data-change="trEdNum" data-k="wid"> cm</label></div>
      ${hasSdb && P.p.sdb.c && P.p.sdb.c !== 'z' ? `<p class="tr-cap">Salle de bain</p><div class="row"><label class="tr-num"><span>Longueur</span><input type="number" inputmode="numeric" min="60" value="${trNum(d.sdb_len)}" data-change="trEdNum" data-k="sdb_len"> cm</label><label class="tr-num"><span>Largeur</span><input type="number" inputmode="numeric" min="60" value="${trNum(d.sdb_wid)}" data-change="trEdNum" data-k="sdb_wid"> cm</label></div>` : ''}
      <div class="tr-eq"><button data-a="trClAdd">＋ Mur intérieur</button><button data-a="trHzAdd">＋ Zone hors chambre</button><button data-a="trFenAdd">＋ Fenêtre</button></div>
      <p class="muted sm">Une zone hors chambre sert pour une pièce en L ou un recoin : rien ne s’y pose et elle ne compte pas dans la surface.</p></div>` : ''}
    <div class="card"><h3>Est-ce que ça tient ?</h3><div id="tr-plan-chk"></div></div>
    <div class="card"><h3>🏨 Trois niveaux d’aménagement</h3><p class="muted">Une proposition complète par budget : meubles, finitions et éclairage. Règles tenues : rien devant la fenêtre ni dans l’ouverture de la porte, 50 cm au moins autour des lits (90 cm sur un côté quand la pièce le permet), surface 3★.</p>
      <div class="group flat">${TR_NIVEAUX.map((nv) => { const a = trNiveau(roomId, nv, P.p), nb = a.p.items.filter(trIsBed).length; return `<button class="prow" ${can ? '' : 'disabled'} data-a="trNiveauGo" data-k="${nv.k}"><span class="pr-t"><b>${nv.e} ${nv.l}${P.p.niv === nv.k ? ` · en place (variante ${(P.p.nivN || 0) + 1}) · touche encore pour une autre` : ''}</b><span class="muted sm">${esc(nv.txt)}</span><span class="muted sm">${!a.bedsOk ? '⚠️ Les lits de la fiche ne rentrent pas tous. ' : ''}${a.people} couchage${a.people > 1 ? 's' : ''}${nv.lvl === 2 && nb ? (a.big ? ' · lit de 160' : ' · lit de 160 impossible ici') : ''} · ${a.pass90 ? 'passage de 90 cm ✓' : 'passage de 50 cm seulement'}${a.miss.length ? ' · pas de place pour : ' + a.miss.join(', ').toLowerCase() : ''}</span></span><span class="chev">›</span></button>`; }).join('')}</div></div>
    <div class="card"><h3>💡 Dispositions proposées</h3><p class="muted">Calculées avec la place de la porte et de la fenêtre. Touche une proposition pour la voir${can ? ' ; elle remplace les meubles du plan' : ''}.</p>
      <div class="group flat">${cfgs.map((c) => `<button class="prow" ${can ? '' : 'disabled'} data-a="trPlanCfg" data-k="${c.k}"><span class="pr-t"><b>${c.l}</b><span class="muted sm">${!c.a.bedsOk ? 'Les lits ne rentrent pas' : (!c.a.surfOk ? `Surface trop petite en 3★ (${trFr(c.a.surf)} m² pour ${trFr(c.a.need)})` : (c.a.miss.length ? 'Pas de place pour : ' + c.a.miss.join(', ').toLowerCase() : 'Tout rentre, avec bureau, armoire et télé'))}</span></span><span class="pill ${c.ok ? (c.a.miss.length ? 'p-amber' : 'p-green') : 'p-red'}">${c.ok ? (c.a.miss.length ? 'Juste' : 'Oui') : 'Non'}</span></button>`).join('')}</div></div>
    ${can ? `<div class="card"><h3>Ajouter un meuble</h3><div class="tr-eq">${Object.entries(TR_FURN).filter(([k, f]) => k !== 'meuble' && !f.san).map(([k, f]) => `<button data-a="trPlanAdd" data-k="${k}">＋ ${f.l}</button>`).join('')}</div>
      <button class="btn soft" style="width:100%;margin-top:10px" data-a="trIkPick">🛋️ Choisir dans le catalogue IKEA, avec photos</button>
      ${bank.length ? `<div class="form"><label>Ou un meuble qu’on a déjà<select data-change="trPlanBank">${opt('', '', 'Choisir dans nos meubles…')}${bank.map((i) => opt(i.id, '', `${i.label || trType(i.type)[1]} · ${i.w_cm} × ${i.d_cm} cm`)).join('')}</select></label></div>` : ''}</div>` : ''}
    ${(() => { if (!can) return ''; const dw = trDW(P.p), L = P.p.door.wall % 2 ? D : W, sdbR = trSdbRect(d, P.p, W, D), sd = sdbR && !sdbR.z && trSdbDoor(sdbR, P.p, W, D), sdw = trNum(P.p.sdb.dwid) || 70;
      const f2 = trFen2(d), fenH = trCan() ? `<p class="tr-cap">Fenêtres</p><p class="muted sm">Fenêtre principale : ${trNum(d.fen_w) || 120} cm${f2.length ? '' : ' (seule)'}.${trNum(d.fen_n) > f2.length + 1 ? ` Le scan en a compté ${trNum(d.fen_n)}.` : ''}</p>
        ${f2.map((f, i) => `<div class="row tr-fen"><span>Fenêtre ${i + 2}</span>${[60, 80, 100, 120, 140].map((k) => `<button class="btn small ${(trNum(f.w) || 120) === k ? 'pri' : ''}" data-a="trFenW" data-i="${i}" data-k="${k}">${k}</button>`).join('')}<button class="btn small ghost bad-t" data-a="trFenDel" data-i="${i}" aria-label="Enlever">✕</button></div>`).join('')}
        <button class="btn small soft" data-a="trFenAdd">＋ Ajouter une fenêtre</button><p class="muted sm">Glisse les fenêtres (bleues) sur le plan pour les placer.</p>` : '';
      return `<div class="card"><h3>🚪 Portes et fenêtres</h3><p class="muted sm">Si le scan a mis une porte au mauvais endroit, corrige-la ici (ou glisse-la sur le plan).</p>
      <p class="tr-cap">Porte de la pièce · mur</p><div class="tr-eq">${[[0, '⬆ En haut'], [1, '➡ À droite'], [2, '⬇ En bas'], [3, '⬅ À gauche']].map(([k, l]) => `<button data-a="trDoorWall" data-k="${k}" aria-pressed="${P.p.door.wall === k}">${l}</button>`).join('')}</div>
      <p class="tr-cap">Largeur</p><div class="tr-eq">${[70, 80, 90, 100, 120].map((k) => `<button data-a="trDoorWid" data-k="${k}" aria-pressed="${dw === k}">${k} cm</button>`).join('')}</div>
      <label class="tr-lumi"><span>Position</span><input type="range" min="${Math.round(dw / 2)}" max="${Math.round(L - dw / 2)}" step="5" value="${Math.round(P.p.door.pos)}" data-change="trDoorPos" aria-label="Position de la porte"></label>
      ${sd ? `<p class="tr-cap">Porte de la salle de bain</p><div class="tr-eq">${[60, 70, 80, 90].map((k) => `<button data-a="trSdbDWid" data-k="${k}" aria-pressed="${sdw === k}">${k} cm</button>`).join('')}<button data-a="trSdbDoorSwap">⟳ Sur l’autre cloison</button></div>
      <label class="tr-lumi"><span>Position</span><input type="range" min="${Math.round((sd.side === 'v' ? sdbR.y0 : sdbR.x0) + sdw / 2 + 2)}" max="${Math.round((sd.side === 'v' ? sdbR.y1 : sdbR.x1) - sdw / 2 - 2)}" step="5" value="${Math.round((sd.a + sd.b) / 2)}" data-change="trSdbDPos" aria-label="Position de la porte de la salle de bain"></label>` : ''}${fenH}</div>`; })()}
    ${hasSdb ? `<div class="card"><h3>🚿 Salle de bain</h3><p class="muted">Où est-elle par rapport aux mesures de la chambre ?</p>
      <div class="segc five" role="group">${[['', 'À part'], ['no', '↖ coin'], ['ne', '↗ coin'], ['so', '↙ coin'], ['se', '↘ coin'], ...(d.sdbz ? [['z', '📐 Scan']] : [])].map(([k, l]) => `<button ${can ? '' : 'disabled'} data-a="trPlanSdb" data-k="${k}" aria-pressed="${(P.p.sdb.c || '') === k}">${l}</button>`).join('')}</div>
      ${P.p.sdb.c && P.p.sdb.c !== 'z' && can ? '<button class="btn small" data-a="trPlanSdbRot">⟳ Tourner la salle de bain</button>' : ''}
      ${P.p.sdb.c ? (() => { const san = P.p.items.filter(trIsSan); return `<p class="tr-cap">Équipements</p><p class="muted sm">${san.length ? san.map(trItName).join(', ') : 'Rien encore : choisis une formule ci-dessous.'}</p>
      ${can ? `<div class="tr-eq">${[['bain', '🛁 Baignoire'], ['douche', '🚿 Douche'], ['italienne', '🚿 Douche à l’italienne']].map(([k, l]) => `<button data-a="trSdbStyle" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="tr-eq">${['wc', 'lavabo', 'baignoire', 'douche'].map((k) => `<button data-a="trPlanAdd" data-k="${k}">＋ ${TR_FURN[k].l}</button>`).join('')}</div>` : ''}`; })() : ''}
      <p class="muted sm">${P.p.sdb.c ? 'Dans un coin : elle est comprise dans la longueur × largeur de la chambre.' : 'À part : sa surface s’ajoute à celle de la chambre.'}</p></div>` : ''}
    ${ikN && trCan() && !trIsTest(roomId) ? `<div class="card"><h3>🛒 Meubles IKEA de ce plan · ${ikN}</h3><p class="muted">Références, prix relevés et liens passent dans la liste d’achats de cette chambre.</p><button class="btn soft" data-a="trIkPlanList">Mettre ces meubles dans la liste</button></div>` : ''}
    ${trDecoCard(roomId)}
    ${can && P.p.items.length ? '<button class="btn ghost bad-t" data-a="trPlanClear">Vider le plan</button>' : ''}`, 'trfull');
  if (P.view === 'plan') { trPlanBind(); trPlanDraw(); } else { trPlanBar(); trGlStart(); }
}
Object.assign(A, {
  trPlan(d) { trPlanSheet(d.id); },
  trVer(d) { const P = S.trP; if (!P) return; const v = d.id ? trVGet(d.id) : null; if (d.id && !v) return; P.vid = v ? v.id : null; P.p = v ? trPlanOf(P.rid, v.plan) : trPlanOf(P.rid); P.sel = null; trPlanSheet(P.rid, true); },
  trVerNew() { const P = S.trP; if (!P || !trPlanCan()) return; const me = trPrenom(S.me.label), nm = (prompt('Nom de ta version', 'Version ' + trDe(me)) || '').trim().slice(0, 60); if (!nm) return; const v = trFork(nm); trVSave(v); trPlanSheet(P.rid, true); },
  trVerName() { const P = S.trP, v = P && trVGet(P.vid); if (!v || v.owner_id !== S.tr.me_id) return; const nm = (prompt('Nom de la version', v.name) || '').trim().slice(0, 60); if (!nm) return; v.name = nm; trVSave(v); trVersDraw(); },
  async trVerDel() { const P = S.trP, v = P && trVGet(P.vid); if (!v || v.owner_id !== S.tr.me_id || !confirm(`Supprimer « ${v.name} » ?`)) return; clearTimeout(trVTimer[v.id]); delete trVPend[v.id]; try { await api('tr_plan_del', { id: v.id }); } catch (e) { toast(errMsg(e)); return; } S.tr.plans = S.tr.plans.filter((x) => x.id !== v.id); A.trVer({ id: '' }); },
  trPlanView(d) { if (!S.trP) return; S.trP.view = d.k; S.trP.sel = null; trPlanSheet(S.trP.rid, true); },
  trCam(d) {
    const P = S.trP; if (!P || !P.cam) return; const c = P.cam;
    if (d.k === 'porte') { c.mode = 'porte'; c.ly = 0; c.lp = -0.1; }
    else if (d.k === 'dessus') { c.mode = 'dessus'; c.yaw = 0; c.pitch = 1.5; }
    else { c.mode = 'orbit'; c.yaw = 0.65; c.pitch = 0.58; }
    document.querySelectorAll('[data-a="trCam"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === d.k)));
    if (TR_GL.ask) TR_GL.ask();
  },
  trAmb(d) { const P = S.trP; if (!P) return; P.soir = !!d.k; document.querySelectorAll('[data-a="trAmb"]').forEach((b) => b.setAttribute('aria-pressed', String(!!b.dataset.k === P.soir))); if (TR_GL.ask) TR_GL.ask(); },
  trMove() { const P = S.trP; if (!P) return; P.move = !P.move; if (!P.move) P.sel = null; const b = document.querySelector('[data-a="trMove"]'); if (b) { b.setAttribute('aria-pressed', String(P.move)); b.textContent = P.move ? '✋ Déplacer : oui' : '🔒 Déplacer : non'; } trPlanBar(); if (TR_GL.ask) TR_GL.ask(); },
  trFull() { const st = document.querySelector('.tr-stage'); if (!st) return; st.classList.toggle('big'); if (S.trP) S.trP.big = st.classList.contains('big'); if (TR_GL.ask) { TR_GL.ask(); setTimeout(() => TR_GL.ask && TR_GL.ask(), 60); } },
  async trSnap() {
    const P = S.trP; if (!P || !TR_GL.snap) return;
    const blob = await TR_GL.snap(); if (!blob) { toast('L’image n’a pas pu être créée.'); return; }
    const r = trRoomGet(P.rid), name = `${r ? trPlace(r) : 'Chambre'} - vue 3D.jpg`.replace(/[\\/:*?"<>|]/g, ' '), file = new File([blob], name, { type: 'image/jpeg' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast('Image enregistrée ✓');
  },
  trPlanAdd(d) { const P = S.trP; if (!P || !trPlanCan()) return; const { W, D } = trWDH(trData(P.rid));
    if (TR_FURN[d.k] && TR_FURN[d.k].san) { const dd = trData(P.rid), s = trSdbRect(dd, P.p, W, D); if (!s) { toast('Place d’abord la salle de bain dans un coin.'); return; } const f = TR_FURN[d.k], it = trSdbPut(s, trSdbDoor(s, P.p, W, D), d.k, [[f.w, f.d], [Math.round(f.w * 0.85), Math.round(f.d * 0.85)]], P.p.items.filter(trIsSan)); if (!it) { toast('Plus de place libre dans la salle de bain.'); return; } P.p.items.push(it); P.sel = it.id; trPlanSave(); trPlanSheet(P.rid, true); return; }
    const it = { id: trPid(), t: d.k, r: 0, x: Math.round(W / 2), y: Math.round(D / 2) };
    // Une place libre, la plus proche du milieu : deux meubles ajoutés ne se retrouvent pas l'un dans l'autre.
    if (d.k !== 'tv') { const obs = P.p.items.filter((i) => i.t !== 'tv').map(trRect), m = trDim(it); let best = null; for (let x = m.w / 2; x <= W - m.w / 2; x += 10) for (let y = m.d / 2; y <= D - m.d / 2; y += 10) { const q = { ...it, x, y }; if (!trFree(trRect(q), obs, W, D)) continue; const dd = Math.hypot(x - W / 2, y - D / 2); if (!best || dd < best[0]) best = [dd, x, y]; } if (best) { it.x = Math.round(best[1]); it.y = Math.round(best[2]); } }
    if (d.k === 'tv') Object.assign(it, trAtWall('tv', 0, W / 2, W, D), { id: it.id }); P.p.items.push(it); P.sel = it.id; trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanRot() { const P = S.trP; if (!P) return; const it = P.p.items.find((i) => i.id === P.sel); if (!it || it.t === 'tv') return; it.r = ((it.r || 0) + 90) % 360; { const { W, D } = trWDH(trData(P.rid)), r = trRect(it), hw = (r.x1 - r.x0) / 2, hh = (r.y1 - r.y0) / 2; it.x = 2 * hw >= W ? W / 2 : Math.min(W - hw, Math.max(hw, it.x)); it.y = 2 * hh >= D ? D / 2 : Math.min(D - hh, Math.max(hh, it.y)); } trPlanSave(); if (P.view === 'plan') trPlanDraw(); else { trPlanBar(); trGlStart(); } },
  trPlanDel() { const P = S.trP; if (!P) return; P.p.items = P.p.items.filter((i) => i.id !== P.sel); P.sel = null; trPlanSave(); if (P.view === '3d' && P.p.items.length) { trPlanBar(); trGlStart(); } else trPlanSheet(P.rid, true); },
  trPlanClear() { const P = S.trP; if (!P || !confirm('Enlever tous les meubles du plan ?')) return; P.p.items = []; P.p.cfg = null; P.sel = null; trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanCfg(d) {
    const P = S.trP, c = TR_CFG.find((x) => x[0] === d.k); if (!P || !c || !trPlanCan()) return;
    if (P.p.items.length && !confirm('Remplacer les meubles du plan par cette proposition ?')) return;
    const a = trAuto(P.rid, c[2], P.p); if (!a.p.items.length) { toast('Rien ne rentre dans cette disposition.'); return; }
    P.p.items = [...a.p.items, ...P.p.items.filter(trIsSan)]; P.p.cfg = d.k; P.sel = null; trPlanSave(); trPlanSheet(P.rid, true);
  },
  trDoorWall(d) { const P = S.trP; if (!P || !trPlanCan()) return; const { W, D } = trWDH(trData(P.rid)), k = +d.k, L = k % 2 ? D : W, dw = trDW(P.p); P.p.door = { ...P.p.door, wall: k, pos: Math.min(L - dw / 2, Math.max(dw / 2, P.p.door.pos)) }; trDoorToast(); trPlanSave(); trPlanSheet(P.rid, true); },
  trDoorWid(d) { const P = S.trP; if (!P || !trPlanCan()) return; const { W, D } = trWDH(trData(P.rid)), w = +d.k, L = P.p.door.wall % 2 ? D : W; P.p.door = { ...P.p.door, w, pos: Math.min(L - w / 2, Math.max(w / 2, P.p.door.pos)) }; trDoorToast(); trPlanSave(); trPlanSheet(P.rid, true); },
  trSdbDWid(d) { const P = S.trP; if (!P || !trPlanCan()) return; P.p.sdb = { ...P.p.sdb, dwid: +d.k }; trDoorToast(); trPlanSave(); trPlanSheet(P.rid, true); },
  trEdit() { const P = S.trP; if (!P || !trCan()) return; P.edit = !P.edit; P.esel = null; P.sel = null; trPlanSheet(P.rid, true); },
  trClAdd() { const P = S.trP; if (!P || !trCan()) return; const d = trData(P.rid), { W, D } = trWDH(d), L = Math.min(200, D - 20), y0 = trR5((D - L) / 2);
    const cl = [...trCls(d), { x0: trR5(W / 2), y0, x1: trR5(W / 2), y1: y0 + L }]; trPatch(P.rid, { cl }); P.esel = { t: 'cl', i: cl.length - 1 }; trPlanDraw(); toast('Mur ajouté au milieu : glisse-le, puis tire ses bouts.'); },
  trClDel() { trEdSet((d, e) => { d.cl = trCls(d).filter((_, i) => i !== e.i); return null; }); },
  trClKind(x) { trEdSet((d, e) => { const c = trCls(d)[e.i]; if (!c) return e; if (x.k) c.k = x.k; else delete c.k; d.cl = trCls(d); return e; }); },
  trClCut() { trEdSet((d, e) => { const cl = trCls(d), c = cl[e.i]; if (!c) return e; const v = trClV(c), m = trR5(v ? (c.y0 + c.y1) / 2 : (c.x0 + c.x1) / 2);
    const a = { ...c, ...(v ? { y1: m } : { x1: m }) }, b = { ...c, ...(v ? { y0: m } : { x0: m }) }; cl.splice(e.i, 1, a, b); d.cl = cl; return e; }); },
  trClTurn() { trEdSet((d, e) => { const c = trCls(d)[e.i]; if (!c) return e; const { W, D } = trWDH(d), mx = (c.x0 + c.x1) / 2, my = (c.y0 + c.y1) / 2, h = trClLen(c) / 2;
    if (trClV(c)) { c.y0 = c.y1 = trR5(my); c.x0 = trR5(Math.max(0, mx - h)); c.x1 = trR5(Math.min(W, mx + h)); } else { c.x0 = c.x1 = trR5(mx); c.y0 = trR5(Math.max(0, my - h)); c.y1 = trR5(Math.min(D, my + h)); } d.cl = trCls(d); return e; }); },
  trHzAdd() { const P = S.trP; if (!P || !trCan()) return; const d = trData(P.rid), { W, D } = trWDH(d), w = Math.min(100, W / 2), h = Math.min(100, D / 2);
    const hors = [...trHors(d), { x0: W - w, y0: D - h, x1: W, y1: D }]; trPatch(P.rid, { hors }); P.esel = { t: 'hz', i: hors.length - 1 }; trPlanDraw(); toast('Zone ajoutée en bas à droite : glisse-la et règle ses mesures.'); },
  trHzDel() { trEdSet((d, e) => { d.hors = trHors(d).filter((_, i) => i !== e.i); return null; }); },
  trFenAdd() { const P = S.trP; if (!P || !trCan()) return; const d = trData(P.rid), { W, D } = trWDH(d), f2 = trFen2(d), used = [P.p.win.wall, ...f2.map((f) => f.wall)];
    const wall = [0, 1, 2, 3].sort((a, b) => used.filter((u) => u === a).length - used.filter((u) => u === b).length || (a === P.p.door.wall) - (b === P.p.door.wall))[0];
    trPatch(P.rid, { fen2: [...f2, { wall, pos: trR5(trWallLen(wall, W, D) / 2), w: trNum(d.fen_w) || 120 }] }); trPlanSheet(P.rid, true); toast('Fenêtre ajoutée : glisse-la (en bleu) à sa place sur le plan.'); },
  trFenDel(x) { const P = S.trP; if (!P || !trCan()) return; const d = trData(P.rid); trPatch(P.rid, { fen2: trFen2(d).filter((_, i) => i !== +x.i) }); trPlanSheet(P.rid, true); },
  trFenW(x) { const P = S.trP; if (!P || !trCan()) return; const d = trData(P.rid), f2 = trFen2(d).map((f) => ({ ...f })); if (!f2[+x.i]) return; f2[+x.i].w = +x.k; trPatch(P.rid, { fen2: f2 }); trPlanSheet(P.rid, true); },
  trFreeOpen() { const P = S.trP; if (!P || !trPlanCan()) return; const m = trDoorAdapt(P.p, P.rid); toast(m.length ? m.join(', ') + '.' : 'Rien à déplacer.', 5000); trPlanSave(); trPlanSheet(P.rid, true); },
  trSdbStyle(d) {
    const P = S.trP; if (!P || !trPlanCan()) return;
    const r = trSdbAuto(P.rid, { ...P.p, items: [] }, d.k, { vasque: P.p.niv === 'prestige' });
    P.p.items = [...P.p.items.filter((i) => !trIsSan(i)), ...r.items]; if (r.note) toast(r.note, 5000); trPlanSave(); trPlanSheet(P.rid, true);
  },
  trSdbDoorSwap() { const P = S.trP; if (!P || !trPlanCan()) return; const dd = trData(P.rid), { W, D } = trWDH(dd), s = trSdbRect(dd, P.p, W, D), cur = trSdbDoor(s, P.p, W, D); P.p.sdb = { ...P.p.sdb, dw: cur && cur.side === 'v' ? 'h' : 'v', dpos: null }; trDoorToast(); trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanSdb(d) { const P = S.trP; if (!P || !trPlanCan()) return; P.p.sdb = { c: d.k, rot: !!P.p.sdb.rot }; trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanSdbRot() { const P = S.trP; if (!P || !trPlanCan()) return; P.p.sdb.rot = !P.p.sdb.rot; trPlanSave(); trPlanSheet(P.rid, true); },
  trDeco(d) { const P = S.trP; if (!P || !trPlanCan()) return; const deco = { ...(P.p.deco || {}) }; if (!d.v || deco[d.k] === d.v) delete deco[d.k]; else deco[d.k] = d.v; P.p.deco = deco; trPlanSave(); trPlanSheet(P.rid, true); },
  trDecoLum(d) { const P = S.trP; if (!P || !trPlanCan()) return; const cur = trLum(P.p.deco), lum = cur.includes(d.v) ? cur.filter((x) => x !== d.v) : [...cur, d.v]; P.p.deco = { ...(P.p.deco || {}), lum }; trPlanSave(); trPlanSheet(P.rid, true); },
  trNiveauGo(d) {
    const P = S.trP, nv = TR_NIVEAUX.find((x) => x.k === d.k); if (!P || !nv || !trPlanCan()) return;
    if (P.p.items.length && !P.p.niv && !confirm(`Remplacer les meubles et les finitions du plan par la proposition « ${nv.l} » ?`)) return;
    const n = P.p.niv === nv.k ? (P.p.nivN || 0) + 1 : 0; // un nouvel appui sur le même niveau : une autre combinaison
    const a = trNiveau(P.rid, nv, P.p, n); if (!a.p.items.length) { toast('Rien ne rentre dans cette pièce avec ces lits.'); return; }
    const oldSan = P.p.items.filter(trIsSan); let san = oldSan, bnote = '';
    if (P.p.sdb && P.p.sdb.c) {
      if (nv.k !== 'eco' || !oldSan.length) { const hadBath = oldSan.some((i) => i.t === 'baignoire'), r = trSdbAuto(P.rid, { ...P.p, items: [] }, nv.k === 'prestige' ? 'italienne' : nv.k === 'confort' ? (n % 2 ? 'bain' : 'douche') : (hadBath ? 'bain' : 'douche'), { vasque: nv.k === 'prestige', n }); san = r.items; bnote = r.note; }
    }
    P.p.items = [...a.p.items, ...san]; P.p.deco = trNivDeco(nv, n); P.p.niv = nv.k; P.p.nivN = n; if (bnote) toast(bnote, 5000); if (n) toast(`${nv.l} · variante ${n + 1}`); P.p.cfg = null; P.sel = null; P.view = '3d'; trPlanSave(); trPlanSheet(P.rid, true);
  },
  trIkPick() { if (!S.trP || !trPlanCan()) return; trIkPickSheet(); },
  trIkPk(d) { S.trIkPk = d.k; trIkPickSheet(); },
  trIkBack() { if (S.trP) trPlanSheet(S.trP.rid, true); },
  trIkPut(d) { C.trPlanIk({ value: d.ref }); },
  async trIkPlanList() {
    const P = S.trP; if (!P || !trCan() || !S.trCat) return; const by = {}; P.p.items.filter((i) => i.ik).forEach((i) => { by[i.ik] = (by[i.ik] || 0) + 1; });
    let n = 0;
    try { for (const [ref, qty] of Object.entries(by)) { const c = S.trCat.find((x) => x.ref === ref); if (!c || S.tr.todo.some((t) => t.room_id === P.rid && t.ref === ref && t.statut !== 'fait')) continue; const x = await api('tr_todo_save', { kind: 'achat', label: `${c.name} · ${c.descr || ''}`.slice(0, 200), qty, room_id: P.rid, niveau: 'confort', ref, url: trIkUrl(c), prix: c.price, magasin: 'IKEA', note: 'Prix relevé le ' + String(c.seen).split('-').reverse().join('/') }); S.tr.todo.push(x.todo); n++; } }
    catch (e) { toast(errMsg(e)); return; }
    toast(n ? `${n} référence${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} à la liste ✓` : 'Déjà dans la liste');
  },
  async trDecoList() {
    const P = S.trP; if (!P || !trCan()) return; const lines = trDecoLines(P.rid, P.p); if (!lines.length) return;
    const have = (l) => S.tr.todo.some((t) => t.room_id === P.rid && t.statut !== 'fait' && t.label === l);
    let n = 0;
    try { for (const l of lines) { if (have(l.label)) continue; const x = await api('tr_todo_save', { kind: 'achat', label: l.label, qty: l.qty, room_id: P.rid, niveau: 'confort', note: l.note }); S.tr.todo.push(x.todo); n++; } }
    catch (e) { toast(errMsg(e)); return; }
    toast(n ? `${n} ligne${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} à la liste ✓` : 'Déjà dans la liste');
  },
  async trScanPick(d) {
    S.trCtx = d.id; if (!trCan()) return;
    const f = await pickFile('.json,application/json,text/plain'); if (!f) return;
    try { S.trScan = trScanParse(JSON.parse(await f.text())); }
    catch (e) { toast('Ce fichier n’est pas un scan lisible. Dans OpenPlan3D : Export → Editable Plan (JSON).', 7000); return; }
    trScanSheet(d.id);
  },
  // Réceptacle : on dépose d'abord le fichier, on choisit ensuite où il va (une chambre, ou une nouvelle pièce d'essai).
  async trScanDrop() {
    if (!trPlanCan()) return;
    const f = await pickFile('.json,application/json,text/plain'); if (!f) return;
    try { S.trScan = trScanParse(JSON.parse(await f.text())); }
    catch (e) { toast('Ce fichier n’est pas un scan lisible. Dans OpenPlan3D : Export → Editable Plan (JSON).', 7000); return; }
    const sc = S.trScan, row = (r) => { const d = trData(r.id), has = trNum(d.len) && trNum(d.wid); return `<button class="prow" data-a="trScanTo" data-id="${esc(r.id)}"><span class="pr-t"><b>${esc(trPlace(r))}</b><span class="muted sm">${has ? `Déjà mesurée : ${trM(trNum(d.len))} × ${trM(trNum(d.wid))} (sera remplacé)` : 'Pas encore mesurée'}</span></span><span class="chev">›</span></button>`; };
    openSheet('trscanw', `<div class="row between"><h2>Scan lu ✓</h2><button class="btn small" data-a="close">Annuler</button></div>
      <div class="card"><h3>📏 ${trM(sc.W)} × ${trM(sc.D)} · hauteur ${trM(sc.H)}</h3><p class="muted">${sc.items.length} meuble${sc.items.length > 1 ? 's' : ''} reconnu${sc.items.length > 1 ? 's' : ''}${sc.sdb ? ', salle de bain repérée' : ''}.</p></div>
      <h2 class="sec">Où ranger ce scan ?</h2>
      <div class="group"><button class="prow" data-a="trScanTo" data-id="new"><span class="pr-t"><b>＋ Nouvelle pièce d’essai</b><span class="muted sm">Ne compte pas dans les travaux de l’Archange</span></span><span class="chev">›</span></button></div>
      ${S.tr.can_edit ? `<h2 class="sec">Chambres de l’Archange</h2><div class="group">${trRooms().map(row).join('')}</div><h2 class="sec">Parties communes et locaux</h2><div class="group">${trCommuns().map(row).join('')}</div>` : ''}
      ${trTests().filter((r) => trMine(r.id)).length ? `<h2 class="sec">Mes projets</h2><div class="group">${trTests().filter((r) => trMine(r.id)).map(row).join('')}</div>` : ''}`);
  },
  trScanTo(d) {
    if (!S.trScan || !trPlanCan()) return;
    if (d.id !== 'new') { trScanSheet(d.id); return; } // chambre existante : écran de confirmation, puisque ses mesures seront remplacées
    const id = 'test__' + Math.random().toString(36).slice(2, 10), t = new Date();
    S.tr.rooms[id] = { room_id: id, hotel: 'test', data: {}, owner_id: S.tr.me_id, shared: [] }; S.trCtx = id; trPatch(id, { dossier: 'Mes scans', nom: `Scan du ${t.getDate()}/${t.getMonth() + 1} à ${t.getHours()}h${String(t.getMinutes()).padStart(2, '0')}` });
    A.trScanApply({ id });
  },
  trScanApply(d) {
    S.trCtx = d.id; const sc = S.trScan; if (!sc || !trCan()) return;
    const old = trPlanOf(d.id), plan = { items: sc.items, door: sc.door || old.door, win: sc.win || old.win, sdb: sc.sdb ? { c: sc.sdb.c, rot: false } : { c: '' }, deco: old.deco };
    if (!sc.door) plan.door = { wall: 2, pos: Math.min(sc.W - TR_DOOR_W / 2, 75) }; if (!sc.win) plan.win = { wall: 0, pos: sc.W / 2 };
    const patch = { len: sc.W, wid: sc.D, hei: sc.H, surf: null, plan, scan_at: new Date().toISOString() };
    if (sc.fen) Object.assign(patch, { fen_w: sc.fen.w, fen_h: sc.fen.h, fen_allege: sc.fen.allege, fen_n: sc.fen.n });
    if (sc.sdb) Object.assign(patch, { sdb_len: sc.sdb.len, sdb_wid: sc.sdb.wid });
    Object.assign(patch, { cl: sc.cl || [], hors: sc.hors || [], fen2: sc.fen2 || [], sdbz: sc.sdb && sc.sdb.c === 'z' ? sc.sdb.rect : null });
    trPatch(d.id, patch); S.trScan = null; S.trP = null; toast('Scan intégré ✓');
    trPlanSheet(d.id); S.trP.view = '3d'; trPlanSheet(d.id, true);
  },
});
Object.assign(I, { trLumi(el) { const P = S.trP; if (!P) return; P.lumi = Number(el.value) || 100; if (TR_GL.ask) TR_GL.ask(); } });
// Choisir un meuble IKEA en le voyant : un écran de vignettes par rayon, au lieu d'une liste de noms.
function trIkPickSheet() {
  const P = S.trP; if (!P) return; trGlStop(); if (!S.trCat) trIkLoad();
  const cats = TR_IK_CATS.filter((c) => c[2]), k = cats.some((c) => c[0] === S.trIkPk) ? S.trIkPk : cats[0][0], list = (S.trCat || []).filter((c) => c.cat === k && trIkDims(c));
  openSheet('trikpick', `<div class="row between"><h2>Catalogue IKEA</h2><button class="btn small" data-a="trIkBack">‹ Plan</button></div>
    <div class="tr-sws">${cats.map(([c, l]) => `<button class="tr-sw" style="padding-left:12px" data-a="trIkPk" data-k="${c}" aria-pressed="${k === c}">${l}</button>`).join('')}</div>
    ${!S.trCat ? '<p class="muted">Chargement…</p>' : `<div class="tr-ikg">${list.map((c) => `<div class="tr-ik"><img loading="lazy" referrerpolicy="no-referrer" alt="" src="${esc(trIkImg(c))}" onerror="this.onerror=null;this.src='${esc(trIkImg2(c))}'"><b>${esc(c.name)}</b><span class="muted sm">${esc(c.descr || '')}</span><span class="tr-ikp">${c.price != null ? trEur(c.price) : ''}</span>${trIkDims(c).approx ? '<span class="muted sm">Dimensions approximatives</span>' : ''}
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn small pri" data-a="trIkPut" data-ref="${esc(c.ref)}">Poser</button><a class="btn small" href="${esc(trIkUrl(c))}" target="_blank" rel="noopener">Voir</a></div></div>`).join('')}</div>`}`);
}
// Applique une correction sur la sélection du mode correction, puis enregistre la chambre.
function trEdSet(fn) {
  const P = S.trP; if (!P || !trCan() || !P.esel) return; const d = JSON.parse(JSON.stringify(trData(P.rid)));
  const e = fn(d, P.esel); trPatch(P.rid, Object.fromEntries(['cl', 'hors', 'sdbz'].filter((k) => d[k] !== undefined).map((k) => [k, d[k]]))); P.esel = e; trPlanDraw();
}
Object.assign(C, {
  trEdNum(el) {
    const P = S.trP; if (!P || !trCan()) return; const k = el.dataset.k, v = Math.round(Number(el.value)); if (!(v >= 10 && v <= 5000)) { toast('Mesure en centimètres, s’il te plaît.'); return; }
    if (['len', 'wid', 'sdb_len', 'sdb_wid'].includes(k)) { trPatch(P.rid, { [k]: v }); trPlanSheet(P.rid, true); toast(`${{ len: 'Longueur', wid: 'Largeur', sdb_len: 'Longueur de la salle de bain', sdb_wid: 'Largeur de la salle de bain' }[k]} : ${trM(v)}`); return; }
    trEdSet((d, e) => {
      const { W, D } = trWDH(d);
      if (k === 'cl' || k === 'clpos') { const c = trCls(d)[e.i]; if (!c) return e; const vt = trClV(c);
        if (k === 'cl') { const old = { ...c }; if (vt) { const a = Math.min(c.y0, c.y1), b = Math.max(c.y0, c.y1); c.y0 = a; c.y1 = Math.min(D, a + v); old.y0 = a; old.y1 = b; } else { const a = Math.min(c.x0, c.x1), b = Math.max(c.x0, c.x1); c.x0 = a; c.x1 = Math.min(W, a + v); old.x0 = a; old.x1 = b; } const cl = trCls(d); trClFollow(cl, c, old); d.cl = cl; e = { ...e, i: cl.indexOf(c) }; return e; }
        else { const q = Math.min(vt ? W : D, v); if (vt) c.x0 = c.x1 = q; else c.y0 = c.y1 = q; } d.cl = trCls(d); return e; }
      const r = e.t === 'sz' ? d.sdbz : trHors(d)[e.i]; if (!r) return e;
      if (k === 'zw') { r.x1 = Math.min(W, r.x0 + v); if (r.x1 - r.x0 < v) r.x0 = Math.max(0, r.x1 - v); } else { r.y1 = Math.min(D, r.y0 + v); if (r.y1 - r.y0 < v) r.y0 = Math.max(0, r.y1 - v); }
      return e;
    });
  },
  trDoorPos(el) { const P = S.trP; if (!P || !trPlanCan()) return; P.p.door = { ...P.p.door, pos: Number(el.value) }; trDoorToast(); trPlanSave(); trPlanSheet(P.rid, true); },
  trSdbDPos(el) { const P = S.trP; if (!P || !trPlanCan()) return; const dd = trData(P.rid), { W, D } = trWDH(dd), sd = trSdbDoor(trSdbRect(dd, P.p, W, D), P.p, W, D); if (!sd) return; P.p.sdb = { ...P.p.sdb, dw: sd.side, dpos: Number(el.value) }; trDoorToast(); trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanIk(el) {
    const P = S.trP, c = (S.trCat || []).find((x) => x.ref === (el.value || (el.dataset && el.dataset.ref))), cat = c && TR_IK_CATS.find((x) => x[0] === c.cat), dm = c && trIkDims(c); if (!P || !c || !cat || !cat[2] || !dm || !trPlanCan()) return;
    const { W, D } = trWDH(trData(P.rid)), it = { id: trPid(), t: cat[2], r: 0, x: Math.round(W / 2), y: Math.round(D / 2), w: dm.w, d: dm.d, n: 'IKEA ' + c.name, ik: c.ref }; if (dm.h) it.h = dm.h;
    P.p.items.push(it); P.sel = it.id; trPlanSave(); trPlanSheet(P.rid, true);
  },
  trPlanBank(el) {
    const P = S.trP, b = S.tr.items.find((i) => i.id === el.value); if (!P || !b || !trPlanCan()) return;
    const { W, D } = trWDH(trData(P.rid)), t = TR_BANK_MAP[b.type] || 'meuble';
    const it = { id: trPid(), t, r: 0, x: Math.round(W / 2), y: Math.round(D / 2), w: b.w_cm, d: b.d_cm, n: b.label || trType(b.type)[1], bank: b.id }; if (b.h_cm) it.h = b.h_cm;
    if (t === 'tv') { delete it.d; Object.assign(it, trAtWall('tv', 0, W / 2, W, D, { w: b.w_cm }), { id: it.id }); }
    P.p.items.push(it); P.sel = it.id; trPlanSave(); trPlanSheet(P.rid, true);
  },
});
