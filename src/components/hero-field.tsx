import { useEffect, useRef } from "react";
import { fitCanvas } from "@/lib/canvas";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

type Pt = { x: number; y: number; vx: number; vy: number; r: number; ph: number; c: string };

export function HeroField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    if (!cv || reduced) return;
    let pts: Pt[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;

    const seed = (n: number) => {
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1 + Math.random() * 1.6,
        ph: Math.random() * Math.PI * 2,
        c: Math.random() < 0.55 ? "142,180,200" : "111,191,163",
      }));
    };

    const layout = () => {
      const fitted = fitCanvas(cv);
      if (!fitted) return;
      w = fitted.w;
      h = fitted.h;
      seed(Math.min(90, Math.max(28, Math.round((w * h) / 16000))));
    };

    const draw = (now: number) => {
      const fitted = fitCanvas(cv);
      if (!fitted) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const { ctx } = fitted;
      if (fitted.w !== w || fitted.h !== h) {
        w = fitted.w;
        h = fitted.h;
      }
      ctx.clearRect(0, 0, w, h);
      const tt = now / 1000;
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy + Math.sin(tt + p.ph) * 0.1;
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;
        if (p.y < -8) p.y = h + 8;
        if (p.y > h + 8) p.y = -8;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 11000) {
            const a = (1 - Math.sqrt(d2) / 105) * 0.28;
            ctx.strokeStyle = `rgba(142,180,200,${a.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = `rgba(${p.c},.85)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visible) raf = requestAnimationFrame(draw);
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(cv);
    const io = new IntersectionObserver(
      (es) => {
        visible = es.some((e) => e.isIntersecting);
        if (visible) raf = requestAnimationFrame(draw);
        else cancelAnimationFrame(raf);
      },
      { threshold: 0.05 },
    );
    io.observe(cv);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [reduced]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
