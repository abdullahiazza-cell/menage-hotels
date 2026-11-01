// Retour de la banque après l'accord (Enable Banking) : ouvre la session et renvoie vers l'appli.
import { bankCallback } from "../api/banque.ts";
Deno.serve((req) => bankCallback(new URL(req.url)));
