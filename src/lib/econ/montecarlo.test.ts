import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deterministicNet, monteCarloNet } from "./montecarlo.ts";

describe("deterministicNet", () => {
  it("evaluates 20t + t^2", () => {
    assert.equal(deterministicNet(10), 300);
    assert.equal(deterministicNet(0), 0);
  });
});

describe("monteCarloNet", () => {
  const r = monteCarloNet({ t: 10, nSims: 4000, seed: 42 });

  it("produces the requested number of samples and 20 histogram bins", () => {
    assert.equal(r.samples.length, 4000);
    assert.equal(r.histogram.length, 20);
    assert.equal(r.nSims, 4000);
  });
  it("bins partition all samples and cover the observed range", () => {
    const total = r.histogram.reduce((s, b) => s + b.count, 0);
    assert.equal(total, 4000);
    assert.ok(r.p05 <= r.mean && r.mean <= r.p95);
  });
  it("reports a probability in [0,1]", () => {
    assert.ok(r.pNegative >= 0 && r.pNegative <= 1);
  });
  it("is reproducible for the same seed", () => {
    const a = monteCarloNet({ t: 10, nSims: 1000, seed: 7 });
    const b = monteCarloNet({ t: 10, nSims: 1000, seed: 7 });
    assert.deepEqual(a.samples, b.samples);
    assert.equal(a.mean, b.mean);
  });
  it("collapses near the deterministic value under zero volatility", () => {
    const tight = monteCarloNet({ t: 10, nSims: 4000, tVol: 0, shockVol: 0.001, seed: 1 });
    assert.ok(Math.abs(tight.mean - deterministicNet(10)) < 2);
  });
});
