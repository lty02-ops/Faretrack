locals {
  lambda_runtime      = "nodejs22.x"
  lambda_package_path = "${path.module}/../../dist/faretrack-lambda.zip"

  lambda_common_environment = {
    NODE_ENV            = "production"
    REPOSITORY_TYPE     = "dynamodb"
    DYNAMODB_TABLE_NAME = aws_dynamodb_table.faretrack.name
  }
}

resource "aws_lambda_function" "api" {
  function_name    = "${local.name_prefix}-api"
  role             = aws_iam_role.api_lambda.arn
  handler          = "backend/src/handlers/api.handler"
  runtime          = local.lambda_runtime
  filename         = local.lambda_package_path
  source_code_hash = filebase64sha256(local.lambda_package_path)
  memory_size      = 512
  timeout          = 30

  environment {
    variables = local.lambda_common_environment
  }

  depends_on = [
    aws_iam_role_policy.api_lambda,
    aws_iam_role_policy_attachment.lambda_logs
  ]

  tags = local.common_tags
}

resource "aws_lambda_function" "scheduler" {
  function_name    = "${local.name_prefix}-scheduler"
  role             = aws_iam_role.scheduler_lambda.arn
  handler          = "backend/src/handlers/scheduler.handler"
  runtime          = local.lambda_runtime
  filename         = local.lambda_package_path
  source_code_hash = filebase64sha256(local.lambda_package_path)
  memory_size      = 256
  timeout          = 30

  environment {
    variables = merge(local.lambda_common_environment, {
      PRICE_CHECK_QUEUE_URL = aws_sqs_queue.price_check.url
    })
  }

  depends_on = [
    aws_iam_role_policy.scheduler_lambda,
    aws_iam_role_policy_attachment.lambda_logs
  ]

  tags = local.common_tags
}

resource "aws_lambda_function" "price_worker" {
  function_name    = "${local.name_prefix}-price-worker"
  role             = aws_iam_role.price_worker_lambda.arn
  handler          = "backend/src/handlers/priceWorker.handler"
  runtime          = local.lambda_runtime
  filename         = local.lambda_package_path
  source_code_hash = filebase64sha256(local.lambda_package_path)
  memory_size      = 512
  timeout          = 60

  environment {
    variables = merge(local.lambda_common_environment, {
      CACHE_TTL_MINUTES             = "60"
      NOTIFICATION_QUEUE_URL        = aws_sqs_queue.notification.url
      PRICE_TRACKING_ENABLED        = "true"
      SERPAPI_MONTHLY_REQUEST_LIMIT = "200"
      SERPAPI_SECRET_ARN            = aws_secretsmanager_secret.serpapi.arn
    })
  }

  depends_on = [
    aws_iam_role_policy.price_worker_lambda,
    aws_iam_role_policy_attachment.lambda_logs
  ]

  tags = local.common_tags
}

resource "aws_lambda_function" "notification" {
  function_name    = "${local.name_prefix}-notification"
  role             = aws_iam_role.notification_lambda.arn
  handler          = "backend/src/handlers/notification.handler"
  runtime          = local.lambda_runtime
  filename         = local.lambda_package_path
  source_code_hash = filebase64sha256(local.lambda_package_path)
  memory_size      = 256
  timeout          = 30

  environment {
    variables = merge(local.lambda_common_environment, {
      SES_FROM_EMAIL = var.ses_from_email
    })
  }

  depends_on = [
    aws_iam_role_policy.notification_lambda,
    aws_iam_role_policy_attachment.lambda_logs
  ]

  tags = local.common_tags
}

resource "aws_lambda_event_source_mapping" "price_worker" {
  event_source_arn        = aws_sqs_queue.price_check.arn
  function_name           = aws_lambda_function.price_worker.arn
  batch_size              = 10
  function_response_types = ["ReportBatchItemFailures"]
}

resource "aws_lambda_event_source_mapping" "notification" {
  event_source_arn        = aws_sqs_queue.notification.arn
  function_name           = aws_lambda_function.notification.arn
  batch_size              = 10
  function_response_types = ["ReportBatchItemFailures"]
}
