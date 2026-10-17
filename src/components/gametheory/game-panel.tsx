/**
 * Game-theory panel: a clickable 2x2 payoff matrix for the trade game
 * (Neighborland: subsidize / don't  ×  Isoland: free trade / retaliate).
 *
 * Cells recompute from the global subsidy strength t. The UI highlights every
 * pure-strategy Nash equilibrium, flags dominant strategies on the headers,
 * and — when a cell is selected — shows each side's incentive to deviate.
 * All numbers/equilibria come from the unit-tested lib/econ/game module.
 */
import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import {
  buildGame,
  dominantStrategies,
  mixedNash,
  pureNashEquilibria,
  type IsStrategy,
  type NlStrategy,
} from "@/lib/econ/game";
import { useViz } from "@/store/viz";

type CellKey = `${IsStrategy}|${NlStrategy}`;

export function GamePanel() {
  const t = useViz((s) => s.t);
  const [picked, setPicked] = useState<CellKey | null>(null);

  const g = useMemo(() => buildGame(t), [t]);
  const nash = useMemo(
    () => new Set(pureNashEquilibria(g).map((n) => `${n.isStrategy}|${n.nlStrategy}`)),
    [g],
  );
  const dom = useMemo(() => dominantStrategies(g), [g]);
  const mixed = useMemo(() => mixedNash(g), [g]);

  const rows: IsStrategy[] = ["free_trade", "tariff"];
  const cols: NlStrategy[] = ["subsidy", "no_subsidy"];
  const rowLabel = (id: IsStrategy) => g.isStrategies.find((s) => s.id === id)!.label;
  const colLabel = (id: NlStrategy) => g.nlStrategies.find((s) => s.id === id)!.label;

  // deviation incentives for the picked cell
  const deviation = useMemo(() => {
    if (!picked) return null;
    const [ri, cj] = picked.split("|") as [IsStrategy, NlStrategy];
    const i = rows.indexOf(ri);
    const j = cols.indexOf(cj);
    const cur = g.matrix[i][j];
    const isAlt = g.matrix[1 - i][j];
    const nlAlt = g.matrix[i][1 - j];
    return {
      isDelta: Math.round(isAlt.is - cur.is),
      nlDelta: Math.round(nlAlt.nl - cur.nl),
      isWouldMove: isAlt.is > cur.is + 1e-9,
      nlWouldMove: nlAlt.nl > cur.nl + 1e-9,
    };
  }, [picked, g]); // eslint-disable-line react-hooks/exhaustive-deps

  const domTag = (id: string | null, me: string) =>
    id === me ? (
      <span className="ml-1 rounded bg-is/20 px-1.5 py-0.5 text-[10px] font-bold text-is">
        占优
      </span>
    ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
        <span className="font-medium text-fg">动手试试 👇</span>
        <span className="text-muted">
          拖动页面顶部的补贴强度 t（当前 t = {t}），四格收益与纳什均衡实时重算
        </span>
        <span className="text-muted">点亮任意一格，看两国有没有动机「单方面反悔」</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* payoff matrix */}
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-muted" />
            <h3 className="font-display text-lg">两国策略 · 支付矩阵</h3>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-separate border-spacing-1.5 text-center text-sm">
              <thead>
                <tr>
                  <th className="p-2 align-bottom text-xs text-dim">IS 行 ／ NL 列</th>
                  {cols.map((c) => (
                    <th key={c} className="p-2 align-bottom text-nl">
                      <div className="text-[13px] font-semibold leading-tight">
                        {colLabel(c)}
                      </div>
                      {domTag(dom.nl, c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r}>
                    <th className="p-2 text-right text-is">
                      <span className="text-[13px] font-semibold">{rowLabel(r)}</span>
                      {domTag(dom.is, r)}
                    </th>
                    {cols.map((c, j) => {
                      const key: CellKey = `${r}|${c}`;
                      const cell = g.matrix[i][j];
                      const isNash = nash.has(key);
                      const isPicked = picked === key;
                      return (
                        <td key={c}>
                          <button
                            type="button"
                            onClick={() => setPicked(isPicked ? null : key)}
                            className={[
                              "relative w-full min-w-[132px] rounded-lg border px-3 py-3 transition-all",
                              isNash
                                ? "border-is/70 bg-is/10 shadow-[0_0_18px_-4px] shadow-is/50"
                                : "border-line bg-bg/40 hover:border-muted",
                              isPicked ? "ring-2 ring-accent" : "",
                            ].join(" ")}
                          >
                            {isNash && (
                              <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-is px-2 py-0.5 text-[10px] font-bold text-bg">
                                纳什均衡
                              </span>
                            )}
                            <span className="block text-[11px] text-dim">
                              IS / NL 净福利
                            </span>
                            <span className="mt-1 block font-display text-lg leading-none">
                              <span className="text-is">{Math.round(cell.is)}</span>
                              <span className="mx-1 text-dim">/</span>
                              <span className="text-nl">{Math.round(cell.nl)}</span>
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-dim">
            支付为相对「不补贴 +
            自由贸易」基准的净福利变化，单位与课本一致；正值为获益、负值为损失。
          </p>
        </div>

        {/* interpretation rail */}
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="font-display text-base">均衡解读</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li>
                纯策略纳什均衡：
                <b className="text-fg">
                  {nash.size === 0
                    ? " 无（见混合策略）"
                    : [...nash]
                        .map((k) => {
                          const [ri, cj] = k.split("|") as [IsStrategy, NlStrategy];
                          return ` ${rowLabel(ri)} × ${colLabel(cj)}`;
                        })
                        .join("；")}
                </b>
              </li>
              <li>
                IS 占优策略：
                <b className="text-fg">
                  {" "}
                  {dom.is ? rowLabel(dom.is as IsStrategy) : "无"}
                </b>
              </li>
              <li>
                NL 占优策略：
                <b className="text-fg">
                  {" "}
                  {dom.nl ? colLabel(dom.nl as NlStrategy) : "无"}
                </b>
              </li>
              <li>
                混合策略均衡：
                <b className="text-fg">
                  {" "}
                  {mixed
                    ? `IS 以 ${(mixed.pFreeTrade * 100).toFixed(0)}% 选自由贸易、NL 以 ${(
                        mixed.pSubsidy * 100
                      ).toFixed(0)}% 选补贴`
                    : "此支付结构下无内点解，均衡落在纯策略"}
                </b>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-line bg-surface p-5 text-sm">
            <h3 className="font-display text-base">单方面偏离测试</h3>
            {!picked || !deviation ? (
              <p className="mt-3 text-muted">
                点左侧任一格子，把它设成「当前局势」，这里会算出双方反悔的得失。
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-muted">
                <li>
                  IS 若改打另一策略：净福利变化{" "}
                  <b
                    className={
                      deviation.isDelta > 0
                        ? "text-gain"
                        : deviation.isDelta < 0
                          ? "text-loss"
                          : "text-fg"
                    }
                  >
                    {deviation.isDelta > 0 ? "+" : ""}
                    {deviation.isDelta}
                  </b>
                  <span className="ml-1 text-dim">
                    {deviation.isWouldMove ? "→ 想反悔" : "→ 不愿动"}
                  </span>
                </li>
                <li>
                  NL 若改打另一策略：净福利变化{" "}
                  <b
                    className={
                      deviation.nlDelta > 0
                        ? "text-gain"
                        : deviation.nlDelta < 0
                          ? "text-loss"
                          : "text-fg"
                    }
                  >
                    {deviation.nlDelta > 0 ? "+" : ""}
                    {deviation.nlDelta}
                  </b>
                  <span className="ml-1 text-dim">
                    {deviation.nlWouldMove ? "→ 想反悔" : "→ 不愿动"}
                  </span>
                </li>
                <li className="pt-1 text-xs text-dim">
                  {deviation.isWouldMove || deviation.nlWouldMove
                    ? "至少一方想偏离，所以这一格不是稳定结局。"
                    : "双方都不愿单方面改变——这一格自我强化，正是纳什均衡。"}
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
