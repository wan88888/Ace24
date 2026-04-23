import type { LevelSpec, OperatorSymbol } from "./types";
import { makePrng, randInt } from "./utils/prng";
import { TARGET } from "./constants";

const EPSILON = 1e-9;

type Op = "+" | "-" | "*" | "/";
const OPS: Op[] = ["+", "-", "*", "/"];

const ALL_OPS_TIER10: OperatorSymbol[] = ["+", "-", "*", "/", "(", ")", "^", "sqrt", "log", "!"];

interface Expr {
  value: number;
  expr: string;
}

function applyOp(a: number, b: number, op: Op): number | null {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (op === "/") return Math.abs(b) < EPSILON ? null : a / b;
  return null;
}

function displayOp(op: Op): string {
  if (op === "*") return "×";
  if (op === "/") return "÷";
  return op;
}

/** Generic recursive solver for any count of inputs using basic ops (+,-,*,/). */
function solveN(inputs: Expr[]): string | null {
  if (inputs.length === 1) {
    if (Math.abs(inputs[0].value - TARGET) < EPSILON) return inputs[0].expr;
    return null;
  }

  for (let i = 0; i < inputs.length; i++) {
    for (let j = 0; j < inputs.length; j++) {
      if (i === j) continue;

      for (const op of OPS) {
        const val = applyOp(inputs[i].value, inputs[j].value, op);
        if (val === null) continue;

        const rest: Expr[] = inputs.filter((_, k) => k !== i && k !== j);
        const combined: Expr = {
          value: val,
          expr: "(" + inputs[i].expr + " " + displayOp(op) + " " + inputs[j].expr + ")"
        };
        const result = solveN([combined, ...rest]);
        if (result !== null) return result;
      }
    }
  }
  return null;
}

function solve(nums: number[]): string | null {
  const inputs: Expr[] = nums.map((n) => ({ value: n, expr: String(n) }));
  return solveN(inputs);
}

export function generateLevel(id: number): LevelSpec {
  const fiveNumbers = id > 100;
  let attempt = 0;

  while (true) {
    const rng = makePrng(id * 9973 + attempt * 31337);
    const numbers: number[] = fiveNumbers
      ? [
          randInt(rng, 1, 10),
          randInt(rng, 1, 10),
          randInt(rng, 1, 10),
          randInt(rng, 1, 10),
          randInt(rng, 1, 10),
        ]
      : [
          randInt(rng, 1, 13),
          randInt(rng, 1, 13),
          randInt(rng, 1, 13),
          randInt(rng, 1, 13),
        ];

    const solution = solve(numbers);

    if (solution !== null) {
      return {
        id,
        description: fiveNumbers
          ? "用 5 个数字和运算符凑出 24。"
          : "用 4 个数字和运算符凑出 24。",
        targetValue: TARGET,
        hint: solution,
        numbers,
        allowedOperators: fiveNumbers ? ALL_OPS_TIER10 : undefined,
      };
    }

    attempt += 1;
  }
}
