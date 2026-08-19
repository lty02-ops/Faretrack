const parseNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const env = Object.freeze({
  port: parseNumber(process.env.PORT, 3000),
  testMode: process.env.TEST_MODE !== 'false',
  serpApiKey: process.env.SERPAPI_API_KEY || '',
  monthlyRequestLimit: parseNumber(process.env.SERPAPI_MONTHLY_REQUEST_LIMIT, 200),
  cacheTtlMinutes: parseNumber(process.env.CACHE_TTL_MINUTES, 60),
  priceTrackingEnabled: process.env.PRICE_TRACKING_ENABLED !== 'false',
  priceCheckIntervalMinutes: parseNumber(process.env.PRICE_CHECK_INTERVAL_MINUTES, 60),
  repositoryType: process.env.REPOSITORY_TYPE || 'memory',
  awsRegion: process.env.AWS_REGION || 'ap-northeast-2',
  dynamoDbTableName: process.env.DYNAMODB_TABLE_NAME || 'Faretrack',
  dynamoDbEndpoint: process.env.DYNAMODB_ENDPOINT || ''
});
module.exports = { env };
