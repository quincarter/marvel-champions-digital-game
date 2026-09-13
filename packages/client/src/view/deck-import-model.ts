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

export type ImportOutcome = { readonly ok: true; readonly deck: Deck } | { readonly ok: false; readonly problems: readonly ImportProblem[] };

export interface ImportEnv {
  readonly pool: readonly AnyCard[];
  readonly poolVersion: string;
  readonly now: () => string;
  readonly newId: () => string;
}

function nameFor(heroName: string | null, fallback: string): string {
  return heroName ? `${heroName} (imported)` : fallback;
}

/** Import-by-paste: works with no network, per PLAN.md Phase 9's "build it first; it is also the easiest to test". */
export function importFromPasteText(text: string, env: ImportEnv): ImportOutcome {
  const result = parseDecklistText(text, env.pool);
  if (!result.ok) return { ok: false, problems: result.problems };
  return {
    ok: true,
    deck: {
      id: deckId(env.newId()),
      name: nameFor(result.heroName, "Imported deck"),
      identityCardId: result.contents.identityCardId,
      aspects: result.contents.aspects,
      cards: result.contents.cards,
      poolVersion: env.poolVersion,
      source: { kind: "imported", site: "marvelcdb", marvelcdbDeckId: null, url: null, importedAt: env.now() },
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
  return {
    ok: true,
    deck: {
      id: deckId(env.newId()),
      name: nameFor(result.heroName, `MarvelCDB ${ref.kind} #${ref.id}`),
      identityCardId: result.contents.identityCardId,
      aspects: result.contents.aspects,
      cards: result.contents.cards,
      poolVersion: env.poolVersion,
      source: { kind: "imported", site: "marvelcdb", marvelcdbDeckId: ref.id, url: sourceUrl, importedAt: env.now() },
    },
  };
}
