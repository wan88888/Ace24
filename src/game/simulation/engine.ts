import { LEVELS } from './levels';
import { generateLevel } from './levelgen';
import type {
  ActionResult,
  GameSnapshot,
  LevelSpec,
  OperatorSymbol
} from './types';

interface NumberToken {
  kind: 'number';
  value: number;
  numberIndex: number;
}

interface OperatorToken {
  kind: 'operator';
  value: OperatorSymbol;
}

type RoundToken = NumberToken | OperatorToken;

interface RoundState {
  tokens: RoundToken[];
  usedNumberIndices: Set<number>;
  value: number;
}

const BASIC_OPERATOR_SYMBOLS: OperatorSymbol[] = ['+', '-', '*', '/', '(', ')'];
const ALL_OPERATOR_SYMBOLS: OperatorSymbol[] = ['+', '-', '*', '/', '(', ')', '^', 'sqrt', 'log', '!'];
const BINARY_OPERATORS = new Set<OperatorSymbol>(['+', '-', '*', '/', '^']);
const PREFIX_UNARY_OPERATORS = new Set<OperatorSymbol>(['sqrt', 'log']);
const POSTFIX_UNARY_OPERATORS = new Set<OperatorSymbol>(['!']);
const EPSILON = 1e-9;
const TIER_SIZE = 10;
const TIER_REWARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

const precedence = (operator: OperatorSymbol): number => {
  if (operator === '+' || operator === '-') {
    return 1;
  }

  if (operator === '*' || operator === '/') {
    return 2;
  }

  if (operator === '^') {
    return 3;
  }

  if (operator === 'sqrt' || operator === 'log') {
    return 4;
  }

  if (operator === '!') {
    return 5;
  }

  return 0;
};

const isRightAssociative = (operator: OperatorSymbol): boolean => {
  return operator === '^' || operator === 'sqrt' || operator === 'log';
};

const displayOperator = (operator: OperatorSymbol): string => {
  if (operator === '*') {
    return '×';
  }

  if (operator === '/') {
    return '÷';
  }

  if (operator === 'sqrt') {
    return '√';
  }

  return operator;
};

export class Ace21Engine {
  private readonly staticLevels: LevelSpec[];
  private readonly levelCache = new Map<number, LevelSpec>();
  private readonly hintCost = 10;
  private readonly skipCost = 20;
  private beans = 20;
  private levelIndex = 0;
  private unlockedLevels = 1;
  private readonly levelBestStars = new Map<number, number>();
  private roundState: RoundState;

  constructor(customLevels: LevelSpec[] = LEVELS) {
    if (customLevels.length === 0) {
      throw new Error('至少需要一个关卡。');
    }

    this.staticLevels = customLevels;
    this.roundState = this.createFreshRoundState();
  }

  private getLevel(index: number): LevelSpec {
    if (!this.levelCache.has(index)) {
      if (index < this.staticLevels.length) {
        this.levelCache.set(index, this.staticLevels[index]);
      } else {
        this.levelCache.set(index, generateLevel(index + 1));
      }
    }
    return this.levelCache.get(index)!;
  }

  public get currentLevel(): LevelSpec {
    return this.getLevel(this.levelIndex);
  }

  public get totalLevels(): number {
    return 9999;
  }

  public getLevelByIndex(index: number): LevelSpec {
    return this.getLevel(index);
  }

  public isLevelUnlocked(index: number): boolean {
    return index + 1 <= this.unlockedLevels;
  }

  public getLevelBestStars(index: number): number {
    const level = this.getLevel(index);

    return this.levelBestStars.get(level.id) ?? 0;
  }

  public playCard(numberIndex: number): ActionResult {
    const level = this.currentLevel;

    if (numberIndex < 0 || numberIndex >= level.numbers.length) {
      return { ok: false, message: '没有找到这个数字。' };
    }

    if (this.roundState.usedNumberIndices.has(numberIndex)) {
      return { ok: false, message: '这个数字已经用过了。' };
    }

    if (!this.expectsNumberToken()) {
      return { ok: false, message: '当前位置需要运算符。' };
    }

    this.roundState.tokens.push({
      kind: 'number',
      value: level.numbers[numberIndex],
      numberIndex
    });
    this.roundState.usedNumberIndices.add(numberIndex);

    this.refreshValue();

    return {
      ok: true,
      message: `已加入数字 ${level.numbers[numberIndex]}。`
    };
  }

  public playOperator(operator: OperatorSymbol): ActionResult {
    const allowed = this.currentLevel.allowedOperators ?? BASIC_OPERATOR_SYMBOLS;

    if (!ALL_OPERATOR_SYMBOLS.includes(operator) || !allowed.includes(operator)) {
      return { ok: false, message: '不支持这个运算符。' };
    }

    const expectingNumber = this.expectsNumberToken();

    if (operator === '(') {
      if (!expectingNumber) {
        return { ok: false, message: '这里不能直接放左括号。' };
      }
    } else if (operator === ')') {
      if (expectingNumber) {
        return { ok: false, message: '右括号前需要数字或右括号。' };
      }

      if (this.getOpenParenthesesCount() <= 0) {
        return { ok: false, message: '没有可闭合的左括号。' };
      }
    } else if (BINARY_OPERATORS.has(operator)) {
      if (expectingNumber) {
        return { ok: false, message: '这里需要先放数字或左括号。' };
      }
    } else if (PREFIX_UNARY_OPERATORS.has(operator)) {
      if (!expectingNumber) {
        return { ok: false, message: '这里不能直接放该一元运算符。' };
      }
    } else if (POSTFIX_UNARY_OPERATORS.has(operator)) {
      if (expectingNumber) {
        return { ok: false, message: '该一元运算符前需要数字或右括号。' };
      }
    }

    this.roundState.tokens.push({
      kind: 'operator',
      value: operator
    });

    this.refreshValue();

    return {
      ok: true,
      message: `已加入运算符 ${displayOperator(operator)}。`
    };
  }

  public undo(): ActionResult {
    const lastToken = this.roundState.tokens.pop();

    if (!lastToken) {
      return { ok: false, message: '没有可撤销的步骤。' };
    }

    if (lastToken.kind === 'number') {
      this.roundState.usedNumberIndices.delete(lastToken.numberIndex);
    }

    this.refreshValue();

    return {
      ok: true,
      message: '已撤销最后一步。'
    };
  }

  public clearMoves(): ActionResult {
    this.roundState = this.createFreshRoundState();

    return {
      ok: true,
      message: '表达式已清空。'
    };
  }

  public restartLevel(): ActionResult {
    return this.clearMoves();
  }

  public submit(): ActionResult {
    if (!this.isExpressionComplete()) {
      return {
        ok: false,
        message: '表达式尚未完成。'
      };
    }

    if (this.roundState.usedNumberIndices.size !== this.currentLevel.numbers.length) {
      return {
        ok: false,
        message: `请使用本关全部 ${this.currentLevel.numbers.length} 个数字。`
      };
    }

    const evaluation = this.evaluateTokens(this.roundState.tokens);
    if (!evaluation.ok || evaluation.value === null) {
      return {
        ok: false,
        message: '表达式无效，请调整后重试。'
      };
    }

    if (Math.abs(evaluation.value - this.currentLevel.targetValue) > EPSILON) {
      return {
        ok: false,
        message: `结果是 ${this.formatNumber(evaluation.value)}，目标是 ${this.currentLevel.targetValue}。`
      };
    }

    const stars = this.computeStars(this.roundState.tokens.length);
    const previousBest = this.levelBestStars.get(this.currentLevel.id) ?? 0;

    if (stars > previousBest) {
      this.levelBestStars.set(this.currentLevel.id, stars);
    }

    const tierReward = this.getTierReward();
    this.beans += tierReward;

    let unlockedNext = false;

    if (this.levelIndex + 1 === this.unlockedLevels) {
      this.unlockedLevels += 1;
      unlockedNext = true;
    }

    return {
      ok: true,
      message: unlockedNext
        ? `过关！评分 ${stars} 星，奖励 ⭐${tierReward}，并解锁了下一关。`
        : `过关！评分 ${stars} 星，奖励 ⭐${tierReward}。`,
      stars,
      unlockedNext,
      beanReward: tierReward
    };
  }

  private getTierReward(): number {
    const tierIndex = Math.floor(this.levelIndex / TIER_SIZE);
    return TIER_REWARDS[Math.min(tierIndex, TIER_REWARDS.length - 1)];
  }

  public goToLevel(index: number): ActionResult {
    if (index < 0) {
      return {
        ok: false,
        message: '关卡索引越界。'
      };
    }

    if (index + 1 > this.unlockedLevels) {
      return {
        ok: false,
        message: `第 ${index + 1} 关尚未解锁。`
      };
    }

    this.levelIndex = index;
    this.roundState = this.createFreshRoundState();

    return {
      ok: true,
      message: `已进入第 ${index + 1} 关。`
    };
  }

  public nextLevel(): ActionResult {
    return this.goToLevel(this.levelIndex + 1);
  }

  public skipLevel(): ActionResult {
    const paid = this.payBeans(this.skipCost, `跳关需要 ${this.skipCost} 豆子。`);
    if (!paid.ok) {
      return paid;
    }

    const nextLevelIndex = this.levelIndex + 1;

    if (this.unlockedLevels < nextLevelIndex + 1) {
      this.unlockedLevels = nextLevelIndex + 1;
    }

    this.levelIndex = nextLevelIndex;
    this.roundState = this.createFreshRoundState();

    return {
      ok: true,
      message: `已花费 ${this.skipCost} 豆子，跳过到第 ${this.levelIndex + 1} 关。`
    };
  }

  public useHint(): ActionResult {
    const paid = this.payBeans(this.hintCost, `提示需要 ${this.hintCost} 豆子。`);
    if (!paid.ok) {
      return paid;
    }

    return {
      ok: true,
      message: `提示：${this.currentLevel.hint}（已消耗 ${this.hintCost} 豆子）`
    };
  }

  public previousLevel(): ActionResult {
    if (this.levelIndex === 0) {
      return {
        ok: false,
        message: '已经是第一关。'
      };
    }

    return this.goToLevel(this.levelIndex - 1);
  }

  public getSnapshot(): GameSnapshot {
    const level = this.currentLevel;
    const targetReached = this.isTargetReached();

    return {
      levelIndex: this.levelIndex,
      level,
      value: this.roundState.value,
      beans: this.beans,
      hintCost: this.hintCost,
      skipCost: this.skipCost,
      movesUsed: this.roundState.tokens.length,
      remainingMoves: Math.max(level.numbers.length - this.roundState.usedNumberIndices.size, 0),
      usedNumberIndices: Array.from(this.roundState.usedNumberIndices.values()),
      operatorSymbols: [...(level.allowedOperators ?? BASIC_OPERATOR_SYMBOLS)],
      expression: this.getExpressionDisplayText(),
      levelBestStars: this.levelBestStars.get(level.id) ?? 0,
      totalLevels: this.totalLevels,
      unlockedLevels: this.unlockedLevels,
      solvedLevels: this.levelBestStars.size,
      targetReached
    };
  }

  private createFreshRoundState(): RoundState {
    return {
      tokens: [],
      usedNumberIndices: new Set<number>(),
      value: 0
    };
  }

  private computeStars(tokenCount: number): number {
    if (tokenCount <= 7) {
      return 3;
    }

    if (tokenCount <= 9) {
      return 2;
    }

    return 1;
  }

  private payBeans(cost: number, costLabel: string): ActionResult {
    if (this.beans < cost) {
      return {
        ok: false,
        message: `豆子不足（当前 ${this.beans}），${costLabel}`
      };
    }

    this.beans -= cost;

    return {
      ok: true,
      message: `已消耗 ${cost} 豆子。`
    };
  }

  private expectsNumberToken(): boolean {
    if (this.roundState.tokens.length === 0) {
      return true;
    }

    const lastToken = this.roundState.tokens[this.roundState.tokens.length - 1];

    if (lastToken.kind === 'number') {
      return false;
    }

    return lastToken.value !== ')' && !POSTFIX_UNARY_OPERATORS.has(lastToken.value);
  }

  private getOpenParenthesesCount(): number {
    let count = 0;

    for (const token of this.roundState.tokens) {
      if (token.kind !== 'operator') {
        continue;
      }

      if (token.value === '(') {
        count += 1;
      } else if (token.value === ')') {
        count -= 1;
      }
    }

    return count;
  }

  private isExpressionComplete(): boolean {
    if (this.roundState.tokens.length === 0) {
      return false;
    }

    if (this.expectsNumberToken()) {
      return false;
    }

    return this.getOpenParenthesesCount() === 0;
  }

  private isTargetReached(): boolean {
    if (!this.isExpressionComplete()) {
      return false;
    }

    if (this.roundState.usedNumberIndices.size !== this.currentLevel.numbers.length) {
      return false;
    }

    const evaluation = this.evaluateTokens(this.roundState.tokens);
    if (!evaluation.ok || evaluation.value === null) {
      return false;
    }

    return Math.abs(evaluation.value - this.currentLevel.targetValue) <= EPSILON;
  }

  private refreshValue(): void {
    const evaluation = this.evaluateTokens(this.roundState.tokens);

    if (evaluation.ok && evaluation.value !== null) {
      this.roundState.value = evaluation.value;
      return;
    }

    if (this.roundState.tokens.length === 0) {
      this.roundState.value = 0;
    }
  }

  private evaluateTokens(tokens: RoundToken[]): { ok: boolean; value: number | null } {
    if (tokens.length === 0) {
      return { ok: false, value: null };
    }

    if (!this.isExpressionComplete()) {
      return { ok: false, value: null };
    }

    const output: Array<number | OperatorSymbol> = [];
    const operators: OperatorSymbol[] = [];

    for (const token of tokens) {
      if (token.kind === 'number') {
        output.push(token.value);
        continue;
      }

      if (token.value === '(') {
        operators.push(token.value);
        continue;
      }

      if (token.value === ')') {
        while (operators.length > 0 && operators[operators.length - 1] !== '(') {
          const operator = operators.pop();
          if (!operator) {
            return { ok: false, value: null };
          }

          output.push(operator);
        }

        if (operators.length === 0 || operators[operators.length - 1] !== '(') {
          return { ok: false, value: null };
        }

        operators.pop();

        while (
          operators.length > 0 &&
          PREFIX_UNARY_OPERATORS.has(operators[operators.length - 1])
        ) {
          const op = operators.pop();
          if (!op) {
            return { ok: false, value: null };
          }
          output.push(op);
        }
        continue;
      }

      while (
        operators.length > 0 &&
        operators[operators.length - 1] !== '(' &&
        (isRightAssociative(token.value)
          ? precedence(operators[operators.length - 1]) > precedence(token.value)
          : precedence(operators[operators.length - 1]) >= precedence(token.value))
      ) {
        const operator = operators.pop();
        if (!operator) {
          return { ok: false, value: null };
        }

        output.push(operator);
      }

      operators.push(token.value);
    }

    while (operators.length > 0) {
      const operator = operators.pop();
      if (!operator || operator === '(') {
        return { ok: false, value: null };
      }

      output.push(operator);
    }

    const valueStack: number[] = [];

    for (const item of output) {
      if (typeof item === 'number') {
        valueStack.push(item);
        continue;
      }

      if (!this.applyOperator(valueStack, item)) {
        return { ok: false, value: null };
      }
    }

    if (valueStack.length !== 1) {
      return { ok: false, value: null };
    }

    return { ok: true, value: valueStack[0] };
  }

  private applyOperator(stack: number[], operator: OperatorSymbol): boolean {
    if (BINARY_OPERATORS.has(operator)) {
      const right = stack.pop();
      const left = stack.pop();

      if (left === undefined || right === undefined) {
        return false;
      }

      let result = 0;

      if (operator === '+') {
        result = left + right;
      } else if (operator === '-') {
        result = left - right;
      } else if (operator === '*') {
        result = left * right;
      } else if (operator === '/') {
        if (Math.abs(right) <= EPSILON) {
          return false;
        }

        result = left / right;
      } else if (operator === '^') {
        result = Math.pow(left, right);
      } else {
        return false;
      }

      if (!Number.isFinite(result)) {
        return false;
      }

      stack.push(result);
      return true;
    }

    const value = stack.pop();
    if (value === undefined) {
      return false;
    }

    if (operator === 'sqrt') {
      if (value < -EPSILON) {
        return false;
      }
      stack.push(Math.sqrt(Math.max(0, value)));
      return true;
    }

    if (operator === 'log') {
      if (value <= EPSILON) {
        return false;
      }
      stack.push(Math.log10(value));
      return true;
    }

    if (operator === '!') {
      const rounded = Math.round(value);
      if (Math.abs(value - rounded) > EPSILON || rounded < 0 || rounded > 10) {
        return false;
      }

      let f = 1;
      for (let i = 2; i <= rounded; i += 1) {
        f *= i;
      }

      stack.push(f);
      return true;
    }

    return false;
  }

  private getExpressionDisplayText(): string {
    if (this.roundState.tokens.length === 0) {
      return '';
    }

    return this.roundState.tokens
      .map((token) => {
        if (token.kind === 'number') {
          return String(token.value);
        }

        return displayOperator(token.value);
      })
      .join(' ');
  }

  private formatNumber(value: number): string {
    if (Math.abs(value - Math.round(value)) <= EPSILON) {
      return String(Math.round(value));
    }

    return String(Number(value.toFixed(3)));
  }
}
