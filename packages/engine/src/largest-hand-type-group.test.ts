/**
 * docs/phase7-wave7.md §3.32, §4.1 Q18 = B: `ValueSpec largestHandTypeGroup { player }`, "X is the number of cards of
 * the most common type in your hand". MC40 p. 18 ("Most Common Type"): "count the cards of each different type (ally,
 * event, player side scheme, resource, support, and upgrade) in your hand. The type that you have the most of is the
 * most common type. If you have more than one type that is tied for the most common, choose one."
 *
 * Those six are the player card types of RRG 1.8 "Card Types" (p. 12) without identity. An encounter card held in a
 * hand (`RuleSpec staysInHand`, or an obligation) forms no group (Q18 = B). A tie gives the same number whichever type
 * is chosen, so the value asks nobody. Synthetic cards only; the engine never names a card.
 */
import { flat, type PlayerSideSchemeCard, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeckId, characterProfile, mustInstance, mustPlayer } from "./query.js";
import { evaluate, resolveValue, type EffectContext } from "./select.js";
import type { EffectSpec, PlayerRef, Predicate, TargetRef, ValueSpec } from "./spec.js";
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
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const you: PlayerRef = { kind: "controller" };
const thatPlayer: PlayerRef = { kind: "scoped" };
const mostCommon = (player: PlayerRef): ValueSpec => ({ kind: "largestHandTypeGroup", player });
const atLeastThree = (player: PlayerRef): Predicate => ({
  kind: "compare",
  left: mostCommon(player),
  op: "atLeast",
  right: { kind: "const", value: 3 },
});
const mainScheme: TargetRef = { kind: "mainScheme" };

/** The three player card types the default deck lacks, and a double-sided upgrade. */
const EVENT = stubEvent({ id: "blast", cost: 0 });
const SUPPORT = stubSupport({ id: "base", cost: 0 });
const PLAYER_SCHEME: PlayerSideSchemeCard = {
  ...stubSupport({ id: "errand", cost: 0 }),
  type: "player_side_scheme",
  startingThreat: flat(2),
};
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

/**
 * "While [this villain] is attacking you, he gets +X ATK, where X is the number of cards of the most common type in
 * your hand." A villain's constant ability has no controller, so "you" is named from the attack in progress: the
 * player who controls the character this enemy is attacking.
 */
const attackedPlayer: PlayerRef = {
  kind: "where",
  predicate: { kind: "attackInProgress", attacker: { self: true }, target: { controlledBy: thatPlayer } },
};
const SURGE_ATK = stubAbility("boss.constant", {
  trigger: {
    kind: "constant",
    modifiers: [{ stat: "atk", amount: mostCommon(attackedPlayer), target: { self: true } }],
  },
  effects: [],
});
const BOSS = stubVillain({
  id: "boss",
  stages: [{ hp: flat(30), atk: 1, sch: 1, abilities: [SURGE_ATK.ref] }],
});
const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(60), acceleration: flat(0) }],
});

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
const ATTACK_ME = action("attack-me", [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: you }]);
const ATTACK_OTHER = action("attack-other", [
  { kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "others", of: you } },
]);
/** "Each player places X threat here, where X is the number of cards of the most common type in their hand." */
const EACH_PLACES = action("each-places", [
  {
    kind: "forEachPlayer",
    players: { kind: "each" },
    effects: [{ kind: "placeThreat", target: mainScheme, amount: mostCommon(thatPlayer) }],
  },
]);
/** The same, with "Each player may discard 1 card from their hand before calculating the value of X." */
const DISCARD = "Discard 1 card";
const KEEP = "Do not discard";
const MAY_DISCARD_THEN_PLACE = action("may-discard", [
  {
    kind: "forEachPlayer",
    players: { kind: "each" },
    effects: [
      {
        kind: "chooseOne",
        chooser: thatPlayer,
        options: [
          {
            label: DISCARD,
            effects: [{ kind: "discardFromHand", player: thatPlayer, amount: { kind: "const", value: 1 } }],
          },
          { label: KEEP, effects: [] },
        ],
      },
      { kind: "placeThreat", target: mainScheme, amount: mostCommon(thatPlayer) },
    ],
  },
]);
/** "If [that player] does not have at least 3 cards of the same type in their hand, …" */
const UNLESS_THREE = action("unless-three", [
  {
    kind: "if",
    condition: { kind: "not", of: atLeastThree(you) },
    then: [{ kind: "placeThreat", target: mainScheme, amount: { kind: "const", value: 5 } }],
  },
]);
const ACTIONS = [ATTACK_ME, ATTACK_OTHER, EACH_PLACES, MAY_DISCARD_THEN_PLACE, UNLESS_THREE] as const;
const BUTTONS = ACTIONS.map((a) => stubSupport({ id: a.ref.id.split(".")[0]!, cost: 0, abilities: [a.ref] }));

const deps: EngineDeps = depsOf(HELD_STAYS, SURGE_ATK, ...ACTIONS);

function game(players: 1 | 2 = 1): GameState {
  const state = gameAtFirstTurn({
    cards: [EVENT, SUPPORT, PLAYER_SCHEME, TWO_FACED, HELD, DEBT, BLANK, BOSS, SCHEME, ...BUTTONS],
    deps,
    players,
    villain: BOSS,
    mainScheme: SCHEME,
    deck: [
      ...copiesOf(EVENT.id, 6),
      ...copiesOf(SUPPORT.id, 6),
      ...copiesOf(PLAYER_SCHEME.id, 3),
      ...copiesOf(TWO_FACED.id, 3),
      ...BUTTONS.map((b) => b.id),
    ],
    encounter: [...copiesOf(BLANK.id, 30), ...copiesOf(HELD.id, 6), ...copiesOf(DEBT.id, 4)],
  });
  // Test surgery: every hand starts empty so the counts below are exact rather than whatever the opening draw left.
  return { ...state, players: state.players.map((p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand] })) };
}

const give = (state: GameState, player: PlayerId, ...cards: readonly string[]): GameState =>
  giveCards(state, player, ...cards).state;

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

const contextOf = (player: PlayerId | null): EffectContext => ({
  selfInstanceId: null,
  controllerId: player,
  event: null,
  bindings: {},
  deps,
});
const xOf = (state: GameState, player: PlayerId = P1): number =>
  resolveValue(state, mostCommon(you), contextOf(player), deps);

/** One of the action supports in `player`'s play area, and the command that uses it. */
function button(state: GameState, ability: StubAbility, player: PlayerId = P1) {
  const card = BUTTONS[ACTIONS.indexOf(ability as (typeof ACTIONS)[number])]!;
  const placed = playerCardIntoPlay(state, card.id, player);
  const command: Command = {
    type: "useAbility",
    playerId: player,
    cardInstanceId: placed.id,
    abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  return { state: placed.state, command };
}

const threatPlaced = (events: readonly GameEvent[]): readonly number[] =>
  events
    .filter((e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced")
    .map((e) => e.amount);
const threatOn = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const heroDamage = (state: GameState, player: PlayerId): number =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const villainId = (state: GameState): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === BOSS.id)!.instanceId;

describe("ValueSpec largestHandTypeGroup: the size of the largest same-type group in a hand", () => {
  it("a hand of one type is its size", () => {
    expect(xOf(give(game(), P1, EVENT.id, EVENT.id, EVENT.id, EVENT.id))).toBe(4);
  });

  it("3 + 2 + 1 is 3", () => {
    const state = give(game(), P1, ALLY.id, ALLY.id, ALLY.id, EVENT.id, EVENT.id, RESOURCE.id);
    expect(mustPlayer(state, P1).hand).toHaveLength(6);
    expect(xOf(state)).toBe(3);
  });

  it("a tie of 2 + 2 is 2: the tied types are the same size, so nobody is asked to choose one", () => {
    const state = give(game(), P1, SUPPORT.id, SUPPORT.id, UPGRADE.id, UPGRADE.id);
    expect(xOf(state)).toBe(2);
    expect(state.pendingChoice).toBeNull();
  });

  it("each of the six player card types forms its own group", () => {
    const state = give(game(), P1, ALLY.id, EVENT.id, PLAYER_SCHEME.id, RESOURCE.id, SUPPORT.id, UPGRADE.id);
    expect(mustPlayer(state, P1).hand).toHaveLength(6);
    expect(xOf(state)).toBe(1);
    expect(xOf(give(game(), P1, PLAYER_SCHEME.id, PLAYER_SCHEME.id, PLAYER_SCHEME.id, ALLY.id, EVENT.id))).toBe(3);
  });

  it("an empty hand is 0, and so is a ref that names no player", () => {
    expect(xOf(game())).toBe(0);
    const state = give(game(), P1, EVENT.id, EVENT.id);
    expect(resolveValue(state, mostCommon(you), contextOf(null), deps)).toBe(0);
  });

  it("a hand of only encounter cards is 0 (Q18 = B): they are not counted and form no group", () => {
    const state = holdEncounterCards(game(), P1, HELD.id, HELD.id, HELD.id, DEBT.id, DEBT.id);
    expect(mustPlayer(state, P1).hand).toHaveLength(5);
    expect(xOf(state)).toBe(0);
  });

  it("encounter cards next to player cards: only the player cards are counted", () => {
    const held = holdEncounterCards(game(), P1, HELD.id, HELD.id, HELD.id, HELD.id, DEBT.id);
    const state = give(held, P1, EVENT.id, EVENT.id, ALLY.id);
    expect(mustPlayer(state, P1).hand).toHaveLength(8);
    expect(xOf(state)).toBe(2);
  });

  it("a double-sided card in hand counts once, as the type of its front face", () => {
    const state = give(game(), P1, TWO_FACED.id, UPGRADE.id, UPGRADE.id, EVENT.id);
    expect(xOf(state)).toBe(3);
  });

  it("reads the named player's hand, not the resolving player's", () => {
    const state = give(give(game(2), P1, EVENT.id, EVENT.id, EVENT.id), P2, ALLY.id);
    expect(xOf(state, P1)).toBe(3);
    expect(xOf(state, P2)).toBe(1);
    expect(resolveValue(state, mostCommon({ kind: "others", of: you }), contextOf(P1), deps)).toBe(1);
  });
});

describe("'+X ATK while attacking you': read for the attacked player", () => {
  it("the villain attacks with its printed ATK plus the attacked player's X", () => {
    const hand = give(game(), P1, EVENT.id, EVENT.id, EVENT.id, ALLY.id, ALLY.id);
    const { state, command } = button(hand, ATTACK_ME);
    // No attack in progress: nobody is being attacked, so the bonus is 0.
    expect(characterProfile(state, villainId(state), deps)?.atk).toBe(1);
    const before = heroDamage(state, P1);
    const run = driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }, command], defaultPick);
    expect(heroDamage(run.session.state, P1)).toBe(before + 4);
    expect(characterProfile(run.session.state, villainId(run.session.state), deps)?.atk).toBe(1);
  });

  it("a hand of only encounter cards adds nothing to the attack", () => {
    const hand = holdEncounterCards(game(), P1, HELD.id, HELD.id, HELD.id);
    const { state, command } = button(hand, ATTACK_ME);
    const before = heroDamage(state, P1);
    const run = driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }, command], defaultPick);
    expect(heroDamage(run.session.state, P1)).toBe(before + 1);
  });

  it("two players: an attack on the other player reads that player's hand", () => {
    const hands = give(give(game(2), P1, EVENT.id, EVENT.id, EVENT.id, EVENT.id), P2, ALLY.id, ALLY.id, UPGRADE.id);
    const { state, command } = button(hands, ATTACK_OTHER);
    const before = { p1: heroDamage(state, P1), p2: heroDamage(state, P2) };
    const run = driveSession(startSession(state), deps, [command], defaultPick);
    expect(heroDamage(run.session.state, P2)).toBe(before.p2 + 3);
    expect(heroDamage(run.session.state, P1)).toBe(before.p1);
  });

  // "Attacking you" is the player the attack was initiated against (RRG 1.8 "Attack (Enemy Activation)", p. 8), who
  // stays the attacked player when another player's character defends. `attackInProgress.target` follows the defender.
  it.todo("another player defends: needs a PlayerRef for the attack's attacked player (none exists; not built here)");
});

describe("'each player places X threat': read once per player", () => {
  it("each player's own hand gives that player's X, in player order", () => {
    const hands = give(give(game(2), P1, EVENT.id, EVENT.id, EVENT.id, ALLY.id), P2, UPGRADE.id, RESOURCE.id);
    const { state, command } = button(hands, EACH_PLACES);
    const before = threatOn(state);
    const run = driveSession(startSession(state), deps, [command], defaultPick);
    expect(threatPlaced(run.events)).toEqual([3, 1]);
    expect(threatOn(run.session.state)).toBe(before + 4);
  });

  it("'may discard 1 card before calculating X': the value is read after that player's discard", () => {
    const hands = give(
      give(game(2), P1, EVENT.id, EVENT.id, EVENT.id, ALLY.id),
      P2,
      UPGRADE.id,
      UPGRADE.id,
      UPGRADE.id,
      ALLY.id,
    );
    const { state, command } = button(hands, MAY_DISCARD_THEN_PLACE);
    expect(xOf(state, P1)).toBe(3);
    expect(xOf(state, P2)).toBe(3);
    const anEvent = mustPlayer(state, P1).hand.find((id) => mustInstance(state, id).cardId === EVENT.id)!;
    // P1 discards an event, P2 keeps their hand.
    const pick = (current: GameState): readonly string[] => {
      const choice = current.pendingChoice!;
      const labeled = (label: string) => choice.options.find((o) => o.label === label);
      const option = labeled(choice.playerId === P1 ? DISCARD : KEEP);
      if (option) return [option.optionId];
      const card = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === anEvent);
      return card ? [card.optionId] : defaultPick(current);
    };
    const before = threatOn(state);
    const run = driveSession(startSession(state), deps, [command], pick);
    expect(mustPlayer(run.session.state, P1).hand).not.toContain(anEvent);
    expect(mustPlayer(run.session.state, P1).hand).toHaveLength(3);
    expect(mustPlayer(run.session.state, P2).hand).toHaveLength(4);
    expect(threatPlaced(run.events)).toEqual([2, 3]);
    expect(threatOn(run.session.state)).toBe(before + 5);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });

  it("nobody discards: both players place their full X", () => {
    const hands = give(give(game(2), P1, EVENT.id, EVENT.id, EVENT.id), P2, UPGRADE.id, UPGRADE.id);
    const { state, command } = button(hands, MAY_DISCARD_THEN_PLACE);
    const pick = (current: GameState): readonly string[] => {
      const keep = current.pendingChoice!.options.find((o) => o.label === KEEP);
      return keep ? [keep.optionId] : defaultPick(current);
    };
    const run = driveSession(startSession(state), deps, [command], pick);
    expect(threatPlaced(run.events)).toEqual([3, 2]);
  });
});

describe("'at least 3 cards of the same type in their hand' is the value compared with 3", () => {
  it("true with a group of 3, false with 2 + 2, false with three held encounter cards", () => {
    const three = give(game(), P1, SUPPORT.id, SUPPORT.id, SUPPORT.id, ALLY.id);
    expect(evaluate(three, atLeastThree(you), contextOf(P1))).toBe(true);
    const tie = give(game(), P1, SUPPORT.id, SUPPORT.id, ALLY.id, ALLY.id);
    expect(evaluate(tie, atLeastThree(you), contextOf(P1))).toBe(false);
    const held = holdEncounterCards(game(), P1, HELD.id, HELD.id, HELD.id);
    expect(evaluate(held, atLeastThree(you), contextOf(P1))).toBe(false);
  });

  it("'does not have at least 3': the effect resolves without a group of 3 and not with one", () => {
    const short = button(give(game(), P1, EVENT.id, EVENT.id, ALLY.id), UNLESS_THREE);
    const shortRun = driveSession(startSession(short.state), deps, [short.command], defaultPick);
    expect(threatPlaced(shortRun.events)).toEqual([5]);
    const enough = button(give(game(), P1, EVENT.id, EVENT.id, EVENT.id), UNLESS_THREE);
    const enoughRun = driveSession(startSession(enough.state), deps, [enough.command], defaultPick);
    expect(threatPlaced(enoughRun.events)).toEqual([]);
  });
});
