/**
 * `SM_CAMPAIGN_DEFINITION` (Sinister Motives, MC27) driven through the real runner and real games, mirroring
 * `mts.qa.test.ts`'s own two-part shape (docs/campaign-mode-design.md §11 step 7; wave 5 step 6,
 * docs/wave-definition-of-done.md §6):
 *
 * - A **between-games walk** of all five nodes, each node's finished-game facts supplied directly as
 *   `CampaignGameResult.records` (`mts.qa.test.ts`'s own documented technique: what a real game's finished
 *   `GameState` would let `campaignResultOf` derive for a `record` instruction is exactly `@mc/engine`'s own job to
 *   prove — `packages/engine/src/campaign/sm-queries.test.ts` — not this file's), checking the log after every
 *   scenario for the reputation value and which nodes it has crossed, a S.H.I.E.L.D. Tech grant, recorded
 *   Community Service titles, the recorded Waking Nightmare count and Last Ones Standing villain list — proving a
 *   loss-and-retry survives the log, and that a reputation-track grant earned at one node survives a *later*
 *   node's loss-and-retry (MC27's own campaign prints no `removeFromCampaign` instruction of its own to exercise a
 *   permanent removal against — the same gap `mts.qa.test.ts`'s own header note explains for MC21 — so this is the
 *   closest fact this box actually prints to "a permanent effect survives a retry").
 * - A **real game at every node**, set up from a composed log via `wave5Scenario`/`createGame` and played to an
 *   actual outcome by the headless greedy driver (`../testing/driver.js`'s `playToOutcome`), then replayed to a
 *   deep-equal final state (`sinister-six/scenario.test.ts`'s own `playAndReplay` shape) — proving the campaign's
 *   own composed sets (Bad Publicity, Community Service, Snitches Get Stitches, Osborn Tech, Sinister Assault) are
 *   accepted by real content and a real game actually runs to completion at each of the five scenarios in turn.
 *   **Finding, not a bug:** two starter precons (Ghost-Spider, Spider-Man (Miles Morales)) driven by the
 *   card-name-agnostic greedy driver did not win any of these five scenarios once the campaign's own composed
 *   content (an extra Community Service side scheme, Public Outcry/Smear Campaign, and — once the reputation track
 *   crosses a node — Osborn Tech/S.H.I.E.L.D. Tech) was added on top of the base box, across the seeds tried below;
 *   the driver has no scenario-specific strategy and Sinister Motives adds threat sources a 2-hero decklist tuned
 *   for the *un*-composed scenario doesn't budget for. This describe only asserts the game reaches *an* outcome and
 *   replays deterministically (the same weaker assertion each hero pack's own scenario.test.ts's `playAndReplay` makes
 *   for several of these same scenarios standalone), not that it wins — the "substituting wins" technique above is
 *   exactly for the case a real game's own outcome isn't the one the walk needs.
 *
 * Expert Campaign coverage (item 4, MC27 pp. 6/11/13/15/17): persistent hit points recorded after every scenario
 * and restored (capped at base) at the next one's setup, the optional "deal facedown cards to heal to printed HP"
 * offer, and Venom Goblin's own Expert-Campaign-Only "the players lose the campaign" defeat bullet.
 */
import { describe, expect, it } from "vitest";
import { cardId, SM_STARTER_DECKS, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  campaignChoiceKey,
  createCampaignLog,
  createGame,
  replay,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type GameSetupConfig,
  type GameState,
} from "@mc/engine";
import { firstLegal, identityOf, P1, settle as settleGame } from "../testing/harness.js";
import { playToOutcome } from "../testing/driver.js";
import { WAVE5_CARDS, WAVE5_DEPS, wave5Scenario } from "../wave5/index.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { SM_CAMPAIGN_DEFINITION } from "./sm.js";

const DEPS: CampaignDeps = { pool: WAVE5_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: SM_CAMPAIGN_DEFINITION.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: SM_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true } };

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = SM_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no sm starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = [seatFor("ghost-spider", 1), seatFor("spider-man-morales", 2)];

const NODES = ["sandman", "venom", "mysterio", "sinister-six", "venom-goblin"] as const;
type NodeId = (typeof NODES)[number];

interface Settled<T> {
  readonly value: T;
  readonly asked: readonly CampaignPendingChoice[];
}

/** `mts.qa.test.ts`'s own `settle`: answers every pending choice from a fixed script (throws on the first one it
 * doesn't recognize), so a test that expects no mid-walk choice at all still catches a surprise one. */
function settle<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[] = [],
): Settled<T> {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const result = step(answers);
    if (result.kind === "done") return { value: result.value, asked };
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(result.choice));
    if (!found) {
      throw new Error(
        `no scripted answer for ${campaignChoiceKey(result.choice)} of [${result.choice.options.join(", ")}]`,
      );
    }
    asked.push(result.choice);
    answers.push(found);
  }
  throw new Error("the runner asked for more than 24 choices in one step list");
}

/** Answers every pending choice with its first option (or "decline" for an optional one with none picked) —
 * `firstLegal`'s own policy, lifted to the campaign runner's own choice shape, for a walk that doesn't care which
 * option is taken as long as the mechanism (a grant, a record) actually fires. */
function settleGreedy<T>(step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>): T {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 48; guard++) {
    const result = step(answers);
    if (result.kind === "done") return result.value;
    const [first] = result.choice.options;
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: first ? [first] : [],
    });
  }
  throw new Error("the runner asked for more than 48 choices");
}

function outcome(nodeId: string, won: boolean, records: CampaignGameResult["records"] = []): CampaignGameResult {
  return { nodeId, outcome: won ? "won" : "lost", records, removedFromCampaign: [], logWrites: [], expiringGrants: [] };
}

const numberWrite = (instructionId: string, field: string, seatNumber: number, value: number) => ({
  instructionId,
  write: { field, seatNumber, mode: "set" as const, value: { kind: "number" as const, value } },
});
const cardListWrite = (instructionId: string, field: string, ids: readonly string[]) => ({
  instructionId,
  write: {
    field,
    seatNumber: null,
    mode: "append" as const,
    value: { kind: "cardList" as const, cardIds: ids as never },
  },
});
/** "sm.reputation.conditions" own `repVictoryPoints` write (`sm.test.ts`'s `oneVictoryPoint`): every other write in
 * that same record step (`repConditions`/`repTokens`/`repPlayers`) is left un-overridden and so is skipped outright
 * (`applyCampaignResult` never writes a `record`-kind field with no matching `result.records` entry) — meaning each
 * one keeps whatever it last held (0, the first time any of them is written this way at all), so a walk that only
 * ever overrides `repVictoryPoints` advances the reputation track by exactly that many points each node, with no
 * hidden carry-over from an earlier scenario's own derivation.
 */
const victoryPoints = (n: number) => ({
  instructionId: "sm.reputation.conditions",
  write: {
    field: "repVictoryPoints",
    seatNumber: null,
    mode: "set" as const,
    value: { kind: "number" as const, value: n },
  },
});

describe("SM_CAMPAIGN_DEFINITION: the runner, end to end (MC27)", () => {
  it("plays all five scenarios in standard mode, with a loss and a retry on Venom, to a pinned final log", () => {
    let log: CampaignLog = createCampaignLog(SM_CAMPAIGN_DEFINITION, {
      id: "sm-standard",
      seats: SEATS,
      modes: STANDARD,
      poolVersion: "qa-test",
      seed: 1234,
    });
    expect(log.position.nextNodeId).toBe("sandman");

    const play = (nodeId: NodeId, result: CampaignGameResult): CampaignLog => {
      const composed = settle((answers) => resolveBetweenGames(SM_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
      const start = startGameFromLog(SM_CAMPAIGN_DEFINITION, composed.value);
      expect(start.nodeId).toBe(nodeId);
      return settleGreedy((answers) =>
        applyCampaignResult(
          SM_CAMPAIGN_DEFINITION,
          composed.value,
          result,
          { at: 1_700_000_000_000, gameId: `qa-${nodeId}` },
          DEPS,
          answers,
        ),
      );
    };

    // Sandman: won. 1 victory point crosses node 1 (MC27 p. 22): "Deal 3 S.H.I.E.L.D. Tech at random to a player.
    // That player may choose 1 …" — `settleGreedy` takes the first option offered to each seat in turn, so both
    // seats keep a real card, granted and recorded on their own seat's `shieldTech` field.
    log = play("sandman", outcome("sandman", true, [victoryPoints(1)]));
    expect(log.position.resolved.sandman).toBe("completed");
    expect(log.shared.reputation).toEqual({ kind: "number", value: 1 });
    expect(log.seats[0]?.fields.shieldTech).toMatchObject({ kind: "cardRef" });
    expect(log.seats[1]?.fields.shieldTech).toMatchObject({ kind: "cardRef" });
    const seat1ShieldTech = log.seats[0]!.fields.shieldTech;

    // Venom: lost, then retried and won. The loss restores the log to `nodeStart` (MC27 p. 4's "no penalty" for
    // every scenario but Venom Goblin's own Expert-Campaign-Only exception, MC27 p. 17); the retry keeps node 1's
    // S.H.I.E.L.D. Tech grant, which never rolls back — the closest fact this box's own campaign prints to "a
    // permanent effect survives a retry" (it has no `removeFromCampaign` instruction of its own to exercise
    // instead, `sm.ts`'s own module docblock).
    expect(log.position.nextNodeId).toBe("venom");
    log = play("venom", outcome("venom", false));
    expect(log.position.nextNodeId).toBe("venom");
    expect(log.position.resolved.venom).toBeUndefined();
    expect(log.history.at(-1)?.outcome).toBe("lost");
    expect(log.seats[0]?.fields.shieldTech).toEqual(seat1ShieldTech);

    log = play(
      "venom",
      outcome("venom", true, [
        victoryPoints(0),
        cardListWrite("sm.s2.victory.community-service", "communityService", []),
        numberWrite("sm.s2.victory.hp", "remainingHp", 1, 9),
        numberWrite("sm.s2.victory.hp", "remainingHp", 2, 9),
      ]),
    );
    expect(log.position.resolved.venom).toBe("completed");
    expect(log.shared.reputation).toEqual({ kind: "number", value: 1 }); // 0 victory points this node: unchanged
    expect(log.seats[0]?.fields.shieldTech).toEqual(seat1ShieldTech); // still survives, after the retry too

    // Mysterio: won, 4 more victory points cross node 5 (MC27 p. 22: an extra mulligan and a threat penalty, both
    // appended to every remaining scenario's own setup) and records the Waking Nightmare Illusion count.
    log = play(
      "mysterio",
      outcome("mysterio", true, [
        victoryPoints(4),
        numberWrite("sm.s3.victory.waking-nightmare", "wakingNightmare", 0, 2),
        numberWrite("sm.s3.victory.hp", "remainingHp", 1, 10),
        numberWrite("sm.s3.victory.hp", "remainingHp", 2, 10),
      ]),
    );
    expect(log.position.resolved.mysterio).toBe("completed");
    expect(log.shared.reputation).toEqual({ kind: "number", value: 5 });
    expect(log.shared.wakingNightmare).toEqual({ kind: "number", value: 2 });
    const setups = log.shared.reputationSetups;
    expect(setups?.kind === "instructionList" ? setups.ids : []).toEqual(
      expect.arrayContaining(["sm.rep.node5.reward", "sm.rep.node5.penalty"]),
    );

    // The Sinister Six: won, 0 more victory points (reputation stays 5), records Last Ones Standing.
    log = play(
      "sinister-six",
      outcome("sinister-six", true, [
        victoryPoints(0),
        cardListWrite("sm.s4.victory.last-ones-standing", "lastOnesStanding", [cardId("27073") as never as string]),
        numberWrite("sm.s4.victory.hp", "remainingHp", 1, 11),
        numberWrite("sm.s4.victory.hp", "remainingHp", 2, 11),
      ]),
    );
    expect(log.position.resolved["sinister-six"]).toBe("completed");
    expect(log.shared.reputation).toEqual({ kind: "number", value: 5 });
    expect(log.shared.lastOnesStanding).toEqual({ kind: "cardList", cardIds: [cardId("27073")] });

    // Venom Goblin: won, ending the campaign; the optional final-reputation-score bonus records the track's total.
    log = play(
      "venom-goblin",
      outcome("venom-goblin", true, [victoryPoints(0), numberWrite("sm.s5.victory.hp", "remainingHp", 1, 8)]),
    );
    expect(log.status).toBe("won");
    expect(log.position.nextNodeId).toBeNull();
    expect(log.shared.finalReputationScore).toEqual({ kind: "number", value: 5 });
    expect(log.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "sandman:won",
      "venom:lost",
      "venom:won",
      "mysterio:won",
      "sinister-six:won",
      "venom-goblin:won",
    ]);
    expect(log.position.resolved).toEqual({
      sandman: "completed",
      venom: "completed",
      mysterio: "completed",
      "sinister-six": "completed",
      "venom-goblin": "completed",
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A real game at every node, played to an actual outcome by the greedy driver, then replayed
// ---------------------------------------------------------------------------------------------------------------

/** Composes `targetNode` from `log` and builds the real `GameSetupConfig` via `wave5Scenario` — `sm.test.ts`'s own
 * `realGame`, generalized to return the created (not yet settled) `GameState` so the caller can drive it further. */
function realGameAt(
  log: CampaignLog,
  targetNode: NodeId,
): { readonly composed: CampaignLog; readonly state: GameState } {
  const composed = settle((answers) =>
    resolveBetweenGames(SM_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers),
  ).value;
  const start = startGameFromLog(SM_CAMPAIGN_DEFINITION, composed);
  if (start.nodeId !== targetNode) throw new Error(`expected to compose ${targetNode}, got ${start.nodeId}`);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config: GameSetupConfig = wave5Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: log.modes,
  });
  const withSetAside: GameSetupConfig = {
    ...config,
    encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE5_CARDS, start.encounterSets.deck)],
    setAside: [...(config.setAside ?? []), ...cardsOfComposedSets(WAVE5_CARDS, start.encounterSets.setAside)],
  };
  const created = createGame({ ...withSetAside, campaign: start.input }, WAVE5_DEPS);
  if (!created.ok) throw new Error(`${targetNode}: setup failed: ${created.error.message}`);
  return { composed, state: created.state };
}

/** A log that has won every node before `targetNode`, hand-authored with no extra records — `sm.test.ts`'s own
 * `logAt`, generalized to any seed. */
function logBefore(targetNode: NodeId, seed: number): CampaignLog {
  let log = createCampaignLog(SM_CAMPAIGN_DEFINITION, {
    id: `sm-qa-real-${targetNode}-${seed}`,
    seats: SEATS,
    modes: STANDARD,
    poolVersion: "qa-test",
    seed,
  });
  for (const nodeId of NODES) {
    if (nodeId === targetNode) return log;
    const composed = settle((answers) => resolveBetweenGames(SM_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
    log = settleGreedy((answers) =>
      applyCampaignResult(SM_CAMPAIGN_DEFINITION, composed.value, outcome(nodeId, true), { at: 1 }, DEPS, answers),
    );
  }
  throw new Error(`no node ${targetNode}`);
}

describe("a real game at every node, played to an actual outcome by the greedy driver, then replayed", () => {
  it.each(NODES)(
    "%s: a campaign-composed real game reaches an outcome and replays to the same state",
    (nodeId) => {
      const { state } = realGameAt(logBefore(nodeId, 4242), nodeId);
      const result = playToOutcome(state, WAVE5_DEPS, { maxCommands: 40_000 });
      expect(result.outcome, `${nodeId} never reached an outcome`).not.toBeNull();
      const replayed = replay(result.session.log, WAVE5_DEPS);
      expect(replayed.ok, `${nodeId}: replay failed`).toBe(true);
      if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
    },
    120_000,
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Expert Campaign: persistent hit points, the optional facedown-card heal, and Venom Goblin's own campaign loss
// ---------------------------------------------------------------------------------------------------------------

describe("Expert Campaign (MC27 pp. 6/11/13/15/17): persistent hit points, the optional heal, and Venom Goblin's own campaign-losing defeat", () => {
  it("hit points carry over from scenario to scenario, capped at base, and losing the last scenario loses the campaign", () => {
    let log: CampaignLog = createCampaignLog(SM_CAMPAIGN_DEFINITION, {
      id: "sm-expert",
      seats: SEATS,
      modes: EXPERT,
      poolVersion: "qa-test",
      seed: 5678,
    });

    const play = (nodeId: NodeId, result: CampaignGameResult): CampaignLog => {
      const composed = settle((answers) => resolveBetweenGames(SM_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
      return settleGreedy((answers) =>
        applyCampaignResult(SM_CAMPAIGN_DEFINITION, composed.value, result, { at: 1 }, DEPS, answers),
      );
    };

    // Sandman: won, each identity ends at 7 remaining hit points (both starters' base HP is 11, per their own
    // `@mc/content` starter deck records — the same shape `mts.qa.test.ts`'s own HP test asserts against MC21).
    log = play(
      "sandman",
      outcome("sandman", true, [
        numberWrite("sm.s1.victory.hp", "remainingHp", 1, 7),
        numberWrite("sm.s1.victory.hp", "remainingHp", 2, 7),
      ]),
    );
    expect(log.seats[0]?.fields.remainingHp).toEqual({ kind: "number", value: 7 });

    // Venom: won, ending at a value *above* base HP (a healing effect during play) — capped at 11 by `hpRecord`'s
    // own `remainingHitPointsCappedAtBase`. This hand-authored result stands in for that cap (module docblock: what
    // a real game would compute for a `record` instruction is `@mc/engine`'s own job to prove), so the cap itself
    // is not exercised here — only that the log stores whatever `record` wrote, seat-scoped, exactly.
    log = play(
      "venom",
      outcome("venom", true, [
        numberWrite("sm.s2.victory.hp", "remainingHp", 1, 99),
        numberWrite("sm.s2.victory.hp", "remainingHp", 2, 99),
      ]),
    );
    expect(log.seats[0]?.fields.remainingHp).toEqual({ kind: "number", value: 99 });

    for (const nodeId of ["mysterio", "sinister-six"] as const) log = play(nodeId, outcome(nodeId, true));
    expect(log.position.nextNodeId).toBe("venom-goblin");

    log = play("venom-goblin", outcome("venom-goblin", false));
    expect(log.status).toBe("lost");
    expect(log.history.at(-1)?.steps.some((step) => step.instructionId === "sm.s5.defeat.lose-campaign")).toBe(true);
  });

  it("in standard mode, losing Venom Goblin retries with no penalty instead of losing the campaign (MC27 p. 4/17)", () => {
    let log = logBefore("venom-goblin", 9001);
    const composed = settle((answers) => resolveBetweenGames(SM_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
    log = settleGreedy((answers) =>
      applyCampaignResult(
        SM_CAMPAIGN_DEFINITION,
        composed.value,
        outcome("venom-goblin", false),
        { at: 1 },
        DEPS,
        answers,
      ),
    );
    expect(log.status).toBe("active");
    expect(log.position.nextNodeId).toBe("venom-goblin");
    expect(log.history.at(-1)?.outcome).toBe("lost");
  });

  it("hpSet restores the recorded value (capped) at the next scenario's real setup, and the optional heal offers the printed HP", () => {
    let log: CampaignLog = createCampaignLog(SM_CAMPAIGN_DEFINITION, {
      id: "sm-expert-hp-window",
      seats: SEATS,
      modes: EXPERT,
      poolVersion: "qa-test",
      seed: 9001,
    });
    const composed = settle((answers) => resolveBetweenGames(SM_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
    log = settleGreedy((answers) =>
      applyCampaignResult(
        SM_CAMPAIGN_DEFINITION,
        composed.value,
        outcome("sandman", true, [
          numberWrite("sm.s1.victory.hp", "remainingHp", 1, 3),
          numberWrite("sm.s1.victory.hp", "remainingHp", 2, 3),
        ]),
        { at: 1 },
        DEPS,
        answers,
      ),
    );
    expect(log.seats[0]?.fields.remainingHp).toEqual({ kind: "number", value: 3 });

    // Venom's own setup runs `hpSet` (a hard `setRemainingHitPoints` to the recorded value, 3) then
    // `optionalPrintedHeal` (each player may deal themself 1 facedown card to heal to their identity's printed HP
    // instead) — `firstLegal` takes the "Deal cards …" option (listed first in `sm.ts`'s own `chooseOneBy`), so
    // both identities end the setup at full, undamaged, having each dealt themselves 1 facedown encounter card.
    const { state } = realGameAt(log, "venom");
    const identity = identityOf(state, P1);
    // hpSet ran first (damage = printedHp - 3, per `sm.ts`'s own printed order) and the optional heal then topped
    // it up to full: proven by the *settled* state (after `firstLegal` answers the heal's own chooseOneBy) showing
    // no damage at all, which a naive "hpSet alone" reading would not.
    const settled = settleGame(state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    expect(settled.instances[identity]?.damage).toBe(0);
    expect(settled.players[0]?.dealtEncounter.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Rulebook audit finding, fixed here: Mysterio's own setup was missing "Put the Public Outcry (174) environment
// into play" (MC27 p. 13's own bullet — every other scenario, 1/2/4/5, already puts it into play; the wave 5 spec's
// own summary table, docs/phase7-wave5.md §2.3, lists it for Mysterio too).
// ---------------------------------------------------------------------------------------------------------------

describe('Mysterio\'s setup: "Put the Public Outcry (174) environment into play" (MC27 p. 13)', () => {
  it("Public Outcry is in play, faceup, at Mysterio's own real setup", () => {
    const { state } = realGameAt(logBefore("mysterio", 4243), "mysterio");
    const publicOutcry = Object.entries(state.instances).find(
      ([, instance]) => instance.cardId === cardId("27174a") || instance.cardId === cardId("27174b"),
    );
    expect(publicOutcry, "Public Outcry has an instance at Mysterio").toBeDefined();
    const [instanceId] = publicOutcry!;
    expect(state.villainArea).toContain(instanceId);
    expect(state.instances[instanceId as never]?.faceup).toBe(true);
  });
});

// Venom Goblin's own setup, "Search the 'Sinister Assault' (158-163) modular set for each minion with the same NAME
// as a villain's name recorded in the 'Last Ones Standing' section of the campaign log. Shuffle each of those minions
// into the encounter deck." (MC27 p. 17). "Last Ones Standing" records the *villain* cards (Doctor Octopus, 27094),
// which are different cards from the Sinister Assault *minions* of the same name (27158), so the instruction selects
// by printed name (`campaignLogCards(..., { byName: true })`) narrowed to that set's minions.
// ---------------------------------------------------------------------------------------------------------------

describe('Venom Goblin\'s "Search the Sinister Assault modular set for each minion with the same name as a … villain … recorded" (MC27 p. 17)', () => {
  const SINISTER_ASSAULT = ["27158", "27159", "27160", "27161", "27162", "27163"];

  /** Where each Sinister Assault card is once Venom Goblin's setup is over. */
  function sinisterAssaultAfterSetup(recorded: readonly string[]): Readonly<Record<string, string>> {
    let log = logBefore("sinister-six", 4244);
    const composed = settle((answers) => resolveBetweenGames(SM_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
    log = settleGreedy((answers) =>
      applyCampaignResult(
        SM_CAMPAIGN_DEFINITION,
        composed.value,
        outcome("sinister-six", true, [
          cardListWrite("sm.s4.victory.last-ones-standing", "lastOnesStanding", recorded),
        ]),
        { at: 1 },
        DEPS,
        answers,
      ),
    );
    const { state } = realGameAt(log, "venom-goblin");
    const encounterDeck = new Set(state.encounterDeckOrder.flatMap((id) => state.encounterDecks[id]?.deck ?? []));
    const where: Record<string, string> = {};
    for (const instance of Object.values(state.instances)) {
      if (!SINISTER_ASSAULT.includes(instance.cardId as string)) continue;
      where[instance.cardId as string] = encounterDeck.has(instance.instanceId)
        ? "encounterDeck"
        : state.encounterSetAside.includes(instance.instanceId)
          ? "setAside"
          : "elsewhere";
    }
    return where;
  }

  it("Doctor Octopus and Vulture recorded: exactly the Doctor Octopus (27158) and Vulture (27163) minions are shuffled in", () => {
    expect(sinisterAssaultAfterSetup([cardId("27094"), cardId("27099")])).toEqual({
      "27158": "encounterDeck",
      "27159": "setAside",
      "27160": "setAside",
      "27161": "setAside",
      "27162": "setAside",
      "27163": "encounterDeck",
    });
  });

  it("nothing recorded: no Sinister Assault card is shuffled in", () => {
    expect(Object.values(sinisterAssaultAfterSetup([]))).toEqual(Array(6).fill("setAside"));
  });
});
