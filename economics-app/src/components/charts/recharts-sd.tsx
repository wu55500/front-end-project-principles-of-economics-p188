import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, ReferenceLine, ReferenceArea,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { useViz } from "@/store/viz";
import { DEFAULT_PARAMS, demandQ, supplyQ } from "@/lib/econ/params";

/** 图表方案一：Recharts（声明式 React 组件） */
export function RechartsSD() {
  const t = useViz((s) => s.t);
  const pw = DEFAULT_PARAMS.pw;
  const p2 = pw - t;

  const data = useMemo(() => {
    const rows: { p: number; demand: number; supply: number }[] = [];
    for (let p = 20; p <= 100; p += 2) {
      rows.push({ p, demand: demandQ(p, DEFAULT_PARAMS), supply: supplyQ(p, DEFAULT_PARAMS) });
    }
    return rows;
  }, []);

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(236,234,228,.08)" />
          <XAxis
            dataKey="p" type="number" domain={[20, 100]}
            tick={{ fill: "#9a9ba6", fontSize: 11 }}
            label={{ value: "价格 P", position: "insideBottom", fill: "#9a9ba6", fontSize: 11, dy: 2 }}
          />
          <YAxis tick={{ fill: "#9a9ba6", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#13151c", border: "1px solid rgba(236,234,228,.15)", borderRadius: 8 }}
            labelStyle={{ color: "#9a9ba6" }}
          />
          <Line dataKey="demand" stroke="#8eb4c8" dot={false} strokeWidth={2} name="需求 D" />
          <Line dataKey="supply" stroke="#d17a7a" dot={false} strokeWidth={2} name="供给 S" />
          <ReferenceLine x={pw} stroke="#c9b458" strokeDasharray="4 4" label={{ value: "P1", fill: "#c9b458", fontSize: 11, position: "top" }} />
          {t > 0 && (
            <>
              <ReferenceLine x={p2} stroke="#7ec27e" strokeDasharray="4 4" label={{ value: "P2", fill: "#7ec27e", fontSize: 11, position: "top" }} />
              <ReferenceArea x1={p2} x2={pw} fill="#7ec27e" fillOpacity={0.12} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
