export const SECTIONS = [
  { id: "story", label: "故事", no: "01" },
  { id: "chart", label: "画图", no: "02" },
  { id: "welfare", label: "选择", no: "03" },
  { id: "quiz", label: "测验", no: "04" },
  { id: "final", label: "结论", no: "05" },
] as const;

export const FLOW_CAPTIONS = {
  accept:
    "资金流循环：NL 纳税人 → NL 政府 → NL 纺织厂 →（低价出口）→ IS 消费者 →（付款回流）。第一笔钱来自 Neighborland 的纳税人。",
  tariff:
    "Isoland 筑起关税墙：出口包裹在边境被拦截，补贴流被切断；消费者把关税交给本国政府。价格回到 P₁，谁也没占到便宜。",
} as const;

export const QUIZ = [
  {
    q: "NL 政府补贴纺织厂的钱，最终来自谁？",
    opts: ["Isoland 的纺织厂", "Neighborland 的纳税人", "Isoland 的消费者"],
    ans: 1,
    exp: "补贴是政府支出，政府的钱来自本国（NL）税收——NL 纳税人在为 IS 消费者的低价布买单。",
  },
  {
    q: "t = 20 时，Isoland 的净福利变化是多少？",
    opts: ["−400", "0", "+800"],
    ans: 2,
    exp: "消费者剩余 +1,400，生产者剩余 −600，合计 +800（= 20t + t²）。",
  },
  {
    q: "面对 NL 的出口补贴，福利分析给 IS 的最优建议是？",
    opts: ["禁止进口", "说声谢谢，继续买", "立即征收报复关税"],
    ans: 1,
    exp: "接受净 +800，关税净 0，禁止净 −100。「谢谢」是最贵也最不客气的客气。",
  },
] as const;

export const SCRIPT = `【不公平竞争论 · 讲解逐字稿】
NL 政府对纺织品出口补贴，钱来自 NL 纳税人。补贴让 NL 工厂敢把价格压到 P₂ = 60 − t，低价涌入 IS。
对 IS 的账：消费者剩余 +t(120+t)/2（t=20 时 +1,400），生产者剩余 −t(80−t)/2（−600），净福利 = 20t + t² = +800，恒为正。
三种回应：接受补贴净 +800；报复关税把价格抬回 P₁，政府收 400、无谓损失 400，净效应为 0；禁止进口回到自给自足，工厂 +450、消费者 −550，净 −100。
结论：当邻居执意补贴你买东西时，最好的回应是说声谢谢。`;

export const KEYBOARD = [
  { keys: ["P"], label: "演示模式" },
  { keys: ["`"], label: "工程解剖" },
  { keys: ["?"], label: "快捷键" },
  { keys: ["Space"], label: "暂停资金流" },
  { keys: ["R"], label: "重播资金流" },
  { keys: ["1–5"], label: "跳转章节" },
  { keys: ["←", "→"], label: "演示翻页" },
  { keys: ["Esc"], label: "退出演示" },
] as const;
