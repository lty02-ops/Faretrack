const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { createContainer } = require('../app');
const { SerpApiGoogleFlightsProvider } = require('../providers/serpApiGoogleFlightsProvider');
const { PriceComparisonService } = require('../services/priceComparisonService');
const { createPriceHistory } = require('../domain/priceHistory');
const { findLowestPrice } = require('../utils/priceUtils');

const sqs = new SQSClient({});
const secrets = new SecretsManagerClient({});
let apiKey;

async function getApiKey() {
  if (apiKey) return apiKey;
  const secretId = process.env.SERPAPI_SECRET_ARN;
  if (!secretId) return '';
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = JSON.parse(result.SecretString || '{}');
  apiKey = value.apiKey || '';
  return apiKey;
}

async function processRecord(record) {
  const provider = new SerpApiGoogleFlightsProvider({ apiKey: await getApiKey(), testMode: false });
  const container = createContainer({ provider });
  const comparison = new PriceComparisonService();
  const { watchKey } = JSON.parse(record.body);
  const target = await container.watchRepository.findTargetByKey(watchKey);
  if (!target?.active) return;

  const result = await container.flightSearchService.search(target.query, { bypassCache: true });
  const point = await container.priceHistoryRepository.save(createPriceHistory(target.key, findLowestPrice(result.flights)));
  const history = await container.priceHistoryRepository.listByWatchKey(target.key);
  const alerts = await container.watchRepository.alertsForTarget(target.key);

  for (const alert of alerts) {
    const evaluated = comparison.compare(point, history, alert);
    if (!evaluated.shouldNotify) continue;
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.NOTIFICATION_QUEUE_URL,
      MessageBody: JSON.stringify({ alert, pricePoint: point, reasons: evaluated.reasons })
    }));
  }
}

exports.handler = async (event) => {
  const failures = [];
  for (const record of event.Records || []) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error('Price check failed', { messageId: record.messageId, error });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
};
