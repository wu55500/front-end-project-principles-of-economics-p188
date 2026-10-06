/**
 * 蒙特卡洛模拟：把"确定值"升级为"概率分布"。
 * 对补贴 t、供需冲击加随机扰动，模拟净福利 net=20t+t²（接受情景），
 * 产出分布、分位数、90%区间、净福利为负的概率。
 */

// 确定性净福利（接受补贴），可注入弹性扰动
export function deterministicNet(t: number) {
  return 20 * t + t * t;
}

export interface McOptions {
  t: number;
  nSims?: number;
  /** t 的相对波动（标准差占t比例），默认 0.1 */
  tVol?: number;
  /** 外生福利冲击标准差（绝对值），默认随 t 缩放 */
  shockVol?: number;
  /** 固定随机种子以可复现（可选） */
  seed?: number;
}

export interface McResult {
  nSims: number;
  mean: number;
  sd: number;
  p05: number;
  p95: number;
  pNegative: number;
  histogram: { x0: number; x1: number; count: number }[];
  samples: number[];
  deterministic: number;
}

// 可复现 PRNG（mulberry32）
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Box-Muller 正态
function gaussian(rand: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function monteCarloNet(opt: McOptions): McResult {
  const nSims = opt.nSims ?? 5000;
  const tVol = opt.tVol ?? 0.1;
  const shockVol = opt.shockVol ?? Math.max(20, opt.t * 2);
  const rand = mulberry32(opt.seed ?? 123456);

  const samples: number[] = [];
  for (let i = 0; i < nSims; i++) {
    // t 非负截断正态扰动
    const tSim = Math.max(0, opt.t * (1 + gaussian(rand) * tVol));
    const shock = gaussian(rand) * shockVol;
    samples.push(deterministicNet(tSim) + shock);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((s, x) => s + x, 0) / nSims;
  const sd = Math.sqrt(samples.reduce((s, x) => s + (x - mean) ** 2, 0) / nSims);
  const quantile = (p: number) =>
    sorted[Math.min(nSims - 1, Math.max(0, Math.floor(p * nSims)))];
  const pNegative = samples.filter((x) => x < 0).length / nSims;

  // 直方图（20桶）
  const lo = sorted[0], hi = sorted[nSims - 1];
  const bins = 20;
  const width = (hi - lo) / bins || 1;
  const histogram = Array.from({ length: bins }, (_, b) => ({
    x0: lo + b * width,
    x1: lo + (b + 1) * width,
    count: 0,
  }));
  for (const x of samples) {
    const idx = Math.min(bins - 1, Math.floor((x - lo) / width));
    histogram[idx].count++;
  }

  return {
    nSims,
    mean: round(mean), sd: round(sd),
    p05: round(quantile(0.05)), p95: round(quantile(0.95)),
    pNegative: Math.round(pNegative * 10000) / 10000,
    histogram, samples,
    deterministic: round(deterministicNet(opt.t)),
  };
}

function round(x: number) {
  return Math.round(x * 100) / 100;
}
