import assert from "node:assert/strict";
import test from "node:test";
import * as T from "three";
import { ALL_HEROES, ALL_ENEMY_TOKENS, ALL_UNIT_DEFS, SITE_LABELS, TERRAIN_LABELS, type Terrain, type SiteType, type MapCell } from "../lib/game-data";
import { ModelKit, cellWorldPosition, disposeModel } from "../lib/three-models";
import { fitPerspectiveToBounds, resolveBoardHit, visibleCellModelData } from "../lib/three-board";
import { readThreeQuality, saveThreeQuality, threeRenderResolution, visibleScreenLabels, type ThreeQuality } from "../lib/three-quality";

const kit = new ModelKit();
test.after(() => kit.dispose());
function assertSolid(model: T.Group) {
  assert.ok(model.children.length > 0, model.name);
  const size = new T.Box3().setFromObject(model).getSize(new T.Vector3());
  assert.ok(size.toArray().every((value) => Number.isFinite(value) && value > .05), `${model.name} must occupy all three dimensions`);
  assert.ok(model.children.length <= 16, `${model.name} must keep material draw calls bounded for Android`);
  model.traverse((object) => {
    assert.ok(!(object instanceof T.Sprite), `${model.name} cannot be a portrait billboard`);
    if (!(object instanceof T.Mesh)) return;
    const position = object.geometry.getAttribute("position"), normal = object.geometry.getAttribute("normal");
    assert.ok(position.count > 12 && normal.count === position.count, `${model.name} needs solid lit geometry`);
    assert.ok(Array.from(position.array).every(Number.isFinite));
    assert.ok(object.material instanceof T.MeshStandardMaterial);
  });
  disposeModel(model);
}

for (const hero of ALL_HEROES) test(`3D hero: ${hero.name} has a solid miniature`, () => assertSolid(kit.hero(hero)));
for (const enemy of ALL_ENEMY_TOKENS) test(`3D enemy: ${enemy.id} builds without invalid geometry`, () => assertSolid(kit.enemy(enemy)));
for (const unit of ALL_UNIT_DEFS) test(`3D unit: ${unit.name} builds without portrait planes`, () => assertSolid(kit.unit(unit)));
for (const terrain of Object.keys(TERRAIN_LABELS) as Terrain[]) test(`3D terrain: ${terrain} includes thickness and surface relief`, () => assertSolid(kit.terrain(terrain, "deterministic-terrain")));
for (const site of (Object.keys(SITE_LABELS) as SiteType[]).filter((site) => !["none", "rampager", "dragon"].includes(site))) test(`3D building: ${site} has nonempty solid geometry`, () => assertSolid(kit.site(site, { id: site })));

test("3D hex coordinates preserve all six adjacency distances", () => {
  const center = cellWorldPosition(3, -4);
  for (const [dq, dr] of [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]) {
    const adjacent = cellWorldPosition(3 + dq, -4 + dr);
    assert.ok(Math.abs(Math.hypot(center.x - adjacent.x, center.z - adjacent.z) - Math.sqrt(3)) < 1e-9);
  }
});

test("hidden building defenders cannot leak identity or abilities through 3D meshes", () => {
  const enemy = ALL_ENEMY_TOKENS[0];
  const cell: MapCell = { id: "0,0", q: 0, r: 0, terrain: "plains", site: "keep", revealed: true, conquered: false, tokenRevealed: false, enemy, enemies: [enemy] };
  assert.deepEqual(visibleCellModelData(cell).enemies, []);
  assert.equal(visibleCellModelData(cell).concealed, true);
  assert.equal(visibleCellModelData({ ...cell, tokenRevealed: true }).enemies[0].id, enemy.id);
  assert.deepEqual(visibleCellModelData({ ...cell, conquered: true, tokenRevealed: true }).enemies, []);
});

test("3D ray picking resolves actor descendants to their actual board cell", () => {
  const group = kit.terrain("plains", "pick-test"); group.userData.boardTarget = { kind: "cell", cellId: "2,-1" };
  group.position.set(3, 0, -1); group.updateMatrixWorld(true);
  const ray = new T.Raycaster(new T.Vector3(3, 10, -1), new T.Vector3(0, -1, 0));
  assert.deepEqual(resolveBoardHit(ray.intersectObject(group, true)), { kind: "cell", cellId: "2,-1" });
  const miss = new T.Raycaster(new T.Vector3(20, 10, -1), new T.Vector3(0, -1, 0));
  assert.equal(resolveBoardHit(miss.intersectObject(group, true)), undefined); disposeModel(group);
});

for (const aspect of [.7, 1, 1.6, 2.4]) test(`3D reset frames the whole map at aspect ${aspect} without top/bottom clipping`, () => {
  const camera = new T.PerspectiveCamera(37, aspect, .1, 250);
  const bounds = new T.Box3(new T.Vector3(-7, -.2, -10), new T.Vector3(9, 2.2, 14));
  fitPerspectiveToBounds(camera, bounds, new T.Vector3(1, .5, 2));
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new T.Vector3(x, y, z).project(camera); assert.ok(Math.abs(point.x) < .93 && Math.abs(point.y) < .87, `${point.toArray()}`);
  }
});

test("hero meshes and seeded terrain are deterministic, while hero silhouettes differ", () => {
  const silhouettes = ALL_HEROES.map((hero) => { const model = kit.hero(hero); const size = new T.Box3().setFromObject(model).getSize(new T.Vector3()).toArray(); disposeModel(model); return JSON.stringify(size); });
  assert.ok(new Set(silhouettes).size >= 6);
  const first = kit.terrain("forest", "same-cell"), second = kit.terrain("forest", "same-cell");
  assert.deepEqual((first.children[0] as T.Mesh).geometry.getAttribute("position").array, (second.children[0] as T.Mesh).geometry.getAttribute("position").array); disposeModel(first); disposeModel(second);
});

for (const deviceRatio of [1, 2, 3]) test(`Android clarity: native DPR ${deviceRatio} is preserved in the default sharp profile`, () => {
  const result = threeRenderResolution(560, 330, deviceRatio, "sharp");
  assert.equal(result.pixelRatio, deviceRatio);
  assert.equal(result.width, 560 * deviceRatio);
  assert.equal(result.height, 330 * deviceRatio);
});

test("3D quality profiles increase sampling without changing the CSS viewport", () => {
  const profiles: ThreeQuality[] = ["performance", "sharp", "ultra"];
  const sizes = profiles.map((profile) => threeRenderResolution(560, 330, 3, profile));
  assert.deepEqual(sizes.map((size) => size.pixelRatio), [1.5, 3, 4]);
  for (const size of sizes) assert.equal(size.width / size.height, 560 / 330);
  assert.equal(threeRenderResolution(560, 330, 1, "ultra").pixelRatio, 4 / 3);
});

for (const [quality, budget] of [["performance", 1_500_000], ["sharp", 6_000_000], ["ultra", 10_000_000]] as const) {
  test(`3D ${quality} honors framebuffer pixel budgets across large viewports`, () => {
    for (const [width, height] of [[3840, 2160], [7680, 4320], [800, 2400]]) {
      const result = threeRenderResolution(width, height, 4, quality);
      assert.ok(result.width > 0 && result.height > 0);
      assert.ok(result.width * result.height <= budget);
      assert.ok(Math.abs(result.width / result.height - width / height) < .01);
    }
  });
  test(`3D ${quality} never exceeds the device's maximum framebuffer dimensions`, () => {
    for (const [width, height] of [[1200, 200], [200, 1200]]) {
      const result = threeRenderResolution(width, height, 4, quality, 1024);
      assert.ok(result.width <= 1024 && result.height <= 1024);
      assert.ok(result.pixelRatio < 1, "a huge CSS viewport must not force an unsupported render buffer");
    }
  });
}

test("3D resolution remains finite before layout and with unavailable device pixel density", () => {
  for (const deviceRatio of [0, -1, NaN, Infinity]) {
    const result = threeRenderResolution(0, NaN, deviceRatio, "sharp");
    assert.deepEqual(result, { pixelRatio: 1, width: 1, height: 1 });
  }
});

test("crowded native-size labels prioritize the hero's cell without shrinking text", () => {
  const labels = [
    { id: 0, x: 50, y: 50, width: 70, height: 18, priority: 10 },
    { id: 1, x: 55, y: 50, width: 70, height: 18, priority: 100 },
    { id: 2, x: 180, y: 50, width: 70, height: 18, priority: 60 },
  ];
  assert.deepEqual([...visibleScreenLabels(labels)], [1, 2]);
  assert.deepEqual([...visibleScreenLabels([...labels].reverse())], [1, 2]);
  assert.deepEqual(labels.map((label) => [label.width, label.height]), [[70, 18], [70, 18], [70, 18]]);
  assert.equal(visibleScreenLabels(labels.map((label) => ({ ...label, x: label.id * 140 }))).size, 3, "zooming in brings separated labels back");
});

test("label collision checks both axes and uses stable equal-priority tie breaking", () => {
  const label = { x: 60, y: 60, width: 60, height: 18, priority: 10 };
  assert.deepEqual([...visibleScreenLabels([{ ...label, id: 5 }, { ...label, id: 2 }])], [2]);
  assert.equal(visibleScreenLabels([{ ...label, id: 0 }, { ...label, id: 1, y: 90 }]).size, 2);
  assert.equal(visibleScreenLabels([]).size, 0);
});

test("quality preferences persist, reject old invalid values and tolerate blocked storage", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    assert.equal(readThreeQuality(), "sharp");
    for (const quality of ["performance", "sharp", "ultra"] as const) { saveThreeQuality(quality); assert.equal(readThreeQuality(), quality); }
    values.set("mage-knight-3d-quality", "unsupported"); assert.equal(readThreeQuality(), "sharp");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("storage disabled"); } });
    assert.equal(readThreeQuality(), "sharp");
    assert.doesNotThrow(() => saveThreeQuality("ultra"));
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
