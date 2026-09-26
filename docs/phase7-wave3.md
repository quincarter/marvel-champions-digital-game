# Phase 7 working spec: wave 3 (cycle 2)

This is the shared brief for every agent working Phase 7's third content wave:

- `card-data-pipeline`, `game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer` and `rules-qa-engineer`.
- It turns wave 3's scope into schema decisions (§1), per-pack setup needs (§2), and a prioritized list of engine primitives (§3), each with a status.
- The models are `docs/phase7-wave1.md` and `docs/phase7-wave2.md`, whose §3 primitives are assumed. If you change a decision here, update this file in the same change.

**Wave 3** is cycle 2, The Galaxy's Most Wanted, in release order:

- The Galaxy's Most Wanted (`gmw`): Groot, Rocket Raccoon, and five scenarios (Brotherhood of Badoon, Infiltrate the Museum, Escape the Museum, Nebula, Ronan the Accuser);
- the Star-Lord (`stld`), Gamora (`gam`), Drax (`drax`) and Venom (`vnm`) hero packs;
- `ron`, **which is not a scenario pack.** Its five cards (90001–90005) are one modular encounter set, "Kree Fanatic": a Ronan the Accuser _minion_, a side scheme, an attachment and two treacheries (§2.3).

RRG 1.8 Appendix VI (p. 71) lists The Galaxy's Most Wanted and the four hero packs as wave 3. `stld`, `gam`, `drax`, `vnm` and `ron` are already emitted as data-only packs; `gmw` is not (§1.1).

**Campaign mode is a later, per-box step** (PLAN.md "Campaign mode", C2). Every scenario must play standalone first. The Galaxy's Most Wanted's campaign cards (The Market 16150–16177, the Campaign Challenge and Badoon Headhunter sets 16178–16187) are ingested as data now and scripted with the box's C2 work.

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules Reference; FFG rulings clarify both):

1. **Card text and product rules.** The Galaxy's Most Wanted rulebook (MC16) is in the repo: `docs/campaign-modes/mc16_galaxys_most_wanted_rules_website-compressed.pdf`, with a page-by-page conversion in `docs/campaign-modes/markdown/mc16_galaxys_most_wanted.md`. Cited as "MC16 p. N". The Mad Titan's Shadow rulebook (MC21) is cited for Hela, whose card shape §1.1 must also fit.
   - **Not read:** the Star-Lord, Gamora, Drax and Venom inserts (linked from their Hall of Heroes pages). Read them before scripting those packs; §4 names what each is needed for.
2. **FFG rulings, Dec 17, 2025 to Aug 13, 2026**, in `marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading. Those that bear on cycle 2: Jan 11, 2026 (1) (an amplify icon on a defeated side scheme); Jan 26, 2026 (3) (Rocket Raccoon, Into the Fray: excess damage _dealt_; superseded 2026-09-25 by RRG 1.8 "Overkill", p. 31, see §3.18); Feb 28, 2026 (7) #2 and (8) (Mister Knife; the Collector's discard interrupt catches Infinity Stones); Mar 30, 2026 (1) ("(to a maximum of X)" is local); Jun 2, 2026 (3) (The Galaxy's Most Wanted expert campaign); Aug 3, 2026 (4) #4 (Drax above three vengeance counters).
3. **RRG 1.8 (Jul 2026)**, `mc_rulesreference_v18_compressed.pdf`, cited by printed page. Cycle 2's FAQ entries are on pp. 61–62 and its errata on pp. 66–67. A plain-text conversion, `mc_rulesreference_v18_compressed.md`, landed in the repo root during this pass (main PR #31) — used for `grep`/`Read` instead of extracting PDF text by hand, but it carries no page markers, so every citation here is still checked against the PDF's own printed page numbers (a page-image or `pypdf`/PyMuPDF text check, not the markdown). The appendix pages (52–56: card anatomy, encounter card anatomy, card backs) have figures the markdown conversion loses entirely — read those from the PDF via the `Read` tool's `pages` parameter, not the markdown.

`packages/content/raw/marvelcdb/{gmw,stld,gam,drax,vnm,ron}.json` point to card text and stats. They are not an authority.

---

## 1. Schema decisions (owner: `game-rules-architect`; landed 2026-09-22)

> Status: landed in `packages/content/src/schema/**`, with fixtures in `packages/content/src/schema/wave3.test.ts` (11 tests).
>
> - No emitted card data changed; every Core, wave 1, wave 2 and data-only card still validates.
> - The one removal, `VillainStage.hpNotPrinted`, was used by no emitted card (only its own wave 2 test, now pointing here).

### 1.1 A villain face printed with ∞ hit points: `VillainStage.infiniteHp`

The ask was "`VillainStage.flipSide`, or whatever shape the rules call for". The rules call for **no new flip mechanism** and **a different hit point field**.

**The card shape is the existing `VillainCard.sides`.** The Collector of Escape the Museum (`gmw` 16080, 16081) and Hela (`mts` 21136, 21137) are each one double-sided villain card per mode, exactly the shape Risky Business's Norman Osborn / Green Goblin already uses:

| MarvelCDB code  | `stage`     | Face                         | HP (raw)          | ATK/SCH   | Traits                             |
| --------------- | ----------- | ---------------------------- | ----------------- | --------- | ---------------------------------- |
| 16080a / 16080b | `A1` / `A2` | Collector front / back, std. | 8 per player / 0  | 1/1 / 0/0 | Elder. / Elder. Wounded.           |
| 16081a / 16081b | `B1` / `B2` | the same, expert             | 10 per player / 0 | 2/2 / 2/2 | Elder. / Elder. Wounded.           |
| 21136a / 21136b | `A1` / `A2` | Hela front / back, standard  | 8 per player / 0  | 1/1 / 0/0 | Asgard. Mystic. / Asgard. Wounded. |
| 21137a / 21137b | `B1` / `B2` | the same, expert             | 9 per player / 0  | 2/2 / 1/1 | Asgard. Mystic. / Asgard. Wounded. |

- MC16 p. 12: "**Villain Deck**: Collector (A1). Remove Collector (A1) and add Collector (B1) for expert mode." MC21 p. 20: "**Villain Deck**: Hela (A). Remove Hela (A) and add Hela (B) for expert mode", and "she is represented by a single double-sided villain card. She begins the game on her **Mystic** side."
- So **the letter is the mode and the digit is the face**, as docs/phase7-wave2.md §15.2 already found. Each mode is one single-stage `VillainCard` with `sides: [{ side: "A", stages: [face 1] }, { side: "B", stages: [face 2] }]`, both `stageNumber: 1`, and the scenario names the standard card as `villainCardId` and the expert card in `expertVillains` (the Kang pattern), with `villainStages: { standard: [1, 1], expert: [1, 1] }`. `wave3.test.ts` validates Escape the Museum's `Scenario` this way.
- A second flip mechanism beside `sides` (the proposed `VillainStage.flipSide`) would model the same physical thing twice. It was already rejected once (docs/phase7-wave2.md §11.2) and nothing in cycle 2 changes that.

**The back face prints ∞ hit points, not "no hit points".** MarvelCDB's `health: 0` is its encoding of ∞:

- MC16 p. 12, Escape the Museum, "Infinite Hit Points (New)": "In this scenario, the villain has inifite hit points (∞). A character with infinite hit points cannot be defeated by taking damage. However, damage may still be dealt to that character through attacks and card abilities." MC21 p. 20 prints the same paragraph for Hela.
- RRG 1.8 "Hit Points" (p. 22): "Some characters may have an infinite number of hit points. A character with infinite hit points cannot be defeated by taking damage, as the amount of damage that character takes will never cause its remaining hit points to reach zero."

**New: `VillainStage.infiniteHp?: boolean`,** replacing wave 2's `hpNotPrinted`.

- `hp` holds `{ base: 0, perPlayer: 0 }` on such a face, as `dashedStats` holds 0 for a dashed stat; the validator refuses any other value. Any side may set it: the RRG entry is about characters, not back faces.
- **Why `hpNotPrinted` had to go.** It encoded two readings the rules contradict. It said the face prints no hit points (it prints ∞), and it carried the front's hit point dial across the flip (`hp` had to repeat the front's value). MC21 p. 20 says the opposite of the carry-over: "Flipping Hela from her Mystic side to her Wounded side and vice versa is resolved just like advancing to the next villain stage: her hit points are reset and any status cards attached to Hela remain attached." What the flip does to the dial is now an engine rule (§3.1).
- **The text "Collector cannot be defeated." / "Hela cannot be defeated." is an ability**, scripted as `RuleSpec cannotBeDefeated` (§3.1). It is redundant with ∞ against damage, and exact against anything else that defeats.

**Parser mapping (pipeline; not done).** `stageOrder` (`scripts/marvelcdb/normalize/villains.ts`) reads only a roman numeral or a single letter, so `"A1"`/`"A2"` still fail with "villain stage label is not a roman numeral" (the survey's 4 `gmw` and 4 `mts` lines). When it learns them it must compare the **letters** for the mode and the **digits** for the face; comparing whole labels would misfile the Collector as MaGog's A/B versions (docs/phase7-wave2.md §15.2). Emit `stageLabel: "A1"` / `"A2"` (`"B1"` / `"B2"` for expert), `infiniteHp: true` and `hp: flat(0)` on face 2, face 2's own raw ATK/SCH, and `startingSide` absent (both start on the A face).

> **Status: landed (`card-data-pipeline`, 2026-09-22).** `MODE_LABEL_RE` in `normalize/villains.ts` recognizes a
> `"<letter><digit>"` stage label, compares the letter (mode) to group records and the digit (face) only to tell
> a record's two faces apart, and emits exactly the shape above: `16080a`/`16081a` are now two separate one-stage,
> two-sided `VillainCard`s (standard/expert), `stageLabel` carries the printed label, `infiniteHp: true` is set
> when a mode-labelled record's raw `health` is `0` (the schema's own "MarvelCDB encodes ∞ as `health: 0`"
> reading), and `villainIdBySet` is left unset for the set (two physical cards, no single "the villain") — the
> scenario names each directly via `villainCardCode`/`expertVillains.villainCardCode`. Confirmed against the
> printed card images this pass (§4 Q7): ATK/SCH are explicit "0"/"0" (standard back) and "2"/"2" (expert back),
> not dashed, matching the pipeline's untouched `dashedStats` handling (no change needed there). `mts`'s Hela
> (21136/21137) now clears the same check too, as a structural side effect — confirmed via `survey.ts` — but `mts`
> is not curated/emitted this pass (still blocked on other gaps unrelated to this one). `gmw` emitted: see §5.

### 1.2 Amplify icons: `BaseCard.amplifyIcons` and `CardFlipSide.amplifyIcons`

- RRG 1.8 "Amplify Icon" (p. 7): "When a boost card is turned faceup during an enemy activation, add one additional boost icon to that card for each amplify icon in play", and "Each amplify icon is equivalent to the following constant ability: 'Each boost card gains [boost].'"
- **Why on `BaseCard` and not in `SchemeIcon`.** The icon is printed on many card types and the rule counts it wherever it is in play. MarvelCDB's `scheme_amplify` field is set on side schemes (Vendetta 16054, Spatial Positioning 16069, Philosopher's Stone 16129, Cannonade 16144), an attachment (The Beyonder's Blazer 16124), a minion (`bp` 51034), allies (`deadpool` 44014, 44016), an upgrade (`fne` 60031), a player side scheme (`deadpool` 44024), an environment (`mojo` 39041) and an obligation (`synthezoid` 57072).
- **A double-sided card counts per face.** `CardFlipSide.amplifyIcons` carries the other face's count: There Is No Escape and Kree Supremacy print one only on their expert (B) face (16180b, 16182b).
- A positive whole number when present; absent means none.
- **Data bug to fix (pipeline): the normalizer drops `scheme_amplify` for every pack**, including ones already emitted. `schemeIcons` (`normalize/values.ts`) maps only crisis, acceleration and hazard. 49 printed cards in the pool carry the icon; the already-emitted ones are `bp` 51033, 51034; `cyclops` 33029; `deadpool` 44014, 44016, 44024, 44039; `jubilee` 47032; `magneto` 49029, 49041; `mojo` 39041; `phoenix` 34030; `storm` 36032; `synthezoid` 57026, 57064, 57072; `wonder_man` 58027. Each needs `amplifyIcons` emitted (none is scripted yet, so no behaviour changes today).

> **Status: landed (`card-data-pipeline`, 2026-09-22).** `raw-types.ts` now carries `scheme_amplify`; a new
> `amplifyIconsField(r)` (`normalize/values.ts`) returns the spreadable field, read by `baseFields` (every card
> type) and by the flip-side builder (`single-cards.ts`'s `readFlipSide`, for `CardFlipSide.amplifyIcons`). Every
> already-emitted pack with an amplify card was re-emitted: `bp`, `cyclops`, `deadpool`, `jubilee`, `magneto`,
> `mojo`, `storm`, `wonder_man` (8 of the 10 listed packs — `phoenix` isn't emitted at all, blocked on an
> unrelated gap per `curation/phoenix.ts`; `synthezoid` isn't emitted either, not yet curated). `gmw`'s own 30
> amplify cards land with the pack's first emission (§5), including the two expert-only `CardFlipSide.amplifyIcons`
> cases the schema doc names (There Is No Escape 16180b, Kree Supremacy 16182b). Re-emitting each pack surfaced
> unrelated pre-existing drift in some of them (a general obligation ability-ref-splitting fix that had landed in
> the parser but not been applied since) — kept, since it's a real correctness fix and no `packages/cards` script
> references any of the old ids (checked); every _other_ pack's regeneration (Core, wave 1, wave 2, the rest of
> the data-only pool) was reverted unread/uncommitted, since re-emitting them was diagnostic only and several
> (Green Goblin, notably) are scripted and would have broken on an unrelated ability-ref shape change.

### 1.3 Hinder X and Uses printed with the per player icon

- **`KeywordInstance` `hinder` gains `perPlayer?: number`.** RRG 1.8 "Hinder X" (p. 22): "A card with the hinder X keyword enters play with X threat on it", "in addition to any threat it normally enters play with". X is `value + perPlayer × players` (RRG 1.8 "Per Player Icon", p. 32: it "multiplies that value by the number of players who started the scenario"). `Hinder 2[per_hero].` → `{ value: 0, perPlayer: 2 }`; `Hinder 4.` → `{ value: 4 }`. **88 printed cards** scale it; every one of cycle 2's does (Blockade, Oppressive Armada, Pincer Maneuver, the Galactic Artifacts side schemes, Cannonade, the standard Campaign Challenge faces, Fugitive Recovery, Budding Crime Syndicate).
- **`uses` gains `countPerPlayer?: number`,** entering play with `count + countPerPlayer × players` counters, and `count` may then be 0. `Uses (1 fury counter, plus 1[per_hero] additional fury counters).` (Fanaticism 16110) → `{ count: 1, countPerPlayer: 1 }`; `Uses (2[per_hero] ammo counters).` (Crossbones' Machine Gun 04064) → `{ count: 0, countPerPlayer: 2 }`. Also `sm` 27174a.
- **Data to fix (pipeline).** `parseKeywordSentence` (`parse-text.ts`) matches `Hinder N` only without the icon, so every `Hinder N[per_hero]` sentence became an ability ref instead: `stld` 17025 is emitted with `keywords: []` and `17025.budding-crime-syndicate-constant`. Re-emit it with the keyword and no ref.
- **A live wave 2 bug found on the way: Crossbones' Machine Gun (04064) has no uses keyword.** It is scripted and playable, but its emitted `keywords` is `[]` (the `Uses (2[per_hero] …)` sentence failed to parse the same way), and `04064.crossbones-machine-gun-constant` is `coveredByEngineRule()`. So it enters play with no ammo counters and is never discarded; the printed card is discarded after 2 per player attacks. Fix: the pipeline emits `{ name: "uses", count: 0, countPerPlayer: 2, counterType: "ammo" }` (the engine reads it, §3.3), then `rules-qa-engineer` pins it with a Crossbones scenario test.

> **Status: landed (`card-data-pipeline`, 2026-09-22).** `parseKeyword` (`parse-text.ts`) now matches
> `Hinder N[per_hero]` → `{ name: "hinder", value: 0, perPlayer: N }`, `Uses (N[per_hero] type counters)` →
> `{ count: 0, countPerPlayer: N, counterType }`, and `Uses (N type counter, plus M[per_hero] additional type
counters)` → `{ count: N, countPerPlayer: M, counterType }`, exactly the shapes above. `stld` 17025 (Budding
> Crime Syndicate) re-emitted with the keyword and no `-constant` ref; `trors` 04064 (Crossbones' Machine Gun)
> re-emitted with the keyword, and its now-dead `04064.crossbones-machine-gun-constant` registry entry (an empty
> `coveredByEngineRule()`, referenced by no card) removed from `packages/cards/src/wave2/trors/crossbones.ts` —
> the one `packages/cards` change this pass made, per the brief's "minimal fix" allowance. The general Hinder fix
> would also reach every other already-emitted pack printing `Hinder N[per_hero]` (not just the two named cards)
> if it were regenerated; only `stld`/`trors` (this section's own targets) and §1.2's amplify set (which happen
> to print Hinder too) were actually re-emitted and committed this pass — every other pack was left alone (see
> §1.2's note on reverting unrelated regenerations).

### 1.4 Double-sided side schemes are not representable: emit one card per face

`SideSchemeCard` has no `flipSide` (only `EncounterCardCommon` does). The five Campaign Challenge side schemes print a standard face and an expert face with different threat, keywords and text (16178a/b–16182a/b: "Standard Mode Only." / "Expert Mode Only."), and MC16's campaign setup says "Reveal the Badoon Blitz (178A) side scheme (use the reverse side for expert mode)".

- **Decision: emit each face as its own `SideSchemeCard`** (`16178a`, `16178b`, …). Nothing flips them during a game; the campaign instruction picks the face. This needs no schema change.
- **Consequence, recorded rather than guessed:** as two cards, the engine does not know they are two faces of one card, so RRG 1.8 "Double-Sided Card" (p. 17), "When a double-sided card would enter an out-of-play area other than the victory display or set-aside area, it is removed from the game", does not apply to them. Each has Victory 1, so a defeated one goes to the victory display either way; only a discarded one differs. Revisit if a card ever discards one.

> **Status: landed (`card-data-pipeline`, 2026-09-22).** `normalizeSingleCards` (`single-cards.ts`) now special-
> cases a side scheme linked to a hidden side scheme of the same type: instead of the ordinary flip-side merge
> (which `normalizeEncounterCard`'s `side_scheme` branch silently drops anyway — `SideSchemeCard` destructures
> only specific fields off `encounterCommon`, `flipSide` not among them, so the back face's data would otherwise
> just vanish), both faces are built as independent top-level records and emitted as two `SideSchemeCard`s
> (`16178a`/`16178b`, …, distinct ids, distinct `collectorNumber`s "178A"/"178B"). Confirmed via `pnpm typecheck`
> and the survey that nothing else uses this shape yet (structural detection, no card named in the normalizer).

### 1.5 Gamora's deckbuilding: "up to 6 attack and/or thwart events" (`gam`)

Gamora (18001b), Skilled Tactician: "You may include up to 6 attack and/or thwart events in your deck from aspects other than your chosen aspect."

- `IdentityDeckbuilding.offAspectPackages` could not express it: `OffAspectPackage` is Maria Hill's all-or-nothing "exactly three titles at maximum copies" (FAQ "Maria Hill (#1B)", RRG 1.8 p. 64).
- **New: `IdentityDeckbuilding.offAspectAllowance { cardType, anyTrait, maxCards }`** — any number of titles, at most `maxCards` cards in total, each of `cardType` with at least one of `anyTrait`, from any aspect not chosen. Gamora is `{ cardType: "event", anyTrait: [ATTACK, THWART], maxCards: 6 }`. Validated on the identity (`validateHeroIdentityCard`); **`validateDeck`** counts matching off-aspect cards against it instead of reporting `aspect_restriction`, and reports `deckbuilding_requirement` past the maximum. Tests: `packages/engine/src/off-aspect-allowance.test.ts` (4), `wave3.test.ts` §1.5 (2).
- **Data to emit (pipeline):** 18001a carries no `deckbuilding` today, so a deck relying on the allowance is refused as off-aspect. Emit the field above.

> **Status: landed (`card-data-pipeline`, 2026-09-22).** `curation/gam.ts`'s `identityDeckbuilding["18001a"]` now
> carries `{ offAspectAllowance: { cardType: "event", anyTrait: [ATTACK, THWART], maxCards: 6 } }`; `gam` was
> re-emitted (one field added). `emit.ts`'s `KEY_BRANDS` needed one addition (`anyTrait: "trait"`) so the
> generated file calls `trait("ATTACK")`/`trait("THWART")` like every other trait array, rather than emitting bare
> strings `tsc` then rejects against the branded `Trait` type. Both Groot/Rocket precons (§2.1, below) still pass
> `validateDeck` with no dependency on this field (neither uses off-aspect events), checked directly.

### 1.6 Keywords

Cycle 2 prints Hinder X, Patrol, Stalwart and Victory X for the first time, plus Guard, Incite, Peril, Permanent, Quickstrike, Restricted, Retaliate, Setup, Surge, Team-Up, Toughness, Uses and Villainous. Each already had a `KeywordInstance` shape; §1.3 adds the per player values. The engine now enforces all of them (§3.3–§3.7).

| Keyword         | Printed forms                                                                    | Cards                                                                               |
| --------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Hinder          | `Hinder N[per_hero].` (with its reminder text); `Hinder 4.` on the expert faces  | 16066, 16068, 16112, 16127–16130, 16144, 16178a–16182a, 16187, 17025; 16178b–16182b |
| Victory         | `Victory N.` (0, 1, 2)                                                           | 16127–16130, 16178a/b–16182a/b, 16183                                               |
| Patrol          | `Patrol.` (with reminder text; with Guard on one line on 16136, 20025)           | 16119, 16132, 16136, 16186, 20025                                                   |
| Stalwart        | `Stalwart.` printed once; granted "gains stalwart" on 16064, 16095, 16096, 16109 | 16133                                                                               |
| Villainous      | `Villainous.`                                                                    | 16055, 16075, 16183                                                                 |
| Uses            | `Uses (N charge/energy/mental/physical counters).`; Fanaticism's per player form | 16046, 17031, 18032, 19033, 20015, 20022; 16110                                     |
| Permanent/Setup | `Permanent. Setup.` (Milano); `Setup. Attach to the villain. / Permanent.`       | 16142, 16149                                                                        |
| Team-Up         | `Team-Up (Groot and Rocket Raccoon).`                                            | 16020, 16048                                                                        |
| Peril           | `Peril.`                                                                         | 16145–16147                                                                         |

- "Setup:" as an ability is on every main scheme 1A and on Peter Quill (17001b) and Flash Thompson (20001b). Identity Setup abilities already resolve at RRG 1.8 Appendix II step 16.
- **Not keywords, however they read:** "Unit Cost X." on The Market's cards is campaign data (C2); "Standard Mode Only." / "Expert Mode Only." is text the campaign instruction reads.

### 1.7 Other data notes for the pipeline

- **Badoon Headhunter is modular and campaign-specific at once.** RRG 1.8 FAQ "Modular Encounter Sets" (p. 61) lists it among the eight modular sets; MC16 p. 4 says "Cards #178–187 are campaign-specific encounter cards … and belong to the 'Campaign – Challenge' and 'Badoon Headhunter' modular encounter sets". Mark the set `campaignSpecific` (it is only added by campaign setup) and keep it out of `recommendedModularSetIds`; flagged in §4.
- **Errata to apply** (RRG 1.8 pp. 66–67): Obedience Potion (#123), The Poison (#125), Cosmo (#20: "a player deck or the encounter deck"). The rulebook errata (setup bullet 5 of Infiltrate the Museum; "(Optional)" on Kree Supremacy) are campaign data.
- **Raw-data typos** seen in passing, for curation to check against the card image: 16068's reminder text lacks its opening parenthesis; 16125 reads "the take 1 damage"; 16159 ends "…encounter deck?"; 18027 ends "(except for [[traits]]))".

> **Status (`card-data-pipeline`, 2026-09-22).**
>
> - **Badoon Headhunter: answered, §4 Q3** — modular, not `campaignSpecific`; `EncounterSet.campaignSpecific` correctly stays `false` for it and for Campaign Challenge (neither prints the "Campaign" word RRG 1.8 p. 11 defines), and neither appears in `recommendedModularSetIds` regardless (none of `gmw`'s five 1A texts names them).
> - **Errata: 16123 and 16125 landed**, each as a `curation/gmw.ts` `Errata` entry — raw's current text for both already matches RRG 1.8's "Should read" wording verbatim, so `text.printed` is left equal to `text.current` (the original reminder-only wording isn't reconstructed without a scan) rather than guessed; recorded, not silently applied. **Cosmo (17020, `stld`) needed nothing**: raw's current text already reads "a player deck or the encounter deck", so it's already past the errata with no curation change required — recorded as such rather than assumed.
> - **Typos: all four fixed.** 16068 (missing open paren), 16125 ("the take" → "then take"), 16159 ("deck? Take" → "deck. Take") in `curation/gmw.ts`; 18027 (doubled close paren, "traits))." → "traits).") in `curation/gam.ts`, since it's `gam`'s card, not `gmw`'s. None independently confirmed against a card scan (no PDF/image renderer was available for these; 16068/16125/16159 rest on grammar/consistency with sibling cards, not a viewed image) — flagged in each correction's own evidence field. Q7's images (below) were fetched for a different card (the Collector), not these.

---

## 2. Per-pack setup needs, standalone

RRG 1.8 Appendix II (p. 51) with the wave 1 and wave 2 engine. Step 13, "Campaign Setup", is skipped.

### 2.1 Hero packs

| Pack   | Identity                           | Obligation                       | Nemesis set (nemesis minion in bold)                                                         | Other setup and legality                                                                                             |
| ------ | ---------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `gmw`  | Groot (16001a/b)                   | Wilt (16025)                     | Blazing Inferno, **Furnax** (16027), Fan the Flames ×3                                       | Precon: Protection (MC16 p. 20).                                                                                     |
| `gmw`  | Rocket Raccoon (16029a/b)          | Crisis on Halfworld (16053)      | Vendetta (amplify), **Blackjack O'Hare** (16055), Blackjack's Bazooka, Planetary Invasion ×2 | Precon: Aggression (MC16 p. 20). Charge counters without Uses (MC16 FAQ p. 21: not discarded at 0).                  |
| `stld` | Star-Lord / Peter Quill (17001a/b) | Banishment (17024)               | Budding Crime Syndicate, **Mister Knife** (17026), Spartoi Cunning ×3                        | Peter Quill's Setup: search deck and discard for Element Gun.                                                        |
| `gam`  | Gamora (18001a/b)                  | Unfulfilled Destiny (18024)      | Sibling Rivalry, **Nebula** (18026), In a Bind, Waylay ×2                                    | Skilled Tactician deckbuilding (§1.5; emit it).                                                                      |
| `drax` | Drax (19001a/b)                    | Memories of Another Life (19025) | Cull the Weak, **Yotat the Destroyer** (19027), Challenge Accepted, "I Will Destroy You!" ×2 | none.                                                                                                                |
| `vnm`  | Venom / Flash Thompson (20001a/b)  | Struggle for Control (20023)     | Klyntar Frenzy, **Enraged Symbiote** ×4 (20025)                                              | Flash Thompson's Setup: discard until a Weapon upgrade. One extra restricted card (§3.22). Set-aside Symbiotes (§4). |

- **Same title, different cards.** Nebula the ally (18002, `gam`), Nebula the nemesis minion (18026) and Nebula the villain (16088–16090) are three cards; the nemesis minion prints "When this minion would enter play, discard the Nebula ally from play". Gamora the ally (19020) and Gamora the identity likewise; MC16 FAQ p. 21 confirms "the players as a group are permitted to have only one copy of each unique card (by title) in play" (the Groot ally with the Groot hero). Drax the ally (18019) vs Drax the identity, Star-Lord the ally (20016) vs Star-Lord the identity, Rocket Raccoon and Groot allies vs their identities: all one-per-title.
- **Precons.** Groot and Rocket Raccoon are printed in MC16 p. 20; the other four come from their inserts (not read, §0).

### 2.2 The Galaxy's Most Wanted scenarios

Each villain deck is I–II standard and II–III expert, except Escape the Museum's, which is one card per mode (§1.1). "Contents" and "Setup" are each 1A's printed text.

| Scenario              | Main scheme deck                                                                | Encounter sets (required)                                     | Modular (1)      | 1A Setup                                                                                                                                                                       | Needs (§3)                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Brotherhood of Badoon | Terrestrial Invasion → Protect the Planet (2B loses)                            | Brotherhood of Badoon, Ship Command, Standard                 | Band of Badoon   | "Put the Badoon Ship environment and the Milano support into play."                                                                                                            | §3.2 (after step one), §3.3, §3.5, §3.7, §3.13 (Milano, First Player Action), Special (existing `resolveSpecials`) |
| Infiltrate the Museum | The Grand Collection (single stage; 1B loses at 5+ cards in The Collection)     | Infiltrate the Museum, Galactic Artifacts, Standard           | Menagerie Medley | "Create 'The Collection' game area … Put the top card of each player's deck faceup into The Collection."                                                                       | §3.14 (The Collection), §3.3, §3.4, §3.16 (Starshark)                                                              |
| Escape the Museum     | The Missing Milano → Lost in the Museum → The Great Escape (3B: no threat wins) | Escape the Museum, Galactic Artifacts, Ship Command, Standard | Menagerie Medley | "Put the Library Labyrinth environment into play. Set aside the Ship Command modular encounter set."                                                                           | §1.1, §3.1 (∞ face, "would be defeated … instead"), §3.2 (round ends), §3.13, set-aside sets (§3.26)               |
| Nebula                | The Art of Evasion → Warp Drive Initiated                                       | Nebula, Power Stone, Ship Command, Standard                   | Space Pirates    | "Put the Nebula's Ship environment and the Milano support into play. Attach the Power Stone to Nebula. Discard the top 2[per_hero] cards … attach each Technique … to Nebula." | §3.2 (villain phase begins), §3.8, §3.15 (damage caps), §3.7, §3.19 (Power Stone), §3.13                           |
| Ronan the Accuser     | Interception Imminent → "Take What Is Mine"                                     | Ronan the Accuser, Power Stone, Ship Command, Standard        | Kree Militants   | "Put the Kree Command Ship environment and the Milano support into play. Attach the Universal Weapon to Ronan the Accuser. Attach the Power Stone to the first player."        | §3.19 (Power Stone to a player), §3.13 (First Player Interrupt), §3.5, §3.7, §3.15                                 |

- **Modular sets** (RRG 1.8 FAQ p. 61): "Badoon Headhunter, Band of Badoon, Galactic Artifacts, Kree Militants, Menagerie Medley, Power Stone, Space Pirates, and Ship Command." Each scenario's 1A "Contents" names the rest.
- **Ship Command in Escape the Museum starts set aside** and its Milano enters at 2A; 3A shuffles "the remaining cards from the set-aside Ship Command encounter set into the encounter deck". Setting aside a whole encounter set at setup is a scripted 1A `Setup:` over existing primitives (`moveCards` to `encounterSetAside`), not a scenario field.
- **Setup timing** (ruling, Jun 2, 2026 (3) #2): "Campaign setup finishes before resolving Collector II's When Revealed damage." Standalone play has no campaign setup, so this only matters to C2.
- **The Collection's owner-return** ("discard 1 card from The Collection (to its owner's discard pile)") and its loss condition ("If there are at least 5 cards in The Collection … the players lose the game") are §3.14.

### 2.3 The Kree Fanatic modular set (`ron`)

Five cards: Ronan the Accuser (90001, a minion with Toughness, "Ronan the Accuser cannot be stunned", "Forced Interrupt: When the villain phase begins, Ronan the Accuser engages the hero with the fewest remaining hit points"), Judge, Jury, Executioner (90002), The Accused (90003), Bring the Hammer Down ×2 (90004), You Dare Oppose Me? ×2 (90005).

- **Status: fully scripted (2026-09-23).** The third vocabulary question below needed a new effect, `dealAsEncounterCard` (§3.47).
- **Needs:** §3.7 (`cannotHaveStatus`, landed), §3.2 (villain phase begins, landed), and three vocabulary questions for the scripter, each believed expressible with what exists but not yet proven: "engages the hero with the fewest remaining hit points" (`engage` with a `PlayerRef ownerOf` a `superlative` identity by `remainingHp`), "Ronan the Accuser activates against the player he is engaged with" (§3.27), and "Each time a card belonging to the Kree Fanatic set is discarded this way, deal that card to yourself" (`discardEncounterCards` with a bind, then `moveCards` of the bound cards filtered by `encounterSetOf`).
- The minion shares the title "Ronan the Accuser" with the `gmw` villain. The unique rule keeps them from being in play together.

---

## 3. Engine primitives for cycle 2 (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names below say where each primitive is needed.

**Priority order.** The list is longer than eight sections, so, as the brief asked, the primitives the `gmw` box and `stld` need were implemented first — all of them landed (§3.1–§3.21, §3.25) — and then the `gam` and `vnm` ones that were fully specified (§3.22, §3.24, and §1.5's deckbuilding). The last, §3.23 (Moondragon, `drax`), landed on 2026-09-23 once the user decided its rules question (§4 Q12). Within the order: first the rules the whole cycle leans on (defeat, timing points, keywords), then single-mechanic primitives, then the vocabulary tail. **A pack whose cards need an unbuilt primitive stays data only.**

Every landed section has its own test file under `packages/engine/src/`, driven through real commands and replayed deep-equal where it touches the log. Shared scaffolding for them is `packages/engine/src/testing/wave3.ts`.

### 3.1 A villain's defeat as an interruptible event; `cannotBeDefeated`; ∞ hit points and the flip

> **Status: landed (2026-09-22),** tested in `packages/engine/src/villain-defeat.test.ts` (11 tests: the Collector's
> replaced defeat, MaGog's reset, a listened-to defeat that still applies, Green Goblin's flip unchanged, replay
> deep-equal). Commit `8350ce9`.

**Why it is needed.** Escape the Museum's Collector (16080a/16081a): "Forced Interrupt: When Collector would be defeated, remove 3[per_hero] threat from the main scheme and flip this card instead." The Mad Titan's Shadow's Odin's Torment 1B replaces Hela's defeat the same way, and MaGog (`mojo`) "resets his hit points … instead". The engine's villain defeat (`defeatVillainStage`) ran inline from the defeat sweep with no interrupt window, and there was no villain-level "cannot be defeated" rule (docs/phase7-wave2.md §15.2 named both as blockers).

**What landed:**

- **A villain stage at zero remaining hit points is a `characterDefeated` event when an ability could react to it** (`checkDefeats`, `resolve/defeat.ts`), the same pattern the identity's defeat already used (Captain America's Helmet). With nothing listening it falls inline exactly as before, so no existing log changes. The event frames are pushed after the minions' and allies', so they resolve first, keeping the sweep's villains-first order.
- **`applyDefeat` re-checks the dial**, so a replacement needs no special machinery: "flip this card instead" turns the villain to an ∞ face and "reset his hit points instead" clears the damage, and either makes the defeat not apply. `cancelTriggeringEvent` (the `instead` builder) also works.
- **`RuleSpec cannotBeDefeated { target, while? }`** (RRG 1.8 "'Cannot'", p. 11: absolute). Read by the sweep and by `applyDefeat`, for every character: villains, minions, allies, identities. It stops defeat only; damage is still dealt and taken. Also needed by Citizen V (`aos` 50129: "cannot be defeated unless …", a `while`).
- **A face with `VillainStage.infiniteHp` has infinite maximum hit points** (`characterProfile`, RRG 1.8 "Hit Points", p. 22), so `damage >= maxHp` never holds. Infinity is never stored: only `damage` is, and the profile is recomputed on each read.
- **A flip into or out of an ∞ face sets the dial to the new face's hit points** (`flipVillain`, damage to 0; the log's `villainFlipped` gains `hitPointsReset: true`). RRG 1.8 "Flip" (p. 20) is silent on the dial, and the two products that print ∞ both reset it: MC21 p. 20 ("her hit points are reset", both directions) and the Collector's own text ("flip this card, then set Collector's hit point dial to his printed hit points"). Resetting on the flip makes that second clause a no-op rather than leaving a window between the two effects in which the sweep would see the old damage against the front's hit points. **A flip between two finite faces keeps the damage**, exactly as Risky Business requires.
- `setRemainingHitPoints` leaves a character with ∞ hit points alone: it has no dial to set.

**Behaviour to know:**

- **Villain stage defeats now reach `characterDefeated` listeners.** Before, a villain's stage never produced the trigger event. RRG 1.8 "Defeat" (p. 15) makes a villain stage defeated like any character, so this is the correct reading. No scripted ref listens to one today: the three `when.defeated("host")` scripts attach to minions (Spider-Tracer, Biomechanical Upgrades) or the identity (Captain America's Helmet).
- **The client will see `Infinity`** in `maxHitPoints` / `remainingHitPoints` previews for an ∞ face (`preview.ts`). It survives structured clone; it should render as "∞" (`game-client-engineer`).
- **A villain and the last identity defeated at the same time lose the game (§4 Q1, settled 2026-09-23).** Damage one effect deals to several characters is simultaneous (ruling, June 2, 2026 (2) answer 1, on RRG 1.8 "Damage", p. 14), and a tie between the villain and the heroes is a loss (FFG ruling, May 18, 2023, The Kraken). A multi-target `dealDamage` is one `damageGroup` (every target dealt, then one sweep), and while an identity falls in a sweep, the villain's defeat goes on the stack under the identities' defeats, whether or not anything listens to it. The last elimination ends the game as a loss first; otherwise the villain falls after the eliminations. Tested in `packages/engine/src/simultaneous-damage.test.ts` and pinned in `wave3-q1-simultaneous-defeat.test.ts`.

**What `ability-scripting-engineer` needs:** the Collector front is `forcedInterrupt(when.defeated("self"), removeThreat(3 per player, main scheme), flipCard(self))`; the back is `constant(rule({ kind: "cannotBeDefeated", target: { self: true } }))` plus a forced interrupt on `phaseEnding { phase: "villain" }` (§3.2) that flips it and sets the dial. The `rule` builder passes a `RuleSpec` straight through.

### 3.2 The round structure's timing points: `phaseBeginning`, `phaseEnding`, `villainStepResolved`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/round-timing.test.ts` (5 tests: every listener
> through one round in RRG order, step one's threat seen only after step one, none of them pushed with nothing listening,
> replay deep-equal). Commit `6ebb61f`.

**Why it is needed.** 71 printed cards use these timing points; cycle 2 alone has Museum Ship and Nebula's Ship ("When the villain phase begins"), Blazing Inferno and Sibling Rivalry ("After the villain phase begins"), Terrestrial Invasion 1B, Protect the Planet 2B and Bombardment ("After resolving step one of the villain phase"), Rogue Vessel ("When the villain phase ends"), the Collector's ∞ face and Regroup ("When the round ends"), and the Kree Fanatic's Ronan ("When the villain phase begins"). The engine had only `playerPhaseEnded` / `villainPhaseEnded` announcements (responses only, the second fired after the next round had already begun) and the delayed `atEndOfPhase` / `atEndOfRound`.

**Three new `TriggerEvent`s**, each pushed only when an ability listens (`heard`), so a game without one logs exactly as before:

- **`phaseBeginning { phase: "player" | "villain" }`** — interrupt and response windows. RRG 1.8 "Round Overview" (p. 4), steps 1 and 4. The villain phase's resolves after everything the player phase's end queues and before step one; the player phase's before the first turn's `turnStarted`.
- **`phaseEnding { phase: "player" | "villain" }`** — interrupt and response windows. RRG 1.8 "End of Player Phase" (p. 18) step 5, and "Villain Phase" (p. 47) step 6b: "Resolve any 'when/after the [villain] phase ends' or 'when/after the round ends' effects." **So the villain phase's end is the round's end**: "When the round ends" is `phaseEnding { phase: "villain" }`. It comes after "until the end of the phase/round" lasting effects end (steps 4 and 6a). **Its apply step resolves the "at the end of the phase/round" delayed effects**, which RRG 1.8 "Delayed Effect" (p. 15) places "immediately after their specified timing point … and before responses": so interrupts, then delayed effects, then responses.
- **`villainStepResolved { step: "placeThreat" }`** — response window only. Announced once step one's threat and its own windows have resolved, before step two.

Pattern with `eventIs`: `{ on: "phaseEnding", eventIs: { phase: "villain" } }`.

**Wave 2 bug found on the way (`ability-scripting-engineer`): three `trors` main schemes script "After resolving step one of the villain phase" as `on.threatPlaced(query("mainScheme"))`** — None Shall Pass 1B (`04079b.none-shall-pass-forced-response`), Hunting Down Heroes (`04096b.hunting-down-heroes-forced-response`) and The Mad Doctor 2B (`04113b.the-mad-doctor-forced-response`). That fires on _every_ threat placed on the main scheme (a minion's scheme, Incite, a card's effect), not once per villain phase; None Shall Pass's delay counters and The Mad Doctor's test counters accumulate far too fast. Hunting Down Heroes is worse: its own "Place 1 threat here" option places threat on the main scheme, so the response retriggers itself for as long as that option is chosen. Re-script all three on `villainStepResolved { step: "placeThreat" }` and pin each with a test that places threat outside step one.

**Existing scripts that can move** (not wrong today): Magical Enhancements (`drs` 09010) and the temporary keyword use a scheduled `atEndOfRound` as their "When the round ends"; that is exact for a card that can reach only one round end, but `phaseEnding` is the general form.

### 3.3 Hinder X, and Uses with a per player count

> **Status: landed (2026-09-22),** tested in `packages/engine/src/per-player-keywords.test.ts` (7 tests). Commit
> `b9998d2`.

- **Hinder:** a side scheme enters play with `startingThreat + X` in one placement (`enterPlayOnReveal`, the one path every side scheme enters by, revealed or put into play), with X from `keywordTotal`, which now adds `perPlayer × players` for hinder. RRG 1.8 "Hinder X" (p. 22): "enters play", so a put-into-play scheme gets it too.
- **Uses:** `applyEnterPlayKeywords` places `count + countPerPlayer × players` counters.
- The pipeline changes that make these reach cards are §1.3.

### 3.4 Victory X and the victory display

> **Status: landed (2026-09-22)** for characters, side schemes, attachments and uses, tested in
> `packages/engine/src/victory-keyword.test.ts` (7 tests). Commit `b9998d2`. **Open:** a villain stage with Victory X
> (below).
>
> **Resolved (2026-09-24):** the villain-stage case landed with Loki in wave 4 (docs/phase7-wave4.md §3.7;
> `packages/engine/src/villain-swap.test.ts`, "a villain whose last stage has Victory X goes to the victory display when
> defeated the ordinary way").

RRG 1.8 "Victory X" (p. 46). **`defeatFromPlay`** (`effects.ts`) is the one place a defeated card leaves play:

- a defeated character or side scheme (or player side scheme) with Victory X goes to the victory display instead of its discard pile — `applyDefeat` and the side-scheme defeat (`discardFromPlay { defeated: true }`) both call it;
- a Victory X attachment on a defeated host goes there first ("The card the attachment or upgrade was attached to is discarded as normal");
- a card with uses and Victory X goes there when its last counter is removed.

A card _discarded_ rather than defeated ("discard this side scheme") still goes to its discard pile. When Defeated abilities resolve first, then the card moves (the test pins the order).

**Behaviour to know:** the ruling of Jan 11, 2026 (1), "When Fearless Determination is defeated, it is considered in play until its When Defeated ability resolves", is about the same moment. The engine moves a defeated _minion_ before its When Defeated frames resolve (`applyDefeat`), and a defeated side scheme after. Nothing in cycle 2 depends on the minion order; flagged in §4 Q4.

**Open: a villain stage with Victory X** (Loki I ×5, `mts` 21160–21164; the Brotherhood of Mutants villains, `mut_gen` 32121–32124). A defeated stage is removed from the game (RRG 1.8 "Villain Defeat", p. 47) and the villain is one instance across its stages, so "the stage goes to the victory display" needs the stage card as its own out-of-play record. Not needed before `mts`.
**Resolved (2026-09-24):** landed for `mts` in docs/phase7-wave4.md §3.7 (see the status note above).

### 3.5 Patrol

> **Status: landed (2026-09-22),** tested in `packages/engine/src/patrol.test.ts` (7 tests). Commit `b9998d2`. Target validity (§4 Q5) landed 2026-09-25; the file now has 20 tests.

RRG 1.8 "Patrol" (p. 32): "that player cannot use cards they control to thwart the main scheme". `patrolledBy(state, deps, player)` (`rules.ts`) is the check, read in two places, the same two the crisis icon uses:

- **a basic thwart** against the main scheme is refused (`actions.ts`), per share of a divided thwart (FAQ "Wasp (#1C)", RRG 1.8 p. 61, names patrol beside crisis);
- **a "(thwart)" ability** cannot target the main scheme (§4 Q5, resolved 2026-09-25): the main scheme is not a valid target for it, and the removal is still blocked as it applies (`threatRemovalBlocked`, reason `"patrol"`, logged) if the player becomes patrolled after the target was chosen.

Other threat removal ("remove 2 threat from the main scheme") is not a thwart (RRG 1.8 "Thwart", p. 44) and still works, and so does thwarting a side scheme. Only the engaged player is restricted, their allies included.

**Behaviour to know (target validity, §4 Q5, resolved 2026-09-25):** RRG 1.8 "Target" (pp. 42–43) says "A target that cannot be thwarted is not a valid target for a thwart-labeled ability". So while a player is patrolled, the main scheme is not a valid target for their "(thwart)" abilities. One module judges this, `resolve/target-validity.ts`, and the engine reads it in three places:

- **Choosing.** A `chooseTarget` offers only targets that some later effect in the same program can affect (`slotTargetValid`, read by `requestTargetChoice`). A patrolled player's "(thwart): Remove N threat from a scheme" offers the side schemes but not the main scheme.
- **Initiating.** An ability whose opening `chooseTarget` has candidates, none of them valid, cannot be initiated (RRG 1.8 "Initiating Abilities", p. 24, step 2). The same holds for an ability that names its targets, when every one it names is invalid ("(thwart): Remove 3 threat from the main scheme"; "… from each scheme" with only the main scheme in play). `playCard` and `useAbility` refuse it with `no_valid_target`, `legalActions` does not offer it (it probes those commands), neither do the play-from-hand effects (`playIgnoringCostFault`, `playWithPaymentFault`), and a window does not offer it as an optional interrupt or response. A forced ability still resolves as far as it can.
- **Resolving.** `threatRemovalBlocked` stays as the backstop. A target can become invalid after it is chosen, for example when a patrol minion engages in between (the analogue of ruling Apr 30, 2026 (2), a Guard minion engaging during step-5 cost payment). The removal is then blocked as it applies and logged.

The rules the three places share:

- **Which effects are judged.** A `thwart` passes the same arguments to `threatRemovalBlocked` as the removal it makes (patrol, crisis, `ignoreCrisis`, `ignorePatrol`, `characterIgnores`, `threatCannotBeRemoved`). A non-thwart `removeThreat` is judged on crisis and `threatCannotBeRemoved` only, never patrol. A `dealDamage` is judged on `cannotTakeDamage` (ruling, Apr 30, 2026 (1): a target is invalid only if dealing damage is the only effect).
- **Crisis** works the same way. Under a crisis icon, the main scheme is not a valid target for a single-target threat removal unless the removal has `ignoreCrisis`.
- **Multiple effects.** "If an ability … has multiple effects on its target, the target is valid if at least one of those effects can affect the target." Any other effect that names the chosen slot is assumed able to affect it, so a thwart that also does something else to its target keeps the main scheme as a target. The thwart part is then blocked as it applies.
- **A confused hero** may still use a thwart-labeled ability with no valid target: RRG 1.8 "Confuse, Confused" (p. 13) says "A confused character can attempt to thwart or use a thwart ability even if it has no valid target for a thwart", and the attempt discards the confused card. The same holds for a basic thwart (2026-09-25): `basicThwart` (`actions.ts`) no longer refuses a confused character's basic thwart against the main scheme under patrol or crisis. The attempt exhausts the character, removes its confused status card and removes no threat. An unconfused character is still refused.
- **"Each scheme"** and other multi-target effects still initiate if any target is valid, and skip the invalid ones as they resolve (the "Target" crisis example, p. 43).
- **No candidates at all** (§4 Q19, 2026-09-25). A required choice with nothing to choose blocks a player ability the same way, unless the ability has a part of its own. Judging each candidate reads the effects only while a patrol minion is engaged with the player, a crisis icon is in their game area, or a `threatCannotBeRemoved` or `cannotTakeDamage` rule is active (`targetsCanBeInvalid`).

The client shows reason `"patrol"` as "a rule" until it learns the word (`log-lines.ts` distinguishes only `"crisis"`).

### 3.6 The amplify icon

> **Status: landed (2026-09-22),** tested in `packages/engine/src/amplify.test.ts` (5 tests). Commit `b9998d2`.

`amplifyIconsInPlay` (`modifiers.ts`) sums the icons on every face-up card in play (a flipped card's other face; nothing for a card facedown as something else). A boost card turned faceup during an enemy activation gets that many extra icons, both on the `boostCardFlipped` log and at the count. It is read again at the count, not carried from the flip, because the icon is a constant (RRG 1.8 p. 7) that applies while its card is in play (the ruling of Jan 11, 2026 (1): Fearless Determination's icon "remains in effect when Captain America activates"). A cancelled boost count (Close Call) is 0, icons and all.

**Behaviour to know:** every game area's icons count, since the rule says "in play" and no printed card puts one in a separate game area yet.

### 3.7 A character that cannot have a status sheds it: stalwart, and `cannotHaveStatus`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/stalwart.test.ts` (4 tests). Commit `b9998d2`.

- RRG 1.8 "Stalwart" (p. 40): "If a character gains the stalwart keyword while they have a stunned and/or confused status card, each stunned and/or confused status card is removed from that character." Cycle 2 grants stalwart with attachments (Drang's Spear, Evasive Maneuvering, Unyielding Persistence, Universal Weapon). The engine already refused to _give_ a stalwart character either status (`statusCapacity`); now `checkStateTriggers` trims any status a character holds beyond what it may have, the moment that becomes true (log: `statusRemoved`, reason `"cannotHave"`). It only looks at characters already holding a status.
- **`RuleSpec cannotHaveStatus { target, statuses, while? }`**: "Ronan the Accuser cannot be stunned." (Kree Fanatic 90001). `statusCapacity` reads it for every status, so the same trim applies.

### 3.8 "The first … revealed each round/phase gains surge": `firstRevealGainsSurge`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/first-reveal-surge.test.ts` (7 tests, including the
> Mister Knife FAQ case). Commit `68c0acb`.

Nebula I–III: "The first [Technique] attachment revealed each round gains surge." Mister Knife: "The first treachery the engaged player reveals each villain phase gains surge."

- **`GameState.revealedThisRound`** records every reveal (card, revealer, phase), emptied when the round ends. "The first" counts cards revealed before the rule's card arrived, so it is written whatever is in play. It is absent until a game's first reveal, so a freshly set-up game serializes as before.
- **`RuleSpec firstRevealGainsSurge { cards, each: "round" | "phase", revealer?, while? }`** is read once, as a card is revealed (the reveal's faceup step): only a rule already in play applies. FAQ "Mister Knife (#26)" (RRG 1.8 p. 62): "Mister Knife was not in play when Shadow of the Past was revealed, so his ability does not cause Shadow of the Past to gain surge." `revealer` is resolved with "you" as the rule's speaker, which for an engaged minion is the engaged player. The log gains `surgeGranted`.
- A boost card turned faceup is not revealed and never counts.

### 3.9 Defeat by effect: `EffectSpec defeat`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/defeat-effect.test.ts` (6 tests). Commit `d8706bc`.

Nova Prime (`stld` 17002): "Response: After you play Nova Prime from your hand, defeat a non-[Elite] minion." `EffectSpec defeat { target }` pushes a `characterDefeated` event marked `byEffect`, which `applyDefeat` applies without the dial check. Everything that sees a defeat sees it (interrupts, When Defeated, Victory X, responses), and `cannotBeDefeated` and the permanent keyword still stop it. A villain's stage falls (RRG 1.8 "Villain Defeat", p. 47); an identity's player is eliminated. Characters only.

### 3.10 Counter maximums and three values

> **Status: landed (2026-09-22),** tested in `packages/engine/src/counters-values.test.ts` (5 tests). Commit
> `d8706bc`.

- **`addCounters.upTo`**: "(to a maximum of 10)" places at most as many as bring the card to 10, and none when it already holds that many or more. Ruling, Mar 30, 2026 (1): "'(to a maximum of X)' applies **locally** to that specific ability" — Captain Americat can put an 11th growth counter on Groot or a 4th vengeance counter on Drax, and this removes nothing (Aug 3, 2026 (4) #4: "Drax retains counters above 3"). Groot: Fruition, Root Stomp, Growth Spurt, Fertile Ground, Flora and Fauna; Drax.
- **`addCounters.bind`** reports `<bind>.amount` placed: Drax's "If you cannot, draw 1 card."
- **`ValueSpec min` / `max`**: Star-Lord's Helmet's "(to a maximum of +3 hand size)" is `min(count, 3)`, the cap on its own bonus (same ruling).
- **`ValueSpec dealtEncounterCount { player }`**: "for each facedown encounter card in front of you" (Gutsy Move, Sliding Shot, Jet Boots, Star-Lord's Helmet).

### 3.11 An event that leaves resolution is not discarded; "the first card you have played this round"

> **Status: landed (2026-09-22),** tested in `packages/engine/src/event-destination.test.ts` (4 tests). Commit
> `d8706bc`.

- **The event-discard stage now discards an event only if it is still being resolved.** Before, "return this card to your hand" (Clobber, Impede, `gam`) and "remove this card from the game" (The Market's Grand Strategy, Power Unleashed, Tried and True, Triple Threat, `gmw`) were undone by the discard that followed. RRG 1.8 "Event" (p. 19).
- **`Predicate playedThisRound.cardType` is optional**: absent counts every card type, so "If this is the first card you have played this round" is `{ player: you, atMost: 1 }` while the card resolves (a card counts as played from the moment it is played).

### 3.12 Status-card timing priority: a tough status resolves before "would take damage" interrupts

> **Status: landed (2026-09-22),** tested in `packages/engine/src/status-priority.test.ts` (4 tests).

**Why it is needed.** MC16 FAQ p. 21 (Groot): "If Groot has a tough status card and takes damage, will growth counters be removed from him? A. No. As status card abilities have timing priority over all other conflicting card abilities, the tough status card will prevent the damage before Groot's Flora Colossus ability is able to trigger." Groot's hero ability is a "Forced Interrupt: When Groot would take any amount of damage".

**The rule.** RRG 1.8 Appendix III "Simultaneous Timing Priority": status card forced interrupts come before every other interrupt; RRG 1.8 "Status Cards" (p. 42): "Status card abilities have timing priority over all conflicting triggered abilities"; General FAQ (RRG 1.8 p. 58): "the tough status card must be discarded to prevent all of the damage before any other abilities could trigger", with two exceptions — "A constant effect reduces the damage the hero takes to zero" and "The hero makes a basic defense and their DEF reduces the damage dealt … to zero".

**Before this change** the engine applied tough in `applyDamage`, after the damage event's interrupt window, so any "would take damage" interrupt (Groot's, Booster Boots, Armor Plating, Jet Boots, In Defiance, Deflection, Parry, Crosscounter) resolved first and could keep the tough card. That contradicted the FAQ in every wave, not only this one.

**What landed.** At a `dealDamage` event's interrupt stage, `toughResolvesFirst` asks whether a tough status card is what will stop this damage, in the same order `applyDamage` uses: not when "cannot take damage" applies (a constant, which outranks status cards), not when the attack's damage is already prevented, not for piercing (which discards the card before damage), and not when constant reductions (§3.15) bring the damage to 0 (the FAQ's first exception; a basic defense's DEF, the second, already reduced the amount before the event). When it is, the interrupt window is skipped: tough is a replacement ("remove a tough status card from it instead"), and RRG 1.8 "Would" (p. 48) closes further interrupts to a trigger a replacement changed. The log gains `interruptsPreempted { reason: "tough" }`, only when some interrupt was waiting, so every other log is unchanged. No existing test depended on the old order.

**Behaviour to know:** a constant reduction that brings the damage to 0 keeps the tough card but does not suppress the "would take damage" window; an interrupt there sees a damage event whose taken amount will be 0.

### 3.13 A card the first player controls, and "First Player" abilities (the Milano)

> **Status: landed (2026-09-22),** tested in `packages/engine/src/first-player-control.test.ts` (4 tests, one replayed
> deep-equal across a first player change).

**Cards.** The Milano (16142, Ship Command; in four of the five scenarios): "Permanent. Setup. / The first player controls the Milano. / Piloting — Resource: Exhaust the Milano → generate a [wild] resource for any player." "First Player Action: Exhaust the Milano → remove 3 threat from this scheme." on Terrestrial Invasion 1B, Protect the Planet 2B, The Great Escape 3B, Interception Imminent 1B, Blockade, Bombardment, Oppressive Armada, Spatial Positioning, Pincer Maneuver, Cannonade, Rogue Vessel, Nebula's Ship. "First Player Interrupt: When a treachery card is revealed from the encounter deck …" (Kree Command Ship). MC16 FAQ p. 21: a player who does not control the Milano may still choose "Exhaust the Milano" when a card offers it (a scripting matter: the option names the card, not "your").

**What landed:**

- **`RuleSpec controlledByFirstPlayer { target, while? }`**, a continuous rule applied between frames (`checkStateTriggers`, beside the ally limit): a matching card in play not under the first player's control moves to their play area and is controlled by them, logged as `controllerChanged { reason: "firstPlayer" }`. So it follows the token when it passes (RRG 1.8 "First Player", p. 19), when a first player is eliminated, and if it entered play under someone else. Moving between play areas is not leaving play, so the permanent keyword does not stop it. The scan is skipped entirely unless some printed constant in the registry declares the rule (a granted one would not be seen; none exists).
- **`firstPlayerOnly`** on `action`, `interrupt` and `response` triggers: only the first player may trigger it (`legal.ts`, `useAbility`), and an optional interrupt or response on an encounter card is offered to the first player rather than to the player the event names (`candidatesFor`). An action still needs the active player (RRG 1.8 "Action", p. 6), so a First Player Action is used on the first player's turn.
- **`resource.forAnyPlayer`**: any player paying a cost may use that resource ability, not only its controller (`resourceAbilityFault` and the payment options). The co-operative decision to spend it is the table's; the engine lets the paying player use it.

### 3.14 The Collection: a scenario out-of-play area, and a discard-from-play redirect

> **Status: landed (2026-09-22),** tested in `packages/engine/src/scenario-area.test.ts` (5 tests).

**Cards.** Infiltrate the Museum: The Grand Collection 1A "Create 'The Collection' game area", 1B's loss at 5 cards and its "discard 1 card from The Collection (to its owner's discard pile)"; Collector I–III: "Forced Interrupt: When a card (player or encounter) would be placed into a discard pile from play, put it faceup into The Collection instead" (III: "then place 1 threat on the main scheme"); Biogram Image, Inconspicuous Box, View the Cosmos, Stay Awhile, Gallery of Splendor. MC16 p. 10: "The Collection is an out-of-play game area shared by all players and specific to this scenario."

**What landed:**

- **`ZoneId { kind: "scenarioArea"; name }`** and **`GameState.scenarioAreas`** (absent until created, so other games serialize as before), located and listed like every other zone; **`EffectSpec createScenarioArea { name }`** creates it empty.
- **`CardDestination { scenarioArea }`** puts cards into it faceup (in play or not); **`CardSelector { kind: "scenarioArea", name, filter? }`** reads it ("discard 1 card from The Collection" is `chooseCards` from it, then `moveCards` to `"discard"`, which is the owner's pile); **`ValueSpec scenarioAreaCount { name, filter? }`** counts it (the 5-card loss is a `stateCheck` on it).
- **`RuleSpec discardFromPlayDestination { cards, area, while? }`**, read in `leavePlay`, the one place a card in play is placed into a discard pile: a matching card goes to the area faceup instead. The discard is still logged as attempted (`cardDiscardedFromPlay`; RRG 1.8 FAQ "Rocket Raccoon (#29A)", p. 61: "Discarding is the act of attempting to place a card into a discard pile … the cost … was still paid"), and a **`discardRedirected { instanceId, area }`** trigger event is announced for Collector III's "then place 1 threat".
- **What it does not catch, as MC16 FAQ p. 21 says:** a card set aside, removed from the game, shuffled into a deck or returned to hand; a card discarded from an out-of-play area (hand, deck, a resolving event, a treachery, a boost card); a defeated Victory X card (the victory display is not a discard pile); a double-sided card (removed from the game instead). Player elimination moves cards with `moveCard` directly, so it is not caught either; no printed interaction needs it.

### 3.15 A damage cap and a damage reduction per attack

> **Status: landed (2026-09-22),** tested in `packages/engine/src/damage-limits.test.ts` (5 tests).

Cutthroat Ambition: "Nebula cannot take more than 5 damage from a single attack." Wide Stance: "Reduce the amount of damage Nebula takes from each attack by 1." Kree Combat Armor: "Reduce the amount of damage attached character takes from each attack by 1." These are constants; the General FAQ (RRG 1.8 p. 58) puts constants ahead of a tough status, so a reduction to 0 keeps the tough card.

- **`RuleSpec reduceDamageTaken { target, amount, fromAttack?, while? }`** and **`RuleSpec maxDamageTakenPerAttack { target, amount, while? }`**, read by `damageTakenAfterConstants` (`rules.ts`) in `applyDamage` after "cannot take damage", a prevented attack and piercing, and before the tough status.
- They limit the damage **taken**. Since 2026-09-25 excess damage and overkill are both measured on the reduced amount (RRG 1.8 "Overkill", p. 31, superseding ruling Jan 26, 2026 (3); §3.18). Before, excess damage was measured on the damage dealt, first. A reduced event logs `damagePrevented { reason: "reduced" }` for the difference.
- **Reductions first, then the lowest cap** (§4 Q9). The cap is per damage event of one attack, which is one event per target for every attack the engine makes.

### 3.16 An attack that deals indirect damage

> **Status: landed (2026-09-22),** tested in `packages/engine/src/indirect-attack.test.ts` (3 tests).

Starshark (Menagerie Medley): "[star] Starshark's attacks deal indirect damage." RRG 1.8 "Indirect Damage" (p. 24) covers it outright: "If an enemy's attack deals indirect damage, the indirect damage is dealt during step four of the enemy activation (after player's have the opportunity to defend against the attack). Only the defending character, or the attacked player's identity if the attack was undefended, is considered to have been attacked, even if other characters were assigned some or all of the indirect damage."

- **`RuleSpec attacksDealIndirectDamage { attacker, while? }`.** At the enemy attack's damage step, a matching attacker's damage (ATK + boost − the basic defense's DEF, as usual) becomes a `dealIndirectDamage` to the attack's target player, who assigns it (the existing assignment prompt); `characterAttacked` still names only the defender or identity and resolves after it, so retaliate and "after X is attacked" behave as printed.
- **`dealIndirectDamage.fromAttack`** (set by the engine) makes the shares attack damage, reported to the attack's own event (`damage`, `damaged`).
- **Not handled:** an attack that deals indirect damage _and_ has piercing or overkill. No cycle 2 card has both.

### 3.17 A lasting "each time …" effect

> **Status: landed (2026-09-22),** tested in `packages/engine/src/each-time.test.ts` (3 tests).

Schadenfreude (Rocket Raccoon): "Hero Action: Until the end of the turn, heal 2 damage from Rocket Raccoon each time you deal any amount of damage to an enemy." It is mandatory for its duration, so it is a delayed effect that repeats, not a response: RRG 1.8 "Delayed Effect" (p. 15), delayed effects "resolve automatically and immediately after their specified timing point … and before responses", and are "not treated as a new triggered ability".

- **`EffectSpec eachTimeUntil { until, on, effects }`** creates a **`LastingEffectBody eachTime`** for `until` (`"endOfTurn"` is not created outside a turn, as `applyRuleUntil`).
- **At each matching event's response step** its effects resolve, pushed above the response window so they come first (`eachTimeEffectsFor`, `resolve/triggers.ts`). The pattern is matched with the lasting effect's card as "self" and its controller as "you", which is what an event card in its discard pile needs.
- **`heard` counts it**, so an event pushed only when something listens (§3.1, §3.2) is pushed for it too.
- It ends with its duration, like every lasting effect.

### 3.18 Increasing an amount of excess damage

> **Status: landed (2026-09-22),** tested in `packages/engine/src/excess-bonus.test.ts` (3 tests).

Follow Through (Aggression): "Hero Interrupt: When your hero's attack deals any amount of excess damage, increase that amount by 1." Ruling, Jan 26, 2026 (3): excess damage is measured as _dealt_.

> **Superseded (2026-09-25, user decision):** RRG 1.8 "Overkill" (p. 31) supersedes it (user decision 2026-09-25; PLAN.md's Overkill note). An ability that counts excess damage dealt counts "the same value of excess damage that is calculated when resolving the overkill keyword": damage _taken_ beyond remaining hit points, after constant reductions, plus this bonus. Into the Fray and "Murdered You!" read that value with or without overkill, so Rocket's 6 into a Marked Nimrod (4 HP, takes 3) now removes no threat and draws nothing, where the Jan 26 ruling said 2 and 1. One helper computes it for a single damage event and a damage group (`resolve/event.ts` `excessDamageOf`); `packages/engine/src/excess-equals-overkill.test.ts` pins FFG's Thumbelina numbers (spill 2, count 2). **E2e seeds:** none plays differently. Every `[e2e]` summary (outcome, round, command count) across `packages/cards` and `packages/engine` is identical to this branch's baseline (17c7cf74): no seeded game has a tough, reduced or prevented hit that carried excess damage into a counting ability.

- **`RuleSpec excessDamageBonus { attacker, amount, while? }`.** When an attack by a matching attacker deals excess damage, each matching rule adds its amount: to the `excessDealt` result ("for each point of excess damage dealt by this attack", Into the Fray; "after you deal excess damage", Rocket Raccoon) and to an overkill spill. `applyDamage` and the damage group (a divided attack) both apply it.
- **A reading, flagged (§4 Q10):** the card is an optional Hero Interrupt, modeled as a constant that always applies. Adding excess damage to the player's own attack never hurts that player in cycle 2 (every reader of hero-dealt excess is the player's own card), so declining it is never the better play; the interrupt window it would open has no other user.

### 3.19 The Power Stone: an attachment that moves between enemies and identities

> **Status: landed (2026-09-22),** tested in `packages/engine/src/power-stone.test.ts` (4 tests).

Power Stone (16149, Power Stone modular set): "Setup. Attach to the villain. / Permanent. / Forced Response: After a hero or villain deals 3 or more damage to attached character with a single attack, attach Power Stone to the attacking hero or villain." Ronan I–III ("if you control the Power Stone"), "Take What Is Mine" 2A/2B, Superior Tactics ("The Power Stone cannot be unattached from Ronan the Accuser"), Single-Minded Fury, Ronan's 1A ("Attach the Power Stone to the first player"). RRG 1.8 FAQ "Power Stone (#149)" (p. 62): damage prevention does not stop the move (it reads damage _dealt_: `eventAtLeast { amount: 3 }` on `dealDamage`), a basic defense's DEF does (it lowers the amount dealt).

- **Moving it** needed nothing: the `attach` effect already moves an in-play attachment to a new host, the villain or an identity (`attach { card: self, to: eventSource }`).
- **`RuleSpec cannotBeUnattached { target, while? }`**: `attach` leaves a matching attachment where it is.
- **Player elimination, RRG 1.8 "Player Elimination" (p. 34) step 3, now implemented** (`eliminatePlayer`): for each card in the eliminated player's play area, and each attachment on their identity, that the player does not own — a permanent attachment resolves its "attach to" text (the first legal host other than that identity; removed from the game with none), any other permanent card is removed from the game, and the rest go to their owners' discard piles. Before, the engine skipped every permanent card and left the identity's attachments where they were. FAQ p. 62: "the Power Stone would be attached to the villain."
- **"You control the Power Stone" is not engine control** (§4 Q11). RRG 1.8 "Ownership and Control" (p. 31): "Encounter cards are considered to be under the control of the scenario." The cards mean "attached to your identity" (MC16 p. 15's campaign victory: "If the Power Stone is attached to an identity"), which scripts as `exists` of the stone with `host: identityOf you`.

### 3.20 Reducing the cost of the card being played, from an interrupt

> **Status: landed (2026-09-22),** tested in `packages/engine/src/play-cost-reduction.test.ts` (4 tests), on the reading in
> §4 Q6.

Star-Lord (17001a), "What could go wrong?": "Interrupt: When you play a card from your hand, deal yourself 1 facedown encounter card → reduce the cost to play that card by 3. (Limit once per round.)" The engine's `cardBeingPlayed` window opens after the cost is paid (RRG 1.8 "Initiating Abilities", p. 24, step 6), so an ability in it cannot reduce anything; the reduction has to apply at step 4 ("Apply any modifiers to the cost(s)").

- **`AbilityDefinition.playCostReduction { amount, cards?, fromHand? }`**, on the ability's printed trigger (an `interrupt` on `cardBeingPlayed`, so the client still labels it "Interrupt"). It is not offered in that window; instead the player names it on the play: **`playCard.costReductionAbilities`**. Each named ability is validated before pricing (`playCostReductionFault`: active, controlled, form, limit, `fromHand`, `cards`, its own cost payable), the card is priced `amount` lower through `pricePlay`'s existing reduction, and after the play commits each ability's cost is paid and its limit counted. The log gains `playCostReduced`.
- **`AbilityCost.dealEncounterCards`**: "Deal yourself 1 facedown encounter card →" as a cost (also Daring Escape, Library Labyrinth, Universal Weapon).
- **Legal moves** list each usable reduction as an extra variant after the unreduced ones, so a card affordable anyway is offered without it, and one affordable only with it is still offered, with the reduction in its example command. Choosing to use it when it is not needed is the client's to offer (`game-client-engineer`).

### 3.21 Naming a card type, and "no consequential damage for this use"

> **Status: landed (2026-09-22),** tested in `packages/engine/src/consequential-cancel.test.ts` (2 tests).

Cosmo (17020, errata RRG 1.8 p. 67): "Interrupt: When Cosmo attacks or thwarts, name a card type, then discard the top card of a player deck or the encounter deck. If that card is of the named type, Cosmo does not take consequential damage for this use." Brainstorm (The Market) names a card type too.

- **Naming a card type needs nothing new:** a `chooseOne` with one option per type, each discarding the card with a `bind` and testing it with `refMatches { ref: slot, query: { categories }, anywhere: true }` (the discarded card is out of play). The test composes it that way.
- **New: `EffectSpec cancelConsequentialDamage { character }`.** Consequential damage is put on the stack with the basic power and resolves after it (RRG 1.8 "Consequential Damage", p. 13), with its amount fixed then, so a later modifier cannot reach it; this cancels the character's waiting consequential damage event (now marked `consequential` on `dealDamage`). An interrupt to the attack or thwart finds it still waiting.

### 3.22 A higher restricted limit

> **Status: landed (2026-09-22),** tested in `packages/engine/src/restricted-limit.test.ts` (4 tests).

Venom / Flash Thompson (20001a/b): "You can control 1 additional upgrade that has the restricted keyword." Side Holster (20021): "You can control 1 additional [Weapon] upgrade that has the restricted keyword." RRG 1.8 "Restricted" (p. 38) fixes the limit at two.

**`RuleSpec restrictedLimit { amount, cards?, player?, while? }`**, summed by `restrictedLimitFor`: each rule for the player (absent `player`: the rule's speaker) adds `amount`; one with `cards` adds room only for as many of the held restricted cards as match it. The play check (`playCard`, and the "play from hand" check) and the discard-down check on entering play both read it.

### 3.23 An enemy attacking another enemy

> **Status: landed (2026-09-23),** on §4 Q12 as the user decided it (an attack, not an activation). Tested in `packages/engine/src/enemy-attacks-enemy.test.ts` (12 tests, synthetic cards); Moondragon (`drax` 19013) is scripted and tested in a real game in `packages/cards/src/wave3/drax/drax-kit.test.ts` (4 tests) and `qa.test.ts` (the Q12 pin, 2 tests).

Moondragon (19013): "Action: Exhaust and discard Moondragon → choose a minion. That minion attacks another enemy of your choice." Enemy attacks target identities and allies only (`enemyAttack` carries an attacked player), so this is its own primitive.

**`EffectSpec enemyAttacksEnemy { attacker, target, bind? }`**, resolved through its own **`TriggerEvent enemyAttacksEnemy`** (an interrupt window before the damage, a response window after). It is never an `enemyAttack`, so nothing keyed on an enemy activation hears it. Its apply step deals the attacker's ATK (modifiers included, plus a `modifyAttack.atkBonus` on this attack) to the target as a `dealDamage` with `fromAttack`, carrying the attacker's attack keywords, and then a `characterAttacked` event with no player. A `enemyAttackedEnemy` log entry records the damage, or why the attack did not happen. `currentActivationFrameId` counts it as "this attack", so `modifyAttack` and the `currentAttack` predicate reach it, but `currentActivationIs` does not, since it is not an activation. **`TargetQuery canAttackOneOf`** is the mirror of `attackableBy`: it keeps only characters that could attack some _other_ card in play that the query matches. DSL: `enemyAttacksEnemy(attacker, target)`, `enemyToAttack(query)` (both choices, then the attack), and `enemyCanAttackAnother(query)` (the action's `while`).

The rules, with the reading for each:

- **No boost card, no activation abilities, no defense** (§4 Q12, the user's decision). Villainous doesn't apply either, and Tiger Shark's "After Tiger Shark attacks" doesn't fire. That follows from the ruling: such abilities answer the minion's attack activation, and this is not one.
- **Attack damage.** The target's tough status card, its damage reductions and its retaliate apply as they would to any attack (RRG 1.8 "Retaliate X", p. 38: "After a character with the retaliate X keyword is attacked, deal X damage to the attacker"). Ranged on the attacker skips retaliate, and piercing discards tough, as usual.
- **Overkill follows RRG 1.8 "Overkill" (p. 31) as written.** "If a minion is defeated by an attack with the overkill keyword, deal any damage on that minion beyond its hit points to the villain." The rule doesn't care who attacks, so a minion with overkill that defeats another minion spills the excess onto the villain. With more than one villain, the one with the active counter takes it (RRG 1.8 FAQ, p. 62). A villain target spills nowhere, because the rule names only an ally or a minion. This is the RRG's own text applied to a case it didn't foresee, and it helps the players, so it is flagged but not left open.
- **Guard doesn't restrict it.** RRG 1.8 "Guard" (p. 21) is "equivalent to the following constant ability: 'The engaged player cannot attack any villain.'" Here the minion attacks, not the player, and `canAttack` already exempts a controllerless attacker from guard. A counter-reading exists: guard's first sentence says the player "cannot use cards they control to attack a villain", and Moondragon is a card they control. The engine follows the equivalent constant, as it already does for every guard check. A `cannotAttack` rule scoped by `attacker` or by target ("cannot be attacked") still applies.
- **Stun.** RRG 1.8 "Stun" (p. 41): "When this character would attack, remove each stunned status card from it instead." This is an attack, so a stunned attacker spends its stun and doesn't attack. Confuse doesn't apply.
- **A "—" ATK** means no attack, the same as the `attack` effect does (RRG 1.8 "Dash (Value)", p. 15).
- **Targeting.** "Choose a minion" requires a valid target (RRG 1.8 "Target", pp. 42–43: "If an ability or game function requires one or more targets, that ability or game function can only be initiated if it has at least one valid target", and a target is valid only "if any part of that ability can affect that target"). A minion with no other enemy it may attack can't be affected by the ability, so it isn't a valid choice. With no minion in play, or only minions that can't attack anything, the action can't be initiated and its cost isn't paid (the `while`). The villain is always another enemy unless a rule says it can't be attacked. Stalwart doesn't change that: it only stops stun and confuse (RRG 1.8 "Stalwart", p. 40). A stunned minion is still a valid choice, because the attempt removes its stun, which affects it. The card has no "then", so RRG 1.8 "'Then'" (p. 44) gates nothing. If the attacker or the target leaves play in the interrupt window, the attack ends with nothing dealt, as an activation does (RRG 1.8 "Activation", p. 6).
- **Flagged, not changed:** a `cannotAttack` rule with neither `player` nor `attacker` ("Players cannot attack other villains", Distracting Taunts, `twc` 07035) also binds an enemy attacker. The data can't tell "players cannot attack X" apart from "X cannot be attacked". This only matters with more than one villain in play and Moondragon on the table.

### 3.24 "If you have played a [trait] event this turn"

> **Status: landed (2026-09-22),** tested in `packages/engine/src/played-this-turn.test.ts` (3 tests), as docs/phase7-wave2.md
> §13.4 specified.

Decisive Blow: "Deal 4 damage to an enemy (7 damage instead if you have played a [Thwart] event this turn)"; Forward Momentum, the same for [Attack] (`gam`). **`GameState.playedThisTurn`** records each player's plays this turn (written when a play commits, so a card counts from the moment it is played; emptied when a turn begins and ends, as `attackedThisTurn` is; absent until a game's first play), and **`Predicate playedThisTurn { player, cards, atLeast? }`** reads it with a `TargetQuery` (so `{ categories: ["event"], trait: THWART }`), wherever those cards are now.

### 3.25 A variable resource cost of any type, with a maximum

> **Status: landed (2026-09-22),** tested in `packages/engine/src/variable-cost.test.ts` (3 tests).

Nebula's Ship (16093): "First Player Action: Exhaust the Milano and spend up to 2 resources of any type → remove 1 evasion counter from here for each resource spent this way." **`AbilityCost.resourcesX`** takes `resource: "any"` (every resource paid beyond the fixed requirement counts) and **`max`** ("up to 2"). Paying more is still legal (RRG 1.8 "Cost", p. 13: overpaying is allowed and the excess is lost), so X is capped rather than the payment refused.

### 3.26 Reusable as is (checked against `pnpm dsl` and the engine)

Each of these looked like a gap in the survey and is not:

| Printed wording                                                                                         | Cards                                                         | Existing vocabulary                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "resolve the Badoon Ship's 'Charge Up' ability" / "resolve the 'Special' ability on each Technique"     | Drang, Badoon Engineer, Nebula I–III, Combat Ready            | `resolveSpecials { cards }` / `{ of }` (RRG 1.8 "Special", p. 40)                                                                                                              |
| "X is equal to the number of evasion counters on Nebula's Ship" (a main scheme's printed X)             | The Art of Evasion, Warp Drive Initiated                      | `MainSchemeStage.printedX` plus a `setBase` stat modifier from the stage's constant                                                                                            |
| "When the last threat is removed from this scheme, advance to stage 2A"                                 | The Missing Milano, Lost in the Museum                        | a forced response to `removeThreat` on self with a `threat` predicate of 0, then `advanceMainScheme { to }`                                                                    |
| "If there is no threat here, the players win the game"                                                  | The Great Escape 3B                                           | `stateCheck` + `endGame`                                                                                                                                                       |
| "Set aside the Ship Command modular encounter set" / "Shuffle the remaining cards from the set-aside …" | Escape the Museum 1A, 3A                                      | `moveCards` to and from `encounterSetAside` with an `encounterSets` filter                                                                                                     |
| "When Nebula initiates an activation against you, give him 1 additional boost card"                     | Nebula I–III, Ronan I–III                                     | an interrupt on `enemyAttack` / `enemyScheme` and `adjustBoostCount`                                                                                                           |
| "Ronan the Accuser activates against the player he is engaged with"                                     | Bring the Hammer Down (`ron`)                                 | `if (form hero) enemyAttack else enemyScheme` against `engagedWith self`                                                                                                       |
| "Enters play with 2 charge counters on it" (no Uses)                                                    | Rocket's upgrades; MC16 FAQ p. 21: not discarded at 0         | a forced response to `cardEntersPlay` self with `addCounters`                                                                                                                  |
| "If you paid for this card using only [mental] resources"                                               | Behind Enemy Lines, Grasping Tendrils, Savage Attack (`vnm`)  | `Predicate paidWithOnly`                                                                                                                                                       |
| "+1 to that power for this use"                                                                         | Venom's Pistol (`vnm`)                                        | docs/phase7-wave2.md §17.4                                                                                                                                                     |
| "Treat Gamora's printed text box as if it were blank (except for traits)"                               | In a Bind (`gam`)                                             | `blankTextBox` (docs/phase7-wave2.md §8)                                                                                                                                       |
| "When this minion would enter play, discard the Nebula ally from play"                                  | Nebula nemesis (`gam`)                                        | an interrupt on `cardEntersPlay` (docs/phase7-wave2.md §3.13.10)                                                                                                               |
| "Players other than Gamora cannot remove threat from Sibling Rivalry"                                   | Sibling Rivalry (`gam`)                                       | `threatCannotBeRemoved` with a `while` on the remover — **unproven**; if `while` cannot see the remover, add a `player` field as `cannotAttack` has (docs/phase7-wave2.md §25) |
| "Discard 1 card at random from your hand. If that card's printed resource has [physical] …"             | Adam Warlock (`stld`)                                         | docs/phase7-wave2.md §3.13.6                                                                                                                                                   |
| "Deal yourself 1 facedown encounter card →" as a cost                                                   | Star-Lord, Daring Escape, Library Labyrinth, Universal Weapon | the effect before the arrow; the ability's cost is otherwise free — **unproven as a cost**; the scripter should confirm the "→" split holds when the effect is a deal          |

### 3.27–3.38 The skipped `gmw` refs (second primitives pass, 2026-09-22)

The scripting pass left ten `gmw` refs in `KNOWN_SKIPPED` as primitive gaps (docs/phase7-wave3-scripting.md §5, §6a and §7). Each was checked against the engine first. Four already composed and needed at most a DSL builder or one timing fix (§3.28–§3.31); the other six needed new vocabulary (§3.32–§3.36). §3.27 is left unused: §2.3 already points at it for the Kree Fanatic's "activates against the player he is engaged with", which §3.26's table covers. §3.37–§3.38 close three more gaps that the Escape the Museum pass found: a loss on completing a stage that is not the last, damage "among players", and a per-player limit.

### 3.28 "After [character] uses a basic power" (Lashing Vines)

> **Status: composes; one engine timing fix landed (2026-09-22),** tested in `packages/engine/src/gmw-compositions.test.ts`.

Lashing Vines (16009): "Hero Response: After Groot uses a basic power, remove 2 growth counters from him and exhaust Lashing Vines → ready Groot."

- **Already there:** `TriggerEvent basicPowerUsed { characterInstanceId, power }` (docs/phase7-wave2.md §3.11) is announced for all four basic powers: a basic attack and thwart once they resolve, a basic defense when the defender is declared (`enemy-activation.ts`), a basic recovery. RRG 1.8 "Basic Power" (p. 10) lists attack, thwart, defense and recovery as basic powers, so a defense counts. The scripter's gap note read `on.defends` and `on.attacks`, but `on.basicPowerUsed` covers all of them with the character as the target.
- **Recovery never reaches Lashing Vines.** It is an alter-ego power, and the card is a Hero Response, so the form gate refuses it. That matches the printed card.
- **Fixed: a defense's "after" window now waits for the attack to end.** RRG 1.8 "Defend, Defense" (p. 16): "Abilities that trigger after a character defends an attack resolve after that attack ends." `defended` already deferred its response window to the activation's end. `basicPowerUsed` with `power: "defense"` opened its window as soon as the defender was declared, before boosts and damage. It now defers the same way (`defersResponsesToActivation`, `resolve/event.ts`). That also corrects Super Speed (`qsv` 14001a) and Captain Marvel ally (04032) on a defense. No existing test changed.

**Composition:** `heroResponse(on.basicPowerUsed(YOUR_IDENTITY), { cost: [removeCounter("growth", 2, { fromIdentity: true }), exhaustThis] }, ready(yourIdentity))`.

### 3.29 "The next superpower card you play this turn" (Deft Focus)

> **Status: composes, no change (2026-09-22),** tested in `packages/engine/src/gmw-compositions.test.ts` (and `turn-duration.test.ts`).

Deft Focus (16024): "Hero Action: Exhaust Deft Focus → reduce the resource cost of the next superpower card you play this turn by 1."

`EffectSpec reduceNextCardCost` already has `duration: "turn"` (docs/phase7-wave2.md §13, written for this card's `magneto` reprint 49023) and a `cardFilter`. `costReductionFor` applies it only while pricing a matching card, and `consumeCostReductions` ends it on the first matching card played. A non-matching card neither uses it nor consumes it. It expires unused when the turn ends. This is a different mechanism from §3.20: Star-Lord's reduction is chosen while the card is being played, while this one is set up earlier by a separate ability.

**Composition:** `heroAction({ cost: exhaustThis }, reduceNextCardCost(you, 1, "turn", { trait: SUPERPOWER }))`. "A superpower card" is any card type with the trait, so the filter has no `categories`.

### 3.30 "Each time you deal any amount of damage to an enemy" (Schadenfreude)

> **Status: composes over §3.17; DSL builders added (2026-09-22),** tested in `packages/engine/src/gmw-compositions.test.ts`.

Schadenfreude (16032): "Hero Action: Until the end of the turn, heal 2 damage from Rocket Raccoon each time you deal any amount of damage to an enemy." §3.17 was built for this card, and its test used this card's shape. The scripter's note ("`applyRuleUntil` only carries a `RuleSpec`") missed `EffectSpec eachTimeUntil` because no DSL builder existed. Two builders now exist:

- **`eachTimeUntil(until, on, ...effects)`** (`dsl/effects.ts`).
- **`on.youDealDamage(to)`** (`dsl/abilities.ts`). It encodes two rules:
  - **Who "you" is.** RRG 1.8 "You, Your" (p. 49; ruling Dec 17, 2025 (3)): "you" is your identity where able. Events you play, resources you spend and upgrades you control are "an extension of a player's identity". Allies and supports are "not considered to be performed by that player's identity". So the source must be one of your identity, event, resource or upgrade cards. An ally's attack and a support's damage do not heal (tested). **Known gap:** an upgrade attached to a _different_ friendly character is not an extension either, and the query still counts it. No printed card needs that case.
  - **"Deal" means damage dealt.** RRG 1.8 "Prevent" (p. 35): prevention reduces what the target takes, "but the amount of damage 'dealt' is not reduced". So the pattern reads the event's own amount (`eventAtLeast: { amount: 1 }`), not the `amount` result (damage taken). A hit fully absorbed by the villain's tough status still heals (tested).

**Composition:** `heroAction(eachTimeUntil("endOfTurn", on.youDealDamage(query("enemy")), heal(2, yourIdentity)))`.

### 3.31 "After you spend this card" (Salvage)

> **Status: composes, no change (2026-09-22),** tested in `packages/engine/src/gmw-compositions.test.ts`.

Salvage (16033): "Response: After you spend this card, put a tech upgrade from your discard pile on top of your deck." The scripter's note said no such `TriggerEvent` existed. `resourcesSpent` has been there since docs/phase7-wave2.md §12, with the DSL `on.youSpendThis()`. The rules questions it raises are already settled:

- **When it fires.** After every cost is paid (step 5 of RRG 1.8 "Initiating Abilities", p. 24) and before the paid-for card starts being played (step 6). RRG 1.8 "Cost Arrow Icon" (p. 14): "Responses to the text preceding the cost arrow icon resolve before the text following the icon resolves". Ruling, Feb 28, 2026 (1): "Any abilities triggered by paying a cost resolve immediately before the effect following the arrow resolves." The test pins this with a draw event: Salvage puts the Tech upgrade on top, then the event paid for with Salvage draws it.
- **Where the spent card is.** Already in its owner's discard pile, since every cost is paid at once (RRG 1.8 "Cost", p. 13). Its ability on this event is still live, because RRG 1.8 "Resource Card" (p. 37) says "Some resource cards have card text that is active while using the card to generate resources". `spentCardCandidates` (`resolve/triggers.ts`) handles that. Salvage is not an upgrade, so it cannot pick itself.

**Composition:** `response(on.youSpendThis(), chooseCards("tech", zone("discard", you, { filter: query("upgrade", { trait: TECH }) }), { min: 1, max: 1 }), moveCards(cards(chosen("tech")), "deckTop"))`. The engine test writes the same thing as plain data.

### 3.32 A cost the player sizes: "Remove up to N counters →" (`spendCounters.upTo`, `bind`)

> **Status: landed (2026-09-22),** tested in `packages/engine/src/variable-counter-cost.test.ts` (4 tests: the chosen count is paid and bound, the default, the refusals, `legalActions`'s range, replay deep-equal).

"We Are Groot" (16006): "Hero Action: Remove up to 4 growth counters from Groot → choose that many friendly characters. Give each of those characters a tough status card." `spendCounters` removed a fixed number, and nothing bound the number removed.

- **`AbilityCost.spendCounters.upTo: true`** makes `amount` the maximum. **`bind`** names the var that receives the number removed; it works on a fixed amount too.
- **The number is the player's decision, made up front** like every cost (RRG 1.8 "Initiating Abilities", p. 24, step 5). It goes in the new optional **`costSelection.counters`** on `playCard` and `useAbility`. With none given, the most that can be removed is used. That is also the only possible choice in a timing window, which asks nothing.
- **0 is not allowed.** RRG 1.8 "Cost" (p. 14): "A cost requiring 'any number' or 'up to' some number of game elements requires a minimum of one such game element." Counters are tokens, which RRG 1.8 "Game Element" (p. 21) lists as game elements, so a Groot with no growth counters cannot play the card, and `costSelection.counters: 0` is refused. The upper bounds are the printed N and the counters the card holds.
- **"Choose that many friendly characters"** with fewer characters than counters chooses them all. RRG 1.8 "Choose (Game Element)" (p. 12): "simultaneously choose as many as are available, to a maximum of the specified number". `chooseTarget` with a `count` already works that way.
- **`legalActions`** reports **`costCounters: { min, max }`** on the action, so the client can ask how many. `selectCost` (`actions.ts`) turns the choice into a fixed cost before it is checked. The plan carries that concrete cost to `payCost`, so what is paid is exactly what was checked.

**DSL:** `removeUpToCounters(counterType, n, { bind, fromIdentity? })` in `dsl/abilities.ts`. The validator knows the bind.

**We Are Groot composition:**

```ts
heroAction(
  { cost: removeUpToCounters("growth", 4, { bind: "removed", fromIdentity: true }) },
  chooseTarget("friends", FRIENDLY_CHARACTER, { count: varOf("removed") }),
  giveTough(chosen("friends")),
);
```

### 3.33 "Discard the top card of your deck →" as a cost (`AbilityCost.discardFromDeck`)

> **Status: landed (2026-09-22),** tested in `packages/engine/src/deck-discard-cost.test.ts` (4 tests: an ordinary payment, a deck the cost empties, a deck already empty with a discard pile, nothing to discard; replay deep-equal).

Booster Boots (16052): "Hero Interrupt: When you would take any amount of damage from an attack, exhaust Booster Boots and discard the top card of your deck → prevent 1 of that damage." The engine could discard deck cards as an effect, but a cost has to be refusable, and an empty deck needs a rule.

**The rules for an empty deck:**

- RRG 1.8 "Player Deck" (p. 33): "If a player deck empties, the player shuffles their discard pile to make a new deck. That player immediately deals themself one facedown encounter card"; "If the player's deck empties while the player was discarding cards from their deck, no further cards are discarded from the newly shuffled deck"; "If a player deck empties and the player has no cards in their discard pile, the deck does not reset until there is at least one card in the player's discard pile".
- Ruling, Apr 30, 2026 (3) answer 7: "The deck is reshuffled **before** the currently resolving card enters the discard pile". The reset happens the moment the deck empties.
- RRG 1.8 "Cost" (p. 13): a cost is paid in full.

**Decision:**

- **Payable iff the deck can supply all N cards.** A deck of fewer cards would stop at the reshuffle (p. 33) and leave the cost unpaid, so the ability cannot be initiated.
- **An empty deck with cards in the discard pile can pay.** Under the ruling the rules have already reset that deck. Since §4 Q15 the engine resets a deck the moment it empties, so this state exists only in a state built before that (a save, a test's surgery); the cost then resets it first, dealing the facedown encounter card, and discards from the new deck.
- **An empty deck and an empty discard pile cannot pay.** There is nothing to discard, and the deck does not reset. Booster Boots is then never offered.
- **A deck the cost empties is reset at once**, before the ability's effects resolve, dealing its encounter card then (answer 7). The test pins the answer's own detail: the event being resolved goes to the discard pile after the reset, so it is not shuffled in.

**DSL:** `discardTopOfDeckCost(n = 1)` in `dsl/abilities.ts`.

**Booster Boots composition:**

```ts
heroInterrupt(
  when.damage(YOUR_IDENTITY, { fromAttack: true }),
  { cost: [exhaustThis, discardTopOfDeckCost()] },
  preventDamage(1),
);
```

"Would take any amount of damage from an attack" is the `dealDamage` interrupt window. §3.12 already makes a tough status card resolve first.

### 3.34 Naming a Team-Up card's characters: `TargetQuery.titled` and `identitySetTitled`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/team-up-names.test.ts` (7 tests: a pair whose names are on both faces, an alter-ego pair, a "Hero/Alter-ego" pair, an ally named by subtitle, deckbuilding, replay deep-equal). DSL tests: `packages/cards/src/dsl/wave3-primitives.test.ts`.

Flora and Fauna (16020, 16048): "Team-Up (Groot and Rocket Raccoon). … Hero Action: Place 2 growth counters on Groot (to a maximum of 10) and ready him, or place 2 charge counters on a Rocket Raccoon upgrade and ready that upgrade." A Team-Up card can be in either player's hand, so "Groot" and "a Rocket Raccoon upgrade" cannot be `yourIdentity` or `identitySetOf: you`. Team-Up is on 30 printed cards across 25 packs, so the vocabulary is general. None of the wave 2 Team-Up scripts (Order and Chaos 14018/15018, Swarm Tactics 12020/13020) names a character in its effect, so there was no earlier shape to extend.

**How the printed cards refer to their two characters:**

- each named identity: "Ready Cyclops and Phoenix";
- each of them, with an amount: "Heal 3 damage each from Gwen Stacy and Miles Morales", "Give Captain America and Winter Soldier each a tough status card";
- one of them: "Place 2 growth counters on Groot";
- cards belonging to one of them: "a Rocket Raccoon upgrade", "a Cyclops card from your discard pile";
- a value summed over both: "the total ATK of Colossus and Wolverine".

The names are hero titles, alter-ego titles ("Cindy Moon and Peter Parker", "Gwen Stacy and Miles Morales"), or "Hero/Alter-ego" when two identities share a hero title ("Black Panther/T'Challa and Black Panther/Shuri").

**The rules:**

- RRG 1.8 "Team-Up" (p. 43) spells the keyword out as a constant: "…a friendly character in play whose title or subtitle matches name 1 and a friendly character in play whose title or subtitle matches name 2."
- RRG 1.8 "Identity" (p. 23): "If a card refers to a hero or alter-ego by title, it refers only to the identity with that title, and not to the other side of the card."
- RRG 1.8 "Identity-Specific Card" (p. 23): a card that belongs to "an identity's set of accompanying cards", marked by its set icon.

**What landed:**

- **`CharacterNames`**: `{ names }` spells the names out. `{ teamUpOf: TargetRef, index?: 0 | 1 }` reads them from the Team-Up keyword on the card(s) the ref names, usually `self`. `index` picks one of the two names. So a script never repeats names its card data already carries.
- **`TargetQuery.titled: CharacterNames`**: the character is named by one of the names. An identity matches by the title on its faceup side only (p. 23). Any other character matches by its title or its subtitle (p. 43; "Subtitle", p. 41). It matches whoever controls the character. The DSL adds `categories: ["identity", "ally"]` for "friendly".
- **`TargetQuery.identitySetTitled: CharacterNames`**: "a <name> card". The card's set icon (`aspect: "hero:<identity id>"`) names an identity card that matches the name by any of its titles, whoever controls the card. That is the principled meaning of "a Rocket Raccoon upgrade": an upgrade from Rocket Raccoon's identity-specific set. It is not "an upgrade Rocket's player controls": Flora and Fauna can be played by Groot's player on an upgrade the other player controls, and the test does exactly that.
- **`titles.ts`**: `characterTitledAs` and `identityCardTitledAs` are the one reading of a name. The Team-Up play check (`teamUpFault`) and the deckbuilding check (`validateDeck`) now use them too.
- **Fixed on the way:** both of those checks compared names to titles as plain strings. That refused Heart of the Panther (`bp` 51025, "Black Panther/T'Challa and Black Panther/Shuri") everywhere, because no single title contains a slash. A "Hero/Alter-ego" name now matches the identity whose hero face is the first half and whose alter-ego face is the second, whichever side is up. This is a reading (§4 Q13).

**DSL** (`dsl/values.ts`):

- `teamUpCharacter(index?)` is the query.
- `teamUpCharacters(index?)` is the same thing as an `each` ref.
- `ofTeamUpSet(index?)` is a query fragment: `query("upgrade", ofTeamUpSet(1))`.
- `titled(...names)` and `ofIdentitySetTitled(...names)` are the written-out forms.

**Flora and Fauna composition** (both 16020 and 16048):

```ts
heroAction(
  chooseOne(
    option(
      "Place 2 growth counters on Groot and ready him",
      addCounters("growth", 2, teamUpCharacters(0), { upTo: 10 }),
      ready(teamUpCharacters(0)),
    ),
    option(
      "Place 2 charge counters on a Rocket Raccoon upgrade and ready it",
      { when: exists(query("upgrade", ofTeamUpSet(1))) },
      chooseTarget("upgrade", query("upgrade", ofTeamUpSet(1))),
      addCounters("charge", 2, chosen("upgrade")),
      ready(chosen("upgrade")),
    ),
  ),
);
```

The option's `when` is RRG 1.8 "Choose (Option)" (p. 12): a player cannot choose an option "that cannot be at least partially resolved".

**Other Team-Up cards** (not scripted this wave; each is checked by `wave3-primitives.test.ts`):

| Card                                | Composition                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beauty and the Thief (37019, 38020) | `heroAction({ label: ["attack", "thwart"] }, attackAnEnemy(4), thwartAScheme(4))`. It names nobody in its effect; the keyword alone gates the play. |
| Fastball Special (35023)            | `attack(sum(statOf(teamUpCharacters(0), "atk"), statOf(teamUpCharacters(1), "atk")), chosen("enemy"), { keywords: ["overkill", "piercing"] })`      |
| Young Love (27019, 27050)           | `alterEgoAction(heal(3, teamUpCharacters()))`. Alter-ego titles match only while that side is up.                                                   |
| Psychic Rapport (33023, 34023)      | `ready(teamUpCharacters())`, then `chooseCards("card", zone("discard", you, { filter: ofTeamUpSet(0) }), …)` for "a Cyclops card"                   |
| Super-Soldiers (54022)              | `giveTough(teamUpCharacters())`                                                                                                                     |

### 3.35 A player superlative: `PlayerRef superlative` and `choosePlayer.among`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/player-superlative.test.ts` (2 tests: the ranking is re-run for each minion, the first player breaks a tie, `ties` and `among` work, replay deep-equal).

Drang III (16060): "When Revealed: Discard the top 4[per_hero] cards of the encounter deck. Each time a minion is discarded this way, put it into play engaged with the player who is engaged with the fewest minions." `TargetRef superlative` ranks cards. Nothing ranked players.

**What landed:**

- **`PlayerRef superlative { order, measure, among?, ties? }`**. Each player in `among` (default: each player) is measured once, as the scoped player (`PlayerRef scoped`, DSL `thatPlayer`). "Engaged with the fewest minions" is `count({ categories: ["minion"], engagedWithPlayer: scoped })`. It is read fresh each time it is resolved. `forEachDiscarded` runs its effects once per discarded card and each run resolves fully before the next starts, so every minion is ranked against the minions already placed.
- **Ties.** A ref is resolved without asking anyone, so ties resolve to every tied player (`ties: "all"`, the default). `ties: "first"` takes the first tied player in player order. Neither is right for Drang III. RRG 1.8 "First Player" (p. 19): "If an encounter card targets a specific player or card, and there are multiple eligible targets, the first player selects among the eligible options."
- **`choosePlayer.among?: PlayerRef`** limits the choice to the tied players. The first player, as `chooser`, gets `firstPlayerTargets` authority on an encounter card. A single eligible player is bound without asking, because there is no choice to make. `choosePlayer` without `among` behaves exactly as before. On a player card the chooser would be `you`, per RRG 1.8 "Choose (Game Element)" (p. 12).
- **"Each time … this way" is resolved after the whole discard.** RRG 1.8 "Each Time" (p. 7) interrupts the resolving ability for each match. `discardEncounterCards` discards every card first and then runs `forEachDiscarded` in discard order, as it already did for wave 1. For Drang III the difference shows only if a minion entering play reads or changes the encounter deck before the next discard. None of the Brotherhood of Badoon minions does.

**DSL:** `superlativePlayer(order, measure, { among?, ties? })` in `dsl/values.ts`, and `choosePlayer(slot, chooser, { among })` in `dsl/effects.ts`.

**Drang III composition:**

```ts
whenRevealed(
  discardEncounterCards(perHero(4), {
    forEachDiscarded: {
      slot: "discarded",
      effects: [
        ifThen(refMatches(chosen("discarded"), query("minion"), { anywhere: true }), [
          choosePlayer("fewest", firstPlayer, {
            among: superlativePlayer("lowest", countOf(query("minion", { engagedWithPlayer: thatPlayer }))),
          }),
          putIntoPlay(chosen("discarded"), chosenPlayer("fewest")),
        ]),
      ],
    },
  }),
);
```

The same shape covers the Kree Fanatic's Ronan (§2.3), "engages the hero with the fewest remaining hit points": `superlativePlayer("lowest", remainingHpOf(identityOf(thatPlayer)))`.

### 3.36 An either/or cost (`AbilityCost.either`) and a limit per player (`AbilityLimit.per: "player"`)

> **Status: landed (2026-09-22),** tested in `packages/engine/src/either-cost.test.ts` (4 tests: each branch paid as named, the default branch and the refusals, `legalActions`'s payable branches, the limit kept per player; replay deep-equal).

The Grand Collection 1B (16073b): "Hero Action: Choose to either exhaust your hero or spend 2 resources of any type → discard 1 card from The Collection (to its owner's discard pile). (Limit once per round per player.)" `cost: [a, b]` is an AND (`mergeCosts`). No cost could be one-of-two. The stage is an encounter card whose action every player may use once per round, and limits were counted per card, not per player.

**What landed:**

- **`AbilityCost.either: AbilityCost[]`.** Exactly one branch is paid, together with the rest of the cost. The branch is the player's choice, sent as the new optional **`costSelection.branch`** (0-based) on `useAbility` and `playCard`. RRG 1.8 "Choose (Option)" (p. 12): a player "cannot choose an option that cannot be at least partially resolved", including one with "a cost the player cannot pay". So a branch that cannot be paid is refused, and an out-of-range index is refused too.
- **With no branch named**, the engine pays the first branch whose non-resource components can be paid now. That keeps old commands valid, and it is the only choice a timing window can make. The decision is recorded as var `cost.branch`.
- **One implementation.** `selectCost` (`actions.ts`) reduces the cost to the chosen branch before `planCost` checks it. The resulting `CostPlan.cost` is what `payCost` pays and what the resource vars read. `planCost` applies it everywhere it is called: trigger candidates, resource abilities and windows included. The ability is therefore offered wherever either branch can be paid.
- **`legalActions` offers one variant per branch.** The action is legal when any branch works, and the new **`LegalAction.costBranches`** lists the payable branches. With an exhausted hero only `[1]` is listed; the client asks, then sends `costSelection.branch`. `paymentFor` takes a `costSelection` in `PaymentContext`, so the payment step prices the branch the player chose.
- **Client impact: none forced.** Every new field (`Command.costSelection`, `LegalAction.costBranches`/`costCounters`, `PaymentContext.costSelection`) is optional, and no client switch is exhaustive over them. Until the client learns the fields, it sends commands without a branch and gets the first payable one. `game-client-engineer` should add the branch prompt.
- **`AbilityLimit.per: "player"`.** The use count is kept per player who uses the ability (`limitKeyOf` appends `#player:<id>`), and it is read wherever limits are read: `useAbility`, resource abilities, trigger candidates, ability frames and cost reductions. RRG 1.8 "Limit" (p. 27) counts "per instance of that ability", and the printed "per player" narrows that further. The same field covers Library Labyrinth's "this way" (16085a), which the Escape the Museum pass skipped for exactly this reason.

**DSL:** `eitherCost(...branches)` and `oncePerRoundPerPlayer` in `dsl/abilities.ts`. The validator refuses a branch that repeats a component of the rest of the cost, and a nested `either`.

**The Grand Collection 1B composition:**

```ts
heroAction(
  { cost: eitherCost(exhaustYourHero, spend(2)), limit: oncePerRoundPerPlayer },
  chooseCards("card", scenarioArea("The Collection"), { min: 1, max: 1 }),
  moveCards(cards(chosen("card")), "discard"),
);
```

`"discard"` sends each card to its owner's pile (§3.14).

### 3.37 "If this stage is completed, the players lose the game." on a stage that is not the last: `MainSchemeStage.completionLoses`

> **Status: engine and schema landed (2026-09-22),** tested in `packages/engine/src/stage-completion-loses.test.ts` (3 tests: completing a marked non-final stage loses where an unmarked one advances; leaving it by an advance does not lose; replay deep-equal). **Data not emitted yet (`card-data-pipeline`, below).**

Found by the Escape the Museum pass. The Missing Milano 1B and Lost in the Museum 2B (16082b, 16083b) print "Forced Interrupt: When the last threat is removed from this scheme, advance to stage 2A/3A (the players win by advancing). If this stage is completed, the players lose the game." Neither stage is the last. RRG 1.8 "Main Scheme, Main Scheme Deck" (p. 27) makes only the final stage's completion a loss ("If the villain completes the final stage of the main scheme deck, the villain wins the game"); completing any other stage advances the deck. So the engine advanced where the card loses. The data gave the whole text box one ability ref, already spent on the advance, so a second trigger could not be added.

**The shape: data on the stage, not an ability.** The sentence is not a triggered ability. It changes what completing this stage does, exactly as being the final stage does, so it belongs next to the stage's other printed facts.

- **`MainSchemeStage.completionLoses?: true`** (content schema, validated).
- `completeMainScheme` (`resolve/defeat.ts`) loses when the stage is final **or** carries the flag, on the same path as before: `endGame("loss", "mainSchemeCompleted")`.
- Leaving the stage any other way is not completing it. RRG 1.8 p. 27: "If the main scheme advances other than through having threat on it equal to or greater than its target threat value, that main scheme is **not** considered completed." So the scripted "advance when the last threat is removed" still advances (tested).
- No ability ref is needed for the sentence, so 16082b's and 16083b's single ref stays the advance response it already is.

**Survey of all raw MarvelCDB main schemes.** 60 B sides print the sentence ("stage" or "scheme"). Eight are **not** the last stage of their scenario:

| Stage                                        | Pack        | Status                                                                                                                                                          |
| -------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Missing Milano 1B (16082b)               | `gmw`       | emitted, scripted; advances today instead of losing                                                                                                             |
| Lost in the Museum 2B (16083b)               | `gmw`       | the same                                                                                                                                                        |
| Kang's Arrival 1B (11007b)                   | `toafk`     | **live wave 2 bug**: emitted and scripted, and completing stage 1 advances to The Master of Time instead of losing (its docblock already noted the missing ref) |
| Infiltrate A.I.M. Island Embassy 1B (50087b) | `aos`       | not emitted                                                                                                                                                     |
| Locate Missing Person 2B (50088b)            | `aos`       | not emitted                                                                                                                                                     |
| Zemo's Manipulations 1B (50167b)             | `aos`       | not emitted                                                                                                                                                     |
| Gotta Get Away 1B (40103b)                   | `next_evol` | not emitted                                                                                                                                                     |
| Uncontrollable Power 1B (40166b)             | `next_evol` | not emitted                                                                                                                                                     |

The other 52 are final stages, where the flag restates the rule. Two sentences are compound: Extract Captives 3B (50089b) and Mutant Massacre 2B (40078b), "If this stage is completed or there are no … in play, the players lose". The flag covers the "completed" half, and the other half is a script's `stateCheck` + `endGame("loss")`.

**What `card-data-pipeline` must emit:** `completionLoses: true` on every main scheme stage whose B-side text contains "If this stage is completed, the players lose the game" or "If this scheme is completed, the players lose the game". That includes the compound sentence, and final stages too, for uniformity. The sentence also needs no ability ref of its own. Re-emit `gmw` (16082b, 16083b) and `toafk` (11007b; also 11013b, final). Every other already-emitted pack with a final stage can follow at its next re-emit. `rules-qa-engineer` should pin Kang's Arrival with a scenario test once `toafk` is re-emitted.

### 3.38 "Assign N indirect damage among players" (Museum Ship) and Library Labyrinth's per-player limit

> **Status: composes; first test of the group form (2026-09-22),** in `packages/engine/src/indirect-among-players.test.ts` (2 tests: the first player chooses the option and divides the damage among both players' characters, each option's amount and Milano cost, replay deep-equal).

**Museum Ship (16085b):** "Forced Interrupt: When the villain phase begins, choose one: • Exhaust the Milano → assign 2[per_hero] indirect damage among players. • Assign 3[per_hero] indirect damage among players." The Escape the Museum pass read "among players" as a shape `dealIndirectDamage` lacked. It is the `to: "group"` form, which had no test until now.

- RRG 1.8 "Indirect Damage" (p. 24): "Indirect damage dealt to a group of players **(or among players)** can be divided as the group chooses among friendly characters in play". That is exactly "group": one pool, divided across every player's identity and allies.
- "As the group chooses" is submitted by the first player (docs/phase7-wave1.md §4.7, the user's decision for the group form). "Choose one" on an encounter card that names no player is also the first player's (RRG 1.8 "First Player", p. 19).
- **"Exhaust the Milano →" inside an option.** On an encounter card, an option "that requires one or more targets" cannot be chosen when it has no valid target (RRG 1.8 "Choose (Option)", p. 12). An exhausted Milano cannot be exhausted, so the option is guarded with `when`. Otherwise the players could take the cheaper option for free.

**Composition** for `16085b.hold-on-to-your-butts` (the two `-constant` refs are the option bullets, so they are `partOf` it):

```ts
forcedInterrupt(
  on.phaseBeginning("villain"),
  chooseOneBy(
    firstPlayer,
    option(
      "Exhaust the Milano → assign 2[per_hero] indirect damage among players",
      { when: exists(query("support", { name: "Milano", exhausted: false })) },
      exhaust(named("Milano")),
      dealIndirectDamage("group", perHero(2)),
    ),
    option("Assign 3[per_hero] indirect damage among players", dealIndirectDamage("group", perHero(3))),
  ),
);
```

**Library Labyrinth (16085a):** "\"This way?\" — Hero Action: Deal yourself 1 facedown encounter card → remove 5 threat from the main scheme. (Limit once per round per player.)" §3.36's `AbilityLimit.per: "player"` covers it: `heroAction({ cost: dealEncounterCardsCost(1), limit: oncePerRoundPerPlayer }, removeThreat(5, theMainScheme))`.

### 3.39–3.45 The last skipped wave 3 refs (third primitives pass, 2026-09-23)

Seven refs stayed in `KNOWN_SKIPPED` as primitive gaps after the `gmw` pass: two in Ronan the Accuser (`gmw`), three in Star-Lord (`stld`, docs/phase7-wave3-scripting.md §6b) and two in Drax (`drax`). Each was checked against the vocabulary first. None composed as is, but two of them (§3.39, §3.40) are small general pieces that compose with each other. Moondragon (`drax` 19013) is not among them: it waited on §4 Q12 and landed as §3.23 (2026-09-23). The DSL compositions are validated in `packages/cards/src/dsl/wave3-primitives-2.test.ts`.

### 3.39 "The player who controls X": `PlayerRef controllerOf`

> **Status: landed (2026-09-23),** tested in `packages/engine/src/controller-of-player-ref.test.ts` (3 tests: the ref names the stone's holder and nobody for a scenario-controlled card; the villain attacks that player in alter-ego form and the card does not surge; with the stone on the villain no attack is made and the card surges; replay deep-equal).

Single-Minded Fury (16114): "When Revealed: Ronan the Accuser attacks the player who controls the Power Stone _(even if that player is in alter-ego form)_. If no attack was made this way, this card gains surge." No `PlayerRef` named a player through a card's controller. `ownerOf` reads ownership, which is a different fact once control changes hands (RRG 1.8 "Ownership and Control", p. 31).

- **`PlayerRef controllerOf { target }`**: the players who control the cards `target` names, in player order. The raw data has two other wordings it covers: "The player who controls that identity" and "a player who controls a [Web-Warrior] character" (the latter with `choosePlayer { among }` to pick one).
- **"Controls the Power Stone"** keeps §4 Q11's reading (§3.19): the stone is attached to that player's identity. That is `controllerOf(each(query("identity", hasAttachment({ name: "Power Stone" }))))`, with §3.40's query field.
- **Attached to no identity.** RRG 1.8 "Ownership and Control" (p. 31): "Encounter cards are considered to be under the control of the scenario." So neither the villain holding the stone nor the stone itself names a player. The ref is empty, `enemyAttack` with an empty `against` makes no attack (it does not fall back to the engaged player), `<bind>.made` stays 0, and the card's own sentence gives the rest: "If no attack was made this way, this card gains surge." The same branch covers a stunned Ronan: RRG 1.8 "Stun, Stunned" (p. 41), "If a stunned villain or minion would attack, discard the stunned status card instead … that character is not considered to have attacked", so no attack was made and the card surges.
- **Alter-ego form** needs nothing: an `enemyAttack` effect attacks the named player whatever their form. The parenthetical only restates that.

**DSL:** `controllerOf(target)` in `dsl/values.ts`.

**Single-Minded Fury composition** (`16114.when-revealed`):

```ts
whenRevealed(
  enemyAttack(theVillain, {
    against: controllerOf(each(query("identity", hasAttachment({ name: "Power Stone" })))),
    bind: "fury",
  }),
  ifThen(not(made("fury")), surge()),
);
```

### 3.40 "A character that has an attachment matching X": `TargetQuery.hasAttachment`

> **Status: landed (2026-09-23),** tested in `packages/engine/src/has-attachment-query.test.ts` (3 tests: `explainQuery` reports `missingAttachment`; an ally with a Weapon upgrade triggers the interrupt, +2 ATK for that attack, the support discarded; an ally whose only attachment is not a Weapon is never offered it; replay deep-equal).

Target Practice (17017): "Interrupt: When an ally with a weapon attachment upgrade makes an attack, discard Target Practice → that ally gets +2 ATK for that attack." `host` asks what a candidate is attached _to_, and `hostOfSelf` whether it is this card's own host. Nothing asked what is attached to a candidate.

- **`TargetQuery.hasAttachment: TargetQuery`**: at least one card attached to the candidate matches the inner query, read in the same context (so `you` and `self` mean the same inside it).
- **It belongs in the trigger, not in the effects.** RRG 1.8 "Initiating Abilities" (p. 24): an ability is initiated when its triggering condition occurs. With the filter on `sourceIs`, the interrupt is never offered for an ally without a weapon, so Target Practice is never discarded for nothing. The `stld` note was right to refuse an `ifThen(exists(…))` guard in the effects.
- New `QueryExclusion` `"missingAttachment"` for `explainQuery`/`why-not.ts`. **Client impact:** one line in `packages/client/src/view/highlights.ts`, whose reason table is exhaustive.

**DSL:** `hasAttachment(q)` in `dsl/values.ts`, a query fragment.

**Target Practice composition** (`17017.target-practice-interrupt`):

```ts
interrupt(
  on.attacks(query("ally", hasAttachment(query("upgrade", { trait: WEAPON })))),
  { cost: discardThis },
  modifyStat("atk", 2, eventSource, "endOfAttack"),
);
```

"An ally" is any player's ally; the printed card does not say "your".

### 3.41 "A total of up to N … (as you choose)": `divide.upTo`

> **Status: landed (2026-09-23), minimum changed the same day by the user's §4 Q16 decision:** "up to N" divides at least 1 point whenever something can be targeted. Tested in `packages/engine/src/divide-up-to.test.ts` (5 tests: 1–5 points offered and exactly the chosen shares removed, replay deep-equal; 0 refused with one scheme or several, and 1 is enough; only schemes it can remove threat from are offered, and with none nothing is asked and nothing happens; a single candidate is still asked; without `upTo` a single candidate still takes the full amount unasked) and in a real game in `packages/cards/src/wave3/stld/star-lord-kit.test.ts` (Agile Flight: 0 refused with one scheme and with two, and no choice when no scheme holds threat).

Agile Flight (17029): "Hero Action (thwart): Remove a total of up to 5 threat from among schemes (as you choose)." `EffectSpec divide` always divided the full amount (`minSelections === maxSelections === amount`), and a single candidate took it all without a choice. That is right for "a total of N" (Wasp Sting, Inconspicuous), not for "up to".

- **`EffectSpec divide.upTo: true`**: `amount` is the most that may be divided. The `divide` choice has `minSelections: 1`, so the chooser may divide fewer points, but not none, and only targets the division can affect are offered. With none, nothing is asked.
- **Why at least one.** Originally none was allowed: RRG 1.8 "Cost" (p. 14) requires "a minimum of one such game element" only of a cost, and ruling, Mar 6, 2026 (2) (Quick Quip) speaks to fewer, not to none. The user decided §4 Q16 on 2026-09-23: an effect's "up to N" chooses at least one when possible, unless a printed "may" makes it optional. `chooseTarget.upTo` and the "up to" `chooseCards` scripts follow the same rule (§4 Q16 lists every card).
- **A single candidate is still asked**, because the amount is now the chooser's. Without `upTo`, the behavior is unchanged.
- Threat that cannot be removed (crisis, patrol, `threatCannotBeRemoved`) is handled by each `removeThreat` event as before; the chooser may still place points there, and they do nothing.

**DSL:** `divide(what, n, among, { upTo: true })` in `dsl/effects.ts`.

**Agile Flight composition** (`17029.agile-flight-action`; its "Play only if your identity has the aerial trait" is already `playRestrictions` data):

```ts
heroAction({ label: "thwart" }, divide("threat", 5, query("scheme"), { upTo: true }));
```

### 3.42 "Play only if …" on any condition: `constant.playOnlyIf`, `ValueSpec victoryDisplayCount`

> **Status: landed (2026-09-23),** tested in `packages/engine/src/play-only-if.test.ts` (4 tests: without an Element Gun the play is refused and `legalActions` does not offer it; another player's gun does not count; with your own gun it is offered and plays; the victory-display condition reads the out-of-play pile).

Sliding Shot (17005): "Play only if you control an Element Gun." A `constant` ability's rules are only read from cards in play, and the event is not in play while it is checked, so a `cannotPlay` rule on the card never applied (the `stld` pass verified this). `PlayRestrictions` data has `requiresIdentityTrait` and `requiresControlledCharacterTrait`, but no named-card case.

**Survey of every "Play only if …" in `packages/content/raw/marvelcdb/*.json` (2026-09-23).** Most are the identity-trait form `playRestrictions.requiresIdentityTrait` already carries ("your identity has the [X] trait", "you have the [X] trait", "you are in [Giant] hero form"), and "you control a [Spy] character" is `requiresControlledCharacterTrait`. Eighteen printed cards are left over, and none of them is a trait on your identity:

| Wording                                                       | Cards                                                                                                                                      | Composition                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| "Play only if you control an Element Gun"                     | Sliding Shot 17005 (`stld`)                                                                                                                | `exists({ name: "Element Gun", controller: "you" })`                                                                        |
| "Play only if you control a [Web-Warrior] card"               | Spider-Man 27017, Ghost-Spider 27048 (`sm`), Spider-Ham 31021, Spider-Man 31022 (`spdr`), Scarlet Spider 30020, SP//dr 30021 (`spiderham`) | `exists({ trait: WEB_WARRIOR, controller: "you" })` (a card, not only a character)                                          |
| "Play only if any player controls a [Martial Artist] card"    | Black Belt 62037 (`luke_cage`)                                                                                                             | `exists({ trait: MARTIAL_ARTIST, controlledBy: eachPlayer })` (not `controller: "any"`, which also matches encounter cards) |
| "Play only if you control at least 3 characters with [Posse]" | The Posse 40058 (`next_evol`)                                                                                                              | `valueAtLeast(countOf(query(["identity", "ally"], { trait: POSSE, controller: "you" })), 3)`                                |
| "Play only if there is a side scheme in the victory display"  | Mission Planning 40017 (`next_evol`), Critical Hit 43016, Predictable Ploy 43038, Anticipated Attack 43040 (`x23`)                         | `valueAtLeast(victoryDisplayCount(query("sideScheme")), 1)` (new `ValueSpec`)                                               |
| "Play only if Vision is in Dense/Intangible mass form"        | Superdense Strike 26009, Mass Increase 26012, Just Passing Through 26010, Phase Disruption 26011 (`vision`)                                | a `Predicate` on however `vision`'s mass forms are modeled (not checked here)                                               |
| "Play only if you are the Bucky Barnes or Sam Wilson player"  | Captain America 53023 (`falcon`)                                                                                                           | a `Predicate` naming both identity cards by both faces (not checked here)                                                   |

So the condition is too varied for fixed data fields. And every one of these cards that is already emitted (13 of the 18: 17005, 26009–26012, 30020, 30021, 31021, 31022, 43016, 43038, 43040, 53023) already carries the sentence as an unparsed "-constant" ability ref. The five that are not are in packs not emitted yet (`sm`, `luke_cage`, `next_evol`). The primitive is therefore an ability:

- **`AbilityTriggerSpec constant.playOnlyIf: Predicate`**, read from the card being played, wherever it is, the same way `playableFrom`/`paymentOnly` are read from the card itself. `you` is the player playing it, `self` the card. RRG 1.8 "Initiating Abilities" (p. 24) step 2 ("Check play restrictions") and "Play Restrictions and Permissions" (p. 33, "all of its play restrictions must be observed").
- **Enforced in `playRestrictionFault`** (`actions.ts`), which now takes the card's instance id. That one function covers the play command, `legalActions` (the play is not offered), a play from an effect (`playFromHand`), and an event offered in a timing window.
- **`ValueSpec victoryDisplayCount { filter? }`**: the victory display is out of play, so `exists`/`count` cannot read it. It completes the survey.

**What `card-data-pipeline` must emit: nothing new.** Each of these sentences already becomes a "-constant" ability ref (and should keep doing so when `sm`, `luke_cage` and `next_evol` are emitted), which the scripter fills with `constant(playOnlyIf(…))`. Parsing them into `PlayRestrictions` fields would need a new field for each row above. Rows 1, 2 and 3 alone would need three (a name, a trait on any card, any player), and the ability would still be needed for the rest. The existing `requiresIdentityTrait` / `requiresControlledCharacterTrait` fields stay as they are.

**DSL:** `playOnlyIf(predicate)`, a `constant` part (several are ANDed), in `dsl/abilities.ts`; `victoryDisplayCount(filter?)` in `dsl/values.ts`.

**Sliding Shot composition** (`17005.sliding-shot-constant`):

```ts
constant(playOnlyIf(exists({ name: "Element Gun", controller: "you" })));
```

### 3.43 "Spend N resources of the same type →": `AbilityCost.sameResourceType`

> **Status: landed (2026-09-23),** tested in `packages/engine/src/same-type-resource-cost.test.ts` (6 tests: three of one type pay; a mixed payment is refused and a hand that cannot pay is not offered by `legalActions`; wilds count as the chosen type; a two-type card gives one icon and overpays the other; `legalActions`' example is accepted; a timing window's payment follows the same rule; replay deep-equal).

Kree Combat Armor (16131, Kree Militants): "Hero Action: Spend 3 resources of the same type → discard this card." `ResourceRequirement` names fixed types or a generic amount; `spend(3)` would accept three different types. The cost is the mirror of `distinctResourceTypes` ("Spend 2 resources of different types", Red Dagger, The Poison).

**The rules decisions:**

- **The type is the payer's choice**, made by what they spend. Any of physical, mental or energy works.
- **A wild resource counts as any type.** RRG 1.8 "Wild Resource" (p. 48): "When a player generates a wild resource, they may specify which resource type (energy, mental, physical, or wild) it is being used as." So two physical and a wild pay, and three wilds pay (as one declared type, or as three "wild", which is also one type).
- **A card printing icons of two types** generates both. One of them can count toward the chosen type; the other either pays some other part of the cost or is overpaid. RRG 1.8 "Cost" (p. 13): "While paying a cost, a player is permitted to generate resources beyond the specified cost", and those "are considered to have been overpaid for that cost and were not paid for that cost". So [physical][mental] + physical + wild pays 3 physical, with the mental overpaid. [physical][mental] + mental + energy cannot pay: at most two of any one type.
- **Only this cost's own resources must match.** With a card's printed cost in the same payment (an event whose action carries the cost), the rest is paid from whatever is left (`payableWithOneType` sets the matching resources aside first; RRG 1.8 "Cost", p. 13: the player "chooses how to divide those resources between those costs").

**What landed:**

- **`AbilityCost.sameResourceType: true`**, with `resources` as the count. `payableWithOneType` (`resources.ts`) tries each type, taking that type's own resources first and then wilds, and checks that what remains pays the rest.
- **Checked in `resourceVars`** (`actions.ts`), which every action and play payment already runs, so a mixed payment is refused with "spend 3 resources of the same type". **`legalActions` offers the ability only when it is payable**: it probes the player's whole wallet first (overpaying is legal), so a hand that cannot make three of one type lists the action as illegal with that message. Its `example` is the smallest prefix of the wallet that pays.
- **Fixed on the way: a triggered ability's payment in a timing window** (`payWindowAbility`, `resolve/window.ts`) checked only the total. It now goes through `resourceVars` too, so `sameResourceType`, `distinctResourceTypes` and a `resourcesX` X bind the same way they do for an action. A payment that fails is a decline, as an under-payment already was. No existing test changed.
- **Client impact: none forced.** `PaymentQuery.requirement` still reads "3 of any type"; the refusal message names the rule. `game-client-engineer` may want to show "of the same type" in the payment sheet.

**DSL:** `spendSameType(n)` in `dsl/abilities.ts`. The validator requires `resources` to be a number.

**Kree Combat Armor composition** (`16131.kree-combat-armor-action`):

```ts
heroAction({ cost: spendSameType(3) }, discard(self));
```

### 3.44 "After [ally] takes consequential damage from performing an attack, if that attack defeated an enemy"

> **Status: landed (2026-09-23),** tested in `packages/engine/src/consequential-damage-link.test.ts` (4 tests: an attack that defeats an enemy, then the damage is taken and the response gives tough; an attack that defeats nothing gives none; a thwart's consequential damage carries `thwart.*` and no `attack.*`; a tough status already on the ally absorbs the damage, so she took none and nothing triggers; replay deep-equal).

Martyr (19012): "Response: After Martyr takes consequential damage from performing an attack, if that attack defeated an enemy, give her a tough status card." The consequential damage event (`pushConsequentialDamage`) had no link back to the attack. It is pushed before the attack event, so it resolves after it (LIFO), and by then the attack's frame is gone.

**Printed timing kept.** RRG 1.8 "Consequential Damage" (p. 13): "Consequential damage is dealt to an ally after resolving abilities that are triggered by the ally attacking or thwarting." The response stays on the consequential damage itself. Firing it on the attack's own "after it defeats" window instead would give the tough status card first, and that card would then absorb Martyr's own consequential damage (RRG 1.8 "Tough", p. 44), which the card does not intend.

**What landed:**

- **The basic power reports into its consequential damage.** `pushConsequentialDamage` now returns the damage event's frame, and the basic attack's (or thwart's) event(s) are pushed with `reportTo: { frameId, prefix: "attack" | "thwart" }`, the mechanism `bind` already uses. When the attack finishes, before the waiting damage applies, its results land on that damage event as `attack.made`, `attack.damage`, `attack.damaged`, `attack.defeated` (a divided attack sums its attacks). The damage's own response window sees them in `results`, next to its own `amount`. Nothing else changes: the event is the same event, at the same point on the stack.
- **Only consequential damage carries them**, so `requireResults: { "attack.made": 1 }` is itself "consequential damage from performing an attack". A thwart's carries `thwart.*` instead.
- **"Takes"** is damage taken (`amount` ≥ 1). A tough status card already on the ally absorbs the damage, so she took none and the response is not offered.
- Consequential damage is engine-pushed only for basic attacks and thwarts (an ally's "(attack)" ability prints its own). No change there.

**DSL:** `after.consequentialDamage(who, { from: "attack" | "thwart", defeated? })` in `dsl/abilities.ts`.

**Martyr composition** (`19012.martyr-response`):

```ts
response(after.consequentialDamage("self", { from: "attack", defeated: true }), giveTough(self));
```

### 3.45 A defeat's destination: `setDefeatDestination`, `RuleSpec defeatDestination`, `characterDefeated.fromAttack`

> **Status: landed (2026-09-23),** tested in `packages/engine/src/defeat-destination.test.ts` (4 tests: an ally defending the villain's attack is defeated, still counts as defeated, and returns to its owner's hand; declined, it is discarded; an ally defeated by a player's own event is never offered the interrupt; a constant `defeatDestination` sends a defeated minion into the encounter deck; replay deep-equal).

Regroup (19032): "Interrupt: When an ally is defeated by an enemy attack, return it to its owner's hand instead of discarding it." The only precedent was `RuleSpec defeatedIntoEncounterDeck` (Time Portal): a constant, side schemes only, one destination, no condition. Nothing could redirect a character's defeat, and a defeat did not say whether attack damage caused it. A plain `instead()` on the defeat would cancel the defeat itself, so no When Defeated would resolve and the ally would not count as defeated: a different card.

**The rules:**

- **The ally is still defeated; only the discard is replaced.** RRG 1.8 "Defeat" (p. 15): a defeated ally is discarded. The card says "instead of discarding it", so When Defeated, "after … is defeated" responses and the attack's `defeated` result all still apply.
- **Victory X is not a discard.** A Victory X card still goes to the victory display (RRG 1.8 "Victory X", p. 46), and a destination does not apply to it.
- **"Defeated by an enemy attack"**: the defeating damage was attack damage (`dealDamage.fromAttack`) and its source is an enemy. An enemy attack that deals indirect damage (§3.16) counts; damage from an encounter card's effect, a player's event or retaliate does not.

**What landed:**

- **`EffectSpec setDefeatDestination { to: CardDestination }`**, for an interrupt to `characterDefeated`: it records `to` on the pending defeat event (`characterDefeated.destination`), the way `preventDamage` edits a pending damage event. `applyDefeat` sends the card there (`moveCardsTo`; `"hand"` and the deck destinations are its owner's) instead of `discardFromPlay`. A later interrupt's destination replaces an earlier one's.
- **`RuleSpec defeatDestination { target, to, while? }`**, the constant form and the generalization of `defeatedIntoEncounterDeck`. It applies to a defeated ally, minion or side scheme. `defeatDestinationRule` (`rules.ts`) reads it, and reads the old kind as `to: "encounterDeckShuffle"`, so Time Portal's script is unchanged. The interrupt's destination wins over a constant one.
- **`characterDefeated.fromAttack`**, set when the defeating damage was attack damage. `EventPattern.fromAttack` now matches a defeat as well as a damage event. The defeat sweep's hints now also come from a simultaneous damage group (indirect damage, a divided attack), one per member, so those defeats also carry their source, defeating player and `fromAttack`. Before this, a damage group's defeats carried no source at all.
- **Client impact: none.** No new `GameEvent`; the card's move is logged as `cardMoved` after `characterDefeated`.

**§4 Q17, decided by the user on 2026-09-23 (Regroup wins):** Regroup and the Collector's "when a card would be placed into a discard pile from play, put it into The Collection instead" (§3.14) can both apply to one defeated ally in Infiltrate the Museum. The engine resolves Regroup in the defeat's interrupt window, so the ally never heads for a discard pile and the Collection redirect does not apply.

**DSL:** `setDefeatDestination(to)` in `dsl/effects.ts`; `on.defeated(what, { byAttackFrom })` in `dsl/abilities.ts`. The constant form goes through the `rule(...)` passthrough.

**Regroup composition** (`19032.regroup-interrupt`):

```ts
interrupt(when.defeated(query("ally"), { byAttackFrom: query("enemy") }), setDefeatDestination("hand"));
```

### 3.46 "When your turn begins" is an interrupt; the "you" of an uncontrolled attachment or obligation

> **Status: landed (2026-09-23),** tested in `packages/engine/src/turn-start-timing.test.ts` (4 tests: a turn-start
> interrupt resolves before a turn-start response; an attachment on P2's identity and an obligation in P2's area answer
> P2's turns only, while a player support still answers its controller's; the event is initiated then resolved; replay
> deep-equal). Card test: `gmw/galactic-artifacts.test.ts`, `16125.the-poison-forced-interrupt`.

The Poison (16125): "Forced Interrupt: When your turn begins, place 1 poison counter here, then take 1 damage for each
poison counter here." `turnStarted` was an announcement, so it opened only a response window.

**The rules:**

- **A turn beginning is a triggering condition like a phase beginning.** RRG 1.8 "Interrupt" (p. 25) resolves an
  interrupt "immediately before that triggering condition resolves", and the RRG has no class of timing point that
  can only be responded to. §3.2's `phaseBeginning` and `phaseEnding` already had both windows, as does `turnEnding`
  (Hulk's Enraged). So `turnStarted` now has both. **Every other "begins/ends" timing point was checked:**
  `phaseBeginning`/`phaseEnding` (both windows, §3.2; "the round begins/ends" is the player/villain phase's), and
  `turnEnding` (both). `villainStepResolved` ("After resolving step one") stays response-only because it is an
  "after" point. `playerPhaseEnded`/`villainPhaseEnded` stay response-only announcements; `phaseEnding` is their
  interruptible form.
- **The "you" of an uncontrolled attachment on a player card is that card's controller** (RRG 1.8 "Attachment",
  p. 8), and **of an obligation, the player whose play area it is in** (RRG 1.8 "Obligation", p. 30). Before, a
  `playerIs: "controller"` trigger on any uncontrolled card matched whichever player the event was about, so in a
  multiplayer game "your turn begins" on The Poison fired on every player's turn, and so did Medical Emergency's
  (`trors` 04164) "At the end of your turn". Now the event must be about that player. Other uncontrolled cards (an
  enemy, a scheme) keep the old reading: an engaged minion is in a player's area, but "after you attack this minion"
  means whoever attacks it.

**What landed:**

- `isAnnouncement` (`trigger-events.ts`) no longer lists `turnStarted`. Its apply step changes nothing. The turn's
  state is set (`beginTurn`) before the event is pushed, but no player can act until the event's frame has left the
  stack, so an interrupt still resolves before anything the turn does.
- `uncontrolledYouOf` (`select.ts`), read by `matchesPattern` (`resolve/triggers.ts`). It is narrower than `speakerOf`,
  which also names an engaged minion's player.
- **Responses are unchanged.** Quinjet (`cap` 03019, "Response: After your turn begins") still answers in the response
  window, and its test is unchanged.
- **Log:** each turn start now logs `triggerEvent { phase: "initiated" }` before its `resolved`, like every
  interruptible event. No existing test or e2e seed changed outcome.

**The Poison** (`16125.the-poison-forced-interrupt`):

```ts
forcedInterrupt(on.yourTurnBegins(), addCounters("poison", 1), takeDamage(countersOn(self, "poison")));
```

### 3.47 Dealing a card already identified: `EffectSpec dealAsEncounterCard`

> **Status: landed (2026-09-23),** tested in `packages/engine/src/deal-as-encounter-card.test.ts` (4 tests: the named
> cards are dealt facedown in order and the deck's top is untouched; the dealt cards are revealed in the next villain
> phase; a card in play is never dealt; replay deep-equal). Card test: `ron/kree-fanatic.test.ts`,
> `90005.when-revealed`.

You Dare Oppose Me? (90005): "Discard the top 5 cards of the encounter deck. Each time a card belonging to the Kree
Fanatic set is discarded this way, deal that card to yourself as a facedown encounter card." It is also RRG 1.8's own
example for "Each Time" (p. 7). `dealEncounterCard` always takes the encounter deck's top card, and no
`CardDestination` reached a player's dealt-encounter zone.

**The rule:** RRG 1.8 "Deal, Deal an Encounter Card" (p. 15): a dealt card is placed facedown in front of the player,
"is not revealed at this time" and "is added to the queue of cards that player resolves during the villain phase". If
it is dealt during step three or four, it joins the cards being dealt and revealed in those steps.

**What landed:**

- **`EffectSpec dealAsEncounterCard { cards: TargetRef, player: PlayerRef }`.** Each card `cards` names goes facedown
  into the first named player's `dealtEncounter` zone, in order. The card must be out of play (the encounter deck or a
  discard pile, which is where "discarded this way" leaves it) and must be a type a player can be dealt (attachment,
  environment, minion, obligation, side scheme, treachery). An effect, not a `CardDestination`: `moveCards`
  destinations name no player, and the player here is a `PlayerRef` resolved in the effect's context.
- **"Each time":** `discardEncounterCards` still does every discard before its `forEachDiscarded` passes. RRG "Each
  Time" would interleave them, but here that makes no observable difference. The deal reads nothing from the deck, and
  an emptied encounter deck is reset only at its next draw, so a dealt card is still in the discard pile when its pass
  runs.
- **Log:** `cardMoved` per dealt card, as for every deal. No new `GameEvent`.
- **Found while testing (§4 Q14):** revealed by `EffectSpec revealEncounterCard` rather than by the villain phase, this
  card is still on top of the encounter deck while it resolves. It would discard itself as the first of the five and,
  being a Kree Fanatic card, deal itself to the revealing player. The villain phase path (the test) is correct. The Q14
  fix, dealing the card out of the deck before revealing it, would cover this as well.

**DSL:** `dealAsEncounterCard(cards, player = you)` in `dsl/effects.ts`.

**You Dare Oppose Me?** (`90005.when-revealed`):

```ts
whenRevealed(
  discardEncounterCards(5, {
    forEachDiscarded: {
      slot: "discarded",
      effects: [
        ifThen(
          refMatches(chosen("discarded"), encounterSetOf(self), { anywhere: true }),
          dealAsEncounterCard(chosen("discarded"), you),
        ),
      ],
    },
  }),
);
```

### 3.48 "Place the rest on the top and/or bottom of the encounter deck in any order": `reorderCards` to `"encounterDeckTopOrBottom"`

> **Status: landed (2026-09-23),** tested in `packages/engine/src/place-top-or-bottom.test.ts` (5 tests: a split with
> both piles ordered, all to the bottom, all to the top, one card each side, everything discarded; each replays
> deep-equal). DSL: `packages/cards/src/dsl/wave3-primitives-3.test.ts`. Card tests: `gmw/market.test.ts`, Take the
> Fight to Them (16161; solo top-only, bottom-only, split and discard-all, and two players looking at 4).

Take the Fight to Them (16161): "Hero Action: Look at the top 2[per_hero] cards of the encounter deck. Discard any
number of those, then place the rest on the top and/or bottom of the encounter deck in any order. Draw 1 card."
`reorderCards` (Heimdall, §3.13 of docs/phase7-wave1.md) only put cards back on top.

**The rule:** RRG 1.8 "Deck" (p. 15) and "Encounter Deck" (p. 17): the order of a deck changes only when a card
instructs it, and this card lets each card go to either end, in any order. RRG 1.8 "Look, Looked-At" (p. 27): the
looked-at cards stay part of the deck, and only the player resolving the ability sees them. So every question goes to
that player alone.

**What landed:**

- **`EffectSpec reorderCards.to: "encounterDeckTopOrBottom"`.** Three questions to `chooser`, each skipped when only
  one answer is possible:
  1. **Split:** the new `ChoicePrompt { kind: "chooseBottomCards", deck: "encounterDeck" }`. The player selects the
     cards that go to the bottom, from none to all of them. Every card not selected goes on top.
  2. **Order the top pile:** `orderCards` to `"encounterDeckTop"`, asked only when the pile holds two or more cards.
  3. **Order the bottom pile:** `orderCards` to `"encounterDeckBottom"` (new), likewise.
- **Both orders read top-down, the way the deck will.** The first card selected for the top pile becomes the deck's top
  card. The last card selected for the bottom pile becomes the deck's bottom card. A player orders each pile the way it
  will lie in the deck, and the same reading holds for both prompts.
- **Nothing moves until the last answer.** The split and the top order are kept on the frame (`_place.step`,
  `_place.top`, `_place.bottom`, the way `playFromHand` keeps its own `_play.*` state) and cleared when the effect
  finishes. Then every card moves at once, one `cardMoved` each. A malformed order keeps the cards in the order they
  were looked at, and a malformed split puts every card on top.
- **Who orders both piles:** the same `chooser`. No card or ruling splits the decision.

**DSL:** `placeOnTopOrBottom(cards, chooser = you)` in `dsl/effects.ts`.

**Take the Fight to Them** (`16161.take-the-fight-to-them-action`):

```ts
heroAction(
  selectCards("looked", encounterCards(["deck"], undefined, perHero(2))),
  chooseCards("discarded", cards(chosen("looked")), { min: 0, max: 8 }),
  moveCards(cards(chosen("discarded")), "discard"),
  placeOnTopOrBottom(cards(chosen("looked"), { excludeSlots: ["discarded"] })),
  draw(1),
);
```

"Any number" includes none, so `min: 0`. `max: 8` is the most 2[per_hero] can be with four players, and the engine caps
it at the number of cards looked at. Going Undercover (`bp`, "place the rest on the top and/or bottom of the encounter
deck in any order", chosen by the defeating player) is the next card that needs this. It passes that player as
`chooser`.

**Client:** see §3.49's client note.

### 3.49 A cost the board picks: `AbilityCost.conditional` ("… instead if you control the Milano")

> **Status: landed (2026-09-23),** tested in `packages/engine/src/conditional-cost.test.ts` (5 tests: the count and the
> zone each follow the condition; another player's Milano does not count; `legalActions` fills in the picks of the
> branch the board picked; no fallback to the other branch in either direction; replay deep-equal). DSL:
> `packages/cards/src/dsl/wave3-primitives-3.test.ts`. Card tests: `gmw/market.test.ts`, Reactor Core (16165) and
> Navigation Column (16172), each with and without the Milano.

Reactor Core (16165): "Hero Action: Exhaust Reactor Core and discard the top 2 cards of your deck (the top card instead
if you control the Milano) → reduce the resource cost of the next event you play this turn by 1." Navigation Column
(16172): "Hero Action: Exhaust Navigation Column, choose and discard 1 card from your hand (discard the top card of your
deck instead if you control the Milano) → draw 1 card." In both cards the size or zone of the cost depends on the board.
`AbilityCost.either` (§3.36) is a player's choice among payable branches. Using it here would let a Milano controller
pay the printed cost instead.

**The rule:**

- **When the cost is decided.** RRG 1.8 "Initiating Abilities" (p. 24), step 3: "Determine the cost (or costs) to play
  the card or initiate the ability and the player's ability to pay them, taking modifiers into account." The condition
  is read at step 3, when the ability is initiated, from the paying player's point of view.
- **No fallback.** "Instead" makes this a replacement (RRG 1.8 "Instead" → "Replacement Effect", p. 37): while the
  condition holds, the printed cost is not the cost at all. Only the branch the board picked is checked. If that branch
  can't be paid, the ability can't be initiated (p. 24, steps 3 and 5; "Cost", p. 13: a cost is paid in full), even
  when the other branch could be paid. So a Milano controller whose deck and discard pile are both empty can't use
  Navigation Column with a full hand. Without the Milano, an empty hand can't pay it with a full deck.
- The rulings file (December 17, 2025 through August 13, 2026) has no ruling on a conditional cost.

**What landed:**

- **`AbilityCost.conditional { condition: Predicate; then: AbilityCost; else: AbilityCost }`.** It is paid together
  with every other component of the cost. `selectCost` (`actions.ts`) resolves it before any player decision, through
  `determineConditionalCost`. The condition is evaluated with `you` = the payer and `self` = the ability's card. The
  picked branch is merged into the rest of the cost and recorded as var `cost.condition` (1 = `then`, 0 = `else`).
  `planCost` routes every conditional cost through `selectCost`, so the ability frames, trigger candidates and windows
  all pay exactly the checked branch.
- **A branch may hold an `either`** (a player choice inside the board's pick) but not another `conditional`. It must
  not repeat a component of the rest of the cost.
- **`costAsDetermined(state, deps, sourceId, playerId, cost)`** (exported from `@mc/engine`) returns the cost with the
  board's branch applied. `legalActions` and `paymentFor` read it, so a legal action's `example` fills in a hand pick
  only when the hand branch is the cost. A client should read it too, rather than the written cost.
- **Validator:** each branch is checked as the whole cost it makes. A nested `conditional` or a repeated component is
  refused. What either branch binds is in scope for the effects, and so is `cost.condition`.

**DSL:** `costIf(condition, then, otherwise)` in `dsl/abilities.ts`; each branch is one cost or a list merged like
`cost: [...]`.

```ts
// Reactor Core
heroAction(
  { cost: [exhaustThis, costIf(MILANO_CONTROLLED, discardTopOfDeckCost(1), discardTopOfDeckCost(2))] },
  reduceNextCardCost(you, 1, "turn", query("event")),
);
// Navigation Column
heroAction(
  { cost: [exhaustThis, costIf(MILANO_CONTROLLED, discardTopOfDeckCost(1), discardFromHandCost(1, 1))] },
  draw(1),
);
```

`MILANO_CONTROLLED` is the Market's own "you control the Milano" predicate (`gmw/market.ts`), already used by Armor
Plating, Heavy Cannon and the other Milano mods.

**Client (both sections; no client code changed):**

- `chooseBottomCards` has no title in `scenes/choice.ts`'s `promptTitle`, so the overlay falls back to "Choose". It
  is a plain multi-select of card options (`ordered: false`, 0 to all). Suggested title: "Choose the cards to put on
  the bottom of the encounter deck".
- `orderCards` to `"encounterDeckBottom"` shows "Put these back in any order", the same title as the top pile. The
  overlay should tell the two piles apart ("Order the cards going to the bottom, top to bottom").
- `view/discard-choice-model.ts`'s `actionAbilityCost`, the ability label (`view/ability-label.ts`) and the
  cost-choice model (`view/cost-choice-model.ts`) read the written cost, so none of them sees a `conditional`
  component. Navigation Column without the Milano still works: the command carries `legalActions`' `example` pick,
  which follows the board's branch. But the player isn't asked which hand card to discard; the engine picks the
  cheapest one. The fix is to pass the cost through `costAsDetermined` in `actionAbilityCost`.

### 3.50 "Search … for one copy of X": `CardSelector atMost`

> **Status: landed (2026-09-23),** tested in `packages/engine/src/at-most-selector.test.ts` (5 tests: one copy taken
> and the rest untouched; a second, later search finds a remaining copy; deck before discard pile, then the discard
> pile; fewer or none matching is not an error; at most 2 and at most 0; each replays deep-equal). DSL:
> `packages/cards/src/dsl/wave3-primitives-3.test.ts`. Campaign tests: `campaigns/gmw.qa.test.ts` ("You Stand
> Accused!" and Pincer Maneuver, un-skipped). Card test: `stld/star-lord-kit.test.ts` (Element Gun).

MC16 p. 18 (Ronan the Accuser setup): "search the encounter deck and discard pile for **one copy** of the 'You Stand
Accused!' (116) treachery, then deal that card to that player", and "for **one copy** of the Pincer Maneuver (112) side
scheme and reveal it". Each printed copy is its own instance, and a selector names every instance that matches, so
three treacheries were dealt (16116 ×3) and two Pincer Maneuvers revealed (16112 ×2), each with its own threat (found
by QA, `docs/phase7-wave3-qa.md`). `CardSelector.encounter.top` is positional and does not help.

**The rule:** RRG 1.8 "Search" (p. 39): "If a player finds multiple cards that satisfy the criteria of a search, the
player chooses among those options." RRG 1.8 "Shuffle" (p. 39): a searched deck is shuffled after the search. The
rulings file (December 17, 2025 through August 13, 2026) has no ruling on which copy a search takes.

**What landed:**

- **`CardSelector { kind: "atMost"; count: ValueSpec; of: CardSelector }`.** The first `count` cards `of` names, in
  its own order. Fewer or none matching names fewer or none, with no error; `count` of 0 or less names nothing. It
  wraps any selector, so it works in every effect that takes one (`selectCards`, `moveCards`, `tuckCards`,
  `chooseCards`' pool).
- **Which copy.** `atMost` is for interchangeable copies, so it doesn't ask. It takes them in selector order: an
  `encounter` selector yields the deck top-down, then the discard pile; a `zone` selector its zones in the order
  listed. The deck is shuffled afterwards, so which deck copy is taken can't be seen. The one real pick is deck
  before discard pile. That default is ours, not the RRG's (the RRG gives the player the pick); it takes a bad
  encounter card out of the deck, which is the choice a player would make. Where the pick matters to the player, use
  `chooseCards` with `max` instead (Island of Dr. Zola's Ultimate Bio-Servant already does).
- **The other copies stay where they were.** Nothing else moves, so a later search or draw can still find them.

**DSL:** `atMost(n, from)` and `oneCopyOf(from)` (= `atMost(1, from)`) in `dsl/effects.ts`. `searchAndReveal` now
reveals one copy ("reveal **it**").

**Scripts switched:**

- `campaigns/gmw.ts`: `mc16.s5.setup.you-stand-accused` and `mc16.s5.setup.pincer-maneuver`.
- `searchAndReveal`: Zola (II) 04110, "search … for the Test Subjects side scheme and reveal it" (04123 ×2) had the
  same flaw and revealed both. Every other `searchAndReveal` target is printed once, so nothing else changes.
- Peter Quill 17001b Setup, "search your deck and discard pile for **a copy** of the Element Gun upgrade" (17007 ×2):
  it put both in hand.

Every other name or printed-id search in `@mc/cards` and the campaign definitions (including `mts.gate.test.ts`)
targets a card printed once, or already chooses with `chooseCards` or `firstOf`.

---

## 4. Open questions (for the user or FFG)

Each is implemented the way stated, or not at all, and named here rather than decided silently.

1. **A villain and the last identity defeated at the same time (§3.1). Answered (`game-rules-architect`, 2026-09-23): the players lose.** FFG ruling, May 18, 2023 (Hall of Heroes "Latest FFG Rulings (post-RRG 1.5)"), on The Kraken (`mojo` 39050, "each other character takes 1 damage") defeating every character, villain included: "the players are considered to have lost the scenario. We agreed that there aren't any ties in Marvel Champions between the villain and the heroes, so if the heroes don't win, they have lost." RRG 1.8 has no tie rule of its own ("Winning the Game", p. 48; "Player Elimination", p. 34: "If all players are eliminated, the game ends and the players lose"; "Villain Defeat", p. 47). The damage is simultaneous: ruling, June 2, 2026 (2) answer 1, on RRG 1.8 "Damage" (p. 14): "Damage is dealt **simultaneously**; resolve damage steps for both enemies at the same time." The earlier text here ("the elimination happens first" only for a listened-to villain defeat, the villain first otherwise) was wrong for the case that matters: an `each` target dealt its damage one character at a time, so the villain fell and won the game before the identity was touched (`docs/phase7-wave3-qa.md` Finding 2). Now any `dealDamage` with more than one target is a `damageGroup`, and while an identity falls in a defeat sweep the villain's defeat waits on the stack under the identities' defeats: a "would be defeated" interrupt that saves the identity (Captain America's Helmet) still gets its window, and the villain then falls and wins. Still open, because neither ruling reaches it: one ability that damages the last identity and then, in a later sentence, the villain. "Player Elimination" (p. 34) says "If a player is eliminated partway through the resolution of an ability, resolve the entire ability", but also that the game ends when all players are eliminated. The engine ends it at the elimination, as a loss; no cycle 2 card reaches the case.
2. **A flip into or out of an ∞ face resets the dial (§3.1).** Implemented as the engine rule, from the only two products that print ∞ (MC21 p. 20 for Hela; the Collector's own text). RRG 1.8 "Flip" (p. 20) is silent on the dial. Confident, but it is a reading.
3. **Badoon Headhunter is both modular and campaign-specific (§1.7). Answered (`card-data-pipeline`, 2026-09-22): modular, not schema-`campaignSpecific`.** RRG 1.8's own FAQ answer settles it directly — "Galaxy's Most Wanted Expansion", "Modular Encounter Sets" (p. 61): "If an encounter set is not scenario-specific (containing the name of that scenario in its encounter set name area) or campaign-specific (containing the word 'Campaign' in its encounter set name area), then it is modular. The eight modular encounter sets in the Galaxy's Most Wanted Expansion are: Badoon Headhunter, Band of Badoon, Galactic Artifacts, Kree Militants, Menagerie Medley, Power Stone, Space Pirates, and Ship Command." (Also in `mc_rulesreference_v18_compressed.md` ~line 4492; that conversion has no page markers, so the citation above was checked against the PDF directly, page index 60 → printed footer "61".) MC16 p. 4's "campaign-specific encounter cards" is a looser, plain-English use of the phrase, not the FAQ's defined term; raw agrees structurally too (Badoon Headhunter's and Campaign Challenge's cards are `faction_code: "encounter"`, not `"campaign"`, unlike The Market). `EncounterSet.campaignSpecific` (which tracks the printed "Campaign" word, RRG 1.8 p. 11) stays `false` for both; neither is listed in any of the five scenarios' `recommendedModularSetIds` since neither is named in any 1A "Contents" text, so standalone play never draws either on its own regardless. See `curation/gmw.ts`'s own docblock for the full citation.
4. **Resolved (2026-09-25): a defeated minion or ally leaves play after its When Defeated resolves.** RRG 1.8 "When Defeated Abilities" (p. 48): "When a villain stage, side scheme, main scheme stage, ally, or minion is defeated, all 'When Defeated' abilities on the card resolve. » A defeated card leaves play after its 'When Defeated' ability is resolved, if any." The question had been treated as open because only "Defeat" (p. 15) was cited, and the ruling of Jan 11, 2026 (1) speaks only of a side scheme. The engine used to move a minion or ally to its discard pile first, then resolve its When Defeated.
   - **The implementation.** `applyDefeat` (`resolve/event.ts`) still logs the defeat and reports it to the attack at once, reads the destination (Victory X, Regroup's `setDefeatDestination`, a `defeatDestination` rule) at the defeat, and pushes, in order: the card's When Defeated abilities, then `leaveAfterWhenDefeated` (an `effects` frame, `discardFromPlay { defeated, insteadTo? }`, run only if the card is still in play showing the defeated face), then any overkill spill. Side schemes share `leaveAfterWhenDefeated`. The spill's amount is fixed by the damage that caused the defeat, so it does not depend on where the card is, and an interrupt that replaces the defeat still means no spill. While the card waits to leave, it is in play at zero remaining hit points, so the defeat sweep skips it (`defeatPending` reads the frame's `defeatedLeaving`); without that, a When Defeated that deals damage (Goblin Soldier 02023, "deal 1 damage to the engaged player's identity") defeated its own card again on every sweep.
   - **Tests.** `packages/engine/src/wave3-q4-minion-leaves-play-order.test.ts`, which pinned the old order, now pins the new one: a minion and an ally each resolve a When Defeated that sees itself in play, then leave; with overkill, When Defeated, then leaving, then the spill; and a Goblin Soldier-shaped When Defeated deals its damage once and the minion is defeated once.
   - **E2e seeds.** Measured against this branch after the excess-damage change (276d8adf). None plays differently: every `[e2e]` summary line (outcome, round, command count) across `packages/cards` and `packages/engine` is unchanged. Before the sweep guard, `gob` Mutagen Formula 2-player (seed 2027) went from a main-scheme loss in round 5 (105 commands) to all players defeated in round 4 (74 commands): Captain Marvel's Photonic Blast defeated a Goblin Soldier, whose When Defeated damage re-defeated it until her identity fell. That was the bug the guard fixes, not a rules change.
5. **Resolved (2026-09-25): patrol, crisis and target validity (§3.5).** The question was whether a "(thwart)" ability whose only possible target is the main scheme can be played while patrolled. It cannot. The engine used to let it be played and then block only the removal.
   - **The rule.** RRG 1.8 "Target" (pp. 42–43): "A target is valid for an ability or game function if any part of that ability can affect that target"; "If an ability or game function has multiple effects on its target, the target is valid if at least one of those effects can affect the target"; "A target that cannot be thwarted is not a valid target for a thwart-labeled ability". Its crisis example says an ability that removes threat from "each scheme" can still be initiated if at least one scheme is valid. RRG 1.8 "Patrol" (p. 32) makes the engaged player unable to thwart the main scheme. RRG 1.8 "Initiating Abilities" (p. 24) step 2 requires a valid target. Rulings, Apr 30, 2026 (1) (a target is invalid only if dealing damage is the only effect) and (2) (a Guard minion that engages during step-5 cost payment means the attack effect cannot be initiated in step 6).
   - **The implementation.** The behaviour is in §3.5 "Behaviour to know". A single module, `packages/engine/src/resolve/target-validity.ts`, judges target validity. `divisionCanAffect` now uses its checks too.
   - **Tests.** `packages/engine/src/patrol.test.ts` has 20 tests, 13 of them new. They cover: a patrolled player with only the main scheme to choose (refused and not offered); a confused hero in the same spot (allowed, and the confused card is discarded); a side scheme in play (offered, main scheme excluded); non-thwart removal under patrol; a thwart with a second effect on its target; "each scheme" with a valid side scheme and with only the main scheme; the backstop when a patrol minion engages between choice and thwart; and under crisis, single-target thwart and removal, a named-target removal (refused) and `ignoreCrisis`. The old "a '(thwart)' ability against the main scheme removes nothing" test now expects the play to be refused.
   - **Existing tests changed.** Five other engine tests played a "(thwart)" or removal event whose only target was a main scheme it could not affect, and asserted that nothing was removed. Each now asserts the play is refused with `no_valid_target`: `primitives-wave2b.test.ts` (the plain thwart beside Cable Arrow's `ignoreCrisis`), `lasting.test.ts` (Countdown to Oblivion's `threatCannotBeRemoved`), both tests in `threat-cannot-be-removed-scoped.test.ts`, and two in `character-ignores.test.ts` (a removal the exempt hero does not make under crisis, and the ordinary thwart after Just Passing Through).
   - **E2e seeds that play differently.** Measured against the `feature/wave-4` baseline (055c773f). Every game still ends and still replays deep-equal.
     - **Core Ultron 4-player (`packages/cards/src/e2e.test.ts`):** 160 → 162 commands, same loss in round 5. Under Attack (01151, crisis) is in play in rounds 4 and 5, so Spider-Tracer (01007), Surveillance Team (01064) and Interrogation Room (01063) no longer offer the main scheme. Their removal now goes to a side scheme instead of being blocked.
     - **`gob` Risky Business solo (seed 2026):** loss by main scheme moves from round 14 to round 15, 110 → 121 commands. In round 7 Collapsing Bridge (02009, crisis) is in play, so For Justice! (01060) no longer offers Hostile Takeover. It thwarts Collapsing Bridge instead.
     - **`mts` Thanos expert solo (`thanos-e2e.test.ts`):** 23 → 22 commands, same loss in round 2. Sanctuary (21116) says "Thanos cannot take damage from player cards", and Thanos is the only enemy. So Gamma's (21002) "deal 1 damage to an enemy" Hero Response is no longer offered in round 1.
     - **`mts` Thanos 2-player, Spectrum + Adam Warlock (`two-player-e2e.test.ts`):** the loss changes from all players defeated in round 6 to main scheme completed in round 7, 151 → 159 commands. The same Gamma response is not offered in round 1. In round 2 Adam Warlock's (21031a) Aggression branch can no longer choose Thanos, so it damages Proxima Midnight or Black Dwarf. In rounds 3 and 4 Tribute (21128, crisis) keeps the main scheme out of Photon's (21003) "remove 1 threat from a scheme".
     - **Offered targets changed, outcome unchanged:** Core Klaw 2-player (Superhuman Law Division under Defense Network's crisis) and `mts` Hela 2-player (Photon and For Justice! no longer offered Gnipahellir, whose threat cannot be removed).
   - **Follow-up (2026-09-25): a confused character's basic thwart.** RRG 1.8 "Confuse, Confused" (p. 13) covers basic thwarts too, so `basicThwart` now lets a confused character attempt one against the main scheme under patrol or crisis. The attempt removes the confused card and no threat. Tests: three in `packages/engine/src/patrol.test.ts` (patrolled, under a crisis icon, and an unconfused hero still refused), which now has 23 tests. One e2e seed plays differently, measured against `claude/outstanding-questions` at f83d3218: `mts` Thanos 2-player, Spectrum + Adam Warlock. In round 4 Spectrum is confused while Tribute's crisis icon is in play, so her basic thwart against the main scheme is now offered and discards the confused card. Same loss by main scheme in round 7, 139 → 135 commands. It still replays deep-equal.
6. **When is Star-Lord's "When you play a card from your hand" true (§3.20)?** RRG 1.8 step 6 says the card "commences being played" after the cost is paid (step 5), yet the ability reduces "the cost to play that card by 3". The printed card works only if the reduction applies at step 4. Proposed: treat it as a cost modifier offered while paying, like a resource ability.
7. **The Collector's back faces print ATK/SCH 0/0 (standard) in the raw data. Answered (`card-data-pipeline`, 2026-09-22): printed "0"/"0" (standard) and "2"/"2" (expert), not "—"/"—", confirmed against the printed card images.** `marvelcdb.com/bundles/cards/16080b.png` and `16081b.png` were fetched and viewed directly this pass (not stored in the repo — CLAUDE.md's art boundary): both print solid numeral stat badges — "0" SCH / "0" ATK on the standard back face (16080b, "A2"), "2" SCH / "2" ATK on the expert back face (16081b, "B2") — not the dashed "—" box RRG 1.8 "Dash (Value)" (p. 15) uses elsewhere (compare Risky Business's Norman Osborn/Green Goblin, which do print a dash). So the Wounded Collector can attack and scheme (0 or 2, never blocked from using the power the way a dash would), not "—". Both faces also print "HIT POINTS ∞" in the footer, independently confirming `infiniteHp` against the card itself.
8. **Venom's set-aside Symbiotes. Answered (`ability-scripting-engineer`, 2026-09-22): all 4 printed copies, and this is already the engine's own general rule, not a Venom-specific setup step.** `packages/engine/src/setup.ts` (`config.includeIdentitySets !== false`): only a hero's own obligation is shuffled into the encounter deck during setup (RRG 1.8 "Obligation", p. 30, step 10); every _other_ nemesis-set card (a nemesis minion, a nemesis side scheme, for _any_ hero) is instead pushed onto that player's own `PlayerState.setAside` and stays there — nothing shuffles it into the encounter deck automatically. So Klyntar Frenzy and all 4 Enraged Symbiote copies (`quantityInSet: 4`) start set aside by the same mechanism `stld`'s own Spartoi Cunning nemesis-set testing already relied on, not a bespoke Venom rule to build. Corroborated by two secondary sources (not authoritative alone, but consistent with the engine's own rule and each other): the Venom insert's own FAQ (`hallofheroeslcg.com/wp-content/uploads/2021/07/venominsert.jpg`, fetched 2026-09-22) — "Because each copy of Enraged Symbiote is considered to be Venom's nemesis minion, Venom will put all set-aside copies of Enraged Symbiote into play" — and an official FFG ruling (Hall of Heroes "Latest FFG Rulings (post-RRG 1.5)", May 18, 2023, Alex): "If you reveal Shadow of the Past while playing the Venom hero and you can't put all **4** copies of his nemesis minion into play (like if you had already put one into play earlier from his obligation) … you simply put as many as you can that are currently set aside." Full citations in `packages/cards/src/wave3/vnm/venom-obligation-nemesis.ts`'s own module docblock.
9. **A reduction and a cap on the same character (§3.15).** Wide Stance and Cutthroat Ambition can both be on Nebula. Implemented as reductions first, then the cap: 10 damage → 9 → 5 taken. The other order gives 10 → 5 → 4. The two agree whenever the damage is at most the cap (5 → 4 either way) and differ above it. RRG 1.8 has no rule for ordering two constants.
10. **Follow Through is modeled as a constant (§3.18).** Printed as an optional Hero Interrupt, it always applies here. Declining it is never better for its controller in cycle 2; if a later card punishes excess damage, it becomes a real choice and needs an interrupt window on excess damage.
11. **"If you control the Power Stone" (§3.19).** Read as "if the Power Stone is attached to your identity": encounter cards are controlled by the scenario (RRG 1.8 p. 31), and MC16 p. 15 phrases the same condition as "attached to an identity". The FAQ (p. 62) says "an identity who controls the Power Stone", which fits either reading.
12. **Moondragon: is "that minion attacks another enemy" an activation (§3.23)? Decided by the user, 2026-09-23: an attack, not an activation.** This is a design decision made without an FFG ruling. The rulings file and the FAQ are silent. RRG 1.8 "Activation" (p. 6) points the other way: "Whenever an enemy attacks or schemes, it is considered to have activated", and "Some card abilities can also cause enemies to attack or scheme. These are also considered activations." But the activation procedure has no place for an enemy target. "Enemy attacks are always initiated against both a player and a character" ("Attack (Enemy Activation)", p. 8), and an enemy target has no controller to defend it or assign damage. So: no boost card, and no "when this minion activates/attacks" abilities fire. Nobody defends. The minion's ATK is dealt to the chosen enemy as attack damage, so the target's tough and retaliate still apply. Built in §3.23. That section also has the overkill, guard and targeting readings that follow from this decision. Pinned by `packages/cards/src/wave3/drax/qa.test.ts` (Tiger Shark's "After Tiger Shark attacks" doesn't fire; a villainous minion gets no boost card).
13. **A Team-Up name written "Hero/Alter-ego" (§3.34).** Heart of the Panther (`bp` 51025) prints "Team-Up (Black Panther/T'Challa and Black Panther/Shuri)". RRG 1.8 "Team-Up" (p. 43) matches a name against a character's "title or subtitle", and no title contains a slash. Implemented as naming one identity card by both sides: its hero face is the first half, its alter-ego face is the second, and it matches whichever side is up. Before this, the play check and the deckbuilding check both refused the card outright. A strict reading of p. 23 would instead require the hero side ("Black Panther") to be up. That makes no difference for the deck check, and for the play check only while one Black Panther is in alter-ego form.
14. **Found, not fixed: a card revealed by `EffectSpec revealEncounterCard` is still on top of the encounter deck while it resolves.** Found while writing §3.35's test. The effect takes the top card with `drawEncounterCard`, which returns the card without removing it, and a revealed treachery only leaves the deck in the reveal frame's `finish` stage. So a When Revealed on that card that discards, deals or reveals from the encounter deck reaches the card itself first. Every other reveal path deals the card out of the deck before revealing it: the villain phase deal and surge (`dealEncounterCardTo`). The likely fix is to deal the card to the revealing player first, as surge does. Three Core/wave 1 scripts use the effect (`core/modular/standard.ts`, `core/aspects/protection.ts`, `wave1/bkw/pack-cards.ts`), so it is flagged here for `rules-qa-engineer` rather than changed in this pass. §3.35's test is written to pass either way.
    - **Resolved (2026-09-25):** fixed in wave 4. `revealEncounterCard` now moves the card out of the deck to the
      revealing player's dealt encounter cards while it resolves, as `revealCard` does (docs/phase7-wave4.md §3.45;
      `packages/engine/src/reveal-self-move.test.ts`).
15. **Resolved (2026-09-23): a player deck resets the moment it empties.** Ruling, Apr 30, 2026 (3) answer 7, "The deck is reshuffled **before** the currently resolving card enters the discard pile", with RRG 1.8 "Player Deck" (p. 33). The engine used to reset an emptied deck on its next read, so an event that drew or discarded its player's last card was shuffled into the new deck, and the facedown encounter card came late. Now `settlePlayerDecks` (`ctx.ts`) runs after every `moveCard` out of a player's deck or into a player's discard pile. That covers every draw, discard from the deck, search and mill, because they all move cards through `moveCard`. The deck is reset (`playerDeckReset` on the log, then the facedown encounter card) as soon as it is empty and the discard pile is not, and an empty deck with an empty discard pile resets when the first card reaches the discard pile (p. 33). A draw goes on from the new deck. A discard from the deck (`discardDeckUntil`, the §3.33 cost) stops at the reset, counted by `playerDeckReset` events rather than by an empty deck. An eliminated player is marked eliminated before its zones are emptied into its discard pile, so its deck never resets. `takeTopOfDeck` still resets an empty deck it reads, but only a state built before this change (a save, a test's surgery) can hold one. Engine test: `packages/engine/src/player-deck-reset.test.ts` (7 tests, including an event that reads its deck and its dealt encounter cards right after its draw emptied the deck: 3 and 1 now, 0 and 0 before). Existing tests whose expectations changed, each because a deck now resets when it empties: four `discardDeckUntil` tests in `packages/engine/src/primitives-wave1d.test.ts` (no match, a deck emptied mid-discard, deck and discard pile both empty, and each player's deck, where p1's match was its last card), and Teen Spirit's empty-deck test in `packages/cards/src/wave1/msm/ms-marvel.test.ts`. A fifth engine test there (`discardFromHand` with a filter) had its fixture changed instead: it had left p2's and p3's decks empty by accident. Three e2e seeds play differently, each because a deck now resets (and deals its facedown encounter card) at the moment it empties instead of at its next read: `gob` Mutagen Formula solo (seed 2026; round 6's end-of-phase draw took the deck's last card, so the encounter card is revealed in that villain phase rather than the next; the loss by main scheme moves from round 10 to round 6), `gob` Risky Business solo (seed 2026; a discard of the deck's last three cards in round 12; same loss in round 14, 110 commands instead of 112), and `twc` Breakout 2-player (seed 2027; a card discarded from the deck in round 5's villain phase; the loss moves from round 12 to round 11). Every e2e game still ends and still replays deep-equal.
16. **Can an effect's "up to N" choose none (§3.41)? Decided by the user, 2026-09-23: no. An effect's "up to N" chooses at least 1 whenever a legal target exists, unless a printed "may" makes the choice optional.** This replaces the earlier reading, which allowed 0. RRG 1.8 "Cost" (p. 14) states the minimum of one only for a cost. Ruling, Mar 6, 2026 (2) lets Quick Quip's "up to 2" choose 1 and says nothing about 0. The user's decision covers that gap for effects too.
    - **In the engine:** `divide.upTo` asks for 1 to N points and offers only targets the division can affect (a scheme holding threat that can be removed, or a character that can take damage; RRG 1.8 "Target", p. 43). With none, it asks nothing and does nothing. `chooseTarget.upTo` (new) asks for 1 to `count`. `chooseTarget.optional` now means only a printed "may" (0 allowed). No current script uses it: every earlier use was either "up to" or a mandatory choice.
    - **`chooseCards`** has an explicit `min` per script, so the "up to" scripts set `min: 1`. The engine already lowers the minimum to what is available, so an empty pile still asks nothing.
    - **Not changed:** a search ("search your deck for …") can still find nothing (`min: 0`), because that is the RRG's search rule, not "up to". "Prevent up to N", "heal up to N" and "draw up to your hand size" are amounts, not choices. "Up to" in a cost (Legal Practice, "We Are Groot", Nebula's Ship, Husk, Machine Man, Energy Siphon, Firepower, The Elephant's Trunk) already required at least 1 under RRG p. 14. Tried and True prints "may add up to 3", so none stays allowed.
    - **Scripted cards this touches (13).** "Up to" choices: Muster Courage 12032, United We Stand 14031, Thunderclap 10005, Seven Rings of Raggadorr 09034, Air Supremacy 17014 (`chooseTarget` `optional` → `upTo`); Agile Flight 17029 (`divide.upTo`); G.I.R.L. 13001b, Ancestral Knowledge 01042, Censor the Past 04142 and Bruno Carrelli 05007 (`chooseCards` `min: 0` → `min: 1`). Mandatory choices that were scripted as `optional` (none print "may"): the Kang obligation 11021 ("Discard the highest-cost card you control"), Apocryphus 11040 (When Revealed and Boost), Hydra Flame-Soldier 04145 (Forced Response and Boost). They now must choose when a legal target exists, and with none they choose nothing, as before.
    - **Unscripted cards to script with `upTo`:** Flying Formation 42031, Heart of the Panther 51025, Mutant Education 37021, X-Men Instruction 37031, Safeguard 16168, Triple Threat 16177, Combat Ready 22009, Lethal Intent 22010, Quick Quip 52034, Thwip Thwip! 31017.
    - **Tests whose expectations changed**, each because none is now refused: `divide-up-to.test.ts` ("may divide none" became "refuses 0", plus a new valid-targets test), `selection-wave1.test.ts` ("up to 3" now needs 1, and a new "may" case still allows 0), `primitives-wave2d.test.ts` (Muster Courage's "taking none is legal" became "refused"), and `star-lord-kit.test.ts` (Agile Flight's single-scheme prompt minimum went from 0 to 1, plus three new Q16 tests). New: Ancestral Knowledge in `core/heroes/heroes.test.ts`. Every other test of the touched cards passes unchanged. Apocryphus 11040 has no test.
17. **Regroup and the Collector's discard redirect on the same ally (§3.45). Decided by the user, 2026-09-23: Regroup wins, and the ally goes to hand. No engine change.** Regroup is an optional Interrupt: "When an ally is defeated by an enemy attack, return it to its owner's hand instead of discarding it". Collector I–III is a Forced Interrupt: "When a card … would be placed into a discard pile from play, put it faceup into The Collection instead". Both reach the discard of a defeated ally. RRG 1.8 Appendix III resolves forced interrupts before optional ones, but only among abilities that answer the same triggering condition. The user's reasoning: Regroup triggers on the defeat, which comes before the card would ever be placed in a discard pile. So once Regroup has resolved, the Collector never triggers. The engine already works this way: Regroup's `setDefeatDestination` resolves in the defeat's interrupt window, and the Collector's redirect is a constant read only when a card actually goes from play to a discard pile (§3.14). Pinned by `packages/engine/src/regroup-wins-over-collector.test.ts`, which was the open-question pin `wave3-q17-regroup-collector.test.ts`.
18. **A card bound by "discard until" that was the deck's last card (§4 Q15). Decided by the user, 2026-09-23: it still goes to hand. No engine change.** Teen Spirit (`msm` 05001b): "Discard cards from the top of your deck until you discard a Ms. Marvel card, then add that card to your hand." If the match is the last card of the deck, discarding it empties the deck. The deck resets at once, so the match is shuffled into the new deck before "add that card to your hand" resolves. "That card" names the specific card, so the engine moves it from the new deck to the hand (`moveCards` of the bound slot), which is the behaviour the user confirmed. The other reading was that the card had left the discard pile and could no longer be found there. The rulings file is silent. Pinned by `packages/cards/src/wave1/msm/ms-marvel.test.ts`, "Teen Spirit (§4 Q18)".

19. **Resolved (2026-09-25): a player ability with nothing to choose cannot be initiated, and "Then" waits on the text before it (PLAN.md, wave 1 gap pass).** Before this, `executeChooseCards` and `requestTargetChoice` bound an empty slot and carried on, so a player could use Quinjet (`cap` 03019) with no Avenger ally in hand, and it discarded itself for nothing.
    - **The rules.** RRG 1.8 "Choose (Game Element)" (p. 12): "If a player card ability requires the choosing of one or more targets, and there are no valid targets for any part of the ability, the ability cannot be initiated." "Target" (pp. 42–43): an ability that requires a target "can only be initiated if it has at least one valid target"; a draw has a valid target while its deck holds a card; "An ability with a search effect requires only a searchable game area in order to initiate". "'Then'" (p. 44): "If the pre-'then' text of an effect does not fully resolve, the post-'then' text does not attempt to resolve."
    - **At initiation** (`abilityLacksValidTarget`, `packages/engine/src/resolve/target-validity.ts`). A player ability cannot be initiated when a required choice among its opening choices has no valid candidate and no later effect is a part of its own. Refused abilities get `no_valid_target` from `playCard` and `useAbility`, are dropped by the play-from-hand effects, `legalActions` does not offer them, and neither does any window as an optional interrupt or response.
      - **Required choice** (`isRequiredChoice`): a `chooseTarget` of a fixed count that is neither `upTo` nor `optional`, or a `chooseCards` with `min` ≥ 1 that does not read a deck. "Up to", "any number" (`min: 0`), a printed "may" and a search or look at a deck never block.
      - **A part of its own** (`hasIndependentPart`): an effect that does not name the chosen slot and is not post-"then" text. Sanctum Sanctorum (09008), "shuffle a Spell card from your discard pile into your deck **and** draw 1 card", still draws with no Spell to choose.
      - **Engine reading:** an effect that reads a value the choice's own effects bind (Into the Fray's excess damage) counts as its own part, so such an ability still initiates and resolves to nothing, as it did before.
      - **Cost-bound choices are skipped:** a choice that reads what the ability's cost binds (a `var` or slot, Shield Toss's X) is judged only as it resolves.
    - **"Then" (new `EffectSpec then { effects }`, DSL `andThen(...)`).** A required choice that finds nothing while the ability resolves marks the frame (`_then.unresolved`) and logs `choiceFoundNothing`. A later `then` in that program is skipped, and `thenSkipped` is logged. Everything else still resolves as far as it can. That is how an encounter card or a forced ability always resolves (neither is ever refused), and how a player ability resolves if its target is gone by the time the choice comes. The rule reads the text, so a `then` on an encounter card is skipped the same way; none is scripted yet.
    - **Scripts changed** (`ability-scripting-engineer` should know):
      - Quinjet (03019): "Then, discard Quinjet" is now `andThen(discard(self))`.
      - Aamir Khan (05006): "then draw 1 card" is now `andThen(draw(1))`.
      - Tinkering (16029b): "Choose and discard a tech upgrade you control → draw 2 cards" had its draw run with nothing discarded; the cost is modeled as pre-"then" text with `andThen(draw(2))`.
      - The rest of the cards that print "then" (63 scripted cards, player and encounter) are listed in `docs/then-sweep.md`, the follow-up checklist.
      - Plain "and" and new sentences stay as listed effects.
    - **Trace helper.** `@mc/cards` `testing/trace.ts` counted any read of an ability's `effects` as "it resolved". The offer-time check now reads them for merely-offered abilities, so a read from inside `abilityLacksValidTarget` is not counted.
    - **Tests.**
      - New: `packages/engine/src/choose-no-target.test.ts` (7), covering a lone choice, a post-"then" part (the Quinjet shape), the choice and its "Then" with a candidate, an independent "and draw" part (the Sanctum Sanctorum shape), a choice emptied mid-resolution skipping its "Then" with both log lines, "any number"/"up to"/search never blocking, and an encounter card resolving as far as it can.
      - New: Quinjet in `packages/cards/src/wave1/cap/captain-america.test.ts` (2): refused with no ally in hand; with Squirrel Girl, she enters play and then Quinjet is discarded.
      - Changed, each because the play is now refused: `abilities.test.ts` ("an event with no legal target for its choice" was "resolves without effect and is still discarded"); `primitives-wave1c.test.ts` (the synthetic "discard a [mental] or [physical] resource" event with neither in hand; Power Drain's own "if able" is an encounter card and still resolves as far as it can); `wave4/warm/war-machine-pack-cards.test.ts` (Vigilante Training with no Justice event in the discard pile is refused and pays nothing, where it used to exhaust and spend a counter for nothing).
    - **E2e seeds that play differently**, measured against `claude/outstanding-questions` at 353e0c40. In every case the greedy e2e driver used to spend an action on an ability with nothing to choose, and that action is now refused. Every game still ends and still replays deep-equal.
      - `twc` Breakout 2-player: Get Ready (01069) with no ally, rounds 5 and 10. Same loss in round 11, 160 → 154 commands.
      - Core Rhino, Thor (`wave1` e2e): Get Over Here! (06014) with no minion, round 1. Same loss in round 2, 28 → 29 commands.
      - `trors` Absorbing Man solo, Spider-Woman: Spider-Girl's (04040) response is not offered with no minion, round 7. Same loss in round 7, 68 → 67 commands.
      - `trors` Taskmaster solo, Hawkeye: Ready for Action (04017) with no ally, round 3. Same loss in round 3, 33 → 35 commands.
      - `toafk` Kang 2-player: Ready for Action with no ally, round 1. The main-scheme loss moves from round 2 to round 3, 40 → 56 commands.
      - `vnm` Rhino, Venom: Crew Quarters (20029) has no alter-ego to heal while Venom is in hero form (rounds 1–8), and Scare Tactic (20012) has no confused enemy in round 8. The loss changes from all players defeated in round 9 to main scheme completed in round 8, 89 → 81 commands.
      - `mts` Rhino, Adam Warlock: Battle Mage (21031a) with an empty hand, round 2. Same loss in round 3, 38 → 37 commands.
      - `warm` Rhino, War Machine: Command Team (23016) with no ally, rounds 1–3. Same loss in round 3, 35 → 30 commands.
      - `hood` The Hood 2-player: Get Ready with no ally, rounds 2, 5 and 6. The loss moves from round 9 to round 6, 174 → 105 commands, so fewer modular sets are shuffled in during play (only State of Emergency).
      - `mts` 2-player, Spectrum + Adam Warlock: Quantum Magic (21040) with an empty discard pile and Battle Mage with an empty hand. Ebony Maw: loss in round 4 → round 6, 75 → 78 commands. Hela: round 5 → 6, 89 → 92. Loki: same round 4, 77 → 76. Thanos: same round 7, 159 → 139. Tower Defense: round 4 → 6, 84 → 104.
      - Also refused, with no outcome change: Quinjet (03019) in the `cap` Rhino game (rounds 2 and 3) and Quick Strike (25018) in the `valk` Rhino game (round 3).

## 5. What this asks of the other agents

- **`card-data-pipeline`: done (2026-09-22).**
  - the A1/A2 villain stage labels, per mode, with `infiniteHp` on face 2 (§1.1), then emit `gmw`;
  - `amplifyIcons` on every card whose raw record has `scheme_amplify`, including the 17 already-emitted cards in §1.2;
  - `Hinder N[per_hero]` and `Uses (N[per_hero] …)` / `Uses (N …, plus N[per_hero] additional …)` parsed as keywords (§1.3), re-emitting `stld` 17025 and `trors` 04064;
  - the Campaign Challenge side schemes one card per face (§1.4); Gamora's `deckbuilding.offAspectAllowance` (§1.5); the errata and typos in §1.7; §4 Q3 and Q7.

  **`gmw` emitted:** `src/data/gmw/` — 179 cards from 187 raw top-level records. The gap nets out exactly:
  villain stages merge into one `VillainCard` per villain (14 top-level roman-numeral villain records → 6 cards,
  −8: four 3-stage villains merge 3→1 each, Escape the Museum's mode-labelled pair stays 2→2), main scheme stages
  merge the same way (10 top-level `…a` stage records → 5 `MainSchemeCard`s, −5), and the five Campaign Challenge
  side schemes each split into two cards (5 top-level `…a` records → 10, +5, since their hidden `…b` back faces
  aren't in MarvelCDB's top-level array at all — §1.4). 187 − 8 − 5 + 5 = 179. `pnpm --filter @mc/content ingest -- --pack gmw --offline` reproduces
  it (`GMW_CURATION` registered in `ingest-marvelcdb.ts`). Both precons (Groot/Protection, Rocket
  Raccoon/Aggression, MC16 p. 20) validate with `validateDeck` → `{ ok: true }`, checked directly against
  `CORE_CARDS` + `GMW_CARDS`. Wired into the data-only pool (`DATA_ONLY_CARDS`/`DATA_ONLY_ENCOUNTER_SETS` in
  `src/data/index.ts`, `GMW_SCENARIOS`/`GMW_STARTER_DECKS` re-exported alongside — the only data-only pack with
  scenario data of its own); not wired into `packages/client` or `packages/cards` (out of scope for this pass —
  every `gmw` ability ref is "not started" in the `pnpm refs` report, same as any other unscripted pack).

  **Survey, all six cycle 2 packs (2026-09-22):** `gmw`, `stld`, `gam`, `drax`, `vnm`, `ron` all normalize cleanly
  under their registered curation — 0 issues, 0 packs with a gap. (`mts`/`tt`/`aos` are not part of cycle 2 and
  not emitted; `mts`'s own "villain stage label is not a roman numeral" errors are gone as a structural side
  effect of §1.1's fix, confirmed via `survey.ts`, but it still isn't curated/emitted — other gaps remain.)

- **`ability-scripting-engineer`:** re-script the three `trors` "after resolving step one" main schemes on `villainStepResolved` (§3.2); script Crossbones' Machine Gun's counters away from `coveredByEngineRule` once its data carries the keyword (§1.3). Every primitive `gmw`, `stld`, `gam` and `vnm` need has landed (§3.1–§3.22, §3.24, §3.25), and §3.26 lists the wordings that compose from existing vocabulary. Moondragon (`drax` 19013), the last one in `KNOWN_SKIPPED`, was scripted with §3.23 on 2026-09-23. New vocabulary is plain data (`RuleSpec`, `EffectSpec`, `ValueSpec`, `Predicate`, trigger fields); the DSL builders for it are the scripter's to add.
- **`game-client-engineer`:** render ∞ for an ∞ face's hit points (§3.1); name `threatRemovalBlocked` reason `"patrol"` (§3.5); log lines for `surgeGranted` (§3.8), `villainFlipped.hitPointsReset` (§3.1), `controllerChanged` (§3.13), `playCostReduced` (§3.20), `interruptsPreempted` (§3.12) and `discardRedirected` (§3.14); a way to opt into a cost reduction while playing a card (§3.20); a view of a scenario area such as The Collection (§3.14).
- **`rules-qa-engineer`:** pin Crossbones' Machine Gun (§1.3) and the three `trors` step-one schemes (§3.2) with scenario tests; §4 Q1 and Q4.
