/**
 * The Once and Future Kang Scenario Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/toafk.json`).
 * - "card image": the printed card, viewed directly at `https://marvelcdb.com/bundles/cards/<code>.png`
 *   (verification only, no bytes stored — CLAUDE.md "Content & IP boundaries").
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N.
 *
 * **Card-shape work landed in the normalizer, not curation** (`packages/content/scripts/marvelcdb/normalize/`,
 * schema-neutral per this pass's remit — docs/phase7-wave2.md §1.6/§1.8, "landed Kang shapes"):
 * - `villains.ts`: the "kang"/"exp_kang" sets each hold six single-stage villain records (Kang (I), four
 *   differently-titled Kang (II) variants, Kang (III)) that do not form one incrementing sequence — recognized
 *   structurally (more than one record claims the same stage number, which no genuine single villain's stages
 *   ever do) and emitted as six separate one-stage `VillainCard`s instead of erroring "stage names differ".
 * - `main-schemes.ts`: a stage whose starting/target/acceleration threat MarvelCDB marks `*_fixed: true` with no
 *   value (The Master of Time, stage 2B, `11008b`) is read as `dashedValues` instead of erroring "missing
 *   threat". Confirmed from the card image below.
 * - `flatten.ts`: the aggregate-vs-B-side consistency check no longer treats an absent (`undefined`) aggregate
 *   value and an explicit `null` B-side value as a mismatch — both mean "no printed value", and a dashed stage's
 *   aggregate record uses the former while its B-side record uses the latter (11008/11008b).
 * - Kang's four stage 3 alternatives (The Chronopolis 11009, Inexorable Fate 11010, The Realm of Rama-Tut 11011,
 *   The Present Future War 11012) already normalize as one `MainSchemeCard`'s four `stageNumber: 3` entries,
 *   told apart by `name` (the existing "keep a later stage's own title" rule) — no normalizer change needed.
 *
 * **Card-image checks from docs/phase7-wave2.md §5** (viewed at `card image` above):
 * - **Kang (Scarlet Centurion)'s SCH** (11005 standard, 11038 expert): the doc flagged this as printed with no
 *   SCH at all. The card image shows SCH **0** (standard) and SCH **1** (expert), both starred (variable), and
 *   raw already carries these exact values (`scheme: 0` / `scheme: 1`) — **no correction needed; confirmed
 *   correct as-is**, the doc's concern did not reproduce against this pack's current raw cache.
 * - **The Master of Time 2B's dashed values** (11008b): no image exists for this face on MarvelCDB (`imagesrc:
 *   null`, and a direct fetch of `11008b.png`/`.jpg` both 404) — **not independently confirmed from a scan**.
 *   The `_fixed: true` / value-`null` pattern on all three threat fields (distinct from the `_fixed: false` /
 *   value-`null` pattern a genuine data gap would show) is the normalizer's basis for reading it as dashed;
 *   flagged here as the best available evidence, not a substitute for a scan.
 *
 * **Text fixes** (docs/phase7-wave2.md §5.2, "The Master of Time (11008): 'in turn oder'; 'advanced to stage
 * 4A'"), both MarvelCDB transcription typos confirmed against the card image (11008a's own scan is on
 * MarvelCDB; 11008b has none, so its half is corrected on the strength of the identical, confirmed-typo pattern
 * on 11008a rather than its own scan):
 * - 11008a: "in turn oder" -> "in turn order".
 * - 11008b: "advanced to stage 4A" -> "advance to stage 4A" (every other stage's parallel ability reads
 *   "advance", present tense; "advanced" cannot be a deliberate past-tense variant here, since the ability
 *   triggers the advance itself).
 *
 * **Not independently confirmed, left as-is (no evidence either way):** Chronopolis (11009) reads "this stage
 * is complete" where the other three stage 3 alternatives (11010, 11011, 11012) read "this stage is completed".
 * Both are grammatical; nothing here can tell whether one is a printed variant or a transcription slip without a
 * scan of 11009 specifically (no image exists for any stage-3 B side). Not changed.
 *
 * **Scenario setup (docs/phase7-wave2.md §2.3, §1.8) and the starter deck are not curated this pass** — this
 * pack has no starter deck of its own (a scenario pack), and `Scenario`-level curation (`setAsideVillainCardIds`,
 * `expertVillains`, `victory`, `separateGameAreas`) needs `ScenarioCuration` fields this pass didn't extend to
 * (mirrors `trors`' own "scenarios not yet curated" scope cut).
 */
import type { PackCuration } from "./types.ts";

export const TOAFK_CURATION: PackCuration = {
  packCode: "toafk",
  cycle: { id: "cycle1", name: "The Rise of Red Skull", order: 2 },
  pack: {
    name: "The Once and Future Kang",
    releaseDate: "2020-10-02",
    releaseDateSource:
      'Hall of Heroes The Once and Future Kang page (https://hallofheroeslcg.com/the-once-and-future-kang/): "Release date: October 2, 2020 (Originally August, 2020)" — the wide release date is used.',
  },
  outDir: "src/data/toafk",
  exportPrefix: "TOAFK",

  corrections: [
    {
      code: "11008a",
      reason: 'MarvelCDB\'s own transcription typo: "Each player reveals a random stage 3A in turn oder" should read "in turn order".',
      evidence: "raw (11008a); card image (marvelcdb.com/bundles/cards/11008a.png, confirms \"in turn order\"); docs/phase7-wave2.md §5.2",
      textReplace: { find: "in turn oder", replace: "in turn order" },
    },
    {
      code: "11008b",
      reason:
        'MarvelCDB\'s own transcription typo: "When all the players have joined this game area, advanced to stage 4A" should read "advance to stage 4A" — every parallel stage-3 ability reads "advance" (present tense; the ability itself triggers the advance). No image exists for this face; corrected on the strength of the identical, image-confirmed typo pattern on 11008a rather than its own scan.',
      evidence: "raw (11008b); docs/phase7-wave2.md §5.2 (image not independently available for this face — see file header)",
      textReplace: { find: "advanced to stage 4A", replace: "advance to stage 4A" },
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "11005": "Kang (Scarlet Centurion)'s SCH: docs/phase7-wave2.md §5.2 flagged this as printed with no SCH. Card image (marvelcdb.com/bundles/cards/11005.png) shows SCH 0 (starred); raw's scheme:0 already matches — confirmed correct, no correction applied.",
    "11038": "Kang (Scarlet Centurion), expert, SCH: card image (marvelcdb.com/bundles/cards/11038.png) shows SCH 1 (starred); raw's scheme:1 already matches — confirmed correct, no correction applied.",
    "11007a": "The Master of Time 2B's dashed starting/target/acceleration threat (docs/phase7-wave2.md §1.6) is not independently confirmed from a card scan — no image exists for 11008b on MarvelCDB (imagesrc null; direct fetch of 11008b.png/.jpg both 404). Read from the `_fixed: true` + null-value pattern, which is how the schema/normalizer distinguish a dash from a data gap; treat as high-confidence but unverified against a scan until one is found.",
  },

  scenarios: [],
  starterDecks: [],
};
