output "staging_namespace_name" {
  description = "Name of the managed staging namespace."
  value       = try(kubernetes_namespace_v1.staging[0].metadata[0].name, null)
}

output "prod_namespace_name" {
  description = "Name of the managed production namespace."
  value       = try(kubernetes_namespace_v1.prod[0].metadata[0].name, null)
}
