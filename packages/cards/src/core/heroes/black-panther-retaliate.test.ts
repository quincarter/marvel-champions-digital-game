/**
 * Black Panther's "Retaliate 1. (After this character is attacked, deal 1 damage to the attacking character.)" (Core
 * 01040a, hero side), RRG 1.8 "Retaliate X" (p. 38). Reported on Reddit as not working (#444): the engine dealt the
 * damage, but nothing the player read said so. The damage is marked `retaliate` so the log and recap can name it.
 */
import type { Command, GameEvent, GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { coreScenario } from "../setup.js";
import { applyOk, endTurn, firstLegal, identityOf, inst, run, startCoreGame, toHero } from "../../testing/harness.js";

/** Black Panther vs Rhino, ended his first turn in hero form, through the villain phase with every choice the first. */
function villainPhase(): { readonly state: GameState; readonly events: GameEvent[] } {
  const opened = startCoreGame(
    coreScenario("rhino", { players: [{ starterDeckId: "core-black-panther-protection" }], seed: 21 }),
  );
  let state = run(opened, toHero(), endTurn());
  const events: GameEvent[] = [];
  for (let guard = 0; state.pendingChoice && !(state.step.phase === "player" && state.round > 1); guard++) {
    if (guard > 200) throw new Error("villain phase did not finish");
    const choice = state.pendingChoice;
    const command: Command = {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: firstLegal(state),
    };
    const applied = applyOk(state, command);
    state = applied.state;
    events.push(...applied.events);
  }
  return { state, events };
}

const retaliations = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "damageDealt" && e.retaliate ? [e] : []));

describe("Black Panther's Retaliate 1 (#444)", () => {
  it("Rhino attacking Black Panther takes 1 damage back, marked as retaliate", () => {
    const { state, events } = villainPhase();
    const villain = state.activeVillainId!;
    const hero = identityOf(state);
    const back = retaliations(events);
    expect(back.length).toBeGreaterThan(0);
    for (const e of back) expect(e).toMatchObject({ targetInstanceId: villain, sourceInstanceId: hero, amount: 1 });
    expect(inst(state, villain).damage).toBe(back.length);
    // The attack's own damage to him is not marked.
    const onHero = events.filter((e) => e.type === "damageDealt" && e.targetInstanceId === hero);
    expect(onHero.length).toBeGreaterThan(0);
    expect(onHero.some((e) => e.type === "damageDealt" && e.retaliate)).toBe(false);
  });
});
