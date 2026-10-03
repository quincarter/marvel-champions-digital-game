/**
 * `MOJO_CAMPAIGN_DEFINITION` (MojoMania) driven through the real runner and a real game at every node
 * (`mut_gen.qa.test.ts`'s shape; `mojo.test.ts` is the definition's own unit file):
 *
 * - **A full three-scenario campaign** (Spider-Man, one player): at every node the composed log starts a real game
 *   (`wave6Scenario` + the log's modular set picks + the composed Longshot set + `createGame`), the greedy headless
 *   driver (`../testing/driver.ts`) plays it to its real outcome, the session log is replayed to a deep-equal state, and
 *   `campaignResultOf` derives the node's result from the real final state and event stream.
 *   **Staged by surgery** (the scenarios' own e2e files, `../wave6/mojo/*-e2e.test.ts`, stage the same way, because the
 *   greedy driver cannot win these games unaided): MaGog starts with 4 ratings counters on The Challengers, Spiral on
 *   her CORNERED side at stage II with 14 damage, Mojo at stage II with 17 damage. Everything after that is played, and
 *   every outcome here is the driver's own (no outcome is overridden). The campaign seed (10) is the first of the seeds
 *   1-80 whose three staged games the driver wins; seeds 17 and 47 win scenario 1 and lose scenario 2.
 * - **A real lost-and-retried scenario**: scenario 2 really lost, folded as a loss with the log intact and the checked-off
 *   sets unchanged, and the retry starts a new real game.
 * - **An expert run**: a real expert scenario 1 game; its outcome is overridden to a win (`mut_gen.qa.test.ts`'s
 *   documented substitution, since the driver does not win expert MaGog), the real hit points it ended with recorded
 *   capped at base, and restored (and healed) in a real scenario 2 game.
 */
import { describe, expect, it } from "vitest";
import {
  campaignResultOf,
  maxHitPoints,
  remainingHitPoints,
  replay,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type GameEvent,
  type GameState,
} from "@mc/engine";
import { playToOutcome } from "../testing/driver.js";
import { firstLegal, patchInstance, settle } from "../testing/harness.js";
import { WAVE6_DEPS } from "../wave6/index.js";
import { challengersOf } from "../wave6/mojo/magog-testing.js";
import { mojoOf, withMojoStage } from "../wave6/mojo/mojo-testing.js";
import { spiralOf, withSpiral } from "../wave6/mojo/spiral-testing.js";
import { mojoCheckedOffSets, mojoModularSetPicks } from "./mojo.js";
import {
  EXPERT,
  MOJO_DEF as DEF,
  SOLO_SEATS,
  STANDARD,
  asWin,
  build,
  compose,
  controlledBy,
  finish,
  inst,
  newLog,
  printedCost,
  recordedOf,
  sharedField,
  struckOf,
} from "./mojo-testing.js";

type Staging = (state: GameState) => GameState;
const STAGING: Readonly<Record<string, Staging>> = {
  magog: (s) => patchInstance(s, challengersOf(s), { counters: { ratings: 4 } }),
  spiral: (s) =>
    patchInstance(withSpiral(s, { side: "B", stageIndex: 1 }), spiralOf(withSpiral(s, { side: "B", stageIndex: 1 })), {
      damage: 14,
    }),
  mojo: (s) => patchInstance(withMojoStage(s, 1), mojoOf(withMojoStage(s, 1)), { damage: 17 }),
};

/** Takes every recorded card a setup offers, heals when asked, otherwise declines like `firstLegal`. */
const campaignPlayer = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseCards")
    return choice.options.slice(0, choice.maxSelections).map((o) => o.optionId);
  return firstLegal(state);
};

interface Played {
  readonly composed: CampaignLog;
  readonly built: ReturnType<typeof build>;
  readonly final: GameState;
  readonly events: readonly GameEvent[];
  readonly outcome: "win" | "loss";
}

/** Composes the node, starts the real game, stages it, plays it with the driver and proves its session replays. */
function playNode(log: CampaignLog, nodeId: string, stage = true): Played {
  const composed = compose(log).log;
  const built = build(composed);
  expect(built.start.nodeId).toBe(nodeId);
  const settled = settle(built.state, campaignPlayer, (s) => s.step.phase === "player", WAVE6_DEPS);
  const driven = playToOutcome(stage ? STAGING[nodeId]!(settled) : settled, WAVE6_DEPS, { maxCommands: 40_000 });
  expect(driven.outcome, `${nodeId} never reached an outcome`).not.toBeNull();
  const replayed = replay(driven.session.log, WAVE6_DEPS);
  expect(replayed.ok, `${nodeId}: replay failed`).toBe(true);
  if (!replayed.ok) throw new Error("replay failed");
  expect(replayed.state).toEqual(driven.session.state);
  return {
    composed,
    built,
    final: driven.session.state,
    events: [...built.events, ...replayed.events],
    outcome: driven.outcome!.result === "win" ? "win" : "loss",
  };
}

const resultOf = (played: Played, state: GameState = played.final): CampaignGameResult =>
  campaignResultOf(DEF, played.composed, state, played.events, WAVE6_DEPS);

/** Records the last card each seat is offered (the dearest the cap allows); the choice is what the log was asked. */
const recordLast = (choice: CampaignPendingChoice): readonly string[] =>
  choice.slot === "recordedCard" && choice.options.length > 0 ? [choice.options[choice.options.length - 1]!] : [];

const SEED = 10;

describe("a full MojoMania campaign: a real game at every node, the log checked after each (insert pp. 4-17)", () => {
  it("plays MaGog, Spiral and Mojo, each composed from the log, played, replayed and folded back", () => {
    let log = newLog(STANDARD, SOLO_SEATS, SEED);
    expect(log.position.nextNodeId).toBe("magog");

    // ---- Scenario 1, MaGog (insert p. 9) ----
    const s1 = playNode(log, "magog");
    expect(s1.outcome).toBe("win");
    expect(mojoModularSetPicks(s1.composed)).toHaveLength(1);
    const set1 = mojoModularSetPicks(s1.composed)[0]!;
    // "Shuffle the Longshot ally into the encounter deck": he is somewhere in the game's cards, never set aside.
    expect(Object.values(s1.final.instances).some((i) => i.cardId === "39071")).toBe(true);
    const r1 = resultOf(s1);
    expect(r1.outcome).toBe("won");
    const longshotIn1 = controlledBy(s1.final, 0).includes("39071");
    expect(r1.records.find((r) => r.write.field === "longshotInPlay")?.write.value).toEqual({
      kind: "flag",
      value: longshotIn1,
    });
    const folded1 = finish(s1.composed, r1, recordLast);
    log = folded1.log;
    expect(log.position.resolved.magog).toBe("completed");
    expect(log.position.nextNodeId).toBe("spiral");
    // "Check off the name of the modular encounter set used in this scenario."
    expect(mojoCheckedOffSets(log)).toEqual([set1]);
    expect(sharedField(log, "longshotInPlay")).toEqual({ kind: "flag", value: longshotIn1 });
    // "Each player may choose one support or upgrade they control costing 2 or less (3 or less on BOOING CROWD)":
    // what was recorded is a support or upgrade Spider-Man controlled when the game ended, within the cap.
    const offered1 = folded1.asked.find((c) => c.slot === "recordedCard");
    const recorded1 = recordedOf(log, 0);
    const controlled1 = controlledBy(s1.final, 0);
    for (const card of offered1?.options ?? []) {
      expect(controlled1).toContain(card);
      expect(printedCost(card)).toBeLessThanOrEqual(3);
    }
    expect(offered1?.options.length).toBeGreaterThan(0);
    expect(recorded1).toHaveLength(1);

    // ---- Scenario 2, Spiral (insert pp. 13-14) ----
    const s2 = playNode(log, "spiral");
    expect(s2.outcome).toBe("win");
    const picks2 = mojoModularSetPicks(s2.composed);
    expect(picks2).toHaveLength(3);
    expect(picks2).not.toContain(set1);
    expect(new Set(picks2).size).toBe(3);
    // The recorded card was taken into play at setup (the driver's `campaignPlayer` takes what is offered): the card
    // is in play under Spider-Man's control in the settled game, and it came from a deck, not a hand.
    const settled2 = settle(s2.built.state, campaignPlayer, (s) => s.step.phase === "player", WAVE6_DEPS);
    for (const card of recorded1) expect(controlledBy(settled2, 0)).toContain(card);
    const r2 = resultOf(s2);
    const folded2 = finish(s2.composed, r2, recordLast);
    log = folded2.log;
    expect(log.position.nextNodeId).toBe("mojo");
    expect(struckOf(log, "modularSets")).toEqual([set1, ...picks2]);
    expect(recordedOf(log, 0).slice(0, recorded1.length)).toEqual(recorded1);
    expect(recordedOf(log, 0).length).toBeLessThanOrEqual(2);

    // ---- Scenario 3, Mojo (insert p. 17) ----
    const s3 = playNode(log, "mojo");
    expect(s3.outcome).toBe("win");
    const picks3 = mojoModularSetPicks(s3.composed);
    // One player: 1 + 1 sets, the unchecked ones (two remain), set aside for the Wheel of Genres.
    expect(picks3).toHaveLength(2);
    for (const set of picks3) expect(struckOf(log, "modularSets")).not.toContain(set);
    expect([...(s3.final.setAsideModularSets ?? []), ...[]].length).toBeLessThanOrEqual(2);
    const settled3 = settle(s3.built.state, campaignPlayer, (s) => s.step.phase === "player", WAVE6_DEPS);
    for (const card of recordedOf(log, 0)) expect(controlledBy(settled3, 0)).toContain(card);
    const r3 = resultOf(s3);
    log = finish(s3.composed, r3).log;
    expect(log.status).toBe("won");
    expect(log.history.map((h) => [h.nodeId, h.outcome])).toEqual([
      ["magog", "won"],
      ["spiral", "won"],
      ["mojo", "won"],
    ]);
  }, 600_000);

  it("the threat a setup adds is the cost of the recorded cards (real game, real recorded card)", () => {
    let log = newLog(STANDARD, SOLO_SEATS, SEED);
    const s1 = playNode(log, "magog");
    log = finish(s1.composed, resultOf(s1), recordLast).log;
    const recorded = recordedOf(log, 0);
    expect(recorded).toHaveLength(1);
    const composed = compose(log).log;
    const taken = settle(build(composed).state, campaignPlayer, (s) => s.step.phase === "player", WAVE6_DEPS);
    const declined = settle(build(composed).state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
    const threat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;
    expect(threat(taken) - threat(declined)).toBe(recorded.reduce((sum, card) => sum + printedCost(card), 0));
  });
});

describe("a lost scenario is retried with the log intact (insert p. 4)", () => {
  it("scenario 2 really lost: nothing is checked off, the history keeps the loss, and the retry is a new real game", () => {
    let log = newLog(STANDARD, SOLO_SEATS, 17);
    const s1 = playNode(log, "magog");
    expect(s1.outcome).toBe("win");
    log = finish(s1.composed, resultOf(s1), recordLast).log;
    const before = struckOf(log, "modularSets");

    const s2 = playNode(log, "spiral");
    expect(s2.outcome).toBe("loss");
    const lost = finish(s2.composed, resultOf(s2));
    expect(lost.log.position.nextNodeId).toBe("spiral");
    expect(lost.log.position.resolved.spiral).toBeUndefined();
    expect(struckOf(lost.log, "modularSets")).toEqual(before);
    expect(recordedOf(lost.log, 0)).toEqual(recordedOf(log, 0));
    expect(lost.log.history.map((h) => [h.nodeId, h.outcome])).toEqual([
      ["magog", "won"],
      ["spiral", "lost"],
    ]);
    // The retry: the same node composed again from the rolled-back log, a fresh real game with the same setup rules.
    const retry = playNode(lost.log, "spiral", false);
    expect(mojoModularSetPicks(retry.composed)).toHaveLength(3);
    for (const set of mojoModularSetPicks(retry.composed)) expect(before).not.toContain(set);
    expect(retry.built.state).not.toBe(s2.built.state);
  }, 600_000);
});

describe("the expert campaign, from a real game (insert p. 5)", () => {
  it("records the hit points a real scenario 1 ended with, capped at base, and restores then heals them in scenario 2", () => {
    const log0 = newLog(EXPERT, SOLO_SEATS, 5);
    const s1 = playNode(log0, "magog");
    // The substitution: the real final state with its outcome overridden to a win (the driver does not win expert MaGog).
    const won = asWin(s1.final);
    const result = resultOf(s1, won);
    const identity = won.players[0]!.identity.instanceId;
    const base = maxHitPoints(won, identity, WAVE6_DEPS)!;
    const real = Math.max(0, Math.min(remainingHitPoints(won, identity, WAVE6_DEPS) ?? 0, base));
    expect(result.records.find((r) => r.write.field === "remainingHp")?.write.value).toEqual({
      kind: "number",
      value: real,
    });
    const log = finish(s1.composed, result, recordLast).log;
    expect(log.seats[0]?.fields.remainingHp).toEqual({ kind: "number", value: real });
    expect(real).toBeLessThanOrEqual(base);

    const composed = compose(log).log;
    const built = build(composed);
    const identity2 = built.state.players[0]!.identity.instanceId;
    const labelled =
      (label: string) =>
      (state: GameState): readonly string[] => {
        const choice = state.pendingChoice;
        const hit = choice?.options.find((o) => o.label === label);
        return hit ? [hit.optionId] : campaignPlayer(state);
      };
    const kept = settle(built.state, labelled("Decline"), (s) => s.step.phase === "player", WAVE6_DEPS);
    // "Set each player's hit points to their remaining hit point value recorded in the campaign log": a player who
    // recorded 0 (defeated) cannot decline, and is healed.
    if (real > 0) expect(remainingHitPoints(kept, identity2, WAVE6_DEPS)).toBe(real);
    const healed = settle(built.state, labelled("Heal to full"), (s) => s.step.phase === "player", WAVE6_DEPS);
    expect(remainingHitPoints(healed, identity2, WAVE6_DEPS)).toBe(maxHitPoints(healed, identity2, WAVE6_DEPS));
    // Healing deals the player one facedown encounter card (insert p. 5); declining deals none.
    if (real > 0) {
      expect(healed.players[0]!.dealtEncounter).toHaveLength(1);
      expect(kept.players[0]!.dealtEncounter).toHaveLength(0);
    }
  }, 300_000);
});
