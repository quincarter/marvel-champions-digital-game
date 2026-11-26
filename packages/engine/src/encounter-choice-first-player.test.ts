/**
 * Regression (#1012 §8): a choice an encounter card gives to "you" / "its controller" (`chooser: controller`) while no
 * player is resolving the card goes to the first player instead of to nobody (`resolveChooser`, `villain/authority.ts`).
 *
 * RRG 1.8 "First Player" (p. 19): "If an encounter card requires a card ability to be resolved, a game function to be
 * performed, or a choice to be made but does not specify which player should act, the first player does so." RRG 1.8
 * "Ownership and Control" (p. 31): "Encounter cards are considered to be under the control of the scenario."
 *
 * Synthetic scheme: stage 1B's "Forced Response: After the villain phase begins, choose an identity; deal 1 damage to
 * it." Nothing about the phase names a player, so the frame has no controller.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import { replay, startSession } from "./engine.js";
import type { PendingChoice } from "./choices.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const STRIKE = stubAbility("strike.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
  effects: [
    {
      kind: "chooseTarget",
      slot: "struck",
      query: { categories: ["identity"] },
      chooser: { kind: "controller" },
    },
    { kind: "dealDamage", target: { kind: "slot", slot: "struck" }, amount: { kind: "const", value: 1 } },
  ],
});
const SCHEME = stubMainScheme({
  id: "strike-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(20), acceleration: flat(0), abilities: [STRIKE.ref] }],
});
const deps = depsOf(STRIKE);

describe("RRG 1.8 'First Player' p. 19: an encounter card's choice with no player named goes to the first player", () => {
  it("the forced response's 'choose an identity' is asked of the first player and resolves", () => {
    const start: GameState = gameAtFirstTurn({ cards: [SCHEME], deps, mainScheme: SCHEME, players: 2 });
    const asked: PendingChoice[] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTarget" && choice.prompt.slot === "struck") asked.push(choice);
      return defaultPick(state);
    };
    const identities = [P1, P2].map((p) => mustPlayer(start, p).identity.instanceId);
    const damageBefore = identities.map((id) => mustInstance(start, id).damage);

    const { session } = driveSession(
      startSession(start),
      deps,
      [
        { type: "endTurn", playerId: P1 },
        { type: "endTurn", playerId: P2 },
      ],
      pick,
    );
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);

    expect(asked.length).toBeGreaterThan(0);
    expect(asked[0]!.playerId).toBe(start.firstPlayerId);
    expect(asked[0]!.options).toHaveLength(2); // both identities, so the choice was asked
    // The chosen identity took the damage (it would have been skipped with no chooser).
    const dealt = identities.reduce((sum, id, i) => sum + mustInstance(session.state, id).damage - damageBefore[i]!, 0);
    expect(dealt).toBe(1);
  });
});
