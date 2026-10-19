/**
 * docs/phase7-wave11-scenarios.md §S3.14: `removeFromCampaign { byTitle: true }`.
 *
 * MC60 p. 9 step 8: "Each player searches their deck for each card whose title is recorded in the 'Allies/Supports
 * Removed from the Campaign' section of the campaign log and removes those cards from the game. Any player whose deck
 * is below the minimum deck size must add cards to their deck until they satisfy normal deck customization rules."
 * The log records one card id per title, so every other printing of that title must go with it.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type AnyCard, type CardId, type PlayModes } from "@mc/content";
import type { CampaignDefinition, CampaignLog, CampaignOp } from "../campaign.js";
import { stubAlly, stubIdentity, stubSupport } from "../testing/fixtures.js";
import { createCampaignLog, resolveBetweenGames, type CampaignDeps } from "./runner.js";

const CAMPAIGN_ID = campaignId("remove-by-title-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };

const TITLE = "Shared Title";
const SUBTITLE = "Matt Murdock";
const named = <T extends AnyCard>(card: T, name: string, subtitle?: string): T => ({
  ...card,
  name,
  ...(subtitle === undefined ? {} : { subtitle }),
});

const ALLY = cardId("ally-core");
const REPRINT = cardId("ally-reprint");
const OTHER = cardId("ally-other");
const OTHER_SUBTITLE = cardId("ally-same-title-other-subtitle");
const SUPPORT = cardId("support-same-title");
const HERO = cardId("hero-same-title");
const POOL: readonly AnyCard[] = [
  named(stubAlly({ id: ALLY, cost: 1, atk: 1, thw: 1, hp: 1 }), TITLE, SUBTITLE),
  // Another pack's printing: same title and subtitle, so a copy (RRG 1.8 "Copy", p. 13).
  named(stubAlly({ id: REPRINT, cost: 1, atk: 1, thw: 1, hp: 1 }), TITLE, SUBTITLE),
  named(stubAlly({ id: OTHER, cost: 1, atk: 1, thw: 1, hp: 1 }), "Another Title"),
  // Same title, another subtitle: a different card (Spider-Man (Miles Morales) against Spider-Man (Peter Parker)).
  named(stubAlly({ id: OTHER_SUBTITLE, cost: 1, atk: 1, thw: 1, hp: 1 }), TITLE, "Elektra Natchios"),
  named(stubSupport({ id: SUPPORT, cost: 1 }), TITLE, SUBTITLE),
  // A hero of the same title: never in a deck, so never removed by a deck search.
  named(
    stubIdentity({ id: HERO, hp: 10, atk: 1, thw: 1, def: 1, rec: 1, heroHandSize: 5, alterEgoHandSize: 6 }),
    TITLE,
    SUBTITLE,
  ),
];
const DEPS: CampaignDeps = { pool: POOL };

const definitionWith = (...ops: readonly CampaignOp[]): CampaignDefinition => ({
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [{ id: "removedTitles", label: "Removed", scope: "shared", type: { kind: "cardList" }, citation: "t" }],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "only",
        label: "only",
        scenario: { kind: "fixed", scenarioId: scenarioId("only-scenario") },
        setup: [
          {
            id: "t.surgery",
            text: "Each player searches their deck for each card whose title is recorded … and removes those cards.",
            citation: "t",
            step: {
              kind: "betweenGames",
              ops: [{ kind: "appendToList", field: "removedTitles", value: { kind: "const", value: ALLY } }, ...ops],
            },
          },
        ],
        victory: [],
      },
    ],
  },
});

const BY_TITLE: CampaignOp = {
  kind: "removeFromCampaign",
  cards: [{ kind: "field", field: "removedTitles" }],
  byTitle: true,
};

const compose = (
  op: CampaignOp | readonly CampaignOp[],
  deck: readonly { cardId: CardId; quantity: number }[],
): CampaignLog => {
  const definition = definitionWith(...(Array.isArray(op) ? op : [op as CampaignOp]));
  const log = createCampaignLog(definition, {
    id: "run",
    seats: [1, 2].map((seatNumber) => ({
      seatNumber,
      identityCardId: cardId(`hero-${seatNumber}`),
      deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: deck },
    })),
    modes: MODES,
    poolVersion: "t",
    seed: 5,
  });
  const outcome = resolveBetweenGames(definition, log, DEPS, MODES, []);
  if (outcome.kind !== "done") throw new Error("the setup asked a question");
  return outcome.value;
};

const DECK = [
  { cardId: ALLY, quantity: 1 },
  { cardId: REPRINT, quantity: 2 },
  { cardId: OTHER, quantity: 1 },
  { cardId: OTHER_SUBTITLE, quantity: 1 },
  { cardId: SUPPORT, quantity: 1 },
];

describe("removeFromCampaign byTitle (§S3.14; MC60 p. 9 step 8)", () => {
  it("removes every deckable copy (title and subtitle) of the recorded card from every deck, and nothing else", () => {
    const log = compose(BY_TITLE, DECK);

    expect(log.removedFromCampaign).toEqual([{ cardId: ALLY }, { cardId: REPRINT }, { cardId: SUPPORT }]);
    for (const seat of log.attempt?.input.seats ?? []) expect(seat.deck).toEqual([OTHER, OTHER_SUBTITLE]);
    for (const seat of log.seats) {
      expect(seat.deck.cards).toEqual([
        { cardId: OTHER, quantity: 1 },
        { cardId: OTHER_SUBTITLE, quantity: 1 },
      ]);
    }
    // The trace says what left, printing by printing.
    const step = log.attempt?.steps.find((entry) => entry.instructionId === "t.surgery");
    expect(step?.removedFromCampaign).toEqual([{ cardId: ALLY }, { cardId: REPRINT }, { cardId: SUPPORT }]);
  });

  it("without byTitle removes only the recorded card id", () => {
    const log = compose({ kind: "removeFromCampaign", cards: [{ kind: "field", field: "removedTitles" }] }, DECK);
    expect(log.removedFromCampaign).toEqual([{ cardId: ALLY }]);
    expect(log.seats[0]?.deck.cards.map((line) => line.cardId)).toEqual([REPRINT, OTHER, OTHER_SUBTITLE, SUPPORT]);
  });

  it("removes an id with no card in the pool by that id alone", () => {
    const log = compose(
      { kind: "removeFromCampaign", cards: [{ kind: "const", value: "not-a-card" }], byTitle: true },
      DECK,
    );
    expect(log.removedFromCampaign).toEqual([{ cardId: "not-a-card" }]);
  });

  it("sets aside no card removed from the campaign (RRG 1.8 p. 29)", () => {
    const log = compose(
      [
        BY_TITLE,
        {
          kind: "setAsideCards",
          cards: [
            { kind: "const", value: REPRINT },
            { kind: "const", value: OTHER },
          ],
        },
      ],
      DECK,
    );
    expect(log.attempt?.input.setAsideCards).toEqual([OTHER]);
  });
});
