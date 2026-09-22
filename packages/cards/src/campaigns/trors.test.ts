/**
 * `TRORS_CAMPAIGN_DEFINITION` played headlessly through the real runner (docs/campaign-mode-design.md §11 step 7's
 * own acceptance test), for the first two scenarios: `resolveBetweenGames` composes Crossbones from a fresh log, a
 * real game is created and driven with `../testing/driver.ts`'s greedy player, `campaignResultOf`/
 * `applyCampaignResult` fold the result back, and the resulting log feeds straight into composing Absorbing Man
 * the same way. Not a synthetic campaign — real Crossbones/Absorbing Man content, real starter decks.
 *
 * **On forcing the outcome.** `../testing/driver.ts`'s greedy player is built to reach *an* outcome, not to win —
 * confirmed empirically while writing this test: across 20 solo seeds each, it never won Rhino (Core's own
 * easiest scenario), Crossbones or Absorbing Man; every game ended `mainSchemeCompleted` or `allPlayersDefeated`.
 * MC10 p. 3's loss is "no penalty, try again", which this campaign models with an empty `defeat` list for both
 * these nodes (`trors.ts`) — so a *real* driver loss proves the retry path (the log restores to `logBefore` and
 * `nextNodeId` stays on the same node) but proves nothing about the victory writes this file exists to check.
 * Rather than skip that half, each game is driven to its real (losing) conclusion — proving every `inGame` setup
 * effect resolves legally inside real content and the loss/retry path is correct — and then the *victory* half is
 * proven by re-deriving `campaignResultOf` from that same real, played-out state with its `outcome` overridden to
 * a win. The state, the event stream and every card instance are genuine; only the win/loss verdict is substituted,
 * exactly the fact the driver cannot reliably produce. Flagged here rather than silently presented as a win.
 */
import { describe, expect, it } from "vitest";
import { TRORS_STARTER_DECKS, WAVE2_CARDS, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  campaignResultOf,
  createCampaignLog,
  createGame,
  replay,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignDeps,
  type CampaignLog,
  type CampaignSeatSetup,
  type GameState,
} from "@mc/engine";
import { playToOutcome } from "../testing/driver.js";
import { WAVE2_DEPS, wave2Scenario } from "../wave2/index.js";
import { TRORS_CAMPAIGN_DEFINITION } from "./trors.js";

const DEPS: CampaignDeps = { pool: WAVE2_CARDS };
const MODES: PlayModes = { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } };

const STARTER_IDS = ["hawkeye-leadership", "spider-woman-aggression-justice"] as const;

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = TRORS_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no trors starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = STARTER_IDS.map((id, index) => seatFor(id, index + 1));

interface Played {
  readonly logAfterRealOutcome: CampaignLog;
  readonly logAfterForcedWin: CampaignLog;
}

/**
 * Composes the log's next node, creates and drives a real game to its real outcome (always a loss — see the file
 * header), folds that back, then re-derives the fold with the same finished state's `outcome` overridden to a win.
 */
function playNode(log: CampaignLog): Played {
  const composed = resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, log.modes);
  if (composed.kind !== "done") {
    throw new Error(`unexpected pending choice composing ${JSON.stringify(composed.choice)}`);
  }
  const start = startGameFromLog(TRORS_CAMPAIGN_DEFINITION, composed.value);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);

  const config = wave2Scenario(start.scenarioId as string, {
    players: STARTER_IDS.map((starterDeckId) => ({ starterDeckId })),
    seed: start.input.seed,
  });
  const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed for ${start.nodeId}: ${created.error.message}`);

  const driven = playToOutcome(created.state, WAVE2_DEPS);
  if (!driven.outcome) throw new Error(`${start.nodeId} never reached an outcome`);
  const replayed = replay(driven.session.log, WAVE2_DEPS);
  if (!replayed.ok) throw new Error(`${start.nodeId}'s session log did not replay`);
  const events = [...created.events, ...replayed.events];

  const fold = (state: GameState) => {
    const result = campaignResultOf(TRORS_CAMPAIGN_DEFINITION, composed.value, state, events, WAVE2_DEPS);
    const applied = applyCampaignResult(
      TRORS_CAMPAIGN_DEFINITION,
      composed.value,
      result,
      { at: 1_700_000_000_000, gameId: `smoke-${start.nodeId}` },
      DEPS,
    );
    if (applied.kind !== "done") {
      throw new Error(`unexpected pending choice applying ${start.nodeId}'s result: ${JSON.stringify(applied.choice)}`);
    }
    return applied.value;
  };

  return {
    logAfterRealOutcome: fold(driven.session.state),
    logAfterForcedWin: fold({ ...driven.session.state, outcome: { result: "win", reason: "villainDefeated" } }),
  };
}

describe("TRORS_CAMPAIGN_DEFINITION played through the real runner", () => {
  it("Crossbones, then Absorbing Man, both real games: the loss/retry path and the victory writes both hold", () => {
    const seedLog = createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
      id: "smoke-trors",
      seats: SEATS,
      modes: MODES,
      poolVersion: "smoke-test",
      seed: 9001,
    });
    expect(seedLog.position.nextNodeId).toBe("crossbones");

    // --- the real, losing game: proves the setup instructions resolved (the game reached a legal outcome at
    // all) and MC10 p. 3's "no penalty, try again" retry (no `defeat` block for this node).
    const crossbones = playNode(seedLog);
    expect(crossbones.logAfterRealOutcome.position.resolved.crossbones).toBeUndefined();
    expect(crossbones.logAfterRealOutcome.position.nextNodeId).toBe("crossbones");
    expect(crossbones.logAfterRealOutcome.shared.experimental).toBeUndefined();
    expect(crossbones.logAfterRealOutcome.history).toHaveLength(1);
    expect(crossbones.logAfterRealOutcome.history[0]?.outcome).toBe("lost");

    // --- the same played-out state, re-folded as a win: proves the victory instructions.
    let log = crossbones.logAfterForcedWin;
    expect(log.position.resolved.crossbones).toBe("completed");
    expect(log.position.nextNodeId).toBe("absorbing-man");
    // mc10.s1.victory.experimental: the "experimental" field is a cardList, present (even if empty — Crossbones may
    // or may not draw an Experimental Weapons card in a short greedy game; the point is the write happened).
    expect(log.shared.experimental).toEqual({ kind: "cardList", cardIds: expect.any(Array) });
    // No `remainingHp` write: this campaign is played in standard (non-expert-campaign) mode, and every
    // `remainingHp` write is gated `whenModes: { expertCampaign: true }`.
    expect(log.seats[0]?.fields.remainingHp).toBeUndefined();
    expect(log.history).toHaveLength(1);
    expect(log.history[0]?.outcome).toBe("won");
    expect(log.history[0]?.steps.some((step) => step.instructionId === "mc10.s1.victory.experimental")).toBe(true);

    const absorbingMan = playNode(log);
    expect(absorbingMan.logAfterRealOutcome.position.resolved["absorbing-man"]).toBeUndefined();
    expect(absorbingMan.logAfterRealOutcome.position.nextNodeId).toBe("absorbing-man");

    log = absorbingMan.logAfterForcedWin;
    expect(log.position.resolved["absorbing-man"]).toBe("completed");
    expect(log.position.nextNodeId).toBe("taskmaster");
    // mc10.s2.victory.delay: "delayCounters" is a plain number, written from the finished game's main scheme.
    expect(log.shared.delayCounters).toEqual({ kind: "number", value: expect.any(Number) });
    // mc10.s2.setup.experimental (the shuffle-in instruction, reading the "experimental" field this same run
    // carried forward) ran inside the Absorbing Man game itself: proved by that game having reached a legal
    // outcome at all with campaign input attached — an illegal `inGame` effect fails `createGame`, not the driver.
    // History now has both attempts: Crossbones' forced win (carried into this log), then Absorbing Man's.
    expect(log.history.map((entry) => entry.nodeId)).toEqual(["crossbones", "absorbing-man"]);
    expect(log.history[1]?.steps.some((step) => step.instructionId === "mc10.s2.victory.delay")).toBe(true);
  }, 180_000);
});
