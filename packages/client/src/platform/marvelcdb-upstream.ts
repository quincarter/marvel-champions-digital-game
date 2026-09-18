/**
 * What a MarvelCDB deck request means, whoever made it.
 *
 * Two callers reach MarvelCDB's public deck API: `vite-marvelcdb-import.ts` on
 * the dev/preview server, and `deck-fetch.ts` through a native shell's HTTP in
 * a packaged app. Both answer the Decks screen in one shape — the upstream
 * JSON on success, `{ error }` with a status otherwise — so the screen reads
 * one thing regardless of which one ran. Pure: no fetch, no Node, no DOM.
 */

export type MarvelCdbDeckKind = "decklist" | "deck";

export function marvelCdbDeckUrl(kind: MarvelCdbDeckKind, id: string): string {
  return `https://marvelcdb.com/api/public/${kind}/${id}.json`;
}

export interface DeckImportAnswer {
  readonly status: number;
  /** The upstream JSON on 200; a `{ "error": ... }` body otherwise. */
  readonly body: string;
}

export function deckImportError(status: number, message: string): DeckImportAnswer {
  return { status, body: JSON.stringify({ error: message }) };
}

/**
 * Both observed "not found" shapes are non-JSON — an empty body, or the HTML
 * login page a private `deck` redirects to — and both mean the same thing to a
 * player: nothing to import at that reference.
 */
export function interpretDeckResponse(
  kind: MarvelCdbDeckKind,
  id: string,
  upstream: { readonly ok: boolean; readonly contentType: string; readonly body: string },
): DeckImportAnswer {
  if (!upstream.ok || !upstream.contentType.includes("application/json") || upstream.body.trim().length === 0) {
    return deckImportError(404, `MarvelCDB has no ${kind === "deck" ? "deck" : "public decklist"} at id ${id} (it may not exist, or may be private).`);
  }
  return { status: 200, body: upstream.body };
}
