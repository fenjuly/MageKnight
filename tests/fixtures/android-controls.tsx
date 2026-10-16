import React, { useEffect, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CardHand, CombatPanel, ResourceBar, SelectedCardPanel, TacticalContextSummary, TurnPanel } from "../../app/game";
import { applyGameActionWithRevert, availableResources, createRevertHistory, revertLastAction, type GameAction } from "../../lib/game-engine";
import { androidControlScenario } from "./android-control-states";
import "../../app/globals.css";
import "../../mobile/mobile.css";

const params=new URLSearchParams(location.search);
document.documentElement.classList.add("capacitor-app");
// Emulates enlarged WebView text without scaling the viewport or hit coordinates.
function Fixture({scenario,scale,caseId}:{scenario:string;scale:number;caseId:string}){
  const [history,setHistory]=useState(()=>createRevertHistory(androidControlScenario(scenario)));
  const state=history.present, dispatch=(action:GameAction)=>setHistory(h=>applyGameActionWithRevert(h,action));
  const card=scenario==="play-draw"?"tranquility#ui":"stamina#ui";
  useLayoutEffect(()=>{
    if(scale===1)return;
    const nodes=Array.from(document.querySelectorAll<HTMLElement>("#root *"));
    nodes.forEach(el=>el.style.removeProperty("font-size"));
    const sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize));
    nodes.forEach((el,i)=>el.style.setProperty("font-size",`${sizes[i]*scale}px`,"important"));
  });
  return <main className="game-shell" data-ui-ready={caseId} data-hand-count={state.hand.length} data-deck-count={state.deck.length} data-draw-count={availableResources(state).draw}>
    <header className="topbar">Android操作可达性 · {scenario}</header><section className="mission-strip">真实组件与规则结算；地图区域仅作布局占位，不读取存档。</section>
    <div className="game-layout"><section className={`center-stage ${state.combat?"in-combat":""}`}>
      <div className="tactical-board"><div className="map-card" style={{color:"#b6c7bb",padding:8}}>地图区域 · 布局回归场景</div></div>
      <aside className="tactical-context"><>{state.combat?<CombatPanel state={state} dispatch={dispatch}/>:<TacticalContextSummary state={state} inspectedCellId={state.position} onOpenSite={()=>{}}/>}</>
        <SelectedCardPanel key={card} state={state} dispatch={dispatch} instanceId={card}/>
        <div className="persistent-resource-panel"><ResourceBar state={state} dispatch={dispatch}/></div>
        <TurnPanel state={state} dispatch={dispatch} revertHistory={history} onRevert={()=>setHistory(h=>revertLastAction(h))}/>
      </aside></section><nav className="utility-command-rail">工具</nav></div>
    <div className="persistent-hand-panel"><CardHand state={state} selectedCardId={card} onSelectCard={()=>{}} onOpenWiki={()=>{}}/></div>
  </main>;
}
function Controller(){
  const [config,setConfig]=useState({scenario:params.get("scenario")??"intel",scale:Number(params.get("scale")??1),caseId:"initial"});
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=="android-ui-case")return;
      const {scenario,fontScale,id}=event.data;if(typeof scenario!=="string"||![1,1.25].includes(fontScale)||typeof id!=="string")return;
      setConfig({scenario,scale:fontScale,caseId:id});
    };window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
  },[]);
  return <Fixture key={config.caseId} {...config}/>;
}
createRoot(document.getElementById("root")!).render(<Controller/>);
