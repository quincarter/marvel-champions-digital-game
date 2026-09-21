/**
 * A card-pool version: a short, deterministic fingerprint of "which cards, with
 * what data, are in this build's pool right now."
 *
 * A `Deck` records the pool version it was built against (`Deck.poolVersion`,
 * `./schema/decks.ts`) so a client can tell, on load, whether the pool has
 * moved under a saved deck (a new pack landed, an errata correction changed a
 * card) and re-validate rather than silently trust or silently rewrite it.
 *
 * Deliberately NOT `SCHEMA_VERSION` or `CONTENT_VERSION` (`./index.ts`): those
 * are hand-bumped and describe the *shape* of the data or the package release,
 * not "did any card actually change". A card's text changing under errata
 * would not necessarily earn a version bump from a human remembering to do it;
 * hashing the data itself means it always does.
 *
 * Pure and dependency-free: no crypto import, so this runs the same in Node
 * (the ingest/curation scripts) and in the browser bundle (a saved deck is
 * re-validated client-side). The hash does not need to be cryptographic, only
 * stable and collision-resistant enough for "did the pool change" — FNV-1a is
 * the standard small, fast, dependency-free choice for that.
 */
import type { AnyCard } from "../schema/cards/index.js";
import { CORE_CARDS } from "./core/cards.js";

/**
 * FNV-1a, 32-bit, over UTF-8 bytes. Returns 8 lowercase hex characters.
 * Same algorithm and constants as the classic reference implementation.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // `hash * 16777619` with the FNV prime, done with shifts/adds so it stays
    // in 32-bit integer math the same way in every JS engine.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * A stable string for one card: every own-enumerable key in a fixed (sorted)
 * order, so two structurally-equal cards hash the same regardless of the
 * order their fields were constructed in, and so a changed field (a
 * corrected stat, an errata'd text string, a new keyword) changes the hash.
 * `JSON.stringify`'s replacer runs per-object and receives already-stringified
 * child values, so this recurses correctly through nested arrays/objects.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[key] = (val as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return val;
  });
}

/**
 * The pool version for an arbitrary card list: every card's id paired with a
 * stable serialization of its full data, sorted by id so pool *order* never
 * matters, only pool *contents*. Two pools with the same cards (in any order,
 * from any build) produce the same version; adding, removing, or editing a
 * single card changes it.
 */
export function poolVersionOf(cards: readonly AnyCard[]): string {
  const entries = cards.map((card) => `${card.id}:${stableStringify(card)}`).sort();
  return `v1-${fnv1a(entries.join("\n"))}`;
}

/**
 * The pool version for today's playable pool (Core Set only; PLAN.md Phase 7
 * is "in progress" — more packs join `CORE_CARDS`' successors later). A
 * `Deck` built today records this string; `unscriptedCards`/`validateDeck`
 * plus a re-fetch of this constant after an update is how a saved deck
 * notices the ground moved under it.
 */
export const CORE_POOL_VERSION = poolVersionOf(CORE_CARDS);
