/**
 * docs/phase7-wave7.md §3.33: `EffectSpec chooseCardType { player, bind }` and `TargetQuery cardTypeIs: { chosen }`.
 * "When Revealed: Choose a card type, then discard each card from your hand that is not of that type. Draw up to your
 * hand size. Place 1 threat on the main scheme for each card of the chosen type in your hand."
 *
 * RRG 1.8 "Card Types" (p. 12) lists fifteen: seven player card types and eight encounter card types. Ruling,
 * January 26, 2026 (4) answer 4: "You can choose any card type that exists in Marvel Champions, even if not in your
 * hand or deck." So every type is offered whatever the hand holds, a type no hand can hold included. Synthetic cards
 * only; the engine never names a card.
 */
import { flat, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { cardTypeName, RULES_CARD_TYPES } from "./card-types.js";
import type { PendingChoice } from "./choices.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import { cardTypeOf, chosenFromList, chosenVar } from "./select.js";
import type { EffectSpec, PlayerRef, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubObligation,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY, defaultPick, giveCards, RESOURCE, UPGRADE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const you: PlayerRef = { kind: "controller" };
const thatPlayer: PlayerRef = { kind: "scoped" };
const mainScheme: TargetRef = { kind: "mainScheme" };
const ofThatType: TargetQuery = { cardTypeIs: { chosen: "type" } };
const notOfThatType: TargetQuery = { not: ofThatType };

/** The printed sentence, for `player`: choose, discard the rest of the hand, draw up to hand size, count. */
const override = (player: PlayerRef): readonly EffectSpec[] => [
  { kind: "chooseCardType", player, bind: "type" },
  { kind: "moveCards", cards: { kind: "zone", zone: "hand", player, filter: notOfThatType }, to: "discard" },
  { kind: "drawUpTo", player, amount: { kind: "handSize", player } },
  { kind: "placeThreat", target: mainScheme, amount: { kind: "handCount", player, filter: ofThatType } },
];

const EVENT = stubEvent({ id: "blast", cost: 0 });
const SUPPORT = stubSupport({ id: "base", cost: 0 });
const TWO_FACED: UpgradeCard = {
  ...stubUpgrade({ id: "two-faced", cost: 0 }),
  flipSide: { name: "other-face", traits: [], keywords: [], text: { printed: "", current: "" }, abilities: [] },
};

/** Encounter cards a hand can hold: a treachery with its own `staysInHand` rule, and an obligation. */
const HELD_STAYS = stubAbility("held.stays", {
  trigger: { kind: "constant", rules: [{ kind: "staysInHand", cards: {} }] },
  activeIn: "hand",
  effects: [],
} satisfies AbilityDefinition);
const HELD = stubTreachery({ id: "held", boostIcons: 0, abilities: [HELD_STAYS.ref] });
const DEBT = stubObligation({ id: "debt", boostIcons: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** The treachery itself: "you" is the player resolving it. */
const OVERRIDE_WR = stubAbility("override.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: override(you),
});
const OVERRIDE = stubTreachery({ id: "override", boostIcons: 0, abilities: [OVERRIDE_WR.ref] });

const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
});

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
/** "Reveal the top card of the encounter deck": how a player comes to resolve the treachery. */
const REVEAL = action("reveal", [{ kind: "revealEncounterCard", player: you }]);
/** A later, separate ability reading the same name: threat for each hand card of, and each not of, "that type". */
const PEEK = action("peek", [
  { kind: "placeThreat", target: mainScheme, amount: { kind: "handCount", player: you, filter: ofThatType } },
]);
const PEEK_NOT = action("peek-not", [
  { kind: "placeThreat", target: mainScheme, amount: { kind: "handCount", player: you, filter: notOfThatType } },
]);
/** The same sentence as "each player chooses a card type …", in one resolution. */
const EACH_OVERRIDE = action("each-override", [
  { kind: "forEachPlayer", players: { kind: "each" }, effects: override(thatPlayer) },
]);
/** A choice for a player the ref does not name: "that player" outside any "each player". */
const NOBODY = action("nobody", [
  { kind: "chooseCardType", player: thatPlayer, bind: "type" },
  { kind: "placeThreat", target: mainScheme, amount: { kind: "handCount", player: you, filter: ofThatType } },
]);
const ACTIONS = [REVEAL, PEEK, PEEK_NOT, EACH_OVERRIDE, NOBODY] as const;
const BUTTONS = ACTIONS.map((a) => stubSupport({ id: a.ref.id.split(".")[0]!, cost: 0, abilities: [a.ref] }));

const deps: EngineDeps = depsOf(HELD_STAYS, OVERRIDE_WR, ...ACTIONS);

function game(players: 1 | 2 = 1): GameState {
  const state = gameAtFirstTurn({
    cards: [EVENT, SUPPORT, TWO_FACED, HELD, DEBT, BLANK, OVERRIDE, BOSS, SCHEME, ...BUTTONS],
    deps,
    players,
    villain: BOSS,
    mainScheme: SCHEME,
    deck: [
      ...copiesOf(EVENT.id, 8),
      ...copiesOf(SUPPORT.id, 6),
      ...copiesOf(TWO_FACED.id, 2),
      ...BUTTONS.map((b) => b.id),
    ],
    encounter: [
      ...copiesOf(BLANK.id, 30),
      ...copiesOf(OVERRIDE.id, 4),
      ...copiesOf(HELD.id, 4),
      ...copiesOf(DEBT.id, 4),
    ],
  });
  // Test surgery: every hand starts empty so the hands below are exact rather than whatever the opening draw left.
  return { ...state, players: state.players.map((p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand] })) };
}

const give = (state: GameState, player: PlayerId, ...cards: readonly string[]): GameState =>
  giveCards(state, player, ...cards).state;

/** Test surgery: copies of these cards on top of `player`'s deck, the first named on top, so the draws are known. */
function stackDeck(state: GameState, player: PlayerId, ...cards: readonly string[]): GameState {
  const deck = mustPlayer(state, player).deck;
  const top: InstanceId[] = [];
  for (const card of cards) {
    const id = deck.find((i) => mustInstance(state, i).cardId === card && !top.includes(i));
    if (!id) throw new Error(`${player} has no more ${card} in their deck`);
    top.push(id);
  }
  const stacked = [...top, ...deck.filter((i) => !top.includes(i))];
  return { ...state, players: state.players.map((p) => (p.playerId === player ? { ...p, deck: stacked } : p)) };
}

/** Test surgery: copies of encounter cards from the encounter deck into `player`'s hand. */
function holdEncounterCards(state: GameState, player: PlayerId, ...cards: readonly string[]): GameState {
  let current = state;
  for (const card of cards) {
    const deckId = activeEncounterDeckId(current);
    const piles = current.encounterDecks[deckId]!;
    const id = piles.deck.find((i) => mustInstance(current, i).cardId === card);
    if (!id) throw new Error(`no ${card} in the encounter deck`);
    current = {
      ...current,
      encounterDecks: { ...current.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== id) } },
      players: current.players.map((p) => (p.playerId === player ? { ...p, hand: [...p.hand, id] } : p)),
    };
  }
  return current;
}

/** One of the action supports in `player`'s play area (put there once), and the command that uses it. */
function button(state: GameState, ability: StubAbility, player: PlayerId = P1) {
  const card = BUTTONS[ACTIONS.indexOf(ability as (typeof ACTIONS)[number])]!;
  const inPlay = mustPlayer(state, player).playArea.find((id) => mustInstance(state, id).cardId === card.id);
  const placed = inPlay ? { state, id: inPlay } : playerCardIntoPlay(state, card.id, player);
  const command: Command = {
    type: "useAbility",
    playerId: player,
    cardInstanceId: placed.id,
    abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  return { state: placed.state, command };
}

/** Answers every card type prompt with that player's entry of `types`, recording each prompt as it is asked. */
function choosing(types: Readonly<Record<string, string>>, asked: PendingChoice[] = []) {
  return (state: GameState): readonly string[] => {
    const choice = state.pendingChoice!;
    if (choice.prompt.kind !== "chooseFromList") return defaultPick(state);
    asked.push(choice);
    return [types[choice.playerId]!];
  };
}

/** `player` reveals the treachery off the top of the encounter deck and chooses `type`. */
function reveal(state: GameState, type: string, player: PlayerId = P1, asked: PendingChoice[] = []) {
  const { state: ready, command } = button(onTopOfEncounterDeck(state, OVERRIDE.id), REVEAL, player);
  const run = driveSession(startSession(ready), deps, [command], choosing({ [player]: type }, asked));
  return { before: ready, run, state: run.session.state };
}

const handCards = (state: GameState, player: PlayerId = P1): readonly string[] =>
  mustPlayer(state, player).hand.map((id) => mustInstance(state, id).cardId as string);
const count = (cards: readonly string[], card: string): number => cards.filter((c) => c === card).length;
const threatOn = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const typesChosen = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: "cardTypeChosen" }> => e.type === "cardTypeChosen");
const encounterDiscard = (state: GameState): readonly InstanceId[] =>
  state.encounterDecks[activeEncounterDeckId(state)]!.discard;

describe("the card types a player may choose", () => {
  it("are the fifteen of RRG 1.8 'Card Types' (p. 12): seven player card types, then eight encounter card types", () => {
    expect(RULES_CARD_TYPES).toEqual([
      "ally",
      "event",
      "hero_identity",
      "player_side_scheme",
      "resource",
      "support",
      "upgrade",
      "attachment",
      "environment",
      "main_scheme",
      "minion",
      "obligation",
      "side_scheme",
      "treachery",
      "villain",
    ]);
    expect(RULES_CARD_TYPES.map(cardTypeName)).toEqual([
      "Ally",
      "Event",
      "Identity",
      "Player side scheme",
      "Resource",
      "Support",
      "Upgrade",
      "Attachment",
      "Environment",
      "Main scheme",
      "Minion",
      "Obligation",
      "Side scheme",
      "Treachery",
      "Villain",
    ]);
  });

  it("the prompt offers every type with its name, one to be chosen, whatever the hand holds", () => {
    const asked: PendingChoice[] = [];
    reveal(give(game(), P1, EVENT.id, UPGRADE.id), "event", P1, asked);
    expect(asked).toHaveLength(1);
    const choice = asked[0]!;
    expect(choice.prompt).toEqual({ kind: "chooseFromList", list: "cardType" });
    expect(choice.playerId).toBe(P1);
    expect([choice.minSelections, choice.maxSelections]).toEqual([1, 1]);
    expect(choice.options).toHaveLength(15);
    expect([...choice.options.map((o) => o.optionId)].sort()).toEqual([...RULES_CARD_TYPES].sort());
    for (const option of choice.options) {
      expect(option.label).toBe(cardTypeName(option.optionId as (typeof RULES_CARD_TYPES)[number]));
      expect(option.ref).toEqual({ kind: "none" });
    }
    // The types in the chooser's hand come first (the RRG's order within each group): a convenience, not a rule.
    expect(choice.options.slice(0, 3).map((o) => o.label)).toEqual(["Event", "Upgrade", "Ally"]);
  });

  it("an empty hand is offered the same fifteen, in the RRG's order", () => {
    const asked: PendingChoice[] = [];
    reveal(game(), "event", P1, asked);
    expect(asked[0]!.options.map((o) => o.optionId)).toEqual(RULES_CARD_TYPES);
  });
});

describe("'choose a card type, then discard each card from your hand that is not of that type …'", () => {
  it("choosing event keeps the events, discards the rest, draws up to hand size, and counts the events after the draw", () => {
    const hand = give(game(), P1, EVENT.id, EVENT.id, ALLY.id, RESOURCE.id, UPGRADE.id, SUPPORT.id);
    const stacked = stackDeck(hand, P1, EVENT.id, ALLY.id, ALLY.id, EVENT.id, RESOURCE.id);
    const kept = mustPlayer(stacked, P1).hand.filter((id) => mustInstance(stacked, id).cardId === EVENT.id);
    const discarded = mustPlayer(stacked, P1).hand.filter((id) => !kept.includes(id));
    expect([kept.length, discarded.length]).toEqual([2, 4]);
    const { before, run, state } = reveal(stacked, "event");
    for (const id of kept) expect(mustPlayer(state, P1).hand).toContain(id);
    for (const id of discarded) expect(mustPlayer(state, P1).discard).toContain(id);
    // Hand size 6 (alter-ego): two events kept, so four drawn off the top: event, ally, ally, event.
    expect(handCards(state)).toEqual([EVENT.id, EVENT.id, EVENT.id, ALLY.id, ALLY.id, EVENT.id]);
    // Four events in hand after the draw, two of them drawn: 4 threat, not the 2 that were kept.
    expect(threatOn(state)).toBe(threatOn(before) + 4);
    expect(typesChosen(run.events)).toEqual([{ type: "cardTypeChosen", playerId: P1, cardType: "event" }]);
    expect(state.pendingChoice).toBeNull();
    expect(state.stack).toEqual([]);
  });

  it("a type absent from the hand discards the whole hand, and counts what the draw brought of that type", () => {
    const hand = give(game(), P1, ALLY.id, RESOURCE.id, UPGRADE.id);
    const stacked = stackDeck(hand, P1, EVENT.id, ALLY.id, EVENT.id, RESOURCE.id, UPGRADE.id, EVENT.id, EVENT.id);
    const held = [...mustPlayer(stacked, P1).hand];
    const { before, state } = reveal(stacked, "event");
    for (const id of held) expect(mustPlayer(state, P1).discard).toContain(id);
    expect(handCards(state)).toEqual([EVENT.id, ALLY.id, EVENT.id, RESOURCE.id, UPGRADE.id, EVENT.id]);
    expect(threatOn(state)).toBe(threatOn(before) + 3);
  });

  it.each(["villain", "main_scheme", "hero_identity"])(
    "a type no hand can hold (%s) may be chosen: the whole hand is discarded and 0 threat is placed",
    (type) => {
      const hand = give(game(), P1, EVENT.id, EVENT.id, ALLY.id, SUPPORT.id);
      const held = [...mustPlayer(hand, P1).hand];
      const { before, run, state } = reveal(hand, type);
      for (const id of held) expect(mustPlayer(state, P1).discard).toContain(id);
      expect(mustPlayer(state, P1).hand).toHaveLength(6);
      expect(threatOn(state)).toBe(threatOn(before));
      expect(typesChosen(run.events).map((e) => e.cardType)).toEqual([type]);
    },
  );

  it("an empty hand: nothing to discard, the draw fills it, and the drawn cards of the type count", () => {
    const stacked = stackDeck(game(), P1, SUPPORT.id, SUPPORT.id, EVENT.id, ALLY.id, ALLY.id, SUPPORT.id);
    const { before, state } = reveal(stacked, "support");
    expect(handCards(state)).toEqual([SUPPORT.id, SUPPORT.id, EVENT.id, ALLY.id, ALLY.id, SUPPORT.id]);
    expect(threatOn(state)).toBe(threatOn(before) + 3);
  });

  it("a double-sided card in hand is the type of its front face", () => {
    const hand = give(game(), P1, TWO_FACED.id, UPGRADE.id, EVENT.id);
    const stacked = stackDeck(hand, P1, ALLY.id, ALLY.id, ALLY.id, ALLY.id);
    const twoFaced = mustPlayer(stacked, P1).hand.find((id) => mustInstance(stacked, id).cardId === TWO_FACED.id)!;
    const { before, state } = reveal(stacked, "upgrade");
    expect(mustPlayer(state, P1).hand).toContain(twoFaced);
    expect(handCards(state)).toEqual([TWO_FACED.id, UPGRADE.id, ALLY.id, ALLY.id, ALLY.id, ALLY.id]);
    expect(threatOn(state)).toBe(threatOn(before) + 2);
  });
});

describe("an encounter card held in a hand has a card type like any other card", () => {
  const held = (state: GameState) => holdEncounterCards(give(state, P1, EVENT.id), P1, HELD.id, DEBT.id);
  const idOf = (state: GameState, card: string): InstanceId =>
    mustPlayer(state, P1).hand.find((id) => mustInstance(state, id).cardId === card)!;

  it("choosing treachery keeps the held treachery and counts it; the obligation and the event are discarded", () => {
    const hand = stackDeck(held(game()), P1, ...copiesOf(ALLY.id, 6));
    const [treachery, obligation, event] = [idOf(hand, HELD.id), idOf(hand, DEBT.id), idOf(hand, EVENT.id)];
    const { before, state } = reveal(hand, "treachery");
    expect(mustPlayer(state, P1).hand).toContain(treachery);
    // An encounter card leaves a hand for the encounter discard pile, a player card for its owner's.
    expect(encounterDiscard(state)).toContain(obligation);
    expect(mustPlayer(state, P1).discard).toContain(event);
    expect(count(handCards(state), HELD.id)).toBe(1);
    expect(threatOn(state)).toBe(threatOn(before) + 1);
  });

  it("choosing obligation keeps the obligation instead", () => {
    const hand = stackDeck(held(game()), P1, ...copiesOf(ALLY.id, 6));
    const [treachery, obligation] = [idOf(hand, HELD.id), idOf(hand, DEBT.id)];
    const { before, state } = reveal(hand, "obligation");
    expect(mustPlayer(state, P1).hand).toContain(obligation);
    expect(encounterDiscard(state)).toContain(treachery);
    expect(threatOn(state)).toBe(threatOn(before) + 1);
  });

  it("choosing event discards both encounter cards with everything else that is not an event", () => {
    const hand = stackDeck(held(game()), P1, ...copiesOf(ALLY.id, 6));
    const [treachery, obligation, event] = [idOf(hand, HELD.id), idOf(hand, DEBT.id), idOf(hand, EVENT.id)];
    const { before, state } = reveal(hand, "event");
    expect(encounterDiscard(state)).toEqual(expect.arrayContaining([treachery, obligation]));
    expect(mustPlayer(state, P1).hand).toContain(event);
    expect(handCards(state)).toEqual([EVENT.id, ...copiesOf(ALLY.id, 5)]);
    expect(threatOn(state)).toBe(threatOn(before) + 1);
  });
});

describe("the chosen type is bound for that resolution only", () => {
  it("a later, separate ability reading the same name finds nothing chosen", () => {
    const hand = stackDeck(give(game(), P1, EVENT.id, EVENT.id), P1, ...copiesOf(EVENT.id, 4));
    const first = reveal(hand, "event");
    expect(handCards(first.state)).toEqual(copiesOf(EVENT.id, 6));
    expect(threatOn(first.state)).toBe(threatOn(first.before) + 6);
    // Six events in hand and "event" chosen a moment ago: the next ability still counts 0 cards "of that type" …
    const peek = button(first.state, PEEK);
    const peeked = driveSession(startSession(peek.state), deps, [peek.command], defaultPick).session.state;
    expect(threatOn(peeked)).toBe(threatOn(first.state));
    // … and with no type chosen, no card is "of that type", so all six are "not of that type".
    const peekNot = button(peeked, PEEK_NOT);
    const peekedNot = driveSession(startSession(peekNot.state), deps, [peekNot.command], defaultPick).session.state;
    expect(threatOn(peekedNot)).toBe(threatOn(peeked) + 6);
  });

  it("the binding is the ability's own vars: `<bind>.chosen.<type>`, read back by name", () => {
    expect(chosenVar("type", "event")).toBe("type.chosen.event");
    expect(chosenFromList({ "type.chosen.event": 1, "type.made": 1 }, "type")).toBe("event");
    expect(chosenFromList({ "type.made": 0 }, "type")).toBeNull();
    expect(chosenFromList({ "other.chosen.event": 1 }, "type")).toBeNull();
    expect(chosenFromList(undefined, "type")).toBeNull();
  });

  it("revealed a second time, it asks again and the new answer is the one used", () => {
    const hand = stackDeck(give(game(), P1, EVENT.id, EVENT.id, ALLY.id), P1, ...copiesOf(ALLY.id, 3), EVENT.id);
    const first = reveal(hand, "event");
    expect(handCards(first.state)).toEqual([EVENT.id, EVENT.id, ALLY.id, ALLY.id, ALLY.id, EVENT.id]);
    const asked: PendingChoice[] = [];
    const restacked = stackDeck(first.state, P1, RESOURCE.id, ALLY.id, RESOURCE.id);
    const second = reveal(restacked, "ally", P1, asked);
    expect(asked).toHaveLength(1);
    // Three allies kept, the three events discarded, three drawn (one more ally): 4 threat for allies, none for events.
    expect(handCards(second.state)).toEqual([ALLY.id, ALLY.id, ALLY.id, RESOURCE.id, ALLY.id, RESOURCE.id]);
    expect(threatOn(second.state)).toBe(threatOn(second.before) + 4);
  });

  it("no such player: nobody is asked and nothing is chosen", () => {
    const { state, command } = button(give(game(), P1, EVENT.id, EVENT.id), NOBODY);
    const asked: PendingChoice[] = [];
    const run = driveSession(startSession(state), deps, [command], choosing({}, asked));
    expect(asked).toEqual([]);
    expect(typesChosen(run.events)).toEqual([]);
    expect(threatOn(run.session.state)).toBe(threatOn(state));
  });
});

describe("who chooses: the player the ref names", () => {
  it("two players each reveal a copy on their own turn: each is asked, and each hand is judged by its own answer", () => {
    const hands = give(give(game(2), P1, EVENT.id, ALLY.id, ALLY.id), P2, EVENT.id, EVENT.id, ALLY.id);
    const stacked = stackDeck(
      stackDeck(hands, P1, ...copiesOf(RESOURCE.id, 4)),
      P2,
      EVENT.id,
      ...copiesOf(RESOURCE.id, 3),
    );
    const p2Hand = [...mustPlayer(stacked, P2).hand];
    const asked: PendingChoice[] = [];
    const first = reveal(stacked, "ally", P1, asked);
    expect(asked.map((c) => c.playerId)).toEqual([P1]);
    expect(handCards(first.state, P1)).toEqual([ALLY.id, ALLY.id, ...copiesOf(RESOURCE.id, 4)]);
    expect(mustPlayer(first.state, P2).hand).toEqual(p2Hand);
    expect(threatOn(first.state)).toBe(threatOn(first.before) + 2);

    const turn = driveSession(startSession(first.state), deps, [{ type: "endTurn", playerId: P1 }], defaultPick);
    const p1Hand = [...mustPlayer(turn.session.state, P1).hand];
    const second = reveal(turn.session.state, "event", P2, asked);
    expect(asked.map((c) => c.playerId)).toEqual([P1, P2]);
    expect(handCards(second.state, P2)).toEqual([EVENT.id, EVENT.id, EVENT.id, ...copiesOf(RESOURCE.id, 3)]);
    expect(mustPlayer(second.state, P1).hand).toEqual(p1Hand);
    expect(threatOn(second.state)).toBe(threatOn(second.before) + 3);
    expect(typesChosen(second.run.events)).toEqual([{ type: "cardTypeChosen", playerId: P2, cardType: "event" }]);
  });

  it("'each player chooses a card type …' in one resolution: one player's choice is not the next player's", () => {
    const hands = give(give(game(2), P1, EVENT.id, ALLY.id, ALLY.id), P2, EVENT.id, EVENT.id, ALLY.id);
    const stacked = stackDeck(stackDeck(hands, P1, ...copiesOf(RESOURCE.id, 4)), P2, ...copiesOf(RESOURCE.id, 4));
    const { state, command } = button(stacked, EACH_OVERRIDE);
    const asked: PendingChoice[] = [];
    const run = driveSession(startSession(state), deps, [command], choosing({ [P1]: "ally", [P2]: "event" }, asked));
    expect(asked.map((c) => c.playerId)).toEqual([P1, P2]);
    expect(handCards(run.session.state, P1)).toEqual([ALLY.id, ALLY.id, ...copiesOf(RESOURCE.id, 4)]);
    expect(handCards(run.session.state, P2)).toEqual([EVENT.id, EVENT.id, ...copiesOf(RESOURCE.id, 4)]);
    expect(threatOn(run.session.state)).toBe(threatOn(state) + 4);
    expect(typesChosen(run.events)).toEqual([
      { type: "cardTypeChosen", playerId: P1, cardType: "ally" },
      { type: "cardTypeChosen", playerId: P2, cardType: "event" },
    ]);
  });
});

describe("`cardTypeOf`: the type the clause compares", () => {
  it("is the printed type of a card in hand, a player card or an encounter card", () => {
    const state = holdEncounterCards(give(game(), P1, EVENT.id, TWO_FACED.id, ALLY.id), P1, HELD.id, DEBT.id);
    expect(mustPlayer(state, P1).hand.map((id) => cardTypeOf(state, id))).toEqual([
      "event",
      "upgrade",
      "ally",
      "treachery",
      "obligation",
    ]);
    expect(cardTypeOf(state, mustPlayer(state, P1).identity.instanceId)).toBe("hero_identity");
    expect(cardTypeOf(state, state.mainScheme.instanceId)).toBe("main_scheme");
  });

  // RRG 1.8 "Card Types" (p. 12): a card whose type an ability changed "loses all other card types".
  it("a card in play facedown as a minion is a minion, not its printed type", () => {
    const placed = playerCardIntoPlay(give(game(), P1, EVENT.id), ALLY.id, P1);
    const facedown: GameState = {
      ...placed.state,
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), facedownAs: { kind: "minion", traits: [] } },
      },
    };
    expect(cardTypeOf(placed.state, placed.id)).toBe("ally");
    expect(cardTypeOf(facedown, placed.id)).toBe("minion");
  });
});

describe("replay", () => {
  it("a game with the choice in its log replays to the same state", () => {
    const hands = give(give(game(2), P1, EVENT.id, ALLY.id, ALLY.id), P2, EVENT.id, EVENT.id, ALLY.id);
    const { state, command } = button(hands, EACH_OVERRIDE);
    const run = driveSession(startSession(state), deps, [command], choosing({ [P1]: "villain", [P2]: "event" }));
    expect(typesChosen(run.events).map((e) => e.cardType)).toEqual(["villain", "event"]);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });
});
