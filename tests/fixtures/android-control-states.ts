import { EMPTY_RESOURCES } from "../../lib/game-data";
import { gameReducer } from "../../lib/game-engine";
import { combatUiScenario } from "./combat-states";

export function androidControlScenario(name:string) {
  const step=["ranged","block","damage","attack"].includes(name)?name as "ranged"|"block"|"damage"|"attack":"ranged";
  let state=combatUiScenario(step,name==="multi");
  const enemy={...state.combat!.enemy,poison:true,swift:true,brutal:true,paralyze:true,attackCount:2};
  state={...state,hand:["tranquility#ui","stamina#ui","wound#ui"],deck:["rage#draw1","march#draw2"],played:[],spent:{...EMPTY_RESOURCES},turnBonus:{...EMPTY_RESOURCES},
    combat:{...state.combat!,enemy},map:state.map.map(c=>c.id===state.position?{...c,site:"rampager",enemy,enemies:[enemy],tokenRevealed:true}:c)};
  if(["intel","play-draw","resources"].includes(name))state={...state,phase:"planning",combat:undefined};
  if(name!=="intel"&&name!=="play-draw")state=gameReducer(state,{type:"PLAY_CARD",instanceId:"tranquility#ui",mode:"basic",effectChoice:1});
  if(name==="resources")state={...state,turnBonus:{...state.turnBonus,heal:1,crystal:1}};
  return state;
}
