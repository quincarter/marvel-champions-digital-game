/**
 * The printed "Then" beyond a required choice: every other way the text before a "then" can fail to fully resolve
 * (`PreThenFailure`, `resolve/then.ts`).
 *
 * RRG 1.8 "'Then'" (p. 44): "If the pre-'then' text of an effect does not fully resolve, the post-'then' text does not
 * attempt to resolve." Also "Encounter Deck" (p. 17: a "discard until" that empties the encounter deck is "fulfilled"),
 * "Cancel" (p. 11), "Stun"/"Confuse" (pp. 41, 13: the status is removed instead of the activation) and "Resolve"
 * (p. 37: an ability all of whose effects are cancelled is not considered to have resolved).
 *
 * Synthetic cards shaped like Call for Aid (12015), Legions of Hydra (01180), Honor Among Thieves (16141), Cosmic Ward
 * (21036), Held Hostage (07005) and Crowbar Toss (07012). Each post-"then" part places 7 threat on the main scheme, so
 * whether it ran is one number.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const you = { kind: "controller" } as const;
const chosen = (slot: string) => ({ kind: "ref", ref: { kind: "slot", slot } }) as const;
const THEN_THREAT: EffectSpec = {
  kind: "then",
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(7) }],
};

const WIDGET = stubEvent({ id: "widget", cost: 9 });
const MINION = stubMinion({ id: "then-minion", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const LOCKED_REVEALED = stubAbility("locked.when-revealed", {
  trigger: { kind: "whenRevealed" },
  uncancellable: true,
  effects: [],
});
const LOCKED = stubTreachery({ id: "locked", boostIcons: 0, abilities: [LOCKED_REVEALED.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};

/** "Search your deck for a widget and discard it. Then, …" */
const SEARCH = actionEvent("then-search", [
  {
    kind: "chooseCards",
    slot: "w",
    from: { kind: "zone", zone: "deck", player: you, filter: { name: "widget" } },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "moveCards", cards: chosen("w"), to: "discard" },
  THEN_THREAT,
]);
/** The same search as a `selectCards` (Legions of Hydra's "search … for Madame Hydra and put her into play"). */
const SELECT = actionEvent("then-select", [
  { kind: "selectCards", slot: "w", cards: { kind: "zone", zone: "deck", player: you, filter: { name: "widget" } } },
  { kind: "moveCards", cards: chosen("w"), to: "discard" },
  THEN_THREAT,
]);
/** "Discard cards from the top of your deck until you discard a widget, then …" (Call for Aid). */
const DISCARD_UNTIL = actionEvent("then-discard-until", [
  { kind: "discardDeckUntil", player: you, filter: { name: "widget" }, bind: "w" },
  { kind: "moveCards", cards: chosen("w"), to: "hand" },
  THEN_THREAT,
]);
/** "Discard cards from the top of the encounter deck until a minion is discarded. Reveal it, then …" (Honor Among Thieves). */
const REVEAL_UNTIL = actionEvent("then-reveal-until", [
  { kind: "discardEncounterUntil", filter: { categories: ["minion"] }, bind: "m" },
  { kind: "revealCard", cards: { kind: "slot", slot: "m" }, player: you },
  THEN_THREAT,
]);
/** "The villain attacks you. Then, …" (Held Hostage). */
const ATTACK = actionEvent("then-attack", [
  { kind: "enemyAttack", enemies: { kind: "villain" }, against: you },
  THEN_THREAT,
]);
/** "Each minion attacks you. Then, …" with no minion in play: vacuously resolved. */
const EACH_ATTACK = actionEvent("then-each-attack", [
  { kind: "enemyAttack", enemies: { kind: "each", query: { categories: ["minion"] } }, against: you },
  THEN_THREAT,
]);
/** "The villain schemes. Then, …" (Crowbar Toss). */
const SCHEME = actionEvent("then-scheme", [{ kind: "enemyScheme", enemies: { kind: "villain" } }, THEN_THREAT]);
/** "Reveal the top card of the encounter deck." */
const REVEAL = actionEvent("then-reveal", [{ kind: "revealEncounterCard", player: you }]);

/** "Forced Interrupt: When a card is revealed, cancel its effects and discard it. Then, …" (Cosmic Ward). */
const WARD_INTERRUPT = stubAbility("ward.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelRevealedCard" }, THEN_THREAT],
});
const WARD = stubSupport({ id: "ward", cost: 0, abilities: [WARD_INTERRUPT.ref] });
/** The same cancel with no "then" of its own, to cancel a reveal another card's "then" waits on. */
const SHIELD_INTERRUPT = stubAbility("shield.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "encounterCardRevealing", targetIs: { name: "then-minion" } } },
  effects: [{ kind: "cancelRevealedCard" }],
});
const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_INTERRUPT.ref] });
/** Two cancels of the same reveal in one program: the second has nothing left to cancel. */
const TWICE_INTERRUPT = stubAbility("twice.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "encounterCardRevealing" } },
  effects: [{ kind: "cancelRevealedCard" }, { kind: "cancelRevealedCard" }, THEN_THREAT],
});
const TWICE = stubSupport({ id: "twice", cost: 0, abilities: [TWICE_INTERRUPT.ref] });

const EVENTS = [SEARCH, SELECT, DISCARD_UNTIL, REVEAL_UNTIL, ATTACK, EACH_ATTACK, SCHEME, REVEAL];
const deps: EngineDeps = depsOf(
  LOCKED_REVEALED,
  WARD_INTERRUPT,
  SHIELD_INTERRUPT,
  TWICE_INTERRUPT,
  ...EVENTS.map((e) => e.ability),
);

function start(options: { widgets?: number; encounter?: readonly CardId[] } = {}): GameState {
  return gameAtFirstTurn({
    cards: [WIDGET, MINION, BLANK, LOCKED, WARD, SHIELD, TWICE, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: options.encounter ?? copiesOf(BLANK.id, 12),
    deck: [
      ...copiesOf(WIDGET.id, options.widgets ?? 0),
      WARD.id,
      SHIELD.id,
      TWICE.id,
      ...EVENTS.flatMap((e) => copiesOf(e.card.id, 1)),
    ],
  });
}

/** Every widget out of the game's player zones (they only exist if `start` put some in the deck). */
function noWidgets(state: GameState): GameState {
  const isWidget = (id: InstanceId) => state.instances[id]?.cardId === WIDGET.id;
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: p.hand.filter((id) => !isWidget(id)),
      deck: p.deck.filter((id) => !isWidget(id)),
      discard: p.discard.filter((id) => !isWidget(id)),
    })),
  };
}

const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const skipped = (events: readonly GameEvent[]) => events.some((e) => e.type === "thenSkipped");
const causes = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "preThenUnresolved" ? [e.cause] : []));

function withVillainStatus(state: GameState, status: "stunned" | "confused"): GameState {
  const villain = mustInstance(state, state.activeVillainId);
  return {
    ...state,
    instances: {
      ...state.instances,
      [villain.instanceId]: { ...villain, statuses: { ...villain.statuses, [status]: 1 } },
    },
  };
}

describe("a search or 'discard until' that finds nothing", () => {
  it("a search (chooseCards over a deck) that finds nothing skips its 'Then'", () => {
    const state = noWidgets(start());
    const { state: after, events } = playFree(state, deps, SEARCH.card.id);
    expect(threat(after)).toBe(threat(state));
    expect(causes(events)).toEqual(["searchFoundNothing"]);
    expect(skipped(events)).toBe(true);
  });

  it("…and one that finds its card runs it", () => {
    const state = start({ widgets: 12 });
    const { state: after, events } = playFree(state, deps, SEARCH.card.id);
    expect(threat(after)).toBe(threat(state) + 7);
    expect(skipped(events)).toBe(false);
  });

  it("a selectCards search behaves the same way", () => {
    const empty = noWidgets(start());
    const miss = playFree(empty, deps, SELECT.card.id);
    expect(threat(miss.state)).toBe(threat(empty));
    expect(causes(miss.events)).toEqual(["searchFoundNothing"]);
    const full = start({ widgets: 12 });
    expect(threat(playFree(full, deps, SELECT.card.id).state)).toBe(threat(full) + 7);
  });

  it("'discard until you discard a widget, then …' with no widget skips the 'Then'", () => {
    const state = noWidgets(start());
    const { state: after, events } = playFree(state, deps, DISCARD_UNTIL.card.id);
    expect(threat(after)).toBe(threat(state));
    expect(causes(events)).toEqual(["discardUntilFoundNothing"]);
    expect(skipped(events)).toBe(true);
    const found = start({ widgets: 12 });
    expect(threat(playFree(found, deps, DISCARD_UNTIL.card.id).state)).toBe(threat(found) + 7);
  });

  it("an encounter 'discard until' that finds nothing is fulfilled; its 'Reveal that minion' is what fails", () => {
    const state = start();
    const { state: after, events } = playFree(state, deps, REVEAL_UNTIL.card.id);
    expect(threat(after)).toBe(threat(state));
    // Only the reveal: RRG 1.8 "Encounter Deck" (p. 17), the emptied discard is "considered to be fulfilled".
    expect(causes(events)).toEqual(["revealFoundNothing"]);
    expect(skipped(events)).toBe(true);
  });

  it("…and with a minion found, it is revealed and the 'Then' runs", () => {
    const state = start({ encounter: [...copiesOf(BLANK.id, 3), MINION.id, ...copiesOf(BLANK.id, 8)] });
    const { state: after, events } = playFree(state, deps, REVEAL_UNTIL.card.id);
    expect(threat(after)).toBe(threat(state) + 7);
    expect(skipped(events)).toBe(false);
    expect(after.players[0]!.playArea.some((id) => after.instances[id]?.cardId === MINION.id)).toBe(true);
  });

  it("a revealed card whose effects are cancelled leaves the 'Then' unresolved", () => {
    const base = start({ encounter: [MINION.id, ...copiesOf(BLANK.id, 8)] });
    const { state } = playerCardIntoPlay(base, SHIELD.id);
    const { state: after, events } = playFree(state, deps, REVEAL_UNTIL.card.id);
    expect(threat(after)).toBe(threat(state));
    expect(causes(events)).toEqual(["revealCancelled"]);
    expect(skipped(events)).toBe(true);
  });
});

describe("a cancel with nothing it can cancel", () => {
  it("a cancel of a card already cancelled has nothing to cancel, and skips its 'Then'", () => {
    const { state } = playerCardIntoPlay(start({ encounter: copiesOf(BLANK.id, 10) }), TWICE.id);
    const { state: after, events } = playFree(state, deps, REVEAL.card.id);
    expect(threat(after)).toBe(threat(state));
    expect(causes(events)).toEqual(["nothingToCancel"]);
    expect(skipped(events)).toBe(true);
  });

  it("a forced cancel aimed at a card that cannot be cancelled never triggers, so its 'Then' never runs (§3.27)", () => {
    const placed = playerCardIntoPlay(start({ encounter: [...copiesOf(BLANK.id, 10), LOCKED.id] }), WARD.id);
    const state = onTopOfEncounterDeck(placed.state, LOCKED.id);
    const { state: after, events } = playFree(state, deps, REVEAL.card.id);
    expect(threat(after)).toBe(threat(state));
    expect(events.some((e) => e.type === "revealCancelled")).toBe(false);
  });

  it("…and a card it can cancel runs it", () => {
    const { state } = playerCardIntoPlay(start({ encounter: copiesOf(BLANK.id, 10) }), WARD.id);
    const { state: after, events } = playFree(state, deps, REVEAL.card.id);
    expect(threat(after)).toBe(threat(state) + 7);
    expect(skipped(events)).toBe(false);
  });
});

describe("'X attacks you' / 'X schemes' that does not happen", () => {
  it("a stunned villain removes its stun instead of attacking, and the 'Then' is skipped", () => {
    const state = withVillainStatus(start(), "stunned");
    const { state: after, events } = playFree(state, deps, ATTACK.card.id);
    expect(threat(after)).toBe(threat(state));
    expect(mustInstance(after, after.activeVillainId).statuses.stunned).toBe(0);
    expect(causes(events)).toEqual(["activationDidNotHappen"]);
    expect(skipped(events)).toBe(true);
  });

  it("…and an attack that happens runs it", () => {
    const state = start();
    const { state: after, events } = playFree(state, deps, ATTACK.card.id);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "enemyAttack")).toBe(true);
    expect(threat(after)).toBe(threat(state) + 7);
    expect(skipped(events)).toBe(false);
  });

  it("'each minion attacks' with no minion in play is vacuously resolved, so the 'Then' runs", () => {
    const state = start();
    const { state: after, events } = playFree(state, deps, EACH_ATTACK.card.id);
    expect(threat(after)).toBe(threat(state) + 7);
    expect(causes(events)).toEqual([]);
  });

  it("a confused villain's scheme is cancelled and the 'Then' is skipped; an unconfused one runs it", () => {
    const confused = withVillainStatus(start(), "confused");
    const miss = playFree(confused, deps, SCHEME.card.id);
    expect(threat(miss.state)).toBe(threat(confused));
    expect(causes(miss.events)).toEqual(["activationDidNotHappen"]);
    const clear = start();
    const hit = playFree(clear, deps, SCHEME.card.id);
    // The scheme itself adds the villain's SCH (1), then the "Then" adds 7.
    expect(threat(hit.state)).toBe(threat(clear) + 1 + 7);
    expect(skipped(hit.events)).toBe(false);
  });
});
