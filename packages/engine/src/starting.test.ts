/**
 * The Starting keyword (docs/phase7-wave11.md §3.6; hero-pack spec H3.17, HT12). RRG 1.8 has no entry; the Fear No
 * Evil rulebook (MC60 p. 3): "Each deck cannot include more than one card with starting. Before drawing their starting
 * hand during player setup, each player with a starting card in their deck may search their deck for that card and add
 * it as the first card of their starting hand. That card does count against their hand size and can be discarded for
 * the mulligan." RRG 1.8 Appendix II step 14 (p. 51) is the draw it precedes; "Search" (p. 39) shuffles the deck.
 *
 * The setup step runs over synthetic cards; the deck check over the real Innate Reflexes (60038) and Echo's precon.
 */

import {
  cardId,
  FNE_STARTER_DECKS,
  WAVE11_CARDS,
  type AnyCard,
  type CardId,
  type DeckContents,
  type HeroIdentityCard,
} from "@mc/content";
import { describe, expect, it } from "vitest";
import { DEFAULT_DEPS } from "./abilities.js";
import { validateDeck, type DeckProblem } from "./deck.js";
import { sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { handSize, mustPlayer } from "./query.js";
import type { ResolvedInstruction } from "./campaign.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { syntheticCampaignInput, syntheticInstruction } from "./testing/campaign.js";
import { stubEvent } from "./testing/fixtures.js";
import { ALLY, HERO, newGameAtMulligan, RESOURCE, seatIdentities, UPGRADE } from "./testing/scenario.js";

const STARTING = stubEvent({ id: "starting-event", cost: 1, keywords: [{ name: "starting" }] });
const repeat = (id: CardId, count: number): readonly CardId[] => Array.from({ length: count }, () => id);
const DECK_WITH_STARTING = [STARTING.id, ...repeat(RESOURCE.id, 11), ...repeat(ALLY.id, 6), ...repeat(UPGRADE.id, 6)];
const DECK_WITHOUT = [...repeat(RESOURCE.id, 12), ...repeat(ALLY.id, 6), ...repeat(UPGRADE.id, 6)];

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const isStarting = (state: GameState, id: InstanceId): boolean => state.instances[id]?.cardId === STARTING.id;

interface Run {
  session: GameSession;
  events: GameEvent[];
}
function answer(run: Run, selected: readonly string[]): void {
  const choice = run.session.state.pendingChoice;
  if (!choice) throw new Error("no choice is open");
  const result = sessionApply(
    run.session,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
    DEFAULT_DEPS,
  );
  if (!result.ok) throw new Error(result.error.message);
  run.session = result.session;
  run.events.push(...result.events);
}
function start(deck: readonly CardId[], players = 1): { run: Run; created: GameState } {
  const created = newGameAtMulligan({ players, deck, extraCards: [STARTING] });
  return { run: { session: startSession(created), events: [] }, created };
}
const state = (run: Run): GameState => run.session.state;
const p = (s: GameState, seat: number): PlayerId => s.players[seat]!.playerId;

describe("Starting: the setup search before the starting hand (MC60 p. 3)", () => {
  it("control: a deck without a Starting card is asked nothing and draws its hand size, straight to the mulligan", () => {
    const { created } = start(DECK_WITHOUT);
    const p1 = p(created, 0);
    expect(created.pendingChoice?.prompt.kind).toBe("mulligan");
    expect(created.step).toEqual(expect.objectContaining({ kind: "mulligan" }));
    expect(mustPlayer(created, p1).hand).toHaveLength(handSize(created, p1, DEFAULT_DEPS));
  });

  it("offers the Starting card before any card is drawn; taking it draws hand size - 1, and it counts toward hand size", () => {
    const { run, created } = start(DECK_WITH_STARTING);
    const p1 = p(created, 0);
    const choice = created.pendingChoice!;
    expect(choice.prompt).toEqual({ kind: "takeStartingCard" });
    expect(choice.playerId).toBe(p1);
    expect([choice.minSelections, choice.maxSelections]).toEqual([0, 1]);
    expect(mustPlayer(created, p1).hand).toHaveLength(0);
    expect(choice.options).toHaveLength(1);
    expect(isStarting(created, choice.options[0]!.optionId as InstanceId)).toBe(true);

    answer(run, [choice.options[0]!.optionId]);
    const after = state(run);
    const size = handSize(after, p1, DEFAULT_DEPS);
    expect(size).toBe(6); // Setup is played in alter-ego form.
    const hand = mustPlayer(after, p1).hand;
    expect(hand).toHaveLength(size);
    // Part of the starting hand, and the draw was one card short of hand size.
    expect(hand.filter((id) => isStarting(after, id))).toHaveLength(1);
    expect(of(run.events, "cardDrawn").filter((e) => e.playerId === p1)).toHaveLength(size - 1);
    expect(of(run.events, "startingHandCreditApplied")).toEqual([
      { type: "startingHandCreditApplied", playerId: p1, handSize: size, credit: 1, drawn: size - 1 },
    ]);
    // Searched, so shuffled (RRG 1.8 "Search", p. 39), and before the draw.
    const shuffled = run.events.findIndex((e) => e.type === "deckShuffled");
    const firstDraw = run.events.findIndex((e) => e.type === "cardDrawn");
    expect(shuffled).toBeGreaterThanOrEqual(0);
    expect(shuffled).toBeLessThan(firstDraw);
    expect(mustPlayer(after, p1).startingHandCredit).toBeUndefined();
    expect(after.pendingChoice?.prompt.kind).toBe("mulligan");
  });

  it("declining searches nothing: no shuffle, a full draw of hand size", () => {
    const { run, created } = start(DECK_WITH_STARTING);
    const p1 = p(created, 0);
    answer(run, []);
    const after = state(run);
    expect(of(run.events, "deckShuffled")).toHaveLength(0);
    expect(of(run.events, "startingHandCredited")).toHaveLength(0);
    expect(of(run.events, "cardDrawn").filter((e) => e.playerId === p1)).toHaveLength(
      handSize(after, p1, DEFAULT_DEPS),
    );
    expect(after.pendingChoice?.prompt.kind).toBe("mulligan");
  });

  it("the mulligan may discard it, and the draw back up treats it as any other hand card", () => {
    const { run, created } = start(DECK_WITH_STARTING);
    const p1 = p(created, 0);
    answer(run, [created.pendingChoice!.options[0]!.optionId]);
    const mulligan = state(run).pendingChoice!;
    const startingOption = mulligan.options.find((o) => isStarting(state(run), o.optionId as InstanceId));
    expect(startingOption).toBeDefined();
    answer(run, [startingOption!.optionId]);
    const after = state(run);
    expect(mustPlayer(after, p1).discard.some((id) => isStarting(after, id))).toBe(true);
    expect(mustPlayer(after, p1).hand).toHaveLength(handSize(after, p1, DEFAULT_DEPS));
  });

  it("players are offered in player order, and only those with a Starting card in their deck", () => {
    const created = newGameAtMulligan({ players: 2, deck: DECK_WITH_STARTING, extraCards: [STARTING] });
    const run: Run = { session: startSession(created), events: [] };
    const [p1, p2] = [p(created, 0), p(created, 1)];
    expect(created.pendingChoice?.playerId).toBe(p1);
    answer(run, [created.pendingChoice!.options[0]!.optionId]);
    // Nobody has drawn yet: step 14 waits for every player's Starting choice.
    expect(of(run.events, "cardDrawn")).toHaveLength(0);
    expect(state(run).pendingChoice?.prompt.kind).toBe("takeStartingCard");
    expect(state(run).pendingChoice?.playerId).toBe(p2);
    answer(run, []);
    const after = state(run);
    expect(of(run.events, "cardDrawn").filter((e) => e.playerId === p1)).toHaveLength(5);
    expect(of(run.events, "cardDrawn").filter((e) => e.playerId === p2)).toHaveLength(6);
    expect(after.pendingChoice?.prompt.kind).toBe("mulligan");
  });
});

/** A campaign game whose setup resolves `instructions` (synthetic campaign, every seat on `deck`). */
function startCampaign(deck: readonly CardId[], players: number, instructions: readonly ResolvedInstruction[]): Run {
  const created = newGameAtMulligan({
    players,
    deck,
    extraCards: [STARTING],
    campaign: syntheticCampaignInput({
      instructions,
      seats: seatIdentities(HERO, players).map((identity, seat) => ({
        seatNumber: seat + 1,
        identityCardId: identity.id,
        deck: [],
        aspects: [],
        grantedCardIds: [],
      })),
    }),
  });
  return { session: startSession(created), events: [] };
}

describe("Starting with other setup rules", () => {
  it("adds to a campaign's countTowardStartingHand credit: credit 2, a draw of hand size - 2", () => {
    const credit: EffectSpec = {
      kind: "countTowardStartingHand",
      player: { kind: "each" },
      amount: { kind: "const", value: 1 },
    };
    const run = startCampaign(DECK_WITH_STARTING, 1, [syntheticInstruction("credit", "afterScenarioSetup", [credit])]);
    const p1 = p(state(run), 0);
    expect(mustPlayer(state(run), p1).startingHandCredit).toBe(1);
    expect(state(run).pendingChoice?.prompt.kind).toBe("takeStartingCard");
    answer(run, [state(run).pendingChoice!.options[0]!.optionId]);
    const size = handSize(state(run), p1, DEFAULT_DEPS);
    expect(of(run.events, "startingHandCredited")).toEqual([
      { type: "startingHandCredited", playerId: p1, amount: 1, credit: 2 },
    ]);
    expect(of(run.events, "startingHandCreditApplied")).toEqual([
      { type: "startingHandCreditApplied", playerId: p1, handSize: size, credit: 2, drawn: size - 2 },
    ]);
    expect(of(run.events, "cardDrawn").filter((e) => e.playerId === p1)).toHaveLength(size - 2);
  });

  it("a seat sitting the scenario out is not offered its Starting card", () => {
    const created = newGameAtMulligan({ players: 2, deck: DECK_WITH_STARTING, extraCards: [STARTING] });
    const p2 = p(created, 1);
    const sitOut: EffectSpec = { kind: "sitOutScenario", player: { kind: "id", playerId: p2 } };
    const run = startCampaign(DECK_WITH_STARTING, 2, [syntheticInstruction("out", "beforeScenarioSetup", [sitOut])]);
    expect(mustPlayer(state(run), p2).eliminated).toBe(true);
    const offer = state(run).pendingChoice!;
    expect(offer.prompt.kind).toBe("takeStartingCard");
    expect(offer.playerId).toBe(p(state(run), 0));
    answer(run, []);
    expect(state(run).pendingChoice?.prompt.kind).toBe("mulligan");
    expect(of(run.events, "cardDrawn").filter((e) => e.playerId === p2)).toHaveLength(0);
  });
});

describe("Starting in Echo's precon (fne-echo-protection, MC60 p. 25)", () => {
  // Setup is played alter-ego side up (RRG 1.8 Appendix II), and Maya Lopez's hand size is 6, so Echo draws 5 more.
  // The wave spec's "draws 4 more (hand size 5)" reads Echo's hero-side hand size.
  it("offers Innate Reflexes (60038); taking it, Maya Lopez draws 5 more for her hand size of 6", () => {
    const precon = FNE_STARTER_DECKS.find((d) => d.id === "fne-echo-protection")!;
    const echo = WAVE11_CARDS.find((c) => c.id === precon.identityCardId) as HeroIdentityCard;
    const extras = WAVE11_CARDS.filter((c) => c.id !== echo.id && !["res", "ally", "upgrade"].includes(c.id));
    const created = newGameAtMulligan({
      identity: echo,
      extraCards: extras,
      deck: precon.cards.flatMap((line) => repeat(line.cardId, line.quantity)),
    });
    const run: Run = { session: startSession(created), events: [] };
    const p1 = p(created, 0);
    const offer = created.pendingChoice!;
    expect(offer.prompt.kind).toBe("takeStartingCard");
    expect(offer.options.map((o) => o.label)).toEqual(["Innate Reflexes"]);
    answer(run, [offer.options[0]!.optionId]);
    const after = state(run);
    expect(handSize(after, p1, DEFAULT_DEPS)).toBe(6);
    expect(of(run.events, "cardDrawn").filter((e) => e.playerId === p1)).toHaveLength(5);
    const hand = mustPlayer(after, p1).hand.map((id) => after.instances[id]!.cardId as string);
    expect(hand).toContain("60038");
    expect(hand.length).toBeLessThanOrEqual(6); // an obligation drawn goes into play instead
    expect(after.pendingChoice?.prompt.kind).toBe("mulligan");
  });
});

describe("Starting: one per deck (validateDeck, MC60 p. 3)", () => {
  const echo = FNE_STARTER_DECKS.find((d) => d.id === "fne-echo-protection")!;
  const deck = (extra: DeckContents["cards"] = []): DeckContents => ({
    identityCardId: echo.identityCardId,
    aspects: echo.aspects,
    cards: [...echo.cards, ...extra],
  });
  const second: AnyCard = { ...STARTING, id: cardId("x-second-starting"), name: "Second Starting", aspect: "basic" };
  const pool = [...WAVE11_CARDS, second];
  const startingProblems = (contents: DeckContents): readonly DeckProblem[] => {
    const verdict = validateDeck(contents, pool);
    return verdict.ok ? [] : verdict.problems.filter((problem) => problem.code === "starting_limit");
  };

  it("control: Echo's precon, with Innate Reflexes as its one Starting card, is legal", () => {
    expect(echo.cards.some((line) => line.cardId === "60038")).toBe(true);
    expect(validateDeck(deck(), pool)).toEqual({ ok: true });
  });

  it("a second Starting card is refused, naming both", () => {
    expect(startingProblems(deck([{ cardId: second.id, quantity: 1 }]))).toEqual([
      {
        code: "starting_limit",
        message:
          "A deck may include only one card with the Starting keyword; this deck has 2 (Innate Reflexes, Second Starting).",
        cardIds: [cardId("60038"), second.id],
      },
    ]);
  });

  it("two copies of one Starting card are two cards", () => {
    const twice = deck().cards.map((line) => (line.cardId === "60038" ? { ...line, quantity: 2 } : line));
    const [problem] = startingProblems({ ...deck(), cards: twice });
    expect(problem?.message).toBe(
      "A deck may include only one card with the Starting keyword; this deck has 2 (Innate Reflexes ×2).",
    );
  });
});
