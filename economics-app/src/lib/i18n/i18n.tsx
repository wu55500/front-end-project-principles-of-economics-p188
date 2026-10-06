/**
 * Minimal i18n without a runtime dependency. A tiny dictionary + React context;
 * language persists in localStorage and <html lang> stays in sync. The whole
 * app is Chinese-authored, so English covers navigation/chrome/key concepts
 * while dense teaching prose can remain Chinese — translations are incremental.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "zh" | "en";

const dict = {
  zh: {
    "app.title": "不公平竞争论 · 互动图解",
    "nav.start": "开始图解",
    "nav.present": "演示模式",
    "lang.toggle": "EN",
    "concept.subsidy": "出口补贴",
    "concept.tariff": "报复关税",
    "concept.ban": "禁止进口",
    "concept.cs": "消费者剩余",
    "concept.ps": "生产者剩余",
    "multi.title": "同桌共学（P2P）",
    "tutor.title": "AI 辅导老师",
  },
  en: {
    "app.title": "The Unfair-Competition Argument · Interactive",
    "nav.start": "Start",
    "nav.present": "Present mode",
    "lang.toggle": "中文",
    "concept.subsidy": "Export subsidy",
    "concept.tariff": "Retaliatory tariff",
    "concept.ban": "Import ban",
    "concept.cs": "Consumer surplus",
    "concept.ps": "Producer surplus",
    "multi.title": "Study together (P2P)",
    "tutor.title": "AI Tutor",
  },
} as const;

export type TKey = keyof (typeof dict)["zh"];

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

function getInitial(): Lang {
  if (typeof window === "undefined") return "zh";
  const saved = localStorage.getItem("p188.lang");
  return saved === "en" ? "en" : "zh";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    setLangState(getInitial());
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    localStorage.setItem("p18n.lang", lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const t = useCallback((key: TKey) => dict[lang][key] ?? dict.zh[key], [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
