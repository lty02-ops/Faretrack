const { SQSClient, SendMessageBatchCommand } = require('@aws-sdk/client-sqs');
const { createContainer } = require('../app');

const sqs = new SQSClient({});

exports.handler = async () => {
  const { watchRepository } = createContainer();
  const targets = await watchRepository.listActiveTargets();
  const queueUrl = process.env.PRICE_CHECK_QUEUE_URL;

  if (!queueUrl) throw new Error('PRICE_CHECK_QUEUE_URL is required');

  for (let offset = 0; offset < targets.length; offset += 10) {
    const batch = targets.slice(offset, offset + 10);
    const result = await sqs.send(new SendMessageBatchCommand({
      QueueUrl: queueUrl,
      Entries: batch.map((target, index) => ({
        Id: String(index),
        MessageBody: JSON.stringify({ watchKey: target.key })
      }))
    }));
    if (result.Failed?.length) throw new Error(`Failed to enqueue ${result.Failed.length} price checks`);
  }

  return { queuedTargets: targets.length };
};
