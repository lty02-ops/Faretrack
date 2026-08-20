provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
      Purpose   = "bootstrap"
    }
  }
}

data "aws_caller_identity" "current" {}
