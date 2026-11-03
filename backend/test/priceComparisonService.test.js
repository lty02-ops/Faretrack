const test = require('node:test');
const assert = require('node:assert/strict');
const { PriceComparisonService } = require('../src/services/priceComparisonService');

const service = new PriceComparisonService();

test('custom percentage alerts trigger only at the chosen threshold', () => {
  for (const [price, shouldNotify] of [[187000, false], [186000, true]]) {
    const result = service.compare(
      { id: 'p2', price },
      [{ id: 'p1', price: 200000 }, { id: 'p2', price }],
      { targetPrice: 100000, baselinePrice: 200000, dropRatePercent: 7 }
    );
    assert.equal(result.shouldNotify, shouldNotify);
    assert.deepEqual(result.reasons, shouldNotify ? ['PRICE_DROP'] : []);
  }
});

test('disabled percentage alerts still notify when the target is reached', () => {
  const result = service.compare(
    { id: 'p2', price: 140000 },
    [{ id: 'p1', price: 200000 }, { id: 'p2', price: 140000 }],
    { targetPrice: 150000, baselinePrice: 200000, dropRatePercent: 0 }
  );
  assert.deepEqual(result.reasons, ['TARGET_REACHED']);
  assert.equal(result.alertPatch.percentageDropTriggered, false);
});

test('disabled percentage alerts suppress initial and continued drops', () => {
  for (const percentageDropTriggered of [false, true]) {
    const result = service.compare(
      { id: 'p3', price: 140000 },
      [{ id: 'p1', price: 200000 }, { id: 'p2', price: 160000 }, { id: 'p3', price: 140000 }],
      { targetPrice: 100000, baselinePrice: 200000, dropRatePercent: 0, percentageDropTriggered }
    );
    assert.equal(result.shouldNotify, false);
    assert.deepEqual(result.reasons, []);
  }
});

test('목표 가격에 최초 도달하면 알린다', () => {
  const result = service.compare(
    { id: 'p2', price: 149000 },
    [{ id: 'p1', price: 180000 }, { id: 'p2', price: 149000 }],
    { targetPrice: 150000, baselinePrice: 180000, dropRatePercent: 20 }
  );

  assert.deepEqual(result.reasons, ['TARGET_REACHED']);
  assert.equal(result.alertPatch.targetReachedNotified, true);
});

test('등록 당시 가격보다 설정 비율 이상 하락하면 알린다', () => {
  const result = service.compare(
    { id: 'p2', price: 180000 },
    [{ id: 'p1', price: 200000 }, { id: 'p2', price: 180000 }],
    { targetPrice: 150000, baselinePrice: 200000, dropRatePercent: 10 }
  );

  assert.deepEqual(result.reasons, ['PRICE_DROP']);
  assert.equal(result.alertPatch.percentageDropTriggered, true);
});

test('퍼센트 기준 도달 후 직전 조회보다 계속 떨어지면 매번 알린다', () => {
  const result = service.compare(
    { id: 'p3', price: 178000 },
    [{ id: 'p1', price: 200000 }, { id: 'p2', price: 180000 }, { id: 'p3', price: 178000 }],
    { targetPrice: 150000, baselinePrice: 200000, dropRatePercent: 10, percentageDropTriggered: true }
  );

  assert.deepEqual(result.reasons, ['CONTINUED_DROP']);
  assert.equal(result.shouldNotify, true);
});

test('퍼센트 기준 도달 후 가격이 오르거나 같으면 알리지 않는다', () => {
  const result = service.compare(
    { id: 'p3', price: 181000 },
    [{ id: 'p1', price: 200000 }, { id: 'p2', price: 180000 }, { id: 'p3', price: 181000 }],
    { targetPrice: 150000, baselinePrice: 200000, dropRatePercent: 10, percentageDropTriggered: true }
  );

  assert.equal(result.shouldNotify, false);
});

test('기존 알림은 첫 가격을 기준 가격으로 사용한다', () => {
  const result = service.compare(
    { id: 'p2', price: 90000 },
    [{ id: 'p1', price: 100000 }, { id: 'p2', price: 90000 }],
    { targetPrice: 80000, dropRatePercent: 10 }
  );

  assert.deepEqual(result.reasons, ['PRICE_DROP']);
});
