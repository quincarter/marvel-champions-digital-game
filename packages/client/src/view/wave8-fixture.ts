/**
 * Test support for wave 8's board models: a real Rhino game with Spider-Man (Justice) on the table, and surgery that
 * stands a few of its real cards in a mission area. The client cannot reach the cards package's campaign builders
 * (`packages/cards/src/wave8/aoa/campaign/testing.ts` is not exported), so the state is the engine's own, with the
 * area set the way `placeInScenarioPlayArea` leaves it: faceup, no controller, listed in `scenarioPlayAreas`.
 */

import { cardOf, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";

export interface Wave8Table {
  readonly state: GameState;
  readonly me: PlayerId;
}

/** A started Rhino game with Spider-Man (Justice), past setup choices. */
export async function startedRhinoGame(): Promise<Wave8Table> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  return { state: store.state.game!, me: store.state.perspectiveId! };
}

/** The first instance of a card type, in instance order. */
export function firstOfType(
  state: GameState,
  type: NonNullable<ReturnType<typeof cardOf>>["type"],
  skip: readonly InstanceId[] = [],
): InstanceId {
  const found = Object.keys(state.instances).find(
    (id) => cardOf(state, id as InstanceId)?.type === type && !skip.includes(id as InstanceId),
  );
  if (!found) throw new Error(`no ${type} in the game`);
  return found as InstanceId;
}

export interface MissionFixture extends Wave8Table {
  /** The mission: a side scheme with 5 threat, 2 attempt counters and the internal defeated mark. */
  readonly mission: InstanceId;
  /** An ally at the mission, exhausted and damaged. */
  readonly ally: InstanceId;
  /** An enemy at the mission. */
  readonly minion: InstanceId;
  /** An upgrade attached to the ally. */
  readonly upgrade: InstanceId;
}

/** `table` with a closed mission area holding the mission, an ally with an upgrade, and a minion, in that order. */
export function withMission(table: Wave8Table): MissionFixture {
  const { state } = table;
  const mission = firstOfType(state, "side_scheme");
  const ally = firstOfType(state, "ally");
  const minion = firstOfType(state, "minion");
  const upgrade = firstOfType(state, "upgrade");
  const instance = (id: InstanceId) => state.instances[id]!;
  const instances = {
    ...state.instances,
    [mission]: {
      ...instance(mission),
      controllerId: null,
      faceup: true,
      threat: 5,
      counters: { attempt: 2, defeated: 1 },
    },
    [ally]: { ...instance(ally), controllerId: null, faceup: true, exhausted: true, damage: 1, attachments: [upgrade] },
    [minion]: { ...instance(minion), controllerId: null, faceup: true, engagedWith: null },
    [upgrade]: { ...instance(upgrade), controllerId: null, faceup: true, attachedTo: ally },
  };
  return {
    ...table,
    mission,
    ally,
    minion,
    upgrade,
    state: {
      ...state,
      instances,
      scenarioPlayAreas: { mission: { cards: [mission, ally, minion], closed: true } },
    } as GameState,
  };
}
