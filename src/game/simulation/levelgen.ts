import type { LevelSpec } from './types';

const TARGET = 24;
const EPSILON = 1e-9;

type Op = '+' | '-' | '*' | '/';
const OPS: Op[] = ['+', '-', '*', '/'];

function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function applyOp(a: number, b: number, op: Op): number | null {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') return Math.abs(b) < EPSILON ? null : a / b;
  return null;
}

function displayOp(op: Op): string {
  if (op === '*') return '×';
  if (op === '/') return '÷';
  return op;
}

function solve24(nums: [number, number, number, number]): string | null {
  // Try all 24 permutations of indices
  const idx = [0, 1, 2, 3];
  const perms: number[][] = [];
  for (const i of idx) {
    for (const j of idx) {
      if (j === i) continue;
      for (const k of idx) {
        if (k === i || k === j) continue;
        const l = 6 - i - j - k;
        perms.push([nums[i], nums[j], nums[k], nums[l]]);
      }
    }
  }

  for (const [a, b, c, d] of perms) {
    for (const op1 of OPS) {
      for (const op2 of OPS) {
        for (const op3 of OPS) {
          // Structure 1: ((a op1 b) op2 c) op3 d
          const s1r1 = applyOp(a, b, op1);
          if (s1r1 !== null) {
            const s1r2 = applyOp(s1r1, c, op2);
            if (s1r2 !== null) {
              const s1r3 = applyOp(s1r2, d, op3);
              if (s1r3 !== null && Math.abs(s1r3 - TARGET) < EPSILON) {
                return `((${a} ${displayOp(op1)} ${b}) ${displayOp(op2)} ${c}) ${displayOp(op3)} ${d}`;
              }
            }
          }

          // Structure 2: (a op1 (b op2 c)) op3 d
          const s2r1 = applyOp(b, c, op2);
          if (s2r1 !== null) {
            const s2r2 = applyOp(a, s2r1, op1);
            if (s2r2 !== null) {
              const s2r3 = applyOp(s2r2, d, op3);
              if (s2r3 !== null && Math.abs(s2r3 - TARGET) < EPSILON) {
                return `(${a} ${displayOp(op1)} (${b} ${displayOp(op2)} ${c})) ${displayOp(op3)} ${d}`;
              }
            }
          }

          // Structure 3: (a op1 b) op2 (c op3 d)
          const s3r1 = applyOp(a, b, op1);
          const s3r2 = applyOp(c, d, op3);
          if (s3r1 !== null && s3r2 !== null) {
            const s3r3 = applyOp(s3r1, s3r2, op2);
            if (s3r3 !== null && Math.abs(s3r3 - TARGET) < EPSILON) {
              return `(${a} ${displayOp(op1)} ${b}) ${displayOp(op2)} (${c} ${displayOp(op3)} ${d})`;
            }
          }

          // Structure 4: a op1 ((b op2 c) op3 d)
          const s4r1 = applyOp(b, c, op2);
          if (s4r1 !== null) {
            const s4r2 = applyOp(s4r1, d, op3);
            if (s4r2 !== null) {
              const s4r3 = applyOp(a, s4r2, op1);
              if (s4r3 !== null && Math.abs(s4r3 - TARGET) < EPSILON) {
                return `${a} ${displayOp(op1)} ((${b} ${displayOp(op2)} ${c}) ${displayOp(op3)} ${d})`;
              }
            }
          }

          // Structure 5: a op1 (b op2 (c op3 d))
          const s5r1 = applyOp(c, d, op3);
          if (s5r1 !== null) {
            const s5r2 = applyOp(b, s5r1, op2);
            if (s5r2 !== null) {
              const s5r3 = applyOp(a, s5r2, op1);
              if (s5r3 !== null && Math.abs(s5r3 - TARGET) < EPSILON) {
                return `${a} ${displayOp(op1)} (${b} ${displayOp(op2)} (${c} ${displayOp(op3)} ${d}))`;
              }
            }
          }
        }
      }
    }
  }

  return null;
}

export function generateLevel(id: number): LevelSpec {
  let attempt = 0;

  while (true) {
    const rng = makePrng(id * 9973 + attempt * 31337);
    const numbers: [number, number, number, number] = [
      randInt(rng, 1, 13),
      randInt(rng, 1, 13),
      randInt(rng, 1, 13),
      randInt(rng, 1, 13),
    ];
    const solution = solve24(numbers);

    if (solution !== null) {
      return {
        id,
        description: '用 4 个数字和运算符凑出 24。',
        targetValue: TARGET,
        hint: solution,
        numbers,
      };
    }

    attempt += 1;
  }
}
