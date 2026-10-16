import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gameSource = await readFile(new URL("../app/game.tsx", import.meta.url), "utf8");
const mobileCss = await readFile(new URL("../mobile/mobile.css", import.meta.url), "utf8");

test("Android keeps map, context, resources, turn controls and hand in one landscape viewport", () => {
  assert.match(gameSource, /className="tactical-board"/);
  assert.match(gameSource, /className="tactical-context"/);
  assert.match(gameSource, /className="persistent-resource-panel"/);
  assert.match(gameSource, /className="persistent-hand-panel"/);
  assert.doesNotMatch(gameSource, /type MobilePanel = "map" \| "hand" \| "resources"/);
  assert.match(mobileCss, /grid-template-rows: 40px 24px minmax\(0, 1fr\) 78px !important/);
  assert.match(mobileCss, /\.center-stage \{[\s\S]*grid-template-columns:minmax\(0,1fr\) var\(--mobile-context-width\)/);
  assert.match(mobileCss, /\.persistent-hand-panel \{[\s\S]*grid-row:4/);
  assert.match(mobileCss, /\.center-stage\.in-combat \.map-card \{ display:flex !important/);
});

test("Android reserves tabs only for low-frequency utility drawers", () => {
  assert.match(gameSource, /type UtilityPanel = "hero" \| "site" \| "market" \| "log" \| null/);
  assert.match(gameSource, /className="utility-command-rail"/);
  assert.match(gameSource, /aria-label="次要信息工具栏"/);
  assert.match(gameSource, /className={`utility-drawer utility-\$\{panel\}`}/);
  assert.match(mobileCss, /\.utility-command-rail \{[\s\S]*grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(mobileCss, /\.utility-drawer \{[\s\S]*width:min\(420px,56vw\)/);
});

test("Android uses touch-first card selection without hiding the board", () => {
  assert.match(gameSource, /className={`hand-card-tab/);
  assert.match(gameSource, /title=\{cardDescription\}/);
  assert.match(gameSource, /点击选择；长按或右键打开百科/);
  assert.match(gameSource, /<SelectedCardPanel[\s\S]*instanceId=\{activeSelectedCardId\}/);
  assert.match(mobileCss, /\.hand-card-tab \{ min-width:96px/);
  assert.match(mobileCss, /\.hand-card-tab-effect \{ grid-template-columns:10px minmax\(0,1fr\)/);
  assert.match(mobileCss, /\.hand-card-tab-effect b \{ font-size:5px; line-height:1\.4; \}/);
  assert.match(mobileCss, /\.hand-card-hover-preview \{ display:none; \}/);
  assert.match(mobileCss, /\.selected-card-panel \.selected-card \{ min-height:0;[^}]*overflow:hidden/);
  assert.match(mobileCss, /\.map-inspector \{ display:none !important; \}/);
});

test("Android keeps exceptional long views internally scrollable", () => {
  assert.match(mobileCss, /\.setup-shell \{[\s\S]*overflow-y: auto;/);
  assert.match(mobileCss, /\.utility-drawer-scroll \{[\s\S]*height:calc\(100% - 32px\)/);
  assert.match(mobileCss, /\.tactical-context > \.combat-panel \{[^}]*display:grid;[^}]*grid-template-rows:minmax\(0,1fr\) auto;[^}]*overflow:hidden/s);
  assert.match(mobileCss, /\.combat-scroll-region \{[^}]*overflow-y:auto/s);
  assert.match(mobileCss, /\.combat-command-region \{[^}]*max-height:none;[^}]*overflow:visible/s);
  assert.doesNotMatch(mobileCss, /\.combat-command-region \{[^}]*max-height:\s*\d+%/s);
  assert.match(mobileCss, /\.center-stage\.in-combat \.tactical-context \{[^}]*grid-template-rows:minmax\(0,1fr\) auto auto/);
  assert.match(mobileCss, /\.tactical-context > \.combat-panel \{[\s\S]*height:100%;[\s\S]*max-height:none/);
  assert.doesNotMatch(mobileCss, /\.tactical-context > \.combat-panel \{[^}]*max-height:\s*45%/s);
  assert.match(mobileCss, /\.trait-explainer \{ display:block; font-size:6px; \}/);
  assert.doesNotMatch(mobileCss, /\.trait-explainer \{ display:none; \}/);
  assert.match(mobileCss, /\.tactic-modal,[\s\S]*\.gameover-modal \{[\s\S]*max-height:[\s\S]*overflow-y: auto;/);
});

test("Android battle reserves card space outside the enemy rail and keeps touch actions readable", () => {
  assert.match(mobileCss, /\.center-stage \.tactical-board \{ padding-bottom:calc\(var\(--combat-card-height\) \+ 4px\)/);
  assert.match(mobileCss, /\.center-stage \.selected-card-panel \{[^}]*position:absolute;[^}]*left:0;[^}]*bottom:0;[^}]*height:var\(--combat-card-height\)/s);
  assert.match(mobileCss, /\.combat-actions button \{[^}]*min-height:32px;[^}]*font-size:11px/s);
  assert.match(mobileCss, /@media \(max-height:460px\)/);
  assert.match(mobileCss, /--combat-card-height:112px/);
  assert.match(gameSource, /className="selected-card-copy" tabIndex=\{0\} role="region"/);
});

test("map focus cannot hide a newly triggered combat", () => {
  assert.match(gameSource, /const effectiveMapFocus = mapFocus && !activeState\?\.combat/);
  assert.match(gameSource, /\$\{effectiveMapFocus \? "map-focus"/);
  assert.match(gameSource, /className="map-focus-toggle"[^>]*disabled=\{Boolean\(state.combat\)\}/);
});

test("Android card confirmation replaces the editable card instead of overflowing behind the hand", () => {
  assert.match(gameSource, /pendingPlay \? "has-pending-play"/);
  assert.match(mobileCss, /\.selected-card-panel\.has-pending-play > \.selected-card \{ display:none; \}/);
  assert.match(mobileCss, /\.center-stage\.in-combat \.selected-card-panel\.has-pending-play \{ grid-template-rows:minmax\(0,1fr\)/);
});
