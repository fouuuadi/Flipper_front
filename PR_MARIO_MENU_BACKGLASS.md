# PR - Integration Mario Menu, Backglass, Audio et UI

## Explication rapide pour l'equipe

Cette PR integre le prototype `Mario_Menu` dans le vrai projet Vite/TypeScript.
Avant, le design du menu, de la boutique et des assets etait dans un dossier separe.
Maintenant, les ecrans sont branches dans l'architecture du projet avec la state machine, le `ScreenRouter`, les modules `src/modules/*`, et les assets ranges dans `public/`.

Le flow principal devient :

1. Splash Mario Galaxy
2. Appui sur n'importe quelle touche, meme si le visuel indique `A`
3. Menu 3D avec le monde `super_mario_galaxy_mushroom_kingdom.glb` et `mario_idle.glb`
4. Boutons 3D :
   - `JOUER` -> ecran pseudo / choix du mode
   - `LEADERBOARD` -> classement
   - `BOUTIQUE COSMETIQUE` -> boutique
   - `PARAMETRES` -> reglages audio
   - `QUITTER` -> retour au splash

Le backglass a aussi le meme debut de flow : splash, menu 3D, identification. Ensuite, quand les joueurs sont valides, le backglass affiche son HUD existant avec score, vies, timer, etc.

## Description

Integration complete du menu Mario Galaxy dans le projet principal, ajout des ecrans boutique/parametres, amelioration du leaderboard, ajout de l'audio de menu, persistance de l'ecran courant au refresh, et adaptation du backglass au nouveau flow.

## Issue liee

Closes #

## Type de changement

- [x] Feature
- [x] Bug fix
- [x] Refactor
- [x] Chore
- [x] Documentation

## Modifications principales

- Remplacement de l'ancien menu par un menu 3D integre en TypeScript.
- Ajout des assets GLB dans `public/models/menu/`.
- Ajout des assets boutique dans `public/images/cosmetics/`.
- Ajout des sons de menu dans `public/audio/Menu/`.
- Ajout de l'ecran boutique cosmetique dans `src/modules/cosmetics/`.
- Ajout de l'ecran parametres dans `src/modules/settings/`.
- Ajout du service audio `src/services/menuAudio.ts`.
- Ajout du controle de volume musique/SFX et mute via les parametres.
- Ajout du leaderboard avec un style inspire des classements Mario Kart.
- Refonte de l'ecran pseudo avec un theme galaxy plus sobre.
- Ajout d'un bouton retour sur l'ecran pseudo.
- Le bouton `QUITTER` du menu renvoie maintenant vers le splash.
- Ajout de nouveaux etats dans la state machine :
  - `cosmetics`
  - `settings`
- Ajout du nouvel event :
  - `BACK_TO_SPLASH`
- Ajout de la persistance de l'ecran courant avec `sessionStorage`.
- Integration du flow splash/menu/identification dans le backglass.
- Ajout de raccourcis clavier :
  - `Enter` : jouer depuis le menu
  - `L` : leaderboard
  - `B` : boutique
  - `P` : parametres
  - `Escape` : retour selon l'ecran courant
- Exclusion du dossier prototype `Mario_Menu/**` dans ESLint, car ce dossier contient du JS prototype non destine a etre lint par le projet.

## Details audio

- `HeticGalaxy.mp3` se lance sur le splash et ne loop pas.
- `SMG_Menu.mp3` se lance sur le menu et les ecrans secondaires.
- La musique du menu loop.
- Le volume musique est reglable dans les parametres.
- Le mute musique est sauvegarde.
- Les valeurs sont stockees dans `localStorage`.
- Le navigateur peut bloquer l'audio avant interaction utilisateur. Le service retente donc la lecture apres le premier clic ou appui clavier.

## Details backglass

Le backglass utilise maintenant le meme debut de navigation que le playfield :

1. Splash
2. Menu 3D
3. Identification
4. HUD backglass existant

Le HUD d'origine n'a pas ete supprime. Il est simplement monte apres validation des joueurs.

## Tests

- [x] Test manuel effectue
- [x] Tests unitaires passent
- [x] Aucun warning / erreur lint bloquant

Commandes lancees :

```bash
npm.cmd run lint
npm.cmd run lint:fix
npm.cmd run format
npm.cmd run format:check
npm.cmd run build
npm.cmd test
```

Resultat :

- Build OK
- Lint OK
- Format OK
- Tests OK
- `205 passed`

Note Windows :

`npm run ...` peut etre bloque par PowerShell a cause de `npm.ps1`.
Utiliser plutot :

```bash
npm.cmd run lint
npm.cmd run build
npm.cmd test
```

## Preuve frontend

Screenshots / GIF a ajouter dans la PR :

- Splash Mario Galaxy
- Menu 3D
- Ecran pseudo avec bouton retour
- Boutique cosmetique
- Leaderboard
- Parametres audio
- Backglass apres identification

## Checklist finale

- [x] Le code compile
- [x] Les tests passent
- [x] Le lint passe
- [x] Le format est OK
- [x] Aucun commit inutile a ajouter volontairement
- [x] La PR est propre et comprehensible

## Points d'attention

- L'autoplay audio peut dependre du navigateur. Le son du splash est tente au montage, puis relance apres interaction si le navigateur l'a bloque.
- Les chunks Vite affichent encore un warning de taille, lie aux assets/Three.js. Ce n'est pas une erreur bloquante.
