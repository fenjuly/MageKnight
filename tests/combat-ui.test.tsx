import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CombatPanel, SelectedCardPanel, TurnPanel } from "../app/game";
import { applyGameActionWithRevert, createRevertHistory } from "../lib/game-engine";
import { combatUiScenario } from "./fixtures/combat-states";
import { getUnit } from "../lib/game-data";

const noop = () => {};
const phases = { ranged: ["远程击破", "跳过远程"], block: ["完整格挡", "承受伤害"], damage: ["其余由英雄承受"], attack: ["发动攻击", "撤退"] } as const;

for (const multi of [false, true]) for (const step of Object.keys(phases) as (keyof typeof phases)[]) {
  test(`${multi ? "multi" : "single"} enemy ${step}: primary commands are separate from scrollable details`, () => {
    const state = combatUiScenario(step, multi);
    const html = renderToStaticMarkup(<CombatPanel state={state} dispatch={noop} />);
    const [detail, command] = html.split('<div class="combat-command-region"');
    assert.ok(command, "phase commands have an independent footer");
    assert.match(detail, /aria-label="敌情与战斗分配"/);
    for (const label of phases[step]) assert.ok(command.includes(label), label);
    assert.doesNotMatch(command, /class="(?:group-attack-controls|defend-assignment-controls|damage-assignment)"/);
    if (step === "damage") for (const u of state.units) assert.ok(detail.includes(`${getUnit(u.id)!.name}承伤`));
    if (multi && (step === "ranged" || step === "attack")) {
      assert.match(detail, /class="group-attack-controls"/);
      assert.match(detail, /class="defend-assignment-controls"/);
    }
  });
}

test("forbidden and wounded units never acquire damage-assignment buttons", () => {
  const state = combatUiScenario("damage");
  state.combat!.unitsForbidden = true;
  const html = renderToStaticMarkup(<CombatPanel state={state} dispatch={noop} />);
  assert.match(html, /此地点禁止盟军参战/);
  for (const unit of state.units) assert.ok(!html.includes(`${getUnit(unit.id)!.name}承伤`));
  state.combat!.unitsForbidden = false;
  state.units = state.units.map((u) => ({ ...u, wounded: true }));
  const wounded = renderToStaticMarkup(<CombatPanel state={state} dispatch={noop} />);
  for (const unit of state.units) assert.ok(!wounded.includes(`${getUnit(unit.id)!.name}承伤`));
});

test("cumbersome block control and hero damage command stay in the phase footer", () => {
  const html = renderToStaticMarkup(<CombatPanel state={combatUiScenario("block")} dispatch={noop} />);
  assert.match(html.split('<div class="combat-command-region"')[1], /降低笨重攻击/);
});

test("card text scrolls independently of card action buttons", () => {
  const state = combatUiScenario("ranged");
  const html = renderToStaticMarkup(<SelectedCardPanel state={state} dispatch={noop} instanceId={state.hand[0]} />);
  assert.match(html, /class="selected-card-copy"[^>]*role="region"/);
  assert.match(html, /基础效果/);
  assert.match(html, /强化 · 绿色/);
  assert.match(html, /<\/strong><\/div><\/div><div class="card-actions">/);
});

test("combat panel disappears when an encounter has finished", () => {
  const state = combatUiScenario("attack");
  state.combat = undefined;
  assert.equal(renderToStaticMarkup(<CombatPanel state={state} dispatch={noop} />), "");
});

test("Ritual of Pain wound cards also separate scrollable text from all four action buttons", () => {
  const state = combatUiScenario("attack");
  state.ritualPainReady = true;
  const html = renderToStaticMarkup(<SelectedCardPanel state={state} dispatch={noop} instanceId="wound#ui" />);
  assert.match(html, /aria-label="伤势牌效果说明"/);
  for (const resource of ["移动", "攻击", "格挡", "影响力"]) assert.ok(html.includes(`${resource} 3`));
  assert.match(html, /<\/p><\/div><div class="card-actions">/);
});

test("block phase exposes an enabled undo button describing the ranged transition", () => {
  const history = applyGameActionWithRevert(createRevertHistory(combatUiScenario("ranged")), { type: "COMBAT_ADVANCE" });
  const html = renderToStaticMarkup(<TurnPanel state={history.present} dispatch={noop} revertHistory={history} onRevert={noop} />);
  const button = html.match(/<button class="revert-button"[^>]*>/)?.[0];
  assert.ok(button);
  assert.ok(!button.includes("disabled"));
  assert.match(html, /撤回：跳过当前敌人的远程攻击/);
  assert.match(html, /战斗进行中/);
});

test("summoning exposes a disabled undo button with an explicit information boundary", () => {
  const state = combatUiScenario("ranged");
  state.combat!.enemy = { ...state.combat!.enemy, summon: true };
  const history = applyGameActionWithRevert(createRevertHistory(state), { type: "COMBAT_ADVANCE" });
  const html = renderToStaticMarkup(<TurnPanel state={history.present} dispatch={noop} revertHistory={history} onRevert={noop} />);
  assert.match(html, /<button class="revert-button" disabled=""/);
  assert.match(html, /新的敌人标记/);
});
