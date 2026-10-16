import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CardHand } from "../app/game";
import { ALL_CARD_DEFS } from "../lib/game-data";
import { createGame } from "../lib/game-engine";

const base = createGame("tovak", "standard", "classic", "wedge", 42, "ultimate");
const noop = () => {};
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const mobileCss = await readFile(new URL("../mobile/mobile.css", import.meta.url), "utf8");

test("all 119 card identities retain names and both complete effect texts in compact hand and full preview", () => {
  const cards = Object.values(ALL_CARD_DEFS);
  assert.equal(cards.length, 119);
  for (const card of cards) {
    const id = `${card.id}#hand-test`;
    const html = renderToStaticMarkup(<CardHand state={{ ...base, hand: [id], played: [] }} selectedCardId={id} onSelectCard={noop} onOpenWiki={noop} />);
    assert.ok(html.includes(`<strong>${escape(card.name)}</strong>`), `${card.id}: missing compact name`);
    assert.ok(html.includes(`aria-label="${escape(`${card.name}。基础：${card.basicLabel}。强化：${card.poweredLabel}`)}`), `${card.id}: missing accessible effects`);
    for (const label of [card.basicLabel, card.poweredLabel]) assert.ok(html.includes(`<b>${escape(label)}</b>`), `${card.id}: missing full effect`);
    assert.match(html, /class="hand-card-hover-preview/);
  }
});

test("wound-only hands still have a visible name row and explanation", () => {
  const html = renderToStaticMarkup(<CardHand state={{ ...base, hand: ["wound#a", "wound#b"], played: [] }} onSelectCard={noop} onOpenWiki={noop} />);
  assert.equal((html.match(/<strong>伤势<\/strong>/g) ?? []).length, 2);
  assert.match(html, /不可作为普通行动牌打出/);
});

test("played status remains accessible when redundant tier/status rows no longer consume dock height", () => {
  const id = "determination#played";
  const html = renderToStaticMarkup(<CardHand state={{ ...base, hand: [id], played: [{ instanceId: id, mode: "basic" }] }} onSelectCard={noop} onOpenWiki={noop} />);
  assert.match(html, /当前状态：已打出 · 基础/);
  assert.match(html, /hand-card-tab[^"\n]*played/);
  assert.match(css, /\.hand-card-tab\.played \.hand-card-tab-art::after[^}]*content:"已出"/s);
});

test("compact names have intrinsic grid rows and a real non-shrinking 1.5em line box", () => {
  assert.match(css, /\.hand-card-tab-copy \{[^}]*grid-auto-rows:max-content/s);
  assert.match(css, /\.hand-card-tab-copy > strong \{[^}]*min-height:1\.5em;[^}]*font:500 9px\/1\.5/s);
  assert.match(css, /\.hand-card-tab-copy > small \{ display:none; \}/);
  assert.match(css, /\.hand-card-tab-effect b \{[^}]*line-height:1\.4/s);
  assert.match(mobileCss, /\.hand-card-tab-effect b \{ font-size:5px; line-height:1\.4; \}/);
});

test("both desktop and Android hand docks reserve enough height without restoring full-height cards", () => {
  assert.match(css, /grid-template-rows: 58px 52px minmax\(0, 1fr\) 84px/);
  assert.match(css, /\.persistent-hand-panel \.hand-content \{[^}]*grid-template-rows:16px minmax\(0,1fr\)/s);
  assert.match(mobileCss, /grid-template-rows:40px 24px minmax\(0,1fr\) 70px !important/);
  assert.match(mobileCss, /\.persistent-hand-panel \.hand-content \{ grid-template-rows:13px minmax\(0,1fr\)/);
});
