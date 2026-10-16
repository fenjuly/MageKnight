"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_ENEMY_TOKENS, ALL_UNIT_DEFS, SITE_LABELS, TERRAIN_LABELS, getHeroesForMode, type ContentMode, type SiteType, type Terrain } from "../lib/game-data";
import type { ModelPreviewEntry } from "../lib/three-board";
import { REALISTIC_ASSETS, realisticModelFor, type ModelStyle } from "../lib/realistic-assets";

type Entry = { id: string; name: string; note: string; model: ModelPreviewEntry };
const CATEGORIES = { samples: "精细模型", hero: "英雄", enemy: "敌人", unit: "盟军", terrain: "地形", site: "建筑" } as const;
function ModelTurntable({ entry, style }: { entry: Entry; style: ModelStyle }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false; let viewer: { dispose(): void } | undefined;
    void import("../lib/three-board").then(({ createModelViewer }) => {
      if (cancelled || !host.current) return;
      try { viewer = createModelViewer(host.current, entry.model, style); } catch { setError("此设备无法打开 3D 模型预览"); }
    }).catch(() => { if (!cancelled) setError("模型预览资源加载失败"); });
    return () => { cancelled = true; viewer?.dispose(); };
  }, [entry, style]);
  return <div ref={host} className="model-turntable" aria-label={`${entry.name}的立体模型`}>{error && <p role="status">{error}</p>}</div>;
}

export function ModelGallery({ heroId, contentMode, onClose }: { heroId: string; contentMode: ContentMode; onClose(): void }) {
  const [category, setCategory] = useState<keyof typeof CATEGORIES>("samples"); const [query, setQuery] = useState(""); const [selected, setSelected] = useState(`hero-${heroId}`);
  const [style, setStyle] = useState<ModelStyle>("realistic");
  const entries = useMemo<Entry[]>(() => [
    ...getHeroesForMode(contentMode).map((value) => ({ id: `hero-${value.id}`, name: value.name, note: value.title, model: { kind: "hero" as const, value } })),
    ...ALL_ENEMY_TOKENS.filter((value) => contentMode === "ultimate" || !value.source || value.source === "base").filter((value, index, all) => all.findIndex((item) => item.name === value.name) === index).map((value) => ({ id: `enemy-${value.id}`, name: value.name, note: `护甲 ${value.armor} · 攻击 ${value.attack} · 名望 ${value.fame}`, model: { kind: "enemy" as const, value } })),
    ...ALL_UNIT_DEFS.filter((value) => contentMode === "ultimate" || !value.source || value.source === "base").map((value) => ({ id: `unit-${value.id}`, name: value.name, note: `等级 ${value.level} · 护甲 ${value.armor}`, model: { kind: "unit" as const, value } })),
    ...(Object.keys(TERRAIN_LABELS) as Terrain[]).map((value) => ({ id: `terrain-${value}`, name: TERRAIN_LABELS[value], note: "立体地表与地形细节", model: { kind: "terrain" as const, value } })),
    ...(Object.keys(SITE_LABELS) as SiteType[]).filter((value) => !["none", "rampager", "dragon"].includes(value)).map((value) => ({ id: `site-${value}`, name: SITE_LABELS[value], note: "可旋转的微缩建筑", model: { kind: "site" as const, value } })),
  ], [contentMode]);
  const visible = entries.filter((entry) => (category === "samples" ? Boolean(realisticModelFor(entry.model)) : entry.model.kind === category) && `${entry.name} ${entry.note}`.includes(query));
  const entry = visible.find((candidate) => candidate.id === selected) ?? visible[0];
  const assetId = entry && realisticModelFor(entry.model), asset = assetId ? REALISTIC_ASSETS[assetId] : undefined;
  return <div className="model-gallery-backdrop" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <section className="model-gallery" role="dialog" aria-modal="true" aria-label="3D 模型图鉴">
      <header><div><small>MINIATURE COLLECTION</small><h2>3D 模型图鉴</h2></div><button autoFocus onClick={onClose} aria-label="关闭模型图鉴">×</button></header>
      <nav aria-label="模型分类">{Object.entries(CATEGORIES).map(([id, name]) => <button key={id} aria-pressed={category === id} onClick={() => { setCategory(id as keyof typeof CATEGORIES); setQuery(""); }}>{name}</button>)}</nav>
      <div className="model-gallery-body"><aside><input aria-label="搜索模型" placeholder="搜索模型…" value={query} onChange={(event) => setQuery(event.target.value)} /><div>{visible.map((item) => <button key={item.id} className={entry?.id === item.id ? "active" : ""} onClick={() => setSelected(item.id)}><strong>{item.name}</strong><small>{item.note}</small></button>)}{!visible.length && <p>未找到匹配模型</p>}</div></aside>
        <div className="model-gallery-stage">{entry && <>
          <ModelTurntable key={`${entry.id}-${style}`} entry={entry} style={style} />
          <div className="model-gallery-caption"><h3>{entry.name}</h3><p>{entry.note}</p><span>拖动旋转 · 滚轮或双指缩放</span>
            {asset ? <>
              <div className="model-compare" aria-label="模型风格对比"><button aria-pressed={style === "realistic"} onClick={() => setStyle("realistic")}>精细模型</button><button aria-pressed={style === "classic"} onClick={() => setStyle("classic")}>原简约模型</button></div>
              <p className="model-license">{asset.author} · <a href={asset.licenseUrl} target="_blank" rel="noreferrer">{asset.license}</a> · <a href={asset.source} target="_blank" rel="noreferrer">素材来源</a><br />本项目已适配材质、装备与细节等级；不是原版官方雕像复刻。
                {asset.sharedWith && <><br />此项与「{REALISTIC_ASSETS[asset.sharedWith]?.name}」共用几何，以材质区分，并非独立雕刻。</>}
                {asset.sourceBase && !asset.sharedWith && ["hero", "enemy", "unit"].includes(entry.model.kind) && <><br />部分同族、职业共用身体网格；装备与组合模型按身份适配。</>}
              </p>
            </> : <p className="model-license">此组件暂保留简约模型；精细资源尚未接入。</p>}
          </div>
        </>}</div></div>
    </section>
  </div>;
}
