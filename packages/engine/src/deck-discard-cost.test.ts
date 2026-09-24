/**
 * docs/phase7-wave3.md §3.33: "Discard the top N cards of your deck →" as a cost (`AbilityCost.discardFromDeck`).
 * Synthetic cards shaped like Booster Boots (`gmw` 16052): "Hero Interrupt: When you would take any amount of damage
 * from an attack, exhaust Booster Boots and discard the top card of your deck → prevent 1 of that damage."
 *
 * Sources: RRG 1.8 "Player Deck" (p. 33): "If a player deck empties, the player shuffles their discard pile to make a
 * new deck. That player immediately deals themself one facedown encounter card"; "If a player deck empties and the
 * player has no cards in their discard pile, the deck does not reset until there is at least one card in the
 * player's discard pile". Ruling, Apr 30, 2026 (3) answer 7: "The deck is reshuffled **before** the currently
 * resolving card enters the discard pile." RRG 1.8 "Cost" (p. 13): a cost is paid in full.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState, PlayerState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const you = { kind: "controller" } as const;

const BOOTS_ABILITY = stubAbility(
  "boots.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      form: "hero",
      on: { on: "dealDamage", fromAttack: true, targetIs: { categories: ["identity"], controller: "you" } },
    },
    cost: { exhaustSelf: true, discardFromDeck: 1 },
    effects: [{ kind: "preventDamage", amount: { kind: "const", value: 1 } }],
  }),
);
const BOOTS = stubUpgrade({ id: "boots", cost: 0, abilities: [BOOTS_ABILITY.ref] });
/** "The villain attacks you." — an enemy attack during p1's own turn, with no boost card. */
const PROVOKE_ABILITY = stubAbility(
  "provoke.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: you, boost: false }],
  }),
);
const PROVOKE = stubEvent({ id: "provoke", cost: 0, abilities: [PROVOKE_ABILITY.ref] });
const deps = depsOf(BOOTS_ABILITY, PROVOKE_ABILITY);

/** p1 in hero form, Booster Boots in play, Provoke in hand; `piles` rearranges their deck and discard pile (surgery). */
function start(piles: (seat: PlayerState) => Pick<PlayerState, "deck" | "discard">): {
  state: GameState;
  boots: InstanceId;
  provoke: InstanceId;
} {
  const base = gameAtFirstTurn({ cards: [BOOTS, PROVOKE], deps, deck: [BOOTS.id, PROVOKE.id] });
  const boots = playerCardIntoPlay(base, BOOTS.id);
  const provoke = giveCard(boots.state, P1, PROVOKE.id);
  const state: GameState = {
    ...provoke.state,
    players: provoke.state.players.map((p) =>
      p.playerId === P1 ? { ...p, ...piles(p), identity: { ...p.identity, form: "hero" } } : p,
    ),
  };
  return { state, boots: boots.id, provoke: provoke.id };
}
const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
/** Uses Booster Boots whenever offered; takes the attack undefended. */
const useBoots = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "declareDefender") return ["decline"];
  const boots = choice?.options.find((o) => o.optionId.includes(BOOTS_ABILITY.ref.id));
  return boots ? [boots.optionId] : defaultPick(state);
};
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;
const offered = (events: readonly GameEvent[]): boolean =>
  events.some((e) => e.type === "abilityResolved" && e.abilityId === BOOTS_ABILITY.ref.id);

describe("§3.33 'discard the top card of your deck →' (Booster Boots)", () => {
  it("discards the top card as the cost and prevents 1 of the villain's 2 damage", () => {
    const { state, provoke } = start((p) => ({ deck: p.deck, discard: p.discard }));
    const top = mustPlayer(state, P1).deck[0]!;
    const { session, events } = driveSession(startSession(state), deps, [play(provoke)], useBoots);
    expect(offered(events)).toBe(true);
    expect(mustPlayer(session.state, P1).discard).toContain(top);
    expect(identityDamage(session.state)).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a deck the cost empties resets at once, dealing its encounter card before the damage (ruling, Apr 30, 2026 (3))", () => {
    const { state, provoke } = start((p) => ({
      deck: p.deck.slice(0, 1),
      discard: [...p.deck.slice(1), ...p.discard],
    }));
    const { session, events } = driveSession(startSession(state), deps, [play(provoke)], useBoots);
    expect(offered(events)).toBe(true);
    const seat = mustPlayer(session.state, P1);
    expect(seat.deck.length).toBeGreaterThan(0);
    // The resolving Provoke reaches the discard pile only after the reset, so it is not shuffled in (answer 7).
    expect(seat.discard).toEqual([provoke]);
    expect(seat.dealtEncounter).toHaveLength(1);
    const reshuffled = events.findIndex((e) => e.type === "deckShuffled");
    const damaged = events.findIndex((e) => e.type === "damageDealt");
    expect(reshuffled).toBeGreaterThanOrEqual(0);
    expect(reshuffled).toBeLessThan(damaged);
  });

  it("an empty deck with a discard pile is the deck the rules already reset: it pays from the new deck", () => {
    const { state, provoke } = start((p) => ({ deck: [], discard: [...p.deck, ...p.discard] }));
    const { session, events } = driveSession(startSession(state), deps, [play(provoke)], useBoots);
    expect(offered(events)).toBe(true);
    const seat = mustPlayer(session.state, P1);
    expect(seat.discard.filter((id) => id !== provoke)).toHaveLength(1);
    expect(seat.dealtEncounter).toHaveLength(1);
    expect(identityDamage(session.state)).toBe(1);
  });

  it("cannot be initiated with nothing to discard: an empty deck and an empty discard pile", () => {
    const { state, provoke } = start(() => ({ deck: [], discard: [] }));
    const { session, events } = driveSession(startSession(state), deps, [play(provoke)], useBoots);
    expect(offered(events)).toBe(false);
    expect(identityDamage(session.state)).toBe(2);
  });
});
