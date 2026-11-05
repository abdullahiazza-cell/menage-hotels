// Courrier : les mails importants de la boîte hoteldeparisadm, relevés par le script Google de la boîte,
// reçoivent une réponse proposée par Claude (tâches planifiées de 10 h et 17 h). Le propriétaire relit,
// corrige au besoin et approuve d'un clic ; le script Google envoie alors la réponse dans le fil d'origine.
// Rien n'est jamais envoyé sans cette approbation.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

export class CE extends Error { constructor(public code: string, public status = 400) { super(code); } }
const S_ = (v: any, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const MSG = /^[0-9a-f]{12,24}$/;

async function pdfText(u8: Uint8Array) {
  try {
    const { extractText, getDocumentProxy } = await import("npm:unpdf@0.12.1");
    const pdf = await getDocumentProxy(u8);
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 12000) || null;
  } catch (_) { return null; }
}

// Range un fichier reçu (PDF ou image) dans doc_files, une seule fois par contenu.
async function storeFile(b64: string, name: string, type: string) {
  if (!b64 || b64.length > 14_000_000) return null;
  const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const pdf = u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46;
  if (!pdf && !/^image\/(jpeg|png)$/.test(type)) return null;
  const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", u8))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const id = sha.slice(0, 32);
  const { data: ex } = await db.from("doc_files").select("id").eq("id", id).maybeSingle();
  if (!ex) {
    let hex = ""; for (let i = 0; i < u8.length; i++) hex += u8[i].toString(16).padStart(2, "0");
    const { error } = await db.from("doc_files").insert({ id, name, type: pdf ? "application/pdf" : type, size: u8.length, sha256: sha, data: "\\x" + hex });
    if (error) throw new CE("db");
  }
  return { id, type: pdf ? "application/pdf" : type, size: u8.length, text: pdf ? await pdfText(u8) : null };
}

// 1) Le script Google envoie un mail reçu (dernier message d'un fil, pas écrit par nous).
export async function courrierIn(body: any) {
  const id = String(body.msg || ""); if (!MSG.test(id)) throw new CE("bad");
  const { data: ex } = await db.from("courrier").select("id").eq("id", id).maybeSingle();
  if (ex) return { ok: true, already: true };
  const pj: any[] = [];
  for (const f of (Array.isArray(body.files) ? body.files : []).slice(0, 15)) {
    const name = S_(f.name, 160) || "Document.pdf";
    try {
      const s = await storeFile(String(f.b64 || ""), name, String(f.type || ""));
      if (s) pj.push({ id: s.id, name, type: s.type, size: s.size, text: s.text || S_(f.text, 12000), drive_id: S_(f.drive_id, 80) });
    } catch (e) { console.warn("courrier pj", name, (e as any).message); }
  }
  const autres = (Array.isArray(body.others) ? body.others : []).slice(0, 20).map((o: any) => ({ name: S_(o.name, 160), type: S_(o.type, 80), size: Number(o.size) || null }));
  const thread = S_(body.thread, 40);
  const row = {
    id, thread_id: thread, de: S_(body.from, 200), de_nom: S_(body.from_name, 120), a: S_(body.to, 1000), cc: S_(body.cc, 1000),
    sujet: S_(body.subject, 300), recu_le: typeof body.date === "string" ? body.date : new Date().toISOString(),
    corps: S_(body.text, 30000), pj, autres_pj: autres, statut: "nouveau",
  };
  const { error } = await db.from("courrier").insert(row);
  if (error) { console.error("courrier_in", error); throw new CE("db"); }
  // Un nouveau message dans le même fil remplace la proposition précédente encore en attente.
  if (thread) await db.from("courrier").update({ statut: "remplace", updated_at: new Date().toISOString() }).eq("thread_id", thread).neq("id", id).in("statut", ["nouveau", "a_valider", "sans_reponse"]);
  return { ok: true, id, files: pj.length };
}

// 2) Ce que voit le propriétaire dans l'appli.
export async function courrierState() {
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const cols = "id,thread_id,de,de_nom,a,cc,sujet,recu_le,corps,pj,autres_pj,statut,importance,categorie,resume,demandes,reponse,repondre_a,copie,pieces,manque,note,propose_le,traite_le,envoye_le,erreur";
  const [{ data: open }, { data: done }, { count }] = await Promise.all([
    db.from("courrier").select(cols).in("statut", ["a_valider", "approuve", "envoi", "erreur"]).order("recu_le", { ascending: false }).limit(60),
    db.from("courrier").select("id,de,de_nom,sujet,recu_le,statut,importance,resume,note,traite_le,envoye_le").in("statut", ["envoye", "ignore", "sans_reponse"]).gte("recu_le", since).order("recu_le", { ascending: false }).limit(80),
    db.from("courrier").select("id", { count: "exact", head: true }).eq("statut", "nouveau"),
  ]);
  // Le texte des PDF reçus sert à Claude, pas à l'écran : on ne l'envoie pas à l'appli.
  (open || []).forEach((r: any) => { r.pj = (r.pj || []).map((p: any) => ({ id: p.id, name: p.name, type: p.type, drive_id: p.drive_id || null })); });
  return { open: open || [], done: done || [], nouveaux: count || 0 };
}

// 3) Décision du propriétaire : approuver (avec ses corrections), ignorer, rouvrir.
export async function courrierSet(meId: string, body: any) {
  const { data: r } = await db.from("courrier").select("*").eq("id", String(body.id || "")).maybeSingle();
  if (!r) throw new CE("bad");
  const now = new Date().toISOString();
  if (body.do === "ignorer") {
    if (!["a_valider", "erreur", "sans_reponse"].includes(r.statut)) throw new CE("courrier_etat");
    await db.from("courrier").update({ statut: "ignore", traite_par: meId, traite_le: now, updated_at: now }).eq("id", r.id);
    return { ok: true };
  }
  if (body.do === "fait") {
    // Action sans réponse (ex. fuite à vérifier) : le propriétaire la marque comme faite.
    if (r.statut !== "sans_reponse") throw new CE("courrier_etat");
    await db.from("courrier").update({ importance: "info", traite_par: meId, traite_le: now, updated_at: now }).eq("id", r.id);
    return { ok: true };
  }
  if (body.do === "rouvrir") {
    if (!["ignore", "erreur", "approuve", "sans_reponse"].includes(r.statut)) throw new CE("courrier_etat");
    if (!r.reponse) throw new CE("courrier_vide");
    await db.from("courrier").update({ statut: "a_valider", erreur: null, essais: 0, updated_at: now }).eq("id", r.id).in("statut", ["ignore", "erreur", "approuve", "sans_reponse"]);
    return { ok: true };
  }
  if (body.do !== "approuver") throw new CE("bad");
  if (!["a_valider", "erreur"].includes(r.statut)) throw new CE("courrier_etat");
  const reponse = S_(body.reponse, 20000); if (!reponse) throw new CE("courrier_vide");
  // Seules les pièces proposées peuvent partir ; le propriétaire peut en retirer, pas en inventer.
  const keep = new Set((Array.isArray(body.pieces) ? body.pieces : []).map(String));
  const pieces = (r.pieces || []).filter((p: any) => keep.has(String(p.id)));
  const manque = r.manque || [];
  const nonCouvert = (r.demandes || []).filter((d: any) => !d.ok).length;
  const retirees = (r.pieces || []).length - pieces.length;
  if ((manque.length || nonCouvert || retirees) && !body.force) throw new CE("courrier_incomplet");
  const copie = S_(body.copie, 1000);
  const { data: lock } = await db.from("courrier").update({ statut: "approuve", reponse, pieces, copie: copie ?? r.copie, traite_par: meId, traite_le: now, erreur: null, essais: 0, updated_at: now })
    .eq("id", r.id).in("statut", ["a_valider", "erreur"]).select("id");
  if (!lock || !lock.length) throw new CE("courrier_etat");
  return { ok: true };
}

// 4) Le script Google vient chercher les réponses approuvées (toutes les 5 minutes).
export async function courrierQueue() {
  const stale = new Date(Date.now() - 20 * 60e3).toISOString();
  // un envoi resté bloqué (script interrompu) est retenté, 3 fois au plus
  await db.from("courrier").update({ statut: "approuve" }).eq("statut", "envoi").lt("updated_at", stale).lt("essais", 3);
  const { data: rows } = await db.from("courrier").select("id,thread_id,de,repondre_a,copie,reponse,pieces,essais").eq("statut", "approuve").limit(10);
  const out: any[] = [];
  for (const r of rows || []) {
    const { data: lock } = await db.from("courrier").update({ statut: "envoi", essais: (r.essais || 0) + 1, updated_at: new Date().toISOString() }).eq("id", r.id).eq("statut", "approuve").select("id");
    if (!lock || !lock.length) continue;
    out.push({
      id: r.id, thread: r.thread_id, to: r.repondre_a || null, cc: r.copie || null, body: r.reponse,
      docs: (r.pieces || []).filter((p: any) => p.src === "doc").map((p: any) => ({ id: p.id, name: p.name })),
      drive: (r.pieces || []).filter((p: any) => p.src === "drive").map((p: any) => ({ id: p.id, name: p.name })),
    });
  }
  return { items: out };
}

// 5) Le script récupère une pièce rangée dans l'appli, seulement si elle part avec une réponse approuvée.
export async function courrierDoc(body: any) {
  const id = String(body.id || ""); if (!/^[0-9a-z_-]{8,64}$/i.test(id)) throw new CE("bad");
  const { data: rows } = await db.from("courrier").select("pieces").eq("statut", "envoi");
  if (!(rows || []).some((r: any) => (r.pieces || []).some((p: any) => p.src === "doc" && String(p.id) === id))) throw new CE("forbidden", 403);
  const { data: f } = await db.from("doc_files").select("name,type,data").eq("id", id).maybeSingle();
  if (!f) throw new CE("bad");
  const hex = String(f.data).replace(/^\\x/, ""); const u8 = new Uint8Array(hex.length / 2);
  for (let i = 0; i < u8.length; i++) u8[i] = parseInt(hex.substr(i * 2, 2), 16);
  let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return { name: f.name, type: f.type || "application/pdf", b64: btoa(s) };
}

// 6) Compte rendu d'envoi du script.
export async function courrierSent(body: any) {
  const id = String(body.id || ""); if (!MSG.test(id)) throw new CE("bad");
  const now = new Date().toISOString();
  if (body.ok) await db.from("courrier").update({ statut: "envoye", envoye_le: now, erreur: null, updated_at: now }).eq("id", id).eq("statut", "envoi");
  else await db.from("courrier").update({ statut: "erreur", erreur: S_(body.err, 500) || "Envoi impossible", updated_at: now }).eq("id", id).eq("statut", "envoi");
  return { ok: true, failed: !body.ok };
}

// 7) Après le passage de Claude : combien de réponses attendent le propriétaire.
export async function courrierAValider(sinceHours = 3) {
  const since = new Date(Date.now() - sinceHours * 3600e3).toISOString();
  const [{ count: all }, { count: fresh }, { data: urg }] = await Promise.all([
    db.from("courrier").select("id", { count: "exact", head: true }).eq("statut", "a_valider"),
    db.from("courrier").select("id", { count: "exact", head: true }).eq("statut", "a_valider").gte("propose_le", since),
    db.from("courrier").select("sujet").eq("statut", "a_valider").eq("importance", "urgent").gte("propose_le", since).limit(3),
  ]);
  return { all: all || 0, fresh: fresh || 0, urgent: (urg || []).map((u: any) => u.sujet) };
}
