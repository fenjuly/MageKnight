export type ThreeQuality = "performance" | "sharp" | "ultra";

export const THREE_QUALITY_LABELS: Record<ThreeQuality, string> = { performance: "省电", sharp: "清晰", ultra: "超清" };
const STORAGE_KEY = "mage-knight-3d-quality";
const PROFILES = {
  performance: { maxRatio: 1.5, sampling: 1, maxPixels: 1_500_000 },
  sharp: { maxRatio: 3, sampling: 1, maxPixels: 6_000_000 },
  ultra: { maxRatio: 4, sampling: 4 / 3, maxPixels: 10_000_000 },
} as const;

/** Resolution is independent of pointer type. A touch screen is not a low-DPI
 * display; cap the actual framebuffer budget instead of blurring every phone. */
export function threeRenderResolution(width: number, height: number, deviceRatio: number, quality: ThreeQuality, maxDimension = 8192) {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1), safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const nativeRatio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const profile = PROFILES[quality];
  const pixelRatio = Math.min(nativeRatio * profile.sampling, profile.maxRatio, Math.sqrt(profile.maxPixels / (safeWidth * safeHeight)), maxDimension / safeWidth, maxDimension / safeHeight);
  return { pixelRatio, width: Math.floor(safeWidth * pixelRatio), height: Math.floor(safeHeight * pixelRatio) };
}

export function readThreeQuality(): ThreeQuality {
  try { const stored = localStorage.getItem(STORAGE_KEY); if (stored === "performance" || stored === "sharp" || stored === "ultra") return stored; } catch { /* use the default when storage is unavailable */ }
  return "sharp";
}

export function saveThreeQuality(quality: ThreeQuality) { try { localStorage.setItem(STORAGE_KEY, quality); } catch { /* the live setting still works without storage */ } }

export interface ScreenLabel { id: number; x: number; y: number; width: number; height: number; priority: number }

/** Keep selected/site labels readable when zoomed out instead of shrinking
 * their font. Uncrowded labels return as the camera zooms back in. */
export function visibleScreenLabels(labels: ScreenLabel[]) {
  const placed: ScreenLabel[] = [];
  const visible = new Set<number>();
  for (const label of [...labels].sort((first, second) => second.priority - first.priority || first.id - second.id)) {
    const overlapping = placed.some((other) => Math.abs(label.x - other.x) < (label.width + other.width) / 2 + 3 && Math.abs(label.y - other.y) < (label.height + other.height) / 2 + 2);
    if (overlapping) continue;
    placed.push(label); visible.add(label.id);
  }
  return visible;
}
