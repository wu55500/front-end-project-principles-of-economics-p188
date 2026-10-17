/**
 * Pure helpers for great-circle-ish trade arcs and animation easing.
 *
 * Kept free of three.js / React so the geometry and easing rules can be unit
 * tested under Node. The globe component builds THREE.Vector3 from the same
 * numbers this module returns.
 */

export type Vec3 = { x: number; y: number; z: number };

export type LonLat = { lon: number; lat: number };

const DEG = Math.PI / 180;

/** Spherical lon/lat (degrees) -> 3D unit-ish point at radius r. */
export function lonLatToVec3(lon: number, lat: number, r = 1): Vec3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  const cl = Math.cos(la);
  return {
    x: r * cl * Math.cos(lo),
    y: r * Math.sin(la),
    z: -r * cl * Math.sin(lo),
  };
}

/**
 * Point at parameter u (0..1) on the elevated arc between two surface points.
 * The chord is normalised back onto the sphere and pushed up by a half-sine
 * lift, matching the rendered trade lane shape.
 */
export function arcPoint(
  a: Vec3,
  b: Vec3,
  u: number,
  radius: number,
  lift: number,
): Vec3 {
  const x = a.x + (b.x - a.x) * u;
  const y = a.y + (b.y - a.y) * u;
  const z = a.z + (b.z - a.z) * u;
  const len = Math.hypot(x, y, z) || 1;
  const rr = radius + lift * Math.sin(Math.PI * u) + 0.015;
  return { x: (x / len) * rr, y: (y / len) * rr, z: (z / len) * rr };
}

/** Frame-rate independent loop phase: advances u by speed*dt and wraps to [0,1). */
export function advancePhase(u: number, speed: number, dt: number): number {
  const next = (u + speed * dt) % 1;
  return next < 0 ? next + 1 : next;
}

/** easeInOutCubic for smooth camera flights. */
export function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Linear interpolation (camera position/distance) with an eased parameter.
 * Returns a + (b-a)*easeInOutCubic(t).
 */
export function easedLerp(a: number, b: number, t: number): number {
  return a + (b - a) * easeInOutCubic(t);
}

/** Great-circle midpoint direction of two surface points (for camera focus). */
export function midDirection(a: Vec3, b: Vec3): Vec3 {
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  const z = (a.z + b.z) / 2;
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}
