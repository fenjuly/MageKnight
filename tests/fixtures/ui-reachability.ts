export type UiCheck={name:string;passed:boolean;detail?:string};
export const settle=(win:Window)=>new Promise<void>(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>resolve())));
/** Must be visible, fit inside the viewport and really receive pointer hits.
 * A local scroll is allowed; display:none and clipped non-scrollable ancestors fail. */
export async function reachable(element:Element|null,name:string,doc:Document):Promise<UiCheck>{
  if(!element)return {name,passed:false,detail:"缺少控件"};
  const win=doc.defaultView!;
  element.scrollIntoView({block:"nearest",inline:"nearest"});await settle(win);
  const r=element.getBoundingClientRect(),style=win.getComputedStyle(element);
  if(!r.width||r.height<24||style.visibility==="hidden"||style.display==="none")return {name,passed:false,detail:`控件隐藏或不足24px: ${r.width}×${r.height}`};
  // Quarter points are inside circular/rounded controls as well as rectangles.
  const dx=r.width/4,dy=r.height/4;
  const points=[[r.left+dx,r.top+dy],[r.right-dx,r.top+dy],[r.left+dx,r.bottom-dy],[r.right-dx,r.bottom-dy],[r.left+r.width/2,r.top+r.height/2]];
  const passed=r.left>=-.5&&r.top>=-.5&&r.right<=win.innerWidth+.5&&r.bottom<=win.innerHeight+.5&&points.every(([x,y])=>{const hit=doc.elementFromPoint(x,y);return hit===element||!!hit&&element.contains(hit);});
  return {name,passed,...(!passed?{detail:`边界越界或被覆盖: ${[r.x,r.y,r.width,r.height].map(v=>Math.round(v)).join(",")}`}:{})};
}
export async function until(doc:Document,check:()=>boolean){
  const end=Date.now()+5000;while(!check()){if(Date.now()>end)throw new Error("界面状态更新超时");await new Promise(r=>setTimeout(r,20));}await settle(doc.defaultView!);
}
