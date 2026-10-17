import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advancePhase,
  arcPoint,
  easedLerp,
  easeInOutCubic,
  lonLatToVec3,
  midDirection,
} from "./arc.ts";

describe("lonLatToVec3", () => {
  it("places (0,0) on +x at the given radius", () => {
    const p = lonLatToVec3(0, 0, 2);
    assert.ok(Math.abs(p.x - 2) < 1e-9);
    assert.ok(Math.abs(p.y) < 1e-9);
    assert.ok(Math.abs(p.z) < 1e-9);
  });
  it("north pole maps to +y", () => {
    const p = lonLatToVec3(12, 90, 1);
    assert.ok(Math.abs(p.y - 1) < 1e-9);
    assert.ok(Math.hypot(p.x, p.z) < 1e-9);
  });
});

describe("arcPoint", () => {
  const a = lonLatToVec3(0, 0, 1);
  const b = lonLatToVec3(90, 0, 1);
  it("returns endpoints on the radial rays of a/b (with the small render gap)", () => {
    // Rendered arcs sit R+0.015 off the surface, so endpoints share direction
    // with the surface anchors rather than their exact coordinates.
    const gap = 0.015;
    const p0 = arcPoint(a, b, 0, 1, 0.3);
    const p1 = arcPoint(a, b, 1, 1, 0.3);
    const dir = (p: { x: number; y: number; z: number }, q: typeof p) => {
      const cp = { x: p.y * q.z - p.z * q.y, y: p.z * q.x - p.x * q.z, z: p.x * q.y - p.y * q.x };
      return Math.hypot(cp.x, cp.y, cp.z);
    };
    assert.ok(Math.abs(Math.hypot(p0.x, p0.y, p0.z) - (1 + gap)) < 1e-6);
    assert.ok(Math.abs(Math.hypot(p1.x, p1.y, p1.z) - (1 + gap)) < 1e-6);
    assert.ok(dir(p0, a) < 1e-6);
    assert.ok(dir(p1, b) < 1e-6);
  });
  it("lifts the middle above the surface more than endpoints", () => {
    const mid = arcPoint(a, b, 0.5, 1, 0.3);
    const end = arcPoint(a, b, 0, 1, 0.3);
    assert.ok(Math.hypot(mid.x, mid.y, mid.z) > Math.hypot(end.x, end.y, end.z));
  });
});

describe("advancePhase", () => {
  it("wraps within [0,1) and is deterministic for dt", () => {
    assert.ok(Math.abs(advancePhase(0.9, 0.5, 0.5) - 0.15) < 1e-9);
    assert.equal(advancePhase(0, 1, 1), 0);
  });
});

describe("easing", () => {
  it("easeInOutCubic clamps and hits anchors", () => {
    assert.equal(easeInOutCubic(0), 0);
    assert.equal(easeInOutCubic(1), 1);
    assert.ok(Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-9);
    assert.equal(easeInOutCubic(-5), 0);
    assert.equal(easeInOutCubic(5), 1);
  });
  it("easedLerp interpolates toward target", () => {
    assert.equal(easedLerp(0, 10, 0), 0);
    assert.equal(easedLerp(0, 10, 1), 10);
    assert.ok(Math.abs(easedLerp(0, 10, 0.5) - 5) < 1e-9);
  });
});

describe("midDirection", () => {
  it("returns a unit vector", () => {
    const m = midDirection(lonLatToVec3(0, 0), lonLatToVec3(90, 0));
    assert.ok(Math.abs(Math.hypot(m.x, m.y, m.z) - 1) < 1e-9);
  });
});
