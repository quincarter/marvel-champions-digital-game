/**
 * Storm (Ororo Munroe) Hero Pack (Cycle 6) curation.
 *
 * **Registered and emitted (docs/phase7-wave2-data.md Part 6)** — `HostMeasure "thw"` landed
 * (`packages/content/src/schema/cards/attachment-host.ts`) and the matching `parse-text.ts` descriptor mapping
 * (`"thw"` → `HostMeasure "thw"`, mirroring `"cost"` → `"printedCost"`) closed the one remaining blocker below
 * (Possessed, 36038).
 *

 * - **The Weather Deck (36002–36005: Clear Skies, Hurricane, Thunderstorm, Blizzard) resolved via the new
 *   `auxiliaryHeroSetCodes` mechanism**, not a one-off: these four supports are Storm's own hero-kit cards (a
 *   "one active weather condition at a time" mechanic — each is `Permanent`, and each has a `Special` ability
 *   swapping which one is in play), but MarvelCDB files them under their own themed sub-set (`storm_weather_deck`)
 *   instead of Storm's own identity set (`storm`), so `heroBySet`'s ordinary `card_set_code` lookup found no
 *   identity for them ("hero card in a set with no identity"). `auxiliaryHeroSetCodes: { storm_weather_deck:
 *   "storm" }` aliases the auxiliary set to Storm's own hero record — general mechanism (`normalize/context.ts`),
 *   not Storm-specific; the same shape is flagged (not yet confirmed) in `fne`/`hercules`/`iceman`'s own gap
 *   matrix entries.
 * - Each Weather Deck card's cost (also flagged "support without a cost") is the confirmed dash-cost pattern
 *   (Permanent, enters play by choice/effect rather than being paid for — MarvelCDB's own "Cost: —" listing).
 * - **Possessed (36038, attachment): now parses.** "Attach to the ally with the lowest THW without Possessed
 *   attached" → `{ kind: "superlative", among: "ally", order: "lowest", measure: "thw", withoutAttachmentNamed:
 *   "Possessed" }` — the same `SuperlativeHostPool "ally"` shape as `valk`'s Beguiled and `deadpool`'s
 *   'Pool-ized ("highest cost"), with the `thw` measure instead of `printedCost`.
 */
import type { PackCuration } from "./types.ts";

export const STORM_CURATION: PackCuration = {
  packCode: "storm",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "Storm",
    releaseDate: "2022-11-11",
    releaseDateSource: 'Hall of Heroes Ororo Munroe/Storm page (https://hallofheroeslcg.com/ororo-munroe-storm/): "Release date: November 11, 2022"',
  },
  outDir: "src/data/storm",
  exportPrefix: "STORM",

  corrections: [
    {
      code: "36002",
      reason: "Clear Skies is one of the Weather Deck's four Permanent supports, swapped into play by their own Special ability rather than played from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/36002), \"Cost: —\"",
      specialCost: "dash",
    },
    {
      code: "36003",
      reason: "Hurricane — same Weather Deck reasoning as 36002.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/36003), \"Cost: —\"",
      specialCost: "dash",
    },
    {
      code: "36004",
      reason: "Thunderstorm — same Weather Deck reasoning as 36002.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/36004), \"Cost: —\"",
      specialCost: "dash",
    },
    {
      code: "36005",
      reason: "Blizzard — same Weather Deck reasoning as 36002.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/36005), \"Cost: —\"",
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],

  auxiliaryHeroSetCodes: {
    storm_weather_deck: "storm",
  },
};
