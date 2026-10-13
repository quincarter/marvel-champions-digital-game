# Phase 7 working spec: wave 10 (cycle 10, Civil War)

This is the shared brief for every agent working Phase 7's tenth content wave (`card-data-pipeline`,
`game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`,
`game-client-engineer`). It turns the wave's scope into schema decisions (§1), per-scenario setup needs (§2), a list of
engine primitives with a status each (§3), open questions for the owner (§4), the card coverage tables (§7) and the
build order (§8). The model is `docs/phase7-wave9.md`, and its section numbers are kept (§0 sources, §1 schema, §2
setup, §3 primitives, §4 questions, §5 other agents, §6 later passes, §7 card tables, §8 build order). Wave 1–9 §3
primitives are assumed. The definition of done is `docs/wave-definition-of-done.md`; **its step 6 (the box's campaign)
does not apply**: MC56 p. 3 says the expansion "does not include five interconnected scenarios and a campaign mode".
What the box has instead is custom scenario building, which this pass specifies. If you change a decision here, update
this file in the same change. Agents do not edit statuses or open questions; they report, and the main session flips
them.

**Wave 10** is our `cycleId("cycle10")`. RRG 1.8 Appendix VI (p. 71), item 10: "The _Civil War_ custom scenario
expansion, the _Wonder Man Hero Pack_, and the _Hercules Hero Pack_." Packs: `cw` (MC56, with Tigra and Hulkling),
`wonder_man`, `hercules`. The spec is written in passes so each stays small:

| Pass   | Scope                                                                                                 | State       |
| ------ | ----------------------------------------------------------------------------------------------------- | ----------- |
| **1a** | **Civil War in cooperative play: leaders, custom and random scenarios, the four preconstructed ones** | **written** |
| 1b     | Tigra, Hulkling, their nemesis sets and the box's aspect and basic player cards                       | not written |
| 1c     | Competitive mode (MC56 pp. 14–17), not shipped: `competitive-mode-plan.md` and its scaffolding tasks  | plan exists |
| 2      | Wonder Man (`wonder_man`), Hercules (`hercules`)                                                      | not written |
| 3      | The owner's answers written in and reconciled; §8 extended to the whole wave                          | not written |

- **Pass 1a's content.** MC56 pp. 3–9 and the FAQ on p. 20: the `leader` card type, custom scenario building (a side,
  a leader, three or four modular sets, the Standard set, a stage 1 and a stage 2 main scheme), random scenario
  creation (p. 5), playing a custom scenario cooperatively (p. 6), the four preconstructed scenarios (pp. 7–8), the
  featured terms and keywords (p. 9), the four leaders (16 stage cards) and their 10-card sets, the 16 main scheme
  cards, the 16 modular sets, and how every "enemy team", "your team", "your leader" and "In competitive mode" clause
  reads in a cooperative game. Sections 0, 1.1–1.10, 2.1–2.6, 3.1–3.23, questions 1 and 6–13 (2–5 are the sources
  page's and the hero packs'), §5, §7 and §8.
- **Two counts in the brief and the handoff page are low.** The box has **16 modular sets, eight per side**, and **16
  main scheme cards, eight per side** (four stage 1 and four stage 2 each): MC56 p. 3 lists "8 Main Schemes" and "8
  Modular Encounter Sets" under "Each side has the following content", and the raw cache has 16 `modular` sets of
  exactly 5 cards and 16 `main_scheme` records. `docs/phase7-wave10-handoff.md` says "eight 5-card modular sets (four
  per side)"; the main session should correct it.
- **MC56 pp. 10–13 carry no rules.** They are a four-page comic (pages 10 and 11 were read as images; pages 12 and 13
  were read the same way). The featured terms and keywords are all on p. 9.
- **Owner decision, 2026-10-11 (question 1 = A, with an addition).** Competitive mode does not ship in this wave. The
  client says "Competitive mode coming soon" wherever a player would look for it (the Civil War scenario builder, the
  box's "New in this box" page), and scaffolding is built now so the mode drops in later: the setup carries a game
  mode (`cooperative` today; `competitive` refused with a clear message, §3.4), and "the enemy team", "your team" and
  "your leader" resolve against the game's teams, not against a hard-wired single team (§3.5, §3.6). The plan and the
  scaffolding task list are `docs/competitive-mode-plan.md` (its §4, tasks 1 to 15); **this spec uses that page's
  names and does not define a second design**: §3.4 to §3.6 say what the cooperative scripts need from it.
- **Not in this pass** (placeholders in §6): Tigra (56001a/b–56009), her obligation 56023 and nemesis set
  56024–56028, Hulkling (56029a/b–56040), his obligation 56054 and nemesis set 56055–56058, the aspect and basic cards
  (56010–56022, 56041–56053); competitive mode, the Standard PvP set (56125–56128, printed twice as 56203–56206) and
  the sixteen leader-specific player cards (56129–56136, 56207–56214), all "used only when playing in competitive
  mode" (MC56 p. 3); the two hero packs.
- **Data state (2026-10-11, HEAD 57141e32):** `cw` and `hercules` are raw cache only; `wonder_man` is emitted, data
  only. Nothing of this wave is scripted. `docs/phase7-wave10-sources.md` (where every source lives; its §7.2 lists
  the ruling conflicts and its §10 the owner questions 1 to 5) and `docs/competitive-mode-plan.md` were written
  alongside this pass. `docs/phase7-wave10-data-survey.md` (what the normalizer does with `cw`) did not exist yet:
  where §1 says "the survey confirms", that check is still owed.

## 0. Sources

| Source                                                             | What it is used for                                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `docs/campaign-modes/mc56_rulebook-web_1.pdf` ("MC56 p. N")        | The box's rules. Pages 3–9, 14 and 20 read as text; 5 and 9–13 read as images       |
| `docs/campaign-modes/markdown/mc56_civil_war.md`                   | A pointer only (the card callouts are jumbled); pages 15–17 skimmed for pass 1c     |
| `packages/content/raw/marvelcdb/cw.json`                           | 214 records under `cards` (the top level is an object: `source`, `pack`, `cards`)   |
| `mc_rulesreference_v18_compressed.pdf` / `.md` ("RRG p. N")        | Leader (p. 26), Teamwork (p. 43), Unique Icon (pp. 45–46), errata (p. 70), p. 71    |
| `marvel-champions-rulings-post-rrg-1-7.md` (cited by date heading) | Dec 17, 2025 R2; Jan 11, 2026 R1 and R2; Jan 26, 2026 R5; Jun 2, 2026 R4; Jul 9 R3  |
| `docs/phase7-wave2.md` §6.3                                        | The leader and competitive schema already landed (2026-09-18)                       |
| `docs/phase7-wave10-sources.md`, `docs/competitive-mode-plan.md`   | Sibling pages: sources, ruling conflicts, owner questions 2–5; the competitive plan |

- **How the PDF was read.** The Read tool's PDF renderer is not installed on this machine. Text came from
  `pdftotext -f N -l N` and page images from the repo's own `docs/extract_pages.py` (pymupdf through `uv`). Page
  numbers are the PDF's own.
- **Raw records read by script.** All 185 encounter-side lines: every `faction_code: "encounter"` record and every
  leader-set record, with each nested `linked_card` (the 16 main scheme B faces and Now It's Personal 56128b/56206b).
  The raw text carries typos that are the cache's, not necessarily the print's ("engage3d" 56023, "Underwold" 56027,
  "damager" 56086, "Attack to Paladin" 56118, "enmy" 56158, "Chooose" 56178); §8.1 item 6.
- **RRG entries that govern this pass.**
  - "Leader" (p. 26): "The leader card type follows the same rules as the villain card type for all purposes."
  - "Teamwork (Trait)" (p. 43): "After a minion with teamwork enters play and engages a player, if there is at least
    one other minion that shares the specified trait in play, the minion that just entered play activates against the
    player it is engaged with." It "is equivalent to" a Forced Response, and on a revealed minion it "resolves after
    any 'When Revealed' abilities on that minion are resolved."
  - "Unique Icon" (pp. 45–46), quoted in full in `packages/engine/src/unique.ts`.
  - "The Grim Rule" (p. 4): "resolve the conflict in the manner that the players perceive as the worst possible
    resolution at that moment with regards to winning the scenario".
  - Errata, "Civil War Expansion" (p. 70): Yellow Jacket 56019 and 56073 are titled "Yellowjacket"; Energy Channel
    56098 reads "… remove all of them **and** Captain Marvel attacks that character" (the cost arrow is gone).
- **Rulings that name this box.**
  - Jul 9, 2026 R3, answer 2: "Outside Civil War scenarios, 'enemy leader' refers to the villain."
  - Jan 11, 2026 R1: Fearless Determination 56149 "is considered in play until its When Defeated ability resolves.
    Its amplify icon remains in effect when Captain America activates"; overkill damage to Captain America from an
    attack that used ATK moves Cap's Shield; Captain Marvel's Forced Response fires once per character defeated; "you
    cannot use Registration modular sets with a Resistance leader, nor vice versa."
  - Jan 11, 2026 R2: the same two overkill answers, restated.
  - Dec 17, 2025 R2, answer 3: an attack-labeled ability "phrased as a flat damage amount" does not take Cap's
    Shield; one that "calls out your ATK in some way" does.
  - Jan 26, 2026 R5 and Jun 2, 2026 R4: Energy Channel always places its counter, and at four "all are removed and
    Captain Marvel attempts to attack that character even if that character is no longer in play."

## 1. Schema decisions (owner: `game-rules-architect`)

What already exists from the wave 2 schema pass (`docs/phase7-wave2.md` §6.3) is kept: a leader is a `VillainCard`
with `printedType: "leader"`; `AttachmentHost { kind: "leader"; of: "enemy" | "yours" }`; the leader-specific player
cards carry `specificTo: { kind: "competitive", … }`; `standard_pvp` is `EncounterSet.competitiveOnly`. The decisions
below are what the box still needs. Each is a request to `card-data-pipeline` unless it says engine.

### 1.1 Leaders

One `VillainCard` per leader set, four stages on side A, `stageNumber` 1 to 4 with `stageLabel` I to IV: Iron Man
56059–56062, Captain Marvel 56092–56095, Captain America 56137–56140, Spider-Woman 56168–56171. Hit points are per
player on all sixteen (`health_per_hero`). No new field. "Chosen leader I and II (III and IV for expert mode)"
(56063a) is `Scenario.villainStages: { standard: [1, 2], expert: [3, 4] }`, which the existing range type already
says. The survey confirms the normalizer emits the four stages in that order (`normalize/villains.ts` already treats
`type_code: "leader"` as villain-like).

### 1.2 Main schemes: one card per side, eight stages, two of them used

`normalize/main-schemes.ts` emits "one card per scenario set, one stage per A/B record pair", so `registration`
becomes one `MainSchemeCard` with eight stages (four numbered 1, four numbered 2) and `resistance` another. That is
the shape wanted: it is The Once and Future Kang's "several stages of one number" shape, and the engine already walks
a chosen order through such a card (`MainSchemeState.stageOrder`, §3.2). Asked of the data:

- **A stable key for a stage.** New optional `MainSchemeStage.printedCardId: CardId`, the B face's own code
  (`56063b`). The builder, the client and a saved choice name a stage by it; a stage index is not stable across a
  re-emit. Required on every stage of a card that has two stages of one number.
- **Per-player icons lost in the raw text.** Every stage 1B reads "this stage gains hinder 2." and three B faces read
  "for 1 minions" / "for 1 side schemes" in the cache; the rulebook's own reproductions print "hinder 2[per_hero]" and
  "1[per_hero] minions" (MC56 p. 5, Gathering Support, read from the page image; also p. 15). The source dropped the
  icon. §8.1
  item 2 has the data agent read the sixteen scans and restore it.
- **Values.** Stage 1: starting threat 0, target 7 per player, acceleration +1 per player. Stage 2: 0, 9 per player,
  +1 per player; all eight stage 2s print "If this stage is completed, the players lose the game."
  (`completionLoses`). The raw stars (`threat_star` on 56064b and 56202b, `escalation_threat_star` on 56122b and
  56202b) mark stages whose text touches that value; only 56064b really changes one (its target, §3.15).
- **The A sides.** All four stage 1s of a side share one A side (Superhero Registration Act / Superhero Resistance:
  "Contents" and "Setup"); the stage 2 A sides (Pro-Registration Tactics / Resistance Tactics) are flavor only.

### 1.3 A side on an encounter set (new field)

`EncounterSet.side?: "registration" | "resistance"`, on the sixteen modular sets, the four leader sets and the two
main scheme sets. MC56 p. 4: "Select three or four modular sets from the chosen side. (You cannot mix registration and
resistance modular sets.)"; Jan 11, 2026 R1: "you cannot use Registration modular sets with a Resistance leader, nor
vice versa." MarvelCDB has no such field: the side is the main scheme set a leader's precon names and the color of
the card frame, so it is curated per set id (§7 lists which is which). A set with no `side` is neutral.

### 1.4 Scenario records: one per leader

Four records, ids as the music folders already use: `registration-iron-man`, `registration-captain-marvel`,
`resistance-captain-america`, `resistance-spider-woman`. A custom scenario is the same record with other picks, so a
leader is a scenario and the stage and modular picks are setup choices (as modular picks always were). Fields:

| Field                      | Value (Iron Man shown)                                                         |
| -------------------------- | ------------------------------------------------------------------------------ |
| `villainCardId`            | the Iron Man `VillainCard`                                                     |
| `mainSchemeCardId`         | the `registration` `MainSchemeCard`                                            |
| `encounterSetIds`          | `["iron_man_leader"]`                                                          |
| `standardEncounterSetIds`  | `["standard"]`; `expertEncounterSetIds: ["expert"]` (RRG "Expert Set", p. 19)  |
| `villainStages`            | `{ standard: [1, 2], expert: [3, 4] }`                                         |
| `recommendedModularSetIds` | the precon's four sets (§2)                                                    |
| `modularSetCount`          | **new shape**, a range: `{ min: 3, max: 4 }` (today a single number)           |
| `side`                     | **new**: `"registration"`                                                      |
| `mainSchemeStages`         | **new**: `{ recommended: [printedCardId of the precon's 1B, of its 2B] }` (§2) |

- `modularSetCount` becomes `number | { min: number; max: number }`. Every reader goes through one helper
  (`modularSetCountRangeOf(scenario)`), so the 40-odd existing records are untouched.
- `Scenario.side` drives two checks: a modular pick whose set has the other side is refused (§3.1), and the main
  scheme card's set must have the same side (`validateScenario`).
- `mainSchemeStages` present means "choose one stage of each number from `mainSchemeCardId`". The options are derived
  (every stage of that number), so the record lists only the recommendation.
- `validateScenarioEncounterSets` keeps refusing `standard_pvp` in any of these records.

### 1.5 The leader's side scheme

Stark Tower 56072, Alpha Flight Station 56104, Fearless Determination 56149 and Self-propelled Glide 56179 are in
their leader's 10-card set and are found and revealed by the stage 1A Setup in a cooperative game ("find the chosen
leader's side scheme and reveal it", 56063a). They stay ordinary set members: no `signatureOf`, no
`ScenarioVillain.signatureSideSchemeCardId` (that field means "put into play at setup, never shuffled in", which is
The Wrecking Crew's rule and not this one; these can be discarded and come back through the deck). The script finds
"the side scheme of the villain's own encounter set" (§3.23).

### 1.6 Counter types

Energy Channel 56098 holds "energy counters" and Finesse 56174 "skill counters" ("Max 3 skill counters here."). Both
are all-purpose counters named by the card (wave 9 §1.6, `counterTypes`). Finesse's maximum is `RuleSpec
counterLimit` (wave 9 §3.61). Nothing new.

### 1.7 Icons printed on cards that are not schemes

Unregistered Super 56106 / 56114, an obligation, has `scheme_acceleration: 1`. Wave 9 §1.8 covers an icon on a
non-scheme card (`RuleSpec gainsIcon` reads printed icons of any card in play); the obligation stays in play (§3.16),
so its acceleration icon counts while it does. The data agent confirms the icon against the scan (§8.1 item 4).

### 1.8 Reprinted titles inside the box

Mighty Avengers (56076 and 56081), Unregistered Super (56106, 56114), Bounty Hunting (56115, 56119), Freedom Fighters
(56153, 56157) and Street Defenders (56187, 56192) are the same card printed in two modular sets under two codes,
with no `duplicate_of_code` in the cache. They are emitted as separate cards (each belongs to its own set) and
scripted once, both ids registered to one ability module. "A copy of Unregistered Super" (56107, 56116) finds either.

### 1.9 Game mode (new, engine and cards)

`GameSetupConfig.gameMode?: "cooperative" | "competitive"` (absent = cooperative). `createGame` refuses
`"competitive"` with the error code `mode_unavailable` and the message "Competitive mode is coming soon. Play this
scenario cooperatively for now." (`docs/competitive-mode-plan.md` §4 task 1). It is its own field and not a
`PlayModes` flag: `PlayModes` describes how hard one table's game is, and a competitive game is two tables with a
mode each.

### 1.10 Corrections the data agent owes for this box

Listed in §8.1: the per-player icons (§1.2), the errata titles (RRG p. 70), Iron Man III's label (question 8), the
side field (§1.3), the four scenario records (§1.4), `printedCardId` (§1.2), and a read of the scans behind every
typo in §0.

## 2. Per-scenario setup needs

One setup path serves all four leaders and every custom or random scenario (§3.1). In a cooperative game:

1. The leader's first stage for the difficulty enters play (I, or III in expert mode). Its "Setup" ability resolves
   (Iron Man: find and reveal an Iron Man attachment; the other three: find the named permanent attachment and attach
   it).
2. The main scheme deck is the chosen stage 1 on top of the chosen stage 2 (MC56 p. 5). Side 1A's Setup: "In
   cooperative mode, find the chosen leader's side scheme and reveal it." Then 1A flips to the chosen 1B (Appendix II
   step 12b), whose "When Revealed" and hinder resolve.
3. The encounter deck: the leader's set (10 cards, less whatever setup pulled out), the chosen three or four modular
   sets (5 cards each), the Standard set, the Expert set in expert mode, each player's obligation, and nemesis sets as
   usual.
4. Nothing is set aside in a cooperative game. (Competitive mode sets aside the leader's four player cards, MC56
   p. 14, and uses Choosing Sides; pass 1c.)

### 2.1 The four preconstructed scenarios (MC56 pp. 7–8)

| Scenario id                   | Leader (I/II, III/IV)    | Stage 1B                     | Stage 2B                       | Modular sets (recommended)                                      |
| ----------------------------- | ------------------------ | ---------------------------- | ------------------------------ | --------------------------------------------------------------- |
| `registration-iron-man`       | Iron Man 56059–56062     | Cut Off Support 56063b       | Negative Zone Prison 56064b    | Mighty Avengers, The Initiative, Maria Hill, Dangerous Recruits |
| `registration-captain-marvel` | Captain Marvel 56092–95  | S.H.I.E.L.D. Recruits 56096b | Hunting Rebel Heroes 56097b    | Cape-Killer, Martial Law, Heroes for Hire, Paladin              |
| `resistance-captain-america`  | Captain America 56137–40 | Gathering Support 56141b     | Secret Avengers 56142b         | New Avengers, Secret Avengers, Namor, Atlanteans                |
| `resistance-spider-woman`     | Spider-Woman 56168–71    | Open Rebellion 56172b        | Neighborhood Protectors 56173b | Spider-Man, Defenders, Hell's Kitchen, Cloak & Dagger           |

Each "Encounter Deck" line ends "and Standard encounter sets. (The Standard set can be found in the Marvel Champions
core set.)", so the deck is 10 + 20 + 7 = 37 cards before obligations in standard mode.

### 2.2 Iron Man (56059–56062; set 56065–56072)

- I: 1 SCH, 1 ATK, 12 per player. II: Steady, 1/2, 16. III: 1/2, 16. IV: Steady, 1/3, 20.
- Every stage: "+1 SCH for each Tech attachment on him (to a maximum of +3 SCH)".
- I "Setup: The enemy team searches the encounter deck for an Iron Man attachment and your team reveals it." Five
  candidates (56065–56069); who picks is question 6. III prints the same Setup; the cache's "When Revealed" is a
  transcription error (question 8, closed).
- II and IV "When Revealed: Deal each player an encounter card. Iron Man cannot take damage this phase."
- 1A Setup then reveals Stark Tower 56072 (3 threat, a hazard icon).

### 2.3 Captain Marvel (56092–56095; set 56098–56104)

- I: 1 SCH, 2 ATK, 14 per player. II: Steady, 2/2, 18. III: 2/2, 18. IV: Steady, 2/3, 22.
- I and III "Setup: The enemy team finds Energy Channel and attaches it to Captain Marvel." No choice: one copy.
- Every stage: "Forced Response: After Captain Marvel attacks and defeats a character, place 1 energy counter on
  Energy Channel."
- 1A Setup reveals Alpha Flight Station 56104 (3 threat, an amplify icon).

### 2.4 Captain America (56137–56140; set 56143–56149)

- I: 1 SCH, 2 ATK, 14 per player. II: Steady, 2/2, 18. III: 2/2, 18. IV: Steady, 2/3, 22.
- I and III "Setup: The enemy team finds Cap's Shield and attaches it to Captain America." Every stage: "Forced
  Response: After Cap's Shield is attached to Captain America, give him a tough status card." So he starts tough, with
  retaliate 1 from the Shield.
- 1A Setup reveals Fearless Determination 56149 (3 threat, an amplify icon).

### 2.5 Spider-Woman (56168–56171; set 56174–56179)

- I: 1 SCH, 2 ATK, 13 per player. II: Steady, 2/2, 17. III: 2/2, 17. IV: Steady, 2/3, 21.
- I and III "Setup: The enemy team finds Finesse and attaches it to Spider-Woman." Every stage: "Forced Interrupt:
  When Spider-Woman attacks, she gets +1 ATK for each skill counter on Finesse for this attack. Remove each skill
  counter from Finesse."
- 1A Setup reveals Self-propelled Glide 56179 (3 threat, an acceleration icon).

### 2.6 Custom and random scenarios (MC56 pp. 4–5)

The four steps: (1) a side; (2) a leader of that side; (3) "three or four modular sets from the chosen side", the
Standard set, shuffled with the leader's set; (4) one of the side's four stage 1s and one of its four stage 2s,
stage 1 on top. Per side that is 2 leaders × 4 × 4 stage pairs × (C(8,3) + C(8,4) = 56 + 70 = 126) modular picks =
4,032 scenarios from the box's own sets, 8,064 in all. "Further Customization" (p. 5): "modular sets from other
products may be included in your custom Civil War scenarios during cooperative play"; how they count toward the
three or four is question 7. Random creation (p. 5): "choose your side, your leader, your 3-4 modular sets, and your
two main scheme stages all at random" and, played blind, "you won't know all the cards in the encounter deck or what
main scheme abilities to expect" (§3.3).

## 3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names say where each primitive is needed.
Every status below comes from a search by name (2026-10-11) of `packages/engine/src` (`spec.ts`, `abilities.ts`,
`trigger-events.ts`, `state.ts`, `setup.ts`, `unique.ts`, `keywords.ts`, `resolve/*`), the DSL in
`packages/cards/src/dsl`, `packages/cards/src/modular-pool.ts`, the wave 9 builder and the content schema. **Nothing
of this wave is started.** The status says what kind of work a row is: **exists (verify)** (found by name and doc
comment, its behavior for this card not run: the scripting agent proves it in a test before relying on it, and a
failure becomes an extend here); **exists (compose)** (several existing pieces, no engine change); **extend** (an
existing primitive needs one more case); **new**. Searches that found nothing are named, so nobody repeats them.

| §    | Primitive                                                                                | Needed by                                                                              | Status           |
| ---- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------- |
| 3.1  | A scenario assembled from choices: side, leader, stage picks, three or four modular sets | all four scenarios                                                                     | new              |
| 3.2  | A main scheme deck made of chosen stages of one card                                     | 56063–56064, 56096–56097, 56121–56124, 56141–56142, 56172–56173, 56199–56202           | extend           |
| 3.3  | Random scenario creation, and a scenario played blind                                    | all four scenarios                                                                     | new              |
| 3.4  | The game mode and the teams on setup and state; "In competitive mode"                    | 56063a, 56080, 56158, 56182, 56183, 56194                                              | new              |
| 3.5  | "The enemy team" searches, chooses, attaches, exhausts                                   | 56059, 56061, 56072, 56083, 56084, 56112, 56113, 56159, 56189, 56191, six 1B/2B stages | new              |
| 3.6  | "Your leader", "the enemy leader", "your team" as references                             | 56087, 56088, 56090, 56181, 56184, 56185, 56190, 56196                                 | extend           |
| 3.7  | A leader as a villain: stages III and IV, a first stage's Setup                          | the sixteen leader stages                                                              | exists (verify)  |
| 3.8  | The unique rule on an encounter card entering play: attachments, boost reveals           | 56099, 56083, 56151, 56184, 56185, 56189, 56113                                        | extend           |
| 3.9  | Teamwork (Trait)                                                                         | 56074, 56150–56152, 56155, 56156, 56077                                                | exists (verify)  |
| 3.10 | A defeated minion given to the enemy as a facedown boost card                            | 56091, 56150–56152, 56155, 56156                                                       | extend           |
| 3.11 | "Resolve the 'Boost' ability of each minion"                                             | 56153, 56157                                                                           | new              |
| 3.12 | "Gains the printed keywords of each other [trait] minion"                                | 56077                                                                                  | extend           |
| 3.13 | Hinder a main scheme stage gains under a condition                                       | the eight stage 1Bs                                                                    | extend           |
| 3.14 | A forced trigger limited "once per phase per player", by the player in the event         | 56063b, 56172b                                                                         | extend           |
| 3.15 | Defeated allies facedown under the main scheme, each lowering its target                 | 56064b                                                                                 | exists (verify)  |
| 3.16 | Unregistered: a trait from an obligation in play, and "a card is revealed that gives" it | 56106, 56114, 56120, 56097b, 56105, 56107, 56112, 56113, 56115, 56117, 56119           | extend           |
| 3.17 | "Uses their ATK to attack and damage"                                                    | 56143                                                                                  | extend           |
| 3.18 | "Attacks against them lose piercing"                                                     | 56143                                                                                  | extend           |
| 3.19 | A permanent attachment whose host leaves play resolves its "attach to" again             | 56143                                                                                  | extend           |
| 3.20 | An enemy attacks the character that just attacked it, though it may have left play       | 56098                                                                                  | exists (verify)  |
| 3.21 | "When attached character would scheme, thwart, or attack, discard this card instead"     | 56181                                                                                  | extend           |
| 3.22 | Rulings, FAQ answers and errata on behavior the engine already covers                    | 56092–56095, 56098, 56149, 56143                                                       | exists (verify)  |
| 3.23 | Reusable as is (checked by name)                                                         | the rest of §7                                                                         | exists (compose) |

### 3.1 A scenario assembled from choices

- **Text.** MC56 p. 4, steps 1–4 (§2.6); 56063a "Contents: Chosen leader I and II (III and IV for expert mode). Chosen
  leader's set, Standard set, and 3–4 modular sets."
- **Rules.** MC56 pp. 4–5; Jan 11, 2026 R1 (no cross-side modular sets); RRG "Modular Encounter Set" (p. 29),
  "Standard Set" (p. 40), "Expert Set" (p. 19).
- **Exists.** A scenario is a fixed `Scenario` record; the only setup choices are the difficulty, the difficulty sets
  and the modular picks. `chooseModularSets` (`packages/cards/src/modular-pool.ts`) checks picks against one count
  (`Scenario.modularSetCount`) and `modularPickProblem`; `wave9Scenario` / `buildScenario`
  (`packages/cards/src/wave9/setup.ts`) turn a record and options into a `GameSetupConfig`; `playableScenario`
  (`packages/cards/src/playable/index.ts`) is the app's one entry point and calls `checkModularPickCount`.
- **Missing.** A count range; the side check; a stage pick; a builder that takes them.
- **Shape.** No new "custom scenario" type. The leader is the scenario (§1.4) and the rest are options:
  - `CoreScenarioOptions.mainSchemeStageIds?: readonly string[]` (the `printedCardId` of one stage per stage number;
    absent = the record's recommendation), checked by a new `chooseMainSchemeStages(scenario, card, picks)`: one per
    number the card has, each a stage of `scenario.mainSchemeCardId`, in stage order. A record without
    `mainSchemeStages` accepts none.
  - `modularSetCountRangeOf(scenario)`; `checkModularPickCount` and `chooseModularSets` accept any count in the
    range. No picks = the recommendation.
  - `modularPickProblem` gains one line: a set whose `side` differs from `scenario.side` is refused ("Heroes for Hire
    is a registration set; Captain America leads the resistance (MC56 p. 4)"). A sided set at a scenario with no side
    is allowed (MC56 p. 5: "fully compatible with the rest of Marvel Champions"), and there "the enemy leader" is the
    villain (Jul 9, 2026 R3).
  - `wave10Scenario(scenarioId, options)` in `packages/cards/src/wave10/setup.ts`, built as `wave9Scenario` is, which
    passes the chosen stages to the engine (§3.2) and `gameMode` (§3.4).
  - `playableScenarioOffer` gains `mainSchemeStages` (the options per stage number with name and `printedCardId`, and
    the recommendation), `modularSetCount` as a range and `sides` so the client builds its picker from the offer and
    never from card data.
- **The client** (only what it will need; `game-client-engineer` designs it): today's table setup
  (`packages/client/src/scenes/table-setup.ts`, `view/modular-sets.ts`) toggles modular candidates up to one count.
  The builder needs a side and leader step (four leaders, two sides), two single-choice rows of four stage cards, a
  modular grid that accepts three or four and hides the other side's sets, a "Random" action (§3.3), a "Preconstructed"
  reset, and the line "Competitive mode coming soon".
- **Tests** (`packages/cards/src/wave10/setup.test.ts`).
  - `registration-iron-man`, no picks, standard, one player: stages [Cut Off Support, Negative Zone Prison]; the
    encounter deck holds 10 + 20 + 7 = 37 cards plus the obligation before Setup pulls two out (an attachment and
    Stark Tower).
  - Three modular picks accepted; two refused ("uses 3 to 4 modular sets, got 2"); five refused.
  - `resistance-captain-america` with `heroes_for_hire`: refused with the side message.
  - `mainSchemeStageIds: ["56122b", "56124b"]` (Public Outrage, No Going Back) at Captain Marvel: accepted. A
    resistance stage at a registration leader: refused. Two stage 1s: refused.
  - Expert: the leader starts at stage III with 16 hit points per player (Iron Man), and the Expert set is in.

### 3.2 A main scheme deck made of chosen stages of one card

- **Text.** MC56 p. 5: "Select one of the four main scheme stage 1s … Select one of the four main scheme stage 2s …
  Put stage 1 on top of stage 2."
- **Exists.** `MainSchemeState.stageOrder` ("the order its stages are walked in, as stage indexes … the last entry is
  the final stage"), written today only by `EffectSpec shuffleMainSchemeStages` (wave 6 §3.18) and read by
  `nextMainSchemeStage` (`resolve/defeat.ts`), which otherwise answers `"alternatives"` for several stages of one
  number. `createGame` always starts at `stageIndex: 0` (`setup.ts`).
- **Missing.** A way to hand the order in at setup.
- **Shape.** `GameSetupConfig.mainSchemeStageIndexes?: readonly number[]`: when present, `mainScheme.stageIndex` is
  its first entry and `mainScheme.stageOrder` the whole list. Validated at `createGame`: non-empty, each an index of
  the card, none twice, stage numbers ascending. The unchosen stages stay in the card and are simply never walked;
  anything that counts "stages of this main scheme" must read `stageOrder` when present (the villain audit, the
  client's stage pips). The 1A Setup shown and resolved is the first chosen stage's `aSide`.
- **Tests.** Indexes for [Public Outrage, No Going Back]: the game opens on Public Outrage (0 threat plus hinder,
  §3.13; target 7 with one player); completing it advances to No Going Back (target 9), not to "alternatives";
  completing that loses. A list with two stage 1s is refused. Absent: every existing scenario unchanged.

### 3.3 Random scenario creation, and a scenario played blind

- **Text.** MC56 p. 5, "Random Scenario Creation" (§2.6).
- **Exists.** `randomPicks` in `modular-pool.ts` (a seeded shuffle and slice). No random leader or stage pick.
- **Shape.** A pure function in the cards package, `randomCivilWarScenario(seed, { side?, leaderId?, modularCount? })
  → { scenarioId, mainSchemeStageIds, modularSetIds }`, drawing with the engine's own RNG (`createRng`, `shuffle`) in
  a fixed order: side, leader, stage 1, stage 2, modular sets. It only draws from scripted, playable sets
  (`UNSCRIPTED_ENCOUNTER_SET_IDS`). Its result is ordinary options for `wave10Scenario`, so a random game replays
  from its options alone and the engine learns nothing new. How many modular sets it draws is question 9.
- **Played blind** is a client presentation of a known setup: the picks are in the options and the log as always
  (state stays explicit), and the client hides the stage 2 and the set list until each is revealed. Nothing in the
  engine hides them.
- **Tests.** The same seed gives the same scenario; over 1,000 seeds every leader, every stage and every set of both
  sides appears, no pick mixes sides, and every result builds a game.

### 3.4 The game mode and the teams; "In competitive mode"

- **Text.** 56063a "Setup: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team
  reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it."; Drafted 56080 "In competitive
  mode, the enemy team attaches Drafted to a minion engaged with them and that minion engages you. Otherwise, …";
  Switching Sides 56158; Spectacular! 56182; Neighborhood Hero 56183 "In competitive mode, move 2 threat … Otherwise,
  place 2[per_hero] threat here."; Cloak 56194.
- **Rules.** MC56 p. 6 (cooperative reading), p. 14 and the quick reference on p. 20 (competitive); the owner's
  decision of 2026-10-11.
- **Exists.** `Predicate inMode("standard" | "expert")` and `PlayModes` (difficulty and its variants). Nothing knows
  a team. Searches that found nothing: `competitive` in `setup.ts` and `state.ts`, `team` in `spec.ts`.
- **Shape.** Owned by `docs/competitive-mode-plan.md` §4, tasks 1, 2, 3 and 6, and built first (§8.2). What this
  pass relies on:
  - `GameSetupConfig.gameMode` (§1.9), stored on state only when it is not cooperative, so today's saves and replays
    are unchanged. The Civil War builder takes the option and passes it, so the refusal has one home.
  - `packages/engine/src/team.ts`: `teamsOf`, `teamOf`, `teamSize` over an optional `GameState.teams`; absent, one
    derived team of every seat. Per-player values read `teamSize` of the card's team, which with one team is
    `startingPlayerCount` (MC56 p. 20: "per player" applies only "to the players on your team").
  - `inCompetitiveMode()` (`Predicate gameMode`). A script writes the printed sentence in full:
    `ifElse(inCompetitiveMode(), <competitive branch>, <cooperative branch>)`. Cooperative behavior is the false
    branch of a real condition, never a script that left the clause out; the plan's task 12 manifest lists every such
    face (the thirteen of its §2.2) so none is dropped silently. Whether a competitive branch is written now or left
    as a named stub is that task's call.
- **Tests** (beyond the plan's own). Neighborhood Hero in a 3-player cooperative game: 2 + 6 = 8 threat. Spectacular!:
  2 threat on the main scheme and nothing else. Drafted with a minion third from the top of the encounter deck: two
  cards discarded, the minion revealed with +2 hit points and the Avenger trait.

### 3.5 "The enemy team" searches, chooses, attaches, exhausts

- **Text.** Iron Man 56059 "The enemy team searches the encounter deck for an Iron Man attachment and your team
  reveals it."; Life Model Decoy 56084 "The enemy team attaches this card to a minion or their leader."; Colleen Wing
  56112 "Choose an ally you control (the enemy team chooses instead if you have the Unregistered trait)."; Daredevil
  56189 "The enemy team exhausts a character you control."; Resistance Fighter 56191 "Attach to a minion of the enemy
  team's choice."; Secret Avengers 56159 "The enemy team searches the top 5 cards of the encounter deck for a card.";
  S.H.I.E.L.D. Recruits 56096b "The enemy team searches the encounter deck for 1[per_hero] minions and deals one to
  each player on your team as a facedown encounter card."
- **Rules.** MC56 p. 6: "Any rule or ability that refers to 'the enemy team' refers to the players. Resolve these
  abilities using the grim rule: Imagine what an opponent would do if it were their choice." RRG "The Grim Rule"
  (p. 4); RRG "First Player" (p. 19) for a choice the group makes.
- **Exists.** Every choosing effect takes a `chooser: PlayerRef` (`firstPlayer`, `controller`, `you`); an encounter
  card's group choice is `chooser: firstPlayer` with `firstPlayerTargets` authority.
- **Missing.** A chooser that means "the team opposing the resolving player", and a mark on the choice that it is
  made for the other side.
- **Shape.** Owned by the plan's §4 task 7: `"enemyTeam"` in `DecisionAuthority` (`choices.ts`) and
  `enemyTeamDecider(state, context)`, which with one team is the first player and with two a seat of the other
  team; the prompt line is "Choose as the enemy team would." The authority is on the pending choice and in the log,
  so the client can label it, and question 6's answer (who really decides in a cooperative game) changes that one
  function, not the scripts. A search "the enemy team" makes is an ordinary search with that authority. Where there
  is one candidate there is no prompt (Energy Channel, Cap's Shield, Finesse, a copy of Life Model Decoy). "Your team
  reveals it" (56059) is the resolving player's reveal.
- **Tests.** Iron Man I's Setup with five attachments in the deck: one choice with the `enemyTeam` authority, made by
  the first player; the chosen card is revealed (the first player reveals at setup) and attaches. Colleen Wing
  against a player without Unregistered: that player chooses, ordinary authority; with it: the `enemyTeam`
  authority. Daredevil with a ready hero and a ready ally: the choice offers both.

### 3.6 "Your leader", "the enemy leader", "your team" as references

- **Text.** Venom 56087 "Venom attacks your leader. Otherwise, Venom activates against you."; Bullseye 56088 "The
  enemy team discards an attachment from your leader. Otherwise, discard an upgrade you control."; Excessive Force
  56090 boost "The enemy leader attacks your leader (after this activation)."; Tangled Up 56181 "Attach to your
  leader. Otherwise, attach to your hero."; Luke Cage 56184 "Stun your leader. Otherwise, you are stunned."; Darkforce
  56196 "remove an equal amount of threat from your leader's main scheme. Discard this card."; every stage 1B "If
  there is more than 1 player on your team".
- **Rules.** MC56 p. 6: "The leader in play is called 'the enemy leader.'"; "A card ability that refers to 'your
  leader' cannot be resolved. These cards typically have alternate effects that will resolve instead. Do as much as
  you can." RRG "Leader" (p. 26). Jul 9, 2026 R3.
- **Exists.** `AttachmentHost { kind: "leader", of }` with the cooperative reading in `attachment-hosts.ts` (enemy =
  the villain; yours = no host, so `ifAble` falls to its `otherwise`). "The enemy leader" in effect text is
  `theVillain`. `playerOrElse`, `ifThen` and `choiceFoundNothing` give "Otherwise" for effects.
- **Missing.** "Your leader" as a target of an effect (attack it, stun it, discard from it), and "your team" as a
  count.
- **Shape.** Owned by the plan's §4 tasks 4 and 5: `enemyLeaderOf` / `yourLeaderOf` in `team.ts` (the second is null
  with one team), `TargetRef { kind: "leader", of: "yours" | "enemy" }` and `PlayerRef { kind: "team", of }`, DSL
  `enemyLeader`, `yourLeader`, `yourTeam`, `enemyTeam`; `attachment-hosts.ts` moves onto the same readers. An effect
  whose target names nothing does nothing, which is what "Otherwise" reads (`ifElse(exists(yourLeader), …, …)`). One
  thing this pass adds to that list: a value for "more than 1 player on your team", the `teamSize` of the resolving
  player's team as a `ValueSpec` (a count of `yourTeam` if that ref can be counted; the engine agent for the plan's
  task 5 reports which).
- **In a cooperative game, card by card** (§7 repeats this per row): Venom activates against you; Bullseye discards
  an upgrade you control; Iron Fist 56190 activates against you; Luke Cage stuns you, Jessica Jones confuses you;
  Tangled Up attaches to your identity; the boosts of Excessive Force 56090 and Iron Fist 56190 do nothing; Darkforce
  is question 11.
- **Tests.** Venom revealed against a hero with 2 DEF and a tough card: he activates (attack: piercing discards the
  tough card, 3 − 2 = 1 damage). Luke Cage's boost: the defending player is stunned. The two-team cases are the
  plan's own tests (`twoTeamState()`).

### 3.7 A leader as a villain

- **Rule.** RRG "Leader" (p. 26); MC56 p. 3: "The only difference between leaders and villains is that players can
  team up with their chosen leader in competitive play."
- **Exists.** `VillainCard.printedType: "leader"`; `Scenario.villainStages` ranges; `villainStartStageIndex` /
  `villainLastStageIndex`; a first stage's `setup` ability.
- **Does a leader need anything a villain does not?** In a cooperative game, no. Three things to prove rather than
  build: a stage range of [3, 4] (every earlier scenario starts at stage 1 or 2); "Setup" on stage III (it is the
  first stage in expert mode, so its Setup resolves; stage III reached by advancing is impossible, III never follows
  II); and a card that names "a leader" (Energy Channel 56098 "After a leader, hero, or ally attacks Captain Marvel":
  no leader attacks her with one team, so the category matches nothing).
- **Tests.** Captain America, expert: stage III in play with 18 hit points per player, Cap's Shield attached, one
  tough card, and the Expert set in the deck. Defeating III reveals IV (Steady; "Deal each player an encounter card.
  Captain America cannot take damage this phase."): a 5-damage attack later that phase deals 0.

### 3.8 The unique rule on an encounter card entering play

- **Text.** Captain Marvel's Helmet 56099 (unique attachment) against the unique upgrade Captain Marvel's Helmet
  01016; the unique minions Maria Hill 56083, Hercules 56151, Luke Cage 56184, Jessica Jones 56185, Daredevil 56189,
  Shang-Chi 56113; the upgrade Captain America 53023 against the leader.
- **Rule.** RRG "Unique Icon" (pp. 45–46): "A non-villain card in an out-of-play state that matches a card in play
  cannot enter play … A non-villain encounter card, it is discarded and any effects of it entering play are ignored.
  If it was being revealed, any effects of it being revealed are ignored and the player revealing it is dealt a
  facedown encounter card." MC56 p. 20's answer ("It does not matter if the enemy leader or a minion shares the same
  card title as a character you control") is asked and answered "in competitive mode", so a cooperative game follows
  the RRG.
- **Exists, and more than the brief assumed.** The reveal branch is built: `reveal.ts` stage `uniqueCheck` discards
  the card, cancels its reveal and deals a facedown card (`dealEncounterCardOrAnnounce(…, "uniqueRule")`), and
  `admitUniqueEntry` (`resolve/apply-effect.ts`) covers "put into play". `cardsMatch` is the RRG predicate.
- **Missing.** `checksUnique` in `reveal.ts` is `minion | side_scheme | environment`: **a revealed unique attachment
  is not checked** and attaches beside its match. Unverified paths: a boost ability's "Reveal this card" (56099), an
  attachment found and revealed by a setup search (Iron Man's is not unique; Captain Marvel's helmet is not searched
  for), a minion dealt facedown then revealed, and Teamwork not firing for a card that never entered.
- **Which cards really match** (by script over the raw cache, RRG predicate): a hero-named minion with no subtitle
  matches a card of the same title only if that card has no subtitle and no alter-ego title, or carries the name as
  its subtitle or alter-ego title. So:

  | Encounter card                                                                                                                 | Matches                                                                              | Does not match                        |
  | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------- |
  | Maria Hill 56083                                                                                                               | the allies 01067 and 50036; the Maria Hill identity 50001 (alter-ego title)          |                                       |
  | Hercules 56151                                                                                                                 | the ally 06011; the Hercules identity 59001 (alter-ego title)                        |                                       |
  | Luke Cage 56184                                                                                                                | the allies 01076 and 61003; the Luke Cage identity 62001                             |                                       |
  | Jessica Jones 56185                                                                                                            | the allies 01059 and 62002; the Jessica Jones identity 61001                         |                                       |
  | Daredevil 56189                                                                                                                | the ally 31014 (no subtitle)                                                         | Daredevil / Matt Murdock 60001, 01058 |
  | Shang-Chi 56113                                                                                                                | the ally 10098                                                                       |                                       |
  | Helmet 56099                                                                                                                   | the upgrade 01016                                                                    |                                       |
  | Captain America leader                                                                                                         | the upgrade Captain America 53023 cannot be played while he is in play               | every Steve Rogers card               |
  | Wasp, Falcon, Venom, Spider-Man, Black Panther, Hellcat, Goliath, U.S. Agent, Spectrum, Iron Fist, Cloak, Dagger, Yellowjacket | nothing: every same-titled ally has a subtitle and every identity an alter-ego title |                                       |

  A leader entering play is exempt (it is a villain), and a leader in play still blocks (the Ronan ruling the module
  cites). The table option `sameNameHeroAllyConflict` is about an identity and an ally and does not reach minions.

- **Shape.** `checksUnique` covers every non-villain encounter card type that enters play by being revealed
  (attachment added; an obligation or treachery never enters play this way). The check for an attachment runs before
  it attaches, so `cardAttached` is never announced. One audit test walks every route an encounter card takes into
  play (reveal, boost reveal, `putIntoPlay`, `dealAsEncounterCard` then reveal, `searchAndReveal`) with a matching
  card in play.
- **Tests.** Captain Marvel hero with her Helmet 01016 in play reveals 56099: discarded, not attached, the leader
  does not gain stalwart, she is dealt one facedown encounter card, log `uniqueEntryBlocked`. The reverse: 56099
  attached, playing 01016 is refused with the unique message. Luke Cage ally 01076 in play, Luke Cage 56184 revealed:
  nobody is stunned, one facedown card dealt. Wasp hero 13001 in play, Wasp 56074 revealed: enters play, 1 threat on
  the main scheme. Hercules 56151 put into play by Superhero Jailbreak 56202b while the ally 06011 is out: discarded,
  no facedown card (it was not being revealed).

### 3.9 Teamwork (Trait)

- **Text.** Wasp 56074, Falcon 56150, Hercules 56151, Goliath 56152, Black Panther 56155, Spectrum 56156: "Teamwork
  (Avenger)."
- **Rule.** RRG p. 43 (§0); FAQ, Fabian Cortez (p. 63): a minion that left play before the keyword checks is not
  counted. MC56 p. 9's example: Falcon engages Emily while Spider-Man (Avenger) is engaged with Jason, so Falcon
  activates against Emily.
- **Exists.** Wave 6 §3.1: the keyword in `content/src/schema/keywords.ts`, the engine-internal `EffectSpec
  resolveTeamwork`, resolved in `reveal.ts` once the reveal's steps are done (the `keywords` stage): after the minion's
  When Revealed, with quickstrike, the first player choosing which goes first when a minion has both (§4.0, 30B, 34B).
- **To prove here.** The trait may be gained (Drafted 56080 gives Avenger to any minion); the keyword may be gained
  (Earth's Mightiest Heroes 56077, §3.12, and then only matters for a minion entering play afterwards); the minion
  activates (attack or scheme by the player's form), and the engaged player is the one it entered engaged with.
- **Tests.** Spider-Man 56180 engaged with player 2; player 1 in hero form reveals Falcon: Falcon attacks player 1
  for 2. No other Avenger in play: no activation. A non-Avenger minion with Drafted in play: Falcon activates.

### 3.10 A defeated minion given to the enemy as a facedown boost card

- **Text.** Falcon 56150 (and 56151, 56152, 56155, 56156) "When Defeated: Give this card to the enemy leader as a
  facedown boost card."; Dangerous Recruits 56091 "Forced Interrupt: When a minion is defeated, give it to the enemy
  leader as a facedown boost card."
- **Rule.** RRG "Boost, Boost Icon" (p. 11): a boost card given outside an activation stays facedown and is turned
  up at the enemy's next activation, in addition to the one it is dealt; "When Defeated Abilities" (p. 48): "A
  defeated card leaves play after its 'When Defeated' ability is resolved."
- **Exists.** `giveBoostCard(theVillain, { card })` (wave 6 §3.16), but "only a card out of play is given"; `EffectSpec
  setDefeatDestination` and `replaceLeaveDestination` send a leaving card somewhere else.
- **Missing.** The destination "an enemy's boost cards".
- **Shape.** A leave destination `{ kind: "boostCardOf", enemy: TargetRef }` for `setDefeatDestination` /
  `replaceLeaveDestination`: the card leaves play as defeated (its attachments are discarded, "after … is defeated"
  responses see a defeat), goes facedown to that enemy and is announced as `boostCardGiven`. A card with Victory
  goes to the victory display first (RRG "Victory X") only if a ruling ever says so; none does and no minion here has
  Victory. With both Falcon's own When Defeated and Dangerous Recruits in play the card is given once.
- **Tests.** Falcon defeated: Captain America holds one facedown boost card, Falcon is in neither discard pile. His
  next attack turns up two cards: Falcon's (0 icons, boost ability "You are confused") and the dealt one. Dangerous
  Recruits in play and a Hydra Soldier defeated: Iron Man holds it. Dangerous Recruits defeated first: the next
  minion goes to the discard pile.

### 3.11 "Resolve the 'Boost' ability of each minion"

- **Text.** Freedom Fighters 56153 / 56157: "When Revealed: Resolve the 'Boost' ability of each minion in play. If no
  'Boost' abilities were resolved this way, this card gains surge. [star] Boost: Resolve the 'Boost' ability of each
  minion engaged with you."
- **Rule.** None beyond the card. RRG "Boost, Boost Icon" (p. 11) defines a boost ability only for a card turned up
  as a boost card.
- **Exists.** The family `resolveWhenRevealedOf`, `resolveWhenDefeatedOf`, `resolveForcedResponseOf`,
  `resolvePreparationsOf` (all `EffectSpec resolveSpecials` with a label), each with `bind` and `<bind>.count`.
  Searches that found nothing: `resolveBoostAbility`, `boostAbilityOf`.
- **Shape.** `resolveBoostAbilitiesOf(ref, { bind })`: the same effect with the label `boost`. The resolving player
  is "you" (the revealing player, or the player the activation is against); the source card is the minion, in play,
  so "this card" is the minion. Inside an activation, "the activating enemy" still names the activating enemy.
  What the borrowed sentences do when the minion is not a boost card ("this card gains [boost][boost]", "Reveal this
  card", "Put this minion into play engaged with you") is question 10; a card in play asked to reveal itself follows
  wave 9 §3.63.
- **Tests.** Falcon and Black Panther in play, Freedom Fighters revealed by a player with two ready upgrades: that
  player is confused and both upgrades exhaust; `count` 2; no surge. No minion in play: surge. Namor only (no boost
  ability): surge. As a boost card with Hercules engaged with the defender: the defender is stunned.

- **Question 10 (owner: A, B kept as a switch).** The effect carries a named option for what a borrowed ability's
  "this card gains [boost]" does: nothing (A, the default and what the Freedom Fighters scripts pass) or added to the
  activation the resolving card is boosting (B). Both are implemented and tested; see §4.0.

### 3.12 "Gains the printed keywords of each other [trait] minion"

- **Text.** Earth's Mightiest Heroes 56077: "Each Avenger minion gains the printed keywords of each other Avenger
  minion."
- **Exists.** `gainsTraitsOf(traitsOf, target)` (wave 2 §3.11), `gainsKeyword`, `gainsKeywordX`. Search that found
  nothing: `printedKeywords`, `keywordsOf`.
- **Shape.** `gainsKeywordsOf(keywordsOf: TargetQuery, target: TargetQuery, { excludeSelf: true })`: for each target,
  every keyword **printed** on each other matching card, so grants never chain. A keyword with a value or a
  parameter is gained as printed (Retaliate 1, Teamwork (Avenger)); two sources of one valued keyword add as two
  instances of it always do (RRG "Retaliate X"). Keywords that act when a card enters play (Toughness, Quickstrike,
  Teamwork) do nothing for a minion already in play.
- **Tests.** U.S. Agent (Retaliate 1, Toughness) and Doc Samson (Guard) in play with the scheme: Doc Samson has
  retaliate 1 and U.S. Agent has guard; Doc Samson gets no tough card. Hellcat revealed afterwards: she enters with a
  tough card, guard and retaliate 1, and makes her own quickstrike attack. A minion with Drafted (the Avenger trait)
  gains them too. The scheme defeated: all gone.

### 3.13 Hinder a main scheme stage gains under a condition

- **Text.** Every stage 1B: "If there is more than 1 player on your team, this stage gains hinder 2[per_hero]." (the
  icon per §1.2).
- **Rule.** MC56 p. 9, "Hinder X": "When a card with hinder X enters play, place X threat on that card."
- **Exists.** `keywordTotal(…, "hinder")` with `perPlayer` (`keywords.ts`), `placeHinder` (`resolve/enter-play.ts`),
  which leaves a scheme "to its own entry"; side schemes place hinder with their starting threat. A conditional
  grant is `gainsKeywordX(…, { while })`.
- **Missing, or unproven.** Hinder on a main scheme stage as it is revealed (at setup and on an advance), read from a
  gained keyword.
- **Shape.** The main scheme stage's entry (`mainSchemeTurnsToB`) places `keywordTotal(hinder)` after its starting
  threat, counting gained keywords. No card-specific code.
- **Tests.** One player: Cut Off Support opens with 0 threat. Three players: 0 + 2 × 3 = 6 threat, target 21. A
  stage 2B has no hinder. (If the scans show a flat "hinder 2", the three-player number is 2; the test reads the
  data.)

### 3.14 A forced trigger limited "once per phase per player"

- **Text.** Cut Off Support 56063b and Open Rebellion 56172b: "Forced Interrupt: When a player reveals a treachery,
  place 1 threat here. (Limit once per phase per player.)"
- **Exists.** `AbilityLimit { count, period: "phase", per: "player" }`, keyed "by the ability's controller — for an
  encounter card's action, the player who triggers it" (wave 3 §3.36). A main scheme's forced interrupt has no
  controller.
- **Shape.** `per: "eventPlayer"`: the count is kept for the player the triggering event names (here the revealing
  player).
- **Tests.** Two players each reveal two treacheries in one villain phase: 2 threat, not 4. A treachery revealed in
  the player phase (a surge from a card effect) by a player who also revealed one in the villain phase: 1 more.
  A treachery cancelled before it is revealed places none; one whose When Revealed is cancelled still places 1 (it
  was revealed).

### 3.15 Defeated allies facedown under the main scheme

- **Text.** Negative Zone Prison 56064b: "Reduce the target threat value of this scheme by 1 for each facedown card
  under it. Forced Response: After an ally is defeated by an enemy attack, place that ally facedown under this
  scheme."
- **Exists.** `tuckCards` and `tuckedCount` (wave 9 §3.20, an ally tucked under a scheme), `SchemeValueName
  targetThreat` modifiers, `characterDefeated` with the attack as its cause, `replaceLeaveDestination`.
- **To prove.** The ally is tucked instead of discarded although the trigger says "after"; the scheme completes at
  once when the lowered target meets the threat on it (a state check, not only when threat is placed); the tucked
  cards leave with the stage.
- **Tests.** One player, 7 threat on the stage (target 9): one ally defeated by the leader's attack → target 8;
  a second → target 7, and the players lose at once. An ally defeated by a treachery's damage or by consequential
  damage is discarded as usual.

### 3.16 Unregistered

- **Text.** Unregistered Super 56106 / 56114 (obligation): "Your identity gains the Unregistered trait. Alter-Ego
  Action: Discard an identity-specific card from your hand → discard this card."; Government Contractor 56120 "Each
  identity gains the Unregistered trait."; Hunting Rebel Heroes 56097b "Each hero gains the Unregistered trait. Forced
  Response: After another card is revealed that gives 1 or more heroes the Unregistered trait, deal 2 damage to each
  of those heroes."; Cape-Killer 56105 "+2 ATK" against an Unregistered identity; Bring Them In 56107 "Exhaust each
  Unregistered identity. Otherwise, …"; "at random if you have the Unregistered trait" (56115, 56117, 56119).
- **Exists.** An obligation that stays in play in a player's area (Paparazzi, wave 6); `gainsTrait(t, target, {
  while })`; `youHaveTrait`; `discardAtRandom`; the identity-specific card selector (`spec.ts`, "Identity-Specific
  Card", RRG p. 23); `cardRevealed`.
- **Missing.** The trigger "a card is revealed that gives heroes a trait": nothing lets one card ask what another
  card's text grants.
- **Shape.** `EventPattern cardRevealed` gains `grantsTrait: Trait`: true when the revealed card carries a constant
  trait grant of that trait (read from its `traitGrants`, the data the engine already evaluates), and the event
  exposes `grantedTo`, the characters that grant reaches once the card is in play. Which heroes "those heroes" are
  when they already had the trait is question 12. The obligation's action is offered only in alter-ego form and only
  with an identity-specific card in hand.
- **Tests.** Unregistered Super dealt and revealed: it stays in the player's area, the identity has the trait, the
  acceleration icon adds 1 to step one. Cape-Killer attacks that hero: 2 + 2 = 4 ATK. In alter-ego with one
  identity-specific card in hand: the action discards both. Hunting Rebel Heroes in play, Government Contractor
  revealed in a 2-player game with both in hero form: 2 damage to each hero (question 12 = A).

### 3.17 "Uses their ATK to attack and damage"

- **Text.** Cap's Shield 56143: "Forced Response: After a hero or the Captain America leader uses their ATK to attack
  and damage attached character, attach Cap's Shield to the attacker."
- **Rule.** Dec 17, 2025 R2 answer 3 (flat-damage attack abilities do not count; "damage … equal to your ATK"
  does); Jan 11, 2026 R1 and R2 (overkill damage from such an attack counts, although the leader was not the target).
- **Exists.** `basicPowerUsed { stat }`; attack events with damage and excess (`<bind>.excessDealt`); `statOf` as a
  value. Searches that found nothing: `usedAtk`, `attackStat`, `usesAtk`.
- **Shape.** An attack in progress records `usedStat: "atk" | null`: set for a basic attack and for an attack whose
  damage value read the attacker's ATK (the DSL marks it when an attack's amount is built from `statOf(attacker,
  "atk")`), and for every enemy attack. `Predicate attackUsedAtk`. The trigger is "damage from an attack with
  `usedStat: atk` was dealt to the attached character", target or overkill.
- **Tests.** Hero basic attack (2 ATK) on Captain America with the Shield and no tough card: 2 damage, retaliate 1
  hits the hero, the Shield moves to the hero. A 4-damage flat attack event: the Shield stays. An event dealing
  "damage equal to your ATK": it moves. A basic attack with overkill that defeats a 1-hit-point minion with 2 ATK
  left over: 2 damage to Captain America and the Shield moves. A tough card absorbs the damage: no damage, no move.

### 3.18 "Attacks against them lose piercing"

- **Text.** Cap's Shield 56143: "Attached character gains retaliate 1 and attacks against them lose piercing."
- **Exists.** `RuleSpec attackKeywords` / `attacksGainKeywords` (attacker-scoped gains), `thatAttackGainsKeywords`.
  No loss.
- **Shape.** `attacksLoseKeywords(keywords, { target: TargetQuery })`: while it applies, an attack whose target
  matches does not have the keyword, whatever gave it (a loss beats a gain, as `losesKeyword` does for card
  keywords). Read where piercing is applied, before damage.
- **Tests.** The Shield on a hero with a tough card, Venom 56087 attacks (his attacks gain piercing): the tough card
  stays and absorbs the attack. The same on Captain America: a hero's piercing attack does not strip his tough card.

### 3.19 A permanent attachment whose host leaves play

- **Text.** Cap's Shield 56143 "Permanent. Attach to Captain America."; MC56 p. 20: "Cap's Shield attaches to the
  Captain America leader. When an attachment with the permanent keyword becomes unattached, resolve its 'attach to'
  text."
- **Rule.** MC56 p. 9, "Permanent": "cannot be defeated, leave play, or have any part of its text box blanked".
- **Exists.** Permanent as `cannotLeavePlay`; `RuleSpec cannotBeUnattached`; a permanent **player** attachment whose
  host leaves is "unattached" and stays (`spec.ts`, wave 5). Nothing re-resolves an "attach to".
- **Shape.** A general rule in the host-leaving path: a permanent encounter attachment whose host leaves play (or is
  eliminated) resolves its printed attach instruction again, announcing `cardAttached` (so Captain America gets his
  tough card). The same path serves Energy Channel and Finesse, whose host never leaves in a cooperative game.
- **Tests.** The Shield on player 1's hero in a 2-player game; player 1 is defeated: the Shield attaches to Captain
  America and he gains a tough card. The Shield on Captain America when stage I is defeated: it stays on him through
  the stage change (the villain does not leave play) and no tough card is given.

### 3.20 An enemy attacks the character that just attacked it

- **Text.** Energy Channel 56098, as errata'd (RRG p. 70): "Forced Response: After a leader, hero, or ally attacks
  Captain Marvel, place 1 energy counter here. Then, if there are at least 4 energy counters here, remove all of them
  and Captain Marvel attacks that character. This attack gains overkill."
- **Rule.** Jan 26, 2026 R5; Jun 2, 2026 R4; MC56 p. 20 (a leader's attack also triggers it; competitive only).
- **Exists.** `enemyAttack` against a chosen character (wave 9 §3.13, `attack-chosen-character.test.ts`),
  `thatAttackGainsKeywords`, `characterAttacked`, counters. The engine already resolves an attack whose target is
  gone as no attack.
- **To prove.** "Attacks" is the attack being made, damage or not; the fourth counter empties the card even when the
  attacker has left play; an ally can be the target, with overkill carrying to its controller's identity; the
  leader's "attacks and defeats a character" response then fires once per character defeated (Jan 11, 2026 R1).
- **Tests.** Three counters, an ally with 1 hit point left attacks: 4 counters → 0, Captain Marvel (2 ATK) attacks the
  ally with a boost card, 1 defeats it and the excess goes to the hero; 1 counter is placed for the ally defeated.
  Three counters, an ally attacks and dies to its own consequential damage: 0 counters, no attack, no boost card.

### 3.21 "Would scheme, thwart, or attack, discard this card instead"

- **Text.** Tangled Up 56181: "Attach to your leader. Otherwise, attach to your hero. Forced Interrupt: When attached
  character would scheme, thwart, or attack, discard this card instead."
- **Rule.** RRG "'Would'" (p. 48): the interrupt replaces the event, which then never happened.
- **Exists.** `would` interrupts on `enemyAttack` / `enemyScheme`; `basicPowerUsing` (the interrupt twin of a basic
  power use) and `instead`. Searches that found nothing: `wouldThwart`, `heroWouldAttack`.
- **Missing.** One "would" point for a player character's attack or thwart however it is made (a basic power or an
  attack- or thwart-labeled ability), before any of its effects.
- **Shape.** `EventPattern characterWouldAct { act: "attack" | "thwart", character }`, announced by the basic power
  path and by every attack- or thwart-labeled ability as it begins resolving, after costs are paid (the hero is
  exhausted or the event paid for and discarded; RRG "Cost", p. 13: a paid cost is not refunded). `instead` cancels
  the whole use. In a cooperative game the host is always a hero, so "scheme" is never read; it is scripted for
  completeness through the same pattern on `enemyScheme`.
- **Tests.** Tangled Up on a hero: a basic attack exhausts the hero, deals 0, discards Tangled Up; the next attack
  works. A 2-cost attack event: the event is paid and discarded, nothing is dealt. Basic defense and recovery are
  untouched. Spider-Man 56180 revealed with Tangled Up on one hero: he attacks that hero for 2; with none in play, a
  copy is found and dealt to the revealing player facedown.

### 3.22 Rulings, FAQ answers and errata on behavior the engine already covers

Each is a test the QA agent writes against existing behavior; a failure becomes an extend.

- **A defeated side scheme is in play until its When Defeated resolves** (Jan 11, 2026 R1; RRG p. 48): Fearless
  Determination's amplify icon adds 1 boost icon to the boost card of the activation its own When Defeated causes.
- **"Attacks and defeats a character" once per character** (Jan 11, 2026 R1 and R2): Captain Marvel with overkill
  defeats an ally and then the identity: 2 energy counters.
- **Energy Channel's erratum** (RRG p. 70): scripted from the corrected text; the data's `current` text carries it.
- **Yellowjacket** (RRG p. 70): the minion 56073 and the ally 56019 are titled "Yellowjacket". They do not match
  under the unique rule either way (the ally has the subtitle Hank Pym).
- **Leader stage II revealed in the villain phase** (MC56 p. 20): "dealing a facedown encounter card to each player …
  Their leader cannot take any more damage until the end of the villain phase." The same sentence in a cooperative
  game: the lasting effect ends with the phase it began in.

### 3.23 Reusable as is (checked by name against the engine unions and the DSL)

No engine change; the name is what the scripting agent composes. "(verify)" marks one found by name whose behavior
for this card has not been run.

| Printed text (card)                                                                                                                                                 | Existing vocabulary                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "find the chosen leader's side scheme and reveal it" (1A)                                                                                                           | `revealCard(find(query side scheme, inEncounterSet(encounterSetOf(theVillain))))` (verify) |
| "+1 SCH for each Tech attachment on him (to a maximum of +3 SCH)" (56059–56062)                                                                                     | `gets` with `min(countOf(attachments with trait), 3)`                                      |
| "Deal each player an encounter card. X cannot take damage this phase." (stages II, IV)                                                                              | `forEachPlayer(dealEncounterCard)`, `applyRuleUntil(cannotTakeDamage, endOfPhase)`         |
| "Hero Response: After you make a basic attack against X, spend … → discard this card"                                                                               | `heroResponse` on `basicPowerUsed`, `spend` / `spendSameType`                              |
| "[star] Boost: Reveal this card." (56065, 56066, 56069, 56099, 56100, 56144, 56145, 56175)                                                                          | `revealInstead` / `revealCard(self)` from a boost                                          |
| "When Iron Man would take any amount of damage, place it here instead … at least 5" (56069)                                                                         | wave 9 §3.25 (damage onto the attachment), `damagedAtLeast` (verify)                       |
| "would take more than 3 damage from an attack, reduce that amount to 3" (56100)                                                                                     | `maxDamageTaken` (`RuleSpec maxDamageTakenPerAttack`), then `discard(self)` (verify)       |
| "reduce the amount of damage she takes by 1 for each skill counter" (56179)                                                                                         | `reducesAttackDamageTaken` with `countersOn`                                               |
| "gains stalwart / retaliate 1 / the Aerial trait / attacks gain ranged"                                                                                             | `gainsKeyword`, `gainsKeywordX`, `gainsTrait`, `attacksGainKeywords`                       |
| "Discard the top 4 cards of your deck. For each printed [energy] and [wild] …" (56070)                                                                              | `discardDeckUntil` family, `cardDiscardedFromDeck`, resource count values                  |
| "Resolve the 'When Revealed' ability of each minion in play. If no …, surge" (56076, 56081)                                                                         | `resolveWhenRevealedOf(each(minion), { bind })`, `<bind>.count` (wave 4 §3.56)             |
| "You are confused. If you were already confused, …" (56078, 56079, 56150–56152 boosts)                                                                              | the status read before the effect's own `confuse` (as False Alarm, Monster)                |
| "discard cards from the encounter deck until a minion is discarded. Reveal that minion and attach" (56080)                                                          | `discardEncounterUntil`, `revealCard`, `attachCard` (verify the order)                     |
| "Shuffle each [Avenger] minion in the encounter discard pile into the encounter deck" (56082, 56154)                                                                | `moveCards`, `shuffleEncounterDeck`                                                        |
| "searches the encounter deck and discard pile for a copy of X and attaches it / deals it"                                                                           | `findCard`, `oneCopyOf`, `attachCard`, `dealAsEncounterCard`                               |
| "Limit 1 per character"; "prevent that damage and discard this card instead" (56084)                                                                                | `cannotAttach`, `forcedInterrupt` with `would` and `preventDamage`                         |
| "Place 2 threat on each scheme" (56085, 56102); "for each minion in play" (56090)                                                                                   | `placeThreat` over `each`, `countOf`                                                       |
| "this card gains [boost][boost][boost]" (56085, 56027); "gains [boost] for each …" (56178)                                                                          | `adjustBoostCount`                                                                         |
| "The player who defeated this scheme deals 1 damage to each character they control and each minion engaged with them" (56086)                                       | `defeatingPlayer`, `dealDamage` over `each`                                                |
| "Each minion activates against the player it is engaged with. Otherwise, the enemy leader activates against you. Do not give it a boost card" (56089, 56187, 56192) | `enemyActivates` with `noBoost`, `engagedPlayerOf`                                         |
| "deals the topmost [S.H.I.E.L.D.] minion in the encounter discard pile to themself" (56108); "Put the topmost … into play engaged with you" (56109)                 | the encounter-topmost selector, `dealAsEncounterCard`, `putIntoPlay`                       |
| "[star] Boost: Put this minion into play engaged with you." (56109)                                                                                                 | a boost card that enters play (Core's pattern)                                             |
| "threat … equal to that minion's SCH / damage … equal to that minion's ATK" (56110)                                                                                 | `discardEncounterUntil` with a bind, `printedStatOf`                                       |
| "Each minion gains guard" (56111, 56121b, 56188, 56199b); "The enemy leader gains steady" (56200b)                                                                  | `gainsKeyword` (wave 9 §3.33)                                                              |
| "Each [Criminal / Atlantis] minion cannot take damage" (56164)                                                                                                      | `rule cannotTakeDamage`                                                                    |
| "Place 1 threat on the main scheme for each resource icon on that card" (56115, 56119)                                                                              | `discardFromHand` with a bind, `totalPrintedResources`                                     |
| "this attack gains ranged and overkill. Discard this card after this attack" (56118, 56145)                                                                         | `thatAttackGainsKeywords`, `atEndOfAttack`                                                 |
| "Attach to Paladin. Otherwise, attach to the enemy leader" (56118, 56161, 56162)                                                                                    | `attachInstruction` with `ifAble`                                                          |
| "Allies enter play exhausted" (56124b)                                                                                                                              | `entersPlayExhausted`                                                                      |
| "+1 ATK while attacking (+2 ATK instead if the attack is undefended)" (56142b)                                                                                      | `modifyAttack` read at damage with the `undefended` result (verify)                        |
| "After a status card is placed on the enemy leader, place 1 threat here" (56201b)                                                                                   | `statusPlaced`                                                                             |
| "After resolving step 1 of the villain phase, each player discards …" (56122b, 56202b)                                                                              | `villainStepResolved("placeThreat")`, `discardEncounterCards`, `putIntoPlay`               |
| "searches … for 1[per_hero] minions and deals one to each player" (56096b, 56141b, 56123b, 56173b)                                                                  | `chooseCards` (count `perHero`, chooser §3.5), `dealAsEncounterCard` per player            |
| "After Cap's Shield is attached to Captain America, give him a tough status card"                                                                                   | `cardAttached`                                                                             |
| "give him a tough status card and a facedown boost card" (56146)                                                                                                    | `giveTough`, `giveBoostCard(theVillain)`                                                   |
| "If this attack damages a character, stun that character" (56148)                                                                                                   | `enemyAttack` with a bind, `<bind>.damage`                                                 |
| "He activates against the player who defeated this scheme" (56149)                                                                                                  | `enemyActivates(theVillain, defeatingPlayer)`                                              |
| "Max 3 skill counters here" (56174); "+1 ATK for each skill counter … Remove each" (56168)                                                                          | `counterLimit`, `modifyAttack`, `removeAllCountersFrom`, a var for the number removed      |
| "If this attack removed the following skill counters …" (56177)                                                                                                     | the var above, `thatAttackGainsKeywords` (compose; verify the order)                       |
| "When Spider-Woman would be stunned or confused, discard this card instead. Give her a tough status card" (56175)                                                   | `statusBeingGiven` with `instead` (verify)                                                 |
| "Discard the highest-cost card you control" (56178)                                                                                                                 | `superlative` over printed cost                                                            |
| "Stalwart. Toughness. Villainous." (56160); "give it a tough status card" when it schemes (56162)                                                                   | keywords; `forcedInterrupt` on `enemyScheme`                                               |
| "Give the activating enemy an additional boost card" (56163)                                                                                                        | `activatingEnemy`, `modifyAttack({ extraBoostCards })`                                     |
| "Discard the top 3 cards of your deck … for each different card type discarded" (56166, 56167)                                                                      | `distinctCardTypes`, `addAccelerationToken` on a side scheme                               |
| "Threat cannot be removed from this scheme while a Defender minion is in play" (56193)                                                                              | `rule threatCannotBeRemoved` with `while`                                                  |
| "Give the enemy leader and each minion a tough status card. If the enemy leader was already tough, surge" (56186)                                                   | `giveTough` over `each`, the status read first                                             |
| "Heal 2 damage from the enemy leader. Deal 2 damage to a character you control" (56195, 56197, 56198)                                                               | `heal(theVillain)`, `chooseTarget`, `dealIndirectDamage`                                   |
| "If Dagger is in play, reveal Cloak" (56194, 56195 boosts)                                                                                                          | `ifThen(exists(named))`, `revealInstead`                                                   |
| "Attached minion gets +4 hit points and gains stalwart" (56191, 56080)                                                                                              | `gets`, `gainsKeyword`, `gainsTrait`                                                       |

## 4. Open questions (for the user or FFG)

### 4.0 The owner's answers of 2026-10-11 (questions 2 to 27)

`2A 3B 4A 5A 6A 7A 9A 10B 11A 12A 13A 14A 15B 16A 17A 18A 19A 20A 21B 22A 23A 24A 25A 26A 27C`. The owner marked the
B answers on 3, 10, 15 and 21 as recommendations to hold until a primary text supports them, and all the A answers as
provisional rather than confirmed rulings. The main session checked the four against the primary texts the same day:

- **3B, built.** The RRG 1.8 FAQ (p. 65, July 2026) is later than the March 6, 2026 – Ruling 3 and says "That Labor
  card is discarded"; the ruling says "place it on the bottom of the Labor deck". Both are honored: the card is
  discarded (anything that answers a discard hears it) and its destination is the bottom of the Labor deck. The ruling
  does not supersede the RRG, which was published after it.
- **15B, built.** RRG "Find" (p. 19): "If a player is instructed to 'find and reveal' a minion that is already in
  play, that player engages that minion". Fantastic Powers 56057 says "Find Super Skrull. Put him into play engaged
  with you", not "find and reveal", so this is the nearest rule applied by analogy, not a ruling on the card: Super
  Skrull moves to engage the revealing player, Fantastic Powers attaches, and he attacks if that player is in hero
  form.
- **21B, built, an interpretation.** Coordinated Effort 58032 says "any player may help pay those costs", the words
  the RRG uses for Alliance (p. 5: "any player may contribute to paying those costs"), and neither limits "costs" to
  resources. Other players may pay any part of the cost their own cards can pay; a part that names the user's own
  card ("exhaust your hero") stays with the user. No ruling names the card.
- **10A, decided (owner, 2026-10-11, after the example was laid out): "10A but keep 10B there so we can easily turn
  it back if we need to."** No primary text supports B: RRG "Boost" (p. 9) adds "the number of boost icons on each
  [boost] card", and a minion in play whose boost ability Freedom Fighters resolves is not a boost card of the
  activation, so icons "this card gains" land on the minion and nothing reads them. **B stays in the code as a
  switch**: §3.11's `resolveBoostAbilitiesOf` takes the choice as one named option (icons a borrowed ability gains
  either do nothing, A, or join the activation the resolving card is boosting, B), the Freedom Fighters scripts pass
  A, and both branches have a test that names question 10, so turning B on is one line in
  `cw/modular/new-avengers.ts`. Still worth a question to FFG.

**Questions 28 and 29 (owner, 2026-10-12).** Both arose after the first batch of answers. Neither is to be labeled an
FFG ruling on these cards: 28A is the stronger rules conclusion, 29B a well-supported interpretation (owner's words).

- **28A.** An "at the end of this attack" effect does not resolve when the attack is cancelled outright: a cancelled
  effect is "not considered to have occurred" (RRG "Cancel", p. 11). An attack that begins and ends early because
  the attacker is defeated is different, and its end-of-attack effects do resolve (January 11, 2026 – Ruling 1, answer
  3, on Armored Defense; the ruling supports the distinction without ruling on cancellation). Built at e28b310b.
- **29B.** Two copies of Cosmic Flight 56100 and one hit of more than 3: she takes 3 and only one copy is discarded;
  the second stays attached. The engine re-evaluates each remaining interrupt's triggering condition after an earlier
  interrupt has changed the pending damage, and does not resolve one whose condition no longer holds: RRG
  "Interrupt" ("If an interrupt changes (via a replacement effect) or cancels an imminent triggering condition,
  further interrupts to the original triggering condition cannot be triggered"), "Replacement Effect" (a replaced
  effect "is no longer considered imminent") and "Then". Being built with the QA fixes; until it lands both copies
  are discarded.

**Answered 2026-10-12** (the owner's ruling on 30, then `31B 32B 33A 34B`), all provisional:

- **30B.** A minion being revealed resolves its When Revealed abilities first, then Quickstrike (RRG 1.8 "Quickstrike",
  p. 36: "the quickstrike keyword resolves after any When Revealed abilities on that minion are resolved"; "Reveal",
  p. 38). This replaces the order of February 28, 2026 – Ruling 1 (Hellcat) and the wave 6 answer to question 2; the
  owner cites FFG's RRG 1.8 announcement ("Quick Notes, Reveal") as the statement that the change is deliberate, which
  is not in the repo. Teamwork moves with it (p. 43, the same sentence). A minion put into play without being
  revealed is unchanged (answer 18A stands). The impact list is `docs/phase7-wave10-q30-impact.md`.
- **31B.** Prince of Power 59017 heals for the excess of the damage **dealt** over the enemy's remaining hit points
  (February 8, 2026 – Ruling 2: 6 dealt to a 3-hit-point minion that takes 1 less, heals 3). The excess overkill spills
  and every other reader of "excess damage" stays on damage taken (RRG 1.8 "Overkill", p. 31; owner decision
  2026-09-25).
- **32B.** A Response or Forced Response to a minion entering play, when the minion is being revealed, waits until the
  reveal has finished: after its When Revealed, Quickstrike and Teamwork (RRG 1.8 "Reveal", p. 38; FAQ #10 "Widow's
  Bite", p. 60).
- **33A.** Toughness on a revealed minion stays where it is: the tough status card is given as the minion enters play,
  before its When Revealed (RRG 1.8 "Toughness", p. 45, is worded as a Forced Response; the owner keeps the built
  order).
- **34B.** A minion with both Quickstrike and Teamwork: the first player chooses which resolves first.

**Answered 2026-10-12, second list** (`35B 36B 37A 38A 39A 40A 41A 42B 43B`; the questions are in the PR's top table):

- **35B.** Every revealed encounter card that enters play, not only a minion, holds the responses to its entering play
  until its reveal has finished (RRG 1.8 "Reveal", p. 38).
- **36B.** Teamwork resolving after a When Revealed that moved the minion activates against the player the minion is
  engaged with as it resolves (RRG 1.8 "Teamwork", p. 43). Quickstrike stays on the player engaged by the reveal.
- **37A.** The first player is asked to order Quickstrike and Teamwork only when both would do something.
- **38A.** A minion put into play without a reveal: the enters-play response window opens before Quickstrike, as before.
- **39A.** The end of a reveal keeps two windows: the held enters-play responses with "after this card is revealed",
  then "after you engage".
- **40A.** Prince of Power 59017 does not count extra damage taken: against an enemy that takes more than is dealt he
  can heal less than overkill spills (RRG 1.8 "Damage", p. 14).
- **41A.** Gilgamesh 59025 cannot be played while the identity cannot be given another confused status card.
- **42B.** Follow Through also triggers when only the damage dealt has excess.
- **43B.** A card that was not in play when a triggering condition occurred does not answer it: All Versus All 59041,
  revealed by Hecate's When Defeated, does not respond to Hecate's defeat.

**Answered 2026-10-13** (`44A 45A`, then `46A 47A 48B 49A 50A 51A 52B 53B 54B`; the questions are in the PR's folded
list):

- **44A.** Ant-Man (Hank Pym) 12011 and Yellowjacket (Hank Pym) 56019 have matching subtitles: under the unique rule
  (RRG 1.8 "Unique Icon", pp. 45-46) they cannot both be in one deck or in play together.
- **45A.** Progression: Wonder Man unlocks by beating Iron Man (`registration-iron-man`), Hercules by beating Captain
  America (`resistance-captain-america`).
- **46A.** Brother vs. Brother 58027: the discard is an additional cost of the attack, not an optional payment. An
  attack on each enemy with a card in hand pays it and includes Grim Reaper; with none he is skipped.
- **47A.** Coordinated Effort 58032: several players may each pay a different part of a cost and combine resources;
  one instruction (take 2 damage, discard 2 cards from one deck) is not split between players. The owner marks this a
  rules-based reading, not an FFG ruling on the card.
- **48B.** Alliance (RRG 1.8 "Alliance", p. 5: players may contribute to paying the card's costs, not only its
  resource cost): a helper may also pay an eligible non-resource part of an alliance card's costs. The wording of each
  cost still decides what may be used; a part that names a specific player's card or deck stays with that player.
- **49A.** Cameo 58031: the search, the discard and the removal are separate instructions; a failed search does not
  cancel the other two. Whether a player may decline an available ally is a separate question (built: compulsory).
- **50A.** Follow Through with only the damage dealt in excess (42B): the excess dealt goes up by 1 (Prince of Power
  59017 heals 1 more); no excess is taken, so nothing more spills as overkill. A rules-based reading.
- **51A.** Battlefield Benevolence 58016: the heal is before the cost arrow and must be paid in full; an enemy with
  less than 2 damage cannot be chosen.
- **52B.** Everywhere All at Once 58018 cannot be played with X = 0: it would choose no scheme and remove no threat.
- **53B.** A resource generated only to overpay (Mr. Hollywood 58009) is not spent to pay the cost, so a "you can only
  spend [type] resources" restriction does not refuse it (the owner cites the RRG's Crushing Blow FAQ).
- **54B.** A Find looks only in the areas where the named card could be: Protect Humanity 59004 looking for Amadeus
  Cho does not search or shuffle Hercules' Labor and Gift decks. The player deck is shuffled if searched; the failed
  Labor card goes on the bottom of the Labor deck. (Every deck an ability does search is still shuffled.)

**Answered 2026-10-13, after the full QA** (`56B 57A 58A 59A 60B`). The owner's principle: an effect that does nothing
does not by itself make a play illegal; the Rules Reference asks for a legal target and a legal play (RRG 1.6 replaced
"must change the game state" with valid-target requirements). Per-card tests, no blanket rule against no-op plays.

- **56B.** Speed Cyclone 14006 ("Stun X enemies") and Lethal Intent 22010 ("Choose up to X technique upgrades you
  control") stay playable at X = 0. Open as question 61: whether 52B (Everywhere All at Once 58018 needs X of at
  least 1) still stands beside it; built as it stands.
- **57A.** "Remove threat from each scheme" with no threat on any scheme is refused: an ability affecting each element
  of a type needs at least one valid target (RRG 1.8 "Target", p. 42).
- **58A.** A card with a removal of threat and an independently functional part (Command Authority 45008) stays
  playable with no threat anywhere.
- **59A.** A conditional removal is judged: when the branch that would run can only remove threat and none can be
  removed, the play is refused (Natural Flight 42006, Giant Help 13003).
- **60B.** The 20 stale card-data corrections of `docs/qa-card-data-staleness.md` go in a separate PR against `main`.

Questions 23 to 27 are product choices, not rules (owner's note). Each B or C is recorded where its question lives:
14 to 18 in `docs/phase7-wave10-box-heroes.md` B4, 19 to 22 in `docs/phase7-wave10-hero-packs.md` H4, 23 to 27 in
`docs/phase7-wave10-client.md` §12.

### 4.1 Rules questions for the owner

Question 1 is answered and 8 is closed by a scan. Questions 2 to 5 came from the sources page
(`docs/phase7-wave10-sources.md` §10) and are tabled below with the rest; 6 to 13 are this pass's. Questions 6 and 13
are also Q1 and Q2 of `docs/competitive-mode-plan.md` §1.9, which marks them "(now)": they are cooperative-play
questions and are asked here. Until a question is answered the recommended default A is what gets built. No FFG
ruling in the repo names any of 6 to 13, and none is a case of a ruling contradicting the RRG. (The one place a
ruling and the box could look at odds, cross-side modular sets, is not a conflict: MC56 p. 4 and Jan 11, 2026 R1 say
the same thing, and p. 5's "modular sets from other products" is about sets with no side.)

| Q   | Question                                                                                         | A (default)                                              | B                                         | Decision                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Does competitive mode ship in this wave?                                                         | No: a written plan plus cheap groundwork                 | Build it now                              | **A, with an addition** (owner, 2026-10-11): the client says "Competitive mode coming soon" in the scenario builder and on the box's "New in this box" page; the setup has a game mode and the team references are general (§3.4–§3.6) |
| 2   | Synthezoid Smackdown (scenario pack, December 2025): in this wave?                               | No: its own PR afterwards                                | Ship it with this wave                    | **A** (owner, 2026-10-11)                                                                                                                                                                                                              |
| 3   | A Hercules Labor card revealed with no valid target (Mar 6, 2026 R3; RRG p. 65)                  | Bottom of the Labor deck, not "discarded"                | Discarded, then bottom of the Labor deck  | **B** (verified, see below) (owner, 2026-10-11)                                                                                                                                                                                        |
| 4   | Hero Shield taken by another player, then discarded (RRG p. 27; Jun 25 and Aug 13, 2026 rulings) | The original owner's discard pile                        | The taking player's discard pile          | **A** (owner, 2026-10-11)                                                                                                                                                                                                              |
| 5   | A hero against the leader of the same name, cooperative (MC56 pp. 14, 16; RRG p. 46)             | Allowed                                                  | Refused at setup                          | **A** (owner, 2026-10-11)                                                                                                                                                                                                              |
| 6   | Who makes "the enemy team's" choices in a cooperative game?                                      | The first player, in a prompt marked as the enemy's      | The affected player (C: the engine picks) | **A** (owner, 2026-10-11)                                                                                                                                                                                                              |
| 7   | Do modular sets from other products count toward the three or four?                              | Yes: three or four in total                              | No: they are extra, on top                | **A** (owner, 2026-10-11)                                                                                                                                                                                                              |
| 8   | Iron Man III (56061): "When Revealed" where every other first stage says "Setup"                 | Resolve it at setup in expert mode                       | As printed: it never resolves             | **closed**: the scan prints "Setup" (read 2026-10-11); a data correction, §8.1 item 3                                                                                                                                                  |
| 9   | Random creation: is the number of modular sets (3 or 4) random too?                              | The player sets it (default 4); the sets are random      | A coin flip                               | **A** (owner, 2026-10-11)                                                                                                                                                                                                              |
| 10  | Freedom Fighters resolving a boost ability that speaks of "this card"                            | Does what it can; icon gains and self-reveals do nothing | The icons go to the current activation    | **A**, with B kept as a switch (see above) (owner, 2026-10-11)                                                                                                                                                                         |
| 11  | Darkforce 56196 in a cooperative game                                                            | "Do as much as you can": it is discarded                 | The ability cannot resolve; it stays      | **A** (owner, 2026-10-11)                                                                                                                                                                                                              |
| 12  | Hunting Rebel Heroes 56097b: who are "those heroes"?                                             | Every hero the revealed card gives the trait to          | Only heroes who did not have it           | **A** (owner, 2026-10-11)                                                                                                                                                                                                              |
| 13  | Life Model Decoy 56084: "a minion or their leader" with one team                                 | "Their leader" is the enemy leader                       | Only a minion                             | **A** (owner, 2026-10-11)                                                                                                                                                                                                              |

### 4.2 The questions as asked

**6. "The enemy team" in a cooperative game.** Iron Man I 56059: "The enemy team searches the encounter deck for an
Iron Man attachment"; also 56072, 56084, 56112, 56113, 56159, 56189, 56191 and six main scheme stages. MC56 p. 6: the
enemy team "refers to the players. Resolve these abilities using the grim rule: Imagine what an opponent would do if
it were their choice." RRG "The Grim Rule" (p. 4). The rulebook leaves the choice with the players and asks them to
choose honestly.
A: the first player chooses (RRG "First Player", p. 19, the authority for a choice an encounter card gives to nobody
in particular), in a prompt that reads "Choose as the enemy team would"; the log records the authority. B: the
player the card is resolving against chooses. C: the engine chooses by a written ranking of "worst for the players"
(a ranking per choice from `encounter-ai-designer`, deterministic, ties broken by the seed). A is recommended
because the rulebook hands the choice to the players as a group and asks them to play it honestly; C changes a
printed player decision into a hidden one.

**7. Modular sets from other products.** MC56 p. 4: "Select three or four modular sets from the chosen side." p. 5:
"modular sets from other products may be included in your custom Civil War scenarios during cooperative play." Jan
11, 2026 R1 only forbids the other side's sets. Example: Captain America with New Avengers, Namor and Core's Bomb
Scare.
A: legal: three or four sets in total, any of them neutral, none from the other side. B: three or four of the
side's own sets, and any number of neutral sets on top.

_Closed 2026-10-11: the scan of 56061 (`assets/card-art/bundles/cards/56061.jpg`) prints "**Setup**: The enemy team
searches the encounter deck for an Iron Man attachment and your team reveals it." The cache's "When Revealed" is a
transcription error, corrected in the data (§8.1 item 3). Nothing to decide; the question is kept for the record._

**8. Iron Man III.** The raw record 56061 reads "When Revealed: The enemy team searches the encounter deck for an
Iron Man attachment and your team reveals it."; Iron Man I says "Setup:", and Captain Marvel III, Captain America III
and Spider-Woman III all say "Setup:". In expert mode III is the starting stage and a starting stage is not revealed.
The data agent reads the scan first (§8.1 item 3); if the card does print "When Revealed":
A: treat it as the Setup the other eleven first stages print, so expert Iron Man starts with an attachment. B: as
printed: the sentence never resolves, and expert Iron Man starts with none.

**9. Random creation.** MC56 p. 5: "choose … your 3-4 modular sets … all at random."
A: the player picks 3 or 4 (default 4, as every preconstructed scenario has) and the sets are drawn. B: the count is
drawn too, each with probability one half.

**10. Freedom Fighters 56153 / 56157.** "Resolve the 'Boost' ability of each minion in play." Falcon 56150's boost:
"You are confused. If you were already confused, this card gains [boost][boost]." Cloak 56194's: "If Dagger is in
play, reveal Cloak." A minion in play is not a boost card. Two situations: Freedom Fighters revealed (no activation),
and Freedom Fighters turned up as a boost card (an activation in progress).
A: each sentence does what it can with "this card" meaning the minion: statuses, exhausts and threat happen; "gains
[boost]" does nothing in both situations; "reveal Cloak" does nothing to a Cloak already in play. B: when Freedom
Fighters is the boost card, icons a borrowed ability "gains" are added to the activation it is boosting.

**11. Darkforce 56196.** "Attach to the enemy leader and give them a tough status card. Forced Response: After
attached leader schemes and places threat on the main scheme, remove an equal amount of threat from your leader's
main scheme. Discard this card." MC56 p. 6: an ability that refers to "your leader" "cannot be resolved … Do as much
as you can."
A: the response triggers, removes nothing, and discards Darkforce. B: the whole ability is unresolvable and Darkforce
stays on the leader for the game (a tough card and a boost-area SCH icon, nothing more).

**12. Hunting Rebel Heroes 56097b.** "Each hero gains the Unregistered trait. Forced Response: After another card is
revealed that gives 1 or more heroes the Unregistered trait, deal 2 damage to each of those heroes." While this stage
is in play every hero already has the trait. Example: Government Contractor 56120 ("Each identity gains the
Unregistered trait") is revealed with two players in hero form.
A: the card's text gives the trait to both heroes, so each takes 2 damage (4 in all); Unregistered Super deals 2 to
its player's hero; a player in alter-ego form takes none. B: nobody "gains" a trait they already have, so with this
stage in play the response never deals damage.

**13. Life Model Decoy 56084.** "The enemy team attaches this card to a minion or their leader. (Limit 1 per
character.)" In a competitive game "their leader" is the leader the revealing player is fighting. MC56 p. 6 defines
"the enemy leader" and "your leader" for cooperative play, not "their leader".
A: the same card, the same target: the enemy leader (the leader in play), or a minion; the choice is the enemy
team's (question 6). B: "their leader" is the players' own leader, which does not exist, so only a minion; with no
minion in play the card is discarded.

## 5. What this asks of the other agents (pass 1a)

- **`card-data-pipeline`.** §8.1: emit `cw`; `EncounterSet.side`; `MainSchemeStage.printedCardId`; the four scenario
  records with `side`, `mainSchemeStages` and the `modularSetCount` range; the per-player icons; the errata; the scan
  check behind question 8 and the typos. Write the survey (`docs/phase7-wave10-data-survey.md`) against §1.
- **`ability-scripting-engineer`.** §8.4, one module per line. Scripts use the plan's words (`enemyTeam`,
  `yourTeam`, `enemyLeader`, `yourLeader`, `inCompetitiveMode()`, the `enemyTeam` decision authority) and never
  decide the cooperative reading themselves; an "In competitive mode" clause is a branch of a real condition, never
  left out, and every such face is in the plan's task 12 manifest.
- **`encounter-ai-designer`.** Nothing unless question 6 = C (then a ranking per enemy-team choice). The leaders
  activate as villains do.
- **`rules-qa-engineer`.** The tests named in §3, each citing its page or ruling; §3.22's five ruling tests; a
  modular matrix run of the sixteen sets against the four leaders (same side only) and against two earlier villains;
  a soak of `randomCivilWarScenario` over seeds.
- **`game-client-engineer`.** The scenario builder (§3.1), blind play (§3.3), the enemy-team prompt label (§3.5),
  "Competitive mode coming soon" in the builder and on the box's "New in this box" page, the leader card frame
  (`printedType: "leader"`), the music folders (already named by the four scenario ids).
- **`multiplayer-netcode-engineer`.** Nothing in this pass; `docs/competitive-mode-plan.md` is theirs to review.
- **`content-release-tracker`.** The RRG p. 70 errata and the Jan 11, 2026 rulings recorded against `cw`.

## 6. Later passes (placeholders)

### 6.1 Pass 1b: Tigra, Hulkling and the box's player cards

Tigra 56001a/b–56009, obligation In Too Deep 56023, nemesis set 56024–56028 (The Hood, Criminal Underworld, The
Hood's Mantle, Madame Masque, Jigsaw); Hulkling 56029a/b–56040, obligation Complicated Lineage 56054, nemesis set
56055–56058 (Super Skrull, Skrull Business, Fantastic Powers, You're Coming With Me!); aspect and basic cards
56010–56022 and 56041–56053. Read in this pass only far enough to keep ids straight; nothing here is specified.

### 6.2 Pass 1c: competitive mode

Not shipped in this wave (question 1). The plan is `docs/competitive-mode-plan.md`: its §1 the rules (MC56 pp.
14–17 and p. 20), its §2 the inventory by card id, its §4 the scaffolding built in this wave (tasks 1 to 15, of which
1 to 7 are the engine groundwork §3.4–§3.6 rely on) and its §5 what waits for the multiplayer phase. This pass adds
nothing to it. Kept out of every cooperative game, each marked in §7.9: the Standard PvP set 56125–56128 /
56203–56206 and the leader player cards 56129–56136 and 56207–56214. Scripted now as the false branch of
`inCompetitiveMode()`: the competitive clause of the eight 1A sides, 56080, 56158, 56182, 56183 and 56194.

### 6.3 Pass 2: Wonder Man (`wonder_man`)

### 6.4 Pass 2: Hercules (`hercules`)

## 7. Card coverage (pass 1a)

One row per printed card of the leader sets, the main schemes and the sixteen modular sets. "§" names the primitive;
"3.23" is the reusable table. "Coop" says how a team clause reads with one team.

### 7.1 Iron Man (registration; `iron_man_leader`)

| Id          | Card              | Type        | Needs                                                                    |
| ----------- | ----------------- | ----------- | ------------------------------------------------------------------------ |
| 56059–56062 | Iron Man I–IV     | leader      | §3.7; SCH per Tech (3.23); Setup search §3.5; II/IV 3.23; question 8     |
| 56065       | Powered Gauntlets | attachment  | 3.23 (attacks gain ranged; hero response; boost reveal)                  |
| 56066       | Rocket Boots      | attachment  | 3.23                                                                     |
| 56067       | Mark V Helmet     | attachment  | 3.23 (tough on attach, stalwart)                                         |
| 56068       | Arc Reactor       | attachment  | 3.23 (tough, retaliate 1)                                                |
| 56069       | Mark V Armor      | attachment  | 3.23 (damage placed here; discard at 5)                                  |
| 56070 ×2    | Repulsor Blast    | treachery   | 3.23                                                                     |
| 56071 ×2    | Supersonic Punch  | treachery   | 3.23 (scheme and confuse; attack gains piercing with a Tech attachment)  |
| 56072       | Stark Tower       | side scheme | §3.5 (When Defeated search of deck and discard pile); found by 1A (§1.5) |

### 7.2 Captain Marvel (registration; `captain_marvel_leader`)

| Id          | Card                    | Type        | Needs                                                                                                |
| ----------- | ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| 56092–56095 | Captain Marvel I–IV     | leader      | §3.7; "attacks and defeats a character" §3.22                                                        |
| 56098       | Energy Channel          | attachment  | §3.20, §3.19 (permanent); errata RRG p. 70                                                           |
| 56099       | Captain Marvel's Helmet | attachment  | §3.8 (unique, matches 01016); 3.23                                                                   |
| 56100 ×2    | Cosmic Flight           | attachment  | 3.23 (at most 3 damage, then discarded)                                                              |
| 56101 ×2    | Photonic Blast          | treachery   | 3.23                                                                                                 |
| 56102 ×2    | Crisis Interdiction     | treachery   | 3.23                                                                                                 |
| 56103       | Energy Absorption       | treachery   | 3.23 (heal 1 per counter)                                                                            |
| 56104       | Alpha Flight Station    | side scheme | 3.23 (When Defeated: 3 counters, which can trip Energy Channel's threshold only on its next trigger) |

### 7.3 Captain America (resistance; `captain_america_leader`)

| Id          | Card                   | Type        | Needs                                           |
| ----------- | ---------------------- | ----------- | ----------------------------------------------- |
| 56137–56140 | Captain America I–IV   | leader      | §3.7; `cardAttached` (3.23)                     |
| 56143       | Cap's Shield           | attachment  | §3.17, §3.18, §3.19; retaliate 1 on its host    |
| 56144       | Cap's Helmet           | attachment  | 3.23                                            |
| 56145 ×2    | Super-Soldier Serum    | attachment  | 3.23                                            |
| 56146       | Shield Block           | treachery   | 3.23                                            |
| 56147 ×2    | Shield Toss            | treachery   | 3.23                                            |
| 56148 ×2    | Heroic Strike          | treachery   | 3.23                                            |
| 56149       | Fearless Determination | side scheme | §3.22 (in play through its When Defeated); 3.23 |

### 7.4 Spider-Woman (resistance; `spider_woman_leader`)

| Id          | Card                 | Type        | Needs                                                            |
| ----------- | -------------------- | ----------- | ---------------------------------------------------------------- |
| 56168–56171 | Spider-Woman I–IV    | leader      | §3.7; 3.23 (ATK per skill counter, counters removed)             |
| 56174       | Finesse              | attachment  | 3.23 (`counterLimit` 3; a counter per treachery revealed); §3.19 |
| 56175 ×2    | Contaminant Immunity | attachment  | 3.23 (`statusBeingGiven`, verify)                                |
| 56176 ×2    | Pheromones           | treachery   | 3.23                                                             |
| 56177 ×2    | Venom Blast          | treachery   | 3.23 (keywords by counters removed)                              |
| 56178 ×2    | Inconspicuous        | treachery   | 3.23                                                             |
| 56179       | Self-propelled Glide | side scheme | 3.23                                                             |

### 7.5 The registration main schemes (`registration`)

| Id     | Stage                      | Needs                                                                     |
| ------ | -------------------------- | ------------------------------------------------------------------------- |
| 1A ×4  | Superhero Registration Act | §3.2; Setup: cooperative branch 3.23, competitive branch set aside (§3.4) |
| 56096b | 1B S.H.I.E.L.D. Recruits   | §3.13; §3.5 and 3.23 (1 minion per player, dealt facedown)                |
| 56121b | 1B Homeland Security       | §3.13; 3.23 (each minion gains guard)                                     |
| 56122b | 1B Public Outrage          | §3.13; 3.23 (after step 1, each player discards 3 from their deck)        |
| 56063b | 1B Cut Off Support         | §3.13; §3.14                                                              |
| 56123b | 2B The Initiative          | §3.5 and 3.23 (1 side scheme per player from deck and discard pile)       |
| 56097b | 2B Hunting Rebel Heroes    | §3.16; question 12                                                        |
| 56124b | 2B No Going Back           | 3.23                                                                      |
| 56064b | 2B Negative Zone Prison    | §3.15                                                                     |

### 7.6 The resistance main schemes (`resistance`)

| Id     | Stage                      | Needs                                       |
| ------ | -------------------------- | ------------------------------------------- |
| 1A ×4  | Superhero Resistance       | as 7.5                                      |
| 56141b | 1B Gathering Support       | §3.13; as 56096b                            |
| 56199b | 1B Rallying Call           | §3.13; 3.23                                 |
| 56172b | 1B Open Rebellion          | §3.13; §3.14                                |
| 56200b | 1B Going Underground       | §3.13; 3.23 (the enemy leader gains steady) |
| 56173b | 2B Neighborhood Protectors | as 56123b                                   |
| 56201b | 2B Guerilla Warfare        | 3.23                                        |
| 56142b | 2B Secret Avengers         | 3.23 (verify)                               |
| 56202b | 2B Superhero Jailbreak     | 3.23; §3.8 for a matching minion            |

### 7.7 Registration modular sets

| Id       | Card (set)                         | Needs                                      |
| -------- | ---------------------------------- | ------------------------------------------ |
| 56073    | Yellowjacket (Mighty Avengers)     | 3.23; errata title                         |
| 56074    | Wasp                               | §3.9; 3.23                                 |
| 56075    | U.S. Agent                         | 3.23                                       |
| 56076    | Mighty Avengers                    | 3.23 (`resolveWhenRevealedOf`)             |
| 56077    | Earth's Mightiest Heroes           | §3.12                                      |
| 56078    | Doc Samson (The Initiative)        | 3.23                                       |
| 56079    | Hellcat                            | 3.23                                       |
| 56080    | Drafted                            | 3.23; competitive branch set aside (§3.4)  |
| 56081    | Mighty Avengers                    | as 56076 (§1.8)                            |
| 56082    | The Fifty State Initiative         | 3.23                                       |
| 56083    | Maria Hill (Maria Hill)            | §3.5, §3.8                                 |
| 56084 ×2 | Life Model Decoy                   | §3.5; question 13; 3.23                    |
| 56085    | Executive Order                    | 3.23                                       |
| 56086    | S.H.I.E.L.D. Helicarrier           | 3.23                                       |
| 56087    | Venom (Dangerous Recruits)         | §3.6. Coop: activates against you          |
| 56088    | Bullseye                           | §3.6. Coop: discard an upgrade you control |
| 56089    | Justice Like Lightning             | 3.23                                       |
| 56090    | Excessive Force                    | 3.23; §3.6. Coop: the boost does nothing   |
| 56091    | Dangerous Recruits                 | §3.10                                      |
| 56105 ×2 | Cape-Killer (Cape-Killer)          | §3.16                                      |
| 56106    | Unregistered Super                 | §3.16                                      |
| 56107    | Bring Them In                      | §3.16, §3.5                                |
| 56108    | Arrest Order                       | 3.23                                       |
| 56109 ×3 | S.H.I.E.L.D. Soldier (Martial Law) | 3.23                                       |
| 56110    | Rapid Response                     | 3.23                                       |
| 56111    | S.H.I.E.L.D. Patrol                | 3.23                                       |
| 56112    | Colleen Wing (Heroes for Hire)     | §3.5, §3.16                                |
| 56113    | Shang-Chi                          | §3.5, §3.16, §3.8                          |
| 56114    | Unregistered Super                 | as 56106 (§1.8)                            |
| 56115    | Bounty Hunting                     | §3.16; 3.23                                |
| 56116    | Heroes for Hire                    | §3.5; 3.23                                 |
| 56117    | Paladin (Paladin)                  | §3.16; 3.23                                |
| 56118 ×2 | Paladin's Pistol                   | 3.23                                       |
| 56119    | Bounty Hunting                     | as 56115 (§1.8)                            |
| 56120    | Government Contractor              | §3.16                                      |

### 7.8 Resistance modular sets

| Id       | Card (set)                      | Needs                                                                |
| -------- | ------------------------------- | -------------------------------------------------------------------- |
| 56150    | Falcon (New Avengers)           | §3.9, §3.10; 3.23                                                    |
| 56151    | Hercules                        | §3.9, §3.10, §3.8                                                    |
| 56152    | Goliath                         | §3.9, §3.10                                                          |
| 56153    | Freedom Fighters                | §3.11; question 10                                                   |
| 56154    | New Avengers                    | 3.23                                                                 |
| 56155    | Black Panther (Secret Avengers) | §3.9, §3.10                                                          |
| 56156    | Spectrum                        | §3.9, §3.10                                                          |
| 56157    | Freedom Fighters                | as 56153 (§1.8)                                                      |
| 56158    | Switching Sides                 | 3.23; the competitive sentence set aside (§3.4)                      |
| 56159    | Secret Avengers                 | §3.5; 3.23 (`giveBoostCard` with a card)                             |
| 56160    | Namor (Namor)                   | 3.23                                                                 |
| 56161    | Neptune's Trident               | 3.23                                                                 |
| 56162    | Horn of Proteus                 | 3.23                                                                 |
| 56163    | Imperius Rex!                   | 3.23                                                                 |
| 56164    | Ruler of Atlantis               | 3.23                                                                 |
| 56165 ×3 | Atlantean Guard (Atlanteans)    | 3.23                                                                 |
| 56166    | Atlanteans                      | 3.23                                                                 |
| 56167    | Atlantis Attacks                | 3.23                                                                 |
| 56180    | Spider-Man (Spider-Man)         | §3.21; §3.5                                                          |
| 56181 ×2 | Tangled Up                      | §3.21, §3.6. Coop: attaches to your hero                             |
| 56182    | Spectacular!                    | 3.23; the competitive sentence set aside. Coop: 2 threat             |
| 56183    | Neighborhood Hero               | §3.4. Coop: 2 per player placed here, on top of its 2                |
| 56184    | Luke Cage (Defenders)           | §3.6, §3.8. Coop: you are stunned                                    |
| 56185    | Jessica Jones                   | §3.6, §3.8. Coop: you are confused                                   |
| 56186    | Protect the Innocent            | 3.23                                                                 |
| 56187    | Street Defenders                | 3.23                                                                 |
| 56188    | The Defenders                   | 3.23                                                                 |
| 56189    | Daredevil (Hell's Kitchen)      | §3.5, §3.8                                                           |
| 56190    | Iron Fist                       | §3.6. Coop: activates against you; the boost does nothing            |
| 56191    | Resistance Fighter              | §3.5; 3.23                                                           |
| 56192    | Street Defenders                | as 56187 (§1.8)                                                      |
| 56193    | Defend Hell's Kitchen           | 3.23                                                                 |
| 56194    | Cloak (Cloak & Dagger)          | 3.23; the competitive sentence set aside. Coop: 2 threat on a scheme |
| 56195    | Dagger                          | 3.23                                                                 |
| 56196    | Darkforce                       | §3.6; question 11                                                    |
| 56197    | Lightforce                      | 3.23                                                                 |
| 56198    | Cloak and Dagger                | 3.23                                                                 |

### 7.9 Set aside for pass 1c (competitive only)

| Id                      | Card                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------- |
| 56125 / 56203           | Righteous Cause (Standard PvP)                                                        |
| 56126 / 56204           | Whatever It Takes                                                                     |
| 56127 / 56205 (×2 each) | Targeted Strike                                                                       |
| 56128a/b / 56206a/b     | Choosing Sides / Now It's Personal                                                    |
| 56129–56132             | The Futurist, Target Lock, High-Tech Suit, Suit Up (Iron Man)                         |
| 56133–56136             | Provoked Response, You Started This, Alpha Flight Recruit, Raw Power (Captain Marvel) |
| 56207–56210             | No, You Move!, Fighting Dirty, Recruited by Cap, The People's Hero (Captain America)  |
| 56211–56214             | Double Agent, Spider-Blast, Hard to Hit, Secret Contact (Spider-Woman)                |

## 8. Build order (pass 1a)

Data first, then the engine queue one task at a time (one engine agent at a time), then scripting three modules at a
time. Nothing in §8.2 waits on an open question except where it says so; the defaults are built.

### 8.1 Data: what is left

1. Emit `cw` (encounter side for this pass; the player side with pass 1b). Leaders as four-stage villains (§1.1); one
   main scheme card per side with eight stages and `printedCardId` on each (§1.2).
2. Read the sixteen main scheme B-face scans; restore `[per_hero]` in "hinder 2", "1 minions" and "1 side schemes"
   (56063b, 56096b, 56121b, 56122b, 56123b, 56141b, 56172b, 56173b, 56199b, 56200b); confirm each target and
   acceleration value is per player.
3. Iron Man III 56061: the scan prints "Setup", not the cache's "When Revealed" (read 2026-10-11; question 8,
   closed). Correct the label when emitting.
4. `EncounterSet.side` on the 22 sided sets (§1.3); confirm the acceleration icon on Unregistered Super (§1.7).
5. The four scenario records (§1.4) and the `modularSetCount` range with its helper; `validateScenario` checks the
   side of the main scheme set and that `mainSchemeStages.recommended` names one stage of each number.
6. Errata into `current` text: Yellowjacket 56073 and 56019, Energy Channel 56098 (RRG p. 70). Read the scans behind
   the six typos of §0 and keep `printed` as printed.
7. `standard_pvp` stays `competitiveOnly`; the two printings (56125–56128, 56203–56206) are one set of five cards,
   not ten: confirm how the normalizer treats the second printing.

### 8.2 Engine queue, in order

**The team scaffolding comes first and is not renumbered here**: `docs/competitive-mode-plan.md` §4 tasks 1 to 7
(game mode; team ids; per-player counts through `teamSize`; team-relative queries; the spec words and DSL builders;
`inCompetitiveMode`; the `enemyTeam` decision authority), written "P1" to "P7" below. They are §3.4, §3.5 and §3.6.

Then 15 tasks of this spec: one for each of the other 3 **new** rows (§3.1 split in two) and the other 11 **extend**
rows of §3. Each is one primitive, one agent, one commit, with the tests §3 names. "After N" is a dependency.

1. §3.2: `GameSetupConfig.mainSchemeStageIndexes` seeding `stageIndex` and `stageOrder`; readers that count stages.
2. §3.1a (content and cards): `modularSetCountRangeOf`, the side line in `modularPickProblem`,
   `chooseMainSchemeStages`. After §8.1 items 4 and 5.
3. §3.1b (cards): `wave10Scenario`, `playableScenario` wiring and the `playableScenarioOffer` fields. After 1, 2
   and P1.
4. §3.3: `randomCivilWarScenario`. After 3.
5. §3.13: hinder on a main scheme stage, from a gained keyword. After P3.
6. §3.8: the unique check for a revealed attachment, and the route audit.
7. §3.10: the leave destination `boostCardOf`.
8. §3.11: `resolveBoostAbilitiesOf`.
9. §3.12: `gainsKeywordsOf`.
10. §3.14: `AbilityLimit.per: "eventPlayer"`.
11. §3.16: `cardRevealed { grantsTrait }` and `grantedTo`.
12. §3.17: `usedStat` on the attack in progress, `Predicate attackUsedAtk`.
13. §3.18: `attacksLoseKeywords`.
14. §3.19: a permanent encounter attachment re-resolves its attach instruction when its host leaves.
15. §3.21: `characterWouldAct` for a player character's attack or thwart.

### 8.3 The "exists (verify)" and "exists (compose)" rows

§3.7, §3.9, §3.15, §3.20, §3.22 and every "(verify)" line of §3.23 are proved by the scripting agent's own module
test before the module relies on them. A failure is reported, not worked around in the script, and becomes an extend
task appended to §8.2.

### 8.4 Scripting order

`ability-scripting-engineer`, one agent per line, one module per line. Paths are relative to
`packages/cards/src/wave10/`. "Waits on" lists §8.2 task numbers, and "P" numbers for the plan's tasks.

**The scaffold**

1. `card-groups.ts`, the registries, the coverage guard, `setup.ts` (the wiring of task 3). Waits on 3.

**The main schemes**

2. `cw/main-schemes/registration.ts`: the 1A Setup and the eight B stages. Waits on P5, P6, P7, 5, 10, 11.
3. `cw/main-schemes/resistance.ts`. Waits on P5, P6, P7, 5, 10.

**The leaders**

4. `cw/leaders/iron-man.ts` (56059–56062, 56065–56072). Waits on P7.
5. `cw/leaders/captain-marvel.ts` (56092–56095, 56098–56104). Waits on 6.
6. `cw/leaders/captain-america.ts` (56137–56140, 56143–56149). Waits on 12, 13, 14.
7. `cw/leaders/spider-woman.ts` (56168–56171, 56174–56179). Waits on nothing.

**Registration modular sets**

8. `cw/modular/mighty-avengers.ts` (56073–56077). Waits on 9.
9. `cw/modular/the-initiative.ts` (56078–56082). Waits on P6.
10. `cw/modular/maria-hill.ts` (56083–56086). Waits on P5, P7.
11. `cw/modular/dangerous-recruits.ts` (56087–56091). Waits on P5, 7.
12. `cw/modular/cape-killer.ts` (56105–56108). Waits on P7, 11.
13. `cw/modular/martial-law.ts` (56109–56111). Waits on nothing.
14. `cw/modular/heroes-for-hire.ts` (56112–56116). Waits on P7; after line 12 (Unregistered Super is shared).
15. `cw/modular/paladin.ts` (56117–56120). After line 14 (Bounty Hunting is shared).

**Resistance modular sets**

16. `cw/modular/new-avengers.ts` (56150–56154). Waits on 7, 8.
17. `cw/modular/secret-avengers.ts` (56155–56159). Waits on P6, P7, 7; after line 16 (Freedom Fighters is shared).
18. `cw/modular/namor.ts` (56160–56164). Waits on nothing.
19. `cw/modular/atlanteans.ts` (56165–56167). Waits on nothing.
20. `cw/modular/spider-man.ts` (56180–56183). Waits on P5, P6, P7, 15.
21. `cw/modular/defenders.ts` (56184–56188). Waits on P5.
22. `cw/modular/hells-kitchen.ts` (56189–56193). Waits on P5, P7; after line 21 (Street Defenders is shared).
23. `cw/modular/cloak-and-dagger.ts` (56194–56198). Waits on P5, P6.

**End to end**

24. Four preconstructed games, one per leader, standard and expert, each played to a win and to a main scheme loss.
25. A custom game per side with three sets and non-recommended stages, and a seeded random game.
