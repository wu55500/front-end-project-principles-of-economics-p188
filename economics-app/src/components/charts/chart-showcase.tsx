import { useState } from "react";
import { RechartsSD } from "./recharts-sd";
import { D3SD } from "./d3-sd";
import { CanvasSD } from "./canvas-sd";

type Kind = "recharts" | "d3" | "canvas";

const TABS: { id: Kind; label: string; desc: string }[] = [
  { id: "recharts", label: "Recharts", desc: "声明式 React 组件" },
  { id: "d3", label: "D3", desc: "SVG 数据驱动，最灵活" },
  { id: "canvas", label: "Canvas", desc: "命令式像素，性能最强" },
];

const COMPARE: { dim: string; recharts: string; d3: string; canvas: string }[] = [
  { dim: "渲染方式", recharts: "SVG（内部封装）", d3: "SVG / Canvas 任选", canvas: "Canvas 2D 位图" },
  { dim: "代码量", recharts: "最少，声明式", d3: "最多，手写比例尺", canvas: "中等，命令式绘制" },
  { dim: "灵活/定制", recharts: "中，受组件约束", d3: "极高，完全可控", canvas: "高，但需自理一切" },
  { dim: "大数据性能", recharts: "万点以下良好", d3: "SVG节点多时吃力", canvas: "最佳，适合海量点" },
  { dim: "动画", recharts: "内置过渡，简单", d3: "transition 精细控制", canvas: "RAF 全自定义最顺" },
  { dim: "无障碍/SEO", recharts: "好（SVG语义）", d3: "好（SVG可加语义）", canvas: "差，需额外替代文本" },
  { dim: "交互/tooltip", recharts: "开箱即用", d3: "自己实现，最灵活", canvas: "需手动命中检测" },
  { dim: "DPR高清", recharts: "自动", d3: "自动（矢量）", canvas: "需手动适配" },
  { dim: "上手门槛", recharts: "低", d3: "高", canvas: "中高" },
  { dim: "适用场景", recharts: "常规业务图表、快交付", d3: "教科书级定制/复杂交互", canvas: "粒子/高频/超大数点" },
];

export function ChartShowcase() {
  const [kind, setKind] = useState<Kind>("recharts");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setKind(tb.id)}
            className={
              "rounded-lg border px-4 py-2 text-sm transition " +
              (kind === tb.id
                ? "border-cyan-300 bg-cyan-50 text-cyan-900"
                : "border-line text-muted hover:border-fg/30")
            }
          >
            <span className="font-medium">{tb.label}</span>
            <span className="ml-2 text-xs opacity-70">{tb.desc}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        {kind === "recharts" && <RechartsSD />}
        {kind === "d3" && <D3SD />}
        {kind === "canvas" && <CanvasSD />}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-dim">
            <tr>
              <th className="px-4 py-3">对比维度</th>
              <th className="px-4 py-3">Recharts</th>
              <th className="px-4 py-3">D3</th>
              <th className="px-4 py-3">Canvas</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((r) => (
              <tr key={r.dim} className="border-t border-line/60">
                <td className="px-4 py-2.5 font-medium">{r.dim}</td>
                <td className="px-4 py-2.5 text-muted">{r.recharts}</td>
                <td className="px-4 py-2.5 text-muted">{r.d3}</td>
                <td className="px-4 py-2.5 text-muted">{r.canvas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
