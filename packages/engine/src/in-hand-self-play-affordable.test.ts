/**
 * An in-hand interrupt that plays its own card (`playsOwnCardFromHand`) is offered only while the card could be played
 * and paid for (`ownCardPlayFault`). Synthetic allies: "Interrupt: When your turn would end, play this card from your
 * hand (paying its resource cost)."
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24), step 2: "the player checks that the cost can be paid … If the cost
 * cannot be paid, the process is aborted"; "Cost" (p. 13); "Play, Put Into Play" (p. 32): a card played by an ability
 * is still played, so its resource cost is paid.
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly } from "./testing/fixtures.js";
import { defaultPick, giveCard, RESOURCE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const inHandInterrupt = (id: string, play: EffectSpec, forced = false) =>
  stubAbility(id, {
    trigger: { kind: "interrupt", forced, on: { on: "turnEnding", playerIs: "controller" } },
    activeIn: "hand",
    effects: [play],
  } satisfies AbilityDefinition);
const paidPlay = { kind: "playFromHand", player: you, costReduction: { kind: "const", value: 0 } } as const;

/** Names its own card (`card: self`). */
const NAMED = inHandInterrupt("named.interrupt", { ...paidPlay, card: { kind: "self" } });
/** Filters the hand down to its own card (`filter: { self: true }`), which asks the one-card pick. */
const FILTERED = inHandInterrupt("filtered.interrupt", { ...paidPlay, filter: { self: true } });
/** "…, ignoring its resource cost": nothing to afford. */
const FREE = inHandInterrupt("free.interrupt", {
  kind: "playFromHand",
  player: you,
  ignoreCost: true,
  card: { kind: "self" },
});
const ally = (id: string, ability: StubAbility) =>
  stubAlly({ id, cost: 2, atk: 1, thw: 1, hp: 2, abilities: [ability.ref] });
const CARDS = { named: ally("named", NAMED), filtered: ally("filtered", FILTERED), free: ally("free", FREE) };

const deps = depsOf(NAMED, FILTERED, FREE);
const start = (): GameState =>
  gameAtFirstTurn({ cards: Object.values(CARDS), deps, deck: Object.values(CARDS).map((card) => card.id) });

/** P1 holding the named card and `resources` one-icon resource cards, nothing else. */
function holding(card: keyof typeof CARDS, resources: number): { state: GameState; id: InstanceId } {
  const given = giveCard(start(), P1, CARDS[card].id);
  const seat = mustPlayer(given.state, P1);
  const isResource = (id: InstanceId): boolean => given.state.instances[id]?.cardId === RESOURCE.id;
  const pool = [...seat.hand, ...seat.deck].filter(isResource).slice(0, resources);
  if (pool.length < resources) throw new Error("not enough resource cards");
  const hand = [given.id, ...pool];
  const rest = [...seat.hand, ...seat.deck].filter((id) => !hand.includes(id));
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand, deck: rest } : p)),
    },
  };
}

/** Ends the turn, taking every trigger offered and paying with everything offered. */
function endTurn(state: GameState) {
  const offers: string[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (!choice) return [];
    const ids = choice.options.map((o) => o.optionId);
    if (choice.prompt.kind === "chooseTriggers") {
      offers.push(...ids);
      return ids;
    }
    if (choice.prompt.kind === "spendResources" || choice.prompt.kind === "chooseCards") return ids;
    return defaultPick(current);
  };
  const driven = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
  return { state: driven.session.state, offers, events: driven.events };
}
const inPlay = (state: GameState, id: InstanceId): boolean => mustPlayer(state, P1).playArea.includes(id);

describe("an in-hand interrupt that plays its own card", () => {
  for (const form of ["named", "filtered"] as const) {
    it(`${form}: offered and played when the hand can pay its cost of 2`, () => {
      const { state, id } = holding(form, 2);
      const run = endTurn(state);
      expect(run.offers.some((offer) => offer.startsWith(id))).toBe(true);
      expect(inPlay(run.state, id)).toBe(true);
      expect(run.events.find((e) => e.type === "cardPlayed" && e.instanceId === id)).toMatchObject({
        resourcesPaid: 2,
      });
    });

    it(`${form}: not offered when the hand cannot pay (RRG p. 24, step 2)`, () => {
      const { state, id } = holding(form, 1);
      const run = endTurn(state);
      expect(run.offers.some((offer) => offer.startsWith(id))).toBe(false);
      expect(inPlay(run.state, id)).toBe(false);
      expect(mustPlayer(run.state, P1).hand).toContain(id);
    });
  }

  it("a play that ignores the cost is offered with nothing to pay with", () => {
    const { state, id } = holding("free", 0);
    const run = endTurn(state);
    expect(run.offers.some((offer) => offer.startsWith(id))).toBe(true);
    expect(inPlay(run.state, id)).toBe(true);
  });
});
