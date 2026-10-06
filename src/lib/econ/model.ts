/**
 * Isoland × Neighborland export-subsidy welfare model.
 * Mankiw, Principles of Economics, Ch.9.
 *
 * Demand D: Q = 120 − P
 * Supply S: Q = P − 20
 * Free-trade world price P1 = 60; subsidy t ∈ [0, 30]; post-subsidy price P2 = P1 − t
 */

export const P1 = 60;
export const T_MAX = 30;
export const AUTARKY_P = 70;

export type Mode = "accept" | "tariff";
export type ChartView = "bar" | "curve";
export type ScenarioKey = "accept" | "tariff" | "ban";

export type CalcResult = {
  t: number;
  p1: number;
  p2: number;
  qd1: number;
  qs1: number;
  qd2: number;
  qs2: number;
  imports: number;
  cs: number;
  ps: number;
  net: number;
};

export type Scenario = {
  key: ScenarioKey;
  name: string;
  consumer: number;
  producer: number;
  government: number;
  dwl: number;
  net: number;
};

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function demandQ(p: number) {
  return 120 - p;
}

export function supplyQ(p: number) {
  return p - 20;
}

export function calc(tRaw: number): CalcResult {
  const t = clamp(tRaw, 0, T_MAX);
  const p2 = P1 - t;
  const qd2 = demandQ(p2);
  const qs2 = supplyQ(p2);
  const cs = (t * (120 + t)) / 2;
  const ps = -(t * (80 - t)) / 2 + 0;
  return {
    t,
    p1: P1,
    p2,
    qd1: demandQ(P1),
    qs1: supplyQ(P1),
    qd2,
    qs2,
    imports: qd2 - qs2,
    cs,
    ps,
    net: cs + ps,
  };
}

export function scenarios(tRaw: number): Record<ScenarioKey, Scenario> {
  const t = clamp(tRaw, 0, T_MAX);
  const m = calc(t);
  return {
    accept: {
      key: "accept",
      name: "接受补贴",
      consumer: m.cs,
      producer: m.ps,
      government: 0,
      dwl: 0,
      net: 20 * t + t * t,
    },
    tariff: {
      key: "tariff",
      name: "报复关税",
      consumer: 0,
      producer: 0,
      government: 20 * t,
      dwl: -t * t,
      net: 20 * t - t * t,
    },
    ban: {
      key: "ban",
      name: "禁止进口",
      consumer: -550,
      producer: 450,
      government: 0,
      dwl: 0,
      net: -100,
    },
  };
}

export function netCurve(steps = 31) {
  const xs: number[] = [];
  for (let i = 0; i < steps; i++) xs.push((T_MAX * i) / (steps - 1));
  return {
    xs,
    accept: xs.map((t) => 20 * t + t * t),
    tariff: xs.map((t) => 20 * t - t * t),
  };
}

export function fmt(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtSigned(n: number) {
  return (n >= 0 ? "+" : "−") + fmt(Math.abs(n));
}
