import catalog from "./realistic-model-catalog.json";

export type RealisticAsset = {
  name: string; author: string; license: string; source: string; licenseUrl: string;
  height: number; width: number; fileBase?: string; species?: string; gender?: string;
  role?: string; sourceBase?: string; modifications?: string;
  tint?: string; tintMaterials?: string; tintMode?: "multiply" | "replace"; sharedWith?: string;
};
const cc0 = "https://creativecommons.org/publicdomain/zero/1.0/";
export const REALISTIC_ASSETS: Record<string, RealisticAsset> = {
  "armored-knight": { name: "盔甲骑士 · 托瓦克", author: "piacenti", license: "CC-BY-3.0", source: "https://opengameart.org/content/knight-2", licenseUrl: "https://creativecommons.org/licenses/by/3.0/", height: 1.35, width: 1.1, species: "human", gender: "male", role: "knight" },
  "orc-digger": { name: "掘地者 · 兽人战锤", author: 'Guillaume "GuieA_7" Englert', license: "CC-BY-SA-4.0", source: "https://opengameart.org/content/orc-3d", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", height: 1.25, width: 1.15, species: "orc", gender: "male" },
  gatehouse: { name: "中世纪城门 · 要塞", author: "Daniel Andersson", license: "CC0-1.0", source: "https://opengameart.org/content/medieval-gatehouse", licenseUrl: cc0, height: 1.35, width: 1.45 },
  "rocky-ground": { name: "岩草地表 · 平原", author: "Poly Haven / 本项目地表网格", license: "CC0-1.0", source: "https://polyhaven.com/a/rocky_terrain_02", licenseUrl: cc0, height: .25, width: 1.88 },
};
for (const asset of catalog.environments) {
  const terrain = asset.kind === "terrain";
  REALISTIC_ASSETS[asset.id] = { name: asset.label, author: asset.credits.map((credit) => credit.author).join(" / "), license: "CC0-1.0", source: terrain ? "https://polyhaven.com/a/rocky_terrain_02" : "https://opengameart.org/content/medieval-gatehouse", licenseUrl: cc0, height: terrain ? 1.8 : 1.4, width: terrain ? 1.88 : 1.5, modifications: asset.modifications, sourceBase: "original-environment" };
}
for (const asset of catalog.actors) REALISTIC_ASSETS[asset.id] = { ...asset };
for (const asset of catalog.creatures) REALISTIC_ASSETS[asset.id] = { ...asset, height: 1.35, width: 1.3, modifications: `${asset.notes} ${asset.animationStatus}` };
for (const asset of catalog.specials) {
  REALISTIC_ASSETS[asset.id] = { name: asset.label, author: asset.credits.map((row) => row.author).join(" / "), license: asset.license, source: asset.credits.find((row) => row.source.startsWith("https:"))?.source ?? "./models/realistic/CREDITS.txt", licenseUrl: asset.credits.find((row) => row.license === asset.license)?.licenseUrl ?? cc0, height: 1.35, width: 1.45, species: asset.species, modifications: asset.modifications, sourceBase: "original-special" };
}

// Color/elemental families intentionally share anatomy, not independent sculpts.
function variant(id: string, base: string, name: string, tint: string, tintMaterials = ".*") {
  const source = REALISTIC_ASSETS[base];
  if (!source) return; // Incomplete authoring never creates a bogus mapping.
  REALISTIC_ASSETS[id] = { ...source, name, fileBase: source.fileBase ?? base, sharedWith: base, tint, tintMaterials };
}
for (const [id, label, color] of [
  ["fire", "火焰", "#e7a084"], ["ice", "寒冰", "#90cbe8"], ["high", "高等", "#dfc784"], ["swamp", "沼泽", "#94c994"],
  ["storm", "风暴", "#c0b6ed"], ["lava", "熔岩", "#df8768"], ["savage", "蛮荒", "#d2ba83"], ["lightning", "闪电", "#c5dce8"], ["death", "死亡", "#acb1b5"], ["vampiric", "吸血", "#bb8caa"],
]) variant(`dragon-${id}`, "actor-dragon", `${label}巨龙 · 共用龙族网格`, color);
for (const [id, name, color] of [["fire-mage", "火焰法师", "#dfa084"], ["ice-mage", "寒冰法师", "#a5cfeb"], ["freezer", "冻结师", "#9bd2e3"], ["sorcerer", "术士", "#bd9ce3"]]) variant(id, "actor-mage", `${name} · 法杖与长袍`, color, "robe|blue");
for (const [id, label, color] of [["fire-golem", "火焰魔像", "#ea9472"], ["ice-golem", "寒冰魔像", "#99d9eb"], ["guardian-golem", "守护魔像", "#b8beb0"]]) variant(id, "creature-earth-elemental", `${label} · 石质构装体`, color);
for (const [id, label, color] of [["white", "白", "#e6dbc3"], ["green", "绿", "#a6c8a3"], ["blue", "蓝", "#91bbdb"], ["red", "红", "#d49a91"]]) variant(`hero-unit-${id}`, "actor-swordsman", `${label}色英雄 · 共用盔甲战士网格`, color);
variant("fire-catapult", "special-catapult", "火焰投石车", "#d8936e");
variant("ice-catapult", "special-catapult", "寒冰投石车", "#a6d1e3");
variant("ghoul", "creature-zombie", "食尸鬼 · 共用亡者网格", "#adb59a");
variant("vampire", "actor-necromancer", "吸血鬼 · 长袍贵族形态", "#c6a6b6", "robe");
