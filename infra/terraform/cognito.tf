data "aws_caller_identity" "current" {}

resource "aws_cognito_user_pool" "faretrack" {
  name = "${local.name_prefix}-users"

  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = local.common_tags
}

resource "aws_cognito_user_pool_domain" "faretrack" {
  domain       = "${local.name_prefix}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.faretrack.id
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.faretrack.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    authorize_scopes = "openid email profile"
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
  }

  attribute_mapping = {
    email          = "email"
    email_verified = "email_verified"
    name           = "name"
    username       = "sub"
  }
}

resource "aws_cognito_identity_provider" "kakao" {
  user_pool_id  = aws_cognito_user_pool.faretrack.id
  provider_name = "Kakao"
  provider_type = "OIDC"

  provider_details = {
    attributes_request_method = "GET"
    authorize_scopes          = "openid profile_nickname"
    client_id                 = var.kakao_client_id
    client_secret             = var.kakao_client_secret
    oidc_issuer               = "https://kauth.kakao.com"
  }

  attribute_mapping = {
    name     = "nickname"
    username = "sub"
  }
}

resource "aws_cognito_user_pool_client" "android" {
  name         = "${local.name_prefix}-android"
  user_pool_id = aws_cognito_user_pool.faretrack.id

  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  callback_urls                        = [var.android_auth_callback_url]
  logout_urls                          = [var.android_auth_logout_url]
  supported_identity_providers = [
    aws_cognito_identity_provider.google.provider_name,
    aws_cognito_identity_provider.kakao.provider_name
  ]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}
