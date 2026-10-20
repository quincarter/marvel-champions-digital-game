/**
 * Shadowland (MC65) Black Flower, a modular set (13 printed copies, collector 72A onward). Transcribed from the Hall of
 * Heroes previews; conventions in `common.ts`.
 *
 * Seen (1 card of the set): Creeping Corruption 72A (Setup side) and 72B (OVERPOWERING side), one double-sided upgrade
 * whose footer is "BLACK FLOWER (1/13)" on both faces. The insert (pp. 9, 14) puts "1 Creeping Corruption upgrade
 * (72A)" into play under each player's control and sets "any remaining Creeping Corruption upgrades" aside, so there
 * are more copies than players (probably four, "Max 1 per player"); the preview shows only 1/13, so the quantity is
 * recorded as 1 and the rest of the set (collector 73 onward) is not transcribed.
 */
import type { AddedRecord } from "../types.ts";
import { added, BLACK_FLOWER as SET, twoSided } from "./common.ts";

const CREEPING_CORRUPTION = twoSided(
  SET,
  "upgrade",
  "65072",
  1,
  {
    name: "Creeping Corruption",
    over: {
      illustrator: "Sebastián Guidobono",
      text: "Permanent. Setup. Max 1 per player.\nIf there are at least 5 corruption counters here, remove each of them from here and flip this card.\n<b>Action</b>: Exhaust Creeping Corruption and place 1 corruption counter here → draw 1 card.",
    },
  },
  {
    name: "Creeping Corruption",
    over: {
      traits: "Overpowering.",
      illustrator: "Sebastián Guidobono",
      text: "Permanent. Max 1 per player.\n<b>If there are at least 5 corruption counters here, you are defeated.</b>\n<b>Action</b>: Exhaust Creeping Corruption and place 1 corruption counter here → draw 2 cards, then discard 1 card from your hand.",
    },
  },
);

export const BLACK_FLOWER_RECORDS: readonly AddedRecord[] = [
  added(
    CREEPING_CORRUPTION,
    'Scans mc65_cards_creeping_corruption_a-side.png (footer "BLACK FLOWER (1/13)", 72A, Sebastián Guidobono) and mc65_cards_creeping_corruption-overwhelming_side.png (same footer, 72B, Sebastián Guidobono). UPGRADE (side-title layout), cost box a dash on both faces (the card is put into play by the campaign instructions or Setup), no stat box, no boost icons, no resource icons. Side A, no traits: "Permanent. Setup. Max 1 per player. If there are at least 5 corruption counters here, remove each of them from here and flip this card. Action: Exhaust Creeping Corruption and place 1 corruption counter here -> draw 1 card." Side B, "OVERPOWERING.": "Permanent. Max 1 per player. If there are at least 5 corruption counters here, you are defeated. (bold) Action: Exhaust Creeping Corruption and place 1 corruption counter here -> draw 2 cards, then discard 1 card from your hand." Answers docs/phase7-shadowland.md Q8: the printed text says the player is defeated.',
  ),
];
