resource "aws_sesv2_email_identity" "sender" {
  count = var.ses_from_email == "" ? 0 : 1

  email_identity = var.ses_from_email

  tags = local.common_tags
}
