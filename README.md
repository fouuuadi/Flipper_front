# Flipper Virtuel — Frontend

> Application frontend du **Flipper Virtuel**, construite avec **Vite + TypeScript**.
>
> Ce repo gère les 3 composants visuels du flipper : le **Playfield** (table 3D), le **Backglass** (affichage score/animations) et le **DMD** (Dot Matrix Display). La communication avec le serveur central Go se fait via **WebSockets**.

---

## Démarrage rapide

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build de production
npm run build

# Lint
npm run lint        # vérifier
npm run lint:fix    # corriger automatiquement

# Prettier
npm run format        # formatter le code
npm run format:check  # vérifier le formatage
```

---

## Architecture du projet

```
src/
├── config/              # Configuration applicative
│   └── env.ts           # Accès typé aux variables d'environnement
│
├── core/                # Noyau applicatif (EventBus, GameState, Store)
│
├── engine/              # Moteur graphique & physique (Three.js, SceneManager, PhysicsAdapter)
│
├── modules/             # Modules fonctionnels (feature-based)
│   ├── playfield/       # Table 3D — utilise engine pour le rendu et la physique
│   ├── backglass/       # Affichage score & animations — Canvas
│   └── dmd/             # Dot Matrix Display rétro — Canvas/CSS
│
├── services/            # Services techniques (WebSocket client, API…)
│
├── styles/              # Feuilles de style globales (reset, variables…)
│
├── utils/               # Fonctions utilitaires pures (DOM helpers, logger…)
│
├── main.ts              # Point d'entrée — bootstrap de l'application
└── style.css            # Styles globaux
```

---

## Principes d'architecture

### Architecture modulaire par feature

Chaque module dans `src/modules/<feature>/` est **autonome** et regroupe tout ce qui concerne sa feature :

```
src/modules/playfield/
├── playfield.types.ts      # Types, interfaces, constantes du module
├── playfield.setup.ts      # Initialisation (meshes, bodies, listeners…)
├── playfield.handlers.ts   # Logique métier (collisions, scoring, events…)
├── index.ts                # Barrel export
```

Principes :
- **Un module = un dossier** avec tout ce qu'il faut dedans
- **Pas de couplage direct** entre modules — communication via `EventBus` ou `services/`
- **Chaque fichier a une responsabilité claire** — nommé par rôle, pas par pattern

### Modules prévus

| Module       | Techno principale          | Responsabilité                                          |
| ------------ | -------------------------- | ------------------------------------------------------- |
| `playfield`  | Three.js + moteur physique | Table 3D, bille, flippers, collisions, événements jeu   |
| `backglass`  | HTML5 Canvas / Three.js    | Score temps réel, animations, messages système           |
| `dmd`        | HTML5 Canvas + CSS         | Simulation écran rétro dot-matrix                       |

### Communication

Le frontend communique avec le **serveur Go central** via WebSockets :
- Le **Playfield** envoie les événements de collision (`bumper_hit`, `target_hit`…)
- Le serveur renvoie les mises à jour de score, messages et commandes IoT
- Le **Backglass** et le **DMD** reçoivent les données d'affichage du serveur

### Aliases de chemin

Des aliases TypeScript + Vite sont configurés pour des imports propres :

| Alias        | Répertoire       |
| ------------ | ---------------- |
| `@core/*`    | `src/core/*`     |
| `@engine/*`  | `src/engine/*`   |
| `@config/*`  | `src/config/*`   |
| `@modules/*` | `src/modules/*`  |
| `@services/*`| `src/services/*` |
| `@utils/*`   | `src/utils/*`    |

---

## Environnements

Les variables d'environnement sont gérées par Vite via les fichiers `.env.*` :

| Fichier              | Mode          |
| -------------------- | ------------- |
| `.env.development`   | `npm run dev` |
| `.env.production`    | `npm run build` |

Variables disponibles (préfixées `VITE_`) :

| Variable             | Description                          |
| -------------------- | ------------------------------------ |
| `VITE_API_BASE_URL`  | URL de base de l'API REST (serveur Go) |
| `VITE_WS_URL`        | URL WebSocket du serveur Go          |
| `VITE_APP_TITLE`     | Titre de l'application               |

Accès centralisé via `src/config/env.ts` :

```ts
import { env } from "@config/env";
console.log(env.apiBaseUrl, env.isDev);
```

---

## Qualité de code

| Outil      | Fichier de config    | Description                         |
| ---------- | -------------------- | ----------------------------------- |
| ESLint     | `eslint.config.js`   | Lint TypeScript + intégration Prettier |
| Prettier   | `.prettierrc`        | Formatage automatique               |
| TypeScript | `tsconfig.json`      | Mode strict activé                  |

---

## Stack technique

| Technologie | Version      | Rôle                             |
| ----------- | ------------ | -------------------------------- |
| Vite        | 8.x (beta)   | Bundler / dev server             |
| TypeScript  | 5.9.x        | Typage statique                  |
| Three.js    | *(à venir)*  | Rendu 3D du playfield            |
| Moteur physique | *(à venir)* | Cannon.js, Ammo.js ou Rapier  |
| ESLint      | 10.x         | Lint                             |
| Prettier    | 3.x          | Formatage                        |
