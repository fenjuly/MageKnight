import type { Enemy, HeroDef, SiteType, Terrain, UnitDef } from "./game-data";
import { REALISTIC_ASSETS } from "./realistic-registry";
export { REALISTIC_ASSETS } from "./realistic-registry";

export type ModelStyle = "realistic" | "classic";
export type RealisticModelId = string;

const HERO_MODELS: Record<string, string> = { tovak: "armored-knight", arythea: "actor-arythea", goldyx: "actor-goldyx", norowas: "actor-norowas", wolfhawk: "actor-wolfhawk", krang: "actor-krang", braevalar: "actor-braevalar" };
const UNIT_MODELS: Record<string, string> = {
  peasants: "actor-peasant", herbalists: "actor-herbalist", foresters: "actor-archer", utemCrossbowmen: "actor-crossbowman", utemGuardsmen: "actor-guardsman", utemSwordsmen: "actor-swordsman", guardianGolems: "guardian-golem", illusionists: "actor-mage", redCapeMonks: "actor-monk", northernMonks: "actor-monk", savageMonks: "actor-monk", fireGolems: "fire-golem", iceGolems: "ice-golem", fireMages: "fire-mage", iceMages: "ice-mage", amotepGunners: "actor-gunner", amotepFreezers: "freezer", catapults: "special-catapult", altemMages: "actor-mage", altemGuardians: "actor-guardsman", scouts: "actor-archer", thugs: "actor-swordsman", shocktroops: "actor-guardsman", magicFamiliars: "special-spirit", heroWhite: "hero-unit-white", heroGreen: "hero-unit-green", heroBlue: "hero-unit-blue", heroRed: "hero-unit-red", sorcerers: "sorcerer", delphanaMasters: "actor-female-mage",
};
const ENEMY_FAMILIES: Record<string, string> = {
  "cursed-hags": "actor-hag", diggers: "orc-digger", ironclads: "actor-orc-armored", summoners: "actor-orc-shaman", prowlers: "actor-orc-tracker", "wolf-riders": "actor-wolf-rider",
  "fire-dragon": "dragon-fire", "high-dragon": "dragon-high", "ice-dragon": "dragon-ice", "swamp-dragon": "dragon-swamp", crossbowmen: "actor-crossbowman", golems: "guardian-golem", guardsmen: "actor-guardsman", swordsmen: "actor-swordsman", "fire-golem": "fire-golem", "ice-golem": "ice-golem", "fire-mages": "fire-mage", "ice-mages": "ice-mage", illusionist: "actor-mage", monks: "actor-monk", "crypt-worm": "special-crypt-worm", gargoyle: "creature-gargoyle", medusa: "special-medusa", minotaur: "creature-minotaur", werewolf: "actor-werewolf", "altem-guardsmen": "actor-guardsman", "altem-mage": "actor-mage", freezers: "freezer", gunners: "actor-gunner",
  "ue-orc-skirmishers": "actor-orc-skirmisher", "ue-orc-war-beasts": "creature-wolf", "ue-orc-trackers": "actor-orc-tracker", "ue-orc-stonethrower": "actor-orc-stonethrower", "ue-sorcerers": "sorcerer", "ue-magic-familiars": "special-spirit", "ue-hero-white": "hero-unit-white", "ue-hero-green": "hero-unit-green", "ue-hero-blue": "hero-unit-blue", "ue-hero-red": "hero-unit-red", "ue-thugs": "actor-swordsman", "ue-shocktroops": "actor-guardsman", "ue-shadow": "special-spirit", "ue-manticore": "special-manticore", "ue-hydra": "special-hydra", "ue-storm-dragon": "dragon-storm", "ue-lava-dragon": "dragon-lava", "ue-dragon-summoner": "actor-dragon-summoner", "ue-grim-legionnaires": "actor-guardsman", "ue-fire-catapult": "fire-catapult", "ue-delphana-masters": "actor-female-mage", "ue-ice-catapult": "ice-catapult", "ue-crystal-sprites": "special-sprite", "ue-elven-protectors": "actor-norowas", "ue-centaur-outriders": "special-centaur", "ue-elemental-priestesses": "actor-female-mage", "ue-cloud-griffons": "special-griffon", "ue-skeletal-warriors": "creature-skeleton", "ue-zombie-horde": "creature-zombie", "ue-gibbering-ghouls": "ghoul", "ue-corrupted-priests": "actor-necromancer", "ue-shrouded-necromancers": "actor-necromancer", "ue-air-elemental": "special-air-elemental", "ue-earth-elemental": "creature-earth-elemental", "ue-fire-elemental": "special-fire-elemental", "ue-water-elemental": "special-water-elemental", "ue-pain-wraith": "special-spirit", "ue-mummy": "special-mummy", "ue-vampire": "vampire", "ue-blood-demon": "creature-demon", "ue-savage-dragon": "dragon-savage", "ue-lightning-dragon": "dragon-lightning", "ue-death-dragon": "dragon-death", "ue-vampiric-dragon": "dragon-vampiric",
};

export function realisticModelFor(entry: { kind: "hero"; value: HeroDef } | { kind: "enemy"; value: Enemy } | { kind: "site"; value: SiteType } | { kind: "terrain"; value: Terrain } | { kind: "unit"; value: UnitDef }): RealisticModelId | undefined {
  const id = entry.kind === "hero" ? HERO_MODELS[entry.value.id] : entry.kind === "unit" ? UNIT_MODELS[entry.value.id] : entry.kind === "enemy" ? ENEMY_FAMILIES[entry.value.id.replace(/^(green|red|gray|violet|brown|white)-/, "").replace(/-\d+$/, "")] : entry.kind === "site" ? (entry.value === "keep" ? "gatehouse" : `env-site-${entry.value}`) : entry.value === "plains" ? "rocky-ground" : `env-terrain-${entry.value}`;
  return id && REALISTIC_ASSETS[id] ? id : undefined;
}

export function realisticModelUrl(id: RealisticModelId, detail: "near" | "far") { return `./models/realistic/${REALISTIC_ASSETS[id]?.fileBase ?? id}${detail === "far" ? "-mobile" : ""}.glb`; }

export function readModelStyle(): ModelStyle {
  try { return localStorage.getItem("mage-knight-model-style") === "classic" ? "classic" : "realistic"; } catch { return "realistic"; }
}
export function saveModelStyle(style: ModelStyle) { try { localStorage.setItem("mage-knight-model-style", style); } catch { /* live preference still works */ } }
