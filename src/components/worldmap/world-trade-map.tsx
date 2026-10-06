/**
 * World trade-flow map (d3-geo + topojson), loaded on demand. Draws a world
 * map and arcs from major textile exporters toward importers; arc thickness /
 * opacity scales with the export subsidy t. The world topology is fetched at
 * runtime from the world-atlas CDN and cached, so no large JSON ships with the
 * app. Mounted via React.lazy + IntersectionObserver.
 */
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Globe2 } from "lucide-react";

const MapCanvas = lazy(() => import("./map-canvas").then((m) => ({ default: m.MapCanvas })));

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
            <p className="font-display text-lg">世界贸易流向</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              在世界地图上看纺织品出口补贴如何重塑贸易流。地图数据按需从 CDN 加载，点击后才开始。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(true)}
            className="h-11 rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            加载世界地图
          </button>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex min-h-[320px] items-center justify-center text-sm text-muted">
              正在加载地图数据…
            </div>
          }
        >
          {visible && <MapCanvas />}
        </Suspense>
      )}
    </div>
  );
}
