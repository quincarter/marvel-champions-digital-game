/**
 * Fear No Evil (Cycle 11) curation — a campaign box with two heroes (Daredevil, Echo) and six scenarios (Kingpin
 * plus Bullseye/Electro/Purple Man, mixed and matched).
 *
 * **Curated but NOT registered for emission** — see "Schema requests for game-rules-architect" (the Requirement/
 * Discount keyword gaps docs/phase7-wave2.md §6.11/§6.12 already named for this pack, "Prerequisite"/"Starting")
 * and the open question below in docs/phase7-wave2-data.md.
 *
 * - **Daredevil's Sense Deck (60002–60006: Acute Tactility, Enhanced Olfaction, Heightened Hearing, Radar Sense,
 *   Superior Taste) resolved via `auxiliaryHeroSetCodes`** (`daredevil_sense_deck` → `daredevil`), the same
 *   mechanism as `storm.ts`/`hercules.ts`. `deck_limit undefined invalid` for these five was a symptom of the
 *   same unresolved-identity failure (deck-limit defaulting depends on recognizing a card as identity-specific
 *   first) — resolves for free once the identity resolves; not independently re-verified against a card image.
 * - **Echo (60037a) is this pack's second hero identity** — confirmed present in raw (`type_code: "hero"`, its
 *   own `card_set_code: "echo"`); no structural error reported for Echo herself.
 * - **Photographic Reflexes (60040a/60040b/60040c) — NOT resolved, flagged rather than guessed at.** Three
 *   top-level MarvelCDB records, same `card_set_code` ("echo"), same `quantity: 2` each, byte-identical printed
 *   text, all three missing `imagesrc`. Genuinely ambiguous without a second source: could be (a) three real
 *   alternate-art printings MarvelCDB tracks separately (6 physical copies total), or (b) a MarvelCDB data
 *   duplication bug (the same physical card triplicated, the way trors' `10098` duplicated a real Captive ally —
 *   docs/phase7-wave2-data.md Part 1 §2). No card image exists for any of the three to settle it, and this
 *   pack released after this pipeline's own knowledge — a second source (Hall of Heroes' Fear No Evil release
 *   page or a physical count from a printed product) is needed before curating either way.
 */
import type { PackCuration } from "./types.ts";
import { KINGPIN } from "./fne-encounter/kingpin.ts";
import { MODULAR_CAMPAIGN } from "./fne-encounter/modular-campaign.ts";
import { SCENARIOS } from "./fne-encounter/scenarios.ts";
import { VILLAINS_A } from "./fne-encounter/villains-a.ts";
import { VILLAINS_B } from "./fne-encounter/villains-b.ts";

export const FNE_CURATION: PackCuration = {
  packCode: "fne",
  cycle: { id: "cycle11", name: "Fear No Evil", order: 11 },
  pack: {
    name: "Fear No Evil",
    releaseDate: "2026-07-01",
    releaseDateSource:
      'Hall of Heroes Fear No Evil page (https://hallofheroeslcg.com/fear-no-evil/): "Release date: July, 2026" (no specific day given; the first of the month is used as a placeholder — confirm before trusting this exact date).',
  },
  outDir: "src/data/fne",
  exportPrefix: "FNE",

  /**
   * The box's scenario half (villains, scenarios, modular sets, campaign cards, 60065-60210): MarvelCDB has none
   * of it (docs/phase7-wave11-data-survey.md §3). Transcribed from Hall of Heroes' Fear No Evil gallery scans and
   * checked a second time against the same scans, one module per group.
   */
  addedRecords: [...VILLAINS_A, ...VILLAINS_B, ...KINGPIN, ...SCENARIOS, ...MODULAR_CAMPAIGN],

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],

  auxiliaryHeroSetCodes: {
    daredevil_sense_deck: "daredevil",
  },
};
