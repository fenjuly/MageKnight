import { ALL_RUIN_TOKEN_BY_ID, MANA_LABELS, SITE_LABELS, TERRAIN_LABELS, type MapCell, type ManaColor } from "./game-data";
import { cityColorForCell, cityLevel, enemiesOnCell, type GameState } from "./game-engine";

export type CrystalColor = Exclude<ManaColor, "gold" | "black">;
export const MAP_MANA_COLORS: Record<CrystalColor, string> = { red: "#ff9285", blue: "#8bcfff", green: "#9ce5ae", white: "#fff1c7" };
export type MapIntelBadge = { kind: "mine" | "city" | "ruin" | "enemy" | "state"; text: string; colors?: CrystalColor[] };

/** Card/resource changes keep intent; movement, combat and a new turn do not. */
export function mapSelectionContext(state: Pick<GameState, "seed" | "round" | "time" | "phase" | "position" | "dummyDeck" | "actionTaken">) {
  return JSON.stringify([state.seed,state.round,state.time,state.phase,state.position,state.dummyDeck,state.actionTaken]);
}

export function mineColorsForCell(cell: MapCell): CrystalColor[] {
  if (cell.site !== "mine" && cell.site !== "deepMine") return [];
  return [...new Set(cell.site === "deepMine" && cell.mineColors?.length ? cell.mineColors : cell.mineColor ? [cell.mineColor] : [])];
}

/** Material color must match the printed, public marker, not the source GLB. */
export function publicSiteAccent(cell: MapCell): CrystalColor | undefined {
  const colors=mineColorsForCell(cell);
  if (colors.length) return colors.length===1 ? colors[0] : "white";
  if (cell.site==="city1" || cell.site==="city2") return cityColorForCell(cell);
  if (cell.site==="ruins" && cell.tokenRevealed && !cell.conquered) return ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId??""]?.altarColor ?? cell.ruinAltarColor;
}

/** Only public physical information. Never infer or expose hidden token content. */
export function publicCellIntel(cell: MapCell, difficulty: GameState["difficulty"] = "standard") {
  const colors = mineColorsForCell(cell), badges: MapIntelBadge[] = [];
  let name = cell.site === "none" ? TERRAIN_LABELS[cell.terrain] : SITE_LABELS[cell.site];
  if (colors.length) badges.push({ kind: "mine", text: `${cell.site === "deepMine" ? "任选产色" : "产出"}：${colors.map((color) => `${MANA_LABELS[color]}色水晶`).join(" / ")}`, colors });
  if (cell.site === "city1" || cell.site === "city2") {
    const color = cityColorForCell(cell);
    if (color) name = `${MANA_LABELS[color]}色城市`;
    const effects = { white: "守军护甲 +1", blue: "火焰/寒冰攻击 +2，冷热火攻击 +1", red: "物理攻击获得残暴", green: "物理攻击获得中毒" };
    badges.push({ kind: "city", text: `等级 ${cityLevel(cell.site, difficulty)}${color ? ` · ${effects[color]}` : ""}`, colors: color ? [color] : [] });
  }
  if (cell.site === "ruins" && !cell.conquered) {
    const token = cell.tokenRevealed ? ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId ?? ""] : undefined;
    badges.push({ kind: "ruin", text: cell.tokenRevealed && token ? `${token.name}：${token.description}` : "黄色遗迹标记 · 未公开", colors: token?.altarColor ? [token.altarColor] : [] });
  }
  const enemies = enemiesOnCell(cell);
  if (!cell.conquered && enemies.length) badges.push({ kind: "enemy", text: cell.tokenRevealed ? `已公开 ${enemies.length} 枚敌人：${enemies.map((enemy) => enemy.name).join("、")}` : `${enemies.length} 枚敌人标记 · 未公开` });
  if (cell.conquered) badges.push({ kind: "state", text: cell.site === "monastery" ? "已焚毁 · 不再提供服务" : ["ruins", "monsterDen", "spawningGrounds", "dungeon", "tomb", "maze", "labyrinth"].includes(cell.site) ? "✓ 已清理" : "✓ 已征服" });
  return { name, colors, badges, shortMineLabel: colors.length ? `${colors.map((color) => MANA_LABELS[color]).join("/")}晶` : "" };
}
