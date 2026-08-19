variable "project_name" {
  description = "Project name"
  type        = string
  default     = "faretrack"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be dev or prod."
  }
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "price_check_schedule" {
  description = "EventBridge price check schedule"
  type        = string
  default     = "rate(3 hours)"
}

variable "ses_from_email" {
  description = "SES verified sender address; leave empty to record notifications without sending email"
  type        = string
  default     = ""
}

variable "price_tracking_enabled" {
  description = "Whether EventBridge should run scheduled flight price checks"
  type        = bool
  default     = false
}

variable "google_client_id" {
  description = "Google OAuth web application client ID"
  type        = string
}

variable "google_client_secret" {
  description = "Google OAuth web application client secret"
  type        = string
  sensitive   = true
}

variable "kakao_client_id" {
  description = "Kakao REST API key used as the OIDC client ID"
  type        = string
}

variable "kakao_client_secret" {
  description = "Kakao client secret; enable it in Kakao Developers"
  type        = string
  sensitive   = true
}

variable "android_auth_callback_url" {
  description = "Android deep link that receives the Cognito authorization response"
  type        = string
  default     = "faretrack://auth/callback"
}

variable "android_auth_logout_url" {
  description = "Android deep link used after Cognito logout"
  type        = string
  default     = "faretrack://auth/signout"
}

variable "api_allowed_origins" {
  description = "Origins allowed by the HTTP API CORS policy"
  type        = list(string)
  default     = ["*"]
}

variable "log_retention_days" {
  description = "CloudWatch log retention period"
  type        = number
  default     = 14
}

variable "monitoring_alert_email" {
  description = "Email address that receives CloudWatch alarms; leave empty to disable email delivery"
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost budget in USD"
  type        = number
  default     = 10

  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "Monthly budget must be greater than zero."
  }
}
