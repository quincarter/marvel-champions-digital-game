import { WAVE4_CARDS } from "./cards.js";

/**
 * The exact current printed name of a wave 4 / cycle 3 (or earlier) card, by code. Scripts that search for or
 * check "a card named X" use this so the name always matches the data (including errata'd titles).
 *
 * SHARED FILE (`wave3/names.ts`'s own precedent, itself mirroring `wave2/names.ts`): lives outside every pack's own
 * folder and is not edited per pack. If a card code isn't found, that's a data problem to report, not a reason to
 * inline the printed string.
 */
export function cardName(code: string): string {
  const card = WAVE4_CARDS.find((c) => c.id === code);
  if (!card) throw new Error(`no wave 4 card ${code}`);
  return card.name;
}
