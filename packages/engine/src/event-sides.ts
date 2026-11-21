/**
 * The sides of a split table an event happened on (`TriggerEvent.sides`), read by `heardOnThisSide`
 * (`resolve/triggers.ts`): in a two-team game, "card abilities on your side of the table completely ignore cards on the
 * other side" (MC56 pp. 16-17); in The Once and Future Kang's separate game areas, "cards and components in one game
 * area cannot affect another game area" (Kang insert, docs/phase7-wave2.md §3.1).
 *
 * An event's sides are the game areas of the cards and players it names (`eventSubjects`). A card in every area (an environment, Kang's stage 2B, an encounter
 * card in a shared deck, a set-aside card: `areaOfCard` null) puts the event on no side. Read when the event is made
 * and stamped on it, so a card that moves afterwards (a defeated minion going to the discard pile of the area it came
 * from) does not move the event with it.
 */

import type { GameAreaId, InstanceId, PlayerId } from "./ids.js";
import { areaOfCard, areaOfPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { eventSubjects, type TriggerEvent } from "./trigger-events.js";

/** The distinct game areas of these cards and players, in the order first named. Empty with no split table. */
export function sidesOf(
  state: GameState,
  cards: readonly InstanceId[],
  players: readonly PlayerId[],
): readonly GameAreaId[] {
  if (state.gameAreas.length === 0) return [];
  const areas = [
    ...cards.map((id) => areaOfCard(state, id)),
    ...players.map((playerId) => areaOfPlayer(state, playerId)),
  ];
  return [...new Set(areas.filter((area) => area !== null).map((area) => area.areaId))];
}

/** The sides `event` is on now: its stamp when it has one, else read from where what it names is now. */
export function eventSides(state: GameState, event: TriggerEvent): readonly GameAreaId[] {
  if (event.sides !== undefined) return event.sides;
  if (state.gameAreas.length === 0) return [];
  const subjects = eventSubjects(event);
  return sidesOf(state, [...subjects.sources, ...subjects.targets], subjects.players);
}

/** `event` with its sides stamped (`TriggerEvent.sides`), on a split table only; the event itself otherwise. */
export function withSides<E extends TriggerEvent>(state: GameState, event: E): E {
  if (state.gameAreas.length === 0 || event.sides !== undefined) return event;
  return { ...event, sides: eventSides(state, event) };
}
