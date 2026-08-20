# Faretrack cloud deployment

The AWS resources are currently destroyed. Run these steps only when cloud deployment is needed again.

## 1. Create the remote state and GitHub OIDC role

The bootstrap state remains local because it creates the remote state bucket itself.

```bash
cd infra/bootstrap
terraform init
terraform apply
terraform output
```

Set the `github_deploy_role_arn` output as the GitHub repository variable `AWS_DEPLOY_ROLE_ARN`.

The state bucket has versioning, encryption, blocked public access, and `prevent_destroy`. Application state uses S3 native lock files.

## 2. Configure GitHub

Create the `dev` GitHub environment and optionally require manual approval. Add these environment secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `KAKAO_CLIENT_ID`
- `KAKAO_CLIENT_SECRET`
- `SES_FROM_EMAIL`
- `MONITORING_ALERT_EMAIL`

No long-lived AWS access key is required. Run the **Deploy dev** workflow manually from GitHub Actions.

## 3. Deploy locally instead

```bash
bash backend/scripts/buildLambda.sh
cd infra/terraform
terraform init -reconfigure -backend-config=environments/dev.backend.hcl
terraform plan -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
```

Do not put OAuth secrets in `.tfvars` files committed to Git. Use `TF_VAR_*` environment variables or GitHub environment secrets.

## 4. Enable SerpApi

Terraform creates the secret container but intentionally does not store the API key in state. After deploying the secret, set its value:

```bash
aws secretsmanager put-secret-value \
  --region ap-northeast-2 \
  --secret-id faretrack-dev/serpapi \
  --secret-string '{"apiKey":"REPLACE_WITH_SERPAPI_KEY"}'
```

Change `price_tracking_enabled` to `true` in `environments/dev.tfvars` only after the key is present, then redeploy. The default remains `false` to prevent unintended paid requests.

## 5. Configure SES

Set `SES_FROM_EMAIL` to a real sender address and apply Terraform. Open the AWS verification email and confirm it. While the account is in the SES sandbox, recipient addresses must also be verified. Request production access in the SES console only when sending to arbitrary users is required.

The Lambda role can send only from the Terraform-managed SES identity when an address is configured.

## 6. Test social login

After deployment, copy these Terraform outputs into the Android build configuration:

```bash
terraform output api_base_url
terraform output cognito_android_client_id
terraform output cognito_hosted_ui_domain
```

Confirm the provider callbacks remain:

- Google and Kakao: `https://<cognito-domain>/oauth2/idpresponse`
- Android sign-in: `faretrack://auth/callback`
- Android sign-out: `faretrack://auth/signout`

Install a debug APK, sign in once with Google and once with Kakao, call a protected API, sign out, and verify the access token is removed. Google test-mode users must be listed in the OAuth consent screen until the app is published.
