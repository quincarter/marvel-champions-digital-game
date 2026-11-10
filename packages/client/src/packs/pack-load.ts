/**
 * Reading and validating one installed pack's files into a `PackRuntime` (docs/custom-content-packs.md §7.4). Plain and
 * synchronous: `pack-load.worker.ts` runs it off the main thread, and `load-client.ts` runs it here when it has no worker.
 */
import { readPackInput, validatePack, SUPPORTED_DSL_FEATURES } from "@mc/mod-sdk";
import type { PackManifest } from "@mc/content";
import type { PackRuntime } from "./pack-runtime.js";

export type PackLoadResult =
  | { readonly ok: true; readonly runtime: PackRuntime }
  | { readonly ok: false; readonly reason: string };

/** The most issues a skip reason spells out; the rest are counted. */
const REASON_ISSUES = 3;

/**
 * Reads and validates one installed pack's files. `requiredPackCards` is the card codes of the loaded packs its manifest
 * `requires.packs` lists. Never throws: a pack that cannot be read, fails `validatePack` or needs a feature this client
 * lacks comes back as a reason the store screen can show.
 */
export function loadPackRuntime(
  manifest: PackManifest,
  files: ReadonlyMap<string, Uint8Array>,
  requiredPackCards: ReadonlySet<string> = new Set(),
): PackLoadResult {
  try {
    const missing = (manifest.requires?.dslFeatures ?? []).filter(
      (feature) => !SUPPORTED_DSL_FEATURES.includes(feature),
    );
    if (missing.length > 0) return { ok: false, reason: `Needs newer app features: ${missing.join(", ")}` };
    const input = readPackInput(manifest, files);
    const issues = validatePack(input, { requiredPackCards });
    if (issues.length > 0) {
      const shown = issues.slice(0, REASON_ISSUES).map((issue) => `${issue.path}: ${issue.message}`);
      const more = issues.length - shown.length;
      return { ok: false, reason: `Failed validation: ${shown.join("; ")}${more > 0 ? ` (and ${more} more)` : ""}` };
    }
    return {
      ok: true,
      runtime: {
        id: manifest.id,
        version: manifest.version,
        name: manifest.name,
        cards: input.cards,
        abilities: input.abilities,
        decks: input.decks ?? [],
      },
    };
  } catch (error) {
    return { ok: false, reason: `Could not be loaded: ${error instanceof Error ? error.message : String(error)}` };
  }
}
