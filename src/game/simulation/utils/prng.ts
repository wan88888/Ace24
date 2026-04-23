export type Rng = () => number;

export const makePrng = (seed: number): Rng => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

export const randInt = (rng: Rng, min: number, max: number): number => {
  return min + Math.floor(rng() * (max - min + 1));
};
