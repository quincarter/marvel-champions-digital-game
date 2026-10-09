/**
 * docs/phase7-wave8.md §3.45 (task 43): a grant's deck-size rule as data (`CampaignGrant.deckSize`, `CampaignOp
 * grantCard.deckSize`, `DeckContext.campaign.grantDeckSizes`).
 *
 * MC10 p. 3: "Cards added to the deck as part of a campaign do not count toward a player's minimum or maximum deck
 * size" (`"exempt"`, the default). MC45 p. 24's rewards: "That card does not count against your minimum deck size"
 * (`"maximumOnly"`). `"counted"`: an ordinary card of the deck. RRG 1.8 Appendix I: 40 to 50 cards.
 *
 * The deck half runs `validateDeck` over real Core data, as `deck.test.ts` does; the campaign half is a standalone
 * definition, so nothing here perturbs `runner.test.ts`'s fixture.
 */
import { describe, expect, it } from "vitest";
import {
  CORE_CARDS,
  CORE_STARTER_DECKS,
  campaignId,
  cardId,
  encounterSetId,
  scenarioId,
  type AnyCard,
  type DeckContents,
  type PlayModes,
  type PlayerCard,
} from "@mc/content";
import {
  grantDeckSizesOf,
  type CampaignDefinition,
  type CampaignGameResult,
  type CampaignInstruction,
  type CampaignLog,
  type GrantDeckSize,
} from "../campaign.js";
import { DECK_MAX_CARDS, DECK_MIN_CARDS, validateDeck, type DeckContext, type DeckProblem } from "../deck.js";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignDeps,
  type CampaignSeatSetup,
} from "./runner.js";

// ---- The deck half ------------------------------------------------------------------------------------------

const SPIDER_MAN = "01001a";
const CAMP_SET = "x-camp-set";
const REWARD = cardId("x-reward");
const isPlayer = (card: AnyCard): card is PlayerCard => "deckLimit" in card;
const basicEvent = CORE_CARDS.find(
  (card): card is PlayerCard =>
    isPlayer(card) && card.aspect === "basic" && card.type === "event" && !card.unique && card.deckLimit === 3,
)!;
const synthetic = (overrides: Partial<PlayerCard>): PlayerCard => ({ ...basicEvent, ...overrides }) as PlayerCard;
const reward = synthetic({
  id: REWARD,
  name: "Requisitioned Gear",
  specificTo: { kind: "campaign", encounterSetId: encounterSetId(CAMP_SET) },
});
/** Filler: one-copy basic cards, so a deck can be made any size without touching a copy limit. */
const fillers = Array.from({ length: 14 }, (_, n) =>
  synthetic({ id: cardId(`x-filler-${n}`), name: `Filler ${n}`, deckLimit: 1 }),
);
const POOL: readonly AnyCard[] = [...CORE_CARDS, reward, ...fillers];

const starter = CORE_STARTER_DECKS.find((deck) => deck.id === "core-spider-man-justice")!;
const STARTER_SIZE = starter.cards.reduce((n, line) => n + line.quantity, 0);

/** The Spider-Man starter resized to exactly `others` ordinary cards, plus `rewards` copies of the reward. */
function deckOf(others: number, rewards = 1): DeckContents {
  let cards = [...starter.cards];
  if (others >= STARTER_SIZE) {
    cards.push(...fillers.slice(0, others - STARTER_SIZE).map((card) => ({ cardId: card.id, quantity: 1 })));
  } else {
    // Take copies off the aspect lines (the identity set must stay whole).
    let drop = STARTER_SIZE - others;
    cards = cards.flatMap((line) => {
      const card = CORE_CARDS.find((candidate) => candidate.id === line.cardId);
      if (drop === 0 || !card || !isPlayer(card) || card.aspect !== "justice") return [line];
      const taken = Math.min(drop, line.quantity);
      drop -= taken;
      return taken === line.quantity ? [] : [{ ...line, quantity: line.quantity - taken }];
    });
    if (drop > 0) throw new Error("could not shrink the starter deck");
  }
  if (rewards > 0) cards.push({ cardId: REWARD, quantity: rewards });
  return { identityCardId: starter.identityCardId, aspects: starter.aspects, cards };
}
const context = (rule: GrantDeckSize | undefined, copies = 1): DeckContext => ({
  campaign: {
    campaignId: "x-campaign",
    campaignSetIds: [CAMP_SET],
    identityCardId: SPIDER_MAN,
    grantedCardIds: Array.from({ length: copies }, () => REWARD as string),
    ...(rule === undefined || rule === "exempt"
      ? {}
      : { grantDeckSizes: Array.from({ length: copies }, () => ({ cardId: REWARD, deckSize: rule })) }),
  },
});
const problems = (deck: DeckContents, ctx: DeckContext): readonly DeckProblem[] => {
  const verdict = validateDeck(deck, POOL, ctx);
  return verdict.ok ? [] : verdict.problems;
};
const legal = (others: number, rule: GrantDeckSize | undefined): boolean =>
  problems(deckOf(others), context(rule)).length === 0;

describe("validateDeck: a granted copy's deck-size rule", () => {
  it("the fixture: the limits are 40 and 50, and the resized decks are legal on their own", () => {
    expect([DECK_MIN_CARDS, DECK_MAX_CARDS]).toEqual([40, 50]);
    for (const size of [40, 49, 50]) expect(validateDeck(deckOf(size, 0), POOL).ok, `${size}`).toBe(true);
    for (const size of [39, 51]) {
      const verdict = validateDeck(deckOf(size, 0), POOL);
      expect(verdict.ok ? [] : verdict.problems.map((problem) => problem.code), `${size}`).toEqual(["deck_size"]);
    }
  });

  it.each<[string, GrantDeckSize | undefined, Record<number, boolean>]>([
    // other cards:                         39     40    49    50     51
    ["no rule stated (today's)", undefined, { 39: false, 40: true, 49: true, 50: true, 51: false }],
    ["exempt", "exempt", { 39: false, 40: true, 49: true, 50: true, 51: false }],
    ["maximumOnly", "maximumOnly", { 39: false, 40: true, 49: true, 50: false, 51: false }],
    ["counted", "counted", { 39: true, 40: true, 49: true, 50: false, 51: false }],
  ])("%s: which numbers of other cards make a legal deck with one granted reward", (_label, rule, expected) => {
    for (const [others, ok] of Object.entries(expected)) {
      expect(legal(Number(others), rule), `${others} other cards`).toBe(ok);
    }
  });

  it("an illegal size is the only problem, and the default's message is word for word what it was", () => {
    const exempt = problems(deckOf(39), context(undefined));
    expect(exempt).toHaveLength(1);
    expect(exempt[0]).toMatchObject({
      code: "deck_size",
      message:
        "The deck has 39 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
    });
    // Counted like any card: the ordinary message, with the reward in the number.
    expect(problems(deckOf(50), context("counted"))[0]?.message).toBe(
      "The deck has 51 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
    );
  });

  it("maximumOnly says which limit failed and that the reward is why the two counts differ", () => {
    const short = problems(deckOf(39), context("maximumOnly"));
    expect(short.map((problem) => problem.code)).toEqual(["deck_size"]);
    expect(short[0]?.message).toBe(
      "The deck has 39 cards besides 1 campaign card that does not count against the minimum; a deck must have at least 40 (the identity and permanent cards do not count).",
    );
    const over = problems(deckOf(50), context("maximumOnly"));
    expect(over.map((problem) => problem.code)).toEqual(["deck_size"]);
    expect(over[0]?.message).toBe(
      "The deck has 51 cards, counting 1 campaign card that does not count against the minimum; a deck must have at most 50 (the identity and permanent cards do not count).",
    );
  });

  it("the rule is per granted copy: of two granted copies, one counted and one exempt", () => {
    const two = synthetic({ ...reward, deckLimit: 3 });
    const pool = POOL.map((card) => (card.id === REWARD ? two : card));
    const ctx: DeckContext = {
      campaign: {
        campaignId: "x-campaign",
        campaignSetIds: [CAMP_SET],
        identityCardId: SPIDER_MAN,
        grantedCardIds: [REWARD, REWARD],
        grantDeckSizes: [{ cardId: REWARD, deckSize: "counted" }],
      },
    };
    // 39 others + one counted copy = 40 (legal); 50 others + one counted copy = 51 (over), the exempt copy aside.
    expect(validateDeck(deckOf(39, 2), pool, ctx).ok).toBe(true);
    expect(validateDeck(deckOf(50, 2), pool, ctx).ok).toBe(false);
    expect(validateDeck(deckOf(49, 2), pool, ctx).ok).toBe(true);
  });

  it("an ordinary card the campaign granted (an aspect upgrade as a reward) follows the same rule", () => {
    // 51 listed cards, one of them (a filler) granted by the campaign.
    const granted = fillers[0]!.id;
    const verdict = (rule: GrantDeckSize | undefined): boolean =>
      validateDeck(deckOf(51, 0), POOL, {
        campaign: {
          campaignId: "x-campaign",
          campaignSetIds: [CAMP_SET],
          identityCardId: SPIDER_MAN,
          grantedCardIds: [granted],
          ...(rule ? { grantDeckSizes: [{ cardId: granted, deckSize: rule as "counted" | "maximumOnly" }] } : {}),
        },
      }).ok;
    expect(verdict(undefined)).toBe(true);
    expect(verdict("maximumOnly")).toBe(false);
    expect(verdict("counted")).toBe(false);
  });

  it("a rule naming more copies than the deck lists counts only the listed ones; one for a card not granted is ignored", () => {
    const ctx: DeckContext = {
      campaign: {
        campaignId: "x-campaign",
        campaignSetIds: [CAMP_SET],
        identityCardId: SPIDER_MAN,
        grantedCardIds: [REWARD],
        grantDeckSizes: [
          { cardId: REWARD, deckSize: "counted" },
          { cardId: REWARD, deckSize: "counted" },
          { cardId: fillers[0]!.id, deckSize: "maximumOnly" },
        ],
      },
    };
    // 49 others (filler 0 among them, not granted) + the one granted copy, counted once: 50.
    expect(validateDeck(deckOf(49), POOL, ctx).ok).toBe(true);
    expect(validateDeck(deckOf(50), POOL, ctx).ok).toBe(false);
  });
});

// ---- The campaign half --------------------------------------------------------------------------------------

const CAMPAIGN_ID = campaignId("grant-deck-size-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const DEPS: CampaignDeps = { pool: [] };
const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));
const grant = (id: string, card: string, deckSize?: GrantDeckSize): CampaignInstruction => ({
  id,
  text: "test",
  citation: "test",
  step: {
    kind: "betweenGames",
    ops: [
      {
        kind: "grantCard",
        seat: "each",
        card: { kind: "const", value: card },
        permanence: "campaign",
        ...(deckSize ? { deckSize } : {}),
      },
    ],
  },
});
const DEFINITION: CampaignDefinition = {
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  graph: {
    kind: "linear",
    nodes: [
      {
        id: "first",
        label: "First",
        scenario: { kind: "fixed", scenarioId: scenarioId("grant-deck-size-test-scenario") },
        setup: [grant("first.plain", "gift"), grant("first.exempt", "token", "exempt")],
        victory: [grant("first.reward", "upgrade", "maximumOnly"), grant("first.ally", "ally", "counted")],
      },
      {
        id: "second",
        label: "Second",
        scenario: { kind: "fixed", scenarioId: scenarioId("grant-deck-size-test-scenario") },
        setup: [],
        victory: [],
      },
    ],
  },
};
function between(log: CampaignLog): CampaignLog {
  const outcome = resolveBetweenGames(DEFINITION, log, DEPS, MODES, []);
  if (outcome.kind !== "done") throw new Error("unexpected choice");
  return outcome.value;
}
function finish(log: CampaignLog, outcome: "won" | "lost"): CampaignLog {
  const result: CampaignGameResult = {
    nodeId: log.attempt?.nodeId ?? "",
    outcome,
    records: [],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
  const applied = applyCampaignResult(DEFINITION, log, result, { at: 1_700_000_000_000 }, DEPS);
  if (applied.kind !== "done") throw new Error("unexpected choice after the game");
  return applied.value;
}
const newLog = (): CampaignLog =>
  createCampaignLog(DEFINITION, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 3 });

describe("CampaignOp grantCard.deckSize", () => {
  it("a grant with no rule, or the default stated, is recorded exactly as before: no field, and no rules in the game's input", () => {
    const first = between(newLog());
    for (const seat of first.seats) {
      expect(seat.grants).toEqual([
        { cardId: "gift", permanence: "campaign", grantedAtNodeId: "first" },
        { cardId: "token", permanence: "campaign", grantedAtNodeId: "first" },
      ]);
    }
    for (const seat of first.attempt!.input.seats) {
      expect(seat.grantedCardIds).toEqual(["gift", "token"]);
      expect(seat).not.toHaveProperty("grantDeckSizes");
    }
  });

  it("a rule is kept on the grant and reaches the next game's seat input, one entry for each copy that is not exempt", () => {
    const second = between(finish(between(newLog()), "won"));
    expect(second.attempt?.nodeId).toBe("second");
    for (const seat of second.seats) {
      expect(seat.grants.map((entry) => [entry.cardId, entry.deckSize])).toEqual([
        ["gift", undefined],
        ["token", undefined],
        ["upgrade", "maximumOnly"],
        ["ally", "counted"],
      ]);
      expect(grantDeckSizesOf(seat.grants)).toEqual([
        { cardId: "upgrade", deckSize: "maximumOnly" },
        { cardId: "ally", deckSize: "counted" },
      ]);
    }
    for (const seat of second.attempt!.input.seats) {
      expect(seat.grantedCardIds).toEqual(["gift", "token", "upgrade", "ally"]);
      expect(seat.grantDeckSizes).toEqual([
        { cardId: "upgrade", deckSize: "maximumOnly" },
        { cardId: "ally", deckSize: "counted" },
      ]);
    }
  });
});
