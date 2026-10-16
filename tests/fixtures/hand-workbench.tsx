import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CardHand } from "../../app/game";
import { ALL_CARD_DEFS } from "../../lib/game-data";
import { createGame } from "../../lib/game-engine";
import { auditHandText } from "./hand-geometry";
import "../../app/globals.css";
import "../../mobile/mobile.css";

if (new URLSearchParams(location.search).has("android")) document.documentElement.classList.add("capacitor-app");
const cardIds = Object.keys(ALL_CARD_DEFS);
function Fixture() {
  const base = useMemo(() => createGame("tovak", "standard", "classic", "wedge", 42, "ultimate"), []);
  const [scenario, setScenario] = useState("screenshot");
  const [batch, setBatch] = useState(0);
  const [selected, setSelected] = useState("determination#ui");
  const [report, setReport] = useState<ReturnType<typeof auditHandText> | null>(null);
  const ids = scenario === "screenshot" ? ["determination", "threaten", "tranquility", "wound", "wound"]
    : scenario === "many" ? cardIds.slice(0, 15) : cardIds.slice(batch * 5, batch * 5 + 5);
  const hand = ids.map((id, i) => `${id}#ui-${i}`);
  const state = { ...base, hand, played: [], phase: "planning" as const };
  return <main className="game-shell">
    <header className="topbar"><label>手牌场景 <select aria-label="手牌测试场景" value={scenario} onChange={(e) => setScenario(e.target.value)}>
      <option value="screenshot">截图复现：决意/威吓/宁静/伤势</option><option value="all">全卡牌逐批检查</option><option value="many">15张拥挤手牌</option>
    </select></label></header>
    <section className="mission-strip"><label>卡牌批次 <select aria-label="卡牌测试批次" value={batch} onChange={(e) => setBatch(Number(e.target.value))}>{Array.from({ length: Math.ceil(cardIds.length / 5) }, (_, i) => <option key={i} value={i}>{i * 5 + 1}–{Math.min(cardIds.length, i * 5 + 5)}</option>)}</select></label></section>
    <section className="game-layout"><div><p>仅验证真实手牌组件布局；不读取或修改玩家存档。可悬浮或Tab聚焦卡牌查看完整文字。</p>
      <button onClick={() => setReport(auditHandText())}>检查文字裁切</button>
      <output aria-label="手牌文字检查结果">{report ? JSON.stringify(report) : "尚未检查"}</output>
    </div></section>
    <div className="persistent-hand-panel"><CardHand state={state} selectedCardId={selected} onSelectCard={setSelected} onOpenWiki={() => {}} /></div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
