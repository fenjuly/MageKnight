import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_CARD_DEFS,
  ALL_ENEMY_TOKENS,
  ALL_RUIN_TOKENS,
  ALL_UNIT_DEFS,
  EMPTY_RESOURCES,
  type Enemy,
  type EnemyTokenColor,
  type MapCell,
  type ResourceKey,
  type SiteType,
} from "../lib/game-data";
import {
  combatDamageTotal,
  combatEnemyArmor,
  createGame,
  effectiveGroupAttackValue,
  enemiesOnCell,
  gameReducer,
  groupedAttackRequirement,
  handLimit,
  hasConqueredVolkareCampServices,
  canRecruitUnitAtCurrentSite,
  isAdventureEnemyCell,
  isRampagingEnemyCell,
  nightRulesApply,
  siteAllowsUnit,
  unitRecruitInfluenceCost,
  type GameState,
} from "../lib/game-engine";

function resources(patch: Partial<Record<ResourceKey, number>> = {}) {
  return { ...EMPTY_RESOURCES, ...patch };
}

function patchCell(map: MapCell[], id: string, patch: Partial<MapCell>) {
  const [q, r] = id.split(",").map(Number);
  const current = map.find((cell) => cell.id === id);
  const base: MapCell = current ?? { id, q, r, terrain: "plains", site: "none", revealed: true, conquered: false, tokenRevealed: false };
  return [...map.filter((cell) => cell.id !== id), { ...base, ...patch, id, q, r }];
}

function stateAt(site: SiteType, patch: Partial<MapCell> = {}): GameState {
  const base = createGame("tovak", "standard", "classic", "wedge", 812_144, "ultimate");
  const map = patchCell(base.map, base.position, {
    terrain: "plains",
    site,
    revealed: true,
    conquered: false,
    tokenRevealed: true,
    enemy: undefined,
    enemies: [],
    ...patch,
  });
  return {
    ...base,
    phase: "planning",
    time: "day",
    map,
    hand: [],
    deck: ["march#site-draw"],
    discard: [],
    played: [],
    spent: resources(),
    turnBonus: resources(),
    manaTokens: { red: 10, blue: 10, green: 10, white: 10, black: 10 },
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
    units: [],
    actionTaken: false,
    combat: undefined,
  };
}

function enemy(id: string, patch: Partial<Enemy> = {}): Enemy {
  return { id, name: id, armor: 3, attack: 2, fame: 1, description: "地点测试敌人", ...patch };
}

function enemyPools() {
  return Object.fromEntries((["green", "red", "gray", "violet", "brown", "white"] as EnemyTokenColor[]).map((color) => [
    color,
    ALL_ENEMY_TOKENS.filter((token) => token.tokenColor === color).map((token) => token.id),
  ])) as Record<EnemyTokenColor, string[]>;
}

function defeatAllAtRange(state: GameState) {
  let next = state;
  let guard = 0;
  while (next.phase === "combat" && next.combat && guard < 12) {
    assert.equal(next.combat.step, "ranged", `unexpected ${next.combat.step} while defeating ${next.combat.enemy.name}`);
    next = gameReducer(next, { type: "COMBAT_RANGED" });
    guard += 1;
  }
  assert.ok(guard < 12, "combat did not terminate");
  return next;
}

const ADVENTURE_SITES: SiteType[] = [
  "ruins", "monsterDen", "dungeon", "tomb", "spawningGrounds", "maze", "labyrinth",
  "graveyard", "necropolis",
];

for (const site of ADVENTURE_SITES) {
  test(`site ${site}: entering is voluntary and starts only after ENTER_ADVENTURE`, () => {
    const defenders = site === "spawningGrounds" ? [enemy(`${site}-a`), enemy(`${site}-b`)] : [enemy(`${site}-a`)];
    let state = stateAt(site, { enemies: defenders, enemy: defenders[0] });
    state = { ...state, turnBonus: resources({ move: 6 }) };
    assert.equal(isAdventureEnemyCell(state.map.find((cell) => cell.id === state.position)!), true);
    assert.equal(state.phase, "planning");
    const next = gameReducer(state, { type: "ENTER_ADVENTURE", ...(site === "maze" || site === "labyrinth" ? { moveSpend: 2 as const, rewardCrystalColors: ["red", "blue"] as const } : {}) });
    assert.equal(next.phase, "combat");
    assert.equal(next.combat?.kind, "adventure");
    assert.equal(1 + (next.combat?.queue?.length ?? 0), defenders.length);
    assert.equal(next.combat?.unitsForbidden, site === "dungeon" || site === "tomb");
    assert.equal(next.combat?.nightRules, site === "dungeon" || site === "tomb" || site === "graveyard" || site === "necropolis");
  });
}

test("site hiddenValley: it is always a safe site and ENTER_ADVENTURE cannot fabricate a fight", () => {
  const foe = enemy("should-not-exist");
  const state = stateAt("hiddenValley", { enemies: [foe], enemy: foe });
  assert.equal(isAdventureEnemyCell(state.map.find((cell) => cell.id === state.position)!), false);
  const next = gameReducer(state, { type: "ENTER_ADVENTURE" });
  assert.equal(next.phase, "planning");
  assert.equal(next.combat, undefined);
});

for (const site of ["dungeon", "tomb", "maze", "labyrinth"] as SiteType[]) {
  test(`site ${site}: failure discards the on-demand defenders`, () => {
    let state = stateAt(site, { enemies: [enemy(`${site}-failure`, { tokenColor: "brown" })], enemy: enemy(`${site}-failure`, { tokenColor: "brown" }) });
    state = { ...state, turnBonus: resources({ move: 6 }) };
    const entered = gameReducer(state, { type: "ENTER_ADVENTURE", ...(site === "maze" || site === "labyrinth" ? { moveSpend: 2 as const, rewardCrystalColors: ["red", "blue"] as const } : {}) });
    const retreated = gameReducer(entered, { type: "COMBAT_RETREAT" });
    assert.equal(enemiesOnCell(retreated.map.find((cell) => cell.id === state.position)!).length, 0);
  });
}

test("site spawningGrounds: failure keeps survivors and replenishes to two defenders", () => {
  const first = enemy("spawn-survivor", { tokenColor: "brown" });
  const state = stateAt("spawningGrounds", { enemies: [first], enemy: first });
  const entered = gameReducer(state, { type: "ENTER_ADVENTURE" });
  const retreated = gameReducer(entered, { type: "COMBAT_RETREAT" });
  assert.equal(enemiesOnCell(retreated.map.find((cell) => cell.id === state.position)!).length, 2);
});

test("site monsterDen: failure leaves its surviving enemy in place", () => {
  const guard = enemy("den-survivor", { tokenColor: "brown" });
  const state = stateAt("monsterDen", { enemies: [guard], enemy: guard });
  const retreated = gameReducer(gameReducer(state, { type: "ENTER_ADVENTURE" }), { type: "COMBAT_RETREAT" });
  assert.deepEqual(enemiesOnCell(retreated.map.find((cell) => cell.id === state.position)!).map((item) => item.id), [guard.id]);
});

test("site dungeon: a repeat visit draws a new guardian but awards only that enemy's Fame", () => {
  const guard = enemy("dungeon-repeat", { tokenColor: "brown", fame: 4 });
  const state = { ...stateAt("dungeon", { conquered: true, enemies: [guard], enemy: guard }), turnBonus: resources({ range: 100 }) };
  const beforeDeck = state.deck.length;
  const beforeArtifacts = state.artifacts;
  const won = gameReducer(gameReducer(state, { type: "ENTER_ADVENTURE" }), { type: "COMBAT_RANGED" });
  assert.equal(won.fame, state.fame + guard.fame);
  assert.equal(won.deck.length, beforeDeck);
  assert.equal(won.artifacts, beforeArtifacts);
  assert.equal(won.combat, undefined);
});

for (const ruin of ALL_RUIN_TOKENS) {
  if (ruin.altarColor) {
    test(`ruin ${ruin.id}: altar accepts exactly three ${ruin.altarColor} mana and awards 7 Fame`, () => {
      const state = stateAt("ruins", {
        ruinTokenId: ruin.id,
        ruinsReward: ruin.reward,
        ruinAltarColor: ruin.altarColor,
      });
      const next = gameReducer(state, { type: "ENTER_ADVENTURE" });
      assert.equal(next.fame, state.fame + 7);
      assert.equal(next.map.find((cell) => cell.id === state.position)?.conquered, true);
      assert.equal(next.manaTokens[ruin.altarColor], 7);
    });
    continue;
  }

  test(`ruin ${ruin.id}: draws ${ruin.enemies.join("+")} and grants ${ruin.reward}`, () => {
    const pools = enemyPools();
    let state = stateAt("ruins", {
      ruinTokenId: ruin.id,
      ruinsReward: ruin.reward,
      tokenRevealed: true,
    });
    state = {
      ...state,
      enemyDecks: pools,
      turnBonus: resources({ siege: 100, fireSiege: 100, iceSiege: 100, coldfireSiege: 100 }),
    };
    const artifactsBefore = state.artifacts;
    const crystalsBefore = Object.values(state.crystals).reduce((sum, count) => sum + count, 0);
    const deckBefore = state.deck.length;
    const entered = gameReducer(state, { type: "ENTER_ADVENTURE" });
    assert.equal(entered.phase, "combat");
    const encountered = [entered.combat!.enemy, ...(entered.combat!.queue ?? []).map((item) => item.enemy)];
    assert.deepEqual(encountered.map((item) => item.tokenColor), ruin.enemies);
    const won = defeatAllAtRange(entered);
    assert.equal(won.map.find((cell) => cell.id === state.position)?.conquered, true);
    if (ruin.reward === "artifact") assert.equal(won.artifacts, artifactsBefore + 1);
    if (ruin.reward === "spell" || ruin.reward === "advanced") assert.equal(won.deck.length, deckBefore + 1);
    if (ruin.reward === "crystals") assert.equal(Object.values(won.crystals).reduce((sum, count) => sum + count, 0), crystalsBefore + 2);
  });
}

for (const site of ["maze", "labyrinth"] as const) {
  for (const moveSpend of [2, 4, 6] as const) {
    test(`site ${site}: paying ${moveSpend} Move selects the matching reward tier`, () => {
      const guardian = enemy(`${site}-${moveSpend}`);
      let state = stateAt(site, { enemies: [guardian], enemy: guardian });
      state = { ...state, turnBonus: resources({ move: moveSpend, siege: 100 }) };
      const artifactsBefore = state.artifacts;
      const crystalsBefore = Object.values(state.crystals).reduce((sum, count) => sum + count, 0);
      const deckBefore = state.deck.length;
      const won = defeatAllAtRange(gameReducer(state, { type: "ENTER_ADVENTURE", moveSpend, ...(moveSpend === 2 ? { rewardCrystalColors: ["red", "blue"] as const } : {}) }));
      if (moveSpend === 2) assert.equal(Object.values(won.crystals).reduce((sum, count) => sum + count, 0), crystalsBefore + 2);
      if (moveSpend === 4) assert.equal(won.deck.length, deckBefore + (site === "labyrinth" ? 2 : 1));
      if (moveSpend === 6) {
        assert.equal(won.artifacts, artifactsBefore + 1);
        assert.equal(won.deck.length, deckBefore + (site === "labyrinth" ? 2 : 1));
      }
    });
  }
}

test("site maze: arrival Move is discarded and only Move generated after arrival pays entry", () => {
  const base = stateAt("none");
  const guardian = enemy("maze-fresh-move");
  const map = patchCell(base.map, "1,0", { terrain: "plains", site: "maze", revealed: true, conquered: false, enemies: [guardian], enemy: guardian });
  const arrived = gameReducer({ ...base, map, hand: ["march#fresh"], turnBonus: resources({ move: 6 }) }, { type: "MAP_CLICK", cellId: "1,0" });
  assert.equal(arrived.position, "1,0");
  assert.equal(arrived.mazeArrivalMoveCarryover, 4);
  const rejected = gameReducer(arrived, { type: "ENTER_ADVENTURE", moveSpend: 2, rewardCrystalColors: ["red", "blue"] });
  assert.equal(rejected.phase, "planning");
  assert.equal(rejected.combat, undefined);

  const generated = gameReducer(arrived, { type: "PLAY_CARD", instanceId: "march#fresh", mode: "basic" });
  const entered = gameReducer(generated, { type: "ENTER_ADVENTURE", moveSpend: 2, rewardCrystalColors: ["red", "blue"] });
  assert.equal(entered.phase, "combat");
  assert.equal(entered.spent.move, 8, "2 arrival cost + 4 discarded carryover + 2 fresh entry Move");
});

test("site maze: at most the one selected ready Unit may participate", () => {
  const guardian = enemy("maze-unit-limit");
  const state = {
    ...stateAt("maze", { enemies: [guardian], enemy: guardian }),
    units: [
      { id: "foresters", used: false, wounded: false },
      { id: "guardsmen", used: false, wounded: false },
    ],
    turnBonus: resources({ move: 2 }),
  };
  const entered = gameReducer(state, { type: "ENTER_ADVENTURE", moveSpend: 2, accompanyingUnitId: "foresters", rewardCrystalColors: ["red", "blue"] });
  assert.deepEqual(entered.combat?.allowedUnitIds, ["foresters"]);
});

for (const site of ["mine", "deepMine"] as const) {
  test(`site ${site}: ending the turn grants the printed mine crystal`, () => {
    const state = { ...stateAt(site, { mineColor: "red" }), actionTaken: true };
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(next.crystals.red, 1);
  });
}

test("site deepMine: multi-color mines require a legal choice before end of turn", () => {
  const state = { ...stateAt("deepMine", { mineColor: undefined, mineColors: ["red", "blue"] }), actionTaken: true };
  const blocked = gameReducer(state, { type: "END_TURN" });
  assert.equal(blocked.phase, "planning");
  assert.equal(blocked.crystals.red + blocked.crystals.blue, 0);

  const illegal = gameReducer(state, { type: "SELECT_MINE_COLOR", color: "green" });
  assert.equal(illegal.selectedMineColor, undefined);
  const selected = gameReducer(state, { type: "SELECT_MINE_COLOR", color: "blue" });
  assert.equal(selected.selectedMineColor, "blue");
  const ended = gameReducer(selected, { type: "END_TURN" });
  assert.equal(ended.crystals.blue, 1);
  assert.equal(ended.crystals.red, 0);
});

test("site glade: ending the turn heals one hand/discard Wound", () => {
  const state = { ...stateAt("glade"), actionTaken: true, hand: ["wound#glade"] };
  const next = gameReducer(state, { type: "END_TURN" });
  assert.equal(next.hand.includes("wound#glade"), false);
  assert.equal(next.woundDeck.includes("wound#glade"), true);
});

test("Shades safe/overlay locations apply their printed inherent effects without requiring conquest", () => {
  const hiddenDay = { ...stateAt("hiddenValley"), phase: "tactic" as const, usedTactics: [], wildManaTokens: 0 };
  const afterHiddenDay = gameReducer(hiddenDay, { type: "CHOOSE_TACTIC", tacticId: "d2" });
  assert.equal(afterHiddenDay.wildManaTokens, 1);

  const hiddenNight = { ...stateAt("hiddenValley"), phase: "tactic" as const, time: "night" as const, usedTactics: [], manaTokens: { ...stateAt("hiddenValley").manaTokens, black: 0 } };
  const afterHiddenNight = gameReducer(hiddenNight, { type: "CHOOSE_TACTIC", tacticId: "n2" });
  assert.equal(afterHiddenNight.manaTokens.black, 1);

  const hiddenHeal = { ...stateAt("hiddenValley"), actionTaken: true, hand: ["wound#hidden"] };
  const healed = gameReducer(hiddenHeal, { type: "END_TURN" });
  assert.equal(healed.hand.includes("wound#hidden"), false);

  for (const site of ["graveyard", "necropolis"] as const) {
    const day = stateAt(site);
    assert.equal(nightRulesApply(day), true, `${site} must use night mana rules by day`);
    const night = { ...day, phase: "tactic" as const, time: "night" as const, usedTactics: [], manaTokens: { ...day.manaTokens, black: 0 } };
    const started = gameReducer(night, { type: "CHOOSE_TACTIC", tacticId: "n2" });
    assert.equal(started.manaTokens.black, 1, `${site} grants black mana at night`);
  }
});

test("inhabited sites expose recruitment only at rules-legal ownership states", () => {
  for (const unit of Object.values(ALL_UNIT_DEFS)) {
    assert.equal(siteAllowsUnit("monastery", unit, true), false, `${unit.id} at burned monastery`);
    assert.equal(siteAllowsUnit("keep", unit, false), false, `${unit.id} at hostile keep`);
    assert.equal(siteAllowsUnit("mageTower", unit, false), false, `${unit.id} at hostile tower`);
    assert.equal(siteAllowsUnit("city1", unit, false), false, `${unit.id} at hostile city`);
    assert.equal(siteAllowsUnit("refugeeCamp", unit, false), true, `${unit.id} at refugee camp`);
  }
});

test("site village recruits from the public offer and supports continued interaction", () => {
  const unit = Object.values(ALL_UNIT_DEFS).find((item) => item.site === "village")!;
  const state = { ...stateAt("village"), unitOffer: [unit.id], turnBonus: resources({ influence: 99 }) };
  const next = gameReducer(state, { type: "RECRUIT", unitId: unit.id });
  assert.ok(next.units.some((item) => item.id === unit.id));
  assert.equal(next.interactionSite, state.position);
});

test("site village converts Influence into healing and applies the interaction modifier once", () => {
  const state = {
    ...stateAt("village"),
    hand: ["wound#village-heal"],
    reputation: 3,
    turnBonus: resources({ influence: 10 }),
  };
  const next = gameReducer(state, { type: "HEAL_WITH_INFLUENCE" });
  assert.equal(next.hand.includes("wound#village-heal"), false);
  assert.equal(next.interactionModifierUsed, true);
  assert.equal(next.interactionSite, state.position);
});

test("site refugeeCamp allows multiple public Units in one interaction while command and Influence permit", () => {
  const [first, second] = Object.values(ALL_UNIT_DEFS).filter((unit) => unit.site === "city").slice(0, 2);
  assert.ok(first && second);
  const state = {
    ...stateAt("refugeeCamp"),
    fame: 20,
    unitOffer: [first.id, second.id],
    turnBonus: resources({ influence: 99 }),
  };
  const recruited = gameReducer(state, { type: "RECRUIT", unitId: first.id });
  assert.ok(recruited.units.some((unit) => unit.id === first.id));
  const continued = gameReducer(recruited, { type: "RECRUIT", unitId: second.id });
  assert.equal(continued.units.some((unit) => unit.id === second.id), true);
  assert.equal(continued.interactionSite, state.position);
});

test("site refugeeCamp applies the official 0/+1/+3 recruitment surcharge tiers", () => {
  const state = stateAt("refugeeCamp");
  const village = Object.values(ALL_UNIT_DEFS).find((unit) => (unit.recruitSites ?? [unit.site]).includes("village"))!;
  const monastery = Object.values(ALL_UNIT_DEFS).find((unit) => {
    const sites = unit.recruitSites ?? [unit.site];
    return !sites.includes("village") && sites.some((site) => site === "monastery" || site === "keep" || site === "mageTower");
  })!;
  const cityOnly = Object.values(ALL_UNIT_DEFS).find((unit) => {
    const sites = unit.recruitSites ?? [unit.site];
    return sites.includes("city") && !sites.some((site) => site === "village" || site === "monastery" || site === "keep" || site === "mageTower");
  })!;
  assert.ok(village && monastery && cityOnly);
  assert.equal(unitRecruitInfluenceCost(state, village), village.cost);
  assert.equal(unitRecruitInfluenceCost(state, monastery), monastery.cost + 1);
  assert.equal(unitRecruitInfluenceCost(state, cityOnly), cityOnly.cost + 3);
});

test("site monastery buys its dedicated Advanced Action and burning starts a violet, unit-forbidden combat", () => {
  const advanced = Object.values(ALL_CARD_DEFS).find((card) => card.tier === "advanced")!;
  const buying = { ...stateAt("monastery"), monasteryOffer: [advanced.id], turnBonus: resources({ influence: 99 }) };
  const bought = gameReducer(buying, { type: "BUY_CARD", cardId: advanced.id, tier: "advanced" });
  assert.ok(bought.deck.some((id) => id.startsWith(`${advanced.id}#`)));

  const violet = ALL_ENEMY_TOKENS.find((item) => item.tokenColor === "violet")!;
  const burning = { ...stateAt("monastery"), enemyDecks: { ...stateAt("monastery").enemyDecks, violet: [violet.id] } };
  const combat = gameReducer(burning, { type: "BURN_MONASTERY" });
  assert.equal(combat.phase, "combat");
  assert.equal(combat.reputation, burning.reputation - 3);
  assert.equal(combat.combat?.unitsForbidden, true);
});

for (const site of ["keep", "mageTower", "city1", "city2"] as const) {
  test(`site ${site}: entering a hostile garrison forces an assault and costs 1 Reputation`, () => {
    const base = stateAt("none");
    const guard = enemy(`${site}-guard`, { fortified: true, fortificationLevel: 1 });
    const map = patchCell(base.map, "1,0", { terrain: site.startsWith("city") ? "city" : "plains", site, revealed: true, conquered: false, tokenRevealed: true, enemies: [guard], enemy: guard });
    const state = { ...base, map, turnBonus: resources({ move: 10 }) };
    const next = gameReducer(state, { type: "MAP_CLICK", cellId: "1,0" });
    assert.equal(next.phase, "combat");
    assert.equal(next.combat?.kind, "assault");
    assert.equal(next.combat?.mustWithdraw, true);
    assert.equal(next.reputation, state.reputation - 1);
  });
}

const SITE_REWARD_CASES: Array<{
  site: Exclude<SiteType, "none">;
  defenders: number;
  assertReward: (before: GameState, after: GameState) => void;
}> = [
  { site: "keep", defenders: 1, assertReward: (before, after) => assert.equal(after.ownedKeeps, before.ownedKeeps + 1) },
  { site: "mageTower", defenders: 1, assertReward: (before, after) => assert.equal(after.deck.length, before.deck.length + 1) },
  { site: "monastery", defenders: 1, assertReward: (before, after) => assert.equal(after.artifacts, before.artifacts + 1) },
  {
    site: "monsterDen",
    defenders: 1,
    assertReward: (before, after) => assert.ok(
      Object.values(after.crystals).reduce((sum, count) => sum + count, 0) > Object.values(before.crystals).reduce((sum, count) => sum + count, 0)
      || after.fame > before.fame + 1,
    ),
  },
  {
    site: "tomb",
    defenders: 1,
    assertReward: (before, after) => {
      assert.equal(after.artifacts, before.artifacts + 1);
      assert.equal(after.deck.length, before.deck.length + 2);
    },
  },
  {
    site: "spawningGrounds",
    defenders: 2,
    assertReward: (before, after) => {
      assert.equal(after.artifacts, before.artifacts + 1);
      assert.equal(Object.values(after.crystals).reduce((sum, count) => sum + count, 0), Object.values(before.crystals).reduce((sum, count) => sum + count, 0) + 3);
    },
  },
  {
    site: "necropolis",
    defenders: 2,
    assertReward: (before, after) => {
      assert.equal(after.artifacts, before.artifacts);
      assert.equal(after.deck.length, before.deck.length);
    },
  },
  {
    site: "volkareCamp",
    defenders: 3,
    assertReward: (before, after) => {
      assert.equal(after.conqueredCities, before.conqueredCities + 1);
      assert.ok((after.volkareShields ?? 0) >= 1);
    },
  },
  { site: "city1", defenders: 2, assertReward: (before, after) => assert.equal(after.conqueredCities, before.conqueredCities + 1) },
  { site: "city2", defenders: 2, assertReward: (before, after) => assert.equal(after.conqueredCities, before.conqueredCities + 1) },
];

for (const rewardCase of SITE_REWARD_CASES) {
  test(`site ${rewardCase.site}: defeating all ${rewardCase.defenders} defenders grants its complete reward`, () => {
    const defenders = Array.from({ length: rewardCase.defenders }, (_, index) => enemy(`${rewardCase.site}-reward-${index}`, {
      fortified: ["keep", "mageTower", "necropolis", "city1", "city2"].includes(rewardCase.site),
      fortificationLevel: ["keep", "mageTower", "necropolis", "city1", "city2"].includes(rewardCase.site) ? 1 : 0,
      ...(rewardCase.site === "volkareCamp" ? { tokenColor: (["green", "white", "red"] as EnemyTokenColor[])[index] } : {}),
    }));
    const before = stateAt(rewardCase.site, { enemies: defenders, enemy: defenders[0] });
    const combat: GameState = {
      ...before,
      phase: "combat",
      turnBonus: resources({ siege: 100 }),
      combat: {
        cellId: before.position,
        enemy: defenders[0],
        originId: before.position,
        kind: rewardCase.site === "monastery" ? "monastery" : ["keep", "mageTower", "city1", "city2"].includes(rewardCase.site) ? "assault" : "adventure",
        step: "ranged",
        blocked: false,
        queue: defenders.slice(1).map((foe) => ({ cellId: before.position, enemy: foe })),
        chainStartFame: before.fame,
      },
    };
    const won = defeatAllAtRange(combat);
    assert.equal(won.map.find((cell) => cell.id === before.position)?.conquered, true);
    rewardCase.assertReward(before, won);
  });
}

for (const site of ["graveyard", "necropolis"] as const) {
  test(`site ${site}: scenario defenders give only printed enemy/faction rewards, not invented generic loot`, () => {
    const guard = enemy(`${site}-scenario-guard`, { faction: "dark-crusaders" });
    const before = stateAt(site, { enemies: [guard], enemy: guard });
    const combat: GameState = {
      ...before,
      phase: "combat",
      turnBonus: resources({ range: 100 }),
      combat: { cellId: before.position, enemy: guard, originId: before.position, kind: "adventure", step: "ranged", blocked: false, chainStartFame: before.fame, nightRules: true },
    };
    const won = gameReducer(combat, { type: "COMBAT_RANGED" });
    assert.equal(won.deck.length, before.deck.length);
    assert.equal(won.artifacts, before.artifacts);
    assert.equal(won.reputation, before.reputation);
    assert.equal(won.factionTokens?.["dark-crusaders"], 1);
  });
}

for (const site of ["rampager", "dragon"] as const) {
  test(`site ${site}: clicking an adjacent revealed token starts a voluntary combat without moving`, () => {
    const base = stateAt("none");
    const foe = enemy(`${site}-foe`);
    const map = patchCell(base.map, "1,0", { terrain: "plains", site, revealed: true, conquered: false, tokenRevealed: true, enemies: [foe], enemy: foe });
    const state = { ...base, map };
    assert.equal(isRampagingEnemyCell(map.find((cell) => cell.id === "1,0")!), true);
    const next = gameReducer(state, { type: "MAP_CLICK", cellId: "1,0" });
    assert.equal(next.phase, "combat");
    assert.equal(next.combat?.kind, "rampager");
    assert.equal(next.position, state.position);
  });
}

test("provoking a rampager does not pull defenders from an adventure site at the destination", () => {
  const base = stateAt("none");
  const orc = enemy("provoked-orc");
  const ruinGuard = enemy("ruin-guard");
  let map = patchCell(base.map, "0,1", { terrain: "plains", site: "rampager", revealed: true, conquered: false, tokenRevealed: true, enemies: [orc], enemy: orc });
  map = patchCell(map, "1,0", { terrain: "plains", site: "ruins", revealed: true, conquered: false, tokenRevealed: true, enemies: [ruinGuard], enemy: ruinGuard });
  const next = gameReducer({ ...base, map, turnBonus: resources({ move: 5 }) }, { type: "MAP_CLICK", cellId: "1,0" });
  assert.equal(next.combat?.kind, "provoked");
  assert.equal(next.combat?.enemy.id, orc.id);
  assert.equal(next.combat?.queue?.some((entry) => entry.enemy.id === ruinGuard.id), false);
});

test("one move can provoke two rampagers and both join the mandatory combat", () => {
  const base = stateAt("none");
  const first = enemy("provoked-first");
  const second = enemy("provoked-second");
  let map = patchCell(base.map, "0,1", { terrain: "plains", site: "rampager", revealed: true, conquered: false, tokenRevealed: true, enemies: [first], enemy: first });
  map = patchCell(map, "1,-1", { terrain: "plains", site: "dragon", revealed: true, conquered: false, tokenRevealed: true, enemies: [second], enemy: second });
  map = patchCell(map, "1,0", { terrain: "plains", site: "none", revealed: true, conquered: false });
  const next = gameReducer({ ...base, map, turnBonus: resources({ move: 5 }) }, { type: "MAP_CLICK", cellId: "1,0" });
  assert.equal(next.combat?.kind, "provoked");
  assert.deepEqual(new Set([next.combat!.enemy.id, ...(next.combat!.queue ?? []).map((entry) => entry.enemy.id)]), new Set([first.id, second.id]));
});

test("an assault and every rampager provoked by that move share one combat", () => {
  const base = stateAt("none");
  const orc = enemy("assault-provoked-orc");
  const guard = enemy("assault-guard", { fortified: true, fortificationLevel: 1 });
  let map = patchCell(base.map, "0,1", { terrain: "plains", site: "rampager", revealed: true, conquered: false, tokenRevealed: true, enemies: [orc], enemy: orc });
  map = patchCell(map, "1,0", { terrain: "plains", site: "keep", revealed: true, conquered: false, tokenRevealed: true, enemies: [guard], enemy: guard });
  const next = gameReducer({ ...base, map, turnBonus: resources({ move: 5 }) }, { type: "MAP_CLICK", cellId: "1,0" });
  assert.equal(next.combat?.kind, "provoked");
  assert.equal(next.combat?.mustWithdraw, true);
  assert.deepEqual(new Set([next.combat!.enemy.id, ...(next.combat!.queue ?? []).map((entry) => entry.enemy.id)]), new Set([orc.id, guard.id]));
});

test("multi-combat planner can challenge several adjacent rampagers without moving", () => {
  const base = stateAt("none");
  const first = enemy("voluntary-multi-one");
  const second = enemy("voluntary-multi-two");
  let map = patchCell(base.map, "1,0", { terrain: "plains", site: "rampager", revealed: true, conquered: false, tokenRevealed: true, enemies: [first], enemy: first });
  map = patchCell(map, "0,1", { terrain: "plains", site: "dragon", revealed: true, conquered: false, tokenRevealed: true, enemies: [second], enemy: second });
  const combat = gameReducer({ ...base, map }, { type: "START_MULTI_COMBAT", rampagerCellIds: ["1,0", "0,1"] });
  assert.equal(combat.position, base.position);
  assert.equal(combat.combat?.kind, "rampager");
  assert.deepEqual(new Set([combat.combat!.enemy.id, ...(combat.combat!.queue ?? []).map((entry) => entry.enemy.id)]), new Set([first.id, second.id]));
});

test("assault planner includes selected target-adjacent rampagers plus every mandatory provoked rampager", () => {
  const base = stateAt("none");
  const guard = enemy("planned-assault-guard", { fortified: true, fortificationLevel: 1 });
  const selected = enemy("planned-distant-rampager");
  const mandatory = enemy("planned-mandatory-rampager");
  let map = patchCell(base.map, "1,0", { terrain: "plains", site: "keep", revealed: true, conquered: false, tokenRevealed: true, enemies: [guard], enemy: guard });
  map = patchCell(map, "2,-1", { terrain: "plains", site: "dragon", revealed: true, conquered: false, tokenRevealed: true, enemies: [selected], enemy: selected });
  map = patchCell(map, "0,1", { terrain: "plains", site: "rampager", revealed: true, conquered: false, tokenRevealed: true, enemies: [mandatory], enemy: mandatory });
  const combat = gameReducer({ ...base, map, turnBonus: resources({ move: 2 }) }, { type: "START_MULTI_COMBAT", assaultCellId: "1,0", rampagerCellIds: ["2,-1"] });
  assert.equal(combat.position, "1,0");
  assert.equal(combat.reputation, base.reputation - 1);
  assert.deepEqual(new Set([combat.combat!.enemy.id, ...(combat.combat!.queue ?? []).map((entry) => entry.enemy.id)]), new Set([guard.id, selected.id, mandatory.id]));
});

test("group attacks sum Armor and apply each resistance to the entire corresponding attack pool", () => {
  const first = enemy("group-resistant", { armor: 3, resistances: ["fire"] });
  const second = enemy("group-plain", { armor: 2 });
  const base = stateAt("none", { enemies: [first, second], enemy: first });
  const state: GameState = {
    ...base,
    phase: "combat",
    turnBonus: resources({ fireRange: 10 }),
    combat: { cellId: base.position, enemy: first, originId: base.position, step: "ranged", blocked: false, queue: [{ cellId: base.position, enemy: second }], chainStartFame: base.fame },
  };
  assert.equal(groupedAttackRequirement(state, [first.id, second.id]), 5);
  assert.equal(effectiveGroupAttackValue(state, [first.id, second.id]), 5);
  const won = gameReducer(state, { type: "COMBAT_GROUP_ATTACK", enemyIds: [first.id, second.id] });
  assert.equal(won.phase, "planning");
  assert.equal(enemiesOnCell(won.map.find((cell) => cell.id === base.position)!).length, 0);
});

test("a grouped ranged attack uses only Siege if any member is fortified and cannot target a double-fortified member", () => {
  const open = enemy("group-open", { armor: 2 });
  const fortified = enemy("group-fortified", { armor: 2, fortified: true, fortificationLevel: 1 });
  const double = enemy("group-double", { armor: 2, fortified: true, fortificationLevel: 2 });
  const make = (second: Enemy, pool: Partial<Record<ResourceKey, number>>) => {
    const base = stateAt("none", { enemies: [open, second], enemy: open });
    return {
      ...base,
      phase: "combat" as const,
      turnBonus: resources(pool),
      combat: { cellId: base.position, enemy: open, originId: base.position, step: "ranged" as const, blocked: false, queue: [{ cellId: base.position, enemy: second }] },
    };
  };
  assert.equal(effectiveGroupAttackValue(make(fortified, { range: 20 }), [open.id, fortified.id]), 0);
  assert.equal(effectiveGroupAttackValue(make(fortified, { siege: 20 }), [open.id, fortified.id]), 20);
  assert.equal(effectiveGroupAttackValue(make(double, { siege: 20 }), [open.id, double.id]), 0);
});

test("multiple enemies can still be defeated separately instead of forming a group", () => {
  const first = enemy("separate-first", { armor: 3 });
  const second = enemy("separate-second", { armor: 2 });
  const base = stateAt("none", { enemies: [first, second], enemy: first });
  const state: GameState = {
    ...base,
    phase: "combat",
    turnBonus: resources({ range: 3 }),
    combat: { cellId: base.position, enemy: first, originId: base.position, step: "ranged", blocked: false, queue: [{ cellId: base.position, enemy: second }] },
  };
  const afterFirst = gameReducer(state, { type: "COMBAT_RANGED" });
  assert.equal(afterFirst.combat?.enemy.id, second.id);
  assert.equal(enemiesOnCell(afterFirst.map.find((cell) => cell.id === base.position)!).map((foe) => foe.id).includes(second.id), true);
});

test("Volkare camp assault has no Reputation loss, keeps survivors and awards exact shield progress", () => {
  const defenders = [
    enemy("camp-green", { tokenColor: "green" }),
    enemy("camp-gray", { tokenColor: "gray" }),
    enemy("camp-white", { tokenColor: "white" }),
    enemy("camp-red", { tokenColor: "red" }),
  ];
  const base = stateAt("none");
  const map = patchCell(base.map, "1,0", { terrain: "wasteland", site: "volkareCamp", revealed: true, conquered: false, tokenRevealed: true, enemies: defenders, enemy: defenders[0] });
  const entered = gameReducer({ ...base, map, turnBonus: resources({ move: 2, range: 100 }) }, { type: "START_MULTI_COMBAT", assaultCellId: "1,0", rampagerCellIds: [] });
  assert.equal(entered.reputation, base.reputation);
  assert.equal(entered.combat?.volkareAttackPending, true);

  const afterOne = gameReducer(entered, { type: "COMBAT_RANGED" });
  const retreated = gameReducer(afterOne, { type: "COMBAT_RETREAT" });
  assert.equal(retreated.position, base.position);
  assert.equal(enemiesOnCell(retreated.map.find((cell) => cell.id === "1,0")!).length, 3);
  assert.equal(retreated.volkareShields, 0, "one green/gray defeat is not yet a full shield");

  const all = stateAt("volkareCamp", { enemies: defenders, enemy: defenders[0] });
  const won = defeatAllAtRange({
    ...all,
    phase: "combat",
    turnBonus: resources({ range: 100 }),
    combat: { cellId: all.position, enemy: defenders[0], originId: all.position, kind: "assault", step: "ranged", blocked: false, queue: defenders.slice(1).map((foe) => ({ cellId: all.position, enemy: foe })), chainStartFame: all.fame },
  });
  assert.equal(won.volkareShields, 3, "green+gray = 1 shield; white and red = 1 each");
  assert.equal(won.conqueredCities, all.conqueredCities + 1);
});

test("Volkare attacks after surviving troops, but a complete ranged wipe prevents his attack", () => {
  const troop = enemy("camp-last-troop", { tokenColor: "white" });
  const base = stateAt("none");
  const map = patchCell(base.map, "1,0", { terrain: "wasteland", site: "volkareCamp", revealed: true, conquered: false, tokenRevealed: true, enemies: [troop], enemy: troop });
  const assault = gameReducer({ ...base, map, turnBonus: resources({ move: 2 }) }, { type: "START_MULTI_COMBAT", assaultCellId: "1,0", rampagerCellIds: [] });
  const attacks = gameReducer(assault, { type: "COMBAT_ADVANCE" });
  assert.equal(attacks.combat?.step, "block");
  assert.equal(attacks.combat?.enemy.id, troop.id);
  assert.equal(attacks.combat?.queue?.some((entry) => entry.enemy.id.startsWith("volkare-general-")), true);

  const rangedAssault = { ...assault, turnBonus: resources({ move: 2, range: 100 }) };
  const wiped = gameReducer(rangedAssault, { type: "COMBAT_RANGED" });
  assert.equal(wiped.phase, "planning");
  assert.equal(wiped.combat, undefined);
});

test("conquered Volkare camp grants hand/recruitment/offer/pursuit services at camp and adjacent spaces", () => {
  const base = stateAt("volkareCamp", { conquered: true, enemies: [], enemy: undefined });
  const green = ALL_ENEMY_TOKENS.find((token) => token.tokenColor === "green")!;
  const villageUnit = Object.values(ALL_UNIT_DEFS).find((unit) => (unit.recruitSites ?? [unit.site]).includes("village"))!;
  const keepUnit = Object.values(ALL_UNIT_DEFS).find((unit) => (unit.recruitSites ?? [unit.site]).includes("keep"))!;
  const regular = base.regularUnitDeck[0];
  let state: GameState = {
    ...base,
    ownedKeeps: 2,
    turnBonus: resources({ influence: 20, range: 100 }),
    unitOffer: [villageUnit.id, keepUnit.id],
    enemyDecks: { ...base.enemyDecks, green: [green.id] },
  };
  assert.equal(hasConqueredVolkareCampServices(state), true);
  assert.equal(handLimit(state), 8);
  assert.equal(canRecruitUnitAtCurrentSite(state, villageUnit), true);
  assert.equal(canRecruitUnitAtCurrentSite(state, keepUnit), true);

  const expanded = gameReducer(state, { type: "ADD_REGULAR_UNIT_TO_OFFER" });
  assert.equal(expanded.unitOffer.includes(regular), true);
  assert.equal(expanded.regularUnitDeck.includes(regular), false);

  state = { ...state, interactionSite: undefined, interactionModifierUsed: false };
  const pursuit = gameReducer(state, { type: "PURSUE_VOLKARE_ENEMIES", colors: ["green"] });
  assert.equal(pursuit.combat?.volkarePursuit, true);
  const fameBefore = pursuit.fame;
  const won = gameReducer(pursuit, { type: "COMBAT_RANGED" });
  assert.equal(won.fame, fameBefore + green.fame);
  assert.equal(won.volkarePursuitShields, 1);
  assert.equal(won.pursuedCampCellIds?.includes(base.position), true);
  const repeated = gameReducer({ ...won, phase: "planning", actionTaken: false }, { type: "PURSUE_VOLKARE_ENEMIES", colors: ["green"] });
  assert.equal(repeated.combat, undefined);
});

test("the four city colors modify armor, elemental attack, Brutal and Poison independently", () => {
  const physical = enemy("city-physical", { attack: 3 });
  const elemental = enemy("city-elemental", { attack: 3, attackElement: "fire" });
  const base = stateAt("none");
  const cityState = (tileId: string, foe: Enemy) => {
    const map = patchCell(base.map, base.position, { terrain: "city", site: "city1", tileId, enemies: [foe], enemy: foe, tokenRevealed: true });
    return { ...base, map, phase: "combat" as const, combat: { cellId: base.position, enemy: foe, originId: base.position, step: "block" as const, blocked: false } };
  };
  assert.equal(combatEnemyArmor(cityState("core-7", physical)), physical.armor + 1);
  assert.equal(combatDamageTotal(cityState("core-6", elemental)), elemental.attack + 2);
  assert.equal(combatDamageTotal(cityState("core-8", physical)), physical.attack * 2);

  const green = cityState("core-5", physical);
  const damaged = gameReducer(green, { type: "COMBAT_DAMAGE" });
  const resolved = gameReducer(damaged, { type: "COMBAT_DAMAGE" });
  assert.ok(resolved.discard.some((id) => id.startsWith("wound#")), "green city must add a poison Wound to discard");
});
