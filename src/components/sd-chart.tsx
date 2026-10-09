import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob, fitCanvas, roundRect } from "@/lib/canvas";
import { calc, fmt, fmtSigned } from "@/lib/econ/model";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useViz } from "@/store/viz";
import { cn } from "@/lib/utils";

const LW = 620;
const LH = 470;
const X0 = 62;
const Y0 = 18;
const PW = 520;
const PH = 396;
const STEPS = [
  { b: "第 1 笔", d: "画出坐标轴与 D / S 曲线" },
  { b: "第 2 笔", d: "标出原世界价格 P₁ = 60" },
  { b: "第 3 笔", d: "补贴 t 把价格压到 P₂" },
  { b: "第 4 笔", d: "两块面积对比 → 净福利" },
];

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export function SdChart() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const t = useViz((s) => s.t);
  const setT = useViz((s) => s.setT);
  const setManualT = useViz((s) => s.setManualT);
  const reduced = useReducedMotion();
  const [si, setSi] = useState(3);
  const m = calc(t);

  const draw = useCallback(
    (ph: { curve: number; p1: number; area: number }) => {
      const cv = cvRef.current;
      if (!cv) return;
      const fitted = fitCanvas(cv);
      if (!fitted) return;
      const { ctx, w, h } = fitted;
      const st = useViz.getState();
      const mm = calc(st.t);
      const X = (q: number) => ((X0 + (q / 130) * PW) / LW) * w;
      const Y = (p: number) => ((Y0 + PH - (p / 125) * PH) / LH) * h;
      const line = (q1: number, p1: number, q2: number, p2: number, style: string, width = 1.5, dash?: number[]) => {
        ctx.beginPath();
        ctx.moveTo(X(q1), Y(p1));
        ctx.lineTo(X(q2), Y(p2));
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.setLineDash(dash ?? []);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const poly = (pts: [number, number][], fill: string, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        pts.forEach(([q, p], i) => (i ? ctx.lineTo(X(q), Y(p)) : ctx.moveTo(X(q), Y(p))));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.globalAlpha = 1;
      };
      const tag = (text: string, q: number, p: number, col: string, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.font = "600 12px Source Sans 3, sans-serif";
        const tw = ctx.measureText(text).width + 16;
        const x = X(q) - tw / 2;
        const y = Y(p) - 11;
        ctx.fillStyle = "rgba(11,12,16,.88)";
        ctx.strokeStyle = col;
        roundRect(ctx, x, y, tw, 22, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#eceae4";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + tw / 2, y + 11.5);
        ctx.globalAlpha = 1;
      };

      ctx.clearRect(0, 0, w, h);
      ctx.font = "11px Source Sans 3, sans-serif";
      ctx.fillStyle = "#6e707a";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let q = 0; q <= 120; q += 20) {
        line(q, 0, q, 125, "rgba(154,155,166,.08)", 1);
        ctx.fillText(String(q), X(q), Y(0) + 6);
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let p = 0; p <= 120; p += 20) {
        line(0, p, 130, p, "rgba(154,155,166,.08)", 1);
        ctx.fillText(String(p), X(0) - 8, Y(p));
      }
      line(0, 0, 130, 0, "rgba(154,155,166,.4)", 1.5);
      line(0, 0, 0, 125, "rgba(154,155,166,.4)", 1.5);
      ctx.textAlign = "center";
      ctx.fillStyle = "#9a9ba6";
      ctx.fillText("Q（纺织品）", X(118), Y(0) + 20);
      ctx.save();
      ctx.translate(X(0) - 42, Y(66));
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("P（元/件）", 0, 0);
      ctx.restore();

      if (ph.curve > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w * ph.curve, h);
        ctx.clip();
        line(0, 120, 120, 0, "#8eb4c8", 2.5);
        line(0, 20, 105, 125, "#d17a7a", 2.5);
        ctx.restore();
        if (ph.curve > 0.7) {
          ctx.font = "600 13px Source Sans 3, sans-serif";
          ctx.fillStyle = "#8eb4c8";
          ctx.textAlign = "left";
          ctx.fillText("D: Q = 120 − P", X(74), Y(52) - 14);
          ctx.fillStyle = "#d17a7a";
          ctx.fillText("S: Q = P − 20", X(74), Y(88) + 6);
        }
      }
      if (ph.p1 > 0) {
        ctx.globalAlpha = ph.p1;
        line(0, mm.p1, 130, mm.p1, "#9a9ba6", 1.5, [6, 5]);
        ctx.globalAlpha = 1;
        tag("P₁ = 60（原世界价）", 116, mm.p1, "rgba(154,155,166,.6)", ph.p1);
      }
      if (ph.p1 >= 1 && mm.t > 0) {
        line(0, mm.p2, 130, mm.p2, "#c4b48a", 1.7, [6, 5]);
        tag(`P₂ = ${mm.p2}（补贴后）`, 116, mm.p2, "rgba(196,180,138,.7)", 1);
        line(mm.qd1, mm.p1, mm.qd1, 0, "rgba(154,155,166,.3)", 1, [3, 4]);
        line(mm.qd2, mm.p2, mm.qd2, 0, "rgba(154,155,166,.3)", 1, [3, 4]);
        line(mm.qs1, mm.p1, mm.qs1, 0, "rgba(154,155,166,.3)", 1, [3, 4]);
      }
      if (ph.area > 0 && mm.t > 0) {
        const a = ph.area;
        // ① consumer-surplus gain: green (rectangle part + DWL triangle)
        poly(
          [
            [mm.qd1, mm.p1],
            [mm.qd2, mm.p2],
            [mm.qd1, mm.p2],
          ],
          "rgba(111,191,163,.30)",
          a,
        );
        // ② producer-surplus loss: red
        poly(
          [
            [mm.qs1, mm.p1],
            [mm.qs1, mm.p2],
            [mm.qs2, mm.p2],
          ],
          "rgba(209,122,122,.30)",
          a,
        );
        // ③ FOREIGN SUBSIDY RECTANGLE — the part Isoland gets for free:
        //    subsidy t × import quantity, paid by Neighborland taxpayers.
        poly(
          [
            [mm.qs1, mm.p1],
            [mm.qd1, mm.p1],
            [mm.qd1, mm.p2],
            [mm.qs1, mm.p2],
          ],
          "rgba(244,197,66,.26)",
          a,
        );
        // edge of the subsidy rectangle
        ctx.globalAlpha = a;
        line(mm.qs1, mm.p1, mm.qs1, mm.p2, "rgba(244,197,66,.8)", 1.2, [4, 3]);
        line(mm.qd1, mm.p1, mm.qd1, mm.p2, "rgba(244,197,66,.8)", 1.2, [4, 3]);
        ctx.globalAlpha = 1;
        tag(`外国补贴 ×进口 = ${fmt(mm.t * mm.imports)}`,
          (mm.qs1 + mm.qd1) / 2, (mm.p1 + mm.p2) / 2 + 9, "rgba(244,197,66,.85)", a);
        tag(`消费者 +${fmt(mm.cs)}`, (mm.qd1 + mm.qd2) / 2 + 4, (mm.p1 + mm.p2) / 2 - 12, "rgba(111,191,163,.75)", a);
        tag(`生产者 −${fmt(Math.abs(mm.ps))}`, mm.qs1 / 2 + 2, (mm.p1 + mm.p2) / 2 - 12, "rgba(209,122,122,.75)", a);
        ctx.globalAlpha = a;
        ctx.font = "600 14px Source Sans 3, sans-serif";
        const netTri = mm.t * mm.t; // two efficiency triangles
        const txt = `Isoland 净福利 +${fmt(netTri)}`;
        const bw = ctx.measureText(txt).width + 26;
        const bx = X(66) - bw / 2;
        const by = Y(112);
        ctx.fillStyle = "rgba(111,191,163,.16)";
        ctx.strokeStyle = "#6fbfa3";
        roundRect(ctx, bx, by, bw, 30, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#b7e4d4";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(txt, bx + bw / 2, by + 15.5);
        ctx.globalAlpha = 1;
      }
    },
    [],
  );

  const full = useCallback(() => draw({ curve: 1, p1: 1, area: 1 }), [draw]);

  const onScroll = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wide = window.matchMedia("(min-width: 921px)").matches && !useViz.getState().present;
    if (!wide || reduced) {
      full();
      setSi(3);
      return;
    }
    const r = wrap.getBoundingClientRect();
    const total = r.height - innerHeight;
    if (total <= 0) return;
    const p = clamp01(-r.top / total);
    if (p <= 0) {
      setSi(0);
      useViz.getState().setManualT(false);
      draw({ curve: 0, p1: 0, area: 0 });
      return;
    }
    if (p >= 1) {
      setSi(3);
      useViz.getState().setManualT(false);
      full();
      return;
    }
    setSi(p < 0.24 ? 0 : p < 0.4 ? 1 : p < 0.76 ? 2 : 3);
    if (!useViz.getState().manualT && p > 0.4) {
      const tt = Math.round(20 * clamp01((p - 0.4) / 0.32));
      if (tt !== useViz.getState().t) {
        useViz.getState().setT(tt, true);
        return;
      }
    }
    draw({
      curve: clamp01(p / 0.22),
      p1: clamp01((p - 0.24) / 0.14),
      area: clamp01((p - 0.76) / 0.2),
    });
  }, [draw, full, reduced]);

  useEffect(() => {
    const on = () => requestAnimationFrame(onScroll);
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    on();
    const cv = cvRef.current;
    const ro = cv ? new ResizeObserver(on) : null;
    if (cv && ro) ro.observe(cv);
    const unsub = useViz.subscribe(() => on());
    return () => {
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
      ro?.disconnect();
      unsub();
    };
  }, [onScroll]);

  const replay = () => {
    setManualT(true);
    if (reduced) {
      full();
      return;
    }
    const t0 = performance.now();
    const dur = 1400;
    const step = (now: number) => {
      const k = clamp01((now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 2);
      draw({
        curve: clamp01(e / 0.35),
        p1: clamp01((e - 0.3) / 0.3),
        area: clamp01((e - 0.55) / 0.45),
      });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const exportPng = () => {
    const cv = cvRef.current;
    if (!cv) return;
    cv.toBlob((b) => {
      if (b) downloadBlob(b, `供需福利-t${t}.png`);
    }, "image/png");
  };

  return (
    <div ref={wrapRef} className="sd-track relative lg:h-[240vh]">
      <div className="lg:sticky lg:top-16">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
            <div className="grid flex-1 grid-cols-2 gap-1 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <div
                  key={s.b}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[12.5px] leading-tight",
                    i === si ? "bg-surface-2 text-fg" : "text-dim",
                  )}
                >
                  <b className="mr-1 font-medium">{s.b}</b>
                  <span className="hidden sm:inline">{s.d}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="iconSm" onClick={replay} aria-label="重播绘制">
              <RotateCcw />
            </Button>
            <Button variant="ghost" size="iconSm" onClick={exportPng} aria-label="导出 PNG">
              <Download />
            </Button>
          </div>
          <div className="grid gap-4 p-3 lg:grid-cols-[1fr_240px] lg:p-4">
            <canvas
              ref={cvRef}
              className="h-[280px] w-full sm:h-[380px] lg:h-[430px]"
              role="img"
              aria-label="Isoland 纺织品市场供需图：需求 Q=120−P，供给 Q=P−20"
            />
            <aside className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                <Stat k="消费者剩余" v={`+${fmt(m.cs)}`} tone="gain" />
                <Stat k="生产者剩余" v={`−${fmt(Math.abs(m.ps))}`} tone="loss" />
                <Stat k="IS 净福利（效率三角）" v={`+${fmt(m.t*m.t)}`} tone="is" />
                <Stat k="外国补贴转移" v={fmt(m.t*m.imports)} tone="gain" />
              </div>
              <TSlider />
              <p className="text-sm leading-relaxed text-muted">
                P₂ = 60 − t；补贴每加码 1 元，消费者多得、生产者多损，但赚的总比亏的多。
              </p>
            </aside>
          </div>
          <p className="hidden border-t border-line px-4 py-2 text-center text-xs text-dim lg:block">
            继续滚动，驱动绘制
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone: "gain" | "loss" | "is" }) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-is";
  return (
    <div className="rounded-md border border-line bg-bg px-3 py-2.5">
      <div className="text-[11px] tracking-wide text-dim">{k}</div>
      <div className={cn("mt-0.5 font-mono text-lg tabular-nums", color)}>{v}</div>
    </div>
  );
}

export function TSlider({ label }: { label?: string }) {
  const t = useViz((s) => s.t);
  const setT = useViz((s) => s.setT);
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm text-muted">
        {label ?? "补贴强度 t（元 / 件）"}
        <b className="font-mono text-fg tabular-nums">t = {t}</b>
      </span>
      <input
        type="range"
        min={0}
        max={30}
        step={1}
        value={t}
        aria-label="补贴强度 t"
        onPointerDown={() => useViz.getState().setManualT(true)}
        onChange={(e) => setT(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-accent"
      />
      <span className="mt-1 flex justify-between font-mono text-[11px] text-dim">
        <span>0</span>
        <span>10</span>
        <span>20</span>
        <span>30</span>
      </span>
    </label>
  );
}
