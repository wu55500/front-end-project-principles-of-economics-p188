/**
 * InteractionFX — a global, non-blocking click/tap feedback layer.
 *
 * A fixed full-viewport canvas painted ABOVE the page but with
 * `pointer-events: none`, so it can never intercept clicks. On every pointer
 * activation it emits a short ripple + a small particle burst in the theme
 * palette. The key safety property: particles that drift over readable or
 * interactive content are pushed out and dimmed (see particle-field.ts), so the
 * effect never obscures what the user is looking at.
 *
 * Accessibility/performance:
 *  - fully disabled under prefers-reduced-motion;
 *  - no ambient particles (feedback only) and a hard particle cap;
 *  - rAF pauses on hidden tab; rects are measured lazily and throttled.
 */
import { useEffect, useRef } from "react";
import {
  lifeRatio,
  spawnBurst,
  spawnRipple,
  stepField,
  type Particle,
  type Rect,
  type Ripple,
} from "@/lib/fx/particle-field";

const MAX_PARTICLES = 220;
const RECT_REFRESH_MS = 250;

// Selectors for content we must never visually compete with.
const PROTECTED_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "li",
  "button",
  "a",
  "input",
  "label",
  "th",
  "td",
  "[data-fx-protect]",
].join(",");

interface Palette {
  particle: string;
  ripple: string;
}

function readPalette(): Palette {
  if (typeof window === "undefined") return { particle: "#cfe0ee", ripple: "#8eb4c8" };
  const cs = getComputedStyle(document.documentElement);
  const isBlue = (cs.getPropertyValue("--color-is") || "").trim();
  return {
    particle: isBlue || "#8eb4c8",
    ripple: isBlue || "#8eb4c8",
  };
}

export function InteractionFX() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // ---- protected content rects, measured lazily ----
    let rects: Rect[] = [];
    let lastRectAt = 0;
    let queued = false;
    const measure = () => {
      queued = false;
      lastRectAt = performance.now();
      const vh = height;
      const next: Rect[] = [];
      const nodes = document.querySelectorAll<HTMLElement>(PROTECTED_SELECTOR);
      for (const el of nodes) {
        const r = el.getBoundingClientRect();
        // keep only on-viewport rects to bound the collision work
        if (r.bottom < -40 || r.top > vh + 40 || r.width === 0) continue;
        next.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      rects = next;
    };
    const scheduleMeasure = (force = false) => {
      const now = performance.now();
      if (queued) return;
      if (!force && now - lastRectAt < RECT_REFRESH_MS) return;
      queued = true;
      const ric = (
        window as unknown as { requestIdleCallback?: (cb: () => void) => number }
      ).requestIdleCallback;
      if (ric) ric(measure);
      else setTimeout(measure, 60);
    };
    scheduleMeasure(true);

    // ---- simulation pools ----
    let particles: Particle[] = [];
    let ripples: Ripple[] = [];
    let palette = readPalette();
    let last = performance.now();
    let raf = 0;
    let running = true;

    const burstAt = (x: number, y: number) => {
      const room = Math.max(0, MAX_PARTICLES - particles.length);
      const count = Math.min(14, room);
      if (count > 0) particles = particles.concat(spawnBurst({ x, y, count }));
      ripples.push(spawnRipple(x, y, Math.min(96, Math.max(64, width * 0.12))));
      if (ripples.length > 6) ripples.splice(0, ripples.length - 6);
      scheduleMeasure(true);
    };

    const onPointerDown = (e: PointerEvent) => {
      // ignore secondary buttons / synthetic; left/touch/pen only
      if (e.pointerType === "mouse" && e.button !== 0) return;
      burstAt(e.clientX, e.clientY);
    };
    const onScroll = () => scheduleMeasure();
    const onVisibility = () => {
      running = !document.hidden;
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      // ripples (thin ring, additive-ish light)
      for (const rp of ripples) {
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.strokeStyle = palette.ripple;
        ctx.globalAlpha = rp.alpha;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const a = lifeRatio(p);
        const dim = dims[i] ?? 1;
        ctx.globalAlpha = a * dim;
        ctx.fillStyle = palette.particle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (0.6 + a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    let dims: number[] = [];
    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (particles.length || ripples.length) {
        const res = stepField(particles, ripples, rects, dt, { width, height });
        particles = res.particles;
        ripples = res.ripples;
        dims = res.dim;
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // ---- listeners ----
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    const ro = new ResizeObserver(() => scheduleMeasure());
    ro.observe(document.body);
    let paletteTimer = 0;
    const reTheme = () => {
      palette = readPalette();
    };
    paletteTimer = window.setTimeout(reTheme, 400);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(paletteTimer);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="interaction-fx"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        pointerEvents: "none",
      }}
    />
  );
}
