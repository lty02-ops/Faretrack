resource "aws_sqs_queue" "price_check_dlq" {
  name                      = "${local.name_prefix}-price-check-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true

  tags = local.common_tags
}

resource "aws_sqs_queue" "notification_dlq" {
  name                      = "${local.name_prefix}-notification-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true

  tags = local.common_tags
}

resource "aws_sqs_queue" "price_check" {
  name = "${local.name_prefix}-price-check-queue"

  visibility_timeout_seconds = 360
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.price_check_dlq.arn
    maxReceiveCount     = 3
  })

  tags = local.common_tags
}

resource "aws_sqs_queue" "notification" {
  name = "${local.name_prefix}-notification-queue"

  visibility_timeout_seconds = 180
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notification_dlq.arn
    maxReceiveCount     = 3
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "price_check_schedule" {
  name                = "${local.name_prefix}-price-check-schedule"
  description         = "Runs the Faretrack scheduler periodically"
  schedule_expression = var.price_check_schedule

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "scheduler_lambda" {
  rule      = aws_cloudwatch_event_rule.price_check_schedule.name
  target_id = "FaretrackSchedulerLambda"
  arn       = aws_lambda_function.scheduler.arn
}

resource "aws_lambda_permission" "allow_eventbridge_scheduler" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.price_check_schedule.arn
}
