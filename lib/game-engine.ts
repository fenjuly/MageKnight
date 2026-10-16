import {
  ALL_CARD_DEFS,
  ALL_ENEMY_TOKEN_BY_ID,
  ALL_RUIN_TOKEN_BY_ID,
  EMPTY_RESOURCES,
  MapCell,
  ManaColor,
  CombatElement,
  ResourceKey,
  ResourcePool,
  TACTICS,
  TERRAIN_COSTS,
  SITE_LABELS,
  UnitDef,
  cardBaseId,
  getCard,
  getSkill,
  getUnit,
  getAdvancedIdsForMode,
  getArtifactIdsForMode,
  getEliteUnitIdsForMode,
  getEnemyTokenIdsForMode,
  getHeroSkillsForMode,
  getHeroesForMode,
  getRegularUnitIdsForMode,
  getRuinTokensForMode,
  getSpellIdsForMode,
  getStarterDecksForMode,
  getWoundIdsForMode,
  type CardDef,
  type CardEffect,
  type ContentMode,
  type EnemyTokenColor,
  type Enemy,
  type SiteType,
  type Tactic,
  type Terrain,
} from "./game-data";
import {
  getMapTileTemplate,
  getMapTilePools,
  type MapTileKind,
  type MapTileTemplate,
} from "./map-tiles";

export type GamePhase = "tactic" | "planning" | "combat" | "skill" | "gameover";
export type MapVariant = "random" | "classic";
export type MapShape = "wedge" | "diamond" | "wings";

export interface ManaUse {
  type: "source" | "crystal" | "token" | "wild" | "infinite";
  index?: number;
  color?: Exclude<ManaColor, "gold">;
  /** Source dice taken by a card effect do not consume the ordinary per-turn allowance. */
  extraSource?: boolean;
}

export interface PlayedCard {
  instanceId: string;
  mode: "basic" | "powered" | "sideways";
  sideResource?: "move" | "attack" | "block" | "influence";
  /** Printed replacement value from Howl of the Pack / Ritual of Pain. */
  sidewaysValue?: number;
  consumedSkill?: "ritual-pain" | "howl-pack" | "mana-overload";
  effectChoice?: number;
  /** A non-Wound card discarded from hand as the printed cost of Improvisation. */
  discardedInstanceId?: string;
  /** Set when combat starts after this card was played; printed combat points cannot be banked. */
  combatResourcesExpired?: boolean;
  /** New information/combat has fixed this play, so it can no longer be taken back directly. */
  lockedByCombat?: boolean;
  /** Healing automatically forfeited when a mixed effect is played during combat. */
  healingCommitted?: number;
  /** Temporary mana created by this card, used to validate a direct unplay. */
  generatedMana?: { color: Exclude<ManaColor, "gold">; count: number };
  generatedManaTokens?: Partial<Record<TemporaryManaColor, number>>;
  /** Source color changed by Mana Draw; restored when the play is directly undone. */
  sourceTransform?: { index: number; from: ManaColor; to: Exclude<ManaColor, "gold"> };
  sourceTransforms?: Array<{ index: number; from: ManaColor; to: Exclude<ManaColor, "gold"> }>;
  manaUse?: ManaUse;
  manaUses?: ManaUse[];
  /** Player choices required by non-numeric printed text. */
  selection?: CardPlaySelection;
  /** Resolved points after applying targets, optional costs and multipliers. */
  effectOverride?: CardEffect;
  /** A second hand card committed to this play (Concentration/Maximal Effect). */
  linkedCard?: { instanceId: string; mode: "basic" | "powered"; removeAtTurnEnd?: boolean };
  /** Inventory snapshot used by effects that refund crystals at end of turn. */
  spentCrystalSnapshot?: Record<BasicManaColor, number>;
  /** Exact reversible snapshot for immediate special-card mutations. */
  specialUndo?: {
    hand: string[];
    discard: string[];
    removedCards: string[];
    crystals: GameState["crystals"];
    reputation: number;
    manaTokens: GameState["manaTokens"];
    wildManaTokens?: number;
    source: SourceDie[];
    spellOffer: string[];
    spellDeck: string[];
    advancedOffer: string[];
    advancedDeck: string[];
    woundDeck: string[];
    position: string;
    phase: GamePhase;
    actionTaken: boolean;
    combat?: CombatState;
    spent: ResourcePool;
    units: UnitState[];
    unitOffer: string[];
    regularUnitDeck: string[];
    eliteUnitDeck: string[];
    artifactDeck: string[];
    fame: number;
    physicalResistanceUnitIds?: string[];
    woundsReceivedThisTurn?: string[];
    goldenGrailHealingSpent?: number;
    recruitedUnitIdsThisTurn?: string[];
    allUnitsGloryThisTurn?: boolean;
  };
}

export interface CardPlaySelection {
  option?: string;
  cardInstanceId?: string;
  cardId?: string;
  unitId?: string;
  unitIds?: string[];
  enemyIds?: string[];
  manaColors?: TemporaryManaColor[];
  terrain?: Terrain;
  sourceDieIndices?: number[];
  cellIds?: string[];
  cardInstanceIds?: string[];
  takeWound?: boolean;
  amount?: number;
}

export interface UnitState {
  id: string;
  used: boolean;
  wounded: boolean;
  wounds?: number;
  selectedAbilityId?: string;
  usedAbilityIds?: string[];
  familiarCrystal?: BasicManaColor;
  needsFamiliarCrystal?: boolean;
  /** Banner Artifacts stay with a Unit between turns and can be face-down once used. */
  banner?: { instanceId: string; cardId: string; faceUp: boolean; command?: boolean };
}

interface CombatEncounter {
  cellId: string;
  enemy: Enemy;
}

export interface CombatState {
  cellId: string;
  enemy: Enemy;
  originId: string;
  kind?: "assault" | "adventure" | "monastery" | "rampager" | "provoked" | "pursuit";
  step: "ranged" | "block" | "damage" | "attack";
  blocked: boolean;
  damageRemaining?: number;
  queue?: CombatEncounter[];
  rangedSurvivors?: CombatEncounter[];
  attackedEnemies?: CombatEncounter[];
  mustWithdraw?: boolean;
  chainStartFame?: number;
  absorbedUnitIds?: string[];
  swiftIgnoredIds?: string[];
  cancelledAttackIds?: string[];
  cancelledAttackCountsByEnemyId?: Record<string, number>;
  successfullyBlockedEnemyIds?: string[];
  cumbersomeReductionByEnemyId?: Record<string, number>;
  armorReductionByEnemyId?: Record<string, number>;
  /** Site fortification ignored by Underground Attack or Demolish. */
  ignoreSiteFortification?: boolean;
  /** Enemies destroyed after a successful Exploding Shield block/Disintegrate. */
  destroyedBySpellIds?: string[];
  destroyIfBlockedIds?: string[];
  ignoredResistanceIds?: string[];
  ignoredFortificationIds?: string[];
  attackReductionByEnemyId?: Record<string, number>;
  cumbersomeGrantedIds?: string[];
  /** Wounds added to the hero's hand across this entire combat. */
  heroWoundsTaken?: number;
  attackTransform?: "coldfire" | "siege";
  /** Original summoner while a temporary brown token is resolving Block/Damage. */
  summoner?: CombatEncounter;
  summonedTokenId?: string;
  adventureMoveSpend?: 2 | 4 | 6;
  adventureRewardCrystalColors?: BasicManaColor[];
  /** How unresolved, on-demand site tokens are handled when the hero fails. */
  adventureFailure?: "discard" | "remain" | "replenish";
  /** Conquered Dungeons/Tombs can be entered again for Fame only. */
  repeatAdventure?: boolean;
  /** Spawning Grounds replenishes defeated tokens after an unsuccessful attempt. */
  adventureTargetCount?: number;
  /** Dungeons, tombs and monastery burning do not allow Units to participate. */
  unitsForbidden?: boolean;
  /** Maze/Labyrinth combat permits only the single Unit chosen on entry. */
  allowedUnitIds?: string[];
  /** Dungeon and Tomb combats use Night mana rules even during a Day round. */
  nightRules?: boolean;
  /** Optional post-conquest hunt initiated at or next to Volkare's camp. */
  volkarePursuit?: boolean;
  /** Volkare attacks beside surviving troops but can never be targeted. */
  volkareAttack?: Enemy;
  volkareAttackPending?: boolean;
  /** Current printed attack number for enemies with Multiple Attacks. */
  attackIndex?: number;
  /** True only while every printed attack resolved so far was fully blocked. */
  allAttacksBlocked?: boolean;
  /** Defend source enemy id -> the distinct living enemy it protects. */
  defendAssignments?: Record<string, string>;
  /** Defend choices become fixed as soon as the first attack is committed. */
  defendAssignmentsLocked?: boolean;
}

export interface SourceDie {
  color: ManaColor;
}

export interface GameState {
  version: 4;
  contentMode: ContentMode;
  seed: number;
  mapVariant: MapVariant;
  mapShape: MapShape;
  mapTiles: MapTilePlacement[];
  tileDeck: string[];
  removedMapTiles: string[];
  heroId: string;
  difficulty: "apprentice" | "standard" | "legendary";
  phase: GamePhase;
  round: number;
  time: "day" | "night";
  position: string;
  map: MapCell[];
  hand: string[];
  deck: string[];
  discard: string[];
  played: PlayedCard[];
  spent: ResourcePool;
  turnBonus: ResourcePool;
  source: SourceDie[];
  marketManaUses: ManaUse[];
  unitManaUses: ManaUse[];
  manaTokens: Record<"red" | "blue" | "green" | "white" | "black", number>;
  /** Gold mana from Amulet of the Sun; usable as a basic color under Day rules. */
  wildManaTokens?: number;
  allUnitResistances?: boolean;
  allUnitsGloryThisTurn?: boolean;
  terrainDiscounts?: Terrain[];
  crystals: Record<"red" | "blue" | "green" | "white", number>;
  fame: number;
  reputation: number;
  skills: string[];
  pendingSkillChoices: string[];
  pendingAdvancedChoices?: string[];
  pendingLevelRewards?: number;
  units: UnitState[];
  advancedOffer: string[];
  advancedDeck: string[];
  monasteryOffer: string[];
  spellOffer: string[];
  spellDeck: string[];
  unitOffer: string[];
  regularUnitDeck: string[];
  eliteUnitDeck: string[];
  artifactDeck: string[];
  removedCards: string[];
  woundDeck: string[];
  enemyDecks: Record<EnemyTokenColor, string[]>;
  enemyDiscards: Record<EnemyTokenColor, string[]>;
  ruinDeck: string[];
  ruinDiscards: string[];
  selectedTactic?: string;
  dummyTactic?: string;
  usedTactics: string[];
  dummyDeck: number;
  dummyCrystals: Record<"red" | "blue" | "green" | "white", number>;
  dummySlowAvailable: boolean;
  finalTurn: boolean;
  missionCountdown: number;
  actionTaken: boolean;
  interactionSite?: string;
  interactionModifierUsed?: boolean;
  /** Lost Legion Thugs/Heroes replace the normal Reputation modifier for the whole interaction. */
  interactionReputationMode?: "thugs" | "heroes";
  skillUsesThisTurn?: string[];
  skillUsesThisRound?: string[];
  flippedSkills?: string[];
  skillTurnResources?: Record<string, Partial<ResourcePool>>;
  masterChaosColor?: ManaColor;
  ignoreReputationThisTurn?: boolean;
  skillTerrainDiscount?: number;
  manaOverloadColor?: TemporaryManaColor;
  ritualPainReady?: boolean;
  howlPackReady?: boolean;
  howlCombatReady?: boolean;
  sourceOpeningReady?: boolean;
  extraSourceUsesThisTurn?: number;
  refugeeCampRecruitUsed?: boolean;
  selectedMineColor?: BasicManaColor;
  /** Move left from before arriving at a Maze/Labyrinth; it is discarded on entry. */
  mazeArrivalMoveCarryover?: number;
  recruitedUnitIdsThisTurn?: string[];
  combat?: CombatState;
  ownedKeeps: number;
  conqueredCities: number;
  conqueredSites: number;
  artifacts: number;
  artifactInventory: string[];
  factionTokens: Record<"elementalists" | "dark-crusaders", number>;
  volkareShields?: number;
  volkareMinorDefeats?: number;
  pursuedCampCellIds?: string[];
  volkarePursuitShields?: number;
  turnsTaken: number;
  turnDiscardCount?: number;
  result?: "victory" | "defeat";
  /** Time Bending stays out only until the next Round. */
  roundSetAsideCards?: string[];
  /** Temporary resistance granted by Force of Nature. */
  physicalResistanceUnitIds?: string[];
  /** Physical Wound cards added during the current turn (Banner of Protection). */
  woundsReceivedThisTurn?: string[];
  goldenGrailHealingSpent?: number;
  log: string[];
}

export type GameAction =
  | { type: "CHOOSE_TACTIC"; tacticId: string }
  | { type: "CHOOSE_SKILL"; skillId: string }
  | { type: "CHOOSE_LEVEL_ADVANCED"; cardId: string }
  | { type: "PLAY_CARD"; instanceId: string; mode: PlayedCard["mode"]; sideResource?: PlayedCard["sideResource"]; effectChoice?: number; discardInstanceId?: string; manaDrawDieIndex?: number; manaDrawColor?: Exclude<ManaColor, "gold">; selection?: CardPlaySelection }
  | { type: "UNPLAY_CARD"; instanceId: string }
  | { type: "DISCARD_CARD"; instanceId: string }
  | { type: "TOGGLE_UNIT"; unitId: string }
  | { type: "ACTIVATE_UNIT"; unitId: string; abilityId: string; manaColors?: TemporaryManaColor[]; enemyId?: string }
  | { type: "ACTIVATE_SKILL"; skillId: string; option?: string; color?: ManaColor; unitId?: string; enemyId?: string; cardInstanceIds?: string[]; sourceDieIndex?: number }
  | { type: "USE_BANNER"; unitId: string; enemyId?: string }
  | { type: "MAP_CLICK"; cellId: string }
  | { type: "EXPLORE_TILE"; tq: number; tr: number }
  | { type: "ENTER_ADVENTURE"; moveSpend?: 2 | 4 | 6; accompanyingUnitId?: string; rewardCrystalColors?: BasicManaColor[] }
  | { type: "SELECT_MINE_COLOR"; color: BasicManaColor }
  | { type: "START_MULTI_COMBAT"; rampagerCellIds: string[]; assaultCellId?: string }
  | { type: "ADD_REGULAR_UNIT_TO_OFFER" }
  | { type: "PURSUE_VOLKARE_ENEMIES"; colors: Array<"green" | "red"> }
  | { type: "BURN_MONASTERY" }
  | { type: "COMBAT_ADVANCE" }
  | { type: "COMBAT_RANGED" }
  | { type: "COMBAT_BLOCK" }
  | { type: "COMBAT_REDUCE_CUMBERSOME" }
  | { type: "COMBAT_DAMAGE" }
  | { type: "ASSIGN_DAMAGE_UNIT"; unitId: string }
  | { type: "COMBAT_ATTACK" }
  | { type: "COMBAT_GROUP_ATTACK"; enemyIds: string[] }
  | { type: "ASSIGN_DEFEND"; defenderId: string; targetId: string }
  | { type: "COMBAT_RETREAT" }
  | { type: "END_TURN" }
  | { type: "GAIN_CRYSTAL"; color: "red" | "blue" | "green" | "white" }
  | { type: "USE_HEAL" }
  | { type: "HEAL_UNIT"; unitId: string }
  | { type: "USE_DRAW" }
  | { type: "REST" }
  | { type: "RECRUIT"; unitId: string; manaColor?: BasicManaColor }
  | { type: "REPLACE_FAMILIAR_CRYSTAL"; unitId: string; color: BasicManaColor }
  | { type: "DISMISS_UNIT"; unitId: string }
  | { type: "BUY_CARD"; cardId: string; tier: "advanced" | "spell" }
  | { type: "HEAL_WITH_INFLUENCE" }
  | { type: "REGENERATE_MAP" }
  | { type: "FORFEIT_ROUND" };

export interface MapTilePlacement {
  id: string;
  templateId: string;
  kind: MapTileKind;
  tq: number;
  tr: number;
  order: number;
}

export interface TileExploration {
  tq: number;
  tr: number;
  kind: MapTileKind;
  adjacentTiles: number;
}

export interface GeneratedMapSetup {
  map: MapCell[];
  mapTiles: MapTilePlacement[];
  tileDeck: string[];
  removedMapTiles: string[];
}

const BASIC_COLORS: Array<"red" | "blue" | "green" | "white"> = ["red", "blue", "green", "white"];
type BasicManaColor = (typeof BASIC_COLORS)[number];
type TemporaryManaColor = Exclude<ManaColor, "gold">;
const EMPTY_MANA_TOKENS: Record<TemporaryManaColor, number> = { red: 0, blue: 0, green: 0, white: 0, black: 0 };
export const FAME_LEVEL_THRESHOLDS = [0, 3, 8, 15, 24, 35, 48, 63, 80, 99] as const;
const TILE_DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]] as const;
const INITIAL_TILE_POSITIONS: Record<MapShape, Array<{ tq: number; tr: number }>> = {
  wedge: [{ tq: 1, tr: -1 }, { tq: 1, tr: 0 }],
  // Optional rulebook map-shape variants use starting tile B and three setup tiles.
  diamond: [{ tq: 1, tr: -1 }, { tq: 1, tr: 0 }, { tq: 0, tr: 1 }],
  wings: [{ tq: 1, tr: -1 }, { tq: 1, tr: 0 }, { tq: 0, tr: 1 }],
};

function cloneResources(source: Partial<ResourcePool> = {}): ResourcePool {
  return { ...EMPTY_RESOURCES, ...source };
}

function addResources(target: ResourcePool, source: Partial<ResourcePool>) {
  (Object.keys(EMPTY_RESOURCES) as ResourceKey[]).forEach((key) => {
    target[key] += source[key] ?? 0;
  });
}

function rngFrom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

const ENEMY_COLORS: EnemyTokenColor[] = ["green", "red", "gray", "violet", "brown", "white"];

function emptyEnemyPiles(): Record<EnemyTokenColor, string[]> {
  return { green: [], red: [], gray: [], violet: [], brown: [], white: [] };
}

function makeEnemyDecks(random: () => number, contentMode: ContentMode): Record<EnemyTokenColor, string[]> {
  const ids = getEnemyTokenIdsForMode(contentMode);
  return Object.fromEntries(ENEMY_COLORS.map((color) => [color, shuffle(ids[color], random)])) as Record<EnemyTokenColor, string[]>;
}

export function enemiesOnCell(cell: MapCell): Enemy[] {
  if (cell.enemies?.length) return cell.enemies;
  return cell.enemy ? [cell.enemy] : [];
}

export function cityLevel(site: SiteType, difficulty: GameState["difficulty"]) {
  const levels = difficulty === "apprentice" ? [3, 5] : difficulty === "legendary" ? [8, 11] : [5, 8];
  return site === "city1" ? levels[0] : levels[1];
}

function enemyColorsForCell(cell: MapCell, difficulty: GameState["difficulty"]): EnemyTokenColor[] {
  if (cell.site === "rampager") return ["green"];
  if (cell.site === "dragon") return ["red"];
  if (cell.site === "keep") return ["gray"];
  if (cell.site === "mageTower") return ["violet"];
  // Adventure-site enemies are drawn only when the Hero announces entry.
  // The yellow Ruins token itself is still drawn when its map tile appears.
  // Shades location tiles are scenario overlays and receive their enemies at
  // scenario setup, never merely because an ordinary map tile was revealed.
  if (cell.site === "volkareCamp") {
    if (difficulty === "apprentice") return ["green", "gray", "white", "red"];
    if (difficulty === "legendary") return ["green", "gray", "white", "white", "red", "red"];
    return ["green", "gray", "white", "white", "red"];
  }
  if (cell.site === "city1" || cell.site === "city2") {
    const count = Math.max(2, Math.min(6, Math.ceil(cityLevel(cell.site, difficulty) / 2)));
    const tileNumber = cell.tileId?.match(/core-(\d+)/)?.[1];
    const cycles: Record<string, EnemyTokenColor[]> = {
      // The city bases use Dungeon (brown), Mage Tower (violet), and City
      // garrisons (white); rampaging green/red and Keep gray tokens never
      // belong in a normal city garrison.
      "5": ["brown", "brown", "white", "white"],
      "6": ["brown", "violet", "white", "white"],
      "7": ["brown", "white", "white", "white"],
      "8": ["brown", "violet", "white", "white"],
    };
    const cycle = cycles[tileNumber ?? ""] ?? ["brown", "violet", "white", "white"];
    return Array.from({ length: count }, (_, index) => cycle[index % cycle.length]);
  }
  return [];
}

function populateEnemyTokens(
  cells: MapCell[],
  decks: Record<EnemyTokenColor, string[]>,
  discards: Record<EnemyTokenColor, string[]>,
  ruinDeck: string[],
  ruinDiscards: string[],
  difficulty: GameState["difficulty"],
  random: () => number,
) {
  const nextDecks = Object.fromEntries(ENEMY_COLORS.map((color) => [color, [...decks[color]]])) as Record<EnemyTokenColor, string[]>;
  const nextDiscards = Object.fromEntries(ENEMY_COLORS.map((color) => [color, [...discards[color]]])) as Record<EnemyTokenColor, string[]>;
  let nextRuinDeck = [...ruinDeck];
  let nextRuinDiscards = [...ruinDiscards];
  const map = cells.map((sourceCell) => {
    let cell = sourceCell;
    if (cell.site === "ruins" && !cell.ruinTokenId) {
      if (!nextRuinDeck.length && nextRuinDiscards.length) {
        nextRuinDeck = shuffle(nextRuinDiscards, random);
        nextRuinDiscards = [];
      }
      const ruinTokenId = nextRuinDeck.shift();
      const ruin = ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[ruinTokenId] : undefined;
      if (ruin) cell = { ...cell, ruinTokenId, ruinAltarColor: ruin.altarColor, ruinsReward: ruin.reward };
    }
    const enemies = enemyColorsForCell(cell, difficulty).flatMap((color) => {
      if (!nextDecks[color].length && nextDiscards[color].length) {
        nextDecks[color] = shuffle(nextDiscards[color], random);
        nextDiscards[color] = [];
      }
      const tokenId = nextDecks[color].shift();
      const token = tokenId ? ALL_ENEMY_TOKEN_BY_ID[tokenId] : undefined;
      if (!token) return [];
      const siteFortification = ["keep", "mageTower", "city1", "city2"].includes(cell.site) ? 1 : 0;
      const fortificationLevel = siteFortification + (token.fortified ? 1 : 0);
      return [{ ...token, fortified: fortificationLevel > 0, fortificationLevel }];
    });
    return enemies.length ? { ...cell, enemies, enemy: enemies[0] } : cell;
  });
  return { map, enemyDecks: nextDecks, enemyDiscards: nextDiscards, ruinDeck: nextRuinDeck, ruinDiscards: nextRuinDiscards };
}

export function tileCenterCoordinates(tq: number, tr: number) {
  // The determinant-seven lattice packs seven-hex physical tiles without gaps or overlap.
  return { q: 2 * tq - tr, r: tq + 3 * tr };
}

function placementId(templateId: string, tq: number, tr: number) {
  return `${templateId}@${tq},${tr}`;
}

function instantiateTile(
  template: MapTileTemplate,
  placement: MapTilePlacement,
  _difficulty: GameState["difficulty"],
  cityNumber: 0 | 1 | 2,
  time: GameState["time"],
  _random: () => number,
): MapCell[] {
  void _random;
  const center = tileCenterCoordinates(placement.tq, placement.tr);
  return template.cells.map((fixed) => {
    const q = center.q + fixed.q;
    const r = center.r + fixed.r;
    const site = fixed.site === "city" ? (cityNumber === 1 ? "city1" : "city2") : fixed.site;
    const cell: MapCell = {
      id: `${q},${r}`,
      q,
      r,
      terrain: fixed.terrain,
      site,
      revealed: true,
      conquered: false,
      tokenRevealed: site === "rampager" || site === "dragon" || (site === "ruins" && time === "day"),
      tileId: placement.id,
      tileLocal: fixed.local,
      ...(fixed.mineColor ? { mineColor: fixed.mineColor } : {}),
      ...(fixed.mineColors ? { mineColors: [...fixed.mineColors] } : {}),
    };
    return cell;
  });
}

function makePlacement(template: MapTileTemplate, tq: number, tr: number, order: number): MapTilePlacement {
  return { id: placementId(template.id, tq, tr), templateId: template.id, kind: template.kind, tq, tr, order };
}

function chooseTiles<T extends MapTileTemplate>(pool: T[], count: number, variant: MapVariant, random: () => number) {
  const selected = variant === "random" ? shuffle(pool, random).slice(0, count) : pool.slice(0, count);
  return variant === "random" ? shuffle(selected, random) : selected;
}

export function generateMapSetup(
  seed: number,
  difficulty: GameState["difficulty"],
  variant: MapVariant = "random",
  shape: MapShape = "wedge",
  contentMode: ContentMode = "base",
): GeneratedMapSetup {
  const random = rngFrom(seed ^ 0x4d4b2026);
  const pools = getMapTilePools(contentMode);
  const countryside = chooseTiles(pools.countryside, 7, variant, random);
  const coreNoncity = chooseTiles(pools.coreNoncity, 2, variant, random);
  const coreCity = chooseTiles(pools.coreCity, 2, variant, random);
  const core = variant === "random" ? shuffle([...coreNoncity, ...coreCity], random) : [...coreNoncity, ...coreCity];
  const selectedIds = new Set([...countryside, ...core].map((tile) => tile.id));
  const removedMapTiles = [...pools.countryside, ...pools.coreNoncity, ...pools.coreCity]
    .filter((tile) => !selectedIds.has(tile.id))
    .map((tile) => tile.id);
  const start = getMapTileTemplate(shape === "wedge" ? "start-a" : "start-b");
  const initialPositions = INITIAL_TILE_POSITIONS[shape];
  const initialTemplates = countryside.slice(0, initialPositions.length);
  const tileDeck = [...countryside.slice(initialPositions.length), ...core].map((tile) => tile.id);
  const startPlacement = makePlacement(start, 0, 0, 0);
  const initialPlacements = initialTemplates.map((template, index) => makePlacement(template, initialPositions[index].tq, initialPositions[index].tr, index + 1));
  const mapTiles = [startPlacement, ...initialPlacements];
  const map = mapTiles.flatMap((placement) => {
    const template = getMapTileTemplate(placement.templateId);
    return instantiateTile(template, placement, difficulty, 0, "day", random);
  });
  return { map, mapTiles, tileDeck, removedMapTiles };
}

export function generateMap(seed: number, difficulty: GameState["difficulty"], variant: MapVariant = "random", shape: MapShape = "wedge", contentMode: ContentMode = "base"): MapCell[] {
  return generateMapSetup(seed, difficulty, variant, shape, contentMode).map;
}

function tilePositionKey(tq: number, tr: number) {
  return `${tq},${tr}`;
}

function tileNeighbors(tq: number, tr: number) {
  return TILE_DIRECTIONS.map(([dq, dr]) => ({ tq: tq + dq, tr: tr + dr }));
}

function tileAdjacentCount(mapTiles: MapTilePlacement[], tq: number, tr: number) {
  const occupied = new Set(mapTiles.map((tile) => tilePositionKey(tile.tq, tile.tr)));
  return tileNeighbors(tq, tr).filter((position) => occupied.has(tilePositionKey(position.tq, position.tr))).length;
}

function shapeAllowsTile(shape: MapShape, tq: number, tr: number) {
  if (shape === "wedge") return tq >= 0 && tr <= 0 && tr >= -tq;
  if (shape === "diamond") return tq >= 0 && tr >= -2 && tr <= 2;
  return tq >= 0 && tr >= -1 && tr <= 1;
}

function tileTouchesCell(tq: number, tr: number, cell: MapCell) {
  const center = tileCenterCoordinates(tq, tr);
  return Object.values({
    nw: { q: 0, r: -1 }, ne: { q: 1, r: -1 }, w: { q: -1, r: 0 }, c: { q: 0, r: 0 },
    e: { q: 1, r: 0 }, sw: { q: -1, r: 1 }, se: { q: 0, r: 1 },
  }).some((local) => isAdjacent(cell, { ...cell, q: center.q + local.q, r: center.r + local.r }));
}

function hexDistance(a: Pick<MapCell, "q" | "r">, b: Pick<MapCell, "q" | "r">) {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

function tileWithinCellDistance(tq: number, tr: number, cell: MapCell, distance: number) {
  const center = tileCenterCoordinates(tq, tr);
  return Object.values({
    nw: { q: 0, r: -1 }, ne: { q: 1, r: -1 }, w: { q: -1, r: 0 }, c: { q: 0, r: 0 },
    e: { q: 1, r: 0 }, sw: { q: -1, r: 1 }, se: { q: 0, r: 1 },
  }).some((local) => hexDistance(cell, { q: center.q + local.q, r: center.r + local.r }) <= distance);
}

export function availableTileExplorations(state: GameState): TileExploration[] {
  const nextTileId = state.tileDeck?.[0];
  const current = state.map.find((cell) => cell.id === state.position);
  if (!nextTileId || !current) return [];
  const nextTemplate = getMapTileTemplate(nextTileId);
  const occupied = new Set(state.mapTiles.map((tile) => tilePositionKey(tile.tq, tile.tr)));
  const candidates = new Map<string, { tq: number; tr: number }>();
  const spaceBending = state.played.some((play) => play.mode === "basic" && getCard(play.instanceId)?.basic.special === "space-bending");
  state.mapTiles.forEach((tile) => tileNeighbors(tile.tq, tile.tr).forEach((position) => {
    const key = tilePositionKey(position.tq, position.tr);
    if (!occupied.has(key)) candidates.set(key, position);
  }));
  return [...candidates.values()].flatMap((position) => {
    if (!shapeAllowsTile(state.mapShape, position.tq, position.tr) || !(spaceBending ? tileWithinCellDistance(position.tq, position.tr, current, 2) : tileTouchesCell(position.tq, position.tr, current))) return [];
    const adjacentTiles = tileAdjacentCount(state.mapTiles, position.tq, position.tr);
    if (nextTemplate.kind === "countryside") {
      if (adjacentTiles < 1) return [];
      if (adjacentTiles === 1) {
        const soleNeighbor = tileNeighbors(position.tq, position.tr).find((neighbor) => occupied.has(tilePositionKey(neighbor.tq, neighbor.tr)));
        if (!soleNeighbor || tileAdjacentCount(state.mapTiles, soleNeighbor.tq, soleNeighbor.tr) < 2) return [];
      }
    } else {
      if (adjacentTiles < 2) return [];
      if (state.mapShape === "wedge" && (position.tr === 0 || position.tr === -position.tq)) return [];
    }
    return [{ ...position, kind: nextTemplate.kind, adjacentTiles }];
  });
}

function rollSource(count: number, time: GameState["time"]): SourceDie[] {
  const pool: ManaColor[] = time === "day"
    ? ["red", "blue", "green", "white", "gold"]
    : ["red", "blue", "green", "white", "black"];
  return Array.from({ length: count }, () => ({ color: pool[Math.floor(Math.random() * pool.length)] }));
}

function drawFrom(deck: string[], hand: string[], count: number) {
  const nextDeck = [...deck];
  const nextHand = [...hand];
  for (let i = 0; i < count && nextDeck.length; i += 1) {
    const card = nextDeck.shift();
    if (card) nextHand.push(card);
  }
  return { deck: nextDeck, hand: nextHand };
}

function log(state: GameState, message: string): GameState {
  return { ...state, log: [message, ...state.log].slice(0, 60) };
}

function uid(baseId: string, state: GameState) {
  return `${baseId}#r${state.round}t${state.turnsTaken}x${state.hand.length + state.discard.length}`;
}

export function levelFor(fame: number) {
  let level = 1;
  FAME_LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (fame >= threshold) level = index + 1;
  });
  return level;
}

export function fameToNextLevel(fame: number) {
  const level = levelFor(fame);
  if (level >= FAME_LEVEL_THRESHOLDS.length) return 0;
  return FAME_LEVEL_THRESHOLDS[level] - fame;
}

export function heroArmor(state: GameState) {
  const skillArmor = (state.skills ?? []).reduce((sum, id) => sum + (getSkill(id)?.armor ?? 0), 0);
  const levelArmor = [2, 2, 3, 3, 3, 3, 4, 4, 4, 4][levelFor(state.fame) - 1] ?? 4;
  return levelArmor + skillArmor;
}

function levelHandLimit(fame: number) {
  return [5, 5, 5, 5, 6, 6, 6, 6, 7, 7][levelFor(fame) - 1] ?? 7;
}

export function mapHandLimitBonus(state: GameState) {
  const current = state.map.find((cell) => cell.id === state.position);
  if (!current) return 0;
  const nearby = (cell: MapCell) => cell.id === current.id || isAdjacent(current, cell);
  const nearOwnedKeep = state.map.some((cell) => cell.site === "keep" && cell.conquered && nearby(cell));
  const nearOwnedCity = state.map.some((cell) => (cell.site === "city1" || cell.site === "city2") && cell.conquered && nearby(cell));
  const nearConqueredCamp = state.map.some((cell) => cell.site === "volkareCamp" && cell.conquered && nearby(cell));
  const keepBonus = nearOwnedKeep ? state.ownedKeeps : 0;
  // In the solo scenario the hero is always the leader of every conquered city.
  const cityBonus = nearOwnedCity ? 2 : 0;
  const campBonus = nearConqueredCamp ? state.ownedKeeps + 1 : 0;
  return Math.max(keepBonus, cityBonus, campBonus);
}

export function handLimit(state: GameState) {
  const skillHand = (state.skills ?? []).reduce((sum, id) => sum + (getSkill(id)?.hand ?? 0), 0);
  return levelHandLimit(state.fame) + mapHandLimitBonus(state) + skillHand;
}

export function commandLimit(state: GameState) {
  const skillCommand = (state.skills ?? []).reduce((sum, id) => sum + (getSkill(id)?.command ?? 0), 0);
  return 1 + Math.floor((levelFor(state.fame) - 1) / 2) + skillCommand;
}

export function isAdjacent(a: MapCell, b: MapCell) {
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  return [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].some(([x, y]) => x === dq && y === dr);
}

function revealVisibleTokens(map: MapCell[], position: string, time: GameState["time"]) {
  const current = map.find((cell) => cell.id === position);
  return map.map((cell) => {
    if (!cell.revealed || cell.tokenRevealed) return cell;
    const rampaging = cell.site === "rampager" || cell.site === "dragon";
    const visibleRuin = cell.site === "ruins" && (time === "day" || cell.id === position);
    const adjacentFortification = (cell.site === "keep" || cell.site === "mageTower")
      && Boolean(current && ((time === "day" && isAdjacent(current, cell)) || cell.id === position));
    const adjacentCity = (cell.site === "city1" || cell.site === "city2" || cell.site === "volkareCamp")
      && Boolean(current && (isAdjacent(current, cell) || cell.id === position));
    const enteredExpansionSite = cell.id === position && (["graveyard", "necropolis", "hiddenValley"] as SiteType[]).includes(cell.site);
    const visibleEnemy = Boolean(cell.enemy) && (rampaging || adjacentFortification || adjacentCity || enteredExpansionSite);
    return visibleRuin || visibleEnemy ? { ...cell, tokenRevealed: true } : cell;
  });
}

/**
 * Repairs saves made before site enemies were drawn at their rulebook timing.
 * Tokens removed from an impossible pre-drawn site are returned to their
 * color pile without duplicating a token already present elsewhere.
 */
export function migrateSiteEnemyLifecycle(state: GameState): GameState {
  const removed: Enemy[] = [];
  const activeSiteCombat = state.combat?.kind === "adventure" || state.combat?.kind === "monastery"
    ? state.combat.cellId
    : undefined;
  const alwaysDiscardSites = new Set<SiteType>(["dungeon", "tomb", "maze", "labyrinth"]);
  const retainedOnlyAfterEntry = new Set<SiteType>(["ruins", "spawningGrounds"]);
  let map = state.map.map((originalCell) => {
    const ruin = originalCell.site === "ruins" && originalCell.ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[originalCell.ruinTokenId] : undefined;
    const cell = ruin ? { ...originalCell, ruinAltarColor: ruin.altarColor, ruinsReward: ruin.reward } : originalCell;
    if (cell.id === activeSiteCombat || cell.conquered) return cell;
    const enemies = enemiesOnCell(cell);
    const impossiblePredraw = alwaysDiscardSites.has(cell.site)
      || (retainedOnlyAfterEntry.has(cell.site) && enemies.length > 0 && !cell.tokenRevealed);
    if (!impossiblePredraw || !enemies.length) return cell;
    removed.push(...enemies);
    return {
      ...cell,
      enemy: undefined,
      enemies: [],
      tokenRevealed: cell.site === "ruins" ? cell.tokenRevealed : false,
    };
  });
  const enemyDecks = Object.fromEntries(ENEMY_COLORS.map((color) => [color, [...state.enemyDecks[color]]])) as Record<EnemyTokenColor, string[]>;
  const knownIds = new Set([
    ...map.flatMap((cell) => enemiesOnCell(cell).map((enemy) => enemy.id)),
    ...ENEMY_COLORS.flatMap((color) => [...enemyDecks[color], ...state.enemyDiscards[color]]),
    ...(state.combat ? [state.combat.enemy.id, ...(state.combat.queue ?? []).map((encounter) => encounter.enemy.id)] : []),
  ]);
  removed.forEach((enemy) => {
    if (enemy.tokenColor && !knownIds.has(enemy.id)) {
      enemyDecks[enemy.tokenColor].unshift(enemy.id);
      knownIds.add(enemy.id);
    }
  });
  map = revealVisibleTokens(map, state.position, state.time);
  return { ...state, version: 4, map, enemyDecks };
}

function usedSourceIndices(state: GameState) {
  return new Set([
    ...state.played.flatMap((card) => (card.manaUses ?? (card.manaUse ? [card.manaUse] : [])).flatMap((use) => use.type === "source" && use.index !== undefined ? [use.index] : [])),
    ...(state.marketManaUses ?? []).flatMap((use) => use.type === "source" && use.index !== undefined ? [use.index] : []),
    ...(state.unitManaUses ?? []).flatMap((use) => use.type === "source" && use.index !== undefined ? [use.index] : []),
  ]);
}

function allManaUses(state: GameState) {
  return [
    ...state.played.flatMap((card) => card.manaUses ?? (card.manaUse ? [card.manaUse] : [])),
    ...(state.marketManaUses ?? []),
    ...(state.unitManaUses ?? []),
  ];
}

function sourceUseLimit(state: GameState) {
  return 1 + (state.extraSourceUsesThisTurn ?? 0) + state.played.reduce((sum, play) => {
    if (play.mode === "sideways") return sum;
    const card = getCard(play.instanceId);
    const stormBonus = card?.id === "manaStorm" && play.mode === "powered" ? 3 : 0;
    return sum + (card?.additionalSourceUses?.[play.mode] ?? 0) + stormBonus;
  }, 0);
}

function ordinarySourceUses(state: GameState) {
  return allManaUses(state).filter((use) => use.type === "source" && !use.extraSource).length;
}

function isBasicManaColor(color: ManaColor): color is BasicManaColor {
  return BASIC_COLORS.includes(color as BasicManaColor);
}

export function nightRulesApply(state: GameState) {
  const site = currentSite(state);
  // These Shades of Tezla overlays use night mana rules while the hero is on
  // them; the location card does not make this conditional on conquest.
  const eternalNight = Boolean(site && (site.site === "graveyard" || site.site === "necropolis"));
  return state.time === "night" || eternalNight || Boolean(state.combat?.nightRules)
    || state.played.some((play) => play.mode !== "sideways" && getCard(play.instanceId)?.basic.special === "amulet-darkness");
}

const RING_COLORS: Record<string, BasicManaColor> = {
  rubyRing: "red",
  sapphireRing: "blue",
  diamondRing: "white",
  emeraldRing: "green",
};

function infiniteRingMana(state: GameState, color: ManaColor) {
  return state.played.some((play) => {
    if (play.mode !== "powered") return false;
    const ringColor = RING_COLORS[getCard(play.instanceId)?.id ?? ""];
    return Boolean(ringColor && (color === ringColor || color === "black"));
  });
}

function findMana(state: GameState, color: ManaColor, excludedSourceIndices = new Set<number>()): ManaUse | undefined {
  const used = usedSourceIndices(state);
  if (infiniteRingMana(state, color)) return { type: "infinite", color: color === "gold" ? undefined : color };
  if (color !== "gold" && (state.manaTokens?.[color] ?? 0) > 0) return { type: "token", color };
  const sunActive = state.played.some((play) => play.mode !== "sideways" && getCard(play.instanceId)?.basic.special === "amulet-sun");
  if (isBasicManaColor(color) && (state.wildManaTokens ?? 0) > 0 && (!nightRulesApply(state) || sunActive)) return { type: "wild", color };
  if (ordinarySourceUses(state) < sourceUseLimit(state)) {
    const exactIndex = state.source.findIndex((die, index) => die.color === color && !used.has(index) && !excludedSourceIndices.has(index));
    if (exactIndex >= 0) return { type: "source", index: exactIndex };
    const wildIndex = color !== "gold" && color !== "black" ? state.source.findIndex((die, index) => {
      return !nightRulesApply(state) && die.color === "gold" && !used.has(index) && !excludedSourceIndices.has(index);
    }) : -1;
    if (wildIndex >= 0) return { type: "source", index: wildIndex };
    const manaStormWild = isBasicManaColor(color) && state.played.some((play) => getCard(play.instanceId)?.id === "manaStorm" && play.mode === "powered");
    const stormIndex = manaStormWild ? state.source.findIndex((die, index) => (die.color === "gold" || die.color === "black") && !used.has(index) && !excludedSourceIndices.has(index)) : -1;
    if (stormIndex >= 0) return { type: "source", index: stormIndex };
  }
  if (isBasicManaColor(color) && state.crystals[color] > 0) return { type: "crystal", color };
  return undefined;
}

function findCardMana(state: GameState, card: { color: ManaColor; alternateColor?: Exclude<ManaColor, "gold" | "black"> }, excludedSourceIndices = new Set<number>()) {
  return findMana(state, card.color, excludedSourceIndices) ?? (card.alternateColor ? findMana(state, card.alternateColor, excludedSourceIndices) : undefined);
}

export function canSpendMana(state: GameState, color: ManaColor) {
  return Boolean(findMana(state, color));
}

function refundMana(state: GameState, play: PlayedCard): GameState {
  const crystals = { ...state.crystals };
  const manaTokens = { ...EMPTY_MANA_TOKENS, ...state.manaTokens };
  (play.manaUses ?? (play.manaUse ? [play.manaUse] : [])).forEach((use) => {
    if (use.type === "crystal" && use.color && isBasicManaColor(use.color)) crystals[use.color] += 1;
    if (use.type === "token" && use.color) manaTokens[use.color] += 1;
  });
  const wildUses = (play.manaUses ?? (play.manaUse ? [play.manaUse] : [])).filter((use) => use.type === "wild").length;
  return { ...state, crystals, manaTokens, wildManaTokens: (state.wildManaTokens ?? 0) + wildUses };
}

export function availableResources(state: GameState): ResourcePool {
  const total = cloneResources(state.turnBonus);
  (state.skills ?? []).forEach((id) => {
    const skill = getSkill(id);
    if (skill?.special === "day-sharpshooting") addResources(total, { range: state.time === "day" ? 2 : 1 });
    else if (skill?.resource && !skill.special && (!skill.requiresWound || woundCount(state) > 0)) addResources(total, skill.resource);
  });
  Object.values(state.skillTurnResources ?? {}).forEach((resource) => addResources(total, resource));
  state.played.forEach((play) => {
    const card = getCard(play.instanceId);
    if (play.mode === "sideways" && play.sideResource) total[play.sideResource] += play.sidewaysValue ?? 1;
    else if (card && play.mode !== "sideways") {
      const effect = { ...(play.effectOverride ?? resolveCardEffect(card, play.mode, play.effectChoice)) };
      if (play.combatResourcesExpired) COMBAT_POINT_KEYS.forEach((key) => { delete effect[key]; });
      addResources(total, effect);
    }
  });
  state.units.filter((unit) => unit.used
    && !state.combat?.unitsForbidden
    && (!state.combat?.allowedUnitIds || state.combat.allowedUnitIds.includes(unit.id))).forEach((unit) => {
    const def = getUnit(unit.id);
    const ability = def?.abilities?.find((item) => item.id === unit.selectedAbilityId);
    const usableAfterSelfWound = Boolean(ability?.woundSelf);
    if (def && (!unit.wounded || usableAfterSelfWound) && (ability?.effect || (!def.abilities?.length && def.effect))) {
      const unitEffect = { ...(ability?.effect ?? def.effect) };
      if (def.id === "magicFamiliars") {
        const bonus = ability?.id === "attack" && unit.familiarCrystal === "red" ? 2
          : ability?.id === "block" && unit.familiarCrystal === "blue" ? 3
            : (ability?.id === "move" || ability?.id === "influence") && unit.familiarCrystal === "white" ? 2
              : ability?.id === "heal" && unit.familiarCrystal === "green" ? 1 : 0;
        const bonusKey = ability?.id as ResourceKey | undefined;
        if (bonusKey && bonus > 0) unitEffect[bonusKey] = (unitEffect[bonusKey] ?? 0) + bonus;
      }
      const heat = state.played.find((play) => getCard(play.instanceId)?.id === "intoTheHeat" && play.mode !== "sideways");
      if (heat) {
        const bonus = heat.mode === "powered" ? 3 : 2;
        COMBAT_POINT_KEYS.forEach((key) => {
          if ((unitEffect[key] ?? 0) > 0 && (key.toLowerCase().includes("attack") || key.toLowerCase().includes("block"))) unitEffect[key] = (unitEffect[key] ?? 0) + bonus;
        });
      }
      const glory = unit.banner?.cardId === "bannerGlory" || state.allUnitsGloryThisTurn;
      if (glory) {
        COMBAT_POINT_KEYS.forEach((key) => {
          if ((unitEffect[key] ?? 0) > 0 && (key.toLowerCase().includes("attack") || key.toLowerCase().includes("block"))) unitEffect[key] = (unitEffect[key] ?? 0) + 1;
        });
      }
      addResources(total, unitEffect);
    }
  });
  (Object.keys(total) as ResourceKey[]).forEach((key) => {
    total[key] = Math.max(0, total[key] - (state.spent[key] ?? 0));
  });
  return total;
}

export function effectiveReputation(state: GameState) {
  return Math.max(-5, Math.min(5, state.reputation));
}

export function reputationInfluenceModifier(state: GameState) {
  if (state.ignoreReputationThisTurn) return 0;
  const position = effectiveReputation(state);
  const modifiers: Record<number, number | null> = {
    [-5]: null,
    [-4]: -5,
    [-3]: -3,
    [-2]: -2,
    [-1]: -1,
    0: 0,
    1: 0,
    2: 1,
    3: 2,
    4: 3,
    5: 5,
  };
  return modifiers[position];
}

export function localsWillInteract(state: GameState) {
  return state.ignoreReputationThisTurn || reputationInfluenceModifier(state) !== null;
}

export function influenceCost(state: GameState, base: number) {
  if (state.interactionModifierUsed) return base;
  const modifier = reputationInfluenceModifier(state);
  return modifier === null ? base : Math.max(0, base - modifier - volkareCampInfluenceBonus(state));
}

function nearbyConqueredVolkareCamp(state: GameState) {
  const current = currentSite(state);
  if (!current) return undefined;
  return state.map.find((cell) => cell.site === "volkareCamp" && cell.conquered && (cell.id === current.id || isAdjacent(current, cell)));
}

export function hasConqueredVolkareCampServices(state: GameState) {
  return Boolean(nearbyConqueredVolkareCamp(state));
}

function volkareCampInfluenceBonus(state: GameState) {
  return nearbyConqueredVolkareCamp(state) ? (state.volkareShields ?? 0) : 0;
}

export function woundCount(state: GameState) {
  return [...state.hand, ...state.deck, ...state.discard].filter((id) => id.startsWith("wound#")).length;
}

export function createGame(heroId: string, difficulty: GameState["difficulty"] = "standard", mapVariant: MapVariant = "random", mapShape: MapShape = "wedge", seedOverride?: number, contentMode: ContentMode = "base"): GameState {
  const seed = seedOverride ?? Math.floor(Math.random() * 1_000_000_000);
  const random = rngFrom(seed);
  const heroes = getHeroesForMode(contentMode);
  const starterDecks = getStarterDecksForMode(contentMode);
  const hero = heroes.find((item) => item.id === heroId) ?? heroes[0];
  const shuffledDeck = shuffle(starterDecks[hero.id] ?? starterDecks.tovak, random);
  const opening = drawFrom(shuffledDeck, [], 5);
  const advancedDeck = shuffle(getAdvancedIdsForMode(contentMode), random);
  const spellDeck = shuffle(getSpellIdsForMode(contentMode), random);
  const regularUnitDeck = shuffle(getRegularUnitIdsForMode(contentMode), random);
  const eliteUnitDeck = shuffle(getEliteUnitIdsForMode(contentMode), random);
  const unitOffer = regularUnitDeck.splice(0, 3);
  const artifactDeck = shuffle(getArtifactIdsForMode(contentMode), random);
  const crystals = { red: 0, blue: 0, green: 0, white: 0 };
  const advancedOffer = advancedDeck.splice(0, 3);
  const spellOffer = spellDeck.splice(0, 3);
  const mapSetup = generateMapSetup(seed, difficulty, mapVariant, mapShape, contentMode);
  const enemySetup = populateEnemyTokens(mapSetup.map, makeEnemyDecks(random, contentMode), emptyEnemyPiles(), shuffle(getRuinTokensForMode(contentMode).map((token) => token.id), random), [], difficulty, random);
  const map = revealVisibleTokens(enemySetup.map, "0,0", "day");
  const initialMonasteries = map.filter((cell) => cell.site === "monastery").length;
  const monasteryOffer = advancedDeck.splice(0, initialMonasteries);
  return {
    version: 4,
    contentMode,
    seed,
    mapVariant,
    mapShape,
    mapTiles: mapSetup.mapTiles,
    tileDeck: mapSetup.tileDeck,
    removedMapTiles: mapSetup.removedMapTiles,
    heroId: hero.id,
    difficulty,
    phase: "tactic",
    round: 1,
    time: "day",
    position: "0,0",
    map,
    hand: opening.hand,
    deck: opening.deck,
    discard: [],
    played: [],
    spent: cloneResources(),
    turnBonus: cloneResources(),
    source: rollSource(3, "day"),
    marketManaUses: [],
    unitManaUses: [],
    manaTokens: { ...EMPTY_MANA_TOKENS },
    wildManaTokens: 0,
    crystals,
    fame: 0,
    reputation: 0,
    skills: [],
    pendingSkillChoices: [],
    pendingAdvancedChoices: [],
    pendingLevelRewards: 0,
    units: [],
    advancedOffer,
    advancedDeck,
    monasteryOffer,
    spellOffer,
    spellDeck,
    unitOffer,
    regularUnitDeck,
    eliteUnitDeck,
    artifactDeck,
    removedCards: [],
    woundDeck: [...getWoundIdsForMode(contentMode)],
    enemyDecks: enemySetup.enemyDecks,
    enemyDiscards: enemySetup.enemyDiscards,
    ruinDeck: enemySetup.ruinDeck,
    ruinDiscards: enemySetup.ruinDiscards,
    usedTactics: [],
    dummyDeck: 16,
    dummyCrystals: { red: 0, blue: 0, green: 2, white: 1 },
    dummySlowAvailable: false,
    finalTurn: false,
    missionCountdown: 0,
    actionTaken: false,
    interactionModifierUsed: false,
    refugeeCampRecruitUsed: false,
    ownedKeeps: 0,
    conqueredCities: 0,
    conqueredSites: 0,
    artifacts: 0,
    artifactInventory: [],
    factionTokens: { elementalists: 0, "dark-crusaders": 0 },
    volkareShields: 0,
    volkareMinorDefeats: 0,
    pursuedCampCellIds: [],
    volkarePursuitShields: 0,
    turnsTaken: 0,
    turnDiscardCount: 0,
    log: [`传送门在身后闭合。${contentMode === "ultimate" ? "Ultimate Edition 全扩展组件已混入。" : "本局仅使用基础版组件。"}选择本轮战术，开始单人征服。`],
  };
}

function regenerateMap(state: GameState): GameState {
  if (state.phase !== "tactic" || state.round !== 1 || state.turnsTaken !== 0 || state.usedTactics.length > 0) return state;
  const rolled = Math.floor(Math.random() * 1_000_000_000);
  const seed = rolled === state.seed ? (rolled + 1) % 1_000_000_000 : rolled;
  const setup = generateMapSetup(seed, state.difficulty, state.mapVariant ?? "classic", state.mapShape ?? "wedge", state.contentMode ?? "base");
  const random = rngFrom(seed);
  const mode = state.contentMode ?? "base";
  const enemySetup = populateEnemyTokens(setup.map, makeEnemyDecks(random, mode), emptyEnemyPiles(), shuffle(getRuinTokensForMode(mode).map((token) => token.id), random), [], state.difficulty, random);
  const map = revealVisibleTokens(enemySetup.map, "0,0", "day");
  return log({ ...state, seed, position: "0,0", map, enemyDecks: enemySetup.enemyDecks, enemyDiscards: enemySetup.enemyDiscards, ruinDeck: enemySetup.ruinDeck, ruinDiscards: enemySetup.ruinDiscards, mapTiles: setup.mapTiles, tileDeck: setup.tileDeck, removedMapTiles: setup.removedMapTiles }, `地图板块牌库已重新生成（种子 ${seed.toString().padStart(9, "0")}）。`);
}

function chooseTactic(state: GameState, tacticId: string): GameState {
  if (state.units.some((unit) => unit.needsFamiliarCrystal)) return log(state, "选择战术前，请先为每支魔法使魔替换水晶，或让它离队。 ");
  const tactic = TACTICS.find((item) => item.id === tacticId && item.time === state.time);
  if (!tactic || state.usedTactics.includes(tactic.id) || state.phase !== "tactic") return state;
  const remaining = TACTICS.filter((item) => item.time === state.time && !state.usedTactics.includes(item.id) && item.id !== tactic.id);
  const dummy = remaining[Math.floor(Math.random() * remaining.length)];
  let next: GameState = {
    ...state,
    phase: "planning",
    selectedTactic: tactic.id,
    dummyTactic: dummy?.id,
    usedTactics: [...state.usedTactics, tactic.id, ...(dummy ? [dummy.id] : [])],
    turnBonus: cloneResources(tactic.bonus),
    dummySlowAvailable: tactic.order === 6,
  };
  if ((tactic.bonus.draw ?? 0) > 0) {
    const drawn = drawFrom(next.deck, next.hand, tactic.bonus.draw ?? 0);
    next = { ...next, ...drawn, turnBonus: { ...next.turnBonus, draw: 0 } };
  }
  next = grantStartOfTurnSiteMana(next);
  next = log(next, `你选择了「${tactic.name}」；虚拟玩家选择了「${dummy?.name ?? "无"}」。`);
  if (dummy && dummy.order < tactic.order) next = dummyAdvance(next, true);
  return next;
}

function grantStartOfTurnSiteMana(state: GameState): GameState {
  const cell = currentSite(state);
  if (!cell) return state;
  const gladeLike = cell.site === "glade" || cell.site === "hiddenValley";
  const darkLocation = cell.site === "graveyard" || cell.site === "necropolis";
  if (gladeLike) {
    return state.time === "day"
      ? log({ ...state, wildManaTokens: (state.wildManaTokens ?? 0) + 1 }, `在「${SITE_LABELS[cell.site]}」开始白昼回合：获得 1 份金色魔力。`)
      : log({ ...state, manaTokens: { ...state.manaTokens, black: state.manaTokens.black + 1 } }, `在「${SITE_LABELS[cell.site]}」开始夜晚回合：获得 1 份黑色魔力。`);
  }
  if (darkLocation && state.time === "night") {
    return log({ ...state, manaTokens: { ...state.manaTokens, black: state.manaTokens.black + 1 } }, `在「${SITE_LABELS[cell.site]}」开始夜晚回合：获得 1 份黑色魔力。`);
  }
  return state;
}

const COMBAT_POINT_KEYS: ResourceKey[] = [
  "attack", "fireAttack", "iceAttack", "coldfireAttack",
  "block", "fireBlock", "iceBlock", "coldfireBlock",
  "range", "fireRange", "iceRange", "coldfireRange",
  "siege", "fireSiege", "iceSiege", "coldfireSiege",
];

export function resolveCardEffect(card: CardDef, mode: "basic" | "powered", effectChoice?: number): CardEffect {
  const printed = mode === "powered" ? card.powered : card.basic;
  if (!printed.choices?.length) return printed;
  return printed.choices[effectChoice ?? -1]?.effect ?? {};
}

function hasNonHealingEffect(effect: CardEffect) {
  return (Object.keys(effect) as Array<keyof CardEffect>).some((key) => key !== "heal" && key !== "note" && key !== "choices" && key !== "special" && typeof effect[key] === "number" && effect[key]! > 0);
}

function hasCombatPoints(effect: CardEffect) {
  return COMBAT_POINT_KEYS.some((key) => (effect[key] ?? 0) > 0);
}

function hasNonCombatResource(effect: CardEffect) {
  return (["move", "influence", "heal", "draw", "crystal"] as ResourceKey[]).some((key) => (effect[key] ?? 0) > 0);
}

function numericCardEffect(effect: CardEffect): CardEffect {
  const output: CardEffect = {};
  (Object.keys(EMPTY_RESOURCES) as ResourceKey[]).forEach((key) => {
    if ((effect[key] ?? 0) !== 0) output[key] = effect[key];
  });
  return output;
}

function addWoundToHand(state: GameState, count = 1): GameState | null {
  if (state.woundDeck.length < count) return null;
  return {
    ...state,
    hand: [...state.hand, ...state.woundDeck.slice(0, count)],
    woundDeck: state.woundDeck.slice(count),
  };
}

function isCommittedCard(state: GameState, instanceId: string) {
  return state.played.some((play) => play.instanceId === instanceId || play.linkedCard?.instanceId === instanceId);
}

function resourceBoost(effect: CardEffect, amount: number, multiplier = 1): CardEffect {
  const result = numericCardEffect(effect);
  const boosted = new Set<ResourceKey>([
    "move", "influence", "attack", "fireAttack", "iceAttack", "coldfireAttack",
    "block", "fireBlock", "iceBlock", "coldfireBlock", "range", "fireRange",
    "iceRange", "coldfireRange", "siege", "fireSiege", "iceSiege", "coldfireSiege",
  ]);
  (Object.keys(EMPTY_RESOURCES) as ResourceKey[]).forEach((key) => {
    const value = result[key] ?? 0;
    if (value > 0) result[key] = value * multiplier + (boosted.has(key) ? amount : 0);
  });
  return result;
}

function attachBanner(state: GameState, unitId: string | undefined, instanceId: string, cardId: string, command = false): GameState | null {
  if (!unitId) return null;
  const target = state.units.find((unit) => unit.id === unitId);
  if (!target) return null;
  const replaced = target.banner?.instanceId;
  return {
    ...state,
    discard: replaced ? [...state.discard, replaced] : state.discard,
    units: state.units.map((unit) => unit.id === unitId
      ? { ...unit, banner: { instanceId, cardId, faceUp: true, command } }
      : unit),
  };
}

interface SpecialPlayResolution {
  state: GameState;
  effect: CardEffect;
  linkedCard?: PlayedCard["linkedCard"];
  generatedMana?: PlayedCard["generatedMana"];
  generatedManaTokens?: PlayedCard["generatedManaTokens"];
  sourceTransforms?: PlayedCard["sourceTransforms"];
  error?: string;
}

function resolveSpecialCardPlay(state: GameState, card: CardDef, mode: "basic" | "powered", effect: CardEffect, selection: CardPlaySelection | undefined): SpecialPlayResolution {
  const unchanged = (message: string): SpecialPlayResolution => ({ state, effect: {}, error: message });
  const numeric = numericCardEffect(effect);
  if (!effect.special) return { state, effect: numeric };
  const color = selection?.manaColors?.[0];

  if (effect.special === "concentration" || effect.special === "will-focus") {
    if (mode === "basic") {
      if (effect.special === "will-focus" && selection?.option === "green-crystal") {
        if (state.crystals.green >= 3) return unchanged("绿色水晶库存已满，不能选择凝晶分支。");
        return { state: { ...state, crystals: { ...state.crystals, green: state.crystals.green + 1 } }, effect: {} };
      }
      if (!color || !(color === "red" || color === "blue" || color === "white")) return unchanged("请选择获得红、蓝或白色临时魔力。");
      return {
        state: { ...state, manaTokens: { ...state.manaTokens, [color]: state.manaTokens[color] + 1 } },
        effect: {},
        generatedMana: { color, count: 1 },
      };
    }
    const linkedId = selection?.cardInstanceId;
    const linked = linkedId ? getCard(linkedId) : undefined;
    if (!linkedId || !linked || linked.tier === "spell" || linked.tier === "artifact" || !state.hand.includes(linkedId) || linkedId === card.id || isCommittedCard(state, linkedId)) {
      return unchanged("请选择手中另一张尚未打出的行动牌。");
    }
    const linkedEffect = resolveCardEffect(linked, "powered", selection?.option ? Number(selection.option) : undefined);
    if (linkedEffect.choices?.length || linkedEffect.special) return unchanged("这张目标行动牌还需要额外目标或分支；请先选择一张可直接结算的行动牌。");
    return {
      state,
      effect: resourceBoost(linkedEffect, effect.special === "will-focus" ? 3 : 2),
      linkedCard: { instanceId: linkedId, mode: "powered" },
    };
  }

  if (effect.special === "mana-pull") {
    if (mode === "basic") return { state, effect: {} };
    const indices = selection?.sourceDieIndices ?? [];
    const colors = selection?.manaColors ?? [];
    const used = usedSourceIndices(state);
    if (indices.length !== 2 || new Set(indices).size !== 2 || colors.length !== 2 || indices.some((index) => !state.source[index] || used.has(index))) {
      return unchanged("强化魔力牵引需要选择两颗尚未使用的不同源泉骰，并为每颗选择一种非金色。");
    }
    const sourceTransforms = indices.map((index, choiceIndex) => ({ index, from: state.source[index].color, to: colors[choiceIndex] as TemporaryManaColor }));
    const generatedManaTokens: Partial<Record<TemporaryManaColor, number>> = {};
    colors.forEach((item) => { generatedManaTokens[item] = (generatedManaTokens[item] ?? 0) + 1; });
    const manaTokens = { ...state.manaTokens };
    colors.forEach((item) => { manaTokens[item] += 1; });
    return {
      state: { ...state, manaTokens, source: state.source.map((die, index) => {
        const transform = sourceTransforms.find((item) => item.index === index);
        return transform ? { color: transform.to } : die;
      }) },
      effect: {},
      generatedManaTokens,
      sourceTransforms,
    };
  }

  if (effect.special === "blood-rage") {
    if (!selection?.takeWound) return { state, effect: numeric };
    const wounded = addWoundToHand(state);
    if (!wounded) return unchanged("伤势牌堆已空，不能选择血怒的承伤强化。");
    return { state: wounded, effect: { ...numeric, attack: (numeric.attack ?? 0) + (mode === "powered" ? 5 : 3) } };
  }

  if (effect.special === "intimidate") {
    return { state: { ...state, reputation: Math.max(-5, state.reputation - (mode === "powered" ? 2 : 1)) }, effect: numeric };
  }

  if (effect.special === "blood-ritual") {
    const colors = selection?.manaColors ?? [];
    const needed = mode === "powered" ? 3 : 1;
    if (colors.length !== needed) return unchanged(`请选择 ${needed} 份临时魔力的颜色（可以包含黑色）。`);
    const wounded = addWoundToHand(state);
    if (!wounded) return unchanged("伤势牌堆已空，不能发动血之仪式。");
    const manaTokens = { ...wounded.manaTokens };
    colors.forEach((item) => { manaTokens[item] += 1; });
    let next = { ...wounded, manaTokens };
    if (mode === "basic") {
      if (next.crystals.red >= 3) return unchanged("红色水晶库存已满，不能发动血之仪式。");
      next = { ...next, crystals: { ...next.crystals, red: next.crystals.red + 1 } };
    } else if (selection?.option === "crystallize") {
      const crystalColor = colors.find(isBasicManaColor);
      if (!crystalColor || next.crystals[crystalColor] >= 3 || next.manaTokens[crystalColor] <= 0) return unchanged("凝晶分支需要选择至少一份基础色临时魔力，且同色库存不能已满。");
      next = { ...next, manaTokens: { ...next.manaTokens, [crystalColor]: next.manaTokens[crystalColor] - 1 }, crystals: { ...next.crystals, [crystalColor]: next.crystals[crystalColor] + 1 } };
    }
    return { state: next, effect: {} };
  }

  if (effect.special === "pure-magic") {
    if (!color || !isBasicManaColor(color)) return unchanged("请选择要支付的基础魔力颜色。");
    const paid = payManaCosts(state, [color]);
    if (!paid) return unchanged(`还需要 1 份${color}色魔力来结算纯粹魔法。`);
    const amount = mode === "powered" ? 7 : 4;
    const key: ResourceKey = color === "green" ? "move" : color === "white" ? "influence" : color === "blue" ? "block" : "attack";
    return { state: paid, effect: { [key]: amount } };
  }

  if (effect.special === "song-of-wind" && mode === "powered" && selection?.option === "lake") {
    const paid = payManaCosts(state, ["blue"]);
    if (!paid) return unchanged("让风之歌跨越湖泊还需要额外支付 1 份蓝色魔力。");
    return { state: paid, effect: numeric };
  }

  if (effect.special === "into-the-heat") {
    if (state.phase !== "combat" || state.combat?.step !== "ranged" || (state.combat.attackedEnemies?.length ?? 0) > 0) return unchanged("投身战火只能在战斗开始时打出。");
    return { state, effect: {} };
  }

  if (effect.special === "in-need") {
    const unitWounds = state.units.reduce((sum, unit) => sum + (unit.wounds ?? (unit.wounded ? 1 : 0)), 0);
    const handWounds = state.hand.filter((id) => id.startsWith("wound#")).length;
    return { state, effect: { influence: (numeric.influence ?? 0) + (handWounds + unitWounds) * (mode === "powered" ? 2 : 1) } };
  }

  if (effect.special === "decompose") {
    const targetId = selection?.cardInstanceId;
    const target = targetId ? getCard(targetId) : undefined;
    if (!targetId || !target || target.tier === "spell" || target.tier === "artifact" || targetId === card.id || !state.hand.includes(targetId) || isCommittedCard(state, targetId) || !isBasicManaColor(target.color)) return unchanged("请选择手中另一张基础色行动牌移出游戏。");
    const crystals = { ...state.crystals };
    const colors = mode === "basic" ? [target.color, target.color] : BASIC_COLORS.filter((item) => item !== target.color);
    colors.forEach((item) => { crystals[item] = Math.min(3, crystals[item] + 1); });
    return { state: { ...state, hand: state.hand.filter((id) => id !== targetId), removedCards: [...state.removedCards, targetId], crystals }, effect: {} };
  }

  if (effect.special === "crystal-mastery") {
    if (mode === "powered") return { state, effect: {} };
    if (!color || !isBasicManaColor(color) || state.crystals[color] <= 0 || state.crystals[color] >= 3) return unchanged("请选择一种你已拥有且库存未满的基础色水晶。");
    return { state: { ...state, crystals: { ...state.crystals, [color]: state.crystals[color] + 1 } }, effect: {} };
  }

  if (effect.special === "mana-storm") {
    const available = selection?.sourceDieIndices ?? [];
    if (mode === "basic") {
      const index = available[0];
      const die = index === undefined ? undefined : state.source[index];
      if (!die || !isBasicManaColor(die.color) || usedSourceIndices(state).has(index) || state.crystals[die.color] >= 3) return unchanged("请选择一颗尚未使用、显示基础色且库存未满的源泉骰。");
      const rerolled = BASIC_COLORS[(state.seed + state.turnsTaken + index) % BASIC_COLORS.length];
      return { state: { ...state, crystals: { ...state.crystals, [die.color]: state.crystals[die.color] + 1 }, source: state.source.map((item, dieIndex) => dieIndex === index ? { color: rerolled } : item) }, effect: {} };
    }
    const used = usedSourceIndices(state);
    return { state: { ...state, source: state.source.map((die, index) => used.has(index) ? die : { color: BASIC_COLORS[(state.seed + state.turnsTaken + index + 1) % BASIC_COLORS.length] }) }, effect: {} };
  }

  if (effect.special === "maximal-effect") {
    const linkedId = selection?.cardInstanceId;
    const linked = linkedId ? getCard(linkedId) : undefined;
    if (!linkedId || !linked || linked.tier === "spell" || linked.tier === "artifact" || !state.hand.includes(linkedId) || linkedId === card.id || isCommittedCard(state, linkedId)) return unchanged("请选择手中另一张尚未打出的行动牌。");
    const linkedMode = mode === "powered" ? "powered" : "basic";
    const linkedEffect = resolveCardEffect(linked, linkedMode, selection?.option ? Number(selection.option) : undefined);
    if (linkedEffect.choices?.length || linkedEffect.special) return unchanged("这张目标行动牌还需要额外目标或分支；当前请选择一张可直接结算的行动牌。");
    return { state, effect: resourceBoost(linkedEffect, 0, mode === "powered" ? 2 : 3), linkedCard: { instanceId: linkedId, mode: linkedMode, removeAtTurnEnd: true } };
  }

  if (effect.special === "magic-talent") {
    const spellId = selection?.cardId;
    const spell = spellId ? ALL_CARD_DEFS[spellId] : undefined;
    if (!spellId || !spell || spell.tier !== "spell" || !state.spellOffer.includes(spellId)) return unchanged("请选择法术供应区中的一张法术。");
    if (mode === "basic") {
      const discardId = selection?.cardInstanceId;
      const discard = discardId ? getCard(discardId) : undefined;
      if (!discardId || !discard || discardId === card.id || !state.hand.includes(discardId) || discard.color !== spell.color || isCommittedCard(state, discardId)) return unchanged("请选择手中一张与目标法术同色的非伤势牌弃掉。");
      const paid = payManaCosts(state, [spell.color]);
      if (!paid) return unchanged(`施放供应区法术仍需支付 1 份${spell.color}色魔力。`);
      const spellEffect = resolveCardEffect(spell, "basic", selection?.option ? Number(selection.option) : undefined);
      if (spellEffect.special || spellEffect.choices?.length) return unchanged("该法术还需要额外目标；请选择可直接结算的供应区法术。");
      return { state: { ...paid, hand: paid.hand.filter((id) => id !== discardId), discard: [...paid.discard, discardId] }, effect: numericCardEffect(spellEffect) };
    }
    if (!color || !isBasicManaColor(color) || spell.color !== color) return unchanged("请选择与目标法术同色的基础魔力。");
    const paid = payManaCosts(state, [color]);
    if (!paid) return unchanged(`还需额外支付 1 份${color}色魔力。`);
    const replacement = paid.spellDeck[0];
    return { state: { ...paid, spellOffer: [...paid.spellOffer.filter((id) => id !== spellId), ...(replacement ? [replacement] : [])], spellDeck: replacement ? paid.spellDeck.slice(1) : paid.spellDeck, discard: [...paid.discard, uid(spellId, paid)] }, effect: {} };
  }

  if (effect.special === "training") {
    const discardId = selection?.cardInstanceId;
    const offerId = selection?.cardId;
    const discarded = discardId ? getCard(discardId) : undefined;
    const gained = offerId ? ALL_CARD_DEFS[offerId] : undefined;
    if (!discardId || !discarded || !offerId || !gained || gained.tier !== "advanced" || !state.advancedOffer.includes(offerId) || !state.hand.includes(discardId) || discardId === card.id || discarded.color !== gained.color || isCommittedCard(state, discardId)) return unchanged("请选择手中另一张行动牌，并选择供应区一张同色进阶行动。");
    const replacement = state.advancedDeck[0];
    const gainedInstance = uid(offerId, state);
    return { state: { ...state, hand: [...state.hand.filter((id) => id !== discardId), ...(mode === "powered" ? [gainedInstance] : [])], discard: [...state.discard, ...(mode === "basic" ? [gainedInstance] : [])], removedCards: [...state.removedCards, discardId], advancedOffer: [...state.advancedOffer.filter((id) => id !== offerId), ...(replacement ? [replacement] : [])], advancedDeck: replacement ? state.advancedDeck.slice(1) : state.advancedDeck }, effect: {} };
  }

  if (effect.special === "underground-travel") {
    const path = selection?.cellIds ?? [];
    if (!path.length || path.length > 3) return unchanged("请选择 1 至 3 个连续的已揭示区域作为地下穿行路径。");
    let previous = state.map.find((cell) => cell.id === state.position);
    for (const id of path) {
      const next = state.map.find((cell) => cell.id === id);
      if (!previous || !next || !next.revealed || !isAdjacent(previous, next) || next.terrain === "swamp" || next.terrain === "lake") return unchanged("地下穿行只能经过连续、已揭示且非湖泊/沼泽的区域。");
      previous = next;
    }
    const target = previous!;
    const defenders = enemiesOnCell(target);
    const fortified = defenders.length > 0 && !target.conquered && ["keep", "mageTower", "city1", "city2"].includes(target.site);
    if (mode === "basic" && (defenders.length > 0 || isAdventureEnemyCell(target))) return unchanged("地下穿行的终点必须是安全区域。");
    if (mode === "powered" && !fortified) return unchanged("地底突袭必须在一个尚未征服的防御地点结束。");
    if (mode === "powered") {
      const [enemy, ...rest] = defenders;
      return {
        state: {
          ...state,
          position: target.id,
          reputation: Math.max(-5, state.reputation - 1),
          phase: "combat",
          actionTaken: true,
          combat: { cellId: target.id, originId: state.position, enemy, kind: "assault", step: "ranged", blocked: false, queue: rest.map((item) => ({ cellId: target.id, enemy: item })), mustWithdraw: true, chainStartFame: state.fame, ignoreSiteFortification: true },
        },
        effect: {},
      };
    }
    return { state: { ...state, position: target.id }, effect: {} };
  }

  if (effect.special === "burning-shield") {
    if (state.phase !== "combat" || state.combat?.step !== "block") return unchanged("燃烧/爆裂护盾只能在格挡阶段打出。");
    return { state, effect: numeric };
  }

  if (effect.special === "chill") {
    if (state.phase !== "combat" || !state.combat) return unchanged("严寒必须在战斗中选择一个敌人。 ");
    const id = selection?.enemyIds?.[0];
    const encounters = [activeEncounter(state.combat), ...(state.combat.queue ?? []), ...(state.combat.rangedSurvivors ?? [])];
    const target = encounters.find((entry) => entry.enemy.id === id)?.enemy;
    if (!target) return unchanged("请选择本场战斗中的一个敌人。 ");
    if (target.arcaneImmunity || combatEnemyResists(state, target, "ice")) return unchanged("该敌人的寒冰抗性或奥术免疫使严寒无效。 ");
    return {
      state: {
        ...state,
        combat: {
          ...state.combat,
          cancelledAttackIds: [...new Set([...(state.combat.cancelledAttackIds ?? []), target.id])],
          armorReductionByEnemyId: mode === "powered" ? { ...(state.combat.armorReductionByEnemyId ?? {}), [target.id]: (state.combat.armorReductionByEnemyId?.[target.id] ?? 0) + 4 } : state.combat.armorReductionByEnemyId,
        },
      },
      effect: {},
    };
  }

  if (effect.special === "wings") {
    if (mode === "powered") {
      if (state.phase !== "combat" || !state.combat) return unchanged("夜之翼只能在战斗中打出。 ");
      const ids = selection?.enemyIds ?? [];
      const all = [activeEncounter(state.combat), ...(state.combat.queue ?? []), ...(state.combat.rangedSurvivors ?? [])];
      if (!ids.length || ids.some((id) => !all.some((entry) => entry.enemy.id === id))) return unchanged("请选择至少一个本场战斗中的敌人。 ");
      const moveCost = Math.max(0, ((ids.length - 1) * ids.length) / 2);
      const paid = spend(state, "move", moveCost);
      if (!paid) return unchanged(`追加这些目标需要 ${moveCost} 点未使用移动。`);
      return { state: { ...paid, combat: { ...paid.combat!, cancelledAttackIds: [...new Set([...(paid.combat!.cancelledAttackIds ?? []), ...ids])] } }, effect: {} };
    }
    const path = selection?.cellIds ?? [];
    if (!path.length || path.length > 5) return unchanged("风之翼需要选择 1 至 5 个连续的已揭示区域。 ");
    const paid = spend(state, "move", path.length);
    if (!paid) return unchanged(`风之翼需要先拥有 ${path.length} 点未使用移动。`);
    let previous = paid.map.find((cell) => cell.id === paid.position);
    for (const id of path) {
      const next = paid.map.find((cell) => cell.id === id);
      if (!previous || !next || !next.revealed || !isAdjacent(previous, next)) return unchanged("风之翼路径必须连续且全部已经揭示。 ");
      previous = next;
    }
    if (enemiesOnCell(previous!).length || isAdventureEnemyCell(previous!)) return unchanged("风之翼的终点必须是安全区域。 ");
    return { state: { ...paid, position: previous!.id }, effect: {} };
  }

  if (effect.special === "demolish") {
    if (state.phase !== "combat" || !state.combat) return unchanged("拆毁/瓦解只能在战斗中使用。 ");
    const all = [activeEncounter(state.combat), ...(state.combat.queue ?? []), ...(state.combat.rangedSurvivors ?? [])];
    if (mode === "powered" && state.combat.step !== "attack") return unchanged("瓦解只能在近战攻击阶段打出。 ");
    const targetId = selection?.enemyIds?.[0];
    if (mode === "powered" && (!targetId || !all.some((entry) => entry.enemy.id === targetId))) return unchanged("请选择要瓦解的敌人。 ");
    const reductions = { ...(state.combat.armorReductionByEnemyId ?? {}) };
    all.forEach((entry) => {
      if (!combatEnemyResists(state, entry.enemy, "fire") && !entry.enemy.arcaneImmunity && (mode === "basic" || entry.enemy.id !== targetId)) reductions[entry.enemy.id] = (reductions[entry.enemy.id] ?? 0) + 1;
    });
    return { state: { ...state, combat: { ...state.combat, ignoreSiteFortification: mode === "basic" ? true : state.combat.ignoreSiteFortification, armorReductionByEnemyId: reductions, destroyedBySpellIds: mode === "powered" ? [...new Set([...(state.combat.destroyedBySpellIds ?? []), targetId!])] : state.combat.destroyedBySpellIds } }, effect: {} };
  }

  if (effect.special === "space-bending") return { state, effect: {} };

  if (effect.special === "call-to-arms") {
    const unitId = selection?.unitId;
    const unit = unitId ? getUnit(unitId) : undefined;
    if (!unitId || !unit || !state.unitOffer.includes(unitId)) return unchanged("请选择盟军供应区中的一个盟军。 ");
    if (unit.id === "magicFamiliars" || unit.id === "delphanaMasters") return unchanged("这支盟军的招募限制不允许征召/荣耀召唤取得或借用。 ");
    if (mode === "powered") {
      let units = [...state.units];
      if (units.length >= commandLimit(state)) {
        const disbandId = selection?.cardInstanceId;
        if (!disbandId || !units.some((item) => item.id === disbandId)) return unchanged("已达到指挥上限；请先选择一支现有盟军遣散。 ");
        units = units.filter((item) => item.id !== disbandId);
      }
      const replacement = state.regularUnitDeck[0] ?? state.eliteUnitDeck[0];
      return { state: { ...state, units: [...units, { id: unitId, used: false, wounded: false }], unitOffer: [...state.unitOffer.filter((id) => id !== unitId), ...(replacement ? [replacement] : [])], regularUnitDeck: state.regularUnitDeck[0] === replacement ? state.regularUnitDeck.slice(1) : state.regularUnitDeck, eliteUnitDeck: state.eliteUnitDeck[0] === replacement ? state.eliteUnitDeck.slice(1) : state.eliteUnitDeck }, effect: {} };
    }
    const ability = unit.abilities?.find((item) => item.id === selection?.option);
    const unitEffect = ability?.effect ?? (!unit.abilities?.length ? unit.effect : undefined);
    if (!unitEffect || ability?.woundSelf || ability?.readyUnitMaxLevel || ability?.allUnitResistances || ability?.cancelEnemyAttack) return unchanged("请选择该供应盟军的一项可直接结算能力。 ");
    const paid = ability?.manaCost ? payManaCosts(state, ability.manaCost) : state;
    if (!paid) return unchanged("没有足够魔力支付所选盟军能力。 ");
    return { state: paid, effect: numericCardEffect(unitEffect) };
  }

  if (effect.special === "meditation") {
    if (state.discard.length < 2) return unchanged("冥想需要弃牌堆中至少有 2 张牌。 ");
    const chosen = mode === "powered" ? (selection?.cardInstanceIds ?? []) : state.discard.slice(0, 2);
    if (chosen.length !== 2 || new Set(chosen).size !== 2 || chosen.some((id) => !state.discard.includes(id))) return unchanged("请选择弃牌堆中的两张不同卡牌。 ");
    const deck = selection?.option === "bottom" ? [...state.deck, ...chosen] : [...chosen, ...state.deck];
    return { state: { ...state, discard: state.discard.filter((id) => !chosen.includes(id)), deck }, effect: {} };
  }

  if (effect.special === "mana-meltdown" || effect.special === "mana-claim") return unchanged("这是多人竞争互动法术；单人游戏设置时不会加入法术牌库。 ");

  if (["banner-glory", "banner-fear", "banner-protection", "banner-courage"].includes(effect.special)) {
    if (mode === "basic") {
      const attached = attachBanner(state, selection?.unitId, card.id === "bannerGlory" ? card.id : card.id, card.id);
      if (!attached) return unchanged("请选择一支由你控制的盟军来装备这面旗帜。 ");
      return { state: attached, effect: {} };
    }
    if (effect.special === "banner-glory") {
      return { state: { ...state, allUnitsGloryThisTurn: true }, effect: {} };
    }
    if (effect.special === "banner-fear") {
      if (!state.combat) return unchanged("恐惧旗帜的强效只能在战斗中使用。 ");
      const allIds = [state.combat.enemy, ...(state.combat.queue ?? []).map((entry) => entry.enemy), ...(state.combat.rangedSurvivors ?? []).map((entry) => entry.enemy)].map((enemy) => enemy.id);
      const ids = selection?.enemyIds ?? [];
      if (!ids.length || ids.length > 3 || ids.some((id) => !allIds.includes(id))) return unchanged("请选择本场战斗中至多 3 个敌人。 ");
      return { state: { ...state, combat: { ...state.combat, cancelledAttackIds: [...new Set([...(state.combat.cancelledAttackIds ?? []), ...ids])] } }, effect: {} };
    }
    if (effect.special === "banner-protection") {
      const received = new Set(state.woundsReceivedThisTurn ?? []);
      return {
        state: {
          ...state,
          hand: state.hand.filter((id) => !received.has(id)),
          discard: state.discard.filter((id) => !received.has(id)),
          removedCards: [...state.removedCards, ...received],
          woundsReceivedThisTurn: [],
        },
        effect: {},
      };
    }
    if (state.phase === "combat") return unchanged("勇气旗帜的强效不能在战斗中使用。 ");
    return { state: { ...state, units: state.units.map((unit) => ({ ...unit, used: false, selectedAbilityId: undefined })) }, effect: {} };
  }

  if (effect.special === "elemental-ring") {
    const ringColor = RING_COLORS[card.id];
    if (!ringColor) return unchanged("无法识别戒指的元素颜色。 ");
    if (mode === "powered") return { state, effect: {} };
    return {
      state: {
        ...state,
        fame: state.fame + 1,
        manaTokens: { ...state.manaTokens, [ringColor]: state.manaTokens[ringColor] + 1 },
        crystals: { ...state.crystals, [ringColor]: Math.min(3, state.crystals[ringColor] + 1) },
      },
      effect: {},
      generatedManaTokens: { [ringColor]: 1 },
    };
  }

  if (effect.special === "sword-justice") {
    if (mode === "powered") {
      if (state.phase !== "combat" || state.combat?.step !== "attack") return unchanged("正义之剑的强效只能在近战攻击阶段打出。 ");
      return { state, effect: {} };
    }
    const discards = selection?.cardInstanceIds ?? [];
    if (discards.some((id) => id === card.id || !state.hand.includes(id) || isCommittedCard(state, id))) return unchanged("正义之剑只能弃掉手中其他尚未打出的牌。 ");
    return { state: { ...state, hand: state.hand.filter((id) => !discards.includes(id)), discard: [...state.discard, ...discards] }, effect: { attack: discards.length * 3 } };
  }

  if (effect.special === "golden-grail") return { state, effect: numeric };

  if (effect.special === "amulet-sun") {
    const amount = mode === "powered" ? 3 : 1;
    const map = state.time === "night" ? revealVisibleTokens(state.map, state.position, "day") : state.map;
    return { state: { ...state, map, wildManaTokens: (state.wildManaTokens ?? 0) + amount }, effect: {} };
  }

  if (effect.special === "amulet-darkness") {
    const amount = mode === "powered" ? 3 : 1;
    const colors = selection?.manaColors ?? [];
    if (colors.length !== amount) return unchanged(`请选择 ${amount} 份红、蓝、绿、白或黑色魔力。`);
    const manaTokens = { ...state.manaTokens };
    colors.forEach((item) => { manaTokens[item] += 1; });
    const generatedManaTokens: Partial<Record<TemporaryManaColor, number>> = {};
    colors.forEach((item) => { generatedManaTokens[item] = (generatedManaTokens[item] ?? 0) + 1; });
    return { state: { ...state, manaTokens }, effect: {}, generatedManaTokens };
  }

  if (effect.special === "savage-harvesting") {
    const discardId = selection?.cardInstanceId;
    if (!discardId) return { state, effect: numeric };
    const discarded = getCard(discardId);
    if (!discarded || !state.hand.includes(discardId) || discardId === card.id) return unchanged("只能弃掉手中另一张非伤势牌进行采集。 ");
    const chosenColor = discarded.tier === "artifact" ? color : discarded.color;
    if (!chosenColor || !isBasicManaColor(chosenColor) || state.crystals[chosenColor] >= 3) return unchanged("请选择一张基础色牌；若弃圣器，还要选择未满的水晶颜色。 ");
    return { state: { ...state, hand: state.hand.filter((id) => id !== discardId), discard: [...state.discard, discardId], crystals: { ...state.crystals, [chosenColor]: state.crystals[chosenColor] + 1 } }, effect: numeric };
  }

  if (effect.special === "ruthless-coercion") {
    if (mode === "basic") return { state, effect: numeric };
    let next = { ...state, reputation: Math.max(-5, state.reputation - 1) };
    for (const unitId of selection?.unitIds ?? []) {
      const unit = next.units.find((item) => item.id === unitId);
      const level = getUnit(unitId)?.level ?? 99;
      if (!unit?.used || unit.wounded || level > 2) return unchanged("无情胁迫只能重整已横置、未受伤的 I/II 级盟军。 ");
      const paid = spend(next, "influence", level * 2);
      if (!paid) return unchanged("无情胁迫产生的影响力不足以重整所选盟军。 ");
      next = { ...paid, units: paid.units.map((item) => item.id === unitId ? { ...item, used: false, selectedAbilityId: undefined } : item) };
    }
    return { state: next, effect: numeric };
  }

  if (effect.special === "one-with-the-land") {
    if (selection?.option === "heal") return { state, effect: { heal: mode === "powered" ? 2 : 1 } };
    if (selection?.option === "block") {
      if (mode === "basic") return { state, effect: { block: 2 } };
      const current = state.map.find((cell) => cell.id === state.position);
      const amount = current ? TERRAIN_COSTS[current.terrain][state.time] : 0;
      return { state, effect: state.time === "day" ? { fireBlock: Number.isFinite(amount) ? amount : current?.terrain === "mountain" ? 5 : 2 } : { iceBlock: Number.isFinite(amount) ? amount : current?.terrain === "mountain" ? 5 : 2 } };
    }
    return { state, effect: { move: mode === "powered" ? 4 : 2 } };
  }

  if (effect.special === "blood-of-ancients") {
    const offerId = selection?.cardId;
    const offer = offerId ? ALL_CARD_DEFS[offerId] : undefined;
    if (!offerId || !offer || offer.tier !== "advanced" || !state.advancedOffer.includes(offerId)) return unchanged("请选择进阶行动供应区中的一张牌。 ");
    const wounded = addWoundToHand(state);
    if (!wounded) return unchanged("伤势牌堆已空。 ");
    if (mode === "basic") {
      const manaColor = color;
      if (!manaColor || !isBasicManaColor(manaColor) || offer.color !== manaColor) return unchanged("请选择与目标进阶行动同色的基础魔力。 ");
      const paid = payManaCosts(wounded, [manaColor]);
      if (!paid) return unchanged("没有足够的同色魔力。 ");
      const replacement = paid.advancedDeck[0];
      return { state: { ...paid, hand: [...paid.hand, uid(offerId, paid)], advancedOffer: [...paid.advancedOffer.filter((id) => id !== offerId), ...(replacement ? [replacement] : [])], advancedDeck: replacement ? paid.advancedDeck.slice(1) : paid.advancedDeck }, effect: {} };
    }
    let preparedWounded = wounded;
    if (selection?.option === "discard-wound") {
      const wound = wounded.hand.find((id) => id.startsWith("wound#"));
      if (wound) preparedWounded = { ...wounded, hand: wounded.hand.filter((id) => id !== wound), discard: [...wounded.discard, wound] };
    }
    const borrowed = resolveCardEffect(offer, "powered", selection?.option?.startsWith("choice:") ? Number(selection.option.slice(7)) : undefined);
    if (borrowed.special) return unchanged("所选进阶行动还需要额外目标；请选择可直接结算的牌。 ");
    return { state: preparedWounded, effect: numericCardEffect(borrowed) };
  }

  if (effect.special === "shield-bash") {
    if (state.phase !== "combat" || state.combat?.step !== "block") return unchanged("盾击只能在格挡阶段打出。 ");
    const swiftMultiplier = state.combat.enemy.swift ? 2 : 1;
    return { state, effect: { block: (mode === "powered" ? 5 : 3) * swiftMultiplier } };
  }

  if (effect.special === "spell-forge") {
    const colors = selection?.manaColors ?? [];
    const count = mode === "powered" ? 2 : 1;
    const offeredColors = new Set(state.spellOffer.map((id) => ALL_CARD_DEFS[id]?.color));
    if (colors.length !== count || colors.some((item) => !isBasicManaColor(item) || !offeredColors.has(item) || state.crystals[item] >= 3)) return unchanged(`请选择 ${count} 个法术供应区中实际出现且库存未满的基础颜色。`);
    const crystals = { ...state.crystals };
    colors.forEach((item) => { if (isBasicManaColor(item)) crystals[item] = Math.min(3, crystals[item] + 1); });
    return { state: { ...state, crystals }, effect: {} };
  }

  if (effect.special === "chivalry") {
    const rewarded = selection?.option === "honor";
    return { state, effect: { attack: mode === "powered" ? (rewarded ? 4 : 6) : (rewarded ? 2 : 3) } };
  }

  if (effect.special === "peaceful-moment") {
    if (selection?.option !== "action") return { state, effect: numeric };
    let next = { ...state, actionTaken: true };
    const heal = Math.max(0, selection?.amount ?? 0);
    const unitIds = selection?.unitIds ?? [];
    const influenceCost = heal * 2 + unitIds.reduce((sum, id) => sum + (getUnit(id)?.level ?? 99) * 2, 0);
    const paid = spend(next, "influence", influenceCost);
    if (!paid) return unchanged("宁静时刻产生的影响力不足以支付所选治疗/重整。 ");
    next = { ...paid, units: paid.units.map((unit) => unitIds.includes(unit.id) && unit.used && !unit.wounded ? { ...unit, used: false, selectedAbilityId: undefined } : unit) };
    return { state: next, effect: { ...numeric, heal } };
  }

  if (effect.special === "stout-resolve") {
    const option = selection?.option as ResourceKey | undefined;
    if (!option || !(["move", "influence", "attack", "block"] as ResourceKey[]).includes(option)) return unchanged("请选择坚毅决心要提供的资源。 ");
    const discards = selection?.cardInstanceIds ?? [];
    if (mode === "basic" && (discards.length > 1 || discards.some((id) => !id.startsWith("wound#")))) return unchanged("基础坚毅决心最多弃一张伤势。 ");
    if (mode === "powered" && discards.filter((id) => id.startsWith("wound#")).length > 1) return unchanged("强化坚毅决心最多弃一张伤势。 ");
    if (discards.some((id) => !state.hand.includes(id) || id === card.id)) return unchanged("只能弃掉手中其他牌。 ");
    return { state: { ...state, hand: state.hand.filter((id) => !discards.includes(id)), discard: [...state.discard, ...discards] }, effect: { [option]: (mode === "powered" ? 3 : 2) + discards.length * (mode === "powered" ? 2 : 1) } };
  }

  if (effect.special === "force-of-nature") {
    if (mode === "basic") {
      const unitId = selection?.unitId;
      if (!unitId || !state.units.some((unit) => unit.id === unitId) || state.phase !== "combat") return unchanged("请选择本场战斗中的一支己方盟军。 ");
      return { state: { ...state, physicalResistanceUnitIds: [...new Set([...(state.physicalResistanceUnitIds ?? []), unitId])] }, effect: {} };
    }
    return { state, effect: selection?.option === "block" ? { block: 6 } : { siege: 3 } };
  }

  if (effect.special === "mountain-lore") return { state, effect: numeric };

  if (effect.special === "offering") {
    if (mode === "basic") {
      const discards = selection?.cardInstanceIds ?? [];
      if (discards.length > 3 || discards.some((id) => !state.hand.includes(id) || id === card.id || id.startsWith("wound#"))) return unchanged("奉献最多弃 3 张手中其他非伤势牌。 ");
      const crystals = { ...state.crystals, red: Math.min(3, state.crystals.red + 1) };
      discards.forEach((id, index) => {
        const discarded = getCard(id);
        const chosen = discarded?.tier === "artifact" ? selection?.manaColors?.[index] : discarded?.color;
        if (chosen && isBasicManaColor(chosen)) crystals[chosen] = Math.min(3, crystals[chosen] + 1);
      });
      return { state: { ...state, hand: state.hand.filter((id) => !discards.includes(id)), discard: [...state.discard, ...discards], crystals }, effect: {} };
    }
    const first = selection?.manaColors?.[0];
    const second = selection?.manaColors?.[1];
    if (!(first === "green" || first === "white") || !(second === "red" || second === "blue")) return unchanged("牺牲需要选择绿/白之一与红/蓝之一。 ");
    const pairs = Math.min(state.crystals[first], state.crystals[second]);
    if (!pairs) return unchanged("所选颜色没有可配对的水晶。 ");
    const crystals = { ...state.crystals, [first]: state.crystals[first] - pairs, [second]: state.crystals[second] - pairs };
    const manaTokens = { ...state.manaTokens, [first]: state.manaTokens[first] + pairs, [second]: state.manaTokens[second] + pairs };
    const key: ResourceKey = first === "green" ? (second === "red" ? "fireSiege" : "iceSiege") : (second === "red" ? "fireRange" : "iceRange");
    return { state: { ...state, crystals, manaTokens }, effect: { [key]: pairs * (first === "green" ? 4 : 6) } };
  }

  if (effect.special === "charm") {
    if (mode === "basic") {
      if (state.interactionSite && selection?.option === "crystal") {
        if (!color || !isBasicManaColor(color) || state.crystals[color] >= 3) return unchanged("请选择未满的水晶颜色。 ");
        return { state: { ...state, crystals: { ...state.crystals, [color]: state.crystals[color] + 1 } }, effect: numeric };
      }
      return { state, effect: numeric };
    }
    if (!state.combat) return unchanged("支配只能在战斗中使用。 ");
    const id = selection?.enemyIds?.[0];
    const all = [activeEncounter(state.combat), ...(state.combat.queue ?? [])];
    const target = all.find((entry) => entry.enemy.id === id)?.enemy;
    if (!target) return unchanged("请选择一个敌人。 ");
    const element = target.attackElement ?? "physical";
    const key = ATTACK_KEYS[element].attack;
    return { state: { ...state, combat: { ...state.combat, cancelledAttackIds: [...new Set([...(state.combat.cancelledAttackIds ?? []), target.id])] } }, effect: { [key]: target.attack * (target.attackCount ?? 1) } };
  }

  if (effect.special === "cure") {
    if (mode === "basic") return { state, effect: numeric };
    if (!state.combat || state.combat.step !== "attack") return unchanged("疾病只能在完成格挡后的近战攻击阶段施放。 ");
    const reductions = { ...(state.combat.armorReductionByEnemyId ?? {}) };
    const all = [activeEncounter(state.combat), ...(state.combat.queue ?? [])];
    all.forEach((entry) => { if (state.combat!.successfullyBlockedEnemyIds?.includes(entry.enemy.id)) reductions[entry.enemy.id] = Math.max(0, entry.enemy.armor - 1); });
    return { state: { ...state, combat: { ...state.combat, armorReductionByEnemyId: reductions } }, effect: {} };
  }

  if (effect.special === "banner-command") {
    if (mode === "basic") {
      if (!selection?.unitId) return { state, effect: numeric };
      if (!(state.recruitedUnitIdsThisTurn ?? []).includes(selection.unitId)) return unchanged("号令旗帜只能分配给本回合刚招募的盟军。 ");
      const attached = attachBanner(state, selection.unitId, card.id, card.id, true);
      return attached ? { state: attached, effect: numeric } : unchanged("请选择本回合刚招募的盟军。 ");
    }
    const unitId = selection?.unitId;
    if (!unitId || !state.unitOffer.includes(unitId)) return unchanged("请选择要免费招募的供应盟军。 ");
    if (["magicFamiliars", "delphanaMasters"].includes(getUnit(unitId)?.id ?? "")) return unchanged("这支盟军只能按其牌面规定通过当地互动招募。 ");
    let units = state.units;
    if (units.length >= commandLimit(state)) {
      const disband = selection?.cardInstanceId;
      if (!disband || !units.some((unit) => unit.id === disband)) return unchanged("已达指挥上限，请选择一支盟军遣散。 ");
      units = units.filter((unit) => unit.id !== disband);
    }
    const replacement = state.regularUnitDeck[0] ?? state.eliteUnitDeck[0];
    return { state: { ...state, fame: state.fame + 2, units: [...units, { id: unitId, used: false, wounded: false }], unitOffer: [...state.unitOffer.filter((id) => id !== unitId), ...(replacement ? [replacement] : [])], regularUnitDeck: state.regularUnitDeck[0] === replacement ? state.regularUnitDeck.slice(1) : state.regularUnitDeck, eliteUnitDeck: state.eliteUnitDeck[0] === replacement ? state.eliteUnitDeck.slice(1) : state.eliteUnitDeck, recruitedUnitIdsThisTurn: [...(state.recruitedUnitIdsThisTurn ?? []), unitId] }, effect: {} };
  }

  if (effect.special === "banner-fortitude") {
    if (mode === "basic") {
      const attached = attachBanner(state, selection?.unitId, card.id, card.id);
      return attached ? { state: attached, effect: {} } : unchanged("请选择一支由你控制的盟军来装备坚韧旗帜。 ");
    }
    if (state.phase === "combat") return unchanged("坚韧旗帜的强效不能在战斗中使用。 ");
    return { state: { ...state, units: state.units.map((unit) => ({ ...unit, wounded: false, wounds: 0 })) }, effect: {} };
  }

  if (effect.special === "circlet-proficiency") {
    const skillId = selection?.cardId;
    const skill = skillId ? getSkill(skillId) : undefined;
    if (!skill) return unchanged("请选择公共技能区的一项技能。 ");
    if (mode === "powered") return { state: { ...state, skills: [...new Set([...state.skills, skillId!])] }, effect: {} };
    return { state, effect: resourceBoost(skill.resource ?? {}, 0, 2) };
  }

  if (effect.special === "tome-all-spells") {
    const discardId = selection?.cardInstanceId;
    const spellId = selection?.cardId;
    const discard = discardId ? getCard(discardId) : undefined;
    const spell = spellId ? ALL_CARD_DEFS[spellId] : undefined;
    if (!discardId || !discard || !spell || spell.tier !== "spell" || !state.hand.includes(discardId) || discardId === card.id || !state.spellOffer.includes(spellId!) || discard.color !== spell.color) return unchanged("请选择一张手牌与供应区同色法术。 ");
    const borrowed = resolveCardEffect(spell, mode === "powered" ? "powered" : "basic", selection?.option?.startsWith("choice:") ? Number(selection.option.slice(7)) : undefined);
    if (borrowed.special) return unchanged("所选法术需要额外目标，当前请选择可直接结算法术。 ");
    return { state: { ...state, hand: state.hand.filter((id) => id !== discardId), discard: [...state.discard, discardId] }, effect: numericCardEffect(borrowed) };
  }

  if (effect.special === "chilling-stare") {
    if (selection?.option === "influence") return { state, effect: { influence: mode === "powered" ? 5 : 3 } };
    if (!state.combat) return unchanged("冰冷凝视的战斗分支需要选择敌人。 ");
    const id = selection?.enemyIds?.[0] ?? state.combat.enemy.id;
    if (state.combat.enemy.id !== id || combatEnemyResists(state, state.combat.enemy, "ice") || state.combat.enemy.arcaneImmunity) return unchanged("目标无效或免疫蓝色非攻击效果。 ");
    if (mode === "powered") return { state: { ...state, combat: { ...state.combat, cancelledAttackIds: [...new Set([...(state.combat.cancelledAttackIds ?? []), id])] } }, effect: {} };
    return { state, effect: {} };
  }

  if (effect.special === "mysterious-box") {
    const artifactId = state.artifactDeck[0];
    const artifact = artifactId ? ALL_CARD_DEFS[artifactId] : undefined;
    if (!artifact) return unchanged("圣器牌堆已空，神秘盒无法揭示。 ");
    const chosenMode = selection?.option === "powered" ? "powered" : "basic";
    const borrowed = resolveCardEffect(artifact, chosenMode);
    if (borrowed.special) return unchanged("神秘盒揭示了需要额外目标的圣器；请稍后在完整选择界面使用。 ");
    return { state: { ...state, fame: state.fame + 1, artifactDeck: [...state.artifactDeck.slice(1), artifactId!] }, effect: numericCardEffect(borrowed) };
  }

  return { state, effect: numeric };
}

function lockEffectsAtCombatStart(state: GameState): GameState {
  const remainingHealing = availableResources(state).heal;
  return {
    ...state,
    spent: remainingHealing > 0 ? { ...state.spent, heal: state.spent.heal + remainingHealing } : state.spent,
    played: state.played.map((play) => {
      if (play.mode === "sideways") return { ...play, lockedByCombat: true };
      const card = getCard(play.instanceId);
      return {
        ...play,
        lockedByCombat: true,
        combatResourcesExpired: card?.preserveCombatAfterMovement ? play.combatResourcesExpired : true,
      };
    }),
  };
}

function playCard(state: GameState, action: Extract<GameAction, { type: "PLAY_CARD" }>): GameState {
  if (state.phase !== "planning" && state.phase !== "combat") return state;
  if (!state.hand.includes(action.instanceId) || isCommittedCard(state, action.instanceId)) return state;
  const card = getCard(action.instanceId);
  if (!card && action.instanceId.startsWith("wound#") && state.ritualPainReady && action.mode === "sideways" && action.sideResource) {
    if (state.phase === "planning" && (action.sideResource === "attack" || action.sideResource === "block")) return log(state, "攻击与格挡不能在战斗前预存。 ");
    return log({
      ...state,
      ritualPainReady: false,
      played: [...state.played, { instanceId: action.instanceId, mode: "sideways", sideResource: action.sideResource, sidewaysValue: 3, consumedSkill: "ritual-pain" }],
    }, "痛苦仪式：将 1 张伤势横置为 3 点资源。 ");
  }
  if (!card) return state;
  const printedEffect = action.mode === "sideways" ? undefined : action.mode === "powered" ? card.powered : card.basic;
  if (printedEffect?.choices?.length && printedEffect.choices[action.effectChoice ?? -1] === undefined) {
    const choiceLabel = printedEffect.choices.length === 2 ? "二选一" : "多选一";
    return log(state, `「${card.name}」的这个效果是${choiceLabel}；请先选择要结算的分支。`);
  }
  const improvisationDiscard = card.id === "improvisation" && action.mode !== "sideways" ? action.discardInstanceId : undefined;
  if (card.id === "improvisation" && action.mode !== "sideways") {
    const discardCardDef = improvisationDiscard ? getCard(improvisationDiscard) : null;
    const validDiscard = Boolean(
      improvisationDiscard
      && improvisationDiscard !== action.instanceId
      && state.hand.includes(improvisationDiscard)
      && !isCommittedCard(state, improvisationDiscard)
      && discardCardDef,
    );
    if (!validDiscard) return log(state, "打出「临机应变」时，必须选择并弃掉手中另一张尚未打出的非伤势牌。");
  }
  const resolvedEffect = action.mode === "sideways" ? {} : resolveCardEffect(card, action.mode, action.effectChoice);
  if (state.phase === "planning" && action.mode === "sideways" && (action.sideResource === "attack" || action.sideResource === "block")) {
    return log(state, `横置提供的${action.sideResource === "attack" ? "攻击" : "格挡"}不能在战斗前预存；请在对应战斗步骤打出「${card.name}」。`);
  }
  if (state.phase === "combat" && (resolvedEffect.heal ?? 0) > 0 && !hasNonHealingEffect(resolvedEffect)) {
    return log(state, `治疗效果不能在战斗中打出；「${card.name}」没有可在当前战斗步骤结算的其他效果。`);
  }
  if (state.phase === "planning" && hasCombatPoints(resolvedEffect) && !hasNonCombatResource(resolvedEffect) && !card.preserveCombatAfterMovement) {
    return log(state, `攻击与格挡效果不能预先储存；请在战斗的对应步骤打出「${card.name}」。`);
  }
  let manaUses: ManaUse[] = [];
  let crystals = state.crystals;
  let manaTokens = { ...EMPTY_MANA_TOKENS, ...state.manaTokens };
  let wildManaTokens = state.wildManaTokens ?? 0;
  let source = state.source;
  let generatedMana: PlayedCard["generatedMana"];
  let sourceTransform: PlayedCard["sourceTransform"];
  const manaDrawPowered = card.id === "manaDraw" && action.mode === "powered";
  const manaDrawDieIndex = action.manaDrawDieIndex;
  const manaDrawColor = action.manaDrawColor;
  if (manaDrawPowered) {
    if (manaDrawDieIndex === undefined || !manaDrawColor) {
      return log(state, "强化「魔力汲取」时，请选择要从源泉取走的骰子及其新颜色。");
    }
    if (!state.source[manaDrawDieIndex] || usedSourceIndices(state).has(manaDrawDieIndex)) {
      return log(state, "这颗源泉骰已经被使用，不能再由「魔力汲取」取走。");
    }
  }
  if (card.tier === "spell" && action.mode !== "sideways") {
    if (action.mode === "powered") {
      if (!nightRulesApply(state)) return log(state, `「${card.name}」的强效法术只能在夜晚规则下使用。`);
      const blackUse = findMana(state, "black");
      const stateWithBlackReserved = blackUse ? { ...state, unitManaUses: [...(state.unitManaUses ?? []), blackUse] } : state;
      const coloredUse = card.color !== "gold" && card.color !== "black" ? findMana(stateWithBlackReserved, card.color) : undefined;
      if (!blackUse || !coloredUse) {
        return log(state, `「${card.name}」的强效法术需要 1 份黑色魔力与 1 份${card.color}色魔力；黑色通常来自夜间源泉，对应色可用临时魔力或水晶。`);
      }
      manaUses = [blackUse, coloredUse];
      manaUses.forEach((use) => {
        if (use.type === "crystal" && use.color && isBasicManaColor(use.color)) crystals = { ...crystals, [use.color]: crystals[use.color] - 1 };
        if (use.type === "token" && use.color) manaTokens = { ...manaTokens, [use.color]: manaTokens[use.color] - 1 };
        if (use.type === "wild") wildManaTokens -= 1;
      });
    } else {
      const manaUse = findMana(state, card.color);
      if (!manaUse) return log(state, `施放「${card.name}」需要 1 份${card.color}色魔力。`);
      manaUses = [manaUse];
      if (manaUse.type === "crystal" && manaUse.color && isBasicManaColor(manaUse.color)) crystals = { ...crystals, [manaUse.color]: crystals[manaUse.color] - 1 };
      if (manaUse.type === "token" && manaUse.color) manaTokens = { ...manaTokens, [manaUse.color]: manaTokens[manaUse.color] - 1 };
      if (manaUse.type === "wild") wildManaTokens -= 1;
    }
  } else if (action.mode === "powered" && card.tier !== "artifact") {
    const excluded = manaDrawDieIndex === undefined ? new Set<number>() : new Set([manaDrawDieIndex]);
    const manaUse = findCardMana(state, card, excluded);
    if (!manaUse) return log(state, `没有可用的${card.color}${card.alternateColor ? `或${card.alternateColor}` : ""}色魔力来强化「${card.name}」。`);
    manaUses = [manaUse];
    if (manaUse.type === "crystal" && manaUse.color && isBasicManaColor(manaUse.color)) crystals = { ...crystals, [manaUse.color]: crystals[manaUse.color] - 1 };
    if (manaUse.type === "token" && manaUse.color) manaTokens = { ...manaTokens, [manaUse.color]: manaTokens[manaUse.color] - 1 };
    if (manaUse.type === "wild") wildManaTokens -= 1;
    if (manaDrawPowered && manaDrawDieIndex !== undefined && manaDrawColor) {
      sourceTransform = { index: manaDrawDieIndex, from: state.source[manaDrawDieIndex].color, to: manaDrawColor };
      source = state.source.map((die, index) => index === manaDrawDieIndex ? { color: manaDrawColor } : die);
      generatedMana = { color: manaDrawColor, count: 2 };
      manaTokens = { ...manaTokens, [manaDrawColor]: manaTokens[manaDrawColor] + 2 };
      manaUses.push({ type: "source", index: manaDrawDieIndex, extraSource: true });
    }
  }
  if (action.selection?.cardInstanceId === action.instanceId) return log(state, `「${card.name}」不能把自己选作目标或额外代价。`);
  const howlValue = action.mode === "sideways" && state.howlPackReady
    ? 4 + Math.max(0, commandLimit(state) - state.units.length)
    : undefined;
  const placeholder: PlayedCard = { instanceId: action.instanceId, mode: action.mode, sideResource: action.sideResource, sidewaysValue: howlValue, effectChoice: action.effectChoice, manaUse: manaUses[0], manaUses };
  const specialInput: GameState = { ...state, source, crystals, manaTokens, wildManaTokens, played: [...state.played, placeholder] };
  const special = action.mode === "sideways"
    ? { state: specialInput, effect: {} } satisfies SpecialPlayResolution
    : resolveSpecialCardPlay(specialInput, card, action.mode, resolvedEffect, action.selection);
  if (special.error) return log(state, special.error);
  const extraManaUses = special.state.unitManaUses.slice(state.unitManaUses.length);
  manaUses = [...manaUses, ...extraManaUses];
  let specialState: GameState = { ...special.state, played: state.played, unitManaUses: state.unitManaUses, howlPackReady: howlValue ? false : special.state.howlPackReady };
  const openedSourceUse = state.sourceOpeningReady && ordinarySourceUses(state) >= 1
    ? manaUses.find((use) => use.type === "source" && use.index !== undefined && isBasicManaColor(state.source[use.index]?.color))
    : undefined;
  if (openedSourceUse?.index !== undefined) {
    const color = state.source[openedSourceUse.index].color as BasicManaColor;
    specialState = { ...specialState, sourceOpeningReady: false, crystals: { ...specialState.crystals, [color]: Math.min(3, specialState.crystals[color] + 1) } };
  }
  const finalEffect = { ...special.effect };
  let consumedSkill: PlayedCard["consumedSkill"] = howlValue ? "howl-pack" : undefined;
  const overloadColor = state.manaOverloadColor;
  if (overloadColor && action.mode !== "sideways" && manaUses.some((use) => use.color === overloadColor)) {
    const eligible = (["move", "influence", ...COMBAT_POINT_KEYS] as ResourceKey[]).find((key) => (finalEffect[key] ?? 0) > 0);
    if (eligible) {
      finalEffect[eligible] = (finalEffect[eligible] ?? 0) + 4;
      specialState = { ...specialState, manaOverloadColor: undefined };
      consumedSkill = "mana-overload";
    }
  }
  generatedMana = special.generatedMana ?? generatedMana;
  const healingCommitted = state.phase === "combat" ? (special.effect.heal ?? 0) : 0;
  const play: PlayedCard = {
    instanceId: action.instanceId,
    mode: action.mode,
    sideResource: action.sideResource,
    sidewaysValue: howlValue,
    effectChoice: action.effectChoice,
    discardedInstanceId: improvisationDiscard,
    healingCommitted,
    generatedMana,
    generatedManaTokens: special.generatedManaTokens,
    sourceTransform,
    sourceTransforms: special.sourceTransforms,
    manaUse: manaUses[0],
    manaUses,
    selection: action.selection,
    effectOverride: finalEffect,
    consumedSkill,
    linkedCard: special.linkedCard,
    specialUndo: resolvedEffect.special ? {
      hand: state.hand,
      discard: state.discard,
      removedCards: state.removedCards,
      crystals: state.crystals,
      reputation: state.reputation,
      manaTokens: state.manaTokens,
      wildManaTokens: state.wildManaTokens,
      source: state.source,
      spellOffer: state.spellOffer,
      spellDeck: state.spellDeck,
      advancedOffer: state.advancedOffer,
      advancedDeck: state.advancedDeck,
      woundDeck: state.woundDeck,
      position: state.position,
      phase: state.phase,
      actionTaken: state.actionTaken,
      combat: state.combat,
      spent: state.spent,
      units: state.units,
      unitOffer: state.unitOffer,
      regularUnitDeck: state.regularUnitDeck,
      eliteUnitDeck: state.eliteUnitDeck,
      artifactDeck: state.artifactDeck,
      fame: state.fame,
      physicalResistanceUnitIds: state.physicalResistanceUnitIds,
      woundsReceivedThisTurn: state.woundsReceivedThisTurn,
      goldenGrailHealingSpent: state.goldenGrailHealingSpent,
      recruitedUnitIdsThisTurn: state.recruitedUnitIdsThisTurn,
      allUnitsGloryThisTurn: state.allUnitsGloryThisTurn,
    } : undefined,
  };
  const ringSpellFame = card.tier === "spell" && state.played.some((existing) => existing.mode === "powered" && RING_COLORS[getCard(existing.instanceId)?.id ?? ""] === card.color) ? 1 : 0;
  return {
    ...specialState,
    fame: specialState.fame + ringSpellFame,
    hand: improvisationDiscard ? specialState.hand.filter((id) => id !== improvisationDiscard) : specialState.hand,
    discard: improvisationDiscard ? [...specialState.discard, improvisationDiscard] : specialState.discard,
    spent: healingCommitted > 0 ? { ...specialState.spent, heal: specialState.spent.heal + healingCommitted } : specialState.spent,
    played: [...specialState.played, play],
  };
}

function unplayCard(state: GameState, instanceId: string): GameState {
  const play = state.played.find((item) => item.instanceId === instanceId || item.linkedCard?.instanceId === instanceId);
  if (!play) return state;
  if (play.lockedByCombat) return log(state, "这张牌已被战斗起点或公开的新信息锁定，不能直接收回；尚未锁定的步骤请使用逐步撤回。 ");
  const nextPlayed = state.played.filter((item) => item.instanceId !== play.instanceId);
  const currentManaTokens = { ...EMPTY_MANA_TOKENS, ...state.manaTokens };
  if (play.generatedMana && currentManaTokens[play.generatedMana.color] < play.generatedMana.count) {
    return log(state, "「魔力汲取」产生的临时魔力已经被使用，无法直接收回这张牌。 ");
  }
  if (play.discardedInstanceId && !state.discard.includes(play.discardedInstanceId)) {
    return log(state, "「临机应变」弃掉的牌已经不在弃牌堆，无法直接撤回。 ");
  }
  const generated = { ...(play.generatedManaTokens ?? {}) };
  if (play.generatedMana) generated[play.generatedMana.color] = (generated[play.generatedMana.color] ?? 0) + play.generatedMana.count;
  for (const [color, count] of Object.entries(generated) as Array<[TemporaryManaColor, number]>) {
    if (currentManaTokens[color] < count) return log(state, "这张牌产生的临时魔力已经被使用，无法直接收回这张牌。 ");
  }
  const manaTokens = { ...currentManaTokens };
  (Object.entries(generated) as Array<[TemporaryManaColor, number]>).forEach(([color, count]) => { manaTokens[color] -= count; });
  const transforms = [...(play.sourceTransforms ?? []), ...(play.sourceTransform ? [play.sourceTransform] : [])];
  const source = state.source.map((die, index) => {
    const transform = transforms.find((item) => item.index === index);
    return transform ? { color: transform.from } : die;
  });
  let reversibleBase: GameState = play.specialUndo ? {
    ...state,
    ...play.specialUndo,
    played: nextPlayed,
    spent: play.healingCommitted ? { ...state.spent, heal: Math.max(0, state.spent.heal - play.healingCommitted) } : state.spent,
  } : {
    ...state,
    source,
    manaTokens,
    hand: play.discardedInstanceId ? [...state.hand, play.discardedInstanceId] : state.hand,
    discard: play.discardedInstanceId ? state.discard.filter((id) => id !== play.discardedInstanceId) : state.discard,
    played: nextPlayed,
    spent: play.healingCommitted ? { ...state.spent, heal: Math.max(0, state.spent.heal - play.healingCommitted) } : state.spent,
  };
  if (play.consumedSkill === "ritual-pain") reversibleBase = { ...reversibleBase, ritualPainReady: true };
  if (play.consumedSkill === "howl-pack") reversibleBase = { ...reversibleBase, howlPackReady: true };
  if (play.consumedSkill === "mana-overload") reversibleBase = { ...reversibleBase, manaOverloadColor: play.manaUses?.find((use) => use.color)?.color };
  const test = play.specialUndo ? reversibleBase : refundMana(reversibleBase, play);
  const total = availableResources({ ...test, spent: cloneResources() });
  const resourcesValid = (Object.keys(state.spent) as ResourceKey[]).every((key) => total[key] >= state.spent[key]);
  const sourceAllowanceValid = ordinarySourceUses(test) <= sourceUseLimit(test);
  const valid = resourcesValid && sourceAllowanceValid;
  return valid ? test : log(state, "这张牌产生的资源已经被花费，无法撤回。 ");
}

function discardCard(state: GameState, instanceId: string): GameState {
  if (state.phase !== "planning" || state.played.some((item) => item.instanceId === instanceId) || !state.hand.includes(instanceId) || instanceId.startsWith("wound#")) return state;
  return log({
    ...state,
    hand: state.hand.filter((id) => id !== instanceId),
    discard: [...state.discard, instanceId],
    turnDiscardCount: (state.turnDiscardCount ?? 0) + 1,
  }, `你选择在补牌前弃掉「${getCard(instanceId)?.name ?? "行动牌"}」。`);
}

function toggleUnit(state: GameState, unitId: string): GameState {
  if (state.phase !== "planning" && state.phase !== "combat") return state;
  if (state.combat?.unitsForbidden) return log(state, "该地点战斗禁止盟军参与。");
  const unit = state.units.find((item) => item.id === unitId);
  if (!unit || unit.wounded) return state;
  const nextUnits = state.units.map((item) => item.id === unitId ? { ...item, used: !item.used } : item);
  if (!unit.used) return { ...state, units: nextUnits };
  const total = availableResources({ ...state, units: nextUnits, spent: cloneResources() });
  const valid = (Object.keys(state.spent) as ResourceKey[]).every((key) => total[key] >= state.spent[key]);
  return valid ? { ...state, units: nextUnits } : log(state, "这支盟军提供的资源已经被花费。 ");
}

function payManaCosts(state: GameState, colors: ManaColor[]): GameState | null {
  let next = state;
  const uses: ManaUse[] = [];
  const orderedColors = [...colors].sort((a, b) => {
    const stored = (color: ManaColor) => color !== "gold" ? (state.manaTokens?.[color] ?? 0) + (isBasicManaColor(color) ? state.crystals[color] : 0) : 0;
    return stored(a) - stored(b);
  });
  for (const color of orderedColors) {
    const use = findMana({ ...next, unitManaUses: [...(next.unitManaUses ?? []), ...uses] }, color);
    if (!use) return null;
    uses.push(use);
    if (use.type === "crystal" && use.color && isBasicManaColor(use.color)) next = { ...next, crystals: { ...next.crystals, [use.color]: next.crystals[use.color] - 1 } };
    if (use.type === "token" && use.color) next = { ...next, manaTokens: { ...next.manaTokens, [use.color]: next.manaTokens[use.color] - 1 } };
    if (use.type === "wild") next = { ...next, wildManaTokens: Math.max(0, (next.wildManaTokens ?? 0) - 1) };
  }
  return { ...next, unitManaUses: [...(next.unitManaUses ?? []), ...uses] };
}

export function availableManaCount(state: GameState, color: ManaColor, limit = 3) {
  let probe = state;
  let count = 0;
  while (count < limit) {
    const paid = payManaCosts(probe, [color]);
    if (!paid) break;
    probe = paid;
    count += 1;
  }
  return count;
}

function addSkillResource(state: GameState, skillId: string, resource: Partial<ResourcePool>): GameState {
  return {
    ...state,
    skillUsesThisTurn: [...new Set([...(state.skillUsesThisTurn ?? []), skillId])],
    skillTurnResources: { ...(state.skillTurnResources ?? {}), [skillId]: resource },
  };
}

function activateSkill(state: GameState, action: Extract<GameAction, { type: "ACTIVATE_SKILL" }>): GameState {
  const skill = getSkill(action.skillId);
  if (!skill || !state.skills.includes(action.skillId) || (state.phase !== "planning" && state.phase !== "combat")) return state;
  const usedTurn = state.skillUsesThisTurn?.includes(skill.id);
  const usedRound = state.skillUsesThisRound?.includes(skill.id);
  const markRound = (next: GameState) => ({ ...next, skillUsesThisRound: [...new Set([...(next.skillUsesThisRound ?? []), skill.id])] });
  const markTurn = (next: GameState) => ({ ...next, skillUsesThisTurn: [...new Set([...(next.skillUsesThisTurn ?? []), skill.id])] });

  if (skill.special === "inspiration") {
    if (usedRound || state.phase === "combat") return log(state, "鼓舞每轮只能在战斗外使用一次。 ");
    const unit = state.units.find((item) => item.id === action.unitId);
    if (!unit || (action.option !== "ready" && action.option !== "heal")) return log(state, "请选择要重整或治疗的盟军。 ");
    if (action.option === "ready" && !unit.used) return log(state, "只能重整已经横置的盟军。 ");
    if (action.option === "heal" && !unit.wounded) return log(state, "只能治疗受伤的盟军。 ");
    return log(markRound({ ...state, units: state.units.map((item) => item.id === unit.id
      ? action.option === "ready" ? { ...item, used: false, selectedAbilityId: undefined } : { ...item, wounded: false, wounds: 0 }
      : item) }), `鼓舞：${action.option === "ready" ? "重整" : "完全治疗"}「${getUnit(unit.id)?.name}」。`);
  }

  if (skill.special === "on-her-own") {
    if (usedTurn || state.phase !== "planning") return state;
    const strong = action.option === "strong" && !(state.recruitedUnitIdsThisTurn?.length);
    return log(addSkillResource(state, skill.id, { influence: strong ? 3 : 1 }), `独来独往：获得影响力 ${strong ? 3 : 1}${strong ? "；若稍后招募盟军，招募费用会补回 2 点" : ""}。`);
  }

  if (skill.special === "battle-frenzy") {
    if (usedTurn || state.phase !== "combat" || state.combat?.step !== "attack") return log(state, "战斗狂热只能在近战攻击阶段每回合使用一次。 ");
    const strong = action.option === "strong" && !state.flippedSkills?.includes(skill.id);
    let next = addSkillResource(state, skill.id, { attack: strong ? 4 : 2 });
    if (strong) next = { ...next, flippedSkills: [...new Set([...(next.flippedSkills ?? []), skill.id])] };
    return log(next, `战斗狂热：攻击 ${strong ? 4 : 2}${strong ? "，技能翻至背面" : ""}。`);
  }

  if (skill.special === "shamanic-ritual") {
    if (action.option === "refresh") {
      if (!state.flippedSkills?.includes(skill.id) || state.phase !== "planning" || state.actionTaken) return log(state, "萨满仪式只能作为本回合行动翻回。 ");
      return log({ ...state, actionTaken: true, flippedSkills: state.flippedSkills.filter((id) => id !== skill.id) }, "萨满仪式已作为本回合行动翻回正面。 ");
    }
    if (state.flippedSkills?.includes(skill.id) || !action.color) return log(state, "请选择颜色；背面的萨满仪式须先翻回。 ");
    if (action.color === "gold") {
      if (state.time !== "day") return log(state, "金色魔力仅能在白昼作为基础色使用。 ");
      return log({ ...state, wildManaTokens: (state.wildManaTokens ?? 0) + 1, flippedSkills: [...new Set([...(state.flippedSkills ?? []), skill.id])] }, "萨满仪式：获得 1 份金色临时魔力，技能翻面。 ");
    }
    return log({ ...state, manaTokens: { ...state.manaTokens, [action.color]: state.manaTokens[action.color] + 1 }, flippedSkills: [...new Set([...(state.flippedSkills ?? []), skill.id])] }, `萨满仪式：获得 1 份${action.color}色临时魔力，技能翻面。`);
  }

  if (skill.special === "arcane-disguise") {
    if (usedTurn) return state;
    if (action.option === "refresh") {
      if (!state.flippedSkills?.includes(skill.id)) return state;
      const paid = payManaCosts(state, ["green"]);
      if (!paid) return log(state, "翻回奥术伪装需要 1 份绿色魔力。 ");
      return log(markTurn({ ...paid, flippedSkills: paid.flippedSkills?.filter((id) => id !== skill.id) }), "支付绿色魔力，奥术伪装翻回正面。 ");
    }
    if (action.option === "disguise") {
      if (state.flippedSkills?.includes(skill.id)) return state;
      return log(markTurn({ ...state, ignoreReputationThisTurn: true, flippedSkills: [...new Set([...(state.flippedSkills ?? []), skill.id])] }), "奥术伪装：本回合忽略声誉轨效果，也可以在 X 声誉互动。 ");
    }
    return log(addSkillResource(state, skill.id, { influence: 2 }), "奥术伪装：获得影响力 2。 ");
  }

  if (skill.special === "master-chaos") {
    if (usedTurn) return state;
    const order: ManaColor[] = ["blue", "green", "black", "white", "red", "gold"];
    const current = state.masterChaosColor ?? order[state.seed % order.length];
    const color = order[(order.indexOf(current) + 1) % order.length];
    const resource: Partial<ResourcePool> = color === "blue" ? { block: 3 }
      : color === "green" ? { move: 1 }
        : color === "black" ? { coldfireRange: 1 }
          : color === "white" ? { influence: 2 }
            : color === "red" ? { attack: 2 }
              : action.option === "block" ? { block: 3 }
                : action.option === "move" ? { move: 1 }
                  : action.option === "range" ? { coldfireRange: 1 }
                    : action.option === "influence" ? { influence: 2 }
                      : { attack: 2 };
    return log({ ...addSkillResource(state, skill.id, resource), masterChaosColor: color }, `混沌大师移至${color}色并获得对应效果。`);
  }

  if (skill.special === "mana-overload") {
    if (usedRound || !action.color || action.color === "gold") return log(state, "魔力过载每轮一次，且必须选择非金色魔力。 ");
    const manaTokens = { ...state.manaTokens, [action.color]: state.manaTokens[action.color] + 1 };
    return log(markRound({ ...state, manaTokens, manaOverloadColor: action.color }), `魔力过载：获得${action.color}色魔力；首张使用同色魔力强化的资源牌对应效果 +4。`);
  }

  if (skill.special === "ritual-of-pain") {
    if (usedRound || state.phase === "combat") return log(state, "痛苦仪式每轮只能在战斗外使用一次。 ");
    const wounds = action.cardInstanceIds ?? [];
    if (wounds.length > 2 || wounds.some((id) => !id.startsWith("wound#") || !state.hand.includes(id))) return log(state, "请选择手中至多 2 张伤势。 ");
    return log(markRound({ ...state, hand: state.hand.filter((id) => !wounds.includes(id)), removedCards: [...state.removedCards, ...wounds], ritualPainReady: true }), `痛苦仪式：移除 ${wounds.length} 张伤势；可将另一张伤势横置为 3。`);
  }

  if (skill.special === "calming-weather") {
    if (usedRound) return state;
    return log(markRound({ ...state, skillTerrainDiscount: 2 }), "平息风雨：本回合所有可通行地形费用 -2（最低 1）。 ");
  }

  if (skill.special === "source-opening") {
    if (usedRound || action.sourceDieIndex === undefined || !state.source[action.sourceDieIndex] || usedSourceIndices(state).has(action.sourceDieIndex)) return log(state, "请选择一颗尚未使用的源泉骰。 ");
    const colors: ManaColor[] = ["red", "blue", "green", "white", "gold", "black"];
    const die = state.source[action.sourceDieIndex];
    const rerolled = colors[(colors.indexOf(die.color) + 1 + state.turnsTaken) % colors.length];
    return log(markRound({ ...state, source: state.source.map((item, index) => index === action.sourceDieIndex ? { color: rerolled } : item), extraSourceUsesThisTurn: (state.extraSourceUsesThisTurn ?? 0) + 1, sourceOpeningReady: true }), `开启源泉：重掷源泉骰为${rerolled}色，本回合可额外使用 1 颗基础色骰。`);
  }

  if (skill.special === "howl-of-pack") {
    if (action.option === "combat") {
      if (!state.howlCombatReady || !state.combat || !action.enemyId) return log(state, "请选择本场战斗中的敌人。 ");
      const targets = [state.combat.enemy, ...(state.combat.queue ?? []).map((entry) => entry.enemy), ...(state.combat.rangedSurvivors ?? []).map((entry) => entry.enemy)];
      if (!targets.some((enemy) => enemy.id === action.enemyId)) return state;
      return log({ ...state, howlCombatReady: false, combat: { ...state.combat, armorReductionByEnemyId: { ...(state.combat.armorReductionByEnemyId ?? {}), [action.enemyId]: (state.combat.armorReductionByEnemyId?.[action.enemyId] ?? 0) + 1 }, attackReductionByEnemyId: { ...(state.combat.attackReductionByEnemyId ?? {}), [action.enemyId]: (state.combat.attackReductionByEnemyId?.[action.enemyId] ?? 0) + 1 } } }, "狼群长嚎：目标护甲与一次攻击各 -1。 ");
    }
    if (usedRound || state.interactionSite) return log(state, "狼群长嚎每轮一次，且不能在互动中启动。 ");
    return log(markRound({ ...state, howlPackReady: true, howlCombatReady: true }), "狼群长嚎：下一张横置牌提升为 4，并按空指挥位追加。 ");
  }

  if (skill.special === "mana-enhancement") {
    if (usedRound || !action.color || !isBasicManaColor(action.color)) return log(state, "魔力强化每轮一次，且需要选择本回合已支付的基础色。 ");
    const spentColor = allManaUses(state).some((use) => use.color === action.color || (use.type === "source" && use.index !== undefined && state.source[use.index]?.color === action.color));
    if (!spentColor) return log(state, "本回合尚未支付该颜色的魔力。 ");
    return log(markRound({ ...state, crystals: { ...state.crystals, [action.color]: Math.min(3, state.crystals[action.color] + 1) }, manaTokens: { ...state.manaTokens, [action.color]: state.manaTokens[action.color] + 1 } }), `魔力强化：获得 1 枚${action.color}色水晶，并取回 1 份同色临时魔力。`);
  }

  if (skill.special === "nature-vengeance-coop") {
    if (usedRound || !state.combat || !action.enemyId) return log(state, "自然回响每轮一次，须选择本场战斗中的敌人。 ");
    const targets = [state.combat.enemy, ...(state.combat.queue ?? []).map((entry) => entry.enemy), ...(state.combat.rangedSurvivors ?? []).map((entry) => entry.enemy)];
    if (!targets.some((enemy) => enemy.id === action.enemyId)) return state;
    return log(markRound({ ...state, combat: { ...state.combat, attackReductionByEnemyId: { ...(state.combat.attackReductionByEnemyId ?? {}), [action.enemyId]: (state.combat.attackReductionByEnemyId?.[action.enemyId] ?? 0) + 1 }, cumbersomeGrantedIds: [...new Set([...(state.combat.cumbersomeGrantedIds ?? []), action.enemyId])] } }), "自然回响：目标的一次攻击 -1，且本回合获得笨重。 ");
  }

  return state;
}

export function canActivateUnitAbility(state: GameState, unitId: string, abilityId: string, manaColors: TemporaryManaColor[] = [], enemyId?: string) {
  const unit = state.units.find((item) => item.id === unitId);
  const def = getUnit(unitId);
  const ability = def?.abilities?.find((item) => item.id === abilityId);
  if (!unit || !def || !ability || (unit.used && !def.multiAbility) || unit.usedAbilityIds?.includes(abilityId) || unit.wounded || unit.needsFamiliarCrystal || state.combat?.unitsForbidden || (state.combat?.allowedUnitIds && !state.combat.allowedUnitIds.includes(unitId)) || (state.phase !== "planning" && state.phase !== "combat")) return false;
  if (state.phase === "planning" && ability.effect && hasCombatPoints(ability.effect) && !hasNonCombatResource(ability.effect)) return false;
  if ((ability.cancelEnemyAttack || ability.armorReduction || ability.transformAttacks || ability.removeSwift) && !state.combat) return false;
  if (ability.delphanaEffect && !state.combat) return false;
  if (ability.unfortifiedOnly && state.combat?.enemy.fortified) return false;
  if (state.combat?.enemy.arcaneImmunity && (ability.cancelEnemyAttack || ability.armorReduction || ability.removeSwift)) return false;
  // Fire/Ice Resistance also ignores non-Attack effects from matching red/blue
  // unit abilities. Attack-producing abilities remain valid and are halved by
  // the normal attack-resistance calculation instead.
  if ((ability.cancelEnemyAttack || ability.armorReduction) && state.combat) {
    const mana = ability.manaCost ?? [];
    if (mana.includes("red") && state.combat.enemy.resistances?.includes("fire")) return false;
    if (mana.includes("blue") && state.combat.enemy.resistances?.includes("ice")) return false;
  }
  if (ability.readyUnitMaxLevel && !state.units.some((item) => item.id !== unitId && item.used && !item.wounded && (getUnit(item.id)?.level ?? 99) <= ability.readyUnitMaxLevel!)) return false;
  const chosenCosts: ManaColor[] = ability.manaChoiceCount ? manaColors : (ability.manaCost ?? []);
  if (ability.manaChoiceCount && (manaColors.length !== ability.manaChoiceCount || manaColors.some((color) => !ability.manaChoiceColors?.includes(color)))) return false;
  if (ability.gainManaChoiceCount && manaColors.length !== ability.gainManaChoiceCount) return false;
  if (ability.delphanaEffect && state.combat) {
    const targets = [state.combat.enemy, ...(state.combat.queue ?? []).map((entry) => entry.enemy), ...(state.combat.rangedSurvivors ?? []).map((entry) => entry.enemy)];
    const target = targets.find((enemy) => enemy.id === (enemyId ?? state.combat!.enemy.id));
    if (!target || target.arcaneImmunity) return false;
  }
  return Boolean(payManaCosts(state, chosenCosts));
}

function activateUnit(state: GameState, unitId: string, abilityId: string, manaColors: TemporaryManaColor[] = [], enemyId?: string): GameState {
  if (!canActivateUnitAbility(state, unitId, abilityId, manaColors, enemyId)) return log(state, "该盟军能力当前不可发动：请检查盟军状态、目标、选色与所需魔力。 ");
  const unit = state.units.find((item) => item.id === unitId)!;
  const def = getUnit(unitId)!;
  const ability = def.abilities!.find((item) => item.id === abilityId)!;
  const manaCosts = ability.manaChoiceCount ? manaColors : (ability.manaCost ?? []);
  let next = payManaCosts(state, manaCosts)!;
  let units = next.units.map((item) => item.id === unitId ? { ...item, used: true, selectedAbilityId: ability.id, usedAbilityIds: def.multiAbility ? [...(item.usedAbilityIds ?? []), ability.id] : item.usedAbilityIds, banner: item.banner?.command ? { ...item.banner, faceUp: false } : item.banner } : item);
  if (ability.readyUnitMaxLevel) {
    const target = units.find((item) => item.id !== unitId && item.used && !item.wounded && (getUnit(item.id)?.level ?? 99) <= ability.readyUnitMaxLevel!);
    if (target) units = units.map((item) => item.id === target.id ? { ...item, used: false, selectedAbilityId: undefined, banner: item.banner?.command ? { ...item.banner, faceUp: true } : item.banner } : item);
  }
  if (ability.woundSelf) units = units.map((item) => item.id === unitId ? { ...item, wounded: true, wounds: Math.max(1, item.wounds ?? 0) } : item);
  const crystals = { ...next.crystals };
  const manaTokens = { ...next.manaTokens };
  (ability.gainCrystal ?? []).forEach((color) => { crystals[color] = Math.min(3, crystals[color] + 1); });
  (ability.gainMana ?? []).forEach((color) => { manaTokens[color] += 1; });
  if (ability.gainManaChoiceCount) manaColors.forEach((color) => { manaTokens[color] += 1; });
  let combat = next.combat;
  if (combat) {
    const targetId = enemyId ?? combat.enemy.id;
    if (ability.removeSwift) combat = { ...combat, swiftIgnoredIds: [...new Set([...(combat.swiftIgnoredIds ?? []), targetId])] };
    if (ability.cancelEnemyAttack) combat = { ...combat, cancelledAttackIds: [...new Set([...(combat.cancelledAttackIds ?? []), targetId])] };
    if (ability.armorReduction) combat = { ...combat, armorReductionByEnemyId: { ...(combat.armorReductionByEnemyId ?? {}), [targetId]: Math.max(combat.armorReductionByEnemyId?.[targetId] ?? 0, ability.armorReduction) } };
    if (ability.transformAttacks) combat = { ...combat, attackTransform: ability.transformAttacks };
    if (ability.delphanaEffect === "cancel") combat = { ...combat, cancelledAttackIds: [...new Set([...(combat.cancelledAttackIds ?? []), targetId])] };
    if (ability.delphanaEffect === "destroy-if-blocked") combat = { ...combat, destroyIfBlockedIds: [...new Set([...(combat.destroyIfBlockedIds ?? []), targetId])] };
    if (ability.delphanaEffect === "armor-minus-five") combat = { ...combat, armorReductionByEnemyId: { ...(combat.armorReductionByEnemyId ?? {}), [targetId]: Math.max(combat.armorReductionByEnemyId?.[targetId] ?? 0, 5) } };
    if (ability.delphanaEffect === "strip-defense") combat = { ...combat, ignoredResistanceIds: [...new Set([...(combat.ignoredResistanceIds ?? []), targetId])], ignoredFortificationIds: [...new Set([...(combat.ignoredFortificationIds ?? []), targetId])] };
  }
  const combatAbilityUsed = Object.entries(ability.effect ?? {}).some(([key, value]) => Number(value) > 0 && (key.toLowerCase().includes("attack") || key.toLowerCase().includes("block")));
  const gloryFame = combatAbilityUsed && (unit.banner?.cardId === "bannerGlory" || next.allUnitsGloryThisTurn) ? 1 : 0;
  next = { ...next, units, crystals, manaTokens, combat, fame: next.fame + gloryFame, reputation: Math.max(-5, Math.min(5, next.reputation + (ability.reputationChange ?? 0))), allUnitResistances: next.allUnitResistances || ability.allUnitResistances, terrainDiscounts: [...new Set([...(next.terrainDiscounts ?? []), ...(ability.terrainDiscount ?? [])])] };
  return log(next, `「${def.name}」发动「${ability.label}」${ability.manaCost?.length ? `，支付 ${ability.manaCost.join(" + ")} 魔力` : ""}。`);
}

function activateBanner(state: GameState, unitId: string, enemyId?: string): GameState {
  const unit = state.units.find((item) => item.id === unitId);
  const banner = unit?.banner;
  if (!unit || !banner?.faceUp) return log(state, "这支盟军没有可发动的正面旗帜。 ");
  if (banner.cardId === "bannerCourage") {
    if (state.phase === "combat" || !unit.used) return log(state, "勇气旗帜只能在战斗外重整已横置的装备盟军。 ");
    return log({ ...state, units: state.units.map((item) => item.id === unitId ? { ...item, used: false, selectedAbilityId: undefined, banner: { ...banner, faceUp: false } } : item) }, `「${getUnit(unitId)?.name}」借助勇气旗帜重整；旗帜本轮翻至背面。`);
  }
  if (banner.cardId === "bannerFear") {
    if (state.phase !== "combat" || state.combat?.step !== "block" || unit.used) return log(state, "恐惧旗帜需要在格挡阶段横置一支尚未使用的装备盟军。 ");
    const targetId = enemyId ?? state.combat.enemy.id;
    if (targetId !== state.combat.enemy.id) return log(state, "当前只能取消正在结算的敌人攻击。 ");
    const count = state.combat.cancelledAttackCountsByEnemyId?.[targetId] ?? 0;
    return log({
      ...state,
      fame: state.fame + 1,
      units: state.units.map((item) => item.id === unitId ? { ...item, used: true, selectedAbilityId: "banner-fear" } : item),
      combat: { ...state.combat, cancelledAttackCountsByEnemyId: { ...(state.combat.cancelledAttackCountsByEnemyId ?? {}), [targetId]: count + 1 } },
    }, `「${getUnit(unitId)?.name}」挥动恐惧旗帜：取消「${state.combat.enemy.name}」的一次攻击，名望 +1。`);
  }
  return log(state, "这面旗帜的持续能力不需要单独发动。 ");
}

function spend(state: GameState, key: ResourceKey, amount: number): GameState | null {
  if (availableResources(state)[key] < amount) return null;
  return { ...state, spent: { ...state.spent, [key]: state.spent[key] + amount } };
}

export function isRampagingEnemyCell(cell: MapCell) {
  return (cell.site === "rampager" || cell.site === "dragon") && enemiesOnCell(cell).length > 0 && !cell.conquered;
}

export function isAdventureEnemyCell(cell: MapCell) {
  const regularAdventure = (["ruins", "monsterDen", "dungeon", "tomb", "spawningGrounds", "maze", "labyrinth"] as SiteType[]).includes(cell.site);
  const scenarioEncounter = (["graveyard", "necropolis"] as SiteType[]).includes(cell.site) && enemiesOnCell(cell).length > 0;
  return ((["dungeon", "tomb"] as SiteType[]).includes(cell.site) || !cell.conquered) && (regularAdventure || scenarioEncounter);
}

function drawSiteEnemies(state: GameState, cell: MapCell, colors: EnemyTokenColor[]) {
  const enemyDecks = Object.fromEntries(ENEMY_COLORS.map((color) => [color, [...state.enemyDecks[color]]])) as Record<EnemyTokenColor, string[]>;
  const enemyDiscards = Object.fromEntries(ENEMY_COLORS.map((color) => [color, [...state.enemyDiscards[color]]])) as Record<EnemyTokenColor, string[]>;
  const enemies = colors.flatMap((color) => {
    if (!enemyDecks[color].length && enemyDiscards[color].length) {
      enemyDecks[color] = shuffle(enemyDiscards[color]);
      enemyDiscards[color] = [];
    }
    const tokenId = enemyDecks[color].shift();
    const token = tokenId ? ALL_ENEMY_TOKEN_BY_ID[tokenId] : undefined;
    if (!token) return [];
    const siteFortification = (["keep", "mageTower", "city1", "city2"] as SiteType[]).includes(cell.site) ? 1 : 0;
    const fortificationLevel = siteFortification + (token.fortified ? 1 : 0);
    return [{ ...token, fortified: fortificationLevel > 0, fortificationLevel }];
  });
  return { enemyDecks, enemyDiscards, enemies };
}

function adventureEnemyColors(cell: MapCell): EnemyTokenColor[] {
  if (cell.site === "ruins") return cell.ruinTokenId ? (ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId]?.enemies ?? []) : [];
  if (cell.site === "monsterDen" || cell.site === "dungeon" || cell.site === "maze") return ["brown"];
  if (cell.site === "tomb" || cell.site === "labyrinth") return ["red"];
  if (cell.site === "spawningGrounds") return ["brown", "brown"];
  return [];
}

function adventureFailureRule(site: SiteType): CombatState["adventureFailure"] {
  if (site === "dungeon" || site === "tomb" || site === "maze" || site === "labyrinth") return "discard";
  if (site === "spawningGrounds") return "replenish";
  return "remain";
}

function enterAdventure(state: GameState, moveSpend?: 2 | 4 | 6, accompanyingUnitId?: string, rewardCrystalColors?: BasicManaColor[]): GameState {
  if (state.phase !== "planning" || state.actionTaken) return state;
  const cell = currentSite(state);
  const ruin = cell?.site === "ruins" && cell.ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId] : undefined;
  const altarColor = cell?.site === "ruins" ? (cell.ruinAltarColor ?? ruin?.altarColor) : undefined;
  if (cell?.site === "ruins" && altarColor && !cell.conquered) {
    const color = altarColor;
    const paid = payManaCosts(state, [color, color, color]);
    if (!paid) return log(state, `祭拜「${ruin?.name ?? "魔力祭坛"}」需要 3 份${color}色魔力；临时魔力、可用的源泉骰和水晶可以共同支付。`);
    const ruinDiscards = cell.ruinTokenId ? [...state.ruinDiscards, cell.ruinTokenId] : state.ruinDiscards;
    const next: GameState = {
      ...paid,
      fame: paid.fame + 7,
      actionTaken: true,
      conqueredSites: paid.conqueredSites + 1,
      ruinDiscards,
      map: paid.map.map((item) => item.id === cell.id ? { ...item, ruinAltarColor: color, ruinsReward: ruin?.reward ?? item.ruinsReward, conquered: true } : item),
    };
    const resolved: CombatState = { cellId: cell.id, enemy: { id: "ruin-altar", name: "魔力祭坛", armor: 0, attack: 0, fame: 0, description: "祭坛" }, originId: cell.id, step: "attack", blocked: true, chainStartFame: state.fame };
    return finishCombatProgress(next, resolved, `你向${color}色魔力祭坛献上 3 份魔力，获得 7 点名望。`);
  }
  if (!cell || !isAdventureEnemyCell(cell)) return state;
  let prepared = state;
  if (cell.site === "maze" || cell.site === "labyrinth") {
    if (!moveSpend || !([2, 4, 6] as const).includes(moveSpend)) return log(state, `进入${cell.site === "maze" ? "迷宫" : "大型迷宫"}前，必须选择花费 2、4 或 6 点移动。`);
    const availableMove = availableResources(state).move;
    const carryover = Math.min(state.mazeArrivalMoveCarryover ?? 0, availableMove);
    if (availableMove - carryover < moveSpend) return log(state, `进入该地点需要在到达后新产生 ${moveSpend} 点移动；到达前遗留的 ${carryover} 点不能支付。`);
    const paid = spend(state, "move", carryover + moveSpend);
    if (!paid) return log(state, `进入该地点并选择此层奖励需要 ${moveSpend} 点新产生的移动。`);
    if (accompanyingUnitId) {
      const unit = state.units.find((item) => item.id === accompanyingUnitId);
      if (!unit || unit.used || unit.wounded || unit.needsFamiliarCrystal) return log(state, "陪同迷宫探索的盟军必须处于未横置且未受伤状态。");
    }
    if (moveSpend === 2 && (rewardCrystalColors?.length !== 2 || rewardCrystalColors.some((color) => !BASIC_COLORS.includes(color)))) {
      return log(state, "选择 2 移动路径时，必须先选择将获得的两枚基础色水晶（可同色，每色库存上限仍为 3）。");
    }
    prepared = { ...paid, mazeArrivalMoveCarryover: undefined };
  }
  let encounterEnemies = enemiesOnCell(cell);
  if (!encounterEnemies.length) {
    const colors = adventureEnemyColors(cell);
    if (!colors.length) return log(state, "该地点当前没有可触发的敌人遭遇。");
    const drawn = drawSiteEnemies(prepared, cell, colors);
    if (drawn.enemies.length !== colors.length) return log(state, "对应颜色的敌人标记暂时不足，无法开始地点战斗。");
    encounterEnemies = drawn.enemies;
    prepared = { ...prepared, enemyDecks: drawn.enemyDecks, enemyDiscards: drawn.enemyDiscards };
  }
  const [first, ...rest] = encounterEnemies;
  if (!first) return state;
  const map = prepared.map.map((item) => item.id === cell.id ? { ...item, enemies: encounterEnemies, enemy: encounterEnemies[0], tokenRevealed: true } : item);
  const adventureName = cell.site === "ruins" ? "古代遗迹" : cell.site === "dungeon" ? "地下城" : cell.site === "tomb" ? "古墓" : cell.site === "spawningGrounds" ? "繁殖地" : cell.site === "maze" ? "迷宫" : cell.site === "labyrinth" ? "大迷宫" : SITE_LABELS[cell.site];
  const combatReady = lockEffectsAtCombatStart({ ...prepared, map });
  return log({
    ...combatReady,
    phase: "combat",
    actionTaken: true,
    combat: {
      cellId: cell.id,
      enemy: first,
      originId: cell.id,
      kind: "adventure",
      step: "ranged",
      blocked: false,
      queue: rest.map((enemy) => ({ cellId: cell.id, enemy })),
      chainStartFame: state.fame,
      adventureMoveSpend: moveSpend,
      adventureRewardCrystalColors: rewardCrystalColors,
      adventureFailure: adventureFailureRule(cell.site),
      adventureTargetCount: cell.site === "spawningGrounds" ? 2 : undefined,
      repeatAdventure: cell.conquered && (cell.site === "dungeon" || cell.site === "tomb"),
      unitsForbidden: cell.site === "dungeon" || cell.site === "tomb",
      allowedUnitIds: cell.site === "maze" || cell.site === "labyrinth" ? (accompanyingUnitId ? [accompanyingUnitId] : []) : undefined,
      nightRules: cell.site === "dungeon" || cell.site === "tomb" || cell.site === "graveyard" || cell.site === "necropolis",
    },
  }, `你宣布进入「${adventureName}」，迎战「${first.name}」${rest.length ? `；此处共有 ${rest.length + 1} 枚敌人标记` : ""}。`);
}

function burnMonastery(state: GameState): GameState {
  if (state.phase !== "planning" || state.actionTaken) return state;
  const cell = currentSite(state);
  if (!cell || cell.site !== "monastery" || cell.conquered) return state;
  const drawn = drawSiteEnemies(state, cell, ["violet"]);
  const [enemy] = drawn.enemies;
  if (!enemy) return log(state, "紫色敌人标记暂时不足，无法结算焚烧修道院。");
  const map = state.map.map((item) => item.id === cell.id ? { ...item, enemies: [enemy], enemy, tokenRevealed: true } : item);
  const combatReady = lockEffectsAtCombatStart({ ...state, map, enemyDecks: drawn.enemyDecks, enemyDiscards: drawn.enemyDiscards });
  return log({
    ...combatReady,
    reputation: Math.max(-5, combatReady.reputation - 3),
    phase: "combat",
    actionTaken: true,
    combat: {
      cellId: cell.id,
      enemy,
      originId: cell.id,
      kind: "monastery",
      step: "ranged",
      blocked: false,
      chainStartFame: state.fame,
      adventureFailure: "discard",
      unitsForbidden: true,
    },
  }, `你宣布焚烧修道院，声誉轨位 -3，并抽出紫色守卫「${enemy.name}」；本场战斗不能使用盟军。`);
}

function exploreTile(state: GameState, tq: number, tr: number): GameState {
  if (state.phase !== "planning" || state.actionTaken) return state;
  const target = availableTileExplorations(state).find((candidate) => candidate.tq === tq && candidate.tr === tr);
  const templateId = state.tileDeck[0];
  const template = templateId ? getMapTileTemplate(templateId) : undefined;
  if (!target || !template) return log(state, "当前位置不能按板块拼接规则探索该位置。");
  const paid = spend(state, "move", 2);
  if (!paid) return log(state, "探索新的地图板块需要 2 点移动。先打出移动牌。 ");
  const placement = makePlacement(template, tq, tr, paid.mapTiles.length);
  const existingCities = paid.map.filter((cell) => cell.site === "city1" || cell.site === "city2").length;
  const cityNumber = template.kind === "core-city" ? (existingCities === 0 ? 1 : 2) : 0;
  const tileRandom = rngFrom(paid.seed ^ ((placement.order + 1) * 0x9e3779b1));
  const emptyCells = instantiateTile(template, placement, paid.difficulty, cityNumber as 0 | 1 | 2, paid.time, tileRandom);
  const tokenSetup = populateEnemyTokens(emptyCells, paid.enemyDecks, paid.enemyDiscards, paid.ruinDeck, paid.ruinDiscards, paid.difficulty, tileRandom);
  const revealedCells = tokenSetup.map;
  const combinedMap = [...paid.map, ...revealedCells];
  const map = revealVisibleTokens(combinedMap, paid.position, paid.time);
  const monasteryCount = revealedCells.filter((cell) => cell.site === "monastery").length;
  const monasteryCards = paid.advancedDeck.slice(0, monasteryCount);
  const siteNames = [...new Set(revealedCells.filter((cell) => cell.site !== "none").map((cell) => SITE_LABELS[cell.site]))];
  const backLabel = template.kind === "countryside" ? "乡野" : template.kind === "core-city" ? "城市核心" : "非城市核心";
  return log({
    ...paid,
    mazeArrivalMoveCarryover: state.mazeArrivalMoveCarryover === undefined
      ? undefined
      : Math.max(0, state.mazeArrivalMoveCarryover - 2),
    map,
    enemyDecks: tokenSetup.enemyDecks,
    enemyDiscards: tokenSetup.enemyDiscards,
    ruinDeck: tokenSetup.ruinDeck,
    ruinDiscards: tokenSetup.ruinDiscards,
    mapTiles: [...paid.mapTiles, placement],
    tileDeck: paid.tileDeck.slice(1),
    advancedDeck: paid.advancedDeck.slice(monasteryCount),
    monasteryOffer: [...paid.monasteryOffer, ...monasteryCards],
  }, `你花费 2 点移动，翻开牌库顶的${backLabel}板块「${template.number}」并按固定方向拼接；板块内 7 格一并揭示${siteNames.length ? `，发现 ${siteNames.join("、")}` : ""}${monasteryCards.length ? "；修道院供应区新增进阶行动" : ""}。`);
}

export function terrainMoveCost(state: GameState, terrain: Terrain) {
  const printed = TERRAIN_COSTS[terrain][state.time];
  let cost = Number.isFinite(printed) && state.terrainDiscounts?.includes(terrain) ? Math.max(1, printed - 1) : printed;
  if (Number.isFinite(cost) && (state.skillTerrainDiscount ?? 0) > 0) cost = Math.max(1, cost - (state.skillTerrainDiscount ?? 0));
  if (terrain === "forest" && state.time === "night" && state.played.some((play) => play.mode !== "sideways" && getCard(play.instanceId)?.id === "amuletSun")) cost = 3;
  if (terrain === "desert" && state.time === "day" && state.played.some((play) => play.mode !== "sideways" && getCard(play.instanceId)?.id === "amuletDarkness")) cost = 3;
  for (const play of state.played) {
    if (play.mode === "sideways") continue;
    const special = getCard(play.instanceId)?.[play.mode].special;
    if (special === "frost-bridge") {
      if (terrain === "swamp") cost = 1;
      if (play.mode === "powered" && terrain === "lake") cost = 1;
    }
    if (special === "song-of-wind" && (terrain === "plains" || terrain === "desert" || terrain === "wasteland")) {
      cost = Math.max(0, cost - (play.mode === "powered" ? 2 : 1));
    }
    if (special === "song-of-wind" && play.mode === "powered" && play.selection?.option === "lake" && terrain === "lake") cost = 0;
    if (special === "path-finding" && Number.isFinite(cost)) {
      cost = play.mode === "powered" ? 2 : Math.max(2, cost - 1);
    }
    if (special === "mountain-lore" && play.mode === "powered" && terrain === "mountain") cost = 5;
  }
  return cost;
}

function revealOrMove(state: GameState, cellId: string): GameState {
  if (state.phase !== "planning" || state.actionTaken) return state;
  const current = state.map.find((cell) => cell.id === state.position);
  const target = state.map.find((cell) => cell.id === cellId);
  const spaceBending = state.played.some((play) => play.mode === "basic" && getCard(play.instanceId)?.basic.special === "space-bending");
  if (!current || !target || !(isAdjacent(current, target) || (spaceBending && hexDistance(current, target) === 2))) return state;
  if (isRampagingEnemyCell(target)) {
    const [first, ...rest] = enemiesOnCell(target);
    if (!first) return state;
    const combatReady = lockEffectsAtCombatStart(state);
    return log({
      ...combatReady,
      phase: "combat",
      actionTaken: true,
      combat: { cellId: target.id, enemy: first, originId: current.id, kind: "rampager", step: "ranged", blocked: false, queue: rest.map((enemy) => ({ cellId: target.id, enemy })), chainStartFame: state.fame },
    }, `你从相邻区域主动挑战「${first.name}」。英雄留在原地，直接进入战斗。`);
  }
  const cost = target.site === "hiddenValley" || target.site === "necropolis" || target.site === "volkareCamp"
    ? 2
    : terrainMoveCost(state, target.terrain);
  if (!Number.isFinite(cost)) return log(state, `${target.terrain === "lake" ? "湖泊" : "山脉"}在通常移动规则下不可进入。`);
  const paid = spend(state, "move", cost);
  if (!paid) return log(state, `进入这片地形需要 ${cost} 点移动。`);
  const map = revealVisibleTokens(paid.map, target.id, paid.time);
  const movedTarget = map.find((cell) => cell.id === target.id)!;
  const targetEnemies = enemiesOnCell(movedTarget);
  const assault = targetEnemies.length > 0 && !movedTarget.conquered && ["keep", "mageTower", "city1", "city2", "volkareCamp"].includes(movedTarget.site);
  const provoked = spaceBending ? [] : map.filter((cell) => isRampagingEnemyCell(cell) && isAdjacent(current, cell) && isAdjacent(movedTarget, cell));
  let next: GameState = {
    ...paid,
    position: target.id,
    map,
    mazeArrivalMoveCarryover: target.site === "maze" || target.site === "labyrinth"
      ? availableResources(paid).move
      : undefined,
    reputation: assault && movedTarget.site !== "volkareCamp" ? Math.max(-5, paid.reputation - 1) : paid.reputation,
  };
  if (provoked.length) {
    const [first, ...rest] = provoked;
    const queued = [
      ...rest.flatMap((cell) => enemiesOnCell(cell).map((enemy) => ({ cellId: cell.id, enemy }))),
      // Entering an adventure site is a separate voluntary action. Its
      // defenders never join a rampager combat merely because the hero's
      // provoking move ended on that site. Fortified-site defenders do join,
      // because the same move is already an assault.
      ...(assault ? targetEnemies.map((enemy) => ({ cellId: movedTarget.id, enemy })) : []),
    ];
    const firstEnemy = enemiesOnCell(first)[0];
    if (!firstEnemy) return next;
    const combatReady = lockEffectsAtCombatStart(next);
    next = {
      ...combatReady,
      phase: "combat",
      actionTaken: true,
      combat: {
        cellId: first.id,
        enemy: firstEnemy,
        originId: assault ? current.id : movedTarget.id,
        kind: "provoked",
        step: "ranged",
        blocked: false,
        queue: queued,
        mustWithdraw: Boolean(assault),
        chainStartFame: state.fame,
        ...(assault ? volkareCombatFields(state, movedTarget) : {}),
      },
    };
    const queuedNote = queued.length ? `；之后还必须迎战${queued.map((encounter) => `「${encounter.enemy.name}」`).join("、")}` : "";
    const fromLabel = current.site === "none" ? current.terrain : current.site;
    const toLabel = movedTarget.site === "none" ? movedTarget.terrain : movedTarget.site;
    return log(next, `${assault ? movedTarget.site === "volkareCamp" ? "你强攻沃尔卡雷营地（该变体不降低声誉）；" : "你发动强攻，声誉轨位 -1；" : ""}你从「${fromLabel}」移动到「${toLabel}」时进入了游荡敌人的警戒范围，「${firstEnemy.name}」被激怒并强制开战${queuedNote}。`);
  }
  if (targetEnemies.length && !movedTarget.conquered && assault) {
    const [first, ...rest] = targetEnemies;
    const combatReady = lockEffectsAtCombatStart(next);
    next = {
      ...combatReady,
      phase: "combat",
      actionTaken: true,
      combat: { cellId: target.id, enemy: first, originId: current.id, kind: "assault", step: "ranged", blocked: false, queue: rest.map((enemy) => ({ cellId: target.id, enemy })), mustWithdraw: true, chainStartFame: state.fame, ...volkareCombatFields(state, movedTarget) },
    };
    return log(next, `${movedTarget.site === "volkareCamp" ? "你强攻沃尔卡雷营地；按变体规则不降低声誉" : "你发动强攻，声誉轨位 -1"}。遭遇「${first.name}」${rest.length ? `与另外 ${rest.length} 支守军` : ""}：先决定是否发动远程或攻城攻击。`);
  }
  const adventureNote = isAdventureEnemyCell(movedTarget) ? " 此处是冒险地点；你可以继续移动，或把进入地点作为本回合行动。" : "";
  return log(next, `移动至${target.site === "none" ? target.terrain : target.site}。${adventureNote}`);
}

const ASSAULT_SITE_TYPES: SiteType[] = ["keep", "mageTower", "city1", "city2", "volkareCamp"];

function volkareAttackFor(state: GameState): Enemy {
  const attacks: Array<Pick<Enemy, "attack" | "attackElement" | "poison" | "paralyze" | "swift">> = [
    { attack: 3, attackElement: "fire", poison: true },
    { attack: 3, attackElement: "ice", paralyze: true },
    { attack: 2, attackElement: "physical", swift: true },
    { attack: 3, attackElement: "physical" },
    { attack: 3, attackElement: "coldfire" },
    { attack: 3, attackElement: "fire" },
  ];
  const rolled = (state.seed + state.turnsTaken) % attacks.length;
  return {
    id: `volkare-general-${rolled}`,
    name: "沃尔卡雷将军",
    armor: 99,
    attack: attacks[rolled].attack,
    attackElement: attacks[rolled].attackElement,
    fame: 0,
    description: "与幸存军团一同攻击；不能被任何攻击选为目标。",
    brutal: true,
    assassination: true,
    arcaneImmunity: true,
    poison: attacks[rolled].poison,
    paralyze: attacks[rolled].paralyze,
    swift: attacks[rolled].swift,
  };
}

function volkareCombatFields(state: GameState, target: MapCell) {
  if (target.site !== "volkareCamp") return {};
  return { volkareAttack: volkareAttackFor(state), volkareAttackPending: true };
}

/** Starts one voluntary combat containing every explicitly selected public rampager. */
function startMultiCombat(state: GameState, rampagerCellIds: string[], assaultCellId?: string): GameState {
  if (state.phase !== "planning" || state.actionTaken) return state;
  const origin = currentSite(state);
  if (!origin) return state;
  const selectedIds = [...new Set(rampagerCellIds)];
  const selectedCells = selectedIds.map((id) => state.map.find((cell) => cell.id === id));
  if (selectedCells.some((cell) => !cell || !isRampagingEnemyCell(cell))) return log(state, "多敌人挑战中包含了无效或已被击败的游荡敌人。");

  if (!assaultCellId) {
    if (!selectedCells.length || selectedCells.some((cell) => !isAdjacent(origin, cell!))) return log(state, "主动挑战只能选择英雄当前位置相邻的公开游荡敌人。");
    const encounters = selectedCells.flatMap((cell) => enemiesOnCell(cell!).map((enemy) => ({ cellId: cell!.id, enemy })));
    const [first, ...queue] = encounters;
    if (!first) return state;
    const combatReady = lockEffectsAtCombatStart(state);
    return log({
      ...combatReady,
      phase: "combat",
      actionTaken: true,
      combat: { ...first, originId: origin.id, kind: "rampager", step: "ranged", blocked: false, queue, chainStartFame: state.fame },
    }, `你主动挑战 ${encounters.length} 支相邻游荡敌人：${encounters.map((entry) => `「${entry.enemy.name}」`).join("、")}。英雄留在原地。`);
  }

  const target = state.map.find((cell) => cell.id === assaultCellId);
  if (!target || !isAdjacent(origin, target) || !ASSAULT_SITE_TYPES.includes(target.site) || target.conquered || !enemiesOnCell(target).length) {
    return log(state, "只能对相邻、尚未征服且有守军的防御地点规划多敌人强攻。");
  }
  if (selectedCells.some((cell) => !isAdjacent(target, cell!))) return log(state, "追加到强攻的游荡敌人必须与被强攻地点相邻。");
  const cost = target.site === "volkareCamp" ? 2 : terrainMoveCost(state, target.terrain);
  const paid = spend(state, "move", cost);
  if (!paid) return log(state, `进入强攻地点需要 ${cost} 点移动。`);
  const map = revealVisibleTokens(paid.map, target.id, paid.time);
  const movedTarget = map.find((cell) => cell.id === target.id)!;
  // Any rampager whose warning area is crossed is mandatory, even if it was
  // not explicitly selected in the pre-assault planner.
  const provoked = map.filter((cell) => isRampagingEnemyCell(cell) && isAdjacent(origin, cell) && isAdjacent(movedTarget, cell));
  const rampagerCells = [...new Map([...selectedCells, ...provoked].filter(Boolean).map((cell) => [cell!.id, cell!] as const)).values()];
  const encounters = [
    ...rampagerCells.flatMap((cell) => enemiesOnCell(cell).map((enemy) => ({ cellId: cell.id, enemy }))),
    ...enemiesOnCell(movedTarget).map((enemy) => ({ cellId: movedTarget.id, enemy })),
  ];
  const [first, ...queue] = encounters;
  if (!first) return state;
  const moved: GameState = {
    ...paid,
    map,
    position: target.id,
    reputation: target.site === "volkareCamp" ? paid.reputation : Math.max(-5, paid.reputation - 1),
  };
  const combatReady = lockEffectsAtCombatStart(moved);
  return log({
    ...combatReady,
    phase: "combat",
    actionTaken: true,
    combat: { ...first, originId: origin.id, kind: rampagerCells.length ? "provoked" : "assault", step: "ranged", blocked: false, queue, mustWithdraw: true, chainStartFame: state.fame, ...volkareCombatFields(state, movedTarget) },
  }, `你强攻「${SITE_LABELS[target.site]}」${target.site === "volkareCamp" ? "（不降低声誉）" : "，声誉轨位 -1"}；${rampagerCells.length ? `另有 ${rampagerCells.length} 处游荡敌人加入战斗，` : ""}共迎战 ${encounters.length} 支敌军。`);
}

type CombatStage = "ranged" | "attack";
type WeightedResource = { key: ResourceKey; element: CombatElement; value: number; weight: 1 | 0.5; multiplier?: number };

const ATTACK_KEYS: Record<CombatElement, { attack: ResourceKey; range: ResourceKey; siege: ResourceKey }> = {
  physical: { attack: "attack", range: "range", siege: "siege" },
  fire: { attack: "fireAttack", range: "fireRange", siege: "fireSiege" },
  ice: { attack: "iceAttack", range: "iceRange", siege: "iceSiege" },
  coldfire: { attack: "coldfireAttack", range: "coldfireRange", siege: "coldfireSiege" },
};

const BLOCK_KEYS: Record<CombatElement, ResourceKey> = {
  physical: "block",
  fire: "fireBlock",
  ice: "iceBlock",
  coldfire: "coldfireBlock",
};

function enemyResists(enemy: Enemy, element: CombatElement) {
  if (element === "coldfire") return Boolean(enemy.resistances?.includes("fire") && enemy.resistances?.includes("ice"));
  return Boolean(enemy.resistances?.includes(element));
}

function combatEnemyResists(state: GameState, enemy: Enemy, element: CombatElement) {
  return !state.combat?.ignoredResistanceIds?.includes(enemy.id) && enemyResists(enemy, element);
}

function enemyFortificationLevel(enemy: Enemy) {
  return enemy.fortificationLevel ?? (enemy.fortified ? 1 : 0);
}

function combatFortificationLevel(state: GameState, enemy: Enemy) {
  if (state.combat?.ignoredFortificationIds?.includes(enemy.id)) return 0;
  if (!state.combat?.ignoreSiteFortification) return enemyFortificationLevel(enemy);
  const intrinsic = enemy.fortificationLevel ?? (enemy.fortified ? 1 : 0);
  return Math.max(0, intrinsic - 1);
}

type CityColor = "green" | "blue" | "white" | "red";

export function cityColorForCell(cell?: MapCell): CityColor | undefined {
  const number = cell?.tileId?.match(/core-(\d+)/)?.[1];
  return number === "5" ? "green" : number === "6" ? "blue" : number === "7" ? "white" : number === "8" ? "red" : undefined;
}

function activeCombatCell(state: GameState) {
  return state.combat ? state.map.find((cell) => cell.id === state.combat?.cellId) : undefined;
}

function hasPhysicalAttack(enemy: Enemy) {
  return (enemy.attackElement ?? "physical") === "physical";
}

function cityAttackBonus(state: GameState, enemy: Enemy) {
  if (cityColorForCell(activeCombatCell(state)) !== "blue") return 0;
  if (enemy.attackElement === "fire" || enemy.attackElement === "ice") return 2;
  if (enemy.attackElement === "coldfire") return 1;
  return 0;
}

function enemyIsBrutal(state: GameState, enemy: Enemy) {
  return Boolean(enemy.brutal || (cityColorForCell(activeCombatCell(state)) === "red" && hasPhysicalAttack(enemy)));
}

function enemyIsPoisonous(state: GameState, enemy: Enemy) {
  return Boolean(enemy.poison || (cityColorForCell(activeCombatCell(state)) === "green" && hasPhysicalAttack(enemy)));
}

export function combatEnemyArmor(state: GameState, enemy: Enemy = state.combat?.enemy as Enemy) {
  if (!enemy) return 0;
  const reduction = state.combat?.armorReductionByEnemyId?.[enemy.id] ?? 0;
  const combatCell = state.combat ? state.map.find((cell) => cell.id === state.combat?.cellId) : undefined;
  const defenders = defendBonusFor(state, enemy.id);
  const successfullyBlocked = state.combat?.successfullyBlockedEnemyIds?.includes(enemy.id);
  const baseArmor = enemy.elusiveArmor && (state.combat?.step === "ranged" || !successfullyBlocked) ? enemy.elusiveArmor : enemy.armor;
  const cityArmor = cityColorForCell(combatCell) === "white" ? 1 : 0;
  return Math.max(1, baseArmor + defenders + cityArmor - reduction);
}

function attackResources(state: GameState, enemy: Enemy, stage: CombatStage): WeightedResource[] {
  const resources = availableResources(state);
  const transform = state.combat?.attackTransform;
  const swordJustice = stage === "attack" && state.played.some((play) => play.mode === "powered" && getCard(play.instanceId)?.id === "swordJustice");
  const fortification = combatFortificationLevel(state, enemy);
  if (stage === "ranged" && fortification >= 2) return [];
  return (Object.keys(ATTACK_KEYS) as CombatElement[]).flatMap((printedElement) => {
    const element = transform === "coldfire" ? "coldfire" : printedElement;
    const keys = ATTACK_KEYS[printedElement];
    const allowed: ResourceKey[] = stage === "attack"
      ? [keys.attack, keys.range, keys.siege]
      : transform === "siege"
        ? [keys.attack, keys.range, keys.siege]
        : fortification > 0 ? [keys.siege] : [keys.range, keys.siege];
    return allowed.map((key) => ({
      key,
      element,
      value: resources[key] * (swordJustice && element === "physical" ? 2 : 1),
      weight: (combatEnemyResists(state, enemy, element) && !(swordJustice && element === "physical") ? 0.5 : 1) as 1 | 0.5,
      multiplier: swordJustice && element === "physical" ? 2 : 1,
    })).filter((entry) => entry.value > 0);
  });
}

function groupAttackResources(state: GameState, enemies: Enemy[], stage: CombatStage): WeightedResource[] {
  const resources = availableResources(state);
  const transform = state.combat?.attackTransform;
  const swordJustice = stage === "attack" && state.played.some((play) => play.mode === "powered" && getCard(play.instanceId)?.id === "swordJustice");
  const fortifications = enemies.map((enemy) => combatFortificationLevel(state, enemy));
  if (stage === "ranged" && fortifications.some((level) => level >= 2)) return [];
  const anyFortified = fortifications.some((level) => level > 0);
  return (Object.keys(ATTACK_KEYS) as CombatElement[]).flatMap((printedElement) => {
    const element = transform === "coldfire" ? "coldfire" : printedElement;
    const keys = ATTACK_KEYS[printedElement];
    const allowed: ResourceKey[] = stage === "attack"
      ? [keys.attack, keys.range, keys.siege]
      : transform === "siege" ? [keys.attack, keys.range, keys.siege]
        : anyFortified ? [keys.siege] : [keys.range, keys.siege];
    const resisted = enemies.some((enemy) => combatEnemyResists(state, enemy, element));
    return allowed.map((key) => ({
      key,
      element,
      value: resources[key] * (swordJustice && element === "physical" ? 2 : 1),
      weight: (resisted && !(swordJustice && element === "physical") ? 0.5 : 1) as 1 | 0.5,
      multiplier: swordJustice && element === "physical" ? 2 : 1,
    })).filter((entry) => entry.value > 0);
  });
}

function combatBaseArmor(state: GameState, encounter: CombatEncounter) {
  const enemy = encounter.enemy;
  const reduction = state.combat?.armorReductionByEnemyId?.[enemy.id] ?? 0;
  const successfullyBlocked = state.combat?.successfullyBlockedEnemyIds?.includes(enemy.id);
  const baseArmor = enemy.elusiveArmor && (state.combat?.step === "ranged" || !successfullyBlocked) ? enemy.elusiveArmor : enemy.armor;
  const cell = state.map.find((item) => item.id === encounter.cellId);
  const cityArmor = cityColorForCell(cell) === "white" ? 1 : 0;
  return Math.max(1, baseArmor + cityArmor - reduction);
}

function groupedArmor(state: GameState, encounters: CombatEncounter[]) {
  return encounters.reduce((sum, entry) => sum + combatBaseArmor(state, entry) + defendBonusFor(state, entry.enemy.id), 0);
}

function blockResources(state: GameState, enemy: Enemy): WeightedResource[] {
  const resources = availableResources(state);
  const attackElement = enemy.attackElement ?? "physical";
  const blocks = (Object.keys(BLOCK_KEYS) as CombatElement[]).map((element) => {
    const efficient = attackElement === "physical"
      || (attackElement === "fire" && element === "ice")
      || (attackElement === "ice" && element === "fire");
    const key = BLOCK_KEYS[element];
    return { key, element, value: resources[key], weight: (efficient ? 1 : 0.5) as 1 | 0.5 };
  }).filter((entry) => entry.value > 0);
  const diplomacy = state.played.find((play) => getCard(play.instanceId)?.id === "diplomacy" && play.mode !== "sideways");
  if (diplomacy && resources.influence > 0) {
    const element: CombatElement = diplomacy.mode === "powered" && diplomacy.selection?.option === "fire"
      ? "fire"
      : diplomacy.mode === "powered" && diplomacy.selection?.option === "ice" ? "ice" : "physical";
    const efficient = attackElement === "physical"
      || (attackElement === "fire" && element === "ice")
      || (attackElement === "ice" && element === "fire");
    blocks.push({ key: "influence", element, value: resources.influence, weight: efficient ? 1 : 0.5 });
  }
  return blocks;
}

function effectiveWeightedValue(entries: WeightedResource[]) {
  const efficient = entries.filter((entry) => entry.weight === 1).reduce((sum, entry) => sum + entry.value, 0);
  const inefficient = entries.filter((entry) => entry.weight === 0.5).reduce((sum, entry) => sum + entry.value, 0);
  // The rulebook pools every inefficient contribution before halving once.
  return efficient + Math.floor(inefficient / 2);
}

function spendWeighted(state: GameState, entries: WeightedResource[], amount: number): GameState | null {
  if (effectiveWeightedValue(entries) < amount) return null;
  let left = amount;
  const spent = { ...state.spent };
  const groups = ([1, 0.5] as const).map((weight) => {
    const matching = entries.filter((entry) => entry.weight === weight);
    return { matching, weight, raw: matching.reduce((sum, entry) => sum + entry.value, 0) };
  }).filter((group) => group.raw > 0);
  groups.forEach((group) => {
    if (left <= 0) return;
    const effectiveAvailable = group.weight === 1 ? group.raw : Math.floor(group.raw / 2);
    const effectiveUse = Math.min(left, effectiveAvailable);
    let rawUse = group.weight === 1 ? effectiveUse : effectiveUse * 2;
    group.matching.forEach((entry) => {
      const use = Math.min(rawUse, entry.value);
      const multiplier = entry.multiplier ?? 1;
      const printedSpend = Math.ceil(use / multiplier);
      spent[entry.key] = (spent[entry.key] ?? 0) + printedSpend;
      rawUse -= printedSpend * multiplier;
    });
    left -= effectiveUse;
  });
  return left <= 0 ? { ...state, spent } : null;
}

export function effectiveAttackValue(state: GameState, enemy: Enemy = state.combat?.enemy as Enemy, stage: CombatStage = "attack") {
  return enemy ? effectiveWeightedValue(attackResources(state, enemy, stage)) : 0;
}

export function combatAttackTargets(state: GameState) {
  if (!state.combat || (state.combat.step !== "ranged" && state.combat.step !== "attack")) return [];
  return [activeEncounter(state.combat), ...(state.combat.queue ?? [])];
}

function livingCombatEncounters(state: GameState): CombatEncounter[] {
  if (!state.combat) return [];
  const encounters = [
    activeEncounter(state.combat),
    ...(state.combat.queue ?? []),
    ...(state.combat.step === "ranged" ? (state.combat.rangedSurvivors ?? []) : []),
  ];
  return [...new Map(encounters.map((entry) => [entry.enemy.id, entry] as const)).values()];
}

export function combatDefendAssignments(state: GameState) {
  if (!state.combat) return [];
  const living = livingCombatEncounters(state);
  const livingIds = new Set(living.map((entry) => entry.enemy.id));
  return living
    .filter((entry) => (entry.enemy.defend ?? 0) > 0)
    .map((entry) => ({
      defender: entry.enemy,
      targetId: livingIds.has(state.combat?.defendAssignments?.[entry.enemy.id] ?? "")
        ? state.combat?.defendAssignments?.[entry.enemy.id]
        : undefined,
      targets: living.map((target) => target.enemy),
    }));
}

export function combatDefendAssignmentsComplete(state: GameState) {
  const assignments = combatDefendAssignments(state);
  const targets = assignments.map((entry) => entry.targetId).filter(Boolean);
  return assignments.every((entry) => Boolean(entry.targetId)) && new Set(targets).size === targets.length;
}

function assignDefend(state: GameState, defenderId: string, targetId: string): GameState {
  if (!state.combat || (state.combat.step !== "ranged" && state.combat.step !== "attack") || state.combat.defendAssignmentsLocked) return state;
  const living = livingCombatEncounters(state);
  const defender = living.find((entry) => entry.enemy.id === defenderId)?.enemy;
  if (!defender?.defend || !living.some((entry) => entry.enemy.id === targetId)) return state;
  const assignments = { ...(state.combat.defendAssignments ?? {}) };
  for (const [source, target] of Object.entries(assignments)) {
    if (source !== defenderId && target === targetId) return log(state, "每一项防卫能力必须分配给不同的敌人。 ");
  }
  assignments[defenderId] = targetId;
  const target = living.find((entry) => entry.enemy.id === targetId)!.enemy;
  return log({ ...state, combat: { ...state.combat, defendAssignments: assignments } }, `将「${defender.name}」的防卫 ${defender.defend} 分配给「${target.name}」。`);
}

function defendBonusFor(state: GameState, enemyId: string) {
  if (!state.combat) return 0;
  const living = livingCombatEncounters(state);
  const livingIds = new Set(living.map((entry) => entry.enemy.id));
  return living.reduce((sum, entry) => {
    const assigned = state.combat?.defendAssignments?.[entry.enemy.id];
    return sum + (livingIds.has(entry.enemy.id) && assigned === enemyId ? (entry.enemy.defend ?? 0) : 0);
  }, 0);
}

export function groupedAttackRequirement(state: GameState, enemyIds: string[]) {
  const wanted = new Set(enemyIds);
  const encounters = combatAttackTargets(state).filter((entry) => wanted.has(entry.enemy.id));
  return encounters.length >= 2 ? groupedArmor(state, encounters) : 0;
}

export function effectiveGroupAttackValue(state: GameState, enemyIds: string[]) {
  const wanted = new Set(enemyIds);
  const encounters = combatAttackTargets(state).filter((entry) => wanted.has(entry.enemy.id));
  if (!state.combat || encounters.length < 2) return 0;
  return effectiveWeightedValue(groupAttackResources(state, encounters.map((entry) => entry.enemy), state.combat.step as CombatStage));
}

export function effectiveBlockValue(state: GameState, enemy: Enemy = state.combat?.enemy as Enemy) {
  return enemy ? effectiveWeightedValue(blockResources(state, enemy)) : 0;
}

export function combatBlockRequirement(state: GameState, enemy: Enemy = state.combat?.enemy as Enemy) {
  if (!enemy) return 0;
  if (state.combat?.cancelledAttackIds?.includes(enemy.id)) return 0;
  const swiftIgnored = state.combat?.swiftIgnoredIds?.includes(enemy.id);
  const reduction = state.combat?.cumbersomeReductionByEnemyId?.[enemy.id] ?? 0;
  const skillReduction = state.combat?.attackReductionByEnemyId?.[enemy.id] ?? 0;
  const cancelled = Math.min(enemy.attackCount ?? 1, state.combat?.cancelledAttackCountsByEnemyId?.[enemy.id] ?? 0);
  if ((state.combat?.attackIndex ?? 0) >= Math.max(0, (enemy.attackCount ?? 1) - cancelled)) return 0;
  const printedTotal = Math.max(0, enemy.attack + cityAttackBonus(state, enemy) - reduction - skillReduction);
  return printedTotal * (enemy.swift && !swiftIgnored ? 2 : 1);
}

export function combatDamageTotal(state: GameState, enemy: Enemy = state.combat?.enemy as Enemy) {
  if (!enemy) return 0;
  if (state.combat?.cancelledAttackIds?.includes(enemy.id)) return 0;
  const cumbersomeReduction = state.combat?.cumbersomeReductionByEnemyId?.[enemy.id] ?? 0;
  const skillReduction = state.combat?.attackReductionByEnemyId?.[enemy.id] ?? 0;
  const cancelled = Math.min(enemy.attackCount ?? 1, state.combat?.cancelledAttackCountsByEnemyId?.[enemy.id] ?? 0);
  if ((state.combat?.attackIndex ?? 0) >= Math.max(0, (enemy.attackCount ?? 1) - cancelled)) return 0;
  return Math.max(0, enemy.attack + cityAttackBonus(state, enemy) - cumbersomeReduction - skillReduction) * (enemyIsBrutal(state, enemy) ? 2 : 1);
}

function reduceCumbersomeAttack(state: GameState): GameState {
  if (!state.combat || state.combat.step !== "block" || (!state.combat.enemy.cumbersome && !state.combat.cumbersomeGrantedIds?.includes(state.combat.enemy.id))) return state;
  const paid = spend(state, "move", 1);
  if (!paid) return log(state, "降低笨重攻击需要 1 点移动。 ");
  const enemy = paid.combat!.enemy;
  const current = paid.combat!.cumbersomeReductionByEnemyId?.[enemy.id] ?? 0;
  const maxReduction = enemy.attack + cityAttackBonus(state, enemy);
  if (current >= maxReduction) return state;
  return log({
    ...paid,
    combat: {
      ...paid.combat!,
      cumbersomeReductionByEnemyId: { ...(paid.combat!.cumbersomeReductionByEnemyId ?? {}), [enemy.id]: current + 1 },
    },
  }, `花费 1 点移动，使「${enemy.name}」的一次笨重攻击降低 1；此降低同时适用于格挡需求和未格挡伤害。`);
}

function activeEncounter(combat: CombatState): CombatEncounter {
  return { cellId: combat.cellId, enemy: combat.enemy };
}

function withEncounter(combat: CombatState, encounter: CombatEncounter, queue: CombatEncounter[], step: CombatState["step"]): CombatState {
  return {
    ...combat,
    cellId: encounter.cellId,
    enemy: encounter.enemy,
    queue,
    step,
    blocked: false,
    damageRemaining: undefined,
    summoner: undefined,
    summonedTokenId: undefined,
    attackIndex: 0,
    allAttacksBlocked: true,
  };
}

function withoutEnemyRecordValue(record: Record<string, number> | undefined, enemyId: string) {
  if (!record || !(enemyId in record)) return record;
  const copy = { ...record };
  delete copy[enemyId];
  return copy;
}

function prepareSummonedAttack(state: GameState, combat: CombatState, message: string): GameState {
  if (combat.cancelledAttackIds?.includes(combat.enemy.id)) return log({ ...state, combat }, `${message} 「${combat.enemy.name}」的攻击已被取消，因此不会发动召唤。`);
  if (!combat.enemy.summon) return log({ ...state, combat }, message);
  let deck = [...state.enemyDecks.brown];
  let discard = [...state.enemyDiscards.brown];
  if (!deck.length && discard.length) {
    deck = shuffle(discard);
    discard = [];
  }
  const tokenId = deck.shift();
  const summoned = tokenId ? ALL_ENEMY_TOKEN_BY_ID[tokenId] : undefined;
  if (!summoned) return log({ ...state, combat }, `${message} 召唤标记牌堆已空，召唤未产生攻击者。`);
  const summonedEnemy = { ...summoned, fortified: summoned.fortified ?? false, fortificationLevel: summoned.fortified ? 1 : 0 };
  return log({
    ...state,
    enemyDecks: { ...state.enemyDecks, brown: deck },
    enemyDiscards: { ...state.enemyDiscards, brown: discard },
    combat: {
      ...combat,
      enemy: summonedEnemy,
      summoner: { cellId: combat.cellId, enemy: combat.enemy },
      summonedTokenId: tokenId,
    },
  }, `${message} 「${combat.enemy.name}」发动召唤：临时抽出棕色敌人「${summonedEnemy.name}」，它替代召唤者处理格挡与承伤阶段。`);
}

function beginBlockPhase(state: GameState, encounters: CombatEncounter[], message: string): GameState {
  if (!state.combat) return state;
  const combat = state.combat;
  const withVolkare = combat.volkareAttackPending && combat.volkareAttack
    ? [...encounters, { cellId: combat.cellId, enemy: combat.volkareAttack }]
    : encounters;
  const [first, ...queue] = withVolkare;
  if (!first) return state;
  return prepareSummonedAttack(state, {
      ...withEncounter(combat, first, queue, "block"),
      rangedSurvivors: undefined,
      attackedEnemies: [],
      volkareAttackPending: false,
    }, message);
}

function advanceRangedPhase(state: GameState): GameState {
  if (!state.combat || state.combat.step !== "ranged") return state;
  const survivors = [...(state.combat.rangedSurvivors ?? []), activeEncounter(state.combat)];
  const [next, ...queue] = state.combat.queue ?? [];
  if (next) {
    return log({
      ...state,
      combat: {
        ...withEncounter(state.combat, next, queue, "ranged"),
        rangedSurvivors: survivors,
      },
    }, `「${survivors.at(-1)!.enemy.name}」未在远程阶段被击败；继续决定是否远程攻击「${next.enemy.name}」。`);
  }
  return beginBlockPhase(state, survivors, "远程与攻城阶段结束。所有幸存敌人依次发动攻击。 ");
}

function finishEnemyAttack(state: GameState, message: string): GameState {
  if (!state.combat) return state;
  const resolvedEncounter = state.combat.summoner ?? activeEncounter(state.combat);
  const isVolkare = resolvedEncounter.enemy.id.startsWith("volkare-general-");
  const printedAttackCount = resolvedEncounter.enemy.attackCount ?? 1;
  const cancelledCount = Math.min(printedAttackCount, state.combat.cancelledAttackCountsByEnemyId?.[resolvedEncounter.enemy.id] ?? 0);
  const attackPrevented = Boolean(state.combat.cancelledAttackIds?.includes(resolvedEncounter.enemy.id)) || cancelledCount > 0;
  const effectiveAttackCount = state.combat.cancelledAttackIds?.includes(resolvedEncounter.enemy.id) ? 0 : Math.max(0, printedAttackCount - cancelledCount);
  const attackIndex = state.combat.attackIndex ?? 0;
  const allAttacksBlocked = (state.combat.allAttacksBlocked ?? true) && state.combat.blocked;
  const shield = state.combat.blocked ? state.played.find((play) => getCard(play.instanceId)?.id === "burningShield" && play.mode !== "sideways") : undefined;
  let afterShield = state;
  if (state.combat.blocked && state.combat.destroyIfBlockedIds?.includes(resolvedEncounter.enemy.id)) {
    afterShield = { ...state, combat: { ...state.combat, destroyedBySpellIds: [...new Set([...(state.combat.destroyedBySpellIds ?? []), resolvedEncounter.enemy.id])] } };
  }
  if (shield?.mode === "basic") {
    afterShield = { ...state, played: state.played.map((play) => play.instanceId === shield.instanceId ? { ...play, effectOverride: { ...(play.effectOverride ?? {}), fireBlock: 4, fireAttack: 4 } } : play) };
  } else if (shield?.mode === "powered" && !combatEnemyResists(state, resolvedEncounter.enemy, "fire") && !resolvedEncounter.enemy.arcaneImmunity) {
    afterShield = { ...state, combat: { ...state.combat, destroyedBySpellIds: [...new Set([...(state.combat.destroyedBySpellIds ?? []), resolvedEncounter.enemy.id])] } };
  }
  const bash = state.combat.blocked ? state.played.find((play) => getCard(play.instanceId)?.id === "shieldBash" && play.mode === "powered") : undefined;
  if (bash) {
    const provided = bash.effectOverride?.block ?? 5;
    const excess = Math.max(0, provided - combatBlockRequirement(state, resolvedEncounter.enemy));
    if (excess > 0 && !combatEnemyResists(state, resolvedEncounter.enemy, "ice") && !resolvedEncounter.enemy.arcaneImmunity) {
      afterShield = { ...afterShield, combat: { ...afterShield.combat!, armorReductionByEnemyId: { ...(afterShield.combat!.armorReductionByEnemyId ?? {}), [resolvedEncounter.enemy.id]: (afterShield.combat!.armorReductionByEnemyId?.[resolvedEncounter.enemy.id] ?? 0) + excess } } };
    }
  }
  const afterSummon: GameState = afterShield.combat?.summonedTokenId ? {
    ...afterShield,
    enemyDiscards: { ...afterShield.enemyDiscards, brown: [...afterShield.enemyDiscards.brown, afterShield.combat.summonedTokenId!] },
  } : afterShield;

  if (attackIndex + 1 < effectiveAttackCount) {
    const combat = afterSummon.combat!;
    const nextAttack: CombatState = {
      ...combat,
      cellId: resolvedEncounter.cellId,
      enemy: resolvedEncounter.enemy,
      step: "block",
      blocked: false,
      damageRemaining: undefined,
      summoner: undefined,
      summonedTokenId: undefined,
      attackIndex: attackIndex + 1,
      allAttacksBlocked,
      cumbersomeReductionByEnemyId: withoutEnemyRecordValue(combat.cumbersomeReductionByEnemyId, resolvedEncounter.enemy.id),
      attackReductionByEnemyId: withoutEnemyRecordValue(combat.attackReductionByEnemyId, resolvedEncounter.enemy.id),
    };
    return prepareSummonedAttack(afterSummon, nextAttack, `${message} 「${resolvedEncounter.enemy.name}」继续发动第 ${attackIndex + 2}/${effectiveAttackCount} 次独立攻击；之前的多余格挡不会转移。`);
  }

  const attacked = isVolkare ? [...(state.combat.attackedEnemies ?? [])] : [...(state.combat.attackedEnemies ?? []), resolvedEncounter];
  const successfullyBlockedEnemyIds = allAttacksBlocked && !attackPrevented
    ? [...new Set([...(state.combat.successfullyBlockedEnemyIds ?? []), resolvedEncounter.enemy.id])]
    : (state.combat.successfullyBlockedEnemyIds ?? []);
  const [next, ...queue] = state.combat.queue ?? [];
  if (next) {
    return prepareSummonedAttack(afterSummon, {
        ...withEncounter(afterSummon.combat!, next, queue, "block"),
        attackedEnemies: attacked,
        successfullyBlockedEnemyIds,
      }, `${message} 接着处理「${next.enemy.name}」的攻击。`);
  }
  if (!attacked.length) return finishCombatProgress(afterSummon, state.combat, `${message} 沃尔卡雷的军团已在远程阶段全灭，战斗结束。`);
  const [firstAttacker, ...meleeQueue] = attacked;
  return log({
    ...afterSummon,
    combat: {
      ...withEncounter(afterSummon.combat!, firstAttacker, meleeQueue, "attack"),
      attackedEnemies: undefined,
      successfullyBlockedEnemyIds,
    },
  }, `${message} 所有幸存敌人的攻击均已处理，进入近战攻击阶段。`);
}

function combatRanged(state: GameState): GameState {
  if (!state.combat || state.combat.step !== "ranged") return state;
  if (!combatDefendAssignmentsComplete(state)) return log(state, "发动第一次攻击前，必须把每一项防卫能力分配给不同的存活敌人。 ");
  const armor = combatEnemyArmor(state);
  const fortification = combatFortificationLevel(state, state.combat.enemy);
  if (fortification >= 2) return log(state, "该敌人同时具有自身与地点两层防御工事，不能在远程阶段成为攻击目标。 ");
  const paid = spendWeighted({ ...state, combat: { ...state.combat, defendAssignmentsLocked: true } }, attackResources(state, state.combat.enemy, "ranged"), armor);
  if (!paid) return log(state, fortification ? "该敌人处于防御工事中，需要足够的有效攻城攻击；抗性会将对应属性攻击减半。" : "折算抗性后的远程与攻城攻击总值不足。 ");
  return defeatEnemy(paid, "远程阶段");
}

function combatBlock(state: GameState): GameState {
  if (!state.combat || state.combat.step !== "block") return state;
  const required = combatBlockRequirement(state);
  if (required === 0) return finishEnemyAttack({ ...state, combat: { ...state.combat, blocked: true } }, `「${state.combat.enemy.name}」的攻击被盟军能力取消。`);
  const paid = spendWeighted(state, blockResources(state, state.combat.enemy), required);
  if (!paid) return log(state, `完整格挡需要 ${required} 点有效格挡；不克制该攻击属性的格挡总值减半并向下取整。你也可以选择承受伤害。`);
  return finishEnemyAttack({ ...paid, combat: { ...paid.combat!, blocked: true } }, `「${state.combat.enemy.name}」的攻击被完整格挡。`);
}

function combatDamage(state: GameState): GameState {
  if (!state.combat || (state.combat.step !== "damage" && state.combat.step !== "block")) return state;
  const totalDamage = combatDamageTotal(state, state.combat.enemy);
  if (state.combat.step !== "damage") {
    return log({ ...state, combat: { ...state.combat, step: "damage", damageRemaining: totalDamage } }, `需要分配 ${totalDamage} 点伤害。你可以先让未受伤盟军承受，其余再由英雄承受。`);
  }
  const damage = state.combat.damageRemaining ?? totalDamage;
  if (damage <= 0) return finishEnemyAttack({ ...state, combat: { ...state.combat, damageRemaining: 0 } }, `「${state.combat.enemy.name}」的伤害已经分配完毕。`);
  const woundsRequired = Math.max(1, Math.ceil(damage / heroArmor(state)));
  const woundCards = state.woundDeck.slice(0, woundsRequired);
  let woundDeck = state.woundDeck.slice(woundCards.length);
  const wounds = woundCards.length;
  const heroWoundsTaken = (state.combat.heroWoundsTaken ?? 0) + wounds;
  let hand = [...state.hand, ...woundCards];
  const discard = [...state.discard];
  let knockedOut = false;
  if (heroWoundsTaken >= levelHandLimit(state.fame)) {
    discard.push(...hand.filter((id) => !id.startsWith("wound#")));
    hand = hand.filter((id) => id.startsWith("wound#"));
    knockedOut = true;
  }
  let paralyzed = false;
  if (wounds > 0 && state.combat.enemy.paralyze) {
    discard.push(...hand.filter((id) => !id.startsWith("wound#")));
    hand = hand.filter((id) => id.startsWith("wound#"));
    paralyzed = true;
  }
  let next = { ...state, hand, discard, woundDeck, woundsReceivedThisTurn: [...(state.woundsReceivedThisTurn ?? []), ...woundCards], combat: { ...state.combat, damageRemaining: 0, heroWoundsTaken } };
  const poisonous = enemyIsPoisonous(state, state.combat.enemy);
  if (poisonous) {
    const poisonCards = woundDeck.slice(0, wounds);
    woundDeck = woundDeck.slice(poisonCards.length);
    next = { ...next, woundDeck, discard: [...next.discard, ...poisonCards], woundsReceivedThisTurn: [...(next.woundsReceivedThisTurn ?? []), ...poisonCards] };
  }
  return finishEnemyAttack(next, `你承受了「${state.combat.enemy.name}」造成的 ${damage} 点伤害，获得 ${wounds}${poisonous ? "+中毒" : ""} 张伤势牌${wounds < woundsRequired ? "（伤势供应已空）" : ""}；本场战斗累计向手牌加入 ${heroWoundsTaken} 张。${knockedOut ? " 达到未修正手牌上限：英雄被击倒，弃掉手中所有非伤势牌。" : ""}${paralyzed ? " 麻痹生效：手中所有非伤势牌立即弃掉。" : ""}`);
}

function unitResistsAttack(state: GameState, unit: UnitState, def: UnitDef, enemy: Enemy) {
  if (state.allUnitResistances) return true;
  const element = enemy.attackElement ?? "physical";
  if (element === "physical" && state.physicalResistanceUnitIds?.includes(unit.id)) return true;
  if (unit.banner?.cardId === "bannerProtection" && (element === "fire" || element === "ice")) return true;
  if (unit.banner?.cardId === "bannerProtection" && element === "coldfire") return true;
  if (element === "coldfire") return Boolean(def.resistances?.includes("fire") && def.resistances?.includes("ice"));
  return Boolean(def.resistances?.includes(element));
}

function effectiveUnitArmor(state: GameState, unit: UnitState, def: UnitDef) {
  const bannerArmor = unit.banner?.cardId === "bannerGlory" || unit.banner?.cardId === "bannerProtection" ? 1 : 0;
  return def.armor + bannerArmor + (state.allUnitsGloryThisTurn ? 1 : 0);
}

function assignDamageToUnit(state: GameState, unitId: string): GameState {
  if (!state.combat || state.combat.step !== "damage") return state;
  if (state.combat.unitsForbidden) return log(state, "该地点战斗禁止盟军参与，也不能把伤害分配给盟军。");
  if (state.combat.allowedUnitIds && !state.combat.allowedUnitIds.includes(unitId)) return log(state, "迷宫入口狭窄：只有进入时选择的那一支盟军能参与或承受伤害。");
  if (state.played.some((play) => getCard(play.instanceId)?.id === "intoTheHeat" && play.mode !== "sideways")) return log(state, "「投身战火」生效期间不能把伤害分配给盟军。");
  const unit = state.units.find((item) => item.id === unitId);
  const def = getUnit(unitId);
  if (!unit || !def || unit.wounded || state.combat.absorbedUnitIds?.includes(unitId)) return state;
  if (def.id === "thugs") {
    const paid = spend(state, "influence", 2);
    if (!paid) return log(state, "把伤害分配给暴徒还需要支付 2 点影响力。 ");
    state = paid;
  }
  if (!state.combat) return state;
  if (state.combat.enemy.assassination) return log(state, "刺杀攻击直接针对英雄，不能把伤害分配给盟军。 ");
  const totalDamage = combatDamageTotal(state, state.combat.enemy);
  const damage = state.combat.damageRemaining ?? totalDamage;
  const armor = effectiveUnitArmor(state, unit, def);
  const resistant = unitResistsAttack(state, unit, def, state.combat.enemy);
  const afterResistance = resistant ? Math.max(0, damage - armor) : damage;
  if (resistant && afterResistance === 0) {
    const combat = { ...state.combat, damageRemaining: 0, absorbedUnitIds: [...(state.combat.absorbedUnitIds ?? []), unitId] };
    return finishEnemyAttack({ ...state, combat }, `「${def.name}」以匹配抗性抵消 ${armor} 点伤害且没有受伤。`);
  }
  const remaining = Math.max(0, afterResistance - armor);
  if (unit.banner?.cardId === "bannerOfFortitude" && unit.banner.faceUp) {
    const units = state.units.map((item) => item.id === unitId ? { ...item, banner: { ...item.banner!, faceUp: false } } : item);
    const combat = { ...state.combat, damageRemaining: remaining, absorbedUnitIds: [...(state.combat.absorbedUnitIds ?? []), unitId] };
    const next = { ...state, units, combat };
    if (remaining === 0) return finishEnemyAttack(next, `「${def.name}」的坚韧旗帜忽略了伤势及其中毒/麻痹效果；伤害已全部分配。`);
    return log(next, `「${def.name}」的坚韧旗帜忽略了伤势及附加效果；还需分配 ${remaining} 点。`);
  }
  if (state.combat.enemy.paralyze) {
    const units = state.units.filter((item) => item.id !== unitId);
    const next = { ...state, units, combat: { ...state.combat, damageRemaining: remaining } };
    if (remaining === 0) return finishEnemyAttack(next, `「${def.name}」承受伤害后被麻痹摧毁并移出游戏；伤害已全部分配。`);
    return log(next, `「${def.name}」承受伤害后被麻痹摧毁并移出游戏；还需分配 ${remaining} 点。`);
  }
  const wounds = enemyIsPoisonous(state, state.combat.enemy) ? 2 : 1;
  const units = state.units.map((item) => item.id === unitId ? { ...item, wounded: true, wounds } : item);
  const next = { ...state, units, combat: { ...state.combat, damageRemaining: remaining } };
  const resistanceNote = resistant ? `抗性先抵消 ${armor} 点，随后` : "";
  const poisonNote = wounds === 2 ? "并放置 2 张伤势" : "";
  if (remaining === 0) return finishEnemyAttack(next, `「${def.name}」${resistanceNote}承受伤害${poisonNote}，再抵消 ${armor} 点；伤害已全部分配。`);
  return log(next, `「${def.name}」${resistanceNote}承受伤害${poisonNote}，再抵消 ${armor} 点；还需分配 ${remaining} 点。`);
}

function combatAttack(state: GameState): GameState {
  if (!state.combat || state.combat.step !== "attack") return state;
  if (!combatDefendAssignmentsComplete(state)) return log(state, "发动第一次攻击前，必须把每一项防卫能力分配给不同的存活敌人。 ");
  if (state.combat.destroyedBySpellIds?.includes(state.combat.enemy.id)) return defeatEnemy(state, "法术效果");
  const armor = combatEnemyArmor(state);
  const paid = spendWeighted({ ...state, combat: { ...state.combat, defendAssignmentsLocked: true } }, attackResources(state, state.combat.enemy, "attack"), armor);
  if (!paid) return log(state, `折算抗性后，击败敌人还需要合计 ${armor} 点有效攻击。`);
  return defeatEnemy(paid, "近战阶段");
}

function combatGroupAttack(state: GameState, enemyIds: string[]): GameState {
  if (!state.combat || (state.combat.step !== "ranged" && state.combat.step !== "attack")) return state;
  if (!combatDefendAssignmentsComplete(state)) return log(state, "发动第一次攻击前，必须把每一项防卫能力分配给不同的存活敌人。 ");
  const resolvedCombat = state.combat;
  const wanted = new Set(enemyIds);
  const candidates = combatAttackTargets(state);
  const selected = candidates.filter((entry) => wanted.has(entry.enemy.id));
  if (selected.length < 2 || selected.length !== wanted.size) return log(state, "合并攻击必须选择当前阶段中至少两支不同敌人。");
  const armor = groupedArmor(state, selected);
  const entries = groupAttackResources(state, selected.map((entry) => entry.enemy), resolvedCombat.step as CombatStage);
  const paid = spendWeighted({ ...state, combat: { ...state.combat, defendAssignmentsLocked: true } }, entries, armor);
  if (!paid) {
    const doubleFortified = resolvedCombat.step === "ranged" && selected.some((entry) => combatFortificationLevel(state, entry.enemy) >= 2);
    return log(state, doubleFortified
      ? "攻击组中含有双重防御工事敌人，因此整组不能在远程阶段成为目标。"
      : `该攻击组总护甲为 ${armor}；只要组内任一敌人有对应抗性，该属性攻击就会整体减半，当前有效攻击不足。`);
  }
  let next = paid;
  const summaries: string[] = [];
  for (const encounter of selected) {
    const defeated = applyDefeatedEncounter(next, encounter, resolvedCombat, resolvedCombat.step === "ranged" ? "远程攻击组" : "近战攻击组");
    next = defeated.state;
    if (defeated.summary) summaries.push(defeated.summary);
  }
  const remaining = candidates.filter((entry) => !wanted.has(entry.enemy.id));
  const message = `合并攻击总护甲 ${armor}，同时击败 ${selected.length} 支敌人。${summaries.join(" ")}`;
  if (resolvedCombat.step === "ranged") {
    const [first, ...queue] = remaining;
    if (first) return log({ ...next, combat: { ...withEncounter(resolvedCombat, first, queue, "ranged"), rangedSurvivors: resolvedCombat.rangedSurvivors } }, `${message} 远程阶段继续。`);
    if (resolvedCombat.rangedSurvivors?.length) return beginBlockPhase(next, resolvedCombat.rangedSurvivors, `${message} 剩余敌人开始发动攻击。`);
    return finishCombatProgress(next, resolvedCombat, message);
  }
  const [first, ...queue] = remaining;
  if (first) return log({ ...next, combat: withEncounter(resolvedCombat, first, queue, "attack") }, `${message} 近战阶段继续。`);
  return finishCombatProgress(next, resolvedCombat, message);
}

function grantArtifact(state: GameState) {
  const artifactId = state.artifactDeck[0];
  const artifact = artifactId ? ALL_CARD_DEFS[artifactId] : undefined;
  if (!artifact) return { state, label: "圣器牌堆已空" };
  return {
    state: {
      ...state,
      artifacts: state.artifacts + 1,
      artifactInventory: [...state.artifactInventory, artifact.name],
      artifactDeck: state.artifactDeck.slice(1),
      deck: [uid(artifact.id, state), ...state.deck],
    },
    label: `获得遗物（圣器）「${artifact.name}」（置于牌库顶）`,
  };
}

function grantSpell(state: GameState) {
  const reward = state.spellOffer[0];
  if (!reward) return { state, label: "法术供应已空" };
  const replacement = state.spellDeck[0];
  return {
    state: {
      ...state,
      deck: [uid(reward, state), ...state.deck],
      spellOffer: [...state.spellOffer.slice(1), ...(replacement ? [replacement] : [])],
      spellDeck: replacement ? state.spellDeck.slice(1) : state.spellDeck,
    },
    label: `获得法术「${ALL_CARD_DEFS[reward]?.name ?? reward}」`,
  };
}

function grantAdvanced(state: GameState) {
  const reward = state.advancedOffer[0];
  if (!reward) return { state, label: "进阶行动供应已空" };
  const replacement = state.advancedDeck[0];
  return {
    state: {
      ...state,
      deck: [uid(reward, state), ...state.deck],
      advancedOffer: [...state.advancedOffer.slice(1), ...(replacement ? [replacement] : [])],
      advancedDeck: replacement ? state.advancedDeck.slice(1) : state.advancedDeck,
    },
    label: `获得进阶行动「${ALL_CARD_DEFS[reward]?.name ?? reward}」`,
  };
}

function grantCrystals(state: GameState, count: number) {
  const crystals = { ...state.crystals };
  const gained: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const color = BASIC_COLORS[(state.seed + state.turnsTaken + index) % BASIC_COLORS.length];
    crystals[color] = Math.min(3, crystals[color] + 1);
    gained.push(color);
  }
  return { state: { ...state, crystals }, label: `获得 ${count} 枚随机水晶（${gained.join("、")}）` };
}

function grantChosenCrystals(state: GameState, colors: BasicManaColor[]) {
  const crystals = { ...state.crystals };
  const gained: BasicManaColor[] = [];
  colors.forEach((color) => {
    if (crystals[color] < 3) {
      crystals[color] += 1;
      gained.push(color);
    }
  });
  return { state: { ...state, crystals }, label: `获得所选水晶（${gained.join("、") || "库存已满"}）` };
}

/** Deterministic replay-safe equivalent of rolling a physical mana die. */
function rollManaReward(state: GameState, count: number) {
  const faces: ManaColor[] = ["red", "blue", "green", "white", "gold", "black"];
  let next = state;
  const results: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const face = faces[(state.seed + state.turnsTaken * 7 + index * 5) % faces.length];
    if (face === "black") {
      next = { ...next, fame: next.fame + 1 };
      results.push("黑：名望 +1");
    } else {
      const color: BasicManaColor = face === "gold" ? BASIC_COLORS[(state.seed + index) % BASIC_COLORS.length] : face;
      next = { ...next, crystals: { ...next.crystals, [color]: Math.min(3, next.crystals[color] + 1) } };
      results.push(`${face === "gold" ? "金→" : ""}${color}水晶`);
    }
  }
  return { state: next, label: `魔力骰奖励：${results.join("、")}` };
}

function rewardForSite(state: GameState, cell: MapCell): { state: GameState; rewards: string[] } {
  let next = state;
  const rewards: string[] = [];
  if (cell.site === "keep") {
    next = { ...next, ownedKeeps: next.ownedKeeps + 1 };
    rewards.push("占领要塞");
  }
  if (cell.site === "mageTower" && next.spellOffer.length) {
    const reward = next.spellOffer[0];
    const replacement = next.spellDeck[0];
    next = {
      ...next,
      deck: [uid(reward, next), ...next.deck],
      spellOffer: [...next.spellOffer.slice(1), ...(replacement ? [replacement] : [])],
      spellDeck: replacement ? next.spellDeck.slice(1) : next.spellDeck,
    };
    rewards.push(`获得法术「${ALL_CARD_DEFS[reward]?.name ?? reward}」`);
  }
  if (cell.site === "monastery") {
    const artifact = grantArtifact(next);
    next = artifact.state;
    rewards.push("焚毁修道院", artifact.label);
  }
  if (cell.site === "ruins") {
    if (cell.ruinsReward === "artifact") {
      const artifact = grantArtifact(next);
      next = artifact.state;
      rewards.push(artifact.label);
    } else if (cell.ruinsReward === "spell") {
      const spell = grantSpell(next);
      next = spell.state;
      rewards.push(spell.label);
    } else if (cell.ruinsReward === "advanced") {
      const advanced = grantAdvanced(next);
      next = advanced.state;
      rewards.push(advanced.label);
    } else if (cell.ruinsReward === "crystals") {
      const crystals = grantCrystals(next, 2);
      next = crystals.state;
      rewards.push(crystals.label);
    }
  }
  if (cell.site === "monsterDen") {
    const denReward = rollManaReward(next, 2);
    next = denReward.state;
    rewards.push(denReward.label);
  }
  if (cell.site === "dungeon" && !next.combat?.repeatAdventure) {
    const roll = (next.seed + next.turnsTaken) % 6;
    const dungeonReward = roll >= 4 ? grantSpell(next) : grantArtifact(next);
    next = dungeonReward.state;
    rewards.push(`魔力骰为${roll === 4 ? "金" : roll === 5 ? "黑" : "基础色"}`, dungeonReward.label);
  }
  if (cell.site === "tomb") {
    const spell = grantSpell(next);
    const artifact = grantArtifact(spell.state);
    next = artifact.state;
    rewards.push(spell.label, artifact.label);
  }
  if (cell.site === "spawningGrounds") {
    const artifact = grantArtifact(next);
    const rolls = rollManaReward(artifact.state, 3);
    next = rolls.state;
    rewards.push(artifact.label, rolls.label);
  }
  if (cell.site === "maze") {
    const paid = next.combat?.adventureMoveSpend ?? 2;
    if (paid === 2) {
      const crystals = grantChosenCrystals(next, next.combat?.adventureRewardCrystalColors ?? []);
      next = crystals.state;
      rewards.push(crystals.label);
    } else if (paid === 4) {
      const spell = grantSpell(next);
      next = spell.state;
      rewards.push(spell.label);
    } else {
      const artifact = grantArtifact(next);
      next = artifact.state;
      rewards.push(artifact.label);
    }
  }
  if (cell.site === "labyrinth") {
    const paid = next.combat?.adventureMoveSpend ?? 2;
    if (paid === 2) {
      const crystals = grantChosenCrystals(next, next.combat?.adventureRewardCrystalColors ?? []);
      next = crystals.state;
      rewards.push(crystals.label);
    } else if (paid === 4) {
      const spell = grantSpell(next);
      next = spell.state;
      rewards.push(spell.label);
    } else {
      const artifact = grantArtifact(next);
      next = artifact.state;
      rewards.push(artifact.label);
    }
    const advanced = grantAdvanced(next);
    next = advanced.state;
    rewards.push(advanced.label);
  }
  // Graveyard, Necropolis and Hidden Valley are scenario overlays. Their
  // rewards are printed by the selected Shades of Tezla scenario/order, not
  // by the generic location card, so the shared engine must not invent loot.
  if (cell.site === "volkareCamp") {
    next = { ...next, conqueredCities: next.conqueredCities + 1 };
    if (next.conqueredCities >= 2) next = { ...next, missionCountdown: 2 };
    rewards.push("俘获沃尔卡雷并占领营地；营地按一座城市计分并开放营地服务");
  }
  if (cell.site === "city1" || cell.site === "city2") {
    next = { ...next, conqueredCities: next.conqueredCities + 1 };
    if (next.conqueredCities >= 2) next = { ...next, missionCountdown: 2 };
    rewards.push("攻克城市");
  }
  return { state: next, rewards };
}

function finishCombatProgress(state: GameState, resolvedCombat: CombatState, message: string): GameState {
  const previousLevel = levelFor(resolvedCombat.chainStartFame ?? state.fame);
  let next: GameState = { ...state, phase: "planning", combat: undefined };
  const newLevel = levelFor(next.fame);
  const levelRewards = Math.floor(newLevel / 2) - Math.floor(previousLevel / 2);
  if (levelRewards > 0) {
    const available = getHeroSkillsForMode(next.contentMode ?? "base", next.heroId).filter((skill) => !(next.skills ?? []).includes(skill.id));
    const pendingSkillChoices = shuffle(available).slice(0, 2).map((skill) => skill.id);
    if (pendingSkillChoices.length) next = { ...next, phase: "skill", pendingSkillChoices, pendingAdvancedChoices: [], pendingLevelRewards: levelRewards };
  }
  const suffix = next.conqueredCities >= 2 ? " 两座城市均已攻克；你还拥有最后一个完整回合。" : "";
  return log(next, `${message}${suffix}`);
}

function applyDefeatedEncounter(state: GameState, encounter: CombatEncounter, resolvedCombat: CombatState, via: string) {
  const cell = state.map.find((item) => item.id === encounter.cellId);
  if (!cell) return { state, summary: "" };
  const remainingOnCell = enemiesOnCell(cell).filter((enemy) => enemy.id !== encounter.enemy.id);
  const clearedSite = remainingOnCell.length === 0;
  const pursuit = Boolean(resolvedCombat.volkarePursuit);
  const newlyCleared = !pursuit && clearedSite && !cell.conquered;
  const tokenColor = encounter.enemy.tokenColor;
  const enemyDiscards = tokenColor ? {
    ...state.enemyDiscards,
    [tokenColor]: [...state.enemyDiscards[tokenColor], encounter.enemy.id],
  } : state.enemyDiscards;
  const ruinDiscards = newlyCleared && cell.site === "ruins" && cell.ruinTokenId && !state.ruinDiscards.includes(cell.ruinTokenId)
    ? [...state.ruinDiscards, cell.ruinTokenId]
    : state.ruinDiscards;
  let volkareShields = state.volkareShields ?? 0;
  let volkareMinorDefeats = state.volkareMinorDefeats ?? 0;
  if (!pursuit && cell.site === "volkareCamp") {
    if (tokenColor === "red" || tokenColor === "white") volkareShields += 1;
    if (tokenColor === "green" || tokenColor === "gray") {
      volkareMinorDefeats += 1;
      if (volkareMinorDefeats % 2 === 0) volkareShields += 1;
    }
  }
  const firstPursuitVictory = pursuit && !state.pursuedCampCellIds?.includes(cell.id);
  let next: GameState = {
    ...state,
    fame: state.fame + encounter.enemy.fame + (state.played.some((play) => play.mode !== "sideways" && getCard(play.instanceId)?.id === "swordJustice") ? 1 : 0),
    factionTokens: encounter.enemy.faction ? {
      ...(state.factionTokens ?? { elementalists: 0, "dark-crusaders": 0 }),
      [encounter.enemy.faction]: (state.factionTokens?.[encounter.enemy.faction] ?? 0) + 1,
    } : (state.factionTokens ?? { elementalists: 0, "dark-crusaders": 0 }),
    reputation: !pursuit && cell.site === "rampager"
      ? Math.min(5, state.reputation + 1)
      : !pursuit && cell.site === "dragon" ? Math.min(5, state.reputation + 2) : state.reputation,
    conqueredSites: state.conqueredSites + (newlyCleared ? 1 : 0),
    enemyDiscards,
    ruinDiscards,
    volkareShields,
    volkareMinorDefeats,
    pursuedCampCellIds: firstPursuitVictory ? [...(state.pursuedCampCellIds ?? []), cell.id] : (state.pursuedCampCellIds ?? []),
    volkarePursuitShields: (state.volkarePursuitShields ?? 0) + (firstPursuitVictory ? 1 : 0),
    map: state.map.map((item) => item.id === cell.id ? { ...item, conquered: pursuit ? item.conquered : item.conquered || clearedSite, enemies: remainingOnCell, enemy: remainingOnCell[0] } : item),
  };
  const chivalry = state.played.find((play) => getCard(play.instanceId)?.id === "chivalry" && play.mode !== "sideways" && play.selection?.option === "honor");
  if (chivalry && resolvedCombat.step === "attack") {
    next = { ...next, reputation: Math.min(5, next.reputation + 1), fame: next.fame + (chivalry.mode === "powered" ? 1 : 0) };
  }
  const siteReward = newlyCleared ? rewardForSite({ ...next, combat: resolvedCombat }, cell) : { state: next, rewards: [] };
  next = siteReward.state;
  const reputationReward = !pursuit && cell.site === "rampager" ? "，声誉轨位 +1" : !pursuit && cell.site === "dragon" ? "，声誉轨位 +2" : "";
  const rewardText = siteReward.rewards.length ? `；${siteReward.rewards.join("；")}` : clearedSite ? "" : `；该地点仍有 ${remainingOnCell.length} 枚敌人标记`;
  const factionReward = encounter.enemy.faction ? `，并获得 1 枚${encounter.enemy.faction === "elementalists" ? "元素派" : "黑暗十字军"}标记` : "";
  const campShield = pursuit && firstPursuitVictory ? "，并在该区域放置 1 枚追猎盾牌" : cell.site === "volkareCamp" && volkareShields > (state.volkareShields ?? 0) ? `，营地盾牌增至 ${volkareShields}` : "";
  return {
    state: next,
    summary: `你在${via}击败了「${encounter.enemy.name}」，获得 ${encounter.enemy.fame} 点名望${reputationReward}${factionReward}${campShield}${rewardText}。`,
  };
}

function defeatEnemy(state: GameState, via: string): GameState {
  if (!state.combat) return state;
  const resolvedCombat = state.combat;
  const defeated = applyDefeatedEncounter(state, activeEncounter(resolvedCombat), resolvedCombat, via);
  const next = defeated.state;
  const battleSummary = defeated.summary;
  const [queued, ...remaining] = resolvedCombat.queue ?? [];

  if (resolvedCombat.step === "ranged") {
    if (queued) {
      return log({
        ...next,
        combat: {
          ...withEncounter(resolvedCombat, queued, remaining, "ranged"),
          rangedSurvivors: resolvedCombat.rangedSurvivors,
        },
      }, `${battleSummary} 远程阶段继续，下一目标是「${queued.enemy.name}」。`);
    }
    if (resolvedCombat.rangedSurvivors?.length) {
      return beginBlockPhase(next, resolvedCombat.rangedSurvivors, `${battleSummary} 剩余敌人开始发动攻击。`);
    }
    return finishCombatProgress(next, resolvedCombat, battleSummary);
  }

  if (queued) {
    return log({
      ...next,
      combat: withEncounter(resolvedCombat, queued, remaining, "attack"),
    }, `${battleSummary} 近战阶段继续，下一目标是「${queued.enemy.name}」。`);
  }
  return finishCombatProgress(next, resolvedCombat, battleSummary);
}

function chooseSkill(state: GameState, skillId: string): GameState {
  if (state.phase !== "skill" || !state.pendingSkillChoices.includes(skillId)) return state;
  const skill = getSkill(skillId);
  if (!skill || skill.heroId !== state.heroId) return state;
  return log({
    ...state,
    phase: "skill",
    skills: [...(state.skills ?? []), skillId],
    pendingSkillChoices: [],
    pendingAdvancedChoices: [...state.advancedOffer],
  }, `你掌握了英雄技能「${skill.name}」；现在从进阶行动供应中获得 1 张牌。`);
}

function chooseLevelAdvanced(state: GameState, cardId: string): GameState {
  if (state.phase !== "skill" || !(state.pendingAdvancedChoices ?? []).includes(cardId) || !state.advancedOffer.includes(cardId)) return state;
  const card = ALL_CARD_DEFS[cardId];
  if (!card || card.tier !== "advanced") return state;
  const replacement = state.advancedDeck[0];
  const remainingRewards = Math.max(0, (state.pendingLevelRewards ?? 1) - 1);
  let next: GameState = {
    ...state,
    deck: [uid(cardId, state), ...state.deck],
    advancedOffer: [...state.advancedOffer.filter((id) => id !== cardId), ...(replacement ? [replacement] : [])],
    advancedDeck: replacement ? state.advancedDeck.slice(1) : state.advancedDeck,
    pendingAdvancedChoices: [],
    pendingLevelRewards: remainingRewards,
    phase: "planning",
  };
  if (remainingRewards > 0) {
    const available = getHeroSkillsForMode(next.contentMode ?? "base", next.heroId).filter((skill) => !next.skills.includes(skill.id));
    const pendingSkillChoices = shuffle(available).slice(0, 2).map((skill) => skill.id);
    if (pendingSkillChoices.length) next = { ...next, phase: "skill", pendingSkillChoices };
  }
  return log(next, `升级奖励「${card.name}」已置于牌库顶。`);
}

function combatRetreat(state: GameState): GameState {
  if (!state.combat) return state;
  const resolvedCombat = state.combat;
  const mustWithdraw = resolvedCombat.mustWithdraw ?? resolvedCombat.kind === "assault";
  const remainingEnemies = [resolvedCombat.enemy, ...(resolvedCombat.queue ?? []).map((encounter) => encounter.enemy)];
  const names = remainingEnemies.map((enemy) => `「${enemy.name}」`).join("、");
  let next: GameState = { ...state, position: mustWithdraw ? resolvedCombat.originId : state.position };
  let outcome = mustWithdraw
    ? `你未能击败${names}，所有未被消灭的敌军留在地图上；你被迫撤回发起强攻的区域。`
    : `你未能击败${names}；未被消灭的敌军留在地图上，英雄仍停留在当前区域。`;
  const cell = next.map.find((item) => item.id === resolvedCombat.cellId);
  if (cell && resolvedCombat.adventureFailure === "discard") {
    const enemyDiscards = { ...next.enemyDiscards };
    enemiesOnCell(cell).forEach((enemy) => {
      if (enemy.tokenColor) enemyDiscards[enemy.tokenColor] = [...enemyDiscards[enemy.tokenColor], enemy.id];
    });
    next = {
      ...next,
      enemyDiscards,
      map: next.map.map((item) => item.id === cell.id ? { ...item, enemy: undefined, enemies: [], tokenRevealed: false } : item),
    };
    outcome = `你未能击败${names}；本次抽出的敌人标记被弃置，下次尝试会重新抽取。`;
  } else if (cell && resolvedCombat.adventureFailure === "replenish") {
    const survivors = enemiesOnCell(cell);
    const targetCount = resolvedCombat.adventureTargetCount ?? survivors.length;
    const drawn = drawSiteEnemies(next, cell, Array.from({ length: Math.max(0, targetCount - survivors.length) }, () => "brown" as const));
    const defenders = [...survivors, ...drawn.enemies];
    next = {
      ...next,
      enemyDecks: drawn.enemyDecks,
      enemyDiscards: drawn.enemyDiscards,
      map: next.map.map((item) => item.id === cell.id ? { ...item, enemies: defenders, enemy: defenders[0], tokenRevealed: false } : item),
    };
    outcome = `你未能清除${names}；繁殖地保留幸存敌人，并以新的面朝下棕色标记补回 ${targetCount} 枚。`;
  }
  return finishCombatProgress(next, resolvedCombat, outcome);
}

function claimCrystal(state: GameState, color: "red" | "blue" | "green" | "white"): GameState {
  const paid = spend(state, "crystal", 1);
  if (!paid || paid.crystals[color] >= 3) return state;
  return log({ ...paid, crystals: { ...paid.crystals, [color]: paid.crystals[color] + 1 } }, `获得一枚${color}色魔力水晶。`);
}

function selectMineColor(state: GameState, color: BasicManaColor): GameState {
  if (state.phase !== "planning") return state;
  const cell = currentSite(state);
  if (!cell || cell.site !== "deepMine") return state;
  const colors = cell.mineColors?.length ? cell.mineColors : cell.mineColor ? [cell.mineColor] : [];
  if (!colors.includes(color)) return log(state, "该深层矿井不生产所选颜色的水晶。");
  return log({ ...state, selectedMineColor: color }, `已选择在回合结束时开采${color}色水晶。`);
}

function applyGoldenGrailFame(state: GameState, healingSpent: number): GameState {
  const grail = state.played.find((play) => play.mode === "basic" && getCard(play.instanceId)?.id === "goldenGrail");
  if (!grail) return state;
  const already = state.goldenGrailHealingSpent ?? 0;
  const attributed = Math.max(0, Math.min(healingSpent, 2 - already));
  return attributed > 0 ? { ...state, fame: state.fame + attributed, goldenGrailHealingSpent: already + attributed } : state;
}

function drawHealingRewards(state: GameState, count: number): GameState {
  if (count <= 0) return state;
  const drawn = drawFrom(state.deck, state.hand, count);
  return { ...state, ...drawn };
}

function applyHeal(state: GameState): GameState {
  if (state.phase === "combat" || state.phase === "tactic" || state.phase === "skill" || state.phase === "gameover") return state;
  const paid = spend(state, "heal", 1);
  if (!paid) return state;
  const handIndex = paid.hand.findIndex((id) => id.startsWith("wound#"));
  if (handIndex >= 0) {
    let next = applyGoldenGrailFame({ ...paid, hand: paid.hand.filter((_, index) => index !== handIndex), woundDeck: [...paid.woundDeck, paid.hand[handIndex]] }, 1);
    const bonusDraws = paid.played.filter((play) => play.mode === "basic" && getCard(play.instanceId)?.id === "cure").length
      + paid.played.filter((play) => play.mode === "powered" && getCard(play.instanceId)?.id === "goldenGrail").length;
    next = drawHealingRewards(next, bonusDraws);
    return log(next, `移除一张手牌中的伤势，并将伤势牌放回供应${bonusDraws ? `；治疗奖励抽 ${bonusDraws} 张牌` : ""}。 `);
  }
  const discardIndex = paid.discard.findIndex((id) => id.startsWith("wound#"));
  if (discardIndex >= 0) return log(applyGoldenGrailFame({ ...paid, discard: paid.discard.filter((_, index) => index !== discardIndex), woundDeck: [...paid.woundDeck, paid.discard[discardIndex]] }, 1), "移除一张弃牌堆中的伤势，并将伤势牌放回供应。 ");
  return state;
}

function healUnit(state: GameState, unitId: string): GameState {
  if (state.phase === "combat" || state.phase === "tactic" || state.phase === "skill" || state.phase === "gameover") return state;
  const unit = state.units.find((item) => item.id === unitId);
  const def = getUnit(unitId);
  if (!unit?.wounded || !def) return state;
  const paid = spend(state, "heal", def.level);
  if (!paid) return log(state, `治疗「${def.name}」需要 ${def.level} 点治疗。`);
  const remainingWounds = Math.max(0, (unit.wounds ?? 1) - 1);
  const cureReady = paid.played.some((play) => play.mode === "basic" && getCard(play.instanceId)?.id === "cure");
  const next = applyGoldenGrailFame({ ...paid, units: paid.units.map((item) => item.id === unitId ? { ...item, wounds: remainingWounds, wounded: remainingWounds > 0, used: cureReady ? false : item.used, selectedAbilityId: cureReady ? undefined : item.selectedAbilityId } : item) }, def.level);
  return log(next, remainingWounds > 0 ? `「${def.name}」移除 1 张伤势；中毒造成的另一张伤势仍需再次治疗${cureReady ? "，并因治愈法术重整" : ""}。` : `「${def.name}」已被治愈${cureReady ? "并重整" : ""}。`);
}

function applyDraw(state: GameState): GameState {
  const paid = spend(state, "draw", 1);
  if (!paid) return state;
  const drawn = drawFrom(paid.deck, paid.hand, 1);
  return { ...paid, ...drawn };
}

function rest(state: GameState): GameState {
  if (state.phase !== "planning" || state.actionTaken || state.played.length || Object.values(state.spent).some(Boolean)) return state;
  const woundCards = state.hand.filter((id) => id.startsWith("wound#"));
  const normalIndex = state.hand.findIndex((id) => !id.startsWith("wound#"));
  const refreshBattleFrenzy = state.flippedSkills?.includes("krang-battle-frenzy");
  if (!woundCards.length && refreshBattleFrenzy && normalIndex >= 0) {
    const discarded = state.hand[normalIndex];
    return log({ ...state, hand: state.hand.filter((id) => id !== discarded), discard: [...state.discard, discarded], actionTaken: true, flippedSkills: state.flippedSkills?.filter((id) => id !== "krang-battle-frenzy") }, "完成标准休整并将战斗狂热翻回正面。 ");
  }
  if (!woundCards.length) return log(state, "手牌中没有伤势，无需休整。 ");
  const discardedNormal = normalIndex >= 0 ? [state.hand[normalIndex]] : [];
  const discardedWounds = normalIndex >= 0 ? woundCards : woundCards.slice(0, 1);
  const removed = new Set([...discardedWounds, ...discardedNormal]);
  return log({ ...state, hand: state.hand.filter((id) => !removed.has(id)), discard: [...state.discard, ...discardedWounds, ...discardedNormal], actionTaken: true, flippedSkills: refreshBattleFrenzy ? state.flippedSkills?.filter((id) => id !== "krang-battle-frenzy") : state.flippedSkills }, normalIndex >= 0
    ? `完成标准休整：弃掉 1 张非伤势牌与 ${discardedWounds.length} 张伤势。`
    : "完成缓慢恢复：手中只有伤势，因此只能弃掉 1 张伤势。" );
}

function currentSite(state: GameState) {
  return state.map.find((cell) => cell.id === state.position);
}

function canContinueInteraction(state: GameState) {
  return !state.actionTaken || state.interactionSite === state.position;
}

function markInteraction(state: GameState): GameState {
  return { ...state, actionTaken: true, interactionSite: state.position, interactionModifierUsed: true };
}

export function siteAllowsUnit(site: SiteType, unit: UnitDef, conquered: boolean) {
  if (unit.id === "magicFamiliars" && site === "glade") return true;
  if (site === "refugeeCamp") return true;
  if (site === "volkareCamp" && conquered) {
    const locations = unit.recruitSites ?? [unit.site === "city" ? "city" : unit.site];
    return locations.includes("village") || locations.includes("keep");
  }
  if (site === "monastery" && conquered) return false;
  if (unit.site === "any") return (["village", "monastery", "keep", "mageTower", "city1", "city2"] as SiteType[]).includes(site);
  const normalized = site === "city1" || site === "city2" ? "city" : site;
  const locations = unit.recruitSites ?? [unit.site === "city" ? "city" : unit.site];
  if (!(["village", "monastery", "keep", "mageTower", "city"] as string[]).includes(normalized)) return false;
  if ((normalized === "keep" || normalized === "mageTower" || normalized === "city") && !conquered) return false;
  return locations.includes(normalized as "village" | "monastery" | "keep" | "mageTower" | "city");
}

export function canRecruitUnitAtCurrentSite(state: GameState, unit: UnitDef) {
  const cell = currentSite(state);
  if (!cell) return false;
  if (siteAllowsUnit(cell.site, unit, cell.conquered)) return true;
  const camp = nearbyConqueredVolkareCamp(state);
  if (!camp) return false;
  const locations = unit.recruitSites ?? [unit.site === "city" ? "city" : unit.site];
  return locations.includes("village") || locations.includes("keep");
}

function addRegularUnitToOffer(state: GameState): GameState {
  if (state.phase !== "planning" || !canContinueInteraction(state) || !nearbyConqueredVolkareCamp(state)) return state;
  const unitId = state.regularUnitDeck[0];
  if (!unitId) return log(state, "普通盟军牌堆已空，无法继续扩充供应。");
  const cost = influenceCost(state, 1);
  const paid = spend(state, "influence", cost);
  if (!paid) return log(state, `向沃尔卡雷营地周边召集一支新的普通盟军需要 ${cost} 点有效影响力。`);
  return log(markInteraction({ ...paid, unitOffer: [...paid.unitOffer, unitId], regularUnitDeck: paid.regularUnitDeck.slice(1) }), `支付 ${cost} 点有效影响力，将「${getUnit(unitId)?.name ?? unitId}」加入公开盟军供应。`);
}

function pursueVolkareEnemies(state: GameState, colors: Array<"green" | "red">): GameState {
  if (state.phase !== "planning" || state.actionTaken || !nearbyConqueredVolkareCamp(state)) return state;
  const cell = currentSite(state);
  if (!cell || state.pursuedCampCellIds?.includes(cell.id)) return log(state, "这个区域已经进行过营地追猎，不能再次追猎。");
  const chosen = [...new Set(colors)];
  if (!chosen.length || chosen.length !== colors.length || chosen.some((color) => color !== "green" && color !== "red")) {
    return log(state, "追猎必须选择绿色兽人、红色巨龙，或两者各一枚。");
  }
  const drawn = drawSiteEnemies(state, cell, chosen);
  if (drawn.enemies.length !== chosen.length) return log(state, "对应颜色的敌人标记不足，无法开始追猎。");
  const [first, ...rest] = drawn.enemies;
  const map = state.map.map((item) => item.id === cell.id ? { ...item, enemies: drawn.enemies, enemy: first, tokenRevealed: true } : item);
  const combatReady = lockEffectsAtCombatStart({ ...state, map, enemyDecks: drawn.enemyDecks, enemyDiscards: drawn.enemyDiscards });
  return log({
    ...combatReady,
    phase: "combat",
    actionTaken: true,
    combat: {
      cellId: cell.id,
      enemy: first,
      originId: cell.id,
      kind: "pursuit",
      step: "ranged",
      blocked: false,
      queue: rest.map((enemy) => ({ cellId: cell.id, enemy })),
      chainStartFame: state.fame,
      adventureFailure: "discard",
      volkarePursuit: true,
    },
  }, `你在营地周边发起追猎，迎战${drawn.enemies.map((enemy) => `「${enemy.name}」`).join("、")}；追猎只奖励名望。`);
}

export function unitRecruitInfluenceCost(state: GameState, unit: UnitDef) {
  const cell = currentSite(state);
  if (unit.id === "magicFamiliars" && cell?.site === "glade") return unit.cost;
  const locations = unit.recruitSites ?? [unit.site === "city" ? "city" : unit.site];
  const surcharge = cell?.site === "refugeeCamp"
    ? locations.includes("village") ? 0
      : locations.some((site) => site === "monastery" || site === "keep" || site === "mageTower") ? 1 : 3
    : 0;
  const baseCost = unit.cost + surcharge;
  if (!state.interactionModifierUsed && (unit.id === "thugs" || unit.id.startsWith("hero"))) {
    const modifier = reputationInfluenceModifier(state) ?? 0;
    return unit.id === "thugs" ? Math.max(0, baseCost + modifier) : Math.max(0, baseCost - modifier * 2);
  }
  return influenceCost(state, baseCost);
}

function recruit(state: GameState, unitId: string, manaColor?: BasicManaColor): GameState {
  const cell = currentSite(state);
  const unit = getUnit(unitId);
  const commandBanner = state.played.find((play) => play.mode === "basic" && getCard(play.instanceId)?.id === "bannerOfCommand" && !state.units.some((owned) => owned.banner?.instanceId === play.instanceId));
  if (!cell || !unit || state.phase !== "planning" || !canContinueInteraction(state) || !state.unitOffer.includes(unitId) || (state.units.length >= commandLimit(state) && !commandBanner) || !canRecruitUnitAtCurrentSite(state, unit)) return state;
  const gladeFamiliar = unit.id === "magicFamiliars" && cell.site === "glade";
  if (!gladeFamiliar && !localsWillInteract(state)) return log(state, "你的声誉已落到 X，居民拒绝与你互动。");
  const reputationMode = unit.id === "thugs" ? "thugs" : unit.id.startsWith("hero") ? "heroes" : undefined;
  if (reputationMode && state.interactionReputationMode && state.interactionReputationMode !== reputationMode) return log(state, "同一次互动中不能同时招募暴徒与英雄盟军。 ");
  if (reputationMode && state.interactionModifierUsed && !state.interactionReputationMode) return log(state, "招募暴徒或英雄会改变整次互动的声誉修正；必须在本次互动的第一次消费时招募。 ");
  const pricedState: GameState = reputationMode ? { ...state, interactionReputationMode: reputationMode } : state;
  const onHerOwnPenalty = (pricedState.skillTurnResources?.["wolfhawk-on-her-own"]?.influence ?? 0) >= 3 ? 2 : 0;
  const cost = unitRecruitInfluenceCost(pricedState, unit) + onHerOwnPenalty;
  const paid = spend(pricedState, "influence", cost);
  if (!paid) return log(state, `招募「${unit.name}」需要 ${cost} 点影响力。`);
  const paidMana = unit.id === "magicFamiliars" && manaColor ? payManaCosts(paid, [manaColor]) : paid;
  if (unit.id === "magicFamiliars" && (!manaColor || !paidMana)) return log(state, "招募魔法使魔还必须选择并支付 1 份基础色魔力。 ");
  const nextPaid = paidMana!;
  const recruited: UnitState = { id: unitId, used: false, wounded: false, wounds: 0, familiarCrystal: unit.id === "magicFamiliars" ? manaColor : undefined, banner: commandBanner ? { instanceId: commandBanner.instanceId, cardId: "bannerOfCommand", faceUp: true, command: true } : undefined };
  const recruitedState: GameState = {
    ...nextPaid,
    units: [...nextPaid.units, recruited],
    recruitedUnitIdsThisTurn: [...(nextPaid.recruitedUnitIdsThisTurn ?? []), unitId],
    unitOffer: nextPaid.unitOffer.filter((id) => id !== unitId),
    refugeeCampRecruitUsed: nextPaid.refugeeCampRecruitUsed,
  };
  const finished = gladeFamiliar ? { ...recruitedState, actionTaken: true } : markInteraction(recruitedState);
  return log(finished, gladeFamiliar ? `你在魔法林地召来「${unit.name}」；这不是当地互动，但使用了本回合行动。` : cell.site === "refugeeCamp" ? `「${unit.name}」加入你的队伍；只要仍有影响力与指挥位，你可以继续本次难民营互动。` : `「${unit.name}」加入你的队伍；你仍可在同一次互动中继续购买。`);
}

function replaceFamiliarCrystal(state: GameState, unitId: string, color: BasicManaColor): GameState {
  if (state.phase !== "tactic" || state.crystals[color] <= 0) return state;
  const unit = state.units.find((item) => item.id === unitId);
  if (!unit || getUnit(unit.id)?.id !== "magicFamiliars" || !unit.needsFamiliarCrystal) return state;
  return log({ ...state, crystals: { ...state.crystals, [color]: state.crystals[color] - 1 }, units: state.units.map((item) => item.id === unitId ? { ...item, familiarCrystal: color, needsFamiliarCrystal: false } : item) }, `为魔法使魔放置了 1 枚${color}色水晶。`);
}

function dismissUnit(state: GameState, unitId: string): GameState {
  const unit = state.units.find((item) => item.id === unitId);
  if (!unit || state.phase !== "tactic" || !unit.needsFamiliarCrystal) return state;
  return log({ ...state, units: state.units.filter((item) => item.id !== unitId), discard: unit.banner ? [...state.discard, unit.banner.instanceId] : state.discard }, `「${getUnit(unitId)?.name ?? "盟军"}」离开了队伍${unit.banner ? "；其旗帜进入弃牌堆" : ""}。`);
}

export function canBuyTier(state: GameState, tier: "advanced" | "spell") {
  const cell = currentSite(state);
  if (!cell || state.phase !== "planning" || !canContinueInteraction(state) || !localsWillInteract(state)) return false;
  if (tier === "advanced") return (cell.site === "monastery" && !cell.conquered) || ((cell.site === "city1" || cell.site === "city2") && cell.conquered);
  return (cell.site === "mageTower" && cell.conquered) || ((cell.site === "city1" || cell.site === "city2") && cell.conquered);
}

function buyCard(state: GameState, cardId: string, tier: "advanced" | "spell"): GameState {
  const cell = currentSite(state);
  const buyingFromMonastery = tier === "advanced" && cell?.site === "monastery";
  const offer = tier === "spell" ? state.spellOffer : buyingFromMonastery ? state.monasteryOffer : state.advancedOffer;
  const card = ALL_CARD_DEFS[cardId];
  if (!card || !offer.includes(cardId) || !canBuyTier(state, tier)) return state;
  const manaUse = tier === "spell" ? findMana(state, card.color) : undefined;
  if (tier === "spell" && !manaUse) return log(state, `学习「${card.name}」还需要一份${card.color}色魔力。`);
  const cost = influenceCost(state, card.cost ?? 6);
  const paid = spend(state, "influence", cost);
  if (!paid) return log(state, `学习「${card.name}」需要 ${cost} 点影响力。`);
  const paidWithMana: GameState = manaUse ? {
    ...paid,
    crystals: manaUse.type === "crystal" && manaUse.color && isBasicManaColor(manaUse.color) ? { ...paid.crystals, [manaUse.color]: paid.crystals[manaUse.color] - 1 } : paid.crystals,
    manaTokens: manaUse.type === "token" && manaUse.color ? { ...paid.manaTokens, [manaUse.color]: paid.manaTokens[manaUse.color] - 1 } : paid.manaTokens,
    wildManaTokens: manaUse.type === "wild" ? Math.max(0, (paid.wildManaTokens ?? 0) - 1) : paid.wildManaTokens,
    marketManaUses: [...paid.marketManaUses, manaUse],
  } : paid;
  if (buyingFromMonastery) {
    return log(markInteraction({
      ...paidWithMana,
      monasteryOffer: paidWithMana.monasteryOffer.filter((id) => id !== cardId),
      deck: [uid(cardId, paidWithMana), ...paidWithMana.deck],
    }), `在修道院学会了「${card.name}」，新牌置于牌库顶；你仍可继续这次互动。`);
  }
  const deckKey = tier === "advanced" ? "advancedDeck" : "spellDeck";
  const offerKey = tier === "advanced" ? "advancedOffer" : "spellOffer";
  const nextDeck = paidWithMana[deckKey];
  const replacement = nextDeck[0];
  return log(markInteraction({
    ...paidWithMana,
    [deckKey]: replacement ? nextDeck.slice(1) : nextDeck,
    [offerKey]: [...offer.filter((id) => id !== cardId), ...(replacement ? [replacement] : [])],
    deck: [uid(cardId, paidWithMana), ...paidWithMana.deck],
  }), `学会了「${card.name}」，新牌置于牌库顶；你仍可继续这次互动。`) as GameState;
}

function healWithInfluence(state: GameState): GameState {
  const cell = currentSite(state);
  if (!cell || state.phase !== "planning" || !canContinueInteraction(state) || (cell.site !== "village" && !(cell.site === "monastery" && !cell.conquered) && !((cell.site === "city1" || cell.site === "city2") && cell.conquered))) return state;
  if (!localsWillInteract(state)) return log(state, "你的声誉已落到 X，居民拒绝提供治疗。");
  const handIndex = state.hand.findIndex((id) => id.startsWith("wound#"));
  const discardIndex = state.discard.findIndex((id) => id.startsWith("wound#"));
  if (handIndex < 0 && discardIndex < 0) return state;
  const cost = influenceCost(state, cell.site === "monastery" ? 2 : 3);
  const paid = spend(state, "influence", cost);
  if (!paid) return log(state, `治疗一张伤势需要 ${cost} 点影响力。`);
  if (handIndex >= 0) return log(markInteraction({ ...paid, hand: paid.hand.filter((_, index) => index !== handIndex), woundDeck: [...paid.woundDeck, paid.hand[handIndex]] }), "当地治疗师移除了一张手牌中的伤势；你仍可继续这次互动。 ");
  return log(markInteraction({ ...paid, discard: paid.discard.filter((_, index) => index !== discardIndex), woundDeck: [...paid.woundDeck, paid.discard[discardIndex]] }), "当地治疗师移除了一张弃牌堆中的伤势；你仍可继续这次互动。 ");
}

function dummyAdvance(state: GameState, opening = false): GameState {
  const color = BASIC_COLORS[Math.floor(Math.random() * BASIC_COLORS.length)];
  let count = 3 + state.dummyCrystals[color];
  if (state.dummySlowAvailable) count = Math.max(1, count - 2);
  const remaining = Math.max(0, state.dummyDeck - count);
  const next = {
    ...state,
    dummyDeck: remaining,
    dummySlowAvailable: false,
    finalTurn: remaining === 0 ? true : state.finalTurn,
  };
  return log(next, `${opening ? "虚拟玩家抢先行动" : "虚拟玩家推进"}：翻开 ${count} 张牌（末张为${color}色），还剩 ${remaining} 张。${remaining === 0 ? " 你还有最后一回合。" : ""}`);
}

function refreshOffer(offer: string[], deck: string[]) {
  const replacement = deck[0];
  return {
    offer: [...offer.slice(1), ...(replacement ? [replacement] : [])],
    deck: replacement ? deck.slice(1) : deck,
    removed: offer[0],
  };
}

function endRound(state: GameState, forfeited = false): GameState {
  if (state.round >= 6) return finishGame(state, state.conqueredCities >= 2 ? "victory" : "defeat");
  const nextRound = state.round + 1;
  const nextTime = state.time === "day" ? "night" : "day";
  const allCards = [...state.hand, ...state.deck, ...state.discard, ...(state.roundSetAsideCards ?? []), ...state.played.map((item) => item.instanceId)];
  const shuffled = shuffle(allCards);
  const initialState = { ...state, fame: state.fame };
  const nextLimit = handLimit(initialState);
  const drawn = drawFrom(shuffled, [], nextLimit);
  const returnedMonasteryCards = [...state.advancedDeck, ...state.monasteryOffer];
  const advanced = refreshOffer(state.advancedOffer, returnedMonasteryCards);
  const monasteryCount = state.map.filter((cell) => cell.revealed && cell.site === "monastery" && !cell.conquered).length;
  const monasteryOffer = advanced.deck.slice(0, monasteryCount);
  const advancedDeck = advanced.deck.slice(monasteryCount);
  const spell = refreshOffer(state.spellOffer, state.spellDeck);
  const regularUnitDeck = shuffle([
    ...state.regularUnitDeck,
    ...state.unitOffer.filter((id) => getUnit(id)?.tier !== "elite"),
  ]);
  const eliteUnitDeck = shuffle([
    ...state.eliteUnitDeck,
    ...state.unitOffer.filter((id) => getUnit(id)?.tier === "elite"),
  ]);
  const coreRevealed = state.mapTiles.some((tile) => tile.kind === "core-city" || tile.kind === "core-noncity");
  const unitOffer: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const preferElite = coreRevealed && index % 2 === 0;
    const source = preferElite ? eliteUnitDeck : regularUnitDeck;
    const fallback = preferElite ? regularUnitDeck : eliteUnitDeck;
    const picked = source.shift() ?? fallback.shift();
    if (picked) unitOffer.push(picked);
  }
  const crystalColor = spell.removed ? ALL_CARD_DEFS[spell.removed]?.color : undefined;
  const dummyCrystals = { ...state.dummyCrystals };
  if (crystalColor && crystalColor !== "gold" && crystalColor !== "black") dummyCrystals[crystalColor] += 1;
  let next: GameState = {
    ...state,
    round: nextRound,
    time: nextTime,
    phase: "tactic",
    hand: drawn.hand,
    deck: drawn.deck,
    discard: [],
    played: [],
    spent: cloneResources(),
    turnBonus: cloneResources(),
    source: rollSource(3, nextTime),
    marketManaUses: [],
    unitManaUses: [],
    manaTokens: { ...EMPTY_MANA_TOKENS },
    wildManaTokens: 0,
    allUnitResistances: false,
    allUnitsGloryThisTurn: false,
    terrainDiscounts: [],
    physicalResistanceUnitIds: [],
    skillUsesThisTurn: [],
    skillUsesThisRound: [],
    flippedSkills: [],
    skillTurnResources: {},
    ignoreReputationThisTurn: false,
    skillTerrainDiscount: 0,
    manaOverloadColor: undefined,
    ritualPainReady: false,
    howlPackReady: false,
    howlCombatReady: false,
    sourceOpeningReady: false,
    extraSourceUsesThisTurn: 0,
    units: state.units.map((unit) => ({ ...unit, used: false, selectedAbilityId: undefined, usedAbilityIds: [], familiarCrystal: getUnit(unit.id)?.id === "magicFamiliars" ? undefined : unit.familiarCrystal, needsFamiliarCrystal: getUnit(unit.id)?.id === "magicFamiliars", banner: unit.banner ? { ...unit.banner, faceUp: true } : undefined })),
    advancedOffer: advanced.offer,
    advancedDeck,
    monasteryOffer,
    spellOffer: spell.offer,
    spellDeck: spell.deck,
    unitOffer,
    regularUnitDeck,
    eliteUnitDeck,
    selectedTactic: undefined,
    dummyTactic: undefined,
    dummyDeck: 16 + nextRound - 1,
    dummyCrystals,
    dummySlowAvailable: false,
    finalTurn: false,
    actionTaken: false,
    interactionSite: undefined,
    interactionModifierUsed: false,
    interactionReputationMode: undefined,
    refugeeCampRecruitUsed: false,
    mazeArrivalMoveCarryover: undefined,
    recruitedUnitIdsThisTurn: [],
    woundsReceivedThisTurn: [],
    goldenGrailHealingSpent: 0,
    turnDiscardCount: 0,
    combat: undefined,
    roundSetAsideCards: [],
  };
  next = { ...next, map: revealVisibleTokens(next.map, next.position, next.time) };
  next = log(next, `${forfeited ? "你主动结束了本轮。" : "本轮结束。"} ${nextTime === "day" ? "天色破晓" : "夜幕降临"}，第 ${nextRound} 轮开始。`);
  return next;
}

function finishGame(state: GameState, result: "victory" | "defeat"): GameState {
  return log({ ...state, phase: "gameover", result, combat: undefined }, result === "victory" ? "征服完成。两座城市都已归于议会旗帜之下。" : "六轮耗尽，王都仍未完全征服。任务失败。 ");
}

function endTurn(state: GameState): GameState {
  if (state.phase === "combat" || state.phase === "tactic" || state.phase === "skill" || state.phase === "gameover") return state;
  if (!state.played.length && !state.actionTaken && !Object.values(state.spent).some(Boolean) && !(state.turnDiscardCount ?? 0)) {
    return log(state, "结束回合前至少要打出或弃掉 1 张牌；若手中有伤势，也可以选择休整。 ");
  }
  const endingCell = currentSite(state);
  if (endingCell?.site === "deepMine" && (endingCell.mineColors?.length ?? 0) > 1 && !endingCell.mineColors?.includes(state.selectedMineColor as BasicManaColor)) {
    return log(state, "结束回合前，请先在地点面板选择深层矿井要开采的水晶颜色。");
  }
  let next = state;
  const threatPenalty = next.played.filter((play) => play.mode === "powered" && cardBaseId(play.instanceId) === "threaten").length;
  if (threatPenalty) next = { ...next, reputation: Math.max(-5, next.reputation - threatPenalty) };
  const nobleManners = next.interactionSite ? next.played.filter((play) => getCard(play.instanceId)?.id === "nobleManners" && play.mode !== "sideways") : [];
  if (nobleManners.length) {
    const powered = nobleManners.filter((play) => play.mode === "powered").length;
    next = { ...next, fame: next.fame + nobleManners.length, reputation: Math.min(5, next.reputation + powered) };
  }
  if (next.played.some((play) => getCard(play.instanceId)?.id === "crystalMastery" && play.mode === "powered")) {
    const returned = { ...next.crystals };
    allManaUses(next).forEach((use) => {
      if (use.type === "crystal" && use.color && isBasicManaColor(use.color)) returned[use.color] = Math.min(3, returned[use.color] + 1);
    });
    next = { ...next, crystals: returned };
  }
  const cell = currentSite(next);
  if ((cell?.site === "mine" || cell?.site === "deepMine") && (cell.mineColor || next.selectedMineColor)) {
    const mineColor = cell.site === "deepMine" ? (next.selectedMineColor ?? cell.mineColor)! : cell.mineColor!;
    next = { ...next, crystals: { ...next.crystals, [mineColor]: Math.min(3, next.crystals[mineColor] + 1) } };
  }
  if (cell?.site === "glade" || cell?.site === "hiddenValley") {
    const handWound = next.hand.findIndex((id) => id.startsWith("wound#"));
    if (handWound >= 0) next = { ...next, hand: next.hand.filter((_, index) => index !== handWound), woundDeck: [...next.woundDeck, next.hand[handWound]] };
    else {
      const discardWound = next.discard.findIndex((id) => id.startsWith("wound#"));
      if (discardWound >= 0) next = { ...next, discard: next.discard.filter((_, index) => index !== discardWound), woundDeck: [...next.woundDeck, next.discard[discardWound]] };
    }
  }
  const playedIds = next.played.flatMap((play) => [play.instanceId, ...(play.linkedCard ? [play.linkedCard.instanceId] : [])]);
  const assignedBannerIds = new Set(next.units.flatMap((unit) => unit.banner ? [unit.banner.instanceId] : []));
  const removedArtifactPlays = next.played.filter((play) => play.mode === "powered" && getCard(play.instanceId)?.tier === "artifact");
  const removedArtifactIds = new Set([
    ...removedArtifactPlays.map((play) => play.instanceId),
    ...next.played.flatMap((play) => play.linkedCard?.removeAtTurnEnd ? [play.linkedCard.instanceId] : []),
  ]);
  const steadyTempo = next.played.find((play) => getCard(play.instanceId)?.id === "steadyTempo" && play.mode !== "sideways");
  const timeBending = next.played.find((play) => getCard(play.instanceId)?.id === "spaceBending" && play.mode === "powered");
  const meditationDrawBonus = next.played.filter((play) => getCard(play.instanceId)?.id === "meditation" && play.mode !== "sideways").length * 2;
  const mountainLore = next.played.find((play) => getCard(play.instanceId)?.id === "mountainLore" && play.mode !== "sideways");
  const currentTerrain = next.map.find((cell) => cell.id === next.position)?.terrain;
  const mountainDrawBonus = mountainLore && (currentTerrain === "hills" || (mountainLore.mode === "powered" && currentTerrain === "mountain"))
    ? currentTerrain === "mountain" ? 2 : 1
    : 0;
  const steadyTempoReturnsToDeck = Boolean(steadyTempo && (steadyTempo.mode === "powered" || next.deck.length > 0));
  const deckPlacementIds = new Set(steadyTempoReturnsToDeck && steadyTempo ? [steadyTempo.instanceId] : []);
  const artifactInventory = [...next.artifactInventory];
  removedArtifactPlays.forEach((play) => {
    const name = getCard(play.instanceId)?.name;
    const index = name ? artifactInventory.indexOf(name) : -1;
    if (index >= 0) artifactInventory.splice(index, 1);
  });
  let cleaned: GameState = {
    ...next,
    hand: timeBending
      ? [...next.hand.filter((id) => !playedIds.includes(id)), ...playedIds.filter((id) => id !== timeBending.instanceId && !removedArtifactIds.has(id))]
      : next.hand.filter((id) => !playedIds.includes(id)),
    discard: timeBending ? next.discard : [...next.discard, ...playedIds.filter((id) => !removedArtifactIds.has(id) && !deckPlacementIds.has(id) && !assignedBannerIds.has(id))],
    deck: steadyTempo
      ? steadyTempo.mode === "powered"
        ? [steadyTempo.instanceId, ...next.deck]
        : next.deck.length > 0 ? [...next.deck, steadyTempo.instanceId] : next.deck
      : next.deck,
    removedCards: [...next.removedCards, ...removedArtifactIds],
    roundSetAsideCards: timeBending ? [...(next.roundSetAsideCards ?? []), timeBending.instanceId] : (next.roundSetAsideCards ?? []),
    artifacts: Math.max(0, next.artifacts - removedArtifactPlays.length),
    artifactInventory,
    played: [],
    spent: cloneResources(),
    turnBonus: cloneResources(),
    marketManaUses: [],
    unitManaUses: [],
    manaTokens: { ...EMPTY_MANA_TOKENS },
    wildManaTokens: 0,
    allUnitResistances: false,
    allUnitsGloryThisTurn: false,
    terrainDiscounts: [],
    physicalResistanceUnitIds: [],
    skillUsesThisTurn: [],
    skillTurnResources: {},
    ignoreReputationThisTurn: false,
    skillTerrainDiscount: 0,
    manaOverloadColor: undefined,
    ritualPainReady: false,
    howlPackReady: false,
    howlCombatReady: false,
    sourceOpeningReady: false,
    extraSourceUsesThisTurn: 0,
    actionTaken: false,
    interactionSite: undefined,
    interactionModifierUsed: false,
    interactionReputationMode: undefined,
    refugeeCampRecruitUsed: false,
    selectedMineColor: undefined,
    mazeArrivalMoveCarryover: undefined,
    recruitedUnitIdsThisTurn: [],
    woundsReceivedThisTurn: [],
    goldenGrailHealingSpent: 0,
    turnsTaken: next.turnsTaken + 1,
    turnDiscardCount: 0,
  };
  if (timeBending) return log(grantStartOfTurnSiteMana(cleaned), "时间扭曲：本牌移出本轮，其余已打出的牌回到手中；跳过补牌并立即开始额外回合。 ");
  const drawn = drawFrom(cleaned.deck, cleaned.hand, Math.max(0, handLimit(cleaned) + meditationDrawBonus + mountainDrawBonus - cleaned.hand.length));
  cleaned = { ...cleaned, ...drawn };
  if (cleaned.missionCountdown > 0) {
    const countdown = cleaned.missionCountdown - 1;
    cleaned = { ...cleaned, missionCountdown: countdown };
    if (countdown === 0) return finishGame(cleaned, "victory");
    return log(grantStartOfTurnSiteMana(cleaned), "虚拟玩家停止行动。现在开始你征服两城后的最后一个完整回合。 ");
  }
  if (cleaned.finalTurn) return endRound(cleaned);
  return dummyAdvance(grantStartOfTurnSiteMana(cleaned));
}

export function scoreGame(state: GameState) {
  const allCards = [...state.hand, ...state.deck, ...state.discard];
  const knowledgeScore = allCards.reduce((sum, id) => {
    const tier = getCard(id)?.tier;
    return sum + (tier === "spell" ? 2 : tier === "advanced" ? 1 : 0);
  }, 0);
  const crystalScore = Math.floor(Object.values(state.crystals).reduce((a, b) => a + b, 0) / 2);
  const woundPenalty = woundCount(state) * 2;
  const cityScore = state.conqueredCities * 10 + (state.conqueredCities >= 2 ? 15 : 0);
  const early = state.result === "victory" ? Math.max(0, 6 - state.round) * 30 : 0;
  const adventureScore = state.map.filter((cell) => cell.conquered && (["ruins", "monsterDen", "tomb", "spawningGrounds", "maze", "labyrinth", "graveyard", "necropolis", "hiddenValley", "volkareCamp"] as SiteType[]).includes(cell.site)).length * 2;
  const conquestScore = state.map.filter((cell) => cell.conquered && (cell.site === "keep" || cell.site === "mageTower" || cell.site === "monastery")).length * 2;
  const artifactScore = state.artifacts * 2;
  const factionScore = Object.values(state.factionTokens ?? {}).reduce((sum, count) => sum + count, 0);
  const leadershipScore = state.units.reduce((sum, unit) => {
    const level = getUnit(unit.id)?.level ?? 0;
    return sum + (unit.wounded ? Math.floor(level / 2) : level);
  }, 0);
  const dummyScore = state.result === "victory" ? state.dummyDeck : 0;
  const unannouncedBonus = state.result === "victory" && !state.finalTurn ? 5 : 0;
  const total = state.fame + adventureScore + conquestScore + artifactScore + factionScore + knowledgeScore + leadershipScore + crystalScore - woundPenalty + cityScore + early + dummyScore + unannouncedBonus;
  return {
    fame: state.fame,
    adventure: adventureScore,
    conquest: conquestScore,
    artifacts: artifactScore,
    factions: factionScore,
    knowledge: knowledgeScore,
    leadership: leadershipScore,
    crystals: crystalScore,
    wounds: -woundPenalty,
    cities: cityScore,
    early,
    dummy: dummyScore,
    unannounced: unannouncedBonus,
    total,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "CHOOSE_TACTIC": return chooseTactic(state, action.tacticId);
    case "CHOOSE_SKILL": return chooseSkill(state, action.skillId);
    case "CHOOSE_LEVEL_ADVANCED": return chooseLevelAdvanced(state, action.cardId);
    case "PLAY_CARD": return playCard(state, action);
    case "UNPLAY_CARD": return unplayCard(state, action.instanceId);
    case "DISCARD_CARD": return discardCard(state, action.instanceId);
    case "TOGGLE_UNIT": return toggleUnit(state, action.unitId);
    case "ACTIVATE_UNIT": return activateUnit(state, action.unitId, action.abilityId, action.manaColors, action.enemyId);
    case "ACTIVATE_SKILL": return activateSkill(state, action);
    case "USE_BANNER": return activateBanner(state, action.unitId, action.enemyId);
    case "MAP_CLICK": return revealOrMove(state, action.cellId);
    case "EXPLORE_TILE": return exploreTile(state, action.tq, action.tr);
    case "ENTER_ADVENTURE": return enterAdventure(state, action.moveSpend, action.accompanyingUnitId, action.rewardCrystalColors);
    case "SELECT_MINE_COLOR": return selectMineColor(state, action.color);
    case "START_MULTI_COMBAT": return startMultiCombat(state, action.rampagerCellIds, action.assaultCellId);
    case "ADD_REGULAR_UNIT_TO_OFFER": return addRegularUnitToOffer(state);
    case "PURSUE_VOLKARE_ENEMIES": return pursueVolkareEnemies(state, action.colors);
    case "BURN_MONASTERY": return burnMonastery(state);
    case "COMBAT_ADVANCE": return advanceRangedPhase(state);
    case "COMBAT_RANGED": return combatRanged(state);
    case "COMBAT_BLOCK": return combatBlock(state);
    case "COMBAT_REDUCE_CUMBERSOME": return reduceCumbersomeAttack(state);
    case "COMBAT_DAMAGE": return combatDamage(state);
    case "ASSIGN_DAMAGE_UNIT": return assignDamageToUnit(state, action.unitId);
    case "COMBAT_ATTACK": return combatAttack(state);
    case "COMBAT_GROUP_ATTACK": return combatGroupAttack(state, action.enemyIds);
    case "ASSIGN_DEFEND": return assignDefend(state, action.defenderId, action.targetId);
    case "COMBAT_RETREAT": return combatRetreat(state);
    case "END_TURN": return endTurn(state);
    case "GAIN_CRYSTAL": return claimCrystal(state, action.color);
    case "USE_HEAL": return applyHeal(state);
    case "HEAL_UNIT": return healUnit(state, action.unitId);
    case "USE_DRAW": return applyDraw(state);
    case "REST": return rest(state);
    case "RECRUIT": return recruit(state, action.unitId, action.manaColor);
    case "REPLACE_FAMILIAR_CRYSTAL": return replaceFamiliarCrystal(state, action.unitId, action.color);
    case "DISMISS_UNIT": return dismissUnit(state, action.unitId);
    case "BUY_CARD": return buyCard(state, action.cardId, action.tier);
    case "HEAL_WITH_INFLUENCE": return healWithInfluence(state);
    case "REGENERATE_MAP": return regenerateMap(state);
    case "FORFEIT_ROUND": return state.phase === "planning" && state.deck.length === 0 ? endRound(state, true) : state;
    default: return state;
  }
}

export interface RevertHistoryEntry {
  state: GameState;
  label: string;
}

export interface RevertHistoryState {
  present: GameState;
  past: RevertHistoryEntry[];
  boundaryReason: string;
  lastReverted?: string;
}

export interface RevertClassification {
  kind: "unchanged" | "reversible" | "boundary";
  label: string;
  reason?: string;
}

const REVERT_HISTORY_LIMIT = 60;

/**
 * The physical rulebook allows decisions made during the current turn to be
 * taken back, but locks every earlier decision as soon as new information is
 * revealed, a die is rolled, or another player reacts. Challenging an already
 * revealed rampaging enemy and deterministic combat steps are reversible.
 * The same applies when a move deterministically
 * provokes an already-public rampaging enemy: combat is mandatory if the move
 * stands, but the move itself may still be taken back. Hidden information and
 * random results (including summons, loot and level-up choices) remain explicit
 * commitment points. Merely advancing a combat phase reveals nothing new.
 */
export function createRevertHistory(
  present: GameState,
  boundaryReason = "远征刚刚开始；当前还没有可撤回的操作。",
): RevertHistoryState {
  return { present, past: [], boundaryReason };
}

function differsOnlyByLog(before: GameState, after: GameState) {
  return (Object.keys(before) as Array<keyof GameState>).every((key) => key === "log" || before[key] === after[key]);
}

function enemyInformationWasAlreadyPublic(before: GameState, cell: MapCell) {
  if (!cell.revealed) return false;
  if (cell.tokenRevealed) return true;
  if (cell.site === "rampager" || cell.site === "dragon") return true;
  if (cell.site === "ruins" && before.time === "day") return true;
  const current = before.map.find((candidate) => candidate.id === before.position);
  if (before.time === "day" && current && (cell.site === "keep" || cell.site === "mageTower") && isAdjacent(current, cell)) return true;
  if (current && (cell.site === "city1" || cell.site === "city2") && isAdjacent(current, cell)) return true;
  return cell.id === before.position;
}

function revealedMapInformationLabel(cell: MapCell) {
  if (cell.site === "ruins" && cell.ruinTokenId) {
    return `${SITE_LABELS[cell.site]}「${ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId]?.name ?? "黄色遗迹标记"}」`;
  }
  const enemies = enemiesOnCell(cell);
  if (enemies.length) return `${SITE_LABELS[cell.site]}${enemies.map((enemy) => `「${enemy.name}」`).join("、")}`;
  return `${cell.site === "none" ? cell.terrain : SITE_LABELS[cell.site]}（${cell.id}）`;
}

function newlyRevealedMapInformation(before: GameState, after: GameState) {
  const previous = new Map(before.map.map((cell) => [cell.id, cell]));
  const revealed: string[] = [];
  after.map.forEach((cell) => {
    const old = previous.get(cell.id);
    if (!old) {
      revealed.push(revealedMapInformationLabel(cell));
      return;
    }
    const newMapCell = !old.revealed && cell.revealed;
    const newToken = !old.tokenRevealed && Boolean(cell.tokenRevealed) && !enemyInformationWasAlreadyPublic(before, old);
    const newRuin = !old.ruinTokenId && Boolean(cell.ruinTokenId);
    const newEnemies = enemiesOnCell(old).length < enemiesOnCell(cell).length;
    if (newMapCell || newToken || newRuin || newEnemies) revealed.push(revealedMapInformationLabel(cell));
  });
  return [...new Set(revealed)];
}

function revertActionLabel(action: GameAction, before: GameState, after: GameState) {
  switch (action.type) {
    case "MAP_CLICK": {
      if (after.combat?.kind === "rampager" && before.phase === "planning") {
        return `主动挑战「${after.combat.enemy.name}」`;
      }
      if (after.combat?.kind === "provoked" && before.phase === "planning") {
        return `移动并激怒「${after.combat.enemy.name}」`;
      }
      const target = after.map.find((cell) => cell.id === after.position);
      return target ? `移动至${target.site === "none" ? target.terrain : SITE_LABELS[target.site]}` : "地图移动";
    }
    case "START_MULTI_COMBAT": return action.assaultCellId ? "规划并发动多敌人强攻" : "主动挑战多支游荡敌人";
    case "COMBAT_GROUP_ATTACK": return "结算合并攻击组";
    case "COMBAT_ADVANCE": return "跳过当前敌人的远程攻击";
    case "COMBAT_RANGED": return "结算远程或攻城攻击";
    case "COMBAT_BLOCK": return "结算当前敌人的格挡";
    case "COMBAT_DAMAGE": return before.combat?.step === "block" ? "选择承受伤害" : "分配英雄承伤";
    case "ASSIGN_DAMAGE_UNIT": return `分配「${getUnit(action.unitId)?.name ?? "盟军"}」承伤`;
    case "COMBAT_ATTACK": return "结算近战攻击";
    case "COMBAT_RETREAT": return "战斗撤退";
    case "ASSIGN_DEFEND": return "分配敌人的防卫能力";
    case "ADD_REGULAR_UNIT_TO_OFFER": return "扩充营地盟军供应";
    case "PURSUE_VOLKARE_ENEMIES": return "在沃尔卡雷营地周边追猎";
    case "SELECT_MINE_COLOR": return `选择开采${action.color}色水晶`;
    case "PLAY_CARD": return `打出「${getCard(action.instanceId)?.name ?? "行动牌"}」`;
    case "UNPLAY_CARD": return `收回「${getCard(action.instanceId)?.name ?? "行动牌"}」`;
    case "DISCARD_CARD": return `弃置「${getCard(action.instanceId)?.name ?? "行动牌"}」`;
    case "TOGGLE_UNIT": return `调整「${getUnit(action.unitId)?.name ?? "盟军"}」状态`;
    case "ACTIVATE_UNIT": return `发动「${getUnit(action.unitId)?.name ?? "盟军"}」能力`;
    case "USE_BANNER": return `发动「${getUnit(action.unitId)?.name ?? "盟军"}」装备的旗帜`;
    case "COMBAT_REDUCE_CUMBERSOME": return "用移动降低笨重攻击";
    case "GAIN_CRYSTAL": return `凝结${action.color}色水晶`;
    case "USE_HEAL": return "治疗英雄伤势";
    case "HEAL_UNIT": return `治疗「${getUnit(action.unitId)?.name ?? "盟军"}」`;
    case "REST": return "休整";
    case "RECRUIT": return `招募「${getUnit(action.unitId)?.name ?? "盟军"}」`;
    case "BUY_CARD": return `学习「${ALL_CARD_DEFS[action.cardId]?.name ?? "卡牌"}」`;
    case "HEAL_WITH_INFLUENCE": return "向当地治疗师求助";
    case "CHOOSE_SKILL": return `选择「${getSkill(action.skillId)?.name ?? "英雄技能"}」`;
    case "ENTER_ADVENTURE": {
      const cell = currentSite(before);
      const ruin = cell?.site === "ruins" && cell.ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId] : undefined;
      return ruin?.altarColor ? `祭拜「${ruin.name}」` : `进入「${cell ? SITE_LABELS[cell.site] : "冒险地点"}」`;
    }
    default: return before.phase === "combat" ? "调整战斗准备" : "调整本回合操作";
  }
}

function boundaryReason(action: GameAction, before: GameState, after: GameState) {
  switch (action.type) {
    case "MAP_CLICK": {
      const revealed = newlyRevealedMapInformation(before, after);
      if (revealed.length) {
        return `这次移动公开了新信息：${revealed.join("、")}；公开前的操作已经锁定。`;
      }
      if (after.phase === "combat" && after.combat !== before.combat) {
        if (after.combat?.kind === "assault") return "你已进入防御工事并发动强攻；战斗前的操作已经锁定。";
        return "你已主动挑战敌人；战斗前的操作已经锁定。";
      }
      return "这次移动没有可安全恢复的历史状态。";
    }
    case "START_MULTI_COMBAT": {
      const revealed = newlyRevealedMapInformation(before, after);
      if (revealed.length) return `这次强攻公开了新信息：${revealed.join("、")}；公开前的操作已经锁定。`;
      return "已公开敌人的战斗尚未结算；可以撤回本次挑战或强攻。";
    }
    case "EXPLORE_TILE": return "探索公开了新的七格地图板块、地点与标记；不能回到探索前。";
    case "ENTER_ADVENTURE": {
      const cell = currentSite(before);
      const ruin = cell?.site === "ruins" && cell.ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId] : undefined;
      return ruin?.altarColor && after.phase === "skill"
        ? "祭坛奖励令英雄升级并公开了新的技能选择；祭拜前的操作已经锁定。"
        : "你已宣布进入冒险地点并公开了遭遇内容；进入前的操作已经锁定。";
    }
    case "BURN_MONASTERY": return "焚烧修道院会降低声誉并随机抽取守卫；此前操作已经锁定。";
    case "CHOOSE_TACTIC": return "选择战术后，虚拟玩家随机选择并可能立即推进；不能回到选择前。";
    case "CHOOSE_LEVEL_ADVANCED": return "升级奖励刷新了公开进阶行动供应；不能回到新卡公开前。";
    case "USE_DRAW": return "抽牌公开了牌库中的新信息；抽牌前的操作已经锁定。";
    case "BUY_CARD": return "购买后公开了新的供应卡；购买前的操作已经锁定。";
    case "ADD_REGULAR_UNIT_TO_OFFER": return "扩充盟军供应公开了一张新的普通盟军；公开前的操作已经锁定。";
    case "PURSUE_VOLKARE_ENEMIES": return "追猎公开了新的敌人标记；公开前的操作已经锁定。";
    case "END_TURN": return "结束回合会补牌并随机推进虚拟玩家；上一回合已经锁定。";
    case "FORFEIT_ROUND": return "进入新一轮会洗牌、刷新供应并重掷源泉；上一轮已经锁定。";
    case "REGENERATE_MAP": return "重新生成地图会随机创建新的板块牌库；旧预览已经锁定。";
    default: return "新的公开信息或结算结果已经产生；此前操作已经锁定。";
  }
}

/** Compare actual information changes, not the name of a combat command.
 * Wound tokens and face-up enemy discards are known; drawing a new enemy,
 * receiving hidden loot or exposing a replacement offer is not. */
function combatInformationBoundary(before: GameState, action: GameAction, after: GameState): string | undefined {
  if (!before.combat) return undefined;
  const changed = (a: readonly string[], b: readonly string[]) => a.length !== b.length || a.some((id, i) => id !== b[i]);
  // A recycled one-token pile can be empty both before and after the draw.
  // prepareSummonedAttack creates a new summoner encounter for every draw,
  // including repeated attacks which happen to draw the very same token.
  const summoned = after.combat?.summonedTokenId
    && (before.combat.summonedTokenId !== after.combat.summonedTokenId || before.combat.summoner !== after.combat.summoner);
  if (summoned || ENEMY_COLORS.some((color) => changed(before.enemyDecks[color], after.enemyDecks[color]))) {
    return "战斗抽取了新的敌人标记（召唤或地点补充）；不能回到标记公开之前。";
  }
  if (newlyRevealedMapInformation(before, after).length) return "战斗公开了新的地图或敌人信息；公开前的操作已经锁定。";
  if (after.hand.some((id) => !before.hand.includes(id) && before.deck.includes(id) && !id.startsWith("wound#"))) {
    return "战斗中抽牌公开了牌库的新信息；不能回到抽牌之前。";
  }
  if (changed(before.artifactDeck, after.artifactDeck)) return "战斗奖励公开了新的圣器；不能回到奖励公开之前。";
  const offers = ["advancedOffer", "spellOffer", "unitOffer", "monasteryOffer"] as const;
  if (offers.some((key) => after[key].some((id) => !before[key].includes(id)))) {
    return "战斗奖励刷新供应并公开了新卡牌；不能回到供应公开之前。";
  }
  if (changed(before.pendingSkillChoices, after.pendingSkillChoices) && after.pendingSkillChoices.length) {
    return "战斗奖励令英雄升级并随机公开了技能选择；不能回到技能公开之前。";
  }
  const randomReward = before.map.some((cell) => !cell.conquered && after.map.some((next) => next.id === cell.id && next.conquered)
    && (["monsterDen", "dungeon", "spawningGrounds"].includes(cell.site) || (cell.site === "ruins" && cell.ruinsReward === "crystals")));
  if (randomReward) return "战斗结算产生了掷骰或随机水晶奖励；不能回到随机结果公开之前。";
  const rerolledCard = action.type === "PLAY_CARD" && action.mode !== "sideways"
    && (action.mode === "powered" ? getCard(action.instanceId)?.powered : getCard(action.instanceId)?.basic)?.special === "mana-storm";
  const rerolledSkill = action.type === "ACTIVATE_SKILL" && getSkill(action.skillId)?.special === "source-opening";
  if (rerolledCard || rerolledSkill) return "战斗中重掷了源泉骰；不能回到掷骰之前，即使骰面没有改变。";
  return undefined;
}

export function classifyRevertTransition(before: GameState, action: GameAction, after: GameState): RevertClassification {
  if (before === after || differsOnlyByLog(before, after)) {
    return { kind: "unchanged", label: "没有产生可撤回的状态变化" };
  }
  const combatInformation = combatInformationBoundary(before, action, after);
  if (combatInformation) return { kind: "boundary", label: revertActionLabel(action, before, after), reason: combatInformation };

  const movementReveals = action.type === "MAP_CLICK" || action.type === "START_MULTI_COMBAT" ? newlyRevealedMapInformation(before, after) : [];
  const combatStartAction = action.type === "MAP_CLICK" || action.type === "START_MULTI_COMBAT";
  const reversibleKnownCombatStart = combatStartAction
    && after.phase === "combat"
    && after.combat !== before.combat
    && movementReveals.length === 0;
  const combatBoundary = combatStartAction
    && after.phase === "combat"
    && after.combat !== before.combat
    && !reversibleKnownCombatStart;
  const revealedByMovement = movementReveals.length > 0;
  const refreshedMarket = action.type === "BUY_CARD"
    && (before.advancedDeck !== after.advancedDeck || before.spellDeck !== after.spellDeck);
  const adventureCell = action.type === "ENTER_ADVENTURE" ? currentSite(before) : undefined;
  const adventureRuin = adventureCell?.site === "ruins" && adventureCell.ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[adventureCell.ruinTokenId] : undefined;
  const deterministicAltar = action.type === "ENTER_ADVENTURE" && Boolean(adventureRuin?.altarColor) && after.phase !== "skill";
  const fixedBoundaries: GameAction["type"][] = [
    "CHOOSE_TACTIC",
    "CHOOSE_LEVEL_ADVANCED",
    "EXPLORE_TILE",
    "ENTER_ADVENTURE",
    "BURN_MONASTERY",
    "END_TURN",
    "USE_DRAW",
    "ADD_REGULAR_UNIT_TO_OFFER",
    "PURSUE_VOLKARE_ENEMIES",
    "REGENERATE_MAP",
    "FORFEIT_ROUND",
  ];
  if (combatBoundary || revealedByMovement || refreshedMarket || (fixedBoundaries.includes(action.type) && !deterministicAltar)) {
    return { kind: "boundary", label: revertActionLabel(action, before, after), reason: boundaryReason(action, before, after) };
  }

  return { kind: "reversible", label: revertActionLabel(action, before, after) };
}

export function applyGameActionWithRevert(history: RevertHistoryState, action: GameAction): RevertHistoryState {
  const next = gameReducer(history.present, action);
  const classification = classifyRevertTransition(history.present, action, next);
  if (classification.kind === "unchanged") return { ...history, present: next };
  if (classification.kind === "boundary") {
    return {
      // Direct card-unplay must not bypass the same information boundary.
      present: { ...next, played: next.played.map((play) => ({ ...play, lockedByCombat: true })) },
      past: [],
      boundaryReason: classification.reason ?? history.boundaryReason,
    };
  }
  return {
    ...history,
    present: next,
    past: [...history.past, { state: history.present, label: classification.label }].slice(-REVERT_HISTORY_LIMIT),
    lastReverted: undefined,
  };
}

export function revertLastAction(history: RevertHistoryState): RevertHistoryState {
  const entry = history.past.at(-1);
  if (!entry) return history;
  const present = log(entry.state, `已撤回：${entry.label}。`);
  return {
    ...history,
    present,
    past: history.past.slice(0, -1),
    lastReverted: entry.label,
  };
}

export function availableTactics(state: GameState): Tactic[] {
  return TACTICS.filter((tactic) => tactic.time === state.time && !state.usedTactics.includes(tactic.id));
}

export function usedSource(state: GameState, index: number) {
  return usedSourceIndices(state).has(index);
}
