export const COINS_TO_RWF_RATE = 100;

const toNumeric = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

export const normalizeCurrency = (value: unknown): number | null => {
  const numeric = toNumeric(value);
  if (numeric === null) {
    return null;
  }

  return Math.max(Math.round(numeric), 0);
};

export const coinsToRwf = (value: unknown): number | null => {
  const coins = normalizeCurrency(value);
  if (coins === null) {
    return null;
  }

  return coins * COINS_TO_RWF_RATE;
};

export const rwfToCoins = (value: unknown): number | null => {
  const amount = normalizeCurrency(value);
  if (amount === null) {
    return null;
  }

  return Math.max(Math.round(amount / COINS_TO_RWF_RATE), 0);
};

export const resolvePriceFromFields = (fields: {
  price?: unknown;
  priceInRwf?: unknown;
  priceInCoins?: unknown;
}): number | null => {
  const direct = normalizeCurrency(fields.price ?? fields.priceInRwf);
  if (direct !== null) {
    return direct;
  }

  return coinsToRwf(fields.priceInCoins);
};
