import type { CardDef, Enemy, SiteType } from "./game-data";

type AtlasStyle = { backgroundPosition: string };

function stableIndex(value: string, size: number) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % size;
}

function atlasCell(index: number, columns: number, rows: number): AtlasStyle {
  const column = index % columns;
  const row = Math.floor(index / columns) % rows;
  return {
    backgroundPosition: `${columns === 1 ? 50 : (column * 100) / (columns - 1)}% ${rows === 1 ? 50 : (row * 100) / (rows - 1)}%`,
  };
}

const HERO_INDEX: Record<string, number> = {
  tovak: 0,
  arythea: 1,
  goldyx: 2,
  norowas: 3,
  wolfhawk: 4,
  krang: 5,
  braevalar: 6,
};

export function heroArtStyle(heroId: string) {
  return atlasCell(HERO_INDEX[heroId] ?? 7, 4, 2);
}

const SITE_INDEX: Partial<Record<SiteType, number>> = {
  village: 1,
  monastery: 2,
  keep: 3,
  mageTower: 4,
  mine: 5,
  glade: 6,
  ruins: 7,
  tomb: 16,
  monsterDen: 8,
  spawningGrounds: 8,
  dragon: 9,
  city1: 10,
  city2: 11,
  labyrinth: 12,
  maze: 13,
  deepMine: 14,
  refugeeCamp: 15,
  graveyard: 16,
  necropolis: 17,
  hiddenValley: 18,
  volkareCamp: 19,
};

export function siteArtStyle(site: SiteType, terrain?: string) {
  return atlasCell(terrain === "portal" ? 0 : SITE_INDEX[site] ?? 7, 5, 4);
}

const UNIT_INDEX: Record<string, number> = {
  peasants: 0,
  herbalists: 1,
  foresters: 2,
  utemCrossbowmen: 3,
  utemGuardsmen: 4,
  utemSwordsmen: 5,
  guardianGolems: 6,
  illusionists: 7,
  redCapeMonks: 8,
  northernMonks: 9,
  savageMonks: 10,
  fireGolems: 11,
  iceGolems: 12,
  fireMages: 13,
  iceMages: 14,
  amotepGunners: 15,
  amotepFreezers: 16,
  catapults: 17,
  altemMages: 18,
  altemGuardians: 19,
  scouts: 20,
  thugs: 21,
  shocktroops: 22,
  magicFamiliars: 23,
  heroWhite: 24,
  heroGreen: 25,
  heroBlue: 26,
  heroRed: 27,
  sorcerers: 28,
  delphanaMasters: 29,
};

export function unitArtStyle(unitId: string) {
  const index = UNIT_INDEX[unitId] ?? stableIndex(`unit:${unitId}`, 30);
  return {
    ...atlasCell(index % 15, 5, 3),
    backgroundImage: `url("/assets/unit-atlas-${index < 15 ? "a" : "b"}.png")`,
  };
}

export function cardArtClass(card: Pick<CardDef, "tier">) {
  if (card.tier === "basic") return "basic-card-art";
  if (card.tier === "advanced") return "advanced-card-art";
  return card.tier === "artifact" ? "magic-card-art artifact-card-art" : "magic-card-art spell-card-art";
}

function basicCardIndex(id: string) {
  if (/march/.test(id)) return 1;
  if (/stamina|tireless|tough/.test(id)) return 2;
  if (/rage|battleVersatility|instinct/.test(id)) return 3;
  if (/swiftness|reflex/.test(id)) return 4;
  if (/determination/.test(id)) return 5;
  if (/promise|manners/.test(id)) return 6;
  if (/tranquility|rejuvenate/.test(id)) return 7;
  if (/concentration|willFocus|manaDraw|manaPull/.test(id)) return 8;
  if (/improvisation|threaten|coercion/.test(id)) return 9;
  if (/crystal|crystallize/.test(id)) return 10;
  if (/land|druidic|harvesting/.test(id)) return 12;
  return stableIndex(`basic:${id}`, 16);
}

function advancedCardIndex(id: string) {
  if (/temporal|portal/.test(id)) return 1;
  if (/ritual|bloodOfAncients/.test(id)) return 2;
  if (/shieldBash|stoutResolve/.test(id)) return 3;
  if (/meditation|peaceful/.test(id)) return 4;
  if (/chivalry|diplomacy|heroic|callToArms|inNeed/.test(id)) return 5;
  if (/mountain/.test(id)) return 7;
  if (/nature|regeneration|refreshing/.test(id)) return 8;
  if (/counterattack/.test(id)) return 9;
  if (/forge|crystal|pureMagic|manaStorm|magicTalent/.test(id)) return 11;
  if (/ambush|dodge|stare/.test(id)) return 12;
  if (/rage|heat|adrenaline|maximal/.test(id)) return 13;
  if (/intimidate|learning|training/.test(id)) return 14;
  if (/bolt|storm/.test(id)) return 15;
  return stableIndex(`advanced:${id}`, 16);
}

function spellCardIndex(id: string) {
  if (/fire|burning/.test(id)) return 0;
  if (/blizzard|chill/.test(id)) return 1;
  if (/restoration|cure/.test(id)) return 2;
  if (/charm|mindRead/.test(id)) return 3;
  if (/mist|underground|wings/.test(id)) return 4;
  if (/tremor|demolish/.test(id)) return 5;
  if (/mana|energy|offering/.test(id)) return 6;
  return 7;
}

function artifactCardIndex(id: string) {
  if (/circlet|ring|amulet|grail|gold|gems/.test(id)) return 8;
  if (/sword|harvester|horn/.test(id)) return 9;
  if (/shield/.test(id)) return 10;
  if (/bow/.test(id)) return 11;
  if (/banner/.test(id)) return 12;
  if (/staff/.test(id)) return 13;
  if (/book|tome/.test(id)) return 14;
  return 15;
}

export function cardArtStyle(card: Pick<CardDef, "id" | "tier">) {
  const index = card.tier === "basic"
    ? basicCardIndex(card.id)
    : card.tier === "advanced"
      ? advancedCardIndex(card.id)
      : card.tier === "spell"
        ? spellCardIndex(card.id)
        : artifactCardIndex(card.id);
  return atlasCell(index, 4, 4);
}

export function tacticArtStyle(tacticId: string) {
  return atlasCell(stableIndex(`tactic:${tacticId}`, 16), 4, 4);
}

function enemyAtlasIndex(enemy: Pick<Enemy, "id" | "name" | "tokenColor">) {
  const signature = `${enemy.id} ${enemy.name}`.toLowerCase();
  if (/catapult|投石/.test(signature)) return 11;
  if (/hydra|九头/.test(signature)) return 10;
  if (/vamp|吸血/.test(signature)) return 9;
  if (/element|元素|sprite|精灵/.test(signature)) return 8;
  if (/royal|王都|皇家/.test(signature)) return 7;
  if (/undead|legion|skelet|zombie|ghoul|mummy|death|军团|骸骨|僵尸|食尸|木乃伊|死亡/.test(signature)) return 6;
  if (/dragon|wyrm|巨龙|龙/.test(signature) || enemy.tokenColor === "red") return 5;
  if (/mage|warlock|priest|necrom|法师|祭司|术士|死灵/.test(signature) || enemy.tokenColor === "violet") return 4;
  if (/guard|hero|knight|守卫|英雄|骑士/.test(signature) || enemy.tokenColor === "gray" || enemy.tokenColor === "white") return 3;
  if (/wraith|shadow|幽魂|暗影/.test(signature)) return 2;
  if (/golem|earth|魔像|土元素/.test(signature) || enemy.tokenColor === "brown") return 1;
  if (/orc|raider|thug|centaur|兽人|劫掠|暴徒|半人马/.test(signature) || enemy.tokenColor === "green") return 0;
  return stableIndex(`enemy:${enemy.id}`, 12);
}

export function enemyArtStyle(enemy: Pick<Enemy, "id" | "name" | "tokenColor">) {
  return atlasCell(enemyAtlasIndex(enemy), 4, 3);
}
