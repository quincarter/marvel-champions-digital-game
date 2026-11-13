/**
 * Tagged abilities with no trigger (`AbilityTriggerSpec special.tag`), resolved only by an effect naming the tag
 * (`EffectSpec resolveSpecials` `tag`, `pick: "one"`), counted (`ValueSpec taggedAbilities`) and matched
 * (`TargetQuery hasTaggedAbility`). Custom content: Gwenpool's "speech bubbles" (Gwenpool by PatataSaurio). Pink bubbles
 * on her player cards, purple on her nemesis cards; "Resolve whatever is written in a PINK BUBBLE in play" (her hero
 * ability), "resolve all the PURPLE BUBBLES in play" (Evil Gwenpool), "X equals the PINK BUBBLES you control" (Precise
 * Cut), "cards with PINK BUBBLES" (Too Much Pink); a flavor bubble (no instruction) still counts. That's Not How the Game
 * Ends removes itself from the game, then resolves all the pink bubbles in play, its own included (the author's rule).
 *
 * Sources: RRG 1.8 "Special" (p. 40: resolves only "through the explicit instruction of another card ability"), "Blank"
 * (p. 10), "Self-Referential" (p. 39).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { maxHitPoints, mustInstance } from "./query.js";
import { matchesQuery, resolveValue } from "./select.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const one = { kind: "const", value: 1 } as const;
const tally = (name: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "mainScheme" },
  counterType: name,
  amount: one,
});
const bubble = (id: string, tag: string, ...effects: EffectSpec[]) =>
  stubAbility(`${id}.bubble`, def({ trigger: { kind: "special", tag }, effects }));

const PINK_A = bubble("pink-a", "pinkBubble", tally("pinkA"));
const PINK_B = bubble("pink-b", "pinkBubble", tally("pinkB"));
/** A flavor bubble: text with nothing to resolve. */
const PINK_FLAVOR = bubble("pink-flavor", "pinkBubble");
const PURPLE = bubble("purple", "purpleBubble", tally("purple"));
/** An untagged Special on the same card as a pink bubble. */
const PLAIN_SPECIAL = stubAbility("plain.special", def({ trigger: { kind: "special" }, effects: [tally("plain")] }));

const CARD_A = stubSupport({ id: "card-a", cost: 0, abilities: [PINK_A.ref, PLAIN_SPECIAL.ref] });
const CARD_B = stubSupport({ id: "card-b", cost: 0, abilities: [PINK_B.ref, PINK_FLAVOR.ref] });
const CARD_PURPLE = stubSupport({ id: "card-purple", cost: 0, abilities: [PURPLE.ref] });

const actionCard = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const RESOLVE_ONE = actionCard("resolve-one", { kind: "resolveSpecials", cards: {}, tag: "pinkBubble", pick: "one" });
const RESOLVE_ALL = actionCard("resolve-all", { kind: "resolveSpecials", cards: {}, tag: "pinkBubble", bind: "b" });
const RESOLVE_ONE_PURPLE = actionCard("resolve-one-purple", {
  kind: "resolveSpecials",
  cards: {},
  tag: "purpleBubble",
  pick: "one",
});
const RESOLVE_ONE_NONE = actionCard("resolve-one-none", {
  kind: "resolveSpecials",
  cards: {},
  tag: "none",
  pick: "one",
});
/** Wakanda Forever!'s shape: "resolve the Special ability on each support in play" (no tag). */
const RESOLVE_SPECIALS = actionCard("resolve-specials", {
  kind: "resolveSpecials",
  cards: { categories: ["support"] },
});
/** "Treat card A's text box as blank until the end of the phase." */
const BLANK_A = actionCard("blank-a", {
  kind: "blankTextBox",
  target: { kind: "each", query: { categories: ["support"], printedId: CARD_A.id } },
  until: "endOfPhase",
});

/** That's Not How the Game Ends' shape: an upgrade-like support that removes itself, then resolves every pink bubble. */
const GAME_ENDS_PINK = bubble("game-ends", "pinkBubble", tally("gameEnds"));
const GAME_ENDS_ACTION = stubAbility(
  "game-ends.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" },
      { kind: "resolveSpecials", of: { kind: "self" }, cards: {}, tag: "pinkBubble" },
    ],
  }),
);
const GAME_ENDS = stubSupport({ id: "game-ends", cost: 0, abilities: [GAME_ENDS_ACTION.ref, GAME_ENDS_PINK.ref] });

/** Evil Gwenpool's shape: "+X hit points, where X is the number of PURPLE BUBBLES in play"; it has one itself. */
const EVIL_HP = stubAbility(
  "evil.constant",
  def({
    trigger: {
      kind: "constant",
      modifiers: [{ stat: "hp", amount: { kind: "taggedAbilities", tag: "purpleBubble" }, target: { self: true } }],
    },
    effects: [],
  }),
);
const EVIL_PURPLE = bubble("evil", "purpleBubble", tally("evil"));
const EVIL = stubMinion({ id: "evil", atk: 1, sch: 1, hp: 3, abilities: [EVIL_HP.ref, EVIL_PURPLE.ref] });

const deps = depsOf(
  EVIL_HP,
  EVIL_PURPLE,
  PINK_A,
  PINK_B,
  PINK_FLAVOR,
  PURPLE,
  PLAIN_SPECIAL,
  RESOLVE_ONE.ability,
  RESOLVE_ONE_PURPLE.ability,
  RESOLVE_ONE_NONE.ability,
  RESOLVE_ALL.ability,
  RESOLVE_SPECIALS.ability,
  BLANK_A.ability,
  GAME_ENDS_PINK,
  GAME_ENDS_ACTION,
);

const ACTIONS = [RESOLVE_ONE, RESOLVE_ONE_PURPLE, RESOLVE_ONE_NONE, RESOLVE_ALL, RESOLVE_SPECIALS, BLANK_A];

/** Two players; P1 controls cards A and B, P2 the purple card. */
function start(): {
  readonly state: GameState;
  readonly a: InstanceId;
  readonly b: InstanceId;
  readonly p: InstanceId;
} {
  let state = gameAtFirstTurn({
    players: 2,
    cards: [CARD_A, CARD_B, CARD_PURPLE, GAME_ENDS, EVIL, ...ACTIONS.map((x) => x.card)],
    deps,
    deck: [
      CARD_A.id,
      CARD_B.id,
      CARD_B.id,
      CARD_PURPLE.id,
      GAME_ENDS.id,
      ...ACTIONS.flatMap((x) => copiesOf(x.card.id, 2)),
    ],
    encounter: [EVIL.id, ...copiesOf(TREACHERY.id, 30)],
  });
  const a = playerCardIntoPlay(state, CARD_A.id);
  const b = playerCardIntoPlay(a.state, CARD_B.id);
  const p = playerCardIntoPlay(b.state, CARD_PURPLE.id, P2);
  state = p.state;
  return { state, a: a.id, b: b.id, p: p.id };
}

/** P1 plays an action event; `pick` answers the choices. The log replays to the same state. */
function playAction(
  state: GameState,
  card: { readonly id: string },
  pick: (state: GameState) => readonly string[] = defaultPick,
) {
  const given = giveCard(state, P1, card.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const driven = driveSession(startSession(given.state), deps, [command], pick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}
const counter = (state: GameState, name: string) =>
  mustInstance(state, state.mainScheme.instanceId).counters[name] ?? 0;
const tallies = (state: GameState) =>
  Object.fromEntries(
    ["pinkA", "pinkB", "purple", "plain", "gameEnds"].map((name) => [name, counter(state, name)] as const),
  );
const valueFor = (state: GameState, value: ValueSpec, player = P1) =>
  resolveValue(state, value, { selfInstanceId: null, controllerId: player, event: null, bindings: {}, deps });

describe("tagged abilities ('speech bubbles')", () => {
  it("resolve one: the player picks among every tagged ability in play, flavor ones included, and only it resolves", () => {
    const { state, b } = start();
    const asked: string[][] = [];
    const { state: after } = playAction(state, RESOLVE_ONE.card, (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "chooseOption") return defaultPick(s);
      asked.push(choice.options.map((o) => o.optionId));
      return [choice.options.find((o) => o.optionId === `${b}:${PINK_B.ref.id}`)!.optionId];
    });
    // Three pink bubbles (A's, B's and B's flavor one), no purple one, no untagged Special.
    expect(asked).toHaveLength(1);
    expect(asked[0]).toHaveLength(3);
    expect(asked[0]!.every((id) => !id.includes(PURPLE.ref.id) && !id.includes(PLAIN_SPECIAL.ref.id))).toBe(true);
    expect(tallies(after)).toEqual({ pinkA: 0, pinkB: 1, purple: 0, plain: 0, gameEnds: 0 });
  });

  it("resolve one with a single candidate takes it unasked; with none, nothing resolves", () => {
    const { state } = start();
    const { state: purple, events } = playAction(state, RESOLVE_ONE_PURPLE.card);
    expect(events.filter((e) => e.type === "choiceRequested")).toEqual([]);
    // P2's card: "in play" is every card in play, whoever controls it.
    expect(tallies(purple)).toEqual({ pinkA: 0, pinkB: 0, purple: 1, plain: 0, gameEnds: 0 });
    const { state: none } = playAction(state, RESOLVE_ONE_NONE.card);
    expect(tallies(none)).toEqual(tallies(state));
  });

  it("resolve all: every pink bubble in play, nothing else", () => {
    const { state } = start();
    const { state: after } = playAction(state, RESOLVE_ALL.card);
    expect(tallies(after)).toEqual({ pinkA: 1, pinkB: 1, purple: 0, plain: 0, gameEnds: 0 });
  });

  it("an untagged 'resolve the Special ability' never resolves a tagged one", () => {
    const { state } = start();
    const { state: after } = playAction(state, RESOLVE_SPECIALS.card);
    expect(tallies(after)).toEqual({ pinkA: 0, pinkB: 0, purple: 0, plain: 1, gameEnds: 0 });
  });

  it("counts: the tagged abilities on cards you control, each one, flavor included; in play; blanked text has none", () => {
    const { state } = start();
    const yours = { kind: "taggedAbilities", tag: "pinkBubble", cards: { controller: "you" } } as const;
    expect(valueFor(state, yours)).toBe(3);
    expect(valueFor(state, yours, P2)).toBe(0);
    expect(valueFor(state, { kind: "taggedAbilities", tag: "purpleBubble" })).toBe(1);
    expect(valueFor(state, { kind: "taggedAbilities", tag: "nothing" })).toBe(0);
    const { state: blanked } = playAction(state, BLANK_A.card);
    expect(valueFor(blanked, yours)).toBe(2);
  });

  it("a hit point modifier reads the count live: +1 per purple bubble in play, its own included", () => {
    const { state } = start();
    const evil = minionEngagedWith(state, EVIL.id);
    // Printed 3, +2: its own purple bubble and P2's card's.
    expect(maxHitPoints(evil.state, evil.id, deps)).toBe(5);
    const { state: resolved } = playAction(evil.state, RESOLVE_ONE_PURPLE.card);
    // Resolving a bubble does not use it up.
    expect(maxHitPoints(resolved, evil.id, deps)).toBe(5);
  });

  it("matches: a card in hand or in play with a tagged ability, and not one without", () => {
    const { state, a, p } = start();
    const inHand = giveCard(state, P1, CARD_B.id);
    const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
    const pink = { hasTaggedAbility: "pinkBubble" };
    expect(matchesQuery(inHand.state, inHand.id, pink, context)).toBe(true);
    expect(matchesQuery(state, a, pink, context)).toBe(true);
    expect(matchesQuery(state, p, pink, context)).toBe(false);
    expect(matchesQuery(state, p, { hasTaggedAbility: "purpleBubble" }, context)).toBe(true);
  });

  it("a card removed from the game resolves its own bubble with those in play (`of` with `cards`)", () => {
    const { state } = start();
    const placed = playerCardIntoPlay(state, GAME_ENDS.id);
    const driven = driveSession(startSession(placed.state), deps, [
      { type: "useAbility", playerId: P1, cardInstanceId: placed.id, abilityId: GAME_ENDS_ACTION.ref.id, payment: [] },
    ]);
    const after = driven.session.state;
    expect(after.removedFromGame).toContain(placed.id);
    expect(tallies(after)).toEqual({ pinkA: 1, pinkB: 1, purple: 0, plain: 0, gameEnds: 1 });
  });
});
