import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_RESOURCES, getHeroSkillsForMode, type Enemy, type MapCell, type SiteType } from "../lib/game-data";
import { applyGameActionWithRevert, availableResources, createGame, createRevertHistory, gameReducer, revertLastAction, type GameAction, type GameState } from "../lib/game-engine";

const foe = (patch: Partial<Enemy> = {}): Enemy => ({ id: "undo-foe", name: "已公开敌人", armor: 2, attack: 2, fame: 0, description: "确定性撤回测试", ...patch });
function battle(step: NonNullable<GameState["combat"]>["step"] = "ranged", enemy = foe(), site: SiteType = "rampager"): GameState {
  const base = createGame("tovak", "standard", "classic", "wedge", 420042, "ultimate");
  const origin: MapCell = { id: "0,0", q: 0, r: 0, terrain: "plains", site: "village", revealed: true, tokenRevealed: true, conquered: false };
  return { ...base, phase: "combat", position: origin.id, actionTaken: true,
    map: [origin, { ...origin, id: "1,0", q: 1, site, enemy, enemies: [enemy] }],
    combat: { cellId: "1,0", originId: origin.id, enemy, step, blocked: false, kind: "rampager", chainStartFame: 0, damageRemaining: step === "damage" ? enemy.attack : undefined },
    hand: ["rage#undo", "swiftness#undo", "stamina#undo"], deck: ["march#hidden", "rage#hidden"], played: [], discard: [],
    units: [{ id: "peasants", used: false, wounded: false, wounds: 0 }],
    source: [{ color: "red" }, { color: "white" }],
    manaTokens: { red: 10, blue: 10, green: 10, white: 10, black: 10 },
    spent: { ...EMPTY_RESOURCES }, turnBonus: { ...EMPTY_RESOURCES, move: 20, block: 20, attack: 20, range: 20, draw: 2 },
  };
}

function withoutLog(state: GameState) { const { log: _log, ...rest } = state; return rest; }
function roundTrip(state: GameState, action: GameAction) {
  const history = applyGameActionWithRevert(createRevertHistory(state), action);
  assert.equal(history.past.length, 1, `${action.type} should create exactly one undo entry: ${history.boundaryReason}`);
  assert.notDeepEqual(withoutLog(history.present), withoutLog(state), "the action must actually change state");
  const restored = revertLastAction(history);
  assert.deepEqual(withoutLog(restored.present), withoutLog(state), "undo restores the entire snapshot, not only the phase");
  assert.deepEqual(availableResources(restored.present), availableResources(state));
}

const simpleActions: Array<[GameAction, NonNullable<GameState["combat"]>["step"]]> = [
  [{ type: "COMBAT_ADVANCE" }, "ranged"], [{ type: "COMBAT_RANGED" }, "ranged"],
  [{ type: "COMBAT_BLOCK" }, "block"], [{ type: "COMBAT_DAMAGE" }, "block"],
  [{ type: "COMBAT_DAMAGE" }, "damage"], [{ type: "ASSIGN_DAMAGE_UNIT", unitId: "peasants" }, "damage"],
  [{ type: "COMBAT_ATTACK" }, "attack"], [{ type: "COMBAT_RETREAT" }, "attack"],
  [{ type: "COMBAT_REDUCE_CUMBERSOME" }, "block"],
];
for (const [action, step] of simpleActions) test(`${action.type} at ${step}: deterministic combat is fully reversible`, () => roundTrip(battle(step, foe({ cumbersome: true })), action));

for (const step of ["ranged", "attack"] as const) test(`${step} combined attack restores every defeated enemy and reward`, () => {
  const state = battle(step);
  const other = foe({ id: "other-foe" });
  state.combat!.queue = [{ cellId: "1,0", enemy: other }];
  state.map[1] = { ...state.map[1], enemies: [state.combat!.enemy, other] };
  roundTrip(state, { type: "COMBAT_GROUP_ATTACK", enemyIds: [state.combat!.enemy.id, other.id] });
});

for (const traits of [{ poison: true }, { paralyze: true }, { brutal: true, poison: true }]) test(`hero wounds and discarded hand restore: ${JSON.stringify(traits)}`, () => {
  roundTrip(battle("damage", foe({ attack: 12, ...traits })), { type: "COMBAT_DAMAGE" });
});
for (const traits of [{ poison: true }, { paralyze: true }, {}]) test(`unit damage or destruction restores: ${JSON.stringify(traits)}`, () => {
  roundTrip(battle("damage", foe({ attack: 8, ...traits })), { type: "ASSIGN_DAMAGE_UNIT", unitId: "peasants" });
});

test("a complete known combat can be rewound from melee back through wounds to ranged", () => {
  const state = battle();
  let history = createRevertHistory(state);
  for (const action of [{ type: "COMBAT_ADVANCE" }, { type: "COMBAT_DAMAGE" }, { type: "COMBAT_DAMAGE" }] as GameAction[]) history = applyGameActionWithRevert(history, action);
  assert.equal(history.present.combat?.step, "attack");
  assert.equal(history.past.length, 3);
  while (history.past.length) history = revertLastAction(history);
  assert.deepEqual(withoutLog(history.present), withoutLog(state));
});

test("multi-enemy ranged skipping and block order restore both queues", () => {
  const state = battle();
  state.combat!.queue = [{ cellId: "1,0", enemy: foe({ id: "second" }) }];
  let history = createRevertHistory(state);
  history = applyGameActionWithRevert(history, { type: "COMBAT_ADVANCE" });
  assert.equal(history.present.combat?.enemy.id, "second");
  assert.equal(history.present.combat?.step, "ranged");
  history = applyGameActionWithRevert(history, { type: "COMBAT_ADVANCE" });
  assert.equal(history.present.combat?.step, "block");
  history = applyGameActionWithRevert(history, { type: "COMBAT_BLOCK" });
  assert.equal(history.present.combat?.enemy.id, "second");
  while (history.past.length) history = revertLastAction(history);
  assert.deepEqual(withoutLog(history.present), withoutLog(state));
});

test("multiple attacks restore attack index and per-attack block spending", () => roundTrip(battle("block", foe({ attackCount: 2, swift: true })), { type: "COMBAT_BLOCK" }));

test("undo block then unplay restores a powered card's mana and permits a new plan", () => {
  const state = battle("block");
  state.turnBonus.block = 0;
  state.hand = ["determination#undo"];
  let history = applyGameActionWithRevert(createRevertHistory(state), { type: "PLAY_CARD", instanceId: state.hand[0], mode: "powered" });
  assert.equal(history.present.played.length, 1);
  const beforeBlock = history.present;
  history = applyGameActionWithRevert(history, { type: "COMBAT_BLOCK" });
  assert.equal(history.present.combat?.step, "attack");
  history = revertLastAction(history);
  assert.deepEqual(withoutLog(history.present), withoutLog(beforeBlock));
  history = revertLastAction(history);
  assert.deepEqual(withoutLog(history.present), withoutLog(state));
});

test("defend assignment is reversible before attacks", () => {
  const state = battle("ranged", foe({ defend: 1 }));
  const target = foe({ id: "protected" });
  state.combat!.queue = [{ cellId: "1,0", enemy: target }];
  roundTrip(state, { type: "ASSIGN_DEFEND", defenderId: state.combat!.enemy.id, targetId: target.id });
});

test("summoning blocks ranged rewind, but later deterministic choices can be undone", () => {
  const state = battle("ranged", foe({ summon: true }));
  let history = applyGameActionWithRevert(createRevertHistory(state), { type: "COMBAT_ADVANCE" });
  assert.ok(history.present.combat?.summonedTokenId);
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /新的敌人标记/);
  const afterReveal = history.present;
  history = applyGameActionWithRevert(history, { type: "PLAY_CARD", instanceId: state.hand[2], mode: "sideways", sideResource: "block" });
  assert.equal(history.past.length, 1);
  history = revertLastAction(history);
  assert.deepEqual(withoutLog(history.present), withoutLog(afterReveal));
  assert.equal(revertLastAction(history), history, "cannot cross the summoning reveal");
});

test("cancelled summoning reveals nothing and does not lock the phase", () => {
  const state = battle("ranged", foe({ summon: true }));
  state.combat!.cancelledAttackIds = [state.combat!.enemy.id];
  roundTrip(state, { type: "COMBAT_ADVANCE" });
});

test("a summon drawn after blocking the previous enemy also locks earlier combat", () => {
  const state = battle("block");
  state.combat!.queue = [{ cellId: "1,0", enemy: foe({ id: "summoner", summon: true }) }];
  const history = applyGameActionWithRevert(createRevertHistory(state), { type: "COMBAT_BLOCK" });
  assert.ok(history.present.combat?.summonedTokenId);
  assert.equal(history.past.length, 0);
});

test("hidden artifact rewards lock the killing attack", () => {
  const state = battle("attack", foe(), "ruins");
  state.map[1].ruinsReward = "artifact";
  const history = applyGameActionWithRevert(createRevertHistory(state), { type: "COMBAT_ATTACK" });
  assert.equal(history.present.artifacts, state.artifacts + 1);
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /新的圣器/);
});

test("new replacement spell locks a mage-tower victory", () => {
  const history = applyGameActionWithRevert(createRevertHistory(battle("attack", foe(), "mageTower")), { type: "COMBAT_ATTACK" });
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /新卡牌/);
});

test("a face-up spell reward with an empty replacement deck is still reversible", () => {
  const state = battle("attack", foe(), "mageTower");
  state.spellDeck = [];
  roundTrip(state, { type: "COMBAT_ATTACK" });
});

test("level-up skill draw locks the final attack", () => {
  const state = battle("attack", foe({ fame: 3 }));
  const history = applyGameActionWithRevert(createRevertHistory(state), { type: "COMBAT_ATTACK" });
  assert.equal(history.present.phase, "skill");
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /随机公开了技能/);
});

for (const site of ["monsterDen", "dungeon", "spawningGrounds", "ruins"] as const) test(`${site}: random rewards lock even when all crystal inventories are full`, () => {
  const state = battle("attack", foe(), site);
  state.map[1].ruinsReward = "crystals";
  state.artifactDeck = [];
  state.spellOffer = [];
  state.crystals = { red: 3, blue: 3, green: 3, white: 3 };
  const history = applyGameActionWithRevert(createRevertHistory(state), { type: "COMBAT_ATTACK" });
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /随机|掷骰/);
});

test("draw during combat clears prior steps and prevents direct card-unplay bypass", () => {
  const state = battle();
  let history = applyGameActionWithRevert(createRevertHistory(state), { type: "PLAY_CARD", instanceId: state.hand[0], mode: "basic" });
  history = applyGameActionWithRevert(history, { type: "COMBAT_ADVANCE" });
  history = applyGameActionWithRevert(history, { type: "USE_DRAW" });
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /抽牌/);
  assert.equal(history.present.played[0].lockedByCombat, true);
  const attempted = gameReducer(history.present, { type: "UNPLAY_CARD", instanceId: state.hand[0] });
  assert.deepEqual(withoutLog(attempted), withoutLog(history.present));
});

test("Mana Storm reroll locks even when every die shows the same face afterwards", () => {
  const state = battle();
  state.hand = ["manaStorm#undo"];
  const colors = ["red", "blue", "green", "white"] as const;
  state.source = Array.from({ length: 3 }, (_, i) => ({ color: colors[(state.seed + state.turnsTaken + i + 1) % 4] }));
  const history = applyGameActionWithRevert(createRevertHistory(state), { type: "PLAY_CARD", instanceId: state.hand[0], mode: "powered" });
  assert.deepEqual(history.present.source, state.source);
  assert.equal(history.present.played.length, 1);
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /重掷/);
});

test("source-opening skill reroll locks even when the visible face is unchanged", () => {
  const state = battle();
  const skill = getHeroSkillsForMode("ultimate", "goldyx").find((s) => s.special === "source-opening")!;
  state.heroId = "goldyx"; state.skills = [skill.id]; state.turnsTaken = 5; state.source = [{ color: "red" }];
  const history = applyGameActionWithRevert(createRevertHistory(state), { type: "ACTIVATE_SKILL", skillId: skill.id, sourceDieIndex: 0 });
  assert.deepEqual(history.present.source, state.source);
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /重掷/);
});

test("failed combat commands neither create an undo nor erase an earlier one", () => {
  const state = battle();
  let history = applyGameActionWithRevert(createRevertHistory(state), { type: "PLAY_CARD", instanceId: state.hand[0], mode: "basic" });
  const previous = history.past;
  history = applyGameActionWithRevert(history, { type: "COMBAT_BLOCK" });
  assert.equal(history.past, previous);
  assert.equal(history.present.combat?.step, "ranged");
});

test("an empty summon stack does not invent a new-information boundary", () => {
  const state = battle("ranged", foe({ summon: true }));
  state.enemyDecks.brown = []; state.enemyDiscards.brown = [];
  roundTrip(state, { type: "COMBAT_ADVANCE" });
});

test("retreating from spawning grounds locks newly replenished hidden defenders", () => {
  const state = battle("attack", foe(), "spawningGrounds");
  state.combat!.adventureFailure = "replenish";
  state.combat!.adventureTargetCount = 2;
  const history = applyGameActionWithRevert(createRevertHistory(state), { type: "COMBAT_RETREAT" });
  assert.equal(history.past.length, 0);
  assert.match(history.boundaryReason, /新的敌人标记/);
});
