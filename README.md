# Faretrack

Faretrack은 Android에서 항공권 가격을 검색하고 목표 가격 또는 가격 하락 조건에 도달했을 때 이메일 알림을 보내는 서버리스 애플리케이션입니다.

## Architecture

- Android: Kotlin
- Authentication: Amazon Cognito, Google, Kakao OIDC
- API: Amazon API Gateway HTTP API
- Compute: AWS Lambda (Node.js)
- Database: Amazon DynamoDB
- Scheduling: Amazon EventBridge
- Messaging: Amazon SQS and DLQ
- Notifications: Amazon SES
- Secrets: AWS Secrets Manager
- Monitoring: Amazon CloudWatch and SNS
- Infrastructure: Terraform

```text
Android -> Cognito -> API Gateway -> API Lambda -> DynamoDB

EventBridge -> Scheduler Lambda -> Price Check SQS
            -> Price Worker Lambda -> Notification SQS
            -> Notification Lambda -> SES
```

## Requirements

- Node.js 20 or later
- Terraform 1.6 or later
- AWS CLI
- Android Studio
- Google OAuth application
- Kakao application with OIDC enabled

## Backend Tests

```powershell
npm.cmd install
npm.cmd test
```

## Lambda Package

```powershell
npm.cmd run lambda:build
```

The deployment package is generated at `dist/faretrack-lambda.zip` and is not committed.

## Terraform

Set social login credentials through environment variables. Do not commit real client secrets or API keys.

```powershell
$env:TF_VAR_google_client_id="..."
$env:TF_VAR_google_client_secret="..."
$env:TF_VAR_kakao_client_id="..."
$env:TF_VAR_kakao_client_secret="..."
$env:TF_VAR_ses_from_email="..."
$env:TF_VAR_monitoring_alert_email="..."

cd infra\terraform
terraform init
terraform plan -var-file="environments/dev.tfvars"
```

After reviewing the plan:

```powershell
terraform apply -var-file="environments/dev.tfvars"
```

Store the SerpApi credential in the Secrets Manager secret created by Terraform. Terraform creates the secret container but does not commit or upload the secret value.

## Repository Safety

The following files are intentionally excluded from Git:

- `.env` files
- Terraform state, plans, and `.terraform/`
- Lambda deployment archives
- Android signing keys and `google-services.json`
- Android and Node.js build outputs

Additional design and API documentation is available in `docs/`. Architecture diagrams are stored in `image/`.
