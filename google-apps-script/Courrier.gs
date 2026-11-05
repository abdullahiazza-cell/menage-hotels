// Ma Réception — Courrier. Fichier « Courrier » du projet Apps Script « Ma Réception - PDF des PEC »
// (compte hoteldeparisadm). Utilise appel() et lireTexte() du fichier « Code ».
// 1) releverCourrier (vers 9 h et 16 h, heure de France) : dépose dans Ma Réception les mails reçus qui attendent
//    une réponse (texte sans l'historique, PDF, Word converti en PDF, photos). Les PEC du Département sont aussi
//    rangées dans le Drive (dossier « PDF des prises en charge »).
// 2) envoyerReponses (toutes les 5 minutes) : envoie, dans le fil d'origine, les réponses que le propriétaire a
//    approuvées dans l'appli, avec leurs pièces jointes. Rien d'autre n'est jamais envoyé.
const MOI = 'hoteldeparisadm@gmail.com';
const DOSSIER_PEC = '1kXH3hvKxX1wr0QWbpkA9oJ-cjH5SzNtj';
const EXCLUS = /no-?reply|ne-?pas-?repondre|nepasrepondre|mailer-daemon|newsletter|info-abonne|communication@|marketing|notification/i;

function nomDe(de) { return String(de || '').replace(/<.*>/, '').replace(/"/g, '').trim(); }

// Texte du message, sans l'historique cité en dessous.
function texteSansCitation(m) {
  let t = m.getPlainBody() || '';
  const i = t.search(/\n\s*(Le .{4,120} a écrit\s*:|On .{4,120} wrote\s*:|De ?: .+\n.*(Envoy|Date)|-{3,}\s*(Original Message|Message d.origine)|_{10,})/);
  if (i > 0) t = t.slice(0, i);
  return t.replace(/\n{3,}/g, '\n\n').trim().slice(0, 30000);
}

// Un Word (ou ODT, RTF) converti en PDF par Google Drive ; le fichier temporaire part à la corbeille.
function versPdf(a) {
  let id = null;
  try {
    const f = Drive.Files.create({ name: 'ma-reception-conversion', mimeType: 'application/vnd.google-apps.document' }, a.copyBlob());
    id = f.id;
    return DriveApp.getFileById(id).getAs('application/pdf').setName(a.getName().replace(/\.(docx?|odt|rtf)$/i, '') + '.pdf');
  } catch (e) { console.warn('conversion : ' + e); return null; }
  finally { if (id) try { Drive.Files.update({ trashed: true }, id); } catch (e) {} }
}

function releverCourrier() {
  const props = PropertiesService.getScriptProperties();
  const depuis = Number(props.getProperty('courrier_depuis') || 0), installe = Number(props.getProperty('courrier_installe') || 0);
  const fils = GmailApp.search('in:inbox newer_than:4d -category:promotions -category:social -category:forums', 0, 40);
  const debut = Date.now(); let n = 0;
  for (const fil of fils) {
    if (Date.now() - debut > 4.5 * 60 * 1000) break; // la suite à la prochaine lecture
    const msgs = fil.getMessages(), m = msgs[msgs.length - 1];
    if (m.getDate().getTime() < depuis || props.getProperty('cr_' + m.getId())) continue;
    const de = m.getFrom();
    if (de.toLowerCase().indexOf(MOI) >= 0) continue; // le dernier message est le nôtre : déjà répondu
    if (EXCLUS.test(de)) { props.setProperty('cr_' + m.getId(), 'x'); continue; }
    const fichiers = [], autres = [];
    m.getAttachments({ includeInlineImages: false }).forEach((a) => {
      const type = a.getContentType() || '', nom = a.getName() || 'piece', taille = a.getSize();
      let blob = null;
      if (taille <= 9e6) {
        if (/pdf/i.test(type) || /\.pdf$/i.test(nom)) blob = a.copyBlob();
        else if (/\.(docx?|odt|rtf)$/i.test(nom)) blob = versPdf(a);
        else if (/^image\/(jpeg|png)$/i.test(type) && taille < 4e6) blob = a.copyBlob();
      }
      if (!blob) { autres.push({ name: nom, type: type, size: taille }); return; }
      const pdf = /pdf/i.test(blob.getContentType()) || /\.pdf$/i.test(blob.getName());
      const f = { name: blob.getName() || nom, type: pdf ? 'application/pdf' : blob.getContentType(), b64: Utilities.base64Encode(blob.getBytes()) };
      if (pdf) f.text = lireTexte(blob.copyBlob());
      // Une PEC reçue après la mise en service est aussi rangée dans le Drive (Claude la renomme ensuite).
      if (pdf && m.getDate().getTime() >= installe && /prise en charge/i.test(f.text || '')) {
        try { f.drive_id = DriveApp.getFolderById(DOSSIER_PEC).createFile(blob.copyBlob()).setName(Utilities.formatDate(m.getDate(), 'Europe/Paris', 'yyyy-MM-dd') + ' ' + f.name).getId(); }
        catch (e) { console.warn('Drive : ' + e); }
      }
      fichiers.push(f);
    });
    const r = appel({ a: 'courrier_in', msg: m.getId(), thread: fil.getId(), from: de, from_name: nomDe(de), to: m.getTo(), cc: m.getCc(),
      subject: m.getSubject(), date: m.getDate().toISOString(), text: texteSansCitation(m), files: fichiers, others: autres });
    if (r.code === 200) { props.setProperty('cr_' + m.getId(), '1'); n++; }
    else console.warn(m.getSubject() + ' : ' + r.brut);
  }
  console.log(n + ' mail(s) déposé(s) dans Ma Réception');
}

function envoyerReponses() {
  const r = appel({ a: 'courrier_queue' });
  if (r.code !== 200) { console.warn(r.brut); return; }
  (r.json.items || []).forEach((it) => {
    try {
      const m = GmailApp.getMessageById(it.id);
      const pj = [];
      (it.docs || []).forEach((d) => {
        const x = appel({ a: 'courrier_doc', id: d.id });
        if (x.code !== 200 || !x.json.b64) throw new Error('pièce introuvable dans l’appli : ' + d.name);
        pj.push(Utilities.newBlob(Utilities.base64Decode(x.json.b64), x.json.type || 'application/pdf', d.name || x.json.name));
      });
      (it.drive || []).forEach((d) => {
        const f = DriveApp.getFileById(d.id);
        const b = /^application\/vnd\.google-apps\./.test(f.getMimeType()) ? f.getAs('application/pdf') : f.getBlob();
        pj.push(b.setName(d.name || f.getName()));
      });
      const opts = { attachments: pj };
      const cc = [it.cc, it.to].filter(Boolean).join(', ');
      if (cc) opts.cc = cc;
      m.reply(it.body, opts);
      appel({ a: 'courrier_sent', id: it.id, ok: true });
      console.log('Réponse envoyée : ' + m.getSubject());
    } catch (e) {
      appel({ a: 'courrier_sent', id: it.id, ok: false, err: String(e).slice(0, 400) });
      console.warn('Envoi impossible : ' + e);
    }
  });
}

// À lancer une seule fois : lecture vers 9 h et 16 h (heure de France), envoi des réponses approuvées toutes les 5 minutes.
function installerCourrier() {
  ScriptApp.getProjectTriggers().forEach((t) => { if (['releverCourrier', 'envoyerReponses'].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('releverCourrier').timeBased().atHour(9).nearMinute(15).everyDays(1).inTimezone('Europe/Paris').create();
  ScriptApp.newTrigger('releverCourrier').timeBased().atHour(16).nearMinute(15).everyDays(1).inTimezone('Europe/Paris').create();
  ScriptApp.newTrigger('envoyerReponses').timeBased().everyMinutes(5).create();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('courrier_installe')) props.setProperty('courrier_installe', String(Date.now()));
  if (!props.getProperty('courrier_depuis')) props.setProperty('courrier_depuis', String(Date.now() - 3 * 864e5));
  releverCourrier();
}
