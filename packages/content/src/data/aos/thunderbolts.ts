// Hand-authored, derived from card data: the Thunderbolt minion to encounter set map the Thunderbolts scenario (MC50
// p. 15) and the campaign's fifth scenario read (docs/phase7-wave9.md section 1.16 item 5 and section 8.1 item 14).
// Nothing here is typed in per card: a later product's Thunderbolt minion joins the map by carrying the trait.

import type { AnyCard, CardId, EncounterSetId } from "../../schema/index.js";
import { BP_CARDS } from "../bp/cards.js";
import { FALCON_CARDS } from "../falcon/cards.js";
import { SILK_CARDS } from "../silk/cards.js";
import { WINTER_CARDS } from "../winter/cards.js";
import { AOS_CARDS } from "./cards.js";

/** One minion with the Thunderbolt trait and the encounter set it belongs to. */
export interface ThunderboltMinion {
  readonly minionId: CardId;
  readonly encounterSetId: EncounterSetId;
  /** Whether the minion is Elite. "Choose ... modular sets, each with an Elite, Thunderbolt minion" (MC50 p. 15). */
  readonly elite: boolean;
}

/** Every minion with the Thunderbolt trait in `cards`, in card order, with its (single) encounter set. */
export function thunderboltMinions(cards: readonly AnyCard[]): readonly ThunderboltMinion[] {
  const out: ThunderboltMinion[] = [];
  for (const card of cards) {
    if (card.type !== "minion") continue;
    const traits = card.traits.map(String);
    if (!traits.includes("THUNDERBOLT")) continue;
    const [setId, ...more] = card.encounterSetIds;
    if (setId === undefined || more.length > 0)
      throw new Error(`Thunderbolt minion ${String(card.id)} must belong to exactly one encounter set`);
    out.push({
      minionId: card.id,
      encounterSetId: setId,
      elite: traits.includes("ELITE"),
    });
  }
  return out;
}

/**
 * The Thunderbolt minions of the wave 9 pool (`aos` and the four hero packs `bp`, `silk`, `falcon` and `winter`):
 * Jolt of the Thunderbolts set plus the ten Elite minions of Gravitational Pull, Hard Sound, Pale Little Spider, Power
 * of the Atom, Supersonic, The Leaper, Extreme Risk, Growing Strong, Techno and Whiteout.
 */
export const AOS_THUNDERBOLT_MINIONS: readonly ThunderboltMinion[] = thunderboltMinions([
  ...AOS_CARDS,
  ...BP_CARDS,
  ...SILK_CARDS,
  ...FALCON_CARDS,
  ...WINTER_CARDS,
]);

/**
 * The encounter sets that hold an Elite, Thunderbolt minion: the Thunderbolts scenario's modular pool (MC50 p. 15).
 * Jolt is not Elite, so the Thunderbolts set itself is not in it.
 */
export const AOS_THUNDERBOLT_POOL_SET_IDS: readonly EncounterSetId[] = [
  ...new Set(AOS_THUNDERBOLT_MINIONS.filter((m) => m.elite).map((m) => m.encounterSetId)),
];
