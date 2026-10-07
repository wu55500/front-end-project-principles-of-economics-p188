import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, GeometryCollection } from "geojson";
import atlas from "@/assets/geo/countries-110m.json";
import { useViz } from "@/store/viz";

// Self-hosted atlas: no runtime CDN dependency, so it works behind a restricted
// network / VPN. (countries-110m.json, world-atlas@2, ~108 KB)
const WORLD = atlas as unknown as Topology;

// [lon, lat] of a few textile exporters → importers (illustrative flows).
const FLOWS: { from: [number, number]; to: [number, number]; base: number; name: string }[] = [
  { from: [116.4, 39.9], to: [-74.0, 40.7], base: 1.0, name: "CN → US East" },
  { from: [116.4, 39.9], to: [3.4, 52.6], base: 0.9, name: "CN → EU" },
  { from: [72.8, 19.1], to: [-95.7, 37.1], base: 0.55, name: "IN → US" },
  { from: [72.8, 19.1], to: [13.4, 52.5], base: 0.5, name: "IN → EU" },
  { from: [106.7, 10.8], to: [139.7, 35.7], base: 0.45, name: "VN → JP" },
  { from: [106.7, 10.8], to: [-74.0, 40.7], base: 0.6, name: "VN → US" },
  { from: [103.8, 1.35], to: [151.2, -33.9], base: 0.35, name: "SG → AU" },
];

export function MapCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const t = useViz((s) => s.t);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const W = host.clientWidth || 800;
    const H = 380;

    let cancelled = false;
    const svg = d3
      .select(host)
      .append("svg")
      .attr("width", W)
      .attr("height", H)
      .attr("viewBox", `0 0 ${W} ${H}`);

    const g = svg.append("g");
    const projection = d3.geoEquirectangular().fitSize([W, H], { type: "Sphere" });
    const path = d3.geoPath(projection);

    g.append("path")
      .datum({ type: "Sphere" } as d3.GeoPermissibleObjects)
      .attr("d", path as never)
      .attr("fill", "#0f1724");
    g.append("path")
      .datum(d3.geoGraticule10() as d3.GeoPermissibleObjects)
      .attr("d", path as never)
      .attr("fill", "none")
      .attr("stroke", "rgba(236,234,228,.06)");

    const flowG = g.append("g").attr("class", "flows");

    const arcFor = (f: (typeof FLOWS)[number]) => {
      const a = projection(f.from);
      const b = projection(f.to);
      if (!a || !b) return null;
      const mid: [number, number] = [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2 - Math.abs(a[0] - b[0]) * 0.25,
      ];
      const line = d3
        .line()
        .x((d) => d[0])
        .y((d) => d[1])
        .curve(d3.curveBundle.beta(0.9));
      return { d: line([a, mid, b]), end: b };
    };

    const drawFlows = () => {
      const boost = 1 + Math.min(Math.max(useViz.getState().t, 0), 40) / 40;
      flowG
        .selectAll("path.flow")
        .data(FLOWS)
        .join("path")
        .attr("class", "flow")
        .attr("d", (f) => arcFor(f)?.d ?? null)
        .attr("fill", "none")
        .attr("stroke", "#d8b45a")
        .attr("stroke-linecap", "round")
        .attr("stroke-opacity", (f) => Math.min(0.28 + f.base * 0.42 * boost, 0.95))
        .attr("stroke-width", (f) => 0.7 + f.base * 1.7 * boost);
      flowG
        .selectAll("circle")
        .data(FLOWS)
        .join("circle")
        .attr("cx", (f) => arcFor(f)?.end[0] ?? 0)
        .attr("cy", (f) => arcFor(f)?.end[1] ?? 0)
        .attr("r", (f) => 2 + f.base * boost)
        .attr("fill", "#9ec8e0");
    };
    drawRef.current = drawFlows;

    // Parse the bundled atlas synchronously with guards — no fetch, no CDN.
    try {
      if (!WORLD || !WORLD.objects || !WORLD.objects.countries) {
        throw new Error("地图数据格式异常");
      }
      const countries = feature(WORLD, WORLD.objects.countries as never) as unknown as
        | FeatureCollection
        | GeometryCollection;
      const geoms: unknown[] =
        countries.type === "FeatureCollection"
          ? countries.features
          : countries.geometries;
      if (!Array.isArray(geoms)) throw new Error("国家数据不可读");
      g.append("g")
        .selectAll("path")
        .data(geoms as never[])
        .join("path")
        .attr("d", path as never)
        .attr("fill", "#25313f")
        .attr("stroke", "rgba(236,234,228,.2)")
        .attr("stroke-width", 0.4);
      drawFlows();
    } catch (e: unknown) {
      if (!cancelled) setErr(e instanceof Error ? e.message : "地图解析失败");
    }

    return () => {
      cancelled = true;
      svg.remove();
    };
  }, []);

  useEffect(() => {
    drawRef.current?.();
  }, [t]);

  if (err) {
    return (
      <div className="flex h-[380px] flex-col items-center justify-center gap-2 text-center text-sm text-muted">
        <p>地图数据加载失败（{err}）</p>
        <p className="text-xs text-dim">数据已随项目打包，不依赖外部 CDN。</p>
      </div>
    );
  }
  return <div ref={hostRef} className="h-[380px] w-full" aria-label="world trade map" />;
}
