"use strict";
/* Ménage Hôtels — application web installable.
   Toutes les données passent par la fonction « api » de Supabase ; ce fichier ne contient aucun secret. */

const API = 'https://htpygokjdstmmzquibmn.supabase.co/functions/v1/api';
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');
const HOTELS = [
  { id: 'arc', name: 'Archange', photo: 'img/archange.jpg', e: '👼' },
  { id: 'par', name: 'Hôtel de Paris', photo: 'img/paris.jpg', e: '🗼' },
  { id: 'cha', name: 'Châteaudun', photo: 'img/chateau.jpg', e: '🏰' },
];
const DEFAULT_CFG = {
  retentionDays: 30, minutes: { blanc: 30, recouche: 15, fond: 15 },
  tasks: { blanc: [], recouche: [] }, photos: { blanc: ['Lit', 'Salle de bain', 'Chambre'], recouche: ['Lit'], fond: ['Après'] }, periodic: [],
};
const KINDS = [
  { k: 'fuite', e: '💧', l: 'Fuite d’eau' }, { k: 'wc', e: '🚽', l: 'WC, évier bouché' },
  { k: 'ampoule', e: '💡', l: 'Ampoule grillée' }, { k: 'elec', e: '⚡', l: 'Prise, électricité' },
  { k: 'chauffage', e: '🔥', l: 'Chauffage, clim' }, { k: 'porte', e: '🚪', l: 'Porte, serrure' },
  { k: 'tv', e: '📺', l: 'TV, télécommande' }, { k: 'meuble', e: '🪑', l: 'Meuble, lit cassé' },
  { k: 'moisi', e: '🦠', l: 'Moisissure, odeur' }, { k: 'nuisible', e: '🐜', l: 'Insectes, souris' },
  { k: 'linge', e: '🧺', l: 'Linge manquant' }, { k: 'produit', e: '🧴', l: 'Produit manquant' },
  { k: 'oubli', e: '🎒', l: 'Objet oublié' }, { k: 'autre', e: '❓', l: 'Autre' },
];
const ST = { propre: { l: 'Prête', c: 'slate' }, a_faire: { l: 'À faire', c: 'red' }, en_cours: { l: 'En cours', c: 'amber' }, a_controler: { l: 'À contrôler', c: 'green' } };
const TY = { blanc: { l: 'À blanc', e: '🛏️' }, recouche: { l: 'Recouche', e: '🔄' }, fond: { l: 'Tâche de fond', e: '⭐' } };
const REASONS = [['Personnel', '👷'], ['Nous-mêmes', '🏠'], ['Panne ou travaux', '🛠️'], ['Salle petit déjeuner', '☕']];
const REDO = ['Lit mal fait', 'Salle de bain sale', 'Poussière', 'Sol pas propre', 'Poubelle pleine', 'Produits manquants'];
const ROLE_L = { owner: 'Propriétaire', gerant: 'Gérant / associé', menage: 'Femme de ménage' };

/* ---------- état ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const S = {
  secret: LS.get('mh-secret', null), loaded: false, data: null,
  me: null, cfg: DEFAULT_CFG, rooms: {}, staff: [], devices: [], invites: [], plan: { avail: {} }, issues: [], msgs: [], reads: [], urls: {}, vapid: null,
  hotel: LS.get('mh-hotel', 'arc'), tab: 'rooms', sel: new Set(), assignTo: '', open: null, preview: false, issueFilter: 'nouveau',
  work: LS.get('mh-work', {}), busy: {}, rep: null, sheet: null, stats: null, proposal: null, withFond: true, rebalance: true,
  localUrls: {}, rec: null, pin: '', act: null, dirty: false, installEvt: null,
};
if (!HOTELS.some((h) => h.id === S.hotel)) S.hotel = 'arc';
document.body.dataset.hotel = S.hotel;
const saveWork = () => LS.set('mh-work', S.work);

/* ---------- utilitaires ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const H = (id) => HOTELS.find((h) => h.id === id) || { name: id || '', photo: '', e: '🏨' };
const hotelName = (id) => H(id).name;
const photoUrl = (id) => H(id).photo ? `url('${H(id).photo}')` : 'none';
const ts = (v) => v == null ? null : (typeof v === 'number' ? v : Date.parse(v));
const dayStr = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const hm = (t) => t ? new Date(ts(t)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
const when = (t) => { if (!t) return ''; t = ts(t); return dayStr(t) === dayStr(Date.now()) ? 'aujourd’hui ' + hm(t) : new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + hm(t); };
const dur = (ms) => { if (!ms || ms < 0) return '–'; const m = Math.round(ms / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
const mn = (m) => dur(m * 60000);
const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const touch = () => (navigator.maxTouchPoints || 0) > 0;
const cfg = () => { const c = S.cfg || {}; return { ...DEFAULT_CFG, ...c, minutes: { ...DEFAULT_CFG.minutes, ...(c.minutes || {}) }, tasks: { ...DEFAULT_CFG.tasks, ...(c.tasks || {}) }, photos: { ...DEFAULT_CFG.photos, ...(c.photos || {}) }, periodic: c.periodic || [] }; };
const staffById = (id) => S.staff.find((s) => s.id === id);
const nameOf = (id) => { if (!id) return 'Personne'; const s = staffById(id); return s ? s.label : (S.me && id === S.me.id ? S.me.label : 'Ancien membre'); };
const role = () => !S.me ? null : (S.me.role === 'menage' ? 'menage' : (S.preview ? 'menage' : 'mgr'));
const isMgr = () => S.me && (S.me.role === 'owner' || S.me.role === 'gerant');
const roomsOf = (h) => Object.values(S.rooms).filter((r) => r.hotel === h).sort((a, b) => a.order - b.order);
const cleaners = () => S.staff.filter((s) => s.role === 'menage' && s.active !== false);
const habitual = (uid, h) => { const s = staffById(uid); return !s || !s.hotels || !s.hotels.length || s.hotels.includes(h); };
const mediaUrl = (p) => p ? (S.localUrls[p] || S.urls[p] || null) : null;

function normRoom(r) {
  return { id: r.id, hotel: r.hotel, num: r.num, order: r.ord, status: r.status, type: r.type, assignee: r.assignee, blocked: r.blocked, blockReason: r.block_reason,
    rejectNote: r.reject_note, startedAt: ts(r.started_at), doneAt: ts(r.done_at), doneBy: r.done_by, lastJob: r.last_job, periodicDone: r.periodic_done || {},
    extras: r.extras || [], fondTasks: r.fond_tasks, refPhoto: r.ref_photo };
}
const PATCH_KEYS = { type: 'type', status: 'status', assignee: 'assignee', blocked: 'blocked', blockReason: 'block_reason', rejectNote: 'reject_note', extras: 'extras', fondTasks: 'fond_tasks', refPhoto: 'ref_photo', startedAt: 'started_at' };
function toPatch(p) { const o = {}; for (const [k, v] of Object.entries(p)) if (PATCH_KEYS[k]) o[PATCH_KEYS[k]] = v; return o; }

function overdue(r) {
  const now = Date.now();
  return (cfg().periodic || []).map((p) => ({ p, over: (now - ((r.periodicDone || {})[p.id] || 0)) - p.days * 864e5 })).filter((x) => x.over >= 0).sort((a, b) => b.over - a.over).map((x) => x.p);
}
function soonDue(r) {
  const now = Date.now();
  return (cfg().periodic || []).map((p) => ({ p, ratio: (now - ((r.periodicDone || {})[p.id] || 0)) / (p.days * 864e5) })).filter((x) => x.ratio >= 0.5).sort((a, b) => b.ratio - a.ratio);
}
const dueTask = (r) => r.type === 'blanc' ? (overdue(r)[0] || null) : null;
function estimate(r) {
  const m = cfg().minutes;
  if (r.type === 'blanc') return m.blanc + (dueTask(r) ? m.fond : 0);
  if (r.type === 'recouche') return m.recouche;
  if (r.type === 'fond') return m.fond * Math.max(1, (r.fondTasks || []).length);
  return 0;
}

/* ---------- messages : lus / non lus ---------- */
const splitCtx = (c) => { const i = c.indexOf(':'); return i < 0 ? [c, ''] : [c.slice(0, i), c.slice(i + 1)]; };
const dmConv = (a, b) => 'dm:' + [a, b].sort().join('_');
const isMgrRole = (r) => r === 'owner' || r === 'gerant';
const readAt = (staffId, conv) => { const r = S.reads.find((x) => x.staff_id === staffId && x.conv === conv); return r ? ts(r.read_at) : 0; };
const convMsgs = (c) => S.msgs.filter((m) => m.conv === c);
function unreadIn(conv) { if (!S.me) return 0; const mine = readAt(S.me.id, conv); return convMsgs(conv).filter((m) => m.from_staff !== S.me.id && ts(m.created_at) > mine).length; }
function myConvs() {
  const set = new Set(['team']);
  if (isMgr() && !S.preview) { set.add('mgrs'); cleaners().forEach((c) => set.add('staff:' + c.id)); }
  else set.add('staff:' + S.me.id);
  S.msgs.forEach((m) => set.add(m.conv));
  return [...set];
}
const unreadTotal = () => S.me ? myConvs().reduce((s, c) => s + unreadIn(c), 0) : 0;
function convOther(c) { return c.slice(3).split('_').find((x) => x !== S.me.id); }
function convLabel(c) {
  if (c === 'team') return '📢 Toute l’équipe';
  if (c === 'mgrs') return '👔 Responsables';
  if (c.startsWith('staff:')) { const id = c.slice(6); return id === S.me.id ? '🧺 Mes responsables' : '🧺 ' + nameOf(id); }
  if (c.startsWith('dm:')) return '🔒 ' + nameOf(convOther(c));
  return c;
}
function convSub(c) {
  if (c === 'team') return 'Tout le monde reçoit le message';
  if (c === 'mgrs') return 'Propriétaire et gérants seulement';
  if (c.startsWith('staff:')) return c.slice(6) === S.me.id ? 'Tous les responsables reçoivent ton message' : 'Elle + tous les responsables';
  if (c.startsWith('dm:')) return 'Privé : seulement vous deux';
  return '';
}
function convMembers(c) {
  const act = S.staff.filter((s) => s.active !== false);
  if (c === 'team') return act.map((s) => s.id);
  if (c === 'mgrs') return act.filter((s) => isMgrRole(s.role)).map((s) => s.id);
  if (c.startsWith('staff:')) return [c.slice(6), ...act.filter((s) => isMgrRole(s.role)).map((s) => s.id)];
  if (c.startsWith('dm:')) return c.slice(3).split('_');
  return [];
}

/* ---------- toast ---------- */
let toastT = null;
function toast(t, ms) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, ms || 3800); }

/* ---------- API ---------- */
const ERR = {
  invite_invalid: 'Ce lien n’est plus valable. Demande un nouveau lien à ton responsable.', locked: 'Accès bloqué après 5 codes faux. Appelle ton responsable.',
  not_yours: 'Cette chambre n’est plus à toi.', not_started: 'Touche d’abord « Je commence ».', photos_missing: 'Il manque des photos.',
  owner_protected: 'Le compte du propriétaire est protégé.', forbidden: 'Tu n’as pas accès à cette action.', exists: 'Cette chambre existe déjà.',
  busy: 'Cette chambre est en cours de ménage.', still_active: 'Désactive d’abord cette personne.', pin_format: 'Le code doit faire 4 chiffres.', empty: 'Message vide.', no_one: 'Personne à prévenir.',
};
async function api(a, payload = {}) {
  let r;
  try {
    r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', ...(S.secret ? { 'x-device': S.secret } : {}) }, body: JSON.stringify({ a, ...payload }) });
  } catch (e) { const err = new Error('net'); err.code = 'net'; throw err; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = j.error || 'server';
    if (code === 'auth' && a !== 'activate') { S.secret = null; LS.del('mh-secret'); S.loaded = false; render(); }
    const err = new Error(code); err.code = code; throw err;
  }
  return j;
}
function errMsg(e) {
  const c = (e && e.code) || '';
  if (c === 'net') return 'Pas de connexion internet. Réessaie.';
  if (c.startsWith('pin_wrong:')) return `Code faux. Encore ${c.split(':')[1]} essai(s).`;
  return ERR[c] || 'Ça n’a pas marché. Réessaie.';
}
async function act(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); await refresh(true); return true; }
  catch (e) { console.warn(e); toast(errMsg(e)); return false; }
}

/* ---------- chargement ---------- */
let refreshing = null;
async function refresh(force) {
  if (!S.secret) return;
  if (refreshing && !force) return refreshing;
  refreshing = (async () => {
    try {
      const d = await api('state');
      S.me = d.me; S.device = d.device; S.cfg = d.cfg || DEFAULT_CFG; S.vapid = d.vapid; S.urls = d.urls || {};
      S.rooms = {}; (d.rooms || []).forEach((r) => S.rooms[r.id] = normRoom(r));
      S.staff = d.staff || []; S.devices = d.devices || []; S.invites = d.invites || [];
      S.plan = d.plan || { avail: {} }; S.issues = d.issues || []; S.msgs = (d.msgs || []).slice().reverse(); S.reads = d.reads || [];
      S.loaded = true;
      if (S.me.role === 'menage') S.preview = false;
      softRender();
    } catch (e) { if (e.code === 'net' && !S.loaded) { $('app').innerHTML = `<div class="wrap"><div class="card empty"><div class="e">📶</div><h2>Pas de connexion</h2><p>Vérifie le wifi ou la 4G, puis réessaie.</p><button class="btn pri" data-a="reload">Réessayer</button></div></div>`; } }
    finally { refreshing = null; }
  })();
  return refreshing;
}
const isTyping = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
const isPlaying = () => [...document.querySelectorAll('audio,video')].some((m) => !m.paused);
function softRender() {
  if (S.rec || isTyping() || isPlaying()) { S.dirty = true; return; }
  S.dirty = false; render(); refreshSheet();
}
document.addEventListener('focusout', () => setTimeout(() => { if (S.dirty && !isTyping()) softRender(); }, 300));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 20000);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => { if (!e.data) return; if (e.data.type === 'refresh') refresh(); if (e.data.type === 'open' && e.data.conv) openConvWhenReady(e.data.conv); });
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; if (S.sheet === 'onboard') onboardSheet(); });

/* ---------- envoi de fichiers ---------- */
function pickFile(accept, capture) {
  return new Promise((res) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; if (capture) i.setAttribute('capture', capture);
    i.style.position = 'fixed'; i.style.left = '-9999px'; document.body.appendChild(i);
    let done = false; const fin = (v) => { if (done) return; done = true; i.remove(); res(v); };
    i.addEventListener('change', () => fin(i.files && i.files[0] || null));
    i.addEventListener('cancel', () => fin(null));
    i.click();
  });
}
async function shrink(file, label) {
  let img;
  try { img = await createImageBitmap(file); } catch (e) {
    img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
  }
  const w0 = img.width, h0 = img.height, k = Math.min(1, 1400 / Math.max(w0, h0)), w = Math.round(w0 * k), h = Math.round(h0 * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  if (label) {
    const fs = Math.max(15, Math.round(w / 42)); x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, h - fs * 2, w, fs * 2);
    x.fillStyle = '#fff'; x.font = '700 ' + fs + 'px sans-serif'; x.textBaseline = 'middle'; x.fillText(label, fs * .6, h - fs);
  }
  return await new Promise((r) => c.toBlob(r, 'image/jpeg', .72));
}
async function upload(blob, type, ext) {
  const u = await api('upload_url', { ext });
  const r = await fetch(u.url, { method: 'PUT', headers: { 'content-type': type, 'x-upsert': 'false' }, body: blob });
  if (!r.ok) { const e = new Error('upload'); e.code = 'upload'; throw e; }
  S.localUrls[u.path] = URL.createObjectURL(blob);
  return u.path;
}
async function takePhoto(label, needFresh) {
  const f = await pickFile('image/*', touch() ? 'environment' : null); if (!f) return null;
  if (needFresh && f.lastModified && Date.now() - f.lastModified > 15 * 60000) { toast('Prends la photo maintenant, avec l’appareil. Pas une ancienne photo.'); return null; }
  try { const b = await shrink(f, label); return await upload(b, 'image/jpeg', 'jpg'); }
  catch (e) { toast('La photo n’a pas pu partir. Vérifie la connexion et réessaie.'); return null; }
}
async function takeVideo() {
  const f = await pickFile('video/*', touch() ? 'environment' : null); if (!f) return null;
  if (f.size > 48 * 1024 * 1024) { toast('Vidéo trop longue. 15 secondes maximum.'); return null; }
  const type = f.type || 'video/mp4', ext = /webm/.test(type) ? 'webm' : (/quicktime/.test(type) ? 'mov' : 'mp4');
  toast('Envoi de la vidéo…', 8000);
  try { return await upload(f, type, ext); } catch (e) { toast('La vidéo n’a pas pu partir. Réessaie en plus court.'); return null; }
}

/* ---------- enregistrement vocal (garder appuyé) ---------- */
const recMime = () => ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
let recTimer = null;
// Le micro reste ouvert quelques minutes après un vocal : l'iPhone ne redemande pas l'autorisation à chaque fois.
const MIC_KEEP = 3 * 60000;
let micStream = null, micTimer = null;
async function getMic() {
  clearTimeout(micTimer);
  if (micStream && micStream.getAudioTracks().some((t) => t.readyState === 'live')) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  return micStream;
}
function releaseMic() { clearTimeout(micTimer); if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; } }
function releaseMicLater() { clearTimeout(micTimer); micTimer = setTimeout(releaseMic, MIC_KEEP); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && !S.rec) releaseMic(); });
async function startRec(ctx, btn) {
  if (S.rec) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Ce téléphone ne permet pas d’enregistrer ici. Mets à jour le navigateur.'); return; }
  S.rec = { ctx, btn, starting: true, chunks: [], t0: Date.now() };
  if (btn) btn.classList.add('rec');
  // Un vocal en lecture bloque le micro sur iPhone : on le met en pause.
  document.querySelectorAll('audio,video').forEach((m) => { try { m.pause(); } catch (_) {} });
  try {
    const stream = await getMic();
    const r = S.rec;
    if (!r || r.cancelled) { releaseMicLater(); return; }
    const mime = recMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    mr.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
    mr.start(250);
    Object.assign(r, { stream, mr, mime: mr.mimeType || mime, starting: false, t0: Date.now() });
    $('recov').hidden = false; $('rect').textContent = '0:00';
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - r.t0) / 1000); $('rect').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      if (s >= 120) stopRec(true);
    }, 250);
    if (navigator.vibrate) navigator.vibrate(30);
  } catch (e) {
    if (S.rec && S.rec.btn) S.rec.btn.classList.remove('rec');
    S.rec = null;
    toast('Le micro est refusé. Autorise le micro pour cette appli dans les réglages du téléphone.', 6000);
  }
}
async function stopRec(send) {
  const r = S.rec; if (!r) return;
  S.rec = null; clearInterval(recTimer); $('recov').hidden = true; if (r.btn) r.btn.classList.remove('rec');
  if (r.starting) { r.cancelled = true; toast('Garde le doigt appuyé pendant que tu parles.'); return; }
  const secs = (Date.now() - r.t0) / 1000;
  try { if (r.mr.state === 'recording') r.mr.requestData(); } catch (_) {}
  await new Promise((res) => { r.mr.onstop = res; try { r.mr.stop(); } catch (e) { res(); } });
  await new Promise((res) => setTimeout(res, 150)); // derniers morceaux parfois en retard
  releaseMicLater();
  if (!send) return;
  if (secs < 0.8) { toast('Garde le doigt appuyé pendant que tu parles, puis relâche.'); return; }
  const type = (r.mime || 'audio/webm').split(';')[0];
  const blob = new Blob(r.chunks, { type });
  if (blob.size < 1000) { releaseMic(); toast('Le micro n’a rien enregistré. Rien n’est parti : réessaie.', 6000); return; }
  const ext = type.includes('mp4') ? 'm4a' : (type.includes('ogg') ? 'ogg' : 'webm');
  await sendVoice(r.ctx, blob, type, ext, Math.round(secs));
  if (S.dirty) softRender();
}
async function sendVoice(ctx, blob, type, ext, secs) {
  const [kind, arg] = splitCtx(ctx);
  if (S.me.role !== 'menage' && (kind === 'boss' || kind === 'room')) { toast('Mode test : en vrai, ce vocal partirait aux responsables.'); return; }
  toast('Envoi du vocal…', 8000);
  let path;
  try { path = await upload(blob, type, ext); } catch (e) { toast('Le vocal n’a pas pu partir. Vérifie la connexion et réessaie.'); return; }
  if (kind === 'issue') {
    if (S.rep && S.rep.items && S.rep.items[arg]) { S.rep.items[arg].audio = path; S.rep.items[arg].audioSecs = secs; drawReport(); toast('Vocal ajouté ✓'); }
    return;
  }
  const payload = { media_path: path, media_type: 'audio', duration: secs, conv: kind === 'conv' ? arg : 'staff:' + S.me.id };
  if (kind === 'room') { const rm = S.rooms[arg]; if (rm) { payload.hotel = rm.hotel; payload.room = rm.num; } }
  await act(() => api('msg_send', payload), 'Vocal envoyé ✓');
}
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-hold]'); if (!b) return;
  e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {}
  startRec(b.dataset.hold, b);
});
document.addEventListener('pointerup', () => { if (S.rec) stopRec(true); });
document.addEventListener('pointercancel', () => { if (S.rec) stopRec(false); });
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-hold]')) e.preventDefault(); });
const holdBtn = (ctx, label, cls) => `<button class="btn hold ${cls || 'big pri'}" data-hold="${esc(ctx)}" aria-label="${esc(label)}">🎤 ${label}</button>`;

/* ---------- notifications ---------- */
function b64ToU8(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s); return Uint8Array.from(b, (c) => c.charCodeAt(0)); }
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function enablePush(silent) {
  if (!pushSupported()) { if (!silent) toast(isIOS() && !isStandalone() ? 'Ajoute d’abord l’appli à l’écran d’accueil, puis ouvre-la depuis l’icône.' : 'Ce téléphone ne permet pas les notifications ici.', 6000); return false; }
  try {
    const perm = silent ? Notification.permission : await Notification.requestPermission();
    if (perm !== 'granted') { if (!silent) toast('Notifications refusées. Tu peux les autoriser dans les réglages du téléphone.', 6000); return false; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(S.vapid) });
    await api('push_sub', { sub: sub.toJSON() });
    if (!silent) { await api('push_test'); toast('Notifications activées ✓'); }
    return true;
  } catch (e) { if (!silent) toast('Impossible d’activer les notifications ici.'); return false; }
}
async function testMic() {
  try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); LS.set('mh-mic', true); toast('Micro autorisé ✓'); return true; }
  catch (e) { toast('Micro refusé. Autorise-le dans les réglages du téléphone.', 6000); return false; }
}

/* ---------- rendu ---------- */
function render() {
  const a = $('app');
  if (!S.secret) { a.innerHTML = viewActivate(); return; }
  if (!S.loaded) { a.innerHTML = `<div class="wrap"><div class="empty"><div class="e">🧺</div><h2>Chargement…</h2></div></div>`; return; }
  document.body.dataset.hotel = (S.open && S.rooms[S.open]) ? S.rooms[S.open].hotel : S.hotel;
  a.innerHTML = role() === 'mgr' ? viewManager() : (S.open ? viewCleanRoom() : viewCleanHome());
  updateBadge();
}
// Pastille rouge sur l'icône de l'appli (écran d'accueil) = messages non lus.
let lastBadge = -1;
function updateBadge() {
  const n = unreadTotal(); if (n === lastBadge) return; lastBadge = n;
  try {
    const p = n > 0 ? navigator.setAppBadge && navigator.setAppBadge(n) : navigator.clearAppBadge && navigator.clearAppBadge();
    if (p && p.catch) p.catch(() => {});
  } catch (_) {}
}

/* ----- activation ----- */
function readHashCode() { const m = location.hash.match(/[#&]i=([0-9A-Za-z-]+)/); return m ? m[1].toUpperCase().replace(/[^0-9A-Z]/g, '') : null; }
const fmtCode = (c) => c ? c.slice(0, 4) + '-' + c.slice(4) : '';
function viewActivate() {
  const A = S.act || (S.act = { code: readHashCode(), info: null, checked: false, pin: '' });
  if (A.code && !A.checked) {
    A.checked = true;
    api('invite_info', { token: A.code }).then((r) => { A.info = r; render(); }).catch(() => { A.info = { valid: false, net: true }; render(); });
    return `<div class="wrap"><div class="empty"><div class="e">🧺</div><h2>Un instant…</h2></div></div>`;
  }
  const head = `<div class="logo" style="justify-content:center"><img src="icons/icon-192.png" alt=""><h1>Ménage</h1></div>`;
  if (!A.code) {
    return `<div class="wrap" style="max-width:480px">${head}<div class="card"><h2>Installer l’appli</h2>
      <p>Tape le <b>code d’invitation</b> écrit sur ta fiche (8 lettres et chiffres).</p>
      <input id="codeIn" autocomplete="off" autocapitalize="characters" placeholder="Ex. : K7M2-Q9XD" style="font-size:24px;text-align:center;letter-spacing:.1em">
      <button class="btn big pri" data-a="codeGo">Continuer</button></div></div>`;
  }
  if (!A.info) return `<div class="wrap"><div class="empty"><div class="e">🧺</div><h2>Un instant…</h2></div></div>`;
  if (!A.info.valid) {
    return `<div class="wrap" style="max-width:480px">${head}<div class="card empty"><div class="e">${A.info.net ? '📶' : '⛔'}</div>
      <h2>${A.info.net ? 'Pas de connexion' : 'Lien plus valable'}</h2><p>${A.info.net ? 'Vérifie internet puis réessaie.' : 'Ce lien a déjà servi ou a expiré. Demande un nouveau lien à ton responsable.'}</p>
      <button class="btn" data-a="${A.info.net ? 'reload' : 'codeReset'}">${A.info.net ? 'Réessayer' : 'J’ai un autre code'}</button></div></div>`;
  }
  if (isIOS() && !isStandalone()) {
    return `<div class="wrap" style="max-width:480px">${head}<div class="card"><h2>Bonjour ${esc(first(A.info.label))} 👋</h2>
      <p style="font-size:18px">D’abord, ajoute l’appli sur ton écran d’accueil :</p>
      <ol class="steps" style="font-size:18px"><li>Touche le bouton <b>Partager</b> <span style="font-size:22px">⬆️</span> en bas de l’écran.</li>
      <li>Touche <b>« Sur l’écran d’accueil »</b> ➕.</li><li>Touche <b>Ajouter</b>, puis ouvre l’icône <b>Ménage</b>.</li></ol>
      <p class="muted">Si l’appli te demande ton code d’invitation, c’est celui-ci :</p><div class="codebox">${fmtCode(A.code)}</div></div></div>`;
  }
  return `<div class="wrap" style="max-width:480px">${head}<div class="card pin"><h2>Bonjour ${esc(first(A.info.label))} 👋</h2>
    <p style="font-size:18px;text-align:center">Tape ton code à 4 chiffres</p>
    <div class="dots">${[0, 1, 2, 3].map((i) => `<i class="${i < A.pin.length ? 'on' : ''}"></i>`).join('')}</div>
    ${A.err ? `<p class="banner c-red" style="text-align:center">${esc(A.err)}</p>` : ''}
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-a="pinKey" data-k="${n}">${n}</button>`).join('')}<span></span><button data-a="pinKey" data-k="0">0</button><button class="ghost" data-a="pinDel" aria-label="Effacer">⌫</button></div></div></div>`;
}
async function pinSubmit() {
  const A = S.act;
  try {
    const ua = (navigator.userAgentData && navigator.userAgentData.platform) || '';
    const label = deviceLabel();
    const r = await api('activate', { token: A.code, pin: A.pin, ua: label || ua });
    S.secret = r.secret; LS.set('mh-secret', r.secret); S.act = null;
    history.replaceState(null, '', location.pathname);
    S.loaded = false; render(); await refresh(true);
    onboardSheet();
  } catch (e) {
    A.pin = ''; A.err = errMsg(e);
    if (e.code === 'locked' || e.code === 'invite_invalid') A.info = { valid: false };
    render();
  }
}
function deviceLabel() {
  const u = navigator.userAgent;
  const m = u.match(/Android [\d.]+; ([^;)]+)/); if (m) return 'Android · ' + m[1].replace(/ Build.*/, '').trim();
  if (/iPhone/.test(u)) return 'iPhone'; if (/iPad/.test(u) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Windows/.test(u)) return 'Ordinateur Windows'; if (/Mac OS X/.test(u)) return 'Mac'; if (/Android/.test(u)) return 'Android';
  return 'Appareil';
}

/* ----- prise en main ----- */
function onboardSheet() {
  const mic = LS.get('mh-mic', false), notif = pushSupported() && Notification.permission === 'granted';
  const inst = isStandalone();
  openSheet('onboard', `<div class="celebrate"><div class="e">🎉</div><h1>C’est installé !</h1><p>Encore ${inst ? 'deux petites étapes' : 'trois petites étapes'}.</p></div>
    ${inst ? '' : `<div class="card"><h3>1. Mettre l’icône sur l’écran d’accueil</h3>
      ${S.installEvt ? `<button class="btn big pri" data-a="install">📲 Installer l’appli</button>` : `<p>Dans le menu du navigateur <b>⋮</b>, touche <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.</p>`}</div>`}
    <div class="card"><h3>${inst ? '1' : '2'}. Autoriser le micro</h3><p class="muted">Pour envoyer des vocaux.</p>
      <button class="btn big ${mic ? 'ok' : 'pri'}" data-a="micTest">${mic ? '✓ Micro autorisé' : '🎤 Autoriser le micro'}</button></div>
    <div class="card"><h3>${inst ? '2' : '3'}. Autoriser les notifications</h3><p class="muted">Pour être prévenue des chambres et des messages.</p>
      <button class="btn big ${notif ? 'ok' : 'pri'}" data-a="pushOn">${notif ? '✓ Notifications activées' : '🔔 Autoriser les notifications'}</button></div>
    <button class="btn big" data-a="close">Ouvrir l’appli</button>`);
}

/* ----- gérant ----- */
function viewManager() {
  const owner = S.me.role === 'owner';
  const toCheck = Object.values(S.rooms).filter((x) => x.status === 'a_controler').length;
  const toPlan = Object.values(S.rooms).filter((x) => x.status === 'a_faire' && !x.assignee && !x.blocked).length;
  const newIssues = S.issues.filter((i) => i.status === 'nouveau').length;
  const unread = unreadTotal();
  const locked = S.staff.filter((s) => s.locked).length;
  const tabs = [['rooms', '🛏️ Chambres', 0], ['plan', '🗓️ Répartir', toPlan], ['check', '✅ À contrôler', toCheck], ['issues', '🔧 Problèmes', newIssues], ['msgs', '🎤 Messages', unread], ['team', '👥 Équipe', locked], ['settings', '⚙️ Réglages', 0]];
  let body = '';
  if (S.tab === 'rooms') body = viewRooms(); else if (S.tab === 'plan') body = viewPlan(); else if (S.tab === 'check') body = viewCheck();
  else if (S.tab === 'issues') body = viewIssues(); else if (S.tab === 'msgs') body = viewThreads(); else if (S.tab === 'team') body = viewTeam(); else body = viewSettings();
  return `<div class="wrap">
    <div class="top"><div class="logo"><img src="icons/icon-192.png" alt=""><div class="hero"><h1>Ménage</h1><span class="muted">${esc(S.me.label)} · ${owner ? 'propriétaire' : 'gérant'}</span></div></div>
      <button class="btn small" data-a="preview">👁 Écran ménage</button></div>
    <nav class="nav" aria-label="Sections">${tabs.map(([k, l, n]) => `<button data-a="tab" data-k="${k}" aria-pressed="${S.tab === k}">${l}${n ? `<span class="badge">${n}</span>` : ''}</button>`).join('')}</nav>
    ${S.tab !== 'msgs' ? inboxCard() : ''}
    ${body}</div>
    ${S.tab !== 'msgs' && !S.sel.size ? `<button class="bubble ${unread ? 'ping' : ''}" data-a="convList" aria-label="Messages${unread ? ', ' + unread + ' non lus' : ''}">💬${unread ? `<span class="badge">${unread}</span>` : ''}</button>` : ''}`;
}
// Encart en haut de l'accueil : les conversations avec des messages non lus, un toucher pour les ouvrir.
function inboxCard() {
  const cs = myConvs().filter((c) => unreadIn(c)).sort(byLast);
  if (!cs.length) return '';
  const n = cs.reduce((t, c) => t + unreadIn(c), 0);
  return `<div class="card inbox"><div class="row between"><h3>💬 ${n} message${n > 1 ? 's' : ''} non lu${n > 1 ? 's' : ''}</h3><button class="btn small ghost" data-a="tab" data-k="msgs">Tout voir</button></div>
    <div class="list">${cs.slice(0, 4).map(convRow).join('')}</div>${cs.length > 4 ? `<span class="muted">+ ${cs.length - 4} autre${cs.length - 4 > 1 ? 's' : ''} conversation${cs.length - 4 > 1 ? 's' : ''}</span>` : ''}</div>`;
}
function hotelCards() {
  const hs = S.me.only_hotel ? HOTELS.filter((h) => h.id === S.me.only_hotel) : HOTELS;
  return `<div class="hotels" role="group" aria-label="Hôtel">${hs.map((h) => {
    const l = roomsOf(h.id), c = (k) => l.filter((r) => !r.blocked && r.status === k).length;
    const mini = [[c('a_faire'), 'à faire'], [c('en_cours'), 'en cours'], [c('a_controler'), 'à contrôler']].filter((x) => x[0]).map((x) => `<span>${x[0]} ${x[1]}</span>`).join('');
    return `<button class="hcard" style="background-image:${photoUrl(h.id)}" data-a="hotel" data-k="${h.id}" aria-pressed="${S.hotel === h.id}"><b>${esc(h.name)}</b><span class="mini">${mini || '<span>tout est prêt ✨</span>'}</span></button>`;
  }).join('')}</div>`;
}
const hotelSeg = () => `<div class="seg" role="group" aria-label="Hôtel">${HOTELS.map((h) => `<button data-a="hotel" data-k="${h.id}" aria-pressed="${S.hotel === h.id}">${h.e} ${esc(h.name)}</button>`).join('')}</div>`;
function plate(r) {
  const st = ST[r.status] || ST.propre, sel = S.sel.has(r.id);
  const s = r.blocked ? '⛔ Bloquée' : (r.status !== 'propre' && TY[r.type] ? `${TY[r.type].e} ${st.l}` : st.l);
  const who = r.blocked ? esc(r.blockReason || '') : (r.status !== 'propre' ? (r.assignee ? esc(first(nameOf(r.assignee))) : (r.status === 'a_faire' ? 'à répartir' : '&nbsp;')) : '&nbsp;');
  return `<button class="plate st-${r.status} ${r.blocked ? 'blocked' : ''} ${sel ? 'sel' : ''}" data-a="pick" data-id="${r.id}" aria-pressed="${sel}" aria-label="Chambre ${esc(r.num)}">
    ${sel ? '<span class="tick">✓</span>' : ''}<span class="n">${esc(r.num)}</span><span class="s">${s}</span><span class="who">${who}</span></button>`;
}
function viewRooms() {
  const list = roomsOf(S.hotel), blocked = list.filter((r) => r.blocked).length, cnt = (k) => list.filter((r) => !r.blocked && r.status === k).length;
  return `${hotelCards()}
    <div class="chips"><span class="chip c-red">À faire <b>${cnt('a_faire')}</b></span><span class="chip c-amber">En cours <b>${cnt('en_cours')}</b></span>
      <span class="chip c-green">À contrôler <b>${cnt('a_controler')}</b></span><span class="chip c-slate">Prêtes <b>${cnt('propre')}</b></span>${blocked ? `<span class="chip c-plain">⛔ Bloquées <b>${blocked}</b></span>` : ''}</div>
    <p class="muted">Touche une ou plusieurs chambres, puis choisis en bas : pour qui, ou « à répartir » pour laisser l’appli proposer.</p>
    ${list.length ? `<div class="grid">${list.map(plate).join('')}</div>` : `<div class="card empty"><div class="e">🚪</div><h3>Pas encore de chambres ici</h3><p class="muted">Ajoute-les dans Réglages.</p></div>`}
    ${S.sel.size ? actionBar() : ''}`;
}
function actionBar() {
  const ids = [...S.sel], rooms = ids.map((i) => S.rooms[i]).filter(Boolean);
  const people = cleaners().map((s) => s.id); people.push(S.me.id);
  const allBlocked = rooms.length && rooms.every((r) => r.blocked);
  const opt = (id) => `<option value="${id}" ${S.assignTo === id ? 'selected' : ''}>${esc(id === S.me.id ? 'Moi (test)' : nameOf(id))}${!habitual(id, S.hotel) ? ' (pas son hôtel habituel)' : ''}</option>`;
  return `<div class="bar"><div class="in">
    <div class="row between"><b>${ids.length} chambre${ids.length > 1 ? 's' : ''} : ${rooms.map((r) => esc(r.num)).join(', ')}</b><button class="btn small ghost" data-a="clearSel">Annuler</button></div>
    <div class="row"><label for="assignTo" class="muted">Pour</label><select id="assignTo" data-change="assignTo" style="flex:1"><option value="">Choisir…</option>
      <option value="__none" ${S.assignTo === '__none' ? 'selected' : ''}>🗓️ À répartir plus tard</option>${people.filter((id) => habitual(id, S.hotel)).map(opt).join('')}${people.filter((id) => !habitual(id, S.hotel)).map(opt).join('')}</select></div>
    <div class="row"><button class="btn pri" data-a="assign" data-t="blanc">🛏️ À blanc</button><button class="btn pri" data-a="assign" data-t="recouche">🔄 Recouche</button>
      <button class="btn" data-a="markClean">✓ Prête</button><button class="btn" data-a="${allBlocked ? 'unblockSel' : 'blockSel'}">${allBlocked ? '🔓 Débloquer' : '⛔ Bloquer'}</button>
      ${ids.length === 1 ? `<button class="btn" data-a="roomSheet" data-id="${ids[0]}">📋 Fiche</button>` : ''}</div></div></div>`;
}

/* ----- répartition ----- */
const availOf = (uid) => { const a = (S.plan.avail || {})[uid]; return a === undefined ? null : a; };
function planPool() {
  return Object.values(S.rooms).filter((r) => r.status === 'a_faire' && !r.blocked && !r.rejectNote && (!r.assignee || (S.rebalance && staffById(r.assignee) && staffById(r.assignee).role === 'menage')));
}
function viewPlan() {
  const m = cfg().minutes, people = cleaners().map((s) => s.id);
  const todo = planPool(), pool = new Set(todo.map((r) => r.id)), need = todo.reduce((s, r) => s + estimate(r), 0);
  const present = people.filter((u) => (availOf(u) || 0) > 0), capTot = present.reduce((s, u) => s + availOf(u) * 60, 0);
  const already = Object.values(S.rooms).filter((r) => r.assignee && !pool.has(r.id) && (r.status === 'a_faire' || r.status === 'en_cours')).reduce((s, r) => s + (present.includes(r.assignee) ? estimate(r) : 0), 0);
  const byH = HOTELS.map((h) => { const l = todo.filter((r) => r.hotel === h.id); return l.length ? `<span class="chip c-plain">${h.e} ${esc(h.name)} : <b>${l.filter((r) => r.type === 'blanc').length}</b> à blanc · <b>${l.filter((r) => r.type === 'recouche').length}</b> recouches</span>` : ''; }).join('');
  const rows = people.map((u) => {
    const s = staffById(u), a = availOf(u), on = (a || 0) > 0;
    return `<div class="who-row"><span class="nm">${esc(s.label)}<br><span class="muted">${(s.hotels && s.hotels.length && s.hotels.length < 3) ? s.hotels.map((h) => H(h).e + ' ' + esc(hotelName(h))).join(', ') : 'Polyvalente, tous les hôtels'}</span></span>
      <button class="toggle" data-a="avail" data-id="${u}" aria-pressed="${on}">${on ? '✓ Présente' : 'Absente'}</button>
      ${on ? `<label class="muted" for="hrs-${u}">Heures</label><input id="hrs-${u}" type="number" min="0.5" max="12" step="0.5" value="${a}" data-change="hours" data-id="${u}" style="width:84px">` : `<span class="muted">${s.hours || 6} h d’habitude</span>`}</div>`;
  }).join('');
  return `<div class="card"><div class="row between"><h2>Qui travaille aujourd’hui ?</h2><span class="muted">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      ${people.length ? rows : '<p class="muted">Ajoute d’abord ton équipe dans l’onglet Équipe.</p>'}</div>
    <div class="card"><h2>À répartir</h2>
      ${todo.length ? `<div class="chips">${byH}</div>` : '<p class="muted">Aucune chambre à répartir. Dans Chambres, sélectionne les chambres et choisis « À répartir plus tard ».</p>'}
      <p>Travail prévu : <b>${mn(need)}</b>${already ? ` + ${mn(already)} déjà commencés ou fixés` : ''} · Temps disponible : <b>${mn(capTot)}</b></p>
      <div class="meter ${need + already > capTot ? 'over' : (need + already > capTot * .85 ? 'warn' : '')}"><i style="width:${capTot ? Math.min(100, Math.round(100 * (need + already) / capTot)) : 0}%"></i></div>
      <p class="muted">Temps prévus : à blanc ${m.blanc} min, recouche ${m.recouche} min, tâche de fond ${m.fond} min (Réglages).</p>
      <div class="row"><button class="toggle" data-a="rebalance" aria-pressed="${S.rebalance}">${S.rebalance ? '✓' : '＋'} Redistribuer aussi les chambres déjà données mais pas commencées</button></div>
      <div class="row"><button class="toggle" data-a="withFond" aria-pressed="${S.withFond}">${S.withFond ? '✓' : '＋'} Remplir le temps libre avec des tâches de fond</button></div>
      <button class="btn big pri" data-a="propose">✨ Proposer une répartition</button></div>
    ${S.proposal ? viewProposal() : ''}`;
}
function propose() {
  const m = cfg().minutes;
  const people = cleaners().filter((s) => (availOf(s.id) || 0) > 0).map((s) => s.id);
  if (!people.length) { toast('Indique d’abord qui travaille aujourd’hui.'); return; }
  const cap = {}, load = {}, inH = {};
  people.forEach((u) => { cap[u] = availOf(u) * 60; load[u] = 0; inH[u] = new Set(); });
  const todo = planPool(), pool = new Set(todo.map((r) => r.id));
  Object.values(S.rooms).forEach((r) => { if (r.assignee && load[r.assignee] != null && !pool.has(r.id) && (r.status === 'a_faire' || r.status === 'en_cours')) { load[r.assignee] += estimate(r); inH[r.assignee].add(r.hotel); } });
  todo.sort((a, b) => (a.type === 'blanc' ? 0 : 1) - (b.type === 'blanc' ? 0 : 1) || a.hotel.localeCompare(b.hotel) || a.order - b.order);
  const assign = {}, left = [], spec = (u) => ((staffById(u).hotels || []).length || 3);
  for (const r of todo) {
    const t = estimate(r), fits = (u) => load[u] + t <= cap[u];
    let c = people.filter((u) => habitual(u, r.hotel) && fits(u));
    if (!c.length) c = people.filter(fits);
    if (!c.length) { left.push(r.id); continue; }
    const score = (u) => (load[u] + t) / cap[u] + (inH[u].size && !inH[u].has(r.hotel) ? 0.3 : 0) + (habitual(u, r.hotel) ? 0 : 0.5) - (spec(u) < 3 ? 0.08 : 0);
    c.sort((a, b) => score(a) - score(b));
    const u = c[0]; assign[r.id] = u; load[u] += t; inH[u].add(r.hotel);
  }
  const fond = [];
  if (S.withFond) {
    const taken = new Set(Object.keys(assign));
    for (const u of people) {
      let spare = cap[u] - load[u]; if (spare < m.fond) continue;
      const hs = [...inH[u]]; if (!hs.length) hs.push((staffById(u).hotels || [])[0] || 'arc');
      const cand = [];
      hs.forEach((h) => roomsOf(h).forEach((r) => { if (r.blocked || r.assignee || taken.has(r.id) || r.status !== 'propre') return; const sd = soonDue(r); if (sd.length) cand.push({ r, od: sd.map((x) => x.p), score: sd[0].ratio }); }));
      cand.sort((a, b) => b.score - a.score);
      for (const { r, od } of cand) {
        if (spare < m.fond) break;
        const n = Math.min(3, od.length, Math.floor(spare / m.fond)); if (n < 1) break;
        fond.push({ room: r.id, uid: u, tasks: od.slice(0, n).map((p) => p.id) }); taken.add(r.id); spare -= n * m.fond; load[u] += n * m.fond;
      }
    }
  }
  S.proposal = { assign, fond, left, people };
}
function viewProposal() {
  const P = S.proposal, m = cfg().minutes;
  const per = {}; P.people.forEach((u) => per[u] = { rows: [], fixed: [], load: 0, cap: (availOf(u) || 0) * 60 });
  const moved = new Set([...Object.keys(P.assign), ...P.left]);
  Object.values(S.rooms).forEach((r) => { if (r.assignee && per[r.assignee] && !moved.has(r.id) && (r.status === 'a_faire' || r.status === 'en_cours')) { per[r.assignee].fixed.push(r); per[r.assignee].load += estimate(r); } });
  Object.entries(P.assign).forEach(([id, u]) => { const r = S.rooms[id]; if (r && per[u]) { per[u].rows.push({ kind: 'room', r }); per[u].load += estimate(r); } });
  P.fond.forEach((f, i) => { const r = S.rooms[f.room]; if (r && per[f.uid]) { per[f.uid].rows.push({ kind: 'fond', r, f, i }); per[f.uid].load += m.fond * f.tasks.length; } });
  const sel = (cur, attr, none) => `<select ${attr} aria-label="Changer de personne">${P.people.map((u) => `<option value="${u}" ${u === cur ? 'selected' : ''}>${esc(first(nameOf(u)))}</option>`).join('')}<option value="" ${cur ? '' : 'selected'}>${none || 'Retirer'}</option></select>`;
  const cards = P.people.map((u) => {
    const p = per[u], pct = p.cap ? Math.round(100 * p.load / p.cap) : 0;
    const rows = p.rows.sort((a, b) => a.r.hotel.localeCompare(b.r.hotel) || a.r.order - b.r.order).map((x) => {
      const exc = !habitual(u, x.r.hotel) ? ' <span class="chip c-amber">⚠ pas son hôtel</span>' : '';
      if (x.kind === 'room') return `<div class="li"><span class="t">${H(x.r.hotel).e} <b>Ch. ${esc(x.r.num)}</b> · ${TY[x.r.type].e} ${TY[x.r.type].l} · ${mn(estimate(x.r))}${exc}</span>${sel(u, `data-change="mvRoom" data-id="${x.r.id}"`)}</div>`;
      const labels = x.f.tasks.map((t) => { const q = cfg().periodic.find((z) => z.id === t); return q ? q.l : t; }).join(', ');
      return `<div class="li"><span class="t">${H(x.r.hotel).e} <b>Ch. ${esc(x.r.num)}</b> · ⭐ ${esc(labels)} · ${mn(m.fond * x.f.tasks.length)}${exc}</span>${sel(u, `data-change="mvFond" data-i="${x.i}"`)}</div>`;
    }).join('');
    return `<div class="card"><div class="row between"><h3>${esc(nameOf(u))}</h3><b>${mn(p.load)} / ${mn(p.cap)}</b></div>
      <div class="meter ${pct > 100 ? 'over' : (pct > 85 ? 'warn' : '')}"><i style="width:${Math.min(100, pct)}%"></i></div>${pct > 100 ? '<p class="banner c-red">Trop de travail pour ses heures.</p>' : ''}
      ${p.fixed.length ? `<p class="muted">Déjà en cours ou fixé : ${p.fixed.map((r) => 'ch. ' + esc(r.num)).join(', ')}</p>` : ''}${rows ? `<div class="list">${rows}</div>` : '<p class="muted">Rien de nouveau.</p>'}</div>`;
  }).join('');
  const left = P.left.map((id) => S.rooms[id]).filter(Boolean);
  return `<h2>Proposition</h2><p class="muted">Tu peux déplacer une chambre vers une autre personne, même hors de ses hôtels habituels.</p>${cards}
    ${left.length ? `<div class="card"><h3>Pas assez de temps pour ${left.length} chambre${left.length > 1 ? 's' : ''}</h3><div class="list">${left.map((r) => `<div class="li"><span class="t">${H(r.hotel).e} <b>Ch. ${esc(r.num)}</b> · ${TY[r.type].l} · ${mn(estimate(r))}</span>${sel('', `data-change="mvRoom" data-id="${r.id}"`, 'Personne')}</div>`).join('')}</div></div>` : ''}
    <button class="btn big pri" data-a="planGo">✓ Valider et prévenir l’équipe</button><button class="btn ghost" data-a="planCancel">Annuler la proposition</button>`;
}

/* ----- contrôle ----- */
function jobPhotos(job) {
  if (!job || !job.photos || !job.photos.length) return '<p class="muted">Pas de photo.</p>';
  return `<div class="thumbs">${job.photos.map((p) => { const u = mediaUrl(p.id); return `<button data-a="zoom" data-id="${esc(p.id)}" data-l="${esc(p.l)}">${u ? `<img loading="lazy" alt="" src="${esc(u)}">` : '<div class="gone">Photo effacée</div>'}<span>${esc(p.l)}</span></button>`; }).join('')}</div>`;
}
function checkCard(r) {
  const j = r.lastJob || {};
  return `<div class="card"><div class="row between"><h3>${H(r.hotel).e} Ch. ${esc(r.num)} · ${esc(hotelName(r.hotel))}</h3><span class="chip c-green">${j.type && TY[j.type] ? TY[j.type].e + ' ' + TY[j.type].l : ''}</span></div>
    <p class="muted">${esc(nameOf(j.uid || r.doneBy))} · ${hm(j.start)} → ${hm(j.end)} · ${dur((j.end || 0) - (j.start || 0))}</p>${jobPhotos(j)}
    <div class="row"><button class="btn ok" data-a="validate" data-id="${r.id}">✓ Valider</button><button class="btn bad" data-a="redo" data-id="${r.id}">🔁 À refaire</button></div></div>`;
}
function viewCheck() {
  const list = Object.values(S.rooms).filter((r) => r.status === 'a_controler').sort((a, b) => (a.doneAt || 0) - (b.doneAt || 0));
  if (!list.length) return `<div class="card empty"><div class="e">✅</div><h3>Rien à contrôler</h3><p class="muted">Les chambres terminées arrivent ici avec leurs photos.</p></div>`;
  return `<div class="col">${list.map(checkCard).join('')}</div>`;
}

/* ----- problèmes ----- */
function mediaBlock(p, kind) {
  if (!p) return ''; const u = mediaUrl(p);
  if (!u) return '<p class="muted">Fichier effacé.</p>';
  if (kind === 'photo') return `<div class="thumbs"><button data-a="zoom" data-id="${esc(p)}" data-l="Photo"><img loading="lazy" alt="" src="${esc(u)}"></button></div>`;
  if (kind === 'video') return `<video controls playsinline preload="metadata" src="${esc(u)}"></video>`;
  return `<audio controls preload="metadata" src="${esc(u)}"></audio>`;
}
function issueCard(i) {
  const k = KINDS.find((x) => x.k === i.kind) || KINDS[KINDS.length - 1];
  const st = { nouveau: '<span class="chip c-red">Nouveau</span>', notion: '<span class="chip c-accent">Dans Notion</span>', regle: '<span class="chip c-green">Réglé</span>' }[i.status] || '';
  return `<div class="card"><div class="row between"><h3>${k.e} ${esc(k.l)}${i.urgent ? ' <span class="chip c-red">🚨 Urgent</span>' : ''}</h3>${st}</div>
    <p><b>${H(i.hotel).e} ${esc(hotelName(i.hotel))}${i.room ? ' · ch. ' + esc(i.room) : ''}</b> <span class="muted">· ${esc(nameOf(i.by_staff))} · ${when(i.created_at)}</span></p>
    ${i.text ? `<p>${esc(i.text)}</p>` : ''}${mediaBlock(i.photo, 'photo')}${mediaBlock(i.video, 'video')}${mediaBlock(i.audio, 'audio')}
    ${i.notion_url ? `<p class="muted"><a href="${esc(i.notion_url)}" target="_blank" rel="noopener">Fiche Notion</a></p>` : ''}
    <div class="row">${i.status !== 'regle' ? `<button class="btn small" data-a="issueStatus" data-id="${i.id}" data-s="regle">✓ ${k.k === 'oubli' ? 'Rendu au client' : 'Réglé'}</button>` : `<button class="btn small ghost" data-a="issueStatus" data-id="${i.id}" data-s="nouveau">Rouvrir</button>`}</div></div>`;
}
function viewIssues() {
  const f = S.issueFilter, n = (k) => S.issues.filter((i) => i.status === k).length, list = S.issues.filter((i) => i.status === f);
  return `<div class="row between"><div class="seg" role="group" aria-label="Filtre">${[['nouveau', 'Nouveaux'], ['notion', 'Dans Notion'], ['regle', 'Réglés']].map(([k, l]) => `<button data-a="issueFilter" data-k="${k}" aria-pressed="${f === k}">${l} (${n(k)})</button>`).join('')}</div>
    <button class="btn small soft" data-a="report">＋ Signaler</button></div>
    ${list.length ? `<div class="col">${list.map(issueCard).join('')}</div>` : `<div class="card empty"><div class="e">🔧</div><h3>Aucun problème ici</h3><p class="muted">Quand l’équipe signale une panne, elle apparaît ici avec sa photo ou son vocal.</p></div>`}`;
}

/* ----- messages ----- */
function convRow(c) {
  const ms = convMsgs(c), last = ms[ms.length - 1], un = unreadIn(c);
  const prev = !last ? '<span class="muted">Pas encore de message</span>' : `<span class="muted">${last.from_staff === S.me.id ? 'Moi' : esc(first(nameOf(last.from_staff)))} : ${last.media_path || last.media_type === 'expired' ? '🎤 Vocal' : esc((last.text || '').slice(0, 60))}${last.room ? ' · ch. ' + esc(last.room) : ''} · ${when(last.created_at)}</span>`;
  return `<button class="li" style="text-align:left;cursor:pointer" data-a="threadOpen" data-id="${esc(c)}"><span class="t"><b>${esc(convLabel(c))}</b><br>${prev}</span>${un ? `<span class="badge">${un}</span>` : ''}</button>`;
}
const byLast = (a, b) => { const la = convMsgs(a), lb = convMsgs(b); return (ts(lb.length && lb[lb.length - 1].created_at) || 0) - (ts(la.length && la[la.length - 1].created_at) || 0); };
function viewThreads() {
  const all = myConvs();
  const groups = ['team', 'mgrs'];
  const staffC = all.filter((c) => c.startsWith('staff:')).sort(byLast);
  const dms = all.filter((c) => c.startsWith('dm:')).sort(byLast);
  return `<div class="card"><div class="row between"><h2>Messages</h2><button class="btn small pri" data-a="newMsg">＋ Nouveau message</button></div>
      <p class="muted">Seules les personnes de la conversation reçoivent la notification.</p>
      <div class="list">${groups.map(convRow).join('')}</div></div>
    ${dms.length ? `<div class="card"><h3>🔒 Privés</h3><div class="list">${dms.map(convRow).join('')}</div></div>` : ''}
    <div class="card"><h3>🧺 Femmes de ménage</h3><p class="muted">Chaque conversation : elle + tous les responsables.</p>
      ${staffC.length ? `<div class="list">${staffC.map(convRow).join('')}</div>` : '<p class="muted">Pas encore de femme de ménage dans l’équipe.</p>'}</div>`;
}
function newMsgSheet() {
  const others = S.staff.filter((s) => s.active !== false && s.id !== S.me.id);
  const mgrs = others.filter((s) => isMgrRole(s.role)), cl = others.filter((s) => s.role === 'menage');
  const btn = (c, title, sub) => `<button class="li" style="text-align:left;cursor:pointer" data-a="threadOpen" data-id="${esc(c)}"><span class="t"><b>${esc(title)}</b><br><span class="muted">${esc(sub)}</span></span></button>`;
  openSheet('newmsg', `${sheetHead('Nouveau message')}
    <div class="card"><h3>Groupes</h3><div class="list">${btn('team', '📢 Toute l’équipe', 'Tout le monde')}${isMgr() ? btn('mgrs', '👔 Responsables', 'Propriétaire et gérants seulement') : ''}</div></div>
    ${mgrs.length ? `<div class="card"><h3>🔒 Une seule personne (privé)</h3><div class="list">${mgrs.map((s) => btn(dmConv(S.me.id, s.id), s.label, ROLE_L[s.role] + ' · seulement vous deux')).join('')}</div></div>` : ''}
    ${isMgr() && cl.length ? `<div class="card"><h3>🧺 Femmes de ménage</h3><div class="list">${cl.map((s) => btn('staff:' + s.id, s.label, 'Elle + tous les responsables')).join('')}${cl.map((s) => btn(dmConv(S.me.id, s.id), '🔒 ' + s.label + ' (privé)', 'Seulement vous deux')).join('')}</div></div>` : ''}`);
}
function heardText(m, conv) {
  if (m.from_staff !== S.me.id) return '';
  const others = convMembers(conv).filter((id) => id !== S.me.id);
  const heard = others.filter((id) => readAt(id, conv) >= ts(m.created_at));
  if (conv.startsWith('dm:') || others.length === 1) return heard.length ? '✓✓ Lu' : '✓ Envoyé';
  if (!heard.length) return '✓ Envoyé';
  return '✓✓ Lu par ' + (heard.length <= 3 ? heard.map((id) => first(nameOf(id))).join(', ') : heard.length + ' personnes');
}
function msgHtml(m, conv) {
  const mine = m.from_staff === S.me.id;
  const u = mediaUrl(m.media_path);
  const media = m.media_path ? (u ? `<audio controls preload="metadata" src="${esc(u)}"></audio>` : '<span class="muted">Vocal indisponible</span>') : (m.media_type === 'expired' ? '<span class="muted">🎤 Vocal effacé après 30 jours</span>' : (m.media_type === 'empty' ? '<span class="muted">🎤 Vocal vide : le micro n’a rien enregistré</span>' : ''));
  const heard = heardText(m, conv);
  return `<div class="msg ${mine ? 'me' : ''}"><span class="meta">${esc(mine ? 'Moi' : nameOf(m.from_staff))} · ${when(m.created_at)}${m.room ? ` · ${H(m.hotel).e} ch. ${esc(m.room)}` : ''}</span>
    ${m.text ? `<span class="txt">${esc(m.text)}</span>` : ''}${media}${m.duration ? `<span class="meta">${m.duration} s</span>` : ''}${heard ? `<span class="meta" style="align-self:flex-end">${heard}</span>` : ''}</div>`;
}
function threadSheet(conv) {
  if (conv === 'all') conv = 'team';
  if (conv && !conv.includes(':') && conv !== 'team' && conv !== 'mgrs') conv = 'staff:' + conv;
  const ms = convMsgs(conv);
  openSheet('thread:' + conv, `<div class="row between"><div><h2>${esc(convLabel(conv))}</h2><span class="muted">${esc(convSub(conv))}</span></div><button class="btn small" data-a="close">Fermer</button></div>
    <div class="thread" id="thr">${ms.length ? ms.map((m) => msgHtml(m, conv)).join('') : '<p class="muted" style="text-align:center">Pas encore de message.</p>'}</div>
    <div class="composer">${holdBtn('conv:' + conv, 'Garde appuyé pour parler')}
      <div class="row"><input id="msgText" placeholder="Ou écris un message" style="flex:1"><button class="btn" data-a="sendText" data-ctx="${esc(conv)}">Envoyer</button></div></div>`, 'chat');
  const el = $('thr'); if (el) el.scrollTop = el.scrollHeight;
  if (unreadIn(conv)) {
    S.reads = S.reads.filter((x) => !(x.staff_id === S.me.id && x.conv === conv)).concat([{ staff_id: S.me.id, conv, read_at: new Date().toISOString() }]);
    api('read_mark', { conv }).catch(() => {});
    if (!S.sheetLock) { S.sheetLock = true; setTimeout(() => { S.sheetLock = false; render(); }, 0); }
  }
}
function convListSheet() {
  if (role() === 'mgr') {
    const cs = myConvs().sort(byLast).sort((a, b) => (unreadIn(b) ? 1 : 0) - (unreadIn(a) ? 1 : 0));
    openSheet('convs', `${sheetHead('Messages')}<button class="btn pri" data-a="newMsg">＋ Nouveau message</button>
      <div class="list">${cs.map(convRow).join('')}</div>`);
    return;
  }
  const cs = myConvs().sort(byLast);
  openSheet('convs', `${sheetHead('Messages')}${holdBtn('boss', 'Garde appuyé pour parler aux responsables', 'big soft')}
    <div class="list">${cs.map(convRow).join('')}</div>
    ${S.staff.some((s) => isMgrRole(s.role) && s.id !== S.me.id) ? '<button class="btn" data-a="newMsg">🔒 Message privé à un responsable</button>' : ''}`);
}

/* ----- équipe ----- */
function personStatus(s) {
  const devs = S.devices.filter((d) => d.staff_id === s.id), inv = S.invites.find((i) => i.staff_id === s.id);
  const chips = [];
  if (s.active === false) chips.push('<span class="chip c-plain">Désactivée</span>');
  else if (s.locked) chips.push('<span class="chip c-red">🔒 Bloquée</span>');
  else if (devs.length) chips.push(`<span class="chip c-green">📱 Installée${devs.length > 1 ? ` (${devs.length})` : ''}</span>`);
  else if (inv) chips.push('<span class="chip c-amber">Lien envoyé</span>');
  else chips.push('<span class="chip c-plain">Pas encore installée</span>');
  if (s.push) chips.push('<span class="chip c-accent">🔔</span>');
  return chips.join('');
}
function viewTeam() {
  return `<div class="row between"><h2>Équipe</h2><button class="btn pri" data-a="personNew">＋ Ajouter une personne</button></div>
    ${S.staff.map((s) => {
      const devs = S.devices.filter((d) => d.staff_id === s.id), owner = s.role === 'owner', canTouch = !owner || S.me.role === 'owner';
      return `<div class="card"><div class="row between"><div><h3>${esc(s.label)}</h3><span class="muted">${ROLE_L[s.role]}${s.role === 'menage' ? ' · ' + ((s.hotels || []).length >= 3 ? 'polyvalente' : (s.hotels || []).map((h) => H(h).e + ' ' + hotelName(h)).join(', ')) + ' · ' + (s.hours || 6) + ' h' : ''}${s.only_hotel ? ' · seulement ' + hotelName(s.only_hotel) : ''}</span></div><div class="chips">${personStatus(s)}</div></div>
        ${devs.length ? `<div class="list">${devs.map((d) => `<div class="li"><span class="t">📱 ${esc(d.label || 'Appareil')}<br><span class="muted">installé ${when(d.created_at)} · vu ${when(d.last_seen)}</span></span>${d.id === S.device ? '<span class="chip c-accent">Ce téléphone</span>' : (canTouch ? `<button class="btn small bad" data-a="devRevoke" data-id="${d.id}">Déconnecter</button>` : '')}</div>`).join('')}</div>` : ''}
        ${canTouch && s.active !== false ? `<div class="row"><button class="btn small soft" data-a="inviteNew" data-id="${s.id}">📲 ${devs.length ? 'Nouveau lien (nouveau téléphone)' : (s.locked ? 'Débloquer : nouveau lien' : 'Lien d’installation')}</button>
          <button class="btn small" data-a="personEdit" data-id="${s.id}">Modifier</button>${owner ? '' : `<button class="btn small ghost" data-a="personActive" data-id="${s.id}" data-v="0">Désactiver</button>`}</div>` : ''}
        ${s.active === false ? `<div class="row"><button class="btn small" data-a="personActive" data-id="${s.id}" data-v="1">Réactiver</button><button class="btn small bad" data-a="personDelete" data-id="${s.id}">🗑️ Supprimer définitivement</button></div>` : ''}</div>`;
    }).join('')}
    <div class="card"><div class="row between"><h3>Temps réels sur 30 jours</h3><button class="btn small" data-a="stats">${S.stats ? 'Actualiser' : 'Calculer'}</button></div>
      ${S.stats ? statsTable(S.stats) : '<p class="muted">Temps moyen par chambre à blanc et par recouche, pour chaque personne.</p>'}</div>`;
}
function statsTable(jobs) {
  const by = {};
  jobs.forEach((j) => { const d = ts(j.ended_at) - ts(j.started_at); if (!(d > 0)) return; const b = by[j.staff_id] || (by[j.staff_id] = { blanc: [], recouche: [], fond: [] }); (b[j.type] || (b[j.type] = [])).push(d); });
  const rows = Object.entries(by); if (!rows.length) return '<p class="muted">Pas encore de chambre terminée sur 30 jours.</p>';
  const avg = (a) => a && a.length ? dur(a.reduce((x, y) => x + y, 0) / a.length) : '–';
  return `<div class="scroll"><table class="tbl"><thead><tr><th>Personne</th><th>À blanc</th><th>Moy.</th><th>Recouche</th><th>Moy.</th></tr></thead><tbody>
    ${rows.map(([id, v]) => `<tr><td>${esc(nameOf(id))}</td><td>${v.blanc.length}</td><td>${avg(v.blanc)}</td><td>${v.recouche.length}</td><td>${avg(v.recouche)}</td></tr>`).join('')}</tbody></table></div>`;
}
function personSheet(id) {
  const s = id ? staffById(id) : null, rl = s ? s.role : 'menage', hs = s ? (s.hotels || []) : HOTELS.map((h) => h.id);
  openSheet('person', `<div class="row between"><h2>${s ? 'Modifier' : 'Nouvelle personne'}</h2><button class="btn small" data-a="close">Fermer</button></div>
    <div class="card"><label class="muted" for="p-label">Prénom affiché</label><input id="p-label" value="${esc(s ? s.label : '')}" placeholder="Ex. : Fatima">
      ${s && s.role === 'owner' ? '<p class="muted">Rôle : propriétaire (protégé)</p>' : `<label class="muted" for="p-role">Rôle</label><select id="p-role" data-change="pRole"><option value="menage" ${rl === 'menage' ? 'selected' : ''}>Femme de ménage</option><option value="gerant" ${rl === 'gerant' ? 'selected' : ''}>Gérant / associé (tous les droits)</option></select>`}
      <div id="p-menage" ${rl === 'menage' ? '' : 'hidden'} class="col">
        <p class="muted">Hôtels habituels (les trois = polyvalente)</p>
        <div class="row">${HOTELS.map((h) => `<label class="chip c-plain"><input type="checkbox" id="p-h-${h.id}" ${hs.includes(h.id) ? 'checked' : ''} style="min-height:auto"> ${h.e} ${esc(h.name)}</label>`).join('')}</div>
        <div class="row"><label class="muted" for="p-hours">Heures par jour</label><input id="p-hours" type="number" min="1" max="12" step="0.5" value="${s ? s.hours || 6 : 6}" style="width:90px"></div></div>
      <div id="p-gerant" ${rl === 'gerant' ? '' : 'hidden'} class="col"><label class="muted" for="p-only">Limiter à un seul hôtel</label>
        <select id="p-only"><option value="">Non, tous les hôtels</option>${HOTELS.map((h) => `<option value="${h.id}" ${s && s.only_hotel === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></div>
      <button class="btn big pri" data-a="personSave" data-id="${s ? s.id : ''}">${s ? 'Enregistrer' : 'Créer'}</button></div>`);
}
function inviteSheet(id, res) {
  const s = staffById(id);
  if (!res) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    openSheet('invite', `<div class="row between"><h2>Lien pour ${esc(first(s.label))}</h2><button class="btn small" data-a="close">Fermer</button></div>
      <div class="card"><p>Choisis le code à 4 chiffres qu’elle tapera <b>une seule fois</b>, à l’installation. Tu le lui diras <b>de vive voix</b>.</p>
      <input id="inv-pin" inputmode="numeric" maxlength="4" value="${pin}" style="font-size:30px;text-align:center;letter-spacing:.3em">
      <p class="muted">Un nouveau lien annule l’ancien. ${s.role === 'menage' ? 'Son ancien téléphone sera déconnecté dès qu’elle installera le nouveau.' : ''}</p>
      <button class="btn big pri" data-a="inviteGo" data-id="${id}">Créer le lien</button></div>`);
    return;
  }
  const url = APP_URL + '#i=' + res.token;
  let qr = ''; try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) {}
  S.lastInvite = { id, url, token: res.token, pin: res.pin, qr };
  openSheet('invite', `<div class="row between"><h2>Lien pour ${esc(first(s.label))}</h2><button class="btn small" data-a="close">Fermer</button></div>
    <div class="card" style="align-items:center;text-align:center"><div class="qr">${qr}</div>
      <p>Elle scanne ce QR code avec l’appareil photo, ou ouvre le lien.</p>
      <p class="muted">Code d’invitation</p><div class="codebox">${fmtCode(res.token)}</div>
      <p class="muted">Code à 4 chiffres à lui dire de vive voix : <b style="font-size:22px">${esc(res.pin)}</b></p>
      <div class="row" style="justify-content:center">${navigator.share ? '<button class="btn pri" data-a="invShare">Partager le lien</button>' : ''}<button class="btn" data-a="invCopy">Copier le lien</button><button class="btn" data-a="invPrint">🖨️ Imprimer la fiche</button></div>
      <p class="muted">Le lien ne marche qu’une fois et expire dans 7 jours. Ne mets jamais le code à 4 chiffres dans le même message que le lien.</p></div>`);
}
function printFiche() {
  const L = S.lastInvite; if (!L) return; const s = staffById(L.id);
  $('print').innerHTML = `<div class="f"><h1>🧺 Ménage Hôtels : ${esc(s.label)}</h1>
    <div class="qr" style="text-align:center">${L.qr}</div>
    <p><b>1.</b> Ouvre l’appareil photo et vise le carré ci-dessus. Touche le lien qui apparaît.</p>
    <p><b>2.</b> Sur iPhone : bouton Partager ⬆️ puis « Sur l’écran d’accueil ». Sur Android : menu ⋮ puis « Installer l’application ».</p>
    <p><b>3.</b> Tape ton code à 4 chiffres (ton responsable te le dit) : ☐ ☐ ☐ ☐</p>
    <p><b>4.</b> Autorise le micro 🎤 et les notifications 🔔.</p>
    <p>Code d’invitation (si l’appli le demande) :</p><p class="code">${fmtCode(L.token)}</p>
    <p style="font-size:13px">Valable une seule fois, pendant 7 jours. Ne donne pas cette fiche à quelqu’un d’autre.</p></div>`;
  setTimeout(() => window.print(), 100);
}

/* ----- réglages ----- */
function listEditor(key, items, fmt) {
  return `<div class="list">${items.map((t, i) => `<div class="li"><span class="t">${fmt(t)}</span><button class="x" data-a="cfgDel" data-k="${key}" data-i="${i}" aria-label="Supprimer">✕</button></div>`).join('')}</div>
    <div class="row"><input id="add-${key.replace(/\./g, '-')}" placeholder="${key.startsWith('photos') ? 'Ex. : Placard' : 'Ex. : 🧼 Nettoyer la bouilloire'}" style="flex:1"><button class="btn small" data-a="cfgAdd" data-k="${key}">Ajouter</button></div>`;
}
function viewSettings() {
  const c = cfg(), rooms = roomsOf(S.hotel);
  const notif = pushSupported() && Notification.permission === 'granted';
  return `<div class="card"><h2>📱 Ce téléphone</h2>
      <div class="row"><button class="btn ${notif ? 'ok' : 'pri'}" data-a="pushOn">${notif ? '✓ Notifications activées' : '🔔 Activer les notifications'}</button><button class="btn" data-a="micTest">🎤 Tester le micro</button></div>
      ${!isStandalone() ? '<p class="muted">Astuce : installe l’appli sur l’écran d’accueil pour recevoir les notifications.</p>' : ''}
      <button class="btn ghost" data-a="logout">Se déconnecter de ce téléphone</button></div>
    <div class="card"><h2>⏱️ Temps prévus</h2><p class="muted">Servent à répartir le travail selon les heures de chacune.</p>
      <div class="row">${[['blanc', '🛏️ À blanc'], ['recouche', '🔄 Recouche'], ['fond', '⭐ Tâche de fond']].map(([k, l]) => `<label class="muted" for="min-${k}">${l}</label><input id="min-${k}" type="number" min="5" max="120" step="5" value="${c.minutes[k]}" style="width:80px"><span class="muted">min</span>`).join('')}</div>
      <button class="btn small" data-a="saveMinutes">Enregistrer les temps</button></div>
    <div class="card"><h2>🛏️ Routine chambre à blanc</h2>${listEditor('tasks.blanc', c.tasks.blanc, (t) => esc(t.e) + ' ' + esc(t.l))}</div>
    <div class="card"><h2>🔄 Routine recouche</h2>${listEditor('tasks.recouche', c.tasks.recouche, (t) => esc(t.e) + ' ' + esc(t.l))}</div>
    <div class="card"><h2>📷 Photos obligatoires</h2><p class="muted">À blanc</p>${listEditor('photos.blanc', c.photos.blanc, esc)}
      <p class="muted">Recouche</p>${listEditor('photos.recouche', c.photos.recouche, esc)}<p class="muted">Tâche de fond</p>${listEditor('photos.fond', c.photos.fond, esc)}</div>
    <div class="card"><h2>⭐ Tâches de fond</h2><p class="muted">La plus en retard s’ajoute à chaque chambre à blanc. Les autres remplissent le temps libre dans Répartir.</p>
      <div class="list">${c.periodic.map((p, i) => `<div class="li"><span class="t">${esc(p.e)} ${esc(p.l)} <span class="muted">· tous les ${p.days} jours</span></span><button class="x" data-a="cfgDel" data-k="periodic" data-i="${i}" aria-label="Supprimer">✕</button></div>`).join('')}</div>
      <div class="row"><input id="add-periodic" placeholder="Ex. : 🧼 Laver la bouilloire" style="flex:1"><input id="add-periodic-d" type="number" min="1" value="30" style="width:90px" aria-label="Tous les combien de jours"><span class="muted">jours</span><button class="btn small" data-a="addPeriodic">Ajouter</button></div></div>
    <div class="card"><h2>🚪 Chambres</h2>${hotelSeg()}
      <div class="list">${rooms.map((r) => `<div class="li"><span class="t"><b>${esc(r.num)}</b>${r.blocked ? ' <span class="muted">· bloquée : ' + esc(r.blockReason || '') + '</span>' : ''}</span><button class="x" data-a="delRoom" data-id="${r.id}" aria-label="Retirer la chambre ${esc(r.num)}">✕</button></div>`).join('')}</div>
      <div class="row"><input id="add-room" placeholder="Numéro, ex. : 26" style="flex:1"><button class="btn small" data-a="addRoom">Ajouter</button></div></div>
    <div class="card"><h2>🗂️ Photos et vocaux</h2><p class="muted">Effacés automatiquement après ${c.retentionDays || 30} jours (sauf les photos modèles des chambres).</p></div>`;
}

/* ----- écran ménage ----- */
function greet() { const h = new Date().getHours(); return h < 12 ? ['☀️', 'Bonjour'] : h < 18 ? ['🌤️', 'Bon après-midi'] : ['🌙', 'Bonsoir']; }
function viewCleanHome() {
  const me = S.me.id, mine = Object.values(S.rooms).filter((r) => r.assignee === me && !r.blocked);
  const todo = mine.filter((r) => r.status === 'a_faire' || r.status === 'en_cours').sort((a, b) => (a.status === 'en_cours' ? 0 : 1) - (b.status === 'en_cours' ? 0 : 1) || a.hotel.localeCompare(b.hotel) || a.order - b.order);
  const done = mine.filter((r) => r.status === 'a_controler' && r.doneAt && dayStr(r.doneAt) === dayStr(Date.now()));
  const total = todo.length + done.length, un = unreadTotal(), left = todo.reduce((s, r) => s + estimate(r), 0);
  const [ge, gt] = greet();
  const card = (r) => { const t = TY[r.type] || { e: '🧹', l: '' };
    return `<button class="job st-${r.status}" data-a="openClean" data-id="${r.id}"><span class="ph" style="background-image:${photoUrl(r.hotel)}" aria-hidden="true"></span><span class="num">${esc(r.num)}</span>
      <span class="txt"><b>${t.e} ${t.l}</b><span class="muted">${esc(hotelName(r.hotel))}${r.status === 'en_cours' ? ' · en cours' : ''}${r.status === 'a_controler' ? ' · terminée ' + hm(r.doneAt) : ''}</span>${r.rejectNote ? '<span class="chip c-red">🔁 À refaire</span>' : ''}</span></button>`; };
  return `<div class="wrap">
    ${S.preview ? `<button class="btn small" data-a="unpreview" style="align-self:flex-start">← Retour à l’écran gérant</button>` : ''}
    <div class="card"><div class="hero"><h1>${ge} ${gt} ${esc(first(S.me.label))}</h1><span class="day">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      ${total ? `<div class="row between"><b>${done.length} chambre${done.length > 1 ? 's' : ''} faite${done.length > 1 ? 's' : ''} sur ${total}</b>${left ? `<span class="muted">Encore environ ${mn(left)}</span>` : ''}</div><div class="prog"><i style="width:${Math.round(100 * done.length / total)}%"></i></div>` : ''}</div>
    ${todo.length ? `<div class="col">${todo.map(card).join('')}</div>` : `<div class="card empty"><div class="e">${total ? '🎉' : '☕'}</div><h2>${total ? 'Tout est fait, bravo !' : 'Pas de chambre pour l’instant'}</h2><p class="muted">${total ? 'Le responsable va contrôler.' : 'Tu seras prévenue quand on te donne des chambres.'}</p></div>`}
    ${done.length ? `<h2>Terminées aujourd’hui</h2><div class="col">${done.map(card).join('')}</div>` : ''}
    ${holdBtn('boss', 'Garde appuyé pour parler au responsable', 'big soft')}
    <button class="btn big" data-a="report">🔧 Signaler un problème</button>
  </div>
  <button class="bubble ${un ? 'ping' : ''}" data-a="convList" aria-label="Messages${un ? ', ' + un + ' nouveaux' : ''}">💬${un ? `<span class="badge">${un}</span>` : ''}</button>`;
}
const workOf = (id) => S.work[id] || (S.work[id] = { checks: {}, photos: {} });
function cleanItems(r) {
  const c = cfg(), items = [];
  if (r.type === 'fond') (r.fondTasks || []).forEach((t) => { const p = c.periodic.find((q) => q.id === t); if (p) items.push({ key: 'p:' + p.id, e: p.e, l: p.l, pid: p.id }); });
  else (c.tasks[r.type] || []).forEach((t, i) => items.push({ key: 't' + i, e: t.e, l: t.l }));
  (r.extras || []).forEach((t, i) => items.push({ key: 'x' + i, e: '📌', l: t, extra: 1 }));
  const d = dueTask(r); if (d) items.push({ key: 'p:' + d.id, e: '⭐', l: d.l + ' (tâche en plus)', extra: 1, pid: d.id });
  return items;
}
function viewCleanRoom() {
  const r = S.rooms[S.open];
  if (!r || r.assignee !== S.me.id) { S.open = null; return viewCleanHome(); }
  const t = TY[r.type] || { e: '🧹', l: '' }, w = workOf(r.id), items = cleanItems(r), shots = cfg().photos[r.type] || [];
  const nChk = items.filter((i) => w.checks[i.key]).length, nPh = shots.filter((l) => w.photos[l]).length, ready = nChk === items.length && nPh === shots.length;
  let main = '';
  if (r.status === 'a_faire') main = `<button class="btn big pri" data-a="start" data-id="${r.id}">▶ Je commence</button>`;
  else if (r.status === 'en_cours') {
    main = `<div class="row between"><h2>À faire</h2><span class="chip ${nChk === items.length ? 'c-green' : 'c-amber'}">${nChk} / ${items.length}</span></div>
      <div class="col">${items.map((i) => `<button class="chk ${w.checks[i.key] ? 'on' : ''} ${i.extra ? 'extra' : ''}" data-a="chk" data-k="${i.key}" aria-pressed="${!!w.checks[i.key]}"><span class="box">${w.checks[i.key] ? '✓' : ''}</span><span class="em" aria-hidden="true">${esc(i.e)}</span><span class="lb">${esc(i.l)}</span></button>`).join('')}</div>
      <div class="row between"><h2>Photos</h2><span class="chip ${nPh === shots.length ? 'c-green' : 'c-amber'}">${nPh} / ${shots.length}</span></div>
      <div class="shots">${shots.map((l) => { const p = w.photos[l], u = mediaUrl(p), busy = S.busy[l];
        return `<button class="shot ${p ? 'done' : ''}" data-a="shoot" data-l="${esc(l)}" aria-label="Photo ${esc(l)}">${p ? (u ? `<img alt="" src="${esc(u)}">` : '<span class="cam">✅</span>') + `<span class="lbl">✓ ${esc(l)}</span>` : `<span class="cam">${busy ? '⏳' : '📷'}</span><span>${esc(l)}</span>`}</button>`; }).join('')}</div>
      <button class="btn big ${ready ? 'pri' : ''}" data-a="finish" data-id="${r.id}">✓ Terminé</button>`;
  } else main = `<div class="banner c-green">✅ Terminée à ${hm(r.doneAt)}. Le responsable va contrôler.</div>${jobPhotos(r.lastJob)}`;
  const ref = mediaUrl(r.refPhoto);
  return `<div class="wrap"><button class="btn ghost" data-a="back" style="align-self:flex-start">← Mes chambres</button>
    <div class="banner-ph" style="background-image:${photoUrl(r.hotel)}"><span class="n">${esc(r.num)}</span><div><p>${esc(hotelName(r.hotel))}</p><h2>${t.e} ${t.l}</h2></div></div>
    ${r.rejectNote ? `<div class="banner c-red">🔁 À refaire : ${esc(r.rejectNote)}</div>` : ''}
    ${ref ? `<div class="card"><h3>👀 Le modèle : fais pareil</h3><img class="big-img" alt="" src="${esc(ref)}"></div>` : ''}
    ${main}
    ${holdBtn('room:' + r.id, 'Garde appuyé : message sur cette chambre', 'big soft')}
    <button class="btn big" data-a="report" data-room="${r.id}">🔧 Signaler un problème</button></div>`;
}

/* ---------- feuilles ---------- */
function openSheet(kind, html, cls) { S.sheet = kind; const s = $('sheet'); s.innerHTML = `<div class="panel ${cls || ''}" role="dialog" aria-modal="true">${html}</div>`; s.hidden = false; }
function closeSheet() { S.sheet = null; S.rep = null; const s = $('sheet'); s.hidden = true; s.innerHTML = ''; if (S.dirty) softRender(); }
function refreshSheet() {
  if (!S.sheet) return;
  if (S.sheet.startsWith('room:')) roomSheet(S.sheet.slice(5));
  else if (S.sheet.startsWith('thread:')) threadSheet(S.sheet.slice(7));
  else if (S.sheet === 'convs') convListSheet();
}
const sheetHead = (t) => `<div class="row between"><h2>${t}</h2><button class="btn small" data-a="close">Fermer</button></div>`;
function roomSheet(id) {
  const r = S.rooms[id]; if (!r) { closeSheet(); return; }
  const st = ST[r.status] || ST.propre, j = r.lastJob, c = cfg(), ref = mediaUrl(r.refPhoto);
  openSheet('room:' + id, `<div class="banner-ph" style="background-image:${photoUrl(r.hotel)};min-height:110px"><span class="n">${esc(r.num)}</span><div><p>${esc(hotelName(r.hotel))}</p></div></div>
    ${sheetHead('Chambre ' + esc(r.num))}
    <div class="chips"><span class="chip c-${st.c}">${st.l}</span>${r.type && TY[r.type] && r.status !== 'propre' ? `<span class="chip c-plain">${TY[r.type].e} ${TY[r.type].l}</span>` : ''}${r.status !== 'propre' ? `<span class="chip c-plain">👤 ${r.assignee ? esc(nameOf(r.assignee)) : 'à répartir'}</span>` : ''}</div>
    ${r.blocked ? `<div class="banner c-amber">⛔ Bloquée : ${esc(r.blockReason || 'sans raison')}</div><button class="btn" data-a="unblockOne" data-id="${r.id}">🔓 Débloquer</button>` : `<button class="btn" data-a="blockOne" data-id="${r.id}">⛔ Bloquer cette chambre</button>`}
    ${r.rejectNote && r.status !== 'propre' ? `<div class="banner c-red">🔁 À refaire : ${esc(r.rejectNote)}</div>` : ''}
    ${j ? `<div class="card"><h3>Dernier ménage</h3><p class="muted">${esc(nameOf(j.uid))} · ${when(j.start)} → ${hm(j.end)} · ${dur((j.end || 0) - (j.start || 0))}</p>${jobPhotos(j)}
      ${r.status === 'a_controler' ? `<div class="row"><button class="btn ok" data-a="validate" data-id="${r.id}">✓ Valider</button><button class="btn bad" data-a="redo" data-id="${r.id}">🔁 À refaire</button></div>` : ''}</div>` : ''}
    <div class="card"><h3>👀 Photo modèle</h3><p class="muted">La femme de ménage la voit avant de commencer.</p>${ref ? `<img class="big-img" alt="" src="${esc(ref)}">` : ''}
      <button class="btn soft" data-a="refPhoto" data-id="${r.id}">📷 ${r.refPhoto ? 'Changer' : 'Ajouter'} la photo modèle</button></div>
    <div class="card"><h3>📌 Tâches en plus pour cette chambre</h3>
      <div class="list">${(r.extras || []).map((t, i) => `<div class="li"><span class="t">${esc(t)}</span><button class="x" data-a="delExtra" data-id="${r.id}" data-i="${i}" aria-label="Supprimer">✕</button></div>`).join('') || '<p class="muted">Aucune.</p>'}</div>
      <div class="row"><input id="extra-in" placeholder="Ex. : surveiller l’humidité de la fenêtre" style="flex:1"><button class="btn small" data-a="addExtra" data-id="${r.id}">Ajouter</button></div></div>
    <div class="card"><h3>⭐ Tâches de fond</h3><div class="list">${c.periodic.map((p) => { const d = (r.periodicDone || {})[p.id], late = !d || Date.now() - d > p.days * 864e5;
      return `<div class="li"><span class="t">${esc(p.e)} ${esc(p.l)}</span><span class="chip ${late ? 'c-amber' : 'c-green'}">${d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'jamais'}</span></div>`; }).join('')}</div></div>`);
}
function blockSheet(ids) {
  S.rep = { blockIds: ids };
  openSheet('block', `${sheetHead('Bloquer')}<p>Chambre${ids.length > 1 ? 's' : ''} ${ids.map((i) => esc(S.rooms[i].num)).join(', ')} : on ne la donne plus à faire et elle ne doit pas être louée.</p>
    <div class="kinds">${REASONS.map(([r, e]) => `<button data-a="blockGo" data-r="${esc(r)}"><span class="e">${e}</span>${esc(r)}</button>`).join('')}</div>
    <div class="row"><input id="block-other" placeholder="Autre raison" style="flex:1"><button class="btn" data-a="blockGo">Bloquer</button></div>`);
}
function drawRedo() {
  const r = S.rooms[S.rep.redo];
  openSheet('redo', `${sheetHead('À refaire · ch. ' + esc(r.num))}<p class="muted">Ce qui ne va pas :</p>
    <div class="chips">${REDO.map((x) => `<button class="chip ${S.rep.chips.has(x) ? 'c-red' : 'c-plain'}" data-a="redoChip" data-r="${esc(x)}" aria-pressed="${S.rep.chips.has(x)}">${esc(x)}</button>`).join('')}</div>
    <textarea id="redo-text" placeholder="Précision (facultatif)" data-input="redoText">${esc(S.rep.text || '')}</textarea>
    <button class="btn big bad" data-a="redoGo">🔁 Renvoyer à ${esc(first(nameOf((r.lastJob && r.lastJob.uid) || r.assignee)))}</button>`);
}
function myHotels() { if (isMgr()) return S.me.only_hotel ? [S.me.only_hotel] : HOTELS.map((h) => h.id); return (S.me.hotels && S.me.hotels.length) ? S.me.hotels : HOTELS.map((h) => h.id); }
function reportSheet(roomId) {
  const r = roomId && S.rooms[roomId];
  S.rep = { hotel: r ? r.hotel : (isMgr() && !S.preview ? S.hotel : myHotels()[0]), room: r ? r.num : '', fixedRoom: !!r, order: [], items: {}, busy: null };
  drawReport(true);
}
function drawReport(scrollTop) {
  const p = S.rep; if (!p) return; const rooms = roomsOf(p.hotel), panel = document.querySelector('#sheet .panel'), top = panel ? panel.scrollTop : 0;
  const item = (k) => { const K = KINDS.find((x) => x.k === k), it = p.items[k], b = p.busy === k;
    return `<div class="item"><div class="hd"><span class="e" aria-hidden="true">${K.e}</span><b>${esc(K.l)}</b><button class="x" data-a="repKind" data-k="${k}" aria-label="Enlever ${esc(K.l)}">✕</button></div>
      <div class="media3"><button class="btn ${it.photo ? 'ok' : ''}" data-a="repMedia" data-k="${k}" data-m="photo"><span class="e">${it.photo ? '✅' : '📷'}</span>Photo</button>
        <button class="btn ${it.video ? 'ok' : ''}" data-a="repMedia" data-k="${k}" data-m="video"><span class="e">${it.video ? '✅' : '🎥'}</span>Vidéo</button>
        <button class="btn hold ${it.audio ? 'ok' : ''}" data-hold="issue:${k}"><span class="e">${it.audio ? '✅' : '🎤'}</span>${it.audio ? 'Vocal ✓' : 'Garder appuyé'}</button></div>
      ${b ? '<p class="muted">⏳ Envoi en cours…</p>' : ''}
      <textarea placeholder="Écrire (facultatif)" data-input="repText" data-k="${k}">${esc(it.text || '')}</textarea>
      <button class="toggle" data-a="repUrg" data-k="${k}" aria-pressed="${!!it.urgent}" style="align-self:flex-start">${it.urgent ? '🚨 Urgent' : 'Pas urgent'}</button></div>`; };
  openSheet('report', `${sheetHead('Signaler')}<p class="muted">Où ?</p>
    ${p.fixedRoom ? `<p><b>${H(p.hotel).e} ${esc(hotelName(p.hotel))} · chambre ${esc(p.room)}</b></p>` : `<div class="row">
      <select id="rep-hotel" data-change="repHotel" aria-label="Hôtel">${myHotels().map((h) => `<option value="${h}" ${p.hotel === h ? 'selected' : ''}>${H(h).e} ${esc(hotelName(h))}</option>`).join('')}</select>
      <select id="rep-room" data-change="repRoom" aria-label="Chambre"><option value="">Couloir, autre endroit</option>${rooms.map((x) => `<option value="${esc(x.num)}" ${p.room === x.num ? 'selected' : ''}>Chambre ${esc(x.num)}</option>`).join('')}</select></div>`}
    <p class="muted">Touche tous les problèmes vus (plusieurs possibles)</p>
    <div class="kinds">${KINDS.map((k) => `<button data-a="repKind" data-k="${k.k}" aria-pressed="${!!p.items[k.k]}"><span class="e">${k.e}</span>${esc(k.l)}</button>`).join('')}</div>
    ${p.order.length ? `<h2>${p.order.length} problème${p.order.length > 1 ? 's' : ''}</h2><p class="muted">Pour chacun : photo, vidéo, ou garde le doigt sur 🎤 pour parler. Écrire n’est pas obligatoire.</p>${p.order.map(item).join('')}` : ''}
    <button class="btn big pri" data-a="repSend">${p.order.length > 1 ? `Envoyer les ${p.order.length} problèmes` : 'Envoyer'}</button>`);
  const np = document.querySelector('#sheet .panel'); if (np && !scrollTop) np.scrollTop = top;
}

/* ---------- actions ---------- */
const roomsPatch = (ids, patch) => api('rooms_patch', { ids, patch: toPatch(patch) });
async function saveCfg(next) { await act(() => api('config_set', { data: next }), 'Enregistré'); }
const A = {
  reload() { location.reload(); },
  codeGo() { const v = ($('codeIn').value || '').toUpperCase().replace(/[^0-9A-Z]/g, ''); if (v.length !== 8) { toast('Le code fait 8 lettres et chiffres.'); return; } S.act = { code: v, info: null, checked: false, pin: '' }; render(); },
  codeReset() { S.act = { code: null, info: null, checked: true, pin: '' }; history.replaceState(null, '', location.pathname); render(); },
  pinKey(d) { const A_ = S.act; if (A_.busy || A_.pin.length >= 4) return; A_.pin += d.k; A_.err = null; render(); if (A_.pin.length === 4) { A_.busy = true; pinSubmit().finally(() => { if (S.act) S.act.busy = false; }); } },
  pinDel() { S.act.pin = S.act.pin.slice(0, -1); render(); },
  async install() { if (!S.installEvt) return; S.installEvt.prompt(); try { await S.installEvt.userChoice; } catch (e) {} S.installEvt = null; onboardSheet(); },
  async micTest() { await testMic(); if (S.sheet === 'onboard') onboardSheet(); else render(); },
  async pushOn() { await enablePush(false); if (S.sheet === 'onboard') onboardSheet(); else render(); },
  async logout(d, el) {
    if (!S.confirmLogout) { S.confirmLogout = true; toast('Touche encore une fois pour te déconnecter. Il faudra un nouveau lien pour revenir.'); setTimeout(() => S.confirmLogout = false, 5000); return; }
    try { await api('logout'); } catch (e) {}
    S.secret = null; LS.del('mh-secret'); S.loaded = false; S.act = null; render();
  },
  tab(d) { S.tab = d.k; S.sel.clear(); S.proposal = d.k === 'plan' ? S.proposal : null; render(); window.scrollTo(0, 0); },
  hotel(d) { S.hotel = d.k; S.sel.clear(); document.body.dataset.hotel = d.k; LS.set('mh-hotel', d.k); render(); },
  pick(d) { S.sel.has(d.id) ? S.sel.delete(d.id) : S.sel.add(d.id); render(); },
  clearSel() { S.sel.clear(); render(); },
  async assign(d) {
    if (!S.assignTo) { toast('Choisis d’abord pour qui, ou « À répartir plus tard ».'); return; }
    const who = S.assignTo === '__none' ? null : S.assignTo, ids = [...S.sel].filter((i) => !S.rooms[i].blocked), skipped = S.sel.size - ids.length;
    if (await act(() => roomsPatch(ids, { type: d.t, status: 'a_faire', assignee: who, rejectNote: null, startedAt: null, fondTasks: null }),
      `${ids.length} chambre${ids.length > 1 ? 's' : ''} ${TY[d.t].l.toLowerCase()} ${who ? 'pour ' + first(nameOf(who)) : 'à répartir'}${skipped ? ` · ${skipped} bloquée(s) ignorée(s)` : ''}`)) { S.sel.clear(); S.assignTo = ''; render(); }
  },
  async markClean() { const ids = [...S.sel]; if (await act(() => roomsPatch(ids, { status: 'propre', assignee: null, rejectNote: null }), 'Marquées prêtes')) { S.sel.clear(); render(); } },
  blockSel() { blockSheet([...S.sel]); },
  async unblockSel() { const ids = [...S.sel]; if (await act(() => roomsPatch(ids, { blocked: false, blockReason: null }), 'Débloquées')) { S.sel.clear(); render(); } },
  blockOne(d) { blockSheet([d.id]); },
  async unblockOne(d) { await act(() => roomsPatch([d.id], { blocked: false, blockReason: null }), 'Débloquée'); },
  async blockGo(d) {
    const reason = d.r || ($('block-other') && $('block-other').value.trim()); if (!reason) { toast('Choisis une raison.'); return; }
    const ids = S.rep.blockIds;
    if (await act(() => roomsPatch(ids, { blocked: true, blockReason: reason, status: 'propre', assignee: null }), 'Bloquée' + (ids.length > 1 ? 's' : ''))) { S.sel.clear(); closeSheet(); render(); }
  },
  roomSheet(d) { roomSheet(d.id); },
  async validate(d) { if (await act(() => roomsPatch([d.id], { status: 'propre', assignee: null, rejectNote: null }), 'Validée ✓') && S.sheet && S.sheet.startsWith('room:')) closeSheet(); },
  redo(d) { S.rep = { redo: d.id, chips: new Set(), text: '' }; drawRedo(); },
  redoChip(d) { S.rep.chips.has(d.r) ? S.rep.chips.delete(d.r) : S.rep.chips.add(d.r); drawRedo(); },
  async redoGo() {
    const id = S.rep.redo, r = S.rooms[id], note = [...S.rep.chips, (S.rep.text || '').trim()].filter(Boolean).join(' · ') || 'Voir avec le responsable';
    const who = (r.lastJob && r.lastJob.uid) || r.assignee;
    if (await act(() => roomsPatch([id], { status: 'a_faire', assignee: who, rejectNote: note, startedAt: null }), 'Renvoyée à ' + first(nameOf(who)))) closeSheet();
  },
  zoom(d) { const u = mediaUrl(d.id); openSheet('zoom', `${sheetHead(esc(d.l || 'Photo'))}${u ? `<img class="big-img" alt="" src="${esc(u)}">` : '<p>Photo effacée.</p>'}`); },
  async refPhoto(d) { toast('Ouvre l’appareil photo…'); const p = await takePhoto(null, false); if (p) await act(() => roomsPatch([d.id], { refPhoto: p }), 'Photo modèle enregistrée'); },
  async addExtra(d) { const v = $('extra-in').value.trim(); if (!v) return; const r = S.rooms[d.id]; await act(() => roomsPatch([d.id], { extras: [...(r.extras || []), v] }), 'Ajoutée'); },
  async delExtra(d) { const r = S.rooms[d.id]; await act(() => roomsPatch([d.id], { extras: (r.extras || []).filter((_, i) => i !== +d.i) })); },
  /* répartition */
  async avail(d) { const av = { ...(S.plan.avail || {}) }, s = staffById(d.id); av[d.id] = (av[d.id] || 0) > 0 ? 0 : (s.hours || 6); S.proposal = null; S.plan.avail = av; render(); await act(() => api('plan_set', { avail: av })); },
  withFond() { S.withFond = !S.withFond; if (S.proposal) propose(); render(); },
  rebalance() { S.rebalance = !S.rebalance; if (S.proposal) propose(); render(); },
  propose() { propose(); render(); },
  planCancel() { S.proposal = null; render(); },
  async planGo(d, el) {
    const P = S.proposal; if (!P) return;
    const assign = {}; Object.entries(P.assign).forEach(([k, v]) => { if (v) assign[k] = v; });
    const unassign = P.left.filter((id) => S.rooms[id] && S.rooms[id].assignee);
    if (el) el.classList.add('busy');
    if (await act(() => api('plan_apply', { assign, fond: P.fond, unassign }), 'Répartition envoyée. Chacune est prévenue sur son téléphone.')) { S.proposal = null; render(); }
    else if (el) el.classList.remove('busy');
  },
  /* problèmes */
  issueFilter(d) { S.issueFilter = d.k; render(); },
  async issueStatus(d) { await act(() => api('issue_status', { id: d.id, status: d.s }), d.s === 'regle' ? 'Marqué réglé' : null); },
  /* messages */
  threadOpen(d) { threadSheet(d.id); },
  newMsg() { newMsgSheet(); },
  convList() { convListSheet(); },
  async sendText(d) {
    const t = ($('msgText').value || '').trim(); if (!t) { toast('Écris d’abord le message, ou garde le doigt sur 🎤.'); return; }
    $('msgText').value = '';
    await act(() => api('msg_send', { text: t, conv: d.ctx }), 'Envoyé ✓');
  },
  /* équipe */
  personNew() { personSheet(null); },
  personEdit(d) { personSheet(d.id); },
  async personSave(d) {
    const label = $('p-label').value.trim(); if (!label) { toast('Écris un prénom.'); return; }
    const roleSel = $('p-role'), r = roleSel ? roleSel.value : 'owner';
    const body = { id: d.id || undefined, label, role: r };
    if (r === 'menage') { body.hotels = HOTELS.filter((h) => $('p-h-' + h.id).checked).map((h) => h.id); if (!body.hotels.length) { toast('Coche au moins un hôtel.'); return; } body.hours = parseFloat($('p-hours').value) || 6; }
    else { body.hotels = HOTELS.map((h) => h.id); body.only_hotel = $('p-only') ? $('p-only').value || null : null; }
    let newId = null;
    const ok = await act(async () => { const res = await api('staff_save', body); newId = res.id; }, d.id ? 'Enregistré' : label + ' est ajoutée');
    if (ok) { if (!d.id && newId) inviteSheet(newId); else closeSheet(); }
  },
  async personActive(d) {
    if (d.v === '0' && S.confirmOff !== d.id) { S.confirmOff = d.id; toast('Touche encore « Désactiver » pour confirmer : son téléphone sera déconnecté.'); setTimeout(() => S.confirmOff = null, 5000); return; }
    await act(() => api('staff_active', { id: d.id, active: d.v === '1' }), d.v === '1' ? 'Réactivée' : 'Désactivée et déconnectée');
  },
  async personDelete(d) {
    const s = staffById(d.id);
    if (S.confirmDelP !== d.id) { S.confirmDelP = d.id; toast(`Touche encore « Supprimer » pour effacer ${first(s.label)} et ses conversations privées. C’est définitif.`, 6000); setTimeout(() => S.confirmDelP = null, 6000); return; }
    S.confirmDelP = null;
    await act(() => api('staff_delete', { id: d.id }), first(s.label) + ' est supprimée');
  },
  inviteNew(d) { inviteSheet(d.id); },
  async inviteGo(d) {
    const pin = ($('inv-pin').value || '').trim(); if (!/^\d{4}$/.test(pin)) { toast('Le code doit faire 4 chiffres.'); return; }
    try { const res = await api('invite_create', { staff_id: d.id, pin }); inviteSheet(d.id, { token: res.token, pin }); refresh(true); }
    catch (e) { toast(errMsg(e)); }
  },
  async invShare() { const L = S.lastInvite; try { await navigator.share({ title: 'Ménage Hôtels', text: 'Ton lien pour installer l’appli ménage :', url: L.url }); } catch (e) {} },
  async invCopy() { const L = S.lastInvite; try { await navigator.clipboard.writeText(L.url); toast('Lien copié'); } catch (e) { prompt('Copie ce lien :', L.url); } },
  invPrint() { printFiche(); },
  async devRevoke(d) {
    if (S.confirmDev !== d.id) { S.confirmDev = d.id; toast('Touche encore « Déconnecter » pour confirmer.'); setTimeout(() => S.confirmDev = null, 5000); return; }
    await act(() => api('device_revoke', { id: d.id }), 'Téléphone déconnecté');
  },
  async stats() { try { const r = await api('stats'); S.stats = r.jobs || []; render(); } catch (e) { toast(errMsg(e)); } },
  /* réglages */
  async saveMinutes() { const c = JSON.parse(JSON.stringify(cfg())); ['blanc', 'recouche', 'fond'].forEach((k) => { const v = parseInt($('min-' + k).value, 10); if (v > 0) c.minutes[k] = v; }); await saveCfg(c); },
  async cfgAdd(d) {
    const v = ($('add-' + d.k.replace(/\./g, '-')).value || '').trim(); if (!v) return;
    const c = JSON.parse(JSON.stringify(cfg())), [a, b] = d.k.split('.');
    if (a === 'tasks') { const m = v.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u); c.tasks[b].push(m ? { e: m[1], l: m[2] || v } : { e: '✔️', l: v }); } else c.photos[b].push(v);
    await saveCfg(c);
  },
  async cfgDel(d) { const c = JSON.parse(JSON.stringify(cfg())); if (d.k === 'periodic') c.periodic.splice(+d.i, 1); else { const [a, b] = d.k.split('.'); c[a][b].splice(+d.i, 1); } await saveCfg(c); },
  async addPeriodic() {
    const v = ($('add-periodic').value || '').trim(), days = Math.max(1, parseInt($('add-periodic-d').value, 10) || 30); if (!v) return;
    const c = JSON.parse(JSON.stringify(cfg())), m = v.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
    c.periodic.push({ id: 'p' + rid(), e: m ? m[1] : '⭐', l: m ? (m[2] || v) : v, days }); await saveCfg(c);
  },
  async addRoom() { const num = ($('add-room').value || '').trim(); if (!num) return; await act(() => api('room_create', { hotel: S.hotel, num }), 'Chambre ' + num + ' ajoutée'); },
  async delRoom(d) {
    const r = S.rooms[d.id];
    if (S.confirmDel !== d.id) { S.confirmDel = d.id; toast('Touche ✕ encore une fois pour retirer la chambre ' + r.num + '.'); setTimeout(() => S.confirmDel = null, 5000); return; }
    await act(() => api('room_delete', { id: d.id }), 'Chambre ' + r.num + ' retirée');
  },
  preview() { S.preview = true; S.open = null; render(); window.scrollTo(0, 0); },
  unpreview() { S.preview = false; S.open = null; render(); },
  /* ménage */
  openClean(d) { S.open = d.id; render(); window.scrollTo(0, 0); },
  back() { S.open = null; render(); window.scrollTo(0, 0); },
  async start(d) { await act(() => api('room_start', { id: d.id })); },
  chk(d) { const w = workOf(S.open); w.checks[d.k] = !w.checks[d.k]; saveWork(); render(); },
  async shoot(d) {
    const r = S.rooms[S.open], l = d.l; S.busy[l] = true; render();
    const label = `Ch. ${r.num} · ${hotelName(r.hotel)} · ${l} · ${first(S.me.label)} · ${new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    const p = await takePhoto(label, true);
    if (p) { workOf(r.id).photos[l] = p; saveWork(); }
    delete S.busy[l]; render();
  },
  async finish(d, el) {
    const r = S.rooms[d.id], w = workOf(d.id), items = cleanItems(r), shots = cfg().photos[r.type] || [];
    const miss = items.filter((i) => !w.checks[i.key]).length, missP = shots.filter((l) => !w.photos[l]);
    if (miss || missP.length) { toast((miss ? `Il reste ${miss} case${miss > 1 ? 's' : ''} à cocher. ` : '') + (missP.length ? `Photo manquante : ${missP.join(', ')}.` : '')); return; }
    const periodic = items.filter((i) => i.pid).map((i) => i.pid);
    if (el) el.classList.add('busy');
    try { await api('room_finish', { id: r.id, photos: shots.map((l) => ({ l, id: w.photos[l] })), periodic }); }
    catch (e) { if (el) el.classList.remove('busy'); toast(errMsg(e)); return; }
    delete S.work[r.id]; saveWork(); S.open = null; await refresh(true); window.scrollTo(0, 0);
    const left = Object.values(S.rooms).filter((x) => x.assignee === S.me.id && (x.status === 'a_faire' || x.status === 'en_cours')).length;
    openSheet('yay', `<div class="celebrate"><div class="e">${left ? '👏' : '🎉'}</div><h1>Bravo !</h1><p style="font-size:19px">Chambre ${esc(r.num)} terminée.</p>
      <p class="muted">${left ? `Encore ${left} chambre${left > 1 ? 's' : ''}.` : 'Tu as fini toutes tes chambres.'}</p></div><button class="btn big pri" data-a="close">${left ? 'Chambre suivante' : 'Fermer'}</button>`);
  },
  /* signalement */
  report(d) { reportSheet(d.room || null); },
  repKind(d) { const p = S.rep; if (p.items[d.k]) { delete p.items[d.k]; p.order = p.order.filter((k) => k !== d.k); } else { p.items[d.k] = { text: '', urgent: false }; p.order.push(d.k); } drawReport(); },
  repUrg(d) { const it = S.rep.items[d.k]; if (it) { it.urgent = !it.urgent; drawReport(); } },
  async repMedia(d) {
    const p = S.rep; if (!p || !p.items[d.k]) return; if (p.busy) { toast('Attends la fin de l’envoi.'); return; }
    p.busy = d.k; drawReport();
    let res = null;
    if (d.m === 'photo') { const K = KINDS.find((x) => x.k === d.k); res = await takePhoto(`${K.l} · ${hotelName(p.hotel)}${p.room ? ' ch. ' + p.room : ''} · ${new Date().toLocaleString('fr-FR')}`, false); }
    else res = await takeVideo();
    if (S.rep === p) { if (res && p.items[d.k]) p.items[d.k][d.m] = res; p.busy = null; drawReport(); }
  },
  async repSend(d, el) {
    const p = S.rep; if (!p.order.length) { toast('Touche d’abord le ou les problèmes.'); return; }
    if (p.busy) { toast('Attends la fin de l’envoi.'); return; }
    if (el) el.classList.add('busy');
    const items = p.order.map((k) => ({ kind: k, ...p.items[k] }));
    if (await act(() => api('issue_create', { hotel: p.hotel, room: p.room || null, items }), p.order.length > 1 ? `Merci, ${p.order.length} problèmes signalés` : 'Merci, c’est signalé')) closeSheet();
    else if (el) el.classList.remove('busy');
  },
  close() { closeSheet(); },
};
const C = {
  assignTo(el) { S.assignTo = el.value; },
  repHotel(el) { S.rep.hotel = el.value; S.rep.room = ''; drawReport(); },
  repRoom(el) { S.rep.room = el.value; },
  pRole(el) { $('p-menage').hidden = el.value !== 'menage'; $('p-gerant').hidden = el.value !== 'gerant'; },
  async hours(el) { const av = { ...(S.plan.avail || {}) }; av[el.dataset.id] = Math.max(0.5, Math.min(12, parseFloat(el.value) || 0)); S.plan.avail = av; S.proposal = null; await act(() => api('plan_set', { avail: av })); },
  mvRoom(el) { const id = el.dataset.id; S.proposal.left = S.proposal.left.filter((i) => i !== id); if (el.value) S.proposal.assign[id] = el.value; else { delete S.proposal.assign[id]; S.proposal.left.push(id); } render(); },
  mvFond(el) { const i = +el.dataset.i; if (el.value) S.proposal.fond[i].uid = el.value; else S.proposal.fond.splice(i, 1); render(); },
};
const I = {
  repText(el) { if (S.rep && S.rep.items && S.rep.items[el.dataset.k]) S.rep.items[el.dataset.k].text = el.value; },
  redoText(el) { if (S.rep) S.rep.text = el.value; },
};
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-hold]')) return;
  const t = e.target.closest('[data-a]'); if (!t) return;
  const fn = A[t.dataset.a]; if (fn) { e.preventDefault(); fn(t.dataset, t); }
});
$('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });
document.addEventListener('change', (e) => { const t = e.target.closest('[data-change]'); if (t && C[t.dataset.change]) C[t.dataset.change](t); });
document.addEventListener('input', (e) => { const t = e.target.closest('[data-input]'); if (t && I[t.dataset.input]) I[t.dataset.input](t); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sheet) closeSheet(); if (e.key === 'Enter' && e.target.id === 'codeIn') A.codeGo(); });
window.addEventListener('hashchange', () => { if (!S.secret) { S.act = null; render(); } });

function openConvWhenReady(conv) {
  const go = () => { if (S.loaded && S.me) { if (S.me.role === 'menage' || !S.preview) threadSheet(conv); } else setTimeout(go, 400); };
  refresh(true).then(go);
}
/* ---------- démarrage ---------- */
(async function boot() {
  const cm = location.hash.match(/[#&]c=([^&]+)/); const openC = cm ? decodeURIComponent(cm[1]) : null;
  if (S.secret && (readHashCode() || openC)) history.replaceState(null, '', location.pathname);
  render();
  if (S.secret) {
    await refresh(true);
    if (S.loaded && pushSupported() && Notification.permission === 'granted') enablePush(true);
    if (S.loaded && openC) threadSheet(openC);
  }
})();
