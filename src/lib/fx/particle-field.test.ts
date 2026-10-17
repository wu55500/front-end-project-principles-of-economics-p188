import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lifeRatio,
  pointInRect,
  pushOutOfRect,
  spawnBurst,
  spawnRipple,
  stepField,
  type Particle,
  type Rect,
} from "./particle-field.ts";

// deterministic RNG so geometry is reproducible
let seed = 7;
function rng() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

describe("pointInRect", () => {
  const r: Rect = { x: 10, y: 10, width: 20, height: 20 };
  it("contains the centre but not an outside point", () => {
    assert.equal(pointInRect({ x: 20, y: 20 }, r), true);
    assert.equal(pointInRect({ x: 0, y: 20 }, r), false);
  });
  it("honours padding", () => {
    assert.equal(pointInRect({ x: 5, y: 20 }, r, 6), true);
    assert.equal(pointInRect({ x: 3, y: 20 }, r, 6), false);
  });
});

describe("pushOutOfRect", () => {
  const r: Rect = { x: 10, y: 10, width: 20, height: 20 };
  it("is zero outside the rect", () => {
    assert.deepEqual(pushOutOfRect({ x: 0, y: 20 }, r), { x: 0, y: 0 });
  });
  it("pushes toward the nearest edge", () => {
    assert.deepEqual(pushOutOfRect({ x: 20, y: 28 }, r), { x: 0, y: 1 }); // bottom nearest
    assert.deepEqual(pushOutOfRect({ x: 12, y: 20 }, r), { x: -1, y: 0 }); // left nearest
    assert.deepEqual(pushOutOfRect({ x: 28, y: 20 }, r), { x: 1, y: 0 }); // right nearest
    assert.deepEqual(pushOutOfRect({ x: 20, y: 12 }, r), { x: 0, y: -1 }); // top nearest
  });
});

describe("spawnBurst", () => {
  it("produces the requested count with radial, finite velocities", () => {
    const ps = spawnBurst({ x: 100, y: 100, count: 12, random: rng });
    assert.equal(ps.length, 12);
    for (const p of ps) {
      assert.ok(Number.isFinite(p.vx) && Number.isFinite(p.vy));
      assert.ok(p.life > 0 && p.ttl > 0 && p.radius > 0);
    }
  });
});

describe("spawnRipple", () => {
  it("starts small and expands to a cap", () => {
    const rp = spawnRipple(10, 10, 80);
    assert.equal(rp.r, 4);
    assert.equal(rp.maxR, 80);
  });
});

describe("stepField", () => {
  const bounds = { width: 400, height: 800 };

  it("expires particles once their life runs out", () => {
    const ps: Particle[] = [
      { x: 5, y: 5, vx: 0, vy: 0, life: 0.01, ttl: 1, radius: 2, hue: 0 },
    ];
    const r = stepField(ps, [], [], 0.05, bounds);
    assert.equal(r.particles.length, 0);
  });

  it("fades a ripple to nothing at max radius", () => {
    const rp = spawnRipple(20, 20, 50);
    const r = stepField([], [rp], [], 1, bounds);
    assert.equal(r.ripples.length, 0);
  });

  it("pushes particles away from a protected content rect and dims them", () => {
    const rect: Rect = { x: 100, y: 100, width: 80, height: 40 };
    // particle just inside the left edge, moving right into the text
    const ps: Particle[] = [
      { x: 104, y: 120, vx: 30, vy: 0, life: 1, ttl: 1, radius: 2, hue: 0 },
    ];
    const before = ps[0].x;
    const r = stepField(ps, [], [rect], 0.1, bounds);
    assert.equal(r.particles.length, 1);
    // pushed left (negative vx impulse) and dimmed while overlapping
    assert.ok(r.particles[0].vx < 30);
    assert.ok(r.particles[0].x <= before + 1);
    assert.equal(r.dim[0], 0.15);
  });

  it("does not dim particles in empty space", () => {
    const ps: Particle[] = [
      { x: 5, y: 5, vx: 0, vy: 0, life: 1, ttl: 1, radius: 2, hue: 0 },
    ];
    const r = stepField(ps, [], [{ x: 100, y: 100, width: 10, height: 10 }], 0.1, bounds);
    assert.equal(r.dim[0], 1);
  });

  it("lifeRatio clamps to [0,1]", () => {
    assert.equal(lifeRatio({ life: 0.5, ttl: 1 } as Particle), 0.5);
    assert.equal(lifeRatio({ life: 2, ttl: 1 } as Particle), 1);
    assert.equal(lifeRatio({ life: -1, ttl: 1 } as Particle), 0);
  });
});
