output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.faretrack.id
}

output "cognito_android_client_id" {
  description = "Public Cognito app client ID for the Android application"
  value       = aws_cognito_user_pool_client.android.id
}

output "cognito_issuer" {
  description = "JWT issuer used by API Gateway"
  value       = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.faretrack.id}"
}

output "cognito_hosted_ui_domain" {
  description = "Cognito managed login domain"
  value       = "https://${aws_cognito_user_pool_domain.faretrack.domain}.auth.${var.region}.amazoncognito.com"
}

output "social_provider_callback_url" {
  description = "Callback URL to register in Google and Kakao developer consoles"
  value       = "https://${aws_cognito_user_pool_domain.faretrack.domain}.auth.${var.region}.amazoncognito.com/oauth2/idpresponse"
}

output "api_base_url" {
  description = "Base URL used by the Android application"
  value       = aws_apigatewayv2_api.faretrack.api_endpoint
}

output "monitoring_alert_topic_arn" {
  description = "SNS topic used by CloudWatch alarms"
  value       = aws_sns_topic.monitoring_alerts.arn
}

output "monthly_budget_name" {
  description = "AWS monthly cost budget name"
  value       = aws_budgets_budget.monthly.name
}
