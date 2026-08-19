resource "aws_secretsmanager_secret" "serpapi" {
  name        = "${local.name_prefix}/serpapi"
  description = "SerpApi credentials for Faretrack price worker"

  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-serpapi-secret"
  })
}
