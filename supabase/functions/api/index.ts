// API unique de l'appli ménage : toute la lecture/écriture passe ici (clé service), les tables sont fermées au public.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-device, x-cron, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const HOTELS = ["arc", "par", "cha"];
const HOTEL_NAMES: Record<string, string> = { arc: "Archange", par: "Hôtel de Paris", cha: "Châteaudun" };
const TZ = "Europe/Paris";

class E extends Error { constructor(public code: string, public status = 400) { super(code); } }
const ok = (data: unknown) => new Response(JSON.stringify(data), { headers: { ...CORS, "content-type": "application/json" } });
const fail = (code: string, status = 400) => new Response(JSON.stringify({ error: code }), { status, headers: { ...CORS, "content-type": "application/json" } });

// ---------- crypto helpers ----------
const enc = new TextEncoder();
function b64u(buf: ArrayBuffer | Uint8Array) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}
function unb64(s: string) { const bin = atob(s); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
async function sha256hex(s: string) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function randToken(n = 24) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b64u(b); }
const CODE_ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function inviteCode() { const b = new Uint8Array(8); crypto.getRandomValues(b); return [...b].map((x) => CODE_ABC[x % CODE_ABC.length]).join(""); }
const normCode = (t: string) => String(t || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
async function pbkdf2(pin: string, salt: Uint8Array, iter: number) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, k, 256));
}
async function hashPin(pin: string) {
  const salt = new Uint8Array(16); crypto.getRandomValues(salt);
  const h = await pbkdf2(pin, salt, 100000);
  return `pbkdf2$100000$${btoa(String.fromCharCode(...salt))}$${btoa(String.fromCharCode(...h))}`;
}
async function checkPin(pin: string, stored: string | null) {
  if (!stored) return false;
  const [, it, s, h] = stored.split("$");
  const got = await pbkdf2(pin, unb64(s), Number(it));
  const want = unb64(h);
  if (got.length !== want.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got[i] ^ want[i];
  return d === 0;
}

// ---------- web push (RFC 8291 + VAPID) ----------
let vapidCache: { pub: string; priv: string } | null = null;
async function vapid() {
  if (vapidCache) return vapidCache;
  const { data } = await sb.from("app_secrets").select("name,value").in("name", ["vapid_public", "vapid_private"]);
  const m: Record<string, string> = {}; (data || []).forEach((r: any) => m[r.name] = r.value);
  vapidCache = { pub: m.vapid_public, priv: m.vapid_private }; return vapidCache;
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}
function concat(...a: Uint8Array[]) { const n = a.reduce((s, x) => s + x.length, 0); const o = new Uint8Array(n); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; }
async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown) {
  const v = await vapid();
  const pubRaw = unb64u(v.pub);
  const jwk = { kty: "EC", crv: "P-256", x: b64u(pubRaw.slice(1, 33)), y: b64u(pubRaw.slice(33, 65)), d: v.priv, ext: true };
  const signKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const aud = new URL(sub.endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:noreply@menage-hotels.app" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, enc.encode(`${head}.${body}`));
  const jwt = `${head}.${body}.${b64u(sig)}`;

  const uaPub = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = new Uint8Array(16); crypto.getRandomValues(salt);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plain = concat(enc.encode(JSON.stringify(payload)), new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plain));
  const rs = new Uint8Array([0, 0, 16, 0]);
  const bodyBytes = concat(salt, rs, new Uint8Array([asPub.length]), asPub, cipher);
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high", Authorization: `vapid t=${jwt}, k=${v.pub}` },
    body: bodyBytes,
  });
  return r.status;
}
// Nombre de messages non lus pour chaque personne (même calcul que l'appli) : sert à la pastille rouge.
async function unreadCounts(ids: string[]) {
  const out: Record<string, number> = {};
  const { data: people } = await sb.from("staff").select("id,role").in("id", ids);
  await Promise.all((people || []).map(async (p: any) => {
    const [msgs, { data: reads }] = await Promise.all([visibleMsgs(p, 400), sb.from("conv_reads").select("conv,read_at").eq("staff_id", p.id)]);
    const r: Record<string, number> = {}; (reads || []).forEach((x: any) => r[x.conv] = new Date(x.read_at).getTime());
    out[p.id] = msgs.filter((m: any) => m.from_staff !== p.id && new Date(m.created_at).getTime() > (r[m.conv] || 0)).length;
  }));
  return out;
}
async function pushTo(staffIds: string[], payload: { title: string; body: string; tag?: string; conv?: string }, opts: { badge?: boolean } = {}) {
  const ids = [...new Set(staffIds.filter(Boolean))]; if (!ids.length) return;
  const { data } = await sb.from("push_subs").select("id,staff_id,endpoint,p256dh,auth").in("staff_id", ids);
  if (!data || !data.length) return;
  const counts = opts.badge ? await unreadCounts([...new Set(data.map((s: any) => s.staff_id))]).catch(() => ({} as Record<string, number>)) : {};
  await Promise.all((data || []).map(async (s: any) => {
    try {
      const st = await sendPush(s, s.staff_id in counts ? { ...payload, badge: counts[s.staff_id] } : payload);
      if (st === 404 || st === 410) await sb.from("push_subs").delete().eq("id", s.id);
    } catch (e) { console.warn("push", e); }
  }));
}
async function managerIds(hotel?: string | null) {
  const { data } = await sb.from("staff").select("id,only_hotel").in("role", ["owner", "gerant"]).eq("active", true);
  return (data || []).filter((s: any) => !hotel || !s.only_hotel || s.only_hotel === hotel).map((s: any) => s.id);
}

// ---------- misc ----------
function parisDay(d = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
function parisHour(d = new Date()) { return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d)); }
const isMgr = (me: any) => me.role === "owner" || me.role === "gerant";
const isBrico = (me: any) => me.role === "bricoleur";
// Accès donnés par le propriétaire à l'intendant (« reg_pec » : répartir les PEC reçues ; « reg_full » : tout le registre).
const RO_OK = ["state", "push_sub", "push_test", "logout", "read_mark", "msg_send", "upload_url", "doc_get", "stats"];
const PERMS = ["reg_pec", "reg_full", "contacts"];
const can = (me: any, p: string) => isMgr(me) || (isBrico(me) && Array.isArray(me.perms) && (me.perms.includes(p) || (p === "reg_pec" && me.perms.includes("reg_full"))));
// Réparations : états, origines, priorités ; contacts visibles par l'intendant.
const ETATS = ["a_faire", "en_cours", "piece", "fait"];
const ORIGINS = ["signalement", "dekra", "commission", "entretien"];
const PRIOS = ["urgent", "normal", "plus_tard"];
const PRESTA = ["Électricité", "Alarme / SSI", "Travaux", "Contrôle & sécurité"];
const CSTATUTS = ["actif", "relancer", "decline", "completer"];
async function bricoIds() { const { data } = await sb.from("staff").select("id").eq("role", "bricoleur").eq("active", true); return (data || []).map((b: any) => b.id); }
async function issueNotes(issues: any[]) {
  const ids = issues.map((i: any) => i.id); if (!ids.length) return [];
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 150) { const { data } = await sb.from("issue_notes").select("*").in("issue_id", ids.slice(i, i + 150)).order("created_at"); out.push(...(data || [])); }
  return out;
}
const repTitle = (i: any) => i.title || "Problème signalé" + (i.room ? " · " + i.room : "");
function needMgr(me: any) { if (!isMgr(me)) throw new E("forbidden", 403); }
const UUID = /^[0-9a-f-]{36}$/;
function convOk(me: any, conv: string) {
  if (conv === "team") return true;
  if (conv === "mgrs") return isMgr(me);
  if (conv.startsWith("staff:")) return isMgr(me) || conv === `staff:${me.id}`;
  if (conv.startsWith("dm:")) return conv.slice(3).split("_").includes(me.id);
  return false;
}
async function visibleMsgs(me: any, limit: number) {
  const [a, b] = await Promise.all([
    isMgr(me)
      ? sb.from("messages").select("*").not("conv", "like", "dm:%").order("created_at", { ascending: false }).limit(limit)
      : sb.from("messages").select("*").in("conv", ["team", `staff:${me.id}`]).order("created_at", { ascending: false }).limit(limit),
    sb.from("messages").select("*").like("conv", `dm:%${me.id}%`).order("created_at", { ascending: false }).limit(limit),
  ]);
  return [...(a.data || []), ...(b.data || [])].filter((m: any) => convOk(me, m.conv)).sort((x: any, y: any) => x.created_at < y.created_at ? 1 : -1);
}
function hotelOk(me: any, h: string) { return !me.only_hotel || me.only_hotel === h; }
async function getConfig() { const { data } = await sb.from("config").select("data").eq("id", 1).single(); return data?.data || {}; }
function estimate(r: any, cfg: any) {
  const m = { blanc: 30, recouche: 15, fond: 15, commun: 20, ...(cfg.minutes || {}) };
  if (r.type === "blanc") return m.blanc; if (r.type === "recouche") return m.recouche; if (r.type === "commun") return m.commun;
  if (r.type === "fond") return m.fond * Math.max(1, (r.fond_tasks || []).length); return 0;
}
function fmtMin(m: number) { m = Math.round(m); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; }

async function signUrls(paths: string[]) {
  const uniq = [...new Set(paths.filter(Boolean))]; const out: Record<string, string> = {};
  for (let i = 0; i < uniq.length; i += 100) {
    const { data } = await sb.storage.from("media").createSignedUrls(uniq.slice(i, i + 100), 6 * 3600);
    (data || []).forEach((d: any) => { if (d.signedUrl && d.path) out[d.path] = d.signedUrl; });
  }
  return out;
}

// ---------- auth ----------
async function authDevice(req: Request) {
  const secret = req.headers.get("x-device"); if (!secret || secret.length < 20) throw new E("auth", 401);
  const h = await sha256hex(secret);
  const { data: dev } = await sb.from("devices").select("id,staff_id,last_seen,revoked_at").eq("secret_hash", h).maybeSingle();
  if (!dev || dev.revoked_at) throw new E("auth", 401);
  const { data: me } = await sb.from("staff").select("id,label,role,hotels,hours,phone,only_hotel,active,locked,perms,readonly").eq("id", dev.staff_id).single();
  if (!me || !me.active) throw new E("auth", 401);
  if (Date.now() - new Date(dev.last_seen).getTime() > 5 * 60000) await sb.from("devices").update({ last_seen: new Date().toISOString() }).eq("id", dev.id);
  return { me, device: dev };
}
async function inviteRow(token: string) {
  const code = normCode(token); if (code.length !== 8) return null;
  const { data } = await sb.from("invites").select("id,staff_id,used_at,expires_at").eq("token_hash", await sha256hex(code)).maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at) < new Date()) return null;
  const { data: st } = await sb.from("staff").select("id,label,role,active,locked,pin_hash,fails").eq("id", data.staff_id).single();
  if (!st || !st.active || st.locked) return null;
  return { inv: data, st };
}

// ---------- actions ----------
const ROOM_FIELDS = ["type", "status", "assignee", "blocked", "block_reason", "reject_note", "extras", "fond_tasks", "ref_photo", "started_at", "freq_days"];

async function actState(me: any, device: any) {
  const mgr = isMgr(me);
  const cfg = await getConfig();
  let rq = sb.from("rooms").select("*").order("hotel").order("ord");
  if (mgr && me.only_hotel) rq = rq.eq("hotel", me.only_hotel);
  const { data: rooms } = await rq;
  const out: any = { me, cfg, rooms: rooms || [], vapid: (await vapid()).pub, day: parisDay(), device: device.id };
  const paths: string[] = [];
  (rooms || []).forEach((r: any) => {
    if (r.ref_photo) paths.push(r.ref_photo);
    if (r.last_job?.photos && (mgr ? r.status === "a_controler" || r.status === "propre" : r.last_job.uid === me.id)) r.last_job.photos.forEach((p: any) => paths.push(p.id));
  });
  if (mgr) {
    const [{ data: staff }, { data: devices }, { data: invites }, { data: plan }, { data: issues }, msgs, { data: reads }] = await Promise.all([
      sb.from("staff").select("id,label,role,hotels,hours,phone,only_hotel,active,locked,fails,created_at,perms,readonly").order("created_at"),
      sb.from("devices").select("id,staff_id,label,created_at,last_seen").is("revoked_at", null),
      sb.from("invites").select("id,staff_id,created_at,expires_at").is("used_at", null).gt("expires_at", new Date().toISOString()),
      sb.from("plan").select("*").eq("day", parisDay()).maybeSingle(),
      sb.from("issues").select("*").order("created_at", { ascending: false }).limit(300),
      visibleMsgs(me, 400),
      sb.from("conv_reads").select("*"),
    ]);
    const subs = await sb.from("push_subs").select("staff_id");
    const pushOn = new Set((subs.data || []).map((s: any) => s.staff_id));
    out.staff = (staff || []).map((s: any) => ({ ...s, push: pushOn.has(s.id) }));
    out.devices = devices || []; out.invites = invites || []; out.plan = plan || { day: parisDay(), avail: {} };
    out.issues = (issues || []).filter((i: any) => hotelOk(me, i.hotel));
    out.msgs = msgs || []; out.reads = reads || [];
    out.issues.forEach((i: any) => { paths.push(i.photo, i.video, i.audio); (i.done_photos || []).forEach((p: any) => paths.push(p.id)); });
    out.msgs.forEach((m: any) => paths.push(m.media_path));
    out.notes = await issueNotes(out.issues); out.notes.forEach((n: any) => paths.push(n.photo));
    out.contacts = (await sb.from("contacts").select("*").order("nom")).data || [];
    out.reg = await regState();
    out.sec = await secState(me, paths);
    const [{ data: projects }, { data: tasks }] = await Promise.all([
      sb.from("projects").select("*").order("ord"),
      sb.from("tasks").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    out.projects = projects || []; out.tasks = tasks || [];
    const [{ data: points }, { data: psubs }] = await Promise.all([
      sb.from("points").select("id,kind,start,day,text_fr,text_ar,audio,secs,created_at").order("day", { ascending: false }).limit(20),
      sb.from("point_subs").select("*"),
    ]);
    out.points = points || []; out.point_subs = psubs || [];
    out.points.forEach((pt: any) => Object.values(pt.audio || {}).forEach((x: any) => paths.push(x)));
  } else {
    const brico = isBrico(me);
    const [{ data: staff }, { data: issues }, msgs] = await Promise.all([
      sb.from("staff").select("id,label,role").eq("active", true),
      brico ? sb.from("issues").select("*").order("created_at", { ascending: false }).limit(300)
        : sb.from("issues").select("*").eq("by_staff", me.id).order("created_at", { ascending: false }).limit(20),
      visibleMsgs(me, 150),
    ]);
    const convs = [...new Set(["team", `staff:${me.id}`, ...msgs.map((m: any) => m.conv)])];
    const { data: reads } = await sb.from("conv_reads").select("*").in("conv", convs);
    out.staff = staff || [];
    out.issues = issues || []; out.msgs = msgs || []; out.reads = reads || [];
    out.msgs.forEach((m: any) => paths.push(m.media_path));
    if (brico) {
      out.issues.forEach((i: any) => { paths.push(i.photo, i.video, i.audio); (i.done_photos || []).forEach((p: any) => paths.push(p.id)); });
      out.notes = await issueNotes(out.issues); out.notes.forEach((n: any) => paths.push(n.photo));
      out.contacts = (me.perms || []).includes("contacts") ? ((await sb.from("contacts").select("*").in("categorie", PRESTA).order("nom")).data || []) : [];
      out.sec = await secState(me, paths);
    }
    if (can(me, "reg_pec")) out.reg = await regState();
  }
  out.urls = await signUrls(paths);
  return out;
}

// ---------- registre (gérants seulement) ----------
async function regState() {
  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  const [{ data: occ }, { data: pecs }, { data: inbox }, { data: log }, { data: relances }] = await Promise.all([
    sb.from("occupants").select("*").or(`statut.eq.present,sortie.gte.${since}`).order("nom"),
    sb.from("pecs").select("*").order("debut", { ascending: false }),
    sb.from("pec_inbox").select("*").order("received_at", { ascending: false }).limit(300),
    sb.from("registre_log").select("*").order("ts", { ascending: false }).limit(300),
    sb.from("pec_relances").select("*"),
  ]);
  await attachMailDocs((inbox || []).filter((i: any) => i.status === "a_traiter")).catch(() => {});
  return { occ: occ || [], pecs: pecs || [], inbox: inbox || [], log: log || [], relances: relances || [] };
}
const S_ = (v: any, n = 200) => (v === undefined || v === null || v === "") ? null : String(v).slice(0, n);
const D_ = (v: any) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null;
const fullName = (o: any) => [o.prenom, o.nom].filter(Boolean).join(" ") || "Sans nom";
async function placeLabel(roomId: string | null, hotel: string, formule?: string) {
  if (formule === "restauration") return `${HOTEL_NAMES.par} · restauration`;
  if (!roomId) return `${HOTEL_NAMES[hotel] || hotel} · sans chambre`;
  const { data: r } = await sb.from("rooms").select("num").eq("id", roomId).maybeSingle();
  return `${HOTEL_NAMES[hotel] || hotel} · ${r ? (/^\d/.test(r.num) ? "ch. " + r.num : r.num) : "?"}`;
}
async function regLog(me: any, action: string, occId: string | null, cible: string, raison: string | null, details = "") {
  await sb.from("registre_log").insert({ by_staff: me.id, by_label: String(me.label).split(" ")[0], action, occupant_id: occId, cible, raison: raison || "", details });
}
// Lieu choisi : une chambre, « resto » (repas seuls, toujours sur l'Hôtel de Paris) ou rien.
async function placeOf(roomId: any, hotel: string) {
  if (roomId === "resto") return { hotel: "par", room_id: null, formule: "restauration" };
  return { hotel, room_id: await roomCheck(roomId, hotel), formule: "hebergement" };
}
async function roomCheck(roomId: any, hotel: string) {
  if (!roomId) return null;
  const { data: r } = await sb.from("rooms").select("id,hotel,kind").eq("id", roomId).maybeSingle();
  if (!r || r.hotel !== hotel || r.kind === "commun") throw new E("bad");
  return r.id;
}
// Départ : si plus personne dans la chambre, elle passe « à blanc » à répartir.
async function maybeBlanc(roomId: string | null, me: any) {
  if (!roomId) return false;
  const { data: left } = await sb.from("occupants").select("id").eq("room_id", roomId).eq("statut", "present");
  if (left && left.length) return false;
  const { data: r } = await sb.from("rooms").select("status").eq("id", roomId).single();
  if (r && (r.status === "a_faire" || r.status === "en_cours")) return false;
  await sb.from("rooms").update({ type: "blanc", status: "a_faire", assignee: null, reject_note: null, started_at: null, fond_tasks: null, updated_at: new Date().toISOString(), assigned_by: me.id }).eq("id", roomId);
  return true;
}
async function regAction(me: any, a: string, body: any) {
  const need = (a === "reg_inbox_apply" || a === "reg_inbox_set") ? "reg_pec" : "reg_full";
  if (!can(me, need)) throw new E("forbidden", 403);
  const now = new Date().toISOString(); const raison = S_(body.raison, 300);
  if (a === "reg_occ_save") {
    const h0 = HOTELS.includes(body.hotel) ? body.hotel : null; if (!h0) throw new E("bad");
    const { hotel, room_id, formule } = await placeOf(body.room_id, h0);
    const row: any = { hotel, room_id, formule, nom: S_(body.nom, 80), prenom: S_(body.prenom, 80), naissance: D_(body.naissance), categorie: S_(body.categorie, 40), telephone: S_(body.telephone, 25), entree: D_(body.entree), notes: S_(body.notes, 1000) || "", updated_at: now, updated_by: me.id };
    if (!row.nom && !row.prenom) throw new E("bad");
    if (body.id) {
      const { data: old } = await sb.from("occupants").select("*").eq("id", body.id).single(); if (!old) throw new E("bad");
      await sb.from("occupants").update(row).eq("id", body.id);
      const ch = Object.keys(row).filter((k) => !["updated_at", "updated_by"].includes(k) && String(old[k] ?? "") !== String(row[k] ?? ""));
      await regLog(me, (old.room_id !== room_id || old.formule !== formule) ? "Changement de chambre" : "Fiche modifiée", body.id, `${fullName(row)} · ${await placeLabel(room_id, hotel, formule)}`, raison, ch.join(", "));
      return { ok: true, id: body.id };
    }
    row.created_by = me.id; row.statut = "present"; if (!row.entree) row.entree = now.slice(0, 10);
    const { data, error } = await sb.from("occupants").insert(row).select("id").single(); if (error) throw new E("db");
    await regLog(me, "Arrivée", data.id, `${fullName(row)} · ${await placeLabel(room_id, hotel, formule)}`, raison, row.categorie || "");
    return { ok: true, id: data.id };
  }
  if (a === "reg_occ_exit") {
    const { data: o } = await sb.from("occupants").select("*").eq("id", body.id).single(); if (!o) throw new E("bad");
    if (!raison) throw new E("reason");
    const sortie = D_(body.sortie) || now.slice(0, 10);
    await sb.from("occupants").update({ statut: "sorti", sortie, updated_at: now, updated_by: me.id }).eq("id", o.id);
    const blanc = body.clean !== false ? await maybeBlanc(o.room_id, me) : false;
    await regLog(me, "Départ", o.id, `${fullName(o)} · ${await placeLabel(o.room_id, o.hotel, o.formule)}`, raison, `le ${sortie.split("-").reverse().join("/")}${blanc ? " · chambre mise à blanc" : ""}`);
    return { ok: true, blanc };
  }
  if (a === "reg_occ_return") {
    const { data: o } = await sb.from("occupants").select("*").eq("id", body.id).single(); if (!o) throw new E("bad");
    await sb.from("occupants").update({ statut: "present", sortie: null, updated_at: now, updated_by: me.id }).eq("id", o.id);
    await regLog(me, "Départ annulé", o.id, fullName(o), raison);
    return { ok: true };
  }
  if (a === "reg_pec_save") {
    const { data: o } = await sb.from("occupants").select("id,nom,prenom").eq("id", body.occupant_id).single(); if (!o) throw new E("bad");
    const row: any = { occupant_id: o.id, financeur: S_(body.financeur, 80), reference: S_(body.reference, 40) || "", debut: D_(body.debut), fin: D_(body.fin), tarif: S_(body.tarif, 20) || "", repas: S_(body.repas, 40), notes: S_(body.notes, 1000) || "", updated_at: now, updated_by: me.id };
    if (body.id) { await sb.from("pecs").update(row).eq("id", body.id); await regLog(me, "PEC modifiée", o.id, `${fullName(o)} · ${row.financeur || ""}`, raison, `${row.debut || "?"} → ${row.fin || "?"}`); return { ok: true }; }
    row.created_by = me.id; if (Array.isArray(body.docs)) row.docs = body.docs.slice(0, 10);
    const { error } = await sb.from("pecs").insert(row); if (error) throw new E("db");
    await regLog(me, "PEC ajoutée", o.id, `${fullName(o)} · ${row.financeur || ""}`, raison, `${row.debut || "?"} → ${row.fin || "?"}`);
    return { ok: true };
  }
  if (a === "reg_pec_delete") {
    if (!raison) throw new E("reason");
    const { data: p } = await sb.from("pecs").select("*").eq("id", body.id).single(); if (!p) throw new E("bad");
    const { data: o } = await sb.from("occupants").select("nom,prenom").eq("id", p.occupant_id).single();
    await sb.from("pecs").delete().eq("id", p.id);
    await regLog(me, "PEC supprimée", p.occupant_id, `${o ? fullName(o) : "?"} · ${p.financeur || ""}`, raison, `${p.debut || "?"} → ${p.fin || "?"}`);
    return { ok: true };
  }
  if (a === "reg_inbox_set") {
    const st = ["traite", "ecarte", "a_traiter"].includes(body.status) ? body.status : null; if (!st) throw new E("bad");
    const { data: it } = await sb.from("pec_inbox").select("*").eq("id", body.id).single(); if (!it) throw new E("bad");
    await sb.from("pec_inbox").update({ status: st, note: S_(body.note, 300), treated_at: st === "a_traiter" ? null : now, treated_by: st === "a_traiter" ? null : me.id }).eq("id", it.id);
    await regLog(me, st === "ecarte" ? "PEC reçue écartée" : (st === "traite" ? "PEC reçue traitée" : "PEC reçue rouverte"), it.occupant_id, `${it.nom || ""} ${it.prenom || ""}`.trim(), raison || S_(body.note, 300));
    return { ok: true };
  }
  if (a === "reg_inbox_apply") {
    const { data: it } = await sb.from("pec_inbox").select("*").eq("id", body.id).single(); if (!it) throw new E("bad");
    await attachMailDocs([it]).catch(() => {});
    let occId = body.occupant_id ? String(body.occupant_id) : null, who = "";
    if (occId) {
      const { data: o } = await sb.from("occupants").select("id,nom,prenom").eq("id", occId).single(); if (!o) throw new E("bad"); who = fullName(o);
    } else {
      const h0 = HOTELS.includes(body.hotel) ? body.hotel : (it.hotel || "arc");
      const { hotel, room_id, formule } = await placeOf(body.room_id, h0);
      const row: any = { hotel, room_id, formule, nom: it.nom, prenom: it.prenom, naissance: it.naissance, categorie: it.categorie, entree: D_(body.entree) || it.debut || now.slice(0, 10), statut: "present", notes: "", created_by: me.id, updated_by: me.id };
      const { data, error } = await sb.from("occupants").insert(row).select("id").single(); if (error) throw new E("db");
      occId = data.id; who = fullName(row);
      await regLog(me, "Arrivée", occId, `${who} · ${await placeLabel(room_id, hotel, formule)}`, raison || "Depuis une PEC reçue", it.categorie || "");
    }
    await sb.from("pecs").insert({ occupant_id: occId, financeur: it.financeur, reference: it.reference || "", debut: it.debut, fin: it.fin, tarif: it.tarif || "", repas: it.repas, notes: `Créée depuis le document reçu le ${String(it.received_at || now).slice(0, 10).split("-").reverse().join("/")}`, docs: it.docs || [], source_msg: /^[0-9a-f]{12,24}$/.test(String(it.id).split("-")[0]) ? String(it.id).split("-")[0] : null, created_by: me.id, updated_by: me.id });
    await sb.from("pec_inbox").update({ status: "traite", note: `appliqué à ${who}`, treated_at: now, treated_by: me.id, occupant_id: occId }).eq("id", it.id);
    await regLog(me, "PEC ajoutée", occId, `${who} · ${it.financeur || ""}`, raison || "Depuis une PEC reçue", `${it.debut || "?"} → ${it.fin || "?"}`);
    return { ok: true, id: occId };
  }
  throw new E("unknown_action");
}

// ---------- réparations (gérants et intendant) ----------
async function repairAction(me: any, a: string, body: any) {
  if (!isMgr(me) && !isBrico(me)) throw new E("forbidden", 403);
  const now = new Date().toISOString();
  const own = (p: any) => (typeof p === "string" && p.startsWith(me.id + "/")) ? p : null;
  const notify = async (ids: string[], title: string, text: string) => pushTo(ids.filter((x) => x !== me.id), { title, body: text.slice(0, 160), tag: "issue" });
  const where = (i: any) => `${HOTEL_NAMES[i.hotel] || ""}${i.room ? (/^\d/.test(i.room) ? " · ch. " : " · ") + i.room : ""}`;
  if (a === "repair_save") {
    const hotel = HOTELS.includes(body.hotel) ? body.hotel : null; const title = S_(body.title, 140);
    if (!hotel || !title) throw new E("bad");
    const row: any = { title, hotel, room: S_(body.room, 60), details: S_(body.details, 3000), origin: ORIGINS.includes(body.origin) ? body.origin : "signalement", priority: PRIOS.includes(body.priority) ? body.priority : "normal", due: D_(body.due), parts: S_(body.parts, 300), updated_at: now };
    row.urgent = row.priority === "urgent";
    if (body.id) { const { error } = await sb.from("issues").update(row).eq("id", body.id); if (error) throw new E("db"); return { ok: true, id: body.id }; }
    Object.assign(row, { kind: "autre", by_staff: me.id, etat: "a_faire", status: "nouveau", photo: own(body.photo) });
    const { data, error } = await sb.from("issues").insert(row).select("id").single(); if (error) throw new E("db");
    await notify(isMgr(me) ? await bricoIds() : await managerIds(hotel), `${row.urgent ? "🚨" : "🔧"} Nouvelle réparation`, `${title} · ${where(row)}`);
    return { ok: true, id: data.id };
  }
  const { data: i } = await sb.from("issues").select("*").eq("id", body.id).maybeSingle(); if (!i) throw new E("bad");
  if (a === "repair_etat") {
    const etat = ETATS.includes(body.etat) ? body.etat : null; if (!etat) throw new E("bad");
    const p: any = { etat, status: etat === "fait" ? "regle" : "nouveau", updated_at: now };
    if (etat === "fait") { p.done_at = now; p.done_by = me.id; } else { p.done_at = null; p.done_by = null; }
    const ph = own(body.photo); if (ph) p.done_photos = [...(i.done_photos || []), { id: ph, l: "Après", by: me.id, at: now }];
    await sb.from("issues").update(p).eq("id", i.id);
    if (isBrico(me) && etat === "fait") await notify(await managerIds(i.hotel), "✅ Réparation faite", `${repTitle(i)} · ${where(i)}${ph ? " · avec photo" : ""}`);
    if (isBrico(me) && etat === "piece") await notify(await managerIds(i.hotel), "📦 Pièce à commander", `${repTitle(i)}${i.parts ? " · " + i.parts : ""}`);
    if (isMgr(me) && etat === "a_faire" && i.etat === "fait") await notify(await bricoIds(), "🔁 Réparation à reprendre", repTitle(i));
    return { ok: true };
  }
  if (a === "repair_photo") {
    const ph = own(body.photo); if (!ph) throw new E("bad");
    await sb.from("issues").update({ done_photos: [...(i.done_photos || []), { id: ph, l: "Après", by: me.id, at: now }], updated_at: now }).eq("id", i.id);
    return { ok: true };
  }
  if (a === "repair_note") {
    const text = S_(body.text, 1000), photo = own(body.photo); if (!text && !photo) throw new E("empty");
    await sb.from("issue_notes").insert({ issue_id: i.id, by_staff: me.id, text, photo });
    await sb.from("issues").update({ updated_at: now }).eq("id", i.id);
    await notify([...(await managerIds(i.hotel)), ...(await bricoIds())], `💬 ${String(me.label).split(" ")[0]} · ${repTitle(i)}`.slice(0, 80), text || "Photo");
    return { ok: true };
  }
  if (a === "repair_delete") { needMgr(me); await sb.from("issues").delete().eq("id", i.id); return { ok: true }; }
  throw new E("unknown_action");
}

// ---------- sécurité : vérifications, contrôles internes, documents ----------
const SEC_GRP = ["presta", "interne", "doc", "commission"];
const addMonths = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return d.toISOString().slice(0, 10); };
const forBrico = (c: any) => c.grp === "interne" && c.who === "intendant";
async function secState(me: any, paths: string[]) {
  let cq = sb.from("sec_checks").select("*").order("ord");
  if (!isMgr(me)) cq = cq.eq("grp", "interne").eq("who", "intendant");
  const { data: checks } = await cq;
  const ids = (checks || []).map((c: any) => c.id);
  const { data: logs } = ids.length ? await sb.from("sec_logs").select("*").in("check_id", ids).order("done_on", { ascending: false }).limit(600) : { data: [] };
  (logs || []).forEach((l: any) => { (l.photos || []).forEach((p: any) => paths.push(p.id)); if (isMgr(me)) (l.docs || []).forEach((d: any) => paths.push(d.path)); else l.docs = []; });
  return { checks: (checks || []).filter((c: any) => hotelOk(me, c.hotel)), logs: logs || [] };
}
// Prochaine échéance d'une vérification : date fixée à la main, sinon dernière fois + périodicité.
function secNext(c: any, last: string | null) { if (c.next_due) return c.next_due; if (!c.freq_months || !last) return null; return addMonths(last, c.freq_months); }
async function secAction(me: any, a: string, body: any) {
  if (!isMgr(me) && !isBrico(me)) throw new E("forbidden", 403);
  const own = (p: any) => (typeof p === "string" && p.startsWith(me.id + "/")) ? p : null;
  const { data: c } = await sb.from("sec_checks").select("*").eq("id", String(body.id || "")).maybeSingle();
  if (a !== "sec_add" && !c) throw new E("bad");
  if (c && !isMgr(me) && !forBrico(c)) throw new E("forbidden", 403);
  if (c && !hotelOk(me, c.hotel)) throw new E("forbidden", 403);
  const now = new Date().toISOString();
  if (a === "sec_log") {
    const done_on = D_(body.done_on) || parisDay();
    const photos = (Array.isArray(body.photos) ? body.photos : []).map(own).filter(Boolean).slice(0, 8).map((id: string) => ({ id, by: me.id, at: now }));
    const docs = isMgr(me) ? (Array.isArray(body.docs) ? body.docs : []).filter((d: any) => own(d?.path)).slice(0, 6).map((d: any) => ({ path: d.path, name: S_(d.name, 120) || "Rapport.pdf" })) : [];
    const result = body.result === "obs" ? "obs" : "ok";
    const obs_state = result === "obs" ? (body.obs_state === "levees" ? "levees" : "a_lever") : null;
    const row = { check_id: c.id, done_on, by_staff: me.id, by_label: S_(body.by_label, 80) || String(me.label).split(" ")[0], result, obs_state, note: S_(body.note, 2000), photos, docs };
    const { error } = await sb.from("sec_logs").insert(row); if (error) throw new E("db");
    const p: any = { updated_at: now };
    // la date fixée à la main (ex. commission prévue) est consommée quand on note le passage
    if (c.next_due) { p.next_due = null; p.next_note = null; }
    if (c.grp === "presta" || c.grp === "commission") p.obs = obs_state;
    if (c.grp === "doc") p.doc_state = "ok";
    await sb.from("sec_checks").update(p).eq("id", c.id);
    if (isBrico(me) && result === "obs") await pushTo((await managerIds(c.hotel)).filter((x) => x !== me.id), { title: "⚠️ Contrôle sécurité : problème", body: `${c.label} · ${HOTEL_NAMES[c.hotel]}${row.note ? " · " + row.note : ""}`.slice(0, 160), tag: "sec" });
    return { ok: true };
  }
  needMgr(me);
  if (a === "sec_obs") {
    const obs = ["a_lever", "levees"].includes(body.obs) ? body.obs : null;
    await sb.from("sec_checks").update({ obs, updated_at: now }).eq("id", c.id);
    const { data: last } = await sb.from("sec_logs").select("id,note").eq("check_id", c.id).order("done_on", { ascending: false }).limit(1).maybeSingle();
    if (last) await sb.from("sec_logs").update({ obs_state: obs, ...(obs === "levees" ? { note: [last.note, `Observations levées le ${parisDay().split("-").reverse().join("/")}.`].filter(Boolean).join(" ") } : {}) }).eq("id", last.id);
    return { ok: true };
  }
  if (a === "sec_save" || a === "sec_add") {
    const row: any = { updated_at: now };
    if ("label" in body) { row.label = S_(body.label, 160); if (!row.label) throw new E("bad"); }
    if ("freq_months" in body) row.freq_months = body.freq_months ? Math.max(1, Math.min(120, parseInt(body.freq_months) || 12)) : null;
    if ("next_due" in body) row.next_due = D_(body.next_due);
    if ("next_note" in body) row.next_note = S_(body.next_note, 200);
    if ("note" in body) row.note = S_(body.note, 2000);
    if ("provider" in body) row.provider = S_(body.provider, 80);
    if ("contact_id" in body) row.contact_id = UUID.test(String(body.contact_id || "")) ? body.contact_id : null;
    if ("status" in body) row.status = body.status === "na" ? "na" : "actif";
    if ("doc_state" in body) row.doc_state = ["ok", "manquant"].includes(body.doc_state) ? body.doc_state : null;
    if ("who" in body) row.who = body.who === "intendant" ? "intendant" : "gerant";
    if (a === "sec_save") { await sb.from("sec_checks").update(row).eq("id", c.id); return { ok: true }; }
    const hotel = HOTELS.includes(body.hotel) ? body.hotel : null; const grp = SEC_GRP.includes(body.grp) ? body.grp : null;
    if (!hotel || !grp || !row.label) throw new E("bad");
    const id = `${hotel}-x${Date.now().toString(36)}`;
    await sb.from("sec_checks").insert({ ...row, id, hotel, grp, who: row.who || (grp === "interne" ? "intendant" : "gerant"), ord: 500 });
    return { ok: true, id };
  }
  if (a === "sec_log_delete") { await sb.from("sec_logs").delete().eq("id", body.log).eq("check_id", c.id); return { ok: true }; }
  if (a === "sec_delete") { if (!c.id.includes("-x")) throw new E("bad"); await sb.from("sec_checks").delete().eq("id", c.id); return { ok: true }; }
  throw new E("unknown_action");
}
// Rappels du matin : prestataires 30 et 7 jours avant, puis le jour même ; en retard, le lundi.
async function secReminders() {
  const { data: checks } = await sb.from("sec_checks").select("*").eq("status", "actif").not("freq_months", "is", null);
  const { data: logs } = await sb.from("sec_logs").select("check_id,done_on").order("done_on", { ascending: false }).limit(2000);
  const last: Record<string, string> = {}; (logs || []).forEach((l: any) => { if (!last[l.check_id]) last[l.check_id] = l.done_on; });
  const today = parisDay(), monday = new Date(today + "T12:00:00Z").getUTCDay() === 1;
  const days = (iso: string) => Math.round((new Date(iso + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime()) / 864e5);
  const mgr: Record<string, string[]> = {}, brico: string[] = [];
  for (const c of checks || []) {
    const nx = secNext(c, last[c.id] || null); if (!nx) continue; const n = days(nx);
    const fire = c.grp === "interne" ? (n === 0 || (n < 0 && monday)) : (n === 30 || n === 7 || n === 0 || (n < 0 && monday));
    if (!fire || c.reminded_on === today) continue;
    const txt = `${c.label} · ${HOTEL_NAMES[c.hotel]}${n > 0 ? ` · dans ${n} j` : n === 0 ? " · aujourd’hui" : " · en retard"}`;
    if (c.who === "intendant") brico.push(txt); else (mgr[c.hotel] ||= []).push(txt);
    await sb.from("sec_checks").update({ reminded_on: today }).eq("id", c.id);
  }
  let sent = 0;
  for (const [h, list] of Object.entries(mgr)) { await pushTo(await managerIds(h), { title: `🛡️ Sécurité · ${list.length} à prévoir`, body: list.slice(0, 3).join("\n"), tag: "sec" }); sent++; }
  if (brico.length) { await pushTo(await bricoIds(), { title: `🛡️ ${brico.length} contrôle${brico.length > 1 ? "s" : ""} à faire`, body: brico.slice(0, 3).join("\n"), tag: "sec" }); sent++; }
  return sent;
}

// ---------- projets et tâches (gérants seulement) ----------
const PSTATUTS = ["urgent", "en_cours", "reflexion", "pause", "termine"];
const TETATS = ["a_faire", "en_attente", "a_verifier", "fait"];
const TPRIOS = ["haute", "moyenne", "basse"];
async function projAction(me: any, a: string, body: any) {
  needMgr(me);
  const now = new Date().toISOString();
  if (a === "proj_save") {
    const row: any = { updated_at: now };
    if ("title" in body) { row.title = S_(body.title, 160); if (!row.title) throw new E("bad"); }
    if ("emoji" in body) row.emoji = S_(body.emoji, 8);
    if ("hotel" in body) row.hotel = [...HOTELS, "all"].includes(body.hotel) ? body.hotel : null;
    if ("statut" in body) row.statut = PSTATUTS.includes(body.statut) ? body.statut : "en_cours";
    if ("resume" in body) row.resume = S_(body.resume, 400);
    if ("body" in body) row.body = S_(body.body, 20000);
    if ("contact_ids" in body) row.contact_ids = (Array.isArray(body.contact_ids) ? body.contact_ids : []).filter((x: string) => UUID.test(String(x))).slice(0, 30);
    if (body.id) { await sb.from("projects").update(row).eq("id", body.id); return { ok: true, id: body.id }; }
    if (!row.title) throw new E("bad");
    const { data, error } = await sb.from("projects").insert({ ...row, created_by: me.id, ord: 100 }).select("id").single(); if (error) throw new E("db");
    return { ok: true, id: data.id };
  }
  if (a === "proj_delete") { await sb.from("projects").delete().eq("id", body.id); return { ok: true }; }
  if (a === "task_save") {
    const row: any = { updated_at: now };
    if ("title" in body) { row.title = S_(body.title, 200); if (!row.title) throw new E("bad"); }
    if ("note" in body) row.note = S_(body.note, 3000);
    if ("project_id" in body) row.project_id = UUID.test(String(body.project_id || "")) ? body.project_id : null;
    if ("owner" in body) row.owner = UUID.test(String(body.owner || "")) ? body.owner : null;
    if ("due" in body) { row.due = D_(body.due); row.reminded_on = null; }
    if ("prio" in body) row.prio = TPRIOS.includes(body.prio) ? body.prio : "moyenne";
    if ("etat" in body) { row.etat = TETATS.includes(body.etat) ? body.etat : "a_faire"; row.done_at = row.etat === "fait" ? now : null; row.done_by = row.etat === "fait" ? me.id : null; }
    let old: any = null;
    if (body.id) { old = (await sb.from("tasks").select("*").eq("id", body.id).maybeSingle()).data; if (!old) throw new E("bad"); await sb.from("tasks").update(row).eq("id", body.id); }
    else { if (!row.title) throw new E("bad"); const { data, error } = await sb.from("tasks").insert({ ...row, created_by: me.id, owner: "owner" in row ? row.owner : me.id }).select("id").single(); if (error) throw new E("db"); body.id = data.id; }
    const owner = "owner" in row ? row.owner : old?.owner;
    if (owner && owner !== me.id && (!old || old.owner !== owner)) await pushTo([owner], { title: "📌 Nouvelle tâche pour toi", body: `${row.title || old?.title}${row.due ? " · avant le " + row.due.split("-").reverse().join("/") : ""} · de ${String(me.label).split(" ")[0]}`, tag: "task" });
    if (old && row.etat === "fait" && old.etat !== "fait" && old.created_by && old.created_by !== me.id) await pushTo([old.created_by], { title: "✅ Tâche faite", body: `${old.title} · par ${String(me.label).split(" ")[0]}`, tag: "task" });
    return { ok: true, id: body.id };
  }
  if (a === "task_delete") { await sb.from("tasks").delete().eq("id", body.id); return { ok: true }; }
  throw new E("unknown_action");
}
// Rappels du matin : tâche à rendre aujourd'hui, ou en retard (le lundi).
async function taskReminders() {
  const today = parisDay(), monday = new Date(today + "T12:00:00Z").getUTCDay() === 1;
  const { data } = await sb.from("tasks").select("id,title,owner,due,reminded_on").neq("etat", "fait").not("owner", "is", null).not("due", "is", null).lte("due", today);
  const per: Record<string, string[]> = {};
  for (const t of data || []) {
    if (t.reminded_on === today || (t.due < today && !monday)) continue;
    (per[t.owner] ||= []).push(t.due < today ? `${t.title} (en retard)` : t.title);
    await sb.from("tasks").update({ reminded_on: today }).eq("id", t.id);
  }
  for (const [uid, list] of Object.entries(per)) await pushTo([uid], { title: `📌 ${list.length} tâche${list.length > 1 ? "s" : ""} pour aujourd’hui`, body: list.slice(0, 3).join("\n"), tag: "task" });
  return Object.keys(per).length;
}

// ---------- PDF des PEC envoyés par le script Google de la boîte mail ----------
// Le script lit les pièces jointes des mails du Département et les envoie ici ; le relevé Claude crée la fiche « À traiter ».
async function attachMailDocs(rows: any[]) {
  const ids = [...new Set(rows.map((r: any) => String(r.id).split("-")[0]).filter((x) => /^[0-9a-f]{12,24}$/.test(x)))];
  if (!ids.length) return;
  const { data: maps } = await sb.from("pec_mail_docs").select("msg_id,doc_id,name,created_at").in("msg_id", ids);
  if (!maps || !maps.length) return;
  for (const r of rows) {
    const mine = maps.filter((m: any) => m.msg_id === String(r.id).split("-")[0]);
    const docs = Array.isArray(r.docs) ? [...r.docs] : [];
    if (docs.some((d: any) => d.src === "registre")) continue; // repris de l'ancien registre : les PDF y sont déjà
    let changed = false;
    for (const m of mine) if (!docs.some((d: any) => d.id === m.doc_id)) { docs.push({ id: m.doc_id, name: m.name, type: "application/pdf", src: "gmail", at: m.created_at }); changed = true; }
    if (changed) { r.docs = docs; await sb.from("pec_inbox").update({ docs }).eq("id", r.id); }
  }
}
async function pecPdf(req: Request, body: any) {
  await gasAuth(req);
  const msg = String(body.msg || ""); if (!/^[0-9a-f]{12,24}$/.test(msg)) throw new E("bad");
  const b64 = String(body.b64 || ""); if (!b64 || b64.length > 14_000_000) throw new E("too_big");
  const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  if (!(u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46)) throw new E("not_pdf");
  const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", u8))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const id = sha.slice(0, 32), name = S_(body.name, 160) || "PEC.pdf";
  const { data: ex } = await sb.from("doc_files").select("id").eq("id", id).maybeSingle();
  if (!ex) {
    let hex = ""; for (let i = 0; i < u8.length; i++) hex += u8[i].toString(16).padStart(2, "0");
    const { error } = await sb.from("doc_files").insert({ id, name, type: "application/pdf", size: u8.length, sha256: sha, data: "\\x" + hex });
    if (error) throw new E("db");
  }
  // PDF scanné (sans texte) : on garde le texte lu par la reconnaissance de caractères de Google, envoyé par le script.
  const text = (await pdfText(u8)) || (S_(body.text, 20000)?.replace(/\s+/g, " ").trim() || null);
  await sb.from("pec_mail_docs").upsert({ msg_id: msg, doc_id: id, name, subject: S_(body.subject, 300), mail_date: typeof body.date === "string" ? body.date : null, text }, { onConflict: "msg_id,doc_id" });
  const { data: rows } = await sb.from("pec_inbox").select("id,docs").or(`id.eq.${msg},id.like.${msg}-%`);
  await attachMailDocs(rows || []);
  return { ok: true, id, linked: (rows || []).length, text: !!text };
}

// Texte d'un PDF (pour que le relevé se fie à ce qui est écrit sur la PEC, pas à l'objet du mail).
async function pdfText(u8: Uint8Array) {
  try {
    const { extractText, getDocumentProxy } = await import("npm:unpdf@0.12.1");
    const pdf = await getDocumentProxy(u8);
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 20000) || null;
  } catch (e) { console.warn("pdfText", e); return null; }
}
async function gasAuth(req: Request) {
  const { data: s } = await sb.from("app_secrets").select("value").eq("name", "gas_secret").single();
  if (!s || req.headers.get("x-gas") !== s.value) throw new E("forbidden", 403);
}
const SIGN: Record<string, string> = {
  arc: "SARL Hôtel Archange – 1 boulevard de Verdun, 45000 Orléans",
  par: "SARL Hôtel de Paris – 29 rue du Faubourg Bannier, 45000 Orléans",
  cha: "SARL Hôtel de Paris – 29 rue du Faubourg Bannier, 45000 Orléans",
};
const LIEU: Record<string, string> = { arc: "à l’Hôtel Archange", par: "à l’Hôtel de Paris", cha: "à l’annexe de l’Hôtel de Paris (46 bis boulevard de Châteaudun)" };
const longFr = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
// Relances de fin de PEC : liste à préparer en brouillon par le script Google (7 jours avant, puis après la fin).
async function relancesTodo() {
  const today = parisDay(), lim = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const [{ data: occ }, { data: pecs }, { data: done }, { data: inbox }] = await Promise.all([
    sb.from("occupants").select("id,nom,prenom,hotel,formule,categorie").eq("statut", "present"),
    sb.from("pecs").select("id,occupant_id,fin,reference,financeur,source_msg").not("fin", "is", null),
    sb.from("pec_relances").select("pec_id,stage"),
    sb.from("pec_inbox").select("nom,prenom,fin").eq("status", "a_traiter"),
  ]);
  const seen = new Set((done || []).map((d: any) => d.pec_id + ":" + d.stage));
  const out: any[] = [];
  for (const o of occ || []) {
    if (o.categorie === "Conventionnel") continue;
    const p = (pecs || []).filter((x: any) => x.occupant_id === o.id).sort((a: any, b: any) => String(b.fin).localeCompare(String(a.fin)))[0];
    if (!p || p.fin > lim) continue;
    const stage = p.fin < today ? "expiree" : "bientot";
    if (seen.has(p.id + ":" + stage)) continue;
    const up = (x: any) => String(x || "").trim().toUpperCase();
    // une PEC reçue en attente ne bloque la relance que si elle prolonge vraiment la PEC en cours
    if ((inbox || []).some((i: any) => up(i.nom) === up(o.nom) && (!i.fin || i.fin > p.fin))) continue;
    const who = [o.prenom, up(o.nom)].filter(Boolean).join(" ");
    const quoi = o.formule === "restauration" ? `des repas de ${who} à l’Hôtel de Paris` : `de l’hébergement de ${who} ${LIEU[o.hotel] || ""}`;
    const ref = p.reference ? ` (réf. ${p.reference})` : "";
    const corps = stage === "bientot"
      ? `La prise en charge ${quoi}${ref} arrive à échéance le ${longFr(p.fin)}.\n\nPourriez-vous nous indiquer si elle sera renouvelée ? Si c’est le cas, merci de nous transmettre la nouvelle attestation de prise en charge. Dans le cas contraire, pouvez-vous nous confirmer la date de départ prévue ?`
      : `La prise en charge ${quoi}${ref} est arrivée à échéance le ${longFr(p.fin)} et nous n’avons pas reçu de renouvellement à ce jour. Nous continuons pour l’instant d’accueillir ${who}.\n\nPourriez-vous nous indiquer si la prise en charge sera renouvelée et, le cas échéant, nous transmettre la nouvelle attestation ? Dans le cas contraire, pouvez-vous nous confirmer la date de départ prévue ?`;
    const body = `Bonjour,\n\n${corps}\n\nJe vous remercie par avance.\n\nBien cordialement,\n\nAbdullah Iazza\n${SIGN[o.hotel] || SIGN.par}\n06 19 74 94 07`;
    out.push({ pec_id: p.id, stage, msg: p.source_msg || null, nom: up(o.nom), prenom: o.prenom || "", body });
  }
  return { items: out };
}

// Envoi du point à chacun, à son heure : notification qui ouvre le point et lance l'audio.
const isMgrRole = (r: string) => r === "owner" || r === "gerant";
async function pointPush() {
  const today = parisDay(), hour = parisHour(), dow = new Date(today + "T12:00:00Z").getUTCDay();
  const [{ data: subs }, { data: pts }] = await Promise.all([
    sb.from("point_subs").select("*"),
    sb.from("points").select("id,kind,day,text_fr,text_ar,audio").gte("day", new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)).order("day", { ascending: false }),
  ]);
  const latest = (k: string) => (pts || []).find((p: any) => p.kind === k);
  let n = 0;
  for (const s of subs || []) {
    for (const k of ["jour", "semaine"]) {
      const on = k === "jour" ? s.jour : (s.semaine && s.semaine_dow === dow);
      const h = k === "jour" ? s.jour_h : s.semaine_h;
      const p: any = latest(k);
      if (!on || !p || hour < h || (k === "jour" && p.day !== today) || (k === "semaine" && p.day < new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10))) continue;
      const ready = !!(p.audio || {})[`${s.lang}:${s.voice}`];
      if (!ready && hour < h + 2) continue; // on attend l'audio jusqu'à 2 h de retard, ensuite on prévient quand même
      const { data: already } = await sb.from("point_sent").select("point_id").eq("staff_id", s.staff_id).eq("point_id", p.id).maybeSingle();
      if (already) continue;
      await sb.from("point_sent").insert({ staff_id: s.staff_id, point_id: p.id });
      const first = String((s.lang === "fr" ? p.text_fr : p.text_ar) || "").split(/\n+/).filter(Boolean)[1] || "";
      await pushTo([s.staff_id], { title: k === "jour" ? "🎧 Le point du jour" : "🎧 Le point de la semaine", body: (first || "Appuie pour écouter").slice(0, 140), tag: "point-" + k, point: k } as any);
      n++;
    }
  }
  return n;
}

async function roomsPatch(me: any, ids: string[], patch: any, extraPerRoom?: Record<string, any>) {
  needMgr(me);
  const clean: any = {};
  for (const k of ROOM_FIELDS) if (k in patch) clean[k] = patch[k];
  if ("started_at" in clean && clean.started_at !== null) delete clean.started_at;
  const { data: rooms } = await sb.from("rooms").select("id,hotel,assignee,status").in("id", ids);
  const now = new Date().toISOString(); const notify: Record<string, number> = {};
  for (const r of rooms || []) {
    if (!hotelOk(me, r.hotel)) continue;
    const p: any = { ...clean, ...(extraPerRoom?.[r.id] || {}), updated_at: now };
    if ("assignee" in p && p.assignee !== r.assignee) {
      p.assigned_at = now; p.assigned_by = me.id;
      if (p.assignee && (p.status || r.status) === "a_faire") notify[p.assignee] = (notify[p.assignee] || 0) + 1;
    }
    const { error } = await sb.from("rooms").update(p).eq("id", r.id);
    if (error) throw new E("db:" + error.message);
  }
  for (const [uid, n] of Object.entries(notify)) await pushTo([uid], { title: "🧺 Nouvelles chambres", body: `${n} chambre${n > 1 ? "s" : ""} pour toi. Ouvre l’appli.`, tag: "rooms" });
  return { ok: true };
}

async function handle(req: Request) {
  const body = await req.json().catch(() => ({}));
  const a = body.a;

  // --- tâches planifiées ---
  if (a === "cron") {
    const { data: s } = await sb.from("app_secrets").select("value").eq("name", "cron_secret").single();
    if (!s || req.headers.get("x-cron") !== s.value) throw new E("forbidden", 403);
    if (body.kind === "morning") {
      if (parisHour() !== 8 && !body.force) return { skipped: true };
      const cfg = await getConfig();
      const { data: rooms } = await sb.from("rooms").select("assignee,type,fond_tasks,status").in("status", ["a_faire", "en_cours"]).not("assignee", "is", null);
      const per: Record<string, { n: number; min: number }> = {};
      (rooms || []).forEach((r: any) => { const p = per[r.assignee] ||= { n: 0, min: 0 }; p.n++; p.min += estimate(r, cfg); });
      const { data: staff } = await sb.from("staff").select("id,label").in("id", Object.keys(per));
      const secSent = await secReminders().catch(() => 0);
      const taskSent = await taskReminders().catch(() => 0);
      for (const st of staff || []) {
        const p = per[st.id];
        await pushTo([st.id], { title: `☀️ Bonjour ${String(st.label).split(" ")[0]}`, body: `${p.n} chambre${p.n > 1 ? "s" : ""} aujourd’hui, environ ${fmtMin(p.min)}.`, tag: "morning" });
      }
      return { sent: Object.keys(per).length, sec: secSent, tasks: taskSent };
    }
    if (body.kind === "point_push") return { sent: await pointPush() };
    if (body.kind === "purge") {
      const cfg = await getConfig(); const days = Number(cfg.retentionDays) || 30;
      const { data: old } = await sb.rpc("old_media", { days });
      const names = (old || []).map((o: any) => o.name);
      for (let i = 0; i < names.length; i += 100) await sb.storage.from("media").remove(names.slice(i, i + 100));
      const lim = new Date(Date.now() - days * 864e5).toISOString();
      await sb.from("messages").update({ media_path: null, media_type: "expired" }).lt("created_at", lim).not("media_path", "is", null);
      await sb.from("issues").update({ video: null, audio: null }).lt("created_at", lim);
      await sb.from("invites").delete().lt("expires_at", new Date().toISOString());
      return { removed: names.length };
    }
    throw new E("bad");
  }

  if (a === "pec_pdf") return await pecPdf(req, body);
  if (a === "pec_relances") { await gasAuth(req); return await relancesTodo(); }
  if (a === "pec_relance_done") {
    await gasAuth(req);
    const st = ["brouillon", "introuvable"].includes(body.status) ? body.status : null;
    if (!st || !["bientot", "expiree"].includes(body.stage) || !body.pec_id) throw new E("bad");
    await sb.from("pec_relances").upsert({ pec_id: String(body.pec_id).slice(0, 80), stage: body.stage, status: st, to_email: S_(body.to, 200) }, { onConflict: "pec_id,stage" });
    return { ok: true };
  }
  if (a === "doc_text") {
    await gasAuth(req);
    const { data: f } = await sb.from("doc_files").select("data").eq("id", String(body.id || "")).maybeSingle(); if (!f) throw new E("bad");
    const hex = String(f.data).replace(/^\\x/, ""); const u8 = new Uint8Array(hex.length / 2);
    for (let i = 0; i < u8.length; i++) u8[i] = parseInt(hex.substr(i * 2, 2), 16);
    return { text: await pdfText(u8) };
  }

  // --- activation (sans appareil) ---
  if (a === "invite_info") {
    const r = await inviteRow(body.token);
    if (!r) return { valid: false };
    return { valid: true, label: r.st.label, role: r.st.role };
  }
  if (a === "activate") {
    const r = await inviteRow(body.token);
    if (!r) throw new E("invite_invalid");
    const pin = String(body.pin || "");
    if (!(await checkPin(pin, r.st.pin_hash))) {
      const fails = (r.st.fails || 0) + 1;
      await sb.from("staff").update({ fails, locked: fails >= 5 }).eq("id", r.st.id);
      if (fails >= 5) {
        await sb.from("invites").update({ used_at: new Date().toISOString() }).eq("id", r.inv.id);
        await pushTo(await managerIds(), { title: "🔒 Accès bloqué", body: `${r.st.label} : 5 codes faux. Débloque-la dans Équipe.`, tag: "lock" });
      }
      throw new E(fails >= 5 ? "locked" : `pin_wrong:${5 - fails}`);
    }
    const now = new Date().toISOString();
    const { data: used } = await sb.from("invites").update({ used_at: now }).eq("id", r.inv.id).is("used_at", null).select("id");
    if (!used || !used.length) throw new E("invite_invalid");
    await sb.from("staff").update({ fails: 0 }).eq("id", r.st.id);
    if (r.st.role === "menage") {
      await sb.from("devices").update({ revoked_at: now }).eq("staff_id", r.st.id).is("revoked_at", null);
    } else {
      const { data: devs } = await sb.from("devices").select("id").eq("staff_id", r.st.id).is("revoked_at", null).order("created_at", { ascending: false });
      const extra = (devs || []).slice(2).map((d: any) => d.id);
      if (extra.length) await sb.from("devices").update({ revoked_at: now }).in("id", extra);
    }
    const secret = randToken(32);
    await sb.from("devices").insert({ staff_id: r.st.id, secret_hash: await sha256hex(secret), label: String(body.ua || "").slice(0, 120) });
    return { secret };
  }

  // --- tout le reste exige un appareil activé ---
  const { me, device } = await authDevice(req);
  const mgr = isMgr(me);
  // Compte en lecture seule : tout voir, rien modifier (sauf messages et notifications).
  if (me.readonly && !RO_OK.includes(a)) throw new E("readonly", 403);

  switch (a) {
    case "state": return await actState(me, device);

    case "upload_url": {
      const ext = String(body.ext || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
      const path = `${me.id}/${parisDay().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await sb.storage.from("media").createSignedUploadUrl(path);
      if (error) throw new E("upload");
      return { path, url: data.signedUrl };
    }

    case "push_sub": {
      const s = body.sub || {};
      if (!s.endpoint || !s.keys?.p256dh || !s.keys?.auth) throw new E("bad");
      await sb.from("push_subs").upsert({ staff_id: me.id, device_id: device.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }, { onConflict: "endpoint" });
      return { ok: true };
    }
    case "push_test": { await pushTo([me.id], { title: "🔔 Notifications activées", body: "Tu recevras tes chambres et tes messages ici.", tag: "test" }); return { ok: true }; }

    case "logout": { await sb.from("devices").update({ revoked_at: new Date().toISOString() }).eq("id", device.id); await sb.from("push_subs").delete().eq("device_id", device.id); return { ok: true }; }

    // --- ménage ---
    case "room_start": {
      const { data: r } = await sb.from("rooms").select("id,assignee,status").eq("id", body.id).single();
      if (!r || r.assignee !== me.id) throw new E("not_yours", 403);
      if (r.status === "a_faire") await sb.from("rooms").update({ status: "en_cours", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", r.id);
      return { ok: true };
    }
    // Gérant ou intendant : prendre un nettoyage pour soi (ou le rendre à répartir).
    case "room_take": {
      if (!isMgr(me) && !isBrico(me)) throw new E("forbidden", 403);
      const { data: r } = await sb.from("rooms").select("id,num,hotel,assignee,status,kind").eq("id", body.id).single();
      if (!r || !hotelOk(me, r.hotel)) throw new E("bad");
      if (r.status !== "a_faire" && r.status !== "en_cours") throw new E("bad");
      const now = new Date().toISOString();
      if (body.release) {
        if (r.assignee !== me.id) throw new E("not_yours", 403);
        await sb.from("rooms").update({ assignee: null, status: "a_faire", started_at: null, updated_at: now }).eq("id", r.id);
        return { ok: true };
      }
      await sb.from("rooms").update({ assignee: me.id, assigned_at: now, assigned_by: me.id, updated_at: now }).eq("id", r.id);
      const lbl = `${r.kind === "commun" ? "" : "Chambre "}${r.num} · ${HOTEL_NAMES[r.hotel]}`;
      if (r.assignee && r.assignee !== me.id) await pushTo([r.assignee], { title: "🔄 Ménage repris", body: `${lbl} : repris par ${String(me.label).split(" ")[0]}`, tag: "rooms" });
      return { ok: true };
    }
    case "room_finish": {
      const { data: r } = await sb.from("rooms").select("*").eq("id", body.id).single();
      if (!r || r.assignee !== me.id) throw new E("not_yours", 403);
      if (r.status !== "en_cours") throw new E("not_started");
      const cfg = await getConfig();
      const need: string[] = (cfg.photos || {})[r.type] || [];
      const photos = (Array.isArray(body.photos) ? body.photos : []).filter((p: any) => p && typeof p.id === "string" && p.id.startsWith(me.id + "/")).map((p: any) => ({ l: String(p.l).slice(0, 40), id: p.id }));
      if (photos.length < need.length) throw new E("photos_missing");
      const known = new Set((cfg.periodic || []).map((p: any) => p.id));
      const per = (Array.isArray(body.periodic) ? body.periodic : []).filter((x: any) => known.has(x));
      const now = new Date(); const start = r.started_at || now.toISOString();
      const pd = { ...(r.periodic_done || {}) }; per.forEach((id: string) => pd[id] = now.getTime());
      await sb.from("jobs").insert({ staff_id: me.id, room_id: r.id, hotel: r.hotel, num: r.num, type: r.type, started_at: start, ended_at: now.toISOString(), photos, periodic: per });
      await sb.from("rooms").update({
        status: "a_controler", done_at: now.toISOString(), done_by: me.id, reject_note: null, periodic_done: pd, updated_at: now.toISOString(),
        last_job: { uid: me.id, photos, start: new Date(start).getTime(), end: now.getTime(), type: r.type },
      }).eq("id", r.id);
      return { ok: true };
    }
    case "issue_create": {
      const hotel = HOTELS.includes(body.hotel) ? body.hotel : null; if (!hotel) throw new E("bad");
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 15);
      if (!items.length) throw new E("bad");
      const own = (p: any) => (typeof p === "string" && p.startsWith(me.id + "/")) ? p : null;
      const now = Date.now();
      const rows = items.map((it: any, i: number) => ({
        kind: String(it.kind || "autre").slice(0, 20), hotel, room: body.room ? String(body.room).slice(0, 40) : null,
        text: it.text ? String(it.text).slice(0, 1000) : null, urgent: !!it.urgent, photo: own(it.photo), video: own(it.video), audio: own(it.audio),
        by_staff: me.id, created_at: new Date(now + i).toISOString(),
        etat: "a_faire", status: "nouveau", origin: "signalement", priority: it.urgent ? "urgent" : "normal",
      }));
      const { error } = await sb.from("issues").insert(rows); if (error) throw new E("db");
      const urg = rows.some((r: any) => r.urgent);
      const { data: bricos } = await sb.from("staff").select("id").eq("role", "bricoleur").eq("active", true);
      const notifyIds = [...new Set([...(await managerIds(hotel)), ...(bricos || []).map((b: any) => b.id)])];
      await pushTo(notifyIds.filter((id) => id !== me.id), { title: `${urg ? "🚨" : "🔧"} ${rows.length} problème${rows.length > 1 ? "s" : ""} signalé${rows.length > 1 ? "s" : ""}`, body: `${HOTEL_NAMES[hotel]}${rows[0].room ? (/^\d/.test(rows[0].room) ? " · ch. " : " · ") + rows[0].room : ""} · par ${me.label}`, tag: "issue" });
      return { ok: true };
    }

    // --- messages ---
    case "msg_send": {
      const text = body.text ? String(body.text).slice(0, 1000) : null;
      const media = (typeof body.media_path === "string" && body.media_path.startsWith(me.id + "/")) ? body.media_path : null;
      if (!text && !media) throw new E("empty");
      let conv = typeof body.conv === "string" ? body.conv : "";
      if (!conv) conv = !mgr ? `staff:${me.id}` : (body.thread === "all" ? "team" : `staff:${body.thread}`);
      if (!convOk(me, conv)) throw new E("forbidden", 403);
      const { data: all } = await sb.from("staff").select("id,role,active,only_hotel").eq("active", true);
      const act = all || []; const byId: Record<string, any> = {}; act.forEach((x: any) => byId[x.id] = x);
      const mgrIds = (h?: string | null) => act.filter((x: any) => (x.role === "owner" || x.role === "gerant") && (!h || !x.only_hotel || x.only_hotel === h)).map((x: any) => x.id);
      const hotel = HOTELS.includes(body.hotel) ? body.hotel : null;
      let to: string[] = []; let thread: string | null = null; let label = "";
      if (conv === "team") { to = act.map((x: any) => x.id); label = "📢 Toute l’équipe"; }
      else if (conv === "mgrs") { to = mgrIds(); label = "👔 Responsables"; }
      else if (conv.startsWith("staff:")) {
        const x = conv.slice(6); if (!UUID.test(x) || !byId[x] || !["menage", "bricoleur"].includes(byId[x].role)) throw new E("bad");
        thread = x; to = [x, ...mgrIds(hotel)];
      } else if (conv.startsWith("dm:")) {
        const pair = conv.slice(3).split("_");
        if (pair.length !== 2 || !pair.every((p) => UUID.test(p)) || pair[0] >= pair[1]) throw new E("bad");
        const other = pair[0] === me.id ? pair[1] : pair[0];
        if (!byId[other]) throw new E("bad");
        if (!mgr && !(byId[other].role === "owner" || byId[other].role === "gerant")) throw new E("forbidden", 403);
        to = [other];
      } else throw new E("bad");
      const row = { conv, thread, from_staff: me.id, text, media_path: media, media_type: media ? String(body.media_type || "audio").slice(0, 10) : null, duration: body.duration ? Math.min(600, Math.round(body.duration)) : null, hotel, room: body.room ? String(body.room).slice(0, 40) : null };
      const { error } = await sb.from("messages").insert(row); if (error) throw new E("db");
      await sb.from("conv_reads").upsert({ staff_id: me.id, conv, read_at: new Date().toISOString() });
      const where = row.room ? `${HOTEL_NAMES[hotel || ""] || ""} · ${/^\d/.test(row.room) ? "Chambre " : ""}${row.room}` : "";
      const what = text ? text.slice(0, 120) : "Message vocal";
      await pushTo(to.filter((id) => id !== me.id), {
        title: `${media ? "🎤" : "💬"} ${me.label}${label ? " · " + label : ""}`,
        body: [where, what].filter(Boolean).join(" · "), tag: "c-" + conv, conv,
      } as any, { badge: true });
      return { ok: true };
    }
    case "read_mark": {
      const conv = typeof body.conv === "string" ? body.conv : (mgr ? `staff:${body.thread}` : `staff:${me.id}`);
      if (!convOk(me, conv)) throw new E("forbidden", 403);
      await sb.from("conv_reads").upsert({ staff_id: me.id, conv, read_at: new Date().toISOString() });
      return { ok: true };
    }

    // --- registre ---
    case "reg_occ_save": case "reg_occ_exit": case "reg_occ_return": case "reg_pec_save": case "reg_pec_delete": case "reg_inbox_set": case "reg_inbox_apply":
      return await regAction(me, a, body);
    case "doc_get": {
      if (!can(me, "reg_pec")) throw new E("forbidden", 403);
      const id = String(body.id || ""); if (!/^[0-9a-z_-]{8,64}$/i.test(id)) throw new E("bad");
      const { data: f } = await sb.from("doc_files").select("name,type,data").eq("id", id).maybeSingle();
      if (!f) throw new E("bad");
      const hex = String(f.data).replace(/^\\x/, ""); const u8 = new Uint8Array(hex.length / 2);
      for (let i = 0; i < u8.length; i++) u8[i] = parseInt(hex.substr(i * 2, 2), 16);
      let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return { name: f.name, type: f.type || "application/pdf", b64: btoa(s) };
    }

    // --- gestion (gérants) ---
    case "rooms_patch": return await roomsPatch(me, (body.ids || []).slice(0, 200), body.patch || {});
    case "plan_apply": {
      needMgr(me);
      const assign: Record<string, string> = body.assign || {};
      const fond: any[] = Array.isArray(body.fond) ? body.fond : [];
      const unassign: string[] = Array.isArray(body.unassign) ? body.unassign : [];
      const now = new Date().toISOString(); const count: Record<string, number> = {};
      for (const [rid, uid] of Object.entries(assign)) { await sb.from("rooms").update({ assignee: uid, assigned_at: now, assigned_by: me.id, updated_at: now }).eq("id", rid).eq("status", "a_faire"); count[uid] = (count[uid] || 0) + 1; }
      for (const f of fond) { await sb.from("rooms").update({ type: "fond", status: "a_faire", assignee: f.uid, fond_tasks: f.tasks, assigned_at: now, assigned_by: me.id, reject_note: null, started_at: null, updated_at: now }).eq("id", f.room).eq("status", "propre"); count[f.uid] = (count[f.uid] || 0) + 1; }
      for (const rid of unassign) await sb.from("rooms").update({ assignee: null, updated_at: now }).eq("id", rid).eq("status", "a_faire");
      const cfg = await getConfig();
      for (const uid of Object.keys(count)) {
        const { data: mine } = await sb.from("rooms").select("type,fond_tasks").eq("assignee", uid).in("status", ["a_faire", "en_cours"]);
        const n = (mine || []).length, min = (mine || []).reduce((s: number, r: any) => s + estimate(r, cfg), 0);
        await pushTo([uid], { title: "🗓️ Ton programme", body: `${n} chambre${n > 1 ? "s" : ""}, environ ${fmtMin(min)}. Ouvre l’appli.`, tag: "rooms" });
      }
      return { ok: true };
    }
    case "room_create": {
      needMgr(me);
      const kind = body.kind === "commun" ? "commun" : "chambre";
      const hotel = body.hotel, num = String(body.num || "").trim().slice(0, kind === "commun" ? 40 : 12);
      if (!HOTELS.includes(hotel) || !num || !hotelOk(me, hotel)) throw new E("bad");
      const slug = num.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
      const id = hotel + "__" + (kind === "commun" ? "c_" : "") + slug;
      const { data: mx } = await sb.from("rooms").select("ord").eq("hotel", hotel).order("ord", { ascending: false }).limit(1);
      const row: any = { id, hotel, num, ord: ((mx || [])[0]?.ord || 0) + 1, kind };
      if (kind === "commun") row.freq_days = Math.max(1, Math.min(60, Number(body.freq_days) || 7));
      const { error } = await sb.from("rooms").insert(row);
      if (error) throw new E("exists");
      return { ok: true };
    }
    case "room_delete": {
      needMgr(me);
      const { data: r } = await sb.from("rooms").select("hotel,status").eq("id", body.id).single();
      if (!r || !hotelOk(me, r.hotel)) throw new E("bad");
      if (r.status === "a_faire" || r.status === "en_cours") throw new E("busy");
      await sb.from("rooms").delete().eq("id", body.id); return { ok: true };
    }
    case "config_set": {
      needMgr(me);
      const d = body.data; if (!d || typeof d !== "object") throw new E("bad");
      if (JSON.stringify(d).length > 60000) throw new E("too_big");
      await sb.from("config").update({ data: d }).eq("id", 1); return { ok: true };
    }
    case "plan_set": {
      needMgr(me);
      await sb.from("plan").upsert({ day: parisDay(), avail: body.avail || {}, updated_at: new Date().toISOString() }); return { ok: true };
    }
    case "issue_status": return await repairAction(me, "repair_etat", { id: body.id, etat: body.status === "regle" ? "fait" : "a_faire" });
    case "repair_save": case "repair_etat": case "repair_photo": case "repair_note": case "repair_delete": return await repairAction(me, a, body);
    case "sec_log": case "sec_obs": case "sec_save": case "sec_add": case "sec_log_delete": case "sec_delete": return await secAction(me, a, body);
    case "proj_save": case "proj_delete": case "task_save": case "task_delete": return await projAction(me, a, body);
    case "contact_save": {
      needMgr(me);
      const nom = S_(body.nom, 120); if (!nom) throw new E("bad");
      const row: any = { nom, societe: S_(body.societe, 120), role: S_(body.role, 160), categorie: S_(body.categorie, 60), hotels: (Array.isArray(body.hotels) ? body.hotels : []).filter((h: string) => HOTELS.includes(h)), telephone: S_(body.telephone, 40), email: S_(body.email, 160), adresse: S_(body.adresse, 300), notes: S_(body.notes, 3000), statut: CSTATUTS.includes(body.statut) ? body.statut : "actif", updated_at: new Date().toISOString(), updated_by: me.id };
      if (body.id) { await sb.from("contacts").update(row).eq("id", body.id); return { ok: true, id: body.id }; }
      const { data, error } = await sb.from("contacts").insert(row).select("id").single(); if (error) throw new E("db");
      return { ok: true, id: data.id };
    }
    case "contact_delete": { needMgr(me); await sb.from("contacts").delete().eq("id", body.id); return { ok: true }; }
    case "staff_save": {
      needMgr(me);
      const label = String(body.label || "").trim().slice(0, 60); if (!label) throw new E("bad");
      const hotels = (Array.isArray(body.hotels) ? body.hotels : HOTELS).filter((h: string) => HOTELS.includes(h));
      const role = ["gerant", "menage", "bricoleur"].includes(body.role) ? body.role : "menage";
      const row: any = { label, hotels: hotels.length ? hotels : HOTELS, hours: Math.max(1, Math.min(12, Number(body.hours) || 6)), phone: body.phone ? String(body.phone).slice(0, 25) : null, only_hotel: HOTELS.includes(body.only_hotel) ? body.only_hotel : null };
      if (body.id) {
        const { data: t } = await sb.from("staff").select("role").eq("id", body.id).single();
        if (!t) throw new E("bad");
        if (t.role === "owner") { if (me.role !== "owner") throw new E("owner_protected", 403); delete row.only_hotel; }
        else row.role = role;
        await sb.from("staff").update(row).eq("id", body.id);
        return { ok: true, id: body.id };
      }
      row.role = role;
      const { data, error } = await sb.from("staff").insert(row).select("id").single(); if (error) throw new E("db");
      return { ok: true, id: data.id };
    }
    case "staff_active": {
      needMgr(me);
      const { data: t } = await sb.from("staff").select("role").eq("id", body.id).single();
      if (!t || t.role === "owner") throw new E("owner_protected", 403);
      const active = !!body.active;
      await sb.from("staff").update({ active }).eq("id", body.id);
      if (!active) { const now = new Date().toISOString(); await sb.from("devices").update({ revoked_at: now }).eq("staff_id", body.id).is("revoked_at", null); await sb.from("invites").update({ used_at: now }).eq("staff_id", body.id).is("used_at", null); }
      return { ok: true };
    }
    case "staff_delete": {
      needMgr(me);
      const { data: t } = await sb.from("staff").select("id,role,active").eq("id", body.id).single();
      if (!t || t.role === "owner") throw new E("owner_protected", 403);
      if (t.active) throw new E("still_active");
      await sb.from("messages").delete().like("conv", `dm:%${t.id}%`);
      await sb.from("messages").delete().eq("conv", `staff:${t.id}`);
      await sb.from("messages").delete().eq("from_staff", t.id).like("conv", "archive:%");
      await sb.from("conv_reads").delete().like("conv", `%${t.id}%`);
      const { error } = await sb.from("staff").delete().eq("id", t.id); if (error) throw new E("db");
      return { ok: true };
    }
    case "invite_create": {
      needMgr(me);
      const pin = String(body.pin || ""); if (!/^\d{4}$/.test(pin)) throw new E("pin_format");
      const { data: t } = await sb.from("staff").select("id,role,active").eq("id", body.staff_id).single();
      if (!t || !t.active) throw new E("bad");
      if (t.role === "owner" && me.role !== "owner") throw new E("owner_protected", 403);
      const token = inviteCode();
      await sb.from("invites").update({ used_at: new Date().toISOString() }).eq("staff_id", t.id).is("used_at", null);
      await sb.from("staff").update({ pin_hash: await hashPin(pin), fails: 0, locked: false }).eq("id", t.id);
      await sb.from("invites").insert({ staff_id: t.id, token_hash: await sha256hex(token), created_by: me.id });
      return { token };
    }
    case "staff_readonly": {
      if (me.role !== "owner") throw new E("owner_only", 403);
      const { data: t } = await sb.from("staff").select("id,label,role").eq("id", body.id).single();
      if (!t || t.role === "owner") throw new E("bad");
      await sb.from("staff").update({ readonly: !!body.readonly }).eq("id", t.id);
      return { ok: true };
    }
    case "point_sub_save": {
      if (me.role !== "owner") throw new E("owner_only", 403);
      const { data: t } = await sb.from("staff").select("id,role").eq("id", body.staff_id).single();
      if (!t || !isMgrRole(t.role)) throw new E("bad");
      const h = (x: any, d: number) => Math.max(5, Math.min(22, parseInt(x) || d));
      const VOICES = ["male-1", "male-2", "male-5", "female-1", "female-2", "female-5"];
      await sb.from("point_subs").upsert({ staff_id: t.id, jour: !!body.jour, jour_h: h(body.jour_h, 7), semaine: !!body.semaine, semaine_dow: Math.max(0, Math.min(6, parseInt(body.semaine_dow) || 0)), semaine_h: h(body.semaine_h, 8), lang: body.lang === "fr" ? "fr" : "ar", voice: VOICES.includes(body.voice) ? body.voice : "male-2", updated_at: new Date().toISOString() });
      return { ok: true };
    }
    case "point_send": {
      if (me.role !== "owner") throw new E("owner_only", 403);
      const kind = body.kind === "semaine" ? "semaine" : "jour";
      const { data: p } = await sb.from("points").select("id,text_fr,text_ar").eq("kind", kind).order("day", { ascending: false }).limit(1).maybeSingle();
      if (!p) throw new E("bad");
      const { data: who } = await sb.from("staff").select("id,role,active").in("id", (Array.isArray(body.ids) ? body.ids : []).filter((x: string) => UUID.test(String(x))).slice(0, 30));
      const ids = (who || []).filter((s: any) => s.active && isMgrRole(s.role)).map((s: any) => s.id);
      if (!ids.length) throw new E("no_one");
      const line = String(p.text_ar || "").split(/\n+/).filter(Boolean)[1] || "";
      await pushTo(ids, { title: kind === "jour" ? "🎧 Le point du jour" : "🎧 Le point de la semaine", body: (line || "Appuie pour écouter").slice(0, 140), tag: "point-" + kind, point: kind } as any);
      await sb.from("point_sent").upsert(ids.map((id: string) => ({ staff_id: id, point_id: p.id })), { onConflict: "staff_id,point_id" });
      return { ok: true, sent: ids.length };
    }
    case "staff_perms": {
      if (me.role !== "owner") throw new E("owner_only", 403);
      const { data: t } = await sb.from("staff").select("id,label,role,perms").eq("id", body.id).single();
      if (!t || t.role !== "bricoleur") throw new E("bad");
      const perms = (Array.isArray(body.perms) ? body.perms : []).filter((p: string) => PERMS.includes(p));
      await sb.from("staff").update({ perms }).eq("id", t.id);
      const added = perms.filter((p: string) => !(t.perms || []).includes(p)), removed = (t.perms || []).filter((p: string) => !perms.includes(p));
      const L: Record<string, string> = { reg_pec: "répartir les PEC reçues", reg_full: "gérer tout le registre", contacts: "voir les prestataires" };
      if (added.length || removed.length) await regLog(me, added.length ? "Accès donné" : "Accès repris", null, t.label, null, [...added.map((p: string) => "+ " + L[p]), ...removed.map((p: string) => "− " + L[p])].join(", "));
      return { ok: true };
    }
    case "device_revoke": {
      needMgr(me);
      const { data: d } = await sb.from("devices").select("id,staff_id").eq("id", body.id).single(); if (!d) throw new E("bad");
      const { data: t } = await sb.from("staff").select("role").eq("id", d.staff_id).single();
      if (t?.role === "owner" && me.role !== "owner") throw new E("owner_protected", 403);
      await sb.from("devices").update({ revoked_at: new Date().toISOString() }).eq("id", d.id);
      await sb.from("push_subs").delete().eq("device_id", d.id);
      return { ok: true };
    }
    case "stats": {
      needMgr(me);
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data } = await sb.from("jobs").select("staff_id,type,started_at,ended_at").gte("ended_at", since).limit(5000);
      return { jobs: data || [] };
    }
  }
  throw new E("unknown_action");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("method", 405);
  try { return ok(await handle(req)); }
  catch (e) {
    if (e instanceof E) return fail(e.code, e.status);
    console.error(e); return fail("server", 500);
  }
});
