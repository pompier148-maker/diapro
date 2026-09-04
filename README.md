# Fiche 360° Stock — Groupe Gamache

Tout ce qui est relié à un numéro de stock (C-, R-, GX-, AC-, H-, PI-) sur un seul écran : logs et offres de Gamache Cloud,
bons de travail, coûts, achats et ventes Prextra (via le DWH), photo, conclusion automatique et analyse narrative.

Outil interne, réservé au personnel du Groupe Gamache. **Lecture seule** : rien ici n'écrit dans Cloud ni dans Prextra.

## Architecture

```
navigateur ──(login Microsoft 365)──▶ Next.js sur Vercel
                                       ├─ /            page HTML autonome (lib/fiche360.html), servie derrière le login
                                       ├─ /api/cloud   Gamache Cloud — MongoDB Atlas, usager lecture seule   (lib/cloud.ts)
                                       ├─ /api/dwh     Gamache DWH — API Metabase, usager metabase_ro          (lib/dwh.ts)
                                       ├─ /api/nego    repères de négociation 12 mois, cache 10 min             (lib/dwh.ts)
                                       ├─ /api/photo   photo du site web, sinon Gamache Cloud (proxy serveur)   (lib/photo.ts)
                                       ├─ /api/analyse analyse narrative — API Anthropic, clé côté serveur      (lib/anthropic.ts)
                                       └─ /api/health  état des sources pour les voyants
```

- Aucun identifiant ni requête SQL dans le navigateur : la page n'envoie qu'un numéro de stock.
- Chaque appel est journalisé (`{user, action, detail}` dans les logs Vercel).
- Le login est isolé dans `auth.ts` et `proxy.ts` (Auth.js v5, fournisseur Microsoft Entra ID). Accès limité aux domaines
  `ALLOWED_EMAIL_DOMAINS`, ou à la liste `ALLOWED_EMAILS` si elle est définie.
- La page `lib/fiche360.html` est le même code que le prototype validé dans Claude : on y reporte les changements d'affichage tels quels.

## Mise en place

1. **Entra ID** : enregistrer une application (Azure portal → App registrations), URI de redirection
   `https://<domaine>/api/auth/callback/microsoft-entra-id`, créer un secret. Reporter l'ID, le secret et le tenant dans les variables.
2. **Atlas** : créer un usager `fiche360_ro` avec le rôle `read` sur la base Gamache Cloud ; autoriser l'accès réseau
   depuis Vercel (Atlas → Network Access). Reporter l'URI dans `MONGODB_URI`.
3. **Metabase** : créer une clé API (Admin → Authentification → Clés API) attachée à un groupe qui ne voit que le DWH.
4. **Anthropic** : clé API dans `ANTHROPIC_API_KEY` (facultatif : sans clé, le bouton d'analyse disparaît).
5. Copier `.env.example` en `.env.local`, remplir, puis `npm install` et `npm run dev`.
6. **Vercel** : créer le projet, coller les mêmes variables, ajouter le domaine. Le déploiement automatique sur `main`
   passe par `.github/workflows/deploy.yml` (secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, comme diapro).

## Développement

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # vérification TypeScript
npm run build      # build de production
```
