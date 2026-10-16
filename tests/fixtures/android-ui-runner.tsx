import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { uiCases } from "../../scripts/ui-contract.mjs";
import { reachable, settle, until, type UiCheck } from "./ui-reachability";

type Case = ReturnType<typeof uiCases>[number];
type Result = Case & {passed:boolean;checks:UiCheck[]};
async function checkCase(doc:Document,entry:Case){
  const {scenario}=entry;
  const checks:UiCheck[]=[],win=doc.defaultView!, main=()=>doc.querySelector<HTMLElement>('[data-ui-ready]')!;
  const button=(selector:string)=>doc.querySelector<HTMLButtonElement>(selector);
  checks.push({name:"实际视口匹配",passed:win.innerWidth===entry.width&&win.innerHeight===entry.height});
  async function hit(el:HTMLElement|null,name:string,click=false){const result=await reachable(el,name,doc);checks.push(result);if(click&&result.passed){el!.click();await settle(win);}return result.passed;}
  await hit(button('[data-ui-action="enemy-traits"]'),"抽牌前的敌人特性入口可达");
  for(const el of doc.querySelectorAll<HTMLButtonElement>('.combat-actions > button,.selected-card-panel .card-actions > button,.turn-panel .revert-button,.turn-panel .end-turn-button'))await hit(el,`初始主操作：${el.textContent?.trim()}`);
  if(scenario==="play-draw"){
    const draw=Array.from(doc.querySelectorAll<HTMLButtonElement>('.card-actions > button')).find(el=>el.textContent?.includes("基础")&&el.textContent?.includes("抽牌"));
    if(await hit(draw??null,"选择卡牌抽牌效果",true)){
      await until(doc,()=>!!doc.querySelector('.card-resolution-preview'));
      await hit(button('.card-resolution-preview .primary-button'),"确认出牌",true);
      await until(doc,()=>main().dataset.drawCount==="1");
    }
  }
  if(scenario!=="intel"){
    const before=Number(main().dataset.handCount),deck=Number(main().dataset.deckCount);
    if(await hit(button('[data-ui-action="draw"]'),"抽1张按钮可达",true)){
      await until(doc,()=>Number(main().dataset.handCount)===before+1);
      checks.push({name:"抽牌真实结算并消耗点数",passed:Number(main().dataset.deckCount)===deck-1&&main().dataset.drawCount==="0"});
    }
  }
  if(scenario==="resources"){
    await hit(button('[data-ui-action="heal"]'),"治疗按钮可达");
    for(const color of ["red","blue","green","white"])await hit(button(`[data-ui-action="crystal-${color}"]`),`凝聚${color}水晶按钮可达`);
  }
  const help=button('[data-ui-action="enemy-traits"]');
  if(await hit(help,"敌人特性入口可达",true)){
    const dialog=doc.querySelector<HTMLDialogElement>('.enemy-traits-dialog[open]');
    checks.push({name:"特性说明在顶层打开",passed:!!dialog});
    if(dialog){
      const body=dialog.querySelector<HTMLElement>('.enemy-traits-body')!;
      body.scrollTop=body.scrollHeight;await settle(win);
      const last=body.querySelector('p:last-child')!,r=last.getBoundingClientRect(),b=body.getBoundingClientRect();
      checks.push({name:"特性最后一段可滚动阅读",passed:r.bottom<=b.bottom+.5&&r.bottom<=win.innerHeight});
      await hit(dialog.querySelector('button'),"关闭特性说明可达",true);
      checks.push({name:"关闭特性后返回原界面",passed:!dialog.open});
    }
  }
  for(const el of doc.querySelectorAll<HTMLButtonElement>('.combat-actions > button,.selected-card-panel .card-actions > button,.turn-panel .revert-button'))await hit(el,`主操作：${el.textContent?.trim()}`);
  checks.push({name:"整页无纵向滚动",passed:doc.documentElement.scrollHeight<=win.innerHeight});
  return checks;
}
function Runner(){
  const frameHost=useRef<HTMLDivElement>(null),[running,setRunning]=useState(false),[results,setResults]=useState<Result[]>([]),[status,setStatus]=useState("等待运行"),[error,setError]=useState("");
  async function run(){
    setRunning(true);setResults([]);setError("");const all:Result[]=[];
    try{
      const {fingerprint}=await(await fetch('/__ui-test/version')).json();
      const iframe=document.createElement("iframe");iframe.title="当前布局检查场景";iframe.style.cssText="border:0;display:block;background:#142821";iframe.width="568";iframe.height="320";
      await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("验收页载入超时")),10000);iframe.onload=()=>{clearTimeout(timer);resolve();};iframe.src="/android-ui-case.html";frameHost.current!.replaceChildren(iframe);});
      const doc=iframe.contentDocument!;await until(doc,()=>!!doc.querySelector('[data-ui-ready]'));
      for(const entry of uiCases()){
        setStatus(`正在检查 ${all.length+1}/${uiCases().length}：${entry.id}`);
        iframe.width=String(entry.width);iframe.height=String(entry.height);
        iframe.contentWindow!.postMessage({type:"android-ui-case",...entry},location.origin);
        await until(doc,()=>doc.querySelector('[data-ui-ready]')?.getAttribute('data-ui-ready')===entry.id);
        await doc.fonts.ready;let checks:UiCheck[];
        try{checks=await checkCase(doc,entry);}catch(e){checks=[{name:"交互完成",passed:false,detail:String(e)}];}
        all.push({...entry,checks,passed:checks.every(c=>c.passed)});setResults([...all]);
      }
      const report={version:1,fingerprint,generatedAt:new Date().toISOString(),browser:navigator.userAgent,results:all};
      if(all.every(r=>r.passed)){
        const response=await fetch('/__ui-test/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
        const saved=await response.json();if(!response.ok)throw new Error(saved.error);
        setStatus(`通过 ${all.length}/${all.length}，报告已保存，可执行 npm run test:full。`);
      }else setStatus(`失败 ${all.filter(r=>!r.passed).length}/${all.length}；报告不能通过验收。`);
    }catch(e){setStatus("验收未完成，报告未保存");setError(String(e));}finally{setRunning(false);}
  }
  return <main style={{fontFamily:"system-ui",padding:16,color:"#d8e7da",background:"#10251f",minHeight:"100vh"}}>
    <h1 style={{fontSize:22}}>Android 布局与交互验收</h1><p>5种横屏尺寸 × 2档文字大小 × 8种真实组件状态。检查可见边界、5点命中、滚动可达性、特性弹窗及真实抽牌结算。</p>
    <button disabled={running} onClick={run} style={{padding:12,fontSize:16}}>运行全部检查</button><p role="status">{status}</p>{error&&<pre role="alert">{error}</pre>}
    <ol>{results.filter(r=>!r.passed).map(r=><li key={r.id}>{r.id}<pre>{JSON.stringify(r.checks.filter(c=>!c.passed),null,2)}</pre></li>)}</ol>
    <details><summary>完整检查记录</summary><pre aria-label="完整检查记录">{JSON.stringify(results,null,2)}</pre></details>
    <div ref={frameHost} style={{border:"1px solid #829b87",width:"max-content"}}/>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Runner/>);
