/**
 * An optional grant (`CampaignOp grantCard.inclusion: "optional"`, `CampaignGrant.optional`, `CampaignGrant.leftOut`):
 * the campaign records the card as chosen, and the player decides each game whether the copy is in the deck.
 *
 * MC45 p. 24: "Each player chooses an upgrade from any aspect. They may include 1 copy of that card in their deck for
 * the rest of the campaign." Owner decisions, 2026-10-08 (docs/phase7-wave8.md §4.1 rows 67 and 68): the choice is
 * mandatory and the inclusion is not; every eligible title is offered, and copy limits are enforced by deck
 * validation, which says how to fix a deck a reward took past a limit.
 *
 * The campaign half is a standalone definition; the deck half runs `validateDeck` over real Core data.
 */
import { describe, expect, it } from "vitest";
import {
  CORE_CARDS,
  CORE_STARTER_DECKS,
  campaignId,
  cardId,
  scenarioId,
  type AnyCard,
  type DeckContents,
  type PlayModes,
  type PlayerCard,
} from "@mc/content";
import {
  grantDeckSizesOf,
  includedGrantsOf,
  type CampaignDefinition,
  type CampaignLog,
  type CampaignOp,
} from "../campaign.js";
import { validateDeck, type DeckProblem } from "../deck.js";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignDeps,
  type CampaignSeatSetup,
} from "./runner.js";

// ---- The campaign half --------------------------------------------------------------------------------------

const CAMPAIGN_ID = campaignId("grant-inclusion-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const DEPS: CampaignDeps = { pool: [] };
const SEATS: readonly CampaignSeatSetup[] = [
  {
    seatNumber: 1,
    identityCardId: cardId("hero-1"),
    deck: { identityCardId: cardId("hero-1"), aspects: [], cards: [{ cardId: cardId("reward"), quantity: 2 }] },
  },
];
const grantOp = (card: string, inclusion?: "optional"): CampaignOp => ({
  kind: "grantCard",
  seat: "each",
  card: { kind: "const", value: card },
  permanence: "campaign",
  deckSize: "maximumOnly",
  ...(inclusion ? { inclusion } : {}),
});
const definitionOf = (secondSetup: readonly CampaignOp[] = []): CampaignDefinition => ({
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: ["first", "second"].map((id) => ({
      id,
      label: id,
      scenario: { kind: "fixed" as const, scenarioId: scenarioId("grant-inclusion-test-scenario") },
      setup: [
        {
          id: `${id}.setup`,
          text: "test",
          citation: "test",
          step: {
            kind: "betweenGames" as const,
            ops: id === "first" ? [grantOp("reward", "optional"), grantOp("pinned")] : secondSetup,
          },
        },
      ],
      victory: [],
    })),
  },
});
function between(definition: CampaignDefinition, log: CampaignLog): CampaignLog {
  const outcome = resolveBetweenGames(definition, log, DEPS, MODES, []);
  if (outcome.kind !== "done") throw new Error("unexpected choice");
  return outcome.value;
}
const composed = (definition: CampaignDefinition = definitionOf()): CampaignLog =>
  between(
    definition,
    createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 3 }),
  );
/** The first scenario won: the log between games, where a deck is edited. */
function won(definition: CampaignDefinition, log: CampaignLog): CampaignLog {
  const applied = applyCampaignResult(
    definition,
    log,
    {
      nodeId: log.attempt?.nodeId ?? "",
      outcome: "won",
      records: [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    },
    { at: 1_700_000_000_000 },
    DEPS,
  );
  if (applied.kind !== "done") throw new Error("unexpected choice after the game");
  return applied.value;
}
/** The log as it is once the player has left the reward out: the flag set and the copy taken off the deck list. */
const leftOut = (log: CampaignLog): CampaignLog => ({
  ...log,
  seats: log.seats.map((seat) => ({
    ...seat,
    deck: {
      ...seat.deck,
      cards: seat.deck.cards.map((line) =>
        line.cardId === "reward" ? { ...line, quantity: line.quantity - 1 } : line,
      ),
    },
    grants: seat.grants.map((grant) => (grant.cardId === "reward" ? { ...grant, leftOut: true as const } : grant)),
  })),
});

describe("CampaignOp grantCard.inclusion", () => {
  it("an optional grant is recorded as optional and starts in the deck; a grant with no inclusion has no field", () => {
    const [seat] = composed().seats;
    expect(seat!.grants).toEqual([
      { cardId: "reward", permanence: "campaign", grantedAtNodeId: "first", deckSize: "maximumOnly", optional: true },
      { cardId: "pinned", permanence: "campaign", grantedAtNodeId: "first", deckSize: "maximumOnly" },
    ]);
    // Two copies were the player's own; the reward is the third.
    expect(seat!.deck.cards).toEqual([
      { cardId: "reward", quantity: 3 },
      { cardId: "pinned", quantity: 1 },
    ]);
    expect(includedGrantsOf(seat!.grants)).toHaveLength(2);
  });

  it("a copy left out is still a grant of the log, and is no granted copy of the deck or of the game's input", () => {
    const log = leftOut(won(definitionOf(), composed()));
    const [seat] = log.seats;
    expect(seat!.grants.map((grant) => grant.cardId)).toEqual(["reward", "pinned"]);
    expect(includedGrantsOf(seat!.grants).map((grant) => grant.cardId)).toEqual(["pinned"]);
    expect(grantDeckSizesOf(seat!.grants)).toEqual([{ cardId: "pinned", deckSize: "maximumOnly" }]);
    // The next game's input: the two copies in the deck are the player's own, and count as ordinary cards.
    const next = between(definitionOf(), log);
    expect(next.attempt?.nodeId).toBe("second");
    const [input] = next.attempt!.input.seats;
    expect(input!.deck).toEqual(["reward", "reward", "pinned"]);
    expect(input!.grantedCardIds).toEqual(["pinned"]);
    expect(input!.grantDeckSizes).toEqual([{ cardId: "pinned", deckSize: "maximumOnly" }]);
  });

  it("revoking a grant whose copy was left out takes the grant and leaves the player's own copies in the deck", () => {
    const revoke: CampaignOp = { kind: "revokeCard", seat: "each", card: { kind: "const", value: "reward" } };
    const definition = definitionOf([revoke]);
    const out = between(definition, leftOut(won(definition, composed(definition)))).seats[0]!;
    expect(out.grants.map((grant) => grant.cardId)).toEqual(["pinned"]);
    expect(out.deck.cards.find((line) => line.cardId === "reward")?.quantity).toBe(2);
    // Included, the revoke takes the copy back out of the deck as it always did.
    const kept = between(definition, won(definition, composed(definition))).seats[0]!;
    expect(kept.grants.map((grant) => grant.cardId)).toEqual(["pinned"]);
    expect(kept.deck.cards.find((line) => line.cardId === "reward")?.quantity).toBe(2);
  });
});

// ---- The deck half ------------------------------------------------------------------------------------------

const isPlayer = (card: AnyCard): card is PlayerCard => "deckLimit" in card;
const starter = CORE_STARTER_DECKS.find((deck) => deck.id === "core-spider-man-justice")!;
const nameOf = (id: string): string => CORE_CARDS.find((card) => card.id === id)!.name;
/** A non-unique justice card the starter holds this many copies of. */
const titleLine = (quantity: number) =>
  starter.cards.find((line) => {
    const card = CORE_CARDS.find((candidate) => candidate.id === line.cardId);
    return card && isPlayer(card) && card.aspect === "justice" && !card.unique && card.deckLimit === 3
      ? line.quantity === quantity
      : false;
  });
const uniqueCard = CORE_CARDS.find(
  (card): card is PlayerCard => isPlayer(card) && card.aspect === "justice" && card.unique === true,
);

const problemsOf = (
  deck: DeckContents,
  granted: readonly string[],
  optional: readonly string[] | undefined,
): readonly DeckProblem[] => {
  const verdict = validateDeck(deck, CORE_CARDS, {
    campaign: {
      campaignId: "x",
      campaignSetIds: [],
      identityCardId: starter.identityCardId,
      grantedCardIds: granted,
      grantDeckSizes: granted.map((id) => ({ cardId: cardId(id), deckSize: "maximumOnly" as const })),
      ...(optional ? { optionalGrantCardIds: optional } : {}),
    },
  });
  return verdict.ok ? [] : verdict.problems;
};
const withCopies = (id: string, quantity: number): DeckContents => ({
  identityCardId: starter.identityCardId,
  aspects: starter.aspects,
  cards: starter.cards.some((line) => line.cardId === id)
    ? starter.cards.map((line) => (line.cardId === id ? { ...line, quantity } : line))
    : [...starter.cards, { cardId: cardId(id), quantity }],
});

describe("validateDeck: a reward that takes a title past its copy limit (owner decision, 2026-10-08)", () => {
  const line = titleLine(3) ?? titleLine(2) ?? titleLine(1);

  it("the fixture: the starter holds a non-unique justice title, and Core has a unique justice card", () => {
    expect(line).toBeDefined();
    expect(uniqueCard).toBeDefined();
  });

  it("a fourth copy that is a reward: the copy limit is reported, and the message says how to fix the deck", () => {
    const id = line!.cardId as string;
    const problems = problemsOf(withCopies(id, 4), [id], [id]);
    expect(problems.map((problem) => problem.code)).toEqual(["copy_limit"]);
    expect(problems[0]!.message).toBe(
      `${nameOf(id)} has 4 copies; a deck may include no more than 3 copies of a non-unique card (by title). 1 of them is a campaign reward: remove a copy of your own, or leave the reward out of the deck.`,
    );
    expect(problems[0]!.cardIds).toEqual([id]);
    // Either fix is legal: three copies with the reward among them, or three of the player's own and no reward.
    expect(problemsOf(withCopies(id, 3), [id], [id])).toEqual([]);
    expect(problemsOf(withCopies(id, 3), [], undefined)).toEqual([]);
  });

  it("a grant that must be in the deck keeps the message every earlier box has", () => {
    const id = line!.cardId as string;
    const [problem] = problemsOf(withCopies(id, 4), [id], undefined);
    expect(problem!.message).toBe(
      `${nameOf(id)} has 4 copies; a deck may include no more than 3 copies of a non-unique card (by title).`,
    );
  });

  it("a second copy of a unique card that is a reward: the unique rule is reported with the same advice", () => {
    const id = uniqueCard!.id as string;
    const problems = problemsOf(withCopies(id, 2), [id], [id]);
    expect(problems.map((problem) => problem.code)).toEqual(["unique_match"]);
    expect(problems[0]!.message).toMatch(
      /may be included only once \(this deck has 2\)\. 1 of them is a campaign reward: remove a copy of your own, or leave the reward out of the deck\.$/,
    );
    // Left out, the starter's own copy is an ordinary card again and the deck is legal.
    expect(problemsOf(withCopies(id, 1), [], undefined)).toEqual([]);
    // Kept as the one copy, the reward replaces a card of the 40 and is not one of them: the deck is one short.
    expect(problemsOf(withCopies(id, 1), [id], [id]).map((problem) => problem.code)).toEqual(["deck_size"]);
  });
});
