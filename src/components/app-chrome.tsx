import { useEffect, useState } from "react";
import { ArrowUp, HelpCircle, Presentation, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KEYBOARD, SCRIPT, SECTIONS } from "@/lib/econ/content";
import { useViz } from "@/store/viz";
import { cn } from "@/lib/utils";
import { LangToggle } from "@/components/i18n/lang-toggle";

const SLIDES = ["top", ...SECTIONS.map((s) => s.id)];

export function AppChrome() {
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [act, setAct] = useState("story");
  const [showTop, setShowTop] = useState(false);
  const present = useViz((s) => s.present);
  const presentIdx = useViz((s) => s.presentIdx);
  const labOpen = useViz((s) => s.labOpen);
  const kbdOpen = useViz((s) => s.kbdOpen);

  useEffect(() => {
    useViz.getState().hydrateFromHash();
    const onHash = () => useViz.getState().hydrateFromHash();
    addEventListener("hashchange", onHash);

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      setProgress(max > 0 ? Math.min(1, scrollY / max) : 0);
      setScrolled(scrollY > 24);
      setShowTop(scrollY > 600);
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const spy = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) setAct(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) spy.observe(el);
    });

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const st = useViz.getState();
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        st.toggleKbd();
      } else if (e.key === "`" || e.key === "~") {
        e.preventDefault();
        st.toggleLab();
      } else if (e.key === "p" || e.key === "P") {
        if (st.kbdOpen) return;
        e.preventDefault();
        st.togglePresent();
      } else if (e.key === " ") {
        e.preventDefault();
        st.toggleFlowPause();
      } else if (e.key === "r" || e.key === "R") {
        st.replayFlow();
      } else if (e.key >= "1" && e.key <= "5") {
        document.getElementById(SECTIONS[Number(e.key) - 1].id)?.scrollIntoView({ behavior: "smooth" });
      } else if (e.key === "Escape") {
        st.togglePresent(false);
        st.toggleKbd(false);
        st.toggleLab(false);
      } else if (st.present && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const next = st.presentIdx + (e.key === "ArrowRight" ? 1 : -1);
        const idx = Math.max(0, Math.min(SLIDES.length - 1, next));
        st.setPresentIdx(idx);
        document.getElementById(SLIDES[idx])?.scrollIntoView({ behavior: "smooth" });
      }
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("hashchange", onHash);
      removeEventListener("scroll", onScroll);
      removeEventListener("keydown", onKey);
      spy.disconnect();
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("present", present);
    if (present) {
      document.getElementById(SLIDES[presentIdx])?.scrollIntoView({ behavior: "smooth" });
    }
  }, [present, presentIdx]);

  return (
    <>
      <a className="skip-link" href="#story">
        跳到主要内容
      </a>
      <div className="pbar" style={{ transform: `scaleX(${progress})` }} aria-hidden />
      <nav
        aria-label="章节导航"
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color] duration-200",
          scrolled ? "border-line bg-bg/92 backdrop-blur-md" : "border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4 sm:h-16 sm:px-6">
          <a href="#top" className="mr-3 flex items-center gap-2 text-sm font-medium">
            <span className="grid size-6 place-items-center rounded-[6px] border border-line-strong text-[11px] text-muted">
              IS
            </span>
            <span className="hidden sm:inline">不公平竞争论</span>
          </a>
          <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={cn(
                  "rounded-md px-3 py-2 text-sm",
                  act === s.id ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {s.no} {s.label}
              </a>
            ))}
          </div>
          <span className="flex-1 md:hidden" />
          <LangToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => useViz.getState().togglePresent()}
            className="hidden sm:inline-flex"
          >
            <Presentation />
            演示
          </Button>
        </div>
      </nav>

      {showTop && (
        <button
          type="button"
          aria-label="回到顶部"
          onClick={() => scrollTo({ top: 0, behavior: "smooth" })}
          className="fab fixed right-4 bottom-24 z-30 grid size-11 place-items-center rounded-md border border-line bg-surface text-fg sm:right-6"
        >
          <ArrowUp className="size-4" />
        </button>
      )}

      <button
        type="button"
        onClick={() => useViz.getState().toggleLab()}
        className="fab fixed right-4 bottom-6 z-30 inline-flex h-11 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-fg sm:right-6"
      >
        <Settings2 className="size-4" />
        工程解剖
      </button>

      {labOpen && <LabPanel />}
      {kbdOpen && (
        <div
          className="kbd-help fixed inset-0 z-50 grid place-items-center bg-bg/70 p-4"
          onClick={() => useViz.getState().toggleKbd(false)}
          role="dialog"
          aria-label="快捷键帮助"
        >
          <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2 font-display text-lg">
              <HelpCircle className="size-4" /> 快捷键
            </div>
            <ul className="space-y-2">
              {KEYBOARD.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{row.label}</span>
                  <span className="flex gap-1">
                    {row.keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {present && (
        <div className="pres-hud fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-md border border-line bg-surface/95 px-4 py-2 text-xs text-muted">
          演示模式 · {presentIdx + 1} / {SLIDES.length} · ← → 翻页 · Esc 退出
        </div>
      )}
    </>
  );
}

function LabPanel() {
  const t = useViz((s) => s.t);
  const mode = useViz((s) => s.mode);
  const view = useViz((s) => s.view);
  const hash = typeof window !== "undefined" ? location.hash || "（默认）" : "";
  return (
    <aside
      role="dialog"
      aria-label="工程解剖面板"
      className="dev-panel fixed top-16 right-0 z-40 h-[calc(100dvh-4rem)] w-[min(100%,360px)] overflow-y-auto border-l border-line bg-surface p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-medium">工程解剖</h3>
        <button type="button" className="text-sm text-muted" onClick={() => useViz.getState().toggleLab(false)}>
          关闭
        </button>
      </div>
      <p className="mb-4 text-xs text-dim">本页实时展示自己的体检报告 · 按 ` 开关</p>
      <H>运行时状态（URL 可分享）</H>
      <Row k="store.t / mode / view" v={`t=${t} · ${mode} · ${view}`} />
      <Row k="状态镜像" v={hash} />
      <H>架构</H>
      <p className="mb-3 text-sm leading-relaxed text-muted">
        纯函数模型 <code className="font-mono text-xs">calc(t)</code> 是单一数据源，经 Zustand 发布给资金流、供需图、福利账、测验。状态写入 URL hash，刷新可还原。
      </p>
      <ul className="space-y-1.5 text-sm text-muted">
        <li>model.ts 纯函数，11 组单测锁定课本口径</li>
        <li>滚动叙事：scroll progress → 四相位绘制</li>
        <li>Canvas 标签防冲突：measureText + AABB</li>
        <li>离屏暂停粒子与金币回路</li>
        <li>DPR 封顶 2，ResizeObserver 重排</li>
        <li>prefers-reduced-motion / skip link</li>
      </ul>
      <H>设计令牌</H>
      <div className="flex flex-wrap gap-2">
        {[
          ["#8eb4c8", "is"],
          ["#6fbfa3", "gain"],
          ["#c4b48a", "nl"],
          ["#d17a7a", "loss"],
          ["#0b0c10", "bg"],
        ].map(([hex, name]) => (
          <span key={name} className="inline-flex items-center gap-1.5 text-xs text-muted">
            <i className="size-3 rounded-full border border-line" style={{ background: hex }} />
            {name}
          </span>
        ))}
      </div>
    </aside>
  );
}

function H({ children }: { children: string }) {
  return <div className="mt-5 mb-2 text-[11px] tracking-[0.14em] text-dim uppercase">{children}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 text-sm">
      <span className="text-dim">{k}</span>
      <b className="max-w-[55%] text-right font-mono text-xs font-medium break-all">{v}</b>
    </div>
  );
}

export function CopyScript() {
  return (
    <Button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(SCRIPT);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = SCRIPT;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        toast("逐字稿已复制");
      }}
    >
      复制讲解逐字稿
    </Button>
  );
}
