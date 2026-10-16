import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MapBoard, TacticalContextSummary, UtilityDrawer } from "../../app/game";
import { ALL_ENEMY_TOKENS, EMPTY_RESOURCES } from "../../lib/game-data";
import { createGame, gameReducer, type GameAction, type GameState } from "../../lib/game-engine";
import "../../app/globals.css";
import "../../mobile/mobile.css";

if(new URLSearchParams(location.search).has("android")) document.documentElement.classList.add("capacitor-app");
function initialState():GameState {
  const base=createGame("tovak","standard","classic","wedge",42,"ultimate");
  const enemy={...ALL_ENEMY_TOKENS[0],id:"site-ui-orc",name:"地点测试兽人"};
  const blank={revealed:true,conquered:false,tokenRevealed:true,terrain:"plains" as const};
  return {...base,position:"0,0",phase:"planning",actionTaken:false,hand:["wound#site-ui"],
    turnBonus:{...EMPTY_RESOURCES,move:20,influence:20},map:[
      {...blank,id:"0,0",q:0,r:0,site:"village"},
      {...blank,id:"1,0",q:1,r:0,site:"mine",mineColor:"blue"},
      {...blank,id:"0,1",q:0,r:1,site:"monastery"},
      {...blank,id:"1,-1",q:1,r:-1,site:"rampager",enemy,enemies:[enemy]},
      {...blank,id:"3,0",q:3,r:0,site:"deepMine",mineColor:"red",mineColors:["red","green"]},
    ]};
}
function Fixture(){
  const [state,setState]=useState(initialState);
  const [inspected,setInspected]=useState("0,0");
  const [target,setTarget]=useState<string>();
  const [open,setOpen]=useState(false);
  const dispatch=(action:GameAction)=>setState((s)=>gameReducer(s,action));
  return <main className="game-shell">
    <header className="topbar"><span>地点目标回归 · 不保存进度</span></header>
    <section className="mission-strip">英雄在村庄；可查看水晶矿、修道院、兽人及远处深矿。</section>
    <div className="game-layout"><section className="center-stage">
      <div className="tactical-board"><MapBoard state={state} dispatch={dispatch} mapFocus={false} onToggleMapFocus={()=>{}} onInspectCell={setInspected} onOpenWiki={()=>{}} /></div>
      <aside className="tactical-context"><TacticalContextSummary state={state} inspectedCellId={inspected} onOpenSite={(id)=>{setTarget(id);setOpen(true);}} /></aside>
    </section><UtilityDrawer state={state} dispatch={dispatch} panel={open?"site":null} siteCellId={target} onClose={()=>setOpen(false)} /></div>
    <footer className="persistent-hand-panel"><output aria-label="英雄位置">{state.position}</output><output aria-label="伤势数量">{state.hand.filter((id)=>id.startsWith("wound")).length}</output></footer>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
