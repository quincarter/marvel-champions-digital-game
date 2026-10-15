/**
 * What the villain phase tells the compact identity panel (the tall band's player row, TB1): the seat's status tag and
 * the hit points it could end on. Pure data the Board draws (`BoardScene.setVillainSeatNote`); the phase works it out.
 */
export interface VillainSeatNote {
  /** A short upper-case tag beside the hero's name: "DEFENDING", "READY". */
  readonly tag: string;
  /** The hit points the hero could be left with after the attack, `low` to `high` (the boost card is unknown). */
  readonly hpAfter?: { readonly low: number; readonly high: number };
}

export function sameSeatNote(a: VillainSeatNote | null, b: VillainSeatNote | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.tag === b.tag && a.hpAfter?.low === b.hpAfter?.low && a.hpAfter?.high === b.hpAfter?.high;
}

/** "10 → 8–10", or "10 → 8" when the range is one number, or "10/10" with no projection. */
export function hpProjectionText(hp: { readonly current: number; readonly max: number }, note: VillainSeatNote | null) {
  const after = note?.hpAfter;
  if (!after) return `${hp.current}/${hp.max}`;
  return `${hp.current} → ${after.low === after.high ? after.low : `${after.low}–${after.high}`}`;
}
