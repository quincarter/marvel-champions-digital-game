/**
 * A curation with no hand corrections, for two purposes:
 *  - `survey.ts`'s dry run, which wants to know what MarvelCDB's data alone
 *    can support before anyone hand-verifies a single card against a scan;
 *  - emitting a pack whose data turns out to need *no* curation at all
 *    (rare — most packs need at least one correction the way Core did).
 *
 * `cycle`/`pack` metadata is a placeholder, not researched fact: a real
 * release date and cycle grouping need Hall of Heroes / the FFG product page,
 * which this factory does not fetch. Anything emitted through a bare curation
 * must have that metadata filled in — a card whose stats/text/keywords are
 * right but whose release date is a guess is still wrong data.
 */
import type { PackCuration } from "./types.ts";
import type { RawCard } from "../raw-types.ts";

export function bareCuration(packCode: string, sample: RawCard | undefined): PackCuration {
  return {
    packCode,
    cycle: { id: "unresearched", name: "Unresearched cycle", order: -1 },
    pack: {
      name: sample?.pack_name ?? packCode,
      releaseDate: "unresearched",
      releaseDateSource:
        "PLACEHOLDER — not researched by the dry-run survey; fill in from Hall of Heroes/FFG before emitting for real.",
    },
    outDir: `src/data/${packCode}`,
    exportPrefix: packCode.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
    corrections: [],
    errata: [],
    scriptingNotes: {},
    cardNotes: {},
    scenarios: [],
    starterDecks: [],
  };
}
