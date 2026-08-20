output "terraform_state_bucket" {
  value       = aws_s3_bucket.terraform_state.id
  description = "S3 bucket used by the application Terraform backend"
}

output "github_deploy_role_arn" {
  value       = aws_iam_role.github_deploy.arn
  description = "Set this as the GitHub repository variable AWS_DEPLOY_ROLE_ARN"
}
