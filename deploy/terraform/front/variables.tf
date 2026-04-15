variable "kubeconfig_path" {
  description = "Path to kubeconfig used by Terraform."
  type        = string
  default     = "~/.kube/config"
}

variable "kubeconfig_context" {
  description = "Optional kubeconfig context to target."
  type        = string
  default     = null
}

variable "project_name" {
  description = "Project label value."
  type        = string
  default     = "flipper"
}

variable "staging_namespace" {
  description = "Namespace name for staging."
  type        = string
  default     = "flipper-staging"
}

variable "prod_namespace" {
  description = "Namespace name for production."
  type        = string
  default     = "flipper-prod"
}

variable "create_staging_namespace" {
  description = "Whether Terraform should manage staging namespace."
  type        = bool
  default     = true
}

variable "create_prod_namespace" {
  description = "Whether Terraform should manage production namespace."
  type        = bool
  default     = true
}

variable "extra_labels" {
  description = "Extra labels merged into namespace metadata."
  type        = map(string)
  default     = {}
}
