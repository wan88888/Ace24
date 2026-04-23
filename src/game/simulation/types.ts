export type OperatorSymbol = '+' | '-' | '*' | '/' | '(' | ')' | '^' | 'sqrt' | 'log' | '!';

export interface LevelSpec {
  id: number;
  description: string;
  targetValue: number;
  hint: string;
  numbers: number[];
  allowedOperators?: OperatorSymbol[];
}

export interface ActionResult {
  ok: boolean;
  message: string;
  stars?: number;
  unlockedNext?: boolean;
  beanReward?: number;
}

export interface GameSnapshot {
  levelIndex: number;
  level: LevelSpec;
  value: number;
  beans: number;
  hintCost: number;
  skipCost: number;
  movesUsed: number;
  remainingMoves: number;
  usedNumberIndices: number[];
  operatorSymbols: OperatorSymbol[];
  expression: string;
  levelBestStars: number;
  totalLevels: number;
  unlockedLevels: number;
  solvedLevels: number;
  targetReached: boolean;
}
