/**
 * "Would be defeated" replacements against "is defeated" interrupts, with shipped cards (docs/phase7-wave7.md §4.1,
 * owner ruling 2026-10-06; RRG 1.8 "'Would'", p. 48, whose own example is a defeat): the replacement resolves first,
 * the first player is not asked to order the two, and a replaced defeat never reaches the "is defeated" interrupt. The
 * engine's tier is proven with synthetic cards in `packages/engine/src/would-defeat-tier.test.ts`.
 */
import { activeVillain, cardsInPlay, createGame, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "./playable/index.js";
import {
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  settle,
  type Picker,
} from "./testing/harness.js";
import { driveEventsPicking, withForm } from "./testing/staging.js";
import { attachToHost, engageMinion } from "./wave6/mut_gen/project-wideawake-testing.js";

const deps = PLAYABLE_DEPS;

const SPIDER_TRACER = "01007";
const HYDRA_MERCENARY = "01101";
const BIOMECHANICAL_UPGRADES = "01185";
const PRIORITY_TARGET = "33007";
const TRACER_INTERRUPT = "01007.spider-tracer-forced-interrupt";
const BIO_INTERRUPT = "01185.biomechanical-upgrades-forced-interrupt";
const TARGET_INTERRUPT = "33007.priority-target-interrupt";
const MAGOG_INTERRUPT = "39001a.magog-forced-interrupt";

/** A game past setup, P1 in hero form on their own turn. */
function game(scenarioId: string, starterDeckId: string, modularSetIds: readonly string[]): GameState {
  const created = createGame(
    playableScenario(scenarioId, { seed: 1, players: [{ starterDeckId }], modularSetIds, firstPlayerIndex: 0 }),
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
  return withForm(settled, { heroForm: 0 });
}

/** A player card taken from P1's hand or deck and attached to `host` by surgery (no play, no cost). */
function attachOwn(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}

type Prompt = { readonly kind: string; readonly optionIds: readonly string[] };

/** P1's hero attacks `target`, already damaged to the brink; every trigger prompt asked is returned. */
function killShot(state: GameState, target: InstanceId, pick: Picker = firstLegal) {
  const prompts: Prompt[] = [];
  const recording: Picker = (now) => {
    const choice = now.pendingChoice;
    if (choice && (choice.prompt.kind === "orderTriggers" || choice.prompt.kind === "chooseTriggers"))
      prompts.push({ kind: choice.prompt.kind, optionIds: choice.options.map((o) => o.optionId) });
    return pick(now);
  };
  const brink = patchInstance(state, target, { damage: 999 });
  const driven = driveEventsPicking(deps, brink, recording, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(brink, P1),
    targetInstanceId: target,
  });
  return { ...driven, prompts };
}

const resolved = (events: readonly GameEvent[], ...abilityIds: readonly string[]): readonly string[] =>
  events.flatMap((e) =>
    e.type === "abilityResolved" && abilityIds.includes(String(e.abilityId)) ? [String(e.abilityId)] : [],
  );
/** The interrupt windows opened on `target`'s defeat: which tier, and the abilities gathered. */
const defeatWindows = (events: readonly GameEvent[], target: InstanceId) =>
  events.flatMap((e) =>
    e.type === "windowOpened" &&
    e.timing === "interrupt" &&
    e.event.kind === "characterDefeated" &&
    e.event.instanceId === target
      ? [{ would: e.would === true, abilities: e.candidates.map((c) => String(c.abilityId)) }]
      : [],
  );

describe("Biomechanical Upgrades (01185, 'would be defeated … instead') with Spider-Tracer (01007, 'is defeated')", () => {
  function armed() {
    const base = game("rhino", "core-spider-man-justice", ["the_doomsday_chair"]);
    const engaged = engageMinion(base, HYDRA_MERCENARY, P1);
    const bio = attachToHost(engaged.state, BIOMECHANICAL_UPGRADES, engaged.id);
    const tracer = attachOwn(bio.state, SPIDER_TRACER, engaged.id);
    return { state: tracer.state, minion: engaged.id, bio: bio.id, tracer: tracer.id };
  }

  it("the replacement resolves alone: no ordering prompt, the minion is healed and Spider-Tracer removes no threat", () => {
    const { state, minion, bio, tracer } = armed();
    const threat = mainThreat(state);
    const { state: after, events, prompts } = killShot(state, minion);
    expect(prompts).toEqual([]);
    expect(resolved(events, BIO_INTERRUPT, TRACER_INTERRUPT)).toEqual([BIO_INTERRUPT]);
    expect(defeatWindows(events, minion)).toEqual([{ would: true, abilities: [BIO_INTERRUPT] }]);
    expect(cardsInPlay(after)).toContain(minion);
    expect(inst(after, minion).damage).toBe(0);
    expect(mainThreat(after)).toBe(threat);
    // Biomechanical Upgrades discarded itself; Spider-Tracer is still on the minion for its real defeat.
    expect(inst(after, minion).attachments).toEqual([tracer]);
    expect(cardsInPlay(after)).not.toContain(bio);
  });

  it("the next defeat is not replaced: Spider-Tracer's interrupt resolves and the minion is defeated", () => {
    const { state, minion } = armed();
    const saved = killShot(state, minion).state;
    const again = patchInstance(saved, identityOf(saved, P1), { exhausted: false });
    const threat = mainThreat(again);
    const { state: after, events, prompts } = killShot(again, minion);
    expect(prompts).toEqual([]);
    expect(resolved(events, BIO_INTERRUPT, TRACER_INTERRUPT)).toEqual([TRACER_INTERRUPT]);
    expect(defeatWindows(events, minion)).toEqual([{ would: false, abilities: [TRACER_INTERRUPT] }]);
    expect(cardsInPlay(after)).not.toContain(minion);
    expect(mainThreat(after)).toBe(Math.max(0, threat - 3));
  });
});

describe("MaGog (39001a, 'would be defeated … instead') with Priority Target (33007, 'is defeated')", () => {
  it("MaGog's reset resolves first and Priority Target is not offered for the defeat it replaced", () => {
    const base = game("magog", "cyclops-leadership", ["crime"]);
    const villain = activeVillain(base).instanceId;
    const { state, id: target } = attachOwn(base, PRIORITY_TARGET, villain);
    const hand = playerOf(state, P1).hand.length;
    const { state: after, events, prompts } = killShot(state, villain);
    expect(prompts.flatMap((prompt) => prompt.optionIds).filter((id) => id.includes(TARGET_INTERRUPT))).toEqual([]);
    expect(resolved(events, MAGOG_INTERRUPT, TARGET_INTERRUPT)).toEqual([MAGOG_INTERRUPT]);
    expect(defeatWindows(events, villain)).toEqual([{ would: true, abilities: [MAGOG_INTERRUPT] }]);
    expect(after.outcome).toBeNull();
    expect(inst(after, villain).damage).toBe(0);
    expect(inst(after, villain).attachments).toContain(target);
    expect(playerOf(after, P1).hand.length).toBe(hand);
  });
});
