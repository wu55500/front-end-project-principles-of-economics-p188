/**
 * Lightweight causal-inference toolkit for teaching panels:
 *   - difference-in-differences (2x2)
 *   - Granger causality (bivariate lag regression + F-test)
 *
 * Pure functions, no dependencies beyond basic linear algebra. These are
 * teaching tools — they report assumptions and uncertainty rather than
 * presenting a correlation as a causal fact.
 */

// ── Difference in differences ───────────────────────────────────────────────

export interface DidCell {
  /** mean outcome */
  y: number;
  n: number;
}
export interface DidResult {
  /** treatment effect = (treat,after − treat,before) − (control,after − control,before) */
  effect: number;
  treatBefore: number;
  treatAfter: number;
  controlBefore: number;
  controlAfter: number;
  /** standard error under parallel-trends / spherical-errors assumption */
  se: number;
  t: number;
  p: number;
  note: string;
}

export function differenceInDifferences(input: {
  treatBefore: DidCell;
  treatAfter: DidCell;
  controlBefore: DidCell;
  controlAfter: DidCell;
}): DidResult {
  const { treatBefore: tb, treatAfter: ta, controlBefore: cb, controlAfter: ca } = input;
  const effect = ta.y - tb.y - (ca.y - cb.y);

  // Group-mean variance (heteroskedasticity-robust-ish for four cells).
  // SE of the contrast from four independent cell means:
  // var = s_t1²/n_t1 + s_t0²/n_t0 + s_c1²/n_c1 + s_c0²/n_c0.
  // Without raw data we approximate from sample sizes assuming the cell means
  // were supplied; caller may pass group SD via n only. We expose SE as NaN-safe
  // approximation using n (teaches that SE needs dispersion).
  const harmonicN = 1 / Math.max(tb.n, 1) + 1 / Math.max(ta.n, 1) +
    1 / Math.max(cb.n, 1) + 1 / Math.max(ca.n, 1);
  // Without within-cell variance we cannot compute an SE; use a placeholder of
  // null so the UI never prints a fake precision.
  const se = (input as unknown as { sd?: number }).sd != null
    ? Math.abs((input as unknown as { sd: number }).sd) * Math.sqrt(harmonicN)
    : Number.NaN;
  const tStat = Number.isNaN(se) ? Number.NaN : effect / se;
  const p = Number.isNaN(tStat) ? Number.NaN : normalTwoSidedP(Math.abs(tStat));

  return {
    effect,
    treatBefore: tb.y,
    treatAfter: ta.y,
    controlBefore: cb.y,
    controlAfter: ca.y,
    se,
    t: tStat,
    p,
    note: "DID 识别依赖平行趋势假设：若无政策，处理组与对照组的结果变化应相同。",
  };
}

// ── Ordinary least squares (normal equations) ───────────────────────────────

export interface OlsResult {
  beta: number[];
  residuals: number[];
  sigma2: number;
  rss: number;
}

export function ols(X: number[][], y: number[]): OlsResult {
  const n = y.length;
  const k = X[0].length;
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const Xty = matVec(Xt, y);
  const inv = invert(XtX);
  if (!inv) throw new Error("OLS: singular design matrix (multicollinear lags?)");
  const beta = matVec(inv, Xty);
  const fitted = matVec(X, beta);
  const residuals = y.map((yi, i) => yi - fitted[i]);
  const rss = residuals.reduce((s, r) => s + r * r, 0);
  const sigma2 = rss / Math.max(n - k, 1);
  return { beta, residuals, sigma2, rss };
}

// ── Granger causality ────────────────────────────────────────────────────────

export interface GrangerResult {
  /** Does x Granger-cause y? */
  xCausesY: boolean;
  f: number;
  p: number;
  lags: number;
  n: number;
  rssRestricted: number;
  rssUnrestricted: number;
  note: string;
}

export function grangerCausality(
  yRaw: number[],
  xRaw: number[],
  lags = 2,
): GrangerResult {
  if (yRaw.length !== xRaw.length) throw new Error("Granger: series length mismatch");
  const T = yRaw.length;
  const start = lags;
  const n = T - start;
  if (n <= lags + 2) throw new Error("Granger: not enough observations for these lags");

  // Restricted: y_t = const + Σ y_{t-i}. Unrestricted adds Σ x_{t-i}.
  const buildX = (includeX: boolean): number[][] => {
    const rows: number[][] = [];
    for (let t = start; t < T; t++) {
      const row: number[] = [1];
      for (let i = 1; i <= lags; i++) row.push(yRaw[t - i]);
      if (includeX) {
        for (let i = 1; i <= lags; i++) row.push(xRaw[t - i]);
      }
      rows.push(row);
    }
    return rows;
  };
  const y = yRaw.slice(start);

  const restricted = ols(buildX(false), y);
  const unrestricted = ols(buildX(true), y);

  const q = lags;
  const dfDenom = n - (2 * lags + 1);
  const f =
    ((restricted.rss - unrestricted.rss) / q) /
    Math.max(unrestricted.rss / Math.max(dfDenom, 1), 1e-12);
  const p = fDistributionP(f, q, dfDenom);

  return {
    xCausesY: p < 0.05,
    f,
    p,
    lags,
    n,
    rssRestricted: restricted.rss,
    rssUnrestricted: unrestricted.rss,
    note: "Granger 因果检验的是预测增量：x 的滞后项能否改善对 y 的预测，并非反事实意义上的因果。",
  };
}

// ── math helpers ─────────────────────────────────────────────────────────────

function transpose(m: number[][]): number[][] {
  return m[0].map((_, j) => m.map((row) => row[j]));
}
function matMul(a: number[][], b: number[][]): number[][] {
  return a.map((row) => transpose(b).map((col) => row.reduce((s, v, i) => s + v * col[i], 0)));
}
function matVec(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((s, x, i) => s + x * v[i], 0));
}

/** Invert via Gauss-Jordan. Returns null if singular. */
function invert(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-12) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    const d = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}

// ── distribution approximations ─────────────────────────────────────────────

/** Two-sided normal p-value via Abramowitz & Stegun erf approximation. */
export function normalTwoSidedP(z: number): number {
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return Math.min(1, 2 * p);
}

/** Regularized incomplete beta (Lentz) for F-distribution survival. */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 100;
  const EPS = 3e-10;
  const FPMIN = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

function lnGamma(z: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Upper-tail p-value of an F statistic. */
export function fDistributionP(f: number, d1: number, d2: number): number {
  if (!(f > 0) || !isFinite(f)) return 1;
  const x = d2 / (d2 + d1 * f);
  return betai(d2 / 2, d1 / 2, x);
}
