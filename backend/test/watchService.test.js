const test = require('node:test');
const assert = require('node:assert/strict');
const { WatchRepository } = require('../src/repositories/watchRepository');
const { PriceHistoryRepository } = require('../src/repositories/priceHistoryRepository');
const { WatchService } = require('../src/services/watchService');

const query = { origin: 'ICN', destination: 'NRT', departureDate: '2026-10-04', returnDate: '2026-10-08', tripType: 'ROUND', passengers: 1 };

test('추적 등록 가격을 첫 가격 이력으로 저장한다', async () => {
  const watches = new WatchRepository();
  const history = new PriceHistoryRepository();
  const service = new WatchService({ watchRepository: watches, priceHistoryRepository: history });

  const { target } = await service.create(query, { userId: 'user-1', targetPrice: 150000, baselinePrice: 235700 });
  const points = await history.listByWatchKey(target.key);

  assert.equal(points.length, 1);
  assert.equal(points[0].price, 235700);
});

test('기존 추적의 이력이 없으면 기준 가격을 화면용 첫 이력으로 제공한다', async () => {
  const watches = new WatchRepository();
  const history = new PriceHistoryRepository();
  const service = new WatchService({ watchRepository: watches, priceHistoryRepository: history });
  const { target, alert } = await service.create(query, { userId: 'user-1', targetPrice: 150000 });
  await watches.updateAlert(alert.id, { baselinePrice: 235700 });

  const [item] = await service.list('user-1');

  assert.equal((await history.listByWatchKey(target.key)).length, 0);
  assert.equal(item.history.length, 1);
  assert.equal(item.history[0].price, 235700);
  assert.equal(item.history[0].provider, 'REGISTRATION');
});
