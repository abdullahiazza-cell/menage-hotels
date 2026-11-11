"use strict";
/* Ma Réception — mode travaux (Hôtel Archange d'abord).
   Un écran à part : on y répertorie chaque chambre (état, mesures, photos, équipements), les meubles déjà là,
   et on en tire la liste des actions et des courses. Chargé après app.js, dont il réutilise les outils. */

const TR_HOTEL = 'arc';
const TR_ETAT = {
  ok: { l: 'Louable', long: 'Louable telle quelle', c: 'p-green' }, petits: { l: 'Petits travaux', long: 'Petits travaux', c: 'p-amber' },
  gros: { l: 'Gros travaux', long: 'Gros travaux', c: 'p-red' }, bloquee: { l: 'Bloquée', long: 'Bloquée', c: 'p-slate' },
};
const TR_CAT = { top: 'Top', std: 'Standard', eco: 'Éco' };
const TR_SHOTS = ['Vue d’ensemble', 'Lit', 'Fenêtre', 'Salle de bain', 'Sol'];
const TR_SHOTS_COMMUN = ['Vue d’ensemble', 'Sol', 'Murs', 'Plafond'];
const TR_ETAGES = [['0', 'Rez-de-chaussée'], ['1', '1er étage'], ['2', '2e étage'], ['3', '3e étage'], ['4', '4e étage']];
const TR_USURE = [['bon', 'Bon état'], ['rafraichir', 'À rafraîchir'], ['refaire', 'À refaire']];
const TR_SOLS = [['pvc', 'PVC / lino'], ['moquette', 'Moquette'], ['parquet', 'Parquet / stratifié'], ['carrelage', 'Carrelage'], ['autre', 'Autre']];
const TR_MURS = [['peinture', 'Peinture'], ['papier', 'Papier peint'], ['toile', 'Toile de verre'], ['lambris', 'Lambris'], ['autre', 'Autre']];
const TR_RIDEAUX = [['aucun', 'Rien'], ['voilage', 'Voilage seul'], ['rideaux', 'Rideaux non occultants'], ['occultant', 'Rideaux occultants'], ['volets', 'Volets'], ['store', 'Store']];
const TR_SDB = [['douche', 'Douche'], ['baignoire', 'Baignoire'], ['aucune', 'Pas de salle de bain']];
// Repères du classement hôtelier 3 étoiles (grille Atout France). La grille officielle fait foi.
const TR_EQ = [
  ['bureau', 'Table ou bureau'], ['assise', 'Chaise'], ['fauteuil', 'Fauteuil ou banquette'], ['penderie', 'Penderie + 6 cintres'], ['rangement', 'Rangement à plat'],
  ['miroir', 'Miroir'], ['miroir_pied', 'Miroir en pied'], ['tv', 'TV écran plat'], ['chevet_lum', 'Lampe de chevet par personne'], ['prise', 'Prise libre près du lit'],
  ['occultation', 'Rideaux ou volets occultants'], ['seche', 'Sèche-cheveux'], ['bagages', 'Porte-bagages'], ['corbeille', 'Corbeille'], ['bouilloire', 'Bouilloire, plateau d’accueil'],
  ['tablette', 'Tablette de salle de bain'], ['porte_serv', 'Porte-serviettes'], ['produits', 'Produits d’accueil'],
];
const TR_SURF3 = { 1: 11.5, 2: 13.5, 3: 14.5 }; // m², sanitaires compris, selon le nombre de personnes
const TR_GUIDE = 'https://www.classement.atout-france.fr/documents/20142/395209/guide_de_controle_H.pdf';
const TR_TYPES = [['lit_simple', 'Lit simple', '🛏️'], ['lit_double', 'Lit double', '🛏️'], ['matelas', 'Matelas', '🟦'], ['sommier', 'Sommier', '🟫'], ['bureau', 'Bureau, table', '🪵'], ['chaise', 'Chaise', '🪑'], ['fauteuil', 'Fauteuil', '🛋️'],
  ['armoire', 'Armoire, penderie', '🚪'], ['chevet', 'Chevet', '🗄️'], ['tv', 'Télévision', '📺'], ['miroir', 'Miroir', '🪞'], ['rideaux', 'Rideaux', '🪟'], ['luminaire', 'Luminaire', '💡'], ['autre', 'Autre', '📦']];
const TR_IETAT = { bon: { l: 'Bon état', c: 'p-green' }, moyen: { l: 'Moyen', c: 'p-amber' }, a_jeter: { l: 'À jeter', c: 'p-red' } };
const TR_NIV = { essentiel: { l: 'Essentiel', c: 'p-red' }, confort: { l: 'Confort', c: 'p-amber' }, plus: { l: 'Plus tard', c: 'p-slate' } };
const TR_TST = { a_faire: { l: 'À faire', c: 'p-amber' }, commande: { l: 'En cours', c: 'p-slate' }, fait: { l: 'Fait', c: 'p-green' } };

S.mode = null; S.tr = null; S.trTab = 'chambres'; S.trUrls = {}; S.trNiv = 'tout'; S.trForm = null; S.trDone = false;

/* ---------- données ---------- */
const trCan = () => !!(S.tr && S.tr.can_edit && S.me && !S.me.readonly);
const trRooms = () => roomsOf(TR_HOTEL);
const trCommuns = () => communsOf(TR_HOTEL);
const trData = (rid) => (S.tr && S.tr.rooms[rid] && S.tr.rooms[rid].data) || {};
const trPhotosOf = (rid) => S.tr.photos.filter((p) => p.room_id === rid);
const trItemPhotos = (id) => S.tr.photos.filter((p) => p.item_id === id);
const trUrl = (p) => p ? (S.localUrls[p] || S.trUrls[p] || null) : null;
const trNum = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const trFr = (n, d) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d == null ? 1 : d });
const trEur = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 }) + ' €';
const trRoomName = (rid) => { const r = S.rooms[rid]; return r ? placeName(r) : 'Tout l’hôtel'; };

// Modifications pas encore parties (pas de réseau dans un couloir) : gardées sur le téléphone et renvoyées dès que possible.
const trPend = LS.get('mh-trq', []);
let trFlushing = false;
function trApply(data, patch) { const o = { ...data }; for (const [k, v] of Object.entries(patch)) { if (v === null || v === '') delete o[k]; else o[k] = v; } return o; }
function trSaveMark() { const el = $('tr-save'); if (el) el.textContent = trPend.length ? (navigator.onLine === false ? 'Hors connexion : gardé sur le téléphone, envoyé dès que possible' : 'Enregistrement…') : 'Enregistré ✓'; }
async function trFlush() {
  if (trFlushing) return; trFlushing = true;
  try {
    while (trPend.length) {
      const p = trPend[0];
      try { await api('tr_room_patch', { room_id: p.rid, patch: p.patch }); }
      catch (e) { if (e.code === 'net') break; toast('Une modification n’a pas pu être enregistrée. ' + errMsg(e)); }
      trPend.shift(); LS.set('mh-trq', trPend);
    }
  } finally { trFlushing = false; trSaveMark(); }
}
function trPatch(rid, patch) {
  if (!trCan()) return;
  const r = S.tr.rooms[rid] || (S.tr.rooms[rid] = { room_id: rid, data: {} });
  r.data = trApply(r.data || {}, patch); r.updated_label = S.me.label; r.updated_at = new Date().toISOString();
  trPend.push({ rid, patch }); LS.set('mh-trq', trPend); trSaveMark(); trFlush();
}
async function trLoad(silent) {
  try {
    const d = await api('tr_state');
    const rooms = {}; (d.rooms || []).forEach((r) => rooms[r.room_id] = r);
    trPend.forEach((p) => { const r = rooms[p.rid] || (rooms[p.rid] = { room_id: p.rid, data: {} }); r.data = trApply(r.data || {}, p.patch); });
    S.tr = { loaded: true, rooms, photos: d.photos || [], items: d.items || [], todo: d.todo || [], props: d.props || [], can_edit: !!d.can_edit };
    Object.assign(S.trUrls, d.urls || {});
  } catch (e) {
    if (!S.tr) S.tr = { loaded: false, err: errMsg(e), rooms: {}, photos: [], items: [], todo: [], props: [], can_edit: false };
    if (!silent) toast(errMsg(e));
  }
  if (S.mode === 'travaux') softRender();
  if (trPend.length) trFlush();
}
setInterval(() => {
  if (trPend.length) trFlush();
  if (S.mode === 'travaux' && document.visibilityState === 'visible' && !S.sheet && !isTyping() && !trPend.length) trLoad(true);
}, 30000);
window.addEventListener('online', () => { if (trPend.length) trFlush(); });

/* ---------- calculs ---------- */
function trSurf(d) {
  const ch = d.surf ? trNum(d.surf) : (trNum(d.len) * trNum(d.wid)) / 10000;
  const sdb = (trNum(d.sdb_len) * trNum(d.sdb_wid)) / 10000;
  return { ch, sdb, tot: ch + sdb, vol: ch && trNum(d.hei) ? (ch * trNum(d.hei)) / 100 : 0 };
}
const trPeople = (d) => trNum(d.lits_s) + 2 * trNum(d.lits_d);
// Nombre de personnes que la surface permet en 3 étoiles ; « tol » = avec la tolérance de 10 % (admise pour 20 % des chambres au plus).
function trCap3(tot) {
  const f = (k) => tot >= TR_SURF3[3] * k ? 3 : tot >= TR_SURF3[2] * k ? 2 : tot >= TR_SURF3[1] * k ? 1 : 0;
  return { plein: f(1), tol: f(0.9) };
}
const trMeasured = (d) => !!((d.surf || (d.len && d.wid)) && d.hei);
function trComplete(rid) { const d = trData(rid); return !!(d.etat && trMeasured(d) && trPhotosOf(rid).length); }
// Ce qui sépare la chambre du niveau 3 étoiles, d'après ce qui est saisi dans la fiche.
function trGaps(rid) {
  const d = trData(rid), out = [], s = trSurf(d), n = trPeople(d);
  if (s.ch && n >= 1) {
    const need = TR_SURF3[Math.min(3, n)];
    if (s.tot < need * 0.9) out.push({ k: 'surface', t: `Surface trop petite pour ${n} personne${n > 1 ? 's' : ''} : ${trFr(s.tot)} m² pour ${trFr(need)} m² demandés` });
    else if (s.tot < need) out.push({ k: 'surface_tol', t: `Surface un peu juste pour ${n} personne${n > 1 ? 's' : ''} (${trFr(s.tot)} m² pour ${trFr(need)}) : admise seulement pour 1 chambre sur 5` });
  }
  if (d.cap_pv && n > Number(d.cap_pv)) out.push({ k: 'cap', t: `${n} couchages pour ${d.cap_pv} personne${Number(d.cap_pv) > 1 ? 's' : ''} admise${Number(d.cap_pv) > 1 ? 's' : ''} par la commission : retirer un couchage` });
  if (s.sdb && s.sdb < 1.5) out.push({ k: 'sdb', t: `Salle de bain de ${trFr(s.sdb)} m² : 1,5 m² demandés` });
  if (d.hei && trNum(d.hei) < 180) out.push({ k: 'hauteur', t: 'Hauteur sous plafond inférieure à 1,80 m' });
  if (d.lit_d_w && trNum(d.lit_d_w) < 140) out.push({ k: 'lit', t: 'Lit double de moins de 140 cm de large' });
  if (d.sol_etat === 'refaire') out.push({ k: 'sol', t: 'Sol à refaire' });
  if (d.murs_etat === 'refaire') out.push({ k: 'murs', t: 'Murs à refaire' });
  if (d.sdb_etat === 'refaire') out.push({ k: 'sdb_etat', t: 'Salle de bain à refaire' });
  if (d.eq) TR_EQ.forEach(([k, l]) => { if (!d.eq[k]) out.push({ k: 'eq:' + k, eq: k, t: l }); });
  return out;
}

/* ---------- écran principal ---------- */
function trButton() { return `<button class="ptbtn" data-a="trEnter" aria-label="Mode travaux">🛠️</button>`; }
function viewTravaux() {
  const T = S.tr;
  const right = T && T.loaded && trCan() && (S.trTab === 'meubles' || S.trTab === 'liste') ? `<button class="nb-act" data-a="${S.trTab === 'meubles' ? 'trItemNew' : 'trTodoNew'}" aria-label="Ajouter">${ico('plus')}</button>` : '';
  const head = `<header class="navbar"><button class="nb-back" data-a="trExit">${ico('back')}<span>Réception</span></button><h1 class="nb-title">🛠️ Travaux · Archange</h1><div class="nb-right">${right}</div></header>`;
  if (!T || !T.loaded) return `${head}<div class="wrap"><div class="card empty"><div class="e">${T && T.err ? '📶' : '🛠️'}</div><h2>${T && T.err ? 'Pas de connexion' : 'Chargement…'}</h2>${T && T.err ? `<p>${esc(T.err)}</p><button class="btn pri" data-a="trReload">Réessayer</button>` : ''}</div></div>`;
  const tabs = [['chambres', 'Chambres'], ['meubles', 'Meubles'], ['liste', 'Liste'], ['idees', 'Idées']];
  const nProp = T.props.filter((p) => p.statut === 'proposee').length;
  const body = S.trTab === 'meubles' ? trViewItems() : S.trTab === 'liste' ? trViewListe() : S.trTab === 'idees' ? trViewIdees() : trViewRooms();
  return `${head}<div class="wrap">
    ${trCan() ? '' : '<div class="robar">👁 <span><b>Lecture seule</b> · vous voyez tout l’avancement. Seuls Abdullah et l’intendant modifient.</span></div>'}
    <div class="segc four" role="group" aria-label="Rubrique">${tabs.map(([k, l]) => `<button data-a="trTab" data-k="${k}" aria-pressed="${S.trTab === k}">${l}${k === 'idees' && nProp ? ` <span class="badge sm">${nProp}</span>` : ''}</button>`).join('')}</div>
    ${body}</div>`;
}
function trRoomRow(r) {
  const d = trData(r.id), s = trSurf(d), n = trPhotosOf(r.id).length, e = TR_ETAT[d.etat], people = trPeople(d);
  const bits = [];
  if (s.tot) bits.push(trFr(s.tot) + ' m²');
  if (!isCommun(r) && people) bits.push(people + ' couchage' + (people > 1 ? 's' : ''));
  if (d.cat && TR_CAT[d.cat]) bits.push(TR_CAT[d.cat]);
  const miss = [];
  if (!d.etat) miss.push('état'); if (!trMeasured(d)) miss.push('mesures'); if (!n) miss.push('photos');
  return `<button class="prow" data-a="trRoom" data-id="${esc(r.id)}"><span class="pr-t"><b>${esc(placeName(r))}</b>
    <span class="muted sm">${bits.length ? esc(bits.join(' · ')) : ''}${miss.length ? `${bits.length ? ' · ' : ''}reste : ${miss.join(', ')}` : (bits.length ? '' : 'Fiche complète')}</span></span>
    ${n ? `<span class="pill p-plain">📷 ${n}</span>` : ''}${e ? `<span class="pill ${e.c}">${e.l}</span>` : ''}${trComplete(r.id) ? '<span class="pill p-green">✓</span>' : ''}<span class="chev">›</span></button>`;
}
function trViewRooms() {
  const rooms = trRooms(), communs = trCommuns(), done = rooms.filter((r) => trComplete(r.id)).length;
  const ok = rooms.filter((r) => trData(r.id).etat === 'ok').length, petits = rooms.filter((r) => trData(r.id).etat === 'petits').length;
  const next = rooms.find((r) => !trComplete(r.id));
  return `<div class="card"><div class="row between"><h3>${done} / ${rooms.length} chambres répertoriées</h3><span class="muted sm">${ok} louable${ok > 1 ? 's' : ''} · ${petits} avec petits travaux</span></div>
      <div class="prog"><i style="width:${rooms.length ? Math.round((done / rooms.length) * 100) : 0}%"></i></div>
      <p class="muted">Une fiche est complète avec l’état, les mesures et au moins une photo.</p>
      ${next && trCan() ? `<button class="btn soft" data-a="trRoom" data-id="${esc(next.id)}">Continuer : ${esc(placeName(next))} ›</button>` : ''}</div>
    <h2 class="sec">Chambres</h2><div class="group">${rooms.map(trRoomRow).join('')}</div>
    ${communs.length ? `<h2 class="sec">Parties communes</h2><div class="group">${communs.map(trRoomRow).join('')}</div>` : ''}`;
}

/* ---------- fiche d'une chambre ---------- */
const trDis = () => trCan() ? '' : 'disabled';
const trIn = (rid, k, label, d, o) => { o = o || {}; return `<label>${label}<input ${trDis()} ${o.text ? '' : 'inputmode="decimal"'} data-change="trF" data-rid="${esc(rid)}" data-k="${k}" data-t="${o.text ? 's' : 'n'}" ${o.cm ? 'data-cm="1"' : ''} value="${esc(d[k] == null ? '' : d[k])}" placeholder="${esc(o.ph || '')}"></label>`; };
const trSel = (rid, k, label, d, opts) => `<label>${label}<select ${trDis()} data-change="trF" data-rid="${esc(rid)}" data-k="${k}" data-t="s">${opt('', d[k] || '', '—')}${opts.map(([v, l]) => opt(v, d[k], l)).join('')}</select></label>`;
const trSeg = (rid, k, d, entries, cls) => `<div class="segc ${cls || ''}" role="group">${entries.map(([v, l]) => `<button ${trDis()} data-a="trSet" data-rid="${esc(rid)}" data-k="${k}" data-v="${v}" aria-pressed="${d[k] === v}">${l}</button>`).join('')}</div>`;
function trSurfHtml(rid) {
  const d = trData(rid), s = trSurf(d), r = S.rooms[rid];
  if (!s.ch) return '<span class="muted">Entre la longueur et la largeur : la surface se calcule toute seule.</span>';
  const cap = trCap3(s.tot);
  let v = '';
  if (r && !isCommun(r)) {
    v = cap.plein ? `En 3★ : jusqu’à ${cap.plein} personne${cap.plein > 1 ? 's' : ''}` : (cap.tol ? `En 3★ : ${cap.tol} personne${cap.tol > 1 ? 's' : ''}, avec la tolérance de 10 %` : 'Trop petite pour le 3★ (11,5 m² demandés pour 1 personne)');
    if (cap.plein && cap.tol > cap.plein) v += ` (${cap.tol} avec la tolérance de 10 %)`;
  }
  return `<b>${trFr(s.tot)} m²</b>${s.sdb ? ` <span class="sm">= chambre ${trFr(s.ch)} + salle de bain ${trFr(s.sdb)}</span>` : ''}${s.vol ? ` · ${trFr(s.vol, 0)} m³` : ''}${v ? `<br><span class="sm">${v}</span>` : ''}`;
}
function trGapsHtml(rid) {
  const d = trData(rid), g = trGaps(rid);
  if (!d.eq && !g.length) return '<p class="muted">Coche les équipements présents : ce qui manque s’affichera ici.</p>';
  if (!g.length) return '<p class="banner sm c-green">Rien ne manque d’après la fiche ✓</p>';
  return `<ul class="tr-gaps">${g.map((x) => `<li>${esc(x.t)}</li>`).join('')}</ul>`;
}
function trLive(rid) { const a = $('tr-surf'); if (a) a.innerHTML = trSurfHtml(rid); const b = $('tr-gaps'); if (b) b.innerHTML = trGapsHtml(rid); }
function trShots(rid, slots) {
  const ph = trPhotosOf(rid), used = new Set();
  const shot = (p, l) => { const u = trUrl(p.path); return `<button class="shot done" data-a="trZoom" data-id="${p.id}">${u ? `<img alt="" src="${esc(u)}" loading="lazy">` : ''}<span class="lbl">${esc(l)}</span></button>`; };
  let h = slots.map((l) => {
    const p = [...ph].reverse().find((x) => x.label === l && !used.has(x.id));
    if (p) { used.add(p.id); return shot(p, l); }
    return `<button class="shot" ${trDis()} data-a="trShot" data-rid="${esc(rid)}" data-l="${esc(l)}"><span class="cam">📷</span><span>${esc(l)}</span></button>`;
  }).join('');
  h += ph.filter((p) => !used.has(p.id)).map((p) => shot(p, p.label || 'Autre')).join('');
  if (trCan()) h += `<button class="shot" data-a="trShot" data-rid="${esc(rid)}" data-l="Autre"><span class="cam">➕</span><span>Autre photo</span></button>`;
  return `<div class="shots">${h}</div>`;
}
function trRoomSheet(rid) {
  const r = S.rooms[rid]; if (!r || !S.tr) { closeSheet(); return; }
  const d = trData(rid), row = S.tr.rooms[rid], commun = isCommun(r), eq = d.eq || {};
  const todo = S.tr.todo.filter((t) => t.room_id === rid && t.statut !== 'fait');
  const props = S.tr.props.filter((p) => p.room_id === rid && p.statut !== 'ecartee');
  openSheet('trroom:' + rid, `<div class="row between"><h2>${esc(placeName(r))}</h2><button class="btn small" data-a="close">Fermer</button></div>
    <p class="tr-save" id="tr-save">${trCan() ? (trPend.length ? 'Enregistrement…' : 'Tout s’enregistre tout seul') : 'Lecture seule'}</p>
    <div class="card"><h3>État</h3>${trSeg(rid, 'etat', d, Object.entries(TR_ETAT).map(([k, v]) => [k, v.l]), 'four')}
      ${commun ? '' : `<p class="muted">Catégorie de la chambre</p>${trSeg(rid, 'cat', d, Object.entries(TR_CAT))}`}
      <div class="form">${trSel(rid, 'etage', 'Étage', d, TR_ETAGES)}</div></div>
    <div class="card"><h3>📷 Photos</h3>${trShots(rid, commun ? TR_SHOTS_COMMUN : TR_SHOTS)}</div>
    <div class="card form"><h3>📏 Mesures (en centimètres)</h3>
      <p class="muted">De mur à mur, au sol. Avec l’iPhone : appli « Mesures ». Sinon un télémètre laser ou un mètre.</p>
      <div class="three">${trIn(rid, 'len', 'Longueur', d, { cm: 1, ph: '420' })}${trIn(rid, 'wid', 'Largeur', d, { cm: 1, ph: '310' })}${trIn(rid, 'hei', 'Hauteur', d, { cm: 1, ph: '260' })}</div>
      ${trIn(rid, 'surf', 'Pièce pas rectangulaire ? Surface réelle en m² (remplace longueur × largeur)', d, { ph: '12,5' })}
      ${commun ? '' : `<p class="muted">Salle de bain, mesurée à part</p><div class="two">${trIn(rid, 'sdb_len', 'Longueur', d, { cm: 1 })}${trIn(rid, 'sdb_wid', 'Largeur', d, { cm: 1 })}</div>`}
      <div class="tr-res" id="tr-surf">${trSurfHtml(rid)}</div>
      ${commun ? '' : `<p class="muted">Fenêtre principale (pour les rideaux)</p>
      <div class="three">${trIn(rid, 'fen_w', 'Largeur', d, { cm: 1 })}${trIn(rid, 'fen_h', 'Hauteur', d, { cm: 1 })}${trIn(rid, 'fen_allege', 'Sol → bas de fenêtre', d, { cm: 1 })}</div>
      <div class="two">${trIn(rid, 'fen_n', 'Nombre de fenêtres', d)}${trSel(rid, 'rideaux', 'Aujourd’hui', d, TR_RIDEAUX)}</div>`}</div>
    ${commun ? '' : `<div class="card form"><h3>🛏️ Couchage</h3>
      <div class="three">${trIn(rid, 'lits_s', 'Lits simples', d)}${trIn(rid, 'lits_d', 'Lits doubles', d)}${trIn(rid, 'lit_d_w', 'Largeur lit double', d, { cm: 1, ph: '140' })}</div>
      ${trSel(rid, 'cap_pv', 'Personnes admises par la commission de sécurité', d, [['1', '1 personne'], ['2', '2 personnes'], ['3', '3 personnes'], ['4', '4 personnes']])}</div>
    <div class="card form"><h3>💡 Lumières et prises</h3>
      <div class="three">${trIn(rid, 'lum_plaf', 'Plafonniers', d)}${trIn(rid, 'lum_chevet', 'Lampes de chevet', d)}${trIn(rid, 'prises', 'Prises près du lit', d)}</div></div>`}
    <div class="card form"><h3>🧱 Sol et murs</h3>
      <div class="two">${trSel(rid, 'sol', 'Sol', d, TR_SOLS)}${trSel(rid, 'sol_etat', 'État du sol', d, TR_USURE)}</div>
      <div class="two">${trSel(rid, 'murs', 'Murs', d, TR_MURS)}${trSel(rid, 'murs_etat', 'État des murs', d, TR_USURE)}</div>
      ${commun ? '' : `<div class="two">${trSel(rid, 'sdb', 'Salle de bain', d, TR_SDB)}${trSel(rid, 'sdb_etat', 'État', d, TR_USURE)}</div>`}</div>
    ${commun ? '' : `<div class="card"><h3>✅ Équipements présents</h3><p class="muted">Touche ce qui est dans la chambre et en bon état.</p>
      <div class="tr-eq">${TR_EQ.map(([k, l]) => `<button ${trDis()} data-a="trEq" data-rid="${esc(rid)}" data-k="${k}" aria-pressed="${!!eq[k]}">${eq[k] ? '✓ ' : ''}${l}</button>`).join('')}</div></div>
    <div class="card"><h3>⭐ Ce qui manque pour le 3 étoiles</h3><div id="tr-gaps">${trGapsHtml(rid)}</div>
      <p class="muted sm">Repères tirés de la <a href="${TR_GUIDE}" target="_blank" rel="noopener">grille officielle Atout France</a>, qui fait foi.</p></div>`}
    <div class="card form"><h3>📝 Notes</h3><label>Ce qu’il faut savoir sur ${commun ? 'cet endroit' : 'cette chambre'}<textarea ${trDis()} data-change="trF" data-rid="${esc(rid)}" data-k="notes" data-t="s" rows="3">${esc(d.notes || '')}</textarea></label></div>
    <div class="card"><div class="row between"><h3>À faire et à acheter${todo.length ? ` · ${todo.length}` : ''}</h3>${trCan() ? `<button class="btn small soft" data-a="trTodoNew" data-rid="${esc(rid)}">＋ Ajouter</button>` : ''}</div>
      ${todo.length ? `<div class="group flat">${todo.map(trTodoRow).join('')}</div>` : '<p class="muted">Rien pour l’instant.</p>'}</div>
    ${props.length ? `<div class="card"><h3>💡 Idées pour ${commun ? 'cet endroit' : 'cette chambre'}</h3>${props.map(trPropCard).join('')}</div>` : ''}
    ${row && row.updated_label ? `<p class="muted sm">Dernière modification : ${esc(row.updated_label)}, ${when(row.updated_at)}</p>` : ''}`);
}

/* ---------- meubles déjà là ---------- */
const trType = (k) => TR_TYPES.find((t) => t[0] === k) || TR_TYPES[TR_TYPES.length - 1];
function trItemRow(it) {
  const t = trType(it.type), ph = trItemPhotos(it.id)[0], u = ph ? trUrl(ph.path) : null, e = TR_IETAT[it.etat] || TR_IETAT.bon;
  const dims = [it.w_cm, it.d_cm, it.h_cm].filter(Boolean).join(' × ');
  const ou = it.room_id ? trRoomName(it.room_id) : (it.lieu || 'Réserve');
  return `<button class="prow" data-a="trItem" data-id="${it.id}">${u ? `<img class="tr-th" alt="" src="${esc(u)}" loading="lazy">` : `<span class="tr-th tr-ph">${t[2]}</span>`}
    <span class="pr-t"><b>${it.qty > 1 ? it.qty + ' × ' : ''}${esc(it.label || t[1])}</b><span class="muted sm">${esc([it.label ? t[1] : '', dims ? dims + ' cm' : '', ou].filter(Boolean).join(' · '))}</span></span>
    <span class="pill ${e.c}">${e.l}</span><span class="chev">›</span></button>`;
}
function trViewItems() {
  const items = S.tr.items, keep = items.filter((i) => i.etat !== 'a_jeter');
  const count = (types) => keep.filter((i) => types.includes(i.type)).reduce((n, i) => n + (i.qty || 1), 0);
  if (!items.length) return `<div class="card empty"><div class="e">🪑</div><h2>Les meubles qu’on a déjà</h2><p>Lits, matelas, bureaux, chaises, télés : une photo et les dimensions de chacun. On saura quoi réutiliser avant d’acheter.</p>${trCan() ? '<button class="btn pri" data-a="trItemNew">＋ Ajouter un meuble</button>' : ''}</div>`;
  const groups = TR_TYPES.map((t) => [t, items.filter((i) => i.type === t[0])]).filter(([, l]) => l.length);
  return `<div class="card"><h3>${keep.reduce((n, i) => n + (i.qty || 1), 0)} meubles réutilisables</h3>
      <p class="muted">${count(['lit_simple'])} lits simples · ${count(['lit_double'])} lits doubles · ${count(['matelas'])} matelas · ${count(['bureau'])} bureaux · ${count(['chaise', 'fauteuil'])} assises · ${count(['tv'])} télés</p></div>
    ${groups.map(([t, l]) => `<h2 class="sec">${t[2]} ${t[1]}</h2><div class="group">${l.map(trItemRow).join('')}</div>`).join('')}`;
}
function trItemSheet(id) {
  const it = id ? S.tr.items.find((x) => x.id === id) : { type: 'lit_simple', etat: 'bon', qty: 1 };
  if (!it) { closeSheet(); return; }
  const rooms = [...trRooms(), ...trCommuns()], ph = id ? trItemPhotos(id) : [];
  openSheet('tritem', `${sheetHead(id ? 'Meuble' : 'Nouveau meuble')}
    <div class="card form">
      <div class="two"><label>Type<select id="ti-type" ${trDis()}>${TR_TYPES.map((t) => opt(t[0], it.type, t[1])).join('')}</select></label><label>Quantité<input id="ti-qty" ${trDis()} inputmode="numeric" value="${esc(it.qty || 1)}"></label></div>
      <label>Description (marque, couleur, matière)<input id="ti-label" ${trDis()} value="${esc(it.label || '')}" placeholder="Ex. : lit bois clair avec tête de lit"></label>
      <div class="three"><label>Largeur (cm)<input id="ti-w" ${trDis()} inputmode="decimal" value="${esc(it.w_cm || '')}"></label><label>Longueur (cm)<input id="ti-d" ${trDis()} inputmode="decimal" value="${esc(it.d_cm || '')}"></label><label>Hauteur (cm)<input id="ti-h" ${trDis()} inputmode="decimal" value="${esc(it.h_cm || '')}"></label></div>
      <div class="two"><label>État<select id="ti-etat" ${trDis()}>${Object.entries(TR_IETAT).map(([k, v]) => opt(k, it.etat, v.l)).join('')}</select></label>
        <label>Où est-il ?<select id="ti-room" ${trDis()}>${opt('', it.room_id || '', 'Réserve / ailleurs')}${rooms.map((r) => opt(r.id, it.room_id, placeName(r))).join('')}</select></label></div>
      <label>Si ailleurs : où exactement ?<input id="ti-lieu" ${trDis()} value="${esc(it.lieu || '')}" placeholder="Ex. : grenier, cave, Hôtel de Paris"></label>
      <label>Note<input id="ti-note" ${trDis()} value="${esc(it.note || '')}"></label></div>
    ${id ? `<div class="card"><h3>📷 Photos</h3><div class="shots">${ph.map((p) => { const u = trUrl(p.path); return `<button class="shot done" data-a="trZoom" data-id="${p.id}">${u ? `<img alt="" src="${esc(u)}">` : ''}</button>`; }).join('')}${trCan() ? `<button class="shot" data-a="trItemShot" data-id="${id}"><span class="cam">📷</span><span>Photo</span></button>` : ''}</div></div>` : ''}
    ${trCan() ? `<button class="btn big pri" data-a="trItemSave" data-id="${id || ''}">${id ? 'Enregistrer' : 'Enregistrer, puis photo'}</button>${id ? `<button class="btn ghost bad-t" data-a="trItemDel" data-id="${id}">Supprimer ce meuble</button>` : ''}` : ''}`);
}

/* ---------- liste : actions et courses ---------- */
function trTodoRow(t) {
  const st = TR_TST[t.statut] || TR_TST.a_faire, nv = TR_NIV[t.niveau] || TR_NIV.essentiel;
  const sub = [t.room_id ? trRoomName(t.room_id) : '', t.ref, t.magasin, t.prix != null ? trEur(Number(t.prix) * (t.qty || 1)) : ''].filter(Boolean).join(' · ');
  return `<button class="prow" data-a="trTodo" data-id="${t.id}"><span class="pr-t"><b>${t.kind === 'achat' ? '🛒' : '🔨'} ${t.qty > 1 ? t.qty + ' × ' : ''}${esc(t.label)}</b>${sub ? `<span class="muted sm">${esc(sub)}</span>` : ''}</span>
    <span class="pill ${nv.c}">${nv.l}</span><span class="pill ${st.c}">${st.l}</span></button>`;
}
function trEqGaps() {
  const by = {};
  trRooms().forEach((r) => { if (!trData(r.id).eq) return; trGaps(r.id).filter((g) => g.eq).forEach((g) => { (by[g.eq] = by[g.eq] || { k: g.eq, t: g.t, rooms: [] }).rooms.push(r.num); }); });
  return Object.values(by).sort((a, b) => b.rooms.length - a.rooms.length);
}
function trViewListe() {
  const all = S.tr.todo, f = all.filter((t) => S.trNiv === 'tout' || t.niveau === S.trNiv);
  const open = f.filter((t) => t.statut !== 'fait'), done = f.filter((t) => t.statut === 'fait');
  const achats = open.filter((t) => t.kind === 'achat'), actions = open.filter((t) => t.kind !== 'achat');
  const sum = (l) => l.reduce((n, t) => n + (t.prix != null ? Number(t.prix) * (t.qty || 1) : 0), 0);
  const noPrice = achats.filter((t) => t.prix == null).length;
  const eqg = trEqGaps(), other = [];
  trRooms().forEach((r) => trGaps(r.id).filter((g) => !g.eq).forEach((g) => other.push({ r, g })));
  const inList = (label) => all.some((t) => t.statut !== 'fait' && String(t.label).toLowerCase() === String(label).toLowerCase());
  const fiches = trRooms().filter((r) => trData(r.id).eq).length;
  return `<div class="segc four" role="group" aria-label="Niveau">${[['tout', 'Tout'], ...Object.entries(TR_NIV).map(([k, v]) => [k, v.l])].map(([k, l]) => `<button data-a="trNiv" data-k="${k}" aria-pressed="${S.trNiv === k}">${l}</button>`).join('')}</div>
    <div class="card"><div class="row between"><h3>🛒 Courses${achats.length ? ` · ${achats.length}` : ''}</h3><b>${achats.length && sum(achats) ? trEur(Math.round(sum(achats))) : ''}</b></div>
      ${noPrice ? `<p class="muted sm">${noPrice} article${noPrice > 1 ? 's' : ''} sans prix : le total est incomplet.</p>` : ''}
      ${achats.length ? `<div class="group flat">${achats.map(trTodoRow).join('')}</div>` : '<p class="muted">Aucun achat noté.</p>'}</div>
    <div class="card"><h3>🔨 Actions${actions.length ? ` · ${actions.length}` : ''}</h3>
      ${actions.length ? `<div class="group flat">${actions.map(trTodoRow).join('')}</div>` : '<p class="muted">Aucune action notée.</p>'}</div>
    <div class="card"><h3>⭐ Écarts avec le 3 étoiles</h3>
      <p class="muted">Calculé à partir des ${fiches} fiche${fiches > 1 ? 's' : ''} où les équipements sont cochés.</p>
      ${eqg.length ? `<div class="group flat">${eqg.map((g) => `<div class="prow"><span class="pr-t"><b>${esc(g.t)} · ${g.rooms.length}</b><span class="muted sm">Chambre${g.rooms.length > 1 ? 's' : ''} ${esc(g.rooms.join(', '))}</span></span>${inList(g.t) ? '<span class="pill p-green">dans la liste</span>' : (trCan() ? `<button class="btn small soft" data-a="trGapBuy" data-k="${g.k}">＋ Courses</button>` : '')}</div>`).join('')}</div>` : ''}
      ${other.length ? `<div class="group flat">${other.map(({ r, g }) => `<button class="prow" data-a="trRoom" data-id="${esc(r.id)}"><span class="pr-t"><b>${esc(placeName(r))}</b><span class="muted sm">${esc(g.t)}</span></span><span class="chev">›</span></button>`).join('')}</div>` : ''}
      ${!eqg.length && !other.length ? '<p class="muted">Rien à signaler pour l’instant. Les écarts apparaissent ici au fur et à mesure des fiches.</p>' : ''}</div>
    ${done.length ? `<button class="btn small ghost" data-a="trDone">${S.trDone ? 'Masquer' : 'Voir'} les ${done.length} terminé${done.length > 1 ? 's' : ''}</button>${S.trDone ? `<div class="group">${done.map(trTodoRow).join('')}</div>` : ''}` : ''}`;
}
function trTodoSheet(id, pre) {
  const t = id ? S.tr.todo.find((x) => x.id === id) : { kind: 'action', qty: 1, niveau: 'essentiel', statut: 'a_faire', ...(pre || {}) };
  if (!t) { closeSheet(); return; }
  const rooms = [...trRooms(), ...trCommuns()];
  S.trForm = { id: id || null, kind: t.kind || 'action', back: (pre && pre.back) || null };
  const safeUrl = t.url && /^https?:\/\//i.test(t.url) ? t.url : null;
  openSheet('trtodo', `${sheetHead(id ? 'Modifier' : 'Ajouter à la liste')}
    <div class="segc" role="group"><button ${trDis()} data-a="trKind" data-k="action" aria-pressed="${S.trForm.kind === 'action'}">🔨 Action à faire</button><button ${trDis()} data-a="trKind" data-k="achat" aria-pressed="${S.trForm.kind === 'achat'}">🛒 Achat</button></div>
    <div class="card form">
      <label>Quoi ?<input id="tt-label" ${trDis()} value="${esc(t.label || '')}" placeholder="Ex. : changer le robinet du lavabo"></label>
      <div class="two"><label>Où ?<select id="tt-room" ${trDis()}>${opt('', t.room_id || '', 'Tout l’hôtel')}${rooms.map((r) => opt(r.id, t.room_id, placeName(r))).join('')}</select></label><label>Quantité<input id="tt-qty" ${trDis()} inputmode="numeric" value="${esc(t.qty || 1)}"></label></div>
      <div class="two"><label>Niveau<select id="tt-niv" ${trDis()}>${Object.entries(TR_NIV).map(([k, v]) => opt(k, t.niveau, v.l)).join('')}</select></label><label>Avancement<select id="tt-st" ${trDis()}>${Object.entries(TR_TST).map(([k, v]) => opt(k, t.statut, v.l)).join('')}</select></label></div>
      <div class="two"><label>Magasin<input id="tt-mag" ${trDis()} value="${esc(t.magasin || '')}"></label><label>Prix à l’unité (€)<input id="tt-prix" ${trDis()} inputmode="decimal" value="${esc(t.prix == null ? '' : t.prix)}"></label></div>
      <label>Référence du produit<input id="tt-ref" ${trDis()} value="${esc(t.ref || '')}"></label>
      <label>Lien vers le produit<input id="tt-url" ${trDis()} inputmode="url" value="${esc(t.url || '')}" placeholder="https://"></label>
      ${safeUrl ? `<a class="btn small" href="${esc(safeUrl)}" target="_blank" rel="noopener">Ouvrir le lien ↗</a>` : ''}
      <label>Note<textarea id="tt-note" ${trDis()} rows="2">${esc(t.note || '')}</textarea></label></div>
    ${trCan() ? `<button class="btn big pri" data-a="trTodoSave">Enregistrer</button>${id ? `<button class="btn ghost bad-t" data-a="trTodoDel" data-id="${id}">Supprimer</button>` : ''}` : ''}`);
}

/* ---------- idées ---------- */
function trPropCard(p) {
  const nv = TR_NIV[p.niveau] || TR_NIV.essentiel;
  const st = p.statut === 'retenue' ? '<span class="pill p-green">Retenue</span>' : (p.statut === 'ecartee' ? '<span class="pill p-plain">Écartée</span>' : '');
  return `<div class="tr-prop"><div class="row between"><b>${esc(p.titre)}</b><span class="row">${st}<span class="pill ${nv.c}">${nv.l}</span></span></div>
    <div class="pbody">${mdLite(p.body)}</div>
    ${trCan() ? `<div class="row"><button class="btn small ${p.statut === 'retenue' ? 'ok' : ''}" data-a="trProp" data-id="${p.id}" data-k="retenue">👍 On retient</button><button class="btn small ghost" data-a="trProp" data-id="${p.id}" data-k="${p.statut === 'ecartee' ? 'proposee' : 'ecartee'}">${p.statut === 'ecartee' ? 'Remettre' : 'Écarter'}</button></div>` : ''}</div>`;
}
function trViewIdees() {
  const props = S.tr.props;
  if (!props.length) return `<div class="card empty"><div class="e">💡</div><h2>Les propositions arriveront ici</h2><p>Une fois les chambres mesurées et photographiées, demande à Claude : il lit les fiches et dépose ici ses idées d’aménagement, de rideaux, de sols et de murs, par niveau de budget.</p></div>`;
  const groups = {}; props.forEach((p) => { (groups[p.room_id || ''] = groups[p.room_id || ''] || []).push(p); });
  const keys = Object.keys(groups).sort((a, b) => ((S.rooms[a] || {}).order || 0) - ((S.rooms[b] || {}).order || 0));
  return keys.map((k) => `<div class="card"><h3>${esc(k ? trRoomName(k) : 'Tout l’hôtel')}</h3>${groups[k].map(trPropCard).join('')}</div>`).join('');
}

/* ---------- actions ---------- */
const trVal = (id) => { const e = $(id); return e ? e.value.trim() : ''; };
const trSheetRoom = () => S.sheet && S.sheet.startsWith('trroom:') ? S.sheet.slice(7) : null;
Object.assign(A, {
  trEnter() { S.mode = 'travaux'; S.sel.clear(); render(); window.scrollTo(0, 0); trLoad(); },
  trExit() { S.mode = null; render(); window.scrollTo(0, 0); },
  trReload() { S.tr = null; render(); trLoad(); },
  trTab(d) { S.trTab = d.k; render(); window.scrollTo(0, 0); if (!trPend.length) trLoad(true); },
  trNiv(d) { S.trNiv = d.k; render(); },
  trDone() { S.trDone = !S.trDone; render(); },
  trRoom(d) { trRoomSheet(d.id); },
  trSet(d) { const cur = trData(d.rid)[d.k]; trPatch(d.rid, { [d.k]: cur === d.v ? null : d.v }); trRoomSheet(d.rid); },
  trEq(d) { const eq = { ...(trData(d.rid).eq || {}) }; if (eq[d.k]) delete eq[d.k]; else eq[d.k] = true; trPatch(d.rid, { eq }); trRoomSheet(d.rid); },
  async trShot(d) {
    if (!trCan()) return;
    const r = S.rooms[d.rid]; if (!r) return;
    const path = await takePhoto(placeShort(r) + ' · ' + d.l); if (!path) return;
    try { const x = await api('tr_photo_add', { room_id: d.rid, path, label: d.l }); S.tr.photos.push(x.photo); toast('Photo enregistrée ✓'); }
    catch (e) { toast(errMsg(e)); }
    if (trSheetRoom() === d.rid) trRoomSheet(d.rid);
  },
  trZoom(d) {
    const p = S.tr.photos.find((x) => x.id === d.id); if (!p) return;
    const u = trUrl(p.path), back = p.room_id ? `data-a="trRoom" data-id="${esc(p.room_id)}"` : `data-a="trItem" data-id="${esc(p.item_id || '')}"`;
    openSheet('trzoom', `<div class="row between"><h2>${esc(p.label || 'Photo')}</h2><button class="btn small" ${back}>‹ Retour</button></div>
      ${u ? `<img class="big-img" alt="" src="${esc(u)}">` : '<p>Photo introuvable.</p>'}
      <p class="muted sm">${esc(p.created_label || '')}${p.created_at ? ', ' + when(p.created_at) : ''}</p>
      ${trCan() ? `<button class="btn ghost bad-t" data-a="trPhotoDel" data-id="${p.id}">Supprimer cette photo</button>` : ''}`);
  },
  async trPhotoDel(d) {
    const p = S.tr.photos.find((x) => x.id === d.id); if (!p) return;
    if (!confirm('Supprimer cette photo ?')) return;
    try { await api('tr_photo_del', { id: p.id }); S.tr.photos = S.tr.photos.filter((x) => x.id !== p.id); } catch (e) { toast(errMsg(e)); return; }
    if (p.room_id) trRoomSheet(p.room_id); else trItemSheet(p.item_id);
  },
  trItemNew() { trItemSheet(null); },
  trItem(d) { trItemSheet(d.id); },
  async trItemSave(d) {
    const body = { id: d.id || undefined, type: trVal('ti-type'), qty: trVal('ti-qty'), label: trVal('ti-label'), w_cm: trVal('ti-w').replace(',', '.'), d_cm: trVal('ti-d').replace(',', '.'), h_cm: trVal('ti-h').replace(',', '.'), etat: trVal('ti-etat'), room_id: trVal('ti-room') || null, lieu: trVal('ti-lieu'), note: trVal('ti-note') };
    try {
      const x = await api('tr_item_save', body);
      const i = S.tr.items.findIndex((y) => y.id === x.item.id); if (i >= 0) S.tr.items[i] = x.item; else S.tr.items.push(x.item);
      toast('Enregistré ✓');
      if (d.id) { closeSheet(); render(); } else { trItemSheet(x.item.id); render(); }
    } catch (e) { toast(errMsg(e)); }
  },
  async trItemShot(d) {
    const it = S.tr.items.find((x) => x.id === d.id); if (!it) return;
    const path = await takePhoto(it.label || trType(it.type)[1]); if (!path) return;
    try { const x = await api('tr_photo_add', { item_id: d.id, path, label: 'Meuble' }); S.tr.photos.push(x.photo); toast('Photo enregistrée ✓'); } catch (e) { toast(errMsg(e)); }
    if (S.sheet === 'tritem') trItemSheet(d.id);
  },
  async trItemDel(d) {
    if (!confirm('Supprimer ce meuble et ses photos ?')) return;
    try { await api('tr_item_del', { id: d.id }); S.tr.items = S.tr.items.filter((x) => x.id !== d.id); S.tr.photos = S.tr.photos.filter((p) => p.item_id !== d.id); closeSheet(); render(); } catch (e) { toast(errMsg(e)); }
  },
  trTodoNew(d) { trTodoSheet(null, d && d.rid ? { room_id: d.rid, back: d.rid } : null); },
  trTodo(d) { const back = trSheetRoom(); trTodoSheet(d.id, back ? { back } : null); },
  trKind(d) { if (!S.trForm) return; S.trForm.kind = d.k; document.querySelectorAll('[data-a="trKind"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === d.k))); },
  trGapBuy(d) {
    const g = trEqGaps().find((x) => x.k === d.k); if (!g) return;
    trTodoSheet(null, { kind: 'achat', label: g.t, qty: g.rooms.length, note: 'Chambres : ' + g.rooms.join(', ') });
  },
  async trTodoSave() {
    const F = S.trForm; if (!F) return;
    const label = trVal('tt-label'); if (!label) { toast('Écris ce qu’il faut faire ou acheter.'); return; }
    const body = { id: F.id || undefined, kind: F.kind, label, room_id: trVal('tt-room') || null, qty: trVal('tt-qty'), niveau: trVal('tt-niv'), statut: trVal('tt-st'), magasin: trVal('tt-mag'), prix: trVal('tt-prix'), ref: trVal('tt-ref'), url: trVal('tt-url'), note: trVal('tt-note') };
    try {
      const x = await api('tr_todo_save', body);
      const i = S.tr.todo.findIndex((y) => y.id === x.todo.id); if (i >= 0) S.tr.todo[i] = x.todo; else S.tr.todo.push(x.todo);
      toast('Enregistré ✓');
      if (F.back && S.rooms[F.back]) trRoomSheet(F.back); else closeSheet();
      render();
    } catch (e) { toast(errMsg(e)); }
  },
  async trTodoDel(d) {
    if (!confirm('Supprimer cette ligne ?')) return;
    const F = S.trForm || {};
    try { await api('tr_todo_del', { id: d.id }); S.tr.todo = S.tr.todo.filter((x) => x.id !== d.id); if (F.back && S.rooms[F.back]) trRoomSheet(F.back); else closeSheet(); render(); } catch (e) { toast(errMsg(e)); }
  },
  async trProp(d) {
    const p = S.tr.props.find((x) => x.id === d.id); if (!p) return;
    const statut = p.statut === d.k ? 'proposee' : d.k;
    try { await api('tr_prop_set', { id: p.id, statut }); p.statut = statut; } catch (e) { toast(errMsg(e)); return; }
    const rid = trSheetRoom(); if (rid) trRoomSheet(rid); render();
  },
});
Object.assign(C, {
  // Champ d'une fiche : enregistré dès qu'on quitte le champ. Une mesure tapée en mètres (3,45) est convertie en centimètres.
  trF(el) {
    const rid = el.dataset.rid, k = el.dataset.k; let v = el.value.trim();
    if (el.dataset.t === 'n') {
      const n = Number(v.replace(',', '.').replace(/[^0-9.]/g, ''));
      if (v === '' || !Number.isFinite(n) || n <= 0) { v = null; el.value = ''; }
      else { v = el.dataset.cm && n < 20 ? Math.round(n * 100) : Math.round(n * 100) / 100; el.value = String(v).replace('.', ','); }
    } else if (v === '') v = null;
    trPatch(rid, { [k]: v }); trLive(rid);
  },
});
// Le mode travaux peut avoir été demandé avant la fin du chargement de ce fichier.
if (S.loaded && S.mode === 'travaux') render();
