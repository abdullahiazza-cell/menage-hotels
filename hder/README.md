# Hder !

Appli familiale (PWA) pour apprendre la darija marocaine en parlant : scènes de la vie courante, kit de survie, note de prononciation au micro, défis et tirelire en dirhams.

- `index.html`, `app.js`, `data.js`, `sw.js` : l'appli, servie par GitHub Pages à l'adresse `/hder/`.
- `audio/` : les voix (Sawalni ASAT) déjà converties ; les voix plus récentes sont servies par le stockage public `hder-audio` de Supabase.
- L'API est la fonction Supabase `hder-api` (tables `hder_*`), séparée de Ma Réception.
- `_gen/items.json` : liste des voix à générer (utilisée par la fonction `hder-voix`).
