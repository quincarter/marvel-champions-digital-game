/**
 * Tells the room which setup step the host is in (issue #880): picking a scenario, setting the table, choosing modular
 * sets. Called from the New game flow's screens, and does nothing unless the flow is a room host's (room mode), so a
 * single-player or offline game never touches the network path. The room shows it to everyone as a status line.
 */
import { currentScenarios } from "../content/pool.js";
import { reportHostActivity } from "../platform/room.js";
import { roomSetupActive } from "../view/room-table-setup.js";

export function reportRoomSetup(step: "scenario" | "table" | "modular", scenarioId?: string): void {
  if (!roomSetupActive()) return;
  const name = scenarioId ? currentScenarios().find((s) => (s.id as string) === scenarioId)?.name : undefined;
  reportHostActivity(step, name);
}
