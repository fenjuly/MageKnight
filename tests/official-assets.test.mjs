import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../official-assets/manifest.json", import.meta.url), "utf8"));
const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("official asset manifest has unique, allowlisted publisher sources", () => {
  const ids = manifest.sources.map((source) => source.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const source of manifest.sources) {
    for (const value of [source.url, source.landingPage]) {
      const url = new URL(value);
      assert.equal(url.protocol, "https:");
      assert.ok(manifest.allowedHosts.includes(url.hostname), `${source.id} uses ${url.hostname}`);
    }
  }
});

test("automatic downloads are local reference documents and never UI assets", () => {
  const downloads = manifest.sources.filter((source) => source.download);
  assert.equal(downloads.length, 3);
  for (const source of downloads) {
    assert.equal(source.status, "approved-local-reference-download");
    assert.equal(source.category, "reference-document");
    assert.equal(source.evidence.kind, "publisher-download-link");
    assert.equal(source.usage, "local-reference-only");
    assert.equal(source.redistributable, false);
    assert.equal(source.uiEligible, false);
    assert.match(source.destination, /^reference\/[^/]+\.pdf$/);
  }
});

test("official gallery images remain quarantined until written permission exists", () => {
  const candidates = manifest.sources.filter((source) => !source.download);
  assert.ok(candidates.length > 0);
  for (const source of candidates) {
    assert.equal(source.status, "pending-written-permission");
    assert.equal(source.usage, "metadata-only");
    assert.equal(source.uiEligible, false);
    assert.equal(source.redistributable, false);
    assert.equal(source.destination, undefined);
  }
});

test("collector dry run is offline, cache-only and reports the quarantine", () => {
  const result = spawnSync(process.execPath, ["scripts/collect-official-assets.mjs", "--dry-run"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.dryRun, true);
  assert.equal(report.downloads.length, 3);
  assert.ok(report.quarantined.some((source) => source.id === "mkue-official-gallery"));
  assert.match(gitignore, /^\/\.cache\/official-assets\/$/m);
  assert.equal(packageJson.scripts["assets:official"], "node scripts/collect-official-assets.mjs");
});
