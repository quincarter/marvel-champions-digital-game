/**
 * Recognizing a MarvelCDB deck reference from what a player pastes into the
 * "import by URL or id" field — a URL, or a bare id.
 *
 * Two endpoints exist and are not interchangeable: `/api/public/decklist/<id>`
 * is a *published, shareable* decklist, and `/api/public/deck/<id>` is a
 * user's own deck (which 404s-as-a-login-redirect for anyone else, confirmed
 * live 2026-09-13 — see `from-marvelcdb-json.ts`). The site's own URLs say
 * which is which (`/decklist/view/<id>/...` vs `/deck/view/<id>/...`), so a
 * URL is unambiguous; a bare id is not, and is treated as `decklist`, the
 * public-sharing case and the one a link a player was actually given points
 * at.
 */
export type MarvelCdbRefKind = "decklist" | "deck";

export interface MarvelCdbRef {
  readonly kind: MarvelCdbRefKind;
  readonly id: string;
}

const URL_PATTERN = /marvelcdb\.com\/(decklist|deck)\/view\/(\d+)/i;
const BARE_ID = /^\s*(\d+)\s*$/;

/** Parses a pasted URL or bare id. Returns null for anything else, so the caller can show one clear "not a MarvelCDB deck link or id" message. */
export function parseMarvelCdbReference(input: string): MarvelCdbRef | null {
  const trimmed = input.trim();
  const bare = BARE_ID.exec(trimmed);
  if (bare) return { kind: "decklist", id: bare[1]! };
  const url = URL_PATTERN.exec(trimmed);
  if (url) return { kind: url[1]!.toLowerCase() as MarvelCdbRefKind, id: url[2]! };
  return null;
}
