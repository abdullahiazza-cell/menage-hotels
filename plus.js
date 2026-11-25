"use strict";
/* Ma Réception — fonctions « en plus » (v80), chargé après app.js :
   1. mode hors ligne (dernier état gardé sur le téléphone, envois mis en attente et rejoués au retour du réseau) ;
   2. objets trouvés ; 3. état des lieux au départ ; 4. stock de linge ; 5. carnet de santé des chambres ;
   6. tutos animés avec voix ; 7. texte écrit des vocaux (français).
   app.js appelle ces fonctions seulement si elles existent : sans ce fichier, l'appli marche comme avant. */

// Chaque nouveauté a son interrupteur (Réglages → Nouveautés). Tant qu'il est éteint, seul le propriétaire la voit et peut l'essayer ;
// l'équipe garde exactement l'appli d'avant. Allumé : tout le monde l'a.
const PLUS_F = [['lost', '🎒 Objets trouvés', 'Bouton « Objet trouvé » pour l’équipe, liste pour les gérants'], ['edl', '🔍 État des lieux au départ', 'Obligatoire avant « Terminé » sur une chambre à blanc'],
  ['linge', '🧺 Stock de linge', 'Comptage par l’équipe, alerte quand il en manque'], ['carnet', '📒 Carnets des chambres', 'Pannes, travaux, coûts, âge du matelas (gérants et intendant)'],
  ['off', '📶 Mode hors ligne', 'Ménage, photos et signalements gardés dans le téléphone sans réseau'], ['tuto', '🎬 Tutos avec la voix', 'Bouton « ? » et « Comment faire ? »'], ['txt', '📝 Texte des vocaux', 'Les vocaux en français écrits sous le message (gérants et intendant)']];
const pOn = (k) => !!S.me && (S.me.role === 'owner' || !!((S.cfg || {}).plus || {})[k]);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
S.plus = { stt: false, linge: [], lost: [], edl: [] };
RO_OK.push('linen_log', 'carnet_get', 'tuto_urls');
Object.assign(ERR, {
  photo: 'Prends d’abord la photo.', no_stt: 'Le texte des vocaux n’est pas encore branché.', stt_fail: 'Ce vocal n’a pas pu être mis en texte.', format: 'Ce vocal est trop ancien pour être mis en texte.',
});

/* =====================================================================
   1. HORS LIGNE
   ===================================================================== */
const OFF = { dbp: null, box: [], flushing: false, offline: false, saved: 0, fails: LS.get('mh-off-fails', []), ready: null };
function offDb() {
  return OFF.dbp || (OFF.dbp = new Promise((res, rej) => {
    let q; try { q = indexedDB.open('mh-off', 1); } catch (e) { rej(e); return; }
    q.onupgradeneeded = () => { const d = q.result; d.createObjectStore('kv'); d.createObjectStore('blobs'); d.createObjectStore('outbox', { keyPath: 'id' }); };
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  }));
}
async function idb(store, mode, fn) {
  const d = await offDb();
  return new Promise((res, rej) => { const tx = d.transaction(store, mode); const r = fn(tx.objectStore(store)); tx.oncomplete = () => res(r ? r.result : undefined); tx.onerror = tx.onabort = () => rej(tx.error); });
}
const offEnabled = () => LS.get('mh-plus-off', false);
const isNetErr = (e) => !!e && (e.code === 'net' || e.name === 'TypeError' || e.name === 'AbortError' || (e.code === 'upload' && navigator.onLine === false));
const hasLocal = (p) => JSON.stringify(p).includes('"local:');

// Ce qui peut partir plus tard, et ce que l'écran montre en attendant.
const OFF_Q = {
  room_start(p) { const r = S.rooms[p.id]; if (r && r.status === 'a_faire') { r.status = 'en_cours'; r.startedAt = p._at; } },
  room_finish(p) { const r = S.rooms[p.id]; if (r && r.status !== 'a_controler') { const st = r.startedAt || p._at; r.status = 'a_controler'; r.doneAt = p._at; r.doneBy = S.me.id; r.rejectNote = null; r.lastJob = { uid: S.me.id, photos: p.photos || [], start: st, end: p._at, type: r.type }; } },
  issue_create() {},
  msg_send(p, e) { if (!S.msgs.some((m) => m.id === e.id)) S.msgs.push({ id: e.id, conv: p.conv || 'staff:' + S.me.id, from_staff: S.me.id, text: p.text || null, media_path: p.media_path || null, media_type: p.media_path ? 'audio' : null, duration: p.duration || null, hotel: p.hotel || null, room: p.room || null, created_at: new Date(p._at).toISOString(), pending: true }); },
  lost_add(p, e) { if (!S.plus.lost.some((x) => x.id === e.id)) S.plus.lost.unshift({ id: e.id, hotel: p.hotel, room: p.room, kind: p.kind, descr: p.descr, photo: p.photo, found_by: S.me.id, found_at: new Date(p._at).toISOString(), statut: 'garde', pending: true }); },
  checkout_add(p, e) { if (!S.plus.edl.some((x) => x.id === e.id)) S.plus.edl.unshift({ id: e.id, room_id: p.room_id, hotel: p.hotel, room: p.room, ok: !(p.items || []).length, items: p.items || [], by_staff: S.me.id, created_at: new Date(p._at).toISOString(), pending: true }); },
  linen_set(p) { let row = S.plus.linge.find((x) => x.hotel === p.hotel && x.item === p.item); if (!row) { row = { hotel: p.hotel, item: p.item, qty: 0, seuil: 0 }; S.plus.linge.push(row); } if (p.qty != null) row.qty = p.qty; else if (p.delta) row.qty = Math.max(0, row.qty + p.delta); },
};
const OFF_L = { room_start: 'Début de ménage', room_finish: 'Ménage terminé', issue_create: 'Problème signalé', msg_send: 'Message', lost_add: 'Objet trouvé', checkout_add: 'État des lieux', linen_set: 'Linge' };
function offApply(e) { try { if (S.me && OFF_Q[e.a]) OFF_Q[e.a](e.payload, e); } catch (_) {} }

// Photo ou vocal qui n'a pas pu partir : gardé sur le téléphone, envoyé plus tard.
async function offKeep(blob, type, ext, err) {
  if (!offEnabled() || !isNetErr(err) || !blob || blob.size > 8 * 1024 * 1024) return null;
  const key = 'local:' + uuid() + '.' + ext;
  try { await idb('blobs', 'readwrite', (st) => st.put({ blob, type, ext, at: Date.now() }, key)); } catch (_) { return null; }
  S.localUrls[key] = URL.createObjectURL(blob);
  offMark(true);
  return key;
}
async function offUploadKey(key) {
  const rec = await idb('blobs', 'readonly', (st) => st.get(key));
  if (!rec) return null; // déjà envoyé ou perdu : le serveur ignorera la référence
  const u = await offSend('upload_url', { ext: rec.ext });
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 60000);
  let r; try { r = await fetch(u.url, { method: 'PUT', headers: { 'content-type': rec.type, 'x-upsert': 'false' }, body: rec.blob, signal: ctl.signal }); } finally { clearTimeout(tm); }
  if (!r.ok) { const e = new Error('upload'); e.code = 'net'; throw e; }
  S.localUrls[u.path] = S.localUrls[key] || URL.createObjectURL(rec.blob);
  await idb('blobs', 'readwrite', (st) => st.delete(key)).catch(() => {});
  return u.path;
}
// Remplace partout les références « local:… » par le vrai chemin, une fois le fichier envoyé. « map » retient ce qui est déjà parti.
async function offResolve(payload, map) {
  const walk = async (v) => {
    if (typeof v === 'string' && v.startsWith('local:')) { if (!(v in map)) map[v] = await offUploadKey(v); return map[v]; }
    if (Array.isArray(v)) { const o = []; for (const x of v) o.push(await walk(x)); return o; }
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = await walk(v[k]); return o; }
    return v;
  };
  return await walk(payload);
}
// Appel direct à l'API, avec une limite de temps (un mauvais réseau ne doit pas tout bloquer).
async function offSend(a, payload) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 25000);
  let r;
  try { r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-device': S.secret }, body: JSON.stringify({ a, ...payload }), signal: ctl.signal }); }
  catch (e) { const err = new Error('net'); err.code = 'net'; throw err; }
  finally { clearTimeout(tm); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const err = new Error(j.error || 'server'); err.code = (r.status >= 500 || j.error === 'auth') ? 'net' : (j.error || 'server'); throw err; }
  return j;
}
async function offQueue(a, payload) {
  if (!offEnabled() || !OFF_Q[a] || !S.me) return null;
  const e = { id: uuid(), a, payload: { ...payload, _at: payload._at || Date.now() }, map: {}, at: Date.now() };
  e.payload._qid = e.id;
  try { await idb('outbox', 'readwrite', (st) => st.put(e)); } catch (_) { return null; }
  OFF.box.push(e); offApply(e); offMark(true);
  setTimeout(() => { toast('📶 Pas de réseau : c’est gardé dans le téléphone, ça partira tout seul.', 5000); softRender(); }, 60);
  return { ok: true, queued: true };
}
// Avant chaque appel : d'abord vider la file (pour garder l'ordre), puis envoyer les fichiers restés sur le téléphone.
async function offPrep(a, payload) {
  if (a === 'upload_url' || a === 'state') return null;
  if (OFF.ready) await OFF.ready;
  if (OFF.box.length && !OFF.flushing) { await offFlush(); if (OFF.box.length && OFF_Q[a]) return await offQueue(a, payload); }
  if (!hasLocal(payload)) return null;
  try { return { payload: await offResolve(payload, {}) }; }
  catch (e) { if (isNetErr(e)) { const q = await offQueue(a, payload); if (q) return q; const err = new Error('net'); err.code = 'net'; throw err; } throw e; }
}
async function offFlush() {
  if (OFF.flushing || !OFF.box.length || !S.secret) return;
  OFF.flushing = true; offBar();
  try {
    while (OFF.box.length) {
      const e = OFF.box[0];
      try {
        const p = await offResolve(e.payload, e.map);
        await idb('outbox', 'readwrite', (st) => st.put(e)).catch(() => {});
        await offSend(e.a, p);
      } catch (err) {
        if (isNetErr(err)) break;
        if (!(e.a === 'room_finish' && err.code === 'not_started')) { OFF.fails.unshift({ a: e.a, at: e.at, code: err.code || '?' }); OFF.fails = OFF.fails.slice(0, 10); LS.set('mh-off-fails', OFF.fails); toast(`Un envoi gardé n’a pas été accepté (${OFF_L[e.a] || e.a}) : ${errMsg(err)}`, 7000); }
      }
      OFF.box.shift(); await idb('outbox', 'readwrite', (st) => st.delete(e.id)).catch(() => {});
    }
  } finally { OFF.flushing = false; offBar(); }
}
// Dernier état reçu : gardé pour rouvrir l'appli sans réseau.
function offSave(d) {
  OFF.offline = false; offBar();
  if (!offEnabled() || Date.now() - OFF.saved < 60000) return; OFF.saved = Date.now();
  idb('kv', 'readwrite', (st) => st.put({ d, at: Date.now() }, 'state')).catch(() => {});
}
async function offLoad() { if (!offEnabled()) return null; try { const x = await idb('kv', 'readonly', (st) => st.get('state')); return x && x.d && x.d.me ? x : null; } catch (_) { return null; } }
function offMark(on) { OFF.offline = !!on && offEnabled(); offBar(); }
function offBar() {
  let b = $('offbar'); const n = OFF.box.length;
  if (!OFF.offline && !n) { if (b) b.hidden = true; return; }
  if (!b) { b = document.createElement('button'); b.id = 'offbar'; b.dataset.a = 'offInfo'; document.body.appendChild(b); }
  b.hidden = false; b.className = OFF.offline ? 'off' : 'sync';
  b.textContent = OFF.offline ? `📶 Hors ligne${n ? ` · ${n} envoi${n > 1 ? 's' : ''} en attente` : ''}` : `⏫ ${n} envoi${n > 1 ? 's' : ''} en cours…`;
}
OFF.ready = (async () => {
  try {
    const d = await offDb();
    OFF.box = await new Promise((res) => { const q = d.transaction('outbox').objectStore('outbox').getAll(); q.onsuccess = () => res((q.result || []).sort((a, b) => a.at - b.at)); q.onerror = () => res([]); });
    // Les fichiers gardés redeviennent visibles ; ceux de plus de 10 jours sont effacés.
    await new Promise((res) => {
      const tx = d.transaction('blobs', 'readwrite'), st = tx.objectStore('blobs'), c = st.openCursor();
      c.onsuccess = () => { const cur = c.result; if (!cur) return; if (Date.now() - (cur.value.at || 0) > 10 * 864e5) cur.delete(); else S.localUrls[cur.key] = URL.createObjectURL(cur.value.blob); cur.continue(); };
      tx.oncomplete = res; tx.onerror = res;
    });
  } catch (_) { /* pas de stockage : l'appli marche sans mode hors ligne */ }
  OFF.ready = null; offBar();
})();
window.addEventListener('online', () => { refresh(true); });
window.addEventListener('offline', () => offMark(true));
// Appelé par app.js après chaque état reçu (ou relu sur le téléphone).
function plusApply(d) {
  S.plus = Object.assign({ stt: false, linge: [], lost: [], edl: [] }, d.plus || {});
  LS.set('mh-plus-off', pOn('off'));
  OFF.box.forEach(offApply);
}

/* =====================================================================
   2. OBJETS TROUVÉS
   ===================================================================== */
const LOST_KINDS = [{ k: 'tel', e: '📱', l: 'Téléphone, chargeur' }, { k: 'vetement', e: '👕', l: 'Vêtement' }, { k: 'bijou', e: '💍', l: 'Bijou, montre' }, { k: 'papiers', e: '🪪', l: 'Papiers, carte' },
  { k: 'argent', e: '💶', l: 'Argent' }, { k: 'cles', e: '🔑', l: 'Clés' }, { k: 'toilette', e: '🧴', l: 'Affaires de toilette' }, { k: 'autre', e: '🎁', l: 'Autre' }];
const lostK = (k) => LOST_KINDS.find((x) => x.k === k) || LOST_KINDS[LOST_KINDS.length - 1];
const whereL = (hotel, room) => `${H(hotel).e} ${hotelName(hotel)}${room ? (/^\d/.test(room) ? ' · ch. ' : ' · ') + room : ''}`;
const whereSel = (p, kh, kr) => p.fixedRoom ? `<p><b>${esc(whereL(p.hotel, p.room))}</b></p>` : `<div class="row">
  <select data-change="${kh}" aria-label="Hôtel">${myHotels().map((h) => `<option value="${h}" ${p.hotel === h ? 'selected' : ''}>${H(h).e} ${esc(hotelName(h))}</option>`).join('')}</select>
  <select data-change="${kr}" aria-label="Chambre"><option value="">Autre endroit</option>${roomsOf(p.hotel).map((x) => `<option value="${esc(x.num)}" ${p.room === x.num ? 'selected' : ''}>Chambre ${esc(x.num)}</option>`).join('')}${communsOf(p.hotel).map((x) => `<option value="${esc(x.num)}" ${p.room === x.num ? 'selected' : ''}>${esc(x.num)}</option>`).join('')}</select></div>`;
function lostSheet(roomId) {
  const r = roomId && S.rooms[roomId];
  S.lostF = { hotel: r ? r.hotel : (isMgr() && !S.preview ? S.hotel : myHotels()[0]), room: r ? r.num : '', fixedRoom: !!r, kind: null, photo: null, descr: '', busy: false };
  drawLost();
}
function drawLost() {
  const p = S.lostF; if (!p) return; const u = mediaUrl(p.photo);
  openSheet('lost', `${sheetHead('🎒 Objet trouvé' + helpBtn('objet'))}<p class="muted">Où ?</p>${whereSel(p, 'lostHotel', 'lostRoom')}
    <div class="shots one"><button class="shot ${p.photo ? 'done' : ''}" data-a="lostPhoto" aria-label="Photo de l’objet">${p.photo ? (u ? `<img alt="" src="${esc(u)}">` : '<span class="cam">✅</span>') + '<span class="lbl">✓ Photo</span>' : `<span class="cam">${p.busy ? '⏳' : '📷'}</span><span>Photo de l’objet</span>`}</button></div>
    <p class="muted">C’est quoi ?</p>
    <div class="kinds">${LOST_KINDS.map((k) => `<button data-a="lostKind" data-k="${k.k}" aria-pressed="${p.kind === k.k}"><span class="e">${k.e}</span>${esc(k.l)}</button>`).join('')}</div>
    <textarea placeholder="Écrire (facultatif) : couleur, marque…" data-input="lostText">${esc(p.descr || '')}</textarea>
    <button class="btn big pri" data-a="lostSend">Envoyer</button>
    <p class="muted">Ensuite, range l’objet à la réception.</p>`);
}
// À qui est l'objet, peut-être : la personne logée dans cette chambre ce jour-là, ou partie depuis 2 jours au plus.
function lostOwner(it) {
  if (!it.room || !S.reg || !S.reg.occ || !S.reg.occ.length) return null;
  const r = Object.values(S.rooms).find((x) => x.hotel === it.hotel && x.num === it.room); if (!r) return null;
  const day = dayStr(ts(it.found_at)), lim = addDaysISO(day, -2);
  const L = S.reg.occ.filter((o) => o.room_id === r.id && o.entree && o.entree <= day && (!o.sortie || o.sortie >= lim));
  // D'abord la personne qui vient de partir (ménage à blanc) ; sinon celle qui est encore logée.
  return L.filter((o) => o.statut === 'sorti').sort((a, b) => String(b.sortie).localeCompare(String(a.sortie)))[0] || L[0] || null;
}
function lostCard(it) {
  const K = lostK(it.kind), u = mediaUrl(it.photo), days = Math.floor((Date.now() - ts(it.found_at)) / 864e5), own = lostOwner(it), kept = it.statut === 'garde';
  return `<div class="card lostc"><div class="lost-top">
      ${it.photo ? `<button class="lost-ph" data-a="zoom" data-id="${esc(it.photo)}" data-l="Objet trouvé">${u ? `<img loading="lazy" alt="" src="${esc(u)}">` : '<span>📷</span>'}</button>` : ''}
      <div class="col" style="gap:4px;flex:1;min-width:0"><h3>${K.e} ${esc(K.l)}</h3><span class="muted">${esc(whereL(it.hotel, it.room))}</span>
        <span class="muted">Trouvé ${when(it.found_at)} par ${esc(first(nameOf(it.found_by)))}</span>
        <div class="chips">${it.pending ? '<span class="chip c-amber">📶 en attente d’envoi</span>' : ''}${kept ? `<span class="chip ${days > 60 ? 'c-amber' : 'c-plain'}">${days < 1 ? 'aujourd’hui' : 'depuis ' + days + ' j'}</span>` : `<span class="chip ${it.statut === 'rendu' ? 'c-green' : 'c-plain'}">${it.statut === 'rendu' ? '✅ Rendu' : '🗑️ Jeté ou donné'}${it.closed_at ? ' ' + when(it.closed_at) : ''}</span>`}</div></div></div>
    ${it.descr ? `<p>${esc(it.descr)}</p>` : ''}
    ${it.closed_note ? `<p class="muted">${esc(it.closed_note)}</p>` : ''}
    ${own && kept ? `<div class="row between"><span class="muted">Peut-être à <b>${esc(occName(own))}</b>${own.statut === 'sorti' ? ` (parti le ${fdate(own.sortie).slice(0, 5)})` : ' (encore logé)'}</span>${callBtn(own.telephone, occName(own))}</div>` : ''}
    ${kept && !it.pending && role() !== 'menage' ? `<div class="row"><input data-change="lostPlace" data-id="${it.id}" value="${esc(it.place || '')}" placeholder="📦 Rangé où ? (tiroir, bureau…)" style="flex:1;min-width:150px" aria-label="Lieu de rangement"></div>
      <div class="row"><button class="btn ok" data-a="lostBack" data-id="${it.id}">✅ Rendu</button><button class="btn" data-a="lostOut" data-id="${it.id}">🗑️ Jeté ou donné</button></div>` : ''}
    ${!kept && isMgr() ? `<div class="row"><button class="btn small" data-a="lostKeep" data-id="${it.id}">↩︎ Remettre « gardé »</button><button class="btn small bad" data-a="lostDel" data-id="${it.id}">Supprimer la fiche</button></div>` : ''}</div>`;
}
function viewLost() {
  const all = scoped(S.plus.lost), kept = all.filter((x) => x.statut === 'garde'), done = all.filter((x) => x.statut !== 'garde');
  const L = S.lf === 'done' ? done : kept;
  return `${scopeSeg(S.plus.lost.filter((x) => (S.lf === 'done') === (x.statut !== 'garde')))}
    <div class="segc" role="group" aria-label="Filtre"><button data-a="lostF" data-k="kept" aria-pressed="${S.lf !== 'done'}">Gardés <span class="cnt">${kept.length}</span></button><button data-a="lostF" data-k="done" aria-pressed="${S.lf === 'done'}">Rendus ou jetés <span class="cnt">${done.length}</span></button></div>
    ${L.length ? L.map(lostCard).join('') : `<div class="card empty"><div class="e">🎒</div><h3>${S.lf === 'done' ? 'Rien pour l’instant' : 'Aucun objet gardé'}</h3><p class="muted">Quand quelqu’un trouve un objet, il le prend en photo avec « Objet trouvé » et il arrive ici.</p></div>`}`;
}

/* =====================================================================
   3. ÉTAT DES LIEUX AU DÉPART
   ===================================================================== */
const EDL_KINDS = [{ k: 'literie', e: '🛏️', l: 'Literie tachée, abîmée' }, { k: 'meuble', e: '🪑', l: 'Meuble cassé' }, { k: 'tv', e: '📺', l: 'TV, télécommande' }, { k: 'tabac', e: '🚬', l: 'Odeur de tabac' },
  { k: 'mur', e: '🚪', l: 'Mur, porte abîmés' }, { k: 'sdb', e: '🚿', l: 'Salle de bain abîmée' }, { k: 'linge', e: '🧺', l: 'Linge manquant' }, { k: 'cle', e: '🔑', l: 'Clé non rendue' },
  { k: 'sale', e: '🗑️', l: 'Très sale' }, { k: 'autre', e: '❓', l: 'Autre' }];
const edlK = (k) => EDL_KINDS.find((x) => x.k === k) || EDL_KINDS[EDL_KINDS.length - 1];
const edlNeeded = (r) => !!r && pOn('edl') && r.type === 'blanc' && !isCommun(r);
function edlDone(r) {
  const w = S.work[r.id]; if (w && w.edl) return w.edl;
  const c = S.plus.edl.find((x) => x.room_id === r.id && ts(x.created_at) > (r.startedAt || Date.now()) - 6 * 3600e3);
  return c ? { ok: c.ok, n: (c.items || []).length } : null;
}
// Carte en haut de la chambre « à blanc » (appelée par app.js).
function edlCard(r) {
  if (!edlNeeded(r) || r.status !== 'en_cours') return '';
  const d = edlDone(r);
  if (d) return `<div class="banner ${d.ok ? 'c-green' : 'c-amber'}">🔍 État des lieux fait : ${d.ok ? 'rien à signaler' : (d.n || '') + ' dégât' + (d.n > 1 ? 's' : '') + ' signalé' + (d.n > 1 ? 's' : '')} ✓</div>`;
  return `<div class="card edlq" id="edlq"><h3>🔍 D’abord, regarde la chambre</h3><p class="muted">Le client a-t-il cassé, sali ou pris quelque chose ?</p>
    <div class="edl2"><button class="btn ok" data-a="edlOk" data-id="${r.id}"><span class="e">👍</span>Tout va bien</button><button class="btn bad" data-a="edlBad" data-id="${r.id}"><span class="e">⚠️</span>Il y a un problème</button></div></div>`;
}
// Empêche de terminer une chambre à blanc sans état des lieux (appelée par app.js).
function edlBlock(r) {
  if (!edlNeeded(r) || edlDone(r)) return false;
  toast('Fais d’abord l’état des lieux, en haut : 👍 ou ⚠️.', 5000);
  const q = $('edlq'); if (q) { q.scrollIntoView({ behavior: 'smooth', block: 'center' }); q.classList.add('shake'); setTimeout(() => q.classList.remove('shake'), 900); }
  return true;
}
function edlSheet(roomId) { const r = S.rooms[roomId]; if (!r) return; S.edlF = { room_id: r.id, hotel: r.hotel, room: r.num, order: [], items: {}, busy: null }; drawEdl(true); }
function drawEdl(top) {
  const p = S.edlF; if (!p) return; const panel = document.querySelector('#sheet .panel'), sc = panel ? panel.scrollTop : 0;
  const item = (k) => { const K = edlK(k), it = p.items[k], u = mediaUrl(it.photo);
    return `<div class="item"><div class="hd"><span class="e" aria-hidden="true">${K.e}</span><b>${esc(K.l)}</b><button class="x" data-a="edlKind" data-k="${k}" aria-label="Enlever ${esc(K.l)}">✕</button></div>
      <div class="row"><button class="btn ${it.photo ? 'ok' : 'pri'}" data-a="edlPhoto" data-k="${k}" style="flex:1">${it.photo ? '✅ Photo prise' : (p.busy === k ? '⏳ Envoi…' : '📷 Prendre la photo')}</button>${u ? `<img class="mini" alt="" src="${esc(u)}">` : ''}</div>
      <textarea placeholder="Écrire (facultatif)" data-input="edlText" data-k="${k}">${esc(it.text || '')}</textarea></div>`; };
  openSheet('edl', `${sheetHead('⚠️ Dégâts au départ' + helpBtn('menage'))}<p><b>${esc(whereL(p.hotel, p.room))}</b></p>
    <p class="muted">Touche ce qui ne va pas (plusieurs possibles), puis prends une photo de chaque chose. La photo sert de preuve.</p>
    <div class="kinds">${EDL_KINDS.map((k) => `<button data-a="edlKind" data-k="${k.k}" aria-pressed="${!!p.items[k.k]}"><span class="e">${k.e}</span>${esc(k.l)}</button>`).join('')}</div>
    ${p.order.map(item).join('')}
    <button class="btn big pri" data-a="edlSend">Envoyer</button>`);
  const np = document.querySelector('#sheet .panel'); if (np && !top) np.scrollTop = sc;
}
const edlTodo = () => scoped(S.plus.edl).filter((c) => !c.ok && !c.seen_at);
const EDL_SUITES = ['Caution retenue', 'Client prévenu', 'Réparation demandée', 'Rien à faire'];
function edlMgrCard(c) {
  const occ = c.occupant_id ? occById(c.occupant_id) : null;
  return `<div class="card"><div class="row between"><h3>${esc(whereL(c.hotel, c.room))}</h3><span class="chip ${c.seen_at ? 'c-green' : 'c-red'}">${c.seen_at ? '✓ Vu' : 'À voir'}</span></div>
    <span class="muted">${when(c.created_at)} · par ${esc(first(nameOf(c.by_staff)))}</span>
    ${c.occupant_nom ? `<div class="row between"><span>Client parti : <b>${esc(c.occupant_nom)}</b></span>${occ ? callBtn(occ.telephone, c.occupant_nom) : ''}</div>` : '<span class="muted">Client non retrouvé dans le registre pour cette chambre.</span>'}
    ${(c.items || []).map((i) => { const K = edlK(i.k), u = mediaUrl(i.photo); return `<div class="li"><span class="t"><b>${K.e} ${esc(K.l)}</b>${i.text ? `<br><span class="muted">${esc(i.text)}</span>` : ''}</span>${i.photo ? `<button class="lost-ph sm" data-a="zoom" data-id="${esc(i.photo)}" data-l="${esc(K.l)}">${u ? `<img loading="lazy" alt="" src="${esc(u)}">` : '📷'}</button>` : '<span class="muted">sans photo</span>'}</div>`; }).join('')}
    ${c.suite ? `<p class="muted">Suite donnée : ${esc(c.suite)}${c.seen_by ? ' · ' + esc(first(nameOf(c.seen_by))) : ''}</p>` : ''}
    ${isMgr() ? (c.seen_at ? `<button class="btn small" data-a="edlUnseen" data-id="${c.id}">↩︎ Remettre « à voir »</button>` : `<p class="muted">Suite donnée :</p><div class="chips">${EDL_SUITES.map((s) => `<button class="chip c-plain" data-a="edlSeen" data-id="${c.id}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>`) : ''}</div>`;
}
function viewEdl() {
  const all = scoped(S.plus.edl), bad = all.filter((c) => !c.ok), todo = bad.filter((c) => !c.seen_at), seen = bad.filter((c) => c.seen_at), okN = all.filter((c) => c.ok).length;
  const L = S.ef === 'seen' ? seen : todo;
  return `${scopeSeg(S.plus.edl.filter((c) => !c.ok && (S.ef === 'seen') === !!c.seen_at))}
    <div class="segc" role="group" aria-label="Filtre"><button data-a="edlF" data-k="todo" aria-pressed="${S.ef !== 'seen'}">À voir <span class="cnt">${todo.length}</span></button><button data-a="edlF" data-k="seen" aria-pressed="${S.ef === 'seen'}">Vus <span class="cnt">${seen.length}</span></button></div>
    <p class="muted sm">Sur 60 jours : ${all.length} état${all.length > 1 ? 's' : ''} des lieux, dont ${okN} sans rien à signaler et ${bad.length} avec dégâts.${(cfg().plus || {}).edl ? '' : ' ⚠️ Pas encore demandé à l’équipe : à allumer dans Réglages → Nouveautés.'}</p>
    ${L.length ? L.map(edlMgrCard).join('') : `<div class="card empty"><div class="e">${S.ef === 'seen' ? '🗂️' : '✅'}</div><h3>${S.ef === 'seen' ? 'Rien de classé' : 'Aucun dégât à voir'}</h3><p class="muted">À chaque chambre « à blanc », la personne qui nettoie dit si tout va bien ou prend les dégâts en photo.</p></div>`}`;
}

/* =====================================================================
   4. STOCK DE LINGE
   ===================================================================== */
const LINGE = [{ id: 'drap1', e: '🛏️', l: 'Draps 1 personne' }, { id: 'drap2', e: '🛌', l: 'Draps 2 personnes' }, { id: 'housse', e: '🧵', l: 'Housses de couette' }, { id: 'taie', e: '💤', l: 'Taies d’oreiller' },
  { id: 'serv_g', e: '🧖', l: 'Grandes serviettes' }, { id: 'serv_p', e: '🧻', l: 'Petites serviettes' }, { id: 'tapis', e: '🦶', l: 'Tapis de bain' }, { id: 'alese', e: '🛡️', l: 'Alèses' }];
const lingeCat = () => { const L = (S.cfg || {}).linge; return Array.isArray(L) && L.length ? L : LINGE; };
const LQ = {}; // touches sur + et − regroupées avant l'envoi : { 'arc|drap1': { d: en attente, s: en cours d'envoi, t: minuteur } }
const lingeRow = (h, i) => S.plus.linge.find((x) => x.hotel === h && x.item === i) || { hotel: h, item: i, qty: 0, seuil: 0 };
const lingeQty = (h, i) => { const q = LQ[h + '|' + i]; return Math.max(0, lingeRow(h, i).qty + (q ? q.d + q.s : 0)); };
const lingeLow = (h) => lingeCat().filter((it) => { const r = lingeRow(h, it.id); return r.seuil > 0 && lingeQty(h, it.id) < r.seuil; });
const lingeLowAll = () => (isMgr() ? HOTELS.map((h) => h.id).filter((h) => S.scope === 'all' || S.scope === h) : myHotels()).reduce((n, h) => n + lingeLow(h).length, 0);
function lingeTap(h, i, d) {
  const k = h + '|' + i, q = LQ[k] || (LQ[k] = { d: 0, s: 0, t: null });
  if (lingeQty(h, i) + d < 0) return;
  q.d += d; clearTimeout(q.t);
  q.t = setTimeout(async () => {
    const n = q.d; if (!n) return; q.d = 0; q.s += n;
    try { const res = await api('linen_set', { hotel: h, item: i, delta: n }); if (!res.queued) { let row = S.plus.linge.find((x) => x.hotel === h && x.item === i); if (!row) { row = { hotel: h, item: i, qty: 0, seuil: 0 }; S.plus.linge.push(row); } row.qty = res.qty != null ? res.qty : Math.max(0, row.qty + n); } }
    catch (e) { toast(errMsg(e)); }
    q.s -= n; drawLinge();
  }, 900);
  drawLinge();
}
function lingeBody() {
  const hs = isMgr() && !S.preview ? HOTELS.map((x) => x.id).filter((x) => !S.me.only_hotel || S.me.only_hotel === x) : myHotels();
  if (!hs.includes(S.lh)) S.lh = hs.includes(S.hotel) ? S.hotel : hs[0];
  const h = S.lh, mgr = role() === 'mgr', low = lingeLow(h);
  const row = (it) => { const r = lingeRow(h, it.id), q = lingeQty(h, it.id), isLow = r.seuil > 0 && q < r.seuil;
    return `<div class="lrow ${isLow ? 'low' : ''}"><span class="le" aria-hidden="true">${esc(it.e)}</span><span class="ll"><b>${esc(it.l)}</b>${isLow ? `<span class="chip c-red">Bas (minimum ${r.seuil})</span>` : (r.seuil ? `<span class="muted sm">alerte sous ${r.seuil}</span>` : '')}</span>
      ${S.lmode === 'count' ? `<input class="lnum" type="number" inputmode="numeric" min="0" max="9999" value="${q}" data-change="linCount" data-i="${esc(it.id)}" aria-label="Nombre de ${esc(it.l)}">`
      : S.lmode === 'seuil' ? `<input class="lnum" type="number" inputmode="numeric" min="0" max="9999" value="${r.seuil || ''}" placeholder="0" data-change="linSeuil" data-i="${esc(it.id)}" aria-label="Seuil d’alerte ${esc(it.l)}">`
      : `<button class="lbtn" data-a="linTap" data-i="${esc(it.id)}" data-d="-1" aria-label="Enlever un">−</button><b class="lq">${q}</b><button class="lbtn plus" data-a="linTap" data-i="${esc(it.id)}" data-d="1" aria-label="Ajouter un">+</button>`}
      ${mgr && S.lmode === 'seuil' && lingeCat() !== LINGE ? `<button class="x" data-a="linDel" data-i="${esc(it.id)}" aria-label="Retirer ${esc(it.l)}">✕</button>` : ''}</div>`; };
  return `${hs.length > 1 ? `<div class="segc" role="group" aria-label="Hôtel">${hs.map((x) => `<button data-a="linHotel" data-k="${x}" aria-pressed="${h === x}">${esc(x === 'par' ? 'Paris' : hotelName(x))}${lingeLow(x).length ? ' <span class="cnt">' + lingeLow(x).length + '</span>' : ''}</button>`).join('')}</div>` : ''}
    ${low.length ? `<div class="banner c-red">🧺 Linge bientôt en manque : ${low.map((x) => esc(x.l)).join(', ')}</div>` : ''}
    <p class="muted">${S.lmode === 'count' ? 'Écris le nombre de pièces propres qu’il y a vraiment en réserve.' : S.lmode === 'seuil' ? 'Seuil d’alerte : en dessous de ce nombre, les gérants reçoivent une notification.' : 'Linge propre en réserve. Touche + quand il en arrive, − quand tu en prends.'}</p>
    <div class="lrows">${lingeCat().map(row).join('')}</div>
    ${mgr && S.lmode === 'seuil' ? `<div class="row"><input id="lin-add" placeholder="Ajouter un linge (ex. : Peignoirs)" style="flex:1"><button class="btn small" data-a="linAdd">Ajouter</button></div>` : ''}
    <div class="row"><button class="btn ${S.lmode === 'count' ? 'pri' : ''}" data-a="linMode" data-k="count">${S.lmode === 'count' ? '✓ Fini de compter' : '✏️ Recompter'}</button>
      ${mgr ? `<button class="btn ${S.lmode === 'seuil' ? 'pri' : ''}" data-a="linMode" data-k="seuil">${S.lmode === 'seuil' ? '✓ Fini' : '⚙️ Seuils d’alerte'}</button>` : ''}
      ${role() !== 'menage' ? `<button class="btn" data-a="linLog">🕘 Historique</button>` : ''}</div>`;
}
const viewLinge = () => lingeBody();
function lingeSheet() { openSheet('linge', `${sheetHead('🧺 Linge' + helpBtn('linge'))}${lingeBody()}`); }
function drawLinge() { if (S.sheet === 'linge') lingeSheet(); else if (S.tab === 'linge' && !isTyping()) render(); }

/* =====================================================================
   5. CARNET DE SANTÉ DES CHAMBRES
   ===================================================================== */
const CK = [{ k: 'matelas', e: '🛏️', l: 'Matelas neuf', age: 'Matelas' }, { k: 'literie', e: '🛌', l: 'Sommier, literie', age: 'Sommier, literie' }, { k: 'peinture', e: '🎨', l: 'Peinture, murs', age: 'Peinture' }, { k: 'sol', e: '🧱', l: 'Sol', age: 'Sol' },
  { k: 'mobilier', e: '🪑', l: 'Mobilier, rideaux', age: 'Mobilier' }, { k: 'equipement', e: '📺', l: 'TV, équipement', age: 'TV, équipement' }, { k: 'plomberie', e: '🚿', l: 'Plomberie' }, { k: 'electricite', e: '⚡', l: 'Électricité' },
  { k: 'nuisibles', e: '🐜', l: 'Traitement nuisibles' }, { k: 'controle', e: '🔎', l: 'Contrôle, visite' }, { k: 'note', e: '📝', l: 'Note' }];
const ckOf = (k) => CK.find((x) => x.k === k) || CK[CK.length - 1];
const euro = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
function ageTxt(iso) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso + 'T12:00:00')) / (30.44 * 864e5)));
  return m < 1 ? 'ce mois-ci' : m < 12 ? `${m} mois` : `${Math.floor(m / 12)} an${m >= 24 ? 's' : ''}${m % 12 ? ' ' + (m % 12) + ' mois' : ''}`;
}
async function carnetSheet(roomId, keep) {
  const r = S.rooms[roomId]; if (!r) return;
  if (!keep || !S.carnet || S.carnet.id !== roomId) { S.carnet = { id: roomId, data: null, add: null }; drawCarnet(); }
  try { const d = await api('carnet_get', { room_id: roomId }); if (!S.carnet || S.carnet.id !== roomId) return; S.carnet.data = d; Object.assign(S.localUrls, d.urls || {}); }
  catch (e) { if (S.carnet && S.carnet.id === roomId) S.carnet.err = errMsg(e); }
  if (S.sheet === 'carnet') drawCarnet();
}
function drawCarnet() {
  const c = S.carnet; if (!c) return; const r = S.rooms[c.id], d = c.data;
  const head = `${sheetHead('📒 Carnet · ' + esc(placeShort(r)))}<p class="muted">${esc(hotelName(r.hotel))} · tout ce qui est arrivé à ${isCommun(r) ? 'ce lieu' : 'cette chambre'}</p>`;
  if (!d) { openSheet('carnet', `${head}<div class="card empty"><div class="e">${c.err ? '📶' : '⏳'}</div><p>${c.err ? esc(c.err) : 'Chargement…'}</p></div>`); return; }
  const y = Date.now() - 365 * 864e5, evs = d.events, iss = d.issues;
  const lastOf = (k) => evs.filter((e) => e.kind === k).sort((a, b) => String(b.day).localeCompare(String(a.day)))[0];
  const cost12 = evs.filter((e) => e.cost && Date.parse(e.day) > y).reduce((s, e) => s + Number(e.cost), 0), costAll = evs.filter((e) => e.cost).reduce((s, e) => s + Number(e.cost), 0);
  const iss12 = iss.filter((i) => ts(i.created_at) > y), open = iss.filter((i) => repEtat(i) !== 'fait'), bad = d.edl.filter((x) => !x.ok);
  const stat = (v, l, cls) => `<div class="cstat"><b class="${cls || ''}">${v}</b><span>${l}</span></div>`;
  const ages = CK.filter((k) => k.age).map((k) => { const e = lastOf(k.k); return `<button class="cage ${e ? '' : 'unk'}" data-a="carAdd" data-k="${k.k}"><span class="e">${k.e}</span><b>${esc(k.age)}</b><span>${e ? ageTxt(e.day) : 'âge inconnu'}</span>${e ? `<span class="muted sm">${fdate(e.day)}</span>` : '<span class="muted sm">toucher pour noter</span>'}</button>`; }).join('');
  // Fil : notes du carnet, pannes signalées, dégâts au départ.
  const tl = [
    ...evs.map((e) => ({ t: Date.parse(e.day + 'T12:00:00'), h: `<div class="li tl"><span class="t"><b>${ckOf(e.kind).e} ${esc(ckOf(e.kind).l)}</b>${e.cost ? ` · <b>${euro(e.cost)}</b>` : ''}<br><span class="muted">${fdate(e.day)}${e.by_staff ? ' · ' + esc(first(nameOf(e.by_staff))) : ''}</span>${e.text ? `<br>${esc(e.text)}` : ''}</span>${e.photo ? `<button class="lost-ph sm" data-a="zoom" data-id="${esc(e.photo)}" data-l="Carnet">${mediaUrl(e.photo) ? `<img loading="lazy" alt="" src="${esc(mediaUrl(e.photo))}">` : '📷'}</button>` : ''}${isMgr() ? `<button class="x" data-a="carDel" data-id="${e.id}" aria-label="Supprimer cette ligne">✕</button>` : ''}</div>` })),
    ...iss.map((i) => { const K = KINDS.find((x) => x.k === i.kind) || { e: '🔧', l: 'Réparation' }, et = repEtat(i); return { t: ts(i.created_at), h: `<div class="li tl"><span class="t"><b>${K.e} ${esc(i.title || K.l)}</b> <span class="chip ${et === 'fait' ? 'c-green' : 'c-amber'}">${et === 'fait' ? 'Réparé' : et === 'en_cours' ? 'En cours' : 'À faire'}</span><br><span class="muted">Signalé ${fdate(String(i.created_at).slice(0, 10))}${i.done_at ? ' · réparé ' + fdate(String(i.done_at).slice(0, 10)) : ''}</span>${i.text ? `<br>${esc(i.text)}` : ''}</span></div>` }; }),
    ...bad.map((x) => ({ t: ts(x.created_at), h: `<div class="li tl"><span class="t"><b>⚠️ Dégâts au départ</b>${x.occupant_nom ? ' · ' + esc(x.occupant_nom) : ''}<br><span class="muted">${fdate(String(x.created_at).slice(0, 10))}${x.suite ? ' · ' + esc(x.suite) : ''}</span><br>${(x.items || []).map((i) => edlK(i.k).e + ' ' + esc(edlK(i.k).l)).join(', ')}</span></div>` })),
  ].sort((a, b) => b.t - a.t);
  const a = c.add;
  const form = a ? `<div class="card" id="car-form"><h3>${ckOf(a.kind).e} ${esc(ckOf(a.kind).l)}</h3>
      <div class="chips">${CK.map((k) => `<button class="chip ${a.kind === k.k ? 'c-accent' : 'c-plain'}" data-a="carKind" data-k="${k.k}" aria-pressed="${a.kind === k.k}">${k.e} ${esc(k.l)}</button>`).join('')}</div>
      <div class="row"><label class="muted" for="car-day">Date</label><input id="car-day" type="date" value="${esc(a.day)}" max="${todayISO()}" data-input="carDay"><label class="muted" for="car-cost">Coût</label><input id="car-cost" type="text" inputmode="decimal" placeholder="€ (facultatif)" value="${esc(a.cost || '')}" data-input="carCost" style="width:120px"></div>
      <textarea placeholder="Précision (facultatif) : marque, artisan, ce qui a été fait…" data-input="carText">${esc(a.text || '')}</textarea>
      <div class="row"><button class="btn ${a.photo ? 'ok' : ''}" data-a="carPhoto">${a.photo ? '✅ Photo ajoutée' : '📷 Photo ou facture'}</button><button class="btn pri" data-a="carSave">Enregistrer</button><button class="btn ghost" data-a="carCancel">Annuler</button></div></div>`
    : `<button class="btn big soft" data-a="carAdd" data-k="note">➕ Noter quelque chose</button>`;
  openSheet('carnet', `${head}
    <div class="cstats">${stat(d.jobs.n365, 'ménages sur 12 mois')}${stat(iss12.length, 'pannes sur 12 mois', iss12.length > 5 ? 'n-red' : '')}${stat(open.length, open.length > 1 ? 'pannes en cours' : 'panne en cours', open.length ? 'n-red' : '')}${stat(cost12 ? euro(cost12) : '–', 'dépensé sur 12 mois')}</div>
    <p class="muted sm">${d.jobs.last ? 'Dernier ménage ' + when(d.jobs.last) : 'Aucun ménage enregistré'}${d.jobs.blanc ? ` · à blanc en ${d.jobs.blanc} min en moyenne` : ''}${costAll && costAll !== cost12 ? ` · ${euro(costAll)} dépensés en tout` : ''}${bad.length ? ` · ${bad.length} départ${bad.length > 1 ? 's' : ''} avec dégâts` : ''}${d.lost.length ? ` · ${d.lost.length} objet${d.lost.length > 1 ? 's' : ''} oublié${d.lost.length > 1 ? 's' : ''}` : ''}</p>
    ${isCommun(r) ? '' : `<h2 class="sec">Âge de ce qu’il y a dans la chambre</h2><div class="cages">${ages}</div>`}
    ${S.me.readonly ? '' : form}
    <h2 class="sec">Historique</h2>${tl.length ? `<div class="list">${tl.map((x) => x.h).join('')}</div>` : '<p class="muted">Rien de noté pour l’instant. Les pannes signalées et les dégâts au départ s’ajoutent ici tout seuls.</p>'}`);
}
function viewCarnets() {
  const hs = HOTELS.map((h) => h.id).filter((h) => S.scope === 'all' || S.scope === h).filter((h) => !S.me.only_hotel || S.me.only_hotel === h);
  return `<div class="segc" role="group" aria-label="Hôtel">${[['all', 'Tous'], ...HOTELS.map((h) => [h.id, h.id === 'par' ? 'Paris' : h.name])].map(([k, l]) => `<button data-a="scope" data-k="${k}" aria-pressed="${S.scope === k}">${esc(l)}</button>`).join('')}</div>
    <p class="muted">Touchez une chambre pour voir son carnet : pannes, travaux, coûts, âge du matelas.</p>
    ${hs.map((h) => `<h2 class="sec">${H(h).e} ${esc(hotelName(h))}</h2><div class="cgrid">${roomsOf(h).map((r) => `<button data-a="carnet" data-id="${r.id}">${esc(r.num)}</button>`).join('')}</div>
      ${communsOf(h).length ? `<div class="cgrid wide">${communsOf(h).map((r) => `<button data-a="carnet" data-id="${r.id}">${esc(r.num)}</button>`).join('')}</div>` : ''}`).join('')}`;
}

/* =====================================================================
   6. TUTOS ANIMÉS AVEC VOIX
   Chaque étape montre les vrais boutons de l'appli (mêmes dessins), un doigt qui touche, et une phrase dite à voix haute.
   ===================================================================== */
const tJob = `<button class="job st-a_faire tgt"><span class="num">12</span><span class="txt"><b>🛏️ À blanc</b><span class="muted">Archange</span></span></button><button class="job st-a_faire"><span class="num">7</span><span class="txt"><b>🔄 Recouche</b><span class="muted">Archange</span></span></button>`;
const tChk = (on, e, l, tg) => `<div class="chk ${on ? 'on' : ''} ${tg ? 'tgt' : ''}"><span class="box">${on ? '✓' : ''}</span><span class="em">${e}</span><span class="lb">${l}</span></div>`;
const tShot = (done, l, tg) => `<div class="shot ${done ? 'done' : ''} ${tg ? 'tgt' : ''}">${done ? '<span class="cam">✅</span><span class="lbl">✓ ' + l + '</span>' : '<span class="cam">📷</span><span>' + l + '</span>'}</div>`;
const tKinds = (L, on, tg) => `<div class="kinds">${L.map((k, i) => `<button aria-pressed="${i === on}" class="${i === tg ? 'tgt' : ''}"><span class="e">${k.e}</span>${k.l}</button>`).join('')}</div>`;
const TUTOS = {
  menage: { t: 'Faire une chambre', e: '🧹', steps: [
    { say: 'Sur ta liste, touche la chambre à faire.', html: () => tJob },
    { say: 'Touche « Je commence ». Le chrono démarre.', html: () => `<button class="btn big pri tgt">▶ Je commence</button>` },
    { say: 'Regarde la chambre. Si tout va bien, touche le pouce. S’il y a un dégât, touche « Il y a un problème », et prends une photo.', html: () => `<div class="card edlq"><h3>🔍 D’abord, regarde la chambre</h3><div class="edl2"><button class="btn ok tgt"><span class="e">👍</span>Tout va bien</button><button class="btn bad"><span class="e">⚠️</span>Il y a un problème</button></div></div>` },
    { say: 'Fais chaque tâche, puis touche sa case pour la cocher.', html: () => tChk(1, '🪟', 'Ouvrir la fenêtre') + tChk(1, '🧺', 'Enlever draps et serviettes') + tChk(0, '🛏️', 'Faire le lit propre', 1) },
    { say: 'Prends les photos demandées, avec l’appareil du téléphone.', html: () => `<div class="shots">${tShot(1, 'Lit')}${tShot(0, 'Salle de bain', 1)}${tShot(0, 'Chambre')}</div>` },
    { say: 'Quand tout est coché et photographié, touche « Terminé ». Bravo !', html: () => `<button class="btn big pri tgt">✓ Terminé</button>` },
  ] },
  probleme: { t: 'Signaler un problème', e: '🔧', steps: [
    { say: 'Quelque chose est cassé, ou il manque quelque chose ? Touche « Signaler un problème ».', html: () => `<button class="btn big tgt">🔧 Signaler un problème</button>` },
    { say: 'Touche le dessin du problème. Tu peux en choisir plusieurs.', html: () => tKinds(KINDS.slice(0, 6), 2, 2) },
    { say: 'Ajoute une photo, ou garde le doigt sur le micro pour parler. Puis touche « Envoyer ».', html: () => `<div class="item"><div class="hd"><span class="e">💡</span><b>Ampoule grillée</b></div><div class="media3"><button class="btn tgt"><span class="e">📷</span>Photo</button><button class="btn"><span class="e">🎥</span>Vidéo</button><button class="btn"><span class="e">🎤</span>Garder appuyé</button></div></div><button class="btn big pri">Envoyer</button>` },
  ] },
  objet: { t: 'Objet trouvé', e: '🎒', steps: [
    { say: 'Tu trouves un objet oublié par un client ? Touche « Objet trouvé ».', html: () => `<button class="btn big tgt">🎒 Objet trouvé</button>` },
    { say: 'Prends l’objet en photo, et touche ce que c’est.', html: () => `<div class="shots one">${tShot(0, 'Photo de l’objet', 1)}</div>${tKinds(LOST_KINDS.slice(0, 3), 0, -1)}` },
    { say: 'Touche « Envoyer », puis range l’objet à la réception.', html: () => `<div class="shots one">${tShot(1, 'Photo')}</div><button class="btn big pri tgt">Envoyer</button>` },
  ] },
  linge: { t: 'Compter le linge', e: '🧺', steps: [
    { say: 'Touche « Linge » pour voir ce qu’il reste en réserve.', html: () => `<button class="btn big tgt">🧺 Linge</button>` },
    { say: 'Touche plus quand du linge propre arrive. Touche moins quand tu en prends.', html: () => `<div class="lrows"><div class="lrow"><span class="le">🛏️</span><span class="ll"><b>Draps 1 personne</b></span><button class="lbtn">−</button><b class="lq">14</b><button class="lbtn plus tgt">+</button></div><div class="lrow low"><span class="le">🧖</span><span class="ll"><b>Grandes serviettes</b><span class="chip c-red">Bas</span></span><button class="lbtn">−</button><b class="lq">3</b><button class="lbtn plus">+</button></div></div>` },
    { say: 'Pour tout recompter, touche « Recompter », et écris le vrai nombre.', html: () => `<button class="btn tgt">✏️ Recompter</button>` },
  ] },
  horsligne: { t: 'Sans réseau', e: '📶', steps: [
    { say: 'Pas de réseau dans la chambre ? Continue normalement : coche, prends tes photos, termine.', html: () => `<div id="offbar-demo" class="offdemo off">📶 Hors ligne · 2 envois en attente</div>${tChk(1, '🚿', 'Douche et lavabo')}<button class="btn big pri tgt">✓ Terminé</button>` },
    { say: 'Tout est gardé dans le téléphone, et part tout seul quand le réseau revient.', html: () => `<div class="offdemo sync">⏫ 2 envois en cours…</div><div class="celebrate"><div class="e">👏</div></div>` },
  ] },
};
const tutoPath = (id, i) => `tts/tuto-${id}-${i + 1}-female-1.wav`;
const helpBtn = (id) => !pOn('tuto') ? '' : ` <button class="helpb" data-a="tuto" data-id="${id}" aria-label="Voir comment faire, avec la voix">?</button>`;
const T = { id: null, i: 0, play: true, timer: null, audio: null, urls: null };
async function tutoOpen(id) {
  if (!TUTOS[id]) return; tutoStop(); T.id = id; T.i = 0; T.play = true; drawTuto();
  if (!T.urls) { try { T.urls = (await api('tuto_urls')).urls || {}; } catch (e) { T.urls = null; } if (T.id === id && S.sheet === 'tuto' && T.i === 0) tutoSay(); }
}
function tutoStop() { clearTimeout(T.timer); T.timer = null; if (T.audio) { try { T.audio.pause(); } catch (_) {} T.audio = null; } }
function tutoSay() {
  tutoStop(); if (!T.play || S.sheet !== 'tuto') return;
  const st = TUTOS[T.id].steps[T.i], u = T.urls && T.urls[tutoPath(T.id, T.i)], next = () => { if (S.sheet !== 'tuto' || !T.play) return; if (T.i < TUTOS[T.id].steps.length - 1) { T.i++; drawTuto(); } else { T.play = false; drawTuto(true); } };
  const fallback = () => { T.timer = setTimeout(next, Math.max(4200, st.say.length * 75)); };
  if (!u) { fallback(); return; }
  const a = new Audio(u); T.audio = a;
  a.onended = () => { T.timer = setTimeout(next, 700); };
  a.onerror = fallback;
  const p = a.play(); if (p && p.catch) p.catch(fallback);
}
function drawTuto(noSay) {
  const tu = TUTOS[T.id]; if (!tu) return; const n = tu.steps.length, st = tu.steps[T.i], last = T.i === n - 1;
  openSheet('tuto', `${sheetHead(tu.e + ' ' + esc(tu.t))}
    <div class="tdots" aria-hidden="true">${tu.steps.map((_, i) => `<i class="${i === T.i ? 'on' : i < T.i ? 'done' : ''}"></i>`).join('')}</div>
    <div class="tstage" id="tstage" aria-hidden="true"><div class="tin">${st.html()}</div><span class="tfinger" id="tfinger"></span></div>
    <p class="tcap"><span class="tn">${T.i + 1}</span>${esc(st.say)}</p>
    <div class="trow"><button class="btn" data-a="tutoNav" data-d="-1" ${T.i ? '' : 'disabled'} aria-label="Étape d’avant">◀</button>
      <button class="btn ${T.play ? '' : 'pri'}" data-a="tutoPlay">${T.play ? '⏸ Pause' : (last ? '🔁 Revoir' : '▶ Lire')}</button>
      <button class="btn" data-a="tutoNav" data-d="1" ${last ? 'disabled' : ''} aria-label="Étape d’après">▶</button></div>
    ${last && !T.play ? '<button class="btn big pri" data-a="close">J’ai compris</button>' : ''}`, 'tutop');
  // Le doigt se pose sur le bouton à toucher (marqué « tgt »).
  requestAnimationFrame(() => { const sg = $('tstage'), tg = sg && sg.querySelector('.tgt'), f = $('tfinger'); if (!sg || !f) return; if (!tg) { f.hidden = true; return; }
    const a = sg.getBoundingClientRect(), b = tg.getBoundingClientRect(); f.style.left = (b.left - a.left + b.width * (b.width > 200 ? .72 : .5)) + 'px'; f.style.top = (b.top - a.top + b.height * .55) + 'px'; f.classList.add('go'); });
  if (!noSay) tutoSay();
}
function tutoListSheet() {
  const ids = role() === 'menage' ? ['menage', 'probleme', 'objet', 'linge', 'horsligne'] : Object.keys(TUTOS);
  openSheet('tutos', `${sheetHead('🎬 Comment faire ?')}<p class="muted">De petites vidéos avec la voix, pour chaque geste.</p>
    <div class="col">${ids.map((id) => `<button class="btn big soft" data-a="tuto" data-id="${id}" style="justify-content:flex-start">${TUTOS[id].e} ${esc(TUTOS[id].t)}</button>`).join('')}</div>`);
}

/* =====================================================================
   7. TEXTE ÉCRIT DES VOCAUX (français)
   ===================================================================== */
function plusMsgExtra(m) {
  if (!pOn('txt') && !m.pending) return '';
  if (m.media_type !== 'audio' || !m.media_path || role() === 'menage' || m.pending) return m.pending ? '<span class="meta">📶 en attente d’envoi</span>' : '';
  if (m.transcript) return `<span class="vtxt">📝 ${esc(m.transcript)}</span>`;
  if (m.tr_err === 'pas_francais') return '<span class="meta">📝 Pas en français : à écouter</span>';
  if (m.tr_err === 'vide') return '';
  if (S.plus.stt && isMgr() && /\.wav$/i.test(m.media_path) && (!m.tr_at || m.tr_err)) return `<button class="btn small" data-a="msgTxt" data-id="${esc(m.id)}">${S.busy['tx' + m.id] ? '⏳ Écoute en cours…' : '📝 Lire en texte'}</button>`;
  return '';
}

/* =====================================================================
   8. BRANCHEMENTS DANS L'APPLI
   ===================================================================== */
Object.assign(ICO, {
  bag: '<path d="M6 8h12l1.2 12H4.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M8.5 11l2 2 3-3.5"/>',
  shirt: '<path d="M8 3l4 3 4-3 5 4-3 4-2-1.5V21H8V9.5L6 11 3 7z"/>',
  notebook: '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M3 8h4M3 12h4M3 16h4M12.5 8h4M12.5 12h4"/>',
});
Object.assign(SECTIONS, {
  lost: { t: 'Objets trouvés', i: 'bag', c: 't-teal' }, edl: { t: 'États des lieux', i: 'search', c: 't-orange' },
  linge: { t: 'Linge', i: 'shirt', c: 't-blue' }, carnets: { t: 'Carnets des chambres', i: 'notebook', c: 't-indigo' },
});
const PLUS_TABS = ['lost', 'edl', 'linge', 'carnets'];
// Écran d'un thème « en plus » (gérants et intendant) ; null si ce n'est pas un des nôtres.
const PLUS_KEY = { lost: 'lost', edl: 'edl', linge: 'linge', carnets: 'carnet' };
function plusView(tab) { if (!PLUS_KEY[tab] || !pOn(PLUS_KEY[tab])) return null; return tab === 'lost' ? viewLost() : tab === 'edl' ? viewEdl() : tab === 'linge' ? viewLinge() : viewCarnets(); }
function plusRight(tab) { return tab === 'lost' ? `<button class="nb-act" data-a="lostNew" aria-label="Nouvel objet trouvé">${ico('plus')}</button>` : (tab === 'linge' ? helpBtn('linge') : ''); }
// Tuiles ajoutées à l'accueil des gérants et de l'intendant.
function plusTiles() {
  const kept = scoped(S.plus.lost).filter((x) => x.statut === 'garde').length, todo = edlTodo().length, low = lingeLowAll();
  return (pOn('lost') ? tile('lost', kept ? `${kept} objet${kept > 1 ? 's' : ''} gardé${kept > 1 ? 's' : ''}` : 'Rien en attente') : '')
    + (pOn('edl') ? tile('edl', todo ? `<span class="ora">${todo} départ${todo > 1 ? 's' : ''} avec dégâts à voir</span>` : 'Aucun dégât à voir', todo) : '')
    + (pOn('linge') ? tile('linge', low ? `<span class="ora">${low} linge${low > 1 ? 's' : ''} bientôt en manque</span>` : 'Stock suivi', low) : '')
    + (pOn('carnet') ? tile('carnets', 'Pannes, travaux, âge du matelas') : '');
}
// Boutons ajoutés sur l'écran de la femme de ménage.
const plusCleanHome = () => `${pOn('lost') ? '<button class="btn big" data-a="lostNew">🎒 Objet trouvé</button>' : ''}${pOn('linge') ? `<button class="btn big" data-a="lingeOpen">🧺 Linge${lingeLowAll() ? ' <span class="chip c-red">bas</span>' : ''}</button>` : ''}${pOn('tuto') ? '<button class="btn big ghost" data-a="tutoList">🎬 Comment faire ?</button>' : ''}`;
const plusCleanRoom = (r) => isCommun(r) || !pOn('lost') ? '' : `<button class="btn big" data-a="lostNew" data-room="${r.id}">🎒 Objet trouvé</button>`;
// Fiche d'une chambre (gérants) : carnet et dernier état des lieux.
function plusRoomSheet(r) {
  const c = S.plus.edl.find((x) => x.room_id === r.id);
  return `${pOn('carnet') ? `<div class="card"><h3>📒 Carnet ${isCommun(r) ? 'du lieu' : 'de la chambre'}</h3><p class="muted">Pannes, travaux, coûts, âge du matelas.</p><button class="btn soft" data-a="carnet" data-id="${r.id}">Ouvrir le carnet</button></div>` : ''}
    ${isCommun(r) || !pOn('edl') ? '' : `<div class="card"><h3>🔍 État des lieux au départ</h3><p class="muted">${c ? `Dernier : ${when(c.created_at)} par ${esc(first(nameOf(c.by_staff)))} · ${c.ok ? 'rien à signaler' : (c.items || []).length + ' dégât(s)'}` : 'Aucun sur les 60 derniers jours.'}</p>
      <div class="row"><button class="btn small ok" data-a="edlOk" data-id="${r.id}" data-mgr="1">👍 Tout va bien</button><button class="btn small bad" data-a="edlBad" data-id="${r.id}">⚠️ Noter des dégâts</button></div></div>`}`;
}

// Réglages : les interrupteurs des nouveautés (propriétaire seulement).
function plusSettings() {
  if (!S.me || S.me.role !== 'owner') return '';
  const f = cfg().plus || {}, n = PLUS_F.filter(([k]) => f[k]).length;
  return `<div class="card"><h2>🆕 Nouveautés</h2><p class="muted">Vous voyez déjà tout pour essayer (aussi avec « Voir comme femme de ménage »). L’équipe ne voit une nouveauté que lorsqu’elle est allumée ici. ${n} sur ${PLUS_F.length} allumée${n > 1 ? 's' : ''}.</p>
    <div class="list">${PLUS_F.map(([k, l, d]) => `<div class="li"><span class="t"><b>${l}</b><br><span class="muted">${esc(d)}</span></span><button class="toggle" data-a="plusFlag" data-k="${k}" aria-pressed="${!!f[k]}">${f[k] ? '✓ Pour toute l’équipe' : 'Moi seul'}</button></div>`).join('')}</div>
    ${pOn('tuto') ? '<button class="btn" data-a="tutoList">🎬 Voir les tutos</button>' : ''}</div>`;
}
Object.assign(A, {
  async plusFlag(d) { const f = { ...(cfg().plus || {}) }; f[d.k] = !f[d.k]; await saveCfg({ ...S.cfg, plus: f }); },
  /* hors ligne */
  offInfo() {
    const n = OFF.box.length;
    openSheet('off', `${sheetHead(OFF.offline ? '📶 Hors ligne' : '⏫ Envois en cours')}
      <p>${OFF.offline ? 'Le téléphone n’a pas de réseau. Tu peux continuer : commencer et terminer un ménage, cocher, prendre les photos, signaler un problème, envoyer un vocal.' : 'Le réseau est revenu : les envois gardés partent.'}</p>
      <p class="muted">Tout est gardé dans le téléphone et part tout seul au retour du réseau. Ne te déconnecte pas de l’appli avant.</p>
      ${n ? `<h3>${n} envoi${n > 1 ? 's' : ''} en attente</h3><div class="list">${OFF.box.map((e) => `<div class="li"><span class="t">${esc(OFF_L[e.a] || e.a)}</span><span class="muted">${hm(e.at)}</span></div>`).join('')}</div>` : '<p class="muted">Aucun envoi en attente.</p>'}
      ${OFF.fails.length ? `<h3>Envois refusés</h3><div class="list">${OFF.fails.map((f) => `<div class="li"><span class="t">${esc(OFF_L[f.a] || f.a)}</span><span class="muted">${when(f.at)} · ${esc(ERR[f.code] || f.code)}</span></div>`).join('')}</div>` : ''}
      <button class="btn big pri" data-a="offRetry">🔄 Réessayer maintenant</button>${helpBtn('horsligne')}`);
  },
  async offRetry() { toast('Nouvel essai…'); await refresh(true); if (S.sheet === 'off') A.offInfo(); },
  /* objets trouvés */
  lostNew(d) { lostSheet(d && d.room || null); },
  async lostPhoto() {
    const p = S.lostF; if (!p || p.busy) return; p.busy = true; drawLost();
    const res = await takePhoto((f) => `Objet trouvé · ${hotelName(p.hotel)}${p.room ? ' ch. ' + p.room : ''} · ${first(S.me.label)} · ${new Date(f.lastModified || Date.now()).toLocaleString('fr-FR')}`, false, role() !== 'menage');
    if (S.lostF === p) { if (res) p.photo = res; p.busy = false; drawLost(); }
  },
  lostKind(d) { S.lostF.kind = S.lostF.kind === d.k ? null : d.k; drawLost(); },
  async lostSend(d, el) {
    const p = S.lostF; if (!p.photo) { toast('Prends d’abord l’objet en photo.'); return; } if (p.busy) { toast('Attends la fin de l’envoi.'); return; }
    if (el) el.classList.add('busy');
    if (await act(() => api('lost_add', { hotel: p.hotel, room: p.room || null, kind: p.kind || 'autre', descr: p.descr || null, photo: p.photo, _id: uuid() }), 'Merci, c’est noté. Range l’objet à la réception.')) { S.lostF = null; closeSheet(); }
    else if (el) el.classList.remove('busy');
  },
  lostF(d) { S.lf = d.k; render(); },
  async lostBack(d) { const who = prompt('Rendu à qui ? (nom du client, facultatif)'); if (who === null) return; await act(() => api('lost_set', { id: d.id, statut: 'rendu', note: who ? 'Rendu à ' + who : null }), 'Noté : rendu ✓'); },
  async lostOut(d) { if (!confirm('Cet objet est jeté ou donné ?')) return; await act(() => api('lost_set', { id: d.id, statut: 'jete' }), 'Noté ✓'); },
  async lostKeep(d) { await act(() => api('lost_set', { id: d.id, statut: 'garde' }), 'Remis dans les objets gardés'); },
  async lostDel(d, el) { if (el.dataset.ok !== '1') { el.dataset.ok = '1'; el.textContent = 'Touche encore pour supprimer'; return; } await act(() => api('lost_delete', { id: d.id }), 'Fiche supprimée'); },
  /* état des lieux */
  async edlOk(d, el) {
    const r = S.rooms[d.id]; if (!r) return; if (el) el.classList.add('busy');
    const ok = await act(() => api('checkout_add', { room_id: r.id, hotel: r.hotel, room: r.num, items: [], _id: uuid() }), 'État des lieux : rien à signaler ✓');
    if (ok && !d.mgr && r.assignee === S.me.id) { workOf(r.id).edl = { ok: true, n: 0 }; saveWork(); render(); }
    if (el) el.classList.remove('busy');
  },
  edlBad(d) { edlSheet(d.id); },
  edlKind(d) { const p = S.edlF; if (p.items[d.k]) { delete p.items[d.k]; p.order = p.order.filter((k) => k !== d.k); } else { p.items[d.k] = { text: '', photo: null }; p.order.push(d.k); } drawEdl(); },
  async edlPhoto(d) {
    const p = S.edlF; if (!p || !p.items[d.k]) return; if (p.busy) { toast('Attends la fin de l’envoi.'); return; }
    p.busy = d.k; drawEdl();
    const K = edlK(d.k), res = await takePhoto(`${K.l} · ${hotelName(p.hotel)} ch. ${p.room} · départ · ${first(S.me.label)} · ${new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, true);
    if (S.edlF === p) { if (res && p.items[d.k]) p.items[d.k].photo = res; p.busy = null; drawEdl(); }
  },
  async edlSend(d, el) {
    const p = S.edlF; if (!p.order.length) { toast('Touche d’abord ce qui ne va pas.'); return; } if (p.busy) { toast('Attends la fin de l’envoi.'); return; }
    const noPh = p.order.filter((k) => !p.items[k].photo); if (noPh.length) { toast(`Il manque la photo : ${noPh.map((k) => edlK(k).l).join(', ')}.`, 5000); return; }
    if (el) el.classList.add('busy');
    const items = p.order.map((k) => ({ k, text: p.items[k].text || null, photo: p.items[k].photo }));
    if (await act(() => api('checkout_add', { room_id: p.room_id, hotel: p.hotel, room: p.room, items, _id: uuid() }), 'Merci, les dégâts sont signalés')) {
      const r = S.rooms[p.room_id]; if (r && r.assignee === S.me.id) { workOf(r.id).edl = { ok: false, n: items.length }; saveWork(); }
      S.edlF = null; closeSheet(); render();
    } else if (el) el.classList.remove('busy');
  },
  edlF(d) { S.ef = d.k; render(); },
  async edlSeen(d) { await act(() => api('checkout_seen', { id: d.id, suite: d.s }), 'Classé ✓'); },
  async edlUnseen(d) { await act(() => api('checkout_seen', { id: d.id, undo: true })); },
  /* linge */
  lingeOpen() { S.lmode = null; lingeSheet(); },
  linHotel(d) { S.lh = d.k; drawLinge(); },
  linTap(d) { lingeTap(S.lh, d.i, Number(d.d)); },
  linMode(d) { S.lmode = S.lmode === d.k ? null : d.k; drawLinge(); },
  async linLog() {
    try { const j = await api('linen_log', { hotel: S.lh }); const L = j.log || [];
      openSheet('linlog', `${sheetHead('🕘 Linge · ' + esc(hotelName(S.lh)))}${L.length ? `<div class="list">${L.map((x) => { const it = lingeCat().find((c) => c.id === x.item) || { e: '🧺', l: x.item }; return `<div class="li"><span class="t"><b>${esc(it.e)} ${esc(it.l)}</b><br><span class="muted">${when(x.created_at)} · ${esc(first(nameOf(x.by_staff)))}</span></span><span class="chip ${x.kind === 'seuil' ? 'c-plain' : x.delta < 0 ? 'c-amber' : 'c-green'}">${x.kind === 'seuil' ? 'seuil changé' : (x.kind === 'compte' ? 'compté : ' : (x.delta > 0 ? '+' : '') + x.delta + ' → ') + x.qty}</span></div>`; }).join('')}</div>` : '<p class="muted">Rien pour l’instant.</p>'}<button class="btn" data-a="lingeBack">← Retour</button>`); }
    catch (e) { toast(errMsg(e)); }
  },
  lingeBack() { if (S.tab === 'linge' && role() !== 'menage') closeSheet(); else lingeSheet(); },
  async linAdd() { const v = ($('lin-add').value || '').trim(); if (!v) return; await saveCfg({ ...S.cfg, linge: [...lingeCat(), { id: 'x' + rid(), e: '🧺', l: v.slice(0, 40) }] }); drawLinge(); },
  async linDel(d) { await saveCfg({ ...S.cfg, linge: lingeCat().filter((x) => x.id !== d.i) }); drawLinge(); },
  /* carnet */
  carnet(d) { carnetSheet(d.id); },
  carAdd(d) { if (!S.carnet || S.me.readonly) return; S.carnet.add = { kind: d.k || 'note', day: todayISO(), cost: '', text: '', photo: null }; drawCarnet(); const f = $('car-form'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  carKind(d) { S.carnet.add.kind = d.k; drawCarnet(); },
  carCancel() { S.carnet.add = null; drawCarnet(); },
  async carPhoto() { const a = S.carnet.add, p = await takePhoto(`Carnet · ${placeShort(S.rooms[S.carnet.id])} · ${hotelName(S.rooms[S.carnet.id].hotel)}`, false, true); if (p && S.carnet && S.carnet.add === a) { a.photo = p; drawCarnet(); } },
  async carSave(d, el) {
    const c = S.carnet, a = c.add; if (el) el.classList.add('busy');
    try { await api('carnet_add', { room_id: c.id, kind: a.kind, day: a.day, cost: a.cost, text: a.text, photo: a.photo }); c.add = null; toast('Noté dans le carnet ✓'); await carnetSheet(c.id, true); }
    catch (e) { toast(errMsg(e)); if (el) el.classList.remove('busy'); }
  },
  async carDel(d, el) { if (el.dataset.ok !== '1') { el.dataset.ok = '1'; el.textContent = 'Sûr ?'; return; } try { await api('carnet_del', { id: d.id }); await carnetSheet(S.carnet.id, true); } catch (e) { toast(errMsg(e)); } },
  /* tutos */
  tuto(d) { tutoOpen(d.id); },
  tutoList() { tutoListSheet(); },
  tutoNav(d) { const n = TUTOS[T.id].steps.length; T.i = Math.min(n - 1, Math.max(0, T.i + Number(d.d))); T.play = true; drawTuto(); },
  tutoPlay() { if (T.play) { T.play = false; tutoStop(); drawTuto(true); } else { if (T.i === TUTOS[T.id].steps.length - 1) T.i = 0; T.play = true; drawTuto(); } },
  /* texte des vocaux */
  async msgTxt(d) {
    S.busy['tx' + d.id] = true; refreshSheet();
    try { const j = await api('msg_transcribe', { id: d.id, again: true }); const m = S.msgs.find((x) => x.id === d.id); if (m) { m.transcript = j.transcript || null; m.tr_at = new Date().toISOString(); m.tr_err = j.note || null; } if (!j.transcript) toast(j.note === 'pas_francais' ? 'Ce vocal n’est pas en français : à écouter.' : 'Rien d’audible dans ce vocal.'); }
    catch (e) { toast(errMsg(e)); }
    delete S.busy['tx' + d.id]; refreshSheet();
  },
});
Object.assign(C, {
  lostHotel(t) { S.lostF.hotel = t.value; S.lostF.room = ''; drawLost(); },
  lostRoom(t) { S.lostF.room = t.value; },
  async lostPlace(t) { try { await api('lost_set', { id: t.dataset.id, place: t.value }); const it = S.plus.lost.find((x) => x.id === t.dataset.id); if (it) it.place = t.value; toast('Rangement noté ✓'); } catch (e) { toast(errMsg(e)); } },
  async linCount(t) { const v = Math.round(Number(t.value)); if (!Number.isFinite(v) || v < 0) return; try { const r = await api('linen_set', { hotel: S.lh, item: t.dataset.i, qty: v }); if (!r.queued) { let row = S.plus.linge.find((x) => x.hotel === S.lh && x.item === t.dataset.i); if (!row) { row = { hotel: S.lh, item: t.dataset.i, qty: 0, seuil: 0 }; S.plus.linge.push(row); } row.qty = v; } toast('Compté ✓'); } catch (e) { toast(errMsg(e)); } },
  async linSeuil(t) { const v = Math.max(0, Math.round(Number(t.value) || 0)); try { await api('linen_set', { hotel: S.lh, item: t.dataset.i, seuil: v }); let row = S.plus.linge.find((x) => x.hotel === S.lh && x.item === t.dataset.i); if (!row) { row = { hotel: S.lh, item: t.dataset.i, qty: 0, seuil: 0 }; S.plus.linge.push(row); } row.seuil = v; toast('Seuil enregistré ✓'); } catch (e) { toast(errMsg(e)); } },
});
Object.assign(I, {
  lostText(el) { if (S.lostF) S.lostF.descr = el.value; },
  edlText(el) { if (S.edlF && S.edlF.items[el.dataset.k]) S.edlF.items[el.dataset.k].text = el.value; },
  carDay(el) { if (S.carnet && S.carnet.add) S.carnet.add.day = el.value; },
  carCost(el) { if (S.carnet && S.carnet.add) S.carnet.add.cost = el.value; },
  carText(el) { if (S.carnet && S.carnet.add) S.carnet.add.text = el.value; },
});
