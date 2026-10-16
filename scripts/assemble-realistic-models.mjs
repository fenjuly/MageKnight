/** Assemble generated catalogs. Authoring sources never ship; hashes are checked. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const directory = resolve("public/models/realistic");
const read = (name) => JSON.parse(readFileSync(resolve(directory, name), "utf8"));
const baseline = read("manifest.json").filter((row) => /^(armored-knight|orc-digger|gatehouse|rocky-ground)(-mobile)?\.glb$/.test(row.file));
const records = [...baseline, ...["env", "actor", "creature", "special"].flatMap((group) => read(`${group}-manifest.json`))];
const unique = new Map(records.map((row) => [row.file, row]));
for (const row of unique.values()) {
  const bytes = readFileSync(resolve(directory, row.file));
  if (bytes.length !== row.bytes || createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error(`Asset changed after export: ${row.file}`);
}
const catalogs = { environments: read("env-catalog.json"), actors: read("actor-catalog.json"), creatures: read("creature-catalog.json"), specials: read("special-catalog.json") };
writeFileSync(resolve("lib/realistic-model-catalog.json"), `${JSON.stringify(catalogs, null, 2)}\n`);
writeFileSync(resolve(directory, "manifest.json"), `${JSON.stringify([...unique.values()], null, 2)}\n`);
const credits = [
  "REALISTIC TABLETOP MODELS — attribution, adaptation and sharing notices", "",
  "These are third-party/adapted and original tabletop representations, not official Mage Knight assets or an AAA quality certification. Most poses are static; color families share meshes. Original authors do not endorse this project.", "",
  "armored-knight: Knight, piacenti, CC-BY-3.0, https://opengameart.org/content/knight-2", "https://creativecommons.org/licenses/by/3.0/", "",
  'orc-digger: Orc (3D), Guillaume "GuieA_7" Englert, CC-BY-SA-4.0, https://opengameart.org/content/orc-3d', "https://creativecommons.org/licenses/by-sa/4.0/", "The adapted GLB files remain licensed CC BY-SA 4.0.", "",
  "gatehouse: Daniel Andersson, CC0-1.0, https://opengameart.org/content/medieval-gatehouse", "rocky-ground / ground-*.jpg: Poly Haven Rocky Terrain 02, CC0-1.0, https://polyhaven.com/a/rocky_terrain_02", "https://creativecommons.org/publicdomain/zero/1.0/", "",
  "Changes to licensed assets: restored textures and PBR materials, safe posed-mesh baking, role equipment, UV normalization, geometry merging, embedded texture compression and mobile LOD. Original authors retain attribution; adapted GLB files remain under their listed source/ShareAlike licenses. Source scripts were never executed.", "",
];
for (const [group, assets] of Object.entries(catalogs)) for (const asset of assets) {
  credits.push(`${group} / ${asset.id}: ${asset.name ?? asset.label}`);
  for (const credit of asset.credits ?? [asset]) credits.push(`${credit.author} — ${credit.license}`, credit.source, credit.licenseUrl, credit.credit ?? "");
  if (asset.license) credits.push(`Composite / adapted GLB license: ${asset.license}`);
  credits.push(asset.modifications ?? asset.notes ?? "", "");
}
writeFileSync(resolve(directory, "CREDITS.txt"), `${credits.join("\n")}\n`);
console.log(`Assembled ${unique.size} self-contained GLBs; ${records.reduce((total, row) => total + row.bytes, 0)} bytes.`);
