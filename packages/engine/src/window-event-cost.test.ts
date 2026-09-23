/**
 * A card playable only at its own printed trigger window (Crosscounter, Knife Leap, `drax` 19005: no standalone
 * "Hero Action", so it's never played via a plain `playCard` — only offered when its own interrupt/response
 * pattern matches) is priced by `windowEventCost` (`resolve/window.ts`), a separate cost computation from
 * `pricePlay`'s own `ownPlayCost`. Before this fix, `windowEventCost` read only `costReductionFor`'s older
 * "reduce the next card you play" lasting-effect mechanism, never the `CostModifierSpec` constant-rule system
 * `playCostContributions`/`playCostModifier` already serve every *normally* played card — so a printed "Reduce
 * the cost to play this card by X" constant (Hercules/Winter Soldier's own shape, `activeIn: "hand"`) silently
 * never applied to a card played this way, even though the same reduction was already correctly honored once
 * payment actually committed (`playWindowEvent` calls `pricePlay`). The displayed `payForCard` prompt cost and
 * the actually-payable cost disagreed.
 */
import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { applyCommand, sessionApply, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustPlayer } from "./query.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

// "attack" is an interruptible event (`isAnnouncement`, `trigger-events.ts`); "formChanged" is response-only —
// the same shape the real card (Knife Leap, "Hero Interrupt: When you make a basic attack, …") uses.
const TRIGGER = stubAbility("reduced-event.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "attack", playerIs: "controller" } },
  effects: [],
});
const REDUCTION = stubAbility("reduced-event.constant", {
  trigger: {
    kind: "constant",
    costModifiers: [{ delta: -2, appliesTo: { self: true }, activeIn: "hand" }],
  },
  effects: [],
});
const REDUCED_EVENT = stubEvent({ id: "reduced-event", cost: 3, abilities: [TRIGGER.ref, REDUCTION.ref] });

const deps = depsOf(TRIGGER, REDUCTION);

const changeForm = (): Command => ({ type: "changeForm", playerId: P1 });
const attack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

describe("windowEventCost reads CostModifierSpec constants the same way ownPlayCost does", () => {
  it("reduces the payForCard prompt's own cost, not just the printed cost", () => {
    const base = gameAtFirstTurn({ cards: [REDUCED_EVENT], deps, deck: [REDUCED_EVENT.id] });
    const given = giveCard(base, P1, REDUCED_EVENT.id);
    // Into hero form first (a plain, fully-resolved command with nothing pending) before the basic attack that
    // opens the interrupt window under test.
    const toHero = applyCommand(given.state, changeForm(), deps);
    if (!toHero.ok) throw new Error(toHero.error.message);
    const attacker = mustPlayer(toHero.state, P1).identity.instanceId;
    const target = activeVillain(toHero.state).instanceId;
    const session = startSession(toHero.state);
    // `sessionApply` directly (not `driveSession`, which auto-answers every pending choice with a default policy
    // before returning) — the point of this test is to inspect the `payForCard` prompt itself, mid-resolution.
    const afterAttack = sessionApply(session, attack(attacker, target), deps);
    if (!afterAttack.ok) throw new Error(afterAttack.error.message);
    const choice = afterAttack.session.state.pendingChoice;
    if (!choice) throw new Error("no pending choice after the attack");
    let payingState = afterAttack.session.state;
    // A single candidate may resolve straight to `payForCard` with no `chooseTriggers` step in between.
    if (choice.prompt.kind === "chooseTriggers") {
      const offer = choice.options.find((o) => o.optionId.endsWith(`:${TRIGGER.ref.id}`));
      if (!offer) throw new Error("Knife-Leap-shaped interrupt not offered");
      const accepted = applyCommand(
        payingState,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: [offer.optionId],
        },
        deps,
      );
      if (!accepted.ok) throw new Error(accepted.error.message);
      payingState = accepted.state;
    }
    const paying = payingState.pendingChoice;
    if (paying?.prompt.kind !== "payForCard") throw new Error(`expected payForCard, got ${paying?.prompt.kind}`);
    // Printed cost 3, reduced by 2 from the constant's own `CostModifierSpec` (`activeIn: "hand"`).
    expect(paying.prompt.cost).toBe(1);
  });
});
