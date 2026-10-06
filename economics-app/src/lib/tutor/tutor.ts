/**
 * Socratic tutor backend. When an LLM API key is configured it streams a
 * real model answer; otherwise it falls back to a deterministic rule-based
 * tutor so the classroom demo always works and never shows a blank error.
 *
 * The tutor is grounded in a small, fixed knowledge base (RAG-lite): answers
 * quote the relevant concept instead of free-associating.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface TutorMsg {
  role: "user" | "assistant";
  content: string;
}

// Tiny knowledge base keyed by topic keywords (stands in for a vector store).
const KB: { keys: string[]; a: string }[] = [
  {
    keys: ["关税", "报复", "tariff"],
    a: "报复关税把国内价格抬回去。政府确实收到关税收入，但它恰好等于消费者被拿走的剩余外加一块无谓损失——总账上并不创造福利，只会把补贴的好处抵消掉。关键是区分『分配』和『总量』：关税保护了生产者，却让消费者付出更多。",
  },
  {
    keys: ["禁止", "禁令", "ban", "自给自足"],
    a: "禁止进口使经济回到自给自足。本国生产者卖得更贵、卖得更多，但消费者失去的剩余比生产者增加的还多，产生净无谓损失。课本数字里是生产者 +450、消费者 −550，净 −100。",
  },
  {
    keys: ["消费者剩余", "剩余", "welfare", "福利"],
    a: "消费者剩余是需求曲线以下、价格线以上的三角形面积。价格从 P₁ 降到 P₂ 后，它变大；生产者剩余是供给曲线以上、价格线以下的部分，价格下降时变小。把两块加起来才是总福利。",
  },
  {
    keys: ["谢谢", "不公平", "补贴", "subsidy"],
    a: "出口补贴是出口国纳税人在出钱，进口国消费者因此买到更便宜的商品。只要进口国不报复、总量在涨，最理性的回应其实是『说声谢谢』。当然现实中还要考虑产业调整的阵痛和政治约束——这是模型之外的因素。",
  },
  {
    keys: ["弹性", "elasticity"],
    a: "弹性衡量数量对价格的反应程度。供给或需求越有弹性，同样的补贴或关税造成的数量扭曲越大，无谓损失三角形也越大。",
  },
];

function retrieve(q: string): string {
  let best: string | null = null;
  let bestScore = 0;
  for (const item of KB) {
    const score = item.keys.reduce((s, k) => (q.toLowerCase().includes(k.toLowerCase()) ? s + 1 : s), 0);
    if (score > bestScore) {
      bestScore = score;
      best = item.a;
    }
  }
  return best ?? "";
}

function ruleBasedTutor(question: string, ctx: { t: number; mode: string }): string {
  const hit = retrieve(question);
  const contextLine = `（当前补贴 t=${ctx.t}，政策选择=${ctx.mode}）`;
  if (hit) {
    return `我用一个问题引导你想：${hit}\n\n${contextLine} 你能说说在这个设定下，谁受益、谁受损吗？`;
  }
  return `好问题。我们一步步拆：先确定价格怎么变（P₁→P₂），再分别看消费者剩余和生产者剩余怎么动，最后加总看净福利。${contextLine} 你想先从哪一块开始？`;
}

const HistorySchema = z.array(
  z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }),
).max(20);

export const askTutor = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      question: z.string().min(1).max(2000),
      history: HistorySchema.default([]),
      context: z.object({ t: z.number(), mode: z.string() }).default({ t: 20, mode: "accept" }),
    }),
  )
  .handler(async ({ data }): Promise<{ reply: string; usedFallback: boolean }> => {
    const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

    // No key (or placeholder): deterministic Socratic fallback so it always works.
    if (!apiKey || apiKey.length < 8) {
      return { reply: ruleBasedTutor(data.question, data.context), usedFallback: true };
    }

    try {
      // OpenAI-compatible chat completion. Endpoint/model configurable.
      const base = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
      const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
      const grounding = retrieve(data.question);
      const sys =
        "你是一位苏格拉底式的经济学原理课辅导老师，用中文，简短，多用提问引导，" +
        "基于以下可靠知识点作答，不要编造：" + (grounding || "围绕供给需求与剩余分析。");

      const messages = [
        { role: "system", content: sys },
        ...data.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: data.question },
      ];
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.4 }),
      });
      if (!res.ok) throw new Error(`llm ${res.status}`);
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = json.choices?.[0]?.message?.content;
      if (!reply) throw new Error("empty reply");
      return { reply, usedFallback: false };
    } catch (err) {
      console.warn("[tutor] LLM failed, using fallback", err);
      return { reply: ruleBasedTutor(data.question, data.context), usedFallback: true };
    }
  });
