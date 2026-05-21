# 🎮 Mario Galaxy Pinball — Design System

> Référence visuelle et UX du projet. Toute évolution du design passe par une mise à jour de ce document.
> Lié à l'issue [#74](https://github.com/fouuuadi/Flipper_front/issues/74).

---

## 🌌 Direction artistique

Le projet adopte une direction artistique inspirée de :

- Super Mario Galaxy
- Arcades rétro modernes
- Univers spatial néon
- Interfaces sci-fi stylisées

L'objectif est d'obtenir une interface :

- immersive
- lisible
- moderne
- lumineuse
- responsive
- cohérente avec le gameplay arcade

---

## 🎨 Palette de couleurs

| Nom            | Couleur   | Usage                       |
| -------------- | --------- | --------------------------- |
| Deep Space     | `#0A0520` | Fond principal              |
| Galaxy Purple  | `#1A0B3D` | Dégradés secondaires        |
| Neon Red       | `#FF4757` | Mario                       |
| Neon Orange    | `#FFA502` | Mario / boutons             |
| Neon Yellow    | `#FFD93D` | Highlights                  |
| Neon Green     | `#6BCF7F` | Effets bonus                |
| Neon Lime      | `#00FF41` | Glow lettres GALAXY         |
| Neon Blue      | `#4D9FFF` | Effets Galaxy               |
| Neon Cyan      | `#00D4FF` | Glow principal              |
| Neon Pink      | `#FF3366` | Effets visuels              |

---

## 🌈 Style visuel

Le style repose principalement sur :

- contours néon
- glow effects
- transparence légère
- fond spatial animé
- planètes flottantes
- couleurs saturées
- interface arcade moderne

Le rendu doit rester :

- stylisé
- propre
- lisible
- performant

---

## ✍️ Typographie

### Principale

```css
font-family: 'Bungee', sans-serif;
```

Utilisée pour :

- logo
- gros titres
- branding

### Secondaire

```css
font-family: 'Orbitron', sans-serif;
```

Utilisée pour :

- HUD
- DMD
- boutons
- score
- texte UI

---

## 🪐 Background

Le fond utilise :

- dégradés radiaux
- couche étoilée animée
- ambiance spatiale sombre

### Structure

```css
background:
  radial-gradient(...),
  radial-gradient(...),
  #0A0520;
```

---

## ✨ Glow system

Le glow est l'élément central de la direction artistique.

### Méthode utilisée

```css
filter:
  drop-shadow(...)
  drop-shadow(...)
  drop-shadow(...);
```

### Couleurs de glow

| Type   | Couleur          |
| ------ | ---------------- |
| Mario  | Rouge / Orange   |
| Galaxy | Cyan / Vert      |
| FX     | Rose / Bleu      |
| UI     | Blanc / Cyan     |

---

## 🌍 Planètes

Les planètes servent principalement :

- d'ambiance visuelle
- de décoration
- de rappel Mario Galaxy

### Style

Chaque planète possède :

- `radial-gradient`
- glow externe
- ombrage interne
- animation flottante

### Exemple

```css
background:
  radial-gradient(circle at 30% 30%, #ff8c42, #ff6b1a);
```

---

## ⭐ Étoiles

Le fond étoilé est généré avec `radial-gradient()` répété plusieurs fois.

### Animation

```css
@keyframes twinkle { /* ... */ }
```

Effet :

- scintillement léger
- ambiance spatiale vivante

---

## 🎬 Animations

### Float

Animation utilisée pour :

- planètes
- objets flottants
- éléments Galaxy

```css
@keyframes float { /* ... */ }
```

### Pulse glow

Animation utilisée pour :

- texte PINBALL
- boutons
- prompts
- éléments interactifs

```css
@keyframes pulse-glow { /* ... */ }
```

### Rise in

Animation d'apparition du logo.

```css
@keyframes rise-in { /* ... */ }
```

---

## 🎮 Menu principal

### Structure

```
MARIO
GALAXY
PINBALL
PRESS A
```

### Ambiance recherchée

- borne arcade moderne
- écran d'introduction Nintendo-like
- univers spatial immersif

---

## 🔘 UI / Boutons

Les boutons devront utiliser :

- fond semi-transparent
- border glow
- hover scale
- Orbitron
- effet néon léger

### Style recommandé

```css
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(12px);
border: 2px solid rgba(255, 255, 255, 0.1);
```

---

## 📺 HUD in-game

Doit afficher :

- score
- nombre de billes
- multiplicateur
- mode spécial
- boss mode
- notifications

---

## 📟 DMD style

Le DMD doit rappeler :

- les vrais flippers
- les écrans rétro LED

### Style conseillé

```css
background: #111;
color: #ff9900;
font-family: 'Orbitron', sans-serif;
```

---

## 🌌 Ambiance générale

Le jeu doit donner la sensation **d'un flipper arcade spatial moderne inspiré de Mario Galaxy**.

Le rendu ne doit **pas** être :

- photoréaliste
- ultra complexe
- surchargé

L'identité visuelle repose principalement sur :

- les couleurs
- le glow
- les animations
- l'ambiance spatiale
- le style arcade

---

## ⚙️ Stack frontend recommandée

### UI

- HTML
- CSS
- JavaScript / TypeScript

### 3D

- Three.js
- Rapier

---

## 🧠 UX guidelines

### Toujours privilégier

- ✅ lisibilité
- ✅ gros éléments UI
- ✅ animations fluides
- ✅ contrastes élevés
- ✅ feedback visuel rapide

### Éviter

- ❌ surcharge visuelle
- ❌ trop de texte
- ❌ menus complexes
- ❌ effets excessifs

---

## ✨ Direction finale

Le projet doit ressembler à :

> Mario Galaxy + Arcade moderne + Neon sci-fi + Flipper rétro futuriste

Avec une interface :

- immersive
- lumineuse
- stylisée
- performante
