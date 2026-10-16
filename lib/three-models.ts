import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Enemy, HeroDef, MapCell, SiteType, Terrain, UnitDef } from "./game-data";

export const TERRAIN_3D: Record<Terrain, { color: string; height: number }> = {
  portal: { color: "#487f79", height: .16 }, plains: { color: "#799364", height: .12 },
  forest: { color: "#365e48", height: .18 }, desert: { color: "#c9a66e", height: .12 },
  hills: { color: "#8a8c68", height: .26 }, swamp: { color: "#557e71", height: .08 },
  wasteland: { color: "#9a7765", height: .17 }, lake: { color: "#426f83", height: .04 },
  mountain: { color: "#7c888c", height: .3 }, city: { color: "#8e819d", height: .2 },
};

export const MANA_3D: Record<string, string> = { red: "#e98766", blue: "#8acbdf", green: "#87c7a1", white: "#e4dcc0", black: "#bc8bd4", gold: "#e8c17b" };
export function modelSeed(id: string) { let value = 2166136261; for (const letter of id) value = Math.imul(value ^ letter.charCodeAt(0), 16777619); return value >>> 0; }
export function cellWorldPosition(q: number, r: number) { return { x: (q + r / 2) * Math.sqrt(3), z: r * 1.5 }; }
export type ActorShape = "knight" | "archer" | "mage" | "orc" | "dragon" | "beast" | "golem" | "serpent" | "spirit" | "siege" | "undead" | "centaur";

export function enemyModelShape(enemy: Enemy): ActorShape {
  const id = `${enemy.id} ${enemy.name}`;
  if (/catapult|gunners|投石|炮手/i.test(id)) return "siege";
  if (/summoner|summoners|mages|mage|sorcerer|illusion|priest|hags|monks|大师|法师|召唤师|术士|祭司|女巫|僧侣/i.test(id)) return "mage";
  if (/dragon|巨龙/i.test(id)) return "dragon";
  if (/centaur|半人马/i.test(id)) return "centaur";
  if (/worm|medusa|hydra|蠕虫|美杜莎|九头蛇/i.test(id)) return "serpent";
  if (/golem|earth-elemental|魔像|土元素/i.test(id)) return "golem";
  if (/shadow|wraith|elemental|sprites|暗影|怨灵|元素|精灵/i.test(id)) return "spirit";
  if (/skeleton|skeletal|zombie|ghoul|mummy|vampir|骸骨|僵尸|食尸鬼|木乃伊|吸血鬼/i.test(id)) return "undead";
  if (/beast|wolf|werewolf|manticore|gargoyle|griffon|demon|巨兽|狼|蝎尾狮|石像鬼|狮鹫|恶魔/i.test(id)) return "beast";
  if (/crossbow|tracker|prowler|弩手|追踪|潜行/i.test(id)) return "archer";
  if (/minotaur|牛头怪/i.test(id)) return "orc";
  if (enemy.tokenColor === "green") return "orc";
  return "knight";
}

export function unitModelShape(unit: UnitDef): ActorShape {
  const id = `${unit.id} ${unit.englishName} ${unit.name}`;
  if (/catapult|投石/i.test(id)) return "siege";
  if (/golem|魔像/i.test(id)) return "golem";
  if (/mage|monk|healer|illusion|sorcerer|delphana|法师|僧侣|医师|幻术|术士|大师/i.test(id)) return "mage";
  if (/scout|crossbow|archer|forester|侦察|弩|弓|林务/i.test(id)) return "archer";
  if (/familiar|使魔/i.test(id)) return "spirit";
  return "knight";
}

type Point = [number, number, number];
type ActorProfile = { shape: ActorShape; color: string; skin?: string; female?: boolean; horns?: boolean; crown?: boolean; shield?: boolean; dual?: boolean; wings?: boolean; seed?: number };

/** Original solid-mesh miniatures. No billboards or portrait planes are used. */
export class ModelKit {
  private geometries = new Map<string, T.BufferGeometry>();
  private materials = new Map<string, T.MeshStandardMaterial>();
  private geometry(key: string, create: () => T.BufferGeometry) { let geometry = this.geometries.get(key); if (!geometry) { geometry = create(); this.geometries.set(key, geometry); } return geometry; }
  material(color: string, metallic = false, glow = false) {
    const key = `${color}-${metallic}-${glow}`;
    let material = this.materials.get(key);
    if (!material) { material = new T.MeshStandardMaterial({ color, roughness: metallic ? .38 : .9, metalness: metallic ? .55 : .05, flatShading: true, emissive: glow ? color : "#000000", emissiveIntensity: glow ? .45 : 0 }); this.materials.set(key, material); }
    return material;
  }
  private mesh(parent: T.Group, geometry: T.BufferGeometry, color: string, position: Point, scale: Point = [1, 1, 1], rotation: Point = [0, 0, 0], metallic = false, glow = false) {
    const mesh = new T.Mesh(geometry, this.material(color, metallic, glow)); mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  box(parent: T.Group, color: string, position: Point, size: Point, rotation: Point = [0, 0, 0], metal = false) { return this.mesh(parent, this.geometry("box", () => new T.BoxGeometry(1, 1, 1)), color, position, size, rotation, metal); }
  cylinder(parent: T.Group, color: string, position: Point, top: number, bottom: number, height: number, sides = 8, rotation: Point = [0, 0, 0], glow = false) {
    return this.mesh(parent, this.geometry(`cylinder-${top}-${bottom}-${height}-${sides}`, () => new T.CylinderGeometry(top, bottom, height, sides)), color, position, [1, 1, 1], rotation, false, glow);
  }
  ball(parent: T.Group, color: string, position: Point, scale: Point, glow = false) { return this.mesh(parent, this.geometry("ball", () => new T.IcosahedronGeometry(1, 0)), color, position, scale, [0, 0, 0], false, glow); }
  ring(parent: T.Group, color: string, position: Point, radius: number, width: number, rotation: Point = [Math.PI / 2, 0, 0], glow = false) { return this.mesh(parent, this.geometry(`ring-${radius}-${width}`, () => new T.TorusGeometry(radius, width, 5, 24)), color, position, [1, 1, 1], rotation, true, glow); }
  rod(parent: T.Group, color: string, from: Point, to: Point, radius = .035) {
    const start = new T.Vector3(...from), end = new T.Vector3(...to), difference = end.clone().sub(start);
    const mesh = this.cylinder(parent, color, start.clone().add(end).multiplyScalar(.5).toArray() as Point, radius, radius, difference.length(), 6);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), difference.normalize()); return mesh;
  }
  private wing(parent: T.Group, color: string, side: number, height: number) {
    const shape = new T.Shape(); shape.moveTo(0, 0); shape.lineTo(.65 * side, .5); shape.lineTo(.86 * side, -.25); shape.lineTo(.42 * side, -.06); shape.lineTo(.28 * side, -.4); shape.closePath();
    const geometry = this.geometry(`wing-${side}`, () => new T.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: false }));
    this.mesh(parent, geometry, color, [side * .14, height, .08], [1, 1, 1]);
    this.rod(parent, "#b5ac96", [side * .14, height, .1], [side * .79, height + .5, .1], .025);
  }
  /** Merge each material into one draw call, preserving true 3D geometry. */
  finish(group: T.Group, id: string, category: string) {
    group.updateMatrixWorld(true); const buckets = new Map<T.Material, T.BufferGeometry[]>();
    group.traverse((object) => { if (!(object instanceof T.Mesh)) return; const geometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(object.matrixWorld); const material = object.material as T.Material; const list = buckets.get(material) ?? []; list.push(geometry); buckets.set(material, list); });
    const result = new T.Group(); result.name = `${category}:${id}`; result.userData = { modelId: id, category, solidMesh: true };
    for (const [material, geometries] of buckets) { const merged = mergeGeometries(geometries, false); geometries.forEach((geometry) => geometry.dispose()); if (!merged) throw new Error(`Cannot merge model ${id}`); const mesh = new T.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.ownedGeometry = true; result.add(mesh); }
    return result;
  }
  terrain(terrain: Terrain, id: string, sparse = false) {
    const group = new T.Group(), palette = TERRAIN_3D[terrain], seed = modelSeed(id);
    this.cylinder(group, "#374b42", [0, -.1, 0], .96, .98, .24, 6);
    this.cylinder(group, palette.color, [0, palette.height / 2, 0], .945, .945, palette.height, 6);
    const tree = (x: number, z: number, scale = 1) => { this.cylinder(group, "#6c5743", [x, palette.height + .2 * scale, z], .035 * scale, .05 * scale, .4 * scale, 5); this.cylinder(group, "#2d5844", [x, palette.height + .42 * scale, z], 0, .23 * scale, .55 * scale, 6); this.cylinder(group, "#41775a", [x, palette.height + .6 * scale, z], 0, .17 * scale, .43 * scale, 6); };
    const spots: Point[] = [[-.52, 0, -.25], [.48, 0, -.28], [-.43, 0, .39], [.44, 0, .36], [0, 0, -.56]];
    if (terrain === "forest") spots.slice(0, sparse ? 3 : 5).forEach(([x, , z], index) => tree(x, z, .75 + (seed + index) % 4 * .1));
    if (terrain === "mountain" || terrain === "hills") spots.slice(0, terrain === "mountain" ? 3 : 2).forEach(([x, , z], index) => {
      const height = terrain === "mountain" ? .95 + index * .22 : .32 + index * .13;
      this.cylinder(group, terrain === "mountain" ? "#89969a" : "#84916a", [x * .7, palette.height + height / 2, z * .6], 0, .38, height, 5);
      if (terrain === "mountain") this.cylinder(group, "#d8e3df", [x * .7, palette.height + height * .85, z * .6], 0, .11, height * .31, 5);
    });
    if (terrain === "lake" || terrain === "swamp") {
      this.cylinder(group, terrain === "lake" ? "#5496aa" : "#426d65", [0, palette.height + .012, 0], .88, .88, .025, 6, [0, 0, 0], terrain === "lake");
      if (terrain === "swamp") { spots.slice(0, 3).forEach(([x, , z]) => { this.ball(group, "#79906a", [x, .14, z], [.22, .09, .19]); this.rod(group, "#b6ad71", [x, .12, z], [x + .04, .42, z], .015); }); }
      else { this.rod(group, "#93c4c7", [-.42, .08, -.18], [.1, .08, -.18], .013); this.rod(group, "#85b9c2", [-.12, .08, .23], [.4, .08, .23], .012); }
    }
    if (terrain === "desert") spots.slice(0, 3).forEach(([x, , z], index) => this.ball(group, index % 2 ? "#dcc08d" : "#bc985e", [x, palette.height, z], [.36, .12, .24]));
    if (terrain === "wasteland") spots.slice(0, 3).forEach(([x, , z], index) => this.ball(group, "#75605b", [x, palette.height + .07, z], [.12, .14 + index * .04, .13]));
    if (terrain === "plains" && !sparse) spots.slice(0, 3).forEach(([x, , z]) => this.ball(group, "#a0ac7a", [x, .15, z], [.12, .055, .12]));
    if (terrain === "portal") { this.ring(group, "#88d0db", [0, .8, -.03], .44, .095, [0, 0, 0], true); this.cylinder(group, "#647f7d", [0, .25, 0], .61, .65, .17, 8); [-1, 1].forEach((side) => this.box(group, "#7e9690", [side * .42, .5, 0], [.16, .58, .2])); }
    return this.finish(group, id, `terrain-${terrain}`);
  }
  site(site: SiteType, cell: Pick<MapCell, "id" | "mineColor" | "ruinAltarColor">) {
    const group = new T.Group(); const stone = "#b5b39d", dark = "#687b73", roof = "#665557", wood = "#8a6849", gold = "#d9b87c";
    const tower = (x: number, z: number, height = .9, cone = false) => { this.cylinder(group, stone, [x, height / 2, z], .15, .19, height, 8); this.cylinder(group, dark, [x, height - .08, z], .22, .22, .12, 8); if (cone) this.cylinder(group, roof, [x, height + .16, z], 0, .25, .4, 8); else [-1, 1].forEach((sign) => this.box(group, stone, [x + sign * .13, height + .04, z], [.1, .17, .25])); };
    const house = (x: number, z: number, scale = 1) => { this.box(group, "#d2c0a0", [x, .19 * scale, z], [.35 * scale, .38 * scale, .37 * scale]); this.cylinder(group, "#9a6c55", [x, .47 * scale, z], 0, .35 * scale, .25 * scale, 4, [0, Math.PI / 4, 0]); this.box(group, wood, [x, .11 * scale, z + .192 * scale], [.075 * scale, .18 * scale, .015]); };
    if (site === "village") { house(-.27, -.21); house(.24, -.15, .8); house(0, .28, .9); }
    else if (site === "keep" || site === "city1" || site === "city2" || site === "necropolis") {
      const city = site === "city1" || site === "city2";
      this.box(group, dark, [0, .08, 0], [1.03, .16, .92]);
      [-1, 1].forEach((x) => [-1, 1].forEach((z) => tower(x * .4, z * .34, city ? 1.15 : .72, site === "city2")));
      [-1, 1].forEach((side) => { this.box(group, stone, [side * .42, .3, 0], [.12, .49, .62]); this.box(group, stone, [0, .3, side * .35], [.72, .49, .1]); });
      this.box(group, wood, [0, .23, .413], [.23, .36, .04]); tower(0, -.04, city ? 1.55 : .99, city); if (city) this.ball(group, site === "city1" ? "#d48e81" : "#8bb6d0", [0, 1.85, -.04], [.12, .18, .12], true);
    } else if (site === "mageTower") {
      this.cylinder(group, "#9f9cb4", [0, .65, 0], .22, .39, 1.3, 8); this.cylinder(group, "#585a78", [0, 1.4, 0], 0, .43, .65, 8); this.ring(group, "#a58be0", [0, 1.12, 0], .29, .035, [Math.PI / 2, 0, 0], true); this.ball(group, "#c1a4f0", [0, 1.8, 0], [.1, .15, .1], true);
    } else if (site === "monastery") {
      this.box(group, stone, [0, .3, .04], [.72, .6, .65]); this.cylinder(group, roof, [0, .72, .04], 0, .56, .38, 4, [0, Math.PI / 4, 0]); tower(.3, -.29, 1.08, true); this.rod(group, gold, [.3, 1.39, -.29], [.3, 1.65, -.29]); this.rod(group, gold, [.2, 1.55, -.29], [.4, 1.55, -.29]);
    } else if (site === "mine" || site === "deepMine") {
      this.ball(group, "#807b72", [0, .25, -.1], [.63, .4, .4]); this.box(group, "#24372f", [0, .21, .28], [.4, .38, .05]); [-1, 1].forEach((side) => this.box(group, wood, [side * .23, .24, .3], [.09, .48, .12])); this.box(group, wood, [0, .49, .3], [.59, .1, .13]); [-1, 1].forEach((side) => this.cylinder(group, MANA_3D[cell.mineColor ?? "blue"], [side * .43, .17, .28], 0, .13, .34, 5, [0, 0, side * -.3], true));
    } else if (site === "glade" || site === "hiddenValley") {
      this.cylinder(group, "#5b7963", [0, .08, 0], .58, .64, .15, 10); this.cylinder(group, "#9cc5aa", [0, .5, 0], .04, .12, .9, 7); [[-.22, .85, 0], [.2, 1.04, -.05], [0, 1.2, 0]].forEach((point) => this.ball(group, "#67a27d", point as Point, [.36, .3, .3])); this.ring(group, "#bfe6b5", [0, .2, 0], .47, .025, [Math.PI / 2, 0, 0], true);
    } else if (site === "maze" || site === "labyrinth") {
      this.box(group, "#777f65", [0, .04, 0], [1.1, .08, 1.1]); [-.45, -.15, .15, .45].forEach((x, index) => { this.box(group, "#a2a98a", [x, .19, index % 2 ? -.08 : .08], [.07, .3, .78]); this.box(group, "#a2a98a", [index % 2 ? -.1 : .1, .19, x], [.78, .3, .065]); });
    } else if (site === "refugeeCamp" || site === "volkareCamp") {
      [-1, 0, 1].forEach((side) => { const x = side * .35, z = Math.abs(side) * -.27; this.cylinder(group, side ? "#b59a71" : "#96775f", [x, .22, z], 0, .34, .46, 4, [0, Math.PI / 4, 0]); }); this.rod(group, wood, [.46, 0, .23], [.46, .92, .23]); this.box(group, site === "volkareCamp" ? "#963e47" : gold, [.33, .78, .23], [.26, .2, .035]);
    } else if (site === "graveyard" || site === "tomb") {
      [-1, 0, 1].forEach((side) => { this.box(group, stone, [side * .3, .22, Math.abs(side) * -.23], [.18, .43, .1], [0, side * .2, 0]); this.box(group, stone, [side * .3, .32, Math.abs(side) * -.23], [.28, .08, .12]); }); this.box(group, dark, [0, .06, .3], [.45, .1, .35]);
    } else if (["dungeon", "monsterDen", "spawningGrounds"].includes(site)) {
      this.ball(group, dark, [0, .18, -.13], [.6, .35, .45]); this.box(group, "#1a2827", [0, .16, .27], [.4, .29, .05]); [-1, 1].forEach((side) => this.cylinder(group, stone, [side * .3, .25, .27], .09, .15, .5, 6)); if (site === "spawningGrounds") [-1, 1].forEach((side) => this.ball(group, "#b4ad87", [side * .23, .14, .38], [.1, .15, .1]));
    } else if (site === "ruins") {
      this.cylinder(group, dark, [0, .07, 0], .58, .62, .14, 6); [-1, 1].forEach((side) => { this.cylinder(group, stone, [side * .36, side < 0 ? .43 : .3, -.18], .1, .13, side < 0 ? .75 : .48, 7); this.box(group, stone, [side * .38, .1, .32], [.24, .16, .28], [.05, side * .4, 0]); }); this.box(group, "#c0ae83", [0, .25, .06], [.35, .25, .28]); this.ball(group, MANA_3D[cell.ruinAltarColor ?? "gold"], [0, .45, .06], [.12, .13, .12], true);
    }
    return this.finish(group, cell.id, `site-${site}`);
  }
  private actor(profile: ActorProfile) {
    const group = new T.Group(), color = profile.color, armor = "#a6b4b3", dark = "#424b49", skin = profile.skin ?? "#d6b291", gold = "#d7b477";
    this.cylinder(group, "#37443f", [0, .04, 0], .34, .38, .08, 12); this.cylinder(group, color, [0, .09, 0], .32, .33, .025, 12);
    if (profile.shape === "siege") {
      this.box(group, "#876449", [0, .34, 0], [.5, .18, .52]); [-1, 1].forEach((side) => [-1, 1].forEach((front) => this.cylinder(group, dark, [side * .29, .24, front * .22], .16, .16, .08, 8, [0, 0, Math.PI / 2]))); this.rod(group, gold, [0, .35, -.25], [0, .95, .27], .07); this.ball(group, color, [0, .99, .29], [.13, .12, .13], true); return group;
    }
    if (profile.shape === "dragon" || profile.shape === "beast" || profile.shape === "centaur") {
      this.ball(group, color, [0, .46, 0], [.25, .25, .43]); [-1, 1].forEach((side) => [-1, 1].forEach((front) => this.rod(group, color, [side * .16, .39, front * .23], [side * .21, .13, front * .27], .07)));
      this.rod(group, color, [0, .49, -.27], [0, .65, -.6], .07);
      if (profile.shape === "centaur") { const torso = this.actor({ ...profile, shape: "archer" }); torso.position.set(0, .28, .14); torso.scale.setScalar(.75); group.add(torso); }
      else { this.ball(group, color, [0, .69, .33], [.19, .2, .22]); this.ball(group, color, [0, .65, .52], [.15, .1, .17]); [-1, 1].forEach((side) => { this.ball(group, "#f2c979", [side * .12, .75, .48], [.025, .035, .025], true); this.cylinder(group, gold, [side * .14, .88, .29], 0, .055, .23, 5, [0, 0, -side * .4]); }); }
      if (profile.shape === "dragon" || profile.wings) [-1, 1].forEach((side) => this.wing(group, color, side, .68));
      return group;
    }
    if (profile.shape === "serpent") {
      for (let index = 0; index < 7; index++) this.ball(group, color, [Math.sin(index * .9) * .18, .15 + index * .11, Math.cos(index * .9) * .13], [.15 - index * .006, .12, .14]);
      this.ball(group, color, [0, .92, .12], [.17, .13, .19]); [-1, 1].forEach((side) => this.ball(group, "#f0d677", [side * .09, .96, .26], [.025, .025, .025], true)); return group;
    }
    if (profile.shape === "spirit") {
      this.cylinder(group, color, [0, .37, 0], .18, .08, .48, 7, [0, 0, -.13], true); this.ball(group, color, [0, .74, 0], [.21, .24, .19], true); [-1, 1].forEach((side) => this.ball(group, "#eee6cc", [side * .07, .78, .17], [.027, .03, .02], true)); this.ring(group, color, [0, .55, 0], .29, .026, [Math.PI / 2, .3, 0], true); return group;
    }
    const bulky = profile.shape === "golem" || profile.shape === "orc";
    const body = profile.shape === "undead" ? "#c5c4a4" : profile.shape === "golem" ? color : dark;
    [-1, 1].forEach((side) => { this.box(group, body, [side * .1, .28, .01], [.12, .32, .15]); this.box(group, dark, [side * .1, .14, .07], [.15, .11, .23]); });
    if (profile.shape === "mage") this.cylinder(group, color, [0, .43, 0], .15, .26, .59, 8);
    else { this.box(group, profile.shape === "golem" ? color : armor, [0, .57, 0], [bulky ? .46 : .3, .36, .22]); this.box(group, color, [0, .63, -.15], [.34, .5, .035], [-.22, 0, 0]); }
    const headSkin = profile.shape === "golem" ? color : profile.shape === "undead" ? "#d4d0b2" : skin;
    this.ball(group, headSkin, [0, .88, .01], [bulky ? .17 : .13, .16, .13]);
    if (profile.female) this.ball(group, "#805b46", [0, .9, -.07], [.15, .19, .13]);
    else if (profile.shape === "knight") this.cylinder(group, armor, [0, .96, .005], .12, .15, .18, 8);
    if (profile.shape === "mage") this.cylinder(group, color, [0, 1.1, 0], 0, .22, .34, 7, [0, 0, -.12]);
    [-1, 1].forEach((side) => { this.ball(group, bulky ? color : armor, [side * (bulky ? .26 : .18), .68, 0], [.12, .13, .13]); this.rod(group, profile.shape === "mage" ? color : dark, [side * .2, .64, 0], [side * .3, .43, .13], .06); });
    this.box(group, "#333d39", [0, .9, .135], [.13, .035, .025]);
    if (profile.shape === "archer") { this.ring(group, "#bba47b", [-.29, .57, .17], .25, .025, [0, Math.PI / 2, 0]); this.rod(group, "#e8d6b4", [-.29, .32, .17], [-.29, .82, .17], .008); this.box(group, "#66513c", [.12, .59, -.2], [.12, .38, .12], [0, 0, .2]); }
    else if (profile.shape === "mage") { this.rod(group, "#95744c", [.31, .12, .16], [.31, 1.1, .16], .032); this.ball(group, color, [.31, 1.17, .16], [.11, .14, .11], true); }
    else { this.box(group, "#c1d2d4", [.32, .73, .14], [.055, .55, .045], [0, 0, -.15], true); this.box(group, gold, [.29, .49, .14], [.23, .045, .07]); }
    if (profile.shield || profile.shape === "knight") { this.cylinder(group, gold, [-.3, .5, .17], .2, .2, .07, 6, [Math.PI / 2, 0, 0]); this.cylinder(group, color, [-.3, .5, .215], .16, .16, .025, 6, [Math.PI / 2, 0, 0]); }
    if (profile.horns) [-1, 1].forEach((side) => this.cylinder(group, gold, [side * .16, 1.02, 0], 0, .05, .23, 5, [0, 0, -side * .55]));
    if (profile.crown) [-1, 0, 1].forEach((side) => this.cylinder(group, gold, [side * .1, 1.08, 0], 0, .045, .16 + (side ? 0 : .07), 4));
    if (profile.dual) this.box(group, "#b9cbd0", [-.32, .67, .16], [.05, .48, .04], [0, 0, .4], true);
    if (profile.wings) [-1, 1].forEach((side) => this.wing(group, color, side, .72));
    return group;
  }
  hero(hero: HeroDef) {
    const profiles: Record<string, ActorProfile> = {
      tovak: { shape: "knight", color: "#588baf", shield: true, horns: true },
      arythea: { shape: "mage", color: "#b94f55", female: true, dual: true },
      goldyx: { shape: "orc", color: "#9ba759", skin: "#91a36b", wings: true, horns: true },
      norowas: { shape: "knight", color: "#d4cc9c", crown: true },
      wolfhawk: { shape: "archer", color: "#839481", female: true, dual: true },
      krang: { shape: "mage", color: "#936358", skin: "#81a16d", horns: true },
      braevalar: { shape: "mage", color: "#668c78", crown: true },
    };
    const group = this.actor(profiles[hero.id] ?? { shape: "knight", color: MANA_3D[hero.color] });
    if (hero.id === "goldyx") { this.ball(group, "#91a36b", [0, .85, .15], [.14, .075, .15]); this.rod(group, "#91a36b", [0, .33, -.12], [.1, .16, -.55], .065); }
    this.ring(group, "#f3d286", [0, .13, 0], .39, .035, [Math.PI / 2, 0, 0], true);
    return this.finish(group, hero.id, "hero");
  }
  enemy(enemy: Enemy) {
    const seed = modelSeed(enemy.id.replace(/-\d+$/, ""));
    const colors = ["#8a9b6b", "#bc7760", "#8a9ca4", "#9e7baa", "#a79072", "#c1c5b6"];
    const color = enemy.attackElement === "fire" ? "#b96d55" : enemy.attackElement === "ice" ? "#7da9bd" : enemy.attackElement === "coldfire" ? "#9d8bbd" : colors[(seed + enemy.armor) % colors.length];
    const group = this.actor({ shape: enemyModelShape(enemy), color, skin: enemy.tokenColor === "green" ? "#8c9d64" : undefined, female: /hags|priestesses|delphana|medusa|女巫|女祭司|德尔法娜|美杜莎/.test(`${enemy.id} ${enemy.name}`), horns: enemy.brutal, shield: enemy.fortified, crown: enemy.arcaneImmunity, seed, wings: /gargoyle|griffon/.test(enemy.id) });
    if (/hydra/.test(enemy.id)) [-1, 1].forEach((side) => { this.rod(group, color, [0, .45, 0], [side * .26, .87, .08], .08); this.ball(group, color, [side * .26, .94, .15], [.12, .11, .17]); });
    if (/wolf-riders/.test(enemy.id)) { const rider = this.actor({ shape: "orc", color: "#667a53", skin: "#8c9d64" }); rider.scale.setScalar(.6); rider.position.set(0, .3, -.05); group.add(rider); }
    // Variants retain a shared family silhouette but have distinct height,
    // armor, weapons and elemental material derived from printed identity.
    group.scale.setScalar(.86 + (seed % 4) * .055);
    return this.finish(group, enemy.id, "enemy");
  }
  unit(unit: UnitDef) {
    const seed = modelSeed(unit.id), colors = unit.tier === "elite" ? ["#c5b278", "#9b91ac", "#8ea5a9", "#a8a17e"] : ["#7c9f9b", "#8da37b", "#a28c79", "#8c99ad"];
    const group = this.actor({ shape: unitModelShape(unit), color: colors[seed % colors.length], female: unit.id === "delphanaMasters", crown: unit.tier === "elite", shield: unit.armor >= 5, horns: /guardsmen|shock/i.test(unit.id), dual: /swordsmen|heroes/i.test(unit.id) });
    group.scale.set(1 + (seed % 3) * .03, .93 + unit.level * .035, 1 + (seed % 4) * .02);
    return this.finish(group, unit.id, "unit");
  }
  dispose() { this.geometries.forEach((geometry) => geometry.dispose()); this.materials.forEach((material) => material.dispose()); this.geometries.clear(); this.materials.clear(); }
}

export function disposeModel(group: T.Object3D) { group.traverse((object) => { if (object instanceof T.Mesh && object.userData.ownedGeometry) object.geometry.dispose(); }); group.removeFromParent(); }
