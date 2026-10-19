import { describe, expect, it } from "vitest";
import { P1, P2, firstLegal, settle } from "../../testing/harness.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import { foldModularSetIntoDeck, game, heroified, onStage, playerCardInPlay, stackTop } from "./testing.js";

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
});
