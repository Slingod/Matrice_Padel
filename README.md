# Matrice PADEL

Application web de gestion de tournoi PADEL, pensée pour faciliter l’organisation des **poules**, le **suivi des matchs**, le **classement automatique**, la **phase finale**, ainsi que l’**import/export de données**.

L’objectif du projet est de proposer une interface simple, rapide et exploitable sur **ordinateur**, **tablette** et **mobile**, afin d’éviter les saisies manuelles répétitives et de centraliser toutes les informations importantes d’un tournoi en un seul endroit.

---

## Aperçu

Matrice PADEL permet de :

- gérer plusieurs **poules**
- organiser un **serpentin**
- saisir les **scores des matchs**
- calculer automatiquement :
    - les **victoires**
    - les **défaites**
    - les **points marqués**
    - les **points encaissés**
    - la **différence de points**
    - le **classement**
- organiser une **phase finale**
- suivre un **classement final**
- **importer** des fichiers `.xlsx` et `.csv`
- **exporter** les données en `.xlsx` et `.csv`
- conserver automatiquement les données grâce à la **sauvegarde locale**

---

## Pourquoi ce projet existe

Dans un tournoi de PADEL, il faut souvent :

- répartir les équipes dans des poules
- équilibrer les groupes selon le niveau des joueurs
- saisir les résultats rapidement
- connaître immédiatement les classements
- préparer les phases finales
- visualiser les vainqueurs et les confrontations
- éviter de repasser sur toutes les feuilles ou tous les onglets pour comprendre la situation

Cette application a été conçue pour répondre à ce besoin de manière concrète, avec une interface orientée terrain et usage réel.

---

## Fonctionnalités principales

### Gestion des poules
- création de nouvelles poules
- renommage de poules
- suppression de poules
- ajout, modification et suppression d’équipes
- réorganisation des équipes via **drag & drop**
- conservation des matchs existants lors de la modification des équipes

### Serpentin
- édition manuelle du serpentin
- ajout et suppression de lignes
- réorganisation des positions par **drag & drop**
- conservation des données en local

### Matchs de poule
- génération automatique des matchs
- saisie des scores
- mise en avant du gagnant
- calcul automatique du classement
- tentative d’optimisation de l’ordre des matchs pour limiter la fatigue des équipes

### Classement automatique
Pour chaque équipe :
- matchs joués
- victoires
- défaites
- points marqués
- points encaissés
- différence
- total

### Phase finale
- placement manuel des équipes dans le tableau final
- quarts de finale
- demi-finales

- finale
- propagation automatique des gagnants dans le tableau

### Classement final
- 1er
- 2e
- 3e
- 4e
- puis classement complémentaire des autres équipes selon leur parcours et leur rang de poule

### Import / Export
- import de fichiers :
    - `.xlsx`
    - `.csv`
- export de fichiers :
    - `.xlsx`
    - `.csv`

### Sauvegarde locale
- persistance automatique via `localStorage`
- récupération de l’état de l’application au rechargement

---

## Technologies utilisées

### Front-end
- **React**
- **Vite**
- **JavaScript**

### Interface et interaction
- **CSS**
- **react-icons**
- **@dnd-kit/core**
- **@dnd-kit/sortable**
- **@dnd-kit/utilities**

### Gestion de fichiers
- **xlsx**

### Stockage local
- **localStorage** du navigateur

---

## Structure du projet

```bash
Matrice_Padel/
├── public/
├── src/
│   ├── utils/
│   │   ├── tournament.js
│   │   ├── importExport.js
│   │   └── finalStage.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── package-lock.json
└── README.md


```
---

## Déploiement sur Vercel

### 1. Préparer le projet

Installer les dépendances :

```bash
npm install
```

Tester en local :
```
npm run dev
```

2. Build de production
```
npm run build
```
Le dossier généré :
```
dist/
```
3. Installer Vercel (si pas déjà fait)
```
npm install -g vercel
```
4. Connexion à Vercel

```
vercel login
```
5. Déployer le projet

Dans le dossier du projet :
```
vercel
```
Puis répondre :

Framework : Vite
Build command :
```
npm run build
```
Output directory :
```
dist
```
6. Déploiement production
```
vercel --prod
```
Déploiement automatique (option GitHub)

---------
Si tu relies ton repo à Vercel :

Push ton projet sur GitHub
Va sur https://vercel.com
Clique sur "New Project"
Sélectionne ton repo
Vercel détecte automatiquement Vite
Clique sur Deploy