import { createGame, type GameState } from "../../lib/game-engine";
import { ALL_ENEMY_TOKENS, ALL_UNIT_DEFS } from "../../lib/game-data";

/** In-memory fixture shared by executable component tests and browser QA. */
export function combatUiScenario(step: NonNullable<GameState["combat"]>["step"], multi = false) {
  const state = createGame("tovak", "standard", "classic", "wedge", 812144, "ultimate");
  const template = ALL_ENEMY_TOKENS.find((e) => multi ? Boolean(e.defend) : !e.defend)!;
  const first = { ...template, id: "ui-enemy", name: "战斗布局测试敌人", cumbersome: true };
  const enemies = [first, ...ALL_ENEMY_TOKENS.slice(0, multi ? 6 : 0).map((e, i) => ({ ...e, id: `ui-enemy-${i}` }))];
  state.phase = "combat";
  state.combat = { cellId: state.position, originId: state.position, enemy: first, step, blocked: false, damageRemaining: 8, queue: enemies.slice(1).map((enemy) => ({ cellId: state.position, enemy })) };
  state.map = state.map.map((c) => c.id === state.position ? { ...c, enemy: first, enemies, tokenRevealed: true } : c);
  state.units = ALL_UNIT_DEFS.slice(0, 6).map((u) => ({ id: u.id, used: false, wounded: false, wounds: 0 }));
  state.hand = ["stamina#ui", ...state.hand];
  return state;
}
