/**
 * Causal-analysis panel. Two teaching tools:
 *   1. DID calculator — enter the four 2x2 cell means (+optional shared SD) to
 *      see the treatment effect and its interpretation.
 *   2. Granger demo — a synthetic series where y depends on lagged x, showing
 *      the F-test and what "predictive causality" does/doesn't mean.
 */
import { useMemo, useState } from "react";
import { GitBranch } from "lucide-react";
import {
  differenceInDifferences,
  grangerCausality,
} from "@/lib/causal/causal";

export function CausalPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DidCard />
      <GrangerCard />
    </div>
  );
}

function DidCard() {
  const [v, setV] = useState({ tb: "10", ta: "14", cb: "10", ca: "11", n: "50", sd: "" });
  const num = (s: string) => Number(s);

  const result = useMemo(() => {
    const n = Math.max(Math.round(num(v.n) || 1), 1);
    return differenceInDifferences({
      treatBefore: { y: num(v.tb), n },
      treatAfter: { y: num(v.ta), n },
      controlBefore: { y: num(v.cb), n },
      controlAfter: { y: num(v.ca), n },
      ...(v.sd.trim() !== "" ? { sd: num(v.sd) } : {}),
    } as Parameters<typeof differenceInDifferences>[0] & { sd?: number });
  }, [v]);

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 text-muted" />
        <h3 className="font-display text-lg">双重差分（DID）</h3>
      </div>
      <p className="mt-2 text-sm text-muted">
        政策效应 =（处理组后−前）−（对照组后−前）。填入四格均值。
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Cell label="处理组 · 前" value={v.tb} onChange={(x) => setV({ ...v, tb: x })} />
        <Cell label="处理组 · 后" value={v.ta} onChange={(x) => setV({ ...v, ta: x })} />
        <Cell label="对照组 · 前" value={v.cb} onChange={(x) => setV({ ...v, cb: x })} />
        <Cell label="对照组 · 后" value={v.ca} onChange={(x) => setV({ ...v, ca: x })} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Cell label="每组样本量 n" value={v.n} onChange={(x) => setV({ ...v, n: x.replace(/\D/g, "") })} />
        <Cell label="共同标准差(可选)" value={v.sd} onChange={(x) => setV({ ...v, sd: x })} />
      </div>

      <div className="mt-4 rounded-lg border border-line p-4">
        <p className="text-xs text-dim">估计的政策效应</p>
        <p className="font-display text-3xl text-gain">{result.effect.toFixed(2)}</p>
        {v.sd.trim() !== "" ? (
          <p className="mt-1 text-xs text-muted">
            SE {result.se.toFixed(3)} · t {result.t.toFixed(2)} · p {result.p.toFixed(3)}
          </p>
        ) : (
          <p className="mt-1 text-xs text-dim">
            填入共同标准差后可计算标准误；此处不伪造精度。
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-dim">{result.note}</p>
      </div>
    </div>
  );
}

function Cell({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-dim">{label}</span>
      <input
        value={value}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-[10px] border border-line-strong bg-transparent px-3 outline-none focus:border-accent"
      />
    </label>
  );
}

function GrangerCard() {
  const [lags, setLags] = useState(2);
  const result = useMemo(() => {
    // Deterministic demo: y_t depends on lagged x with noise.
    let seed = 7;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 160; i++) x.push(Math.sin(i / 3) + (rng() - 0.5));
    for (let i = 0; i < 160; i++) y.push(0);
    for (let i = lags; i < 160; i++) {
      y[i] = 0.6 * y[i - 1] + 0.5 * x[i - 1] + (rng() - 0.5) * 0.4;
    }
    return grangerCausality(y, x, lags);
  }, [lags]);

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 text-muted" />
        <h3 className="font-display text-lg">Granger 因果检验</h3>
      </div>
      <p className="mt-2 text-sm text-muted">
        合成数据中 y 由 x 的滞后项驱动。检验 x 的滞后能否改善对 y 的预测。
      </p>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className="text-xs text-dim">滞后阶数</span>
        {[1, 2, 3].map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLags(l)}
            className={
              "h-8 rounded-md px-3 text-xs " +
              (lags === l ? "bg-accent text-accent-fg" : "border border-line-strong text-muted")
            }
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-line p-4">
        <p className="text-xs text-dim">检验结果（x 是否 Granger 引致 y）</p>
        <p className={"mt-1 font-display text-2xl " + (result.xCausesY ? "text-gain" : "text-loss")}>
          {result.xCausesY ? "显著（有预测增量）" : "不显著"}
        </p>
        <p className="mt-2 text-xs text-muted">
          F {result.f.toFixed(2)} · p {result.p < 1e-4 ? result.p.toExponential(2) : result.p.toFixed(4)} · n {result.n}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-dim">{result.note}</p>
      </div>
    </div>
  );
}
