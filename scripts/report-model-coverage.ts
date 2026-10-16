import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ALL_ENEMY_TOKENS, ALL_HEROES, ALL_UNIT_DEFS, SITE_LABELS, TERRAIN_LABELS, type Enemy, type HeroDef, type SiteType, type Terrain, type UnitDef } from "../lib/game-data";
import { REALISTIC_ASSETS, realisticModelFor, realisticModelUrl, type RealisticModelId } from "../lib/realistic-assets";

export type ModelCatalogEntry = { id: string; name: string } & (
  { kind: "hero"; value: HeroDef } | { kind: "enemy"; value: Enemy } |
  { kind: "unit"; value: UnitDef } | { kind: "terrain"; value: Terrain } |
  { kind: "site"; value: SiteType }
);
export type ModelKind = ModelCatalogEntry["kind"];
export type ModelManifestRecord = { file: string; bytes: number; sha256: string; triangles?: number; [key: string]: unknown };
export type CoverageOptions = {
  entries?: ModelCatalogEntry[];
  publicDirectory?: string;
  manifest?: ModelManifestRecord[];
  assets?: Record<string, Record<string, unknown>>;
  mapModel?: (entry: ModelCatalogEntry) => string | undefined;
  modelUrl?: (id: string, detail: "near" | "far") => string;
};
const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kinds: ModelKind[] = ["hero", "enemy", "unit", "terrain", "site"];

/** Enumerates actual game identities, not just the much smaller asset registry. */
export function modelCatalog(): ModelCatalogEntry[] {
  return [
    ...ALL_HEROES.map((value): ModelCatalogEntry => ({ kind: "hero", id: value.id, name: value.name, value })),
    ...ALL_ENEMY_TOKENS.map((value): ModelCatalogEntry => ({ kind: "enemy", id: value.id, name: value.name, value })),
    ...ALL_UNIT_DEFS.map((value): ModelCatalogEntry => ({ kind: "unit", id: value.id, name: value.name, value })),
    ...(Object.keys(TERRAIN_LABELS) as Terrain[]).map((value): ModelCatalogEntry => ({ kind: "terrain", id: value, name: TERRAIN_LABELS[value], value })),
    ...(Object.keys(SITE_LABELS) as SiteType[]).filter((value) => !["none", "rampager", "dragon"].includes(value)).map((value): ModelCatalogEntry => ({ kind: "site", id: value, name: SITE_LABELS[value], value })),
  ];
}

export function buildModelCoverage(options: CoverageOptions = {}) {
  const entries = options.entries ?? modelCatalog();
  const publicDirectory = options.publicDirectory ?? resolve(projectDirectory, "public");
  const assets: Record<string, Record<string, unknown>> = options.assets ?? REALISTIC_ASSETS;
  const mapModel = options.mapModel ?? realisticModelFor;
  const modelUrl = options.modelUrl ?? ((id: string, detail: "near" | "far") => realisticModelUrl(id as RealisticModelId, detail));
  const manifestProblems: string[] = [];
  let manifest = options.manifest;
  if (!manifest) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(resolve(publicDirectory, "models/realistic/manifest.json"), "utf8"));
      if (!Array.isArray(parsed)) throw new Error("Expected a manifest array");
      manifest = parsed as ModelManifestRecord[];
    } catch (error) { manifest = []; manifestProblems.push(`manifest-unavailable: ${error instanceof Error ? error.message : String(error)}`); }
  }
  const manifestByFile = new Map<string, ModelManifestRecord[]>();
  for (const record of manifest) {
    if (typeof record?.file !== "string") { manifestProblems.push("invalid-manifest-record: missing file"); continue; }
    manifestByFile.set(record.file, [...(manifestByFile.get(record.file) ?? []), record]);
  }
  for (const [file, records] of manifestByFile) if (records.length > 1) manifestProblems.push(`duplicate-manifest-record: ${file}`);
  const cache = new Map<string, ReturnType<typeof inspectFile>>();
  function inspectFile(modelId: string, detail: "near" | "far") {
    const url = modelUrl(modelId, detail), file = url.split("/").at(-1)!;
    const path = resolve(publicDirectory, url.replace(/^\.\//, ""));
    const records = manifestByFile.get(file) ?? [], record = records[0] ?? null;
    const problems: string[] = [];
    let bytes: number | null = null, sha256: string | null = null, validGlb = false;
    const exists = existsSync(path);
    if (!exists) problems.push("missing-file");
    else {
      try {
        const data = readFileSync(path); bytes = data.length; sha256 = createHash("sha256").update(data).digest("hex");
        validGlb = data.length >= 12 && data.toString("ascii", 0, 4) === "glTF" && data.readUInt32LE(4) === 2 && data.readUInt32LE(8) === data.length;
        if (!validGlb) problems.push("invalid-glb");
      } catch { problems.push("unreadable-file"); }
    }
    if (!record) problems.push("missing-manifest-record");
    else {
      if (records.length !== 1) problems.push("duplicate-manifest-record");
      if (bytes !== null && record.bytes !== bytes) problems.push("manifest-byte-mismatch");
      if (sha256 !== null && record.sha256 !== sha256) problems.push("manifest-sha256-mismatch");
    }
    return { detail, url, file, exists, bytes, sha256, validGlb, manifestRecord: record, problems };
  }
  const rows = entries.map((entry) => {
    const modelId = mapModel(entry) ?? null;
    const asset = modelId ? assets[modelId] ?? null : null;
    const problems: string[] = [];
    if (!modelId) problems.push("missing-mapping");
    else if (!asset) problems.push("missing-registry-asset");
    const files = modelId ? (["near", "far"] as const).map((detail) => {
      const key = `${modelId}:${detail}`;
      if (!cache.has(key)) cache.set(key, inspectFile(modelId, detail));
      const file = cache.get(key)!;
      problems.push(...file.problems.map((problem) => `${detail}:${problem}`));
      return file;
    }) : [];
    return { kind: entry.kind, id: entry.id, name: entry.name, modelId, asset, files, technicalCoverage: problems.length ? "uncovered" as const : "covered" as const, problems };
  });
  const summary = Object.fromEntries(kinds.map((kind) => {
    const category = rows.filter((row) => row.kind === kind);
    return [kind, { total: category.length, mapped: category.filter((row) => row.modelId).length, covered: category.filter((row) => row.technicalCoverage === "covered").length, uncovered: category.filter((row) => row.technicalCoverage === "uncovered").length }];
  })) as Record<ModelKind, { total: number; mapped: number; covered: number; uncovered: number }>;
  const identityCounts = new Map<string, number>();
  for (const row of rows) { const key = `${row.kind}:${row.id}`; identityCounts.set(key, (identityCounts.get(key) ?? 0)+1); }
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    definition: "Technical coverage only: identity mapping, registered asset, valid offline near/far GLBs and matching manifest bytes/SHA-256. This does not certify artistic realism, likeness, unique sculpting, animation completeness or visual QA.",
    totals: { entries: rows.length, mapped: rows.filter((row) => row.modelId).length, covered: rows.filter((row) => row.technicalCoverage === "covered").length, uncovered: rows.filter((row) => row.technicalCoverage === "uncovered").length, uniqueMappedAssets: new Set(rows.flatMap((row) => row.modelId ? [row.modelId] : [])).size, uniqueGeometryFiles: new Set(rows.flatMap((row) => row.files.filter((file) => file.detail === "near").map((file) => file.file))).size },
    summary, duplicateIdentities: [...identityCounts].filter(([, count]) => count > 1).map(([identity, count]) => ({ identity, count })), manifestProblems,
    assetReuse: [...new Set(rows.flatMap((row) => row.modelId ? [row.modelId] : []))].map((modelId) => ({ modelId, identities: rows.filter((row) => row.modelId === modelId).map((row) => `${row.kind}:${row.id}`) })),
    fileReuse: [...new Set(rows.flatMap((row) => row.files.filter((file) => file.detail === "near").map((file) => file.file)))].map((file) => ({ file, modelIds: [...new Set(rows.filter((row) => row.files.some((candidate) => candidate.file === file)).flatMap((row) => row.modelId ? [row.modelId] : []))], identities: rows.filter((row) => row.files.some((candidate) => candidate.file === file)).map((row) => `${row.kind}:${row.id}`) })),
    rows,
  };
}

const escapeCell = (value: unknown) => String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
export function renderModelCoverageMarkdown(report: ReturnType<typeof buildModelCoverage>) {
  const lines = ["# 写实模型技术覆盖报告", "", `生成时间：${report.generatedAt}`, "", "本报告只检查映射、资源文件与清单一致性，不表示写实品质已验收，也不代表每种角色都拥有独立雕刻。共享资产列于下方；物种、角色等元数据以注册表原始记录为准，不自动推断。", "", `共 ${report.totals.entries} 个游戏元素；映射 ${report.totals.mapped}；技术覆盖 ${report.totals.covered}；未覆盖 ${report.totals.uncovered}；使用 ${report.totals.uniqueMappedAssets} 个不同资产。`, "", "| 类别 | 元素数 | 已映射 | 技术覆盖 | 未覆盖 |", "| --- | ---: | ---: | ---: | ---: |"];
  for (const [kind, row] of Object.entries(report.summary)) lines.push(`| ${kind} | ${row.total} | ${row.mapped} | ${row.covered} | ${row.uncovered} |`);
  lines.push("", "## 文件、清单与身份异常", "");
  lines.push(...(report.manifestProblems.length ? report.manifestProblems.map((problem) => `- ${problem}`) : ["- 清单未发现读取或重复记录异常。"]));
  for (const duplicate of report.duplicateIdentities) lines.push(`- duplicate-identity: ${duplicate.identity} × ${duplicate.count}`);
  lines.push("", "## 逐元素清单", "", "| 类别 | 身份 | 名称 | 模型资产 | 近景 / 远景文件 | 技术状态与问题 |", "| --- | --- | --- | --- | --- | --- |");
  for (const row of report.rows) lines.push(`| ${row.kind} | ${escapeCell(row.id)} | ${escapeCell(row.name)} | ${escapeCell(row.modelId)} | ${row.files.map((file) => `${file.detail}: ${file.exists ? "存在" : "缺失"} / ${file.manifestRecord ? "有清单" : "无清单"}`).join("；") || "未映射"} | ${row.technicalCoverage}${row.problems.length ? `: ${row.problems.join("; ")}` : ""} |`);
  lines.push("", "## 共享几何文件", "", `不同模型外观映射 ${report.totals.uniqueMappedAssets} 项，实际使用 ${report.totals.uniqueGeometryFiles} 个近景 GLB。材质变体不计作独立网格。相同来源身体也可能组合不同装备另行导出，sourceBase 保留此关系。`, "");
  for (const group of report.fileReuse.filter((group) => group.modelIds.length > 1)) lines.push(`- ${group.file}：${group.modelIds.join("、")}（${group.identities.length} 个游戏元素）`);
  lines.push("", "## 资产复用与元数据", "", "同一资产的多个映射不等同于多个独立模型。下列元数据保留注册表声明，不能代替人工美术核验。", "");
  for (const group of report.assetReuse) {
    const asset = report.rows.find((row) => row.modelId === group.modelId)?.asset;
    lines.push(`### ${group.modelId}（${group.identities.length} 个元素）`, "", `- 元素：${group.identities.join("、")}`, `- 注册表元数据：${escapeCell(JSON.stringify(asset))}`, "");
  }
  return `${lines.join("\n")}\n`;
}

export function writeModelCoverage(outputDirectory = resolve(projectDirectory, "outputs/model-coverage")) {
  const report = buildModelCoverage(); mkdirSync(outputDirectory, { recursive: true });
  const json = resolve(outputDirectory, "coverage.json"), markdown = resolve(outputDirectory, "coverage.md");
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`); writeFileSync(markdown, renderModelCoverageMarkdown(report));
  return { report, json, markdown };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { report, json, markdown } = writeModelCoverage(process.argv[2] ? resolve(process.argv[2]) : undefined);
  console.log(`Model technical coverage: ${report.totals.covered}/${report.totals.entries}; uncovered: ${report.totals.uncovered}; unique mapped assets: ${report.totals.uniqueMappedAssets}.`);
  console.log(`JSON: ${json}\nMarkdown: ${markdown}`);
}
