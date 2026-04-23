import type { LevelSpec } from './types';

const TARGET = 24;

const level = (
  id: number,
  numbers: number[],
  hint: string,
  allowedOperators?: LevelSpec['allowedOperators']
): LevelSpec => ({
  id,
  description: '用给定数字和运算符凑出 24。',
  targetValue: TARGET,
  hint,
  numbers,
  allowedOperators
});

const TIER_SIZE = 10;

type Rng = () => number;
type Candidate = {
  numbers: number[];
  hint: string;
  allowedOperators?: LevelSpec['allowedOperators'];
};

const OPS_TIER_1: LevelSpec['allowedOperators'] = ['+', '-'];
const OPS_TIER_2: LevelSpec['allowedOperators'] = ['+', '-', '*', '/'];
const OPS_TIER_3: LevelSpec['allowedOperators'] = ['+', '-', '*', '/', '(', ')'];
const OPS_TIER_6: LevelSpec['allowedOperators'] = ['+', '-', '*', '/', '(', ')', 'sqrt'];
const OPS_TIER_7: LevelSpec['allowedOperators'] = ['+', '-', '*', '/', '(', ')', 'sqrt', '^'];
const OPS_TIER_8: LevelSpec['allowedOperators'] = ['+', '-', '*', '/', '(', ')', 'sqrt', '^', 'log'];
const OPS_TIER_9: LevelSpec['allowedOperators'] = ['+', '-', '*', '/', '(', ')', 'sqrt', '^', 'log', '!'];

const makePrng = (seed: number): Rng => {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const randInt = (rng: Rng, min: number, max: number): number => {
  return min + Math.floor(rng() * (max - min + 1));
};

const keyOf = (numbers: number[]): string => {
  return [...numbers].sort((a, b) => a - b).join(',');
};

const buildTier = (seed: number, makeCandidate: (rng: Rng) => Candidate | null): Candidate[] => {
  const rng = makePrng(seed);
  const used = new Set<string>();
  const list: Candidate[] = [];

  let guard = 0;
  while (list.length < TIER_SIZE && guard < 10000) {
    guard += 1;
    const candidate = makeCandidate(rng);
    if (!candidate) {
      continue;
    }

    const key = keyOf(candidate.numbers);
    if (used.has(key)) {
      continue;
    }

    used.add(key);
    list.push(candidate);
  }

  if (list.length !== TIER_SIZE) {
    throw new Error('生成关卡失败：无法凑齐 10 关。');
  }

  return list;
};

const tier1 = buildTier(2401, (rng) => {
  // Tier 1: 纯加减，数值小，计算直观。
  const a = randInt(rng, 5, 13);
  const b = randInt(rng, 1, 9);
  const c = randInt(rng, 1, 9);
  const d = 24 - a - b - c;

  if (d < 1 || d > 13) {
    return null;
  }

  return {
    numbers: [a, b, c, d],
    hint: `${a} + ${b} + ${c} + ${d}`,
    allowedOperators: OPS_TIER_1
  };
});

const tier2 = buildTier(2402, (rng) => {
  // Tier 2: 乘法入门，单次乘法 + 加法补齐。
  const a = randInt(rng, 2, 9);
  const b = randInt(rng, 2, 9);
  const c = randInt(rng, 1, 9);
  const d = 24 - a * b - c;

  if (d < 1 || d > 13) {
    return null;
  }

  return {
    numbers: [a, b, c, d],
    hint: `${a} × ${b} + ${c} + ${d}`,
    allowedOperators: OPS_TIER_2
  };
});

const tier3 = buildTier(2403, (rng) => {
  // Tier 3: 括号基础，先合并再乘，增加表达式层次。
  const a = randInt(rng, 1, 8);
  const b = randInt(rng, 1, 8);
  const c = randInt(rng, 2, 6);
  const d = (a + b) * c - 24;

  if (d < 1 || d > 13) {
    return null;
  }

  return {
    numbers: [a, b, c, d],
    hint: `(${a} + ${b}) × ${c} - ${d}`,
    allowedOperators: OPS_TIER_3
  };
});

const tier4 = buildTier(2404, (rng) => {
  // Tier 4: 综合结构，乘法与括号组合更紧密。
  const a = randInt(rng, 2, 9);
  const b = randInt(rng, 2, 8);
  const c = randInt(rng, 1, 8);
  const d = a * (b + c) - 24;

  if (d < 1 || d > 13) {
    return null;
  }

  return {
    numbers: [a, b, c, d],
    hint: `${a} × (${b} + ${c}) - ${d}`,
    allowedOperators: OPS_TIER_3
  };
});

const tier5 = buildTier(2405, (rng) => {
  // Tier 5: 分数中间值，模板 (a + b) ÷ (c ÷ d) = 24。
  const dCandidates = [2, 3, 4, 6] as const;
  const cCandidates = [1, 2, 3, 4, 6] as const;
  const d = dCandidates[randInt(rng, 0, dCandidates.length - 1)];
  const c = cCandidates[randInt(rng, 0, cCandidates.length - 1)];

  const sumNumerator = 24 * c;
  if (sumNumerator % d !== 0) {
    return null;
  }

  const sum = sumNumerator / d;
  if (sum < 2 || sum > 26) {
    return null;
  }

  const a = randInt(rng, 1, 13);
  const b = sum - a;
  if (b < 1 || b > 13) {
    return null;
  }

  return {
    numbers: [a, b, c, d],
    hint: `(${a} + ${b}) ÷ (${c} ÷ ${d})`,
    allowedOperators: OPS_TIER_3
  };
});

const tier6 = buildTier(2406, (rng) => {
  // Tier 6: 引入根号，先取根后乘加。
  const square = randInt(rng, 0, 1) === 0 ? 4 : 9;
  const root = Math.sqrt(square);
  const a = randInt(rng, 4, 7);
  const b = randInt(rng, 1, 9);
  const c = 24 - root * a - b;

  if (c < 1 || c > 13) {
    return null;
  }

  return {
    numbers: [square, a, b, c],
    hint: `√${square} × ${a} + ${b} + ${c}`,
    allowedOperators: OPS_TIER_6
  };
});

const tier7 = buildTier(2407, (rng) => {
  // Tier 7: 引入指数，控制小底数和小指数避免过大结果。
  const a = randInt(rng, 2, 4);
  const b = randInt(rng, 2, 3);
  const c = randInt(rng, 1, 9);
  const d = Math.pow(a, b) + c - 24;

  if (d < 1 || d > 13) {
    return null;
  }

  return {
    numbers: [a, b, c, d],
    hint: `${a} ^ ${b} + ${c} - ${d}`,
    allowedOperators: OPS_TIER_7
  };
});

const tier8 = buildTier(2408, (rng) => {
  // Tier 8: 引入对数（log10），配合乘加。
  const b = randInt(rng, 0, 1) === 0 ? 10 : 100;
  const logv = Math.log10(b);
  const a = randInt(rng, 5, 9);
  const c = randInt(rng, 1, 9);
  const d = 24 - a * logv - c;

  if (d < 1 || d > 13) {
    return null;
  }

  return {
    numbers: [a, b, c, d],
    hint: `${a} × log(${b}) + ${c} + ${d}`,
    allowedOperators: OPS_TIER_8
  };
});

const tier9 = buildTier(2409, (rng) => {
  // Tier 9: 引入阶乘，与其余运算组合。
  const n = randInt(rng, 0, 1) === 0 ? 3 : 4;
  const fact = n === 3 ? 6 : 24;
  const a = randInt(rng, 1, 9);
  const b = randInt(rng, 1, 9);
  const c = fact + a + b - 24;

  if (c < 1 || c > 13) {
    return null;
  }

  return {
    numbers: [n, a, b, c],
    hint: `${n}! + ${a} + ${b} - ${c}`,
    allowedOperators: OPS_TIER_9
  };
});

const tier10 = buildTier(2410, (rng) => {
  // Tier 10: 5 数字关卡，开放全部运算符。
  const mode = randInt(rng, 0, 2);

  if (mode === 0) {
    const a = randInt(rng, 2, 5);
    const b = randInt(rng, 2, 5);
    const c = randInt(rng, 2, 5);
    const d = randInt(rng, 1, 9);
    const e = a * b + c + d - 24;
    if (e >= 1 && e <= 13) {
      return {
        numbers: [a, b, c, d, e],
        hint: `${a} × ${b} + ${c} + ${d} - ${e}`,
        allowedOperators: OPS_TIER_9
      };
    }
  }

  if (mode === 1) {
    const square = randInt(rng, 0, 1) === 0 ? 4 : 9;
    const root = Math.sqrt(square);
    const a = randInt(rng, 2, 4);
    const b = randInt(rng, 2, 3);
    const c = randInt(rng, 1, 8);
    const d = root + Math.pow(a, b) + c - 24;
    if (d >= 1 && d <= 13) {
      return {
        numbers: [square, a, b, c, d],
        hint: `√${square} + ${a} ^ ${b} + ${c} - ${d}`,
        allowedOperators: OPS_TIER_9
      };
    }
  }

  const n = 4;
  const fact = 24;
  const a = randInt(rng, 2, 5);
  const b = randInt(rng, 0, 1) === 0 ? 10 : 100;
  const logv = Math.log10(b);
  const c = randInt(rng, 1, 4);
  const d = fact + a * logv - c - 24;
  if (d < 1 || d > 13) {
    return null;
  }

  return {
    numbers: [n, a, b, c, d],
    hint: `${n}! + ${a} × log(${b}) - ${c} - ${d}`,
    allowedOperators: OPS_TIER_9
  };
});

const generated = [
  ...tier1,
  ...tier2,
  ...tier3,
  ...tier4,
  ...tier5,
  ...tier6,
  ...tier7,
  ...tier8,
  ...tier9,
  ...tier10
];

export const LEVELS: LevelSpec[] = generated.map((item, index) => {
  return level(index + 1, item.numbers, item.hint, item.allowedOperators);
});
