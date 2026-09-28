/**
 * `Predicate` `paidWith.of` / `paidWithOnly.of`: another card's interrupt reading how the card being played was paid
 * for. "Interrupt: When you play an Aggression Attack event, if you paid for that event using a [mental] resource,
 * increase the amount of damage that event deals by its printed cost" (Honed Technique, `nova` 28017). Proven with
 * synthetic cards.
 *
 * Sources: RRG 1.8 "Cost" (p. 13: resources spent are paid for that card), "Event" (p. 19: a modifier to the damage an
 * event deals applies to each instance), "Wild Resource" (p. 48); FAQ "Embiggen (#10)" (p. 59).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const eventTarget: TargetRef = { kind: "eventTarget" };
const villainRef: TargetRef = { kind: "villain" };
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(50), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

/** "When you play an event, if you paid for that event using a [mental] resource, increase the damage … by its printed cost." */
const technique = (id: string, condition: Predicate) =>
  stubAbility(`${id}.interrupt`, {
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
    },
    effects: [
      {
        kind: "if",
        condition,
        then: [{ kind: "modifyCardEffect", card: eventTarget, damage: { kind: "printedCost", of: eventTarget } }],
      },
    ],
  });
const TECHNIQUE = technique("technique", { kind: "paidWith", resource: "mental", of: eventTarget });
const TECHNIQUE_CARD = stubUpgrade({ id: "technique", cost: 0, abilities: [TECHNIQUE.ref] });
/** The `paidWithOnly` twin: "if you paid for that event using only [mental] resources". */
const PURIST = technique("purist", { kind: "paidWithOnly", resource: "mental", of: eventTarget });
const PURIST_CARD = stubUpgrade({ id: "purist", cost: 0, abilities: [PURIST.ref] });
/** Without `of`: the ability's own vars, which an upgrade already in play never has (the gap `of` closes). */
const OWN_VARS = technique("own-vars", { kind: "paidWith", resource: "mental" });
const OWN_VARS_CARD = stubUpgrade({ id: "own-vars", cost: 0, abilities: [OWN_VARS.ref] });

/** A cost-2 event that deals 1 damage to the villain twice: two instances, each modified. */
const DOUBLE_TAP_ACTION = stubAbility("double-tap.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "dealDamage", target: villainRef, amount: { kind: "const", value: 1 } },
    { kind: "dealDamage", target: villainRef, amount: { kind: "const", value: 1 } },
  ],
});
const DOUBLE_TAP = stubEvent({ id: "double-tap", cost: 2, abilities: [DOUBLE_TAP_ACTION.ref] });

const MENTAL = stubEvent({ id: "mental-card", cost: 9, resourceIcons: { mental: 1 } });
const PHYSICAL = stubEvent({ id: "physical-card", cost: 9, resourceIcons: { physical: 1 } });
const WILD = stubEvent({ id: "wild-card", cost: 9, resourceIcons: { wild: 1 } });

const deps: EngineDeps = depsOf(TECHNIQUE, PURIST, OWN_VARS, DOUBLE_TAP_ACTION);
const PLAYER_CARDS = [TECHNIQUE_CARD, PURIST_CARD, OWN_VARS_CARD, DOUBLE_TAP, MENTAL, PHYSICAL, WILD];
/** Two of each resource card, so a payment can spend two of the same type. */
const PLAYER_DECK = [...PLAYER_CARDS.map((c) => c.id), MENTAL.id, PHYSICAL.id];

function game(): GameState {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 4,
      cards: [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, ...PLAYER_CARDS, ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: LONG_SCHEME.id,
      encounterDeck: copies(BLANK.id, 16),
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, ...PLAYER_DECK],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const playCard = (id: InstanceId, payment: readonly InstanceId[] = []): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: payment.map((fromHand) => ({ fromHand })),
  attachToInstanceId: null,
});

/** Puts `upgrade` into play, then plays the cost-2 event paid for with one card of each of `payWith`. */
function playDoubleTap(upgrade: CardId, payWith: readonly [CardId, CardId]): number {
  const start = game();
  const withUpgrade = giveCard(start, p1, upgrade);
  const inPlay = runCommands(withUpgrade.state, deps, playCard(withUpgrade.id)).state;
  const event = giveCard(inPlay, p1, DOUBLE_TAP.id);
  const first = giveCard(event.state, p1, payWith[0]);
  const second = giveCard(first.state, p1, payWith[1], [first.id]);
  const played = runCommands(second.state, deps, playCard(event.id, [first.id, second.id])).state;
  return mustInstance(played, played.villains[0]?.instanceId as InstanceId).damage;
}

describe("paidWith.of: an interrupt reading the payment of the card being played", () => {
  it("paid with a [mental] resource: each damage instance goes up by the event's printed cost", () => {
    // Two instances of 1, each increased by 2 (printed cost 2): RRG 1.8 "Event" (p. 19), FAQ "Embiggen (#10)".
    expect(playDoubleTap(TECHNIQUE_CARD.id, [MENTAL.id, PHYSICAL.id])).toBe(6);
  });

  it("paid without a [mental] resource: unchanged", () => {
    expect(playDoubleTap(TECHNIQUE_CARD.id, [PHYSICAL.id, PHYSICAL.id])).toBe(2);
  });

  it("a [wild] resource counts as [mental] (RRG 1.8 'Wild Resource', p. 48)", () => {
    expect(playDoubleTap(TECHNIQUE_CARD.id, [WILD.id, PHYSICAL.id])).toBe(6);
  });

  it("paidWithOnly.of: only when every resource paid for that event was [mental]", () => {
    expect(playDoubleTap(PURIST_CARD.id, [MENTAL.id, MENTAL.id])).toBe(6);
    expect(playDoubleTap(PURIST_CARD.id, [MENTAL.id, PHYSICAL.id])).toBe(2);
  });

  it("without `of`, the interrupt's own frame has no payment: an upgrade in play reads as paid with nothing", () => {
    expect(playDoubleTap(OWN_VARS_CARD.id, [MENTAL.id, MENTAL.id])).toBe(2);
  });
});
