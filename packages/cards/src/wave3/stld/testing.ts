import type { CardId } from "@mc/content";
import type { CorePlayer } from "../../core/setup.js";

/**
 * Star-Lord has no precon (docs/phase7-wave3.md §2.1: only `gmw`'s two heroes ship one) and `STLD_STARTER_DECKS`
 * is empty, so his own tests build a legal deck directly: his signature set (`hero:17001a`) plus every Leadership
 * and basic card his own pack prints, each at its data-carried `deckLimit` (`packages/content/src/data/stld/
 * cards.ts`) — 16 + 20 + 9 = 45 cards, within RRG 1.8 Appendix I's 40–50 range with no filler needed. Chosen
 * aspect: Leadership, his own kit's main aspect.
 */
const SIGNATURE_AND_LEADERSHIP: ReadonlyArray<readonly [string, number]> = [
  ["17002", 1],
  ["17003", 3],
  ["17004", 2],
  ["17005", 3],
  ["17006", 1],
  ["17007", 2],
  ["17008", 1],
  ["17009", 1],
  ["17010", 1],
  ["17011", 1],
  ["17012", 1],
  ["17013", 1],
  ["17014", 3],
  ["17015", 3],
  ["17016", 3],
  ["17017", 3],
  ["17018", 2],
  ["17019", 3],
  ["17020", 1],
  ["17021", 1],
  ["17022", 1],
  ["17023", 3],
  ["17031", 3],
];

const deckOf = (entries: ReadonlyArray<readonly [string, number]>): CardId[] =>
  entries.flatMap(([id, n]) => Array.from({ length: n }, () => id as CardId));

/** Star-Lord (17001a), a legal Leadership deck built from his own pack alone. */
export const STAR_LORD_LEADERSHIP: CorePlayer = {
  identityCardId: "17001a" as CardId,
  aspects: ["leadership"],
  deck: deckOf(SIGNATURE_AND_LEADERSHIP),
};
