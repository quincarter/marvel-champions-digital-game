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
import { TRORS_CAMPAIGN, TRORS_STARTER_DECKS, WAVE2_CARDS, type CardId, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  CAMPAIGN_ACCEPT,
  campaignChoiceKey,
  campaignResultOf,
  createCampaignLog,
  createGame,
  replay,
  resolveBetweenGames,
  startGameFromLog,
  validateDeck,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type DeckContext,
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

// --- answering the box's own choices -------------------------------------------------------------------------
// Every `choose`/`random` the rulebook prints comes back as a pending choice the caller answers, so a test that
// drives the runner *is* a caller: it looks each one up in a fixed script and fails loudly on an unscripted one.

const answer = (
  instructionId: string,
  slot: string,
  seatNumber: number,
  picked: readonly string[],
): CampaignChoiceAnswer => ({ instructionId, slot, seatNumber, picked });

interface Settled<T> {
  readonly value: T;
  readonly asked: readonly CampaignPendingChoice[];
}

function settle<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[],
): Settled<T> {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { value: outcome.value, asked };
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) {
      throw new Error(
        `the script has no answer for ${campaignChoiceKey(outcome.choice)} of [${outcome.choice.options.join(", ")}]`,
      );
    }
    asked.push(outcome.choice);
    answers.push(found);
  }
  throw new Error("the runner asked for more than 24 choices in one step list");
}

/** MC10 p. 5's four TECH upgrades and p. 7's four "Basic" Condition upgrades, both printed in the Hydra Campaign set. */
const TECH_IDS = ["04155", "04156", "04157", "04158"];
const BASIC_IDS = ["04159a", "04160a", "04161a", "04162a"];
const OBLIGATION_IDS = ["04163", "04164", "04165", "04166"];
/** MC10 p. 10's Taskmaster Captive allies, which the victory instruction adds to the rescuer's deck. */
const MOON_KNIGHT = "04097";

/** Seat 1 takes everything on offer; seat 2 takes a TECH upgrade (not optional) and declines every "may". */
const SCRIPT: readonly CampaignChoiceAnswer[] = [
  answer("mc10.s1.victory.tech", "tech", 1, [TECH_IDS[0] as string]),
  answer("mc10.s1.victory.tech", "tech", 2, [TECH_IDS[1] as string]),
  answer("mc10.s2.victory.basic", "basic", 1, [BASIC_IDS[0] as string]),
  answer("mc10.s2.victory.basic", "basic", 2, []),
  ...["s2", "s3", "s4", "s5"].flatMap((scenario) => [
    answer(`mc10.${scenario}.setup.obligation`, "obligation", 1, [CAMPAIGN_ACCEPT]),
    answer(`mc10.${scenario}.setup.obligation`, "obligation", 2, []),
  ]),
  answer("mc10.s4.victory.improved", "improve", 1, [BASIC_IDS[0] as string]),
];

interface Played {
  readonly logAfterRealOutcome: CampaignLog;
  readonly logAfterForcedWin: CampaignLog;
}

/**
 * Composes the log's next node, creates and drives a real game to its real outcome (always a loss — see the file
 * header), folds that back, then re-derives the fold with the same finished state's `outcome` overridden to a win.
 */
function playNode(log: CampaignLog): Played {
  const composed = settle(
    (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers),
    SCRIPT,
  );
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

  const fold = (state: GameState): CampaignLog => {
    const result = campaignResultOf(TRORS_CAMPAIGN_DEFINITION, composed.value, state, events, WAVE2_DEPS);
    return settle(
      (answers) =>
        applyCampaignResult(
          TRORS_CAMPAIGN_DEFINITION,
          composed.value,
          result,
          { at: 1_700_000_000_000, gameId: `smoke-${start.nodeId}` },
          DEPS,
          answers,
        ),
      SCRIPT,
    ).value;
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

// ---------------------------------------------------------------------------------------------------------------
// The whole campaign's *between-games* half, in expert campaign mode
// ---------------------------------------------------------------------------------------------------------------
//
// Every instruction above that needs no `GameState` — the two upgrade choices, the four obligation draws, Zola's
// prison bullets and the "Improved" replacement — is a function of `(log, answers, the finished game's records)`,
// so this walk drives all five nodes with each node's records supplied directly. No game is played: what a game
// would have computed for a `record` instruction is exactly what `campaignResultOf` derives, which the real-game
// test above and `@mc/engine`'s own `cardsTuckedUnder` test each prove separately. That keeps the five-node walk
// fast enough to assert every printed bullet rather than only the two scenarios a driven game can reach.

const EXPERT: PlayModes = {
  campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true },
};

type Records = CampaignGameResult["records"];

const record = (instructionId: string, field: string, seatNumber: number | null, value: unknown): Records[number] =>
  ({ instructionId, write: { field, seatNumber, mode: "set", value } }) as Records[number];

/** What each node's finished game reports. Only the fields a later instruction reads need to be here. */
const RECORDS: Readonly<Record<string, Records>> = {
  crossbones: [],
  "absorbing-man": [],
  taskmaster: [
    {
      instructionId: "mc10.s3.victory.rescued-record",
      write: {
        field: "rescuedAllies",
        seatNumber: 1,
        mode: "append",
        value: { kind: "cardList", cardIds: [MOON_KNIGHT as CardId] },
      },
    },
  ],
  zola: [
    // Hydra Prison was defeated, so it is not in play and no ally is underneath it: the printed if/else takes the
    // "not in play" branch, and the players may improve their upgrades.
    record("mc10.s4.victory.prison", "hydraPrison", null, { kind: "flag", value: false }),
    record("mc10.s4.victory.hero-form", "heroForm", 1, { kind: "flag", value: true }),
    record("mc10.s4.victory.hero-form", "heroForm", 2, { kind: "flag", value: false }),
  ],
  "red-skull": [],
};

const walk = (
  over: Readonly<Record<string, Records>> = {},
): { readonly log: CampaignLog; readonly asked: readonly CampaignPendingChoice[] } => {
  let log = createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
    id: "walk-trors",
    seats: SEATS,
    modes: EXPERT,
    poolVersion: "smoke-test",
    seed: 4242,
  });
  const asked: CampaignPendingChoice[] = [];
  for (let node = 0; node < 5; node++) {
    const nodeId = log.position.nextNodeId;
    if (nodeId === null) break;
    const composed = settle(
      (answers) => resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      SCRIPT,
    );
    asked.push(...composed.asked);
    const result: CampaignGameResult = {
      nodeId,
      outcome: "won",
      records: over[nodeId] ?? RECORDS[nodeId] ?? [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const applied = settle(
      (answers) =>
        applyCampaignResult(
          TRORS_CAMPAIGN_DEFINITION,
          composed.value,
          result,
          { at: 1_700_000_000_000 },
          DEPS,
          answers,
        ),
      SCRIPT,
    );
    asked.push(...applied.asked);
    log = applied.value;
  }
  return { log, asked };
};

describe("TRORS_CAMPAIGN_DEFINITION's between-games instructions, all five scenarios", () => {
  it("wins the campaign, and asks exactly the choices the rulebook prints, in printed order", () => {
    const { log, asked } = walk();

    expect(log.status).toBe("won");
    expect(log.history.map((entry) => entry.nodeId)).toEqual([
      "crossbones",
      "absorbing-man",
      "taskmaster",
      "zola",
      "red-skull",
    ]);
    expect(asked.map((choice) => `${choice.instructionId}/${choice.slot}/${choice.seatNumber ?? "-"}`)).toEqual([
      "mc10.s1.victory.tech/tech/1",
      "mc10.s1.victory.tech/tech/2",
      "mc10.s2.setup.obligation/obligation/1",
      "mc10.s2.setup.obligation/obligation/2",
      "mc10.s2.victory.basic/basic/1",
      "mc10.s2.victory.basic/basic/2",
      "mc10.s3.setup.obligation/obligation/1",
      "mc10.s3.setup.obligation/obligation/2",
      "mc10.s4.setup.obligation/obligation/1",
      "mc10.s4.setup.obligation/obligation/2",
      // Seat 2 is never asked: it declined the "Basic" upgrade, so it has nothing to replace (and, in this walk,
      // ended Zola in alter-ego form besides).
      "mc10.s4.victory.improved/improve/1",
      "mc10.s5.setup.obligation/obligation/1",
      "mc10.s5.setup.obligation/obligation/2",
    ]);
  });

  it("adds one TECH upgrade per player, and never the same physical card twice (MC10 p. 5)", () => {
    const { log, asked } = walk();
    const tech = asked.filter((choice) => choice.slot === "tech");

    // The Hydra Campaign set also holds the four Condition upgrades, which this choice never offers.
    expect(tech[0]?.options).toEqual(TECH_IDS);
    expect(tech[1]?.options).toEqual(TECH_IDS.filter((id) => id !== TECH_IDS[0]));
    expect(log.seats[0]?.fields.techUpgrade).toEqual({ kind: "cardRef", cardId: TECH_IDS[0] });
    expect(log.seats[1]?.fields.techUpgrade).toEqual({ kind: "cardRef", cardId: TECH_IDS[1] });
  });

  it("lets a player decline the \u201CBasic\u201D upgrade, and leaves that column unset (MC10 p. 7)", () => {
    const { log, asked } = walk();
    const basic = asked.filter((choice) => choice.slot === "basic");

    expect(basic[0]?.options).toEqual(BASIC_IDS);
    expect(basic.every((choice) => choice.optional)).toBe(true);
    expect(log.seats[0]?.grants.some((grant) => grant.cardId === BASIC_IDS[0])).toBe(true);
    expect(log.seats[1]?.fields.basicUpgrade).toBeUndefined();
    expect(log.seats[1]?.grants.some((grant) => BASIC_IDS.includes(grant.cardId as string))).toBe(false);
  });

  it("replaces the taker's \u201CBasic\u201D upgrade with its \u201CImproved\u201D side, and no one else's (MC10 p. 12)", () => {
    const { log } = walk();

    expect(log.seats[0]?.grants.find((grant) => grant.cardId === BASIC_IDS[0])?.face).toBe("Improved Thwart Upgrade");
    expect(log.seats[1]?.grants.every((grant) => grant.face === undefined)).toBe(true);
  });

  it("asks each player whether to take a random obligation, and draws it from the campaign's own RNG (MC10 p. 17)", () => {
    const { log, asked } = walk();
    const draws = asked.filter((choice) => choice.slot === "obligation");
    const taken = log.seats[0]?.fields.obligations as { readonly cardIds: readonly string[] } | undefined;

    // The players decide whether, never which: the only option is the accept token.
    expect(draws.every((choice) => choice.options.length === 1 && choice.options[0] === CAMPAIGN_ACCEPT)).toBe(true);
    expect(draws.every((choice) => choice.optional && choice.random === true)).toBe(true);
    // One per scenario from #2 on, all four drawn from the expert campaign set, and the same seed draws the same.
    expect(taken?.cardIds).toHaveLength(4);
    for (const id of taken?.cardIds ?? []) expect(OBLIGATION_IDS).toContain(id);
    expect(walk().log.seats[0]?.fields.obligations).toEqual(taken);
    // Seat 2 declined every time, so its box is unchecked and its deck holds no obligation.
    expect(log.seats[1]?.fields.obligations).toBeUndefined();
    // Cleared at the start of the instruction and never set: "nothing recorded", which the in-game heal reads as
    // false. (Seat 1's is checked for the scenario it took one in and cleared again by the next scenario's.)
    expect(log.seats[1]?.fields.healedByObligation).toBeUndefined();
    expect(log.seats[0]?.fields.healedByObligation).toEqual({ kind: "flag", value: true });
  });

  it("removes the allies left in Hydra Prison from the campaign, and improves nothing (MC10 p. 12)", () => {
    const imprisoned = [MOON_KNIGHT as CardId];
    const { log } = walk({
      zola: [
        record("mc10.s4.victory.prison", "hydraPrison", null, { kind: "flag", value: true }),
        {
          instructionId: "mc10.s4.victory.prison",
          write: {
            field: "imprisonedAllies",
            seatNumber: null,
            mode: "append",
            value: { kind: "cardList", cardIds: imprisoned },
          },
        },
        record("mc10.s4.victory.hero-form", "heroForm", 1, { kind: "flag", value: true }),
      ],
    });

    // RRG 1.8 p. 29, as MC10 p. 12's own rules clarification spells it out: out of every deck for good.
    expect(log.removedFromCampaign).toEqual([{ cardId: MOON_KNIGHT }]);
    // The printed if/else: the prison is still in play, so no one improves anything.
    expect(log.seats[0]?.grants.find((grant) => grant.cardId === BASIC_IDS[0])?.face).toBeUndefined();
    const zola = log.history.find((entry) => entry.nodeId === "zola");
    expect(zola?.steps.find((step) => step.instructionId === "mc10.s4.victory.improved")?.skipped).toBe("condition");
  });

  it("leaves every seat's deck legal with what the campaign put in it (MC10 p. 3, p. 10, p. 17)", () => {
    const { log } = walk();
    const seat = log.seats[0];
    if (!seat) throw new Error("no seat 1");

    // A rescued Captive ally (a scenario-specific card), a TECH upgrade and a "Basic" upgrade (campaign-specific
    // cards) and four obligations (encounter cards) — none of them a legal deckbuilding choice, all of them legal
    // here because the campaign's own instructions added them.
    expect(seat.deck.cards.map((line) => line.cardId as string)).toEqual(
      expect.arrayContaining([MOON_KNIGHT, TECH_IDS[0] as string, BASIC_IDS[0] as string]),
    );
    const context: DeckContext = {
      campaign: {
        campaignId: TRORS_CAMPAIGN.id as string,
        campaignSetIds: TRORS_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: seat.identityCardId as string,
        grantedCardIds: seat.grants.map((grant) => grant.cardId as string),
        removedFromCampaign: log.removedFromCampaign,
      },
    };
    expect(validateDeck(seat.deck, WAVE2_CARDS, context)).toEqual({ ok: true });
  });
});
