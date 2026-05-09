# 🏆 Padelingo

**Padelingo** est une application web de gestion de tournois de padel, pensée pour simplifier l’organisation d’un événement complet : équipes, poules, serpentin, matchs, scores, classements, phases finales, sauvegardes, exports et suivi spectateur en direct.

L’application a été conçue avec une logique très terrain : rapide à utiliser, claire pour l’organisateur, accessible sur ordinateur, tablette et mobile, et capable de centraliser toutes les informations importantes d’un tournoi en un seul endroit.

---

## 🚀 Objectif du projet

Organiser un tournoi de padel demande souvent beaucoup de manipulations :

- répartir les équipes dans des poules ;
- équilibrer les groupes selon le niveau des joueurs ;
- gérer les têtes de série ;
- préparer les rotations de matchs ;
- saisir les scores rapidement ;
- calculer les classements sans erreur ;
- préparer les phases finales ;
- afficher les vainqueurs et les confrontations suivantes ;
- partager l’avancement du tournoi aux joueurs ou spectateurs.

**Padelingo répond à ce besoin avec une interface web moderne, fluide et pensée pour un usage réel en tournoi.**

---

## ✨ Fonctionnalités principales

### 👥 Gestion des équipes

Padelingo permet de construire une base d’équipes complète avec :

- numéro d’équipe ;
- nom affiché ;
- joueur 1 ;
- classement du joueur 1 ;
- joueur 2 ;
- classement du joueur 2 ;
- rang cumulé ;
- indication de tête de série ;
- ajout, modification et suppression d’équipes ;
- conservation des données pendant l’utilisation.

Chaque équipe peut être utilisée ensuite dans les poules, le serpentin, les matchs et la phase finale.

---

### 🧩 Gestion des poules

L’application permet de créer et gérer plusieurs poules :

- création de nouvelles poules ;
- renommage des poules ;
- suppression de poules ;
- ajout d’équipes dans chaque poule ;
- synchronisation des matchs lorsqu’une équipe change ;
- classement automatique par poule ;
- lecture claire des résultats.

Les poules servent de base au calcul des classements et à la qualification vers les phases finales.

---

### 🐍 Serpentin

Padelingo intègre une gestion du **serpentin**, utile pour répartir les équipes de manière équilibrée.

Fonctionnalités :

- édition manuelle du serpentin ;
- ajout de lignes ;
- suppression de lignes ;
- réorganisation par drag & drop ;
- affectation des équipes aux poules ;
- conservation des données ;
- prise en compte des têtes de série et des rangs cumulés.

Cette partie permet de mieux équilibrer les poules avant le lancement des matchs.

---

### 🎾 Matchs de poule

Padelingo génère et organise les matchs de poule.

L’application permet :

- génération automatique des matchs ;
- rotation des confrontations ;
- affichage par round / rotation ;
- saisie des scores ;
- mise en avant du gagnant ;
- calcul automatique des statistiques ;
- conservation des scores déjà saisis lors des modifications.

Les matchs peuvent être suivis directement depuis l’interface, avec une lecture claire des équipes, scores et résultats.

---

### 📊 Classement automatique

Pour chaque poule, Padelingo calcule automatiquement :

- matchs joués ;
- victoires ;
- défaites ;
- points marqués ;
- points encaissés ;
- différence de points ;
- total ;
- classement final de la poule.

Le classement est recalculé automatiquement à chaque saisie ou modification de score.

---

### 🏁 Phase finale

Padelingo intègre une phase finale configurable.

Elle peut gérer :

- huitièmes de finale ;
- quarts de finale ;
- demi-finales ;
- finale ;
- petite finale ;
- matchs de classement 5 à 8 ;
- propagation automatique des gagnants ;
- remise à zéro des scores si les équipes changent ;
- affichage clair du tableau final.

L’organisateur peut ainsi passer des poules à la phase finale sans refaire tous les calculs à la main.

---

### 🥇 Classement final

Padelingo permet de suivre un classement final global avec :

- vainqueur ;
- finaliste ;
- troisième place ;
- quatrième place ;
- classement complémentaire selon le parcours ;
- prise en compte des résultats de poule et de phase finale.

Cette partie permet d’obtenir une synthèse claire à la fin du tournoi.

---

## 📡 Mode spectateur en direct

Padelingo propose un système de **partage live** pour permettre aux joueurs, familles ou spectateurs de suivre le tournoi.

L’organisateur peut générer :

- un lien public de consultation ;
- un QR code spectateur ;
- une page dédiée en lecture seule ;
- un suivi des scores et classements en direct.

Les spectateurs peuvent consulter le tournoi sans créer de compte et sans pouvoir modifier les données.

Exemple de lien public :

```txt
https://ton-site.vercel.app/live/padel-xxxxx
```

### Sécurité du mode spectateur

Le lien spectateur est en lecture seule.

Les visiteurs peuvent voir :

- les poules ;
- les matchs ;
- les scores ;
- les classements ;
- la phase finale.

Ils ne peuvent pas :

- modifier les scores ;
- modifier les équipes ;
- modifier les poules ;
- accéder au token organisateur ;
- administrer le tournoi.

---

## ⏳ Expiration automatique des liens live

Pour éviter de conserver indéfiniment les anciens tournois en ligne, les liens live disposent d’une expiration automatique.

Fonctionnement :

- un live est créé avec une durée de validité de **48 heures** ;
- après 48 heures, le lien n’est plus accessible publiquement ;
- une tâche planifiée Supabase supprime automatiquement les tournois expirés ;
- la base reste propre et évite l’accumulation de vieux lives.

Ce système permet de limiter le stockage inutile et de garder une logique adaptée aux événements temporaires.

---

## 💾 Sauvegarde locale

Padelingo conserve les données localement dans le navigateur grâce à `localStorage`.

Cela permet :

- de ne pas perdre le tournoi en cas de rechargement ;
- de reprendre un tournoi commencé ;
- de travailler sans compte utilisateur ;
- de conserver plusieurs sauvegardes locales nommées ;
- d’exporter et réimporter des tournois.

La sauvegarde locale est particulièrement utile pour une utilisation rapide sur un ordinateur d’organisation.

---

## 📤 Import / Export

Padelingo propose plusieurs options d’import et d’export afin de faciliter la préparation, la sauvegarde et le partage des données.

### Import

L’application peut importer des fichiers :

- `.xlsx`
- `.csv`
- `.json` pour les sauvegardes de tournoi

### Export

L’application peut exporter :

- les poules ;
- les classements ;
- les matchs ;
- le serpentin ;
- le planning ;
- les phases finales ;
- les données complètes du tournoi.

Formats pris en charge selon les modules :

- `.xlsx`
- `.csv`
- `.pdf`
- `.json`

---

## 🧠 Logique métier intégrée

Padelingo ne se limite pas à un simple tableau de saisie.

L’application intègre plusieurs règles utiles pour l’organisation :

- calcul automatique des rangs cumulés ;
- gestion des têtes de série ;
- équilibrage par serpentin ;
- génération des matchs de poule ;
- rotations adaptées aux poules ;
- conservation des scores existants ;
- classement automatique ;
- propagation des gagnants en phase finale ;
- classement final global ;
- sauvegarde locale ;
- publication live en lecture seule.

---

## 🖥️ Interface

L’interface a été pensée pour être utilisable sur plusieurs supports :

- ordinateur ;
- tablette ;
- mobile.

Objectifs de l’interface :

- être claire pendant un tournoi ;
- éviter les manipulations inutiles ;
- limiter les erreurs de saisie ;
- afficher rapidement les informations importantes ;
- permettre une utilisation par un organisateur en situation réelle.

---

## 🛠️ Technologies utilisées

### Front-end

- **React**
- **Vite**
- **JavaScript**
- **CSS**

### Interface et interactions

- **@dnd-kit/core**
- **@dnd-kit/sortable**
- **@dnd-kit/utilities**
- **react-icons**

### Import / Export

- **xlsx**
- **jsPDF**
- **jspdf-autotable**

### Live spectateur

- **Supabase**
- **@supabase/supabase-js**
- **qrcode.react**
- **react-router-dom**

### Stockage

- **localStorage**
- **Supabase PostgreSQL** pour les lives publics temporaires

### Déploiement

- **Vercel**

---

## 📁 Structure du projet

```bash
Padelingo/
├── public/
│   ├── favicon.ico
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   └── manifest.webmanifest
│
├── src/
│   ├── assets/
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppHeader.jsx
│   │   │   ├── AppToolbar.jsx
│   │   │   └── LegalFooter.jsx
│   │   │
│   │   ├── live/
│   │   │   └── ShareTournamentPanel.jsx
│   │   │
│   │   ├── Base.jsx
│   │   ├── ClassementFinal.jsx
│   │   ├── FinalMatchCard.jsx
│   │   ├── PhasesFinal.jsx
│   │   ├── Planning.jsx
│   │   ├── Poule.jsx
│   │   ├── SavedTournaments.jsx
│   │   ├── Serpentin.jsx
│   │   └── SortableSerpentinRow.jsx
│   │
│   ├── hooks/
│   │   └── useTournamentState.js
│   │
│   ├── pages/
│   │   └── LiveTournamentPage.jsx
│   │
│   ├── services/
│   │   └── liveTournamentService.js
│   │
│   ├── utils/
│   │   ├── appLogic.js
│   │   ├── exportUtils.js
│   │   ├── finalStage.js
│   │   ├── importExport.js
│   │   ├── padelUtils.js
│   │   ├── persistence.js
│   │   └── tournament.js
│   │
│   ├── App.css
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
│
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── README.md
├── vercel.json
└── vite.config.js
```

---

## ⚙️ Installation locale

### 1. Cloner le projet

```bash
git clone https://github.com/TON-UTILISATEUR/TON-REPO.git
cd TON-REPO
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Créer le fichier d’environnement

Créer un fichier `.env` à la racine du projet :

```env
VITE_SUPABASE_URL=https://ton-projet.supabase.co
VITE_SUPABASE_ANON_KEY=ta_cle_publishable_supabase
```

> La clé utilisée côté front doit être une clé publique / publishable.  
> Ne jamais mettre de clé secrète Supabase dans une application front-end.

### 4. Lancer le projet en local

```bash
npm run dev
```

L’application sera disponible sur :

```txt
http://localhost:5173
```

---

## 🧪 Scripts disponibles

### Lancer le serveur de développement

```bash
npm run dev
```

### Générer un build de production

```bash
npm run build
```

### Prévisualiser le build

```bash
npm run preview
```

### Lancer le lint

```bash
npm run lint
```

---

## 🗄️ Configuration Supabase

Padelingo utilise Supabase pour le mode live spectateur.

### Table utilisée

```sql
live_tournaments
```

Cette table stocke temporairement :

- l’identifiant public du live ;
- le nom du tournoi ;
- l’état du tournoi ;
- le hash du token organisateur ;
- la date de création ;
- la date de mise à jour ;
- la date d’expiration.

### Expiration

Chaque live expire automatiquement après :

```txt
48 heures
```

Une tâche planifiée supprime automatiquement les lives expirés.

### Sécurité

Le système repose sur :

- Row Level Security ;
- lecture publique limitée aux lives non expirés ;
- modification autorisée uniquement avec un token organisateur ;
- suppression automatique des lives expirés ;
- absence de compte obligatoire pour les spectateurs.

---

## 🌐 Déploiement sur Vercel

Padelingo est compatible avec Vercel.

### 1. Build command

```bash
npm run build
```

### 2. Output directory

```txt
dist
```

### 3. Variables d’environnement Vercel

Dans Vercel :

```txt
Project Settings → Environments → Production → Environment Variables
```

Ajouter :

```env
VITE_SUPABASE_URL=https://ton-projet.supabase.co
VITE_SUPABASE_ANON_KEY=ta_cle_publishable_supabase
```

Faire la même chose pour :

- Production ;
- Preview ;
- Development si nécessaire.

### 4. Routing SPA

Pour permettre l’accès direct aux liens du type :

```txt
/live/padel-xxxxx
```

le projet utilise un fichier `vercel.json` :

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Cela permet à Vercel de servir l’application React même lorsqu’un utilisateur ouvre directement une URL live.

---

## 🔐 Sécurité et confidentialité

Padelingo ne nécessite pas de compte utilisateur pour les spectateurs.

Le mode live public est en lecture seule.

Les données sensibles ne doivent pas être placées dans :

- les noms d’équipes ;
- les noms de joueurs ;
- les intitulés visibles publiquement.

Le fichier `.env` ne doit jamais être envoyé sur GitHub.

Le `.gitignore` doit contenir :

```gitignore
.env
.env.local
```

---

## 📱 Utilisation type pendant un tournoi

1. L’organisateur prépare les équipes.
2. Il répartit les équipes dans les poules.
3. Il organise le serpentin.
4. Il lance les matchs.
5. Il saisit les scores.
6. Les classements se mettent à jour automatiquement.
7. Il génère un lien live ou un QR code.
8. Les joueurs et spectateurs suivent les résultats en lecture seule.
9. Le tournoi passe en phase finale.
10. Le classement final est généré.
11. Le live expire automatiquement après 48h.

---

## 🧭 Cas d’usage

Padelingo peut être utilisé pour :

- tournois de padel amateurs ;
- tournois internes de club ;
- événements sportifs privés ;
- compétitions entre amis ;
- animations sportives ;
- organisations de poules et phases finales ;
- suivi public d’un tournoi via QR code.

---

## 🚧 Améliorations possibles

Fonctionnalités envisageables pour les prochaines versions :

- mode grand public sans Realtime, avec rafraîchissement périodique ;
- tableau spectateur plus visuel ;
- QR code téléchargeable en image ;
- page d’accueil publique pour retrouver un tournoi ;
- système de duplication de tournoi ;
- export PDF enrichi ;
- statistiques avancées ;
- historique des tournois ;
- mode multi-organisateurs ;
- authentification organisateur ;
- personnalisation du logo du tournoi ;
- thème clair / sombre ;
- version SaaS complète.

---

## 📌 Statut du projet

Padelingo est un projet en évolution active.

L’application propose déjà une base complète pour organiser un tournoi de padel, depuis la préparation des équipes jusqu’au classement final, avec une fonctionnalité de partage live pour les spectateurs.

---

## 👤 Auteur

Projet développé par **Julien Sicard**.

Développeur web junior, avec une approche orientée projet réel, expérience utilisateur, logique métier et déploiement web.

---

## 📄 Licence

Projet propriétaire / personnel.

Tous droits réservés sauf mention contraire.
