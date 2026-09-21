/**
 * docs/phase7-wave1.md §3.16, the "verify, don't rebuild" list. Most of it was already proven elsewhere (Guard
 * across every villain in `multi-villain.test.ts`, the keywords in `keywords.test.ts`, prevention and cancellation in
 * `replacement.test.ts`, `resolveSpecials` / `payPrintedCostOf` / `tuckCards` in `separate-deck.test.ts` and
 * `player-cards.test.ts`, `enemyAttack { against }` in `enemy-actions.test.ts`). This file covers the two items that
 * turned out not to be covered, and pins the rule each one follows.
 *
 * Sources: RRG 1.8 "Search" / "Deck" (p. 15), "Stun" (p. 41), "Labeled Ability" (p. 26); FAQ "Dance of Death (#4)"
 * (p. 59).
 */

import { flat, trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO } from "./testing/scenario.js";

const p1 = playerId("p1");
const you = { kind: "controller" } as const;
const villainRef = { kind: "villain" } as const;
const two = { kind: "const", value: 2 } as const;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const MYSTIC = trait("Mystic");

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
/** The card a search looks for, in the deck and in the discard pile. */
const RELIC = stubUpgrade({ id: "relic", cost: 0, traits: [MYSTIC] });

const action = (id: string, effects: readonly EffectSpec[], label?: readonly "attack"[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, ...(label ? { label } : {}), effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};

/** "Search your deck and discard pile for a [Mystic] card and add it to your hand." (Mystical Studies, For Asgard!) */
const SEARCH = action("search", [
  {
    kind: "chooseCards",
    slot: "found",
    from: { kind: "zone", zone: ["deck", "discard"], player: you, filter: { trait: MYSTIC } },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "found" } }, to: "hand" },
  { kind: "shuffleDeck", player: you },
]);

/**
 * Dance of Death: "the first sentence of [its] ability defines each damage-dealing effect … as an individual attack"
 * and the card carries no "(attack)" label (FAQ #4), so this ability is deliberately unlabeled.
 */
const DANCE = action("dance", [
  { kind: "attack", target: villainRef, amount: two },
  { kind: "attack", target: villainRef, amount: two },
  { kind: "attack", target: villainRef, amount: two },
]);
/** The same three attacks on an "(attack)"-labeled ability, which the RRG cancels whole. */
const LABELLED = action(
  "labelled",
  [
    { kind: "attack", target: villainRef, amount: two },
    { kind: "attack", target: villainRef, amount: two },
    { kind: "attack", target: villainRef, amount: two },
  ],
  ["attack"],
);

const EVENTS = [SEARCH, DANCE, LABELLED];
const ABILITIES: readonly StubAbility[] = EVENTS.map((e) => e.ability);
const deps: EngineDeps = depsOf(...ABILITIES);

function game(): GameState {
  const result = createGame(
    {
      seed: 21,
      cards: [...DEFAULT_CARDS, VILLAIN, SCHEME, BLANK, RELIC, ...EVENTS.map((e) => e.card)],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: copies(BLANK.id, 12),
      includeIdentitySets: false,
      players: [
        { identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...copies(RELIC.id, 2), ...EVENTS.map((e) => e.card.id)] },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const ok = (state: GameState, command: Command): GameState => {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
};

const playCommand = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const stunned = (state: GameState): GameState => {
  const identity = mustPlayer(state, p1).identity.instanceId;
  return {
    ...state,
    instances: {
      ...state.instances,
      [identity]: { ...mustInstance(state, identity), statuses: { stunned: 1, confused: 0, tough: 0 } },
    },
  };
};

describe("§3.16 verification: searching a deck and a discard pile together", () => {
  it("offers one choice over both zones (RRG 1.8 'Search': the whole searched area is one pool)", () => {
    const start = game();
    // Test surgery: exactly one copy in the deck and one in the discard pile, wherever the opening draw left them.
    const player = mustPlayer(start, p1);
    const [inDeck, other] = [...player.deck, ...player.hand].filter(
      (id) => mustInstance(start, id).cardId === RELIC.id,
    ) as [InstanceId, InstanceId];
    const seeded: GameState = {
      ...start,
      players: start.players.map((p) =>
        p.playerId === p1
          ? {
              ...p,
              hand: p.hand.filter((id) => id !== inDeck && id !== other),
              deck: [inDeck, ...p.deck.filter((id) => id !== inDeck && id !== other)],
              discard: [other, ...p.discard],
            }
          : p,
      ),
    };

    const given = giveCard(seeded, p1, SEARCH.card.id);
    const atChoice = ok(given.state, playCommand(given.id));
    const options = atChoice.pendingChoice?.options.map((option) => option.optionId) ?? [];
    // Both copies are offered at once: the one in the deck and the one in the discard pile.
    expect(options).toEqual(expect.arrayContaining([inDeck, other]));

    const found = ok(atChoice, {
      type: "resolveChoice",
      playerId: p1,
      choiceId: atChoice.pendingChoice!.choiceId,
      selectedOptionIds: [other],
    });
    expect(mustPlayer(found, p1).hand).toContain(other);
    expect(mustPlayer(found, p1).discard).not.toContain(other);
  });
});

describe("§3.16 verification: a stun against an ability that makes several attacks", () => {
  it("cancels only the first attack, and the rest are performed as normal (FAQ 'Dance of Death (#4)')", () => {
    const start = game();
    const villain = start.villains[0]?.instanceId as InstanceId;
    const identity = mustPlayer(start, p1).identity.instanceId;

    const unstunned = giveCard(start, p1, DANCE.card.id);
    const clean = runCommands(unstunned.state, deps, playCommand(unstunned.id)).state;
    expect(mustInstance(clean, villain).damage).toBe(6);

    const given = giveCard(stunned(start), p1, DANCE.card.id);
    const after = runCommands(given.state, deps, playCommand(given.id)).state;
    // The first attack is spent cancelling the stun; the second and third land.
    expect(mustInstance(after, villain).damage).toBe(4);
    expect(mustInstance(after, identity).statuses.stunned).toBe(0);
  });

  it("an '(attack)'-labeled ability is still cancelled whole, which is what the missing label distinguishes", () => {
    const start = game();
    const villain = start.villains[0]?.instanceId as InstanceId;
    const identity = mustPlayer(start, p1).identity.instanceId;
    const given = giveCard(stunned(start), p1, LABELLED.card.id);
    const after = runCommands(given.state, deps, playCommand(given.id)).state;
    expect(mustInstance(after, villain).damage).toBe(0);
    expect(mustInstance(after, identity).statuses.stunned).toBe(0);
  });
});
