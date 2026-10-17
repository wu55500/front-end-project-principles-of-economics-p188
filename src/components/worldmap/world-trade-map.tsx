/**
 * World trade-flow views, loaded on demand behind an explicit gate.
 *
 *  - 2D map  : d3-geo equirectangular projection + topojson world atlas
 *              (self-hosted, no CDN) with exporter→importer flow arcs.
 *  - 3D globe: three.js custom spherical projection + earcut land geometry.
 *
 * Arc thickness / opacity scales with the export subsidy t. The 3D WebGL view
 * is mounted only after the user opts in and while on screen (Intersection-
 * Observer unmounts it off-screen) so it never slows first paint or leaks a
 * context on mobile.
 */
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Globe2, Map as MapIcon } from "lucide-react";
import { MapCanvas } from "./map-canvas";

const GlobeCanvas = lazy(() => import("./globe"));

type Mode = "3d" | "2d";

export function WorldTradeMap() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("3d");

  useEffect(() => {
    if (!hostRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setVisible(true);
          // Leave the viewport (incl. a margin) -> unmount to release WebGL.
          else if (e.intersectionRatio === 0) setVisible(false);
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(hostRef.current);
    return () => io.disconnect();
  }, []);

  const enter = (m: Mode) => {
    setMode(m);
    setEnabled(true);
  };

  return (
    <div
      ref={hostRef}
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      {!enabled ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
          <Globe2 className="size-8 text-muted" />
          <div>
            <p className="font-display text-lg">全球贸易视角 · 2D 地图 / 3D 地球</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              立体看纺织品 中国 → 墨西哥中转换单 → 美国
              的流向；切到贸易战可看关税壁垒如何阻断货流。 也可用 2D
              世界地图看全球纺织品主要贸易流。WebGL 体积较大，点击后才加载，不拖慢首屏。
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => enter("3d")}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              <Globe2 className="size-4" /> 加载三维地球
            </button>
            <button
              type="button"
              onClick={() => enter("2d")}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-line px-4 text-sm font-medium text-fg hover:border-muted"
            >
              <MapIcon className="size-4" /> 看 2D 世界贸易流
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* view switch */}
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="inline-flex rounded-lg border border-line p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setMode("3d")}
                className={[
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                  mode === "3d" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                ].join(" ")}
              >
                <Globe2 className="size-4" /> 3D 地球
              </button>
              <button
                type="button"
                onClick={() => setMode("2d")}
                className={[
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                  mode === "2d" ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
                ].join(" ")}
              >
                <MapIcon className="size-4" /> 2D 地图
              </button>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(false)}
              className="rounded-md px-2 py-1 text-xs text-dim hover:text-fg"
            >
              收起
            </button>
          </div>

          {mode === "2d" ? (
            <div className="bg-[#0b0c10]">
              <MapCanvas />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex min-h-[320px] items-center justify-center text-sm text-muted">
                  正在加载三维地球…
                </div>
              }
            >
              {visible && <GlobeCanvas />}
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
