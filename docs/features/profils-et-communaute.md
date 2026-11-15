# Profils personnalisables et communauté

[État des fonctionnalités](etat-fonctionnalites.md) · [Publication et confidentialité](../decisions/004-confidentialite-et-publication.md)

Ces fonctions sont présentes dans le code. Leur activation distante et leur recette sur appareils ne sont pas attestées ici. Le profil personnalisable reste facultatif malgré le compte obligatoire.

## Profil privé et studio

[profile.ts](../../src/profile/profile.ts) raccorde les déclencheurs ; [localStore.ts](../../src/profile/localStore.ts) sépare version enregistrée, brouillons, outbox et médias par titulaire. La base s’ouvre au premier usage ; sa sync est distincte de celle des courses et suspendue pendant toute course.

[model.ts](../../src/profile/model.ts), [catalog.ts](../../src/profile/catalog.ts) et [ProfileEditor.tsx](../../src/profile/ui/ProfileEditor.tsx) portent les éléments et l’édition. Le studio ajoute configurations, décorations, badges officiels, statuts et widgets. Les badges officiels sont calculés côté serveur, sans être attribués par une décoration locale.

[media.ts](../../src/profile/media.ts) réencode les images ; [remote.ts](../../src/profile/remote.ts) gère le transfert. Le serveur réserve puis vérifie octets, dimensions, animation et métadonnées GPS avant de rendre un média utilisable. Un fichier dans Storage n’est pas encore un média validé.

Migrations : [0015 profils](../../supabase/migrations/0015_profiles.sql), [0016 studio](../../supabase/migrations/0016_profile_studio.sql). Flags : `profiles_enabled`, puis `profile_studio_enabled`, dépendants des options de compte.

## Partage et découverte

[sharing.ts](../../src/profile/sharing.ts), [sharingModel.ts](../../src/profile/sharingModel.ts), [ShareSettings.tsx](../../src/profile/ui/ShareSettings.tsx) et [ProfileVisit.tsx](../../src/profile/ui/ProfileVisit.tsx) séparent version privée et publication confirmée. Modes privé, lien ou membres ; recherche et présence sont des choix supplémentaires.

Un lien `sprinter://profil?t=…` s’ouvre après connexion et activation du partage. Les retraits hors ligne restent en attente jusqu’à confirmation serveur. Les lectures visiteur et médias revérifient partage, blocage, modération et état du compte. Une ancienne sync ne doit pas annuler une révocation.

[0017 partage](../../supabase/migrations/0017_profile_sharing.sql) et [0020 média signalé](../../supabase/migrations/0020_moderation_media.sql) portent les contrôles. `profile_sharing_enabled` coupe les lectures externes ; le titulaire garde sa version privée.

## Thèmes, cartes et classement

[themes.ts](../../src/profile/themes.ts), [themeModel.ts](../../src/profile/themeModel.ts) et [ThemeLibrary.tsx](../../src/profile/ui/ThemeLibrary.tsx) partagent seulement du style validé, sans contenu personnel. [0018](../../supabase/migrations/0018_theme_library.sql) définit le contrat serveur. Appliquer un thème crée une copie dans le brouillon. [ProfileCard.tsx](../../src/profile/ui/ProfileCard.tsx) génère une image locale après aperçu. Flags : `theme_library_enabled`, `profile_cards_enabled`, dépendants du profil.

[CommunityScreen.tsx](../../src/community/CommunityScreen.tsx) et [0014_community.sql](../../supabase/migrations/0014_community.sql) implémentent adhésion volontaire, pseudo, semaine courante/précédente, métriques et signalement. Le classement utilise les courses éligibles, sans publier les tracés. `leaderboard_enabled` conditionne son entrée ; ce pseudo ne crée pas de profil publié.

Tests : [profile-sync](../../tests/profile-sync.test.ts), [studio](../../tests/profile-studio.test.ts), [sharing](../../tests/profile-sharing.test.ts), [themes](../../tests/profile-themes.test.ts), [pgTAP](../../supabase/tests/database/). Recettes : [8a](../quality/recettes/profil-8a.md), [8b](../quality/recettes/profil-8b.md), [8c](../quality/recettes/profil-8c.md), [8d](../quality/recettes/profil-8d.md), [communauté](../quality/recettes/communaute.md).
