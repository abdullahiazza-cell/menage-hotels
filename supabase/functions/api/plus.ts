// Fonctions « en plus » de Ma Réception (v80) :
// - objets trouvés (photo, chambre, rangement, rendu au client) ;
// - état des lieux au départ d'un client (rien à signaler, ou dégâts avec photos : preuve pour la caution) ;
// - stock de linge par hôtel, avec seuil d'alerte ;
// - carnet de santé de chaque chambre (pannes, travaux, coûts, âge du matelas, ménages) ;
// - voix des tutos ;
// - texte écrit des vocaux en français (Google Speech-to-Text) : en sommeil tant que la clé GOOGLE_STT_KEY (ou GOOGLE_TTS_KEY) n'est pas installée dans Supabase.
// Tout passe par la fonction « api » : ce fichier ne répond à rien tout seul.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

export class PE extends Error { constructor(public code: string, public status = 400) { super(code); } }

export const PLUS_ACTIONS = ["lost_add", "lost_set", "lost_delete", "checkout_add", "checkout_seen", "linen_set", "linen_log", "carnet_get", "carnet_add", "carnet_del", "tuto_urls", "msg_transcribe"];
// Lectures permises aux comptes en lecture seule.
export const PLUS_RO = ["linen_log", "carnet_get", "tuto_urls"];

const HOTELS = ["arc", "par", "cha"];
const HOTEL_NAMES: Record<string, string> = { arc: "Archange", par: "Hôtel de Paris", cha: "Châteaudun" };
const TZ = "Europe/Paris";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const str = (v: any, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const int = (v: any, min: number, max: number) => { const n = Math.round(Number(v)); return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : Math.min(max, Math.max(min, n)); };
const isMgr = (me: any) => me.role === "owner" || me.role === "gerant";
const isBrico = (me: any) => me.role === "bricoleur";
const hotelOk = (me: any, h: string) => !me.only_hotel || me.only_hotel === h;
const own = (me: any, p: any) => (typeof p === "string" && p.startsWith(me.id + "/")) ? p : null;
const parisDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const firstName = (me: any) => String(me.label || "").split(" ")[0];
const roomLbl = (room: string | null) => room ? (/^\d/.test(room) ? " · ch. " : " · ") + room : "";
function needStaff(me: any) { if (!isMgr(me) && !isBrico(me)) throw new PE("forbidden", 403); }
function needMgr(me: any) { if (!isMgr(me)) throw new PE("forbidden", 403); }

type Deps = { pushTo: (ids: string[], payload: { title: string; body: string; tag?: string }) => Promise<void>; managerIds: (hotel?: string | null) => Promise<string[]> };

// Linge suivi par défaut ; la liste peut être changée dans les réglages (config.linge).
export const LINGE = [
  { id: "drap1", e: "🛏️", l: "Draps 1 personne" }, { id: "drap2", e: "🛌", l: "Draps 2 personnes" },
  { id: "housse", e: "🧵", l: "Housses de couette" }, { id: "taie", e: "💤", l: "Taies d’oreiller" },
  { id: "serv_g", e: "🧖", l: "Grandes serviettes" }, { id: "serv_p", e: "🧻", l: "Petites serviettes" },
  { id: "tapis", e: "🦶", l: "Tapis de bain" }, { id: "alese", e: "🛡️", l: "Alèses" },
];
const EDL_KINDS = ["literie", "meuble", "tv", "tabac", "mur", "sdb", "linge", "cle", "sale", "autre"];
const LOST_KINDS = ["tel", "vetement", "bijou", "papiers", "argent", "cles", "toilette", "autre"];
const LOST_STATUTS = ["garde", "rendu", "jete"];
const CARNET_KINDS = ["matelas", "literie", "peinture", "sol", "mobilier", "equipement", "plomberie", "electricite", "nuisibles", "controle", "note"];

async function signed(paths: string[]) {
  const uniq = [...new Set(paths.filter(Boolean))]; const out: Record<string, string> = {};
  for (let i = 0; i < uniq.length; i += 100) {
    const { data } = await db.storage.from("media").createSignedUrls(uniq.slice(i, i + 100), 6 * 3600);
    (data || []).forEach((d: any) => { if (d.signedUrl && d.path) out[d.path] = d.signedUrl; });
  }
  return out;
}
async function linenCatalog() {
  const { data } = await db.from("config").select("data").eq("id", 1).single();
  const L = data?.data?.linge;
  return Array.isArray(L) && L.length ? L : LINGE;
}
// La personne qui vient de quitter la chambre : sortie depuis moins de 3 jours, sinon présente avec un départ prévu aujourd'hui ou dépassé.
async function departing(roomId: string) {
  const today = parisDay(), lim = parisDay(new Date(Date.now() - 3 * 864e5));
  const { data } = await db.from("occupants").select("id,prenom,nom,statut,sortie,depart_prevu").eq("room_id", roomId).order("entree", { ascending: false }).limit(20);
  const L = data || [];
  return L.filter((o: any) => o.statut === "sorti" && o.sortie && o.sortie >= lim).sort((a: any, b: any) => String(b.sortie).localeCompare(String(a.sortie)))[0]
    || L.find((o: any) => o.statut !== "sorti" && o.depart_prevu && o.depart_prevu <= today) || null;
}

// ---------- ce que l'appli reçoit à chaque rafraîchissement ----------
export async function plusState(me: any, paths: string[]) {
  const staff = isMgr(me) || isBrico(me);
  const out: any = { stt: !!GKEY, linge: [], lost: [], edl: [] };
  const { data: stock } = await db.from("linen").select("hotel,item,qty,seuil,updated_at,updated_by");
  out.linge = (stock || []).filter((s: any) => hotelOk(me, s.hotel));
  if (staff) {
    const lim = new Date(Date.now() - 60 * 864e5).toISOString();
    const [{ data: lost }, { data: edl }] = await Promise.all([
      db.from("lost_items").select("*").or(`statut.eq.garde,closed_at.gte.${lim}`).order("found_at", { ascending: false }).limit(200),
      db.from("checkouts").select("*").gte("created_at", lim).order("created_at", { ascending: false }).limit(300),
    ]);
    out.lost = (lost || []).filter((x: any) => hotelOk(me, x.hotel));
    out.edl = (edl || []).filter((x: any) => hotelOk(me, x.hotel));
    out.edl.forEach((c: any) => (c.items || []).forEach((i: any) => paths.push(i.photo)));
  } else {
    // Équipe : ses propres objets trouvés récents, et ses états des lieux des dernières 36 heures (sans le nom du client).
    const [{ data: lost }, { data: edl }] = await Promise.all([
      db.from("lost_items").select("id,hotel,room,kind,photo,found_at,statut").eq("found_by", me.id).gte("found_at", new Date(Date.now() - 14 * 864e5).toISOString()).order("found_at", { ascending: false }).limit(20),
      db.from("checkouts").select("id,room_id,ok,created_at").eq("by_staff", me.id).gte("created_at", new Date(Date.now() - 36 * 3600e3).toISOString()),
    ]);
    out.lost = lost || []; out.edl = edl || [];
  }
  out.lost.forEach((x: any) => paths.push(x.photo));
  return out;
}

// ---------- texte écrit des vocaux (français) ----------
// Service : Google Speech-to-Text, avec la même clé Google que la voix française du point audio (GOOGLE_TTS_KEY), ou une clé à part (GOOGLE_STT_KEY).
// Sans clé, rien ne se passe : l'appli ne propose pas le texte des vocaux.
// Les vocaux de l'appli sont des WAV (16 bits, mono) : on les découpe en morceaux de 55 secondes au plus.
// Un vocal dans une autre langue donne un texte peu sûr : on ne l'affiche pas (note « pas en français »).
const GKEY = Deno.env.get("GOOGLE_STT_KEY") || Deno.env.get("GOOGLE_TTS_KEY") || "";
function b64(u: Uint8Array) { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }
function wavPcm(u: Uint8Array) {
  const tag = (o: number) => String.fromCharCode(u[o], u[o + 1], u[o + 2], u[o + 3]);
  if (u.length < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new PE("format");
  const v = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let o = 12, rate = 16000, ch = 1, bits = 16;
  while (o + 8 <= u.length) {
    const id = tag(o), sz = v.getUint32(o + 4, true);
    if (id === "fmt ") { ch = v.getUint16(o + 10, true); rate = v.getUint32(o + 12, true); bits = v.getUint16(o + 22, true); }
    if (id === "data") { if (ch !== 1 || bits !== 16) throw new PE("format"); return { rate, pcm: u.subarray(o + 8, Math.min(u.length, o + 8 + sz)) }; }
    o += 8 + sz + (sz & 1);
  }
  throw new PE("format");
}
async function listen(path: string): Promise<{ transcript: string; conf: number }> {
  if (!GKEY) throw new PE("no_stt");
  if (!/\.wav$/i.test(path)) throw new PE("format");
  const { data, error } = await db.storage.from("media").download(path);
  if (error || !data) throw new PE("gone");
  const { rate, pcm } = wavPcm(new Uint8Array(await data.arrayBuffer()));
  const step = rate * 2 * 55, parts: string[] = []; let conf = 0, nc = 0;
  for (let o = 0; o < pcm.length && o < step * 4; o += step) {
    const r = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(GKEY)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: { encoding: "LINEAR16", sampleRateHertz: rate, languageCode: "fr-FR", enableAutomaticPunctuation: true }, audio: { content: b64(pcm.subarray(o, Math.min(pcm.length, o + step))) } }),
    });
    if (!r.ok) throw new Error(`google stt ${r.status} ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    for (const res of j.results || []) { const alt = (res.alternatives || [])[0]; if (alt?.transcript) { parts.push(String(alt.transcript).trim()); if (typeof alt.confidence === "number") { conf += alt.confidence; nc++; } } }
  }
  return { transcript: parts.join(" ").slice(0, 4000), conf: nc ? conf / nc : 0 };
}
async function transcribeMsg(m: any) {
  try {
    const t = await listen(m.media_path);
    const sure = t.transcript && t.conf >= 0.6;
    await db.from("messages").update({ transcript: sure ? t.transcript : null, tr_at: new Date().toISOString(), tr_err: sure ? null : (t.transcript ? "pas_francais" : "vide") }).eq("id", m.id);
    return { transcript: sure ? t.transcript : null, note: sure ? null : (t.transcript ? "pas_francais" : "vide") };
  } catch (e) {
    if (e instanceof PE && e.code === "no_stt") throw e;
    const code = e instanceof PE ? e.code : String((e as any)?.message || e).slice(0, 300);
    if (!(e instanceof PE)) console.error("transcribe", m.id, e);
    await db.from("messages").update({ tr_at: new Date().toISOString(), tr_err: code }).eq("id", m.id);
    throw new PE("stt_fail");
  }
}
// Appelé par le cron : les vocaux des 3 derniers jours qui n'ont pas encore été écoutés (10 au plus à chaque passage).
export async function transcribeBatch() {
  if (!GKEY) return { skipped: "no_key" };
  const { data } = await db.from("messages").select("id,media_path").eq("media_type", "audio").not("media_path", "is", null).is("tr_at", null)
    .gte("created_at", new Date(Date.now() - 3 * 864e5).toISOString()).order("created_at", { ascending: false }).limit(10);
  let done = 0;
  for (const m of data || []) { try { await transcribeMsg(m); done++; } catch (_) { /* noté dans tr_err */ } }
  return { done, seen: (data || []).length };
}

// ---------- actions ----------
export async function plusAction(me: any, a: string, body: any, deps: Deps) {
  const now = new Date().toISOString();
  const rowId = UUID.test(String(body._id || "")) ? { id: String(body._id) } : {};

  if (a === "tuto_urls") {
    const { data } = await db.from("app_meta").select("value").eq("key", "tuto_audio").maybeSingle();
    const paths: string[] = Array.isArray(data?.value?.paths) ? data!.value.paths.filter((p: any) => typeof p === "string" && p.startsWith("tts/tuto-")) : [];
    return { urls: await signed(paths) };
  }

  // --- objets trouvés ---
  if (a === "lost_add") {
    const hotel = HOTELS.includes(body.hotel) && hotelOk(me, body.hotel) ? body.hotel : null; if (!hotel) throw new PE("bad");
    const photo = own(me, body.photo); if (!photo) throw new PE("photo");
    const row = { ...rowId, hotel, room: str(body.room, 40), kind: LOST_KINDS.includes(body.kind) ? body.kind : "autre", descr: str(body.descr, 300), photo, place: str(body.place, 120), found_by: me.id, found_at: now };
    const { error } = await db.from("lost_items").insert(row);
    if (error) { if (error.code === "23505") return { ok: true, dup: true }; throw new PE("db"); }
    const { data: bricos } = await db.from("staff").select("id").eq("role", "bricoleur").eq("active", true);
    const ids = [...new Set([...(await deps.managerIds(hotel)), ...(bricos || []).map((b: any) => b.id)])].filter((id) => id !== me.id);
    await deps.pushTo(ids, { title: "🎒 Objet trouvé", body: `${HOTEL_NAMES[hotel]}${roomLbl(row.room)} · par ${firstName(me)}`, tag: "lost" }).catch(() => {});
    return { ok: true };
  }
  if (a === "lost_set") {
    needStaff(me);
    const { data: it } = await db.from("lost_items").select("*").eq("id", body.id).single();
    if (!it || !hotelOk(me, it.hotel)) throw new PE("bad");
    const patch: any = {};
    if (body.place !== undefined) patch.place = str(body.place, 120);
    if (body.descr !== undefined) patch.descr = str(body.descr, 300);
    if (body.statut !== undefined) {
      if (!LOST_STATUTS.includes(body.statut)) throw new PE("bad");
      patch.statut = body.statut;
      if (body.statut === "garde") { patch.closed_at = null; patch.closed_by = null; patch.closed_note = null; }
      else { patch.closed_at = now; patch.closed_by = me.id; patch.closed_note = str(body.note, 200); }
    }
    if (!Object.keys(patch).length) throw new PE("bad");
    await db.from("lost_items").update(patch).eq("id", it.id);
    return { ok: true };
  }
  if (a === "lost_delete") {
    needMgr(me);
    const { data: it } = await db.from("lost_items").select("id,hotel,photo").eq("id", body.id).single();
    if (!it || !hotelOk(me, it.hotel)) throw new PE("bad");
    await db.from("lost_items").delete().eq("id", it.id);
    if (it.photo) await db.storage.from("media").remove([it.photo]).catch(() => {});
    return { ok: true };
  }

  // --- état des lieux au départ ---
  if (a === "checkout_add") {
    let hotel = HOTELS.includes(body.hotel) ? body.hotel : null, room = str(body.room, 40), roomId: string | null = null;
    if (body.room_id) {
      const { data: r } = await db.from("rooms").select("id,hotel,num").eq("id", String(body.room_id)).single();
      if (!r) throw new PE("bad"); hotel = r.hotel; room = r.num; roomId = r.id;
    }
    if (!hotel || !hotelOk(me, hotel)) throw new PE("bad");
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 12).map((i: any) => ({ k: EDL_KINDS.includes(i?.k) ? i.k : "autre", text: str(i?.text, 400), photo: own(me, i?.photo) }));
    const okFlag = items.length === 0;
    const occ = roomId ? await departing(roomId).catch(() => null) : null;
    const row = { ...rowId, hotel, room_id: roomId, room, ok: okFlag, items, note: str(body.note, 400), by_staff: me.id, occupant_id: occ?.id || null, occupant_nom: occ ? [occ.prenom, occ.nom].filter(Boolean).join(" ").slice(0, 120) : null };
    const { error } = await db.from("checkouts").insert(row);
    if (error) { if (error.code === "23505") return { ok: true, dup: true }; throw new PE("db"); }
    if (!okFlag) {
      const ids = (await deps.managerIds(hotel)).filter((id) => id !== me.id);
      await deps.pushTo(ids, { title: "⚠️ Dégâts au départ", body: `${HOTEL_NAMES[hotel]}${roomLbl(room)} · ${items.length} point${items.length > 1 ? "s" : ""} · par ${firstName(me)}`, tag: "edl" }).catch(() => {});
    }
    return { ok: true };
  }
  if (a === "checkout_seen") {
    needMgr(me);
    await db.from("checkouts").update({ seen_at: body.undo ? null : now, seen_by: body.undo ? null : me.id, suite: body.undo ? null : str(body.suite, 200) }).eq("id", body.id);
    return { ok: true };
  }

  // --- linge ---
  if (a === "linen_set") {
    const hotel = HOTELS.includes(body.hotel) && hotelOk(me, body.hotel) ? body.hotel : null; if (!hotel) throw new PE("bad");
    const cat = await linenCatalog(); const it = cat.find((x: any) => x.id === body.item); if (!it) throw new PE("bad");
    const { data: cur } = await db.from("linen").select("*").eq("hotel", hotel).eq("item", it.id).maybeSingle();
    let qty = cur?.qty ?? 0, seuil = cur?.seuil ?? 0, kind = "compte", delta = 0;
    if (body.seuil !== undefined && body.seuil !== null) { needMgr(me); seuil = int(body.seuil, 0, 9999) ?? 0; kind = "seuil"; }
    if (body.qty !== undefined && body.qty !== null) { const q = int(body.qty, 0, 9999); if (q === null) throw new PE("bad"); delta = q - qty; qty = q; kind = "compte"; }
    else if (body.delta) { const d = int(body.delta, -999, 999) || 0; const q = Math.max(0, qty + d); delta = q - qty; qty = q; kind = d > 0 ? "plus" : "moins"; }
    const low = seuil > 0 && qty < seuil;
    const alert = low && !cur?.alerted;
    const { error } = await db.from("linen").upsert({ hotel, item: it.id, qty, seuil, updated_at: now, updated_by: me.id, alerted: low });
    if (error) throw new PE("db");
    if (delta || kind === "seuil") await db.from("linen_log").insert({ hotel, item: it.id, qty, delta, kind, by_staff: me.id });
    if (alert) {
      const ids = (await deps.managerIds(hotel)).filter((id) => id !== me.id);
      await deps.pushTo(ids, { title: "🧺 Linge bientôt en manque", body: `${HOTEL_NAMES[hotel]} · ${it.l} : il en reste ${qty} (seuil ${seuil})`, tag: "linge" }).catch(() => {});
    }
    return { ok: true, qty, low };
  }
  if (a === "linen_log") {
    needStaff(me);
    const hotel = HOTELS.includes(body.hotel) && hotelOk(me, body.hotel) ? body.hotel : null; if (!hotel) throw new PE("bad");
    const { data } = await db.from("linen_log").select("item,qty,delta,kind,by_staff,created_at").eq("hotel", hotel).order("created_at", { ascending: false }).limit(60);
    return { log: data || [] };
  }

  // --- carnet de santé d'une chambre ---
  if (a === "carnet_get") {
    needStaff(me);
    const { data: r } = await db.from("rooms").select("id,hotel,num,kind,periodic_done,done_at,done_by,blocked,block_reason").eq("id", String(body.room_id)).single();
    if (!r || !hotelOk(me, r.hotel)) throw new PE("bad");
    const [{ data: events }, { data: issues }, { data: jobs }, { data: edl }, { data: lost }] = await Promise.all([
      db.from("room_events").select("*").eq("room_id", r.id).order("day", { ascending: false }).limit(200),
      db.from("issues").select("id,num,kind,title,text,etat,priority,origin,parts,details,photo,created_at,done_at").eq("hotel", r.hotel).eq("room", r.num).order("created_at", { ascending: false }).limit(100),
      db.from("jobs").select("staff_id,type,started_at,ended_at").eq("room_id", r.id).order("ended_at", { ascending: false }).limit(500),
      db.from("checkouts").select("id,ok,items,note,by_staff,occupant_nom,created_at,seen_at,suite").eq("room_id", r.id).order("created_at", { ascending: false }).limit(30),
      db.from("lost_items").select("id,kind,descr,photo,statut,found_at").eq("hotel", r.hotel).eq("room", r.num).order("found_at", { ascending: false }).limit(30),
    ]);
    const J = jobs || [], d30 = Date.now() - 30 * 864e5, d365 = Date.now() - 365 * 864e5;
    const mins = (t: string) => { const L = J.filter((j: any) => j.type === t && j.started_at && j.ended_at).map((j: any) => (Date.parse(j.ended_at) - Date.parse(j.started_at)) / 60000).filter((m: number) => m > 1 && m < 240); return L.length ? Math.round(L.reduce((s: number, m: number) => s + m, 0) / L.length) : null; };
    const paths: string[] = [];
    (events || []).forEach((e: any) => paths.push(e.photo)); (issues || []).forEach((i: any) => paths.push(i.photo));
    (edl || []).forEach((c: any) => (c.items || []).forEach((i: any) => paths.push(i.photo))); (lost || []).forEach((x: any) => paths.push(x.photo));
    return {
      room: r, events: events || [], issues: issues || [], edl: isMgr(me) ? (edl || []) : (edl || []).map(({ occupant_nom: _n, ...c }: any) => c), lost: lost || [],
      jobs: { n: J.length, n30: J.filter((j: any) => Date.parse(j.ended_at) > d30).length, n365: J.filter((j: any) => Date.parse(j.ended_at) > d365).length, last: J[0]?.ended_at || null, blanc: mins("blanc"), recouche: mins("recouche") },
      urls: await signed(paths),
    };
  }
  if (a === "carnet_add") {
    needStaff(me);
    const { data: r } = await db.from("rooms").select("id,hotel").eq("id", String(body.room_id)).single();
    if (!r || !hotelOk(me, r.hotel)) throw new PE("bad");
    if (!CARNET_KINDS.includes(body.kind)) throw new PE("bad");
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(body.day || "")) && String(body.day) <= parisDay(new Date(Date.now() + 864e5)) ? String(body.day) : parisDay();
    const c = Number(String(body.cost ?? "").replace(",", "."));
    const cost = body.cost === undefined || body.cost === null || body.cost === "" || !Number.isFinite(c) ? null : Math.min(999999, Math.max(0, Math.round(c * 100) / 100));
    const { error } = await db.from("room_events").insert({ room_id: r.id, hotel: r.hotel, kind: body.kind, text: str(body.text, 600), cost, day, photo: own(me, body.photo), by_staff: me.id });
    if (error) throw new PE("db");
    return { ok: true };
  }
  if (a === "carnet_del") {
    needMgr(me);
    const { data: e } = await db.from("room_events").select("id,hotel,photo").eq("id", body.id).single();
    if (!e || !hotelOk(me, e.hotel)) throw new PE("bad");
    await db.from("room_events").delete().eq("id", e.id);
    if (e.photo) await db.storage.from("media").remove([e.photo]).catch(() => {});
    return { ok: true };
  }

  // --- texte écrit d'un vocal, à la demande ---
  if (a === "msg_transcribe") {
    needMgr(me);
    const { data: m } = await db.from("messages").select("id,media_path,media_type,transcript,tr_at,tr_err").eq("id", body.id).single();
    if (!m || !m.media_path || m.media_type !== "audio") throw new PE("gone");
    if (m.tr_at && !body.again) return { transcript: m.transcript, note: m.tr_err };
    return await transcribeMsg(m);
  }
  throw new PE("unknown_action");
}
