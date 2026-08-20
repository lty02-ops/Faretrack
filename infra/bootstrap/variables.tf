variable "project_name" {
  description = "Project name"
  type        = string
  default     = "faretrack"
}

variable "region" {
  description = "AWS region for the Terraform state bucket"
  type        = string
  default     = "ap-northeast-2"
}

variable "github_repository" {
  description = "GitHub repository in owner/name format"
  type        = string
  default     = "lty02-ops/Faretrack"
}
