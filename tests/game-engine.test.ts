import assert from "node:assert/strict";
import test from "node:test";
import { ADVANCED_IDS, ALL_ENEMY_TOKENS, ALL_HEROES, ALL_RUIN_TOKENS, ALL_UNIT_DEFS, ARTIFACT_IDS, BASE_COMPONENT_COUNTS, CARD_DEFS, ELITE_UNIT_IDS, ENEMY_TOKEN_IDS, ENEMY_TOKENS, HERO_SKILLS, REGULAR_UNIT_IDS, RUIN_TOKENS, SPELL_IDS, STARTER_DECKS, ULTIMATE_COMPONENT_COUNTS, WOUND_IDS, getAdvancedIdsForMode, getArtifactIdsForMode, getCard, getEnemyTokenIdsForMode, getHeroesForMode, getRegularUnitIdsForMode, getRuinTokensForMode, getSpellIdsForMode, getStarterDecksForMode, getUnit, TERRAIN_COSTS, type MapCell, type SiteType } from "../lib/game-data";
import { applyGameActionWithRevert, availableManaCount, availableResources, availableTactics, availableTileExplorations, canActivateUnitAbility, combatBlockRequirement, combatDamageTotal, combatEnemyArmor, commandLimit, createGame as createGeneratedGame, createRevertHistory, effectiveAttackValue, effectiveBlockValue, enemiesOnCell, fameToNextLevel, gameReducer, generateMapSetup, handLimit, heroArmor, influenceCost, isAdjacent, levelFor, mapHandLimitBonus, migrateSiteEnemyLifecycle, reputationInfluenceModifier, revertLastAction, scoreGame, unitRecruitInfluenceCost, usedSource, type GameState, type MapShape } from "../lib/game-engine";
import { ALL_MAP_TILE_TEMPLATES, MAP_TILE_TEMPLATES, getMapTilePools, getMapTileTemplate } from "../lib/map-tiles";
import { unitArtStyle } from "../lib/visual-assets";

function encounter(site: SiteType) {
  if (site === "rampager") return { id: "orc-fixture", name: "兽人劫掠者", armor: 4, attack: 4, fame: 3, description: "测试用游荡敌人" };
  if (site === "keep") return { id: "guard-fixture", name: "要塞守军", armor: 5, attack: 4, fame: 4, fortified: true, description: "测试用守军" };
  return { id: "wraith-fixture", name: "遗迹幽魂", armor: 5, attack: 5, fame: 4, description: "测试用遗迹敌人" };
}

function patchCell(map: MapCell[], id: string, patch: Partial<MapCell>) {
  const [q, r] = id.split(",").map(Number);
  const existing = map.find((cell) => cell.id === id);
  const base: MapCell = existing ?? { id, q, r, terrain: "plains", site: "none", revealed: true, conquered: false, tokenRevealed: false };
  return [...map.filter((cell) => cell.id !== id), { ...base, ...patch, id, q, r }];
}

const createGame = (heroId: string, difficulty: "apprentice" | "standard" | "legendary" = "standard") => {
  const state = createGeneratedGame(heroId, difficulty, "classic", "wedge", 420_042);
  let map = state.map;
  map = patchCell(map, "1,0", { terrain: "plains", site: "rampager", enemy: encounter("rampager"), tokenRevealed: true, conquered: false });
  map = patchCell(map, "2,-1", { terrain: "plains", site: "keep", enemy: encounter("keep"), tokenRevealed: false, conquered: false });
  map = patchCell(map, "1,-1", { terrain: "forest", site: "village", enemy: undefined, tokenRevealed: true });
  map = patchCell(map, "2,1", { terrain: "hills", site: "monastery", enemy: undefined, tokenRevealed: true });
  map = patchCell(map, "3,-1", { terrain: "plains", site: "mageTower", enemy: undefined, tokenRevealed: true });
  map = patchCell(map, "3,0", { terrain: "plains", site: "ruins", enemy: encounter("ruins"), tokenRevealed: true, ruinsReward: "artifact", conquered: false });
  return { ...state, map };
};

test("creates the six-round solo conquest setup", () => {
  const state = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  assert.equal(state.phase, "tactic");
  assert.equal(state.round, 1);
  assert.equal(state.time, "day");
  assert.equal(state.hand.length, 5);
  assert.equal(state.deck.length, 11);
  assert.equal(state.map.length, 21);
  assert.equal(state.map.filter((cell) => cell.revealed).length, 21);
  assert.deepEqual(state.mapTiles.map((tile) => tile.templateId), ["start-a", "countryside-1", "countryside-2"]);
  assert.equal(state.tileDeck.length, 9);
  assert.equal(state.removedMapTiles.length, 8);
  assert.equal(state.map.filter((cell) => cell.site === "city1" || cell.site === "city2").length, 0);
  assert.equal(availableTactics(state).length, 6);
});

test("contains the complete physical component counts from the base game", () => {
  assert.equal(Object.values(CARD_DEFS).filter((card) => card.tier === "advanced").length, BASE_COMPONENT_COUNTS.advancedActions);
  assert.equal(Object.values(CARD_DEFS).filter((card) => card.tier === "spell").length, BASE_COMPONENT_COUNTS.spells);
  assert.equal(Object.values(CARD_DEFS).filter((card) => card.tier === "artifact").length, BASE_COMPONENT_COUNTS.artifacts);
  assert.equal(ADVANCED_IDS.length, 28);
  assert.equal(SPELL_IDS.length, 20);
  assert.equal(ARTIFACT_IDS.length, 16);
  assert.equal(REGULAR_UNIT_IDS.length, 20);
  assert.equal(ELITE_UNIT_IDS.length, 20);
  assert.equal(ENEMY_TOKENS.length, 60);
  assert.equal(RUIN_TOKENS.length, 12);
  assert.equal(WOUND_IDS.length, 40);
  assert.deepEqual(Object.fromEntries(Object.entries(ENEMY_TOKEN_IDS).map(([color, ids]) => [color, ids.length])), { green: 12, red: 8, gray: 10, violet: 10, brown: 10, white: 10 });
  assert.equal(Object.values(HERO_SKILLS).flat().length, 40);
});

test("gives every base hero a distinct sixteen-card starting deck and ten skills", () => {
  for (const heroId of ["tovak", "arythea", "goldyx", "norowas"]) {
    assert.equal(STARTER_DECKS[heroId].length, 16);
    assert.equal(HERO_SKILLS[heroId].length, 10);
    assert.equal(new Set(STARTER_DECKS[heroId]).size, 16);
  }
  assert.equal(getCard(STARTER_DECKS.tovak.find((id) => id.startsWith("coldToughness#"))!)?.heroId, "tovak");
  assert.equal(getCard(STARTER_DECKS.arythea.find((id) => id.startsWith("battleVersatility#"))!)?.heroId, "arythea");
  assert.equal(getCard(STARTER_DECKS.goldyx.find((id) => id.startsWith("willFocus#"))!)?.heroId, "goldyx");
  assert.equal(getCard(STARTER_DECKS.norowas.find((id) => id.startsWith("nobleManners#"))!)?.heroId, "norowas");
});

test("keeps the base and Ultimate Edition component pools strictly separated", () => {
  assert.equal(getHeroesForMode("base").length, 4);
  assert.equal(getHeroesForMode("ultimate").length, 7);
  assert.equal(ALL_HEROES.length, ULTIMATE_COMPONENT_COUNTS.heroes);
  assert.deepEqual(getHeroesForMode("base").map((hero) => hero.id), ["tovak", "arythea", "goldyx", "norowas"]);
  assert.deepEqual(getHeroesForMode("ultimate").slice(-3).map((hero) => hero.id), ["wolfhawk", "krang", "braevalar"]);

  assert.equal(getAdvancedIdsForMode("base").length, BASE_COMPONENT_COUNTS.advancedActions);
  assert.equal(getAdvancedIdsForMode("ultimate").length, ULTIMATE_COMPONENT_COUNTS.advancedActions);
  // Mana Meltdown and Mana Claim are physical Ultimate Edition components,
  // but the official solo setup removes these two competitive spells.
  assert.equal(getSpellIdsForMode("ultimate").length, ULTIMATE_COMPONENT_COUNTS.spells - 2);
  assert.equal(getArtifactIdsForMode("ultimate").length, ULTIMATE_COMPONENT_COUNTS.artifacts);
  assert.equal(getRegularUnitIdsForMode("ultimate").length, ULTIMATE_COMPONENT_COUNTS.regularUnits);
  assert.equal(ALL_ENEMY_TOKENS.length, ULTIMATE_COMPONENT_COUNTS.enemies);
  assert.equal(ALL_RUIN_TOKENS.length, ULTIMATE_COMPONENT_COUNTS.ruins);

  assert.ok(getAdvancedIdsForMode("base").every((id) => getCard(id)?.source === undefined || getCard(id)?.source === "base"));
  assert.ok(getAdvancedIdsForMode("ultimate").some((id) => getCard(id)?.source === "lost-legion"));
  assert.ok(getAdvancedIdsForMode("ultimate").some((id) => getCard(id)?.source === "dual-color"));
  assert.ok(getSpellIdsForMode("ultimate").some((id) => getCard(id)?.source === "lost-legion"));
  assert.ok(getArtifactIdsForMode("ultimate").some((id) => getCard(id)?.source === "dual-color"));
  assert.ok(getRuinTokensForMode("base").every((token) => !token.source || token.source === "base"));
  assert.ok(getRuinTokensForMode("ultimate").some((token) => token.source === "lost-legion"));
});

test("creates all three expansion heroes with their own sixteen-card starting decks", () => {
  const decks = getStarterDecksForMode("ultimate");
  for (const heroId of ["wolfhawk", "krang", "braevalar"]) {
    assert.equal(decks[heroId].length, 16);
    assert.equal(new Set(decks[heroId]).size, 16);
    const state = createGeneratedGame(heroId, "standard", "random", "wedge", 704_321, "ultimate");
    assert.equal(state.contentMode, "ultimate");
    assert.equal(state.heroId, heroId);
    assert.equal(state.hand.length + state.deck.length, 16);
    assert.ok([...state.hand, ...state.deck].some((instanceId) => getCard(instanceId)?.heroId === heroId));
  }
});

test("maps every unit identity to a unique portrait cell", () => {
  const portraits = ALL_UNIT_DEFS.map((unit) => {
    const style = unitArtStyle(unit.id);
    return `${style.backgroundImage}|${style.backgroundPosition}`;
  });
  assert.equal(portraits.length, 30);
  assert.equal(new Set(portraits).size, portraits.length);
  assert.notDeepEqual(unitArtStyle("altemMages"), unitArtStyle("delphanaMasters"));
});

test("uses mode-specific map tile and enemy bags in generated games", () => {
  const base = createGeneratedGame("wolfhawk", "standard", "random", "wedge", 337_711, "base");
  const ultimate = createGeneratedGame("wolfhawk", "standard", "random", "wedge", 337_711, "ultimate");
  assert.equal(base.contentMode, "base");
  assert.equal(base.heroId, "tovak");
  assert.equal(ultimate.heroId, "wolfhawk");

  const baseTiles = getMapTilePools("base");
  const ultimateTiles = getMapTilePools("ultimate");
  assert.equal([...baseTiles.countryside, ...baseTiles.coreNoncity, ...baseTiles.coreCity].length, 19);
  assert.equal([...ultimateTiles.countryside, ...ultimateTiles.coreNoncity, ...ultimateTiles.coreCity].length, 25);
  assert.equal(ALL_MAP_TILE_TEMPLATES.length, ULTIMATE_COMPONENT_COUNTS.mapTiles + 1, "起始板块 A/B 是同一实体板块的两面");
  assert.ok(ultimateTiles.countryside.some((tile) => tile.id === "countryside-12"));
  assert.ok(ALL_MAP_TILE_TEMPLATES.some((tile) => tile.id === "core-volkare" && tile.kind === "core-city"));

  for (const [color, ids] of Object.entries(getEnemyTokenIdsForMode("base"))) {
    assert.equal(ids.length, ENEMY_TOKEN_IDS[color as keyof typeof ENEMY_TOKEN_IDS].length);
  }
  assert.ok(Object.entries(getEnemyTokenIdsForMode("ultimate")).some(([color, ids]) => ids.length > ENEMY_TOKEN_IDS[color as keyof typeof ENEMY_TOKEN_IDS].length));
  const ultimateEnemyTotal = Object.values(ultimate.enemyDecks).reduce((sum, ids) => sum + ids.length, 0)
    + ultimate.map.flatMap(enemiesOnCell).length;
  assert.equal(ultimateEnemyTotal, ULTIMATE_COMPONENT_COUNTS.enemies);
});

test("uses the high Elusive armor until every printed attack is blocked", () => {
  const enemy = { id: "elusive-fixture", name: "飘忽敌人", armor: 3, elusiveArmor: 7, attack: 4, fame: 4, description: "测试" };
  let state: ReturnType<typeof createGeneratedGame> = {
    ...createGeneratedGame("wolfhawk", "standard", "random", "wedge", 41, "ultimate"),
    phase: "combat",
    combat: { cellId: "0,0", originId: "0,0", enemy, step: "ranged", blocked: false },
  };
  assert.equal(combatEnemyArmor(state), 7);
  state = { ...state, combat: { ...state.combat!, step: "attack" } };
  assert.equal(combatEnemyArmor(state), 7);
  state = { ...state, combat: { ...state.combat!, successfullyBlockedEnemyIds: [enemy.id] } };
  assert.equal(combatEnemyArmor(state), 3);
});

test("spends movement to reduce a Cumbersome attack for both block and damage", () => {
  const enemy = { id: "cumbersome-fixture", name: "投石车", armor: 7, attack: 5, fame: 5, cumbersome: true, description: "测试" };
  let state: ReturnType<typeof createGeneratedGame> = {
    ...createGeneratedGame("krang", "standard", "random", "wedge", 42, "ultimate"),
    phase: "combat",
    turnBonus: { ...createGeneratedGame("krang", "standard", "random", "wedge", 42, "ultimate").turnBonus, move: 2 },
    combat: { cellId: "0,0", originId: "0,0", enemy, step: "block", blocked: false },
  };
  assert.equal(combatBlockRequirement(state), 5);
  state = gameReducer(state, { type: "COMBAT_REDUCE_CUMBERSOME" });
  state = gameReducer(state, { type: "COMBAT_REDUCE_CUMBERSOME" });
  assert.equal(state.spent.move, 2);
  assert.equal(combatBlockRequirement(state), 3);
  state = gameReducer(state, { type: "COMBAT_DAMAGE" });
  assert.equal(state.combat?.damageRemaining, 3);
});

test("applies the Refugee Camp recruitment surcharge and one-unit limit", () => {
  const foresters = getUnit("foresters")!;
  const keepSwordsmen = getUnit("utemSwordsmen")!;
  const cityHero = getUnit("heroWhite")!;
  const base = createGeneratedGame("braevalar", "standard", "random", "wedge", 43, "ultimate");
  const state = {
    ...base,
    phase: "planning" as const,
    map: patchCell(base.map, base.position, { site: "refugeeCamp", conquered: true }),
  };
  assert.equal(unitRecruitInfluenceCost(state, foresters), foresters.cost);
  assert.equal(unitRecruitInfluenceCost(state, keepSwordsmen), keepSwordsmen.cost + 1);
  assert.equal(unitRecruitInfluenceCost(state, cityHero), cityHero.cost + 3);
});

test("uses finite shuffled enemy-token piles and physical regular unit copies", () => {
  const state = createGeneratedGame("tovak", "standard", "random", "wedge", 902_010);
  for (const color of Object.keys(ENEMY_TOKEN_IDS) as Array<keyof typeof ENEMY_TOKEN_IDS>) {
    const onMap = state.map.flatMap(enemiesOnCell).filter((enemy) => enemy.tokenColor === color).length;
    assert.equal(state.enemyDecks[color].length + state.enemyDiscards[color].length + onMap, ENEMY_TOKEN_IDS[color].length);
  }
  assert.equal(state.unitOffer.length, 3);
  assert.ok(state.unitOffer.every((id) => getUnit(id)?.tier === "regular"));
  assert.equal(state.regularUnitDeck.length + state.unitOffer.length, REGULAR_UNIT_IDS.length);
  assert.equal(state.eliteUnitDeck.length, ELITE_UNIT_IDS.length);
  const ruinsOnMap = state.map.filter((cell) => cell.ruinTokenId).length;
  assert.equal(state.ruinDeck.length + state.ruinDiscards.length + ruinsOnMap, RUIN_TOKENS.length);
});

test("removes an artifact from the game after its stronger ability is used", () => {
  const artifactId = ARTIFACT_IDS[0];
  const instanceId = `${artifactId}#test`;
  const artifact = CARD_DEFS[artifactId];
  let state: ReturnType<typeof createGeneratedGame> = {
    ...createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042),
    phase: "planning" as const,
    hand: [instanceId],
    deck: [],
    artifacts: 1,
    artifactInventory: [artifact.name],
  };
  state = gameReducer(state, { type: "PLAY_CARD", instanceId, mode: "powered" });
  assert.equal(state.played[0]?.mode, "powered");
  state = gameReducer(state, { type: "END_TURN" });
  assert.ok(state.removedCards.includes(instanceId));
  assert.ok(!state.discard.includes(instanceId));
  assert.equal(state.artifacts, 0);
});

test("selects tactics, explores one fixed seven-space tile, and preserves the hero position", () => {
  let state = createGeneratedGame("goldyx", "standard", "classic", "wedge", 420_042);
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d2" });
  assert.equal(state.phase, "planning");
  assert.ok(state.dummyTactic);
  state = { ...state, position: "3,-1", turnBonus: { ...state.turnBonus, move: 20 } };
  const target = availableTileExplorations(state)[0];
  assert.ok(target);
  const template = getMapTileTemplate(state.tileDeck[0]);
  const positionBefore = state.position;
  const tileCountBefore = state.mapTiles.length;
  const cellCountBefore = state.map.length;
  const before = availableResources(state).move;
  state = gameReducer(state, { type: "EXPLORE_TILE", tq: target.tq, tr: target.tr });
  assert.equal(state.position, positionBefore);
  assert.equal(state.mapTiles.length, tileCountBefore + 1);
  assert.equal(state.map.length, cellCountBefore + 7);
  assert.equal(state.tileDeck.length, 8);
  assert.equal(availableResources(state).move, before - 2);
  const placement = state.mapTiles.at(-1)!;
  const revealed = state.map.filter((cell) => cell.tileId === placement.id);
  assert.deepEqual(revealed.map(({ tileLocal, terrain, site, mineColor }) => ({ tileLocal, terrain, site, mineColor })), template.cells.map(({ local, terrain, site, mineColor }) => ({ tileLocal: local, terrain, site, mineColor })));
});

test("challenges a rampaging enemy from an adjacent space without entering or spending move", () => {
  let state = createGame("tovak", "standard");
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d2" });
  state = { ...state, turnBonus: { ...state.turnBonus, move: 20 } };
  const moveBefore = availableResources(state).move;
  state = gameReducer(state, { type: "MAP_CLICK", cellId: "1,0" });
  assert.equal(state.phase, "combat");
  assert.equal(state.position, "0,0");
  assert.equal(state.combat?.cellId, "1,0");
  assert.equal(state.actionTaken, true);
  assert.equal(availableResources(state).move, moveBefore);
});

test("provokes mandatory combat when moving between two spaces adjacent to an orc", () => {
  let state = createGame("tovak", "standard");
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d2" });
  state = { ...state, turnBonus: { ...state.turnBonus, move: 20 } };
  const moveBefore = availableResources(state).move;
  const moveCost = TERRAIN_COSTS[state.map.find((cell) => cell.id === "1,-1")!.terrain][state.time];
  state = gameReducer(state, { type: "MAP_CLICK", cellId: "1,-1" });
  assert.equal(state.phase, "combat");
  assert.equal(state.position, "1,-1");
  assert.equal(state.combat?.cellId, "1,0");
  assert.equal(state.combat?.originId, "1,-1");
  assert.equal(availableResources(state).move, moveBefore - moveCost);
  assert.match(state.log[0], /激怒并强制开战/);
});

test("queues a fortified defender when an assault also provokes a rampaging enemy", () => {
  let state = createGame("tovak", "standard");
  state = {
    ...state,
    phase: "planning",
    position: "1,-1",
    map: state.map.map((cell) => cell.id === "2,-1" ? { ...cell, revealed: true, tokenRevealed: true } : cell),
    turnBonus: { ...state.turnBonus, move: 20, attack: 50 },
  };
  state = gameReducer(state, { type: "MAP_CLICK", cellId: "2,-1" });
  assert.equal(state.phase, "combat");
  assert.equal(state.position, "2,-1");
  assert.equal(state.combat?.cellId, "1,0");
  assert.equal(state.combat?.queue?.[0]?.cellId, "2,-1");
  assert.equal(state.combat?.originId, "1,-1");
  assert.equal(state.reputation, -1);
  state = { ...state, combat: { ...state.combat!, step: "attack" } };
  state = gameReducer(state, { type: "COMBAT_ATTACK" });
  assert.equal(state.phase, "combat");
  assert.equal(state.combat?.cellId, "2,-1");
  assert.equal(state.map.find((cell) => cell.id === "1,0")?.enemy, undefined);
  state = { ...state, combat: { ...state.combat!, step: "attack" } };
  state = gameReducer(state, { type: "COMBAT_ATTACK" });
  assert.equal(state.map.find((cell) => cell.id === "2,-1")?.conquered, true);
  assert.equal(state.phase, "skill");
});

test("resolves multiple enemies through one shared set of combat phases", () => {
  let state = createGame("tovak", "standard");
  state = {
    ...state,
    phase: "planning",
    position: "1,-1",
    map: state.map.map((cell) => cell.id === "2,-1" ? { ...cell, revealed: true, tokenRevealed: true } : cell),
    turnBonus: { ...state.turnBonus, move: 20, block: 50, attack: 50 },
  };
  state = gameReducer(state, { type: "MAP_CLICK", cellId: "2,-1" });
  assert.equal(state.combat?.enemy.name, "兽人劫掠者");

  state = gameReducer(state, { type: "COMBAT_ADVANCE" });
  assert.equal(state.combat?.step, "ranged");
  assert.equal(state.combat?.cellId, "2,-1");
  state = gameReducer(state, { type: "COMBAT_ADVANCE" });
  assert.equal(state.combat?.step, "block");
  assert.equal(state.combat?.enemy.name, "兽人劫掠者");

  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  assert.equal(state.combat?.step, "block");
  assert.equal(state.combat?.cellId, "2,-1");
  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  assert.equal(state.combat?.step, "attack");
  assert.equal(state.combat?.enemy.name, "兽人劫掠者");

  state = gameReducer(state, { type: "COMBAT_ATTACK" });
  assert.equal(state.combat?.step, "attack");
  assert.equal(state.combat?.cellId, "2,-1");
});

test("allows only one source die per turn and uses crystals afterwards", () => {
  let state = createGame("tovak", "standard");
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d1" });
  state = {
    ...state,
    hand: ["march#1", "stamina#1", "rage#1"],
    source: [{ color: "green" }, { color: "green" }, { color: "red" }],
    crystals: { red: 1, blue: 1, green: 2, white: 1 },
  };
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "march#1", mode: "powered" });
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "stamina#1", mode: "powered" });
  const sourceUses = state.played.filter((play) => play.manaUse?.type === "source");
  const crystalUses = state.played.filter((play) => play.manaUse?.type === "crystal");
  assert.equal(sourceUses.length, 1);
  assert.equal(crystalUses.length, 1);
  assert.equal(availableResources(state).move, 8);
});

test("implements Mana Draw basic effect as one additional Source die without drawing a card", () => {
  let state: GameState = {
    ...createGame("tovak", "standard"),
    phase: "planning" as const,
    hand: ["manaDraw#basic", "march#mana-a", "promise#mana-b"],
    source: [{ color: "red" as const }, { color: "green" as const }, { color: "white" as const }],
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
  };
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "manaDraw#basic", mode: "basic" });
  assert.equal(availableResources(state).draw, 0);
  assert.equal(availableResources(state).crystal, 0);
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "march#mana-a", mode: "powered" });
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "promise#mana-b", mode: "powered" });
  assert.equal(state.played.length, 3);
  assert.equal(usedSource(state, 1), true);
  assert.equal(usedSource(state, 2), true);
});

test("implements Mana Draw strong effect by recoloring a Source die and gaining two temporary mana", () => {
  const base = {
    ...createGame("tovak", "standard"),
    phase: "planning" as const,
    hand: ["manaDraw#strong", "march#mana-c", "stamina#mana-d"],
    source: [{ color: "white" as const }, { color: "red" as const }, { color: "blue" as const }],
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
  };
  let state = gameReducer(base, { type: "PLAY_CARD", instanceId: "manaDraw#strong", mode: "powered", manaDrawDieIndex: 1, manaDrawColor: "green" });
  assert.equal(state.source[1].color, "green");
  assert.equal(state.manaTokens.green, 2);
  assert.equal(availableResources(state).draw, 0);
  assert.equal(availableResources(state).crystal, 0);
  assert.equal(usedSource(state, 0), true);
  assert.equal(usedSource(state, 1), true);

  const restored = gameReducer(state, { type: "UNPLAY_CARD", instanceId: "manaDraw#strong" });
  assert.equal(restored.source[1].color, "red");
  assert.equal(restored.manaTokens.green, 0);

  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "march#mana-c", mode: "powered" });
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "stamina#mana-d", mode: "powered" });
  assert.equal(state.manaTokens.green, 0);
  const cannotUnplay = gameReducer(state, { type: "UNPLAY_CARD", instanceId: "manaDraw#strong" });
  assert.equal(cannotUnplay.played.some((play) => play.instanceId === "manaDraw#strong"), true);
  assert.match(cannotUnplay.log[0], /临时魔力已经被使用/);
});

test("runs combat in the official phase order", () => {
  let state = createGame("arythea", "apprentice");
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d2" });
  state = { ...state, turnBonus: { ...state.turnBonus, move: 20, block: 20, attack: 20 } };
  state = gameReducer(state, { type: "MAP_CLICK", cellId: "1,0" });
  assert.equal(state.phase, "combat");
  assert.equal(state.combat?.step, "ranged");
  state = gameReducer(state, { type: "COMBAT_ADVANCE" });
  assert.equal(state.combat?.step, "block");
  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  assert.equal(state.combat?.step, "attack");
  const fameBefore = state.fame;
  state = gameReducer(state, { type: "COMBAT_ATTACK" });
  assert.equal(state.phase, "skill");
  assert.ok(state.fame > fameBefore);
  assert.equal(state.reputation, 1);
  assert.equal(state.map.find((cell) => cell.id === "1,0")?.conquered, true);
  state = gameReducer(state, { type: "CHOOSE_SKILL", skillId: state.pendingSkillChoices[0] });
  assert.equal(state.phase, "skill");
  assert.equal(state.pendingAdvancedChoices?.length, 3);
  state = gameReducer(state, { type: "CHOOSE_LEVEL_ADVANCED", cardId: state.pendingAdvancedChoices![0] });
  assert.equal(state.phase, "planning");
});

test("advances the dummy timer at the end of a player turn", () => {
  let state = createGame("norowas", "standard");
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d1" });
  const before = state.dummyDeck;
  state = gameReducer(state, { type: "DISCARD_CARD", instanceId: state.hand[0] });
  state = gameReducer(state, { type: "END_TURN" });
  assert.ok(state.dummyDeck < before || state.finalTurn);
  assert.equal(state.turnsTaken, 1);
});

test("offers a hero skill at an even level and applies the chosen passive", () => {
  let state = createGame("tovak", "apprentice");
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d2" });
  state = { ...state, fame: 0, turnBonus: { ...state.turnBonus, move: 20, block: 20, attack: 20 } };
  state = gameReducer(state, { type: "MAP_CLICK", cellId: "1,0" });
  state = gameReducer(state, { type: "COMBAT_ADVANCE" });
  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  state = gameReducer(state, { type: "COMBAT_ATTACK" });
  assert.equal(state.phase, "skill");
  assert.equal(state.pendingSkillChoices.length, 2);
  const chosen = state.pendingSkillChoices[0];
  state = gameReducer(state, { type: "CHOOSE_SKILL", skillId: chosen });
  assert.equal(state.phase, "skill");
  assert.deepEqual(state.skills, [chosen]);
  const advanced = state.pendingAdvancedChoices![0];
  state = gameReducer(state, { type: "CHOOSE_LEVEL_ADVANCED", cardId: advanced });
  assert.equal(state.phase, "planning");
  assert.equal(getCard(state.deck[0])?.tier, "advanced");
});

test("uses the official nonlinear fame thresholds and level-token stats", () => {
  const state = createGame("tovak", "standard");
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(3), 2);
  assert.equal(levelFor(8), 3);
  assert.equal(levelFor(24), 5);
  assert.equal(fameToNextLevel(9), 6);
  assert.equal(fameToNextLevel(99), 0);
  assert.equal(heroArmor({ ...state, fame: 8 }), 3);
  assert.equal(handLimit({ ...state, fame: 24 }), 6);
  assert.equal(commandLimit({ ...state, fame: 8 }), 2);
});

test("separates reputation track position from its influence modifier", () => {
  const state = createGame("tovak", "standard");
  assert.equal(reputationInfluenceModifier(state), 0);
  assert.equal(reputationInfluenceModifier({ ...state, reputation: 1 }), 0);
  assert.equal(reputationInfluenceModifier({ ...state, reputation: 2 }), 1);
  assert.equal(influenceCost({ ...state, reputation: 2 }, 5), 4);
  assert.equal(reputationInfluenceModifier({ ...state, reputation: -5 }), null);
});

test("reveals token information according to site and day-night rules", () => {
  let state = createGame("tovak", "standard");
  assert.equal(state.map.find((cell) => cell.site === "rampager" && cell.revealed)?.tokenRevealed, true);
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d2" });
  state = { ...state, position: "1,-1", turnBonus: { ...state.turnBonus, move: 20 } };
  state = gameReducer(state, { type: "MAP_CLICK", cellId: "2,-1" });
  assert.equal(state.map.find((cell) => cell.id === "2,-1")?.tokenRevealed, true);

  let night = createGame("tovak", "standard");
  night = { ...night, phase: "planning", time: "night", position: "1,-1", turnBonus: { ...night.turnBonus, move: 20 } };
  assert.equal(night.map.find((cell) => cell.id === "2,-1")?.tokenRevealed, false);
  night = gameReducer(night, { type: "MAP_CLICK", cellId: "2,-1" });
  assert.equal(night.map.find((cell) => cell.id === "2,-1")?.tokenRevealed, true);
  assert.equal(night.reputation, -1);
});

test("records ancient-ruin artifacts in a visible inventory and event log", () => {
  let state = createGame("goldyx", "standard");
  const ruins = state.map.find((cell) => cell.site === "ruins")!;
  state = {
    ...state,
    phase: "combat",
    position: ruins.id,
    map: state.map.map((cell) => cell.id === ruins.id ? { ...cell, revealed: true, tokenRevealed: true } : cell),
    turnBonus: { ...state.turnBonus, attack: 30 },
    combat: { cellId: ruins.id, enemy: ruins.enemy!, originId: "0,0", step: "attack", blocked: true },
  };
  state = gameReducer(state, { type: "COMBAT_ATTACK" });
  assert.equal(state.artifacts, 1);
  assert.equal(state.artifactInventory.length, 1);
  assert.equal(getCard(state.deck[0])?.tier, "artifact");
  assert.match(state.log[0], /获得遗物/);
});

test("skill bonuses contribute to armor, hand limit, and turn resources", () => {
  const state = {
    ...createGame("tovak", "standard"),
    skills: ["tovak-ice-guard", "tovak-frozen-plate", "tovak-focus"],
  };
  assert.equal(heroArmor(state), 3);
  assert.equal(handLimit(state), 6);
  assert.equal(availableResources(state).block, 1);
});

test("keeps the public unit offer visible and does not refill it immediately after recruitment", () => {
  let state = createGame("norowas", "standard");
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d5" });
  state = {
    ...state,
    position: "1,-1",
    unitOffer: ["foresters", "guardsmen"],
    turnBonus: { ...state.turnBonus, influence: 20 },
  };
  state = gameReducer(state, { type: "RECRUIT", unitId: "foresters" });
  assert.deepEqual(state.unitOffer, ["guardsmen"]);
  assert.equal(state.units.at(-1)?.id, "foresters");
});

test("adds a monastery advanced action to the public unit offer when revealed", () => {
  let state = createGeneratedGame("goldyx", "standard", "classic", "wedge", 420_042);
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d2" });
  const deckBefore = state.advancedDeck.length;
  state = {
    ...state,
    position: "3,-1",
    tileDeck: ["countryside-5", ...state.tileDeck.slice(1)],
    turnBonus: { ...state.turnBonus, move: 20, influence: 20 },
  };
  const target = availableTileExplorations(state)[0];
  state = gameReducer(state, { type: "EXPLORE_TILE", tq: target.tq, tr: target.tr });
  assert.equal(state.monasteryOffer.length, 1);
  assert.equal(state.advancedDeck.length, deckBefore - 1);
  state = { ...state, position: state.map.find((cell) => cell.site === "monastery")!.id };
  const offeredCard = state.monasteryOffer[0];
  state = gameReducer(state, { type: "BUY_CARD", cardId: offeredCard, tier: "advanced" });
  assert.equal(state.monasteryOffer.length, 0);
  assert.ok(state.deck[0].startsWith(`${offeredCard}#`));
});

test("refreshes the public unit offer at the start of a new round", () => {
  let state = createGame("tovak", "standard");
  state = { ...state, phase: "planning", finalTurn: true, unitOffer: [], actionTaken: true };
  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.round, 2);
  assert.equal(state.unitOffer.length, 3);
});

test("uses the official lower healing cost at a monastery", () => {
  let state = createGame("tovak", "standard");
  state = {
    ...state,
    phase: "planning",
    position: "2,1",
    hand: [...state.hand, "wound#test"],
    turnBonus: { ...state.turnBonus, influence: 2 },
  };
  state = gameReducer(state, { type: "HEAL_WITH_INFLUENCE" });
  assert.equal(state.hand.includes("wound#test"), false);
  assert.equal(state.spent.influence, 2);
});

test("requires matching mana as well as influence to learn a spell", () => {
  let state = createGame("tovak", "standard");
  state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d5" });
  state = {
    ...state,
    position: "3,-1",
    map: state.map.map((cell) => cell.id === "3,-1" ? { ...cell, revealed: true, conquered: true, enemy: undefined } : cell),
    spellOffer: ["firestorm"],
    spellDeck: state.spellDeck.filter((card) => card !== "firestorm"),
    source: [{ color: "blue" }, { color: "green" }, { color: "white" }],
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
    turnBonus: { ...state.turnBonus, influence: 20 },
  };
  state = gameReducer(state, { type: "BUY_CARD", cardId: "firestorm", tier: "spell" });
  assert.deepEqual(state.spellOffer, ["firestorm"]);
  state = { ...state, source: [{ color: "red" }, { color: "green" }, { color: "white" }] };
  state = gameReducer(state, { type: "BUY_CARD", cardId: "firestorm", tier: "spell" });
  assert.equal(state.spellOffer.includes("firestorm"), false);
  assert.equal(state.marketManaUses.length, 1);
  assert.equal(getCard(state.deck[0])?.id, "firestorm");
});

test("starts heroes without crystals as required by the full-game setup", () => {
  const state = createGame("tovak", "standard");
  assert.deepEqual(state.crystals, { red: 0, blue: 0, green: 0, white: 0 });
});

test("treats ruins and monster dens as optional actions after movement", () => {
  let state = createGame("goldyx", "standard");
  const ruins = state.map.find((cell) => cell.id === "3,0")!;
  state = {
    ...state,
    phase: "planning",
    position: "2,0",
    map: state.map.map((cell) => cell.id === ruins.id ? { ...cell, revealed: true, tokenRevealed: true } : cell),
    turnBonus: { ...state.turnBonus, move: 20 },
  };
  state = gameReducer(state, { type: "MAP_CLICK", cellId: ruins.id });
  assert.equal(state.position, ruins.id);
  assert.equal(state.phase, "planning");
  assert.equal(state.actionTaken, false);
  state = gameReducer(state, { type: "ENTER_ADVENTURE" });
  assert.equal(state.phase, "combat");
  assert.equal(state.combat?.kind, "adventure");
  state = { ...state, combat: { ...state.combat!, step: "attack" } };
  state = gameReducer(state, { type: "COMBAT_RETREAT" });
  assert.equal(state.position, ruins.id);
});

test("invokes every ancient-ruin altar with three matching mana from mixed legal sources", () => {
  for (const color of ["red", "blue", "green", "white"] as const) {
    const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
    const altarId = `altar-${color}`;
    const state: GameState = {
      ...base,
      phase: "planning",
      fame: 35,
      position: "0,0",
      source: [{ color }, { color: "black" }, { color: "black" }],
      crystals: { ...base.crystals, [color]: 1 },
      manaTokens: { ...base.manaTokens, [color]: 1 },
      marketManaUses: [],
      unitManaUses: [],
      map: patchCell(base.map, "0,0", { site: "ruins", ruinTokenId: altarId, ruinAltarColor: undefined, ruinsReward: undefined, tokenRevealed: true, conquered: false, enemy: undefined, enemies: [] }),
    };

    assert.equal(availableManaCount(state, color), 3, `${color}色祭坛应接受临时魔力、源泉与水晶的组合`);
    const invoked = gameReducer(state, { type: "ENTER_ADVENTURE" });
    assert.equal(invoked.map.find((cell) => cell.id === "0,0")?.conquered, true);
    assert.equal(invoked.fame, 42);
    assert.equal(invoked.crystals[color], 0);
    assert.equal(invoked.manaTokens[color], 0);
    assert.equal(usedSource(invoked, 0), true);
    assert.equal(invoked.actionTaken, true);
    assert.equal(invoked.ruinDiscards.includes(altarId), true);
  }
});

test("invokes the red altar with the screenshot mix of one crystal and two temporary mana", () => {
  const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  const state: GameState = {
    ...base,
    phase: "planning",
    fame: 35,
    position: "0,0",
    source: [{ color: "black" }, { color: "black" }, { color: "black" }],
    crystals: { ...base.crystals, red: 1 },
    manaTokens: { ...base.manaTokens, red: 2 },
    marketManaUses: [],
    unitManaUses: [],
    map: patchCell(base.map, "0,0", { site: "ruins", ruinTokenId: "altar-red", ruinAltarColor: "red", ruinsReward: "fame", tokenRevealed: true, conquered: false, enemy: undefined, enemies: [] }),
  };

  assert.equal(availableManaCount(state, "red"), 3);
  const invoked = gameReducer(state, { type: "ENTER_ADVENTURE" });
  assert.equal(invoked.map.find((cell) => cell.id === "0,0")?.conquered, true);
  assert.equal(invoked.fame, 42);
  assert.equal(invoked.crystals.red, 0);
  assert.equal(invoked.manaTokens.red, 0);
});

test("enters an enemy-bearing yellow ruin token and draws its full encounter", () => {
  const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  const state: GameState = {
    ...base,
    phase: "planning",
    position: "0,0",
    map: patchCell(base.map, "0,0", {
      site: "ruins",
      ruinTokenId: "brown-violet",
      ruinAltarColor: undefined,
      ruinsReward: "artifact",
      tokenRevealed: true,
      conquered: false,
      enemy: undefined,
      enemies: [],
    }),
  };

  const entered = gameReducer(state, { type: "ENTER_ADVENTURE" });
  const ruin = entered.map.find((cell) => cell.id === "0,0")!;
  assert.equal(entered.phase, "combat");
  assert.equal(entered.actionTaken, true);
  assert.equal(entered.combat?.kind, "adventure");
  assert.equal(entered.combat?.cellId, "0,0");
  assert.equal(entered.combat?.queue?.length, 1);
  assert.deepEqual(enemiesOnCell(ruin).map((enemy) => enemy.tokenColor), ["brown", "violet"]);
});

test("allows undoing a deterministic altar tribute but locks it when the Fame reward reveals skills", () => {
  const makeAltar = (fame: number) => {
    const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
    return {
      ...base,
      phase: "planning" as const,
      fame,
      position: "0,0",
      crystals: { ...base.crystals, red: 3 },
      map: patchCell(base.map, "0,0", { site: "ruins", ruinTokenId: "altar-red", ruinAltarColor: "red", ruinsReward: "fame", tokenRevealed: true, conquered: false, enemy: undefined, enemies: [] }),
    };
  };

  let history = applyGameActionWithRevert(createRevertHistory(makeAltar(35)), { type: "ENTER_ADVENTURE" });
  assert.equal(history.past.length, 1);
  assert.match(history.past[0].label, /祭拜/);
  history = revertLastAction(history);
  assert.equal(history.present.fame, 35);
  assert.equal(history.present.crystals.red, 3);
  assert.equal(history.present.map.find((cell) => cell.id === "0,0")?.conquered, false);

  const leveling = applyGameActionWithRevert(createRevertHistory(makeAltar(0)), { type: "ENTER_ADVENTURE" });
  assert.equal(leveling.present.phase, "skill");
  assert.equal(leveling.past.length, 0);
  assert.match(leveling.boundaryReason, /技能选择/);
});

test("applies keep and city hand bonuses only while on or adjacent to them", () => {
  let state = createGame("tovak", "standard");
  state = {
    ...state,
    ownedKeeps: 2,
    position: "1,-1",
    map: state.map.map((cell) => (cell.id === "2,-1" || cell.id === "4,-2") ? { ...cell, conquered: true, enemy: undefined } : cell),
  };
  assert.equal(mapHandLimitBonus(state), 2);
  assert.equal(handLimit(state), 7);
  state = { ...state, position: "6,3" };
  assert.equal(mapHandLimitBonus(state), 0);
  assert.equal(handLimit(state), 5);
  state = {
    ...state,
    position: "6,1",
    map: patchCell(patchCell(state.map, "6,1", { terrain: "plains", site: "none" }), "6,2", { terrain: "city", site: "city1", conquered: true, enemy: undefined, tokenRevealed: true }),
  };
  assert.equal(mapHandLimitBonus(state), 2);
});

test("uses slow recovery when a resting hand contains only wounds", () => {
  let state = { ...createGame("tovak", "standard"), phase: "planning" as const, hand: ["wound#a", "wound#b", "wound#c"] };
  state = gameReducer(state, { type: "REST" });
  assert.equal(state.hand.length, 2);
  assert.equal(state.discard.filter((id) => id.startsWith("wound#")).length, 1);

  state = { ...createGame("tovak", "standard"), phase: "planning" as const, hand: ["rage#1", "wound#a", "wound#b"] };
  state = gameReducer(state, { type: "REST" });
  assert.equal(state.hand.length, 0);
  assert.equal(state.discard.length, 3);
});

test("keeps wounded units wounded across rounds and lets healing effects restore them", () => {
  let state = {
    ...createGame("tovak", "standard"),
    phase: "planning" as const,
    units: [{ id: "guardsmen", used: true, wounded: true }],
    turnBonus: { ...createGame("tovak", "standard").turnBonus, heal: 2 },
  };
  state = gameReducer(state, { type: "HEAL_UNIT", unitId: "guardsmen" });
  assert.equal(state.units[0].wounded, false);
  state = { ...state, units: [{ id: "guardsmen", used: true, wounded: true }], finalTurn: true, actionTaken: true };
  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.round, 2);
  assert.equal(state.units[0].used, false);
  assert.equal(state.units[0].wounded, true);
});

test("allows units to absorb combat damage and enforces the knockout threshold", () => {
  let state = {
    ...createGame("tovak", "standard"),
    phase: "combat" as const,
    hand: ["rage#1", "march#1"],
    units: [{ id: "guardsmen", used: false, wounded: false }],
    combat: { cellId: "1,0", enemy: { id: "audit", name: "审计敌军", armor: 9, attack: 5, fame: 0, description: "测试" }, originId: "0,0", kind: "rampager" as const, step: "block" as const, blocked: false },
  };
  state = gameReducer(state, { type: "COMBAT_DAMAGE" });
  assert.equal(state.combat?.damageRemaining, 5);
  state = gameReducer(state, { type: "ASSIGN_DAMAGE_UNIT", unitId: "guardsmen" });
  assert.equal(state.units[0].wounded, true);
  assert.equal(state.combat?.step, "attack");
  assert.equal(state.hand.filter((id) => id.startsWith("wound#")).length, 0);

  state = {
    ...state,
    phase: "combat",
    hand: ["rage#1", "march#1"],
    combat: { ...state.combat!, enemy: { ...state.combat!.enemy, attack: 10 }, step: "damage", damageRemaining: 10 },
  };
  state = gameReducer(state, { type: "COMBAT_DAMAGE" });
  assert.equal(state.hand.every((id) => id.startsWith("wound#")), true);
  assert.equal(state.hand.length, 5);
});

test("applies elemental block efficiency and enemy attack resistances", () => {
  let state = createGame("tovak");
  const enemy = { id: "elemental-audit", name: "元素审计", armor: 7, attack: 4, fame: 0, attackElement: "fire" as const, resistances: ["fire" as const], description: "测试" };
  state = {
    ...state,
    phase: "combat",
    turnBonus: { ...state.turnBonus, block: 6, iceBlock: 2, attack: 6, fireAttack: 4 },
    combat: { cellId: "1,0", enemy, originId: "0,0", step: "block", blocked: false },
  };
  assert.equal(effectiveBlockValue(state), 5, "物理格挡 6 减半为 3，寒冰格挡 2 全额生效");
  assert.equal(effectiveAttackValue(state, enemy, "attack"), 8, "火焰攻击 4 被抗性减半，物理攻击 6 全额生效");
  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  assert.equal(state.combat?.step, "attack");
});

test("pools every inefficient contribution before halving and rounding once", () => {
  let state = createGame("tovak");
  const fireEnemy = { id: "fire-audit", name: "火焰审计", armor: 1, attack: 2, fame: 0, attackElement: "fire" as const, description: "测试" };
  state = {
    ...state,
    phase: "combat",
    turnBonus: { ...state.turnBonus, block: 1, fireBlock: 1 },
    combat: { cellId: "1,0", enemy: fireEnemy, originId: "0,0", step: "block", blocked: false },
  };
  assert.equal(effectiveBlockValue(state), 1, "物理 1 与火焰格挡 1 都低效，合计 2 后减半为 1");

  const resistantEnemy = { ...fireEnemy, id: "dual-resist-audit", resistances: ["fire" as const, "ice" as const] };
  state = {
    ...state,
    turnBonus: { ...state.turnBonus, block: 0, fireBlock: 0, fireAttack: 1, iceAttack: 1 },
    combat: { ...state.combat!, enemy: resistantEnemy, step: "attack" },
  };
  assert.equal(effectiveAttackValue(state, resistantEnemy, "attack"), 1, "两种低效攻击合计 2 后只舍入一次");
});

test("enforces siege attacks against single and double fortifications", () => {
  let state = createGame("tovak");
  const fortified = { id: "fortified-audit", name: "工事守军", armor: 5, attack: 2, fame: 0, fortified: true, fortificationLevel: 1, description: "测试" };
  state = {
    ...state,
    phase: "combat",
    turnBonus: { ...state.turnBonus, range: 9, siege: 0 },
    combat: { cellId: "1,0", enemy: fortified, originId: "0,0", step: "ranged", blocked: false },
  };
  assert.equal(effectiveAttackValue(state, fortified, "ranged"), 0, "一层工事不接受普通远程攻击");
  state = { ...state, turnBonus: { ...state.turnBonus, siege: 5 } };
  assert.equal(effectiveAttackValue(state, fortified, "ranged"), 5, "攻城攻击可在远程阶段突破一层工事");

  const doubleFortified = { ...fortified, id: "double-fortified-audit", fortificationLevel: 2 };
  state = { ...state, combat: { ...state.combat!, enemy: doubleFortified } };
  assert.equal(effectiveAttackValue(state, doubleFortified, "ranged"), 0, "双重工事在远程阶段不能成为目标");
  assert.equal(effectiveAttackValue(state, doubleFortified, "attack"), 14, "近战阶段可把远程与攻城都作为普通攻击");
});

test("lets fire and ice resistance ignore matching mana-powered non-attack unit effects", () => {
  let state = createGame("tovak");
  const target = { id: "ice-resistant-audit", name: "寒冰抗性目标", armor: 6, attack: 4, fame: 0, resistances: ["ice" as const], description: "测试" };
  state = {
    ...state,
    phase: "combat",
    crystals: { ...state.crystals, blue: 1 },
    units: [{ id: "amotepFreezers@1", used: false, wounded: false }],
    combat: { cellId: "1,0", enemy: target, originId: "0,0", step: "block", blocked: false },
  };
  assert.equal(canActivateUnitAbility(state, "amotepFreezers@1", "freeze"), false);
  state = { ...state, combat: { ...state.combat!, enemy: { ...target, resistances: [] } } };
  assert.equal(canActivateUnitAbility(state, "amotepFreezers@1", "freeze"), true);
});

test("uses cumulative hero wounds across the entire combat for knockout", () => {
  let state = createGame("tovak");
  state = {
    ...state,
    phase: "combat",
    fame: 0,
    hand: ["rage#1", "march#1"],
    combat: {
      cellId: "1,0",
      enemy: { id: "second-hit", name: "第二次攻击", armor: 1, attack: 6, fame: 0, description: "测试" },
      originId: "0,0",
      step: "damage",
      blocked: false,
      damageRemaining: 6,
      heroWoundsTaken: 3,
    },
  };
  state = gameReducer(state, { type: "COMBAT_DAMAGE" });
  assert.equal(state.hand.every((id) => id.startsWith("wound#")), true, "第二次新增的伤势应与先前伤势累计触发击倒");
  assert.equal(state.discard.includes("rage#1"), true);
});

test("lets a unit choose a mana-powered ability and consumes a crystal", () => {
  let state = createGame("tovak");
  state = {
    ...state,
    phase: "combat",
    source: [{ color: "green" }, { color: "white" }, { color: "blue" }],
    crystals: { ...state.crystals, red: 1 },
    units: [{ id: "redCapeMonks@1", used: false, wounded: false, wounds: 0 }],
    combat: { cellId: "1,0", enemy: encounter("rampager"), originId: "0,0", step: "attack", blocked: true },
  };
  state = gameReducer(state, { type: "ACTIVATE_UNIT", unitId: "redCapeMonks@1", abilityId: "fireAttack" });
  assert.equal(state.units[0].used, true);
  assert.equal(state.units[0].selectedAbilityId, "fireAttack");
  assert.equal(state.crystals.red, 0);
  assert.equal(availableResources(state).fireAttack, 4);
});

test("resolves resistant unit damage, poison wounds, and paralysis", () => {
  let state = createGame("tovak");
  state = {
    ...state,
    phase: "combat",
    units: [{ id: "guardianGolems@1", used: false, wounded: false, wounds: 0 }],
    combat: { cellId: "1,0", enemy: { id: "physical-hit", name: "物理攻击", armor: 1, attack: 3, fame: 0, description: "测试" }, originId: "0,0", step: "damage", blocked: false, damageRemaining: 3 },
  };
  state = gameReducer(state, { type: "ASSIGN_DAMAGE_UNIT", unitId: "guardianGolems@1" });
  assert.equal(state.units[0].wounded, false, "匹配物理抗性先无伤吸收一次护甲");

  state = {
    ...state,
    phase: "combat",
    units: [{ id: "peasants@1", used: false, wounded: false, wounds: 0 }],
    combat: { cellId: "1,0", enemy: { id: "poison-hit", name: "毒击", armor: 1, attack: 3, fame: 0, poison: true, description: "测试" }, originId: "0,0", step: "damage", blocked: false, damageRemaining: 3 },
  };
  state = gameReducer(state, { type: "ASSIGN_DAMAGE_UNIT", unitId: "peasants@1" });
  assert.equal(state.units[0].wounds, 2);

  state = {
    ...state,
    phase: "combat",
    units: [{ id: "peasants@1", used: false, wounded: false, wounds: 0 }],
    combat: { cellId: "1,0", enemy: { id: "paralyze-hit", name: "麻痹攻击", armor: 1, attack: 3, fame: 0, paralyze: true, description: "测试" }, originId: "0,0", step: "damage", blocked: false, damageRemaining: 3 },
  };
  state = gameReducer(state, { type: "ASSIGN_DAMAGE_UNIT", unitId: "peasants@1" });
  assert.equal(state.units.length, 0, "被麻痹攻击打伤的盟军会被摧毁");
});

test("draws and discards a temporary brown enemy for Summon", () => {
  let state = createGame("tovak");
  const summoner = { id: "summon-audit", name: "召唤者", armor: 4, attack: 4, fame: 4, summon: true, description: "测试" };
  const brownId = ENEMY_TOKEN_IDS.brown[0];
  state = {
    ...state,
    phase: "combat",
    map: patchCell(state.map, "1,0", { site: "rampager", enemies: [summoner], enemy: summoner, conquered: false }),
    turnBonus: { ...state.turnBonus, block: 30 },
    enemyDecks: { ...state.enemyDecks, brown: [brownId] },
    enemyDiscards: { ...state.enemyDiscards, brown: [] },
    combat: { cellId: "1,0", enemy: summoner, originId: "0,0", step: "ranged", blocked: false },
  };
  state = gameReducer(state, { type: "COMBAT_ADVANCE" });
  assert.equal(state.combat?.summoner?.enemy.id, summoner.id);
  assert.equal(state.combat?.enemy.id, brownId);
  state = gameReducer(state, { type: "COMBAT_BLOCK" });
  assert.equal(state.combat?.step, "attack");
  assert.equal(state.combat?.enemy.id, summoner.id);
  assert.equal(state.enemyDiscards.brown.includes(brownId), true);
});

test("supports multiple purchases in one interaction and applies reputation only once", () => {
  let state = {
    ...createGame("norowas", "standard"),
    phase: "planning" as const,
    position: "1,-1",
    reputation: 2,
    hand: ["wound#a", "wound#b"],
    turnBonus: { ...createGame("norowas", "standard").turnBonus, influence: 10 },
  };
  state = gameReducer(state, { type: "HEAL_WITH_INFLUENCE" });
  assert.equal(state.spent.influence, 2);
  assert.equal(state.interactionSite, "1,-1");
  state = gameReducer(state, { type: "HEAL_WITH_INFLUENCE" });
  assert.equal(state.spent.influence, 5);
  assert.equal(state.hand.some((id) => id.startsWith("wound#")), false);
});

test("requires at least one played or discarded card before ending a turn", () => {
  let state = { ...createGame("tovak", "standard"), phase: "planning" as const };
  const before = state.turnsTaken;
  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.turnsTaken, before);
  assert.match(state.log[0], /至少要打出或弃掉 1 张牌/);
});

test("charges colored mana for spells and black plus colored mana for their night effects", () => {
  let state = gameReducer({
    ...createGame("arythea", "standard"),
    phase: "planning" as const,
    hand: ["firestorm#audit"],
    source: [{ color: "blue" as const }, { color: "green" as const }, { color: "white" as const }],
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
  }, { type: "MAP_CLICK", cellId: "1,0" });
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "firestorm#audit", mode: "basic" });
  assert.equal(state.played.length, 0);
  state = { ...state, source: [{ color: "red" }, { color: "green" }, { color: "white" }] };
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "firestorm#audit", mode: "basic" });
  assert.equal(state.played.length, 1);

  state = gameReducer({
    ...createGame("arythea", "standard"),
    phase: "planning",
    time: "day",
    hand: ["firestorm#audit"],
    source: [{ color: "black" }, { color: "red" }, { color: "white" }],
    crystals: { red: 1, blue: 0, green: 0, white: 0 },
  }, { type: "MAP_CLICK", cellId: "1,0" });
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "firestorm#audit", mode: "powered" });
  assert.equal(state.played.length, 0);
  state = { ...state, time: "night" };
  state = gameReducer(state, { type: "PLAY_CARD", instanceId: "firestorm#audit", mode: "powered" });
  assert.equal(state.played.length, 1);
  assert.equal(state.played[0].manaUses?.length, 2);
  assert.equal(state.crystals.red, 0);
});

test("requires one explicit branch for card effects printed with or", () => {
  const base = {
    ...createGame("tovak", "standard"),
    phase: "planning" as const,
    hand: ["tranquility#choice"],
    crystals: { red: 0, blue: 0, green: 1, white: 0 },
  };
  const unresolved = gameReducer(base, { type: "PLAY_CARD", instanceId: "tranquility#choice", mode: "powered" });
  assert.equal(unresolved.played.length, 0);
  assert.match(unresolved.log[0], /二选一/);

  const basicDrawing = gameReducer(base, { type: "PLAY_CARD", instanceId: "tranquility#choice", mode: "basic", effectChoice: 1 });
  assert.equal(availableResources(basicDrawing).heal, 0);
  assert.equal(availableResources(basicDrawing).draw, 1);

  const healing = gameReducer(base, { type: "PLAY_CARD", instanceId: "tranquility#choice", mode: "powered", effectChoice: 0 });
  assert.equal(availableResources(healing).heal, 2);
  assert.equal(availableResources(healing).draw, 0);

  const drawing = gameReducer(base, { type: "PLAY_CARD", instanceId: "tranquility#choice", mode: "powered", effectChoice: 1 });
  assert.equal(availableResources(drawing).heal, 0);
  assert.equal(availableResources(drawing).draw, 2);
});

test("makes Improvisation discard another non-Wound card and explicitly choose its resource", () => {
  const base = {
    ...createGame("tovak", "standard"),
    phase: "planning" as const,
    hand: ["improvisation#choice", "march#cost", "wound#cost"],
    played: [],
    discard: [],
  };

  const missingChoice = gameReducer(base, { type: "PLAY_CARD", instanceId: "improvisation#choice", mode: "basic", discardInstanceId: "march#cost" });
  assert.equal(missingChoice.played.length, 0);
  assert.match(missingChoice.log[0], /多选一/);

  const missingDiscard = gameReducer(base, { type: "PLAY_CARD", instanceId: "improvisation#choice", mode: "basic", effectChoice: 1 });
  assert.equal(missingDiscard.played.length, 0);
  assert.match(missingDiscard.log[0], /必须选择并弃掉/);

  const woundDiscard = gameReducer(base, { type: "PLAY_CARD", instanceId: "improvisation#choice", mode: "basic", effectChoice: 1, discardInstanceId: "wound#cost" });
  assert.equal(woundDiscard.played.length, 0);

  const influenced = gameReducer(base, { type: "PLAY_CARD", instanceId: "improvisation#choice", mode: "basic", effectChoice: 1, discardInstanceId: "march#cost" });
  assert.equal(influenced.played[0]?.effectChoice, 1);
  assert.equal(influenced.played[0]?.discardedInstanceId, "march#cost");
  assert.equal(influenced.hand.includes("march#cost"), false);
  assert.equal(influenced.discard.includes("march#cost"), true);
  assert.equal(availableResources(influenced).influence, availableResources(base).influence + 3);
  assert.equal(availableResources(influenced).move, availableResources(base).move);

  const restored = gameReducer(influenced, { type: "UNPLAY_CARD", instanceId: "improvisation#choice" });
  assert.equal(restored.played.length, 0);
  assert.equal(restored.hand.includes("march#cost"), true);
  assert.equal(restored.discard.includes("march#cost"), false);
  assert.equal(availableResources(restored).influence, availableResources(base).influence);
});

test("lets Tranquility and every other non-Wound card be played sideways as Move 1", () => {
  const base = {
    ...createGame("tovak", "standard"),
    phase: "planning" as const,
    hand: ["tranquility#sideways-move"],
  };
  const moved = gameReducer(base, { type: "PLAY_CARD", instanceId: "tranquility#sideways-move", mode: "sideways", sideResource: "move" });

  assert.equal(moved.played[0]?.mode, "sideways");
  assert.equal(moved.played[0]?.sideResource, "move");
  assert.equal(availableResources(moved).move, availableResources(base).move + 1);
  assert.equal(availableResources(moved).heal, availableResources(base).heal);
  assert.equal(availableResources(moved).draw, availableResources(base).draw);
});

test("does not carry healing played before movement through the start of combat", () => {
  const beforeCombat = {
    ...createGame("tovak", "standard"),
    phase: "planning" as const,
    time: "night" as const,
    hand: ["cure#timing"],
    source: [{ color: "black" as const }, { color: "blue" as const }, { color: "white" as const }],
    crystals: { red: 0, blue: 0, green: 1, white: 0 },
  };
  const prepared = gameReducer(beforeCombat, { type: "PLAY_CARD", instanceId: "cure#timing", mode: "basic" });
  assert.equal(availableResources(prepared).heal, 2);

  const enteredCombat = gameReducer(prepared, { type: "MAP_CLICK", cellId: "1,0" });
  assert.equal(enteredCombat.phase, "combat");
  assert.equal(availableResources(enteredCombat).heal, 0);
});

test("rejects a healing action played after combat has started", () => {
  const ready = {
    ...createGame("tovak", "standard"),
    phase: "planning" as const,
    time: "night" as const,
    hand: ["cure#combat"],
    source: [{ color: "black" as const }, { color: "blue" as const }, { color: "white" as const }],
    crystals: { red: 0, blue: 0, green: 1, white: 0 },
  };
  const combat = gameReducer(ready, { type: "MAP_CLICK", cellId: "1,0" });
  const played = gameReducer(combat, { type: "PLAY_CARD", instanceId: "cure#combat", mode: "basic" });
  assert.equal(played.played.some((entry) => entry.instanceId === "cure#combat"), false);
  assert.equal(availableResources(played).heal, 0);
});

test("scores the solo scenario by official no-title achievement values", () => {
  const base = createGame("tovak", "standard");
  const state = {
    ...base,
    phase: "gameover" as const,
    result: "victory" as const,
    fame: 20,
    round: 5,
    conqueredCities: 2,
    artifacts: 1,
    units: [{ id: "guardsmen", used: false, wounded: false }, { id: "fireMages", used: false, wounded: true }],
    deck: ["firestorm#a", "pathfinding#a", "wound#a"],
    hand: [],
    discard: [],
    crystals: { red: 1, blue: 1, green: 1, white: 1 },
    dummyDeck: 7,
    finalTurn: false,
    map: base.map.map((cell) => (cell.id === "2,-1" || cell.id === "3,0" || cell.id === "3,-1") ? { ...cell, conquered: true } : cell),
  };
  const score = scoreGame(state);
  assert.equal(score.knowledge, 3);
  assert.equal(score.leadership, 3);
  assert.equal(score.adventure, 2);
  assert.equal(score.conquest, 4);
  assert.equal(score.artifacts, 2);
  assert.equal(score.wounds, -2);
  assert.equal(score.cities, 35);
  assert.equal(score.early, 30);
  assert.equal(score.dummy, 7);
  assert.equal(score.unannounced, 5);
});

test("does not allow a voluntary round end while deed cards remain", () => {
  const state = { ...createGame("tovak", "standard"), phase: "planning" as const };
  const next = gameReducer(state, { type: "FORFEIT_ROUND" });
  assert.equal(next.round, 1);
  assert.equal(next.phase, "planning");
});

test("runs the complete six-round solo clock to a stable game result", () => {
  let state = createGame("tovak", "standard");
  let guard = 0;

  while (state.phase !== "gameover" && guard < 120) {
    if (state.phase === "tactic") {
      const tactic = availableTactics(state)[0];
      assert.ok(tactic, `第 ${state.round} 轮应当仍有可用战术`);
      state = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: tactic.id });
    } else if (state.phase === "planning") {
      if (state.deck.length === 0) {
        state = gameReducer(state, { type: "FORFEIT_ROUND" });
      } else {
        const discardable = state.hand.find((id) => !id.startsWith("wound#"));
        assert.ok(discardable, "整局时钟测试需要至少一张可弃的行动牌");
        state = gameReducer(state, { type: "DISCARD_CARD", instanceId: discardable });
        state = gameReducer(state, { type: "END_TURN" });
      }
    } else {
      assert.fail(`无战斗路线不应停在 ${state.phase} 阶段`);
    }
    guard += 1;
  }

  assert.ok(guard < 120, "六轮流程不应卡死");
  assert.equal(state.phase, "gameover");
  assert.equal(state.round, 6);
  assert.equal(state.result, "defeat");
  assert.equal(state.time, "night");
  assert.equal(state.usedTactics.length, 12);
});

test("generates reproducible but genuinely different seeded maps", () => {
  const first = createGeneratedGame("tovak", "standard", "random", "wedge", 101_101);
  const replay = createGeneratedGame("tovak", "standard", "random", "wedge", 101_101);
  const second = createGeneratedGame("tovak", "standard", "random", "wedge", 202_202);
  const signature = (state: typeof first) => state.map.map(({ id, terrain, site }) => `${id}:${terrain}:${site}`);

  assert.deepEqual(signature(first), signature(replay));
  assert.notDeepEqual(signature(first), signature(second));
  assert.notDeepEqual(first.map.map((cell) => cell.site), second.map.map((cell) => cell.site));
  assert.notDeepEqual(first.map.map((cell) => cell.terrain), second.map.map((cell) => cell.terrain));
});

test("selects the official solo tile mix while keeping every physical tile template fixed", () => {
  MAP_TILE_TEMPLATES.forEach((tile) => {
    assert.equal(tile.cells.length, 7, `${tile.id} 必须恰好包含七格`);
    assert.equal(new Set(tile.cells.map((cell) => cell.local)).size, 7, `${tile.id} 的七个相对位置不能重复`);
  });

  [7, 77, 777, 7_777, 77_777].forEach((seed) => {
    const setup = generateMapSetup(seed, "standard", "random", "wedge");
    const selected = [...setup.mapTiles.slice(1).map((tile) => tile.templateId), ...setup.tileDeck].map(getMapTileTemplate);
    assert.equal(selected.filter((tile) => tile.kind === "countryside").length, 7);
    assert.equal(selected.filter((tile) => tile.kind === "core-noncity").length, 2);
    assert.equal(selected.filter((tile) => tile.kind === "core-city").length, 2);
    assert.equal(new Set(selected.map((tile) => tile.id)).size, 11);

    setup.mapTiles.forEach((placement) => {
      const template = getMapTileTemplate(placement.templateId);
      const cells = setup.map.filter((cell) => cell.tileId === placement.id);
      assert.deepEqual(
        cells.map(({ tileLocal, terrain, site, mineColor }) => ({ tileLocal, terrain, site, mineColor })),
        template.cells.map(({ local, terrain, site, mineColor }) => ({ tileLocal: local, terrain, site, mineColor })),
      );
    });
  });
});

test("supports the wedge and open rulebook outlines with the correct starting tile", () => {
  const shapes: MapShape[] = ["wedge", "diamond", "wings"];
  const maps = shapes.map((shape) => createGeneratedGame("norowas", "standard", "random", shape, 314_159));
  maps.forEach((state, index) => {
    assert.equal(state.mapShape, shapes[index]);
    assert.equal(state.mapTiles[0].templateId, shapes[index] === "wedge" ? "start-a" : "start-b");
    assert.equal(state.mapTiles.length, shapes[index] === "wedge" ? 3 : 4);
    assert.equal(state.map.length, state.mapTiles.length * 7);
    assert.equal(new Set(state.map.map((cell) => cell.id)).size, state.map.length);
    const visited = new Set(["0,0"]);
    const frontier = [state.map.find((cell) => cell.id === "0,0")!];
    while (frontier.length) {
      const current = frontier.shift()!;
      state.map.filter((cell) => !visited.has(cell.id) && isAdjacent(current, cell)).forEach((cell) => {
        visited.add(cell.id);
        frontier.push(cell);
      });
    }
    assert.equal(visited.size, state.map.length, `${shapes[index]} 轮廓存在不可达区域`);
  });
});

test("requires two adjacent tiles and an inland position before revealing a core tile", () => {
  let state = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  state = { ...state, phase: "planning", position: "4,-2", tileDeck: ["core-1"], turnBonus: { ...state.turnBonus, move: 2 } };
  const targets = availableTileExplorations(state);
  assert.ok(targets.length > 0);
  assert.ok(targets.every((target) => target.adjacentTiles >= 2));
  assert.ok(targets.every((target) => target.tr !== 0 && target.tr !== -target.tq));
  const rejected = gameReducer(state, { type: "EXPLORE_TILE", tq: 2, tr: -2 });
  assert.equal(rejected.mapTiles.length, state.mapTiles.length);
});

test("treats lakes and mountains as impassable in normal movement", () => {
  let state = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  state = { ...state, phase: "planning", position: "0,0", turnBonus: { ...state.turnBonus, move: 99 } };
  const moveBefore = availableResources(state).move;
  state = gameReducer(state, { type: "MAP_CLICK", cellId: "-1,0" });
  assert.equal(state.position, "0,0");
  assert.equal(availableResources(state).move, moveBefore);
  assert.match(state.log[0], /不可进入/);
});

test("allows map rerolls only before the first tactic and uses official terrain costs", () => {
  let state = createGeneratedGame("tovak", "standard", "random", "wedge", 123);
  const originalRandom = Math.random;
  Math.random = () => 0.876_543_21;
  try {
    state = gameReducer(state, { type: "REGENERATE_MAP" });
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(state.seed, 876_543_210);
  assert.match(state.log[0], /地图板块牌库已重新生成/);
  const afterTactic = gameReducer(state, { type: "CHOOSE_TACTIC", tacticId: "d1" });
  assert.equal(gameReducer(afterTactic, { type: "REGENERATE_MAP" }).seed, afterTactic.seed);
  assert.deepEqual(TERRAIN_COSTS.forest, { day: 3, night: 5 });
  assert.deepEqual(TERRAIN_COSTS.desert, { day: 5, night: 3 });
  assert.deepEqual(TERRAIN_COSTS.swamp, { day: 5, night: 5 });
});

test("reverts ordinary movement and restores every spent resource before new information appears", () => {
  const base = createGame("tovak");
  const state = {
    ...base,
    phase: "planning" as const,
    position: "0,0",
    turnBonus: { ...base.turnBonus, move: 10 },
    map: base.map.map((cell) => cell.id === "1,0"
      ? { ...cell, enemy: undefined, enemies: [], conquered: true, tokenRevealed: true }
      : { ...cell, tokenRevealed: true }),
  };
  let history = createRevertHistory(state);
  const beforeMove = availableResources(history.present).move;
  history = applyGameActionWithRevert(history, { type: "MAP_CLICK", cellId: "1,-1" });

  assert.equal(history.present.position, "1,-1");
  assert.equal(history.past.length, 1);
  assert.ok(availableResources(history.present).move < beforeMove);

  history = revertLastAction(history);
  assert.equal(history.present.position, "0,0");
  assert.equal(availableResources(history.present).move, beforeMove);
  assert.equal(history.past.length, 0);
  assert.match(history.present.log[0], /已撤回/);
});

test("supports a multi-step turn undo chain for cards and deterministic choices", () => {
  const state = { ...createGame("tovak"), phase: "planning" as const, hand: ["march#undo-1", "stamina#undo-2"] };
  const first = state.hand[0];
  const second = state.hand[1];
  let history = createRevertHistory(state);
  history = applyGameActionWithRevert(history, { type: "PLAY_CARD", instanceId: first, mode: "basic" });
  history = applyGameActionWithRevert(history, { type: "PLAY_CARD", instanceId: second, mode: "sideways", sideResource: "move" });
  assert.equal(history.past.length, 2);
  assert.equal(history.present.played.length, 2);

  history = revertLastAction(history);
  assert.deepEqual(history.present.played.map((play) => play.instanceId), [first]);
  history = revertLastAction(history);
  assert.equal(history.present.played.length, 0);
});

test("locks all prior decisions when exploration reveals a new seven-hex tile", () => {
  const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  const state = { ...base, phase: "planning" as const, position: "4,-2", turnBonus: { ...base.turnBonus, move: 99 } };
  const target = availableTileExplorations(state)[0];
  assert.ok(target);
  let history = createRevertHistory(state);
  history = applyGameActionWithRevert(history, { type: "DISCARD_CARD", instanceId: state.hand[0] });
  assert.equal(history.past.length, 1);
  history = applyGameActionWithRevert(history, { type: "EXPLORE_TILE", tq: target.tq, tr: target.tr });

  assert.equal(history.present.mapTiles.length, state.mapTiles.length + 1);
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /探索公开了新的七格地图板块/);
});

test("allows undoing a voluntary challenge against an already revealed rampaging enemy", () => {
  const combatBase = createGame("tovak");
  const combatState = { ...combatBase, phase: "planning" as const, hand: ["march#combat-history"], turnBonus: { ...combatBase.turnBonus, move: 10 } };
  let combatHistory = createRevertHistory(combatState);
  combatHistory = applyGameActionWithRevert(combatHistory, { type: "PLAY_CARD", instanceId: combatState.hand[0], mode: "basic" });
  combatHistory = applyGameActionWithRevert(combatHistory, { type: "MAP_CLICK", cellId: "1,0" });
  assert.equal(combatHistory.present.phase, "combat");
  assert.equal(combatHistory.past.length, 2);
  assert.match(combatHistory.past.at(-1)?.label ?? "", /主动挑战/);

  combatHistory = revertLastAction(combatHistory);
  assert.equal(combatHistory.present.phase, "planning");
  assert.equal(combatHistory.present.combat, undefined);
  assert.equal(combatHistory.present.actionTaken, false);
  assert.equal(combatHistory.present.played.length, 1, "撤回挑战不应顺带撤回更早打出的牌");
  assert.equal(combatHistory.past.length, 1);

  combatHistory = applyGameActionWithRevert(combatHistory, { type: "MAP_CLICK", cellId: "1,0" });
  combatHistory = applyGameActionWithRevert(combatHistory, { type: "COMBAT_ADVANCE" });
  assert.equal(combatHistory.past.length, 3, "确定性的阶段推进不应锁定此前历史");
  combatHistory = revertLastAction(combatHistory);
  assert.equal(combatHistory.present.combat?.step, "ranged");
  combatHistory = revertLastAction(combatHistory);
  assert.equal(combatHistory.present.phase, "planning");
});

test("keeps a two-step movement chain reversible after cancelling a known rampager challenge", () => {
  const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  const state = { ...base, phase: "planning" as const, turnBonus: { ...base.turnBonus, move: 30 } };
  assert.equal(state.map.find((cell) => cell.id === "3,-3")?.site, "rampager");
  assert.equal(state.map.find((cell) => cell.id === "3,-3")?.tokenRevealed, true);
  let history = createRevertHistory(state);
  history = applyGameActionWithRevert(history, { type: "MAP_CLICK", cellId: "1,-1" });
  history = applyGameActionWithRevert(history, { type: "MAP_CLICK", cellId: "2,-2" });
  history = applyGameActionWithRevert(history, { type: "MAP_CLICK", cellId: "3,-3" });
  assert.equal(history.present.combat?.kind, "rampager");
  assert.equal(history.past.length, 3);

  history = revertLastAction(history);
  assert.equal(history.present.phase, "planning");
  assert.equal(history.present.position, "2,-2");
  history = revertLastAction(history);
  assert.equal(history.present.position, "1,-1");
  history = revertLastAction(history);
  assert.equal(history.present.position, "0,0");
});

test("does not treat a stale face-down flag on a rules-public rampager as new information", () => {
  const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  const state = {
    ...base,
    phase: "planning" as const,
    turnBonus: { ...base.turnBonus, move: 30 },
    map: base.map.map((cell) => cell.id === "3,-3" ? { ...cell, tokenRevealed: false } : cell),
  };
  let history = createRevertHistory(state);
  history = applyGameActionWithRevert(history, { type: "MAP_CLICK", cellId: "1,0" });
  assert.equal(history.present.position, "1,0");
  assert.equal(history.present.map.find((cell) => cell.id === "3,-3")?.tokenRevealed, true);
  assert.equal(history.past.length, 1, "兽人随板块公开，修复旧标志位不应清空移动历史");
});

test("keeps movement history reversible when a known rampager is provoked", () => {
  const combatBase = createGame("tovak");
  const publicMap = combatBase.map.map((cell) => cell.id === "2,-1"
    ? { ...cell, enemy: undefined, enemies: [], conquered: true, tokenRevealed: true }
    : cell);
  const forcedState = { ...combatBase, phase: "planning" as const, hand: ["march#forced-history"], turnBonus: { ...combatBase.turnBonus, move: 10 }, map: publicMap };
  let forcedHistory = createRevertHistory(forcedState);
  forcedHistory = applyGameActionWithRevert(forcedHistory, { type: "PLAY_CARD", instanceId: forcedState.hand[0], mode: "basic" });
  forcedHistory = applyGameActionWithRevert(forcedHistory, { type: "MAP_CLICK", cellId: "1,-1" });
  assert.equal(forcedHistory.present.combat?.kind, "provoked");
  assert.equal(forcedHistory.past.length, 2);

  forcedHistory = revertLastAction(forcedHistory);
  assert.equal(forcedHistory.present.phase, "planning");
  assert.equal(forcedHistory.present.position, "0,0");
  assert.equal(forcedHistory.present.combat, undefined);
  assert.equal(forcedHistory.present.played.length, 1, "撤回激怒移动不应顺带撤回更早打出的移动牌");
  assert.equal(forcedHistory.past.length, 1);

  forcedHistory = revertLastAction(forcedHistory);
  assert.equal(forcedHistory.present.played.length, 0);
  assert.equal(forcedHistory.present.hand.includes(forcedState.hand[0]), true);
});

test("locks movement history when an enemy token is newly revealed", () => {
  const combatBase = createGame("tovak");
  const revealMap = combatBase.map.map((cell) => cell.id === "1,0"
    ? { ...cell, enemy: undefined, enemies: [], conquered: true, tokenRevealed: true }
    : cell.id === "2,-1" ? { ...cell, tokenRevealed: false } : cell);
  const revealState = { ...combatBase, phase: "planning" as const, hand: ["march#reveal-history"], position: "0,0", turnBonus: { ...combatBase.turnBonus, move: 10 }, map: revealMap };
  let revealHistory = createRevertHistory(revealState);
  revealHistory = applyGameActionWithRevert(revealHistory, { type: "PLAY_CARD", instanceId: revealState.hand[0], mode: "basic" });
  revealHistory = applyGameActionWithRevert(revealHistory, { type: "MAP_CLICK", cellId: "1,-1" });
  assert.equal(revealHistory.present.phase, "planning");
  assert.equal(revealHistory.present.position, "1,-1");
  assert.equal(revealHistory.present.map.find((cell) => cell.id === "2,-1")?.tokenRevealed, true);
  assert.equal(revealHistory.past.length, 0);
  assert.match(revealHistory.boundaryReason, /要塞.*要塞守军/);
});

test("locks prior decisions after drawing a hidden card", () => {
  const base = createGame("tovak");
  const state = { ...base, phase: "planning" as const, hand: ["march#draw-history"], turnBonus: { ...base.turnBonus, draw: 1 } };
  let history = createRevertHistory(state);
  history = applyGameActionWithRevert(history, { type: "PLAY_CARD", instanceId: state.hand[0], mode: "basic" });
  history = applyGameActionWithRevert(history, { type: "USE_DRAW" });
  assert.equal(history.present.hand.length, state.hand.length + 1);
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /抽牌公开了牌库中的新信息/);
});

test("does not reveal a maze when the screenshot seed move provokes a known rampager", () => {
  const base = createGeneratedGame("tovak", "standard", "random", "wedge", 557_973_317, "ultimate");
  const maze = base.map.find((cell) => cell.id === "2,0")!;
  assert.equal(maze.site, "maze");
  assert.equal(maze.tokenRevealed, false);
  assert.equal(enemiesOnCell(maze).length, 0, "迷宫守卫不应在板块设置时提前抽取");
  const knownRampagerIds = new Set(base.map.flatMap((cell) => cell.tokenRevealed ? enemiesOnCell(cell).map((enemy) => enemy.id) : []));

  let history = createRevertHistory({ ...base, phase: "planning", turnBonus: { ...base.turnBonus, move: 30 } });
  history = applyGameActionWithRevert(history, { type: "MAP_CLICK", cellId: "1,0" });
  history = applyGameActionWithRevert(history, { type: "MAP_CLICK", cellId: "2,0" });
  assert.equal(history.present.combat?.kind, "provoked");
  assert.ok(knownRampagerIds.has(history.present.combat?.enemy.id ?? ""), "触发战斗的敌人必须在移动前已经公开");
  assert.equal(history.present.map.find((cell) => cell.id === "2,0")?.tokenRevealed, false);
  assert.equal(enemiesOnCell(history.present.map.find((cell) => cell.id === "2,0")!).length, 0);
  assert.equal(history.past.length, 2, "强制战斗尚未结算且没有新信息，两个移动步骤都应保留");

  history = revertLastAction(history);
  assert.equal(history.present.position, "1,0");
  assert.equal(history.present.phase, "planning");
  history = revertLastAction(history);
  assert.equal(history.present.position, "0,0");
});

test("draws maze defenders only on entry and discards them after failure", () => {
  const base = createGeneratedGame("tovak", "standard", "random", "wedge", 557_973_317, "ultimate");
  const beforeBrown = base.enemyDecks.brown.length;
  let state: GameState = { ...base, phase: "planning", position: "2,0", turnBonus: { ...base.turnBonus, move: 6 } };
  state = gameReducer(state, { type: "ENTER_ADVENTURE", moveSpend: 2, rewardCrystalColors: ["red", "blue"] });
  const tokenId = state.combat?.enemy.id;
  assert.equal(state.phase, "combat");
  assert.equal(state.combat?.adventureFailure, "discard");
  assert.equal(state.enemyDecks.brown.length, beforeBrown - 1);
  assert.equal(enemiesOnCell(state.map.find((cell) => cell.id === "2,0")!).length, 1);

  state = gameReducer(state, { type: "COMBAT_RETREAT" });
  assert.equal(state.phase, "planning");
  assert.equal(enemiesOnCell(state.map.find((cell) => cell.id === "2,0")!).length, 0);
  assert.equal(state.map.find((cell) => cell.id === "2,0")?.tokenRevealed, false);
  assert.equal(state.enemyDiscards.brown.includes(tokenId!), true);
});

test("burns a monastery only after drawing and defeating its violet defender", () => {
  const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  const map = patchCell(base.map, "0,0", { site: "monastery", conquered: false, enemy: undefined, enemies: [], tokenRevealed: false });
  const beforeViolet = base.enemyDecks.violet.length;
  let state: GameState = { ...base, map, phase: "planning", position: "0,0", reputation: 0 };
  state = gameReducer(state, { type: "BURN_MONASTERY" });
  const defenderId = state.combat?.enemy.id;
  assert.equal(state.combat?.kind, "monastery");
  assert.equal(state.combat?.unitsForbidden, true);
  assert.equal(state.reputation, -3);
  assert.equal(state.enemyDecks.violet.length, beforeViolet - 1);
  assert.equal(state.map.find((cell) => cell.id === "0,0")?.conquered, false);

  state = gameReducer(state, { type: "COMBAT_RETREAT" });
  assert.equal(state.map.find((cell) => cell.id === "0,0")?.conquered, false, "失败不会焚毁修道院");
  assert.equal(enemiesOnCell(state.map.find((cell) => cell.id === "0,0")!).length, 0);
  assert.equal(state.enemyDiscards.violet.includes(defenderId!), true);
});

test("reveals city garrisons from an adjacent space during both day and night", () => {
  for (const time of ["day", "night"] as const) {
    const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
    const cityEnemy = { id: `city-${time}`, name: "城市守军", armor: 4, attack: 3, fame: 4, tokenColor: "white" as const, fortified: true, fortificationLevel: 1, description: "测试城市守军" };
    let map = patchCell(base.map, "1,0", { site: "none", terrain: "plains", enemy: undefined, enemies: [], tokenRevealed: false });
    map = patchCell(map, "2,0", { site: "city1", terrain: "city", tileId: "core-7@1,0", enemy: cityEnemy, enemies: [cityEnemy], tokenRevealed: false, conquered: false });
    const state = gameReducer({ ...base, map, time, phase: "planning", position: "0,0", turnBonus: { ...base.turnBonus, move: 10 } }, { type: "MAP_CLICK", cellId: "1,0" });
    assert.equal(state.map.find((cell) => cell.id === "2,0")?.tokenRevealed, true, `${time} 相邻城市时应公开守军`);
  }
});

test("applies all four printed city combat bonuses", () => {
  const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  const makeCityCombat = (tileNumber: 5 | 6 | 7 | 8, attackElement: "physical" | "fire" = "physical") => {
    const enemy = { id: `city-bonus-${tileNumber}`, name: "城市守军", armor: 4, attack: 3, attackElement, fame: 4, tokenColor: "white" as const, fortified: true, fortificationLevel: 1, description: "测试城市加成" };
    const map = patchCell(base.map, "0,0", { site: "city1", terrain: "city", tileId: `core-${tileNumber}@1,0`, enemy, enemies: [enemy], tokenRevealed: true, conquered: false });
    return { ...base, map, phase: "combat" as const, position: "0,0", combat: { cellId: "0,0", enemy, originId: "-1,0", kind: "assault" as const, step: "block" as const, blocked: false } };
  };
  assert.equal(combatEnemyArmor(makeCityCombat(7), undefined), 5, "白城应给守军 +1 护甲");
  assert.equal(combatBlockRequirement(makeCityCombat(6, "fire")), 5, "蓝城应给火焰攻击 +2");
  assert.equal(combatDamageTotal(makeCityCombat(8)), 6, "红城应让物理攻击获得残暴");

  let green: GameState = { ...makeCityCombat(5), combat: { ...makeCityCombat(5).combat, step: "damage", damageRemaining: 2 } };
  const handWounds = green.hand.filter((id) => id.startsWith("wound#")).length;
  const discardWounds = green.discard.filter((id) => id.startsWith("wound#")).length;
  green = gameReducer(green, { type: "COMBAT_DAMAGE" });
  assert.equal(green.hand.filter((id) => id.startsWith("wound#")).length, handWounds + 1);
  assert.equal(green.discard.filter((id) => id.startsWith("wound#")).length, discardWounds + 1, "绿城应让物理攻击获得中毒");
});

test("migrates an old pre-drawn maze token back into its physical enemy pile", () => {
  const base = createGeneratedGame("tovak", "standard", "random", "wedge", 557_973_317, "ultimate");
  const tokenId = base.enemyDecks.brown[0];
  const enemy = ALL_ENEMY_TOKENS.find((item) => item.id === tokenId)!;
  const legacy: GameState = {
    ...base,
    enemyDecks: { ...base.enemyDecks, brown: base.enemyDecks.brown.slice(1) },
    map: base.map.map((cell) => cell.id === "2,0" ? { ...cell, enemy, enemies: [enemy], tokenRevealed: true } : cell),
  };
  const migrated = migrateSiteEnemyLifecycle(legacy);
  assert.equal(enemiesOnCell(migrated.map.find((cell) => cell.id === "2,0")!).length, 0);
  assert.equal(migrated.map.find((cell) => cell.id === "2,0")?.tokenRevealed, false);
  assert.equal(migrated.enemyDecks.brown.includes(tokenId), true);
});

test("hydrates altar metadata in older saves from the visible yellow token", () => {
  const base = createGeneratedGame("tovak", "standard", "classic", "wedge", 420_042);
  const legacy: GameState = {
    ...base,
    position: "0,0",
    map: patchCell(base.map, "0,0", { site: "ruins", ruinTokenId: "altar-red", ruinAltarColor: undefined, ruinsReward: undefined, tokenRevealed: true, conquered: false }),
  };
  const migrated = migrateSiteEnemyLifecycle(legacy);
  const altar = migrated.map.find((cell) => cell.id === "0,0");
  assert.equal(altar?.ruinAltarColor, "red");
  assert.equal(altar?.ruinsReward, "fame");
});
