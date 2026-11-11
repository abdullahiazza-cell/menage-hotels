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
};
const TR_CFG = [['d', '1 lit double', ['lit_d']], ['ss', '2 lits simples', ['lit_s', 'lit_s']], ['ds', '1 double + 1 simple', ['lit_d', 'lit_s']], ['sss', '3 lits simples', ['lit_s', 'lit_s', 'lit_s']], ['s', '1 lit simple', ['lit_s']]];
const TR_BANK_MAP = { lit_simple: 'lit_s', lit_double: 'lit_d', bureau: 'bureau', chaise: 'chaise', fauteuil: 'fauteuil', armoire: 'armoire', chevet: 'chevet', tv: 'tv' };
const TR_DOOR_W = 90;
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
function trSdbRect(d, p, W, D) {
  if (!p.sdb || !p.sdb.c) return null;
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
const trItName = (it) => it.n || TR_FURN[it.t].l;
// Zones d'accès d'un lit : au pied, et le long de chaque côté (sur la moitié basse, là où l'on passe).
const trBedFoot = (it, deep) => { const m = trDim(it); return trLocal(it, 0, m.d / 2 + deep / 2, m.w, deep); };
const trBedSide = (it, sign, wide) => { const m = trDim(it); return trLocal(it, sign * (m.w / 2 + wide / 2), m.d / 2 - 55, wide, 110); };

/* ---------- vérification d'une disposition ---------- */
function trPlanCheck(roomId, p) {
  const d = trData(roomId), { W, D } = trWDH(d), bad = new Set(), lines = [];
  const sdb = trSdbRect(d, p, W, D), doorZ = trOpening(p.door, TR_DOOR_W, W, D, 80);
  const solid = p.items.filter((i) => i.t !== 'tv'), rc = new Map(solid.map((i) => [i.id, trRect(i)]));
  solid.forEach((i) => {
    const r = rc.get(i.id);
    if (!trInside(r, W, D)) { bad.add(i.id); lines.push(`${trItName(i)} dépasse du mur`); }
    if (sdb && trHit(r, sdb)) { bad.add(i.id); lines.push(`${trItName(i)} est dans la salle de bain`); }
    if (trHit(r, doorZ)) { bad.add(i.id); lines.push(`${trItName(i)} gêne l’ouverture de la porte`); }
  });
  for (let a = 0; a < solid.length; a++) for (let b = a + 1; b < solid.length; b++) {
    const A = solid[a], B = solid[b];
    if ((A.t === 'chaise' && B.t === 'bureau') || (A.t === 'bureau' && B.t === 'chaise')) continue;
    if (trHit(rc.get(A.id), rc.get(B.id))) { bad.add(A.id); bad.add(B.id); lines.push(`${trItName(A)} et ${trItName(B)} se chevauchent`); }
  }
  solid.filter(trIsBed).forEach((i) => {
    const obs = solid.filter((o) => o.id !== i.id).map((o) => rc.get(o.id)); if (sdb) obs.push(sdb);
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
  const fixed = [trOpening(p.door, TR_DOOR_W + 10, W, D, 95)]; if (sdb) fixed.push(sdb);
  const winZ = trOpening(p.win, winW + 50, W, D, 60);
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
            if (!trFree(trRect(it), others, W, D) || !trFree(trBedFoot(it, 50), o, W, D)) { ok = false; break; }
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
    if (trFree(trRect(it), occ(), W, D)) p.items.push(it);
  }));
  // Meuble dos à un mur, avec de la place devant pour s'en servir.
  function putWall(t, o) {
    let best = null; const F = TR_FURN[t];
    for (let wall = 0; wall < 4; wall++) {
      const L = trWallLen(wall, W, D); if (F.w > L) continue;
      const cs = []; for (let c = F.w / 2; c <= L - F.w / 2 + 0.01; c += 10) cs.push(c); cs.push(L - F.w / 2);
      for (const c of cs) {
        const it = trAtWall(t, wall, c, W, D), r = trRect(it), ob = occ();
        if (!trFree(r, ob, W, D) || !trFree(trLocal(it, 0, F.d / 2 + o.front / 2, F.w, o.front), ob, W, D)) continue;
        if (o.noWin && trHit(r, winZ)) continue;
        const sc = o.score(it, wall, c, L);
        if (!best || sc > best.sc) best = { sc, it };
      }
    }
    if (best) p.items.push(best.it); else if (!o.optional) miss.push(F.l);
    return best ? best.it : null;
  }
  const mid = (z) => [(z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2];
  const dist = (it, pt) => Math.hypot(it.x - pt[0], it.y - pt[1]);
  const doorPt = mid(trOpening(p.door, TR_DOOR_W, W, D, 10)), winPt = mid(winZ);
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
      const blocked = [trOpening(p.door, TR_DOOR_W + 20, W, D, 10), trOpening(p.win, winW + 10, W, D, 10), ...(sdb ? [sdb] : []), ...p.items.filter((i) => i.t === 'armoire').map(trRect)];
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
  const dz = trOpening(p.door, TR_DOOR_W, W, D, TR_DOOR_W);
  const arc = p.door.wall === 0 ? `M${dz.x0},0 L${dz.x0},${TR_DOOR_W} A${TR_DOOR_W},${TR_DOOR_W} 0 0 0 ${dz.x1},0` : p.door.wall === 2 ? `M${dz.x0},${D} L${dz.x0},${D - TR_DOOR_W} A${TR_DOOR_W},${TR_DOOR_W} 0 0 1 ${dz.x1},${D}`
    : p.door.wall === 3 ? `M0,${dz.y0} L${TR_DOOR_W},${dz.y0} A${TR_DOOR_W},${TR_DOOR_W} 0 0 1 0,${dz.y1}` : `M${W},${dz.y0} L${W - TR_DOOR_W},${dz.y0} A${TR_DOOR_W},${TR_DOOR_W} 0 0 0 ${W},${dz.y1}`;
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
    ${sdb ? `<rect class="psdb" x="${sdb.x0}" y="${sdb.y0}" width="${sdb.x1 - sdb.x0}" height="${sdb.y1 - sdb.y0}"/><text class="pt" x="${(sdb.x0 + sdb.x1) / 2}" y="${(sdb.y0 + sdb.y1) / 2 + fs * 0.35}" font-size="${fs}" text-anchor="middle">SdB</text>` : ''}
    <rect class="pw" x="0" y="0" width="${W}" height="${D}"/>
    <path class="parc" d="${arc}"/>${items}
    <g data-op="win"><line class="pwin" ${seg(p.win, winW)}/><line class="phit" ${seg(p.win, winW)}/></g>
    <g data-op="door"><line class="pdoor" ${seg(p.door, TR_DOOR_W)}/><line class="phit" ${seg(p.door, TR_DOOR_W)}/></g>
    <text class="pdim" x="${W / 2}" y="${-fs * 0.9}" font-size="${fs}" text-anchor="middle">${trM(W)}</text>
    <text class="pdim" x="${-fs * 0.9}" y="${D / 2}" font-size="${fs}" text-anchor="middle" transform="rotate(-90 ${-fs * 0.9} ${D / 2})">${trM(D)}</text>`;
}
function trPlanDraw() { const g = $('tr-plan-g'); if (g && S.trP) g.innerHTML = trPlanSvg(); trPlanBar(); }
function trPlanBar() {
  const P = S.trP, bar = $('tr-plan-bar'), chkEl = $('tr-plan-chk'); if (!P) return;
  const it = P.p.items.find((i) => i.id === P.sel);
  if (bar) bar.innerHTML = it && trPlanCan() ? `<div class="row between"><b>${esc(trItName(it))} <span class="muted sm">${trDim(it).w} × ${trDim(it).d} cm</span></b><span class="row"><button class="btn small soft" data-a="trPlanRot">⟳ Tourner</button><button class="btn small ghost bad-t" data-a="trPlanDel">Enlever</button></span></div>` : (trPlanCan() && P.view === 'plan' ? '<p class="muted sm">Glisse la porte (marron), la fenêtre (bleue) et les meubles à leur place. Touche un meuble pour le tourner ou l’enlever.</p>' : '');
  if (bar) bar.classList.toggle('on', !!(it && trPlanCan()));
  if (chkEl && !trIsTest(P.rid)) { const a = trPmr(P.rid); chkEl.dataset.pmr = a.ok ? '♿ Cette chambre pourrait devenir une chambre adaptée (à confirmer : accès, porte de 83 cm, salle d’eau).' : `♿ Pas adaptable telle quelle : ${a.why}.`; } else if (chkEl) chkEl.dataset.pmr = '';
  if (chkEl) {
    const c = trPlanCheck(P.rid, P.p), beds = P.p.items.filter(trIsBed), n = beds.reduce((a, b) => a + (b.t === 'lit_d' ? 2 : 1), 0), s = trSurf({ ...trData(P.rid), plan: P.p });
    const need = n ? TR_SURF3[Math.min(3, n)] : 0, sOk = !n || s.tot >= need * 0.9;
    chkEl.innerHTML = !P.p.items.length ? '<p class="muted">Choisis une disposition ci-dessous, ou ajoute les meubles un par un.</p>'
      : `${c.lines.length ? `<ul class="tr-gaps">${c.lines.map((l) => `<li>⚠️ ${esc(l)}</li>`).join('')}</ul>` : '<p class="banner sm c-green">Tout tient : rien ne se chevauche, la porte s’ouvre, les lits sont accessibles ✓</p>'}
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
  const sdb = trSdbRect(d, a.p, W, D), obs = [...a.p.items.filter((i) => i.t !== 'tv').map(trRect), ...(sdb ? [sdb] : []), trOpening(base.door, TR_DOOR_W, W, D, 60)];
  for (let x = 0; x + 150 <= W + 0.5; x += 10) for (let y = 0; y + 150 <= D + 0.5; y += 10) if (trFree({ x0: x, y0: y, x1: x + 150, y1: y + 150 }, obs, W, D)) return { ok: true, why: '' };
  return { ok: false, why: 'pas de rond de 1,50 m libre' };
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
    if (el.dataset.op) drag = { op: el.dataset.op, moved: false };
    else { const it = P.p.items.find((i) => i.id === el.dataset.it); if (!it) return; drag = { it, dx: it.x - x, dy: it.y - y, sx: x, sy: y, moved: false }; }
    try { svg.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return; const P = S.trP, d = trData(P.rid), { W, D } = trWDH(d), [x, y] = pt(e);
    if (drag.op) {
      const o = drag.op === 'door' ? P.p.door : P.p.win, width = drag.op === 'door' ? TR_DOOR_W : (trNum(d.fen_w) || 120);
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
    if (dr.it) P.sel = dr.it.id;
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
  dwl.boxes.push(onWall(p.door, TR_DOOR_W + 12, 0, dh + 6, 2, TR_COL.frame), onWall(p.door, TR_DOOR_W, 0, dh, 3.4, TR_COL.door, 3), onWall({ wall: p.door.wall, pos: Math.min(dL - 6, p.door.pos + TR_DOOR_W / 2 - 9) }, 3, 98, 102, 9, TR_COL.metal), onWall({ wall: p.door.wall, pos: Math.min(dL - 10, p.door.pos + TR_DOOR_W / 2 - 14) }, 12, 99, 101, 9.5, TR_COL.metal));
  // Un cadre au-dessus de la tête de lit, s'il n'y a pas de fenêtre à cet endroit.
  if (bed0 && H >= 225) {
    const pos = headWall % 2 ? bed0.y : bed0.x, clear = p.win.wall !== headWall || Math.abs(p.win.pos - pos) > fw / 2 + 50;
    if (clear) walls[headWall].boxes.push(onWall({ wall: headWall, pos }, 74, 138, 190, 2.4, [0.16, 0.15, 0.14]), onWall({ wall: headWall, pos }, 66, 142, 186, 2.9, [0.94, 0.92, 0.87]), onWall({ wall: headWall, pos: pos - 6 }, 26, 152, 176, 3.2, dacc && dacc[2] ? dacc[2] : [0.60, 0.69, 0.62]));
  }
  const sdb = trSdbRect(d, p, W, D);
  const glass = sdb ? [box(sdb.x0, sdb.y0, 0, sdb.x1, sdb.y1, Math.min(H, 215), [0.62, 0.74, 0.86])] : [];
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
    { const m = trDim(it); models.push({ id: it.id, tv: it.t === 'tv', t: it.t, x: (it.x - W / 2) * cm, z: (it.y - D / 2) * cm, r: it.r || 0, w: m.w * cm, d: m.d * cm, h: m.h * cm }); }
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
    const obs = p.items.filter((it) => it.t !== 'tv').map(trRect).concat(sdb ? [sdb] : [], [trOpening(p.door, TR_DOOR_W + 30, W, D, 110), trOpening(p.win, fw + 110, W, D, 45)]);
    p.items.filter((it) => it.t === 'tv').forEach((it) => obs.push(trLocal(it, 0, 0, trDim(it).w, 40)));
    const cs = [[30, 30], [W - 30, 30], [W - 30, D - 30], [30, D - 30]].filter(([x, y]) => trFree({ x0: x - 24, y0: y - 24, x1: x + 24, y1: y + 24 }, obs, W, D));
    if (cs.length) { const far = (q) => Math.hypot(q[0] - bed0.x, q[1] - bed0.y); cs.sort((a, b) => far(a) - far(b)); const q = cs[cs.length - 1]; plants.push([(q[0] - W / 2) * cm, (q[1] - D / 2) * cm]); }
  }
  // Point de vue « depuis la porte » : à 50 cm à l'intérieur, à hauteur des yeux, tourné vers le milieu de la pièce.
  const dz = trOpening(p.door, 10, W, D, 50), de = [(((dz.x0 + dz.x1) / 2) - W / 2) * cm, 1.55, (((dz.y0 + dz.y1) / 2) - D / 2) * cm];
  const inward = [[0, 1], [-1, 0], [0, -1], [1, 0]][p.door.wall], dEye = [de[0] + inward[0] * 0.25, 1.55, de[2] + inward[1] * 0.25];
  return { W: W * cm, D: D * cm, H: H * cm, B, glass, walls, plants, models, lum: { plaf: lum.includes('plafonnier'), corniche: lum.includes('corniche'), spots }, ceil: box(-T, -T, H, W + T, D + T, H + 6, [0.955, 0.955, 0.95], 6), sdbWall: sdb ? box(sdb.x0, sdb.y0, 0, sdb.x1, sdb.y1, H, wc, 5) : null, Wc: W, Dc: D, Hc: H, win: { wall: p.win.wall, pos: p.win.pos, w: fw, z0: al, z1: ft }, dEye, dYaw: Math.atan2(-dEye[0], -dEye[2]) };
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
    try { const h = mod.trRendu({ canvas: cv, lab: $('tr-lab'), sc: trScene(P.rid, P.p), cam: P.cam, fmt: trM, cotes: () => P.cotes !== false, soir: () => !!P.soir, lumi: () => (P.lumi || 100) / 100, edit: trPlanCan(), sel: () => P.sel,
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
    if (inside) { drawBox(sc.ceil); if (sc.sdbWall) drawBox(sc.sdbWall); }
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
  const murs = Math.max(0, (2 * (W + D) * H - n * fw * fh - TR_DOOR_W * 204) / 10000), bed0 = p.items.find(trIsBed);
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
  const outer = doors.filter((d) => d.dist <= 60).sort((a, b) => a.dist - b.dist), door = outer[0] || [...doors].sort((a, b) => a.dist - b.dist)[0] || null;
  // Salle de bain scannée avec la chambre : on la reconnaît à ses sanitaires (ou à l'étiquette « bathroom » du scan),
  // puis on cherche les cloisons qui la séparent de la chambre. Elle devient un bloc dans un coin du plan.
  const SAN = ['toilet', 'sink', 'bathtub'], sanPts = (j.objects || []).filter((o) => okEl(o) && SAN.includes(Object.keys(o.category || {})[0])).map((o) => P(o.transform[12], o.transform[14]));
  (j.sections || []).forEach((sx) => { if (sx && /bath/i.test(String(sx.label || '')) && Array.isArray(sx.center) && sx.center.length >= 3 && sx.center.every(num)) sanPts.push(P(sx.center[0], sx.center[2])); });
  let sdb = null;
  if (sanPts.length) {
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
    if (inSdb(px, py)) { sdb.inside++; return; } // ce qui est dans la salle de bain reste dans son bloc
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
  return { W, D, H, sdb, door: door ? { wall: door.wall, pos: Math.round(door.pos) } : null, win: win ? { wall: win.wall, pos: Math.round(win.pos) } : null,
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
      ${sc.sdb ? `<p><b>Salle de bain repérée</b> dans un coin : ${trM(sc.sdb.len)} × ${trM(sc.sdb.wid)}, soit ${trFr(sc.sdb.len * sc.sdb.wid / 10000)} m² compris dans la surface.</p>` : ''}
      ${sc.nWalls > 4 || sc.nRooms > 1 ? `<p class="banner sm c-slate">Le scan compte plus de 4 murs : l’ensemble est ramené au rectangle qui l’entoure${sc.sdb ? ', salle de bain comprise' : ''}. S’il reste un recoin, la surface réelle est un peu plus petite ; corrige-la dans la fiche.</p>` : ''}</div>
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
    <div class="tr-stage">${P.view === 'plan'
      ? `<svg id="tr-svg" viewBox="${-pad} ${-pad} ${W + pad * 1.4} ${D + pad * 1.4}" preserveAspectRatio="xMidYMid meet"><g id="tr-plan-g"></g></svg>`
      : `<div class="tr-3d"><canvas id="tr-gl"></canvas><div id="tr-lab"></div><div class="tr-tools"><button data-a="trFull" aria-label="Plein écran">⤢</button><button data-a="trSnap" aria-label="Enregistrer l’image">📸</button></div><div id="tr-plan-bar" class="tr-selbar"></div></div>`}</div>
    ${P.view === '3d' ? `<div class="segc" role="group" aria-label="Point de vue">${[['orbit', 'Vue d’ensemble'], ['porte', 'Depuis la porte'], ['dessus', 'Du dessus']].map(([k, l]) => `<button data-a="trCam" data-k="${k}" aria-pressed="${((P.cam && P.cam.mode) || 'orbit') === k}">${l}</button>`).join('')}</div>
    <div class="segc" role="group" aria-label="Ambiance">${[['', '☀️ Jour'], ['1', '🌙 Soir']].map(([k, l]) => `<button data-a="trAmb" data-k="${k}" aria-pressed="${!!P.soir === !!k}">${l}</button>`).join('')}</div>
    <label class="tr-lumi"><span>💡 Puissance des lumières</span><input type="range" min="15" max="130" step="5" value="${P.lumi || 100}" data-input="trLumi" aria-label="Puissance des lumières"></label>
    <p class="muted sm">${can ? 'Touche un meuble pour le tourner ou l’enlever, glisse-le pour le déplacer. ' : ''}Un doigt à côté des meubles pour tourner la vue, deux doigts pour s’approcher. ⤢ plein écran, 📸 garder l’image.</p>` : ''}
    ${P.view === 'plan' ? '<div id="tr-plan-bar"></div>' : ''}
    <div class="card"><h3>Est-ce que ça tient ?</h3><div id="tr-plan-chk"></div></div>
    <div class="card"><h3>🏨 Trois niveaux d’aménagement</h3><p class="muted">Une proposition complète par budget : meubles, finitions et éclairage. Règles tenues : rien devant la fenêtre ni dans l’ouverture de la porte, 50 cm au moins autour des lits (90 cm sur un côté quand la pièce le permet), surface 3★.</p>
      <div class="group flat">${TR_NIVEAUX.map((nv) => { const a = trNiveau(roomId, nv, P.p), nb = a.p.items.filter(trIsBed).length; return `<button class="prow" ${can ? '' : 'disabled'} data-a="trNiveauGo" data-k="${nv.k}"><span class="pr-t"><b>${nv.e} ${nv.l}${P.p.niv === nv.k ? ` · en place (variante ${(P.p.nivN || 0) + 1}) · touche encore pour une autre` : ''}</b><span class="muted sm">${esc(nv.txt)}</span><span class="muted sm">${!a.bedsOk ? '⚠️ Les lits de la fiche ne rentrent pas tous. ' : ''}${a.people} couchage${a.people > 1 ? 's' : ''}${nv.lvl === 2 && nb ? (a.big ? ' · lit de 160' : ' · lit de 160 impossible ici') : ''} · ${a.pass90 ? 'passage de 90 cm ✓' : 'passage de 50 cm seulement'}${a.miss.length ? ' · pas de place pour : ' + a.miss.join(', ').toLowerCase() : ''}</span></span><span class="chev">›</span></button>`; }).join('')}</div></div>
    <div class="card"><h3>💡 Dispositions proposées</h3><p class="muted">Calculées avec la place de la porte et de la fenêtre. Touche une proposition pour la voir${can ? ' ; elle remplace les meubles du plan' : ''}.</p>
      <div class="group flat">${cfgs.map((c) => `<button class="prow" ${can ? '' : 'disabled'} data-a="trPlanCfg" data-k="${c.k}"><span class="pr-t"><b>${c.l}</b><span class="muted sm">${!c.a.bedsOk ? 'Les lits ne rentrent pas' : (!c.a.surfOk ? `Surface trop petite en 3★ (${trFr(c.a.surf)} m² pour ${trFr(c.a.need)})` : (c.a.miss.length ? 'Pas de place pour : ' + c.a.miss.join(', ').toLowerCase() : 'Tout rentre, avec bureau, armoire et télé'))}</span></span><span class="pill ${c.ok ? (c.a.miss.length ? 'p-amber' : 'p-green') : 'p-red'}">${c.ok ? (c.a.miss.length ? 'Juste' : 'Oui') : 'Non'}</span></button>`).join('')}</div></div>
    ${can ? `<div class="card"><h3>Ajouter un meuble</h3><div class="tr-eq">${Object.entries(TR_FURN).filter(([k]) => k !== 'meuble').map(([k, f]) => `<button data-a="trPlanAdd" data-k="${k}">＋ ${f.l}</button>`).join('')}</div>
      <div class="form"><label>Un meuble du catalogue IKEA<select data-change="trPlanIk">${opt('', '', S.trCat ? 'Choisir une référence…' : 'Chargement…')}${S.trCat ? TR_IK_CATS.filter((c) => c[2]).map(([c, l]) => `<optgroup label="${l}">${S.trCat.filter((x) => x.cat === c && trIkDims(x)).map((x) => opt(x.ref, '', `${x.name} · ${(x.descr || '').split(',').slice(-1)[0].trim()}${x.price != null ? ' · ' + trEur(x.price) : ''}`)).join('')}</optgroup>`).join('') : ''}</select></label></div>
      ${bank.length ? `<div class="form"><label>Ou un meuble qu’on a déjà<select data-change="trPlanBank">${opt('', '', 'Choisir dans nos meubles…')}${bank.map((i) => opt(i.id, '', `${i.label || trType(i.type)[1]} · ${i.w_cm} × ${i.d_cm} cm`)).join('')}</select></label></div>` : ''}</div>` : ''}
    ${hasSdb ? `<div class="card"><h3>🚿 Salle de bain</h3><p class="muted">Où est-elle par rapport aux mesures de la chambre ?</p>
      <div class="segc five" role="group">${[['', 'À part'], ['no', '↖ coin'], ['ne', '↗ coin'], ['so', '↙ coin'], ['se', '↘ coin']].map(([k, l]) => `<button ${can ? '' : 'disabled'} data-a="trPlanSdb" data-k="${k}" aria-pressed="${(P.p.sdb.c || '') === k}">${l}</button>`).join('')}</div>
      ${P.p.sdb.c && can ? '<button class="btn small" data-a="trPlanSdbRot">⟳ Tourner la salle de bain</button>' : ''}
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
  trFull() { const st = document.querySelector('.tr-stage'); if (!st) return; st.classList.toggle('big'); if (TR_GL.ask) { TR_GL.ask(); setTimeout(() => TR_GL.ask && TR_GL.ask(), 60); } },
  async trSnap() {
    const P = S.trP; if (!P || !TR_GL.snap) return;
    const blob = await TR_GL.snap(); if (!blob) { toast('L’image n’a pas pu être créée.'); return; }
    const r = trRoomGet(P.rid), name = `${r ? trPlace(r) : 'Chambre'} - vue 3D.jpg`.replace(/[\\/:*?"<>|]/g, ' '), file = new File([blob], name, { type: 'image/jpeg' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast('Image enregistrée ✓');
  },
  trPlanAdd(d) { const P = S.trP; if (!P || !trPlanCan()) return; const { W, D } = trWDH(trData(P.rid)); const it = { id: trPid(), t: d.k, r: 0, x: Math.round(W / 2), y: Math.round(D / 2) };
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
    P.p.items = a.p.items; P.p.cfg = d.k; P.sel = null; trPlanSave(); trPlanSheet(P.rid, true);
  },
  trPlanSdb(d) { const P = S.trP; if (!P || !trPlanCan()) return; P.p.sdb = { c: d.k, rot: !!P.p.sdb.rot }; trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanSdbRot() { const P = S.trP; if (!P || !trPlanCan()) return; P.p.sdb.rot = !P.p.sdb.rot; trPlanSave(); trPlanSheet(P.rid, true); },
  trDeco(d) { const P = S.trP; if (!P || !trPlanCan()) return; const deco = { ...(P.p.deco || {}) }; if (!d.v || deco[d.k] === d.v) delete deco[d.k]; else deco[d.k] = d.v; P.p.deco = deco; trPlanSave(); trPlanSheet(P.rid, true); },
  trDecoLum(d) { const P = S.trP; if (!P || !trPlanCan()) return; const cur = trLum(P.p.deco), lum = cur.includes(d.v) ? cur.filter((x) => x !== d.v) : [...cur, d.v]; P.p.deco = { ...(P.p.deco || {}), lum }; trPlanSave(); trPlanSheet(P.rid, true); },
  trNiveauGo(d) {
    const P = S.trP, nv = TR_NIVEAUX.find((x) => x.k === d.k); if (!P || !nv || !trPlanCan()) return;
    if (P.p.items.length && !P.p.niv && !confirm(`Remplacer les meubles et les finitions du plan par la proposition « ${nv.l} » ?`)) return;
    const n = P.p.niv === nv.k ? (P.p.nivN || 0) + 1 : 0; // un nouvel appui sur le même niveau : une autre combinaison
    const a = trNiveau(P.rid, nv, P.p, n); if (!a.p.items.length) { toast('Rien ne rentre dans cette pièce avec ces lits.'); return; }
    P.p.items = a.p.items; P.p.deco = trNivDeco(nv, n); P.p.niv = nv.k; P.p.nivN = n; if (n) toast(`${nv.l} · variante ${n + 1}`); P.p.cfg = null; P.sel = null; P.view = '3d'; trPlanSave(); trPlanSheet(P.rid, true);
  },
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
      ${S.tr.can_edit ? `<h2 class="sec">Chambres de l’Archange</h2><div class="group">${trRooms().map(row).join('')}</div>` : ''}
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
    trPatch(d.id, patch); S.trScan = null; S.trP = null; toast('Scan intégré ✓');
    trPlanSheet(d.id); S.trP.view = '3d'; trPlanSheet(d.id, true);
  },
});
Object.assign(I, { trLumi(el) { const P = S.trP; if (!P) return; P.lumi = Number(el.value) || 100; if (TR_GL.ask) TR_GL.ask(); } });
Object.assign(C, {
  trPlanIk(el) {
    const P = S.trP, c = (S.trCat || []).find((x) => x.ref === el.value), cat = c && TR_IK_CATS.find((x) => x[0] === c.cat), dm = c && trIkDims(c); if (!P || !c || !cat || !cat[2] || !dm || !trPlanCan()) return;
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
