/**
 * The campaign runner, played end to end headlessly (design §11 step 4).
 *
 * Everything here runs against the **synthetic** campaign in `testing/campaign.ts`: no published box, scenario or
 * card is named, because the whole point of the foundation is that the engine cannot know which campaign it is
 * running. The synthetic box is deliberately the *hard* shape — a branching graph with a finale, a hidden field
 * written by a seeded draw, a `strikeList`, per-seat grants, a `thisGame` grant and a real DEFEAT block — so that
 * the eight linear, free-retry boxes are the easy case rather than the only case.
 */

import { describe, expect, it } from "vitest";
import { cardId, flat, type CardId, type PlayModes } from "@mc/content";
import { DEFAULT_DEPS } from "../abilities.js";
import type { CampaignGameResult, CampaignLog } from "../campaign.js";
import type { GameEvent } from "../events.js";
import { createGame, type GameSetupConfig } from "../setup.js";
import type { GameState } from "../state.js";
import { runCommands } from "../testing/drive.js";
import { stubAlly, stubMainScheme } from "../testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities, VILLAIN } from "../testing/scenario.js";
import {
  SYNTHETIC_CAMPAIGN,
  SYNTHETIC_CAMPAIGN_DEPS,
  SYNTHETIC_CAMPAIGN_ID,
  syntheticCampaignInput,
} from "../testing/campaign.js";
import { campaignResultOf } from "./result.js";
import {
  applyCampaignResult,
  campaignChoiceKey,
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignPendingChoice,
  type CampaignSeatSetup,
} from "./runner.js";

const WARD = cardId("syn-ward");
const RELIC_A = cardId("syn-relic-a");
const RELIC_B = cardId("syn-relic-b");
const GIFT = cardId("syn-gift-cheap");

const STANDARD: PlayModes = { campaign: { campaignId: SYNTHETIC_CAMPAIGN_ID } };
const EXPERT_CAMPAIGN: PlayModes = { campaign: { campaignId: SYNTHETIC_CAMPAIGN_ID, expertCampaign: true } };

const SEATS: readonly CampaignSeatSetup[] = [
  {
    seatNumber: 1,
    identityCardId: cardId("syn-hero-one"),
    deck: {
      identityCardId: cardId("syn-hero-one"),
      aspects: ["leadership"],
      cards: [{ cardId: cardId("syn-player-card"), quantity: 3 }],
    },
  },
  {
    seatNumber: 2,
    identityCardId: cardId("syn-hero-two"),
    deck: {
      identityCardId: cardId("syn-hero-two"),
      aspects: ["protection"],
      cards: [{ cardId: cardId("syn-player-card"), quantity: 2 }],
    },
  },
];

const newLog = (seed = 4242, modes: PlayModes = STANDARD): CampaignLog =>
  createCampaignLog(SYNTHETIC_CAMPAIGN, { id: "syn-run", seats: SEATS, modes, poolVersion: "syn-pool-1", seed });

// --- a scripted caller ---------------------------------------------------------------------------------------
// The caller's whole job is to answer pending choices, so the test *is* a caller: it looks each pending choice up
// in a fixed script by its key. An unscripted choice fails loudly rather than being answered arbitrarily.

const answerFor = (script: readonly CampaignChoiceAnswer[], choice: CampaignPendingChoice): CampaignChoiceAnswer => {
  const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(choice));
  if (!found)
    throw new Error(`the script has no answer for ${campaignChoiceKey(choice)} of [${choice.options.join(", ")}]`);
  return found;
};

interface Settled {
  readonly log: CampaignLog;
  readonly asked: readonly CampaignPendingChoice[];
  readonly answers: readonly CampaignChoiceAnswer[];
}

function settle(
  step: (answers: readonly CampaignChoiceAnswer[]) => ReturnType<typeof resolveBetweenGames>,
  script: readonly CampaignChoiceAnswer[],
): Settled {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 16; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { log: outcome.value, asked, answers };
    asked.push(outcome.choice);
    answers.push(answerFor(script, outcome.choice));
  }
  throw new Error("the runner asked for more than 16 choices in one step list");
}

const between = (log: CampaignLog, modes: PlayModes, script: readonly CampaignChoiceAnswer[]): Settled =>
  settle((answers) => resolveBetweenGames(SYNTHETIC_CAMPAIGN, log, SYNTHETIC_CAMPAIGN_DEPS, modes, answers), script);

const after = (
  log: CampaignLog,
  result: CampaignGameResult,
  script: readonly CampaignChoiceAnswer[],
  at = 1_700_000_000_000,
): Settled =>
  settle(
    (answers) =>
      applyCampaignResult(
        SYNTHETIC_CAMPAIGN,
        log,
        result,
        { at, gameId: `game-${result.nodeId}` },
        SYNTHETIC_CAMPAIGN_DEPS,
        answers,
      ),
    script,
  );

// --- the results a game would report -------------------------------------------------------------------------

const keepsakeRecords: CampaignGameResult["records"] = [
  {
    instructionId: "syn.alpha.victory.keepsakes",
    write: { field: "keepsakes", seatNumber: 1, mode: "append", value: { kind: "cardList", cardIds: [WARD] } },
  },
  {
    instructionId: "syn.alpha.victory.keepsakes",
    write: { field: "keepsakes", seatNumber: 2, mode: "append", value: { kind: "cardList", cardIds: [] } },
  },
];

const gameResult = (
  over: Partial<CampaignGameResult> & Pick<CampaignGameResult, "nodeId" | "outcome">,
): CampaignGameResult => ({
  records: [],
  removedFromCampaign: [],
  logWrites: [],
  expiringGrants: [],
  ...over,
});

const SCRIPT: readonly CampaignChoiceAnswer[] = [
  { instructionId: "campaign.nextNode", slot: "node", seatNumber: null, picked: ["alpha"] },
  { instructionId: "syn.alpha.victory.errand", slot: "relic", seatNumber: 1, picked: [RELIC_A] },
  { instructionId: "syn.alpha.victory.errand", slot: "relic", seatNumber: 2, picked: [RELIC_B] },
  { instructionId: "syn.omega.victory.end", slot: "parting-gift", seatNumber: 1, picked: [] },
  { instructionId: "syn.omega.victory.end", slot: "parting-gift", seatNumber: 2, picked: [GIFT] },
];

/** The whole campaign, won: choose the first trial, win it, take the finale, win that. */
function playWholeCampaign(seed = 4242, modes: PlayModes = STANDARD): Settled {
  const first = between(newLog(seed, modes), modes, SCRIPT);
  const afterAlpha = after(
    first.log,
    gameResult({ nodeId: "alpha", outcome: "won", records: keepsakeRecords }),
    SCRIPT,
  );
  const second = between(afterAlpha.log, modes, SCRIPT);
  const afterOmega = after(second.log, gameResult({ nodeId: "omega", outcome: "won" }), SCRIPT, 1_700_000_001_000);
  return {
    log: afterOmega.log,
    asked: [...first.asked, ...afterAlpha.asked, ...second.asked, ...afterOmega.asked],
    answers: [...first.answers, ...afterAlpha.answers, ...second.answers, ...afterOmega.answers],
  };
}

// ---------------------------------------------------------------------------------------------------------------

describe("a whole campaign, played headlessly", () => {
  it("runs a branching graph through its finale to a win", () => {
    const { log, asked } = playWholeCampaign();

    expect(log.status).toBe("won");
    expect(log.position).toEqual({
      nextNodeId: null,
      resolved: { alpha: "completed", omega: "completed" },
      progress: log.position.progress,
    });
    expect(log.history.map((entry) => [entry.nodeId, entry.outcome])).toEqual([
      ["alpha", "won"],
      ["omega", "won"],
    ]);
    // The finale was never offered as a choice: nothing else was available and its condition held (MC60 p. 9 step 4).
    expect(asked.map((choice) => `${choice.instructionId}/${choice.slot}/${choice.seatNumber ?? "-"}`)).toEqual([
      "campaign.nextNode/node/-",
      "syn.alpha.victory.errand/relic/1",
      "syn.alpha.victory.errand/relic/2",
      "syn.omega.victory.end/parting-gift/1",
      "syn.omega.victory.end/parting-gift/2",
    ]);
  });

  it("puts a granted card in the seat's own deck and remembers it as a grant", () => {
    const { log } = playWholeCampaign();
    const [one, two] = log.seats;

    expect(one?.grants).toEqual([{ cardId: RELIC_A, permanence: "campaign", grantedAtNodeId: "alpha" }]);
    expect(one?.deck.cards).toContainEqual({ cardId: RELIC_A, quantity: 1 });
    // The parting gift was granted *after* the last game ended, so it is still owed: a `thisGame` grant expires
    // at the end of the game it was added for (MC32 p. 5, "to their deck for that game"), not the moment it is made.
    expect(two?.grants).toEqual([
      { cardId: RELIC_B, permanence: "campaign", grantedAtNodeId: "alpha" },
      { cardId: GIFT, permanence: "thisGame", grantedAtNodeId: "omega" },
    ]);
    expect(two?.deck.cards).toContainEqual({ cardId: GIFT, quantity: 1 });
  });

  it("takes a `thisGame` grant back out of the deck when that game ends (MC32 p. 5)", () => {
    const seeded = newLog();
    // A grant a previous game's role-building step made; the runner's own path to one is the omega victory above.
    const withGrant: CampaignLog = {
      ...seeded,
      seats: seeded.seats.map((seat) =>
        seat.seatNumber === 1
          ? {
              ...seat,
              grants: [{ cardId: GIFT, permanence: "thisGame", grantedAtNodeId: "alpha" }],
              deck: { ...seat.deck, cards: [...seat.deck.cards, { cardId: GIFT, quantity: 1 }] },
            }
          : seat,
      ),
    };
    const played = after(
      between(withGrant, STANDARD, SCRIPT).log,
      gameResult({ nodeId: "alpha", outcome: "won", records: keepsakeRecords }),
      SCRIPT,
    );

    expect(played.log.seats[0]?.grants.map((grant) => grant.cardId)).toEqual([RELIC_A]);
    expect(played.log.seats[0]?.deck.cards.some((line) => line.cardId === GIFT)).toBe(false);
  });

  it("records every step it took, including the ones it skipped and why", () => {
    const { log } = playWholeCampaign();
    const alpha = log.history[0];

    expect(alpha?.steps.map((step) => [step.instructionId, step.skipped ?? "ran"])).toEqual([
      ["syn.before.saboteur", "ran"],
      ["syn.before.progress", "ran"],
      ["syn.every.ward", "condition"],
      ["syn.alpha.setup.threat", "ran"],
      // Standard mode, so the printed `Expert Campaign Only` line did not resolve (MC10 p. 3).
      ["syn.alpha.setup.stamina", "modes"],
      ["syn.alpha.victory.keepsakes", "ran"],
      ["syn.alpha.victory.errand", "ran"],
      ["syn.alpha.victory.stamina", "modes"],
    ]);
    expect(alpha?.steps.find((step) => step.instructionId === "syn.alpha.victory.errand")?.choices).toEqual([
      { slot: "relic", seatNumber: 1, picked: [RELIC_A] },
      { slot: "relic", seatNumber: 2, picked: [RELIC_B] },
    ]);
  });
});

describe("the boundary the runner hands a game", () => {
  it("composes the game input, and keeps a hidden field out of it (MC50 p. 5)", () => {
    const { log } = between(newLog(), STANDARD, SCRIPT);
    const start = startGameFromLog(SYNTHETIC_CAMPAIGN, log);

    expect(start.nodeId).toBe("alpha");
    expect(start.scenarioId).toBe("syn-scenario-one");
    expect(start.input.instructions.map((instruction) => instruction.instructionId)).toEqual([
      "syn.alpha.setup.threat",
    ]);
    expect(start.input.seats.map((seat) => seat.seatNumber)).toEqual([1, 2]);
    expect(log.hidden.saboteur).toBeDefined();
    expect(start.input.log.shared.saboteur).toBeUndefined();
  });

  it("composes a villain and its sets for a node whose scenario is chosen between games (MC60 p. 9)", () => {
    const first = between(newLog(), STANDARD, SCRIPT);
    const afterAlpha = after(
      first.log,
      gameResult({ nodeId: "alpha", outcome: "won", records: keepsakeRecords }),
      SCRIPT,
    );
    const start = startGameFromLog(SYNTHETIC_CAMPAIGN, between(afterAlpha.log, STANDARD, SCRIPT).log);

    expect(start.nodeId).toBe("omega");
    expect(start.scenarioId).toBeNull();
    expect(start.villain).not.toBeNull();
    expect(start.encounterSetIds).toEqual(["syn-campaign-set"]);
    // The ward recorded in the log made the campaign-wide setup instruction apply this time round.
    expect(start.input.instructions.map((instruction) => instruction.window)).toEqual([
      "afterScenarioSetup",
      "beforePlayerSetup",
    ]);
  });
});

describe("losing, and retrying", () => {
  const loseAlpha = (result: CampaignGameResult): Settled => {
    const first = between(newLog(), STANDARD, SCRIPT);
    return after(first.log, result, SCRIPT);
  };

  it("rolls the log back to where the node began and replays that node", () => {
    const before = between(newLog(), STANDARD, SCRIPT).log;
    const lost = loseAlpha(gameResult({ nodeId: "alpha", outcome: "lost" })).log;
    const baseline = before.attempt?.logBefore;

    expect(lost.status).toBe("active");
    expect(lost.position.nextNodeId).toBe("alpha");
    expect(lost.history).toHaveLength(1);
    expect(lost.history[0]?.outcome).toBe("lost");
    // Everything the between-games block did is undone, down to the campaign RNG (design Q6).
    expect(lost.rng).toEqual(baseline?.rng);
    expect(lost.hidden).toEqual({});
    // …except the DEFEAT instruction's own writes, which are the penalty for losing (MC60 p. 13).
    expect(lost.position.progress).toEqual({ alpha: 1 });
  });

  it("keeps a card the lost game removed from the campaign, and keeps it out of the retry's choices (RRG 1.8 p. 29)", () => {
    const lost = loseAlpha(
      gameResult({ nodeId: "alpha", outcome: "lost", removedFromCampaign: [{ cardId: RELIC_B }] }),
    ).log;
    expect(lost.removedFromCampaign).toEqual([{ cardId: RELIC_B }]);

    const retry = between(lost, STANDARD, SCRIPT);
    const asked = settle(
      (answers) =>
        applyCampaignResult(
          SYNTHETIC_CAMPAIGN,
          retry.log,
          gameResult({ nodeId: "alpha", outcome: "won", records: keepsakeRecords }),
          { at: 1, gameId: null },
          SYNTHETIC_CAMPAIGN_DEPS,
          answers,
        ),
      [SCRIPT[1] as CampaignChoiceAnswer, { ...(SCRIPT[2] as CampaignChoiceAnswer), picked: [RELIC_A] }],
    );
    expect(asked.asked[0]?.options).toEqual([RELIC_A]);
    expect(asked.log.removedFromCampaign).toEqual([{ cardId: RELIC_B }]);
  });

  it("keeps an in-game log write made in a lost game (design §6.2)", () => {
    const lost = loseAlpha(
      gameResult({
        nodeId: "alpha",
        outcome: "lost",
        logWrites: [
          { field: "keepsakes", seatNumber: 1, mode: "append", value: { kind: "cardList", cardIds: [WARD] } },
        ],
      }),
    ).log;
    expect(lost.seats[0]?.fields.keepsakes).toEqual({ kind: "cardList", cardIds: [WARD] });
  });

  it("loses the campaign outright when a DEFEAT instruction says so (the MC45 p. 20 / MC60 p. 13 shape)", () => {
    const first = between(newLog(4242, EXPERT_CAMPAIGN), EXPERT_CAMPAIGN, SCRIPT);
    const wonAlpha = after(
      first.log,
      gameResult({ nodeId: "alpha", outcome: "won", records: keepsakeRecords }),
      SCRIPT,
    );
    const second = between(wonAlpha.log, EXPERT_CAMPAIGN, SCRIPT);
    const lostOmega = after(second.log, gameResult({ nodeId: "omega", outcome: "lost" }), SCRIPT);

    expect(lostOmega.log.status).toBe("lost");
    expect(lostOmega.log.position.nextNodeId).toBeNull();
    expect(lostOmega.log.attempt).toBeUndefined();
  });
});

describe("determinism", () => {
  it("gives an identical log for the same seed and the same answers", () => {
    expect(playWholeCampaign().log).toEqual(playWholeCampaign().log);
  });

  it("gives a different seeded draw for a different seed", () => {
    const drawn = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
        const log = between(newLog(seed), STANDARD, SCRIPT).log;
        const value = log.hidden.saboteur;
        return value?.kind === "choice" ? value.option : "";
      }),
    );
    expect(drawn.size).toBe(2);
  });

  it("survives a JSON round trip mid-campaign and reaches the same end state", () => {
    const first = between(newLog(), STANDARD, SCRIPT);
    const afterAlpha = after(
      first.log,
      gameResult({ nodeId: "alpha", outcome: "won", records: keepsakeRecords }),
      SCRIPT,
    );
    const stored = JSON.parse(JSON.stringify(afterAlpha.log)) as CampaignLog;
    expect(stored).toEqual(afterAlpha.log);

    const continued = (from: CampaignLog): CampaignLog =>
      after(
        between(from, STANDARD, SCRIPT).log,
        gameResult({ nodeId: "omega", outcome: "won" }),
        SCRIPT,
        1_700_000_001_000,
      ).log;

    expect(continued(stored)).toEqual(continued(afterAlpha.log));
    expect(continued(stored).status).toBe("won");
  });
});

// --- reading a real, finished game back ------------------------------------------------------------------------

const SETUP_WARD = stubAlly({ id: "syn-ward", cost: 1, atk: 1, thw: 1, hp: 1, keywords: [{ name: "setup" }] });
const SCHEME = stubMainScheme({
  id: "syn-scheme",
  stages: [{ startingThreat: flat(2), targetThreat: flat(40), acceleration: flat(0) }],
});

/** A two-seat campaign game of the synthetic box, settled past the mulligan. */
function playCampaignGame(log: CampaignLog): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const identities = seatIdentities(HERO, 2);
  const input = syntheticCampaignInput({
    nodeId: "alpha",
    log: { shared: {}, perSeat: log.seats.map((seat) => ({ seatNumber: seat.seatNumber, fields: seat.fields })) },
    seats: log.seats.map((seat) => ({
      seatNumber: seat.seatNumber,
      identityCardId: seat.identityCardId,
      deck: [],
      aspects: [],
      grantedCardIds: [],
    })),
    removedFromCampaign: [],
  });
  const config: GameSetupConfig = {
    seed: 1234,
    cards: [...DEFAULT_CARDS, SCHEME, SETUP_WARD, ...identities],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: SCHEME.id,
    encounterDeck: [],
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, cardId("syn-ward")],
    })),
    campaign: input,
  };
  const created = createGame(config, DEFAULT_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const driven = runCommands(created.state, DEFAULT_DEPS);
  return { state: driven.state, events: [...created.events, ...driven.events] };
}

describe("campaignResultOf reads the finished game, not the client", () => {
  it("derives each record instruction's value from the final state and the event stream", () => {
    const first = between(newLog(4242, EXPERT_CAMPAIGN), EXPERT_CAMPAIGN, SCRIPT);
    const { state, events } = playCampaignGame(first.log);
    // The game is a real one; only its ending is asserted here, because how a villain dies is not this test's subject.
    const finished: GameState = { ...state, outcome: { result: "win", reason: "villainDefeated" } };

    const result = campaignResultOf(SYNTHETIC_CAMPAIGN, first.log, finished, events, DEFAULT_DEPS);

    expect(result.nodeId).toBe("alpha");
    expect(result.outcome).toBe("won");
    const keepsakes = result.records.filter((record) => record.instructionId === "syn.alpha.victory.keepsakes");
    expect(keepsakes.map((record) => record.write.seatNumber)).toEqual([1, 2]);
    // Two setup-keyword allies entered play (RRG 1.8 Appendix II step 11), and the printed sentence is "each ally
    // that entered play" with no controller clause, so each seat records both — the query says what it says.
    expect(keepsakes.map((record) => record.write.value)).toEqual([
      { kind: "cardList", cardIds: [WARD, WARD] },
      { kind: "cardList", cardIds: [WARD, WARD] },
    ]);
    // `Expert Campaign Only`, and capped at base hit points (MC10 p. 17).
    const stamina = result.records.filter((record) => record.instructionId === "syn.alpha.victory.stamina");
    expect(stamina.map((record) => record.write.value)).toEqual([
      { kind: "number", value: HERO.hp },
      { kind: "number", value: HERO.hp },
    ]);
    expect(result.logWrites).toEqual([]);
    expect(result.removedFromCampaign).toEqual([]);
  });

  it("reports a conceded game as a loss, and skips the victory records", () => {
    const first = between(newLog(), STANDARD, SCRIPT);
    const { state, events } = playCampaignGame(first.log);
    const conceded: GameState = {
      ...state,
      outcome: {
        result: "conceded",
        reason: "playerConceded",
        byPlayerId: state.players[0]?.playerId ?? state.firstPlayerId,
      },
    };

    const result = campaignResultOf(SYNTHETIC_CAMPAIGN, first.log, conceded, events, DEFAULT_DEPS);
    expect(result.outcome).toBe("lost");
    expect(result.records).toEqual([]);
  });
});

/** A card id the pool knows about, kept honest: the fixture's ids are the ones the runner's sources resolve. */
const _ids: readonly CardId[] = [WARD, RELIC_A, RELIC_B, GIFT];
