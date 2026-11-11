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
const TR_DECO_SOL = [['chene', 'Parquet chêne clair', [0.80, 0.64, 0.46], 1], ['chenefume', 'Parquet chêne fumé', [0.55, 0.42, 0.31], 1], ['pvcgris', 'PVC gris clair', [0.76, 0.74, 0.71], 1], ['moquette', 'Moquette grise', [0.56, 0.58, 0.62], 0], ['carrelage', 'Carrelage clair', [0.86, 0.85, 0.82], 2]];
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
function trPlanOf(roomId) {
  const d = trData(roomId), { W } = trWDH(d);
  const p = d.plan ? JSON.parse(JSON.stringify(d.plan)) : {};
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
function trAuto(roomId, beds, base) {
  const d = trData(roomId), { W, D } = trWDH(d), p = { door: base.door, win: base.win, sdb: base.sdb, items: [] }, miss = [];
  const sdb = trSdbRect(d, p, W, D), winW = trNum(d.fen_w) || 120;
  const fixed = [trOpening(p.door, TR_DOOR_W, W, D, 85)]; if (sdb) fixed.push(sdb);
  const winZ = trOpening(p.win, winW, W, D, 35);
  const occ = () => [...fixed, ...p.items.filter((i) => i.t !== 'tv').map(trRect)];
  const bedExtra = (t) => t === 'lit_d' && trNum(d.lit_d_w) >= 140 ? { w: trNum(d.lit_d_w), d: trNum(d.lit_d_w) >= 160 ? 200 : 190 } : {};
  const bedW = (t) => bedExtra(t).w || TR_FURN[t].w;
  const span = (wall, o, width) => o.wall === wall ? [o.pos - width / 2, o.pos + width / 2] : null;
  const GAP = 50;
  // Une rangée de lits côte à côte, têtes contre le même mur.
  function tryRow(types) {
    let best = null;
    const orders = new Set(types).size > 1 ? [types, [...types].reverse()] : [types];
    for (const ord of orders) {
      const ws = ord.map(bedW), total = ws.reduce((a, b) => a + b, 0) + GAP * (ord.length - 1);
      for (let wall = 0; wall < 4; wall++) {
        const L = trWallLen(wall, W, D); if (total > L + 0.5) continue;
        const cs = []; for (let c = total / 2; c <= L - total / 2 + 0.01; c += 10) cs.push(c); cs.push(L - total / 2, L / 2);
        for (const c of cs) {
          let off = c - total / 2;
          const its = ord.map((t, i) => { const it = trAtWall(t, wall, off + ws[i] / 2, W, D, bedExtra(t)); off += ws[i] + GAP; return it; });
          const o = occ(); let sidesAll = 0, ok = true;
          for (const it of its) {
            const others = [...o, ...its.filter((x) => x !== it).map(trRect)];
            if (!trFree(trRect(it), others, W, D) || !trFree(trBedFoot(it, 50), o, W, D)) { ok = false; break; }
            const sides = [1, -1].filter((sg) => trFree(trBedSide(it, sg, 50), others, W, D)).length;
            if (!sides) { ok = false; break; }
            sidesAll += sides * (it.t === 'lit_d' ? 2 : 1); // un lit double mérite un passage de chaque côté
          }
          if (!ok) continue;
          let sc = -Math.abs(c - L / 2) / L * 30 + sidesAll * 6 + Math.min((wall % 2 ? W : D) - 190, 200) / 10;
          const ws2 = span(wall, p.win, winW); if (ws2 && ws2[0] < c + total / 2 && ws2[1] > c - total / 2) sc -= 35;
          if (p.door.wall === wall) sc -= 15;
          if (!best || sc > best.sc) best = { sc, its };
        }
      }
    }
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
  if (placed.length) {
    putWall('armoire', { front: 60, noWin: true, score: (it, wall, c, L) => -dist(it, doorPt) / 12 + corner(c, L, 100) });
    const desk = putWall('bureau', { front: 70, score: (it, wall, c, L) => -dist(it, winPt) / 12 + corner(c, L, 100) / 2 });
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
    putWall('bagages', { front: 50, optional: true, score: (it) => -dist(it, doorPt) / 12 });
    if (W * D >= 130000) putWall('fauteuil', { front: 45, optional: true, score: (it) => -dist(it, winPt) / 12 });
  }
  const n = beds.reduce((a, t) => a + (t === 'lit_d' ? 2 : 1), 0), need = TR_SURF3[Math.min(3, n)], s = trSurf({ ...d, plan: p });
  return { p, miss, bedsOk: placed.length === beds.length, people: n, need, surf: s.tot, surfOk: s.tot >= need * 0.9 };
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
  if (bar) bar.innerHTML = it && trCan() ? `<div class="row between"><b>${esc(trItName(it))} <span class="muted sm">${trDim(it).w} × ${trDim(it).d} cm</span></b><span class="row"><button class="btn small soft" data-a="trPlanRot">⟳ Tourner</button><button class="btn small ghost bad-t" data-a="trPlanDel">Enlever</button></span></div>` : (trCan() && P.view === 'plan' ? '<p class="muted sm">Glisse la porte (marron), la fenêtre (bleue) et les meubles à leur place. Touche un meuble pour le tourner ou l’enlever.</p>' : '');
  if (chkEl) {
    const c = trPlanCheck(P.rid, P.p), beds = P.p.items.filter(trIsBed), n = beds.reduce((a, b) => a + (b.t === 'lit_d' ? 2 : 1), 0), s = trSurf({ ...trData(P.rid), plan: P.p });
    const need = n ? TR_SURF3[Math.min(3, n)] : 0, sOk = !n || s.tot >= need * 0.9;
    chkEl.innerHTML = !P.p.items.length ? '<p class="muted">Choisis une disposition ci-dessous, ou ajoute les meubles un par un.</p>'
      : `${c.lines.length ? `<ul class="tr-gaps">${c.lines.map((l) => `<li>⚠️ ${esc(l)}</li>`).join('')}</ul>` : '<p class="banner sm c-green">Tout tient : rien ne se chevauche, la porte s’ouvre, les lits sont accessibles ✓</p>'}
        ${n ? `<p class="${sOk ? 'muted' : 'banner sm c-red'}">${n} couchage${n > 1 ? 's' : ''} · ${trFr(s.tot)} m² pour ${trFr(need)} m² demandés en 3★${sOk ? (s.tot < need ? ' (dans la tolérance)' : ' ✓') : ' : trop petit'}</p>` : ''}`;
  }
}
function trPlanSave() { const P = S.trP; if (P && trCan()) trPatch(P.rid, { plan: P.p }); }
function trPlanBind() {
  const svg = $('tr-svg'); if (!svg || !S.trP) return;
  const pt = (e) => { const m = svg.getScreenCTM(); if (!m) return [0, 0]; const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return [q.x, q.y]; };
  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    const P = S.trP, el = e.target.closest('[data-it],[data-op]');
    if (!el) { if (P.sel) { P.sel = null; trPlanDraw(); } return; }
    if (!trCan()) return;
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
  wood: [0.72, 0.56, 0.40], woodD: [0.52, 0.38, 0.26], white: [0.97, 0.96, 0.94], pillow: [1, 1, 1], duvet: [0.60, 0.69, 0.62], dark: [0.20, 0.20, 0.22],
  wall: [0.99, 0.97, 0.93], glass: [0.72, 0.87, 0.97], frame: [1, 1, 1], door: [0.62, 0.45, 0.28], lamp: [1.0, 0.90, 0.62], textile: [0.50, 0.58, 0.68], sdb: [0.88, 0.92, 0.95], metal: [0.75, 0.75, 0.78],
};
const TR_FLOOR = { parquet: [[0.80, 0.64, 0.46], 1], pvc: [[0.74, 0.70, 0.64], 1], moquette: [[0.56, 0.60, 0.68], 0], carrelage: [[0.86, 0.85, 0.82], 2], autre: [[0.78, 0.74, 0.68], 0] };
// Les pièces d'un meuble : [centre x, centre y (repère du meuble), largeur, profondeur, bas, haut, couleur], en cm.
function trParts(it, duvet) {
  const m = trDim(it), w = m.w, d = m.d, h = m.h, C = TR_COL, legs = (ix, iy, top, c) => [[-ix, -iy], [ix, -iy], [-ix, iy], [ix, iy]].map(([x, y]) => [x, y, 4, 4, 0, top, c]);
  if (trIsBed(it)) {
    const pil = it.t === 'lit_d' ? [[-w / 4, -d / 2 + 30, w / 2 - 14, 36, 50, 60, C.pillow], [w / 4, -d / 2 + 30, w / 2 - 14, 36, 50, 60, C.pillow]] : [[0, -d / 2 + 30, w - 24, 36, 50, 60, C.pillow]];
    return [[0, 0, w, d, 8, 28, C.wood], ...legs(w / 2 - 5, d / 2 - 5, 8, C.woodD), [0, 2, w - 4, d - 8, 28, 50, C.white], [0, -d / 2 + 3, w, 6, 0, 100, C.woodD], [0, d * 0.16, w - 1, d * 0.66, 50, 54, duvet || C.duvet], ...pil];
  }
  if (it.t === 'chevet') return [[0, 0, w, d, 0, h, C.wood], [0, d / 2 + 0.5, w - 8, 1, h - 18, h - 16, C.woodD], [0, 0, 6, 6, h, h + 16, C.metal], [0, 0, 18, 18, h + 16, h + 34, C.lamp]];
  if (it.t === 'bureau') return [[0, 0, w, d, h - 4, h, C.wood], ...legs(w / 2 - 4, d / 2 - 4, h - 4, C.dark)];
  if (it.t === 'chaise') return [[0, 0, w - 4, d - 4, 42, 46, C.dark], [0, -d / 2 + 4, w - 4, 4, 46, h, C.dark], ...legs(w / 2 - 5, d / 2 - 5, 42, C.dark)];
  if (it.t === 'fauteuil') return [[0, 2, w, d - 4, 12, 40, C.textile], [0, -d / 2 + 9, w, 18, 40, h, C.textile], [-w / 2 + 7, 4, 14, d - 10, 40, 58, C.textile], [w / 2 - 7, 4, 14, d - 10, 40, 58, C.textile], ...legs(w / 2 - 6, d / 2 - 6, 12, C.woodD)];
  if (it.t === 'armoire') return [[0, 0, w, d, 0, h, C.wood], [0, d / 2 + 0.4, 1.2, 0.8, 6, h - 6, C.woodD], [-6, d / 2 + 1.5, 2, 3, h / 2 - 8, h / 2 + 8, C.metal], [6, d / 2 + 1.5, 2, 3, h / 2 - 8, h / 2 + 8, C.metal]];
  if (it.t === 'tv') return [[0, 0, w, 5, 100, 100 + h, C.dark], [0, 2.8, w - 5, 0.6, 102.5, 97.5 + h, [0.10, 0.12, 0.16]]];
  if (it.t === 'bagages') return [[0, 0, w, d, 40, 44, C.wood], ...legs(w / 2 - 4, d / 2 - 4, 40, C.woodD)];
  return [[0, 0, w, d, 0, h, C.wood]];
}
function trScene(roomId, p) {
  const d = trData(roomId), { W, D, H } = trWDH(d), cm = 0.01, B = [], sh = [], walls = [];
  const box = (x0, y0, z0, x1, y1, z1, c, extra) => ({ t: [((x0 + x1) / 2 - W / 2) * cm, ((z0 + z1) / 2) * cm, ((y0 + y1) / 2 - D / 2) * cm], s: [Math.max(0.2, x1 - x0) * cm, Math.max(0.2, z1 - z0) * cm, Math.max(0.2, y1 - y0) * cm], c, ...(extra || {}) });
  const deco = p.deco || {}, dsol = trDecoOf(TR_DECO_SOL, deco.sol), fl = dsol ? [dsol[2], dsol[3]] : (TR_FLOOR[d.sol] || TR_FLOOR.parquet);
  B.push(box(-8, -8, -6, W + 8, D + 8, 0, fl[0], { stripe: fl[1] }));
  const dmur = trDecoOf(TR_DECO_MUR, deco.mur), dacc = trDecoOf(TR_DECO_ACCENT, deco.accent), bed0 = p.items.find(trIsBed);
  const accWall = dacc && dacc[2] && bed0 ? ((bed0.r || 0) / 90) % 4 : -1; // le mur d'accent est celui de la tête de lit
  const T = 8, wc = dmur ? dmur[2] : (d.murs === 'papier' ? [0.93, 0.90, 0.84] : TR_COL.wall);
  const wdef = [[-T, -T, W + T, 0, [0, -1]], [W, -T, W + T, D + T, [1, 0]], [-T, D, W + T, D + T, [0, 1]], [-T, -T, 0, D + T, [-1, 0]]];
  wdef.forEach(([x0, y0, x1, y1, n], i) => walls.push({ i, n, c: [((x0 + x1) / 2 - W / 2) * cm, ((y0 + y1) / 2 - D / 2) * cm], glass: [], boxes: [box(x0, y0, 0, x1, y1, H, i === accWall ? dacc[2] : wc)] }));
  // Fenêtre et porte : plaquées sur la face intérieure de leur mur, elles disparaissent avec lui.
  const onWall = (o, width, z0, z1, deep, c) => { const z = trOpening(o, width, W, D, deep); return box(z.x0, z.y0, z0, z.x1, z.y1, z1, c); };
  const fw = trNum(d.fen_w) || 120, fh = trNum(d.fen_h) || 120, al = trNum(d.fen_allege) || 90;
  walls[p.win.wall].boxes.push(onWall(p.win, fw + 12, al - 6, Math.min(H - 5, al + fh + 6), 2, TR_COL.frame), onWall(p.win, fw, al, Math.min(H - 11, al + fh), 3, TR_COL.glass), onWall(p.win, 3, al, Math.min(H - 11, al + fh), 3.6, TR_COL.frame));
  if (deco.rideau && deco.rideau !== 'aucun') {
    const tis = trDecoOf(TR_DECO_TISSU, deco.tissu) || TR_DECO_TISSU[0], top = Math.min(H - 4, al + fh + 20), pw = Math.max(30, fw * 0.3), wl = walls[p.win.wall];
    wl.boxes.push(onWall(p.win, fw + 2 * pw, top, top + 3, 8, TR_COL.metal));
    if (deco.rideau !== 'voilage') [-1, 1].forEach((sg) => { const z = trOpening({ wall: p.win.wall, pos: p.win.pos + sg * (fw / 2 + pw / 2 - 8) }, pw, W, D, 9); wl.boxes.push(box(z.x0, z.y0, 4, z.x1, z.y1, top, tis[2])); });
    if (deco.rideau !== 'occultant') wl.glass.push(onWall(p.win, fw + 14, 4, top, 5.5, [1, 1, 1]));
  }
  const dh = Math.min(204, H - 10);
  walls[p.door.wall].boxes.push(onWall(p.door, TR_DOOR_W + 10, 0, dh + 5, 2, TR_COL.frame), onWall(p.door, TR_DOOR_W, 0, dh, 3.2, TR_COL.door));
  const sdb = trSdbRect(d, p, W, D);
  const glass = sdb ? [box(sdb.x0, sdb.y0, 0, sdb.x1, sdb.y1, Math.min(H, 215), [0.62, 0.74, 0.86])] : [];
  const dl = trDecoOf(TR_DECO_TISSU, deco.linge), duvet = dl ? dl[2] : null;
  p.items.forEach((it) => {
    const r = trRect(it); if (it.t !== 'tv') sh.push(box(r.x0 - 3, r.y0 - 3, 0.3, r.x1 + 3, r.y1 + 3, 0.6, [0, 0, 0]));
    const dest = it.t === 'tv' ? walls[((it.r || 0) / 90) % 4].boxes : B;
    trParts(it, duvet).forEach(([lx, ly, sx, sy, z0, z1, c]) => { const q = trLocal(it, lx, ly, sx, sy); dest.push(box(q.x0, q.y0, z0, q.x1, q.y1, z1, c)); });
  });
  return { W: W * cm, D: D * cm, H: H * cm, B, sh, glass, walls, Wc: W, Dc: D, Hc: H };
}
const TR_GL = { gl: null, raf: 0, ask: null };
window.addEventListener('resize', () => { if (TR_GL.gl && TR_GL.ask) TR_GL.ask(); });
function trGlStop() { if (TR_GL.raf) cancelAnimationFrame(TR_GL.raf); TR_GL.raf = 0; if (TR_GL.gl) { const x = TR_GL.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } TR_GL.gl = null; }
function trMat(yaw, pitch, dist, ty, aspect) {
  const cp = Math.cos(pitch), eye = [dist * cp * Math.sin(yaw), ty + dist * Math.sin(pitch), dist * cp * Math.cos(yaw)], tg = [0, ty, 0];
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const f = nrm([tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]]), s = nrm(cr(f, [0, 1, 0])), u = cr(s, f);
  const V = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, eye), -dot(u, eye), dot(f, eye), 1];
  const fo = 1 / Math.tan((42 * Math.PI / 180) / 2), n = 0.1, fa = 60, Pm = [fo / aspect, 0, 0, 0, 0, fo, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0];
  const M = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) M[c * 4 + r] = Pm[r] * V[c * 4] + Pm[4 + r] * V[c * 4 + 1] + Pm[8 + r] * V[c * 4 + 2] + Pm[12 + r] * V[c * 4 + 3];
  return { M, eye };
}
function trGlStart() {
  const cv = $('tr-gl'), P = S.trP; if (!cv || !P) return;
  trGlStop();
  const gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) { const l = $('tr-lab'); if (l) l.innerHTML = '<span style="left:50%;top:50%">La 3D n’est pas disponible sur cet appareil</span>'; return; }
  TR_GL.gl = gl;
  const sc = trScene(P.rid, P.p);
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec3 p;attribute vec3 n;uniform mat4 uM;uniform vec3 uT;uniform vec3 uS;varying vec3 vN;varying vec3 vW;void main(){vec3 w=p*uS+uT;vW=w;vN=n;gl_Position=uM*vec4(w,1.0);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;uniform vec4 uC;uniform float uK;varying vec3 vN;varying vec3 vW;void main(){vec3 L=normalize(vec3(0.42,0.82,0.38));float l=0.74+0.26*max(dot(normalize(vN),L),0.0);vec3 c=uC.rgb*l;'
    + 'if(vN.y>0.5&&uK>0.5&&uK<1.5){float u=vW.x/0.14;float a=smoothstep(0.46,0.5,abs(fract(u)-0.5));float v=fract(vW.z/1.3+floor(u)*0.37);float b=smoothstep(0.985,1.0,v);c*=1.0-0.16*max(a,b);}'
    + 'if(vN.y>0.5&&uK>1.5){float a=smoothstep(0.47,0.5,abs(fract(vW.x/0.6)-0.5));float b=smoothstep(0.47,0.5,abs(fract(vW.z/0.6)-0.5));c*=1.0-0.14*max(a,b);}'
    + 'gl_FragColor=vec4(c,uC.a);}'));
  gl.linkProgram(prog); gl.useProgram(prog);
  // Cube unité : 6 faces, 4 sommets chacune, avec leur normale.
  const F = [[0, 0, 1, [-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1]], [0, 0, -1, [1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1]], [1, 0, 0, [1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1]], [-1, 0, 0, [-1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1]], [0, 1, 0, [-1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1]], [0, -1, 0, [-1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1]]];
  const vb = [], ib = [];
  F.forEach(([nx, ny, nz, q], f) => { for (let i = 0; i < 4; i++) vb.push(q[i * 3] / 2, q[i * 3 + 1] / 2, q[i * 3 + 2] / 2, nx, ny, nz); ib.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3); });
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vb), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ib), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, 'p'), aN = gl.getAttribLocation(prog, 'n');
  gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 24, 12);
  const U = {}; ['uM', 'uT', 'uS', 'uC', 'uK'].forEach((k) => U[k] = gl.getUniformLocation(prog, k));
  const cam = P.cam || (P.cam = { yaw: 0.65, pitch: 0.62, dist: Math.max(sc.W, sc.D) * 1.3 + sc.H * 0.75 + 0.9 });
  const drawBox = (b, a) => { gl.uniform3fv(U.uT, b.t); gl.uniform3fv(U.uS, b.s); gl.uniform4f(U.uC, b.c[0], b.c[1], b.c[2], a == null ? 1 : a); gl.uniform1f(U.uK, b.stripe || 0); gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0); };
  function frame() {
    TR_GL.raf = 0; if (TR_GL.gl !== gl || !cv.isConnected) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    const { M, eye } = trMat(cam.yaw, cam.pitch, cam.dist, sc.H * 0.32, w / h);
    gl.uniformMatrix4fv(U.uM, false, M);
    gl.disable(gl.BLEND); gl.depthMask(true);
    drawBox(sc.B[0]);
    // Les murs entre l'œil et la pièce s'effacent, comme une maison de poupée.
    const hidden = sc.walls.map((wl) => (eye[0] - wl.c[0]) * wl.n[0] + (eye[2] - wl.c[1]) * wl.n[1] > 0);
    sc.walls.forEach((wl, i) => { if (!hidden[i]) wl.boxes.forEach((b) => drawBox(b)); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    sc.sh.forEach((b) => drawBox(b, 0.13));
    gl.disable(gl.BLEND); gl.depthMask(true);
    for (let i = 1; i < sc.B.length; i++) drawBox(sc.B[i]);
    gl.enable(gl.BLEND); gl.depthMask(false); sc.glass.forEach((b) => drawBox(b, 0.38)); sc.walls.forEach((wl, i) => { if (!hidden[i]) wl.glass.forEach((b) => drawBox(b, 0.5)); }); gl.depthMask(true); gl.disable(gl.BLEND);
    // Cotes : longueur, largeur et hauteur, posées sur les arêtes visibles.
    const lab = $('tr-lab');
    if (lab) {
      const pr = (x, y, z) => { const cw = M[3] * x + M[7] * y + M[11] * z + M[15]; if (cw <= 0) return null; return [((M[0] * x + M[4] * y + M[8] * z + M[12]) / cw * 0.5 + 0.5) * cv.clientWidth, (1 - ((M[1] * x + M[5] * y + M[9] * z + M[13]) / cw * 0.5 + 0.5)) * cv.clientHeight]; };
      const hw = sc.W / 2, hd = sc.D / 2, out = [];
      const edge = [[0, 0.02, -hd, trM(sc.Wc)], [hw, 0.02, 0, trM(sc.Dc)], [0, 0.02, hd, trM(sc.Wc)], [-hw, 0.02, 0, trM(sc.Dc)]];
      [eye[2] > 0 ? 2 : 0, eye[0] > 0 ? 1 : 3].forEach((i) => { const q = pr(edge[i][0], edge[i][1], edge[i][2]); if (q) out.push([q, edge[i][3]]); });
      const cx = eye[0] > 0 ? -hw : hw, cz = eye[2] > 0 ? -hd : hd, q = pr(cx, sc.H / 2, cz); if (q) out.push([q, 'h ' + trM(sc.Hc)]);
      lab.innerHTML = out.map(([q2, t]) => `<span style="left:${q2[0].toFixed(1)}px;top:${q2[1].toFixed(1)}px">${t}</span>`).join('');
    }
  }
  const ask = () => { if (!TR_GL.raf) TR_GL.raf = requestAnimationFrame(frame); };
  // Un doigt pour tourner autour de la chambre, deux doigts (ou la molette) pour s'approcher.
  const pts = new Map(); let pinch = 0;
  cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); try { cv.setPointerCapture(e.pointerId); } catch (_) {} pinch = 0; e.preventDefault(); });
  cv.addEventListener('pointermove', (e) => {
    const o = pts.get(e.pointerId); if (!o) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { cam.yaw -= (e.clientX - o[0]) * 0.008; cam.pitch = Math.min(1.5, Math.max(0.12, cam.pitch + (e.clientY - o[1]) * 0.006)); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.dist = Math.min(30, Math.max(1.5, cam.dist * pinch / dd)); pinch = dd; }
    ask();
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { cam.dist = Math.min(30, Math.max(1.5, cam.dist * (e.deltaY > 0 ? 1.08 : 0.93))); e.preventDefault(); ask(); }, { passive: false });
  TR_GL.ask = ask; ask();
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
  const owins = wins.filter((w) => w.dist <= 60).sort((a, b) => b.width - a.width), win = owins[0] || null;
  const counts = {}, items = [];
  (j.objects || []).filter(okEl).forEach((o) => {
    const cat = Object.keys(o.category || {})[0] || 'autre'; counts[cat] = (counts[cat] || 0) + 1;
    let w = Math.round(o.dimensions[0] * 100), h = Math.round(o.dimensions[1] * 100), dp = Math.round(o.dimensions[2] * 100), r = (Math.round(head(o.transform) / 90) * 90) % 360;
    const [px, py] = P(o.transform[12], o.transform[14]);
    if (w < 5 || dp < 2) return;
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
  return { W, D, H, door: door ? { wall: door.wall, pos: Math.round(door.pos) } : null, win: win ? { wall: win.wall, pos: Math.round(win.pos) } : null,
    fen: win ? { w: Math.round(win.width), h: Math.round(win.height), allege: Math.max(0, Math.round(win.sill)), n: owins.length } : null,
    items, counts, nWalls: walls.length, nDoors: doors.length, nRooms: Array.isArray(j.sections) ? j.sections.length : 0 };
}
function trScanSheet(roomId) {
  const sc = S.trScan, r = S.rooms[roomId]; if (!sc || !r) { closeSheet(); return; }
  const lst = Object.entries(sc.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} × ${(TR_SCAN_FR[k] || k).toLowerCase()}`);
  openSheet('trscan', `<div class="row between"><h2>Scan lu · ${esc(placeName(r))}</h2><button class="btn small" data-a="trRoom" data-id="${esc(roomId)}">Annuler</button></div>
    <div class="card"><h3>📏 ${trM(sc.W)} × ${trM(sc.D)} · hauteur ${trM(sc.H)}</h3>
      <p class="muted">${sc.nWalls} murs, ${sc.nDoors} porte${sc.nDoors > 1 ? 's' : ''}${sc.fen ? `, ${sc.fen.n} fenêtre${sc.fen.n > 1 ? 's' : ''} (la plus grande : ${sc.fen.w} × ${sc.fen.h} cm, à ${sc.fen.allege} cm du sol)` : ', pas de fenêtre vue'}.</p>
      ${lst.length ? `<p><b>Reconnu :</b> ${esc(lst.join(', '))}.</p>` : '<p class="muted">Aucun meuble reconnu dans ce scan.</p>'}
      ${sc.nWalls > 4 || sc.nRooms > 1 ? '<p class="banner sm c-slate">Le scan compte plus de 4 murs : la pièce est ramenée au rectangle qui l’entoure. Si elle a un recoin ou contient la salle de bain, la surface réelle est un peu plus petite ; corrige-la dans la fiche.</p>' : ''}</div>
    <p class="muted">Les mesures de la fiche, la fenêtre et le plan de cette chambre seront remplacés par le scan. Les photos, l’état et les notes ne bougent pas.</p>
    <button class="btn big pri" data-a="trScanApply" data-id="${esc(roomId)}">Utiliser ce scan</button>`);
}

/* ---------- l'écran « Plan et 3D » d'une chambre ---------- */
function trDecoCard(roomId) {
  const P = S.trP, deco = P.p.deco || {}, can = trCan(), q = trDecoQty(roomId, P.p), lines = trDecoLines(roomId, P.p);
  const sw = (key, list, cur) => `<div class="tr-sws">${list.map(([k, l, c]) => `<button class="tr-sw" ${can ? '' : 'disabled'} data-a="trDeco" data-k="${key}" data-v="${k}" aria-pressed="${(cur || '') === k}">${c ? `<i style="background:${trCss(c)}"></i>` : ''}${l}</button>`).join('')}</div>`;
  return `<div class="card"><h3>🎨 Finitions du projet</h3><p class="muted">Choisis, puis regarde le résultat en vue 3D. Rien n’est acheté tant que ce n’est pas dans la liste.</p>
    <p class="tr-cap">Murs · ${trFr(q.murs)} m²</p>${sw('mur', TR_DECO_MUR, deco.mur)}
    <p class="tr-cap">Mur de la tête de lit${q.accent ? ` · ${trFr(q.accent)} m²` : ''}</p>${sw('accent', TR_DECO_ACCENT, deco.accent)}
    <p class="tr-cap">Sol · ${trFr(q.sol)} m²</p>${sw('sol', TR_DECO_SOL, deco.sol)}
    <p class="tr-cap">Rideaux · fenêtre de ${trNum(trData(roomId).fen_w) || 120} cm</p>${sw('rideau', TR_DECO_RIDEAU, deco.rideau || 'aucun')}
    ${deco.rideau && deco.rideau !== 'aucun' && deco.rideau !== 'voilage' ? `<p class="tr-cap">Tissu des rideaux</p>${sw('tissu', TR_DECO_TISSU, deco.tissu || 'lin')}` : ''}
    <p class="tr-cap">Dessus de lit</p>${sw('linge', TR_DECO_TISSU, deco.linge)}
    ${lines.length ? `<p class="tr-cap">À prévoir</p><ul class="tr-gaps">${lines.map((l) => `<li>${l.qty > 1 ? l.qty + ' × ' : ''}${esc(l.label)}${l.note ? ` <span class="muted sm">· ${esc(l.note)}</span>` : ''}</li>`).join('')}</ul>${can ? '<button class="btn small soft" data-a="trDecoList">＋ Mettre ces finitions dans la liste</button>' : ''}` : ''}</div>`;
}
function trPlanSheet(roomId, keep) {
  const r = S.rooms[roomId], d = trData(roomId); if (!r || !S.tr || !trHasPlan(d)) { closeSheet(); return; }
  const { W, D } = trWDH(d);
  if (!keep || !S.trP || S.trP.rid !== roomId) S.trP = { rid: roomId, view: (S.trP && S.trP.rid === roomId && S.trP.view) || 'plan', sel: null, p: trPlanOf(roomId), cam: null };
  const P = S.trP, can = trCan(), hasSdb = trNum(d.sdb_len) && trNum(d.sdb_wid), fs = Math.max(11, Math.round(Math.max(W, D) / 26)), pad = fs * 2.2;
  const cfgs = TR_CFG.map(([k, l, beds]) => { const a = trAuto(roomId, beds, P.p); return { k, l, a, ok: a.bedsOk && a.surfOk }; });
  const bank = S.tr.items.filter((i) => i.etat !== 'a_jeter' && i.w_cm && i.d_cm);
  trGlStop();
  openSheet('trplan:' + roomId, `<div class="row between"><h2>${esc(placeName(r))} · ${trM(W)} × ${trM(D)}</h2><button class="btn small" data-a="trRoom" data-id="${esc(roomId)}">‹ Fiche</button></div>
    <div class="segc" role="group"><button data-a="trPlanView" data-k="plan" aria-pressed="${P.view === 'plan'}">Plan</button><button data-a="trPlanView" data-k="3d" aria-pressed="${P.view === '3d'}">Vue 3D</button></div>
    <div class="tr-stage">${P.view === 'plan'
      ? `<svg id="tr-svg" viewBox="${-pad} ${-pad} ${W + pad * 1.4} ${D + pad * 1.4}" preserveAspectRatio="xMidYMid meet"><g id="tr-plan-g"></g></svg>`
      : '<div class="tr-3d"><canvas id="tr-gl"></canvas><div id="tr-lab"></div></div>'}</div>
    ${P.view === '3d' ? '<p class="muted sm">Un doigt pour tourner autour de la chambre, deux doigts pour s’approcher.</p>' : ''}
    <div id="tr-plan-bar"></div>
    <div class="card"><h3>Est-ce que ça tient ?</h3><div id="tr-plan-chk"></div></div>
    <div class="card"><h3>💡 Dispositions proposées</h3><p class="muted">Calculées avec la place de la porte et de la fenêtre. Touche une proposition pour la voir${can ? ' ; elle remplace les meubles du plan' : ''}.</p>
      <div class="group flat">${cfgs.map((c) => `<button class="prow" ${can ? '' : 'disabled'} data-a="trPlanCfg" data-k="${c.k}"><span class="pr-t"><b>${c.l}</b><span class="muted sm">${!c.a.bedsOk ? 'Les lits ne rentrent pas' : (!c.a.surfOk ? `Surface trop petite en 3★ (${trFr(c.a.surf)} m² pour ${trFr(c.a.need)})` : (c.a.miss.length ? 'Pas de place pour : ' + c.a.miss.join(', ').toLowerCase() : 'Tout rentre, avec bureau, armoire et télé'))}</span></span><span class="pill ${c.ok ? (c.a.miss.length ? 'p-amber' : 'p-green') : 'p-red'}">${c.ok ? (c.a.miss.length ? 'Juste' : 'Oui') : 'Non'}</span></button>`).join('')}</div></div>
    ${can ? `<div class="card"><h3>Ajouter un meuble</h3><div class="tr-eq">${Object.entries(TR_FURN).filter(([k]) => k !== 'meuble').map(([k, f]) => `<button data-a="trPlanAdd" data-k="${k}">＋ ${f.l}</button>`).join('')}</div>
      ${bank.length ? `<div class="form"><label>Ou un meuble qu’on a déjà<select data-change="trPlanBank">${opt('', '', 'Choisir dans nos meubles…')}${bank.map((i) => opt(i.id, '', `${i.label || trType(i.type)[1]} · ${i.w_cm} × ${i.d_cm} cm`)).join('')}</select></label></div>` : ''}</div>` : ''}
    ${hasSdb ? `<div class="card"><h3>🚿 Salle de bain</h3><p class="muted">Où est-elle par rapport aux mesures de la chambre ?</p>
      <div class="segc five" role="group">${[['', 'À part'], ['no', '↖ coin'], ['ne', '↗ coin'], ['so', '↙ coin'], ['se', '↘ coin']].map(([k, l]) => `<button ${can ? '' : 'disabled'} data-a="trPlanSdb" data-k="${k}" aria-pressed="${(P.p.sdb.c || '') === k}">${l}</button>`).join('')}</div>
      ${P.p.sdb.c && can ? '<button class="btn small" data-a="trPlanSdbRot">⟳ Tourner la salle de bain</button>' : ''}
      <p class="muted sm">${P.p.sdb.c ? 'Dans un coin : elle est comprise dans la longueur × largeur de la chambre.' : 'À part : sa surface s’ajoute à celle de la chambre.'}</p></div>` : ''}
    ${trDecoCard(roomId)}
    ${can && P.p.items.length ? '<button class="btn ghost bad-t" data-a="trPlanClear">Vider le plan</button>' : ''}`, 'trfull');
  if (P.view === 'plan') { trPlanBind(); trPlanDraw(); } else { trPlanBar(); trGlStart(); }
}
Object.assign(A, {
  trPlan(d) { trPlanSheet(d.id); },
  trPlanView(d) { if (!S.trP) return; S.trP.view = d.k; S.trP.sel = null; trPlanSheet(S.trP.rid, true); },
  trPlanAdd(d) { const P = S.trP; if (!P || !trCan()) return; const { W, D } = trWDH(trData(P.rid)); const it = { id: trPid(), t: d.k, r: 0, x: Math.round(W / 2), y: Math.round(D / 2) }; if (d.k === 'tv') Object.assign(it, trAtWall('tv', 0, W / 2, W, D), { id: it.id }); P.p.items.push(it); P.sel = it.id; trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanRot() { const P = S.trP; if (!P) return; const it = P.p.items.find((i) => i.id === P.sel); if (!it || it.t === 'tv') return; it.r = ((it.r || 0) + 90) % 360; { const { W, D } = trWDH(trData(P.rid)), r = trRect(it), hw = (r.x1 - r.x0) / 2, hh = (r.y1 - r.y0) / 2; it.x = 2 * hw >= W ? W / 2 : Math.min(W - hw, Math.max(hw, it.x)); it.y = 2 * hh >= D ? D / 2 : Math.min(D - hh, Math.max(hh, it.y)); } trPlanSave(); if (P.view === 'plan') trPlanDraw(); else trPlanSheet(P.rid, true); },
  trPlanDel() { const P = S.trP; if (!P) return; P.p.items = P.p.items.filter((i) => i.id !== P.sel); P.sel = null; trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanClear() { const P = S.trP; if (!P || !confirm('Enlever tous les meubles du plan ?')) return; P.p.items = []; P.p.cfg = null; P.sel = null; trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanCfg(d) {
    const P = S.trP, c = TR_CFG.find((x) => x[0] === d.k); if (!P || !c || !trCan()) return;
    if (P.p.items.length && !confirm('Remplacer les meubles du plan par cette proposition ?')) return;
    const a = trAuto(P.rid, c[2], P.p); if (!a.p.items.length) { toast('Rien ne rentre dans cette disposition.'); return; }
    P.p.items = a.p.items; P.p.cfg = d.k; P.sel = null; trPlanSave(); trPlanSheet(P.rid, true);
  },
  trPlanSdb(d) { const P = S.trP; if (!P || !trCan()) return; P.p.sdb = { c: d.k, rot: !!P.p.sdb.rot }; trPlanSave(); trPlanSheet(P.rid, true); },
  trPlanSdbRot() { const P = S.trP; if (!P || !trCan()) return; P.p.sdb.rot = !P.p.sdb.rot; trPlanSave(); trPlanSheet(P.rid, true); },
  trDeco(d) { const P = S.trP; if (!P || !trCan()) return; const deco = { ...(P.p.deco || {}) }; if (!d.v || deco[d.k] === d.v) delete deco[d.k]; else deco[d.k] = d.v; P.p.deco = deco; trPlanSave(); trPlanSheet(P.rid, true); },
  async trDecoList() {
    const P = S.trP; if (!P || !trCan()) return; const lines = trDecoLines(P.rid, P.p); if (!lines.length) return;
    const have = (l) => S.tr.todo.some((t) => t.room_id === P.rid && t.statut !== 'fait' && t.label === l);
    let n = 0;
    try { for (const l of lines) { if (have(l.label)) continue; const x = await api('tr_todo_save', { kind: 'achat', label: l.label, qty: l.qty, room_id: P.rid, niveau: 'confort', note: l.note }); S.tr.todo.push(x.todo); n++; } }
    catch (e) { toast(errMsg(e)); return; }
    toast(n ? `${n} ligne${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} à la liste ✓` : 'Déjà dans la liste');
  },
  async trScanPick(d) {
    if (!trCan()) return;
    const f = await pickFile('.json,application/json,text/plain'); if (!f) return;
    try { S.trScan = trScanParse(JSON.parse(await f.text())); }
    catch (e) { toast('Ce fichier n’est pas un scan lisible. Dans OpenPlan3D : Export → Editable Plan (JSON).', 7000); return; }
    trScanSheet(d.id);
  },
  trScanApply(d) {
    const sc = S.trScan; if (!sc || !trCan()) return;
    const old = trPlanOf(d.id), plan = { items: sc.items, door: sc.door || old.door, win: sc.win || old.win, sdb: { c: '' }, deco: old.deco };
    if (!sc.door) plan.door = { wall: 2, pos: Math.min(sc.W - TR_DOOR_W / 2, 75) }; if (!sc.win) plan.win = { wall: 0, pos: sc.W / 2 };
    const patch = { len: sc.W, wid: sc.D, hei: sc.H, surf: null, plan, scan_at: new Date().toISOString() };
    if (sc.fen) Object.assign(patch, { fen_w: sc.fen.w, fen_h: sc.fen.h, fen_allege: sc.fen.allege, fen_n: sc.fen.n });
    trPatch(d.id, patch); S.trScan = null; S.trP = null; toast('Scan intégré ✓');
    trPlanSheet(d.id); S.trP.view = '3d'; trPlanSheet(d.id, true);
  },
});
Object.assign(C, {
  trPlanBank(el) {
    const P = S.trP, b = S.tr.items.find((i) => i.id === el.value); if (!P || !b || !trCan()) return;
    const { W, D } = trWDH(trData(P.rid)), t = TR_BANK_MAP[b.type] || 'meuble';
    const it = { id: trPid(), t, r: 0, x: Math.round(W / 2), y: Math.round(D / 2), w: b.w_cm, d: b.d_cm, n: b.label || trType(b.type)[1], bank: b.id }; if (b.h_cm) it.h = b.h_cm;
    if (t === 'tv') { delete it.d; Object.assign(it, trAtWall('tv', 0, W / 2, W, D, { w: b.w_cm }), { id: it.id }); }
    P.p.items.push(it); P.sel = it.id; trPlanSave(); trPlanSheet(P.rid, true);
  },
});
