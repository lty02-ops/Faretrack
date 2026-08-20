project_name = "faretrack"
environment  = "dev"
region       = "ap-northeast-2"

price_check_schedule   = "rate(3 hours)"
price_tracking_enabled = false

monthly_budget_usd = 10

api_throttling_rate_limit         = 5
api_throttling_burst_limit        = 10
price_worker_reserved_concurrency = 2
notification_reserved_concurrency = 5
