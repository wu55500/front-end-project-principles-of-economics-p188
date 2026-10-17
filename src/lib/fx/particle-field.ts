/**
 * Pure particle/ripple physics for the global interaction layer.
 *
 * Deliberately framework- and DOM-free (no canvas, window or React here) so the
 * motion math and the content-avoidance rule can be unit tested under Node.
 * The React component in `interaction-fx.tsx` owns rendering and feeds this
 * module measured content rectangles + pointer events.
 *
 * Design goals (see enterprise-project-forge discipline):
 *  - effects must NEVER obscure readable/interactive content — particles that
 *    drift over a protected rect are pushed out and dimmed;
 *  - motion is cheap: fixed particle cap, no per-frame allocations in the hot
 *    loop, rAF pauses when the tab is hidden;
 *  - prefers-reduced-motion is honoured by the caller (no bursts spawned).
 */

export interface Vec {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** seconds of life remaining */
  life: number;
  /** seconds the particle lives in total, for life-ratio math */
  ttl: number;
  radius: number;
  /** 0..1 base brightness before avoidance dimming */
  hue: number;
}

export interface Ripple {
  x: number;
  y: number;
  /** current radius in px */
  r: number;
  /** px per second expansion speed */
  speed: number;
  /** max radius, ripple dies at >= maxR */
  maxR: number;
  /** 0..1, fades as it expands */
  alpha: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BurstOptions {
  x: number;
  y: number;
  count?: number;
  /** px / s initial speed */
  speed?: number;
  /** seconds */
  ttl?: number;
  /** deterministic random in [0,1) so tests are reproducible */
  random?: () => number;
  hue?: number;
}

const TAU = Math.PI * 2;

export function pointInRect(p: Vec, r: Rect, pad = 0): boolean {
  return (
    p.x >= r.x - pad &&
    p.x <= r.x + r.width + pad &&
    p.y >= r.y - pad &&
    p.y <= r.y + r.height + pad
  );
}

/**
 * Closest point on rectangle `r` to point `p`; returns a vector pointing away
 * from the rect (zero when the point is outside/on the padded boundary).
 */
export function pushOutOfRect(p: Vec, r: Rect, pad = 0): Vec {
  const minX = r.x - pad;
  const maxX = r.x + r.width + pad;
  const minY = r.y - pad;
  const maxY = r.y + r.height + pad;
  if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
    return { x: 0, y: 0 };
  }
  // Distance to each edge; push toward the nearest one.
  const dl = p.x - minX;
  const dr = maxX - p.x;
  const dt = p.y - minY;
  const db = maxY - p.y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { x: -1, y: 0 };
  if (m === dr) return { x: 1, y: 0 };
  if (m === dt) return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

/**
 * Spawn a radial burst of short-lived particles. Pure: returns a new array the
 * caller splices into its pool. Uses a seeded/deterministic RNG when provided.
 */
export function spawnBurst(opts: BurstOptions): Particle[] {
  const { x, y } = opts;
  const count = opts.count ?? 14;
  const speed = opts.speed ?? 120;
  const ttl = opts.ttl ?? 0.7;
  const rand = opts.random ?? Math.random;
  const hue = opts.hue ?? 0;
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU + rand() * (TAU / count);
    const v = speed * (0.35 + rand() * 0.65);
    out.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: ttl * (0.7 + rand() * 0.5),
      ttl,
      radius: 1.4 + rand() * 2.2,
      hue,
    });
  }
  return out;
}

export function spawnRipple(x: number, y: number, maxR = 90): Ripple {
  return { x, y, r: 4, speed: maxR * 2.4, maxR, alpha: 0.5 };
}

export interface StepResult {
  particles: Particle[];
  /** 0..1 visibility multiplier per particle, aligned by index */
  dim: number[];
  ripples: Ripple[];
}

/**
 * Advance the simulation by dt seconds. Particles are damped, expire, and are
 * pushed away from protected content rectangles (dimmed while overlapping so
 * the effect never competes with text/controls). Returns survivors.
 */
export function stepField(
  particles: Particle[],
  ripples: Ripple[],
  rects: Rect[],
  dt: number,
  bounds: { width: number; height: number },
  pad = 6,
): StepResult {
  const nextP: Particle[] = [];
  const dim: number[] = [];
  for (const p of particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    // friction + slight gravity for an organic settle
    const drag = 0.9;
    p.vx *= Math.pow(drag, dt * 60);
    p.vy *= Math.pow(drag, dt * 60);
    p.vy += 26 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    let blocked = false;
    for (const r of rects) {
      if (pointInRect(p, r, pad)) {
        const n = pushOutOfRect(p, r, pad);
        // Steer velocity along the outward normal and nudge the point out.
        p.vx += n.x * 320 * dt;
        p.vy += n.y * 320 * dt;
        p.x += n.x * 1.5;
        p.y += n.y * 1.5;
        blocked = true;
      }
    }
    if (p.x < -20 || p.x > bounds.width + 20 || p.y > bounds.height + 20) {
      continue;
    }
    nextP.push(p);
    dim.push(blocked ? 0.15 : 1);
  }

  const nextR: Ripple[] = [];
  for (const rp of ripples) {
    rp.r += rp.speed * dt;
    rp.alpha = 0.5 * Math.max(0, 1 - rp.r / rp.maxR);
    if (rp.r < rp.maxR) nextR.push(rp);
  }

  return { particles: nextP, dim, ripples: nextR };
}

/** life ratio 1 -> 0, used by the renderer to fade particles out. */
export function lifeRatio(p: Particle): number {
  return Math.max(0, Math.min(1, p.life / p.ttl));
}
