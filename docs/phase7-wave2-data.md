# Phase 7 wave 2: the schema-neutral data pass (`card-data-pipeline`, 2026-09-18)

Scope: PLAN.md Phase 7 "Wave 2 scope decided (2026-09-18)". This is the schema-neutral first pass across all 62
non-Core packs, followed by curating and emitting whatever cycle 1 packs turned out not to need a new schema
shape. `docs/phase7-wave2.md` is `game-rules-architect`'s parallel spec for cycle 1's schema and engine primitives
(landed mid-pass, see "What changed under me" below) — this file is the data pipeline's own record of what it did
and what's left.

## Result

- **Before:** 1,498 issues across 63 packs (9 normalize cleanly: `core` + the 8 wave 1 packs).
- **After:** 768 issues across 63 packs (25 normalize cleanly: the same 9, plus `ant`, `cyclops`, `drax`, `gam`,
  `gambit`, `ncrawler`, `nebu`, `ron`, `scw`, `stld`, `trors`, `vision`, `vnm`, `warm`, `winter`, `wsp` — most of
  these newly-clean packs are a side effect of general parser fixes, not cycle 1 work). `angel` and `bp` are
  *close* but not clean — 1 and 2 issues respectively — see §4.
- **Emitted this pass, real hand-verified curation:** `scw`, `ant`, `wsp`, `trors` (see §2).
- **Not emitted, blocked, documented below:** `qsv`, `toafk` (see §2), and the other 56 non-cycle-1 packs (see §4,
  the gap matrix).
- **Verification:** root `pnpm typecheck` and `pnpm test` are clean after every change in this pass, most
  recently: content 288, engine 568, cards 441, client 1053 passing. `src/data/core` and the eight wave 1 pack
  folders are git-unmodified (confirmed via `git status`) — byte-identical, as required.

## What changed under me

`game-rules-architect` landed the cycle 1 schema (`packages/content/src/schema/**`) partway through this pass —
`additionalHeroForms`, `printedAspect`, `specialCost`, `specificTo`/the `"none"` aspect, `EncounterSet
.campaignSpecific`, `flipSide` on player cards, Kang's stage alternatives and `dashedValues`, the `ifAble` attach
host, `maxPerPhase`, and the scenario fields in `docs/phase7-wave2.md` §1 — and its own §5 already named most of
the parser mappings this file's §1/§3 describe. Where this file and `docs/phase7-wave2.md` overlap, they agree;
this file adds the schema-neutral generalizations `docs/phase7-wave2.md` didn't need to spell out (case
sensitivity, the villain short-name rule, the qualified/superlative attach-host regex, the campaign
`EncounterSet` registration, the `ignoredRecords` mechanism) and the results across the other 56 packs.

---

## 1. Schema-neutral fixes made (no `src/schema/**` edit)

All in `packages/content/scripts/**`. Every fix below is used by more than one pack unless noted.

### Keywords (`parse-text.ts`)

- **Team-Up** (`Team-Up (Ant-Man and Wasp). Max 1 per deck.`) → `{ name: "teamUp", names: [a, b] }`, fully
  resolved — the shape already existed.
- **Teamwork** (`Teamwork (Dark Riders).`) → `{ name: "teamwork", sharedTrait }`, fully resolved. Checked that a
  card *titled* "Teamwork" (Thor's 06032) isn't affected: the parser only matches sentence text, never a card's
  `name`, and 06032's own text has no `Teamwork (...)` line.
- **Requirement**, single icon only (`Requirement ([energy]).`) → `{ name: "requirement", icon }`. A multi-icon
  Requirement (`Requirement ([mental][mental])`, `Requirement ([energy] [mental] [physical])`) is **not**
  resolved: the current shape's `icon` field is singular, so a second/third icon would be silently dropped rather
  than reported. These are explicitly diverted to `unclassified` with a named category, `Requirement keyword
  needs more than one resource icon (schema gap)`, rather than falling through to plain constant text the way an
  unrecognized sentence used to. 4 cards, `ironheart`/`nova`/`silk`/`sm` — none in cycle 1. **Schema need:** see §3.
- **Discount** is never resolved: every printed Discount is `Discount N (Trait)` or `Discount N (TraitA or
  TraitB)`, and the current stub shape has only `value`, no trait field at all. Diverted to `unclassified`
  (`Discount keyword needs a target-trait qualifier (schema gap)`) rather than silently kept as `value` with the
  qualifying trait dropped. 3 cards, all `fne` — not in cycle 1. **Schema need:** see §3.
- **Find** needed no change: every printed "Find" in the whole 62-pack survey is embedded inside a longer
  ability sentence ("Find Kingpin and put him into play engaged with you"), never a standalone keyword line the
  way Guard/Surge are, so it was never at risk of being misread — it stays ordinary ability text.

### Text tokens (`text.ts`)

Added `[amplify]`, `[hazard]`, `[acceleration]`, `[unique]`, `[cost]`, `[physics]` to `KNOWN_TEXT_TOKENS` — all
appear as literal bracket tokens in MarvelCDB's `real_text` (never as an HTML `<span class="icon-…">`, confirmed
by scanning every pack's `text`/`real_text` for `icon-`, finding none). `[physics]` (Marvel Boy, `mts` 21041,
"spend a `[physics]` resource") is very likely a MarvelCDB typo for `[physical]` — no `ResourceIconType` named
"physics" exists — but is kept as its own literal token rather than silently rewritten, since nothing here can
cross-check it against a scan. **Needs a second-source check before any curation depends on its meaning.**

### Attachment hosts (`parse-text.ts` `parseAttach`)

Rewrote to use host kinds the schema already had, generalizing wave 1's exact-phrase matching:

- **Case-insensitive phrase matching** for the fixed phrase table (`Attach to the Villain.` with a capital V,
  `trors`, now resolves the same as `the villain`).
- **`"your identity"` without "card"** added alongside the existing `"your identity card"` — this is the
  overwhelmingly more common printed phrasing from wave 2 on (~25 instances across many packs, including `scw`
  and `toafk`), and its absence was the single biggest miss in the old table.
- **A villain's short name** ("Attach to Kang." when the villain's own record is always printed "Kang (The
  Conqueror)"/"Kang (Immortus)"/etc.) resolves to plain `villain` when the pack isn't a multi-villain scenario —
  matching Kang's own family of records by stripping a trailing `" (...)"` parenthetical from each villain name
  and comparing. Not extended to the multi-villain case: `namedVillain` matches by the *current displayed name*
  at runtime (`packages/engine/src/resolve/reveal.ts`), which would never equal a short name for a multi-stage
  villain whose stages are all named differently, and no surveyed pack needs that.
- **Trait-qualified / negated categories**: `an Avenger ally` → `qualified { category: "ally", trait: AVENGER }`;
  `a non-ELITE minion` → `qualified { category: "minion", withoutTrait: ELITE }`; `a Sentinel minion without
  Energy Barrier attached` → adds `withoutAttachmentNamed`. Anchored at the end of the sentence, so a trailing
  behavioral clause ("...and give it a tough status card") correctly fails to match rather than dropping it.
- **Superlative over a named pool**: generalized beyond the two wave 1 special cases (highest-printed-HP minion,
  highest-printed-HP enemy) to any of `minion`/`enemy`/`villain`/`friendlyCharacter` × `highest`/`lowest`/
  `most`/`fewest` × printed/remaining hit points, printed/plain ATK, SCH, each with an optional `withoutTrait` or
  `withoutAttachmentNamed` suffix. A descriptor it doesn't recognize ("highest activation order value", "most
  traits") returns `undefined` rather than guessing at a `HostMeasure` — those stay unresolved (schema need, §3).
- **A bare proper name** ("Attach to Ahab.", "Attach to Vision.") → `namedCard`, which the schema's own doc
  comment already says is generic (any in-play card by exact name, not only environments) — only when the target
  has no leading article and starts with a capital letter, so it can't swallow an unrecognized common-noun phrase
  that needs a real schema shape ("an identity-specific ally you control", "a card with \"Spider\" in its title").
- **`ifAble`** (landed in schema mid-pass, §1.7 of `docs/phase7-wave2.md`): a fallback host spans two sentences —
  `"Attach to X[, if able]."` + `"Otherwise, attach to Y."`/`"If you cannot, attach to Y."` — now resolved to
  `{ kind: "ifAble", preferred, otherwise }`, both sides run back through the same `parseAttach`. Distinguished
  from a *non-host* fallback: `"Otherwise, this card gains surge."` (Genetic Experiments, trors' Defensive
  Programming/Pain Inhibitors/Neurological Implants) is a fallback *effect*, not another host — the continuation
  sentence there doesn't start with "attach to", so the primary sentence resolves normally on its own and the
  continuation falls through to ordinary ability/constant text, rather than the whole pair being misread as a
  schema gap the way an earlier draft of this fix did.
  - **7 cases still don't resolve** (both packs outside cycle 1): `cw`/`synthezoid`'s "Otherwise, attach to the
    enemy leader"/"your leader" (a **`leader` card concept**, no schema shape yet — see §3) and `next_evol`'s
    "Attach to Greycrow or Harpoon." (an **OR of two named targets**, no schema shape). Reported as `ifAble
    attach host: one side didn't parse`, not silently dropped.

### Player-card wiring (`single-cards.ts`, `player-cards.ts`)

- **`flipSide`** (landed in schema mid-pass, §1.5): `readFlipSide`'s detection already existed for encounter
  cards; it is now also passed through to `normalizePlayerCard` and included in every player card type's
  `record(...)` call, so a double-sided player card's back face (`04159b`–`04162b`, the Hydra Campaign "Improved"
  upgrades) is folded in instead of failing coverage.
- **`specificTo` / the `"none"` aspect / `campaignSpecific`** (landed in schema mid-pass, §1.4): a player card
  whose `faction_code` is `"encounter"` (a scenario prop — Taskmaster's four Captive allies) or `"campaign"` (the
  Hydra Campaign upgrades, and other packs' campaign-faction cards, e.g. `gmw`'s `the_market` set) now gets
  `aspect: "none"`/`"basic"` and `specificTo`, instead of `unknown faction`. `normalizeEncounterSets` was widened
  to also register a campaign-faction set (`hydra_camp`, `the_market`, ...) as a `campaignSpecific: true`
  `EncounterSet`, even though its records aren't dispatched through the encounter-card path.
  - **`deck_limit` exemption widened.** A scenario- or campaign-specific card is exempt from the "must have a
    positive `deck_limit`" check (not just scenario props, as an earlier draft of this fix had it) — some
    products' campaign cards genuinely print no `deck_limit` at all (`gmw`'s `the_market`), while others do
    (`trors`' Hydra Campaign upgrades print 1, and that real value is still read, not discarded). `validateDeck`
    gates these on `specificTo`'s classification per `docs/phase7-wave2.md` §1.4, not on this count.
- **A campaign-specific *obligation*** (`04163`–`04166`, story obligations with no hero kit): `normalizeEncounterCard`'s
  blanket "must be faction `encounter`" check now has a named exception for `type_code: "obligation", faction_code:
  "campaign"`, and such an obligation gets `encounterSetIds` pointed at its own (`campaignSpecific`) set instead
  of the usual `[]` a per-hero obligation gets.
- **`printedAspect`** (landed in schema mid-pass, §1.2): a card whose `card_set_code` matches a real hero
  identity's set *and* whose `faction_code` is a real aspect (not "hero") — Spider-Woman's Venom Blast, Pheromones,
  Contaminant Immunity, Inconspicuous — now gets `aspect: hero:<identity>` plus `printedAspect: <faction>` instead
  of becoming a plain, unowned aspect card (which would have failed her deck's `identity_set_mismatch`).
- **`specialCost`** (landed in schema mid-pass, §1.3): `cost: -1` → `specialCost: "X"` is read automatically, with
  no curation (MarvelCDB's encoding is unambiguous). `specialCost: "dash"` is curation-only, via a new
  `Correction.specialCost` field (`curation/types.ts`) — a "printed dash" is not distinguishable from a data error
  without looking at the card, so it is never guessed.

### Three-sided identities (`heroes.ts`)

**Rewritten** to fold a three-sided identity's extra inside face (Ant-Man's Giant, Wasp's Giant — MarvelCDB
publishes it as its own unlinked `hero`-type record in the same `card_set_code`) into `HeroIdentityCard
.additionalHeroForms` (landed in schema mid-pass, §1.1), instead of erroring `hero without a linked alter-ego`.
Grouped by `card_set_code`: every extra face in a set is claimed by whichever record in that set has the real
linked alter-ego; an extra face in a set with no such primary is still reported as a genuine anomaly. This is
fully generic — not hardcoded to Ant-Man/Wasp — and incidentally also fixed **Angel** (the same foldable design,
confirmed by Hall of Heroes' own note that Angel/Archangel reuses Ant-Man/Wasp's card design), which the original
wave 1 survey had separately worried about. **`spdr` (SP//dr) still has one unresolved `hero without a linked
alter-ego`** — its structure is different (no unlinked sibling `hero` record at all; the anomaly is in the
primary record's own link), so it needs its own investigation, not this fix. Not in cycle 1 scope.

### `IgnoredRecord`: a curated "this is not a printed card" escape hatch (`curation/types.ts`, `context.ts`, `checks.ts`)

A new `PackCuration.ignoredRecords` field, parallel to `Correction`/`Errata` (same evidence discipline), for a
MarvelCDB record that is a spurious duplicate in the raw feed rather than a printed card at all — distinct from a
structural MarvelCDB *aggregate* (`flatten.ts`'s `isAggregate`). Used once so far: `trors`' `10098`, a second
"Shang-Chi" under a code in the Hulk pack's range, duplicating the real Captive ally `04098` (`docs/phase7-wave2.md`
§4.5/§5.2 already diagnosed this and said to drop it). `checkCoverage` exempts an ignored record's code from the
"every record became a card" requirement, the same way an aggregate's is exempted.

### Cross-pack reprint art (`core-raw.ts`)

Generalized from "Core is the only possible first printing" (wave 1's rule) to scanning **every** raw pack cache
at import time (`readdirSync` over `raw/marvelcdb/`), in a fixed priority order (Core, then the 8 wave 1 packs in
release order, then every other cached pack alphabetically) — a name+type pair is recorded from the *first* pack
that supplies real art, never overwritten by a later one. This is what let `trors`' Avengers Tower (`04021`,
`duplicate_of_code: "03024"`, first printed in `cap`) resolve, and fixed the same shape for `wsp` (`13025`) and
`scw` (`15018`). The priority list only matters if two genuinely different printings both carry their own art
under the same name+type — not observed in any pack checked, but worth widening `PRIORITY_ORDER` if a future
cycle hits it.

### `duplicate_of_code` → `CardProvenance.duplicateOfCardId`

Added `duplicate_of_code` to `RawCard` (it was present in the raw JSON but not declared, so nothing could read
it) and a new optional `CardProvenance.duplicateOfCardId`, populated from any part's raw record. This is the task
item "MarvelCDB reprint codes (`duplicate_of_code`) mapped so real decklists import cleanly" — scoped to what
ingestion can respons­ibly do on its own: **record** the pointer as data (verified: `trors`' Avengers Tower now
carries `duplicateOfCardId: cardId("03024")` in its provenance). Actually *using* it — treating either code as
the same card for deckbuilding limits when a decklist names one or the other — is Phase 9's (deck import) job;
ingestion still emits the reprint as its own card by its own id, unchanged, matching the wave 1 art policy.

**Boundary note:** this required a small edit to `src/data/types.ts` (`CardProvenance`), a shared file outside
the "new pack folders only" area this pass was scoped to. It's a single additive optional field with no schema
(`src/schema/**`) touch and no behavior change for any existing card — flagged here rather than silently done,
per the instructions, since it's the one deviation from the stated boundary in this pass.

---

## 2. Cycle 1 pack status

| Pack | Status | Notes |
|---|---|---|
| `scw` (Scarlet Witch) | **Emitted.** Curated, 0 hand corrections needed — MarvelCDB's data was already right. | Curation: `curation/scw.ts`. |
| `ant` (Ant-Man) | **Emitted.** 0 hand corrections, once §1.1's `additionalHeroForms` folding landed. | Curation: `curation/ant.ts`. |
| `wsp` (Wasp) | **Emitted.** 0 hand corrections. | Curation: `curation/wsp.ts`. |
| `trors` (The Rise of Red Skull) | **Emitted.** 7 hand corrections/errata + 1 `ignoredRecords` entry (see below). | Curation: `curation/trors.ts`. |
| `qsv` (Quicksilver) | **Not emitted.** Blocked by exactly one issue: `14001b` (Pietro Maximoff's alter-ego face) has no `imagesrc` at all in MarvelCDB's data — not a reprint the art-reuse rule can resolve, a genuinely missing upstream reference. | Needs a second source (a scan, or MarvelCDB backfilling it) before it can pass the coverage check honestly. Everything else about the pack normalizes cleanly. |
| `toafk` (The Once and Future Kang) | **Not emitted.** Schema now supports Kang's shape (§1.6/§1.8 of `docs/phase7-wave2.md`: alternative stage 3s, `dashedValues`, `setAsideVillainCardIds`, `expertVillains`, `victory`), but modeling it correctly — one `VillainCard` per Kang record, four alternative stage 3 main scheme stages, the aggregate-mismatch and card-image checks `docs/phase7-wave2.md` §5.2 already flags — is real per-card curation work this pass didn't have time to do carefully. Left for a follow-up rather than rushed. | 9 remaining issues, all in categories already known to be schema-supported-but-curation-needed (see §4). |

For `trors`, applied with citations (see `curation/trors.ts`):
- **Errata** (RRG 1.8 p. 66, MarvelCDB's cached text is still pre-errata): Marked for Death (`04028`, "tucks" not
  "places", "the tucked Mockingbird" not "Mockingbird"); The Rise of Red Skull 1A (`04128a`, "encounter side
  scheme" not "side scheme"); Bitter Rival (`04136`, the updated "For Each" phrasing).
- **Transcription-typo corrections** (MarvelCDB's own text, not FFG errata): Crossbones' Machine Gun (`04059`,
  missing apostrophe — uncorrected, a named search finds nothing); Weapon Master (`04150`, "When Reveled" twice
  for "When Revealed" — uncorrected, the trigger header regex doesn't match and both abilities parse as plain
  text).
- **`specialCost: "dash"`** on the four Hydra Campaign "Basic" Condition upgrades (`04159a`–`04162a`) — **flagged
  as unconfirmed against a card scan** in the correction's own `evidence` field, per `docs/phase7-wave2.md` §1.3's
  own note that this needs a card-image check. High confidence (matches the RRG's dash definition exactly: no
  Action/Response to play them, only Setup), but not independently verified.
- **`ignoredRecords`**: `10098`, per `docs/phase7-wave2.md` §4.5/§5.2's own finding that it isn't a printed card.

**Not curated for any of the four emitted packs, left for a follow-up pass:** starter decks (precons). Each
pack's insert links a photographed decklist page from its Hall of Heroes release page, and this pass has no way
to read an image — `docs/phase7-wave2.md` §2.1 records only each hero's aspect (Ant-Man/Hawkeye: Leadership;
Wasp: Aggression; Spider-Woman: Aggression+Justice; Quicksilver: Protection; Scarlet Witch: Justice) from the
rulebook *text*, not the card list. `starterDecks: []` normalizes and emits fine (checked); wave 1's own
provenance discipline (a photo cross-checked against a MarvelCDB decklist, `curation/thor.ts` and its siblings)
should be followed here too, not guessed at. Scenario curation for `trors`' five scenarios is likewise not
started — `docs/phase7-wave2.md` §2.2 has the per-scenario setup notes already researched, ready for whoever picks
this up.

---

## 3. Schema needs, for `game-rules-architect`

Everything below is a real gap `AttachmentHost`/`KeywordInstance` can't express with an existing kind, confirmed
by trying and failing, not guessed:

1. **`Requirement`'s icon field needs to be a count/list, not a single icon.** Real cards print `Requirement
   ([mental][mental])` (two of the same icon) and `Requirement ([energy] [mental] [physical])` (three different
   icons); the current `{ icon: ResourceIconType }` can only ever name one. A shape like `ResourceIconCounts`
   (already exists in `common.ts` for a different purpose, `Partial<Record<ResourceIconType, number>>`) would fit.
   4 cards (`ironheart`, `nova`, `silk`, `sm`), none in cycle 1.
2. **`Discount` needs a target-trait qualifier.** Every printed Discount names a trait or a trait-or-trait
   ("Discount 1 (Martial Artist)", "Discount 1 (Attorney or Police)"); the stub shape has only `value`. 3 cards,
   `fne`, none in cycle 1.
3. **A "leader" card concept.** MarvelCDB's `type_code: "leader"` (Civil War, Synthezoid — team-vs-team
   multiplayer villain-side cards) has no card type. Also blocks `AttachmentHost.ifAble`'s fallback side for
   several cards ("Otherwise, attach to the enemy leader"/"your leader"). 37 "unhandled type" instances include
   this plus the two below; `leader` specifically is in `cw`/`synthezoid`.
4. **Agents of S.H.I.E.L.D.'s `evidence_means`/`evidence_motive`/`evidence_opportunity` card types.** No shape at
   all yet — an investigation-board mechanic unique to that pack (`executive_board_evidence` set). Not
   investigated further this pass (not cycle 1).
5. **A "non-X" qualifier keyed on a keyword, not a `Trait`.** "Attach to a non-permanent side scheme." (angel,
   x23) means "not marked with the Permanent keyword", which `HostQualifiers.withoutTrait: Trait` can't express
   (Permanent isn't a trait). Only 2 cards found, but it's the cleanest remaining example of "'a scheme' the
   parser can't read" from the task brief.
6. **An OR of two categories, or two named targets, in one attach rule.** "Attach to an enemy or scheme." (`fne`,
   2 cards); "Attach to Greycrow or Harpoon." (`next_evol`, an `ifAble` fallback side). No existing kind
   expresses "either of these hosts", as distinct from `qualified`'s single trait or `ifAble`'s try-then-fallback.
7. **Superlative measures beyond the five in `HostMeasure`.** "the villain with the highest activation order
   value" (`sm`, ×4, each an `ifAble` primary with its own fallback); "the minion with the most traits"
   (`ironheart`). Neither `printedHp`/`remainingHp`/`printedAtk`/`atk`/`sch` fits.
8. **A villain-negation host: "the villain who is not the active villain."** (`mts`, multi-villain scenario). No
   existing kind expresses "every villain except the active one" as a host.
9. **A double-sided villain with a third linked face.** `aoa`'s `45184c`/`45185c`/`45186c` are villain-type
   records MarvelCDB nests as a third linked face where `villains.ts` currently expects exactly two (front + back
   `linked_card`). This is very likely a normalizer-only gap the same shape as the three-sided-identity fix in
   this pass (§1) rather than a genuinely new schema shape — flagged here because it wasn't investigated deeply
   enough this pass to be sure, and because the wording used ("expected a double-sided villain stage linked to
   another villain record") is `villains.ts`'s own, not a generic category yet.
10. **`spdr`'s dangling hero/alter-ego link** doesn't fit the three-sided-identity pattern (no unlinked sibling
    record exists in the set at all) — needs its own look, not filed as a duplicate of item 9.

---

## 4. Gap matrix (all 63 packs, after this pass)

Categories from `scripts/marvelcdb/survey.ts`'s `CATEGORIES`, in the same order the tool prints them, each tagged
**(a)** needs a schema shape (§3 above, or already noted inline) or **(b)** needs per-card hand curation using
shapes that already exist. A few are genuinely mixed and say so.

| Count | Packs | Category | (a)/(b) |
|---|---|---|---|
| 257 | 17: `aoa`, `aos`, `cw`, `fne`, `gmw`, `ironheart`, `jj`, `jubilee`, `luke_cage`, `mojo`, `mts`, `mut_gen`, `next_evol`, `sm`, `storm`, `synthezoid`, `x23` | no artwork reference for a printed face | **(b)** — the vast majority are non-reprint MarvelCDB gaps (no `imagesrc` at all, like `qsv`'s), needing a second source per card. A reprint of a Core/wave-1 card is already covered by §1's cross-pack art fix; every remaining case checked was a genuine first printing with no image. |
| 125 | 17: `aoa`, `aos`, `cw`, `deadpool`, `hercules`, `ironheart`, `jubilee`, `mojo`, `mts`, `mut_gen`, and 7 more | MarvelCDB record never turned into a card | **mixed** — sampled `aoa`'s: some are §3 item 9's third villain face (schema-adjacent, maybe normalizer-only); some are genuine MarvelCDB data oddities like `trors`' dropped `10098` (curation, via `ignoredRecords`); not exhaustively triaged per pack. |
| 86 | 22 packs | attach rule shape not recognized by the parser | **mixed** — after this pass's generalization, what's left is dominated by §3 items 3/5/6/7/8 (schema needs) plus genuine per-card phrasing this pass's regexes don't cover; not every remaining instance was individually triaged. |
| 83 | 12: `aoa`, `aos`, `cw`, `hercules`, `jj`, `mts`, `mut_gen`, `next_evol`, `sm`, `spdr`, and 2 more | uncategorized | **needs individual triage** — this is the bucket most likely to contain a shape nobody has named yet (survey.ts's own framing). Not resolved this pass. |
| 42 | 19 packs | resource/event/support/upgrade cost shape | **(b)**, mostly — likely the same `specialCost`/`specificTo` classification this pass applied to `trors`, not yet applied to these packs' own campaign/scenario cards. |
| 42 | 8: `bp`, `cw`, `falcon`, `fne`, `hercules`, `magneto`, `synthezoid`, `x23` | deck_limit missing/invalid | **(b)**, mostly — likely more `specificTo`-eligible cards (§1's deck_limit exemption already fixed `gmw`/`mts`/`aoa`/`hercules`'s cases that were the campaign-card pattern; these 8 packs' remaining instances weren't individually checked). |
| 37 | 5: `aoa`, `aos`, `cw`, `spdr`, `synthezoid` | unhandled MarvelCDB type_code | **(a)** — §3 items 3, 4, plus `spdr`'s dangling link (item 10) and `aoa`'s third villain face (item 9). |
| 24 | 5: `aos`, `mut_gen`, `next_evol`, `sm`, `toafk` | main scheme missing starting/target/acceleration threat | **(b)**, using the now-landed `dashedValues` shape — needs the card-image confirmation `docs/phase7-wave2.md` §1.6 calls for. |
| 13 | 4: `fne`, `hercules`, `iceman`, `storm` | hero card in a set with no identity | **mixed** — could be the Spider-Woman `printedAspect` pattern (already-existing shape, just not yet applied to these packs), or a `10098`-style spurious record; not individually checked. |
| 12 | 3: `aos`, `gmw`, `mts` | villain stage label is not a roman numeral | **(a)/(b)** — the Kang pattern (one `VillainCard` per record, §1.8 of `docs/phase7-wave2.md`) generalizes to non-roman labels elsewhere; needs per-pack modeling. |
| 10 | 6: `aoa`, `mts`, `mut_gen`, `next_evol`, `sm`, `toafk` | villain set: stage names differ | **(a)/(b)**, same as above — the alternative-stages shape (§1.6) is landed; applying it per pack is curation. |
| 7 | 3: `cw`, `next_evol`, `synthezoid` | ifAble attach host: one side didn't parse | **(a)** — §3 items 3 and 6. |
| 7 | 5: `hood`, `mts`, `mut_gen`, `next_evol`, `toafk` | aggregate record mismatch | **(b)** — inspect before dropping, as Core's swapped A/B needed. |
| 6 | 4: `iceman`, `luke_cage`, `mut_gen`, `next_evol` | ally missing atk/thw | **(b)** — `cardNotes` entries confirming a printed "—". |
| 4 | 4: `ironheart`, `nova`, `silk`, `sm` | Requirement keyword needs more than one resource icon | **(a)** — §3 item 1. |
| 4 | 1: `sm` | main scheme stage not an NA/NB pair | **needs individual triage.** |
| 3 | 1: `fne` | Discount keyword needs a target-trait qualifier | **(a)** — §3 item 2. |
| 2 | 1: `synthezoid` | side scheme without starting threat | **(b)** — `cardNotes`. |
| 1 | `aos` | non-printed field present | **(b)** — `ignoreFields` correction. |
| 1 | `mts` | boost_star flag vs Boost ability text mismatch | **(b)** — curation. |
| 1 | `sm` | minion ATK is X or invalid | **(b)** — `cardNotes`. |
| 1 | `spdr` | hero without a linked alter-ego | **(a)/(b)** — §3 item 10. |

`tt` fails with a crash (1 line), not a reported error list — not investigated this pass; likely a genuine parser
crash (an unmapped token or a malformed record) rather than an aggregated gap.

---

## 5. Handoff

- **For `game-rules-architect`:** §3's ten items, in the order they'd unblock the most packs (`Requirement`/
  `Discount` are cheap and unblock keyword correctness broadly; the `leader` card type and the OR-of-hosts shape
  each unblock a handful of `ifAble` cases; the villain-negation and extra-superlative-measure items are one-off
  but well-evidenced).
- **For whoever picks up `qsv`/`toafk`:** both are one clearly-scoped piece of work away — `qsv` a second art
  source for one card, `toafk` careful curation against the now-landed Kang schema and `docs/phase7-wave2.md`
  §2.3/§5.2's own notes.
- **For precons:** `scw`/`ant`/`wsp`/`trors` all need their starter decks curated from a photo, following wave
  1's provenance discipline (`curation/thor.ts` et al.) — not attempted this pass.
- **For the next schema-neutral pass over the other 56 packs:** the §4 gap matrix and its per-category (a)/(b)
  tags are the starting point; the biggest single opportunity is finishing the triage of "MarvelCDB record never
  turned into a card" (125) and "uncategorized" (83), which together are almost a quarter of what's left and are
  the categories most likely to hide either a quick normalizer fix (like this pass's three-sided-identity fold)
  or a genuinely new shape.
- **Files touched this pass:** `packages/content/scripts/marvelcdb/{parse-text,text,emit,survey,raw-types}.ts`,
  `packages/content/scripts/marvelcdb/normalize/{context,checks,core-raw,heroes,single-cards,player-cards,
  encounter-cards,encounter-sets,prepare}.ts`, `packages/content/scripts/marvelcdb/curation/{types,scw,ant,wsp,
  trors}.ts`, `packages/content/scripts/ingest-marvelcdb.ts`, `packages/content/src/data/types.ts` (the one
  boundary exception, see §1), and the new `packages/content/src/data/{scw,ant,wsp,trors}/` folders. No
  `packages/content/src/schema/**`, `packages/engine/**`, `packages/cards/**` or `packages/client/**` file was
  touched.
