/**
 * Fetching a MarvelCDB deck for import, on whichever shell this is.
 *
 * On the web it asks the dev/preview route (`vite-marvelcdb-import.ts`), which
 * a production web build doesn't have — that 404 is the designed fallback to
 * paste. In a packaged app it asks MarvelCDB directly through native HTTP and
 * shapes the answer the same way the route would, so the Decks screen can't
 * tell the two apart.
 */

import { nativeGet } from "./native-http.js";
import {
  deckImportError,
  interpretDeckResponse,
  marvelCdbDeckUrl,
  type DeckImportAnswer,
  type MarvelCdbDeckKind,
} from "./marvelcdb-upstream.js";
import { detectPlatform, type Platform } from "./platform.js";

/** Must match `MARVELCDB_IMPORT_ROUTE` in vite-marvelcdb-import.ts (a root-level plugin file, not part of this bundle). */
const ROUTE = "/api/marvelcdb-import/";

export async function fetchMarvelCdbDeck(
  kind: MarvelCdbDeckKind,
  id: string,
  platform: Platform = detectPlatform(),
): Promise<DeckImportAnswer> {
  if (platform === "web") {
    const response = await fetch(`${ROUTE}${kind}/${id}`);
    return { status: response.status, body: await response.text() };
  }
  try {
    const upstream = await nativeGet(platform, marvelCdbDeckUrl(kind, id), "text");
    return interpretDeckResponse(kind, id, {
      ok: upstream.status >= 200 && upstream.status < 300,
      contentType: upstream.contentType,
      body: new TextDecoder().decode(upstream.body),
    });
  } catch (cause) {
    return deckImportError(502, `could not reach MarvelCDB: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}
