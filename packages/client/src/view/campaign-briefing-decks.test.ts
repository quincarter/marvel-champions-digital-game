import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import {
  CAMPAIGN_ACCEPT,
  cardLegalForIdentity,
  requiredIdentitySet,
  type CampaignAttempt,
  type CampaignGameInput,
} from "@mc/engine";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedDesignRun } from "../campaign/dev-fixtures.js";
import {
  answersOfAttempt,
  briefingViewOf,
  deckProblemLabel,
  deckProblemsOf,
  deckRowsOf,
} from "./campaign-briefing-model.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });
const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;

/** The composed issue's own seats, as the setup check reads them. */
async function composedConfig(edit?: (input: CampaignGameInput) => CampaignGameInput) {
  const record = await seedDesignRun(service(), "issue1Composed");
  const input = edit ? edit(record.attempt!.input) : record.attempt!.input;
  const players = input.seats.map((seat) => ({
    identityCardId: seat.identityCardId,
    deck: [...seat.deck],
    aspects: seat.aspects,
  }));
  return { record, config: { players, campaign: input, cards: POOL_CARDS } };
}

describe("briefing deck legality, before the press", () => {
  test("a legal composed issue marks no deck row", async () => {
    const { record, config } = await composedConfig();
    const problems = deckProblemsOf(record, config);
    expect(problems.size).toBe(0);
    expect(deckRowsOf(record, cardName, problems).every((row) => row.problem === undefined)).toBe(true);
  });

  test("a seat short of cards is marked with a few words, and only that seat", async () => {
    const { record, config } = await composedConfig();
    const short = {
      ...config,
      players: config.players.map((player, index) =>
        index === 1 ? { ...player, deck: player.deck.slice(8) } : player,
      ),
    };
    const problems = deckProblemsOf(record, short);
    const seat = record.seats[1]!.seatNumber;
    expect([...problems.keys()]).toEqual([seat]);
    const rows = deckRowsOf(record, cardName, problems);
    expect(rows.map((row) => row.problem)).toEqual([undefined, expect.stringMatching(/^[A-Z][a-z ]+/)]);
    expect(rows[1]!.problem!.length).toBeLessThan(40);
    expect(
      briefingViewOf(record, cardName, 1, undefined, [], undefined, undefined, undefined, undefined, problems)!
        .decks[1]!.problem,
    ).toBe(rows[1]!.problem);
  });

  test("a struck identity-set card leaves the seat a card short, and one added card clears it (MC10 p. 12)", async () => {
    const { record, config } = await composedConfig();
    const identity = POOL_CARDS.find((card) => card.id === config.players[0]!.identityCardId);
    if (identity?.type !== "hero_identity") throw new Error("seat 1 has no identity");
    const gone = requiredIdentitySet(identity, POOL_CARDS).find((line) => line.quantity === 1)!.cardId as CardId;
    const without = (input: CampaignGameInput): CampaignGameInput => ({
      ...input,
      seats: input.seats.map((seat, index) =>
        index === 0 ? { ...seat, deck: seat.deck.filter((id) => id !== gone) } : seat,
      ),
    });
    // No removal on record: the set card is missing as well as the deck being short.
    const absent = await composedConfig(without);
    expect([...deckProblemsOf(record, absent.config).values()]).toEqual(["Has 39 cards, needs 40-50 +1"]);
    // Struck from the campaign: the card is not asked back, but the minimum is still 40, so the seat still blocks.
    const struckInput = (input: CampaignGameInput): CampaignGameInput => ({
      ...without(input),
      removedFromCampaign: [{ cardId: gone }],
    });
    const struck = await composedConfig(struckInput);
    const problems = deckProblemsOf(record, struck.config);
    expect([...problems]).toEqual([[record.seats[0]!.seatNumber, "Has 39 cards, needs 40-50"]]);
    expect(deckRowsOf(record, cardName, problems)[0]!.problem).toBe("Has 39 cards, needs 40-50");
    // One legal card added (a basic card whose title the deck does not hold) and the seat is clear.
    const held = new Set(struck.config.players[0]!.deck.map((id) => cardName(id)));
    const spare = POOL_CARDS.find(
      (card) =>
        card.type === "event" &&
        card.aspect === "basic" &&
        cardLegalForIdentity(card, identity) &&
        !held.has(card.name),
    );
    if (!spare) throw new Error("no spare basic card");
    const refilled = await composedConfig((input) => {
      const short = struckInput(input);
      return {
        ...short,
        seats: short.seats.map((seat, index) => (index === 0 ? { ...seat, deck: [...seat.deck, spare.id] } : seat)),
      };
    });
    expect(deckProblemsOf(record, refilled.config).size).toBe(0);
  });

  test("deckProblemLabel gives each code its own true label; a size problem reads the engine's count", () => {
    const problem = (code: string, message = "") => ({ code, message, cardIds: [] }) as never;
    expect(deckProblemLabel([])).toBe("");
    const size =
      "The deck has 39 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).";
    expect(deckProblemLabel([problem("deck_size", size), problem("deck_size", size)])).toBe(
      "Has 39 cards, needs 40-50",
    );
    expect(deckProblemLabel([problem("identity_set_mismatch"), problem("deck_size", size)])).toBe(
      "Identity set not exact +1",
    );
    expect(deckProblemLabel([problem("deck_size")])).toBe("Deck not legal");
    expect(deckProblemLabel([problem("something_new")])).toBe("Deck not legal");
    for (const code of ["campaign_removed_card", "identity_set_mismatch", "other_identity_card", "copy_limit"]) {
      expect(deckProblemLabel([problem(code, size)]), code).not.toMatch(/size|cards/i);
    }
  });
});

describe("answered calls stick across a deck edit", () => {
  const attempt = {
    steps: [
      {
        instructionId: "role",
        choices: [{ slot: "role", seatNumber: 2, picked: ["brawler"] }],
      },
      {
        instructionId: "upgrade",
        choices: [{ slot: "upgrade", seatNumber: 2, picked: ["32001"], random: true }],
      },
      { instructionId: "none", choices: [] },
    ],
  } as unknown as CampaignAttempt;

  test("every answered choice comes back; a drawn one as its accept token", () => {
    expect(answersOfAttempt(attempt)).toEqual([
      { instructionId: "role", slot: "role", seatNumber: 2, picked: ["brawler"] },
      { instructionId: "upgrade", slot: "upgrade", seatNumber: 2, picked: [CAMPAIGN_ACCEPT] },
    ]);
  });

  test("replaying them composes the same issue without asking again, with the same draw", async () => {
    const svc = service();
    const record = await seedDesignRun(svc, "issue1Composed");
    const answers = answersOfAttempt(record.attempt!);
    const reset = await svc.discardAttempt(record);
    const again = await svc.compose(reset, answers);
    expect(again.kind).toBe("done");
    if (again.kind !== "done") return;
    expect(again.record.attempt!.steps.map((step) => step.choices)).toEqual(
      record.attempt!.steps.map((step) => step.choices),
    );
  });
});
