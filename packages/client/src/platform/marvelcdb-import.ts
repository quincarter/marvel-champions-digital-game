/**
 * Import a deck from a MarvelCDB link or id: the one flow Decks & Collection and the room deck picker share. It parses
 * what the player typed, fetches the decklist (the dev/preview route on the web, native HTTP in a packaged app: a 404
 * on a production web build is the designed fallback, see `vite-marvelcdb-import.ts`), and shapes it into a deck with
 * the same importer. It never saves: the caller stores the deck, so each screen keeps its own list in step.
 */
import type { Deck } from "@mc/content";
import { importFromMarvelCdbResponseText, type ImportEnv } from "../view/deck-import-model.js";
import { parseMarvelCdbReference } from "@mc/content";
import { fetchMarvelCdbDeck } from "./deck-fetch.js";

export type MarvelCdbImportResult =
  | { readonly ok: true; readonly deck: Deck; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly message: string };

/** What a failed fetch says: the server's own words when it sent some, else a line for the 404 or the status. */
export function marvelCdbFailureMessage(status: number, body: string): string {
  // A production deploy has no `vite-marvelcdb-import.ts` route at all (dev/preview only) and 404s here with no JSON
  // body: the one case this build cannot tell apart from "MarvelCDB has nothing at that id", so it names the real cause.
  let message =
    status === 404
      ? "MarvelCDB import by link isn't available in this deployment (or MarvelCDB has nothing at that id). Paste the decklist instead."
      : `MarvelCDB import failed (HTTP ${status}).`;
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed.error) message = parsed.error;
  } catch {
    /* the fallback message above already covers a non-JSON error body */
  }
  return message;
}

/** "Imported "X"." plus up to three skipped lines, each named, so an unreadable line is never silently dropped. */
export function importedDeckNote(name: string, warnings: readonly string[]): string {
  const shown = warnings.slice(0, 3);
  const more = warnings.length - shown.length;
  const skipped = shown.length > 0 ? `\n${shown.join("\n")}${more > 0 ? `\n…and ${more} more lines.` : ""}` : "";
  return `Imported "${name}".${skipped}`;
}

export async function importMarvelCdbDeck(
  text: string,
  env: ImportEnv,
  fetcher: typeof fetchMarvelCdbDeck = fetchMarvelCdbDeck,
): Promise<MarvelCdbImportResult> {
  const ref = parseMarvelCdbReference(text);
  if (!ref) return { ok: false, message: "That doesn't look like a MarvelCDB deck link or id." };
  try {
    const response = await fetcher(ref.kind, ref.id);
    if (response.status !== 200) return { ok: false, message: marvelCdbFailureMessage(response.status, response.body) };
    const outcome = importFromMarvelCdbResponseText(
      response.body,
      ref,
      `https://marvelcdb.com/${ref.kind}/view/${ref.id}`,
      env,
    );
    if (!outcome.ok) return { ok: false, message: outcome.problems.map((problem) => problem.message).join(" ") };
    return { ok: true, deck: outcome.deck, warnings: outcome.warnings };
  } catch (cause) {
    return { ok: false, message: cause instanceof Error ? cause.message : String(cause) };
  }
}
