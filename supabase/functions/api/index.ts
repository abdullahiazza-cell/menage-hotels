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
async function pushTo(staffIds: string[], payload: { title: string; body: string; tag?: string; conv?: string }) {
  const ids = [...new Set(staffIds.filter(Boolean))]; if (!ids.length) return;
  const { data } = await sb.from("push_subs").select("id,endpoint,p256dh,auth").in("staff_id", ids);
  await Promise.all((data || []).map(async (s: any) => {
    try {
      const st = await sendPush(s, payload);
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
  const m = { blanc: 30, recouche: 15, fond: 15, ...(cfg.minutes || {}) };
  if (r.type === "blanc") return m.blanc; if (r.type === "recouche") return m.recouche;
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
  const { data: me } = await sb.from("staff").select("id,label,role,hotels,hours,phone,only_hotel,active,locked").eq("id", dev.staff_id).single();
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
const ROOM_FIELDS = ["type", "status", "assignee", "blocked", "block_reason", "reject_note", "extras", "fond_tasks", "ref_photo", "started_at"];

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
      sb.from("staff").select("id,label,role,hotels,hours,phone,only_hotel,active,locked,fails,created_at").order("created_at"),
      sb.from("devices").select("id,staff_id,label,created_at,last_seen").is("revoked_at", null),
      sb.from("invites").select("id,staff_id,created_at,expires_at").is("used_at", null).gt("expires_at", new Date().toISOString()),
      sb.from("plan").select("*").eq("day", parisDay()).maybeSingle(),
      sb.from("issues").select("*").order("created_at", { ascending: false }).limit(150),
      visibleMsgs(me, 400),
      sb.from("conv_reads").select("*"),
    ]);
    const subs = await sb.from("push_subs").select("staff_id");
    const pushOn = new Set((subs.data || []).map((s: any) => s.staff_id));
    out.staff = (staff || []).map((s: any) => ({ ...s, push: pushOn.has(s.id) }));
    out.devices = devices || []; out.invites = invites || []; out.plan = plan || { day: parisDay(), avail: {} };
    out.issues = (issues || []).filter((i: any) => hotelOk(me, i.hotel));
    out.msgs = msgs || []; out.reads = reads || [];
    out.issues.forEach((i: any) => paths.push(i.photo, i.video, i.audio));
    out.msgs.forEach((m: any) => paths.push(m.media_path));
  } else {
    const [{ data: staff }, { data: issues }, msgs] = await Promise.all([
      sb.from("staff").select("id,label,role").eq("active", true),
      sb.from("issues").select("*").eq("by_staff", me.id).order("created_at", { ascending: false }).limit(20),
      visibleMsgs(me, 150),
    ]);
    const convs = [...new Set(["team", `staff:${me.id}`, ...msgs.map((m: any) => m.conv)])];
    const { data: reads } = await sb.from("conv_reads").select("*").in("conv", convs);
    out.staff = staff || [];
    out.issues = issues || []; out.msgs = msgs || []; out.reads = reads || [];
    out.msgs.forEach((m: any) => paths.push(m.media_path));
  }
  out.urls = await signUrls(paths);
  return out;
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
      for (const st of staff || []) {
        const p = per[st.id];
        await pushTo([st.id], { title: `☀️ Bonjour ${String(st.label).split(" ")[0]}`, body: `${p.n} chambre${p.n > 1 ? "s" : ""} aujourd’hui, environ ${fmtMin(p.min)}.`, tag: "morning" });
      }
      return { sent: Object.keys(per).length };
    }
    if (body.kind === "purge") {
      const cfg = await getConfig(); const days = Number(cfg.retentionDays) || 30;
      const { data: old } = await sb.rpc("old_media", { days });
      const names = (old || []).map((o: any) => o.name);
      for (let i = 0; i < names.length; i += 100) await sb.storage.from("media").remove(names.slice(i, i + 100));
      const lim = new Date(Date.now() - days * 864e5).toISOString();
      await sb.from("messages").update({ media_path: null, media_type: "expired" }).lt("created_at", lim).not("media_path", "is", null);
      await sb.from("issues").update({ photo: null, video: null, audio: null }).lt("created_at", lim);
      await sb.from("invites").delete().lt("expires_at", new Date().toISOString());
      return { removed: names.length };
    }
    throw new E("bad");
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
        kind: String(it.kind || "autre").slice(0, 20), hotel, room: body.room ? String(body.room).slice(0, 12) : null,
        text: it.text ? String(it.text).slice(0, 1000) : null, urgent: !!it.urgent, photo: own(it.photo), video: own(it.video), audio: own(it.audio),
        by_staff: me.id, created_at: new Date(now + i).toISOString(),
      }));
      const { error } = await sb.from("issues").insert(rows); if (error) throw new E("db");
      const urg = rows.some((r: any) => r.urgent);
      await pushTo((await managerIds(hotel)).filter((id) => id !== me.id), { title: `${urg ? "🚨" : "🔧"} ${rows.length} problème${rows.length > 1 ? "s" : ""} signalé${rows.length > 1 ? "s" : ""}`, body: `${HOTEL_NAMES[hotel]}${rows[0].room ? " · ch. " + rows[0].room : ""} · par ${me.label}`, tag: "issue" });
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
        const x = conv.slice(6); if (!UUID.test(x) || !byId[x] || byId[x].role !== "menage") throw new E("bad");
        thread = x; to = [x, ...mgrIds(hotel)];
      } else if (conv.startsWith("dm:")) {
        const pair = conv.slice(3).split("_");
        if (pair.length !== 2 || !pair.every((p) => UUID.test(p)) || pair[0] >= pair[1]) throw new E("bad");
        const other = pair[0] === me.id ? pair[1] : pair[0];
        if (!byId[other]) throw new E("bad");
        if (!mgr && !(byId[other].role === "owner" || byId[other].role === "gerant")) throw new E("forbidden", 403);
        to = [other];
      } else throw new E("bad");
      const row = { conv, thread, from_staff: me.id, text, media_path: media, media_type: media ? String(body.media_type || "audio").slice(0, 10) : null, duration: body.duration ? Math.min(600, Math.round(body.duration)) : null, hotel, room: body.room ? String(body.room).slice(0, 12) : null };
      const { error } = await sb.from("messages").insert(row); if (error) throw new E("db");
      await sb.from("conv_reads").upsert({ staff_id: me.id, conv, read_at: new Date().toISOString() });
      const where = row.room ? `${HOTEL_NAMES[hotel || ""] || ""} · Chambre ${row.room}` : "";
      const what = text ? text.slice(0, 120) : "Message vocal";
      await pushTo(to.filter((id) => id !== me.id), {
        title: `${media ? "🎤" : "💬"} ${me.label}${label ? " · " + label : ""}`,
        body: [where, what].filter(Boolean).join(" · "), tag: "c-" + conv, conv,
      } as any);
      return { ok: true };
    }
    case "read_mark": {
      const conv = typeof body.conv === "string" ? body.conv : (mgr ? `staff:${body.thread}` : `staff:${me.id}`);
      if (!convOk(me, conv)) throw new E("forbidden", 403);
      await sb.from("conv_reads").upsert({ staff_id: me.id, conv, read_at: new Date().toISOString() });
      return { ok: true };
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
      const hotel = body.hotel, num = String(body.num || "").trim().slice(0, 12);
      if (!HOTELS.includes(hotel) || !num || !hotelOk(me, hotel)) throw new E("bad");
      const id = hotel + "__" + num.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const { data: mx } = await sb.from("rooms").select("ord").eq("hotel", hotel).order("ord", { ascending: false }).limit(1);
      const { error } = await sb.from("rooms").insert({ id, hotel, num, ord: ((mx || [])[0]?.ord || 0) + 1 });
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
    case "issue_status": {
      needMgr(me);
      const st = body.status; if (!["nouveau", "notion", "regle"].includes(st)) throw new E("bad");
      const p: any = { status: st }; if (st === "regle") { p.done_at = new Date().toISOString(); p.done_by = me.id; }
      if (body.notion_url) p.notion_url = String(body.notion_url).slice(0, 300);
      await sb.from("issues").update(p).eq("id", body.id); return { ok: true };
    }
    case "staff_save": {
      needMgr(me);
      const label = String(body.label || "").trim().slice(0, 60); if (!label) throw new E("bad");
      const hotels = (Array.isArray(body.hotels) ? body.hotels : HOTELS).filter((h: string) => HOTELS.includes(h));
      const role = ["gerant", "menage"].includes(body.role) ? body.role : "menage";
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
