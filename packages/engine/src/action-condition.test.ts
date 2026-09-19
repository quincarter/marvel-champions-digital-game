/**
 * docs/phase7-wave2.md §16: an action's pre-cost condition (`trigger.while`) — "Hero Action: If you are in Tiny hero
 * form, exhaust Army of Ants → deal 1 damage to an enemy." Synthetic cards; the condition here is "if you are in hero
 * form" so a form change toggles it, with no `form` gate of its own so the condition is the only thing in the way.
 *
 * Sources: RRG 1.8 "Play Restrictions and Permissions" (p. 33): "specific conditions that must be true in order to use
 * them … In order to use an ability or play a card, all of its play restrictions must be observed"; "Initiating
 * Abilities" (p. 24): play restrictions are checked at step 2, before the cost is determined (step 3) or paid (step 5).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { playIgnoringCostFault, playWithPaymentFault } from "./actions.js";
import type { Command } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const toHero: Command = { type: "changeForm", playerId: p1 };
const ifHero: Predicate = { kind: "form", player: { kind: "controller" }, form: "hero" };
const draw = [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }] as const;

/** "Action: If you are in hero form, exhaust Gizmo → draw 1 card." */
const GIZMO_ABILITY = stubAbility("gizmo.action", def({ trigger: { kind: "action", while: ifHero }, cost: { exhaustSelf: true }, effects: [...draw] }));
const GIZMO = stubSupport({ id: "gizmo", cost: 0, abilities: [GIZMO_ABILITY.ref] });
/** An event: "Action: If you are in hero form, draw 1 card." */
const TRICK_ABILITY = stubAbility("trick.action", def({ trigger: { kind: "action", while: ifHero }, effects: [...draw] }));
const TRICK = stubEvent({ id: "trick", cost: 0, abilities: [TRICK_ABILITY.ref] });

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

function setup(): { deps: EngineDeps; state: GameState } {
  const deps = depsOf(GIZMO_ABILITY, TRICK_ABILITY);
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] }),
    mainScheme: stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }] }),
    extraCards: [BLANK, GIZMO, TRICK],
    deck: [...copies(GIZMO.id), ...copies(TRICK.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  return { deps, state };
}

const play = (id: InstanceId): Command => ({ type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null });
const use = (id: InstanceId): Command => ({ type: "useAbility", playerId: p1, cardInstanceId: id, abilityId: GIZMO_ABILITY.ref.id, payment: [] });
const turnActions = (state: GameState, deps: EngineDeps) => {
  const actions = legalActions(state, p1, deps);
  if (actions.kind !== "turn") throw new Error(`expected the player's turn, got ${actions.kind}`);
  return actions;
};

describe("§16 an action's pre-cost condition ('If you are in Tiny hero form, exhaust … →')", () => {
  it("on a card in play: refused with nothing paid while false, listed as illegal, and usable once true", () => {
    const { deps, state } = setup();
    const given = giveCards(state, p1, "gizmo");
    const gizmo = given.ids[0] as InstanceId;
    const inPlay = runWith(deps, given.state, play(gizmo));

    // Alter-ego form: the condition is false.
    const refused = applyCommand(inPlay, use(gizmo), deps);
    expect(refused.ok ? null : refused.error.code).toBe("no_valid_target");
    // The cost was never paid (RRG 1.8 p. 24: restrictions are step 2, payment step 5).
    expect(mustInstance(inPlay, gizmo).exhausted).toBe(false);
    // `legalActions` trial-runs the real command, so it reports the action as illegal, with the engine's reason.
    const before = turnActions(inPlay, deps);
    const isGizmo = (a: { action: { kind: string } }) => a.action.kind === "useAbility" && "instanceId" in a.action && a.action.instanceId === gizmo;
    expect(before.legal.some(isGizmo)).toBe(false);
    expect(before.illegal.find(isGizmo)?.reason).toBe("no_valid_target");

    // Hero form: the condition holds.
    const hero = runWith(deps, inPlay, toHero);
    expect(turnActions(hero, deps).legal.some(isGizmo)).toBe(true);
    const hand = mustPlayer(hero, p1).hand.length;
    const used = runWith(deps, hero, use(gizmo));
    expect(mustInstance(used, gizmo).exhausted).toBe(true);
    expect(mustPlayer(used, p1).hand.length).toBe(hand + 1);
  });

  it("on an event: every way of playing it is refused while false (playCard, and both effect-play paths)", () => {
    const { deps, state } = setup();
    const given = giveCards(state, p1, "trick");
    const trick = given.ids[0] as InstanceId;

    const refused = applyCommand(given.state, play(trick), deps);
    expect(refused.ok ? null : refused.error.code).toBe("no_valid_target");
    const isTrick = (a: { action: { kind: string } }) => a.action.kind === "playCard" && "instanceId" in a.action && a.action.instanceId === trick;
    expect(turnActions(given.state, deps).legal.some(isTrick)).toBe(false);
    expect(playIgnoringCostFault(createCtx(given.state, deps), p1, trick)).toBe("its condition is not met");
    expect(playWithPaymentFault(createCtx(given.state, deps), p1, trick, 0)).toBe("its condition is not met");

    const hero = runWith(deps, given.state, toHero);
    expect(turnActions(hero, deps).legal.some(isTrick)).toBe(true);
    expect(playIgnoringCostFault(createCtx(hero, deps), p1, trick)).toBeNull();
    expect(playWithPaymentFault(createCtx(hero, deps), p1, trick, 0)).toBeNull();
    expect(applyCommand(hero, play(trick), deps).ok).toBe(true);
  });
});
