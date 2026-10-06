import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTARKY_P,
  T_MAX,
  calc,
  demandQ,
  fmt,
  fmtSigned,
  netCurve,
  scenarios,
  supplyQ,
} from "./model.ts";

test("基准自由贸易：t=0 时一切不变", () => {
  const m = calc(0);
  assert.equal(m.p2, 60);
  assert.equal(m.qd2, 60);
  assert.equal(m.qs2, 40);
  assert.equal(m.imports, 20);
  assert.equal(m.cs, 0);
  assert.equal(m.ps, 0);
  assert.equal(m.net, 0);
});

test("默认案例 t=20：与课本口径一致 +1400 / −600 / +800", () => {
  const m = calc(20);
  assert.equal(m.p2, 40);
  assert.equal(m.qd2, 80);
  assert.equal(m.qs2, 20);
  assert.equal(m.cs, 1400);
  assert.equal(m.ps, -600);
  assert.equal(m.net, 800);
});

test("进口量 = 20+2t：补贴刺激进口扩张，关税才能打回 20", () => {
  assert.equal(calc(0).imports, 20);
  assert.equal(calc(20).imports, 60);
  for (const t of [0, 5, 10, 20, 30]) {
    assert.equal(calc(t).imports, 20 + 2 * t, `t=${t}`);
  }
});

test("性质：接受补贴永远不亏（net ≥ 0 且随 t 递增）", () => {
  let prev = -Infinity;
  for (let t = 0; t <= T_MAX; t++) {
    const net = calc(t).net;
    assert.ok(net >= 0, `t=${t} net=${net}`);
    assert.ok(net >= prev, "net 单调不减");
    prev = net;
  }
});

test("性质：cs 恒非负、ps 恒非正", () => {
  for (let t = 0; t <= T_MAX; t += 3) {
    const m = calc(t);
    assert.ok(m.cs >= 0);
    assert.ok(m.ps <= 0);
  }
});

test("t 越界被钳制到 [0, 30]", () => {
  assert.equal(calc(-5).t, 0);
  assert.equal(calc(99).t, 30);
  assert.equal(calc(99).net, calc(30).net);
});

test("三种选择：t=20 时 接受+800 / 关税0 / 禁止−100", () => {
  const s = scenarios(20);
  assert.equal(s.accept.net, 800);
  assert.equal(s.accept.consumer, 1400);
  assert.equal(s.accept.producer, -600);
  assert.equal(s.tariff.net, 0);
  assert.equal(s.tariff.government, 400);
  assert.equal(s.tariff.dwl, -400);
  assert.equal(s.ban.net, -100);
  assert.equal(s.ban.producer, 450);
  assert.equal(s.ban.consumer, -550);
});

test("报复关税净福利曲线在 t=20 归零、t=30 转负", () => {
  assert.equal(scenarios(20).tariff.net, 0);
  assert.ok(scenarios(30).tariff.net < 0);
  assert.ok(scenarios(10).tariff.net > 0);
});

test("自给自足均衡价 P=70、Q=50", () => {
  assert.equal(AUTARKY_P, 70);
  assert.equal(demandQ(70), supplyQ(70));
});

test("净福利曲线采样点数与端点正确", () => {
  const c = netCurve(31);
  assert.equal(c.xs.length, 31);
  assert.equal(c.accept[0], 0);
  assert.equal(c.tariff[0], 0);
  assert.equal(Math.round(c.accept[30]), 20 * 30 + 900);
});

test("格式化：千分位与符号", () => {
  assert.equal(fmt(1400), "1,400");
  assert.equal(fmtSigned(800), "+800");
  assert.equal(fmtSigned(-600), "−600");
});
