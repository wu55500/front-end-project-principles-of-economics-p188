/**
 * Pure World Bank helpers: no network, no DB, no framework imports so they can
 * run under Node's built-in type stripping in unit tests.
 */

// Curated, trade-relevant indicators (World Bank codes).
export const WB_INDICATORS: { code: string; label: string; unit: string }[] = [
  { code: "NE.TRD.GNFS.ZS", label: "贸易占GDP比重", unit: "%" },
  { code: "NE.IMP.GNFS.ZS", label: "商品与服务进口/GDP", unit: "%" },
  { code: "NE.EXP.GNFS.ZS", label: "商品与服务出口/GDP", unit: "%" },
  { code: "BN.CAB.XOKA.GD.ZS", label: "经常账户余额/GDP", unit: "%" },
];

export interface IndicatorPoint {
  year: number;
  value: number | null;
}

/**
 * Parse the World Bank v2 envelope `[meta, rows[]]`. Tolerates missing/garbled
 * payloads and drops non-numeric, infinite or undated rows; result is sorted
 * ascending by year.
 */
export function parseWorldBankPayload(json: unknown): IndicatorPoint[] {
  const rows = Array.isArray(json)
    ? (json[1] as { date?: string; value?: number | null }[] | undefined)
    : undefined;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      year: Number(typeof r?.date === "string" ? r.date.slice(0, 4) : NaN),
      value: typeof r?.value === "number" && Number.isFinite(r.value) ? r.value : null,
    }))
    .filter((p) => Number.isFinite(p.year) && p.value !== null)
    .sort((a, b) => a.year - b.year);
}

const avgOf = (pts: IndicatorPoint[]) => {
  const win = pts.filter((p) => p.year >= 2005 && p.year <= 2024 && p.value != null);
  if (!win.length) return null;
  return win.reduce((a, p) => a + (p.value as number), 0) / win.length;
};

export { avgOf as averageIndicator2005_2024 };
