/**
 * 博弈论模型：两国贸易博弈（Isoland 进口国 × Neighborland 出口国）
 *
 * NL 策略: 补贴 / 不补贴
 * IS 策略: 自由贸易(接受) / 报复关税
 *
 * 支付用曼昆题设的净福利近似（t=默认补贴强度）：
 *  - 补贴+自由贸易：IS 得接受补贴的净收益 20t+t²；NL 承担补贴净损失（−t²）。
 *  - 补贴+关税：抵消回到世界价，双方净效应≈0。
 *  - 不补贴+自由贸易：基线，双方 0（相对于该基准）。
 *  - 不补贴+关税：IS 自我施加无谓损失 −t²/2；NL 受损 −t²/4。
 */

export type Player = "IS" | "NL";
export type NlStrategy = "subsidy" | "no_subsidy";
export type IsStrategy = "free_trade" | "tariff";

export type PayoffCell = {
  is: number;
  nl: number;
};

export type StrategyLabel = { id: string; label: string };

export interface GameSetup {
  t: number;
  /** 支付矩阵：行=IS策略[free_trade,tariff]，列=NL策略[subsidy,no_subsidy] */
  matrix: PayoffCell[][];
  isStrategies: StrategyLabel[];
  nlStrategies: StrategyLabel[];
}

export function buildGame(tRaw: number): GameSetup {
  const t = Math.max(0, Math.min(30, tRaw));
  const acceptGain = 20 * t + t * t;
  const deadweight = t * t;
  return {
    t,
    isStrategies: [
      { id: "free_trade", label: "自由贸易（接受）" },
      { id: "tariff", label: "报复关税" },
    ],
    nlStrategies: [
      { id: "subsidy", label: "补贴出口" },
      { id: "no_subsidy", label: "不补贴" },
    ],
    matrix: [
      // IS=自由贸易
      [
        { is: acceptGain, nl: -deadweight }, // NL=补贴
        { is: 0, nl: 0 },                   // NL=不补贴
      ],
      // IS=关税
      [
        { is: 0, nl: 0 },                        // NL=补贴，互相抵消
        { is: -deadweight / 2, nl: -deadweight / 4 }, // NL=不补贴，IS自伤
      ],
    ],
  };
}

export type PureNash = {
  isStrategy: string;
  nlStrategy: string;
  payoff: PayoffCell;
};

/** 求纯策略纳什均衡：双方都无法通过单方面偏离提高支付 */
export function pureNashEquilibria(g: GameSetup): PureNash[] {
  const out: PureNash[] = [];
  const M = g.matrix;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const cur = M[i][j];
      const isBest = cur.is >= M[1 - i][j].is; // 换IS策略
      const nlBest = cur.nl >= M[i][1 - j].nl; // 换NL策略
      if (isBest && nlBest) {
        out.push({
          isStrategy: g.isStrategies[i].id,
          nlStrategy: g.nlStrategies[j].id,
          payoff: cur,
        });
      }
    }
  }
  return out;
}

/** 某方策略是否为占优策略 */
export function dominantStrategies(g: GameSetup): {
  is: string | null;
  nl: string | null;
} {
  const M = g.matrix;
  // IS: free_trade(i=0) vs tariff(i=1)，对两种NL列都不差则占优
  const freeDom = [0, 1].every((j) => M[0][j].is >= M[1][j].is);
  const tariffDom = [0, 1].every((j) => M[1][j].is >= M[0][j].is);
  const subDom = [0, 1].every((i) => M[i][0].nl >= M[i][1].nl);
  const noSubDom = [0, 1].every((i) => M[i][1].nl >= M[i][0].nl);
  return {
    is: freeDom && !tariffDom ? "free_trade" : tariffDom && !freeDom ? "tariff" : null,
    nl: subDom && !noSubDom ? "subsidy" : noSubDom && !subDom ? "no_subsidy" : null,
  };
}

export type MixedNash = {
  /** IS 选 free_trade 的概率 */
  pFreeTrade: number;
  /** NL 选 subsidy 的概率 */
  pSubsidy: number;
};

/**
 * 混合策略纳什均衡（2×2）：令对方在两策略间无差异。
 * 无内点解（分母为0）时返回 null。
 */
export function mixedNash(g: GameSetup): MixedNash | null {
  const M = g.matrix;
  // NL 无差异条件（对 IS 的混合 p）:
  //   p*M[0][0].nl + (1-p)*M[1][0].nl = p*M[0][1].nl + (1-p)*M[1][1].nl
  const a = M[0][0].nl - M[1][0].nl - M[0][1].nl + M[1][1].nl;
  const b = M[1][1].nl - M[1][0].nl;
  // IS 无差异条件（对 NL 的混合 q）:
  const c = M[0][0].is - M[0][1].is - M[1][0].is + M[1][1].is;
  const d = M[1][1].is - M[1][0].is;
  if (Math.abs(a) < 1e-12 || Math.abs(c) < 1e-12) return null;
  const p = b / a;
  const q = d / c;
  const inRange = (x: number) => x >= -1e-9 && x <= 1 + 1e-9;
  if (!inRange(p) || !inRange(q)) return null;
  return { pFreeTrade: clamp01(p), pSubsidy: clamp01(q) };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
