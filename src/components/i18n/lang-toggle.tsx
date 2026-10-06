import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n";

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-xs text-muted hover:text-fg"
      aria-label="switch language"
    >
      <Languages className="size-3.5" />
      {t("lang.toggle")}
    </button>
  );
}
