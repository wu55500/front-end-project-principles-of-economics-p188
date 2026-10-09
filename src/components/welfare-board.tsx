import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtSigned, netCurve, scenarios } from "@/lib/econ/model";
import { TSlider } from "@/components/sd-chart";
import { useViz } from "@/store/viz";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "accept", label: "接受补贴" },
  { id: "tariff", label: "报复关税" },
  { id: "ban", label: "禁止进口" },
] as const;

export function WelfareBoard() {
  const t = useViz((s) => s.t);
  const view = useViz((s) => s.view);
  const setView = useViz((s) => s.setView);
  const s = scenarios(t);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const curve = useMemo(() => {
    const c = netCurve(31);
    return c.xs.map((x, i) => ({
      t: Math.round(x),
      accept: Math.round(c.accept[i]),
      tariff: Math.round(c.tariff[i]),
    }));
  }, []);
  const barData = [
    { name: s.accept.name, 消费者: s.accept.consumer, 生产者: s.accept.producer, 政府: s.accept.government, 无谓损失: s.accept.dwl, 净福利: s.accept.net },
    { name: s.tariff.name, 消费者: s.tariff.consumer, 生产者: s.tariff.producer, 政府: s.tariff.government, 无谓损失: s.tariff.dwl, 净福利: s.tariff.net },
    { name: s.ban.name, 消费者: s.ban.consumer, 生产者: s.ban.producer, 政府: s.ban.government, 无谓损失: s.ban.dwl, 净福利: s.ban.net },
  ];
  const cards = [s.accept, s.tariff, s.ban];
  const axis = { stroke: "rgba(154,155,166,.35)", tick: { fill: "#9a9ba6", fontSize: 12 } };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
        <span className="font-medium text-fg">动手试试 👇</span>
        <span className="text-muted">点下方「接受补贴 / 报复关税 / 禁止进口」只看一种选择</span>
        <span className="text-muted">拖动页面底部的 t 滑块，三张福利账和对比图会实时联动</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="情景筛选">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-10 rounded-md border px-3 text-sm",
              filter === f.id ? "border-line-strong bg-surface-2 text-fg" : "border-line text-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {cards
          .filter((c) => filter === "all" || c.key === filter)
          .map((c) => (
            <article key={c.key} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-medium">{c.name}</h3>
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    c.net > 0 ? "text-gain" : c.net < 0 ? "text-loss" : "text-muted",
                  )}
                >
                  净 {fmtSigned(c.net)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {c.key === "accept" &&
                  `价格 P₁→P₂，消费者剩余 ${fmtSigned(c.consumer)}，生产者剩余 ${fmtSigned(c.producer)}。邻居替你掏钱，净赚。`}
                {c.key === "tariff" &&
                  `关税 t 抵消补贴，价格回到 P₁。政府税收 ${fmtSigned(c.government)}，无谓损失 ${fmtSigned(c.dwl)}，白忙一场。`}
                {c.key === "ban" && "回到自给自足 P=70：工厂 +450，消费者 −550。唯一确定变穷的选择。"}
              </p>
              <MiniBars c={c} />
            </article>
          ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-medium">福利账 · 全局联动</h3>
          <span className="flex-1" />
          <div className="inline-flex rounded-md border border-line bg-bg p-1">
            <button
              type="button"
              onClick={() => setView("bar")}
              className={cn("h-9 rounded-[7px] px-3 text-sm", view === "bar" ? "bg-surface-2 text-fg" : "text-muted")}
            >
              三种选择对比
            </button>
            <button
              type="button"
              onClick={() => setView("curve")}
              className={cn("h-9 rounded-[7px] px-3 text-sm", view === "curve" ? "bg-surface-2 text-fg" : "text-muted")}
            >
              强度—净福利曲线
            </button>
          </div>
        </div>
        <div className="h-[280px] w-full sm:h-[320px]">
          {view === "bar" ? (
            <ResponsiveContainer>
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(154,155,166,.1)" vertical={false} />
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} />
                <Tooltip
                  contentStyle={{
                    background: "#13151c",
                    border: "1px solid rgba(236,234,228,.12)",
                    borderRadius: 12,
                    color: "#eceae4",
                  }}
                />
                <Bar dataKey="消费者" stackId="w" fill="#8eb4c8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="生产者" stackId="w" fill="#d17a7a" />
                <Bar dataKey="政府" stackId="w" fill="#c4b48a" />
                <Bar dataKey="无谓损失" stackId="w" fill="#6e707a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(154,155,166,.1)" />
                <XAxis dataKey="t" {...axis} />
                <YAxis {...axis} />
                <Tooltip
                  contentStyle={{
                    background: "#13151c",
                    border: "1px solid rgba(236,234,228,.12)",
                    borderRadius: 12,
                    color: "#eceae4",
                  }}
                />
                <ReferenceLine x={t} stroke="#c4b48a" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="accept" name="接受补贴" stroke="#6fbfa3" strokeWidth={2.4} dot={false} />
                <Line
                  type="monotone"
                  dataKey="tariff"
                  name="报复关税"
                  stroke="#8eb4c8"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-4">
          <TSlider label="补贴强度 t（与第 02 节同一状态）" />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["接受补贴", s.accept.net, "text-gain"],
            ["报复关税", s.tariff.net, "text-price"],
            ["禁止进口", s.ban.net, "text-loss"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="flex items-center justify-between rounded-md border border-line bg-bg px-3 py-2.5">
              <span className="text-sm text-muted">{k as string}</span>
              <b className={cn("font-mono tabular-nums", c as string)}>{fmtSigned(v as number)}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniBars({
  c,
}: {
  c: { consumer: number; producer: number; government: number; dwl: number; net: number };
}) {
  const rows = [
    ["消费者", c.consumer, "bg-is"],
    ["生产者", c.producer, "bg-loss"],
    ["政府", c.government, "bg-nl"],
    ["无谓损失", c.dwl, "bg-dim"],
  ] as const;
  const max = Math.max(1, ...rows.map(([, v]) => Math.abs(v)));
  return (
    <ul className="mt-4 space-y-2">
      {rows.map(([k, v, bg]) => (
        <li key={k} className="grid grid-cols-[64px_1fr_56px] items-center gap-2 text-xs">
          <span className="text-dim">{k}</span>
          <div className="h-1.5 overflow-hidden rounded-full bg-bg">
            <div
              className={cn("h-full rounded-full", bg)}
              style={{ width: `${(Math.abs(v) / max) * 100}%` }}
            />
          </div>
          <span className="text-right font-mono tabular-nums text-muted">{fmtSigned(v)}</span>
        </li>
      ))}
    </ul>
  );
}
