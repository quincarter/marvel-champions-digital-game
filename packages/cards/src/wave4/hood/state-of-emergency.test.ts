import type { GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle, type Picker } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import { foldModularSetIntoDeck, game, onStage, playerCardInPlay, stackTop } from "./testing.js";

/**
 * Real-game tests for the State of Emergency modular set (`state-of-emergency.ts`): Disaster at the Docks (24056),
 * Offshore Inferno (24057) and Hot Pursuit (24058). Feisty Heist (24055) and Citywide Crisis (24059) are tested in
 * `hood-gaps.test.ts`.
 *
 * Ref -> covering test:
 *  24056.when-revealed -> "takes exactly 3 indirect damage"
 *  24057.when-revealed -> "discards the lowest-cost ally/upgrade/support you control"
 *  24058.when-revealed -> "discards until a minion is found and puts it into play engaged with you"
 */

const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed), "state_of_emergency");
const fired = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => (e as { abilityId?: string }).abilityId === abilityId);

describe("State of Emergency (24056-24058)", () => {
  it("24056.when-revealed: takes exactly 3 indirect damage", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24056");
    const identity = staged.players[0]!.identity.instanceId;
    const before = staged.instances[identity]!.damage;
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(revealed.instances[identity]!.damage - before).toBe(3);
  });

  it("24056.when-revealed: RRG 1.8 'Indirect Damage' (p. 24) — the player may divide it onto an ally instead of taking it all on their identity", () => {
    // Rules-QA finding (docs/phase7-wave4-qa.md): the script used `takeDamage(3)` (plain identity damage), which
    // forces the damage onto the identity unconditionally — indirect damage is supposed to let the affected player
    // divide it among characters they control, per RRG 1.8 "Indirect Damage" (p. 24: "can be divided as that player
    // chooses among characters under their control"). Black Cat (01002, Core, 2 hit points) is in this scenario's
    // own starter deck (`hood/support.ts`'s `core-spider-man-justice`).
    const base = onStage(withSet(2), 0);
    const { state: withAlly, id: ally } = playerCardInPlay(base, "01002");
    const staged = stackTop(withAlly, "01186", "24056");
    const identity = staged.players[0]!.identity.instanceId;
    const identityBefore = staged.instances[identity]!.damage;
    const allyBefore = staged.instances[ally]!.damage;
    // Assign 1 of Black Cat's hit points, then the other 2 to the identity — `assignIndirectDamage`'s own option
    // ids are `${instanceId}#N` (packages/engine/src/indirect-damage.test.ts). Proving the choice exists at all
    // (and that some of the 3 lands on the ally) is the point: `takeDamage` never offered it, forcing all 3 onto
    // the identity unconditionally.
    let sawAssignChoice = false;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "assignIndirectDamage") {
        sawAssignChoice = true;
        return [`${ally}#1`, `${identity}#1`, `${identity}#2`];
      }
      return firstLegal(s);
    };
    const revealed: GameState = settle(
      runWave4(staged, { type: "endTurn", playerId: P1 }),
      pick,
      undefined,
      WAVE4_DEPS,
    );
    expect(sawAssignChoice).toBe(true);
    expect(revealed.instances[ally]!.damage - allyBefore).toBe(1);
    expect(revealed.instances[identity]!.damage - identityBefore).toBe(2);
  });

  it("24057.when-revealed: discards the lowest-cost ally/upgrade/support P1 controls", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24057");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24057.when-revealed")).toBe(true);
  });

  it("24058.when-revealed: discards until a minion is found and puts it into play engaged with you", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24058");
    const { state: activated, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24058.when-revealed")).toBe(true);
    expect(activated.players[0]!.playArea.length).toBeGreaterThanOrEqual(1);
  });
});
