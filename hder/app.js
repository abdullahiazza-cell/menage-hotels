(function () {
const { useState, useEffect, useRef } = React;
const html = htm.bind(React.createElement);
const DATA = window.HDER_DATA;

/* ---------- Contenu ---------- */
const KIT = DATA.kit, SCENE = DATA.scene, EXTRA = DATA.extra, VOICES = DATA.voices;
const BYID = {};
KIT.forEach(p => { BYID[p.id] = { ...p, kind: 'kit' }; });
EXTRA.forEach(p => { BYID[p.id] = { ...p, kind: 'kit' }; });
SCENE.forEach(l => { BYID[l.id] = { ...l, kind: 'line', hero: l.role === 'cl', sid: 'hanout' }; });
(DATA.scenes || []).forEach(s => s.manches.forEach(M => M.lines.forEach(l => { BYID[l.id] = { ...l, kind: 'line', hero: l.role === s.hero, sid: s.id }; })));
const POL = DATA.pol || [], VOCAB = DATA.vocab || [];
POL.forEach(p => { ['a', 'b'].forEach(k => { const spk = k === 'a' ? p.first : (p.first === 'them' ? 'you' : 'them'); BYID[p.id + k] = { id: p.id + k, kind: 'pol', spk, fr: p[k].fr, m: p[k].m, f: p[k].f, pair: p.id }; }); });
VOCAB.forEach(c => c.words.forEach(w => { BYID[w.id] = { ...w, kind: 'kit', cat: c.cat }; }));
const POL_YOU = POL.map(p => p.first === 'them' ? p.id + 'b' : p.id + 'a');
const WORDS = VOCAB.reduce((a, c) => a.concat(c.words), []);
const clipOf = (id, g) => { const p = BYID[id]; if (!p) return id; if (p.kind === 'kit' || p.kind === 'pol' || p.hero || p.var) return id + '-' + g; return id; };
const textOf = (id, g) => { const p = BYID[id]; if (p.kind === 'pol') return { ...p, lat: p[g].lat }; return (p.var && g === 'f') ? { ...p, lat: p.var.lat, fr: p.var.fr } : p; };
const other = g => g === 'm' ? 'f' : 'm';

const LEVELS = [
  { xp: 0, name: 'Recrue', season: "L'entraînement" },
  { xp: 100, name: 'Bandeau rouge', season: "L'entraînement" },
  { xp: 250, name: "Footing à l'aube", season: "L'entraînement" },
  { xp: 500, name: 'Disciple', season: 'Le dojo du vieux maître' },
  { xp: 800, name: 'Œil du tigre', season: 'Le dojo du vieux maître' },
  { xp: 1200, name: 'Gants dorés', season: 'Le dojo du vieux maître' },
  { xp: 1700, name: 'Aura bleue', season: 'La transformation' },
  { xp: 2300, name: 'Puissance ×10', season: 'La transformation' },
  { xp: 3000, name: 'Aura dorée', season: 'La transformation' },
  { xp: 4000, name: 'Champion du ring', season: 'La légende' },
  { xp: 5200, name: 'Légende de la médina', season: 'La légende' },
  { xp: 6500, name: 'M3allem', season: 'La légende' }
];
const lvlOf = xp => { let i = 0; LEVELS.forEach((l, k) => { if (xp >= l.xp) i = k; }); return i; };

const AV = {
  boxeur: { name: 'Le Boxeur', c: 'var(--warm)', d: 'M15 22.5C15 16 19.6 11 25.6 11c5.9 0 9.4 3.9 9.4 9v6.7c0 5.3-3.8 8.3-8.6 8.3h-3.6c-4.9 0-7.8-3.2-7.8-7.6zM9.5 27.5a4 4.5 0 1 0 8 0a4 4.5 0 1 0-8 0zM16 37.5h16V42H16z' },
  commando: { name: 'Le Commando', c: 'var(--ink-2)', d: 'M24 13a10.5 10.5 0 1 1 0 21a10.5 10.5 0 1 1 0-21zM9 17.5h30v5H9zM37.5 18l7.5 2.5-6 5.5z' },
  aura: { name: "Le Guerrier à l'aura", c: 'var(--gold)', d: 'M24 5c3.2 6.4 11 10.3 11 20.2a11 11 0 0 1-22 0c0-5.4 2.6-8.7 5.4-11.3.5 3.8 2.4 5.8 4.7 5.8-1.9-4.9-1.4-9.8.9-14.7z' },
  aerobic: { name: "La Reine de l'aérobic", c: 'var(--accent)', d: 'M24 6.5l5.1 10.4 11.4 1.6-8.3 8 2 11.3L24 32.4l-10.2 5.4 2-11.3-8.3-8 11.4-1.6z' },
  roller: { name: 'La Star du roller', c: 'var(--accent-2)', d: 'M13 9h9.5v13.5l11.8 2.9c2.9.7 3.9 2.6 3.9 4.9V33H13zM17.5 42a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM32.5 42a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z' },
  maitre: { name: 'Le Vieux maître', c: 'var(--ink)', d: 'M16.5 19h15l2.6 14.5c.4 2.6-1.4 4.5-4 4.5H17.9c-2.6 0-4.4-1.9-4-4.5zM20.5 12.5h7l1.2 4.5h-9.4zM34 23.5l8.5-6.5-2.2 10.5-5.3 3.4zM12.5 22.5a5.5 5.5 0 1 0 0 11h1.2l-.7-3.2h-.5a2.3 2.3 0 1 1 0-4.6h.6l.5-3.2z' }
};
const ROLE = { cl: g => g === 'f' ? 'La cliente' : 'Le client', ep: () => "L'épicier", fe: () => 'Sa femme', en: () => "L'enfant" };
const GALON = { 1: 'bronze', 2: 'argent', 3: 'or' };
const GALON_TXT = { 1: 'galon de bronze', 2: "galon d'argent", 3: "galon d'or" };

const TEST = [
  { t: 'sens', a: 'k03', q: "Écoute. Qu'est-ce qu'on te demande ?", o: ['Ça va ?', "C'est combien ?", 'Au revoir'], c: 0 },
  { t: 'sens', a: 'k13', q: "Écoute. Qu'est-ce que ça veut dire ?", o: ['Où est-ce ?', "C'est combien ?", 'Merci'], c: 1 },
  { t: 'sens', a: 'k11', q: 'Écoute. Que te dit cette personne ?', o: ["Je n'ai pas faim", 'Je ne veux pas', "Je n'ai pas compris"], c: 2 },
  { t: 'sens', a: 'h26', q: "Tu demandes quand le lait arrive. Que répond l'épicier ?", o: ['Ce soir, si Dieu le veut', 'Demain matin, si Dieu le veut', 'Tout de suite'], c: 1 },
  { t: 'rep', a: 'k01', av: 'm', q: "L'épicier te dit bonjour. Que lui réponds-tu ?", o: ['k02', 'k16', 'k06'], c: 0 },
  { t: 'rep', a: 'h06', q: "L'épicier demande si tu veux autre chose. Tu as tout. Que réponds-tu ?", o: ['t2', 't1', 't3'], c: 1 },
  { t: 'rep', a: 'h21', q: 'La vendeuse annonce le prix. Tu paies. Que dis-tu ?', o: ['k02', 'h20', 'h11'], c: 2 },
  { t: 'dire', a: 'k07' }, { t: 'dire', a: 'k05' }, { t: 'dire', a: 'k09' }
];
const LVL_TXT = [
  { t: 'Niveau 0 · On démarre', d: 'Commence par le kit de survie : 16 phrases pour saluer, remercier et te sortir de toutes les situations.' },
  { t: 'Niveau 1 · Faux débutant', d: 'Tu comprends les bases. Place aux scènes : le hanout, puis les autres commerces.' },
  { t: 'Niveau 2 · Tu comprends bien', d: "Ton objectif, c'est oser parler. Joue les scènes en entier, sans aide, puis fais les missions réelles." }
];

const QCM = {
  1: [
    { t: 'sens', a: 'h04', q: "Que te dit l'épicier ?", o: ["Oui, j'en ai. Combien tu en veux ?", "Non, il n'y en a plus.", 'Tiens. Autre chose ?'], c: 0 },
    { t: 'rep', a: 'h06', q: 'Tu veux aussi du pain. Que réponds-tu ?', o: ['h07', 't1', 'k02'], c: 0 },
    { t: 'sens', a: 'h10', q: 'Combien dois-tu payer ?', o: ['Dix dirhams', 'Sept dirhams', 'Deux dirhams'], c: 0 }
  ],
  2: [
    { t: 'sens', a: 'h15', q: 'Que dit la femme de l\'épicier ?', o: ["Bienvenue ! Qu'est-ce que vous voulez ?", 'Petite ou grande ?', 'Tiens, mon petit.'], c: 0 },
    { t: 'sens', a: 'h19', q: 'Que te demande-t-elle ?', o: ['Combien tu en veux ?', 'Petite ou grande ?', 'Autre chose ?'], c: 1 },
    { t: 'rep', a: 'h21', q: 'Tu paies et tu laisses la monnaie. Que dis-tu ?', o: ['h20', 'k03', 'h22'], c: 2 }
  ],
  3: [
    { t: 'sens', a: 'h24', q: "Que répond l'épicier ?", o: ['Oui, il en reste un.', "Non, il n'y en a plus, c'est fini.", 'Il arrive demain.'], c: 1 },
    { t: 'sens', a: 'h26', q: 'Quand le lait arrive-t-il ?', o: ['Ce soir', 'Dans une heure', 'Demain matin'], c: 2 },
    { t: 'rep', a: 'h26', q: "L'épicier parle trop vite pour toi. Que lui dis-tu ?", o: ['k06', 'k10', 'k14'], c: 1 }
  ]
};
const MISSION = {
  1: { id: 'h03', txt: 'Au vrai hanout, demande du lait sans regarder ton téléphone.' },
  2: { id: 'h22', txt: 'En payant chez un commerçant, laisse la monnaie avec cette phrase.' },
  3: { id: 'k10', txt: 'Quand quelqu\'un parle trop vite, demande-lui de ralentir.' }
};
const MANCHE = { 1: 'Les bases', 2: "La femme de l'épicier", 3: "L'imprévu" };

/* Toutes les scènes jouables : le hanout + les scènes des enfants */
const SCN = {
  hanout: {
    id: 'hanout', title: 'Au hanout', emoji: '🏪', hero: 'cl',
    intro: "Le petit épicier du quartier. Trois manches de 10 répliques : les bases, la femme de l'épicier et l'enfant, puis l'imprévu.",
    roles: { cl: { lab: ROLE.cl }, ep: { lab: ROLE.ep }, fe: { lab: ROLE.fe }, en: { lab: ROLE.en } },
    manches: [1, 2, 3].map(m => ({ m, title: MANCHE[m], lines: SCENE.filter(l => l.m === m), qcm: QCM[m], mission: MISSION[m] })),
    solo: (m, cur) => (m === 2 && cur.track === 'ados') ? 'en' : 'cl',
    elig: (role, p, m) => role === 'ep' ? p.g === 'm' : role === 'fe' ? p.g === 'f' : role === 'en' ? p.track === 'ados' : (m === 2 ? p.track === 'adultes' : true)
  }
};
(DATA.scenes || []).forEach(s => {
  const roles = {};
  Object.keys(s.roles).forEach(k => { const r = s.roles[k]; roles[k] = { ...r, lab: () => r.lab }; });
  SCN[s.id] = { ...s, roles, solo: () => s.hero, elig: (role, p) => !s.roles[role].g || p.g === s.roles[role].g };
});
SCN.hanout.track = 'adultes';
const KIDS = Object.keys(SCN).filter(k => SCN[k].track === 'ados');
const sceneList = track => {
  const ids = Object.keys(SCN), by = tr => ids.filter(k => SCN[k].track === tr);
  return track === 'ados' ? by('ados').concat(by('commun'), ['hanout']) : ['hanout'].concat(by('adultes').filter(k => k !== 'hanout'), by('commun'), by('ados'));
};
const HERO_IDS = Object.keys(BYID).filter(k => BYID[k].kind === 'line' && BYID[k].hero);
const MOD_PCT = 0.6;
const SOON = {
  commun: ['Café et jus', 'Demander son chemin', 'Petit taxi', 'Chez la famille', 'Les fêtes'],
  ados: ['Le snack', 'Le glacier', 'Plage', 'Maillot au souk', 'Console et jeux', "Anniversaire d'un ami"],
  adultes: ['Boucher', 'Marché', 'Coiffeur', 'Garagiste', 'Station-service', 'Pharmacie', 'Banque', 'Administration', 'Artisan et chantier', 'Location', 'Gare ONCF']
};
const PTS = { bien: 10, presque: 5, revoir: 2 };
const CAST_PHRASE = { lat: 'salam 3alikoum, mer7ba bik. 3tini jouj dyal l7lib 3afak. bchhal kolchi?', fr: "Bonjour, bienvenue. Donne-moi deux laits, s'il te plaît. Ça fait combien en tout ?" };
const voiceName = v => v.replace('male-', 'Homme ').replace('feHomme ', 'Femme ');
const CAST_KEEP = ['male-9', 'male-11', 'male-2', 'female-6', 'female-5', 'female-10', 'female-1', 'female-3'];
const KID_CAST = [['female-10', 'Enfant (garçon)'], ['female-6', 'Enfant (fille)'], ['female-5', 'Yassine'], ['female-1', 'Maman de Yassine'], ['male-2', 'Hamza'], ['female-3', 'Boulangère'], ['male-11', 'Pâtissier']];
const CAST_ROLES = [['m', "Ta voix (homme)"], ['f', 'Ta voix (femme)'], ['ep', "L'épicier"], ['fe', 'Sa femme'], ['en', "L'enfant"]];

/* ---------- Utilitaires ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const dstr = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const today = () => dstr(new Date());
const yesterday = () => dstr(new Date(Date.now() - 864e5));
const ago = ts => { const m = Math.round((Date.now() - ts) / 6e4); if (m < 1) return "à l'instant"; if (m < 60) return 'il y a ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'il y a ' + h + ' h'; return 'il y a ' + Math.round(h / 24) + ' j'; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* ---------- Audio : un seul lecteur, déverrouillé au premier toucher (iPhone) ---------- */
const SUPA_AUDIO = 'https://htpygokjdstmmzquibmn.supabase.co/storage/v1/object/public/hder-audio/';
const GH = new Set(DATA.clips || []);
const audioSrc = clip => GH.has(clip) ? 'audio/' + clip + '.mp3?v=' + (DATA.av || 2) : SUPA_AUDIO + clip + '.mp3';
const SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//OEwAAAAAAAAAAAAEluZm8AAAAPAAAABgAAAwAAYGBgYGBgYGBgYGBgYGBgYICAgICAgICAgICAgICAgICAoKCgoKCgoKCgoKCgoKCgoMDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4ODg4ODg4ODg4OD/////////////////////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQDwAAAAAAAAAMArPq/AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//NExAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExFMAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKYAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMu//NExKwAAANIAAAAADEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NExKwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
const AU = typeof Audio !== 'undefined' ? new Audio() : null;
if (AU) AU.preload = 'auto';
let UNLOCKED = false;
function unlockAudio() {
  if (UNLOCKED || !AU) return;
  UNLOCKED = true;
  try { AU.src = SILENT; const p = AU.play(); if (p && p.catch) p.catch(() => { UNLOCKED = false; }); } catch (e) { UNLOCKED = false; }
}
if (typeof document !== 'undefined') { ['touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { capture: true })); }
const BLOBS = {};
async function blobOf(clip) {
  if (BLOBS[clip]) return BLOBS[clip];
  const r = await fetch(audioSrc(clip));
  if (!r.ok) throw new Error('audio ' + r.status);
  const u = URL.createObjectURL(await r.blob());
  BLOBS[clip] = u;
  return u;
}
let CUR = null, CURDONE = null;
function stopClip() {
  if (CURDONE) { const d = CURDONE; CURDONE = null; d(false); }
  CUR = null;
  if (AU) { AU.onended = null; AU.onerror = null; try { AU.pause(); } catch (e) {} }
}
function playClip(clip, slow) {
  stopClip();
  if (!AU) return Promise.resolve(false);
  const token = {}; CUR = token;
  return new Promise(res => {
    let done = false;
    const fin = v => { if (done) return; done = true; if (CURDONE === fin) CURDONE = null; res(v); };
    CURDONE = fin;
    blobOf(clip).then(url => {
      if (CUR !== token) return fin(false);
      AU.onended = () => fin(true);
      AU.onerror = () => fin(false);
      const rate = slow ? 0.75 : 1;
      AU.src = url;
      try { AU.preservesPitch = true; AU.defaultPlaybackRate = rate; AU.playbackRate = rate; } catch (e) {}
      const p = AU.play();
      if (p && p.catch) p.catch(() => fin(false));
    }).catch(() => fin(false));
  });
}

/* ---------- Serveur de la famille ---------- */
const API = 'https://htpygokjdstmmzquibmn.supabase.co/functions/v1/hder-api';
let SECRET = null;
async function callApi(act, body, timeout) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), timeout || 20000) : null;
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hder': SECRET || '' }, body: JSON.stringify({ act, ...(body || {}) }), signal: ctl ? ctl.signal : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || ('http ' + r.status)); e.code = j.error; e.status = r.status; throw e; }
    return j;
  } finally { if (t) clearTimeout(t); }
}

/* ---------- Micro : enregistrement en WAV 16 kHz ---------- */
const micOK = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
function startRecorder(onLevel) {
  return navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(stream => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const sr = ctx.sampleRate, chunks = [];
    let floor = 0.003, n = 0, speech = false, silence = 0, total = 0, stopped = false, done = null;
    const finish = () => {
      if (stopped) return; stopped = true;
      try { proc.disconnect(); src.disconnect(); } catch (e) {}
      stream.getTracks().forEach(t => t.stop());
      try { ctx.close(); } catch (e) {}
      if (done) done(encode16k(chunks, sr));
    };
    proc.onaudioprocess = e => {
      if (stopped) return;
      const d = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(d));
      let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      const rms = Math.sqrt(s / d.length), ms = d.length / sr * 1000;
      total += ms; n++;
      if (n <= 2) floor = Math.max(floor, rms);
      const thr = Math.max(0.012, floor * 2.2);
      if (rms > thr) { speech = true; silence = 0; } else if (speech) silence += ms;
      if (onLevel) onLevel(Math.min(1, rms / 0.15));
      if ((speech && silence > 1200) || total > 8000) finish();
    };
    src.connect(proc); proc.connect(ctx.destination);
    if (ctx.resume) ctx.resume();
    return { stop: finish, result: new Promise(res => { done = res; }) };
  });
}
function encode16k(chunks, sr) {
  let len = 0; chunks.forEach(c => { len += c.length; });
  const all = new Float32Array(len); let o = 0;
  chunks.forEach(c => { all.set(c, o); o += c.length; });
  // retire les silences au début et à la fin
  const win = Math.max(1, Math.floor(sr * 0.02)), env = []; let peak = 0;
  for (let i = 0; i < all.length; i += win) { let s = 0; const e = Math.min(all.length, i + win); for (let j = i; j < e; j++) s += all[j] * all[j]; const r = Math.sqrt(s / (e - i)); env.push(r); if (r > peak) peak = r; }
  const thr = Math.max(0.01, peak * 0.08);
  let a = env.findIndex(r => r > thr);
  if (a < 0 || peak < 0.015) return { wav: null, seconds: 0 };
  let b = env.length - 1; while (b > a && env[b] <= thr) b--;
  a = Math.max(0, a - 8) * win; b = Math.min(all.length, (b + 9) * win);
  const seg = all.subarray(a, b);
  let pk = 0; for (let i = 0; i < seg.length; i++) { const x = Math.abs(seg[i]); if (x > pk) pk = x; }
  const gain = pk > 0 ? Math.min(8, 0.9 / pk) : 1;
  const ratio = sr / 16000, m = Math.floor(seg.length / ratio);
  const buf = new ArrayBuffer(44 + m * 2), v = new DataView(buf);
  const w = (p, s) => { for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + m * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, m * 2, true);
  for (let i = 0; i < m; i++) {
    const s0 = Math.floor(i * ratio), s1 = Math.max(s0 + 1, Math.floor((i + 1) * ratio));
    let acc = 0; for (let k = s0; k < s1; k++) acc += seg[k] || 0;
    let x = acc / (s1 - s0) * gain; x = Math.max(-1, Math.min(1, x));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return { wav: new Uint8Array(buf), seconds: m / 16000 };
}
const toB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

/* ---------- Note de prononciation : on compare ce que la machine a compris à la phrase attendue ---------- */
const UNITS = ['', 'واحد', 'جوج', 'تلاتة', 'ربعة', 'خمسة', 'ستة', 'سبعة', 'تمنية', 'تسعود'];
const TEENS = { 10: 'عشرة', 11: 'حضاش', 12: 'طناش', 13: 'تلطاش', 14: 'ربعطاش', 15: 'خمسطاش', 16: 'سطاش', 17: 'سبعطاش', 18: 'تمنطاش', 19: 'تسعطاش' };
const TENS = ['', '', 'عشرين', 'تلاتين', 'ربعين', 'خمسين', 'ستين', 'سبعين', 'تمانين', 'تسعين'];
function numWords(n) {
  if (n === 0) return 'صفر';
  if (n >= 1000) { const k = Math.floor(n / 1000), r = n % 1000; return (k === 1 ? 'الف' : (k === 2 ? 'الفين' : numWords(k) + ' الاف')) + (r ? ' و' + numWords(r) : ''); }
  if (n >= 100) { const h = Math.floor(n / 100), r = n % 100; return (h === 1 ? 'مية' : (h === 2 ? 'ميتين' : UNITS[h] + ' مية')) + (r ? ' و' + numWords(r) : ''); }
  if (n >= 20) { const t = Math.floor(n / 10), u = n % 10; return (u ? UNITS[u] + ' و' : '') + TENS[t]; }
  if (n >= 10) return TEENS[n];
  return UNITS[n];
}
function arNorm(s) {
  return String(s || '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\d+/g, x => ' ' + (Number(x) < 100000 ? numWords(Number(x)) : '') + ' ')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
    .replace(/[ڭگ]/g, 'ك').replace(/ڤ/g, 'ف').replace(/پ/g, 'ب')
    .replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map(w => w === 'ديال' ? 'د' : (w === 'في' ? 'ف' : w)).join(' ');
}
const skel = s => s.replace(/[اوي]/g, '');
function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const sim = (a, b) => (!a && !b) ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length, 1);
function scoreOne(Tn, Hn, wild) {
  const tw = Tn.split(' ').filter(Boolean), hw = Hn.split(' ').filter(Boolean);
  const pairs = hw.map((h, k) => k + 1 < hw.length ? h + hw[k + 1] : null).filter(Boolean);
  const per = tw.map(t => { let best = 0; hw.concat(pairs).forEach(h => { const s = Math.max(sim(t, h), 0.97 * sim(skel(t), skel(h)), 0.95 * sim(t.replace(/^ال/, ''), h.replace(/^ال/, ''))); if (s > best) best = s; }); return best; });
  const words = per.length ? per.reduce((x, y) => x + y, 0) / per.length : 0;
  if (wild) return { raw: words, per };
  const a = Tn.replace(/ /g, ''), b = Hn.replace(/ /g, '');
  const chars = 0.5 * sim(a, b) + 0.5 * sim(skel(a), skel(b));
  return { raw: 0.55 * chars + 0.45 * words, per };
}
function scoreAll(target, cands) {
  const wild = /\.\.\.|…/.test(target), Tn = arNorm(target);
  let best = { raw: 0, per: [], heard: '' };
  (cands || []).forEach(c => { const r = scoreOne(Tn, arNorm(c), wild); if (r.raw > best.raw) best = { ...r, heard: c }; });
  return best;
}
const gradeOf = pct => pct >= 85 ? 'bien' : (pct >= 60 ? 'presque' : 'revoir');

/* ---------- Dirhams : modules, contrôles, tirelire ---------- */
const INT = [3, 7, 15, 30, 60], GRACE = 2;
const dayN = (ts = Date.now()) => { const d = new Date(ts); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
const fmtDay = n => new Date(n * 864e5).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
function modStatus(p, key, d = dayN()) {
  const r = (p.mods2 || {})[key];
  if (!r) return { st: 'new' };
  if (!r.ok) return { st: 'lost', r };
  if (d < r.due) return { st: 'ok', r };
  if (d <= r.due + GRACE) return { st: 'check', r, until: r.due + GRACE };
  return { st: 'lost', r, expired: true };
}
function wallet(p, payouts) {
  const d = dayN(); let A = 0, J = 0; const checks = [], lost = [];
  Object.keys(p.mods2 || {}).forEach(k => { const s = modStatus(p, k, d); if (s.st === 'ok') A++; else if (s.st === 'check') { A++; J++; checks.push({ key: k, until: s.until }); } else if (s.st === 'lost') lost.push(k); });
  const C = (payouts || []).filter(x => x.pid === p.id).reduce((a, x) => a + x.amount, 0);
  checks.sort((a, b) => a.until - b.until);
  return { A, J, L: lost.length, C, tirelire: Math.max(0, A - C), conv: Math.max(0, A - J - C), deficit: Math.max(0, C - A), checks, lost };
}
function modLabel(key) {
  const [a, b] = key.split('-');
  if (SCN[a]) { const M = SCN[a].manches.find(x => String(x.m) === b); return SCN[a].title + ' · manche ' + b + (M ? ' (' + M.title + ')' : ''); }
  if (key === 'kit-echo') return 'Kit · Écho';
  if (key === 'kit-reply') return 'Kit · Que répondre ?';
  if (key === 'kit-flash') return 'Kit · QCM éclair';
  if (a === 'voc') { const C = VOCAB.find(x => x.cat === b); return "Vocabulaire à l'oreille · " + (C ? C.title : 'Tout mélangé'); }
  return key;
}
function modGo(key) {
  const [a, b] = key.split('-');
  if (SCN[a]) return ['scene', { sid: a, m: Number(b) }];
  if (a === 'kit') return ['kit', { mode: b === 'echo' ? 'echo' : b }];
  if (a === 'voc') return ['kit', { mode: 'words', cat: b }];
  return ['home', null];
}
function modMsg(b, pass, needTxt) {
  if (pass) {
    if (b.st === 'new') return html`<b>Module validé : +1 dirham !</b> Premier contrôle dans ${INT[0]} jours.`;
    if (b.st === 'check') return html`<b>Contrôle réussi : ton dirham est sauvé !</b> Prochain contrôle dans ${INT[Math.min(b.r.lv + 1, INT.length - 1)]} jours.`;
    if (b.st === 'lost') return html`<b>Dirham reconquis !</b> Le module est de nouveau validé. Prochain contrôle dans ${INT[0]} jours.`;
    return html`<b>Module déjà validé.</b> Son dirham est déjà dans ta tirelire. Prochain contrôle le ${fmtDay(b.r.due)}.`;
  }
  if (b.st === 'check') return html`<b>Contrôle raté : tu perds ce dirham</b> jusqu'à ce que tu réussisses ce module (${needTxt}).`;
  if (b.st === 'lost') return html`<b>Toujours pas réussi.</b> ${needTxt} pour récupérer ton dirham.`;
  if (b.st === 'ok') return html`<b>Pas réussi cette fois</b>, mais ton dirham reste : ce module n'est pas en contrôle aujourd'hui.`;
  return html`<b>Pas encore validé.</b> ${needTxt} pour gagner le dirham. Réessaie !`;
}
function migrateMods(p) {
  if (p.mods2) return p;
  const out = {};
  Object.keys(p.mods || {}).forEach(k => { const [y, m, d] = String(p.mods[k]).split('-').map(Number); const dn = (y && m && d) ? Math.round(Date.UTC(y, m - 1, d) / 864e5) : dayN(); out[k] = { lv: 0, due: dn + INT[0], ok: true, at: dn }; });
  return { ...p, mods2: out };
}

/* ---------- Stockage (cet appareil) : cache local, le serveur fait foi ---------- */
const LS = 'hder-app-v1';
const fresh = p => ({ xp: 0, dh: 0, streak: 0, last: null, stars: {}, manches: {}, missions: {}, test: null, ear: false, mods2: {}, selfGrade: false, t: 0, ...p });
const INIT = {
  v: 1, cur: null, skin: null, fam: null, profiles: [], events: {}, revs: {}, dirty: [], pend: [],
  settings: { pinSet: false, rate: 1 }, synced: 0,
  cast: { m: 'male-9', f: 'female-6', ep: 'male-11', fe: 'female-5', en: 'female-10' }, castV: 2, likes: {}
};
function load() {
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s && s.v === 1) return { ...INIT, ...s, profiles: (s.profiles || []).map(fresh) }; } catch (e) {}
  return null;
}
function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) {} }

/* ---------- Petits composants ---------- */
const IC = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z" fill="currentColor"/>',
  fire: '<path d="M12 2.5c.8 3.6 5.5 5.6 5.5 10.8A5.5 5.5 0 0 1 6.5 13c0-2.5 1.3-4.2 2.7-5.4.3 2.1 1.3 3.2 2.6 3.2-.7-3.1-.5-5.8.2-8.3z" fill="currentColor"/>',
  coin: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="currentColor" opacity=".4"/>',
  home: '<path d="M3.5 11L12 4l8.5 7v8.5a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  shop: '<path d="M3.5 9.5L5.5 4h13l2 5.5M4.5 9.5V20h15V9.5M10 20v-5h4v5M3.5 9.5h17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  users: '<circle cx="9" cy="8.5" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M15.5 4.8a3.5 3.5 0 0 1 0 7.4M18 14.8c1.9.8 3.1 2.5 3.5 5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  wave: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.8 0-1 .8-1.6 1.8-1.6h2.2A4.3 4.3 0 0 0 21 10.6C21 6.4 17 3 12 3z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7.5" cy="11" r="1.4" fill="currentColor"/><circle cx="10.5" cy="7" r="1.4" fill="currentColor"/><circle cx="15" cy="7.5" r="1.4" fill="currentColor"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" fill="none" stroke="currentColor" stroke-width="2"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  micon: '<rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
  medal: '<circle cx="12" cy="14.5" r="5.5" fill="currentColor"/><path d="M8.5 9.5L6 3h4l2 4.5M15.5 9.5L18 3h-4l-2 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
};
function Icon({ n, s = 20 }) { return html`<svg width=${s} height=${s} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: IC[n] }}></svg>`; }
function Avatar({ id, size = 44 }) {
  const a = AV[id] || AV.boxeur;
  return html`<span className="av" style=${{ width: size, height: size, background: a.c }} aria-hidden="true"><svg viewBox="0 0 48 48" width=${Math.round(size * 0.64)} height=${Math.round(size * 0.64)}><path d=${a.d} fill="var(--av-ink)"/></svg></span>`;
}
function Bars() { return html`<span className="bars" aria-hidden="true"><i></i><i></i><i></i></span>`; }
function Stars({ n = 0 }) { return html`<span className="stars" aria-label=${n + ' étoile' + (n > 1 ? 's' : '') + ' sur 5'}>${[0, 1, 2, 3, 4].map(i => html`<span key=${i} className=${i < n ? 'on' : ''}><${Icon} n="star" s=${14}/></span>`)}</span>`; }

function PlayBtn({ clip, slow, label, ic, big, alt }) {
  const [on, setOn] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const go = async e => { if (e) e.stopPropagation(); setOn(true); await playClip(clip, slow); if (mounted.current) setOn(false); };
  const cls = 'play' + (ic ? ' ic' : '') + (big ? ' big' : '') + (alt || slow ? ' alt' : '');
  const lab = label || (slow ? 'Lent' : 'Écouter');
  return html`<button type="button" className=${cls} onClick=${go} aria-label=${slow ? 'Écouter lentement' : lab}>
    ${on ? html`<${Bars}/>` : (slow ? html`<span className="xs" style=${{ fontWeight: 800 }}>×0,75</span>` : html`<${Icon} n="play" s=${big ? 26 : 18}/>`)}
    ${!ic && html`<span>${lab}</span>`}
  </button>`;
}

function Grade({ onPick }) {
  return html`<div className="grade" role="group" aria-label="Comment c'était ?">
    <button type="button" className="g-revoir" onClick=${() => onPick('revoir')}>À revoir<small>+2 XP</small></button>
    <button type="button" className="g-presque" onClick=${() => onPick('presque')}>Presque<small>+5 XP</small></button>
    <button type="button" className="g-bien" onClick=${() => onPick('bien')}>Bien dit<small>+10 XP</small></button>
  </div>`;
}

/* ---------- « Parle » : le joueur dit la phrase, l'appli la note en % ---------- */
const arOf = (id, g) => { const p = BYID[id]; if (!p) return ''; if (p.kind === 'pol') return (p[g] || p.m).ar || ''; if (p.var && g === 'f' && p.var.ar) return p.var.ar; return p.ar || ''; };
const refOf = clip => Math.max(0.6, ((DATA.ref || {})[clip]) || 0.92);
const PCT_TXT = pct => pct >= 85 ? 'Mzyan bezzaf !' : (pct >= 60 ? 'Presque !' : 'À revoir');

function ScoreCard({ res, lat }) {
  const words = String(lat || '').split(/\s+/).filter(Boolean);
  const per = res.per || [];
  const colored = per.length && per.length === words.length;
  const cls = res.pct >= 85 ? 'ok' : (res.pct >= 60 ? 'mid' : 'ko');
  return html`<div className=${'score ' + cls} role="status" aria-live="polite">
    <div className="score-top"><span className="score-pct num">${res.pct} %</span><b>${PCT_TXT(res.pct)}</b></div>
    ${colored ? html`<div className="score-words lat">${words.map((w, k) => html`<span key=${k} className=${per[k] >= 0.75 ? 'w-ok' : (per[k] >= 0.45 ? 'w-mid' : 'w-ko')}>${w} </span>`)}</div>` : ''}
    <p className="xs muted">${res.pct >= 85 ? "La machine t'a très bien compris." : (res.pct >= 60 ? (colored ? 'Réécoute le modèle, puis redis les mots en orange ou en rouge.' : 'Réécoute le modèle, puis réessaie.') : 'Écoute le modèle en vitesse lente, puis réessaie.')}</p>
  </div>`;
}

function Speak({ who, api, target, clip, lat, onGrade }) {
  const can = micOK();
  const [self, setSelf] = useState(!can || !!(who && who.selfGrade));
  const [step, setStep] = useState('idle');
  const [lvl, setLvl] = useState(0);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const rec = useRef(null), best = useRef(null), alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (rec.current) rec.current.stop(); }, []);
  const start = async () => {
    stopClip(); setErr('');
    try {
      const r = await startRecorder(v => { if (alive.current) setLvl(v); });
      rec.current = r; setStep('rec');
      const out = await r.result; rec.current = null;
      if (!alive.current) return;
      if (!out.wav || out.seconds < 0.3) { setStep(res ? 'done' : 'idle'); setErr("Je n'ai rien entendu. Approche le téléphone et parle un peu plus fort."); return; }
      setStep('wait');
      const j = await callApi('score', { audio: toB64(out.wav) }, 30000);
      const sc = scoreAll(target, (j.cands && j.cands.length) ? j.cands : [j.text || '']);
      const pct = Math.round(100 * Math.max(0, Math.min(1, sc.raw / refOf(clip))));
      const r2 = { pct, per: sc.per, heard: sc.heard };
      if (!best.current || pct >= best.current.pct) best.current = r2;
      if (!alive.current) return;
      setRes(r2); setStep('done');
    } catch (e) {
      rec.current = null;
      if (!alive.current) return;
      setStep(res ? 'done' : 'idle');
      const c = e && (e.code || e.name);
      setErr(c === 'NotAllowedError' || c === 'SecurityError' ? "Le micro est bloqué. Autorise-le pour Hder ! dans les réglages du téléphone, ou note-toi toi-même."
        : c === 'NotFoundError' ? "Aucun micro trouvé sur cet appareil. Note-toi toi-même."
        : c === 'credit' ? "Le crédit de notation est épuisé. Note-toi toi-même pour l'instant."
        : c === 'quota' ? "La famille a déjà beaucoup parlé aujourd'hui ! Note-toi toi-même jusqu'à demain."
        : (c === 'AbortError' || !navigator.onLine) ? "Pas de connexion. Note-toi toi-même, ou réessaie avec du réseau."
        : "La note n'a pas marché. Réessaie, ou note-toi toi-même.");
    }
  };
  const done = () => { const b = best.current; onGrade(gradeOf(b.pct), b.pct); };
  if (self) return html`<div className="stack-s">
    <${Grade} onPick=${onGrade}/>
    ${can && html`<button type="button" className="linkbtn" onClick=${() => setSelf(false)}><${Icon} n="micon" s=${16}/>Utiliser le micro pour avoir une note</button>`}
  </div>`;
  return html`<div className="speak stack-s">
    ${res && html`<${ScoreCard} res=${res} lat=${lat}/>`}
    <div className="row">
      ${step === 'rec'
        ? html`<button type="button" className="mic on" onClick=${() => rec.current && rec.current.stop()} aria-label="Arrêter l'enregistrement"><span className="mic-ring" style=${{ transform: 'scale(' + (1 + lvl * 0.9).toFixed(2) + ')' }}></span><${Icon} n="micon" s=${22}/><span>Je t'écoute… touche pour finir</span></button>`
        : html`<button type="button" className="mic" disabled=${step === 'wait'} onClick=${start}><${Icon} n="micon" s=${22}/><span>${step === 'wait' ? 'Je calcule ta note…' : (res ? 'Réessayer' : 'Parle !')}</span></button>`}
      ${res && step !== 'rec' && step !== 'wait' && html`<button type="button" className="btn" onClick=${done}>Continuer${best.current && best.current.pct !== res.pct ? ' (' + best.current.pct + ' %)' : ''}</button>`}
    </div>
    ${err && html`<p className="small c-bad" role="alert">${err}</p>`}
    ${step === 'idle' && !res && html`<p className="xs muted">Touche « Parle ! », dis la phrase, puis attends un instant : la note s'affiche toute seule.</p>`}
    <button type="button" className="linkbtn" onClick=${() => setSelf(true)}>Pas de micro ? Me noter moi-même</button>
  </div>`;
}

function MicNote() {
  if (micOK()) return null;
  return html`<div className="note"><${Icon} n="mic" s=${18}/><span>Ce navigateur ne donne pas accès au micro : tu peux quand même jouer en te notant toi-même. Sur iPhone, ouvre Hder ! depuis l'icône de l'écran d'accueil.</span></div>`;
}

function Steps({ n, i }) { return html`<div className="steps" aria-label=${'Étape ' + (i + 1) + ' sur ' + n}>${Array.from({ length: n }, (_, k) => html`<i key=${k} className=${k < i ? 'done' : (k === i ? 'on' : '')}></i>`)}</div>`; }

function BackBar({ go, title, to = 'home' }) {
  return html`<div className="row" style=${{ gap: '8px' }}><button type="button" className="icon-btn" onClick=${() => { stopClip(); go(to); }} aria-label="Retour"><${Icon} n="back"/></button><h2 style=${{ flex: 1, minWidth: 0 }}>${title}</h2></div>`;
}

function HanoutArt() {
  const stripes = [];
  for (let i = 0; i < 8; i++) {
    const x0 = 36 + i * 31, x1 = x0 + 31;
    stripes.push(html`<polygon key=${'s' + i} points=${`${x0},20 ${x1},20 ${x1},42 ${x0 + 15.5},50 ${x0},42`} fill=${i % 2 ? 'var(--accent-soft)' : 'var(--accent)'}/>`);
  }
  const shelf = [];
  const cols = ['var(--accent-2)', 'var(--warm)', 'var(--gold)', 'var(--accent)', 'var(--ink-2)'];
  for (let i = 0; i < 11; i++) {
    const x = 58 + i * 19, c = cols[i % 5];
    shelf.push(i % 3 === 0 ? html`<rect key=${'a' + i} x=${x} y="54" width="14" height="12" rx="2" fill=${c}/>` : html`<rect key=${'a' + i} x=${x + 3} y="50" width="8" height="16" rx="3" fill=${c}/>`);
    shelf.push(html`<rect key=${'b' + i} x=${x + 1} y=${i % 2 ? 80 : 83} width="12" height=${i % 2 ? 14 : 11} rx="2" fill=${cols[(i + 2) % 5]}/>`);
  }
  return html`<svg className="art" viewBox="0 0 320 144" role="img" aria-label="La façade d'un petit hanout de quartier">
    <rect x="0" y="132" width="320" height="12" fill="var(--surface-2)"/>
    <rect x="36" y="36" width="248" height="98" rx="6" fill="var(--surface)" stroke="var(--line)"/>
    ${stripes}
    <rect x="118" y="2" width="84" height="18" rx="4" fill="var(--ink)"/>
    <text x="160" y="15" textAnchor="middle" fontSize="11" fontWeight="800" letterSpacing="3" fill="var(--bg)" style=${{ fontFamily: 'var(--f-display)' }}>HANOUT</text>
    <rect x="50" y="66" width="220" height="3" fill="var(--line)"/>
    <rect x="50" y="94" width="220" height="3" fill="var(--line)"/>
    ${shelf}
    <rect x="70" y="104" width="180" height="30" rx="4" fill="var(--surface-2)" stroke="var(--line)"/>
    <ellipse cx="108" cy="104" rx="20" ry="6" fill="var(--gold)"/>
    <rect x="196" y="90" width="12" height="15" rx="2" fill="var(--surface)" stroke="var(--ink-2)"/>
    <rect x="212" y="90" width="12" height="15" rx="2" fill="var(--surface)" stroke="var(--ink-2)"/>
  </svg>`;
}

/* ---------- Tirelire ---------- */
function Tirelire({ st, cur, go }) {
  const w = wallet(cur, st.payouts);
  const goMod = k => { const [v, p] = modGo(k); go(v, p); };
  return html`<section className="card stack" aria-label="Ta tirelire">
    <div className="sec-h"><h2>Ta tirelire</h2><span className="tl-big num"><${Icon} n="coin" s=${20}/>${w.tirelire} DH</span></div>
    <div className="tl-row small">
      <span><b className="num">${w.A}</b> module${w.A > 1 ? 's' : ''} validé${w.A > 1 ? 's' : ''}</span>
      ${w.J > 0 && html`<span className="c-warn"><b className="num">${w.J}</b> en jeu</span>`}
      ${w.L > 0 && html`<span className="c-bad"><b className="num">${w.L}</b> à reconquérir</span>`}
      ${w.C > 0 && html`<span><b className="num">${w.C}</b> déjà converti${w.C > 1 ? 's' : ''} en vrais dirhams</span>`}
    </div>
    ${w.deficit > 0 && html`<p className="small c-bad">Tu as perdu ${w.deficit} dirham${w.deficit > 1 ? 's' : ''} déjà converti${w.deficit > 1 ? 's' : ''} : regagne-${w.deficit > 1 ? 'les' : 'le'} avant le prochain versement.</p>`}
    ${w.checks.length > 0 && html`<div className="stack-s"><h3>Contrôles à faire</h3>${w.checks.map(c => html`<div key=${c.key} className="mod-row warn"><div style=${{ minWidth: 0 }}><b>${modLabel(c.key)}</b><div className="xs muted">avant la fin du ${fmtDay(c.until)}, sinon tu perds ce dirham</div></div><button type="button" className="btn sm" onClick=${() => goMod(c.key)}>Faire le contrôle</button></div>`)}</div>`}
    ${w.lost.length > 0 && html`<div className="stack-s"><h3>Dirhams à reconquérir</h3>${w.lost.map(k => html`<div key=${k} className="mod-row bad"><div style=${{ minWidth: 0 }}><b>${modLabel(k)}</b><div className="xs muted">réussis ce module pour récupérer ton dirham</div></div><button type="button" className="btn sm ghost" onClick=${() => goMod(k)}>Refaire</button></div>`)}</div>`}
    <p className="xs muted">1 module validé = 1 dirham, gagné une seule fois. Une manche de scène ou une série d'exercices compte comme un module, réussi à ${Math.round(MOD_PCT * 100)} %. Chaque module revient en contrôle après ${INT.slice(0, -1).join(', ')} puis ${INT[INT.length - 1]} jours. Contrôle raté, ou pas fait dans les ${GRACE} jours : tu perds ce dirham jusqu'à ce que tu réussisses à nouveau le module.</p>
  </section>`;
}

/* ---------- Accueil ---------- */
function PlayerCard({ st, cur, go }) {
  const lv = lvlOf(cur.xp), L = LEVELS[lv], N = LEVELS[lv + 1];
  const pct = N ? Math.round((cur.xp - L.xp) / (N.xp - L.xp) * 100) : 100;
  const stars = Object.values(cur.stars).reduce((a, b) => a + b, 0);
  const galons = Object.values(cur.manches).filter(Boolean).length;
  return html`<section className="card player" aria-label="Ton profil">
    <div className="player-top">
      <button type="button" style=${{ border: 0, background: 'none', padding: 0 }} onClick=${() => go('who')} aria-label="Changer de joueur"><${Avatar} id=${cur.av} size=${64}/></button>
      <div style=${{ minWidth: 0, flex: 1 }}>
        <div className="eyebrow">Saison ${Math.floor(lv / 3) + 1} · ${L.season}</div>
        <div className="player-name">${cur.name}</div>
        <div className="lvl-line">Niveau ${lv + 1} · <em>${L.name}</em></div>
      </div>
    </div>
    <div className="stack-s">
      <div className="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct}><i style=${{ width: pct + '%' }}></i></div>
      <div className="row small muted num" style=${{ justifyContent: 'space-between' }}><span>${cur.xp} XP</span><span>${N ? 'Prochain : ' + N.name + ' à ' + N.xp + ' XP' : 'Niveau maximum'}</span></div>
    </div>
    <div className="stats">
      <div className="stat"><b className="c-fire"><${Icon} n="fire" s=${16}/>${cur.streak}</b><span>jours de suite</span></div>
      <div className="stat"><b className="c-acc2"><${Icon} n="coin" s=${16}/>${wallet(cur, st.payouts).tirelire}</b><span>dirhams</span></div>
      <div className="stat"><b className="c-gold"><${Icon} n="star" s=${16}/>${stars}</b><span>étoiles</span></div>
      <div className="stat"><b className="c-acc"><${Icon} n="medal" s=${16}/>${galons}</b><span>galons</span></div>
    </div>
  </section>`;
}

function reviewIds(cur) {
  const pool = KIT.map(p => p.id).concat(POL_YOU, HERO_IDS);
  const weak = pool.filter(id => cur.stars[id] !== undefined && cur.stars[id] < 3);
  const fresh = KIT.map(p => p.id).filter(id => cur.stars[id] === undefined);
  return weak.concat(fresh).slice(0, 5);
}

function Home({ st, cur, go, api }) {
  const ids = reviewIds(cur);
  const kitIds = KIT.map(p => p.id).concat(POL_YOU);
  const kitDone = kitIds.filter(id => (cur.stars[id] || 0) >= 3).length;
  return html`<div className="home-grid">
    <div className="col">
      <${PlayerCard} st=${st} cur=${cur} go=${go}/>
      <${Tirelire} st=${st} cur=${cur} go=${go}/>
      ${!cur.test ? html`<section className="card stack" style=${{ borderColor: 'var(--accent)' }}>
          <div className="eyebrow">À faire en premier</div>
          <h2>Ton test de niveau, en 3 minutes</h2>
          <p className="muted">10 questions : tu écoutes, tu choisis, tu répètes. L'appli choisit ensuite ton point de départ.</p>
          <button type="button" className="btn block" onClick=${() => go('test')}>Commencer le test</button>
        </section>` : html`<section className="card stack">
          <div className="sec-h"><h2>Révision du jour</h2><span className="pill acc">${ids.length} phrases</span></div>
          <div className="stack-s">${ids.map(id => { const p = textOf(id, cur.g); return html`<div key=${id} className="row" style=${{ justifyContent: 'space-between' }}><span style=${{ fontWeight: 700 }}>${p.lat}</span><${Stars} n=${cur.stars[id] || 0}/></div>`; })}</div>
          <button type="button" className="btn block" onClick=${() => go('kit', { mode: 'echo', ids })}>Réviser maintenant</button>
        </section>`}
      <section className="card sec" aria-label="Ton parcours">
        <div className="sec-h"><h2>Ton parcours</h2><span className="small muted">${cur.track === 'ados' ? 'Parcours ados' : 'Parcours adultes'}</span></div>
        <div className="path">
          <div className=${'node ' + (cur.test ? 'done' : 'open')}>
            <span className="node-dot"><${Icon} n=${cur.test ? 'check' : 'play'} s=${18}/></span>
            <div><div className="node-t">Test de niveau</div><div className="small muted">${cur.test ? LVL_TXT[cur.test.lvl].t : '3 minutes pour te situer'}</div></div>
            <button type="button" className="btn sm ghost" onClick=${() => go('test')}>${cur.test ? 'Refaire' : 'Go'}</button>
          </div>
          <div className=${'node ' + (kitDone === kitIds.length ? 'done' : 'open')}>
            <span className="node-dot"><${Icon} n="book" s=${18}/></span>
            <div><div className="node-t">Kit de survie</div><div className="small muted num">Politesse, essentiels, ${WORDS.length} mots · ${kitDone} / ${kitIds.length} phrases à 3 étoiles</div></div>
            <button type="button" className="btn sm" onClick=${() => go('kit')}>Ouvrir</button>
          </div>
          ${sceneList(cur.track).map(sid => { const S = SCN[sid]; const all = S.manches.every(M => cur.manches[sid + '-' + M.m]); return html`<div key=${sid} className=${'node ' + (all ? 'done' : 'open')}>
            <span className="node-dot emo" aria-hidden="true">${S.emoji}</span>
            <div style=${{ display: 'grid', gap: '4px', minWidth: 0 }}><div className="node-t">${S.title}${cur.track !== 'ados' && KIDS.includes(sid) ? html` <span className="xs muted">· scène des enfants</span>` : ''}</div>
              <div className="pills">${S.manches.map(M => { const g = cur.manches[sid + '-' + M.m]; return html`<span key=${M.m} className=${'pill ' + (g ? GALON[g] : '')}>Manche ${M.m}${g ? ' · ' + GALON[g] : ''}</span>`; })}</div></div>
            <button type="button" className="btn sm" onClick=${() => go('scene', { sid })}>Jouer</button>
          </div>`; })}
        </div>
      </section>
    </div>
    <div className="col">
      <${Ranking} st=${st} cur=${cur} api=${api}/>
      <${Feed} st=${st} api=${api} limit=${4} go=${go}/>
      <${MicNote}/>
      <p className="xs muted">Hder ! · voix et note Sawalni · progression partagée avec la famille.</p>
    </div>
  </div>`;
}

/* ---------- Famille ---------- */
function Ranking({ st, cur, api }) {
  const list = st.profiles.slice().sort((a, b) => b.xp - a.xp);
  const pending = st.defis.filter(d => !d.done);
  return html`<section className="card sec" aria-label="Classement de la semaine">
    <div className="sec-h"><h2>Classement de la semaine</h2><span className="xs muted">remis à zéro le lundi</span></div>
    <div>${list.map((p, i) => html`<div key=${p.id} className="rank">
      <span className="num">${i + 1}</span><${Avatar} id=${p.av} size=${40}/>
      <div style=${{ minWidth: 0 }}><div style=${{ fontWeight: 700 }}>${p.name}${p.id === cur.id ? html` <span className="xs muted">(toi)</span>` : ''}</div><div className="xs muted num">${LEVELS[lvlOf(p.xp)].name} · ${p.xp} XP</div></div>
      ${p.id === cur.id ? html`<span></span>` : html`<button type="button" className="btn sm ghost" disabled=${pending.some(d => d.from === cur.id && d.to === p.id)} onClick=${() => api.defi(cur.id, p.id)}>${pending.some(d => d.from === cur.id && d.to === p.id) ? 'Défi lancé' : 'Défier'}</button>`}
    </div>`)}</div>
  </section>`;
}

function Feed({ st, api, limit }) {
  const items = limit ? st.feed.slice(0, limit) : st.feed;
  const pname = id => (st.profiles.find(p => p.id === id) || {}).name || 'Quelqu\'un';
  const pav = id => (st.profiles.find(p => p.id === id) || {}).av;
  return html`<section className="card sec" aria-label="Fil de la famille">
    <div className="sec-h"><h2>Fil de la famille</h2></div>
    <div>${items.map(it => { const mine = !!st.bravos[it.id]; return html`<div key=${it.id} className="feed-it">
      <${Avatar} id=${pav(it.who)} size=${36}/>
      <div style=${{ minWidth: 0 }}><div><b>${pname(it.who)}</b> ${it.text}</div><div className="xs muted">${ago(it.ts)}${it.ex ? html` · <span className="pill ex">exemple</span>` : ''}</div></div>
      <button type="button" className=${'bravo' + (mine ? ' on' : '')} onClick=${() => api.bravo(it.id)} aria-pressed=${mine}>Bsa7tek ! ${(it.bravo || 0) + (mine ? 1 : 0)}</button>
    </div>`; })}</div>
  </section>`;
}

function Family({ st, cur, api, go }) {
  const pname = id => (st.profiles.find(p => p.id === id) || {}).name;
  const pending = st.defis.filter(d => !d.done);
  return html`<div className="stack" style=${{ gap: '20px' }}>
    <h2>La famille</h2>
    <section className="card stack">
      <div className="eyebrow">Mode Troupe</div>
      <h3>Jouez la scène à plusieurs</h3>
      <p className="muted">Chacun prend un rôle de son genre. Dans les scènes des enfants, les parents peuvent jouer la maman de Yassine, Hamza, la boulangère ou le pâtissier. L'appli joue les rôles libres. On se passe le téléphone.</p>
      <div className="troupe-list">${sceneList(cur.track).map(sid => html`<button key=${sid} type="button" className="btn soft" onClick=${() => go('scene', { sid, mode: 'troupe' })}><span aria-hidden="true">${SCN[sid].emoji}</span>${SCN[sid].title}</button>`)}</div>
    </section>
    ${pending.length > 0 && html`<section className="card stack"><h3>Défis en cours</h3>${pending.map(d => html`<div key=${d.id} className="row small"><b>${pname(d.from)}</b> défie <b>${pname(d.to)}</b>. Le premier qui finit une manche de scène gagne 25 XP.</div>`)}</section>`}
    <${Parents} st=${st} api=${api}/>
    <${Ranking} st=${st} cur=${cur} api=${api}/>
    <${Feed} st=${st} api=${api}/>
    <p className="small muted">Chacun peut jouer sur son téléphone : la progression, le fil, les défis et les tirelires sont partagés avec toute la famille.</p>
  </div>`;
}

/* ---------- Profils ---------- */
function Who({ st, cur, api, go, first }) {
  return html`<div className="stack" style=${{ gap: '20px' }}>
    ${first ? html`<h2>Qui joue sur ce téléphone ?</h2>` : html`<${BackBar} go=${go} title="Qui joue ?"/>`}
    <p className="muted">Touche « Jouer » sur ton profil. Tu pourras changer plus tard dans Réglages.</p>
    ${st.profiles.map(p => html`<section key=${p.id} className=${'card prof' + (p.id === cur.id ? ' cur' : '')}>
      <div className="row"><${Avatar} id=${p.av} size=${52}/><div style=${{ flex: 1, minWidth: 0 }}><div className="player-name" style=${{ fontSize: '20px' }}>${p.name}</div><div className="small muted num">Niveau ${lvlOf(p.xp) + 1} · ${p.xp} XP${p.test ? ' · test : niveau ' + p.test.lvl : ''}</div></div>
        ${p.id === cur.id ? html`<span className="pill acc">En jeu</span>` : html`<button type="button" className="btn sm" onClick=${() => { api.setCur(p.id); go('home'); }}>Jouer</button>`}</div>
      <div className="field"><label htmlFor=${'n-' + p.id}>Prénom</label><input id=${'n-' + p.id} className="input" value=${p.name} maxLength="20" onChange=${e => api.patchProfile(p.id, { name: e.target.value })}/></div>
      <div className="row">
        <div className="seg" role="group" aria-label="Genre"><button type="button" className=${p.g === 'm' ? 'on' : ''} onClick=${() => api.patchProfile(p.id, { g: 'm' })}>Homme ou garçon</button><button type="button" className=${p.g === 'f' ? 'on' : ''} onClick=${() => api.patchProfile(p.id, { g: 'f' })}>Femme ou fille</button></div>
        <div className="seg" role="group" aria-label="Parcours"><button type="button" className=${p.track === 'adultes' ? 'on' : ''} onClick=${() => api.patchProfile(p.id, { track: 'adultes' })}>Adultes</button><button type="button" className=${p.track === 'ados' ? 'on' : ''} onClick=${() => api.patchProfile(p.id, { track: 'ados' })}>Ados</button></div>
      </div>
      <div className="field"><label>Avatar</label><div className="av-pick">${Object.keys(AV).map(k => html`<button key=${k} type="button" className=${p.av === k ? 'on' : ''} onClick=${() => api.patchProfile(p.id, { av: k })} aria-label=${AV[k].name} title=${AV[k].name}><${Avatar} id=${k} size=${40}/></button>`)}</div><span className="xs muted">${AV[p.av].name}</span></div>
      <label className="toggle" htmlFor=${'e-' + p.id}><input id=${'e-' + p.id} type="checkbox" checked=${!!p.ear} onChange=${e => api.patchProfile(p.id, { ear: e.target.checked })}/>À l'oreille seulement (QCM sans texte)</label>
    </section>`)}
  </div>`;
}

/* ---------- Test de niveau ---------- */
function Test({ cur, api, go }) {
  const [i, setI] = useState(0);
  const [ok, setOk] = useState(0);
  const [pick, setPick] = useState(null);
  const [end, setEnd] = useState(null);
  const g = cur.g;
  const q = TEST[i];
  const finish = n => {
    const lvl = n <= 2 ? 0 : (n <= 5 ? 1 : 2);
    setEnd({ lvl, n });
    api.patchProfile(cur.id, { test: { lvl, n, d: Date.now() } });
    api.gain(cur.id, 20, 0);
    api.feed(cur.id, 'a passé le test de niveau : niveau ' + lvl);
  };
  const next = (n2) => {
    setPick(null);
    if (i === 2 && n2 === 0) { finish(0); return; }
    if (i + 1 >= TEST.length) { finish(n2); return; }
    setI(i + 1);
  };
  if (end) {
    const L = LVL_TXT[end.lvl];
    return html`<div className="stack" style=${{ gap: '20px' }}>
      <${BackBar} go=${go} title="Ton résultat"/>
      <section className="card stack lvlup"><div className="eyebrow">Test terminé · ${end.n} bonnes réponses sur 7</div><div className="big burst">${L.t}</div><p className="muted" style=${{ maxWidth: '44ch' }}>${L.d}</p><div className="pill acc">+20 XP</div></section>
      <button type="button" className="btn block" onClick=${() => go(end.lvl === 0 ? 'kit' : 'scene')}>${end.lvl === 0 ? 'Ouvrir le kit de survie' : 'Jouer au hanout'}</button>
      <button type="button" className="btn block ghost" onClick=${() => go('home')}>Retour à l'accueil</button>
    </div>`;
  }
  const qAudio = q.t === 'rep' ? clipOf(q.a, q.av || 'm') : (BYID[q.a].kind === 'kit' ? clipOf(q.a, other(g)) : clipOf(q.a, 'm'));
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <${BackBar} go=${go} title="Test de niveau"/>
    <${Steps} n=${TEST.length} i=${i}/>
    <div className="eyebrow">Question ${i + 1} / ${TEST.length} · ${q.t === 'sens' ? 'Écoute' : q.t === 'rep' ? 'Réaction' : 'Parole'}</div>
    ${q.t !== 'dire' ? html`<section className="card stack">
      <div className="row"><${PlayBtn} key=${'q' + i} clip=${qAudio} big ic label="Écouter la question"/><p className="prompt" style=${{ flex: 1, minWidth: 0, fontSize: '19px' }}>${q.q}</p></div>
      <${Options} key=${'o' + i} q=${q} g=${g} ear=${cur.ear} pick=${pick} onPick=${k => { if (pick !== null) return; setPick(k); if (k === q.c) setOk(ok + 1); }}/>
      ${pick !== null && html`<div className="row" style=${{ justifyContent: 'space-between' }}><span className=${'verdict ' + (pick === q.c ? 'ok' : 'ko')}>${pick === q.c ? 'Bien vu !' : 'Pas grave, la bonne réponse est en vert.'}</span><button type="button" className="btn" onClick=${() => next(ok)}>Suivant</button></div>`}
    </section>` : html`<section className="card stack">
      <p className="prompt">Répète à voix haute :</p>
      <div className="lat xl">${textOf(q.a, g).lat}</div><div className="fr">${textOf(q.a, g).fr}</div>
      <div className="row"><${PlayBtn} key=${'d' + i} clip=${clipOf(q.a, g)}/><${PlayBtn} clip=${clipOf(q.a, g)} slow/></div>
      <p className="small muted">Ces 3 phrases ne comptent pas dans ton niveau. Elles t'habituent à parler.</p>
      <${Speak} key=${'sp' + i} who=${cur} api=${api} target=${arOf(q.a, g)} clip=${clipOf(q.a, g)} lat=${textOf(q.a, g).lat} onGrade=${() => { api.gain(cur.id, 0, 0); next(ok); }}/>
      <${MicNote}/>
    </section>`}
  </div>`;
}

function Options({ q, g, ear, pick, onPick }) {
  return html`<div className="opts">${q.o.map((o, k) => {
    const st = pick === null ? '' : (k === q.c ? ' ok' : (k === pick ? ' ko' : ''));
    if (q.t === 'sens') return html`<button key=${k} type="button" className=${'opt' + st} onClick=${() => onPick(k)}><span className="opt-main"><b>${o}</b></span>${pick !== null && k === q.c ? html`<${Icon} n="check"/>` : ''}</button>`;
    const p = textOf(o, g);
    return html`<div key=${k} className="opt-wrap"><${PlayBtn} clip=${clipOf(o, g)} ic label=${'Écouter la réponse ' + (k + 1)} alt/>
      <button type="button" className=${'opt' + st} onClick=${() => onPick(k)}><span className="opt-main">${ear && pick === null ? html`<b>Réponse ${k + 1}</b>` : html`<b>${p.lat}</b>`}${pick !== null ? html`<span className="small muted">${p.fr}</span>` : ''}</span></button></div>`;
  })}</div>`;
}

/* ---------- Kit de survie ---------- */
function Kit({ cur, api, go, params }) {
  const p0 = params || {};
  const [tab, setTab] = useState(p0.tab || (p0.mode ? 'train' : 'pol'));
  const [mode, setMode] = useState(p0.mode || null);
  const g = cur.g;
  const weakest = KIT.map(p => p.id).concat(POL_YOU).sort((a, b) => (cur.stars[a] || 0) - (cur.stars[b] || 0)).slice(0, 8);
  const pickTab = k => { stopClip(); setTab(k); setMode(null); };
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <${BackBar} go=${go} title="Kit de survie"/>
    <p className="muted">La politesse selon les situations, les phrases pour te débrouiller et le vocabulaire du quotidien.</p>
    <div className="seg tabs4" role="tablist" aria-label="Rubrique">
      ${[['pol', 'Politesse'], ['ess', 'Essentiels'], ['voc', 'Vocabulaire'], ['train', "S'entraîner"]].map(([k, t]) => html`<button key=${k} type="button" role="tab" aria-selected=${tab === k} className=${tab === k ? 'on' : ''} onClick=${() => pickTab(k)}>${t}</button>`)}
    </div>
    ${tab === 'pol' && html`<${PolList} cur=${cur} g=${g}/>`}
    ${tab === 'ess' && html`<section className="card">${KIT.map(p => html`<div key=${p.id} className="phr">
      <div style=${{ minWidth: 0 }}><div className="lat">${p.lat}</div><div className="fr">${p.fr}</div><${Stars} n=${cur.stars[p.id] || 0}/></div>
      <div className="row" style=${{ gap: '6px', flexWrap: 'nowrap' }}><${PlayBtn} clip=${clipOf(p.id, g)} ic/><${PlayBtn} clip=${clipOf(p.id, g)} slow ic/></div>
    </div>`)}</section>`}
    ${tab === 'voc' && html`<${VocList} g=${g}/>`}
    ${tab === 'train' && !mode && html`<div className="train">
      ${[['echo', 'Écho', 'Écoute une phrase, répète-la, dis comment c\'était. Les phrases les moins sûres d\'abord.'],
         ['reply', 'Que répondre ?', 'On te dit une formule de politesse : choisis la bonne réponse et écoute-la.'],
         ['words', "Vocabulaire à l'oreille", 'Tu entends un mot, tu choisis la bonne image. Idéal pour les enfants.'],
         ['flash', 'QCM éclair', 'Cinq phrases essentielles : qu\'est-ce que ça veut dire ?']].map(([k, t, d]) => html`<button key=${k} type="button" className="card tcard" onClick=${() => setMode(k)}><b className="node-t">${t}</b><span className="small muted">${d}</span></button>`)}
    </div>`}
    ${tab === 'train' && mode && html`<button type="button" className="btn sm ghost" style=${{ justifySelf: 'start' }} onClick=${() => { stopClip(); setMode(null); }}><${Icon} n="back" s=${16}/>Tous les exercices</button>`}
    ${tab === 'train' && mode === 'echo' && html`<${Echo} key=${'echo'} cur=${cur} api=${api} ids=${p0.ids || weakest} go=${go}/>`}
    ${tab === 'train' && mode === 'reply' && html`<${Reply} key=${'reply'} cur=${cur} api=${api}/>`}
    ${tab === 'train' && mode === 'words' && html`<${WordQuiz} key=${'words'} cur=${cur} api=${api} cat0=${p0.cat}/>`}
    ${tab === 'train' && mode === 'flash' && html`<${Flash} key=${'qcm'} cur=${cur} api=${api}/>`}
  </div>`;
}

function SeqBtn({ clips, label }) {
  const [on, setOn] = useState(false);
  const run = useRef(0);
  useEffect(() => () => { run.current++; }, []);
  const go = async () => {
    if (on) { run.current++; stopClip(); setOn(false); return; }
    const r = ++run.current; setOn(true);
    for (const c of clips) { if (run.current !== r) return; const ok = await playClip(c); if (!ok) break; await sleep(250); }
    if (run.current === r) setOn(false);
  };
  return html`<button type="button" className="play" onClick=${go}>${on ? html`<${Bars}/>` : html`<${Icon} n="play" s=${18}/>`}<span>${label || "Écouter l'échange"}</span></button>`;
}

function PolList({ cur, g }) {
  const ctxs = Array.from(new Set(POL.map(p => p.ctx)));
  const [ctx, setCtx] = useState(ctxs[0]);
  const list = POL.filter(p => p.ctx === ctx);
  return html`<div className="stack">
    <div className="chips scroll" role="tablist" aria-label="Situation">${ctxs.map(c => html`<button key=${c} type="button" role="tab" aria-selected=${c === ctx} className=${'chip' + (c === ctx ? ' on' : '')} onClick=${() => { stopClip(); setCtx(c); }}>${c}<span className="chip-n num">${POL.filter(p => p.ctx === c).length}</span></button>`)}</div>
    <section className="card stack-s"><div className="sec-h"><h3>${ctx}</h3><span className="xs muted">${list.length} échange${list.length > 1 ? 's' : ''}</span></div>
      <div>${list.map(p => html`<${PairCard} key=${p.id} p=${p} g=${g} cur=${cur}/>`)}</div>
    </section>
  </div>`;
}

function PairCard({ p, g, cur }) {
  const you = p.first === 'them' ? p.id + 'b' : p.id + 'a';
  const line = k => {
    const id = p.id + k, L = BYID[id], t = textOf(id, g);
    const lab = L.spk === 'you' ? (k === 'a' ? 'Tu dis' : 'Tu réponds') : (k === 'a' ? 'On te dit' : 'On te répond');
    return html`<div className=${'pl ' + L.spk}><div style=${{ minWidth: 0 }}><div className="lab">${lab}</div><div className="lat">${t.lat}</div><div className="fr small">${t.fr}</div></div><${PlayBtn} clip=${clipOf(id, g)} ic alt label=${'Écouter : ' + t.lat}/></div>`;
  };
  return html`<div className="pair">
    ${line('a')}${line('b')}
    <div className="row" style=${{ justifyContent: 'space-between' }}><${SeqBtn} clips=${[clipOf(p.id + 'a', g), clipOf(p.id + 'b', g)]}/><${Stars} n=${cur.stars[you] || 0}/></div>
    ${p.note && html`<p className="xs muted">${p.note}</p>`}
  </div>`;
}

function WordTile({ w, g }) {
  const [on, setOn] = useState(false);
  const tap = async () => { setOn(true); await playClip(clipOf(w.id, g)); setOn(false); };
  return html`<button type="button" className=${'word' + (on ? ' on' : '')} onClick=${tap} aria-label=${'Écouter ' + w.lat + ', ' + w.fr}>
    <span className="word-e" aria-hidden="true">${w.e || w.fr.charAt(0).toUpperCase()}</span>
    <b className="lat">${w.lat}</b><span className="fr small">${w.fr}</span>
  </button>`;
}

function VocList({ g }) {
  const [cat, setCat] = useState(VOCAB.length ? VOCAB[0].cat : null);
  const C = VOCAB.find(c => c.cat === cat);
  if (!C) return null;
  return html`<div className="stack">
    <div className="chips scroll" role="tablist" aria-label="Catégorie">${VOCAB.map(c => html`<button key=${c.cat} type="button" role="tab" aria-selected=${c.cat === cat} className=${'chip' + (c.cat === cat ? ' on' : '')} onClick=${() => { stopClip(); setCat(c.cat); }}>${c.title}</button>`)}</div>
    <section className="card stack"><div className="sec-h"><h3>${C.title}</h3><span className="xs muted">Touche un mot pour l'entendre</span></div>
      <div className="wgrid">${C.words.map(w => html`<${WordTile} key=${w.id} w=${w} g=${g}/>`)}</div>
    </section>
  </div>`;
}

function Reply({ cur, api }) {
  const g = cur.g;
  const make = () => shuffle(POL.filter(p => p.first === 'them')).slice(0, 6).map(p => {
    const right = p.id + 'b', rl = textOf(right, g).lat, wrong = [];
    const near = (x, y) => { const a = x.toLowerCase(), b = y.toLowerCase(); return a.indexOf(b) >= 0 || b.indexOf(a) >= 0; };
    shuffle(POL.filter(x => x.first === 'them' && x.id !== p.id).map(x => x.id + 'b')).forEach(id => { const l = textOf(id, g).lat; if (wrong.length < 2 && !near(l, rl) && !wrong.some(u => near(textOf(u, g).lat, l))) wrong.push(id); });
    const o = shuffle([right].concat(wrong));
    return { t: 'rep', a: p.id + 'a', o, c: o.indexOf(right), note: p.note };
  });
  const [qs, setQs] = useState(make);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [ok, setOk] = useState(0);
  const combo = useRef(0);
  if (i >= qs.length) return html`<${ModuleEnd} cur=${cur} api=${api} mkey="kit-reply" ok=${ok} n=${qs.length} unit="bonnes réponses" again="Encore 6 formules" onAgain=${() => { setQs(make()); setI(0); setOk(0); setPick(null); }}/>`;
  const q = qs[i], said = textOf(q.a, g);
  return html`<section className="card stack">
    <${Steps} n=${qs.length} i=${i}/>
    <div className="row"><${PlayBtn} key=${'r' + i} clip=${clipOf(q.a, g)} big ic label="Écouter ce qu'on te dit"/><p className="prompt" style=${{ flex: 1, minWidth: 0, fontSize: '19px' }}>On te dit ça. Que réponds-tu ?</p></div>
    <${Options} key=${'o' + i} q=${q} g=${g} ear=${cur.ear} pick=${pick} onPick=${k => { if (pick !== null) return; setPick(k); if (k === q.c) { combo.current++; setOk(ok + 1); api.gain(cur.id, 5 * (combo.current >= 5 ? 2 : 1), 0); } else combo.current = 0; }}/>
    ${pick !== null && html`<div className="stack-s"><p className="small"><b>On t'a dit :</b> ${said.lat} = ${said.fr}</p>${q.note && html`<p className="xs muted">${q.note}</p>`}
      <div className="row" style=${{ justifyContent: 'space-between' }}><span className=${'verdict ' + (pick === q.c ? 'ok' : 'ko')}>${pick === q.c ? 'Bien répondu ! +5 XP' : 'La bonne réponse est en vert.'}</span><button type="button" className="btn" onClick=${() => { setPick(null); setI(i + 1); }}>Suivant</button></div></div>`}
  </section>`;
}

function WordQuiz({ cur, api, cat0 }) {
  const g = cur.g;
  const [cat, setCat] = useState(cat0 && (cat0 === 'all' || VOCAB.some(c => c.cat === cat0)) ? cat0 : 'all');
  const poolOf = c => c === 'all' ? WORDS : (VOCAB.find(x => x.cat === c) || { words: [] }).words;
  const make = c => { const pool = poolOf(c); return shuffle(pool).slice(0, 8).map(w => { const o = shuffle([w].concat(shuffle(pool.filter(x => x.id !== w.id && x.fr !== w.fr)).slice(0, 3))); return { w, o, c: o.indexOf(w) }; }); };
  const [qs, setQs] = useState(() => make(cat));
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [ok, setOk] = useState(0);
  const combo = useRef(0);
  const restart = c => { stopClip(); setCat(c); setQs(make(c)); setI(0); setOk(0); setPick(null); };
  const head = html`<div className="chips scroll" aria-label="Catégorie">${[{ cat: 'all', title: 'Tout mélangé' }].concat(VOCAB).map(c => html`<button key=${c.cat} type="button" className=${'chip' + (c.cat === cat ? ' on' : '')} onClick=${() => restart(c.cat)}>${c.title}</button>`)}</div>`;
  if (i >= qs.length) return html`<div className="stack">${head}<${ModuleEnd} key=${'end-' + cat} cur=${cur} api=${api} mkey=${'voc-' + cat} ok=${ok} n=${qs.length} unit="mots reconnus à l'oreille" again="Encore 8 mots" onAgain=${() => restart(cat)}/></div>`;
  const q = qs[i];
  return html`<div className="stack">${head}<section className="card stack">
    <${Steps} n=${qs.length} i=${i}/>
    <div className="row"><${PlayBtn} key=${'w' + i} clip=${clipOf(q.w.id, g)} big ic label="Écouter le mot"/><p className="prompt" style=${{ flex: 1, minWidth: 0, fontSize: '19px' }}>Écoute. C'est quoi ?</p></div>
    <div className="wopts">${q.o.map((w, k) => { const st = pick === null ? '' : (k === q.c ? ' ok' : (k === pick ? ' ko' : '')); return html`<button key=${w.id} type="button" className=${'wopt' + st} onClick=${() => { if (pick !== null) return; setPick(k); if (k === q.c) { combo.current++; setOk(ok + 1); api.gain(cur.id, 5 * (combo.current >= 5 ? 2 : 1), 0); } else combo.current = 0; }}>
      <span className="word-e" aria-hidden="true">${w.e || w.fr.charAt(0).toUpperCase()}</span><b>${w.fr}</b>${pick !== null && html`<span className="small muted">${w.lat}</span>`}</button>`; })}</div>
    ${pick !== null && html`<div className="row" style=${{ justifyContent: 'space-between' }}><span className=${'verdict ' + (pick === q.c ? 'ok' : 'ko')}>${pick === q.c ? 'Bien vu ! ' + q.w.lat + ' = ' + q.w.fr : q.w.lat + ' = ' + q.w.fr}</span><button type="button" className="btn" onClick=${() => { setPick(null); setI(i + 1); }}>Suivant</button></div>`}
  </section></div>`;
}

function Echo({ cur, api, ids, go }) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);
  const combo = useRef(0);
  const [cb, setCb] = useState(0);
  const [tot, setTot] = useState(0);
  const [good, setGood] = useState(0);
  const g = cur.g;
  const id = ids[i];
  useEffect(() => { if (id) { const t = setTimeout(() => playClip(clipOf(id, g)), 250); return () => clearTimeout(t); } }, [i]);
  if (!id) return html`<div className="stack"><${ModuleEnd} cur=${cur} api=${api} mkey="kit-echo" ok=${good} n=${ids.length} unit=${'phrases réussies (« Bien dit » ou « Presque ») · +' + tot + ' XP'}/><button type="button" className="btn ghost" onClick=${() => go('home')}>Retour à l'accueil</button></div>`;
  const p = textOf(id, g);
  const pick = r => {
    combo.current = r === 'bien' ? combo.current + 1 : 0; setCb(combo.current);
    const pts = PTS[r] * (r === 'bien' && combo.current >= 5 ? 2 : 1);
    const s0 = cur.stars[id] || 0;
    api.setStar(cur.id, id, r === 'bien' ? Math.min(5, s0 + 1) : (r === 'revoir' ? Math.max(0, s0 - 1) : Math.max(1, s0)));
    api.gain(cur.id, pts, 0);
    setTot(tot + pts);
    if (r !== 'revoir') setGood(good + 1);
    setI(i + 1);
  };
  return html`<section className="card stack">
    <div className="row" style=${{ justifyContent: 'space-between' }}><${Steps} n=${ids.length} i=${i}/></div>
    <div className="row" style=${{ justifyContent: 'space-between' }}><span className="eyebrow">Phrase ${i + 1} / ${ids.length}</span>${cb >= 5 && html`<span className="combo">Combo ×2</span>`}</div>
    <div className="row"><${PlayBtn} key=${'m' + i} clip=${clipOf(id, g)} big ic label="Écouter le modèle"/><${PlayBtn} clip=${clipOf(id, g)} slow/></div>
    ${show ? html`<div><div className="lat xl">${p.lat}</div><div className="fr">${p.fr}</div></div>` : html`<button type="button" className="reveal" onClick=${() => setShow(true)}>Voir la phrase</button>`}
    <label className="toggle small" htmlFor="echo-hide"><input id="echo-hide" type="checkbox" checked=${!show} onChange=${e => setShow(!e.target.checked)}/>Cacher le texte (pour travailler l'oreille)</label>
    <p className="prompt" style=${{ fontSize: '18px' }}>Écoute, puis répète à voix haute.</p>
    <${Speak} key=${'sp' + i} who=${cur} api=${api} target=${arOf(id, g)} clip=${clipOf(id, g)} lat=${p.lat} onGrade=${pick}/>
    <${MicNote}/>
  </section>`;
}

function Flash({ cur, api }) {
  const make = () => shuffle(KIT).slice(0, 5).map(p => { const wrong = shuffle(KIT.filter(x => x.id !== p.id)).slice(0, 2).map(x => x.fr); const o = shuffle([p.fr].concat(wrong)); return { t: 'sens', a: p.id, o, c: o.indexOf(p.fr) }; });
  const [qs, setQs] = useState(make);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [ok, setOk] = useState(0);
  const combo = useRef(0);
  const g = cur.g;
  if (i >= qs.length) return html`<${ModuleEnd} cur=${cur} api=${api} mkey="kit-flash" ok=${ok} n=${qs.length} unit="bonnes réponses" again="Encore 5 questions" onAgain=${() => { setQs(make()); setI(0); setOk(0); setPick(null); }}/>`;
  const q = qs[i];
  return html`<section className="card stack">
    <${Steps} n=${qs.length} i=${i}/>
    <div className="row"><${PlayBtn} key=${'f' + i} clip=${clipOf(q.a, other(g))} big ic label="Écouter"/><p className="prompt" style=${{ flex: 1, fontSize: '19px' }}>Qu'est-ce que ça veut dire ?</p></div>
    <${Options} q=${q} g=${g} pick=${pick} onPick=${k => { if (pick !== null) return; setPick(k); if (k === q.c) { combo.current++; setOk(ok + 1); api.gain(cur.id, 5 * (combo.current >= 5 ? 2 : 1), 0); } else combo.current = 0; }}/>
    ${pick !== null && html`<div className="row" style=${{ justifyContent: 'space-between' }}><span className=${'verdict ' + (pick === q.c ? 'ok' : 'ko')}>${pick === q.c ? 'Bien vu !' : textOf(q.a, g).lat + ' = ' + textOf(q.a, g).fr}</span><button type="button" className="btn" onClick=${() => { setPick(null); setI(i + 1); }}>Suivant</button></div>`}
  </section>`;
}

/* ---------- Scènes ---------- */
function SceneArt({ S }) {
  if (S.id === 'hanout') return html`<${HanoutArt}/>`;
  return html`<div className=${'scene-banner b-' + S.id} aria-hidden="true"><span>${S.emoji}</span></div>`;
}

function ScenesList({ cur, go }) {
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <h2>Les scènes</h2>
    <p className="muted">Une manche validée rapporte 1 dirham à chaque joueur, une fois par jour.</p>
    <div className="scn-grid">${sceneList(cur.track).map(sid => { const S = SCN[sid]; return html`<section key=${sid} className="card stack scn-card">
      <div className="row" style=${{ gap: '12px', flexWrap: 'nowrap' }}><span className="scn-emo" aria-hidden="true">${S.emoji}</span><div style=${{ minWidth: 0 }}><h3>${S.title}</h3>${KIDS.includes(sid) && html`<div className="xs muted">Scène des enfants</div>`}</div></div>
      <p className="small muted">${S.intro}</p>
      <div className="pills">${S.manches.map(M => { const g = cur.manches[sid + '-' + M.m]; return html`<span key=${M.m} className=${'pill ' + (g ? GALON[g] : '')}>${M.title}${g ? ' · ' + GALON[g] : ''}</span>`; })}</div>
      <div className="row"><button type="button" className="btn" onClick=${() => go('scene', { sid })}>Jouer</button><button type="button" className="btn ghost" onClick=${() => go('scene', { sid, mode: 'troupe' })}>En troupe</button></div>
    </section>`; })}</div>
  </div>`;
}

const roleTitle = (S, r, g) => (r === S.hero && S.id !== 'hanout') ? 'Le personnage principal (« toi »)' : S.roles[r].lab(g);

function Scene({ st, cur, api, go, params }) {
  const S = SCN[(params && params.sid) || 'hanout'] || SCN.hanout;
  const [m, setM] = useState((params && params.m) || 1);
  const [mode, setMode] = useState((params && params.mode) || 'solo');
  const [cast, setCast] = useState(() => { const c = {}; Object.keys(S.roles).forEach(k => { c[k] = null; }); c[S.hero] = cur.id; return c; });
  const [step, setStep] = useState('intro');
  const [help, setHelp] = useState(!cur.test || cur.test.lvl === 0);
  const P = id => st.profiles.find(p => p.id === id);
  const M = S.manches.find(x => x.m === m) || S.manches[0];
  const lines = M.lines;
  const rolesIn = Array.from(new Set(lines.map(l => l.role)));
  const eligible = role => st.profiles.filter(p => S.elig(role, p, m));
  const who = role => {
    if (mode === 'solo') return role === S.solo(m, cur) ? cur.id : null;
    const c = rolesIn.includes(role) ? cast[role] : null;
    return c && eligible(role).some(p => p.id === c) ? c : null;
  };
  const heroP = who(S.hero) ? P(who(S.hero)) : null;
  const cg = heroP ? heroP.g : 'm';
  const humans = Array.from(new Set(rolesIn.map(who).filter(Boolean)));
  const setRole = (role, pid) => { const c = { ...cast }; Object.keys(c).forEach(k => { if (c[k] === pid) c[k] = null; }); c[role] = pid || null; setCast(c); };
  useEffect(() => () => stopClip(), []);
  const start = s => { stopClip(); setStep(s); };
  const N = S.manches.find(x => x.m === m + 1);

  if (step === 'ecoute') return html`<${Listen} S=${S} lines=${lines} cg=${cg} who=${who} m=${m} onDone=${() => start('jeu')} onBack=${() => start('intro')}/>`;
  if (step === 'jeu') return html`<${Play} S=${S} lines=${lines} cg=${cg} who=${who} P=${P} m=${m} api=${api} help=${help} humans=${humans} onBack=${() => start('intro')} onEnd=${res => { resRef.current = res; start('qcm'); }}/>`;
  if (step === 'qcm') return html`<${SceneQcm} M=${M} m=${m} cg=${cg} humans=${humans} P=${P} api=${api} onEnd=${q => { qRef.current = q; start('fin'); }}/>`;
  if (step === 'fin') return html`<${SceneEnd} S=${S} M=${M} N=${N} m=${m} humans=${humans} P=${P} st=${st} api=${api} go=${go} onReplay=${() => start('intro')} onNext=${() => { if (N) setM(N.m); start('intro'); }}/>`;

  const soloRole = S.solo(m, cur);
  const lc = x => /^(L'|La |Le |Sa )/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x;
  const others = rolesIn.filter(r => r !== soloRole).map(r => S.roles[r].short || lc(S.roles[r].lab(cur.g)));
  const othersTxt = others.length > 1 ? others.slice(0, -1).join(', ') + ' et ' + others[others.length - 1] : others.join('');
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <${BackBar} go=${go} to="scenes" title=${S.title}/>
    <section className="card scene-head">
      <${SceneArt} S=${S}/>
      <p className="muted">${S.intro}</p>
      <div className="seg" role="tablist" aria-label="Manche">${S.manches.map(X => { const gl = cur.manches[S.id + '-' + X.m]; return html`<button key=${X.m} type="button" role="tab" aria-selected=${m === X.m} className=${m === X.m ? 'on' : ''} onClick=${() => setM(X.m)}>Manche ${X.m}${gl ? ' · ' + GALON[gl] : ''}</button>`; })}</div>
      <div><div className="eyebrow">Manche ${m} · ${lines.length} répliques</div><h3>${M.title}</h3></div>
    </section>
    <section className="card stack">
      <div className="seg" role="tablist" aria-label="Mode de jeu"><button type="button" className=${mode === 'solo' ? 'on' : ''} onClick=${() => setMode('solo')}>Solo</button><button type="button" className=${mode === 'troupe' ? 'on' : ''} onClick=${() => setMode('troupe')}>Troupe (${rolesIn.length <= 2 ? 'à 2' : '2 à ' + Math.min(4, rolesIn.length)})</button></div>
      ${mode === 'solo' ? html`<p className="muted">${S.id === 'hanout' ? html`Tu joues <b>${S.roles[soloRole].lab(cur.g)}</b>.` : html`Tu joues <b>ton propre rôle</b>.`} Les voix Sawalni jouent ${othersTxt}.</p>` : html`<div className="stack">
        <p className="muted">Donne un rôle à chacun, du même genre que le personnage. Un rôle sans joueur est joué par l'appli.</p>
        ${rolesIn.slice().sort((a, b) => (b === S.hero) - (a === S.hero)).map(r => html`<div key=${r} className="field"><label htmlFor=${'role-' + r}>${roleTitle(S, r, r === S.hero && cast[r] ? (P(cast[r]) || {}).g : 'm')}</label>
          <select id=${'role-' + r} className="input" value=${cast[r] || ''} onChange=${e => setRole(r, e.target.value)}>
            <option value="">L'appli joue ce rôle</option>
            ${eligible(r).map(p => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}
          </select></div>`)}
        ${humans.length === 0 && html`<p className="small" style=${{ color: 'var(--bad)' }}>Donne au moins un rôle à un joueur.</p>`}
      </div>`}
      <label className="toggle small" htmlFor="help-lat"><input id="help-lat" type="checkbox" checked=${help} onChange=${e => setHelp(e.target.checked)}/>Aide : afficher la phrase à dire</label>
      <div className="stack-s">
        <button type="button" className="btn block soft" onClick=${() => start('ecoute')}>1 · Écouter la scène</button>
        <button type="button" className="btn block" disabled=${humans.length === 0} onClick=${() => start('jeu')}>2 · Jouer la scène</button>
      </div>
    </section>
  </div>`;
}
const resRef = { current: null }, qRef = { current: null };

function Bubble({ S, l, cg, me, now, name }) {
  const t = textOf(l.id, cg);
  const lab = S.roles[l.role].lab(cg);
  const label = name ? name + ' · ' + lab : lab;
  return html`<div className=${'bub ' + (me ? 'me' : 'them') + (now ? ' now' : '')}>
    <span className="who">${label}</span>
    <div className="row" style=${{ gap: '8px', flexWrap: 'nowrap', alignItems: 'flex-start' }}><div style=${{ flex: 1, minWidth: 0 }}><div className="lat">${t.lat}</div><div className="fr">${t.fr}</div></div><${PlayBtn} clip=${clipOf(l.id, cg)} ic alt label="Réécouter"/></div>
  </div>`;
}

function Listen({ S, lines, cg, who, m, onDone, onBack }) {
  const [shown, setShown] = useState(0);
  const [now, setNow] = useState(-1);
  const [on, setOn] = useState(false);
  const run = useRef(0);
  const end = useRef(null);
  const all = async () => {
    const r = ++run.current; setOn(true); setShown(0);
    for (let i = 0; i < lines.length; i++) {
      if (run.current !== r) return;
      setShown(i + 1); setNow(i);
      await playClip(clipOf(lines[i].id, cg));
      await sleep(300);
    }
    if (run.current === r) { setNow(-1); setOn(false); }
  };
  useEffect(() => { all(); return () => { run.current++; stopClip(); }; }, []);
  useEffect(() => { if (end.current && end.current.scrollIntoView) end.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [shown]);
  return html`<div className="stack" style=${{ gap: '16px' }}>
    <div className="row" style=${{ gap: '8px' }}><button type="button" className="icon-btn" onClick=${() => { run.current++; stopClip(); onBack(); }} aria-label="Retour"><${Icon} n="back"/></button><h2 style=${{ flex: 1 }}>Manche ${m} · Écoute</h2></div>
    <p className="muted">Écoute toute la scène une fois. Ne cherche pas à tout comprendre : laisse ton oreille s'habituer.</p>
    <div className="chat">${lines.slice(0, shown).map((l, i) => html`<${Bubble} key=${l.id} S=${S} l=${l} cg=${cg} me=${!!who(l.role)} now=${i === now}/>`)}<span ref=${end}></span></div>
    <div className="row">
      ${on ? html`<button type="button" className="btn ghost" onClick=${() => { run.current++; stopClip(); setOn(false); setNow(-1); setShown(lines.length); }}><${Icon} n="stop" s=${16}/>Arrêter</button>` : html`<button type="button" className="btn ghost" onClick=${all}><${Icon} n="play" s=${16}/>Réécouter</button>`}
      <button type="button" className="btn" onClick=${() => { run.current++; stopClip(); onDone(); }}>Jouer la scène</button>
    </div>
  </div>`;
}

function Play({ S, lines, cg, who, P, m, api, help, humans, onBack, onEnd }) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(help);
  const res = useRef({});
  const combo = useRef({});
  const [cb, setCb] = useState(0);
  const end = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; stopClip(); }, []);
  const l = lines[i];
  const pid = l ? who(l.role) : null;
  useEffect(() => {
    setShow(help);
    if (end.current && end.current.scrollIntoView) end.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (!l) { onEnd(res.current); return; }
    if (!pid) {
      let stop = false;
      (async () => { await sleep(350); if (stop) return; await playClip(clipOf(l.id, cg)); await sleep(350); if (!stop && alive.current) setI(x => x + 1); })();
      return () => { stop = true; };
    }
  }, [i]);
  const pick = r => {
    const c = combo.current[pid] = r === 'bien' ? (combo.current[pid] || 0) + 1 : 0; setCb(c);
    const R = res.current[pid] = res.current[pid] || { bien: 0, presque: 0, revoir: 0, xp: 0 };
    R[r]++;
    const pts = PTS[r] * (r === 'bien' && c >= 5 ? 2 : 1); R.xp += pts;
    api.gain(pid, pts, 0);
    if (l.role === S.hero) { const pr = P(pid); const s0 = (pr.stars || {})[l.id] || 0; api.setStar(pid, l.id, r === 'bien' ? Math.min(5, s0 + 1) : (r === 'revoir' ? Math.max(0, s0 - 1) : Math.max(1, s0))); }
    stopClip(); setI(i + 1);
  };
  const p = pid ? P(pid) : null;
  const t = l ? textOf(l.id, cg) : null;
  return html`<div className="stack" style=${{ gap: '16px' }}>
    <div className="row" style=${{ gap: '8px' }}><button type="button" className="icon-btn" onClick=${onBack} aria-label="Retour"><${Icon} n="back"/></button><h2 style=${{ flex: 1 }}>Manche ${m} · À vous</h2>${cb >= 5 && html`<span className="combo">Combo ×2</span>`}</div>
    <${Steps} n=${lines.length} i=${i}/>
    <div className="chat">${lines.slice(0, i + (l && !pid ? 1 : 0)).map((x, k) => html`<${Bubble} key=${x.id} S=${S} l=${x} cg=${cg} me=${!!who(x.role)} now=${k === i} name=${who(x.role) && humans.length > 1 ? (P(who(x.role)) || {}).name : ''}/>`)}</div>
    ${l && pid && html`<section className="card stack turn">
      <div className="turn-h"><${Avatar} id=${p.av} size=${44}/><div style=${{ minWidth: 0 }}><div className="eyebrow">À toi${humans.length > 1 ? ', ' + p.name : ''}</div><div style=${{ fontWeight: 700 }}>${S.roles[l.role].lab(cg)}</div></div></div>
      <p className="prompt">Dis : « ${t.fr} »</p>
      ${show ? html`<div className="lat xl">${t.lat}</div>` : html`<button type="button" className="reveal" onClick=${() => setShow(true)}>Je ne sais plus : voir la phrase</button>`}
      <div className="row"><${PlayBtn} key=${'m' + i} clip=${clipOf(l.id, cg)} label="Écouter le modèle"/><${PlayBtn} clip=${clipOf(l.id, cg)} slow/></div>
      <${Speak} key=${'sp' + i} who=${p} api=${api} target=${arOf(l.id, cg)} clip=${clipOf(l.id, cg)} lat=${t.lat} onGrade=${pick}/>
    </section>`}
    <span ref=${end}></span>
    <${MicNote}/>
  </div>`;
}

function SceneQcm({ M, m, cg, humans, P, api, onEnd }) {
  const [qs] = useState(() => M.qcm.map(q => { const idx = shuffle(q.o.map((_, k) => k)); return { ...q, o: idx.map(k => q.o[k]), c: idx.indexOf(q.c) }; }));
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const tally = useRef({});
  const q = qs[i];
  const pid = humans[i % humans.length];
  const p = P(pid);
  const g = q.t === 'rep' ? p.g : cg;
  return html`<div className="stack" style=${{ gap: '16px' }}>
    <h2>Manche ${m} · As-tu bien compris ?</h2>
    <${Steps} n=${qs.length} i=${i}/>
    <section className="card stack">
      ${humans.length > 1 && html`<div className="turn-h"><${Avatar} id=${p.av} size=${36}/><b>À toi, ${p.name}</b></div>`}
      <div className="row"><${PlayBtn} key=${'s' + i} clip=${clipOf(q.a, cg)} big ic label="Écouter"/><p className="prompt" style=${{ flex: 1, minWidth: 0, fontSize: '19px' }}>${q.q}</p></div>
      <${Options} key=${'o' + i} q=${q} g=${g} ear=${p.ear} pick=${pick} onPick=${k => { if (pick !== null) return; setPick(k); const T = tally.current[pid] = tally.current[pid] || { ok: 0, n: 0 }; T.n++; if (k === q.c) { T.ok++; api.gain(pid, 5, 0); } }}/>
      ${pick !== null && html`<div className="row" style=${{ justifyContent: 'space-between' }}><span className=${'verdict ' + (pick === q.c ? 'ok' : 'ko')}>${pick === q.c ? 'Bien vu ! +5 XP' : 'La bonne réponse est en vert.'}</span><button type="button" className="btn" onClick=${() => { setPick(null); if (i + 1 >= qs.length) onEnd(tally.current); else setI(i + 1); }}>${i + 1 >= qs.length ? 'Voir le résultat' : 'Suivant'}</button></div>`}
    </section>
  </div>`;
}

function SceneEnd({ S, M, N, m, humans, P, st, api, go, onReplay, onNext }) {
  const res = resRef.current || {}, qres = qRef.current || {};
  const done = useRef(false);
  const [mis, setMis] = useState(false);
  const key = S.id + '-' + m;
  const [before] = useState(() => { const o = {}; humans.forEach(pid => { o[pid] = modStatus(P(pid) || {}, key); }); return o; });
  const rows = humans.map(pid => {
    const R = res[pid] || { bien: 0, presque: 0, revoir: 0, xp: 0 }, Q = qres[pid] || { ok: 0, n: 0 };
    const tot = R.bien + R.presque + R.revoir;
    const gal = (tot > 0 && R.presque === 0 && R.revoir === 0 && Q.ok === Q.n) ? 3 : ((tot === 0 || R.bien / tot >= MOD_PCT) && (Q.n === 0 || Q.ok / Q.n >= MOD_PCT) ? 2 : 1);
    return { pid, R, Q, gal };
  });
  useEffect(() => {
    if (done.current) return; done.current = true;
    rows.forEach(r => { api.finishManche(r.pid, S.id, m, r.gal); api.module(r.pid, key, r.gal >= 2); });
  }, []);
  const g0 = (P(humans[0]) || {}).g || 'm';
  const ms = M.mission, mt = textOf(ms.id, g0);
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <section className="card stack lvlup">
      <div className="eyebrow">${S.title} · manche ${m} terminée</div>
      <div className="big burst">Mzyan bezzaf !</div>
      <p className="muted">+30 XP de fin de scène pour chaque joueur. Galon d'argent ou d'or : le module est validé.</p>
    </section>
    ${rows.map(r => { const p = P(r.pid); const ok = r.gal >= 2; return html`<section key=${r.pid} className="card stack">
      <div className="row"><${Avatar} id=${p.av} size=${44}/><div style=${{ flex: 1, minWidth: 0 }}><b>${p.name}</b><div className="small muted num">${r.R.bien} bien dites · ${r.R.presque} presque · ${r.R.revoir} à revoir · QCM ${r.Q.ok}/${r.Q.n}</div></div><span className=${'pill ' + GALON[r.gal]}><${Icon} n="medal" s=${14}/>${GALON[r.gal]}</span></div>
      <div className=${'mod' + (ok ? ' ok' : (before[r.pid].st === 'check' || before[r.pid].st === 'lost' ? ' ko' : ''))}><${Icon} n="coin" s=${18}/><span>${modMsg(before[r.pid], ok, "vise le galon d'argent : 60 % de « Bien dit » et de bonnes réponses")}</span></div>
    </section>`; })}
    <section className="card stack" style=${{ borderColor: 'var(--accent-2)' }}>
      <div className="eyebrow">Mission réelle · XP ×3</div>
      <p>${ms.txt}</p>
      <div className="row"><div style=${{ flex: 1, minWidth: 0 }}><div className="lat">${mt.lat}</div><div className="fr">${mt.fr}</div></div><${PlayBtn} clip=${clipOf(ms.id, g0)} ic/></div>
      <button type="button" className="btn block soft" disabled=${mis} onClick=${() => { setMis(true); humans.forEach(pid => api.mission(pid, S.id, m)); }}>${mis ? 'Mission validée · +30 XP' : "C'est fait, je l'ai dit en vrai"}</button>
    </section>
    <div className="stack-s">
      ${N && html`<button type="button" className="btn block" onClick=${onNext}>Manche ${N.m} · ${N.title}</button>`}
      <button type="button" className="btn block ghost" onClick=${onReplay}>Rejouer la manche</button>
      <button type="button" className="btn block ghost" onClick=${() => go('scenes')}>Toutes les scènes</button>
    </div>
  </div>`;
}

/* ---------- Module validé (exercices du kit) ---------- */
function ModuleEnd({ cur, api, mkey, ok, n, unit, again, onAgain }) {
  const need = Math.ceil(n * MOD_PCT);
  const pass = ok >= need;
  const [before] = useState(() => modStatus(cur, mkey));
  const done = useRef(false);
  useEffect(() => { if (done.current) return; done.current = true; api.module(cur.id, mkey, pass); }, []);
  return html`<section className="card stack lvlup">
    <div className="big burst num">${ok} / ${n}</div>
    <p className="muted">${unit}</p>
    <div className=${'mod' + (pass ? ' ok' : (before.st === 'check' || before.st === 'lost' ? ' ko' : ''))} style=${{ textAlign: 'left' }}><${Icon} n="coin" s=${18}/><span>${modMsg(before, pass, 'il faut ' + need + ' sur ' + n)}</span></div>
    ${again && html`<button type="button" className="btn" onClick=${onAgain}>${again}</button>`}
  </section>`;
}

/* ---------- Casting des voix ---------- */
function Voices({ st, api }) {
  const [copied, setCopied] = useState('');
  const txt = 'Casting Hder ! : ' + CAST_ROLES.map(([k, t]) => t + ' = ' + voiceName(st.cast[k])).join(' ; ') + (Object.keys(st.likes).filter(v => st.likes[v]).length ? ' ; voix aimées : ' + Object.keys(st.likes).filter(v => st.likes[v]).map(voiceName).join(', ') : '');
  const copy = () => { try { navigator.clipboard.writeText(txt).then(() => setCopied('Sélection copiée. Colle-la dans la conversation.'), () => setCopied('Copie refusée : sélectionne le texte ci-dessous.')); } catch (e) { setCopied('Copie refusée : sélectionne le texte ci-dessous.'); } };
  const VS = VOICES.filter(v => CAST_KEEP.includes(v));
  const tags = v => CAST_ROLES.filter(([k]) => st.cast[k] === v).map(([, t]) => t).concat(KID_CAST.filter(([w]) => w === v).map(([, t]) => t));
  const group = (title, list) => html`<div className="stack-s"><h3>${title}</h3><div className="vgrid">${list.map(v => html`<div key=${v} className=${'vtile' + (st.likes[v] ? ' like' : '')}>
    <${PlayBtn} clip=${'cast-' + v} ic label=${'Écouter ' + voiceName(v)}/>
    <div className="vtile-n"><b>${voiceName(v)}</b><span className="xs muted">${tags(v).join(', ') || ' '}</span></div>
    <button type="button" className=${'like-btn' + (st.likes[v] ? ' on' : '')} aria-pressed=${!!st.likes[v]} aria-label=${"J'aime " + voiceName(v)} onClick=${() => api.like(v)}><${Icon} n="heart" s=${18}/></button>
  </div>`)}</div></div>`;
  return html`<div className="stack" style=${{ gap: '20px' }}>
    <h2>Casting des voix</h2>
    <section className="card stack">
      <p className="muted">Les 8 voix darija de Sawalni qui jouent dans Hder !, gratuites. Chaque voix lit la même phrase :</p>
      <div><div className="lat">${CAST_PHRASE.lat}</div><div className="fr">${CAST_PHRASE.fr}</div></div>
      <p className="small muted">Les phrases de la maquette utilisent ta sélection du 5 novembre. Si tu changes un rôle ci-dessous, copie ta sélection et envoie-la-moi : je régénère toutes les phrases avec ces voix.</p>
    </section>
    ${group('Hommes', VS.filter(v => v.startsWith('male')))}
    ${group('Femmes', VS.filter(v => v.startsWith('female')))}
    <section className="card stack">
      <h3>Qui joue quoi ?</h3>
      ${CAST_ROLES.map(([k, t]) => html`<div key=${k} className="cast-row"><label htmlFor=${'cast-' + k} style=${{ fontWeight: 700 }}>${t}</label>
        <select id=${'cast-' + k} className="input" value=${st.cast[k]} onChange=${e => api.setCast(k, e.target.value)}>${VS.filter(v => k === 'm' || k === 'ep' ? v.startsWith('male') : (k === 'en' ? true : v.startsWith('female'))).map(v => html`<option key=${v} value=${v}>${voiceName(v)}</option>`)}</select>
        <${PlayBtn} clip=${'cast-' + st.cast[k]} ic alt label=${'Écouter ' + t}/></div>`)}
      <button type="button" className="btn block" onClick=${copy}><${Icon} n="copy" s=${18}/>Copier ma sélection</button>
      ${copied && html`<p className="small" role="status">${copied}</p>`}
      <textarea id="cast-txt" className="copybox" readOnly value=${txt} aria-label="Ta sélection de voix"></textarea>
    </section>
  </div>`;
}

/* ---------- Skins et niveau ---------- */
const SKINS = [
  { k: null, t: 'Automatique', d: 'Zellige le jour, Medina Night en mode sombre', sw: ['#EEF2F7', '#2F43B8', '#46E0B5'] },
  { k: 'zellige', t: 'Zellige', d: 'Sérieux : bleu Majorelle et vert zellige', sw: ['#EEF2F7', '#2F43B8', '#0E7A66'] },
  { k: 'nuit', t: 'Medina Night', d: 'Moderne : mode sombre, menthe et safran', sw: ['#0D1020', '#46E0B5', '#F4B43C'] },
  { k: 'kids', t: 'Souk Kids', d: 'Ludique : couleurs vives et formes rondes', sw: ['#FFF5E4', '#D94F00', '#00837D'] },
  { k: 'atlas', t: 'Atlas', d: 'Minimal : blanc et vert cèdre', sw: ['#F6F7F4', '#2C6A4E', '#7C5E2E'] }
];
function SkinSheet({ st, api, close }) {
  return html`<div className="overlay" onClick=${close}><div className="sheet gut" role="dialog" aria-modal="true" aria-label="Choisir un skin" onClick=${e => e.stopPropagation()}>
    <div className="row" style=${{ justifyContent: 'space-between' }}><h2>Choisis ton skin</h2><button type="button" className="icon-btn" onClick=${close} aria-label="Fermer"><${Icon} n="close"/></button></div>
    ${SKINS.map(s => html`<button key=${s.t} type="button" className=${'skin-opt' + (st.skin === s.k ? ' on' : '')} onClick=${() => api.setSkin(s.k)}>
      <span className="sw">${s.sw.map(c => html`<i key=${c} style=${{ background: c }}></i>`)}</span>
      <span><b>${s.t}</b><br/><span className="small muted">${s.d}</span></span>
    </button>`)}
  </div></div>`;
}
function LevelUp({ info, close }) {
  const L = LEVELS[info.lvl];
  return html`<div className="overlay" onClick=${close}><div className="sheet gut lvlup" role="dialog" aria-modal="true" aria-label="Nouveau niveau" onClick=${e => e.stopPropagation()}>
    <div className="eyebrow">${info.name} passe au niveau ${info.lvl + 1}</div>
    <div className="big burst">${L.name}</div>
    <p className="muted">Saison ${Math.floor(info.lvl / 3) + 1} · ${L.season}</p>
    <button type="button" className="btn block" onClick=${close}>Continuer</button>
  </div></div>`;
}

/* ---------- Données partagées par la famille ---------- */
function shared(st) {
  const ev = Object.keys(st.events || {}).map(id => ({ id, ...st.events[id] }));
  const bv = {};
  ev.forEach(e => { if (e.k === 'bravo' && e.d) (bv[e.d.item] = bv[e.d.item] || []).push(e.d.by); });
  const bravos = {};
  const feed = ev.filter(e => e.k === 'feed' && e.d).sort((a, b) => (b.d.ts || 0) - (a.d.ts || 0)).slice(0, 60).map(e => {
    const l = bv[e.id] || [];
    if (l.includes(st.cur)) bravos[e.id] = true;
    return { id: e.id, who: e.d.who, text: e.d.text, ts: e.d.ts, bravo: l.filter(x => x !== st.cur).length };
  });
  const defis = ev.filter(e => e.k === 'defi' && e.d).sort((a, b) => (a.d.ts || 0) - (b.d.ts || 0)).map(e => ({ id: e.id, ...e.d }));
  const payouts = ev.filter(e => e.k === 'payout' && e.d).map(e => ({ id: e.id, ...e.d }));
  return { feed, bravos, defis, payouts, rate: (st.settings || {}).rate || 1, pinSet: !!(st.settings || {}).pinSet };
}
// Fusion de deux versions d'un même profil (téléphone et serveur) : on garde le meilleur de chacune.
function mergeP(a, b) {
  const nw = (a.t || 0) >= (b.t || 0) ? a : b, od = nw === a ? b : a;
  const o = { ...od, ...nw };
  o.xp = Math.max(a.xp || 0, b.xp || 0);
  const mx = (x, y) => { const r = { ...(x || {}) }; Object.keys(y || {}).forEach(k => { r[k] = Math.max(r[k] || 0, y[k] || 0); }); return r; };
  o.stars = { ...(od.stars || {}), ...(nw.stars || {}) };
  o.manches = mx(a.manches, b.manches);
  o.missions = { ...(a.missions || {}), ...(b.missions || {}) };
  const m2 = { ...(od.mods2 || {}) };
  Object.keys(nw.mods2 || {}).forEach(k => { const x = nw.mods2[k], y = m2[k]; if (!y || (x.at || 0) >= (y.at || 0)) m2[k] = x; });
  o.mods2 = m2;
  const lastOf = p => { const v = String(p.last || '').split('-').map(Number); return v.length === 3 ? Date.UTC(v[0], v[1] - 1, v[2]) : 0; };
  const sk = lastOf(a) >= lastOf(b) ? a : b; o.streak = sk.streak || 0; o.last = sk.last || null;
  o.test = (nw.test || od.test) || null;
  o.t = Math.max(a.t || 0, b.t || 0);
  return o;
}

/* ---------- Rejoindre la famille ---------- */
function Join({ onJoined }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    if (e) e.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setErr('');
    try { const r = await callApi('join', { code }); onJoined(r); }
    catch (x) { setErr(x.status === 404 ? "Ce code ne marche pas. Vérifie-le avec Papa ou Maman." : "Pas de connexion. Réessaie quand tu as du réseau."); }
    setBusy(false);
  };
  return html`<main className="wrap gut join"><form className="card stack" onSubmit=${submit}>
    <div className="join-logo" aria-hidden="true"><img src="icons/icon-192.png" alt="" width="88" height="88"/></div>
    <h1 className="brand" style=${{ fontSize: '40px', textAlign: 'center' }}>Hder<b> !</b></h1>
    <p className="muted" style=${{ textAlign: 'center' }}>Parle darija sans peur, en famille.</p>
    <div className="field"><label htmlFor="fam-code">Code de la famille</label>
      <input id="fam-code" className="input code-in" autoComplete="off" autoCapitalize="characters" spellCheck="false" placeholder="IAZZA-XXXXX" value=${code} onChange=${e => setCode(e.target.value.toUpperCase())}/></div>
    <button type="submit" className="btn block" disabled=${busy || !code.trim()}>${busy ? 'Connexion…' : 'Entrer'}</button>
    ${err && html`<p className="small c-bad" role="alert">${err}</p>`}
    <p className="xs muted">Le code est donné une fois par un parent. Ensuite, ce téléphone reste connecté à la famille.</p>
  </form></main>`;
}

/* ---------- Espace parents (code vérifié par le serveur) ---------- */
function Parents({ st, api }) {
  const [pin, setPin] = useState('');
  const [okPin, setOkPin] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [amt, setAmt] = useState({});
  const [newPin, setNewPin] = useState(null);
  const [credit, setCredit] = useState(null);
  const unlock = async () => {
    if (!/^\d{4}$/.test(pin)) { setErr('Le code doit faire 4 chiffres.'); return; }
    setBusy(true); setErr('');
    try {
      if (!st.pinSet) { await callApi('pin', { pin }); api.pinSet(); setOkPin(pin); }
      else { const r = await callApi('pin', { pin, check: true }); if (r.ok) setOkPin(pin); else setErr('Code incorrect.'); }
      setPin('');
    } catch (e) { setErr('Pas de connexion : l’espace parents a besoin du réseau.'); }
    setBusy(false);
  };
  useEffect(() => { if (okPin) callApi('credits').then(setCredit).catch(() => {}); }, [okPin]);
  if (!okPin) return html`<section className="card stack">
    <div className="eyebrow">Espace parents</div>
    <h3>Convertir les dirhams en vrais dirhams</h3>
    <p className="small muted">${st.pinSet ? 'Entre ton code parent pour ouvrir.' : 'Choisis un code parent à 4 chiffres. Les enfants ne pourront pas toucher aux tirelires.'}</p>
    <div className="row" style=${{ flexWrap: 'nowrap' }}><label className="sr" htmlFor="pin">Code parent</label><input id="pin" className="input pin num" type="password" inputMode="numeric" autoComplete="off" maxLength="4" placeholder="••••" value=${pin} onChange=${e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown=${e => { if (e.key === 'Enter') unlock(); }}/><button type="button" className="btn" disabled=${busy} onClick=${unlock}>${st.pinSet ? 'Ouvrir' : 'Créer le code'}</button></div>
    ${err && html`<p className="small c-bad" role="alert">${err}</p>`}
  </section>`;
  const rate = st.rate || 1;
  const list = st.profiles.slice().sort((a, b) => (a.track === 'ados' ? 0 : 1) - (b.track === 'ados' ? 0 : 1));
  const hist = (st.payouts || []).slice().sort((a, b) => b.at - a.at);
  const pname = id => (st.profiles.find(p => p.id === id) || {}).name || '?';
  const hours = credit ? credit.balance / 0.000254 / 3600 : null;
  return html`<section className="card stack parents">
    <div className="sec-h"><div><div className="eyebrow">Espace parents</div><h3>Convertir les dirhams</h3></div><button type="button" className="btn sm ghost" onClick=${() => setOkPin(null)}><${Icon} n="lock" s=${16}/>Fermer</button></div>
    <p className="small muted">Tu donnes les vrais dirhams de la main à la main, puis tu enregistres le versement ici : il est retiré de la tirelire. Seuls les dirhams sûrs sont convertibles, pas ceux qui sont en contrôle.</p>
    <div className="field"><label htmlFor="rate">Taux : 1 dirham Hder ! = combien de vrais dirhams ?</label><input id="rate" className="input num" type="number" min="0" step="0.5" defaultValue=${rate} onBlur=${e => api.setRate(Math.max(0, Number(e.target.value) || 0), okPin)}/></div>
    ${list.map(p => { const w = wallet(p, st.payouts); const v = amt[p.id] !== undefined ? amt[p.id] : w.conv; const n = Math.max(0, Math.min(w.conv, Math.floor(Number(v) || 0))); return html`<div key=${p.id} className="pay-row">
      <div className="row" style=${{ flexWrap: 'nowrap' }}><${Avatar} id=${p.av} size=${40}/><div style=${{ flex: 1, minWidth: 0 }}><b>${p.name}</b><div className="xs muted num">${w.tirelire} dans la tirelire · ${w.J} en jeu · ${w.L} à reconquérir · ${w.C} déjà versés</div></div></div>
      ${w.deficit > 0 && html`<p className="xs c-bad">${w.deficit} dirham${w.deficit > 1 ? 's' : ''} déjà versé${w.deficit > 1 ? 's' : ''} ${w.deficit > 1 ? 'ont' : 'a'} été perdu${w.deficit > 1 ? 's' : ''} depuis : à regagner avant le prochain versement.</p>`}
      <div className="row" style=${{ flexWrap: 'nowrap' }}><label className="sr" htmlFor=${'amt-' + p.id}>Dirhams à convertir pour ${p.name}</label><input id=${'amt-' + p.id} className="input num" type="number" min="0" max=${w.conv} value=${v} disabled=${w.conv === 0} onChange=${e => setAmt({ ...amt, [p.id]: e.target.value })} style=${{ width: '90px' }}/><button type="button" className="btn soft" disabled=${n === 0} onClick=${async () => { if (await api.payout(p.id, n, okPin)) setAmt({ ...amt, [p.id]: undefined }); }}>Verser ${n} DH${rate !== 1 ? ' = ' + (n * rate) + ' vrais DH' : ''}</button></div>
    </div>`; })}
    ${hist.length > 0 && html`<div className="stack-s"><h3>Versements</h3>${hist.map(x => html`<div key=${x.id} className="row small" style=${{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span><b>${pname(x.pid)}</b> · ${x.amount} DH${(x.rate || 1) !== 1 ? ' (' + (x.amount * x.rate) + ' vrais DH)' : ''} · ${new Date(x.at).toLocaleDateString('fr-FR')}</span><button type="button" className="btn sm ghost" onClick=${() => api.unpay(x.id, okPin)}>Annuler</button></div>`)}</div>`}
    <div className="stack-s"><h3>Ajouter un téléphone</h3><p className="small">Sur le nouveau téléphone, ouvre Hder ! et tape le code de la famille : <b className="num code-show">${(st.settings && st.settings.code) || '—'}</b></p></div>
    ${credit && html`<div className="stack-s"><h3>Note de prononciation</h3><p className="small muted">Crédit gratuit restant : environ ${hours >= 1 ? Math.floor(hours) + ' h' : Math.round(hours * 60) + ' min'} de paroles notées (${Math.round(100 * credit.balance / (credit.initial || 10))} %). Aujourd'hui : ${Math.round(credit.today.seconds / 60)} min sur ${Math.round(credit.limit / 60)} min autorisées.</p></div>`}
    ${newPin === null ? html`<button type="button" className="btn sm ghost" style=${{ justifySelf: 'start' }} onClick=${() => setNewPin('')}>Changer le code parent</button>` : html`<div className="row" style=${{ flexWrap: 'nowrap' }}><label className="sr" htmlFor="npin">Nouveau code</label><input id="npin" className="input pin num" type="password" inputMode="numeric" maxLength="4" placeholder="Nouveau" value=${newPin} onChange=${e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}/><button type="button" className="btn sm" disabled=${newPin.length !== 4} onClick=${async () => { try { await callApi('pin', { pin: newPin, old: okPin }); setOkPin(newPin); setNewPin(null); api.toast('Code parent changé'); } catch (e) { api.toast('Changement impossible'); } }}>Enregistrer</button></div>`}
  </section>`;
}

/* ---------- Réglages ---------- */
function Reglages({ st, cur, api, go, openSkin }) {
  const [dl, setDl] = useState(null);
  const self = !!cur.selfGrade;
  const download = async () => {
    if (!('caches' in window)) { setDl({ err: "Ce navigateur ne permet pas le hors-ligne." }); return; }
    const list = (DATA.clips || []).concat(DATA.remote || []).map(audioSrc);
    setDl({ n: 0, t: list.length });
    try {
      const c = await caches.open(AUDIO_CACHE); let n = 0;
      for (let i = 0; i < list.length; i += 12) {
        await Promise.all(list.slice(i, i + 12).map(u => c.match(u).then(hit => hit || fetch(u).then(r => { if (r.ok) return c.put(u, r); }))).map(p => p.catch(() => {})));
        n = Math.min(list.length, i + 12); setDl({ n, t: list.length });
      }
      setDl({ n: list.length, t: list.length, ok: true });
    } catch (e) { setDl({ err: 'Le téléchargement a été interrompu. Réessaie avec du réseau.' }); }
  };
  return html`<div className="stack" style=${{ gap: '18px' }}>
    <h2>Réglages</h2>
    <section className="card stack">
      <div className="row"><${Avatar} id=${cur.av} size=${48}/><div style=${{ flex: 1, minWidth: 0 }}><b>${cur.name}</b><div className="xs muted">joue sur ce téléphone</div></div><button type="button" className="btn sm" onClick=${() => go('who')}>Changer</button></div>
      <button type="button" className="btn ghost" onClick=${openSkin}><${Icon} n="palette" s=${18}/>Changer de skin</button>
    </section>
    <section className="card stack">
      <h3>Note de prononciation</h3>
      <p className="small muted">Avec le micro, Hder ! écoute ta phrase et te donne une note en %. Sans micro, tu te notes toi-même.</p>
      <label className="toggle" htmlFor="selfg"><input id="selfg" type="checkbox" checked=${self} onChange=${e => api.patchProfile(cur.id, { selfGrade: e.target.checked })}/>Me noter moi-même (sans micro)</label>
      ${!micOK() && html`<p className="small c-bad">Le micro n'est pas disponible dans ce navigateur.</p>`}
    </section>
    <section className="card stack">
      <h3>Jouer sans réseau</h3>
      <p className="small muted">Télécharge toutes les voix une fois (${DATA.clips ? Math.round((DATA.audioMB || 0)) + ' Mo environ' : ''}) : les scènes et le kit marcheront même sans connexion. La note au micro a toujours besoin du réseau.</p>
      <button type="button" className="btn soft" disabled=${dl && !dl.ok && !dl.err} onClick=${download}>${dl && dl.ok ? 'Voix téléchargées' : (dl && !dl.err ? 'Téléchargement… ' + dl.n + ' / ' + dl.t : 'Télécharger les voix')}</button>
      ${dl && dl.err && html`<p className="small c-bad">${dl.err}</p>`}
    </section>
    <section className="card stack">
      <h3>Famille</h3>
      <p className="small muted">${(st.fam && st.fam.name) || 'Famille'} · ${st.profiles.length} joueurs · ${st.synced ? 'synchronisé ' + ago(st.synced) : 'pas encore synchronisé'}</p>
      <button type="button" className="btn sm ghost" style=${{ justifySelf: 'start' }} onClick=${() => api.sync()}>Synchroniser maintenant</button>
      <button type="button" className="btn sm ghost" style=${{ justifySelf: 'start', color: 'var(--bad)' }} onClick=${() => { if (window.confirm('Déconnecter ce téléphone de la famille ? La progression reste sauvegardée sur le serveur.')) api.leave(); }}>Déconnecter ce téléphone</button>
    </section>
    <p className="xs muted">Hder ! · version ${DATA.version || ''} · voix et note : Sawalni (darija marocaine)</p>
  </div>`;
}

/* ---------- Application ---------- */
const AUDIO_CACHE = 'hder-audio-v1';
function App() {
  const [st, setRaw] = useState(() => load() || INIT);
  const ref = useRef(st);
  SECRET = st.fam ? st.fam.secret : null;
  const [view, setView] = useState({ n: 'home', p: null });
  const [toasts, setToasts] = useState([]);
  const [lvl, setLvl] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [net, setNet] = useState('');
  const timer = useRef(null), busy = useRef(false), again = useRef(false);
  const commitRaw = n => { ref.current = n; setRaw(n); save(n); };
  const commit = n => {
    const prev = ref.current;
    if (n.profiles !== prev.profiles) {
      const dirty = new Set(n.dirty || []);
      n = { ...n, profiles: n.profiles.map(p => { const o = prev.profiles.find(x => x.id === p.id); if (o !== p) { dirty.add(p.id); return { ...p, t: Date.now() }; } return p; }) };
      n.dirty = Array.from(dirty);
    }
    commitRaw(n); schedule();
  };
  const schedule = () => { clearTimeout(timer.current); timer.current = setTimeout(flush, 1200); };
  const applyRemote = r => {
    const s = ref.current, dirty = new Set(s.dirty || []), revs = { ...(s.revs || {}) };
    const profiles = (r.profiles || []).map(rp => {
      const remote = fresh({ ...rp.data, id: rp.pid });
      const loc = s.profiles.find(p => p.id === rp.pid);
      revs[rp.pid] = rp.rev;
      return (loc && dirty.has(rp.pid)) ? mergeP(loc, remote) : remote;
    }).sort((a, b) => a.id < b.id ? -1 : 1);
    const events = {};
    (r.events || []).forEach(e => { events[e.id] = { k: e.kind, d: e.data }; });
    (s.pend || []).forEach(o => { if (o.op === 'del') delete events[o.id]; else events[o.id] = { k: o.k, d: o.d }; });
    const cur = s.cur && profiles.some(p => p.id === s.cur) ? s.cur : null;
    commitRaw({ ...s, profiles, revs, events, settings: { ...(s.settings || {}), ...(r.settings || {}) }, synced: Date.now(), cur });
    if (dirty.size || (s.pend || []).length) schedule();
  };
  const flush = async () => {
    if (!SECRET) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    try {
      let s = ref.current;
      const pend = (s.pend || []).slice();
      if (pend.length) {
        await callApi('events', { ops: pend.map(o => ({ op: o.op === 'del' ? 'del' : 'add', id: o.id, kind: o.k, data: o.d })) });
        s = ref.current; commitRaw({ ...s, pend: (s.pend || []).filter(o => !pend.includes(o)) });
      }
      s = ref.current;
      const dirty = (s.dirty || []).slice();
      if (dirty.length) {
        const payload = dirty.map(pid => { const p = s.profiles.find(x => x.id === pid); if (!p) return null; const { id, ...data } = p; return { pid, rev: (s.revs || {})[pid] || 0, data }; }).filter(Boolean);
        const r = await callApi('push', { profiles: payload });
        const s2 = ref.current, revs = { ...(s2.revs || {}) }, still = new Set(s2.dirty || []);
        let profiles = s2.profiles;
        (r.res || []).forEach(x => {
          const sent = payload.find(y => y.pid === x.pid);
          if (x.conflict) { if (x.data) { revs[x.pid] = x.rev; profiles = profiles.map(p => p.id === x.pid ? mergeP(p, fresh({ ...x.data, id: x.pid })) : p); } again.current = true; }
          else { revs[x.pid] = x.rev; const now = profiles.find(p => p.id === x.pid); if (now && sent && now.t === sent.data.t) still.delete(x.pid); }
        });
        commitRaw({ ...s2, revs, profiles, dirty: Array.from(still) });
      }
      setNet('');
    } catch (e) { setNet('off'); if (e && e.status === 401) leave(); }
    finally { busy.current = false; if (again.current) { again.current = false; setTimeout(flush, 400); } }
  };
  const pull = async () => {
    if (!SECRET) return;
    try { const r = await callApi('pull'); applyRemote(r); setNet(''); }
    catch (e) { setNet('off'); if (e && e.status === 401) leave(); }
  };
  const leave = () => { SECRET = null; commitRaw({ ...INIT, skin: ref.current.skin, cast: ref.current.cast, likes: ref.current.likes }); };
  useEffect(() => {
    if (SECRET) { pull(); flush(); }
    const vis = () => { if (document.visibilityState === 'visible') pull(); else flush(); };
    document.addEventListener('visibilitychange', vis);
    const iv = setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 60000);
    const on = () => { pull(); flush(); };
    window.addEventListener('online', on);
    return () => { document.removeEventListener('visibilitychange', vis); clearInterval(iv); window.removeEventListener('online', on); };
  }, [!!st.fam]);
  useEffect(() => { const r = document.documentElement; if (st.skin) r.setAttribute('data-skin', st.skin); else r.removeAttribute('data-skin'); }, [st.skin]);

  const toast = t => { const id = uid(); setToasts(a => a.concat([{ id, t }])); setTimeout(() => setToasts(a => a.filter(x => x.id !== id)), 2200); };
  const go = (n, p) => { stopClip(); setView({ n, p: p || null }); window.scrollTo(0, 0); };

  if (!st.fam) return html`<${Join} onJoined=${r => { SECRET = r.secret; commitRaw({ ...INIT, skin: ref.current.skin, fam: { secret: r.secret, name: r.name, code: null } }); applyRemote(r); setView({ n: 'who', p: null }); }}/>`;

  const S = { ...st, ...shared(st) };
  const curP = st.profiles.find(p => p.id === st.cur);
  const mapP = (pid, fn) => ref.current.profiles.map(p => p.id === pid ? fn(p) : p);
  const ev = (s, op) => {
    const events = { ...(s.events || {}) };
    if (op.op === 'del') delete events[op.id]; else events[op.id] = { k: op.k, d: op.d };
    return { ...s, events, pend: (s.pend || []).concat([op]) };
  };
  const pushFeed = (s, who, text) => ev(s, { op: 'set', id: 'fd-' + Date.now().toString(36) + uid(), k: 'feed', d: { who, text, ts: Date.now() } });
  const api = {
    toast,
    sync: () => { pull().then(flush); toast('Synchronisation…'); },
    leave,
    pinSet: () => commitRaw({ ...ref.current, settings: { ...ref.current.settings, pinSet: true } }),
    setSkin: k => commitRaw({ ...ref.current, skin: k }),
    setCur: id => commitRaw({ ...ref.current, cur: id }),
    patchProfile: (id, patch) => commit({ ...ref.current, profiles: mapP(id, p => ({ ...p, ...patch })) }),
    setStar: (pid, id, n) => commit({ ...ref.current, profiles: mapP(pid, p => ({ ...p, stars: { ...p.stars, [id]: n } })) }),
    gain: (pid, xp, dh) => {
      const s = ref.current, t = today(), y = yesterday(); let up = null, name = '';
      const profiles = s.profiles.map(p => {
        if (p.id !== pid) return p;
        const b = lvlOf(p.xp); const streak = p.last === t ? p.streak : (p.last === y ? p.streak + 1 : 1);
        const np = { ...p, xp: p.xp + xp, dh: p.dh + (dh || 0), streak, last: t };
        if (lvlOf(np.xp) > b) { up = lvlOf(np.xp); name = p.name; }
        return np;
      });
      let n = { ...s, profiles };
      if (up !== null) n = pushFeed(n, pid, 'a atteint le niveau ' + LEVELS[up].name);
      commit(n);
      if (xp > 0) toast('+' + xp + ' XP');
      if (up !== null) setLvl({ lvl: up, name });
    },
    feed: (who, text) => commit(pushFeed(ref.current, who, text)),
    bravo: id => {
      const s = ref.current, eid = 'bv-' + id + '-' + s.cur;
      commit(ev(s, s.events[eid] ? { op: 'del', id: eid } : { op: 'set', id: eid, k: 'bravo', d: { item: id, by: s.cur } }));
    },
    like: v => commitRaw({ ...ref.current, likes: { ...ref.current.likes, [v]: !ref.current.likes[v] } }),
    setCast: (k, v) => commitRaw({ ...ref.current, cast: { ...ref.current.cast, [k]: v } }),
    defi: (from, to) => {
      const s = ref.current; const fn = s.profiles.find(p => p.id === to).name;
      commit(pushFeed(ev(s, { op: 'set', id: 'df-' + Date.now().toString(36) + uid(), k: 'defi', d: { from, to, done: false, ts: Date.now() } }), from, 'défie ' + fn + ' sur une scène'));
      toast('Défi lancé');
    },
    finishManche: (pid, sid, m, gal) => {
      const s = ref.current; const key = sid + '-' + m; const T = (SCN[sid] || {}).title || 'une scène';
      let n = { ...s, profiles: s.profiles.map(p => p.id === pid ? { ...p, manches: { ...p.manches, [key]: Math.max(p.manches[key] || 0, gal) } } : p) };
      n = pushFeed(n, pid, 'a fini ' + T + ' · manche ' + m + ', ' + GALON_TXT[gal]);
      const d = shared(n).defis.find(x => !x.done && x.to === pid);
      if (d) { n = ev(n, { op: 'set', id: d.id, k: 'defi', d: { from: d.from, to: d.to, ts: d.ts, done: true } }); n = pushFeed(n, pid, 'a relevé le défi de ' + n.profiles.find(p => p.id === d.from).name); }
      commit(n);
      api.gain(pid, 30 + (d ? 25 : 0), 0);
    },
    module: (pid, key, pass) => {
      const s = ref.current, d = dayN();
      const p = s.profiles.find(x => x.id === pid); if (!p) return null;
      const S0 = modStatus(p, key, d), r = S0.r; let nr = null, res = 'none';
      if (pass) {
        if (S0.st === 'new') { nr = { lv: 0, due: d + INT[0], ok: true, at: d }; res = 'earn'; }
        else if (S0.st === 'check') { const lv = Math.min(r.lv + 1, INT.length - 1); nr = { lv, due: d + INT[lv], ok: true, at: d }; res = 'saved'; }
        else if (S0.st === 'lost') { nr = { lv: 0, due: d + INT[0], ok: true, at: d }; res = 'back'; }
        else res = 'already';
      } else if (S0.st === 'check') { nr = { ...r, ok: false, at: d }; res = 'lose'; }
      if (nr) commit({ ...s, profiles: s.profiles.map(x => x.id === pid ? { ...x, mods2: { ...(x.mods2 || {}), [key]: nr } } : x) });
      const T = { earn: 'Module validé · +1 DH', saved: 'Contrôle réussi · dirham sauvé', back: 'Dirham reconquis · +1 DH', lose: 'Contrôle raté · −1 DH' }[res];
      if (T) toast((pid !== s.cur ? p.name + ' : ' : '') + T);
      return res;
    },
    payout: async (pid, n, pin) => {
      if (!(n > 0)) return false;
      const s = ref.current, rate = (s.settings || {}).rate || 1, id = 'po-' + Date.now().toString(36) + uid();
      const d = { pid, amount: n, rate, at: Date.now() };
      try {
        await callApi('events', { pin, ops: [{ op: 'add', id, kind: 'payout', data: d, prot: true }] });
        const s2 = ref.current; const events = { ...s2.events, [id]: { k: 'payout', d } };
        commit(pushFeed({ ...s2, events }, pid, 'a converti ' + n + ' dirham' + (n > 1 ? 's' : '') + ' Hder ! en vrais dirhams'));
        toast('Versement enregistré'); return true;
      } catch (e) { toast(e.status === 403 ? 'Code parent refusé' : 'Pas de connexion : versement non enregistré'); return false; }
    },
    unpay: async (id, pin) => {
      try {
        await callApi('events', { pin, ops: [{ op: 'del', id, kind: 'payout', prot: true }] });
        const s = ref.current; const events = { ...s.events }; delete events[id]; commitRaw({ ...s, events }); toast('Versement annulé');
      } catch (e) { toast('Annulation impossible pour l’instant'); }
    },
    setRate: async (rate, pin) => {
      try { await callApi('rate', { rate, pin }); commitRaw({ ...ref.current, settings: { ...ref.current.settings, rate } }); toast('Taux enregistré'); }
      catch (e) { toast('Taux non enregistré'); }
    },
    mission: (pid, sid, m) => {
      const s = ref.current; const T = (SCN[sid] || {}).title || 'une scène';
      let n = { ...s, profiles: s.profiles.map(p => p.id === pid ? { ...p, missions: { ...p.missions, [sid + '-' + m]: true } } : p) };
      commit(pushFeed(n, pid, 'a réussi une mission réelle · ' + T));
      api.gain(pid, 30, 0);
    }
  };

  const V = (!curP && view.n !== 'who') ? 'who' : view.n;
  const cur = curP || fresh({ id: '?', name: '…', g: 'm', track: 'adultes', av: 'boxeur' });
  const tabs = [['home', 'Accueil', 'home'], ['scenes', 'Scènes', 'shop'], ['kit', 'Kit', 'book'], ['famille', 'Famille', 'users'], ['reglages', 'Réglages', 'gear']];
  return html`<div>
    <header className="top"><div className="wrap gut top-in">
      <button type="button" className="brand" onClick=${() => go('home')} aria-label="Hder !, accueil">Hder<b> !</b></button>
      <span className="brand-sub">parle darija<br/>sans peur</span>
      <span className="top-sp"></span>
      ${net === 'off' && html`<span className="pill" title="Hors connexion : tout est gardé sur le téléphone et sera envoyé plus tard">hors ligne</span>`}
      <button type="button" className="icon-btn" onClick=${() => setSheet(true)} aria-label="Changer de skin"><${Icon} n="palette"/></button>
      ${curP && html`<button type="button" className="chip-me" onClick=${() => go('who')} aria-label="Changer de joueur"><${Avatar} id=${cur.av} size=${34}/><span>${cur.name}</span></button>`}
    </div></header>
    <main className="wrap gut">
      ${V === 'home' && html`<${Home} st=${S} cur=${cur} go=${go} api=${api}/>`}
      ${V === 'who' && html`<${Who} st=${S} cur=${cur} go=${go} api=${api} first=${!curP}/>`}
      ${V === 'test' && html`<${Test} key=${'t' + cur.id} cur=${cur} go=${go} api=${api}/>`}
      ${V === 'kit' && html`<${Kit} key=${'k' + cur.id + JSON.stringify(view.p)} cur=${cur} go=${go} api=${api} params=${view.p}/>`}
      ${V === 'scenes' && html`<${ScenesList} cur=${cur} go=${go}/>`}
      ${V === 'scene' && html`<${Scene} key=${'s' + cur.id + JSON.stringify(view.p)} st=${S} cur=${cur} go=${go} api=${api} params=${view.p}/>`}
      ${V === 'famille' && html`<${Family} st=${S} cur=${cur} go=${go} api=${api}/>`}
      ${V === 'reglages' && html`<${Reglages} st=${S} cur=${cur} go=${go} api=${api} openSkin=${() => setSheet(true)}/>`}
      ${V === 'voix' && html`<${Voices} st=${S} api=${api}/>`}
    </main>
    ${curP && html`<nav className="tabs" aria-label="Navigation"><div className="wrap gut tabs-in">
      ${tabs.map(([k, t, ic]) => html`<button key=${k} type="button" className=${'tab' + (V === k || (k === 'scenes' && V === 'scene') ? ' on' : '')} aria-current=${V === k ? 'page' : undefined} onClick=${() => go(k)}><${Icon} n=${ic} s=${22}/>${t}</button>`)}
    </div></nav>`}
    <div className="toasts" aria-live="polite">${toasts.map(t => html`<div key=${t.id} className="toast">${t.t}</div>`)}</div>
    ${sheet && html`<${SkinSheet} st=${S} api=${api} close=${() => setSheet(false)}/>`}
    ${lvl && html`<${LevelUp} info=${lvl} close=${() => setLvl(null)}/>`}
  </div>`;
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

ReactDOM.createRoot(document.getElementById('app')).render(html`<${App}/>`);
})();
