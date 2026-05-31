# Onboarding — Designers / Front-end visuel

> Ce guide est pour toi si tu veux **modifier le visuel** du flipper (couleurs,
> polices, layout, animations) sans avoir besoin de comprendre toute la stack
> 3D ou la state machine.
>
> Pour les conventions de design (palette, typo, tokens, glow), réfère-toi à
> [`docs/DESIGN.md`](./DESIGN.md). Pour la stack technique complète, voir le
> [`README.md`](../README.md) à la racine.

---

## 1. Prérequis (à installer une seule fois)

| Outil | Version mini | Pourquoi |
|---|---|---|
| **Node.js** | 20.x ou plus | Le serveur de dev (Vite) tourne dessus |
| **npm** | 10.x (livré avec Node) | Gestion des dépendances |
| **Docker Desktop** | récent | Pour lancer le back (sessions, WS) — **optionnel** si tu ne touches qu'aux écrans menu/identification/splash |
| **Git** | tout récent | Pour récupérer le code et pousser tes changements |
| **Navigateur** | Chrome / Firefox / Safari récent | Pour voir le résultat |

Vérifie que tout est OK :

```bash
node --version    # doit afficher v20.x.x ou plus
npm --version     # 10.x.x
docker --version  # 24.x ou plus
git --version
```

---

## 2. Récupérer le code (une seule fois)

```bash
# Choisis un dossier où tu veux ranger le projet
cd ~/projets  # par exemple

# Clone le repo
git clone https://github.com/fouuuadi/Flipper_front.git
cd Flipper_front

# Installe les dépendances (≈ 30 s)
npm install
```

---

## 3. Lancer le projet pour bosser sur le visuel

### Mode rapide (sans back, suffit pour 90% du visuel)

```bash
npm run dev
```

Tu verras dans le terminal une URL du type :

```
  ➜  Local:   http://localhost:5173/
```

> ⚠️ **Important : ne tape pas juste `http://localhost:5173/`**, tu obtiendrais
> une **erreur 404**. Le projet est un **multi-entry Vite** (3 apps distinctes),
> il n'y a pas de page à la racine `/`. Il faut accéder à l'app que tu veux
> voir via son chemin complet — voir le tableau ci-dessous.
>
> 💡 **Le port peut varier** : si `5173` est déjà pris (autre projet, autre
> container Docker…), Vite passera automatiquement à `5174`, puis `5175`, etc.
> Toujours regarder le port affiché dans ton terminal après `npm run dev`.

### Les 3 écrans du flipper

Le projet contient **3 apps indépendantes** qui simulent les 3 écrans physiques
de la borne. Adapte le port si Vite t'en a donné un autre que `5173`.

| App | URL en dev | Rôle | Quand y aller |
|---|---|---|---|
| **playfield** | `http://localhost:5173/apps/playfield/index.html` | L'écran principal (3D + tous les menus / overlays) | Pour bosser sur splash, menu, identification, pause, game over, leaderboard |
| **backglass** | `http://localhost:5173/apps/backglass/index.html?session_id=...` | L'écran de score (au-dessus du flipper réel) | Pour bosser sur l'affichage score / vies / timer |
| **dmd** | `http://localhost:5173/apps/dmd/index.html?session_id=...` | L'écran dot-matrix (style pixel art) | Pour bosser sur les messages courts (READY, GAME OVER…) |

**Commence par l'app `playfield`** — c'est elle qui héberge tous les écrans UI
(menu, identification, pause, game over, leaderboard) et la 3D du flipper.

Une fois sur le **playfield**, tu vois l'écran **splash** "Mario Galaxy
Pinball". Appuie sur n'importe quelle touche pour passer au menu, puis navigue
avec les boutons et les raccourcis clavier (`?` à tout moment pour voir tous
les raccourcis).

> 💡 **Hot reload** : chaque fois que tu modifies un fichier `.ts` ou `.css`, le
> navigateur se met à jour automatiquement. Pas besoin de recharger.

> ⚠️ `backglass` et `dmd` ont besoin d'un `session_id` dans l'URL pour se
> connecter au back en WebSocket. Pour les designs purs (sans data live), tu
> peux mettre n'importe quoi : `?session_id=test`. Pour les tester avec de la
> vraie data, voir la section "Mode complet avec back" plus bas.

### Mode complet (avec back, pour tester les flows playing / pause / score)

Si tu veux voir l'application en condition réelle (une vraie partie qui démarre,
des scores qui tombent, etc.), il faut le back. Il tourne dans Docker.

Dans **un autre dossier** (où tu auras cloné `Flipper_back`) :

```bash
cd ~/projets/Flipper_back
docker compose up -d
```

Ça va lancer le back sur `http://localhost:8080`. Tu peux vérifier que ça
répond :

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

Une fois le back lancé, retourne sur
`http://localhost:5173/apps/playfield/index.html`, fais une partie solo en mode
normal (identification → "Lancer la partie") → ça créera une session et le
`session_id` apparaîtra dans l'URL du WebSocket ouvert (visible dans les
devtools réseau du navigateur).

Pour les designers qui touchent juste au visuel **sans le back**, le mode rapide
suffit largement : les écrans sont fonctionnels en mode mock 1v1, et les pauses
/ abandons retombent sur la SM front directement.

---

## 4. Où sont les fichiers visuels

Toute la partie design est concentrée dans :

```
src/
├── styles/
│   ├── tokens.css          ← 🎨 LES TOKENS (couleurs, espaces, typo)
│   ├── global.css          ← styles globaux (reset, body, etc.)
│   └── animations.css      ← animations CSS partagées
└── modules/
    ├── splash/
    │   ├── Splash.ts       ← logique (NE PAS toucher pour du visuel)
    │   └── splash.css      ← ✏️ STYLES de l'écran splash
    ├── menu/
    │   ├── Menu.ts
    │   └── menu.css        ← ✏️ STYLES du menu
    ├── identification/
    │   └── identification.css
    ├── pause/
    │   └── pause.css
    ├── gameOver/
    │   └── gameOver.css
    ├── leaderboard/
    │   └── leaderboard.css
    ├── countdown/
    │   └── countdown.css   ← l'overlay 3-2-1-GO
    ├── backglass/
    │   └── backglass.css   ← écran score (app backglass)
    ├── dmd/
    │   └── dmd.css         ← écran dot-matrix (app dmd)
    └── ui/                 ← composants réutilisables (boutons, inputs, modals)
        ├── Button/
        ├── Input/
        ├── PseudoInput/
        ├── Modal/
        ├── NeonText/
        ├── KeybindingsHelp/      ← la modal "?" qui liste les raccourcis
        └── KeybindingsHelpHint/  ← le hint `[?] Raccourcis` en bas à droite
```

> 🎯 **Règle d'or** : **un dossier = un écran = un fichier CSS**. Tous les
> styles d'un écran sont scoped sous le sélecteur racine de cet écran
> (`.splash-scene`, `.menu-scene`, etc.), donc tu ne risques pas de collisions
> entre écrans.

---

## 5. Modifier un visuel — exemple concret

Disons que tu veux changer la **couleur du titre du menu** (actuellement cyan).

1. Ouvre `src/modules/menu/menu.css`
2. Cherche la classe `.menu-title`
3. Modifie le `color:`. **Mais surtout — utilise un token CSS plutôt qu'une couleur en dur** :

   ❌ Mauvais :
   ```css
   .menu-title {
     color: #FF3366; /* magic value */
   }
   ```

   ✅ Bon :
   ```css
   .menu-title {
     color: var(--color-neon-pink); /* token défini dans tokens.css */
   }
   ```

4. Sauvegarde → le navigateur se met à jour instantanément. Si tu vois pas la
   différence, fais Cmd+Shift+R (Mac) ou Ctrl+Shift+R (Windows) pour force
   reload.

### Pourquoi les tokens ?

- Cohérence visuelle (même cyan partout)
- Si on change le cyan global plus tard, ça se propage automatiquement
- Lisibilité (`var(--color-neon-pink)` est plus parlant que `#FF3366`)

Tous les tokens dispos sont dans `src/styles/tokens.css` et documentés dans
[`docs/DESIGN.md`](./DESIGN.md).

---

## 6. Ajouter une nouvelle couleur / un nouveau token

Si la palette existante ne te suffit pas :

1. Ouvre `src/styles/tokens.css`
2. Ajoute ta variable dans la section appropriée :
   ```css
   :root {
     /* ... */
     --color-neon-magenta: #ff00aa;
   }
   ```
3. Mets à jour [`docs/DESIGN.md`](./DESIGN.md) avec la nouvelle couleur (table
   des couleurs en haut du doc).
4. Utilise `var(--color-neon-magenta)` dans tes fichiers CSS.

---

## 7. Tester ses changements

### Pendant le développement

Le hot reload Vite te montre le rendu en temps réel. Pour la majorité du visuel,
ça suffit.

### Avant de commit

Lance les vérifs locales pour t'assurer que rien n'est cassé :

```bash
npx tsc --noEmit        # vérifie le TypeScript
npm run lint            # vérifie ESLint
npm run format:check    # vérifie le formatage Prettier
```

Si Prettier flag un fichier, corrige avec :

```bash
npx prettier --write src/modules/menu/menu.css
```

### Voir le rendu sur les 3 apps en parallèle

Ouvre **3 onglets browser** côte à côte (remplace `5173` par ton port réel si
Vite t'en a donné un autre) :

1. `http://localhost:5173/apps/playfield/index.html` (playfield)
2. `http://localhost:5173/apps/backglass/index.html?session_id=test` (backglass)
3. `http://localhost:5173/apps/dmd/index.html?session_id=test` (dmd)

Très utile pour voir si une modif sur les tokens impacte cohéremment les 3
écrans.

---

## 8. Workflow Git pour pousser tes modifs

Le projet utilise le workflow **GitHub Flow** : une branche par feature/fix,
une PR pour merger.

```bash
# 1. Pars d'un main à jour
git checkout main
git pull

# 2. Crée une branche avec un nom descriptif
git checkout -b feat/menu-color-update

# 3. Fais tes modifs, vérifie le rendu dans le browser

# 4. Vérifs avant commit
npx tsc --noEmit && npm run lint && npm run format:check

# 5. Stage et commit (message en anglais, format conventionnel)
git add src/modules/menu/menu.css
git commit -m "feat(menu): update title color from cyan to pink"

# 6. Push
git push -u origin feat/menu-color-update

# 7. Ouvre une PR sur GitHub
# La CI va lancer tous les checks. Si tout est vert, demande une review.
```

### Types de commit autorisés

- `feat(scope): ...` — nouveau visuel / feature
- `fix(scope): ...` — correction d'un bug visuel
- `refactor(scope): ...` — réorganisation sans changement visible
- `docs(scope): ...` — modification de doc (comme ce fichier)
- `chore(scope): ...` — maintenance / config

Exemples valides :

- `feat(splash): add planet rotation animation`
- `fix(menu): align buttons on mobile`
- `refactor(tokens): rename neon-red to neon-mario`

---

## 9. Conventions à respecter (lisibilité review)

| Règle | Pourquoi |
|---|---|
| **Toujours utiliser les tokens** (`var(--color-*)`, `var(--space-*)`) | Cohérence + facilité de refonte globale |
| **Préfixer les classes par l'écran** (`.menu-button`, `.splash-title`) | Évite les collisions entre écrans |
| **Animations en `@keyframes`**, jamais via JS timer | Performance + fluide |
| **`clamp()` pour les tailles** plutôt que media queries quand possible | Responsive plus naturel |
| **Pas de `!important`** | Cassure de la cascade, à éviter |
| **Pas de CSS inline dans le TypeScript** | Tout dans les `.css` |

---

## 10. Liens utiles

- 🎨 [`docs/DESIGN.md`](./DESIGN.md) — Palette, typo, tokens, références visuelles
- 🏗️ [`README.md`](../README.md) — Stack technique complète, structure du projet, CI/CD
- 🔁 [`docs/state-machine.md`](./state-machine.md) — Comment les écrans s'enchaînent
- 🌐 [`docs/match-sync-architecture.md`](./match-sync-architecture.md) — Synchro back ↔ 3 apps front
- 🐛 [Issues GitHub front](https://github.com/fouuuadi/Flipper_front/issues) — Bugs / features à attaquer
- 🐳 [Repo back](https://github.com/fouuuadi/Flipper_back) — Le serveur (à lancer en Docker si besoin)

---

## 11. Bloqué ? Quelque chose ne marche pas ?

- **`npm install` plante** → vérifie que Node est en v20+, supprime
  `node_modules/` et `package-lock.json`, relance `npm install`.
- **`localhost:5173/` renvoie 404** → normal, tape l'URL complète :
  `http://localhost:5173/apps/playfield/index.html`. Le projet est un
  multi-entry Vite, pas de page à la racine.
- **Vite démarre sur un autre port que 5173** (5174, 5175…) → un autre projet
  ou un container Docker tient déjà 5173. Soit tu l'arrêtes, soit tu utilises
  le port que Vite t'affiche. Tu peux aussi forcer un port précis :
  `npm run dev -- --port 5180`.
- **L'app affiche une page blanche** → ouvre les devtools (F12), va dans
  l'onglet Console pour voir l'erreur.
- **Le back ne répond pas** → vérifie que Docker tourne (`docker ps`), que les
  containers sont up (`docker compose ps`), et que le port 8080 n'est pas pris
  par autre chose.
- **Le hot reload ne marche plus** → relance `npm run dev` (Ctrl+C puis
  recommence).
- **Conflit Git en pullant `main`** → demande de l'aide avant de tout résoudre
  toi-même, surtout si tu as plusieurs commits en cours.
