const fs = require('node:fs');
const path = require('node:path');
const { env } = require('./config/env');
const { createDynamoDbClient } = require('./config/dynamoDb');
const { SerpApiGoogleFlightsProvider } = require('./providers/serpApiGoogleFlightsProvider');
const { FlightSearchCache } = require('./cache/flightSearchCache');
const { FlightRepository } = require('./repositories/flightRepository');
const { WatchRepository } = require('./repositories/watchRepository');
const { PriceHistoryRepository } = require('./repositories/priceHistoryRepository');
const { NotificationRepository } = require('./repositories/notificationRepository');
const { DynamoDbFlightRepository } = require('./repositories/dynamoDb/dynamoDbFlightRepository');
const { DynamoDbWatchRepository } = require('./repositories/dynamoDb/dynamoDbWatchRepository');
const { DynamoDbPriceHistoryRepository } = require('./repositories/dynamoDb/dynamoDbPriceHistoryRepository');
const { DynamoDbNotificationRepository } = require('./repositories/dynamoDb/dynamoDbNotificationRepository');
const { FlightSearchService } = require('./services/flightSearchService');
const { WatchService } = require('./services/watchService');
const { PriceComparisonService } = require('./services/priceComparisonService');
const { NotificationService } = require('./services/notificationService');
const { PriceCheckService } = require('./services/priceCheckService');
const { FlightController } = require('./controllers/flightController');
const { WatchController } = require('./controllers/watchController');
const { HealthController } = require('./controllers/healthController');
const { flightRoutes } = require('./routes/flightRoutes');
const { watchRoutes } = require('./routes/watchRoutes');
const { healthRoutes } = require('./routes/healthRoutes');

function createRepositories(overrides) {
  if (overrides.flightRepository) return overrides;
  if (env.repositoryType !== 'dynamodb') return {
    flightRepository: new FlightRepository(), watchRepository: new WatchRepository(),
    priceHistoryRepository: new PriceHistoryRepository(), notificationRepository: new NotificationRepository()
  };
  const client = overrides.dynamoDb || createDynamoDbClient();
  return {
    flightRepository: new DynamoDbFlightRepository(client, env.dynamoDbTableName),
    watchRepository: new DynamoDbWatchRepository(client, env.dynamoDbTableName),
    priceHistoryRepository: new DynamoDbPriceHistoryRepository(client, env.dynamoDbTableName),
    notificationRepository: new DynamoDbNotificationRepository(client, env.dynamoDbTableName)
  };
}

function createContainer(overrides = {}) {
  const repositories = { ...createRepositories(overrides), ...overrides };
  const provider = overrides.provider || new SerpApiGoogleFlightsProvider({ apiKey:env.serpApiKey, testMode:env.testMode });
  const cache = overrides.cache || new FlightSearchCache(env.cacheTtlMinutes);
  const flightSearchService = new FlightSearchService({ provider, cache, repository:repositories.flightRepository, monthlyRequestLimit:env.monthlyRequestLimit });
  const watchService = new WatchService(repositories);
  const notificationService = new NotificationService(repositories.notificationRepository);
  const priceCheckService = new PriceCheckService({ ...repositories, flightSearchService, priceComparisonService:new PriceComparisonService(), notificationService, enabled:env.priceTrackingEnabled });
  return { ...repositories, flightSearchService, watchService, priceCheckService };
}

function readBody(req) { return new Promise((resolve,reject) => { let raw=''; req.on('data',chunk=>raw+=chunk); req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(new Error('올바른 JSON 요청이 아닙니다.'));}}); }); }
function sendJson(res,status,payload) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(payload===null?'':JSON.stringify(payload)); }

function createApp(overrides = {}) {
  const container=createContainer(overrides);
  const routes=[...flightRoutes(new FlightController(container.flightSearchService)),...watchRoutes(new WatchController(container)),...healthRoutes(new HealthController(env.testMode?'test':'live'))];
  const frontendRoot=path.resolve(__dirname,'../../frontend');
  return async (req,res) => { try {
    const url=new URL(req.url,'http://localhost');
    for(const route of routes){if(req.method!==route.method)continue;const match=url.pathname.match(route.pattern);if(!match)continue;const request={body:['POST','PATCH'].includes(req.method)?await readBody(req):{},params:Object.fromEntries(Object.entries(match.groups||{}).map(([key,value])=>[key,decodeURIComponent(value)])),query:Object.fromEntries(url.searchParams)};const result=await route.handler(request);return sendJson(res,result.status,result.body);}
    const requested=url.pathname==='/'?'index.html':url.pathname.slice(1),full=path.resolve(frontendRoot,requested);
    const allowed=full===path.join(frontendRoot,'index.html')||full.startsWith(frontendRoot+path.sep);
    if(!allowed||!fs.existsSync(full)||fs.statSync(full).isDirectory())return sendJson(res,404,{error:'Not found'});
    const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript; charset=utf-8'};
    res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream'});fs.createReadStream(full).pipe(res);
  } catch(error) { sendJson(res,400,{error:error.message}); } };
}
module.exports={createApp,createContainer};
