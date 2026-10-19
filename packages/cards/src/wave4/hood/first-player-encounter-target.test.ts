import { maxHitPoints } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, P2, firstLegal, settle } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  foldModularSetIntoDeck,
  game,
  heroified,
  damageDealt,
  minionEngagedWith,
  onStage,
  patchInstance,
  playerCardInPlay,
  stackTop,
} from "./testing.js";

/**
 * E32 (docs/phase7-wave11-scenarios.md §S7 item 37; RRG 1.8 "First Player", p. 19): an encounter card's target among
 * several eligible cards, where the card does not print "choose", is selected by the first player even when the pool
 * is "a character you control" ("you control" defines the pool, not the chooser).
 *
 * Double Trouble (24017) prints "Stun a character you control." Boosting the villain's attack on P2, "you" is P2 (the
 * defending player), so the pool is P2's identity and ally, yet P1, the first player, is the one asked.
 */
describe("E32: encounter-side targets go to the first player", () => {
  it("24017.boost: boosting an attack on P2, the first player (P1) is asked which of P2's characters to stun", () => {
    const base = heroified(
      heroified(
        onStage(
          foldModularSetIntoDeck(game(1, [{ starterDeckId: "core-black-panther-protection" }]), "beasty_boys"),
          0,
        ),
        P1,
      ),
      P2,
    );
    const withAlly = playerCardInPlay(base, "01083", P2);
    const staged = stackTop(withAlly.state, "24016", "24017");
    const p1Identity = staged.players[0]!.identity.instanceId;
    const p2Identity = staged.players[1]!.identity.instanceId;
    const asked = settle(
      runWave4(runWave4(staged, { type: "endTurn", playerId: P1 }), { type: "endTurn", playerId: P2 }),
      firstLegal,
      (s) =>
        s.pendingChoice?.prompt.kind === "chooseTarget" &&
        (s.pendingChoice.prompt as { slot?: string }).slot === "stunned2",
      WAVE4_DEPS,
    );
    const choice = asked.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    const options = choice.options.map((o) => o.optionId);
    expect(options).toEqual(expect.arrayContaining([p2Identity, withAlly.id]));
    expect(options).not.toContain(p1Identity);
  });

  // E36: Crossfire's "fewest remaining hit points" tie between the two heroes is the first player's call, not the
  // first character in instance order; with one hero ahead there is no tie and nobody is asked.
  it("24026.crossfire-forced-interrupt: attacking P2 with the heroes tied on remaining hit points, P1 picks", () => {
    const start = minionEngagedWith(
      heroified(
        heroified(
          onStage(
            foldModularSetIntoDeck(game(1, [{ starterDeckId: "core-black-panther-protection" }]), "crossfire_crew"),
            0,
          ),
          P1,
        ),
        P2,
      ),
      "24026",
      P2,
    ).state;
    const turns = [
      { type: "endTurn", playerId: P1 },
      { type: "endTurn", playerId: P2 },
    ] as const;
    // Each hero at 8 remaining plus `shift` less what the villain phase deals before Crossfire's interrupt.
    const stagedWith = (shift: readonly number[], taken: readonly number[]) =>
      start.players.reduce((acc, player, i) => {
        const identity = player.identity.instanceId;
        return patchInstance(acc, identity, {
          damage: maxHitPoints(acc, identity, WAVE4_DEPS)! - 8 - shift[i]! + taken[i]!,
        });
      }, start);
    const probe = driveEvents(WAVE4_DEPS, stagedWith([0, 0], [0, 0]), ...turns);
    const upTo = probe.events.findIndex(
      (e) => (e as { abilityId?: string }).abilityId === "24026.crossfire-forced-interrupt",
    );
    expect(upTo).toBeGreaterThan(0);
    const taken = start.players.map((p) =>
      damageDealt(probe.events.slice(0, upTo))
        .filter(([target]) => target === p.identity.instanceId)
        .reduce((sum, [, amount]) => sum + amount, 0),
    );
    const askedAt = (shift: readonly number[]) =>
      settle(
        runWave4(
          runWave4(
            stagedWith(
              shift,
              taken.map((t) => -t),
            ),
            turns[0],
          ),
          turns[1],
        ),
        firstLegal,
        (s) =>
          s.pendingChoice?.prompt.kind === "chooseTarget" &&
          (s.pendingChoice.prompt as { slot?: string }).slot === "crossfire-target",
        WAVE4_DEPS,
      );
    const asked = askedAt([0, 0]);
    const choice = asked.pendingChoice!;
    expect(choice.playerId).toBe(P1);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual(
      asked.players.map((p) => p.identity.instanceId).sort(),
    );
    expect(askedAt([0, 1]).pendingChoice).toBeNull();
  });
});
