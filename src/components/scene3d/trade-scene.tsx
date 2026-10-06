/**
 * 3D trade scene (Three.js), loaded on demand. Two landmasses (Isoland and
 * Neighborland) sit over an ocean; cargo ships sail the trade lane. The export
 * subsidy t increases throughput (more ships / faster). Mounted lazily via
 * React.lazy + IntersectionObserver so the three.js bundle never reaches the
 * initial page load.
 */
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Box } from "lucide-react";
import { useViz } from "@/store/viz";

const TradeCanvas = lazy(() => import("./trade-canvas").then((m) => ({ default: m.TradeCanvas })));

export function TradeScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const t = useViz((s) => s.t);

  // Reveal only when scrolled near: no 3D work until the reader gets here.
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
          <Box className="size-8 text-muted" />
          <div>
            <p className="font-display text-lg">3D 贸易航道</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              立体看两国之间的货流：补贴越高，航道越忙。Three.js 体积较大，点击后才加载，不拖慢首屏。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(true)}
            className="h-11 rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
          >
            加载 3D 场景
          </button>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex min-h-[320px] items-center justify-center text-sm text-muted">
              正在装载 3D 引擎…
            </div>
          }
        >
          {visible && <TradeCanvas subsidy={t} />}
        </Suspense>
      )}
    </div>
  );
}
