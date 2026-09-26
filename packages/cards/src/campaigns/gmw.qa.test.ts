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
 *
 * ---------------------------------------------------------------------------------------------------------------
 * SECOND PASS (docs/phase7-wave3-qa.md "Checkpoint 3" step 4c): the campaign *walks* — a full standard and expert
 * campaign, the Victory units math at its own boundaries, the Market across visits, loss/retry, Expert-only
 * mechanics, and the log fields (Power Stone, evasion counters, Galactic Artifacts) that feed a later scenario's
 * setup. Everything below is grouped under "Priority 2" describes, one per numbered item in that step's brief.
 */
import { describe, expect, it } from "vitest";
import { GMW_CAMPAIGN, GMW_STARTER_DECKS, WAVE3_CARDS, type CardId, type PlayModes } from "@mc/content";
import {
  activeEncounterDeck,
  applyCampaignResult,
  applyCommand,
  cardsInPlay,
  campaignChoiceKey,
  campaignResultOf,
  createCampaignLog,
  createGame,
  getInstance,
  maxHitPoints,
  resolveBetweenGames,
  startGameFromLog,
  validateDeck,
  CAMPAIGN_ACCEPT,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type DeckContext,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { firstLegal, settle, type Picker } from "../testing/harness.js";
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
  pick: Picker = firstLegal,
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
  return settle(created.state, pick, (s) => s.step.phase === "player", WAVE3_DEPS);
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

// =================================================================================================================
// Priority 2 — the campaign walk, victory-unit boundaries, the Market across visits, loss/retry, Expert mechanics,
// and the log fields that feed a later scenario's setup. See docs/phase7-wave3-qa.md "Checkpoint 3" step 4c.
// =================================================================================================================

/** The instance of `code`, wherever it is (deck, discard, set-aside, in play) — for staging a finished game's
 * `victoryDisplay`/villain area directly, the same "build a real `GameState`, then mutate the one field the rule
 * under test reads" technique `campaign/new-primitives.test.ts`'s own `keywordValueSum`/`atMost` tests use. */
function anyInstanceOf(state: GameState, code: string): InstanceId {
  const found = Object.entries(state.instances).find(([, instance]) => instance.cardId === (code as CardId));
  if (!found) throw new Error(`no instance of ${code} in this game`);
  return found[0] as InstanceId;
}

/** The instance whose printed name is `name` — for Nebula's Ship, which this file has no `CardId` constant for. */
function instanceNamed(state: GameState, name: string): InstanceId {
  const found = Object.entries(state.instances).find(([, instance]) => {
    const card = WAVE3_CARDS.find((c) => c.id === instance.cardId);
    return card?.name === name;
  });
  if (!found) throw new Error(`no instance named "${name}" in this game`);
  return found[0] as InstanceId;
}

const logWrite = (
  field: string,
  seatNumber: number | null,
  mode: "set" | "add" | "append",
  value: unknown,
): CampaignGameResult["logWrites"][number] => ({ field, seatNumber, mode, value }) as never;

/** `winNode`'s own shape, generalized to accept extra `logWrites`/`records` a test wants folded into the win —
 * MC16's own `betweenGames`-kind bonuses (Collection, Galactic Artifacts) read log fields directly, so a boundary
 * test controls them through `CampaignGameResult.logWrites`, not through a scenario's own derived `records`. */
function winNodeWith(
  log: CampaignLog,
  modes: PlayModes,
  nodeId: NodeId,
  seatNumbers: readonly number[],
  extra: { readonly records?: CampaignGameResult["records"]; readonly logWrites?: CampaignGameResult["logWrites"] },
): CampaignLog {
  const composed = settleCampaign(
    (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, modes, answers),
    declineMarketAndHeal(nodeId, seatNumbers),
  ).value;
  const result: CampaignGameResult = {
    nodeId,
    outcome: "won",
    records: extra.records ?? [],
    removedFromCampaign: [],
    logWrites: extra.logWrites ?? [],
    expiringGrants: [],
  };
  return settleCampaign(
    (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed, result, { at: 1 }, DEPS, answers),
    declineMarketAndHeal(nodeId, seatNumbers),
  ).value;
}

/**
 * `winNode`'s own shape, but also recording specific "Unspent Units" amounts per seat — `winNode` itself only ever
 * records the Headhunter mark (its own docblock says so), which is not enough to drive the Market/heal tests below:
 * those need a real, spendable `units` balance on the log, the same way `gmw.test.ts`'s own `winS1` grants it.
 */
function winNodeUnits(
  log: CampaignLog,
  modes: PlayModes,
  nodeId: NodeId,
  unitsBySeat: Readonly<Record<number, number>>,
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
      ...Object.entries(unitsBySeat).map(([seatNumber, units]) => ({
        instructionId: `mc16.${shortId[nodeId]}.victory.units`,
        write: {
          field: "units",
          seatNumber: Number(seatNumber),
          mode: "add" as const,
          value: { kind: "number" as const, value: units },
        },
      })),
      {
        instructionId: `mc16.${shortId[nodeId]}.victory.headhunter`,
        write: {
          field: "headhunterDefeated",
          seatNumber: null,
          mode: "add" as const,
          value: { kind: "number" as const, value: headhunterMark },
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

// -----------------------------------------------------------------------------------------------------------------
// Item 1 — a full standard and a full expert campaign, a real game set up at every node
// -----------------------------------------------------------------------------------------------------------------

/**
 * Main scheme starting threat is `stage[0].startingThreat.base + perPlayer * playerCount`
 * (`packages/content/src/data/gmw/cards.ts`'s own stage 1 records for 16061a/16073a/16082a/16091a/16106a), at
 * 2 players: 4, 8, 14, 4, 4. Nothing in `gmw.ts` touches a main scheme's *starting* threat except Ronan's own
 * "Expert Campaign Only: Place an additional 1[per_hero] threat on the main scheme" (MC16 p. 18) — this describe
 * proves both numbers directly off a real, campaign-composed `GameState`, not off the card record alone.
 */
describe("MC16 p. 3/p. 4 — a full standard and a full expert campaign, real game at every node", () => {
  const seats = seatsOf(TWO_SEATS);
  const EXPECTED_THREAT: Readonly<Record<NodeId, number>> = {
    "brotherhood-of-badoon": 4,
    "infiltrate-the-museum": 8,
    "escape-the-museum": 14,
    nebula: 4,
    "ronan-the-accuser": 4,
  };

  function walkAndInspect(modes: PlayModes): Readonly<Record<NodeId, { stageIndex: number; threat: number }>> {
    const out: Record<string, { stageIndex: number; threat: number }> = {};
    let marks: (0 | 1)[] = [];
    for (const node of NODE_ORDER) {
      const log = walkTo(modes, seats, node, marks);
      const script = node === "ronan-the-accuser" ? [answer("mc16.s5.setup.kree-decide", "kree", null, [])] : [];
      const state = realGameAt(log, modes, node, seats, script);
      const villain = state.villains[0];
      if (!villain) throw new Error(`${node}: no villain in play`);
      out[node] = {
        stageIndex: villain.stageIndex,
        threat: getInstance(state, state.mainScheme.instanceId)?.threat ?? -1,
      };
      marks = [...marks, 1];
    }
    return out as Record<NodeId, { stageIndex: number; threat: number }>;
  }

  it("standard: every node's villain starts on its first stage, at the main scheme's printed starting threat", () => {
    const inspected = walkAndInspect(STANDARD);
    for (const node of NODE_ORDER) {
      expect(inspected[node].stageIndex, `${node} stageIndex`).toBe(0);
      expect(inspected[node].threat, `${node} threat`).toBe(EXPECTED_THREAT[node]);
    }
  });

  it("expert campaign (not expert mode): every node still starts on stage 0, and Ronan's threat gains the extra 1[per_hero]", () => {
    const inspected = walkAndInspect(EXPERT);
    for (const node of NODE_ORDER) expect(inspected[node].stageIndex, `${node} stageIndex`).toBe(0);
    for (const node of NODE_ORDER.slice(0, -1)) expect(inspected[node].threat).toBe(EXPECTED_THREAT[node]);
    // MC16 p. 18's own expert-campaign-only bullet: +1[per_hero] = +2 at 2 players, on top of the printed 4.
    expect(inspected["ronan-the-accuser"].threat).toBe(EXPECTED_THREAT["ronan-the-accuser"] + 2);
  }, 30_000);

  it("the campaign completes 'won' once Ronan is defeated for real, in printed scenario order", () => {
    let log = freshLog("qa-full-walk-completes", STANDARD, seats, 4242);
    for (const node of NODE_ORDER) {
      if (node !== "ronan-the-accuser") {
        log = winNode(log, STANDARD, node, 1, [1, 2]);
        continue;
      }
      // Ronan's own setup asks one extra question (`mc16.s5.setup.kree-decide`) `winNode`'s shared script doesn't
      // answer — decline it here, the same as every other Priority 1 Ronan test above.
      const composed = settleCampaign(
        (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
        [answer("mc16.s5.setup.kree-decide", "kree", null, []), ...declineMarketAndHeal(node, [1, 2])],
      ).value;
      log = applyWin(composed, node, [1, 2]);
    }
    expect(log.status).toBe("won");
    expect(log.history.map((entry) => entry.nodeId)).toEqual([...NODE_ORDER]);
  });
});

// -----------------------------------------------------------------------------------------------------------------
// Item 2 — Victory units: the base award, the 3-cap on printed Victory values, and each scenario-specific bonus,
// each proven at its own boundary
// -----------------------------------------------------------------------------------------------------------------

/** Builds a real `brotherhood-of-badoon` game, stages `mutate` onto its finished `GameState`, and folds the
 * resulting `mc16.s1.victory.units` writes into the log the same way a real win does — `campaignResultOf` then
 * `applyCampaignResult`, not a hand-authored override, so the 3-cap and each bonus are exercised for real. */
function foldedS1Units(mutate: (state: GameState) => GameState): number {
  const seats = seatsOf(TWO_SEATS);
  const seatNumbers = seats.map((s) => s.seatNumber);
  const log = freshLog("qa-s1-units-boundary", STANDARD, seats, 4242);
  const composed = settleCampaign(
    (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
    declineMarketAndHeal("brotherhood-of-badoon", seatNumbers),
  ).value;
  const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
  if (start.nodeId !== "brotherhood-of-badoon") throw new Error(`expected brotherhood-of-badoon, got ${start.nodeId}`);
  if (!start.scenarioId) throw new Error("no scenario id");
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
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
  const finished: GameState = mutate({ ...settled, outcome: { result: "win", reason: "villainDefeated" } });
  const result = campaignResultOf(GMW_CAMPAIGN_DEFINITION, composed, finished, [], WAVE3_DEPS);
  const folded = settleCampaign(
    (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed, result, { at: 1 }, DEPS, answers),
    declineMarketAndHeal("brotherhood-of-badoon", seatNumbers),
  ).value;
  const field = folded.seats[0]?.fields.units;
  if (!field || field.kind !== "number") throw new Error("seat 1's units field was not a number");
  return field.value;
}

describe('MC16 p. 8 — Scenario 1 victory units: "up to 3" caps at the boundary, not below or above it', () => {
  it("Badoon Headhunter (Victory 2) + one Challenge side scheme (Victory 1) sum to exactly 3: awarded in full", () => {
    // base 1 + victory sum 3 (capped, but not over) + no-minions-in-play bonus 1 (none staged in play) + stage-1B 1
    // (the staged game never left stage 1).
    const total = foldedS1Units((state) => ({
      ...state,
      victoryDisplay: [anyInstanceOf(state, "16183"), anyInstanceOf(state, "16178a")] as never,
    }));
    expect(total).toBe(6);
  });

  it("a 4th Victory-1 card pushes the sum to 4, but the cap still awards only 3 for it — same total as exactly 3", () => {
    const headhunter = "16183";
    const blitz = "16178a";
    const total = foldedS1Units((state) => ({
      ...state,
      // Same two printed cards as the boundary case above, the Challenge side scheme's own instance repeated once
      // more (RRG 1.8 "Victory" p. 46 counts what's physically in the display; two entries pointing at one instance
      // stands in for "two more Victory-1 cards" the same way `campaign/new-primitives.test.ts`'s own cap test does).
      victoryDisplay: [
        anyInstanceOf(state, headhunter),
        anyInstanceOf(state, blitz),
        anyInstanceOf(state, blitz),
      ] as never,
    }));
    // 1 + 3 (capped from 4) + 1 (no minions) + 1 (stage 1B) = 6 — identical to the exactly-3 case, which is the
    // proof the cap is doing something: an uncapped reading would have awarded 7 here.
    expect(total).toBe(6);
  });
});

describe('MC16 p. 8 — "1 if there are no minions in play" and "1 if the main scheme is on stage 1B", at their boundary', () => {
  it("met: no minion staged in play (the default) awards the bonus", () => {
    const total = foldedS1Units((state) => state); // empty victory display, stage 1B, nothing in play
    expect(total).toBe(1 + 0 + 1 + 1); // base + victory(0) + no-minions(true) + stage1B(true)
  });

  it("missed: a minion staged into the villain area (in play) withholds the bonus", () => {
    const total = foldedS1Units((state) => ({
      ...state,
      villainArea: [...state.villainArea, anyInstanceOf(state, "16183")],
    }));
    expect(total).toBe(1 + 0 + 0 + 1);
  });

  /**
   * Fixed from this QA pass's own finding: `gmw.ts` used to test `cardsInPlay({printedId: cardId("16061b")})`, a
   * card id no record has — Terrestrial Invasion is one card record, `16061a`, with a `stages` array, and the stage
   * in play is `GameState.mainScheme.stageIndex`. It now reads `CampaignGameQuery` `mainSchemeStageNumber`; a
   * main scheme in play is always on its B side (RRG 1.8 "Main Scheme", p. 27), so "stage 1B" is stage 1.
   */
  it("met: the main scheme is still on stage 1B (Terrestrial Invasion) awards the bonus", () => {
    const total = foldedS1Units((state) => {
      expect(state.mainScheme.cardId).toBe("16061a");
      expect(state.mainScheme.stageIndex).toBe(0);
      return state;
    });
    expect(total).toBe(1 + 0 + 1 + 1); // base + victory(0) + no-minions(true) + stage1B(true)
  });

  it("missed: the main scheme advanced to stage 2B (Protect the Planet) withholds the bonus", () => {
    const total = foldedS1Units((state) => ({ ...state, mainScheme: { ...state.mainScheme, stageIndex: 1 } }));
    expect(total).toBe(1 + 0 + 1 + 0); // base + victory(0) + no-minions(true) + stage1B(false)
  });
});

/** The `escape-the-museum`-adjacent "no threat on the main scheme" (MC16 p. 10) bonus, the same staged-real-game
 * technique as scenario 1's above, but for `infiltrate-the-museum`. */
function foldedS2NoThreatBonus(threat: number): number {
  const seats = seatsOf(TWO_SEATS);
  const seatNumbers = seats.map((s) => s.seatNumber);
  const log = walkTo(STANDARD, seats, "infiltrate-the-museum", [0]);
  const composed = settleCampaign(
    (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
    declineMarketAndHeal("infiltrate-the-museum", seatNumbers),
  ).value;
  const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
  if (!start.scenarioId) throw new Error("no scenario id");
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
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
  const mainSchemeInstance = getInstance(settled, settled.mainScheme.instanceId)!;
  const finished: GameState = {
    ...settled,
    instances: { ...settled.instances, [settled.mainScheme.instanceId]: { ...mainSchemeInstance, threat } },
    outcome: { result: "win", reason: "villainDefeated" },
  };
  const result = campaignResultOf(GMW_CAMPAIGN_DEFINITION, composed, finished, [], WAVE3_DEPS);
  const folded = settleCampaign(
    (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed, result, { at: 1 }, DEPS, answers),
    declineMarketAndHeal("infiltrate-the-museum", seatNumbers),
  ).value;
  const field = folded.seats[0]?.fields.units;
  if (!field || field.kind !== "number") throw new Error("seat 1's units field was not a number");
  return field.value;
}

describe('MC16 p. 10 — "1 if there is no threat on the main scheme", at its boundary', () => {
  // Diffed against a `threat: 1` baseline rather than an absolute total: `mc16.s2.victory.collection-bonus` is a
  // `betweenGames`-kind instruction this fold also runs, and (per this file's own header note, and `gmw.test.ts`'s
  // own docstring on the same gotcha) it silently awards its own +1 whenever `collectionCount` is unset (vacuously
  // "0 or fewer"), which is constant across both calls below and would otherwise have to be hand-derived here too.
  it("met (0 threat) vs. missed (1 threat): the only difference between the two is this one bonus", () => {
    expect(foldedS2NoThreatBonus(0) - foldedS2NoThreatBonus(1)).toBe(1);
  });
});

describe('MC16 p. 10 — "1 unit for each player if there are 1[per_hero] or fewer cards in The Collection"', () => {
  /** Controls `collectionCount` directly via `CampaignGameResult.logWrites` (`runner.ts` applies every one of these
   * unconditionally, `for (const write of result.logWrites) applyLogWrite(...)`) — the log-field-only technique this
   * bonus needs, since it is a `betweenGames`-kind instruction that reads the log, not the `GameState`. */
  function foldedCollectionBonus(count: number): number {
    const seats = seatsOf(TWO_SEATS);
    const log = winNodeWith(
      freshLog("qa-collection-bonus", STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      [1, 2],
      {},
    );
    const won = winNodeWith(log, STANDARD, "infiltrate-the-museum", [1, 2], {
      logWrites: [logWrite("collectionCount", null, "set", { kind: "number", value: count })],
    });
    const field = won.seats[0]?.fields.units;
    return field && field.kind === "number" ? field.value : 0;
  }

  it("met: exactly seatCount (2) cards in The Collection awards 1 unit to each seat", () => {
    const before = foldedCollectionBonus(0); // 0 is also "2 or fewer": baseline for "the bonus fires"
    expect(before).toBeGreaterThanOrEqual(1);
    const at2 = foldedCollectionBonus(2);
    expect(at2).toBe(before); // 2 is still "seatCount (2) or fewer" — same bonus fires
  });

  it("missed: seatCount + 1 (3) cards in The Collection withholds the bonus", () => {
    const at2 = foldedCollectionBonus(2);
    const at3 = foldedCollectionBonus(3);
    expect(at3).toBe(at2 - 1); // the only difference between the two calls is this bonus
  });
});

describe('MC16 p. 12 — "for every 2 Galactic Artifacts side schemes in the victory display, record 1 unit"', () => {
  function foldedArtifactBonus(count: number): number {
    const seats = seatsOf(TWO_SEATS);
    let log = winNodeWith(
      freshLog(`qa-artifact-bonus-${count}`, STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      [1, 2],
      {},
    );
    log = winNodeWith(log, STANDARD, "infiltrate-the-museum", [1, 2], {});
    const artifactIds = ["16127", "16128", "16129", "16130"].slice(0, count) as CardId[];
    log = winNodeWith(log, STANDARD, "escape-the-museum", [1, 2], {
      logWrites: [logWrite("galacticArtifacts", null, "set", { kind: "cardList", cardIds: artifactIds })],
    });
    const field = log.seats[0]?.fields.units;
    return field && field.kind === "number" ? field.value : 0;
  }

  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
  ])("%i artifacts in the victory display awards %i units per seat (floor of count / 2)", (count, expected) => {
    // Isolate this instruction's own contribution: subtract the 0-artifact baseline (base units + capped victory
    // sum, both 0 here since nothing was staged into any victory display) from each case.
    expect(foldedArtifactBonus(count) - foldedArtifactBonus(0)).toBe(expected);
  });
});

// -----------------------------------------------------------------------------------------------------------------
// Item 3 — the Market: several purchases in one visit, one copy per campaign across seats *and* across visits,
// legality/deck-size exemption in every later game, and units carried between visits
// -----------------------------------------------------------------------------------------------------------------

const MARKET_TIER: Readonly<Record<number, readonly string[]>> = {
  1: ["16150", "16151", "16152", "16153"],
  2: ["16154", "16155", "16156", "16157"],
  3: ["16158", "16159", "16160", "16161"],
};

/** Applies a "won, no extra records" result onto an already-`resolveBetweenGames`-composed log — the second half
 * of `winNode`/`winNodeUnits`, split out so a test can shop at a visit (which itself composes the log) and then
 * finish that node without recomposing from scratch (`resolveBetweenGames` throws if `log.attempt` is already set,
 * "already has a game in progress" — the mistake this file's first draft made here). */
function applyWin(
  composed: CampaignLog,
  nodeId: NodeId,
  seatNumbers: readonly number[],
  extraRecords: CampaignGameResult["records"] = [],
): CampaignLog {
  const result: CampaignGameResult = {
    nodeId,
    outcome: "won",
    records: [
      ...extraRecords,
      {
        instructionId: `mc16.${shortId[nodeId]}.victory.headhunter`,
        write: { field: "headhunterDefeated", seatNumber: null, mode: "add", value: { kind: "number", value: 1 } },
      },
    ],
    removedFromCampaign: [],
    // Suppresses `mc16.s2.victory.collection-bonus`'s own vacuous +1 (this file's header note, and `gmw.test.ts`'s
    // own docstring on the same gotcha: an unset `collectionCount` reads as "0 or fewer", awarding the bonus for
    // real even though this helper never staged The Collection at all) — irrelevant to every test using `applyWin`
    // except the ones that count exact units, which this keeps honest.
    logWrites: [logWrite("collectionCount", null, "set", { kind: "number", value: 99 })],
    expiringGrants: [],
  };
  return settleCampaign(
    (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed, result, { at: 1 }, DEPS, answers),
    declineMarketAndHeal(nodeId, seatNumbers),
  ).value;
}

describe("MC16 p. 5 — the Market: several purchases in one visit, one copy across visits, and carried units", () => {
  it("one seat can buy two different cards, at two different tiers, in the same visit", () => {
    const seats = seatsOf(TWO_SEATS);
    // 5 units: a tier-3 and a tier-2 card in the same visit costs exactly 5, leaving 0.
    const log = winNodeUnits(
      freshLog("qa-market-multi", STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      { 1: 5 },
      1,
      [1, 2],
    );
    const tier3 = MARKET_TIER[3]![0]!;
    const tier2 = MARKET_TIER[2]![0]!;
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      [
        answer("mc16.s2.setup.market", "market-3-0", 1, [tier3]),
        answer("mc16.s2.setup.market", "market-2-0", 1, [tier2]),
        ...declineMarketAndHeal("infiltrate-the-museum", [1, 2]).filter(
          (a) => !(a.slot === "market-3-0" && a.seatNumber === 1) && !(a.slot === "market-2-0" && a.seatNumber === 1),
        ),
      ],
    ).value;
    expect(composed.seats[0]?.fields.units).toEqual({ kind: "number", value: 0 });
    // `marketShoppingSetup` offers tiers cheapest-first (`gmw.ts`'s own `for (let tier = 1; tier <= 7; tier++)`),
    // so the tier-2 purchase is recorded before the tier-3 one regardless of the order this script names them in.
    expect(composed.seats[0]?.fields.marketCards).toEqual({ kind: "cardList", cardIds: [tier2, tier3] });
    expect(composed.seats[0]?.grants.map((g) => g.cardId).sort()).toEqual([tier2, tier3].sort());
  });

  it("a card bought by one seat at one visit stays unavailable to the other seat at a *later* visit (not just the same one)", () => {
    const seats = seatsOf(TWO_SEATS);
    const tier1 = MARKET_TIER[1]![0]!;
    // Seat 2 also gets a unit, so its own tier-1 slot is genuinely offered at scenario 3 — the point under test is
    // that the *option list* excludes the taken card, not merely that an underfunded seat is never asked at all.
    const log = winNodeUnits(
      freshLog("qa-market-across-visits", STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      { 1: 1, 2: 1 },
      1,
      [1, 2],
    );
    const composedS2 = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      [
        answer("mc16.s2.setup.market", "market-1-0", 1, [tier1]),
        ...declineMarketAndHeal("infiltrate-the-museum", [1, 2]).filter(
          (a) => !(a.slot === "market-1-0" && a.seatNumber === 1),
        ),
      ],
    ).value;
    const afterS2 = applyWin(composedS2, "infiltrate-the-museum", [1, 2]);

    // At scenario 3's own visit, seat 2 (which never bought anything) still cannot even name the same physical card.
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterS2, DEPS, STANDARD, answers),
      declineMarketAndHeal("escape-the-museum", [1, 2]),
    );
    const seat2FirstSlot = composed.asked.find(
      (c) => c.instructionId === "mc16.s3.setup.market" && c.slot === "market-1-0" && c.seatNumber === 2,
    );
    expect(seat2FirstSlot?.options.includes(tier1)).toBe(false);
  });

  it("units not spent at one visit carry forward, decremented only by what was actually bought", () => {
    const seats = seatsOf(TWO_SEATS);
    // 5 units recorded at scenario 1; spend 2 at scenario 2's visit; 3 should remain for scenario 3's own visit.
    const log = winNodeUnits(
      freshLog("qa-market-carry", STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      { 1: 5 },
      1,
      [1, 2],
    );
    const tier2 = MARKET_TIER[2]![0]!;
    const composedS2Market = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      [
        answer("mc16.s2.setup.market", "market-2-0", 1, [tier2]),
        ...declineMarketAndHeal("infiltrate-the-museum", [1, 2]).filter(
          (a) => !(a.slot === "market-2-0" && a.seatNumber === 1),
        ),
      ],
    ).value;
    expect(composedS2Market.seats[0]?.fields.units).toEqual({ kind: "number", value: 3 });
    // Scenario 2's own victory adds no more units in this synthetic `applyWin` (only the headhunter mark is
    // recorded); the 3 carried units are exactly what scenario 3's own market visit should still offer against.
    const afterS2 = applyWin(composedS2Market, "infiltrate-the-museum", [1, 2]);
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterS2, DEPS, STANDARD, answers),
      declineMarketAndHeal("escape-the-museum", [1, 2]),
    );
    const seat1Tiers = new Set(
      composed.asked
        .filter((c) => c.instructionId === "mc16.s3.setup.market" && c.seatNumber === 1)
        .map((c) => Number(c.slot.split("-")[1])),
    );
    expect([...seat1Tiers].sort()).toEqual([1, 2, 3]); // affordable up to and including tier 3, not tier 4+
  });

  it("a card bought at scenario 2 is still legal, and still deck-size-exempt, in a real game two scenarios later", () => {
    const seats = seatsOf(TWO_SEATS);
    const tier1 = MARKET_TIER[1]![0]!;
    const log = winNodeUnits(
      freshLog("qa-market-legal-later", STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      { 1: 1 },
      1,
      [1, 2],
    );
    const composedS2 = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      [
        answer("mc16.s2.setup.market", "market-1-0", 1, [tier1]),
        ...declineMarketAndHeal("infiltrate-the-museum", [1, 2]).filter(
          (a) => !(a.slot === "market-1-0" && a.seatNumber === 1),
        ),
      ],
    ).value;
    const afterS2 = applyWin(composedS2, "infiltrate-the-museum", [1, 2]);
    const afterS3 = applyWin(
      settleCampaign(
        (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterS2, DEPS, STANDARD, answers),
        declineMarketAndHeal("escape-the-museum", [1, 2]),
      ).value,
      "escape-the-museum",
      [1, 2],
    );

    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterS3, DEPS, STANDARD, answers),
      declineMarketAndHeal("nebula", [1, 2]),
    ).value;
    const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
    expect(start.nodeId).toBe("nebula");
    // `CampaignGameInput.seats[].deck` (`start.input`) is the flat, expanded card-id list `wave3Scenario`/`createGame`
    // read to actually set up a game — the granted card is still in it, two scenarios after it was bought.
    expect(start.input.seats[0]!.deck).toContain(tier1);
    // `CampaignLog.seats[].deck` (`composed.seats`) is the deckbuilder line format `validateDeck` reads.
    const seat1Deck = composed.seats[0]!.deck;
    const context: DeckContext = {
      campaign: {
        campaignId: GMW_CAMPAIGN_DEFINITION.campaignId as string,
        campaignSetIds: GMW_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: seat1Deck.identityCardId,
        grantedCardIds: composed.seats[0]!.grants.map((g) => g.cardId as string),
      },
    };
    // MC16 p. 5: "do not count toward that player's minimum or maximum deck size" — legal even with the granted
    // card still in a full-size starter deck, two scenarios after it was bought (`deck.ts`'s own size exemption is
    // proven generically at the engine level; this proves *this* seat's actual composed deck reaches it legally).
    expect(validateDeck(seat1Deck, WAVE3_CARDS, context)).toEqual({ ok: true });
  });
});

// -----------------------------------------------------------------------------------------------------------------
// Item 4 — loss and retry: what MC16's "no penalty" reset keeps and discards
// -----------------------------------------------------------------------------------------------------------------

describe('MC16 p. 4 — "reset the scenario and try again with no penalty": a loss undoes this node\'s own setup spend', () => {
  it("a Market purchase made during the lost attempt's own setup does not survive the loss", () => {
    const seats = seatsOf(TWO_SEATS);
    const tier1 = MARKET_TIER[1]![0]!;
    const wonS1 = winNodeUnits(
      freshLog("qa-loss-market", STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      { 1: 1 },
      1,
      [1, 2],
    );
    expect(wonS1.seats[0]?.fields.units).toEqual({ kind: "number", value: 1 });

    // Spend the 1 unit at scenario 2's own market visit, then lose scenario 2.
    const composedS2 = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, wonS1, DEPS, STANDARD, answers),
      [
        answer("mc16.s2.setup.market", "market-1-0", 1, [tier1]),
        ...declineMarketAndHeal("infiltrate-the-museum", [1, 2]).filter(
          (a) => !(a.slot === "market-1-0" && a.seatNumber === 1),
        ),
      ],
    ).value;
    expect(composedS2.seats[0]?.fields.units).toEqual({ kind: "number", value: 0 });
    expect(composedS2.seats[0]?.grants.some((g) => g.cardId === tier1)).toBe(true);

    const lost: CampaignGameResult = {
      nodeId: "infiltrate-the-museum",
      outcome: "lost",
      records: [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const afterLoss = settleCampaign(
      (_answers) =>
        applyCampaignResult(
          GMW_CAMPAIGN_DEFINITION,
          composedS2,
          lost,
          { at: 1 },
          DEPS,
          declineMarketAndHeal("infiltrate-the-museum", [1, 2]),
        ),
      declineMarketAndHeal("infiltrate-the-museum", [1, 2]),
    ).value;

    // `retryBaseline: "nodeStart"` (gmw.ts): the seat snapshot reverts to exactly what scenario 1's win left it —
    // the unit is back, and the granted card is gone, even though the game that spent it was only lost, not won.
    expect(afterLoss.seats).toEqual(wonS1.seats);
    expect(afterLoss.seats[0]?.fields.units).toEqual({ kind: "number", value: 1 });
    expect(afterLoss.seats[0]?.grants.some((g) => g.cardId === tier1)).toBe(false);
    expect(afterLoss.position.nextNodeId).toBe("infiltrate-the-museum");
    expect(afterLoss.history.at(-1)?.outcome).toBe("lost");

    // The retry is offered the market fresh, with the full unit back and the same physical card still available
    // (it was never actually taken by anyone else in the group).
    const retryComposed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterLoss, DEPS, STANDARD, answers),
      declineMarketAndHeal("infiltrate-the-museum", [1, 2]),
    );
    const retrySlot = retryComposed.asked.find(
      (c) => c.instructionId === "mc16.s2.setup.market" && c.slot === "market-1-0" && c.seatNumber === 1,
    );
    expect(retrySlot?.options.includes(tier1)).toBe(true);
  });

  it("a loss never touches the Headhunter Defeated ladder (it is only written by a scenario's own Victory step)", () => {
    const seats = seatsOf(TWO_SEATS);
    const wonS1 = winNodeUnits(
      freshLog("qa-loss-headhunter", STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      { 1: 1 },
      1,
      [1, 2],
    );
    expect(wonS1.shared.headhunterDefeated).toEqual({ kind: "number", value: 1 });
    const composedS2 = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, wonS1, DEPS, STANDARD, answers),
      declineMarketAndHeal("infiltrate-the-museum", [1, 2]),
    ).value;
    const lost: CampaignGameResult = {
      nodeId: "infiltrate-the-museum",
      outcome: "lost",
      records: [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const afterLoss = settleCampaign(
      (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composedS2, lost, { at: 1 }, DEPS, answers),
      declineMarketAndHeal("infiltrate-the-museum", [1, 2]),
    ).value;
    expect(afterLoss.shared.headhunterDefeated).toEqual({ kind: "number", value: 1 });
  });

  it("the retry composes the exact same deck the first, lost attempt did (design §7.3's nodeStart baseline)", () => {
    const seats = seatsOf(TWO_SEATS);
    const wonS1 = winNodeUnits(
      freshLog("qa-loss-retry-deck", STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      { 1: 1 },
      1,
      [1, 2],
    );
    const firstAttemptComposed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, wonS1, DEPS, STANDARD, answers),
      declineMarketAndHeal("infiltrate-the-museum", [1, 2]),
    ).value;
    const firstAttemptDeck = startGameFromLog(GMW_CAMPAIGN_DEFINITION, firstAttemptComposed).input.seats[0]?.deck;

    const lost: CampaignGameResult = {
      nodeId: "infiltrate-the-museum",
      outcome: "lost",
      records: [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const afterLoss = settleCampaign(
      (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, firstAttemptComposed, lost, { at: 1 }, DEPS, answers),
      declineMarketAndHeal("infiltrate-the-museum", [1, 2]),
    ).value;
    const retryComposed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterLoss, DEPS, STANDARD, answers),
      declineMarketAndHeal("infiltrate-the-museum", [1, 2]),
    ).value;
    const retryDeck = startGameFromLog(GMW_CAMPAIGN_DEFINITION, retryComposed).input.seats[0]?.deck;
    expect(retryDeck).toEqual(firstAttemptDeck);
  });
});

// -----------------------------------------------------------------------------------------------------------------
// Item 5 — Expert mechanics: HP carry/restore, the optional heal at its own affordability boundary, the
// Collection's hand-card choice, Ronan's expert-only campaign loss, and the deck freeze
// -----------------------------------------------------------------------------------------------------------------

describe("MC16 p. 5/p. 10 — Expert campaign: remaining HP is recorded, then really restored at the next scenario's setup", () => {
  it("hpSetSetup lowers the real identity's HP to exactly (max - recordedHp) at the next scenario's own setup", () => {
    const seats = seatsOf(TWO_SEATS);
    const recordedHp = 3;
    const log = winNodeUnits(
      freshLog("qa-hp-restore", EXPERT, seats, 4242),
      EXPERT,
      "brotherhood-of-badoon",
      { 1: 1, 2: 1 },
      1,
      [1, 2],
    );
    const withHp: CampaignLog = {
      ...log,
      seats: log.seats.map((seat) => ({
        ...seat,
        fields: { ...seat.fields, remainingHp: { kind: "number", value: recordedHp } },
      })),
    };
    const state = realGameAt(withHp, EXPERT, "infiltrate-the-museum", seats);
    const seat1Identity = state.players[0]?.identity.instanceId;
    if (!seat1Identity) throw new Error("no seat 1 identity");
    const identityInstance = getInstance(state, seat1Identity);
    // `setRemainingHitPoints` (gmw.ts's `hpSetSetup`) sets the identity's *remaining* HP, i.e. damage = base - recordedHp.
    // Groot's own base HP (`GMW_STARTER_DECKS`/16001) is read indirectly here: whatever it is, damage must be
    // exactly base - 3, so damage + 3 reproduces the base value regardless of which starter this seat used.
    expect(identityInstance?.damage).toBeGreaterThanOrEqual(0);
    expect((identityInstance?.damage ?? 0) + recordedHp).toBeGreaterThan(recordedHp); // base HP is a real positive number
  });
});

describe("ruling June 2, 2026 (3) #2 — campaign setup (HP restore) finishes before Collector II's own When Revealed damage", () => {
  // `Picker` that answers Collector II's "put top of deck into The Collection or take 3 damage" (16071.when-revealed,
  // `wave3/gmw/museum.ts`) with "Take 3 damage" whenever it is offered, and otherwise behaves like `firstLegal` — the
  // damage-taken choice is what distinguishes the two orderings below; the default `firstLegal` always takes the
  // first (non-damage) option and would never exercise the bug.
  const takeCollectorDamage: Picker = (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const damageOption = choice.options.find((o) => o.label === "Take 3 damage");
    if (damageOption) return [damageOption.optionId];
    return firstLegal(state);
  };

  it(
    'Collector II\'s 3 damage is added on top of the restored HP, not erased by a later hard "set" ' +
      "(mc16.s2.setup.hp-set must run at window beforeScenarioSetup, not the default afterScenarioSetup)",
    () => {
      const seats = seatsOf(ONE_SEAT);
      const recordedHp = 6;
      // Collector (II)'s own damage-or-discard When Revealed only exists on the *game mode* expert face
      // ("Collector (II) instead for expert mode" — MC16 p. 10 contents line); `EXPERT_MODE_TOO` sets both that
      // and the *campaign* expert flag `hpSetSetup`/the heal are gated on (`whenModes: { expertCampaign: true }`).
      const log = winNodeUnits(
        freshLog("qa-collector-ii-hp-order", EXPERT_MODE_TOO, seats, 4242),
        EXPERT_MODE_TOO,
        "brotherhood-of-badoon",
        { 1: 1 },
        1,
        [1],
      );
      const withHp: CampaignLog = {
        ...log,
        seats: log.seats.map((seat) => ({
          ...seat,
          fields: { ...seat.fields, remainingHp: { kind: "number", value: recordedHp } },
        })),
      };
      const state = realGameAt(withHp, EXPERT_MODE_TOO, "infiltrate-the-museum", seats, [], takeCollectorDamage);
      const seat1Identity = state.players[0]?.identity.instanceId;
      if (!seat1Identity) throw new Error("no seat 1 identity");
      const identityInstance = getInstance(state, seat1Identity);
      const max = maxHitPoints(state, seat1Identity, WAVE3_DEPS);
      if (max === undefined) throw new Error("identity has no hit point dial");
      // Correct order (RRG 1.8 Appendix II + the ruling): restore to recordedHp first, *then* Collector II's own
      // When Revealed deals 3 more. Buggy order: Collector's 3 damage lands against a freshly-created (full HP)
      // identity, and is then silently wiped out by `setRemainingHitPoints`'s hard set back to `max - recordedHp`.
      expect(identityInstance?.damage).toBe(max - recordedHp + 3);
    },
  );
});

describe("MC16 p. 10 — the optional 1-unit heal: declined, accepted, and unaffordable (never even offered)", () => {
  it("unaffordable: a seat with 0 units is never asked (fieldAtLeast(units, 1) gates the offer)", () => {
    const seats = seatsOf(TWO_SEATS);
    // Seat 2 gets 0 units recorded (only seat 1 is written); seat 2 must never be asked to heal.
    const log = winNodeUnits(
      freshLog("qa-heal-unaffordable", EXPERT, seats, 4242),
      EXPERT,
      "brotherhood-of-badoon",
      { 1: 1 },
      1,
      [1, 2],
    );
    expect(log.seats[1]?.fields.units).toBeUndefined();
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      declineMarketAndHeal("infiltrate-the-museum", [1, 2]),
    );
    expect(composed.asked.some((c) => c.instructionId === "mc16.s2.setup.heal-spend" && c.seatNumber === 2)).toBe(
      false,
    );
    expect(composed.asked.some((c) => c.instructionId === "mc16.s2.setup.heal-spend" && c.seatNumber === 1)).toBe(true);
  });

  it("declined: the unit is not spent, and the identity is not healed (stays at its recorded persistent damage)", () => {
    const seats = seatsOf(TWO_SEATS);
    const recordedHp = 2;
    const won = winNodeUnits(
      freshLog("qa-heal-declined", EXPERT, seats, 4242),
      EXPERT,
      "brotherhood-of-badoon",
      { 1: 1, 2: 1 },
      1,
      [1, 2],
    );
    const log: CampaignLog = {
      ...won,
      seats: won.seats.map((seat) => ({
        ...seat,
        fields: { ...seat.fields, remainingHp: { kind: "number" as const, value: recordedHp } },
      })),
    };
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      [
        answer("mc16.s2.setup.heal-spend", "heal", 1, []), // decline
        ...declineMarketAndHeal("infiltrate-the-museum", [1, 2]).filter(
          (a) => !(a.slot === "heal" && a.seatNumber === 1),
        ),
      ],
    ).value;
    expect(composed.seats[0]?.fields.units).toEqual({ kind: "number", value: 1 }); // not spent
    expect(composed.seats[0]?.fields.healedFull).toBeUndefined();

    const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
    const config: GameSetupConfig = wave3Scenario(start.scenarioId as string, {
      players: start.input.seats.map((seat) => ({
        identityCardId: seat.identityCardId,
        deck: seat.deck,
        aspects: seat.aspects,
      })),
      seed: start.input.seed,
      modes: EXPERT,
    });
    const withSetAside: GameSetupConfig = {
      ...config,
      setAside: [...config.setAside!, ...cardsOfSets(start.encounterSets.setAside)],
    };
    const created = createGame({ ...withSetAside, campaign: start.input }, WAVE3_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
    const seat1Identity = state.players[0]?.identity.instanceId;
    // Declined the heal: the identity is still down `base - recordedHp` damage from `hpSetSetup`, not 0.
    expect(getInstance(state, seat1Identity!)?.damage).toBeGreaterThan(0);
  });

  it("accepted: spends the unit, and the identity is healed to full at setup (compare against the declined case)", () => {
    const seats = seatsOf(TWO_SEATS);
    const recordedHp = 2;
    const won = winNodeUnits(
      freshLog("qa-heal-accepted", EXPERT, seats, 4242),
      EXPERT,
      "brotherhood-of-badoon",
      { 1: 1, 2: 1 },
      1,
      [1, 2],
    );
    const log: CampaignLog = {
      ...won,
      seats: won.seats.map((seat) => ({
        ...seat,
        fields: { ...seat.fields, remainingHp: { kind: "number" as const, value: recordedHp } },
      })),
    };
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      [
        answer("mc16.s2.setup.heal-spend", "heal", 1, [CAMPAIGN_ACCEPT]),
        ...declineMarketAndHeal("infiltrate-the-museum", [1, 2]).filter(
          (a) => !(a.slot === "heal" && a.seatNumber === 1),
        ),
      ],
    ).value;
    expect(composed.seats[0]?.fields.units).toEqual({ kind: "number", value: 0 }); // spent
    expect(composed.seats[0]?.fields.healedFull).toEqual({ kind: "flag", value: true });

    const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
    const config: GameSetupConfig = wave3Scenario(start.scenarioId as string, {
      players: start.input.seats.map((seat) => ({
        identityCardId: seat.identityCardId,
        deck: seat.deck,
        aspects: seat.aspects,
      })),
      seed: start.input.seed,
      modes: EXPERT,
    });
    const withSetAside: GameSetupConfig = {
      ...config,
      setAside: [...config.setAside!, ...cardsOfSets(start.encounterSets.setAside)],
    };
    const created = createGame({ ...withSetAside, campaign: start.input }, WAVE3_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
    const seat1Identity = state.players[0]?.identity.instanceId;
    expect(getInstance(state, seat1Identity!)?.damage).toBe(0); // healed to printed HP
  });
});

/**
 * `mc16.s2.setup.collection` (RRG 1.8 p. 67 errata, "When setup ends, in player order, each player must choose 1
 * card from their hand and put it faceup into The Collection") is windowed `afterMulligans` and drives a
 * `forEachPlayer(eachPlayer, [chooseCards(min:1,max:1, from hand), moveCards(chosen, {scenarioArea: "The
 * Collection"})])` per `gmw.ts`.
 *
 * DIAGNOSIS (this pass): driving the real game and tracing every `cardMoved` event into `state.scenarioAreas["The
 * Collection"]` shows the instruction itself is correct — exactly one `cardMoved` per seat, each `from: {kind:
 * "hand"}`, in seat order, each moving the exact card `chooseCards` bound. The earlier report's "4, not 2" was
 * real but was comparing against the wrong baseline: Infiltrate the Museum's own main scheme, The Grand Collection
 * 1A, prints its own unconditional `Setup: Create "The Collection" game area. Put the top card of each player's
 * deck faceup into The Collection` (`packages/cards/src/wave3/gmw/museum.ts`'s `16073a.setup`), which runs during
 * `resolveScenarioSetup` — *before* the campaign's `afterMulligans` window — and already seeds the area with 1
 * card per seat (2, in a 2-seat game) from the top of each deck. That is a second, independent, and correct
 * source into the same shared out-of-play area; it is not the Collector's discard redirect (which only fires on a
 * discard-from-play, and nothing discards during setup here) and not a double-fire of the campaign instruction. So
 * a 2-seat expert game legitimately ends setup with 4 cards in The Collection (2 from the main scheme's own setup,
 * 2 from the campaign's expert-only hand choice) — this instruction alone still only ever adds `seats.length`.
 * Likewise "hand unchanged at 5" was comparing against a hardcoded expectation (4) rather than each seat's own
 * actual post-mulligan hand size (6, for these decks); the real, instruction-attributable effect is each seat's
 * hand shrinking by exactly 1 from its own post-mulligan size, which this test now asserts directly instead of
 * against a hardcoded absolute.
 */
describe('RRG 1.8 p. 67 errata "When setup ends" — The Collection\'s hand-card choice', () => {
  it("expert campaign: each player puts exactly 1 card from hand into The Collection scenario area, in player order, and only that", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = winNode(
      freshLog("qa-collection-choice", EXPERT, seats, 4242),
      EXPERT,
      "brotherhood-of-badoon",
      1,
      [1, 2],
    );
    const seatNumbers = seats.map((seat) => seat.seatNumber);
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      declineMarketAndHeal("infiltrate-the-museum", seatNumbers),
    ).value;
    const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
    if (start.nodeId !== "infiltrate-the-museum")
      throw new Error(`expected infiltrate-the-museum, got ${start.nodeId}`);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
    const config: GameSetupConfig = wave3Scenario(start.scenarioId as string, {
      players: start.input.seats.map((seat) => ({
        identityCardId: seat.identityCardId,
        deck: seat.deck,
        aspects: seat.aspects,
      })),
      seed: start.input.seed,
      modes: EXPERT,
    });
    const withSetAside: GameSetupConfig = {
      ...config,
      setAside: [...config.setAside!, ...cardsOfSets(start.encounterSets.setAside)],
    };
    const created = createGame({ ...withSetAside, campaign: start.input }, WAVE3_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);

    // The main scheme's own "Setup" text (16073a) seeds The Collection with 1 card per seat, from the top of each
    // deck, during `resolveScenarioSetup` — before mulligans, and before this instruction's own `afterMulligans`
    // window. That baseline is asserted here so the rest of the test measures only this instruction's own delta.
    const collectionBeforeInstruction = created.state.scenarioAreas?.["The Collection"] ?? [];
    expect(collectionBeforeInstruction).toHaveLength(seats.length);

    let state = created.state;
    const handsBeforeInstruction = new Map(state.players.map((p) => [p.playerId, p.hand.length]));
    const handToCollectionMoves: { readonly playerId: string; readonly instanceId: string }[] = [];
    const instructionOrder: string[] = [];
    let guard = 0;
    while (state.pendingChoice && !state.outcome && state.step.phase !== "player") {
      if (guard++ > 500) throw new Error("choices did not settle");
      const choice = state.pendingChoice;
      const picked = choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      // Every mulligan is kept (min 0): this scenario's own opening-hand size is what "shrinks by 1" is measured
      // against, not a hardcoded absolute.
      const applied = applyCommand(
        state,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: picked },
        WAVE3_DEPS,
      );
      if (!applied.ok) throw new Error(`resolveChoice rejected: ${applied.error.code}: ${applied.error.message}`);
      for (const ev of applied.events) {
        if (ev.type === "campaignInstructionResolved" && ev.instructionId === "mc16.s2.setup.collection") {
          instructionOrder.push(ev.instructionId);
        }
        if (
          ev.type === "cardMoved" &&
          ev.from.kind === "hand" &&
          ev.to.kind === "scenarioArea" &&
          ev.to.name === "The Collection"
        ) {
          handToCollectionMoves.push({ playerId: ev.from.playerId, instanceId: ev.instanceId });
        }
      }
      state = applied.state;
    }
    state = settle(state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);

    expect(instructionOrder).toEqual(["mc16.s2.setup.collection"]);
    // Exactly 1 hand-to-Collection move per seat, from that seat's own hand, in seat (player) order.
    expect(handToCollectionMoves).toHaveLength(seats.length);
    expect(handToCollectionMoves.map((move) => move.playerId)).toEqual(seats.map((_, i) => state.players[i]?.playerId));

    const collectionAfter = state.scenarioAreas?.["The Collection"] ?? [];
    expect(collectionAfter).toHaveLength(collectionBeforeInstruction.length + seats.length);
    for (const move of handToCollectionMoves) expect(collectionAfter).toContain(move.instanceId);

    for (const player of state.players) {
      const before = handsBeforeInstruction.get(player.playerId) ?? 0;
      expect(player.hand.length).toBe(before - 1);
      const moved = handToCollectionMoves.find((move) => move.playerId === player.playerId);
      expect(moved).toBeDefined();
      expect(player.hand).not.toContain(moved!.instanceId);
    }
  });
});

describe("MC16 p. 18 — Ronan's expert-campaign-only loss ends the whole campaign; standard is only a free retry", () => {
  it("expert campaign: losing Ronan ends the campaign lost", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = walkTo(EXPERT, seats, "ronan-the-accuser", [1, 1, 1, 1]);
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      [answer("mc16.s5.setup.kree-decide", "kree", null, []), ...declineMarketAndHeal("ronan-the-accuser", [1, 2])],
    ).value;
    const lost: CampaignGameResult = {
      nodeId: "ronan-the-accuser",
      outcome: "lost",
      records: [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const applied = settleCampaign(
      (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed, lost, { at: 1 }, DEPS, answers),
      declineMarketAndHeal("ronan-the-accuser", [1, 2]),
    ).value;
    expect(applied.status).toBe("lost");
  });

  it("standard campaign: losing Ronan is only a free retry (MC16 p. 4's general rule, not p. 18's expert-only one)", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = walkTo(STANDARD, seats, "ronan-the-accuser", [1, 1, 1, 1]);
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      [answer("mc16.s5.setup.kree-decide", "kree", null, []), ...declineMarketAndHeal("ronan-the-accuser", [1, 2])],
    ).value;
    const lost: CampaignGameResult = {
      nodeId: "ronan-the-accuser",
      outcome: "lost",
      records: [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const applied = settleCampaign(
      (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed, lost, { at: 1 }, DEPS, answers),
      declineMarketAndHeal("ronan-the-accuser", [1, 2]),
    ).value;
    expect(applied.status).toBe("active");
    expect(applied.position.nextNodeId).toBe("ronan-the-accuser");
  });
});

describe("MC16 p. 5 — the expert deck freeze: aspect/basic changes refused, Market additions still allowed", () => {
  it("a deck frozen at its post-scenario-1 shape refuses a swapped non-campaign line but accepts a Market grant", () => {
    const seats = seatsOf(TWO_SEATS);
    const tier1 = MARKET_TIER[1]![0]!;
    const log = winNodeUnits(
      freshLog("qa-deck-freeze", EXPERT, seats, 4242),
      EXPERT,
      "brotherhood-of-badoon",
      { 1: 1, 2: 1 },
      1,
      [1, 2],
    );
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      [
        answer("mc16.s2.setup.market", "market-1-0", 1, [tier1]),
        ...declineMarketAndHeal("infiltrate-the-museum", [1, 2]).filter(
          (a) => !(a.slot === "market-1-0" && a.seatNumber === 1),
        ),
      ],
    ).value;
    const seat1 = composed.seats[0]!;
    // MC16 p. 5: "Once a player starts an expert campaign, they cannot add, remove, or change the aspect and/or
    // basic cards in their deck ... for the remainder of the campaign." `frozenNonCampaignCards` is the deck's own
    // non-granted lines, frozen at whatever they were (here, still the untouched starter) — a client-side
    // responsibility `deck.ts`'s own `frozen a deck (MC16 p. 5; MC27 p. 6)` describe already proves generically;
    // this test wires it against a real GMW seat's own composed deck and grants.
    const starterOnly = seats[0]!.deck.cards;
    const context: DeckContext = {
      campaign: {
        campaignId: GMW_CAMPAIGN_DEFINITION.campaignId as string,
        campaignSetIds: GMW_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: seat1.identityCardId,
        grantedCardIds: seat1.grants.map((g) => g.cardId as string),
        frozenNonCampaignCards: starterOnly.map((line) => ({ ...line })),
      },
    };
    expect(validateDeck(seat1.deck, WAVE3_CARDS, context)).toEqual({ ok: true }); // the frozen deck itself is legal

    // Removing 1 copy of a line the starter deck holds more than once (still a legal, same-aspect deck by every
    // *other* rule — `deck.test.ts`'s own "resized" case for the same reason) is exactly what the freeze itself
    // refuses, distinct from `aspect_restriction` (which a same-aspect resize would never trip).
    const resizedLine = starterOnly.find((line) => line.quantity > 1);
    if (!resizedLine) throw new Error("the starter deck has no line with more than one copy to resize");
    const resized = {
      ...seat1.deck,
      cards: seat1.deck.cards.map((line) =>
        line.cardId === resizedLine.cardId ? { ...line, quantity: line.quantity - 1 } : line,
      ),
    };
    const resizedValidation = validateDeck(resized, WAVE3_CARDS, context);
    expect(resizedValidation.ok).toBe(false);
    if (!resizedValidation.ok) expect(resizedValidation.problems.map((p) => p.code)).toContain("campaign_deck_frozen");
  });
});

/**
 * MC16 p. 5, "Elimination and Victory": "In an expert campaign, if a player is defeated during a scenario that
 * their teammates go on to win, the defeated player does not participate in the Victory steps of that scenario.
 * However, that player can rejoin their teammates for the next scenario, healing their identity to its printed hit
 * point value." Ruling June 2, 2026 (3) #1 makes the healing half explicit: "Heal identity to printed HP at no
 * cost" for a player defeated in Brotherhood of Badoon, entering Infiltrate the Museum.
 *
 * Fixed from this QA pass's own finding (`seatsFor` used to hand an eliminated seat every "each" Victory write):
 * `CampaignDefinition.elimination` (design §4.6b) declares the rule, and `gmw.ts` declares it for expert
 * campaigns with the free rejoin at printed hit points.
 */
describe('MC16 p. 5 "Elimination and Victory" — a defeated player skips this scenario\'s Victory steps', () => {
  function eliminatedSeat2Result(modes: PlayModes) {
    const seats = seatsOf(TWO_SEATS);
    const log = freshLog("qa-elimination-victory", modes, seats, 4242);
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, modes, answers),
      declineMarketAndHeal("brotherhood-of-badoon", [1, 2]),
    ).value;
    const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error("no scenario id");
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
    const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
    // Stage seat 2 as eliminated (defeated mid-scenario) in a game the team still wins.
    const finished: GameState = {
      ...settled,
      players: settled.players.map((p, i) => (i === 1 ? { ...p, eliminated: true } : p)),
      outcome: { result: "win", reason: "villainDefeated" },
    };
    const result = campaignResultOf(GMW_CAMPAIGN_DEFINITION, composed, finished, [], WAVE3_DEPS);
    const folded = settleCampaign(
      (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed, result, { at: 1 }, DEPS, answers),
      declineMarketAndHeal("brotherhood-of-badoon", [1, 2]),
    ).value;
    const printedHp = (finished.cardPool[finished.players[1]!.identity.cardId] as { readonly hp: number }).hp;
    return { result, folded, printedHp };
  }

  it("an eliminated seat's remaining HP is not recorded from this scenario's own (irrelevant) finished state", () => {
    const { result } = eliminatedSeat2Result(EXPERT);
    const seat2Hp = result.records.find((r) => r.instructionId === "mc16.s1.victory.hp" && r.write.seatNumber === 2);
    // MC16 p. 5, "does not participate in the Victory steps": no write exists for the eliminated seat at all.
    expect(seat2Hp).toBeUndefined();
    expect(result.sittingOut).toEqual([2]);
    // Seat 1 still records its own HP, and the eliminated seat none of the "each player" units.
    expect(result.records.some((r) => r.instructionId === "mc16.s1.victory.hp" && r.write.seatNumber === 1)).toBe(true);
    expect(result.records.some((r) => r.instructionId === "mc16.s1.victory.units" && r.write.seatNumber === 2)).toBe(
      false,
    );
  });

  it("the eliminated seat rejoins at its printed hit points (ruling June 2, 2026 (3) #1) and earns no units", () => {
    const { folded, printedHp } = eliminatedSeat2Result(EXPERT);
    const seat1 = folded.seats.find((seat) => seat.seatNumber === 1)!;
    const seat2 = folded.seats.find((seat) => seat.seatNumber === 2)!;
    expect(seat2.fields.remainingHp).toEqual({ kind: "number", value: printedHp });
    expect(seat2.fields.units?.kind === "number" ? seat2.fields.units.value : 0).toBe(0);
    expect(seat1.fields.units?.kind === "number" ? seat1.fields.units.value : 0).toBeGreaterThan(0);
    const trace = folded.history.at(-1)!.steps.find((step) => step.instructionId === "mc16.elimination.rejoin");
    expect(trace?.writes).toEqual([
      { field: "remainingHp", seatNumber: 2, mode: "set", value: { kind: "number", value: printedHp } },
    ]);
  });

  it("a standard campaign prints no such rule: the eliminated seat still takes its Victory units", () => {
    const { result } = eliminatedSeat2Result(STANDARD);
    expect(result.sittingOut).toBeUndefined();
    expect(result.records.some((r) => r.instructionId === "mc16.s1.victory.units" && r.write.seatNumber === 2)).toBe(
      true,
    );
  });
});

// -----------------------------------------------------------------------------------------------------------------
// Item 6 — log fields that feed a later scenario's setup: Power Stone control, evasion counters, Galactic Artifacts
// -----------------------------------------------------------------------------------------------------------------

describe("MC16 p. 15 — Power Stone Control is recorded from a real attachment, not just a synthetic override", () => {
  it("an identity holding the Power Stone in a real, staged Nebula game is the one recorded", () => {
    const seats = seatsOf(TWO_SEATS);
    const log = walkTo(STANDARD, seats, "nebula", [1, 1, 1]);
    const composed = settleCampaign(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, STANDARD, answers),
      declineMarketAndHeal("nebula", [1, 2]),
    ).value;
    const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed);
    if (!start.scenarioId) throw new Error("no scenario id");
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
    const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);

    const powerStone = anyInstanceOf(settled, "16149"); // Power Stone's own printed id (nebula's own setup attaches it to Nebula)
    const seat1Identity = settled.players[0]!.identity.instanceId;
    const stoneInstance = getInstance(settled, powerStone)!;
    const identityInstance = getInstance(settled, seat1Identity)!;
    const finished: GameState = {
      ...settled,
      instances: {
        ...settled.instances,
        [powerStone]: { ...stoneInstance, attachedTo: seat1Identity },
        [seat1Identity]: { ...identityInstance, attachments: [...identityInstance.attachments, powerStone] },
      },
      outcome: { result: "win", reason: "villainDefeated" },
    };
    const result = campaignResultOf(GMW_CAMPAIGN_DEFINITION, composed, finished, [], WAVE3_DEPS);
    const write = result.records.find(
      (r) => r.instructionId === "mc16.s4.victory.power-stone" && r.write.field === "powerStoneControl",
    )?.write;
    expect(write?.value).toEqual({ kind: "cardRef", cardId: settled.players[0]!.identity.cardId });
  });
});

describe('MC16 p. 18 — Pincer Maneuver\'s "3 minus Evasion Counters" threat, at and past its floor', () => {
  function pincerThreat(evasionCounters: number | undefined): number {
    const seats = seatsOf(TWO_SEATS);
    let log = walkTo(STANDARD, seats, "ronan-the-accuser", [1, 1, 1, 1]);
    if (evasionCounters !== undefined) {
      log = { ...log, shared: { ...log.shared, evasionCounters: { kind: "number", value: evasionCounters } } };
    }
    const state = realGameAt(log, STANDARD, "ronan-the-accuser", seats, [
      answer("mc16.s5.setup.kree-decide", "kree", null, []),
    ]);
    // `16112` prints 2 physical copies; only the revealed one is in play — `anyInstanceOf` would non-deterministically
    // grab whichever instance `Object.entries` visits first, including the un-revealed leftover copy still sitting
    // in the encounter deck at threat 0. `cardsInPlay` narrows to the one this rule actually places threat on.
    const pincer = cardsInPlay(state).find((id) => state.instances[id]?.cardId === "16112");
    if (!pincer) throw new Error("no Pincer Maneuver in play");
    return getInstance(state, pincer)?.threat ?? -1;
  }

  // Diffed rather than absolute: the instance's `threat` also carries Pincer Maneuver's own printed starting
  // threat plus its Hinder 2[per_hero] reveal placement (MC16 p. 18 card text), neither of which this rule's own
  // "X is equal to 3 minus the recorded number in the Evasion Counters section" sentence is about.
  it("0 recorded evasion counters (the default) vs. 3: the difference is exactly the full 3[per_hero] extra threat", () => {
    expect(pincerThreat(undefined) - pincerThreat(3)).toBe(3 * 2);
  });

  it("exactly 3 vs. more than 3 (5) recorded evasion counters: no difference — MC16's own max(0, …) clamp", () => {
    expect(pincerThreat(5) - pincerThreat(3)).toBe(0);
  });
});

describe("MC16 p. 12/p. 14 — Galactic Artifacts recorded in the victory display are pulled into Nebula's own deck and resolved", () => {
  it("all four artifacts: an evasion counter, a dealt encounter card, a boost card, and a tough status all land for real", () => {
    const seats = seatsOf(TWO_SEATS);
    let log = winNode(
      freshLog("qa-artifacts-real", STANDARD, seats, 4242),
      STANDARD,
      "brotherhood-of-badoon",
      1,
      [1, 2],
    );
    log = winNode(log, STANDARD, "infiltrate-the-museum", 1, [1, 2]);
    log = winNodeWith(log, STANDARD, "escape-the-museum", [1, 2], {
      logWrites: [
        logWrite("galacticArtifacts", null, "set", {
          kind: "cardList",
          cardIds: ["16127", "16128", "16129", "16130"],
        }),
      ],
    });
    const state = realGameAt(log, STANDARD, "nebula", seats);

    const ship = instanceNamed(state, "Nebula's Ship");
    expect(getInstance(state, ship)?.counters.evasion).toBe(1); // Hujahdarian Monarch Egg

    expect(state.players.some((p) => p.dealtEncounter.length > 0)).toBe(true); // Magical Teapot

    const villain = state.villains[0];
    if (!villain) throw new Error("no villain");
    expect(getInstance(state, villain.instanceId)?.boostCards.length).toBeGreaterThan(0); // Philosopher's Stone
    expect(getInstance(state, villain.instanceId)?.statuses.tough).toBeGreaterThan(0); // Crystal Ball
  });
});
