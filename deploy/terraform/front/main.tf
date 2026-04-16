locals {
  common_labels = merge(
    {
      "app.kubernetes.io/part-of"    = var.project_name
      "app.kubernetes.io/component"  = "frontend"
      "app.kubernetes.io/managed-by" = "terraform"
    },
    var.extra_labels
  )
}

resource "kubernetes_namespace_v1" "staging" {
  count = var.create_staging_namespace ? 1 : 0

  metadata {
    name = var.staging_namespace
    labels = merge(local.common_labels, {
      environment = "staging"
    })
  }
}

resource "kubernetes_namespace_v1" "prod" {
  count = var.create_prod_namespace ? 1 : 0

  metadata {
    name = var.prod_namespace
    labels = merge(local.common_labels, {
      environment = "prod"
    })
  }
}
