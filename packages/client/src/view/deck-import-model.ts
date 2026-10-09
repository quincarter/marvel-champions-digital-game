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
  exportDecklistText as exportDeckAsText,
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
  (result.notes ?? [])
    .filter((note) => note.code === "unreadable_line" || note.code === "identity_set_filled")
    .map((note) => note.message);

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
 * "Export" (W9, docs/phase4-screen-gaps.md §3): a decklist a player can copy out, paste into another client, or feed
 * straight back into `importFromPasteText`. The format and its round-trip guarantee live next to the importer
 * (`@mc/content`'s `import/to-text.ts`: a title shared by several cards is written with its code, `1x Cable (44002)`).
 */
export function exportDecklistText(deck: Deck, pool: CardPool): string {
  return exportDeckAsText(deck, Array.isArray(pool) ? pool : Object.values(pool));
}
