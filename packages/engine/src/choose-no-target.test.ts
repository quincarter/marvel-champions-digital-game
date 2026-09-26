/**
 * An ability whose required choice has nothing to choose, and the printed "Then".
 *
 * - RRG 1.8 "Choose (Game Element)" (p. 12): "If a player card ability requires the choosing of one or more targets,
 *   and there are no valid targets for any part of the ability, the ability cannot be initiated."
 * - "Target" (pp. 42–43): an ability that requires a target "can only be initiated if it has at least one valid
 *   target"; "Abilities that cause a player to draw one or more cards always have a valid target so long as that
 *   player has at least one card in their deck"; "An ability with a search effect requires only a searchable game area
 *   in order to initiate".
 * - "'Then'" (p. 44): "If the pre-'then' text of an effect does not fully resolve, the post-'then' text does not
 *   attempt to resolve."
 *
 * Synthetic events shaped like Quinjet (03019), Aamir Khan (05006) and Sanctum Sanctorum (09008). PLAN.md's wave 1 gap
 * pass note ("a targeted ability with no legal target is still offered and still runs its 'Then'").
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const you = { kind: "controller" } as const;
const chosen = (slot: string) => ({ kind: "ref", ref: { kind: "slot", slot } }) as const;
const zone = (name: "hand" | "discard" | "deck", filter?: { name: string }): CardSelector => ({
  kind: "zone",
  zone: name,
  player: you,
  ...(filter ? { filter } : {}),
});
/** The card the choices look for, by name. */
const WIDGET = stubEvent({ id: "widget", cost: 9 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const chooseWidget = (from: CardSelector, min = 1): EffectSpec => ({
  kind: "chooseCards",
  slot: "widget",
  from,
  chooser: you,
  min,
  max: 1,
});

/** Quinjet's shape: "Put a widget from your hand into play. Then, draw 2 cards." */
const THEN_DRAW = actionEvent("then-draw", [
  chooseWidget(zone("hand", { name: "widget" })),
  { kind: "moveCards", cards: chosen("widget"), to: "discard" },
  { kind: "then", effects: [{ kind: "draw", player: you, amount: n(2) }] },
]);
/** Sanctum Sanctorum's shape: "Shuffle a widget from your discard pile into your deck and draw 1 card." */
const AND_DRAW = actionEvent("and-draw", [
  chooseWidget(zone("discard", { name: "widget" })),
  { kind: "moveCards", cards: chosen("widget"), to: "deckShuffle" },
  { kind: "draw", player: you, amount: n(1) },
]);
/** The choice is the whole ability. */
const ONLY_CHOICE = actionEvent("only-choice", [
  chooseWidget(zone("hand", { name: "widget" })),
  { kind: "moveCards", cards: chosen("widget"), to: "discard" },
]);
/** "Choose any number of widgets in your hand" (`min: 0`). */
const ANY_NUMBER = actionEvent("any-number", [
  chooseWidget(zone("hand", { name: "widget" }), 0),
  { kind: "moveCards", cards: chosen("widget"), to: "discard" },
]);
/** "Search your deck for a widget and add it to your hand." */
const SEARCH = actionEvent("search", [
  chooseWidget(zone("deck", { name: "widget" })),
  { kind: "moveCards", cards: chosen("widget"), to: "hand" },
]);
/** "Deal 1 damage to up to 1 minion." */
const UP_TO = actionEvent("up-to", [
  {
    kind: "chooseTarget",
    slot: "minion",
    chooser: you,
    query: { categories: ["minion"] },
    upTo: true,
  },
  { kind: "dealDamage", target: { kind: "slot", slot: "minion" }, amount: n(1) },
]);
/**
 * The choice empties while the ability resolves: the first effect discards every widget in hand, so the later choice
 * finds none, and its "Then" is skipped.
 */
const EMPTIED = actionEvent("emptied", [
  { kind: "moveCards", cards: zone("hand", { name: "widget" }), to: "discard" },
  chooseWidget(zone("hand", { name: "widget" })),
  { kind: "moveCards", cards: chosen("widget"), to: "discard" },
  { kind: "then", effects: [{ kind: "draw", player: you, amount: n(2) }] },
]);
/** An encounter card resolves as far as it can: "Deal 1 damage to a minion. Place 2 threat on the main scheme." */
const REVEALED = stubAbility("revealed.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "chooseTarget", slot: "minion", chooser: you, query: { categories: ["minion"] } },
    { kind: "dealDamage", target: { kind: "slot", slot: "minion" }, amount: n(1) },
    { kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(2) },
  ],
});
const REVEALED_CARD = stubTreachery({ id: "revealed", boostIcons: 0, abilities: [REVEALED.ref] });
const REVEAL = actionEvent("reveal", [{ kind: "revealEncounterCard", player: you }]);

const EVENTS = [THEN_DRAW, AND_DRAW, ONLY_CHOICE, ANY_NUMBER, SEARCH, UP_TO, EMPTIED, REVEAL];
const deps: EngineDeps = depsOf(REVEALED, ...EVENTS.map((e) => e.ability));
const ENCOUNTER: readonly CardId[] = copiesOf(REVEALED_CARD.id, 20);

/** The first turn, with no widget in hand or discard pile (the widgets wait in the deck for `giveCard`). */
function start(): GameState {
  const state = gameAtFirstTurn({
    cards: [WIDGET, REVEALED_CARD, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: ENCOUNTER,
    deck: [...copiesOf(WIDGET.id, 4), ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const isWidget = (id: InstanceId) => state.instances[id]?.cardId === WIDGET.id;
  const seat = mustPlayer(state, P1);
  const stray = [...seat.hand, ...seat.discard].filter(isWidget);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: p.hand.filter((id) => !isWidget(id)),
            discard: p.discard.filter((id) => !isWidget(id)),
            deck: [...p.deck, ...stray],
          }
        : p,
    ),
  };
}

/** Plays `card` from `player`'s hand for 0, returning the engine's answer (nothing is resolved). */
function attempt(state: GameState, card: CardId, player: PlayerId = P1) {
  const given = giveCard(state, player, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  return { given, result };
}
const offered = (state: GameState, id: InstanceId): boolean => {
  const legal = legalActions(state, P1, deps);
  return legal.kind === "turn" && legal.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
};
const handSize = (state: GameState) => mustPlayer(state, P1).hand.length;
const widgetsIn = (state: GameState, where: "hand" | "discard") =>
  mustPlayer(state, P1)[where].filter((id) => state.instances[id]?.cardId === WIDGET.id).length;

describe("a required choice with nothing to choose", () => {
  it("an ability whose only part is the choice cannot be played, and is not offered", () => {
    const { given, result } = attempt(start(), ONLY_CHOICE.card.id);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(offered(given.state, given.id)).toBe(false);
  });

  it("…nor can one whose other part is post-'Then' text (Quinjet)", () => {
    const { given, result } = attempt(start(), THEN_DRAW.card.id);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(offered(given.state, given.id)).toBe(false);
  });

  it("with a widget to choose, the choice resolves and so does its 'Then'", () => {
    const withWidget = giveCard(start(), P1, WIDGET.id).state;
    const before = handSize(withWidget);
    const { state } = playFree(withWidget, deps, THEN_DRAW.card.id);
    expect(widgetsIn(state, "discard")).toBe(1);
    // The widget left the hand and 2 cards were drawn (the played event was given, then left too).
    expect(handSize(state)).toBe(before - 1 + 2);
  });

  it("an ability with a part of its own still initiates and resolves that part (Sanctum Sanctorum's 'and draw')", () => {
    const state = start();
    const { result } = attempt(state, AND_DRAW.card.id);
    expect(result.ok).toBe(true);
    const before = handSize(state);
    expect(handSize(playFree(state, deps, AND_DRAW.card.id).state)).toBe(before + 1);
  });

  it("a choice that empties while the ability resolves skips its 'Then', and the log says so", () => {
    const withWidget = giveCard(start(), P1, WIDGET.id).state;
    const before = handSize(withWidget);
    const { state, events } = playFree(withWidget, deps, EMPTIED.card.id);
    expect(handSize(state)).toBe(before - 1);
    expect(events).toContainEqual({ type: "choiceFoundNothing", slot: "widget" });
    expect(events).toContainEqual({ type: "thenSkipped" });
  });

  it("'any number', 'up to' and a search never require a target", () => {
    for (const event of [ANY_NUMBER, UP_TO, SEARCH]) {
      const { result } = attempt(start(), event.card.id);
      expect(result.ok).toBe(true);
    }
  });

  it("an encounter card resolves as far as it can", () => {
    const state = start();
    const threat = mustInstance(state, state.mainScheme.instanceId).threat;
    const { state: after } = playFree(state, deps, REVEAL.card.id);
    expect(mustInstance(after, after.mainScheme.instanceId).threat).toBe(threat + 2);
  });
});
