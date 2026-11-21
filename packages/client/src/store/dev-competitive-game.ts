/**
 * A real Civil War Competitive game on the board for screenshots and the e2e specs (`?screen=board&fixture=competitive`,
 * issue #883): Spider-Man (registration) against Captain Marvel (resistance), each facing the leader the other side
 * built, started through the same `SessionConfig.competitive` the room's Start builds. Played forward through the store,
 * never a state edit, so it replays like any saved game. Dev only.
 */
import { buildCompetitiveConfig, type SealedScenario } from "../live/competitive-start.js";
import type { SessionStore } from "./session-store.js";

const registration: SealedScenario = {
  leaderScenarioId: "registration-iron-man",
  modularSetIds: [],
  mainSchemeStageIds: [],
};
const resistance: SealedScenario = {
  leaderScenarioId: "resistance-captain-america",
  modularSetIds: [],
  mainSchemeStageIds: [],
};

/** Starts the game and keeps the first setup choices out of the way. `size` is the players a side has. */
export async function startDevCompetitiveGame(store: SessionStore, size: 1 | 2 = 1): Promise<void> {
  const seats =
    size === 1
      ? [
          { seat: "s1", player: { starterDeckId: "core-spider-man-justice" } },
          { seat: "s2", player: { starterDeckId: "core-captain-marvel-leadership" } },
        ]
      : [
          { seat: "s1", player: { starterDeckId: "core-spider-man-justice" } },
          { seat: "s2", player: { starterDeckId: "core-black-panther-protection" } },
          { seat: "s3", player: { starterDeckId: "core-captain-marvel-leadership" } },
          { seat: "s4", player: { starterDeckId: "core-she-hulk-aggression" } },
        ];
  const half = seats.map((s) => s.seat);
  const config = buildCompetitiveConfig({
    setup: { seed: 2026, seats },
    sealed: { registration, resistance },
    teams: { registration: half.slice(0, size), resistance: half.slice(size) },
    tieBreaks: true,
  });
  if (!config) throw new Error("the competitive dev game has no config");
  await store.start({ ...config, localSeats: ["p1"] });
  for (let i = 0; i < 12; i++) {
    const choice = store.state.game?.pendingChoice;
    if (!choice) break;
    await store.dispatch({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: choice.options?.[0] ? [choice.options[0].optionId] : [],
    });
  }
}
