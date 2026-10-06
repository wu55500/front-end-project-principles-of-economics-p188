import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob, fitCanvas, roundRect } from "@/lib/canvas";
import { FLOW_CAPTIONS } from "@/lib/econ/content";
import { useViz } from "@/store/viz";
import { cn } from "@/lib/utils";

const LW = 1100;
const LH = 520;
const LOOP = 10.5;
const STAGE = [0, 2.2, 4.4, 6.6];
const DUR = 1.7;
const WALL_X = 552;

type Actor = { x: number; y: number; name: string; c: string; kind: string };
type Flow = {
  a: string;
  b: string;
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  stage: number;
  col: string;
  kind: "yen" | "box";
  tariff: "off" | "wall" | "keep" | "only";
};

const ACTORS: Record<string, Actor> = {
  taxpayer: { x: 150, y: 128, name: "NL 纳税人", c: "#c4b48a", kind: "people" },
  nlGov: { x: 150, y: 285, name: "NL 政府", c: "#c4b48a", kind: "gov" },
  nlFac: { x: 150, y: 442, name: "NL 纺织厂", c: "#c4b48a", kind: "factory" },
  isGov: { x: 950, y: 128, name: "IS 政府", c: "#8eb4c8", kind: "gov" },
  isCon: { x: 950, y: 285, name: "IS 消费者", c: "#8eb4c8", kind: "bag" },
  isFac: { x: 950, y: 442, name: "IS 纺织厂", c: "#8eb4c8", kind: "factory" },
};

function flows(): Flow[] {
  return [
    { a: "taxpayer", b: "nlGov", c1: { x: 105, y: 190 }, c2: { x: 105, y: 230 }, stage: 0, col: "#c4b48a", kind: "yen", tariff: "off" },
    { a: "nlGov", b: "nlFac", c1: { x: 195, y: 345 }, c2: { x: 195, y: 385 }, stage: 1, col: "#c4b48a", kind: "yen", tariff: "off" },
    { a: "nlFac", b: "isCon", c1: { x: 420, y: 470 }, c2: { x: 700, y: 320 }, stage: 2, col: "#6fbfa3", kind: "box", tariff: "wall" },
    { a: "isCon", b: "nlFac", c1: { x: 700, y: 480 }, c2: { x: 430, y: 520 }, stage: 3, col: "#8eb4c8", kind: "yen", tariff: "keep" },
    { a: "isCon", b: "isGov", c1: { x: 1005, y: 230 }, c2: { x: 1005, y: 190 }, stage: 1, col: "#d17a7a", kind: "yen", tariff: "only" },
  ];
}

function bez(f: Flow, k: number) {
  const a = ACTORS[f.a];
  const b = ACTORS[f.b];
  const u = 1 - k;
  return {
    x: u * u * u * a.x + 3 * u * u * k * f.c1.x + 3 * u * k * k * f.c2.x + k * k * k * b.x,
    y: u * u * u * a.y + 3 * u * u * k * f.c1.y + 3 * u * k * k * f.c2.y + k * k * k * b.y,
  };
}

function wallHitK(f: Flow) {
  for (let k = 0.05; k <= 1; k += 0.01) {
    if (bez(f, k).x >= WALL_X) return k;
  }
  return 1;
}

function icon(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, col: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (kind === "people") {
    ctx.beginPath();
    ctx.arc(-7, -6, 4.2, 0, Math.PI * 2);
    ctx.arc(7, -4, 3.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, 10);
    ctx.quadraticCurveTo(-7, 2, -2, 10);
    ctx.moveTo(3, 10);
    ctx.quadraticCurveTo(7, 4, 12, 10);
    ctx.stroke();
  } else if (kind === "gov") {
    ctx.beginPath();
    ctx.moveTo(-11, 2);
    ctx.lineTo(0, -10);
    ctx.lineTo(11, 2);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(-8, 2, 16, 9);
  } else if (kind === "factory") {
    ctx.strokeRect(-12, -2, 24, 12);
    ctx.strokeRect(-8, -12, 5, 10);
    ctx.strokeRect(2, -10, 5, 8);
  } else {
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-6, -8);
    ctx.lineTo(6, -8);
    ctx.lineTo(8, -2);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(-9, -2, 18, 11);
  }
  ctx.restore();
}

export function FlowSim() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const mode = useViz((s) => s.mode);
  const setMode = useViz((s) => s.setMode);
  const paused = useViz((s) => s.flowPaused);
  const togglePause = useViz((s) => s.toggleFlowPause);
  const epoch = useViz((s) => s.flowEpoch);
  const replay = useViz((s) => s.replayFlow);
  const t = useViz((s) => s.t);
  const [step, setStep] = useState(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const exportPng = useCallback(() => {
    const cv = cvRef.current;
    if (!cv) return;
    cv.toBlob((b) => {
      if (b) downloadBlob(b, `资金流-t${t}.png`);
    }, "image/png");
  }, [t]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    let raf = 0;
    let visible = true;
    let t0 = performance.now();
    let pausedAt = 0;
    let wasPaused = pausedRef.current;
    let wallK = 0;
    type Coin = { f: Flow; born: number; k: number; hit: boolean };
    let coins: Coin[] = [];
    let poofs: { x: number; y: number; t: number }[] = [];
    const pulses: Record<string, number> = {};
    const lastSpawn = [0, 0, 0, 0, 0];

    const tick = (now: number) => {
      if (!visible) return;
      const isPaused = pausedRef.current;
      if (isPaused && !wasPaused) pausedAt = now;
      if (!isPaused && wasPaused) t0 += now - pausedAt;
      wasPaused = isPaused;
      const fitted = fitCanvas(cv);
      if (!fitted) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const { ctx, w, h } = fitted;
      const sx = (x: number) => (x / LW) * w;
      const sy = (y: number) => (y / LH) * h;
      const el = isPaused ? ((pausedAt - t0) / 1000) % LOOP : ((now - t0) / 1000) % LOOP;
      const fs = flows();
      const m = useViz.getState().mode;

      if (!isPaused) {
        fs.forEach((f, i) => {
          const on = f.tariff === "only" ? m === "tariff" : f.tariff === "off" ? m !== "tariff" : true;
          if (!on || el < STAGE[f.stage]) return;
          if (el - lastSpawn[i] > 0.55 || el < lastSpawn[i]) {
            lastSpawn[i] = el;
            coins.push({ f, born: el, k: 0, hit: false });
          }
        });
        coins = coins.filter((c) => {
          c.k = (el - c.born) / DUR;
          if (c.k < 0) return true;
          if (c.f.tariff === "wall" && m === "tariff") {
            const hk = wallHitK(c.f);
            if (c.k >= hk && !c.hit) {
              const p = bez(c.f, hk);
              poofs.push({ x: p.x, y: p.y, t: now });
              return false;
            }
            return true;
          }
          if (c.k >= 1) {
            pulses[c.f.b] = now;
            return false;
          }
          return true;
        });
        poofs = poofs.filter((p) => now - p.t < 700);
      }

      const si = STAGE.reduce((acc, s, i) => (el >= s ? i : acc), 0);
      setStep((prev) => (prev === si ? prev : si));

      ctx.clearRect(0, 0, w, h);
      const placed: { x: number; y: number; w: number; h: number }[] = [];

      const chip = (text: string, cx: number, cy: number, col: string) => {
        ctx.font = "600 12px Source Sans 3, sans-serif";
        const tw = ctx.measureText(text).width + 16;
        const th = 22;
        const cands = [
          [0, 34],
          [0, -38],
          [-46, 34],
          [46, 34],
          [0, 52],
          [-70, 0],
          [70, 0],
        ];
        for (const [dx, dy] of cands) {
          const x = cx + dx - tw / 2;
          const y = cy + dy - th / 2;
          const box = { x, y, w: tw, h: th };
          const hit = placed.some(
            (b) => !(box.x > b.x + b.w || box.x + box.w < b.x || box.y > b.y + b.h || box.y + box.h < b.y),
          );
          if (!hit) {
            placed.push(box);
            ctx.fillStyle = "rgba(11,12,16,.86)";
            ctx.strokeStyle = col;
            ctx.lineWidth = 1;
            roundRect(ctx, x, y, tw, th, 8);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#eceae4";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, x + tw / 2, y + th / 2 + 0.4);
            return;
          }
        }
      };

      roundRect(ctx, sx(24), sy(60), sx(440) - sx(24), sy(492) - sy(60), 18);
      ctx.fillStyle = "rgba(196,180,138,.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(236,234,228,.12)";
      ctx.stroke();
      roundRect(ctx, sx(636), sy(60), sx(1076) - sx(636), sy(492) - sy(60), 18);
      ctx.fillStyle = "rgba(142,180,200,.06)";
      ctx.fill();
      ctx.stroke();

      ctx.font = "600 14px Source Sans 3, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#c4b48a";
      ctx.fillText("Neighborland · 出口国", sx(244), sy(36));
      ctx.fillStyle = "#8eb4c8";
      ctx.fillText("Isoland · 进口国", sx(856), sy(36));

      ctx.strokeStyle = "rgba(142,180,200,.35)";
      ctx.lineWidth = 1.3;
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        const yy = sy(140 + r * 120);
        for (let x = sx(478); x <= sx(622); x += 6) {
          const y = yy + Math.sin(x / 26 + now / 700 + r) * 5;
          x === sx(478) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (m === "tariff") {
        wallK = Math.min(1, wallK + 0.04);
        const wallH = (sy(492) - sy(60)) * wallK;
        const wx = sx(WALL_X);
        ctx.save();
        ctx.beginPath();
        ctx.rect(wx - 12, sy(60), 24, wallH);
        ctx.clip();
        for (let yy = sy(60); yy < sy(492); yy += 15) {
          ctx.fillStyle = (yy / 15) % 2 < 1 ? "rgba(209,122,122,.5)" : "rgba(209,122,122,.28)";
          ctx.fillRect(wx - 10, yy, 20, 12);
        }
        ctx.restore();
        if (wallK > 0.9) chip("报复关税 t", wx, sy(300), "rgba(209,122,122,.7)");
      } else {
        wallK = 0;
      }

      fs.forEach((f) => {
        const on = f.tariff === "only" ? m === "tariff" : f.tariff === "off" ? m !== "tariff" : true;
        const started = el >= STAGE[f.stage];
        ctx.beginPath();
        ctx.moveTo(sx(ACTORS[f.a].x), sy(ACTORS[f.a].y));
        ctx.bezierCurveTo(sx(f.c1.x), sy(f.c1.y), sx(f.c2.x), sy(f.c2.y), sx(ACTORS[f.b].x), sy(ACTORS[f.b].y));
        ctx.setLineDash([7, 7]);
        ctx.lineDashOffset = -el * 18;
        ctx.strokeStyle = on && started ? f.col : "rgba(154,155,166,.28)";
        ctx.lineWidth = on && started ? 2.1 : 1.3;
        ctx.globalAlpha = on && started ? 0.9 : 0.55;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      });

      for (const c of coins) {
        const kk = c.f.tariff === "wall" && m === "tariff" ? Math.min(c.k, wallHitK(c.f)) : c.k;
        if (kk < 0 || kk > 1) continue;
        const p = bez(c.f, kk);
        const sc = kk < 0.08 ? kk / 0.08 : 1;
        if (c.f.kind === "yen") {
          ctx.beginPath();
          ctx.arc(sx(p.x), sy(p.y), 8.5 * sc, 0, Math.PI * 2);
          ctx.fillStyle = c.f.col;
          ctx.fill();
          ctx.fillStyle = "#0b0c10";
          ctx.font = `600 ${11 * sc}px IBM Plex Mono, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("¥", sx(p.x), sy(p.y) + 0.5);
        } else {
          ctx.fillStyle = c.f.col;
          ctx.fillRect(sx(p.x) - 6 * sc, sy(p.y) - 5 * sc, 12 * sc, 10 * sc);
        }
      }

      for (const p of poofs) {
        const age = (now - p.t) / 700;
        ctx.globalAlpha = 1 - age;
        ctx.strokeStyle = "#d17a7a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), 6 + age * 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      Object.entries(ACTORS).forEach(([key, a]) => {
        const k = sx(a.x);
        const ky = sy(a.y);
        const pulse = pulses[key];
        if (pulse) {
          const age = (now - pulse) / 650;
          if (age < 1) {
            ctx.beginPath();
            ctx.arc(k, ky, 32 + age * 16, 0, Math.PI * 2);
            ctx.strokeStyle = a.c;
            ctx.globalAlpha = (1 - age) * 0.7;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
        ctx.beginPath();
        ctx.arc(k, ky, 28, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,.04)";
        ctx.fill();
        ctx.strokeStyle = a.c + "99";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        icon(ctx, a.kind, k, ky, a.c);
        chip(a.name, k, ky, a.c + "88");
      });

      raf = requestAnimationFrame(tick);
    };

    t0 = performance.now();
    const io = new IntersectionObserver(
      (es) => {
        visible = es.some((e) => e.isIntersecting);
        if (visible) raf = requestAnimationFrame(tick);
        else cancelAnimationFrame(raf);
      },
      { threshold: 0.08 },
    );
    io.observe(cv);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [epoch]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="inline-flex rounded-md border border-line bg-bg p-1" role="group" aria-label="情景切换">
          <button
            type="button"
            aria-pressed={mode === "accept"}
            onClick={() => setMode("accept")}
            className={cn(
              "h-9 rounded-[7px] px-3 text-sm font-medium",
              mode === "accept" ? "bg-surface-2 text-fg" : "text-muted",
            )}
          >
            接受补贴
          </button>
          <button
            type="button"
            aria-pressed={mode === "tariff"}
            onClick={() => setMode("tariff")}
            className={cn(
              "h-9 rounded-[7px] px-3 text-sm font-medium",
              mode === "tariff" ? "bg-surface-2 text-fg" : "text-muted",
            )}
          >
            报复关税
          </button>
        </div>
        <span className="flex-1" />
        <Button variant="ghost" size="iconSm" onClick={() => togglePause()} aria-label={paused ? "继续" : "暂停"}>
          {paused ? <Play /> : <Pause />}
        </Button>
        <Button variant="ghost" size="iconSm" onClick={replay} aria-label="重播">
          <RotateCcw />
        </Button>
        <Button variant="ghost" size="iconSm" onClick={exportPng} aria-label="导出 PNG">
          <Download />
        </Button>
      </div>
      <canvas
        ref={cvRef}
        className="block h-[320px] w-full sm:h-[420px] lg:h-[480px]"
        role="img"
        aria-label="资金流向模拟：NL 纳税人缴税，政府补贴纺织厂，纺织品低价出口到 Isoland"
      />
      <ol className="grid grid-cols-2 gap-2 border-t border-line px-3 py-3 sm:grid-cols-4 sm:px-5">
        {["NL 纳税人出钱", "NL 政府补贴工厂", "低价出口到 IS", "IS 消费者付款"].map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 text-sm",
              i < step ? "text-gain" : i === step ? "text-fg" : "text-dim",
            )}
          >
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border text-[11px] font-medium",
                i < step
                  ? "border-gain/50 bg-gain/15"
                  : i === step
                    ? "border-accent/50"
                    : "border-line",
              )}
            >
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <p className="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">{FLOW_CAPTIONS[mode]}</p>
    </div>
  );
}
