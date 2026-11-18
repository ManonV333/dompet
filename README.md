# Dompet

Budget de voyage jour par jour, en roupies et en euros. *Dompet* = « portefeuille » en indonésien.

- **Aujourd'hui** : combien il te reste à dépenser aujourd'hui (repas, courses, transport, pourboires), le budget de demain qui se rattrape tout seul, le prix ≈ par repas, les enveloppes de la semaine (bien-être, shopping, divers), la cagnotte du voyage et combien de temps elle tient. Saisie en une phrase : « nasi goreng 35k cash ».
- **Analyse** : où part l'argent, dépenses par jour vs budget du jour, cumul du mois vs trajectoire idéale, enveloppes, calendrier, jours de la semaine, cash/carte, plus grosses dépenses, bilan du voyage.
- **Journal** : toutes les dépenses, recherche et filtres.
- **Séjour** : logements réservés (prix par nuit déduit du budget, nuits sans logement repérées) et abonnements / charges fixes (Google Ads…).

## Comment le budget est calculé

`budget du mois − logements du mois − abonnements du mois = budget du quotidien`.
Chaque jour : `budget du jour = (part « jour » du quotidien − déjà dépensé avant aujourd'hui) ÷ jours restants`. Bien-être, shopping et divers ont une enveloppe à la semaine.
Dépenser moins aujourd'hui fait monter demain ; dépenser plus le fait baisser. Si le voyage (ou le suivi) commence en cours de mois, le budget est proratisé.

## Installer sur le téléphone

Ouvre le site dans Safari (iPhone) ou Chrome (Android) → Partager → **Sur l'écran d'accueil**. Dompet s'ouvre en plein écran et marche sans réseau.

## Données

Fichier `data.json` dans un dépôt GitHub **privé** (`dompet-data`). Réglages → Synchronisation GitHub : nom d'utilisateur, dépôt, clé « fine-grained » limitée à ce dépôt avec *Contents : Read and write*. La clé ne quitte pas le téléphone.

Développement local : `python -m http.server` puis http://localhost:8000.
