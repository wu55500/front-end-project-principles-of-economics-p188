/**
 * Socratic tutor chat panel. Asks the server fn (real LLM when configured,
 * rule-based fallback otherwise) and threads the conversation. Suggested
 * questions make it usable for students who don't know what to ask.
 */
import { useState, useRef, useEffect } from "react";
import { GraduationCap, Send, Sparkles } from "lucide-react";
import { askTutor, type TutorMsg } from "@/lib/tutor/tutor.server";
import { useViz } from "@/store/viz";

const SUGGEST = ["为什么报复关税不划算？", "禁止进口谁赚谁亏？", "什么是消费者剩余？", "为什么要说谢谢？"];

export function TutorPanel() {
  const [messages, setMessages] = useState<TutorMsg[]>([
    {
      role: "assistant",
      content: "你好，我是这一课的辅导老师。与其直接给答案，我更想先问你：你觉得 Neighborland 的补贴，对 Isoland 是好事还是坏事？为什么？",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const t = useViz((s) => s.t);
  const mode = useViz((s) => s.mode);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const { reply, usedFallback } = await askTutor({
        data: { question: q, history, context: { t, mode } },
      });
      setFallback(usedFallback);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "抱歉，我暂时无法回答，请稍后再试。" },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[520px] flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-4 text-muted" />
          <h3 className="font-display text-lg">AI 辅导老师</h3>
        </div>
        {fallback && (
          <span className="flex items-center gap-1 text-[11px] text-dim">
            <Sparkles className="size-3" />
            内置导师模式
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
              (m.role === "user"
                ? "ml-auto bg-accent text-accent-fg"
                : "border border-line bg-surface-2 text-fg")
            }
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="flex gap-1 px-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-2 animate-bounce rounded-full bg-muted"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line px-5 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGEST.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="向老师提问…"
            className="h-11 flex-1 rounded-[10px] border border-line-strong bg-transparent px-3 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex size-11 items-center justify-center rounded-[10px] bg-accent text-accent-fg disabled:opacity-40"
            aria-label="发送"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
