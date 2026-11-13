variable "grafana_enabled" {
  description = "Deploy a dedicated Faretrack Grafana EC2 instance"
  type        = bool
  default     = false
}

variable "grafana_image" {
  description = "Pinned official Grafana container image; review updates regularly"
  type        = string
  default     = "grafana/grafana:12.4.0"
}

data "aws_ssm_parameter" "grafana_ami" {
  count = var.grafana_enabled ? 1 : 0
  name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_vpc" "grafana" {
  count                = var.grafana_enabled ? 1 : 0
  cidr_block           = "10.83.0.0/24"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.common_tags, { Name = "${local.name_prefix}-grafana" })
}

resource "aws_subnet" "grafana" {
  count                   = var.grafana_enabled ? 1 : 0
  vpc_id                  = aws_vpc.grafana[0].id
  cidr_block              = "10.83.0.0/26"
  map_public_ip_on_launch = true
  tags                    = local.common_tags
}

resource "aws_internet_gateway" "grafana" {
  count  = var.grafana_enabled ? 1 : 0
  vpc_id = aws_vpc.grafana[0].id
  tags   = local.common_tags
}

resource "aws_route_table" "grafana" {
  count  = var.grafana_enabled ? 1 : 0
  vpc_id = aws_vpc.grafana[0].id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.grafana[0].id
  }
  tags = local.common_tags
}

resource "aws_route_table_association" "grafana" {
  count          = var.grafana_enabled ? 1 : 0
  subnet_id      = aws_subnet.grafana[0].id
  route_table_id = aws_route_table.grafana[0].id
}

resource "aws_security_group" "grafana" {
  count       = var.grafana_enabled ? 1 : 0
  name_prefix = "${local.name_prefix}-grafana-"
  description = "No inbound access; administer via SSM"
  vpc_id      = aws_vpc.grafana[0].id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = local.common_tags
}

resource "aws_iam_role" "grafana" {
  count = var.grafana_enabled ? 1 : 0
  name  = "${local.name_prefix}-grafana"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "grafana_ssm" {
  count      = var.grafana_enabled ? 1 : 0
  role       = aws_iam_role.grafana[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "grafana_cloudwatch" {
  count = var.grafana_enabled ? 1 : 0
  role  = aws_iam_role.grafana[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["cloudwatch:ListMetrics", "cloudwatch:GetMetricData", "cloudwatch:GetMetricStatistics"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_instance_profile" "grafana" {
  count = var.grafana_enabled ? 1 : 0
  name  = "${local.name_prefix}-grafana"
  role  = aws_iam_role.grafana[0].name
}

locals {
  grafana_metrics = concat(
    flatten([for name in values(local.monitored_lambda_functions) : [
      for metric in ["Invocations", "Errors", "Duration", "Throttles"] : {
        title      = "${name}: ${metric}", namespace = "AWS/Lambda", metric = metric,
        dimensions = { FunctionName = name }, statistic = metric == "Duration" ? "Average" : "Sum"
      }
    ]]),
    [for metric in ["Count", "5xx", "Latency"] : {
      title      = "API: ${metric}", namespace = "AWS/ApiGateway", metric = metric,
      dimensions = { ApiId = aws_apigatewayv2_api.faretrack.id }, statistic = metric == "Latency" ? "Average" : "Sum"
    }],
    flatten([for queue in [aws_sqs_queue.price_check, aws_sqs_queue.notification, aws_sqs_queue.price_check_dlq, aws_sqs_queue.notification_dlq] : [
      for metric in ["ApproximateNumberOfMessagesVisible", "ApproximateAgeOfOldestMessage"] : {
        title      = "${queue.name}: ${metric}", namespace = "AWS/SQS", metric = metric,
        dimensions = { QueueName = queue.name }, statistic = "Maximum"
      }
    ]])
  )
  grafana_dashboard = jsonencode({
    uid     = "faretrack-${var.environment}", title = "Faretrack ${var.environment}", schemaVersion = 39,
    refresh = "5m", time = { from = "now-6h", to = "now" }, tags = ["faretrack", var.environment],
    panels = [for index, metric in local.grafana_metrics : {
      id         = index + 1, title = metric.title, type = "timeseries",
      datasource = { type = "cloudwatch", uid = "faretrack-cloudwatch" },
      gridPos    = { h = 8, w = 12, x = (index % 2) * 12, y = floor(index / 2) * 8 },
      targets = [{
        refId      = "A", queryMode = "Metrics", metricQueryType = 0, metricEditorMode = 0,
        region     = var.region, namespace = metric.namespace, metricName = metric.metric,
        dimensions = { for key, value in metric.dimensions : key => [value] },
        statistic  = metric.statistic, period = "300", matchExact = true
      }]
    }]
  })
}

resource "aws_instance" "grafana" {
  count                       = var.grafana_enabled ? 1 : 0
  ami                         = data.aws_ssm_parameter.grafana_ami[0].value
  instance_type               = "t3.small"
  subnet_id                   = aws_subnet.grafana[0].id
  vpc_security_group_ids      = [aws_security_group.grafana[0].id]
  iam_instance_profile        = aws_iam_instance_profile.grafana[0].name
  associate_public_ip_address = true
  user_data_replace_on_change = true
  user_data_base64 = base64gzip(templatefile("${path.module}/../monitoring/grafana-user-data.sh.tftpl", {
    image         = var.grafana_image
    region        = var.region
    dashboard_b64 = base64encode(local.grafana_dashboard)
    volume_id     = aws_ebs_volume.grafana[0].id
  }))
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }
  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }
  tags       = merge(local.common_tags, { Name = "${local.name_prefix}-grafana" })
  depends_on = [aws_route_table_association.grafana, aws_iam_role_policy_attachment.grafana_ssm, aws_iam_role_policy.grafana_cloudwatch]
}

resource "aws_ebs_volume" "grafana" {
  count             = var.grafana_enabled ? 1 : 0
  availability_zone = aws_subnet.grafana[0].availability_zone
  type              = "gp3"
  size              = 20
  encrypted         = true
  tags              = merge(local.common_tags, { Name = "${local.name_prefix}-grafana-data" })
}

resource "aws_volume_attachment" "grafana" {
  count       = var.grafana_enabled ? 1 : 0
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.grafana[0].id
  instance_id = aws_instance.grafana[0].id
}

output "grafana_instance_id" {
  value       = try(aws_instance.grafana[0].id, null)
  description = "SSM target for the dedicated Grafana instance"
}
