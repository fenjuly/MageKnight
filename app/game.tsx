"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  ALL_CARD_DEFS,
  ALL_HEROES,
  ALL_RUIN_TOKEN_BY_ID,
  MANA_LABELS,
  RESOURCE_LABELS,
  SITE_LABELS,
  TERRAIN_COSTS,
  TERRAIN_LABELS,
  TACTICS,
  getCard,
  getSkill,
  getUnit,
  getArtifactIdsForMode,
  getEliteUnitIdsForMode,
  getEnemyTokenIdsForMode,
  getHeroSkillsForMode,
  getHeroesForMode,
  getRegularUnitIdsForMode,
  getRuinTokensForMode,
  getWoundIdsForMode,
  type ContentMode,
  type ManaColor,
  type UnitDef,
  type MapCell,
  type ResourceKey,
  type SiteType,
  type Terrain,
} from "../lib/game-data";
import {
  availableManaCount,
  availableResources,
  applyGameActionWithRevert,
  availableTactics,
  availableTileExplorations,
  canActivateUnitAbility,
  canRecruitUnitAtCurrentSite,
  canBuyTier,
  canSpendMana,
  commandLimit,
  combatBlockRequirement,
  combatAttackTargets,
  combatDefendAssignments,
  combatDefendAssignmentsComplete,
  combatDamageTotal,
  combatEnemyArmor,
  createGame,
  createRevertHistory,
  effectiveReputation,
  effectiveAttackValue,
  effectiveGroupAttackValue,
  effectiveBlockValue,
  enemiesOnCell,
  fameToNextLevel,
  generateMapSetup,
  groupedAttackRequirement,
  handLimit,
  hasConqueredVolkareCampServices,
  heroArmor,
  influenceCost,
  isAdjacent,
  isAdventureEnemyCell,
  isRampagingEnemyCell,
  levelFor,
  localsWillInteract,
  mapHandLimitBonus,
  migrateSiteEnemyLifecycle,
  reputationInfluenceModifier,
  revertLastAction,
  scoreGame,
  unitRecruitInfluenceCost,
  tileCenterCoordinates,
  usedSource,
  woundCount,
  type GameAction,
  type CardPlaySelection,
  type GameState,
  type MapShape,
  type MapVariant,
  type RevertHistoryState,
} from "../lib/game-engine";
import { getMapTileTemplate, TILE_LOCAL_COORDS, type MapTileKind } from "../lib/map-tiles";
import { cardArtClass, cardArtStyle, enemyArtStyle, heroArtStyle, siteArtStyle, tacticArtStyle, unitArtStyle } from "../lib/visual-assets";
import { WikiOverlay } from "./wiki";
import { RuinTokenBadge } from "./ruin-token";
import { feedbackForAction, useGameAudio, type GameFeedbackKind } from "./game-audio";
import { ThreeMap } from "./three-map";
import type { Board3DHandle, BoardTarget } from "../lib/three-board";
import { MAP_MANA_COLORS, mapSelectionContext, publicCellIntel } from "../lib/map-intel";
import { THREE_QUALITY_LABELS, readThreeQuality, saveThreeQuality, type ThreeQuality } from "../lib/three-quality";
import { readModelStyle, saveModelStyle, type ModelStyle } from "../lib/realistic-assets";
import { ModelGallery } from "./model-gallery";

const STORAGE_KEY = "mage-knight-solo-conquest-v2";
const BASIC_MANA: Array<"red" | "blue" | "green" | "white"> = ["red", "blue", "green", "white"];
const MANA_DRAW_COLORS: Array<Exclude<ManaColor, "gold">> = ["red", "blue", "green", "white", "black"];
const DEFAULT_MAP_ZOOM = 0.8;
const MIN_MAP_ZOOM = 0.5;
const MAX_MAP_ZOOM = 1.4;
const MAP_ZOOM_STEP = 0.1;
const clampMapPan = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

const UNIT_SITE_LABELS = {
  village: "村庄",
  monastery: "修道院",
  keep: "己方要塞",
  mageTower: "已征服法师塔",
  city: "已征服城市",
  any: "任意居民点",
} as const;

const SITE_ICONS: Record<SiteType, string> = {
  none: "",
  village: "⌂",
  monastery: "✣",
  keep: "♜",
  mageTower: "♝",
  mine: "◆",
  glade: "✦",
  ruins: "⌁",
  monsterDen: "◉",
  dungeon: "◈",
  tomb: "✝",
  spawningGrounds: "●●",
  maze: "⌘",
  labyrinth: "▦",
  deepMine: "◆◆",
  refugeeCamp: "⛺",
  graveyard: "☠",
  necropolis: "♜",
  hiddenValley: "❧",
  volkareCamp: "⚑",
  rampager: "⚔",
  dragon: "♨",
  city1: "♛",
  city2: "♚",
};

const TERRAIN_GLYPHS: Record<Terrain, string> = {
  portal: "✦",
  plains: "≋",
  forest: "♠",
  desert: "∿",
  hills: "▲",
  swamp: "◉",
  wasteland: "╱",
  lake: "≈",
  mountain: "△",
  city: "◆",
};

const MAP_SHAPE_META: Record<MapShape, { name: string; note: string }> = {
  wedge: { name: "规则楔形", note: "单人征服标准：起始板块 A" },
  diamond: { name: "全开放", note: "规则书开放变体：起始板块 B" },
  wings: { name: "三列开放", note: "规则书窄幅开放变体：起始板块 B" },
};

function mapGeometry(cells: Array<Pick<MapCell, "id" | "q" | "r">>, stepX: number, stepY: number, tileWidth: number, tileHeight: number, padding: number) {
  const raw = cells.map((cell) => ({ id: cell.id, x: (cell.q + cell.r / 2) * stepX, y: cell.r * stepY }));
  const minX = Math.min(...raw.map((point) => point.x));
  const minY = Math.min(...raw.map((point) => point.y));
  const maxX = Math.max(...raw.map((point) => point.x));
  const maxY = Math.max(...raw.map((point) => point.y));
  return {
    width: maxX - minX + tileWidth + padding * 2,
    height: maxY - minY + tileHeight + padding * 2,
    positions: Object.fromEntries(raw.map((point) => [point.id, { left: point.x - minX + padding, top: point.y - minY + padding }])) as Record<string, { left: number; top: number }>,
  };
}

function ghostTileCells(tq: number, tr: number) {
  const center = tileCenterCoordinates(tq, tr);
  return Object.values(TILE_LOCAL_COORDS).map((local) => {
    const q = center.q + local.q;
    const r = center.r + local.r;
    return { id: `${q},${r}`, q, r };
  });
}

function tileKindLabel(kind: MapTileKind) {
  return kind === "countryside" ? "乡野板块" : kind === "start" ? "起始板块" : "核心板块";
}

function terrainMoveLabel(terrain: Terrain, time: GameState["time"]) {
  const cost = TERRAIN_COSTS[terrain][time];
  return Number.isFinite(cost) ? String(cost) : "不可进入";
}

const SITE_HELP: Record<SiteType, { summary: string; actions: string[] }> = {
  none: { summary: "没有建筑或敌军的普通野外区域。", actions: ["继续向相邻区域移动", "结束回合并补牌"] },
  village: { summary: "村民愿意提供治疗、补给与基层盟军。", actions: ["花费影响力招募村庄盟军", "花费 3 影响力移除 1 张伤势"] },
  monastery: { summary: "修道院可疗愈、招募与学习；也可作为行动尝试焚烧：声誉 -3，随机抽取紫色守卫且不能使用盟军。", actions: ["招募村庄或修道院盟军", "花费 2 影响力治疗伤势", "从修道院供应中学习进阶行动", "焚烧成功获得圣器，失败则弃掉守卫且修道院保留"] },
  keep: { summary: "板块揭示时放置一枚面朝下灰色守军；白昼相邻时公开，夜晚到强攻开始才公开。", actions: ["强攻使声誉 -1，守军获得地点防御工事", "攻克后招募要塞或村庄盟军", "在己方要塞或其相邻格补牌时获得手牌加成"] },
  mageTower: { summary: "板块揭示时放置一枚面朝下紫色守军；白昼相邻时公开，夜晚到强攻开始才公开。", actions: ["强攻使声誉 -1，需以攻城攻击突破守军", "攻克时免费获得一张法术", "攻克后花影响力学习法术"] },
  mine: { summary: "蕴藏特定颜色魔力的水晶矿脉。", actions: ["在此结束回合，自动获得 1 枚对应颜色水晶"] },
  glade: { summary: "具有治愈力量的宁静林地。", actions: ["在此结束回合，从手牌或弃牌堆移除 1 张伤势"] },
  ruins: { summary: "板块揭示时只抽黄色遗迹标记；标记所示敌人要等你宣布进入后才抽取。", actions: ["可以把这里当作普通地形继续移动", "停在此处后祭拜祭坛或进入战斗", "战败时未击败的敌人留在遗迹"] },
  monsterDen: { summary: "怪物巢穴在宣布进入后才抽一枚棕色敌人；盟军和通常魔力规则均可使用。", actions: ["可以把这里当作普通地形继续移动", "失败时敌人留在巢穴", "胜利掷两颗魔力骰获得水晶；黑色结果改为名望 +1"] },
  dungeon: { summary: "地下城在宣布进入后才抽一枚棕色敌人；即使白昼也按夜间魔力规则，且不能带盟军。", actions: ["失败时弃掉本次守卫，下次重新抽取", "首次胜利按魔力骰结果获得法术或圣器", "征服后仍可重入，只获得敌人名望"] },
  tomb: { summary: "古墓在宣布进入后才抽一枚红色龙裔；按夜晚规则且不能带盟军。", actions: ["可以把这里当作普通地形继续移动", "失败时弃掉本次守卫，下次重新抽取"] },
  spawningGrounds: { summary: "繁殖地在宣布进入后抽两枚棕色敌人，并按多敌军战斗处理。", actions: ["可以把这里当作普通地形继续移动", "失败时幸存者留下，已击败者以新面朝下标记补回"] },
  maze: { summary: "宣布进入时从未受伤、未横置的盟军中至多选择一支，并重新支付 2/4/6 移动；之前剩余的移动不能用于这笔费用。", actions: ["支付 2：自选两枚基础色水晶", "支付 4：一张法术", "支付 6：一件圣器", "失败时弃掉守卫"] },
  labyrinth: { summary: "规则与迷宫相同，但抽红色守卫；每一档奖励都额外获得一张进阶行动。", actions: ["支付 2：自选两枚基础色水晶 + 进阶行动", "支付 4：法术 + 进阶行动", "支付 6：圣器 + 进阶行动", "失败时弃掉守卫"] },
  deepMine: { summary: "深矿在回合结束时直接产出板块标示颜色的水晶。", actions: ["在此结束回合", "从标示颜色中选择并获得 1 枚水晶"] },
  refugeeCamp: { summary: "难民营允许在同一次互动中招募任意数量的公开盟军，但远道而来的单位会加价。", actions: ["村庄单位原价", "修道院/要塞/法师塔单位 +1", "仅城市单位 +3"] },
  graveyard: { summary: "Shades of Tezla 剧情覆盖地点：移动费用按覆盖前地形，白昼也使用夜晚魔力规则。", actions: ["夜晚回合开始获得 1 份黑色魔力", "只有剧情/号令在此放置敌人时才会出现战斗与对应奖励"] },
  necropolis: { summary: "Shades of Tezla 剧情覆盖地点：移动费用 2，白昼也使用夜晚魔力规则。", actions: ["夜晚回合开始获得 1 份黑色魔力", "首领、守军与奖励均由所选剧情/号令指定"] },
  hiddenValley: { summary: "Shades of Tezla 安全地点，移动费用 2；地点卡本身不会生成守军或战利品。", actions: ["结束回合治疗一张伤势", "白昼回合开始获得金色魔力，夜晚获得黑色魔力"] },
  volkareCamp: { summary: "沃尔卡雷营地替代一座城市；守军数量由沃尔卡雷等级决定，强攻不会降低声誉。", actions: ["未击败的军团守军会留在营地，沃尔卡雷与幸存军团一起攻击", "征服后按城市计分并提高附近手牌上限", "营地及相邻格可招募村庄/要塞盟军、扩充普通盟军供应或进行一次追猎"] },
  rampager: { summary: "兽人是游荡敌人，地形一揭示就以正面标记公开。", actions: ["从相邻区域挑战兽人", "击败后获得名望与声誉轨位 +1"] },
  dragon: { summary: "极其危险的巨龙巢穴，未格挡攻击会造成双倍伤害。", actions: ["集结强力攻防资源挑战巨龙", "击败它以获得大量名望"] },
  city1: { summary: "城市出现时按等级底座抽好面朝下守军；无论昼夜，只要相邻就公开整支守军。", actions: ["强攻城市并击败全部地点防御工事守军", "白城 +1 护甲；蓝城强化元素攻击；红城赋予物理残暴；绿城赋予物理中毒", "攻克后使用城市服务"] },
  city2: { summary: "第二座高等级城市遵循相同的抽取、相邻公开与城市加成规则。", actions: ["准备多支盟军与攻城攻击", "攻克后完成主要目标"] },
};

function hasSiteArt(cell: { terrain: string; site: SiteType }) {
  return cell.terrain === "portal" || !["none", "rampager"].includes(cell.site);
}

function enemyTraitDetails(enemy: NonNullable<MapCell["enemy"]>) {
  const details: string[] = [];
  if (enemy.fortified) details.push((enemy.fortificationLevel ?? 1) >= 2 ? "双重防御工事：远程阶段不能攻击。" : "防御工事：远程阶段只能使用攻城攻击。");
  if (enemy.swift) details.push("迅捷：完整格挡需求为攻击值的 2 倍；若不格挡，伤害不翻倍。");
  if (enemy.brutal) details.push("残暴：未格挡时造成 2 倍伤害。");
  if (enemy.poison) details.push("中毒：盟军受伤放置 2 张伤势；英雄每获 1 张手牌伤势，再向弃牌堆加入 1 张。");
  if (enemy.paralyze) details.push("麻痹：受伤盟军被摧毁；英雄受伤后弃掉全部非伤势手牌。");
  if (enemy.summon) details.push("召唤：格挡阶段抽 1 枚棕色敌人替代它攻击，随后弃掉召唤标记且不获名望。");
  if ((enemy.attackCount ?? 1) > 1) details.push(`多重攻击：该标记发动 ${enemy.attackCount} 次彼此独立的攻击；每一次都要分别格挡或承伤，多余格挡不能转移。只有全部攻击都被格挡，才算完整格挡该敌人。`);
  if (enemy.arcaneImmunity) details.push("奥术免疫：不能用指向敌人的非攻击卡牌或盟军能力取消攻击、降低护甲或移除特性。");
  if (enemy.assassination) details.push("刺杀：若未完整格挡，伤害只能分配给英雄，不能由盟军承受。");
  if (enemy.defend) details.push(`防卫：第一次发动攻击前，把防卫 ${enemy.defend} 分配给一个不同的存活敌人；若它在该能力应用前被击败，加成消失。`);
  if (enemy.cumbersome) details.push("笨重：在格挡阶段每花 1 点新产生的移动，使当前一次印刷攻击降低 1；不会转移给下一次攻击。");
  if (enemy.elusiveArmor) details.push(`飘忽：攻击检定使用较高护甲 ${enemy.elusiveArmor}。`);
  if (enemy.attackElement && enemy.attackElement !== "physical") details.push(`${enemy.attackElement === "fire" ? "火焰" : enemy.attackElement === "ice" ? "寒冰" : "冷热火"}攻击会按元素格挡效率结算。`);
  (enemy.resistances ?? []).forEach((item) => details.push(`${item === "physical" ? "物理" : item === "fire" ? "火焰" : item === "ice" ? "寒冰" : "冷热火"}抗性：对应攻击总值减半并向下取整。`));
  return details;
}

function enemyTraitLabels(enemy: NonNullable<MapCell["enemy"]>) {
  return [
    enemy.fortified && "防御工事",
    enemy.swift && "迅捷",
    enemy.brutal && "残暴",
    enemy.poison && "中毒",
    enemy.paralyze && "麻痹",
    enemy.summon && "召唤",
    (enemy.attackCount ?? 1) > 1 && `${enemy.attackCount} 重攻击`,
    enemy.arcaneImmunity && "奥术免疫",
    enemy.assassination && "刺杀",
    enemy.defend && "防卫",
    enemy.cumbersome && "笨重",
    enemy.elusiveArmor && `飘忽 ${enemy.elusiveArmor}`,
    enemy.attackElement === "fire" && "火焰攻击",
    enemy.attackElement === "ice" && "寒冰攻击",
    enemy.attackElement === "coldfire" && "冷热火攻击",
    ...(enemy.resistances ?? []).map((resistance) => `${resistance === "physical" ? "物理" : resistance === "fire" ? "火焰" : resistance === "ice" ? "寒冰" : "冷热火"}抗性`),
  ].filter((trait): trait is string => Boolean(trait));
}

function EnemyMapIntel({ enemy }: { enemy: NonNullable<MapCell["enemy"]> }) {
  const traits = enemyTraitLabels(enemy);
  const details = enemyTraitDetails(enemy);
  const attackCount = enemy.attackCount ?? 1;
  return (
    <article className="inspector-enemy-intel">
      <div className="inspector-enemy-heading">
        <strong>{enemy.name}</strong>
        <span>护甲 {enemy.armor}{enemy.elusiveArmor ? ` / ${enemy.elusiveArmor}` : ""} · 攻击 {enemy.attack}{attackCount > 1 ? ` × ${attackCount}` : ""} · 名望 +{enemy.fame}</span>
      </div>
      <p>{enemy.description}</p>
      <div className="inspector-trait-tags">{traits.length ? traits.map((trait) => <em key={trait}>{trait}</em>) : <em>无特殊特性</em>}</div>
      {details.length > 0 && <details className="inspector-trait-details"><summary>查看特性如何结算</summary>{details.map((detail) => <p key={detail}>{detail}</p>)}</details>}
    </article>
  );
}

const RESOURCE_ICONS: Record<ResourceKey, string> = {
  move: "↟",
  attack: "⚔",
  fireAttack: "🔥⚔",
  iceAttack: "❄⚔",
  coldfireAttack: "◈⚔",
  block: "⬟",
  fireBlock: "🔥⬟",
  iceBlock: "❄⬟",
  coldfireBlock: "◈⬟",
  range: "➶",
  fireRange: "🔥➶",
  iceRange: "❄➶",
  coldfireRange: "◈➶",
  siege: "✹",
  fireSiege: "🔥✹",
  iceSiege: "❄✹",
  coldfireSiege: "◈✹",
  influence: "✦",
  heal: "+",
  draw: "▤",
  crystal: "◆",
};

function SetupScreen({ saved, onStart, onContinue, onWiki }: { saved: boolean; onStart: (hero: string, difficulty: GameState["difficulty"], mapVariant: MapVariant, mapShape: MapShape, seed: number, contentMode: ContentMode) => void; onContinue: () => void; onWiki: () => void }) {
  const [hero, setHero] = useState("tovak");
  const [contentMode, setContentMode] = useState<ContentMode>("ultimate");
  const [difficulty, setDifficulty] = useState<GameState["difficulty"]>("standard");
  const [mapVariant, setMapVariant] = useState<MapVariant>("random");
  const [mapShape, setMapShape] = useState<MapShape>("wedge");
  const [previewSeed, setPreviewSeed] = useState(271_828_182);
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewSeed(Math.floor(Math.random() * 1_000_000_000)), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const availableHeroes = getHeroesForMode(contentMode);
  const chooseContentMode = (mode: ContentMode) => {
    setContentMode(mode);
    if (mode === "base" && !getHeroesForMode("base").some((item) => item.id === hero)) setHero("tovak");
  };
  const previewSetup = useMemo(() => generateMapSetup(previewSeed, difficulty, mapVariant, mapShape, contentMode), [previewSeed, difficulty, mapVariant, mapShape, contentMode]);
  const previewMap = previewSetup.map;
  const previewGeometry = useMemo(() => mapGeometry(previewMap, 36, 34, 42, 46, 8), [previewMap]);
  const previewTileById = useMemo(() => Object.fromEntries(previewSetup.mapTiles.map((placement) => [placement.id, placement])), [previewSetup.mapTiles]);
  const previewDeckKinds = previewSetup.tileDeck.map((id) => getMapTileTemplate(id).kind);
  const rerollPreview = () => setPreviewSeed((seed) => {
    const rolled = Math.floor(Math.random() * 1_000_000_000);
    return rolled === seed ? (rolled + 1) % 1_000_000_000 : rolled;
  });
  return (
    <main className="setup-shell">
      <div className="setup-sky" />
      <section className="setup-panel">
        <button className="setup-wiki-button" onClick={onWiki} aria-label="打开游戏百科"><span>▤</span> 游戏百科 <kbd>W</kbd></button>
        <p className="eyebrow">非官方 · 本地单人规则原型</p>
        <h1><span>MAGE KNIGHT</span> 魔法骑士</h1>
        <p className="setup-lede">穿过传送门，在三昼三夜内探索未知国度、锻造牌组，并攻克两座城市。</p>

        <div className="setup-section">
          <div className="section-kicker"><span>01</span> 选择组件版本</div>
          <div className="segmented edition-options">
            <button className={contentMode === "base" ? "active" : ""} onClick={() => chooseContentMode("base")}>
              <strong>基础版</strong><small>4 英雄 · 20 板块 · 60 敌人</small>
            </button>
            <button className={contentMode === "ultimate" ? "active" : ""} onClick={() => chooseContentMode("ultimate")}>
              <strong>Ultimate Edition 全扩展</strong><small>7 英雄 · 26 板块 · 130 敌人 · Tezla 派系</small>
            </button>
          </div>
          <p className="edition-note">{contentMode === "ultimate" ? "已启用 The Lost Legion、Krang、Shades of Tezla 与 5 张双属性牌；这些组件会进入实际抽取池。" : "扩展英雄、地点、牌、盟军与敌人全部排除，只使用基础游戏组件。"}</p>
        </div>

        <div className="setup-section">
          <div className="section-kicker"><span>02</span> 选择骑士</div>
          <div className="hero-grid">
            {availableHeroes.map((item) => (
              <button key={item.id} className={`hero-option mana-${item.color} ${hero === item.id ? "selected" : ""}`} onClick={() => setHero(item.id)}>
                <span className="hero-option-art hero-sprite" style={heroArtStyle(item.id)} aria-hidden="true"><i>{MANA_LABELS[item.color].slice(0, 1)}</i><b>✦ ✦ ✦ ✦ ✦</b></span>
                <span className="hero-option-copy"><small>传奇英雄 · {MANA_LABELS[item.color]}属性</small><strong>{item.name}</strong><em>{item.title}</em></span>
                <em>{item.description}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="setup-section difficulty-row">
          <div className="section-kicker"><span>03</span> 城市强度</div>
          <div className="segmented">
            {([
              ["apprentice", "学徒", "较低守军"],
              ["standard", "标准", "推荐"],
              ["legendary", "传奇", "残酷挑战"],
            ] as const).map(([id, label, note]) => (
              <button key={id} className={difficulty === id ? "active" : ""} onClick={() => setDifficulty(id)}>
                <strong>{label}</strong><small>{note}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="setup-section difficulty-row map-variant-row">
          <div className="section-kicker"><span>04</span> 地图生成</div>
          <div className="segmented map-variant-options">
            <button className={mapVariant === "random" ? "active" : ""} onClick={() => setMapVariant("random")}>
              <strong>规则随机</strong><small>随机抽板块，板块内容固定</small>
            </button>
            <button className={mapVariant === "classic" ? "active" : ""} onClick={() => setMapVariant("classic")}>
              <strong>教学序列</strong><small>固定抽取顺序，便于复盘</small>
            </button>
          </div>
        </div>

        <div className="setup-section map-preview-section">
          <div className="section-kicker"><span>05</span> 选择轮廓并预览</div>
          <div className="map-preview-builder">
            <div className="shape-options">
              {(Object.keys(MAP_SHAPE_META) as MapShape[]).map((shape) => <button key={shape} className={mapShape === shape ? "active" : ""} onClick={() => setMapShape(shape)}>
                <i className={`shape-icon shape-${shape}`} aria-hidden="true" /><span><strong>{MAP_SHAPE_META[shape].name}</strong><small>{MAP_SHAPE_META[shape].note}</small></span>
              </button>)}
              <div className="preview-seed"><span>地图种子</span><strong>#{previewSeed.toString().padStart(9, "0")}</strong><button onClick={rerollPreview}>重抽预览</button></div>
            </div>
            <div className="setup-map-preview" aria-label={`${MAP_SHAPE_META[mapShape].name}初始板块预览`}>
              <div className="preview-map" style={{ width: previewGeometry.width, height: previewGeometry.height }}>
                {previewSetup.mapTiles.map((placement) => {
                  const center = tileCenterCoordinates(placement.tq, placement.tr);
                  const centerPosition = previewGeometry.positions[`${center.q},${center.r}`];
                  if (!centerPosition) return null;
                  return <span key={`hull-${placement.id}`} className={`preview-tile-hull preview-tile-${placement.kind}`} style={{ left: centerPosition.left - 36, top: centerPosition.top - 34 }} aria-hidden="true" />;
                })}
                {previewMap.map((cell) => {
                  const placement = cell.tileId ? previewTileById[cell.tileId] : undefined;
                  const template = placement ? getMapTileTemplate(placement.templateId) : undefined;
                  return <span key={cell.id} className={`preview-hex terrain-${cell.terrain} preview-tile-${placement?.kind ?? "start"}`} style={previewGeometry.positions[cell.id]} title={`${template?.name ?? "地图板块"} · ${TERRAIN_LABELS[cell.terrain]} · ${SITE_LABELS[cell.site]}`}>
                    <i>{TERRAIN_GLYPHS[cell.terrain]}</i>{cell.site !== "none" && <b>{SITE_ICONS[cell.site]}</b>}{cell.tileLocal === "c" && <em>{template?.number}</em>}
                  </span>;
                })}
              </div>
              <div className="preview-deck"><span><i className="tile-back countryside" />乡野牌库 {previewDeckKinds.filter((kind) => kind === "countryside").length}</span><span><i className="tile-back core" />核心牌库 {previewDeckKinds.filter((kind) => kind.startsWith("core")).length}</span></div>
              <div className="preview-terrain-key">{(["plains", "forest", "desert", "hills", "swamp", "wasteland", "lake", "mountain", "city"] as Terrain[]).map((terrain) => <span key={terrain}><i className={`terrain-${terrain}`} />{TERRAIN_LABELS[terrain]}</span>)}</div>
              <p className="preview-note">这里只公开起始板块和开局翻出的乡野板块；剩余板块按实体版规则保持背面，探索时才翻开。</p>
            </div>
          </div>
        </div>

        <div className="setup-actions">
          <button className="primary-button large" onClick={() => onStart(hero, difficulty, mapVariant, mapShape, previewSeed, contentMode)}>使用此{contentMode === "ultimate" ? "全扩展" : "基础版"}板块牌库开始 <span>→</span></button>
          {saved && <button className="ghost-button" onClick={onContinue}>继续上次远征</button>}
        </div>
        <p className="legal-note">本项目仅作个人规则学习与程序原型，不含原版卡图、插画或完整卡文。《Mage Knight》相关商标与原作归其权利人所有。</p>
      </section>
    </main>
  );
}

function TopBar({ state, soundEnabled, onToggleSound, onHelp, onWiki, onReset }: { state: GameState; soundEnabled: boolean; onToggleSound: () => void; onHelp: () => void; onWiki: () => void; onReset: () => void }) {
  const hero = ALL_HEROES.find((item) => item.id === state.heroId) ?? ALL_HEROES[0];
  const fameGap = fameToNextLevel(state.fame);
  const reputationModifier = reputationInfluenceModifier(state);
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <span className="brand-rune">MK</span>
        <div><strong>魔法骑士</strong><small>{state.contentMode === "ultimate" ? "Ultimate 全扩展" : "基础版"} · 单人征服</small></div>
      </div>
      <div className="round-clock">
        <span className={state.time}>{state.time === "day" ? "☀" : "☾"}</span>
        <div><strong>第 {state.round} 轮</strong><small>{state.time === "day" ? "白昼" : "夜晚"} · 共 6 轮</small></div>
        <div className="round-pips">{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < state.round ? `filled ${i % 2 ? "night" : "day"}` : ""} />)}</div>
      </div>
      <div className="hero-summary">
        <span className="mini-sigil hero-sprite" style={heroArtStyle(hero.id)} aria-hidden="true" />
        <div><strong>{hero.name}</strong><small>等级 {levelFor(state.fame)} · 护甲 {heroArmor(state)}</small></div>
      </div>
      <div className="top-stats">
        <div title={fameGap ? `距离等级 ${levelFor(state.fame) + 1} 还需 ${fameGap} 名望` : "已达到最高等级"}><small>名望</small><strong>{state.fame}</strong><em>{fameGap ? `升级还差 ${fameGap}` : "最高等级"}</em></div>
        <div title={`声誉轨位 ${effectiveReputation(state)}；${reputationModifier === null ? "居民拒绝互动" : `互动时影响力 ${reputationModifier >= 0 ? "+" : ""}${reputationModifier}`}`}><small>声誉轨位</small><strong className={effectiveReputation(state) < 0 ? "bad" : ""}>{effectiveReputation(state) > 0 ? "+" : ""}{effectiveReputation(state)}</strong><em className={reputationModifier !== null && reputationModifier < 0 ? "bad" : ""}>{reputationModifier === null ? "影响力：禁止" : `影响力 ${reputationModifier >= 0 ? "+" : ""}${reputationModifier}`}</em></div>
        <div><small>伤势</small><strong className={woundCount(state) ? "bad" : ""}>{woundCount(state)}</strong><em>牌组负担</em></div>
      </div>
      <div className="header-actions">
        <button className={`sound-toggle ${soundEnabled ? "enabled" : "muted"}`} onClick={onToggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? "关闭环境音与音效" : "开启环境音与音效"} title={soundEnabled ? "环境音与音效：开启" : "环境音与音效：静音"}>{soundEnabled ? "♫" : "♩"}</button>
        <button onClick={onWiki} aria-label="打开游戏百科" title="游戏百科（W）">书</button>
        <button onClick={onHelp} aria-label="查看快速规则" title="快速规则">?</button>
        <button onClick={onReset} aria-label="重新开始" title="重新开始">↻</button>
      </div>
    </header>
  );
}

function ManaSource({ state }: { state: GameState }) {
  return (
    <section className="panel source-panel">
      <div className="panel-title"><span>魔力源泉</span><small>通常每回合至多使用 1 颗</small></div>
      <div className="mana-row">
        {state.source.map((die, index) => (
          <div key={`${die.color}-${index}`} className={`mana-die mana-${die.color} ${usedSource(state, index) ? "used" : ""}`} title={`${MANA_LABELS[die.color]}色魔力`}>{usedSource(state, index) ? "×" : "◆"}</div>
        ))}
      </div>
      <div className="crystal-inventory">
        {BASIC_MANA.map((color) => <div key={color} title={`${MANA_LABELS[color]}色水晶 / 本回合临时魔力`}><i className={`crystal mana-${color}`} /> <span>{state.crystals[color]}<small>{(state.manaTokens?.[color] ?? 0) > 0 ? ` +${state.manaTokens[color]} 临` : ""}</small></span></div>)}
        {(state.manaTokens?.black ?? 0) > 0 && <div title="本回合黑色临时魔力"><i className="crystal mana-black" /><span>0<small>{` +${state.manaTokens.black} 临`}</small></span></div>}
      </div>
      <p className="panel-hint">金色在白昼可替代任意基础色；黑色只在夜晚强化法术。</p>
    </section>
  );
}

function DummyTimer({ state }: { state: GameState }) {
  const tactic = TACTICS.find((item) => item.id === state.dummyTactic);
  const playerTactic = TACTICS.find((item) => item.id === state.selectedTactic);
  const max = 16 + state.round - 1;
  const progress = Math.max(0, (state.dummyDeck / max) * 100);
  return (
    <section className={`panel dummy-panel ${state.finalTurn ? "warning" : ""}`}>
      <div className="panel-title"><span>虚拟玩家</span><small>{tactic ? `战术 ${tactic.order}` : "等待选战术"}</small></div>
      <div className="dummy-number"><strong>{state.dummyDeck}</strong><span>张剩余</span></div>
      <div className="timer-track"><i style={{ width: `${progress}%` }} /></div>
      {playerTactic && <div className="tactic-recap"><span>你的战术</span><strong>{playerTactic.order} · {playerTactic.name}</strong></div>}
      <p>{state.finalTurn ? "回合终局已宣告：这是你的最后一回合。" : "你结束回合后，它会翻开 3 张牌，并可能因末张颜色额外加速。"}</p>
    </section>
  );
}

function UnitPanel({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  return (
    <section className="panel unit-panel">
      <div className="panel-title"><span>盟军</span><small>{state.units.length} / {commandLimit(state)} 指挥位</small></div>
      {!state.units.length ? <p className="empty-copy">在村庄、修道院或已征服要塞招募盟军。</p> : (
        <div className="owned-units">
          {state.units.map((unit) => {
            const def = getUnit(unit.id)!;
            const canHeal = unit.wounded && state.phase === "planning" && availableResources(state).heal >= def.level;
            const bannerName = unit.banner ? getCard(unit.banner.cardId)?.name : undefined;
            const bannerUsable = unit.banner?.faceUp && ((unit.banner.cardId === "bannerCourage" && state.phase === "planning" && unit.used) || (unit.banner.cardId === "bannerFear" && state.phase === "combat" && state.combat?.step === "block" && !unit.used));
            const bannerArmor = unit.banner?.cardId === "bannerGlory" || unit.banner?.cardId === "bannerProtection" || state.allUnitsGloryThisTurn ? 1 : 0;
            return <div key={unit.id} className={`owned-unit-entry ${unit.used ? "used" : ""} ${unit.wounded ? "wounded" : ""}`}>
              <i className="owned-unit-art unit-sprite" style={unitArtStyle(def.id)} aria-hidden="true" />
              <div className="unit-activate">
                <span><strong>{def.name}</strong><small>等级 {def.level} · 护甲 {def.armor + bannerArmor}{def.resistances?.length ? ` · ${def.resistances.map((item) => item === "physical" ? "物抗" : item === "fire" ? "火抗" : "冰抗").join("/")}` : ""}</small></span>
                {unit.banner && <em className={`unit-banner ${unit.banner.faceUp ? "ready" : "used"}`}>⚑ {bannerName ?? "旗帜"} · {unit.banner.faceUp ? "正面" : "本轮已用"}{unit.banner.command ? " · 代替指挥标记" : ""}</em>}
                {def.id === "magicFamiliars" && <em className="unit-familiar-crystal">◆ {unit.needsFamiliarCrystal ? "等待替换水晶" : `${unit.familiarCrystal ? MANA_LABELS[unit.familiarCrystal] : "无"}色水晶`}</em>}
                <em>{unit.wounded ? `受伤 ${unit.wounds ?? 1}：不可启用或再次承伤` : unit.used ? `本轮已用：${def.abilities?.find((item) => item.id === unit.selectedAbilityId)?.label ?? def.text}` : "选择一项能力发动（每轮一次）"}</em>
                {(!unit.used || def.multiAbility) && !unit.wounded && !unit.needsFamiliarCrystal && <div className="unit-abilities">{(def.abilities ?? [{ id: "legacy", label: def.text, effect: def.effect }]).map((ability) => {
                  if (ability.gainManaChoiceCount === 2) {
                    const pairs = BASIC_MANA.flatMap((first, index) => BASIC_MANA.slice(index).map((second) => [first, second] as const));
                    return <details key={ability.id}><summary>{ability.label}</summary><div>{pairs.map(([first, second]) => <button key={`${first}-${second}`} disabled={!canActivateUnitAbility(state, unit.id, ability.id, [first, second])} onClick={() => dispatch({ type: "ACTIVATE_UNIT", unitId: unit.id, abilityId: ability.id, manaColors: [first, second] })}>{MANA_LABELS[first]} + {MANA_LABELS[second]}</button>)}</div></details>;
                  }
                  if (ability.manaChoiceCount === 1) return <details key={ability.id}><summary>{ability.label}</summary><div>{(ability.manaChoiceColors ?? []).map((color) => <button key={color} disabled={!canActivateUnitAbility(state, unit.id, ability.id, [color])} onClick={() => dispatch({ type: "ACTIVATE_UNIT", unitId: unit.id, abilityId: ability.id, manaColors: [color] })}>支付{MANA_LABELS[color]}</button>)}</div></details>;
                  if (ability.delphanaEffect && state.combat) {
                    const targets = [state.combat.enemy, ...(state.combat.queue ?? []).map((entry) => entry.enemy), ...(state.combat.rangedSurvivors ?? []).map((entry) => entry.enemy)];
                    return <details key={ability.id}><summary>{ability.label}</summary><div>{targets.map((enemy) => <button key={enemy.id} disabled={!canActivateUnitAbility(state, unit.id, ability.id, [], enemy.id)} onClick={() => dispatch({ type: "ACTIVATE_UNIT", unitId: unit.id, abilityId: ability.id, enemyId: enemy.id })}>{enemy.name}</button>)}</div></details>;
                  }
                  return <button key={ability.id} disabled={!canActivateUnitAbility(state, unit.id, ability.id, [], state.combat?.enemy.id)} onClick={() => dispatch({ type: "ACTIVATE_UNIT", unitId: unit.id, abilityId: ability.id, enemyId: state.combat?.enemy.id })}>{ability.label}</button>;
                })}</div>}
                {unit.needsFamiliarCrystal && state.phase === "tactic" && <div className="unit-abilities familiar-upkeep">{BASIC_MANA.map((color) => <button key={color} className={`mana-${color}`} disabled={state.crystals[color] <= 0} onClick={() => dispatch({ type: "REPLACE_FAMILIAR_CRYSTAL", unitId: unit.id, color })}>放置{MANA_LABELS[color]}水晶</button>)}<button onClick={() => dispatch({ type: "DISMISS_UNIT", unitId: unit.id })}>不替换并移出队伍</button></div>}
                {bannerUsable && <button className="unit-banner-action" onClick={() => dispatch({ type: "USE_BANNER", unitId: unit.id, enemyId: state.combat?.enemy.id })}>{unit.banner?.cardId === "bannerFear" ? "挥动恐惧旗帜取消一次攻击" : "翻面勇气旗帜并重整"}</button>}
              </div>
              {unit.wounded && <button className="unit-heal" disabled={!canHeal} onClick={() => dispatch({ type: "HEAL_UNIT", unitId: unit.id })}>治疗 {def.level}{(unit.wounds ?? 1) > 1 ? `（剩 ${unit.wounds}）` : ""}</button>}
            </div>;
          })}
        </div>
      )}
    </section>
  );
}

function HeroSkillPanel({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const skills = (state.skills ?? []).map(getSkill).filter(Boolean);
  const allSkills = getHeroSkillsForMode(state.contentMode ?? "base", state.heroId);
  const nextLevel = Math.ceil((levelFor(state.fame) + 1) / 2) * 2;
  const enemies = state.combat ? [state.combat.enemy, ...(state.combat.queue ?? []).map((entry) => entry.enemy), ...(state.combat.rangedSurvivors ?? []).map((entry) => entry.enemy)] : [];
  const skillActions = (skill: NonNullable<ReturnType<typeof getSkill>>) => {
    if (!skill.special || skill.special === "day-sharpshooting") return null;
    const usedTurn = state.skillUsesThisTurn?.includes(skill.id);
    const usedRound = state.skillUsesThisRound?.includes(skill.id);
    if (skill.special === "inspiration") return <div className="skill-actions">{state.units.flatMap((unit) => {
      const name = getUnit(unit.id)?.name ?? unit.id;
      return [unit.used && <button key={`${unit.id}-ready`} disabled={usedRound || state.phase === "combat"} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, option: "ready", unitId: unit.id })}>重整{name}</button>, unit.wounded && <button key={`${unit.id}-heal`} disabled={usedRound || state.phase === "combat"} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, option: "heal", unitId: unit.id })}>治疗{name}</button>].filter(Boolean);
    })}</div>;
    if (skill.special === "on-her-own") return <div className="skill-actions"><button disabled={usedTurn} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id })}>影响力 1</button><button disabled={usedTurn || Boolean(state.recruitedUnitIdsThisTurn?.length)} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, option: "strong" })}>不招募：影响力 3</button></div>;
    if (skill.special === "battle-frenzy") return <div className="skill-actions"><button disabled={usedTurn} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id })}>攻击 2</button><button disabled={usedTurn || state.flippedSkills?.includes(skill.id)} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, option: "strong" })}>翻面：攻击 4</button></div>;
    if (skill.special === "shamanic-ritual") return <div className="skill-actions">{(["red", "blue", "green", "white", "black", "gold"] as const).map((color) => <button key={color} disabled={state.flippedSkills?.includes(skill.id)} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, color })}>{MANA_LABELS[color]}魔力</button>)}<button disabled={!state.flippedSkills?.includes(skill.id)} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, option: "refresh" })}>作为行动翻回</button></div>;
    if (skill.special === "arcane-disguise") return <div className="skill-actions"><button disabled={usedTurn} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id })}>影响力 2</button><button disabled={usedTurn || state.flippedSkills?.includes(skill.id)} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, option: "disguise" })}>翻面：忽略声誉</button><button disabled={usedTurn || !state.flippedSkills?.includes(skill.id)} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, option: "refresh" })}>绿魔翻回</button></div>;
    if (skill.special === "master-chaos") return <div className="skill-actions">{["attack", "block", "move", "range", "influence"].map((option) => <button key={option} disabled={usedTurn} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, option })}>推进{option === "attack" ? "·金选攻击" : option === "block" ? "·金选格挡" : option === "move" ? "·金选移动" : option === "range" ? "·金选远程" : "·金选影响力"}</button>)}</div>;
    if (skill.special === "mana-overload") return <div className="skill-actions">{(["red", "blue", "green", "white", "black"] as const).map((color) => <button key={color} disabled={usedRound} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, color })}>{MANA_LABELS[color]}过载</button>)}</div>;
    if (skill.special === "ritual-of-pain") {
      const wounds = state.hand.filter((id) => id.startsWith("wound#"));
      return <div className="skill-actions"><button disabled={usedRound || state.phase === "combat"} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, cardInstanceIds: [] })}>开启横置</button>{wounds.map((wound, index) => <button key={wound} disabled={usedRound || state.phase === "combat"} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, cardInstanceIds: wounds.slice(index, index + 2) })}>移除 {Math.min(2, wounds.length - index)} 张伤势</button>)}</div>;
    }
    if (skill.special === "calming-weather") return <div className="skill-actions"><button disabled={usedRound} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id })}>本回合地形 -2</button></div>;
    if (skill.special === "source-opening") return <div className="skill-actions">{state.source.map((die, index) => <button key={index} disabled={usedRound} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, sourceDieIndex: index })}>重掷第 {index + 1} 颗（{MANA_LABELS[die.color]}）</button>)}</div>;
    if (skill.special === "howl-of-pack") return <div className="skill-actions"><button disabled={usedRound} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id })}>强化下一张横置牌</button>{state.howlCombatReady && enemies.map((enemy) => <button key={enemy.id} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, option: "combat", enemyId: enemy.id })}>削弱{enemy.name}</button>)}</div>;
    if (skill.special === "mana-enhancement") return <div className="skill-actions">{BASIC_MANA.map((color) => <button key={color} disabled={usedRound} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, color })}>强化已支付的{MANA_LABELS[color]}</button>)}</div>;
    if (skill.special === "nature-vengeance-coop") return <div className="skill-actions">{enemies.map((enemy) => <button key={enemy.id} disabled={usedRound} onClick={() => dispatch({ type: "ACTIVATE_SKILL", skillId: skill.id, enemyId: enemy.id })}>削弱{enemy.name}</button>)}</div>;
    return null;
  };
  return (
    <section className="panel skill-panel">
      <div className="panel-title"><span>英雄技能</span><small>{skills.length} 已掌握 · 专属池 10</small></div>
      {skills.length ? <div className="skill-list">{skills.map((skill) => skill && <div key={skill.id}>
        <i>✦</i><span><strong>{skill.name}</strong><small>{skill.description}</small>{skillActions(skill)}</span>
      </div>)}</div> : <p className="empty-copy">尚未掌握技能。达到等级 2 后会首次选择英雄专属技能。</p>}
      {skills.length < 5 && <p className="skill-next">下一次选择：等级 {nextLevel}</p>}
      <details className="skill-catalog"><summary>查看公开技能池</summary><div>{allSkills.map((skill) => <span key={skill.id} className={(state.skills ?? []).includes(skill.id) ? "owned" : "locked"}><strong>{skill.name}</strong><small>{skill.description}</small></span>)}</div></details>
    </section>
  );
}

type PendingMapAction =
  | { kind: "cell"; cellId: string }
  | { kind: "explore"; tq: number; tr: number; tileKind: MapTileKind };

export function MapBoard({ state, dispatch, mapFocus, onToggleMapFocus, onInspectCell, onOpenWiki }: { state: GameState; dispatch: Dispatch<GameAction>; mapFocus: boolean; onToggleMapFocus: () => void; onInspectCell: (cellId: string) => void; onOpenWiki: () => void }) {
  const current = state.map.find((cell) => cell.id === state.position)!;
  const explorations = availableTileExplorations(state);
  const explorationGeometryCells = explorations.flatMap(({ tq, tr }) => ghostTileCells(tq, tr));
  const geometry = mapGeometry([...state.map, ...explorationGeometryCells], 83, 78, 94, 104, 112);
  const placements = useMemo(() => Object.fromEntries(state.mapTiles.map((tile) => [tile.id, tile])), [state.mapTiles]);
  const nextTile = state.tileDeck[0] ? getMapTileTemplate(state.tileDeck[0]) : undefined;
  const [inspectedCellId, setInspectedCellId] = useState(state.position);
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingMapAction | null>(null);
  const [mapSelection, setMapSelection] = useState<{ target: BoardTarget; context: string } | null>(null);
  const selectionContext = mapSelectionContext(state);
  const activeSelection = mapSelection?.context === selectionContext ? mapSelection.target : null;
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const [mapView, setMapView] = useState<"3d" | "2d">("3d");
  const [threeZoom, setThreeZoom] = useState(100);
  const [threeQuality, setThreeQuality] = useState<ThreeQuality>("sharp");
  const [modelStyle, setModelStyle] = useState<ModelStyle>("realistic");
  const [threeError, setThreeError] = useState("");
  const [modelGalleryOpen, setModelGalleryOpen] = useState(false);
  const threeControls = useRef<Board3DHandle | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const mapPerspectiveRef = useRef<HTMLDivElement | null>(null);
  const mapContentRef = useRef<HTMLDivElement | null>(null);
  const mapZoomValue = useRef(DEFAULT_MAP_ZOOM);
  const mapPanValue = useRef({ x: 0, y: 0 });
  const wheelZoomDelta = useRef(0);
  const wheelZoomAnchor = useRef({ x: 0, y: 0 });
  const wheelZoomFrame = useRef<number | null>(null);
  const didInitialMapCenter = useRef(false);
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressMapClick = useRef(false);
  const lastMapPointerType = useRef<"mouse" | "touch" | "pen">("mouse");
  const inspectorHideTimer = useRef<number | null>(null);
  const inspected = state.map.find((cell) => cell.id === inspectedCellId) ?? current;
  const inspectedEnemies = enemiesOnCell(inspected);
  const inspectedRuin = inspected.ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[inspected.ruinTokenId] : undefined;
  const inspectedHelp = SITE_HELP[inspected.site];
  const canChallengeInspected = state.phase === "planning" && !state.actionTaken && isRampagingEnemyCell(inspected) && isAdjacent(current, inspected);
  const currentRuin = current.ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[current.ruinTokenId] : undefined;
  const currentAltarColor = current.site === "ruins" ? (current.ruinAltarColor ?? currentRuin?.altarColor) : undefined;
  const currentRuinEncounter = current.site === "ruins" && currentRuin && !currentAltarColor && currentRuin.enemies.length > 0 ? currentRuin : undefined;
  const currentAltarMana = currentAltarColor ? availableManaCount(state, currentAltarColor) : 0;
  const canInvokeCurrentAltar = Boolean(currentAltarColor && state.phase === "planning" && !state.actionTaken && currentAltarMana >= 3);
  const canEnterCurrentRuin = Boolean(currentRuinEncounter && state.phase === "planning" && !state.actionTaken);
  const currentAltarStatus = state.phase !== "planning" ? "当前阶段不可祭拜"
    : state.actionTaken ? "本回合行动已经使用"
      : currentAltarMana >= 3 ? "支付 3 份魔力 · 名望 +7"
        : `可支付 ${currentAltarMana}/3 份同色魔力`;
  const currentRuinStatus = state.phase !== "planning" ? "当前阶段不能进入"
    : state.actionTaken ? "本回合行动已经使用"
      : `抽取 ${currentRuinEncounter?.enemies.length ?? 0} 枚敌人标记 · 进入后锁定回退`;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setThreeQuality(readThreeQuality());
      setModelStyle(readModelStyle());
      if (localStorage.getItem("mage-knight-map-view") === "2d") setMapView("2d");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const chooseThreeQuality = (value: ThreeQuality) => {
    setThreeQuality(value); saveThreeQuality(value); threeControls.current?.quality(value);
  };
  const chooseModelStyle = (value: ModelStyle) => { setModelStyle(value); saveModelStyle(value); threeControls.current?.style(value); };
  const chooseMapView = () => {
    const next = mapView === "3d" ? "2d" : "3d";
    setMapView(next); setThreeError(""); localStorage.setItem("mage-knight-map-view", next);
  };
  const cancelInspectorHide = () => {
    if (inspectorHideTimer.current === null) return;
    window.clearTimeout(inspectorHideTimer.current);
    inspectorHideTimer.current = null;
  };
  const showInspector = (cellId: string) => {
    cancelInspectorHide();
    setInspectedCellId(cellId);
    onInspectCell(cellId);
    setInspectorVisible(true);
  };
  const clearMapSelection = () => { setMapSelection(null); setPendingAction(null); };
  const selectMapTarget = (target: BoardTarget) => {
    setMapSelection({ target, context: selectionContext }); setPendingAction(null);
    if (target.kind === "explore") {
      const exploration = explorations.find((candidate) => candidate.tq === target.tq && candidate.tr === target.tr);
      if (exploration && state.phase === "planning" && !state.actionTaken) setPendingAction({ kind: "explore", tq: target.tq, tr: target.tr, tileKind: exploration.kind });
      return;
    }
    const cell = state.map.find((candidate)=>candidate.id === target.cellId); if (!cell) return;
    showInspector(cell.id);
    if (isAdjacent(current, cell) && Number.isFinite(TERRAIN_COSTS[cell.terrain][state.time]) && state.phase === "planning" && !state.actionTaken) setPendingAction({ kind: "cell", cellId: cell.id });
  };
  const scheduleInspectorHide = () => {
    cancelInspectorHide();
    inspectorHideTimer.current = window.setTimeout(() => {
      setInspectorVisible(false);
      inspectorHideTimer.current = null;
    }, 160);
  };
  useEffect(() => () => {
    if (inspectorHideTimer.current !== null) window.clearTimeout(inspectorHideTimer.current);
    if (wheelZoomFrame.current !== null) window.cancelAnimationFrame(wheelZoomFrame.current);
  }, []);
  const commitMapPan = useCallback((nextPan: { x: number; y: number }) => {
    mapPanValue.current = nextPan;
    setMapPan(nextPan);
  }, []);
  const centerMapOnHero = useCallback(() => {
    const viewportRect = mapViewportRef.current?.getBoundingClientRect();
    const heroCellRect = mapContentRef.current?.querySelector<HTMLElement>(".hex-cell.current")?.getBoundingClientRect();
    if (!viewportRect || !heroCellRect) return;
    const pan = mapPanValue.current;
    commitMapPan({
      x: clampMapPan(pan.x + viewportRect.left + viewportRect.width / 2 - (heroCellRect.left + heroCellRect.width / 2), 560),
      y: clampMapPan(pan.y + viewportRect.top + viewportRect.height / 2 - (heroCellRect.top + heroCellRect.height / 2), 760),
    });
  }, [commitMapPan]);
  useEffect(() => {
    if (didInitialMapCenter.current) return;
    didInitialMapCenter.current = true;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(centerMapOnHero);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [centerMapOnHero]);
  const zoomMap = useCallback((requestedZoom: number, clientX?: number, clientY?: number) => {
    const currentZoom = mapZoomValue.current;
    const nextZoom = Math.round(Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, requestedZoom)) * 1000) / 1000;
    if (nextZoom === currentZoom) return;
    const viewportRect = mapViewportRef.current?.getBoundingClientRect();
    const content = mapContentRef.current;
    const anchorX = clientX ?? (viewportRect ? viewportRect.left + viewportRect.width / 2 : 0);
    const anchorY = clientY ?? (viewportRect ? viewportRect.top + viewportRect.height / 2 : 0);
    const pan = mapPanValue.current;
    const originX = viewportRect && content ? viewportRect.left + content.offsetLeft + content.offsetWidth / 2 + pan.x : anchorX;
    const originY = viewportRect && content ? viewportRect.top + content.offsetTop + pan.y : anchorY;
    const ratio = nextZoom / currentZoom;
    commitMapPan({
      x: clampMapPan(pan.x + (1 - ratio) * (anchorX - originX), 560),
      y: clampMapPan(pan.y + (1 - ratio) * (anchorY - originY), 760),
    });
    mapZoomValue.current = nextZoom;
    setMapZoom(nextZoom);
  }, [commitMapPan]);
  const resetMap = () => {
    if (wheelZoomFrame.current !== null) window.cancelAnimationFrame(wheelZoomFrame.current);
    wheelZoomFrame.current = null;
    wheelZoomDelta.current = 0;
    mapZoomValue.current = DEFAULT_MAP_ZOOM;
    setMapZoom(DEFAULT_MAP_ZOOM);
    commitMapPan({ x: 0, y: 0 });
    window.requestAnimationFrame(() => window.requestAnimationFrame(centerMapOnHero));
  };
  const zoomWithWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    if ((event.target as HTMLElement).closest(".three-map")) return;
    if (event.deltaY === 0) return;
    const deltaScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (mapViewportRef.current?.clientHeight ?? 1) : 1;
    wheelZoomDelta.current += event.deltaY * deltaScale;
    wheelZoomAnchor.current = { x: event.clientX, y: event.clientY };
    if (wheelZoomFrame.current !== null) return;
    wheelZoomFrame.current = window.requestAnimationFrame(() => {
      const delta = Math.max(-160, Math.min(160, wheelZoomDelta.current));
      const anchor = wheelZoomAnchor.current;
      wheelZoomDelta.current = 0;
      wheelZoomFrame.current = null;
      zoomMap(mapZoomValue.current * Math.exp(-delta * 0.0018), anchor.x, anchor.y);
    });
  }, [zoomMap]);
  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;
    viewport.addEventListener("wheel", zoomWithWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", zoomWithWheel);
  }, [zoomWithWheel]);
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragState.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: mapPanValue.current.x, originY: mapPanValue.current.y, moved: false };
  };
  const dragMap = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const horizontal = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const vertical = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    mapPerspectiveRef.current?.style.setProperty("--board-tilt-x", `${horizontal * 1.4}deg`);
    mapPerspectiveRef.current?.style.setProperty("--board-tilt-y", `${vertical * -1.1}deg`);
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 4) {
      drag.moved = true;
      suppressMapClick.current = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (drag.moved) commitMapPan({ x: clampMapPan(drag.originX + dx, 560), y: clampMapPan(drag.originY + dy, 760) });
  };
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragState.current = null;
    setIsDragging(false);
    if (drag.moved) window.requestAnimationFrame(() => { suppressMapClick.current = false; });
  };
  const resetMapPerspective = () => {
    mapPerspectiveRef.current?.style.setProperty("--board-tilt-x", "0deg");
    mapPerspectiveRef.current?.style.setProperty("--board-tilt-y", "0deg");
  };
  const panWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (mapView === "3d") {
      const board = threeControls.current;
      if (["Home", "0", "+", "=", "-", "r", "t", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
      if (event.key === "Home" || event.key === "0") board?.reset();
      if (event.key === "+" || event.key === "=") board?.zoom(.88);
      if (event.key === "-") board?.zoom(1.14);
      if (event.key === "r") board?.rotate(Math.PI / 6);
      if (event.key === "t") board?.tilt();
      if (event.key === "ArrowLeft") board?.pan(-.8, 0);
      if (event.key === "ArrowRight") board?.pan(.8, 0);
      if (event.key === "ArrowUp") board?.pan(0, -.8);
      if (event.key === "ArrowDown") board?.pan(0, .8);
      return;
    }
    const steps: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: 45, y: 0 }, ArrowRight: { x: -45, y: 0 }, ArrowUp: { x: 0, y: 45 }, ArrowDown: { x: 0, y: -45 },
    };
    if (event.key === "Home" || event.key === "0") { event.preventDefault(); resetMap(); return; }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomMap(mapZoomValue.current + MAP_ZOOM_STEP); return; }
    if (event.key === "-") { event.preventDefault(); zoomMap(mapZoomValue.current - MAP_ZOOM_STEP); return; }
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    const pan = mapPanValue.current;
    commitMapPan({ x: clampMapPan(pan.x + step.x, 560), y: clampMapPan(pan.y + step.y, 760) });
  };
  return (
    <section className={`map-card ${mapView === "3d" ? "map-3d-active" : ""}`} onKeyDown={(event)=>{ if (event.key === "Escape" && activeSelection) { event.preventDefault(); event.stopPropagation(); clearMapSelection(); } }}>
      <div className="map-heading">
        <div><p className="eyebrow">未知国度</p><h2>征服地图</h2></div>
        <div className="map-tools">
          <div className="map-legend"><span><i className="legend-you" />你的位置</span><span><i className="legend-fog" />可探索板块</span><span><i className="legend-enemy" />敌军</span></div>
          <span className="map-deck-status">已拼 {state.mapTiles.length}/12 · 牌库 {state.tileDeck.length}{nextTile ? ` · 顶牌：${tileKindLabel(nextTile.kind)}` : ""}</span>
          <span className="map-seed" title={`地图种子 ${state.seed}`}>{MAP_SHAPE_META[state.mapShape ?? "wedge"].name} · {state.mapVariant === "random" ? "随机" : "经典"} #{state.seed.toString().padStart(9, "0")}</span>
          <span className="drag-help">滚轮/触控板缩放 · 按住拖动</span>
          <button className="map-view-toggle" aria-pressed={mapView === "3d"} onClick={chooseMapView} title="切换立体微缩地图与平面地图">{mapView === "3d" ? "3D 微缩" : "2D 地图"}</button>
          <button className="model-gallery-button" onClick={() => setModelGalleryOpen(true)}>模型图鉴</button>
          <button className="map-focus-toggle" aria-pressed={mapFocus} disabled={Boolean(state.combat)} onClick={onToggleMapFocus} title="地图专注模式（快捷键 F）">{mapFocus ? "退出专注" : "地图专注"}</button>
          <div className="map-zoom-controls" aria-label="地图缩放">
            <button onClick={() => mapView === "3d" ? threeControls.current?.zoom(1.14) : zoomMap(mapZoomValue.current - MAP_ZOOM_STEP)} disabled={mapView === "2d" && mapZoom <= MIN_MAP_ZOOM} aria-label="缩小地图">−</button>
            <output aria-live="polite">{mapView === "3d" ? threeZoom : Math.round(mapZoom * 100)}%</output>
            <button onClick={() => mapView === "3d" ? threeControls.current?.zoom(.88) : zoomMap(mapZoomValue.current + MAP_ZOOM_STEP)} disabled={mapView === "2d" && mapZoom >= MAX_MAP_ZOOM} aria-label="放大地图">＋</button>
          </div>
          <button onClick={() => mapView === "3d" ? threeControls.current?.reset() : resetMap()} disabled={mapView === "2d" && mapPan.x === 0 && mapPan.y === 0 && mapZoom === DEFAULT_MAP_ZOOM}>复位</button>
        </div>
      </div>
      <div
        ref={mapViewportRef}
        className={`map-scroll draggable-map ${isDragging ? "dragging" : ""}`}
        onPointerDown={startDrag}
        onPointerMove={dragMap}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerLeave={resetMapPerspective}
        onKeyDown={panWithKeyboard}
        tabIndex={0}
        role="region"
        aria-label="可拖动和缩放的征服地图。使用鼠标滚轮或触控板手势缩放；按住鼠标或触控拖动；方向键平移；加减键缩放；Home 或 0 键复位。3D 模式可按 R 旋转、T 切换俯仰，或通过键盘选格菜单选择地块。"
      >
        {mapView === "3d" && <><ThreeMap state={state} selection={activeSelection} controlsRef={threeControls} onZoom={setThreeZoom} onInspect={showInspector} onOpenWiki={(cellId) => { showInspector(cellId); onOpenWiki(); }} onFailure={(message) => { setThreeError(message); setMapView("2d"); }} onSelect={selectMapTarget} /><details className="three-cell-picker" onPointerDown={(event) => event.stopPropagation()}><summary>键盘选格</summary><div>{state.map.map((cell) => <button key={cell.id} aria-pressed={activeSelection?.kind === "cell" && activeSelection.cellId === cell.id} onFocus={() => showInspector(cell.id)} onClick={() => selectMapTarget({kind:"cell",cellId:cell.id})}>{cell.q},{cell.r} · {publicCellIntel(cell,state.difficulty).name}{publicCellIntel(cell,state.difficulty).shortMineLabel ? ` · ${publicCellIntel(cell,state.difficulty).shortMineLabel}` : ""}</button>)}{explorations.map((target) => <button key={`${target.tq},${target.tr}`} disabled={state.phase !== "planning" || state.actionTaken} onClick={() => selectMapTarget({kind:"explore",tq:target.tq,tr:target.tr})}>探索 {target.tq},{target.tr} · {tileKindLabel(target.kind)}</button>)}</div></details>
        <div className="three-camera-tools" aria-label="3D 相机和画质" onPointerDown={(event) => event.stopPropagation()}>
          <button onClick={() => threeControls.current?.rotate(-Math.PI / 6)} aria-label="向左旋转地图">↶</button>
          <button onClick={() => threeControls.current?.tilt()} title="切换俯仰角度（T）">俯仰</button>
          <button onClick={() => threeControls.current?.rotate(Math.PI / 6)} aria-label="向右旋转地图">↷</button>
          <label>画质<select aria-label="3D 画质" value={threeQuality} onChange={(event) => chooseThreeQuality(event.target.value as ThreeQuality)}>{(Object.keys(THREE_QUALITY_LABELS) as ThreeQuality[]).map((quality) => <option key={quality} value={quality}>{THREE_QUALITY_LABELS[quality]}</option>)}</select></label>
          <label>模型<select aria-label="3D 模型风格" value={modelStyle} onChange={(event) => chooseModelStyle(event.target.value as ModelStyle)}><option value="realistic">精细模型</option><option value="classic">简约</option></select></label>
        </div><span className="three-map-help">拖动平移 · 右键拖动旋转 · 双指缩放/旋转</span></>}
        <div className="map-pan-layer" hidden={mapView === "3d"} style={{ transform: `translate3d(${mapPan.x}px, ${mapPan.y}px, 0)` }}>
          <div ref={mapPerspectiveRef} className="map-perspective-layer">
          <div ref={mapContentRef} className={`hex-map map-shape-${state.mapShape ?? "wedge"}`} style={{ width: geometry.width, height: geometry.height, margin: "0 auto", transform: `scale(${mapZoom})`, transformOrigin: "top center" }}>
          <div className="route-glow" />
          {state.mapTiles.map((placement) => {
            const center = tileCenterCoordinates(placement.tq, placement.tr);
            const centerPosition = geometry.positions[`${center.q},${center.r}`];
            const template = getMapTileTemplate(placement.templateId);
            if (!centerPosition || !template) return null;
            return <div
              key={placement.id}
              className={`map-tile-hull tile-kind-${placement.kind}`}
              style={{ left: centerPosition.left - 83, top: centerPosition.top - 78 }}
              aria-hidden="true"
            ><span>{template.number}</span></div>;
          })}
          {explorations.map((target) => {
            const center = tileCenterCoordinates(target.tq, target.tr);
            const centerPosition = geometry.positions[`${center.q},${center.r}`];
            if (!centerPosition) return null;
            return <button
              key={`explore-${target.tq},${target.tr}`}
              className={`exploration-tile-target tile-kind-${target.kind} ${activeSelection && pendingAction?.kind === "explore" && pendingAction.tq === target.tq && pendingAction.tr === target.tr ? "preview-target" : ""}`}
              style={{ left: centerPosition.left - 83, top: centerPosition.top - 78 }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selectMapTarget({ kind: "explore", tq: target.tq, tr: target.tr })}
              disabled={state.phase !== "planning" || state.actionTaken}
              aria-label={`探索新的${tileKindLabel(target.kind)}，需要 2 点移动`}
              title={`花费 2 点移动，翻开牌库顶的${tileKindLabel(target.kind)}并按固定方向拼接`}
            ><span><b>{target.kind === "countryside" ? "绿色背面" : "棕色背面"}</b><strong>{tileKindLabel(target.kind)}</strong><small>探索 2 移动</small></span></button>;
          })}
          {state.map.map((cell) => {
            const adjacent = isAdjacent(current, cell);
            const cost = TERRAIN_COSTS[cell.terrain][state.time];
            const accessible = Number.isFinite(cost);
            const actionable = adjacent && accessible && state.phase === "planning" && !state.actionTaken;
            const isChallenge = adjacent && isRampagingEnemyCell(cell);
            const placement = cell.tileId ? placements[cell.tileId] : undefined;
            const actionLabel = isChallenge ? "挑战" : accessible ? `移动 ${cost}` : "不可进入";
            return (
              <button
                key={cell.id}
                className={`hex-cell terrain-${cell.terrain} tile-kind-${placement?.kind ?? "start"} ${!accessible ? "impassable" : ""} ${cell.id === state.position ? "current" : ""} ${actionable ? "actionable" : ""} ${activeSelection?.kind === "cell" && activeSelection.cellId === cell.id ? "preview-target" : ""} ${cell.conquered ? "conquered" : ""}`}
                style={geometry.positions[cell.id]}
                onPointerDown={(event) => { lastMapPointerType.current = event.pointerType as "mouse" | "touch" | "pen"; }}
                onClick={() => {
                  if (suppressMapClick.current) return;
                  selectMapTarget({kind:"cell",cellId:cell.id});
                }}
                onMouseEnter={() => showInspector(cell.id)}
                onMouseLeave={scheduleInspectorHide}
                onFocus={() => showInspector(cell.id)}
                onBlur={scheduleInspectorHide}
                onContextMenu={(event) => { event.preventDefault(); setInspectedCellId(cell.id); onInspectCell(cell.id); onOpenWiki(); }}
                aria-disabled={!actionable}
                aria-label={isChallenge ? `挑战${cell.enemy?.name ?? "游荡敌人"}；聚焦后可在信息面板查看公开信息` : `${TERRAIN_LABELS[cell.terrain]} ${SITE_LABELS[cell.site]}`}
              >
                <span className="hex-inner">
                  <>
                    <small className="terrain-name">{TERRAIN_LABELS[cell.terrain]}</small>
                    <span className="terrain-glyph" aria-hidden="true">{TERRAIN_GLYPHS[cell.terrain]}</span>
                    {hasSiteArt(cell) && <span className="map-model site-model-sprite" style={siteArtStyle(cell.site, cell.terrain)} aria-hidden="true" />}
                    {!hasSiteArt(cell) && cell.enemy && cell.tokenRevealed && <span className="map-enemy-model enemy-sprite" style={enemyArtStyle(cell.enemy)} aria-hidden="true" />}
                    {!hasSiteArt(cell) && cell.enemy && !cell.tokenRevealed && <span className="map-enemy-model enemy-token-back" aria-label="未翻开的敌人标记">?</span>}
                    {cell.site !== "none" && !hasSiteArt(cell) && !cell.enemy && <strong className="site-mark">{SITE_ICONS[cell.site]}</strong>}
                    {cell.site !== "none" && <span className="site-name">{SITE_LABELS[cell.site]}</span>}
                    {cell.enemy && !cell.conquered && <i className={`enemy-dot ${cell.tokenRevealed ? "" : "hidden"}`}>{cell.tokenRevealed ? (enemiesOnCell(cell).length > 1 ? enemiesOnCell(cell).length : "!") : "?"}</i>}
                    {cell.site === "ruins" && !cell.conquered && <RuinTokenBadge token={cell.ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId] : undefined} hidden={!cell.tokenRevealed} compact />}
                    {cell.mineColor && <i className={`mine-gem mana-${cell.mineColor}`}>◆</i>}
                    <span className={`cell-cost ${isChallenge ? "challenge" : ""} ${!accessible ? "blocked" : ""}`} title={actionLabel}>{isChallenge ? "战" : accessible ? cost : "×"}</span>
                    {cell.tileLocal === "c" && placement && <span className="tile-number-badge" title={getMapTileTemplate(placement.templateId)?.name}>{getMapTileTemplate(placement.templateId)?.number}</span>}
                  </>
                </span>
                {cell.id === state.position && <span className="hero-marker" aria-label="你的英雄当前位置">
                  <span className="hero-marker-shadow" aria-hidden="true" />
                  <span className="hero-marker-base" aria-hidden="true" />
                  <span className="hero-marker-standee hero-sprite" style={heroArtStyle(state.heroId)} aria-hidden="true" />
                </span>}
                {cell.conquered && <span className="shield-marker">✓</span>}
              </button>
            );
          })}
          </div>
          </div>
        </div>
      </div>
      {threeError && <p className="three-map-error" role="status">{threeError}</p>}
      {modelGalleryOpen && <ModelGallery heroId={state.heroId} contentMode={state.contentMode} onClose={() => setModelGalleryOpen(false)} />}
      {pendingAction && activeSelection && (() => {
        if (pendingAction.kind === "explore") return <div className="map-action-preview" role="dialog" aria-label="探索预览">
          <div><small>探索预览</small><strong>拼接新的{tileKindLabel(pendingAction.tileKind)}</strong><span>消耗 2 移动；翻开新板块会公开信息，因此确认后不能撤销到探索之前。</span></div>
          <button className="ghost-button" onClick={clearMapSelection}>取消</button>
          <button className="primary-button" onClick={() => { dispatch({ type: "EXPLORE_TILE", tq: pendingAction.tq, tr: pendingAction.tr }); clearMapSelection(); }}>确认探索</button>
        </div>;
        const target = state.map.find((cell) => cell.id === pendingAction.cellId);
        if (!target) return null;
        const challenge = isRampagingEnemyCell(target);
        const moveCost = TERRAIN_COSTS[target.terrain][state.time];
        const provoked = !challenge ? state.map.find((enemyCell) => isRampagingEnemyCell(enemyCell) && isAdjacent(current, enemyCell) && isAdjacent(target, enemyCell)) : undefined;
        const revealsToken = Boolean(!target.tokenRevealed && target.enemy)
          || state.map.some((candidate) => !candidate.tokenRevealed && candidate.enemy && isAdjacent(target, candidate));
        const reversible = !revealsToken;
        return <div className="map-action-preview" role="dialog" aria-label={challenge ? "挑战预览" : "移动预览"}>
          <div><small>{challenge ? "挑战预览" : "移动预览"}</small><strong>{challenge ? `主动挑战「${enemiesOnCell(target)[0]?.name ?? "游荡敌人"}」` : `${TERRAIN_LABELS[target.terrain]} · 移动 ${moveCost}`}</strong><span>{challenge ? "英雄留在当前格；进入正式结算前仍可撤回。" : provoked ? `移动会激怒「${enemiesOnCell(provoked)[0]?.name ?? "游荡敌人"}」并强制开战。` : revealsToken ? "移动会公开新的敌人信息；公开后会建立回退边界。" : "不会公开新信息；确认后仍可通过撤销回退。"}</span></div>
          <span className={`map-revert-hint ${reversible ? "safe" : "locked"}`}>{reversible ? "可撤销" : "将锁定回退"}</span>
          <button className="ghost-button" onClick={clearMapSelection}>取消</button>
          <button className="primary-button" onClick={() => { dispatch({ type: "MAP_CLICK", cellId: target.id }); clearMapSelection(); }}>{challenge ? "确认挑战" : "确认移动"}</button>
        </div>;
      })()}
      <div
        className={`map-inspector ${inspectorVisible ? "visible" : ""}`}
        aria-live="polite"
        onMouseEnter={cancelInspectorHide}
        onMouseLeave={scheduleInspectorHide}
        onFocusCapture={cancelInspectorHide}
        onBlurCapture={(event) => {
          if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) scheduleInspectorHide();
        }}
      >
        <>
          {hasSiteArt(inspected) ? <i className="inspector-art site-model-sprite" style={siteArtStyle(inspected.site, inspected.terrain)} aria-hidden="true" /> : inspected.enemy && inspected.tokenRevealed ? <i className="inspector-art enemy-sprite" style={enemyArtStyle(inspected.enemy)} aria-hidden="true" /> : inspected.enemy ? <i className="inspector-art token-back">?</i> : <i className={`inspector-art terrain-preview-${inspected.terrain}`}>{SITE_ICONS[inspected.site] || "◇"}</i>}
          <div className="inspector-copy"><small>{TERRAIN_LABELS[inspected.terrain]} · 移动 {terrainMoveLabel(inspected.terrain, state.time)}</small><strong>{publicCellIntel(inspected,state.difficulty).name}</strong><p>{inspectedHelp.summary}</p><MapPublicIntel cell={inspected} difficulty={state.difficulty} /></div>
          <div className="inspector-actions">
            {inspected.site === "ruins" && inspectedRuin && inspected.tokenRevealed && !inspected.conquered ? <div className="token-intel ruin-token-intel"><RuinTokenBadge token={inspectedRuin} compact /><div className="ruin-token-copy"><small>黄色遗迹标记</small><strong>{inspectedRuin.name}</strong><span>{inspectedRuin.description}</span>{inspectedEnemies.map((enemy) => <EnemyMapIntel key={enemy.id} enemy={enemy} />)}</div></div> : inspected.enemy && !inspected.conquered ? inspected.tokenRevealed ? <div className="token-intel"><small>已公开标记 · {inspectedEnemies.length} 枚</small>{inspectedEnemies.map((enemy) => <EnemyMapIntel key={enemy.id} enemy={enemy} />)}{inspectedHelp.actions.map((action) => <span key={action}>• {action}</span>)}</div> : <div className="token-intel hidden"><small>{inspectedEnemies.length} 枚标记背面</small><strong>信息尚未公开</strong><span>{inspected.site === "keep" || inspected.site === "mageTower" ? "白昼移动至相邻格会自动翻开；夜晚强攻时翻开。" : inspected.site === "city1" || inspected.site === "city2" ? "无论昼夜，移动至城市相邻格都会公开整支守军。" : inspected.site === "ruins" ? "夜晚进入遗迹后翻开；下一次白昼也会自动公开。" : "进入并触发战斗时翻开。"}</span>{inspectedHelp.actions.map((action) => <span key={action}>• {action}</span>)}</div> : <><small>你可以在这里</small>{inspectedHelp.actions.map((action) => <span key={action}>• {action}</span>)}</>}
            {canChallengeInspected && <button className="inspector-challenge-button" onClick={() => dispatch({ type: "MAP_CLICK", cellId: inspected.id })}><span>主动挑战「{inspectedEnemies[0]?.name ?? "游荡敌人"}」</span><strong>开始结算前可撤回</strong></button>}
          </div>
          {current.site === "ruins" && currentAltarColor && current.tokenRevealed && !current.conquered && <div className="map-current-action"><button className="inspector-challenge-button inspector-altar-button" disabled={!canInvokeCurrentAltar} onClick={() => dispatch({ type: "ENTER_ADVENTURE" })}><span>当前位置行动：祭拜{MANA_LABELS[currentAltarColor]}色魔力祭坛</span><strong>{currentAltarStatus}</strong></button></div>}
          {currentRuinEncounter && current.tokenRevealed && !current.conquered && <div className="map-current-action"><button className="inspector-challenge-button inspector-ruin-button" disabled={!canEnterCurrentRuin} onClick={() => dispatch({ type: "ENTER_ADVENTURE" })}><span>当前位置行动：进入古代遗迹并迎战</span><strong>{currentRuinStatus}</strong></button></div>}
        </>
      </div>
      <div className="map-caption"><span>到达大板块边缘后，点击绿色/棕色板块背面，花 2 移动整块探索；板块内部地形不会重随机。</span><span>在游荡敌人的相邻格之间移动会强制开战</span></div>
    </section>
  );
}

export function ResourceBar({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const resources = availableResources(state);
  const combatKeys: ResourceKey[] = ["range", "fireRange", "iceRange", "coldfireRange", "siege", "fireSiege", "iceSiege", "coldfireSiege", "block", "fireBlock", "iceBlock", "coldfireBlock", "attack", "fireAttack", "iceAttack", "coldfireAttack"];
  const keys: ResourceKey[] = ["move", ...combatKeys.filter((key) => resources[key] > 0), "influence", "heal", "draw", "crystal"];
  return (
    <section className="resource-bar">
      <div className="resource-title"><small>本回合</small><strong>资源池</strong></div>
      <div className="resource-values">
        {keys.map((key) => <div key={key} className={resources[key] > 0 ? "active" : ""}><i>{RESOURCE_ICONS[key]}</i><span><strong>{resources[key]}</strong><small>{RESOURCE_LABELS[key]}</small></span></div>)}
      </div>
      <div className="resource-actions">
        {resources.heal > 0 && woundCount(state) > 0 && <button onClick={() => dispatch({ type: "USE_HEAL" })}>治疗伤势</button>}
        {resources.draw > 0 && state.deck.length > 0 && <button onClick={() => dispatch({ type: "USE_DRAW" })}>抽 1 张</button>}
        {resources.crystal > 0 && <div className="gain-crystal"><span>凝晶</span>{BASIC_MANA.map((color) => <button key={color} className={`mana-${color}`} onClick={() => dispatch({ type: "GAIN_CRYSTAL", color })}>◆</button>)}</div>}
      </div>
    </section>
  );
}

export function CombatPanel({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  if (!state.combat) return null;
  const { enemy, step } = state.combat;
  const blockNeed = combatBlockRequirement(state, enemy);
  const defendReady = combatDefendAssignmentsComplete(state);
  const rangedAvailable = effectiveAttackValue(state, enemy, "ranged");
  const attackAvailable = effectiveAttackValue(state, enemy, "attack");
  const blockAvailable = effectiveBlockValue(state, enemy);
  const armorNeed = combatEnemyArmor(state, enemy);
  const cumbersomeReduction = state.combat.cumbersomeReductionByEnemyId?.[enemy.id] ?? 0;
  const damageRemaining = state.combat.damageRemaining ?? combatDamageTotal(state, enemy);
  const damageUnits = state.combat.unitsForbidden ? [] : state.units.filter((unit) => !unit.wounded
    && !state.combat?.absorbedUnitIds?.includes(unit.id)
    && (!state.combat?.allowedUnitIds || state.combat.allowedUnitIds.includes(unit.id)));
  const combatCell = state.map.find((cell) => cell.id === state.combat?.cellId);
  const cityTile = combatCell?.tileId?.match(/core-(\d+)/)?.[1];
  const cityColor = cityTile === "5" ? "green" : cityTile === "6" ? "blue" : cityTile === "7" ? "white" : cityTile === "8" ? "red" : undefined;
  const physicalAttack = (enemy.attackElement ?? "physical") === "physical";
  const cityAttackBonus = cityColor === "blue" ? enemy.attackElement === "fire" || enemy.attackElement === "ice" ? 2 : enemy.attackElement === "coldfire" ? 1 : 0 : 0;
  const shownAttack = enemy.attack + cityAttackBonus;
  const attackNumber = Math.min((state.combat.attackIndex ?? 0) + 1, enemy.attackCount ?? 1);
  const shownBrutal = Boolean(enemy.brutal || (cityColor === "red" && physicalAttack));
  const shownPoison = Boolean(enemy.poison || (cityColor === "green" && physicalAttack));
  const cityBonusText = cityColor === "white" ? "白色城市：该守军有效护甲 +1。" : cityColor === "blue" && cityAttackBonus ? `蓝色城市：该属性攻击 +${cityAttackBonus}。` : cityColor === "red" && physicalAttack ? "红色城市：该物理攻击获得残暴，未格挡伤害翻倍。" : cityColor === "green" && physicalAttack ? "绿色城市：该物理攻击获得中毒。" : undefined;
  const phaseQueue = state.combat.queue?.length ?? 0;
  const isMultiEnemy = phaseQueue > 0 || Boolean(state.combat.rangedSurvivors?.length) || Boolean(state.combat.attackedEnemies?.length);
  const visibleCombatEnemies = Array.from(new Map([enemy, ...(state.combat.queue ?? []).map((entry) => entry.enemy), ...(state.combat.rangedSurvivors ?? []).map((entry) => entry.enemy)].map((entry) => [entry.id, entry])).values());
  const forecast = step === "ranged" ? { label: "远程 / 攻城", available: rangedAvailable, need: armorNeed }
    : step === "block" ? { label: "格挡", available: blockAvailable, need: blockNeed }
      : step === "attack" ? { label: "近战攻击", available: attackAvailable, need: armorNeed }
        : { label: "待分配伤害", available: 0, need: damageRemaining };
  return (
    <section className="combat-panel" aria-label="战斗操作">
      <div className="combat-scroll-region" tabIndex={0} role="region" aria-label="敌情与战斗分配">
        <div className="combat-banner"><span>战斗{isMultiEnemy && <em>多敌军共享阶段</em>}</span><small>{step === "ranged" ? "远程 / 攻城" : step === "block" ? "格挡" : step === "damage" ? "承受伤害" : "近战攻击"}{phaseQueue > 0 ? ` · 后续 ${phaseQueue} 支` : ""}</small></div>
        <div className={`combat-forecast ${forecast.available >= forecast.need && step !== "damage" ? "ready" : "short"}`}><span>{forecast.label}</span><strong>{step === "damage" ? `剩余 ${forecast.need}` : `${forecast.available} / ${forecast.need}`}</strong><small>{step === "damage" ? "选择盟军或英雄承担" : forecast.available >= forecast.need ? "当前资源已经满足" : `还差 ${Math.max(0, forecast.need - forecast.available)}`}</small></div>
        {visibleCombatEnemies.length > 1 && <div className="combat-target-strip" aria-label="本场战斗敌人">{visibleCombatEnemies.map((target) => <span key={target.id} className={target.id === enemy.id ? "current" : ""}><i className="enemy-sprite" style={enemyArtStyle(target)} /> <b>{target.name}</b><small>护甲 {target.armor}</small></span>)}</div>}
        <div className="enemy-card">
          <div className="enemy-art enemy-sprite" style={enemyArtStyle(enemy)} aria-hidden="true" />
          <div className="enemy-info"><p className="eyebrow">{enemy.tokenColor ? `${enemy.tokenColor.toUpperCase()} 标记` : enemy.fortified ? "防御工事" : "敌军"}</p><h3>{enemy.name}</h3><p>{enemy.description}</p></div>
          <div className="enemy-stats"><div><small>有效护甲</small><strong>{armorNeed}</strong></div><div><small>本次攻击{(enemy.attackCount ?? 1) > 1 ? ` ${attackNumber}/${enemy.attackCount}` : ""}</small><strong>{shownAttack}</strong></div><div><small>名望</small><strong>+{enemy.fame}</strong></div></div>
          <div className="trait-row">{enemy.fortified && <span>防御工事</span>}{enemy.swift && <span>迅捷</span>}{shownBrutal && <span>残暴</span>}{shownPoison && <span>剧毒</span>}{enemy.paralyze && <span>麻痹</span>}{enemy.summon && <span>召唤</span>}{(enemy.attackCount ?? 1) > 1 && <span>{enemy.attackCount} 重攻击</span>}{enemy.arcaneImmunity && <span>奥术免疫</span>}{enemy.assassination && <span>刺杀</span>}{enemy.defend && <span>防卫</span>}{enemy.cumbersome && <span>笨重</span>}{enemy.elusiveArmor && <span>飘忽 {enemy.elusiveArmor}</span>}{enemy.faction && <span>{enemy.faction === "elementalists" ? "元素派" : "黑暗十字军"}</span>}{enemy.attackElement && enemy.attackElement !== "physical" && <span>{enemy.attackElement === "fire" ? "火焰攻击" : enemy.attackElement === "ice" ? "寒冰攻击" : "冷热火攻击"}</span>}{enemy.resistances?.map((item) => <span key={item}>{item === "physical" ? "物理抗性" : item === "fire" ? "火焰抗性" : "寒冰抗性"}</span>)}</div>
          {cityBonusText && <p className="combat-tip">{cityBonusText}</p>}
          {enemyTraitDetails(enemy).length > 0 && <details className="trait-explainer"><summary>特性如何结算</summary>{enemyTraitDetails(enemy).map((detail) => <p key={detail}>{detail}</p>)}</details>}
        </div>
        {(step === "ranged" || step === "attack") && <DefendAssignmentControls state={state} dispatch={dispatch} />}
        {(step === "ranged" || step === "attack") && <GroupAttackControls state={state} dispatch={dispatch} />}
        {step === "damage" && <div className="damage-assignment"><strong>剩余伤害 {damageRemaining}</strong>
          {state.combat.unitsForbidden && <small>此地点禁止盟军参战，伤害只能由英雄承受。</small>}
          {damageUnits.map((unit) => {
            const def = getUnit(unit.id)!;
            const element = enemy.attackElement ?? "physical";
            const resistant = state.allUnitResistances || (element === "coldfire" ? def.resistances?.includes("fire") && def.resistances?.includes("ice") : def.resistances?.includes(element));
            return <button key={unit.id} onClick={() => dispatch({ type: "ASSIGN_DAMAGE_UNIT", unitId: unit.id })}>{def.name}承伤 <small>{resistant ? `抗性：最多抵消 ${def.armor * 2}` : `抵消 ${def.armor}`}{shownPoison ? " · 受伤则 2 伤" : ""}{enemy.paralyze ? " · 受伤即摧毁" : ""}</small></button>;
          })}
        </div>}
      </div>
      <div className="combat-command-region" role="group" aria-label="当前战斗阶段操作">
        <div className="combat-flow">
          {(["ranged", "block", "damage", "attack"] as const).map((item, index) => <div key={item} className={`${step === item ? "current" : ""} ${["ranged", "block", "damage", "attack"].indexOf(step) > index ? "done" : ""}`}><i>{index + 1}</i><span>{item === "ranged" ? "远程" : item === "block" ? "格挡" : item === "damage" ? "承伤" : "近战"}</span></div>)}
        </div>
        <div className="combat-actions">
          {step === "ranged" && <>
            <button className="primary-button" disabled={!defendReady || rangedAvailable < armorNeed} onClick={() => dispatch({ type: "COMBAT_RANGED" })}>远程击破 <small>{defendReady ? `有效 ${rangedAvailable}/${armorNeed}` : "先分配防卫"}</small></button>
            <button className="ghost-button" onClick={() => dispatch({ type: "COMBAT_ADVANCE" })}>跳过远程 →</button>
          </>}
          {step === "block" && <>
            {enemy.cumbersome && <button className="ghost-button" disabled={availableResources(state).move < 1 || blockNeed === 0} onClick={() => dispatch({ type: "COMBAT_REDUCE_CUMBERSOME" })}>花 1 移动降低笨重攻击 <small>已降低 {cumbersomeReduction}</small></button>}
            <button className="primary-button" disabled={blockAvailable < blockNeed} onClick={() => dispatch({ type: "COMBAT_BLOCK" })}>{blockNeed === 0 ? "确认取消攻击" : "完整格挡"} <small>有效 {blockAvailable}/{blockNeed}</small></button>
            <button className="danger-button" onClick={() => dispatch({ type: "COMBAT_DAMAGE" })}>承受伤害</button>
          </>}
          {step === "damage" && <>
            <button className="danger-button" onClick={() => dispatch({ type: "COMBAT_DAMAGE" })}>其余由英雄承受</button>
          </>}
          {step === "attack" && <>
            <button className="primary-button" disabled={!defendReady || attackAvailable < armorNeed} onClick={() => dispatch({ type: "COMBAT_ATTACK" })}>发动攻击 <small>{defendReady ? `有效 ${attackAvailable}/${armorNeed}` : "先分配防卫"}</small></button>
            <button className="ghost-button" onClick={() => dispatch({ type: "COMBAT_RETREAT" })}>撤退</button>
          </>}
        </div>
        <p className="combat-tip">火焰攻击用寒冰/冷热火格挡；寒冰攻击用火焰/冷热火格挡；冷热火仅被冷热火格挡。其他格挡总值减半并向下取整；抗性也会令对应攻击总值减半。</p>
      </div>
    </section>
  );
}

function DefendAssignmentControls({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const assignments = combatDefendAssignments(state);
  if (!assignments.length) return null;
  return <div className="defend-assignment-controls">
    <strong>分配敌军防卫</strong>
    <small>每项防卫必须保护不同的存活敌人；防卫者在能力应用前被击败，则该加成消失。</small>
    {assignments.map(({ defender, targetId, targets }) => <label key={defender.id}>
      <span>{defender.name} · 防卫 {defender.defend}</span>
      <select value={targetId ?? ""} disabled={state.combat?.defendAssignmentsLocked} onChange={(event) => event.target.value && dispatch({ type: "ASSIGN_DEFEND", defenderId: defender.id, targetId: event.target.value })}>
        <option value="">选择保护目标</option>
        {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
      </select>
    </label>)}
  </div>;
}

function GroupAttackControls({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const targets = combatAttackTargets(state);
  const validSelected = selected.filter((id) => targets.some((entry) => entry.enemy.id === id));
  if (targets.length < 2) return null;
  const required = groupedAttackRequirement(state, validSelected);
  const available = effectiveGroupAttackValue(state, validSelected);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <div className="group-attack-controls">
    <strong>合并攻击组</strong><small>护甲相加；组内任一目标的对应抗性会压低整类攻击。</small>
    <div className="group-target-list">{targets.map((entry) => <label key={`${entry.cellId}-${entry.enemy.id}`}><input type="checkbox" checked={validSelected.includes(entry.enemy.id)} onChange={() => toggle(entry.enemy.id)} />{entry.enemy.name}（护甲 {combatEnemyArmor({ ...state, combat: { ...state.combat!, cellId: entry.cellId, enemy: entry.enemy } }, entry.enemy)}）</label>)}</div>
    <button className="primary-button" disabled={!combatDefendAssignmentsComplete(state) || validSelected.length < 2 || available < required} onClick={() => dispatch({ type: "COMBAT_GROUP_ATTACK", enemyIds: validSelected })}>合并击破 <small>{combatDefendAssignmentsComplete(state) ? `有效 ${available}/${required}` : "先分配防卫"}</small></button>
  </div>;
}

function SitePanel({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const [mazeUnitId, setMazeUnitId] = useState("");
  const [mazeCrystalA, setMazeCrystalA] = useState<(typeof BASIC_MANA)[number]>("red");
  const [mazeCrystalB, setMazeCrystalB] = useState<(typeof BASIC_MANA)[number]>("blue");
  const [multiRampagerIds, setMultiRampagerIds] = useState<string[]>([]);
  const cell = state.map.find((item) => item.id === state.position)!;
  const adjacentRampagers = state.map.filter((candidate) => isRampagingEnemyCell(candidate) && isAdjacent(cell, candidate));
  const adjacentAssaults = state.map.filter((candidate) => isAdjacent(cell, candidate) && !candidate.conquered && enemiesOnCell(candidate).length > 0 && ["keep", "mageTower", "city1", "city2", "volkareCamp"].includes(candidate.site));
  const help = SITE_HELP[cell.site];
  const resources = availableResources(state);
  const friendly = !cell.enemy || cell.conquered;
  const burnedMonastery = cell.site === "monastery" && cell.conquered;
  const isTradeSite = ["village", "monastery", "keep", "mageTower", "refugeeCamp", "city1", "city2"].includes(cell.site);
  const healingCost = influenceCost(state, cell.site === "monastery" ? 2 : 3);
  const continuingInteraction = !state.actionTaken || state.interactionSite === state.position;
  const ruin = cell.site === "ruins" && cell.ruinTokenId ? ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId] : undefined;
  const altarColor = cell.site === "ruins" ? (cell.ruinAltarColor ?? ruin?.altarColor) : undefined;
  const altarMana = altarColor ? availableManaCount(state, altarColor) : 0;
  const campServices = hasConqueredVolkareCampServices(state);
  const campPursuitUsed = state.pursuedCampCellIds?.includes(cell.id);
  return (
    <section className="panel site-panel">
      <div className="panel-title"><span>当前位置</span><small>{TERRAIN_LABELS[cell.terrain]}</small></div>
      <div className="site-identity">
        {hasSiteArt(cell) ? <i className="site-preview site-model-sprite" style={siteArtStyle(cell.site, cell.terrain)} aria-hidden="true" /> : cell.enemy ? <i className="site-preview enemy-sprite" style={enemyArtStyle(cell.enemy)} aria-hidden="true" /> : <i className={`terrain-preview terrain-preview-${cell.terrain}`}>{SITE_ICONS[cell.site] || "◇"}</i>}
        <div><strong>{SITE_LABELS[cell.site]}</strong><small>{burnedMonastery ? "已焚毁 · 视为空地" : cell.conquered ? "已征服" : cell.enemy ? "敌军驻守" : "可安全行动"}</small></div>
      </div>
      <div className="site-guide">
        <p>{help.summary}</p>
        <strong>你可以在这里</strong>
        <ul>{help.actions.map((action) => <li key={action}>{action}</li>)}</ul>
      </div>
      {adjacentRampagers.length > 0 && <div className="nearby-enemies">
        <div className="subheading"><span>相邻游荡敌人</span><small>可作为本回合行动挑战</small></div>
        {adjacentRampagers.map((enemyCell) => <button key={enemyCell.id} className="wide-action challenge-action" disabled={state.phase !== "planning" || state.actionTaken} onClick={() => dispatch({ type: "MAP_CLICK", cellId: enemyCell.id })}><span>挑战 {enemyCell.enemy?.name}</span><strong>留在当前格</strong></button>)}
        {adjacentRampagers.length > 1 && <div className="multi-combat-planner"><strong>同时挑战多支</strong>{adjacentRampagers.map((enemyCell) => <label key={`multi-${enemyCell.id}`}><input type="checkbox" checked={multiRampagerIds.includes(enemyCell.id)} onChange={() => setMultiRampagerIds((ids) => ids.includes(enemyCell.id) ? ids.filter((id) => id !== enemyCell.id) : [...ids, enemyCell.id])} />{enemyCell.enemy?.name}</label>)}<button disabled={multiRampagerIds.length < 2 || state.phase !== "planning" || state.actionTaken} onClick={() => dispatch({ type: "START_MULTI_COMBAT", rampagerCellIds: multiRampagerIds })}>确认同时挑战</button></div>}
        <p className="local-market-note warning-note">若移动前后两个格子都与同一游荡敌人相邻，它会被激怒：移动照常支付并落在目标格，但移动立即结束并强制进入战斗。</p>
      </div>}
      {adjacentAssaults.length > 0 && state.phase === "planning" && !state.actionTaken && <div className="multi-combat-planner assault-planner"><div className="subheading"><span>强攻规划</span><small>可主动让目标相邻的游荡敌人加入</small></div>{adjacentAssaults.map((target) => {
        const eligible = state.map.filter((candidate) => isRampagingEnemyCell(candidate) && isAdjacent(target, candidate));
        const chosen = multiRampagerIds.filter((id) => eligible.some((candidate) => candidate.id === id));
        return <div key={`assault-${target.id}`}><strong>{SITE_LABELS[target.site]}</strong>{eligible.map((enemyCell) => <label key={`${target.id}-${enemyCell.id}`}><input type="checkbox" checked={multiRampagerIds.includes(enemyCell.id)} onChange={() => setMultiRampagerIds((ids) => ids.includes(enemyCell.id) ? ids.filter((id) => id !== enemyCell.id) : [...ids, enemyCell.id])} />追加 {enemyCell.enemy?.name}</label>)}<button onClick={() => dispatch({ type: "START_MULTI_COMBAT", assaultCellId: target.id, rampagerCellIds: chosen })}>发动强攻{chosen.length ? `（追加 ${chosen.length} 处）` : ""}</button></div>;
      })}</div>}
      {(isAdventureEnemyCell(cell) || (cell.site === "ruins" && Boolean(altarColor) && !cell.conquered)) && <div className="adventure-action">
        {cell.site === "maze" || cell.site === "labyrinth" ? <div className="maze-entry-options">
          <label className="compact-field">陪同盟军
            <select value={mazeUnitId} onChange={(event) => setMazeUnitId(event.target.value)}>
              <option value="">不带盟军</option>
              {state.units.filter((unit) => !unit.used && !unit.wounded && !unit.needsFamiliarCrystal).map((unit) => <option key={unit.id} value={unit.id}>{getUnit(unit.id)?.name ?? unit.id}</option>)}
            </select>
          </label>
          <div className="maze-crystal-picks"><span>2 移动奖励颜色</span>
            <select value={mazeCrystalA} onChange={(event) => setMazeCrystalA(event.target.value as (typeof BASIC_MANA)[number])}>{BASIC_MANA.map((color) => <option key={color} value={color}>{MANA_LABELS[color]}</option>)}</select>
            <select value={mazeCrystalB} onChange={(event) => setMazeCrystalB(event.target.value as (typeof BASIC_MANA)[number])}>{BASIC_MANA.map((color) => <option key={color} value={color}>{MANA_LABELS[color]}</option>)}</select>
          </div>
          {([2, 4, 6] as const).map((moveSpend) => <button key={moveSpend} className="wide-action challenge-action" disabled={state.phase !== "planning" || state.actionTaken || resources.move < moveSpend} onClick={() => dispatch({ type: "ENTER_ADVENTURE", moveSpend, accompanyingUnitId: mazeUnitId || undefined, rewardCrystalColors: moveSpend === 2 ? [mazeCrystalA, mazeCrystalB] : undefined })}><span>进入{cell.site === "maze" ? "迷宫" : "大型迷宫"}</span><strong>{moveSpend} 移动 · {moveSpend === 2 ? "所选两枚水晶" : moveSpend === 4 ? "法术奖励" : "圣器奖励"}{cell.site === "labyrinth" ? " + 进阶行动" : ""}</strong></button>)}
        </div> : <button className="wide-action challenge-action" disabled={state.phase !== "planning" || state.actionTaken || Boolean(altarColor && altarMana < 3)} onClick={() => dispatch({ type: "ENTER_ADVENTURE" })}>
          <span>{altarColor ? `祭拜${MANA_LABELS[altarColor]}色魔力祭坛` : `进入${cell.site === "ruins" ? "古代遗迹并迎战" : cell.site === "tomb" ? "古墓" : cell.site === "spawningGrounds" ? "繁殖地" : SITE_LABELS[cell.site]}`}</span><strong>{altarColor ? (altarMana >= 3 ? "支付 3 份同色魔力 · 名望 +7" : `当前可支付 ${altarMana}/3 份同色魔力`) : cell.site === "ruins" && ruin ? `抽取 ${ruin.enemies.length} 枚敌人标记 · 作为本回合行动` : "作为本回合行动"}</strong>
        </button>}
        <p className="local-market-note">站在冒险地点不会自动开战；你可以先探索或继续移动，准备好后再宣布进入。</p>
      </div>}
      {cell.site === "monastery" && !cell.conquered && <div className="adventure-action">
        <button className="wide-action challenge-action" disabled={state.phase !== "planning" || state.actionTaken} onClick={() => dispatch({ type: "BURN_MONASTERY" })}><span>尝试焚烧修道院</span><strong>声誉 -3 · 随机紫色守卫 · 禁用盟军</strong></button>
        <p className="local-market-note warning-note">宣布后会立即抽取新守卫，因此是不可回退的信息边界；仅在获胜后修道院才会被焚毁并奖励圣器。</p>
      </div>}
      {cell.site === "none" && <p className="empty-copy">这片区域没有可互动的地点。你可以继续移动，或结束回合。</p>}
      {cell.site === "glade" && <p className="site-rule">在此结束回合，会从手牌或弃牌堆自动移除 1 张伤势。</p>}
      {cell.site === "mine" && <p className="site-rule">在此结束回合，获得 1 枚对应颜色的水晶（每色最多 3 枚）。</p>}
      {cell.site === "deepMine" && <div className="deep-mine-options"><p className="site-rule">在此结束回合，从板块标示的深矿颜色中获得 1 枚水晶；深矿不需要掷骰。</p>{(cell.mineColors?.length ? cell.mineColors : cell.mineColor ? [cell.mineColor] : []).map((color) => <button key={color} className={state.selectedMineColor === color ? "selected" : ""} onClick={() => dispatch({ type: "SELECT_MINE_COLOR", color })}>选择{MANA_LABELS[color]}色</button>)}</div>}
      {cell.site === "refugeeCamp" && <p className="site-rule">同一次互动可连续招募：村庄单位原价；修道院/要塞/法师塔单位 +1；仅城市单位 +3。声誉修正照常结算。</p>}
      {campServices && <div className="camp-services">
        <div className="subheading"><span>沃尔卡雷营地服务</span><small>营地或其相邻格可用 · 营地盾牌 {state.volkareShields ?? 0}</small></div>
        <button className="wide-action" disabled={state.phase !== "planning" || !continuingInteraction || !state.regularUnitDeck.length || resources.influence < influenceCost(state, 1)} onClick={() => dispatch({ type: "ADD_REGULAR_UNIT_TO_OFFER" })}><span>扩充普通盟军供应</span><strong>{influenceCost(state, 1)} 有效影响力</strong></button>
        <div className="camp-pursuit-actions"><span>追猎（每个区域至多一次；只奖励名望与追猎盾牌）</span>
          {([[["green"], "绿色兽人"], [["red"], "红色巨龙"], [["green", "red"], "兽人与巨龙"]] as const).map(([colors, label]) => <button key={label} disabled={state.phase !== "planning" || state.actionTaken || Boolean(campPursuitUsed)} onClick={() => dispatch({ type: "PURSUE_VOLKARE_ENEMIES", colors: [...colors] })}>{label}</button>)}
        </div>
        {campPursuitUsed && <p className="local-market-note">当前区域已经放置过追猎盾牌，不能再次追猎。</p>}
      </div>}
      {isTradeSite && friendly && !burnedMonastery && <>
        <div className="subheading"><span>当地行动</span><small>可用影响力 {resources.influence}</small></div>
        {!localsWillInteract(state) && <p className="site-rule hostile">声誉轨位已到 X；居民拒绝互动，先提高声誉。</p>}
        {(cell.site === "village" || cell.site === "monastery" || cell.site === "city1" || cell.site === "city2") && woundCount(state) > 0 && <button className="wide-action" disabled={!localsWillInteract(state) || resources.influence < healingCost || !continuingInteraction} onClick={() => dispatch({ type: "HEAL_WITH_INFLUENCE" })}><span>疗愈伤势</span><strong>{healingCost} 影响力</strong></button>}
        <p className="local-market-note">公开供应始终显示在下方供应区；开始互动后，可在同一次行动中继续购买，声誉修正只结算一次。</p>
      </>}
      {cell.enemy && !cell.conquered && !isAdventureEnemyCell(cell) && <p className="site-rule hostile">必须击败守军，才能使用这里的服务。</p>}
    </section>
  );
}

function PublicOffersPanel({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const [tab, setTab] = useState<"units" | "advanced" | "spell">("units");
  const cell = state.map.find((item) => item.id === state.position)!;
  const resources = availableResources(state);
  const atConqueredCity = (cell.site === "city1" || cell.site === "city2") && cell.conquered;
  const continuingInteraction = !state.actionTaken || state.interactionSite === state.position;

  const unitStatus = (unit: UnitDef, cost: number) => {
    if (state.phase !== "planning") return "当前阶段不可招募";
    if (!continuingInteraction) return "本回合行动已经使用";
    if (!localsWillInteract(state) && !(unit.id === "magicFamiliars" && cell.site === "glade")) return "声誉为 X，居民拒绝互动";
    if (!canRecruitUnitAtCurrentSite(state, unit)) return `需要进入${UNIT_SITE_LABELS[unit.site]}`;
    if (state.units.length >= commandLimit(state)) return "指挥位已满";
    if (resources.influence < cost) return `还需 ${cost - resources.influence} 影响力`;
    return "可以招募";
  };

  const cardStatus = (tier: "advanced" | "spell", cost: number, color: keyof typeof MANA_LABELS, monastery = false) => {
    if (state.phase !== "planning") return "当前阶段不可学习";
    if (!continuingInteraction) return "本回合行动已经使用";
    if (!localsWillInteract(state)) return "声誉为 X，居民拒绝互动";
    if (monastery && cell.site !== "monastery") return "需要进入修道院";
    if (!monastery && tier === "advanced" && !atConqueredCity) return "普通供应需在已征服城市获取";
    if (tier === "spell" && !canBuyTier(state, "spell")) return "需要已征服法师塔或城市";
    if (resources.influence < cost) return `还需 ${cost - resources.influence} 影响力`;
    if (tier === "spell" && !canSpendMana(state, color)) return `还需一份${MANA_LABELS[color]}色魔力`;
    return "可以学习";
  };

  const renderOfferCard = (id: string, tier: "advanced" | "spell", monastery = false) => {
    const card = ALL_CARD_DEFS[id];
    const cost = influenceCost(state, card.cost ?? (tier === "advanced" ? 6 : 7));
    const status = cardStatus(tier, cost, card.color, monastery);
    const available = status === "可以学习";
    return <button key={`${monastery ? "monastery" : tier}-${id}`} className={`mini-card public-card mana-${card.color} ${available ? "available" : ""}`} disabled={!available} title={`${card.name}：${card.basicLabel}；强化：${card.poweredLabel}。${status}`} aria-label={`${card.name}。基础：${card.basicLabel}。强化：${card.poweredLabel}。${status}`} onClick={() => dispatch({ type: "BUY_CARD", cardId: id, tier })}>
      <i className={`mini-card-art ${cardArtClass(card)}`} style={cardArtStyle(card)} aria-hidden="true"><span>✦ ✦ ✦ ✦ ✦</span></i>
      <span><small>{tier === "spell" ? "法术卡" : "进阶行动"} · {MANA_LABELS[card.color]}属性</small><strong>{card.name}</strong><em>{card.basicLabel}</em></span><strong className="card-cost-orb">{cost}</strong>
      <b className="offer-status" title={status}>{status}</b>
    </button>;
  };

  return (
    <section className="panel market-panel public-offers-panel">
      <div className="panel-title"><span>公共供应区</span><small>始终公开 · 每轮刷新</small></div>
      <div className="market-tabs three-tabs">
        <button className={tab === "units" ? "active" : ""} onClick={() => setTab("units")}>盟军 <small>{state.unitOffer.length + state.monasteryOffer.length}</small></button>
        <button className={tab === "advanced" ? "active" : ""} onClick={() => setTab("advanced")}>进阶 <small>{state.advancedOffer.length}</small></button>
        <button className={tab === "spell" ? "active" : ""} onClick={() => setTab("spell")}>法术 <small>{state.spellOffer.length}</small></button>
      </div>

      {tab === "units" && <div className="unit-public-offer">
        {state.unitOffer.map((id) => {
          const unit = getUnit(id)!;
          const cost = unitRecruitInfluenceCost(state, unit);
          const status = unitStatus(unit, cost);
          const available = status === "可以招募";
          if (unit.id === "magicFamiliars") return <div key={id} className={`public-unit-card ${available ? "available" : ""}`}>
            <i className="public-unit-art unit-sprite" style={unitArtStyle(unit.id)} aria-hidden="true"><span>{"✦".repeat(unit.level)}</span></i>
            <span><small>常规盟军 · 招募时选色</small><strong>{unit.name}</strong><em>护甲 {unit.armor} · {UNIT_SITE_LABELS[unit.site]}</em><p>{unit.text}</p><span className="familiar-recruit-colors">{BASIC_MANA.map((color) => <button key={color} className={`mana-${color}`} disabled={!available || !canSpendMana(state, color)} onClick={() => dispatch({ type: "RECRUIT", unitId: id, manaColor: color })}>支付{MANA_LABELS[color]}</button>)}</span></span>
            <strong className="unit-cost-orb">{cost}</strong><b>{available ? "选择魔力颜色" : status}</b>
          </div>;
          return <button key={id} className={`public-unit-card ${available ? "available" : ""}`} disabled={!available} onClick={() => dispatch({ type: "RECRUIT", unitId: id })}>
            <i className="public-unit-art unit-sprite" style={unitArtStyle(unit.id)} aria-hidden="true"><span>{"✦".repeat(unit.level)}</span></i>
            <span><small>{unit.tier === "elite" ? "精英盟军" : "常规盟军"}</small><strong>{unit.name}</strong><em>护甲 {unit.armor} · {UNIT_SITE_LABELS[unit.site]}</em><p>{unit.text}</p></span>
            <strong className="unit-cost-orb">{cost}</strong><b>{status}</b>
          </button>;
        })}
        {state.monasteryOffer.length > 0 && <div className="monastery-offer-divider"><span>修道院进阶行动</span><small>修道院揭示时加入，不会立即补位</small></div>}
        {state.monasteryOffer.map((id) => renderOfferCard(id, "advanced", true))}
      </div>}

      {tab === "advanced" && <div className="market-cards">{state.advancedOffer.map((id) => renderOfferCard(id, "advanced"))}</div>}
      {tab === "spell" && <div className="market-cards">{state.spellOffer.map((id) => renderOfferCard(id, "spell"))}</div>}
      <p className="offer-audit-note">供应内容始终可查看；地点、行动、指挥位或影响力不足时，只禁用操作并注明原因。</p>
    </section>
  );
}

export function TurnPanel({ state, dispatch, revertHistory, onRevert }: { state: GameState; dispatch: Dispatch<GameAction>; revertHistory: RevertHistoryState; onRevert: () => void }) {
  const mapBonus = mapHandLimitBonus(state);
  const hasTurnActivity = state.played.length > 0 || state.actionTaken || Object.values(state.spent).some(Boolean) || (state.turnDiscardCount ?? 0) > 0;
  const reversible = revertHistory.past.at(-1);
  return (
    <section className="turn-panel">
      <div className="turn-status">
        <span className={state.actionTaken ? "done" : "active"}>{state.combat ? "战斗进行中" : state.interactionSite ? "当地互动进行中" : state.actionTaken ? "本回合行动已完成" : "移动与行动阶段"}</span>
        <small>牌库 {state.deck.length} · 手牌上限 {handLimit(state)}{mapBonus > 0 ? `（地点 +${mapBonus}）` : ""}</small>
      </div>
      <button className="rest-button" disabled={state.phase !== "planning" || state.actionTaken || state.played.length > 0 || woundCount(state) === 0} onClick={() => dispatch({ type: "REST" })}>休整</button>
      <button className="revert-button" disabled={!reversible} onClick={onRevert} title={reversible ? `撤回：${reversible.label}（⌘/Ctrl + Z）` : revertHistory.boundaryReason}>
        <span>{reversible ? `↶ 撤回：${reversible.label}` : "↶ 当前不能撤回"}</span><kbd>⌘Z</kbd>
      </button>
      <small className={`revert-boundary ${reversible ? "available" : "locked"}`}>{reversible ? `当前仍可连续回退 ${revertHistory.past.length} 步；下一步：${reversible.label}。` : revertHistory.boundaryReason}</small>
      <button className="end-turn-button" disabled={state.phase !== "planning" || !hasTurnActivity} title={!hasTurnActivity ? "先打出或弃掉至少 1 张牌" : undefined} onClick={() => dispatch({ type: "END_TURN" })}>{state.finalTurn ? "结束最后回合" : "结束回合"} <span>→</span></button>
      {state.phase === "planning" && state.deck.length === 0 && <button className="forfeit-button" onClick={() => dispatch({ type: "FORFEIT_ROUND" })}>宣布本轮结束</button>}
    </section>
  );
}

function SpecialCardPicker({ state, dispatch, instanceId, mode, modeLabel, effectChoice }: {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  instanceId: string;
  mode: "basic" | "powered";
  modeLabel: string;
  effectChoice?: number;
}) {
  const card = getCard(instanceId)!;
  const effect = mode === "powered" ? card.powered : card.basic;
  const special = effect.special;
  const availableHand = state.hand.filter((id) => id !== instanceId && !state.played.some((play) => play.instanceId === id || play.linkedCard?.instanceId === id) && Boolean(getCard(id)));
  const actionHand = availableHand.filter((id) => {
    const target = getCard(id);
    return target && target.tier !== "spell" && target.tier !== "artifact";
  });
  const [selection, setSelection] = useState<CardPlaySelection>({});
  const update = (patch: Partial<CardPlaySelection>) => setSelection((current) => ({ ...current, ...patch }));
  const submit = (selected: CardPlaySelection = selection, chosenEffect = effectChoice) => dispatch({ type: "PLAY_CARD", instanceId, mode, effectChoice: chosenEffect, selection: selected });
  const picker = (body: React.ReactNode, disabled = false, defaults: CardPlaySelection = {}) => {
    const selected = Object.fromEntries(Object.entries({ ...defaults, ...selection }).filter(([, value]) => value !== undefined)) as CardPlaySelection;
    return <details className="special-card-picker"><summary>{modeLabel} · 选择</summary><div>{body}<button disabled={disabled} onClick={() => submit(selected)}>确认打出</button></div></details>;
  };
  const manaButtons = (colors: Array<"red" | "blue" | "green" | "white" | "black">, onPick: (color: "red" | "blue" | "green" | "white" | "black") => void) => <div className="special-choice-row">{colors.map((color) => <button key={color} className={`mana-${color}`} onClick={() => onPick(color)}>{MANA_LABELS[color]}</button>)}</div>;

  if ((special === "concentration" || special === "will-focus") && mode === "basic") {
    return <details className="special-card-picker"><summary>{modeLabel} · 选择魔力</summary><div>
      {manaButtons(["red", "blue", "white"], (color) => submit({ manaColors: [color] }))}
      {special === "will-focus" && <button disabled={state.crystals.green >= 3} onClick={() => submit({ option: "green-crystal" })}>获得绿色水晶</button>}
    </div></details>;
  }
  if ((special === "concentration" || special === "will-focus" || special === "maximal-effect") && mode === "powered" || special === "maximal-effect") {
    const target = selection.cardInstanceId && actionHand.includes(selection.cardInstanceId) ? selection.cardInstanceId : (actionHand[0] ?? "");
    return picker(<label><span>目标行动牌</span><select value={target} onChange={(event) => update({ cardInstanceId: event.target.value })}>{actionHand.length ? actionHand.map((id) => <option key={id} value={id}>{getCard(id)?.name}</option>) : <option value="">没有可用行动牌</option>}</select></label>, !target, { cardInstanceId: target });
  }
  if (special === "mana-pull" && mode === "powered") {
    const freeDice = state.source.map((_, index) => index).filter((index) => !usedSource(state, index));
    const indices = selection.sourceDieIndices?.length === 2 ? selection.sourceDieIndices : freeDice.slice(0, 2);
    const colors: Array<Exclude<ManaColor, "gold">> = selection.manaColors?.length === 2 ? selection.manaColors : ["red", "blue"];
    const setIndex = (slot: number, value: number) => { const copy = [...indices]; copy[slot] = value; update({ sourceDieIndices: copy }); };
    const setColor = (slot: number, value: Exclude<ManaColor, "gold">) => { const copy = [...colors]; copy[slot] = value; update({ manaColors: copy }); };
    return picker(<>{[0, 1].map((slot) => <label key={slot}><span>源泉骰 {slot + 1}</span><select value={indices[slot] ?? ""} onChange={(event) => setIndex(slot, Number(event.target.value))}>{freeDice.map((index) => <option key={index} value={index}>{index + 1} · {MANA_LABELS[state.source[index].color]}</option>)}</select><select value={colors[slot]} onChange={(event) => setColor(slot, event.target.value as Exclude<ManaColor, "gold">)}>{MANA_DRAW_COLORS.map((color) => <option key={color} value={color}>{MANA_LABELS[color]}</option>)}</select></label>)}</>, indices.length !== 2 || indices[0] === indices[1], { sourceDieIndices: indices, manaColors: colors });
  }
  if (special === "blood-rage") return <details className="special-card-picker"><summary>{modeLabel} · 是否承伤</summary><div><button onClick={() => submit({ takeWound: false })}>保持原攻击</button><button onClick={() => submit({ takeWound: true })}>承受伤势并提高攻击</button></div></details>;
  if (special === "intimidate" && effect.choices?.length) return <details className="special-card-picker"><summary>{modeLabel} · 选择用途</summary><div>{effect.choices.map((choice, index) => <button key={choice.label} onClick={() => submit({}, index)}>{choice.label}</button>)}</div></details>;
  if (special === "song-of-wind" && mode === "powered") return <details className="special-card-picker"><summary>{modeLabel} · 湖泊选项</summary><div><button onClick={() => submit({ option: "normal" })}>只降低三类地形</button><button onClick={() => submit({ option: "lake" })}>额付蓝魔，湖泊费用 0</button></div></details>;
  if (special === "blood-ritual") {
    const count = mode === "powered" ? 3 : 1;
    const colors = selection.manaColors?.length === count ? selection.manaColors : Array.from({ length: count }, () => "red" as const);
    const setColor = (slot: number, color: Exclude<ManaColor, "gold">) => { const copy = [...colors]; copy[slot] = color; update({ manaColors: copy }); };
    return picker(<>{colors.map((color, slot) => <label key={slot}><span>魔力 {slot + 1}</span><select value={color} onChange={(event) => setColor(slot, event.target.value as Exclude<ManaColor, "gold">)}>{MANA_DRAW_COLORS.map((item) => <option key={item} value={item}>{MANA_LABELS[item]}</option>)}</select></label>)}{mode === "powered" && <label><span>额外</span><select value={selection.option ?? "none"} onChange={(event) => update({ option: event.target.value })}><option value="none">不凝晶</option><option value="crystallize">消耗一份所选基础魔力凝晶</option></select></label>}</>, false, { manaColors: colors });
  }
  if (special === "pure-magic") return <details className="special-card-picker"><summary>{modeLabel} · 支付颜色</summary><div>{manaButtons(BASIC_MANA, (color) => submit({ manaColors: [color] }))}</div></details>;
  if (special === "diplomacy" && mode === "powered") return <details className="special-card-picker"><summary>{modeLabel} · 格挡属性</summary><div><button onClick={() => submit({ option: "fire" })}>影响力作为火焰格挡</button><button onClick={() => submit({ option: "ice" })}>影响力作为寒冰格挡</button></div></details>;
  if (special === "decompose") {
    const target = selection.cardInstanceId && actionHand.includes(selection.cardInstanceId) ? selection.cardInstanceId : (actionHand[0] ?? "");
    return picker(<label><span>移除行动牌</span><select value={target} onChange={(event) => update({ cardInstanceId: event.target.value })}>{actionHand.map((id) => <option key={id} value={id}>{getCard(id)?.name}</option>)}</select></label>, !target, { cardInstanceId: target });
  }
  if (special === "crystal-mastery" && mode === "basic") return <details className="special-card-picker"><summary>{modeLabel} · 水晶颜色</summary><div>{manaButtons(BASIC_MANA.filter((color) => state.crystals[color] > 0 && state.crystals[color] < 3), (color) => submit({ manaColors: [color] }))}</div></details>;
  if (special === "mana-storm" && mode === "basic") return <details className="special-card-picker"><summary>{modeLabel} · 重掷源泉</summary><div>{state.source.map((die, index) => <button key={index} disabled={usedSource(state, index) || !BASIC_MANA.includes(die.color as typeof BASIC_MANA[number])} onClick={() => submit({ sourceDieIndices: [index] })}>骰 {index + 1} · {MANA_LABELS[die.color]}</button>)}</div></details>;
  if (special === "magic-talent") {
    const spellId = selection.cardId && state.spellOffer.includes(selection.cardId) ? selection.cardId : (state.spellOffer[0] ?? "");
    const spell = spellId ? ALL_CARD_DEFS[spellId] : undefined;
    const matchingHand = availableHand.filter((id) => getCard(id)?.color === spell?.color);
    const handId = selection.cardInstanceId && matchingHand.includes(selection.cardInstanceId) ? selection.cardInstanceId : (matchingHand[0] ?? "");
    const defaults: CardPlaySelection = { cardId: spellId, ...(mode === "basic" ? { cardInstanceId: handId } : spell ? { manaColors: [spell.color as typeof BASIC_MANA[number]] } : {}) };
    return picker(<><label><span>法术</span><select value={spellId} onChange={(event) => { const id = event.target.value; const color = ALL_CARD_DEFS[id]?.color as typeof BASIC_MANA[number]; update({ cardId: id, cardInstanceId: undefined, manaColors: mode === "powered" ? [color] : undefined }); }}>{state.spellOffer.map((id) => <option key={id} value={id}>{ALL_CARD_DEFS[id]?.name}</option>)}</select></label>{mode === "basic" && <label><span>弃同色牌</span><select value={handId} onChange={(event) => update({ cardInstanceId: event.target.value })}>{matchingHand.length ? matchingHand.map((id) => <option key={id} value={id}>{getCard(id)?.name}</option>) : <option value="">没有同色手牌</option>}</select></label>}</>, !spellId || (mode === "basic" && !handId), defaults);
  }
  if (special === "training") {
    const target = selection.cardInstanceId && actionHand.includes(selection.cardInstanceId) ? selection.cardInstanceId : (actionHand[0] ?? "");
    const color = getCard(target)?.color;
    const offer = state.advancedOffer.filter((id) => ALL_CARD_DEFS[id]?.color === color);
    const cardId = selection.cardId && offer.includes(selection.cardId) ? selection.cardId : (offer[0] ?? "");
    return picker(<><label><span>移除行动牌</span><select value={target} onChange={(event) => update({ cardInstanceId: event.target.value, cardId: undefined })}>{actionHand.map((id) => <option key={id} value={id}>{getCard(id)?.name}</option>)}</select></label><label><span>取得同色进阶</span><select value={cardId} onChange={(event) => update({ cardId: event.target.value })}>{offer.length ? offer.map((id) => <option key={id} value={id}>{ALL_CARD_DEFS[id]?.name}</option>) : <option value="">供应区没有同色牌</option>}</select></label></>, !target || !cardId, { cardInstanceId: target, cardId });
  }
  if ((special === "underground-travel" || (special === "wings" && mode === "basic"))) {
    const maxSteps = special === "wings" ? 5 : 3;
    const paths: string[][] = [];
    const walk = (fromId: string, path: string[]) => {
      if (path.length) paths.push(path);
      if (path.length >= maxSteps) return;
      const from = state.map.find((cell) => cell.id === fromId);
      if (!from) return;
      state.map.filter((cell) => cell.revealed && isAdjacent(from, cell) && !path.includes(cell.id)).forEach((cell) => {
        if (special === "underground-travel" && (cell.terrain === "lake" || cell.terrain === "swamp")) return;
        walk(cell.id, [...path, cell.id]);
      });
    };
    walk(state.position, []);
    const legal = paths.filter((path) => {
      const target = state.map.find((cell) => cell.id === path.at(-1));
      if (!target) return false;
      if (special === "underground-travel" && mode === "powered") return !target.conquered && ["keep", "mageTower", "city1", "city2"].includes(target.site) && (target.enemies?.length || target.enemy);
      return !(target.enemies?.length || target.enemy) && !isAdventureEnemyCell(target);
    });
    const serialized = selection.cellIds?.join("|") ?? legal[0]?.join("|") ?? "";
    return picker(<label><span>路径/终点</span><select value={serialized} onChange={(event) => update({ cellIds: event.target.value.split("|").filter(Boolean) })}>{legal.length ? legal.map((path) => { const target = state.map.find((cell) => cell.id === path.at(-1)); return <option key={path.join("|")} value={path.join("|")}>{path.length} 格 → {target ? (target.site === "none" ? TERRAIN_LABELS[target.terrain] : SITE_LABELS[target.site]) : path.at(-1)}</option>; }) : <option value="">没有合法路径</option>}</select></label>, !serialized, { cellIds: legal[0] });
  }
  const combatEnemies = state.combat ? [state.combat.enemy, ...(state.combat.queue ?? []).map((entry) => entry.enemy), ...(state.combat.rangedSurvivors ?? []).map((entry) => entry.enemy)] : [];
  if (special === "chill" || (special === "demolish" && mode === "powered")) {
    const enemyId = selection.enemyIds?.[0] ?? combatEnemies[0]?.id ?? "";
    return picker(<label><span>目标敌人</span><select value={enemyId} onChange={(event) => update({ enemyIds: [event.target.value] })}>{combatEnemies.map((enemy) => <option key={enemy.id} value={enemy.id}>{enemy.name}</option>)}</select></label>, !enemyId, { enemyIds: enemyId ? [enemyId] : [] });
  }
  if (special === "wings" && mode === "powered") {
    const ids = selection.enemyIds?.length ? selection.enemyIds : combatEnemies[0] ? [combatEnemies[0].id] : [];
    const toggle = (id: string) => update({ enemyIds: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] });
    return picker(<fieldset><legend>不攻击的敌人（追加目标依次需 1、2…移动）</legend>{combatEnemies.map((enemy) => <label key={enemy.id}><input type="checkbox" checked={ids.includes(enemy.id)} onChange={() => toggle(enemy.id)} />{enemy.name}</label>)}</fieldset>, !ids.length, { enemyIds: ids });
  }
  if (special === "call-to-arms") {
    const unitId = selection.unitId && state.unitOffer.includes(selection.unitId) ? selection.unitId : (state.unitOffer[0] ?? "");
    const unit = unitId ? getUnit(unitId) : undefined;
    const abilities = unit?.abilities ?? [];
    const abilityId = selection.option && abilities.some((ability) => ability.id === selection.option) ? selection.option : (abilities[0]?.id ?? "");
    const disband = selection.cardInstanceId ?? state.units[0]?.id ?? "";
    const defaults: CardPlaySelection = { unitId, ...(mode === "basic" ? { option: abilityId } : state.units.length >= commandLimit(state) ? { cardInstanceId: disband } : {}) };
    return picker(<><label><span>供应盟军</span><select value={unitId} onChange={(event) => update({ unitId: event.target.value, option: undefined })}>{state.unitOffer.map((id) => <option key={id} value={id}>{getUnit(id)?.name}</option>)}</select></label>{mode === "basic" && <label><span>借用能力</span><select value={abilityId} onChange={(event) => update({ option: event.target.value })}>{abilities.map((ability) => <option key={ability.id} value={ability.id}>{ability.label}</option>)}</select></label>}{mode === "powered" && state.units.length >= commandLimit(state) && <label><span>遣散盟军</span><select value={disband} onChange={(event) => update({ cardInstanceId: event.target.value })}>{state.units.map((unitState) => <option key={unitState.id} value={unitState.id}>{getUnit(unitState.id)?.name}</option>)}</select></label>}</>, !unitId || (mode === "basic" && !abilityId), defaults);
  }
  if (special === "meditation") {
    const chosen = selection.cardInstanceIds?.length === 2 ? selection.cardInstanceIds : state.discard.slice(0, 2);
    const setCard = (slot: number, id: string) => { const copy = [...chosen]; copy[slot] = id; update({ cardInstanceIds: copy }); };
    return picker(<>{mode === "powered" && [0, 1].map((slot) => <label key={slot}><span>弃牌 {slot + 1}</span><select value={chosen[slot] ?? ""} onChange={(event) => setCard(slot, event.target.value)}>{state.discard.map((id) => <option key={id} value={id}>{getCard(id)?.name ?? "伤势"}</option>)}</select></label>)}<label><span>放置位置</span><select value={selection.option ?? "top"} onChange={(event) => update({ option: event.target.value })}><option value="top">牌库顶</option><option value="bottom">牌库底</option></select></label></>, state.discard.length < 2 || new Set(chosen).size !== 2, { cardInstanceIds: chosen });
  }
  if ((["banner-glory", "banner-fear", "banner-protection", "banner-courage", "banner-fortitude"] as const).includes(special as never) && mode === "basic") {
    const unitId = selection.unitId && state.units.some((unit) => unit.id === selection.unitId) ? selection.unitId : (state.units[0]?.id ?? "");
    return picker(<label><span>装备盟军</span><select value={unitId} onChange={(event) => update({ unitId: event.target.value })}>{state.units.length ? state.units.map((unit) => <option key={unit.id} value={unit.id}>{getUnit(unit.id)?.name}{unit.banner ? `（替换${getCard(unit.banner.cardId)?.name ?? "现有旗帜"}）` : ""}</option>) : <option value="">没有盟军</option>}</select></label>, !unitId, { unitId });
  }
  if (special === "banner-fear" && mode === "powered") {
    const ids = selection.enemyIds ?? [];
    const toggle = (id: string) => update({ enemyIds: ids.includes(id) ? ids.filter((item) => item !== id) : ids.length < 3 ? [...ids, id] : ids });
    return picker(<fieldset><legend>选择至多 3 个不发动攻击的敌人</legend>{combatEnemies.map((enemy) => <label key={enemy.id}><input type="checkbox" checked={ids.includes(enemy.id)} onChange={() => toggle(enemy.id)} />{enemy.name}</label>)}</fieldset>, !ids.length || ids.length > 3);
  }
  if (special === "sword-justice" && mode === "basic") {
    const ids = selection.cardInstanceIds ?? [];
    const toggle = (id: string) => update({ cardInstanceIds: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] });
    return picker(<fieldset><legend>弃任意张牌（每张攻击 3；可选择 0 张）</legend>{availableHand.map((id) => <label key={id}><input type="checkbox" checked={ids.includes(id)} onChange={() => toggle(id)} />{getCard(id)?.name ?? "伤势"}</label>)}</fieldset>);
  }
  if (special === "amulet-darkness") {
    const count = mode === "powered" ? 3 : 1;
    const colors: Array<Exclude<ManaColor, "gold">> = selection.manaColors?.length === count ? selection.manaColors : Array.from({ length: count }, () => "black" as const);
    const setColor = (slot: number, value: Exclude<ManaColor, "gold">) => { const copy = [...colors]; copy[slot] = value; update({ manaColors: copy }); };
    return picker(<>{colors.map((color, slot) => <label key={slot}><span>魔力 {slot + 1}</span><select value={color} onChange={(event) => setColor(slot, event.target.value as Exclude<ManaColor, "gold">)}>{MANA_DRAW_COLORS.map((item) => <option key={item} value={item}>{MANA_LABELS[item]}</option>)}</select></label>)}</>, false, { manaColors: colors });
  }
  if (special === "banner-command" && mode === "basic") {
    const recruited = state.units.filter((unit) => (state.recruitedUnitIdsThisTurn ?? []).includes(unit.id) && !unit.banner);
    return <details className="special-card-picker"><summary>{modeLabel} · 号令</summary><div><button onClick={() => submit({})}>先获得影响力，招募时自动代替指挥标记</button>{recruited.map((unit) => <button key={unit.id} onClick={() => submit({ unitId: unit.id })}>装备给本回合招募的「{getUnit(unit.id)?.name}」</button>)}</div></details>;
  }
  if (special === "mana-meltdown" || special === "mana-claim") return <button disabled title="单人规则设置时移除这张互动法术">单人不可用</button>;
  return <button onClick={() => submit()}>{modeLabel}</button>;
}

type PendingCardPlay =
  | { kind: "play"; mode: "basic" | "powered" | "sideways"; sideResource?: "move" | "attack" | "block" | "influence"; effectChoice?: number }
  | { kind: "discard" };

export function SelectedCardPanel({ state, dispatch, instanceId }: { state: GameState; dispatch: Dispatch<GameAction>; instanceId?: string }) {
  const [improvisationSelections, setImprovisationSelections] = useState<Record<string, { effectChoice: number; discardInstanceId: string }>>({});
  const [pendingPlay, setPendingPlay] = useState<PendingCardPlay | null>(null);
  if (!instanceId) return <section className="selected-card-panel empty-selected-card"><div className="context-section-title"><span>卡牌操作</span><small>从下方手牌带选择</small></div><div className="selected-card-empty"><i>▤</i><strong>选择一张手牌</strong><p>地图、敌情与资源不会被遮挡；选择卡牌后在这里查看完整效果并确认打出。</p></div></section>;
  const card = getCard(instanceId);
  if (!card) return <section className={`selected-card-panel ${pendingPlay ? "has-pending-play" : ""}`}>
    <div className="context-section-title"><span>伤势牌</span><small>不可作为普通行动打出</small></div>
    <article className="hand-card wound-card selected-card" aria-label="伤势牌">
      <div className="selected-card-copy" tabIndex={0} role="region" aria-label="伤势牌效果说明">
        <div className="card-top"><span>伤势</span><i>✚</i></div><div className="wound-mark">裂</div>
        <p>{state.ritualPainReady ? "痛苦仪式已开启：可将这张伤势横置为 3。" : "使用治疗，或用一次休整把它置入弃牌堆。"}</p>
      </div>
      {state.ritualPainReady && <div className="card-actions">{(["move", "attack", "block", "influence"] as const).map((key) => <button key={key} onClick={() => setPendingPlay({ kind: "play", mode: "sideways", sideResource: key })}>{RESOURCE_LABELS[key]} 3</button>)}</div>}
    </article>
    {pendingPlay?.kind === "play" && <div className="card-resolution-preview" aria-live="polite"><span>待确认</span><strong>横置为 {RESOURCE_LABELS[pendingPlay.sideResource!]} 3</strong><div>
      <button onClick={() => { dispatch({ type: "PLAY_CARD", instanceId, mode: "sideways", sideResource: pendingPlay.sideResource }); setPendingPlay(null); }}>确认打出</button>
      <button onClick={() => setPendingPlay(null)}>取消</button>
    </div></div>}
  </section>;
  const play = state.played.find((item) => item.instanceId === instanceId);
  const isArtifact = card.tier === "artifact";
  const playModeButtons = (mode: "basic" | "powered") => {
    const effect = mode === "powered" ? card.powered : card.basic;
    const modeLabel = mode === "basic" ? (isArtifact ? "保留能力" : "基础") : isArtifact ? "弃除强效" : card.tier === "spell" ? "强效" : "强化";
    if (card.id === "manaDraw" && mode === "powered") return <details className="mana-draw-picker"><summary>{modeLabel} · 选择源泉骰</summary><div>
      {state.source.map((die, manaDrawDieIndex) => <fieldset key={manaDrawDieIndex} disabled={usedSource(state, manaDrawDieIndex)}><legend>{usedSource(state, manaDrawDieIndex) ? "已使用" : `${MANA_LABELS[die.color]}骰 →`}</legend><span>{MANA_DRAW_COLORS.map((manaDrawColor) => <button key={manaDrawColor} className={`mana-${manaDrawColor}`} title={`将这颗骰改为${MANA_LABELS[manaDrawColor]}色并获得 2 枚临时魔力`} onClick={() => dispatch({ type: "PLAY_CARD", instanceId, mode, manaDrawDieIndex, manaDrawColor })}>{MANA_LABELS[manaDrawColor]}</button>)}</span></fieldset>)}
    </div></details>;
    if (card.id === "improvisation" && effect.choices?.length) {
      const selectionKey = `${instanceId}:${mode}`;
      const discardableCards = state.hand.filter((otherId) => otherId !== instanceId && !state.played.some((item) => item.instanceId === otherId) && Boolean(getCard(otherId)));
      const savedSelection = improvisationSelections[selectionKey];
      const effectChoice = savedSelection?.effectChoice ?? 0;
      const discardInstanceId = savedSelection && discardableCards.includes(savedSelection.discardInstanceId) ? savedSelection.discardInstanceId : (discardableCards[0] ?? "");
      const updateSelection = (next: Partial<{ effectChoice: number; discardInstanceId: string }>) => setImprovisationSelections((current) => ({ ...current, [selectionKey]: { effectChoice, discardInstanceId, ...next } }));
      return <details className="improvisation-picker"><summary>{modeLabel} · 选择</summary><div><label><span>获得</span><select aria-label={`${modeLabel}临机应变获得的资源`} value={effectChoice} onChange={(event) => updateSelection({ effectChoice: Number(event.target.value) })}>{effect.choices.map((choice, index) => <option key={choice.label} value={index}>{choice.label}</option>)}</select></label><label><span>弃掉</span><select aria-label={`${modeLabel}临机应变弃掉的牌`} value={discardInstanceId} disabled={!discardableCards.length} onChange={(event) => updateSelection({ discardInstanceId: event.target.value })}>{discardableCards.length ? discardableCards.map((otherId) => <option key={otherId} value={otherId}>{getCard(otherId)?.name}</option>) : <option value="">没有可弃的非伤势牌</option>}</select></label><button disabled={!discardInstanceId} onClick={() => dispatch({ type: "PLAY_CARD", instanceId, mode, effectChoice, discardInstanceId })}>确认打出</button></div></details>;
    }
    if (effect.special) return <SpecialCardPicker state={state} dispatch={dispatch} instanceId={instanceId} mode={mode} modeLabel={modeLabel} effectChoice={effect.choices?.length ? 0 : undefined} />;
    if (!effect.choices?.length) return <button onClick={() => setPendingPlay({ kind: "play", mode })}>{modeLabel}</button>;
    return effect.choices.map((choice, effectChoice) => <button key={`${mode}-${effectChoice}`} className="effect-choice-button" onClick={() => setPendingPlay({ kind: "play", mode, effectChoice })}>{modeLabel} · {choice.label}</button>);
  };
  const playedChoice = play?.mode !== "sideways" ? (play?.mode === "powered" ? card.powered : card.basic).choices?.[play?.effectChoice ?? -1]?.label : undefined;
  const pendingEffect = pendingPlay?.kind === "play" && pendingPlay.mode !== "sideways"
    ? ((pendingPlay.mode === "powered" ? card.powered : card.basic).choices?.[pendingPlay.effectChoice ?? -1]?.effect ?? (pendingPlay.mode === "powered" ? card.powered : card.basic))
    : undefined;
  const previewResources = pendingEffect ? (Object.keys(RESOURCE_LABELS) as ResourceKey[]).filter((key) => (pendingEffect[key] ?? 0) > 0) : [];
  return (
    <section className={`selected-card-panel ${pendingPlay ? "has-pending-play" : ""}`}>
      <div className="context-section-title"><span>卡牌操作</span><small>选择 → 预览 → 确认</small></div>
      <article className={`hand-card selected-card mana-${card.color} ${play ? "played" : ""}`} aria-label={`${card.name}完整卡牌`}>
        <div className="selected-card-copy" tabIndex={0} role="region" aria-label={`${card.name}效果说明`}>
              <div className="card-top"><span>{card.tier === "basic" ? "基础行动" : card.tier === "advanced" ? "进阶行动" : card.tier === "spell" ? "法术" : "圣器"}</span><i>{MANA_LABELS[card.color].slice(0, 1)}</i></div>
              <h3>{card.name}<small>{card.englishName}</small></h3>
              <div className="card-stars" aria-hidden="true">✦ ✦ ✦ ✦ ✦</div>
              <div className={`card-illustration ${cardArtClass(card)}`} style={cardArtStyle(card)} aria-hidden="true" />
              <div className={`card-effect basic-effect ${isArtifact ? "artifact-effect" : ""}`}><small>{isArtifact ? "圣器能力 · 使用后保留" : "基础效果"}</small><strong>{card.basicLabel}</strong></div>
              <div className="card-effect powered-effect"><small>{isArtifact ? "圣器强效 · 使用后移出游戏" : card.tier === "spell" ? `强效 · 夜晚：${MANA_LABELS[card.color]} + 黑` : `强化 · ${MANA_LABELS[card.color]}色`}</small><strong>{card.poweredLabel}</strong></div>
        </div>
              {play ? <button className="unplay" disabled={play.lockedByCombat} title={play.lockedByCombat ? "此出牌已被战斗起点或新信息锁定；尚未锁定的步骤可用逐步撤回" : undefined} onClick={() => dispatch({ type: "UNPLAY_CARD", instanceId })}>已打出：{play.mode === "basic" ? "基础" : play.mode === "powered" ? "强化" : `横置 ${RESOURCE_LABELS[play.sideResource!]}`}{playedChoice ? ` · ${playedChoice}` : ""}{play.discardedInstanceId ? ` · 弃掉「${getCard(play.discardedInstanceId)?.name ?? "行动牌"}」` : ""} · {play.lockedByCombat ? "已锁定" : "撤回"}</button> : (
                <div className="card-actions">
                  {playModeButtons("basic")}
                  {playModeButtons("powered")}
                  <button className="discard-card-action" onClick={() => setPendingPlay({ kind: "discard" })}>弃牌</button>
                  <details className="sideways-picker"><summary>横置 +1</summary><div>{(["move", "attack", "block", "influence"] as const).map((key) => <button key={key} title={`横置为${RESOURCE_LABELS[key]} 1`} aria-label={`横置为${RESOURCE_LABELS[key]} 1`} onClick={() => setPendingPlay({ kind: "play", mode: "sideways", sideResource: key })}><span aria-hidden="true">{RESOURCE_ICONS[key]}</span><small>{RESOURCE_LABELS[key]}</small></button>)}</div></details>
                </div>
              )}
      </article>
      {pendingPlay && <div className="card-resolution-preview" aria-live="polite"><span>待确认</span><strong>{pendingPlay.kind === "discard" ? `弃掉「${card.name}」` : pendingPlay.mode === "sideways" ? `横置为 ${RESOURCE_LABELS[pendingPlay.sideResource!]} 1` : `${pendingPlay.mode === "basic" ? "基础" : "强化"}：${pendingPlay.mode === "basic" ? card.basicLabel : card.poweredLabel}`}</strong>{previewResources.length > 0 && <small>{previewResources.map((key) => `${RESOURCE_LABELS[key]} ${availableResources(state)[key]} → ${availableResources(state)[key] + (pendingEffect?.[key] ?? 0)}`).join(" · ")}</small>}<div><button className="ghost-button" onClick={() => setPendingPlay(null)}>取消</button><button className="primary-button" onClick={() => { if (pendingPlay.kind === "discard") dispatch({ type: "DISCARD_CARD", instanceId }); else dispatch({ type: "PLAY_CARD", instanceId, mode: pendingPlay.mode, sideResource: pendingPlay.sideResource, effectChoice: pendingPlay.effectChoice }); setPendingPlay(null); }}>确认</button></div></div>}
    </section>
  );
}

export function CardHand({ state, selectedCardId, onSelectCard, onOpenWiki }: { state: GameState; selectedCardId?: string; onSelectCard: (instanceId: string) => void; onOpenWiki: () => void }) {
  return <section className="hand-zone" aria-label="玩家手牌区"><div id="player-hand" className="hand-content"><div className="hand-heading"><div><span>你的手牌</span><small>选择后在右侧查看完整效果</small></div><div className="hand-summary"><span>{state.hand.length} 张手牌</span><span>牌库 {state.deck.length}</span></div></div><div className="hand-scroll">{state.hand.map((instanceId) => {
    const card = getCard(instanceId);
    const play = state.played.find((item) => item.instanceId === instanceId);
    const cardType = card ? card.tier === "basic" ? "基础" : card.tier === "advanced" ? "进阶" : card.tier === "spell" ? "法术" : "圣器" : "伤势";
    const playStatus = play ? `已打出 · ${play.mode === "sideways" ? RESOURCE_LABELS[play.sideResource!] : play.mode === "powered" ? "强化" : "基础"}` : cardType;
    const cardDescription = card ? `${card.name}。基础：${card.basicLabel}。强化：${card.poweredLabel}。当前状态：${playStatus}。点击选择；长按或右键打开百科` : "伤势。不可作为普通行动牌打出";
    return <button key={instanceId} type="button" className={`hand-card-tab ${selectedCardId === instanceId ? "selected" : ""} ${play ? "played" : ""} ${card ? `mana-${card.color}` : "wound"}`} aria-label={cardDescription} aria-pressed={selectedCardId === instanceId} onClick={() => onSelectCard(instanceId)} onContextMenu={(event) => { event.preventDefault(); onSelectCard(instanceId); onOpenWiki(); }} title={cardDescription}>
      {card ? <i className={`hand-card-tab-art ${cardArtClass(card)}`} style={cardArtStyle(card)} aria-hidden="true" /> : <i className="hand-card-tab-art wound-tab-art" aria-hidden="true">✚</i>}
      <span className="hand-card-tab-copy"><small>{playStatus}</small><strong>{card?.name ?? "伤势"}</strong>{card ? <><span className="hand-card-tab-effect basic"><small>基</small><b>{card.basicLabel}</b></span><span className="hand-card-tab-effect powered"><small>强</small><b>{card.poweredLabel}</b></span></> : <span className="hand-card-tab-effect wound"><b>不可作为普通行动牌打出</b></span>}</span>
      <em>{card ? MANA_LABELS[card.color].slice(0, 1) : "✚"}</em>
      {card && <span className={`hand-card-hover-preview mana-${card.color}`} aria-hidden="true"><i className={`hand-card-hover-art ${cardArtClass(card)}`} style={cardArtStyle(card)} /><span><small>{cardType}{play ? ` · ${playStatus}` : ""}</small><strong>{card.name}<i>{card.englishName}</i></strong><span className="basic"><em>基础</em><b>{card.basicLabel}</b></span><span className="powered"><em>强化</em><b>{card.poweredLabel}</b></span></span><em>{MANA_LABELS[card.color].slice(0, 1)}</em></span>}
    </button>;
  })}</div></div></section>;
}

function TacticModal({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const tactics = availableTactics(state);
  return (
    <div className="modal-backdrop">
      <section className="tactic-modal">
        <p className="eyebrow">第 {state.round} 轮 · {state.time === "day" ? "白昼" : "夜晚"}</p>
        <h2>选择战术</h2>
        <p>你总是先选；虚拟玩家随后从剩余战术中随机拿取一张。数字越小，行动越早。</p>
        <div className="tactic-grid">
          {tactics.map((tactic) => <button key={tactic.id} onClick={() => dispatch({ type: "CHOOSE_TACTIC", tacticId: tactic.id })}>
            <i className="tactic-art basic-card-art" style={tacticArtStyle(tactic.id)}><b>{tactic.order}</b></i><span><strong>{tactic.name}</strong><small>{tactic.text}</small></span><em>选择</em>
          </button>)}
        </div>
        <div className="modal-rule">每张昼/夜战术在整局游戏中只会出现一次。第六号战术会减慢虚拟玩家下一次推进。当前远征沿用开局确认的起始板块与洗牌种子，未翻开的板块仍保持未知。</div>
      </section>
    </div>
  );
}

function SkillModal({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const hero = ALL_HEROES.find((item) => item.id === state.heroId) ?? ALL_HEROES[0];
  const choices = state.pendingSkillChoices.map(getSkill).filter(Boolean);
  const advancedChoices = state.pendingAdvancedChoices ?? [];
  const choosingSkill = choices.length > 0;
  return (
    <div className="modal-backdrop">
      <section className="skill-modal">
        <div className="skill-hero-art hero-sprite" style={heroArtStyle(hero.id)} aria-hidden="true" />
        <div>
          <p className="eyebrow">等级 {levelFor(state.fame)} · 英雄成长</p>
          <h2>{choosingSkill ? "选择一项专属技能" : "选择一张进阶行动"}</h2>
          <p>{choosingSkill ? "这项能力会永久生效；选择后还会获得一张进阶行动。" : "升级同时奖励 1 张公开的进阶行动，并立即置于你的牌库顶。"}</p>
        </div>
        <div className={`skill-choices ${choosingSkill ? "" : "advanced-level-choices"}`}>
          {choices.map((skill) => skill && <button key={skill.id} onClick={() => dispatch({ type: "CHOOSE_SKILL", skillId: skill.id })}>
            <i>✦</i><span><strong>{skill.name}</strong><small>{skill.description}</small></span><em>掌握</em>
          </button>)}
          {!choosingSkill && advancedChoices.map((id) => {
            const card = ALL_CARD_DEFS[id];
            return <button key={id} onClick={() => dispatch({ type: "CHOOSE_LEVEL_ADVANCED", cardId: id })}>
              <i className={`mini-card-art ${cardArtClass(card)}`} style={cardArtStyle(card)} /><span><strong>{card.name}</strong><small>{card.basicLabel} · {card.poweredLabel}</small></span><em>获得</em>
            </button>;
          })}
        </div>
      </section>
    </div>
  );
}

function GameOverModal({ state, onReset }: { state: GameState; onReset: () => void }) {
  const score = scoreGame(state);
  return (
    <div className="modal-backdrop gameover-backdrop">
      <section className={`gameover-modal ${state.result}`}>
        <p className="eyebrow">远征结算</p>
        <div className="result-seal">{state.result === "victory" ? "胜" : "败"}</div>
        <h2>{state.result === "victory" ? "两城皆落，征服完成" : "三昼三夜已经耗尽"}</h2>
        <p>{state.result === "victory" ? "议会将传颂这次远征，但真正的衡量仍在最终名望。" : `你攻克了 ${state.conqueredCities}/2 座城市。保留这次得分，下一局尝试更快构筑牌组。`}</p>
        <div className="score-total"><small>最终得分</small><strong>{score.total}</strong></div>
        <div className="score-grid">
          <div><span>基础名望</span><strong>{score.fame}</strong></div><div><span>冒险地点</span><strong>+{score.adventure}</strong></div>
          <div><span>据点征服</span><strong>+{score.conquest}</strong></div><div><span>圣器</span><strong>+{score.artifacts}</strong></div>
          {state.contentMode === "ultimate" && <div><span>未使用派系标记</span><strong>+{score.factions}</strong></div>}
          <div><span>知识</span><strong>+{score.knowledge}</strong></div><div><span>领导力</span><strong>+{score.leadership}</strong></div>
          <div><span>水晶</span><strong>+{score.crystals}</strong></div><div><span>伤势</span><strong>{score.wounds}</strong></div>
          <div><span>城市目标</span><strong>+{score.cities}</strong></div><div><span>提前完成</span><strong>+{score.early}</strong></div>
          <div><span>虚拟玩家余牌</span><strong>+{score.dummy}</strong></div><div><span>未宣告本轮结束</span><strong>+{score.unannounced}</strong></div>
        </div>
        <button className="primary-button large" onClick={onReset}>开始新的远征</button>
      </section>
    </div>
  );
}

function RulesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <div className="drawer-backdrop" onClick={onClose}><aside className="rules-drawer" onClick={(event) => event.stopPropagation()}>
    <button className="drawer-close" onClick={onClose}>×</button>
    <p className="eyebrow">快速规则</p><h2>如何进行一回合</h2>
    <ol className="rules-steps">
      <li><i>1</i><div><strong>规划</strong><p>从手牌选择基础效果、花对应颜色魔力使用强化效果，或将牌横置为移动/攻击/格挡/影响力 1。</p></div></li>
      <li><i>2</i><div><strong>移动与探索</strong><p>走到已拼板块边缘后，花 2 移动翻开牌库顶的整块七格板块，并以固定方向合法拼接；英雄不会因探索而移动。已揭示格按地形支付移动。</p></div></li>
      <li><i>3</i><div><strong>执行一个行动</strong><p>与当地人互动，或宣布进入冒险地点战斗。防御工事会在进入格子时强制开战；遗迹和巢穴则可以忽略。</p></div></li>
      <li><i>4</i><div><strong>结束回合</strong><p>可以先弃掉任意非伤势牌；已打出的牌进入弃牌堆，补牌至手牌上限，然后虚拟玩家推进计时。</p></div></li>
    </ol>
    <h3>战斗顺序</h3>
    <div className="rule-flow"><span>远程 / 攻城</span><b>→</b><span>格挡</span><b>→</b><span>承伤</span><b>→</b><span>近战</span></div>
    <p className="drawer-copy">物理、火焰、寒冰、冷热火分别结算。敌人的对应抗性令该类攻击减半；火焰要用寒冰/冷热火格挡，寒冰要用火焰/冷热火格挡，冷热火只能用冷热火格挡，其他格挡减半。若不能完整格挡，可让盟军承伤：匹配抗性能先以护甲无伤吸收一次。迅捷使格挡需求翻倍，残暴使伤害翻倍；中毒、麻痹和召唤均会按牌面在承伤/攻击阶段自动处理。</p>
    <h3>“或”效果与结算时点</h3>
    <p className="drawer-copy">牌面写“或”的效果必须在打出时选择一个分支，不能同时获得；界面会为每个分支显示独立按钮。移动、影响力和治疗点可以在当前回合暂存，但开始战斗时所有尚未使用的治疗点立即丢失，且战斗中不能使用治疗。攻击与格挡不能预先储存，只能在对应战斗步骤产生并用于当次结算。因此一张同时提供攻击与治疗的牌，不能先贡献攻击，再在战斗结束后取回它的治疗效果。</p>
    <h3>盟军能力与魔力</h3>
    <p className="drawer-copy">盟军不是一张固定资源牌：每轮发动一次时，要从牌面横线分隔的能力中选择一项。能力前若带有颜色符号，必须支付对应魔力；系统会依次使用本回合临时魔力、源泉或水晶。临时魔力在回合结束时消失，水晶会保留。中毒盟军有两张伤势，必须治疗两次。</p>
    <h3>单人征服目标</h3>
    <p className="drawer-copy">在第六轮结束前攻克地图上的两座城市。攻克第二座城市后，你会获得最后一个完整回合。虚拟玩家的牌库耗尽会宣告本轮终局，你再行动一次后昼夜切换。</p>
    <h3>英雄技能</h3>
    <p className="drawer-copy">名望等级遵循规则板阈值：0 / 3 / 8 / 15 / 24 / 35 / 48 / 63 / 80 / 99。英雄达到偶数等级时，会从两项专属技能中选择一项，并从公开供应获得 1 张进阶行动；奇数等级会更新等级标记并增加指挥位。顶部会持续显示距离下一等级还差多少名望。</p>
    <h3>声誉与公开标记</h3>
    <p className="drawer-copy">顶部同时显示声誉轨位与它当前提供的影响力修正；轨位到 X 时无法与居民互动。兽人和巨龙是游荡敌人，地图地形揭示时就正面公开，英雄不能进入其所在格；在相邻格可把挑战作为本回合行动，从一个相邻格移动到另一个相邻格则会激怒它并强制开战。要塞与法师塔守军在白昼相邻时翻开，夜晚则到强攻时才翻开；遗迹黄色标记白昼公开，夜晚要进入遗迹或等到下一个白昼才公开。</p>
    <h3>反悔与回退</h3>
    <p className="drawer-copy">规则允许你在本回合内撤回尚未产生新信息的选择。普通移动、出牌、确定性资源支付、盟军发动与不刷新供应的招募可用“撤回”或 ⌘/Ctrl + Z 逐步回退。战斗内也一样：跳过远程进入格挡、格挡、分配伤害、攻击和撤退，只要没有公开新信息，都可逐步回退；资源、伤势、敌人和队列会一起恢复。召唤新敌人、抽牌、公开新奖励/供应牌、随机升级或掷骰会锁定此前选择。锁定后新做的确定性操作仍可撤回，但不能越过该信息边界；结束回合或载入存档前的历史不能恢复。</p>
    <h3>遗迹奖励</h3>
    <p className="drawer-copy">古代遗迹会从基础版 12 枚黄色标记中随机抽取：四色祭坛需要支付 3 份对应魔力并获得 7 名望，其余标记会组合两枚敌人并给出圣器、法术、进阶行动或水晶奖励。获得的圣器置于牌库顶；使用强效后会移出游戏。</p>
    <h3>公共供应区</h3>
    <p className="drawer-copy">盟军、进阶行动和法术供应始终公开，可以提前规划路线。只有实际招募或学习需要位于对应地点并支付影响力；同一次互动可以买多项，声誉修正只应用一次。新学会的牌与升级奖励都置于牌库顶。揭示修道院时，会将一张进阶行动加入盟军供应区；该牌被学习后要等下一轮才会补充。</p>
    <h3>紧凑界面</h3>
    <p className="drawer-copy">桌面界面采用统一战术工作台：地图、当前地点或敌军、选中卡牌、本回合资源、撤销和结束回合始终处于同一屏幕。底部手牌只显示紧凑摘要，点击后在右侧查看完整卡面；英雄、地点操作、公共供应和记录属于低频信息，通过最右侧工具栏临时打开。点击“地图专注”或按 F 可暂时收起战术情报栏，再按 F 或 Esc 返回。地图可用鼠标滚轮或触控板手势缩放、按住拖动，也可聚焦后使用方向键平移、Home 键复位。</p>
    <p className="drawer-copy">Android 版固定为横屏单屏战术桌，不需要上下滑动整张网页，也不再用手牌/资源 Tab 替换地图。地图和怪物信息始终在左侧，完整卡牌与实时结算位于右侧，紧凑手牌带固定在底部；长按卡牌或地图元素可打开百科。只有英雄、盟军、地点详细行动、供应区和日志会作为临时抽屉出现。</p>
    <h3>随机地图与地形</h3>
    <p className="drawer-copy">地图由实体版基础游戏的七格大板块组成。每块板上的地形、地点与相对位置固定；随机性只来自乡野/核心板块的抽取与洗牌。单人征服选 7 块乡野、2 块非城市核心和 2 块城市核心，开局只公开起始板块与相邻乡野板块。探索时翻开牌库顶的整块板，不会逐格随机地形；核心板块还必须与至少两块已放置板块相邻。</p>
    <h3>本地版范围</h3>
    <p className="drawer-copy">当前组件范围严格限定为基础游戏：4 名英雄各 16 张起始牌、28 张进阶行动、20 张法术、16 张圣器、40 张盟军、40 枚技能、60 枚敌人与 12 枚遗迹标记。城市和繁殖地会摆放多枚独立守军；基础版元素战斗、盟军分支能力及敌人战斗特性会逐项结算。暂不包含扩展和多人规则。</p>
  </aside></div>;
}

function MissionPanel({ state }: { state: GameState }) {
  const artifactNames = (state.artifactInventory ?? []).join("、");
  return <section className="mission-strip">
    <div><p className="eyebrow">议会任务</p><strong>征服两座城市</strong></div>
    <div className="mission-metrics"><span><b>{state.conqueredCities}</b>/2 城市</span><span><b>{state.mapTiles.length}</b>/12 板块</span><span><b>{state.tileDeck.length}</b> 待探索</span><span><b>{state.conqueredSites}</b> 战绩</span>{state.contentMode === "ultimate" && <span title="Shades of Tezla 派系战利品"><b>{(state.factionTokens?.elementalists ?? 0) + (state.factionTokens?.["dark-crusaders"] ?? 0)}</b> 派系标记</span>}<span className={state.artifacts ? "loot-owned" : ""} title={artifactNames || "尚未获得圣器"}><b>{state.artifacts}</b> 圣器{state.artifacts > 0 && <small>{state.artifactInventory.at(-1)}</small>}</span></div>
    <div className="mission-progress"><i style={{ width: `${state.conqueredCities * 50}%` }} /></div>
  </section>;
}

function EventLog({ state }: { state: GameState }) {
  return <section className="panel log-panel"><div className="panel-title"><span>远征记录</span><small>最近事件</small></div><div className="log-list">{state.log.slice(0, 5).map((line, index) => <p key={`${line}-${index}`} className={index === 0 ? "latest" : ""}><i>{index === 0 ? "›" : "·"}</i>{line}</p>)}</div></section>;
}

function TacticalContextSummary({ state, inspectedCellId, onOpenSite }: { state: GameState; inspectedCellId: string; onOpenSite: () => void }) {
  const current = state.map.find((cell) => cell.id === state.position);
  const cell = state.map.find((candidate) => candidate.id === inspectedCellId) ?? current;
  if (!cell || !current) return null;
  const enemies = enemiesOnCell(cell);
  const help = SITE_HELP[cell.site];
  const status = cell.id === current.id ? "当前位置" : isAdjacent(current, cell) ? "相邻区域" : "地图情报";
  return <section className="tactical-summary">
    <div className="context-section-title"><span>{status}</span><small>{TERRAIN_LABELS[cell.terrain]} · 移动 {terrainMoveLabel(cell.terrain, state.time)}</small></div>
    <div className="tactical-summary-identity">
      {hasSiteArt(cell) ? <i className="site-model-sprite" style={siteArtStyle(cell.site, cell.terrain)} aria-hidden="true" /> : enemies[0] && cell.tokenRevealed ? <i className="enemy-sprite" style={enemyArtStyle(enemies[0])} aria-hidden="true" /> : <i className={`terrain-preview terrain-preview-${cell.terrain}`}>{SITE_ICONS[cell.site] || TERRAIN_GLYPHS[cell.terrain]}</i>}
      <div><strong>{publicCellIntel(cell,state.difficulty).name}</strong><p>{help.summary}</p><MapPublicIntel cell={cell} difficulty={state.difficulty} /></div>
      <button onClick={onOpenSite}>地点行动</button>
    </div>
    {cell.enemy && !cell.conquered && <div className={`tactical-enemy-stack ${cell.tokenRevealed ? "" : "hidden"}`}>{cell.tokenRevealed ? enemies.map((enemy) => <EnemyMapIntel key={enemy.id} enemy={enemy} />) : <p>标记尚未公开；界面只会显示当前规则允许玩家知道的信息。</p>}</div>}
  </section>;
}

function MapPublicIntel({cell,difficulty}: {cell:MapCell;difficulty:GameState["difficulty"]}) {
  const badges=publicCellIntel(cell,difficulty).badges.filter((badge)=>badge.kind!=="enemy");
  if (!badges.length) return null;
  return <div className="map-public-intel" aria-label="地点公开信息">{badges.map((badge)=><span key={badge.kind} className={`map-intel-${badge.kind}`}>
    {Boolean(badge.colors?.length) && <i className="map-intel-swatches" aria-hidden="true">{badge.colors!.map((color)=><i key={color} style={{backgroundColor:MAP_MANA_COLORS[color]}} />)}</i>}{badge.text}
  </span>)}</div>;
}

type UtilityPanel = "hero" | "site" | "market" | "log" | null;

function UtilityCommandRail({ state, activePanel, onSelect }: { state: GameState; activePanel: UtilityPanel; onSelect: (panel: Exclude<UtilityPanel, null>) => void }) {
  const current = state.map.find((cell) => cell.id === state.position);
  const items: Array<{ id: Exclude<UtilityPanel, null>; icon: string; label: string; badge?: string; controls: string }> = [
    { id: "hero", icon: "♞", label: "英雄", badge: String(levelFor(state.fame)), controls: "utility-drawer" },
    { id: "site", icon: SITE_ICONS[current?.site ?? "none"] || "◇", label: "地点", controls: "utility-drawer" },
    { id: "market", icon: "◇", label: "供应", badge: String(state.unitOffer.length + state.advancedOffer.length + state.spellOffer.length), controls: "utility-drawer" },
    { id: "log", icon: "≡", label: "记录", controls: "utility-drawer" },
  ];
  return (
    <nav className="utility-command-rail" aria-label="次要信息工具栏">
      {items.map((item) => {
        const selected = activePanel === item.id;
        return <button key={item.id} type="button" className={selected ? "active" : ""} aria-pressed={selected} aria-controls={item.controls} onClick={() => onSelect(item.id)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>;
      })}
    </nav>
  );
}

function UtilityDrawer({ state, dispatch, panel, onClose }: { state: GameState; dispatch: Dispatch<GameAction>; panel: UtilityPanel; onClose: () => void }) {
  if (!panel) return null;
  return <aside id="utility-drawer" className={`utility-drawer utility-${panel}`} aria-label="次要信息面板"><div className="utility-drawer-heading"><strong>{panel === "hero" ? "英雄、魔力与盟军" : panel === "site" ? "地点行动" : panel === "market" ? "公共供应" : "远征记录"}</strong><button onClick={onClose} aria-label="关闭面板">×</button></div><div className="utility-drawer-scroll">
    {panel === "hero" && <><ManaSource state={state} /><HeroSkillPanel state={state} dispatch={dispatch} /><UnitPanel state={state} dispatch={dispatch} /><DummyTimer state={state} /></>}
    {panel === "site" && <SitePanel state={state} dispatch={dispatch} />}
    {panel === "market" && <PublicOffersPanel state={state} dispatch={dispatch} />}
    {panel === "log" && <EventLog state={state} />}
  </div></aside>;
}

function CinematicFeedback({ feedback }: { feedback: { id: number; kind: GameFeedbackKind } | null }) {
  if (!feedback) return null;
  return <div key={feedback.id} className={`cinematic-fx fx-${feedback.kind}`} aria-hidden="true"><span className="fx-wave" />{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--particle": index } as CSSProperties} />)}</div>;
}

export default function Game() {
  const [session, setSession] = useState<RevertHistoryState | null>(null);
  const [savedState, setSavedState] = useState<GameState | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [mapFocus, setMapFocus] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<UtilityPanel>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>();
  const [inspectedCellId, setInspectedCellId] = useState("");
  const [visualFeedback, setVisualFeedback] = useState<{ id: number; kind: GameFeedbackKind } | null>(null);
  const feedbackId = useRef(0);
  const { enabled: soundEnabled, setEnabled: setSoundEnabled, play: playSound } = useGameAudio();
  const activeState = session?.present ?? null;
  // A pending map-focus preference must never hide a newly triggered combat.
  const effectiveMapFocus = mapFocus && !activeState?.combat;
  const handleInspectCell = useCallback((cellId: string) => setInspectedCellId(cellId), []);
  const triggerFeedback = useCallback((kind: GameFeedbackKind) => {
    feedbackId.current += 1;
    setVisualFeedback({ id: feedbackId.current, kind });
    playSound(kind);
  }, [playSound]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Omit<GameState, "version" | "contentMode" | "factionTokens"> & { version: number; contentMode?: ContentMode; factionTokens?: GameState["factionTokens"] };
        if (parsed.version === 2 || parsed.version === 3 || parsed.version === 4) {
          const contentMode = parsed.contentMode ?? "base";
          const current = parsed.map.find((cell) => cell.id === parsed.position);
          const normalizedMap = parsed.map.map((cell) => {
            if (typeof cell.tokenRevealed === "boolean") return { ...cell, enemies: cell.enemies ?? (cell.enemy ? [cell.enemy] : []) };
            const rampaging = cell.revealed && (cell.site === "rampager" || cell.site === "dragon");
            const visibleRuin = cell.revealed && cell.site === "ruins" && (parsed.time === "day" || cell.id === parsed.position);
            const visibleFortification = cell.revealed && (cell.site === "keep" || cell.site === "mageTower") && Boolean(current && ((parsed.time === "day" && isAdjacent(current, cell)) || cell.id === parsed.position));
            return { ...cell, enemies: cell.enemies ?? (cell.enemy ? [cell.enemy] : []), tokenRevealed: rampaging || visibleRuin || visibleFortification || cell.id === parsed.position, ruinsReward: cell.site === "ruins" ? "artifact" as const : cell.ruinsReward };
          });
          const legacyArtifacts = Array.from({ length: parsed.artifacts ?? 0 }, (_, index) => `旧存档遗物 ${index + 1}`);
          const normalizedBase: GameState = {
            ...parsed,
            version: 4,
            contentMode,
            map: normalizedMap,
            skills: parsed.skills ?? [],
            pendingSkillChoices: parsed.pendingSkillChoices ?? [],
            pendingAdvancedChoices: parsed.pendingAdvancedChoices ?? [],
            pendingLevelRewards: parsed.pendingLevelRewards ?? 0,
            monasteryOffer: parsed.monasteryOffer ?? [],
            marketManaUses: parsed.marketManaUses ?? [],
            unitManaUses: parsed.unitManaUses ?? [],
            manaTokens: { red: parsed.manaTokens?.red ?? 0, blue: parsed.manaTokens?.blue ?? 0, green: parsed.manaTokens?.green ?? 0, white: parsed.manaTokens?.white ?? 0, black: parsed.manaTokens?.black ?? 0 },
            allUnitResistances: parsed.allUnitResistances ?? false,
            terrainDiscounts: parsed.terrainDiscounts ?? [],
            units: (parsed.units ?? []).map((unit) => ({ ...unit, wounds: unit.wounds ?? (unit.wounded ? 1 : 0), selectedAbilityId: unit.selectedAbilityId })),
            artifactInventory: parsed.artifactInventory ?? legacyArtifacts,
            artifactDeck: parsed.artifactDeck ?? [...getArtifactIdsForMode(contentMode)],
            removedCards: parsed.removedCards ?? [],
            woundDeck: parsed.woundDeck ?? getWoundIdsForMode(contentMode).filter((id) => ![...parsed.hand, ...parsed.deck, ...parsed.discard].includes(id)),
            regularUnitDeck: parsed.regularUnitDeck ?? [...getRegularUnitIdsForMode(contentMode)],
            eliteUnitDeck: parsed.eliteUnitDeck ?? [...getEliteUnitIdsForMode(contentMode)],
            enemyDecks: parsed.enemyDecks ?? Object.fromEntries(Object.entries(getEnemyTokenIdsForMode(contentMode)).map(([color, ids]) => [color, [...ids]])) as GameState["enemyDecks"],
            enemyDiscards: parsed.enemyDiscards ?? { green: [], red: [], gray: [], violet: [], brown: [], white: [] },
            ruinDeck: parsed.ruinDeck ?? getRuinTokensForMode(contentMode).map((token) => token.id),
            ruinDiscards: parsed.ruinDiscards ?? [],
            factionTokens: parsed.factionTokens ?? { elementalists: 0, "dark-crusaders": 0 },
            interactionModifierUsed: parsed.interactionModifierUsed ?? false,
            turnDiscardCount: parsed.turnDiscardCount ?? 0,
            mapVariant: parsed.mapVariant ?? "classic",
            mapShape: parsed.mapShape ?? "wedge",
            mapTiles: parsed.mapTiles ?? [],
            tileDeck: parsed.tileDeck ?? [],
            removedMapTiles: parsed.removedMapTiles ?? [],
          };
          const normalized = migrateSiteEnemyLifecycle(normalizedBase);
          window.setTimeout(() => setSavedState(normalized), 0);
        }
      }
    } catch { /* ignore a damaged local save */ }
  }, []);

  useEffect(() => {
    if (activeState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeState));
    }
  }, [activeState]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setSession((current) => current ? revertLastAction(current) : current);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "w") {
        event.preventDefault();
        setWikiOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        setMapFocus((focused) => !focused);
        return;
      }
      if (event.key === "Escape") {
        setUtilityPanel(null);
        setMapFocus(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const wrappedDispatch = (action: GameAction) => {
    const feedbackRun = { done: false };
    setSession((current) => {
      if (!current) return current;
      const next = applyGameActionWithRevert(current, action);
      if (!feedbackRun.done && next.present !== current.present) {
        feedbackRun.done = true;
        const kind = feedbackForAction(action, current.present, next.present);
        window.queueMicrotask(() => triggerFeedback(kind));
      }
      return next;
    });
  };

  const startGame = (hero: string, difficulty: GameState["difficulty"], mapVariant: MapVariant, mapShape: MapShape, seed: number, contentMode: ContentMode) => {
    const next = createGame(hero, difficulty, mapVariant, mapShape, seed, contentMode);
    setSession(createRevertHistory(next));
    setUtilityPanel(null);
    setSelectedCardId(next.hand.find((id) => Boolean(getCard(id))) ?? next.hand[0]);
    setInspectedCellId(next.position);
    setShowIntro(true);
    triggerFeedback("turn");
  };

  const reset = () => {
    if (activeState && activeState.phase !== "gameover" && !window.confirm("当前远征会被覆盖。确定要重新开始吗？")) return;
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setSavedState(null);
    setUtilityPanel(null);
    setSelectedCardId(undefined);
    setInspectedCellId("");
  };

  if (!activeState) return <>
    <SetupScreen saved={Boolean(savedState)} onStart={startGame} onContinue={() => { if (savedState) { setSession(createRevertHistory(savedState, "已载入本地存档；载入点之前的操作不能回退。")); setUtilityPanel(null); setSelectedCardId(savedState.hand.find((id) => Boolean(getCard(id))) ?? savedState.hand[0]); setInspectedCellId(savedState.position); } }} onWiki={() => setWikiOpen(true)} />
    <WikiOverlay open={wikiOpen} onClose={() => setWikiOpen(false)} />
  </>;

  const activeInspectedCellId = activeState.map.some((cell) => cell.id === inspectedCellId) ? inspectedCellId : activeState.position;
  const activeSelectedCardId = selectedCardId && activeState.hand.includes(selectedCardId) ? selectedCardId : (activeState.hand.find((id) => Boolean(getCard(id))) ?? activeState.hand[0]);

  return (
    <main className={`game-shell ${effectiveMapFocus ? "map-focus" : ""} ${utilityPanel ? "utility-open" : ""}`} data-utility-panel={utilityPanel ?? "none"}>
      <CinematicFeedback feedback={visualFeedback} />
      <TopBar state={activeState} soundEnabled={soundEnabled} onToggleSound={() => setSoundEnabled(!soundEnabled)} onHelp={() => setRulesOpen(true)} onWiki={() => setWikiOpen(true)} onReset={reset} />
      <MissionPanel state={activeState} />
      <div className="game-layout">
        <section className={`center-stage ${activeState.combat ? "in-combat" : ""}`}>
          <div className="tactical-board"><MapBoard state={activeState} dispatch={wrappedDispatch} mapFocus={effectiveMapFocus} onToggleMapFocus={() => setMapFocus((focused) => !focused)} onInspectCell={handleInspectCell} onOpenWiki={() => setWikiOpen(true)} /></div>
          <aside className="tactical-context" aria-label="战术情报与卡牌操作">
            {activeState.combat ? <CombatPanel state={activeState} dispatch={wrappedDispatch} /> : <TacticalContextSummary state={activeState} inspectedCellId={activeInspectedCellId} onOpenSite={() => setUtilityPanel("site")} />}
            <SelectedCardPanel key={activeSelectedCardId ?? "empty"} state={activeState} dispatch={wrappedDispatch} instanceId={activeSelectedCardId} />
            <div className="persistent-resource-panel"><ResourceBar state={activeState} dispatch={wrappedDispatch} /></div>
            <TurnPanel state={activeState} dispatch={wrappedDispatch} revertHistory={session!} onRevert={() => { setSession((current) => current ? revertLastAction(current) : current); triggerFeedback("ui"); }} />
          </aside>
        </section>
        <UtilityCommandRail state={activeState} activePanel={utilityPanel} onSelect={(panel) => setUtilityPanel((current) => current === panel ? null : panel)} />
        <UtilityDrawer state={activeState} dispatch={wrappedDispatch} panel={utilityPanel} onClose={() => setUtilityPanel(null)} />
      </div>
      <div className="persistent-hand-panel"><CardHand state={activeState} selectedCardId={activeSelectedCardId} onSelectCard={(instanceId) => { setSelectedCardId(instanceId); playSound("ui"); }} onOpenWiki={() => setWikiOpen(true)} /></div>
      {activeState.phase === "tactic" && <TacticModal state={activeState} dispatch={wrappedDispatch} />}
      {activeState.phase === "skill" && <SkillModal state={activeState} dispatch={wrappedDispatch} />}
      {activeState.phase === "gameover" && <GameOverModal state={activeState} onReset={reset} />}
      <RulesDrawer open={rulesOpen || showIntro} onClose={() => { setRulesOpen(false); setShowIntro(false); }} />
      <WikiOverlay open={wikiOpen} onClose={() => setWikiOpen(false)} contentMode={activeState.contentMode} />
    </main>
  );
}
