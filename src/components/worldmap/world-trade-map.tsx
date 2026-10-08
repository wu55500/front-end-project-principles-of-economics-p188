/**
 * World trade-flow map (d3-geo + topojson), loaded on demand. Draws a world
 * map and arcs from major textile exporters toward importers; arc thickness /
 * opacity scales with the export subsidy t. The world topology is fetched at
 * runtime from the world-atlas CDN and cached, so no large JSON ships with the
 * app. Mounted via React.lazy + IntersectionObserver.
 */
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Globe2 } from "lucide-react";

const GlobeCanvas = lazy(() => import("./globe"));

export function WorldTradeMap() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(hostRef.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="overflow-hidden rounded-xl border border-line bg-surface">
      {!enabled ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
          <Globe2 className="size-8 text-muted" />
          <div>
            <p className="font-display text-lg">三维地球 · 转口贸易</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              立体看纺织品 中国 → 墨西哥中转换单 → 美国 的流向；切到贸易战可看关税壁垒如何阻断货流。WebGL 体积较大，点击后才加载，不拖慢首屏。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(true)}
            className="h-11 rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            加载三维地球
          </button>
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
  );
}
