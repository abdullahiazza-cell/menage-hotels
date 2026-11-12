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
// Qui écrit quoi. Fiches et inventaire de l'Archange : le propriétaire et l'intendant. Un projet personnel : son auteur.
// Les plans : toute personne du mode travaux peut proposer sa version (trPlanCan), sans toucher à celle d'un autre.
const trPlanCan = () => !!(S.tr && S.tr.can_plan && S.me && !S.me.readonly);
const trMine = (rid) => { const r = S.tr && S.tr.rooms[rid]; return !!r && !!r.owner_id && r.owner_id === S.tr.me_id; };
const trCan = () => { if (!S.tr || !S.me || S.me.readonly) return false; const rid = S.trCtx; if (rid && trIsTest(rid) && S.tr.rooms[rid] && S.tr.rooms[rid].owner_id) return trMine(rid); return !!S.tr.can_edit; };
const trPrenom = (label) => String(label || '').trim().split(/\s+/)[0] || 'quelqu’un';
const trDe = (label) => { const n = trPrenom(label); return (/^[aeiouyhàâéèêîôûAEIOUYHÀÂÉÈÊÎÔÛ]/.test(n) ? 'd’' : 'de ') + n; };
const trWho = (id) => { const u = ((S.tr && S.tr.people) || []).find((x) => x.id === id); return u ? u.label : ''; };
// Pièces de l'Archange dans le mode travaux : les chambres et communs du ménage, plus les pièces ajoutées ici (réception, locaux…),
// moins celles qu'on a retirées des travaux (elles restent dans le ménage).
const TR_GENRES = [['chambre', 'Chambre'], ['commun', 'Partie commune'], ['technique', 'Local technique']];
const trIsExtra = (id) => /^arc__x_/.test(String(id || ''));
const trMasque = (id) => !!(S.tr && S.tr.rooms[id] && (S.tr.rooms[id].data || {}).masque);
const trExtras = () => (S.tr ? Object.keys(S.tr.rooms).filter(trIsExtra).map((id) => trRoomGet(id)).filter(Boolean) : []);
const trRooms = () => [...roomsOf(TR_HOTEL), ...trExtras().filter((r) => r.kind !== 'commun')].filter((r) => !trMasque(r.id));
const trCommuns = () => [...trExtras().filter((r) => r.kind === 'commun'), ...communsOf(TR_HOTEL)].filter((r) => !trMasque(r.id));
const trRetirees = () => [...roomsOf(TR_HOTEL), ...communsOf(TR_HOTEL)].filter((r) => trMasque(r.id));
const trData = (rid) => (S.tr && S.tr.rooms[rid] && S.tr.rooms[rid].data) || {};
const trIsMesh = (p) => /\.glb$/i.test(String(p && p.path || ''));
const trPhotosOf = (rid) => S.tr.photos.filter((p) => p.room_id === rid && !trIsMesh(p));
const trMeshOf = (rid) => S.tr.photos.filter((p) => p.room_id === rid && trIsMesh(p)).slice(-1)[0] || null;
const trItemPhotos = (id) => S.tr.photos.filter((p) => p.item_id === id);
const trUrl = (p) => p ? (S.localUrls[p] || S.trUrls[p] || null) : null;
const trNum = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const trFr = (n, d) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d == null ? 1 : d });
const trEur = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 }) + ' €';
// Pièces d'essai (hors hôtel) : elles vivent seulement dans le mode travaux et ne comptent dans aucun total de l'Archange.
const trIsTest = (id) => /^test__/.test(String(id || ''));
const trRoomGet = (id) => S.rooms[id] || (trIsExtra(id) && S.tr && S.tr.rooms[id] ? (() => { const d = S.tr.rooms[id].data || {}; return { id, hotel: 'arc', kind: d.genre === 'chambre' ? 'chambre' : 'commun', extra: true, genre: d.genre || 'commun', num: d.nom || 'Pièce', order: 9000 + (d.ordre || 0) }; })() : undefined) || (trIsTest(id) && S.tr && S.tr.rooms[id] ? { id, hotel: 'test', kind: 'chambre', test: true, num: [(S.tr.rooms[id].data || {}).dossier, (S.tr.rooms[id].data || {}).nom || 'Pièce'].filter(Boolean).join(' · '), order: 9999 } : undefined);
const trPlace = (r) => r.test || r.extra ? r.num : placeName(r);
const trShort = (r) => r.test ? r.num : placeShort(r);
const trTests = () => Object.keys(S.tr.rooms).filter(trIsTest).map(trRoomGet).filter(Boolean).sort((a, b) => String(a.num).localeCompare(String(b.num), 'fr'));
const trRoomName = (rid) => { const r = trRoomGet(rid); return r ? trPlace(r) : 'Tout l’hôtel'; };

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
    trPend.forEach((p) => { const r = rooms[p.rid] || (rooms[p.rid] = trIsTest(p.rid) ? { room_id: p.rid, hotel: 'test', data: {}, owner_id: d.me_id, shared: [] } : { room_id: p.rid, data: {} }); r.data = trApply(r.data || {}, p.patch); });
    S.tr = { loaded: true, rooms, photos: d.photos || [], items: d.items || [], todo: d.todo || [], props: d.props || [], can_edit: !!d.can_edit, can_plan: !!d.can_plan, me_id: d.me_id || (S.me && S.me.id), plans: d.plans || [], people: d.people || [] };
    if (typeof trPlansMerge === 'function') trPlansMerge();
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
  // Salle de bain placée dans un coin du plan : elle est déjà comprise dans longueur × largeur.
  const inside = !!(d.plan && d.plan.sdb && d.plan.sdb.c && sdb);
  return { ch, sdb, inside, tot: inside ? ch : ch + sdb, vol: ch && trNum(d.hei) ? (ch * trNum(d.hei)) / 100 : 0 };
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
/* ---------- catalogue IKEA : des références relevées sur ikea.com (nom, dimensions, prix du jour du relevé, lien, photo affichée depuis leur site) ---------- */
// [clé, rayon, type posable dans le plan (ou null), groupe]
const TR_IK_CATS = [
  ['lit_d', 'Lits doubles', 'lit_d', 'Dormir'], ['lit_s', 'Lits simples', 'lit_s', 'Dormir'], ['tete', 'Têtes de lit', null, 'Dormir'], ['matelas', 'Matelas', null, 'Dormir'], ['linge', 'Housses de couette', null, 'Dormir'], ['plaid', 'Plaids', null, 'Dormir'], ['coussin', 'Coussins', null, 'Dormir'],
  ['chevet', 'Chevets', 'chevet', 'Ranger'], ['commode', 'Commodes', 'meuble', 'Ranger'], ['armoire', 'Armoires', 'armoire', 'Ranger'], ['bagages', 'Bancs porte-bagages', 'bagages', 'Ranger'], ['entree', 'Portemanteaux et patères', null, 'Ranger'],
  ['bureau', 'Bureaux', 'bureau', 'S’asseoir'], ['chaise', 'Chaises', 'chaise', 'S’asseoir'], ['fauteuil', 'Fauteuils', 'fauteuil', 'S’asseoir'], ['tabouret', 'Tabourets', 'chaise', 'S’asseoir'], ['table', 'Tables (petit déjeuner)', 'bureau', 'S’asseoir'],
  ['applique', 'Appliques', null, 'Lumière'], ['lampe', 'Lampes de chevet', null, 'Lumière'], ['lampadaire', 'Lampadaires', null, 'Lumière'], ['suspension', 'Suspensions', null, 'Lumière'], ['plafonnier', 'Plafonniers', null, 'Lumière'],
  ['rideau', 'Rideaux occultants', null, 'Fenêtre et sol'], ['voilage', 'Voilages', null, 'Fenêtre et sol'], ['tapis', 'Tapis', null, 'Fenêtre et sol'],
  ['miroir', 'Miroirs', null, 'Décorer'], ['cadre', 'Cadres et tableaux', null, 'Décorer'], ['vase', 'Vases', null, 'Décorer'], ['plante', 'Plantes', null, 'Décorer'], ['objet', 'Objets déco', null, 'Décorer'],
  ['sdb', 'Miroirs et porte-serviettes', null, 'Salle de bain'], ['poubelle', 'Poubelles', null, 'Salle de bain']];
const trIkUrl = (c) => 'https://www.ikea.com/fr/fr/p/' + c.slug + '/';
// La vignette passe par notre serveur (certains téléphones n'affichent pas les images prises directement chez le marchand) ; en secours, l'adresse directe.
const trIkImg = (c) => c.img ? API + '?ik=' + encodeURIComponent(c.img) : '';
const trIkImg2 = (c) => c.img ? 'https://www.ikea.com/fr/fr/images/products/' + c.img + '?f=xs' : '';
// Dimensions lues dans la description : « 40x50x53 cm » (largeur × profondeur × hauteur) ou « 140x200 cm » pour un lit.
function trIkDims(c) {
  const d = c.descr || '', m = /(\d+)(?:\/\d+)?x(\d+)(?:x(\d+))?\s*cm/.exec(d), cat = TR_IK_CATS.find((x) => x[0] === c.cat), t = cat && cat[2];
  if (m) { const o = { w: +m[1], d: +m[2] }; if (m[3]) o.h = +m[3]; else if (c.cat === 'armoire') { o.h = o.d; o.d = 58; } return o; }
  // Pas de dimensions sur la fiche : celles d'un meuble courant de ce type, signalées comme approximatives.
  if (!t || typeof TR_FURN === 'undefined' || !TR_FURN[t]) return null;
  const f = TR_FURN[t], one = /(\d+)\s*cm/.exec(d), o = { w: f.w, d: f.d, h: f.h, approx: true };
  if (one && c.cat === 'tabouret') { o.h = +one[1]; o.w = o.d = 35; } else if (c.cat === 'tabouret') { o.w = o.d = 35; o.h = 45; }
  else if (one && c.cat === 'table') { o.w = o.d = +one[1]; } else if (one && ['bagages', 'meuble'].includes(t)) { o.w = +one[1]; o.d = 38; o.h = 45; }
  return o;
}
async function trIkLoad() { if (S.trCat || S.trCatBusy) return; S.trCatBusy = true; try { const d = await api('tr_catalog'); S.trCat = d.items || []; } catch (e) { S.trCatErr = errMsg(e); } S.trCatBusy = false; if (S.mode === 'travaux' && !S.sheet) render(); else if (S.sheet === 'trikpick') trIkPickSheet(); else if (S.trP && S.sheet && S.sheet.startsWith('trplan:')) trPlanSheet(S.trP.rid, true); }
function trViewIkea() {
  if (!S.trCat) { trIkLoad(); return `<div class="card empty"><div class="e">🛋️</div><h2>${S.trCatErr ? 'Catalogue indisponible' : 'Chargement du catalogue…'}</h2>${S.trCatErr ? `<p>${esc(S.trCatErr)}</p>` : ''}</div>`; }
  const k = S.trCatK || 'lit_d', list = S.trCat.filter((c) => c.cat === k), seen = S.trCat.reduce((a, c) => (c.seen > a ? c.seen : a), '');
  return `<p class="muted">Des références IKEA France utiles en hôtellerie : ${S.trCat.length} produits, par rayons. Prix relevés le ${seen ? seen.split('-').reverse().join('/') : '?'}, à revérifier avant d’acheter.</p>
    ${[...new Set(TR_IK_CATS.map((c) => c[3]))].map((g) => `<p class="tr-cap">${g}</p><div class="tr-sws">${TR_IK_CATS.filter((c) => c[3] === g).map(([c, l]) => `<button class="tr-sw" style="padding-left:12px" data-a="trIkCat" data-k="${c}" aria-pressed="${k === c}">${l} · ${S.trCat.filter((x) => x.cat === c).length}</button>`).join('')}</div>`).join('')}
    <div class="tr-ikg">${list.map((c) => { const dm = trIkDims(c); return `<div class="tr-ik"><img loading="lazy" referrerpolicy="no-referrer" alt="" src="${esc(trIkImg(c))}" onerror="this.onerror=null;this.src='${esc(trIkImg2(c))}'"><b>${esc(c.name)}</b><span class="muted sm">${esc(c.descr || '')}</span><span class="tr-ikp">${c.price != null ? trEur(c.price) : ''}</span><span class="muted sm">Réf. ${esc(c.ref.replace(/(\d{3})(\d{3})(\d{2})/, '$1.$2.$3'))}${dm && dm.approx ? ' · dimensions approximatives' : ''}</span>
      <div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn small" href="${esc(trIkUrl(c))}" target="_blank" rel="noopener">Voir</a>${S.tr.can_edit ? `<button class="btn small soft" data-a="trIkList" data-ref="${esc(c.ref)}">＋ Liste</button>` : ''}</div></div>`; }).join('')}</div>
    <p class="muted sm">Pour poser un de ces meubles dans une chambre : ouvre le plan de la chambre, puis « Un meuble du catalogue IKEA ». Les photos viennent du site d’IKEA.</p>`;
}

function viewTravaux() {
  const T = S.tr;
  const right = T && T.loaded && trCan() && (S.trTab === 'meubles' || S.trTab === 'liste') ? `<button class="nb-act" data-a="${S.trTab === 'meubles' ? 'trItemNew' : 'trTodoNew'}" aria-label="Ajouter">${ico('plus')}</button>` : '';
  const head = `<header class="navbar"><button class="nb-back" data-a="trExit">${ico('back')}<span>Réception</span></button><h1 class="nb-title">🛠️ Travaux · Archange</h1><div class="nb-right">${right}</div></header>`;
  if (!T || !T.loaded) return `${head}<div class="wrap"><div class="card empty"><div class="e">${T && T.err ? '📶' : '🛠️'}</div><h2>${T && T.err ? 'Pas de connexion' : 'Chargement…'}</h2>${T && T.err ? `<p>${esc(T.err)}</p><button class="btn pri" data-a="trReload">Réessayer</button>` : ''}</div></div>`;
  const tabs = [['chambres', 'Chambres'], ['meubles', 'Meubles'], ['ikea', 'IKEA'], ['liste', 'Liste'], ['idees', 'Idées']];
  const nProp = T.props.filter((p) => p.statut === 'proposee').length;
  const body = S.trTab === 'ikea' ? trViewIkea() : S.trTab === 'meubles' ? trViewItems() : S.trTab === 'liste' ? trViewListe() : S.trTab === 'idees' ? trViewIdees() : trViewRooms();
  return `${head}<div class="wrap">
    ${trCan() ? '' : `<div class="robar">👁 <span>${trPlanCan() ? '<b>Fiches et liste en lecture</b> · Abdullah et l’intendant les remplissent. Dans le plan d’une chambre, tu peux proposer ta version.' : '<b>Lecture seule</b> · vous voyez tout l’avancement.'}</span></div>`}
    <div class="segc five" role="group" aria-label="Rubrique">${tabs.map(([k, l]) => `<button data-a="trTab" data-k="${k}" aria-pressed="${S.trTab === k}">${l}${k === 'idees' && nProp ? ` <span class="badge sm">${nProp}</span>` : ''}</button>`).join('')}</div>
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
  return `<button class="prow" data-a="trRoom" data-id="${esc(r.id)}"><span class="pr-t"><b>${esc(trPlace(r))}</b>
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
      ${next && trCan() ? `<button class="btn soft" data-a="trRoom" data-id="${esc(next.id)}">Continuer : ${esc(trPlace(next))} ›</button>` : ''}</div>
    ${trPlanCan() ? `<div class="card"><h3>📥 Déposer un scan</h3><p class="muted">Tu as scanné une pièce avec l’iPhone (OpenPlan3D) ? Dépose le fichier ici : l’appli le lit, puis te demande dans quelle chambre le ranger.</p>
      <button class="btn big pri" data-a="trScanDrop">Choisir le fichier du scan</button></div>` : ''}
    ${(() => { if (typeof trPmr !== 'function') return ''; const mes = rooms.filter((r) => trMeasured(trData(r.id))), ok = mes.filter((r) => trPmr(r.id).ok); return mes.length ? `<div class="card"><h3>♿ Chambres qui pourraient être adaptées</h3><p>${ok.length ? ok.map((r) => esc(trPlace(r))).join(', ') : 'Aucune parmi les chambres mesurées pour l’instant.'}</p><p class="muted sm">Calcul sur ${mes.length} chambre${mes.length > 1 ? 's' : ''} mesurée${mes.length > 1 ? 's' : ''} : un lit de 140, 90 cm libres le long du lit et un rond de 1,50 m pour tourner. Reste à vérifier sur place : accès sans marche ou par ascenseur, porte de 83 cm de passage, salle d’eau adaptée.</p></div>` : ''; })()}
    <h2 class="sec">Chambres</h2><div class="group">${rooms.map(trRoomRow).join('')}</div>
    ${communs.length ? `<h2 class="sec">Parties communes et locaux</h2><div class="group">${communs.map(trRoomRow).join('')}</div>` : ''}
    ${trCan() ? '<button class="btn" data-a="trSpaceNew">＋ Ajouter une pièce à l’Archange</button>' : ''}
    ${trRetirees().length ? `<h2 class="sec">Retirées des travaux</h2><p class="muted sm">Elles restent dans l’appli du ménage. Touche pour les remettre.</p><div class="group">${trRetirees().map((r) => `<button class="prow" ${trCan() ? '' : 'disabled'} data-a="trUnhide" data-id="${esc(r.id)}"><span class="pr-t"><b>${esc(trPlace(r))}</b></span><span class="pill p-plain">Remettre</span></button>`).join('')}</div>` : ''}
    <h2 class="sec">Mes projets</h2><p class="muted">Des pièces hors de l’hôtel (un appartement, un local…), rangées dans des projets que tu nommes. Toi seul les vois, sauf si tu les partages. Elles ne comptent pas dans les travaux de l’Archange.</p>
    ${trTests().length ? `<div class="group">${trTests().map(trRoomRow).join('')}</div>` : ''}
    ${trPlanCan() ? '<button class="btn" data-a="trTestNew">＋ Nouvelle pièce dans un projet</button>' : ''}`;
}

/* ---------- fiche d'une chambre ---------- */
const trDis = () => trCan() ? '' : 'disabled';
const trIn = (rid, k, label, d, o) => { o = o || {}; return `<label>${label}<input ${trDis()} ${o.text ? '' : 'inputmode="decimal"'} data-change="trF" data-rid="${esc(rid)}" data-k="${k}" data-t="${o.text ? 's' : 'n'}" ${o.cm ? 'data-cm="1"' : ''} value="${esc(d[k] == null ? '' : d[k])}" placeholder="${esc(o.ph || '')}"></label>`; };
const trSel = (rid, k, label, d, opts) => `<label>${label}<select ${trDis()} data-change="trF" data-rid="${esc(rid)}" data-k="${k}" data-t="s">${opt('', d[k] || '', '—')}${opts.map(([v, l]) => opt(v, d[k], l)).join('')}</select></label>`;
const trSeg = (rid, k, d, entries, cls) => `<div class="segc ${cls || ''}" role="group">${entries.map(([v, l]) => `<button ${trDis()} data-a="trSet" data-rid="${esc(rid)}" data-k="${k}" data-v="${v}" aria-pressed="${d[k] === v}">${l}</button>`).join('')}</div>`;
function trSurfHtml(rid) {
  const d = trData(rid), s = trSurf(d), r = trRoomGet(rid);
  if (!s.ch) return '<span class="muted">Entre la longueur et la largeur : la surface se calcule toute seule.</span>';
  const cap = trCap3(s.tot);
  let v = '';
  if (r && !isCommun(r)) {
    v = cap.plein ? `En 3★ : jusqu’à ${cap.plein} personne${cap.plein > 1 ? 's' : ''}` : (cap.tol ? `En 3★ : ${cap.tol} personne${cap.tol > 1 ? 's' : ''}, avec la tolérance de 10 %` : 'Trop petite pour le 3★ (11,5 m² demandés pour 1 personne)');
    if (cap.plein && cap.tol > cap.plein) v += ` (${cap.tol} avec la tolérance de 10 %)`;
  }
  return `<b>${trFr(s.tot)} m²</b>${s.sdb ? (s.inside ? ` <span class="sm">dont salle de bain ${trFr(s.sdb)}</span>` : ` <span class="sm">= chambre ${trFr(s.ch)} + salle de bain ${trFr(s.sdb)}</span>`) : ''}${s.vol ? ` · ${trFr(s.vol, 0)} m³` : ''}${v ? `<br><span class="sm">${v}</span>` : ''}`;
}
function trGapsHtml(rid) {
  const d = trData(rid), g = trGaps(rid);
  if (!d.eq && !g.length) return '<p class="muted">Coche les équipements présents : ce qui manque s’affichera ici.</p>';
  if (!g.length) return '<p class="banner sm c-green">Rien ne manque d’après la fiche ✓</p>';
  return `<ul class="tr-gaps">${g.map((x) => `<li>${esc(x.t)}</li>`).join('')}</ul>`;
}
function trPlanCardHtml(rid) {
  const d = trData(rid), n = d.plan && Array.isArray(d.plan.items) ? d.plan.items.length : 0;
  const scan = trCan() ? `<button class="btn small" data-a="trScanPick" data-id="${esc(rid)}">📲 Importer un scan de l’iPhone</button><p class="muted sm">Avec un iPhone Pro et l’appli gratuite OpenPlan3D : scanne la chambre, puis Export → Editable Plan (JSON). Les mesures, la porte, la fenêtre et les meubles reconnus arrivent ici.</p>` : '';
  if (!(trNum(d.len) && trNum(d.wid))) return '<p class="muted">Entre la longueur et la largeur, ou importe un scan : le plan et la vue 3D se dessinent tout seuls.</p>' + scan;
  return `<p class="muted">${n ? `${n} meuble${n > 1 ? 's' : ''} placé${n > 1 ? 's' : ''} sur le plan.` : 'La chambre à l’échelle, avec la porte, la fenêtre et les lits. L’appli propose des dispositions et vérifie que tout tient.'}</p><button class="btn soft" data-a="trPlan" data-id="${esc(rid)}">Ouvrir le plan et la 3D ›</button>${scan}`;
}
function trLive(rid) { const a = $('tr-surf'); if (a) a.innerHTML = trSurfHtml(rid); const b = $('tr-gaps'); if (b) b.innerHTML = trGapsHtml(rid); const c = $('tr-plan-card'); if (c) c.innerHTML = trPlanCardHtml(rid); }
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
  S.trCtx = rid;
  const r = trRoomGet(rid); if (!r || !S.tr) { closeSheet(); return; }
  const d = trData(rid), row = S.tr.rooms[rid], commun = isCommun(r), eq = d.eq || {};
  const test = !!r.test;
  const todo = S.tr.todo.filter((t) => t.room_id === rid && t.statut !== 'fait');
  const props = S.tr.props.filter((p) => p.room_id === rid && p.statut !== 'ecartee');
  openSheet('trroom:' + rid, `<div class="row between"><h2>${esc(trPlace(r))}</h2><button class="btn small" data-a="close">Fermer</button></div>
    <p class="tr-save" id="tr-save">${trCan() ? (trPend.length ? 'Enregistrement…' : 'Tout s’enregistre tout seul') : 'Lecture seule'}</p>
    ${test ? '<div class="robar">🧪 <span><b>Pièce d’essai</b> · elle ne compte ni dans l’avancement, ni dans la liste, ni dans les écarts de l’Archange.</span></div>' : ''}
    <div class="card"><h3>État</h3>${trSeg(rid, 'etat', d, Object.entries(TR_ETAT).map(([k, v]) => [k, v.l]), 'four')}
      ${commun ? '' : `<p class="muted">Catégorie de la chambre</p>${trSeg(rid, 'cat', d, Object.entries(TR_CAT))}`}
      <div class="form">${trSel(rid, 'etage', 'Étage', d, TR_ETAGES)}</div></div>
    <div class="card"><h3>📷 Photos</h3>${trShots(rid, commun ? TR_SHOTS_COMMUN : TR_SHOTS)}</div>
    ${(() => { const m = trMeshOf(rid); return `<div class="card"><h3>🧊 Scan 3D réel</h3>${m ? `<p class="muted">Le scan en relief de la pièce, avec ses vraies textures (marches, moulures, objets…).</p><button class="btn big pri" data-a="trMesh" data-rid="${esc(rid)}">Voir le scan 3D</button>` : '<p class="muted">Pour l’escalier, les détails et la déco : scanne la pièce avec « 3d Scanner App » (mode LiDAR), exporte en GLB, puis dépose le fichier ici.</p>'}
      ${trCan() ? `<button class="btn ${m ? '' : 'soft'}" data-a="trMeshAdd" data-rid="${esc(rid)}">${m ? 'Remplacer par un autre scan' : '📥 Déposer un scan 3D (GLB)'}</button>${m ? `<button class="btn ghost bad-t" data-a="trPhotoDel" data-id="${m.id}">Supprimer le scan 3D</button>` : ''}` : ''}</div>`; })()}
    <div class="card form"><h3>📏 Mesures (en centimètres)</h3>
      <p class="muted">De mur à mur, au sol. Avec l’iPhone : appli « Mesures ». Sinon un télémètre laser ou un mètre.</p>
      <div class="three">${trIn(rid, 'len', 'Longueur', d, { cm: 1, ph: '420' })}${trIn(rid, 'wid', 'Largeur', d, { cm: 1, ph: '310' })}${trIn(rid, 'hei', 'Hauteur', d, { cm: 1, ph: '260' })}</div>
      ${trIn(rid, 'surf', 'Pièce pas rectangulaire ? Surface réelle en m² (remplace longueur × largeur)', d, { ph: '12,5' })}
      ${commun ? '' : `<p class="muted">Salle de bain, mesurée à part</p><div class="two">${trIn(rid, 'sdb_len', 'Longueur', d, { cm: 1 })}${trIn(rid, 'sdb_wid', 'Largeur', d, { cm: 1 })}</div>`}
      <div class="tr-res" id="tr-surf">${trSurfHtml(rid)}</div>
      ${commun ? '' : `<p class="muted">Fenêtre principale (pour les rideaux)</p>
      <div class="three">${trIn(rid, 'fen_w', 'Largeur', d, { cm: 1 })}${trIn(rid, 'fen_h', 'Hauteur', d, { cm: 1 })}${trIn(rid, 'fen_allege', 'Sol → bas de fenêtre', d, { cm: 1 })}</div>
      <div class="two">${trIn(rid, 'fen_n', 'Nombre de fenêtres', d)}${trSel(rid, 'rideaux', 'Aujourd’hui', d, TR_RIDEAUX)}</div>`}</div>
    ${commun ? '' : `<div class="card"><h3>🧊 Plan et vue 3D</h3><div id="tr-plan-card" class="col">${trPlanCardHtml(rid)}</div></div>`}
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
    ${test ? `${row && row.owner_id && !trMine(rid) ? `<p class="banner sm c-slate">Projet partagé par ${esc(trPrenom(trWho(row.owner_id)))}. Tu peux le regarder et proposer ta version du plan.</p>` : ''}${trMine(rid) ? `<button class="btn" data-a="trShare" data-id="${esc(rid)}">👥 Partager ce projet${(row.shared || []).length ? ` · ${(row.shared || []).length}` : ''}</button>` : ''}${trCan() ? `<button class="btn ghost bad-t" data-a="trTestDel" data-id="${esc(rid)}">Supprimer cette pièce</button>` : ''}` : `<div class="card"><div class="row between"><h3>À faire et à acheter${todo.length ? ` · ${todo.length}` : ''}</h3>${trCan() ? `<button class="btn small soft" data-a="trTodoNew" data-rid="${esc(rid)}">＋ Ajouter</button>` : ''}</div>
      ${todo.length ? `<div class="group flat">${todo.map(trTodoRow).join('')}</div>` : '<p class="muted">Rien pour l’instant.</p>'}</div>`}
    ${props.length ? `<div class="card"><h3>💡 Idées pour ${commun ? 'cet endroit' : 'cette chambre'}</h3>${props.map(trPropCard).join('')}</div>` : ''}
    ${!test && trCan() ? (r.extra ? `<button class="btn ghost bad-t" data-a="trSpaceDel" data-id="${esc(rid)}">Supprimer cette pièce</button>` : `<button class="btn ghost" data-a="trHide" data-id="${esc(rid)}">Retirer des travaux</button><p class="muted sm">Elle disparaît du mode travaux seulement : le ménage continue de la voir. Tu pourras la remettre.</p>`) : ''}
    ${!test && r.extra && trCan() ? `<button class="btn ghost" data-a="trSpaceRename" data-id="${esc(rid)}">Renommer</button>` : ''}
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
        <label>Où est-il ?<select id="ti-room" ${trDis()}>${opt('', it.room_id || '', 'Réserve / ailleurs')}${rooms.map((r) => opt(r.id, it.room_id, trPlace(r))).join('')}</select></label></div>
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
      ${other.length ? `<div class="group flat">${other.map(({ r, g }) => `<button class="prow" data-a="trRoom" data-id="${esc(r.id)}"><span class="pr-t"><b>${esc(trPlace(r))}</b><span class="muted sm">${esc(g.t)}</span></span><span class="chev">›</span></button>`).join('')}</div>` : ''}
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
      <div class="two"><label>Où ?<select id="tt-room" ${trDis()}>${opt('', t.room_id || '', 'Tout l’hôtel')}${rooms.map((r) => opt(r.id, t.room_id, trPlace(r))).join('')}</select></label><label>Quantité<input id="tt-qty" ${trDis()} inputmode="numeric" value="${esc(t.qty || 1)}"></label></div>
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
  const keys = Object.keys(groups).sort((a, b) => ((trRoomGet(a) || {}).order || 0) - ((trRoomGet(b) || {}).order || 0));
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
    const r = trRoomGet(d.rid); if (!r) return;
    const path = await takePhoto(trShort(r) + ' · ' + d.l, false, true); if (!path) return;
    try { const x = await api('tr_photo_add', { room_id: d.rid, path, label: d.l }); S.tr.photos.push(x.photo); toast('Photo enregistrée ✓'); }
    catch (e) { toast(errMsg(e)); }
    if (trSheetRoom() === d.rid) trRoomSheet(d.rid);
  },
  async trMeshAdd(d) {
    S.trCtx = d.rid; if (!trCan()) return;
    const f = await pickFile('.glb,model/gltf-binary,application/octet-stream'); if (!f) return;
    if (!/\.glb$/i.test(f.name)) { toast('Il faut un fichier .glb (dans 3d Scanner App : Partager → GLB).', 6000); return; }
    if (f.size > 50 * 1024 * 1024) { toast('Fichier trop lourd (plus de 50 Mo). Exporte-le en qualité moyenne ou basse.', 7000); return; }
    toast('Envoi du scan… (' + Math.round(f.size / 1048576) + ' Mo)', 8000);
    try { const path = await upload(f, 'model/gltf-binary', 'glb'); const x = await api('tr_photo_add', { room_id: d.rid, path, label: 'Scan 3D' }); S.tr.photos.push(x.photo); toast('Scan 3D enregistré ✓'); }
    catch (e) { toast(errMsg(e)); return; }
    if (trSheetRoom() === d.rid) trRoomSheet(d.rid);
  },
  trMesh(d) {
    const m = trMeshOf(d.rid), u = m && trUrl(m.path), r = trRoomGet(d.rid); if (!u) { toast('Scan introuvable, réessaie dans un instant.'); return; }
    openSheet('trmesh', `<div class="row between"><h2>${esc(r ? trPlace(r) : 'Pièce')} · scan 3D</h2><button class="btn small" data-a="trMeshBack" data-rid="${esc(d.rid)}">‹ Retour</button></div>
      <div class="tr-stage"><canvas id="tr-mesh" class="tr-3d" style="touch-action:none;display:block;width:100%"></canvas><div id="tr-mesh-lab" class="tr-cap" style="position:absolute;left:12px;top:10px"></div><div class="tr-tools"><button data-a="trFull" aria-label="Plein écran">⤢</button></div></div>
      <p class="muted sm">Un doigt pour tourner, deux doigts pour s’approcher (on peut entrer dans la pièce).</p>`);
    import('./travaux-rendu.js?v=' + APP_V).then((mod) => { const cv = $('tr-mesh'); if (!cv || S.sheet !== 'trmesh') return; if (S.trMeshV) S.trMeshV.stop(); S.trMeshV = mod.trMaille({ canvas: cv, url: u, lab: $('tr-mesh-lab') }); }).catch(() => toast('La vue 3D ne s’ouvre pas sur ce téléphone.'));
  },
  trMeshBack(d) { if (S.trMeshV) { S.trMeshV.stop(); S.trMeshV = null; } trRoomSheet(d.rid); },
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
  trIkCat(d) { S.trCatK = d.k; render(); },
  trIkList(d) { const c = (S.trCat || []).find((x) => x.ref === d.ref); if (!c) return; trTodoSheet(null, { kind: 'achat', label: `${c.name} · ${c.descr || ''}`.slice(0, 200), ref: c.ref, url: trIkUrl(c), prix: c.price, magasin: 'IKEA', niveau: 'confort' }); },
  trSpaceNew() {
    if (!trCan()) return;
    openSheet('trspace', `<div class="row between"><h2>Ajouter une pièce</h2><button class="btn small" data-a="close">Annuler</button></div>
      <p class="muted">Elle compte dans les travaux de l’Archange. Elle n’apparaît pas dans l’appli du ménage.</p>
      <div class="card form"><label>Nom<input id="tr-sp-nom" maxlength="40" placeholder="Ex. Réserve, Chambre 27, Buanderie" autocomplete="off"></label>
      <label>Type<select id="tr-sp-genre">${TR_GENRES.map(([k, l]) => opt(k, 'commun', l)).join('')}</select></label>
      <button class="btn big pri" data-a="trSpaceAdd">Ajouter</button></div>`);
    setTimeout(() => { const el = $('tr-sp-nom'); if (el) el.focus(); }, 80);
  },
  trSpaceAdd() {
    if (!trCan()) return; const nom = ($('tr-sp-nom').value || '').trim().slice(0, 40), genre = $('tr-sp-genre').value;
    if (!nom) { toast('Donne un nom à la pièce.'); return; }
    const id = 'arc__x_' + Math.random().toString(36).slice(2, 10), ordre = 10 + trExtras().length;
    S.tr.rooms[id] = { room_id: id, hotel: 'arc', data: {} }; S.trCtx = id;
    trPatch(id, { nom: genre === 'chambre' && /^\d+[a-z]?$/i.test(nom) ? 'Chambre ' + nom : nom, genre, ordre }); render(); trRoomSheet(id);
  },
  trSpaceRename(d) { const r = trRoomGet(d.id); if (!r || !r.extra || !trCan()) return; const nom = (prompt('Nouveau nom', r.num) || '').trim().slice(0, 40); if (!nom) return; trPatch(d.id, { nom }); render(); trRoomSheet(d.id); },
  async trSpaceDel(d) {
    const r = trRoomGet(d.id); if (!r || !r.extra || !trCan() || !confirm(`Supprimer « ${r.num} », ses mesures, son plan et ses photos ?`)) return;
    for (let i = trPend.length - 1; i >= 0; i--) if (trPend[i].rid === d.id) trPend.splice(i, 1);
    LS.set('mh-trq', trPend);
    try { await api('tr_space_del', { room_id: d.id }); } catch (e) { toast(errMsg(e)); return; }
    delete S.tr.rooms[d.id]; S.tr.photos = S.tr.photos.filter((p) => p.room_id !== d.id); S.tr.plans = (S.tr.plans || []).filter((p) => p.room_id !== d.id); closeSheet(); render();
  },
  trHide(d) { const r = trRoomGet(d.id); if (!r || r.extra || !trCan() || !confirm(`Retirer « ${trPlace(r)} » des travaux ? Le ménage continue de la voir.`)) return; trPatch(d.id, { masque: true }); closeSheet(); render(); },
  trUnhide(d) { if (!trCan()) return; trPatch(d.id, { masque: null }); render(); },
  trTestNew() {
    if (!trPlanCan()) return;
    const mine = [...new Set(Object.values(S.tr.rooms).filter((r) => trIsTest(r.room_id) && trMine(r.room_id)).map((r) => (r.data || {}).dossier).filter(Boolean))];
    const dossier = (prompt('Nom du projet' + (mine.length ? ' (déjà créés : ' + mine.join(', ') + ')' : ''), mine[0] || 'Mon projet') || '').trim().slice(0, 40); if (!dossier) return;
    const nom = (prompt('Nom de la pièce', 'Séjour') || '').trim().slice(0, 40); if (!nom) return;
    const id = 'test__' + Math.random().toString(36).slice(2, 10);
    S.tr.rooms[id] = { room_id: id, hotel: 'test', data: {}, owner_id: S.tr.me_id, shared: [] }; S.trCtx = id; trPatch(id, { nom, dossier }); render(); trRoomSheet(id);
  },
  trShare(d) {
    const row = S.tr.rooms[d.id]; if (!row || !trMine(d.id)) return; const cur = new Set(row.shared || []);
    const people = (S.tr.people || []).filter((u) => u.id !== S.tr.me_id);
    openSheet('trshare', `<div class="row between"><h2>Partager le projet</h2><button class="btn small" data-a="trRoom" data-id="${esc(d.id)}">‹ Retour</button></div>
      <p class="muted">Les personnes cochées voient toutes les pièces de ce projet et peuvent y proposer leur version du plan. Elles ne peuvent pas modifier la tienne.</p>
      <div class="group">${people.map((u) => `<button class="prow" data-a="trShareTo" data-id="${esc(d.id)}" data-u="${esc(u.id)}"><span class="pr-t"><b>${esc(u.label)}</b></span><span class="pill ${cur.has(u.id) ? 'p-green' : 'p-plain'}">${cur.has(u.id) ? 'Partagé ✓' : 'Non'}</span></button>`).join('') || '<p class="muted">Personne d’autre n’a accès au mode travaux.</p>'}</div>`);
  },
  async trShareTo(d) {
    const row = S.tr.rooms[d.id]; if (!row || !trMine(d.id)) return; const cur = new Set(row.shared || []); if (cur.has(d.u)) cur.delete(d.u); else cur.add(d.u);
    try { await trFlush(); const x = await api('tr_share', { room_id: d.id, user_ids: [...cur] }); (x.room_ids || [d.id]).forEach((id) => { if (S.tr.rooms[id]) S.tr.rooms[id].shared = x.shared || []; }); } catch (e) { toast(errMsg(e)); return; }
    A.trShare({ id: d.id });
  },
  async trTestDel(d) {
    if (!trIsTest(d.id) || !confirm('Supprimer cette pièce d’essai, son plan et ses photos ?')) return;
    for (let i = trPend.length - 1; i >= 0; i--) if (trPend[i].rid === d.id) trPend.splice(i, 1);
    LS.set('mh-trq', trPend);
    try { await api('tr_test_del', { room_id: d.id }); } catch (e) { toast(errMsg(e)); return; }
    delete S.tr.rooms[d.id]; S.tr.photos = S.tr.photos.filter((p) => p.room_id !== d.id); closeSheet(); render();
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
    const path = await takePhoto(it.label || trType(it.type)[1], false, true); if (!path) return;
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
      if (F.back && trRoomGet(F.back)) trRoomSheet(F.back); else closeSheet();
      render();
    } catch (e) { toast(errMsg(e)); }
  },
  async trTodoDel(d) {
    if (!confirm('Supprimer cette ligne ?')) return;
    const F = S.trForm || {};
    try { await api('tr_todo_del', { id: d.id }); S.tr.todo = S.tr.todo.filter((x) => x.id !== d.id); if (F.back && trRoomGet(F.back)) trRoomSheet(F.back); else closeSheet(); render(); } catch (e) { toast(errMsg(e)); }
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
