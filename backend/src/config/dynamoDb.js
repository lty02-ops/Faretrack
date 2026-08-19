const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { env } = require('./env');

function createDynamoDbClient(options = {}) {
  const client = new DynamoDBClient({
    region: options.region || env.awsRegion,
    ...(options.endpoint || env.dynamoDbEndpoint
      ? { endpoint: options.endpoint || env.dynamoDbEndpoint }
      : {}),
    ...(options.credentials ? { credentials: options.credentials } : {})
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true }
  });
}

module.exports = { createDynamoDbClient };
