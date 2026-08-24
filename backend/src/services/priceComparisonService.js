const { calculateDropRate } = require('../utils/priceUtils');

class PriceComparisonService {
  compare(current, history, alert) {
    const prior = history.filter((item) => item.id !== current.id);
    const previousPrice = prior.at(-1)?.price;
    const baselinePrice = Number(alert.baselinePrice || history[0]?.price || 0);
    const dropRate = calculateDropRate(baselinePrice, current.price);
    const thresholdReached = baselinePrice > 0 && dropRate >= (alert.dropRatePercent || 10);
    const reasons = [];

    const targetReachedNow = !alert.targetReachedNotified
      && alert.targetPrice
      && current.price <= alert.targetPrice;
    if (targetReachedNow) reasons.push('TARGET_REACHED');

    const percentageReachedNow = !alert.percentageDropTriggered && thresholdReached;
    if (percentageReachedNow) reasons.push('PRICE_DROP');

    const continuedDrop = alert.percentageDropTriggered
      && thresholdReached
      && previousPrice
      && current.price < previousPrice;
    if (continuedDrop) reasons.push('CONTINUED_DROP');

    return {
      shouldNotify: reasons.length > 0,
      reasons,
      dropRate,
      alertPatch: {
        targetReachedNotified: Boolean(alert.targetReachedNotified || targetReachedNow),
        percentageDropTriggered: Boolean(alert.percentageDropTriggered || percentageReachedNow)
      }
    };
  }
}

module.exports = { PriceComparisonService };
