/**
 * Turning a successful `@mc/content` import parse into a `Deck` this app can
 * store and seat. The parsing itself (resolving untrusted decklist data to
 * card ids) is `@mc/content`'s job (`import/`); this module's job is the
 * client-specific remainder — assigning an id, naming the deck, and recording
 * where it came from (`DeckSource`) — kept pure by taking `now`/`newId` as
 * arguments rather than reading a clock or `crypto` itself, the same pattern
 * `EngineSessionCore` uses for the same reason (testable without mocking
 * globals).
 */
import {
  deckId,
  parseDecklistText,
  parseMarvelCdbDeckJsonText,
  type AnyCard,
  type Deck,
  type ImportProblem,
} from "@mc/content";
import type { CardPool } from "@mc/engine";

/**
 * The MarvelCDB link field's placeholder. Short enough for the phone's field (about 320 px of mono text, roughly
 * 44 characters), where the earlier "marvelcdb.com/decklist/view/1234/... or a bare id" ran off the right edge.
 */
export const MARVELCDB_FIELD_PLACEHOLDER = "MarvelCDB decklist link or id";

export type ImportOutcome =
  | { readonly ok: true; readonly deck: Deck; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly problems: readonly ImportProblem[] };

export interface ImportEnv {
  readonly pool: readonly AnyCard[];
  readonly poolVersion: string;
  readonly now: () => string;
  readonly newId: () => string;
  /** The names of the decks already stored, so an imported name that collides gets a numeric suffix. */
  readonly existingNames?: readonly string[];
}

/** `name`, or `name (2)`, `name (3)` … the first one not already taken (case-insensitive). */
export function uniqueDeckName(name: string, existing: readonly string[] = []): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n += 1) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** The decklist's own name when the import carried one, else "<Hero> (imported)", else `fallback`; made unique. */
function nameFor(
  deckName: string | null | undefined,
  heroName: string | null,
  fallback: string,
  existing?: readonly string[],
): string {
  const own = deckName?.trim();
  const base = own ? own : heroName ? `${heroName} (imported)` : fallback;
  return uniqueDeckName(base, existing);
}

const warningsOf = (result: { readonly notes?: readonly { readonly code: string; readonly message: string }[] }) =>
  (result.notes ?? []).filter((note) => note.code === "unreadable_line").map((note) => note.message);

/** Import-by-paste: works with no network, per PLAN.md Phase 9's "build it first; it is also the easiest to test". */
export function importFromPasteText(text: string, env: ImportEnv): ImportOutcome {
  const result = parseDecklistText(text, env.pool);
  if (!result.ok) return { ok: false, problems: result.problems };
  const now = env.now();
  return {
    ok: true,
    warnings: warningsOf(result),
    deck: {
      id: deckId(env.newId()),
      name: nameFor(result.deckName, result.heroName, "Imported deck", env.existingNames),
      identityCardId: result.contents.identityCardId,
      aspects: result.contents.aspects,
      cards: result.contents.cards,
      poolVersion: env.poolVersion,
      source: { kind: "imported", site: "marvelcdb", marvelcdbDeckId: null, url: null, importedAt: now },
      updatedAt: now,
    },
  };
}

/**
 * Import from a MarvelCDB deck/decklist JSON response body — fetched by the
 * caller (the dev/preview-only same-origin route; see
 * `vite-marvelcdb-import.ts`), never by this module, which stays
 * network-free like the rest of `@mc/content`'s import layer.
 */
export function importFromMarvelCdbResponseText(
  responseText: string,
  ref: { readonly kind: "deck" | "decklist"; readonly id: string },
  sourceUrl: string | null,
  env: ImportEnv,
): ImportOutcome {
  const result = parseMarvelCdbDeckJsonText(responseText, env.pool);
  if (!result.ok) return { ok: false, problems: result.problems };
  const now = env.now();
  return {
    ok: true,
    warnings: warningsOf(result),
    deck: {
      id: deckId(env.newId()),
      name: nameFor(result.deckName, result.heroName, `MarvelCDB ${ref.kind} #${ref.id}`, env.existingNames),
      identityCardId: result.contents.identityCardId,
      aspects: result.contents.aspects,
      cards: result.contents.cards,
      poolVersion: env.poolVersion,
      source: { kind: "imported", site: "marvelcdb", marvelcdbDeckId: ref.id, url: sourceUrl, importedAt: now },
      updatedAt: now,
    },
  };
}

/**
 * "Export" (W9, docs/phase4-screen-gaps.md §3): the exact inverse of `parseDecklistText` (`@mc/content`'s
 * `from-text.ts`) — a decklist a player can copy out, paste into another client, or feed straight back into
 * `importFromPasteText`. Two things `parseDecklistText` does that this has to undo deliberately, not just format
 * around:
 *
 * - **It resolves a title to *one or more* card codes** (`splitByQuantityInSet`, when a title is printed as several
 *   distinct codes with the same name — Core's four "Wakanda Forever!" codes). The inverse of that is grouping
 *   `deck.cards` back *by name* and summing their quantities into one line, not emitting one line per code — a
 *   re-import then re-splits that total the same way it always does, which is what makes this a round trip rather
 *   than a lossy dump of internal ids.
 * - **It reads `Aspect: X and Y` as a set, lower-cased.** `deck.aspects` is already exactly that set; this writes
 *   one `Aspect:` line per aspect (title-cased for readability — `splitAspects` lower-cases on the way back in
 *   regardless, so the casing here is cosmetic only) rather than trying to guess which combined phrasing the
 *   original import used.
 *
 * A card id in `deck.cards` that isn't in `pool` (a deck built against an older pool, or the wrong pool passed in)
 * is skipped — there is no name to print it under — the same "can't classify it" handling `deck-stats.ts` gives a
 * missing card id.
 */
export function exportDecklistText(deck: Deck, pool: CardPool): string {
  const cards = Array.isArray(pool) ? pool : Object.values(pool);
  const byId = new Map(cards.map((card) => [card.id as string, card]));
  const identity = byId.get(deck.identityCardId as string);

  const lines: string[] = [`Hero: ${identity?.name ?? deck.identityCardId}`];
  for (const aspect of deck.aspects) lines.push(`Aspect: ${aspect.charAt(0).toUpperCase()}${aspect.slice(1)}`);

  const byName = new Map<string, number>();
  for (const entry of deck.cards) {
    const card = byId.get(entry.cardId as string);
    if (!card) continue;
    byName.set(card.name, (byName.get(card.name) ?? 0) + entry.quantity);
  }
  for (const [name, quantity] of [...byName.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${quantity}x ${name}`);
  }

  return lines.join("\n");
}
