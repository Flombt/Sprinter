# Comptes et accès à l’application

[État des fonctionnalités](etat-fonctionnalites.md) · [Configuration](../backend/exploitation.md) · [Décision durable](../decisions/002-compte-obligatoire-et-cloud-facultatif.md)

## Parcours actuel

[App.tsx](../../App.tsx) exige `isSignedIn` avant la navigation. [AccountGate.tsx](../../src/account/ui/AccountGate.tsx) propose connexion/création et permet d’enregistrer une course interrompue. Sans configuration Supabase, il affiche la connexion indisponible. [useRunStart.ts](../../src/navigation/useRunStart.ts) et [session.ts](../../src/services/session.ts) protègent aussi le démarrage.

[SignIn.tsx](../../src/account/ui/SignIn.tsx) distingue création et connexion. La création demande les acceptations prévues et l’âge minimum affiché. Le code e-mail est utilisable dans Expo Go ; Apple/Google passent par [providers.ts](../../src/account/providers.ts) et dépendent de [env.ts](../../src/account/env.ts) et du client natif. La connexion réussie ouvre Courir ; les champs de profil de compte ne sont pas une étape obligatoire intermédiaire.

## Session et options cloud

[accountStore.ts](../../src/account/accountStore.ts) gère restauration, OTP, méthodes, réauthentification, consentements, appareils, activité minimale et suppression. Une session stockée permet la restauration hors ligne ; la création et vérification initiales nécessitent le service. Cela ne crée pas un mode invité.

[secureSession.ts](../../src/account/secureSession.ts) conserve la session Supabase chiffrée en AES-CTR dans le stockage clé/valeur, avec une clé aléatoire dans SecureStore. Cela ne chiffre pas les bases sportives. [supabaseClient.ts](../../src/account/supabaseClient.ts) utilise la clé publique.

`accounts_enabled` contrôle les options cloud et leurs dépendances ; il ne supprime pas la connexion. Les flags et leur cache sont décrits dans [exploitation](../backend/exploitation.md). Sauvegardes des courses et des tracés exigent des choix distincts, sans présélection.

## Déconnexion, données et suppression

[AccountSheet.tsx](../../src/account/ui/AccountSheet.tsx) propose déconnexion et effacement local facultatif des courses. Les courses conservées restent sur l’appareil, mais l’interface repasse sur la connexion : elles ne sont pas consultables en invité.

[MyData.tsx](../../src/account/ui/MyData.tsx), [DeleteAccount.tsx](../../src/account/ui/DeleteAccount.tsx) et [Reauthenticate.tsx](../../src/account/ui/Reauthenticate.tsx) portent les opérations sensibles. Le serveur traite export et suppression avec reprise des demandes interrompues. La [page publique de suppression](../../web/README.md) est un artefact à configurer et héberger ; sa présence ne prouve pas une publication.

Compte de connexion, champs facultatifs du profil de compte et [profil personnalisable](profils-et-communaute.md) sont distincts. La suppression retire les données propres au compte et ses publications ; conserver localement des courses ne donne pas accès sans authentification.

Tests : [account-startup](../../tests/account-startup.test.ts), [account-config](../../tests/account-config.test.ts), [account-auth](../../tests/account-auth.test.ts). Voir [résultats](../quality/validation.md), [recette comptes](../quality/recettes/comptes.md) et [RGPD](../rgpd/README.md). Auth, SMTP, textes publiés et fournisseurs réels restent à vérifier dans leur environnement.
