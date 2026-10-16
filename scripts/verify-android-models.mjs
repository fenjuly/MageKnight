/** Inspect the actual APK, not only dist-mobile, for stale/missing model data. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const apk = resolve(process.argv[2] ?? "outputs/android/mage-knight-solo-debug.apk");
const unpack = (name) => execFileSync("unzip", ["-p", apk, `assets/public/${name}`], { maxBuffer: 20_000_000 });
const directory = "public/models/realistic/";
const manifest = JSON.parse(readFileSync(`${directory}manifest.json`, "utf8"));
assert.deepEqual(JSON.parse(unpack("models/realistic/manifest.json").toString("utf8")), manifest, "APK must contain the final model manifest");
for (const asset of manifest) {
  const bytes = unpack(`models/realistic/${asset.file}`);
  assert.equal(bytes.length, asset.bytes, `${asset.file}: APK bytes`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, `${asset.file}: APK SHA256`);
}
assert.equal(unpack("models/realistic/CREDITS.txt").toString("utf8"), readFileSync(`${directory}CREDITS.txt`, "utf8"));
const html = readFileSync("dist-mobile/index.html", "utf8");
assert.equal(unpack("index.html").toString("utf8"), html, "APK entry point must match the current mobile build");
for (const [, path] of html.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|css))"/g)) {
  assert.deepEqual(unpack(path), readFileSync(`dist-mobile/${path}`), `APK has stale UI bundle: ${path}`);
}
console.log(`Verified APK: ${apk}\n${manifest.length} offline GLBs, every SHA256, attribution and current JS/CSS entry bundles match.`);
