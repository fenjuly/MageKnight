import { ALL_CARD_DEFS, ALL_HERO_SKILLS, ALL_UNIT_DEFS, SITE_LABELS, type SiteType } from "../lib/game-data";

export type CoverageStatus = "executable" | "rule-gap";

export interface RuleGap {
  id: string;
  area: "card" | "unit" | "skill" | "site" | "combat";
  title: string;
  reason: string;
}

/**
 * Every map site must remain in this registry.  The exhaustive suite compares
 * it with SiteType/SITE_LABELS, so adding a new site without a test contract
 * fails CI instead of silently leaving it untested.
 */
export const SITE_COVERAGE: Record<SiteType, { entry: string; effects: string[] }> = {
  none: { entry: "normal-movement", effects: ["no-site-action"] },
  village: { entry: "normal-movement", effects: ["recruit", "heal-with-influence"] },
  monastery: { entry: "normal-movement", effects: ["recruit", "advanced-offer", "burn-combat", "burn-artifact"] },
  keep: { entry: "forced-assault", effects: ["gray-garrison", "reputation-loss", "owned-keep", "hand-limit", "recruit-after-conquest"] },
  mageTower: { entry: "forced-assault", effects: ["violet-garrison", "reputation-loss", "spell-reward", "buy-spell", "recruit-after-conquest"] },
  mine: { entry: "normal-movement", effects: ["end-turn-crystal"] },
  glade: { entry: "normal-movement", effects: ["end-turn-wound-heal"] },
  ruins: { entry: "voluntary-adventure", effects: ["four-altars", "eleven-enemy-tokens", "five-reward-types", "survivors-remain"] },
  monsterDen: { entry: "voluntary-adventure", effects: ["brown-enemy", "units-allowed", "normal-mana-rules", "failure-remains", "two-mana-dice"] },
  dungeon: { entry: "voluntary-adventure", effects: ["brown-enemy", "units-forbidden", "night-rules", "failure-discard", "die-selected-spell-or-artifact", "repeat-for-fame"] },
  tomb: { entry: "voluntary-adventure", effects: ["red-enemy", "units-forbidden", "night-rules", "failure-discard", "spell-and-artifact"] },
  spawningGrounds: { entry: "voluntary-adventure", effects: ["two-brown-enemies", "failure-replenish", "artifact-and-crystals"] },
  maze: { entry: "voluntary-adventure", effects: ["move-2", "move-4", "move-6", "failure-discard", "tiered-rewards"] },
  labyrinth: { entry: "voluntary-adventure", effects: ["move-2", "move-4", "move-6", "failure-discard", "tiered-rewards"] },
  deepMine: { entry: "normal-movement", effects: ["end-turn-crystal"] },
  refugeeCamp: { entry: "normal-movement", effects: ["all-unit-recruitment", "site-surcharge", "multiple-recruits"] },
  graveyard: { entry: "scenario-overlay", effects: ["underlying-terrain-movement", "night-rules", "night-black", "scenario-defined-enemies-and-rewards"] },
  necropolis: { entry: "scenario-overlay", effects: ["move-two", "night-rules", "night-black", "scenario-defined-leader-and-rewards"] },
  hiddenValley: { entry: "safe-site", effects: ["move-two", "end-turn-heal", "day-gold-night-black", "no-generic-enemies-or-loot"] },
  volkareCamp: { entry: "forced-assault", effects: ["difficulty-army", "no-reputation-loss", "partial-army-remains", "volkare-attack", "shield-count", "city-scoring", "camp-services", "pursuit"] },
  rampager: { entry: "adjacent-challenge-or-provocation", effects: ["green-enemy", "reputation-plus-one"] },
  dragon: { entry: "adjacent-challenge-or-provocation", effects: ["red-enemy", "reputation-plus-two"] },
  city1: { entry: "forced-assault", effects: ["multiple-defenders", "city-color-modifier", "reputation-loss", "conquest-services", "hand-limit"] },
  city2: { entry: "forced-assault", effects: ["multiple-defenders", "city-color-modifier", "reputation-loss", "scenario-countdown", "hand-limit"] },
};

const IMPLEMENTED_SPECIAL_CARD_MODES = new Set([
  "tranquility:basic",
  "tranquility:powered",
  "threaten:powered",
  "manaDraw:basic",
  "manaDraw:powered",
  "improvisation:basic",
  "improvisation:powered",
  "concentration:basic",
  "concentration:powered",
  "willFocus:basic",
  "willFocus:powered",
  "nobleManners:basic",
  "nobleManners:powered",
  "manaPull:basic",
  "manaPull:powered",
  "bloodRage:basic",
  "bloodRage:powered",
  "intimidate:basic",
  "intimidate:powered",
  "frostBridge:basic",
  "frostBridge:powered",
  "songOfWind:basic",
  "songOfWind:powered",
  "pathfinding:basic",
  "pathfinding:powered",
  "bloodRitual:basic",
  "bloodRitual:powered",
  "pureMagic:basic",
  "pureMagic:powered",
  "intoTheHeat:basic",
  "intoTheHeat:powered",
  "steadyTempo:basic",
  "steadyTempo:powered",
  "diplomacy:basic",
  "diplomacy:powered",
  "inNeed:basic",
  "inNeed:powered",
  "decompose:basic",
  "decompose:powered",
  "crystalMastery:basic",
  "crystalMastery:powered",
  "manaStorm:basic",
  "manaStorm:powered",
  "maximalEffect:basic",
  "maximalEffect:powered",
  "magicTalent:basic",
  "magicTalent:powered",
  "training:basic",
  "training:powered",
  "undergroundTravel:basic",
  "undergroundTravel:powered",
  "burningShield:basic",
  "burningShield:powered",
  "chill:basic",
  "chill:powered",
  "wings:basic",
  "wings:powered",
  "demolish:basic",
  "demolish:powered",
  "spaceBending:basic",
  "spaceBending:powered",
  "callToArms:basic",
  "callToArms:powered",
  "meditation:basic",
  "meditation:powered",
  "manaMeltdown:basic",
  "manaMeltdown:powered",
  "manaClaim:basic",
  "manaClaim:powered",
  "bannerGlory:basic",
  "bannerGlory:powered",
  "bannerFear:basic",
  "bannerFear:powered",
  "bannerProtection:basic",
  "bannerProtection:powered",
  "bannerCourage:basic",
  "bannerCourage:powered",
  "rubyRing:basic",
  "rubyRing:powered",
  "sapphireRing:basic",
  "sapphireRing:powered",
  "diamondRing:basic",
  "diamondRing:powered",
  "emeraldRing:basic",
  "emeraldRing:powered",
  "swordJustice:basic",
  "swordJustice:powered",
  "goldenGrail:basic",
  "goldenGrail:powered",
  "amuletSun:basic",
  "amuletSun:powered",
  "amuletDarkness:basic",
  "amuletDarkness:powered",
  "savageHarvesting:basic",
  "savageHarvesting:powered",
  "ruthlessCoercion:basic",
  "ruthlessCoercion:powered",
  "oneWithTheLand:basic",
  "oneWithTheLand:powered",
  "bloodOfAncients:basic",
  "bloodOfAncients:powered",
  "shieldBash:basic",
  "shieldBash:powered",
  "spellForge:basic",
  "spellForge:powered",
  "chivalry:basic",
  "chivalry:powered",
  "peacefulMoment:basic",
  "peacefulMoment:powered",
  "stoutResolve:basic",
  "stoutResolve:powered",
  "forceOfNature:basic",
  "forceOfNature:powered",
  "mountainLore:basic",
  "mountainLore:powered",
  "offering:basic",
  "offering:powered",
  "charm:basic",
  "charm:powered",
  "cure:basic",
  "cure:powered",
  "bannerOfCommand:basic",
  "bannerOfCommand:powered",
  "bannerOfFortitude:basic",
  "bannerOfFortitude:powered",
  "circletOfProficiency:basic",
  "circletOfProficiency:powered",
  "tomeOfAllSpells:basic",
  "tomeOfAllSpells:powered",
  "chillingStare:basic",
  "chillingStare:powered",
  "mysteriousBox:basic",
  "mysteriousBox:powered",
]);

// These words describe state changes that cannot be proven by merely checking
// the numeric ResourcePool.  Each matching mode is therefore either explicitly
// implemented above or appears as an open, named test TODO.
const COMPLEX_CARD_TEXT = /强化另一|源泉|改色|跨越|穿越|湖泊|山地|降低|地形|盟军|留在牌库|转为|分解|弃牌|复制|借用|重掷|额外行动|整理|按当前|依目标|装备|游荡|白昼|夜晚|名望|声誉|伤势|抗性|迅捷|反击|防御工事|支配|随机|牺牲|供应牌|重整|净化|召唤|压低|获得[^；，]*魔力|操纵盟军/;

export const CARD_RULE_GAPS: RuleGap[] = Object.values(ALL_CARD_DEFS).flatMap((card) =>
  (["basic", "powered"] as const).flatMap((mode) => {
    const key = `${card.id}:${mode}`;
    const label = mode === "basic" ? card.basicLabel : card.poweredLabel;
    if (!COMPLEX_CARD_TEXT.test(label) || IMPLEMENTED_SPECIAL_CARD_MODES.has(key)) return [];
    return [{
      id: `card:${key}`,
      area: "card" as const,
      title: `${card.name} / ${mode === "basic" ? "基础" : "强化"}：${label}`,
      reason: "牌面包含 ResourcePool 以外的选择、目标、持续状态或牌区操作；当前仅有数字化摘要，尚需逐字规则实现。",
    }];
  }),
);

const COMPLEX_SKILL_TEXT = /或|白昼|夜晚|没有盟军|休整|条件|即使声誉|随机|翻回|每轮|合作\/单人/;
const IMPLEMENTED_COMPLEX_SKILLS = new Set([
  "norowas-day-sharpshooting",
  "norowas-inspiration",
  "wolfhawk-on-her-own",
  "krang-battle-frenzy",
  "krang-shamanic-ritual",
  "krang-arcane-disguise",
  "krang-master-chaos",
  "tovak-mana-overload",
  "arythea-ritual-of-pain",
  "norowas-calming-weather",
  "goldyx-source-opening",
  "wolfhawk-pack-howl",
  "krang-mana-enhancement",
  "braevalar-nature-vengeance-coop",
]);

export const SKILL_RULE_GAPS: RuleGap[] = Object.values(ALL_HERO_SKILLS).flat().flatMap((skill) => {
  if (!COMPLEX_SKILL_TEXT.test(skill.description) || IMPLEMENTED_COMPLEX_SKILLS.has(skill.id)) return [];
  return [{
    id: `skill:${skill.id}`,
    area: "skill" as const,
    title: `${skill.name}：${skill.description}`,
    reason: "技能含时段、条件、二选一或翻面/每轮次数规则；当前常驻数字资源模型不足以证明完整牌面语义。",
  }];
});

const COMPLEX_UNIT_TEXT = /声誉|任意|对应元素|移除火焰抗性|移除寒冰抗性|数字版/;
const IMPLEMENTED_COMPLEX_UNIT_ABILITIES = new Set([
  "altemMages:mana",
  "thugs:attack",
  "thugs:influence",
]);

export const UNIT_RULE_GAPS: RuleGap[] = Object.values(ALL_UNIT_DEFS).flatMap((unit) =>
  (unit.abilities ?? []).flatMap((ability) => {
    if (!COMPLEX_UNIT_TEXT.test(ability.label) || IMPLEMENTED_COMPLEX_UNIT_ABILITIES.has(`${unit.id}:${ability.id}`)) return [];
    return [{
      id: `unit:${unit.id}:${ability.id}`,
      area: "unit" as const,
      title: `${unit.name} / ${ability.label}`,
      reason: "该盟军能力仍含固定选色、属性替代、抗性移除或声誉副作用的数字化摘要，尚未完整提供牌面选择与状态修改。",
    }];
  }),
);

export const SITE_RULE_GAPS: RuleGap[] = [];

export const COMBAT_RULE_GAPS: RuleGap[] = [];

export const OPEN_RULE_GAPS = [...CARD_RULE_GAPS, ...UNIT_RULE_GAPS, ...SKILL_RULE_GAPS, ...SITE_RULE_GAPS, ...COMBAT_RULE_GAPS];

export function coverageSummary() {
  return {
    cards: Object.keys(ALL_CARD_DEFS).length,
    cardModes: Object.values(ALL_CARD_DEFS).reduce((sum, card) => sum + 2 + (card.basic.choices?.length ?? 0) + (card.powered.choices?.length ?? 0), 0),
    sites: Object.keys(SITE_LABELS).length,
    openRuleGaps: OPEN_RULE_GAPS.length,
  };
}
