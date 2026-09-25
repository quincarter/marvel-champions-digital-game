# Phase 7 working spec: wave 4 (cycle 3)

This is the shared brief for every agent working Phase 7's fourth content wave:

- `card-data-pipeline`, `game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`
  and `game-client-engineer`.
- It turns wave 4's scope into schema decisions (§1), per-pack setup needs (§2), and a prioritized list of engine
  primitives (§3), each with a status.
- The models are `docs/phase7-wave1.md`, `docs/phase7-wave2.md` and `docs/phase7-wave3.md`, whose §3 primitives are
  assumed. The definition of done is `docs/wave-definition-of-done.md`: **the box's campaign ships in this wave.** If
  you change a decision here, update this file in the same change.

**Wave 4** is cycle 3, The Mad Titan's Shadow. RRG 1.8 Appendix VI (p. 71) lists its wave 4 as "The Mad Titan's Shadow
campaign expansion, the Nebula Hero Pack, the War Machine Hero Pack, the Valkyrie Hero Pack, and the Vision Hero Pack".
The Hood, a scenario pack with no player cards, is released in the same window. In release order (Hall of Heroes dates;
`docs/phase7-wave4-sources.md` §1):

| Pack     | Product                       | Released     | State today                                       |
| -------- | ----------------------------- | ------------ | ------------------------------------------------- |
| `nebu`   | Nebula hero pack              | Sep 17, 2021 | emitted, data only                                |
| `mts`    | The Mad Titan's Shadow (MC21) | Oct 29, 2021 | **not emitted** (§1, 26 survey lines)             |
| `warm`   | War Machine hero pack         | Nov 12, 2021 | emitted, data only                                |
| `hood`   | The Hood scenario pack        | Nov 26, 2021 | emitted, data only; no scenario record yet (§2.3) |
| `vision` | Vision hero pack              | Jan 14, 2022 | emitted, data only; **Dense face missing** (§1.2) |
| `valk`   | Valkyrie hero pack            | Jan 21, 2022 | emitted, data only                                |

- **The brief's order was `mts, nebu, warm, hood, valk, vision`.** By the dates, Nebula precedes the box (its Aug 27 US
  release slipped to Oct 29) and Vision precedes Valkyrie. Nothing here depends on the order; the box is still first
  in priority (§3).
- **The box's content** (MC21 p. 2): Spectrum, Adam Warlock, five scenarios (Ebony Maw, Tower Defense, Thanos, Hela,
  Loki), modular sets (Black Order, Armies of Titan, Children of Thanos, Infinity Gauntlet, Legions of Hel, Frost
  Giants, Enchantress) and The Mad Titan's Shadow Campaign set (cards 180–193).
- **The Hood** has no "Ghost Rider" set. Its sets are The Hood, nine modulars (Beasty Boys, Brothers Grimm, Crossfire's
  Crew, Mister Hyde, Ransacked Armory, Sinister Syndicate, State of Emergency, Streets of Mayhem, Wrecking Crew) and the
  Standard II / Expert II difficulty sets.

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules
Reference; FFG rulings clarify both):

1. **Card text and product rules.** The Mad Titan's Shadow rulebook (MC21) is
   `docs/campaign-modes/mc21_the_mad_titans_shadow_rulebook-compressed.pdf`, converted page by page in
   `docs/campaign-modes/markdown/mc21_the_mad_titans_shadow.md`. Cited as "MC21 p. N" by the PDF page the conversion
   labels (wave 3 used the same convention). Its "Swapping Loki" section on p. 24 is lost to a graphic callout in the
   conversion; its rules clarification on the same page survives and is quoted in §3.7.
   - **Not in the repo:** the Nebula, War Machine, Valkyrie, Vision and The Hood inserts (linked from their Hall of
     Heroes pages). Each is needed for its precon (§2.1) and The Hood's for Standard II / Expert II (§4 Q5).
2. **FFG rulings, Dec 17, 2025 to Aug 13, 2026**, in `marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading
   (grep with the `**` markup stripped). The ones that touch cycle 3, each checked: Dec 17, 2025 (1) #3 (Beguiled is a
   status change), Dec 17, 2025 (4) #2 (Odin removed from the game), Jan 17, 2026 (4) #2 (two Gauntlet Guns, two ammo
   counters), Jan 17, 2026 (5) (Cosmic Entity events with several encounter decks), Jan 26, 2026 (4) #5 and #7 (a Drone's
   facedown side; Valkyrie hero vs. ally), Feb 28, 2026 (3) (swapping Lokis moves permanent attachments), Feb 28, 2026
   (8) #1 (Infinity Stones into The Collection), Mar 19, 2026 (4) (the Valkyrie ally in a Valkyrie deck), Jun 25, 2026
   (4) #1 and #5 (Old Rivals; Odin attached is not friendly), Aug 3, 2026 (4) #1 (Odin attached takes no attachments).
3. **RRG 1.8 (Jul 2026)**, `mc_rulesreference_v18_compressed.pdf`, cited by printed page (PDF page index + 1, checked
   with `pypdf`). The text is grepped in `mc_rulesreference_v18_compressed.md`, which has no page markers. Cycle 3's FAQ
   is on p. 62 and its errata on p. 67. New or first-used entries: "Form, Change Form" (p. 21), "Alliance" (p. 6),
   "Steady" (p. 41), "'Swap'" (p. 42), "Flip" (p. 20), "Double-Sided Card" (p. 17), "Standard Set" / "Expert Set"
   (pp. 40, 19), "Villain Defeat" (p. 47).
4. **`docs/phase7-wave4-sources.md`**, the tracker's index of inserts, errata, taboo and rulings, verified and corrected
   in place by this pass (2026-09-24). Its §4 lists the cycle 3 errata the pipeline applies (§1.13).

`packages/content/raw/marvelcdb/{mts,nebu,warm,hood,valk,vision}.json` point to card text and stats. They are not an
authority; card images were checked where the raw data and the card disagree (§1.3).

---

## 1. Schema decisions (owner: `game-rules-architect`)

> Status: **landed (2026-09-24)** in `packages/content/src/schema/**`, with fixtures in
> `packages/content/src/schema/wave4.test.ts` (16 tests) and `packages/engine/src/max-copies-per-title.test.ts` (3
> tests, `validateDeck` enforcing §1.4). New: `KeywordInstance form`, `IdentityDeckbuilding.maxCopiesPerTitle`,
> `MainSchemeStage.villainOf`, `MultipleVillains.encounterDecks: "shared"`, `BaseCard.otherFaceId`, `ModeOnly` /
> `modeOnly`, `EncounterSet.classification` / `separateDecks` / `singleVillainOnly` (and `validateEncounterSet`),
> `ScenarioSeparateDeck.contents.trait` and `cardType: "environment"` (the engine's `buildScenarioDeck` reads both),
> `Scenario.startingVillain` / `victoryCondition` / `setAsideModularSetCount`. No emitted card changed; every pack still
> validates. **Data only until §3:** `encounterDecks: "shared"`, `otherFaceId`, `modeOnly`, `separateDecks` on a set,
> `startingVillain`, `victoryCondition` and `setAsideModularSetCount` are not read by the engine yet, so no scenario
> using them may be marked playable before its §3 section lands. `maxCopiesPerTitle` and the form keyword's validation
> are enforced now.

**The survey** (`scripts/marvelcdb/survey.ts --pack mts nebu warm hood valk vision`, 2026-09-24): `nebu`, `warm`, `hood`,
`valk` and `vision` normalize cleanly; `mts` has 26 lines (dash costs 3, attach rules 6, unlinked records 8, side
schemes with foreign backs 3, missing art 4, a boost star 1, "not this set's villain" 1). "Clean" is not "right":
§1.1, §1.2 and §1.8 are data errors in packs that survey clean.

> **Pipeline status: landed (card-data-pipeline, 2026-09-24).** `mts` is emitted (`packages/content/src/data/mts/**`,
> curation in `curation/mts.ts`, registered in `ingest-marvelcdb.ts`), wired into `DATA_ONLY_CARDS`/
> `DATA_ONLY_ENCOUNTER_SETS` (`data/index.ts`), 191 cards from 202 raw records (9 dropped aggregates, the normal
> shape — see each subsection below for the per-issue fix and §1's own new field, `artUnavailable`, which the
> 26-line survey didn't anticipate). Every other pack still normalizes cleanly (`pnpm --filter @mc/content ingest --
--all --dry-run --offline` unaffected). Both box precons (Spectrum, Adam Warlock) validate under `validateDeck`/
> `requiredIdentitySet` (`packages/cards/src/wave4-precon-legality.test.ts`, 29 tests). The five scenarios and
> `MTS_CAMPAIGN` (`data/mts/campaign.ts`, the `gmw`/`trors` shape) are data; none is playable yet (§3's own gate).
>
> **One further schema-adjacent gap found and closed in this pass, not in the original 26-line list:**
> `PackCuration.artUnavailable` (`curation/types.ts`) — six MarvelCDB records (`21136b`, `21137b`, Hela's own hidden
> linked back faces, and four campaign-card backs: `21182b`, `21184b`, `21186b`, `21189b`) have no artwork reference
> anywhere on MarvelCDB (checked on the live API, not just the cached raw file) and no independently-viewable second
> source could be found either. Rather than block the whole box on six of 202 records, `checkCoverage` (`normalize/
checks.ts`) now honours a per-code, per-reason exemption instead of hard-failing, resolved via a new
> `NormalizeContext.faceCodesByCardId` map (populated explicitly in `normalize/villains.ts` for every villain
> shape, and automatically for any single-record card, whose one face is always its own code) — mirrors the stale-
> `imageOverrides` check both ways (errors on an unmatched entry, and on an entry that matches a face that already
> has art). The client's existing missing-art fallback (`packages/client/src/art/art-source.ts`'s `artFor` returning
> `null`, `card-art.ts`'s `request` treating that as "no texture") already draws a generated frame for exactly this
> shape — proven for a villain stage specifically by a new case in `art-source.test.ts`. See `curation/mts.ts`'s own
> header comment and its `artUnavailable` entries for the search each of the six documents.

### 1.1 The form keyword: "Energy form." / "Mass form." (`KeywordInstance form`)

RRG 1.8 "Form, Change Form" (p. 21): "Cards with the '[type] form' keyword grant an identity unique forms." MC21 p. 2
calls them "Additional Forms". So "Energy form." is a keyword with a parameter, not an ability.

- **New `KeywordInstance { name: "form"; formType: string }`**, `formType` lower case: "Energy form." → `"energy"`
  (Gamma, Photon, Pulsar, `mts` 21002–21004), "Mass form." → `"mass"` (Intangible/Dense, `vision` 26002; Solid/Phased,
  `mut_gen` 32031a/b), "Suit form." → `"suit"` (Assault/Stealth, `aos` 50035a/b).
- **Parser (pipeline):** a leading `"<Word> form."` sentence becomes the keyword. Today it becomes the first
  "-constant" ref (`26002.intangible-constant`), which no script can fill.

### 1.2 Vision's Dense face is dropped (data bug)

`vision` 26002 is one double-sided upgrade: raw `double_sided: true`, `back_name: "Dense"`, `back_text: "Mass form.
Permanent. While in hero form, Vision gets +2 ATK and +2 DEF. Response: After you change to this mass form, draw 1
card."`, `backimagesrc`. The normalizer reads `back_*` only for encounter cards, so the emitted card has no `flipSide`
and Vision can never be Dense. It is the only emitted player card with a `back_text` (checked across every raw pack).
**Pipeline:** emit `flipSide` from the `back_*` fields for player cards (`PlayerCardCommon.flipSide` exists, wave 2
§1.5), with `form` keywords on both faces (§1.1).

### 1.3 Spectrum's energy forms print a dash cost

Gamma, Photon and Pulsar (21002–21004) have no raw `cost`. The printed card (Gamma, `marvelcdb.com/bundles/cards/21002.png`,
viewed in a scratch folder and not stored) shows "—". So `cost: 0, specialCost: "dash"` (wave 2 §1.3; RRG 1.8 "Dash
(Value)", p. 15: it "cannot be played and can only enter play through other means"). The same card prints "After you
change to this **energy** form", where raw reads "this form": a curation correction for all three.

### 1.4 Adam Warlock's deckbuilding (`IdentityDeckbuilding.maxCopiesPerTitle`)

Adam Warlock (21031b), Avatar of Life: "During deck-building, your deck must include an equal number of cards from all 4
aspects. You cannot include more than 1 copy of any non-Adam Warlock card." MC21 p. 3: "he cannot include more than one
copy of any aspect card in his deck" and "his pre-built deck includes many powerful cards that are unique or 'Max 1
per deck'" (the precon includes a basic card, Martinex, once).

- The first sentence is the existing `aspectCount: 4` and `equalCardsPerAspect: true` (the Spider-Woman fields).
- **New `IdentityDeckbuilding.maxCopiesPerTitle?: number`**: every card outside the identity's own set is limited to
  that many copies by title, aspect and basic alike. `validateDeck` reports `deck_limit` past it.
- **Data:** 21031a gets `{ aspectCount: 4, equalCardsPerAspect: true, maxCopiesPerTitle: 1 }`.

### 1.5 A main scheme that belongs to a villain: `MainSchemeStage.villainOf`

Tower Defense's two main schemes print "Proxima Midnight's Scheme." (21098b) and "Corvus Glaive's Scheme." (21099b).
MC21 p. 10: "Stage 1B is identified as Proxima Midnight's scheme, and stage 2B is identified as Corvus Glaive's
scheme. When either of the two villains schemes, place the threat on their matching main scheme card only." The
main-scheme sibling of `SideSchemeCard.signatureOf` ("Wrecker's Side Scheme.").

- **New `MainSchemeStage.villainOf?: string`**, the villain's title. The sentence needs no ability ref.

### 1.6 Two villains sharing one encounter deck: `MultipleVillains.encounterDecks: "shared"`

The Wrecking Crew (`MultipleVillains`, wave 1 §1.1) gives each villain its own encounter deck. Tower Defense has one
("Encounter Deck: Tower Defense, Armies of Titan, and Standard sets", MC21 p. 10), two villains, one active villain.

- **`MultipleVillains.encounterDecks` gains `"shared"`**; with it `ScenarioVillain.encounterSetIds` may be empty and the
  scenario's own `encounterSetIds` build the one deck. `activation: "activeVillainOnly"` and `winCondition:
"allVillainsDefeated"` are unchanged. Which villain is active is Focused Defense's rule (§3.2), not data.
- **Parser:** "Attach to Corvus Glaive." (21104) failed because the set has two villains; it is `AttachmentHost
{ kind: "namedVillain", name }`, which exists.

### 1.7 A card whose faces are two separately emitted cards: `BaseCard.otherFaceId`

Five campaign side schemes print "When Defeated: … Flip this card over." with a back of another card: Secure the
Landing Pad → Cosmo (ally, 21180a/b), Save the Shawarma Place → Black Swan (minion, 21182a/b), Open the Dungeons →
Jormungand (attachment, 21189a/b); Hack Sanctuary's Computer → Defensive Protocols and Find the Norn Stones → Retrieve
Odin's Armor (side schemes, 21184a/b, 21186a/b). `SideSchemeCard` has no `flipSide`, and a `CardFlipSide` cannot carry
another card type's stats. Wave 3 §1.4 already emits a side scheme's two faces as two cards (16178a/b), with no link.

- **New `BaseCard.otherFaceId?: CardId`**, set on both faces, naming the other. Emitting each face with its own type
  keeps every face's schema exact (Cosmo is a real `AllyCard` with `specificTo: campaign`).
- The engine flips such a card by replacing the instance's card with the other face (§3.10): RRG 1.8 "Flip" (p. 20),
  "A different card type from the previous face, all attached cards, tucked cards, status cards, and tokens are
  discarded from the card." A double-sided card never goes to a discard pile (RRG 1.8 "Double-Sided Card", p. 17).
- **Pipeline:** emit `otherFaceId` on 21180a/b, 21182a/b, 21184a/b, 21186a/b, 21189a/b, and back-fill wave 3's 16178a/b–
  16182a/b (their faces are chosen by mode, not flipped, but they are one card).

### 1.8 "Standard Mode Only" / "Expert Mode Only" faces: `modeOnly`

RRG 1.8 "Double-Sided Card" (p. 17): "If a double-sided card has 'Standard Mode Only' and 'Expert Mode Only' sides, it
is put into play with the 'Expert Mode Only' side faceup if the players are playing expert mode." Formidable Foe (`hood`
24049a/b) is emitted with the sentence as ability refs (`24049a.formidable-foe-constant`), so the engine cannot read it.

- **New `modeOnly?: "standard" | "expert"`** on `EncounterCardCommon` and `CardFlipSide`. The sentence needs no ref.
- Seventeen raw cards print it: `hood` 24049a/b, `gmw` 16178a/b–16182a/b (wave 3 §1.4's split side schemes, which may
  carry it too), `sm` 27174a/b, `next_evol` 40081a/b.

### 1.9 Standard II and Expert II: `EncounterSet.classification`

RRG 1.8 "Standard Set" (p. 40): "The standard set is not a modular encounter set and cannot be selected (by the players
or randomly) when a scenario requires players to choose a modular encounter set", and "Cards in the 'Standard'
classification are any cards that have the word 'Standard' printed by the bottom of the card". "Expert Set" (p. 19)
likewise. Standard II and Expert II print "Standard II" / "Expert II", so they are that classification.

- **New `EncounterSet.classification?: "standard" | "expert"`**: such a set is never a modular choice
  (`validateScenario`, and The Hood's "Choose 7 modular encounter sets"). Emit it on `standard_ii`, `expert_ii`, and on
  Core's `standard` and `expert` for uniformity.
- Whether a game uses Standard II instead of or beside Standard is a setup choice the insert states (§4 Q5); the
  scenario's `standardEncounterSetIds` is unchanged.

### 1.10 A modular set that brings its own deck: `EncounterSet.separateDecks`

MC21 p. 16: "When using the Infinity Gauntlet set in a scenario, attach the Infinity Gauntlet attachment card to the
villain during setup. If there is more than one villain (or no villain) in play at the start of the game, The Infinity
Gauntlet set cannot be used. After attaching the Infinity Gauntlet to the villain, shuffle the six Infinity Stone
environment cards together and set them aside, facedown. This is the 'Infinity Stone deck.' The Infinity Stone deck
has its own discard pile. […] If the Infinity Stone deck is ever empty, shuffle the Infinity Stone deck discard pile
back into the Infinity Stone deck. There is no built-in penalty for doing this." The set "may be used in other
scenarios", so the deck belongs to the set, not to Thanos's or Loki's `Scenario`.

- **New `EncounterSet.separateDecks?: readonly ScenarioSeparateDeck[]`**, built at setup whenever the set is in the
  game. `ScenarioSeparateDeck.contents` gains `trait?: Trait` (Infinity Stone) beside `cardType`, whose union widens to
  `"side_scheme" | "environment"`.
- **New `EncounterSet.singleVillainOnly?: true`**: `validateScenario` and setup refuse the set with `multipleVillains`.
- Infinity Gauntlet set: `separateDecks: [{ name: "Infinity Stone", contents: { encounterSetIds: [infinity_gauntlet],
trait: INFINITY_STONE }, discardPile: "own", whenEmpty: "reshuffleDiscardWithoutPenalty" }]`.

### 1.11 Loki: a random starting villain and a victory count

MC21 p. 24: "choose one Loki villain card at random, reveal it and put it into play. Set the remaining four versions of
Loki aside", and "The number of different versions of Loki that must be defeated is determined by the players before
the game begins. […] Rookie Mode – One version of Loki; Standard Mode – Two versions; Expert Mode – Three versions;
Heroic Mode – Four versions." 21165b: "If the number of Lokis in the victory display is equal to the victory condition,
the players win the game."

- **New `Scenario.startingVillain?: "random"`**: the villain put into play at setup is chosen with the game's seeded
  RNG from `villainCardId` and `setAsideVillainCardIds`; the rest are set aside. Each Loki is its own one-stage
  `VillainCard` (five titles "Loki", the Kang shape).
- **New `Scenario.victoryCondition?: { standard: number; expert: number; skirmish?: number; heroic?: number }`**,
  read by the new `ValueSpec victoryCondition` (§3.7). Loki: `{ skirmish: 1, standard: 2, expert: 3, heroic: 4 }`.
- `victory: "cardAbility"`: defeating a final villain stage does not win; the stage's `stateCheck` does.

### 1.12 The Hood's set-aside modular sets: `Scenario.setAsideModularSetCount`

Making Connections 1A (24004a): "Choose 7 modular encounter sets and set them aside (you may choose randomly). Choose 1
of those sets at random, then shuffle it into the encounter deck." Mojo's Wheel of Genres reads "set-aside modular
encounter sets" too (`mojo` 39026a/b).

- **New `Scenario.setAsideModularSetCount?: number`**: that many modular sets are chosen at setup and put in
  `encounterSetAside`, grouped by set. `modularSetCount` is 0 for The Hood; the 1A `Setup:` shuffles one in (§3.18).

### 1.13 Other data notes for the pipeline

- **Errata to apply** (RRG 1.8 p. 67): Sanctuary (21116), Infinity Gauntlet (21129; raw lacks "Attach to the villain",
  and its "Setup [star]" is a formatting break), Eros (22011), Cosmo (22020; raw already current), Old Rivals (22031),
  James Rhodes (23001b), Aragorn (25007), Shieldmaiden (25011; Defense trait), Beguiled (25031; Condition trait),
  Machine Man (26022). The rulebook errata (MC21 p. 10) is scenario rules, applied in §3.2.
- **Attach rules the parser missed:** Restrained 21083 "Attach to a friendly character with the highest ATK and exhaust
  it." → `superlative { among: "friendlyCharacter", order: "highest", measure: "atk" }` plus the "exhaust it" ref;
  Focused Defense 21101 → `mainScheme` (put into play by 2A); Fallen Warrior 21153 → `ally` (put into play by its own
  When Revealed); Frozen 21158 prints "Attack to your identity" in raw, a typo for "Attach" (check the image).
- **Rain Fire 21109:** raw `boost_star: false` but its text has a Boost ability; confirm the star from the image.
- **Encounter allies.** Odin (21139a/b; Captive / King faces of one ally, `flipSide`) is a scenario-specific ally like
  Taskmaster's captives (`specificTo: { kind: "scenario" }`). Cosmo 21180b and the four Captive allies 21190–21193 are
  `specificTo: { kind: "campaign" }`.
- **Campaign cards (180–193)** are emitted with the box: `specificTo: campaign` on player cards, `campaignSpecific` on
  "The Mad Titan's Shadow Campaign" set. MC21 p. 4: "Cards 180–193 … cannot be included in any deck unless playing The
  Mad Titan's Shadow campaign and the players were directed to add them".
- **Cycle id.** `nebu`, `warm`, `hood`, `valk` and `vision` use `cycle: { id: "cycle4", name: "Cycle 4", order: 4 }`,
  following MarvelCDB's `pack_wave: 4`. `mts` joins them; the name may become "The Mad Titan's Shadow" for all six, as
  `stld` did for cycle 2 (a label, not a disagreement with FFG's numbering).

### 1.14 Keywords

Cycle 3 prints **Alliance** and **Steady** for the first time and introduces the **form** keyword (§1.1); everything
else is older. MC21 p. 13's "Important Keywords" list is a reminder list, not new keywords
(`docs/phase7-wave4-sources.md` §2.2).

| Keyword  | Printed forms                                          | Cards                                                        |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| Form     | "Energy form." / "Mass form."                          | 21002–21004; 26002 (both faces)                              |
| Alliance | "Alliance." (with reminder text on some)               | 23032, 23034, 25033, 25036, 26035 (and 9 later-pack cards)   |
| Steady   | "The Hood gains … steady"; "Each enemy gains steady"   | 24008, 24049a/b, 24063 (granted; the engine implements it)   |
| Victory  | "Victory N." on side schemes, minions and **villains** | 21116, 21140–21145, Loki 21160–21164, campaign cards         |
| Hinder   | "Hinder 1[per_hero]." / "Hinder 2[per_hero]."          | 21110, 21116, 21140–21142, 21166–21169, 22… (all per player) |

---

## 2. Per-pack setup needs, standalone and campaign

RRG 1.8 Appendix II (p. 51) with the wave 1–3 engine. Step 13, "Campaign Setup", is used only in campaign mode.

### 2.1 Hero packs

| Pack     | Identity                              | Obligation                    | Nemesis set (nemesis minion in bold)                                                     | Other setup and legality                                                                                    |
| -------- | ------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mts`    | Spectrum / Monica Rambeau (21001a/b)  | Loss of Control (21026)       | **Radioactive Man** (21027), Reactor Meltdown, Sap Power ×2, Radioactive Blast           | Setup: "Put all 3 energy form upgrades into play, facedown" (§3.1). Precon Spectrum/Leadership (MC21 p. 3). |
| `mts`    | Adam Warlock (21031a/b)               | Regeneration Cycle (21066)    | **The Magus** (21067), Universal Church of Truth, Zealot of Truth ×2, Cosmic Inquisition | Deckbuilding §1.4. Precon "all four aspects" (MC21 p. 3). Cosmic Entity events (§3.14).                     |
| `nebu`   | Nebula (22001a/b)                     | Inferiority Complex (22027)   | **Gamora** (22028), Self-Preservation, Lethal Weapon, Old Rivals ×2                      | Precon from the insert (not in repo).                                                                       |
| `warm`   | War Machine / James Rhodes (23001a/b) | Equipment Malfunction (23028) | **Living Laser** (23029), Deadly Light Show, Laser Strike ×3                             | Ammo counters on the identity. Precon from the insert.                                                      |
| `vision` | Vision (26001a/b)                     | Corrupted Programming (26028) | **Ultron** (26029), Ultron Unleashed, Ultron Drones, Relentless Android ×2               | Setup: mass form upgrade into play, Intangible side up (§1.2, §3.1). Drones exist (Core Ultron).            |
| `valk`   | Valkyrie / Brunnhilde (25001a/b)      | Trouble in Otherworld (25028) | **Enchantress** (25029), Powerful Enchantments, Beguiled, Seduced ×2                     | Setup: "Set the Death Glow upgrade aside, out of play" (§3.22).                                             |

- **Same title, different cards:** Gamora the ally (22002) and the nemesis minion (22028, "discard the Gamora ally from
  play"); the Enchantress minion in `valk` and in `mts`'s Enchantress modular (25029 / 21177); Cosmo (22020, the `stld`
  reprint) and the campaign Cosmo (21180b); Avengers Tower support (21020) and environment (21100a/b, "The unique rule
  does not apply to Avengers Tower", MC21 p. 11); Corvus Glaive / Proxima Midnight / Ebony Maw as villains and as
  Children of Thanos minions.
- **Precons.** Only the box's two are printed in the repo (MC21 p. 3). The four hero packs' come from their inserts.
- **Status (card-data-pipeline, 2026-09-24):** both `mts` precons emitted (`spectrum-leadership`, `adam-warlock-all-
aspects`, `curation/mts.ts`'s `starterDecks`), verified legal (`wave4-precon-legality.test.ts`). Spectrum's own
  printed lists (MC21 p. 3) sum to 43 cards, not 40 — transcribed verbatim rather than force-fit, flagged in §4.
  Adam Warlock's `21031a` carries `{ aspectCount: 4, equalCardsPerAspect: true, maxCopiesPerTitle: 1 }` (§1.4).

### 2.2 The Mad Titan's Shadow scenarios

Villain decks are I–II standard and II–III expert, except Hela (one card per mode, wave 3 §1.1) and Loki (five
stage-I cards, §1.11).

| Scenario      | Main scheme deck                                          | Encounter sets (required) + modulars                                 | 1A Setup / scenario rules                                                                                                                                                             | Needs (§3)                                  |
| ------------- | --------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Ebony Maw     | Attack on Knowhere → The Power Stone (2B loses)           | Ebony Maw, Standard; Black Order, Armies of Titan                    | 1B: each player discards from the encounter deck until a Spell and puts it into play in their play area.                                                                              | §3.15, §3.16, §3.20                         |
| Tower Defense | Under Siege 1 and The Armies of Thanos 2 **both in play** | Tower Defense, Standard; Armies of Titan                             | "Reveal stage 2A and put it into play next to this stage so there are two main schemes and two villains in play." Avengers Tower, Focused Defense.                                    | §3.2, §3.3, §3.4, §3.5                      |
| Thanos        | The Infinity Stones → Balance the Scales (2A loses)       | Thanos, Infinity Gauntlet, Standard; Black Order, Children of Thanos | 1B: top card of the Infinity Stone deck into play; reveal Sanctuary.                                                                                                                  | §3.6, §3.11, "from player cards" damage     |
| Hela          | Odin's Torment (single stage)                             | Hela, Standard; Legions of Hel, Frost Giants                         | "Attach Odin to the main scheme, captive side faceup. Reveal Gnipahellir and Garm. Set Gjallerbru, Skurge, Hall of Nastrond, and Nidhogg aside."                                      | §3.8, §3.9; ∞ villain (landed, wave 3 §3.1) |
| Loki          | All Hail King Loki (single stage)                         | Loki, Infinity Gauntlet, Standard; Enchantress, Frost Giants         | "Set each copy of the Loki villain aside … Put the War in Asgard side scheme into play. … Reveal 1 set-aside Loki villain at random. Reveal the top card of the infinity stone deck." | §3.6, §3.7, §3.9                            |

- **Modular sets** (MC21 pp. 6, 10, 16, 20, 24): Black Order, Armies of Titan, Children of Thanos, Infinity Gauntlet
  (single-villain scenarios only), Legions of Hel, Frost Giants, Enchantress.
- **Tower Defense's optional setup damage** on Avengers Tower (1/2/3 per player by difficulty, MC21 p. 11) is a
  suggested difficulty option, not a rule; standalone play uses 0 unless a setup option is added (§4 Q4).

**Status (card-data-pipeline, 2026-09-24):** all five emitted as `Scenario` records (`curation/mts.ts`'s own
`evidence` field cites the exact printed sentence per scenario) and importable (`MTS_SCENARIOS`), data-only per
§1's own status note (none is playable until its §3 primitives land).

- `ebony-maw`: `villainSetCode: "ebony_maw"`, `modularSetCount: 2`, ordinary single-villain shape.
- `tower-defense`: `multipleVillains.villainCardCodes: ["21092", "21095"]` (Proxima Midnight I, Corvus Glaive I) —
  needed because both villains share one `card_set_code` (`tower_defense`) with colliding stage numbers, the same
  shape `normalizeVillains` already gives Kang/Sinister Six, so `villainSetCodes` alone can't disambiguate them
  (§1.6's own new `MultipleVillainsCuration.villainCardCodes` field). `encounterDecks: "shared"`.
- `thanos`: `additionalEncounterSetCodes: ["infinity_gauntlet"]`; the Infinity Stone deck itself is on the
  `infinity_gauntlet` `EncounterSet`, not this scenario (§1.10).
- `hela`: `villainCardCode: "21136a"` (the A1/standard face, wave 3 §1.1's mode+face shape), `villainStages: {
standard: [1, 1], expert: [1, 1] }`.
- `loki`: `villainCardCode: "21160"`, `setAsideVillainCardCodes: ["21161", "21162", "21163", "21164"]`,
  `startingVillain: "random"`, `victoryCondition: { skirmish: 1, standard: 2, expert: 3, heroic: 4 }`,
  `victory: "cardAbility"` (§1.11).

#### Campaign (MC21 pp. 4, 7, 13, 17, 21, 25)

`packages/cards/src/campaigns/mts.gate.test.ts` wrote MC21 against the frozen campaign foundation with synthetic ids
and found it fits. Checked against the real cards:

| Scenario      | Campaign setup                                                                                                           | Campaign victory                                                                                         | What the real cards add                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ebony Maw     | Secure the Landing Pad into play; Security Breach shuffled in                                                            | Cosmo if Secure the Landing Pad was defeated; Security Breach if 1B completed; HP (expert)               | Secure the Landing Pad flips into the Cosmo ally (§1.7, §3.10). Security Breach puts a random hand card facedown on itself.                                                       |
| Tower Defense | Save the Shawarma Place into play; Security Breach if pooled; HP; token heal on **one of** the main schemes              | Shawarma; Black Swan if not in the victory display; Avengers Tower Damaged; HP                           | Save the Shawarma Place flips into the Black Swan minion (§3.10), which "engages the first player".                                                                               |
| Thanos        | Hack Sanctuary's Computer; Cosmo, Security Breach, Shawarma, Black Swan if pooled; HP; 3 damage if the Tower was Damaged | System Shock if Defensive Protocols not in the victory display; Infinity Stones 1B completed             | Hack Sanctuary's Computer flips into Defensive Protocols (a side scheme, §3.10).                                                                                                  |
| Hela          | Find the Norn Stones; Summoned Back; Shawarma, System Shock if pooled; discard half deck if 1B completed                 | Norn Stone if Find the Norn Stones was defeated; Odin if Retrieve Odin's Armor is in the victory display | Find the Norn Stones flips into Retrieve Odin's Armor. System Shock needs an ability active in hand (§3.13) and "You cannot choose to discard this card from your hand" (§3.13).  |
| Loki          | Open the Dungeons; Summoned Back; pooled cards; Norn Stone on its Setup side; Odin on his King side                      | Campaign won; expert: losing loses the campaign                                                          | Open the Dungeons flips into Jormungand ("Attach to Loki", +4[per_hero] hit points). Odin's King side is his back face (21139b): the gate's modeling choice 6 needs a `flipCard`. |

- **Expert campaign** (MC21 p. 25): record remaining hit points capped at base; heal to full by an acceleration token;
  "If a player is defeated during a scenario that their teammates go on to win, the defeated player does not
  participate in any of the victory steps for that scenario. However, they can rejoin their teammates for the next
  scenario by placing an acceleration token on the main scheme." The gate records a defeated player's hit points as 0
  and lets every player decline the heal, so a defeated player who declines would start with 0 hit points and be
  defeated at once. §4 Q6.
- **Beyond the frozen foundation**, the campaign needs only card-level primitives: §3.10 (faces of different types),
  §3.13 (hand abilities, "cannot choose to discard") and Security Breach's "places a random card from their hand
  facedown here … Return each facedown card here to its owner's hand", which `tuckCards` may cover (to verify with the
  script). No `CampaignOp` change.
- **Status (card-data-pipeline, 2026-09-24):** cards 180-193 are emitted with `specificTo: campaign` (player cards)
  or as part of the `campaignSpecific: true` `mts_campaign` `EncounterSet` (encounter-side cards), per §1.13. The
  five flip pairs (§1.7) are emitted as `otherFaceId`-linked cards. `MTS_CAMPAIGN` (`data/mts/campaign.ts`, the
  `GMW_CAMPAIGN`/`TRORS_CAMPAIGN` hand-authored shape) names the five scenarios in box order and the
  `mts_campaign` set, but is deliberately not added to `data/index.ts`'s `CAMPAIGNS` aggregate — that list gates
  on a box being "ingested **and scripted**" (`data/index.ts`'s own comment on `CAMPAIGNS`), and `mts`'s campaign
  _instructions_ (the `CampaignDefinition` DSL — what each scenario's setup/victory does, System Shock's hand
  ability, each flip) are `ability-scripting-engineer`'s work, not emitted here. `MTS_CAMPAIGN` is importable
  directly in the meantime, and `packages/cards/src/campaigns/mts.gate.test.ts`'s synthetic-id run above still
  stands as the pre-check for that follow-up.

### 2.3 The Hood scenario

| Scenario | Main scheme deck                                                  | Encounter sets                           | 1A Setup                                                                                                                                                   | Needs (§3)                      |
| -------- | ----------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| The Hood | Making Connections → Promised Prosperity → Crime State (3B loses) | The Hood, Standard; 7 set-aside modulars | "Choose 7 modular encounter sets and set them aside (you may choose randomly). Choose 1 of those sets at random, then shuffle it into the encounter deck." | §1.12, §3.18, Foul Play (§3.23) |

- `hood` has no `Scenario` record yet (`curation/hood.ts`: "scenario curation is a follow-up").
- "Each player must resolve The Hood's 'Foul Play' ability in player order": `resolveSpecials` with a scoped player
  (§3.23).

---

## 3. Engine primitives for cycle 3 (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names below say where each primitive is
needed, and each section names cards from other packs that compose with it.

**Priority order.** The box first (its scenarios, then its heroes, then its campaign), then the hero packs and The Hood
in release order. Within that, rules the whole box leans on come first. **A pack whose cards need an unbuilt primitive
stays data only.**

| §    | Primitive                                                                | Needed by                                                                    | Status  |
| ---- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------- |
| 3.1  | Additional forms (the form keyword)                                      | Spectrum, Vision; Shadowcat, Nick Fury                                       | landed  |
| 3.2  | Two main schemes in play, each paired with a villain; Focused Defense    | Tower Defense                                                                | landed  |
| 3.3  | Villains protected by each other's hit points: one defeat sweep          | Tower Defense; Four Horsemen (`aoa`)                                         | landed  |
| 3.4  | A main scheme stage's completion is replaceable                          | Tower Defense; Upgrading Adaptoids (`aos`)                                   | landed  |
| 3.5  | Damage on a card that is not a character (Avengers Tower)                | Tower Defense                                                                | landed  |
| 3.6  | A modular set's own deck (the Infinity Stone deck)                       | Thanos, Loki, any scenario                                                   | landed  |
| 3.7  | Loki: random start, swap, a villain stage's Victory X, the victory count | Loki; God of Lies (`tt`)                                                     | landed  |
| 3.8  | An encounter ally attached to the main scheme (Odin)                     | Hela                                                                         | landed  |
| 3.9  | An ally treated as a minion                                              | Fallen Warrior, Beguiled; 5 other packs                                      | landed  |
| 3.10 | Flipping a card into a separately emitted face of another type           | MC21 campaign                                                                | landed  |
| 3.11 | Timing points when a deck runs out                                       | Soul World, Universal Church, Thanos                                         | landed  |
| 3.12 | Counting different aspects; Adam Warlock's copy limit                    | Adam Warlock                                                                 | landed  |
| 3.13 | Abilities active in hand; "cannot choose to discard this card"           | Pip the Troll, System Shock                                                  | landed  |
| 3.14 | Player events shuffled into the encounter deck (Cosmic Entities)         | Adam Warlock precon                                                          | landed  |
| 3.15 | "After the last X counter is removed from here"                          | Ebony Maw; `aos`, `phoenix`                                                  | landed  |
| 3.16 | Encounter cards in a player's play area                                  | Ebony Maw's Spells                                                           | landed  |
| 3.17 | Alliance: paying a card's costs as a group                               | `warm`, `valk`, `vision`; 9 later cards                                      | landed  |
| 3.18 | Set-aside modular sets; mode-only faces; Standard II                     | The Hood; Wheel of Genres (`mojo`)                                           | landed  |
| 3.19 | Readying as a costed act; "cannot be readied by player card effects"     | Mister Fear; Undermine Support (`aos`)                                       | landed  |
| 3.20 | A trigger on damage a card prevented                                     | Abjuration                                                                   | landed  |
| 3.21 | An enemy attack against a chosen character                               | Speed Demon, Crossfire                                                       | landed  |
| 3.22 | Valkyrie's kit                                                           | `valk`                                                                       | landed  |
| 3.23 | Reusable as is                                                           | —                                                                            | checked |
| 3.24 | A character that ignores guard, patrol and the crisis icon               | Evasive Maneuvering; Wasp, Shadowcat, Psionic Training                       | landed  |
| 3.25 | Discarding cards you control as a cost                                   | Lethal Weapon; Noble Sacrifice, Repurpose, Delusion of Collusion             | landed  |
| 3.26 | A friendly character attacks its own player                              | Old Rivals                                                                   | landed  |
| 3.27 | A cancel with nothing it can cancel is not offered                       | §4 Q16 (user decision)                                                       | landed  |
| 3.28 | A blank text box except for keywords                                     | Corrupted Programming (§3.1's open item)                                     | landed  |
| 3.29 | A minion treated as an ally (the mirror of §3.9)                         | Mind Control, Redemption, Karma                                              | landed  |
| 3.30 | A resource ability's own effects                                         | Gauntlet Gun; War Cry family, Psi-Knife, Cybernetic Arm                      | landed  |
| 3.31 | A character that cannot defend                                           | Intangible; Grant Ward, Tracking Display                                     | landed  |
| 3.32 | One thwart that ignores patrol                                           | Just Passing Through; Natural Flight, Grapnel Launcher                       | landed  |
| 3.33 | A card with a given timing word in its text                              | Phase Disruption; Phase Strike, Sunfire, Target Lock, Warpath                | landed  |
| 3.34 | The attacking enemy from any trigger                                     | Flow Like Water; Riposte, Spider-UK, Daredevil                               | landed  |
| 3.35 | Discard a boost card instead of applying it                              | Defiance                                                                     | landed  |
| 3.36 | An event pattern that accepts several values                             | Machine Man; Absorbing Man (tt)                                              | landed  |
| 3.37 | Interrupts to a side scheme's defeat                                     | Chance Encounter; Followed, Ambush, Twisted Reality                          | landed  |
| 3.38 | Resources generated by reading the table                                 | Energy Duplication, Band Together; Storm's Crown, Cat's Head Amulet, Olympus | landed  |
| 3.39 | A keyword granted until a duration ends                                  | Pulsar Shield; Cuts Both Ways                                                | landed  |
| 3.40 | Scenario rules with no card behind them                                  | Ebony Maw (MC21 p. 6's Spell rule)                                           | landed  |
| 3.41 | A stat totalled over several cards                                       | Mass Attack; Fastball Special, Partnership of Pain                           | landed  |
| 3.42 | A deck-discard cost sized by the triggering event                        | Shield Spell                                                                 | landed  |
| 3.43 | A branch's bindings reach the effects after it                           | chooseOne/if bindings (scripter question)                                    | landed  |
| 3.44 | Players cannot discard these cards                                       | Powerful Enchantments                                                        | landed  |

### 3.1 Additional forms: the form keyword

> **Status: landed (2026-09-24),** tested in `packages/engine/src/additional-forms.test.ts` (8 tests: facedown forms
> grant none and have no title, but the owner finds them by printed form; a change turns the form faceup, is heard by
> "After you change form" and by the form card's own "this form" but not by an identity-only listener, and never uses the
> once-per-round change; one energy form at a time; no change, no trigger; `cannotChangeForm { formType }` stops only its
> type; a double-sided form card flips; the hero/alter-ego flip is an identity change; replay deep-equal). DSL:
> `packages/cards/src/dsl/wave4-primitives.test.ts` (5 tests). Corrupted Programming's "blank, except for keywords"
> landed later as §3.28. **Client:** log lines for `additionalFormChanged`, `cardTurnedFacedown` and `cardTurnedFaceup`,
> and a view of which form is up.

**Cards.** Spectrum: Monica Rambeau's Setup puts Gamma, Photon and Pulsar into play facedown; Energy Transformation
("After you change to this form, choose a facedown energy form upgrade → flip that card faceup to change to that
energy form"); Power Down ("After you change to this form, turn all your energy form upgrades facedown"); each form's
"After you change to this energy form"; Gamma Blast, Photon Speed, Pulsar Shield ("Change to Gamma energy form … If you
were already in Gamma energy form"); Speed of Light and Blue Marvel ("change energy forms"); Energy Duplication ("the
printed resource on your faceup energy form upgrade"); Loss of Control ("You cannot change energy forms"); Moxie and
Ready to Rumble ("After you change form"). Vision: "Change mass form by flipping your mass form upgrade over";
"While you are in Dense mass form"; "Play only if Vision is in Dense mass form"; Density Control ("After you change mass
form"); Corrupted Programming ("Treat your mass form upgrade's text box as if it were blank, except for keywords").

**Rules.** RRG 1.8 "Form, Change Form" (p. 21), quoted in §1.1: additional forms are separate from hero/alter-ego, do
not use the once-per-round flip, and changing one "does count as changing form for the purpose of triggering card
effects". A facedown card has no title, text or keywords (RRG 1.8 "Facedown"), so a facedown energy form grants no
form.

**What landed:**

- A player **is in "<name> <type> form"** while they control a faceup card whose showing face has `form { formType }`
  and is titled `<name>` (Gamma, Dense). **`Predicate inAdditionalForm { player, formType, name? }`** reads it; with no
  `name`, "in any <type> form". A facedown or blanked card grants none.
- **`EffectSpec changeAdditionalForm { player, formType, to?, toName? }`**: among the player's cards printing that form
  type, the one `to` names, else the one printed `toName`, else the only one if double-sided. A single-faced form card
  turns faceup and every other faceup one of that type turns facedown (§4 Q1); a double-sided one flips (also
  announcing `cardFlipped`). Already there: nothing changes and nothing triggers. Blocked by **`RuleSpec
cannotChangeForm { formType }`** (new field; without it the rule still means only the hero/alter-ego flip, §4 Q8).
- **`formChanged` gains `change: "identity" | "additional"`** (always set) and, for an additional change, `formType`,
  `formName` and `formCardInstanceId`, which is the event's target. Log: `additionalFormChanged`.
- **`EffectSpec turnFacedown { target }`**: "Turn all your energy form upgrades facedown" and the Setup's "into play,
  facedown". Not a change of form, so it announces nothing (log `cardTurnedFacedown`).
- **`TargetQuery.printedForm`** (exclusion `wrongForm`) finds a form card by its printed keyword, facedown too, so
  "choose a facedown energy form upgrade" is a query.
- **DSL:** `changeAdditionalForm`, `turnFacedown` (`dsl/effects.ts`); `inAdditionalForm`, `printedForm`
  (`dsl/values.ts`); `on.youChangeIdentityForm()` ("After you change to this form" on Spectrum's or Vision's identity
  faces), `on.youChangeToThisForm()` (on the form card), `on.youChangeAdditionalForm(type)` (Density Control). Plain
  `on.youChangeForm()` still hears both (Moxie, Ready to Rumble); `on.playerChangesForm(to)` now means the identity flip
  only.
- **Scripting note:** Gamma Blast's "If you were already in Gamma energy form" is read before its own change, so test
  `inAdditionalForm("energy", "Gamma")` first and keep the answer.

**Composes with:** Shadowcat's Solid/Phased and Quick Shift, Permanently Phased (`mut_gen` 32031, 32040, 32055); Nick
Fury's Assault/Stealth suit forms (`aos` 50035a/b); every "after you change form" card (Moxie, `ant` 12016, `wsp`
13014, `hlk` 10009, `wonder_man` 58010).

### 3.2 Two main schemes in play, each paired with a villain; Focused Defense

**Cards.** Under Siege 1A/1B, The Armies of Thanos 2A/2B, Focused Defense, Proxima Midnight I–III, Corvus Glaive
I–III, every Tower Defense card that says "the main scheme" or "the villain".

**Rules.** MC21 pp. 10–11 and the p. 67 errata, quoted in `docs/phase7-wave4-sources.md` §3: both main schemes gain
threat in step 1 and feel acceleration and crisis; each villain schemes onto its own scheme; a minion schemes onto the
scheme with Focused Defense; encounter cards' "the main scheme" is both, a player card's is the controller's choice, a
player constant's is Focused Defense's scheme; the active villain is the one "who matches the attached scheme".

**What landed:**

- **`GameState.extraMainSchemes`** (absent otherwise, so saves are unchanged): stages in play beside the central one in
  the shared game area. `mainSchemeStates` and the new `sharedMainSchemes` list them, so completion (§3.4), crisis and
  `cardsInPlay` (with their attachments) reach them. **Step one** places each shared main scheme's own acceleration plus
  its own tokens plus the icons in play. A completed extra stage loses on its final stage and advances otherwise, like
  the central one.
- **`EffectSpec putMainSchemeStageIntoPlay { stageNumber, name? }`**: the main scheme card's first unspent stage of that
  number becomes an extra main scheme, in play before its A and B When Revealed resolve (so 2A's "attached to this stage"
  finds it), then its starting threat. The stage is spent.
- **`RuleSpec focusedMainScheme { scheme }`** (Focused Defense's constant, `scheme: host`): between frames the villain
  whose title the scheme's `villainOf` names takes the active counter (`activeVillainChanged { reason:
"focusedScheme" }`), and the same scheme is the one minions scheme onto and player constants mean.
- **Scheme threat** (`pairedMainSchemeId`, read in `enemyScheme` after `schemeThreatDestination`): with extra main schemes
  in play, a villain places threat on the main scheme whose `villainOf` is its title, a minion on the Focused Defense
  scheme.
- **"The main scheme"** (`TargetRef mainScheme`) with extra main schemes and no separate game area: on an encounter card,
  every shared main scheme; on a player card, the one its controller chose for this ability, else the Focused Defense
  scheme. **The choice:** before a player card's effect that names the main scheme resolves, the effects frame inserts a
  `chooseTarget` among the main schemes (chooser: its controller, slot `MAIN_SCHEME_CHOICE`), once per ability. A
  constant never asks, so it reads the Focused Defense scheme.
- **`GameSetupConfig.sharedEncounterDeck`** (with `villains`): one deck `e1` built from `encounterDeck`, every villain's
  `encounterDeckId`. The scenario builder maps `MultipleVillains.encounterDecks: "shared"` to it (§5).
- **DSL:** `putMainSchemeStageIntoPlay`, `focusedMainScheme()`.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/two-main-schemes.test.ts` (5 tests: setup puts stage 2
> beside stage 1 with one shared deck, and Focused Defense makes Corvus active; after the player phase ends Focused
> Defense moves, both schemes gain step one's threat and the new active villain schemes onto her own scheme only, replay
> deep-equal; a minion schemes onto the Focused Defense scheme; a player card's "the main scheme" asks its controller
> which; an encounter card's is both and a player constant's is Focused Defense's). DSL:
> `packages/cards/src/dsl/wave4-primitives.test.ts`. **Known limits:** `nextMainSchemeStage` does not skip spent stages,
> so if Under Siege (stage 1) were ever completed without its replacement it would advance to the stage already beside
> it; both Tower Defense stages always replace their completion (§3.4), so no printed card reaches it. "The other
> villain" (Proxima's Power's boost) is the existing non-active villain ref (wave 2 §6.8), not re-tested here.

### 3.3 Villains protected by each other's hit points: one defeat sweep

> **Status: landed (2026-09-24),** tested in `packages/engine/src/villain-mutual-protection.test.ts` (4 tests: one at
> zero while the other has hit points stands; one effect bringing both to zero defeats both; the second reaching zero
> later takes the first down with it; with defeats on the stack because something listens, both still fall; replay
> deep-equal). **What landed:** `checkDefeats` decides every villain's defeat (dial at zero, `cannotBeDefeated`, not
> already pending) before applying any. When more than one falls in one sweep, each defeat goes on the stack marked
> `characterDefeated.protectionChecked`, and `applyDefeat` does not re-read `cannotBeDefeated` for it, so the first
> villain's fresh stage cannot shield the second. A single falling villain behaves exactly as before. Known limit: a
> "cannot be defeated" rule created by an interrupt to one of those defeats is not re-read for them; no printed card
> does that.

"Proxima Midnight cannot be defeated while Corvus Glaive has any hit points remaining", and the mirror on Corvus. The
sweep (`checkDefeats`) takes villains one at a time, and a defeated stage advances at once: with both at 0, Proxima
falls, Proxima II arrives with full hit points, and Corvus is now protected. RRG 1.8 "Damage" (p. 14) and ruling Jun 2,
2026 (2) make damage simultaneous. **Plan:** decide every villain's defeat in the sweep first, then apply them.
`cannotBeDefeated` with `while: valueAtLeast(remainingHpOf(named(...)), 1)` is the card script. **Composes with:** War,
Famine, Pestilence, Death (`aoa` 45081–45084, "cannot be defeated while another villain has at least 1 hit point").

### 3.4 A main scheme stage's completion is replaceable

> **Status: landed (2026-09-24),** tested in `packages/engine/src/main-scheme-completing.test.ts` (3 tests: "remove all
> the threat from this stage instead" keeps the final stage from completing and the rest of the ability resolves; an
> interrupt that replaces nothing leaves the completion to happen after it; with nothing listening the final stage
> loses as before; replay deep-equal). **What landed:** `TriggerEvent mainSchemeCompleting { schemeInstanceId,
stageIndex }`, pushed by `checkOneMainScheme` only when an ability listens (a game without one completes exactly as
> before), with an interrupt window and the target scheme as its target. Its apply step (`applyMainSchemeCompleting`)
> completes the stage only if it still would: same stage, not completed, threat still at or above the target. The
> existing `cancelTriggeringEvent` (`instead`) is the replacement. **DSL:** `on.mainSchemeCompleting(what)`. A completion
> by card effect (`completeMainScheme`, Kang's stage 3) is not routed through it; no printed "would be completed"
> reacts to one.

"Forced Interrupt: When this stage would be completed, remove all the threat from this stage instead. Then, deal
6[per_hero] damage to Avengers Tower." `whenCompleted` resolves before an advance but cannot stop it. **Plan:** a
completion with a listener becomes a `mainSchemeCompleting` trigger event with an interrupt window; `instead` cancels
the completion (no advance, no loss). **Composes with:** Upgrading Adaptoids 1B (`aos` 50104b).

### 3.5 Damage on a card that is not a character

> **Status: landed (2026-09-24),** tested in `packages/engine/src/damage-on-environment.test.ts` (3 tests: damage dealt
> to an environment stays on it and never defeats it; at 9 per player the Stronghold side clears it and flips, and 9
> more on the Damaged side loses; the Stronghold side lets a unique card of its title enter play and the Damaged side
> does not; replay deep-equal). **What landed:** nothing was missing for the damage itself: `dealDamage` already deals
> to any card, the defeat sweep reads only characters, and "After damage is placed here" is a response to `dealDamage`
> with `selfIs: "target"`, `damageOn(self)` reads it, and "remove all of it" is `heal` of that much. **New:** `RuleSpec
uniqueRuleExempt { title }` ("The unique rule does not apply to Avengers Tower"), read by `matchingCardInPlay`
> (which now takes `deps`) for a card entering play. **Open, §4 Q9:** the Damaged side's "When Revealed: Discard each
> other Avengers Tower from play" and a flip.

"Deal 3 damage to Avengers Tower"; "After damage is placed here, if there is at least 9[per_hero] damage here …";
"remove all of it". **Plan:** verify whether `dealDamage`/`placeDamage` accept an environment and announce a trigger;
add the event if not. Other raw cards that put damage "here" are checked when this lands.

### 3.6 A modular set's own deck: the Infinity Stone deck

> **Status: landed (2026-09-24),** tested in `packages/engine/src/set-deck-and-run-out.test.ts` (§3.6: 2 tests — the deck
> is built from the set's cards at setup and each card's discard home is the deck's own pile; the top card is put into
> play, its Special resolves and it goes to that pile). **What landed:** `GameSetupConfig.scenarioDecks[].buildAtSetup`
> (and `ScenarioDeckState.buildAtSetup`): scenario setup builds such a deck from the encounter deck right after shuffling
> it, before the setup-keyword cards enter play, with no card text asking. `ScenarioSeparateDeck.contents.trait` and
> `cardType: "environment"` are read by `buildScenarioDeck`. Everything else composed: "put the top card of the infinity
> stone deck into play" is `selectCards` of `scenarioDeck(name, top 1)` then `putIntoPlay`; "Place this card in the
> infinity stone deck discard pile" is `discard(self)` (its home); the empty-deck reshuffle is the existing `whenEmpty`.
> **For the scenario builder (§5):** every `EncounterSet.separateDecks` of a set in the game becomes a
> `GameSetupConfig.scenarioDecks` entry with `buildAtSetup: true`, and `singleVillainOnly` sets are refused with several
> villains. **Not yet proven:** "Apply its boost icons … as if it were a boost card" ("I Am Inevitable", Infinite
> Mischief) is expected to be `adjustBoostCount` by `boostIconsOn` of the discarded stone; the scripter confirms it.

Schema §1.10. **Plan:** build `EncounterSet.separateDecks` at setup (the scenario-deck machinery of wave 2 §3.3);
"put the top card of the infinity stone deck into play", "reveal the top card", "Place this card in the infinity stone
deck discard pile" (the deck's discard home), reshuffle when empty without penalty, and the "runs out" timing point
(§3.11). "Apply its boost icons … as if it were a boost card" is `adjustBoostCount` with `boostIconsOn` of the bound
card (to confirm).

### 3.7 Loki: random start, swap, a villain stage's Victory X, the victory count

> **Status: landed (2026-09-24),** tested in `packages/engine/src/villain-swap.test.ts` (5 tests: one Loki starts at random
> from the seed and the rest are set aside; a swap keeps the villain instance, its dial, status cards and counters, sets
> the old card aside and fires "after Loki is swapped", replay deep-equal; a swapped-in stalwart Loki sheds its status
> cards; a defeated Loki goes to the victory display and a random set-aside one takes over (dial reset, status and
> counters kept), and at the victory condition the players win, replay deep-equal; a villain whose last stage has
> Victory X goes to the victory display on an ordinary defeat). DSL: `wave4-primitives.test.ts`.
>
> **What landed:** `GameSetupConfig.randomStartingVillain` (the choice is the game's first RNG draw) and
> `GameSetupConfig.victoryCondition` (→ `ScenarioRules.victoryCondition`, read by **`ValueSpec victoryCondition`**; the
> scenario builder picks the number for the modes played). **`EffectSpec swapVillain { villain }`** and
> **`EffectSpec advanceToSetAsideVillain { villain }`** (`resolve/villain-swap.ts`): the villain stays one instance and
> takes a random set-aside villain card of its title; the set-aside instance takes the old card, so everything on the
> villain simply stays. A swap keeps the dial's value (its remaining hit points) and announces **`TriggerEvent
villainSwapped`** (log `villainReplaced { reason: "swap" }`); an advance resets the dial, sends the old card to the
> victory display (Victory X) or out of the game, gives toughness its tough status card and resolves the new card's When
> Revealed (log `villainReplaced { reason: "advance" }`); used from a forced interrupt to the defeat, it leaves the
> dial above zero, so the defeat does not apply. **Victory X on a villain:** `defeatVillainStage` puts a defeated last
> stage with the keyword in the victory display (wave 3 §3.4's open item; also the Brotherhood of Mutants, `mut_gen`).
> A stalwart Loki's status cards go by the existing stalwart rule (wave 3 §3.7). **DSL:** `swapVillain`,
> `advanceToSetAsideVillain`, `victoryCondition`. **Not covered:** a non-final villain stage with Victory X (no printed
> card has one); Thunderbolt Backup's in-play swap (`aos` 50131b).

Schema §1.11. RRG 1.8 "'Swap'" (p. 42): swapping an in-play card with an out-of-play card that shares its title means
"neither card is considered to enter or leave play. Tokens, attached cards, tucked cards, and status cards on the
previously in-play card are transferred … If the swapped card has an associated hit point dial, that dial remains at
the same value." MC21 p. 24: "This does not cause Loki to leave play, enter play, or be revealed. … The Loki card that
was swapped out should be set-aside with the other remaining set-aside versions of Loki." Ruling Feb 28, 2026 (3):
permanent attachments move to the swapped-in villain. Loki's Cape: "After Loki is swapped with a set-aside Loki
villain". **Plan:** `EffectSpec swapVillain { villain, with: "randomSetAside" }` with a `villainSwapped` event; setup's
random starting villain; a defeated stage with Victory X goes to the victory display (wave 3 §3.4's open item);
"advance to a random set-aside Loki villain" on defeat; `ValueSpec victoryCondition`. **Composes with:** Stories and
Lies, Shatter the Illusion (`tt` God of Lies); Thunderbolt Backup's "swapping it with the minion already attached here"
(`aos` 50131b) is a different swap (both in play) and is not claimed.

### 3.8 An encounter ally attached to the main scheme (Odin)

> **Status: landed (2026-09-24),** tested in `packages/engine/src/captive-ally.test.ts` (2 tests: attached, Odin is in
> play but reached by no category and takes no attachment; detached, the first player controls him in play, and
> defeated he is removed from the game and the players lose, replay deep-equal). DSL: `wave4-primitives.test.ts`.
> **What landed:**
>
> - **An ally attached to a card and controlled by no player has no categories** (`categoriesOf`): ruling Jun 25, 2026
>   (4) #5, "Characters not under player control are not friendly characters". It is in play (`cardsInPlay`, by name).
> - **`EffectSpec detach { card, controller }`**: the attached card moves into the controller's play area under their
>   control, staying in play (logs `cardDetached`, `controllerChanged { reason: "effect" }`).
> - **`RuleSpec cannotHaveAttachments { target, from? }`**: no legal host for an attachment or upgrade from `from` (any,
>   `"encounter"` for the King side's "encounter cards", `"upgrade"` for Robert Kelly), read by
>   `attachmentHostCandidates` (so both encounter "attach to" and playing an upgrade) and by the `attach` effect.
> - **`RuleSpec leavingPlayLoses { target }`**: `leavePlay` ends the game as **`GameOutcome { result: "loss", reason:
"cardAbility" }`** (new) when a matching card leaves play.
> - "When Odin leaves play, remove him from the game" needs nothing: Odin is double-sided, and RRG 1.8 "Double-Sided
>   Card" (p. 17) already sends him out of the game (`leavePlay`), which also stops Med Lab (ruling Dec 17, 2025 (4) #2).
>   `leavePlay` now counts a card with `otherFaceId` as double-sided too, so the campaign's Cosmo is removed the same way.
> - The rest composes: "The first player gains control of Odin" is `controlledByFirstPlayer` with `while: not(isAttached
self)`; "does not count against ally limit" is `excludedFromAllyLimit`; flipping to his King side is `flipCard`.
>
> **Composes with:** Robert Kelly (`mut_gen` 32063, 32065a: detached, taken control of, "cannot have upgrades attached",
> "If Robert Kelly leaves play, the players lose"), Hope Summers (`next_evol` 40130). **Not built:** a general "when X
> leaves play" interrupt window (Abduct Superhumans `aos` 50081, Spider-Man `sm` 27017); no `mts` card needs one.

Odin's Torment 1A attaches Odin, captive side up, to the main scheme; Hall of Nastrond: "The first player detaches Odin
from the main scheme and takes control of him"; Odin: "While Odin is not attached to the main scheme, he gains: 'The
first player gains control of Odin. Odin cannot have cards attached and does not count against ally limit.' If Odin
leaves play, the players lose the game." Rulings Jun 25, 2026 (4) #5 (not friendly while attached) and Aug 3, 2026 (4)
#1 (takes no attachments while attached). **Plan:** an ally as an attachment of the main scheme (not a character, not
friendly), `EffectSpec detach { card, into: "play", controller }`, `RuleSpec cannotHaveAttachments { target, from? }`
("encounter cards" on the King side). `controlledByFirstPlayer` and `excludedFromAllyLimit` exist.

### 3.9 An ally treated as a minion

Fallen Warrior, Beguiled (`mts` 21153, 21178; `valk` 25031): "Treat attached ally as an [Undead] minion with a blank
text box. Attached minion's SCH is equal to its printed THW and it does not take consequential damage. … Attached ally
engages its controller." Ruling Dec 17, 2025 (1) #3: "the ally does not leave play and the 'minion' does not enter
play; the character remains in play and retains all tokens and attachments. (The process is essentially a status
change.)" **Plan:** a `RuleSpec treatAsMinion { target: host, traits, schFromThw, noConsequentialDamage, keepTraits? }`
read where a card's categories are decided (`categoriesOf`, beside `facedownAs`), cheap because it reads only the
card's own attachments. **Composes with:** 'Pool-ized (`deadpool` 44041), "Lost" Child (`jubilee` 47027), Manipulated
Mind (`sm` 27171, "except for traits"), Possessed (`storm` 36038), Malice (`next_evol` 40199).

> **Status: landed (2026-09-24),** tested in `packages/engine/src/treat-as-minion.test.ts` (3 tests: attached, the ally is
> an engaged minion nobody controls, with a blank text box, the new trait, SCH equal to its printed THW, its damage
> kept and no ally action offered, replay deep-equal; "(except for traits)" keeps the printed traits; when the
> attachment is discarded it is its controller's ally again with its text and damage). **What landed:** the plan's
> read-at-query-time rule would need the ability registry in `categoriesOf`/`isMinion`, which take none, so the
> ruling's "essentially a status change" is kept as state instead: **`CardInstance.treatedAs`** (optional; `kind`,
> `traits`, `keepPrintedTraits`, `schFromThw`, `source`, `controllerBefore`), set and cleared by `treat-as.ts
syncTreatedAs`, which `relocateCard` calls whenever a card moves onto or off a host, from the host's attachments'
> **`RuleSpec treatHostAsMinion {traits, keepPrintedTraits?, schFromThw?}`**. It is set the moment the attachment
> lands, so the same ability's "Attached ally engages its controller" engages a minion. Readers: `categoriesOf`,
> `isMinion`, printed traits, blank abilities and keywords, `printedProfile` (a minion profile from the ally's printed
> ATK, THW-as-SCH and hit points). A new `select.ts isAlly` (the `ally` category) replaces the raw `type === "ally"`
> play-area walks (legal attackers/thwarters, defenders, Melter's forced ally defense, the ally limit, Team-Up's
> friendly characters, why-not). Leaving play clears it. Event `treatedAsChanged`. **DSL:**
> `constant(treatAttachedAllyAsMinion(traits, { keepPrintedTraits? }))`. **Not covered here:** Mind Control, Redemption and Karma landed as §3.29; Reluctant Foe
> (`aos` 50171, a hero treated as a minion with a replaced text box).

### 3.10 Flipping a card into a separately emitted face of another type

Schema §1.7. **Plan:** `flipCard` on a card with `otherFaceId` replaces the instance's card; RRG 1.8 "Flip" (p. 20)
discards attachments, tucked cards, status cards and tokens when the type changes, and keeps them when it does not
(the side-scheme-to-side-scheme flips). A side scheme that flips on "When Defeated" is still defeated (Victory X, "is in
the victory display" readers), then becomes its other face in play.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/other-face.test.ts` (3 tests: a side scheme that flips
> on its When Defeated into an ally stays in play under the first player's control with its counters discarded, replay
> deep-equal; into a minion, engaged with the first player; into another side scheme, keeping its counters and entering
> with starting threat plus hinder). **What landed:** `flipCard` on a card with `otherFaceId` calls
> `resolve/other-face.ts flipToOtherFace`: the instance takes the other card's id; a different type discards
> attachments and tucked cards and clears status cards, damage, threat and counters (RRG 1.8 "Flip", p. 20) and moves
> the card where its new type lives (minion engaged with "you", ally/support/upgrade under "you", attachment on its
> first legal host, scheme or environment in the villain's area; "you" is the first player for a side scheme's When
> Defeated). The new face is then treated as entering play (§4 Q17, user decision: it enters play). A defeated side scheme's leave-play step is now
> guarded by `refMatches self {printedId}`, so one that flipped during its own When Defeated stays in play; its
> `schemeDefeated` event still fires (the campaign's "if Secure the Landing Pad was defeated"). Event
> `cardFlippedToOtherFace`. **DSL:** none new (`flipCard(self)` in a `whenDefeated`). **Not covered:** a side scheme with
> Victory X that flips (none printed).

### 3.11 Timing points when a deck runs out

> **Status: landed (2026-09-24),** tested in `packages/engine/src/set-deck-and-run-out.test.ts` (§3.11: 2 tests — taking
> a scenario deck's last card announces it once, then the deck takes its discard pile back with no penalty, replay
> deep-equal; a player's deck that runs out and resets is announced to that player's cards). **What landed:**
> `TriggerEvent deckRanOut { deck: "player" | "scenario", playerId?, name? }`, response window only, pushed between
> frames and only when an ability listens. A player's deck: recorded as it resets (`resetPlayerDeck`). A scenario deck:
> recorded by the move that took its last card (`settlePlayerDecks`), so a deck that starts empty before setup builds it
> never counts. The record is `GameState.pendingDeckRunOuts` (absent until first used), drained by the flow
> (`announceDeckRunOuts`). **DSL:** `on.yourDeckRunsOut()`, `on.aPlayerResetsTheirDeck()`, `on.scenarioDeckRunsOut(name)`.
> A player deck that empties with an empty discard pile does not reset (RRG 1.8 p. 33) and is not announced until it does.

Soul World ("After your deck runs out of cards"), Universal Church of Truth ("After a player resets their deck"), Thanos
I–III ("After the infinity stone deck runs out"). The engine logs `playerDeckReset` (wave 3 §4 Q15) but announces no
trigger event. **Plan:** `TriggerEvent deckRanOut { deck: player | scenarioDeck name, playerId? }`, heard-only.

### 3.12 Counting different aspects; Adam Warlock's copy limit

> **Status: landed (2026-09-24),** tested in `packages/engine/src/distinct-aspects.test.ts` (1 test: each of the four
> aspects counted once, a printed aspect included, basic and 'Pool not) and `packages/engine/src/max-copies-per-title.test.ts`
> (the copy limit, §1.4). **What landed:** `ValueSpec distinctAspects { cards }`; DSL `distinctAspectsOf`. **Composes:**
> "discard up to 4 cards from the top of your deck → …" (Karmic Blast, Cosmic Awareness, Magic Attack, Zone of Silence)
> is scripted as effects — a `chooseOne` of 1–4, each `selectCards(topOfDeck(n))` then `moveCards` to the discard pile —
> with the bound cards read by `distinctAspectsOf` or `countAmong`; the composition is in `wave4-primitives.test.ts`. The
> printed arrow makes the discard a cost of the extra damage; as an effect the one difference is that it resolves after
> the first 4 damage is chosen, which no card reads (flagged, not open). Battle Mage's "If that card is: Aggression – …"
> is `refMatches(chosen, { aspect }, { anywhere: true })` per option.

Karmic Blast, Cosmic Awareness, Regeneration Cycle: "for each different aspect discarded this way". `ValueSpec
distinctCardTypes` exists (Time Stone's "different card type"); **plan:** `ValueSpec distinctAspects { cards }`
(the four core aspects, `printedAspect` included). Battle Mage's "If that card is: Aggression – …" composes from
`refMatches` with `aspect`. Deckbuilding is §1.4 plus `validateDeck`.

### 3.13 Abilities active in hand; "cannot choose to discard this card"

> **Status: landed (2026-09-24),** tested in `packages/engine/src/hand-abilities.test.ts` (3 tests: an action that works in
> hand is offered and used from hand and not once the card is in play, replay deep-equal; a response that works in hand
> is offered from hand and puts the card into play; a chosen discard never offers a card that cannot be chosen). **What
> landed:** **`AbilityDefinition.activeIn: "hand"`**: `useAbility` and `legalActions` accept such an action only while
> the card is in its user's hand (and every other action only in play); `inHandCandidates` offers such a triggered
> ability to the hand's owner (its "you"), as an ability, not a play of the card; `candidatesFor` never offers it in
> play. **`RuleSpec cannotChooseToDiscard`** on a hand-active constant keeps the card out of an effect's chosen discard,
> a discard-from-hand cost, the end-of-phase discard and the mulligan (`handOptions`); a random discard still takes it.
> **DSL:** `inHand(definition)`, `cannotChooseToDiscard`. **Behaviour change to know:** a non-event card's action
> ability could previously be used from hand through a hand-crafted `useAbility` command (no legal move offered it);
> that is now refused.

Pip the Troll: "While Pip the Troll is in your hand, he gains 'Interrupt: When a player is attacked, spend [energy][mental]
resources → put Pip the Troll into play under that player's control.'" System Shock (campaign): "You cannot choose to
discard this card from your hand. While this card is in your hand, it gains: 'Alter-Ego Action: …'". **Plan:** an
`AbilityDefinition.activeIn: "hand"` read by trigger candidates and actions; `RuleSpec cannotChooseToDiscard { cards }`
for discard choices from hand.

### 3.14 Player events shuffled into the encounter deck (Cosmic Entities)

In-Betweener, Living Tribunal, Eternity, The Gardener: "Action: Shuffle this card into the encounter deck (without
looking). When Revealed: … and remove this card from the game. This effect cannot be canceled." FAQ (RRG 1.8 p. 62):
resolved as a boost card, it goes to the encounter discard pile. Ruling Jan 17, 2026 (5): with several encounter decks,
the active villain's. **Plan:** a player card in the encounter deck keeps its owner; its When Revealed resolves when a
player reveals it; `uncancellable` on the ability; a discarded one goes to the encounter discard pile.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/cosmic-entity.test.ts` (3 tests: played, the event
> joins the active villain's encounter deck owned by its player, controlled by nobody, and discards to the encounter
> discard pile; revealed, its When Revealed resolves and removes it from the game even with a forced "cancel its effects
> and discard it" in play, replay deep-equal; "you" on it is the player who revealed it). **What landed:**
> `moveCards … "encounterDeckShuffle"` now takes a player card: it keeps `ownerId`, loses its controller and is homed to
> the active villain's encounter deck (`CardHome encounterDeck`), so `discardZoneFor` sends it (as a boost card or a
> canceled reveal) to that encounter discard pile, and `gameAbilityFrames` makes the revealing player its "you". A
> revealed event still where it was dealt when its reveal finishes is discarded like a treachery.
> **`AbilityDefinition.uncancellable`** on a When Revealed, and **`RuleSpec cannotBeCanceled {cards, while?}`** (read
> from the revealed card itself wherever it is, and from play), make `cancelRevealedCard` / `cancelWhenRevealed` change
> nothing (`rules.ts revealCannotBeCanceled`). **Composes with:** Longshot and Cornered! (`mojo` 39071, 39017, "This
> effect cannot be canceled"), Frequent Flyers and its siblings (`sm` 27108–27110, 27112, "In expert mode, … cannot be
> canceled"), Dark Scepter (`tt` 55036, "Treacheries cannot be canceled"). **DSL:** `uncancellable(whenRevealed(…))`,
> `cannotBeCanceled(query, when?)`. See §4 Q16 (decided: a cancel that can do nothing is not offered; §3.27).

### 3.15 "After the last X counter is removed from here"

> **Status: landed (2026-09-24),** tested in `packages/engine/src/spell-environments.test.ts` (§3.15: fires on the last
> counter only, the Spell is discarded and "your identity" is its play area's player; replay deep-equal). **What
> landed:** `TriggerEvent countersRemoved { instanceId, counterType, amount, remaining }` with interrupt and response
> windows, pushed by `EffectSpec removeCounters` only when an ability listens (otherwise the removal happens at once, as
> before); its apply step removes them, so the uses keyword's discard still follows. **`EventPattern.eventAtMost`**, the
> mirror of `eventAtLeast`: `{ remaining: 0 }` is "the last". **DSL:** `on.lastCounterRemoved(counterType)`. **Not
> covered:** counters removed as a cost (`spendCounters`) do not push the event; no printed "last counter" card removes
> its counters as a cost.

Fireball, Manipulation, Pacification, Rubblestorm; Holding Cell (`aos` 50105a–50108a), Phoenix Force (`phoenix`
34002a). **Plan:** verify `removeCounters` announces an event; add `countersRemoved { instanceId, counterType,
remaining }` if not.

### 3.16 Encounter cards in a player's play area

> **Status: landed (2026-09-24),** tested in `packages/engine/src/spell-environments.test.ts` (§3.16: a revealed Spell
> environment goes in front of the revealing player, controlled by no one, and is found by `inPlayAreaOf`; any other
> environment still goes to the villain's area). **What landed:** **`RuleSpec entersRevealersPlayArea { cards }`** (a
> scenario rule the scripter puts on Ebony Maw's own cards), read by `enterPlayOnReveal`, the path both a reveal and
> `putIntoPlay` take; **`TargetQuery.inPlayAreaOf`** (exclusion `notInPlayArea`); `uncontrolledYouOf` now names the
> play area's player for an environment there too, and a triggered ability on such a card (or an obligation, or an
> attachment on a player card) resolves with that player as "you". **DSL:** `inPlayAreaOf(player)`. **Client:** Spell
> environments in a player's area; one line in `view/highlights.ts` (added).

MC21 p. 6: a revealed Spell environment goes in front of the revealing player; Ebony Maw's interrupt reads "each Spell
card in your play area". **Plan:** verify where `putIntoPlay` places an environment for a player, and add a
`TargetQuery.inPlayAreaOf: PlayerRef` if no query reads it.

### 3.17 Alliance: paying a card's costs as a group

> **Status: landed (2026-09-24),** tested in `packages/engine/src/alliance.test.ts` (10 tests: a resource cost paid
> from two players' hands, each card to its owner's discard pile, only the playing player resolving the card; another
> player's hand card refused without alliance; another player's resource ability used, its controller paying its cost
> and logged as the generator, refused without alliance; "exhaust an [Avenger] character and a [Guardian] character"
> taking another player's character, refused without alliance; one character with both traits cannot pay both slots;
> `legalActions` offers the card when only the table can pay it, and not its non-alliance twin; "After you spend this
> card" heard by the spender with `forPlayerId` the paying player; in a timing window, a `chooseCostCards` prompt per
> unforced pick before the payment, a forced pick not asked; declining a pick backs out; replay deep-equal). DSL:
> `packages/cards/src/dsl/wave4-hero-primitives.test.ts` (5 tests).
>
> **What landed:**
>
> - **One reading, from the card data.** `paidAsGroup(state, deps, ...cards)` (`actions.ts`) is true when the card
>   whose costs are paid has the alliance keyword (printed or gained, `hasKeyword`). Every payment path reads it:
>   `priceOf` (a command's `payment` may name any player's hand cards and resource abilities), `paymentOptions` (the
>   payment sheets and `legalActions`' wallets list every player's hand, the paying player's first), `planCost`'s
>   in-play picks (`eligibleForInPlayPick`: any player's cards, not only the payer's, RRG 1.8 "Cost" p. 14 being the
>   rule alliance lifts) and its `discardFromHand` picks. Each contributed card is read from its owner's point of view:
>   their form for "spend only in hero form", their discard pile for a "top card of your discard pile" resource.
> - **A contributed resource ability** is used by its controller (`resourceSpender`): its form, its limit, its own cost
>   and the `resourcesGenerated` log line are theirs. A "for any player" ability (the Milano) is still the payer's.
> - **`resourcesSpent`, one event per spender.** `playerId` is the spender ("you" for "After you spend this card"),
>   `forPlayerId` the player playing the card (Everyday Hero's "for a player"). The paying player's event resolves
>   first. Hand cards go to the discard pile of the hand they came from.
> - **Several picks in one cost.** `AbilityCost.exhaustCards` may be a list of `InPlayCostPick`s, each with its own slot;
>   one card cannot pay two of them (RRG 1.8 "Cost", p. 13). `inPlayPicksOf(cost)` (exported) lists every pick;
>   `planCost`, `payCost`, `legalActions`, the validator and the window read it. `defaultInPlayPicks` (moved from
>   `legal.ts` to `actions.ts`) is the smallest default, a card taken by one slot kept out of the next.
> - **Picks inside a timing window** (Stand Together, Serve and Protect are interrupts). A window used to price every
>   cost with no picks, so an unforced "exhaust a …" pick was unpayable there. Now the window asks
>   **`ChoicePrompt chooseCostCards { instanceId, abilityId, slot, mode }`** for each unforced pick before the payment
>   sheet (RRG 1.8 "Initiating Abilities", p. 24: costs are determined before they are paid), keeping the picks on the
>   frame (`Frame<"window">.costPicks`, keyed by candidate, optional so saves are unchanged; `awaiting: "costPick"`).
>   Selecting fewer than the pick's `min` backs out. In-play trigger candidates are judged payable with the default
>   picks, so an ability with an unforced pick is offered at all.
> - **Engine code names no card.** Alliance is read from `KeywordInstance { name: "alliance" }` on the emitted cards.
>
> **DSL:** `exhaustEachCost({ avenger: query(["identity", "ally"], { trait: AVENGER }), guardian: … })`
> (`dsl/abilities.ts`); "the combined ATK of those characters" is `sum(statOf(chosen("avenger"), "atk"),
statOf(chosen("guardian"), "atk"))`. No builder for the keyword itself: it is card data.
>
> **Checked against every raw card printing "Alliance."** (14; `grep -il alliance packages/content/raw/marvelcdb/*.json`):
> resource costs only (Cosmic Alliance, Joining Forces, Team Investigation, Strength in Diversity, Joys of Life,
> Flying Formation, Break Time, Mutant Mayhem) pay from any player's hand; two-slot exhaust costs (As One!, Stand
> Together, Problem Solvers, Combine Forces, Gunboat Diplomacy, Serve and Protect) compose with `exhaustEachCost`.
> Joys of Life's "Choose: • Exhaust a [Civilian] alter-ego → … • Exhaust a hero or ally → …" is `eitherCost` with an
> `exhaustCardsCost` per branch, the branch read from var `cost.branch`. Effects that act "as a group" (Joining Forces'
> "the players put a total of 1 [Avenger] ally and 1 [Guardian] ally into play from their hand(s)"; Mutant Mayhem's
> "those players play those allies") are effects, not costs, and belong to the scripting pass (`zone("hand",
eachPlayer, …)` with `chooseCards`/`putIntoPlay` to be confirmed there).
>
> **Composes with:** Everyday Hero (`28019`, "After you spend this card for a player"), now reachable across players;
> the Milano's "for any player" resource (`gmw`), unchanged; any "Exhaust an X character and a Y character" cost
> (Combine Forces and Gunboat Diplomacy, `ncrawler` 48031/48032; Serve and Protect, `jubilee` 47029).
>
> **Client:** `chooseCostCards` needs a prompt title (the choice scene falls back to "Choose") and the payment sheet
> should show whose hand each option comes from (`ref.instanceId` locates it). **Netcode:** a command may now spend
> another seat's cards; the table's consent to that is a client/netcode concern (§4 Q10).

RRG 1.8 "Alliance" (p. 6). As One!, Stand Together, Problem Solvers, Cosmic Alliance, Joining Forces; also `angel`
42031, `deadpool` 44046, `falcon` 53019, `jj` 61026, `jubilee` 47028/47029, `ncrawler` 48031/48032, `next_evol` 40053. **Plan:** other players' resources (and "exhaust an Avenger character and a Guardian character" costs) usable
while paying for a card with the keyword; only the playing player resolves it.

### 3.18 Set-aside modular sets; mode-only faces; Standard II

> **Status: landed (2026-09-24),** tested in `packages/engine/src/set-aside-modular-sets.test.ts` (8 tests, on The
> Hood's own emitted cards: setup creates each set-aside set in the set-aside area and records it; the shuffle-in
> moves one whole set, chosen by the seeded RNG, into the encounter deck and logs it, count 3 → 2; with none left
> nothing happens and the count reads 0; a game without the field is unchanged; setup refuses a card outside its set;
> Formidable Foe enters play on its Standard face (villain steady, minion not) and in expert mode on its Expert face
> (every enemy steady); The Hood's Mantle's granted steady holds one stun without stunning; replay deep-equal). DSL:
> `packages/cards/src/dsl/wave4-hero-primitives.test.ts` (2 tests under §3.18).
>
> **What landed:**
>
> - **`GameSetupConfig.setAsideModularSets: { encounterSetId, cardIds }[]`**: created in `encounterSetAside` and
>   recorded in **`GameState.setAsideModularSets`** (`SetAsideModularSet { encounterSetId, instanceIds }`, absent in a
>   game that sets none aside, so saves are unchanged). Which sets, how many (`Scenario.setAsideModularSetCount`), and
>   that none is a Standard/Expert classification set is the scenario builder's choice (the engine sees card ids, not
>   `EncounterSet` records).
> - **`EffectSpec shuffleInSetAsideModularSet { bind? }`**: "Choose 1 set-aside modular encounter set at random, then
>   shuffle it into the encounter deck" (Making Connections 1A Setup, The Hood II/III, Promised Prosperity, Crime
>   State, Field Recruitment): seeded pick, the set's cards still set aside go to the active encounter deck, shuffled;
>   log `setAsideModularSetShuffledIn { encounterSetId, instanceIds }`. A card an ability already took out of the
>   set-aside area stays where it is.
> - **`ValueSpec setAsideModularSetCount`**: Wheel of Genres' "no set-aside modular encounter sets remaining".
> - **Mode-only faces:** **`GameSetupConfig.difficulty: "standard" | "expert"`**, kept as
>   `ScenarioRules.difficulty: "expert"` (absent in standard mode). **`modeOnlyFlipped(card, difficulty)`**
>   (`query.ts`) shows the back of a card whose front names the other mode, at setup and whenever the card leaves play
>   (the reset in `leavePlay`), so it enters play (Setup keyword, reveal, put into play) on the right face. The emitted
>   Formidable Foe carries `modeOnly: "standard"` on its front only; a back with no `modeOnly` is read as the other
>   mode's. **Pipeline:** emit `flipSide.modeOnly: "expert"` on 24049 (§1.8 says both faces).
> - **Standard II:** unchanged (§4 Q5): `classification` keeps Standard II / Expert II out of modular choices; whether a
>   game uses them is the insert's setup rule, still unread.
>
> **Steady, checked against The Hood's cards.** Every Hood printing grants it: The Hood's Mantle ("The Hood gains
> retaliate 1 and steady"), Formidable Foe ("The villain gains steady" / "Each enemy gains steady"), Warehouse District
> ("Each character in play gains steady"). The engine's rule (`keywords.ts`: `statusCapacity` 2, `statusActive` needs 2
> of the type) reads `hasKeyword` with `deps`, which includes `keywordGrants`, and every caller passes `deps` (basic
> attack and thwart, labeled abilities, the villain phase's stun/confuse checks, enemy-attacks-enemy, the state check
> that sheds excess statuses). It matches RRG 1.8 "Steady" (p. 41) word for word: one more card of each, "not
> considered" stunned/confused below two. A character that loses a granted steady while holding two of a status sheds
> one (the capacity state check). Nothing to change.
>
> **Scenario builder (`ability-scripting-engineer`):** The Hood's builder passes `difficulty`, `modularSetCount: 0`,
> and `setAsideModularSets` for the seven chosen sets (the players' choice, or random from the pool), and Making
> Connections 1A's `Setup:` is `setup(shuffleInSetAsideModularSet())`. Mojo's Wheel of Genres builder does the same
> with its own sets.
>
> **DSL:** `shuffleInSetAsideModularSet(bind?)` (`dsl/effects.ts`), `setAsideModularSetCount` (`dsl/values.ts`).
>
> **Composes with:** Wheel of Genres (`mojo` 39026a/b); Seek and Destroy's and Shadow of the Past's set-aside searches
> (`encounterSetAside`, unchanged); the `gmw` Campaign Challenge faces and `sm` 27174a/b, `next_evol` 40081a/b once
> they carry `modeOnly` (the same `modeOnlyFlipped`).

Schema §1.8, §1.9, §1.12. **Plan:** setup sets aside the chosen modular sets; `EffectSpec shuffleRandomSetAsideSet`
("Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck"); a `modeOnly` card is
put into play on its expert face in expert mode. **Composes with:** Wheel of Genres (`mojo` 39026a/b, "if there are no
set-aside modular encounter sets remaining"); the Campaign Challenge faces (`gmw`), `sm` 27174a/b, `next_evol` 40081a/b.

### 3.19 Readying as a costed act; "cannot be readied by player card effects"

> **Status: landed (2026-09-24),** tested in `packages/engine/src/ready-cost.test.ts` (5 tests: at the end of the
> player phase each taxed card asks in ready order, paid readies and declined stays exhausted; a card effect's ready
> asks too; the other player's readies are not taxed; with nothing to pay with the ready is declined; "cannot be
> readied by player card effects" stops a player card's ready but not the end-of-phase ready; replay deep-equal). DSL:
> `packages/cards/src/dsl/wave4-hero-primitives.test.ts` (2 tests under §3.19).
>
> **What landed:**
>
> - **`RuleSpec readyCost { target, resources, player?, while? }`**, read by `readyCostFor` (`rules.ts`; several rules
>   add up). RRG 1.8 "Ready" (p. 36): "If there is an additional cost for a player to ready a card, that player can
>   choose not to pay that cost. If they do not pay the cost, the card does not ready." `readyOrAnnounce` now takes
>   who readies and what readies it; when a cost applies it logs `readyCostAsked` and pushes an effects frame that asks
>   the readier with the existing `spendResources` prompt, then readies the card only if it was paid
>   (`EffectSpec ready.readyCostPaid`, set by that frame only, so the ready does not ask twice).
> - **Who is asked:** the controller at the end-of-phase ready, the resolving player for a card effect (§4 Q18).
> - **`RuleSpec cannotReady.bySource: "playerCard"`**: "cannot be readied by player card effects" stops a ready whose
>   source is a player card (`isPlayerCard`); `cardReadying` gains `sourceInstanceId`, and `readyCard` /
>   `cannotReady` take the source.
> - **End of the player phase** (RRG 1.8 p. 18): each card is readied once (the three lists overlapped, harmless when a
>   ready was instant, not when it waits on a cost), the pushed questions resolve in ready order (player order,
>   identity first), and step 5 ("when the phase ends") waits for them: `GameStep endPhaseReady.readied` marks step 4
>   done. With nothing pushed, the step runs exactly as before. The same wait now also orders a "would ready"
>   interrupt (Frozen in Time) before "when the player phase ends", which it previously followed.
>
> **DSL:** `additionalCostToReady(target, resources, { player, while })`, `cannotBeReadiedByPlayerCards(target)`
> (`dsl/abilities.ts`).
>
> **Composes with:** Undermine Support (`aos` 50174, "1 resource of any type": `resources: 1`); every "cannot ready"
> card (All Tied Up, Restrained, Frozen, Wrapped in Chains, Captive Hope, Sowing Discord, Manufactured Drama) is the
> unchanged `cannotReady`, and so is Delusion of Collusion's "You cannot ready allies or [Persona] supports you
> control" (`sm` 27170, a `cannotReady` with `controller: "you"`).

Mister Fear: "As an additional cost for the engaged player to ready a hero or ally they control, the player must spend
a [mental] resource." Undermine Support (`aos` 50174), the same for a support. Unnatural Storm: "Heroes and allies
cannot be readied by player card effects." **Plan:** a `RuleSpec readyCost` and `cannotReady.bySource`.

### 3.20 A trigger on damage a card prevented

> **Status: landed (2026-09-24),** tested in `packages/engine/src/damage-prevented-trigger.test.ts` (4 tests: an attack
> for 3 against a "prevent all damage" villain is prevented and the preventing card hears `damagePrevented` and
> discards itself; an attack for 1 leaves it; 3 non-attack damage leaves it; a `preventDamage` effect's own amount
> prevented is bound, 3 discards the card and 1 keeps it; replay deep-equal). DSL:
> `packages/cards/src/dsl/wave4-hero-primitives.test.ts` (2 tests under §3.20).
>
> `damagePrevented` was only a log line (`reason: "tough" | "cancelled" | "effect" | "cannotTakeDamage" |
"reduced"`), naming no card and heard by nothing.
>
> - **`RuleSpec preventAllDamage { target, while? }`** (`damagePreventerOf`, `rules.ts`): "Prevent all damage to Ebony
>   Maw" is damage dealt and prevented (RRG 1.8 "Prevent", p. 34) by the card with the constant. Checked in
>   `applyDamage` after "cannot take damage" (RRG 1.8 "'Cannot'", p. 11, wins) and before tough, reductions and
>   piercing: excess damage is still measured, no tough card is used.
> - **`TriggerEvent damagePrevented { targetInstanceId, amount, preventerInstanceId, fromAttack, sourceInstanceId }`**
>   (response only, pushed when heard): the preventer is its source, so "After Abjuration prevents 2 or more damage
>   from a single attack" is `selfIs: "source"`, `fromAttack: true`, `eventAtLeast: { amount: 2 }` (`fromAttack` now
>   reads this event too). Announced for the constant and for a `preventDamage` effect (its card is the preventer); a
>   tough status, a reduction and "cannot take damage" are not a card preventing damage and announce nothing. One
>   attack deals one damage event per target, so "a single attack" is one event.
> - **`EffectSpec preventDamage.bind`**: `<bind>.amount` is the amount prevented this way.
>
> **DSL:** `preventAllDamageTo(target)`, `on.thisPreventsDamage({ fromAttack, atLeast })` (`dsl/abilities.ts`),
> `preventDamage(n, { bind })` (`dsl/effects.ts`).
>
> **Composes with:** Telekinetic Force Field (`next_evol` 40034, "If 2 or more damage was prevented this way"), Deflection
> (`drax` 19015, "equal to the amount prevented this way"; up to 5, so the bound amount is not the event's); Biogram
> Image (`gmw` 16074) already reads `eventAmount` and may keep it, as it prevents all.

Abjuration: "Prevent all damage to Ebony Maw. Forced Response: After Abjuration prevents 2 or more damage from a single
attack, discard it." **Plan:** check what `damagePrevented` carries; a trigger event naming the preventing card and
the amount.

### 3.21 An enemy attack against a chosen character

> **Status: landed (2026-09-24),** tested in `packages/engine/src/attack-chosen-character.test.ts` (3 tests: Crossfire's
> attack on P1 becomes an attack on P2's 1-hit-point ally, P2 is the one asked to defend, the ally is defeated, P1 is
> untouched and "when he attacks" is heard once; with no ally the hero with the fewest remaining hit points is attacked;
> Speed Demon's attack on the attacking ally resolves before the ally's attack; replay deep-equal). DSL:
> `packages/cards/src/dsl/wave4-hero-primitives.test.ts` (2 tests under §3.21).
>
> Wave 1 §3.6 had `enemyAttack.targetCharacter` (a new attack against a character, Clash of the Titans), which
> Speed Demon needs and nothing more; Crossfire's "When Crossfire attacks, he attacks …" is the same attack given a
> different target, which a replacement would get wrong (a new attack would trigger "when Crossfire attacks" again).
>
> - **`EffectSpec retargetAttack { character }`**: the innermost enemy attack, before any defender is declared, is
>   against that character; its controller becomes the attacked and target player (RRG 1.8 "Attack (Enemy
>   Activation)", p. 8: an attack against an ally a player controls still attacks that player), so that player
>   declares defenders. Updates the event and, if it has started, the procedure; logs `attackRetargeted`.
> - **DSL:** `retargetAttack(character)`; `enemyAttack(enemies, { targetCharacter })`, the wave 1 field that packs
>   had wrapped locally (`enemyAttackCharacter` in `wave1/hlk`, `wave1/gob`).
> - **Speed Demon** is `forcedInterrupt({ on: "attack", selfIs: "target" }, enemyAttack(self, { targetCharacter:
eventSource }))`: pushed from the interrupt window, it resolves before the player's attack ("Resolve Speed Demon's
>   attack first"). What happens to that attack if Speed Demon's defeats its attacker is §4 Q20.
> - **Crossfire** ties on "fewest remaining hit points" break with `bindTargets` + `chooseTarget` (first player), as any
>   superlative does.
>
> **Composes with:** Leaping Kick (`aos` 50096, "Batroc attacks the ally with the most remaining hit points … If there
> were no allies in play, Batroc attacks you"), Trample (`next_evol` 40128), Mad Genius (`gob` 02013) with
> `targetCharacter`; Cottonmouth (`luke_cage` 62029, "he attacks the same character 2 additional times") with
> `targetCharacter: eventTarget` and `afterCurrentActivation`; Make Me Angry / Energy Channel (`synthezoid`, `cw`
> leader modes) the same way.

Speed Demon: "When a character attacks Speed Demon, Speed Demon attacks that character. (Resolve Speed Demon's attack
first.)"; Crossfire: "When Crossfire attacks, he attacks the friendly character with the fewest remaining hit points."
**Plan:** check wave 1 §3.6's redirection first.

### 3.22 Valkyrie's kit

> **Status: landed (2026-09-24),** tested in `packages/engine/src/valkyrie-kit.test.ts` (10 tests: Death Perception
> plays the set-aside Death-Glow, paid for, onto the chosen enemy, and offers nothing when it is in hand instead; a
> basic attack by her defeats the Death-Glow enemy, Death-Glow goes to her set-aside area, she readies and "after the
> enemy with Death-Glow is defeated" fires; an event she played dealt the damage and she still readies; an ally's
> attack sets Death-Glow aside without readying her; Dragonfang +2/+1 by target; Valkyrie's Spear +2 DEF defending
> against the Death-Glow enemy; Shieldmaiden makes an exhausted hero a basic defender, DEF reducing the damage, nobody
> asked to declare, one `defended` event; The Best Defense… reduces by ATK; Thor's attack resolved against each engaged
> minion once, one consequential damage, his interrupt heard once; replay deep-equal). DSL:
> `packages/cards/src/dsl/wave4-hero-primitives.test.ts` (5 tests under §3.22).
>
> **Checked against every `valk` card** (`packages/content/raw/marvelcdb/valk.json`). Seven wordings needed something;
> the rest compose from existing vocabulary (below).
>
> - **`CardDestination "setAside"`**: "set this card aside, out of play" for a player card goes to its owner's
>   `PlayerState.setAside` (Valkyrie's Setup, "Not this Day.", Death-Glow). There was only `encounterSetAside`.
> - **`EffectSpec playFromHand.from: "setAside"`**: "Play the set-aside Death-Glow upgrade as if it were in your hand"
>   is `playFromHand` over the set-aside area, paid for (`costReduction: 0`), host chosen when several; every play
>   restriction still applies (`playFromEffectRestrictionFault` takes the zone).
> - **`TargetQuery.extensionOf: PlayerRef`** (`isIdentityExtension`, `select.ts`): the player's identity, events they
>   played, resources they spent, upgrades they control unless attached to another friendly character (RRG 1.8 "You,
>   Your", p. 49). "If Valkyrie defeated that enemy" is `refMatches(eventSource, { extensionOf: you }, anywhere)`, so an
>   event she played counts as her and an ally does not (§4 Q14). Exclusion code `notIdentityExtension`.
> - **`characterDefeated.attachedInstanceIds`** (stamped by `eventFrame` when the defeat goes on the stack, before any
>   interrupt) and **`EventPattern.targetHadAttachment`**: "After the enemy with Death-Glow is defeated" still sees
>   Death-Glow after its own forced interrupt set it aside and the enemy left play.
> - **`Predicate attackInProgress { attacker?, target?, defender? }`**: the innermost attack on the stack (player
>   attack, enemy attack, enemy attacking an enemy) matches every query. Dragonfang's "+2 ATK instead while attacking
>   the enemy with Death-Glow" is a stat modifier whose amount is `ifElse(attackInProgress(…), 2, 1)`.
> - **`EffectSpec declareDefender { character, exhaust? }`**: RRG 1.8 "Defend, Defense" (p. 15), "When a card ability
>   says to 'declare [a hero] the defender' of an attack, that hero is considered to be making a basic defense", and a
>   defense-labeled ability's hero "can still be declared the defender … by another card ability". Works on the
>   attack's procedure or, at "When … attacks", on its event (`declaredDefense` / `declaredBasicDefense` vars read by
>   `pushEnemyAttackFrame`); the declare-defender step is skipped once an effect named one. Re-declaring the labeled
>   defender only makes the defense basic, not a second `defended`. It does not announce `basicPowerUsed`.
> - **`modifyAttack.defenseUsesAtk`**: "use its ATK instead of its DEF for this attack"; `plannedAttackDamage` (the
>   one damage formula the resolver and the defend preview share) reduces by ATK. "When your hero defends" is the
>   basic defense's interruptible `basicPowerUsing` (§4 Q15).
> - **`EffectSpec resolveAttackAgainst { targets }`** and `attack.additionalResolution`: Thor's "resolve this attack
>   against each minion engaged with that player" pushes the same attack (attacker, damage, keywords, source) against
>   every other target it can attack; the attacker's own "when it attacks" does not trigger again, and there is one
>   consequential damage. Order: §4 Q11.
>
> **Compose as is:** "the enemy with Death-Glow attached" is `hasAttachment`; Shieldmaiden's "+2 DEF for this attack" is
> `modifyStat(…, "endOfAttack")`; Have at Thee! (`if` + `attack` with overkill); Trouble in Otherworld (`cannotAttack`
> with `attacker` and `target`); Chooser of the Slain, Angela (encounter searches, `putIntoPlay` engaged); Hall of Heroes
> (`on.defeated(…, { byYou })`, counters); Aragorn (`gets("hp")`, `gainsTrait`); Combat Training (`anyPlayerControl`);
> Throg, Visit Valhalla, Godlike Stamina, The Bifrost. Beguiled is §3.9; Problem Solvers and Cosmic Alliance §3.17.
>
> **DSL:** `playSetAside(filter)`, `declareDefender(character, { exhaust })`, `resolveAttackAgainst(targets)`,
> `modifyAttack({ defenseUsesAtk })` (`dsl/effects.ts`); `attackInProgress({ attacker, target, defender })`
> (`dsl/values.ts`); `on.defeated(what, { withAttachment })` (`dsl/abilities.ts`); `moveCards(…, "setAside")` and
> `query(…, { extensionOf: you })` need no builder.
>
> **Composes with:** Colossus (`aoa` 45031), "I Can Do This All Day" (`cw` 56047), Bamf! (`ncrawler` 48006) and Mutant
> Protectors (`mut_gen` 32017, `{ exhaust: true }`) with `declareDefender`; Two-Gun Kid (`cw` 56010, "resolve this
> attack against each of them") with `resolveAttackAgainst`; Harpoon (`angel` 42025) and Flash Freeze (`storm` 36012,
> "while attacking you") with `attackInProgress`; every "if [hero] defeated" / "after [hero] attacks" with
> `extensionOf`.
>
> **Client:** log and show `setAside` for player cards (the player's set-aside area) and the `notIdentityExtension`
> exclusion label (added to `view/highlights.ts`).

Death Perception ("Play the set-aside Death-Glow upgrade as if it were in your hand"), "the enemy with Death-Glow
attached" (`hasAttachment`, landed), Dragonfang / Valkyrie's Spear (+2 while attacking / defending against that enemy),
Shieldmaiden ("declare Valkyrie the defender without exhausting her"), The Best Defense… ("use its ATK instead of its
DEF for this attack"), Thor ("resolve this attack against each minion engaged with that player"). **Plan:** check each
against the vocabulary when `valk` comes up.

### 3.23 Reusable as is (checked against `pnpm dsl` and the engine)

| Printed wording                                                                    | Cards                                                 | Existing vocabulary                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| "Hela cannot be defeated"; ∞ hit points; flip resets the dial                      | Hela 21136b/21137b                                    | `cannotBeDefeated`, `infiniteHp` (wave 3 §3.1)                       |
| "When Hela would be defeated, if Odin is attached … flip her … instead"            | Odin's Torment 1B                                     | a defeat interrupt that flips (wave 3 §3.1)                          |
| "+2[per_hero] hit points for each side scheme in victory display"                  | Hela A1/B1                                            | `victoryDisplayCount`, a stat modifier (to confirm hit points scale) |
| "Threat cannot be removed from Gnipahellir"                                        | Garm, Skurge, Nidhogg, Zealot of Truth                | `threatCannotBeRemoved`                                              |
| "Attached identity cannot ready"                                                   | Frozen, Restrained                                    | `cannotReady`                                                        |
| "Pay the printed cost of an ally in any player's discard pile →"                   | Make the Call (21056, 23020)                          | `payPrintedCostOf`                                                   |
| "Double the number of resources … while paying for a Justice card"                 | The Power of Justice/Aggression                       | `doublesResourcesWhilePayingFor`                                     |
| "You may play the event attached to Black Panther as if it were in your hand"      | Black Panther 23012, Jocasta 26013                    | `playableAttachments`                                                |
| "generate a [wild] resource for a War Machine event"                               | Gauntlet Gun 23005                                    | `resource … generatesFor` (FAQ p. 62)                                |
| "resolve the 'Special' ability on each [Technique] upgrade you control"            | Nebula, Gamora ally, Lethal Intent, Combat Ready      | `resolveSpecials` / `resolveSpecialsOf`                              |
| "Reduce the amount of damage Vision takes from each attack by 2"                   | Intangible, Victor Mancha                             | `reduceDamageTaken`                                                  |
| "Treat your mass form upgrade's text box as if it were blank, except for keywords" | Corrupted Programming                                 | `blanksTextBox(q, { exceptKeywords: true })` (§3.28)                 |
| "The villain gains steady" / "each enemy gains steady"                             | Formidable Foe, The Hood's Mantle, Warehouse District | `gainsKeyword` + the RRG Steady rule (`keywords.ts`)                 |
| "For each different card type discarded this way"                                  | Time Stone                                            | `distinctCardTypes`                                                  |
| "Spend up to 3 resources of any type → … for each resource spent"                  | Machine Man 26022                                     | `spendUpTo` (wave 3 §3.25)                                           |
| "Play a card from your hand, reducing its resource cost by 3"                      | Meditation 26036                                      | `playFromHandReducingCost`                                           |
| "Put the top card of your deck into play facedown, engaged with you as a Drone"    | Ultron, Ultron Unleashed, Relentless Android          | `droneFromDeck`                                                      |
| "Attach to the villain who is not the active villain"                              | Direct Assault                                        | `AttachmentHost nonActiveVillain`                                    |
| "Each player removes the top half of their deck (rounded down) from the game"      | Balance the Scales 2B                                 | `deckCountOf` + `scaled`                                             |
| "(Limit once per phase.)" on James Rhodes (errata)                                 | 23001b                                                | `oncePerPhase`                                                       |

---

### 3.24 A character that ignores guard, patrol and the crisis icon

Evasive Maneuvering (`nebu` 22005): "While in hero form, Nebula ignores the guard keyword, the patrol keyword, and the
crisis icon." Survey (every raw pack, "ignore(s) … guard/patrol/crisis"): the same standing exemption on Wasp
(`ironheart` 29034), Shadowcat's ally and Phased form (`mut_gen` 32002, 32030a) and Psionic Training (`psylocke` 41010,
guard and patrol). Every other hit is one effect's own (Cable Arrow, Natural Flight, Photon Speed, Retinal Display,
Grapnel Launcher, Just Passing Through, …) and is the existing `ignoreCrisis` on `thwart` / `removeThreat`.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/character-ignores.test.ts` (4 tests: guard no longer
> stops the exempt hero attacking the villain; its basic thwart and "(thwart)" ability remove threat from the main
> scheme past patrol and a crisis icon; a removal that is neither its thwart nor its own is still stopped by the
> crisis icon; a character the rule does not match is not exempt) and in a real game in
> `packages/cards/src/wave4/nebu/nebula-kit.test.ts` (Nebula against Rhino, Hydra Mercenary engaged and Crowd Control
> in play). **What landed:** **`RuleSpec characterIgnores {target, ignores: ("guard" | "patrol" | "crisis")[],
while?}`**, read by `select.ts characterIgnores`: `canAttack` lets a matching attacker past guard; `threatRemovalBlocked`
> (now told the thwart's character) skips patrol for a matching thwarter and the crisis icon for a matching thwarter
> or removal source; the basic-thwart command's own crisis and patrol checks use the thwarting character. **DSL:**
> `constant(ignores(query, what, when?))`. **Scripted:** `22005.evasive-maneuvering-constant`, off `KNOWN_SKIPPED`.
> **Composes with:** Wasp, Shadowcat, Psionic Training as printed. The response cards that fire after a character
> ignores guard or crisis (Acute Control, Intangible Interference, `mut_gen` 32034–32035) need an event; not built.
> See §4 Q19 for the reading of "ignores the crisis icon" on removal that is not a thwart.

### 3.25 Discarding cards you control as a cost

Lethal Weapon (`nebu` 22030): "Hero Action: Discard an upgrade you control → discard this attachment." Survey (every raw
pack, "discard a/an <X> you control →"): Noble Sacrifice and "You Got This!" (`magneto` 49018, 49019, an ally), Repurpose
(`spdr` 31016, a [Tech] upgrade), Delusion of Collusion (`sm` 27170, an ally or [persona] support), Tinkering (`gmw`
16029b, already scripted as a chosen discard in its effects, which lets it be used with nothing to discard; it can move
to this cost), The Ends Justify the Means (`aos` 50177, a chooseOne branch whose cost this is). Haywire and Air Static
(`ironheart` 29038, 29039) put the discard inside a "choose to either … or take 2 indirect damage" cost, which this
does not cover.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/discard-cost.test.ts` (3 tests: the only matching card
> is discarded to pay, then the effect resolves, replay deep-equal; with no matching card the cost cannot be paid, so
> the card is neither offered nor playable; with a choice, the player names the card and the other stays) and in a real
> game in `packages/cards/src/wave4/nebu/nebula-obligation-nemesis.test.ts` (Lethal Weapon on the Gamora ally,
> discarding Evasive Maneuvering). **What landed:** **`AbilityCost.discardCards: InPlayCostPick`**, a third
> `InPlayCostMode` ("discard") beside exhaust and return: the same candidates (cards in play the payer controls that
> match, or any player's for an alliance card), payable only by a card that can leave play, paid by discarding each
> pick; the window's cost-card prompt (`chooseCostCards.mode`) carries it. **DSL:** `discardCardsCost(query, opts)`,
> binding `"discarded"`. **Scripted:** `22030.lethal-weapon-action`, off `KNOWN_SKIPPED`.

### 3.26 A friendly character attacks its own player

Old Rivals (`nebu` 22031, errata RRG 1.8 p. 67): "When Revealed: Gamora attacks you. If the Gamora hero or ally is in
play, she attacks you (resolve her ATK against you without exhausting her). If no attack was made this way, this card
gains surge." Ruling Jun 25, 2026 (4) #1: the first sentence is the Gamora minion, the second the hero or ally. FAQ (RRG
1.8 p. 62): she "is considered to have attacked", and an ally takes consequential damage. Survey (every raw pack, "X
attacks you" naming a hero or ally): no other card makes a friendly character attack its own player; every other "X
attacks you" is an enemy (`enemyAttack`).

> **Status: landed (2026-09-24),** tested in `packages/engine/src/friendly-attack.test.ts` (3 tests: the ally's ATK is
> dealt to you as her attack, she is not exhausted, takes her consequential damage, no surge, replay deep-equal; with no
> Gamora in play no attack is made and the card surges; a stunned Gamora discards the stun instead and the card surges)
> and in a real game in `packages/cards/src/wave4/nebu/nebula-obligation-nemesis.test.ts` (Nebula against Rhino, the
> Gamora ally in play, Old Rivals revealed in the villain phase; and alone, where it surges). **What landed:**
> **`EffectSpec friendlyCharacterAttacks {attacker, player, bind?}`**: the first friendly character the ref names (a
> hero-form identity or an ally a player controls) makes her controller's `attack` against `player`'s identity, with
> no boost, no defense step and no exhausting, followed by an ally's consequential damage (`pushConsequentialDamage`,
> now exported); a stunned attacker or a "—" ATK makes no attack, reported as `<bind>.made` 0. **DSL:**
> `friendlyCharacterAttacks(attacker, player?, { bind })`. **Scripted:** `22031.when-revealed` (the minion's
> `enemyAttack`, then this, then surge if neither was made); Nebula's `KNOWN_SKIPPED` is now empty.

### 3.27 A cancel with nothing it can cancel is not offered

§4 Q16, as the user decided it on 2026-09-24: a cancel aimed at a card that cannot be canceled (the Cosmic Entities,
§3.14; Longshot, Cornered!, the `sm` expert treacheries, anything under Dark Scepter) is hidden from the legal actions,
so it is never offered and no cost is paid.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/cancel-no-target.test.ts` (2 tests: against an
> ordinary treachery the optional cancel is offered and its exhaust cost paid; against a card that cannot be canceled
> it is never offered, nothing is exhausted, and the card's When Revealed resolves). **What landed:** the trigger
> candidate scan (`resolve/triggers.ts cancelHasNoTarget`) drops any ability whose top-level effects cancel the card
> being revealed (`cancelWhenRevealed`, `cancelRevealedCard`) when `revealCannotBeCanceled` holds for it: in play, used
> from hand (`activeIn: "hand"`), and events played from hand in the window, forced or optional. The reading is RRG 1.8
> "Initiating Abilities" (p. 24, step 2): the revealed card is the cancel's target, and with no valid target the
> ability cannot be initiated, so the whole ability (Order and Chaos's damage and Black Widow's extra reveal included)
> is not offered. The §3.14 check in the cancel effect itself stays as the backstop.

### 3.28 A blank text box except for keywords

Corrupted Programming (`vision` 26028): "Treat your mass form upgrade's text box as if it were blank, except for
keywords." RRG 1.8 "Blank" (p. 10) blanks keywords with the text box, so the exception has to be carried. Survey (every
raw pack, "blank … except"): every other card says "except for [Traits]", which the engine already keeps (a blanked
card's traits are untouched). This was §3.1's open item.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/blank-except-keywords.test.ts` (2 tests: blanked
> "except for keywords", a mass form upgrade loses its abilities but keeps its form and other keywords; a plain blank
> takes the keywords too, and with no blank everything is live). **What landed:** **`RuleSpec blankTextBox.exceptKeywords`**:
> `blankedByConstantRules` now keeps two sets, every blanked card and those whose keywords go too; `keywordsBlankFor`
> (`select.ts`) is what `printedKeywordsOf` (and so `activeFormType`, `hasKeyword`) reads. **DSL:**
> `blanksTextBox(query, { exceptKeywords: true })`. The `vision` scripter targets "your mass form upgrade" with
> `query("upgrade", { controller: "you", printedForm: "mass" })`.

### 3.29 A minion treated as an ally (the mirror of §3.9)

The mirror of §3.9. Survey (every raw pack, "treat … as a [X] ally"): Mind Control (`phoenix` 34009) and Redemption
(`bp` 51036), upgrades on a minion; Karma (`rogue` 38011), an effect lasting "while Karma is in play". Each: "take
control of [the] minion and treat it as a [Controlled/Redeemed] ally with a blank text box. Its THW is equal to its
printed SCH and it takes 1 (Karma: 2) consequential damage after it thwarts or attacks."

> **Status: landed (2026-09-24),** tested in `packages/engine/src/treat-as-ally.test.ts` (4 tests: under a Mind Control
> upgrade the minion is the player's ally, in their play area, not engaged, [Controlled] only, text box blank, THW =
> printed SCH, still attached, replay deep-equal; it thwarts with that THW and takes 1 consequential damage; with the
> upgrade discarded it is a minion again, engaged with the player who controlled it; a Karma-like effect's minion is an
> ally while the card is in play and a minion again once it leaves). **What landed:** `TreatedAs` is now a union;
> kind **`ally`** (`traits`, `thwFromSch`, `consequential`, `source`, `controller`, `engagedBefore`) comes from
> **`RuleSpec treatHostAsAlly {traits, thwFromSch?, consequential}`** on an attachment (the attachment's controller
> takes control; `syncTreatedAs` as for §3.9) or from **`EffectSpec treatAsAlly {target, traits, thwFromSch?,
consequential}`** (source = the effect's card; `leavePlay` calls `releaseTreatedBy`). Readers: `categoriesOf`
> (`ally`, `character`), `isMinion` false, traits, blank abilities and keywords, `printedProfile` (an ally profile from
> printed ATK, SCH-as-THW and hit points), `pushConsequentialDamage` (its own amount; an ally treated as a minion takes
> none). The `isAlly` play-area readers from §3.9 pick it up as an attacker, thwarter and defender, and it counts
> toward the ally limit (none of the three cards says otherwise). **DSL:** `constant(treatAttachedMinionAsAlly(traits,
n))`, `treatAsAlly(target, traits, n)`. **Not covered:** Reluctant Foe (`aos` 50171: a hero from the collection
> treated as an [Elite] minion with a replaced text box).

### 3.30 A resource ability's own effects

Gauntlet Gun (`warm` 23005): "Resource: Exhaust Gauntlet Gun → generate a [wild] resource for a War Machine event and
place 1 ammo counter on War Machine." Survey (every raw pack, "Resource: … generate … resource … and/then …" and
"Resource: … . <effect>"): War Cry, Improvisation, Bodyguard, Fortitude (`mut_gen` 32180, 32185, 32190, 32195: "Gain a
tough status card" / "Ready an ally and heal 2 damage from it" / "Draw 1 card" / "Stun an enemy", then "Remove this card
from the game and the campaign pool"); Psi-Knife / Psi-Katana (`psylocke` 41002a/b, "You may flip this card");
Cybernetic Arm (`winter` 54002, "That event deals 1 additional damage") and Ruby Quartz Visor (`cyclops` 33003, "That
attack gains piercing and ranged"), which modify the card paid for.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/resource-effects.test.ts` (2 tests: used to pay, the
> resource ability's effect resolves with the payment and before the card paid for, replay deep-equal; not used,
> nothing happens) and in a real game in `packages/cards/src/wave4/warm/war-machine-kit.test.ts` (Repulsor Beam paid
> with the Gun's resource gets the ammo counter; paid from hand, the Gun stays ready and no counter lands).
> **What landed:** `payPayment` now returns a **`SpentPayment`** (`cards` discarded, and `resourceAbilities` used
> that carry effects); **`announceResourcesSpent`** takes it and, after the "after you spend" events, pushes each used
> resource ability's `effects` (so they resolve first: part of paying, RRG 1.8 "Initiating Abilities", p. 24, steps
> 5–6), with "you" the player who used it, "self" its card, and slot **`paidFor`** the card or ability paid for (for
> "that event deals 1 additional damage"). A resource ability used for nothing (never put in a payment) does nothing.
> Log event `resourceAbilityEffects`. **DSL:** `resource(generates, options, ...effects)` / `heroResource(...)`.
> **Scripted:** `23005.gauntlet-gun-resource` now places the counter. **Composes with:** the `mut_gen` campaign
> upgrades (effects plus `moveCards(self, "removedFromGame")` and the campaign-pool removal), Psi-Knife (an optional
> `flipCard(self)`), Cybernetic Arm and Ruby Quartz Visor (a modifier on `chosen("paidFor")`; the "that attack"
> modifier itself is the scripter's to pick from the existing attack modifiers).

### 3.31 A character that cannot defend

Intangible (`vision` 26002): "Vision cannot attack or defend." Survey (every raw pack, "cannot defend"): Grant Ward
(`aos` 50022, "Grant Ward cannot defend."), Tracking Display (`sm` 27152, "Each character cannot defend against
attached villain's attacks."). Taunt (`angel` 42016, `cw` 56048, "Other characters cannot defend against this attack")
is scoped to one attack and is not covered here.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/cannot-defend.test.ts` (2 tests: a character that
> cannot defend is never offered, the others are; scoped to the villain's attacks, nobody may defend the villain but a
> minion's attack is defended as usual) and in a real game in `packages/cards/src/wave4/vision/vision-kit.test.ts`
> (Intangible Vision can neither attack the villain nor defend; Dense Vision can do both). **What landed:**
> **`RuleSpec cannotDefend {target, attacker?, while?}`** (`rules.ts cannotDefend`), read by `legalDefenders` (now
> given the registry and the attacking enemy, and exported from `@mc/engine`), by the defender prompt's why-not
> (exclusion `cannotDefend`, with a client label) and by a "(defense)" ability, which does not make such a character
> the defender. **Scripted:** `26002.intangible-constant` (`cannotAttack` on the attacking host plus this), off
> `KNOWN_SKIPPED`.

### 3.32 One thwart that ignores patrol

Just Passing Through (`vision` 26010): "Hero Action (thwart): Remove 3 threat from a scheme, ignoring the patrol keyword
and the crisis icon." The one-shot sibling of §3.24. Survey (every raw pack, "ignor… patrol"): Natural Flight (`angel`
42006, "If you are Angel, this thwart ignores the crisis icon and the patrol keyword"), Grapnel Launcher (`jj` 61023, "For
this thwart … ignores the patrol keyword and any crisis icons", a basic thwart made by effect), Retinal Display's back
(`sm` 27186b, "your hero's basic thwarts ignore the crisis icon and the patrol keyword", standing: `characterIgnores`
scoped to basic thwarts is not built).

> **Status: landed (2026-09-24),** tested in `packages/engine/src/character-ignores.test.ts` (1 new test: the thwart
> removes threat from the main scheme past patrol, with and without a crisis icon, and the next ordinary thwart is
> stopped, by patrol or crisis) and in a real game in `packages/cards/src/wave4/vision/vision-kit.test.ts` (Intangible
> Vision against Rhino with Crowd Control's crisis icon in play). **What landed:** **`EffectSpec thwart.ignorePatrol`**,
> carried on the `thwart` event and read by `threatRemovalBlocked` for the removal that thwart makes. **DSL:**
> `thwart(n, target, { ignorePatrol: true })`. **Scripted:** `26010.just-passing-through-action`, off `KNOWN_SKIPPED`.

### 3.33 A card with a given timing word in its text

Phase Disruption (`vision` 26011): "Confuse an enemy. Choose an attachment on that enemy with the text 'Hero Action' or
'Hero Response' and discard that attachment." Survey (every raw pack, "with the text" / "with a '…' ability"): Phase
Strike (`mut_gen` 32038), Sunfire (`wolv` 35014), Electromagnetic Blast (`magneto` 49008), Disarming Defense
(`wonder_man` 58033), all "Hero Action" or "Hero Response"; Target Lock and Phased Out (`cw` 56130, `synthezoid` 57076),
"Hero Response" or "Hero Interrupt"; Warpath (`angel` 42013), "an event with a 'Hero Action' ability".

> **Status: landed (2026-09-24),** tested in `packages/engine/src/ability-timing-query.test.ts` (3 tests: matches the
> attachments carrying the named timing words and not a Forced Response; a blanked text box has none; each trigger
> shape maps to its printed timing word) and in a real game in `packages/cards/src/wave4/vision/vision-kit.test.ts`
> (Rhino with Lethal Weapon attached: Phase Disruption confuses him and discards it). **What landed:** **`TargetQuery
abilityTiming: AbilityTimingWord[]`** ("heroAction", "heroResponse", "forcedInterrupt", …) matched against the card's
> live abilities through `select.ts timingWordOf` (trigger kind + form label + forced), exclusion `noSuchAbility`
> with a client label. The printed word is read from the script's trigger shape, which the ability DSL already makes
> match the printed label (`heroAction`, `heroResponse`, …). **Scripted:** `26011.phase-disruption-action`, off
> `KNOWN_SKIPPED`.

### 3.34 The attacking enemy from any trigger

Flow Like Water (`vision` 26016): "Response: After you play a [Defense] card, deal 1 damage to the attacking enemy." The
trigger is the play, not the attack, so `eventSource` names the played card. Survey (every raw pack, "the attacking
enemy"): Riposte, Tally Ho! (`ncrawler` 48018, 48011), Spider-UK (`sm` 27012), Daredevil (`spdr` 31014), Never Back Down
(`qsv` 14014), Disarming Defense (`wonder_man` 58033); most sit on an attack-scoped trigger and already read
`eventSource`, but any of them can use this ref.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/attacking-enemy.test.ts` (2 tests: nothing outside an
> attack; the innermost attack's enemy during one) and in a real game in
> `packages/cards/src/wave4/vision/vision-pack-cards.test.ts` (Dense Vision with Flow Like Water plays Mass Increase
> against Rhino's attack; Rhino takes 1 damage). **What landed:** **`TargetRef attackingEnemy`**, the sibling of
> `defendingCharacter`: the enemy of the innermost `enemyAttack` on the stack, if in play. **DSL:** `attackingEnemy`.
> **Scripted:** `26016.flow-like-water-response`, off `KNOWN_SKIPPED`.

### 3.35 Discard a boost card instead of applying it

Defiance (`vision` 26018): "Hero Interrupt (defense): When a boost card on an enemy attacking you would be turned faceup,
discard it instead." `cancelBoostIcons` / `cancelBoostAbility` cancel parts of a boost card that is still applied; this
removes the card from the activation altogether. Survey: Close Call (`gmw` 16158, "cancel that card's 'Boost' ability and all of its boost icons, then discard it") is the same outcome.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/boost.test.ts` (1 new test: the boost card's ability
> does not resolve, its icons are not added, and it goes to the encounter discard pile) and in a real game in
> `packages/cards/src/wave4/vision/vision-pack-cards.test.ts` (Defiance against Rhino's attack). **What landed:**
> **`EffectSpec discardBoostCard {bind?}`**: in the resolving boost card's turned-faceup window, it cancels the card's
> ability and icons and moves it to its discard pile at once, so the count step finds nothing to apply; game event
> `boostCancelled` gains scope `"discarded"` (client log line and villain-phase breakdown label added). The engine turns
> the card faceup and then opens that window, so "would be turned faceup" is answered there. A response "after a
> boost card is turned faceup" still sees the event; no printed card combines the two. **DSL:** `discardBoostCard()`.
> **Scripted:** `26018.defiance-interrupt`, off `KNOWN_SKIPPED`.

### 3.36 An event pattern that accepts several values

Machine Man (`vision` 26022): "Interrupt: When Machine Man attacks or thwarts, spend up to 3 resources of any type →
Machine Man gets +1 THW and +1 ATK for this use for each resource spent this way." "For this use" needs the
`basicPowerUsing` interrupt (before the power's value is read), which also carries his defense. Survey (every raw pack,
"attacks or thwarts"): Elixir, Power Gloves, Gamora (`drax`), Adam Warlock, Falcon, Agent 13, Spider-Man (`silk`, `sm`),
Spider-Ham, Absorbing Man (`tt`), Cosmo; all but Machine Man and Absorbing Man are responses to the attack/thwart
events and already use `on.attacksOrThwarts`.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/event-is-list.test.ts` (1 test: `{ power: ["attack",
"thwart"] }` matches an attack or a thwart and not a defense) and in a real game in
> `packages/cards/src/wave4/vision/vision-pack-cards.test.ts` (Machine Man thwarts, the player spends two cards, and
> he removes his THW plus the resources spent, to a maximum of 3). **What landed:** **`EventPattern.eventIs` values
> may be lists** (any one matches). DSL `on.basicPowerUsing(who, { power: [...] })`. **Engine fix found on the way:**
> an in-play triggered ability whose only resource cost is an X ("spend up to 3") skipped the payment prompt and
> resolved with X = 0; `triggerCandidate` now asks for payment whenever the cost has `resourcesX`, as the window-event
> path already did. **Scripted:** `26022.machine-man-interrupt`, off `KNOWN_SKIPPED`.

### 3.37 Interrupts to a side scheme's defeat

Chance Encounter (`vision` 26034, reprinted `fne` 60025): "Interrupt: When attached side scheme is defeated, search your
deck and discard pile for an ally and add it to your hand." Survey (every raw pack, "when attached (side) scheme is
defeated"): Followed (`cap` 03032, `spiderham` 30018), Ambush (`deadpool` 44051), Twisted Reality (`trors` 04135, forced).
`schemeDefeated` was response-only, and the scheme's attachments leave play with it before the response window, so
none of these could fire. **Decision (the RRG-correct one of the two asked about):** give the defeat an interrupt
window, not a `targetHadAttachment` escape hatch. RRG 1.8 "When Defeated Abilities" (p. 48) makes a scheme's own When
Defeated a forced interrupt and says the card "leaves play after its 'When Defeated' ability is resolved", so the
scheme, and everything attached to it, is in play while "when … is defeated" interrupts resolve.

> **Status: landed (2026-09-24),** tested in `packages/engine/src/scheme-defeat-interrupt.test.ts` (1 test: an
> attachment's forced interrupt fires with the scheme still in play, the same ability as a response does not fire, the
> scheme then leaves play; replay deep-equal) and in a real game in `packages/cards/src/wave4/vision/vision-pack-cards.test.ts`
> (Chance Encounter on Crowd Control; Vision thwarts it to 0 and an ally comes to hand). **What landed:**
> `schemeDefeated` is now interruptible (`isAnnouncement`); `applyRemoveThreat` pushes only the event, whose apply
> step (`applySchemeDefeated`) pushes the scheme's When Defeated and its leave-play step (the flip-guard from §3.10
> kept), so the order is: interrupts → When Defeated → leaves play (attachments with it) → responses. A scheme an
> interrupt already removed does nothing more. **Scripted:** `26034.chance-encounter-interrupt`, off `KNOWN_SKIPPED`
> (Vision now has none). **Fixed on the way:** Twisted Reality (`trors` 04135) was scripted as a forced _response_
> and never fired; it is now the forced interrupt it prints. Followed (`cap` 03032) was already an interrupt and now
> actually fires. Ambush (`deadpool`) and the `fne` Chance Encounter are not scripted yet.

### 3.38 Resources generated by reading the table

Energy Duplication (`mts` 21006): "Hero Resource: Exhaust Energy Duplication → generate the printed resource on your
faceup energy form upgrade." Band Together (`mts` 21018, a resource card): "This card generates [wild] for each ally you
control (to a maximum of 3)." Survey (every raw pack, "generate … resource … on / for each"): Storm's Crown (`storm`
36006, "the printed resource on your [Weather] support"); Cat's Head Amulet (`cw` 56004, "[physical] for each minion
engaged with you, to a maximum of 3"); Olympus (`hercules` 59012, "[wild] for each [Gift] card you control"); Titanium
Muscles (`mut_gen` 32005, "for each tough status card on Colossus", a status count, not a card count: not covered);
Montage (`deadpool` 44007, "1 additional [wild] for each acceleration token", additive: not covered).

> **Status: landed (2026-09-24),** tested in `packages/engine/src/resource-generation-read.test.ts` (2 tests: "[wild]
> for each ally you control, to a maximum of 3" at 0, 2 and 5 allies; "the printed resource on" a named card, none
> without it) and in real games in `packages/cards/src/wave4/mts/spectrum-kit.test.ts` (Energy Duplication generates
> Gamma's [physical], nothing with every form facedown) and `spectrum-pack-cards.test.ts` (Band Together is worth one
> [wild] per ally Spectrum controls). **What landed:** two `ResourceGeneration` variants read when the resource is
> generated: **`printedResourcesOf {cards}`** and **`perCard {resource, per, max?}`**; `generatedResources` now takes
> the generating card and its user (every caller passes them). **`ConstantTrigger.handGenerates`**: what a card
> generates when spent from hand instead of its printed resources (read by `handCardResources`). `generatedResources`
> and `handCardResources` are exported. **DSL:** `printedResourcesOf(query)`, `generatesPerCard(resource, query, max?)`,
> `constant({ handGenerates })`. **Scripted:** `21006.energy-duplication-resource`, `21018.band-together-constant`,
> off `KNOWN_SKIPPED`.

### 3.39 A keyword granted until a duration ends

Pulsar Shield (`mts` 21009): "… If you were already in Pulsar energy form, she gains retaliate 1 until the end of the
phase." Survey (every raw pack, "gain(s) [keyword] … until"): Cuts Both Ways (`cw` 56050, "you gain retaliate 1 until
the end of the phase"); Claw Mastery (`x23` 43005, "her attacks gain overkill" until the end of the round, an attack
keyword, which the existing attack-keyword grants cover).

> **Status: landed (2026-09-24),** tested in `packages/engine/src/keyword-until.test.ts` (1 test: the identity has
> retaliate 1 for the rest of the phase and not after, replay deep-equal) and in a real game in
> `packages/cards/src/wave4/mts/spectrum-kit.test.ts` (Spectrum already in Pulsar defends Rhino's attack with Pulsar
> Shield; Rhino takes the retaliate damage, and with a retaliate 0 grant he does not). **What landed:**
> **`EffectSpec grantKeywordUntil {keyword, target?, affects?, until}`**, a lasting `keywordGrant` read by
> `grantedKeywords` beside constant grants, expiring like the other lasting effects. **DSL:** `gainKeywordUntil(keyword,
target, until)`. **Scripted:** `21009.pulsar-shield-interrupt`, off `KNOWN_SKIPPED`.

### 3.40 Scenario rules with no card behind them

MC21 p. 6 (Ebony Maw): "When a player reveals a Spell environment, they place that card in front of them in their play
area." A rulebook rule printed on no card, so the §3.16 `entersRevealersPlayArea` RuleSpec had nothing to hang on. No
earlier scenario did this: wave 3's Collection rules are printed on the Collector's own cards. Other rulebook-only
rules the same field can carry as they are reached: any scenario insert rule expressible as a `RuleSpec`.

> **Status: landed (2026-09-25),** tested in `packages/engine/src/spell-environments.test.ts` (1 new test: with the
> rule seeded at setup and no card granting it, a revealed Spell goes to the revealer's play area; without it, to the
> villain's area) and in real games in `packages/cards/src/wave4/mts/ebony-maw.test.ts` (the Ebony Maw scenario
> carries the rule; Attack on Knowhere 1B's When Revealed puts a Spell into the player's area at setup and none into
> the villain's area; Channeling Trance with no Spell in your play area puts one there). **What landed:**
> **`GameSetupConfig.scenarioRuleSpecs: RuleSpec[]`**, stored as **`ScenarioRules.rules`** and read by `activeRules`
> like a constant on a card in play, with no card as "self" and nobody as "you" (the state-check gates for
> `controlledByFirstPlayer` and `focusedMainScheme` see them too). `putIntoPlay` of an encounter card already routes
> through the reveal placement, so "puts that card into play in their play area" follows the rule as well.
> **Cards:** `wave4/setup.ts` keeps `SCENARIO_RULE_SPECS` by scenario id, and `mts/ebony-maw.ts` exports
> `EBONY_MAW_SCENARIO_RULES`. **Scripted:** 21072/21073 `.when-revealed`, `21074b.when-revealed`,
> `21075a.when-revealed`, `21081.when-revealed`, all off `KNOWN_SKIPPED`. Two existing Ebony Maw tests were adjusted:
> the setup Spell now exists (pick the newly revealed copy; start the scheme at 0 so the phase cannot complete 1B),
> and a filler goes under a staged Spell so its surge cannot reveal Channeling Trance.

### 3.41 A stat totalled over several cards

Mass Attack (`mts` 21016): "Hero Action (attack): Exhaust 3 allies you control that share a [Trait] with your hero → deal
X damage to an enemy, where X is the total ATK of those allies and your hero." The three allies are one multi-card cost
pick; `statOf` read only the first card. Survey (every raw pack, "total ATK/THW/SCH"): Fastball Special (`wolv` 35023,
"the total ATK of Colossus and Wolverine"), Partnership of Pain (`sm` 27111, "the total SCH of all other villains");
Exodus's "his total ATK" is one card. "Share a trait with your hero" is the existing `TargetQuery.sharesTraitWith`.

> **Status: landed (2026-09-25),** tested in `packages/engine/src/stat-total.test.ts` (1 test: `total` sums the stat
> over every card the ref names; without it, the first card) and in a real game in
> `packages/cards/src/wave4/mts/spectrum-pack-cards.test.ts` (Spectrum exhausts Blue Marvel, Kaluu and Blade for Mass
> Attack; Rhino takes their ATK plus hers). **What landed:** **`ValueSpec stat.total`**. **DSL:** `totalStatOf(ref,
stat)`. **Scripted:** `21016.mass-attack-action` (`exhaustCardsCost` of 3 allies sharing a trait with your identity,
> bound to `allies`), off `KNOWN_SKIPPED`.

### 3.42 A deck-discard cost sized by the triggering event

Shield Spell (`mts` 21061): "Hero Interrupt (defense): When you would take any amount of damage from an attack, discard
that many cards from the top of your deck → prevent all damage from this attack." A cost sized by the triggering event;
`AbilityCost.discardFromDeck` was a fixed number.

> **Status: landed (2026-09-25),** tested in a real game in `packages/cards/src/wave4/mts/adam-warlock-pack-cards.test.ts`
> (Adam Warlock takes Rhino's attack undefended and plays Shield Spell: exactly that many cards leave his deck and the
> whole amount is prevented). **What landed:** **`AbilityCost.discardFromDeck: number | ValueSpec`**; a value is read
> against the event of the innermost open window (the one the ability is used in), both when the cost is checked
> (enough cards in the deck) and when it is paid (`actions.ts deckDiscardCount`); outside a window it reads with no
> event. **DSL:** `discardTopOfDeckCost(eventAmount)`. **Scripted:** `21061.shield-spell-interrupt`, off
> `KNOWN_SKIPPED`.

### 3.43 A branch's bindings reach the effects after it

The scripter's question: a `selectCards` (or any) binding made inside a `chooseOne` option, which runs as a child frame,
was not visible to a sibling effect after the `chooseOne`; the same held for `if` branches. It failed silently (an
empty slot: 0 damage, nothing moved). **Decision: propagate.** Printed text reads that way ("Choose one: … . Then …
the card discarded this way"), only one branch runs so the binding is well defined, and a slot no taken branch bound
still reads empty, which is what "if you discarded one" wants. Rejecting it in the validator would have forced every
such card to duplicate its tail into each branch.

> **Status: landed (2026-09-25),** tested in `packages/engine/src/branch-bindings.test.ts` (2 tests: a binding made in
> a `chooseOne` option and in an `if` branch is read by the effect after it; both fail without the change). **What
> landed:** an effects frame pushed for a branch carries **`returnBindingsTo`** (the frame that ran it); when the
> branch finishes, its bindings and vars are written back to that frame (`chooseOne`, its multi-pick form, and `if`).
> **Scan of every registered script** (`WAVE4_DEPS`, which includes Core through wave 4) for an effect that reads a
> slot bound only inside an earlier `chooseOne`/`if` branch: one hit, Adam Warlock (`stld` 17011), a false positive
> (each later branch rebinds `scheme`/`enemy` before reading it). No other script had the latent bug; the four the
> scripter already restructured (Magic Attack, Zone of Silence, Karmic Blast, Cosmic Awareness) are correct as they
> are and can be simplified if wanted. Full suite unchanged.

### 3.44 Players cannot discard these cards

Powerful Enchantments (`valk` 25030): "Players cannot discard attachments that are attached to friendly characters."
`cannotLeavePlay` is too strong: the host's defeat must still discard them, and so must an encounter card's own effect.
Survey (every raw pack, "cannot discard" / "cannot be discarded"): Mission Team (`aoa` 45171, "cannot be discarded", an
absolute rule `cannotLeavePlay`-shaped, not this).

> **Status: landed (2026-09-25),** tested in `packages/engine/src/players-cannot-discard.test.ts` (2 tests: a player's
> event cannot discard the attachment on their hero, and says why; an encounter treachery's When Revealed still
> discards it) and in a real game in `packages/cards/src/wave4/valk/valkyrie-obligation-nemesis.test.ts` (with
> Powerful Enchantments in play, Lethal Weapon's own "discard this attachment" leaves it on Valkyrie; without, it goes).
> **What landed:** **`RuleSpec playersCannotDiscard {target, while?}`**, read by `discardFromPlay` and by
> `moveCards … "discard"` when the effects frame is **`byPlayer`**. `byPlayer` is set when an ability frame pushes its
> effects: an ability on a player card, an action or resource ability, or an optional interrupt or response (a forced
> ability, When Revealed, boost or setup on an encounter card is not a player's), and it carries into `chooseOne`/`if`
> branches. Game event `discardRefused`. **DSL:** `constant(playersCannotDiscard(query))`. **Scripted:**
> `25030.powerful-enchantments-constant` (attachments whose host is an identity or an ally a player controls), off
> `KNOWN_SKIPPED`; Valkyrie now has none. **Not covered:** a protected card paid as a cost (a "discard this card →"
> cost on an encounter attachment, or an in-play discard cost); no printed card combines the two.

## 4. Open questions (for the user or FFG)

Each is implemented the way stated, or not at all, and named here rather than decided silently.

1. **Changing to an energy form while in another** (§3.1). The cards say "flip that card faceup to change to that energy
   form"; neither MC21 nor the RRG says the old form turns facedown. Implemented as: one energy form faceup at a time
   (the previous one turns facedown), because "If you were already in Gamma energy form" and Energy Duplication's "your
   faceup energy form upgrade" assume one.
2. **"The main scheme" in a player constant with one main scheme and no Focused Defense in play** (§3.2): only arises
   before 2A resolves. Implemented as the central scheme.
3. **Loki's damage on a defeat-advance** (§3.7). MC21 p. 24 transfers "counters, and tokens" to the new Loki on defeat;
   RRG 1.8 "Villain Defeat" (p. 47) carries "non-damage tokens" to a same-title stage and "Excess damage … does not carry
   over". Implemented as: damage does not carry on defeat; on a swap the dial stays (RRG "'Swap'").
4. **Tower Defense's suggested setup damage** (MC21 p. 11) is a difficulty option. Standalone default: none.
5. **Standard II / Expert II** replace or join Standard / Expert? The Hood insert (not in the repo) says; until it is
   read, games use Standard / Expert and Standard II is never chosen.
6. **An eliminated player in the expert campaign** (§2.2): MC21 p. 25 lets them rejoin "by placing an acceleration token";
   the gate lets them decline the heal and start at 0 hit points. Proposed: an identity whose recorded hit points are 0
   must take the heal.
7. **Hela's "When Hela is defeated, if Odin is not attached to the main scheme, you win the game"** vs. MC21 p. 20's "If
   the players control the Odin ally when Hela is defeated". Equivalent in every reachable state (Odin is attached or
   controlled by the first player until he leaves play, which loses). Implemented from the card.
8. **Does a bare "You cannot change form" stop an additional form change?** (§3.1) All Tied Up and Care for Cassie
   print it; RRG 1.8 p. 21 says an additional change "does count as changing form for the purpose of triggering card
   effects", which is about triggers, not restrictions. Implemented as: no. A bare rule blocks only the hero/alter-ego
   flip, and "You cannot change energy forms" (Loss of Control) is what blocks energy forms.

9. **Does flipping Avengers Tower to its Damaged side resolve that side's "When Revealed"?** (§3.5) Ruling Jun 25, 2026
   (4) #3 and Jan 26, 2026 (4) #2: "Environments flip, they are not revealed." Yet the only way the Damaged side enters
   play is by that flip, and MC21 p. 11 says its When Revealed "reinforces the unique rule by discarding each other copy
   of Avengers Tower from play". Proposed: follow the rulings (no When Revealed on a flip) and have the Stronghold side's
   script discard the other Avengers Towers as it flips, which is what MC21 p. 11 describes. Needs the user's call.
   **USER DECISION 2026-09-24:** follow the rulings. The flip does not resolve the Damaged side's When Revealed; the
   Stronghold side's script discards the other Towers as it flips (the proposal, kept as is).

10. **Who agrees to spend another player's cards for an alliance card?** (§3.17) RRG 1.8 "Alliance" (p. 6) says any
    player "may help pay", so each contribution is that player's choice. The engine takes one command from the player
    playing the card, naming every card spent, as it already does for the Milano's "for any player" resource. Implemented
    as: the engine accepts it; asking the other seats before the command is sent is a client/netcode step, not an
    engine rule. The order the per-spender `resourcesSpent` events resolve in (the paying player's first, then seat
    order) is our default; no ruling covers it.
11. **Thor's "(in the order of your choice)"** (§3.22). `resolveAttackAgainst` resolves the extra targets in the order
    the ref lists them (play-area order), before the original target, which is one legal order; the player is not
    asked. The only thing the order can change is which overkill spill or defeat happens first. Proposed: keep it
    until a card makes the order matter; a choice step is an `orderCards`-style prompt on top of this effect.
12. **Spectrum's precon prints 43 cards, not 40** (card-data-pipeline, 2026-09-24). MC21 p. 3's own "Spectrum
    cards"/"Leadership cards"/"Basic cards" lists sum to 18 + 16 + 9 = 43, cross-checked 1:1 against MarvelCDB's
    names in order; no arithmetic error found in the transcription. Every other wave 4 precon is 40 (Vision's 41,
    §5.2, is the only other exception). Implemented as: the printed lists win, transcribed verbatim
    (`curation/mts.ts`'s own `starterDecks` note) — 43 is within RRG 1.8 p. 50's legal 40-50 range, and
    `validateDeck` accepts it, so nothing is broken by leaving it as printed rather than guessing which card the
    rulebook meant to drop. Needs a second source (the physical precon, once available) to confirm 43 is really
    what ships, not a rulebook transcription slip on FFG's own part.
13. **Six MarvelCDB records with no artwork anywhere** (§1, `PackCuration.artUnavailable`). Not a rules question —
    a data-availability one, flagged here because it's a standing gap rather than a decision either way: if a
    second-source scan of 21136b/21137b (Hela's Mystic-side backs) or 21182b/21184b/21186b/21189b (the four
    campaign-card backs) turns up later, prefer it (drop the matching `artUnavailable` entry, add an
    `imageOverrides` one instead) over leaving the acknowledged gap in place indefinitely.
14. **"If Valkyrie defeated that enemy"** (Death-Glow, §3.22) read as "her identity or an extension of it" (RRG 1.8
    "You, Your", p. 49): her attacks, events she played (Have at Thee!, a non-attack "deal damage" event), resources
    she spent (Audacity) and her upgrades count; allies do not. No ruling names Death-Glow; the RRG's extension rule is
    the reading.
15. **"When your hero defends against an attack"** (The Best Defense…, §3.22) is scripted on the basic defense's
    `basicPowerUsing` interrupt, which is the moment before the DEF is read. RRG 1.8 p. 15 lets it also trigger off a
    defense-labeled ability, but only a basic defense reduces damage at all, so there it would do nothing; the engine
    does not offer it there.
16. **A cancel ability aimed at a card that cannot be canceled** (§3.14). Nothing in RRG 1.8 "Cancel" or "'Cannot'"
    (p. 11) forbids initiating it; its costs are paid and it changes nothing. Implemented as: the cancel stays offered
    and fizzles. Proposed alternative for the user: withhold it from the legal actions (friendlier, but not a written
    rule). **USER DECISION 2026-09-24:** change it. A cancel whose only target cannot be canceled is not offered, so no
    cost is paid. Built generically in the legal-action layer (§3.27).
17. **Does a card that flips into a separately emitted face enter play?** (§3.10) RRG 1.8 "Flip" (p. 20) only says
    what stays on the card. But Defensive Protocols and Retrieve Odin's Armor (21184b, 21186b) print "Hinder 2", which
    only works on entering play, and a flipped-in side scheme at 0 threat could never be defeated; Black Swan's "After
    Black Swan engages you" needs an engagement. Implemented as: the new face is treated as entering play (starting
    threat plus hinder, engagement, "enters play" triggers). Needs a ruling or the MC21 insert's word. **USER
    DECISION 2026-09-24:** yes, it enters play (starting threat plus hinder, engagement, "enters play" triggers). Kept
    as implemented.
18. **Who pays Mister Fear's cost when another player's card readies the engaged player's hero?** (§3.19) The card
    says "for the engaged player to ready"; RRG 1.8 "Ready" (p. 36) says "for a player to ready a card, that player".
    Implemented as: the player readying pays — the controller at the end-of-phase ready, the resolving player for a
    card effect — and `player` scopes the rule to the engaged player, so another player's Cosmic Alliance readies the
    engaged player's hero without the cost. "A hero" is an identity in hero form; an alter-ego readies untaxed.
19. **"Nebula ignores … the crisis icon" on removal that is not her thwart** (§3.24). RRG 1.8 "Ignore" (p. 23) treats
    the icon as absent "while that ability is resolving", and a crisis icon blocks any player removal from the main
    scheme. Implemented as: the exemption covers the character's own thwarts (basic or "(thwart)", whose thwarting
    character she is) and removal sourced to the character itself; a non-thwart event she plays ("remove 2 threat
    from the main scheme") is still stopped. Proposed: keep; no card in the survey depends on the wider reading.
20. **Does a player's attack still resolve if its attacker is defeated first?** (§3.21) Speed Demon's "(Resolve Speed
    Demon's attack first.)" can defeat the attacking ally before its own attack resolves. RRG 1.8 "Attack (Player
    Ability Type)" (p. 10) does not say; for an enemy, "Activation" (p. 6) ends an attack whose attacker leaves play.
    Implemented as (unchanged engine behavior): the attack still resolves, for the attacker's ATK as it last was.
    Proposed alternative: end a player attack whose attacker has left play, mirroring the enemy rule. Needs a ruling.
21. **A minion treated as an ally that stops being one** (§3.29): Mind Control discarded, Karma leaving play. No card
    or ruling says where the minion goes. Implemented as: it stays in the play area it is in and is engaged with the
    player who controlled it (a minion in a player's area is engaged with them, RRG 1.8 "Engaged", p. 18), without an
    engage event (nothing new engaged; it is "essentially a status change", ruling Dec 17, 2025 (1) #3). Proposed:
    keep.

## 5. What this asks of the other agents

- **`card-data-pipeline`** (after §1 lands):
  - ~~make `mts` survey clean and emit it, campaign cards included (§1.3, §1.6, §1.7, §1.10, §1.11, §1.13), with
    Spectrum and Adam Warlock precons from MC21 p. 3~~ — **done (2026-09-24)**, see §1's own status note;
  - ~~the form keyword (§1.1) and Vision's Dense face (§1.2), re-emitting `vision`~~ — done (273ac126);
  - ~~`modeOnly` (§1.8) and `classification` (§1.9), re-emitting `hood` and back-filling `gmw`'s split side
    schemes~~ — done (5f3a4b37);
  - ~~`hood`'s `Scenario` record (§1.12, §2.3)~~ — done (bd888fcc);
  - the four hero-pack precons from their inserts — still open; the Nebula/War Machine/Valkyrie/Vision inserts
    aren't in the repo (§2.1's own note), so sourcing them is a follow-up, not part of this pass.
- **`ability-scripting-engineer`:** the `mts` scenario builder must map `MultipleVillains.encounterDecks: "shared"` to
  `GameSetupConfig.sharedEncounterDeck` (§3.2) — the wave 1 builder (`wave1/setup.ts` `buildMultiVillain`) knows only
  per-villain decks. Script each pack once its §3 primitives are "landed"; §3.23 lists what composes today.
- **`rules-qa-engineer`:** a Tower Defense test where both villains reach 0 in one attack (§3.3); a Loki swap carrying
  attachments, status cards and the dial (§3.7); the campaign's full run, retry and permanent removal.
- **`game-client-engineer`:** energy/mass form display and the form choice (§3.1); two main schemes and the Focused
  Defense marker (§3.2); damage on Avengers Tower (§3.5); the Infinity Stone deck and its discard pile (§3.6); Loki's
  set-aside versions and the victory count (§3.7); Odin on the main scheme (§3.8); an ally shown as a minion (§3.9);
  MC21's campaign-pool design pass (`docs/campaign-client-per-box.md` §3: Dossier and Briefing).
