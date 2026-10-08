import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AppChrome, CopyScript } from "@/components/app-chrome";
import { FlowSim } from "@/components/flow-sim";
import { HeroField } from "@/components/hero-field";
import { QuizSection } from "@/components/quiz-section";
import { RoomPanel } from "@/components/multiplayer/room-panel";
import { TradeScene } from "@/components/scene3d/trade-scene";
import { WorldTradeMap } from "@/components/worldmap/world-trade-map";
import { RealDataPanel } from "@/components/realdata/real-data-panel";
import { CausalPanel } from "@/components/causal/causal-panel";
import { TutorPanel } from "@/components/tutor/tutor-panel";
import { SdChart } from "@/components/sd-chart";
import { WelfareBoard } from "@/components/welfare-board";
import { Button } from "@/components/ui/button";
import { useViz } from "@/store/viz";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="relative min-h-dvh bg-bg text-fg">
      <div className="grain" aria-hidden />
      <AppChrome />
      <Hero />
      <main>
        <Story />
        <ChartSec />
        <SceneSec />
        <MapSec />
        <DataSec />
        <CausalSec />
        <WelfareSec />
        <TutorSec />
        <MultiSec />
        <QuizSec />
        <Finale />
      </main>
      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-sm text-dim sm:flex-row sm:items-center sm:px-6">
          <span>不公平竞争论 · Isoland × Neighborland</span>
          <span className="hidden sm:inline">·</span>
          <span>曼昆《经济学原理》第 9 章 · 按 ? 查看快捷键</span>
        </div>
      </footer>
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#13151c",
            border: "1px solid rgba(236,234,228,.12)",
            color: "#eceae4",
          },
        }}
      />
    </div>
  );
}

function Hero() {
  return (
    <header id="top" className="relative flex min-h-[100dvh] items-end overflow-hidden pb-16 pt-24 sm:items-center sm:pb-0">
      <HeroField />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">
          曼昆《经济学原理》第 9 章 · 国际贸易 · 对应课本 P177 图
        </p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-medium leading-[1.08] tracking-[-0.04em] sm:text-5xl md:text-[3.4rem]">
          不公平竞争论
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Neighborland 政府对纺织品出口补贴，Isoland 的工厂叫苦连天。报复关税？禁止进口？还是说声谢谢？用一页图解把福利账算清楚。
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {["滚动叙事", "全局状态联动", "URL 可分享", "模型单测覆盖"].map((c) => (
            <span key={c} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
              {c}
            </span>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <a href="#story">开始图解</a>
          </Button>
          <Button variant="outline" onClick={() => useViz.getState().togglePresent(true)}>
            演示模式
            <kbd>P</kbd>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Wrap({
  id,
  no,
  title,
  sub,
  children,
}: {
  id: string;
  no: string;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-2xl font-medium sm:text-3xl">
          <span className="mr-3 font-sans text-sm tracking-[0.16em] text-dim">{no}</span>
          {title}
        </h2>
        <p className="mt-3 mb-8 max-w-2xl text-muted">{sub}</p>
        {children}
      </div>
    </section>
  );
}

function Story() {
  return (
    <Wrap
      id="story"
      no="01"
      title="一个故事：补贴是怎么流到你手里的"
      sub="Neighborland（NL）政府宣布：纺织品每出口一件，补贴 t 元。钱从哪来，又到哪去？切换「报复关税」看 Isoland 反击后的资金流。"
    >
      <FlowSim />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg text-nl">Neighborland · 出口国</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <li>
              <b className="text-fg">纳税人</b>：补贴的钱，从他们的税收里出
            </li>
            <li>
              <b className="text-fg">政府</b>：每件出口纺织品补贴 t 元
            </li>
            <li>
              <b className="text-fg">纺织厂</b>：拿到补贴，敢把价格压到 P₂ = 60 − t
            </li>
          </ul>
        </article>
        <article className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg text-is">Isoland · 进口国</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <li>
              <b className="text-fg">消费者</b>：同样的布，更便宜——消费者剩余增加
            </li>
            <li>
              <b className="text-fg">纺织厂</b>：价格被压低，份额被挤——生产者剩余减少
            </li>
            <li>
              <b className="text-fg">政府</b>：面对「不公平竞争」的指责，要表态
            </li>
          </ul>
        </article>
      </div>
    </Wrap>
  );
}

function ChartSec() {
  return (
    <Wrap
      id="chart"
      no="02"
      title="画图讲：补贴的福利分析"
      sub="往下滚动，看图被一笔一笔画出来；随时拖滑杆接管，所有图表和数字全局联动。"
    >
      <SdChart />
    </Wrap>
  );
}

function SceneSec() {
  return (
    <Wrap id="scene3d" no="03" title="立体看：补贴怎样填满航道" sub="3D 场景按需加载，拖动页面里的补贴滑杆，观察货船数量与航速的变化。">
      <TradeScene />
    </Wrap>
  );
}

function MapSec() {
  return (
    <Wrap id="worldmap" no="04" title="放眼全球：立体地球看转口贸易" sub="三维地球按需加载：中国 → 墨西哥中转换单 → 美国；切换贸易战可看关税壁垒动态阻断货流。">
      <WorldTradeMap />
    </Wrap>
  );
}

function DataSec() {
  return (
    <Wrap id="realdata" no="05" title="对接现实：课本之外的真实贸易数据" sub="把世界银行的长期指标接进来，检验模型与现实的关系。">
      <RealDataPanel />
    </Wrap>
  );
}

function CausalSec() {
  return (
    <Wrap id="causal" no="06" title="追问因果：是补贴导致了变化吗" sub="用双重差分和 Granger 检验把相关与因果分开，理解每种方法的前提。">
      <CausalPanel />
    </Wrap>
  );
}

function WelfareSec() {
  return (
    <Wrap
      id="welfare"
      no="07"
      title="三种选择：摆在 IS 政府面前的路"
      sub="同样的补贴强度，三种回应，三笔完全不同的账。"
    >
      <WelfareBoard />
    </Wrap>
  );
}

function MultiSec() {
  return (
    <Wrap id="multi" no="05" title="一起学：开个房间，同桌同屏" sub="和同学建立点对点连接，一个人操作，两个人的图表同步；适合课堂配对讨论。">
      <RoomPanel />
    </Wrap>
  );
}

function TutorSec() {
  return (
    <Wrap id="tutor" no="09" title="不懂就问：AI 辅导老师陪你练" sub="苏格拉底式提问引导，配置大模型 Key 后接真实模型，无 Key 时用内置导师。">
      <TutorPanel />
    </Wrap>
  );
}

function QuizSec() {
  return (
    <Wrap id="quiz" no="04" title="测一测：这页书你拿下了吗" sub="三道题，答完出结算。答错别怕，解析就是第二次讲解。">
      <QuizSection />
    </Wrap>
  );
}

function Finale() {
  return (
    <Wrap
      id="final"
      no="12"
      title="结论：谢谢你的「不公平竞争」"
      sub="当邻居执意要补贴你买东西时，最好的回应不是报复，而是说声谢谢。"
    >
      <blockquote className="rounded-xl border border-line bg-surface p-6 font-display text-xl leading-snug sm:p-8 sm:text-2xl">
        当邻居执意要补贴你买东西时，最好的回应不是报复，而是说声谢谢。所谓「不公平竞争」，账算到最后，是对方纳税人在为你的消费者买单。
        <footer className="mt-4 font-sans text-sm text-dim">—— 曼昆《经济学原理》第 9 章 · 出口补贴的福利分析</footer>
      </blockquote>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg">账要算总账</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            消费者 +1,400、生产者 −600，净福利 +800。分配会痛，但总量在涨。
          </p>
        </article>
        <article className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg">报复最贵</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            报复关税把价格抬回去：政府收的 400，恰好等于无谓损失 400，净效应归零。
          </p>
        </article>
        <article className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg">禁止最亏</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            禁止进口回到自给自足：工厂赚的 450，抵不上消费者亏的 550，净 −100。
          </p>
        </article>
      </div>
      <p className="mt-5 text-sm text-dim">
        注：本页按课本局部均衡模型展开，暂不考虑报复升级、产业动态与政治经济学约束——那是第 10 章之后的故事。
      </p>
      <div className="mt-8 text-center">
        <CopyScript />
      </div>
    </Wrap>
  );
}
