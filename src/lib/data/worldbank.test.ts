import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWorldBankPayload, WB_INDICATORS } from "./worldbank.ts";

describe("parseWorldBankPayload", () => {
  it("maps and sorts rows by year, keeping numeric values only", () => {
    const payload = [
      { page: 1 },
      [
        { date: "2024", value: 55.2 },
        { date: "1990", value: 30 },
        { date: "2005", value: 41.75 },
      ],
    ];
    assert.deepEqual(parseWorldBankPayload(payload), [
      { year: 1990, value: 30 },
      { year: 2005, value: 41.75 },
      { year: 2024, value: 55.2 },
    ]);
  });

  it("drops null/missing values", () => {
    const payload = [{}, [{ date: "2020", value: null }, { date: "2021" }]];
    assert.deepEqual(parseWorldBankPayload(payload), []);
  });

  it("returns [] when the envelope is malformed", () => {
    assert.deepEqual(parseWorldBankPayload(undefined), []);
    assert.deepEqual(parseWorldBankPayload(null), []);
    assert.deepEqual(parseWorldBankPayload([{ page: 1 }, null]), []);
    assert.deepEqual(parseWorldBankPayload({}), []);
    assert.deepEqual(parseWorldBankPayload([]), []);
  });

  it("ignores non-finite numbers and undated rows", () => {
    const payload = [
      {},
      [
        { date: "bad", value: 1 },
        { date: "2019", value: Number.NaN },
        { date: "2018", value: Infinity },
        { date: "2017", value: 9 },
      ],
    ];
    assert.deepEqual(parseWorldBankPayload(payload), [{ year: 2017, value: 9 }]);
  });

  it("catalog exposes the four curated trade indicators", () => {
    assert.equal(WB_INDICATORS.length, 4);
    assert.ok(WB_INDICATORS.every((i) => i.code && i.label && i.unit));
  });
});
