import type { ComponentSource, ContentMode, ManaColor, SiteType, Terrain } from "./game-data";

export type MapTileKind = "start" | "countryside" | "core-noncity" | "core-city" | "scenario";
export type TileLocal = "nw" | "ne" | "w" | "c" | "e" | "sw" | "se";
export type PhysicalSite = Exclude<SiteType, "city1" | "city2"> | "city";

export interface FixedTileCell {
  local: TileLocal;
  q: number;
  r: number;
  terrain: Terrain;
  site: PhysicalSite;
  mineColor?: Exclude<ManaColor, "gold" | "black">;
  mineColors?: Array<Exclude<ManaColor, "gold" | "black">>;
  wall?: boolean;
}

export interface MapTileTemplate {
  id: string;
  number: string;
  name: string;
  kind: MapTileKind;
  cells: FixedTileCell[];
  source?: ComponentSource;
}

export const TILE_LOCAL_COORDS: Record<TileLocal, { q: number; r: number }> = {
  nw: { q: 0, r: -1 },
  ne: { q: 1, r: -1 },
  w: { q: -1, r: 0 },
  c: { q: 0, r: 0 },
  e: { q: 1, r: 0 },
  sw: { q: -1, r: 1 },
  se: { q: 0, r: 1 },
};

type CellSeed = [TileLocal, Terrain, PhysicalSite?, Exclude<ManaColor, "gold" | "black">?, Array<Exclude<ManaColor, "gold" | "black">>?];

function defineTile(id: string, number: string, name: string, kind: MapTileKind, seeds: CellSeed[]): MapTileTemplate {
  return {
    id,
    number,
    name,
    kind,
    cells: seeds.map(([local, terrain, site = "none", mineColor, mineColors]) => ({
      local,
      ...TILE_LOCAL_COORDS[local],
      terrain,
      site,
      ...(mineColor ? { mineColor } : {}),
      ...(mineColors ? { mineColors } : {}),
    })),
  };
}

// Base-game physical map tiles. Terrain and site positions are intentionally fixed;
// randomness is applied only when tiles are selected and shuffled into the tile deck.
export const MAP_TILE_TEMPLATES: MapTileTemplate[] = [
  defineTile("start-a", "A", "起始板块 A", "start", [
    ["nw", "plains"], ["ne", "forest"], ["w", "lake"], ["c", "portal"],
    ["e", "plains"], ["sw", "lake"], ["se", "lake"],
  ]),
  defineTile("start-b", "B", "起始板块 B", "start", [
    ["nw", "plains"], ["ne", "forest"], ["w", "lake"], ["c", "portal"],
    ["e", "plains"], ["sw", "plains"], ["se", "plains"],
  ]),

  defineTile("countryside-1", "1", "乡野板块 1", "countryside", [
    ["nw", "forest", "rampager"], ["ne", "lake"], ["w", "forest"], ["c", "forest", "glade"],
    ["e", "plains", "village"], ["sw", "plains"], ["se", "plains"],
  ]),
  defineTile("countryside-2", "2", "乡野板块 2", "countryside", [
    ["nw", "hills", "rampager"], ["ne", "forest", "glade"], ["w", "plains"], ["c", "hills"],
    ["e", "plains", "village"], ["sw", "hills", "mine", "green"], ["se", "plains"],
  ]),
  defineTile("countryside-3", "3", "乡野板块 3", "countryside", [
    ["nw", "plains"], ["ne", "hills", "keep"], ["w", "plains"], ["c", "forest"],
    ["e", "hills"], ["sw", "plains", "village"], ["se", "hills", "mine", "white"],
  ]),
  defineTile("countryside-4", "4", "乡野板块 4", "countryside", [
    ["nw", "desert"], ["ne", "desert"], ["w", "hills", "rampager"], ["c", "desert", "mageTower"],
    ["e", "mountain"], ["sw", "plains"], ["se", "plains", "village"],
  ]),
  defineTile("countryside-5", "5", "乡野板块 5", "countryside", [
    ["nw", "forest"], ["ne", "plains", "monastery"], ["w", "forest", "glade"], ["c", "lake"],
    ["e", "plains", "rampager"], ["sw", "forest"], ["se", "hills", "mine", "blue"],
  ]),
  defineTile("countryside-6", "6", "乡野板块 6", "countryside", [
    ["nw", "mountain"], ["ne", "forest"], ["w", "hills", "monsterDen"], ["c", "hills", "mine", "red"],
    ["e", "plains"], ["sw", "hills"], ["se", "forest", "rampager"],
  ]),
  defineTile("countryside-7", "7", "乡野板块 7", "countryside", [
    ["nw", "lake"], ["ne", "forest", "rampager"], ["w", "plains", "monastery"], ["c", "swamp"],
    ["e", "forest", "glade"], ["sw", "plains"], ["se", "plains", "ruins"],
  ]),
  defineTile("countryside-8", "8", "乡野板块 8", "countryside", [
    ["nw", "forest", "glade"], ["ne", "forest", "ruins"], ["w", "forest"], ["c", "swamp", "rampager"],
    ["e", "plains"], ["sw", "swamp"], ["se", "swamp", "village"],
  ]),
  defineTile("countryside-9", "9", "乡野板块 9", "countryside", [
    ["nw", "wasteland", "ruins"], ["ne", "mountain"], ["w", "plains"], ["c", "mountain"],
    ["e", "wasteland", "keep"], ["sw", "wasteland", "mageTower"], ["se", "plains"],
  ]),
  defineTile("countryside-10", "10", "乡野板块 10", "countryside", [
    ["nw", "hills", "monsterDen"], ["ne", "forest"], ["w", "hills"], ["c", "mountain"],
    ["e", "plains"], ["sw", "hills", "keep"], ["se", "hills", "ruins"],
  ]),
  defineTile("countryside-11", "11", "乡野板块 11", "countryside", [
    ["nw", "hills"], ["ne", "lake"], ["w", "plains", "ruins"], ["c", "plains", "mageTower"],
    ["e", "lake"], ["sw", "lake"], ["se", "hills", "rampager"],
  ]),

  defineTile("core-1", "1*", "非城市核心板块 1", "core-noncity", [
    ["nw", "mountain"], ["ne", "desert", "dungeon"], ["w", "hills", "spawningGrounds"], ["c", "desert", "monastery"],
    ["e", "desert"], ["sw", "hills"], ["se", "desert"],
  ]),
  defineTile("core-2", "2*", "非城市核心板块 2", "core-noncity", [
    ["nw", "lake"], ["ne", "swamp", "ruins"], ["w", "forest"], ["c", "lake"],
    ["e", "hills", "mine", "green"], ["sw", "swamp", "mageTower"], ["se", "swamp", "dragon"],
  ]),
  defineTile("core-3", "3*", "非城市核心板块 3", "core-noncity", [
    ["nw", "mountain"], ["ne", "wasteland", "ruins"], ["w", "wasteland", "tomb"], ["c", "wasteland", "dungeon"],
    ["e", "hills", "mageTower"], ["sw", "hills", "mine", "white"], ["se", "wasteland"],
  ]),
  defineTile("core-4", "4*", "非城市核心板块 4", "core-noncity", [
    ["nw", "hills", "mine", "blue"], ["ne", "hills"], ["w", "wasteland"], ["c", "mountain", "dragon"],
    ["e", "wasteland", "keep"], ["sw", "wasteland", "ruins"], ["se", "wasteland"],
  ]),
  defineTile("core-5", "5*", "绿色城市核心板块", "core-city", [
    ["nw", "forest", "glade"], ["ne", "swamp", "village"], ["w", "lake"], ["c", "city", "city"],
    ["e", "swamp", "rampager"], ["sw", "forest", "rampager"], ["se", "swamp"],
  ]),
  defineTile("core-6", "6*", "蓝色城市核心板块", "core-city", [
    ["nw", "forest"], ["ne", "plains", "monastery"], ["w", "mountain", "dragon"], ["c", "city", "city"],
    ["e", "lake"], ["sw", "hills"], ["se", "lake"],
  ]),
  defineTile("core-7", "7*", "白色城市核心板块", "core-city", [
    ["nw", "wasteland", "spawningGrounds"], ["ne", "plains"], ["w", "wasteland", "keep"], ["c", "city", "city"],
    ["e", "forest"], ["sw", "lake"], ["se", "lake", "dragon"],
  ]),
  defineTile("core-8", "8*", "红色城市核心板块", "core-city", [
    ["nw", "desert", "ruins"], ["ne", "hills", "mine", "red"], ["w", "wasteland", "dragon"], ["c", "city", "city"],
    ["e", "desert"], ["sw", "wasteland"], ["se", "desert", "dragon"],
  ]),
];

export const EXPANSION_MAP_TILE_TEMPLATES: MapTileTemplate[] = [
  { ...defineTile("countryside-12", "12", "失落军团乡野板块 12", "countryside", [
    ["nw", "hills", "rampager"], ["ne", "plains", "refugeeCamp"], ["w", "forest"], ["c", "hills"],
    ["e", "plains", "village"], ["sw", "forest", "glade"], ["se", "hills", "mine", "red"],
  ]), source: "lost-legion" },
  { ...defineTile("countryside-13", "13", "失落军团乡野板块 13", "countryside", [
    ["nw", "desert", "maze"], ["ne", "mountain"], ["w", "wasteland", "rampager"], ["c", "desert", "deepMine", "blue", ["blue", "red"]],
    ["e", "hills"], ["sw", "plains", "monastery"], ["se", "plains"],
  ]), source: "lost-legion" },
  { ...defineTile("countryside-14", "14", "失落军团乡野板块 14", "countryside", [
    ["nw", "swamp", "ruins"], ["ne", "forest"], ["w", "lake"], ["c", "swamp", "maze"],
    ["e", "forest", "rampager"], ["sw", "plains", "keep"], ["se", "hills"],
  ]), source: "lost-legion" },
  { ...defineTile("core-9", "9*", "失落军团核心板块 9", "core-noncity", [
    ["nw", "mountain"], ["ne", "wasteland", "labyrinth"], ["w", "hills", "dragon"], ["c", "swamp", "deepMine", "white", ["red", "blue", "green", "white"]],
    ["e", "desert", "tomb"], ["sw", "hills"], ["se", "desert", "ruins"],
  ]), source: "lost-legion" },
  { ...defineTile("core-10", "10*", "失落军团核心板块 10", "core-noncity", [
    ["nw", "lake"], ["ne", "swamp", "labyrinth"], ["w", "forest", "deepMine", "green", ["green", "white"]], ["c", "swamp", "dungeon"],
    ["e", "wasteland", "dragon"], ["sw", "forest", "tomb"], ["se", "hills", "mageTower"],
  ]), source: "lost-legion" },
  { ...defineTile("core-volkare", "V*", "沃尔卡雷营地核心板块", "core-city", [
    ["nw", "wasteland"], ["ne", "hills", "rampager"], ["w", "plains"], ["c", "wasteland", "volkareCamp"],
    ["e", "desert"], ["sw", "mountain"], ["se", "wasteland"],
  ]), source: "lost-legion" },
];

export const ALL_MAP_TILE_TEMPLATES = [...MAP_TILE_TEMPLATES, ...EXPANSION_MAP_TILE_TEMPLATES];
export const MAP_TILE_BY_ID = Object.fromEntries(ALL_MAP_TILE_TEMPLATES.map((tile) => [tile.id, tile])) as Record<string, MapTileTemplate>;
export const COUNTRYSIDE_TILES = MAP_TILE_TEMPLATES.filter((tile) => tile.kind === "countryside");
export const CORE_NONCITY_TILES = MAP_TILE_TEMPLATES.filter((tile) => tile.kind === "core-noncity");
export const CORE_CITY_TILES = MAP_TILE_TEMPLATES.filter((tile) => tile.kind === "core-city");
export const ULTIMATE_COUNTRYSIDE_TILES = ALL_MAP_TILE_TEMPLATES.filter((tile) => tile.kind === "countryside");
export const ULTIMATE_CORE_NONCITY_TILES = ALL_MAP_TILE_TEMPLATES.filter((tile) => tile.kind === "core-noncity");
export const ULTIMATE_CORE_CITY_TILES = ALL_MAP_TILE_TEMPLATES.filter((tile) => tile.kind === "core-city");

export function getMapTilePools(mode: ContentMode) {
  return mode === "ultimate"
    ? { countryside: ULTIMATE_COUNTRYSIDE_TILES, coreNoncity: ULTIMATE_CORE_NONCITY_TILES, coreCity: ULTIMATE_CORE_CITY_TILES }
    : { countryside: COUNTRYSIDE_TILES, coreNoncity: CORE_NONCITY_TILES, coreCity: CORE_CITY_TILES };
}

export function getMapTileTemplate(id: string) {
  return MAP_TILE_BY_ID[id];
}
