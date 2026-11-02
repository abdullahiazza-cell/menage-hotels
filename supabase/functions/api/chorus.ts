// Chorus Pro (factures au Département du Loiret) : suivi des statuts, dépôt validé par le propriétaire,
// rapprochement avec les virements reçus.
// Les identifiants ne sont jamais dans ce dépôt : secrets Supabase CHORUS_PARIS_* et CHORUS_ARCHANGE_*
// (CLIENT_ID, CLIENT_SECRET = application PISTE ; TECH_LOGIN, TECH_PASSWORD = compte technique Chorus).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const OAUTH = "https://oauth.piste.gouv.fr/api/oauth/token";
const API = "https://api.piste.gouv.fr";

// Structures facturées. idFournisseur = identifiant Chorus lu sur les factures déjà déposées.
export const STRUCT: Record<string, { pre: string; siret: string; nom: string; idFournisseur: number }> = {
  paris: { pre: "CHORUS_PARIS", siret: "50527259100023", nom: "Hôtel de Paris", idFournisseur: 50605624 },
  archange: { pre: "CHORUS_ARCHANGE", siret: "83983860400016", nom: "Archange", idFournisseur: 49752346 },
};
const BY_SIRET: Record<string, string> = Object.fromEntries(Object.entries(STRUCT).map(([k, v]) => [v.siret, k]));
// Destinataire habituel : Département du Loiret, service 30.
const DEST = { codeDestinataire: "22450001700013", codeServiceExecutant: "30" };

const env = (s: string, n: string) => Deno.env.get(`${STRUCT[s].pre}_${n}`) || "";
const tokens: Record<string, { t: string; exp: number }> = {};

async function token(s: string) {
  const c = tokens[s];
  if (c && c.exp > Date.now() + 60_000) return c.t;
  const id = env(s, "CLIENT_ID"), sec = env(s, "CLIENT_SECRET");
  if (!id || !sec) throw new Error("chorus_no_key");
  const r = await fetch(OAUTH, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: sec, scope: "openid" }) });
  if (!r.ok) throw new Error(`chorus_token_${r.status}`);
  const j = await r.json();
  tokens[s] = { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token as string;
}

async function call(s: string, path: string, body: unknown) {
  const login = env(s, "TECH_LOGIN"), pwd = env(s, "TECH_PASSWORD");
  if (!login || !pwd) throw new Error("chorus_no_key");
  const r = await fetch(API + path, {
    method: "POST",
    headers: {
      "content-type": "application/json;charset=utf-8", accept: "application/json;charset=utf-8",
      authorization: `Bearer ${await token(s)}`,
      "cpro-account": btoa(unescape(encodeURIComponent(`${login}:${pwd}`))),
    },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let j: any = null; try { j = JSON.parse(t); } catch { /* */ }
  if (!r.ok || (j && typeof j.codeRetour === "number" && j.codeRetour !== 0)) {
    const e: any = new Error(`chorus_${r.status}`);
    e.detail = (j && (j.libelle || j.message)) || t.slice(0, 300);
    throw e;
  }
  return j;
}

// ---------- 1) suivi des statuts ----------
const IGNORE = ["BROUILLON", "SUPPRIMEE"];
export async function chorusSync() {
  // Le compte technique voit les factures des deux structures : une seule lecture suffit.
  const s = env("paris", "TECH_LOGIN") ? "paris" : "archange";
  const all: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const j = await call(s, "/cpro/factures/v1/rechercher/fournisseur", { rechercheFactureParFournisseur: { pageResultatDemandee: page, nbResultatsParPage: 100, triColonne: "DateDepot", triSens: "Descendant" } });
    all.push(...(j.listeFactures || []));
    const pages = j.parametresRetour?.pages || 1;
    if (page >= pages) break;
  }
  const { data: old } = await db.from("chorus_factures").select("chorus_id,statut");
  const prev: Record<string, string> = {};
  (old || []).forEach((o: any) => prev[String(o.chorus_id)] = o.statut);
  const changes: any[] = [];
  const rows = all.map((f: any) => {
    const id = Number(f.identifiantFactureCPP);
    if (prev[String(id)] !== undefined && prev[String(id)] !== f.statut) changes.push({ chorus_id: id, ancien: prev[String(id)], nouveau: f.statut, numero: f.numeroFacture, ttc: f.montantTTC, structure: BY_SIRET[f.codeFournisseur] || "?" });
    return {
      chorus_id: id, structure: BY_SIRET[f.codeFournisseur] || f.designationFournisseur || "?",
      numero: String(f.numeroFacture || ""), montant_ttc: f.montantTTC ?? null, statut: f.statut || null,
      date_facture: f.dateFacture || null, date_depot: f.dateDepot || null, etat_le: f.dateHeureEtatCourant || null, maj_le: new Date().toISOString(),
    };
  });
  for (let i = 0; i < rows.length; i += 200) await db.from("chorus_factures").upsert(rows.slice(i, i + 200), { onConflict: "chorus_id" });
  if (changes.length) await db.from("chorus_hist").insert(changes.map((c) => ({ chorus_id: c.chorus_id, ancien: c.ancien, nouveau: c.nouveau })));
  // Les dépôts faits par l'appli suivent le statut lu sur Chorus.
  return { n: rows.length, changes };
}

// ---------- 2) dépôt d'une facture validée par le propriétaire ----------
const b64 = (u8: Uint8Array) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const r2 = (n: number) => Math.round(Number(n) * 100) / 100;

async function upload(s: string, path: string) {
  const { data, error } = await db.storage.from("factures").download(path);
  if (error || !data) throw new Error("chorus_file_missing");
  const u8 = new Uint8Array(await data.arrayBuffer());
  if (u8.length > 10 * 1024 * 1024) throw new Error("chorus_file_big");
  const name = path.split("/").pop()!.slice(-50);
  const j = await call(s, "/cpro/transverses/v1/ajouter/fichier", { pieceJointeFichier: b64(u8), pieceJointeNom: name, pieceJointeTypeMime: "application/pdf", pieceJointeExtension: "PDF" });
  const id = Number(j.pieceJointeId ?? j.pieceJointeIdFichier);
  if (!id) throw new Error("chorus_upload_fail");
  return id;
}

// Contrôles avant dépôt : montants cohérents, numéro jamais déposé, fichier présent.
export async function depotCheck(d: any) {
  const pb: string[] = [];
  if (!STRUCT[d.structure]) pb.push("structure inconnue");
  if (Math.abs(r2(d.montant_ht) + r2(d.montant_tva) - r2(d.montant_ttc)) > 0.011) pb.push("HT + TVA ≠ TTC");
  if (Math.abs(r2(d.montant_ht) * Number(d.taux_tva) / 100 - r2(d.montant_tva)) > 0.05) pb.push(`TVA ≠ ${d.taux_tva} % du HT`);
  const { data: dup } = await db.from("chorus_factures").select("chorus_id,statut").eq("numero", d.numero).eq("structure", d.structure);
  if ((dup || []).some((x: any) => !IGNORE.includes(x.statut))) pb.push("ce numéro est déjà sur Chorus");
  return pb;
}

export async function chorusDeposer(d: any) {
  const s = d.structure, F = STRUCT[s];
  const pb = await depotCheck(d);
  if (pb.length) throw Object.assign(new Error("chorus_check"), { detail: pb.join(", ") });
  const principale = await upload(s, d.facture_path);
  const annexes: any[] = [];
  for (const a of (d.annexes || [])) annexes.push({ pieceJointeComplementaireDesignation: String(a.designation || "Document annexe").slice(0, 50), pieceJointeComplementaireId: await upload(s, a.path), pieceJointeComplementaireType: "DIVERS" });
  const body: any = {
    modeDepot: "DEPOT_PDF_API",
    numeroFactureSaisi: d.numero,
    dateFacture: d.date_facture,
    cadreDeFacturation: { codeCadreFacturation: "A1_FACTURE_FOURNISSEUR" },
    destinataire: DEST,
    fournisseur: { idFournisseur: F.idFournisseur },
    references: { deviseFacture: "EUR", typeFacture: "FACTURE", typeTva: "TVA_SUR_DEBIT", modePaiement: "VIREMENT" },
    montantTotal: { montantHtTotal: r2(d.montant_ht), montantTVA: r2(d.montant_tva), montantTtcTotal: r2(d.montant_ttc), montantRemiseGlobaleTTC: 0, montantAPayer: r2(d.montant_ttc) },
    ligneTva: [{ ligneTvaTauxManuel: Number(d.taux_tva), ligneTvaMontantBaseHtParTaux: r2(d.montant_ht), ligneTvaMontantTvaParTaux: r2(d.montant_tva) }],
    pieceJointePrincipale: [{ pieceJointePrincipaleDesignation: "Facture", pieceJointePrincipaleId: principale }],
    ...(annexes.length ? { pieceJointeComplementaire: annexes } : {}),
  };
  const j = await call(s, "/cpro/factures/v1/soumettre", body);
  return { chorus_id: Number(j.identifiantFactureCPP) || null, statut: j.statutFacture || null };
}

// ---------- 3) rapprochement virements <-> factures ----------
const PAYEUR = /LOIRET|DEPARTEMENT|DEPT|PAIERIE|DRFIP|DGFIP|TRESOR/i;
export async function rapprocher() {
  const since = new Date(Date.now() - 150 * 864e5).toISOString().slice(0, 10);
  const [{ data: tx }, { data: fac }, { data: done }] = await Promise.all([
    db.from("bank_tx").select("*").gt("amount", 0).gte("day", since),
    db.from("chorus_factures").select("chorus_id,structure,numero,montant_ttc,statut,date_depot,paye_le").is("paye_le", null),
    db.from("chorus_paiements").select("uid,tx_id,chorus_ids,statut"),
  ]);
  const taken = new Set<string>(), used = new Set<number>();
  (done || []).forEach((p: any) => { if (p.statut !== "rejete") { taken.add(p.uid + "|" + p.tx_id); p.chorus_ids.forEach((i: number) => used.add(Number(i))); } });
  const rejected = new Set((done || []).filter((p: any) => p.statut === "rejete").map((p: any) => p.uid + "|" + p.tx_id + "|" + [...p.chorus_ids].sort().join(",")));
  const open = (fac || []).filter((f: any) => !IGNORE.includes(f.statut) && f.statut !== "REJETEE" && !used.has(Number(f.chorus_id)));
  const out: any[] = [];
  const add = (t: any, ids: number[], mode: string) => {
    const k = t.uid + "|" + t.tx_id + "|" + [...ids].sort().join(",");
    if (rejected.has(k)) return false;
    out.push({ uid: t.uid, tx_id: t.tx_id, chorus_ids: ids, mode }); ids.forEach((i) => used.add(i)); taken.add(t.uid + "|" + t.tx_id); return true;
  };
  for (const t of tx || []) {
    if (taken.has(t.uid + "|" + t.tx_id)) continue;
    const txt = `${t.label || ""} ${t.counterparty || ""}`;
    if (!PAYEUR.test(txt)) continue;
    const cand = open.filter((f: any) => !used.has(Number(f.chorus_id)) && (!f.date_depot || f.date_depot <= t.day));
    // a) numéro de facture écrit dans le libellé
    const byNum = cand.filter((f: any) => f.numero && f.numero.length >= 5 && txt.includes(f.numero));
    if (byNum.length && Math.abs(byNum.reduce((x: number, f: any) => x + Number(f.montant_ttc), 0) - Number(t.amount)) < 0.01) { add(t, byNum.map((f: any) => Number(f.chorus_id)), "numero"); continue; }
    // b) une seule facture du même montant
    const same = cand.filter((f: any) => Math.abs(Number(f.montant_ttc) - Number(t.amount)) < 0.01);
    if (same.length === 1) { add(t, [Number(same[0].chorus_id)], "montant"); continue; }
    // c) deux ou trois factures d'une même structure dont la somme fait le montant (une seule combinaison)
    const combos: number[][] = [];
    for (const st of Object.keys(STRUCT)) {
      const L = cand.filter((f: any) => f.structure === st).slice(0, 40);
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = Number(L[i].montant_ttc) + Number(L[j].montant_ttc);
        if (Math.abs(a - Number(t.amount)) < 0.01) combos.push([L[i].chorus_id, L[j].chorus_id].map(Number));
        for (let k = j + 1; k < L.length && combos.length < 3; k++) if (Math.abs(a + Number(L[k].montant_ttc) - Number(t.amount)) < 0.01) combos.push([L[i].chorus_id, L[j].chorus_id, L[k].chorus_id].map(Number));
      }
    }
    if (combos.length === 1) add(t, combos[0], "somme");
  }
  if (out.length) await db.from("chorus_paiements").upsert(out, { onConflict: "uid,tx_id,chorus_ids", ignoreDuplicates: true });
  return out.length;
}

export async function paiementDecide(id: string, ok: boolean, staffId: string) {
  const { data: p } = await db.from("chorus_paiements").select("*").eq("id", id).maybeSingle();
  if (!p || p.statut !== "propose") throw new Error("bad");
  await db.from("chorus_paiements").update({ statut: ok ? "valide" : "rejete", par: staffId, le: new Date().toISOString() }).eq("id", id);
  if (ok) {
    const { data: t } = await db.from("bank_tx").select("day").eq("uid", p.uid).eq("tx_id", p.tx_id).maybeSingle();
    await db.from("chorus_factures").update({ paye_le: t?.day || new Date().toISOString().slice(0, 10) }).in("chorus_id", p.chorus_ids);
  }
}

// ---------- 4) ce que voit l'appli ----------
export async function chorusState(owner: boolean) {
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const [{ data: fac }, { data: dep }, { data: pay }, { data: hist }] = await Promise.all([
    db.from("chorus_factures").select("*").or(`date_depot.gte.${since},date_depot.is.null`).not("statut", "in", "(BROUILLON,SUPPRIMEE)").order("numero", { ascending: false }).limit(300),
    db.from("chorus_depots").select("*").neq("statut", "annule").order("created_at", { ascending: false }).limit(40),
    db.from("chorus_paiements").select("*").neq("statut", "rejete").order("created_at", { ascending: false }).limit(200),
    db.from("chorus_hist").select("*").order("at", { ascending: false }).limit(30),
  ]);
  const txKeys = (pay || []).map((p: any) => p.tx_id);
  const { data: tx } = txKeys.length ? await db.from("bank_tx").select("uid,tx_id,day,amount,label,counterparty").in("tx_id", txKeys) : { data: [] };
  const txOf: Record<string, any> = {}; (tx || []).forEach((t: any) => txOf[t.uid + "|" + t.tx_id] = t);
  // Liens de lecture (1 h) vers les PDF des dépôts à valider, pour le propriétaire seulement.
  const urls: Record<string, string> = {};
  if (owner) {
    const paths = (dep || []).filter((d: any) => d.statut === "a_valider" || d.statut === "erreur").flatMap((d: any) => [d.facture_path, ...(d.annexes || []).map((a: any) => a.path)]).filter(Boolean);
    if (paths.length) { const { data } = await db.storage.from("factures").createSignedUrls(paths, 3600); (data || []).forEach((x: any) => { if (x.signedUrl && x.path) urls[x.path] = x.signedUrl; }); }
  }
  const checks: Record<string, string[]> = {};
  for (const d of (dep || []).filter((d: any) => d.statut === "a_valider")) checks[d.id] = await depotCheck(d);
  const last = (fac || []).map((f: any) => f.maj_le).filter(Boolean).sort().pop() || null;
  return {
    factures: fac || [], depots: owner ? (dep || []) : (dep || []).map((d: any) => ({ ...d, facture_path: undefined, annexes: (d.annexes || []).map((a: any) => ({ designation: a.designation })) })),
    paiements: (pay || []).map((p: any) => ({ ...p, tx: txOf[p.uid + "|" + p.tx_id] || null })),
    hist: hist || [], urls, checks, last, structs: Object.fromEntries(Object.entries(STRUCT).map(([k, v]) => [k, v.nom])),
  };
}
