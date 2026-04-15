# Terraform Front

This Terraform stack manages the baseline Kubernetes infrastructure for the frontend scope.

## Managed resources

- Staging namespace (`flipper-staging` by default)
- Production namespace (`flipper-prod` by default)

## Commands

```bash
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
```

For a real plan/apply, use a valid kubeconfig context with cluster access.
