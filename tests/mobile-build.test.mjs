import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";
import { createHash } from "node:crypto";

test("builds a self-contained Capacitor web bundle", async () => {
  const html = await readFile(new URL("../dist-mobile/index.html", import.meta.url), "utf8");
  assert.ok(!(await readdir(new URL("../dist-mobile/", import.meta.url))).includes("combat-ui-test.html"), "the development-only combat fixture must not ship in the APK");
  assert.ok(!(await readdir(new URL("../dist-mobile/", import.meta.url))).includes("hand-ui-test.html"), "the hand regression fixture must not ship in the APK");
  assert.ok(!(await readdir(new URL("../dist-mobile/", import.meta.url))).includes("map-intel-test.html"), "the 3D map-intel regression fixture must not ship in the APK");
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\.\/assets\/[^"']+\.js/);

  for (const asset of [
    "hero-atlas.png",
    "hero-atlas-v2.jpg",
    "enemy-atlas.png",
    "site-model-atlas.png",
    "site-model-atlas-v2.jpg",
    "basic-card-atlas.png",
    "advanced-card-atlas.png",
    "magic-card-atlas.png",
  ]) {
    const info = await stat(new URL(`../dist-mobile/assets/${asset}`, import.meta.url));
    assert.ok(info.size > 0, `${asset} should be copied into the offline APK bundle`);
  }

  const files = await readdir(new URL("../dist-mobile/assets/", import.meta.url));
  const sceneChunk = files.find((file) => /^three-board-.*\.js$/.test(file));
  assert.ok(sceneChunk, "the lazy 3D renderer and models must be bundled for offline Android");
  const mainChunk = files.find((file) => /^index-.*\.js$/.test(file));
  assert.ok(mainChunk);
  assert.ok((await readFile(new URL(`../dist-mobile/assets/${mainChunk}`, import.meta.url), "utf8")).includes(sceneChunk), "the app must load its local 3D chunk");
});

test("Android includes every self-contained realistic GLB and its attribution offline", async () => {
  const directory = new URL("../dist-mobile/models/realistic/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", directory), "utf8"));
  const source = JSON.parse(await readFile(new URL("../public/models/realistic/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest, source);
  assert.ok(manifest.length >= 150, "all expanded model families must ship, not just the first four samples");
  for (const asset of manifest) {
    const bytes = await readFile(new URL(asset.file, directory));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  }
  const credits = await readFile(new URL("CREDITS.txt", directory), "utf8");
  for (const author of ["piacenti", "GuieA_7", "Daniel Andersson", "Poly Haven"]) assert.ok(credits.includes(author));
  assert.ok(credits.includes("adapted GLB files remain licensed CC BY-SA 4.0"));
});
