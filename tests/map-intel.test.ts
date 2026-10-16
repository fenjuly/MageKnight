import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as T from "three";
import { ALL_ENEMY_TOKENS, ALL_RUIN_TOKEN_BY_ID, EMPTY_RESOURCES, SITE_LABELS, TERRAIN_LABELS, type MapCell } from "../lib/game-data";
import { applyGameActionWithRevert, createGame, createRevertHistory, revertLastAction, cityLevel, type GameState } from "../lib/game-engine";
import { MAP_MANA_COLORS, mapDisplaySite, mineColorsForCell, publicCellIntel, publicCellMapLabel, publicSiteAccent, mapSelectionContext, type CrystalColor } from "../lib/map-intel";
import { createBoardSelectionOverlay, resolveBoardHit, visibleCellModelData } from "../lib/three-board";
import { normalizeRealisticModel } from "../lib/three-realistic";
import { visibleScreenLabels } from "../lib/three-quality";

const cell: MapCell = {id:"0,0",q:0,r:0,terrain:"plains",site:"mine",revealed:true,conquered:false,tokenRevealed:false};

for (const site of ["rampager", "dragon"] as const) for (const terrain of ["plains", "forest", "swamp", "hills", "desert"] as const) test(`${site} on ${terrain}: actual victory removes the token label and undo restores it`, () => {
  const base=createGame("tovak","standard","classic","wedge",42,"ultimate");
  const enemy={...ALL_ENEMY_TOKENS[0],id:"label-foe",name:"标签测试敌人",armor:1,fame:0,tokenColor:undefined};
  const target:MapCell={...cell,id:"1,0",q:1,terrain,site,tokenRevealed:true,enemy,enemies:[enemy]};
  const state:GameState={...base,phase:"combat",actionTaken:true,position:cell.id,map:[{...cell,site:"none"},target],
    combat:{cellId:target.id,originId:cell.id,enemy,step:"attack",blocked:false,kind:"rampager",chainStartFame:0},
    turnBonus:{...EMPTY_RESOURCES,attack:100},spent:{...EMPTY_RESOURCES},played:[]};
  assert.equal(mapDisplaySite(target),site);
  assert.ok(publicCellMapLabel(target,"day").startsWith(SITE_LABELS[site]));
  const history=applyGameActionWithRevert(createRevertHistory(state),{type:"COMBAT_ATTACK"});
  const cleared=history.present.map[1];
  assert.equal(cleared.conquered,true); assert.equal(cleared.enemy,undefined); assert.deepEqual(cleared.enemies,[]);
  assert.equal(cleared.site,site,"presentation must not mutate the original site used by rules, scoring and undo");
  assert.equal(publicCellIntel(cleared).name,TERRAIN_LABELS[terrain]);
  assert.equal(mapDisplaySite(cleared),"none"); assert.equal(visibleCellModelData(cleared).site,"none");
  assert.deepEqual(visibleCellModelData(cleared).enemies,[]);
  assert.ok(publicCellIntel(cleared).badges.some((b)=>b.text==="✓ 已清理"));
  for (const time of ["day","night"] as const) {
    const label=publicCellMapLabel(cleared,time);
    assert.ok(label.startsWith(`${TERRAIN_LABELS[terrain]} · 移动 `));
    assert.ok(!label.includes(SITE_LABELS[site])); assert.ok(!label.includes("守军"));
  }
  const restored=revertLastAction(history).present.map[1];
  assert.equal(publicCellMapLabel(restored,"day"),publicCellMapLabel(target,"day"));
  assert.equal(visibleCellModelData(restored).enemies[0].id,enemy.id);
});

test("swamp label explicitly identifies 5 as movement cost, not enemy strength",()=>{
  assert.equal(publicCellMapLabel({...cell,terrain:"swamp",site:"rampager",conquered:true},"day"),"沼泽 · 移动 5");
  assert.equal(publicCellMapLabel({...cell,terrain:"mountain",site:"none"},"day"),"山脉 · 不可进入");
});
test("empty roaming slots and legacy cleared slots never invent a living enemy",()=>{
  for(const site of ["rampager","dragon"] as const) {
    assert.equal(mapDisplaySite({...cell,site}),"none");
    const stale={...cell,site,conquered:true,enemy:ALL_ENEMY_TOKENS[0],tokenRevealed:true};
    assert.equal(publicCellIntel(stale).name,"平原"); assert.deepEqual(visibleCellModelData(stale).enemies,[]);
    assert.ok(!publicCellMapLabel(stale,"day").includes(SITE_LABELS[site]));
  }
});
test("permanent buildings survive conquest; only their enemy/state badges change",()=>{
  for(const site of ["keep","mageTower","monastery","city1","city2","ruins","monsterDen","dungeon","tomb","maze","labyrinth","spawningGrounds","volkareCamp"] as const) {
    const before={...cell,site,enemy:ALL_ENEMY_TOKENS[0],tokenRevealed:true};
    const after={...before,conquered:true,enemy:undefined,enemies:[]};
    assert.equal(mapDisplaySite(after),site);
    assert.equal(publicCellIntel(after).name,publicCellIntel(before).name);
    assert.ok(!publicCellIntel(after).badges.some((b)=>b.kind==="enemy"));
    assert.ok(publicCellIntel(after).badges.some((b)=>b.kind==="state"));
  }
});
for (const color of ["red","blue","green","white"] as CrystalColor[]) test(`3D public mine information: ${color} has both a named output and a color`,()=>{
  const intel=publicCellIntel({...cell,mineColor:color});
  assert.deepEqual(intel.colors,[color]); assert.ok(intel.shortMineLabel.endsWith("晶")); assert.ok(intel.badges[0].text.includes("水晶")); assert.ok(MAP_MANA_COLORS[color]);
});
for (const colors of [["red","blue"],["green","white"],["red","blue","green","white"]] as CrystalColor[][]) test(`deep mine shows every allowed color: ${colors.join("/")}`,()=>{
  const mine={...cell,site:"deepMine" as const,mineColor:colors[0],mineColors:colors};
  assert.deepEqual(mineColorsForCell(mine),colors); assert.equal(publicCellIntel(mine).badges[0].colors?.length,colors.length); assert.ok(publicCellIntel(mine).badges[0].text.startsWith("任选产色"));
  assert.equal(new Set(publicCellIntel(mine).shortMineLabel.split("/")).size,colors.length);
});
test("stale mine fields on an ordinary building cannot invent an output",()=>{
  assert.deepEqual(mineColorsForCell({...cell,site:"village",mineColor:"red"}),[]);
  assert.deepEqual(mineColorsForCell({...cell,site:"deepMine",mineColor:"blue",mineColors:["blue","blue"]}),["blue"]);
});
test("site accent colors follow public mines, cities and revealed altars, never hidden altar assignments",()=>{
  assert.equal(publicSiteAccent({...cell,mineColor:"red"}),"red");
  assert.equal(publicSiteAccent({...cell,site:"deepMine",mineColors:["red","blue"]}),"white");
  assert.equal(publicSiteAccent({...cell,site:"city1",tileId:"core-5@2,0"}),"green");
  const altar=Object.values(ALL_RUIN_TOKEN_BY_ID).find((token)=>token.altarColor==="red")!;
  const ruin={...cell,site:"ruins" as const,ruinTokenId:altar.id,ruinAltarColor:"red" as const};
  assert.equal(publicSiteAccent(ruin),undefined); assert.equal(publicSiteAccent({...ruin,tokenRevealed:true}),"red");
  assert.equal(publicSiteAccent({...ruin,tokenRevealed:true,conquered:true}),undefined);
});

for (const [number,color] of [[5,"绿"],[6,"蓝"],[7,"白"],[8,"红"]] as const) test(`city tile ${number} retains public color and actual difficulty level`,()=>{
  for (const difficulty of ["apprentice","standard","legendary"] as const) {
    const city={...cell,site:"city2" as const,tileId:`core-${number}@2,1`,enemy:ALL_ENEMY_TOKENS[0]};
    const intel=publicCellIntel(city,difficulty); assert.equal(intel.name,`${color}色城市`);
    assert.ok(intel.badges.some((badge)=>badge.kind==="city"&&badge.text.startsWith(`等级 ${cityLevel("city2",difficulty)}`)));
    assert.ok(!JSON.stringify(intel).includes(ALL_ENEMY_TOKENS[0].name),"city color must not disclose face-down defender identity");
  }
});

test("face-down ruins show a yellow back, never the assigned altar, enemies or reward",()=>{
  for (const token of Object.values(ALL_RUIN_TOKEN_BY_ID)) {
    const ruin={...cell,site:"ruins" as const,ruinTokenId:token.id,ruinAltarColor:token.altarColor};
    const info=publicCellIntel(ruin); assert.deepEqual(info.badges,[{kind:"ruin",text:"黄色遗迹标记 · 未公开",colors:[]}]);
    const revealed=publicCellIntel({...ruin,tokenRevealed:true}); assert.ok(revealed.badges[0].text.includes(token.name)); assert.ok(revealed.badges[0].text.includes(token.description));
    assert.deepEqual(revealed.badges[0].colors,token.altarColor?[token.altarColor]:[]);
  }
});
test("cleared ruins and burned monasteries cannot retain their live service/reward markers",()=>{
  const ruins=publicCellIntel({...cell,site:"ruins",conquered:true,tokenRevealed:true,ruinTokenId:Object.keys(ALL_RUIN_TOKEN_BY_ID)[0]});
  assert.equal(ruins.badges.some((badge)=>badge.kind==="ruin"),false); assert.ok(ruins.badges[0].text.includes("已清理"));
  const burned=publicCellIntel({...cell,site:"monastery",conquered:true}); assert.equal(burned.badges[0].text,"已焚毁 · 不再提供服务");
});
test("multi-enemy markers expose counts but not concealed names or abilities",()=>{
  const enemies=ALL_ENEMY_TOKENS.slice(0,3), guarded={...cell,site:"keep" as const,enemy:enemies[0],enemies};
  assert.equal(publicCellIntel(guarded).badges[0].text,"3 枚敌人标记 · 未公开");
  const open=publicCellIntel({...guarded,tokenRevealed:true}); assert.ok(open.badges[0].text.startsWith("已公开 3")); for (const enemy of enemies) assert.ok(open.badges[0].text.includes(enemy.name));
  assert.equal(publicCellIntel({...guarded,conquered:true}).badges.some((badge)=>badge.kind==="enemy"),false);
});
test("selection survives playing a movement card but expires after movement, combat, action or a new turn",()=>{
  const state=createGame("tovak","standard","classic","wedge",125,"base");
  const key=mapSelectionContext(state), cardChanged={...state,turnBonus:{...state.turnBonus,move:10},hand:[]}; assert.equal(key,mapSelectionContext(cardChanged));
  for (const changed of [{position:"1,0"},{phase:"combat" as const},{actionTaken:true},{round:state.round+1},{dummyDeck:state.dummyDeck-3},{seed:126}]) assert.notEqual(key,mapSelectionContext({...state,...changed}));
});
test("selection overlay has persistent visible geometry and cannot steal ray hits",()=>{
  const overlay=createBoardSelectionOverlay(); assert.equal(overlay.visible,false); overlay.visible=true;
  assert.equal(overlay.children.length,3);
  overlay.traverse((object)=>{if (!(object instanceof T.Mesh)) return; const material=object.material as T.MeshBasicMaterial; assert.equal(material.depthTest,false); assert.equal(material.depthWrite,false); assert.equal(object.renderOrder,1000); assert.equal(resolveBoardHit([{object}]),undefined); object.geometry.dispose(); material.dispose();});
});
test("selected text has collision priority over ordinary terrain labels",()=>{
  const base={x:50,y:50,width:140,height:20}; assert.deepEqual([...visibleScreenLabels([{...base,id:1,priority:60},{...base,id:2,priority:1000}])],[2]);
});
for (const color of Object.values(MAP_MANA_COLORS)) test(`mine tint replaces blue defaults rather than mixing into ${color}`,()=>{
  const group=new T.Group(), material=new T.MeshStandardMaterial({color:"#08314f"}); material.name="Crystal / water";
  const stone=new T.MeshStandardMaterial({color:"#665544"}); stone.name="masonry";
  group.add(new T.Mesh(new T.BoxGeometry(),material),new T.Mesh(new T.BoxGeometry(),stone));
  const model=normalizeRealisticModel(group,"env-site-mine",{tint:color,tintMaterials:"^Crystal / water$",tintMode:"replace"});
  assert.equal(((group.children[0] as T.Mesh).material as T.MeshStandardMaterial).color.getHex(),new T.Color(color).getHex());
  assert.equal((group.children[1] as T.Mesh).material,stone); assert.equal(material.color.getHex(),new T.Color("#08314f").getHex());
  (model.userData.instanceMaterials as T.Material[]).forEach((value)=>value.dispose()); group.children.forEach((value)=>(value as T.Mesh).geometry.dispose()); material.dispose(); stone.dispose();
});
test("3D selection, hover and pending confirmation use separate state and cleanup paths",()=>{
  const board=readFileSync(new URL("../lib/three-board.ts",import.meta.url),"utf8"), ui=readFileSync(new URL("../app/game.tsx",import.meta.url),"utf8"), adapter=readFileSync(new URL("../app/three-map.tsx",import.meta.url),"utf8"), css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.ok(adapter.includes("selection(props.selection)")); assert.ok(ui.includes("selection={activeSelection}")); assert.ok(ui.includes("onSelect={selectMapTarget}")); assert.ok(ui.includes("onClick={clearMapSelection}"));
  assert.ok(board.includes('renderer.domElement.removeEventListener("pointerleave", pointerLeave)')); assert.ok(board.includes("selectionOverlay.traverse"));
  assert.match(css,/\.map-3d-active \.map-action-preview \{ position:absolute/);
  const mobile=readFileSync(new URL("../mobile/mobile.css",import.meta.url),"utf8"); assert.match(mobile,/html\.capacitor-app \.map-3d-active \.map-action-preview \{ bottom:58px/);
  assert.ok(ui.includes('<MapPublicIntel cell={cell}')); assert.ok(ui.includes('<MapPublicIntel cell={inspected}'));
});
