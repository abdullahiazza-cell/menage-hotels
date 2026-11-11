// Mode travaux : inventaire des chambres (état, mesures, équipements, photos), meubles déjà possédés,
// liste d'actions et de courses, propositions d'aménagement. Hôtel Archange d'abord.
// Écriture : le propriétaire et l'intendant. Les gérants voient tout, sans modifier.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

export class TE extends Error { constructor(public code: string, public status = 400) { super(code); } }

const TR_HOTELS = ["arc"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const str = (v: any, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const int = (v: any, min: number, max: number) => { const n = Math.round(Number(v)); return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : Math.min(max, Math.max(min, n)); };
const pick = (v: any, list: string[], d: string) => (list.includes(v) ? v : d);

const canSee = (me: any) => ["owner", "gerant", "bricoleur"].includes(me.role);
export const trCanEdit = (me: any) => (me.role === "owner" || me.role === "bricoleur") && !me.readonly;
function needEdit(me: any) { if (!trCanEdit(me)) throw new TE("forbidden", 403); }

const ITEM_TYPES = ["lit_simple", "lit_double", "matelas", "sommier", "bureau", "chaise", "fauteuil", "armoire", "chevet", "tv", "miroir", "rideaux", "luminaire", "autre"];
const ETATS_ITEM = ["bon", "moyen", "a_jeter"];
const NIVEAUX = ["essentiel", "confort", "plus"];
const TODO_STATUTS = ["a_faire", "commande", "fait"];
const PROP_STATUTS = ["proposee", "retenue", "ecartee"];

async function signed(paths: string[]) {
  const uniq = [...new Set(paths.filter(Boolean))]; const out: Record<string, string> = {};
  for (let i = 0; i < uniq.length; i += 100) {
    const { data } = await db.storage.from("media").createSignedUrls(uniq.slice(i, i + 100), 6 * 3600);
    (data || []).forEach((d: any) => { if (d.signedUrl && d.path) out[d.path] = d.signedUrl; });
  }
  return out;
}
async function roomOk(id: any) {
  if (typeof id !== "string" || !id) return null;
  const { data } = await db.from("rooms").select("id,hotel").eq("id", id).maybeSingle();
  return data && TR_HOTELS.includes(data.hotel) ? data : null;
}

export async function travauxState(me: any) {
  if (!canSee(me)) throw new TE("forbidden", 403);
  const [{ data: rooms }, { data: photos }, { data: items }, { data: todo }, { data: props }] = await Promise.all([
    db.from("tr_rooms").select("*").in("hotel", TR_HOTELS),
    db.from("tr_photos").select("*").in("hotel", TR_HOTELS).order("created_at"),
    db.from("tr_items").select("*").in("hotel", TR_HOTELS).order("created_at"),
    db.from("tr_todo").select("*").in("hotel", TR_HOTELS).order("created_at"),
    db.from("tr_props").select("*").in("hotel", TR_HOTELS).order("created_at", { ascending: false }),
  ]);
  const urls = await signed((photos || []).map((p: any) => p.path));
  return { rooms: rooms || [], photos: photos || [], items: items || [], todo: todo || [], props: props || [], urls, can_edit: trCanEdit(me) };
}

export async function travauxAction(me: any, a: string, body: any) {
  if (!canSee(me)) throw new TE("forbidden", 403);
  if (a === "tr_state") return await travauxState(me);
  needEdit(me);
  const now = new Date().toISOString();

  // Fiche d'une chambre : on fusionne seulement les champs envoyés, pour que deux personnes puissent remplir la même fiche.
  if (a === "tr_room_patch") {
    const room = await roomOk(body.room_id); if (!room) throw new TE("bad");
    const patch = body.patch && typeof body.patch === "object" && !Array.isArray(body.patch) ? body.patch : null;
    if (!patch || JSON.stringify(patch).length > 20000) throw new TE("bad");
    const { data: cur } = await db.from("tr_rooms").select("data").eq("room_id", room.id).maybeSingle();
    const data: Record<string, any> = { ...((cur && cur.data) || {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (!/^[a-z0-9_]{1,40}$/.test(k)) continue;
      if (v === null || v === "") delete data[k]; else data[k] = v;
    }
    const { error } = await db.from("tr_rooms").upsert({ room_id: room.id, hotel: room.hotel, data, updated_by: me.id, updated_label: me.label, updated_at: now });
    if (error) throw new TE("server", 500);
    return { ok: true, data };
  }

  if (a === "tr_photo_add") {
    const path = String(body.path || "");
    if (!path.startsWith(me.id + "/")) throw new TE("bad");
    let room_id: string | null = null, item_id: string | null = null, hotel = "arc";
    if (body.item_id) {
      if (!UUID.test(String(body.item_id))) throw new TE("bad");
      const { data: it } = await db.from("tr_items").select("id,hotel").eq("id", body.item_id).maybeSingle();
      if (!it) throw new TE("bad"); item_id = it.id; hotel = it.hotel;
    } else {
      const room = await roomOk(body.room_id); if (!room) throw new TE("bad");
      room_id = room.id; hotel = room.hotel;
    }
    const { data, error } = await db.from("tr_photos").insert({ hotel, room_id, item_id, path, label: str(body.label, 60), created_by: me.id, created_label: me.label }).select("*").single();
    if (error) throw new TE("server", 500);
    return { ok: true, photo: data };
  }
  if (a === "tr_photo_del") {
    if (!UUID.test(String(body.id))) throw new TE("bad");
    const { data: p } = await db.from("tr_photos").select("id,path").eq("id", body.id).maybeSingle();
    if (!p) return { ok: true };
    await db.from("tr_photos").delete().eq("id", p.id);
    await db.storage.from("media").remove([p.path]).catch(() => {});
    return { ok: true };
  }

  if (a === "tr_item_save") {
    const row: Record<string, any> = {
      type: pick(body.type, ITEM_TYPES, "autre"), label: str(body.label, 120),
      w_cm: int(body.w_cm, 1, 1000), d_cm: int(body.d_cm, 1, 1000), h_cm: int(body.h_cm, 1, 1000),
      etat: pick(body.etat, ETATS_ITEM, "bon"), lieu: str(body.lieu, 80), qty: int(body.qty, 1, 500) || 1, note: str(body.note, 500),
      updated_label: me.label, updated_at: now,
    };
    row.room_id = null;
    if (body.room_id) { const room = await roomOk(body.room_id); if (room) row.room_id = room.id; }
    if (body.id) {
      if (!UUID.test(String(body.id))) throw new TE("bad");
      const { data, error } = await db.from("tr_items").update(row).eq("id", body.id).select("*").maybeSingle();
      if (error || !data) throw new TE("bad");
      return { ok: true, item: data };
    }
    const { data, error } = await db.from("tr_items").insert({ ...row, hotel: "arc", created_by: me.id }).select("*").single();
    if (error) throw new TE("server", 500);
    return { ok: true, item: data };
  }
  if (a === "tr_item_del") {
    if (!UUID.test(String(body.id))) throw new TE("bad");
    const { data: ph } = await db.from("tr_photos").select("path").eq("item_id", body.id);
    await db.from("tr_items").delete().eq("id", body.id);
    const paths = (ph || []).map((p: any) => p.path);
    if (paths.length) await db.storage.from("media").remove(paths).catch(() => {});
    return { ok: true };
  }

  if (a === "tr_todo_save") {
    const label = str(body.label, 200);
    const url = str(body.url, 500);
    const prix = body.prix === null || body.prix === undefined || body.prix === "" ? null : Number(String(body.prix).replace(",", "."));
    const row: Record<string, any> = {
      kind: pick(body.kind, ["action", "achat"], "action"), qty: int(body.qty, 1, 9999) || 1,
      ref: str(body.ref, 120), url: url && /^https?:\/\//i.test(url) ? url : null, magasin: str(body.magasin, 80),
      prix: prix !== null && Number.isFinite(prix) && prix >= 0 && prix < 1e7 ? Math.round(prix * 100) / 100 : null,
      niveau: pick(body.niveau, NIVEAUX, "essentiel"), statut: pick(body.statut, TODO_STATUTS, "a_faire"), note: str(body.note, 500),
      updated_label: me.label, updated_at: now,
    };
    row.room_id = null;
    if (body.room_id) { const room = await roomOk(body.room_id); if (room) row.room_id = room.id; }
    if (body.id) {
      if (!UUID.test(String(body.id))) throw new TE("bad");
      if (label) row.label = label;
      const { data, error } = await db.from("tr_todo").update(row).eq("id", body.id).select("*").maybeSingle();
      if (error || !data) throw new TE("bad");
      return { ok: true, todo: data };
    }
    if (!label) throw new TE("bad");
    const { data, error } = await db.from("tr_todo").insert({ ...row, label, hotel: "arc", created_by: me.id }).select("*").single();
    if (error) throw new TE("server", 500);
    return { ok: true, todo: data };
  }
  if (a === "tr_todo_statut") {
    if (!UUID.test(String(body.id))) throw new TE("bad");
    await db.from("tr_todo").update({ statut: pick(body.statut, TODO_STATUTS, "a_faire"), updated_label: me.label, updated_at: now }).eq("id", body.id);
    return { ok: true };
  }
  if (a === "tr_todo_del") {
    if (!UUID.test(String(body.id))) throw new TE("bad");
    await db.from("tr_todo").delete().eq("id", body.id);
    return { ok: true };
  }

  if (a === "tr_prop_set") {
    if (!UUID.test(String(body.id))) throw new TE("bad");
    await db.from("tr_props").update({ statut: pick(body.statut, PROP_STATUTS, "proposee"), decided_label: me.label, updated_at: now }).eq("id", body.id);
    return { ok: true };
  }
  throw new TE("bad");
}
