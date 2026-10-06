import { useMemo } from "react";
import * as d3 from "d3";
import { useViz } from "@/store/viz";
import { DEFAULT_PARAMS, demandQ, supplyQ } from "@/lib/econ/params";

/** 图表方案二：D3（SVG + 比例尺，精细可控） */
export function D3SD() {
  const t = useViz((s) => s.t);
  const pw = DEFAULT_PARAMS.pw;
  const p2 = pw - t;

  const W = 720, H = 320, M = { top: 16, right: 24, bottom: 36, left: 44 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const geom = useMemo(() => {
    const x = d3.scaleLinear().domain([20, 100]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, 100]).range([ih, 0]);
    const pts = d3.range(20, 101, 2);
    const lineD = (fn: (p: number) => number) =>
      d3.line<number>()
        .x((p) => x(p))
        .y((p) => y(fn(p)))
        .curve(d3.curveLinear)(pts);
    return {
      x, y,
      demandPath: lineD(demandQ) ?? undefined,
      supplyPath: lineD(supplyQ) ?? undefined,
      ticks: x.ticks(8),
    };
  }, [iw, ih]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <g transform={`translate(${M.left},${M.top})`}>
        {geom.ticks.map((tk) => (
          <g key={tk}>
            <line x1={geom.x(tk)} x2={geom.x(tk)} y1={0} y2={ih} stroke="rgba(236,234,228,.08)" />
            <text x={geom.x(tk)} y={ih + 16} fill="#9a9ba6" fontSize={10} textAnchor="middle">{tk}</text>
          </g>
        ))}
        <line x1={0} x2={iw} y1={geom.y(0)} y2={geom.y(0)} stroke="rgba(236,234,228,.2)" />
        <path d={geom.demandPath} fill="none" stroke="#8eb4c8" strokeWidth={2} />
        <path d={geom.supplyPath} fill="none" stroke="#d17a7a" strokeWidth={2} />

        <line x1={geom.x(pw)} x2={geom.x(pw)} y1={0} y2={ih} stroke="#c9b458" strokeDasharray="4 4" />
        <text x={geom.x(pw)} y={10} fill="#c9b458" fontSize={11} textAnchor="middle">P1</text>

        {t > 0 && (
          <>
            <rect x={geom.x(p2)} y={0} width={geom.x(pw) - geom.x(p2)} height={ih} fill="#7ec27e" fillOpacity={0.12} />
            <line x1={geom.x(p2)} x2={geom.x(p2)} y1={0} y2={ih} stroke="#7ec27e" strokeDasharray="4 4" />
            <text x={geom.x(p2)} y={10} fill="#7ec27e" fontSize={11} textAnchor="middle">P2</text>
          </>
        )}
        <text x={iw / 2} y={ih + 30} fill="#9a9ba6" fontSize={11} textAnchor="middle">价格 P</text>
      </g>
    </svg>
  );
}
