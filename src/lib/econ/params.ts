/**
 * 参数化经济模型 + 弹性 + 敏感性分析。
 * 默认参数即曼昆题设（需求 Q=a-bP，供给 Q=c+dP，世界价 Pw）。
 */

export interface EconParams {
  a: number;   // 需求截距
  b: number;   // 需求斜率(>0)
  c: number;   // 供给截距(可为负)
  d: number;   // 供给斜率(>0)
  pw: number;  // 世界价
}

export const DEFAULT_PARAMS: EconParams = {
  a: 120, b: 1, c: -20, d: 1, pw: 60,
};

export function demandQ(p: number, q: EconParams = DEFAULT_PARAMS) {
  return q.a - q.b * p;
}
export function supplyQ(p: number, q: EconParams = DEFAULT_PARAMS) {
  return q.c + q.d * p;
}
/** 自给自足均衡价 */
export function autarkyPrice(q: EconParams) {
  return (q.a - q.c) / (q.b + q.d);
}

/**
 * 出口补贴 t 的福利分解（参数化版）。
 * 补贴后国内价 P2=Pw-t；用线性供需的三角形面积。
 */
export interface WelfareCalc {
  t: number; p1: number; p2: number;
  qd1: number; qs1: number; qd2: number; qs2: number;
  imports1: number; imports2: number;
  cs: number; ps: number; net: number;
}
export function welfareWithParams(tRaw: number, q: EconParams): WelfareCalc {
  const autP = autarkyPrice(q);
  const t = Math.max(0, Math.min(autP - q.pw, tRaw));
  const p2 = q.pw - t;
  const qd1 = demandQ(q.pw, q), qs1 = supplyQ(q.pw, q);
  const qd2 = demandQ(p2, q), qs2 = supplyQ(p2, q);
  // 消费者剩余增量 = t*(qd1+qd2)/2；生产者剩余增量 = -t*(qs1+qs2)/2
  const cs = (t * (qd1 + qd2)) / 2;
  const ps = -(t * (qs1 + qs2)) / 2;
  return {
    t, p1: q.pw, p2,
    qd1, qs1, qd2, qs2,
    imports1: qd1 - qs1, imports2: qd2 - qs2,
    cs, ps, net: cs + ps,
  };
}

/** 需求价格弹性（点弹性，正值） */
export function demandElasticity(p: number, q: EconParams) {
  const Qd = demandQ(p, q);
  return Qd === 0 ? Infinity : Math.abs((q.b * p) / Qd);
}
/** 供给价格弹性（点弹性） */
export function supplyElasticity(p: number, q: EconParams) {
  const Qs = supplyQ(p, q);
  return Qs === 0 ? Infinity : Math.abs((q.d * p) / Qs);
}

/**
 * 敏感性二维扫描：补贴 t × 某参数（默认需求斜率b），
 * 返回净福利矩阵供热力图。
 */
export interface SensitivityGrid {
  tAxis: number[];
  paramAxis: number[];
  paramName: keyof EconParams;
  grid: number[][];
}
export function sensitivityGrid(
  paramName: keyof EconParams = "b",
  paramValues?: number[],
  tValues?: number[],
): SensitivityGrid {
  const tAxis = tValues ?? [0, 5, 10, 15, 20, 25, 30];
  const paramAxis = paramValues ?? [0.5, 0.75, 1, 1.25, 1.5];
  const grid = paramAxis.map((pv) =>
    tAxis.map((tv) => {
      const q = { ...DEFAULT_PARAMS, [paramName]: pv };
      return welfareWithParams(tv, q).net;
    }),
  );
  return { tAxis, paramAxis, paramName, grid };
}
