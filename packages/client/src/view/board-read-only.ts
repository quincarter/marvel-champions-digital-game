/**
 * Whether the Board takes game input, as one pure function, so every path that changes one reason (a replay, a seat
 * being left, another seat's decision, the villain phase) recomputes all of them rather than overwriting the others.
 * A store update during an open villain phase once cleared the phase's lock (a tester played a hand card beside the
 * docked phase in a room game, 2026-11-23): the engine is already in the next player phase then, so only this lock
 * keeps the table still until Start player phase (or Skip) closes the phase.
 */
export interface BoardInputHold {
  /** The Board is showing a replay or a live watch: nothing done reaches a game. */
  readonly replay: boolean;
  /** A guest's seat is being put away (#881). */
  readonly leaving: boolean;
  /** The table waits on another seat's decision (#881). */
  readonly heldElsewhere: boolean;
  /** The villain phase is open, docked beside the table or not (`setVillainPhaseOpen`). */
  readonly villainPhaseOpen: boolean;
}

export const boardReadOnly = (hold: BoardInputHold): boolean =>
  hold.replay || hold.leaving || hold.heldElsewhere || hold.villainPhaseOpen;
