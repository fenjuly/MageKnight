export type ManaColor = "red" | "blue" | "green" | "white" | "gold" | "black";

export type CombatElement = "physical" | "fire" | "ice" | "coldfire";

export type ContentMode = "base" | "ultimate";

export type ComponentSource = "base" | "lost-legion" | "krang" | "shades-of-tezla" | "dual-color";

export type ResourceKey =
  | "move"
  | "attack"
  | "fireAttack"
  | "iceAttack"
  | "coldfireAttack"
  | "block"
  | "fireBlock"
  | "iceBlock"
  | "coldfireBlock"
  | "range"
  | "fireRange"
  | "iceRange"
  | "coldfireRange"
  | "siege"
  | "fireSiege"
  | "iceSiege"
  | "coldfireSiege"
  | "influence"
  | "heal"
  | "draw"
  | "crystal";

export type ResourcePool = Record<ResourceKey, number>;

export type Terrain =
  | "portal"
  | "plains"
  | "forest"
  | "desert"
  | "hills"
  | "swamp"
  | "wasteland"
  | "lake"
  | "mountain"
  | "city";

export type SiteType =
  | "none"
  | "village"
  | "monastery"
  | "keep"
  | "mageTower"
  | "mine"
  | "glade"
  | "ruins"
  | "monsterDen"
  | "tomb"
  | "spawningGrounds"
  | "dungeon"
  | "maze"
  | "labyrinth"
  | "deepMine"
  | "refugeeCamp"
  | "graveyard"
  | "necropolis"
  | "hiddenValley"
  | "volkareCamp"
  | "rampager"
  | "dragon"
  | "city1"
  | "city2";

export interface CardEffect extends Partial<ResourcePool> {
  note?: string;
  /**
   * Non-numeric printed rule resolved by the engine.  Numeric points stay in
   * ResourcePool; targets, card-zone movement, delayed effects and map/combat
   * modifiers must be named here instead of being approximated by fake points.
   */
  special?: CardSpecialRule;
  /** Printed "or" branches. Exactly one branch is chosen when the card is played. */
  choices?: CardEffectChoice[];
}

export interface CardEffectChoice {
  label: string;
  effect: CardEffect;
}

export type CardSpecialRule =
  | "concentration"
  | "will-focus"
  | "noble-manners"
  | "mana-pull"
  | "blood-rage"
  | "intimidate"
  | "frost-bridge"
  | "song-of-wind"
  | "path-finding"
  | "blood-ritual"
  | "pure-magic"
  | "into-the-heat"
  | "steady-tempo"
  | "diplomacy"
  | "in-need"
  | "decompose"
  | "crystal-mastery"
  | "mana-storm"
  | "maximal-effect"
  | "magic-talent"
  | "training"
  | "underground-travel"
  | "burning-shield"
  | "chill"
  | "wings"
  | "demolish"
  | "space-bending"
  | "call-to-arms"
  | "meditation"
  | "mana-meltdown"
  | "mana-claim"
  | "banner-glory"
  | "banner-fear"
  | "banner-protection"
  | "banner-courage"
  | "elemental-ring"
  | "sword-justice"
  | "golden-grail"
  | "amulet-sun"
  | "amulet-darkness"
  | "savage-harvesting"
  | "ruthless-coercion"
  | "one-with-the-land"
  | "blood-of-ancients"
  | "shield-bash"
  | "spell-forge"
  | "chivalry"
  | "peaceful-moment"
  | "stout-resolve"
  | "force-of-nature"
  | "mountain-lore"
  | "offering"
  | "charm"
  | "cure"
  | "banner-command"
  | "banner-fortitude"
  | "circlet-proficiency"
  | "tome-all-spells"
  | "chilling-stare"
  | "mysterious-box";

export interface CardDef {
  id: string;
  name: string;
  color: ManaColor;
  tier: "basic" | "advanced" | "spell" | "artifact";
  basic: CardEffect;
  powered: CardEffect;
  basicLabel: string;
  poweredLabel: string;
  cost?: number;
  englishName?: string;
  /** Number of physical copies in the base-game box. */
  copies?: number;
  heroId?: string;
  source?: ComponentSource;
  /** Ultimate Edition dual-color cards may be powered by either printed color. */
  alternateColor?: Exclude<ManaColor, "gold" | "black">;
  /** A printed persistent modifier explicitly carries its combat bonus out of movement. */
  preserveCombatAfterMovement?: boolean;
  /** Extra ordinary Source dice this printed mode allows the player to use this turn. */
  additionalSourceUses?: Partial<Record<"basic" | "powered", number>>;
}

export type EnemyTokenColor = "green" | "red" | "gray" | "violet" | "brown" | "white";

export interface RuinToken {
  id: string;
  name: string;
  enemies: EnemyTokenColor[];
  reward: "artifact" | "spell" | "advanced" | "crystals" | "fame";
  altarColor?: Exclude<ManaColor, "gold" | "black">;
  description: string;
  source?: ComponentSource;
}

export interface Enemy {
  id: string;
  name: string;
  armor: number;
  attack: number;
  fame: number;
  fortified?: boolean;
  swift?: boolean;
  brutal?: boolean;
  poison?: boolean;
  tokenColor?: EnemyTokenColor;
  attackElement?: CombatElement;
  resistances?: CombatElement[];
  /** Intrinsic + site fortification; two levels cannot be targeted during the ranged phase. */
  fortificationLevel?: number;
  paralyze?: boolean;
  summon?: boolean;
  arcaneImmunity?: boolean;
  assassination?: boolean;
  /** Printed Defend value; it increases one enemy's Armor during a group combat. */
  defend?: number;
  cumbersome?: boolean;
  elusiveArmor?: number;
  /** Number of separate printed attacks; the digital resolver aggregates their required values. */
  attackCount?: number;
  faction?: "elementalists" | "dark-crusaders";
  description: string;
  source?: ComponentSource;
}

export interface MapCell {
  id: string;
  q: number;
  r: number;
  terrain: Terrain;
  site: SiteType;
  revealed: boolean;
  conquered: boolean;
  /** Whether the physical enemy/ruin token has been turned face up. */
  tokenRevealed: boolean;
  enemy?: Enemy;
  /** All physical enemy tokens defending this space; enemy mirrors the first one for old saves/UI. */
  enemies?: Enemy[];
  ruinsReward?: RuinToken["reward"];
  ruinTokenId?: string;
  ruinAltarColor?: RuinToken["altarColor"];
  mineColor?: Exclude<ManaColor, "gold" | "black">;
  /** Deep Mines depict two colors (desert/forest) or all four (swamp). */
  mineColors?: Array<Exclude<ManaColor, "gold" | "black">>;
  /** Physical seven-hex map tile that owns this terrain space. */
  tileId?: string;
  /** Fixed position of the space inside its physical map tile. */
  tileLocal?: "nw" | "ne" | "w" | "c" | "e" | "sw" | "se";
}

export interface UnitDef {
  id: string;
  name: string;
  level: number;
  armor: number;
  cost: number;
  effect: CardEffect;
  abilities?: UnitAbility[];
  resistances?: CombatElement[];
  site: "village" | "monastery" | "keep" | "mageTower" | "city" | "any";
  recruitSites?: Array<"village" | "monastery" | "keep" | "mageTower" | "city">;
  tier?: "regular" | "elite";
  copies?: number;
  englishName?: string;
  text: string;
  source?: ComponentSource;
  /** Delphana Masters may activate several different abilities once each in one combat. */
  multiAbility?: boolean;
}

export interface UnitAbility {
  id: string;
  label: string;
  effect?: CardEffect;
  /** Colored mana symbols printed before the ability. */
  manaCost?: ManaColor[];
  gainMana?: Array<Exclude<ManaColor, "gold" | "black">>;
  gainManaChoiceCount?: number;
  manaChoiceCount?: number;
  manaChoiceColors?: Array<Exclude<ManaColor, "gold">>;
  gainCrystal?: Array<Exclude<ManaColor, "gold" | "black">>;
  readyUnitMaxLevel?: number;
  woundSelf?: boolean;
  removeSwift?: boolean;
  cancelEnemyAttack?: boolean;
  unfortifiedOnly?: boolean;
  armorReduction?: number;
  allUnitResistances?: boolean;
  transformAttacks?: "coldfire" | "siege";
  terrainDiscount?: Terrain[];
  reputationChange?: number;
  delphanaEffect?: "cancel" | "destroy-if-blocked" | "armor-minus-five" | "strip-defense";
}

export interface Tactic {
  id: string;
  name: string;
  time: "day" | "night";
  order: number;
  text: string;
  bonus: CardEffect;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  color: ManaColor;
  description: string;
  source?: ComponentSource;
}

export interface SkillDef {
  id: string;
  heroId: string;
  name: string;
  description: string;
  resource?: Partial<ResourcePool>;
  armor?: number;
  hand?: number;
  command?: number;
  requiresWound?: boolean;
  special?:
    | "day-sharpshooting"
    | "inspiration"
    | "on-her-own"
    | "battle-frenzy"
    | "shamanic-ritual"
    | "arcane-disguise"
    | "master-chaos"
    | "mana-overload"
    | "ritual-of-pain"
    | "calming-weather"
    | "source-opening"
    | "howl-of-pack"
    | "mana-enhancement"
    | "nature-vengeance-coop";
  englishName?: string;
  source?: ComponentSource;
}

export const EMPTY_RESOURCES: ResourcePool = {
  move: 0,
  attack: 0,
  fireAttack: 0,
  iceAttack: 0,
  coldfireAttack: 0,
  block: 0,
  fireBlock: 0,
  iceBlock: 0,
  coldfireBlock: 0,
  range: 0,
  fireRange: 0,
  iceRange: 0,
  coldfireRange: 0,
  siege: 0,
  fireSiege: 0,
  iceSiege: 0,
  coldfireSiege: 0,
  influence: 0,
  heal: 0,
  draw: 0,
  crystal: 0,
};

export const HEROES: HeroDef[] = [
  {
    id: "tovak",
    name: "托瓦克",
    title: "冰甲战士",
    color: "blue",
    description: "稳健而耐久，擅长格挡与承受正面压力。",
  },
  {
    id: "arythea",
    name: "艾莉希娅",
    title: "血焰术士",
    color: "red",
    description: "偏向进攻，能把伤势转化为更猛烈的攻势。",
  },
  {
    id: "goldyx",
    name: "戈迪克斯",
    title: "龙裔贤者",
    color: "green",
    description: "擅长探索、移动与操纵魔力水晶。",
  },
  {
    id: "norowas",
    name: "诺洛瓦斯",
    title: "精灵统帅",
    color: "white",
    description: "擅长号召盟友并维持强大的随军阵容。",
  },
];

export const HERO_SKILLS: Record<string, SkillDef[]> = {
  tovak: [
    { id: "tovak-ice-guard", heroId: "tovak", name: "冰甲意志", description: "每回合获得格挡 1。", resource: { block: 1 } },
    { id: "tovak-frozen-plate", heroId: "tovak", name: "寒铁护体", description: "护甲永久 +1。", armor: 1 },
    { id: "tovak-counter", heroId: "tovak", name: "冷酷反击", description: "每回合获得攻击 1。", resource: { attack: 1 } },
    { id: "tovak-focus", heroId: "tovak", name: "坚定专注", description: "手牌上限永久 +1。", hand: 1 },
  ],
  arythea: [
    { id: "arythea-blood-rage", heroId: "arythea", name: "血火共鸣", description: "只要牌组中有伤势，每回合获得攻击 2。", resource: { attack: 2 }, requiresWound: true },
    { id: "arythea-fire-ward", heroId: "arythea", name: "烈焰护盾", description: "每回合获得格挡 1。", resource: { block: 1 } },
    { id: "arythea-burning-path", heroId: "arythea", name: "焦土疾行", description: "每回合获得移动 1。", resource: { move: 1 } },
    { id: "arythea-arcane-hunger", heroId: "arythea", name: "魔力渴求", description: "手牌上限永久 +1。", hand: 1 },
  ],
  goldyx: [
    { id: "goldyx-path", heroId: "goldyx", name: "林地感知", description: "每回合获得移动 1。", resource: { move: 1 } },
    { id: "goldyx-crystal", heroId: "goldyx", name: "水晶亲和", description: "每回合获得一次凝晶。", resource: { crystal: 1 } },
    { id: "goldyx-scales", heroId: "goldyx", name: "龙鳞", description: "护甲永久 +1。", armor: 1 },
    { id: "goldyx-memory", heroId: "goldyx", name: "龙族记忆", description: "手牌上限永久 +1。", hand: 1 },
  ],
  norowas: [
    { id: "norowas-noble", heroId: "norowas", name: "高贵号令", description: "每回合获得影响力 1。", resource: { influence: 1 } },
    { id: "norowas-banner", heroId: "norowas", name: "统帅之旗", description: "指挥上限永久 +1。", command: 1 },
    { id: "norowas-elven-path", heroId: "norowas", name: "精灵引路", description: "每回合获得移动 1。", resource: { move: 1 } },
    { id: "norowas-defense", heroId: "norowas", name: "盟友守望", description: "每回合获得格挡 1。", resource: { block: 1 } },
  ],
};

export function getSkill(skillId: string): SkillDef | undefined {
  const legacySkills: Record<string, SkillDef> = {
    "tovak-ice-guard": { id: "tovak-ice-guard", heroId: "tovak", name: "冰甲意志", description: "每回合获得格挡 1。", resource: { block: 1 } },
    "tovak-frozen-plate": { id: "tovak-frozen-plate", heroId: "tovak", name: "寒铁护体", description: "护甲永久 +1。", armor: 1 },
    "tovak-focus": { id: "tovak-focus", heroId: "tovak", name: "坚定专注", description: "手牌上限永久 +1。", hand: 1 },
  };
  return legacySkills[skillId] ?? Object.values(ALL_HERO_SKILLS).flat().find((skill) => skill.id === skillId);
}

export const CARD_DEFS: Record<string, CardDef> = {
  march: {
    id: "march",
    name: "行军",
    color: "green",
    tier: "basic",
    basic: { move: 2 },
    powered: { move: 4 },
    basicLabel: "移动 2",
    poweredLabel: "移动 4",
  },
  stamina: {
    id: "stamina",
    name: "耐力",
    color: "green",
    tier: "basic",
    basic: { move: 2 },
    powered: { move: 4 },
    basicLabel: "移动 2",
    poweredLabel: "移动 4",
  },
  swiftness: {
    id: "swiftness",
    name: "迅捷",
    color: "white",
    tier: "basic",
    basic: { move: 2 },
    powered: { range: 3 },
    basicLabel: "移动 2",
    poweredLabel: "远程攻击 3",
  },
  rage: {
    id: "rage",
    name: "怒击",
    color: "red",
    tier: "basic",
    basic: { attack: 2 },
    powered: { attack: 4 },
    basicLabel: "攻击 2",
    poweredLabel: "攻击 4",
  },
  determination: {
    id: "determination",
    name: "决意",
    color: "blue",
    tier: "basic",
    basic: { block: 2 },
    powered: { block: 5 },
    basicLabel: "格挡 2",
    poweredLabel: "格挡 5",
  },
  tranquility: {
    id: "tranquility",
    name: "宁静",
    color: "green",
    tier: "basic",
    basic: { heal: 1 },
    powered: { heal: 2, draw: 1 },
    basicLabel: "治疗 1",
    poweredLabel: "治疗 2，抽牌 1",
  },
  promise: {
    id: "promise",
    name: "承诺",
    color: "white",
    tier: "basic",
    basic: { influence: 2 },
    powered: { influence: 4 },
    basicLabel: "影响力 2",
    poweredLabel: "影响力 4",
  },
  threaten: {
    id: "threaten",
    name: "威吓",
    color: "red",
    tier: "basic",
    basic: { influence: 2 },
    powered: { influence: 5, note: "本回合结束时声望 -1" },
    basicLabel: "影响力 2",
    poweredLabel: "影响力 5，声望 -1",
  },
  crystallize: {
    id: "crystallize",
    name: "凝晶",
    color: "blue",
    tier: "basic",
    basic: { crystal: 1 },
    powered: { crystal: 2 },
    basicLabel: "获得 1 次凝晶",
    poweredLabel: "获得 2 次凝晶",
  },
  manaDraw: {
    id: "manaDraw",
    name: "引导魔力",
    color: "white",
    tier: "basic",
    basic: { move: 1, influence: 1 },
    powered: { move: 2, influence: 2 },
    basicLabel: "移动与影响力各 1",
    poweredLabel: "移动与影响力各 2",
  },
  concentration: {
    id: "concentration",
    name: "专注",
    color: "green",
    tier: "basic",
    basic: { attack: 1, block: 1 },
    powered: { attack: 3, block: 3 },
    basicLabel: "攻击与格挡各 1",
    poweredLabel: "攻击与格挡各 3",
  },
  improvisation: {
    id: "improvisation",
    name: "临机应变",
    color: "red",
    tier: "basic",
    basic: { choices: [
      { label: "移动 3", effect: { move: 3 } },
      { label: "影响力 3", effect: { influence: 3 } },
      { label: "攻击 3", effect: { attack: 3 } },
      { label: "格挡 3", effect: { block: 3 } },
    ] },
    powered: { choices: [
      { label: "移动 5", effect: { move: 5 } },
      { label: "影响力 5", effect: { influence: 5 } },
      { label: "攻击 5", effect: { attack: 5 } },
      { label: "格挡 5", effect: { block: 5 } },
    ] },
    basicLabel: "弃另一张非伤势牌；四类基础资源择一获得 3",
    poweredLabel: "弃另一张非伤势牌；四类基础资源择一获得 5",
  },
  pathfinding: {
    id: "pathfinding",
    name: "寻路术",
    color: "green",
    tier: "advanced",
    basic: { move: 3 },
    powered: { move: 6 },
    basicLabel: "移动 3",
    poweredLabel: "移动 6",
    cost: 6,
  },
  iceShield: {
    id: "iceShield",
    name: "霜壁",
    color: "blue",
    tier: "advanced",
    basic: { block: 4 },
    powered: { block: 7 },
    basicLabel: "格挡 4",
    poweredLabel: "格挡 7",
    cost: 6,
  },
  bloodRite: {
    id: "bloodRite",
    name: "血火仪式",
    color: "red",
    tier: "advanced",
    basic: { attack: 3 },
    powered: { attack: 7 },
    basicLabel: "攻击 3",
    poweredLabel: "攻击 7",
    cost: 6,
  },
  inspiringCall: {
    id: "inspiringCall",
    name: "鼓舞号令",
    color: "white",
    tier: "advanced",
    basic: { influence: 4 },
    powered: { influence: 7 },
    basicLabel: "影响力 4",
    poweredLabel: "影响力 7",
    cost: 6,
  },
  swiftBolt: {
    id: "swiftBolt",
    name: "疾风箭",
    color: "white",
    tier: "advanced",
    basic: { range: 3 },
    powered: { range: 5 },
    basicLabel: "远程攻击 3",
    poweredLabel: "远程攻击 5",
    cost: 6,
  },
  siegeMastery: {
    id: "siegeMastery",
    name: "破城精通",
    color: "red",
    tier: "advanced",
    basic: { siege: 3 },
    powered: { siege: 6 },
    basicLabel: "攻城攻击 3",
    poweredLabel: "攻城攻击 6",
    cost: 6,
  },
  restorativeFlow: {
    id: "restorativeFlow",
    name: "复苏之流",
    color: "green",
    tier: "advanced",
    basic: { heal: 2 },
    powered: { heal: 3, draw: 1 },
    basicLabel: "治疗 2",
    poweredLabel: "治疗 3，抽牌 1",
    cost: 6,
  },
  crystalMastery: {
    id: "crystalMastery",
    name: "水晶掌握",
    color: "blue",
    tier: "advanced",
    basic: { crystal: 2 },
    powered: { crystal: 2, draw: 1 },
    basicLabel: "凝晶 2",
    poweredLabel: "凝晶 2，抽牌 1",
    cost: 6,
  },
  firestorm: {
    id: "firestorm",
    name: "火焰风暴",
    color: "red",
    tier: "spell",
    basic: { attack: 6 },
    powered: { siege: 9 },
    basicLabel: "攻击 6",
    poweredLabel: "攻城攻击 9",
    cost: 7,
  },
  blizzard: {
    id: "blizzard",
    name: "冰封领域",
    color: "blue",
    tier: "spell",
    basic: { block: 7 },
    powered: { attack: 8 },
    basicLabel: "格挡 7",
    poweredLabel: "攻击 8",
    cost: 7,
  },
  wings: {
    id: "wings",
    name: "苍穹之翼",
    color: "white",
    tier: "spell",
    basic: { move: 6 },
    powered: { move: 10 },
    basicLabel: "移动 6",
    poweredLabel: "移动 10",
    cost: 7,
  },
  regeneration: {
    id: "regeneration",
    name: "再生",
    color: "green",
    tier: "spell",
    basic: { heal: 3, draw: 1 },
    powered: { heal: 5, draw: 2 },
    basicLabel: "治疗 3，抽牌 1",
    poweredLabel: "治疗 5，抽牌 2",
    cost: 7,
  },
  mindCommand: {
    id: "mindCommand",
    name: "心灵号令",
    color: "white",
    tier: "spell",
    basic: { influence: 7 },
    powered: { influence: 11 },
    basicLabel: "影响力 7",
    poweredLabel: "影响力 11",
    cost: 7,
  },
  tremor: {
    id: "tremor",
    name: "大地震击",
    color: "green",
    tier: "spell",
    basic: { siege: 6 },
    powered: { siege: 10 },
    basicLabel: "攻城攻击 6",
    poweredLabel: "攻城攻击 10",
    cost: 7,
  },
  astralCompass: {
    id: "astralCompass", name: "星界罗盘", color: "gold", tier: "artifact",
    basic: { move: 5 }, powered: { move: 5 }, basicLabel: "移动 5", poweredLabel: "移动 5",
  },
  dawnCrown: {
    id: "dawnCrown", name: "破晓王冠", color: "gold", tier: "artifact",
    basic: { influence: 6 }, powered: { influence: 6 }, basicLabel: "影响力 6", poweredLabel: "影响力 6",
  },
  voidChalice: {
    id: "voidChalice", name: "虚空圣杯", color: "gold", tier: "artifact",
    basic: { heal: 3, draw: 1 }, powered: { heal: 3, draw: 1 }, basicLabel: "治疗 3，抽牌 1", poweredLabel: "治疗 3，抽牌 1",
  },
  dragonboneScepter: {
    id: "dragonboneScepter", name: "龙骨权杖", color: "gold", tier: "artifact",
    basic: { attack: 7 }, powered: { attack: 7 }, basicLabel: "攻击 7", poweredLabel: "攻击 7",
  },
  eternalGrimoire: {
    id: "eternalGrimoire", name: "永燃秘典", color: "gold", tier: "artifact",
    basic: { siege: 6 }, powered: { siege: 6 }, basicLabel: "攻城攻击 6", poweredLabel: "攻城攻击 6",
  },
  mirrorAmulet: {
    id: "mirrorAmulet", name: "镜界护符", color: "gold", tier: "artifact",
    basic: { block: 7 }, powered: { block: 7 }, basicLabel: "格挡 7", poweredLabel: "格挡 7",
  },
};

export const STARTER_DECK = [
  "rage#1",
  "rage#2",
  "determination#1",
  "swiftness#1",
  "swiftness#2",
  "march#1",
  "march#2",
  "stamina#1",
  "stamina#2",
  "tranquility#1",
  "promise#1",
  "threaten#1",
  "crystallize#1",
  "manaDraw#1",
  "concentration#1",
  "improvisation#1",
];

export const ADVANCED_IDS = [
  "pathfinding",
  "iceShield",
  "bloodRite",
  "inspiringCall",
  "swiftBolt",
  "siegeMastery",
  "restorativeFlow",
  "crystalMastery",
];

export const SPELL_IDS = [
  "firestorm",
  "blizzard",
  "wings",
  "regeneration",
  "mindCommand",
  "tremor",
];

export const UNIT_DEFS: UnitDef[] = [
  {
    id: "foresters",
    name: "林地斥候",
    level: 1,
    armor: 3,
    cost: 4,
    effect: { move: 3 },
    site: "village",
    text: "每轮一次：移动 3",
  },
  {
    id: "guardsmen",
    name: "守备军",
    level: 2,
    armor: 4,
    cost: 5,
    effect: { block: 4 },
    site: "keep",
    text: "每轮一次：格挡 4",
  },
  {
    id: "herbalists",
    name: "草药师",
    level: 1,
    armor: 3,
    cost: 5,
    effect: { heal: 2, influence: 1 },
    site: "village",
    text: "每轮一次：治疗 2，影响力 1",
  },
  {
    id: "monks",
    name: "修院僧侣",
    level: 2,
    armor: 3,
    cost: 6,
    effect: { influence: 3, heal: 1 },
    site: "monastery",
    text: "每轮一次：影响力 3，治疗 1",
  },
  {
    id: "crossbowmen",
    name: "弩手队",
    level: 2,
    armor: 3,
    cost: 6,
    effect: { range: 4 },
    site: "keep",
    text: "每轮一次：远程攻击 4",
  },
  {
    id: "fireMages",
    name: "焰术师",
    level: 3,
    armor: 4,
    cost: 8,
    effect: { siege: 5 },
    site: "monastery",
    text: "每轮一次：攻城攻击 5",
  },
];

// Replace the small prototype catalog above in-place so existing imports keep a
// stable reference while the game uses the complete base-game component set.
Object.keys(CARD_DEFS).forEach((id) => delete CARD_DEFS[id]);
Object.assign(CARD_DEFS, FULL_CARD_DEFS);
Object.keys(HERO_SKILLS).forEach((id) => delete HERO_SKILLS[id]);
Object.assign(HERO_SKILLS, FULL_HERO_SKILLS);
STARTER_DECK.splice(0, STARTER_DECK.length, ...FULL_STARTER_DECKS.tovak);
ADVANCED_IDS.splice(0, ADVANCED_IDS.length, ...FULL_ADVANCED_IDS);
SPELL_IDS.splice(0, SPELL_IDS.length, ...FULL_SPELL_IDS);
UNIT_DEFS.splice(0, UNIT_DEFS.length, ...FULL_UNIT_DEFS);

export const STARTER_DECKS = FULL_STARTER_DECKS;
export const ARTIFACT_IDS = FULL_ARTIFACT_IDS;
export const ALL_HEROES: HeroDef[] = [...HEROES, ...EXPANSION_HEROES];
export const ALL_HERO_SKILLS: Record<string, SkillDef[]> = Object.fromEntries(ALL_HEROES.map((hero) => [
  hero.id,
  [...(FULL_HERO_SKILLS[hero.id] ?? []), ...(EXPANSION_HERO_SKILLS[hero.id] ?? [])],
]));
export const ALL_CARD_DEFS: Record<string, CardDef> = { ...FULL_CARD_DEFS, ...EXPANSION_CARD_DEFS };
export const ALL_UNIT_DEFS: UnitDef[] = [...FULL_UNIT_DEFS, ...EXPANSION_UNIT_DEFS];
export const ALL_ENEMY_TOKENS: Enemy[] = [...ENEMY_TOKENS, ...EXPANSION_ENEMY_TOKENS];
export const ALL_ENEMY_TOKEN_BY_ID: Record<string, Enemy> = Object.fromEntries(ALL_ENEMY_TOKENS.map((enemy) => [enemy.id, enemy]));
export const ALL_ENEMY_TOKEN_IDS: Record<EnemyTokenColor, string[]> = {
  green: ALL_ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "green").map((enemy) => enemy.id),
  red: ALL_ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "red").map((enemy) => enemy.id),
  gray: ALL_ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "gray").map((enemy) => enemy.id),
  violet: ALL_ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "violet").map((enemy) => enemy.id),
  brown: ALL_ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "brown").map((enemy) => enemy.id),
  white: ALL_ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "white").map((enemy) => enemy.id),
};
export const ALL_RUIN_TOKENS: RuinToken[] = [...RUIN_TOKENS, ...EXPANSION_RUIN_TOKENS];
export const ALL_RUIN_TOKEN_BY_ID: Record<string, RuinToken> = Object.fromEntries(ALL_RUIN_TOKENS.map((token) => [token.id, token]));
export const ULTIMATE_ADVANCED_IDS = [...FULL_ADVANCED_IDS, ...EXPANSION_ADVANCED_IDS];
export const ULTIMATE_SPELL_IDS = [...FULL_SPELL_IDS, ...EXPANSION_SPELL_IDS];
export const ULTIMATE_ARTIFACT_IDS = [...FULL_ARTIFACT_IDS, ...EXPANSION_ARTIFACT_IDS];
export const ULTIMATE_REGULAR_UNIT_IDS = [...REGULAR_UNIT_IDS, ...expansionUnitIds("regular")];
export const ULTIMATE_ELITE_UNIT_IDS = [...ELITE_UNIT_IDS, ...expansionUnitIds("elite")];
export const ULTIMATE_WOUND_IDS = [...WOUND_IDS, ...Array.from({ length: 12 }, (_, index) => `wound#ll-${String(index + 1).padStart(2, "0")}`)];

export function getHeroesForMode(mode: ContentMode) {
  return mode === "ultimate" ? ALL_HEROES : HEROES;
}

export function getStarterDecksForMode(mode: ContentMode) {
  return mode === "ultimate" ? ULTIMATE_STARTER_DECKS : STARTER_DECKS;
}

export function getHeroSkillsForMode(mode: ContentMode, heroId: string) {
  return (mode === "ultimate" ? ALL_HERO_SKILLS : HERO_SKILLS)[heroId] ?? [];
}

export function getAdvancedIdsForMode(mode: ContentMode) {
  return mode === "ultimate" ? ULTIMATE_ADVANCED_IDS : ADVANCED_IDS;
}

export function getSpellIdsForMode(mode: ContentMode) {
  // Competitive interactive Spells affect other human players.  The official
  // solo/co-operative setup removes them; this simulator is solo-only.
  const soloLegal = (id: string) => id !== "manaMeltdown" && id !== "manaClaim";
  return (mode === "ultimate" ? ULTIMATE_SPELL_IDS : SPELL_IDS).filter(soloLegal);
}

export function getArtifactIdsForMode(mode: ContentMode) {
  return mode === "ultimate" ? ULTIMATE_ARTIFACT_IDS : ARTIFACT_IDS;
}

export function getRegularUnitIdsForMode(mode: ContentMode) {
  return mode === "ultimate" ? ULTIMATE_REGULAR_UNIT_IDS : REGULAR_UNIT_IDS;
}

export function getEliteUnitIdsForMode(mode: ContentMode) {
  return mode === "ultimate" ? ULTIMATE_ELITE_UNIT_IDS : ELITE_UNIT_IDS;
}

export function getEnemyTokenIdsForMode(mode: ContentMode) {
  return mode === "ultimate" ? ALL_ENEMY_TOKEN_IDS : ENEMY_TOKEN_IDS;
}

export function getRuinTokensForMode(mode: ContentMode) {
  return mode === "ultimate" ? ALL_RUIN_TOKENS : RUIN_TOKENS;
}

export function getWoundIdsForMode(mode: ContentMode) {
  return mode === "ultimate" ? ULTIMATE_WOUND_IDS : WOUND_IDS;
}

export function getUnit(instanceId: string) {
  const aliases: Record<string, string> = { guardsmen: "utemGuardsmen", crossbowmen: "utemCrossbowmen", monks: "redCapeMonks" };
  const id = unitBaseId(instanceId);
  return ALL_UNIT_DEFS.find((unit) => unit.id === (aliases[id] ?? id)) ?? getBaseUnit(instanceId);
}
export {
  BASE_COMPONENT_COUNTS,
  ELITE_UNIT_IDS,
  ENEMY_TOKEN_BY_ID,
  ENEMY_TOKEN_IDS,
  ENEMY_TOKENS,
  REGULAR_UNIT_IDS,
  RUIN_TOKEN_BY_ID,
  RUIN_TOKENS,
  WOUND_IDS,
  unitBaseId,
};

export const TACTICS: Tactic[] = [
  { id: "d1", name: "黎明先驱", time: "day", order: 1, text: "本轮起手多抽 1 张。", bonus: { draw: 1 } },
  { id: "d2", name: "蓄势待发", time: "day", order: 2, text: "首回合额外获得移动 2。", bonus: { move: 2 } },
  { id: "d3", name: "魔力涌动", time: "day", order: 3, text: "首回合获得一次凝晶。", bonus: { crystal: 1 } },
  { id: "d4", name: "稳健计划", time: "day", order: 4, text: "首回合获得格挡 2。", bonus: { block: 2 } },
  { id: "d5", name: "民心所向", time: "day", order: 5, text: "首回合获得影响力 3。", bonus: { influence: 3 } },
  { id: "d6", name: "漫长白昼", time: "day", order: 6, text: "虚拟玩家本轮少翻 2 张。", bonus: {} },
  { id: "n1", name: "夜幕突袭", time: "night", order: 1, text: "首回合获得攻击 3。", bonus: { attack: 3 } },
  { id: "n2", name: "星辉引路", time: "night", order: 2, text: "首回合获得移动 3。", bonus: { move: 3 } },
  { id: "n3", name: "静谧之夜", time: "night", order: 3, text: "首回合获得治疗 1。", bonus: { heal: 1 } },
  { id: "n4", name: "月下交易", time: "night", order: 4, text: "首回合获得影响力 3。", bonus: { influence: 3 } },
  { id: "n5", name: "寒夜守望", time: "night", order: 5, text: "首回合获得格挡 3。", bonus: { block: 3 } },
  { id: "n6", name: "长夜", time: "night", order: 6, text: "虚拟玩家本轮少翻 2 张。", bonus: {} },
];

export const TERRAIN_LABELS: Record<Terrain, string> = {
  portal: "传送门",
  plains: "平原",
  forest: "森林",
  desert: "沙漠",
  hills: "丘陵",
  swamp: "沼泽",
  wasteland: "荒地",
  lake: "湖泊",
  mountain: "山脉",
  city: "城市",
};

export const SITE_LABELS: Record<SiteType, string> = {
  none: "荒野",
  village: "村庄",
  monastery: "修道院",
  keep: "要塞",
  mageTower: "法师塔",
  mine: "水晶矿",
  glade: "魔法林地",
  ruins: "古代遗迹",
  monsterDen: "怪物巢穴",
  tomb: "古墓",
  spawningGrounds: "繁殖地",
  dungeon: "地下城",
  maze: "迷宫",
  labyrinth: "大迷宫",
  deepMine: "深层矿井",
  refugeeCamp: "难民营",
  graveyard: "墓园",
  necropolis: "死灵城",
  hiddenValley: "隐秘山谷",
  volkareCamp: "沃尔卡雷营地",
  rampager: "游荡兽人",
  dragon: "巨龙",
  city1: "第一座城市",
  city2: "王都",
};

export const TERRAIN_COSTS: Record<Terrain, { day: number; night: number }> = {
  portal: { day: 2, night: 2 },
  plains: { day: 2, night: 2 },
  forest: { day: 3, night: 5 },
  desert: { day: 5, night: 3 },
  hills: { day: 3, night: 3 },
  swamp: { day: 5, night: 5 },
  wasteland: { day: 4, night: 4 },
  lake: { day: Number.POSITIVE_INFINITY, night: Number.POSITIVE_INFINITY },
  mountain: { day: Number.POSITIVE_INFINITY, night: Number.POSITIVE_INFINITY },
  city: { day: 2, night: 2 },
};

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  move: "移动",
  attack: "物理攻击",
  fireAttack: "火焰攻击",
  iceAttack: "寒冰攻击",
  coldfireAttack: "冷热火攻击",
  block: "物理格挡",
  fireBlock: "火焰格挡",
  iceBlock: "寒冰格挡",
  coldfireBlock: "冷热火格挡",
  range: "物理远程",
  fireRange: "火焰远程",
  iceRange: "寒冰远程",
  coldfireRange: "冷热火远程",
  siege: "物理攻城",
  fireSiege: "火焰攻城",
  iceSiege: "寒冰攻城",
  coldfireSiege: "冷热火攻城",
  influence: "影响力",
  heal: "治疗",
  draw: "抽牌",
  crystal: "凝晶",
};

export const MANA_LABELS: Record<ManaColor, string> = {
  red: "红",
  blue: "蓝",
  green: "绿",
  white: "白",
  gold: "金",
  black: "黑",
};

export function cardBaseId(instanceId: string) {
  return instanceId.split("#")[0];
}

export function getCard(instanceId: string): CardDef | null {
  if (instanceId.startsWith("wound#")) return null;
  return ALL_CARD_DEFS[cardBaseId(instanceId)] ?? null;
}
import {
  BASE_COMPONENT_COUNTS,
  ELITE_UNIT_IDS,
  ENEMY_TOKEN_BY_ID,
  ENEMY_TOKEN_IDS,
  ENEMY_TOKENS,
  FULL_ADVANCED_IDS,
  FULL_ARTIFACT_IDS,
  FULL_CARD_DEFS,
  FULL_HERO_SKILLS,
  FULL_SPELL_IDS,
  FULL_STARTER_DECKS,
  FULL_UNIT_DEFS,
  REGULAR_UNIT_IDS,
  RUIN_TOKEN_BY_ID,
  RUIN_TOKENS,
  getUnit as getBaseUnit,
  unitBaseId,
  WOUND_IDS,
} from "./base-components";
import {
  EXPANSION_ADVANCED_IDS,
  EXPANSION_ARTIFACT_IDS,
  EXPANSION_CARD_DEFS,
  EXPANSION_ENEMY_TOKENS,
  EXPANSION_HEROES,
  EXPANSION_HERO_SKILLS,
  EXPANSION_RUIN_TOKENS,
  EXPANSION_SPELL_IDS,
  EXPANSION_UNIT_DEFS,
  ULTIMATE_COMPONENT_COUNTS,
  ULTIMATE_STARTER_DECKS,
  expansionUnitIds,
} from "./ultimate-components";

export { ULTIMATE_COMPONENT_COUNTS };
