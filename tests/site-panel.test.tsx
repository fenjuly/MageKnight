import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SitePanel, UtilityDrawer } from "../app/game";
import { ALL_ENEMY_TOKENS, ALL_RUIN_TOKEN_BY_ID, EMPTY_RESOURCES, SITE_LABELS, type MapCell } from "../lib/game-data";
import { createGame, type GameState } from "../lib/game-engine";
import { publicCellIntel } from "../lib/map-intel";

const noop = () => {};
const origin:MapCell={id:"0,0",q:0,r:0,terrain:"plains",site:"village",revealed:true,conquered:false,tokenRevealed:true};
function scenario(patch:Partial<MapCell>={}):GameState {
  const base=createGame("tovak","standard","classic","wedge",42,"ultimate");
  return {...base,position:origin.id,phase:"planning",actionTaken:false,hand:["wound#site"],
    turnBonus:{...EMPTY_RESOURCES,influence:20,move:20},
    map:[origin,{...origin,id:"1,0",q:1,site:"mine",mineColor:"blue",...patch}]};
}
const render=(state:GameState,id=state.map[1].id)=>renderToStaticMarkup(<SitePanel state={state} dispatch={noop} cellId={id} />);

for(const site of Object.keys(SITE_LABELS) as MapCell["site"][]) test(`selected ${site} drawer describes its target rather than the hero's village`,()=>{
  const state=scenario({site,enemy:site==="rampager"||site==="dragon"?ALL_ENEMY_TOKENS[0]:undefined});
  const html=renderToStaticMarkup(<UtilityDrawer state={state} dispatch={noop} panel="site" siteCellId="1,0" onClose={noop} />);
  assert.ok(html.includes(`aria-label="${publicCellIntel(state.map[1]).name}地点行动"`));
  assert.match(html,/data-cell-id="1,0"/); assert.match(html,/相邻地点/);
  assert.ok(!html.includes('class="nearby-enemies"'),"remote inspection must not substitute nearby actions from another position");
});
test("remote site services cannot apply healing, altar, maze, monastery or mine actions at the hero's position",()=>{
  for(const site of ["village","monastery","ruins","maze","labyrinth","deepMine"] as const){
    const html=render(scenario({site,ruinAltarColor:"red",mineColors:["red","blue"]}));
    assert.doesNotMatch(html,/<button/); assert.match(html,/需要先到达此地点/);
  }
});
test("the hero's current village retains its usable healing action",()=>{
  const html=render(scenario(),origin.id);
  assert.match(html,/当前位置/); assert.match(html,/<button[^>]*><span>疗愈伤势<\/span>/);
  assert.doesNotMatch(html,/site-remote-actions/);
});
test("targeted mine shows its own output and not just the current village guide",()=>{
  const html=render(scenario()); assert.match(html,/产出：蓝色水晶/); assert.match(html,/蕴藏特定颜色魔力/);
  assert.doesNotMatch(html,/村民愿意提供治疗/);
});
test("only adjacent rampagers have an enabled challenge; phase/action restrictions still apply",()=>{
  const state=scenario({site:"rampager",enemy:ALL_ENEMY_TOKENS[0]});
  assert.match(render(state),/<button class="wide-action challenge-action"><span>挑战/);
  for(const changed of [
    {...state,actionTaken:true}, {...state,phase:"combat" as const},
    {...state,map:[origin,{...state.map[1],q:3,r:0}]},
  ]) assert.match(render(changed),/<button class="wide-action challenge-action" disabled=""/);
});
test("inspecting face-down defenders and ruins never reveals enemy names, traits, portraits or altar rewards",()=>{
  const enemy={...ALL_ENEMY_TOKENS[0],id:"concealed-site",name:"保密守卫名字"};
  const altar=Object.values(ALL_RUIN_TOKEN_BY_ID).find((token)=>token.altarColor)!;
  for(const site of ["keep","mageTower","city1","city2","rampager","ruins"] as const){
    const html=render(scenario({site,enemy,tokenRevealed:false,ruinTokenId:altar.id}));
    assert.ok(!html.includes(enemy.name)); assert.ok(!html.includes(altar.name));
    assert.doesNotMatch(html,/class="site-enemy-intel"/);
  }
  const html=render(scenario({site:"keep",enemy,tokenRevealed:true}));
  assert.ok(html.includes(enemy.name)); assert.match(html,/class="site-enemy-intel"/);
});
test("a missing target safely falls back to the actual hero position",()=>{
  const html=render(scenario(),"removed-cell"); assert.match(html,/data-cell-id="0,0"/); assert.match(html,/当前位置/);
});
test("moving onto the inspected mine enables only its local actions",()=>{
  const state=scenario({site:"deepMine",mineColors:["red","blue"]});
  const html=render({...state,position:"1,0"}); assert.match(html,/当前位置/);
  assert.match(html,/<button[^>]*>选择红色<\/button>/); assert.doesNotMatch(html,/site-remote-actions/);
});
