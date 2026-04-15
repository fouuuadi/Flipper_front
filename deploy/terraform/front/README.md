# Terraform Front

Cette stack Terraform gère l'infrastructure Kubernetes de base pour le périmètre frontend.

## Ressources gérées

- Namespace de staging (`flipper-staging` par défaut)
- Namespace de production (`flipper-prod` par défaut)

## Commandes

```bash
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
```

Pour exécuter un vrai `plan/apply`, utilisez un contexte kubeconfig valide avec accès au cluster.
