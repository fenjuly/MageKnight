import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(projectRoot, "official-assets/manifest.json");
const defaultCacheRoot = resolve(projectRoot, ".cache/official-assets");
const cacheRoot = resolve(process.env.MK_OFFICIAL_ASSET_CACHE || defaultCacheRoot);
const dryRun = process.argv.includes("--dry-run");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const allowedHosts = new Set(manifest.allowedHosts);

function assertOfficialUrl(value, label) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error(`${label} is not an allowlisted HTTPS publisher URL: ${value}`);
  }
  return url;
}

function safeDestination(relativePath) {
  const absolutePath = resolve(cacheRoot, relativePath);
  if (absolutePath !== cacheRoot && !absolutePath.startsWith(`${cacheRoot}${sep}`)) {
    throw new Error(`Destination escapes the private cache: ${relativePath}`);
  }
  return absolutePath;
}

function validateSource(source) {
  assertOfficialUrl(source.url, source.id);
  assertOfficialUrl(source.landingPage, `${source.id} landing page`);
  if (source.uiEligible && !source.permissionEvidence) {
    throw new Error(`${source.id} cannot be UI eligible without written permission evidence`);
  }
  if (source.download) {
    if (source.status !== "approved-local-reference-download" || source.category !== "reference-document" || source.usage !== "local-reference-only" || source.redistributable !== false || source.uiEligible !== false) {
      throw new Error(`${source.id} is not safe for automatic local-reference download`);
    }
    if (source.evidence?.kind !== "publisher-download-link" || !source.destination || !source.expectedContentType) {
      throw new Error(`${source.id} is missing download evidence or output metadata`);
    }
    safeDestination(source.destination);
  } else if (source.status !== "pending-written-permission" || source.usage !== "metadata-only") {
    throw new Error(`${source.id} is non-downloadable but is not explicitly quarantined`);
  }
}

for (const source of manifest.sources) validateSource(source);

if (dryRun) {
  const result = {
    dryRun: true,
    cacheRoot,
    downloads: manifest.sources.filter((source) => source.download).map((source) => ({ id: source.id, destination: source.destination })),
    quarantined: manifest.sources.filter((source) => !source.download).map((source) => ({ id: source.id, status: source.status })),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

async function fetchOfficial(url, expectedContentType) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "MageKnightLocalOfficialAssetCollector/1.0" },
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  assertOfficialUrl(response.url, "redirect target");
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() || "application/octet-stream";
  if (expectedContentType && contentType !== expectedContentType) {
    throw new Error(`Unexpected content type for ${url}: ${contentType}`);
  }
  return { bytes: new Uint8Array(await response.arrayBuffer()), contentType, finalUrl: response.url };
}

function extractCandidateUrls(html, discovery) {
  const decoded = html.replaceAll("&amp;", "&").replaceAll("\\/", "/");
  const urls = decoded.match(/https:\/\/[^\s"'<>]+/g) || [];
  return [...new Set(urls)].filter((value) => {
    try {
      const url = assertOfficialUrl(value, "discovered candidate");
      const extension = discovery.extensions.find((item) => url.pathname.toLowerCase().endsWith(item));
      const isOriginalSize = !/-\d+x\d+\.[a-z0-9]+$/i.test(url.pathname);
      return Boolean(extension && isOriginalSize && discovery.urlFragments.some((fragment) => url.pathname.includes(fragment)));
    } catch {
      return false;
    }
  }).sort();
}

await mkdir(cacheRoot, { recursive: true });
const downloaded = [];
const discoveredCandidates = [];

for (const source of manifest.sources) {
  if (source.download) {
    const result = await fetchOfficial(source.url, source.expectedContentType);
    const destination = safeDestination(source.destination);
    const temporary = `${destination}.partial`;
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(temporary, result.bytes);
    await rename(temporary, destination);
    downloaded.push({
      id: source.id,
      title: source.title,
      path: source.destination,
      bytes: result.bytes.byteLength,
      sha256: createHash("sha256").update(result.bytes).digest("hex"),
      contentType: result.contentType,
      sourceUrl: source.url,
      finalUrl: result.finalUrl,
      landingPage: source.landingPage,
      usage: source.usage,
      redistributable: source.redistributable,
      uiEligible: source.uiEligible,
      evidence: source.evidence
    });
    continue;
  }

  if (source.discovery) {
    const result = await fetchOfficial(source.url, "text/html");
    const html = new TextDecoder().decode(result.bytes);
    for (const url of extractCandidateUrls(html, source.discovery)) {
      discoveredCandidates.push({
        sourceId: source.id,
        url,
        status: source.status,
        usage: source.usage,
        downloaded: false,
        reason: "Official gallery availability is not written permission to reproduce or adapt the image."
      });
    }
  }
}

const report = {
  schemaVersion: 1,
  collectedAt: new Date().toISOString(),
  publisher: manifest.publisher,
  productPage: manifest.policy.productPage,
  termsUrl: manifest.policy.termsUrl,
  cacheIsPrivate: true,
  uiEligibleCount: downloaded.filter((item) => item.uiEligible).length,
  downloaded,
  discoveredCandidates
};
await writeFile(resolve(cacheRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  cacheRoot,
  downloaded: downloaded.length,
  discoveredButQuarantined: discoveredCandidates.length,
  uiEligible: report.uiEligibleCount,
  report: resolve(cacheRoot, "report.json")
}, null, 2)}\n`);
