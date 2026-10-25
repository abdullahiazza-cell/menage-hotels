"use strict";
/* Ma Réception — application web installable.
   Toutes les données passent par la fonction « api » de Supabase ; ce fichier ne contient aucun secret. */

const API = 'https://htpygokjdstmmzquibmn.supabase.co/functions/v1/api';
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');
const HOTELS = [
  { id: 'arc', name: 'Archange', photo: 'img/archange.jpg', e: '👼' },
  { id: 'par', name: 'Hôtel de Paris', photo: 'img/paris.jpg', e: '🗼' },
  { id: 'cha', name: 'Châteaudun', photo: 'img/chateau.jpg', e: '🏰' },
];
const DEFAULT_CFG = {
  retentionDays: 30, minutes: { blanc: 30, recouche: 15, fond: 15, commun: 20 },
  tasks: { blanc: [], recouche: [], commun: [{ e: '🧹', l: 'Balayer et laver le sol' }, { e: '🪜', l: 'Escalier : marches et rampe' }, { e: '🪟', l: 'Vitres, portes et poignées' }, { e: '🗑️', l: 'Vider les poubelles' }, { e: '🕸️', l: 'Toiles d’araignée et plinthes' }] },
  photos: { blanc: ['Lit', 'Salle de bain', 'Chambre'], recouche: ['Lit'], fond: ['Après'], commun: ['Après'] }, periodic: [],
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
const TY = { blanc: { l: 'À blanc', e: '🛏️' }, recouche: { l: 'Recouche', e: '🔄' }, fond: { l: 'Tâche de fond', e: '⭐' }, commun: { l: 'Nettoyage', e: '🧽' } };
const FREQS = [[1, 'Tous les jours'], [2, 'Tous les 2 jours'], [3, 'Tous les 3 jours'], [7, 'Une fois par semaine'], [14, 'Toutes les 2 semaines'], [30, 'Une fois par mois']];
const REASONS = [['Personnel', '👷'], ['Nous-mêmes', '🏠'], ['Panne ou travaux', '🛠️'], ['Salle petit déjeuner', '☕']];
const REDO = ['Lit mal fait', 'Salle de bain sale', 'Poussière', 'Sol pas propre', 'Poubelle pleine', 'Produits manquants'];
const ROLE_L = { owner: 'Propriétaire', gerant: 'Gérant / associé', menage: 'Femme de ménage', bricoleur: 'Intendant' };

/* ---------- état ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const S = {
  secret: LS.get('mh-secret', null), loaded: false, data: null,
  me: null, cfg: DEFAULT_CFG, reg: { occ: [], pecs: [], inbox: [], log: [] }, rsub: 'chambres', rq: '', rSortis: false, rDone: false, rooms: {}, docUrls: {}, staff: [], devices: [], invites: [], plan: { avail: {} }, issues: [], msgs: [], reads: [], urls: {}, vapid: null,
  hotel: LS.get('mh-hotel', 'arc'), scope: LS.get('mh-scope', 'all'), tab: 'home', sub: 'rooms', sel: new Set(), assignTo: '', open: null, preview: false, rf: 'a_faire', cq: '', notes: [], contacts: [], sec: { checks: [], logs: [] }, sl: null, projects: [], tasks: [], mtOpen: LS.get('mh-mt', false), psub: 'projets', tf: 'mine', pFin: false, pDone: false,
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
// Les gérants peuvent passer en vue « ménage » ou « intendant » (S.preview) : ce qu'ils y font est réel.
const role = () => !S.me ? null : (S.me.role === 'menage' ? 'menage' : (S.me.role === 'bricoleur' ? 'brico' : (S.preview === 'brico' ? 'brico' : (S.preview ? 'menage' : 'mgr'))));
const isMgr = () => S.me && (S.me.role === 'owner' || S.me.role === 'gerant');
const roomsOf = (h) => Object.values(S.rooms).filter((r) => r.hotel === h && r.kind !== 'commun').sort((a, b) => a.order - b.order);
const communsOf = (h) => Object.values(S.rooms).filter((r) => r.hotel === h && r.kind === 'commun').sort((a, b) => a.order - b.order);
const isCommun = (r) => !!r && r.kind === 'commun';
const placeName = (r) => isCommun(r) ? r.num : 'Chambre ' + r.num;
const placeShort = (r) => isCommun(r) ? r.num : 'Ch. ' + r.num;
const inScope = (r) => S.scope === 'all' || r.hotel === S.scope;
// Parties communes : jours de retard par rapport à la fréquence prévue (négatif = pas encore dû).
function lateDays(r) { if (!isCommun(r) || !r.freq) return -1; return Math.floor((Date.now() - (r.doneAt || 0)) / 864e5) - r.freq; }
const threadPeople = () => S.staff.filter((s) => (s.role === 'menage' || s.role === 'bricoleur') && s.active !== false);
const cleaners = () => S.staff.filter((s) => s.role === 'menage' && s.active !== false);
const habitual = (uid, h) => { const s = staffById(uid); return !s || !s.hotels || !s.hotels.length || s.hotels.includes(h); };
const mediaUrl = (p) => p ? (S.localUrls[p] || S.urls[p] || null) : null;

function normRoom(r) {
  return { id: r.id, hotel: r.hotel, num: r.num, order: r.ord, status: r.status, type: r.type, assignee: r.assignee, blocked: r.blocked, blockReason: r.block_reason,
    rejectNote: r.reject_note, startedAt: ts(r.started_at), doneAt: ts(r.done_at), doneBy: r.done_by, lastJob: r.last_job, periodicDone: r.periodic_done || {},
    extras: r.extras || [], fondTasks: r.fond_tasks, refPhoto: r.ref_photo, kind: r.kind || 'chambre', freq: r.freq_days || null };
}
const PATCH_KEYS = { freqDays: 'freq_days', type: 'type', status: 'status', assignee: 'assignee', blocked: 'blocked', blockReason: 'block_reason', rejectNote: 'reject_note', extras: 'extras', fondTasks: 'fond_tasks', refPhoto: 'ref_photo', startedAt: 'started_at' };
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
  if (r.type === 'commun') return m.commun;
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
  if (isMgr() && !S.preview) { set.add('mgrs'); threadPeople().forEach((c) => set.add('staff:' + c.id)); }
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
  reason: 'Indique la raison.', owner_only: 'Seul le propriétaire peut faire ça.', busy: 'Cette chambre est en cours de ménage.', still_active: 'Désactive d’abord cette personne.', pin_format: 'Le code doit faire 4 chiffres.', empty: 'Message vide.', no_one: 'Personne à prévenir.',
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
      S.reg = d.reg || { occ: [], pecs: [], inbox: [], log: [] };
      S.plan = d.plan || { avail: {} }; S.issues = d.issues || []; S.notes = d.notes || []; S.contacts = d.contacts || []; S.sec = d.sec || { checks: [], logs: [] }; S.projects = d.projects || []; S.tasks = d.tasks || []; S.msgs = (d.msgs || []).slice().reverse(); S.reads = d.reads || [];
      S.loaded = true;
      if (S.me.role === 'menage' || S.me.role === 'bricoleur') S.preview = false;
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
  if (isMgr() && (kind === 'boss' || kind === 'room')) { toast('Mode test : en vrai, ce vocal partirait aux responsables.'); return; }
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
  if (!S.loaded) { a.innerHTML = `<div class="wrap"><div class="empty"><div class="e">🛎️</div><h2>Chargement…</h2></div></div>`; return; }
  document.body.dataset.hotel = (S.open && S.rooms[S.open]) ? S.rooms[S.open].hotel : S.hotel;
  const rl = role(); document.body.classList.toggle('mgr', (rl === 'mgr' || rl === 'brico') && !(rl === 'brico' && S.open));
  a.innerHTML = rl === 'mgr' ? viewManager() : (S.open ? viewCleanRoom() : (rl === 'brico' ? viewBrico() : viewCleanHome()));
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
    return `<div class="wrap"><div class="empty"><div class="e">🛎️</div><h2>Un instant…</h2></div></div>`;
  }
  const head = `<div class="logo" style="justify-content:center"><img src="icons/icon-192.png" alt=""><h1>Ma Réception</h1></div>`;
  if (!A.code) {
    return `<div class="wrap" style="max-width:480px">${head}<div class="card"><h2>Installer l’appli</h2>
      <p>Tape le <b>code d’invitation</b> écrit sur ta fiche (8 lettres et chiffres).</p>
      <input id="codeIn" autocomplete="off" autocapitalize="characters" placeholder="Ex. : K7M2-Q9XD" style="font-size:24px;text-align:center;letter-spacing:.1em">
      <button class="btn big pri" data-a="codeGo">Continuer</button></div></div>`;
  }
  if (!A.info) return `<div class="wrap"><div class="empty"><div class="e">🛎️</div><h2>Un instant…</h2></div></div>`;
  if (!A.info.valid) {
    return `<div class="wrap" style="max-width:480px">${head}<div class="card empty"><div class="e">${A.info.net ? '📶' : '⛔'}</div>
      <h2>${A.info.net ? 'Pas de connexion' : 'Lien plus valable'}</h2><p>${A.info.net ? 'Vérifie internet puis réessaie.' : 'Ce lien a déjà servi ou a expiré. Demande un nouveau lien à ton responsable.'}</p>
      <button class="btn" data-a="${A.info.net ? 'reload' : 'codeReset'}">${A.info.net ? 'Réessayer' : 'J’ai un autre code'}</button></div></div>`;
  }
  if (isIOS() && !isStandalone()) {
    return `<div class="wrap" style="max-width:480px">${head}<div class="card"><h2>Bonjour ${esc(first(A.info.label))} 👋</h2>
      <p style="font-size:18px">D’abord, ajoute l’appli sur ton écran d’accueil :</p>
      <ol class="steps" style="font-size:18px"><li>Touche le bouton <b>Partager</b> <span style="font-size:22px">⬆️</span> en bas de l’écran.</li>
      <li>Touche <b>« Sur l’écran d’accueil »</b> ➕.</li><li>Touche <b>Ajouter</b>, puis ouvre l’icône <b>Ma Réception</b>.</li></ol>
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

/* ----- icônes (trait fin, style iOS) ----- */
const ICO = {
  menage: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 1.7 1.7.8-1.7.8L19 20l-.8-1.7-1.7-.8 1.7-.8z"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
};
const ico = (k, cls) => `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k] || ''}</svg>`;

/* ----- gérant : accueil à tuiles + écrans par thème ----- */
const SECTIONS = {
  menage: { t: 'Ménage', i: 'menage', c: 't-blue' }, issues: { t: 'Réparations', i: 'tool', c: 't-orange' },
  registre: { t: 'Registre', i: 'book', c: 't-purple' }, securite: { t: 'Sécurité', i: 'shield', c: 't-red' },
  msgs: { t: 'Messages', i: 'chat', c: 't-green' }, projets: { t: 'Projets', i: 'check', c: 't-teal' },
  team: { t: 'Équipe', i: 'users', c: 't-indigo' }, contacts: { t: 'Contacts', i: 'phone', c: 't-brown' }, settings: { t: 'Réglages', i: 'sliders', c: 't-gray' },
};
const scoped = (list) => list.filter(inScope);
function viewManager() {
  if (S.tab === 'home' || !SECTIONS[S.tab] || SECTIONS[S.tab].soon) return viewHome();
  const unread = unreadTotal();
  let body = '', right = '';
  if (S.tab === 'menage') { body = viewMenage(); }
  else if (S.tab === 'registre') { body = viewRegistre(); right = `<button class="nb-act" data-a="occNew" aria-label="Nouvelle arrivée">${ico('plus')}</button>`; }
  else if (S.tab === 'issues') { body = viewIssues(); right = `<button class="nb-act" data-a="repNew" aria-label="Nouvelle réparation">${ico('plus')}</button>`; }
  else if (S.tab === 'securite') { body = viewSecurite(); }
  else if (S.tab === 'projets') { body = viewProjets(); right = `<button class="nb-act" data-a="${S.psub === 'taches' ? 'taskNew' : 'projNew'}" aria-label="Ajouter">${ico('plus')}</button>`; }
  else if (S.tab === 'contacts') { body = viewContacts(); right = `<button class="nb-act" data-a="ctNew" aria-label="Nouveau contact">${ico('plus')}</button>`; }
  else if (S.tab === 'msgs') { body = viewThreads(); right = `<button class="nb-act" data-a="newMsg" aria-label="Nouveau message">${ico('plus')}</button>`; }
  else if (S.tab === 'team') { body = viewTeam(); right = `<button class="nb-act" data-a="personNew" aria-label="Ajouter une personne">${ico('plus')}</button>`; }
  else body = viewSettings();
  return `${navBar(SECTIONS[S.tab].t, right)}<div class="wrap">${body}</div>
    ${S.tab !== 'msgs' && !S.sel.size && unread ? `<button class="bubble ping" data-a="convList" aria-label="Messages, ${unread} non lus">💬<span class="badge">${unread}</span></button>` : ''}`;
}
const navBar = (title, right) => `<header class="navbar"><button class="nb-back" data-a="home">${ico('back')}<span>Accueil</span></button><h1 class="nb-title">${esc(title)}</h1><div class="nb-right">${right || ''}</div></header>`;
function homeCounts() {
  const rs = scoped(Object.values(S.rooms));
  const iss = scoped(S.issues);
  return {
    todo: rs.filter((r) => !r.blocked && (r.status === 'a_faire' || r.status === 'en_cours')).length,
    check: rs.filter((r) => r.status === 'a_controler').length,
    plan: rs.filter((r) => r.status === 'a_faire' && !r.assignee && !r.blocked).length,
    late: rs.filter((r) => !r.blocked && r.status === 'propre' && lateDays(r) >= 0).length,
    newIss: iss.filter((i) => repEtat(i) === 'a_faire').length,
    urgent: iss.filter((i) => repEtat(i) !== 'fait' && i.priority === 'urgent').length,
    open: iss.filter((i) => repEtat(i) !== 'fait').length,
  };
}
function tile(k, sub, badge) {
  const T = SECTIONS[k];
  return `<button class="tile ${T.soon ? 'soon' : ''}" data-a="${T.soon ? 'soon' : 'go'}" data-k="${k}">
    <span class="ti-ic ${T.c}">${ico(T.i)}</span>${badge ? `<span class="badge">${badge}</span>` : ''}
    <span class="ti-t">${T.t}</span><span class="ti-s">${T.soon ? 'Bientôt · ' + T.soon : sub}</span></button>`;
}
function secTile() {
  const L = scoped(secChecks()).filter((c) => c.status !== 'na'), late = secLate(L).length, unk = L.filter((c) => secSt(c).k === 'unk').length;
  const comm = L.filter((c) => c.grp === 'commission' && c.next_due && daysTo(c.next_due) >= 0 && daysTo(c.next_due) <= 30).sort((a, b) => a.next_due.localeCompare(b.next_due))[0];
  return tile('securite', comm ? `Commission ${daysTo(comm.next_due) === 0 ? 'aujourd’hui' : 'le ' + fdate(comm.next_due).slice(0, 5)}` : (late ? `${late} en retard` : (unk ? `${unk} à renseigner` : 'Tout est à jour')), late);
}
function viewHome() {
  const c = homeCounts(), un = unreadTotal(), locked = S.staff.filter((s) => s.locked).length;
  const initials = String(S.me.label || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const [, gt] = greet();
  const scopes = [['all', 'Tous'], ...HOTELS.map((h) => [h.id, h.id === 'par' ? 'Paris' : h.name])];
  const stat = (n, l, cls, go) => `<button class="stat" data-a="go" data-k="${go[0]}" data-s="${go[1] || ''}"><b class="${n ? cls : ''}">${n}</b><span>${l}</span></button>`;
  return `<div class="wrap home">
    <div class="home-top"><div><p class="date">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${gt} ${esc(first(S.me.label))}</h1></div>
      <button class="avatar" data-a="go" data-k="settings" aria-label="Réglages">${esc(initials)}</button></div>
    <div class="segc" role="group" aria-label="Hôtel">${scopes.map(([k, l]) => `<button data-a="scope" data-k="${k}" aria-pressed="${S.scope === k}">${esc(l)}</button>`).join('')}</div>
    <div class="today"><p class="cap">Aujourd’hui</p><div class="stats">
      ${stat(c.todo, 'à nettoyer', 'n-blue', ['menage', 'rooms'])}${stat(c.check, 'à contrôler', 'n-green', ['menage', 'check'])}${stat(c.urgent, c.urgent > 1 ? 'urgences' : 'urgence', 'n-red', ['issues'])}</div></div>
    ${myTasksCard()}
    <div class="tiles">
      ${tile('menage', c.todo ? `${c.todo} à faire` : (c.late ? `${c.late} partie${c.late > 1 ? 's' : ''} commune${c.late > 1 ? 's' : ''} en retard` : 'Tout est propre'), c.check + c.plan)}
      ${tile('issues', c.open ? `${c.open} à faire ou en cours` : 'Rien à réparer', c.newIss)}
      ${tile('registre', finsCount() ? `<span class="ora">${finsCount()} fin${finsCount() > 1 ? 's' : ''} de PEC à suivre</span>` : `${presentOcc().filter(inScope).length} présents`, regBadge())}${secTile()}
      ${tile('msgs', un ? `${un} non lu${un > 1 ? 's' : ''}` : 'Tout est lu', un)}
      ${tile('projets', myTasks().length ? `${myTasks().length} tâche${myTasks().length > 1 ? 's' : ''} pour vous` : `${S.projects.filter((p) => p.statut !== 'termine').length} projets`, myTasks().filter((t) => tLate(t) || tToday(t)).length)}
      ${tile('team', `${S.staff.filter((s) => s.active !== false).length} personnes`, locked)}
      ${tile('contacts', `${S.contacts.length} contacts`)}
    </div>
    <div class="group views"><div class="prow ro"><span class="pr-t"><b>Voir comme</b><span class="muted">et faire à leur place si besoin</span></span></div>
      <button class="prow" data-a="preview" data-k="menage"><span class="pr-t"><b>🧹 Femme de ménage</b><span class="muted">${myCleanings().length ? myCleanings().length + ' nettoyage' + (myCleanings().length > 1 ? 's' : '') + ' pour vous' : 'Les nettoyages qui vous sont donnés'}</span></span><span class="chev">›</span></button>
      <button class="prow" data-a="preview" data-k="brico"><span class="pr-t"><b>🔧 Intendant</b><span class="muted">Réparations, prendre un nettoyage</span></span><span class="chev">›</span></button></div></div>`;
}

/* ----- registre des occupants (gérants seulement) ----- */
const CATS = ['MNA', 'Mineur ASE', 'Jeune majeur', 'Adulte (PARI)', 'Conventionnel', 'Autre'];
const FINANCEURS = ['Conseil départemental', 'Association', 'Autre'];
const REPAS = ['Non', 'Petit déjeuner seul', 'Oui'];
const OLD_REG = 'https://claude.ai/code/artifact/d68a9a35-8b67-47f5-b68e-731d3a154178';
const todayISO = () => dayStr(Date.now());
const addDaysISO = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return dayStr(d.getTime()); };
const fdate = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';
const presentOcc = () => S.reg.occ.filter((o) => o.statut !== 'sorti');
// Accès au registre : gérants toujours ; intendant selon ce que le propriétaire lui a donné.
const canReg = (p) => !!S.me && (isMgr() || (S.me.role === 'bricoleur' && (S.me.perms || []).some((x) => x === p || (p === 'reg_pec' && x === 'reg_full'))));
const PERM_L = [['reg_pec', 'Répartir les prises en charge reçues', 'Voir qui dort où, loger ou rattacher les PEC reçues, les écarter'], ['reg_full', 'Gérer tout le registre', 'En plus : fiches, arrivées, départs, prises en charge'], ['contacts', 'Voir les prestataires', 'Électricité, alarme, travaux, contrôle : numéros et notes']];
// Prestataires : l'intendant les voit seulement si le propriétaire lui a ouvert l'accès (vue intendant d'un gérant = mêmes droits que l'intendant).
const PRESTA = ['Électricité', 'Alarme / SSI', 'Travaux', 'Contrôle & sécurité'];
const bricoPerms = () => S.me.role === 'bricoleur' ? (S.me.perms || []) : ((S.staff.find((s) => s.role === 'bricoleur' && s.active !== false) || {}).perms || []);
const canPresta = () => role() === 'mgr' || (role() === 'brico' && bricoPerms().includes('contacts'));
const occById = (id) => S.reg.occ.find((o) => o.id === id);
const occOfRoom = (rid) => presentOcc().filter((o) => o.room_id === rid);
const occName = (o) => o ? ([o.prenom, o.nom].filter(Boolean).join(' ') || 'Sans nom') : 'Personne supprimée';
const pecsOf = (id) => S.reg.pecs.filter((p) => p.occupant_id === id);
function pecState(o) {
  const t = todayISO(), list = pecsOf(o.id);
  const act = list.filter((p) => (!p.debut || p.debut <= t) && (!p.fin || p.fin >= t));
  if (act.length) return act.every((p) => p.fin && p.fin <= addDaysISO(t, 7)) ? { c: 'amber', t: 'PEC expire bientôt' } : { c: 'green', t: 'PEC en cours' };
  if (o.categorie === 'Conventionnel') return { c: 'plain', t: 'Sans PEC' };
  return list.length ? { c: 'red', t: 'PEC expirée' } : { c: 'red', t: 'PEC manquante' };
}
const inboxTodo = () => S.reg.inbox.filter((i) => i.status === 'a_traiter');
const regBadge = () => scoped(inboxTodo()).length + scoped(presentOcc()).filter((o) => pecState(o).c === 'red').length;
// Restauration : repas seuls, toujours facturés sur l'Hôtel de Paris.
const isResto = (o) => o.formule === 'restauration';
const occPlace = (o) => { if (isResto(o)) return 'restauration'; const r = o.room_id && S.rooms[o.room_id]; return r ? placeShort(r) : 'sans chambre'; };
// Fins de PEC : orange à moins d'une semaine, rouge une fois dépassée ; un brouillon de relance est préparé dans Gmail.
const lastPec = (o) => pecsOf(o.id).filter((p) => p.fin).sort((a, b) => String(b.fin).localeCompare(String(a.fin)))[0] || null;
// Une PEC reçue en attente ne compte comme renouvellement que si elle va au-delà de la PEC en cours.
const pendingRenew = (o) => { const cur = lastPec(o); return inboxTodo().find((i) => String(i.nom || '').trim().toUpperCase() === String(o.nom || '').trim().toUpperCase() && (!i.prenom || !o.prenom || first(i.prenom).toLowerCase() === first(o.prenom).toLowerCase()) && (!i.fin || !cur || i.fin > cur.fin)); };
const relanceOf = (p, stage) => (S.reg.relances || []).filter((r) => r.pec_id === p.id && (!stage || r.stage === stage)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
function finsList() {
  const t = todayISO(), lim = addDaysISO(t, 7);
  return presentOcc().filter((o) => o.categorie !== 'Conventionnel').map((o) => { const p = lastPec(o); return p && p.fin <= lim ? { o, p, late: p.fin < t, n: daysTo(p.fin) } : null; }).filter(Boolean)
    .sort((a, b) => String(a.p.fin).localeCompare(String(b.p.fin)));
}
function relanceTxt(f) {
  const ren = pendingRenew(f.o); if (ren) return { c: 'green', t: '📨 Renouvellement reçu le ' + fdate(ren.received_at) + ' : à appliquer dans « À traiter »' };
  const r = relanceOf(f.p, f.late ? 'expiree' : 'bientot');
  if (r && r.status === 'brouillon') return { c: 'accent', t: `✉️ Brouillon de relance prêt dans Gmail depuis le ${fdate(r.created_at)}${r.to_email ? ' · pour ' + r.to_email : ''}` };
  if (r && r.status === 'introuvable') return { c: 'amber', t: '⚠️ Pas de mail du référent trouvé : relance à faire à la main' };
  return { c: 'slate', t: '✉️ Brouillon de relance préparé automatiquement au prochain passage (chaque matin à 8 h)' };
}
function regFins() {
  const L = scoped(finsList().map((f) => ({ ...f, hotel: f.o.hotel })));
  const row = (f) => { const rt = relanceTxt(f);
    return `<button class="prow" data-a="occOpen" data-id="${f.o.id}"><span class="pr-t"><b>${esc(occName(f.o))}</b><span class="muted sm">${esc(hotelName(f.o.hotel))} · ${esc(occPlace(f.o))} · ${esc(f.p.financeur || '')}${f.p.reference ? ' · réf. ' + esc(f.p.reference) : ''}</span><span class="sm rel-${rt.c}">${esc(rt.t)}</span></span>
      <span class="pill p-${f.late ? 'red' : 'amber'}">${f.late ? `Finie le ${fdate(f.p.fin).slice(0, 5)}` : (f.n === 0 ? 'Finit aujourd’hui' : `Finit le ${fdate(f.p.fin).slice(0, 5)}`)}</span></button>`; };
  const late = L.filter((f) => f.late), soon = L.filter((f) => !f.late);
  return `${scopeSeg(finsList().map((f) => ({ hotel: f.o.hotel })))}
    <p class="muted sm">Chaque matin, un brouillon de relance au référent est préparé dans la boîte Gmail « Hôtel de Paris ADM » : une semaine avant la fin, puis le lendemain si rien n’est arrivé. Il n’est jamais envoyé tout seul : vous le relisez et l’envoyez.</p>
    ${late.length ? `<h2 class="sec">🔴 PEC dépassées · ${late.length}</h2><div class="group">${late.map(row).join('')}</div>` : ''}
    ${soon.length ? `<h2 class="sec">🟠 Finissent dans moins d’une semaine · ${soon.length}</h2><div class="group">${soon.map(row).join('')}</div>` : ''}
    ${L.length ? '' : '<div class="card empty"><div class="e">✅</div><h3>Aucune PEC ne finit cette semaine</h3></div>'}`;
}
const finsCount = () => scoped(finsList().map((f) => ({ ...f, hotel: f.o.hotel }))).length;
function viewRegistre() {
  const todo = inboxTodo().length;
  const subs = [['chambres', 'Chambres', 0], ['personnes', 'Personnes', 0], ['atraiter', 'À traiter', todo], ['fins', 'Fins PEC', finsCount()], ...(canReg('reg_full') ? [['journal', 'Journal', 0]] : [])];
  const body = { chambres: regRooms, personnes: regPeople, atraiter: regInbox, fins: regFins, journal: regJournal }[S.rsub] || regRooms;
  return `<div class="segc" role="group" aria-label="Registre">${subs.map(([k, l, n]) => `<button data-a="rsub" data-k="${k}" aria-pressed="${S.rsub === k}">${l}${n ? ` <span class="badge sm">${n}</span>` : ''}</button>`).join('')}</div>${body()}`;
}
function occLine(o) { const ps = pecState(o); return `<span class="ol"><span>${esc(occName(o))}${o.categorie ? ` <span class="muted">· ${esc(o.categorie)}</span>` : ''}</span><span class="pill p-${ps.c}">${ps.t}</span></span>`; }
function regRooms() {
  const rooms = roomsOf(S.hotel), occ = presentOcc().filter((o) => o.hotel === S.hotel);
  const free = rooms.filter((r) => !occOfRoom(r.id).length && !r.blocked).length;
  const resto = occ.filter(isResto), none = occ.filter((o) => !isResto(o) && (!o.room_id || !S.rooms[o.room_id]));
  const lite = (o) => `<button class="prow" data-a="occOpen" data-id="${o.id}"><span class="pr-t">${occLine(o)}${o.notes ? `<span class="muted">${esc(o.notes)}</span>` : ''}</span></button>`;
  const row = (r) => { const os = occOfRoom(r.id);
    return `<button class="prow" data-a="regRoom" data-id="${r.id}"><span class="pr-t"><b>${esc(placeName(r))}</b>${os.length ? os.map(occLine).join('') : (r.blocked ? `<span class="muted">⛔ ${esc(r.blockReason || '')}</span>` : '')}</span>${os.length ? '' : `<span class="pill ${r.blocked ? 'p-plain' : 'p-slate'}">${r.blocked ? 'Bloquée' : 'Libre'}</span>`}</button>`; };
  return `${hotelSeg()}<div class="chips"><span class="chip c-accent">Présents <b>${occ.length}</b></span><span class="chip c-slate">Chambres libres <b>${free}</b></span>${S.hotel === 'par' ? `<span class="chip c-amber">Restauration <b>${resto.length}</b></span>` : ''}</div>
    <div class="group">${rooms.map(row).join('')}</div>
    ${S.hotel === 'par' ? `<h2 class="sec">Restauration</h2><p class="muted">Repas seuls, sans chambre. Facturés sur l’Hôtel de Paris.</p>${resto.length ? `<div class="group">${resto.map(lite).join('')}</div>` : '<p class="muted">Personne pour l’instant.</p>'}` : ''}
    ${none.length ? `<h2 class="sec">Sans chambre</h2><p class="muted">À replacer dans une chambre.</p><div class="group">${none.map(lite).join('')}</div>` : ''}`;
}
// Filtre d'hôtel visible (le même que celui de l'accueil), avec le nombre par hôtel.
function scopeSeg(list) {
  const n = (k) => k === 'all' ? list.length : list.filter((x) => x.hotel === k).length;
  return `<div class="segc" role="group" aria-label="Hôtel">${[['all', 'Tous'], ...HOTELS.map((h) => [h.id, h.id === 'par' ? 'Paris' : h.name])].map(([k, l]) => `<button data-a="scope" data-k="${k}" aria-pressed="${S.scope === k}">${esc(l)} <span class="cnt">${n(k)}</span></button>`).join('')}</div>`;
}
function regPeople() {
  const q = S.rq.trim().toLowerCase();
  let list = (S.rSortis ? S.reg.occ : presentOcc()).filter(inScope);
  if (q) list = list.filter((o) => (occName(o) + ' ' + (o.categorie || '')).toLowerCase().includes(q));
  list.sort((a, b) => (a.statut === 'sorti') - (b.statut === 'sorti') || String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
  return `${scopeSeg(S.rSortis ? S.reg.occ : presentOcc())}<input id="regQ" type="search" placeholder="Chercher un nom" value="${esc(S.rq)}" data-input="regQ" style="width:100%">
    <div class="row between"><span class="muted">${list.length} personne${list.length > 1 ? 's' : ''}</span><button class="toggle" data-a="rSortis" aria-pressed="${S.rSortis}">${S.rSortis ? '✓ ' : ''}Afficher les départs</button></div>
    <div class="group">${list.map((o) => `<button class="prow" data-a="occOpen" data-id="${o.id}"><span class="pr-t">${occLine(o)}<span class="muted">${esc(hotelName(o.hotel))} · ${esc(occPlace(o))}${o.statut === 'sorti' ? ' · parti le ' + fdate(o.sortie) : ' · depuis le ' + fdate(o.entree)}</span></span></button>`).join('') || '<p class="muted" style="padding:14px">Personne.</p>'}</div>`;
}
// PDF des prises en charge : gardés dans Ma Réception (ou dans le Drive pour ceux relevés automatiquement).
const docLink = (d) => S.docUrls[d.id] ? `<a class="doc" href="${S.docUrls[d.id]}" target="_blank" rel="noopener" download="${esc(d.name || 'document.pdf')}">📄 ${esc(d.name || 'Document')} · Ouvrir</a>`
  : `<button class="doc" data-a="docOpen" data-id="${esc(d.id)}" data-n="${esc(d.name || 'document.pdf')}">📄 ${esc(d.name || 'Document')}</button>`;
const docsHtml = (docs, drive) => ((docs || []).length || drive) ? `<div class="docs">${(docs || []).map(docLink).join('')}${drive ? `<a class="doc" href="https://drive.google.com/file/d/${encodeURIComponent(drive.id)}/view" target="_blank" rel="noopener">📄 ${esc(drive.name || 'PDF dans le Drive')}</a>` : ''}</div>` : '';
function pecInCard(i) {
  return `<div class="card"><div class="row between"><h3>${esc([i.nom, i.prenom].filter(Boolean).join(' '))}</h3><span class="pill p-plain">${esc(i.categorie || '')}</span></div>
    <p class="muted">${esc(i.expediteur || '')} · reçu le ${fdate(i.received_at)} · ${esc(hotelName(i.hotel || ''))}</p>
    ${i.resume ? `<p>${esc(i.resume)}</p>` : ''}${i.alerte ? `<div class="banner c-amber">${esc(i.alerte)}</div>` : ''}${docsHtml(i.docs, i.drive_file_id ? { id: i.drive_file_id, name: i.drive_file_name } : null)}
    ${i.status === 'a_traiter' ? `<div class="row"><button class="btn small pri" data-a="inApply" data-id="${i.id}">Loger ou rattacher</button><button class="btn small" data-a="inDiscard" data-id="${i.id}">Écarter</button></div>`
      : `<p class="muted">${i.status === 'ecarte' ? 'Écarté' : 'Traité'}${i.note ? ' : ' + esc(i.note) : ''}${i.treated_at ? ' · ' + fdate(i.treated_at) : ''}</p><button class="btn small ghost" data-a="inReopen" data-id="${i.id}" style="align-self:flex-start">Rouvrir</button>`}</div>`;
}
function regInbox() {
  const todo = scoped(inboxTodo()), done = scoped(S.reg.inbox.filter((i) => i.status !== 'a_traiter'));
  return `${scopeSeg(inboxTodo())}${todo.length ? `<p class="muted">Prises en charge reçues, pas encore rattachées à une personne du registre.</p><div class="col">${todo.map(pecInCard).join('')}</div>` : '<div class="card empty"><div class="e">✅</div><h3>Rien à traiter</h3></div>'}
    ${done.length ? `<button class="btn ghost" data-a="rDone">${S.rDone ? 'Masquer' : 'Voir'} les ${done.length} déjà traitées</button>${S.rDone ? `<div class="col">${done.map(pecInCard).join('')}</div>` : ''}` : ''}`;
}
function regJournal() {
  return `<p class="muted">Qui a fait quoi, quand et pourquoi.</p><div class="group">${S.reg.log.map((l) => `<div class="prow ro"><span class="pr-t"><b>${esc(l.action || '')}</b><span>${esc(l.cible || '')}</span><span class="muted">${esc(l.by_label || '?')} · ${when(l.ts)}${l.raison ? ' · « ' + esc(l.raison) + ' »' : ''}${l.details ? ' · ' + esc(l.details) : ''}</span></span></div>`).join('') || '<p class="muted" style="padding:14px">Vide.</p>'}</div>`;
}
const opt = (v, cur, l) => `<option value="${esc(v)}" ${String(cur ?? '') === String(v) ? 'selected' : ''}>${esc(l ?? v)}</option>`;
const roomOpts = (hotel, cur) => `${opt('resto', cur, 'Restauration (repas seuls)')}${opt('', cur, 'Sans chambre (à replacer)')}${roomsOf(hotel).map((r) => opt(r.id, cur, placeName(r) + (occOfRoom(r.id).filter((o) => o.room_id !== cur).length ? ' · occupée' : ''))).join('')}`;
function occSheet(id, preset) {
  const o = id ? occById(id) : { hotel: (preset && preset.hotel) || S.hotel, room_id: (preset && preset.room_id) || '', entree: todayISO(), categorie: '' };
  const hs = HOTELS.map((h) => opt(h.id, o.hotel, h.name)).join('');
  const pecs = id ? pecsOf(id) : [], ro = !canReg('reg_full');
  openSheet('occ:' + (id || ''), `${sheetHead(id ? esc(occName(o)) : 'Nouvelle arrivée')}
    ${id && o.statut === 'sorti' ? `<div class="banner c-amber">Parti le ${fdate(o.sortie)}</div>` : ''}
    ${id && o.statut !== 'sorti' ? (() => { const f = finsList().find((x) => x.o.id === id); if (!f) return ''; const rt = relanceTxt(f); return `<div class="banner c-${f.late ? 'red' : 'amber'}">${f.late ? `PEC finie le ${fdate(f.p.fin)}` : `PEC finit le ${fdate(f.p.fin)}`}<br><span class="sm">${esc(rt.t)}</span></div>`; })() : ''}
    <fieldset class="card form" ${ro ? 'disabled' : ''}>
      <div class="two"><label>Prénom<input id="o-prenom" value="${esc(o.prenom || '')}"></label><label>Nom<input id="o-nom" value="${esc(o.nom || '')}"></label></div>
      <div class="two"><label>Naissance<input id="o-naissance" type="date" value="${esc(o.naissance || '')}"></label><label>Catégorie<select id="o-cat"><option value="">—</option>${CATS.map((c) => opt(c, o.categorie)).join('')}</select></label></div>
      <div class="two"><label>Hôtel<select id="o-hotel" data-change="oHotel">${hs}</select></label><label>Chambre<select id="o-room">${roomOpts(o.hotel, isResto(o) ? 'resto' : (o.room_id || ''))}</select></label></div>
      <div class="two"><label>Arrivée<input id="o-entree" type="date" value="${esc(o.entree || '')}"></label><label>Téléphone<input id="o-tel" inputmode="tel" value="${esc(o.telephone || '')}"></label></div>
      <label>Notes<textarea id="o-notes">${esc(o.notes || '')}</textarea></label>
      ${ro ? '' : `<label>Pourquoi ce changement ?${id ? ' (facultatif)' : ''}<input id="o-raison" placeholder="${id ? 'Ex. : correction du prénom' : 'Ex. : arrivée envoyée par l’ASE'}"></label>
      <button class="btn pri" data-a="occSave" data-id="${id || ''}">${id ? 'Enregistrer' : 'Ajouter au registre'}</button>`}</fieldset>
    ${id ? `<div class="card"><div class="row between"><h3>Prises en charge</h3>${ro ? '' : `<button class="btn small soft" data-a="pecNew" data-id="${id}">＋ Ajouter</button>`}</div>
      ${pecs.length ? `<div class="group">${pecs.map((p) => { const t = todayISO(), on = (!p.debut || p.debut <= t) && (!p.fin || p.fin >= t);
        return `<button class="prow" data-a="pecOpen" data-id="${p.id}"><span class="pr-t"><b>${esc(p.financeur || 'Financeur ?')}${p.reference ? ' · réf. ' + esc(p.reference) : ''}</b><span class="muted">${fdate(p.debut)} → ${fdate(p.fin)}${p.tarif ? ' · ' + esc(p.tarif) + ' €' : ''}${p.repas ? ' · repas : ' + esc(p.repas) : ''}</span></span><span class="pill ${on ? 'p-green' : 'p-plain'}">${on ? 'En cours' : (p.fin && p.fin < t ? 'Terminée' : 'À venir')}</span></button>`; }).join('')}</div>` : '<p class="muted">Aucune pour l’instant.</p>'}</div>
      ${ro ? '' : (o.statut === 'sorti' ? `<button class="btn" data-a="occReturn" data-id="${id}">Annuler le départ</button>` : `<button class="btn bad" data-a="occExit" data-id="${id}">Départ</button>`)}` : ''}`);
}
function pecSheet(occId, pecId) {
  const p = pecId ? S.reg.pecs.find((x) => x.id === pecId) : { financeur: FINANCEURS[0], debut: todayISO(), repas: 'Non' };
  const o = occById(occId || p.occupant_id), ro = !canReg('reg_full');
  openSheet('pec', `${sheetHead(pecId ? 'Prise en charge' : 'Nouvelle prise en charge')}<p class="muted">${esc(occName(o))}</p>
    <fieldset class="card form" ${ro ? 'disabled' : ''}>
      <div class="two"><label>Financeur<select id="p-fin">${FINANCEURS.map((f) => opt(f, p.financeur)).join('')}</select></label><label>Référence<input id="p-ref" value="${esc(p.reference || '')}"></label></div>
      <div class="two"><label>Début<input id="p-debut" type="date" value="${esc(p.debut || '')}"></label><label>Fin<input id="p-finD" type="date" value="${esc(p.fin || '')}"></label></div>
      <div class="two"><label>Tarif par nuit (€)<input id="p-tarif" inputmode="decimal" value="${esc(p.tarif || '')}"></label><label>Repas<select id="p-repas">${REPAS.map((r) => opt(r, p.repas)).join('')}</select></label></div>
      <label>Notes<textarea id="p-notes">${esc(p.notes || '')}</textarea></label>${docsHtml(p.docs)}
      ${ro ? '' : `<label>Pourquoi ?<input id="p-raison" placeholder="Ex. : renouvellement reçu par mail"></label>
      <button class="btn pri" data-a="pecSave" data-occ="${o.id}" data-id="${pecId || ''}">Enregistrer</button>
      ${pecId ? `<button class="btn ghost" data-a="pecDel" data-id="${pecId}" data-occ="${o.id}">Supprimer cette prise en charge</button>` : ''}`}</fieldset>
    <button class="btn ghost" data-a="occOpen" data-id="${o.id}">← Retour à la fiche</button>`);
}
function exitSheet(id) {
  const o = occById(id), r = o.room_id && S.rooms[o.room_id], others = o.room_id ? occOfRoom(o.room_id).filter((x) => x.id !== id).length : 0;
  openSheet('exit', `${sheetHead('Départ')}<p><b>${esc(occName(o))}</b> · ${esc(hotelName(o.hotel))} · ${esc(occPlace(o))}</p>
    <div class="card form"><label>Date de départ<input id="x-date" type="date" value="${todayISO()}"></label>
      <label>Raison (obligatoire)<input id="x-raison" placeholder="Ex. : fin de prise en charge, orienté ailleurs"></label>
      ${r && !others ? `<label class="check"><input type="checkbox" id="x-clean" checked> Mettre la chambre ${esc(r.num)} à blanc, à répartir au ménage</label>` : ''}
      <button class="btn bad" data-a="exitGo" data-id="${id}">Confirmer le départ</button></div>`);
}
function applySheet(inId) {
  const it = S.reg.inbox.find((x) => x.id === inId); if (!it) return;
  const key = String(it.nom || '').toLowerCase().split(/\s+/)[0];
  const cands = presentOcc().slice().sort((a, b) => (String(b.nom || '').toLowerCase().includes(key)) - (String(a.nom || '').toLowerCase().includes(key)) || String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
  const h = it.hotel || S.hotel;
  openSheet('apply', `${sheetHead('Loger ou rattacher')}<p><b>${esc([it.nom, it.prenom].filter(Boolean).join(' '))}</b> · ${esc(it.categorie || '')}</p><p class="muted">${esc(it.resume || '')}</p>
    <div class="card form"><h3>Rattacher à une personne déjà au registre</h3>
      <select id="a-occ"><option value="">— Choisir —</option>${cands.map((o) => opt(o.id, '', `${occName(o)} · ${hotelName(o.hotel)} · ${occPlace(o)}`)).join('')}</select>
      <button class="btn" data-a="applyGo" data-id="${inId}" data-m="exist">Rattacher la prise en charge</button></div>
    <div class="card form"><h3>Ou créer une nouvelle personne</h3>
      <div class="two"><label>Hôtel<select id="a-hotel" data-change="aHotel">${HOTELS.map((x) => opt(x.id, h, x.name)).join('')}</select></label><label>Chambre<select id="a-room">${roomOpts(h, (it.kind === 'repas' || it.prestation === 'Repas') ? 'resto' : '')}</select></label></div>
      <label>Arrivée<input id="a-entree" type="date" value="${esc(it.debut || todayISO())}"></label>
      <button class="btn pri" data-a="applyGo" data-id="${inId}" data-m="new">Créer et loger</button></div>`);
}
function discardSheet(inId) {
  openSheet('discard', `${sheetHead('Écarter')}<p class="muted">La prise en charge reste visible dans « déjà traitées ».</p>
    <div class="card form"><label>Pourquoi ?<input id="d-note" placeholder="Ex. : parti, doublon, erreur du Département"></label><button class="btn bad" data-a="discardGo" data-id="${inId}">Écarter</button></div>`);
}

/* ----- ménage (gérant) : plan, répartir, contrôler ----- */
function viewMenage() {
  const rs = Object.values(S.rooms);
  const toPlan = rs.filter((x) => x.status === 'a_faire' && !x.assignee && !x.blocked).length, toCheck = rs.filter((x) => x.status === 'a_controler').length;
  const subs = [['rooms', 'Plan', 0], ['plan', 'Répartir', toPlan], ['check', 'Contrôler', toCheck]];
  const body = S.sub === 'plan' ? viewPlan() : (S.sub === 'check' ? viewCheck() : viewRooms());
  return `<div class="segc" role="group" aria-label="Ménage">${subs.map(([k, l, n]) => `<button data-a="sub" data-k="${k}" aria-pressed="${S.sub === k}">${l}${n ? ` <span class="badge sm">${n}</span>` : ''}</button>`).join('')}</div>${body}`;
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
const hotelSeg = () => `<div class="segc" role="group" aria-label="Hôtel">${HOTELS.map((h) => `<button data-a="hotel" data-k="${h.id}" aria-pressed="${S.hotel === h.id}">${esc(h.id === 'par' ? 'Paris' : h.name)}</button>`).join('')}</div>`;
function plate(r) {
  const st = ST[r.status] || ST.propre, sel = S.sel.has(r.id);
  const s = r.blocked ? '⛔ Bloquée' : (r.status !== 'propre' && TY[r.type] ? `${TY[r.type].e} ${st.l}` : st.l);
  const who = r.blocked ? esc(r.blockReason || '') : (r.status !== 'propre' ? (r.assignee ? esc(first(nameOf(r.assignee))) : (r.status === 'a_faire' ? 'à répartir' : '&nbsp;')) : (occOfRoom(r.id).length ? '● occupée' : '&nbsp;'));
  return `<button class="plate st-${r.status} ${r.blocked ? 'blocked' : ''} ${sel ? 'sel' : ''}" data-a="pick" data-id="${r.id}" aria-pressed="${sel}" aria-label="Chambre ${esc(r.num)}">
    ${sel ? '<span class="tick">✓</span>' : ''}<span class="n ${String(r.num).length > 4 ? 'long' : ''}">${esc(r.num)}</span><span class="s">${s}</span><span class="who">${who}</span></button>`;
}
function viewRooms() {
  const list = roomsOf(S.hotel), com = communsOf(S.hotel), all = [...list, ...com];
  const blocked = all.filter((r) => r.blocked).length, cnt = (k) => all.filter((r) => !r.blocked && r.status === k).length;
  const late = com.filter((r) => !r.blocked && r.status === 'propre' && lateDays(r) >= 0);
  return `${hotelSeg()}
    <div class="chips"><span class="chip c-red">À faire <b>${cnt('a_faire')}</b></span><span class="chip c-amber">En cours <b>${cnt('en_cours')}</b></span>
      <span class="chip c-green">À contrôler <b>${cnt('a_controler')}</b></span><span class="chip c-slate">Prêts <b>${cnt('propre')}</b></span>${blocked ? `<span class="chip c-plain">⛔ Bloqués <b>${blocked}</b></span>` : ''}</div>
    <h2 class="sec">Chambres</h2>
    ${list.length ? `<div class="grid">${list.map(plate).join('')}</div>` : `<div class="card empty"><h3>Pas encore de chambres ici</h3><p class="muted">Ajoute-les dans Réglages.</p></div>`}
    <div class="row between sec"><h2>Parties communes</h2>${late.length ? `<button class="btn small soft" data-a="lateGo" data-ids="${late.map((r) => r.id).join(',')}">Ajouter les ${late.length} en retard</button>` : ''}</div>
    ${com.length ? `<div class="group">${com.map(placeRow).join('')}</div>` : `<div class="card empty"><h3>Pas encore de parties communes</h3><p class="muted">Ajoute-les dans Réglages.</p></div>`}
    <p class="muted hint">Touche un ou plusieurs lieux, puis choisis en bas pour qui.</p>
    ${S.sel.size ? actionBar() : ''}`;
}
// Ligne d'une partie commune (liste façon iOS).
function placeRow(r) {
  const st = ST[r.status] || ST.propre, sel = S.sel.has(r.id), ld = lateDays(r);
  const freq = (FREQS.find((f) => f[0] === r.freq) || [0, r.freq ? `tous les ${r.freq} jours` : 'fréquence libre'])[1];
  let sub = freq.charAt(0).toUpperCase() + freq.slice(1).toLowerCase();
  if (r.blocked) sub = '⛔ Bloqué : ' + esc(r.blockReason || '');
  else if (r.status !== 'propre') sub = (r.assignee ? esc(first(nameOf(r.assignee))) : 'à répartir');
  else if (r.doneAt) sub += ' · fait ' + when(r.doneAt) + (r.doneBy ? ' par ' + esc(first(nameOf(r.doneBy))) : '');
  else sub += ' · jamais fait';
  const pill = r.blocked ? '<span class="pill p-plain">Bloqué</span>' : (r.status !== 'propre' ? `<span class="pill p-${st.c}">${st.l}</span>` : (ld >= 0 ? `<span class="pill p-red">${ld ? 'En retard de ' + ld + ' j' : 'À faire aujourd’hui'}</span>` : '<span class="pill p-slate">Propre</span>'));
  return `<button class="prow ${sel ? 'sel' : ''}" data-a="pick" data-id="${r.id}" aria-pressed="${sel}"><span class="pr-t"><b>${esc(r.num)}</b><span class="muted">${sub}</span></span>${pill}${sel ? '<span class="tick">✓</span>' : ''}</button>`;
}
function actionBar() {
  const ids = [...S.sel], rooms = ids.map((i) => S.rooms[i]).filter(Boolean);
  const people = [...cleaners(), ...S.staff.filter((s) => s.active !== false && s.id !== S.me.id && (s.role === 'bricoleur' || isMgrRole(s.role)))].map((s) => s.id); people.push(S.me.id);
  const allBlocked = rooms.length && rooms.every((r) => r.blocked);
  const hasRoom = rooms.some((r) => !isCommun(r)), hasCom = rooms.some(isCommun);
  const opt = (id) => `<option value="${id}" ${S.assignTo === id ? 'selected' : ''}>${esc(id === S.me.id ? 'Moi' : nameOf(id) + (staffById(id) && staffById(id).role !== 'menage' ? ' (' + (ROLE_L[staffById(id).role] || '').toLowerCase() + ')' : ''))}${!habitual(id, S.hotel) ? ' (pas son hôtel habituel)' : ''}</option>`;
  return `<div class="bar"><div class="in">
    <div class="row between"><b>${ids.length} lieu${ids.length > 1 ? 'x' : ''} : ${rooms.map((r) => esc(isCommun(r) ? r.num : r.num)).join(', ')}</b><button class="btn small ghost" data-a="clearSel">Annuler</button></div>
    <div class="row"><label for="assignTo" class="muted">Pour</label><select id="assignTo" data-change="assignTo" style="flex:1"><option value="">Choisir…</option>
      <option value="__none" ${S.assignTo === '__none' ? 'selected' : ''}>🗓️ À répartir plus tard</option>${people.filter((id) => habitual(id, S.hotel)).map(opt).join('')}${people.filter((id) => !habitual(id, S.hotel)).map(opt).join('')}</select></div>
    <div class="row">${hasRoom ? '<button class="btn pri" data-a="assign" data-t="blanc">🛏️ À blanc</button><button class="btn pri" data-a="assign" data-t="recouche">🔄 Recouche</button>' : ''}${hasCom ? '<button class="btn pri" data-a="assign" data-t="commun">🧽 Nettoyer</button>' : ''}
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
      if (x.kind === 'room') return `<div class="li"><span class="t">${H(x.r.hotel).e} <b>${esc(placeShort(x.r))}</b> · ${TY[x.r.type].e} ${TY[x.r.type].l} · ${mn(estimate(x.r))}${exc}</span>${sel(u, `data-change="mvRoom" data-id="${x.r.id}"`)}</div>`;
      const labels = x.f.tasks.map((t) => { const q = cfg().periodic.find((z) => z.id === t); return q ? q.l : t; }).join(', ');
      return `<div class="li"><span class="t">${H(x.r.hotel).e} <b>Ch. ${esc(x.r.num)}</b> · ⭐ ${esc(labels)} · ${mn(m.fond * x.f.tasks.length)}${exc}</span>${sel(u, `data-change="mvFond" data-i="${x.i}"`)}</div>`;
    }).join('');
    return `<div class="card"><div class="row between"><h3>${esc(nameOf(u))}</h3><b>${mn(p.load)} / ${mn(p.cap)}</b></div>
      <div class="meter ${pct > 100 ? 'over' : (pct > 85 ? 'warn' : '')}"><i style="width:${Math.min(100, pct)}%"></i></div>${pct > 100 ? '<p class="banner c-red">Trop de travail pour ses heures.</p>' : ''}
      ${p.fixed.length ? `<p class="muted">Déjà en cours ou fixé : ${p.fixed.map((r) => esc(placeShort(r))).join(', ')}</p>` : ''}${rows ? `<div class="list">${rows}</div>` : '<p class="muted">Rien de nouveau.</p>'}</div>`;
  }).join('');
  const left = P.left.map((id) => S.rooms[id]).filter(Boolean);
  return `<h2>Proposition</h2><p class="muted">Tu peux déplacer une chambre vers une autre personne, même hors de ses hôtels habituels.</p>${cards}
    ${left.length ? `<div class="card"><h3>Pas assez de temps pour ${left.length} chambre${left.length > 1 ? 's' : ''}</h3><div class="list">${left.map((r) => `<div class="li"><span class="t">${H(r.hotel).e} <b>${esc(placeShort(r))}</b> · ${TY[r.type].l} · ${mn(estimate(r))}</span>${sel('', `data-change="mvRoom" data-id="${r.id}"`, 'Personne')}</div>`).join('')}</div></div>` : ''}
    <button class="btn big pri" data-a="planGo">✓ Valider et prévenir l’équipe</button><button class="btn ghost" data-a="planCancel">Annuler la proposition</button>`;
}

/* ----- contrôle ----- */
function jobPhotos(job) {
  if (!job || !job.photos || !job.photos.length) return '<p class="muted">Pas de photo.</p>';
  return `<div class="thumbs">${job.photos.map((p) => { const u = mediaUrl(p.id); return `<button data-a="zoom" data-id="${esc(p.id)}" data-l="${esc(p.l)}">${u ? `<img loading="lazy" alt="" src="${esc(u)}">` : '<div class="gone">Photo effacée</div>'}<span>${esc(p.l)}</span></button>`; }).join('')}</div>`;
}
function checkCard(r) {
  const j = r.lastJob || {};
  return `<div class="card"><div class="row between"><h3>${esc(placeShort(r))} · ${esc(hotelName(r.hotel))}</h3><span class="chip c-green">${j.type && TY[j.type] ? TY[j.type].e + ' ' + TY[j.type].l : ''}</span></div>
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
// Réparations : une seule liste pour les pannes signalées et les travaux (rapport Dekra, commission…).
const RST = { a_faire: { l: 'À faire', c: 'red' }, en_cours: { l: 'En cours', c: 'amber' }, piece: { l: 'Pièce à commander', c: 'accent' }, fait: { l: 'Fait', c: 'green' } };
const ORIG = { signalement: 'Signalement', dekra: 'Rapport Dekra', commission: 'Commission de sécurité', entretien: 'Entretien courant' };
const PRIO = { urgent: 'Urgent', normal: 'Normal', plus_tard: 'Quand possible' };
const repEtat = (i) => i.etat || (i.status === 'regle' ? 'fait' : 'a_faire');
const repKind = (i) => KINDS.find((x) => x.k === i.kind) || KINDS[KINDS.length - 1];
const repTitle = (i) => i.title || repKind(i).l;
const repWhere = (i) => `${hotelName(i.hotel)}${i.room ? ' · ' + (/^\d/.test(i.room) ? 'ch. ' + i.room : i.room) : ''}`;
const repNotes = (id) => S.notes.filter((n) => n.issue_id === id);
const repLate = (i) => i.due && repEtat(i) !== 'fait' && i.due < todayISO();
function repRow(i) {
  const e = repEtat(i), n = repNotes(i.id).length, ph = (i.done_photos || []).length;
  const sub = [repWhere(i), i.origin && i.origin !== 'signalement' ? ORIG[i.origin] : (i.by_staff ? 'signalé par ' + first(nameOf(i.by_staff)) : '')].filter(Boolean).join(' · ');
  const meta = e === 'fait' ? `fait ${i.done_at ? 'le ' + fdate(i.done_at) : ''}${i.done_by ? ' par ' + first(nameOf(i.done_by)) : ''}` : (i.due ? (repLate(i) ? '⏰ en retard, ' : 'avant le ') + fdate(i.due) : '');
  return `<button class="prow" data-a="repOpen" data-id="${i.id}"><span class="pr-t"><b>${i.priority === 'urgent' && e !== 'fait' ? '🚨 ' : ''}${esc(repTitle(i))}</b><span class="muted">${esc(sub)}</span>${meta || n || ph ? `<span class="muted sm">${esc(meta)}${ph ? ' · 📷 ' + ph : ''}${n ? ' · 💬 ' + n : ''}</span>` : ''}</span>
    ${e === 'piece' ? '<span class="pill p-accent">Pièce</span>' : (repLate(i) ? '<span class="pill p-red">En retard</span>' : '')}</button>`;
}
function viewIssues() {
  const all = scoped(S.issues), f = RST[S.rf] ? S.rf : 'a_faire';
  const n = (k) => all.filter((i) => repEtat(i) === k).length;
  const list = all.filter((i) => repEtat(i) === f).sort((a, b) => f === 'fait' ? String(b.done_at || '').localeCompare(String(a.done_at || ''))
    : ((b.priority === 'urgent') - (a.priority === 'urgent') || String(a.due || '9').localeCompare(String(b.due || '9')) || String(b.created_at).localeCompare(String(a.created_at))));
  return `${scopeSeg(S.issues.filter((i) => repEtat(i) !== 'fait'))}
    <div class="segc" role="group" aria-label="État">${Object.entries(RST).map(([k, v]) => `<button data-a="repFilter" data-k="${k}" aria-pressed="${f === k}">${k === 'piece' ? 'Pièce' : v.l}${k !== 'fait' && n(k) ? ` <span class="cnt">${n(k)}</span>` : ''}</button>`).join('')}</div>
    ${list.length ? `<div class="group">${list.map(repRow).join('')}</div>` : `<div class="card empty"><div class="e">${f === 'fait' ? '📋' : '✅'}</div><h3>${f === 'fait' ? 'Rien de terminé pour l’instant' : 'Rien ici'}</h3><p class="muted">Les pannes signalées par l’équipe arrivent dans « À faire » avec leur photo ou leur vocal.</p></div>`}
    ${canPresta() ? `<button class="btn ghost" data-a="go" data-k="contacts">📇 ${role() === 'mgr' ? 'Contacts et prestataires' : 'Prestataires'}</button>` : ''}`;
}
function repSheet(id) {
  const i = S.issues.find((x) => x.id === id); if (!i) return;
  const e = repEtat(i), notes = repNotes(id), k = repKind(i);
  const info = [['Où', repWhere(i)], ['Origine', ORIG[i.origin] || 'Signalement'], ['Priorité', PRIO[i.priority] || 'Normal'], i.due ? ['Date limite', fdate(i.due) + (repLate(i) ? ' · en retard' : '')] : null,
    i.parts ? ['Matériel', i.parts] : null, ['Créée', `${when(i.created_at)}${i.by_staff ? ' par ' + nameOf(i.by_staff) : ''}`], e === 'fait' && i.done_at ? ['Faite', `${fdate(i.done_at)}${i.done_by ? ' par ' + nameOf(i.done_by) : ''}`] : null].filter(Boolean);
  const done = (i.done_photos || []).map((p) => ({ id: p.id, l: p.l || 'Après' }));
  openSheet('rep:' + id, `${sheetHead(esc(repTitle(i)))}
    <div class="segc four" role="group" aria-label="État">${Object.entries(RST).map(([kk, v]) => `<button data-a="repEtat" data-id="${id}" data-k="${kk}" aria-pressed="${e === kk}">${kk === 'piece' ? 'Pièce' : v.l}</button>`).join('')}</div>
    ${e !== 'fait' ? `<button class="btn ok" data-a="repDone" data-id="${id}">📷 C’est fait : prendre la photo</button>` : ''}
    <div class="group">${info.map(([l, v]) => `<div class="prow ro"><span class="pr-t"><span class="muted sm">${l}</span><span>${esc(v)}</span></span></div>`).join('')}</div>
    ${i.details || i.text ? `<div class="card"><p class="pre">${esc(i.details || i.text)}</p></div>` : ''}
    ${i.photo || i.video || i.audio ? `<div class="card"><h3>${k.e} Signalement</h3>${mediaBlock(i.photo, 'photo')}${mediaBlock(i.video, 'video')}${mediaBlock(i.audio, 'audio')}</div>` : ''}
    <div class="card"><div class="row between"><h3>Photos du travail</h3><button class="btn small soft" data-a="repPhoto" data-id="${id}">＋ Photo</button></div>
      ${done.length ? `<div class="thumbs">${done.map((p) => `<button data-a="zoom" data-id="${esc(p.id)}" data-l="${esc(p.l)}"><img loading="lazy" alt="" src="${esc(mediaUrl(p.id) || '')}"></button>`).join('')}</div>` : '<p class="muted">Pas encore de photo.</p>'}</div>
    <div class="card"><h3>Échanges</h3>
      ${notes.length ? `<div class="notes">${notes.map((nn) => `<div class="note ${nn.by_staff === S.me.id ? 'me' : ''}"><span class="muted sm">${esc(nn.by_staff ? first(nameOf(nn.by_staff)) : 'Notion')} · ${when(nn.created_at)}</span>${nn.text ? `<p>${esc(nn.text)}</p>` : ''}${mediaBlock(nn.photo, 'photo')}</div>`).join('')}</div>` : '<p class="muted">Une question, une précision ? Écris-la ici : tout le monde la voit.</p>'}
      <div class="row"><input id="rn-text" placeholder="Écrire un message…" style="flex:1"><button class="btn small pri" data-a="repNote" data-id="${id}">Envoyer</button></div></div>
    <div class="row"><button class="btn ghost" data-a="repEdit" data-id="${id}">✏️ Modifier</button>${isMgr() ? `<button class="btn ghost bad-t" data-a="repDel" data-id="${id}">Supprimer</button>` : ''}</div>`);
}
function repForm(id, preset) {
  const i = id ? S.issues.find((x) => x.id === id) : { hotel: S.scope !== 'all' ? S.scope : S.hotel, origin: 'entretien', priority: 'normal', ...(preset || {}) };
  const places = [...roomsOf(i.hotel), ...communsOf(i.hotel)].map((r) => r.num);
  openSheet('repf', `${sheetHead(id ? 'Modifier la réparation' : 'Nouvelle réparation')}
    <div class="card form">
      <label>Quoi ?<input id="rf-title" value="${esc(id ? repTitle(i) : (i.title || ''))}" placeholder="Ex. : remplacer la prise de la chambre 14"></label>
      <div class="two"><label>Hôtel<select id="rf-hotel">${HOTELS.map((h) => opt(h.id, i.hotel, h.name)).join('')}</select></label><label>Où ?<input id="rf-room" list="rf-places" value="${esc(i.room || '')}" placeholder="Chambre, couloir…"></label></div>
      <datalist id="rf-places">${places.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
      <div class="two"><label>Priorité<select id="rf-prio">${Object.entries(PRIO).map(([k, l]) => opt(k, i.priority, l)).join('')}</select></label><label>Avant le<input id="rf-due" type="date" value="${esc(i.due || '')}"></label></div>
      <div class="two"><label>Origine<select id="rf-orig">${Object.entries(ORIG).map(([k, l]) => opt(k, i.origin, l)).join('')}</select></label><label>Matériel, pièces<input id="rf-parts" value="${esc(i.parts || '')}"></label></div>
      <label>Détails<textarea id="rf-details" rows="4">${esc(i.details || i.text || '')}</textarea></label>
      ${id ? '' : `<button class="btn soft" data-a="repFormPhoto">${S.rfPhoto ? '✅ Photo ajoutée' : '📷 Ajouter une photo'}</button>`}
      <button class="btn pri" data-a="repSave" data-id="${id || ''}">${id ? 'Enregistrer' : 'Créer la réparation'}</button></div>
    ${id ? `<button class="btn ghost" data-a="repOpen" data-id="${id}">← Retour</button>` : ''}`);
}

/* ----- contacts et prestataires ----- */
const CCATS = ['Électricité', 'Alarme / SSI', 'Travaux', 'Contrôle & sécurité', 'Administration', 'Banque & assurance', 'Comptabilité', 'Télécom', 'Équipe', 'Autre'];
const CST = { actif: ['Actif', 'green'], relancer: ['À relancer', 'amber'], decline: ['A décliné', 'plain'], completer: ['Coordonnées à compléter', 'slate'] };
function viewContacts() {
  const q = S.cq.trim().toLowerCase();
  const list = S.contacts.filter((c) => role() === 'mgr' || PRESTA.includes(c.categorie)).filter((c) => !q || [c.nom, c.societe, c.role, c.categorie, c.notes].join(' ').toLowerCase().includes(q));
  const cats = [...new Set([...CCATS, ...list.map((c) => c.categorie || 'Autre')])].filter((k) => list.some((c) => (c.categorie || 'Autre') === k));
  return `<input id="ctQ" type="search" placeholder="Chercher un nom, une société, un métier" value="${esc(S.cq)}" data-input="ctQ" style="width:100%">
    ${cats.map((k) => `<h2 class="sec">${esc(k)}</h2><div class="group">${list.filter((c) => (c.categorie || 'Autre') === k).map((c) => `<button class="prow" data-a="ctOpen" data-id="${c.id}"><span class="pr-t"><b>${esc(c.nom)}</b><span class="muted">${esc([c.role, c.societe && c.societe !== c.nom ? c.societe : ''].filter(Boolean).join(' · '))}</span></span>${c.telephone ? '<span class="pill p-green">📞</span>' : ''}${c.statut === 'relancer' ? '<span class="pill p-amber">À relancer</span>' : ''}</button>`).join('')}</div>`).join('') || '<div class="card empty"><h3>Aucun contact</h3></div>'}`;
}
const telHref = (t) => 'tel:' + String(t).replace(/[^0-9+]/g, '');
function ctSheet(id) {
  const c = S.contacts.find((x) => x.id === id); if (!c) return;
  const st = CST[c.statut] || CST.actif;
  openSheet('ct', `${sheetHead(esc(c.nom))}<p class="muted">${esc([c.role, c.societe].filter(Boolean).join(' · '))}</p>
    <div class="row">${c.telephone ? `<a class="btn ok" href="${telHref(c.telephone)}">📞 Appeler</a>` : ''}${c.email ? `<a class="btn soft" href="mailto:${esc(c.email)}">✉️ Écrire</a>` : ''}</div>
    <div class="group">${[['Téléphone', c.telephone], ['E-mail', c.email], ['Adresse', c.adresse], ['Catégorie', c.categorie], ['Hôtels', (c.hotels || []).map(hotelName).join(', ')]].filter((x) => x[1]).map(([l, v]) => `<div class="prow ro"><span class="pr-t"><span class="muted sm">${l}</span><span>${esc(v)}</span></span></div>`).join('')}
      <div class="prow ro"><span class="pr-t"><span class="muted sm">Statut</span></span><span class="pill p-${st[1]}">${st[0]}</span></div></div>
    ${c.notes ? `<div class="card"><p class="pre">${esc(c.notes)}</p></div>` : ''}
    ${isMgr() ? `<div class="row"><button class="btn ghost" data-a="ctEdit" data-id="${id}">✏️ Modifier</button><button class="btn ghost bad-t" data-a="ctDel" data-id="${id}">Supprimer</button></div>` : ''}`);
}
function ctForm(id) {
  const c = id ? S.contacts.find((x) => x.id === id) : { categorie: 'Électricité', hotels: [], statut: 'actif' };
  openSheet('ctf', `${sheetHead(id ? 'Modifier le contact' : 'Nouveau contact')}
    <div class="card form">
      <label>Nom<input id="cf-nom" value="${esc(c.nom || '')}"></label>
      <div class="two"><label>Société<input id="cf-soc" value="${esc(c.societe || '')}"></label><label>Rôle, métier<input id="cf-role" value="${esc(c.role || '')}"></label></div>
      <div class="two"><label>Téléphone<input id="cf-tel" inputmode="tel" value="${esc(c.telephone || '')}"></label><label>E-mail<input id="cf-mail" inputmode="email" value="${esc(c.email || '')}"></label></div>
      <label>Adresse<input id="cf-adr" value="${esc(c.adresse || '')}"></label>
      <div class="two"><label>Catégorie<select id="cf-cat">${CCATS.map((k) => opt(k, c.categorie)).join('')}</select></label><label>Statut<select id="cf-st">${Object.entries(CST).map(([k, v]) => opt(k, c.statut, v[0])).join('')}</select></label></div>
      <div class="chips">${HOTELS.map((h) => `<label class="check"><input type="checkbox" class="cf-h" value="${h.id}" ${(c.hotels || []).includes(h.id) ? 'checked' : ''}> ${esc(h.name)}</label>`).join('')}</div>
      <label>Notes<textarea id="cf-notes" rows="4">${esc(c.notes || '')}</textarea></label>
      <button class="btn pri" data-a="ctSave" data-id="${id || ''}">Enregistrer</button></div>`);
}

/* ----- sécurité : vérifications, contrôles internes, documents, commission ----- */
const SG = { presta: 'Vérifications par les prestataires', interne: 'Contrôles internes', doc: 'Documents à avoir', commission: 'Commission de sécurité' };
const SG_HELP = { presta: 'Faites par une entreprise, avec un rapport à garder.', interne: 'Faits par l’équipe. À noter aussi au registre de sécurité.', doc: 'À présenter le jour de la commission.', commission: '' };
const FREQ = [[1, 'Tous les mois'], [3, 'Tous les 3 mois'], [6, 'Tous les 6 mois'], [12, 'Tous les ans'], [24, 'Tous les 2 ans'], [36, 'Tous les 3 ans'], [60, 'Tous les 5 ans']];
const freqLabel = (m) => (FREQ.find((f) => f[0] === m) || [0, m ? `Tous les ${m} mois` : 'Pas de périodicité'])[1];
const secChecks = () => (S.sec && S.sec.checks) || [];
const secLogs = (id) => ((S.sec && S.sec.logs) || []).filter((l) => l.check_id === id).sort((a, b) => String(b.done_on).localeCompare(String(a.done_on)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
const secLast = (c) => secLogs(c.id)[0] || null;
const addMonthsISO = (iso, n) => { const d = new Date(iso + 'T12:00:00'), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return dayStr(d.getTime()); };
const daysTo = (iso) => Math.round((new Date(iso + 'T12:00:00') - new Date(todayISO() + 'T12:00:00')) / 864e5);
const longDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function secNext(c) { if (c.next_due) return c.next_due; const l = secLast(c); return c.freq_months && l ? addMonthsISO(l.done_on, c.freq_months) : null; }
// Couleur d'une ligne : rouge en retard ou manquant, orange bientôt, vert à jour, gris à renseigner.
function secSt(c) {
  if (c.status === 'na') return { k: 'na', c: 'plain', t: 'Non concerné', o: 5 };
  if (c.grp === 'doc') return c.doc_state === 'ok' ? { k: 'ok', c: 'green', t: 'Présent', o: 4 } : (c.doc_state === 'manquant' ? { k: 'late', c: 'red', t: 'Manquant', o: 0 } : { k: 'unk', c: 'slate', t: 'À vérifier', o: 2 });
  const nx = secNext(c);
  if (!nx) return { k: 'unk', c: 'slate', t: 'À renseigner', o: 2 };
  const n = daysTo(nx), soon = c.freq_months && c.freq_months <= 1 ? 3 : 30;
  if (c.next_due && n >= 0) return { k: n <= soon ? 'soon' : 'ok', c: n <= soon ? 'amber' : 'green', t: n === 0 ? 'Aujourd’hui' : 'Prévue le ' + fdate(nx).slice(0, 5), o: n <= soon ? 1 : 3, n, nx };
  if (n < 0) return { k: 'late', c: 'red', t: 'En retard', o: 0, n, nx };
  if (n <= soon) return { k: 'soon', c: 'amber', t: n === 0 ? 'Aujourd’hui' : (n === 1 ? 'Demain' : `Dans ${n} j`), o: 1, n, nx };
  return { k: 'ok', c: 'green', t: 'À jour', o: 3, n, nx };
}
const secOrder = (a, b) => secSt(a).o - secSt(b).o || a.ord - b.ord;
const secLate = (list) => list.filter((c) => secSt(c).k === 'late');
const secDueBrico = () => secChecks().filter((c) => c.grp === 'interne' && c.who === 'intendant' && c.status !== 'na' && ['late', 'soon', 'unk'].includes(secSt(c).k) && (secSt(c).k !== 'soon' || secSt(c).n <= 0));
function secRow(c) {
  const st = secSt(c), l = secLast(c);
  const sub = c.grp === 'doc' ? (l ? 'Mis à jour le ' + fdate(l.done_on) : (c.doc_state === 'manquant' ? 'À obtenir' : ''))
    : [l ? `Dernière fois le ${fdate(l.done_on)}${l.by_label ? ' · ' + l.by_label : ''}` : 'Jamais noté ici', st.nx && !c.next_due ? `prochaine avant le ${fdate(st.nx)}` : ''].filter(Boolean).join(' · ');
  return `<button class="prow" data-a="secOpen" data-id="${esc(c.id)}"><span class="pr-t"><b>${esc(c.label)}</b>${sub ? `<span class="muted sm">${esc(sub)}</span>` : ''}${c.obs === 'a_lever' && c.status !== 'na' ? '<span class="sm warn-t">⚠️ Observations à lever</span>' : ''}${(secLast(c) || {}).docs && secLast(c).docs.length ? '<span class="muted sm">📄 Rapport joint</span>' : ''}</span><span class="pill p-${st.c}">${st.t}</span></button>`;
}
function secCommCard(c) {
  if (!c || !c.next_due) return '';
  const n = daysTo(c.next_due); if (n < -2 || n > 90) return '';
  const pend = secChecks().filter((x) => x.hotel === c.hotel && x.status !== 'na' && x.grp !== 'commission' && x.grp !== 'interne' && ['late', 'unk'].includes(secSt(x).k)).length;
  const obs = secChecks().filter((x) => x.hotel === c.hotel && x.obs === 'a_lever' && x.status !== 'na').length;
  return `<div class="card comm"><p class="cap">Commission de sécurité · ${n > 1 ? 'dans ' + n + ' jours' : (n === 1 ? 'demain' : (n === 0 ? 'aujourd’hui' : 'passée'))}</p><h3>${esc(longDate(c.next_due))}</h3>${c.next_note ? `<p class="muted">${esc(c.next_note)}</p>` : ''}
    <p class="sm">${pend ? `<b class="bad-t">${pend} point${pend > 1 ? 's' : ''} à compléter</b>` : '<b class="ok-t">Tout est prêt</b>'}${obs ? ` · ${obs} observation${obs > 1 ? 's' : ''} à lever` : ''}</p>
    <div class="row"><button class="btn small pri" data-a="secDossier" data-k="${c.hotel}">📋 Préparer le dossier</button><button class="btn small" data-a="secOpen" data-id="${esc(c.id)}">Noter la visite</button></div></div>`;
}
function viewSecurite() {
  const all = secChecks().filter((c) => hotelOk0(c.hotel)), list = all.filter((c) => c.hotel === S.hotel && c.status !== 'na'), na = all.filter((c) => c.hotel === S.hotel && c.status === 'na');
  const n = (k) => list.filter((c) => secSt(c).k === k).length, obs = list.filter((c) => c.obs === 'a_lever').length;
  const seg = `<div class="segc" role="group" aria-label="Hôtel">${HOTELS.map((h) => { const l = secLate(all.filter((c) => c.hotel === h.id && c.status !== 'na')).length; return `<button data-a="hotel" data-k="${h.id}" aria-pressed="${S.hotel === h.id}">${esc(h.id === 'par' ? 'Paris' : h.name)}${l ? ` <span class="badge sm">${l}</span>` : ''}</button>`; }).join('')}</div>`;
  const comm = list.find((c) => c.grp === 'commission');
  return `${seg}${secCommCard(comm)}
    <div class="chips">${n('late') ? `<span class="chip c-red">En retard <b>${n('late')}</b></span>` : ''}${n('soon') ? `<span class="chip c-amber">Bientôt <b>${n('soon')}</b></span>` : ''}${n('unk') ? `<span class="chip c-slate">À renseigner <b>${n('unk')}</b></span>` : ''}${obs ? `<span class="chip c-amber">Observations <b>${obs}</b></span>` : ''}${!n('late') && !n('soon') && !n('unk') ? '<span class="chip c-green">Tout est à jour</span>' : ''}</div>
    ${['presta', 'interne', 'doc', 'commission'].map((g) => { const L = list.filter((c) => c.grp === g).sort(secOrder); return L.length ? `<h2 class="sec">${SG[g]}</h2>${SG_HELP[g] ? `<p class="muted sm">${SG_HELP[g]}</p>` : ''}<div class="group">${L.map(secRow).join('')}</div>` : ''; }).join('')}
    ${na.length ? `<h2 class="sec">Non concerné</h2><div class="group">${na.map(secRow).join('')}</div>` : ''}
    <button class="btn ghost" data-a="secAdd">＋ Ajouter un contrôle ou un document</button>`;
}
const hotelOk0 = (h) => !S.me.only_hotel || S.me.only_hotel === h;
// Intendant : ses contrôles internes, tous hôtels.
function viewSecBrico() {
  const all = secChecks().filter((c) => c.status !== 'na' && c.grp === 'interne' && c.who === 'intendant'), list = scoped(all).sort(secOrder), due = secDueBrico();
  return `${scopeSeg(due)}<p class="muted">${due.length ? `${due.length} contrôle${due.length > 1 ? 's' : ''} à faire. Touche une ligne, fais le contrôle, puis « C’est fait ».` : 'Tout est fait pour l’instant. 👍'}</p>
    ${HOTELS.filter((h) => list.some((c) => c.hotel === h.id)).map((h) => `<h2 class="sec">${esc(h.name)}</h2><div class="group">${list.filter((c) => c.hotel === h.id).map(secRow).join('')}</div>`).join('')}`;
}
const docA = (d) => { const u = mediaUrl(d.path); return u ? `<a class="doc" href="${esc(u)}" target="_blank" rel="noopener">📄 ${esc(d.name || 'Rapport')}</a>` : `<span class="doc muted">📄 ${esc(d.name || 'Rapport')} (indisponible)</span>`; };
function secLogHtml(l, c) {
  const res = l.result === 'obs' ? (l.obs_state === 'levees' ? '<span class="pill p-green">Observations levées</span>' : '<span class="pill p-amber">Observations</span>') : (c.grp === 'interne' ? '<span class="pill p-green">Fait</span>' : (c.grp === 'doc' ? '' : `<span class="pill p-green">${c.grp === 'commission' ? 'Avis favorable' : 'Conforme'}</span>`));
  return `<div class="logi"><div class="row between"><b>${fdate(l.done_on)}${l.by_label ? ' · ' + esc(l.by_label) : ''}</b>${res}</div>${l.note ? `<p class="pre sm">${esc(l.note)}</p>` : ''}
    ${(l.docs || []).length ? `<div class="docs">${l.docs.map(docA).join('')}</div>` : ''}${(l.photos || []).length ? `<div class="thumbs">${l.photos.map((p) => `<button data-a="zoom" data-id="${esc(p.id)}" data-l="${esc(c.label)}"><img loading="lazy" alt="" src="${esc(mediaUrl(p.id) || '')}"></button>`).join('')}</div>` : ''}
    ${isMgr() ? `<button class="btn small ghost bad-t" data-a="secLogDel" data-id="${esc(c.id)}" data-l="${esc(l.id)}">Effacer cette ligne</button>` : ''}</div>`;
}
function secSheet(id) {
  const c = secChecks().find((x) => x.id === id); if (!c) { closeSheet(); return; }
  const st = secSt(c), logs = secLogs(id), mgr = isMgr(), ct = c.contact_id && S.contacts.find((x) => x.id === c.contact_id);
  const nextTxt = c.grp === 'doc' ? '' : (st.nx ? (c.next_due ? `Prévue le ${longDate(st.nx)}` : `Prochaine avant le ${fdate(st.nx)}`) + (st.n != null ? (st.n < 0 ? ` · en retard de ${-st.n} j` : (st.n === 0 ? ' · aujourd’hui' : ` · dans ${st.n} j`)) : '') : (c.freq_months ? 'Date de la dernière fois à renseigner' : ''));
  let acts = '';
  if (c.grp === 'interne') acts = `<button class="btn ok" data-a="secDone" data-id="${esc(id)}">✓ C’est fait aujourd’hui</button><div class="row"><button class="btn soft" data-a="secDone" data-id="${esc(id)}" data-k="photo">📷 Fait, avec une photo</button><button class="btn soft bad-t" data-a="secLogNew" data-id="${esc(id)}" data-k="obs">⚠️ Un problème</button></div>${mgr ? `<button class="btn ghost" data-a="secLogNew" data-id="${esc(id)}">Noter à une autre date</button>` : ''}`;
  else if (c.grp === 'doc') acts = `<div class="segc" role="group" aria-label="État">${[['ok', 'Présent'], ['manquant', 'Manquant'], ['', 'À vérifier']].map(([k, l]) => `<button data-a="secDocState" data-id="${esc(id)}" data-k="${k}" aria-pressed="${(c.doc_state || '') === k}">${l}</button>`).join('')}</div><button class="btn soft" data-a="secLogNew" data-id="${esc(id)}">📎 Joindre le document</button>`;
  else acts = `<button class="btn pri" data-a="secLogNew" data-id="${esc(id)}">＋ ${c.grp === 'commission' ? 'Noter la visite de la commission' : 'Noter une vérification'}</button>`;
  openSheet('sec:' + id, `${sheetHead(esc(c.label))}<p class="muted">${esc(hotelName(c.hotel))} · <span class="pill p-${st.c}">${st.t}</span></p>
    ${nextTxt ? `<div class="banner c-${st.c === 'plain' ? 'slate' : st.c}">${esc(nextTxt)}${c.next_note ? `<br><span class="sm">${esc(c.next_note)}</span>` : ''}</div>` : ''}
    ${c.obs === 'a_lever' && mgr ? `<div class="card"><h3>⚠️ Observations à lever</h3><p class="muted sm">Le dernier rapport contient des observations. Fais-les faire, puis note-les levées (sur le rapport et au registre).</p>
      <div class="row"><button class="btn small ok" data-a="secObs" data-id="${esc(id)}" data-k="levees">✓ Observations levées</button><button class="btn small soft" data-a="secRep" data-id="${esc(id)}">🔧 Créer une réparation</button></div></div>` : ''}
    ${c.status === 'na' ? '' : acts}
    ${c.note ? `<div class="card"><h3>À savoir</h3><p class="pre">${esc(c.note)}</p></div>` : ''}
    <div class="group">${[c.freq_months ? ['Fréquence', freqLabel(c.freq_months)] : null, c.provider || ct ? ['Fait par', c.provider || ct.nom] : null, c.grp === 'interne' ? ['Qui', c.who === 'intendant' ? 'L’intendant (ou un gérant)' : 'Un gérant'] : null, c.ref ? ['Règle', c.ref] : null].filter(Boolean).map(([l, v]) => `<div class="prow ro"><span class="pr-t"><span class="muted sm">${l}</span><span>${esc(v)}</span></span></div>`).join('')}
      ${ct && canPresta() ? `<button class="prow" data-a="ctOpen" data-id="${ct.id}"><span class="pr-t"><span class="muted sm">Contact</span><span>${esc(ct.nom)}${ct.telephone ? ' · ' + esc(ct.telephone) : ''}</span></span><span class="chev">›</span></button>` : ''}</div>
    <h2 class="sec">Historique</h2>${logs.length ? `<div class="card">${logs.map((l) => secLogHtml(l, c)).join('')}</div>` : '<p class="muted">Rien de noté pour l’instant.</p>'}
    ${mgr ? `<div class="row"><button class="btn ghost" data-a="secEdit" data-id="${esc(id)}">✏️ Modifier</button><button class="btn ghost" data-a="secNa" data-id="${esc(id)}">${c.status === 'na' ? 'Concerné' : 'Non concerné'}</button>${id.includes('-x') ? `<button class="btn ghost bad-t" data-a="secDel" data-id="${esc(id)}">Supprimer</button>` : ''}</div>` : ''}`);
}
// Redessine un formulaire sans perdre ce qui a été tapé.
function keepForm(draw) { const vals = {}; document.querySelectorAll('#sheet input[id], #sheet select[id], #sheet textarea[id]').forEach((e) => vals[e.id] = e.value); draw(); Object.entries(vals).forEach(([k, v]) => { const e = $(k); if (e) e.value = v; }); }
function secLogForm(id, kind) {
  const c = secChecks().find((x) => x.id === id); if (!c) return;
  const comm = c.grp === 'commission', doc = c.grp === 'doc', inte = c.grp === 'interne';
  S.sl = S.sl && S.sl.id === id ? S.sl : { id, docs: [], photos: [] };
  const res = inte ? [['ok', 'Fait, tout va bien'], ['obs', 'Un problème à régler']] : (comm ? [['ok', 'Avis favorable'], ['obs', 'Prescriptions à lever'], ['obs_l', 'Prescriptions déjà levées']] : [['ok', 'Conforme, sans observation'], ['obs', 'Observations à lever'], ['obs_l', 'Observations déjà levées']]);
  openSheet('secf', `${sheetHead(doc ? 'Joindre le document' : (inte ? 'Noter le contrôle' : (comm ? 'Visite de la commission' : 'Noter une vérification')))}<p class="muted">${esc(c.label)} · ${esc(hotelName(c.hotel))}</p>
    <div class="card form">
      <div class="two"><label>Date<input id="sl-date" type="date" value="${todayISO()}" max="${todayISO()}"></label>${inte ? '' : `<label>${comm ? 'Présents' : 'Fait par'}<input id="sl-by" value="${esc(comm ? '' : (c.provider || ''))}" placeholder="${comm ? 'Mairie, SDIS…' : 'Entreprise'}"></label>`}</div>
      ${doc ? '' : `<label>Résultat<select id="sl-res">${res.map(([k, l]) => opt(k, kind === 'obs' ? 'obs' : 'ok', l)).join('')}</select></label>`}
      <label>${inte ? 'Ce qui a été vu' : 'Notes'}<textarea id="sl-note" rows="3" placeholder="${inte ? (kind === 'obs' ? 'Ex. : bloc du couloir 2e ne s’allume pas' : 'Facultatif') : 'N° de rapport, observations…'}"></textarea></label>
      ${isMgr() ? `<button class="btn soft" data-a="slDoc">📎 ${S.sl.docs.length ? S.sl.docs.length + ' PDF joint' + (S.sl.docs.length > 1 ? 's' : '') + ' · en ajouter' : (doc ? 'Choisir le fichier (PDF ou photo)' : 'Joindre le rapport (PDF)')}</button>` : ''}
      <button class="btn soft" data-a="slPhoto">📷 ${S.sl.photos.length ? S.sl.photos.length + ' photo' + (S.sl.photos.length > 1 ? 's' : '') + ' · en ajouter' : 'Ajouter une photo'}</button>
      <button class="btn pri" data-a="slSave" data-id="${esc(id)}">Enregistrer</button></div>
    <button class="btn ghost" data-a="secOpen" data-id="${esc(id)}">← Retour</button>`);
}
function secEditForm(id) {
  const c = id ? secChecks().find((x) => x.id === id) : { hotel: S.hotel, grp: 'presta', freq_months: 12, who: 'gerant' };
  const prest = S.contacts.filter((x) => PRESTA.includes(x.categorie));
  openSheet('sece', `${sheetHead(id ? 'Modifier' : 'Ajouter')}<p class="muted">${esc(hotelName(c.hotel))}</p>
    <div class="card form">
      ${id ? '' : `<label>Type<select id="se-grp">${Object.entries(SG).filter(([k]) => k !== 'commission').map(([k, l]) => opt(k, c.grp, l)).join('')}</select></label>`}
      <label>Nom<input id="se-label" value="${esc(c.label || '')}" placeholder="Ex. : VMC – entretien"></label>
      ${c.grp === 'doc' && id ? '' : `<div class="two"><label>Fréquence<select id="se-freq">${opt('', c.freq_months || '', 'Pas de périodicité')}${FREQ.map(([m, l]) => opt(m, c.freq_months, l)).join('')}</select></label><label>Date prévue<input id="se-next" type="date" value="${esc(c.next_due || '')}"></label></div>
      <label>Précision sur la date prévue<input id="se-nnote" value="${esc(c.next_note || '')}" placeholder="Ex. : 14h00, présence de la mairie"></label>`}
      ${c.grp === 'presta' || !id ? `<div class="two"><label>Fait par<input id="se-prov" value="${esc(c.provider || '')}"></label><label>Contact<select id="se-ct">${opt('', c.contact_id || '', '—')}${prest.map((x) => opt(x.id, c.contact_id, x.nom)).join('')}</select></label></div>` : ''}
      ${c.grp === 'interne' ? `<label>Qui le fait<select id="se-who">${opt('intendant', c.who, 'L’intendant')}${opt('gerant', c.who, 'Un gérant')}</select></label>` : ''}
      <label>À savoir<textarea id="se-note" rows="4">${esc(c.note || '')}</textarea></label>
      <button class="btn pri" data-a="secSave" data-id="${esc(id || '')}">Enregistrer</button></div>
    ${id ? `<button class="btn ghost" data-a="secOpen" data-id="${esc(id)}">← Retour</button>` : ''}`);
}
// Dossier pour la commission : tout ce qu'elle a demandé, coché ou non, avec les rapports.
function secDossier(h) {
  const L = secChecks().filter((c) => c.hotel === h && c.status !== 'na');
  const line = (c) => { const st = secSt(c), l = secLast(c), okk = st.k === 'ok' || st.k === 'soon' || (c.grp === 'interne' && l);
    return `<button class="prow" data-a="secOpen" data-id="${esc(c.id)}"><span class="pr-t"><b>${okk ? '✅' : '⬜️'} ${esc(c.label)}</b><span class="muted sm">${esc(c.grp === 'doc' ? st.t : (l ? 'Le ' + fdate(l.done_on) + (l.by_label ? ' · ' + l.by_label : '') : 'Pas de date'))}${l && (l.docs || []).length ? ' · 📄 rapport joint' : (c.grp === 'presta' && l ? ' · rapport à joindre' : '')}${c.obs === 'a_lever' ? ' · ⚠️ observations à lever' : ''}</span></span></button>`; };
  const reps = S.issues.filter((i) => i.hotel === h && repEtat(i) !== 'fait' && (i.origin === 'dekra' || i.origin === 'commission'));
  const comm = L.find((c) => c.grp === 'commission');
  openSheet('secd', `${sheetHead('Dossier commission · ' + esc(hotelName(h)))}${comm && comm.next_due ? `<p class="muted">${esc(longDate(comm.next_due))}${comm.next_note ? ' · ' + esc(comm.next_note) : ''}</p>` : ''}
    <h2 class="sec">Rapports des vérifications</h2><div class="group">${L.filter((c) => c.grp === 'presta').map(line).join('')}</div>
    <h2 class="sec">Personnel</h2><div class="group">${L.filter((c) => ['exo', 'form', 't_alarme'].includes(c.id.split('-')[1])).map(line).join('')}</div>
    <h2 class="sec">Documents et affichage</h2><div class="group">${L.filter((c) => c.grp === 'doc').map(line).join('')}</div>
    <h2 class="sec">Réparations en cours (rapports, commission)</h2>${reps.length ? `<div class="group">${reps.map(repRow).join('')}</div>` : '<p class="muted">Aucune.</p>'}
    <p class="muted sm">Avant la visite : faire le tour des locaux (rien de stocké dans les couloirs, locaux techniques identifiés).</p>`);
}

/* ----- projets et tâches (gérants) ----- */
const PST = { urgent: { l: 'Urgent', s: 'Urgent', c: 'red' }, en_cours: { l: 'En cours', s: 'En cours', c: 'accent' }, reflexion: { l: 'En réflexion', s: 'Réflexion', c: 'amber' }, pause: { l: 'En pause', s: 'Pause', c: 'plain' }, termine: { l: 'Terminé', s: 'Terminé', c: 'green' } };
const TST = { a_faire: { l: 'À faire', c: 'red' }, en_attente: { l: 'En attente', c: 'amber' }, a_verifier: { l: 'À vérifier', c: 'slate' }, fait: { l: 'Fait', c: 'green' } };
const TPR = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' };
const PHOTEL = { all: 'Les 3 hôtels', arc: 'Archange', par: 'Hôtel de Paris', cha: 'Châteaudun' };
const projById = (id) => S.projects.find((p) => p.id === id);
const projTasks = (id) => S.tasks.filter((t) => t.project_id === id);
const tOpen = (t) => t.etat !== 'fait';
const tLate = (t) => tOpen(t) && t.due && t.due < todayISO();
const tToday = (t) => tOpen(t) && t.due === todayISO();
const myTasks = () => S.tasks.filter((t) => tOpen(t) && t.owner === S.me.id);
const tSort = (a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')) || ((b.prio === 'haute') - (a.prio === 'haute')) || String(b.created_at || '').localeCompare(String(a.created_at || ''));
const mgrStaff = () => S.staff.filter((s) => (s.role === 'owner' || s.role === 'gerant') && s.active !== false);
function dueTxt(t) {
  if (!t.due) return '';
  const n = daysTo(t.due);
  if (!tOpen(t)) return '';
  if (n < 0) return `⏰ en retard · ${fdate(t.due).slice(0, 5)}`;
  if (n === 0) return 'aujourd’hui';
  if (n === 1) return 'demain';
  return n < 7 ? new Date(t.due + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long' }) : 'avant le ' + fdate(t.due).slice(0, 5);
}
function taskRow(t, showProj) {
  const p = t.project_id && projById(t.project_id), done = !tOpen(t);
  const sub = [showProj && p ? `${p.emoji || '📁'} ${p.title}` : '', t.owner && t.owner !== S.me.id ? '👤 ' + first(nameOf(t.owner)) : (t.owner ? '' : '👤 à attribuer'), done ? (t.done_at ? 'fait le ' + fdate(t.done_at) : '') : (t.etat !== 'a_faire' ? TST[t.etat].l : '')].filter(Boolean).join(' · ');
  const due = dueTxt(t);
  return `<div class="prow task ${done ? 'done' : ''}"><button class="tcheck ${done ? 'on' : ''}" data-a="taskTick" data-id="${t.id}" aria-label="${done ? 'Rouvrir' : 'Marquer fait'}">${done ? '✓' : ''}</button>
    <button class="pr-t tbody" data-a="taskOpen" data-id="${t.id}"><b>${t.prio === 'haute' && !done ? '❗ ' : ''}${esc(t.title)}</b>${sub ? `<span class="muted sm">${esc(sub)}</span>` : ''}</button>
    ${due ? `<span class="pill p-${tLate(t) ? 'red' : (tToday(t) ? 'amber' : 'slate')}">${esc(due)}</span>` : ''}</div>`;
}
function projRow(p) {
  const ts = projTasks(p.id), open = ts.filter(tOpen), late = open.filter(tLate).length;
  const meta = [open.length ? `${open.length} tâche${open.length > 1 ? 's' : ''} à faire` : (ts.length ? 'Toutes les tâches sont faites' : 'Pas de tâche'), late ? `⏰ ${late} en retard` : '', p.hotel ? PHOTEL[p.hotel] : ''].filter(Boolean).join(' · ');
  return `<button class="prow" data-a="projOpen" data-id="${p.id}"><span class="pemoji">${esc(p.emoji || '📁')}</span><span class="pr-t"><b>${esc(p.title)}</b>${p.resume ? `<span class="muted sm clamp2">${esc(p.resume)}</span>` : ''}<span class="muted sm">${esc(meta)}</span></span><span class="chev">›</span></button>`;
}
function viewProjets() {
  const mine = myTasks().length;
  const seg = `<div class="segc" role="group" aria-label="Vue">${[['projets', 'Projets', S.projects.filter((p) => p.statut !== 'termine').length], ['taches', 'Tâches', mine]].map(([k, l, n]) => `<button data-a="psub" data-k="${k}" aria-pressed="${S.psub === k}">${l} <span class="cnt">${n}</span></button>`).join('')}</div>`;
  if (S.psub === 'taches') return seg + viewTaches();
  const groups = ['urgent', 'en_cours', 'reflexion', 'pause'].map((k) => [k, S.projects.filter((p) => p.statut === k).sort((a, b) => a.ord - b.ord)]).filter(([, l]) => l.length);
  const fin = S.projects.filter((p) => p.statut === 'termine');
  return `${seg}${groups.map(([k, l]) => `<h2 class="sec">${PST[k].l}</h2><div class="group">${l.map(projRow).join('')}</div>`).join('') || '<div class="card empty"><div class="e">📁</div><h3>Aucun projet</h3></div>'}
    ${fin.length ? `<button class="btn ghost" data-a="pFin">${S.pFin ? 'Masquer' : 'Voir'} les ${fin.length} projet${fin.length > 1 ? 's' : ''} terminé${fin.length > 1 ? 's' : ''}</button>${S.pFin ? `<div class="group">${fin.map(projRow).join('')}</div>` : ''}` : ''}`;
}
function viewTaches() {
  const f = S.tf || 'mine';
  const seg = `<div class="segc" role="group" aria-label="Filtre">${[['mine', 'Mes tâches'], ['all', 'Toutes'], ['done', 'Faites']].map(([k, l]) => `<button data-a="tf" data-k="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>`;
  if (f === 'done') { const L = S.tasks.filter((t) => !tOpen(t)).sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || ''))).slice(0, 80); return seg + (L.length ? `<div class="group">${L.map((t) => taskRow(t, true)).join('')}</div>` : '<p class="muted">Rien encore.</p>'); }
  const L = (f === 'mine' ? myTasks() : S.tasks.filter(tOpen)).sort(tSort);
  const B = [['⏰ En retard', (t) => tLate(t)], ['Aujourd’hui', (t) => tToday(t)], ['Cette semaine', (t) => t.due && daysTo(t.due) > 0 && daysTo(t.due) <= 7], ['Plus tard', (t) => t.due && daysTo(t.due) > 7], ['Sans date', (t) => !t.due]];
  return seg + (L.length ? B.map(([l, fn]) => { const x = L.filter(fn); return x.length ? `<h2 class="sec">${l}</h2><div class="group">${x.map((t) => taskRow(t, true)).join('')}</div>` : ''; }).join('') : `<div class="card empty"><div class="e">✅</div><h3>${f === 'mine' ? 'Rien pour vous' : 'Rien à faire'}</h3></div>`);
}
// Texte d'un projet : « ## Titre » pour une partie, « - » pour un point.
function mdLite(txt) {
  let html = '', inList = false;
  String(txt || '').split('\n').forEach((line) => {
    const l = line.trim();
    if (/^-\s+/.test(l)) { if (!inList) { html += '<ul class="pbul">'; inList = true; } html += `<li>${esc(l.replace(/^-\s+/, ''))}</li>`; return; }
    if (inList) { html += '</ul>'; inList = false; }
    if (/^##\s+/.test(l)) html += `<h3>${esc(l.replace(/^##\s+/, ''))}</h3>`;
    else if (l) html += `<p>${esc(l)}</p>`;
  });
  return html + (inList ? '</ul>' : '');
}
function projSheet(id) {
  const p = projById(id); if (!p) { closeSheet(); return; }
  const ts = projTasks(id), open = ts.filter(tOpen).sort(tSort), done = ts.filter((t) => !tOpen(t));
  const cts = (p.contact_ids || []).map((c) => S.contacts.find((x) => x.id === c)).filter(Boolean);
  openSheet('proj:' + id, `${sheetHead(`${esc(p.emoji || '📁')} ${esc(p.title)}`)}
    ${p.resume ? `<p class="muted">${esc(p.resume)}</p>` : ''}
    <div class="segc five" role="group" aria-label="Statut">${Object.entries(PST).map(([k, v]) => `<button data-a="projStatut" data-id="${id}" data-k="${k}" aria-pressed="${p.statut === k}">${v.s}</button>`).join('')}</div>
    <div class="card"><div class="row between"><h3>Tâches${open.length ? ` · ${open.length}` : ''}</h3><button class="btn small soft" data-a="taskNew" data-id="${id}">＋ Tâche</button></div>
      ${open.length ? `<div class="group flat">${open.map((t) => taskRow(t, false)).join('')}</div>` : '<p class="muted">Aucune tâche en cours.</p>'}
      ${done.length ? `<button class="btn small ghost" data-a="pDone">${S.pDone ? 'Masquer' : 'Voir'} les ${done.length} faite${done.length > 1 ? 's' : ''}</button>${S.pDone ? `<div class="group flat">${done.map((t) => taskRow(t, false)).join('')}</div>` : ''}` : ''}</div>
    ${p.body ? `<div class="card pbody">${mdLite(p.body)}</div>` : ''}
    ${cts.length ? `<h2 class="sec">Contacts</h2><div class="group">${cts.map((c) => `<button class="prow" data-a="ctOpen" data-id="${c.id}"><span class="pr-t"><b>${esc(c.nom)}</b><span class="muted sm">${esc([c.role, c.societe && c.societe !== c.nom ? c.societe : ''].filter(Boolean).join(' · '))}</span></span>${c.telephone ? '<span class="pill p-green">📞</span>' : ''}</button>`).join('')}</div>` : ''}
    <p class="muted sm">${p.hotel ? esc(PHOTEL[p.hotel]) + ' · ' : ''}Mis à jour le ${fdate(p.updated_at)}</p>
    <div class="row"><button class="btn ghost" data-a="projEdit" data-id="${id}">✏️ Modifier</button><button class="btn ghost bad-t" data-a="projDel" data-id="${id}">Supprimer</button></div>`);
}
function projForm(id) {
  const p = id ? projById(id) : { statut: 'en_cours', hotel: S.scope !== 'all' ? S.scope : null, emoji: '📁', contact_ids: [], body: '## Objectif\n- \n\n## Décisions\n- \n\n## Questions ouvertes\n- ' };
  const cs = [...S.contacts].sort((a, b) => ((p.contact_ids || []).includes(b.id) - (p.contact_ids || []).includes(a.id)) || String(a.nom).localeCompare(String(b.nom), 'fr'));
  openSheet('projf', `${sheetHead(id ? 'Modifier le projet' : 'Nouveau projet')}
    <div class="card form">
      <div class="two narrow1"><label>Icône<input id="pf-emoji" value="${esc(p.emoji || '')}" maxlength="4"></label><label>Nom du projet<input id="pf-title" value="${esc(p.title || '')}"></label></div>
      <div class="two"><label>Hôtel<select id="pf-hotel">${opt('', p.hotel || '', 'Autre')}${Object.entries(PHOTEL).map(([k, l]) => opt(k, p.hotel, l)).join('')}</select></label><label>Statut<select id="pf-statut">${Object.entries(PST).map(([k, v]) => opt(k, p.statut, v.l)).join('')}</select></label></div>
      <label>En une phrase<input id="pf-resume" value="${esc(p.resume || '')}"></label>
      <label>Objectif, décisions, questions<textarea id="pf-body" rows="14">${esc(p.body || '')}</textarea></label>
      <p class="muted sm">« ## » au début d’une ligne pour un titre, « - » pour un point.</p>
      <details><summary>Contacts liés (${(p.contact_ids || []).length})</summary><div class="chips" style="margin-top:8px">${cs.map((c) => `<label class="check"><input type="checkbox" class="pf-ct" value="${c.id}" ${(p.contact_ids || []).includes(c.id) ? 'checked' : ''}> ${esc(c.nom)}</label>`).join('')}</div></details>
      <button class="btn pri" data-a="projSave" data-id="${id || ''}">Enregistrer</button></div>
    ${id ? `<button class="btn ghost" data-a="projOpen" data-id="${id}">← Retour</button>` : ''}`);
}
function taskForm(id, preset) {
  const t = id ? S.tasks.find((x) => x.id === id) : { etat: 'a_faire', prio: 'moyenne', owner: S.me.id, ...(preset || {}) };
  if (!t) return;
  const back = S.sheet && S.sheet.startsWith('proj:') ? S.sheet.slice(5) : (t.project_id && preset ? t.project_id : null);
  openSheet('task' + (id ? ':' + id : ''), `${sheetHead(id ? 'Tâche' : 'Nouvelle tâche')}
    ${id ? `<div class="segc four" role="group" aria-label="État">${Object.entries(TST).map(([k, v]) => `<button data-a="taskEtat" data-id="${id}" data-k="${k}" aria-pressed="${t.etat === k}">${v.l}</button>`).join('')}</div>` : ''}
    <div class="card form">
      <label>Quoi ?<input id="tf-title" value="${esc(t.title || '')}" placeholder="Ex. : appeler l’assurance pour le dossier"></label>
      <label>Projet<select id="tf-proj">${opt('', t.project_id || '', 'Sans projet')}${S.projects.filter((p) => p.statut !== 'termine' || p.id === t.project_id).map((p) => opt(p.id, t.project_id, `${p.emoji || '📁'} ${p.title}`)).join('')}</select></label>
      <div class="two"><label>Qui s’en occupe<select id="tf-owner">${opt('', t.owner || '', 'À attribuer')}${mgrStaff().map((s) => opt(s.id, t.owner, s.id === S.me.id ? 'Moi' : s.label)).join('')}</select></label><label>Pour le<input id="tf-due" type="date" value="${esc(t.due || '')}"></label></div>
      <label>Priorité<select id="tf-prio">${Object.entries(TPR).map(([k, l]) => opt(k, t.prio, l)).join('')}</select></label>
      <label>Notes<textarea id="tf-note" rows="4">${esc(t.note || '')}</textarea></label>
      <button class="btn pri" data-a="taskSave" data-id="${id || ''}" data-p="${back || ''}">${id ? 'Enregistrer' : 'Créer la tâche'}</button></div>
    ${id ? `<p class="muted sm">Créée le ${fdate(t.created_at)}${t.created_by ? ' par ' + esc(first(nameOf(t.created_by))) : ''}${t.done_at ? ' · faite le ' + fdate(t.done_at) + (t.done_by ? ' par ' + esc(first(nameOf(t.done_by))) : '') : ''}</p>` : ''}
    <div class="row">${back ? `<button class="btn ghost" data-a="projOpen" data-id="${back}">← Projet</button>` : ''}${id ? `<button class="btn ghost bad-t" data-a="taskDel" data-id="${id}">Supprimer</button>` : ''}</div>`);
}
function myTasksCard() {
  const L = myTasks().sort(tSort); if (!L.length) return '';
  const late = L.filter(tLate).length, today = L.filter(tToday).length, open = !!S.mtOpen;
  return `<div class="card mt ${open ? 'open' : ''}"><button class="mt-head" data-a="mtToggle" aria-expanded="${open}"><span>📌 <b>Mes tâches</b> <span class="cnt">${L.length}</span>${late ? ` <span class="pill p-red">${late} en retard</span>` : ''}${today ? ` <span class="pill p-amber">${today} aujourd’hui</span>` : ''}</span><span class="chev">${open ? '▴' : '▾'}</span></button>
    ${open ? `<div class="group flat">${L.slice(0, 5).map((t) => taskRow(t, true)).join('')}</div><button class="btn small ghost" data-a="go" data-k="projets" data-s="taches">Voir toutes mes tâches</button>` : ''}</div>`;
}

// Bandeau affiché quand un gérant utilise l'appli comme une femme de ménage ou l'intendant.
const pvBar = () => S.preview ? `<div class="pvbar"><span>👁 Vue ${S.preview === 'brico' ? 'intendant' : 'femme de ménage'} · ce que vous faites ici compte vraiment</span><button class="btn small" data-a="unpreview">Revenir</button></div>` : '';
/* ----- bricoleur : réparations + ménage en lecture ----- */
function viewBrico() {
  const un = unreadTotal(), open = S.issues.filter((i) => repEtat(i) !== 'fait'), todo = open.filter((i) => repEtat(i) === 'a_faire'), urg = open.filter((i) => i.priority === 'urgent').length;
  if (S.tab === 'issues' || S.tab === 'menage' || S.tab === 'securite' || (S.tab === 'contacts' && canPresta()) || (S.tab === 'registre' && canReg('reg_pec'))) {
    const body = S.tab === 'issues' ? viewIssues() : (S.tab === 'registre' ? viewRegistre() : (S.tab === 'contacts' ? viewContacts() : (S.tab === 'securite' ? viewSecBrico() : viewMenageRead())));
    const right = S.tab === 'issues' ? `<button class="nb-act" data-a="repNew" aria-label="Nouvelle réparation">${ico('plus')}</button>` : (S.tab === 'registre' && canReg('reg_full') ? `<button class="nb-act" data-a="occNew" aria-label="Nouvelle arrivée">${ico('plus')}</button>` : '');
    return `${navBar({ issues: 'Réparations', menage: 'Ménage', registre: 'Registre', contacts: 'Prestataires', securite: 'Contrôles sécurité' }[S.tab], right)}<div class="wrap">${pvBar()}${body}</div>
      <button class="bubble ${un ? 'ping' : ''}" data-a="convList" aria-label="Messages${un ? ', ' + un + ' non lus' : ''}">💬${un ? `<span class="badge">${un}</span>` : ''}</button>`;
  }
  const [, gt] = greet(), myClean = myCleanings();
  return `<div class="wrap home">${pvBar()}
    <div class="home-top"><div><p class="date">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${gt} ${esc(first(S.me.label))}</h1></div></div>
    ${myClean.length ? `<div class="card"><h3>🧹 Mes nettoyages</h3><div class="group">${myClean.map(cleanRow).join('')}</div></div>` : ''}
    <div class="today"><p class="cap">Aujourd’hui</p><div class="stats">
      <button class="stat" data-a="go" data-k="issues"><b class="${todo.length ? 'n-blue' : ''}">${todo.length}</b><span>à faire</span></button>
      <button class="stat" data-a="go" data-k="issues"><b class="${open.length - todo.length ? 'n-green' : ''}">${open.length - todo.length}</b><span>en cours</span></button>
      <button class="stat" data-a="go" data-k="issues"><b class="${urg ? 'n-red' : ''}">${urg}</b><span>${urg > 1 ? 'urgences' : 'urgence'}</span></button></div></div>
    <div class="tiles">
      <button class="tile" data-a="go" data-k="issues"><span class="ti-ic t-orange">${ico('tool')}</span>${open.length ? `<span class="badge">${open.length}</span>` : ''}<span class="ti-t">Réparations</span><span class="ti-s">${open.length ? open.length + ' en attente' : 'Rien à réparer'}</span></button>
      <button class="tile" data-a="go" data-k="securite"><span class="ti-ic t-red">${ico('shield')}</span>${secDueBrico().length ? `<span class="badge">${secDueBrico().length}</span>` : ''}<span class="ti-t">Sécurité</span><span class="ti-s">${secDueBrico().length ? secDueBrico().length + ' contrôle' + (secDueBrico().length > 1 ? 's' : '') + ' à faire' : 'Contrôles faits'}</span></button>
      <button class="tile" data-a="go" data-k="menage"><span class="ti-ic t-blue">${ico('menage')}</span><span class="ti-t">Ménage</span><span class="ti-s">Qui a nettoyé quoi</span></button>
      ${canReg('reg_pec') ? `<button class="tile" data-a="go" data-k="registre"><span class="ti-ic t-purple">${ico('book')}</span>${inboxTodo().length ? `<span class="badge">${inboxTodo().length}</span>` : ''}<span class="ti-t">Registre</span><span class="ti-s">${inboxTodo().length ? inboxTodo().length + ' PEC à traiter' : presentOcc().length + ' présents'}</span></button>` : ''}
      <button class="tile" data-a="convList"><span class="ti-ic t-green">${ico('chat')}</span>${un ? `<span class="badge">${un}</span>` : ''}<span class="ti-t">Messages</span><span class="ti-s">${un ? un + ' non lu' + (un > 1 ? 's' : '') : 'Tout est lu'}</span></button>
      ${canPresta() ? `<button class="tile" data-a="go" data-k="contacts"><span class="ti-ic t-brown">${ico('phone')}</span><span class="ti-t">Prestataires</span><span class="ti-s">Électriciens, alarme…</span></button>` : ''}
      <button class="tile" data-a="repNew"><span class="ti-ic t-red">${ico('plus')}</span><span class="ti-t">Nouvelle</span><span class="ti-s">réparation</span></button>
    </div></div>`;
}
// Ménage en lecture seule : l'état de chaque lieu et qui l'a nettoyé.
const myCleanings = () => Object.values(S.rooms).filter((r) => r.assignee === S.me.id && !r.blocked && (r.status === 'a_faire' || r.status === 'en_cours'));
const cleanRow = (r) => `<button class="prow" data-a="openClean" data-id="${r.id}"><span class="pr-t"><b>${esc(placeName(r))}</b><span class="muted">${esc(hotelName(r.hotel))} · ${TY[r.type] ? TY[r.type].e + ' ' + TY[r.type].l : ''}</span></span><span class="pill p-${(ST[r.status] || ST.a_faire).c}">${(ST[r.status] || ST.a_faire).l}</span></button>`;
function viewMenageRead() {
  const row = (r) => {
    const st = ST[r.status] || ST.propre;
    const pill = r.blocked ? '<span class="pill p-plain">Bloqué</span>' : `<span class="pill p-${st.c}">${st.l}</span>`;
    const sub = r.status === 'en_cours' || r.status === 'a_faire' ? (r.assignee ? 'En charge : ' + esc(first(nameOf(r.assignee))) : 'Pas encore donné') : (r.doneAt ? 'Fait ' + when(r.doneAt) + (r.doneBy ? ' par ' + esc(first(nameOf(r.doneBy))) : '') : 'Pas encore suivi');
    const open = !r.blocked && (r.status === 'a_faire' || r.status === 'en_cours');
    const btn = !open ? '' : (r.assignee === S.me.id ? `<button class="btn small pri" data-a="openClean" data-id="${r.id}">Ouvrir</button>` : `<button class="btn small soft" data-a="roomTake" data-id="${r.id}">Je prends</button>`);
    return `<div class="prow ro"><span class="pr-t"><b>${esc(placeName(r))}</b><span class="muted">${sub}</span></span>${btn || pill}</div>`;
  };
  const mine = myCleanings();
  return `${mine.length ? `<h2 class="sec">Mes nettoyages</h2><div class="group">${mine.map(cleanRow).join('')}</div>` : ''}
    ${hotelSeg()}<p class="muted">Touchez « Je prends » pour faire un nettoyage à la place de quelqu’un.</p><h2 class="sec">Chambres</h2><div class="group">${roomsOf(S.hotel).map(row).join('')}</div>
    <h2 class="sec">Parties communes</h2><div class="group">${communsOf(S.hotel).map(row).join('') || '<p class="muted" style="padding:12px">Aucune.</p>'}</div>`;
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
  return `<div class="card"><p class="muted">Seules les personnes de la conversation reçoivent la notification.</p>
      <div class="list">${groups.map(convRow).join('')}</div></div>
    ${dms.length ? `<div class="card"><h3>🔒 Privés</h3><div class="list">${dms.map(convRow).join('')}</div></div>` : ''}
    <div class="card"><h3>🧺 Équipe terrain</h3><p class="muted">Chaque conversation : la personne + tous les responsables.</p>
      ${staffC.length ? `<div class="list">${staffC.map(convRow).join('')}</div>` : '<p class="muted">Pas encore de femme de ménage ni d’intendant dans l’équipe.</p>'}</div>`;
}
function newMsgSheet() {
  const others = S.staff.filter((s) => s.active !== false && s.id !== S.me.id);
  const mgrs = others.filter((s) => isMgrRole(s.role)), cl = others.filter((s) => s.role === 'menage' || s.role === 'bricoleur');
  const btn = (c, title, sub) => `<button class="li" style="text-align:left;cursor:pointer" data-a="threadOpen" data-id="${esc(c)}"><span class="t"><b>${esc(title)}</b><br><span class="muted">${esc(sub)}</span></span></button>`;
  openSheet('newmsg', `${sheetHead('Nouveau message')}
    <div class="card"><h3>Groupes</h3><div class="list">${btn('team', '📢 Toute l’équipe', 'Tout le monde')}${isMgr() ? btn('mgrs', '👔 Responsables', 'Propriétaire et gérants seulement') : ''}</div></div>
    ${mgrs.length ? `<div class="card"><h3>🔒 Une seule personne (privé)</h3><div class="list">${mgrs.map((s) => btn(dmConv(S.me.id, s.id), s.label, ROLE_L[s.role] + ' · seulement vous deux')).join('')}</div></div>` : ''}
    ${isMgr() && cl.length ? `<div class="card"><h3>🧺 Équipe terrain</h3><div class="list">${cl.map((s) => btn('staff:' + s.id, s.label, 'Elle + tous les responsables')).join('')}${cl.map((s) => btn(dmConv(S.me.id, s.id), '🔒 ' + s.label + ' (privé)', 'Seulement vous deux')).join('')}</div></div>` : ''}`);
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
  return `${S.staff.map((s) => {
      const devs = S.devices.filter((d) => d.staff_id === s.id), owner = s.role === 'owner', canTouch = !owner || S.me.role === 'owner';
      return `<div class="card"><div class="row between"><div><h3>${esc(s.label)}</h3><span class="muted">${ROLE_L[s.role]}${s.role === 'menage' ? ' · ' + ((s.hotels || []).length >= 3 ? 'polyvalente' : (s.hotels || []).map((h) => H(h).e + ' ' + hotelName(h)).join(', ')) + ' · ' + (s.hours || 6) + ' h' : ''}${s.only_hotel ? ' · seulement ' + hotelName(s.only_hotel) : ''}</span></div><div class="chips">${personStatus(s)}</div></div>
        ${devs.length ? `<div class="list">${devs.map((d) => `<div class="li"><span class="t">📱 ${esc(d.label || 'Appareil')}<br><span class="muted">installé ${when(d.created_at)} · vu ${when(d.last_seen)}</span></span>${d.id === S.device ? '<span class="chip c-accent">Ce téléphone</span>' : (canTouch ? `<button class="btn small bad" data-a="devRevoke" data-id="${d.id}">Déconnecter</button>` : '')}</div>`).join('')}</div>` : ''}
        ${canTouch && s.active !== false ? `<div class="row"><button class="btn small soft" data-a="inviteNew" data-id="${s.id}">📲 ${devs.length ? 'Nouveau lien (nouveau téléphone)' : (s.locked ? 'Débloquer : nouveau lien' : 'Lien d’installation')}</button>
          <button class="btn small" data-a="personEdit" data-id="${s.id}">Modifier</button>${owner ? '' : `<button class="btn small ghost" data-a="personActive" data-id="${s.id}" data-v="0">Désactiver</button>`}</div>` : ''}
        ${s.role === 'bricoleur' && S.me.role === 'owner' && s.active !== false ? `<div class="perms"><p class="muted">Accès que tu lui donnes</p>${PERM_L.map(([k, l, sub]) => { const on = (s.perms || []).includes(k); return `<button class="perm" data-a="permToggle" data-id="${s.id}" data-p="${k}" aria-pressed="${on}"><span class="pr-t"><b>${l}</b><span class="muted">${sub}</span></span><span class="sw ${on ? 'on' : ''}" aria-hidden="true"><i></i></span></button>`; }).join('')}</div>` : ''}
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
      ${s && s.role === 'owner' ? '<p class="muted">Rôle : propriétaire (protégé)</p>' : `<label class="muted" for="p-role">Rôle</label><select id="p-role" data-change="pRole"><option value="menage" ${rl === 'menage' ? 'selected' : ''}>Femme de ménage</option><option value="bricoleur" ${rl === 'bricoleur' ? 'selected' : ''}>Intendant (réparations, ménage en lecture)</option><option value="gerant" ${rl === 'gerant' ? 'selected' : ''}>Gérant / associé (tous les droits)</option></select>`}
      <p id="p-brico" ${rl === 'bricoleur' ? '' : 'hidden'} class="muted">Il voit les réparations des 3 hôtels et peut les marquer réglées. Il voit qui a nettoyé quoi, sans pouvoir rien changer.</p>
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
  $('print').innerHTML = `<div class="f"><h1>🛎️ Ma Réception : ${esc(s.label)}</h1>
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
      <div class="row">${[['blanc', '🛏️ À blanc'], ['recouche', '🔄 Recouche'], ['fond', '⭐ Tâche de fond'], ['commun', '🧽 Partie commune']].map(([k, l]) => `<label class="muted" for="min-${k}">${l}</label><input id="min-${k}" type="number" min="5" max="120" step="5" value="${c.minutes[k]}" style="width:80px"><span class="muted">min</span>`).join('')}</div>
      <button class="btn small" data-a="saveMinutes">Enregistrer les temps</button></div>
    <div class="card"><h2>🛏️ Routine chambre à blanc</h2>${listEditor('tasks.blanc', c.tasks.blanc, (t) => esc(t.e) + ' ' + esc(t.l))}</div>
    <div class="card"><h2>🔄 Routine recouche</h2>${listEditor('tasks.recouche', c.tasks.recouche, (t) => esc(t.e) + ' ' + esc(t.l))}</div>
    <div class="card"><h2>🧽 Routine parties communes</h2>${listEditor('tasks.commun', c.tasks.commun, (t) => esc(t.e) + ' ' + esc(t.l))}</div>
    <div class="card"><h2>📷 Photos obligatoires</h2><p class="muted">À blanc</p>${listEditor('photos.blanc', c.photos.blanc, esc)}
      <p class="muted">Recouche</p>${listEditor('photos.recouche', c.photos.recouche, esc)}<p class="muted">Tâche de fond</p>${listEditor('photos.fond', c.photos.fond, esc)}<p class="muted">Partie commune</p>${listEditor('photos.commun', c.photos.commun, esc)}</div>
    <div class="card"><h2>⭐ Tâches de fond</h2><p class="muted">La plus en retard s’ajoute à chaque chambre à blanc. Les autres remplissent le temps libre dans Répartir.</p>
      <div class="list">${c.periodic.map((p, i) => `<div class="li"><span class="t">${esc(p.e)} ${esc(p.l)} <span class="muted">· tous les ${p.days} jours</span></span><button class="x" data-a="cfgDel" data-k="periodic" data-i="${i}" aria-label="Supprimer">✕</button></div>`).join('')}</div>
      <div class="row"><input id="add-periodic" placeholder="Ex. : 🧼 Laver la bouilloire" style="flex:1"><input id="add-periodic-d" type="number" min="1" value="30" style="width:90px" aria-label="Tous les combien de jours"><span class="muted">jours</span><button class="btn small" data-a="addPeriodic">Ajouter</button></div></div>
    <div class="card"><h2>🚪 Lieux</h2>${hotelSeg()}<h3>Chambres</h3>
      <div class="list">${rooms.map((r) => `<div class="li"><span class="t"><b>${esc(r.num)}</b>${r.blocked ? ' <span class="muted">· bloquée : ' + esc(r.blockReason || '') + '</span>' : ''}</span><button class="x" data-a="delRoom" data-id="${r.id}" aria-label="Retirer la chambre ${esc(r.num)}">✕</button></div>`).join('')}</div>
      <div class="row"><input id="add-room" placeholder="Numéro, ex. : 26" style="flex:1"><button class="btn small" data-a="addRoom">Ajouter</button></div>
      <h3>Parties communes</h3>
      <div class="list">${communsOf(S.hotel).map((r) => `<div class="li"><span class="t"><b>${esc(r.num)}</b></span><button class="x" data-a="delRoom" data-id="${r.id}" aria-label="Retirer ${esc(r.num)}">✕</button></div>`).join('') || '<p class="muted">Aucune.</p>'}</div>
      <div class="row"><input id="add-commun" placeholder="Ex. : Couloir 2e étage" style="flex:1"><button class="btn small" data-a="addCommun">Ajouter</button></div></div>
    <div class="card"><h2>👁 Voir et faire comme l’équipe</h2><p class="muted">Vous passez sur leur écran. Ce que vous y faites compte vraiment : nettoyages qui vous sont donnés, réparations.</p>
      <div class="row"><button class="btn" data-a="preview" data-k="menage">🧹 Femme de ménage</button><button class="btn" data-a="preview" data-k="brico">🔧 Intendant</button></div></div>
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
    return `<button class="job st-${r.status}" data-a="openClean" data-id="${r.id}"><span class="ph" style="background-image:${photoUrl(r.hotel)}" aria-hidden="true"></span>${isCommun(r) ? '<span class="num com" aria-hidden="true">🧽</span>' : `<span class="num">${esc(r.num)}</span>`}
      <span class="txt"><b>${isCommun(r) ? esc(r.num) : t.e + ' ' + t.l}</b><span class="muted">${esc(hotelName(r.hotel))}${r.status === 'en_cours' ? ' · en cours' : ''}${r.status === 'a_controler' ? ' · terminée ' + hm(r.doneAt) : ''}</span>${r.rejectNote ? '<span class="chip c-red">🔁 À refaire</span>' : ''}</span></button>`; };
  return `<div class="wrap">
    ${pvBar()}
    <div class="card"><div class="hero"><h1>${ge} ${gt} ${esc(first(S.me.label))}</h1><span class="day">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      ${total ? `<div class="row between"><b>${done.length} terminé${done.length > 1 ? 's' : ''} sur ${total}</b>${left ? `<span class="muted">Encore environ ${mn(left)}</span>` : ''}</div><div class="prog"><i style="width:${Math.round(100 * done.length / total)}%"></i></div>` : ''}</div>
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
  if (!r || r.assignee !== S.me.id) { S.open = null; return role() === 'brico' ? viewBrico() : viewCleanHome(); }
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
  return `<div class="wrap"><button class="btn ghost" data-a="back" style="align-self:flex-start">← Ma liste</button>
    <div class="banner-ph" style="background-image:${photoUrl(r.hotel)}">${isCommun(r) ? '' : `<span class="n">${esc(r.num)}</span>`}<div><p>${esc(hotelName(r.hotel))}</p><h2>${isCommun(r) ? '🧽 ' + esc(r.num) : t.e + ' ' + t.l}</h2></div></div>
    ${r.rejectNote ? `<div class="banner c-red">🔁 À refaire : ${esc(r.rejectNote)}</div>` : ''}
    ${ref ? `<div class="card"><h3>👀 Le modèle : fais pareil</h3><img class="big-img" alt="" src="${esc(ref)}"></div>` : ''}
    ${main}
    ${holdBtn('room:' + r.id, isCommun(r) ? 'Garde appuyé : message sur ce lieu' : 'Garde appuyé : message sur cette chambre', 'big soft')}
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
  else if (S.sheet.startsWith('occ:') && S.sheet.length > 4 && !isTyping()) occSheet(S.sheet.slice(4));
  else if (S.sheet.startsWith('sec:') && !isTyping()) secSheet(S.sheet.slice(4));
  else if (S.sheet.startsWith('proj:') && !isTyping()) projSheet(S.sheet.slice(5));
}
const sheetHead = (t) => `<div class="row between"><h2>${t}</h2><button class="btn small" data-a="close">Fermer</button></div>`;
function roomSheet(id) {
  const r = S.rooms[id]; if (!r) { closeSheet(); return; }
  const st = ST[r.status] || ST.propre, j = r.lastJob, c = cfg(), ref = mediaUrl(r.refPhoto);
  const com = isCommun(r);
  openSheet('room:' + id, `<div class="banner-ph" style="background-image:${photoUrl(r.hotel)};min-height:110px">${com ? '' : `<span class="n">${esc(r.num)}</span>`}<div><p>${esc(hotelName(r.hotel))}</p>${com ? `<h2>${esc(r.num)}</h2>` : ''}</div></div>
    ${sheetHead(esc(placeName(r)))}
    ${com ? `<div class="card"><h3>🗓️ Fréquence de nettoyage</h3><select data-change="freq" data-id="${r.id}" aria-label="Fréquence"><option value="">Pas de fréquence</option>${FREQS.map(([v, l]) => `<option value="${v}" ${r.freq === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <p class="muted">${r.doneAt ? 'Dernier nettoyage ' + when(r.doneAt) + (r.doneBy ? ' par ' + esc(first(nameOf(r.doneBy))) : '') : 'Jamais nettoyé dans l’appli.'}</p></div>` : ''}
    <div class="chips"><span class="chip c-${st.c}">${com && r.status === 'propre' ? 'Propre' : st.l}</span>${r.type && TY[r.type] && r.status !== 'propre' ? `<span class="chip c-plain">${TY[r.type].e} ${TY[r.type].l}</span>` : ''}${r.status !== 'propre' ? `<span class="chip c-plain">👤 ${r.assignee ? esc(nameOf(r.assignee)) : 'à répartir'}</span>` : ''}</div>
    ${r.blocked ? `<div class="banner c-amber">⛔ Bloqué : ${esc(r.blockReason || 'sans raison')}</div><button class="btn" data-a="unblockOne" data-id="${r.id}">🔓 Débloquer</button>` : `<button class="btn" data-a="blockOne" data-id="${r.id}">⛔ Bloquer ${com ? 'ce lieu' : 'cette chambre'}</button>`}
    ${r.rejectNote && r.status !== 'propre' ? `<div class="banner c-red">🔁 À refaire : ${esc(r.rejectNote)}</div>` : ''}
    ${j ? `<div class="card"><h3>Dernier ménage</h3><p class="muted">${esc(nameOf(j.uid))} · ${when(j.start)} → ${hm(j.end)} · ${dur((j.end || 0) - (j.start || 0))}</p>${jobPhotos(j)}
      ${r.status === 'a_controler' ? `<div class="row"><button class="btn ok" data-a="validate" data-id="${r.id}">✓ Valider</button><button class="btn bad" data-a="redo" data-id="${r.id}">🔁 À refaire</button></div>` : ''}</div>` : ''}
    <div class="card"><h3>👀 Photo modèle</h3><p class="muted">La femme de ménage la voit avant de commencer.</p>${ref ? `<img class="big-img" alt="" src="${esc(ref)}">` : ''}
      <button class="btn soft" data-a="refPhoto" data-id="${r.id}">📷 ${r.refPhoto ? 'Changer' : 'Ajouter'} la photo modèle</button></div>
    <div class="card"><h3>📌 Tâches en plus pour ${com ? 'ce lieu' : 'cette chambre'}</h3>
      <div class="list">${(r.extras || []).map((t, i) => `<div class="li"><span class="t">${esc(t)}</span><button class="x" data-a="delExtra" data-id="${r.id}" data-i="${i}" aria-label="Supprimer">✕</button></div>`).join('') || '<p class="muted">Aucune.</p>'}</div>
      <div class="row"><input id="extra-in" placeholder="Ex. : surveiller l’humidité de la fenêtre" style="flex:1"><button class="btn small" data-a="addExtra" data-id="${r.id}">Ajouter</button></div></div>
    ${com ? '' : `<div class="card"><h3>⭐ Tâches de fond</h3><div class="list">${c.periodic.map((p) => { const d = (r.periodicDone || {})[p.id], late = !d || Date.now() - d > p.days * 864e5;
      return `<div class="li"><span class="t">${esc(p.e)} ${esc(p.l)}</span><span class="chip ${late ? 'c-amber' : 'c-green'}">${d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'jamais'}</span></div>`; }).join('')}</div></div>`}`);
}
function blockSheet(ids) {
  S.rep = { blockIds: ids };
  openSheet('block', `${sheetHead('Bloquer')}<p>Chambre${ids.length > 1 ? 's' : ''} ${ids.map((i) => esc(S.rooms[i].num)).join(', ')} : on ne la donne plus à faire et elle ne doit pas être louée.</p>
    <div class="kinds">${REASONS.map(([r, e]) => `<button data-a="blockGo" data-r="${esc(r)}"><span class="e">${e}</span>${esc(r)}</button>`).join('')}</div>
    <div class="row"><input id="block-other" placeholder="Autre raison" style="flex:1"><button class="btn" data-a="blockGo">Bloquer</button></div>`);
}
function drawRedo() {
  const r = S.rooms[S.rep.redo];
  openSheet('redo', `${sheetHead('À refaire · ' + esc(placeShort(r)))}<p class="muted">Ce qui ne va pas :</p>
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
const r0 = (p) => Object.values(S.rooms).find((x) => x.hotel === p.hotel && x.num === p.room) || { num: p.room };
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
    ${p.fixedRoom ? `<p><b>${H(p.hotel).e} ${esc(hotelName(p.hotel))} · ${esc(placeName(r0(p)))}</b></p>` : `<div class="row">
      <select id="rep-hotel" data-change="repHotel" aria-label="Hôtel">${myHotels().map((h) => `<option value="${h}" ${p.hotel === h ? 'selected' : ''}>${H(h).e} ${esc(hotelName(h))}</option>`).join('')}</select>
      <select id="rep-room" data-change="repRoom" aria-label="Chambre"><option value="">Autre endroit</option>${rooms.map((x) => `<option value="${esc(x.num)}" ${p.room === x.num ? 'selected' : ''}>Chambre ${esc(x.num)}</option>`).join('')}${communsOf(p.hotel).map((x) => `<option value="${esc(x.num)}" ${p.room === x.num ? 'selected' : ''}>${esc(x.num)}</option>`).join('')}</select></div>`}
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
  tab(d) { if (['rooms', 'plan', 'check'].includes(d.k)) { A.go({ k: 'menage', s: d.k }); return; } A.go({ k: d.k }); },
  go(d) {
    if (d.k === 'menage' && S.scope !== 'all') { S.hotel = S.scope; LS.set('mh-hotel', S.hotel); }
    if (d.k === 'menage') { S.sub = d.s || 'rooms'; if (S.sub !== 'plan') S.proposal = null; }
    if (d.k === 'projets' && d.s) S.psub = d.s;
    S.tab = d.k; S.sel.clear(); render(); window.scrollTo(0, 0);
  },
  home() { S.tab = 'home'; S.sel.clear(); render(); window.scrollTo(0, 0); },
  sub(d) { S.sub = d.k; S.sel.clear(); if (d.k !== 'plan') S.proposal = null; render(); window.scrollTo(0, 0); },
  scope(d) { S.scope = d.k; LS.set('mh-scope', d.k); render(); },
  rsub(d) { S.rsub = d.k; render(); window.scrollTo(0, 0); },
  rSortis() { S.rSortis = !S.rSortis; render(); },
  rDone() { S.rDone = !S.rDone; render(); },
  regRoom(d) { const os = occOfRoom(d.id); if (os.length === 1) occSheet(os[0].id); else if (!os.length) { if (canReg('reg_full')) occSheet(null, { hotel: S.rooms[d.id].hotel, room_id: d.id }); } else openSheet('roomocc', `${sheetHead(esc(placeName(S.rooms[d.id])))}<div class="group">${os.map((o) => `<button class="prow" data-a="occOpen" data-id="${o.id}"><span class="pr-t">${occLine(o)}</span></button>`).join('')}</div>${canReg('reg_full') ? `<button class="btn" data-a="occNewRoom" data-id="${d.id}">＋ Ajouter quelqu’un dans cette chambre</button>` : ''}`); },
  occNew() { occSheet(null, { hotel: S.scope !== 'all' ? S.scope : S.hotel }); },
  occNewRoom(d) { occSheet(null, { hotel: S.rooms[d.id].hotel, room_id: d.id }); },
  occOpen(d) { occSheet(d.id); },
  async occSave(d) {
    const v = (id) => ($(id) && $(id).value || '').trim();
    const body = { id: d.id || undefined, prenom: v('o-prenom'), nom: v('o-nom'), naissance: v('o-naissance'), categorie: v('o-cat'), hotel: v('o-hotel'), room_id: v('o-room') || null, entree: v('o-entree'), telephone: v('o-tel'), notes: v('o-notes'), raison: v('o-raison') };
    if (!body.nom && !body.prenom) { toast('Écris au moins un nom.'); return; }
    if (!d.id && !body.raison) { toast('Indique pourquoi (ex. : arrivée envoyée par l’ASE).'); return; }
    let id = d.id; if (await act(async () => { const r = await api('reg_occ_save', body); id = r.id; }, d.id ? 'Fiche enregistrée' : 'Ajouté au registre')) occSheet(id);
  },
  occExit(d) { exitSheet(d.id); },
  async exitGo(d) {
    const raison = ($('x-raison').value || '').trim(); if (!raison) { toast('Indique la raison du départ.'); return; }
    const clean = $('x-clean') ? $('x-clean').checked : false;
    let res = null; if (await act(async () => { res = await api('reg_occ_exit', { id: d.id, sortie: $('x-date').value, raison, clean }); }, 'Départ enregistré')) { closeSheet(); if (res && res.blanc) toast('Départ enregistré · chambre mise à blanc, à répartir'); }
  },
  async occReturn(d) { if (await act(() => api('reg_occ_return', { id: d.id, raison: 'Départ annulé' }), 'Départ annulé')) occSheet(d.id); },
  pecNew(d) { pecSheet(d.id, null); },
  pecOpen(d) { const p = S.reg.pecs.find((x) => x.id === d.id); pecSheet(p.occupant_id, d.id); },
  async pecSave(d) {
    const v = (id) => ($(id) && $(id).value || '').trim();
    const body = { id: d.id || undefined, occupant_id: d.occ, financeur: v('p-fin'), reference: v('p-ref'), debut: v('p-debut'), fin: v('p-finD'), tarif: v('p-tarif'), repas: v('p-repas'), notes: v('p-notes'), raison: v('p-raison') };
    if (body.debut && body.fin && body.fin < body.debut) { toast('La fin est avant le début.'); return; }
    if (await act(() => api('reg_pec_save', body), 'Prise en charge enregistrée')) occSheet(d.occ);
  },
  async pecDel(d) {
    const raison = ($('p-raison').value || '').trim(); if (!raison) { toast('Écris d’abord pourquoi tu la supprimes.'); return; }
    if (S.confirmPec !== d.id) { S.confirmPec = d.id; toast('Touche encore « Supprimer » pour confirmer.'); setTimeout(() => S.confirmPec = null, 5000); return; }
    if (await act(() => api('reg_pec_delete', { id: d.id, raison }), 'Supprimée')) occSheet(d.occ);
  },
  inApply(d) { applySheet(d.id); },
  async permToggle(d) {
    const s = staffById(d.id); let perms = (s.perms || []).slice();
    perms = perms.includes(d.p) ? perms.filter((x) => x !== d.p) : [...perms, d.p];
    if (d.p === 'reg_full' && perms.includes('reg_full') && !perms.includes('reg_pec')) perms.push('reg_pec');
    if (d.p === 'reg_pec' && !perms.includes('reg_pec')) perms = perms.filter((x) => x !== 'reg_full');
    await act(() => api('staff_perms', { id: d.id, perms }), perms.length > (s.perms || []).length ? 'Accès donné' : 'Accès repris');
  },
  async applyGo(d) {
    const body = { id: d.id };
    if (d.m === 'exist') { body.occupant_id = $('a-occ').value; if (!body.occupant_id) { toast('Choisis la personne.'); return; } }
    else { body.hotel = $('a-hotel').value; body.room_id = $('a-room').value || null; body.entree = $('a-entree').value; }
    let id = null; if (await act(async () => { id = (await api('reg_inbox_apply', body)).id; }, 'Prise en charge appliquée')) occSheet(id);
  },
  inDiscard(d) { discardSheet(d.id); },
  async docOpen(d, el) {
    if (el) { el.disabled = true; el.textContent = '⏳ ' + d.n; }
    try {
      const r = await api('doc_get', { id: d.id });
      const bin = atob(r.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      S.docUrls[d.id] = URL.createObjectURL(new Blob([u8], { type: r.type || 'application/pdf' }));
      if (el) { const a = document.createElement('div'); a.innerHTML = docLink({ id: d.id, name: d.n }); const link = a.firstChild; el.replaceWith(link); try { link.click(); } catch (e) { /* l'utilisateur touchera le lien */ } }
    } catch (e) { toast(errMsg(e)); if (el) { el.disabled = false; el.textContent = '📄 ' + d.n; } }
  },
  async discardGo(d) { const note = ($('d-note').value || '').trim(); if (!note) { toast('Indique pourquoi.'); return; } if (await act(() => api('reg_inbox_set', { id: d.id, status: 'ecarte', note }), 'Écartée')) closeSheet(); },
  async inReopen(d) { await act(() => api('reg_inbox_set', { id: d.id, status: 'a_traiter', note: null, raison: 'Rouverte' }), 'Rouverte'); },
  soon(d) { toast(`${SECTIONS[d.k].t} arrive à l’${SECTIONS[d.k].soon.toLowerCase()}.`); },
  async lateGo(d) { const ids = d.ids.split(','); await act(() => roomsPatch(ids, { type: 'commun', status: 'a_faire', assignee: null, rejectNote: null, startedAt: null, fondTasks: null }), `${ids.length} à répartir`); },
  hotel(d) { S.hotel = d.k; S.sel.clear(); document.body.dataset.hotel = d.k; LS.set('mh-hotel', d.k); render(); },
  pick(d) { S.sel.has(d.id) ? S.sel.delete(d.id) : S.sel.add(d.id); render(); },
  clearSel() { S.sel.clear(); render(); },
  async assign(d) {
    if (!S.assignTo) { toast('Choisis d’abord pour qui, ou « À répartir plus tard ».'); return; }
    const who = S.assignTo === '__none' ? null : S.assignTo, ids = [...S.sel].filter((i) => !S.rooms[i].blocked && (d.t === 'commun') === isCommun(S.rooms[i])), skipped = S.sel.size - ids.length;
    if (!ids.length) { toast('Rien à donner : vérifie la sélection.'); return; }
    if (await act(() => roomsPatch(ids, { type: d.t, status: 'a_faire', assignee: who, rejectNote: null, startedAt: null, fondTasks: null }),
      `${ids.length} lieu${ids.length > 1 ? 'x' : ''} · ${TY[d.t].l.toLowerCase()} ${who ? 'pour ' + first(nameOf(who)) : 'à répartir'}${skipped ? ` · ${skipped} non concerné(s)` : ''}`)) { S.sel.clear(); S.assignTo = ''; render(); }
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
  /* projets et tâches */
  mtToggle() { S.mtOpen = !S.mtOpen; LS.set('mh-mt', S.mtOpen); render(); },
  psub(d) { S.psub = d.k; render(); window.scrollTo(0, 0); },
  tf(d) { S.tf = d.k; render(); },
  pFin() { S.pFin = !S.pFin; render(); },
  pDone() { S.pDone = !S.pDone; refreshSheet(); },
  projOpen(d) { projSheet(d.id); },
  projNew() { projForm(null); },
  projEdit(d) { projForm(d.id); },
  async projStatut(d) { if (await act(() => api('proj_save', { id: d.id, statut: d.k }), PST[d.k].l)) projSheet(d.id); },
  async projSave(d) {
    const v = (x) => ($(x) ? $(x).value.trim() : '');
    const body = { id: d.id || undefined, title: v('pf-title'), emoji: v('pf-emoji'), hotel: v('pf-hotel') || null, statut: v('pf-statut'), resume: v('pf-resume'), body: $('pf-body') ? $('pf-body').value : '', contact_ids: [...document.querySelectorAll('.pf-ct:checked')].map((x) => x.value) };
    if (!body.title) { toast('Donne un nom au projet.'); return; }
    let nid = d.id; if (await act(async () => { nid = (await api('proj_save', body)).id; }, 'Enregistré')) projSheet(nid);
  },
  async projDel(d) { if (!S.confirmDel) { S.confirmDel = d.id; toast('Touche encore : le projet est supprimé, ses tâches restent sans projet.'); setTimeout(() => S.confirmDel = null, 4000); return; } S.confirmDel = null; if (await act(() => api('proj_delete', { id: d.id }), 'Projet supprimé')) closeSheet(); },
  taskNew(d) { taskForm(null, d && d.id ? { project_id: d.id } : {}); },
  taskOpen(d) { taskForm(d.id); },
  async taskTick(d) { const t = S.tasks.find((x) => x.id === d.id); if (!t) return; const etat = tOpen(t) ? 'fait' : 'a_faire'; t.etat = etat; t.done_at = etat === 'fait' ? new Date().toISOString() : null; render(); refreshSheet(); await act(() => api('task_save', { id: d.id, etat }), etat === 'fait' ? 'Fait ✓' : 'Rouverte'); },
  async taskEtat(d) { if (await act(() => api('task_save', { id: d.id, etat: d.k }), TST[d.k].l)) taskForm(d.id); },
  async taskSave(d) {
    const v = (x) => ($(x) ? $(x).value.trim() : '');
    const body = { id: d.id || undefined, title: v('tf-title'), project_id: v('tf-proj') || null, owner: v('tf-owner') || null, due: v('tf-due') || null, prio: v('tf-prio'), note: v('tf-note') };
    if (!body.title) { toast('Écris la tâche.'); return; }
    const owner = body.owner && body.owner !== S.me.id ? first(nameOf(body.owner)) : '';
    if (await act(() => api('task_save', body), d.id ? 'Enregistré' : (owner ? `Tâche créée, ${owner} est prévenu(e)` : 'Tâche créée'))) { if (d.p) projSheet(d.p); else closeSheet(); }
  },
  async taskDel(d) { if (!S.confirmDel) { S.confirmDel = d.id; toast('Touche encore pour supprimer la tâche.'); setTimeout(() => S.confirmDel = null, 4000); return; } S.confirmDel = null; if (await act(() => api('task_delete', { id: d.id }), 'Supprimée')) closeSheet(); },
  /* sécurité */
  secOpen(d) { S.sl = null; secSheet(d.id); },
  secDossier(d) { secDossier(d.k); },
  secLogNew(d) { S.sl = null; secLogForm(d.id, d.k); },
  secEdit(d) { secEditForm(d.id); },
  secAdd() { secEditForm(null); },
  async secDone(d) {
    let photos = [];
    if (d.k === 'photo') { toast('Ouvre l’appareil photo…'); const p = await takePhoto(null, false); if (!p) return; photos = [p]; }
    if (await act(() => api('sec_log', { id: d.id, result: 'ok', photos }), 'Noté ✓')) secSheet(d.id);
  },
  async slPhoto() { const p = await takePhoto(null, false); if (p && S.sl) { S.sl.photos.push(p); keepForm(() => secLogForm(S.sl.id)); } },
  async slDoc() {
    const f = await pickFile('application/pdf,image/*'); if (!f || !S.sl) return;
    if (f.size > 20 * 1024 * 1024) { toast('Fichier trop lourd (20 Mo maximum).'); return; }
    toast('Envoi du fichier…', 8000);
    try { const pdf = /pdf/.test(f.type) || /\.pdf$/i.test(f.name); const path = pdf ? await upload(f, 'application/pdf', 'pdf') : await upload(await shrink(f), 'image/jpeg', 'jpg'); S.sl.docs.push({ path, name: f.name || 'Document' }); toast('Fichier joint ✓'); keepForm(() => secLogForm(S.sl.id)); }
    catch (e) { toast('Le fichier n’a pas pu partir. Réessaie.'); }
  },
  async slSave(d) {
    const v = (x) => ($(x) ? $(x).value.trim() : ''); const r = v('sl-res') || 'ok';
    const body = { id: d.id, done_on: v('sl-date'), by_label: v('sl-by') || undefined, result: r === 'ok' ? 'ok' : 'obs', obs_state: r === 'obs_l' ? 'levees' : 'a_lever', note: v('sl-note'), docs: S.sl ? S.sl.docs : [], photos: S.sl ? S.sl.photos : [] };
    if (body.result === 'obs' && !body.note && !body.docs.length) { toast('Écris ce qui ne va pas, ou joins le rapport.'); return; }
    if (await act(() => api('sec_log', body), 'Enregistré ✓')) { S.sl = null; secSheet(d.id); }
  },
  async secObs(d) { if (await act(() => api('sec_obs', { id: d.id, obs: d.k }), 'Observations levées ✓')) secSheet(d.id); },
  async secDocState(d) { if (await act(() => api('sec_save', { id: d.id, doc_state: d.k || null }), 'Enregistré')) secSheet(d.id); },
  async secNa(d) { const c = secChecks().find((x) => x.id === d.id); if (await act(() => api('sec_save', { id: d.id, status: c.status === 'na' ? 'actif' : 'na' }), 'Enregistré')) secSheet(d.id); },
  async secSave(d) {
    const v = (x) => ($(x) ? $(x).value.trim() : null), body = { label: v('se-label'), note: v('se-note') };
    if ($('se-freq')) { body.freq_months = v('se-freq') || null; body.next_due = v('se-next') || null; body.next_note = v('se-nnote'); }
    if ($('se-prov')) { body.provider = v('se-prov'); body.contact_id = v('se-ct') || null; }
    if ($('se-who')) body.who = v('se-who');
    if (!body.label) { toast('Indique un nom.'); return; }
    let nid = d.id;
    if (d.id) { if (await act(() => api('sec_save', { id: d.id, ...body }), 'Enregistré')) secSheet(d.id); return; }
    body.hotel = S.hotel; body.grp = v('se-grp'); if (body.grp !== 'interne') body.who = 'gerant';
    if (await act(async () => { nid = (await api('sec_add', body)).id; }, 'Ajouté')) secSheet(nid);
  },
  async secLogDel(d) { if (!S.confirmDel) { S.confirmDel = d.l; toast('Touche encore pour effacer cette ligne.'); setTimeout(() => S.confirmDel = null, 4000); return; } S.confirmDel = null; if (await act(() => api('sec_log_delete', { id: d.id, log: d.l }), 'Effacé')) secSheet(d.id); },
  async secDel(d) { if (!S.confirmDel) { S.confirmDel = d.id; toast('Touche encore pour supprimer.'); setTimeout(() => S.confirmDel = null, 4000); return; } S.confirmDel = null; if (await act(() => api('sec_delete', { id: d.id }), 'Supprimé')) closeSheet(); },
  secRep(d) { const c = secChecks().find((x) => x.id === d.id); S.rfPhoto = null; repForm(null, { hotel: c.hotel, title: 'Lever les observations : ' + c.label.toLowerCase(), origin: /dekra/i.test(c.provider || '') ? 'dekra' : (c.grp === 'commission' ? 'commission' : 'entretien'), priority: 'urgent' }); },
  /* problèmes */
  repFilter(d) { S.rf = d.k; render(); },
  repOpen(d) { repSheet(d.id); },
  repNew() { S.rfPhoto = null; repForm(null); },
  repEdit(d) { repForm(d.id); },
  async repFormPhoto() { const p = await takePhoto(null, false); if (p) { S.rfPhoto = p; const t = $('rf-title'); const keep = t ? t.value : ''; toast('Photo ajoutée ✓'); const b = document.querySelector('[data-a="repFormPhoto"]'); if (b) b.textContent = '✅ Photo ajoutée'; if (t) t.value = keep; } },
  async repSave(d) {
    const v = (x) => ($(x) ? $(x).value.trim() : '');
    const body = { id: d.id || undefined, title: v('rf-title'), hotel: v('rf-hotel'), room: v('rf-room'), priority: v('rf-prio'), due: v('rf-due'), origin: v('rf-orig'), parts: v('rf-parts'), details: v('rf-details'), photo: d.id ? undefined : S.rfPhoto };
    if (!body.title) { toast('Écris ce qu’il faut faire.'); return; }
    let newId = d.id;
    const ok = await act(async () => { const r = await api('repair_save', body); newId = r.id; }, d.id ? 'Enregistré' : 'Réparation créée');
    if (ok) { S.rfPhoto = null; if (newId) repSheet(newId); else closeSheet(); }
  },
  async repEtat(d) { if (await act(() => api('repair_etat', { id: d.id, etat: d.k }), RST[d.k].l)) repSheet(d.id); },
  async repDone(d) { toast('Ouvre l’appareil photo…'); const p = await takePhoto(null, false); if (await act(() => api('repair_etat', { id: d.id, etat: 'fait', photo: p || undefined }), p ? 'Fait, avec la photo ✓' : 'Marqué fait')) repSheet(d.id); },
  async repPhoto(d) { const p = await takePhoto(null, false); if (p && await act(() => api('repair_photo', { id: d.id, photo: p }), 'Photo ajoutée ✓')) repSheet(d.id); },
  async repNote(d) { const t = ($('rn-text').value || '').trim(); if (!t) return; if (await act(() => api('repair_note', { id: d.id, text: t }), 'Envoyé')) repSheet(d.id); },
  async repDel(d) { if (!S.confirmDel) { S.confirmDel = d.id; toast('Touche encore pour supprimer définitivement.'); setTimeout(() => S.confirmDel = null, 4000); return; } S.confirmDel = null; if (await act(() => api('repair_delete', { id: d.id }), 'Supprimée')) closeSheet(); },
  ctOpen(d) { ctSheet(d.id); },
  ctNew() { ctForm(null); },
  ctEdit(d) { ctForm(d.id); },
  async ctSave(d) {
    const v = (x) => ($(x) ? $(x).value.trim() : '');
    const body = { id: d.id || undefined, nom: v('cf-nom'), societe: v('cf-soc'), role: v('cf-role'), telephone: v('cf-tel'), email: v('cf-mail'), adresse: v('cf-adr'), categorie: v('cf-cat'), statut: v('cf-st'), notes: v('cf-notes'), hotels: [...document.querySelectorAll('.cf-h:checked')].map((x) => x.value) };
    if (!body.nom) { toast('Indique un nom.'); return; }
    let nid = d.id; if (await act(async () => { const r = await api('contact_save', body); nid = r.id; }, 'Enregistré')) ctSheet(nid);
  },
  async ctDel(d) { if (!S.confirmDel) { S.confirmDel = d.id; toast('Touche encore pour supprimer ce contact.'); setTimeout(() => S.confirmDel = null, 4000); return; } S.confirmDel = null; if (await act(() => api('contact_delete', { id: d.id }), 'Supprimé')) closeSheet(); },
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
  async invShare() { const L = S.lastInvite; try { await navigator.share({ title: 'Ma Réception', text: 'Ton lien pour installer l’appli Ma Réception :', url: L.url }); } catch (e) {} },
  async invCopy() { const L = S.lastInvite; try { await navigator.clipboard.writeText(L.url); toast('Lien copié'); } catch (e) { prompt('Copie ce lien :', L.url); } },
  invPrint() { printFiche(); },
  async devRevoke(d) {
    if (S.confirmDev !== d.id) { S.confirmDev = d.id; toast('Touche encore « Déconnecter » pour confirmer.'); setTimeout(() => S.confirmDev = null, 5000); return; }
    await act(() => api('device_revoke', { id: d.id }), 'Téléphone déconnecté');
  },
  async stats() { try { const r = await api('stats'); S.stats = r.jobs || []; render(); } catch (e) { toast(errMsg(e)); } },
  /* réglages */
  async saveMinutes() { const c = JSON.parse(JSON.stringify(cfg())); ['blanc', 'recouche', 'fond', 'commun'].forEach((k) => { const v = parseInt($('min-' + k).value, 10); if (v > 0) c.minutes[k] = v; }); await saveCfg(c); },
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
  async addCommun() { const num = ($('add-commun').value || '').trim(); if (!num) return; await act(() => api('room_create', { hotel: S.hotel, num, kind: 'commun', freq_days: 7 }), num + ' ajouté'); },
  async delRoom(d) {
    const r = S.rooms[d.id];
    if (S.confirmDel !== d.id) { S.confirmDel = d.id; toast('Touche ✕ encore une fois pour retirer : ' + placeName(r) + '.'); setTimeout(() => S.confirmDel = null, 5000); return; }
    await act(() => api('room_delete', { id: d.id }), placeName(r) + ' : retiré');
  },
  preview(d) { S.preview = d && d.k === 'brico' ? 'brico' : 'menage'; S.tab = 'home'; S.open = null; closeSheet(); render(); window.scrollTo(0, 0); },
  unpreview() { S.preview = false; S.tab = 'home'; S.open = null; render(); window.scrollTo(0, 0); },
  async roomTake(d) { const r = S.rooms[d.id]; const ok = await act(() => api('room_take', { id: d.id }), r && r.assignee ? 'Repris, c’est à vous' : 'C’est à vous'); if (ok) { S.open = d.id; render(); window.scrollTo(0, 0); } },
  /* ménage */
  openClean(d) { S.open = d.id; render(); window.scrollTo(0, 0); },
  back() { S.open = null; render(); window.scrollTo(0, 0); },
  async start(d) { await act(() => api('room_start', { id: d.id })); },
  chk(d) { const w = workOf(S.open); w.checks[d.k] = !w.checks[d.k]; saveWork(); render(); },
  async shoot(d) {
    const r = S.rooms[S.open], l = d.l; S.busy[l] = true; render();
    const label = `${placeShort(r)} · ${hotelName(r.hotel)} · ${l} · ${first(S.me.label)} · ${new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
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
    openSheet('yay', `<div class="celebrate"><div class="e">${left ? '👏' : '🎉'}</div><h1>Bravo !</h1><p style="font-size:19px">${esc(placeName(r))} : terminé.</p>
      <p class="muted">${left ? `Encore ${left} à faire.` : 'Tu as tout fini.'}</p></div><button class="btn big pri" data-a="close">${left ? 'Suivant' : 'Fermer'}</button>`);
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
  oHotel(el) { $('o-room').innerHTML = roomOpts(el.value, ''); },
  aHotel(el) { $('a-room').innerHTML = roomOpts(el.value, ''); },
  async freq(el) { await act(() => roomsPatch([el.dataset.id], { freqDays: parseInt(el.value, 10) || null }), 'Fréquence enregistrée'); },
  repHotel(el) { S.rep.hotel = el.value; S.rep.room = ''; drawReport(); },
  repRoom(el) { S.rep.room = el.value; },
  pRole(el) { $('p-menage').hidden = el.value !== 'menage'; $('p-gerant').hidden = el.value !== 'gerant'; $('p-brico').hidden = el.value !== 'bricoleur'; },
  async hours(el) { const av = { ...(S.plan.avail || {}) }; av[el.dataset.id] = Math.max(0.5, Math.min(12, parseFloat(el.value) || 0)); S.plan.avail = av; S.proposal = null; await act(() => api('plan_set', { avail: av })); },
  mvRoom(el) { const id = el.dataset.id; S.proposal.left = S.proposal.left.filter((i) => i !== id); if (el.value) S.proposal.assign[id] = el.value; else { delete S.proposal.assign[id]; S.proposal.left.push(id); } render(); },
  mvFond(el) { const i = +el.dataset.i; if (el.value) S.proposal.fond[i].uid = el.value; else S.proposal.fond.splice(i, 1); render(); },
};
const I = {
  repText(el) { if (S.rep && S.rep.items && S.rep.items[el.dataset.k]) S.rep.items[el.dataset.k].text = el.value; },
  redoText(el) { if (S.rep) S.rep.text = el.value; },
  ctQ(el) { S.cq = el.value; const pos = el.selectionStart; render(); const n = $('ctQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } },
  regQ(el) { S.rq = el.value; const pos = el.selectionStart; render(); const n = $('regQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } },
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
