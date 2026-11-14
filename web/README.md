# Pages web publiques

`supprimer-mon-compte/` : page statique exigée par Google Play et Apple (§6.6), à publier sur `https://<domaine>/supprimer-mon-compte`.

Avant publication (Flo) :
1. Remplacer `<projet>` (deux occurrences : CSP et `data-supabase-url`), `<cle-publique>` (clé **publique** du projet de production), `support@<domaine>` et `<ÉDITEUR>`.
2. Déclarer l'origine du site dans le secret `PUBLIC_WEB_ORIGINS` des Edge Functions (CORS de `delete-account`).
3. Héberger en statique (Vercel, Cloudflare Pages…) **hors** de Cloudflare Access, avec HTTPS.

La page n'utilise aucune bibliothèque tierce et ne révèle pas si une adresse possède un compte.
