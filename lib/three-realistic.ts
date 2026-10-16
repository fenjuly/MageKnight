import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { REALISTIC_ASSETS, realisticModelUrl, type RealisticModelId } from "./realistic-assets";
import type { RealisticAsset } from "./realistic-registry";
import type { ThreeQuality } from "./three-quality";

/** Geometry/texture ownership stays with this renderer's asset pool. Instances
 * never dispose shared GLTF resources; late requests cannot resurrect a board. */
export function releaseAsset(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(material); for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value); }
    if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
  });
  geometries.forEach((value) => value.dispose()); materials.forEach((value) => value.dispose()); textures.forEach((value) => { value.dispose(); if (typeof ImageBitmap !== "undefined" && value.image instanceof ImageBitmap) value.image.close(); });
}

/** Normalize every file to tabletop units without overwriting instance poses. */
export function normalizeRealisticModel(root: T.Object3D, id: RealisticModelId, appearance?: Pick<RealisticAsset, "tint" | "tintMaterials" | "tintMode">) {
  const wrapper = new T.Group(); wrapper.add(root);
  wrapper.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(root), size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3()), profile = { ...REALISTIC_ASSETS[id], ...appearance };
  const scale = Math.min(profile.height / Math.max(size.y, .0001), profile.width / Math.max(size.x, size.z, .0001));
  if (profile.tint) {
    const tintColor = profile.tint;
    const expression = new RegExp(profile.tintMaterials ?? ".*", "i"), replacements = new Map<T.Material, T.Material>();
    root.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      const tint = (material: T.Material) => {
        if (!(material instanceof T.MeshStandardMaterial) || !expression.test(material.name)) return material;
        let replacement = replacements.get(material);
        if (!replacement) { replacement = material.clone(); const color = (replacement as T.MeshStandardMaterial).color; if (profile.tintMode === "replace") color.set(tintColor); else color.multiply(new T.Color(tintColor)); replacements.set(material, replacement); }
        return replacement;
      };
      object.material = Array.isArray(object.material) ? object.material.map(tint) : tint(object.material);
    });
    // Per-instance material copies share textures but never mutate their source.
    wrapper.userData.instanceMaterials = [...replacements.values()];
  }
  root.position.sub(new T.Vector3(center.x, bounds.min.y, center.z)); wrapper.scale.setScalar(scale);
  wrapper.name = `realistic:${id}`; Object.assign(wrapper.userData, { realisticModel: id, source: profile.source, license: profile.license });
  return wrapper;
}

export function createStudioEnvironment(renderer: T.WebGLRenderer, scene: T.Scene) {
  const room = new RoomEnvironment(), generator = new T.PMREMGenerator(renderer), target = generator.fromScene(room, .04);
  scene.environment = target.texture; scene.environmentIntensity = .65;
  room.dispose(); generator.dispose();
  return () => { scene.environment = null; target.dispose(); };
}

type Slot = { group: T.Group; fallback: T.Object3D; asset?: T.LOD; mixers: T.AnimationMixer[]; alive: boolean; urls: string[] };
type AssetStatus = "loading" | "ready" | "fallback";
export class RealisticModelPool {
  private cache = new Map<string, Promise<GLTF>>();
  private loaded = new Map<string, GLTF>();
  private references = new Map<string, number>();
  private slots = new Set<Slot>();
  private disposed = false;
  private clock = 0;
  constructor(private anisotropy: number, private changed: () => void, private status: (value: AssetStatus) => void = () => {}, private fetchModel: (url: string) => Promise<GLTF> = (url) => new GLTFLoader().loadAsync(url)) {}
  private load(id: RealisticModelId, detail: "near" | "far") {
    const url = realisticModelUrl(id, detail);
    let request = this.cache.get(url);
    if (!request) {
      request = this.fetchModel(url).then((asset) => {
        if (this.disposed) { releaseAsset(asset.scene); throw new Error("model pool closed"); }
        asset.scene.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          object.castShadow = true; object.receiveShadow = true;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            for (const value of Object.values(material)) if (value instanceof T.Texture) value.anisotropy = Math.min(8, this.anisotropy);
          }
        });
        this.loaded.set(url, asset); this.prune(); return asset;
      }).catch((error) => { this.cache.delete(url); throw error; });
      this.cache.set(url, request);
    }
    return request;
  }
  /** Keep only a small number of unused resources when switching view/style.
   * Live board instances retain shared textures until their last owner leaves. */
  private prune() {
    const unused = [...this.loaded.keys()].filter((url) => !this.references.get(url));
    for (const url of unused.slice(0, Math.max(0, unused.length - 4))) {
      releaseAsset(this.loaded.get(url)!.scene); this.loaded.delete(url); this.cache.delete(url);
    }
  }
  create(id: RealisticModelId, fallback: T.Object3D, quality: ThreeQuality, appearance?: Pick<RealisticAsset, "tint" | "tintMaterials" | "tintMode">) {
    const group = new T.Group(); group.add(fallback);
    const urls = [...new Set([realisticModelUrl(id, "far"), ...(quality === "ultra" ? [realisticModelUrl(id, "near")] : [])])];
    for (const url of urls) this.references.set(url, (this.references.get(url) ?? 0)+1);
    const slot: Slot = { group, fallback, mixers: [], alive: true, urls }; this.slots.add(slot);
    group.userData.realisticSlot = slot;
    this.status("loading");
    const far = this.load(id, "far"), near = quality === "ultra" ? this.load(id, "near") : far;
    void Promise.all([near, far]).then(([nearAsset, farAsset]) => {
      if (this.disposed || !slot.alive) return;
      const lod = new T.LOD();
      for (const [asset, distance] of nearAsset === farAsset ? [[farAsset, 0] as const] : [[nearAsset, 0] as const, [farAsset, 13] as const]) {
        const instance = clone(asset.scene); const model = normalizeRealisticModel(instance, id, appearance); lod.addLevel(model, distance);
        const idle = asset.animations.find((clip) => /idle|stand|breath|rest|wait/i.test(clip.name));
        if (idle) { const mixer = new T.AnimationMixer(instance); mixer.clipAction(idle).play(); slot.mixers.push(mixer); }
      }
      fallback.visible = false; group.add(lod); slot.asset = lod;
      group.userData.modelState = "ready"; this.status("ready"); this.changed();
    }).catch(() => {
      if (this.disposed || !slot.alive) return;
      group.userData.modelState = "fallback"; fallback.visible = true; this.status("fallback"); this.changed();
    });
    return group;
  }
  release(root: T.Object3D) {
    root.traverse((object) => {
      const slot = object.userData.realisticSlot as Slot | undefined; if (!slot || !slot.alive) return;
      slot.alive = false; slot.mixers.forEach((mixer) => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
      slot.asset?.traverse((node) => { if (node instanceof T.SkinnedMesh) node.skeleton.dispose(); (node.userData.instanceMaterials as T.Material[] | undefined)?.forEach((material) => material.dispose()); });
      for (const url of slot.urls) { const remaining = (this.references.get(url) ?? 1)-1; if (remaining) this.references.set(url, remaining); else this.references.delete(url); }
      this.slots.delete(slot); delete object.userData.realisticSlot;
    });
    this.prune();
  }
  animate(time: number, reducedMotion: boolean) {
    const delta = this.clock ? Math.min(.05, (time - this.clock) / 1000) : 0; this.clock = time;
    let changed = false;
    for (const slot of this.slots) if (!reducedMotion) for (const mixer of slot.mixers) { mixer.update(delta); changed = true; }
    return changed;
  }
  dispose() {
    this.disposed = true; for (const slot of [...this.slots]) this.release(slot.group);
    this.loaded.forEach((asset) => releaseAsset(asset.scene)); this.loaded.clear(); this.cache.clear(); this.references.clear();
  }
}
