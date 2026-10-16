import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_CARD_DEFS,
  ALL_ENEMY_TOKENS,
  ALL_HERO_SKILLS,
  ALL_UNIT_DEFS,
  EMPTY_RESOURCES,
  SITE_LABELS,
  type CardDef,
  type CardEffect,
  type Enemy,
  type MapCell,
  type ResourceKey,
} from "../lib/game-data";
import {
  availableResources,
  canActivateUnitAbility,
  combatBlockRequirement,
  combatDamageTotal,
  combatEnemyArmor,
  createGame,
  effectiveAttackValue,
  gameReducer,
  handLimit,
  heroArmor,
  resolveCardEffect,
  type GameAction,
  type GameState,
} from "../lib/game-engine";
import { OPEN_RULE_GAPS, SITE_COVERAGE } from "./rule-coverage-registry";

const RESOURCE_KEYS = Object.keys(EMPTY_RESOURCES) as ResourceKey[];
const COMBAT_KEYS = new Set<ResourceKey>([
  "attack", "fireAttack", "iceAttack", "coldfireAttack",
  "block", "fireBlock", "iceBlock", "coldfireBlock",
  "range", "fireRange", "iceRange", "coldfireRange",
  "siege", "fireSiege", "iceSiege", "coldfireSiege",
]);
const NON_COMBAT_KEYS = new Set<ResourceKey>(["move", "influence", "heal", "draw", "crystal"]);

function cloneResources(patch: Partial<Record<ResourceKey, number>> = {}) {
  return { ...EMPTY_RESOURCES, ...patch };
}

function patchCell(map: MapCell[], id: string, patch: Partial<MapCell>) {
  const [q, r] = id.split(",").map(Number);
  const current = map.find((cell) => cell.id === id);
  const base: MapCell = current ?? { id, q, r, terrain: "plains", site: "none", revealed: true, conquered: false, tokenRevealed: false };
  return [...map.filter((cell) => cell.id !== id), { ...base, ...patch, id, q, r }];
}

function baseState(): GameState {
  const state = createGame("tovak", "standard", "classic", "wedge", 902_010, "ultimate");
  return {
    ...state,
    phase: "planning",
    time: "night",
    hand: [],
    deck: ["march#draw-a", "rage#draw-b", "stamina#draw-c"],
    discard: [],
    played: [],
    spent: cloneResources(),
    turnBonus: cloneResources(),
    source: [{ color: "red" }, { color: "blue" }, { color: "green" }],
    manaTokens: { red: 20, blue: 20, green: 20, white: 20, black: 20 },
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
    skills: [],
    units: [],
    actionTaken: false,
    combat: undefined,
  };
}

function combatState(enemy: Enemy, patch: Partial<GameState> = {}): GameState {
  const state = baseState();
  const cellId = state.position;
  const map = patchCell(state.map, cellId, {
    terrain: "plains",
    site: "none",
    enemies: [enemy],
    enemy,
    conquered: false,
    tokenRevealed: true,
  });
  return {
    ...state,
    ...patch,
    map,
    phase: "combat",
    combat: {
      cellId,
      enemy,
      originId: cellId,
      step: "ranged",
      blocked: false,
      chainStartFame: state.fame,
    },
  };
}

function effectNeedsCombat(effect: CardEffect) {
  const hasCombat = RESOURCE_KEYS.some((key) => COMBAT_KEYS.has(key) && (effect[key] ?? 0) > 0);
  const hasNonCombat = RESOURCE_KEYS.some((key) => NON_COMBAT_KEYS.has(key) && (effect[key] ?? 0) > 0);
  return hasCombat && !hasNonCombat;
}

function cardAction(card: CardDef, instanceId: string, mode: "basic" | "powered", effectChoice?: number): Extract<GameAction, { type: "PLAY_CARD" }> {
  return {
    type: "PLAY_CARD",
    instanceId,
    mode,
    effectChoice,
    ...(card.id === "improvisation" ? { discardInstanceId: "march#improvisation-cost" } : {}),
    ...(card.id === "manaDraw" && mode === "powered" ? { manaDrawDieIndex: 0, manaDrawColor: "blue" as const } : {}),
  };
}

function stateForCard(card: CardDef, effect: CardEffect, instanceId: string) {
  const seed = baseState();
  const hand = card.id === "improvisation" ? [instanceId, "march#improvisation-cost"] : [instanceId];
  if (effectNeedsCombat(effect)) return { ...combatState({ id: "card-dummy", name: "卡牌测试敌人", armor: 99, attack: 1, fame: 0, description: "测试" }), hand };
  return { ...seed, hand };
}

test("coverage registry contains every SiteType exactly once", () => {
  assert.deepEqual(Object.keys(SITE_COVERAGE).sort(), Object.keys(SITE_LABELS).sort());
  for (const [site, contract] of Object.entries(SITE_COVERAGE)) {
    assert.ok(contract.entry.length > 0, `${site} must declare its entry rule`);
    assert.ok(contract.effects.length > 0, `${site} must declare at least one tested effect`);
  }
});

for (const card of Object.values(ALL_CARD_DEFS)) {
  for (const mode of ["basic", "powered"] as const) {
    const printed = card[mode];
    // Non-numeric cards need targets, colours, optional costs or a board state.
    // They are covered in special-card-rules.test.ts instead of being invoked
    // here with an invalid empty selection and mistaken for a numeric effect.
    if (printed.special) continue;
    const branches = printed.choices?.length ? printed.choices.map((choice, index) => ({ index, label: choice.label })) : [{ index: undefined, label: card[`${mode}Label`] }];

    if (printed.choices?.length) {
      test(`card ${card.id}/${mode} rejects an omitted printed choice`, () => {
        const instanceId = `${card.id}#choice-required`;
        const state = stateForCard(card, printed.choices![0].effect, instanceId);
        const next = gameReducer(state, cardAction(card, instanceId, mode));
        assert.equal(next.played.some((play) => play.instanceId === instanceId), false);
        assert.match(next.log[0], /选择|二选一|多选一/);
      });
    }

    for (const branch of branches) {
      test(`card ${card.id}/${mode}${branch.index === undefined ? "" : `/choice-${branch.index + 1}`} — ${branch.label}`, () => {
        const instanceId = `${card.id}#coverage-${mode}-${branch.index ?? 0}`;
        const effect = resolveCardEffect(card, mode, branch.index);
        if (effectNeedsCombat(effect)) {
          const planning = { ...baseState(), hand: card.id === "improvisation" ? [instanceId, "march#improvisation-cost"] : [instanceId] };
          const rejected = gameReducer(planning, cardAction(card, instanceId, mode, branch.index));
          assert.equal(rejected.played.some((item) => item.instanceId === instanceId), false, `${card.id}/${mode} must not bank combat points`);
        }
        const state = stateForCard(card, effect, instanceId);
        const before = availableResources(state);
        const next = gameReducer(state, cardAction(card, instanceId, mode, branch.index));
        const play = next.played.find((item) => item.instanceId === instanceId);
        assert.ok(play, `${card.name} ${mode} branch was rejected: ${next.log[0]}`);
        const after = availableResources(next);
        for (const key of RESOURCE_KEYS) {
          assert.equal(after[key] - before[key], effect[key] ?? 0, `${card.id}/${mode}/${branch.index ?? 0} ${key}`);
        }
        assert.equal(play.effectChoice, branch.index);
        if (card.id === "improvisation") {
          assert.equal(next.hand.includes("march#improvisation-cost"), false);
          assert.equal(next.discard.includes("march#improvisation-cost"), true);
        }
        if (card.tier === "spell") {
          assert.equal(next.manaTokens[card.color as "red" | "blue" | "green" | "white"], state.manaTokens[card.color as "red" | "blue" | "green" | "white"] - 1);
          if (mode === "powered") assert.equal(next.manaTokens.black, state.manaTokens.black - 1);
        } else if (mode === "powered" && card.tier !== "artifact") {
          assert.equal(next.manaTokens[card.color as "red" | "blue" | "green" | "white"], state.manaTokens[card.color as "red" | "blue" | "green" | "white"] - 1);
        }
        const unplayed = gameReducer(next, { type: "UNPLAY_CARD", instanceId });
        assert.equal(unplayed.played.some((item) => item.instanceId === instanceId), false, `${card.id}/${mode} direct undo`);
        for (const key of RESOURCE_KEYS) assert.equal(availableResources(unplayed)[key], before[key], `${card.id}/${mode} undo ${key}`);
        assert.deepEqual(unplayed.manaTokens, state.manaTokens, `${card.id}/${mode} undo mana`);
        assert.deepEqual(unplayed.crystals, state.crystals, `${card.id}/${mode} undo crystals`);
      });
    }
  }

  test(`card ${card.id} supports all four legal sideways resources at their proper timing`, () => {
    for (const resource of ["move", "influence"] as const) {
      const instanceId = `${card.id}#side-${resource}`;
      const state = { ...baseState(), hand: [instanceId] };
      const next = gameReducer(state, { type: "PLAY_CARD", instanceId, mode: "sideways", sideResource: resource });
      assert.equal(next.played.length, 1, `${card.id} sideways ${resource}`);
      assert.equal(availableResources(next)[resource], 1);
    }
    for (const resource of ["attack", "block"] as const) {
      const instanceId = `${card.id}#side-${resource}`;
      const planning = { ...baseState(), hand: [instanceId] };
      const rejected = gameReducer(planning, { type: "PLAY_CARD", instanceId, mode: "sideways", sideResource: resource });
      assert.equal(rejected.played.length, 0, `${card.id} must not bank sideways ${resource} before combat`);
      const inCombat = { ...combatState({ id: "side-dummy", name: "横置测试敌人", armor: 99, attack: 1, fame: 0, description: "测试" }), hand: [instanceId] };
      const accepted = gameReducer(inCombat, { type: "PLAY_CARD", instanceId, mode: "sideways", sideResource: resource });
      assert.equal(accepted.played.length, 1, `${card.id} sideways ${resource} in combat`);
      assert.equal(availableResources(accepted)[resource], 1);
    }
  });
}

for (const card of Object.values(ALL_CARD_DEFS).filter((item) => item.tier === "artifact" && !item.basic.special && !item.powered.special)) {
  test(`artifact ${card.id} is removed only after its powered effect is committed`, () => {
    const instanceId = `${card.id}#artifact-removal`;
    const effect = resolveCardEffect(card, "powered");
    const state = {
      ...stateForCard(card, effect, instanceId),
      artifacts: 1,
      artifactInventory: [card.name],
    };
    const played = gameReducer(state, cardAction(card, instanceId, "powered"));
    assert.ok(played.played.some((item) => item.instanceId === instanceId));
    assert.equal(played.removedCards.includes(instanceId), false);
    const ended = gameReducer({ ...played, phase: "planning", combat: undefined }, { type: "END_TURN" });
    assert.equal(ended.removedCards.includes(instanceId), true);
    assert.equal(ended.discard.includes(instanceId), false);
    assert.equal(ended.artifactInventory.includes(card.name), false);

    const basicInstanceId = `${card.id}#artifact-basic`;
    const basicState = {
      ...stateForCard(card, resolveCardEffect(card, "basic"), basicInstanceId),
      artifacts: 1,
      artifactInventory: [card.name],
    };
    const basicPlayed = gameReducer(basicState, cardAction(card, basicInstanceId, "basic"));
    assert.ok(basicPlayed.played.some((item) => item.instanceId === basicInstanceId));
    const basicEnded = gameReducer({ ...basicPlayed, phase: "planning", combat: undefined }, { type: "END_TURN" });
    assert.equal(basicEnded.removedCards.includes(basicInstanceId), false);
    assert.equal(basicEnded.discard.includes(basicInstanceId), true);
    assert.equal(basicEnded.artifactInventory.includes(card.name), true);
  });
}

for (const unit of Object.values(ALL_UNIT_DEFS)) {
  test(`unit ${unit.id} has a complete selectable ability surface`, () => {
    assert.ok(unit.abilities?.length, `${unit.name} has no explicit abilities`);
    assert.equal(new Set(unit.abilities!.map((ability) => ability.id)).size, unit.abilities!.length);
  });

  for (const ability of unit.abilities ?? []) {
    test(`unit ${unit.id}/${ability.id} — ${ability.label}`, () => {
      const specialCombat = Boolean(ability.cancelEnemyAttack || ability.removeSwift || ability.armorReduction || ability.transformAttacks || ability.delphanaEffect);
      const combatEffect = ability.effect ? effectNeedsCombat(ability.effect) : false;
      let state = specialCombat || combatEffect
        ? combatState({ id: "unit-target", name: "盟军测试敌人", armor: 8, attack: 3, fame: 0, swift: true, description: "测试" })
        : baseState();
      const helperId = unit.id === "peasants" ? "herbalists" : "peasants";
      state = {
        ...state,
        units: [
          { id: unit.id, used: false, wounded: false, wounds: 0 },
          ...(ability.readyUnitMaxLevel ? [{ id: helperId, used: true, wounded: false, wounds: 0 }] : []),
        ],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      };
      const manaColors = ability.gainManaChoiceCount
        ? (["red", "blue"] as const).slice(0, ability.gainManaChoiceCount)
        : ability.manaChoiceCount
          ? (["red", "blue"] as const).filter((color) => ability.manaChoiceColors?.includes(color)).slice(0, ability.manaChoiceCount)
          : [];
      const enemyId = ability.delphanaEffect ? "unit-target" : undefined;
      const before = availableResources(state);
      if (combatEffect) {
        const planning = { ...baseState(), units: [{ id: unit.id, used: false, wounded: false, wounds: 0 }] };
        assert.equal(canActivateUnitAbility(planning, unit.id, ability.id), false, `${unit.id}/${ability.id} must not bank combat resources`);
      }
      assert.equal(canActivateUnitAbility(state, unit.id, ability.id, [...manaColors], enemyId), true, `${unit.id}/${ability.id} precondition`);
      const next = gameReducer(state, { type: "ACTIVATE_UNIT", unitId: unit.id, abilityId: ability.id, manaColors: [...manaColors], enemyId });
      const activated = next.units.find((item) => item.id === unit.id);
      assert.equal(activated?.used, true);
      assert.equal(activated?.selectedAbilityId, ability.id);
      const after = availableResources(next);
      for (const key of RESOURCE_KEYS) assert.equal(after[key] - before[key], ability.effect?.[key] ?? 0, `${unit.id}/${ability.id} ${key}`);
      for (const color of ability.gainMana ?? []) assert.equal(next.manaTokens[color], state.manaTokens[color] + 1);
      if (ability.gainManaChoiceCount) for (const color of manaColors) assert.equal(next.manaTokens[color], state.manaTokens[color] + 1);
      for (const color of ability.gainCrystal ?? []) assert.equal(next.crystals[color], 1);
      if (ability.woundSelf) assert.equal(activated?.wounded, true);
      if (ability.readyUnitMaxLevel) assert.equal(next.units.find((item) => item.id === helperId)?.used, false);
      if (ability.removeSwift) assert.ok(next.combat?.swiftIgnoredIds?.includes("unit-target"));
      if (ability.cancelEnemyAttack) assert.ok(next.combat?.cancelledAttackIds?.includes("unit-target"));
      if (ability.armorReduction) assert.equal(next.combat?.armorReductionByEnemyId?.["unit-target"], ability.armorReduction);
      if (ability.transformAttacks) assert.equal(next.combat?.attackTransform, ability.transformAttacks);
      if (ability.allUnitResistances) assert.equal(next.allUnitResistances, true);
      for (const terrain of ability.terrainDiscount ?? []) assert.ok(next.terrainDiscounts?.includes(terrain));
    });
  }
}

for (const skill of Object.values(ALL_HERO_SKILLS).flat()) {
  test(`hero skill ${skill.id} — ${skill.description}`, () => {
    const plain = { ...baseState(), skills: [skill.id] };
    const resources = availableResources(plain);
    if (!skill.special) for (const key of RESOURCE_KEYS) assert.equal(resources[key], skill.requiresWound ? 0 : (skill.resource?.[key] ?? 0), `${skill.id} ${key}`);
    assert.equal(heroArmor(plain), 2 + (skill.armor ?? 0));
    assert.equal(handLimit(plain), 5 + (skill.hand ?? 0));
    if (skill.requiresWound) {
      const withoutWound = availableResources(plain);
      const withWound = availableResources({ ...plain, hand: ["wound#skill-condition"] });
      for (const key of RESOURCE_KEYS) assert.equal(withWound[key] - withoutWound[key], skill.resource?.[key] ?? 0, `${skill.id} wound gate ${key}`);
    }
  });
}

for (const enemy of ALL_ENEMY_TOKENS) {
  test(`enemy ${enemy.id} — stats, elements, resistances and declarative traits`, () => {
    const state = combatState(enemy);
    assert.equal(combatEnemyArmor(state), enemy.elusiveArmor ?? enemy.armor);
    assert.equal(combatBlockRequirement({ ...state, combat: { ...state.combat!, step: "block" } }), enemy.attack * (enemy.swift ? 2 : 1), "each printed attack is blocked separately");
    assert.equal(combatDamageTotal(state), enemy.attack * (enemy.brutal ? 2 : 1), "each unblocked printed attack deals damage separately");

    for (const [element, key] of [
      ["physical", "attack"],
      ["fire", "fireAttack"],
      ["ice", "iceAttack"],
      ["coldfire", "coldfireAttack"],
    ] as const) {
      const probe = { ...state, turnBonus: cloneResources({ [key]: 10 }) };
      const resisted = element === "coldfire"
        ? enemy.resistances?.includes("fire") && enemy.resistances?.includes("ice")
        : enemy.resistances?.includes(element);
      assert.equal(effectiveAttackValue(probe, enemy, "attack"), resisted ? 5 : 10, `${enemy.id} ${element} resistance`);
    }

    const rangeProbe = { ...state, turnBonus: cloneResources({ range: 20 }) };
    const siegeProbe = { ...state, turnBonus: cloneResources({ siege: 20 }) };
    if (enemy.fortified) {
      assert.equal(effectiveAttackValue(rangeProbe, enemy, "ranged"), 0);
      assert.ok(effectiveAttackValue(siegeProbe, enemy, "ranged") > 0);
    }
  });
}

test("every printed Defend value is assigned to one distinct living enemy", () => {
  for (const defender of ALL_ENEMY_TOKENS.filter((enemy) => (enemy.defend ?? 0) > 0)) {
    const target: Enemy = { id: `target-${defender.id}`, name: "被保护目标", armor: 4, attack: 1, fame: 0, description: "测试" };
    const state = combatState(target);
    const map = patchCell(state.map, state.position, { enemies: [target, defender], enemy: target });
    const assigned = gameReducer({ ...state, map, combat: { ...state.combat!, queue: [{ cellId: state.position, enemy: defender }] } }, { type: "ASSIGN_DEFEND", defenderId: defender.id, targetId: target.id });
    assert.equal(combatEnemyArmor(assigned), 4 + defender.defend!);
  }
});

test("Multiple Attacks are separate blocks/damage assignments and surplus Block never carries over", () => {
  const enemy: Enemy = { id: "three-independent-attacks", name: "九头蛇", armor: 7, attack: 3, attackCount: 3, brutal: true, fame: 7, description: "三次独立残暴攻击" };
  let state = combatState(enemy);
  state = { ...state, combat: { ...state.combat!, step: "block" }, turnBonus: cloneResources({ block: 9 }) };
  assert.equal(combatBlockRequirement(state), 3);
  assert.equal(combatDamageTotal(state), 6);
  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  assert.equal(state.combat?.step, "block");
  assert.equal(state.combat?.attackIndex, 1);
  assert.equal(combatBlockRequirement(state), 3);
  assert.equal(availableResources(state).block, 6);
  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  assert.equal(state.combat?.attackIndex, 2);
  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  assert.equal(state.combat?.step, "attack");
  assert.ok(state.combat?.successfullyBlockedEnemyIds?.includes(enemy.id));
});

test("cancelling one Multiple Attack does not cancel the remaining printed attacks or count as fully blocking the enemy", () => {
  const enemy: Enemy = { id: "partially-cancelled", name: "散兵", armor: 4, attack: 3, attackCount: 2, fame: 4, description: "两次攻击" };
  let state = combatState(enemy);
  state = { ...state, combat: { ...state.combat!, step: "block", cancelledAttackCountsByEnemyId: { [enemy.id]: 1 } }, turnBonus: cloneResources({ block: 3 }) };
  assert.equal(combatBlockRequirement(state), 3);
  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  assert.equal(state.combat?.step, "attack");
  assert.equal(state.combat?.successfullyBlockedEnemyIds?.includes(enemy.id), false);
});

test("every cumbersome enemy can spend Move to reduce both block requirement and damage", () => {
  for (const enemy of ALL_ENEMY_TOKENS.filter((item) => item.cumbersome)) {
    const state = { ...combatState(enemy), combat: { ...combatState(enemy).combat!, step: "block" as const }, turnBonus: cloneResources({ move: 1 }) };
    const blockBefore = combatBlockRequirement(state);
    const damageBefore = combatDamageTotal(state);
    const next = gameReducer(state, { type: "COMBAT_REDUCE_CUMBERSOME" });
    assert.equal(combatBlockRequirement(next), blockBefore - 1, enemy.id);
    assert.equal(combatDamageTotal(next), damageBefore - 1, enemy.id);
  }
});

for (const gap of OPEN_RULE_GAPS) test.todo(`[RULE GAP] ${gap.id} — ${gap.title}: ${gap.reason}`);
