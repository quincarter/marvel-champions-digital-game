/**
 * The game a table host starts for its own table in an Epic room (Trickster Takeover Epic Multiplayer, issue #882), as
 * a pure function. Every player brings their own hero and deck (Quin, 2026-11-20): the table's players come from its
 * seats' decks at Start (`live/room-start.ts`, the same path as a standard room), so what is built here is the table's
 * game without its players: the scenario with the table's difficulty and house rules. `startEpicTable`
 * (`platform/room.ts`) then adds the seed, the group's place in the pod and the room.
 */
import type { Scenario } from "@mc/content";
import type { TableRules } from "@mc/engine";
import type { RoomGameBase } from "../live/room-start.js";
import { difficultyOf } from "./epic-lobby-model.js";
import { roomBaseConfig } from "./room-table-setup.js";
import { initialSetupDraft } from "./setup-draft.js";

/** The scenario every Epic table plays: Trickster Takeover's Loki, God of Lies (`@mc/content` `tt`). */
export const EPIC_SCENARIO_ID = "god-of-lies";

export interface EpicBaseInput {
  /** How many seats the table has (its group's players, 1 to 4). */
  readonly seats: number;
  /** The table's difficulty as the organizer set it (opaque in the room). */
  readonly difficulty: unknown;
  readonly scenario: Scenario | undefined;
  readonly tableRules?: TableRules | undefined;
}

/** The table's game without its players. */
export function epicTableBase(input: EpicBaseInput): RoomGameBase {
  const draft = {
    ...initialSetupDraft({ scenarioId: EPIC_SCENARIO_ID, seatDeckId: null, seed: 0 }),
    difficulty: difficultyOf(input.difficulty),
  };
  return roomBaseConfig(draft, Math.max(1, input.seats), input.scenario, input.tableRules);
}
