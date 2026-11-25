# Ma Réception

Application web installable (PWA) de réception et de suivi du ménage pour l'Hôtel Archange, l'Hôtel de Paris et Châteaudun (Orléans).

- `index.html`, `app.js`, `sw.js` : l'application (servie par GitHub Pages).
- `plus.js` et `supabase/functions/api/plus.ts` (v80) : mode hors ligne, objets trouvés, état des lieux au départ, stock de linge, carnets des chambres, tutos avec voix, texte des vocaux. Chaque nouveauté a un interrupteur dans Réglages → Nouveautés : éteinte, seul le propriétaire la voit.
- `vue3d.js` (v81) : vue 3D des trois hôtels pour les gérants, tracée d'après les plans, avec les ménages en cours, l'état des chambres et les problèmes signalés. Tout vient de l'état déjà chargé par l'appli ; rien à déployer côté API. Même interrupteur dans Réglages → Nouveautés.
- `supabase/functions/api` : l'API (Supabase Edge Function). Les données, photos et vocaux sont stockés chez Supabase, jamais dans ce dépôt.

Aucune donnée ni aucun secret ne se trouve dans ce dépôt.

## Déploiement de l'API

La fonction Supabase `api` est déployée comme une seule ligne qui importe `supabase/functions/api/index.ts` depuis GitHub, à un commit figé :

```ts
import "https://raw.githubusercontent.com/abdullahiazza-cell/menage-hotels/<commit>/supabase/functions/api/index.ts";
```

Pour publier une nouvelle version : pousser sur `main`, puis redéployer la fonction `api` avec le nouveau numéro de commit.
