import assert from "node:assert/strict";
import test from "node:test";
import type { Enemy, MapCell } from "../lib/game-data";
import {
  availableResources,
  canActivateUnitAbility,
  combatEnemyArmor,
  createGame,
  gameReducer,
  unitRecruitInfluenceCost,
  type GameState,
} from "../lib/game-engine";
import { getUnit } from "../lib/game-data";

function state(patch: Partial<GameState> = {}): GameState {
  const base = createGame("tovak", "standard", "classic", "wedge", 810_032, "ultimate");
  return {
    ...base,
    phase: "planning",
    hand: [],
    deck: [],
    discard: [],
    played: [],
    actionTaken: false,
    spent: { ...base.spent },
    turnBonus: { ...base.turnBonus },
    manaTokens: { red: 8, blue: 8, green: 8, white: 8, black: 8 },
    crystals: { red: 3, blue: 3, green: 3, white: 3 },
    units: [],
    ...patch,
  };
}

function atSite(base: GameState, site: MapCell["site"], conquered = true): GameState {
  return {
    ...base,
    map: base.map.map((cell) => cell.id === base.position ? { ...cell, site, conquered, revealed: true } : cell),
  };
}

function inCombat(enemy: Enemy, patch: Partial<GameState> = {}): GameState {
  const base = state();
  return {
    ...base,
    ...patch,
    phase: "combat",
    combat: {
      cellId: base.position,
      originId: base.position,
      enemy,
      step: "block",
      blocked: false,
      chainStartFame: base.fame,
      ...(patch.combat ?? {}),
    },
  };
}

test("Altem Mages enforce every printed mana choice and combat transformation", () => {
  const enemy: Enemy = { id: "altem-target", name: "测试守卫", armor: 9, attack: 4, fame: 0, description: "测试" };
  let current = inCombat(enemy, { units: [{ id: "altemMages", used: false, wounded: false }] });
  assert.equal(canActivateUnitAbility(current, "altemMages", "mana"), false, "two output colours must be chosen");
  const mana = gameReducer({ ...current, phase: "planning", combat: undefined }, { type: "ACTIVATE_UNIT", unitId: "altemMages", abilityId: "mana", manaColors: ["green", "white"] });
  assert.equal(mana.manaTokens.green, current.manaTokens.green + 1);
  assert.equal(mana.manaTokens.white, current.manaTokens.white + 1);

  for (const [abilityId, color, key, value] of [
    ["attack7", "red", "coldfireAttack", 7],
    ["block7", "blue", "coldfireBlock", 7],
  ] as const) {
    current = inCombat(enemy, { units: [{ id: "altemMages", used: false, wounded: false }] });
    assert.equal(canActivateUnitAbility(current, "altemMages", abilityId, []), false);
    const next = gameReducer(current, { type: "ACTIVATE_UNIT", unitId: "altemMages", abilityId, manaColors: [color] });
    assert.equal(availableResources(next)[key], value);
    assert.equal(next.manaTokens[color], current.manaTokens[color] - 1);
  }

  current = inCombat(enemy, { units: [{ id: "altemMages", used: false, wounded: false }] });
  const transformed = gameReducer(current, { type: "ACTIVATE_UNIT", unitId: "altemMages", abilityId: "transform" });
  assert.equal(transformed.combat?.attackTransform, "coldfire");
});

test("Thugs invert Reputation for recruitment, lose Reputation on abilities and cost raw Influence to absorb damage", () => {
  const thugs = getUnit("thugs")!;
  let high = atSite(state({ reputation: 5, turnBonus: { ...state().turnBonus, influence: 10 }, unitOffer: ["thugs"], ownedKeeps: 3 }), "village");
  assert.equal(unitRecruitInfluenceCost(high, thugs), 10, "+5 Reputation becomes a 5-point penalty");
  high = gameReducer(high, { type: "RECRUIT", unitId: "thugs" });
  assert.equal(high.units.some((unit) => unit.id === "thugs"), true);
  assert.equal(high.spent.influence, 10);
  assert.equal(high.interactionReputationMode, "thugs");

  let low = atSite(state({ reputation: -4, unitOffer: ["thugs"], ownedKeeps: 3 }), "village");
  assert.equal(unitRecruitInfluenceCost(low, thugs), 0, "-5 Reputation penalty becomes a 5-point bonus");
  low = gameReducer(low, { type: "RECRUIT", unitId: "thugs" });
  assert.equal(low.units.some((unit) => unit.id === "thugs"), true);

  const attackState = inCombat({ id: "thug-target", name: "敌人", armor: 9, attack: 5, fame: 0, description: "测试" }, {
    reputation: 1,
    units: [{ id: "thugs", used: false, wounded: false }],
  });
  const attacking = gameReducer(attackState, { type: "ACTIVATE_UNIT", unitId: "thugs", abilityId: "attack" });
  assert.equal(availableResources(attacking).attack, 3);
  assert.equal(attacking.reputation, 0);

  const damage = { ...attackState, combat: { ...attackState.combat!, step: "damage" as const, damageRemaining: 5 }, turnBonus: { ...attackState.turnBonus, influence: 2 } };
  const absorbed = gameReducer(damage, { type: "ASSIGN_DAMAGE_UNIT", unitId: "thugs" });
  assert.equal(absorbed.spent.influence, 2);
  assert.equal(absorbed.units[0]?.wounded, true);
});

test("Heroes double the Reputation modifier and cannot share an interaction with Thugs", () => {
  const hero = getUnit("heroWhite")!;
  const high = atSite(state({ reputation: 5, ownedKeeps: 4 }), "city1");
  assert.equal(unitRecruitInfluenceCost(high, hero), 0);
  const low = atSite(state({ reputation: -4, ownedKeeps: 4 }), "city1");
  assert.equal(unitRecruitInfluenceCost(low, hero), 20);

  const mixed = atSite(state({
    reputation: -4,
    fame: 35,
    ownedKeeps: 4,
    unitOffer: ["thugs", "heroWhite"],
    turnBonus: { ...state().turnBonus, influence: 30 },
  }), "refugeeCamp");
  const withThugs = gameReducer(mixed, { type: "RECRUIT", unitId: "thugs" });
  const rejectedHero = gameReducer({ ...withThugs, refugeeCampRecruitUsed: false }, { type: "RECRUIT", unitId: "heroWhite" });
  assert.equal(rejectedHero.units.some((unit) => unit.id === "heroWhite"), false);
  assert.match(rejectedHero.log[0], /不能同时招募暴徒与英雄/);
});

test("Magic Familiars use their attached crystal, ignore Reputation in a Glade and require round upkeep", () => {
  const familiar = getUnit("magicFamiliars")!;
  const glade = atSite(state({
    reputation: 5,
    unitOffer: ["magicFamiliars"],
    turnBonus: { ...state().turnBonus, influence: 6 },
    manaTokens: { red: 1, blue: 0, green: 0, white: 0, black: 0 },
  }), "glade");
  assert.equal(unitRecruitInfluenceCost(glade, familiar), 6);
  const recruited = gameReducer(glade, { type: "RECRUIT", unitId: "magicFamiliars", manaColor: "red" });
  assert.equal(recruited.units[0]?.familiarCrystal, "red");
  assert.equal(recruited.spent.influence, 6);
  assert.equal(recruited.actionTaken, true);
  assert.equal(recruited.interactionSite, undefined, "Glade recruitment is not an interaction");

  const combat = inCombat({ id: "familiar-target", name: "敌人", armor: 9, attack: 3, fame: 0, description: "测试" }, {
    units: [{ id: "magicFamiliars", used: false, wounded: false, familiarCrystal: "red" }],
  });
  const attack = gameReducer(combat, { type: "ACTIVATE_UNIT", unitId: "magicFamiliars", abilityId: "attack" });
  assert.equal(availableResources(attack).attack, 5);

  const roundEnd = gameReducer(state({ deck: [], units: [{ id: "magicFamiliars", used: true, wounded: false, familiarCrystal: "red" }] }), { type: "FORFEIT_ROUND" });
  assert.equal(roundEnd.phase, "tactic");
  assert.equal(roundEnd.units[0]?.needsFamiliarCrystal, true);
  assert.equal(roundEnd.units[0]?.familiarCrystal, undefined);
  const blockedTactic = gameReducer(roundEnd, { type: "CHOOSE_TACTIC", tacticId: roundEnd.time === "day" ? "earlyBird" : "fromDusk" });
  assert.equal(blockedTactic.phase, "tactic");
  const replaced = gameReducer(roundEnd, { type: "REPLACE_FAMILIAR_CRYSTAL", unitId: "magicFamiliars", color: "blue" });
  assert.equal(replaced.units[0]?.familiarCrystal, "blue");
  assert.equal(replaced.crystals.blue, roundEnd.crystals.blue - 1);
});

test("Delphana Masters can use each color once against chosen non-immune enemies", () => {
  const first: Enemy = { id: "delphana-a", name: "第一敌人", armor: 8, attack: 2, fame: 0, fortified: true, resistances: ["physical", "fire"], description: "测试" };
  const second: Enemy = { id: "delphana-b", name: "第二敌人", armor: 9, attack: 4, fame: 0, description: "测试" };
  let current = inCombat(first, {
    units: [{ id: "delphanaMasters", used: false, wounded: false }],
    combat: { cellId: "0,0", originId: "0,0", enemy: first, step: "block", blocked: false, queue: [{ cellId: "0,0", enemy: second }] },
  });
  current = gameReducer(current, { type: "ACTIVATE_UNIT", unitId: "delphanaMasters", abilityId: "blue", enemyId: second.id });
  current = gameReducer(current, { type: "ACTIVATE_UNIT", unitId: "delphanaMasters", abilityId: "red", enemyId: first.id });
  current = gameReducer(current, { type: "ACTIVATE_UNIT", unitId: "delphanaMasters", abilityId: "green", enemyId: second.id });
  current = gameReducer(current, { type: "ACTIVATE_UNIT", unitId: "delphanaMasters", abilityId: "white", enemyId: first.id });
  assert.deepEqual(current.units[0]?.usedAbilityIds, ["blue", "red", "green", "white"]);
  assert.ok(current.combat?.cancelledAttackIds?.includes(second.id));
  assert.ok(current.combat?.destroyIfBlockedIds?.includes(first.id));
  assert.equal(current.combat?.armorReductionByEnemyId?.[second.id], 5);
  assert.ok(current.combat?.ignoredResistanceIds?.includes(first.id));
  assert.ok(current.combat?.ignoredFortificationIds?.includes(first.id));
  assert.equal(combatEnemyArmor(current), 8, "white removes resistance/fortification, not printed Armor");
  assert.equal(canActivateUnitAbility(current, "delphanaMasters", "blue", [], first.id), false, "each color is once per combat");

  const immune = inCombat({ ...first, id: "immune", arcaneImmunity: true }, { units: [{ id: "delphanaMasters", used: false, wounded: false }] });
  assert.equal(canActivateUnitAbility(immune, "delphanaMasters", "green", [], "immune"), false);
});
