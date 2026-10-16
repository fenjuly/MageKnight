import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThreeMap } from "../../app/three-map";
import { ALL_ENEMY_TOKENS } from "../../lib/game-data";
import { createGame } from "../../lib/game-engine";
import { publicCellMapLabel } from "../../lib/map-intel";
import type { Board3DHandle } from "../../lib/three-board";
import "../../app/globals.css";

function Fixture() {
  const controls = useRef<Board3DHandle | null>(null);
  const [cleared, setCleared] = useState(false);
  const base = useMemo(() => createGame("tovak", "standard", "classic", "wedge", 72035, "ultimate"), []);
  const enemy = useMemo(() => ({ ...ALL_ENEMY_TOKENS[0], id: "three-label-orc", name: "标签测试兽人" }), []);
  const targetId = base.map.find((cell) => cell.id !== base.position)!.id;
  const state = {
    ...base,
    map: base.map.map((cell) => cell.id === targetId ? {
      ...cell, terrain: "swamp" as const, site: "rampager" as const, tokenRevealed: true,
      conquered: cleared, enemy: cleared ? undefined : enemy, enemies: cleared ? [] : [enemy],
    } : cell),
  };
  const target = state.map.find((cell) => cell.id === targetId)!;
  return <main style={{ position: "fixed", inset: 0, background: "#071715" }}>
    <div style={{ position: "absolute", zIndex: 20, top: 8, left: 8, display: "flex", gap: 8, alignItems: "center", padding: 8, background: "#102724e8", color: "#ecdfbd" }}>
      <button type="button" aria-pressed={!cleared} onClick={() => setCleared(false)}>兽人存活</button>
      <button type="button" aria-pressed={cleared} onClick={() => setCleared(true)}>兽人已消灭</button>
      <output aria-label="目标地块公开标签">{publicCellMapLabel(target, state.time, state.difficulty)}</output>
    </div>
    <div style={{ width: "100%", height: "100%" }}><ThreeMap state={state} selection={null} controlsRef={controls} onSelect={() => {}} onInspect={() => {}} onOpenWiki={() => {}} onZoom={() => {}} onFailure={(message) => { throw new Error(message); }} /></div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
