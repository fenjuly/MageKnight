import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gameSource = await readFile(new URL("../app/game.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const audioSource = await readFile(new URL("../app/game-audio.ts", import.meta.url), "utf8");

test("desktop uses one tactical workbench instead of three competing rails", () => {
  assert.match(styles, /\.game-layout \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 46px/);
  assert.match(styles, /\.center-stage \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) clamp\(300px, 23vw, 370px\)/);
  assert.match(styles, /\.tactical-context \{[\s\S]*grid-template-rows: auto minmax\(148px, 1fr\) auto auto/);
  assert.match(gameSource, /<TacticalContextSummary/);
  assert.match(gameSource, /<SelectedCardPanel/);
  assert.match(gameSource, /<ResourceBar[\s\S]*<TurnPanel/);
});

test("terrain hover and focus update the persistent context", () => {
  assert.match(gameSource, /const \[inspectedCellId, setInspectedCellId\] = useState/);
  assert.match(gameSource, /onMouseEnter=\{\(\) => showInspector\(cell\.id\)\}/);
  assert.match(gameSource, /onFocus=\{\(\) => showInspector\(cell\.id\)\}/);
  assert.match(gameSource, /onInspectCell\(cellId\)/);
  assert.match(gameSource, /inspectedCellId=\{activeInspectedCellId\}/);
});

test("the hero uses a layered floating 2D standee without affecting map input", () => {
  assert.match(gameSource, /className="hero-marker" aria-label="你的英雄当前位置"/);
  assert.match(gameSource, /className="hero-marker-shadow"/);
  assert.match(gameSource, /className="hero-marker-base"/);
  assert.match(gameSource, /className="hero-marker-standee hero-sprite" style=\{heroArtStyle\(state\.heroId\)\}/);
  assert.match(styles, /\.hero-marker \{[^}]*pointer-events:none/s);
  assert.match(styles, /\.hero-marker-standee \{[^}]*animation:hero-standee-float 2\.8s ease-in-out infinite/s);
  assert.match(styles, /@keyframes hero-standee-float/);
  assert.match(styles, /@keyframes hero-shadow-float/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\) \{ \.hero-marker-standee,\.hero-marker-shadow \{ animation:none !important; \} \}/);
});

test("map actions require preview and confirmation", () => {
  assert.match(gameSource, /type PendingMapAction/);
  assert.match(gameSource, /setPendingAction\(\{ kind: "cell", cellId: cell\.id \}\)/);
  assert.match(gameSource, /setPendingAction\(\{ kind: "explore"/);
  assert.match(gameSource, /className="map-action-preview"/);
  assert.match(gameSource, /确认移动/);
  assert.match(gameSource, /确认挑战/);
  assert.match(gameSource, /确认探索/);
  assert.match(styles, /\.hex-cell\.preview-target/);
});

test("map focus mode is keyboard and pointer accessible", () => {
  assert.match(gameSource, /aria-pressed=\{mapFocus\}/);
  assert.match(gameSource, /地图专注模式（快捷键 F）/);
  assert.match(gameSource, /event\.key\.toLowerCase\(\) === "f"/);
  assert.match(gameSource, /event\.key === "Escape"/);
  assert.match(styles, /\.game-shell\.map-focus \.tactical-context/);
});

test("wheel zoom is frame-coalesced and uses a stable unscaled anchor", () => {
  assert.match(gameSource, /const wheelZoomFrame = useRef<number \| null>\(null\)/);
  assert.match(gameSource, /wheelZoomDelta\.current \+= event\.deltaY \* deltaScale/);
  assert.match(gameSource, /wheelZoomFrame\.current = window\.requestAnimationFrame\(\(\) => \{/);
  assert.match(gameSource, /mapZoomValue\.current \* Math\.exp\(-delta \* 0\.0018\)/);
  assert.match(gameSource, /content\.offsetLeft \+ content\.offsetWidth \/ 2 \+ pan\.x/);
  assert.match(gameSource, /const mapPanValue = useRef\(\{ x: 0, y: 0 \}\)/);
  assert.doesNotMatch(styles, /\.hex-map\s*\{[^}]*transition:\s*transform/s);
});

test("map pinch zoom blocks Chrome page zoom without duplicate React handling", () => {
  assert.match(gameSource, /viewport\.addEventListener\("wheel", zoomWithWheel, \{ passive: false \}\)/);
  assert.match(gameSource, /viewport\.removeEventListener\("wheel", zoomWithWheel\)/);
  assert.match(gameSource, /const zoomWithWheel = useCallback\(\(event: WheelEvent\) => \{\s*event\.preventDefault\(\)/s);
  assert.doesNotMatch(gameSource, /onWheel=\{zoomWithWheel\}/);
});

test("hand selection uses an illustrated overlapping fan and confirms ordinary card effects", () => {
  assert.match(gameSource, /className={`hand-card-tab/);
  assert.match(gameSource, /className={`hand-card-tab-art \$\{cardArtClass\(card\)\}`}/);
  assert.match(gameSource, /className="hand-card-tab-copy"/);
  assert.match(gameSource, /className="hand-card-tab-effect basic"[^>]*><small>基<\/small><b>\{card\.basicLabel\}<\/b>/);
  assert.match(gameSource, /className="hand-card-tab-effect powered"[^>]*><small>强<\/small><b>\{card\.poweredLabel\}<\/b>/);
  assert.match(gameSource, /强化：\$\{card\.poweredLabel\}/);
  assert.match(gameSource, /function SelectedCardPanel/);
  assert.match(gameSource, /type PendingCardPlay/);
  assert.match(gameSource, /className="card-resolution-preview"/);
  assert.match(gameSource, /选择 → 预览 → 确认/);
  assert.match(styles, /\.persistent-hand-panel \.hand-scroll \{[\s\S]*justify-content:center;[\s\S]*overflow:visible/);
  assert.match(styles, /\.hand-card-tab \{[\s\S]*margin-left:-12px/);
  assert.match(gameSource, /className=\{`hand-card-hover-preview mana-\$\{card\.color\}`\}/);
  assert.match(styles, /\.hand-card-tab:hover,\.hand-card-tab:focus-visible \{[^}]*transform:none/s);
  assert.match(styles, /\.hand-card-hover-preview \{[^}]*visibility:hidden;[^}]*pointer-events:none/s);
  assert.match(styles, /\.hand-card-tab:hover \.hand-card-hover-preview,\.hand-card-tab:focus-visible \.hand-card-hover-preview \{[^}]*visibility:visible;[^}]*opacity:1/s);
  assert.match(styles, /\.hand-card-tab-effect b \{[^}]*white-space:normal;[^}]*-webkit-line-clamp:2/s);
  assert.match(styles, /\.hand-card-tab\.selected/);
  assert.match(styles, /\.hand-card-tab-effect\.powered b \{ color:#cdb273; \}/);
});

test("art direction uses the generated v2 hero and location atlases", () => {
  assert.match(styles, /hero-atlas-v2\.jpg/);
  assert.match(styles, /site-model-atlas-v2\.jpg/);
  assert.match(styles, /\.hero-sprite \{[^}]*background-size: 400% 200%/s);
  assert.match(styles, /\.site-model-sprite \{[^}]*background-size: 500% 400%/s);
  assert.match(styles, /\.hex-cell\.actionable:hover,\.hex-cell\.actionable:focus-visible/);
});

test("combat context shows live requirement forecast and every visible enemy", () => {
  assert.match(gameSource, /const forecast = step === "ranged"/);
  assert.match(gameSource, /className={`combat-forecast/);
  assert.match(gameSource, /className="combat-target-strip"/);
  assert.match(gameSource, /还差 \$\{Math\.max\(0, forecast\.need - forecast\.available\)\}/);
  assert.match(styles, /\.center-stage\.in-combat \.tactical-context \{[\s\S]*grid-template-rows: minmax\(0, 3fr\) minmax\(148px, 2fr\) auto auto/);
  assert.match(gameSource, /className="combat-scroll-region"/);
  assert.match(gameSource, /className="combat-command-region"/);
  assert.match(styles, /\.tactical-context > \.combat-panel \{[^}]*display:grid;[^}]*grid-template-rows:minmax\(0,1fr\) auto;[^}]*overflow:hidden/s);
  assert.match(styles, /\.combat-scroll-region \{[^}]*overflow-y:auto/s);
  assert.doesNotMatch(styles, /\.tactical-context > \.combat-panel \{[^}]*max-height:\s*46%/s);
});

test("selected card actions stay in document flow below every card effect", () => {
  assert.match(styles, /\.selected-card-panel \.selected-card \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*overflow-y: auto/s);
  assert.match(styles, /\.selected-card-panel \.card-actions \{[^}]*position: relative;[^}]*margin-top: auto/s);
  assert.match(styles, /\.selected-card-panel \.unplay \{[^}]*position: relative;[^}]*margin-top: auto/s);
  assert.doesNotMatch(styles, /\.selected-card-panel \.card-actions \{[^}]*position:\s*absolute/s);
  assert.doesNotMatch(styles, /\.selected-card-panel \.unplay \{[^}]*position:\s*absolute/s);
});

test("short desktop windows compress context instead of clipping card controls", () => {
  assert.match(styles, /@media \(min-width:901px\) and \(max-height:900px\)/);
  assert.match(styles, /\.tactical-context \{\s*grid-template-rows:minmax\(104px,28%\) minmax\(150px,1fr\) auto auto/);
  assert.match(styles, /\.tactical-summary \{[\s\S]*grid-template-rows:auto auto minmax\(0,1fr\);[\s\S]*overflow:hidden/);
  assert.match(styles, /\.tactical-enemy-stack \{[\s\S]*max-height:none;[\s\S]*overscroll-behavior:contain/);
  assert.match(styles, /\.selected-card-panel \.selected-card \{[\s\S]*min-height:0;[\s\S]*padding:5px 6px 6px/);
  assert.match(styles, /\.persistent-resource-panel \.resource-actions:empty \{ display:none; \}/);
});

test("the board presents a stable 2.5D tabletop with reduced-motion support", () => {
  assert.match(gameSource, /ref=\{mapPerspectiveRef\} className="map-perspective-layer"/);
  assert.match(gameSource, /--board-tilt-x/);
  assert.match(gameSource, /--board-tilt-y/);
  assert.match(styles, /\.map-perspective-layer \{[^}]*perspective\(1400px\)[^}]*rotateX/s);
  assert.match(styles, /\.map-tile-hull \{[^}]*translateZ\(-5px\)/s);
  assert.match(styles, /\.map-model,\s*\.map-enemy-model \{[^}]*translateZ\(11px\)/s);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\) \{[\s\S]*\.map-perspective-layer/);
});

test("actions emit visual feedback and offline procedural sound with a persistent mute control", () => {
  assert.match(gameSource, /function CinematicFeedback/);
  assert.match(gameSource, /feedbackForAction\(action, current\.present, next\.present\)/);
  assert.match(gameSource, /className=\{`sound-toggle/);
  assert.match(styles, /\.cinematic-fx \{/);
  assert.match(styles, /@keyframes fx-particle-flight/);
  assert.match(audioSource, /mage-knight-sound-enabled/);
  assert.match(audioSource, /context\.createOscillator\(\)/);
  assert.match(audioSource, /context\.createBuffer\(1, length, context\.sampleRate\)/);
  assert.match(audioSource, /action\.type === "EXPLORE_TILE"/);
  assert.doesNotMatch(audioSource, /fetch\(|new Audio\(/);
});
