import { useEffect, useRef } from "react";
import { useViz } from "@/store/viz";
import { fitCanvas } from "@/lib/canvas";
import { DEFAULT_PARAMS, demandQ, supplyQ } from "@/lib/econ/params";

/** 图表方案三：手写 Canvas 2D（命令式，DPR高清，性能/作品感强） */
export function CanvasSD() {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = useViz((s) => s.t);
  const pw = DEFAULT_PARAMS.pw;
  const p2 = pw - t;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const fit = fitCanvas(cv);
    if (!fit) return;
    const { ctx, w, h } = fit;
    const M = { l: 40, r: 16, t: 14, b: 32 };
    const iw = w - M.l - M.r;
    const ih = h - M.t - M.b;
    const X = (p: number) => M.l + ((p - 20) / 80) * iw;
    const Y = (q: number) => M.t + ih - (q / 100) * ih;

    ctx.clearRect(0, 0, w, h);
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    // 网格+坐标
    for (let p = 20; p <= 100; p += 10) {
      ctx.strokeStyle = "rgba(236,234,228,.08)";
      ctx.beginPath(); ctx.moveTo(X(p), M.t); ctx.lineTo(X(p), M.t + ih); ctx.stroke();
      ctx.fillStyle = "#9a9ba6"; ctx.fillText(String(p), X(p), M.t + ih + 14);
    }
    // 补贴区间阴影
    if (t > 0) {
      ctx.fillStyle = "rgba(126,194,126,.12)";
      ctx.fillRect(X(p2), M.t, X(pw) - X(p2), ih);
    }
    // 供需曲线
    const drawCurve = (fn: (p: number) => number, color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      for (let p = 20; p <= 100; p += 1) {
        const q = fn(p);
        p === 20 ? ctx.moveTo(X(p), Y(q)) : ctx.lineTo(X(p), Y(q));
      }
      ctx.stroke();
    };
    drawCurve(demandQ, "#8eb4c8");
    drawCurve(supplyQ, "#d17a7a");
    // 价格参考线
    const refLine = (p: number, color: string, label: string) => {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(X(p), M.t); ctx.lineTo(X(p), M.t + ih); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = color; ctx.fillText(label, X(p), M.t + 8);
    };
    refLine(pw, "#c9b458", "P1");
    if (t > 0) refLine(p2, "#7ec27e", "P2");
    ctx.fillStyle = "#9a9ba6"; ctx.fillText("价格 P", M.l + iw / 2, h - 6);
  }, [t, pw, p2]);

  return <canvas ref={ref} className="h-80 w-full" aria-label="供需曲线 Canvas 版" />;
}
