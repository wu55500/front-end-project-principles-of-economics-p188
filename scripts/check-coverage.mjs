// Minimal coverage gate built on Node's built-in V8 coverage (no extra deps).
// Runs the TypeScript unit suite with --experimental-test-coverage, parses the
// "all files" summary, and fails if line/branch/function coverage drops below
// the configured thresholds. Excludes test files and generated artifacts.
import { spawnSync } from "node:child_process";

const MIN = {
  line: Number(process.env.COV_MIN_LINE ?? 85),
  branch: Number(process.env.COV_MIN_BRANCH ?? 70),
  funcs: Number(process.env.COV_MIN_FUNCS ?? 85),
};

const tests = [
  "src/lib/app-data/app-data.test.ts",
  "src/lib/app-data/readiness-schedule.test.ts",
  "src/lib/auth/gate-identity.test.ts",
  "src/lib/auth/sign-in-gate.test.ts",
  "src/lib/econ/model.test.ts",
  "src/lib/data/worldbank.test.ts",
];

const args = [
  "--experimental-strip-types",
  "--experimental-test-coverage",
  "--test-coverage-exclude=**/*.test.ts",
  "--test-coverage-exclude=**/*.test.*",
  "--test-coverage-exclude=**/*.gen.*",
  "--test-coverage-exclude=src/routeTree.gen.ts",
  "--test",
  ...tests,
];

const r = spawnSync(process.execPath, args, { encoding: "utf8" });
const out = (r.stdout || "") + (r.stderr || "");
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");

const m = out.match(/^# all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/m);
if (!m) {
  console.error("\n[coverage] could not parse coverage summary");
  process.exit(1);
}
const linePct = Number(m[1]);
const branchPct = Number(m[2]);
const funcsPct = Number(m[3]);

console.log("\n# coverage gate -------------------------------");
const checks = [
  ["line", linePct, MIN.line],
  ["branch", branchPct, MIN.branch],
  ["funcs", funcsPct, MIN.funcs],
];
let failed = false;
for (const [name, got, want] of checks) {
  const ok = got >= want;
  if (!ok) failed = true;
  console.log(
    `#   ${name.padEnd(7)} ${got.toFixed(2)}%  >= ${want}%  ${ok ? "ok" : "FAIL"}`,
  );
}
if (r.status !== 0 && /not ok|fail [1-9]/.test(out)) failed = true;
process.exit(failed ? 1 : 0);
