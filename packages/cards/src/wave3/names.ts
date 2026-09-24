import { WAVE3_CARDS } from "./cards.js";

/**
 * The exact current printed name of a wave 3 / cycle 2 (or earlier) card, by code. Scripts that search for or
 * check "a card named X" use this so the name always matches the data (including errata'd titles).
 *
 * SHARED FILE (docs/phase7-wave3-scripting.md, mirroring docs/phase7-wave2-scripting.md's `names.ts`): lives
 * outside every pack's own folder and is not edited per pack. If a card code isn't found, that's a data problem
 * to report, not a reason to inline the printed string.
 */
export function cardName(code: string): string {
  const card = WAVE3_CARDS.find((c) => c.id === code);
  if (!card) throw new Error(`no wave 3 card ${code}`);
  return card.name;
}
