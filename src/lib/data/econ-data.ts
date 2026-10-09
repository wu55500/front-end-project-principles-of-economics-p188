/**
 * Real-world economic data ETL. Fetches a small set of trade-related series
 * from the World Bank API (no key required) and caches them in econ_indicators
 * with a TTL. FRED is used only when FRED_API_KEY is present.
 *
 * Everything is server-only; the UI calls these through a server fn.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // refresh at most twice a day

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
export interface IndicatorSeries {
  source: "worldbank";
  code: string;
  label: string;
  unit: string;
  country: string;
  points: IndicatorPoint[];
  avg20: number | null;
}

const avgOf = (pts: IndicatorPoint[]) => {
  const win = pts.filter((p) => p.year >= 2005 && p.year <= 2024 && p.value != null);
  if (!win.length) return null;
  return win.reduce((a, p) => a + (p.value as number), 0) / win.length;
};

async function fetchWorldBank(
  code: string,
  country: string,
): Promise<IndicatorPoint[]> {
  // World Bank v2: JSON, per_page 100, most recent first.
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(
    country,
  )}/indicator/${encodeURIComponent(code)}?format=json&per_page=60&date=1990:2024`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`worldbank ${res.status}`);
  const json = (await res.json()) as unknown;
  // Shape: [meta, [ {date, value}, ... ]]
  const rows = Array.isArray(json) ? (json[1] as { date: string; value: number | null }[] | undefined) : undefined;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({ year: Number(r.date.slice(0, 4)), value: r.value ?? null }))
    .filter((p) => p.value !== null)
    .sort((a, b) => a.year - b.year);
}

const CountrySchema = z
  .string()
  .min(2)
  .max(8)
  .regex(/^[A-Za-z0-9]+$/)
  .default("WLD");

/**
 * Get one indicator series for a country, served from cache when fresh.
 */
export const getIndicator = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.enum([
        "NE.TRD.GNFS.ZS",
        "NE.IMP.GNFS.ZS",
        "NE.EXP.GNFS.ZS",
        "BN.CAB.XOKA.GD.ZS",
      ]),
      country: CountrySchema,
    }),
  )
  .handler(async ({ data }): Promise<IndicatorSeries> => {
    const sql = await getSql();
    const meta = WB_INDICATORS.find((i) => i.code === data.code)!;
    const country = data.country.toUpperCase();

    const cached = await sql.query<{ year: number; value: string | null; fetched_at: Date | string }>(
      `select year, value, fetched_at from econ_indicators
        where source='worldbank' and indicator=$1 and country=$2
        order by year asc`,
      [data.code, country],
    );

    const freshEnough =
      cached.length > 0 &&
      cached.every((r) => Date.now() - new Date(r.fetched_at).getTime() < CACHE_TTL_MS);

    if (freshEnough) {
      return {
        source: "worldbank",
        code: data.code,
        label: meta.label,
        unit: meta.unit,
        country,
        points: cached.map((r) => ({ year: Number(r.year), value: r.value == null ? null : Number(r.value) })),
        avg20: avgOf(cached.map((r) => ({ year: Number(r.year), value: r.value == null ? null : Number(r.value) }))),
      };
    }

    // Cache miss / stale: fetch, upsert, return.
    const points = await fetchWorldBank(data.code, country);
    for (const p of points) {
      await sql.query(
        `insert into econ_indicators (source, indicator, country, label, unit, year, value, fetched_at)
         values ('worldbank', $1, $2, $3, $4, $5, $6, now())
         on conflict (source, indicator, country, year)
         do update set value=$6, label=$3, unit=$4, fetched_at=now()`,
        [data.code, country, meta.label, meta.unit, p.year, p.value],
      );
    }
    return {
      source: "worldbank",
      code: data.code,
      label: meta.label,
      unit: meta.unit,
      country,
      points,
      avg20: avgOf(points),
    };
  });

/** Catalog so the UI can render a picker without hardcoding twice. */
export const listIndicatorCatalog = createServerFn({ method: "GET" })
  .inputValidator(z.object({}).optional())
  .handler(async (): Promise<{ code: string; label: string; unit: string }[]> => {
    return WB_INDICATORS;
  });
