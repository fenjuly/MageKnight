import type {
  CardDef,
  CardEffect,
  Enemy,
  EnemyTokenColor,
  HeroDef,
  ManaColor,
  RuinToken,
  SkillDef,
  UnitDef,
} from "./game-data";

type Tier = CardDef["tier"];

function either(...choices: Array<[label: string, effect: CardEffect]>): CardEffect {
  return { choices: choices.map(([label, effect]) => ({ label, effect })) };
}

function card(
  id: string,
  name: string,
  englishName: string,
  color: ManaColor,
  tier: Tier,
  basic: CardEffect,
  powered: CardEffect,
  basicLabel: string,
  poweredLabel: string,
  extra: Partial<CardDef> = {},
): CardDef {
  return { id, name, englishName, color, tier, basic, powered, basicLabel, poweredLabel, copies: 1, ...extra };
}

const LOST_LEGION_BASIC_CARDS: CardDef[] = [
  card("swiftReflexes", "迅捷反射", "Swift Reflexes", "white", "basic", { move: 2 }, { range: 4 }, "移动 2", "远程攻击 4", { heroId: "wolfhawk", source: "lost-legion" }),
  card("tirelessness", "不知疲倦", "Tirelessness", "green", "basic", { move: 3 }, { move: 5 }, "移动 3", "移动 5", { heroId: "wolfhawk", source: "lost-legion" }),
  card("savageHarvesting", "野蛮采集", "Savage Harvesting", "green", "basic", { move: 2, special: "savage-harvesting" }, { move: 4, special: "savage-harvesting" }, "移动 2；本回合一次，移动后可弃一张非伤势牌获得同色水晶", "移动 4；本回合每次移动后均可弃一张非伤势牌获得同色水晶", { heroId: "krang", source: "krang" }),
  card("ruthlessCoercion", "无情胁迫", "Ruthless Coercion", "red", "basic", { influence: 2, special: "ruthless-coercion" }, { influence: 6, special: "ruthless-coercion" }, "影响力 2；招募一个盟军可再减 2，若招募则声誉 -1", "影响力 6；声誉 -1；每支付盟军等级×2影响力可重整一个 I/II 级盟军", { heroId: "krang", source: "krang" }),
  card("oneWithTheLand", "大地同心", "One With the Land", "green", "basic", { special: "one-with-the-land" }, { special: "one-with-the-land" }, "移动 2、治疗 1 或格挡 2", "移动 4、治疗 2，或按当前地形原始移动费用获得火焰格挡（白昼）/寒冰格挡（夜晚）", { heroId: "braevalar", source: "shades-of-tezla" }),
  card("druidicPaths", "德鲁伊之径", "Druidic Paths", "green", "basic", either(["移动 2", { move: 2 }], ["治疗 1", { heal: 1 }]), { move: 4, heal: 1 }, "移动 2 或治疗 1", "移动 4 并治疗 1", { heroId: "braevalar", source: "shades-of-tezla" }),
];

const LOST_LEGION_ADVANCED: CardDef[] = [
  card("counterattack", "反击", "Counterattack", "red", "advanced", { attack: 3 }, { attack: 6 }, "攻击 3；完整格挡后追加攻击", "攻击 6；按已格挡敌人数追加攻击", { cost: 6, source: "lost-legion" }),
  card("ritualAttack", "仪式攻击", "Ritual Attack", "red", "advanced", { attack: 4 }, { attack: 7, note: "可消耗水晶增强" }, "攻击 4", "攻击 7；可献祭水晶", { cost: 6, source: "lost-legion" }),
  card("bloodOfAncients", "先祖之血", "Blood of Ancients", "red", "advanced", { special: "blood-of-ancients" }, { special: "blood-of-ancients" }, "承受 1 张伤势并支付任意颜色魔力；取得供应区同色进阶行动至手牌", "承受 1 张伤势（手牌或弃牌堆）；免费使用供应区任意进阶行动的强化效果，牌留在供应区", { cost: 6, source: "lost-legion" }),
  card("shieldBash", "盾击", "Shield Bash", "blue", "advanced", { block: 3, special: "shield-bash" }, { block: 5, special: "shield-bash" }, "格挡 3；对迅捷攻击按两倍计算", "格挡 5；对迅捷攻击按两倍计算；每点超额格挡使该敌人护甲 -1（最低 1）", { cost: 6, source: "lost-legion" }),
  card("temporalPortal", "时空传送门", "Temporal Portal", "blue", "advanced", { move: 4 }, { move: 7, draw: 1 }, "移动 4；调整相邻关系", "移动 7 并抽牌 1", { cost: 6, source: "lost-legion" }),
  card("spellForge", "法术熔炉", "Spell Forge", "blue", "advanced", { special: "spell-forge" }, { special: "spell-forge" }, "获得 1 枚与法术供应区某张法术同色的水晶", "获得 2 枚水晶；每枚颜色须与法术供应区某张法术相同", { cost: 6, source: "lost-legion" }),
  card("chivalry", "骑士风范", "Chivalry", "white", "advanced", { special: "chivalry" }, { special: "chivalry" }, "攻击 3；或攻击 2，且此攻击每击败一个敌人声誉 +1", "攻击 6；或攻击 4，且此攻击每击败一个敌人声誉 +1、名望 +1", { cost: 6, source: "lost-legion" }),
  card("peacefulMoment", "宁静时刻", "Peaceful Moment", "white", "advanced", { influence: 3, special: "peaceful-moment" }, { influence: 6, special: "peaceful-moment" }, "影响力 3；可作为本回合行动，每支付 2 影响力获得治疗 1", "影响力 6；可作为行动，每支付 2 影响力获得治疗 1，及/或按盟军等级×2支付以重整盟军", { cost: 6, source: "lost-legion" }),
  card("dodgeAndWeave", "闪避穿梭", "Dodge and Weave", "white", "advanced", { move: 3, block: 2 }, { move: 5, block: 4 }, "移动 3 与格挡 2", "移动 5 与格挡 4", { cost: 6, source: "lost-legion" }),
  card("stoutResolve", "坚毅决心", "Stout Resolve", "green", "advanced", { special: "stout-resolve" }, { special: "stout-resolve" }, "移动/影响力/攻击/格挡 2 择一；可弃 1 张伤势再 +1", "移动/影响力/攻击/格挡 3 择一；可弃任意张牌（至多一张伤势），每张再 +2", { cost: 6, source: "lost-legion" }),
  card("forceOfNature", "自然之力", "Force of Nature", "green", "advanced", { special: "force-of-nature" }, { special: "force-of-nature" }, "选择一支盟军：本场战斗获得物理抗性", "攻城攻击 3 或格挡 6", { cost: 6, source: "lost-legion" }),
  card("mountainLore", "山岳学识", "Mountain Lore", "green", "advanced", { move: 3, special: "mountain-lore" }, { move: 5, special: "mountain-lore" }, "移动 3；若在丘陵结束，下次补牌手牌上限 +1", "移动 5；山地费用为 5 且可作为安全终点；在山地/丘陵结束时下次补牌上限 +2/+1", { cost: 6, source: "lost-legion" }),
];

const LOST_LEGION_SPELLS: CardDef[] = [
  card("offering", "奉献 / 牺牲", "Offering / Sacrifice", "red", "spell", { special: "offering" }, { special: "offering" }, "获得红水晶；可弃最多 3 张非伤势牌，每张再获得同色水晶（圣器自选色）", "绿/白与红/蓝各选一色；每对相应水晶转为魔力并提供对应元素的攻城 4 或远程 6", { cost: 7, source: "lost-legion" }),
  card("mistForm", "雾化 / 雾幕", "Mist Form / Veil of Mist", "blue", "spell", { move: 7 }, { block: 10 }, "移动 7；穿过敌占区域", "冷热火格挡 10", { cost: 7, source: "lost-legion" }),
  card("charm", "魅惑 / 支配", "Charm / Possess", "white", "spell", { influence: 4, special: "charm" }, { special: "charm" }, "影响力 4；若用于互动，获得任意水晶或招募一支盟军费用 -3", "目标敌人不攻击；近战阶段获得等于其攻击值及属性的攻击（忽略特效），只能攻击其他敌人", { cost: 7, source: "lost-legion" }),
  card("cure", "治愈 / 疾病", "Cure / Disease", "green", "spell", { heal: 2, special: "cure" }, { special: "cure" }, "治疗 2；本回合每从手中治疗一张伤势抽一张牌，且治疗过的盟军重整", "格挡阶段所有被完整格挡的敌人护甲降为 1", { cost: 7, source: "lost-legion" }),
];

const LOST_LEGION_ARTIFACTS: CardDef[] = [
  card("bowOfStarsdawn", "星晓之弓", "Bow of Starsdawn", "gold", "artifact", { range: 6 }, { siege: 11 }, "远程攻击 6", "弃除：攻城攻击 11", { source: "lost-legion" }),
  card("bannerOfCommand", "号令旗帜", "Banner of Command", "gold", "artifact", { influence: 4, special: "banner-command" }, { special: "banner-command" }, "影响力 4；本回合招募的盟军可用本旗帜代替指挥标记", "名望 +2；免费招募供应区任意盟军（超上限须先遣散）", { source: "lost-legion" }),
  card("bannerOfFortitude", "坚韧旗帜", "Banner of Fortitude", "gold", "artifact", { special: "banner-fortitude" }, { special: "banner-fortitude" }, "装备盟军：每轮一次，在其即将受伤时翻面，忽略伤势及附加效果", "战斗外：完全治疗所有盟军", { source: "lost-legion" }),
  card("soulHarvester", "灵魂收割者", "Soul Harvester", "gold", "artifact", { attack: 6 }, { coldfireAttack: 10 }, "攻击 6；击败敌人可获魔力", "弃除：冷热火攻击 10", { source: "lost-legion" }),
  card("shieldOfFallenKings", "陨落诸王之盾", "Shield of the Fallen Kings", "gold", "artifact", { block: 7 }, { attack: 7, block: 7 }, "格挡 7", "弃除：攻击与格挡各 7", { source: "lost-legion" }),
  card("druidicStaff", "德鲁伊法杖", "Druidic Staff", "gold", "artifact", { move: 5, heal: 2 }, { move: 9, heal: 4 }, "移动 5 与治疗 2", "弃除：移动 9 与治疗 4", { source: "lost-legion" }),
  card("circletOfProficiency", "精通头环", "Circlet of Proficiency", "gold", "artifact", { special: "circlet-proficiency" }, { special: "circlet-proficiency" }, "本回合借用公共技能区任意非互动技能；每回合型技能结算两次", "取得公共技能区任意技能，永久视作已升级获得", { source: "lost-legion" }),
  card("tomeOfAllSpells", "万法之书", "Tome of All Spells", "gold", "artifact", { special: "tome-all-spells" }, { special: "tome-all-spells" }, "弃一张任意颜色牌；免费使用供应区同色法术基础效果", "弃一张任意颜色牌；免费使用供应区同色法术强效，白昼也可", { source: "lost-legion" }),
];

const DUAL_COLOR_CARDS: CardDef[] = [
  card("powerCrystals", "水晶之力", "Power Crystals", "blue", "advanced", { crystal: 2 }, { attack: 5, block: 5 }, "凝晶 2", "攻击与格挡各 5", { alternateColor: "green", cost: 6, source: "dual-color" }),
  card("rushOfAdrenaline", "肾上腺激涌", "Rush of Adrenaline", "red", "advanced", { move: 4, attack: 2 }, { move: 6, attack: 4 }, "移动 4 与攻击 2", "移动 6 与攻击 4", { alternateColor: "white", cost: 6, source: "dual-color" }),
  card("explosiveBolt", "爆裂箭", "Explosive Bolt", "red", "advanced", { fireRange: 4 }, { fireSiege: 6 }, "火焰远程攻击 4", "火焰攻城攻击 6", { alternateColor: "green", cost: 6, source: "dual-color" }),
  card("chillingStare", "冰冷凝视", "Chilling Stare", "blue", "advanced", { special: "chilling-stare" }, { special: "chilling-stare" }, "影响力 3；或目标敌人本次攻击失去全部攻击特效（保留属性）", "影响力 5；或目标敌人本回合不攻击", { alternateColor: "white", cost: 6, source: "dual-color" }),
  card("mysteriousBox", "神秘盒", "Mysterious Box", "gold", "artifact", { special: "mysterious-box" }, { special: "mysterious-box" }, "揭示圣器牌堆顶，本回合可把神秘盒当作该圣器使用，若使用名望 +1；回合结束将揭示牌置底", "同基础效果；神秘盒是否移除取决于复制的圣器效果", { source: "dual-color" }),
];

export const EXPANSION_CARD_DEFS: Record<string, CardDef> = Object.fromEntries(
  [...LOST_LEGION_BASIC_CARDS, ...LOST_LEGION_ADVANCED, ...LOST_LEGION_SPELLS, ...LOST_LEGION_ARTIFACTS, ...DUAL_COLOR_CARDS].map((item) => [item.id, item]),
);

export const EXPANSION_ADVANCED_IDS = [...LOST_LEGION_ADVANCED, ...DUAL_COLOR_CARDS.filter((item) => item.tier === "advanced")].map((item) => item.id);
export const EXPANSION_SPELL_IDS = LOST_LEGION_SPELLS.map((item) => item.id);
export const EXPANSION_ARTIFACT_IDS = [...LOST_LEGION_ARTIFACTS, ...DUAL_COLOR_CARDS.filter((item) => item.tier === "artifact")].map((item) => item.id);

const STANDARD_START = [
  "rage", "rage", "determination", "swiftness", "swiftness", "march", "march", "stamina", "stamina", "tranquility", "promise", "threaten", "crystallize", "manaDraw", "concentration", "improvisation",
];

function expansionHeroDeck(heroId: string, replacements: Array<{ from: string; occurrence?: number; to: string }>) {
  const seen: Record<string, number> = {};
  return STANDARD_START.map((sourceId, index) => {
    seen[sourceId] = (seen[sourceId] ?? 0) + 1;
    const replacement = replacements.find((item) => item.from === sourceId && (item.occurrence ?? 1) === seen[sourceId]);
    return `${replacement?.to ?? sourceId}#${heroId}-${String(index + 1).padStart(2, "0")}`;
  });
}

export const ULTIMATE_STARTER_DECKS: Record<string, string[]> = {
  tovak: expansionHeroDeck("tovak", [{ from: "determination", to: "coldToughness" }, { from: "improvisation", to: "instinct" }]),
  arythea: expansionHeroDeck("arythea", [{ from: "rage", occurrence: 2, to: "battleVersatility" }, { from: "manaDraw", to: "manaPull" }]),
  goldyx: expansionHeroDeck("goldyx", [{ from: "concentration", to: "willFocus" }, { from: "crystallize", to: "crystalJoy" }]),
  norowas: expansionHeroDeck("norowas", [{ from: "promise", to: "nobleManners" }, { from: "tranquility", to: "rejuvenate" }]),
  wolfhawk: expansionHeroDeck("wolfhawk", [{ from: "swiftness", occurrence: 2, to: "swiftReflexes" }, { from: "stamina", occurrence: 1, to: "tirelessness" }]),
  krang: expansionHeroDeck("krang", [{ from: "march", occurrence: 1, to: "savageHarvesting" }, { from: "threaten", to: "ruthlessCoercion" }]),
  braevalar: expansionHeroDeck("braevalar", [{ from: "march", occurrence: 1, to: "oneWithTheLand" }, { from: "stamina", occurrence: 1, to: "druidicPaths" }]),
};

export const EXPANSION_HEROES: HeroDef[] = [
  { id: "wolfhawk", name: "狼鹰", title: "孤猎者", color: "white", description: "以单挑、精准射击和不依赖盟军的机动作战见长。", source: "lost-legion" },
  { id: "krang", name: "克朗", title: "混沌萨满", color: "red", description: "操纵魔力、敌军与可翻回技能，在牺牲和爆发之间切换。", source: "krang" },
  { id: "braevalar", name: "布雷瓦拉", title: "风暴德鲁伊", color: "green", description: "改变地形、召来元素与野性盟友，拥有极强的地图机动性。", source: "shades-of-tezla" },
];

function skill(heroId: string, id: string, name: string, englishName: string, description: string, effect: Partial<SkillDef> = {}, source: SkillDef["source"] = "lost-legion"): SkillDef {
  return { id: `${heroId}-${id}`, heroId, name, englishName, description, source, ...effect };
}

export const EXPANSION_HERO_SKILLS: Record<string, SkillDef[]> = {
  tovak: [skill("tovak", "mana-overload", "魔力过载", "Mana Overload", "每轮一次：选择非金色魔力并获得该魔力；本技能标记的同色强化牌首次提供移动、影响力、攻击或格挡时，该效果 +4。", { special: "mana-overload" })],
  arythea: [skill("arythea", "ritual-of-pain", "痛苦仪式", "Ritual of Pain", "每轮一次，战斗外：从手中移除至多 2 张伤势；随后可将 1 张伤势横置为移动、影响力、攻击或格挡 3。", { special: "ritual-of-pain" })],
  norowas: [skill("norowas", "calming-weather", "平息风雨", "Calming the Weather", "每轮一次：本回合所有可通行地形移动费用 -2（最低 1）。", { special: "calming-weather" })],
  goldyx: [skill("goldyx", "source-opening", "开启源泉", "Source Opening", "每轮一次：重掷 1 颗源泉骰；本回合可额外使用 1 颗基础色源泉骰并获得同色水晶。", { special: "source-opening" })],
  wolfhawk: [
    skill("wolfhawk", "refreshing-bath", "清新沐浴", "Refreshing Bath", "每回合获得治疗 1。", { resource: { heal: 1 } }),
    skill("wolfhawk", "refreshing-breeze", "清新微风", "Refreshing Breeze", "每回合获得移动 2。", { resource: { move: 2 } }),
    skill("wolfhawk", "hawk-eyes", "鹰眼", "Hawk Eyes", "每回合获得远程攻击 1。", { resource: { range: 1 } }),
    skill("wolfhawk", "on-her-own", "独来独往", "On Her Own", "每回合一次：影响力 1；若本回合不以影响力招募盟军，则改为影响力 3。", { special: "on-her-own" }),
    skill("wolfhawk", "deadly-aim", "致命瞄准", "Deadly Aim", "每回合获得攻城攻击 2。", { resource: { siege: 2 } }),
    skill("wolfhawk", "know-prey", "洞悉猎物", "Know Your Prey", "每回合获得攻击 2。", { resource: { attack: 2 } }),
    skill("wolfhawk", "taunt", "挑衅", "Taunt", "每回合获得格挡 2。", { resource: { block: 2 } }),
    skill("wolfhawk", "dueling", "决斗", "Dueling", "每回合获得格挡 1、攻击 1。", { resource: { block: 1, attack: 1 } }),
    skill("wolfhawk", "motivation", "激励", "Motivation", "手牌上限永久 +1。", { hand: 1 }),
    skill("wolfhawk", "wolf-howl", "狼之嚎", "Wolf's Howl", "每回合获得影响力 2。", { resource: { influence: 2 } }),
    skill("wolfhawk", "pack-howl", "狼群长嚎", "Howl of the Pack", "每轮一次，互动外：下一张横置牌提供 4 而非 1；每个空指挥标记再 +1。下一场战斗还可令一个敌人护甲与一次攻击各 -1。", { special: "howl-of-pack" }),
  ],
  krang: [
    skill("krang", "spirit-guides", "灵魂向导", "Spirit Guides", "每回合获得移动与影响力各 1。", { resource: { move: 1, influence: 1 } }, "krang"),
    skill("krang", "battle-hardened", "久经战阵", "Battle Hardened", "护甲永久 +1。", { armor: 1 }, "krang"),
    skill("krang", "battle-frenzy", "战斗狂热", "Battle Frenzy", "每回合一次：攻击 2；也可翻面改为攻击 4。休整时可翻回。", { special: "battle-frenzy" }, "krang"),
    skill("krang", "shamanic-ritual", "萨满仪式", "Shamanic Ritual", "翻面：获得任意颜色 1 份临时魔力；也可将翻回本技能作为本回合行动。", { special: "shamanic-ritual" }, "krang"),
    skill("krang", "regenerate", "再生", "Regenerate", "每回合获得治疗 2。", { resource: { heal: 2 } }, "krang"),
    skill("krang", "arcane-disguise", "奥术伪装", "Arcane Disguise", "每回合一次：影响力 2；或翻面以在本回合忽略声誉轨全部效果（包括 X）。支付绿色魔力可翻回。", { special: "arcane-disguise" }, "krang"),
    skill("krang", "puppet-master", "傀儡大师", "Puppet Master", "每回合获得攻击与格挡各 1。", { resource: { attack: 1, block: 1 } }, "krang"),
    skill("krang", "master-chaos", "混沌大师", "Master of Chaos", "获得时随机标记一个魔力颜色；每回合可顺时针移到下一色，并按蓝/绿/黑/白/红/金获得对应格挡、移动、冷热火远程、影响力、攻击或自选效果。", { special: "master-chaos" }, "krang"),
    skill("krang", "curse", "诅咒", "Curse", "每回合获得攻城攻击 2。", { resource: { siege: 2 } }, "krang"),
    skill("krang", "mana-suppression", "魔力压制", "Mana Suppression", "每回合获得格挡 3。", { resource: { block: 3 } }, "krang"),
    skill("krang", "mana-enhancement", "魔力强化", "Mana Enhancement", "每轮一次：在本回合支付基础色魔力后，获得同色水晶，并可再次使用该色临时魔力。", { special: "mana-enhancement" }, "krang"),
  ],
  braevalar: [
    skill("braevalar", "elemental-resistance", "元素抗性", "Elemental Resistance", "护甲永久 +1。", { armor: 1 }, "shades-of-tezla"),
    skill("braevalar", "feral-allies", "野性盟友", "Feral Allies", "指挥上限永久 +1。", { command: 1 }, "shades-of-tezla"),
    skill("braevalar", "thunderstorm", "雷暴", "Thunderstorm", "每回合获得攻城攻击 2。", { resource: { siege: 2 } }, "shades-of-tezla"),
    skill("braevalar", "lightning-storm", "闪电风暴", "Lightning Storm", "每回合获得远程攻击 2。", { resource: { range: 2 } }, "shades-of-tezla"),
    skill("braevalar", "beguile", "诱导", "Beguile", "每回合获得影响力 2。", { resource: { influence: 2 } }, "shades-of-tezla"),
    skill("braevalar", "forked-lightning", "叉状闪电", "Forked Lightning", "每回合获得攻击 2。", { resource: { attack: 2 } }, "shades-of-tezla"),
    skill("braevalar", "shapeshift", "变形", "Shapeshift", "每回合获得移动与格挡各 1。", { resource: { move: 1, block: 1 } }, "shades-of-tezla"),
    skill("braevalar", "secret-ways", "隐秘小径", "Secret Ways", "每回合获得移动 2。", { resource: { move: 2 } }, "shades-of-tezla"),
    skill("braevalar", "regenerate", "自然再生", "Regenerate", "每回合获得治疗 2。", { resource: { heal: 2 } }, "shades-of-tezla"),
    skill("braevalar", "nature-vengeance", "自然复仇", "Nature's Vengeance", "每回合获得攻击与格挡各 1。", { resource: { attack: 1, block: 1 } }, "shades-of-tezla"),
    skill("braevalar", "nature-vengeance-coop", "自然回响", "Nature's Vengeance (Co-op)", "每轮一次：目标敌人的一次攻击 -1，并在本回合获得笨重。", { special: "nature-vengeance-coop" }, "shades-of-tezla"),
  ],
};

export const EXPANSION_UNIT_DEFS: UnitDef[] = [
  { id: "scouts", name: "斥候", englishName: "Scouts", level: 1, armor: 3, cost: 4, effect: { move: 3 }, abilities: [{ id: "move", label: "移动 3", effect: { move: 3 } }, { id: "range", label: "远程攻击 2", effect: { range: 2 } }], site: "village", recruitSites: ["village", "keep"], tier: "regular", copies: 2, text: "移动 3 或远程攻击 2。", source: "lost-legion" },
  { id: "thugs", name: "暴徒", englishName: "Thugs", level: 1, armor: 5, cost: 5, effect: { attack: 3 }, abilities: [{ id: "block", label: "格挡 3", effect: { block: 3 } }, { id: "attack", label: "攻击 3；声誉 -1", effect: { attack: 3 }, reputationChange: -1 }, { id: "influence", label: "影响力 4；声誉 -1", effect: { influence: 4 }, reputationChange: -1 }], site: "village", recruitSites: ["village", "keep"], tier: "regular", copies: 2, text: "护甲 5；分配伤害时须支付 2 影响力。招募时声誉修正反向计算。", source: "lost-legion" },
  { id: "shocktroops", name: "突击队", englishName: "Shocktroops", level: 2, armor: 5, cost: 7, effect: { attack: 4 }, abilities: [{ id: "attack", label: "攻击 4", effect: { attack: 4 } }, { id: "siege", label: "自身受伤：攻城攻击 6", effect: { siege: 6 }, woundSelf: true }], site: "keep", recruitSites: ["keep", "city"], tier: "regular", copies: 2, text: "攻击 4，或令自身受伤发动攻城攻击 6。", source: "lost-legion" },
  { id: "magicFamiliars", name: "魔法使魔", englishName: "Magic Familiars", level: 2, armor: 5, cost: 6, effect: { attack: 3 }, abilities: [{ id: "attack", label: "攻击 3（红色水晶时 +2）", effect: { attack: 3 } }, { id: "block", label: "格挡 4（蓝色水晶时 +3）", effect: { block: 4 } }, { id: "move", label: "移动 3（白色水晶时 +2）", effect: { move: 3 } }, { id: "influence", label: "影响力 3（白色水晶时 +2）", effect: { influence: 3 } }, { id: "heal", label: "治疗 2（绿色水晶时 +1）", effect: { heal: 2 } }], site: "mageTower", recruitSites: ["mageTower", "monastery"], tier: "regular", copies: 2, text: "招募时额付 1 份基础魔力并放置同色水晶；每轮开始必须从库存替换。也可在魔法林地招募。", source: "lost-legion" },
  { id: "heroWhite", name: "白色英雄", englishName: "Hero (White)", level: 4, armor: 5, cost: 10, effect: { range: 5 }, abilities: [{ id: "range", label: "远程攻击 5", effect: { range: 5 } }, { id: "influence", label: "影响力 6", effect: { influence: 6 } }], site: "city", recruitSites: ["city"], tier: "elite", copies: 1, text: "擅长远程攻击与外交。", source: "lost-legion" },
  { id: "heroGreen", name: "绿色英雄", englishName: "Hero (Green)", level: 4, armor: 6, cost: 10, effect: { move: 5 }, abilities: [{ id: "move", label: "移动 5", effect: { move: 5 } }, { id: "heal", label: "治疗 3", effect: { heal: 3 } }], site: "city", recruitSites: ["city"], tier: "elite", copies: 1, text: "提供机动与治疗。", source: "lost-legion" },
  { id: "heroBlue", name: "蓝色英雄", englishName: "Hero (Blue)", level: 4, armor: 7, cost: 11, effect: { iceBlock: 7 }, abilities: [{ id: "block", label: "寒冰格挡 7", effect: { iceBlock: 7 } }, { id: "attack", label: "寒冰攻击 6", effect: { iceAttack: 6 } }], resistances: ["ice"], site: "city", recruitSites: ["city"], tier: "elite", copies: 1, text: "寒冰抗性与强力攻防。", source: "lost-legion" },
  { id: "heroRed", name: "红色英雄", englishName: "Hero (Red)", level: 4, armor: 6, cost: 11, effect: { fireAttack: 7 }, abilities: [{ id: "attack", label: "火焰攻击 7", effect: { fireAttack: 7 } }, { id: "siege", label: "火焰攻城攻击 5", effect: { fireSiege: 5 } }], resistances: ["fire"], site: "city", recruitSites: ["city"], tier: "elite", copies: 1, text: "火焰抗性与攻城能力。", source: "lost-legion" },
  { id: "sorcerers", name: "术士", englishName: "Sorcerers", level: 4, armor: 5, cost: 12, effect: { coldfireAttack: 6 }, abilities: [{ id: "attack", label: "冷热火攻击 6", effect: { coldfireAttack: 6 } }, { id: "cancel", label: "支付蓝色魔力：取消一名敌人的攻击", manaCost: ["blue"], cancelEnemyAttack: true }], resistances: ["fire", "ice"], site: "mageTower", recruitSites: ["mageTower", "city"], tier: "elite", copies: 2, text: "冷热火攻击与攻击取消。", source: "lost-legion" },
  { id: "delphanaMasters", name: "德尔法娜大师", englishName: "Delphana Masters", level: 4, armor: 3, cost: 13, effect: {}, abilities: [{ id: "blue", label: "支付蓝色魔力：目标敌人不攻击", manaCost: ["blue"], delphanaEffect: "cancel" }, { id: "red", label: "支付红色魔力：目标若被完整格挡则摧毁", manaCost: ["red"], delphanaEffect: "destroy-if-blocked" }, { id: "green", label: "支付绿色魔力：目标护甲 -5（最低 1）", manaCost: ["green"], delphanaEffect: "armor-minus-five" }, { id: "white", label: "支付白色魔力：目标失去全部防御工事与抗性", manaCost: ["white"], delphanaEffect: "strip-defense" }], resistances: ["physical", "fire", "ice"], site: "city", recruitSites: ["city"], tier: "elite", copies: 2, multiAbility: true, text: "仅可通过城市/难民营互动招募；一次启用后，可在本场战斗中各发动不同能力一次。", source: "lost-legion" },
];

export function expansionUnitIds(tier: "regular" | "elite") {
  return EXPANSION_UNIT_DEFS.filter((unit) => unit.tier === tier).flatMap((unit) =>
    Array.from({ length: unit.copies ?? 1 }, (_, index) => `${unit.id}@${index + 1}`),
  );
}

type EnemySpec = Omit<Enemy, "id" | "tokenColor"> & { key: string; copies: number };

function enemyTokens(color: EnemyTokenColor, specs: EnemySpec[]): Enemy[] {
  return specs.flatMap((spec) => Array.from({ length: spec.copies }, (_, index) => {
    const { key, copies: _copies, ...enemy } = spec;
    void _copies;
    return { ...enemy, id: `${color}-ue-${key}-${index + 1}`, tokenColor: color };
  }));
}

const LOST_LEGION_ENEMIES: Enemy[] = [
  ...enemyTokens("green", [
    { key: "orc-skirmishers", copies: 2, name: "兽人散兵", armor: 4, attack: 3, attackCount: 2, fame: 4, swift: true, description: "两次迅捷攻击，必须分别应对。", source: "lost-legion" },
    { key: "orc-war-beasts", copies: 2, name: "兽人战争巨兽", armor: 5, attack: 6, fame: 5, brutal: true, description: "残暴的兽人战争巨兽。", source: "lost-legion" },
    { key: "orc-trackers", copies: 2, name: "兽人追踪者", armor: 4, attack: 5, fame: 4, assassination: true, description: "刺杀攻击只能由英雄承受。", source: "lost-legion" },
    { key: "orc-stonethrower", copies: 2, name: "兽人投石手", armor: 5, attack: 5, fame: 5, fortified: true, cumbersome: true, description: "自带工事；笨重攻击可用移动点辅助格挡。", source: "lost-legion" },
  ]),
  ...enemyTokens("violet", [
    { key: "sorcerers", copies: 2, name: "术士", armor: 6, attack: 6, fame: 5, poison: true, assassination: true, arcaneImmunity: true, description: "奥术免疫、刺杀与中毒。", source: "lost-legion" },
    { key: "magic-familiars", copies: 2, name: "魔法使魔", armor: 5, attack: 4, attackCount: 2, fame: 5, summon: true, description: "多重攻击并召来额外怪物。", source: "lost-legion" },
  ]),
  ...enemyTokens("gray", [
    { key: "hero-white", copies: 1, name: "白色英雄", armor: 6, attack: 6, fame: 6, swift: true, description: "迅捷的精锐英雄。", source: "lost-legion" },
    { key: "hero-green", copies: 1, name: "绿色英雄", armor: 7, attack: 5, fame: 6, defend: 1, description: "守护同组敌军，提高其护甲。", source: "lost-legion" },
    { key: "hero-blue", copies: 1, name: "蓝色英雄", armor: 6, attack: 6, fame: 6, attackElement: "ice", resistances: ["ice"], description: "寒冰抗性与寒冰攻击。", source: "lost-legion" },
    { key: "hero-red", copies: 1, name: "红色英雄", armor: 6, attack: 7, fame: 6, attackElement: "fire", resistances: ["fire"], description: "火焰抗性与火焰攻击。", source: "lost-legion" },
    { key: "thugs", copies: 2, name: "暴徒", armor: 5, attack: 6, fame: 5, brutal: true, description: "残暴的雇佣守军。", source: "lost-legion" },
    { key: "shocktroops", copies: 2, name: "突击队", armor: 6, attack: 5, attackCount: 2, fame: 6, description: "发动两次独立攻击。", source: "lost-legion" },
  ]),
  ...enemyTokens("brown", [
    { key: "shadow", copies: 2, name: "暗影", armor: 4, elusiveArmor: 8, attack: 5, fame: 6, arcaneImmunity: true, description: "奥术免疫；未被格挡时使用较高的飘忽护甲。", source: "lost-legion" },
    { key: "manticore", copies: 2, name: "蝎尾狮", armor: 6, attack: 5, attackCount: 2, fame: 6, poison: true, description: "多重中毒攻击。", source: "lost-legion" },
    { key: "hydra", copies: 2, name: "九头蛇", armor: 7, attack: 3, attackCount: 3, fame: 7, brutal: true, description: "三次残暴攻击。", source: "lost-legion" },
  ]),
  ...enemyTokens("red", [
    { key: "storm-dragon", copies: 2, name: "风暴巨龙", armor: 8, attack: 7, fame: 9, swift: true, attackElement: "coldfire", resistances: ["fire", "ice"], description: "冷热火攻击、双元素抗性与迅捷。", source: "lost-legion" },
    { key: "lava-dragon", copies: 2, name: "熔岩巨龙", armor: 9, attack: 8, fame: 10, brutal: true, attackElement: "fire", resistances: ["physical", "fire"], description: "物理/火焰抗性与残暴火焰攻击。", source: "lost-legion" },
    { key: "dragon-summoner", copies: 2, name: "巨龙召唤师", armor: 8, attack: 6, fame: 9, summon: true, arcaneImmunity: true, resistances: ["physical"], description: "奥术免疫、物理抗性并召唤两阶段怪物。", source: "lost-legion" },
  ]),
  ...enemyTokens("white", [
    { key: "grim-legionnaires", copies: 2, name: "冷酷军团兵", armor: 8, attack: 7, fame: 8, arcaneImmunity: true, fortified: true, description: "奥术免疫且自带工事。", source: "lost-legion" },
    { key: "fire-catapult", copies: 1, name: "火焰投石车", armor: 7, attack: 8, fame: 7, attackElement: "fire", cumbersome: true, fortified: true, description: "笨重火焰攻击与防御工事。", source: "lost-legion" },
    { key: "delphana-masters", copies: 2, name: "德尔法娜大师", armor: 7, attack: 7, fame: 8, arcaneImmunity: true, attackElement: "coldfire", resistances: ["fire", "ice"], description: "奥术免疫、冷热火攻击与双元素抗性。", source: "lost-legion" },
    { key: "ice-catapult", copies: 1, name: "寒冰投石车", armor: 7, attack: 8, fame: 7, attackElement: "ice", cumbersome: true, fortified: true, description: "笨重寒冰攻击与防御工事。", source: "lost-legion" },
  ]),
];

const SHADES_ENEMIES: Enemy[] = [
  ...enemyTokens("green", [
    { key: "crystal-sprites", copies: 2, name: "水晶精灵", armor: 4, attack: 4, fame: 2, swift: true, faction: "elementalists", description: "元素派系；迅捷并掉落元素派系标记。", source: "shades-of-tezla" },
    { key: "elven-protectors", copies: 2, name: "精灵守护者", armor: 5, attack: 4, fame: 3, defend: 1, faction: "elementalists", description: "元素派系；防卫同组敌军。", source: "shades-of-tezla" },
    { key: "centaur-outriders", copies: 2, name: "半人马游骑", armor: 5, attack: 5, fame: 3, swift: true, faction: "elementalists", description: "元素派系；迅捷骑兵。", source: "shades-of-tezla" },
    { key: "elemental-priestesses", copies: 1, name: "元素女祭司", armor: 6, attack: 5, fame: 4, summon: true, faction: "elementalists", description: "元素派系；召唤元素怪物。", source: "shades-of-tezla" },
    { key: "cloud-griffons", copies: 1, name: "云端狮鹫", armor: 5, elusiveArmor: 8, attack: 6, fame: 4, faction: "elementalists", description: "元素派系；具有飘忽护甲。", source: "shades-of-tezla" },
    { key: "skeletal-warriors", copies: 2, name: "骸骨战士", armor: 5, attack: 4, fame: 2, resistances: ["physical"], faction: "dark-crusaders", description: "黑暗十字军；物理抗性。", source: "shades-of-tezla" },
    { key: "zombie-horde", copies: 2, name: "僵尸群", armor: 6, attack: 5, fame: 3, poison: true, cumbersome: true, faction: "dark-crusaders", description: "黑暗十字军；中毒且笨重。", source: "shades-of-tezla" },
    { key: "gibbering-ghouls", copies: 2, name: "呢喃食尸鬼", armor: 5, attack: 4, attackCount: 2, fame: 3, poison: true, faction: "dark-crusaders", description: "黑暗十字军；多重中毒攻击。", source: "shades-of-tezla" },
    { key: "corrupted-priests", copies: 1, name: "堕落祭司", armor: 6, attack: 6, fame: 4, assassination: true, faction: "dark-crusaders", description: "黑暗十字军；刺杀攻击。", source: "shades-of-tezla" },
    { key: "shrouded-necromancers", copies: 1, name: "蒙面死灵法师", armor: 5, elusiveArmor: 9, attack: 5, fame: 4, summon: true, arcaneImmunity: true, faction: "dark-crusaders", description: "黑暗十字军；奥术免疫、飘忽并召唤。", source: "shades-of-tezla" },
  ]),
  ...enemyTokens("brown", [
    { key: "air-elemental", copies: 1, name: "气元素", armor: 5, attack: 5, fame: 4, swift: true, attackElement: "ice", resistances: ["ice"], faction: "elementalists", description: "元素派系；迅捷寒冰攻击。", source: "shades-of-tezla" },
    { key: "earth-elemental", copies: 1, name: "土元素", armor: 8, attack: 6, fame: 5, fortified: true, resistances: ["physical"], faction: "elementalists", description: "元素派系；物理抗性与工事。", source: "shades-of-tezla" },
    { key: "fire-elemental", copies: 1, name: "火元素", armor: 6, attack: 7, fame: 5, attackElement: "fire", resistances: ["fire"], faction: "elementalists", description: "元素派系；火焰攻击与火焰抗性。", source: "shades-of-tezla" },
    { key: "water-elemental", copies: 1, name: "水元素", armor: 6, attack: 6, fame: 5, attackElement: "ice", resistances: ["ice"], faction: "elementalists", description: "元素派系；寒冰攻击与寒冰抗性。", source: "shades-of-tezla" },
    { key: "pain-wraith", copies: 1, name: "痛苦怨灵", armor: 5, elusiveArmor: 9, attack: 5, fame: 5, paralyze: true, faction: "dark-crusaders", description: "黑暗十字军；飘忽与麻痹。", source: "shades-of-tezla" },
    { key: "mummy", copies: 1, name: "木乃伊", armor: 7, attack: 6, fame: 5, poison: true, resistances: ["physical"], faction: "dark-crusaders", description: "黑暗十字军；物理抗性与中毒。", source: "shades-of-tezla" },
    { key: "vampire", copies: 1, name: "吸血鬼", armor: 6, attack: 6, fame: 5, swift: true, assassination: true, faction: "dark-crusaders", description: "黑暗十字军；迅捷刺杀。", source: "shades-of-tezla" },
    { key: "blood-demon", copies: 1, name: "鲜血恶魔", armor: 7, attack: 7, fame: 6, brutal: true, poison: true, faction: "dark-crusaders", description: "黑暗十字军；残暴中毒攻击。", source: "shades-of-tezla" },
  ]),
  ...enemyTokens("red", [
    { key: "savage-dragon", copies: 2, name: "蛮荒巨龙", armor: 8, attack: 8, fame: 8, brutal: true, faction: "elementalists", description: "元素派系巨龙；残暴攻击。", source: "shades-of-tezla" },
    { key: "lightning-dragon", copies: 2, name: "闪电巨龙", armor: 8, attack: 7, attackCount: 2, fame: 9, swift: true, attackElement: "coldfire", faction: "elementalists", description: "元素派系巨龙；迅捷多重冷热火攻击。", source: "shades-of-tezla" },
    { key: "death-dragon", copies: 2, name: "死亡巨龙", armor: 9, attack: 7, fame: 9, paralyze: true, resistances: ["physical"], faction: "dark-crusaders", description: "黑暗十字军巨龙；物理抗性与麻痹。", source: "shades-of-tezla" },
    { key: "vampiric-dragon", copies: 2, name: "吸血巨龙", armor: 9, attack: 8, fame: 10, brutal: true, poison: true, faction: "dark-crusaders", description: "黑暗十字军巨龙；残暴中毒攻击。", source: "shades-of-tezla" },
  ]),
];

export const EXPANSION_ENEMY_TOKENS = [...LOST_LEGION_ENEMIES, ...SHADES_ENEMIES];

export const EXPANSION_RUIN_TOKENS: RuinToken[] = [
  { id: "ll-gray-red", name: "军团与巨龙守卫", enemies: ["gray", "red"], reward: "artifact", description: "击败军团守卫与巨龙后获得 1 件圣器。", source: "lost-legion" },
  { id: "ll-violet-white", name: "术士与军团守卫", enemies: ["violet", "white"], reward: "spell", description: "击败术士与失落军团后获得 1 张法术。", source: "lost-legion" },
  { id: "ll-green-white", name: "兽人与军团守卫", enemies: ["green", "white"], reward: "advanced", description: "击败兽人与失落军团后获得 1 张进阶行动。", source: "lost-legion" },
];

export const ULTIMATE_COMPONENT_COUNTS = {
  heroes: 7,
  basicActions: 112,
  advancedActions: 44,
  spells: 24,
  artifacts: 25,
  wounds: 52,
  tactics: 12,
  regularUnits: 28,
  eliteUnits: 28,
  soloSkills: 77,
  enemies: 130,
  ruins: 15,
  mapTiles: 26,
  factionTokens: 24,
  shadesLocations: 3,
} as const;
