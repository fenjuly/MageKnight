import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { ALL_HEROES, ALL_ENEMY_TOKENS, ALL_UNIT_DEFS } from "../lib/game-data";
import { REALISTIC_ASSETS, realisticModelFor, realisticModelUrl, type RealisticModelId } from "../lib/realistic-assets";
import { RealisticModelPool, normalizeRealisticModel } from "../lib/three-realistic";
import { resolveBoardHit, visibleCellModelData } from "../lib/three-board";

type Accessor = { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string };
type ModelDocument = {
  asset: { version: string; copyright: string }; buffers: { byteLength: number; uri?: string }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  accessors: Accessor[]; images: { bufferView: number; mimeType: string; uri?: string }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number; material: number }[] }[];
  materials: { name?: string; normalTexture?: unknown; pbrMetallicRoughness: { baseColorTexture?: unknown; baseColorFactor?: number[]; metallicRoughnessTexture?: unknown } }[];
  animations?: { name: string }[]; skins?: unknown[];
};
const directory = new URL("../public/models/realistic/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8")) as { file: string; sha256: string; bytes: number; triangles: number }[];
const documents = new Map<string, ModelDocument>();

for (const id of Object.keys(REALISTIC_ASSETS) as RealisticModelId[]) for (const detail of ["near", "far"] as const) {
  test(`realistic offline GLB: ${id} / ${detail} is self-contained and within mobile budgets`, () => {
    const file = realisticModelUrl(id, detail).split("/").at(-1)!;
    const bytes = readFileSync(new URL(file, directory)), record = manifest.find((entry) => entry.file === file)!;
    assert.ok(record); assert.equal(bytes.toString("ascii", 0, 4), "glTF"); assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.length, record.bytes); assert.equal(createHash("sha256").update(bytes).digest("hex"), record.sha256);
    assert.ok(bytes.length < (detail === "far" ? 2_000_000 : 5_000_000), "prevent uncompressed packed PNG originals entering the APK");
    assert.ok(record.triangles > 100 && record.triangles < (detail === "far" ? 11_000 : 25_000));
    const jsonLength = bytes.readUInt32LE(12), document = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength)) as ModelDocument;
    documents.set(file, document);
    assert.equal(document.asset.version, "2.0"); assert.ok(document.asset.copyright.includes(REALISTIC_ASSETS[id].license));
    assert.equal(document.buffers.length, 1); assert.equal(document.buffers[0].uri, undefined);
    const binaryStart = 28 + jsonLength, binaryLength = bytes.readUInt32LE(20 + jsonLength);
    assert.equal(bytes.toString("ascii", 24 + jsonLength, 28 + jsonLength), "BIN\0"); assert.ok(document.buffers[0].byteLength <= binaryLength);
    for (const view of document.bufferViews) { assert.equal(view.buffer, 0); assert.equal((view.byteOffset ?? 0) % 4, 0); assert.ok((view.byteOffset ?? 0) + view.byteLength <= document.buffers[0].byteLength); }
    assert.ok(document.images.length > 0);
    for (const image of document.images) {
      assert.equal(image.uri, undefined); assert.ok(["image/jpeg", "image/png"].includes(image.mimeType));
      const view = document.bufferViews[image.bufferView], offset = binaryStart+(view.byteOffset ?? 0);
      if (image.mimeType === "image/jpeg") assert.equal(bytes.readUInt16BE(offset), 0xffd8);
      else assert.equal(bytes.subarray(offset, offset+8).toString("hex"), "89504e470d0a1a0a", "transparent hair/feathers must retain valid PNG alpha");
    }
    for (const mesh of document.meshes) for (const primitive of mesh.primitives) {
      assert.ok(primitive.attributes.NORMAL !== undefined && primitive.attributes.TEXCOORD_0 !== undefined, "lit real geometry must preserve normals and UVs");
      const accessor = document.accessors[primitive.attributes.POSITION], view = document.bufferViews[accessor.bufferView!];
      assert.equal(accessor.componentType, 5126); assert.equal(accessor.type, "VEC3");
      for (let vertex = 0; vertex < accessor.count; vertex++) for (let axis = 0; axis < 3; axis++) {
        const offset = binaryStart+(view.byteOffset ?? 0)+(accessor.byteOffset ?? 0)+vertex*(view.byteStride ?? 12)+axis*4;
        assert.ok(Number.isFinite(bytes.readFloatLE(offset)), `${file} contains an invalid position`);
      }
      const material = document.materials[primitive.material];
      if (id === "rocky-ground" && ["Earth cut", "Grass blades"].includes(material.name ?? "")) assert.ok(material.pbrMetallicRoughness.baseColorFactor?.slice(0,3).every((value) => value < .3), "cut soil and grass may use dark solid materials, not white placeholders");
      else if (["armored-knight", "orc-digger", "gatehouse", "rocky-ground"].includes(id)) assert.ok(material.pbrMetallicRoughness.baseColorTexture, "original licensed meshes must retain their source textures");
      else assert.ok(material.pbrMetallicRoughness.baseColorTexture || material.pbrMetallicRoughness.baseColorFactor || primitive.attributes.COLOR_0 !== undefined, "authored equipment must have explicit texture, material color or baked vertex colors, never an implicit white placeholder");
    }
    assert.ok(document.meshes.reduce((count, mesh) => count+mesh.primitives.length, 0) <= 10, "static meshes should merge by material");
    if (id === "armored-knight" || id === "rocky-ground") assert.ok(document.materials.some((material) => material.normalTexture && material.pbrMetallicRoughness.metallicRoughnessTexture));
    if (id === "orc-digger") { assert.ok(document.skins?.length); for (const action of ["wait", "walk", "attack", "die"]) assert.ok(document.animations?.some((clip) => clip.name.includes(action))); }
  });
}

test("realistic registry maps all heroes and keeps genders, roles and species distinct", () => {
  assert.equal(realisticModelFor({ kind: "hero", value: ALL_HEROES.find((hero) => hero.id === "tovak")! }), "armored-knight");
  for (const hero of ALL_HEROES) assert.ok(realisticModelFor({ kind: "hero", value: hero }), hero.id);
  for (const unit of ALL_UNIT_DEFS) assert.ok(realisticModelFor({ kind: "unit", value: unit }), unit.id);
  for (const enemy of ALL_ENEMY_TOKENS) assert.ok(realisticModelFor({ kind: "enemy", value: enemy }), enemy.id);
  assert.equal(REALISTIC_ASSETS[realisticModelFor({ kind: "unit", value: ALL_UNIT_DEFS.find((unit) => unit.id === "delphanaMasters")! })!].gender, "female");
  assert.equal(REALISTIC_ASSETS[realisticModelFor({ kind: "unit", value: ALL_UNIT_DEFS.find((unit) => unit.id === "altemMages")! })!].gender, "male");
  const asset = (id: string) => realisticModelFor({ kind: "enemy", value: ALL_ENEMY_TOKENS.find((enemy) => enemy.id === id)! });
  for (const id of ["brown-minotaur-1", "brown-gargoyle-1", "brown-medusa-1", "green-ue-cloud-griffons-1", "brown-ue-hydra-1", "brown-werewolf-1"]) assert.notEqual(asset(id), "orc-digger");
  assert.equal(realisticModelFor({ kind: "site", value: "keep" }), "gatehouse");
  assert.equal(realisticModelFor({ kind: "site", value: "mageTower" }), "env-site-mageTower");
  assert.equal(realisticModelFor({ kind: "site", value: "none" }), undefined);
});

for (const id of Object.keys(REALISTIC_ASSETS) as RealisticModelId[]) test(`realistic ${id} is centered, floor-aligned and constrained to its cell`, () => {
  const source = new T.Group(), mesh = new T.Mesh(new T.BoxGeometry(12, 20, 8), new T.MeshStandardMaterial()); mesh.position.set(40, 12, -20); source.add(mesh);
  const normalized = normalizeRealisticModel(source, id); normalized.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(normalized), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
  assert.ok(Math.abs(bounds.min.y) < 1e-6); assert.ok(Math.abs(center.x) < 1e-6 && Math.abs(center.z) < 1e-6);
  assert.ok(size.y <= REALISTIC_ASSETS[id].height+1e-6); assert.ok(Math.max(size.x,size.z) <= REALISTIC_ASSETS[id].width+1e-6);
  mesh.geometry.dispose(); (mesh.material as T.Material).dispose();
});

function fixture() {
  const scene = new T.Group(), mesh = new T.Mesh(new T.BoxGeometry(1, 2, 1), new T.MeshStandardMaterial()); scene.add(mesh);
  return { asset: { scene, scenes: [scene], animations: [], cameras: [], asset: { version: "2.0" }, userData: {} } as unknown as GLTF, mesh };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("realistic pool caches mobile assets and keeps independent instance transforms", async () => {
  const { asset, mesh } = fixture(); let requests = 0;
  const pool = new RealisticModelPool(4, () => {}, () => {}, async () => { requests++; return asset; });
  const first = pool.create("armored-knight", new T.Group(), "sharp"), second = pool.create("armored-knight", new T.Group(), "sharp"); second.position.x = 5;
  await flush(); assert.equal(requests, 1); assert.equal(first.userData.modelState, "ready"); assert.equal(second.userData.modelState, "ready"); assert.equal(second.position.x, 5);
  assert.notEqual(first.children.at(-1), second.children.at(-1)); assert.equal(first.children[0].visible, false);
  let disposed = 0; mesh.geometry.addEventListener("dispose", () => disposed++);
  pool.release(first); assert.equal(disposed, 0, "removing one instance must not destroy shared geometry");
  pool.dispose(); assert.equal(disposed, 1);
});

test("failed GLB loads leave the original selectable geometry visible", async () => {
  const states: string[] = [], pool = new RealisticModelPool(4, () => {}, (value) => states.push(value), async () => { throw new Error("offline file missing"); });
  const fallback = new T.Group(), slot = pool.create("gatehouse", fallback, "sharp");
  await flush(); assert.equal(slot.userData.modelState, "fallback"); assert.equal(fallback.visible, true); assert.deepEqual(states, ["loading", "fallback"]); pool.dispose();
});

test("late GLB completion cannot resurrect a destroyed board or leak GPU geometry", async () => {
  const { asset, mesh } = fixture(); let resolve!: (asset: GLTF) => void, disposed = 0, updates = 0;
  mesh.geometry.addEventListener("dispose", () => disposed++);
  const pool = new RealisticModelPool(4, () => updates++, () => {}, () => new Promise((done) => { resolve = done; }));
  const slot = pool.create("gatehouse", new T.Group(), "sharp"); pool.dispose(); resolve(asset);
  await flush(); assert.equal(disposed, 1); assert.equal(updates, 0); assert.equal(slot.children.length, 1);
});

test("removed slots do not receive assets while still-live slots share the completed load", async () => {
  const { asset } = fixture(); let resolve!: (asset: GLTF) => void;
  const pool = new RealisticModelPool(4, () => {}, () => {}, () => new Promise((done) => { resolve = done; }));
  const dead = pool.create("gatehouse", new T.Group(), "sharp"), live = pool.create("gatehouse", new T.Group(), "sharp");
  pool.release(dead); resolve(asset); await flush();
  assert.equal(dead.children.length, 1); assert.equal(live.userData.modelState, "ready"); pool.dispose();
});

test("ultra LOD loads both variants; sharp only requests the mobile file", async () => {
  const requests: string[] = [], pool = new RealisticModelPool(4, () => {}, () => {}, async (url) => { requests.push(url); return fixture().asset; });
  const group = pool.create("gatehouse", new T.Group(), "ultra"); await flush();
  assert.equal(requests.length, 2); assert.ok(requests.some((url) => url.endsWith("gatehouse-mobile.glb"))); assert.ok(requests.some((url) => url.endsWith("gatehouse.glb")));
  const lod = group.children.at(-1) as T.LOD; assert.deepEqual(lod.levels.map((level) => level.distance), [0,13]);
  pool.dispose();
});

test("loaded GLB descendants remain ray-selectable as their board cell", async () => {
  const pool = new RealisticModelPool(4, () => {}, () => {}, async () => fixture().asset);
  const group = pool.create("gatehouse", new T.Group(), "sharp"); group.userData.boardTarget = { kind: "cell", cellId: "3,2" };
  await flush(); group.updateMatrixWorld(true);
  const ray = new T.Raycaster(new T.Vector3(0, 5, 0), new T.Vector3(0,-1,0));
  assert.deepEqual(resolveBoardHit(ray.intersectObject(group, true)), { kind: "cell", cellId: "3,2" }); pool.dispose();
});

test("face-down defenders cannot select identity-specific realistic assets", () => {
  const enemy = ALL_ENEMY_TOKENS.find((enemy) => enemy.id === "green-diggers-1")!;
  const description = visibleCellModelData({ id: "0,0", q: 0, r: 0, terrain: "plains", site: "keep", revealed: true, conquered: false, tokenRevealed: false, enemy, enemies: [enemy] });
  assert.equal(realisticModelFor({ kind: "enemy", value: enemy }), "orc-digger");
  assert.deepEqual(description.enemies.map((value) => realisticModelFor({ kind: "enemy", value })), []);
});

test("animated GLB instances have independent skeletons and honor reduced motion", async () => {
  const { asset, mesh } = fixture(), geometry = mesh.geometry;
  geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute(new Uint16Array(geometry.getAttribute("position").count*4),4));
  const weights = new Float32Array(geometry.getAttribute("position").count*4); for (let vertex = 0; vertex < weights.length; vertex+=4) weights[vertex] = 1;
  geometry.setAttribute("skinWeight", new T.Float32BufferAttribute(weights,4));
  const skin = new T.SkinnedMesh(geometry, mesh.material), bone = new T.Bone(); bone.name = "sampleBone"; skin.add(bone); skin.bind(new T.Skeleton([bone]));
  mesh.removeFromParent(); asset.scene.add(skin);
  asset.animations.push(new T.AnimationClip("wait", 1, [new T.NumberKeyframeTrack("sampleBone.position[y]", [0,1], [0,.2])]));
  const pool = new RealisticModelPool(4, () => {}, () => {}, async () => asset);
  const first = pool.create("orc-digger", new T.Group(), "sharp"), second = pool.create("orc-digger", new T.Group(), "sharp"); await flush();
  const bones: T.Bone[] = []; for (const group of [first, second]) group.traverse((object) => { if (object instanceof T.Bone) bones.push(object); });
  assert.equal(bones.length, 2); assert.notEqual(bones[0], bones[1]);
  pool.animate(1000, false); assert.equal(pool.animate(1100,false), true); const position = bones[0].position.y; assert.ok(position > 0);
  assert.equal(pool.animate(1200,true), false); assert.equal(bones[0].position.y, position);
  bones[0].position.x = 4; assert.equal(bones[1].position.x, 0); pool.dispose();
});

test("shared elemental variants cache by actual file but isolate tinted materials", async () => {
  const { asset, mesh } = fixture(); let requests = 0;
  const source = mesh.material as T.MeshStandardMaterial, sourceColor = source.color.getHex();
  const pool = new RealisticModelPool(4, () => {}, () => {}, async () => { requests++; return asset; });
  const red = pool.create("fire-golem", new T.Group(), "sharp"), blue = pool.create("ice-golem", new T.Group(), "sharp"); await flush();
  assert.equal(requests, 1, "aliases must reuse the physical GLB URL rather than download one copy per name");
  const materials = [red, blue].map((group) => { let material: T.Material | undefined; group.children.at(-1)!.traverse((object) => { if (object instanceof T.Mesh) material = object.material as T.Material; }); return material as T.MeshStandardMaterial; });
  assert.notEqual(materials[0], materials[1]); assert.notEqual(materials[0].color.getHex(), materials[1].color.getHex()); assert.equal(source.color.getHex(), sourceColor);
  let disposed = 0; materials[0].addEventListener("dispose", () => disposed++); pool.release(red); assert.equal(disposed, 1); assert.equal(source.color.getHex(), sourceColor); pool.dispose();
});

test("unused model caches are bounded without evicting active board geometry", async () => {
  let disposed = 0, requests = 0;
  const pool = new RealisticModelPool(4, () => {}, () => {}, async () => { requests++; const value = fixture(); value.mesh.geometry.addEventListener("dispose", () => disposed++); return value.asset; });
  const active = pool.create("gatehouse", new T.Group(), "sharp"); await flush();
  for (const id of ["armored-knight", "orc-digger", "rocky-ground", "env-site-village", "env-site-monastery", "env-site-mageTower", "env-terrain-forest"]) {
    const slot = pool.create(id, new T.Group(), "sharp"); await flush(); pool.release(slot);
  }
  assert.equal(disposed, 3, "only four unused files stay cached");
  const stillActive = pool.create("gatehouse", new T.Group(), "sharp"); await flush(); assert.equal(requests, 8); assert.equal(active.userData.modelState, "ready");
  pool.release(stillActive); pool.dispose(); assert.equal(disposed, 8);
});

test("failed model downloads can retry when a fresh instance is requested", async () => {
  let requests = 0;
  const pool = new RealisticModelPool(4, () => {}, () => {}, async () => { requests++; if (requests === 1) throw new Error("transient failure"); return fixture().asset; });
  const failed = pool.create("gatehouse", new T.Group(), "sharp"); await flush(); assert.equal(failed.userData.modelState, "fallback");
  const retry = pool.create("gatehouse", new T.Group(), "sharp"); await flush(); assert.equal(retry.userData.modelState, "ready"); assert.equal(requests, 2); pool.dispose();
});

test("mine crystal appearance changes cannot tint stone, wood or shared materials", () => {
  const source = new T.Group(), crystal = new T.MeshStandardMaterial({ color: "white" }), wall = new T.MeshStandardMaterial({ color: "#8a8670" }); crystal.name = "Crystal / water"; wall.name = "Weathered masonry";
  source.add(new T.Mesh(new T.BoxGeometry(), crystal), new T.Mesh(new T.BoxGeometry(), wall));
  const normalized = normalizeRealisticModel(source, "env-site-mine", { tint: "#ff0000", tintMaterials: "^Crystal / water$" });
  assert.notEqual((source.children[0] as T.Mesh).material, crystal); assert.equal((source.children[1] as T.Mesh).material, wall); assert.equal(crystal.color.getHex(), 0xffffff);
  (normalized.userData.instanceMaterials as T.Material[]).forEach((material) => material.dispose()); source.children.forEach((object) => (object as T.Mesh).geometry.dispose()); crystal.dispose(); wall.dispose();
});

test("tall forest detail does not shrink the footprint of a hex terrain tile", () => {
  const source = new T.Group(), mesh = new T.Mesh(new T.BoxGeometry(1.62888,1.35242,1.88), new T.MeshStandardMaterial()); source.add(mesh);
  const normalized = normalizeRealisticModel(source, "env-terrain-forest"); normalized.updateMatrixWorld(true);
  const size = new T.Box3().setFromObject(normalized).getSize(new T.Vector3());
  assert.ok(Math.abs(size.z-1.88) < .00001); mesh.geometry.dispose(); (mesh.material as T.Material).dispose();
});
