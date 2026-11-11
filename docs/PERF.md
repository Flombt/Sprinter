# Mesurer le rendu pendant une course

Comparer `cb517f1` et la branche `codex/refonte-ui` sur le même iPhone, la même version d’iOS et le même
réglage de taille du texte. Utiliser la même configuration de développement pour le profiler React et le même
mode de compilation pour les deux captures Instruments. Prendre chaque mesure au moins trois fois.

1. Préparer un parcours GPX de 90 minutes à vitesse réelle avec des points horodatés, un arrêt assez long pour
   déclencher la pause automatique, une reprise et une interruption de suivi. Charger le même scénario de
   localisation dans Xcode. Sur appareil, utiliser une application installée que Xcode peut attacher.
2. Avec Instruments et **Time Profiler**, enregistrer le thread principal, le thread JavaScript et les fonctions de
   dessin de la carte aux minutes 5, 45 et 85. À chaque fenêtre, alterner Courir et Stats, ouvrir Spotify, revenir à
   la carte, agrandir le tracé et recentrer. Relever le temps CPU par thread et les coûts des mises à jour du tracé.
3. Dans une capture distincte, utiliser le profiler React pour relever le nombre et la durée médiane et p95 des
   commits de Courir, Stats, de la barre d’onglets, de la carte et des feuilles. Marquer les changements de course,
   de pause et d’onglet. Le compteur d’allure et de temps doit évoluer pendant le suivi.
4. Observer la mémoire et les saccades avec les instruments correspondants. Noter le temps jusqu’au premier
   affichage de la carte au retour sur Courir, le nombre de recréations de la carte et les changements de mémoire
   entre le début et la fin. Refaire le scénario avec « Réduire les animations » et la plus grande taille du texte.
5. Terminer la course et vérifier que la distance, le temps actif, le tracé avec ses interruptions et la reprise
   figurent dans le bilan et l’historique. Vérifier le repère de la carte depuis un graphique.

| Mesure | Avant | Après |
| --- | --- | --- |
| CPU JavaScript et principal aux minutes 5, 45 et 85 | | |
| Commits React par minute et durées médiane/p95 | | |
| Saccades et images perdues pendant les transitions | | |
| Mémoire au début, au milieu et à la fin | | |
| Affichage de la carte au retour sur Courir et remontages | | |

Les tests locaux vérifient la stabilité des sélections et l’équivalence du tracé incrémental avec le calcul complet.
Les mesures ci-dessus restent à réaliser sur appareil.
