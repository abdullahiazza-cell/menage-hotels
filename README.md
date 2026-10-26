# Ma Réception

Application web installable (PWA) de réception et de suivi du ménage pour l'Hôtel Archange, l'Hôtel de Paris et Châteaudun (Orléans).

- `index.html`, `app.js`, `sw.js` : l'application (servie par GitHub Pages).
- `supabase/functions/api` : l'API (Supabase Edge Function). Les données, photos et vocaux sont stockés chez Supabase, jamais dans ce dépôt.

Aucune donnée ni aucun secret ne se trouve dans ce dépôt.

## Déploiement de l'API

La fonction Supabase `api` est déployée comme une seule ligne qui importe `supabase/functions/api/index.ts` depuis GitHub, à un commit figé :

```ts
import "https://raw.githubusercontent.com/abdullahiazza-cell/menage-hotels/<commit>/supabase/functions/api/index.ts";
```

Pour publier une nouvelle version : pousser sur `main`, puis redéployer la fonction `api` avec le nouveau numéro de commit.
