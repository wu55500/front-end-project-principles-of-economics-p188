import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUIZ } from "@/lib/econ/content";
import { cn } from "@/lib/utils";

export function QuizSection() {
  const [picked, setPicked] = useState<(number | null)[]>([null, null, null]);
  const answered = picked.filter((p) => p !== null).length;
  const score = picked.reduce<number>((n, p, i) => n + (p === QUIZ[i].ans ? 1 : 0), 0);
  const done = answered === QUIZ.length;

  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <div className="flex gap-1.5" aria-hidden>
          {QUIZ.map((_, i) => (
            <i
              key={i}
              className={cn(
                "block size-2 rounded-full",
                picked[i] !== null ? "bg-accent" : "bg-line-strong",
              )}
            />
          ))}
        </div>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-accent transition-[width] duration-250"
            style={{ width: `${(answered / QUIZ.length) * 100}%` }}
          />
        </div>
        <div className="font-mono text-sm tabular-nums text-muted">
          {score} / {QUIZ.length}
        </div>
      </div>

      <div className="space-y-4">
        {QUIZ.map((item, qi) => (
          <article key={item.q} className="rounded-xl border border-line bg-surface p-5">
            <h3 className="font-display text-lg font-medium">
              {qi + 1}. {item.q}
            </h3>
            <div className="mt-3 grid gap-2">
              {item.opts.map((op, oi) => {
                const chosen = picked[qi];
                const locked = chosen !== null;
                const isAns = oi === item.ans;
                const isNo = locked && chosen === oi && !isAns;
                return (
                  <button
                    key={op}
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      setPicked((prev) => {
                        const next = [...prev];
                        next[qi] = oi;
                        return next;
                      })
                    }
                    className={cn(
                      "min-h-11 rounded-md border px-3 py-2.5 text-left text-sm",
                      !locked && "border-line hover:border-line-strong hover:bg-surface-2",
                      locked && isAns && "border-gain/50 bg-gain/12 text-gain",
                      isNo && "border-loss/50 bg-loss/12 text-loss",
                      locked && !isAns && !isNo && "border-line text-dim",
                    )}
                  >
                    {"ABC"[oi]}. {op}
                  </button>
                );
              })}
            </div>
            {picked[qi] !== null && (
              <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-muted">{item.exp}</p>
            )}
          </article>
        ))}
      </div>

      {done && (
        <div className="mt-5 rounded-xl border border-line bg-surface p-6 text-center" role="status">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full border border-gain/40 bg-gain/10 text-gain">
            <Check className="size-5" />
          </div>
          <h3 className="font-display text-xl font-medium">
            {score === 3 ? "满分。这页书你拿下了" : score === 2 ? "差一题，回看一下解析" : "建议重读第 01、02 节再来"}
          </h3>
          <p className="mt-2 text-sm text-muted">
            得分 {score} / 3 · {score === 3 ? "从资金流到福利账，整条链路都通了。" : "正确答案已经标出，解析就是第二次讲解。"}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setPicked([null, null, null])}
          >
            重新作答
          </Button>
        </div>
      )}
    </div>
  );
}
