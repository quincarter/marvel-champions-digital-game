/**
 * Rules audit chunk 38 (FFG rulings post-RRG 1.5, 2023). Audit proofs only: each `it.fails` marks a place the engine
 * does something an official source forbids, and flips to a failure when it is fixed.
 *
 * FFG ruling, Sep 21, 2023 (post-RRG 1.5 #87): the Ant-Man and Wasp allies "specify that you are 'overpaying' for
 * their cost when you play them, while The Power Of cards state they must be 'paying' for a cost in order to generate
 * double resources. The Power Of cards will only generate one resource for these allies." RRG 1.8 "Cost" (p. 13):
 * resources beyond the cost are overpaid, not paid.
 */
import { PLAYABLE_CARDS } from "@mc/content";
import { createGame, type GameState, type InstanceId, type PlayerSetup } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import { buildCrossHeroDeck } from "../testing/cross-hero.js";
import { firstLegal, inst, moveToHand, P1, play, runWith, settle, toHero } from "../testing/harness.js";

const SHE_HULK = "core-she-hulk-aggression";

function wasp(): { readonly state: GameState; readonly id: InstanceId } {
  const seat: PlayerSetup = buildCrossHeroDeck(PLAYABLE_CARDS, SHE_HULK, "13012");
  const created = createGame(playableScenario("rhino", { seed: 11, players: [seat] }), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const hero = settle(runWith(PLAYABLE_DEPS, opening, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);
  const { state, ids } = moveToHand(hero, P1, "13012");
  return { state, id: ids[0]! };
}

describe("chunk 38, ruling 87 (Sep 21, 2023): The Power Of cards and overpaying", () => {
  it.fails("Wasp (cost 0) paid with only The Power of Aggression: the card generates 1 resource, so 1 pym counter", () => {
    const { state: opened, id } = wasp();
    const given = moveToHand(opened, P1, "01055");
    const after = settle(
      runWith(PLAYABLE_DEPS, given.state, play(P1, id, given.ids, {})),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, id).counters.pym ?? 0).toBe(1);
  });
});
