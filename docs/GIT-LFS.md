# Git LFS — modèles 3D (à lire par toute l'équipe)

> **TL;DR** : avant de cloner le projet ou de committer un modèle 3D (`.glb`,
> `.gltf`, `.fbx`, `.bin`), installe Git LFS une fois :
>
> ```bash
> brew install git-lfs   # macOS  (ou: sudo apt install git-lfs)
> git lfs install        # une fois par machine
> ```
>
> Sans ça, tes modèles 3D vont alourdir le repo pour tout le monde, et le
> filtre LFS sera silencieusement ignoré.

---

## 1. Le problème qu'on a rencontré

Le modèle de la table (`public/models/tableMarioGalaxy.glb`, **~71 Mo**) a été
ajouté au repo comme un fichier normal, puis remplacé par une nouvelle version.

Git est fait pour du **code texte** : quand tu modifies une ligne, il stocke
juste la différence (quelques octets). Mais pour un **fichier binaire** comme un
`.glb`, Git ne sait pas faire de "diff" — il garde une **copie complète à chaque
version**, pour toujours, dans l'historique.

Concrètement, ce qui s'est passé :

```
Ajout du modèle v1      → +71 Mo dans l'historique
Remplacement par v2     → +71 Mo dans l'historique  (la v1 reste !)
                          ─────────────────────────
                          ~150 Mo de binaire permanent
```

Et ces ~150 Mo, **tout le monde les télécharge à chaque `git clone`** — même
quelqu'un qui ne touche qu'au CSS. À chaque future version du modèle, +71 Mo
s'ajoutent définitivement. Au bout de 10 versions → ~700 Mo dans le repo.

## 2. C'est quoi Git LFS

**Git LFS (Large File Storage)** est une extension de Git pour gérer les gros
binaires proprement.

Au lieu de mettre le gros fichier dans l'historique Git, LFS le remplace par un
**petit pointeur texte** (~130 octets) :

```
version https://git-lfs.github.com/spec/v1
oid sha256:4d7a3b...
size 74810640
```

- Le **vrai fichier binaire** est stocké à part (sur le serveur LFS de GitHub).
- **Git ne voit que le pointeur** → l'historique reste léger.
- Au `clone` / `checkout`, LFS télécharge **uniquement la version dont tu as
  besoin** (la dernière), pas tout l'historique des versions.

| | Sans LFS (avant) | Avec LFS |
|---|---|---|
| Poids dans l'historique git | ~150 Mo et ça grossit | quelques Ko (pointeurs) |
| Ce que télécharge un `clone` | toutes les versions | juste la version actuelle |
| Modifier le modèle 10× | +700 Mo permanents | le `.git` reste léger |

## 3. Ce qu'on a mis en place

Un fichier **`.gitattributes`** à la racine qui dit à Git : "ces formats passent
par LFS" :

```
*.glb  filter=lfs diff=lfs merge=lfs -text
*.gltf filter=lfs diff=lfs merge=lfs -text
*.fbx  filter=lfs diff=lfs merge=lfs -text
*.bin  filter=lfs diff=lfs merge=lfs -text
```

À partir de maintenant, **toute nouvelle version** d'un modèle committée passe
automatiquement par LFS au lieu d'alourdir l'historique.

> ℹ️ Les images UI (`.png`, `.jpg`) ne sont **volontairement pas** en LFS : ce
> sont de petits fichiers, ils restent en Git normal.

## 4. Ce que TU dois faire (chaque membre, une seule fois)

Le `.gitattributes` ne suffit pas tout seul : **Git LFS doit être installé sur
ta machine**, sinon le filtre est ignoré et ton `.glb` repart en fichier normal
(le problème qu'on essaie d'éviter).

```bash
# 1. Installer Git LFS
brew install git-lfs        # macOS
sudo apt install git-lfs    # Debian / Ubuntu

# 2. L'activer (une fois par machine, tous projets confondus)
git lfs install
```

C'est tout. Ensuite, quand tu committes un modèle, ça part en LFS sans rien
faire de plus.

### Vérifier que ça marche

Après avoir `git add` un modèle :

```bash
git lfs status      # doit lister ton .glb comme "LFS"
git lfs ls-files    # liste les fichiers gérés par LFS
```

## 5. Choix qu'on a faits (et pourquoi)

- **On n'a PAS nettoyé l'historique existant.** Les ~150 Mo déjà présents
  restent là. Les nettoyer demanderait de **réécrire tout l'historique git**
  (`git lfs migrate`), ce qui change tous les identifiants de commits et oblige
  **toute l'équipe à re-cloner**. Trop coûteux pour le bénéfice → on l'accepte.
- **On arrête juste l'hémorragie** : les futures versions n'alourdiront plus le
  repo. Si un jour l'historique devient vraiment gênant, on pourra faire le
  nettoyage à ce moment-là (opération à coordonner).

## 6. Pièges fréquents

| Symptôme | Cause | Solution |
|---|---|---|
| Mon `.glb` fait 71 Mo dans le diff git | Git LFS pas installé quand tu as commité | `git lfs install` puis re-add le fichier |
| `git clone` ne télécharge pas le `.glb` (juste un pointeur texte) | LFS pas installé avant le clone | `git lfs install` puis `git lfs pull` |
| "This repository is over its data quota" | Quota LFS GitHub dépassé (plan gratuit : 1 Go stockage + 1 Go/mois de bande passante) | Voir avec l'admin du repo |

## 7. Pour aller plus loin

- Doc officielle : <https://git-lfs.com>
- Le `.gitattributes` à la racine du repo (la config effective)
- Section "Assets 3D & Git LFS" du [`README.md`](../README.md)
