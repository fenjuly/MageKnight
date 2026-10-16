import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CardHand, CombatPanel, MapBoard, ResourceBar, SelectedCardPanel } from "../../app/game";
import { gameReducer, type GameState } from "../../lib/game-engine";
import { combatUiScenario as scenario } from "./combat-states";
import "../../app/globals.css";
import "../../mobile/mobile.css";

function Fixture() {
  const [state, setState] = useState(() => scenario("ranged"));
  const [card, setCard] = useState("stamina#ui");
  const dispatch = (action: Parameters<typeof gameReducer>[1]) => setState((s) => gameReducer(s, action));
  return <main className="game-shell">
    <header className="topbar"><label>回归场景 <select aria-label="战斗测试场景" onChange={(e) => {
      const [step, multi] = e.target.value.split(":");
      setState(scenario(step as NonNullable<GameState["combat"]>["step"], multi === "multi"));
    }}><option value="ranged">远程</option><option value="block">格挡（笨重）</option><option value="damage">盟军承伤</option><option value="attack">近战</option><option value="ranged:multi">多敌远程与防卫</option><option value="attack:multi">多敌近战与防卫</option></select></label></header>
    <section className="mission-strip">Android 战斗布局测试 · 使用真实游戏组件 · 不保存进度</section>
    <div className="game-layout"><section className={`center-stage ${state.combat ? "in-combat" : ""}`}>
      <div className="tactical-board"><MapBoard state={state} dispatch={dispatch} mapFocus={false} onToggleMapFocus={() => {}} onInspectCell={() => {}} onOpenWiki={() => {}} /></div>
      <aside className="tactical-context" aria-label="战术情报与卡牌操作">
        <CombatPanel state={state} dispatch={dispatch} />
        <SelectedCardPanel state={state} dispatch={dispatch} instanceId={card} />
        <div className="persistent-resource-panel"><ResourceBar state={state} dispatch={dispatch} /></div>
        <section className="turn-panel"><div className="turn-status">本回合行动已完成</div><button className="revert-button">撤回</button><button className="end-turn" disabled>结束回合</button></section>
      </aside>
    </section><nav className="utility-command-rail">工具</nav></div>
    <div className="persistent-hand-panel"><CardHand state={state} selectedCardId={card} onSelectCard={setCard} onOpenWiki={() => {}} /></div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
