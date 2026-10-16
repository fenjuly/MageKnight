import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_RESOURCES, getSpellIdsForMode, type Enemy, type MapCell, type ResourceKey } from "../lib/game-data";
import {
  availableResources,
  combatBlockRequirement,
  createGame,
  effectiveAttackValue,
  effectiveBlockValue,
  gameReducer,
  terrainMoveCost,
  type CardPlaySelection,
  type GameState,
} from "../lib/game-engine";

function resources(patch: Partial<Record<ResourceKey, number>> = {}) {
  return { ...EMPTY_RESOURCES, ...patch };
}

function state(patch: Partial<GameState> = {}): GameState {
  const base = createGame("tovak", "standard", "classic", "wedge", 44_001, "ultimate");
  return {
    ...base,
    phase: "planning",
    time: "night",
    hand: [],
    deck: ["rage#draw", "march#draw", "stamina#draw"],
    discard: [],
    played: [],
    spent: resources(),
    turnBonus: resources(),
    source: [{ color: "red" }, { color: "blue" }, { color: "green" }, { color: "white" }],
    manaTokens: { red: 10, blue: 10, green: 10, white: 10, black: 10 },
    crystals: { red: 1, blue: 1, green: 1, white: 1 },
    units: [],
    skills: [],
    actionTaken: false,
    combat: undefined,
    ...patch,
  };
}

function combatState(enemy: Enemy, patch: Partial<GameState> = {}): GameState {
  const base = state();
  const { combat: combatPatch, ...rest } = patch;
  const map = base.map.map((cell) => cell.id === base.position
    ? { ...cell, revealed: true, tokenRevealed: true, enemies: [enemy], enemy }
    : cell);
  return state({
    ...rest,
    map,
    phase: "combat",
    combat: {
      cellId: base.position,
      originId: base.position,
      enemy,
      step: "ranged",
      blocked: false,
      chainStartFame: base.fame,
      ...combatPatch,
    },
  });
}

function play(base: GameState, instanceId: string, mode: "basic" | "powered", selection?: CardPlaySelection, effectChoice?: number) {
  return gameReducer(base, { type: "PLAY_CARD", instanceId, mode, selection, effectChoice });
}

function assertUndo(restored: GameState, original: GameState, instanceId: string) {
  const undone = gameReducer(restored, { type: "UNPLAY_CARD", instanceId });
  assert.equal(undone.played.some((item) => item.instanceId === instanceId), false);
  assert.deepEqual(undone.manaTokens, original.manaTokens);
  assert.deepEqual(undone.crystals, original.crystals);
  assert.deepEqual(undone.hand, original.hand);
  assert.deepEqual(undone.discard, original.discard);
  assert.deepEqual(undone.removedCards, original.removedCards);
  assert.deepEqual(undone.source, original.source);
}

test("Concentration and Will Focus require their printed choice and resolve a second Action as one committed play", () => {
  for (const [cardId, expected] of [["concentration", 6], ["willFocus", 7]] as const) {
    const instanceId = `${cardId}#focus`;
    const original = state({ hand: [instanceId, "march#target"] });
    const missing = play(original, instanceId, "powered");
    assert.equal(missing.played.length, 0);
    const next = play(original, instanceId, "powered", { cardInstanceId: "march#target" });
    assert.equal(availableResources(next).move, expected);
    assert.equal(next.played[0]?.linkedCard?.instanceId, "march#target");
    assert.equal(play(next, "march#target", "basic"), next, "linked Action cannot be played again");
    assertUndo(next, original, instanceId);
  }

  const concentration = state({ hand: ["concentration#mana"] });
  const mana = play(concentration, "concentration#mana", "basic", { manaColors: ["red"] });
  assert.equal(mana.manaTokens.red, concentration.manaTokens.red + 1);
  assertUndo(mana, concentration, "concentration#mana");

  const will = state({ hand: ["willFocus#crystal"] });
  const crystal = play(will, "willFocus#crystal", "basic", { option: "green-crystal" });
  assert.equal(crystal.crystals.green, will.crystals.green + 1);
  assertUndo(crystal, will, "willFocus#crystal");
});

test("Noble Manners grants its delayed Fame/Reputation only when used in an interaction", () => {
  const original = state({ hand: ["nobleManners#noble"], fame: 7, reputation: 0, interactionSite: "0,0" });
  const played = play(original, "nobleManners#noble", "powered");
  assert.equal(availableResources(played).influence, 4);
  const ended = gameReducer(played, { type: "END_TURN" });
  assert.equal(ended.fame, 8);
  assert.equal(ended.reputation, 1);

  const noInteraction = play(state({ hand: ["nobleManners#plain"], fame: 7 }), "nobleManners#plain", "basic");
  assert.equal(gameReducer(noInteraction, { type: "END_TURN" }).fame, 7);
});

test("Mana Pull handles the extra Source allowance and the two-die strong effect reversibly", () => {
  const basic = state({ hand: ["manaPull#basic", "march#one", "promise#two"] });
  let next = play(basic, "manaPull#basic", "basic");
  next = play(next, "march#one", "powered");
  next = play(next, "promise#two", "powered");
  assert.equal(next.played.length, 3, "the basic effect permits a second ordinary Source use");

  const original = state({ hand: ["manaPull#strong"], source: [{ color: "gold" }, { color: "black" }, { color: "green" }] });
  const strong = play(original, "manaPull#strong", "powered", { sourceDieIndices: [0, 1], manaColors: ["red", "blue"] });
  assert.deepEqual(strong.source.slice(0, 2), [{ color: "red" }, { color: "blue" }]);
  assert.equal(strong.manaTokens.red, original.manaTokens.red + 1);
  assert.equal(strong.manaTokens.blue, original.manaTokens.blue, "one blue pays for the powered Action and one is generated");
  assertUndo(strong, original, "manaPull#strong");
});

test("Blood Rage and Blood Ritual apply optional/mandatory Wounds, mana and crystals exactly", () => {
  const enemy = { id: "dummy", name: "dummy", armor: 20, attack: 1, fame: 0, description: "" };
  const originalRage = combatState(enemy, { hand: ["bloodRage#rage"] });
  const safe = play(originalRage, "bloodRage#rage", "basic", { takeWound: false });
  assert.equal(availableResources(safe).attack, 2);
  const wounded = play(originalRage, "bloodRage#rage", "basic", { takeWound: true });
  assert.equal(availableResources(wounded).attack, 5);
  assert.equal(wounded.hand.filter((id) => id.startsWith("wound#")).length, 1);
  assertUndo(wounded, originalRage, "bloodRage#rage");

  const ritual = state({ hand: ["bloodRitual#ritual"], crystals: { red: 0, blue: 0, green: 0, white: 0 } });
  const basic = play(ritual, "bloodRitual#ritual", "basic", { manaColors: ["white"] });
  assert.equal(basic.crystals.red, 1);
  assert.equal(basic.manaTokens.white, ritual.manaTokens.white + 1);
  assert.equal(basic.hand.filter((id) => id.startsWith("wound#")).length, 1);
  assertUndo(basic, ritual, "bloodRitual#ritual");

  const strong = play(ritual, "bloodRitual#ritual", "powered", { option: "crystallize", manaColors: ["green", "green", "black"] });
  assert.equal(strong.crystals.green, 1);
  assert.equal(strong.manaTokens.green, ritual.manaTokens.green + 1);
  assert.equal(strong.manaTokens.black, ritual.manaTokens.black + 1);
});

test("Pure Magic maps each paid colour to the correct resource and Intimidate always lowers Reputation", () => {
  const expected = { green: "move", white: "influence", blue: "block", red: "attack" } as const;
  for (const [color, resource] of Object.entries(expected) as Array<[keyof typeof expected, typeof expected[keyof typeof expected]]>) {
    const enemy = { id: `dummy-${color}`, name: "dummy", armor: 20, attack: 1, fame: 0, description: "" };
    const original = resource === "attack" || resource === "block"
      ? combatState(enemy, { hand: ["pureMagic#pure"] })
      : state({ hand: ["pureMagic#pure"] });
    const next = play(original, "pureMagic#pure", "basic", { manaColors: [color] });
    assert.equal(availableResources(next)[resource], 4);
    assert.equal(next.manaTokens[color], original.manaTokens[color] - 1);
  }

  const original = state({ hand: ["intimidate#fear"], reputation: 2 });
  const influenced = play(original, "intimidate#fear", "powered", undefined, 0);
  assert.equal(availableResources(influenced).influence, 8);
  assert.equal(influenced.reputation, 0);
  assertUndo(influenced, original, "intimidate#fear");
});

test("Frost Bridge, Song of Wind and Path Finding alter actual terrain costs", () => {
  const frost = play(state({ hand: ["frostBridge#frost"] }), "frostBridge#frost", "powered");
  assert.equal(terrainMoveCost(frost, "swamp"), 1);
  assert.equal(terrainMoveCost(frost, "lake"), 1);

  const windOriginal = state({ hand: ["songOfWind#wind"] });
  const wind = play(windOriginal, "songOfWind#wind", "powered", { option: "lake" });
  assert.equal(terrainMoveCost(wind, "plains"), 0);
  assert.equal(terrainMoveCost(wind, "desert"), 1);
  assert.equal(terrainMoveCost(wind, "lake"), 0);

  const path = play(state({ hand: ["pathfinding#path"] }), "pathfinding#path", "powered");
  assert.equal(terrainMoveCost(path, "forest"), 2);
  assert.equal(terrainMoveCost(path, "desert"), 2);
  assert.equal(terrainMoveCost(path, "mountain"), Infinity);
});

test("Into the Heat modifies only participating Unit combat abilities and forbids assigning damage", () => {
  const enemy = { id: "heat-dummy", name: "dummy", armor: 20, attack: 3, fame: 0, description: "" };
  const original = combatState(enemy, {
    hand: ["intoTheHeat#heat"],
    units: [{ id: "peasants", used: true, wounded: false, selectedAbilityId: "attack" }],
  });
  const next = play(original, "intoTheHeat#heat", "powered");
  assert.equal(availableResources(next).attack, 5);
  const damage = { ...next, combat: { ...next.combat!, step: "damage" as const, damageRemaining: 3 } };
  const rejected = gameReducer(damage, { type: "ASSIGN_DAMAGE_UNIT", unitId: "peasants" });
  assert.equal(rejected.units[0].wounded, false);
  assert.match(rejected.log[0], /投身战火/);
});

test("Diplomacy converts Influence into the selected Block element and In Need counts every Wound", () => {
  const fireEnemy = { id: "fire", name: "fire", armor: 20, attack: 4, attackElement: "fire" as const, fame: 0, description: "" };
  const original = combatState(fireEnemy, { hand: ["diplomacy#dip"] });
  const basic = play(original, "diplomacy#dip", "basic");
  assert.equal(effectiveBlockValue({ ...basic, combat: { ...basic.combat!, step: "block" } }), 1, "physical block is inefficient against fire");
  const strong = play(combatState(fireEnemy, { hand: ["diplomacy#dip"] }), "diplomacy#dip", "powered", { option: "ice" });
  assert.equal(effectiveBlockValue({ ...strong, combat: { ...strong.combat!, step: "block" } }), 4);

  const need = state({
    hand: ["inNeed#need", "wound#hand"],
    units: [{ id: "peasants", used: false, wounded: true, wounds: 2 }],
  });
  assert.equal(availableResources(play(need, "inNeed#need", "powered")).influence, 11);
});

test("Decompose, Crystal Mastery and Mana Storm mutate inventory/Source and remain reversible", () => {
  const decomposed = state({ hand: ["decompose#dec", "march#green"], crystals: { red: 0, blue: 0, green: 0, white: 0 } });
  const basic = play(decomposed, "decompose#dec", "basic", { cardInstanceId: "march#green" });
  assert.equal(basic.crystals.green, 2);
  assert.equal(basic.removedCards.includes("march#green"), true);
  assertUndo(basic, decomposed, "decompose#dec");

  const mastery = state({ hand: ["crystalMastery#master"], crystals: { red: 0, blue: 1, green: 0, white: 0 } });
  const gained = play(mastery, "crystalMastery#master", "basic", { manaColors: ["blue"] });
  assert.equal(gained.crystals.blue, 2);
  assertUndo(gained, mastery, "crystalMastery#master");

  const storm = state({ hand: ["manaStorm#storm"], source: [{ color: "red" }, { color: "gold" }] });
  const changed = play(storm, "manaStorm#storm", "basic", { sourceDieIndices: [0] });
  assert.equal(changed.crystals.red, storm.crystals.red + 1);
  assert.notEqual(changed.source[0].color, "red");
  assertUndo(changed, storm, "manaStorm#storm");
});

test("Maximal Effect, Magic Talent and Training move their selected cards between the correct zones", () => {
  const maximal = state({ hand: ["maximalEffect#max", "march#target"] });
  const tripled = play(maximal, "maximalEffect#max", "basic", { cardInstanceId: "march#target" });
  assert.equal(availableResources(tripled).move, 6);
  const endedMax = gameReducer(tripled, { type: "END_TURN" });
  assert.equal(endedMax.removedCards.includes("march#target"), true);

  const talent = state({
    hand: ["magicTalent#talent", "determination#blue"],
    spellOffer: ["blizzard"],
    spellDeck: ["firestorm"],
  });
  const cast = play(talent, "magicTalent#talent", "basic", { cardId: "blizzard", cardInstanceId: "determination#blue" });
  assert.equal(cast.discard.includes("determination#blue"), true);
  assert.equal(availableResources(cast).iceBlock, 7);
  assert.equal(cast.spellOffer.includes("blizzard"), true);

  const training = state({
    hand: ["training#training", "march#green"],
    advancedOffer: ["pathfinding"],
    advancedDeck: ["fireBolt"],
  });
  const learned = play(training, "training#training", "powered", { cardInstanceId: "march#green", cardId: "pathfinding" });
  assert.equal(learned.removedCards.includes("march#green"), true);
  assert.equal(learned.hand.some((id) => id.startsWith("pathfinding#")), true);
  assert.equal(learned.advancedOffer.includes("fireBolt"), true);
});

test("Steady Tempo returns to the printed deck position and does not disappear when the deck is empty", () => {
  const basic = play(state({ hand: ["steadyTempo#base"], deck: ["rage#top"] }), "steadyTempo#base", "basic");
  const endedBasic = gameReducer(basic, { type: "END_TURN" });
  assert.equal(endedBasic.hand.includes("steadyTempo#base") || endedBasic.deck.at(-1) === "steadyTempo#base", true);
  assert.equal(endedBasic.discard.includes("steadyTempo#base"), false);

  const powered = play(state({ hand: ["steadyTempo#strong"], deck: ["rage#top"] }), "steadyTempo#strong", "powered");
  const endedStrong = gameReducer(powered, { type: "END_TURN" });
  assert.equal(endedStrong.hand.includes("steadyTempo#strong") || endedStrong.deck.includes("steadyTempo#strong"), true);

  const empty = play(state({ hand: ["steadyTempo#empty"], deck: [] }), "steadyTempo#empty", "basic");
  const endedEmpty = gameReducer(empty, { type: "END_TURN" });
  assert.equal(endedEmpty.discard.includes("steadyTempo#empty"), true);
});

function simpleMap(cells: Array<Partial<MapCell> & Pick<MapCell, "id" | "q" | "r">>): MapCell[] {
  return cells.map((cell) => ({ terrain: "plains", site: "none", revealed: true, conquered: false, tokenRevealed: true, ...cell }));
}

test("Underground Travel traverses up to three legal revealed spaces; its strong effect begins an unfortified-site assault", () => {
  const map = simpleMap([
    { id: "0,0", q: 0, r: 0 },
    { id: "1,0", q: 1, r: 0 },
    { id: "2,0", q: 2, r: 0 },
    { id: "3,0", q: 3, r: 0 },
  ]);
  const original = state({ position: "0,0", map, hand: ["undergroundTravel#travel"] });
  const travelled = play(original, "undergroundTravel#travel", "basic", { cellIds: ["1,0", "2,0", "3,0"] });
  assert.equal(travelled.position, "3,0");
  assert.equal(travelled.actionTaken, false);
  assertUndo(travelled, original, "undergroundTravel#travel");

  const guard: Enemy = { id: "guard", name: "guard", armor: 5, attack: 3, fame: 2, fortified: true, fortificationLevel: 2, description: "" };
  const assaultMap = simpleMap([
    { id: "0,0", q: 0, r: 0 },
    { id: "1,0", q: 1, r: 0, site: "keep", enemies: [guard], enemy: guard },
  ]);
  const assault = play(state({ position: "0,0", map: assaultMap, hand: ["undergroundTravel#attack"] }), "undergroundTravel#attack", "powered", { cellIds: ["1,0"] });
  assert.equal(assault.phase, "combat");
  assert.equal(assault.combat?.ignoreSiteFortification, true);
  assert.equal(assault.combat?.originId, "0,0");
});

test("Burning/Exploding Shield require the Block phase and trigger only after a successful block", () => {
  const enemy: Enemy = { id: "shield-enemy", name: "enemy", armor: 4, attack: 4, fame: 2, description: "" };
  const original = combatState(enemy, { hand: ["burningShield#shield"], combat: { ...combatState(enemy).combat!, step: "block" } });
  const burning = play(original, "burningShield#shield", "basic");
  assert.equal(availableResources(burning).fireBlock, 4);
  const blocked = gameReducer(burning, { type: "COMBAT_BLOCK" });
  assert.equal(blocked.combat?.step, "attack");
  assert.equal(availableResources(blocked).fireAttack, 4);

  const exploding = play(combatState(enemy, { hand: ["burningShield#boom"], combat: { ...combatState(enemy).combat!, step: "block" } }), "burningShield#boom", "powered");
  const marked = gameReducer(exploding, { type: "COMBAT_BLOCK" });
  assert.equal(marked.combat?.destroyedBySpellIds?.includes(enemy.id), true);
  const destroyed = gameReducer(marked, { type: "COMBAT_ATTACK" });
  assert.equal(destroyed.fame, marked.fame + enemy.fame);
});

test("Chill obeys Ice resistance, cancels attacks and Lethal Chill reduces only the chosen Armor", () => {
  const enemy: Enemy = { id: "chill-target", name: "target", armor: 7, attack: 6, fame: 2, description: "" };
  const original = combatState(enemy, { hand: ["chill#chill"] });
  const chilled = play(original, "chill#chill", "powered", { enemyIds: [enemy.id] });
  assert.equal(chilled.combat?.cancelledAttackIds?.includes(enemy.id), true);
  assert.equal(chilled.combat?.armorReductionByEnemyId?.[enemy.id], 4);

  const resistant = { ...enemy, id: "ice-resistant", resistances: ["ice" as const] };
  const rejected = play(combatState(resistant, { hand: ["chill#resist"] }), "chill#resist", "basic", { enemyIds: [resistant.id] });
  assert.equal(rejected.played.length, 0);
  assert.match(rejected.log[0], /抗性/);
});

test("Wings spends existing Move for flight/cancelled additional attacks", () => {
  const map = simpleMap([{ id: "0,0", q: 0, r: 0 }, { id: "1,0", q: 1, r: 0 }, { id: "2,0", q: 2, r: 0 }]);
  const original = state({ position: "0,0", map, hand: ["wings#wind"], turnBonus: resources({ move: 2 }) });
  const flown = play(original, "wings#wind", "basic", { cellIds: ["1,0", "2,0"] });
  assert.equal(flown.position, "2,0");
  assert.equal(flown.spent.move, 2);

  const a: Enemy = { id: "wing-a", name: "a", armor: 4, attack: 4, fame: 1, description: "" };
  const b: Enemy = { id: "wing-b", name: "b", armor: 4, attack: 4, fame: 1, description: "" };
  const combat = combatState(a, { hand: ["wings#night"], turnBonus: resources({ move: 1 }), combat: { ...combatState(a).combat!, queue: [{ cellId: "0,0", enemy: b }] } });
  const night = play(combat, "wings#night", "powered", { enemyIds: [a.id, b.id] });
  assert.deepEqual(new Set(night.combat?.cancelledAttackIds), new Set([a.id, b.id]));
  assert.equal(night.spent.move, 1);
});

test("Demolish ignores site fortification/reduces susceptible Armor and Disintegrate marks exactly one target for destruction", () => {
  const enemy: Enemy = { id: "demolish-a", name: "a", armor: 6, attack: 3, fame: 1, fortified: true, fortificationLevel: 2, description: "" };
  const basic = play(combatState(enemy, { hand: ["demolish#base"] }), "demolish#base", "basic");
  assert.equal(basic.combat?.ignoreSiteFortification, true);
  assert.equal(basic.combat?.armorReductionByEnemyId?.[enemy.id], 1);

  const attackState = combatState(enemy, { hand: ["demolish#strong"], combat: { ...combatState(enemy).combat!, step: "attack" } });
  const strong = play(attackState, "demolish#strong", "powered", { enemyIds: [enemy.id] });
  assert.equal(strong.combat?.destroyedBySpellIds?.includes(enemy.id), true);
  assert.equal(gameReducer(strong, { type: "COMBAT_ATTACK" }).fame, strong.fame + enemy.fame);
});

test("Space Bending treats distance two as adjacent; Time Bending returns other plays, skips draw and grants an immediate turn", () => {
  const map = simpleMap([{ id: "0,0", q: 0, r: 0 }, { id: "1,0", q: 1, r: 0 }, { id: "2,0", q: 2, r: 0 }]);
  let bent = play(state({ position: "0,0", map, hand: ["spaceBending#space"], turnBonus: resources({ move: 2 }) }), "spaceBending#space", "basic");
  bent = gameReducer(bent, { type: "MAP_CLICK", cellId: "2,0" });
  assert.equal(bent.position, "2,0");

  let time = state({ hand: ["spaceBending#time", "march#return"], deck: ["rage#stay"] });
  time = play(time, "march#return", "basic");
  time = play(time, "spaceBending#time", "powered");
  const extra = gameReducer(time, { type: "END_TURN" });
  assert.equal(extra.hand.includes("march#return"), true);
  assert.equal(extra.hand.includes("rage#stay"), false, "draw step is skipped");
  assert.equal(extra.roundSetAsideCards?.includes("spaceBending#time"), true);
  assert.equal(extra.phase, "planning");
});

test("Call to Arms borrows one offered Unit ability; Call to Glory recruits for free with Command-limit disbanding", () => {
  const borrowed = state({ hand: ["callToArms#call"], unitOffer: ["peasants"] });
  const called = play(borrowed, "callToArms#call", "basic", { unitId: "peasants", option: "move" });
  assert.equal(availableResources(called).move, 2);
  assert.equal(called.unitOffer.includes("peasants"), true);

  const glory = state({ hand: ["callToArms#glory"], unitOffer: ["peasants"], units: [] });
  const recruited = play(glory, "callToArms#glory", "powered", { unitId: "peasants" });
  assert.equal(recruited.units.some((unit) => unit.id === "peasants"), true);
  assert.equal(recruited.unitOffer.includes("peasants"), false);
});

test("Meditation puts exactly two discard cards together on the chosen end and draws two beyond the limit at end of turn", () => {
  const original = state({ hand: ["meditation#med"], discard: ["rage#a", "march#b", "promise#c"], deck: ["stamina#d"] });
  const trance = play(original, "meditation#med", "powered", { cardInstanceIds: ["rage#a", "promise#c"], option: "bottom" });
  assert.deepEqual(trance.deck.slice(-2), ["rage#a", "promise#c"]);
  assert.equal(trance.discard.includes("march#b"), true);
  const ended = gameReducer(trance, { type: "END_TURN" });
  assert.ok(ended.hand.length >= 2);
});

test("competitive interactive Spells are absent from every solo content deck and reject legacy-save plays", () => {
  for (const mode of ["base", "ultimate"] as const) {
    assert.equal(getSpellIdsForMode(mode).includes("manaMeltdown"), false);
    assert.equal(getSpellIdsForMode(mode).includes("manaClaim"), false);
  }
  for (const id of ["manaMeltdown", "manaClaim"]) {
    const rejected = play(state({ hand: [`${id}#legacy`] }), `${id}#legacy`, "basic");
    assert.equal(rejected.played.length, 0);
    assert.match(rejected.log[0], /多人竞争/);
  }
});

test("Savage Harvesting and Ruthless Coercion pay their printed discard/Influence costs", () => {
  for (const mode of ["basic", "powered"] as const) {
    const original = state({ hand: ["savageHarvesting#harvest", "march#crop"], crystals: { red: 0, blue: 0, green: 0, white: 0 } });
    const harvested = play(original, "savageHarvesting#harvest", mode, { cardInstanceId: "march#crop" });
    assert.equal(harvested.crystals.green, 1);
    assert.equal(harvested.discard.includes("march#crop"), true);
    assert.equal(availableResources(harvested).move, mode === "powered" ? 4 : 2);
  }

  const coerced = state({ hand: ["ruthlessCoercion#coerce"], units: [{ id: "peasants", used: true, wounded: false, selectedAbilityId: "move" }] });
  const next = play(coerced, "ruthlessCoercion#coerce", "powered", { unitIds: ["peasants"] });
  assert.equal(next.reputation, coerced.reputation - 1);
  assert.equal(next.units[0].used, false);
  assert.equal(next.spent.influence, 2);
});

test("One With the Land implements all three printed branches, including terrain-scaled elemental Block", () => {
  const base = state({ hand: ["oneWithTheLand#land"] });
  assert.equal(availableResources(play(base, "oneWithTheLand#land", "basic", { option: "move" })).move, 2);
  assert.equal(availableResources(play(base, "oneWithTheLand#land", "basic", { option: "heal" })).heal, 1);
  const night = play(base, "oneWithTheLand#land", "powered", { option: "block" });
  assert.ok(availableResources(night).iceBlock > 0);
});

test("Blood of Ancients acquires an offered card in basic mode and borrows its strong effect without removing it", () => {
  const base = state({ hand: ["bloodOfAncients#blood"], advancedOffer: ["fireBolt"], advancedDeck: ["pathfinding"] });
  const gained = play(base, "bloodOfAncients#blood", "basic", { cardId: "fireBolt", manaColors: ["red"] });
  assert.equal(gained.hand.some((id) => id.startsWith("fireBolt#")), true);
  assert.equal(gained.advancedOffer.includes("pathfinding"), true);
  assert.equal(gained.hand.some((id) => id.startsWith("wound#")), true);

  const combat = combatState({ id: "blood-dummy", name: "dummy", armor: 20, attack: 2, fame: 0, description: "" }, { hand: ["bloodOfAncients#borrow"], advancedOffer: ["fireBolt"] });
  const borrowed = play(combat, "bloodOfAncients#borrow", "powered", { cardId: "fireBolt" });
  assert.equal(availableResources(borrowed).fireSiege, 5);
  assert.equal(borrowed.advancedOffer.includes("fireBolt"), true);
});

test("Shield Bash doubles only against Swift and its strong excess lowers Armor after a successful Block", () => {
  const swift: Enemy = { id: "swift", name: "swift", armor: 6, attack: 2, swift: true, fame: 1, description: "" };
  const base = play(combatState(swift, { hand: ["shieldBash#bash"], combat: { ...combatState(swift).combat!, step: "block" } }), "shieldBash#bash", "basic");
  assert.equal(availableResources(base).block, 6);
  const strong = play(combatState(swift, { hand: ["shieldBash#strong"], combat: { ...combatState(swift).combat!, step: "block" } }), "shieldBash#strong", "powered");
  const blocked = gameReducer(strong, { type: "COMBAT_BLOCK" });
  assert.ok((blocked.combat?.armorReductionByEnemyId?.[swift.id] ?? 0) > 0);
});

test("Spell Forge gains only colours represented in the Spell offer", () => {
  const base = state({ hand: ["spellForge#forge"], spellOffer: ["firestorm", "blizzard"], crystals: { red: 0, blue: 0, green: 0, white: 0 } });
  const one = play(base, "spellForge#forge", "basic", { manaColors: ["red"] });
  assert.equal(one.crystals.red, 1);
  const two = play(base, "spellForge#forge", "powered", { manaColors: ["red", "blue"] });
  assert.equal(two.crystals.red, 1);
  assert.equal(two.crystals.blue, 1);
  assert.equal(play(base, "spellForge#forge", "basic", { manaColors: ["green"] }).played.length, 0);
});

test("Chivalry offers raw Attack or lower honorable Attack and applies per-kill rewards", () => {
  const enemy: Enemy = { id: "honor", name: "honor", armor: 4, attack: 1, fame: 2, description: "" };
  const combat = combatState(enemy, { hand: ["chivalry#honor"], combat: { ...combatState(enemy).combat!, step: "attack" }, reputation: 0 });
  const honorable = play(combat, "chivalry#honor", "powered", { option: "honor" });
  assert.equal(availableResources(honorable).attack, 4);
  const won = gameReducer(honorable, { type: "COMBAT_ATTACK" });
  assert.equal(won.reputation, 1);
  assert.equal(won.fame, combat.fame + enemy.fame + 1);
});

test("Peaceful Moment and Stout Resolve enforce selected costs/branches", () => {
  const peaceful = state({ hand: ["peacefulMoment#peace"], units: [{ id: "peasants", used: true, wounded: false }] });
  const used = play(peaceful, "peacefulMoment#peace", "powered", { option: "action", amount: 1, unitIds: ["peasants"] });
  assert.equal(used.actionTaken, true);
  assert.equal(used.units[0].used, false);
  assert.equal(availableResources(used).heal, 1);
  assert.equal(used.spent.influence, 4);

  const resolve = state({ hand: ["stoutResolve#resolve", "wound#cost", "march#cost"] });
  const boosted = play(resolve, "stoutResolve#resolve", "powered", { option: "attack", cardInstanceIds: ["wound#cost", "march#cost"] });
  assert.equal(availableResources(boosted).attack, 7);
  assert.equal(boosted.discard.includes("wound#cost"), true);
});

test("Force of Nature grants targeted resistance or its printed strong combat choice; Mountain Lore changes mountain movement", () => {
  const enemy: Enemy = { id: "physical", name: "physical", armor: 5, attack: 5, fame: 1, description: "" };
  const combat = combatState(enemy, { hand: ["forceOfNature#nature"], units: [{ id: "peasants", used: false, wounded: false }] });
  const resistant = play(combat, "forceOfNature#nature", "basic", { unitId: "peasants" });
  assert.equal(resistant.physicalResistanceUnitIds?.includes("peasants"), true);
  const block = play(combat, "forceOfNature#nature", "powered", { option: "block" });
  assert.equal(availableResources(block).block, 6);

  const mountain = play(state({ hand: ["mountainLore#mountain"] }), "mountainLore#mountain", "powered");
  assert.equal(terrainMoveCost(mountain, "mountain"), 5);
});

test("Offering/Sacrifice converts the exact selected cards/crystal pairs", () => {
  const offer = state({ hand: ["offering#offer", "march#green"], crystals: { red: 0, blue: 0, green: 0, white: 0 } });
  const offered = play(offer, "offering#offer", "basic", { cardInstanceIds: ["march#green"] });
  assert.equal(offered.crystals.red, 1);
  assert.equal(offered.crystals.green, 1);
  const sacrifice = state({ hand: ["offering#sacrifice"], crystals: { red: 2, blue: 0, green: 2, white: 0 } });
  const attacked = play(sacrifice, "offering#sacrifice", "powered", { manaColors: ["green", "red"] });
  assert.equal(availableResources(attacked).fireSiege, 8);
  assert.equal(attacked.crystals.green, 0);
  assert.equal(attacked.manaTokens.green, sacrifice.manaTokens.green + 2);
});

test("Charm and Cure implement their interaction/combat branches", () => {
  const charmed = play(state({ hand: ["charm#charm"], interactionSite: "0,0", crystals: { red: 0, blue: 0, green: 0, white: 0 } }), "charm#charm", "basic", { option: "crystal", manaColors: ["blue"] });
  assert.equal(charmed.crystals.blue, 1);
  assert.equal(availableResources(charmed).influence, 4);

  const enemy: Enemy = { id: "possess", name: "possess", armor: 6, attack: 5, attackElement: "fire", fame: 1, description: "" };
  const possessed = play(combatState(enemy, { hand: ["charm#possess"] }), "charm#possess", "powered", { enemyIds: [enemy.id] });
  assert.equal(possessed.combat?.cancelledAttackIds?.includes(enemy.id), true);
  assert.equal(availableResources(possessed).fireAttack, 5);

  const cured = play(state({ hand: ["cure#cure"] }), "cure#cure", "basic");
  assert.equal(availableResources(cured).heal, 2);
});

test("Banner of Command/ Fortitude perform free recruitment and full Unit healing", () => {
  const command = state({ hand: ["bannerOfCommand#command"], unitOffer: ["peasants"], units: [] });
  const recruited = play(command, "bannerOfCommand#command", "powered", { unitId: "peasants" });
  assert.equal(recruited.units[0].id, "peasants");
  assert.equal(recruited.fame, command.fame + 2);

  const fortitude = state({ hand: ["bannerOfFortitude#fort"], units: [{ id: "peasants", used: true, wounded: true, wounds: 2 }] });
  const healed = play(fortitude, "bannerOfFortitude#fort", "powered");
  assert.equal(healed.units[0].wounded, false);
  assert.equal(healed.units[0].wounds, 0);
});

test("Circlet, Tome, Chilling Stare and Mysterious Box resolve their selected external component", () => {
  const circlet = state({ hand: ["circletOfProficiency#circlet"] });
  const borrowed = play(circlet, "circletOfProficiency#circlet", "basic", { cardId: "tovak-double-time" });
  assert.equal(availableResources(borrowed).move, 4);
  const learned = play(circlet, "circletOfProficiency#circlet", "powered", { cardId: "tovak-double-time" });
  assert.equal(learned.skills.includes("tovak-double-time"), true);

  const tome = state({ hand: ["tomeOfAllSpells#tome", "rage#red"], spellOffer: ["firestorm"] });
  const copied = play(tome, "tomeOfAllSpells#tome", "basic", { cardInstanceId: "rage#red", cardId: "firestorm" });
  assert.equal(availableResources(copied).fireAttack, 5);

  const enemy: Enemy = { id: "stare", name: "stare", armor: 5, attack: 4, fame: 1, description: "" };
  const stared = play(combatState(enemy, { hand: ["chillingStare#stare"] }), "chillingStare#stare", "powered", { option: "combat", enemyIds: [enemy.id] });
  assert.equal(stared.combat?.cancelledAttackIds?.includes(enemy.id), true);

  const box = state({ hand: ["mysteriousBox#box"], artifactDeck: ["hornWrath"] });
  const opened = play(box, "mysteriousBox#box", "basic", { option: "basic" });
  assert.equal(availableResources(opened).range, 5);
  assert.equal(opened.artifactDeck.at(-1), "hornWrath");
  assert.equal(opened.fame, box.fame + 1);
});

test("all four base Banners keep their printed attachment and once-per-round abilities", () => {
  const gloryEnemy: Enemy = { id: "glory", name: "glory", armor: 8, attack: 3, fame: 1, description: "" };
  let glory = combatState(gloryEnemy, { hand: ["bannerGlory#glory"], units: [{ id: "peasants", used: false, wounded: false }] });
  glory = play(glory, "bannerGlory#glory", "basic", { unitId: "peasants" });
  glory = gameReducer(glory, { type: "ACTIVATE_UNIT", unitId: "peasants", abilityId: "attack" });
  assert.equal(availableResources(glory).attack, 3);
  assert.equal(glory.fame, 1);
  assert.equal(glory.units[0].banner?.cardId, "bannerGlory");

  const multi: Enemy = { id: "multi-fear", name: "multi", armor: 4, attack: 3, attackCount: 2, fame: 1, description: "" };
  let fear = combatState(multi, { combat: { step: "block" }, units: [{ id: "peasants", used: false, wounded: false, banner: { instanceId: "bannerFear#fear", cardId: "bannerFear", faceUp: true } }] });
  fear = gameReducer(fear, { type: "USE_BANNER", unitId: "peasants" });
  assert.equal(combatBlockRequirement(fear), 3, "base Fear cancels one printed attack, not the entire multiple-attack enemy");
  assert.equal(fear.fame, 1);

  let courage = state({ units: [{ id: "peasants", used: true, wounded: false, banner: { instanceId: "bannerCourage#courage", cardId: "bannerCourage", faceUp: true } }] });
  courage = gameReducer(courage, { type: "USE_BANNER", unitId: "peasants" });
  assert.equal(courage.units[0].used, false);
  assert.equal(courage.units[0].banner?.faceUp, false);

  const protectedState = combatState({ id: "fire", name: "fire", armor: 3, attack: 4, attackElement: "fire", fame: 1, description: "" }, {
    combat: { step: "damage", damageRemaining: 4 },
    units: [{ id: "peasants", used: false, wounded: false, banner: { instanceId: "bannerProtection#protect", cardId: "bannerProtection", faceUp: true } }],
  });
  const protectedUnit = gameReducer(protectedState, { type: "ASSIGN_DAMAGE_UNIT", unitId: "peasants" });
  assert.equal(protectedUnit.units[0].wounded, false, "Protection grants Fire resistance and Armor +1");
});

test("Elemental Rings grant token/crystal/Fame or an actual infinite colour+black supply", () => {
  const basic = play(state({ hand: ["rubyRing#basic"], crystals: { red: 0, blue: 0, green: 0, white: 0 }, manaTokens: { red: 0, blue: 0, green: 0, white: 0, black: 0 } }), "rubyRing#basic", "basic");
  assert.equal(basic.crystals.red, 1);
  assert.equal(basic.manaTokens.red, 1);
  assert.equal(basic.fame, 1);

  let endless = play(state({ hand: ["sapphireRing#strong", "chill#spell"], manaTokens: { red: 0, blue: 0, green: 0, white: 0, black: 0 }, crystals: { red: 0, blue: 0, green: 0, white: 0 }, source: [] }), "sapphireRing#strong", "powered");
  const enemy: Enemy = { id: "ring-target", name: "target", armor: 4, attack: 3, fame: 1, description: "" };
  endless = { ...endless, phase: "combat", combat: { cellId: endless.position, originId: endless.position, enemy, step: "block", blocked: false } };
  endless = play(endless, "chill#spell", "powered", { enemyIds: [enemy.id] });
  assert.equal(endless.played.some((item) => item.instanceId === "chill#spell"), true);
  assert.equal(endless.fame, 1, "matching Spell cast with strong Ring grants Fame");
});

test("Sword of Justice discards for Attack and its strong effect doubles physical attacks while removing resistance", () => {
  const basic = play(state({ hand: ["swordJustice#basic", "march#a", "rage#b"] }), "swordJustice#basic", "basic", { cardInstanceIds: ["march#a", "rage#b"] });
  assert.equal(availableResources(basic).attack, 6);
  assert.deepEqual(basic.discard, ["march#a", "rage#b"]);

  const enemy: Enemy = { id: "physical-resist", name: "resistant", armor: 8, attack: 2, fame: 1, resistances: ["physical"], description: "" };
  const combat = combatState(enemy, { hand: ["swordJustice#strong", "rage#rage"], combat: { step: "attack" } });
  let doubled = play(combat, "rage#rage", "basic");
  doubled = play(doubled, "swordJustice#strong", "powered");
  assert.equal(effectiveAttackValue(doubled), 4, "Attack 2 becomes 4 and is not halved by physical resistance");
});

test("Golden Grail and Cure apply rewards to the wounds/Units actually healed", () => {
  let grail = play(state({ hand: ["goldenGrail#grail", "wound#heal"], deck: ["rage#draw"], fame: 0 }), "goldenGrail#grail", "powered");
  grail = gameReducer(grail, { type: "USE_HEAL" });
  assert.equal(grail.hand.includes("rage#draw"), true, "strong Grail draws after healing a hand Wound");

  let cure = play(state({ hand: ["cure#cure", "wound#heal"], deck: ["march#draw"], units: [{ id: "peasants", used: true, wounded: true, wounds: 1 }] }), "cure#cure", "basic");
  cure = gameReducer(cure, { type: "USE_HEAL" });
  assert.equal(cure.hand.includes("march#draw"), true);
  cure = { ...cure, turnBonus: resources({ heal: 1 }) };
  cure = gameReducer(cure, { type: "HEAL_UNIT", unitId: "peasants" });
  assert.equal(cure.units[0].used, false, "Cure readies every Unit healed this turn");
});

test("Sun and Darkness Amulets create selectable mana and apply their opposite-time terrain rules", () => {
  const sun = play(state({ time: "night", hand: ["amuletSun#sun"], wildManaTokens: 0 }), "amuletSun#sun", "powered");
  assert.equal(sun.wildManaTokens, 3);
  assert.equal(terrainMoveCost(sun, "forest"), 3);

  const dark = play(state({ time: "day", hand: ["amuletDarkness#dark"], manaTokens: { red: 0, blue: 0, green: 0, white: 0, black: 0 } }), "amuletDarkness#dark", "powered", { manaColors: ["black", "red", "red"] });
  assert.equal(dark.manaTokens.black, 1);
  assert.equal(dark.manaTokens.red, 2);
  assert.equal(terrainMoveCost(dark, "desert"), 3);
});
