import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildGame,
  dominantStrategies,
  mixedNash,
  pureNashEquilibria,
} from "./game.ts";

describe("buildGame", () => {
  it("clamps subsidy strength to [0,30]", () => {
    assert.equal(buildGame(-5).t, 0);
    assert.equal(buildGame(99).t, 30);
  });
  it("free trade + subsidy gives Isoland the acceptance gain", () => {
    const g = buildGame(10);
    // acceptGain = 20*10 + 100 = 300, NL bears -100
    assert.equal(g.matrix[0][0].is, 300);
    assert.equal(g.matrix[0][0].nl, -100);
  });
});

describe("pureNashEquilibria", () => {
  it("finds (free_trade, no_subsidy) as the unique equilibrium of this payoff setup", () => {
    const eq = pureNashEquilibria(buildGame(10));
    assert.equal(eq.length, 1);
    assert.equal(eq[0].isStrategy, "free_trade");
    assert.equal(eq[0].nlStrategy, "no_subsidy");
  });
  it("at t=0 the baseline 0/0 corner is an equilibrium", () => {
    const eq = pureNashEquilibria(buildGame(0));
    // with no subsidy nothing is gained; multiple 0/0 cells are mutual best replies
    assert.ok(eq.some((e) => e.isStrategy === "free_trade" && e.nlStrategy === "no_subsidy"));
  });
});

describe("dominantStrategies", () => {
  it("free trade is the dominant strategy for Isoland; NL has no dominant strategy (best-responds)", () => {
    const d = dominantStrategies(buildGame(10));
    assert.equal(d.is, "free_trade");
    // NL's best choice depends on IS: accept-subside loses, retaliate-noSubsidy loses
    assert.equal(d.nl, null);
  });
});

describe("mixedNash", () => {
  it("returns null when there is no interior solution", () => {
    // this structured payoff table has a corner solution, not an interior mix
    assert.equal(mixedNash(buildGame(10)), null);
  });
  it("returns an in-range mix for a classic matching-pennies style matrix", () => {
    const g = {
      t: 1,
      isStrategies: [
        { id: "free_trade", label: "f" },
        { id: "tariff", label: "t" },
      ],
      nlStrategies: [
        { id: "subsidy", label: "s" },
        { id: "no_subsidy", label: "n" },
      ],
      matrix: [
        [
          { is: 1, nl: -1 },
          { is: -1, nl: 1 },
        ],
        [
          { is: -1, nl: 1 },
          { is: 1, nl: -1 },
        ],
      ],
    };
    const m = mixedNash(g);
    assert.ok(m);
    assert.ok(m!.pFreeTrade >= 0 && m!.pFreeTrade <= 1);
    assert.ok(m!.pSubsidy >= 0 && m!.pSubsidy <= 1);
  });
});
