# @mc/content

Card data schema and normalized card data for Marvel Champions: Digital
Edition. `src/schema/` defines the _shape_ (see `src/schema/schema.test.ts` for
hand-typed fixtures covering every card type); `src/data/` holds generated,
validated card data (Core Set so far) — see "What ingestion produces" below.
No card art lives here, ever — only _references_ to where it can be found.

## Shape

- `schema/ids.ts` — branded string ids (`CardId`, `SetCode`, `CycleId`, `EncounterSetId`, `ScenarioId`, `CampaignId`, `AbilityId`, `ArtRef`, `ImageRef`) so foreign keys can't be swapped by accident.
- `schema/common.ts` — `ScalingValue` (`base + perPlayer * playerCount`, for anything printed with a per-player qualifier), `ResourceIconCounts`, `CardText` (printed vs. current), `ErrataStatus`, and the open-ended `Trait` type.
- `schema/keywords.ts` — a closed `KeywordInstance` union covering every keyword on the Hall of Heroes keyword list (cited in the file header), with structured parameters (`Retaliate 2`, `Uses (4 web)`, `Hinder 1`, `Teamwork` + shared trait, etc.) instead of free text.
- `schema/aspects.ts` — the core aspects plus a template-literal `HeroAspect` for identity-locked signature cards.
- `schema/abilities.ts` — `AbilityReference`: an opaque, stable `AbilityId` (`<cardCode>.<slug>`) plus an optional printed `label` and `notesForScripting`. Timing lives only in the engine-side ability registry (Phase 2: the old `trigger` classification was dropped).
- `schema/sets.ts` — `Cycle`, `Pack`, `EncounterSet` (modular/nemesis sets shared across products), `Scenario`, `Campaign`.
- `schema/cards/` — one interface per card type, unioned as `AnyCard`.
- `schema/validation.ts` — hand-written guards behind `validateCard()`; no external validation dependency.

## Rules-shape decisions worth knowing

- **Hero identity** is one record with `hero` and `alterEgo` faces. `hp` lives on the identity (damage persists across a flip); traits, hand size, and ATK/THW/DEF (hero) or REC (alter-ego) live on the face.
- **Allies** always carry `consequentialDamage: { attack, thwart }` — the small numbers printed beside the icons.
- **Villains and minions** have `atk` and `sch` (scheme), not THW. Villain `stages` are the printed I/II/III numerals; standard vs. expert is a scenario-level choice of which stages to use, not a card property.
- **Main scheme stages** have `startingThreat`, `targetThreat`, and `acceleration` (all `ScalingValue`) plus `icons`. **Side schemes** have only `startingThreat` — they're defeated when thwarted to 0.
- **Boost icons** are a required field on every encounter-deck card (minion, attachment, treachery, obligation, environment, side scheme) because the encounter deck _is_ the boost deck. There is no "boost card" type. A boost-star effect is an ability whose registry entry has a `boost` trigger.
- **Card art** is referenced two ways, never stored. Both are pointers; no image bytes are in this repo, and neither is a licence to redistribute the art (`CLAUDE.md` IP boundary).
  - `art?: ArtRef` — a key into a gitignored **local** asset folder, for a user's own scans.
  - `images?: CardImages` / per-face `image?: ImageRef` — where the **source** publishes the art, as MarvelCDB's own site-relative path (`/bundles/cards/01001a.png`). The host is resolved at use time by `imageUrl(ref, base?)` in `schema/images.ts`, so the data stays references rather than thousands of baked URLs and a client can point at a mirror without the card data changing.

  A client should prefer a local `ArtRef` when it has one and fall back to the `ImageRef`.

- **An artwork reference exists for every printed face**, and ingestion fails if one is missing. Where the reference lives follows how the schema models faces:

  | Card type                                                                                                                   | Where the reference lives                                                     | Source                                                                                                                                                                                          |
  | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Single-faced (ally, event, support, upgrade, resource, minion, treachery, side scheme, attachment, obligation, environment) | `images.front` (and `images.back` when the source has one)                    | the record's `imagesrc` / `backimagesrc`                                                                                                                                                        |
  | Hero identity                                                                                                               | `hero.image` and `alterEgo.image`, mirrored as `images.front` / `images.back` | the record's `imagesrc`, and its **`linked_card`'s** `imagesrc` — MarvelCDB publishes the alter-ego as a linked card that "flips", not as a back image                                          |
  | Villain                                                                                                                     | `sides[].stages[].image`; no card-level `images`                              | each stage's own record (a three-stage villain is three printed cards)                                                                                                                          |
  | Main scheme                                                                                                                 | `stages[].aSide.image` and `stages[].image`; no card-level `images`           | the B side from the `…b` record; the **A side from the aggregate record** (`01097` for `01097a`), which ingestion drops as a duplicate but is the only place the pair's front face is published |

## Versioning

Every card carries `setCode` + `cycleId` and an optional `errata: ErrataStatus`
(current errata/taboo version tag plus a history trail). Rules text is never
overwritten in place: `CardText = { printed, current }` keeps the original print
and the currently-legal wording side by side.

## What ingestion produces

```
pnpm --filter @mc/content ingest                 # fetch the Core pack from MarvelCDB, cache, normalize, emit
pnpm --filter @mc/content ingest -- --offline    # re-normalize from the committed raw cache (no network)
pnpm --filter @mc/content ingest -- --pack core  # explicit pack (only packs with a curation file are supported)
```

Runs under Node ≥ 22.6 type stripping (`node --experimental-strip-types`), no build step and no extra dependency.

**Pipeline** (`scripts/ingest-marvelcdb.ts` → `scripts/marvelcdb/*`):

1. **Fetch + raw cache.** `https://marvelcdb.com/api/public/cards/<pack>` is written verbatim to
   `raw/marvelcdb/<pack>.json` (`{ source, fetchedAt, pack, cards }`) — every field the API returns,
   including `imagesrc`, `backimagesrc`, `meta`, `octgn_id` and `url` (and the same fields inside
   `linked_card`). Those are _references_ — MarvelCDB image paths, an OCTGN guid, a MarvelCDB page URL
   — not image bytes; no art is stored in the repo, which is the CLAUDE.md IP boundary.
   `--offline` re-runs everything below from this cache, so data changes are reviewable as a diff
   of the curation + generated files alone.
2. **Normalize** (`normalize.ts`, `text.ts`, `parse-text.ts`). `real_text` → plain text with
   `[energy] [mental] [physical] [wild] [per_hero] [star]` tokens; traits upper-cased; hero +
   alter-ego → one `HeroIdentityCard` (per-face keywords, obligation and nemesis links); villain stage
   records → one `VillainCard` per villain; main-scheme `NNNNa`/`NNNNb` pairs → one stage each, B side
   in the stage fields and A side in `aSide`, all stages of a scenario in one `MainSchemeCard`;
   printed variants (Wakanda Forever! a–d, Android Efficiency a–c) stay separate cards. Keyword lines
   become `KeywordInstance`s, "Max N per …/Hero form only/Play under any player's control" become
   `deckLimit`/`playRestrictions`, "Attach to …" becomes `attachesTo`, attachment stat boxes become
   `statModifiers`. Scaling: `health_per_hero`, or a **false** `*_fixed` flag on
   base_threat/threat/escalation_threat, means "per player" (The Break-In! 1B = 7 per player target,
   1 per player acceleration; Breakin' & Takin' = flat 2). MarvelCDB _aggregate_ records (bare
   `01097`, `01144`, … duplicating their `a/b` variants) are dropped and listed in
   `CORE_DROPPED_SOURCE_RECORDS`. The run fails on anything it can't classify, any unused curation
   entry, or any MarvelCDB record that didn't land in a card.
3. **Curate** (`scripts/marvelcdb/curation/<pack>.ts`). Everything MarvelCDB can't supply or gets
   wrong, each entry with its evidence: transcription corrections (applied to printed _and_ current
   text — the card always said this), official errata (printed text reconstructed from the current
   text), scripting notes, card-level data decisions, scenarios, starter decks.
4. **Emit** (`emit.ts`) typed modules to `src/data/core/`: `cards.ts` (`CORE_CARDS`), `packs.ts`,
   `encounterSets.ts`, `scenarios.ts`, `starterDecks.ts`, `provenance.ts` (`CORE_PROVENANCE`: which
   MarvelCDB codes and which corrections produced each card). One record per block, ordered by id,
   branded ids written as schema helper calls — so `pnpm typecheck` checks every generated record.
   **Never edit these files by hand**; change the curation and regenerate.

**Ability ids** (`<cardCode>.<slug>`, stable, never renumbered; the code is the face/stage/side the
ability is printed on): a printed ability name → its slug (`01001a.spider-sense`,
`01019a.do-you-even-lift`); structural timings → bare slug (`setup`, `boost`, `when-revealed`,
`when-revealed-hero`, `when-revealed-alter-ego`, `when-defeated`, `obligation` for a whole obligation);
anything else → `<card-name-slug>-<kind>` with kind `action|resource|response|interrupt|
forced-response|forced-interrupt|special|constant` (`01008.web-shooter-resource`,
`01099.charge-forced-interrupt`); on a collision the printed form qualifier is added
(`01018.energy-channel-hero-action`). Keyword lines, reminder text, restrictions, attach rules, a main
scheme's `Contents:` paragraph and "If this stage is completed, the players lose the game." are not
abilities. A leading `[star]` is a printed reminder icon and stays in the text only.

**Sources and cross-checks.** MarvelCDB is the primary transcription; every Core card was diffed
against the independent Cerebro database, and every disagreement was settled against the printed card
(and the Core Learn to Play booklet where relevant) — see `curation/core.ts` for each decision.
Card images were only _looked at_ for that verification; none are stored anywhere in the repo. The
raw cache keeps MarvelCDB's `imagesrc`/`backimagesrc` paths, and ingestion carries them through to
the normalized data as `ImageRef`s (see "Card art" above) — paths, never bytes.

**Core Set decisions worth knowing** (all recorded in `CORE_PROVENANCE`):

- Hand-corrected MarvelCDB errors: `"I'm Tough!"` title; Usurp the Throne capitalization; Concussion
  Blasters' +1 ATK stat box; Heart-Shaped Herb has 0 boost icons (boost star only); Whiplash's CRIMINAL
  trait; Ultron (III) and Tiger Shark carry no threat/hazard (MarvelCDB artifacts); a dozen wording
  fixes (Ultron II "this attack", Eviction Notice "Choose one:", …).
- Errata: Superhuman Law Division lost its "(thwart)" label (RRG 1.5); MODOK → "M.O.D.O.K." on the
  minion's title (RRG 1.5) and in The Doomsday Chair's text (RRG 1.6). `text.printed` keeps the print.
- Not expressible in the schema yet (flagged): Hulk's printed THW "—" (carried as 0), Titania's printed
  ATK "X" (carried as 0 + a noted constant ability), per-stage names of multi-stage main schemes
  (Secret Rendezvous, Assault on NORAD, Countdown to Oblivion — `name` is the stage-1 name), and
  `validateCard()` still rejects the four printed cards with no rules text at all (Energy Absorption,
  Vibranium, Rhino (I), Usurp the Throne); `src/data/core.test.ts` pins that list.
- The Learn to Play lists "Vibranium Chassis" in Under Attack; the printed card is Vibranium Armor.
- Obligations have `encounterSetIds: []` — they belong to a hero kit and reach the encounter deck via
  `HeroIdentityCard.obligationCardId`.

**Starter decks** (`CORE_STARTER_DECKS`, six, all `verified: true`): the five Learn to Play
"Starter Decks" lists (p.20–21), each identical to the matching official MarvelCDB precon decklist, plus
the Captain Marvel **Aggression** tutorial deck — the deck actually pre-sorted in the box and printed on
its title card; the Learn to Play notes it differs from the Leadership list. The precons are not built
to coexist from one box (every list includes the single Mockingbird; She-Hulk and Iron Man share the
Aggression cards) — each list is validated against one box's quantities on its own.

**Adding a pack:** add `scripts/marvelcdb/curation/<pack>.ts`, register it in `CURATIONS` in
`ingest-marvelcdb.ts`, run the ingest online, fix whatever the normalizer reports, cross-check against
a second source, then add the pack's exports to `src/data/index.ts`.
