/**
 * Turning an `ImageRef` into something a client can load.
 *
 * The refs stored on cards are exactly what the source publishes — for
 * MarvelCDB, site-relative paths like `/bundles/cards/01001a.png`. The host
 * lives here rather than in the card data so that:
 *
 *  - the data stays a set of references rather than thousands of baked URLs;
 *  - a client can point at a local mirror, a cache, or its own scans without
 *    the card data changing;
 *  - if the upstream host ever moves, one constant moves with it.
 *
 * No image bytes are stored in this repo and nothing here grants a right to
 * redistribute the art (CLAUDE.md "Content & IP boundaries"). A client that has
 * a local scan should prefer the card's `ArtRef` and use this only as the
 * fallback.
 */

import type { ImageRef } from "./ids.js";

/** Where MarvelCDB serves the paths in `ImageRef`. No trailing slash. */
export const MARVELCDB_IMAGE_BASE = "https://marvelcdb.com";

/**
 * Resolves a ref against a host. A ref that is already absolute is returned
 * unchanged, so a mirror can store full URLs without special-casing.
 */
export function imageUrl(ref: ImageRef, base: string = MARVELCDB_IMAGE_BASE): string {
  const path = ref as string;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
