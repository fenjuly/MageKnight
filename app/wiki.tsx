"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_COMPONENT_COUNTS,
  ULTIMATE_COMPONENT_COUNTS,
  ALL_CARD_DEFS,
  ALL_ENEMY_TOKENS,
  ALL_HEROES,
  ALL_HERO_SKILLS,
  ALL_RUIN_TOKENS,
  ALL_UNIT_DEFS,
  CARD_DEFS,
  ENEMY_TOKENS,
  HEROES,
  HERO_SKILLS,
  MANA_LABELS,
  SITE_LABELS,
  TACTICS,
  TERRAIN_COSTS,
  TERRAIN_LABELS,
  UNIT_DEFS,
  RUIN_TOKENS,
  getCard,
  getStarterDecksForMode,
  type Enemy,
  type CardDef,
  type ComponentSource,
  type ContentMode,
  type SiteType,
  type Terrain,
} from "../lib/game-data";
import { ALL_MAP_TILE_TEMPLATES, MAP_TILE_TEMPLATES, type TileLocal } from "../lib/map-tiles";
import { cardArtClass, cardArtStyle, enemyArtStyle, heroArtStyle, siteArtStyle, tacticArtStyle, unitArtStyle } from "../lib/visual-assets";
import { RuinTokenBadge } from "./ruin-token";

type WikiCategory = "rules" | "cards" | "enemies" | "sites" | "terrain" | "units" | "heroes" | "tiles";

const SITE_ICONS: Record<SiteType, string> = {
  none: "", village: "⌂", monastery: "✣", keep: "♜", mageTower: "♝", mine: "◆", glade: "✦", ruins: "⌁",
  monsterDen: "◉", dungeon: "◈", tomb: "✝", spawningGrounds: "●●", rampager: "⚔", dragon: "♨", city1: "♛", city2: "♚",
  maze: "⌘", labyrinth: "▦", deepMine: "◆◆", refugeeCamp: "⛺", graveyard: "☠", necropolis: "♜", hiddenValley: "❧", volkareCamp: "⚑",
};

const SOURCE_LABELS: Record<ComponentSource, string> = {
  base: "基础版",
  "lost-legion": "The Lost Legion",
  krang: "Krang",
  "shades-of-tezla": "Shades of Tezla",
  "dual-color": "Ultimate 双属性",
};

const RULE_CHAPTERS = [
  { id: "goal", name: "目标与开局", summary: "三昼三夜内探索国度并攻克两座城市。", bullets: ["单人征服共 6 轮，依次为昼、夜、昼、夜、昼、夜。", "楔形地图使用起始板块 A，并公开两块乡野板块。", "板块牌库包含 7 块乡野、2 块非城市核心和 2 块城市核心。"] },
  { id: "turn", name: "轮次与回合", summary: "选战术、使用手牌、执行行动，然后补牌并推进虚拟玩家。", bullets: ["每轮开始选择一张尚未使用的昼/夜战术。", "结束回合前至少打出或弃掉一张牌，或实际执行一次行动。", "玩家牌库或虚拟玩家牌库耗尽会触发本轮终局。"] },
  { id: "reverting", name: "反悔与回退边界", summary: "本回合内可以撤回未公开新信息、未产生随机结果的选择，战斗也不例外。", bullets: ["普通移动、出牌/收牌、确定性资源支付、盟军发动和不补位的公开招募可以逐步撤回。", "战斗中的远程→格挡推进、完整格挡、英雄/盟军承伤、单体/分组攻击与撤退，只要没有产生新信息，均可用撤回按钮或⌘/Ctrl+Z逐步恢复此前完整状态。", "召唤新敌人、抽牌、公开圣器或新的供应卡、随机升级技能与掷骰会锁定此前历史；之后新做的确定性操作仍可撤回，但不能越过该节点。", "挑战已公开游荡敌人、移动激怒或对已公开守军发动强攻，本身不是锁定理由；只有实际翻开新信息才锁定。探索、结束回合和载入存档前的历史仍不可恢复。"] },
  { id: "cards", name: "卡牌、效果时点与魔力", summary: "行动牌可以使用基础效果、强化效果，或横置提供 1 点通用资源。", bullets: ["牌面写“或”的效果必须在打出时选择一个分支，不能同时获得；牌面写“并/与”的多个效果才会一起产生，但不能把同一张牌再次使用。", "移动、影响力和治疗点可以在当前回合暂存；一旦开始战斗，所有尚未使用的治疗点立即丢失。治疗效果不能在战斗中使用。", "攻击与格挡不能在战斗前预存，必须在对应战斗步骤产生并只用于当次结算；因此不能先用同一张牌的攻击，再在战斗结束后使用它的治疗。", "强化效果消耗对应颜色魔力；白昼金色可替代基础色，夜晚黑色用于法术强化。", "每回合通常最多使用一颗魔力源骰子，水晶可以补充对应颜色魔力。", "打出的牌进入弃牌堆；新获得的行动、法术与圣器牌置于牌库顶。"] },
  { id: "movement", name: "移动与地形", summary: "用移动点进入相邻六角格，昼夜会改变部分地形费用。", bullets: ["平原与城市费用 2，丘陵 3，荒地 4，沼泽 5。", "森林白昼 3、夜晚 5；沙漠白昼 5、夜晚 3。", "湖泊与山脉在普通移动规则下不可进入。"] },
  { id: "explore", name: "板块探索", summary: "在地图边缘花 2 移动翻开一整块固定七格板块。", bullets: ["探索不会移动英雄；新板块的 7 格同时公开。", "板块内部地形、地点和方向固定，随机的是板块抽取与牌库顺序。", "核心板块必须与至少两块已放置板块相邻，楔形核心不能放在海岸边。"] },
  { id: "interaction", name: "地点与互动", summary: "村庄、修道院、己方要塞、法师塔和城市提供不同服务。", bullets: ["公开供应始终可查看，但购买必须位于允许的地点。", "互动通常消耗影响力；声誉轨位会修正影响力，X 位置禁止互动。", "同一次互动行动中可以连续治疗、招募或购买。"] },
  { id: "reveal", name: "敌人公开与游荡", summary: "不同标记在昼夜和接近时采用不同公开规则。", bullets: ["兽人与巨龙随地形立即公开，英雄不能进入其所在格。", "可以从相邻格主动挑战；在同一游荡敌人的两个相邻格之间移动会激怒它并强制战斗。", "要塞与法师塔守军白昼相邻时公开，夜晚到强攻时公开。"] },
  { id: "combat", name: "战斗流程与属性", summary: "远程/攻城 → 格挡 → 承伤 → 近战；每种攻击与格挡都保留元素属性。", bullets: ["物理、火焰、寒冰、冷热火攻击分别结算；敌人对应抗性使该类攻击总值减半并向下取整。", "火焰攻击仅被寒冰/冷热火格挡正常克制；寒冰攻击仅被火焰/冷热火克制；冷热火仅被冷热火克制；其余格挡总值减半。", "防御工事中的敌人在远程阶段只能被攻城攻击命中；敌人自身与地点形成双重工事时，远程阶段不能攻击它。"] },
  { id: "traits", name: "敌人战斗特性", summary: "迅捷、残暴、中毒、麻痹与召唤会改变不同战斗步骤。", bullets: ["迅捷令完整格挡需求翻倍，但未格挡时仍只造成原攻击值伤害；残暴则令未格挡伤害翻倍。", "中毒令受伤盟军获得 2 张伤势；英雄每获得 1 张手牌伤势，还会向弃牌堆加入 1 张伤势。", "麻痹会摧毁受伤盟军；英雄获得伤势后弃掉全部非伤势手牌。召唤会临时抽取棕色敌人替代召唤者处理攻击。"] },
  { id: "unit-combat", name: "盟军能力与抗性", summary: "每支盟军每轮只能发动一次，但必须从牌面分支中选择一项。", bullets: ["带颜色魔力符号的能力必须先支付对应魔力；可使用源泉、临时魔力或对应水晶。", "临时魔力必须在本回合用完；水晶保留。盟军到下一轮才自动重整。", "匹配攻击属性的抗性先以护甲吸收一次且不受伤；若仍有伤害，盟军受伤并再以护甲吸收一次。"] },
  { id: "growth", name: "成长、名望与声誉", summary: "名望推动等级成长，偶数等级选择英雄技能和进阶行动。", bullets: ["名望阈值为 0 / 3 / 8 / 15 / 24 / 35 / 48 / 63 / 80 / 99。", "偶数等级选择一项专属技能，并从公开供应获得进阶行动。", "奇数等级提高指挥上限；部分等级也会提高护甲或手牌上限。"] },
  { id: "ending", name: "终局与计分", summary: "攻克第二座城市后获得最后一个完整回合，然后结算。", bullets: ["基础名望加上知识、领导力、冒险、征服、圣器、水晶与城市奖励。", "伤势会扣分；提前完成、虚拟玩家余牌和未宣告轮末可提供额外奖励。", "第六轮结束仍未攻克两城则任务失败，但依然会显示完整分数。"] },
];

const ATTACK_RULES = [
  { id: "physical", title: "物理攻击", tag: "元素属性", summary: "没有元素图标的普通攻击。", details: ["所有类型的格挡对物理攻击都按全值结算。", "敌人的物理抗性会使针对它的物理攻击总值减半；盟军的物理抗性可以在承伤时无伤吸收一次自身护甲。"] },
  { id: "fire", title: "火焰攻击", tag: "元素属性", summary: "红色火焰属性的攻击。", details: ["只有寒冰格挡与冷热火格挡按全值结算；物理、火焰格挡均为低效。", "敌人火焰抗性使火焰攻击减半，并忽略红色行动牌的非攻击效果及由红色魔力驱动的盟军非攻击能力。"] },
  { id: "ice", title: "寒冰攻击", tag: "元素属性", summary: "蓝色寒冰属性的攻击。", details: ["只有火焰格挡与冷热火格挡按全值结算；物理、寒冰格挡均为低效。", "敌人寒冰抗性使寒冰攻击减半，并忽略蓝色行动牌的非攻击效果及由蓝色魔力驱动的盟军非攻击能力。"] },
  { id: "coldfire", title: "冷热火攻击", tag: "复合元素", summary: "同时包含火焰与寒冰，最难格挡。", details: ["只有冷热火格挡按全值结算；其他所有格挡均为低效。", "目标必须同时具有火焰抗性与寒冰抗性，才会把冷热火攻击减半；盟军也必须同时拥有两种抗性才能抵抗冷热火伤害。"] },
  { id: "ranged", title: "远程攻击", tag: "射程类型", summary: "在敌人攻击前，于远程/攻城阶段使用。", details: ["只能攻击没有防御工事的敌人；若目标没有工事，可以把远程与攻城攻击合并。", "远程不是第五种元素：它仍可带有物理、火焰、寒冰或冷热火属性，并照常检查抗性。不能把行动牌横置成远程攻击。"] },
  { id: "siege", title: "攻城攻击", tag: "射程类型", summary: "用于在远程阶段突破一层防御工事。", details: ["目标有一层防御工事时，远程阶段只计算攻城攻击；普通远程攻击不生效。", "敌人自身带工事且又位于有工事的地点时形成双重工事：远程阶段完全不能选它为目标。进入近战阶段后，远程与攻城数值都可当作普通攻击使用。"] },
] as const;

const RESISTANCE_RULES = [
  { id: "enemy", title: "敌人的攻击抗性", tag: "攻击者结算", summary: "抗性不会让攻击完全无效，而是让对应属性的攻击低效。", details: ["先把所有按全值生效的攻击相加；再把所有低效攻击统一相加、除以 2 并向下取整，最后两者相加。不要按每种颜色分别舍入。", "例：目标有火焰抗性；物理攻击 3 + 火焰攻击 5 的有效值为 3 + ⌊5÷2⌋ = 5。若多个属性均被抗性压制，它们先汇总后只舍入一次。"] },
  { id: "enemy-effects", title: "抗性对非攻击效果", tag: "额外免疫", summary: "火焰与寒冰抗性还会屏蔽同色的非攻击干扰。", details: ["火焰抗性：忽略红色行动牌的非攻击效果，以及用红色魔力支付的盟军非攻击能力。", "寒冰抗性：同理忽略蓝色行动牌与蓝魔盟军能力的非攻击效果。由这些牌产生的攻击仍可使用，只是按抗性减半。"] },
  { id: "unit", title: "盟军的伤害抗性", tag: "承伤结算", summary: "匹配抗性让盟军有机会承伤而不受伤。", details: ["先从待分配伤害中减去一次盟军护甲；若伤害归零，盟军不受伤，但本场战斗不能再分配伤害给它。", "若仍有伤害，盟军受伤，再从剩余伤害中减去一次护甲。例：护甲 4 的火抗盟军承受火焰 5：先吸收 4，剩余 1 令其受伤，再吸收剩余伤害。"] },
] as const;

const ENEMY_EFFECT_RULES = [
  { id: "swift", title: "迅捷", tag: "格挡特效", summary: "完整格挡需求变为敌人印刷攻击值的 2 倍。", details: ["迅捷只改变格挡需求；如果不格挡，承受的仍是原攻击值。", "移除迅捷的能力只影响当前目标与当前战斗。"] },
  { id: "brutal", title: "残暴", tag: "承伤特效", summary: "未被完整格挡时，实际伤害变为攻击值的 2 倍。", details: ["它不提高格挡需求；只要完整格挡，便不会造成伤害。", "与迅捷同时存在时：格挡需求翻倍；若格挡失败，伤害也翻倍。"] },
  { id: "poison", title: "中毒", tag: "伤势特效", summary: "让伤势持续污染牌组或盟军。", details: ["盟军因此受伤时放置 2 张伤势，而不是 1 张。", "英雄每向手牌加入 1 张伤势，还要向弃牌堆加入 1 张额外伤势；弃牌堆里的额外伤势不计入本场战斗的击倒门槛。"] },
  { id: "paralyze", title: "麻痹", tag: "伤势特效", summary: "一旦造成伤势，惩罚立即发生。", details: ["盟军若被麻痹攻击打伤，立即摧毁并移出游戏。", "英雄若至少获得 1 张伤势，立即弃掉手中所有非伤势牌。"] },
  { id: "summon", title: "召唤", tag: "格挡/承伤特效", summary: "在格挡步骤临时抽一枚棕色敌人替代召唤者。", details: ["临时敌人的攻击与特性用于格挡和承伤；处理完后弃掉，不提供名望。", "召唤存在时不能以效果指定原召唤者。若召唤者的攻击已被取消，则不会抽取临时敌人。"] },
  { id: "multiple", title: "多重攻击", tag: "Lost Legion", summary: "同一枚敌人标记会发动两次或三次独立攻击。", details: ["按玩家选择的顺序逐次处理；每次都要分别完整格挡或承伤，不能合并格挡，也不能把多余格挡转移到下一次。", "只影响一次攻击的效果只作用于当前这一次；若效果让该敌人不能攻击，则取消它的全部印刷攻击。只有每一次都成功格挡，才算成功格挡该敌人。"] },
  { id: "arcane", title: "奥术免疫", tag: "Lost Legion", summary: "忽略直接指定该敌人的非攻击、非格挡效果。", details: ["不能取消其攻击、降低其护甲或移除迅捷等特性。", "攻击点与格挡点仍正常生效，并继续检查元素抗性。"] },
  { id: "assassination", title: "刺杀", tag: "Lost Legion / Tezla", summary: "未格挡伤害直接指向英雄。", details: ["不能把刺杀攻击的伤害分配给盟军。", "仍可使用盟军提供的格挡来完整阻止攻击。"] },
  { id: "defend", title: "防卫", tag: "Shades of Tezla", summary: "把印刷的防卫值加到本场战斗中一个敌人的护甲。", details: ["第一次发动攻击前分配防卫；多名防卫者必须分别保护不同的存活敌人。单独出现时，它可以保护自己。", "只有防卫者仍存活时加成才有效；若它在能力应用前被击败，该项防卫被忽略。"] },
  { id: "cumbersome", title: "笨重", tag: "Lost Legion", summary: "在格挡阶段花移动点逐点压低笨重攻击。", details: ["每花 1 移动，使其中一次印刷攻击降低 1；同时降低完整格挡需求与格挡失败后的伤害。", "攻击降到 0 视为成功格挡；不能使用上一移动阶段遗留的移动，必须在战斗中产生并支付。"] },
  { id: "elusive", title: "飘忽", tag: "Lost Legion", summary: "敌人具有高、低两个护甲值；成功格挡才会暴露弱点。", details: ["远程/攻城阶段始终使用较高护甲。", "若全部印刷攻击都被成功格挡，近战阶段使用较低护甲；否则继续使用较高护甲。护甲修正会同时作用于两个数值。"] },
  { id: "faction-token", title: "派系标记", tag: "Shades of Tezla", summary: "击败带派系图标的敌人后，获得对应派系的一次性魔法物品。", details: ["标记通常每回合使用一枚；也可在互动中弃掉，换取 1 名望或 3 影响力。", "本地融合征服会记录这些标记；未使用的每枚在终局计 1 名望。"] },
  { id: "fortified", title: "防御工事", tag: "目标限制", summary: "限制远程/攻城阶段可以使用的攻击类型。", details: ["一层工事：只能用攻城攻击；双重工事：该阶段不能成为目标。", "工事不改变格挡、承伤与近战阶段；攻城攻击在近战可作为普通攻击使用。"] },
  { id: "knockout", title: "英雄击倒", tag: "整场战斗", summary: "统计整场战斗中加入英雄手牌的伤势总数。", details: ["累计数量达到或超过英雄未修正手牌上限时，英雄被击倒并弃掉手中所有非伤势牌。", "多个敌人分别造成的伤势需要累计；中毒放入弃牌堆的额外伤势不计入此累计。"] },
] as const;

type SiteRecord = { id: SiteType; group: string; summary: string; actions: string[]; reward?: string; source?: ComponentSource };
const SITES: SiteRecord[] = [
  { id: "village", group: "居民点", summary: "提供基层盟军、治疗与补给。", actions: ["招募村庄盟军", "花 3 影响力治疗伤势"] },
  { id: "monastery", group: "居民点", summary: "提供僧侣、治疗和进阶行动；也可尝试焚烧。", actions: ["招募、治疗或学习", "焚烧：声誉 -3，才抽取一枚紫色守卫，且不能使用盟军", "失败弃掉守卫，修道院保留；胜利后焚毁并视为空地"], reward: "焚烧成功：圣器" },
  { id: "keep", group: "防御工事", summary: "攻克后成为己方要塞，并在附近提高补牌上限。", actions: ["强攻守军，声誉 -1", "攻克后招募要塞盟军"], reward: "控制要塞" },
  { id: "mageTower", group: "防御工事", summary: "有结界守卫的法师塔。", actions: ["强攻守军，声誉 -1", "攻克后学习法术"], reward: "免费获得法术" },
  { id: "mine", group: "安全地点", summary: "蕴藏对应颜色魔力的水晶矿。", actions: ["在此结束回合"], reward: "获得对应颜色水晶" },
  { id: "glade", group: "安全地点", summary: "具有治愈力量的魔法林地。", actions: ["在此结束回合"], reward: "移除 1 张伤势" },
  { id: "ruins", group: "冒险地点", summary: "板块揭示时只抽黄色遗迹标记；其中描绘的敌人到宣布进入时才抽取。", actions: ["停在此处后宣布进入，也可继续移动", "未击败的敌人留在遗迹，已击败者不补充"], reward: "以黄色标记所示为准" },
  { id: "monsterDen", group: "冒险地点", summary: "怪物巢穴：宣布进入后才抽一枚棕色敌人；可以使用盟军和正常昼夜魔力规则。", actions: ["停在此处后宣布进入，也可继续移动", "失败时未击败的敌人留在巢穴"], reward: "掷两颗魔力骰：基础色/金色获得水晶，黑色获得 1 名望" },
  { id: "dungeon", group: "冒险地点", summary: "地下城：宣布进入后抽一枚棕色敌人；按夜晚魔力规则且不能使用盟军。", actions: ["失败时弃掉本次敌人，下次重新抽取", "征服后可重入，新敌人只提供名望"], reward: "首次胜利掷魔力骰决定法术或圣器" },
  { id: "tomb", group: "冒险地点", summary: "古墓：宣布进入后才抽一枚红色龙裔；按夜晚规则且不能使用盟军。", actions: ["停在此处后宣布进入", "失败时弃掉本次敌人，下次重新抽取"], reward: "法术 + 圣器" },
  { id: "spawningGrounds", group: "冒险地点", summary: "宣布进入后抽取两枚棕色敌人，并在同一场战斗中处理。", actions: ["失败时幸存敌人留下", "已击败者以新的面朝下棕色标记补回"], reward: "圣器 + 3 水晶" },
  { id: "maze", group: "扩展冒险地点", summary: "支付 2、4 或 6 移动后，才随机抽取一枚棕色守卫。", actions: ["站上地点不会抽敌人或自动开战", "失败时弃掉本次守卫；下次进入重新抽取"], reward: "按移动档位获得水晶、法术或圣器", source: "lost-legion" },
  { id: "labyrinth", group: "扩展冒险地点", summary: "支付 2、4 或 6 移动后，才随机抽取一枚红色龙裔守卫。", actions: ["站上地点不会抽敌人或自动开战", "失败时弃掉本次守卫；下次进入重新抽取"], reward: "按档位获得两水晶、法术或圣器；每档都额外获得进阶行动", source: "lost-legion" },
  { id: "deepMine", group: "扩展安全地点", summary: "与普通水晶矿相同，但回合结束时直接从板块标示的颜色中选择。", actions: ["在此结束回合", "不掷骰，选择标示颜色之一"], reward: "1 枚所选颜色水晶", source: "lost-legion" },
  { id: "refugeeCamp", group: "扩展居民点", summary: "难民营允许在同一次互动中招募任意数量的公开盟军。", actions: ["村庄单位按原价", "修道院/要塞/法师塔单位费用 +1", "仅城市单位费用 +3；声誉、影响力和指挥上限照常结算"], source: "lost-legion" },
  { id: "graveyard", group: "Tezla 剧情覆盖地点", summary: "移动费用沿用覆盖前地形；白昼也使用夜晚魔力规则。", actions: ["夜晚回合开始获得 1 份黑色魔力", "敌人、封印条件与奖励由所选剧情/号令指定，地点卡本身不生成战利品"], source: "shades-of-tezla" },
  { id: "necropolis", group: "Tezla 剧情覆盖地点", summary: "移动费用 2；白昼也使用夜晚魔力规则。", actions: ["夜晚回合开始获得 1 份黑色魔力", "首领、守军、工事与奖励由所选剧情/号令指定"], source: "shades-of-tezla" },
  { id: "hiddenValley", group: "Tezla 安全地点", summary: "移动费用 2；地点卡本身不生成敌人或战利品。", actions: ["结束回合从手牌或弃牌堆移除 1 张伤势", "白昼回合开始获得金色魔力，夜晚获得黑色魔力"], source: "shades-of-tezla" },
  { id: "volkareCamp", group: "Lost Legion 剧情地点", summary: "营地替代一座城市；军团构成由沃尔卡雷等级决定，强攻不降低声誉。", actions: ["逐个或分组对付军团；未击败者永久留在营地", "沃尔卡雷与幸存军团一起攻击，但不能成为攻击目标", "征服后按城市和盾牌计分，并开放招募、扩充供应与追猎服务"], reward: "每两枚灰/绿或每枚红/白败军增加 1 盾；营地按一座城市计分", source: "lost-legion" },
  { id: "rampager", group: "游荡敌军", summary: "公开的兽人敌军，不能进入其所在格。", actions: ["从相邻格挑战", "相邻格间移动会激怒它"], reward: "名望 + 声誉" },
  { id: "dragon", group: "游荡敌军", summary: "公开的高威胁巨龙，不能进入其所在格。", actions: ["从相邻格挑战"], reward: "大量名望 + 声誉" },
  { id: "city1", group: "任务城市", summary: "城市板块出现时按城市底座等级抽好整支守军；英雄在任意昼夜进入相邻格时全部公开。", actions: ["守军均有地点防御工事", "白城 +1 护甲；蓝城强化元素攻击；红城物理攻击获得残暴；绿城物理攻击获得中毒", "已公开强攻与确定性战斗步骤可撤回，直到产生新信息或随机结果"], reward: "城市征服进度" },
  { id: "city2", group: "任务城市", summary: "第二座城市等级更高，但抽取、公开与城市战斗加成的规则相同。", actions: ["相邻时无论昼夜公开整支守军", "集结牌组发动总攻"], reward: "完成征服目标" },
];

const TERRAIN_INFO: Record<Terrain, string> = {
  portal: "英雄的起始位置；普通移动费用为 2。", plains: "最容易穿越的基础地形。", forest: "白昼容易、夜晚困难。", desert: "白昼酷热、夜晚更易通行。", hills: "稳定的中等费用地形。",
  swamp: "昼夜都很难通过。", wasteland: "昼夜费用相同的荒凉地带。", lake: "普通移动不可进入。", mountain: "普通移动不可进入。", city: "城市格费用为 2，通常有防御工事守军。",
};

const CATEGORY_META: Array<{ id: WikiCategory; label: string; icon: string; note: string }> = [
  { id: "rules", label: "规则手册", icon: "卷", note: "回合、移动、战斗与计分" },
  { id: "cards", label: "卡牌图鉴", icon: "牌", note: "行动、法术、圣器与战术" },
  { id: "enemies", label: "怪兽与守军", icon: "敌", note: "属性、特性与奖励" },
  { id: "sites", label: "建筑与地点", icon: "址", note: "互动、战斗与地点效果" },
  { id: "terrain", label: "地形", icon: "域", note: "昼夜移动费用" },
  { id: "units", label: "盟军", icon: "军", note: "招募地点与能力" },
  { id: "heroes", label: "英雄与技能", icon: "骑", note: "全部骑士、起始牌与专属成长" },
  { id: "tiles", label: "地图板块", icon: "图", note: "全部固定七格板块" },
];

const TIER_LABELS: Record<CardDef["tier"], string> = { basic: "基础行动", advanced: "进阶行动", spell: "法术", artifact: "圣器" };
const TILE_LOCAL_LABELS: Record<TileLocal, string> = { nw: "左上", ne: "右上", w: "左", c: "中央", e: "右", sw: "左下", se: "右下" };

function includesQuery(query: string, ...values: Array<string | number | undefined>) {
  if (!query) return true;
  return values.join(" ").toLowerCase().includes(query.toLowerCase());
}

function moveCost(value: number) {
  return Number.isFinite(value) ? String(value) : "不可进入";
}

const TOKEN_LABELS = { green: "绿色兽人可汗", red: "红色龙族", gray: "灰色要塞守军", violet: "紫色法师塔守军", brown: "棕色地下城怪物", white: "白色城市守军" } as const;

function enemyTraits(enemy: Enemy) {
  return [
    enemy.fortified && "防御工事", enemy.swift && "迅捷", enemy.brutal && "残暴", enemy.poison && "剧毒", enemy.paralyze && "麻痹", enemy.summon && "召唤",
    (enemy.attackCount ?? 1) > 1 && `${enemy.attackCount} 重攻击`, enemy.arcaneImmunity && "奥术免疫", enemy.assassination && "刺杀", enemy.defend && "防卫", enemy.cumbersome && "笨重", enemy.elusiveArmor && `飘忽 ${enemy.elusiveArmor}`,
    enemy.faction === "elementalists" && "元素派", enemy.faction === "dark-crusaders" && "黑暗十字军",
    ...(enemy.resistances ?? []).map((item) => `${item === "physical" ? "物理" : item === "fire" ? "火焰" : "寒冰"}抗性`),
  ].filter(Boolean) as string[];
}

function WikiCard({ card }: { card: CardDef }) {
  return <article className={`wiki-entry wiki-playing-card mana-${card.color}`}>
    <div className={`wiki-card-image ${cardArtClass(card)}`} style={cardArtStyle(card)}><i>{MANA_LABELS[card.color].slice(0, 1)}</i><b>✦ ✦ ✦ ✦ ✦</b><span>{TIER_LABELS[card.tier]}</span></div>
    <div className="wiki-entry-body">
      <div className="wiki-entry-title"><div><small>{TIER_LABELS[card.tier]} · {MANA_LABELS[card.color]}{card.alternateColor ? `/${MANA_LABELS[card.alternateColor]}` : ""}色 · {SOURCE_LABELS[card.source ?? "base"]}{card.copies ? ` · 实体 ${card.copies} 张` : ""}</small><h3>{card.name}</h3>{card.englishName && <small>{card.englishName}</small>}</div>{card.cost && <em>{card.cost} 影响力</em>}</div>
      <dl className="wiki-effect-list"><div><dt>基础</dt><dd>{card.basicLabel}</dd></div><div><dt>强化</dt><dd>{card.poweredLabel}</dd></div></dl>
      <p>{card.tier === "spell" ? "强效只在夜晚可用，并需要黑色魔力与对应颜色魔力。" : card.tier === "artifact" ? "基础能力使用后正常弃置；强效不耗魔力，但结算后将此圣器移出游戏。" : `强化需要${MANA_LABELS[card.color]}${card.alternateColor ? `或${MANA_LABELS[card.alternateColor]}` : ""}色魔力。`}</p>
    </div>
  </article>;
}

function WikiContent({ category, query, scope }: { category: WikiCategory; query: string; scope: ContentMode }) {
  if (category === "rules") {
    const results = RULE_CHAPTERS.filter((item) => includesQuery(query, item.name, item.summary, ...item.bullets));
    const attacks = ATTACK_RULES.filter((item) => includesQuery(query, item.title, item.tag, item.summary, ...item.details));
    const resistances = RESISTANCE_RULES.filter((item) => includesQuery(query, item.title, item.tag, item.summary, ...item.details));
    const effects = ENEMY_EFFECT_RULES.filter((item) => includesQuery(query, item.title, item.tag, item.summary, ...item.details));
    const referenceSection = (title: string, note: string, items: ReadonlyArray<{ id: string; title: string; tag: string; summary: string; details: readonly string[] }>) => items.length ? <section className="wiki-library-section wiki-combat-reference"><div className="wiki-section-heading"><h2>{title}</h2><span>{note}</span></div><div className="wiki-reference-grid">{items.map((item) => <article key={item.id} className="wiki-reference-card"><small>{item.tag}</small><h3>{item.title}</h3><p>{item.summary}</p><ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul></article>)}</div></section> : null;
    return <>
      {referenceSection("攻击类型详解", "元素属性与射程类型分开结算", attacks)}
      {referenceSection("抗性如何结算", "敌人与盟军使用不同规则", resistances)}
      {referenceSection("攻击特效与战斗关键词", "按触发阶段逐项处理", effects)}
      {results.length > 0 && <section className="wiki-library-section"><div className="wiki-section-heading"><h2>完整流程章节</h2><span>{results.length} 章</span></div><div className="wiki-rule-list">{results.map((chapter, index) => <article key={chapter.id} className="wiki-rule-chapter"><i>{String(index + 1).padStart(2, "0")}</i><div><small>规则章节</small><h3>{chapter.name}</h3><p>{chapter.summary}</p><ul>{chapter.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></div></article>)}</div></section>}
    </>;
  }

  if (category === "cards") {
    const cardCatalog = scope === "ultimate" ? ALL_CARD_DEFS : CARD_DEFS;
    const cards = Object.values(cardCatalog).filter((card) => includesQuery(query, card.name, card.id, TIER_LABELS[card.tier], MANA_LABELS[card.color], card.alternateColor ? MANA_LABELS[card.alternateColor] : undefined, SOURCE_LABELS[card.source ?? "base"], card.basicLabel, card.poweredLabel));
    const tactics = TACTICS.filter((tactic) => includesQuery(query, tactic.name, tactic.time === "day" ? "白昼" : "夜晚", tactic.text));
    const showWound = includesQuery(query, "伤势", "卡牌 负担 治疗");
    return <>
      {(["basic", "advanced", "spell", "artifact"] as CardDef["tier"][]).map((tier) => {
        const tierCards = cards.filter((card) => card.tier === tier);
        const counts = scope === "ultimate" ? ULTIMATE_COMPONENT_COUNTS : BASE_COMPONENT_COUNTS;
        const physicalCount = tier === "basic" ? counts.basicActions : tier === "advanced" ? counts.advancedActions : tier === "spell" ? counts.spells : counts.artifacts;
        return tierCards.length ? <section key={tier} className="wiki-library-section"><div className="wiki-section-heading"><h2>{TIER_LABELS[tier]}</h2><span>{scope === "ultimate" ? "Ultimate Edition" : "基础版"} {physicalCount} 张 · {tierCards.length} 种牌面</span></div><div className="wiki-grid wiki-card-grid">{tierCards.map((card) => <WikiCard key={card.id} card={card} />)}</div></section> : null;
      })}
      {tactics.length > 0 && <section className="wiki-library-section"><div className="wiki-section-heading"><h2>昼夜战术</h2><span>{tactics.length} 张</span></div><div className="wiki-grid">{tactics.map((tactic) => <article key={tactic.id} className={`wiki-entry wiki-tactic ${tactic.time}`}><i className="basic-card-art" style={tacticArtStyle(tactic.id)}><b>{tactic.order}</b></i><div className="wiki-entry-body"><small>{tactic.time === "day" ? "白昼战术" : "夜晚战术"}</small><h3>{tactic.name}</h3><p>{tactic.text}</p></div></article>)}</div></section>}
      {showWound && <section className="wiki-library-section"><div className="wiki-section-heading"><h2>特殊卡牌</h2><span>1 张</span></div><article className="wiki-entry wiki-wound-entry"><i>×</i><div className="wiki-entry-body"><small>特殊卡牌</small><h3>伤势</h3><p>伤势占据手牌且不能正常打出。可通过治疗效果移除；终局时每张伤势扣 2 分。</p></div></article></section>}
    </>;
  }

  if (category === "enemies") {
    const enemyCatalog = scope === "ultimate" ? ALL_ENEMY_TOKENS : ENEMY_TOKENS;
    const ruinCatalog = scope === "ultimate" ? ALL_RUIN_TOKENS : RUIN_TOKENS;
    const results = enemyCatalog.filter((enemy) => includesQuery(query, enemy.name, enemy.tokenColor ? TOKEN_LABELS[enemy.tokenColor] : "", enemy.description, SOURCE_LABELS[enemy.source ?? "base"], ...enemyTraits(enemy)));
    const ruins = ruinCatalog.filter((token) => includesQuery(query, token.name, token.description, token.reward, SOURCE_LABELS[token.source ?? "base"], ...token.enemies));
    return <>
      <section className="wiki-library-section">
        <div className="wiki-section-heading"><h2>敌人标记</h2><span>六种背面 · {enemyCatalog.length} 枚实体标记</span></div>
        <div className="wiki-grid">{results.map((enemy) => <article key={enemy.id} className="wiki-entry wiki-enemy-entry">
          <div className="wiki-enemy-art enemy-sprite" style={enemyArtStyle(enemy)} />
          <div className="wiki-entry-body"><small>{enemy.tokenColor ? TOKEN_LABELS[enemy.tokenColor] : "敌人标记"} · {SOURCE_LABELS[enemy.source ?? "base"]} · {enemy.id}</small><h3>{enemy.name}</h3><div className="wiki-stat-row"><span>护甲 <b>{enemy.elusiveArmor ?? enemy.armor}</b></span><span>攻击 <b>{enemy.attack}{(enemy.attackCount ?? 1) > 1 ? ` × ${enemy.attackCount}` : ""}</b></span><span>名望 <b>+{enemy.fame}</b></span></div><div className="wiki-tags">{enemyTraits(enemy).map((trait) => <em key={trait}>{trait}</em>)}</div><p>{enemy.description}</p></div>
        </article>)}</div>
      </section>
      <section className="wiki-library-section">
        <div className="wiki-section-heading"><h2>黄色遗迹标记</h2><span>{ruinCatalog.length} 枚</span></div>
        <div className="wiki-grid">{ruins.map((token) => <article key={token.id} className="wiki-entry wiki-enemy-entry wiki-ruin-entry">
          <div className="wiki-enemy-art wiki-ruin-art"><RuinTokenBadge token={token} /></div>
          <div className="wiki-entry-body"><small>黄色遗迹标记 · {SOURCE_LABELS[token.source ?? "base"]} · {token.id}</small><h3>{token.name}</h3><div className="wiki-tags">{token.altarColor ? <em>{MANA_LABELS[token.altarColor]}色祭坛</em> : token.enemies.map((color, index) => <em key={`${color}-${index}`}>{TOKEN_LABELS[color]}</em>)}</div><p>{token.description}</p></div>
        </article>)}</div>
      </section>
    </>;
  }

  if (category === "sites") {
    const results = SITES.filter((site) => (scope === "ultimate" || !site.source) && includesQuery(query, SITE_LABELS[site.id], site.group, site.summary, site.reward, site.source ? SOURCE_LABELS[site.source] : "基础版", ...site.actions));
    return <div className="wiki-grid">{results.map((site) => <article key={site.id} className="wiki-entry wiki-site-entry"><div className="wiki-site-visual"><i className="site-model-sprite" style={siteArtStyle(site.id)} /><b>{SITE_ICONS[site.id]}</b></div><div className="wiki-entry-body"><small>{site.group} · {SOURCE_LABELS[site.source ?? "base"]}</small><h3>{SITE_LABELS[site.id]}</h3><p>{site.summary}</p><ul>{site.actions.map((action) => <li key={action}>{action}</li>)}</ul>{site.reward && <div className="wiki-reward"><span>奖励 / 效果</span><strong>{site.reward}</strong></div>}</div></article>)}</div>;
  }

  if (category === "terrain") {
    const terrains = (Object.keys(TERRAIN_LABELS) as Terrain[]).filter((terrain) => includesQuery(query, TERRAIN_LABELS[terrain], TERRAIN_INFO[terrain], moveCost(TERRAIN_COSTS[terrain].day), moveCost(TERRAIN_COSTS[terrain].night)));
    return <div className="wiki-grid wiki-terrain-grid">{terrains.map((terrain) => <article key={terrain} className="wiki-entry wiki-terrain-entry"><div className={`wiki-terrain-swatch terrain-${terrain}`}><span>{TERRAIN_LABELS[terrain]}</span></div><div className="wiki-entry-body"><h3>{TERRAIN_LABELS[terrain]}</h3><div className="wiki-day-night"><span>☀ 白昼 <b>{moveCost(TERRAIN_COSTS[terrain].day)}</b></span><span>☾ 夜晚 <b>{moveCost(TERRAIN_COSTS[terrain].night)}</b></span></div><p>{TERRAIN_INFO[terrain]}</p></div></article>)}</div>;
  }

  if (category === "units") {
    const siteLabel = { village: "村庄", monastery: "修道院", keep: "己方要塞", mageTower: "法师塔", city: "城市", any: "任意居民点" } as const;
    const unitCatalog = scope === "ultimate" ? ALL_UNIT_DEFS : UNIT_DEFS;
    const results = unitCatalog.filter((unit) => includesQuery(query, unit.name, unit.text, siteLabel[unit.site], SOURCE_LABELS[unit.source ?? "base"], unit.level, unit.armor, unit.cost));
    const counts = scope === "ultimate" ? ULTIMATE_COMPONENT_COUNTS : BASE_COMPONENT_COUNTS;
    return <><div className="wiki-section-heading"><h2>{scope === "ultimate" ? "Ultimate Edition" : "基础版"}盟军</h2><span>常规 {counts.regularUnits} 张 · 精英 {counts.eliteUnits} 张</span></div><div className="wiki-grid">{results.map((unit) => <article key={unit.id} className="wiki-entry wiki-unit-entry"><div className="wiki-unit-art unit-sprite" style={unitArtStyle(unit.id)}><i>{"✦".repeat(unit.level)}</i><b>DEF {unit.armor}</b></div><div className="wiki-entry-body"><small>{unit.tier === "elite" ? "精英" : "常规"} · {SOURCE_LABELS[unit.source ?? "base"]} · 等级 {unit.level} · 实体 ×{unit.copies ?? 1}</small><h3>{unit.name}</h3>{unit.englishName && <small>{unit.englishName}</small>}<div className="wiki-stat-row"><span>护甲 <b>{unit.armor}</b></span><span>费用 <b>{unit.cost}</b></span></div>{unit.resistances?.length ? <div className="wiki-tags">{unit.resistances.map((item) => <em key={item}>{item === "physical" ? "物理抗性" : item === "fire" ? "火焰抗性" : item === "ice" ? "寒冰抗性" : "冷热火抗性"}</em>)}</div> : null}<p>{unit.text}</p><ul className="wiki-unit-abilities">{(unit.abilities ?? []).map((ability) => <li key={ability.id}>{ability.manaCost?.length ? <b>{ability.manaCost.map((color) => MANA_LABELS[color]).join(" + ")}魔</b> : <b>免费</b>}<span>{ability.label}</span></li>)}</ul><div className="wiki-tags"><em>{(unit.recruitSites ?? [unit.site]).map((site) => siteLabel[site]).join(" / ")}</em><em>每轮一次</em><em>指挥位 1</em></div></div></article>)}</div></>;
  }

  if (category === "heroes") {
    const heroes = scope === "ultimate" ? ALL_HEROES : HEROES;
    const skills = scope === "ultimate" ? ALL_HERO_SKILLS : HERO_SKILLS;
    const starterDecks = getStarterDecksForMode(scope);
    const results = heroes.filter((hero) => includesQuery(query, hero.name, hero.title, hero.description, SOURCE_LABELS[hero.source ?? "base"], ...(skills[hero.id] ?? []).flatMap((skill) => [skill.name, skill.description])));
    return <div className="wiki-hero-list">{results.map((hero) => { const deck = (starterDecks[hero.id] ?? []).map(getCard).filter(Boolean); return <article key={hero.id} className={`wiki-entry wiki-hero-entry mana-${hero.color}`}><div className="wiki-hero-art hero-sprite" style={heroArtStyle(hero.id)}><i>{MANA_LABELS[hero.color].slice(0, 1)}</i><b>✦ ✦ ✦ ✦ ✦ ✦ ✦</b></div><div className="wiki-entry-body"><small>{MANA_LABELS[hero.color]}色英雄 · {SOURCE_LABELS[hero.source ?? "base"]} · 16 张专属起始牌组 · {(skills[hero.id] ?? []).length} 枚单人可用技能</small><h3>{hero.name} · {hero.title}</h3><p>{hero.description}</p><div className="wiki-reward"><span>起始牌组</span><strong>{deck.map((item) => item?.name).join("、")}</strong></div><div className="wiki-skill-grid">{(skills[hero.id] ?? []).map((item) => <div key={item.id}><i>✦</i><span><strong>{item.name}</strong><small>{item.englishName} · {item.description}</small></span></div>)}</div></div></article>; })}</div>;
  }

  const tileCatalog = scope === "ultimate" ? ALL_MAP_TILE_TEMPLATES : MAP_TILE_TEMPLATES;
  const tiles = tileCatalog.filter((tile) => includesQuery(query, tile.name, tile.number, tile.kind, SOURCE_LABELS[tile.source ?? "base"], ...tile.cells.flatMap((cell) => [TERRAIN_LABELS[cell.terrain], cell.site === "city" ? "城市" : SITE_LABELS[cell.site]])));
  return <div className="wiki-grid wiki-tile-grid">{tiles.map((tile) => <article key={tile.id} className={`wiki-entry wiki-tile-entry tile-${tile.kind}`}><div className="wiki-tile-diagram">{tile.cells.map((cell) => <span key={cell.local} className={`wiki-tile-cell local-${cell.local} terrain-${cell.terrain}`} title={`${TILE_LOCAL_LABELS[cell.local]}：${TERRAIN_LABELS[cell.terrain]} · ${cell.site === "city" ? "城市" : SITE_LABELS[cell.site]}`}><b>{cell.site === "city" ? "♛" : SITE_ICONS[cell.site]}</b></span>)}</div><div className="wiki-entry-body"><small>{tile.kind === "start" ? "起始板块" : tile.kind === "countryside" ? "乡野板块" : tile.kind === "core-city" ? "城市核心" : tile.kind === "scenario" ? "剧情核心" : "非城市核心"} · {SOURCE_LABELS[tile.source ?? "base"]}</small><h3>{tile.name}</h3><p>板块编号 {tile.number} · 固定方向 · 7 个地形格</p><div className="wiki-tile-contents">{tile.cells.filter((cell) => cell.site !== "none").map((cell) => <span key={cell.local}>{TILE_LOCAL_LABELS[cell.local]}：{cell.site === "city" ? "城市" : SITE_LABELS[cell.site]}</span>)}</div></div></article>)}</div>;
}

function categoryCount(category: WikiCategory, scope: ContentMode) {
  const counts = scope === "ultimate" ? ULTIMATE_COMPONENT_COUNTS : BASE_COMPONENT_COUNTS;
  if (category === "rules") return RULE_CHAPTERS.length + ATTACK_RULES.length + RESISTANCE_RULES.length + ENEMY_EFFECT_RULES.length;
  if (category === "cards") return counts.basicActions + counts.advancedActions + counts.spells + counts.artifacts + counts.wounds + counts.tactics;
  if (category === "enemies") return (scope === "ultimate" ? ALL_ENEMY_TOKENS.length + ALL_RUIN_TOKENS.length : ENEMY_TOKENS.length + RUIN_TOKENS.length);
  if (category === "sites") return SITES.filter((site) => scope === "ultimate" || !site.source).length;
  if (category === "terrain") return Object.keys(TERRAIN_LABELS).length;
  if (category === "units") return counts.regularUnits + counts.eliteUnits;
  if (category === "heroes") return scope === "ultimate" ? ALL_HEROES.length : HEROES.length;
  return scope === "ultimate" ? ALL_MAP_TILE_TEMPLATES.length : MAP_TILE_TEMPLATES.length;
}

export function WikiOverlay({ open, onClose, contentMode = "ultimate" }: { open: boolean; onClose: () => void; contentMode?: ContentMode }) {
  const [category, setCategory] = useState<WikiCategory>("rules");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ContentMode>(contentMode);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeMeta = useMemo(() => CATEGORY_META.find((item) => item.id === category)!, [category]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "/" && (event.target as HTMLElement | null)?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;
  return <div className="wiki-backdrop" role="dialog" aria-modal="true" aria-label="魔法骑士游戏百科" onClick={onClose}>
    <section className="wiki-shell" onClick={(event) => event.stopPropagation()}>
      <header className="wiki-header">
        <div className="wiki-brand"><i>MK</i><div><p>KNIGHT&apos;S ARCHIVE</p><h1>魔法骑士游戏百科</h1></div></div>
        <div className="wiki-scope-toggle" aria-label="百科组件范围"><button className={scope === "base" ? "active" : ""} onClick={() => setScope("base")}>基础版</button><button className={scope === "ultimate" ? "active" : ""} onClick={() => setScope("ultimate")}>Ultimate 全扩展</button></div>
        <label className="wiki-search"><span>⌕</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${activeMeta.label}…`} aria-label={`搜索${activeMeta.label}`} /><kbd>/</kbd></label>
        <button className="wiki-close" onClick={onClose} aria-label="关闭游戏百科"><span>关闭</span> ×</button>
      </header>
      <div className="wiki-layout">
        <nav className="wiki-nav" aria-label="百科分类">
          <div className="wiki-nav-intro"><small>本地版资料库</small><p>收录当前游戏中实际实现的规则与组件。</p></div>
          {CATEGORY_META.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => { setCategory(item.id); setQuery(""); }}><i>{item.icon}</i><span><strong>{item.label}</strong><small>{item.note}</small></span><em>{categoryCount(item.id, scope)}</em></button>)}
          <p className="wiki-scope-note">{scope === "ultimate" ? "当前显示基础游戏、The Lost Legion、Krang、Shades of Tezla 与 Ultimate 双属性牌。" : "当前仅显示基础游戏组件。"} 卡牌效果为适配本地单人版的中文数字化摘要。</p>
        </nav>
        <div className="wiki-main">
          <div className="wiki-main-heading"><div><p>{activeMeta.note}</p><h2>{activeMeta.label}</h2></div><span>{query ? `“${query}”的筛选结果` : `共 ${categoryCount(category, scope)} 项资料`}</span></div>
          <WikiContent category={category} query={query.trim()} scope={scope} />
        </div>
      </div>
    </section>
  </div>;
}
