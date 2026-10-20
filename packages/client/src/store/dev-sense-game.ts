/**
 * The `?screen=board&fixture=sense` dev jump (`scenes/boot-dev-jump.ts`): Daredevil (Justice, with his Sense deck) and
 * Echo at the first player turn, to see a named side deck beside the play area and the Team-Up blurb in the Other
 * Heroes panel. A fixture for screenshots only.
 */
import { appSession } from "../session.js";

export async function startDevSenseGame(): Promise<void> {
  await appSession().store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "fne-daredevil-justice" }, { starterDeckId: "fne-echo-protection" }],
    seed: 3,
  });
}
