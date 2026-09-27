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
   Web, Spider-Man Noir) and its errata on pp. 67–68 (p. 67: MC27 p. 17 glider paragraph 4, MC27 p. 22 mulligan box, Worried
   Father, Venom I–III; p. 68: Manipulated Mind, Ms. Marvel, "Go for Champions!", SP//dr Suit 1B, M.O.R.B.I.U.S.). Entries
   this wave leans on: "Acceleration Token" (p. 5), "Boost, Boost Icon" (p. 11), "Hand Size" and "Hazard Icon"
   (p. 21), "Leaves Play" (p. 27), "Max 1 per [instance]" (p. 28), "Permanent" and "Patrol" (p. 32), "Set Aside"
   (p. 39), "Steady" and "Status Cards" (p. 41), "Swap" (p. 42), "Uses" and "Victory X" (p. 46), "Villain Defeat"
   (p. 47).
4. **`docs/phase7-wave5-sources.md`**, the tracker's index, reconciled with this pass (2026-09-26). Where the two
   differ, this file is the architect's reading:
   - Its §4.2 is superseded by RRG 1.8 pp. 67–68, which does carry cycle 4 card errata (listed in item 3 and in §1.9).
   - "Setup" on the S.H.I.E.L.D. Tech upgrades, "Steady" on Venom Goblin and "Symbiote" are not new rules: Setup and
     Steady are RRG keywords the engine implements, and Symbiote is a trait only (no RRG entry).
   - Its hero-kit guesses (Ironheart "armor forms", SP//dr "dual identity like Ant-Man") are not used; §3.23 and
     §3.24 are from the card text and the inserts.

`packages/content/raw/marvelcdb/{sm,nova,ironheart,spiderham,spdr}.json` point to card text and stats. They are not an
authority; every card of all five packs (raw JSON and emitted data) was read for this spec.

---

## 1. Schema decisions (owner: `game-rules-architect`)

> Status: **landed (2026-09-26)** in `packages/content/src/schema/**`, with fixtures in
> `packages/content/src/schema/wave5.test.ts` (10 tests) and `packages/engine/src/progressing-identity-gate.test.ts`
> (2 tests). New: `MainSchemeStage.otherFaceId` / `onCompletion` (§1.1), negative `victory` values (§1.2),
> `BaseCard.schemeIcons` / `CardFlipSide.schemeIcons` (§1.3), `HeroIdentityCard.progressingIdentity` (§1.4),
> `MultipleVillains.winCondition: "cardAbility"` and `atSetup: "setAside"` (§1.5). No emitted card changed; every pack
> still validates. **Data only until §3:** `otherFaceId`/`onCompletion` on a stage (§3.3), `schemeIcons` (§3.10),
> `atSetup` and `winCondition: "cardAbility"` (§3.1), so no scenario using them may be marked playable before its §3
> section lands. `progressingIdentity` is refused by `createGame` and reported `unsupported_identity` by `validateDeck`
> (a later version is told a deck names the first) until §3.23.

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
- **Errata to apply** (RRG 1.8 pp. 67–68): Worried Father (27025; raw already current), Venom I–III (27073–27075; raw
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
| 3.1  | Villains that enter and leave play: set-aside villains, activation order, no villain in play | The Sinister Six; Frequent Flyers, High Fashion, Robotic Enhancements, Surprise!               | landed  |
| 3.2  | An enemy activation that can be interrupted and canceled                                     | Sinister Synchronization / Beatdown ("Ambush!"), Web Binding                                   | landed  |
| 3.3  | Several main schemes, one marked by a counter; a completed stage flips to an environment     | Venom Goblin (glider counter)                                                                  | landed  |
| 3.4  | Acceleration tokens on any card, moved between cards, and announced                          | Hapless Pedestrians, Tracking Prey, Lower/Midtown/Upper Manhattan                              | landed  |
| 3.5  | Encounter cards in a player's deck, hand and discard pile                                    | Mysterio (whole scenario), MC27 scenario 3 campaign                                            | landed  |
| 3.6  | Boost cards held on a card that does not activate, then moved to an enemy                    | Venom ("Leave Us Alone!", Vengeance), MC27 scenario 2 expert                                   | landed  |
| 3.7  | A resolved Special reports the cards it discarded                                            | Sandslide, Surging Sands                                                                       | landed  |
| 3.8  | Increasing the damage a character takes                                                      | Bell Tower (Ringing)                                                                           | landed  |
| 3.9  | A card that counts as another card type with a trait                                         | Festering Mass                                                                                 | landed  |
| 3.10 | Scheme icons printed on any card                                                             | Team Leader, Public Outcry, Venom ally, Symbiote Suit; 30 records in other packs               | landed  |
| 3.11 | Text that depends on the mode of play                                                        | Frequent Flyers ×3, Surprise!, From Every Direction, Life-Size Decoy, Ambush!, Teamwork …      | landed  |
| 3.12 | "The first attack this turn"                                                                 | Venom III (Retribution)                                                                        | landed  |
| 3.13 | "When/After X leaves play"                                                                   | Spider-Man (Hobie Brown), Ghost-Spider ally, Web of Life and Destiny, Warrior of the Great Web | landed  |
| 3.14 | "(Max 1 per [instance])"                                                                     | Ghost Kick, Phantom Flip, Web-Bracelet, Fluid Motion; Temporal Shield, Psylocke 41xxx          | landed  |
| 3.15 | Facedown attached cards: playable events, a count, a maximum                                 | George Stacy, Parental Guidance, Worried Father, Spider-Man Noir                               | landed  |
| 3.16 | How a card was paid for: resources by type and by source                                     | Moon Girl, VEN#m, Rapid Deployment, Web-Trap; Sync Ratio                                       | landed  |
| 3.17 | A resource card spent for another player                                                     | Everyday Hero                                                                                  | landed  |
| 3.18 | A card that does not count toward hand size                                                  | Connection to the Worldmind                                                                    | landed  |
| 3.19 | Any number of tough status cards                                                             | Armadillo                                                                                      | landed  |
| 3.20 | Treating printed resources as another type                                                   | Haywire                                                                                        | landed  |
| 3.21 | An additional cost to thwart a scheme                                                        | Cat in a Tree, Giant Monster Attack                                                            | landed  |
| 3.22 | A basic thwart that may remove threat only from one scheme                                   | Retinal Display                                                                                | landed  |
| 3.23 | Progressing identities: swapping one identity card for the next                              | Ironheart                                                                                      | landed  |
| 3.24 | A separated identity (two cards, one dial)                                                   | SP//dr                                                                                         | landed  |
| 3.25 | Resources generated: an event, and counters spent as resources                               | M.O.R.B.I.U.S.; Spider-Ham's toon counters                                                     | landed  |
| 3.26 | An additional mulligan                                                                       | MC27 reputation node 5                                                                         | landed  |
| 3.27 | Campaign queries for the reputation conditions and Waking Nightmare                          | MC27 pp. 13, 22                                                                                | landed  |
| 3.28 | Looking at the top card of the encounter deck at any time                                    | Sector Scan                                                                                    | landed  |
| 3.29 | Replacing damage with counters on another card, with no excess damage                        | Bell Tower (Quiet); MC27 p. 21 FAQ                                                             | landed  |
| 3.30 | A player card attached to an encounter card and returned when its host leaves                | Wrist Navigator                                                                                | landed  |
| 3.31 | A printed text box that cannot be blanked                                                    | SP//dr Suit, SP//dr                                                                            | landed  |
| 3.32 | Reusable as is                                                                               | —                                                                                              | checked |

### 3.1 Villains that enter and leave play: set-aside villains, activation order, no villain in play

> **Status: landed (2026-09-26),** tested in `packages/engine/src/set-aside-villains.test.ts` (6 tests: the Setup puts
> players + 1 random villains into play and the lowest activation order takes the counter, seeded; a defeated villain
> is set aside as a new copy and the counter moves to the next in order, the game not won, replay deep-equal; with none
> left the counter is set aside and "the villain" is nobody; `moveActiveCounter` goes to the next ascending value, wraps
> to the lowest, and a lone villain keeps it; Ambush! brings one back with full hit points and the counter; the p. 62 FAQ
> at the villain's activation). DSL: `packages/cards/src/dsl/wave5-primitives.test.ts`.
>
> **What landed.** A set-aside villain is a `VillainState` marked `defeated` (out of play) whose instance is in
> `encounterSetAside`, so an active counter left on it keeps `activeVillainId` valid and makes "the villain" nobody (the
> Kang precedent). **`GameSetupConfig.villainsStartSetAside`** (with `villains`; the builder maps `MultipleVillains.atSetup:
"setAside"`): every villain starts so, and setup skips their toughness, Setup and When Revealed.
> **`GameSetupConfig.activeCounter: "nextInActivationOrder"`** → `ScenarioRules.activeCounter`: a defeated or set-aside
> active villain passes the counter to the next in activation order, or to nobody (`passActiveCounter`, used by the
> defeat, `removeVillain` and `setVillainAside` paths), and at step 2 a villain in play takes it by the p. 62 FAQ
> (`activeVillainChanged { reason: "noActiveVillain" }`). **`addVillain`** now re-admits a set-aside villain as a new
> copy (its `villains` entry replaced in place) and takes **`bind`** ("If no villain was put into play this way").
> **`EffectSpec setVillainAside { villain }`** (log `villainSetAside`), **`EffectSpec moveActiveCounter { to:
"nextInActivationOrder" }`** (reason `activationOrder`), **`ValueSpec activationOrder { of }`**. Win by card ability
> is the existing `victory: "cardAbility"` (the builder maps `MultipleVillains.winCondition: "cardAbility"` to it). Step
> 2 with no villain in play already skips the villain's activation (§4 Q2). **DSL:** `setVillainAside`,
> `moveActiveCounterToNextVillain`, `activationOrderOf`, `addVillain(…, { bind })`. **Not here:** the "When a villain
> would activate, if no villain is in play, resolve Ambush!" window (§3.2). **Client:** log lines for `villainSetAside`
> and the new `activeVillainChanged` reasons; set-aside villains shown out of play.

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

> **Status: landed (2026-09-26),** tested in `packages/engine/src/enemy-activating.test.ts` (4 tests: nothing listening,
> the villain schemes as before; cancelled, it does not, replay deep-equal; a cancelled minion activation and 4 damage
> to "that minion"; a status card replaces the activation first, so the interrupt never sees it; with no villain in
> play the activation is announced with no enemy, the interrupt puts one in and its activation continues, replay
> deep-equal). DSL: `wave5-primitives.test.ts`. **What landed:** **`TriggerEvent enemyActivating { enemyInstanceId |
null, activation, playerId }`**, interrupt window, pushed by `activateEnemy` after the status check and only when an
> ability listens; its apply step (`continueActivation`) initiates the attack or scheme, and a `cancelTriggeringEvent`
> means it never happens (§4 Q3: "after it activates" does not follow). At step 2 with no villain in play the villain's
> activation is announced with `enemyInstanceId: null` and, after the interrupt, activates whoever is "the villain" now.
> The `enemyActivated` log line is unchanged. **DSL:** `on.enemyActivating(who?)`, with `cancelIt()`.

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

> **Status: landed (2026-09-26),** tested in `packages/engine/src/glider-main-schemes.test.ts` (6 tests: the setup puts
> stages B–D into play, the glider on Midtown, and stage A set aside as its environment face; an encounter card's "the
> main scheme" is the glider's, and crisis/patrol protect only it; a player's acceleration token goes on the glider
> scheme; in the villain phase each main scheme gains its own acceleration and the villain schemes on the glider's;
> moving the counter moves "the main scheme"; a completed stage flips to its environment, revealed, no loss, replay
> deep-equal). DSL: `wave5-primitives.test.ts`. **What landed:** **`RuleSpec focusedMainScheme.encounterCards:
"focused"`** (`gliderMainSchemeId`): encounter cards' "the main scheme", a villain's scheme threat when it has no main
> scheme of its own, every acceleration token placed "on the main scheme" (`addAccelerationToken` with no target,
> including the empty-deck reset) and the crisis/patrol checks (`isProtectedMainScheme`, in `threatRemovalBlocked` and
> the basic thwart) name the focused scheme alone. A player card's "the main scheme" is unchanged (the wave 4 choice).
> **`TargetQuery.hasCounter`** (exclusion `missingCounter`). **`EffectSpec moveCounters { from, to, counterType? }`**
> (log `countersMoved`). **Stage flips:** `flipCard` on a main scheme whose stage has `otherFaceId`, and completion of a
> stage with `onCompletion: "flipToOtherFace"`, turn it into that face in the villain's area (`flipMainSchemeStage`,
> log `mainSchemeFlippedToOtherFace`); completion also reveals it (When Revealed, "enters play"). A central scheme
> passes the central slot to the next. Threat and attachments go; counters and acceleration tokens stay on the card
> (§4 Q15). **DSL:** `mainSchemeMarkedBy(counterType)` (a scenario rule spec), `moveCounters`,
> `query(…, { hasCounter })`. **Known limits:** the only main scheme in play never flips (refused); acceleration tokens
> kept on a flipped card count toward step one only from §3.4. **Client:** three main schemes with the glider marker;
> log lines for `countersMoved` and `mainSchemeFlippedToOtherFace`.

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

> **Status: landed (2026-09-26),** tested in `packages/engine/src/acceleration-tokens-anywhere.test.ts` (3 tests: a token
> placed on a side scheme sits there as its `acceleration` counter and adds to the main scheme's step one, and is gone
> with the scheme, replay deep-equal; `moveCounters` moves it onto the main scheme's tokens; "After an acceleration token
> is placed on this scheme" hears a token on the main scheme and not one elsewhere). DSL: `wave5-primitives.test.ts`.
> **What landed:** `addAccelerationToken` on a card that is not a main scheme gives it an `acceleration` counter
> (`ACCELERATION_COUNTER`); step one adds every such token in play to "the main scheme" (the glider's, else the central
> one; `offSchemeAccelerationTokens`), and the villain-phase audit expects it. **`TriggerEvent accelerationTokenPlaced {
instanceId }`** (response only, pushed only when an ability listens). `moveCounters` with `counterType` absent or
> `"acceleration"` moves tokens between a main scheme's `accelerationTokens` and any card's counter. The audit's token
> shadow now ignores tokens added to a non-central stage (it read them as the central count). **DSL:**
> `on.accelerationTokenPlaced(who)`; `addAccelerationToken(target)` unchanged.

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

> **Status: landed (2026-09-26),** tested in `packages/engine/src/encounter-cards-in-player-decks.test.ts` (6 tests: an
> encounter card shuffled into a deck is unowned and facedown, one put in a discard pile is unowned and faceup; drawn
> with nothing listening it stays in the hand (§4 Q4); with the interrupt, both cards of a two-card draw are drawn
> before either is dealt, and each "draw 1 card" replacement is drawn, replay deep-equal; a card milled from the deck is
> heard too, and so is the one its replacement draw finds; a response moves a resolved boost card onto the player's deck
> before the activation discards it, replay deep-equal). DSL: `wave5-primitives.test.ts`. **What landed:**
> **`EffectSpec moveCards.into: PlayerRef`**: `hand` / `deck…` / `discard` mean that player's zones whoever owns the
> card; an encounter card stays unowned there, and any card moved to a discard pile by `moveCards` is now turned faceup.
> **`TriggerEvent encounterCardFromPlayerDeck { playerId, instanceId, how: "draw" | "discard" }`**, an interrupt window
> with an empty apply step: `settlePlayerDecks` records every unowned card leaving a player's deck for a hand or a
> discard pile (`GameState.pendingEncounterFromDeck`), and the flow announces them between frames, after the whole draw,
> oldest first, only when an ability listens. The interrupt sees the card already in the hand or discard pile, and its
> own `dealAsEncounterCard` moves it on. **`TriggerEvent boostCardResolved { enemyInstanceId, boostInstanceId,
playerId }`** (response only): after a boost card's ability and icon count and before the discard, only when an
> ability listens; a card a response moved is not discarded. **DSL:** `moveCardsInto(from, to, player)`,
> `on.encounterCardFromPlayerDeck(how?)`, `on.boostCardResolved(during)`. Also fixed: §3.4's
> `accelerationTokenPlaced` had been classed as an interrupt event; it is response only. **Not here:** the game-end
> count of Illusion cards (§3.27). **Client:** unowned cards in a player's deck, hand and discard pile (visible backs).

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

> **Status: landed (2026-09-26),** tested in `packages/engine/src/boost-cards-on-identity.test.ts` (2 tests: two boost
> cards on the identity stay facedown through a villain phase whose scheme resolves only the villain's own; moved to the
> villain by a forced interrupt on its activation, they resolve in it, are discarded to the encounter discard pile, and
> the identity holds none, replay deep-equal). DSL: `wave5-primitives.test.ts`. **What landed:** `giveBoostCard.enemy`
> may name any card in play (the field keeps its name); a card that never activates only holds them, and `leavePlay`
> already discards them with it. Wave 1's rule that a non-enemy is never given one is gone (its test in
> `primitives-wave1c.test.ts` now expects the identity to hold one; no script relied on it: every existing
> `giveBoostCard` names the villain). **`EffectSpec moveBoostCards { from, to }`**: each facedown boost card on the `from`
> cards, in the order dealt, onto the first `to` card in play; log **`boostCardMoved`** (the villain-phase audit follows
> the card to its new holder). **DSL:** `moveBoostCards(from, to)`; `giveBoostCard(yourIdentity)` as is. **Not here:**
> Biting Retort's "+1 boost icon" for each card of that activation (scripting: `eachTimeUntil` on `boostIconsCounting`,
> unverified). **Client:** facedown boost cards on an identity; a `boostCardMoved` log line.

"place 1 facedown boost card on your identity"; "Leave Us Alone!" 1B: "Forced Interrupt: When Venom activates against
you, move each facedown boost card from your identity to Venom." `CardInstance.boostCards` is already a per-instance
list, and `giveBoostCard` (wave 2) gives waiting boost cards to an enemy. **Plan:** `giveBoostCard.enemy` widens to any
card (an identity holds them, never resolves them; RRG "Leaves Play" discards them with the card), and
`EffectSpec moveBoostCards { from, to }`: moved cards wait on the enemy as boost cards dealt outside its activation
(RRG 1.8 "Boost", p. 11). Biting Retort's "Each boost card turned faceup during that activation gets +1 boost icon" is
`eachTimeUntil` on `boostIconsCounting` (verify when scripting).

### 3.7 A resolved Special reports the cards it discarded

> **Status: landed (2026-09-26),** tested in `packages/engine/src/special-reports-discards.test.ts` (2 tests: a Special
> that discards one card with no Sandman card leaves the caller unstunned; one that discards two, the second a Sandman
> card, stuns, replay deep-equal). DSL: `wave5-primitives.test.ts`. **What landed:** the nested ability's bindings were
> not exposed (wave 4 §3.43 covers branches only). Now **`resolveSpecials.bind`** also collects, when each resolved
> ability's effects finish, what they bound, as `<bind>.<slot>` and `<bind>.<var>` (slots joined and vars summed over
> the sequence): an ability frame carries `returnBindingsTo { frameId, prefix }` into its effects frame
> (`returnBindingsPrefix`). The convention for scripters: the Special binds its discard (Surging Sands:
> `discardEncounterCards(…, { bind: "discarded" })`) and the caller reads `countAmong(chosen("<bind>.discarded"), …)`.
> **DSL:** `resolveSpecialsOf(ref, player?, { bind })`; the validator knows `<bind>.` after a `resolveSpecials`.

Sandslide: "Place 2 sand counters on City Streets, then resolve its 'Surging Sands' ability. If at least 1 Sandman card
was discarded this way, you are stunned." **Plan:** `resolveSpecials` binds (`bind`) the cards its resolved abilities
discarded from the encounter deck, readable by `countAmong`. Verify first whether the effects frame already exposes a
nested ability's bindings (wave 4 §3.43); if so this is a DSL helper only.

### 3.8 Increasing the damage a character takes

> **Status: landed (2026-09-26),** tested in `packages/engine/src/increase-damage-taken.test.ts` (5 tests: an attack of 3
> deals 4, replay deep-equal; two damage effects of 2 deal 6, once per event (§4 Q7); an effect of 0 stays 0; with
> "reduce … from each attack by 1" an attack of 3 deals 3; a tough status prevents the whole increased damage). DSL:
> `wave5-primitives.test.ts`. **What landed:** **`RuleSpec increaseDamageTaken { target, amount, fromAttack?, while? }`**
> in `damageTakenAfterConstants`, summed with the reductions before the floor at zero and before any cap. The plan's
> "increases, then decreases" is not what RRG 1.8 "Modifiers" (p. 29) says (additive and subtractive modifiers apply
> together); with the floor applied last the two readings agree. A damage event of 0 is not increased (nothing is
> taken). **DSL:** `increaseDamageTaken(target, amount, { fromAttack?, while? })`, a `constant` part.

Bell Tower (Ringing): "Increase all damage Venom takes by 1." **Plan:** `RuleSpec increaseDamageTaken { target, amount,
fromAttack? }`, the mirror of `reduceDamageTaken`, applied before reductions (RRG 1.8 "Modifiers" order: increases,
then decreases). Applies per damage event, as "reduce … from each attack" does per attack (§4 Q7).

### 3.9 A card that counts as another card type with a trait

> **Status: landed (2026-09-26),** tested in `packages/engine/src/counts-as.test.ts` (3 tests: alone, the side scheme
> matches a "[Symbiote] environment" query, has the trait, and still matches "side scheme"; with a printed Symbiote
> environment in play it does not count, so there is one Symbiote environment, not two; a query read with printed
> characteristics only never sees it). DSL: `wave5-primitives.test.ts`. **What landed:** **`RuleSpec countsAs { target,
categories, traits?, while? }`**, collected by `countsAsExtras` (cached per state, like the constant blanks) and read
> by `explainQuery`'s category clause and `traitsOf`; nothing else (`categoriesOf` and where the card lives are
> unchanged). The rule's `while` and `target` are read with printed characteristics only, so "no other [Symbiote]
> environments" never asks itself. **DSL:** `countsAs(target, categories, { traits?, while? })`, a `constant` part.
> **Known limit:** two copies of such a card would each count (each reads the other's printed type); Festering Mass is
> one copy per set.

Festering Mass: "While there are no other [Symbiote] environments in play, this card is considered a [Symbiote]
environment." Read by "If a [symbiote] environment is in play" (Lower/Midtown/Upper Manhattan, Symbiotic Berserker,
Monstrosity, Thrall) and "at least 2 [symbiote] environments" (the loss). **Plan:** `RuleSpec countsAs { target,
cardType, traits, while? }` read by `TargetQuery` category and trait matching only (not by where the card lives). The
"no other" condition is `while: not(exists(environment with trait, excluding self))`, evaluated without the rule
itself (no recursion).

### 3.10 Scheme icons printed on any card

> **Status: landed (2026-09-26),** tested in `packages/engine/src/scheme-icons-anywhere.test.ts` (3 tests: a player
> support with a hazard icon deals one more encounter card, replay deep-equal; an environment's acceleration icon adds 1
> threat at step one; a flipped card shows its other face's icons and a facedown card none). **What landed:**
> `nonSchemeIcons` (`rules.ts`) counts `schemeIcons` on every card in play that is not a scheme, in the card's game area
> when the players are split, and `iconsInPlay` (hazard at the deal step, crisis for threat removal and the basic
> thwart, acceleration at step one) adds it; the villain-phase audit expects it. A card that swaps to a separate face
> record (`otherFaceId`) reads that record's `schemeIcons`. **DSL:** none; the icons are card data (§1.3). The 30
> back-fill records in §5 count as soon as the pipeline emits them.

Schema §1.3. **Plan:** the icon counters (hazard at the deal step, crisis for threat removal, acceleration at step one)
add `schemeIcons` of every card in play to what they count today (scheme icons and `gainsIcon`). A flipped card uses
its showing face's icons.

### 3.11 Text that depends on the mode of play

> **Status: landed (2026-09-26),** tested in `packages/engine/src/mode-of-play.test.ts` (3 tests: in standard a
> treachery with "In expert mode, this card gains surge [and incite 1] and cannot be canceled" reveals alone, places no
> incite threat and can be canceled; in expert it surges, places 1 incite threat and cannot be canceled, replay
> deep-equal; an `ifThen` on the mode places 2 threat in expert only). DSL: `wave5-primitives.test.ts`. **What
> landed:** **`Predicate inMode { mode: "standard" | "expert" }`**, read from `ScenarioRules.difficulty`. And, found
> while testing: keyword grants were read only from cards in play, so a revealed treachery's "this card gains surge"
> did nothing. An encounter card's own `keywordGrants` are now read wherever it is (as its own `cannotBeCanceled`
> already was, wave 4 §3.14). **DSL:** `inMode(mode)`, with `gainsKeyword(…, { while })`, `cannotBeCanceled(…, when)`
> and `ifThen`. **Not here:** a heroic mode: the engine has no heroic setting to read, and no wave 5 card names one.

"In expert mode, this card gains incite 1 and cannot be canceled" (Frequent Flyers, High Fashion, Robotic
Enhancements), "gains surge" (Surprise!, From Every Direction), "gains toughness" (Life-Size Decoy), "(In expert mode,
place 2 threat on Light at the End)" (Ambush!), Teamwork Makes the Dream Work's boost, Coordinated Effort/Hidden in
Shadow boosts, Sinister Beatdown 2A, Smear Campaign. **Plan:** `Predicate inMode { expert?: true, heroic?: true }`,
usable in `while` of keyword grants and `cannotBeCanceled`, and in `ifThen`. The modes are in the setup config already
(`query.ts` reads `"expert"`).

### 3.12 "The first attack this turn"

> **Status: landed (2026-09-26),** tested in `packages/engine/src/first-attack-this-turn.test.ts` (3 tests: the first
> attack on the villain reads true and the second false, replay deep-equal; a new turn starts the count again; after an
> attack on a minion the villain attack is not the first attack, but is the first against the villain). DSL:
> `wave5-primitives.test.ts`. **What landed:** the existing `attackedThisTurn` keeps each attacker/target pair once,
> so it cannot count. New **`GameState.attacksThisTurn`** (every attack in a player's turn, in order, written and emptied
> with `attackedThisTurn`) and **`Predicate firstAttackThisTurn { against?, by? }`**: exactly one matching attack this
> turn, read in the response to it. Which attacks Venom III counts is new §4 Q16 (default: all of them). **DSL:**
> `firstAttackThisTurn({ against?, by? })`.

Venom III: "place 1 facedown boost card on your identity (2 facedown boost cards instead if this is the first attack
this turn)". **Plan:** a per-turn count of attacks made against the villain, or `attackedThisTurn` if it already
records it (wave 2 §11.3); `Predicate firstAttackThisTurn { target }`. Verify the existing field's meaning first.

### 3.13 "When/After X leaves play"

> **Status: landed (2026-09-26),** tested in `packages/engine/src/leaves-play.test.ts` (3 tests: a discarded ally's own
> interrupt resolves, then a response to "a [Web-Warrior] ally" reads the trait a support granted it, replay
> deep-equal; returning to hand counts; an ally without the trait triggers neither). DSL: `wave5-primitives.test.ts`.
> **What landed:** one **`TriggerEvent cardLeavesPlay { instanceId, cardId, controllerId, to, traits }`** with both
> windows (the ability's own trigger kind picks one) instead of the plan's two events. `leavePlay` records what the
> card was while still in play (`GameState.pendingLeftPlay`), only when some ability in the registry triggers on it, and
> the flow announces it between frames when one listens. The card that left answers its own event from wherever it went
> (`leftCardCandidates`, the spent-card precedent; an ability with a cost is not offered), and a `targetIs` trait clause
> reads the event's `traits`. The interrupt opens after the move: new §4 Q17. **DSL:** `on.leavesPlay(who)` for both
> "When" (`interrupt`) and "After" (`response`).

Spider-Man (Hobie Brown) and Ghost-Spider ally: "Interrupt: When [this ally] leaves play, …"; Web of Life and
Destiny, Warrior of the Great Web: "Response: After a [Web-Warrior] ally leaves play". Wave 4 §3.8 listed this as not
built. RRG 1.8 "Leaves Play" (p. 27) covers defeat, discard, victory display and removal from the game; ruling Jan 17,
2026 (1) #2: the "Leaves Play" bullets happen simultaneously with leaving, so an interrupt sees the card still in play
with its attachments, and a response sees it gone. **Plan:** `TriggerEvent cardLeavingPlay { instanceId, to }`
(interrupt) and `cardLeftPlay` (response), pushed by `leavePlay` only when an ability listens, carrying the printed
card so a response can read what left. **DSL:** `on.leavesPlay(who)`, `on.leftPlay(query)`. **Composes with:** Abduct
Superhumans (`aos` 50081), Bishop's and later "leaves play" cards.

### 3.14 "(Max 1 per [instance])"

> **Status: landed (2026-09-26),** tested in `packages/engine/src/max-per-instance.test.ts` (2 tests: two forced copies
> of a "(Max 1 per event.)" response resolve once per event played and again for the next event, replay deep-equal; two
> optional copies chosen together in one window resolve once). DSL: `wave5-primitives.test.ts`. **What landed:**
> **`AbilityLimit.per: "triggeringEvent"`** (the plan's `perTriggeringInstance`, as a `per` value): the use key is the
> card's title plus the triggering event instance, found as the event frame on the stack carrying that event
> (`triggeringEventKey`), so every copy shares one count per event; `period` is not read, and the counts go at every
> turn, phase and round boundary. **DSL:** `maxOnePerTriggeringInstance`, used as `{ limit: … }`. **Known limit:** the
> instance is the event the ability triggers on; a "(Max 1 per attack.)" on a damage trigger (Temporal Shield) counts
> per damage event, which is the same while an attack deals one damage event to that character.

RRG 1.8 "Max 1 per [instance]" (p. 28): "restricts the number of times an ability can be triggered by a single instance
of a triggering effect across all copies of the card with the maximum. (For example, if an ability has the text '(Max 1
per event.),' only one card with that ability can be triggered per event played.)" Ghost Kick, Phantom Flip ("Max 1
per basic power use"), Web-Bracelet ("per event"), Fluid Motion ("per [Attack] event"); also Temporal Shield and the
Psylocke card ("per attack"), which wave 2 left unmodeled. **Plan:** `AbilityLimit.perTriggeringInstance: true`: the
limit is kept per triggering event instance and shared by every copy of the card's title.

### 3.15 Facedown attached cards: playable events, a count, a maximum

> **Status: landed (2026-09-26),** tested in `packages/engine/src/facedown-attached-events.test.ts` (2 tests: an event
> attached facedown is counted by `count { host: self, facedown: true }`, visible to its owner, then played from there
> as if from hand, resolves and lands faceup in the discard pile, replay deep-equal; "to a maximum of 3" as an `if` on
> that count stops a fourth attach). DSL: `wave5-primitives.test.ts`. **Verified:** `playableAttachments` already
> offers a facedown attached event (a blank facedown card keeps its card type) and the play resolves its printed
> ability. **Fixed:** the played card kept `facedownAs` in the discard pile; a card played from facedown is now turned
> faceup and is itself again as it is played (`actions.ts`). **Visibility:** a player's own card attached facedown is
> face-visible (table-wide, as hands are; `visibility.ts`). **DSL:** nothing new — `playableAttachments`,
> `attachCard(…, { facedown: true })`, `countOf({ host: self, facedown: true })`, `ifThen(valueAtMost(…))`. **Not
> here:** RRG 1.8 "In Play and Out of Play" (p. 23) says "Facedown cards attached to in-play cards are out of play";
> the engine still lists them among cards in play (no wave 5 card reads the difference).

George Stacy: "Events attached to George Stacy may be played as if they were in your hand. Action: Exhaust George
Stacy → attach 1 event from your hand facedown here (to a maximum of 3)"; Parental Guidance attaches one from hand or
discard; Worried Father attaches George Stacy facedown to itself; Spider-Man Noir: "X is equal to the number of
facedown cards attached", "attach that treachery facedown here (to a maximum of 3)". `attach { facedown }` and
`playableAttachments` exist. **Plan:** verify `playableAttachments` offers a facedown attached event (its owner may
look at it) and plays it faceup; `TargetQuery.facedown` on attachments for the count; the "to a maximum of 3" is local
(ruling Mar 30, 2026 (1)), an `ifThen` on the count, not a rule.

### 3.16 How a card was paid for: resources by type and by source

> **Status: landed (2026-09-26),** tested in `packages/engine/src/payment-sources.test.ts` (2 tests: a card paid with a
> resource ability generating 2 and a resource card reads 2 for that ability, replay deep-equal; paid with resource
> cards only it reads 0). DSL: `wave5-primitives.test.ts`. **What landed:** by type was already there (`paid.mental`
> etc., Moon Girl). By source: pricing a play or an ability now adds **`paid.ability.<abilityId>`** vars, the resources
> each resource ability in the payment generated (read before any doubling of the whole payment), and they travel with
> the other `paid.*` vars to the played card's own abilities. No new `ValueSpec`: the plan's `resourcesPaid` is the
> existing `var`. **DSL:** `resourcesPaidBy(abilityId)`, `paidUsingResourceFrom(abilityId)`. **Known limit:** a
> resource _card_ spent in the payment is not a source; no wave 5 card asks.

Moon Girl: "draw 1 card for each [mental] resource used to pay for her"; VEN#m: "for each resource generated by SP//dr
Suit's 'Sync Ratio' ability to pay for her"; Rapid Deployment, Web-Trap: "If you paid for this card using a resource
generated by SP//dr Suit's 'Sync Ratio' ability". `cardPlayed.paid` holds the typed pool; the source is not kept.
**Plan:** each generated resource carries its source (card instance and ability id) through the payment;
`ValueSpec resourcesPaid { card, type?, sourceAbility? }` and `paidWith.sourceAbility`.

### 3.17 A resource card spent for another player

> **Status: landed (2026-09-26),** tested in `packages/engine/src/spend-for-any-player.test.ts` (2 tests: player 2's
> card pays player 1's event, lands in player 2's discard pile, and its "after you spend this card for a player"
> response acts on player 1, replay deep-equal; with the condition false the payment is refused). DSL:
> `wave5-primitives.test.ts`. **What landed:** a constant field **`spendableForAnyPlayer { while? }`** on the hand card
> (the `spendableIn` precedent, since a card in hand has no active rules; the plan's `RuleSpec` would not be read
> there), checked by the payment where another player's hand card is otherwise refused outside an alliance payment.
> Everything else was built for alliance (wave 4 §3.17): the owner spends it, and `resourcesSpent` names the owner as
> "you" and the payer as `forPlayerId` / `eventPlayer`. §4 Q10's default holds: any player's payment. **DSL:**
> `spendableForAnyPlayer(when?)`, a `constant` part. **Client:** the payment picker should offer another player's
> spendable hand cards.

Everyday Hero: "While your identity has the [Civilian] trait, this card can be spent for any player and gains the
text: 'Response: After you spend this card for a player, heal 1 damage from that player's identity.'" Resource
_abilities_ have `forAnyPlayer` (Piloting); a resource _card_ from hand does not. **Plan:** `RuleSpec
spendableForAnyPlayer { while }` on the card, read by the payment's hand-card contributors (the Alliance group-payment
path, wave 4 §3.17), and `youSpendThis` reporting the paying player.

### 3.18 A card that does not count toward hand size

> **Status: landed (2026-09-26),** tested in `packages/engine/src/not-counted-toward-hand-size.test.ts` (2 tests: the
> end-of-phase draw fills the hand size beside it, replay deep-equal; a full hand plus it has no mandatory discard, and
> one over must discard a counted card — discarding it alone is refused). DSL: `wave5-primitives.test.ts`. **What
> landed:** a constant field **`notCountedTowardHandSize`** read from the card in hand (the plan's `RuleSpec` would not be
> read from a hand) through `handCountTowardHandSize`, used by the end-of-phase discard's minimum and its check, the
> end-of-phase and "draw up to" draws (`drawUpTo`), and the mulligan's draw back up. `handCountOf` still counts it. The
> discard check's invariant error became an `invalid_choice`, since the choice may include it. **DSL:**
> `notCountedTowardHandSize`, a `constant` part.

Connection to the Worldmind. RRG 1.8 "Hand Size" (p. 21). **Plan:** `RuleSpec notCountedTowardHandSize` on the card,
read by the end-of-phase discard/draw and every "cards in hand compared to hand size" reader; `handCountOf` keeps
counting it (it is in hand).

### 3.19 Any number of tough status cards

> **Status: landed (2026-09-26),** tested in `packages/engine/src/unlimited-tough.test.ts` (3 tests: the villain holds
> three tough cards, and three damage events each spend one, replay deep-equal; piercing discards all three; a villain
> without the rule holds one). DSL: `wave5-primitives.test.ts`. **What landed:** **`RuleSpec statusLimit { target,
status: "tough", max: "unlimited" }`**, read by `statusCapacity` (so `giveStatus` and the status clean-up allow any
> number). The damage path already spent one tough card per event and piercing already cleared them all. **DSL:**
> `anyNumberOfToughStatusCards(target)`, a `constant` part. **Not changed:** `removeStatus` ("remove a tough status
> card") still removes every card of that status, as it did for a steady character's two.

Armadillo: "Armadillo can have any number of tough status cards." RRG 1.8 "Status Cards" (p. 41) limits one of each
(steady adds one of stunned/confused). **Plan:** `RuleSpec statusLimit { target, status: "tough", max: "unlimited" }`;
a tough status card then prevents one damage event and is discarded one at a time; piercing discards them all.

### 3.20 Treating printed resources as another type

> **Status: landed (2026-09-26),** tested in `packages/engine/src/printed-resource-as.test.ts` (2 tests: a [physical]
> card in hand counts as one [energy] for "the total number of [energy] resources in your hand", replay deep-equal, and
> not without the rule; it pays for a card payable only with [energy], refused without the rule). DSL:
> `wave5-primitives.test.ts`. **What landed:** **`RuleSpec printedResourceAs { player, as }`**: each printed icon of a
> card in a named player's hand counts as one `as` resource, wild included (the plan's `cards` query became `player`:
> the card is in a hand, where rules and queries do not otherwise reach). Read through **`printedResourcesOf`** by the
> hand payment, the `printedResource` / `anyPrintedResource` query clauses, and the `resourceTypes` and
> `totalPrintedResources` counts. **DSL:** `printedResourcesInHandAs(player, as)`, a `constant` part.

Haywire: "Treat the printed resource of each card in your hand as if it were [energy]." Read by Zzzax, Feedback Loop,
Zzzap! and by payment. **Plan:** `RuleSpec printedResourceAs { cards, as }`, read by the printed-resource readers and
generation (one icon of the given type per printed icon).

### 3.21 An additional cost to thwart a scheme

> **Status: landed (2026-09-26),** tested in `packages/engine/src/additional-thwart-cost.test.ts` (3 tests: an [energy]
> cost paid, the basic thwart removes threat, replay deep-equal; declined, the thwart is cancelled and removes nothing;
> a 2 indirect damage cost is taken by the thwarting player before the threat comes off). DSL:
> `wave5-primitives.test.ts`. **What landed:** **`RuleSpec additionalThwartCost { scheme, resources?, indirectDamage? }`**
> (the plan's general `AbilityCost` narrowed to the two printed shapes). Every `thwart` event against a matching scheme
> — basic, ability or event — first asks the thwarting player (`askThwartCost` in the event's interrupt stage, log
> `thwartCostAsked`): spend the resources (a declined payment cancels the thwart, which is then never initiated), then
> take the indirect damage. **DSL:** `additionalThwartCost(scheme, { resources?, indirectDamage? })`, a `constant`
> part. **Not here:** removing such a scheme from the legal targets of a player who cannot pay (§4 Q18).

Cat in a Tree: "As an additional cost to thwart this scheme, take 2 indirect damage"; Giant Monster Attack: "As an
additional cost to thwart this scheme, you must spend a [energy] resource." **Plan:** `RuleSpec additionalThwartCost {
scheme, cost: AbilityCost }`; a thwart that cannot pay it cannot target the scheme (legal targets exclude it).

### 3.22 A basic thwart that may remove threat only from one scheme

> **Status: landed (2026-09-26),** tested in `packages/engine/src/basic-thwart-targets.test.ts` (2 tests: a basic thwart
> at a scheme without the most threat is refused and one at the scheme with the most goes through, replay deep-equal;
> a basic thwart of the main scheme ignores a crisis icon while a thwart event still has no valid target). DSL:
> `wave5-primitives.test.ts`. **What landed:** **`RuleSpec basicThwartTargets { character, among: TargetRef }`**, checked
> by the basic thwart command for each share (ties leave every tied scheme), and **`characterIgnores.basicOnly`**:
> `characterIgnores` and `threatRemovalBlocked` now know whether the thwart is basic (a removal reads its parent thwart
> event). **DSL:** `basicThwartOnlyAgainst(character, among)`, `basicThwartsIgnore(character, ["crisis", "patrol"])`.

Retinal Display: "Your hero's basic thwart power (THW) can only remove threat from the scheme with the most threat."
**Plan:** `RuleSpec basicThwartTargets { character, among: query }` restricting legal thwart targets; the Enhanced side's
"ignore the crisis icon and the patrol keyword" for basic thwarts is `characterIgnores` with a `basicOnly` flag (verify).

### 3.23 Progressing identities: swapping one identity card for the next

> **Status: landed (2026-09-26),** tested in `packages/engine/src/progressing-identity.test.ts` (5 tests, replacing the
> §1.4 gate test: setup seats the first version with the others set aside and refuses a later version; `validateDeck`
> accepts the first and names it for a later one; the swap keeps the instance, damage, counters, statuses and form and
> takes the new card's hit points and hand size, the old version set aside in its place, replay deep-equal; the last
> version has nothing to swap to; the [Version] number read from the alter-ego's printed hero face). DSL:
> `wave5-primitives.test.ts`. **What landed:** `createGame` seats `progressingIdentity.versions[0]` and puts the later
> versions in the player's set-aside area; the `createGame` and `validateDeck` refusals now cover only a later version.
> **`EffectSpec swapIdentity { player }`**: the identity instance and the next version's set-aside instance trade card
> ids (and `PlayerState.identity.cardId` follows), so nothing enters or leaves play; log **`identitySwapped`**.
> **`ValueSpec traitNumber { of, prefix }`**. §4 Q9's default holds (the form is kept; not a form change). **DSL:**
> `swapIdentity(player?)`, `traitNumber(of, prefix)`. The Ironheart precon is now checked in full by
> `packages/cards/src/wave5-precon-legality.test.ts` (its gate flag removed). **Client:** the identity's version; a
> `identitySwapped` log line.

Ironheart insert (§1.4 quote). Level Up!: "Remove 6 progress counters from Ironheart → ready her and swap her with
[Version 2] Ironheart." RRG 1.8 "Swap" (p. 42): neither card enters or leaves play; tokens, attachments and status
cards transfer; the dial stays. **Plan:** setup puts `progressingIdentity.versions[0]` in the identity slot and sets
the rest aside in the player's set-aside area; `EffectSpec swapIdentity { toVersion: next }` replaces the identity
instance's card (same instance, like `swapVillain`), keeping form (hero), damage, counters, statuses and attachments;
hand size, hit points and abilities are the new card's. `ValueSpec traitNumber { of, prefix: "VERSION" }`. A defeat of
the identity eliminates the player as always (the set-aside versions need nothing). Log `identitySwapped`.

### 3.24 A separated identity (two cards, one dial)

> **Status: landed (2026-09-26, 928c7eb8),** tested in `packages/engine/src/separated-identity.test.ts` (9 tests: set
> aside at creation, then Peni + the INACTIVE support in play; `validateDeck` accepts it; to hero keeps dial, counters,
> statuses and attachments, attaches the upgrade, swaps ready states, replay deep-equal; the once-per-round change
> still refuses a second; back to alter-ego; defeat in each form eliminates the player and discards the other card;
> both sides unblankable in both forms). **What landed:** the identity instance (the dial) keeps 31001a's own faces
> (hero = SP//dr Suit, alter-ego = Peni); the other physical card is a second instance whose INACTIVE support and SP//dr
> upgrade sides are added to `GameState.cardPool` by `createGame` (`31001a:heroCardOtherSide`,
> `31001a:alterEgoCardOtherSide`, `separatedSideCard`), so type, name, traits, keywords, abilities and §3.31's
> protection read them like any card. Set aside at creation, put into play at setup step 16; `setForm` calls
> `flipSeparatedCard` (log `separatedCardFlipped`). The `createGame` and `validateDeck` refusals are gone;
> `wave5-precon-legality.test.ts` checks SP//dr in full. Schema: optional `SeparatedIdentitySide.resourceIcons`.
> Decisions: ready state follows the physical card (Q37), statuses stay on the identity (Q39); counters/attachments on
> the other card move to the identity (Q38, not built yet). **Data:** `curation/spdr.ts` needs `resourceIcons: { wild: 1
}` on `alterEgoCardOtherSide` (read from Hall of Heroes `s2.jpg`). **Scripting:** `31002.psychogenetic-compatibility`,
> `31001b.return-to-base`, `31002b.suit-up` are `coveredByEngineRule()`.

SP//dr insert, "New Rule: Separated Identity Card": "One card represents the human pilot, Peni Parker, while the other
represents the robotic SP//dr Suit. Start the game with the Peni Parker alter-ego in play and, following her 'Setup'
instructions, put the INACTIVE support side of the SP//dr Suit card into play. While in alter-ego form, to change to
hero form, flip Peni Parker from her alter-ego side to her SP//dr upgrade side and flip the SP//dr Suit card from its
INACTIVE support side to its ACTIVE hero side. While in hero form, to change to alter-ego form, flip the SP//dr Suit
card from its ACTIVE hero side to its INACTIVE support side and flip the SP//dr upgrade side to its Peni Parker
alter-ego side. Both identity cards share a single hit point dial, with damage persisting on the dial between forms.
Additionally, if one form is defeated, both forms are considered to be defeated simultaneously and the player is
eliminated from the game." The cards' own text (Suit Up!, Return to Base, errata p. 68) moves counters and attachments
toward the card that is the identity.

**Plan:** two instances: the identity instance is Peni Parker in alter-ego form and the Suit in hero form; the other
card is a permanent support (INACTIVE Suit) or an upgrade attached to the Suit (SP//dr). A form change flips both and
moves the identity slot, counters and attachments as the printed Suit Up! / Return to Base say (their forced
interrupts are the engine's own transition, scripted as the "when you flip to this side" abilities). The dial is the
player's, not the card's. Remove the `createGame` refusal and `validateDeck`'s `unsupported_identity` for it.

### 3.25 Resources generated: an event, and counters spent as resources

> **Status: landed (2026-09-26, 040cad4d),** tested in `packages/engine/src/resources-generated.test.ts` (7 tests) and
> `packages/cards/src/dsl/wave5-3-25.test.ts` (4). **What landed:** `TriggerEvent resourcesGenerated` (response-only,
> one per payment per player who generated ≥ 1, only when something listens; the amount counts hand cards as they
> counted for the paid-for card, resource-ability uses, and overpayment, RRG p. 13); `payPayment` takes an optional
> `payingFor`; `EventPattern.playerIn` ("the engaged player"); `repeatable` resource abilities (a fixed counter cost
> only; one payment option per use, `ability:<id>:<abilityId>:<n>`, capped at 20). **DSL:**
> `on.resourcesGenerated({ by?: "you" | "engaged" })`, `countersAsResource(counterType, generates = 1)`, `resource(...,
{ repeatable })`. **User decisions that change it (§4.1):** Q5 (toon counters are not "generated") and Q25 (one
> timing window with the spend responses) are not built yet.

M.O.R.B.I.U.S. (errata): "After the engaged player generates any number of resources, deal an equal amount of damage
to that player's hero." `resourcesGenerated` is logged, not announced. **Plan:** `TriggerEvent resourcesGenerated {
playerId, amount }` (response). Spider-Ham: "Each toon counter on Spider-Ham can be spent as if it were a [wild]
resource" composes as a resource ability (`spendCounters` 1 → generate [wild], no limit); §4 Q5 on whether that counts
as "generating".

### 3.26 An additional mulligan

> **Status: landed (2026-09-26, 4a896b66),** tested in `packages/engine/src/additional-mulligan.test.ts` (5 tests: a
> second full mulligan with both discards kept in the discard pile; keeping the hand ends that player's mulligans; two
> players decide p1, p1, p2 (superseded by Q19, a55532d9: passes p1, p2, then p1, p2); `extraMulligans: 0` changes nothing; bad input refused). No DSL builder (setup data, not a
> card ability). **What landed:** `PlayerSetup.extraMulligans?: number` (`createGame` refuses anything but a whole
> number ≥ 0), copied to `PlayerState.extraMulligans?` when positive; the mulligan step counts `mulligansTaken?` for
> the player at the front; the prompt is `{ kind: "mulligan", handSize, additional?: number }`. After drawing back up,
> extra mulligans come as later passes in player order (§4.1 Q19, a55532d9; the step carries `pass` and `nextPassPlayerIds`); a mulligan that discarded
> nothing ends that player's mulligans (§4 Q20). §3.27 sets the field from the reputation track. **Client:**
> `setup-deal.ts`'s mulligan note still says "One mulligan per player … shuffle the discards in" (both wrong now: RRG
> Appendix II step 15 does not shuffle them in) and doesn't label `additional` yet.

MC27 p. 22 node 5 with the p. 67 erratum: "During the Resolve Mulligans step of game setup, each player may take 1
additional mulligan." **Plan:** `GameSetupConfig.players[].extraMulligans?: number`, a second mulligan choice after the
first draw-up (Appendix II step 15 repeated), set by the campaign's setup.

### 3.27 Campaign queries for the reputation conditions and Waking Nightmare

> **Status: landed (2026-09-26, 3be41be1),** tested in `packages/engine/src/campaign/sm-queries.test.ts` (8 tests: each
> query; a win meeting every condition with −2 victory points marks 5 nodes, node 1's white box resolves and both setup
> ids are appended; the next scenario runs them and grants the extra mulligan; no condition marks nothing) and
> `packages/cards/src/dsl/wave5-3-27.test.ts`. **What landed:** `CampaignGameQuery` members `accelerationTokensInPlay`,
> `defeatedIdentities`, `cardsInPlayerDecks { query }` (deck zone only, Q21) and `playersInScenario` (players who
> started the scenario, for "fewer than 1[per_hero]"; RRG p. 32); `EffectSpec grantAdditionalMulligans { amount }`
> (log `additionalMulligansGranted`), the path from reputation node 5 to §3.26's field. Marking composes from existing
> ops: record the conditions, then `betweenGames` adds `clampAtZero(victory points)` + conditions (Q6) and resolves
> each newly crossed node's white box, appending its pink box (and node 5, Q22) as a conditional instruction. **DSL:**
> `grantAdditionalMulligans(amount = 1)`. The sm `CampaignDefinition` itself is step 6.

**New `CampaignGameQuery` members:** `accelerationTokensInPlay` (every token, main schemes and other cards),
`defeatedIdentities` (count), `cardsInPlayerDecks { query }` ("the total number of Illusion cards in all player
decks", read before the game's encounter cards are gone). "No threat on the main scheme" is `threatOn` of every main
scheme (Venom Goblin has several; scenario 5's reputation is optional). **Verify** that marking nodes (a numeric field,
threshold nodes 1, 5, …, 25 whose white boxes resolve at once and whose pink boxes append `conditionalInstructions`
ids, clamped at zero per marking per ruling Aug 3, 2026 (4) #2) composes from the existing ops; if it does not, the
missing op goes here.

### 3.28 Looking at the top card of the encounter deck at any time

> **Status: landed (2026-09-26, c04bc25a),** tested in `packages/engine/src/look-at-encounter-top.test.ts` (2 tests:
> only P1 sees the top card in a 2-player game, the second card stays hidden, replay deep-equal; it lasts through P2's
> turn and ends with the round), `packages/cards/src/dsl/wave5-3-28.test.ts` and
> `packages/client/src/view/inspect-encounter-top.test.ts` (2). **What landed:** `RuleSpec mayLookAtTopOfEncounterDeck
{ player, while? }`; `faceVisible` takes an optional `ViewerContext { viewer, deps }` (exported), and the active
> encounter deck's top card is face-visible only to a viewer the rule covers (RRG 1.8 "Look", p. 27). Callers with no
> viewer (log names, `preview()`) keep it hidden. **DSL:** `mayLookAtTopOfEncounterDeckUntil(until, player = you)`.
> **Client:** Inspect passes the seat's viewer; the board's pile image still shows the back.

Sector Scan: "Until the end of the round, you may look at the top card of the encounter deck at any time." **Plan:** a
lasting `RuleSpec mayLookAtTopOfEncounterDeck { player }` read by `visibility.ts` for that player's view; no game state
changes, logged as a lasting effect.

### 3.29 Replacing damage with counters on another card, with no excess damage

> **Status: landed (2026-09-26, 6326ac93),** tested in `packages/engine/src/damage-to-counters.test.ts` (5 tests: an
> accepted overkill attack of 5 on a 3-HP Venom places 5 chime counters, deals no damage, reports no excess, replay
> deep-equal; declined, the stage is defeated with 2 excess; non-attack damage not offered; tough resolves first; P2's
> attack asks P2) and `packages/cards/src/dsl/wave5-3-29.test.ts`. **What landed:** it composed already —
> `interrupt(when.damage(…, { fromAttack: true }), instead(addCounters("chime", eventAmount)))`; `instead` cancels the
> damage event, so nothing is recorded or spills (MC27 p. 21 FAQ). The one engine change: `offeredPlayerOf`
> (`resolve/triggers.ts`) offers an encounter card's optional ability to the controller of the damage source, else the
> first player (Q8; RRG p. 4 "Ability"). A minion's overkill spill onto the villain counts as attack damage (Q23).
> Bell Tower's constant and Ringing side are the pack scripter's.

Bell Tower (Quiet): "Interrupt: When any amount of damage would be dealt to Venom by an attack, (you may) place that
many chime counters here instead." MC27 p. 21: "no damage is actually dealt … excess damage effects do not apply."
**Plan:** `instead` of the damage event + `addCounters` of `eventAmount` composes; verify the attack reports zero
damage dealt and no excess (overkill, "defeated with excess damage").

### 3.30 A player card attached to an encounter card and returned when its host leaves

> **Status: landed (2026-09-26, 292e1072),** tested in `packages/engine/src/attached-player-card-returns.test.ts` (4
> tests: attached to a minion, P1 keeps control; the minion's defeat draws 1 while the card is still attached, then it
> returns to P1's play area with its counters and exhaustion, replay deep-equal; a defeated side scheme draws, a
> discarded one doesn't; a non-permanent upgrade is still discarded; Q26's fallback) and
> `packages/cards/src/dsl/wave5-3-30.test.ts`. **What landed:** before, a permanent attachment stayed stuck on a host
> already in the discard pile. Now an attachment that cannot leave play (permanent, RRG 1.8 p. 32, or `cannotLeavePlay`)
> is unattached into its controller's play area (owner's if none), keeping counters, exhaustion and controller; the
> host leaving is a game rule ("Attach To", p. 8), not an ability. **DSL:** `on.attachedCardDefeated()`. The
> "same set" permanent exception is still not checked (unchanged).

Wrist Navigator (campaign): "Forced Response: After a minion or side scheme enters play, attach Wrist Navigator to it.
Interrupt: When the attached card is defeated, draw 1 card. (Return this card to your play area.)" Permanent.
**Plan:** `attach` of an owned upgrade to an encounter card keeps its controller; when the host leaves play, a
permanent attachment is not discarded but returns to its controller's play area (RRG 1.8 "Permanent", p. 32: it
cannot leave play). Verify what `leavePlay` does today with a permanent attachment.

### 3.31 A printed text box that cannot be blanked

> **Status: landed (2026-09-26, 1d84412c),** tested in `packages/engine/src/unblankable-text-box.test.ts` (4 tests) and
> `packages/cards/src/dsl/wave5-3-31.test.ts`. **What landed:** an ability, not data (the ingested text already gives
> both faces a slot: `31001b.sp-dr-suit-constant`, `31002b.sp-dr-constant`): `RuleSpec { kind: "textBoxCannotBeBlanked"
}`, read from the current face before any blank applies, protecting only that face against lasting (Panic in the
> Streets, Vivian) and constant (Tech Theft) blanks. Facedown cards and cards treated as another type still have no
> abilities (not "treated as blank"). `activeAbilityRefs` now layers the blank check over a private
> `unblankedAbilityRefs(state, id)`; §3.24's face logic goes there. **DSL:** `constant(textBoxCannotBeBlanked())`. The
> Permanent keyword's own blank protection (RRG 1.8 p. 32) is not built: §4.2 Q31.

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

### 4.1 Decided by the user (2026-09-26)

Every question below was put to the user on 2026-09-26. **Bold = differs from the proposed default and needs engine
work** (status in the last column).

| Q   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Work                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Default: all six set aside; setup brings in players + 1 at random (seeded).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —                                                                                                  |
| 2   | Default: skip the activation, log it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                                                                                  |
| 3   | Default: a canceled activation did not happen; no "after it activates".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | —                                                                                                  |
| 4   | **An encounter card drawn from a player deck with nothing listening is dealt to that player facedown, and they draw 1 card** (the Mysterio main scheme's own handling, as the fallback).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | built 97ae93d3                                                                                     |
| 5   | **Spending a toon counter as a resource is not "generating" a resource; M.O.R.B.I.U.S. does not trigger on it.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | built f959030c                                                                                     |
| 6   | Default, per ruling Aug 3, 2026 (4) #2: victory points contribute `max(0, sum)`; negative VP mark nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | built §3.27                                                                                        |
| 7   | Default: +1 per damage event (an attack for 6 becomes 7).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | —                                                                                                  |
| 8   | Default: the controller of the attacking character; the first player if none.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | built §3.29                                                                                        |
| 9   | Default: Ironheart's swap keeps her form and is not a form change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | built §3.23                                                                                        |
| 10  | Default: Everyday Hero may join any player's payment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                                                                                  |
| 11  | Default: nodes resolve in node order; pink boxes from the next scenario.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                                                                  |
| 12  | Default: a full second mulligan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | built §3.26                                                                                        |
| 13  | Default: the revealing player picks the deck.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —                                                                                                  |
| 15  | Default: card text wins; counters and acceleration tokens stay for the When Revealed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | built §3.3                                                                                         |
| 16  | Default: any attack during this player's turn counts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | built §3.12                                                                                        |
| 17  | **"When X leaves play" interrupts resolve before the card moves, with the card still in play (RRG p. 25; ruling Jan 17, 2026 (1) #2).** Rework `leavePlay`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | built ae82c42f                                                                                     |
| 18  | **A player who cannot pay a scheme's additional thwart cost cannot choose it as the thwart's target** (a payability check over hand cards and resource abilities, as `legal.ts` does for play).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | built b4c8b1fd                                                                                     |
| 19  | **The extra mulligan is a second pass in player order after every player's normal mulligan: p1, p2, then p1, p2.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | built a55532d9                                                                                     |
| 20  | Default: keeping the hand ends that player's mulligans.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | built §3.26                                                                                        |
| 21  | Default: "all player decks" is each deck zone only; an eliminated player's deck counts nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | built §3.27                                                                                        |
| 22  | Default: node 5's extra mulligan applies at every remaining scenario's setup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | built §3.27                                                                                        |
| 23  | Default: a minion's overkill spill onto the villain is attack damage (Bell Tower (Quiet) may replace it).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | built                                                                                              |
| 24  | **M.O.R.B.I.U.S. deals no damage while the engaged player is in alter-ego form** ("that player's hero").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | scripter                                                                                           |
| 25  | **Within one payment, "after you spend" and "after … generates resources" share one timing window, forced responses first (RRG).**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | built caa7396f                                                                                     |
| 26  | **An unowned permanent encounter attachment whose host leaves play is discarded to its encounter discard pile** (player cards keep §3.30's unattach).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | built e7e6bd9e                                                                                     |
| 27  | **An additional thwart cost is paid together with the thwart's own cost; declining it undoes both (no exhausted hero, no thwart).**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | built 8d8f114e (basic thwart; events keep their cost, Q41)                                         |
| 28  | **A thwart event's payability for a costly scheme is judged after the event's own cost, at play and at target choice alike.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | built 8d8f114e                                                                                     |
| 29  | **A divided basic thwart must afford the total of every chosen scheme's additional cost.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | built 8d8f114e                                                                                     |
| 30  | **A "take damage" thwart cost that is partly prevented was not paid; the thwart is cancelled (RRG 1.8 p. 13).**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | built 8d8f114e                                                                                     |
| 31  | **Build the Permanent keyword's blank protection in wave 5** (RRG 1.8 p. 32: cards from outside its own set cannot blank a permanent card's text box; blanks record their source).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | built e4d2a390                                                                                     |
| 32  | **Attachments leaving with their host get their leave interrupts in the host's window, still in play.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | built 76fc189e                                                                                     |
| 33  | **Several cards leaving from one step share one interrupt window; the first player orders simultaneous interrupts** (RRG 1.8 "Simultaneous Resolution", p. 40; the question first said "active player", corrected and confirmed 2026-09-26).                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | built 76fc189e                                                                                     |
| 34  | **In a replacement, log the replaced event's "cancelled" line before the replacement move's announcement.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | built 76fc189e                                                                                     |
| 35  | **`takeIntoHand` applies its ownership change with the move, after the leave interrupt.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | built 75b8f418                                                                                     |
| 36  | As built: a villain's signature side scheme removed on defeat can open a leave window when something listens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | built ae82c42f                                                                                     |
| 37  | Ready/exhausted follows the physical card on SP//dr's form change (community play; no FFG ruling).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | built 928c7eb8                                                                                     |
| 38  | **Counters and attachments on SP//dr's other card move to the identity when she changes form** (the printed Suit Up! / Return to Base).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | built 74230079                                                                                     |
| 39  | Status cards stay on the identity through SP//dr's form change (RRG "Change Form").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | built 928c7eb8                                                                                     |
| 40  | **A confused hero's thwart still pays the scheme's additional thwart cost** (costs of the attempt are paid; the status replaces the thwart).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | built 0f6ca32d                                                                                     |
| 41  | A thwart event whose scheme's extra cost is declined keeps its own cost paid (the event was played).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | built 8d8f114e                                                                                     |
| 42  | Q18 stands; its reason is RRG 1.8 p. 13 (an ability can't be initiated unless its costs can be paid), not target validity (p. 42 ignores costs).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                                                  |
| 43  | **A hero's nemesis set is part of that identity's set for Permanent** (ruling June 25, 2026 (4) #1: "Nemesis sets belong to that identity").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | built b3841972                                                                                     |
| 44  | A permanent card in no hero, scenario or modular set can only be blanked by itself (literal RRG p. 32).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | built e4d2a390                                                                                     |
| 45  | **A granted Permanent keyword protects too, not only a printed one** (the card's state in play).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | built f1cffa83                                                                                     |
| 46  | **Permanent's defeat and leave-play protection is set-aware too** (RRG p. 32: only effects from outside its own set are stopped). After the leave-play follow-ups.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | built 1eaa9ba8                                                                                     |
| 47  | A confused identity's "(thwart)" event is cancelled before choosing a target (RRG p. 26: cancelled except its costs), so no scheme's additional cost is charged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | built 0f6ca32d                                                                                     |
| 48  | **Bug fix (RRG, no ruling needed): a confused character's thwart through an ability or effect is replaced by removing the status**, not only a basic thwart or an identity's labeled ability.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | built c0ed2547                                                                                     |
| 49  | **Characters defeated by one effect (e.g. one damage sweep) share one leave-play window**, not one at a time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | built a46a6d81                                                                                     |
| 50  | Engineering follow-ups to Q32–Q35 (no ruling): `separated-identity.ts` discards through `leavePlayAtOnce` with no waiting step; attachments on attachments don't join the host's window; `joinGameArea`'s stage removal doesn't wait. Also (from Q48): `abilityLacksValidTarget` may refuse an unlabeled ability naming a confused ally when no scheme is targetable, though RRG p. 13 lets a confused character attempt it. (Host-step waiting paths now tested, ce1bdb6a.) Also (from Q53): permanent attachments on a host that leaves through a host step, or on a flipped host, are left dangling or orphaned.                                                                                                     | built 52a47262, efa80404, 0278c8c8, cc16b34d, d46d0851                                             |
| 51  | As built (f1cffa83), no card does this: a Permanent grant from a card that a constant rule blanks (Tech Theft-style) still counts for protection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | built f1cffa83                                                                                     |
| 52  | As built (f1cffa83), no card does this: two cards granting each other Permanent are both blanked by a blank that reaches both.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | built f1cffa83                                                                                     |
| 53  | **Bug (RRG p. 11 "Cancel", no ruling needed): when a host-step carrier attachment's own leave interrupt cancels its leaving, it must stay attached**; today `leavePlayAtOnce` discards it anyway (`game-areas.ts` host-step bodies re-run their discard loop). Pinned by `it.fails` in `leave-play-host-steps.test.ts` (ce1bdb6a).                                                                                                                                                                                                                                                                                                                                                                                      | built 1245288a                                                                                     |
| 54  | A Permanent character at 0 hit points is not defeated even if its own set dealt the damage: a 0-HP defeat is a game rule with no source card (as are 0-threat defeats, the Uses discard, uniqueness/ally-limit/Restricted discards).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | built 1eaa9ba8                                                                                     |
| 55  | **Q46 follow-ups (RRG, no ruling needed):** `takeIntoHand` must not change owner on a refused leave; log a Permanent-blocked leave (`leavePlayBlocked`, reason `permanent`); a cost can't pick a card in play its discard would be stopped for (RRG p. 13).                                                                                                                                                                                                                                                                                                                                                                                                                                                             | built 0268f004, 4954f825, e7eba8ae                                                                 |
| 56  | **Bug (no ruling needed): `ValueSpec boostIcons` counts only the first card of a multi-card ref** (`select.ts`, unlike `starIcons` which sums); Spider-Man (Hobie Brown)'s "deal damage equal to the number of boost icons discarded" is pinned by `it.fails` in `ghost-spider/support-upgrades-allies.test.ts` (c84b4f54).                                                                                                                                                                                                                                                                                                                                                                                             | built 79634d1f                                                                                     |
| 57  | As built after Q50, no card does these: a confused thwarter chosen during resolution is checked at the thwart, not at initiation; a nested attachment learns its host's leave was cancelled only if every attachment between them has an event in the same window; with several players changing form from one effect, a waiting change announces `formChanged` after the others.                                                                                                                                                                                                                                                                                                                                       | built                                                                                              |
| 58  | As built after Q49, no card does these: a villain or identity defeated in the same sweep as minions keeps its own windows (removed/eliminated, not discarded); in one multi-card leave step, a card with no interrupt listening moves at once while another waits (Q33); a `damageGroup` still opens one damage interrupt window per member.                                                                                                                                                                                                                                                                                                                                                                            | built                                                                                              |
| 59  | **Primitive (no ruling needed): `applyRuleUntil` can last until the end of an attack**, for In Cold Blood (27029) "You cannot play events until after that attack resolves"; pinned by `it.fails` in `ghost-spider/obligation-nemesis.test.ts` (bc412cdd).                                                                                                                                                                                                                                                                                                                                                                                                                                                              | open                                                                                               |
| 60  | **Primitive (no ruling needed): `reorderCards` on a player deck (top and/or bottom, any order)**, for Global Logistics (27043); pinned by `it.fails` in `spider-man-morales/events.test.ts` (c49d6f28).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | built bad530f8                                                                                     |
| 61  | **Data (no ruling needed): a multi-icon Requirement keyword is dropped by the ingest parser** (27049 Spider-Man / Peter Parker, silk 52022); single-icon ones parse.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | built 59248c4b                                                                                     |
| 62  | **DSL gap (no ruling needed): no `EventPattern` for "consequential damage"**; Field Agent (27044) mirrors `sourceIs` on the target instead (only consequential damage has source = target). The same text on Cannonball and Falcon needs the real pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                                              | built f8c07ed1                                                                                     |
| 63  | **Bug (no ruling needed): `resolveSpecials` resolves every Special on the card**, but callers name one ("resolve Spider-Man's 'Venom Blast' ability"): a Web-Shot paid with [energy] also gave tough and confused. The Miles tests (c49d6f28, c47196d4) had asserted both firing.                                                                                                                                                                                                                                                                                                                                                                                                                                       | built 87d7af36                                                                                     |
| 64  | **Data drift (no ruling needed): regenerating `silk` offline changes Silk Sense Overload 52028's `abilities`** — the committed generated file and its curation disagree (predates wave 5). Regenerate and review the silk pack once, on its own.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | open                                                                                               |
| 65  | **Primitive (no ruling needed): an attack records each character's damage taken** (`damageTaken.<instanceId>` results: indirect shares and overkill spill included; prevented, reduced-away or tough-absorbed damage not), read by `Predicate eventDamageTakenAtLeast` / DSL `eventDamageTaken`, for Sandman's Sand Blast / Sand Wave (27061–27063) "If your identity takes any amount of damage from that attack" (indirect damage put on an ally; overkill spilled onto the identity). The spill still stays out of the attack's `damage`/`damaged`/`defeated` totals.                                                                                                                                                | built d3ee180a, 4fa32823                                                                           |
| 66  | **Primitive (no ruling needed): boost changes scoped to the activation an effect starts** — `enemyAttack`/`enemyScheme` gain `extraBoostCards` and `boostIconsEach` ("each boost card turned faceup during that activation gets +N"), seeded on the activation's event frame like `atkBonus`; `modifyAttack.boostIconsEach` is the in-progress form. For Swinging Assault (27168; its `modifyAttack` after the attack came once the attack had resolved, RRG 1.8 "Activation", p. 6) and Biting Retort (27082, pinned `it.fails`). No activation, nothing dealt or kept (RRG 1.8 "Boost, Boost Icon", p. 11).                                                                                                           | built 0ffe96f0, a931221d                                                                           |
| 67  | **Ruling (user, 2026-09-27): "X activates against you / [a player]" resolves like a villain-phase activation:** X attacks that player in hero form, schemes against them in alter-ego form, read as it resolves (RRG 1.8 "Activation", p. 6: card-caused attacks and schemes "are also considered activations"); "when/after X activates against you" matches both. `EffectSpec enemyActivation` (DSL `enemyActivates`), `on.enemyActivates(by, { againstYou })`. Wave 5: Biting Retort 27082, 1B 27076b. Older scripts: "Q67 survey" below.                                                                                                                                                                            | built 80212f6c, addd0690; older files converted: effects 27127d7…a8c6cbb, triggers b0ec2b4…8feebb7 |
| 68  | **Primitive (no ruling needed): a character's defeat records its excess damage** (`characterDefeated.excessDamage`, from any damage: attack, event/ability, a damage group's member, an overkill spill), read by `ValueSpec defeatExcessDamage` / DSL `defeatExcessDamage`, `defeatedWithExcessDamage`, for Shifting Apparition (27091) "If this minion was defeated with excess damage, the defeating player …" (`defeatingPlayer`). Measured as overkill measures it (RRG 1.8 "Excess Damage", p. 19; "Overkill", p. 31, `excessDamageOf`): damage taken past remaining hit points, so exactly lethal is none, prevented/reduced/tough-absorbed damage is none, and a non-damage defeat ("defeat a minion") has none. | built 28ac3788, 6484faa6                                                                           |
| 69  | **Primitive (no ruling needed): `ValueSpec handCount` takes an optional card `filter`** (DSL `handCountOf(player, filter)`), matched against that player's hand on every read, like `scenarioAreaCount`/`victoryDisplayCount`, for Evil Doppelgänger (27154) "+X SCH and +X ATK, where X is equal to the number of identity-specific cards in the engaged player's hand": `handCountOf(engagedPlayerOf(self), { identitySetOf: eachPlayer })`. "Identity-specific" is RRG 1.8 "Identity-Specific Card" (p. 23), a classification naming no particular identity, so any seated identity's set counts. A minion engaged with no one names no engaged player, so X is 0.                                                   | built 3574b71f, 7b0a07f2                                                                           |
| 70  | **Primitive (no ruling needed): `RuleSpec cannotResolveTriggeredAbilities`** (DSL `cannotResolveTriggeredAbilities(on, { identityFace, timings })`) for Induced Panic 27153 ("You cannot resolve triggered abilities in your hero's printed text box"): every bold-timing ability on the host identity's hero face — Actions and Resources included (RRG 1.8 "Ability", p. 4; "Action", p. 6; "Resource Ability", p. 37) — is neither offered nor resolved; a forced one is skipped ("Cannot", p. 11). `AbilityCost.discardRandomFromHandFilter` for its Alter-Ego Action.                                                                                                                                              | built 9c25aad, 036b47e                                                                             |

#### Q67 survey: older scripts to convert (all 11 converted 2026-09-27; kept as the record)

Surveyed 2026-09-27 with `grep -i "activates against"` over `packages/cards/src` and `packages/content/src/data/*/cards.ts`.
Convert in small batches, one file per commit, updating the tests that pin the old reading.

**Changes behavior (11 files).** Effects that start an activation become `enemyActivates(enemy, { against, … })`:

- `wave2/toafk/kang-encounter-set.ts`: Ancient Grudge 11051 is `enemyAttack(Kang (Master of Time), { additionalResolution })`,
  which always attacks. In alter-ego form it should scheme. Test: `kang-encounter-set.test.ts`.
- `wave2/trors/crossbones.ts`: Crossbones' Assault 04070 is an `enemyAttack` of the villain against
  `defeatingPlayer` (with `additionalResolution`), which always attacks. It should scheme against a defeating player
  in alter-ego form.
- `wave2/scw/obligation-nemesis.ts`: Chaos Manipulation 15027 is `enemyAttack(chosen("luminous"))`, which always
  attacks. Test: `scw/obligation-nemesis.test.ts`.
- `wave4/mts/tower-defense.ts`: Proxima's Power 21106 and Corvus's Cunning 21107 are `enemyAttack(… { additionalResolution })`,
  which always attack. Their boosts already set both `atkBonus` and `threatBonus`, so they work for either activation.
  Test: `tower-defense.test.ts`.
- `wave4/mts/loki.ts`: The Trickster 21176 is `enemyScheme(theVillain)`, which always schemes. It should attack in hero
  form. `wave4-primitives.test.ts` "§3.7 Loki" pins the scheme.

Triggers "when/after X activates against you" become `on.enemyActivates(by, { againstYou: true })`. Today they fire on
attacks only, so they miss X's schemes against an alter-ego:

- `wave2/trors/absorbing-man.ts`: Absorbing Man (III) 04078 forced response, `on.villainAttacks({ againstYou })`.
- `wave2/scw/obligation-nemesis.ts`: Luminous 15025 forced response, `on.enemyAttacks("self", { againstYou })`.
- `wave4/mts/spectrum-obligation-nemesis.ts`: Radioactive Man 21027 forced response, `on.enemyAttacks("self", { againstYou })`.
- `wave4/mts/adam-warlock-obligation-nemesis.ts`: The Magus 21067 forced response, `on.enemyAttacks("self", { againstYou })`.
  Test: `adam-warlock-obligation-nemesis.test.ts`.
- `wave4/mts/ebony-maw.ts`: Ebony Maw 21071 (all stages) forced interrupt, `on.villainAttacks({ againstYou })`.
- `wave4/hood/brothers-grimm.ts`: Brothers Grimm 24018 forced interrupt, `on.enemyAttacks("self", { againstYou })`, and
  the attachments Blackbird Pellets, Corrosive Egg Bomb, Paralytic Stardust and Unbreakable Thread (24019–24022,
  `afterAttachedActivates`), `on.enemyAttacks("host", { againstYou })`.
- `wave4/hood/hood.ts`: Established Dominance 24007 forced response, `on.villainAttacks({ againstYou })`.

**Already correct. Optional tidy-up only, no behavior change:**

- These branch with `ifThen(isHero(player), enemyAttack, enemyScheme)`, which is what `enemyActivates` does:
  `wave3/ron/kree-fanatic.ts` Bring the Hammer Down 90004, `wave4/mts/ebony-maw.ts` Blood to Spare 21088 and
  `wave4/hood/wrecking-crew.ts` Combined Effort 24069 (test: `wrecking-crew.test.ts`).
- These triggers already match both attacks and schemes: `wave3/gmw/ronan.ts` Ronan the Accuser 16103
  (`on.enemySchemesOrAttacks("self")`), `wave3/gmw/nebula.ts` Nebula 16088–16090 ("initiates an activation against
  you"), `wave3/gmw/badoon.ts` Badoon Engineer 16065 (a raw `["minionEngaged", "enemyAttack", "enemyScheme"]`
  pattern) and `wave4/mts/infinity-gauntlet.ts` Infinity Gauntlet 21129 (`after.enemySchemesOrAttacks("host")` with
  `usesAttackedPlayer`).
- `dsl/wave5-primitives.test.ts` §3.6 still shows 1B on `on.enemyActivating` ("would activate", §3.2). It is a DSL
  shape example, not the script.

**Check while converting:** Ancient Grudge, Crossbones' Assault, Proxima's Power and Corvus's Cunning mark their
activation `additionalResolution`, as Biting Retort did before addd0690. That flag is meant for one attack resolved
against more players (Whirlwind). It silences the attacker's own "when this enemy attacks" abilities and the villain
audit's boost-card count. Each of these cards starts a new activation, so the flag is probably wrong. Confirm per card.

**Not scripted yet (use the primitive when their packs are scripted):** `bp` Joystick 51039, Extreme Risk 51042;
`falcon` Techno 53042; `gambit` Acolyte Frenzy 37035; `iceman` Life Drain 46031; `magneto` Angry Acolyte 49032, Power
and Decadence 49042; `mojo` Supporting Actor 39029, Cultist 39049, Magneto 2.6 39056; `ncrawler` 48038; `nova` Armadillo
28029; `psylocke` Chimera 41026; `silk` Growing Strong 52037; `spdr` Electro 31032; `storm` Astral Attack 36039; `winter`
High-Tech Armament 54030, Whiteout 54037; `wolv` Seeking Vengeance 35035; `wonder_man` Scythe Strike 58028, Death Cannot
Die 58029. Wave 5 `sm`: Venom Goblin 27113, Advanced Glider 27136 ("it activates against you again"), Remote
Navigation 27141, Doctor Octopus 27158, Electro 27159, Vulture 27163.

**Worded "attacks you". These stay attacks (`enemyAttack` / `on.enemyAttacks`) and are not part of Q67:** `core` 01078
01106 01122 01129 01130 01134 01145 01187 01189; `gob` 02021 02022 02031 02034 02038 02039 02042; `trors` 04064 04086
04105 04120 04138 04146 04150; `msm` 05013; `twc` 07005 07009 07012 07013 07017 07021 07024 07028 07030 07036 07038
07040 07044 07049 07050 07051 07053 07055 07057; `drs` 09028; `hlk` 10015 10016 10026; `toafk` 11001 11006 11026 11031
11034 11039; `wsp` 13030; `scw` 15030; `gmw` 16078 16086 16102 16110 16116 16117 16134 16148; `drax` 19003 19007 19029;
`mts` 21092 21120 21150; `nebu` 22031; `hood` 24013 24034 24036 24044 24047 24048 24051 24054 24068; `vision` 26020
26029; `sm` 27013 27029 27061 27072 27137 27138 27139 27151 27160 27168; `nova` 28023 28031; `spiderham` 30006;
`cyclops` 33031; `wolv` 35028; `storm` 36012; `gambit` 37011 37029; `mojo` 39010 39021 39057 39068; `angel` 42016 42027;
`deadpool` 44047; `iceman` 46027 (and Life Drain 46031's "attacks you" half); `jubilee` 47024; `ncrawler` 48029;
`magneto` 49028 49031; `bp` 51040; `silk` 52019. These come from a text match on "attacks you" and include "when X attacks
you" triggers. Every one of them names an attack.

### 4.2 The questions as asked

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
14. **Public Outcry's expert uses count** (§1.9): "3" or "3[per_hero]". **Resolved 2026-09-26 from the card images:**
    27174a prints 2[per_hero], 27174b prints 3[per_hero], matching MarvelCDB's raw text.
15. **What a main scheme keeps when it flips to its environment** (§3.3). RRG 1.8 "Flip" (p. 20) discards tokens on a
    change of card type, but the Manhattan environments' own When Revealed moves "the glider counter and each
    acceleration token from here". **Default:** card text wins (RRG 1.8 "The Golden Rules", p. 4): threat and
    attachments go, counters and acceleration tokens stay on the card for the When Revealed to move.
16. **Venom III's "if this is the first attack this turn"** (§3.12; added 2026-09-26 by `game-rules-architect`). No
    ruling says which attacks count: every attack this turn (a player's attack on a minion first makes the Venom attack
    not the first), or only attacks on Venom. **Default:** the literal reading, every attack made during this player's
    turn, player-made or enemy-made (`firstAttackThisTurn()`). The other reading, if FFG or the user says so, is
    `firstAttackThisTurn` with `against` set to the card itself.
17. **"When X leaves play" resolves after the card has moved** (§3.13; added 2026-09-26 by `game-rules-architect`).
    RRG 1.8 "Interrupt" (p. 25) resolves an interrupt before its triggering condition, and ruling Jan 17, 2026 (1) #2
    has the "Leaves Play" bullets happen as the card leaves, so the card should still be in play with its attachments
    when the interrupt resolves. The engine's `leavePlay` is synchronous for dozens of callers, so the interrupt window
    opens after the move, with what the card was (title, controller, traits including granted ones) carried on the
    event. **Default:** as built. Every wave 5 interrupt (Spider-Man (Hobie Brown), Ghost-Spider) and response reads
    nothing the move changes; a replacement ("tuck it under here instead", Abduct Superhumans, `aos` 50081) would move
    the card from where it went, which ends the same unless the card went to the hand. Revisit if a card needs the
    card in play.
18. **A thwart whose additional cost cannot be paid** (§3.21; added 2026-09-26 by `game-rules-architect`). RRG 1.8
    "Cost" (p. 13) does not let an ability be initiated without paying its costs, so a player who cannot spend the
    [energy] resource should not be able to choose Giant Monster Attack as the target of a thwart at all. The engine
    asks for the cost as the thwart is about to resolve: a player who cannot or will not pay sees the thwart cancelled
    after the thwarter's own costs (the exhaust of a basic thwart, an event's resources) are paid. **Default:** as
    built; the target-legality pre-check (a payability test over hand cards and resource abilities, as `legal.ts`
    does for play costs) is left for when a card makes it matter.
19. **When the additional mulligan comes** (§3.26; added 2026-09-26 by `game-rules-architect`). MC27 p. 22 node 5
    (p. 67 erratum): "each player may take 1 additional mulligan." It can mean the same player goes again at once (p1,
    p1, p2) or a second full round (p1, p2, p1, p2). No ruling; only multiplayer shows the difference. **Default:** as
    built, p1, p1, p2.
20. **No extra mulligan after keeping the hand** (§3.26; added 2026-09-26 by `game-rules-architect`). A mulligan that
    discards nothing ends that player's mulligans, since the extra one would offer the identical hand. If an obligation
    left the hand short and the draw-up filled it, the extra mulligan is still offered. **Default:** as built.
21. **What "all player decks" covers for Waking Nightmare** (§3.27; MC27 p. 13). **Default:** each player's deck zone
    only, not hand or discard; an eliminated player's deck counts nothing (RRG p. 34).
22. **Node 5's reward is a lasting rule** (§3.27). Its box is white ("resolve immediately") but it applies "during the
    Resolve Mulligans step" of each later game. **Default:** marking node 5 appends a conditional instruction applied at
    every remaining scenario's setup, like a pink box.
23. **A minion's overkill spill onto the villain** (§3.29; RRG "Overkill" p. 31). The engine counts the spill as attack
    damage, so Bell Tower (Quiet) is offered for it. **Default:** yes, it is damage dealt by an attack.
24. **M.O.R.B.I.U.S. against an alter-ego** (§3.25): resources can be generated in alter-ego form; does "that player's
    hero" take the damage? **Default:** the identity takes it whatever its form.
25. **Order of the responses within one payment** (§3.25): "after you spend this card" and "after … generates
    resources" come from the same payment but are separate events, the generated one last, so forced responses do not
    resolve first across both. **Default:** as built until a card combines them.
26. **A permanent encounter attachment with no player owner or controller, when its host leaves** (§3.30; outside
    player elimination, where ruling Mar 19, 2026 (3) has the card resolve its "attach to" text again). No printed card
    does this today. **Default:** as built, it stays in play unattached in the villain's play area (as does a player
    card whose controller was eliminated). Alternative: resolve its "attach to" again, as elimination does.
27. **An additional thwart cost is paid with the thwart's own cost** (Q18 follow-up; RRG 1.8 p. 13 "paid simultaneously",
    p. 24 step 5 "without paying any costs"). Strictly, choosing the target commits the player to pay, and a decline
    should not leave the hero exhausted. **As built (b4c8b1fd):** the target is only offered when payable; declining at
    resolution still cancels the thwart after the exhaust (a fallback so the engine can't stall). Folding the extra cost
    into the thwarter's cost payment is a larger change, not made.
28. **When a thwart event's payability is judged** (Q18 follow-up). At play, the check sees the hand before the event's
    own cost is paid; at the target choice, after. A scheme can pass the first and fail the second. **As built.**
29. **A divided basic thwart across several costly schemes** (Q18 follow-up) checks each scheme's cost separately, not
    their total. **As built.**
30. **A "take damage" cost that is partly prevented** (Q18 follow-up; RRG 1.8 p. 13: not paid if any is prevented). The
    §3.21 indirect-damage cost does not check prevention. **As built.**
31. **The Permanent keyword's blank protection** (§3.31 follow-up; RRG 1.8 "Permanent", p. 32): effects from cards
    outside the permanent card's own set cannot blank any part of its text box. `isPermanent` covers defeat and leaving
    play, but no blank check reads it. Building it needs a blank to record which card caused it, to compare sets. Both
    SP//dr faces are Permanent (and carry their own §3.31 line). **Default:** a separate primitive later.
32. **Cards leaving with their host** (Q17 follow-up, ae82c42f): attachments and Victory X upgrades that leave because
    their host does (and attachments discarded when a villain or main scheme stage is removed or flipped) get their own
    "when this leaves play" interrupt after the move, not in the host's window. No wave 5 card needs it. **As built.**
33. **Several cards leaving from one effect** (Q17 follow-up): each gets its own interrupt window, in the order asked,
    not one shared window where the active player orders them. **As built.**
34. **Log order in a replacement** (Q17 follow-up): the replacement move's response announcement is logged before the
    replaced event's "cancelled" line. Cosmetic. **As built.**
35. **`takeIntoHand` ownership during the interrupt** (Q17 follow-up): the ownership change is applied before the card
    waits, so the interrupt sees the card in play with its new owner. **As built.**
36. **A villain's signature side scheme removed on defeat** (Q17 follow-up, `defeat.ts`) still goes through the waiting
    `leavePlay`, so it can open a window if an interrupt listens for it. **As built.**
37. **SP//dr's ready state on a form change** (§3.24): follows the physical card (built) or the character (RRG "Change
    Form", p. 21)?
38. **Counters and attachments on SP//dr's other card at a flip** (§3.24): discarded (RRG "Flip", p. 20; built) or moved
    to the identity?
39. **Status cards through SP//dr's form change** (§3.24): stay on the identity (built) or discarded?
40. **A confused thwarter and an additional thwart cost** (Q27 follow-up): charged, or not asked (built)?
41. **A thwart event whose scheme's extra cost is declined** (Q27 follow-up): refund by choosing targets before paying,
    or keep the event's cost paid (built)?
42. **Q18 against RRG 1.8 p. 42** ("The cost of an ability or game function is not considered when determining if that
    ability or game function can affect a target"): keep Q18 on p. 13's grounds?

---

## 5. What this asks of the other agents

- **`card-data-pipeline`** (after §1 lands):
  - make `sm` survey clean and emit it, campaign cards included (§1.1, §1.2, §1.3, §1.5, §1.8, §1.9), with the two
    precons from MC27 p. 20 and `SM_CAMPAIGN` (`data/sm/campaign.ts`, the `mts` shape);
  - "Bring the War!"'s text from the card image, the p. 68 errata still missing (Ms. Marvel, "Go for Champions!",
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
