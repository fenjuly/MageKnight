import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALL_ENEMY_TOKENS, ALL_HEROES, ALL_UNIT_DEFS } from "../lib/game-data";
import { buildModelCoverage, modelCatalog, renderModelCoverageMarkdown, type CoverageOptions, type ModelManifestRecord } from "../scripts/report-model-coverage";

test("model inventory includes all game identities, not only existing model mappings", () => {
  const entries = modelCatalog();
  assert.equal(entries.length, 198);
  assert.deepEqual(Object.fromEntries(["hero", "enemy", "unit", "terrain", "site"].map((kind) => [kind, entries.filter((entry) => entry.kind === kind).length])), { hero: 7, enemy: 130, unit: 30, terrain: 10, site: 21 });
  for (const [kind, values] of [["hero", ALL_HEROES], ["enemy", ALL_ENEMY_TOKENS], ["unit", ALL_UNIT_DEFS]] as const) assert.deepEqual(entries.filter((entry) => entry.kind === kind).map((entry) => entry.id), values.map((entry) => entry.id));
  assert.equal(new Set(entries.map((entry) => `${entry.kind}:${entry.id}`)).size, entries.length);
  assert.equal(new Set(entries.filter((entry) => entry.kind === "enemy").map((entry) => entry.id)).size, 130);
  for (const excluded of ["none", "rampager", "dragon"]) assert.ok(!entries.some((entry) => entry.kind === "site" && entry.id === excluded));
});

function fixture(run: (options: CoverageOptions, directory: string, records: ModelManifestRecord[]) => void) {
  const directory = mkdtempSync(join(tmpdir(), "mage-knight-model-coverage-"));
  const modelDirectory = join(directory, "models/realistic"); mkdirSync(modelDirectory, { recursive: true });
  const bytes = Buffer.alloc(12); bytes.write("glTF"); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(12, 8);
  const records = ["fixture.glb", "fixture-mobile.glb"].map((file) => { writeFileSync(join(modelDirectory, file), bytes); return { file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; });
  const options: CoverageOptions = { entries: modelCatalog().slice(0, 1), publicDirectory: directory, manifest: records, assets: { fixture: { species: "human", role: "knight", source: "fixture-only", artisticReview: "not-reviewed" } }, mapModel: () => "fixture", modelUrl: (_, detail) => `./models/realistic/fixture${detail === "far" ? "-mobile" : ""}.glb` };
  try { run(options, directory, records); } finally { rmSync(directory, { recursive: true, force: true }); }
}

test("unmapped identities explicitly remain uncovered", () => {
  const report = buildModelCoverage({ mapModel: () => undefined, manifest: [] });
  assert.equal(report.totals.entries, 198); assert.equal(report.totals.covered, 0); assert.equal(report.totals.uncovered, 198);
  assert.ok(report.rows.every((row) => row.modelId === null && row.problems.includes("missing-mapping") && !row.files.length));
  assert.match(renderModelCoverageMarkdown(report), /missing-mapping/);
});

test("existing near/far files and matching manifests establish only technical coverage", () => fixture((options) => {
  const report = buildModelCoverage(options); assert.equal(report.totals.covered, 1);
  assert.equal(report.rows[0].asset?.species, "human"); assert.equal(report.rows[0].asset?.role, "knight");
  assert.equal(report.rows[0].asset?.artisticReview, "not-reviewed");
  assert.match(report.definition, /does not certify artistic realism/);
  assert.match(renderModelCoverageMarkdown(report), /不表示写实品质已验收/);
}));

test("mapping without an asset registry record does not count as covered", () => fixture((options) => {
  const report = buildModelCoverage({ ...options, assets: {} });
  assert.equal(report.totals.covered, 0); assert.ok(report.rows[0].problems.includes("missing-registry-asset"));
}));

test("missing near or far geometry is reported even if a manifest claims it exists", () => fixture((options, directory) => {
  rmSync(join(directory, "models/realistic/fixture-mobile.glb"));
  const report = buildModelCoverage(options);
  assert.equal(report.totals.covered, 0); assert.ok(report.rows[0].problems.includes("far:missing-file"));
  assert.equal(report.rows[0].files[1].exists, false); assert.ok(report.rows[0].files[1].manifestRecord);
}));

test("unmanifested or tampered resources cannot be marked technically covered", () => fixture((options, directory, records) => {
  const absent = buildModelCoverage({ ...options, manifest: records.slice(0, 1) });
  assert.equal(absent.totals.covered, 0); assert.ok(absent.rows[0].problems.includes("far:missing-manifest-record"));
  writeFileSync(join(directory, "models/realistic/fixture.glb"), "corrupt-resource");
  const corrupt = buildModelCoverage(options); assert.equal(corrupt.totals.covered, 0);
  for (const problem of ["near:invalid-glb", "near:manifest-byte-mismatch", "near:manifest-sha256-mismatch"]) assert.ok(corrupt.rows[0].problems.includes(problem));
}));

test("duplicate manifest records and duplicate game identities are visible diagnostics", () => fixture((options, _, records) => {
  const report = buildModelCoverage({ ...options, entries: [...options.entries!, ...options.entries!], manifest: [...records, records[0]] });
  assert.equal(report.totals.covered, 0); assert.ok(report.manifestProblems.includes("duplicate-manifest-record: fixture.glb"));
  assert.equal(report.duplicateIdentities.length, 1); assert.equal(report.duplicateIdentities[0].count, 2);
}));

test("one shared model mapped to two identities remains one distinct asset", () => fixture((options) => {
  const report = buildModelCoverage({ ...options, entries: modelCatalog().slice(0, 2) });
  assert.equal(report.totals.covered, 2); assert.equal(report.totals.uniqueMappedAssets, 1);
  assert.equal(report.assetReuse[0].identities.length, 2); assert.match(renderModelCoverageMarkdown(report), /不等同于多个独立模型/);
}));

test("separate material aliases still disclose one shared physical geometry file", () => fixture((options) => {
  const report = buildModelCoverage({ ...options, entries: modelCatalog().slice(0,2), assets: { one: {}, two: {} }, mapModel: (entry) => entry.id === "tovak" ? "one" : "two" });
  assert.equal(report.totals.uniqueMappedAssets, 2); assert.equal(report.totals.uniqueGeometryFiles, 1);
  assert.equal(report.fileReuse[0].modelIds.length, 2); assert.equal(report.fileReuse[0].identities.length, 2);
}));

test("missing manifest files are reported without dropping catalog entries", () => fixture((options) => {
  const report = buildModelCoverage({ ...options, manifest: undefined });
  assert.equal(report.totals.entries, 1); assert.equal(report.totals.covered, 0);
  assert.match(report.manifestProblems[0], /manifest-unavailable/);
}));

test("live registry report remains complete and never silently treats missing resources as covered", () => {
  const report = buildModelCoverage(); assert.equal(report.totals.entries, modelCatalog().length);
  assert.equal(report.totals.covered+report.totals.uncovered, report.totals.entries);
  assert.deepEqual(report.duplicateIdentities, []);
  for (const row of report.rows) {
    assert.equal(row.technicalCoverage === "covered", row.problems.length === 0);
    if (row.technicalCoverage === "covered") {
      assert.ok(row.modelId); assert.ok(row.asset); assert.equal(row.files.length, 2);
      for (const file of row.files) { assert.ok(file.exists); assert.ok(file.validGlb); assert.ok(file.manifestRecord); assert.equal(file.sha256, file.manifestRecord.sha256); }
    }
  }
});

test("base and Ultimate model replacement has no missing component identities", () => {
  const report = buildModelCoverage();
  assert.equal(report.totals.uncovered, 0, report.rows.filter((row) => row.technicalCoverage === "uncovered").map((row) => `${row.kind}:${row.id} ${row.problems.join(",")}`).join("\n"));
  assert.equal(report.totals.covered, 198);
});
