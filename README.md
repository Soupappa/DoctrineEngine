# Doctrine Engine

**Doctrine Engine** est un jeu de stratégie expérimental dont l'originalité n'est pas de jouer les batailles, mais de **trouver les champions** : un moteur de sélection par simulation où deux IA conçoivent, affrontent et font évoluer des unités entièrement personnalisables sous contrainte de budget, génération après génération. Le joueur peut observer le laboratoire tourner en autonomie, ou injecter ses propres créations pour défier les designs de l'IA.

> Prototype web : TypeScript + Vite, rendu Canvas 2D, zéro dépendance à l'exécution.

---

## Sommaire

- [Concept](#concept)
- [Fonctionnalités actuelles](#fonctionnalités-actuelles)
  - [Création d'unités sur tous les axes](#1-création-dunités-sur-tous-les-axes)
  - [Modèle de coût et budget](#2-modèle-de-coût-et-budget)
  - [IA de conception : doctrines et contre-design](#3-ia-de-conception--doctrines-et-contre-design)
  - [Simulation de combat temps réel](#4-simulation-de-combat-temps-réel)
  - [Boucle évolutive (AI Lab)](#5-boucle-évolutive-ai-lab)
  - [Mode tactique : humain contre IA](#6-mode-tactique--humain-contre-ia)
  - [Hall of Fame, favoris et collection](#7-hall-of-fame-favoris-et-collection)
  - [Interface et visualisation](#8-interface-et-visualisation)
- [Roadmap](#roadmap)
- [Lancer le projet](#lancer-le-projet)
- [Architecture du code](#architecture-du-code)

---

## Concept

Le cœur du jeu est une boucle darwinienne :

```
 Concevoir ──► Simuler ──► Évaluer ──► Contrer / Faire évoluer ──► Recommencer
    (IA ou joueur)   (bataille auto)   (victoire, patterns)      (nouvelle doctrine)
```

1. Chaque faction (Rouge / Bleu) conçoit une unité selon sa **doctrine** courante, sous un budget fixe (900 crédits).
2. Le budget détermine la **quantité** : une unité chère part seule, une unité bon marché part en essaim (`quantité = budget / coût`).
3. La bataille est simulée en temps réel jusqu'à destruction d'une base.
4. Le **perdant analyse le design vainqueur** (blindé ? furtif ? essaim ? longue portée ?) et change de doctrine pour le contrer à la génération suivante. Le gagnant conserve son champion.
5. Les meilleurs designs s'accumulent dans un **Hall of Fame** persistant.

Le résultat est un méta-jeu émergent : rush contré par turtle, turtle percé par counter-heavy, essaims nettoyés au flak, furtifs révélés par détecteurs… sans aucun arbre de contres codé en dur côté combat — uniquement la physique du modèle.

---

## Fonctionnalités actuelles

### 1. Création d'unités sur tous les axes

Chaque unité est définie par :

- **7 statistiques de corps** (bornées par `STAT_LIMITS`) : points de vie, dégâts, portée, cadence, vitesse, armure, vision.
- **10 rôles** : scout, raider, tank, artillery, support, builder, miner, air, swarm, siege.
- **8 armes de base** entièrement reconfigurables (dégâts, portée, cadence, perçage d'armure, rayon de zone, tracking) :

  | Arme | Type de dégâts | Spécialité |
  |---|---|---|
  | Canon cinétique | kinetic | standard polyvalent |
  | Perce-blindage | piercing | anti-armure (48 % AP) |
  | Laser traceur | energy | anti-rapide, anti-air |
  | Missiles guidés | explosive | longue portée, tracking |
  | Grenades à fragmentation | explosive | anti-essaim, zone |
  | Faisceau de coupe | energy | anti-lourd, cadence soutenue |
  | Projecteur EMP | emp | brouillage + ralentissement |
  | Flak dispersif | flak | anti-air, anti-essaim |

- **13 traits** avec effets simulés : furtivité (cycle de révélation), détecteur, vol, dégâts de zone, régénération, réparation, constructeur (répare aussi la base), suicide (dégâts ×2.4, mort à l'impact), brouilleur, leurre (attire le feu ennemi), ralentissement, minage (booste l'économie et la production), transport (réservé).

### 2. Modèle de coût et budget

Le prix d'une unité n'est pas une somme linéaire — c'est la pièce maîtresse de l'équilibrage ([costModel.ts](src/core/costModel.ts)) :

- **Coûts non linéaires** : chaque stat suit une courbe en puissance (ex. la vitesse coûte en `v^1.6`, l'armure en `(a+1)^1.8`) — les profils extrêmes deviennent vite hors de prix.
- **Taxe de synergie** : les combinaisons dangereuses sont surtaxées (furtif + gros dégâts, volant + longue portée, zone + cadence élevée, régénération + armure…).
- **Remise de faiblesse** : accepter une vraie faiblesse (lent, myope, fragile, long à produire, suicide) rend l'unité moins chère — avec un plafond de 32 % pour éviter l'abus.
- **Validation** : certains profils sont interdits (suicide + réparateur, furtif lourd à gros dégâts).

Le composeur affiche en direct la décomposition du coût (corps / arme / traits / synergie) et le nombre d'unités que le budget permet d'aligner.

### 3. IA de conception : doctrines et contre-design

L'IA n'invente pas au hasard ([src/ai/](src/ai/)) :

- **13 doctrines** ([doctrines.json](src/data/doctrines.json)) : Rush, Turtle, Swarm, Artillery, Stealth, Anti-stealth, Economy, Air control, Attrition, Harassment, Siege, Counter-heavy, Counter-swarm — chacune avec ses biais de stats et de traits.
- **9 archétypes de design** (Briseur, Forteresse, Aiguille, Escarmouche, Longue-vue, Nuage, Vigie, Brouilleur, Siège) qui modulent la doctrine en profils concrets.
- **Analyse de menace** ([evaluator.ts](src/ai/evaluator.ts)) : le design ennemi est résumé en pattern (`heavy armor`, `swarm fragile`, `stealth`, `range artillery`…) et mémorisé.
- **Contre-design ciblé** : après une défaite, l'IA choisit la doctrine de contre (`stealth → anti-stealth`, `swarm → counter-swarm`, `artillery → rush`…), sélectionne un archétype et une arme adaptés au champion adverse (mur blindé → sniper/perce-blindage, essaim → grenades/flak…).
- **Optimisation budgétaire** : l'unité est calibrée vers son coût cible par recherche dichotomique puis micro-améliorations gloutonnes, pour exploiter chaque crédit du budget d'escouade.
- **Mémoire persistante par faction** : doctrines, patterns ennemis, unités gagnantes/perdantes, palmarès des champions.

### 4. Simulation de combat temps réel

Le moteur ([simulation.ts](src/core/simulation.ts), [combat.ts](src/core/combat.ts)) simule sur le canvas :

- Deux **bases** (900 PV) qui produisent des vagues d'unités ; détruire la base adverse donne la victoire (sinon, arbitrage aux points après 6 minutes, ou bouton « Terminer » pour trancher manuellement).
- **Économie** : revenu passif + bonus pour les mineurs présents dans la zone de ressources centrale (qui accélèrent aussi la production).
- **Combat** : mitigation par armure vs perçage, dégâts de zone, malus des explosifs contre le vol, priorisation des cibles (les leurres attirent le feu, les soigneurs sont prioritaires).
- **Guerre de l'information** : les furtifs ne sont visibles que par les détecteurs, les très bonnes optiques, ou pendant leur fenêtre de révélation cyclique ; l'EMP et les brouilleurs dégradent cadence et vitesse ; le ralentissement gêne les unités au sol.
- **Soutien** : réparation d'alliés, régénération, réparation de base par les constructeurs.
- Vitesse de simulation **x1 / x2 / x5 / x10**.

### 5. Boucle évolutive (AI Lab)

- Boutons **IA ×1 / ×5 / ×10 / ×50** : enchaînement automatique de générations, le vainqueur défend son titre, le perdant revient avec un contre.
- Journal de bataille horodaté par génération et **battle cards** (historique des 18 derniers affrontements avec designs, effectifs, durée et résultat).

### 6. Mode tactique : humain contre IA

Le **composeur d'unités** permet de concevoir manuellement :

- Réglage de chaque stat de corps et de chaque paramètre d'arme (onglets Corps / Arme), choix du rôle, des traits et du budget.
- **Garde-fou budgétaire** : toute modification qui ferait dépasser le budget est annulée.
- Prévisualisation en direct : silhouette SVG de l'unité, schéma de l'arme, **radar de signature** (mix / corps / arme) et décomposition du coût.
- Envoi vers le camp Rouge et/ou Bleu : l'IA **conçoit automatiquement un contre** pour tout camp laissé vide — ou affrontez vos deux propres créations.

### 7. Hall of Fame, favoris et collection

- **Hall of Fame persistant** (localStorage) : top 10 des champions toutes sessions confondues, avec victoires/défaites, némésis et score de **prestige** (battre un champion bien classé rapporte gros).
- **Favoris persistants** : sauvegardez vos meilleurs designs.
- Depuis chaque fiche : **Charger** dans le composeur (pour itérer sur un champion), **Send RED / Send BLUE** (pour le renvoyer au combat).

### 8. Interface et visualisation

- Champ de bataille Canvas avec obstacles, zone de ressources, projectiles, anneaux de portée au survol/clic.
- **Identité visuelle générée** : forme, halo, antennes, anneaux détecteur/brouilleur, copies fantômes du leurre… dérivés du rôle et des traits de l'unité ([unitVisuals.ts](src/render/unitVisuals.ts)).
- HUD complet : génération, chronomètre, état de bataille, forces en présence, journal.

---

## Roadmap

Évolution vers un **jeu de stratégie complet**, où le moteur de sélection devient l'atelier d'armement d'une campagne :

### Court terme — profondeur du laboratoire
- [ ] **Armées mixtes** : composer une force de plusieurs types d'unités sous le même budget (l'IA aussi — combinaisons tank + soigneur, détecteur + sniper…).
- [ ] **Trait transport** (déjà réservé dans le modèle) : embarquer et larguer des unités.
- [ ] **Tournois automatiques** : round-robin / élimination entre champions du Hall of Fame, classement Elo.
- [ ] **Export / import de designs** : partager ses champions (JSON), affronter ceux des autres joueurs.
- [ ] **Évolution plus riche** : véritables mutations/croisements génétiques entre champions plutôt que redesign par doctrine seul.

### Moyen terme — le jeu stratégique
- [ ] **Missions et scénarios** : objectifs asymétriques (défendre N vagues, escorter un convoi, détruire en temps limité, tenir la zone de ressources), avec budgets et contraintes imposés.
- [ ] **Campagne** : enchaînement de missions où vos champions gagnent de l'expérience, la R&D débloque traits et armes, et l'IA adverse retient vos habitudes d'une mission à l'autre.
- [ ] **Cartes variées** : terrains (couvert, eau, hauteurs), brouillard de guerre exploitant vision et furtivité, éditeur de cartes.
- [ ] **Contrôle tactique** : ordres en cours de bataille (regrouper, cibler, retraite, capturer la zone) — aujourd'hui les unités sont autonomes.
- [ ] **Économie approfondie** : extracteurs constructibles, files de production multi-unités, tech tree.

### Long terme
- [ ] **Multijoueur asynchrone** : votre laboratoire affronte celui d'un autre joueur ; ligues de champions.
- [ ] **IA apprenante** : remplacement progressif des heuristiques de contre par un véritable apprentissage (auto-play massif, sélection de population).
- [ ] **Méta-doctrines** : l'IA invente ses propres doctrines au lieu de piocher dans les 13 prédéfinies.

---

## Lancer le projet

Prérequis : [Node.js](https://nodejs.org/).

```bash
npm install
npm run dev        # serveur de développement Vite (http://127.0.0.1:5173)
```

Pour une version de production :

```bash
npm run build      # compile dans dist/
npm run serve      # sert dist/ sur http://127.0.0.1:5174
```

Sous Windows, des raccourcis sont fournis :

- [lancer-jeu.cmd](lancer-jeu.cmd) — sert la version compilée (`dist/`) et ouvre le navigateur.
- [start-doctrine-engine.cmd](start-doctrine-engine.cmd) / [serve-doctrine-engine.cmd](serve-doctrine-engine.cmd) — variantes de lancement.

---

## Architecture du code

```
src/
├── main.ts                 # Bootstrap, UI, composeur, Hall of Fame, boucle de rendu
├── core/                   # Moteur de jeu (sans dépendance UI)
│   ├── types.ts            # Tous les types du domaine
│   ├── constants.ts        # Équilibrage global (limites de stats, PV de base…)
│   ├── costModel.ts        # Calcul de coût : courbes, synergies, remises, validation
│   ├── weapons.ts          # Catalogue + configuration d'armes
│   ├── unitFactory.ts      # Construction d'une UnitDefinition (stats normalisées, coût, visuel)
│   ├── simulation.ts       # Boucle de bataille, générations, production, victoire
│   ├── combat.ts           # Dégâts, détection/furtivité, déplacement
│   ├── economy.ts          # Revenus, zone de ressources, capacité de production
│   └── map.ts              # Carte par défaut (bases, obstacles, zone centrale)
├── ai/                     # Le « cerveau » de sélection
│   ├── aiPlayer.ts         # Cycle de vie IA : ouverture, évolution après match
│   ├── doctrine.ts         # Accès aux doctrines, table des contres, rotation
│   ├── unitDesigner.ts     # Génération de designs : archétypes, armes, calibrage budgétaire
│   ├── evaluator.ts        # Analyse de menace et scoring d'unités
│   └── memory.ts           # Mémoire IA (patterns, palmarès)
├── data/                   # Contenu data-driven (JSON)
│   ├── doctrines.json      # 13 doctrines
│   ├── weapons.json        # 8 armes de base
│   └── baseRules.json / sampleUnits.json
└── render/                 # Rendu et panneaux
    ├── renderer.ts         # Champ de bataille Canvas 2D
    ├── unitVisuals.ts      # SVG d'unités/armes, radar de signature
    ├── hud.ts              # HUD, statut de bataille, composeur
    ├── forces.ts           # Panneau des forces en présence
    └── battleLog.ts        # Battle cards et journal
```

## Publication BAAM.Games

- URL publique : <https://doctrine.games.baam.pro/>
- Manifest : <https://doctrine.games.baam.pro/.well-known/baam.json>
- Dépôt : <https://github.com/Soupappa/DoctrineEngine>
- Build Netlify : `npm run build`, dossier publié `dist/`

En production, une notification Netlify `Deploy succeeded` appelle le build hook
privé de BAAM.Games. Le script `postbuild` reste disponible comme mécanisme de repli
avec `BAAM_DOWNSTREAM_BUILD_HOOK`.
