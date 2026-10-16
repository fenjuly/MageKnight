import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CombatPanel, EnemyMapIntel, ResourceBar } from "../app/game";
import { availableResources, gameReducer } from "../lib/game-engine";
import { androidControlScenario } from "./fixtures/android-control-states";
const noop=()=>{};
test("public enemy trait information has a real dialog opener and readable complete explanations",()=>{
  const state=androidControlScenario("intel"),enemy=state.map.find(c=>c.id===state.position)!.enemy!;
  const html=renderToStaticMarkup(<EnemyMapIntel enemy={enemy}/>);
  assert.match(html,/aria-haspopup="dialog" data-ui-action="enemy-traits"/);
  assert.match(html,/<dialog[^>]*aria-label=/);assert.match(html,/关闭特性说明/);
  for(const label of ["中毒：","迅捷：","残暴：","麻痹：","多重攻击："])assert.ok(html.includes(label));
});
for(const step of ["ranged","block","damage","attack","multi"])test(`${step}: drawing from a played card is exposed and consumes one actual draw`,()=>{
  const state=androidControlScenario(step);assert.equal(availableResources(state).draw,1);
  const html=renderToStaticMarkup(<ResourceBar state={state} dispatch={noop}/>);assert.match(html,/data-ui-action="draw"/);
  const next=gameReducer(state,{type:"USE_DRAW"});assert.equal(next.hand.length,state.hand.length+1);assert.equal(next.deck.length,state.deck.length-1);assert.equal(availableResources(next).draw,0);
  assert.doesNotMatch(renderToStaticMarkup(<ResourceBar state={next} dispatch={noop}/>),/data-ui-action="draw"/);
  const combat=renderToStaticMarkup(<CombatPanel state={state} dispatch={noop}/>).split('class="combat-command-region"')[1];
  assert.match(combat,/data-ui-action="enemy-traits"/);
});
test("pending heal and all four crystal actions remain part of the resource controls",()=>{
  const html=renderToStaticMarkup(<ResourceBar state={androidControlScenario("resources")} dispatch={noop}/>);
  for(const id of ["draw","heal","crystal-red","crystal-blue","crystal-green","crystal-white"])assert.ok(html.includes(`data-ui-action="${id}"`));
});
test("no draw command is offered when the deck is empty",()=>{
  const state=androidControlScenario("resources");state.deck=[];
  assert.doesNotMatch(renderToStaticMarkup(<ResourceBar state={state} dispatch={noop}/>),/data-ui-action="draw"/);
});
