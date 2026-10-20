/**
 * Incite, printed When Revealed abilities and surge share one timing, and the players order them (spec
 * docs/phase7-wave11-scenarios.md §S7 E37; owner decision 2026-10-20, revising docs/phase7-wave4.md §4 Q23).
 *
 * Sources: FFG ruling, September 22, 2026 ("Surge, Incite, and 'When Revealed' abilities each share the same timing,
 * which allows players to resolve them in any order"; "an ability that targets a card's 'When Revealed' ability would
 * also include the 'Surge' keyword if on that card"; Enhanced Spider-Sense "cancels the treachery's 'When Revealed'
 * ability ... as well as its 'Surge' keyword"); RRG 1.8 "Reveal" (p. 38, step 3), "Surge" (p. 42), "Incite X"
 * (p. 24), "Simultaneous Resolution" (p. 40: the first player orders).
 */

import { describe, expect, it } from "vitest";
import type { CardId } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { PendingChoice } from "./choices.js";
import type { GameEvent } from "./events.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const DRAW: EffectSpec = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } };

/** Incite 1, surge, "When Revealed: draw 1 card". */
const ORDERED_WR = stubAbility("ordered.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [DRAW] });
const ORDERED = stubTreachery({
  id: "ordered",
  boostIcons: 0,
  abilities: [ORDERED_WR.ref],
  keywords: [{ name: "incite", value: 1 }, { name: "surge" }],
});
/** Incite 1 and surge, no printed ability: nothing to order against. */
const KEYWORDS = stubTreachery({
  id: "keywords",
  boostIcons: 0,
  keywords: [{ name: "incite", value: 1 }, { name: "surge" }],
});
/** A side scheme in play with incite 1, surge and "When Revealed: draw 1 card". */
const SCHEME_WR = stubAbility("loud-scheme.when-revealed", { trigger: { kind: "whenRevealed" }, effects: [DRAW] });
const SCHEME = stubSideScheme({
  id: "loud-scheme",
  startingThreat: 0,
  boostIcons: 0,
  abilities: [SCHEME_WR.ref],
  keywords: [{ name: "incite", value: 1 }, { name: "surge" }],
});

/** "Interrupt: When a treachery is revealed, cancel its When Revealed effects" (Enhanced Spider-Sense's shape). */
const SENSE = stubAbility("sense.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelWhenRevealed" }],
});
const SENSE_CARD = stubSupport({ id: "sense", cost: 0, abilities: [SENSE.ref] });
/** "Forced Interrupt: When the surge keyword would be resolved, cancel it." */
const STOP = stubAbility("stop.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "surgeResolving" } },
  effects: [{ kind: "cancelTriggeringEvent" }],
});
const STOP_CARD = stubSupport({ id: "stop", cost: 0, abilities: [STOP.ref] });

const REVEAL = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
});
const REVEAL_CARD = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL.ref] });
/** "Resolve each 'When Revealed' ability on each side scheme in play" (Citywide Crisis's shape), with an opt-out. */
const resolver = (id: string, excludeKeywords?: readonly ("incite" | "surge")[]) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "resolveSpecials",
        of: { kind: "each", query: { categories: ["sideScheme"] } },
        trigger: "whenRevealed",
        ...(excludeKeywords ? { excludeKeywords } : {}),
      },
    ],
  });
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};
const RESOLVE_ALL = resolver("resolve-all");
const RESOLVE_NO_SURGE = resolver("resolve-no-surge", ["surge"]);

const deps: EngineDeps = depsOf(
  ORDERED_WR,
  SCHEME_WR,
  SENSE,
  STOP,
  REVEAL,
  RESOLVE_ALL.ability,
  RESOLVE_NO_SURGE.ability,
);
const CARDS = [ORDERED, KEYWORDS, SCHEME, SENSE_CARD, STOP_CARD, REVEAL_CARD, RESOLVE_ALL.card, RESOLVE_NO_SURGE.card];

function table(top: CardId | null, opts: { players?: 1 | 2; sense?: boolean; stop?: boolean } = {}): GameState {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: opts.players ?? 1,
    encounter: [ORDERED.id, KEYWORDS.id, SCHEME.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [REVEAL_CARD.id, SENSE_CARD.id, STOP_CARD.id, RESOLVE_ALL.card.id, RESOLVE_NO_SURGE.card.id],
  });
  const sensed = opts.sense ? playerCardIntoPlay(base, SENSE_CARD.id, P1).state : base;
  const state = opts.stop ? playerCardIntoPlay(sensed, STOP_CARD.id, P1).state : sensed;
  return top ? onTopOfEncounterDeck(state, top) : state;
}

/** `player` plays `card` (a 0-cost event) and every choice is answered by `pick`; the asked choices are recorded. */
function play(state: GameState, card: CardId, pick: (s: GameState) => readonly string[], player = P1) {
  const asked: PendingChoice[] = [];
  const recording = (s: GameState) => {
    if (s.pendingChoice) asked.push(s.pendingChoice);
    return pick(s);
  };
  const given = giveCard(state, player, card);
  const run = runCommandsPicking(given.state, deps, recording, {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  return { ...run, asked };
}

/** Orders a When Revealed choice as `order` lists (option ids, by prefix match); accepts every optional trigger. */
const ordering =
  (...order: readonly string[]) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    if (choice?.prompt.kind === "orderWhenRevealed" || choice?.prompt.kind === "orderSpecials")
      return order.map((part) => choice.options.find((o) => o.optionId.endsWith(part))!.optionId);
    return defaultPick(state);
  };

/** The order the three When Revealed abilities of `source` resolved in, read off the log. */
function resolutionOrder(state: GameState, events: readonly GameEvent[], source: CardId): string[] {
  const id = Object.values(state.instances).find((i) => i.cardId === source)!.instanceId;
  return events.flatMap((e) =>
    e.type === "threatPlaced" && e.sourceInstanceId === id
      ? ["incite"]
      : e.type === "cardDrawn"
        ? ["printed"]
        : e.type === "surgeTriggered" && e.instanceId === id
          ? ["surge"]
          : [],
  );
}
const asks = (asked: readonly PendingChoice[], kind: PendingChoice["prompt"]["kind"]) =>
  asked.filter((c) => c.prompt.kind === kind);

describe("reveal step 3: incite, the printed When Revealed and surge in the players' order (E37)", () => {
  it("the first player is offered all three, in the card's order first; taking it is incite, printed, surge", () => {
    const { state, events, asked } = play(
      table(ORDERED.id),
      REVEAL_CARD.id,
      ordering("incite", "when-revealed", "surge"),
    );
    const [choice] = asks(asked, "orderWhenRevealed");
    expect(choice?.playerId).toBe(P1);
    expect(choice?.authority).toBe("firstPlayerOrders");
    expect(choice?.options.map((o) => o.optionId)).toEqual(["incite", "ordered.when-revealed", "surge"]);
    expect(resolutionOrder(state, events, ORDERED.id)).toEqual(["incite", "printed", "surge"]);
  });

  it("the player may resolve surge before the printed ability (and the incite last): surge resolves once", () => {
    const { state, events } = play(table(ORDERED.id), REVEAL_CARD.id, ordering("surge", "when-revealed", "incite"));
    // One surge (one card dealt), not a second one at the end of step 3.
    expect(resolutionOrder(state, events, ORDERED.id)).toEqual(["surge", "printed", "incite"]);
  });

  it("with a second player revealing, the first player orders (RRG 1.8 'Simultaneous Resolution', p. 40)", () => {
    const { asked } = play(
      table(ORDERED.id, { players: 2 }),
      REVEAL_CARD.id,
      ordering("incite", "when-revealed", "surge"),
      P2,
    );
    expect(asks(asked, "orderWhenRevealed").map((c) => c.playerId)).toEqual([P1]);
  });

  it("incite and surge with no printed ability: nothing to order, nobody is asked", () => {
    const { state, events, asked } = play(table(KEYWORDS.id), REVEAL_CARD.id, ordering());
    expect(asks(asked, "orderWhenRevealed")).toEqual([]);
    expect(resolutionOrder(state, events, KEYWORDS.id)).toEqual(["incite", "surge"]);
  });

  it("a surge ordered before the printed ability is cancelled in its own 'would be resolved' window; the rest resolve", () => {
    const { state, events } = play(
      table(ORDERED.id, { stop: true }),
      REVEAL_CARD.id,
      ordering("surge", "when-revealed", "incite"),
    );
    expect(resolutionOrder(state, events, ORDERED.id)).toEqual(["printed", "incite"]);
    // Cancelled, it is not resolved again at the end of step 3.
    expect(events.filter((e) => e.type === "surgeTriggered")).toEqual([]);
  });

  it("surge cancellation: cancelling the When Revealed (Enhanced Spider-Sense) cancels incite and surge too", () => {
    const { state, events, asked } = play(table(ORDERED.id, { sense: true }), REVEAL_CARD.id, ordering());
    expect(asks(asked, "orderWhenRevealed")).toEqual([]);
    expect(resolutionOrder(state, events, ORDERED.id)).toEqual([]);
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(1);
  });
});

describe("resolving another card's When Revealed abilities includes its incite and surge (E37)", () => {
  const withScheme = () => encounterCardInVillainArea(table(null), SCHEME.id).state;

  it("all three resolve, in the order chosen: here surge, printed, incite", () => {
    const { state, events, asked } = play(
      withScheme(),
      RESOLVE_ALL.card.id,
      ordering("surge", "when-revealed", "incite"),
    );
    const [choice] = asks(asked, "orderSpecials");
    expect(choice?.options.map((o) => o.optionId.split(":")[1])).toEqual([
      "incite",
      "loud-scheme.when-revealed",
      "surge",
    ]);
    expect(resolutionOrder(state, events, SCHEME.id)).toEqual(["surge", "printed", "incite"]);
  });

  it("an encounter card's abilities are ordered by the first player, even when the second player resolves them", () => {
    const state = encounterCardInVillainArea(table(null, { players: 2 }), SCHEME.id).state;
    const { asked } = play(state, RESOLVE_ALL.card.id, ordering("incite", "when-revealed", "surge"), P2);
    const [choice] = asks(asked, "orderSpecials");
    expect(choice?.playerId).toBe(P1);
    expect(choice?.authority).toBe("firstPlayerOrders");
  });

  it("`excludeKeywords: ['surge']` (Change of Venue's 'non-surge'): incite and the printed ability, no surge", () => {
    const { state, events } = play(withScheme(), RESOLVE_NO_SURGE.card.id, ordering("incite", "when-revealed"));
    expect(resolutionOrder(state, events, SCHEME.id)).toEqual(["incite", "printed"]);
  });
});
