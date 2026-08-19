locals {
  monitored_lambda_functions = {
    api          = aws_lambda_function.api.function_name
    scheduler    = aws_lambda_function.scheduler.function_name
    price_worker = aws_lambda_function.price_worker.function_name
    notification = aws_lambda_function.notification.function_name
  }

  lambda_log_groups = {
    api          = "/aws/lambda/${local.name_prefix}-api"
    scheduler    = "/aws/lambda/${local.name_prefix}-scheduler"
    price_worker = "/aws/lambda/${local.name_prefix}-price-worker"
    notification = "/aws/lambda/${local.name_prefix}-notification"
  }

  monitored_queues = {
    price_check  = aws_sqs_queue.price_check.name
    notification = aws_sqs_queue.notification.name
  }

  monitored_dead_letter_queues = {
    price_check  = aws_sqs_queue.price_check_dlq.name
    notification = aws_sqs_queue.notification_dlq.name
  }
}

resource "aws_sns_topic" "monitoring_alerts" {
  name              = "${local.name_prefix}-monitoring-alerts"
  kms_master_key_id = "alias/aws/sns"

  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "monitoring_email" {
  count = var.monitoring_alert_email == "" ? 0 : 1

  topic_arn = aws_sns_topic.monitoring_alerts.arn
  protocol  = "email"
  endpoint  = var.monitoring_alert_email
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.lambda_log_groups

  name              = each.value
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = local.monitored_lambda_functions

  alarm_name          = "${local.name_prefix}-${each.key}-errors"
  alarm_description   = "${each.value} returned one or more errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.monitoring_alerts.arn]

  dimensions = {
    FunctionName = each.value
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = local.monitored_lambda_functions

  alarm_name          = "${local.name_prefix}-${each.key}-throttles"
  alarm_description   = "${each.value} was throttled"
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.monitoring_alerts.arn]

  dimensions = {
    FunctionName = each.value
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${local.name_prefix}-api-5xx"
  alarm_description   = "API Gateway returned one or more server errors"
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.monitoring_alerts.arn]

  dimensions = {
    ApiId = aws_apigatewayv2_api.faretrack.id
    Stage = aws_apigatewayv2_stage.default.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "queue_age" {
  for_each = local.monitored_queues

  alarm_name          = "${local.name_prefix}-${each.key}-queue-age"
  alarm_description   = "Messages have remained in ${each.value} for at least 15 minutes"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 900
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.monitoring_alerts.arn]

  dimensions = {
    QueueName = each.value
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dead_letter_queue" {
  for_each = local.monitored_dead_letter_queues

  alarm_name          = "${local.name_prefix}-${each.key}-dlq-messages"
  alarm_description   = "${each.value} contains failed messages"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.monitoring_alerts.arn]

  dimensions = {
    QueueName = each.value
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "eventbridge_failures" {
  alarm_name          = "${local.name_prefix}-schedule-failures"
  alarm_description   = "EventBridge failed to invoke the scheduler Lambda"
  namespace           = "AWS/Events"
  metric_name         = "FailedInvocations"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.monitoring_alerts.arn]

  dimensions = {
    RuleName = aws_cloudwatch_event_rule.price_check_schedule.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  alarm_name          = "${local.name_prefix}-dynamodb-throttles"
  alarm_description   = "DynamoDB requests were throttled"
  namespace           = "AWS/DynamoDB"
  metric_name         = "ThrottledRequests"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.monitoring_alerts.arn]

  dimensions = {
    TableName = aws_dynamodb_table.faretrack.name
  }

  tags = local.common_tags
}
