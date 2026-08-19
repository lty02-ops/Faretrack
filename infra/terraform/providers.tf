provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "faretrack"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
