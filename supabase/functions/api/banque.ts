// Soldes bancaires via Enable Banking (lecture seule, comptes reliés par le propriétaire).
// La clé privée n'est jamais dans ce dépôt : secret Supabase EB_PRIVATE_KEY (Edge Functions > Secrets).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

export const EB_APP_ID = "742746b5-c077-4629-b5d4-c170521417ba";
const EB = "https://api.enablebanking.com";
export const EB_REDIRECT = `${SB_URL}/functions/v1/eb-callback`;
// Banques reliées : nom exact chez Enable Banking + type d'espace.
export const BANKS: Record<string, { aspsp: string; psu: string; label: string }> = {
  bnp: { aspsp: "BNP Paribas", psu: "personal", label: "BNP" },
  sg: { aspsp: "Société Générale Professionnels", psu: "business", label: "Société Générale" },
};
// Retour autorisé après la banque : l'appli publiée uniquement.
const RETURN_OK = /^https:\/\/abdullahiazza-cell\.github\.io\/[^\s#?]*$/;

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const u8 = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  let s = ""; u8.forEach((c) => s += String.fromCharCode(c));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
let keyP: Promise<CryptoKey> | null = null;
function privKey() {
  if (keyP) return keyP;
  const raw = Deno.env.get("EB_PRIVATE_KEY") || "";
  if (!raw) throw new Error("eb_no_key");
  const body = raw.replace(/\\n/g, "\n").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  keyP = crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return keyP;
}
async function jwt() {
  const iat = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: EB_APP_ID }));
  const pay = b64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await privKey(), new TextEncoder().encode(`${head}.${pay}`));
  return `${head}.${pay}.${b64url(sig)}`;
}
async function eb(path: string, init: RequestInit = {}) {
  const r = await fetch(EB + path, { ...init, headers: { authorization: `Bearer ${await jwt()}`, "content-type": "application/json", ...(init.headers || {}) } });
  const t = await r.text();
  let j: any = null; try { j = JSON.parse(t); } catch { /* */ }
  if (!r.ok) { const e: any = new Error(`eb_${r.status}`); e.detail = (j && (j.message || j.error || j.detail)) || t.slice(0, 200); throw e; }
  return j;
}
async function sha(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const parisDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

// 1) Le propriétaire demande à relier une banque : on renvoie l'adresse de la banque.
export async function bankLinkStart(bank: string, staffId: string, back: string) {
  const B = BANKS[bank]; if (!B) throw new Error("bad");
  let maxSec = 180 * 86400;
  try {
    const a = await eb(`/aspsps?country=FR&psu_type=${B.psu}`);
    const f = (a.aspsps || []).find((x: any) => x.name === B.aspsp);
    if (f && Number(f.maximum_consent_validity) > 0) maxSec = Math.min(maxSec, Number(f.maximum_consent_validity));
  } catch { /* on garde 180 jours */ }
  const state = crypto.randomUUID();
  await db.from("bank_links").insert({ state, bank, created_by: staffId, back_url: RETURN_OK.test(back) ? back : null });
  const valid_until = new Date(Date.now() + maxSec * 1000 - 3600e3).toISOString();
  const r = await eb("/auth", { method: "POST", body: JSON.stringify({ access: { valid_until }, aspsp: { name: B.aspsp, country: "FR" }, state, redirect_url: EB_REDIRECT, psu_type: B.psu }) });
  return { url: r.url };
}

// 2) Retour de la banque : on ouvre la session et on enregistre les comptes (sans IBAN complet).
export async function bankCallback(url: URL) {
  const state = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
  const { data: L } = await db.from("bank_links").select("*").eq("state", state).maybeSingle();
  const back = (L && L.back_url) || null;
  const go = (res: string) => back ? Response.redirect(`${back}#banque=${res}`, 302) : new Response(res === "ok" ? "Comptes relies. Vous pouvez fermer cette page et revenir a Ma Reception." : "La liaison n'a pas abouti. Revenez dans Ma Reception et reessayez.", { status: 200 });
  if (!L || L.used_at || Date.now() - new Date(L.created_at).getTime() > 30 * 60e3) return go("expire");
  await db.from("bank_links").update({ used_at: new Date().toISOString() }).eq("state", state);
  if (!code) return go("refus");
  try {
    const s = await eb("/sessions", { method: "POST", body: JSON.stringify({ code }) });
    const validUntil = s.access?.valid_until || null;
    for (const acc of s.accounts || []) {
      const uid = typeof acc === "string" ? acc : acc.uid; if (!uid) continue;
      const iban = (acc.account_id && (acc.account_id.iban || acc.account_id.other?.identification)) || acc.iban || "";
      const ih = iban ? await sha(String(iban).replace(/\s/g, "")) : null;
      const last4 = iban ? String(iban).replace(/\s/g, "").slice(-4) : String(uid).slice(-4);
      let label: string | null = null, sort = 0;
      if (ih) {
        // Même compte relié à nouveau : on garde son nom et on remplace l'ancien accès.
        const { data: old } = await db.from("bank_accounts").select("uid,label,sort").eq("iban_hash", ih).neq("uid", uid);
        if (old && old.length) { label = old[0].label; sort = old[0].sort || 0; await db.from("bank_accounts").update({ active: false }).in("uid", old.map((o: any) => o.uid)); }
      }
      await db.from("bank_accounts").upsert({ uid, bank: L.bank, iban_hash: ih, last4, currency: acc.currency || "EUR", session_id: s.session_id, valid_until: validUntil, active: true, ...(label ? { label } : {}), sort, error: null }, { onConflict: "uid" });
    }
    await bankSync({ only: L.bank }).catch(() => {});
    return go("ok");
  } catch (e) {
    console.error("eb_callback", e, (e as any).detail);
    return go("erreur");
  }
}

const ORDER = ["XPCD", "ITBD", "CLBD", "ITAV", "CLAV", "OTHR"];
// 3) Récupération des soldes (planifiée 3 fois par jour, plus une actualisation manuelle).
export async function bankSync(opt: { only?: string; manual?: boolean } = {}) {
  let q = db.from("bank_accounts").select("*").eq("active", true);
  if (opt.only) q = q.eq("bank", opt.only);
  const { data: accs } = await q;
  const day = parisDay(); let n = 0;
  for (const a of accs || []) {
    if (a.valid_until && new Date(a.valid_until) < new Date()) { await db.from("bank_accounts").update({ error: "expire" }).eq("uid", a.uid); continue; }
    try {
      const r = await eb(`/accounts/${a.uid}/balances`);
      const bs = r.balances || [];
      const pick = ORDER.map((t) => bs.find((b: any) => b.balance_type === t)).find(Boolean) || bs[0];
      if (!pick) throw new Error("eb_empty");
      const amount = Number(pick.balance_amount?.amount);
      const now = new Date().toISOString();
      await db.from("bank_accounts").update({ balance: amount, currency: pick.balance_amount?.currency || a.currency, balance_type: pick.balance_type, ref_date: pick.reference_date || null, fetched_at: now, error: null }).eq("uid", a.uid);
      await db.from("bank_hist").upsert({ uid: a.uid, day, balance: amount, at: now }, { onConflict: "uid,day" });
      n++;
    } catch (e) {
      const msg = String((e as any).message || e);
      await db.from("bank_accounts").update({ error: msg === "eb_401" || msg === "eb_403" ? "expire" : msg.slice(0, 60) }).eq("uid", a.uid);
    }
  }
  return n;
}

// 4) Ce que voit l'appli : nom, banque, 4 derniers chiffres, solde, écart avec la veille.
export async function bankState(owner: boolean) {
  const { data: accs } = await db.from("bank_accounts").select("uid,bank,last4,label,currency,balance,balance_type,ref_date,fetched_at,valid_until,error,sort").eq("active", true).order("sort").order("bank").order("last4");
  const uids = (accs || []).map((a: any) => a.uid);
  const { data: hist } = uids.length ? await db.from("bank_hist").select("uid,day,balance").in("uid", uids).lt("day", parisDay()).order("day", { ascending: false }).limit(200) : { data: [] };
  const prev: Record<string, number> = {};
  (hist || []).forEach((h: any) => { if (!(h.uid in prev)) prev[h.uid] = Number(h.balance); });
  return {
    accounts: (accs || []).map((a: any) => ({ ...a, bank_l: BANKS[a.bank]?.label || a.bank, prev: a.uid in prev ? prev[a.uid] : null, ...(owner ? {} : { valid_until: undefined }) })),
    banks: owner ? Object.entries(BANKS).map(([k, b]) => ({ k, l: b.label })) : [],
  };
}

export async function bankLabel(uid: string, label: string) {
  await db.from("bank_accounts").update({ label: String(label || "").trim().slice(0, 40) || null }).eq("uid", uid);
}

// Actualisation à la main : une fois par jour au plus (les banques limitent à 4 lectures par jour).
export async function bankManual() {
  const { data: m } = await db.from("bank_accounts").select("manual_on").eq("active", true).limit(1).maybeSingle();
  if (m && m.manual_on === parisDay()) throw new Error("bank_manual_used");
  const n = await bankSync({ manual: true });
  await db.from("bank_accounts").update({ manual_on: parisDay() }).eq("active", true);
  return n;
}

// Accès qui expire bientôt : liste pour prévenir le propriétaire.
export async function bankExpiring(days = 10) {
  const lim = new Date(Date.now() + days * 864e5).toISOString();
  const { data } = await db.from("bank_accounts").select("bank,last4,valid_until").eq("active", true).lt("valid_until", lim);
  return data || [];
}
