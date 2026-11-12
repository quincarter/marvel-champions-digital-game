/**
 * Encounter attachments whose printed stat boxes MarvelCDB does not send (issue #678 and the audit that followed it):
 * each was checked against its card scan, and a curation correction (or, for a record this repo writes, its own
 * `thwart`) supplies the numbers. Without them the attached character gets no bonus. A combined "SCH/THW" box is both
 * `sch` and `thw` (RRG v1.8 "Attachment", p. 8: SCH on a villain or minion, THW on a hero or ally).
 */
import { describe, expect, it } from "vitest";
import { PLAYABLE_CARDS } from "./index.js";

const PRINTED: Readonly<Record<string, { readonly atk?: number; readonly sch?: number; readonly thw?: number }>> = {
  "16149": { atk: 1, sch: 1, thw: 1 }, // Power Stone: +1 SCH/THW, +1 ATK
  "16056": { atk: 2 }, // Blackjack's Bazooka
  "16064": { atk: 1 }, // Drang's Spear
  "16109": { atk: 1, sch: 1 }, // Universal Weapon
  "16122": { atk: 3 }, // Cloak of Hercules
  "19028": { atk: 2 }, // Challenge Accepted
  "21104": { atk: 1 }, // Corvus's Glaive
  "22030": { atk: 1 }, // Lethal Weapon
  "27089": { atk: 3 }, // Humongous Hallucination
  "27090": { sch: 1 }, // Masterful Mirage
  "29031": { atk: 1 }, // Cyborg Tech
  "60122": { sch: 1, thw: 1 }, // Impossible Object: +1 SCH/THW
  "60123": { sch: 1, thw: 1 }, // Inspiring Pottery: +1 SCH/THW
  "60124": { sch: 1, thw: 1 }, // Replica Shield: +1 SCH/THW
  "60125": { sch: 1, thw: 1 }, // Stunning Landscape: +1 SCH/THW
  "60187": { sch: 1, thw: 1 }, // Motorcycle: +1 SCH/THW
  "65065": { thw: 2 }, // Pull of Power
};

describe("printed attachment stat boxes MarvelCDB omits", () => {
  for (const [id, printed] of Object.entries(PRINTED)) {
    it(`${id} carries its printed stat boxes`, () => {
      const card = PLAYABLE_CARDS.find((c) => c.id === id);
      expect(card?.type).toBe("attachment");
      expect(card?.type === "attachment" ? card.statModifiers : undefined).toEqual(printed);
    });
  }
});
