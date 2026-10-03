import { applyCommand, legalActions, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { CORE_DEPS } from "../index.js";
import { coreScenario } from "../setup.js";
import {
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  settle,
  startCoreGame,
  toHero,
  use,
} from "../../testing/harness.js";

/**
 * Focused Rage (`01027`): "Hero Action: Exhaust Focused Rage and take 1 damage → draw 1 card." Its "take 1 damage" is a
 * cost (`takeDamageCost`). RRG 1.8 "Cost" (p. 14): "If taking damage is a cost, that cost is not considered paid unless
 * all of that damage was taken." FAQ "Focused Rage (#27)" (p. 57): "If She-Hulk has a tough status card, can she use
 * Focused Rage to draw a card? A: No. The tough status card prevents She-Hulk from 'tak[ing] 1 damage,' so the
 * ability's cost cannot be paid. Because you cannot partially pay a cost, you cannot attempt to pay the cost of Focused
 * Rage's ability just to remove She-Hulk's tough status card."
 */
const ABILITY = "01027.focused-rage-action";

function withFocusedRage(): { readonly state: GameState; readonly rage: InstanceId } {
  const start = startCoreGame(
    coreScenario("rhino", { players: [{ starterDeckId: "core-she-hulk-aggression" }], seed: 21 }),
  );
  const given = moveToHand(start, P1, "01027");
  const [rage] = given.ids as [InstanceId];
  const hero = settle(run(given.state, toHero())); // declines "Do You Even Lift?"
  return { state: run(hero, play(P1, rage, payWith(hero, P1, 3, given.ids))), rage };
}

const offered = (state: GameState, rage: InstanceId): boolean => {
  const actions = legalActions(state, P1, CORE_DEPS);
  return (
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === rage)
  );
};

describe("She-Hulk: Focused Rage's take-1-damage cost (FAQ #27)", () => {
  it("control: She-Hulk takes the 1 damage and draws 1 card", () => {
    const { state, rage } = withFocusedRage();
    expect(offered(state, rage)).toBe(true);
    const hand = playerOf(state, P1).hand.length;
    const damage = inst(state, identityOf(state)).damage;
    const after = settle(run(state, use(P1, rage, ABILITY)));
    expect(inst(after, identityOf(after)).damage).toBe(damage + 1);
    expect(playerOf(after, P1).hand.length).toBe(hand + 1);
    expect(inst(after, rage).exhausted).toBe(true);
  });

  it("with a tough status card she cannot use it: not offered, refused, the tough card stays", () => {
    const { state: base, rage } = withFocusedRage();
    const hero = identityOf(base);
    const state = patchInstance(base, hero, { statuses: { ...inst(base, hero).statuses, tough: 1 } });
    expect(offered(state, rage)).toBe(false);
    expect(applyCommand(state, use(P1, rage, ABILITY), CORE_DEPS).ok).toBe(false);
    expect(inst(state, hero).statuses.tough).toBe(1);
    expect(inst(state, rage).exhausted).toBe(false);
  });
});
