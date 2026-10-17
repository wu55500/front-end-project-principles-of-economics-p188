/**
 * Monte-Carlo panel: turns the single deterministic welfare number into a
 * risk distribution. Subsidy strength and external demand are treated as
 * uncertain; thousands of draws are sampled (seeded, reproducible) and each
 * one is run through the welfare function. Outputs: mean / SD / 90% interval /
 * P(net welfare &gt; 0) and a histogram split into loss/gain tails.
 *
 * Sampling and statistics live in the unit-tested lib/econ/montecarlo module;
 * this file is presentation only.
 */
import { useMemo, useState } from "react";
import { Dices, Play } from "lucide-react";
import { monteCarloNet } from "@/lib/econ/montecarlo";
import { useViz } from "@/store/viz";

type Scenario = {
  id: string;
  label: string;
  tVol: number;
  shockMul: number;
  hint: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: "calm",
    label: "平稳环境",
    tVol: 0.06,
    shockMul: 0.6,
    hint: "需求稳、政策执行到位",
  },
  { id: "normal", label: "常态波动", tVol: 0.1, shockMul: 1, hint: "典型外部不确定性" },
  {
    id: "turbulent",
    label: "贸易战冲击",
    tVol: 0.18,
    shockMul: 1.8,
    hint: "关税战、外需骤变",
  },
];

export function McPanel() {
  const t = useViz((s) => s.t);
  const [scenarioId, setScenarioId] = useState("normal");
  const [seed, setSeed] = useState(20261018);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;

  const result = useMemo(
    () =>
      monteCarloNet({
        t,
        nSims: 8000,
        tVol: scenario.tVol,
        shockVol: Math.max(20, t * 2) * scenario.shockMul,
        seed,
      }),
    [t, scenario, seed],
  );

  const maxCount = Math.max(...result.histogram.map((b) => b.count));
  const pPositive = (1 - result.pNegative) * 100;
  const stats = [
    { k: "净福利均值", v: result.mean.toLocaleString(), unit: "", strong: true },
    { k: "标准差", v: result.sd.toLocaleString(), unit: "" },
    {
      k: "90% 区间",
      v: `${result.p05.toLocaleString()} ~ ${result.p95.toLocaleString()}`,
      unit: "",
    },
    { k: "净福利为正概率", v: pPositive.toFixed(1), unit: "%", strong: true },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
        <span className="font-medium text-fg">为什么要模拟？👇</span>
        <span className="text-muted">
          单一数字假设世界是确定的；现实中补贴执行与外部需求都会波动。模拟{" "}
          {result.nSims.toLocaleString()} 次随机未来，看结论有多大把握。
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* controls */}
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="font-display text-base">情景假设</h3>
            <p className="mt-1 text-xs text-dim">
              补贴强度 t = {t}（随页面顶部滑杆联动）
            </p>
            <div className="mt-3 space-y-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenarioId(s.id)}
                  className={[
                    "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    s.id === scenarioId
                      ? "border-is/70 bg-is/10 text-fg"
                      : "border-line bg-bg/40 text-muted hover:border-muted",
                  ].join(" ")}
                >
                  <span className="block font-medium">{s.label}</span>
                  <span className="block text-[11px] text-dim">{s.hint}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSeed((x) => (x * 1664525 + 1013904223) >>> 0)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90"
            >
              <Play className="size-4" /> 重新抽样 {result.nSims.toLocaleString()} 次
            </button>
          </div>
        </div>

        {/* results */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.k} className="rounded-xl border border-line bg-surface p-4">
                <div className="text-[11px] leading-tight text-dim">{s.k}</div>
                <div
                  className={[
                    "mt-1.5 font-display text-lg leading-none",
                    s.strong
                      ? s.k.includes("为正")
                        ? pPositive >= 60
                          ? "text-gain"
                          : "text-loss"
                        : "text-fg"
                      : "text-fg",
                  ].join(" ")}
                >
                  {s.v}
                  {s.unit && <span className="ml-0.5 text-xs text-dim">{s.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dices className="size-4 text-muted" />
                <h3 className="font-display text-base">
                  净福利分布（{result.nSims.toLocaleString()} 次抽样）
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-dim">
                <span className="inline-flex items-center gap-1">
                  <i className="inline-block size-2 rounded-sm bg-loss" /> 净损失
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="inline-block size-2 rounded-sm bg-gain" /> 净获益
                </span>
              </div>
            </div>

            <div className="mt-5 flex h-44 items-end gap-px">
              {result.histogram.map((b, idx) => {
                const mid = (b.x0 + b.x1) / 2;
                const h = Math.max(2, (b.count / maxCount) * 100);
                return (
                  <div
                    key={idx}
                    title={`[${Math.round(b.x0)}, ${Math.round(b.x1)})：${b.count} 次`}
                    className={[
                      "flex-1 rounded-t-sm",
                      mid < 0 ? "bg-loss/70" : "bg-gain/70",
                    ].join(" ")}
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-dim">
              <span>悲观端 P5：{result.p05.toLocaleString()}</span>
              <span>
                确定值（不模拟）：
                <b className="text-fg">{result.deterministic.toLocaleString()}</b>
              </span>
              <span>乐观端 P95：{result.p95.toLocaleString()}</span>
            </div>
            <p className="mt-3 rounded-lg bg-bg/50 p-3 text-xs leading-relaxed text-muted">
              解读：在「{scenario.label}」下，净福利为正的概率约 {pPositive.toFixed(0)}
              %，均值 {result.mean.toLocaleString()}，90% 的结果落在 [
              {result.p05.toLocaleString()}, {result.p95.toLocaleString()}]。
              {pPositive >= 80
                ? "结论稳健——多数情景下接受补贴都优于报复。"
                : pPositive >= 50
                  ? "结论有风险——能不能获益高度依赖外部环境，政策需谨慎。"
                  : "结论翻转——多数情景下补贴并非好事，确定性结论会误导决策。"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
