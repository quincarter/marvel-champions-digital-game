import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import { CAMPAIGN_ACCEPT, requiredIdentitySet, type CampaignAttempt, type CampaignGameInput } from "@mc/engine";
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

  test("a struck identity-set card is legitimately absent; an unstruck missing one still blocks", async () => {
    const { record, config } = await composedConfig();
    const identity = POOL_CARDS.find((card) => card.id === config.players[0]!.identityCardId);
    if (identity?.type !== "hero_identity") throw new Error("seat 1 has no identity");
    const gone = requiredIdentitySet(identity, POOL_CARDS)[0]!.cardId as CardId;
    const without = (input: CampaignGameInput): CampaignGameInput => ({
      ...input,
      seats: input.seats.map((seat, index) =>
        index === 0 ? { ...seat, deck: seat.deck.filter((id) => id !== gone) } : seat,
      ),
    });
    const absent = await composedConfig(without);
    expect([...deckProblemsOf(record, absent.config).values()]).toEqual(["Deck size not legal +1"]);
    const struck = await composedConfig((input) => ({ ...without(input), removedFromCampaign: [{ cardId: gone }] }));
    expect(deckProblemsOf(record, struck.config).size).toBe(0);
  });

  test("deckProblemLabel names the first kind and counts the others", () => {
    const problem = (code: string) => ({ code, message: "", cardIds: [] }) as never;
    expect(deckProblemLabel([])).toBe("");
    expect(deckProblemLabel([problem("deck_size"), problem("deck_size")])).toBe("Deck size not legal");
    expect(deckProblemLabel([problem("identity_set_mismatch"), problem("deck_size")])).toBe(
      "Identity set incomplete +1",
    );
    expect(deckProblemLabel([problem("something_new")])).toBe("Deck not legal");
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
