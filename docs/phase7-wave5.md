# Phase 7 working spec: wave 5 (cycle 4)

This is the shared brief for every agent working Phase 7's fifth content wave:

- `card-data-pipeline`, `game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`
  and `game-client-engineer`.
- It turns wave 5's scope into schema decisions (§1), per-pack setup needs (§2), and a prioritized list of engine
  primitives (§3), each with a status.
- The models are `docs/phase7-wave1.md` through `docs/phase7-wave4.md`, whose §3 primitives are assumed. The definition
  of done is `docs/wave-definition-of-done.md`: **the box's campaign ships in this wave.** If you change a decision
  here, update this file in the same change.

**Wave 5** is cycle 4, Sinister Motives. RRG 1.8 Appendix VI (p. 71) lists it as "The _Sinister Motives_ campaign
expansion, the _Nova Hero Pack_, the _Ironheart Hero Pack_, the _Spider-Ham Hero Pack_, and the _SP//dr Hero Pack_".
There is no scenario pack in the window. In release order (Hall of Heroes dates; `docs/phase7-wave5-sources.md` §1):

| Pack        | Product                 | Released     | State today                                                      |
| ----------- | ----------------------- | ------------ | ---------------------------------------------------------------- |
| `sm`        | Sinister Motives (MC27) | Apr 8, 2022  | **not emitted** (§1, 31 survey lines)                            |
| `nova`      | Nova hero pack          | May 20, 2022 | emitted, data only; **"Bring the War!" has no text** (§1.9)      |
| `ironheart` | Ironheart hero pack     | May 20, 2022 | emitted, data only; progressing identity unmodeled (§1.5, §3.23) |
| `spiderham` | Spider-Ham hero pack    | Jul 15, 2022 | emitted, data only                                               |
| `spdr`      | SP//dr hero pack        | Jul 15, 2022 | emitted, data only; `createGame` refuses the identity (§3.24)    |

- **The box's content** (MC27 p. 2): Ghost-Spider, Spider-Man (Miles Morales), five scenarios (Sandman, Venom,
  Mysterio, The Sinister Six, Venom Goblin), modular sets (City in Chaos, Down to Earth, Symbiotic Strength, Personal
  Nightmare, Whispers of Paranoia, Guerrilla Tactics, Goblin Gear, Osborn Tech, Sinister Assault) and the campaign
  cards 174–189 (Bad Publicity, Community Service, Snitches Get Stitches, S.H.I.E.L.D. Tech). Cards 190–191 (Venom
  (Eddie Brock), Symbiote Suit) are ordinary basic player cards that the campaign prohibits (MC27 p. 4).
- **Cycle id.** The four hero packs already carry `cycle: { id: "cycle5", name: "Cycle 5", order: 5 }` (MarvelCDB
  `pack_wave: 5`). `sm` joins them with the same id, as `mts` did for `cycle4` (wave 4 §1.13). The label may become
  "Sinister Motives" for all five; it is not a disagreement with FFG's numbering.

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules
Reference; FFG rulings clarify both):

1. **Card text and product rules.**
   - The Sinister Motives rulebook (MC27), `docs/campaign-modes/mc27_sinister_motives_rules_v5-compressed.pdf`,
     converted in `docs/campaign-modes/markdown/mc27_sinister_motives.md`, cited as "MC27 p. N" by the PDF page. The
     conversion loses the reputation track's node layout on p. 22; it was read from the PDF's vector drawings
     (2026-09-26): the track has 25 primary nodes, and a connector joins one left (reward) box and one right (penalty)
     box at each of nodes 1, 5, 9, 13, 17, 21 and 25 (§2.3).
   - The **Ironheart insert** ("New Rules: Progressing Identity Cards"), `hallofheroeslcg.com/wp-content/uploads/2022/04/insert.jpg`,
     and the **SP//dr insert** ("New Rule: Separated Identity Card"), `.../2022/07/z2.jpg`. Both read as images on
     2026-09-26 (downloaded to the scratchpad, viewed, deleted; never stored) and quoted in §3.23 and §3.24.
   - **Not in the repo:** the Nova and Spider-Ham inserts, and all four hero packs' precon lists (image links in
     `docs/phase7-wave5-sources.md` §5). Every hero pack's `starterDecks.ts` is empty today (§2.1).
2. **FFG rulings, Dec 17, 2025 to Aug 13, 2026**, in `marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading.
   The eleven that touch cycle 4 are tabled in `docs/phase7-wave5-sources.md` §3.2 (checked against the file,
   2026-09-26): Dec 17, 2025 (3) (Concussive Bombs), Jan 11, 2026 (3) (Bring the War!, printed resources), Jan 11,
   2026 (4) (Bombshell ally vs guard), Jan 26, 2026 (1) (Ms. Marvel's cost under Go for Champions!), Jan 26, 2026 (2)
   (all-purpose counters take the card's counter type; Captain Americat), Mar 30, 2026 (1) (George Stacy's "to a
   maximum of 3" is local), Apr 30, 2026 (2) (Return the Favor's cost → effect), Jun 25, 2026 (3) (Go All Out), Jun 25,
   2026 (6) and Jul 9, 2026 (2) (Clarity of Purpose's damage cost), Aug 3, 2026 (4) #2 (negative victory points mark
   no reputation nodes). Also used: **Jan 17, 2026 (1) #2** — the RRG "Leaves Play" bullets are "carried out
   simultaneously with the card leaving play", not an interrupt (§3.13).
3. **RRG 1.8 (Jul 2026)**, `mc_rulesreference_v18_compressed.pdf`, cited by printed page (PDF page index + 1). Cycle 4's
   FAQ is on p. 62 (The Sinister Six, Venom Goblin, Across the Spider-Verse, Go for Champions!, Warrior of the Great
   Web, Spider-Man Noir) and its errata on p. 67 (MC27 p. 17 glider paragraph 4, MC27 p. 22 mulligan box, Worried
   Father, Venom I–III, Manipulated Mind, Ms. Marvel, "Go for Champions!", SP//dr Suit 1B, M.O.R.B.I.U.S.). Entries
   this wave leans on: "Acceleration Token" (p. 5), "Boost, Boost Icon" (p. 11), "Hand Size" and "Hazard Icon"
   (p. 21), "Leaves Play" (p. 27), "Max 1 per [instance]" (p. 28), "Permanent" and "Patrol" (p. 32), "Set Aside"
   (p. 39), "Steady" and "Status Cards" (p. 41), "Swap" (p. 42), "Uses" and "Victory X" (p. 46), "Villain Defeat"
   (p. 47).
4. **`docs/phase7-wave5-sources.md`**, the tracker's index, reconciled with this pass (2026-09-26). Where the two
   differ, this file is the architect's reading:
   - Its §4.2 is superseded by RRG 1.8 p. 67, which does carry cycle 4 card errata (listed in item 3 and in §1.9).
   - "Setup" on the S.H.I.E.L.D. Tech upgrades, "Steady" on Venom Goblin and "Symbiote" are not new rules: Setup and
     Steady are RRG keywords the engine implements, and Symbiote is a trait only (no RRG entry).
   - Its hero-kit guesses (Ironheart "armor forms", SP//dr "dual identity like Ant-Man") are not used; §3.23 and
     §3.24 are from the card text and the inserts.

`packages/content/raw/marvelcdb/{sm,nova,ironheart,spiderham,spdr}.json` point to card text and stats. They are not an
authority; every card of all five packs (raw JSON and emitted data) was read for this spec.

---

## 1. Schema decisions (owner: `game-rules-architect`)

> Status: see each subsection. Landed items are fixtured in `packages/content/src/schema/wave5.test.ts`.

**The survey** (`survey.ts --pack sm --pack nova --pack ironheart --pack spiderham --pack spdr`, 2026-09-26): the four
hero packs normalize cleanly; `sm` has 31 lines — Venom Goblin's lettered main schemes 16 (§1.1), campaign upgrades
without a cost 8 (§1.8), attach rules 2 and their unemitted records 2 (§1.9), Light at the End's missing art 2 (§1.9),
Sand Clone's X ATK 1 (§1.9). "Clean" is not "right": §1.4, §1.5 and §1.9 are gaps in packs that survey clean.

### 1.1 Venom Goblin's main schemes: lettered stages whose other face is an environment

Skies Over New York (27116a) prints only a `Setup:` A side: "Put the Lower Manhattan, Midtown Manhattan, and Upper
Manhattan main schemes into play. Place the glider counter on Midtown Manhattan. Flip this card and set it aside." Its
other face (27116b) is an **environment** that restates the scenario rules. Lower, Midtown and Upper Manhattan
(27117a–27119a) are main schemes whose other faces (27117b–27119b) are **environments** ("When Revealed: Move the
glider counter and each acceleration token from here to the main scheme with the least threat. If there are at least
2 [Symbiote] environments in play, the players lose the game."). MC27 p. 17: "Main Scheme Deck: Skies Over New York
(A), Lower Manhattan (B), Midtown Manhattan (C), Upper Manhattan (D)"; the p. 67 erratum ends the glider paragraph
with "When a main scheme is completed, flip it to its environment side", and the FAQ (p. 62): "flip that main scheme
to its environment side and reveal that environment."

- **One `MainSchemeCard`** (id `27116a`) with four stages, `stageNumber` 1–4, `stageLetter` "A"–"D", `name` each
  card's title. Stages 2–4 are put into play beside stage 1 by `putMainSchemeStageIntoPlay` (wave 4 §3.2).
- **New `MainSchemeStage.otherFaceId?: CardId`**: the stage card's other printed face when it is emitted as its own
  card (the four environments, each `EnvironmentCard` with `otherFaceId` = `27116a`). With it, the stage prints no A
  side of its own except where its card prints one: stages B–D have an empty `aSide`; stage A's `aSide` is the Setup
  and its scheme fields are all in `dashedValues` (it never holds threat).
- **New `MainSchemeStage.onCompletion?: "flipToOtherFace"`**: completing the stage flips it to its other face (the
  environment enters play and its When Revealed resolves) instead of advancing or losing. Set on stages B–D from the
  p. 67 erratum. Requires `otherFaceId`.
- **Data only until §3.3.**

### 1.2 Negative victory points

Snitches Get Stitches (27181) prints "Victory -1." RRG 1.8 "Victory X" (p. 46): "X indicates how many victory points
that card is worth"; ruling Aug 3, 2026 (4) #2: "Negative victory points do not mark nodes on the reputation track."

- **`victory` keyword `value` may be any whole number, negative included**; every other numeric keyword stays
  non-negative. The victory-display count readers (`victoryDisplayCount`, the campaign `keywordValueSum`) already sum
  values; the clamp is the reputation track's (§2.3).

### 1.3 Scheme icons printed on cards that are not schemes: `BaseCard.schemeIcons`

Team Leader (27105, an attachment, crisis), Public Outcry (27174a acceleration / 27174b hazard, an environment),
Venom (Eddie Brock) (27190, an ally, hazard) and Symbiote Suit (27191, an upgrade, hazard) print scheme icons. RRG 1.8
"Hazard Icon" (p. 21): "for each hazard icon on cards in play"; the crisis and acceleration entries likewise count
icons in play. Today the schema drops them: only scheme cards have `icons`. A survey of every raw pack finds 35 such
records in 16 packs (Ultron 01136 hazard, Kree Command Ship 16108, Formidable Foe 24049b, Dogpool 44013, …), all
silently dropped.

- **New `BaseCard.schemeIcons?: readonly SchemeIcon[]`** and **`CardFlipSide.schemeIcons?`**, the amplify precedent
  (wave 3 §1.2): on any card that is not a main or side scheme (those keep `icons`). The engine reads them with the
  icons `gainsIcon` grants (§3.10).
- **Pipeline:** emit it from `scheme_hazard` / `scheme_crisis` / `scheme_acceleration` on non-scheme records.
  Back-filling the 30 records outside wave 5 is a follow-up, listed by pack in §5.

### 1.4 Progressing identities: `HeroIdentityCard.progressingIdentity`

Ironheart insert, "New Rules: Progressing Identity Cards": "Ironheart / Riri Williams has three identity cards in
total … During game setup, the weakest of the cards is put into play under the player's control, with the other two
cards set aside (determined by a 'begin the game' ability on the alter-ego side of that identity card). … All versions
of the Ironheart / Riri Williams identity share a single hit point dial, with damage persisting from one version to
the next. Additionally, when one identity is swapped for another, move all game elements (tokens, counters, status
cards, player cards, encounter cards, etc.) on or attached to the original identity to the subsequent identity. If any
one version of the identity card is defeated, all versions are considered to be defeated simultaneously". The three
are emitted as three complete identities (29001a, 29002a, 29003a), unlinked.

- **New `HeroIdentityCard.progressingIdentity?: { versions: readonly CardId[] }`**, set on every version, listing all
  versions weakest first (Ironheart: `["29001a", "29002a", "29003a"]`). A deck names the first; `validateDeck`
  reports `unsupported_identity` for a later version ("begin the game with this card" is on 29001b only).
- The "Begin the game with this card. Set your other identities aside." sentence becomes data (no ability ref).
- **Data only until §3.23:** `createGame` refuses an identity with `progressingIdentity` until then.

### 1.5 The Sinister Six: villains that start set aside, and a win by card ability

Sinister Synchronization 1A (27100a) Setup: "Choose X villains at random, where X is 1 more than the number of players.
Put those villains into play, place the active counter on the villain with the lowest activation order value, and set
the other villains aside. Put the Light at the End side scheme into play, [Trap!] side faceup." Light at the End
(27102a): "The players cannot win unless they escape." Each villain's When Defeated: "Set this villain aside."

- **`MultipleVillains.winCondition` gains `"cardAbility"`**: defeating every villain in play does not win (the
  Loki shape, wave 4 §1.11; the win is Light at the End 27102b's "the players escape and win the game").
- **New `MultipleVillains.atSetup?: "setAside"`**: every villain starts set aside and the main scheme's Setup puts
  them into play (§3.1). Absent is today's behaviour (all in play).
- The six villains are six one-stage `VillainCard`s with `activationOrder` 1–6 (wave 2 §6.7), `encounterDecks:
"shared"`, `activation: "activeVillainOnly"`.
- **Data only until §3.1.**

### 1.6 SP//dr's separated identity

The schema is wave 2 §6.10's `separatedIdentity`, unchanged; the SP//dr insert (quoted in §3.24) confirms its shape.
The engine refuses it until §3.24.

### 1.7 Ironheart's "[Version] number"

"X is equal to Ironheart's [Version] number" (New and Improved, Sector Scan, Photon Blasters, Propulsion Jets) reads the
number in the identity's "Version N" trait. No schema change: traits stay `VERSION 1` / `VERSION 2` / `VERSION 3`;
the value is §3.23's `ValueSpec traitNumber`.

### 1.8 The campaign's S.H.I.E.L.D. Tech upgrades

27182–27189 print "Setup. Permanent." with a cost of "—" (MC27 p. 4 callout, "UPGRADE –"), and each has an **Enhanced**
back (27182b–27189b; MC27 p. 22: "flip their 'Campaign - S.H.I.E.L.D. Tech' upgrade to its Enhanced side").

- **No new field:** `cost: 0, specialCost: "dash"` (wave 2 §1.3), keywords `setup` and `permanent`, `flipSide` for the
  Enhanced face (wave 4 §1.2), `specificTo: { kind: "campaign" }`. The campaign grants the face with `setGrantFace`
  (`docs/campaign-mode-design.md` row 57). The Setup keyword already puts a player card into play at setup
  (`setup-steps.ts putSetupCardsIntoPlay`).

### 1.9 Other data notes for the pipeline

- **"Bring the War!" (28022) has no text.** MarvelCDB's API returns `text: null` (checked 2026-09-26). Ruling Jan 11,
  2026 (3) confirms a When Revealed that discards cards with a printed [wild] resource. Transcribe it from the card
  image (curation correction with evidence). Its survey is "clean" only because an empty text box is valid.
- **Errata to apply** (RRG 1.8 p. 67): Worried Father (27025; raw already current), Venom I–III (27073–27075; raw
  already current), Manipulated Mind (27171; raw already current), Ms. Marvel (28002), "Go for Champions!" (29025),
  SP//dr Suit 1B (31001b; raw already current, see `curation/spdr.ts`), M.O.R.B.I.U.S. (31027, "engaged player" /
  "that player's hero": raw still has the old text).
- **Attach rules the parser missed:** Manipulated Mind 27171 (attached by its own When Revealed: "Attach to the ally
  you control with the lowest cost"); Old Grudge 27172 (attached to "your nemesis minion" by its own When Revealed).
  The wave 4 Fallen Warrior precedent (§1.13 there).
- **Sand Clone 27067** prints ATK X ("X is equal to the number of sand counters on City Streets"): a `cardNotes` entry
  and a `printedX` ATK.
- **Light at the End** (27102a Trap! / 27102b Chase!) is one card with two side-scheme faces: `otherFaceId` on both
  (wave 4 §1.7). Neither face has MarvelCDB art: `artUnavailable` or a second source. Check "Hinder 10[per_hero]" on
  both faces against the image (raw b reads "Hinder 10.").
- **Public Outcry 27174a/b:** "Standard Mode Only" / "Expert Mode Only" faces (`modeOnly`, wave 4 §1.8), uses with
  `countPerPlayer` 2 on the standard face and "3" on the expert face (confirm per-hero from the image), `victory 1`,
  and `schemeIcons` (§1.3) per face.
- **Hinder, incite, steady, stalwart, villainous, patrol, piercing, permanent, requirement, team-up** are all existing
  `KeywordInstance`s. "In expert mode, this card gains incite 1 and cannot be canceled" (27108–27110) and "gains surge"
  (27112, 27146) are ability text, not keywords (§3.11).
- **Campaign cards 174–189** are emitted with the box: `specificTo: campaign` on player cards (182–189),
  `campaignSpecific` on the encounter sets Bad Publicity, Community Service, Snitches Get Stitches. 190–191 are
  ordinary basic cards; the campaign prohibits them (`Campaign.prohibited.cardIds`, with `osborn_tech` in
  `prohibited.encounterSetIds`, MC27 p. 4).
- **Two printings of the same basic cards**: Young Love 27019/27050 and Energy, Genius, Strength 27020–27022 /
  27051–27053. MC27 p. 20's precons each list one copy of each; give Ghost-Spider's precon the first printing and
  Miles's the second (collector order), and emit both.

---

## 2. Per-pack setup needs, standalone and campaign

RRG 1.8 Appendix II (p. 51) with the wave 1–4 engine. The campaign's setup windows are `docs/campaign-mode-design.md`'s.

### 2.1 Hero packs

| Pack        | Identity                                  | Obligation                         | Nemesis set (nemesis minion in bold)                                                    | Other setup and legality                                                                                                 |
| ----------- | ----------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `sm`        | Ghost-Spider / Gwen Stacy (27001a/b)      | Worried Father (27025)             | **The Lizard** (27027), Regenerative Research, Experimental Injection, In Cold Blood ×2 | Precon Ghost-Spider/Protection (MC27 p. 20, 40 cards).                                                                   |
| `sm`        | Spider-Man / Miles Morales (27030a/b)     | Keeping Secrets (27056)            | **Prowler** (27058), Tracking Prey, Razor Claws, Slice and Dice ×2                      | Precon Spider-Man/Justice (MC27 p. 20, 40 cards). MC27 p. 21: Miles's and Peter Parker's kits never mix (set icon rule). |
| `nova`      | Nova / Sam Alexander (28001a/b)           | Weight of the World (28021)        | **Warbringer** (28023), "Bring the War!", War Delivery ×2, "The War's Been Brought"     | Precon from the insert image (not in repo).                                                                              |
| `ironheart` | Ironheart / Riri Williams (29001a–29003a) | A Minor Setback (29028)            | **Lucia von Bardas** (29030), Rule by Force, Cyborg Tech, Political Retribution ×2      | Progressing identity: V1 in play, V2 and V3 set aside (§1.4, §3.23).                                                     |
| `spiderham` | Spider-Ham / Peter Porker (30001a/b)      | "I Really Want a Hot Dog!" (30024) | **The Green Gobbler** (30026), Nefarious Trap, Gobbler Glider, "Feast on This!" ×2      | —                                                                                                                        |
| `spdr`      | SP//dr Suit / Peni Parker (31001a, 31002) | Inherited Burden (31025)           | **M.O.R.B.I.U.S.** (31027), Giant Monster Attack, Energy Drain ×3                       | Separated identity: Peni Parker's Setup puts the Suit into play INACTIVE side up (§3.24).                                |

- **Modular sets the hero packs bring:** Armadillo (`nova`), Zzzax (`ironheart`), Inheritors (`spiderham`), Iron
  Spider's Sinister Syndicate (`spdr`, `ironspider_sinister`).
- **Same title, different cards:** Bombshell the ally (29033) and the minion (31031); Electro, Hobgoblin, Sandman as a
  Sinister Six villain (`sm`), as Sinister Assault minions (`sm` 27158–27163) and as `spdr` minions; Venom the villain,
  the ally (27190) and VEN#m; Agent 13 (27046 and 29022, two printings); Web of Life and Destiny (27023, 30023).
- **Precons.** The box's two are MC27 p. 20. The four hero packs' are images on Hall of Heroes
  (`docs/phase7-wave5-sources.md` §5); `starterDecks.ts` is empty for all four.

### 2.2 Sinister Motives scenarios

Villain decks are I–II standard and II–III expert, except The Sinister Six (six one-stage villains, §1.5).

| Scenario         | Main scheme deck                                              | Encounter sets (required) + modulars                         | 1A Setup / scenario rules                                                                                                                                             | Needs (§3)               |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Sandman          | Hapless Pedestrians (1B loses)                                | Sandman, City in Chaos, Standard; Down to Earth              | "Search the encounter deck for the City Streets environment and put it into play. Place 4 sand counters on it."                                                       | §3.4, §3.7, §3.11        |
| Venom            | "Leave Us Alone!" (1B loses)                                  | Venom, Symbiotic Strength, Standard; Down to Earth           | "Put the Bell Tower environment into play, [Quiet] side faceup." MC27 p. 11, "Boost Cards on Your Identity".                                                          | §3.6, §3.8, §3.29        |
| Mysterio         | Maze of Mirrors → Edge of Reality (2B loses)                  | Mysterio, Personal Nightmare, Standard; Whispers of Paranoia | "Put a Shifting Apparition minion into play engaged with each player." MC27 p. 13, "Encounter Cards in Your Player Deck".                                             | §3.5                     |
| The Sinister Six | Sinister Synchronization → Sinister Beatdown (2B loses)       | The Sinister Six, Guerrilla Tactics, Standard                | §1.5's Setup. MC27 p. 15, "The Active Counter" and "Activation Order"; FAQ p. 62 (overkill goes to the active villain; a villain activating with no active counter).  | §3.1, §3.2, §3.10, §3.11 |
| Venom Goblin     | Skies Over New York (A) + Lower/Midtown/Upper Manhattan (B–D) | Venom Goblin, Symbiotic Strength, Standard; Goblin Gear      | §1.1's Setup. MC27 p. 17, "The Glider Counter" with the p. 67 erratum; FAQ p. 62 and MC27 p. 21 (ties by the first player; patrol and crisis name the glider scheme). | §3.3, §3.4, §3.9         |

- **Modular sets:** Down to Earth and Whispers of Paranoia (removable), City in Chaos, Symbiotic Strength, Personal
  Nightmare (required where named, usable elsewhere), Goblin Gear, Guerrilla Tactics, Osborn Tech, Sinister Assault.
  MC27 p. 4 prohibits Osborn Tech in the campaign except through the reputation track; Sinister Assault is used only by
  scenario 5's campaign setup (it has no standalone role printed).
- **Venom's boost cards on an identity** (MC27 p. 11): "take the top card of the encounter deck and place it facedown
  on your identity (do not look at it). That boost card remains on your identity until a card ability (specifically
  the 'Forced Interrupt' ability on the main scheme) instructs you to move that card to Venom during an activation."
- **Mysterio's encounter cards in player decks** (MC27 p. 13): "encounter cards added to your deck are added facedown
  (even if the card backs are different), and encounter cards added to your discard pile are added faceup. After the
  scenario ends, remove all encounter cards from your deck, hand, and discard pile." FAQ (MC27 p. 21): card backs are
  not hidden information; "If multiple cards are drawn due to a game step or card ability, those cards are drawn
  simultaneously. Afterward, deal each encounter card drawn during that process to yourself as a facedown encounter
  card (in any order)."

### 2.3 Campaign (MC27 pp. 4–6, 9–19, 22–23)

Five scenarios in order, lost scenarios retried with no penalty (MC27 p. 4). The foundation
(`docs/campaign-mode-design.md`) was designed with this box in view (rows 27, 28, 37, 38, 42, 54, 55, 57).

| Scenario           | Campaign setup                                                                                                                                                                                               | Campaign victory                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1 Sandman          | Public Outcry into play (mode face); Smear Campaign shuffled in; 1 random Community Service; expert: +2 sand counters and Surging Sands                                                                      | Reputation; Community Service title if in the victory display; expert HP |
| 2 Venom            | Public Outcry; Smear Campaign; 1 random unrecorded Community Service; reputation Setup boxes; expert: HP, reset by 1 encounter card, 1 facedown boost card on each identity                                  | as 1                                                                     |
| 3 Mysterio         | Venom ally under the first player's control; Public Outcry; Smear Campaign + Snitches Get Stitches; Community Service; reputation; expert: HP, reset by 2, shuffle top 2 encounter cards into each deck      | as 1, plus Waking Nightmare = Illusion cards in all player decks         |
| 4 The Sinister Six | Venom ally; Public Outcry; Smear + Snitches; Community Service; threat on Light at the End = Waking Nightmare; reputation; expert: HP, reset by 2                                                            | as 1, plus Last Ones Standing = each villain in play                     |
| 5 Venom Goblin     | Public Outcry; Smear Campaign; Sinister Assault minions named in Last Ones Standing shuffled in; reputation; expert: HP, reset by 3, +1[per_hero] threat on each main scheme; expert loss loses the campaign | campaign won; optional final reputation score                            |

- **Reputation track** (MC27 pp. 5, 22). A group score; at each victory, "calculate your group's total reputation
  value, then mark that number of nodes (starting at the topmost unmarked node …)". Conditions: "(+X) Victory points
  in the victory display (+1) No side schemes in play (+1) Fewer than 1[per_hero] acceleration tokens in play (+1) No
  minions in play (+1) No threat on the main scheme (+1) No defeated identities". "Whenever a node connected to a
  white box is marked, resolve the effects of that box immediately. Whenever a node connected to a pink box is
  marked, the Setup instructions in that box will trigger at the beginning of each remaining scenario." It can be
  exceeded (extra nodes below 25). Boxes by node (left = reward, right = penalty):

  | Node | Left                                                                                        | Right                                                                                                        |
  | ---- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
  | 1    | Deal 3 random S.H.I.E.L.D. Tech to each player; each keeps 1 (not counted toward deck size) | Choose 1 random Osborn Tech, record it; **Setup:** shuffle each recorded Osborn Tech into the encounter deck |
  | 5    | One additional mulligan (p. 67 erratum: "During the Resolve Mulligans step")                | **Setup:** Place 1[per_hero] threat on the main scheme                                                       |
  | 9    | Aspect Advantage: max copies of one aspect card from the collection, recorded               | **Setup:** each player searches for a minion and puts it into play engaged, else 1 facedown encounter card   |
  | 13   | **Setup:** each player flips their S.H.I.E.L.D. Tech to its Enhanced side                   | Choose another random Osborn Tech, record it                                                                 |
  | 17   | Planning Ahead: record 1 card; **Setup:** search deck and discard for it, add to hand       | **Setup:** first player searches for a scenario-specific side scheme, reveals it, +1[per_hero] threat        |
  | 21   | **Setup:** each player may put a Helicarrier (Core 92) from the collection into play        | Choose another random Osborn Tech, record it                                                                 |
  | 25   | **Setup:** each player may put a Symbiote Suit (191) from the collection into play          | **Setup:** Deal 1 facedown encounter card to each player                                                     |

- **Log fields** (MC27 p. 23): Community Service (shared card list), Waking Nightmare (number), Last Ones Standing
  (card list), Final Reputation Score, per seat S.H.I.E.L.D. Tech / Aspect Advantage / Planning Ahead, Osborn Tech
  (shared list), the reputation value, and expert remaining hit points.
- **Expert campaign** (MC27 p. 6): persistent damage capped at base; "during the Setup instructions of the next
  scenario, the defeated player may rejoin their teammates and reset their hit point dial … by dealing themselves
  facedown encounter cards"; the optional deck-customization freeze (foundation row 55).
- **What the foundation lacks:** the in-game queries for three of the six conditions and the Waking Nightmare count
  (§3.27), the extra mulligan (§3.26), and whatever §3.27's check of the reputation marking finds. Everything else
  (random-3-choose-1, collection choices, `setGrantFace`, `instructionList` + `conditionalInstructions`, `LossPolicy`,
  prohibitions) is built and waiting to be exercised.

---

## 3. Engine primitives for cycle 4 (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names below say where each primitive is
needed, and each section names cards from other packs that compose with it.

**Priority order.** The box first (its scenarios, then its heroes, then its campaign), then the hero packs in release
order (Nova, Ironheart, Spider-Ham, SP//dr). **A pack whose cards need an unbuilt primitive stays data only.** Checked
against `pnpm dsl` (379 builders), the engine's `EffectSpec` / `RuleSpec` / `TriggerEvent` / `ValueSpec` /
`Predicate` unions and wave 1–4 §3, 2026-09-26: everything not listed here composes today (§3.32).

| §    | Primitive                                                                                    | Needed by                                                                                      | Status  |
| ---- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------- |
| 3.1  | Villains that enter and leave play: set-aside villains, activation order, no villain in play | The Sinister Six; Frequent Flyers, High Fashion, Robotic Enhancements, Surprise!               | open    |
| 3.2  | An enemy activation that can be interrupted and canceled                                     | Sinister Synchronization / Beatdown ("Ambush!"), Web Binding                                   | open    |
| 3.3  | Several main schemes, one marked by a counter; a completed stage flips to an environment     | Venom Goblin (glider counter)                                                                  | open    |
| 3.4  | Acceleration tokens on any card, moved between cards, and announced                          | Hapless Pedestrians, Tracking Prey, Lower/Midtown/Upper Manhattan                              | open    |
| 3.5  | Encounter cards in a player's deck, hand and discard pile                                    | Mysterio (whole scenario), MC27 scenario 3 campaign                                            | open    |
| 3.6  | Boost cards held on a card that does not activate, then moved to an enemy                    | Venom ("Leave Us Alone!", Vengeance), MC27 scenario 2 expert                                   | open    |
| 3.7  | A resolved Special reports the cards it discarded                                            | Sandslide, Surging Sands                                                                       | open    |
| 3.8  | Increasing the damage a character takes                                                      | Bell Tower (Ringing)                                                                           | open    |
| 3.9  | A card that counts as another card type with a trait                                         | Festering Mass                                                                                 | open    |
| 3.10 | Scheme icons printed on any card                                                             | Team Leader, Public Outcry, Venom ally, Symbiote Suit; 30 records in other packs               | open    |
| 3.11 | Text that depends on the mode of play                                                        | Frequent Flyers ×3, Surprise!, From Every Direction, Life-Size Decoy, Ambush!, Teamwork …      | open    |
| 3.12 | "The first attack this turn"                                                                 | Venom III (Retribution)                                                                        | open    |
| 3.13 | "When/After X leaves play"                                                                   | Spider-Man (Hobie Brown), Ghost-Spider ally, Web of Life and Destiny, Warrior of the Great Web | open    |
| 3.14 | "(Max 1 per [instance])"                                                                     | Ghost Kick, Phantom Flip, Web-Bracelet, Fluid Motion; Temporal Shield, Psylocke 41xxx          | open    |
| 3.15 | Facedown attached cards: playable events, a count, a maximum                                 | George Stacy, Parental Guidance, Worried Father, Spider-Man Noir                               | open    |
| 3.16 | How a card was paid for: resources by type and by source                                     | Moon Girl, VEN#m, Rapid Deployment, Web-Trap; Sync Ratio                                       | open    |
| 3.17 | A resource card spent for another player                                                     | Everyday Hero                                                                                  | open    |
| 3.18 | A card that does not count toward hand size                                                  | Connection to the Worldmind                                                                    | open    |
| 3.19 | Any number of tough status cards                                                             | Armadillo                                                                                      | open    |
| 3.20 | Treating printed resources as another type                                                   | Haywire                                                                                        | open    |
| 3.21 | An additional cost to thwart a scheme                                                        | Cat in a Tree, Giant Monster Attack                                                            | open    |
| 3.22 | A basic thwart that may remove threat only from one scheme                                   | Retinal Display                                                                                | open    |
| 3.23 | Progressing identities: swapping one identity card for the next                              | Ironheart                                                                                      | open    |
| 3.24 | A separated identity (two cards, one dial)                                                   | SP//dr                                                                                         | open    |
| 3.25 | Resources generated: an event, and counters spent as resources                               | M.O.R.B.I.U.S.; Spider-Ham's toon counters                                                     | open    |
| 3.26 | An additional mulligan                                                                       | MC27 reputation node 5                                                                         | open    |
| 3.27 | Campaign queries for the reputation conditions and Waking Nightmare                          | MC27 pp. 13, 22                                                                                | open    |
| 3.28 | Looking at the top card of the encounter deck at any time                                    | Sector Scan                                                                                    | open    |
| 3.29 | Replacing damage with counters on another card, with no excess damage                        | Bell Tower (Quiet); MC27 p. 21 FAQ                                                             | open    |
| 3.30 | A player card attached to an encounter card and returned when its host leaves                | Wrist Navigator                                                                                | open    |
| 3.31 | A printed text box that cannot be blanked                                                    | SP//dr Suit, SP//dr                                                                            | open    |
| 3.32 | Reusable as is                                                                               | —                                                                                              | checked |

### 3.1 Villains that enter and leave play: set-aside villains, activation order, no villain in play

**Cards.** Sinister Synchronization 1A/1B, Sinister Beatdown 2A/2B, Doctor Octopus, Electro, Hobgoblin, Kraven the
Hunter, Scorpion, Vulture (27094–27099), Frequent Flyers, High Fashion, Robotic Enhancements, Surprise!, Heightened
Morale, Taunting Presence, Team Leader, Take One for the Team, Partnership of Pain.

**Rules.** MC27 p. 15 "The Active Counter": only the villain with the active counter activates in step 2; "the
villain" without a qualifier is the active villain; "After the villain with the active counter is defeated, move the
active counter to the next villain in the activation order. If no other villains are in play, set the active counter
aside." "Activation Order": "move the active counter … to the villain with the next ascending value in the order. If
there is no activation order value greater than the current villain's value, move the active counter to the villain
with the lowest activation order value." FAQ p. 62: overkill goes to the active villain (already built, wave 3); "What
happens if a villain needs to activate and there are one or more villains in play but none of them have the active
counter? A: Place the active counter on the villain with the lowest activation order value and continue that
activation." MC27 p. 21: a stunned active villain does not move the counter (its forced response never triggers); a
lone villain keeps it.

**Plan.**

- **Zero villains in play is a legal state.** Today the engine assumes a villain in play (setup, step 2, "the
  villain"). With `MultipleVillains.atSetup: "setAside"` (§1.5) every villain starts in `encounterSetAside`; any
  reference to "the villain" with none in play resolves to nothing (effects fizzle, "the villain attacks you" makes no
  attack, "If no attack was made this way" reads true).
- **`EffectSpec putVillainIntoPlay { villains: "randomSetAside" | query; count?: ValueSpec; activeCounter?: "onIt" |
"lowestActivationOrder" | "keep" }`**: the set-aside villain(s) enter play with full hit points and their
  keywords (toughness), `villainEnteredPlay` logged. Covers the 1A Setup, "Ambush!", Sinister Beatdown 2A ("even if
  another villain has the counter") and "Put the set-aside Hobgoblin and Vulture into play". A villain already in play
  is not put in again, and the effect reports how many entered (`eventResult`) for "If no villain was put into play
  this way".
- **`EffectSpec setVillainAside { villain }`**: "Set this villain aside" from its When Defeated. RRG 1.8 "Leaves Play"
  (p. 27): it is a new copy when it returns. Its attachments are discarded as for any card leaving play.
- **`EffectSpec moveActiveCounter { to: "nextInActivationOrder" }`**, and the engine's own rule when the active villain
  is defeated (MC27 p. 15). The existing `setActiveVillain` covers "place the active counter on it".
- **The FAQ fallback**: at step 2, with villains in play and none active, the lowest activation order takes the
  counter (`activeVillainChanged { reason: "noActiveVillain" }`).
- **`winCondition: "cardAbility"`**: defeating the last villain in play neither wins nor ends the villain phase.

**Composes with:** Loki's set-aside villains (wave 4 §3.7) and any later scenario that brings villains in and out
(Mojo's Wheel of Genres villain faces, `mojo`).

### 3.2 An enemy activation that can be interrupted and canceled

"Forced Interrupt: When a villain would activate, if no villain is in play, resolve this card's 'Ambush!' ability.
Continue that activation." (27100b, 27101b); Web Binding: "Hero Interrupt: When an enemy would activate, cancel that
activation. If a minion's activation was cancelled this way, deal 4 damage to that minion." Today an activation starts
without an event (a status card replaces it internally). **Plan:** `TriggerEvent enemyActivating { enemyId | null,
activation: "attack" | "scheme", against }`, interrupt window only, pushed only when an ability listens; a canceled one
is a replaced activation (it counts as having activated for "after … activates" readers? — no: §4 Q3). With no
villain in play at step 2, the villain activation is still announced with `enemyId: null`, and after the interrupt it
continues against the active villain if one now exists. **DSL:** `on.enemyActivating(who)`, `cancelActivation`.
**Composes with:** Hawkeye-style "when an enemy would activate" cards in later packs (grep "would activate").

### 3.3 Several main schemes, one marked by a counter; a completed stage flips to an environment

**Rules.** MC27 p. 17 "The Glider Counter" (quoted in `docs/campaign-modes/markdown/mc27_sinister_motives.md`) and the
p. 67 erratum; FAQ p. 62 and MC27 p. 21 (a player card's "the main scheme" may be any main scheme; a player effect's
acceleration token goes on the glider scheme; counting tokens on "the main scheme" is the player's choice; ties are the
first player's; patrol and crisis protect only the glider scheme).

**Plan.** Wave 4 §3.2 built most of this for Tower Defense (`extraMainSchemes`, step one per scheme, the player's
choice of main scheme). What is new:

- **`RuleSpec focusedMainScheme` gains `scheme: query` and `encounterCardsMean: "focused"`**: with a scheme marked by
  a named counter (`countersOn("glider") >= 1`), encounter cards' "the main scheme", enemy scheme threat, acceleration
  tokens, patrol and crisis all mean that one scheme (Tower Defense keeps "every shared main scheme"). The rule is a
  scenario rule with no card in play (wave 4 §3.40): Skies Over New York's environment side states it and is set aside.
- **The 1A Setup**: `putMainSchemeStageIntoPlay` for stages B–D (by letter), then the A stage leaves: `flipCard` to its
  environment face (§1.1 `otherFaceId`) and set it aside. The central slot passes to the first extra scheme (an engine
  representation only; no rule reads "central").
- **Completion by flip** (`MainSchemeStage.onCompletion`): the stage leaves the main schemes and its environment face
  enters play and is revealed (When Revealed resolves); no advance, no loss. Wave 4 §3.4's `mainSchemeCompleting`
  still sees it first.
- **`EffectSpec moveCounters { from, to, counterType?, all? }`**: "Move the glider counter to the main scheme with the
  least threat"; also SP//dr's "moving all counters on this card … to her" (§3.24) and Worried Father's shape.
- "The main scheme with the least/most threat": `superlative` among main schemes (verify the `mainScheme` category is
  in the pool; add it if not).

### 3.4 Acceleration tokens on any card, moved between cards, and announced

RRG 1.8 "Acceleration Token" (p. 5): "Acceleration tokens placed on cards other than the main scheme still add threat
to the main scheme during step one", and "are removed from play when the card they are placed on leaves play".
Tracking Prey: "place 1 acceleration token here"; Hapless Pedestrians 1B: "Forced Response: After an acceleration
token is placed on this scheme, deal 3 indirect damage to the first player"; the Manhattan environments: "Move … each
acceleration token from here to the main scheme with the least threat". Today only main scheme stages hold tokens
(`effects.ts addAccelerationToken`: "a target that is not one is left alone") and the placement announces nothing.

**Plan:** tokens on any card as the `acceleration` counter (main schemes keep `MainSchemeState.accelerationTokens`),
counted by step one toward the main scheme (the glider one under §3.3); `TriggerEvent accelerationTokenPlaced {
schemeInstanceId }` (response window, only with a listener); `moveCounters` (§3.3) moves them, with main-scheme tokens
included.

### 3.5 Encounter cards in a player's deck, hand and discard pile

**Cards.** Mysterio II ("shuffle the top card of the encounter deck into each player's deck"), Edge of Reality 2A,
Maze of Mirrors / Edge of Reality 1B/2B ("Forced Interrupt: When you would draw or discard an encounter card from your
deck, deal it to yourself as a facedown encounter card → draw 1 card"), Mysterio I–III (Seeds of Fear / Creeping Fear
/ Bound by Fear: "After you resolve a boost card during Mysterio's activation, place that card in your discard pile /
on the bottom of your deck / on the top of your deck if it has the [Illusion] trait"), Humongous Hallucination,
Shifting Apparition, Déjà Vu ("Shuffle Déjà Vu into any player's deck"), the campaign's "shuffle the top 2 cards of
the encounter deck into their deck" and Waking Nightmare.

**Rules.** MC27 p. 13 and its FAQ (§2.2).

**Plan.**

- `moveCards` accepts an encounter card with destinations `deckShuffle` / `deckTop` / `deckBottom` / `discard` of a
  named player: it stays unowned (`ownerId: null`), keeps its encounter home (so "discard" elsewhere sends it to the
  encounter discard pile), and sits facedown in a deck, faceup in a discard pile. Every player-deck reader
  (`deckCountOf`, the reset, "discard the top N cards of your deck", searches for player cards) sees it as a card
  in that deck; a search for a player card never matches it.
- **`TriggerEvent encounterCardLeavingPlayerDeck { playerId, instanceId, how: "draw" | "discard" }`**, interrupt window,
  pushed for each encounter card a draw or a deck discard would take, after all the cards of that draw are taken (the
  FAQ's "drawn simultaneously … Afterward, deal each encounter card"). Its replacement is `dealAsEncounterCard` of that
  card (exists, wave 3). With no listener an encounter card simply goes to the hand or discard pile (§4 Q4).
- **`TriggerEvent boostCardResolved { enemyId, instanceId, playerId }`** (response window) between a boost card's
  resolution and the end-of-activation discard, so "place that card in your discard pile" moves it before the
  discard.
- **At game end** the log records the count first (§3.27), then nothing is needed: each game builds decks afresh.

### 3.6 Boost cards held on a card that does not activate, then moved to an enemy

"place 1 facedown boost card on your identity"; "Leave Us Alone!" 1B: "Forced Interrupt: When Venom activates against
you, move each facedown boost card from your identity to Venom." `CardInstance.boostCards` is already a per-instance
list, and `giveBoostCard` (wave 2) gives waiting boost cards to an enemy. **Plan:** `giveBoostCard.enemy` widens to any
card (an identity holds them, never resolves them; RRG "Leaves Play" discards them with the card), and
`EffectSpec moveBoostCards { from, to }`: moved cards wait on the enemy as boost cards dealt outside its activation
(RRG 1.8 "Boost", p. 11). Biting Retort's "Each boost card turned faceup during that activation gets +1 boost icon" is
`eachTimeUntil` on `boostIconsCounting` (verify when scripting).

### 3.7 A resolved Special reports the cards it discarded

Sandslide: "Place 2 sand counters on City Streets, then resolve its 'Surging Sands' ability. If at least 1 Sandman card
was discarded this way, you are stunned." **Plan:** `resolveSpecials` binds (`bind`) the cards its resolved abilities
discarded from the encounter deck, readable by `countAmong`. Verify first whether the effects frame already exposes a
nested ability's bindings (wave 4 §3.43); if so this is a DSL helper only.

### 3.8 Increasing the damage a character takes

Bell Tower (Ringing): "Increase all damage Venom takes by 1." **Plan:** `RuleSpec increaseDamageTaken { target, amount,
fromAttack? }`, the mirror of `reduceDamageTaken`, applied before reductions (RRG 1.8 "Modifiers" order: increases,
then decreases). Applies per damage event, as "reduce … from each attack" does per attack (§4 Q7).

### 3.9 A card that counts as another card type with a trait

Festering Mass: "While there are no other [Symbiote] environments in play, this card is considered a [Symbiote]
environment." Read by "If a [symbiote] environment is in play" (Lower/Midtown/Upper Manhattan, Symbiotic Berserker,
Monstrosity, Thrall) and "at least 2 [symbiote] environments" (the loss). **Plan:** `RuleSpec countsAs { target,
cardType, traits, while? }` read by `TargetQuery` category and trait matching only (not by where the card lives). The
"no other" condition is `while: not(exists(environment with trait, excluding self))`, evaluated without the rule
itself (no recursion).

### 3.10 Scheme icons printed on any card

Schema §1.3. **Plan:** the icon counters (hazard at the deal step, crisis for threat removal, acceleration at step one)
add `schemeIcons` of every card in play to what they count today (scheme icons and `gainsIcon`). A flipped card uses
its showing face's icons.

### 3.11 Text that depends on the mode of play

"In expert mode, this card gains incite 1 and cannot be canceled" (Frequent Flyers, High Fashion, Robotic
Enhancements), "gains surge" (Surprise!, From Every Direction), "gains toughness" (Life-Size Decoy), "(In expert mode,
place 2 threat on Light at the End)" (Ambush!), Teamwork Makes the Dream Work's boost, Coordinated Effort/Hidden in
Shadow boosts, Sinister Beatdown 2A, Smear Campaign. **Plan:** `Predicate inMode { expert?: true, heroic?: true }`,
usable in `while` of keyword grants and `cannotBeCanceled`, and in `ifThen`. The modes are in the setup config already
(`query.ts` reads `"expert"`).

### 3.12 "The first attack this turn"

Venom III: "place 1 facedown boost card on your identity (2 facedown boost cards instead if this is the first attack
this turn)". **Plan:** a per-turn count of attacks made against the villain, or `attackedThisTurn` if it already
records it (wave 2 §11.3); `Predicate firstAttackThisTurn { target }`. Verify the existing field's meaning first.

### 3.13 "When/After X leaves play"

Spider-Man (Hobie Brown) and Ghost-Spider ally: "Interrupt: When [this ally] leaves play, …"; Web of Life and
Destiny, Warrior of the Great Web: "Response: After a [Web-Warrior] ally leaves play". Wave 4 §3.8 listed this as not
built. RRG 1.8 "Leaves Play" (p. 27) covers defeat, discard, victory display and removal from the game; ruling Jan 17,
2026 (1) #2: the "Leaves Play" bullets happen simultaneously with leaving, so an interrupt sees the card still in play
with its attachments, and a response sees it gone. **Plan:** `TriggerEvent cardLeavingPlay { instanceId, to }`
(interrupt) and `cardLeftPlay` (response), pushed by `leavePlay` only when an ability listens, carrying the printed
card so a response can read what left. **DSL:** `on.leavesPlay(who)`, `on.leftPlay(query)`. **Composes with:** Abduct
Superhumans (`aos` 50081), Bishop's and later "leaves play" cards.

### 3.14 "(Max 1 per [instance])"

RRG 1.8 "Max 1 per [instance]" (p. 28): "restricts the number of times an ability can be triggered by a single instance
of a triggering effect across all copies of the card with the maximum. (For example, if an ability has the text '(Max 1
per event.),' only one card with that ability can be triggered per event played.)" Ghost Kick, Phantom Flip ("Max 1
per basic power use"), Web-Bracelet ("per event"), Fluid Motion ("per [Attack] event"); also Temporal Shield and the
Psylocke card ("per attack"), which wave 2 left unmodeled. **Plan:** `AbilityLimit.perTriggeringInstance: true`: the
limit is kept per triggering event instance and shared by every copy of the card's title.

### 3.15 Facedown attached cards: playable events, a count, a maximum

George Stacy: "Events attached to George Stacy may be played as if they were in your hand. Action: Exhaust George
Stacy → attach 1 event from your hand facedown here (to a maximum of 3)"; Parental Guidance attaches one from hand or
discard; Worried Father attaches George Stacy facedown to itself; Spider-Man Noir: "X is equal to the number of
facedown cards attached", "attach that treachery facedown here (to a maximum of 3)". `attach { facedown }` and
`playableAttachments` exist. **Plan:** verify `playableAttachments` offers a facedown attached event (its owner may
look at it) and plays it faceup; `TargetQuery.facedown` on attachments for the count; the "to a maximum of 3" is local
(ruling Mar 30, 2026 (1)), an `ifThen` on the count, not a rule.

### 3.16 How a card was paid for: resources by type and by source

Moon Girl: "draw 1 card for each [mental] resource used to pay for her"; VEN#m: "for each resource generated by SP//dr
Suit's 'Sync Ratio' ability to pay for her"; Rapid Deployment, Web-Trap: "If you paid for this card using a resource
generated by SP//dr Suit's 'Sync Ratio' ability". `cardPlayed.paid` holds the typed pool; the source is not kept.
**Plan:** each generated resource carries its source (card instance and ability id) through the payment;
`ValueSpec resourcesPaid { card, type?, sourceAbility? }` and `paidWith.sourceAbility`.

### 3.17 A resource card spent for another player

Everyday Hero: "While your identity has the [Civilian] trait, this card can be spent for any player and gains the
text: 'Response: After you spend this card for a player, heal 1 damage from that player's identity.'" Resource
_abilities_ have `forAnyPlayer` (Piloting); a resource _card_ from hand does not. **Plan:** `RuleSpec
spendableForAnyPlayer { while }` on the card, read by the payment's hand-card contributors (the Alliance group-payment
path, wave 4 §3.17), and `youSpendThis` reporting the paying player.

### 3.18 A card that does not count toward hand size

Connection to the Worldmind. RRG 1.8 "Hand Size" (p. 21). **Plan:** `RuleSpec notCountedTowardHandSize` on the card,
read by the end-of-phase discard/draw and every "cards in hand compared to hand size" reader; `handCountOf` keeps
counting it (it is in hand).

### 3.19 Any number of tough status cards

Armadillo: "Armadillo can have any number of tough status cards." RRG 1.8 "Status Cards" (p. 41) limits one of each
(steady adds one of stunned/confused). **Plan:** `RuleSpec statusLimit { target, status: "tough", max: "unlimited" }`;
a tough status card then prevents one damage event and is discarded one at a time; piercing discards them all.

### 3.20 Treating printed resources as another type

Haywire: "Treat the printed resource of each card in your hand as if it were [energy]." Read by Zzzax, Feedback Loop,
Zzzap! and by payment. **Plan:** `RuleSpec printedResourceAs { cards, as }`, read by the printed-resource readers and
generation (one icon of the given type per printed icon).

### 3.21 An additional cost to thwart a scheme

Cat in a Tree: "As an additional cost to thwart this scheme, take 2 indirect damage"; Giant Monster Attack: "As an
additional cost to thwart this scheme, you must spend a [energy] resource." **Plan:** `RuleSpec additionalThwartCost {
scheme, cost: AbilityCost }`; a thwart that cannot pay it cannot target the scheme (legal targets exclude it).

### 3.22 A basic thwart that may remove threat only from one scheme

Retinal Display: "Your hero's basic thwart power (THW) can only remove threat from the scheme with the most threat."
**Plan:** `RuleSpec basicThwartTargets { character, among: query }` restricting legal thwart targets; the Enhanced side's
"ignore the crisis icon and the patrol keyword" for basic thwarts is `characterIgnores` with a `basicOnly` flag (verify).

### 3.23 Progressing identities: swapping one identity card for the next

Ironheart insert (§1.4 quote). Level Up!: "Remove 6 progress counters from Ironheart → ready her and swap her with
[Version 2] Ironheart." RRG 1.8 "Swap" (p. 42): neither card enters or leaves play; tokens, attachments and status
cards transfer; the dial stays. **Plan:** setup puts `progressingIdentity.versions[0]` in the identity slot and sets
the rest aside in the player's set-aside area; `EffectSpec swapIdentity { toVersion: next }` replaces the identity
instance's card (same instance, like `swapVillain`), keeping form (hero), damage, counters, statuses and attachments;
hand size, hit points and abilities are the new card's. `ValueSpec traitNumber { of, prefix: "VERSION" }`. A defeat of
the identity eliminates the player as always (the set-aside versions need nothing). Log `identitySwapped`.

### 3.24 A separated identity (two cards, one dial)

SP//dr insert, "New Rule: Separated Identity Card": "One card represents the human pilot, Peni Parker, while the other
represents the robotic SP//dr Suit. Start the game with the Peni Parker alter-ego in play and, following her 'Setup'
instructions, put the INACTIVE support side of the SP//dr Suit card into play. While in alter-ego form, to change to
hero form, flip Peni Parker from her alter-ego side to her SP//dr upgrade side and flip the SP//dr Suit card from its
INACTIVE support side to its ACTIVE hero side. While in hero form, to change to alter-ego form, flip the SP//dr Suit
card from its ACTIVE hero side to its INACTIVE support side and flip the SP//dr upgrade side to its Peni Parker
alter-ego side. Both identity cards share a single hit point dial, with damage persisting on the dial between forms.
Additionally, if one form is defeated, both forms are considered to be defeated simultaneously and the player is
eliminated from the game." The cards' own text (Suit Up!, Return to Base, errata p. 67) moves counters and attachments
toward the card that is the identity.

**Plan:** two instances: the identity instance is Peni Parker in alter-ego form and the Suit in hero form; the other
card is a permanent support (INACTIVE Suit) or an upgrade attached to the Suit (SP//dr). A form change flips both and
moves the identity slot, counters and attachments as the printed Suit Up! / Return to Base say (their forced
interrupts are the engine's own transition, scripted as the "when you flip to this side" abilities). The dial is the
player's, not the card's. Remove the `createGame` refusal and `validateDeck`'s `unsupported_identity` for it.

### 3.25 Resources generated: an event, and counters spent as resources

M.O.R.B.I.U.S. (errata): "After the engaged player generates any number of resources, deal an equal amount of damage
to that player's hero." `resourcesGenerated` is logged, not announced. **Plan:** `TriggerEvent resourcesGenerated {
playerId, amount }` (response). Spider-Ham: "Each toon counter on Spider-Ham can be spent as if it were a [wild]
resource" composes as a resource ability (`spendCounters` 1 → generate [wild], no limit); §4 Q5 on whether that counts
as "generating".

### 3.26 An additional mulligan

MC27 p. 22 node 5 with the p. 67 erratum: "During the Resolve Mulligans step of game setup, each player may take 1
additional mulligan." **Plan:** `GameSetupConfig.players[].extraMulligans?: number`, a second mulligan choice after the
first draw-up (Appendix II step 15 repeated), set by the campaign's setup.

### 3.27 Campaign queries for the reputation conditions and Waking Nightmare

**New `CampaignGameQuery` members:** `accelerationTokensInPlay` (every token, main schemes and other cards),
`defeatedIdentities` (count), `cardsInPlayerDecks { query }` ("the total number of Illusion cards in all player
decks", read before the game's encounter cards are gone). "No threat on the main scheme" is `threatOn` of every main
scheme (Venom Goblin has several; scenario 5's reputation is optional). **Verify** that marking nodes (a numeric field,
threshold nodes 1, 5, …, 25 whose white boxes resolve at once and whose pink boxes append `conditionalInstructions`
ids, clamped at zero per marking per ruling Aug 3, 2026 (4) #2) composes from the existing ops; if it does not, the
missing op goes here.

### 3.28 Looking at the top card of the encounter deck at any time

Sector Scan: "Until the end of the round, you may look at the top card of the encounter deck at any time." **Plan:** a
lasting `RuleSpec mayLookAtTopOfEncounterDeck { player }` read by `visibility.ts` for that player's view; no game state
changes, logged as a lasting effect.

### 3.29 Replacing damage with counters on another card, with no excess damage

Bell Tower (Quiet): "Interrupt: When any amount of damage would be dealt to Venom by an attack, (you may) place that
many chime counters here instead." MC27 p. 21: "no damage is actually dealt … excess damage effects do not apply."
**Plan:** `instead` of the damage event + `addCounters` of `eventAmount` composes; verify the attack reports zero
damage dealt and no excess (overkill, "defeated with excess damage").

### 3.30 A player card attached to an encounter card and returned when its host leaves

Wrist Navigator (campaign): "Forced Response: After a minion or side scheme enters play, attach Wrist Navigator to it.
Interrupt: When the attached card is defeated, draw 1 card. (Return this card to your play area.)" Permanent.
**Plan:** `attach` of an owned upgrade to an encounter card keeps its controller; when the host leaves play, a
permanent attachment is not discarded but returns to its controller's play area (RRG 1.8 "Permanent", p. 32: it
cannot leave play). Verify what `leavePlay` does today with a permanent attachment.

### 3.31 A printed text box that cannot be blanked

SP//dr Suit 1B and SP//dr: "This card's printed text box cannot be treated as if it were blank." Panic in the Streets
and Vivian blank text boxes. **Plan:** `RuleSpec textBoxCannotBeBlanked` read by `blankTextBox`.

### 3.32 Reusable as is (checked against `pnpm dsl` and the engine)

| Printed wording                                                                                                           | Cards                                                                   | Existing vocabulary                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| "Resolve Spider-Man's 'Venom Blast' / 'Spider Camouflage' ability"; "Resolve the 'Surging Sands' ability on City Streets" | Miles kit, Sandman set, Venom Goblin set                                | `resolveSpecialsOf`                                                    |
| "If you paid for this card using a [energy] resource"                                                                     | Web-Shot, Swing In, Jump Flip, Double Life, Forcefield Projection       | `paidWith`                                                             |
| "Divide damage from Bombshell's attack among each enemy as evenly as possible"                                            | Bombshell ally 29033, minion 31031                                      | `divideBasicPower` (ruling Jan 11, 2026 (4))                           |
| "Wasp ignores the guard keyword, patrol keyword, and crisis icon"                                                         | Wasp 29034                                                              | `characterIgnores` (wave 4 §3.24)                                      |
| "Double the number of [wild] resources generated while paying for this card"                                              | Lightspeed Flight, Pot Shot                                             | `doublesResourcesWhilePayingFor` (verify a type filter)                |
| "Play under any player's control. Max 1 per player."                                                                      | Plan B                                                                  | `anyPlayerControl` play restriction                                    |
| "Team-Up (Gwen Stacy and Miles Morales)"                                                                                  | Young Love ×2                                                           | team-up keyword, `teamUpCharacters`                                    |
| "Attach to a character with 'Spider' in its title"                                                                        | Warrior of the Great Web                                                | `titleContains` host (FAQ p. 62: "Spider" spelled exactly)             |
| "the minion with the most traits" / "highest activation order value"                                                      | Cyborg Tech; Heightened Morale, Team Leader                             | `superlative` measures (wave 2 §6.7)                                   |
| "Threat cannot be removed from this scheme while a [Criminal] minion is in play"                                          | Grand Larceny; Brute Force Barricade (other side schemes)               | `threatCannotBeRemoved`                                                |
| "Treat attached ally as a minion with a blank text box (except for traits)"                                               | Manipulated Mind                                                        | `treatAttachedAllyAsMinion(…, { keepPrintedTraits })` (wave 4 §3.9)    |
| "Each [Inheritor] minion gains patrol / guard / stalwart / villainous / retaliate 1"                                      | Inheritors                                                              | `gainsKeyword`                                                         |
| "Each enemy gains 1 acceleration / hazard icon"                                                                           | Coordinated Effort, Hidden in Shadow, Bora, Rule by Force               | `gainsIcon` (wave 4 §3.57)                                             |
| "X is equal to the total SCH/ATK of all other villains in play"                                                           | Partnership of Pain                                                     | `totalStatOf` (wave 4 §3.41)                                           |
| "You cannot attack villains who do not have an attached copy of Take One for the Team"                                    | Take One for the Team                                                   | `cannotAttack` with `hasAttachment`                                    |
| "Remove 'Go for Champions!' from the game → each [Champion] character cannot take damage"                                 | "Go for Champions!" (FAQ p. 62; ruling Jan 26, 2026 (1))                | `cannotTakeDamage` via `applyRuleUntil`; damage costs refused          |
| "When you would reveal an encounter card …" / "cancel its 'When Revealed' effects"                                        | Spider-Tingle, Scarlet Spider, Pirouette and Punch, "I Don't Think So!" | `encounterCardRevealing`, `cancelWhenRevealed`, `cancelRevealedCard`   |
| "After you resolve an 'Interrupt' or 'Response' ability on an event"                                                      | Ghost-Spider, Web-Bracelet                                              | `abilityResolved` + `abilityTiming` (wave 4 §3.33; verify the pattern) |
| "Stun and confuse"; "a total of 2 stun status cards on up to 2 enemies"; "steady", "stalwart"                             | Miles ally, Thwip Thwip!, Unshakable, Wave Bracers                      | `giveStatus`, keyword grants, RRG Steady (`keywords.ts`)               |
| "search the encounter deck for a side scheme. Reveal that side scheme → draw 3 cards"                                     | One Way or Another                                                      | `searchAndReveal`                                                      |
| "Set your hit point dial to 6"                                                                                            | Ejection Protocol                                                       | `setRemainingHitPoints`                                                |
| "When a player card would be placed into a discard pile from play … shuffle that card into its owner's deck instead"      | Pinpoint                                                                | `discardRedirected` (verify)                                           |
| "Victory 1" on a card with uses                                                                                           | Public Outcry                                                           | uses + victory (RRG p. 46, `victory-keyword.test.ts`)                  |
| Setup-keyword player upgrades                                                                                             | S.H.I.E.L.D. Tech                                                       | `putSetupCardsIntoPlay`                                                |

---

## 4. Open questions (for the user or FFG)

Each is implemented the way stated, or not at all, and named here rather than decided silently. **Proposed defaults are
flagged; none is implemented yet.**

1. **The Sinister Six at setup** (§1.5, §3.1). The 1A Setup chooses and puts the villains into play, so the scenario
   record starts all six set aside and the Setup script brings X = players + 1 in. **Default:** as stated; the random
   choice is the game's seeded RNG (replayable).
2. **A villain phase with no villain in play and none set aside.** Cannot happen with printed cards (a defeated Sinister
   Six villain is set aside, not removed), but the engine must do something. **Default:** step 2 is skipped, logged.
3. **A canceled activation** (Web Binding, §3.2). Does "After X activates against you" still trigger? RRG says a
   canceled effect is not resolved. **Default:** no; a canceled activation did not happen (like a status card's
   replaced activation, MC27 p. 21 FAQ on the active counter).
4. **An encounter card drawn with nothing listening** (§3.5). Both Mysterio main scheme stages carry the interrupt, so
   printed play never reaches it. **Default:** it goes to the hand like a player card, cannot be played, and is
   discarded to the encounter discard pile by the end-of-phase discard. An encounter card never counts as a player
   card for "cards in hand" readers? **Default:** it does count (it is a card in hand); Evil Doppelgänger and Deepest
   Fears count identity-specific cards only, so the question only reaches plain hand counts.
5. **Spider-Ham's toon counters** (§3.25): spending one is modeled as a resource ability that generates [wild].
   **Default:** it counts as generating a resource (M.O.R.B.I.U.S. would deal damage for it).
6. **Negative victory points in the reputation total** (§1.2). Ruling Aug 3, 2026 (4) #2: they "do not mark nodes".
   **Default:** the victory-point condition contributes max(0, sum) to the total, and a negative total marks nothing.
7. **Bell Tower's "Increase all damage Venom takes by 1"** (§3.8): per damage event (each attack's damage, each
   effect's damage), not per point. **Default:** per damage event.
8. **Who chooses Bell Tower's optional "(you may)"** (§3.29). **Default:** the player whose attack it is (the
   controller of the attacking character); with no controlling player, the first player.
9. **Ironheart's swap and form** (§3.23): Level Up! is a hero-form Action and the new version enters its hero side;
   the swap is not a form change and does not use the once-per-round change. **Default:** as stated, following RRG
   "Swap" (neither enters nor leaves play).
10. **Everyday Hero for another player** (§3.17): its controller offers it into another player's payment during that
    payment. **Default:** allowed during any player's payment, the Alliance group-payment interaction.
11. **Reputation marking order** (§2.3). When one victory marks several connected nodes, white boxes resolve in node
    order, and each pink box's Setup starts from the next scenario. **Default:** as stated; `conditionalInstructions`
    land after each scenario's own campaign setup instructions (the foundation's existing rule).
12. **The extra mulligan** (§3.26): a full second mulligan (discard any number, draw back up). **Default:** as stated.
13. **Déjà Vu's "Shuffle Déjà Vu into any player's deck"**: chosen by the revealing player. **Default:** as stated.
14. **Public Outcry's expert uses count** (§1.9): "3" or "3[per_hero]". Needs the card image (pipeline).

---

## 5. What this asks of the other agents

- **`card-data-pipeline`** (after §1 lands):
  - make `sm` survey clean and emit it, campaign cards included (§1.1, §1.2, §1.3, §1.5, §1.8, §1.9), with the two
    precons from MC27 p. 20 and `SM_CAMPAIGN` (`data/sm/campaign.ts`, the `mts` shape);
  - "Bring the War!"'s text from the card image, the p. 67 errata still missing (Ms. Marvel, "Go for Champions!",
    M.O.R.B.I.U.S.), `progressingIdentity` on 29001a–29003a (§1.4), `schemeIcons` on the four wave 5 cards (§1.3);
  - the four hero-pack precons from their images;
  - later, the `schemeIcons` back-fill: `angel` 42001c, 42024; `aoa` 45072, 45178; `aos` 50083, 50115, 50179; `core`
    01136; `cw` 56106, 56114, 56131; `deadpool` 44013, 44015, 44024 (a player side scheme, which may take `icons`
    instead), 44043, 44044, 44045, 44051, 44054; `falcon` 53029; `fne` 60020; `gambit` 37025; `gmw` 16108, 16126;
    `hood` 24049b; `mojo` 39036, 39064; `mts` 21189b; `next_evol` 40031; `trors` 04163.
- **`ability-scripting-engineer`:** script each pack once its §3 primitives are "landed"; §3.32 lists what composes
  today. The Sinister Six's and Venom Goblin's scenario builders need §1.5 / §1.1 mapped to the engine config.
- **`encounter-ai-designer`:** the active-counter moves (§3.1) and the glider's "least/most threat" ties (first player
  chooses, MC27 p. 21) are first-player decisions; Venom Goblin's "Choose to either place 2 threat … or resolve its
  'Special'" is the first player's.
- **`rules-qa-engineer`:** a Sinister Six game where every villain in play is defeated and Ambush! brings one back; a
  Mysterio game where a multi-card draw hits two encounter cards; Venom's boost cards moving from identity to villain;
  the Venom Goblin loss at two Symbiote environments with Festering Mass; the campaign's full run, retry, permanent
  removal, and a reputation total crossing two nodes.
- **`game-client-engineer`:** villains entering and leaving (set-aside villains shown); the activation order and active
  counter; three main schemes with the glider counter; boost cards on an identity; encounter cards in a player's deck
  and discard pile (visible backs, per the FAQ); George Stacy's facedown events; Ironheart's version; SP//dr's two
  cards; the reputation track (MC27's design pass, `docs/campaign-client-per-box.md` §3).
