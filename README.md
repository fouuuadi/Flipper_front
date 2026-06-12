# Flipper Virtuel — Frontend

Application frontend du flipper virtuel, construite avec Vite + TypeScript.

Le projet est organisé en architecture modulaire par feature et contient actuellement le socle 3D/physique du playfield (table, bille, flippers, murs/rails/lane), avec WebSocket prêt pour la communication serveur.

---

## Assets 3D & Git LFS

> ⚠️ **À faire une fois avant de cloner / committer des modèles 3D.**

Les modèles 3D (`.glb`, `.gltf`, `.fbx`, `.bin`) sont versionnés via **Git LFS**
(cf. `.gitattributes`). Ce sont des binaires de plusieurs dizaines de Mo : sans
LFS, chaque version reste dans l'historique git et alourdit chaque clone pour
toute l'équipe.

Installe Git LFS une fois sur ta machine :

```bash
# macOS
brew install git-lfs
# Debian/Ubuntu
sudo apt install git-lfs

# puis, une fois par machine :
git lfs install
```

**Si tu committes un `.glb` sans avoir fait `git lfs install`**, le filtre est
silencieusement ignoré et le binaire repart en blob git normal (ce qu'on veut
éviter). En cas de doute : `git lfs status` après avoir stagé ton fichier.

> Note : la version actuelle de `tableMarioGalaxy.glb` reste un blob git normal
> (présente dans l'historique avant la mise en place de LFS — non migrée pour
> éviter une réécriture d'historique). Le `.gitattributes` capture uniquement
> les **futures** versions, ce qui suffit à empêcher l'historique de grossir.

---

## Démarrage rapide

### En local (Node)

```bash
# Installer les dépendances
npm install

# Développement
npm run dev

# Build production
npm run build

# Lint
npm run lint
npm run lint:fix

# Formatage
npm run format
npm run format:check
```

### En local (Docker, 3 services)

Le front est packagé en **trois images nginx indépendantes** — une par écran physique du flipper (playfield, backglass, dmd). Chaque image embarque le même bundle Vite mais sert une page HTML différente via une nginx conf dédiée (`nginx/<app>.conf`).

```bash
# Build + run des 3 services
docker compose up --build
```

| Service     | URL                     | Entrée                       |
| ----------- | ----------------------- | ---------------------------- |
| `playfield` | http://localhost:8081   | `apps/playfield/index.html`  |
| `backglass` | http://localhost:8082   | `apps/backglass/index.html`  |
| `dmd`       | http://localhost:8083   | `apps/dmd/index.html`        |

Sous le capot, chaque service construit la même image à partir du `Dockerfile` paramétré par l'argument `APP` (cf. `docker-compose.yml`).

---

## Structure du projet

```text
src/
├── config/             # Configuration applicative typée (env)
├── core/               # Noyau (EventBus, GameState, Store)
├── engine/             # Orchestration rendu (SceneManager)
├── physics/            # Adaptateurs physiques (Rapier + abstractions)
├── modules/            # Features métier
│   ├── ball/
│   ├── flipper/
│   ├── playfield/
│   ├── table/
│   ├── backglass/      # Placeholder (à implémenter)
│   └── dmd/            # Placeholder (à implémenter)
├── services/           # Services techniques (WebSocket)
├── styles/
├── utils/
├── main.ts
└── style.css
```

---

## Principes d’architecture (cible pro)

- Un module = un dossier sous `src/modules/<feature>/`.
- Chaque module expose son API publique via `index.ts` (barrel export).
- Les imports inter-modules passent via aliases (`@modules/...`) et jamais via chemins relatifs profonds.
- La communication transverse passe par `core` (`EventBus`) ou `services`, pas par couplage direct.
- `main.ts` orchestre, les modules implémentent.

### Convention recommandée par module

```text
src/modules/<feature>/
├── <Feature>.ts        # Implémentation principale
├── <feature>.types.ts  # (optionnel) types du module
└── index.ts            # API publique du module
```

---

## État des modules

| Module       | État          | Rôle |
| ------------ | ------------- | ---- |
| `playfield`  | Implémenté    | Surface 3D inclinée de la table |
| `ball`       | Implémenté    | Bille dynamique + synchronisation physics/render |
| `flipper`    | Implémenté    | Flippers contrôlables clavier |
| `table`      | Implémenté    | Murs, rails, bordures, lane du lanceur |
| `backglass`  | À venir       | Affichage score/animations |
| `dmd`        | À venir       | Affichage dot-matrix |

---

## Environnement

Variables Vite (`VITE_*`) utilisées via `src/config/env.ts` :

| Variable            | Description |
| ------------------- | ----------- |
| `VITE_API_BASE_URL` | URL API serveur |
| `VITE_WS_URL`       | URL WebSocket serveur |
| `VITE_APP_TITLE`    | Titre application |

Exemple :

```ts
import { env } from "@config/env";
console.log(env.wsUrl, env.isDev);
```

---

## Aliases de chemin

| Alias         | Répertoire |
| ------------- | ---------- |
| `@core/*`     | `src/core/*` |
| `@engine/*`   | `src/engine/*` |
| `@config/*`   | `src/config/*` |
| `@modules/*`  | `src/modules/*` |
| `@physics/*`  | `src/physics/*` |
| `@services/*` | `src/services/*` |
| `@utils/*`    | `src/utils/*` |

---

## Qualité de code

- TypeScript strict (`tsconfig.json`)
- ESLint flat config (`eslint.config.js`)
- Prettier (`format` / `format:check`)

---

## Stack technique actuelle

| Technologie | Version (repo) | Rôle |
| ----------- | -------------- | ---- |
| Vite        | `^6.0.0`       | Bundler / dev server |
| TypeScript  | `~5.9.3`       | Typage statique |
| Three.js    | `^0.183.1`     | Rendu 3D |
| Rapier 3D   | `^0.19.3`      | Physique |
| ESLint      | `^9.37.0`      | Lint |
| Prettier    | `^3.6.2`       | Formatage |

---

## CI/CD et déploiement

Le pipeline frontend est maintenant découpé en plusieurs workflows GitHub Actions complémentaires.

- Qualité PR:
  - `.github/workflows/front-pr-quality.yml` (format, lint, type-check, build)
  - `.github/workflows/front-pr-security.yml` (Gitleaks + Trivy fs)
  - `.github/workflows/terraform-pr-check.yml` (Terraform fmt/init/validate)
  - `.github/workflows/iac-pr-checkov.yml` (scan IaC Terraform + Kubernetes)
- Release main:
  - `.github/workflows/front-main-release.yml` (build image, scan Trivy, push GHCR)
  - `.github/workflows/terraform-main-plan.yml` (qualité Terraform + plan conditionnel)
- GitOps:
  - `.github/workflows/front-gitops-update-staging.yml` (mise à jour auto du tag staging)
  - `.github/workflows/front-gitops-promote-prod.yml` (promotion manuelle en prod)

### Secret GitHub à prévoir

- `TF_FRONT_KUBECONFIG_B64` (optionnel mais recommandé): kubeconfig encodé en base64 pour activer le `terraform plan` dans le workflow main Terraform.

### Manifests de déploiement

- Kubernetes: `deploy/k8s/base` + `deploy/k8s/overlays/{staging,prod}`
- ArgoCD: `deploy/argocd/front-staging-application.yaml` et `deploy/argocd/front-prod-application.yaml`

En pratique, la chaîne est la suivante: merge sur `main` → image frontend publiée sur GHCR → tag staging mis à jour dans les manifests GitOps → ArgoCD synchronise l’environnement staging. La promotion production reste une action volontaire via workflow manuel.

---

