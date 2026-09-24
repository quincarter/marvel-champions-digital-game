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

| §    | Primitive                                                                | Needed by                                  | Status      |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------ | ----------- |
| 3.1  | Additional forms (the form keyword)                                      | Spectrum, Vision; Shadowcat, Nick Fury     | landed      |
| 3.2  | Two main schemes in play, each paired with a villain; Focused Defense    | Tower Defense                              | landed      |
| 3.3  | Villains protected by each other's hit points: one defeat sweep          | Tower Defense; Four Horsemen (`aoa`)       | landed      |
| 3.4  | A main scheme stage's completion is replaceable                          | Tower Defense; Upgrading Adaptoids (`aos`) | landed      |
| 3.5  | Damage on a card that is not a character (Avengers Tower)                | Tower Defense                              | landed      |
| 3.6  | A modular set's own deck (the Infinity Stone deck)                       | Thanos, Loki, any scenario                 | landed      |
| 3.7  | Loki: random start, swap, a villain stage's Victory X, the victory count | Loki; God of Lies (`tt`)                   | landed      |
| 3.8  | An encounter ally attached to the main scheme (Odin)                     | Hela                                       | landed      |
| 3.9  | An ally treated as a minion                                              | Fallen Warrior, Beguiled; 5 other packs    | not started |
| 3.10 | Flipping a card into a separately emitted face of another type           | MC21 campaign                              | not started |
| 3.11 | Timing points when a deck runs out                                       | Soul World, Universal Church, Thanos       | landed      |
| 3.12 | Counting different aspects; Adam Warlock's copy limit                    | Adam Warlock                               | landed      |
| 3.13 | Abilities active in hand; "cannot choose to discard this card"           | Pip the Troll, System Shock                | landed      |
| 3.14 | Player events shuffled into the encounter deck (Cosmic Entities)         | Adam Warlock precon                        | not started |
| 3.15 | "After the last X counter is removed from here"                          | Ebony Maw; `aos`, `phoenix`                | landed      |
| 3.16 | Encounter cards in a player's play area                                  | Ebony Maw's Spells                         | landed      |
| 3.17 | Alliance: paying a card's costs as a group                               | `warm`, `valk`, `vision`; 9 later cards    | landed      |
| 3.18 | Set-aside modular sets; mode-only faces; Standard II                     | The Hood; Wheel of Genres (`mojo`)         | not started |
| 3.19 | Readying as a costed act; "cannot be readied by player card effects"     | Mister Fear; Undermine Support (`aos`)     | not started |
| 3.20 | A trigger on damage a card prevented                                     | Abjuration                                 | not started |
| 3.21 | An enemy attack against a chosen character                               | Speed Demon, Crossfire                     | not started |
| 3.22 | Valkyrie's kit                                                           | `valk`                                     | landed      |
| 3.23 | Reusable as is                                                           | —                                          | checked     |

### 3.1 Additional forms: the form keyword

> **Status: landed (2026-09-24),** tested in `packages/engine/src/additional-forms.test.ts` (8 tests: facedown forms
> grant none and have no title, but the owner finds them by printed form; a change turns the form faceup, is heard by
> "After you change form" and by the form card's own "this form" but not by an identity-only listener, and never uses the
> once-per-round change; one energy form at a time; no change, no trigger; `cannotChangeForm { formType }` stops only its
> type; a double-sided form card flips; the hero/alter-ego flip is an identity change; replay deep-equal). DSL:
> `packages/cards/src/dsl/wave4-primitives.test.ts` (5 tests). **Not done:** Corrupted Programming's "blank, except for
> keywords" (`blankTextBox` has no keyword exception, so a blanked mass form card grants no form); it lands with the
> `vision` scripting. **Client:** log lines for `additionalFormChanged`, `cardTurnedFacedown` and `cardTurnedFaceup`,
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

### 3.10 Flipping a card into a separately emitted face of another type

Schema §1.7. **Plan:** `flipCard` on a card with `otherFaceId` replaces the instance's card; RRG 1.8 "Flip" (p. 20)
discards attachments, tucked cards, status cards and tokens when the type changes, and keeps them when it does not
(the side-scheme-to-side-scheme flips). A side scheme that flips on "When Defeated" is still defeated (Victory X, "is in
the victory display" readers), then becomes its other face in play.

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

Schema §1.8, §1.9, §1.12. **Plan:** setup sets aside the chosen modular sets; `EffectSpec shuffleRandomSetAsideSet`
("Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck"); a `modeOnly` card is
put into play on its expert face in expert mode. **Composes with:** Wheel of Genres (`mojo` 39026a/b, "if there are no
set-aside modular encounter sets remaining"); the Campaign Challenge faces (`gmw`), `sm` 27174a/b, `next_evol` 40081a/b.

### 3.19 Readying as a costed act; "cannot be readied by player card effects"

Mister Fear: "As an additional cost for the engaged player to ready a hero or ally they control, the player must spend
a [mental] resource." Undermine Support (`aos` 50174), the same for a support. Unnatural Storm: "Heroes and allies
cannot be readied by player card effects." **Plan:** a `RuleSpec readyCost` and `cannotReady.bySource`.

### 3.20 A trigger on damage a card prevented

Abjuration: "Prevent all damage to Ebony Maw. Forced Response: After Abjuration prevents 2 or more damage from a single
attack, discard it." **Plan:** check what `damagePrevented` carries; a trigger event naming the preventing card and
the amount.

### 3.21 An enemy attack against a chosen character

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
>   event she played counts as her and an ally does not (§4 Q12). Exclusion code `notIdentityExtension`.
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
>   basic defense's interruptible `basicPowerUsing` (§4 Q13).
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
| "Treat your mass form upgrade's text box as if it were blank, except for keywords" | Corrupted Programming                                 | `blankTextBox` (keywords kept: to confirm)                           |
| "The villain gains steady" / "each enemy gains steady"                             | Formidable Foe, The Hood's Mantle, Warehouse District | `gainsKeyword` + the RRG Steady rule (`keywords.ts`)                 |
| "For each different card type discarded this way"                                  | Time Stone                                            | `distinctCardTypes`                                                  |
| "Spend up to 3 resources of any type → … for each resource spent"                  | Machine Man 26022                                     | `spendUpTo` (wave 3 §3.25)                                           |
| "Play a card from your hand, reducing its resource cost by 3"                      | Meditation 26036                                      | `playFromHandReducingCost`                                           |
| "Put the top card of your deck into play facedown, engaged with you as a Drone"    | Ultron, Ultron Unleashed, Relentless Android          | `droneFromDeck`                                                      |
| "Attach to the villain who is not the active villain"                              | Direct Assault                                        | `AttachmentHost nonActiveVillain`                                    |
| "Each player removes the top half of their deck (rounded down) from the game"      | Balance the Scales 2B                                 | `deckCountOf` + `scaled`                                             |
| "(Limit once per phase.)" on James Rhodes (errata)                                 | 23001b                                                | `oncePerPhase`                                                       |

---

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
12. **"If Valkyrie defeated that enemy"** (Death-Glow, §3.22) read as "her identity or an extension of it" (RRG 1.8
    "You, Your", p. 49): her attacks, events she played (Have at Thee!, a non-attack "deal damage" event), resources
    she spent (Audacity) and her upgrades count; allies do not. No ruling names Death-Glow; the RRG's extension rule is
    the reading.
13. **"When your hero defends against an attack"** (The Best Defense…, §3.22) is scripted on the basic defense's
    `basicPowerUsing` interrupt, which is the moment before the DEF is read. RRG 1.8 p. 15 lets it also trigger off a
    defense-labeled ability, but only a basic defense reduces damage at all, so there it would do nothing; the engine
    does not offer it there.

## 5. What this asks of the other agents

- **`card-data-pipeline`** (after §1 lands):
  - make `mts` survey clean and emit it, campaign cards included (§1.3, §1.6, §1.7, §1.10, §1.11, §1.13), with Spectrum
    and Adam Warlock precons from MC21 p. 3;
  - the form keyword (§1.1) and Vision's Dense face (§1.2), re-emitting `vision`;
  - `modeOnly` (§1.8) and `classification` (§1.9), re-emitting `hood` and back-filling `gmw`'s split side schemes;
  - `hood`'s `Scenario` record (§1.12, §2.3);
  - the four hero-pack precons from their inserts.
- **`ability-scripting-engineer`:** the `mts` scenario builder must map `MultipleVillains.encounterDecks: "shared"` to
  `GameSetupConfig.sharedEncounterDeck` (§3.2) — the wave 1 builder (`wave1/setup.ts` `buildMultiVillain`) knows only
  per-villain decks. Script each pack once its §3 primitives are "landed"; §3.23 lists what composes today.
- **`rules-qa-engineer`:** a Tower Defense test where both villains reach 0 in one attack (§3.3); a Loki swap carrying
  attachments, status cards and the dial (§3.7); the campaign's full run, retry and permanent removal.
- **`game-client-engineer`:** energy/mass form display and the form choice (§3.1); two main schemes and the Focused
  Defense marker (§3.2); damage on Avengers Tower (§3.5); the Infinity Stone deck and its discard pile (§3.6); Loki's
  set-aside versions and the victory count (§3.7); Odin on the main scheme (§3.8); an ally shown as a minion (§3.9);
  MC21's campaign-pool design pass (`docs/campaign-client-per-box.md` §3: Dossier and Briefing).
