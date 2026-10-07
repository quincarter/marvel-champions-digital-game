# Phase 7 working spec: wave 8 (cycle 8, Age of Apocalypse)

This is the shared brief for every agent working Phase 7's eighth content wave (`card-data-pipeline`,
`game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`,
`game-client-engineer`). It turns the wave's scope into schema decisions (§1), per-scenario setup needs (§2), a list of
engine primitives with a status each (§3) and open questions with proposed defaults (§4). The model is
`docs/phase7-wave7.md`; wave 1–7 §3 primitives are assumed. The definition of done is
`docs/wave-definition-of-done.md`: **the box's campaign ships in this wave.** If you change a decision here, update this
file in the same change. Agents do not edit statuses or open questions; they report, and the main session flips them.

**Wave 8** is our `cycleId("cycle8")`. RRG 1.8 Appendix VI (p. 71), item 8: "The _Age of Apocalypse_ campaign
expansion, the _Iceman Hero Pack_, the _Jubilee Hero Pack_, the _Nightcrawler Hero Pack_, and the _Magneto Hero
Pack_." Packs: `aoa` (MC45, with Bishop and Magik), `iceman`, `jubilee`, `ncrawler`, `magneto`. The spec is written in
passes so each stays small (the split of passes 1b to 3 is proposed; the main session decides it):

| Pass   | Scope                                                                                                | State       |
| ------ | ---------------------------------------------------------------------------------------------------- | ----------- |
| **1a** | **The box's new rules and keyword list; Unus and the Four Horsemen; the six sets those two use**     | **written** |
| 1b     | Apocalypse, Dark Beast, En Sabah Nur and their modular sets                                          | placeholder |
| 1c     | The MC45 campaign, side missions, the Mission, Overseer, Age of Apocalypse and the two Campaign sets | placeholder |
| 2a     | Bishop, Magik and the box's player cards                                                             | placeholder |
| 2b     | Iceman, Jubilee                                                                                      | placeholder |
| 2c     | Nightcrawler, Magneto                                                                                | placeholder |
| 3      | Ordered engine build queue                                                                           | placeholder |

- **Pass 1a's content.** MC45 p. 3 ("New Rules": find; "Featured Keywords"; the victory display; the amplify icon; the
  Standard III encounter set); scenario 1 Unus (villain 45059–45061, main scheme 45062a/b, set `unus` 45063–45068)
  with its required modular set Infinites (`infinites` 45069–45071); scenario 2 Four Horsemen (villains 45081a/b–
  45084a/b, main scheme 45085a/b, set `four_horsemen` 45086–45096); modular sets Dystopian Nightmare
  (`dystopian_nightmare` 45072–45074) and Hounds (`hounds` 45097–45100); Standard III (`standard_iii` 45075a/b–45080),
  here because p. 3 introduces it and either scenario may use it. 44 raw records, every one read. Sections 1.1–1.10,
  2.1–2.5, 3.1–3.17, questions 1–10 and §5.
- **Not in this pass:** scenarios 3 to 5 (MC45 pp. 14, 16, 19) and their sets, the campaign and side missions (MC45
  pp. 4–7, 20, 24, and the Campaign Instructions boxes on pp. 8 and 12), the hero packs. Placeholders are marked
  **(pass N)**; a card of a later pass is named here only to show that a primitive composes.
- **Data state (2026-10-07):** `iceman`, `jubilee`, `ncrawler` and `magneto` are emitted as data-only packs under
  `packages/content/src/data/`; `aoa` is raw only (`packages/content/raw/marvelcdb/aoa.json`, 195 records). No data
  survey exists yet (`docs/phase7-wave8-data-survey.md` is another agent's).

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules
Reference; FFG rulings clarify both):

1. **Card text and product rules.**
   - The Age of Apocalypse rulebook, `docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf` (24 pages), converted
     in `docs/campaign-modes/markdown/mc45_age_of_apocalypse.md`, cited as "MC45 p. N" (PDF page = printed page).
     Pages read for pass 1a: 2, 3, 8, 11, 12; pp. 9, 10 and 13 are full-page art. Four conversion slips, each checked
     against the PDF's text layer (`pymupdf`) or a render:
     - p. 3: the "Villainous" heading is separated from its paragraph, which the markdown prints after "Steady".
     - p. 8: the four "Modular Difficulty" bullets are printed after the Campaign Instructions box, and the bullet
       "Expert Campaign Only: Record each identity's remaining hit points" belongs to that box's Victory list.
     - p. 8: the PDF text layer drops the per player icon; a render of the page shows "Standard Mode: Place
       1[per_hero] threat", "Expert Mode: Place 2[per_hero] threat", "Heroic Mode: Place 3[per_hero] threat" and
       "Skirmish Mode: Place 0 threat", as the markdown has them.
     - pp. 2 and 12: the callouts show the four Horsemen with "if he has at least 1 hit point remaining" and "cannot
       be defeated while another villain has hit points remaining". The printed cards (scan 45081a) and the raw data
       read "if he has at least 1 hit point" and "while another villain has at least 1 hit point". The card wins; the
       meaning is the same.
   - Card text: `packages/content/raw/marvelcdb/aoa.json`, every record of the six sets above pulled by script. Not an
     authority on its own. Five scans were read (`assets/card-art/bundles/cards/`, gitignored): 45062b, 45071, 45081a,
     45085b and 45090. They confirm: Hunting Gene Traitors 1B is 0 starting threat, target 11[per_hero], acceleration
     of 1[per_hero] with a star; The Horsemen of Apocalypse 1B is 0, 12[per_hero] and 1[per_hero]; Gene Pool is 4
     starting threat with no icons; Golden Horse prints +1 SCH, +1 ATK and two boost icons.
2. **RRG 1.8** (`mc_rulesreference_v18_compressed.md` for text, the PDF for page numbers). Entries this pass leans on:
   "Activation" (p. 6), "All-Purpose Counter" (p. 6), "Amplify Icon" (p. 7), "Attach To" (p. 8), "Attack (Enemy
   Activation)" (pp. 8–10), "Boost" (p. 11), "'Cannot'" (p. 11), "Choose (Option)" (p. 12), "Cost" (p. 13), "Defeat"
   (p. 15), "Find" (p. 19), "Guard" (p. 21), "Hit Points" (p. 22), "Nemesis Encounter Set" (p. 30), "Overkill"
   (p. 31), "Per Player Icon" (p. 32), "Permanent" (p. 32), "Piercing" (p. 32), "Player Deck" (p. 33), "Quickstrike"
   (p. 36), "Remaining Hit Points" (p. 36), "Reveal" (p. 38), "Setup (Keyword)" (p. 40), "Side Scheme" (p. 40),
   "Stalwart" (p. 40), "Standard Set" (p. 40), "Star Icon" (pp. 40–41), "Stun, Stunned" (p. 41), "Surge" (p. 42),
   "Text Box" (p. 44), "Tough" (p. 44), "Toughness" (p. 45), "Villain Defeat" (p. 47), "Villainous" (p. 47), "When
   Defeated Abilities" (p. 48), Appendix II "Setup" (p. 51), and the FAQ "Scenario #4 – The Sinister Six" (p. 62: with
   more than one villain in play, "the villain with the active counter takes the overkill damage").
   - The RRG's "Age of Apocalypse Expansion" FAQ (p. 64) is four entries on Magik (pass 2a). Its errata heading
     (p. 69) lists Rogue, Energy Transfer, Mystique's Manipulations and Bonebreaker, none a card of this pass. **No RRG
     FAQ or erratum names a card of pass 1a.**
3. **FFG rulings** (`marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading). Every title of the six sets was
   matched against the file by script: no ruling names one. Rulings on the rules this pass uses:
   - December 17, 2025 – Ruling 4 (3): "The **Find** keyword can only search 'in game' areas" (RRG p. 19).
   - January 11, 2026 – Ruling 1 (1): a defeated side scheme "is considered in play until its When Defeated ability
     resolves. Its amplify icon remains in effect" (RRG pp. 7, 48). Applies to The Specter of Death (45089).
   - June 2, 2026 – Ruling 2 (1): "Damage is dealt **simultaneously**" to several enemies (RRG p. 14), the basis of
     the four Horsemen falling together (§3.9).
   - June 25, 2026 – Ruling 4 (3): "Environments flip, they are not revealed" (Pursued by the Past, §3.6).
   - June 25, 2026 – Ruling 5: "Finding and revealing an attachment already in play triggers its When Revealed
     abilities and keywords" (RRG p. 19; §3.1).
   - April 30, 2026 – Ruling 4 (the Overseer and Prelate minions, Digging Deep in a mission attempt) is **(pass 1c)**.
4. `docs/phase7-wave8-sources.md` and `docs/phase7-wave8-handoff.md` are pointers. Two lines of the sources page are
   superseded here: its §3.1 calls the amplify icon new to this cycle (it has been in the engine since wave 3 §3.6),
   and its §6 item 5 asks whether "[star]" and amplify are one primitive (they are not: RRG "Star Icon", p. 40, "has
   no effect; it is merely a reminder", and raw `[amplify]` is a different token).

No ruling of this pass disagrees with the RRG. One rulebook sentence disagrees with a card (§4.2 Q5).

## 1. Schema decisions (owner: `game-rules-architect`)

> Status: **proposed (2026-10-07), nothing landed.** Searched `packages/content/src/schema` and `packages/engine/src`
> for each shape below. **This pass asks for no schema change.** Every keyword its cards print (guard, permanent,
> piercing, overkill, quickstrike, retaliate, setup, stalwart, surge, toughness) is a `KeywordInstance` in
> `packages/content/src/schema/keywords.ts`, as is every keyword MC45 p. 3 features (hinder, teamwork, victory,
> villainous, patrol, ranged, steady).

### 1.1 Find: an instruction, not a keyword on a card

RRG 1.8 "Find" (p. 19) and MC45 p. 3 define an instruction ("When instructed to find a card …"). No card of this pass
prints "Find" as a keyword line: it appears inside ability text (45075b, 45097). `keywords.ts` still lists a `find`
shape marked unconfirmed; the data agent emits no `find` keyword for these cards, and the instruction is the engine's
`findCard` effect and `find` ref (§3.1). **No schema change.**

### 1.2 Amplify: printed on one card, gained by another

- The Specter of Death (45089) prints one amplify icon: raw `scheme_amplify: 1` → `BaseCard.amplifyIcons: 1`
  (`schema/cards/base.ts`). The other three Four Horsemen side schemes print hazard (45086), acceleration (45087) and
  crisis (45088) → `schemeIcons`.
- Unus (45059–45061) "gains a [amplify] icon" in ability text. That is a script (`RuleSpec gainsIcon`, §3.2), not a
  data field. **No schema change.**

### 1.3 Unus: the ordinary staged villain

One `VillainCard`, stages I/II/III (45059, 45060, 45061), hit points per player (12, 15, 18; raw
`health_per_hero: true`), `villainStages: { standard: [1, 2], expert: [2, 3] }` (MC45 p. 8: "Remove Unus (I) and add
Unus (III) for expert mode"). Toughness on every stage. **No schema change.**

### 1.4 The two main schemes: one stage, two faces

| Card                                | Starting threat | Target                         | Acceleration | Notes                                            |
| ----------------------------------- | --------------- | ------------------------------ | ------------ | ------------------------------------------------ |
| Hunting Gene Traitors 45062a/b      | 0               | 11[per_hero] (`perPlayerOnly`) | +1[per_hero] | the star by the acceleration is 1B's [star] text |
| The Horsemen of Apocalypse 45085a/b | 0               | 12[per_hero]                   | +1[per_hero] | no star                                          |

Raw carries each scheme twice: a record with no face letter (45062, 45085; `double_sided: true`, `back_text` the 1A
text) and a record 45062a / 45085a whose `linked_card` is the b face. The data agent emits one `MainSchemeCard` each,
as every earlier box. Raw `base_threat_fixed: true` with `base_threat: 0`; `threat_fixed: false` and
`escalation_threat_fixed: false` are the per player icons the scans show. **No schema change.**

### 1.5 Gene Pool: a side scheme with permanent and setup

`SideSchemeCard`, `keywords: [permanent, setup]`, `startingThreat` 4 flat (raw `base_threat_fixed: true`), no icons, in
the modular set `infinites`. Both keywords exist; setup step 11 puts setup cards into play
(`packages/cards/src/setup-keyword-set-aside.test.ts`). **No schema change**; behavior in §3.4.

### 1.6 The four Horsemen: four villains in play, one stage each, an A and a B face

MC45 p. 11: "Each of the Horsemen villains has a side A and a side B … To play the scenario in skirmish or standard
mode, use each villain's side A. To play the scenario in expert or heroic mode, use each villain's side B."

- **The Wrecking Crew shape** (`VillainStageRange`, `schema/sets.ts`: "For villains printed with version letters the
  numbers are positions (A = 1, B = 2)"): each Horseman is one `VillainCard` with two stages, A (45081a: 9[per_hero]
  hit points) and B (45081b: 12[per_hero]), and the scenario has `villainStages: { standard: [1, 1], expert: [2, 2] }`.
  Raw gives each as record `4508Na` with `linked_card` `4508Nb`. Not the Marauders shape (`expertVillains`), which has
  no multiple-villain form.
- **`Scenario.multipleVillains`** exists (`schema/sets.ts`): `villains` the four (each `encounterSetIds: []`),
  `encounterDecks: "shared"`, `activation: "activeVillainOnly"`, `winCondition: "allVillainsDefeated"`, `atSetup:
"setAside"` (the 1A Setup puts them into play in a random order, as Sinister Synchronization 1A does for the Sinister
  Six). **No schema change.** The row order is game state, not data (§3.7).
- Death prints two traits (Aerial, Horsemen); the others one. All four are unique.
- Every ATK prints a star (raw `attack_star: true`): the reminder for the [star] Forced Response.

### 1.7 Standard III: a second Standard set, with an environment and an obligation in it

MC45 p. 3: "When a scenario requires the Standard set, you may replace it with the Standard III set."

- `EncounterSet.classification: "standard"` on `standard_iii` (the field The Hood's Standard II uses, wave 4 §1.9). No
  Expert III exists. A scenario's `standardEncounterSetIds` stays `[standard]`; the replacement is a choice made at
  setup (§3.6), not scenario data.
- Pursued by the Past (45075a/b): one `EnvironmentCard` with a `flipSide`, keywords permanent and setup on the a face,
  permanent on the b face, different ability text per face. The two-face environment shape of wave 6 §1.8 / wave 7
  §1.6 covers it.
- Drawing Near (45080): an `ObligationCard` that belongs to an encounter set and to no identity. `ObligationCard` has
  no identity field, so it is emitted like Hunted (§1.8). **No schema change.**

### 1.8 An obligation in a modular set, with an icon and boost icons

Hunted (45072 ×2, `dystopian_nightmare`): `ObligationCard`, `schemeIcons: ["hazard"]` (raw `scheme_hazard: 1`;
`BaseCard.schemeIcons` already serves non-scheme cards, wave 7 §3.63), boost 2. **No schema change.** The carried-over
normalizer note in the handoff applies: these obligations must be emitted with their `encounterSetIds`, not `[]`.

### 1.9 Attach hosts and stat boxes

| Card                      | Host (`AttachmentHost`, `schema/cards/attachment-host.ts`)                  | Stat box       |
| ------------------------- | --------------------------------------------------------------------------- | -------------- |
| Prelate Sidearm 45063     | named: Unus                                                                 | +1 ATK (star)  |
| Prelate Armor 45064       | named: Unus                                                                 | +1 SCH (star)  |
| Genetic Experiments 45066 | `qualified` minion, `trait: Infinite`                                       | +1 SCH, +1 ATK |
| Golden Horse 45090        | `superlative` among `villain`, lowest `remainingHp`, `withoutTrait: Aerial` | +1 SCH, +1 ATK |
| Metal Wings 45091         | named: Death                                                                | +1 SCH, +1 ATK |
| Ahab's Energy Spear 45099 | `ifAble`: named Ahab, `otherwise` the villain (Crossfire's Rifle shape)     | +2 ATK (star)  |

Every shape exists. "+2 hit points" (45066) is ability text. **No schema change.**

### 1.10 Scenario records

| Field                      | `unus`                                    | `four-horsemen`                                |
| -------------------------- | ----------------------------------------- | ---------------------------------------------- |
| `villainCardId`            | Unus                                      | War (the first of `multipleVillains.villains`) |
| `mainSchemeCardId`         | 45062                                     | 45085                                          |
| `encounterSetIds`          | `unus`, `infinites` (required, MC45 p. 8) | `four_horsemen`                                |
| `recommendedModularSetIds` | `dystopian_nightmare`                     | `dystopian_nightmare`, `hounds`                |
| `modularSetCount`          | 1 (absent)                                | 2                                              |
| `standardEncounterSetIds`  | `standard`                                | `standard`                                     |
| `expertEncounterSetIds`    | `expert`                                  | `expert`                                       |
| `villainStages`            | standard `[1, 2]`, expert `[2, 3]`        | standard `[1, 1]`, expert `[2, 2]`             |
| `multipleVillains`         | absent                                    | §1.6                                           |
| `victory`                  | absent (final villain stage)              | absent (`winCondition: "allVillainsDefeated"`) |

Ids follow the hyphenated form of the earlier boxes (`morlock-siege`). 45062a: "Unus, Infinites, and Standard sets.
One modular set (Dystopian Nightmare)". 45085a: "Four Horsemen, Standard, and two modular sets (Dystopian Nightmare
and Hounds)". Neither 1A names the Expert set; expert mode adds it as in every scenario (RRG "Expert Set", p. 19).

**Corrections the data agent owes for these sets:** the duplicate main scheme records (§1.4); raw `[amplify]` in
Unus's text must survive as the amplify token, not "[star]"; 45075a's `linked_card` text is HTML (`<p>`, `<span
class="icon-star">`) and needs the same cleaning as the other b faces; the obligations' set membership (§1.8).

### 1.11 Placeholders

- **(pass 1b)** Apocalypse's flip to stage II on completion, Dark Beast's Setting environments and "Special", the
  three-sided En Sabah Nur villain.
- **(pass 1c)** The mission area, mission side schemes, Overseer / Prelate two-face minions, Mission Team (45171a),
  the campaign record and log.
- **(pass 2)** Bishop, Magik and the four hero packs.

## 2. Per-scenario setup needs

RRG 1.8 Appendix II (p. 51) with the wave 1–7 engine. The Campaign Instructions boxes on MC45 pp. 8 and 12 are
**(pass 1c)**.

### 2.1 The two scenarios

| Scenario      | Main scheme deck                | Encounter sets (required) + modulars                                | Needs (§3)           |
| ------------- | ------------------------------- | ------------------------------------------------------------------- | -------------------- |
| Unus          | Hunting Gene Traitors (1 stage) | Unus, Infinites, Standard; Dystopian Nightmare (removable)          | 3.2–3.5, 3.12, 3.17  |
| Four Horsemen | The Horsemen of Apocalypse (1)  | Four Horsemen, Standard; Dystopian Nightmare and Hounds (removable) | 3.7–3.15, 3.16, 3.17 |

MC45 p. 8: "The Dystopian Nightmare set can be removed from this scenario and/or added to other scenarios … The
Infinites set may be used in other scenarios, but it is required when playing Unus." MC45 p. 11: "The Hounds and
Dystopian Nightmare sets can be removed from this scenario and/or added to other scenarios". Either scenario's
Standard set may be replaced by Standard III (MC45 p. 3; §2.5).

### 2.2 Unus (MC45 p. 8), step by step

1. Appendix II steps 1–9 as usual. The villain deck is Unus I and II (II and III in expert mode); the dial is set to
   12[per_hero] (15[per_hero] in expert).
2. **Step 10**: the encounter deck is `unus` (45063–45068, 10 cards), `infinites` without Gene Pool (7 cards), the
   Standard set (or Standard III), one modular set, the Expert set in expert mode, and the obligations. Gene Pool is
   permanent, so it is set aside before step 1 (RRG "Permanent", p. 32) and is not shuffled in.
3. **Step 11**: Gene Pool has setup, so it is put into play with its 4 starting threat (RRG "Setup (Keyword)", p. 40;
   "Side Scheme", p. 40). With Standard III, Pursued by the Past enters play here too, with no counters.
4. **Modular difficulty** (MC45 p. 8, optional): "they may place threat on Gene Pool during setup … Skirmish Mode:
   Place 0 threat. Standard Mode: Place 1[per_hero] threat. Expert Mode: Place 2[per_hero] threat. Heroic Mode: Place
   3[per_hero] threat." A setup option of the Infinites set, in any scenario that includes it (§3.5, §4.2 Q1).
5. **Step 12a**, 45062a Setup: "Reveal the Gene Pool side scheme. In expert mode, deal each player a facedown
   encounter card."
   - Gene Pool is already in play from step 11. As read: revealing it does not make it enter play again (RRG "Find",
     p. 19, says so for a minion found in play: "**not** considered to be entering play"), it prints no When Revealed,
     and so the sentence changes nothing. Gene Pool has **4** threat after setup, plus any of step 4. The sentence
     matters only if a scenario includes the Unus set without the setup keyword having fired, which cannot happen.
   - Expert: one facedown encounter card per player, revealed in step four of the first villain phase.
6. **Step 12b**: flip to 1B. No When Revealed. **Step 12c**: Unus's toughness gives him a tough status card (RRG
   "Toughness", p. 45).
7. Steps 14–16 as usual.

**In play.** 1B: "[star] Forced Response: After resolving step one of the villain phase, place 1 threat on Gene Pool.
If this scheme is completed, the players lose the game." Unus reads Gene Pool's threat (§3.3): with the printed 4 he
has retaliate 1 from the first turn. Each new stage of Unus gets a tough status card (same title, RRG "Villain
Defeat", p. 47: status cards carry over, and toughness adds one as the stage enters play, as for every earlier staged
villain with toughness).

### 2.3 Four Horsemen (MC45 pp. 11–12), step by step

1. Appendix II steps 1–7 as usual. **Step 8**: the four villain cards (A faces; B in expert) and the main scheme.
   **Step 9**: each villain has its own dial (MC45 p. 11, "Multiple Villains"), 9[per_hero] or 12[per_hero].
2. **Step 10**: one shared encounter deck: `four_horsemen` (45086–45096, 15 cards, the four side schemes included),
   the Standard set (or Standard III), two modular sets, the Expert set in expert mode, the obligations.
3. **Step 12a**, 45085a Setup: "Shuffle the four [HORSEMEN] villains, then reveal them in a row from left to right.
   Place the active counter on the leftmost villain (see rulebook). Each player reveals a random side scheme from the
   Four Horsemen encounter set."
   - The four villains get a random order from the game's seeded RNG; that order is the **row** (§3.7). The active
     counter starts on the first.
   - In player order, each player reveals one of the four side schemes 45086–45089 chosen at random among those still
     in the encounter deck; it enters play with 6 threat and its icon. The deck is shuffled after (RRG "Search",
     p. 39). With four players all four are in play; the rest stay in the deck.
4. **Step 12b**: flip to 1B, no When Revealed. **Step 12c**: no villain has a Setup or When Revealed ability.

**In play** (MC45 p. 11, "Active Villain").

- "only the active villain will activate during the villain phase. The active villain is the villain with the active
  counter". 1B: "Forced Response: After a villain activates, move the active counter to the next villain. If this
  stage is completed, the players lose the game." "The 'next villain' is immediately to the right of the current
  villain. If the current villain is the rightmost, then the 'next villain' is the leftmost."
- "Any encounter card that refers to 'the villain' only refers to the active villain. When a player triggers a player
  card ability that refers to 'the villain,' they choose which villain … If a constant ability or keyword refers to
  'the villain,' it only refers to the active villain." The engine already does both (`TargetRef villain`;
  `needsVillainChoice`, `resolve/effects-frame.ts`).
- "Players can attack any villain they choose regardless of which villain is the active villain." Guard is the
  exception by its own text: RRG "Guard" (p. 21), "The engaged player cannot attack **any** villain" (`canAttack`,
  `select.ts`; wave 1). A Hound engaged with you protects all four.
- Each villain: "[star] Forced Response: After [name] attacks you, if he has at least 1 hit point, [effect]. **[Name]
  cannot be defeated while another villain has at least 1 hit point.**" A Horseman at 0 hit points stays in play,
  still takes the active counter in turn, still activates, and can be healed (45092–45095). When the last one reaches
  0, all four are defeated together and the players win (§3.9).

### 2.4 The modular sets of this pass

| Set                 | Cards                                                   | Notes                                                                                |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Infinites           | Infinite Soldier ×5, Culling the Weak ×2, Gene Pool     | Gene Pool is permanent and setup in every scenario that uses the set. §3.3–§3.5.     |
| Dystopian Nightmare | Hunted ×2, War-Weary ×2, Targeted for Extermination ×2  | Hunted is an obligation with a hazard icon that stays in play (wave 7 §3.70). §3.17. |
| Hounds              | Ahab, Hound ×4, Ahab's Energy Spear, Release the Hounds | Ahab finds and reveals the side scheme; Hound forces hero form. §3.1, §3.16.         |

### 2.5 Standard III (MC45 p. 3)

"This set changes the way nemesis sets enter the game by replacing the Shadow of the Past treachery with the Pursued
by the Past environment. Pursued by the Past has both the permanent and setup keywords, so it always begins the game
in play and cannot leave play. The rest of the Standard III set places counters on the environment in order to bring
nemesis sets into play."

- Six cards, eight copies: Pursued by the Past (45075a/b), Dark Designs ×2, Sinister Strike ×2, Evil Alliance, Nowhere
  is Safe, Drawing Near. Seven go into the encounter deck; the environment is set aside and put into play at step 11.
- 45075a: "Forced Response: After you place a pursuit counter here, if the number of counters here is at least 3 more
  than the number of players, remove each counter here → if your nemesis minion is in play, it activates against you.
  Otherwise, flip this card over." 45075b: "Forced Response: After you flip to this side, find your nemesis minion
  and reveal it. Search the set-aside area for your nemesis side scheme and reveal it. Shuffle your remaining
  set-aside nemesis set into the encounter deck. Flip this card over."
- "You" is the player whose card placed the counter: the player revealing the treachery, the player a boost card's
  activation is against, the player whose turn began (Drawing Near). §3.6.

## 3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names say where each primitive is needed.
Every status below comes from a search by behavior (2026-10-07) of `packages/engine/src` (`spec.ts`, `abilities.ts`,
`rules.ts`, `query.ts`, `select.ts`, `state.ts`, `resolve/*`), the DSL in `packages/cards/src/dsl`, the content schema
and the wave 1–7 specs. Statuses: **exists** (found and exercised by an earlier wave's cards); **exists (verify)**
(found by name and doc comment, its behavior for this card not run: the scripting agent proves it in a test before
relying on it, and a failure becomes an extend here); **exists (compose)** (several existing pieces, no engine
change); **extend** (an existing primitive needs one more case); **new**. Each section is one agent, one commit.

| §    | Primitive                                                                    | Needed by                                        | Status           |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------ | ---------------- |
| 3.1  | Find, and "find … and reveal it" when the card is already in play            | 45075b, 45097                                    | extend           |
| 3.2  | An amplify icon a character gains under a condition                          | 45059–45061; printed on 45089                    | exists (verify)  |
| 3.3  | Keywords, an icon and hit points gained at threat thresholds on a named card | 45059–45061, 45067, 45069                        | exists (compose) |
| 3.4  | A permanent, setup side scheme that stays in play with no threat             | Gene Pool 45071; 45062a                          | exists (verify)  |
| 3.5  | A setup option that belongs to a modular set                                 | Infinites (MC45 p. 8, "Modular Difficulty")      | extend           |
| 3.6  | Standard III: a counted environment that flips; replacing the Standard set   | 45075a/b–45080                                   | extend           |
| 3.7  | Villains in a random row; the active counter passes to the next in the row   | 45085a/b, 45091, 45096                           | extend           |
| 3.8  | "After a villain activates" with several villains                            | 45085b; 45092–45095                              | exists (verify)  |
| 3.9  | Villains that cannot be defeated while another has hit points                | 45081–45084 a/b                                  | exists (verify)  |
| 3.10 | "Is considered to have at least 1 hit point"                                 | Golden Horse 45090, Metal Wings 45091, 45096     | new              |
| 3.11 | Another card's Forced Response resolved "as if it just attacked you"         | 45090, 45091, 45096                              | extend           |
| 3.12 | A named enemy activates; no boost card; "after this activation"; extra boost | 45067, 45092–45095                               | exists (compose) |
| 3.13 | An identity's text box blanked "until the next villain phase begins"         | Pestilence 45083a/b, Plague and Pestilence 45088 | extend           |
| 3.14 | Attach hosts of this pass; an attachment that moves the active counter       | 45066, 45090, 45091, 45099                       | exists (verify)  |
| 3.15 | A random side scheme of a set revealed by each player at setup               | 45085a                                           | exists (verify)  |
| 3.16 | A forced change to hero form; the first copy revealed each phase gains surge | Hound 45098, Release the Hounds 45100            | exists (verify)  |
| 3.17 | Reusable as is                                                               | the rest                                         | checked          |

### 3.1 Find, and "find … and reveal it" when the card is already in play

> **Status: extend.** `EffectSpec findCard` (`resolve/find.ts`) and `TargetRef find` (`spec.ts`) landed in wave 6
> §3.48: every in-game area in the order play, tucked, set aside, hand, discard pile, deck; never facedown encounter
> cards in an in-play area, the victory display, removed-from-game cards or anything outside the game; each deck
> searched is shuffled. `findCard.to` has hand, set aside, discard, attach and scenario-area destinations and **no
> "reveal"**. `revealCard` takes a ref, so "find X and reveal it" is `find` + `revealCard`; `resolve/reveal.ts` has a
> branch for a card already in play, written for main scheme faces, not checked for a minion or a side scheme.

**Cards.** Pursued by the Past 45075b ("find your nemesis minion and reveal it"); Ahab 45097 ("find the Release the
Hounds side scheme and reveal it"). Later: every "find" of passes 1b, 1c and 2.

**Rules.** RRG 1.8 "Find" (p. 19); MC45 p. 3 ("Do NOT look at facedown encounter cards currently dealt to players");
ruling December 17, 2025 – Ruling 4 (3); ruling June 25, 2026 – Ruling 5. RRG p. 19: "If a player is instructed to
'find and reveal' a minion that is already in play, that player engages that minion and resolves any keywords and/or
triggered abilities that resolve as a result of that minion being revealed … That minion retains all attached cards
and tokens on it. That minion is **not** considered to be entering play. That minion is considered to engage that
player unless it was already engaged with that player."

**Plan.** `revealCard` of a card found in play: a minion moves to the finding player and engages them (an `engaged`
event unless it already was), keeps damage, status cards, attachments and counters, raises no `entersPlay`, then its
When Revealed abilities and reveal keywords (surge, and quickstrike after them, RRG p. 36) resolve. A side scheme or
attachment found in play stays where it is, gains no starting threat (it does not enter play), and its When Revealed
and reveal keywords resolve (the June 25 ruling). Found out of play, the ordinary reveal.

**Tests (exact numbers).**

1. Nemesis minion engaged with player 2 with 2 damage and a stunned card; player 1 flips Pursued by the Past: the
   minion is engaged with player 1, still has 2 damage and the stunned card, no `entersPlay` in the log, its When
   Revealed resolved once for player 1.
2. Nemesis minion facedown as player 2's dealt encounter card, or as a boost card on the villain: not found; the flip
   reveals nothing and the dealt card stays facedown.
3. Nemesis minion in the victory display: not found.
4. Ahab revealed with Release the Hounds in the encounter discard pile: it enters play with 5 threat; the encounter
   deck is not shuffled (no deck was searched once it was found). In the deck: found, revealed, deck shuffled.
5. Ahab revealed with Release the Hounds in play at 2 threat: 5 threat (his own "place 3 threat on it" branch; the
   find branch is not reached).

**Composes with:** Rogue's Touched (wave 6), Face the Past (`magneto`, pass 2c).

### 3.2 An amplify icon a character gains under a condition

> **Status: exists (verify).** `RuleSpec gainsIcon { icon: "amplify", target, while }` (`abilities.ts`),
> `amplifyIconsInPlay` and `grantedIcons` (`modifiers.ts`, `rules.ts`), read when a boost card is turned faceup and
> again when its icons are counted (`resolve/enemy-activation.ts`). Wave 3 §3.6, wave 4 §3.57. Not yet granted to a
> villain by its own text.

**Cards.** Unus 45059–45061: "9 — Unus also gains a [amplify] icon." Printed: The Specter of Death 45089.

**Rules.** RRG 1.8 "Amplify Icon" (p. 7): "When a boost card is turned faceup **during an enemy activation**, add one
additional boost icon to that card for each amplify icon in play. Each amplify icon is equivalent to the following
constant ability: 'Each boost card gains [boost].'" MC45 p. 3 repeats it. Ruling January 11, 2026 – Ruling 1 (1).

**Tests.** Unus I (ATK 2), Gene Pool at 9, boost card with 1 printed icon: attack of 4. Gene Pool at 8: attack of 3. A
boost card with 0 printed icons at 9: attack of 3. A minion with villainous attacking at 9: its boost card gains the
icon too ("each boost card"). The Specter of Death and Gene Pool at 9 together: +2 per boost card.

### 3.3 Keywords, an icon and hit points gained at threat thresholds on a named card

> **Status: exists (compose).** `KeywordGrantSpec { keyword, target, while }` and `StatModifierSpec` inside a
> `constant` rule; `Predicate compare` over `ValueSpec threat` of a `named` card; `gainsIcon` (§3.2); `conditional`
> effects inside a When Revealed. One point needs a test, below.

**Cards.** Unus 45059–45061 ("If the amount of threat on Gene Pool is at least: 3 — Unus gains retaliate 1. 6 — Unus
also gains stalwart. 9 — Unus also gains a [amplify] icon."); Infinite Soldier 45069 ("3 — This minion gains
quickstrike. 6 — This minion also gains surge. 9 — This minion also gets +3 hit points."); Infinite Prelate 45067
("3 — Give Unus a tough status card. 6 — Heal 3 damage from Unus as well. 9 — Give Unus an additional boost card for
this activation as well.").

**Rules.** The tiers are cumulative ("also"). They are constant abilities read live (RRG "Ability", p. 4), so they
turn off when threat is removed from Gene Pool. RRG "Stalwart" (p. 40); "Hit Points" (p. 22: "If an ability that says
an ally or minion 'gets +X hit points' ceases to be in effect and causes that ally or minion to have damage on it
equal to or greater than its hit points, that ally or minion is defeated"); "Quickstrike" (p. 36: it resolves after
the minion's When Revealed abilities); "Surge" (p. 42).

**The point to verify.** Infinite Soldier grants itself surge and quickstrike. A minion enters play at step 2 of a
reveal and its When Revealed abilities, keywords included, resolve at step 3 (RRG "Reveal", p. 38), so the constant
ability is active in time. The test must show the engine reads a self-granted reveal keyword there.

**Tests (exact numbers).**

1. Gene Pool 2 → Unus has no retaliate. Place 1 → retaliate 1: a hero's basic attack deals its damage and the hero
   takes 1. Remove 1 → none again.
2. Gene Pool 5 → 6 while Unus has a stunned and a confused card: both are discarded as he gains stalwart; a later
   stun does nothing. Back to 5: he can be stunned again.
3. Infinite Soldier revealed to a hero-form player: at 2 threat no attack, 3 hit points, guard; at 3 it attacks for 2
   after engaging; at 6 the player is also dealt 1 facedown encounter card; at 9 it has 6 hit points.
4. Infinite Soldier with 4 damage at Gene Pool 9; a thwart takes Gene Pool to 8: the soldier (3 hit points, 4 damage)
   is defeated.
5. Infinite Prelate at 2: Unus activates, nothing else. At 9: tough, 3 healed, and two boost cards in that activation
   (order: §4.2 Q8).

### 3.4 A permanent, setup side scheme that stays in play with no threat

> **Status: exists (verify).** `resolve/event.ts` (~line 1685): a permanent side scheme whose last threat is removed
> is not defeated: "nothing is announced, no When Defeated resolves" (owner decision 2026-10-05, wave 7 §4.1, for
> Stryfe's Grasp). The setup keyword at step 11 is covered by `setup-keyword-set-aside.test.ts`. Not yet run for a
> side scheme that is both, in a modular set.

**Cards.** Gene Pool 45071; Hunting Gene Traitors 45062a ("Reveal the Gene Pool side scheme").

**Rules.** RRG 1.8 "Permanent" (p. 32): "cannot be defeated, leave play, or have any part of its text box blanked,
except by card abilities in the same set"; "Setup (Keyword)" (p. 40); Appendix II step 11 (p. 51). MC45 p. 8: "it
always begins the game in play and cannot leave play." Players may thwart it: it is a side scheme (crisis, "each side
scheme" and "defeat a side scheme" effects read it as one; an effect that would defeat or discard it does nothing).

**Tests.** After setup Gene Pool has exactly 4 threat in standard and expert mode with no modular difficulty (§2.2
step 5: the 1A "Reveal" adds nothing). Thwart it to 0: still in play, no `schemeDefeated`, no "after you defeat a side
scheme" response (Cable 40001a) fires. Next villain phase step one: 1 threat. "Discard a side scheme" from a player
card: not a valid target. An ally defeated by an attack: +3; by its own consequential damage: +0. The Infinites set in
another scenario (Rhino): Gene Pool is in play with 4 after setup, with no 1A naming it.

### 3.5 A setup option that belongs to a modular set

> **Status: extend.** Setup options exist per scenario in `@mc/cards` (`checkScenarioSetupOptions`,
> `packages/cards/src/wave4/setup.ts`; Tower Defense's `towerDefenseSetupDamage`, wave 4 §4 Q4) and on the client
> draft (`setup-draft.ts`). None is keyed by an encounter set.

**Rules.** MC45 p. 8, "Modular Difficulty": "If players wish to modify the difficulty of a scenario while using the
Infinites modular set, they may place threat on Gene Pool during setup … The amount of threat placed is up to the
players as a group", with the four recommendations of §2.2 step 4.

**Plan.** A setup option offered whenever the game's encounter sets include `infinites`, whatever the scenario: a
number of threat per player, 0 to 3, placed on Gene Pool after step 11 and before step 12, logged as a setup step
(`setupOptionApplied { option, amount }`) so a replay reproduces it. The value is part of the game's setup config, not
of the scenario. Default value: §4.2 Q1.

**Tests.** 2 players, option 2 per player: Gene Pool 8 after setup, so Unus has retaliate 1 and stalwart at once.
Option 0: 4. The option is absent for a game without the Infinites set.

### 3.6 Standard III: a counted environment that flips; replacing the Standard set

> **Status: extend.** The card behavior composes from existing vocabulary (table below). The gap is the choice of
> set: `alternateDifficultySetsFor` (`packages/client/src/view/setup-draft.ts`) offers a pack's alternate Standard and
> Expert sets only for that pack's own scenarios, as one switch for both, and Standard III has no Expert partner.

| Card text                                                                                         | Existing vocabulary                                                                                     |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| "After you place a pursuit counter here, if the number of counters here is at least 3 more than…" | `on.countersPlaced`, `counterAtLeast` / `compare` with a player count                                   |
| "remove each counter here → …" (a cost)                                                           | remove-all-counters cost (`remove-all-counters.test.ts`)                                                |
| "if your nemesis minion is in play, it activates against you. Otherwise, flip this card over."    | `exists` with `nemesisMinionOf`, `enemyActivation`, `orElse`, `flipCard`                                |
| "After you flip to this side, find your nemesis minion and reveal it. Search the set-aside area…" | §3.1; the Shadow of the Past script (`core/modular/standard.ts`): `nemesisSideSchemeOf`, `nemesisSetOf` |
| "Place 1 pursuit counter on Pursued by the Past. Then, if it has any counters on it, …"           | `addCounters` on a `named` card, `then`, `counterAtLeast`                                               |
| "the villain schemes" / "the villain attacks you" / "this card gains surge"                       | `enemyScheme`, `enemyAttack`, `gainSurge`                                                               |
| "When Revealed (Alter-Ego) … / When Revealed (Hero) …" (45077)                                    | form-split When Revealed (core Assault)                                                                 |
| "[star] Boost: After this activation resolves, place 1 pursuit counter …"                         | `atEndOfActivation`                                                                                     |
| "Each nemesis minion in play activates against you. If no minions activated this way, place 3 …"  | `enemyActivation` over a query, `eventResult` / a var count                                             |
| "discard an upgrade or support you control" (45079)                                               | `chooseCards` + `discardFromPlay` (a permanent card is no target, RRG p. 32)                            |
| Drawing Near: "After your turn begins, discard the top card of your deck. Place 1 … for each…"    | `on.yourTurnBegins`, deck discard, `totalPrintedResources`                                              |
| "Alter-Ego Action: Discard an identity-specific card from your hand → discard this card."         | `discardFromHand` cost with a classification filter; wave 7 §3.70                                       |

**Rules.** MC45 p. 3 (§2.5). RRG 1.8 "Standard Set" (p. 40), "Nemesis Encounter Set" (p. 30), "All-Purpose Counter"
(p. 6), "Permanent" (p. 32: the environment flips by its own text, which is "the same set"). Ruling June 25, 2026 –
Ruling 4 (3): "Environments flip, they are not revealed", so flipping raises no When Revealed and no "revealed"
trigger.

**As read.**

- Placing several counters at once (Evil Alliance's 3; Drawing Near's one per icon) is one placement and one check.
- The Forced Response resolves after the placement and before the treachery's "Then" sentence (§4.2 Q2).
- "The number of players": §4.2 Q3.
- "Your nemesis minion" is the acting player's own (`nemesisMinionOf: you`). In play engaged with someone else, it
  still "activates against you". With no nemesis set in the game (`usesIdentityEncounterSets: false`), 45075a's
  "Otherwise" flips the card and 45075b finds nothing, shuffles nothing and flips back.
- After the first flip the nemesis set is in the game. A later reset with the minion in a deck or discard pile finds
  it there and reveals it; with the minion in play it activates and the card does not flip.

**Plan for the choice.** `EncounterSet.classification: "standard"` already marks the set. The scenario builder's
standard set argument takes `standard_iii` for any scenario whose `standardEncounterSetIds` is `[standard]`; the
Expert set is unchanged. The setup screen offers it wherever §4.2 Q10 says.

**Tests (exact numbers, 1 player, threshold 4).**

1. 0 counters, Dark Designs revealed: 1 counter, the villain schemes.
2. 3 counters, Dark Designs revealed: the fourth counter resets the card to 0; nemesis not in play, so it flips, the
   nemesis minion and side scheme are revealed, the rest of the set is shuffled in, the card flips back; then "if it
   has any counters on it" is false and the villain does not scheme (Q2 = A).
3. 3 counters, nemesis minion in play: reset to 0, the minion activates against the revealing player, no flip.
4. 4 players: nothing at 6 counters, reset at the seventh.
5. Evil Alliance with no nemesis minion in play: 3 counters. With one in play: it activates, 0 counters.
6. Drawing Near: top card prints two resource icons → 2 counters; a card with none → 0 and no check.
7. Sinister Strike in alter-ego at 0 counters: 1 counter and surge. In hero form: 1 counter and the villain attacks.

### 3.7 Villains in a random row; the active counter passes to the next in the row

> **Status: extend.** In the engine: `Scenario.multipleVillains`, `GameState.activeVillainId`, `setActiveVillain`
> (logged `activeVillainChanged`), `addVillain` for set-aside villains, `moveActiveCounter { to:
"nextInActivationOrder" }` and `nextVillainInActivationOrder` (`query.ts`; The Sinister Six, wave 5 §3.1), which
> orders by a printed "Activation Order X". The Horsemen print none: their order is where they sit.

**Cards.** The Horsemen of Apocalypse 45085a ("reveal them in a row from left to right. Place the active counter on
the leftmost villain") and 45085b; Rough Riders 45096 ("Move the active counter to the next villain"); Metal Wings
45091 ("Attach to Death and move the active counter to him").

**Rules.** MC45 p. 11, "Active Villain" and "Multiple Villains" (§2.3). RRG 1.8 "All-Purpose Counter" (p. 6).

**Plan.**

- **`GameState.villainRow: readonly InstanceId[]`**: the villains in play, left to right, explicit state. A villain
  joins at the right end when it enters play and leaves the row when it leaves play; a villain at 0 hit points that is
  not defeated stays in it. Empty or absent in every earlier scenario.
- **Setup.** The 1A Setup takes the set-aside villains in a random order (the seeded RNG; logged
  `villainRowSet { order }`), adds each (`addVillain`), and sets the first active.
- **`moveActiveCounter { to: "nextInRow" }`**: from the villain holding the counter to the one after it in
  `villainRow`, wrapping; with one villain in the row it stays. Logged `activeVillainChanged { reason: "nextInRow" }`.
- "Move the active counter to him" (45091) is the existing `setActiveVillain`.
- The villain phase reads the active villain afresh for each player's activation (step 2 is "once per player, in
  player order", RRG p. 6), so with 1B the Horsemen take turns across the players.

**Tests (exact numbers).** Row [War, Famine, Pestilence, Death], hero form.

1. 1 player: round 1 War attacks, the counter goes to Famine; round 2 Famine; round 5 War again.
2. 2 players: round 1 War attacks player 1, Famine attacks player 2, the counter ends on Pestilence.
3. Rough Riders with the counter on Death: Death's Forced Response, the counter wraps to War, War's Forced Response.
   The counter moved once; no villain activated, so 1B does not move it again.
4. Metal Wings revealed with the counter on War: attached to Death, counter on Death.
5. Same seed, same row; a replay of the log rebuilds the row from `villainRowSet`.

### 3.8 "After a villain activates" with several villains

> **Status: exists (verify).** `on.enemyActivates` (after an `enemyAttack` or `enemyScheme` resolves) with a villain
> source; nested activations wait for the current one and its triggered abilities (RRG "Activation", p. 6;
> `resolve/enemy-activation.ts`). Not run with a counter that moves on every activation.

**Cards.** 45085b; Horseman of War / Famine / Pestilence / Death 45092–45095; Sinister Strike, Dark Designs (the
villain attacks or schemes from a treachery).

**Rules.** RRG 1.8 "Activation" (p. 6): "Whenever an enemy attacks or schemes, it is considered to have activated …
If an effect initiates an activation during the resolution of another activation, the newly initiated activation
resolves after the current activation has finished resolving … All abilities triggered by the initial activation
resolve before subsequent activations initiate." "Stun, Stunned" (p. 41): "that character is not considered to have
attacked"; "Confused" (p. 13) likewise for a scheme.

**As read.**

- 1B hears every villain activation: the step two activations, and one a treachery or boost ability starts.
- It moves the counter one place from the villain that **holds** it, whichever villain activated (§4.2 Q5).
- An activation replaced by a stunned or confused card is not an activation, so the counter does not move (§4.2 Q4).
- Overkill from an attack that defeats a minion is dealt to the villain with the active counter (RRG p. 62 FAQ).

**Tests (exact numbers).** Row [War, Famine, Pestilence, Death], 1 player, counter on War.

1. Horseman of Death revealed in step four: Death heals 2, gets a tough card, attacks; the counter goes War → Famine.
2. War attacks with Horseman of Famine as his boost card: War's attack finishes; 1B moves the counter to Famine; then
   Famine activates with no boost card; 1B moves it to Pestilence. Next round Pestilence is active.
3. War stunned (one stunned card, no steady): the stunned card is discarded, no attack, counter still on War.
4. A hero's overkill attack defeats a Hound with 3 excess while the counter is on Famine: Famine takes 3.

### 3.9 Villains that cannot be defeated while another has hit points

> **Status: exists (verify).** `RuleSpec cannotBeDefeated { target, while }` (`abilities.ts`): "a matching character
> at zero remaining hit points is not defeated". `resolve/defeat.ts` (~line 570) decides every villain's defeat before
> any applies and already names "the Four Horsemen, `aoa` 45081–45084" beside Tower Defense's Proxima Midnight and
> Corvus Glaive (wave 4 §3.3). Built for two villains; not run with four, with healing from 0, or with §3.10.

**Cards.** War, Famine, Pestilence, Death 45081–45084 a/b: "[Name] cannot be defeated while another villain has at
least 1 hit point."

**Rules.** RRG 1.8 "'Cannot'" (p. 11, absolute); "Defeat" (p. 15); "Hit Points" (p. 22: a villain's dial is its
remaining hit points); ruling June 2, 2026 – Ruling 2 (1) (damage to several enemies is simultaneous). RRG "Text Box"
(p. 44) and "When Revealed Abilities" (p. 48: "Alternate win or loss conditions cannot be blanked or canceled") do
not reach this line: it is a constant ability, and a villain's text is not blanked by any card of this pass.

**As read.** A Horseman at 0 stays in play: it holds its place in the row, takes the counter, activates with its
printed ATK or SCH, keeps attachments and status cards, can be attacked (damage past 0 changes nothing: the dial
stops at 0) and can be healed. Its [star] Forced Response is off ("if he has at least 1 hit point") unless §3.10
applies. When the last villain above 0 reaches 0, the condition is false for all four at once; all four are defeated
in one step and `allVillainsDefeated` ends the game as a win.

**Tests (exact numbers).** 1 player, standard: four villains at 9.

1. 9 damage to War: War at 0, in play, no `characterDefeated`. 5 more damage to War: still 0.
2. War at 0 attacks: 2 damage plus boost; the player discards no upgrade or support.
3. Horseman of War with War at 0: War at 2 with a tough card, then he attacks and the player discards an upgrade.
4. War, Famine, Pestilence at 0, Death at 3; an attack deals 3 to Death: four `characterDefeated` events in one
   step, the game is won. An attack that deals 2: nobody falls.
5. Death at 1, the rest at 0, an "each enemy" 1-damage effect: all four fall together.

### 3.10 "Is considered to have at least 1 hit point"

> **Status: new.** Nothing in the engine or the raw data of any earlier pack reads a floor on remaining hit points
> (searched "considered to have" across every raw cache: no earlier card).

**Cards.** Golden Horse 45090 ("Attached villain gains the [AERIAL] trait and is considered to have at least 1 hit
point"); Metal Wings 45091 ("Death gains retaliate 1 and is considered to have at least 1 hit point remaining");
Rough Riders 45096 ("as if it has at least 1 hit point").

**Rules.** RRG 1.8 "Remaining Hit Points" (p. 36); "Hit Points" (p. 22); "Defeat" (p. 15: "If a character has zero or
fewer remaining hit points … it is defeated").

**Plan.** **`RuleSpec consideredRemainingHp { target, atLeast, while? }`**: every _reading_ of a matching character's
remaining hit points returns at least `atLeast`; the dial and the damage on the card are untouched. Read by
`ValueSpec remainingHp`, by the predicates built on it ("if he has at least 1 hit point", "while another villain has
at least 1 hit point") and, with §4.2 Q6 = A, by the defeat check. Hosts that rank by remaining hit points (§3.14)
read the true dial, so a second Golden Horse still goes to the villain that is really lowest. The rule's presence is
shown in the villain's inspect data (`consideredHp: 1`) so a player can see why nobody fell.

**Tests (exact numbers, Q6 = A).**

1. War at 0 with Golden Horse attacks: the player discards an upgrade or support.
2. All four at 0, Golden Horse on Famine: nobody is defeated. The player attacks Famine and uses Golden Horse's
   response (discard 10, discard the horse): all four fall, the game is won.
3. Metal Wings on Death at 4: an attack on Death deals its damage and the attacker takes 1 (retaliate 1).
4. Golden Horse on War: War has the Aerial trait; a second Golden Horse cannot attach to War.

### 3.11 Another card's Forced Response resolved "as if it just attacked you"

> **Status: extend.** `EffectSpec resolveSpecials { cards | of, player, trigger }` resolves a card's printed
> abilities by kind, `trigger: "special" | "whenRevealed" | "whenDefeated"`, with the resolving player as "you" and no
> event behind them (wave 4 §3.46, §3.56; wave 6 §3.17). It has no Forced Response case and no way to set a condition
> aside. As a **cost**, wave 7 §3.19 (b) built "an enemy attacks you →" (`AbilityCost.enemyAttack`).

**Cards.** Golden Horse 45090: "Hero Response: After you attack attached villain, resolve its 'Forced Response' as if
it just attacked you → discard this card." Metal Wings 45091, the same for Death. Rough Riders 45096: "Resolve the
'Forced Response' on the active villain as if it has at least 1 hit point and attacked you. Move the active counter to
the next villain and resolve its 'Forced Response' the same way."

**Rules.** RRG 1.8 "Cost" (p. 13: "pay cost → resolve effect"); "Self-Referential" (p. 39); "You, Your" (p. 49).

**Plan.**

- **`resolveSpecials.trigger: "forcedResponse"`**, with `abilities` naming the ability by ref id as the Special form
  already allows. The ability's effects resolve with `player` as "you" and the named card as its source; nothing is
  logged as an attack, so "after [villain] attacks" on other cards (Prelate Sidearm is not in this scenario; a hero's
  "after an enemy attacks you") does not fire.
- **`asIf: { remainingHpAtLeast?: number }`** on the same effect: while these effects resolve, §3.10's floor applies
  to the source. Rough Riders passes 1. Golden Horse and Metal Wings pass none: their own constant text supplies it.
- **As a cost**: `AbilityCost.resolveAbility { of, trigger: "forcedResponse" }`, paid by resolving it; the settle step
  follows `settleEnemyAttackCost`'s pattern (a cost that did not happen is not paid). When it counts as paid: §4.2 Q7.
- Only the villain's printed Forced Response is resolved, not one an attachment gives it.

**Tests (exact numbers).**

1. Golden Horse on Famine (at 5), player's deck 20 cards: after a basic attack on Famine the response is offered;
   used, 10 cards are discarded, the horse is discarded, Famine has not attacked (no boost card, no damage).
2. Rough Riders, counter on Pestilence at 0, next is Death at 0: the identity's text box is blank until the next
   villain phase begins; the counter is on Death; 1 damage to the identity and to each ally the player controls.
3. Golden Horse on War, the player controls no upgrade or support: per Q7.

### 3.12 A named enemy activates; no boost card; "after this activation"; extra boost

> **Status: exists (compose).** `enemyActivation` / `enemyAttack` / `enemyScheme` against a player by any named
> enemy, `boost: false` and the `noBoost` modifier (Master Mold, wave 6 §3.15), `extraBoostCards`, `atEndOfActivation`
> (delayed effects of a boost ability), `chooseOne` inside a Boost.

**Cards.** Infinite Prelate 45067 ("Unus activates against you … Give Unus an additional boost card for this
activation as well"); Horseman of War / Famine / Pestilence / Death 45092–45095 ("Heal 2 damage from War and give him
a tough status card. He activates against you." / "[star] Boost: After this activation, War activates against you. Do
not give War a boost card for that activation."); Infinite Hunter 45065 ("[star] Boost: Choose to either place 2
threat on Gene Pool, or the activating enemy gets +2 SCH and +2 ATK for this activation"); Culling the Weak 45070.

**Rules.** RRG 1.8 "Activation" (p. 6): a hero-form player is attacked, an alter-ego player is schemed against;
"Boost" (p. 11); "Choose (Option)" (p. 12): both of Infinite Hunter's options are always available (neither needs a
target that can be missing; Gene Pool is permanent). The player the activation is against chooses.

**Tests.** Horseman of War as a boost card on Famine's attack: after it, War attacks with exactly his printed ATK (2
on side A) plus attachments, no boost card. Infinite Hunter as Unus's boost card (0 printed icons; a star): option 2
makes Unus I attack for 4; option 1 leaves 2 and adds 2 to Gene Pool. Infinite Hunter's When Revealed: 3 damage to one
ally the revealing player controls; none controlled, nothing happens.

### 3.13 An identity's text box blanked "until the next villain phase begins"

> **Status: extend.** The lasting `EffectSpec blankTextBox { target, until: LastingUntil }` exists (Edison's Giant
> Robot), and the identity semantics exist on the constant form (`RuleSpec blankTextBox` on an identity, wave 7 §3.19,
> §4.1 Q12 = A: the blank is on the card, both faces, traits kept). `LastingUntil` is `endOfPhase | endOfRound |
endOfAttack | endOfTurn`: none ends where a phase **begins**.

**Cards.** Pestilence 45083a/b: "treat your identity's text box as if it were blank (except for [TRAITS]) until the
next villain phase begins." Plague and Pestilence 45088: "The player who defeated this scheme treats their identity's
text box as if it were blank (except for [TRAITS]) until the next villain phase begins."

**Rules.** RRG 1.8 "Text Box" (p. 44), "Traits" (p. 45), "Star Icon" (pp. 40–41: a star value whose text is blank is
0). A round is the player phase then the villain phase, so "end of the round" is the wrong moment: an effect made in
villain phase N must last through all of player phase N+1.

**Plan.** `LastingUntil` gains `"nextVillainPhaseBegins"`: the effect expires as the next villain phase starts, before
its step one. Made during a villain phase, it lasts the rest of that phase and the whole following player phase; made
during the player phase (45088 defeated by a thwart; Golden Horse's response on Pestilence), until that round's
villain phase starts. The lasting effect on an identity uses the constant form's semantics unchanged.

**Tests.** Pestilence attacks Spider-Man in round 1's villain phase: Spider-Sense cannot trigger for the rest of that
phase or in round 2's player phase; hand size, stats and traits are unchanged; in round 2's villain phase it triggers
again. A second blank from 45088 during round 2's player phase ends at the same moment as the first.

### 3.14 Attach hosts of this pass; an attachment that moves the active counter

> **Status: exists (verify).** Every host is an existing `AttachmentHost` kind (§1.9). "Otherwise, this card gains
> surge" has 25 earlier cards (Gene Therapy `cyclops` 33030), "Boost: Attach this card to …" has 12 (Adamantium Claws
> `mut_gen` 32067). New here only in combination: a `superlative` host among several **villains** by lowest remaining
> hit points with a trait excluded.

**Cards.** Golden Horse 45090 ×3; Metal Wings 45091; Genetic Experiments 45066 ("Attach to an [INFINITE] minion.
Otherwise, this card gains surge." / "[star] Boost: Attach this card to an [INFINITE] minion."); Ahab's Energy Spear
45099 ("Attach to Ahab. Otherwise, attach to the villain."); Prelate Sidearm 45063, Prelate Armor 45064.

**Rules.** RRG 1.8 "Attach To" (p. 8): "If the initial 'attach to' check does not pass, the card is not able to be
attached … If such a card cannot remain in its prior state or game area, discard it." The RRG has no entry on a tie
between hosts; `attachment-hosts.ts` returns every tied card and a player chooses, and the test pins which player.

**As read.** Golden Horse ranks villains by the dial (§3.10), a villain at 0 included. With every villain Aerial
(Death, and three horses on the others) a fourth cannot exist: there are three copies. Ahab's Energy Spear with no
Ahab attaches to the active villain, as "the villain" on an encounter card (MC45 p. 11).

**Tests.** Villains at 9, 4, 4 (Death), 6: Golden Horse goes to the non-Aerial villain at 4. Two non-Aerial villains
tied at 4: a choice between exactly those two is asked. Genetic Experiments revealed with no Infinite minion in
play: discarded, surge. As a boost card with two Infinite minions in play: the player the activation is against
chooses one; it has +2 hit points; defeated, Gene Pool gains 2 before the minion leaves play. Ahab's Energy Spear on
Ahab: his attack is 5 with overkill and piercing (a tough card on the defender is discarded first), and the spear is
discarded at the end of that attack; revealed with Ahab not in play in the Four Horsemen: attached to the villain
holding the counter.

### 3.15 A random side scheme of a set revealed by each player at setup

> **Status: exists (verify).** `forEachPlayer`, a `CardSelector` over the encounter deck with a query and `random`
> (`spec.ts` ~line 3721), `revealCard`, `shuffleEncounterDeck`. Not run for a reveal during setup step 12a.

**Cards.** The Horsemen of Apocalypse 45085a.

**Rules.** RRG 1.8 Appendix II step 12 (p. 51); "When Revealed Abilities" (p. 48: one that enters play during setup
resolves in that step); "Search" (p. 39). The four side schemes print no When Revealed; their icons count from the
first villain phase (the hazard icon of 45086 deals one more encounter card in step three).

**Tests.** 2 players, fixed seed: exactly two of 45086–45089 in play with 6 threat each, the other two in the
encounter deck, the deck shuffled once. 4 players: all four in play.

### 3.16 A forced change to hero form; the first copy revealed each phase gains surge

> **Status: exists (verify).** `EffectSpec changeForm` ("It never uses the once-per-round form change"; nine earlier
> cards change a player to hero form, Claustrophobia `storm` 36030); `RuleSpec firstRevealGainsSurge {
cards, each: "phase" }`; `dealAsEncounterCard` for a named card taken from the deck or discard pile (wave 7 §3.38).

**Cards.** Hound 45098 ("Guard. When Revealed: If you are in hero form, Hound attacks you. Otherwise, change your
identity to hero form."); Release the Hounds 45100 ("The first copy of Hound revealed each phase gains surge. When
Defeated: The player who defeated this scheme searches the encounter deck and discard pile for a copy of Hound and
deals it to themself as a facedown encounter card.").

**Rules.** RRG 1.8 "Form, Change Form" (p. 21); "Surge" (p. 42); "When Defeated Abilities" (p. 48). "The player who
defeated this scheme" when no player did follows the owner's wave 7 answer (§4.1 Q2 there: the When Defeated resolves
with no player as its source; here nobody is dealt the Hound).

**Tests.** Hound revealed to a hero: it attacks for 2. To an alter-ego: the identity flips to hero form, "after you
change to hero form" responses may trigger, the player's own once-per-round change is still available, and Hound does
not attack. With Release the Hounds in play, two Hounds revealed in one villain phase: the first deals 1 more
encounter card, the second does not; a Hound revealed in the following player phase (by an effect) gains surge again.
Release the Hounds defeated by a thwart with one Hound in the discard pile: that player has it facedown, revealed in
the next step four.

### 3.17 Reusable as is (checked against the engine unions)

| Card text                                                                                            | Existing vocabulary                                                                                                                          |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Featured keywords (MC45 p. 3): hinder, teamwork, victory, villainous, patrol, permanent, piercing, … | wave 2 (permanent, piercing, ranged, setup, villainous), wave 3 (hinder, patrol, stalwart, victory), wave 4 (steady), wave 6 §3.1 (teamwork) |
| "The victory display is an out-of-play game area shared by all players" (MC45 p. 3)                  | `GameState.victoryDisplay`; wave 7 §3.49                                                                                                     |
| "After resolving step one of the villain phase, place 1 threat on Gene Pool" (45062b)                | `on.villainStepResolved` (wave 7 §3.21), `placeThreat` on a `named` card                                                                     |
| "If this scheme / stage is completed, the players lose the game" (45062b, 45085b)                    | the final stage's loss (RRG p. 27); one stage each                                                                                           |
| "In expert mode, deal each player a facedown encounter card" (45062a)                                | `inMode`, `forEachPlayer`, `dealEncounterCard`                                                                                               |
| Toughness on each Unus stage; on Ahab                                                                | keyword                                                                                                                                      |
| "After Unus attacks and defeats an ally, place 1 threat on Gene Pool" (45063)                        | `on.villainAttacks` with `requireResults: { defeated: 1 }` and an ally target                                                                |
| "After Unus schemes, give him a tough status card" (45064)                                           | `on.enemySchemes`, `giveStatus`                                                                                                              |
| "Hero Response: After you make a basic attack against Unus, spend [energy] [physical] resources → …" | `on.attacks` with `attackKind: "basic"` and the host as target; typed `spendResources` cost                                                  |
| "After an ally is defeated by anything other than consequential damage, place 3 threat here" (45071) | `on.defeated` with `consequential: false` (wave 6 §3.57)                                                                                     |
| "When Defeated: Place 3 threat on Gene Pool" (45068); "When Revealed: Place 4 …" (45070)             | `whenDefeated`, `placeThreat`                                                                                                                |
| "Forced Interrupt: When attached minion is defeated, place 2 threat on Gene Pool" (45066)            | `on.attachedCardDefeated`                                                                                                                    |
| "You are stunned. If you were already stunned, take 2 damage instead." (45073)                       | 24 earlier cards (Waylay `gam` 18028): `hasStatus`, `giveStatus`, `orElse`                                                                   |
| "The player who defeated this scheme confuses their identity" (45074) and 45086–45089                | `defeatingPlayer`, `giveStatus`, `discardFromPlay`, deck discard, `dealDamage` over a query                                                  |
| "Alter-Ego Action: Discard a card from your hand → discard this card" (Hunted 45072), a hazard icon  | wave 7 §3.70, §3.63                                                                                                                          |
| "discard the top 10 cards of your deck" (Famine 45082, 45087)                                        | deck discard; RRG "Player Deck" (p. 33): an emptied deck reshuffles, no further cards are discarded                                          |
| "deal 1 damage to each character you control" (Death 45084, 45089)                                   | `dealDamage` over `controller: you` characters, simultaneous                                                                                 |
| "discard an upgrade or support you control" (War 45081, 45086, 45079)                                | `chooseCards` + `discardFromPlay`; permanent cards are no target                                                                             |
| "this attack gains overkill and piercing. At the end of this attack, discard [this]" (45099)         | `modifyAttack.keywords`, `atEndOfAttack`                                                                                                     |
| "If Release the Hounds is in play, place 3 threat on it. Otherwise, find …" (45097)                  | `conditional` on `exists(named)`; §3.1                                                                                                       |
| Death gains retaliate 1 (45091); attached villain gains the Aerial trait (45090)                     | `KeywordGrantSpec`, `TraitGrantSpec`                                                                                                         |
| "Heal 2 damage from War and give him a tough status card" (45092)                                    | `heal` and `giveStatus` on a `named` villain, active or not                                                                                  |

**One exact-number test for the deck rule.** Famine attacks a player with 7 cards in their deck: 7 are discarded, the
discard pile is shuffled into a new deck, the player is dealt 1 facedown encounter card, and no further card is
discarded (7, not 10).

## 4. Open questions (for the user or FFG)

### 4.1 Decided by the user

Nothing answered yet.

| Q   | Decision |
| --- | -------- |

### 4.2 The questions as asked

Each is implemented the way stated, or not at all, and named here rather than decided silently. **A is the proposed
default in every question; none is implemented yet.**

1. **The Infinites "Modular Difficulty" threat: how is it offered?** (§3.5; MC45 p. 8: "If players wish to modify the
   difficulty … they may place threat on Gene Pool during setup", with 0 / 1 / 2 / 3 per player recommended for
   skirmish / standard / expert / heroic.)
   - **A (default):** a setup control on any game that includes the Infinites set, off (0) unless the players turn it
     on, as Tower Defense's setup damage is; turned on, it starts at the mode's recommendation and takes 0 to 3 per
     player.
   - B: on by default at the mode's recommendation (standard 1 per player, expert 2), adjustable.
   - C: no control; always the printed 4 only.
2. **Pursued by the Past's reset and a treachery's "Then, if it has any counters on it".** (§3.6; 45076, 45077,
   45079.)
   - **A (default):** the environment's Forced Response resolves as soon as the counter is placed, before the "Then"
     sentence. When that counter caused the reset there are no counters, so the villain does not scheme or attack,
     nothing is discarded and no surge is gained: the nemesis activation or arrival is the penalty instead.
   - B: the treachery resolves in full first (the "Then" sentence is true), then the reset.
3. **"The number of players" on Pursued by the Past.** (§3.6; no per player icon is printed. RRG "Per Player Icon",
   p. 32, ties "players who started the scenario" to the icon.)
   - **A (default):** the players in the game now; an eliminated player lowers the threshold by 1.
   - B: the players who started the scenario.
4. **A Horseman whose activation is replaced by a stunned or confused card: does the active counter move?** (§3.8;
   45085b "After a villain activates". RRG "Stun, Stunned", p. 41: "not considered to have attacked"; "Activation",
   p. 6.)
   - **A (default):** no. The counter stays, so in a game of several players the same villain activates against the
     next player.
   - B: the counter moves whenever a villain would have activated.
5. **Whose activation moves the counter, and from where?** The card (45085b): "After **a** villain activates, move the
   active counter to the next villain." MC45 p. 11: 1B "causes the active counter to pass to the 'next villain' after
   **the** villain activates", and "the villain" there is the active one. They differ when a treachery makes a
   non-active Horseman activate (45092–45095).
   - **A (default):** the card (RRG "The Golden Rules", p. 4): any villain's activation moves the counter one place
     from the villain holding it.
   - B: the rulebook's wording: only an activation by the villain holding the counter moves it.
6. **"Is considered to have at least 1 hit point" on a villain at 0.** (§3.10; Golden Horse 45090, Metal Wings 45091.)
   - **A (default):** every reading of its hit points sees at least 1: its own "if he has at least 1 hit point", the
     other villains' "while another villain has at least 1 hit point" and its own defeat check. The players cannot win
     while such a card is attached to a villain at 0; they remove it with its Hero Response.
   - B: only the villain's own Forced Response condition reads it; defeat and the win are unaffected.
7. **Golden Horse's and Metal Wings' cost when the Forced Response can do nothing.** "resolve its 'Forced Response' as
   if it just attacked you → discard this card" (§3.11). War with no upgrade or support under your control; Famine
   with an empty deck and discard pile. RRG "Cost" (p. 13) has no rule for a cost that is another ability.
   - **A (default):** a cost must be paid: the response cannot be used unless the Forced Response changes something
     (War needs an upgrade or support you control; Famine at least 1 card in your deck; Death and Pestilence always
     can). Famine with 1 to 9 cards discards them all and counts as paid.
   - B: the response can always be used; the Forced Response resolves as far as it can.
8. **Infinite Prelate (45067): when do the tough card and the heal happen?** The text orders "Unus activates against
   you", then the three tiers, and the third must act inside the activation ("for this activation").
   - **A (default):** the extra boost card is given as the activation begins; the tough card and the heal resolve
     after the activation, in printed order.
   - B: all three tiers resolve before the activation.
9. **Four Horsemen difficulty choices.** MC45 p. 11: side A for skirmish and standard, side B for expert and heroic,
   and "Players may also customize their experience by using a mix of side A or B". The setup screen today offers
   "extreme" (stage A then B) for every scenario with several villains (`difficultyOptionsFor`), which this scenario
   does not print.
   - **A (default):** standard is four A sides, expert four B sides; no "extreme" entry and no per-villain mix in this
     wave.
   - B: add a per-villain A/B picker.
10. **Where is Standard III offered?** (§3.6; MC45 p. 3: "When a scenario requires the Standard set, you may replace
    it with the Standard III set.")
    - **A (default):** a setup toggle on every scenario that uses the Standard set, from any pack, once Age of
      Apocalypse is in the player's pool; the Expert set is unchanged.
    - B: only on the five Age of Apocalypse scenarios (how Standard II is offered for The Hood today).

## 5. What this asks of the other agents (pass 1a)

- **`card-data-pipeline`:** emit the six sets of this pass with §1.2–§1.9: one main scheme record each from the
  duplicated raw pairs (§1.4); the Horsemen as four two-stage villains (§1.6); Pursued by the Past as one two-face
  environment; `classification: "standard"` on `standard_iii`; the two obligations with their set membership (§1.8);
  the attach hosts of §1.9; the two scenario records of §1.10. Read scans 45059–45061 (the amplify token in Unus's
  text), 45075a/b, 45082a–45084b and 45091 against raw before emitting. No schema change is requested.
- **`ability-scripting-engineer`:** nothing until §3.1, §3.7, §3.10, §3.11 and §3.13 land. Then one agent per set:
  `unus` with `infinites`; `four_horsemen`; `dystopian_nightmare` with `hounds`; `standard_iii`. Each "exists
  (verify)" row is proved by a test in the set's own test file before it is relied on.
- **`encounter-ai-designer`:** two scenario tests from §2: the Unus threshold ladder across a Gene Pool that rises
  and is thwarted down (§3.3), and a full Horsemen rotation with a treachery activation and a villain standing at 0
  (§3.7–§3.9). The automated player's choice in Infinite Hunter's boost and its targets for Golden Horse's response.
- **`rules-qa-engineer`:** fixtures for the exact-number tests of §3.1, §3.6 and §3.9–§3.11; the four rulebook
  conversion slips of §0 need no test, but Q5 (card versus rulebook) does once answered.
- **`game-client-engineer`:** four villains in a row with the active counter visible and each dial readable; a
  villain at 0 shown as standing, with the reason ("cannot be defeated while …", or §3.10's considered hit point) in
  Inspect; Gene Pool's threat and the three thresholds readable from Unus and from Infinite Soldier; pursuit counters
  and the reset threshold on Pursued by the Past; the setup controls of Q1, Q9 and Q10 once answered.

## 6. Later passes (placeholders)

- **(pass 1b)** Scenario 3 Apocalypse (MC45 p. 14; `apocalypse` 45101a–45111, `dark_riders` 45112–45117), scenario 4
  Dark Beast (p. 16; `dark_beast` 45118–45126, `savage_land` 45127–45132, `genosha` 45133–45138, `blue_moon`
  45139–45146), scenario 5 En Sabah Nur (p. 19; `en_sabah_nur` 45147–45155 and the three-sided 45184–45186,
  `celestial_tech` 45156–45158, `clan_akkaba` 45159–45163). Start with the set list each 1A prints, then the villain
  that flips on a completed main scheme, the Setting environments' "Special" (`resolveSpecials` exists) and the
  three-sided villain (Angel's three-face identity, wave 7 §3.62, is the nearest shape).
- **(pass 1c)** The campaign (MC45 pp. 4–7, 20, 24 and the boxes on pp. 8, 12, 14–20): the mission area, mission side
  schemes (`aoa_mission` 45166a–45170a), Overseer and Prelate minions (`overseer` 45179a–45183a), Mission Team and the
  player campaign cards (`aoa_basic_campaign` 45171a–45176), `aoa_campaign` 45177–45178, the Age of Apocalypse set
  (45164–45165), the expert campaign. Ruling April 30, 2026 – Ruling 4.
- **(pass 2a)** Bishop (45001a/b) and Magik (45030a/b), their nemesis sets, the box's aspect and basic cards; the RRG
  FAQ on Magik (p. 64). **(pass 2b)** Iceman, Jubilee (ruling June 2, 2026 – Ruling 1). **(pass 2c)** Nightcrawler,
  Magneto.
- **(pass 3)** The ordered engine build queue over every §3 row.
