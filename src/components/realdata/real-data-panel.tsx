/**
 * Real-world data panel: pick a country and a trade indicator, fetch the live
 * World Bank series through the server fn (cached), and render it as a line
 * with the latest value highlighted. Falls back to a clear message offline.
 */
import { useEffect, useMemo, useState } from "react";
import { Database, TrendingUp } from "lucide-react";
import {
  getIndicator,
  listIndicatorCatalog,
  type IndicatorSeries,
} from "@/lib/data/econ-data";

const COUNTRIES: { code: string; name: string }[] = [
  { code: "WLD", name: "世界" },
  { code: "CHN", name: "中国" },
  { code: "USA", name: "美国" },
  { code: "IND", name: "印度" },
  { code: "DEU", name: "德国" },
  { code: "VNM", name: "越南" },
];

export function RealDataPanel() {
  const [catalog, setCatalog] = useState<{ code: string; label: string; unit: string }[]>([]);
  const [country, setCountry] = useState("WLD");
  const [code, setCode] = useState("NE.TRD.GNFS.ZS");
  const [series, setSeries] = useState<IndicatorSeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listIndicatorCatalog().then(setCatalog);
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getIndicator({ data: { code: code as never, country } })
      .then((s) => {
        if (live) setSeries(s);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "取数失败");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [code, country]);

  const line = useMemo(() => buildSparkline(series), [series]);
  const latest = series?.points[series.points.length - 1];

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2 text-fg">
        <Database className="size-4 text-muted" />
        <h3 className="font-display text-lg">真实数据：贸易到底多重要</h3>
      </div>
      <p className="mt-2 text-sm text-muted">
        数据来自世界银行公开接口，服务器端缓存 12 小时。选择国家和指标观察长期趋势。
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Segmented
          options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
          value={country}
          onChange={setCountry}
        />
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-9 rounded-[10px] border border-line-strong bg-transparent px-3 text-sm outline-none focus:border-accent"
        >
          {catalog.map((c) => (
            <option key={c.code} value={c.code} className="bg-surface">
              {c.label}（{c.unit}）
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 min-h-[220px]">
        {error ? (
          <div className="flex h-[220px] flex-col items-center justify-center gap-1 text-center text-sm text-muted">
            <p>真实数据暂时不可用（{error}）</p>
            <p className="text-xs text-dim">可能是当前环境无法访问世界银行接口。</p>
          </div>
        ) : loading && !series ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted">
            正在取数…
          </div>
        ) : series && series.points.length ? (
          <>
            <div className="flex items-baseline gap-2">
              <TrendingUp className="size-4 text-accent" />
              <span className="font-display text-3xl">
                {latest?.value != null ? latest.value.toFixed(1) : "—"}
              </span>
              <span className="text-sm text-muted">
                {series.unit} · {latest?.year}
              </span>
            </div>
            <svg viewBox="0 0 600 180" className="mt-3 w-full">
              <path d={line?.area} fill="rgba(201,180,88,.12)" stroke="none" />
              <path d={line?.path} fill="none" stroke="#c9b458" strokeWidth={2} />
              {line?.last && (
                <circle cx={line.last.x} cy={line.last.y} r={3.5} fill="#8eb4c8" />
              )}
            </svg>
            <p className="mt-1 text-xs text-dim">
              {series.label} · {series.country} · {series.points[0].year}–{latest?.year}
            </p>
          </>
        ) : (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted">
            该序列暂无数据
          </div>
        )}
      </div>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[10px] border border-line-strong p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            "h-7 rounded-md px-3 text-xs transition-colors " +
            (o.value === value ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function buildSparkline(series: IndicatorSeries | null) {
  if (!series || series.points.length < 2) return null;
  const W = 600;
  const H = 180;
  const pad = 8;
  const xs = series.points.map((p) => p.year);
  const ys = series.points.map((p) => p.value ?? 0);
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys, 0);
  const ymax = Math.max(...ys);
  const sx = (x: number) => pad + ((x - xmin) / Math.max(xmax - xmin, 1)) * (W - pad * 2);
  const sy = (y: number) => H - pad - ((y - ymin) / Math.max(ymax - ymin, 1e-9)) * (H - pad * 2);
  const coords = series.points.map((p) => [sx(p.year), sy(p.value ?? 0)] as const);
  const path =
    "M" + coords.map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" L");
  const area = `${path} L${coords[coords.length - 1][0].toFixed(1)},${H - pad} L${coords[0][0].toFixed(1)},${H - pad} Z`;
  const lastPt = coords[coords.length - 1];
  return { path, area, last: { x: lastPt[0], y: lastPt[1] } };
}
