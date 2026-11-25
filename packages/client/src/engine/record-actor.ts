/**
 * Which player is acting now, folded over the engine's events as the game record is built (`game-record.ts`, #909).
 *
 * The engine names a player on few events: an ability's controller (`abilityResolved.controllerId`) and a card's player
 * (`cardPlayed.playerId`). Everything an ability or a play does afterwards (the damage it deals, the cards it moves) is
 * logged inside the stack frames it pushed, with no player on the event. This tracker keeps one entry per open frame
 * (`framePushed` to `framePopped`), fills an entry from the event that names its player, and answers for any event "the
 * player whose ability or play is resolving": the innermost open frame with a known actor. An encounter card's ability
 * (a null controller) is a known actor too, so a forced interrupt from the villain inside a player's attack reads as
 * nobody's, not as the player's.
 *
 * Engine reading, not a rule: the log carries no frame position, only push and pop. The tracker places a frame on top
 * as it is pushed, puts frames pushed together (`pushFrames`, top first) in stack order, and at the end of each command
 * puts its entries in the order of the state's real stack (`settleActor`), dropping any frame no longer on it. A frame
 * taken off the stack to wait (`suspendBehindActivation`, `queueBehindResolvingActivation`: popped, then pushed again
 * under the same id) keeps its actor while it waits, for the last `PARKED_LIMIT` frames.
 *
 * Plain serializable data, never mutated: each step returns a new state. No storage, no Phaser.
 */
import type { EngineDeps, FrameId, GameEvent, GameState, InstanceId, PlayerId, StackFrameKind } from "@mc/engine";

/** One open stack frame. `actor` absent: nothing has named its player yet, so it reads as the frame beneath it. */
export interface ActorEntry {
  readonly frameId: FrameId;
  readonly frame: StackFrameKind;
  readonly actor?: PlayerId | null;
}

export interface ActorState {
  /** Open frames, outermost first (the last is the innermost, the top of the stack). */
  readonly open: readonly ActorEntry[];
  /**
   * A card played whose play frame is not pushed yet: the engine logs `cardPlayed` (with its payment) before it pushes
   * the `playCard` frame, so the player acts until that frame takes the actor over.
   */
  readonly pendingPlay?: PlayerId;
  /** The open index the frames pushed together so far went in at, while the last event was a `framePushed`. */
  readonly batchAt?: number;
  /** Frames popped with a known actor, newest last, so one pushed again under its id gets it back. */
  readonly parked?: readonly { readonly frameId: FrameId; readonly actor: PlayerId | null }[];
}

/** How many popped frames keep their actor (`ActorState.parked`). */
export const PARKED_LIMIT = 32;

export const initActor = (): ActorState => ({ open: [] });

/** The index of the innermost open entry matching `test`, or -1. */
function innermost(open: readonly ActorEntry[], test: (entry: ActorEntry) => boolean): number {
  for (let index = open.length - 1; index >= 0; index--) if (test(open[index]!)) return index;
  return -1;
}

/** Names the actor of the innermost unfilled frame of `kind` (else the innermost unfilled frame), if any is open. */
function fill(state: ActorState, kind: StackFrameKind, actor: PlayerId | null): ActorState {
  let at = innermost(state.open, (entry) => entry.frame === kind && entry.actor === undefined);
  if (at < 0) at = innermost(state.open, (entry) => entry.actor === undefined);
  if (at < 0) return state;
  const open = state.open.map((entry, index) => (index === at ? { ...entry, actor } : entry));
  return { ...state, open };
}

type Parked = NonNullable<ActorState["parked"]>;

/** The parked frames with `entry` added, when its actor is known: newest last, at most `PARKED_LIMIT`. */
const parkedWith = (parked: Parked | undefined, entry: ActorEntry): Parked => {
  if (entry.actor === undefined) return parked ?? [];
  const kept = (parked ?? []).filter((other) => other.frameId !== entry.frameId);
  return [...kept, { frameId: entry.frameId, actor: entry.actor }].slice(-PARKED_LIMIT);
};

/** Folds one event onto the tracker. */
export function stepActor(state: ActorState, event: GameEvent): ActorState {
  const { batchAt: wasBatchAt, ...rest } = state;
  switch (event.type) {
    case "framePushed": {
      const parked = state.parked?.find((entry) => entry.frameId === event.frameId);
      // A waiting frame back on the stack has its actor back; a play's frame takes over the play's player.
      const taken = event.frame === "playCard" && !parked && state.pendingPlay !== undefined;
      const actor = parked ? { actor: parked.actor } : taken ? { actor: state.pendingPlay } : {};
      const entry: ActorEntry = { frameId: event.frameId, frame: event.frame, ...actor };
      // Pushed together with the frame before it (no event between): beneath it, as `pushFrames` stacks them.
      const at = wasBatchAt ?? state.open.length;
      const stillParked = parked ? state.parked!.filter((p) => p.frameId !== event.frameId) : state.parked;
      return {
        open: [...state.open.slice(0, at), entry, ...state.open.slice(at)],
        batchAt: at,
        ...(!taken && state.pendingPlay !== undefined ? { pendingPlay: state.pendingPlay } : {}),
        ...(stillParked && stillParked.length > 0 ? { parked: stillParked } : {}),
      };
    }
    case "framePopped": {
      const entry = state.open.find((open) => open.frameId === event.frameId);
      if (!entry) return rest;
      const parked = parkedWith(state.parked, entry);
      const { parked: _old, ...base } = rest;
      return {
        ...base,
        open: state.open.filter((open) => open.frameId !== event.frameId),
        ...(parked.length > 0 ? { parked } : {}),
      };
    }
    case "abilityResolved":
      return fill(rest, "ability", event.controllerId);
    case "cardPlayed":
      return { ...rest, pendingPlay: event.playerId };
    default:
      return rest;
  }
}

/** The player acting now: the card being played, else the innermost frame whose actor is known; null for nobody. */
export function actingPlayer(state: ActorState): PlayerId | null {
  if (state.pendingPlay !== undefined) return state.pendingPlay;
  const at = innermost(state.open, (entry) => entry.actor !== undefined);
  return at < 0 ? null : (state.open[at]!.actor ?? null);
}

/**
 * Brings the tracker in line with the state after a command: its open frames in the real stack's order, any frame no
 * longer on the stack dropped (parked if its actor is known: it may come back), no play waiting for its frame, and no
 * batch carried into the next command.
 */
export function settleActor(state: ActorState, stack: GameState["stack"] | undefined): ActorState {
  const onStack = stack ?? [];
  const byId = new Map(state.open.map((entry) => [entry.frameId, entry]));
  // The state's stack is top first; the tracker keeps the outermost first.
  const open = [...onStack].reverse().flatMap((frame) => {
    const entry = byId.get(frame.frameId);
    return entry ? [entry] : [];
  });
  const kept = new Set(open.map((entry) => entry.frameId));
  const parked = state.open
    .filter((entry) => !kept.has(entry.frameId))
    .reduce((list: Parked, entry) => parkedWith(list, entry), state.parked ?? []);
  return { open, ...(parked.length > 0 ? { parked } : {}) };
}

/**
 * What a record fold (`record-together.ts`, `record-feats.ts`, `record-boosts.ts`) is given with each event. `state` is
 * the state after the whole command the event belongs to (what a host publishes), so read it for ownership and card
 * types, not for anything the command itself changed.
 */
export interface RecordFoldContext {
  /** The player acting as of this event, after the tracker has folded it (`actingPlayer`). */
  readonly actor: PlayerId | null;
  /** The player acting just before this event: for a `framePopped`, whose frame closed. */
  readonly actorBefore: PlayerId | null;
  /** The tracker itself, after this event, for a fold that needs more than the acting player. */
  readonly tracker: ActorState;
  readonly state: GameState;
  readonly deps?: EngineDeps;
  /** The round as of this event (`roundStarted` folded). */
  readonly round: number;
  /** The instance's card as the events reach it (a card that flips later in the command reads as its earlier face). */
  readonly cardIdAt: (id: InstanceId) => string | undefined;
}

/**
 * A counter group folded over the record's events: `init` once per game, `step` for each event, `finish` once the game
 * is summarized. The fold's state is kept on the game record between commands, so it must be plain serializable data
 * and `step` must return a new value rather than change the old one.
 */
export interface RecordFold<S, C> {
  readonly init: () => S;
  readonly step: (state: S, event: GameEvent, ctx: RecordFoldContext) => S;
  readonly finish: (state: S) => C;
}
