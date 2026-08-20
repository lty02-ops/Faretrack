const { createContainer } = require('../app');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SerpApiGoogleFlightsProvider } = require('../providers/serpApiGoogleFlightsProvider');
const { FlightController } = require('../controllers/flightController');
const { WatchController } = require('../controllers/watchController');
const { HealthController } = require('../controllers/healthController');
const { flightRoutes } = require('../routes/flightRoutes');
const { watchRoutes } = require('../routes/watchRoutes');
const { healthRoutes } = require('../routes/healthRoutes');

let routes;
const secrets = new SecretsManagerClient({});
let apiKey;

async function getApiKey() {
  if (apiKey) return apiKey;
  const secret = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.SERPAPI_SECRET_ARN }));
  const value = JSON.parse(secret.SecretString || '{}');
  apiKey = value.apiKey || '';
  return apiKey;
}

function getRoutes() {
  if (routes) return routes;
  const provider = new SerpApiGoogleFlightsProvider({ apiKeyProvider: getApiKey, testMode: false });
  const container = createContainer({ provider });
  routes = [
    ...flightRoutes(new FlightController(container.flightSearchService)),
    ...watchRoutes(new WatchController(container)),
    ...healthRoutes(new HealthController('live'))
  ];
  return routes;
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

exports.handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path || '/';
    const claims = event.requestContext?.authorizer?.jwt?.claims || {};

    for (const route of getRoutes()) {
      if (route.method !== method) continue;
      const match = path.match(route.pattern);
      if (!match) continue;

      const result = await route.handler({
        body: ['POST', 'PATCH'].includes(method) ? parseBody(event) : {},
        params: Object.fromEntries(Object.entries(match.groups || {}).map(([key, value]) => [key, decodeURIComponent(value)])),
        query: event.queryStringParameters || {},
        userId: claims.sub,
        email: claims.email
      });

      return {
        statusCode: result.status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: result.body === null ? '' : JSON.stringify(result.body)
      };
    }

    return { statusCode: 404, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    console.error('API request failed', error);
    return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};
