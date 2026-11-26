/**
 * What the villain phase screen takes in for one store update (issue #1017).
 *
 * The screen builds its steps from each command's events (`appendWalkthrough`). A store update normally carries one
 * command's events (`lastEvents`). A room guest's device, though, takes a catch-up without events: a batch of the
 * host's moves after the connection blipped, or the whole log again after a reconnect, arrives as one resumed update
 * (`live/seat-core.ts`). The board is right after it, but a screen that waited for events stayed on the last step it
 * knew (a defend it was paused on) until Skip. So the screen takes each command it missed, in order: from the
 * catch-up's villain phase (`resumedVillainPhase`, with the table each command left and the table at each of its
 * events, so the board moves with the beats), or else from the command trail (`commandTrail.length === version`).
 */
import type { GameEvent, GameState } from "@mc/engine";

/** One command's share of an update, as `appendWalkthrough` takes it. */
export interface TakenCommand {
  readonly events: readonly GameEvent[];
  /** The table the command left. */
  readonly after: GameState;
  /** The table at each of its events, where known. */
  readonly states: readonly { readonly at: number; readonly state: GameState }[];
  /** This command began a villain phase and the table just before it is known: the new phase's recap baseline. */
  readonly phaseBefore?: GameState;
}

export interface CatchUpSource {
  readonly version: number;
  readonly game: GameState;
  readonly lastEvents: readonly GameEvent[];
  readonly lastStates: readonly { readonly at: number; readonly state: GameState }[];
  readonly commandTrail: readonly { readonly events: readonly GameEvent[] }[];
  readonly resumedVillainPhase: {
    readonly startCommand: number;
    readonly before: GameState;
    readonly commands: readonly {
      readonly events: readonly GameEvent[];
      readonly states: readonly { readonly at: number; readonly state: GameState }[];
      readonly after: GameState;
    }[];
  } | null;
}

/**
 * The commands to take in, oldest first, for an update at `state.version` when the screen has taken in `seen` commands
 * (negative: none yet, so the update's own events, which began the phase). An update that moves one command on with its
 * events is taken as it is; one that skipped commands, or carries none of its own, takes each missed command from the
 * catch-up's villain phase where it holds it, else from the trail. A rewind, or a trail that does not line up with the
 * version, falls back to the update's own events, as before.
 */
export function commandsToTakeIn(seen: number, state: CatchUpSource): readonly TakenCommand[] {
  const { version, game, lastEvents, lastStates, commandTrail, resumedVillainPhase: phase } = state;
  const own: TakenCommand = { events: lastEvents, after: game, states: lastStates };
  if (seen < 0 || version <= seen) return [own];
  if (version === seen + 1 && lastEvents.length > 0) return [own];
  // The trail must line up with the commands exactly: one short (the host's own move, whose trail entry the store adds
  // after this update) or one long falls back to the update's own events.
  if (commandTrail.length !== version) return [own];
  const missed = commandTrail.slice(seen, version).map((entry) => entry.events);
  const tables = gamesForTakeIn(missed, game);
  return missed.map((events, i): TakenCommand => {
    const index = seen + i;
    const fromPhase = phase ? phase.commands[index - phase.startCommand] : undefined;
    if (phase && fromPhase && index >= phase.startCommand) {
      return {
        events: fromPhase.events,
        after: fromPhase.after,
        states: fromPhase.states,
        ...(index === phase.startCommand ? { phaseBefore: phase.before } : {}),
      };
    }
    return { events, after: tables[i] ?? game, states: [] };
  });
}

/**
 * The table each trail command is read against when no better one is known. Only the last command's table is known
 * (the update's); an earlier one is given the same table with its round wound back by the rounds the commands after
 * it started, since the walkthrough works out which round a command began in from its table's round and its own
 * `roundStarted` events.
 */
export function gamesForTakeIn(takeIn: readonly (readonly GameEvent[])[], game: GameState): readonly GameState[] {
  let later = 0;
  const out: GameState[] = [];
  for (let i = takeIn.length - 1; i >= 0; i--) {
    out[i] = later === 0 ? game : { ...game, round: game.round - later };
    later += (takeIn[i] ?? []).filter((event) => event.type === "roundStarted").length;
  }
  return out;
}
