/**
 * Starting a Civil War Competitive game from a lobby room (issue #883, docs/live-game-rooms.md section 11): what the
 * host's device needs besides the room's sealed scenarios, and the one place the two-team `SessionConfig` is built.
 *
 * The two-team engine is a separate piece of work (`docs/competitive-mode-plan.md` section 3). Until it lands,
 * `buildCompetitiveConfig` is a typed placeholder that answers `null` ("engine pending"), so `startCompetitive` says so
 * rather than starting a cooperative game with a team's scenario dropped. When the engine's API exists, only that
 * function's body changes; the room, the reveal and the proposal gate around it are built.
 */
import type { SessionConfig } from "../engine/host.js";
import type { RoomState, TeamId } from "./room-state.js";

/** Both teams' sealed scenarios, as the room revealed them to the host: `<team>` is what that team built for the other. */
export interface SealedScenarios {
  readonly registration: unknown;
  readonly resistance: unknown;
}

/** One seat's hero and deck as the setup flow chose it (opaque until the engine's two-team setup API is known). */
export interface CompetitiveSeatSetup {
  readonly seat: string;
  readonly hero: unknown;
}

/** What the host's setup supplies: the seed and each seat's hero. The teams come from the lobby. */
export interface CompetitiveSetup {
  readonly seed: number;
  readonly seats: readonly CompetitiveSeatSetup[];
}

export interface CompetitiveBuildInput {
  readonly setup: CompetitiveSetup;
  readonly sealed: SealedScenarios;
  /** Seat ids of each team, in seat (player) order. */
  readonly teams: Readonly<Record<TeamId, readonly string[]>>;
  readonly tieBreaks: boolean;
}

/**
 * Builds the two-team game's `SessionConfig`, or null while the two-team engine is not available. The engine agent's
 * setup API replaces this body: each team's `sealed` scenario is applied to the other team's area.
 */
export function buildCompetitiveConfig(_input: CompetitiveBuildInput): SessionConfig | null {
  return null;
}

/**
 * The team of each engine player (`p1`..), from the lobby's seats. Seat n plays `p<n>` unless the seat already names its
 * player (`startGame` sends that mapping at Start); a seat with no team is left out.
 */
export function roomTeamsOf(state: Pick<RoomState, "seats">): Record<string, TeamId> {
  const teams: Record<string, TeamId> = {};
  state.seats.forEach((seat, index) => {
    if (seat.team) teams[seat.player ?? `p${index + 1}`] = seat.team;
  });
  return teams;
}
