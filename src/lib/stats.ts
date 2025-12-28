export type Percentiles = {
  // 0-100
  valuePctHigherBetter: (value: number) => number | null;
  passEasePctHigherBetter: (value: number) => number | null; // lower difficulty => higher ease percentile
  highScoreEasePctHigherBetter: (value: number) => number | null;
};

function isFiniteNumber(n: number): boolean {
  return Number.isFinite(n) && !Number.isNaN(n);
}

function sortNums(nums: number[]): number[] {
  return [...nums].filter(isFiniteNumber).sort((a, b) => a - b);
}

// percentile of "value is high" (higher better):
// p = (# <= x)/N * 100
function percentileHigherBetter(sortedAsc: number[], x: number): number | null {
  if (!sortedAsc.length || !isFiniteNumber(x)) return null;
  // upper_bound: first index with > x
  let lo = 0;
  let hi = sortedAsc.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAsc[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return (lo / sortedAsc.length) * 100;
}

// "lower is better" -> convert to "ease" percentile (higher better):
// easePct = (# >= x)/N * 100
function percentileLowerBetterAsEase(sortedAsc: number[], x: number): number | null {
  if (!sortedAsc.length || !isFiniteNumber(x)) return null;
  // lower_bound: first index with >= x
  let lo = 0;
  let hi = sortedAsc.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAsc[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  const countGE = sortedAsc.length - lo;
  return (countGE / sortedAsc.length) * 100;
}

export function buildPercentiles(groups: { valueAvg: number; passDifficultyAvg: number; highScoreDifficultyAvg: number }[]): Percentiles {
  const value = sortNums(groups.map((g) => g.valueAvg));
  const pass = sortNums(groups.map((g) => g.passDifficultyAvg));
  const high = sortNums(groups.map((g) => g.highScoreDifficultyAvg));

  return {
    valuePctHigherBetter: (x) => percentileHigherBetter(value, x),
    passEasePctHigherBetter: (x) => percentileLowerBetterAsEase(pass, x),
    highScoreEasePctHigherBetter: (x) => percentileLowerBetterAsEase(high, x),
  };
}


