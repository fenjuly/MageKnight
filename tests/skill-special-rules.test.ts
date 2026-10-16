import assert from "node:assert/strict";
import test from "node:test";
import type { Enemy, ResourcePool } from "../lib/game-data";
import {
  availableResources,
  combatBlockRequirement,
  combatEnemyArmor,
  createGame,
  gameReducer,
  localsWillInteract,
  terrainMoveCost,
  type GameState,
} from "../lib/game-engine";

function resources(patch: Partial<ResourcePool> = {}): ResourcePool {
  return { move: 0, attack: 0, fireAttack: 0, iceAttack: 0, coldfireAttack: 0, block: 0, fireBlock: 0, iceBlock: 0, coldfireBlock: 0, range: 0, fireRange: 0, iceRange: 0, coldfireRange: 0, siege: 0, fireSiege: 0, iceSiege: 0, coldfireSiege: 0, influence: 0, heal: 0, draw: 0, crystal: 0, ...patch };
}

function state(skillId: string, patch: Partial<GameState> = {}): GameState {
  const base = createGame("tovak", "standard", "classic", "wedge", 431_882, "ultimate");
  return {
    ...base,
    phase: "planning",
    time: "day",
    skills: [skillId],
    hand: [],
    deck: [],
    discard: [],
    played: [],
    spent: resources(),
    turnBonus: resources(),
    manaTokens: { red: 0, blue: 0, green: 0, white: 0, black: 0 },
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
    skillUsesThisTurn: [],
    skillUsesThisRound: [],
    flippedSkills: [],
    skillTurnResources: {},
    actionTaken: false,
    units: [],
    ...patch,
  };
}

function combat(skillId: string, enemy: Enemy, patch: Partial<GameState> = {}): GameState {
  const base = state(skillId, patch);
  return {
    ...base,
    ...patch,
    phase: "combat",
    combat: { cellId: base.position, originId: base.position, enemy, step: "attack", blocked: false, ...(patch.combat ?? {}) },
  };
}

test("Day Sharpshooting switches between its printed day and night values", () => {
  const day = state("norowas-day-sharpshooting", { time: "day" });
  const night = state("norowas-day-sharpshooting", { time: "night" });
  assert.equal(availableResources(day).range, 2);
  assert.equal(availableResources(night).range, 1);
});

test("Inspiration resolves both Ready and fully Heal branches once per round outside combat", () => {
  let ready = state("norowas-inspiration", { units: [{ id: "peasants", used: true, wounded: false }] });
  ready = gameReducer(ready, { type: "ACTIVATE_SKILL", skillId: "norowas-inspiration", option: "ready", unitId: "peasants" });
  assert.equal(ready.units[0]?.used, false);
  assert.ok(ready.skillUsesThisRound?.includes("norowas-inspiration"));

  let heal = state("norowas-inspiration", { units: [{ id: "peasants", used: false, wounded: true, wounds: 2 }] });
  heal = gameReducer(heal, { type: "ACTIVATE_SKILL", skillId: "norowas-inspiration", option: "heal", unitId: "peasants" });
  assert.equal(heal.units[0]?.wounded, false);
  assert.equal(heal.units[0]?.wounds, 0);
});

test("On Her Own offers Influence 1 or conditional Influence 3 and charges back 2 when recruiting", () => {
  const weak = gameReducer(state("wolfhawk-on-her-own"), { type: "ACTIVATE_SKILL", skillId: "wolfhawk-on-her-own" });
  assert.equal(availableResources(weak).influence, 1);
  let strong = gameReducer(state("wolfhawk-on-her-own", { unitOffer: ["peasants"], turnBonus: resources({ influence: 4 }) }), { type: "ACTIVATE_SKILL", skillId: "wolfhawk-on-her-own", option: "strong" });
  strong = { ...strong, map: strong.map.map((cell) => cell.id === strong.position ? { ...cell, site: "village", conquered: true } : cell) };
  const recruited = gameReducer(strong, { type: "RECRUIT", unitId: "peasants" });
  assert.equal(recruited.units.length, 1);
  assert.equal(recruited.spent.influence, 6, "printed cost 4 plus the two-point strong-branch chargeback");
});

test("Battle Frenzy supplies Attack 2 or flips for Attack 4 and a Rest turns it face up", () => {
  const enemy: Enemy = { id: "frenzy-target", name: "敌人", armor: 20, attack: 1, fame: 0, description: "测试" };
  const weak = gameReducer(combat("krang-battle-frenzy", enemy), { type: "ACTIVATE_SKILL", skillId: "krang-battle-frenzy" });
  assert.equal(availableResources(weak).attack, 2);
  let strong = gameReducer(combat("krang-battle-frenzy", enemy), { type: "ACTIVATE_SKILL", skillId: "krang-battle-frenzy", option: "strong" });
  assert.equal(availableResources(strong).attack, 4);
  assert.ok(strong.flippedSkills?.includes("krang-battle-frenzy"));
  strong = { ...strong, phase: "planning", combat: undefined, hand: ["march#rest-frenzy"], played: [], spent: resources(), skillTurnResources: {}, skillUsesThisTurn: [] };
  const rested = gameReducer(strong, { type: "REST" });
  assert.equal(rested.flippedSkills?.includes("krang-battle-frenzy"), false);
});

test("Shamanic Ritual gains the chosen mana and can be refreshed only as the turn action", () => {
  let current = gameReducer(state("krang-shamanic-ritual"), { type: "ACTIVATE_SKILL", skillId: "krang-shamanic-ritual", color: "black" });
  assert.equal(current.manaTokens.black, 1);
  assert.ok(current.flippedSkills?.includes("krang-shamanic-ritual"));
  current = gameReducer(current, { type: "ACTIVATE_SKILL", skillId: "krang-shamanic-ritual", option: "refresh" });
  assert.equal(current.actionTaken, true);
  assert.equal(current.flippedSkills?.includes("krang-shamanic-ritual"), false);
});

test("Arcane Disguise resolves Influence, X-Reputation bypass and green-mana refresh", () => {
  const influence = gameReducer(state("krang-arcane-disguise"), { type: "ACTIVATE_SKILL", skillId: "krang-arcane-disguise" });
  assert.equal(availableResources(influence).influence, 2);
  let disguise = gameReducer(state("krang-arcane-disguise", { reputation: -5 }), { type: "ACTIVATE_SKILL", skillId: "krang-arcane-disguise", option: "disguise" });
  assert.equal(localsWillInteract(disguise), true);
  disguise = { ...disguise, skillUsesThisTurn: [], manaTokens: { ...disguise.manaTokens, green: 1 } };
  const refreshed = gameReducer(disguise, { type: "ACTIVATE_SKILL", skillId: "krang-arcane-disguise", option: "refresh" });
  assert.equal(refreshed.flippedSkills?.includes("krang-arcane-disguise"), false);
  assert.equal(refreshed.manaTokens.green, 0);
});

test("Master of Chaos advances through its color wheel and resolves a gold choice", () => {
  const current = state("krang-master-chaos", { masterChaosColor: "red" });
  const next = gameReducer(current, { type: "ACTIVATE_SKILL", skillId: "krang-master-chaos", option: "block" });
  assert.equal(next.masterChaosColor, "gold");
  assert.equal(availableResources(next).block, 3);
});

test("Mana Overload grants chosen mana and adds exactly 4 to the first matching powered resource", () => {
  const enemy: Enemy = { id: "overload-target", name: "敌人", armor: 20, attack: 1, fame: 0, description: "测试" };
  let current = combat("tovak-mana-overload", enemy, { hand: ["rage#overload"] });
  current = gameReducer(current, { type: "ACTIVATE_SKILL", skillId: "tovak-mana-overload", color: "red" });
  current = gameReducer(current, { type: "PLAY_CARD", instanceId: "rage#overload", mode: "powered" });
  assert.equal(availableResources(current).attack, 8);
  assert.equal(current.manaOverloadColor, undefined);
});

test("Ritual of Pain removes up to two hand Wounds and makes one Wound sideways worth 3", () => {
  let current = state("arythea-ritual-of-pain", { hand: ["wound#a", "wound#b", "wound#c"] });
  current = gameReducer(current, { type: "ACTIVATE_SKILL", skillId: "arythea-ritual-of-pain", cardInstanceIds: ["wound#a", "wound#b"] });
  assert.deepEqual(current.removedCards.slice(-2), ["wound#a", "wound#b"]);
  current = gameReducer(current, { type: "PLAY_CARD", instanceId: "wound#c", mode: "sideways", sideResource: "move" });
  assert.equal(availableResources(current).move, 3);
  const undone = gameReducer(current, { type: "UNPLAY_CARD", instanceId: "wound#c" });
  assert.equal(undone.ritualPainReady, true);
});

test("Calming the Weather reduces every passable terrain by 2 to a minimum of 1", () => {
  const current = gameReducer(state("norowas-calming-weather"), { type: "ACTIVATE_SKILL", skillId: "norowas-calming-weather" });
  assert.equal(terrainMoveCost(current, "swamp"), 3);
  assert.equal(terrainMoveCost(current, "plains"), 1);
  assert.equal(terrainMoveCost(current, "mountain"), Infinity);
});

test("Source Opening rerolls a die, permits a second Source use and awards its basic crystal", () => {
  const enemy: Enemy = { id: "source-target", name: "敌人", armor: 30, attack: 1, fame: 0, description: "测试" };
  let current = combat("goldyx-source-opening", enemy, { hand: ["rage#source-1", "rage#source-2"], source: [{ color: "red" }, { color: "red" }, { color: "red" }] });
  current = gameReducer(current, { type: "ACTIVATE_SKILL", skillId: "goldyx-source-opening", sourceDieIndex: 2 });
  assert.notEqual(current.source[2].color, "red");
  current = gameReducer(current, { type: "PLAY_CARD", instanceId: "rage#source-1", mode: "powered" });
  current = gameReducer(current, { type: "PLAY_CARD", instanceId: "rage#source-2", mode: "powered" });
  assert.equal(current.played.length, 2);
  assert.equal(current.crystals.red, 1);
});

test("Howl of the Pack boosts one sideways card and later lowers one enemy Armor and Attack", () => {
  let current = gameReducer(state("wolfhawk-pack-howl", { hand: ["march#howl"] }), { type: "ACTIVATE_SKILL", skillId: "wolfhawk-pack-howl" });
  current = gameReducer(current, { type: "PLAY_CARD", instanceId: "march#howl", mode: "sideways", sideResource: "move" });
  assert.equal(availableResources(current).move, 5, "4 plus one empty Command token");
  const enemy: Enemy = { id: "howl-target", name: "敌人", armor: 7, attack: 4, fame: 0, description: "测试" };
  current = { ...current, phase: "combat", combat: { cellId: current.position, originId: current.position, enemy, step: "block", blocked: false } };
  current = gameReducer(current, { type: "ACTIVATE_SKILL", skillId: "wolfhawk-pack-howl", option: "combat", enemyId: enemy.id });
  assert.equal(combatEnemyArmor(current), 6);
  assert.equal(combatBlockRequirement(current), 3);
});

test("Mana Enhancement keys off a basic mana actually paid this turn", () => {
  const enemy: Enemy = { id: "enhance-target", name: "敌人", armor: 20, attack: 1, fame: 0, description: "测试" };
  let current = combat("krang-mana-enhancement", enemy, { hand: ["rage#enhance"], source: [{ color: "red" }, { color: "blue" }, { color: "green" }] });
  current = gameReducer(current, { type: "PLAY_CARD", instanceId: "rage#enhance", mode: "powered" });
  current = gameReducer(current, { type: "ACTIVATE_SKILL", skillId: "krang-mana-enhancement", color: "red" });
  assert.equal(current.crystals.red, 1);
  assert.equal(current.manaTokens.red, 1);
});

test("cooperative Nature's Vengeance reduces one attack and grants Cumbersome", () => {
  const enemy: Enemy = { id: "vengeance-target", name: "敌人", armor: 8, attack: 4, fame: 0, description: "测试" };
  let current = combat("braevalar-nature-vengeance-coop", enemy, { combat: { cellId: "0,0", originId: "0,0", enemy, step: "block", blocked: false }, turnBonus: resources({ move: 1 }) });
  current = gameReducer(current, { type: "ACTIVATE_SKILL", skillId: "braevalar-nature-vengeance-coop", enemyId: enemy.id });
  assert.equal(combatBlockRequirement(current), 3);
  current = gameReducer(current, { type: "COMBAT_REDUCE_CUMBERSOME" });
  assert.equal(combatBlockRequirement(current), 2);
});
