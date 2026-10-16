import type { CardDef, CardEffect, Enemy, EnemyTokenColor, ManaColor, RuinToken, SkillDef, UnitDef } from "./game-data";

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
  return { id, name, englishName, color, tier, basic, powered, basicLabel, poweredLabel, ...extra };
}

const BASIC_CARDS: CardDef[] = [
  card("rage", "怒火", "Rage", "red", "basic", { attack: 2 }, { attack: 4 }, "攻击 2", "攻击 4"),
  card("determination", "决意", "Determination", "blue", "basic", { block: 2 }, { block: 5 }, "格挡 2", "格挡 5"),
  card("swiftness", "迅捷", "Swiftness", "white", "basic", { move: 2 }, { range: 3 }, "移动 2", "远程攻击 3"),
  card("march", "行军", "March", "green", "basic", { move: 2 }, { move: 4 }, "移动 2", "移动 4"),
  card("stamina", "耐力", "Stamina", "green", "basic", { move: 2 }, { move: 4 }, "移动 2", "移动 4"),
  card("tranquility", "宁静", "Tranquility", "green", "basic", either(["治疗 1", { heal: 1 }], ["抽牌 1", { draw: 1 }]), either(["治疗 2", { heal: 2 }], ["抽牌 2", { draw: 2 }]), "治疗 1 或抽牌 1", "治疗 2 或抽牌 2"),
  card("promise", "承诺", "Promise", "white", "basic", { influence: 2 }, { influence: 4 }, "影响力 2", "影响力 4"),
  card("threaten", "威吓", "Threaten", "red", "basic", { influence: 2 }, { influence: 5, note: "回合结束声誉 -1" }, "影响力 2", "影响力 5，声誉 -1"),
  card("crystallize", "凝晶", "Crystallize", "blue", "basic", { crystal: 1 }, { crystal: 2 }, "获得 1 次凝晶", "获得 2 次凝晶"),
  card("manaDraw", "魔力汲取", "Mana Draw", "white", "basic", { note: "本回合可以额外使用 1 颗源泉骰" }, { note: "取 1 颗源泉骰并改为任意非金色；获得该颜色 2 枚临时魔力，归还时不重掷" }, "本回合额外使用 1 颗源泉骰", "取 1 颗源泉骰，改色并获得同色临时魔力 ×2", { additionalSourceUses: { basic: 1 } }),
  card("concentration", "专注", "Concentration", "green", "basic", { special: "concentration" }, { special: "concentration" }, "获得 1 份蓝/白/红临时魔力", "免费使用另一张行动牌的强化效果；其移动/影响/格挡/攻击 +2"),
  card("improvisation", "临机应变", "Improvisation", "red", "basic",
    either(["移动 3", { move: 3 }], ["影响力 3", { influence: 3 }], ["攻击 3", { attack: 3 }], ["格挡 3", { block: 3 }]),
    either(["移动 5", { move: 5 }], ["影响力 5", { influence: 5 }], ["攻击 5", { attack: 5 }], ["格挡 5", { block: 5 }]),
    "弃另一张非伤势牌；移动/影响力/攻击/格挡择一获得 3",
    "弃另一张非伤势牌；同类资源择一获得 5"),
  card("coldToughness", "寒冷坚韧", "Cold Toughness", "blue", "basic", { iceBlock: 3 }, { iceBlock: 5, iceAttack: 1 }, "寒冰格挡 3", "寒冰格挡 5；多余格挡可转寒冰攻击", { heroId: "tovak" }),
  card("battleVersatility", "战斗多面手", "Battle Versatility", "red", "basic", either(["攻击 2", { attack: 2 }], ["格挡 2", { block: 2 }], ["攻城攻击 2", { siege: 2 }]), { attack: 4, block: 2 }, "攻击、格挡或攻城攻击 2", "按需要组合战斗资源", { heroId: "arythea" }),
  card("willFocus", "意志专注", "Will Focus", "green", "basic", { special: "will-focus" }, { special: "will-focus" }, "获得 1 份蓝/白/红临时魔力，或获得 1 枚绿色水晶", "免费使用另一张行动牌的强化效果；其移动/影响/格挡/攻击 +3", { heroId: "goldyx" }),
  card("nobleManners", "高贵礼仪", "Noble Manners", "white", "basic", { influence: 2, special: "noble-manners" }, { influence: 4, special: "noble-manners" }, "影响力 2；用于互动则回合结束名望 +1", "影响力 4；用于互动则回合结束名望 +1、声誉 +1", { heroId: "norowas" }),
  card("instinct", "战斗本能", "Instinct", "white", "basic", { block: 2 }, { attack: 3, block: 2 }, "格挡 2", "攻击 3 与格挡 2", { heroId: "tovak" }),
  card("manaPull", "魔力牵引", "Mana Pull", "blue", "basic", { special: "mana-pull" }, { special: "mana-pull" }, "本回合可额外使用 1 颗源泉骰；黑骰可视为任意颜色", "取 2 颗源泉骰并分别改为非金色，获得对应临时魔力；归还时不重掷", { heroId: "arythea", additionalSourceUses: { basic: 1 } }),
  card("crystalJoy", "水晶之悦", "Crystal Joy", "blue", "basic", { crystal: 1 }, { crystal: 2, draw: 1 }, "获得 1 次凝晶", "获得 2 次凝晶并抽牌 1", { heroId: "goldyx" }),
  card("rejuvenate", "焕发活力", "Rejuvenate", "green", "basic", either(["治疗 1", { heal: 1 }], ["移动 2", { move: 2 }]), { heal: 2, draw: 1 }, "治疗 1 或移动 2", "治疗 2 并抽牌 1", { heroId: "norowas" }),
];

const ADVANCED_CARDS: CardDef[] = [
  card("fireBolt", "火焰箭", "Fire Bolt", "red", "advanced", { fireRange: 3 }, { fireSiege: 5 }, "远程火焰攻击 3", "火焰攻城攻击 5"),
  card("iceBolt", "寒冰箭", "Ice Bolt", "blue", "advanced", { iceRange: 3 }, { iceSiege: 5 }, "远程寒冰攻击 3", "寒冰攻城攻击 5"),
  card("swiftBolt", "迅疾箭", "Swift Bolt", "white", "advanced", { range: 3 }, { range: 5 }, "远程攻击 3", "远程攻击 5"),
  card("crushingBolt", "粉碎箭", "Crushing Bolt", "green", "advanced", { siege: 3 }, { siege: 5 }, "攻城攻击 3", "攻城攻击 5"),
  card("bloodRage", "血怒", "Blood Rage", "red", "advanced", { attack: 2, special: "blood-rage" }, { attack: 4, special: "blood-rage" }, "攻击 2；可承受 1 张伤势改为攻击 5", "攻击 4；可承受 1 张伤势改为攻击 9"),
  card("iceShield", "冰盾", "Ice Shield", "blue", "advanced", { iceBlock: 4 }, { iceBlock: 7 }, "寒冰格挡 4", "寒冰格挡 7"),
  card("agility", "敏捷", "Agility", "white", "advanced", { move: 4 }, { attack: 3, block: 3 }, "移动 4", "攻击与格挡各 3"),
  card("refreshingWalk", "振奋步伐", "Refreshing Walk", "green", "advanced", { move: 4 }, { move: 6, heal: 1 }, "移动 4", "移动 6，治疗 1"),
  card("intimidate", "恐吓", "Intimidate", "red", "advanced", { special: "intimidate", choices: [{ label: "影响力 4", effect: { influence: 4, special: "intimidate" } }, { label: "攻击 3", effect: { attack: 3, special: "intimidate" } }] }, { special: "intimidate", choices: [{ label: "影响力 8", effect: { influence: 8, special: "intimidate" } }, { label: "攻击 7", effect: { attack: 7, special: "intimidate" } }] }, "影响力 4 或攻击 3；声誉 -1", "影响力 8 或攻击 7；声誉 -2"),
  card("frostBridge", "霜桥", "Frost Bridge", "blue", "advanced", { move: 2, special: "frost-bridge" }, { move: 4, special: "frost-bridge" }, "移动 2；本回合沼泽费用降为 1", "移动 4；本回合湖泊可通行，湖泊与沼泽费用降为 1"),
  card("songOfWind", "风之歌", "Song of Wind", "white", "advanced", { move: 2, special: "song-of-wind" }, { move: 2, special: "song-of-wind" }, "移动 2；平原/沙漠/荒地费用 -1（最低 0）", "移动 2；平原/沙漠/荒地费用 -2（最低 0）；可再付蓝魔使湖泊费用为 0"),
  card("pathfinding", "寻路", "Path Finding", "green", "advanced", { move: 2, special: "path-finding" }, { move: 4, special: "path-finding" }, "移动 2；所有地形费用 -1（最低 2）", "移动 4；所有可进入地形费用降为 2"),
  card("bloodRitual", "血之仪式", "Blood Ritual", "red", "advanced", { special: "blood-ritual" }, { special: "blood-ritual" }, "承受 1 张伤势；获得 1 枚红水晶与任意 1 份临时魔力", "承受 1 张伤势；获得任意 3 份临时魔力；可用 1 份基础魔力凝聚同色水晶"),
  card("pureMagic", "纯粹魔法", "Pure Magic", "blue", "advanced", { special: "pure-magic" }, { special: "pure-magic" }, "额外支付 1 份魔力：绿=移动4、白=影响4、蓝=格挡4、红=攻击4", "额外支付 1 份魔力：绿=移动7、白=影响7、蓝=格挡7、红=攻击7"),
  card("heroicTale", "英雄传说", "Heroic Tale", "white", "advanced", { influence: 3, draw: 1 }, { influence: 6, draw: 1 }, "影响力 3，抽牌 1", "影响力 6，抽牌 1"),
  card("regenerationAction", "再生", "Regeneration", "green", "advanced", { heal: 2 }, { heal: 3, draw: 1 }, "治疗 2", "治疗 3，抽牌 1"),
  card("intoTheHeat", "投身战火", "Into the Heat", "red", "advanced", { special: "into-the-heat" }, { special: "into-the-heat" }, "仅战斗开始时：本场盟军的攻击/格挡各 +2；本回合不能向盟军分配伤害", "仅战斗开始时：本场盟军的攻击/格挡各 +3；本回合不能向盟军分配伤害"),
  card("steadyTempo", "稳健节奏", "Steady Tempo", "blue", "advanced", { move: 2, special: "steady-tempo" }, { move: 4, special: "steady-tempo" }, "移动 2；若牌库非空，回合结束可置于牌库底", "移动 4；回合结束可置于牌库顶"),
  card("diplomacy", "外交", "Diplomacy", "white", "advanced", { influence: 2, special: "diplomacy" }, { influence: 4, special: "diplomacy" }, "影响力 2；本回合影响力也可当作普通格挡", "影响力 4；选择火焰或寒冰，本回合影响力也可当作该元素格挡"),
  card("inNeed", "危难相助", "In Need", "green", "advanced", { influence: 3, special: "in-need" }, { influence: 5, special: "in-need" }, "影响力 3；手牌及盟军上每张伤势再 +1", "影响力 5；手牌及盟军上每张伤势再 +2"),
  card("decompose", "分解", "Decompose", "red", "advanced", { special: "decompose" }, { special: "decompose" }, "从手中移除 1 张行动牌；获得 2 枚与该牌同色的水晶", "从手中移除 1 张行动牌；获得与该牌不同的三种基础色水晶各 1 枚"),
  card("crystalMastery", "水晶掌握", "Crystal Mastery", "blue", "advanced", { special: "crystal-mastery" }, { special: "crystal-mastery" }, "获得 1 枚你已经拥有的同色水晶", "回合结束时，将本回合花费的所有水晶返还库存"),
  card("manaStorm", "魔力风暴", "Mana Storm", "white", "advanced", { special: "mana-storm" }, { special: "mana-storm" }, "选择源泉中 1 颗基础色骰：获得同色水晶，然后重掷该骰", "重掷所有未使用源泉骰；本回合可额外使用 3 颗，金/黑骰可作任意基础色"),
  card("ambush", "伏击", "Ambush", "green", "advanced", { move: 2, attack: 2 }, { move: 2, attack: 4 }, "移动 2；战斗中攻击/格挡 +2", "移动 2；战斗中攻击/格挡 +4", { preserveCombatAfterMovement: true }),
  card("maximalEffect", "极限发挥", "Maximal Effect", "red", "advanced", { special: "maximal-effect" }, { special: "maximal-effect" }, "同时使用另一张行动牌：其基础效果结算 3 次，然后将其移出游戏", "同时使用另一张行动牌：免费结算其强化效果 2 次，然后将其移出游戏"),
  card("magicTalent", "魔法天赋", "Magic Talent", "blue", "advanced", { special: "magic-talent" }, { special: "magic-talent" }, "弃 1 张手牌；本回合可将供应区同色法术当作手牌施放，法术仍留在供应", "支付任意颜色魔力；获得供应区同色法术并置入弃牌堆"),
  card("learning", "学习", "Learning", "white", "advanced", { draw: 1, influence: 2 }, { draw: 2, influence: 3 }, "抽牌 1，影响力 2", "抽牌 2，影响力 3"),
  card("training", "训练", "Training", "green", "advanced", { special: "training" }, { special: "training" }, "从手中移除 1 张行动牌；取得供应区同色进阶行动并置入弃牌堆", "从手中移除 1 张行动牌；取得供应区同色进阶行动并置入手牌"),
].map((item) => ({ ...item, cost: 6, copies: 1 }));

const SPELL_CARDS: CardDef[] = [
  card("firestorm", "火球 / 火焰风暴", "Fireball / Firestorm", "red", "spell", { fireAttack: 5 }, { fireSiege: 9 }, "火焰攻击 5", "火焰攻城攻击 9"),
  card("blizzard", "暴雪 / 冰封暴雪", "Snowstorm / Blizzard", "blue", "spell", { iceBlock: 7 }, { iceAttack: 8 }, "寒冰格挡 7", "寒冰攻击 8"),
  card("massExpose", "暴露 / 群体暴露", "Expose / Mass Expose", "white", "spell", { range: 4 }, { range: 8 }, "远程攻击 4；忽略工事", "远程攻击 8；群体忽略工事"),
  card("tremor", "震颤 / 地震", "Tremor / Earthquake", "green", "spell", { siege: 6 }, { siege: 10 }, "攻城攻击 6", "攻城攻击 10"),
  card("flameWall", "火墙 / 火焰浪潮", "Flame Wall / Flame Wave", "red", "spell", { fireBlock: 6 }, { fireAttack: 8 }, "火焰格挡 6", "火焰攻击 8"),
  card("manaBolt", "魔力箭 / 魔力雷霆", "Mana Bolt / Mana Thunderbolt", "blue", "spell", { coldfireAttack: 5 }, { coldfireAttack: 9 }, "冷热火攻击 5", "冷热火攻击 9"),
  card("whirlwind", "旋风 / 龙卷风", "Whirlwind / Tornado", "white", "spell", { move: 6 }, { siege: 8 }, "移动 6 或移开一个敌人", "摧毁目标或攻城攻击 8"),
  card("undergroundTravel", "地下穿行 / 地底突袭", "Underground Travel / Underground Attack", "green", "spell", { special: "underground-travel" }, { special: "underground-travel" }, "最多穿行 3 个已揭示且非湖泊/沼泽的区域；终点必须安全且不激怒游荡敌人", "同基础效果，但必须在防御地点结束并发动强攻；忽略地点工事，撤退回原位"),
  card("burningShield", "燃烧护盾 / 爆裂护盾", "Burning Shield / Exploding Shield", "red", "spell", { fireBlock: 4, special: "burning-shield" }, { fireBlock: 4, special: "burning-shield" }, "火焰格挡 4；若完整格挡，近战阶段可再作火焰攻击 4", "火焰格挡 4；若完整格挡，摧毁被格挡敌人"),
  card("chill", "严寒 / 致命严寒", "Chill / Lethal Chill", "blue", "spell", { special: "chill" }, { special: "chill" }, "目标敌人本场不攻击；若有火焰抗性，本回合失去它", "目标敌人本场不攻击且护甲 -4（最低 1）"),
  card("wings", "风之翼 / 夜之翼", "Wings of Wind / Wings of Night", "white", "spell", { special: "wings" }, { special: "wings" }, "支付 1–5 移动，每点穿越 1 个已揭示区域；终点须安全且不激怒游荡敌人", "目标敌人本场不攻击；追加第 2/3…个目标分别支付 1/2…移动"),
  card("restoration", "复原 / 重生", "Restoration / Rebirth", "green", "spell", either(["治疗 3", { heal: 3 }], ["抽牌 1", { draw: 1 }]), { heal: 5, draw: 2 }, "治疗 3 或抽牌 1", "治疗 5，抽牌 2"),
  card("demolish", "拆毁 / 瓦解", "Demolish / Disintegrate", "red", "spell", { special: "demolish" }, { special: "demolish" }, "本回合忽略地点工事；敌人护甲 -1（最低 1，火焰抗性免疫减甲）", "仅近战攻击阶段：摧毁目标敌人；其余敌人护甲 -1（最低 1，火焰抗性免疫）"),
  card("spaceBending", "空间扭曲 / 时间扭曲", "Space Bending / Time Bending", "blue", "spell", { special: "space-bending" }, { special: "space-bending" }, "本回合可把距离 2 的区域/板块当作相邻；忽略越过区域且不激怒游荡敌人", "回合结束将本牌移出本轮，其他已打出牌回手；跳过补牌并立即再进行一回合"),
  card("callToArms", "征召 / 荣耀召唤", "Call to Arms / Call to Glory", "white", "spell", { special: "call-to-arms" }, { special: "call-to-arms" }, "本回合把供应区一个盟军的一项能力当作自己的盟军使用；不能给它分配伤害", "免费招募供应区任意一个盟军；超过指挥限额时须先遣散一个"),
  card("meditation", "冥想 / 入定", "Meditation / Trance", "green", "spell", { special: "meditation" }, { special: "meditation" }, "随机取弃牌堆 2 张置于行动牌库顶或底；回合结束额外抽 2 张", "选择弃牌堆 2 张置于行动牌库顶或底；回合结束额外抽 2 张"),
  card("manaMeltdown", "魔力熔毁 / 魔力辉耀", "Mana Meltdown / Mana Radiance", "red", "spell", { special: "mana-meltdown" }, { special: "mana-meltdown" }, "互动法术：仅多人竞争规则使用；单人/合作设置时移除", "互动法术：仅多人竞争规则使用；单人/合作设置时移除"),
  card("manaClaim", "魔力占据 / 魔力诅咒", "Mana Claim / Mana Curse", "blue", "spell", { special: "mana-claim" }, { special: "mana-claim" }, "互动法术：仅多人竞争规则使用；单人/合作设置时移除", "互动法术：仅多人竞争规则使用；单人/合作设置时移除"),
  card("mindRead", "读心 / 心灵窃取", "Mind Read / Mind Steal", "white", "spell", { influence: 7 }, { draw: 3, influence: 7 }, "影响力 7；查看信息", "抽牌 3，影响力 7"),
  card("energyFlow", "能量流 / 能量窃取", "Energy Flow / Energy Steal", "green", "spell", { heal: 2, crystal: 1 }, { heal: 4, crystal: 2 }, "治疗 2，凝晶 1", "治疗 4，凝晶 2"),
].map((item) => ({ ...item, cost: 7, copies: 1 }));

const ARTIFACT_CARDS: CardDef[] = [
  card("bannerGlory", "荣耀旗帜", "Banner of Glory", "gold", "artifact", { special: "banner-glory" }, { special: "banner-glory" }, "装备盟军：护甲 +1；其攻击/格挡 +1，每次使用这些能力名望 +1", "本回合所有盟军护甲 +1、攻击/格挡 +1；每支参战盟军名望 +1"),
  card("bannerFear", "恐惧旗帜", "Banner of Fear", "gold", "artifact", { special: "banner-fear" }, { special: "banner-fear" }, "装备盟军：格挡阶段横置该盟军，取消一个敌人的一次攻击并名望 +1", "本场战斗至多选择 3 个敌人；它们不发动攻击"),
  card("bannerProtection", "守护旗帜", "Banner of Protection", "gold", "artifact", { special: "banner-protection" }, { special: "banner-protection" }, "装备盟军：护甲 +1，并获得火焰与寒冰抗性", "丢弃本回合新获得的全部伤势牌"),
  card("bannerCourage", "勇气旗帜", "Banner of Courage", "gold", "artifact", { special: "banner-courage" }, { special: "banner-courage" }, "装备盟军：每轮一次，战斗外翻面并重整该盟军", "战斗外：重整你控制的全部盟军"),
  card("rubyRing", "红宝石戒指", "Ruby Ring", "gold", "artifact", { special: "elemental-ring" }, { special: "elemental-ring" }, "获得 1 份红色临时魔力与 1 枚红色水晶；名望 +1", "本回合拥有无限红色与黑色魔力；每施放一张红色法术名望 +1"),
  card("sapphireRing", "蓝宝石戒指", "Sapphire Ring", "gold", "artifact", { special: "elemental-ring" }, { special: "elemental-ring" }, "获得 1 份蓝色临时魔力与 1 枚蓝色水晶；名望 +1", "本回合拥有无限蓝色与黑色魔力；每施放一张蓝色法术名望 +1"),
  card("diamondRing", "钻石戒指", "Diamond Ring", "gold", "artifact", { special: "elemental-ring" }, { special: "elemental-ring" }, "获得 1 份白色临时魔力与 1 枚白色水晶；名望 +1", "本回合拥有无限白色与黑色魔力；每施放一张白色法术名望 +1"),
  card("emeraldRing", "翡翠戒指", "Emerald Ring", "gold", "artifact", { special: "elemental-ring" }, { special: "elemental-ring" }, "获得 1 份绿色临时魔力与 1 枚绿色水晶；名望 +1", "本回合拥有无限绿色与黑色魔力；每施放一张绿色法术名望 +1"),
  card("swordJustice", "正义之剑", "Sword of Justice", "gold", "artifact", { special: "sword-justice" }, { special: "sword-justice" }, "弃任意张其他手牌，每张提供攻击 3；本回合每击败一个敌人名望 +1", "本回合物理攻击贡献翻倍且敌人失去物理抗性；每击败一个敌人名望 +1"),
  card("hornWrath", "愤怒号角", "Horn of Wrath", "gold", "artifact", { range: 5 }, { siege: 10 }, "远程攻击 5", "弃除：攻城攻击 10"),
  card("goldenGrail", "黄金圣杯", "Golden Grail", "gold", "artifact", { heal: 2, special: "golden-grail" }, { heal: 6, special: "golden-grail" }, "治疗 2；每花费本牌 1 点治疗，名望 +1", "治疗 6；本回合每从手牌治疗一张伤势，抽 1 张牌"),
  card("endlessGold", "无尽金币袋", "Endless Bag of Gold", "gold", "artifact", { influence: 5 }, { influence: 10 }, "影响力 5", "弃除：影响力 10"),
  card("endlessGems", "无尽宝石袋", "Endless Gem Pouch", "gold", "artifact", { crystal: 2 }, { crystal: 4 }, "获得两次凝晶", "弃除：获得四次凝晶"),
  card("bookWisdom", "智慧之书", "Book of Wisdom", "gold", "artifact", { draw: 2 }, { draw: 5 }, "抽牌 2", "弃除：抽牌 5"),
  card("amuletSun", "太阳护符", "Amulet of Sun", "gold", "artifact", { special: "amulet-sun" }, { special: "amulet-sun" }, "获得 1 份金色魔力；夜晚森林费用 3、金魔可用，并按白昼公开标记", "同基础效果，但获得 3 份金色魔力"),
  card("amuletDarkness", "黑暗护符", "Amulet of Darkness", "gold", "artifact", { special: "amulet-darkness" }, { special: "amulet-darkness" }, "获得任意颜色 1 份魔力；白昼沙漠费用 3，并可使用黑色魔力", "同基础效果，但获得任意颜色共 3 份魔力"),
].map((item) => ({ ...item, copies: 1 }));

export const FULL_CARD_DEFS: Record<string, CardDef> = Object.fromEntries(
  [...BASIC_CARDS, ...ADVANCED_CARDS, ...SPELL_CARDS, ...ARTIFACT_CARDS].map((item) => [item.id, item]),
);

const STANDARD_START = [
  "rage", "rage", "determination", "swiftness", "swiftness", "march", "march", "stamina", "stamina", "tranquility", "promise", "threaten", "crystallize", "manaDraw", "concentration", "improvisation",
];

function heroDeck(heroId: string, replacements: Array<{ from: string; occurrence?: number; to: string }>) {
  const seen: Record<string, number> = {};
  return STANDARD_START.map((sourceId, index) => {
    seen[sourceId] = (seen[sourceId] ?? 0) + 1;
    const replacement = replacements.find((item) => item.from === sourceId && (item.occurrence ?? 1) === seen[sourceId]);
    return `${replacement?.to ?? sourceId}#${heroId}-${String(index + 1).padStart(2, "0")}`;
  });
}

export const FULL_STARTER_DECKS: Record<string, string[]> = {
  tovak: heroDeck("tovak", [{ from: "determination", to: "coldToughness" }, { from: "improvisation", to: "instinct" }]),
  arythea: heroDeck("arythea", [{ from: "rage", occurrence: 2, to: "battleVersatility" }, { from: "manaDraw", to: "manaPull" }]),
  goldyx: heroDeck("goldyx", [{ from: "concentration", to: "willFocus" }, { from: "crystallize", to: "crystalJoy" }]),
  norowas: heroDeck("norowas", [{ from: "promise", to: "nobleManners" }, { from: "tranquility", to: "rejuvenate" }]),
};

Object.values(FULL_STARTER_DECKS).flat().forEach((instanceId) => {
  const id = instanceId.split("#")[0];
  FULL_CARD_DEFS[id].copies = (FULL_CARD_DEFS[id].copies ?? 0) + 1;
});

export const FULL_ADVANCED_IDS = ADVANCED_CARDS.map((item) => item.id);
export const FULL_SPELL_IDS = SPELL_CARDS.map((item) => item.id);
export const FULL_ARTIFACT_IDS = ARTIFACT_CARDS.map((item) => item.id);
export const WOUND_IDS = Array.from({ length: 40 }, (_, index) => `wound#${String(index + 1).padStart(2, "0")}`);

function skill(heroId: string, id: string, name: string, englishName: string, description: string, effect: Partial<SkillDef> = {}): SkillDef {
  return { heroId, id: `${heroId}-${id}`, name, englishName, description, ...effect };
}

export const FULL_HERO_SKILLS: Record<string, SkillDef[]> = {
  norowas: [
    skill("norowas", "forward-march", "向前行军", "Forward March", "每回合获得移动 1。", { resource: { move: 1 } }),
    skill("norowas", "day-sharpshooting", "白昼神射", "Day Sharpshooting", "每回合一次：白昼远程攻击 2；夜晚远程攻击 1。", { special: "day-sharpshooting" }),
    skill("norowas", "inspiration", "鼓舞", "Inspiration", "每轮一次，战斗外：重整一支盟军，或完全治疗一支盟军。", { special: "inspiration" }),
    skill("norowas", "bright-negotiation", "光明谈判", "Bright Negotiation", "每回合获得影响力 2。", { resource: { influence: 2 } }),
    skill("norowas", "leaves", "风中之叶", "Leaves in the Wind", "每回合获得移动与格挡各 1。", { resource: { move: 1, block: 1 } }),
    skill("norowas", "whispers", "树梢低语", "Whispers in the Treetops", "每回合获得移动与影响力各 1。", { resource: { move: 1, influence: 1 } }),
    skill("norowas", "leadership", "领导力", "Leadership", "每回合获得格挡 2。", { resource: { block: 2 } }),
    skill("norowas", "bonds", "忠诚纽带", "Bonds of Loyalty", "指挥上限永久 +1。", { command: 1 }),
    skill("norowas", "motivation", "激励", "Motivation", "手牌上限永久 +1。", { hand: 1 }),
    skill("norowas", "weather", "天气祈祷", "Prayer of Weather", "每回合获得移动 2。", { resource: { move: 2 } }),
  ],
  tovak: [
    skill("tovak", "double-time", "加倍行军", "Double Time", "每回合获得移动 2。", { resource: { move: 2 } }),
    skill("tovak", "night-sharpshooting", "夜间神射", "Night Sharpshooting", "每回合获得远程攻击 1。", { resource: { range: 1 } }),
    skill("tovak", "cold-swordsmanship", "寒冰剑术", "Cold Swordsmanship", "每回合获得攻击 2。", { resource: { attack: 2 } }),
    skill("tovak", "shield-mastery", "盾牌精通", "Shield Mastery", "每回合获得格挡 2。", { resource: { block: 2 } }),
    skill("tovak", "resistance-break", "抗性突破", "Resistance Break", "每回合获得攻城攻击 1。", { resource: { siege: 1 } }),
    skill("tovak", "no-pain", "我感觉不到痛", "I Feel No Pain", "有伤势时每回合获得格挡 2。", { resource: { block: 2 }, requiresWound: true }),
    skill("tovak", "dont-care", "我毫不在乎", "I Don't Give a Damn", "每回合获得影响力 1 与攻击 1。", { resource: { influence: 1, attack: 1 } }),
    skill("tovak", "no-magic", "谁需要魔法？", "Who Needs Magic?", "每回合获得攻击与格挡各 1。", { resource: { attack: 1, block: 1 } }),
    skill("tovak", "motivation", "激励", "Motivation", "手牌上限永久 +1。", { hand: 1 }),
    skill("tovak", "mana-exploit", "魔力利用", "Mana Exploit", "每回合获得凝晶 1。", { resource: { crystal: 1 } }),
  ],
  goldyx: [
    skill("goldyx", "freezing-power", "冻结之力", "Freezing Power", "每回合获得寒冰格挡 2。", { resource: { block: 2 } }),
    skill("goldyx", "potion-making", "药剂调制", "Potion Making", "每回合获得治疗 1。", { resource: { heal: 1 } }),
    skill("goldyx", "white-crystal", "白色水晶工艺", "White Crystal Craft", "每回合获得影响力 1。", { resource: { influence: 1 } }),
    skill("goldyx", "green-crystal", "绿色水晶工艺", "Green Crystal Craft", "每回合获得移动 1。", { resource: { move: 1 } }),
    skill("goldyx", "red-crystal", "红色水晶工艺", "Red Crystal Craft", "每回合获得攻击 1。", { resource: { attack: 1 } }),
    skill("goldyx", "fortune", "闪耀财富", "Glittering Fortune", "每回合获得影响力与凝晶各 1。", { resource: { influence: 1, crystal: 1 } }),
    skill("goldyx", "flight", "飞行", "Flight", "每回合获得移动 2。", { resource: { move: 2 } }),
    skill("goldyx", "universal-power", "万能之力", "Universal Power", "每回合获得攻击、格挡各 1。", { resource: { attack: 1, block: 1 } }),
    skill("goldyx", "motivation", "激励", "Motivation", "手牌上限永久 +1。", { hand: 1 }),
    skill("goldyx", "source-freeze", "冻结源泉", "Source Freeze", "护甲永久 +1。", { armor: 1 }),
  ],
  arythea: [
    skill("arythea", "dark-paths", "黑暗之路", "Dark Paths", "每回合获得移动 2。", { resource: { move: 2 } }),
    skill("arythea", "burning-power", "燃烧之力", "Burning Power", "每回合获得攻击 2。", { resource: { attack: 2 } }),
    skill("arythea", "hot-swordsmanship", "炽热剑术", "Hot Swordsmanship", "每回合获得攻击与攻城各 1。", { resource: { attack: 1, siege: 1 } }),
    skill("arythea", "dark-negotiation", "黑暗谈判", "Dark Negotiation", "每回合获得影响力 2。", { resource: { influence: 2 } }),
    skill("arythea", "dark-fire", "黑暗火焰魔法", "Dark Fire Magic", "每回合获得攻城攻击 2。", { resource: { siege: 2 } }),
    skill("arythea", "pain", "痛苦之力", "Power of Pain", "有伤势时每回合获得攻击 2。", { resource: { attack: 2 }, requiresWound: true }),
    skill("arythea", "invocation", "祈唤", "Invocation", "每回合获得凝晶 1。", { resource: { crystal: 1 } }),
    skill("arythea", "polarization", "极性反转", "Polarization", "每回合获得攻击与格挡各 1。", { resource: { attack: 1, block: 1 } }),
    skill("arythea", "motivation", "激励", "Motivation", "手牌上限永久 +1。", { hand: 1 }),
    skill("arythea", "healing-ritual", "治疗仪式", "Healing Ritual", "每回合获得治疗 2。", { resource: { heal: 2 } }),
  ],
};

export const FULL_UNIT_DEFS: UnitDef[] = [
  { id: "peasants", name: "农民", englishName: "Peasants", level: 1, armor: 3, cost: 4, effect: { attack: 2 }, abilities: [{ id: "attack", label: "攻击 2", effect: { attack: 2 } }, { id: "block", label: "格挡 2", effect: { block: 2 } }, { id: "influence", label: "影响力 2", effect: { influence: 2 } }, { id: "move", label: "移动 2", effect: { move: 2 } }], site: "village", recruitSites: ["village"], tier: "regular", copies: 3, text: "攻击 2 / 格挡 2 / 影响力 2 / 移动 2，四选一。" },
  { id: "herbalists", name: "草药师", englishName: "Herbalists", level: 1, armor: 2, cost: 3, effect: { heal: 2 }, abilities: [{ id: "heal", label: "治疗 2", effect: { heal: 2 } }, { id: "ready", label: "重整一支等级 I–II 盟军", readyUnitMaxLevel: 2 }, { id: "mana", label: "获得 1 份绿色临时魔力", gainMana: ["green"] }], site: "village", recruitSites: ["village", "monastery"], tier: "regular", copies: 2, text: "治疗 2 / 重整等级 I–II 盟军 / 获得绿色临时魔力。" },
  { id: "foresters", name: "林务官", englishName: "Foresters", level: 1, armor: 4, cost: 5, effect: { move: 2 }, abilities: [{ id: "move", label: "移动 2（本回合森林/丘陵/沼泽费用 -1）", effect: { move: 2 }, terrainDiscount: ["forest", "hills", "swamp"] }, { id: "block", label: "格挡 3", effect: { block: 3 } }], site: "village", recruitSites: ["village"], tier: "regular", copies: 2, text: "移动 2 并降低森林、丘陵、沼泽费用，或格挡 3。" },
  { id: "utemCrossbowmen", name: "尤腾弩手", englishName: "Utem Crossbowmen", level: 2, armor: 4, cost: 6, effect: { attack: 3 }, abilities: [{ id: "attack", label: "攻击 3", effect: { attack: 3 } }, { id: "block", label: "格挡 3", effect: { block: 3 } }, { id: "range", label: "远程攻击 2", effect: { range: 2 } }], site: "keep", recruitSites: ["village", "keep"], tier: "regular", copies: 2, text: "攻击 3 / 格挡 3 / 远程攻击 2。" },
  { id: "utemGuardsmen", name: "尤腾卫兵", englishName: "Utem Guardsmen", level: 2, armor: 5, cost: 5, effect: { block: 4 }, abilities: [{ id: "attack", label: "攻击 2", effect: { attack: 2 } }, { id: "block", label: "格挡 4；该敌人失去迅捷", effect: { block: 4 }, removeSwift: true }], site: "keep", recruitSites: ["village", "keep"], tier: "regular", copies: 2, text: "攻击 2，或格挡 4 并令该敌人失去迅捷。" },
  { id: "utemSwordsmen", name: "尤腾剑士", englishName: "Utem Swordsmen", level: 2, armor: 4, cost: 6, effect: { attack: 3 }, abilities: [{ id: "attack", label: "攻击 3", effect: { attack: 3 } }, { id: "block", label: "格挡 3", effect: { block: 3 } }, { id: "woundAttack", label: "自身受伤：攻击 6", effect: { attack: 6 }, woundSelf: true }, { id: "woundBlock", label: "自身受伤：格挡 6", effect: { block: 6 }, woundSelf: true }], site: "keep", recruitSites: ["keep"], tier: "regular", copies: 2, text: "攻击/格挡 3，或令自身受伤改为攻击/格挡 6。" },
  { id: "guardianGolems", name: "守护魔像", englishName: "Guardian Golems", level: 2, armor: 3, cost: 7, effect: { attack: 2 }, abilities: [{ id: "attack", label: "攻击 2", effect: { attack: 2 } }, { id: "block", label: "格挡 2", effect: { block: 2 } }, { id: "fireBlock", label: "支付红色魔力：火焰格挡 4", effect: { fireBlock: 4 }, manaCost: ["red"] }, { id: "iceBlock", label: "支付蓝色魔力：寒冰格挡 4", effect: { iceBlock: 4 }, manaCost: ["blue"] }], resistances: ["physical"], site: "mageTower", recruitSites: ["keep", "mageTower"], tier: "regular", copies: 2, text: "具有物理抗性；可支付红/蓝魔力发动元素格挡。" },
  { id: "illusionists", name: "幻术师", englishName: "Illusionists", level: 2, armor: 2, cost: 7, effect: { influence: 4 }, abilities: [{ id: "influence", label: "影响力 4", effect: { influence: 4 } }, { id: "cancel", label: "支付蓝色魔力：一名无防御工事敌人本次战斗不攻击", manaCost: ["blue"], cancelEnemyAttack: true, unfortifiedOnly: true }, { id: "crystal", label: "获得 1 枚白色水晶", gainCrystal: ["white"] }], resistances: ["physical"], site: "mageTower", recruitSites: ["monastery", "mageTower"], tier: "regular", copies: 2, text: "具有物理抗性；影响力、取消攻击或凝聚白色水晶。" },
  { id: "redCapeMonks", name: "红斗篷僧侣", englishName: "Red Cape Monks", level: 2, armor: 4, cost: 7, effect: { attack: 3 }, abilities: [{ id: "attack", label: "攻击 3", effect: { attack: 3 } }, { id: "block", label: "格挡 3", effect: { block: 3 } }, { id: "fireAttack", label: "支付红色魔力：火焰攻击 4", effect: { fireAttack: 4 }, manaCost: ["red"] }, { id: "fireBlock", label: "支付红色魔力：火焰格挡 4", effect: { fireBlock: 4 }, manaCost: ["red"] }], site: "monastery", recruitSites: ["monastery"], tier: "regular", copies: 1, text: "攻击/格挡 3，或支付红色魔力获得火焰攻击/格挡 4。" },
  { id: "northernMonks", name: "北境僧侣", englishName: "Northern Monks", level: 2, armor: 4, cost: 7, effect: { attack: 3 }, abilities: [{ id: "attack", label: "攻击 3", effect: { attack: 3 } }, { id: "block", label: "格挡 3", effect: { block: 3 } }, { id: "iceAttack", label: "支付蓝色魔力：寒冰攻击 4", effect: { iceAttack: 4 }, manaCost: ["blue"] }, { id: "iceBlock", label: "支付蓝色魔力：寒冰格挡 4", effect: { iceBlock: 4 }, manaCost: ["blue"] }], site: "monastery", recruitSites: ["monastery"], tier: "regular", copies: 1, text: "攻击/格挡 3，或支付蓝色魔力获得寒冰攻击/格挡 4。" },
  { id: "savageMonks", name: "野性僧侣", englishName: "Savage Monks", level: 2, armor: 4, cost: 7, effect: { attack: 3 }, abilities: [{ id: "attack", label: "攻击 3", effect: { attack: 3 } }, { id: "block", label: "格挡 3", effect: { block: 3 } }, { id: "siege", label: "支付红色魔力：攻城攻击 4", effect: { siege: 4 }, manaCost: ["red"] }], site: "monastery", recruitSites: ["monastery"], tier: "regular", copies: 1, text: "攻击/格挡 3，或支付红色魔力发动攻城攻击 4。" },
  { id: "fireGolems", name: "火焰魔像", englishName: "Fire Golems", level: 3, armor: 4, cost: 8, effect: { attack: 3 }, abilities: [{ id: "attack", label: "攻击 3", effect: { attack: 3 } }, { id: "block", label: "格挡 3", effect: { block: 3 } }, { id: "rangeFire", label: "支付红色魔力：远程火焰攻击 4", effect: { fireRange: 4 }, manaCost: ["red"] }], resistances: ["physical", "fire"], site: "mageTower", recruitSites: ["mageTower", "keep"], tier: "elite", copies: 2, text: "物理与火焰抗性；攻击/格挡 3，或红魔驱动远程火焰攻击 4。" },
  { id: "iceGolems", name: "寒冰魔像", englishName: "Ice Golems", level: 3, armor: 4, cost: 8, effect: { attack: 3 }, abilities: [{ id: "attack", label: "攻击 3", effect: { attack: 3 } }, { id: "block", label: "格挡 3", effect: { block: 3 } }, { id: "iceAttack", label: "支付蓝色魔力：寒冰攻击 6", effect: { iceAttack: 6 }, manaCost: ["blue"] }], resistances: ["physical", "ice"], site: "mageTower", recruitSites: ["mageTower", "keep"], tier: "elite", copies: 2, text: "物理与寒冰抗性；攻击/格挡 3，或蓝魔驱动寒冰攻击 6。" },
  { id: "fireMages", name: "火焰法师", englishName: "Fire Mages", level: 3, armor: 4, cost: 9, effect: { fireRange: 3 }, abilities: [{ id: "range", label: "远程火焰攻击 3", effect: { fireRange: 3 } }, { id: "fireAttack", label: "支付红色魔力：火焰攻击 6", effect: { fireAttack: 6 }, manaCost: ["red"] }, { id: "fireBlock", label: "支付红色魔力：火焰格挡 6", effect: { fireBlock: 6 }, manaCost: ["red"] }, { id: "mana", label: "获得红色临时魔力与 1 枚红色水晶", gainMana: ["red"], gainCrystal: ["red"] }], resistances: ["fire"], site: "mageTower", recruitSites: ["mageTower", "monastery"], tier: "elite", copies: 2, text: "火焰抗性；提供远程/近战火焰能力，也可生成红魔与红水晶。" },
  { id: "iceMages", name: "寒冰法师", englishName: "Ice Mages", level: 3, armor: 4, cost: 9, effect: { iceAttack: 4 }, abilities: [{ id: "attack", label: "寒冰攻击 4", effect: { iceAttack: 4 } }, { id: "block", label: "寒冰格挡 4", effect: { iceBlock: 4 } }, { id: "siege", label: "支付蓝色魔力：攻城寒冰攻击 4", effect: { iceSiege: 4 }, manaCost: ["blue"] }, { id: "mana", label: "获得蓝色临时魔力与 1 枚蓝色水晶", gainMana: ["blue"], gainCrystal: ["blue"] }], resistances: ["ice"], site: "mageTower", recruitSites: ["mageTower", "monastery"], tier: "elite", copies: 2, text: "寒冰抗性；寒冰攻击/格挡、攻城寒冰攻击或生成蓝魔与蓝水晶。" },
  { id: "amotepGunners", name: "阿莫特普炮手", englishName: "Amotep Gunners", level: 3, armor: 6, cost: 8, effect: { attack: 5 }, abilities: [{ id: "attack", label: "攻击 5", effect: { attack: 5 } }, { id: "block", label: "格挡 5", effect: { block: 5 } }, { id: "range", label: "支付红色魔力：远程火焰攻击 6", effect: { fireRange: 6 }, manaCost: ["red"] }], site: "city", recruitSites: ["keep", "city"], tier: "elite", copies: 2, text: "攻击/格挡 5，或红魔驱动远程火焰攻击 6。" },
  { id: "amotepFreezers", name: "阿莫特普冻结师", englishName: "Amotep Freezers", level: 3, armor: 6, cost: 8, effect: { attack: 5 }, abilities: [{ id: "attack", label: "攻击 5", effect: { attack: 5 } }, { id: "block", label: "格挡 5", effect: { block: 5 } }, { id: "freeze", label: "支付蓝色魔力：取消攻击且目标护甲 -3", manaCost: ["blue"], cancelEnemyAttack: true, armorReduction: 3 }], site: "city", recruitSites: ["keep", "city"], tier: "elite", copies: 2, text: "攻击/格挡 5，或蓝魔冻结：取消攻击并使目标护甲 -3（最低 1）。" },
  { id: "catapults", name: "投石车", englishName: "Catapults", level: 3, armor: 4, cost: 9, effect: { siege: 3 }, abilities: [{ id: "siege", label: "攻城攻击 3", effect: { siege: 3 } }, { id: "fire", label: "支付红色魔力：攻城火焰攻击 5", effect: { fireSiege: 5 }, manaCost: ["red"] }, { id: "ice", label: "支付蓝色魔力：攻城寒冰攻击 5", effect: { iceSiege: 5 }, manaCost: ["blue"] }], site: "keep", recruitSites: ["keep", "city"], tier: "elite", copies: 3, text: "攻城攻击 3，或支付对应魔力变为火焰/寒冰攻城攻击 5。" },
  { id: "altemMages", name: "阿尔特姆法师", englishName: "Altem Mages", level: 4, armor: 5, cost: 12, effect: { coldfireAttack: 5 }, abilities: [{ id: "mana", label: "获得任意颜色的 2 份临时魔力", gainManaChoiceCount: 2 }, { id: "attack", label: "冷热火攻击 5", effect: { coldfireAttack: 5 } }, { id: "block", label: "冷热火格挡 5", effect: { coldfireBlock: 5 } }, { id: "attack7", label: "支付红色或蓝色魔力：冷热火攻击 7", effect: { coldfireAttack: 7 }, manaChoiceCount: 1, manaChoiceColors: ["red", "blue"] }, { id: "block7", label: "支付红色或蓝色魔力：冷热火格挡 7", effect: { coldfireBlock: 7 }, manaChoiceCount: 1, manaChoiceColors: ["red", "blue"] }, { id: "attack9", label: "支付红 + 蓝魔力：冷热火攻击 9", effect: { coldfireAttack: 9 }, manaCost: ["red", "blue"] }, { id: "block9", label: "支付红 + 蓝魔力：冷热火格挡 9", effect: { coldfireBlock: 9 }, manaCost: ["red", "blue"] }, { id: "transform", label: "支付黑色魔力：本场战斗所有攻击变为冷热火", manaCost: ["black"], transformAttacks: "coldfire" }, { id: "siegeTransform", label: "支付黑色魔力：本场战斗所有攻击同时视为攻城", manaCost: ["black"], transformAttacks: "siege" }], resistances: ["fire", "ice"], site: "city", recruitSites: ["city"], tier: "elite", copies: 2, text: "火焰与寒冰抗性；任意两份魔力、冷热火攻击/格挡及攻击转换。" },
  { id: "altemGuardians", name: "阿尔特姆守护者", englishName: "Altem Guardians", level: 4, armor: 7, cost: 11, effect: { attack: 5 }, abilities: [{ id: "attack", label: "攻击 5", effect: { attack: 5 } }, { id: "block", label: "格挡 8；该敌人失去迅捷", effect: { block: 8 }, removeSwift: true }, { id: "resist", label: "支付绿色魔力：本回合所有盟军获得全部抗性", manaCost: ["green"], allUnitResistances: true }], site: "city", recruitSites: ["city"], tier: "elite", copies: 3, text: "攻击 5 / 格挡 8 并移除迅捷 / 绿魔赋予全军全部抗性。" },
];

export function unitBaseId(instanceId: string) {
  return instanceId.split("@")[0];
}

export function getUnit(instanceId: string) {
  const aliases: Record<string, string> = { guardsmen: "utemGuardsmen", crossbowmen: "utemCrossbowmen", monks: "redCapeMonks" };
  const baseId = unitBaseId(instanceId);
  return FULL_UNIT_DEFS.find((unit) => unit.id === (aliases[baseId] ?? baseId));
}

function physicalUnitIds(tier: "regular" | "elite") {
  return FULL_UNIT_DEFS.filter((unit) => unit.tier === tier).flatMap((unit) =>
    Array.from({ length: unit.copies ?? 1 }, (_, index) => `${unit.id}@${index + 1}`),
  );
}

export const REGULAR_UNIT_IDS = physicalUnitIds("regular");
export const ELITE_UNIT_IDS = physicalUnitIds("elite");

type EnemySpec = Omit<Enemy, "id" | "tokenColor"> & { key: string; copies: number };

function enemyTokens(color: EnemyTokenColor, specs: EnemySpec[]): Enemy[] {
  return specs.flatMap((spec) => Array.from({ length: spec.copies }, (_, index) => {
    const enemy = { ...spec } as EnemySpec & Partial<Pick<Enemy, "id" | "tokenColor">>;
    delete (enemy as Partial<EnemySpec>).key;
    delete (enemy as Partial<EnemySpec>).copies;
    return { ...enemy, id: `${color}-${spec.key}-${index + 1}`, tokenColor: color } as Enemy;
  }));
}

export const ENEMY_TOKENS: Enemy[] = [
  ...enemyTokens("green", [
    { key: "cursed-hags", copies: 2, name: "诅咒女巫", armor: 4, attack: 3, fame: 3, poison: true, description: "绿色兽人可汗标记；中毒攻击。" },
    { key: "diggers", copies: 2, name: "掘地者", armor: 3, attack: 5, fame: 3, brutal: true, description: "绿色兽人可汗标记；残暴攻击。" },
    { key: "ironclads", copies: 2, name: "铁甲兽人", armor: 5, attack: 4, fame: 4, fortified: true, description: "绿色兽人可汗标记；厚甲且具有防御工事。" },
    { key: "summoners", copies: 2, name: "兽人召唤师", armor: 4, attack: 4, fame: 4, summon: true, description: "绿色兽人可汗标记；会召唤额外攻击者。" },
    { key: "prowlers", copies: 2, name: "潜行者", armor: 4, attack: 4, fame: 3, swift: true, description: "绿色兽人可汗标记；迅捷使格挡需求翻倍。" },
    { key: "wolf-riders", copies: 2, name: "狼骑兵", armor: 4, attack: 6, fame: 4, swift: true, description: "绿色兽人可汗标记；高攻击迅捷骑兵。" },
  ]),
  ...enemyTokens("red", [
    { key: "fire-dragon", copies: 2, name: "火焰巨龙", armor: 7, attack: 7, fame: 8, brutal: true, attackElement: "fire", resistances: ["fire"], description: "红色龙族标记；火焰抗性与残暴火焰攻击。" },
    { key: "high-dragon", copies: 2, name: "高等巨龙", armor: 9, attack: 6, fame: 9, swift: true, brutal: true, description: "红色龙族标记；迅捷且残暴。" },
    { key: "ice-dragon", copies: 2, name: "寒冰巨龙", armor: 7, attack: 7, fame: 8, brutal: true, attackElement: "ice", resistances: ["ice"], description: "红色龙族标记；寒冰抗性与残暴寒冰攻击。" },
    { key: "swamp-dragon", copies: 2, name: "沼泽巨龙", armor: 8, attack: 5, fame: 8, poison: true, resistances: ["physical"], description: "红色龙族标记；物理抗性与中毒攻击。" },
  ]),
  ...enemyTokens("gray", [
    { key: "crossbowmen", copies: 3, name: "要塞弩手", armor: 4, attack: 5, fame: 4, swift: true, description: "灰色要塞守军；迅捷远程齐射。" },
    { key: "golems", copies: 2, name: "守城魔像", armor: 6, attack: 4, fame: 5, resistances: ["physical"], description: "灰色要塞守军；物理抗性。" },
    { key: "guardsmen", copies: 3, name: "要塞卫兵", armor: 5, attack: 4, fame: 4, fortified: true, description: "灰色要塞守军；依托城墙防守。" },
    { key: "swordsmen", copies: 2, name: "要塞剑士", armor: 5, attack: 6, fame: 5, brutal: true, description: "灰色要塞守军；残暴近战。" },
  ]),
  ...enemyTokens("violet", [
    { key: "fire-golem", copies: 1, name: "火焰魔像", armor: 6, attack: 5, fame: 5, attackElement: "fire", resistances: ["fire"], description: "紫色法师塔守军；火焰抗性。" },
    { key: "fire-mages", copies: 2, name: "火焰法师", armor: 5, attack: 6, fame: 5, attackElement: "fire", swift: true, description: "紫色法师塔守军；迅捷火焰攻击。" },
    { key: "ice-golem", copies: 1, name: "寒冰魔像", armor: 6, attack: 5, fame: 5, attackElement: "ice", resistances: ["ice"], description: "紫色法师塔守军；寒冰抗性。" },
    { key: "ice-mages", copies: 2, name: "寒冰法师", armor: 5, attack: 6, fame: 5, attackElement: "ice", swift: true, description: "紫色法师塔守军；迅捷寒冰攻击。" },
    { key: "illusionist", copies: 2, name: "幻术师", armor: 4, attack: 5, fame: 4, summon: true, description: "紫色法师塔守军；召唤幻影。" },
    { key: "monks", copies: 2, name: "战斗僧侣", armor: 5, attack: 5, fame: 5, brutal: true, description: "紫色法师塔守军；残暴攻击。" },
  ]),
  ...enemyTokens("brown", [
    { key: "crypt-worm", copies: 2, name: "墓穴蠕虫", armor: 5, attack: 6, fame: 5, poison: true, description: "棕色地下城怪物；中毒攻击。" },
    { key: "gargoyle", copies: 2, name: "石像鬼", armor: 6, attack: 5, fame: 5, resistances: ["physical"], description: "棕色地下城怪物；物理抗性。" },
    { key: "medusa", copies: 2, name: "美杜莎", armor: 5, attack: 5, fame: 6, paralyze: true, description: "棕色地下城怪物；未格挡会麻痹英雄。" },
    { key: "minotaur", copies: 2, name: "牛头怪", armor: 6, attack: 7, fame: 6, brutal: true, description: "棕色地下城怪物；残暴冲撞。" },
    { key: "werewolf", copies: 2, name: "狼人", armor: 5, attack: 6, fame: 5, swift: true, description: "棕色地下城怪物；迅捷攻击。" },
  ]),
  ...enemyTokens("white", [
    { key: "altem-guardsmen", copies: 2, name: "阿尔特姆卫兵", armor: 7, attack: 6, fame: 7, fortified: true, resistances: ["physical"], description: "白色城市守军；物理抗性与高护甲。" },
    { key: "altem-mage", copies: 2, name: "阿尔特姆法师", armor: 6, attack: 7, fame: 7, attackElement: "coldfire", resistances: ["fire", "ice"], description: "白色城市守军；冷热火抗性。" },
    { key: "freezers", copies: 3, name: "阿莫特普冻结师", armor: 6, attack: 7, fame: 6, attackElement: "ice", swift: true, description: "白色城市守军；迅捷寒冰攻击。" },
    { key: "gunners", copies: 3, name: "阿莫特普炮手", armor: 6, attack: 8, fame: 6, brutal: true, description: "白色城市守军；残暴炮击。" },
  ]),
];

export const ENEMY_TOKEN_BY_ID: Record<string, Enemy> = Object.fromEntries(ENEMY_TOKENS.map((enemy) => [enemy.id, enemy]));

export const ENEMY_TOKEN_IDS: Record<EnemyTokenColor, string[]> = {
  green: ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "green").map((enemy) => enemy.id),
  red: ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "red").map((enemy) => enemy.id),
  gray: ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "gray").map((enemy) => enemy.id),
  violet: ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "violet").map((enemy) => enemy.id),
  brown: ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "brown").map((enemy) => enemy.id),
  white: ENEMY_TOKENS.filter((enemy) => enemy.tokenColor === "white").map((enemy) => enemy.id),
};

export const RUIN_TOKENS: RuinToken[] = [
  { id: "altar-blue", name: "蓝色魔力祭坛", enemies: [], reward: "fame", altarColor: "blue", description: "支付 3 份蓝色魔力，获得 7 点名望。" },
  { id: "brown-violet", name: "地下城与高塔守卫", enemies: ["brown", "violet"], reward: "artifact", description: "击败两枚标记后获得 1 件圣器。" },
  { id: "brown-red", name: "地下城与龙族守卫", enemies: ["brown", "red"], reward: "spell", description: "击败两枚标记后获得 1 张法术。" },
  { id: "altar-green", name: "绿色魔力祭坛", enemies: [], reward: "fame", altarColor: "green", description: "支付 3 份绿色魔力，获得 7 点名望。" },
  { id: "green-brown", name: "兽人与地下城守卫", enemies: ["green", "brown"], reward: "crystals", description: "击败两枚标记后获得随机水晶。" },
  { id: "green-green", name: "兽人双卫", enemies: ["green", "green"], reward: "advanced", description: "击败两枚标记后获得 1 张进阶行动。" },
  { id: "green-red", name: "兽人与龙族守卫", enemies: ["green", "red"], reward: "artifact", description: "击败两枚标记后获得 1 件圣器。" },
  { id: "gray-brown", name: "要塞与地下城守卫", enemies: ["gray", "brown"], reward: "crystals", description: "击败两枚标记后获得随机水晶。" },
  { id: "gray-violet", name: "要塞与高塔守卫", enemies: ["gray", "violet"], reward: "spell", description: "击败两枚标记后获得 1 张法术。" },
  { id: "gray-white", name: "要塞与城市守卫", enemies: ["gray", "white"], reward: "artifact", description: "击败两枚标记后获得 1 件圣器。" },
  { id: "altar-red", name: "红色魔力祭坛", enemies: [], reward: "fame", altarColor: "red", description: "支付 3 份红色魔力，获得 7 点名望。" },
  { id: "altar-white", name: "白色魔力祭坛", enemies: [], reward: "fame", altarColor: "white", description: "支付 3 份白色魔力，获得 7 点名望。" },
];

export const RUIN_TOKEN_BY_ID: Record<string, RuinToken> = Object.fromEntries(RUIN_TOKENS.map((token) => [token.id, token]));

export const BASE_COMPONENT_COUNTS = {
  basicActions: 64,
  advancedActions: 28,
  spells: 20,
  artifacts: 16,
  wounds: 40,
  tactics: 12,
  regularUnits: 20,
  eliteUnits: 20,
  skills: 40,
  enemies: 60,
  ruins: 12,
  mapTiles: 20,
} as const;
