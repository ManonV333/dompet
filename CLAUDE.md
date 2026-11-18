# Dompet — consignes pour Claude

Dompet est le suivi de dépenses de voyage (Bali) de l'utilisatrice. Deux dépôts GitHub :

- **`dompet`** (public, GitHub Pages) : ce code. Site statique, aucune étape de build.
- **`dompet-data`** (privé) : un seul fichier `data.json` = toutes les données. Le site le lit/écrit via l'API GitHub avec une clé stockée sur son téléphone ; Claude l'écrit via git.

## Alimenter les dépenses depuis la conversation

Quand elle raconte ce qu'elle a acheté (« nasi goreng 35k, gojek 20k, massage 150k + 20k de tips ») :

1. `git -C ../dompet-data pull` (toujours avant d'écrire : le site a pu écrire entre-temps).
2. `node scripts/dompet.mjs add '<JSON>'` avec un tableau d'objets :
   `{"label":"Nasi goreng","amount":"35k","cat":"food","pay":"cash","tip":"5k","date":"2026-11-18","currency":"IDR","note":""}`
   - `amount` accepte `35k`, `1,2jt`, `45.000`, ou un nombre. Devise par défaut IDR ; `"currency":"EUR"` sinon.
   - `cat` : `food` (repas, cafés, GoFood) · `groceries` (supermarché, eau) · `transport` (Grab, Gojek, scooter, essence, bateau) · `tips` · `leisure` = « Bien-être & sorties » (massage, sport, yoga, surf, bar) · `shopping` · `other` (laundry, SIM, santé, visa, frais) · `pro` (Google Ads ponctuel, outils) · `logement` (extras hors logements réservés).
   - Le « budget du jour » ne couvre que food, groceries, transport, tips. leisure, shopping, other se suivent **à la semaine**.
   - Grosse dépense rare (scooter au mois, gros achat) : `"spread":"week"` ou `"spread":"month"` pour l'étaler sur 7 ou 30 jours. Payé d'avance hors budget du mois (vol, assurance) : `"offBudget":true` (compte seulement dans la cagnotte).
   - `pay` : `cash` (« billets ») ou `card`. Si elle ne précise pas : `cash` pour warungs et petits montants, `card` sinon.
   - `date` : par défaut aujourd'hui à Bali (Asia/Makassar). « Hier » → date d'hier.
   - Pourboire inclus dans une dépense → champ `tip` ; pourboire seul → `cat: "tips"`.
3. `node scripts/dompet.mjs status` → lui répondre avec : reste aujourd'hui, budget de demain, ≈ par repas, enveloppes de la semaine si concernées, alertes. Court et simple : elle ne veut pas réfléchir.
4. `git -C ../dompet-data add data.json && git -C ../dompet-data commit -m "Dépenses du <date> (via Claude)" && git -C ../dompet-data push`.

Autres commandes : `upsert stays '{"name","place","checkin","checkout","total","currency","paid"}'` (checkout = jour du départ, non compté) · `upsert recurring '{"label","amount","currency","freq":"monthly","day"}'` (abonnements, Google Ads : comptés automatiquement chaque mois, ne pas les ressaisir comme dépenses) · `withdraw <montant> <frais>` (retrait DAB, pas une dépense) · `settings '{...}'` · `list 3` · `delete expenses <id>` · `rate`.

## Règles

- Ne jamais ressaisir un logement réservé ou un abonnement comme dépense (double comptage).
- Les montants ambigus (« 50 » à Bali = 50 000 Rp) : confirmer si doute.
- Le moteur de calcul est `js/engine.js`, partagé par le site et le script : toute règle de budget se change là.
