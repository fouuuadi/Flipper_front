# Dev boot — accès direct au playfield (`?boot=playing`)

Raccourci de **développement** pour atterrir directement sur un état avancé de
la state machine sans dérouler tout le flow d'écrans à chaque reload.

## Pourquoi

Le canvas 3D (playfield) tourne en permanence en arrière-plan, mais il est
masqué par les overlays UI (splash, menu, identification…). L'état `playing`
est le **seul sans overlay** : c'est le seul moment où on voit le playfield
seul.

En temps normal, pour l'atteindre il faut : splash (n'importe quelle touche) →
menu (`Entrée`) → identification (remplir le pseudo + valider). Pénible quand
on veut juste tester la 3D.

## Usage

```bash
npm run dev
```

Puis ouvrir :

```
http://localhost:5173/apps/playfield/index.html?boot=playing
```

→ on arrive directement sur le playfield 3D. `Échap` bascule en pause (confirme
que la SM est bien en `playing`).

Sans le query param, l'app démarre normalement sur le splash.

Pour tester les écrans de navigation sans backend/WebSocket, ajouter
`sync=local` :

```
http://localhost:5173/apps/backglass/index.html?sync=local
http://localhost:5173/apps/backglass/index.html?boot=menu&sync=local
http://localhost:5173/apps/backglass/index.html?boot=identification&sync=local
```

Dans ce mode dev, les intentions normalement envoyées au backend sont rejouées
directement dans la state machine locale. Aucune connexion WebSocket n'est
ouverte.

## ⚠️ Dev-only

- C'est un **outil de dev**, pas le parcours utilisateur. Les joueurs passent
  toujours par splash → menu → identification.
- Le code est gardé derrière `import.meta.env.DEV`. En build de production
  (`npm run build`), Vite l'élimine (dead-code elimination) → le bypass
  **n'existe pas** en prod, l'URL `?boot=playing` y est sans effet.

## Comment ça marche

`src/core/devBoot.ts` enchaîne les transitions **légitimes** de la state
machine (`PRESS_A` → `START_GAME` → `PLAYERS_VALIDATED`) avec un joueur fictif
(`DEV#0001`, `mode: "solo"`, `sessionId: null`). Aucune mutation directe du
contexte : l'état reste cohérent (joueur, balles, timer). `sessionId: null` →
aucune connexion WebSocket déclenchée, ça marche hors-ligne.

L'appel se fait en première ligne de `bootstrap()` dans `src/main.ts`, avant
tout abonnement au store, pour que `MatchTimer` et `ScreenRouter` reçoivent
l'état cible dès leur `subscribe` initial.

## Étendre

Pour ajouter une cible (ex. `?boot=leaderboard`), ajouter un `case` dans le
`switch` de `applyDevBoot` qui envoie la séquence d'events menant à l'état
voulu.
