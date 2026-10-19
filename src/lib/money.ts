export const MONEY_SCALE: number = 10000;

const MICRO_PAISE_PER_PAISE: bigint = 100n;
const BASIS_POINTS_SCALE: bigint = 10000n;
const MAX_SAFE_INTEGER_BIGINT: bigint = BigInt(Number.MAX_SAFE_INTEGER);

function toScaledInteger(value: number, scale: number, name: string): bigint {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }

  const sign: bigint = value < 0 ? -1n : 1n;
  const absoluteValue: string = Math.abs(value).toString().toLowerCase();
  const [coefficientPart, exponentPart] = absoluteValue.split('e');
  const [wholePart, fractionalPart = ''] = coefficientPart.split('.');
  const digits: string = `${wholePart}${fractionalPart}`.replace(/^0+(?=\d)/, '');
  const exponent: number = exponentPart === undefined ? 0 : Number(exponentPart);
  const decimalPlaces: number = fractionalPart.length - exponent;
  const numerator: bigint = BigInt(digits || '0') * BigInt(scale);

  if (decimalPlaces <= 0) {
    return sign * numerator * 10n ** BigInt(-decimalPlaces);
  }

  const divisor: bigint = 10n ** BigInt(decimalPlaces);
  const quotient: bigint = numerator / divisor;
  const remainder: bigint = numerator % divisor;
  const rounded: bigint = remainder * 2n >= divisor ? quotient + 1n : quotient;

  return sign * rounded;
}

function assertSafeScaledValue(value: bigint, name: string): void {
  if (value > MAX_SAFE_INTEGER_BIGINT || value < -MAX_SAFE_INTEGER_BIGINT) {
    throw new RangeError(`${name} exceeds JavaScript's safe integer range after scaling.`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`${name} must be a finite integer.`);
  }
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative.`);
  }
}

export function toMicroPaise(value: number): bigint {
  const microPaise: bigint = toScaledInteger(value, MONEY_SCALE, 'Rupee amount');
  assertSafeScaledValue(microPaise, 'Rupee amount');
  return microPaise;
}

export function fromMicroPaise(value: bigint): number {
  if (typeof value !== 'bigint') {
    throw new TypeError('Micro-paise value must be a bigint.');
  }

  const rupees: number = Number(value) / MONEY_SCALE;
  if (!Number.isFinite(rupees)) {
    throw new RangeError('Micro-paise value cannot be represented as a finite number.');
  }
  return rupees;
}

export function paiseToMicroPaise(paise: number): bigint {
  assertNonNegativeInteger(paise, 'Paise');
  const microPaise: bigint = BigInt(paise) * MICRO_PAISE_PER_PAISE;
  assertSafeScaledValue(microPaise, 'Paise amount');
  return microPaise;
}

export function microPaiseToPaise(value: bigint): number {
  if (typeof value !== 'bigint') {
    throw new TypeError('Micro-paise value must be a bigint.');
  }

  const paise: bigint = value / MICRO_PAISE_PER_PAISE;
  if (paise > MAX_SAFE_INTEGER_BIGINT || paise < -MAX_SAFE_INTEGER_BIGINT) {
    throw new RangeError('Micro-paise value cannot be represented as safe paise.');
  }
  return Number(paise);
}

export function rupeesToPaise(rupees: number): number {
  const paise: bigint = toScaledInteger(rupees, 100, 'Rupee amount');
  assertSafeScaledValue(paise, 'Rupee amount');
  return Number(paise);
}

export function paiseToRupees(paise: number): number {
  assertNonNegativeInteger(paise, 'Paise');
  return paise / 100;
}

export function formatInr(paise: number): string {
  const rupees: number = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function addMicroPaise(...values: readonly bigint[]): bigint {
  return values.reduce((total: bigint, value: bigint) => {
    if (typeof value !== 'bigint') {
      throw new TypeError('Every micro-paise value must be a bigint.');
    }
    return total + value;
  }, 0n);
}

export function multiplyByRateBps(amountMicroPaise: bigint, rateBps: number): bigint {
  if (typeof amountMicroPaise !== 'bigint') {
    throw new TypeError('Amount must be a bigint.');
  }
  if (amountMicroPaise < 0n) {
    throw new RangeError('Amount must be non-negative.');
  }
  if (!Number.isFinite(rateBps) || rateBps < 0) {
    throw new RangeError('Basis-point rate must be finite and non-negative.');
  }

  const rateMicroPaise: bigint = toScaledInteger(rateBps, MONEY_SCALE, 'Basis-point rate');
  const denominator: bigint = BigInt(MONEY_SCALE) * BASIS_POINTS_SCALE;
  const numerator: bigint = amountMicroPaise * rateMicroPaise;
  return (numerator + denominator - 1n) / denominator;
}

export function clampMicroPaise(
  value: bigint,
  minimumPaise: number,
  maximumPaise: number,
): bigint {
  if (typeof value !== 'bigint') {
    throw new TypeError('Value must be a bigint.');
  }
  assertNonNegativeInteger(minimumPaise, 'Minimum paise');
  assertNonNegativeInteger(maximumPaise, 'Maximum paise');
  if (minimumPaise > maximumPaise) {
    throw new RangeError('Minimum paise cannot exceed maximum paise.');
  }

  const minimumMicroPaise: bigint = BigInt(minimumPaise);
  const maximumMicroPaise: bigint = BigInt(maximumPaise);
  return value < minimumMicroPaise
    ? minimumMicroPaise
    : value > maximumMicroPaise
      ? maximumMicroPaise
      : value;
}
