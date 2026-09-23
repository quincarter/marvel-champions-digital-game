/**
 * The Galaxy's Most Wanted (MC16) — rules-fidelity QA scenarios (docs/campaign-mode-design.md §11 step 7's own
 * `gmw.ts`), in the style of `trors.qa.test.ts`.
 *
 * ---------------------------------------------------------------------------------------------------------------
 * WHY THIS FILE EXISTS. Until `f7ec234f` ("fix(cards): query([], ...) no longer matches nothing"), `query([],
 * {printedId})` matched *nothing* (`packages/engine/src/select.ts`'s `explainQuery` treats any `categories` array,
 * including an empty one, as an active filter that an empty list can never satisfy), so every one of `gmw.ts`'s
 * `revealChallengeSideScheme`, `headhunterLadder`, and the Kree Supremacy reveal bridge — every place that names a
 * card by printed id alone — silently selected zero cards and did nothing, while `gmw.test.ts` kept passing,
 * because it only asserts log values (`units`, `marketCards`, campaign-runner bookkeeping) and never inspects the
 * resulting `GameState`. **Every test below drives a real game (`createGame`/`startGameFromLog`, not a synthetic
 * `CampaignGameResult`) up through its own setup, and asserts on `GameState` — the encounter deck's actual
 * contents, the villain area's actual side scheme instance and its actual threat — precisely because that is the
 * layer the bug lived in and the log-only tests could not see.**
 *
 * `campaigns/gmw.test.ts` and `wave3/gmw/campaign-challenge.test.ts` already cover: the log-level campaign walk,
 * the Market's cost/balance/one-copy rules, and (in `campaign-challenge.test.ts`'s own last `describe`) scenario
 * 1's Badoon Blitz face-by-mode reveal as a real game. This file does not repeat those; it extends the same
 * real-game technique to every scenario, to the threat placed (not just "revealed at all"), to the Headhunter
 * ladder's actual encounter-deck contents at each unlock tier, and to Kree Supremacy's "(Optional)" errata.
 */
import { describe, expect, it } from "vitest";
import { GMW_STARTER_DECKS, WAVE3_CARDS, type CardId, type PlayModes } from "@mc/content";
import {
  activeEncounterDeck,
  applyCampaignResult,
  cardsInPlay,
  campaignChoiceKey,
  createCampaignLog,
  createGame,
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
import { firstLegal, settle } from "../testing/harness.js";
import { WAVE3_DEPS, wave3Scenario } from "../wave3/index.js";
import { GMW_CAMPAIGN_DEFINITION } from "./gmw.js";

const DEPS: CampaignDeps = { pool: WAVE3_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: GMW_CAMPAIGN_DEFINITION.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: GMW_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true } };
// `revealChallengeSideScheme`'s "expert face" bullet is gated on `ModePredicate.expert` (`PlayModes.expert`), an
// independent flag from the campaign's own `expertCampaign` (`docs/campaign-mode-design.md` §12 Q1;
// `wave3/gmw/campaign-challenge.test.ts`'s own comment on the same distinction) — a client sets both together for
// "play this campaign on expert", so this file's expert-face reveal tests do too.
const EXPERT_MODE_TOO: PlayModes = { ...EXPERT, expert: true };

const TWO_SEATS = ["groot-protection", "rocket-raccoon-aggression"] as const;
const ONE_SEAT = ["groot-protection"] as const;

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = GMW_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no gmw starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const seatsOf = (ids: readonly string[]): readonly CampaignSeatSetup[] => ids.map((id, i) => seatFor(id, i + 1));

// --- the same scripted-caller shape `trors.qa.test.ts`/`gmw.test.ts` both use --------------------------------

const answer = (
  instructionId: string,
  slot: string,
  seatNumber: number | null,
  picked: readonly string[],
): CampaignChoiceAnswer => ({ instructionId, slot, seatNumber, picked });

interface Settled<T> {
  readonly value: T;
  readonly asked: readonly CampaignPendingChoice[];
}

function settleCampaign<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[],
): Settled<T> {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 400; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { value: outcome.value, asked };
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) {
      throw new Error(
        `no scripted answer for ${campaignChoiceKey(outcome.choice)} of [${outcome.choice.options.join(", ")}]`,
      );
    }
    asked.push(outcome.choice);
    answers.push(found);
  }
  throw new Error("the runner asked for more than 400 choices");
}

const freshLog = (id: string, modes: PlayModes, seats: readonly CampaignSeatSetup[], seed: number): CampaignLog =>
  createCampaignLog(GMW_CAMPAIGN_DEFINITION, { id, seats, modes, poolVersion: "qa-test", seed });

const NODE_ORDER = [
  "brotherhood-of-badoon",
  "infiltrate-the-museum",
  "escape-the-museum",
  "nebula",
  "ronan-the-accuser",
] as const;
type NodeId = (typeof NODE_ORDER)[number];

const shortId: Readonly<Record<NodeId, string>> = {
  "brotherhood-of-badoon": "s1",
  "infiltrate-the-museum": "s2",
  "escape-the-museum": "s3",
  nebula: "s4",
  "ronan-the-accuser": "s5",
};

/**
 * Declines every Market slot and every "may heal" offer a node's own setup could ask, for every seat: not every
 * `record`-kind victory write needs a `records` override to run (see below), so a node with no override for its
 * own "record 1 unit for each player" *can still gain units for real* through a sibling `betweenGames`-kind bonus
 * instruction that is never gated by `result.records` at all — MC16 p. 10's Collection bonus (`mc16.s2.victory.
 * collection-bonus`) is exactly this: with no cards ever recorded into The Collection, "1[per_hero] or fewer" is
 * vacuously true, so it *unconditionally* awards 1 unit per seat the first time any node is won this way. Every
 * later node's Market/heal offers are gated on `fieldAtLeast(units, 1)`, so once that 1 unit exists, those offers
 * are genuinely asked and must be answered (declined), not just left for an empty script to (wrongly) skip.
 */
function declineMarketAndHeal(nodeId: NodeId, seatNumbers: readonly number[]): readonly CampaignChoiceAnswer[] {
  const shortNodeId = shortId[nodeId];
  const out: CampaignChoiceAnswer[] = [];
  for (let tier = 1; tier <= 7; tier++) {
    for (let copy = 0; copy < 4; copy++) {
      for (const seatNumber of seatNumbers)
        out.push(answer(`mc16.${shortNodeId}.setup.market`, `market-${tier}-${copy}`, seatNumber, []));
    }
  }
  for (const seatNumber of seatNumbers)
    out.push(answer(`mc16.${shortNodeId}.setup.heal-spend`, "heal", seatNumber, []));
  return out;
}

/**
 * Wins `nodeId` synthetically (`trors.qa.test.ts`'s own documented technique: what a real game's finished
 * `GameState` would let `campaignResultOf` derive for a `record` instruction is given directly). `headhunterMark`
 * is 1 or 0, added to the shared "Headhunter Defeated?" count exactly the way `headhunterRecordVictory`'s own
 * `record` instruction would from a real victory display (MC16 p. 8/p. 10/p. 12/p. 14) — the only field this
 * file's Headhunter-ladder tests need to control; every other `record`-kind victory write (units, HP, Power Stone)
 * is left unoverridden and simply never runs (`applyCampaignResult` skips a `record` instruction with no matching
 * entry in `result.records` outright — unlike the `betweenGames`-kind bonus instructions `declineMarketAndHeal`'s
 * own docstring explains).
 */
function winNode(
  log: CampaignLog,
  modes: PlayModes,
  nodeId: NodeId,
  headhunterMark: 0 | 1,
  seatNumbers: readonly number[],
): CampaignLog {
  const composed = settleCampaign(
    (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, modes, answers),
    declineMarketAndHeal(nodeId, seatNumbers),
  ).value;
  const result: CampaignGameResult = {
    nodeId,
    outcome: "won",
    records: [
      {
        instructionId: `mc16.${shortId[nodeId]}.victory.headhunter`,
        write: {
          field: "headhunterDefeated",
          seatNumber: null,
          mode: "add",
          value: { kind: "number", value: headhunterMark },
        },
      },
    ],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
  return settleCampaign(
    (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed, result, { at: 1 }, DEPS, answers),
    declineMarketAndHeal(nodeId, seatNumbers),
  ).value;
}

/** Walks from a fresh log up to (not including) `targetNode`, marking Headhunter Defeated exactly `marks.length`
 * times (`marks[i]` is the mark recorded at the i-th preceding node), so `targetNode`'s own setup reads whatever
 * "Headhunter Defeated?" total the caller wants to test against. */
function walkTo(
  modes: PlayModes,
  seats: readonly CampaignSeatSetup[],
  targetNode: NodeId,
  marks: readonly (0 | 1)[],
): CampaignLog {
  const targetIndex = NODE_ORDER.indexOf(targetNode);
  if (marks.length !== targetIndex) throw new Error(`walkTo(${targetNode}) needs exactly ${targetIndex} marks`);
  const seatNumbers = seats.map((seat) => seat.seatNumber);
  let log = freshLog(
    `qa-walk-${targetNode}-${modes.campaign?.expertCampaign ? "x" : "s"}-${seats.length}`,
    modes,
    seats,
    4242,
  );
  for (let i = 0; i < targetIndex; i++) log = winNode(log, modes, NODE_ORDER[i] as NodeId, marks[i] ?? 0, seatNumbers);
  return log;
}

/** Every card belonging to these (campaign-composed, set-aside) encounter sets, one instance per printed copy —
 * the client-side expansion `campaigns/gmw.test.ts`'s own `cardsOfSets` and `wave3/gmw/campaign-challenge.test.ts`'s
 * copy already establish; duplicated here (neither is exported) rather than reaching into another test file. */
function cardsOfSets(setIds: readonly string[]): CardId[] {
  const out: CardId[] = [];
  for (const setId of setIds) {
    const members = WAVE3_CARDS.filter(
      (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId),
    );
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) out.push(card.id);
  }
  return out;
}

/** Composes `targetNode` from `log` (answering `script`), creates the real game, and settles it up to the first
 * player-phase choice point — the same point `campaign-challenge.test.ts`'s own `realGameAtScenario1` stops at,
 * generalized to any node and any script. */
function realGameAt(
  log: CampaignLog,
  modes: PlayModes,
  targetNode: NodeId,
  seats: readonly CampaignSeatSetup[],
  script: readonly CampaignChoiceAnswer[] = [],
): GameState {
  const seatNumbers = seats.map((seat) => seat.seatNumber);
  const composed = settleCampaign(
    (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, modes, answers),
    [...declineMarketAndHeal(targetNode, seatNumbers), ...script],
  ).value;
  const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
  if (start.nodeId !== targetNode) throw new Error(`expected to compose ${targetNode}, got ${start.nodeId}`);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config: GameSetupConfig = wave3Scenario(start.scenarioId as string, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes,
  });
  const withSetAside: GameSetupConfig = {
    ...config,
    setAside: [...config.setAside!, ...cardsOfSets(start.encounterSets.setAside)],
  };
  const created = createGame({ ...withSetAside, campaign: start.input }, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
}

/** The revealed face is in the villain area, faceup (`wave3/gmw/campaign-challenge.test.ts`'s own `inPlay`): the
 * other face is still sitting unrevealed in `encounterSetAside`, since both are composed there. */
function revealedInstance(
  state: GameState,
  code: string,
): { readonly instanceId: string; readonly threat: number } | null {
  for (const [id, instance] of Object.entries(state.instances)) {
    if (instance.cardId === (code as CardId) && state.villainArea.includes(id as never) && instance.faceup) {
      return { instanceId: id, threat: instance.threat ?? 0 };
    }
  }
  return null;
}

/** Every card id currently in the active villain's encounter deck or discard — the ladder shuffles into the deck,
 * never through the discard, but a card that has already cycled through a reveal-and-discard by the time setup
 * finishes would still prove the shuffle-in happened, so both piles are checked together. */
function deckAndDiscardCardIds(state: GameState): readonly CardId[] {
  const piles = activeEncounterDeck(state);
  return [...piles.deck, ...piles.discard].map((id) => state.instances[id]?.cardId).filter((id): id is CardId => !!id);
}

// =================================================================================================================
// Priority 1a — every scenario's Campaign Challenge side scheme is actually revealed and placed, right face by
// mode, with the correct threat (its printed starting threat plus Hinder N[per_hero]) at 1 and 2+ players.
// =================================================================================================================

interface ChallengeCase {
  readonly node: NodeId;
  readonly citation: string;
  readonly standard: { readonly code: string; readonly startingThreat: number; readonly hinderPerPlayer: number };
  readonly expert: { readonly code: string; readonly startingThreat: number; readonly hinderPerPlayer: number };
}

// Starting threat and Hinder N[per_hero] read straight off each card's own `WAVE3_CARDS` record
// (`packages/content/src/data/gmw/cards.ts`), cross-checked against the reveal bullet's own citation below.
const CHALLENGE_CASES: readonly ChallengeCase[] = [
  {
    node: "brotherhood-of-badoon",
    citation: "MC16 p. 8",
    standard: { code: "16178a", startingThreat: 2, hinderPerPlayer: 3 },
    expert: { code: "16178b", startingThreat: 3, hinderPerPlayer: 4 },
  },
  {
    node: "infiltrate-the-museum",
    citation: "MC16 p. 10",
    standard: { code: "16179a", startingThreat: 3, hinderPerPlayer: 3 },
    expert: { code: "16179b", startingThreat: 4, hinderPerPlayer: 4 },
  },
  {
    node: "escape-the-museum",
    citation: "MC16 p. 12",
    standard: { code: "16180a", startingThreat: 4, hinderPerPlayer: 3 },
    expert: { code: "16180b", startingThreat: 5, hinderPerPlayer: 4 },
  },
  {
    node: "nebula",
    citation: "MC16 p. 14",
    standard: { code: "16181a", startingThreat: 5, hinderPerPlayer: 3 },
    expert: { code: "16181b", startingThreat: 6, hinderPerPlayer: 4 },
  },
];

describe("Priority 1 — every scenario's Campaign Challenge side scheme reveals for real, right face by mode", () => {
  for (const { node, citation, standard, expert } of CHALLENGE_CASES) {
    for (const [faceLabel, modes, face, otherFace] of [
      ["standard", STANDARD, standard, expert] as const,
      ["expert", EXPERT_MODE_TOO, expert, standard] as const,
    ]) {
      it(`${node}: ${faceLabel} mode reveals ${face.code} (not ${otherFace.code}), with threat = startingThreat + Hinder×2 players (${citation})`, () => {
        const seats = seatsOf(TWO_SEATS);
        const log = walkTo(
          modes,
          seats,
          node,
          NODE_ORDER.slice(0, NODE_ORDER.indexOf(node)).map(() => 0),
        );
        const state = realGameAt(log, modes, node, seats);
        const revealed = revealedInstance(state, face.code);
        expect(revealed, `expected ${face.code} to be in the villain area, faceup`).not.toBeNull();
        expect(revealedInstance(state, otherFace.code)).toBeNull();
        // RRG 1.8 "Hinder X" (p. 22): the side scheme's own starting threat, plus X[per_hero] — one placement.
        expect(revealed?.threat).toBe(face.startingThreat + face.hinderPerPlayer * 2);
      });
    }
  }

  it("brotherhood-of-badoon: standard Hinder scales down at 1 player, not just 2+ (MC16 p. 8)", () => {
    const seats = seatsOf(ONE_SEAT);
    const log = walkTo(STANDARD, seats, "brotherhood-of-badoon", []);
    const state = realGameAt(log, STANDARD, "brotherhood-of-badoon", seats);
    const revealed = revealedInstance(state, "16178a");
    expect(revealed).not.toBeNull();
    // 2 (startingThreat) + 3 (Hinder per_hero) * 1 player = 5, not the 2-player case's 8.
    expect(revealed?.threat).toBe(5);
  });
});

// =================================================================================================================
// Priority 1a continued — Kree Supremacy's "(Optional)" reveal (RRG 1.8 p. 67 errata) at Ronan
// =================================================================================================================

const RONAN_MARKS: readonly (0 | 1)[] = [1, 1, 1, 1]; // fully advance the ladder through Ronan's own setup below

describe('Priority 1 — Kree Supremacy\'s "(Optional)" reveal is a real group decision, not silently skipped', () => {
  it("accepted: the standard face is revealed and in play (RRG 1.8 p. 67 errata; MC16 p. 18)", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = walkTo(STANDARD, seats, "ronan-the-accuser", RONAN_MARKS);
    const state = realGameAt(log, STANDARD, "ronan-the-accuser", seats, [
      answer("mc16.s5.setup.kree-decide", "kree", null, ["accept"]),
    ]);
    expect(revealedInstance(state, "16182a")).not.toBeNull();
  });

  it("declined: neither face is ever revealed (RRG 1.8 p. 67 errata; MC16 p. 18)", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = walkTo(STANDARD, seats, "ronan-the-accuser", RONAN_MARKS);
    const state = realGameAt(log, STANDARD, "ronan-the-accuser", seats, [
      answer("mc16.s5.setup.kree-decide", "kree", null, []),
    ]);
    expect(revealedInstance(state, "16182a")).toBeNull();
    expect(revealedInstance(state, "16182b")).toBeNull();
  });

  it("accepted, expert campaign: the expert face is revealed, not the standard one", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = walkTo(EXPERT_MODE_TOO, seats, "ronan-the-accuser", RONAN_MARKS);
    const state = realGameAt(log, EXPERT_MODE_TOO, "ronan-the-accuser", seats, [
      answer("mc16.s5.setup.kree-decide", "kree", null, ["accept"]),
    ]);
    expect(revealedInstance(state, "16182b")).not.toBeNull();
    expect(revealedInstance(state, "16182a")).toBeNull();
  });
});

// =================================================================================================================
// Priority 1b — the Badoon Headhunter ladder actually shuffles the right rungs into the encounter deck, and only
// the right rungs, at the scenario where the log's mark count reaches each tier — not before (MC16 pp. 8-18).
// =================================================================================================================

describe("Priority 1 — the Badoon Headhunter ladder lands in the encounter deck at the right tier, not before", () => {
  it("brotherhood-of-badoon (tier 0): the base minion is always shuffled in; there is no rung to test (MC16 p. 8)", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = walkTo(STANDARD, seats, "brotherhood-of-badoon", []);
    const state = realGameAt(log, STANDARD, "brotherhood-of-badoon", seats);
    expect(deckAndDiscardCardIds(state)).toContain("16183");
  });

  it("infiltrate-the-museum (tier 1): 0 marks omits On the Hunt; 1 mark includes it (MC16 p. 10)", () => {
    const seats = seatsOf(TWO_SEATS);

    const zero = realGameAt(
      walkTo(STANDARD, seats, "infiltrate-the-museum", [0]),
      STANDARD,
      "infiltrate-the-museum",
      seats,
    );
    expect(deckAndDiscardCardIds(zero)).toContain("16183");
    expect(deckAndDiscardCardIds(zero)).not.toContain("16184");

    const one = realGameAt(
      walkTo(STANDARD, seats, "infiltrate-the-museum", [1]),
      STANDARD,
      "infiltrate-the-museum",
      seats,
    );
    expect(deckAndDiscardCardIds(one)).toContain("16184");
  });

  it("escape-the-museum (tiers 1-2): each rung appears only once its own mark count is reached (MC16 p. 12)", () => {
    const seats = seatsOf(TWO_SEATS);

    const zero = realGameAt(walkTo(STANDARD, seats, "escape-the-museum", [0, 0]), STANDARD, "escape-the-museum", seats);
    expect(deckAndDiscardCardIds(zero)).not.toContain("16184");
    expect(deckAndDiscardCardIds(zero)).not.toContain("16185");

    const one = realGameAt(walkTo(STANDARD, seats, "escape-the-museum", [1, 0]), STANDARD, "escape-the-museum", seats);
    expect(deckAndDiscardCardIds(one)).toContain("16184");
    expect(deckAndDiscardCardIds(one)).not.toContain("16185");

    const two = realGameAt(walkTo(STANDARD, seats, "escape-the-museum", [1, 1]), STANDARD, "escape-the-museum", seats);
    expect(deckAndDiscardCardIds(two)).toContain("16184");
    expect(deckAndDiscardCardIds(two)).toContain("16185");
  });

  it("nebula (tiers 1-3): the third rung (Headhunter's Henchman) only appears at 3 marks (MC16 p. 14)", () => {
    const seats = seatsOf(TWO_SEATS);

    const two = realGameAt(walkTo(STANDARD, seats, "nebula", [1, 1, 0]), STANDARD, "nebula", seats);
    expect(deckAndDiscardCardIds(two)).toContain("16184");
    expect(deckAndDiscardCardIds(two)).toContain("16185");
    expect(deckAndDiscardCardIds(two)).not.toContain("16186");

    const three = realGameAt(walkTo(STANDARD, seats, "nebula", [1, 1, 1]), STANDARD, "nebula", seats);
    expect(deckAndDiscardCardIds(three)).toContain("16186");
  });

  it("ronan-the-accuser (tiers 1-4): the fourth rung (Fugitive Recovery) only appears at 4 marks (MC16 p. 18)", () => {
    const seats = seatsOf(TWO_SEATS);

    const three = realGameAt(
      walkTo(STANDARD, seats, "ronan-the-accuser", [1, 1, 1, 0]),
      STANDARD,
      "ronan-the-accuser",
      seats,
      [answer("mc16.s5.setup.kree-decide", "kree", null, [])],
    );
    expect(deckAndDiscardCardIds(three)).toContain("16186");
    expect(deckAndDiscardCardIds(three)).not.toContain("16187");

    const four = realGameAt(
      walkTo(STANDARD, seats, "ronan-the-accuser", [1, 1, 1, 1]),
      STANDARD,
      "ronan-the-accuser",
      seats,
      [answer("mc16.s5.setup.kree-decide", "kree", null, [])],
    );
    expect(deckAndDiscardCardIds(four)).toContain("16187");
  });
});

// =================================================================================================================
// Priority 1c — other cards `gmw.ts` moves by printed id, outside the Challenge/Headhunter families above:
// "You Stand Accused!" (116) at Ronan, dealt only when a Power Stone controller was recorded (MC16 p. 18).
// =================================================================================================================

describe('Priority 1 — "You Stand Accused!" is dealt to the recorded Power Stone controller, and only then', () => {
  it("no recorded Power Stone controller: nothing is dealt (MC16 p. 18)", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = walkTo(STANDARD, seats, "ronan-the-accuser", RONAN_MARKS);
    const state = realGameAt(log, STANDARD, "ronan-the-accuser", seats, [
      answer("mc16.s5.setup.kree-decide", "kree", null, []),
    ]);
    expect(state.players.every((p) => p.dealtEncounter.length === 0)).toBe(true);
  });

  /**
   * Found by QA (dba21d9a), fixed by docs/phase7-wave3.md §3.50: "You Stand Accused!" (16116) has `quantityInSet: 3`,
   * and MC16 p. 18 prints "search … for **one copy** of the … treachery, then deal **that card**". A plain
   * `encounterCards` selector named all three copies, so all three were dealt. `oneCopyOf` (`CardSelector atMost`)
   * takes one, and the other two stay in the encounter deck/discard pile.
   */
  it("a recorded Power Stone controller is dealt exactly one copy of the treachery (MC16 p. 18)", () => {
    const seats = seatsOf(TWO_SEATS);
    const seatNumbers = seats.map((seat) => seat.seatNumber);
    let log = freshLog("qa-power-stone", STANDARD, seats, 4242);
    for (let i = 0; i < 4; i++) log = winNode(log, STANDARD, NODE_ORDER[i] as NodeId, 1, seatNumbers);
    // Record seat 1's identity as the Power Stone controller directly on the shared log field (`gmw.ts`'s own
    // `powerStoneControl` record, `mc16.s4.victory.power-stone`, MC16 p. 15) — the shortcut `trors.qa.test.ts`'s
    // own synthetic-record technique takes for a field this file does not otherwise need to derive from real play.
    // This must land *before* composing Ronan: `CampaignGameInput.log` (`CampaignLogView`) is a snapshot frozen at
    // compose time, not a live read of the `CampaignLog` object, so mutating `composed.shared` afterward is inert.
    const identityCardId = seats[0]!.identityCardId;
    log = { ...log, shared: { ...log.shared, powerStoneControl: { kind: "cardRef", cardId: identityCardId } } };
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      [
        ...declineMarketAndHeal("ronan-the-accuser", seatNumbers),
        answer("mc16.s5.setup.kree-decide", "kree", null, []),
      ],
    ).value;
    const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
    if (start.nodeId !== "ronan-the-accuser") throw new Error(`expected ronan, got ${start.nodeId}`);
    if (!start.scenarioId) throw new Error("ronan has no fixed scenario");
    const config: GameSetupConfig = wave3Scenario(start.scenarioId as string, {
      players: start.input.seats.map((seat) => ({
        identityCardId: seat.identityCardId,
        deck: seat.deck,
        aspects: seat.aspects,
      })),
      seed: start.input.seed,
      modes: STANDARD,
    });
    const withSetAside: GameSetupConfig = {
      ...config,
      setAside: [...config.setAside!, ...cardsOfSets(start.encounterSets.setAside)],
    };
    const created = createGame({ ...withSetAside, campaign: start.input }, WAVE3_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
    const seat1 = state.players.find((p) => p.identity.cardId === identityCardId);
    expect(seat1?.dealtEncounter.length).toBe(1);
    expect(state.instances[seat1!.dealtEncounter[0]!]?.cardId).toBe("16116");
    // The other two copies were not taken: they are still in the encounter deck or its discard pile.
    expect(deckAndDiscardCardIds(state).filter((id) => id === "16116")).toHaveLength(2);
  });

  /**
   * Found by QA (dba21d9a), fixed by docs/phase7-wave3.md §3.50: Pincer Maneuver (16112) has `quantityInSet: 2`, and
   * MC16 p. 18 prints "search … for **one copy** of the Pincer Maneuver (112) side scheme and reveal it". Both
   * copies used to be revealed, each with the full "3 minus Evasion Counters" threat. Now one is revealed and the
   * other stays in the encounter deck, where a later search or draw can still find it.
   */
  it("only one Pincer Maneuver side scheme is revealed and placed (MC16 p. 18)", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = walkTo(STANDARD, seats, "ronan-the-accuser", RONAN_MARKS);
    const state = realGameAt(log, STANDARD, "ronan-the-accuser", seats, [
      answer("mc16.s5.setup.kree-decide", "kree", null, []),
    ]);
    const pincersInPlay = cardsInPlay(state).filter((id) => state.instances[id]?.cardId === "16112");
    expect(pincersInPlay).toHaveLength(1);
    expect(deckAndDiscardCardIds(state).filter((id) => id === "16112")).toHaveLength(1);
  });
});
