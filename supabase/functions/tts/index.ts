// Point audio. Darija : voix ASAT (Sawalni / Omneity Labs). Français : voix françaises de Google (Text-to-Speech, Chirp 3 HD),
// gratuites jusqu'à 1 million de caractères par mois ; plafond de sécurité ci-dessous pour ne jamais dépasser la part gratuite.
// Découpe le texte par paragraphes, assemble un seul WAV (24 kHz, 16 bits, mono) pour les deux langues.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const KEY = Deno.env.get("SAWALNI_API_KEY") || "";
const GKEY = Deno.env.get("GOOGLE_TTS_KEY") || "";
const FR_F = Deno.env.get("GOOGLE_TTS_VOICE_F") || "fr-FR-Chirp3-HD-Aoede";
const FR_M = Deno.env.get("GOOGLE_TTS_VOICE_M") || "fr-FR-Chirp3-HD-Charon";
const FR_CAP = 500000; // caractères français par mois (la part gratuite de Google est de 1 000 000)
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function speak(text: string, voice: string): Promise<Uint8Array> {
  for (let t = 0; t < 6; t++) {
    const r = await fetch("https://api.sawalni.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "asat", voice, response_format: "pcm16", input: text }),
    });
    if (r.status === 429 || r.status === 503) { await sleep(3000 + t * 2000); continue; }
    if (!r.ok) throw new Error(`asat ${r.status} ${(await r.text()).slice(0, 200)}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  throw new Error("asat occupé");
}

// Google renvoie un WAV : on garde seulement les échantillons (même format que Sawalni : PCM 16 bits, 24 kHz, mono).
function pcmFromWav(u: Uint8Array): Uint8Array {
  const tag = (o: number) => String.fromCharCode(u[o], u[o + 1], u[o + 2], u[o + 3]);
  if (u.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("google : réponse audio illisible");
  const v = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let o = 12;
  while (o + 8 <= u.length) {
    const id = tag(o), sz = v.getUint32(o + 4, true);
    if (id === "fmt ") {
      const ch = v.getUint16(o + 10, true), rate = v.getUint32(o + 12, true), bits = v.getUint16(o + 22, true);
      if (ch !== 1 || rate !== 24000 || bits !== 16) throw new Error(`google : format inattendu ${ch} canal ${rate} Hz ${bits} bits`);
    }
    if (id === "data") return u.subarray(o + 8, Math.min(u.length, o + 8 + sz));
    o += 8 + sz + (sz & 1);
  }
  throw new Error("google : pas de données audio");
}
async function frUsed(): Promise<number> {
  const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0);
  const { data } = await sb.from("tts_jobs").select("text").eq("lang", "fr").in("status", ["sent", "done", "merging", "merged"]).gte("updated_at", since.toISOString()).limit(10000);
  return (data || []).reduce((a: number, r: any) => a + String(r.text || "").length, 0);
}
async function speakFr(text: string, voice: string, gvoice?: string): Promise<Uint8Array> {
  if (!GKEY) throw new Error("GOOGLE_TTS_KEY absente");
  if (await frUsed() > FR_CAP) throw new Error("plafond mensuel des voix françaises atteint");
  const name = gvoice && /^fr-FR-[A-Za-z0-9-]+$/.test(gvoice) ? gvoice : (voice.startsWith("male") ? FR_M : FR_F);
  for (let t = 0; t < 4; t++) {
    const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(GKEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: { languageCode: "fr-FR", name }, audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000 } }),
    });
    if (r.status === 429 || r.status >= 500) { await sleep(2000 + t * 2000); continue; }
    if (!r.ok) throw new Error(`google ${r.status} ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    return pcmFromWav(Uint8Array.from(atob(String(j.audioContent || "")), (c) => c.charCodeAt(0)));
  }
  throw new Error("google occupé");
}

function wav(pcm: Uint8Array, rate = 24000) {
  const h = new ArrayBuffer(44), v = new DataView(h);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length); out.set(new Uint8Array(h), 0); out.set(pcm, 44); return out;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { data: s } = await sb.from("app_secrets").select("value").eq("name", "cron_secret").single();
    if (!s || req.headers.get("x-cron") !== s.value) return new Response("forbidden", { status: 403 });
    if (body.check) return Response.json({
      sawalni: KEY ? `présente (${KEY.length} caractères)` : "absente",
      google: GKEY ? `présente (${GKEY.length} caractères)` : "absente",
      voix_fr: { femme: FR_F, homme: FR_M }, fr_ce_mois: await frUsed(), plafond: FR_CAP,
    });
    if (body.balance) {
      if (!KEY) throw new Error("SAWALNI_API_KEY absente");
      const r = await fetch("https://api.sawalni.com/v1/billing/balance", { headers: { Authorization: `Bearer ${KEY}` } });
      return Response.json({ status: r.status, body: await r.text() });
    }
    const voice = String(body.voice || "male-1"), name = String(body.name || "apercu").replace(/[^a-z0-9-]/gi, "");
    // Langue : donnée par l'appel, sinon lue à la fin du nom (« <point>-fr » / « <point>-ar »)
    const lang = body.lang === "fr" || body.lang === "ar" ? body.lang : (/-fr$/.test(name) ? "fr" : "ar");
    const part = (i: number) => `tts/parts/${name}-${voice}-${String(i).padStart(2, "0")}.pcm`;
    // 1) un morceau : génère le paragraphe n° i et le garde de côté
    if (typeof body.i === "number" && !body.merge) {
      if (lang === "ar" && !KEY) throw new Error("SAWALNI_API_KEY absente");
      const pcm = lang === "fr" ? await speakFr(String(body.text), voice, body.gvoice) : await speak(String(body.text), voice);
      const up = await sb.storage.from("media").upload(part(body.i), pcm, { contentType: "application/octet-stream", upsert: true });
      if (up.error) throw new Error("upload " + up.error.message);
      if (body.job) await sb.from("tts_jobs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", body.job);
      return Response.json({ ok: true, i: body.i, lang, seconds: +(pcm.length / 48000).toFixed(1) });
    }
    // 2) assemblage : colle les morceaux dans l'ordre avec un petit silence
    const n = Number(body.count || 0); const pcs: Uint8Array[] = []; const gap = new Uint8Array(24000 * 2 * 0.4);
    for (let i = 0; i < n; i++) {
      const { data, error } = await sb.storage.from("media").download(part(i));
      if (error || !data) throw new Error("morceau manquant " + i);
      pcs.push(new Uint8Array(await data.arrayBuffer())); pcs.push(gap);
    }
    const tot = pcs.reduce((a, c) => a + c.length, 0); const pcm = new Uint8Array(tot); let o = 0; for (const c of pcs) { pcm.set(c, o); o += c.length; }
    const pid = String(body.point_id || "");
    const path = pid ? `tts/points/${pid}-${lang}-${voice}.wav` : `tts/${name}-${voice}.wav`;
    const up = await sb.storage.from("media").upload(path, wav(pcm), { contentType: "audio/wav", upsert: true });
    if (up.error) throw new Error("upload " + up.error.message);
    const seconds = Math.round(pcm.length / 48000);
    if (pid) {
      const { data: pt } = await sb.from("points").select("audio,secs").eq("id", pid).single();
      if (pt) await sb.from("points").update({ audio: { ...(pt.audio || {}), [`${lang}:${voice}`]: path }, secs: { ...(pt.secs || {}), [`${lang}:${voice}`]: seconds } }).eq("id", pid);
      await sb.from("tts_jobs").update({ status: "merged", updated_at: new Date().toISOString() }).eq("point_id", pid).eq("lang", lang).eq("voice", voice).eq("status", "merging");
      return Response.json({ ok: true, path, seconds });
    }
    const { data } = await sb.storage.from("media").createSignedUrl(path, 14 * 86400);
    return Response.json({ voice, seconds, url: data?.signedUrl });
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }); }
});
