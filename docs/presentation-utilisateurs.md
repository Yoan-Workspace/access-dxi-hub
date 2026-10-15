# Status Machines — présentation utilisateurs

**Durée :** une dizaine de minutes  
**Public :** opérateurs, techniciens, administrateurs  
**Objectif :** que chacun sache à quoi sert l’outil, comment ouvrir un ticket, et ce que son profil a le droit de faire.

---

## 1. En une phrase (30 s)

**Status Machines**, c’est le tableau de bord commun des analyseurs **DXI 9000** (Falcon / MP) et **Access 2**.

Tout le monde voit la même chose, en direct : l’état des machines, les problèmes en cours, les tickets, les maintenances, et l’historique.

Plus besoin de chercher l’info dans un mail, un chat ou un cahier. Si c’est important, ça vit dans l’application.

---

## 2. Pourquoi cet outil ? (1 min)

| Avant | Avec Status Machines |
| --- | --- |
| L’info circule à l’oral ou dans Teams, puis elle se perd | Un **ticket** reste collé à la machine, avec une date, un auteur, un suivi |
| Chacun a sa version de « ce qui cloche » | **Une seule vue** pour tout le plateau |
| On ne sait pas si quelqu’un s’en occupe | On voit si c’est **ouvert**, **en cours** (tâches), ou **clôturé** |
| Les collègues hors salle ne sont pas prévenus | Une **notification Teams** part à l’ouverture (et à la clôture) du ticket |
| L’historique disparaît quand on « range » | Les actions terminées vont dans les **Archives**, les machines remplacées aussi |

**Le bon réflexe :** dès qu’il y a un souci ou un point de vigilance, on ouvre un ticket. Ce n’est pas de la paperasse : c’est ce qui permet à l’équipe de travailler sur la même réalité.

---

## 3. Le tableau de bord, ce que l’on voit (1 min 30)

Chaque machine a une **carte**. D’un coup d’œil :

- **Nom, localisation, software**, dernière intervention
- **État** : OK, maintenance, ou problème
- **Couleur live** (DXI) : vert = ça tourne, rouge = souci, bleu = maintenance — récupérée automatiquement sur le bandeau SYSTEM de Lab Manager
- **Flags, problèmes, réparations, improvements** : combien sont en cours / terminés
- **Tickets** ouverts et fermés
- **PM** (visite préventive, tous les 6 mois) et **maintenance mensuelle**
- **ASD** (tests de performance de l’analyseur)
- **Triton** : si une manip bidons est en cours, la carte se met en évidence

Au-dessus : des **filtres** (type de machine, état, PM, tickets ouverts…) et une **recherche**.

Boutons utiles en haut :

- **Ouvrir un ticket** — le geste principal
- **Archives** — machines retirées / remplacées
- **Connectés** — qui est dans l’appli en ce moment (et le « wizz » pour attirer l’attention)
- **FalconMP Lab Dashboard** — raccourci vers Lab Manager

Cliquer une carte ouvre la fiche machine : Général, Flags, Problèmes, Réparations, Improvements, Tickets, Archives.

---

## 4. Les tickets — le cœur de l’outil (3 min)

### À quoi ça sert

Un ticket, c’est **une information officielle** : « il se passe ceci, sur cette machine, à cette date, signalé par telle personne ».

Il apparaît tout de suite sur la carte de la machine. Toute l’équipe le voit. Les personnes du canal Teams aussi.

### Comment en ouvrir un

1. Bouton vert **Ouvrir un ticket** (ou depuis la fiche machine).
2. Choisir la **machine**.
3. Choisir la **catégorie**.
4. Écrire un **commentaire clair** (ce que l’on a vu, pas seulement « ça marche pas »).
5. Valider.

**Tout le monde peut ouvrir un ticket** (opérateur, technicien, administrateur).

### Les catégories — on choisit la bonne

| Catégorie | Quand l’utiliser | Qui la pose |
| --- | --- | --- |
| **Problème** | Quelque chose ne va pas, ça gêne ou ça bloque le fonctionnement | Tout le monde, à la création |
| **Flag** | Point de vigilance : à surveiller, pas forcément bloquant aujourd’hui | Tout le monde, à la création |
| **Improvement** | Idée d’amélioration, pas une panne (ex. un réglage à revoir, un job à mettre à jour) | Technicien ou admin : on **convertit** un ticket existant |

On ne crée pas un Improvement « dans le vide » : on part d’un problème ou d’un flag, puis on le passe en Improvement si c’est le bon classement.

Changer de catégorie **déplace** automatiquement la ligne dans le bon onglet de la machine (Problèmes, Flags ou Improvements). Plus besoin de recopier.

### Les tâches (checklist)

Sur un ticket, on peut lister des **petites actions** à cocher (pièce à commander, test à refaire, collègue à prévenir…).

- Un **anneau de progression** s’affiche seulement s’il y a des tâches.
- Quand tout est coché, on voit que le travail est abouti — utile avant de clôturer.

### Clôturer

Technicien ou admin : on passe le ticket en **clôturé** (ou on coche l’action comme terminée sur la fiche). Une notification Teams part aussi à la clôture.

Un titre de ticket **clôturé** est barré dans l’onglet Tickets : on voit tout de suite ce qui est fini.

### Notification Teams

À chaque **nouveau ticket** (problème ou flag), un message part dans le canal Teams :

- numéro du ticket
- machine
- catégorie
- qui l’a ouvert
- le commentaire

Même principe à la **clôture**.

Les personnes qui ne sont pas devant l’écran (autre site, autre salle, astreinte) sont prévenues sans qu’on ait à les chercher.

---

## 5. Autour de la machine (1 min 30)

**Fiche machine (onglet Général)**  
Nom, localisation, n° de série, software, dates, état, ADAM, ASD, maintenance mensuelle, PM.

**PM**  
Visite préventive tous les 6 mois (PM 6 mois / PM 12 mois en alternance). La carte indique si une PM est due ce mois-ci.

**Maintenance mensuelle (MP)**  
Case « à faire / faite ». Elle se **remet à zéro toute seule** au début de chaque mois.

**Live**  
La couleur se rafraîchit toute seule (environ toutes les 5 minutes). On peut forcer un rafraîchissement depuis l’en-tête. Lien « Voir en direct » vers la page Lab Manager de l’instrument.

**Triton**  
Manip bidons, occasionnelle, fort impact.

- Admin / technicien : indiquent si la machine **est compatible** Triton.
- **Tout le monde** (y compris opérateur) : coche **manip en cours** sur la carte, pour que les autres le voient tout de suite.

**Onglet Archives (dans la fiche)**  
Les actions terminées que l’on a « rangées ». Elles ne polluent plus la vue du jour, mais on peut les retrouver (recherche, filtre par année). Chargées seulement quand on ouvre l’onglet.

**Page Archives machines**  
Quand une machine est **remplacée**, on ne l’efface pas : on l’**archive**. Toute sa vie (tickets, historique) reste consultable. La nouvelle machine prend sa place sur le tableau de bord.

---

## 6. Qui a le droit de faire quoi ? (2 min)

Il y a **trois profils**. L’idée est simple :

- **Opérateur** : signale et consulte. C’est le premier maillon, pas la configuration.
- **Technicien** : pilote le suivi au quotidien (tickets, fiches, Triton compatible, archivage d’une machine remplacée).
- **Administrateur** : tout le technicien, plus le « ménage » (supprimer, archiver une action, gérer les comptes).

### Tableau des droits

| Action | Opérateur | Technicien | Admin |
| --- | :---: | :---: | :---: |
| Se connecter, changer **son** mot de passe | oui | oui | oui |
| Voir toutes les machines, tickets, archives | oui | oui | oui |
| Filtrer, chercher, voir le live | oui | oui | oui |
| Voir qui est connecté, envoyer un **wizz** | oui | oui | oui |
| **Ouvrir un ticket** (problème ou flag) | **oui** | **oui** | **oui** |
| Activer / désactiver **Triton en cours** sur une machine compatible | **oui** | **oui** | **oui** |
| Modifier la fiche machine (nom, PM, ASD, listes…) | non | oui | oui |
| Modifier, reclassee ou **clôturer** un ticket | non | oui | oui |
| Transformer un ticket en **Improvement** | non | oui | oui |
| Ajouter / cocher les **tâches** d’un ticket | non | oui | oui |
| Ajouter une **nouvelle machine** | non | oui | oui |
| **Archiver une machine** remplacée (elle quitte le tableau, l’historique reste) | non | oui | oui |
| Marquer une machine **compatible Triton** | non | oui | oui |
| **Archiver une action** (la sortir de la vue du jour vers l’onglet Archives) | non | non | oui |
| **Supprimer définitivement** une action ou un ticket | non | tickets : oui\* | oui |
| Gérer les **comptes** (créer, supprimer, réinitialiser un mot de passe) | non | non | oui |

\*Le technicien peut supprimer un **ticket**. Seul l’admin peut supprimer une **ligne** (problème, flag, réparation, improvement) ou l’envoyer aux archives.

### Ce que l’opérateur ne fait pas (et ce n’est pas un oubli)

L’opérateur **ne modifie pas** la fiche, **ne clôture pas** les tickets, **n’archive pas**, **ne gère pas** les utilisateurs.

Il **consulte** et il **signale**. C’est volontaire : le signalement reste simple et rapide, le traitement reste du côté tech / admin.

En ouvrant une fiche, l’opérateur voit « **Consultation** » (pas « Édition »). Le bouton principal reste **Fermer**, pas Enregistrer.

---

## 7. Être plusieurs en même temps (30 s)

L’application est **partagée en direct**. Si un collègue ouvre un ticket, les cartes se mettent à jour chez les autres.

Le bouton **Connectés** montre qui a l’appli ouverte. Un **wizz** envoie une alerte (son + notification) à la personne, comme un petit « coucou, j’ai besoin de toi ».

Chacun peut changer **son** mot de passe. Seul un admin crée les comptes et réinitialise un mot de passe oublié.

---

## 8. Déroulé proposé pour le meeting (10 min)

| Temps | Vous montrez | Vous dites |
| --- | --- | --- |
| 0:00–0:30 | Écran d’accueil (cartes) | « Une seule vue pour tout le parc DXI et Access 2. » |
| 0:30–1:30 | Une carte (couleur, tickets, PM) | « On lit l’état sans ouvrir dix outils. Vert / rouge / bleu, c’est le live Lab Manager. » |
| 1:30–4:30 | **Ouvrir un ticket** (problème, puis expliquer flag) | « Le geste du quotidien. Ça crée la ligne sur la machine **et** ça prévient Teams. » |
| 4:30–6:00 | Onglet Tickets : catégorie, tâches, clôture | « On reclasse, on découpe le travail, on clôture. L’Improvement, c’est le tech qui le décide. » |
| 6:00–7:30 | Général : PM, ASD, Triton | « La fiche, c’est le dossier de la machine. Triton : le tech dit “compatible”, tout le monde coche “en cours”. » |
| 7:30–9:00 | Les 3 profils (tableau) | « Opérateur = je signale. Tech = je traite. Admin = je traite + je range et je gère les comptes. » |
| 9:00–10:00 | Archives + Connectés + questions | « Rien ne se perd. Et on voit qui est là. » |

---

## 9. Phrases utiles si on vous interrompt

**« Encore un outil ? »**  
Non : c’est l’endroit unique pour l’état des machines. Teams reste pour discuter ; le ticket, c’est la trace.

**« Je n’ai pas le temps d’écrire. »**  
Deux phrases suffisent : machine + ce que vous voyez. Mieux qu’un message qui disparaît.

**« Problème ou flag ? »**  
Ça bloque ou ça cloche vraiment → **problème**. À surveiller, pas urgent → **flag**. Dans le doute, problème : on reclasse après.

**« Je suis opérateur, je ne peux rien faire ? »**  
Vous faites le plus important : **ouvrir le ticket**. Sans ça, personne n’est prévenu.

**« Si on remplace une machine, on perd l’historique ? »**  
Non. On l’archive. La page **Archives** garde le dossier.

**« Teams n’a rien reçu. »**  
Le ticket est quand même créé. La notif est un plus ; la source de vérité, c’est l’application.

---

## 10. Mémo à laisser après la réunion

1. Je me connecte avec **mon** compte.
2. Je vois **toutes** les machines.
3. Un souci → bouton **Ouvrir un ticket** → machine + catégorie + commentaire.
4. **Problème** = ça cloche. **Flag** = à surveiller. **Improvement** = le tech reclasse.
5. Teams est prévenu automatiquement.
6. Opérateur : consulter + signaler + Triton « en cours ».
7. Technicien : traiter les tickets, mettre à jour les fiches.
8. Admin : pareil, plus archives / suppressions / comptes.
9. Une machine remplacée s’**archive**, elle ne s’efface pas.
10. En cas de doute : **ouvrir un ticket** plutôt que d’attendre.
