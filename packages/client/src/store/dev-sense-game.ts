/**
 * The `?screen=board&fixture=sense` dev jump (`scenes/boot-dev-jump.ts`): Daredevil (Justice, with his Sense deck) and
 * Echo at the first player turn, to see a named side deck beside the play area and the Team-Up blurb in the Other
 * Heroes panel, and a sideways player side scheme (De-escalation) in the hand. A fixture for screenshots only.
 */
import { appSession } from "../session.js";
import { ids } from "./dev-game-steps.js";

export async function startDevSenseGame(): Promise<void> {
  await appSession().store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "fne-daredevil-justice" }, { starterDeckId: "fne-echo-protection" }],
    seed: 3,
    // De-escalation (60024, a player side scheme: a sideways card) dealt into Daredevil's opening hand.
    stack: { players: { 0: ids("60024") } },
  });
}
