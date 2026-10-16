import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ALL_HEROES, ALL_RUIN_TOKEN_BY_ID, SITE_LABELS, TERRAIN_LABELS, TERRAIN_COSTS, getUnit, type MapCell, type HeroDef, type Enemy, type UnitDef, type Terrain, type SiteType } from "./game-data";
import { availableTileExplorations, enemiesOnCell, isAdjacent, tileCenterCoordinates, type GameState } from "./game-engine";
import { ModelKit, MANA_3D, TERRAIN_3D, cellWorldPosition, disposeModel } from "./three-models";
import { readThreeQuality, threeRenderResolution, visibleScreenLabels, type ScreenLabel, type ThreeQuality } from "./three-quality";
import { readModelStyle, realisticModelFor, type ModelStyle } from "./realistic-assets";
import { RealisticModelPool, createStudioEnvironment } from "./three-realistic";
import { MAP_MANA_COLORS, publicCellIntel, publicSiteAccent } from "./map-intel";

export type BoardTarget = { kind: "cell"; cellId: string } | { kind: "explore"; tq: number; tr: number };
export interface BoardCallbacks { select(target: BoardTarget): void; inspect(cellId: string): void; openWiki(cellId: string): void; zoom(value: number): void; fail(message: string): void }
export interface Board3DHandle { update(state: GameState): void; selection(target: BoardTarget | null): void; style(value: ModelStyle): void; quality(value: ThreeQuality): void; zoom(factor: number): void; pan(x: number, z: number): void; rotate(angle: number): void; tilt(): void; reset(): void; dispose(): void }
export type ModelPreviewEntry = { kind: "hero"; value: HeroDef } | { kind: "enemy"; value: Enemy } | { kind: "unit"; value: UnitDef } | { kind: "terrain"; value: Terrain } | { kind: "site"; value: SiteType };

/** A rule-aware render description never exposes a face-down defender. */
export function visibleCellModelData(cell: MapCell) {
  return { terrain: cell.terrain, site: cell.site, enemies: cell.tokenRevealed && !cell.conquered ? enemiesOnCell(cell) : [], concealed: !cell.tokenRevealed && Boolean(cell.enemy) && !cell.conquered, ruin: cell.site === "ruins" && cell.tokenRevealed && !cell.conquered ? ALL_RUIN_TOKEN_BY_ID[cell.ruinTokenId ?? ""] : undefined };
}

export function resolveBoardHit(intersections: Array<{ object: T.Object3D }>): BoardTarget | undefined {
  for (const hit of intersections) { let object: T.Object3D | null = hit.object; while (object) { if (object.userData.boardTarget) return object.userData.boardTarget as BoardTarget; object = object.parent; } }
}

/** Persistent intent overlay is independent of hover and not ray-pickable.
 * Depth testing is off so sculpted hills/buildings cannot bury the outline. */
export function createBoardSelectionOverlay() {
  const group = new T.Group(); group.name = "board-selection"; group.visible = false;
  for (const [inner, outer, opacity] of [[.91,.97,.98], [.84,.855,.65], [0,.90,.09]]) {
    const mesh = new T.Mesh(new T.RingGeometry(inner,outer,6), new T.MeshBasicMaterial({ color: "#ffdc86", transparent:true, opacity, depthWrite:false, depthTest:false, side:T.DoubleSide }));
    mesh.rotation.x = -Math.PI/2; mesh.rotation.z = Math.PI/6; mesh.renderOrder = 1000; group.add(mesh);
  }
  return group;
}

export function fitPerspectiveToBounds(camera: T.PerspectiveCamera, bounds: T.Box3, center: T.Vector3) {
  const direction = new T.Vector3(0, .87, .73).normalize(), size = bounds.getSize(new T.Vector3());
  let distance = Math.max(9, Math.max(size.x / camera.aspect, size.z) / (2 * Math.tan(T.MathUtils.degToRad(camera.fov) / 2)));
  const corners = [bounds.min.x, bounds.max.x].flatMap((x) => [bounds.min.y, bounds.max.y].flatMap((y) => [bounds.min.z, bounds.max.z].map((z) => new T.Vector3(x, y, z))));
  for (let iteration = 0; iteration < 30; iteration++) {
    camera.position.copy(center).addScaledVector(direction, distance); camera.lookAt(center); camera.updateMatrixWorld(true);
    if (corners.every((corner) => { const projected = corner.clone().project(camera); return Math.abs(projected.x) < .92 && Math.abs(projected.y) < .86; })) return distance;
    distance *= 1.08;
  }
  return distance;
}

function sizeRenderer(renderer: T.WebGLRenderer, host: HTMLElement, quality: ThreeQuality) {
  const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
  const resolution = threeRenderResolution(width, height, window.devicePixelRatio, quality, renderer.capabilities.maxTextureSize);
  if (Math.abs(renderer.getPixelRatio() - resolution.pixelRatio) > .0001) renderer.setPixelRatio(resolution.pixelRatio);
  renderer.setSize(width, height, false);
}

export function createThreeBoard(host: HTMLElement, initial: GameState, callbacks: BoardCallbacks): Board3DHandle {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  let quality = readThreeQuality();
  let modelStyle = readModelStyle();
  renderer.setClearColor("#142722"); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = !coarse; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.className = "three-board-canvas"; renderer.domElement.setAttribute("aria-label", "3D 微缩地图；拖动平移、滚轮缩放、右键拖动旋转、点击地块预览行动"); renderer.domElement.setAttribute("role", "img"); host.appendChild(renderer.domElement);
  const labelLayer = document.createElement("div"); labelLayer.className = "three-map-labels"; labelLayer.setAttribute("aria-hidden", "true"); host.appendChild(labelLayer);
  const scene = new T.Scene(); scene.fog = new T.FogExp2("#142722", .004);
  const releaseEnvironment = createStudioEnvironment(renderer, scene);
  const camera = new T.PerspectiveCamera(37, 1, .1, 250);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .12; controls.screenSpacePanning = false;
  controls.minDistance = 4; controls.maxDistance = 58; controls.minPolarAngle = .2; controls.maxPolarAngle = Math.PI / 2.3;
  controls.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.ROTATE };
  controls.touches = { ONE: T.TOUCH.PAN, TWO: T.TOUCH.DOLLY_ROTATE };
  controls.panSpeed = .85; controls.rotateSpeed = .55; controls.zoomSpeed = .7;
  const hemisphere = new T.HemisphereLight("#e4eddf", "#424b40", 2.1); scene.add(hemisphere);
  const sun = new T.DirectionalLight("#ffe7be", 3); sun.position.set(-8, 19, 9); sun.castShadow = !coarse; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22; sun.shadow.camera.far = 65; sun.shadow.normalBias = .035; scene.add(sun);
  const rim = new T.DirectionalLight("#a3c8d8", 1.2); rim.position.set(5, 7, -12); scene.add(rim);
  const floor = new T.Mesh(new T.PlaneGeometry(160, 160), new T.MeshStandardMaterial({ color: "#203e33", roughness: .98 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.27; floor.receiveShadow = true; scene.add(floor);
  const content = new T.Group(); scene.add(content);
  const pickables: T.Object3D[] = [];
  const kit = new ModelKit();
  const cellGroups = new Map<string, { signature: string; group: T.Group }>();
  const labels = new Map<T.Object3D, { element: HTMLSpanElement; id: number; priority: number; width: number; height: number }>();
  let nextLabelId = 0;
  let actors = new T.Group(), explorations = new T.Group(), state = initial;
  content.add(actors, explorations);
  const raycaster = new T.Raycaster(), cursor = new T.Vector2();
  let down: { x: number; y: number; id: number; started: number; button: number } | null = null;
  const activePointers = new Set<number>(); let multiGesture = false, lastHover = "", frame = 0, disposed = false, homeDistance = 17, dirty = true, frameTime = 0;
  let heroGroup: T.Group | undefined; let armySignature = "", explorationSignature = "", phaseSignature = "";
  const modelStatus = document.createElement("span"); modelStatus.className = "three-model-status"; modelStatus.setAttribute("role", "status"); host.appendChild(modelStatus);
  let assetFailed = false;
  modelStatus.textContent = modelStyle === "classic" || quality === "performance" ? "简约模型" : "精细模型";
  const models = new RealisticModelPool(renderer.capabilities.getMaxAnisotropy(), () => { dirty = true; }, (status) => {
    if (status === "fallback") assetFailed = true;
    modelStatus.textContent = assetFailed ? "部分精细模型未加载 · 已保留简约模型" : status === "loading" ? "精细模型 · 载入中" : "精细模型 · 已启用";
  });
  const detailed = (entry: ModelPreviewEntry, fallback: T.Group, mineColor?: string) => {
    const id = realisticModelFor(entry);
    return id && modelStyle === "realistic" && quality !== "performance" ? models.create(id, fallback, quality, mineColor ? { tint: MANA_3D[mineColor], tintMaterials: "^Crystal / water$", tintMode: "replace" } : undefined) : fallback;
  };
  const label = (text: string, position: [number, number, number], color = "#e9dfc3", priority = 10) => {
    const anchor = new T.Group(); anchor.position.set(...position);
    const element = document.createElement("span"); element.className = "three-map-label"; element.textContent = text; element.style.color = color; element.style.visibility = "hidden"; labelLayer.appendChild(element);
    labels.set(anchor, { element, id: nextLabelId++, priority, width: element.offsetWidth, height: element.offsetHeight });
    return anchor;
  };
  const removeGroup = (group: T.Group) => { models.release(group); group.traverse((object) => { const label = labels.get(object); if (label) { label.element.remove(); labels.delete(object); } if (object instanceof T.Mesh && object.userData.ownedMaterial) (object.material as T.Material).dispose(); }); disposeModel(group); };
  const labelWorld = new T.Vector3();
  function positionLabels() {
    const width = host.clientWidth, height = host.clientHeight, deviceRatio = window.devicePixelRatio || 1;
    const candidates: ScreenLabel[] = [];
    labels.forEach((record, anchor) => {
      if (!anchor.visible) { record.element.style.visibility="hidden"; return; }
      anchor.getWorldPosition(labelWorld); labelWorld.project(camera);
      const x = (labelWorld.x + 1) * width / 2, y = (1 - labelWorld.y) * height / 2;
      if (labelWorld.z < -1 || labelWorld.z > 1 || x < 0 || x > width || y < 0 || y > height) { record.element.style.visibility = "hidden"; return; }
      const snappedX = Math.round(x * deviceRatio) / deviceRatio, snappedY = Math.round(y * deviceRatio) / deviceRatio;
      record.element.style.left = `${snappedX}px`; record.element.style.top = `${snappedY}px`;
      candidates.push({ id: record.id, x: snappedX, y: snappedY, width: record.width, height: record.height, priority: record.priority });
    });
    const visible = visibleScreenLabels(candidates);
    labels.forEach((record) => { record.element.style.visibility = visible.has(record.id) ? "visible" : "hidden"; });
  }
  const highlight = new T.Mesh(new T.RingGeometry(.84, .89, 6), new T.MeshBasicMaterial({ color: "#b9dfd3", transparent: true, opacity: .7, depthWrite: false, depthTest:false, side: T.DoubleSide })); highlight.rotation.x = -Math.PI / 2; highlight.rotation.z = Math.PI / 6; highlight.visible = false; highlight.renderOrder=999; scene.add(highlight);
  const selectionOverlay = createBoardSelectionOverlay(); scene.add(selectionOverlay);
  const selectedLabel = label("", [0,0,0], "#ffdf8f", 1000); scene.add(selectedLabel);
  labels.get(selectedLabel)!.element.classList.add("three-selection-label"); selectedLabel.visible=false;
  let selectedTarget: BoardTarget | null = null;
  function selection(target: BoardTarget | null) {
    selectedTarget=target; selectionOverlay.visible=false; selectedLabel.visible=false;
    if (target) {
      const cell = target.kind === "cell" ? state.map.find((cell)=>cell.id===target.cellId) : undefined;
      if (target.kind === "explore" || cell) {
        const coords = cell ?? (target.kind === "explore" ? tileCenterCoordinates(target.tq,target.tr) : {q:0,r:0}), point=cellWorldPosition(coords.q,coords.r);
        selectionOverlay.position.set(point.x, (cell ? TERRAIN_3D[cell.terrain].height : 0)+.05, point.z); selectionOverlay.scale.setScalar(cell ? 1 : 2.65); selectionOverlay.visible=true;
        selectedLabel.position.set(point.x, (cell ? TERRAIN_3D[cell.terrain].height : 0)+1.7, point.z); selectedLabel.visible=true;
        const record=labels.get(selectedLabel)!, intel=cell ? publicCellIntel(cell,state.difficulty) : undefined;
        record.element.textContent=intel ? `已选中 · ${intel.name}${intel.shortMineLabel ? ` · ${intel.shortMineLabel}` : ""}` : "已选中 · 探索新板块"; record.width=record.element.offsetWidth; record.height=record.element.offsetHeight;
      }
    }
    dirty=true;
  }
  const aim = new T.Vector3();
  function pick(event: { clientX: number; clientY: number }) { const rect = renderer.domElement.getBoundingClientRect(); cursor.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(cursor, camera); return resolveBoardHit(raycaster.intersectObjects(pickables, true)); }
  function inspectAt(event: PointerEvent) { if (activePointers.size || event.pointerType !== "mouse") return; const target = pick(event); if (target?.kind === "cell") { const cell = state.map.find((candidate) => candidate.id === target.cellId); if (cell) { const p = cellWorldPosition(cell.q, cell.r); highlight.position.set(p.x, TERRAIN_3D[cell.terrain].height + .035, p.z); highlight.visible = true; if (lastHover !== cell.id) { lastHover = cell.id; callbacks.inspect(cell.id); } } } else { highlight.visible = false; lastHover = ""; } dirty = true; }
  function pointerDown(event: PointerEvent) { activePointers.add(event.pointerId); if (activePointers.size > 1) multiGesture = true; if (activePointers.size === 1) { multiGesture = false; down = { x: event.clientX, y: event.clientY, id: event.pointerId, started: performance.now(), button: event.button }; } }
  function pointerUp(event: PointerEvent) { activePointers.delete(event.pointerId); if (!down || down.id !== event.pointerId) return; const click = !multiGesture && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 7; const longPress = performance.now() - down.started > 650; const button = down.button; down = null; if (!click || button !== 0) return; const target = pick(event); if (!target) return; if (target.kind === "cell") { callbacks.inspect(target.cellId); if (longPress) { callbacks.openWiki(target.cellId); return; } } callbacks.select(target); }
  function cancelPointer(event: PointerEvent) { activePointers.delete(event.pointerId); down = null; multiGesture = true; }
  function preventPageZoom(event: WheelEvent) { event.preventDefault(); event.stopPropagation(); }
  function contextMenu(event: MouseEvent) { event.preventDefault(); }
  function pointerLeave() { highlight.visible=false; lastHover=""; dirty=true; }
  renderer.domElement.addEventListener("pointerdown", pointerDown); renderer.domElement.addEventListener("pointermove", inspectAt); renderer.domElement.addEventListener("pointerup", pointerUp); renderer.domElement.addEventListener("pointercancel", cancelPointer);
  renderer.domElement.addEventListener("wheel", preventPageZoom, { passive: false }); renderer.domElement.addEventListener("contextmenu", contextMenu);
  renderer.domElement.addEventListener("pointerleave", pointerLeave);
  const contextLost = (event: Event) => { event.preventDefault(); callbacks.fail("3D 图形上下文已中断，已切回 2D 地图。可稍后重新启用 3D。"); };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  function markDirty() { dirty = true; callbacks.zoom(Math.round(homeDistance / camera.position.distanceTo(controls.target) * 100)); }
  controls.addEventListener("change", markDirty);
  function reset() {
    const points = state.map.map((cell) => cellWorldPosition(cell.q, cell.r));
    const bounds = new T.Box3().setFromPoints(points.map((point) => new T.Vector3(point.x, 0, point.z)));
    const center = bounds.getCenter(new T.Vector3()); center.y = .45; controls.target.copy(center);
    const fitBounds = new T.Box3(); cellGroups.forEach(({ group }) => fitBounds.expandByObject(group)); fitBounds.expandByObject(actors);
    homeDistance = fitPerspectiveToBounds(camera, fitBounds, center);
    controls.maxDistance = Math.max(58, homeDistance * 1.7); controls.update(); dirty = true;
  }
  function update(next: GameState) {
    state = next;
    const current = state.map.find((cell) => cell.id === state.position);
    const nextPhase = `${state.time}-${state.phase}-${state.actionTaken}-${state.position}`;
    for (const cell of state.map) {
      const signature = JSON.stringify([cell, state.time, state.phase, state.actionTaken, current && isAdjacent(current, cell), cell.id === state.position]); const existing = cellGroups.get(cell.id); if (existing?.signature === signature) continue;
      if (existing) removeGroup(existing.group);
      const group = new T.Group(), data = visibleCellModelData(cell), position = cellWorldPosition(cell.q, cell.r), height = TERRAIN_3D[cell.terrain].height;
      group.position.set(position.x, 0, position.z); group.userData.boardTarget = { kind: "cell", cellId: cell.id } satisfies BoardTarget;
      group.add(detailed({ kind: "terrain", value: cell.terrain }, kit.terrain(cell.terrain, cell.id, cell.site !== "none" || Boolean(cell.enemy))));
      if (!["none", "rampager", "dragon"].includes(cell.site)) { const site = detailed({ kind: "site", value: cell.site }, kit.site(cell.site, { id: cell.id, mineColor: cell.mineColor, ruinAltarColor: cell.tokenRevealed ? cell.ruinAltarColor : undefined }), publicSiteAccent(cell)); site.position.y = height; group.add(site); }
      if (data.concealed) { const back = new T.Group(); kit.cylinder(back, "#596a61", [0, height + .31, .15], .21, .26, .56, 6); kit.ring(back, "#b4b498", [0, height + .58, .15], .18, .025); const model = kit.finish(back, `concealed-${cell.id}`, "token-back"); group.add(model); group.add(label("? 未公开", [0, height + 1.05, .08])); }
      else data.enemies.slice(0, 6).forEach((enemy, index) => { const model = detailed({ kind: "enemy", value: enemy }, kit.enemy(enemy)); const count = Math.min(6, data.enemies.length); model.scale.setScalar(count > 1 ? .53 : cell.site === "rampager" || cell.site === "dragon" ? .92 : .6); model.position.set(count === 1 ? 0 : Math.sin(index / count * Math.PI * 2) * .47, height + .04, count === 1 ? .08 : Math.cos(index / count * Math.PI * 2) * .42); if (cell.site !== "rampager" && cell.site !== "dragon") model.position.z += .18; group.add(model); });
      const cost = TERRAIN_COSTS[cell.terrain][state.time];
      const intel=publicCellIntel(cell,state.difficulty);
      const cellText = `${intel.name}${intel.shortMineLabel ? ` · ${intel.shortMineLabel}` : ""} · ${Number.isFinite(cost) ? cost : "×"}${data.enemies.length > 1 ? ` · 守军 ${data.enemies.length}` : ""}`;
      group.add(label(cellText, [0, height + .21, .75], cell.id === state.position ? "#f8d694" : intel.colors.length === 1 ? MAP_MANA_COLORS[intel.colors[0]] : "#e3ddc9", cell.id === state.position ? 100 : intel.colors.length ? 85 : cell.site === "none" ? 10 : 60));
      const marker = intel.badges.find((badge)=>badge.kind==="ruin" || badge.kind==="state" || badge.kind==="city");
      if (marker) group.add(label(marker.kind==="ruin" ? cell.tokenRevealed && data.ruin ? `遗迹 · ${data.ruin.name}` : marker.text : marker.text, [0,height+1.4,0], "#eed18b", 75));
      if (current && isAdjacent(current, cell) && Number.isFinite(cost) && state.phase === "planning" && !state.actionTaken) { const ring = new T.Mesh(new T.RingGeometry(.87, .905, 6), new T.MeshBasicMaterial({ color: "#d4bf84", side: T.DoubleSide, transparent: true, opacity: .46 })); ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 6; ring.position.y = height + .035; ring.userData.ownedGeometry = true; ring.userData.ownedMaterial = true; group.add(ring); }
      content.add(group); cellGroups.set(cell.id, { signature, group });
    }
    for (const [id, entry] of cellGroups) if (!state.map.some((cell) => cell.id === id)) { removeGroup(entry.group); cellGroups.delete(id); }
    const nextArmy = JSON.stringify([state.heroId, state.position, state.units.map((unit) => [unit.id, unit.used, unit.wounded])]);
    if (nextArmy !== armySignature && current) {
      removeGroup(actors); actors = new T.Group(); content.add(actors); const position = cellWorldPosition(current.q, current.r), height = TERRAIN_3D[current.terrain].height;
      actors.position.set(position.x, height + .08, position.z); actors.userData.boardTarget = { kind: "cell", cellId: current.id } satisfies BoardTarget;
      const hero = ALL_HEROES.find((candidate) => candidate.id === state.heroId) ?? ALL_HEROES[0]; heroGroup = detailed({ kind: "hero", value: hero }, kit.hero(hero)); heroGroup.scale.setScalar(.98); heroGroup.position.set(0, 0, .24); actors.add(heroGroup);
      state.units.slice(0, 6).forEach((unit, index) => { const def = getUnit(unit.id); if (!def) return; const model = detailed({ kind: "unit", value: def }, kit.unit(def)); model.scale.setScalar(.36); model.position.set(Math.sin(index * 1.2 - .5) * .58, 0, Math.cos(index * 1.2 - .5) * .45 - .2); if (unit.wounded) model.rotation.z = .5; else if (unit.used) model.rotation.y = Math.PI / 2; actors.add(model); });
      armySignature = nextArmy;
    }
    const targets = availableTileExplorations(state), nextExploration = JSON.stringify([targets, state.phase, state.actionTaken]);
    if (nextExploration !== explorationSignature) {
      removeGroup(explorations); explorations = new T.Group(); content.add(explorations);
      targets.forEach((target) => { const center = tileCenterCoordinates(target.tq, target.tr), position = cellWorldPosition(center.q, center.r), group = new T.Group(); group.position.set(position.x, 0, position.z); group.userData.boardTarget = { kind: "explore", tq: target.tq, tr: target.tr } satisfies BoardTarget;
        const base = new T.Group(); kit.cylinder(base, target.kind === "countryside" ? "#3e6550" : "#76604c", [0, -.04, 0], 2.55, 2.55, .09, 6); group.add(kit.finish(base, `explore-${target.tq},${target.tr}`, "tile-back")); group.add(label("＋ 探索 · 2 移动", [0, .17, 0], "#e9dfc3", 70)); explorations.add(group); }); explorationSignature = nextExploration;
    }
    pickables.length = 0; pickables.push(...[...cellGroups.values()].map((entry) => entry.group), actors, explorations);
    if (phaseSignature !== nextPhase) { sun.color.set(state.time === "day" ? "#ffe7be" : "#a4bddf"); sun.intensity = state.time === "day" ? 3 : 1.6; phaseSignature = nextPhase; }
    selection(selectedTarget);
    dirty = true;
  }
  function resize() { sizeRenderer(renderer, host, quality); camera.aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); labels.forEach((record) => { record.width = record.element.offsetWidth; record.height = record.element.offsetHeight; }); dirty = true; }
  function rebuildModels() { cellGroups.forEach((entry) => { entry.signature = ""; }); armySignature = ""; modelStatus.textContent = modelStyle === "classic" || quality === "performance" ? "简约模型" : "精细模型"; update(state); }
  const observer = new ResizeObserver(resize); observer.observe(host);
  window.addEventListener("resize", resize);
  update(initial); resize(); reset();
  function animate(time: number) {
    if (disposed) return; frame = requestAnimationFrame(animate); if (document.hidden || (coarse && time - frameTime < 32)) return;
    frameTime = time; const changed = controls.update(); if (heroGroup && !reducedMotion.matches) { heroGroup.position.y = Math.sin(time * .0018) * .022; dirty = true; }
    if (models.animate(time, reducedMotion.matches)) dirty = true;
    if (changed || dirty) { renderer.render(scene, camera); positionLabels(); dirty = false; }
  }
  frame = requestAnimationFrame(animate);
  return {
    update, selection,
    style(value) { modelStyle = value; rebuildModels(); },
    quality(value) { quality = value; rebuildModels(); resize(); },
    pan(x, z) { const offset = new T.Vector3(x, 0, z); controls.target.add(offset); camera.position.add(offset); controls.update(); dirty = true; },
    zoom(factor) { aim.copy(camera.position).sub(controls.target).multiplyScalar(factor); const distance = T.MathUtils.clamp(aim.length(), controls.minDistance, controls.maxDistance); aim.setLength(distance); camera.position.copy(controls.target).add(aim); controls.update(); dirty = true; },
    rotate(angle) { aim.copy(camera.position).sub(controls.target).applyAxisAngle(new T.Vector3(0, 1, 0), angle); camera.position.copy(controls.target).add(aim); controls.update(); dirty = true; },
    tilt() { const offset = camera.position.clone().sub(controls.target), spherical = new T.Spherical().setFromVector3(offset); spherical.phi = spherical.phi < .55 ? .95 : spherical.phi < 1.1 ? 1.25 : .4; camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(spherical)); controls.update(); dirty = true; }, reset,
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", resize); controls.dispose(); renderer.domElement.removeEventListener("webglcontextlost", contextLost); renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointermove", inspectAt); renderer.domElement.removeEventListener("pointerup", pointerUp); renderer.domElement.removeEventListener("pointercancel", cancelPointer); renderer.domElement.removeEventListener("wheel", preventPageZoom); renderer.domElement.removeEventListener("contextmenu", contextMenu); renderer.domElement.removeEventListener("pointerleave", pointerLeave); cellGroups.forEach((entry) => removeGroup(entry.group)); removeGroup(actors); removeGroup(explorations); selectionOverlay.traverse((object)=>{if(object instanceof T.Mesh){object.geometry.dispose();(object.material as T.Material).dispose();}}); models.dispose(); releaseEnvironment(); highlight.geometry.dispose(); (highlight.material as T.Material).dispose(); floor.geometry.dispose(); (floor.material as T.Material).dispose(); labelLayer.remove(); modelStatus.remove(); kit.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); },
  };
}

/** Standalone turntable for inspecting every model without altering the game. */
export function createModelViewer(host: HTMLElement, entry: ModelPreviewEntry, style: ModelStyle = readModelStyle()) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.domElement.className = "three-model-viewer"; host.appendChild(renderer.domElement);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(35, 1, .05, 50), kit = new ModelKit();
  const releaseEnvironment = createStudioEnvironment(renderer, scene);
  scene.add(new T.HemisphereLight("#fff1d4", "#465b50", 1)); const light = new T.DirectionalLight("#ffe9c5", 2.5); light.position.set(-3, 5, 4); light.castShadow = true; light.shadow.mapSize.set(512,512); light.shadow.camera.left = -3; light.shadow.camera.right = 3; light.shadow.camera.top = 3; light.shadow.camera.bottom = -3; light.shadow.camera.far = 12; light.shadow.normalBias = .012; scene.add(light); const rim = new T.DirectionalLight("#b2d6f4", 1.1); rim.position.set(3, 4, -4); scene.add(rim);
  const pedestal = new T.Mesh(new T.CylinderGeometry(1, 1.04, .08, 64), new T.MeshStandardMaterial({ color: "#3c453e", roughness: .65, metalness: .25 })); pedestal.position.y = -.06; pedestal.receiveShadow = true; scene.add(pedestal);
  const fallback = entry.kind === "hero" ? kit.hero(entry.value) : entry.kind === "enemy" ? kit.enemy(entry.value) : entry.kind === "unit" ? kit.unit(entry.value) : entry.kind === "terrain" ? kit.terrain(entry.value, "preview") : kit.site(entry.value, { id: "preview", mineColor: "blue", ruinAltarColor: "red" });
  const modelStatus = document.createElement("span"); modelStatus.className = "three-model-status"; modelStatus.setAttribute("role", "status"); host.appendChild(modelStatus);
  const models = new RealisticModelPool(renderer.capabilities.getMaxAnisotropy(), () => reframe(), (status) => { modelStatus.textContent = status === "loading" ? "精细模型加载中…" : status === "ready" ? "精细模型" : "精细模型未加载 · 简约回退"; });
  const id = realisticModelFor(entry), model = id && style === "realistic" ? models.create(id, fallback, "ultra") : fallback; scene.add(model);
  const box = new T.Box3().setFromObject(model), center = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3()), radius = Math.max(.6, size.length() * .55);
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.copy(center); camera.position.copy(center).add(new T.Vector3(1.4, .8, 2.1).normalize().multiplyScalar(radius * 4)); controls.minDistance = radius * 1.4; controls.maxDistance = radius * 9; controls.enableDamping = true; controls.enablePan = false; controls.update();
  function reframe() {
    const lod = model.children.find((child) => child instanceof T.LOD) as T.LOD | undefined;
    const bounds = new T.Box3().setFromObject(lod?.levels[0]?.object ?? model), size = bounds.getSize(new T.Vector3()), middle = bounds.getCenter(new T.Vector3()), radius = Math.max(.45, size.length() * .55);
    const width = Math.max(.4, Math.max(size.x, size.z) * .66); pedestal.scale.set(width, 1, width);
    controls.target.copy(middle); camera.position.copy(middle).add(new T.Vector3(1.4,.8,2.1).normalize().multiplyScalar(radius*3.7)); controls.minDistance = radius*1.2; controls.maxDistance = radius*9; controls.update();
  }
  reframe();
  const wheel = (event: WheelEvent) => { event.preventDefault(); event.stopPropagation(); }; renderer.domElement.addEventListener("wheel", wheel, { passive: false });
  function resize() { camera.aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight); camera.updateProjectionMatrix(); sizeRenderer(renderer, host, readThreeQuality()); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize(); let frame = 0;
  window.addEventListener("resize", resize);
  function animate(time = 0) { frame = requestAnimationFrame(animate); if (document.hidden) return; controls.update(); models.animate(time, matchMedia("(prefers-reduced-motion: reduce)").matches); renderer.render(scene, camera); } animate();
  return { dispose() { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", resize); controls.dispose(); renderer.domElement.removeEventListener("wheel", wheel); models.release(model); disposeModel(model); models.dispose(); releaseEnvironment(); pedestal.geometry.dispose(); pedestal.material.dispose(); modelStatus.remove(); kit.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); } };
}
