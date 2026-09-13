# Phase 7 working spec: wave 1

This is the shared brief for every agent working Phase 7's first content wave:
- `card-data-pipeline`, `game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer` and `rules-qa-engineer`.
- It turns PLAN.md Phase 7's "Scope decided" and "Pack survey" into concrete schema decisions, per-pack setup needs, and a prioritized list of engine primitives.
- The model is `docs/phase2-core-set.md`. If you change a decision here, update this file in the same change.

**Wave 1** is what released before The Rise of Red Skull:
- the Green Goblin (`gob`) and The Wrecking Crew (`twc`) scenario packs;
- the Captain America (`cap`), Ms. Marvel (`msm`), Thor (`thor`), Black Widow (`bkw`), Doctor Strange (`drs`) and Hulk (`hlk`) hero packs.

RRG 1.8 Appendix VI (p. 71) lists exactly these six hero packs as "wave 1".

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules Reference; FFG rulings clarify both):

1. **Card text and product rules inserts.** Fetched 2026-09-13 from FFG's CDN; the inserts are not in the repo.
   - Green Goblin Scenario Pack insert: `https://images-cdn.fantasyflightgames.com/filer_public/64/7f/647ffff6-141c-407d-af68-b44c683103de/mc02_green_goblin_rules_insert.pdf`
   - The Wrecking Crew Scenario Pack insert: `https://images-cdn.fantasyflightgames.com/filer_public/87/8c/878c0089-00d6-4485-9696-49e623936c6c/mc03_wrecking_crew_rules_insert-compressed.pdf`
   - Doctor Strange Hero Pack rules sheet: `https://images-cdn.fantasyflightgames.com/filer_public/6c/40/6c4068b6-00ee-4060-9855-335b826de33d/mc08_doctor_strange_rulesheet.pdf`
2. **FFG rulings, Dec 17, 2025 to Aug 13, 2026**, transcribed by Hall of Heroes in `marvel-champions-rulings-post-rrg-1-7.md` at the repo root.
   - Cited by date heading.
   - Hall of Heroes is the transcriber, not the authority.
3. **RRG 1.8 (Jul 2026)**, `mc_rulesreference_v18_compressed.pdf` at the repo root.
   - Cited by printed page. The printed page equals the PDF page.
   - The FAQ (Appendix IV) is on pp. 57–64 and the errata (Appendix V) on pp. 65–70.

`packages/content/raw/marvelcdb/{gob,twc,cap,msm,thor,bkw,drs,hlk}.json` is a pointer to card text and stats, not an authority.

---

## 1. Schema decisions (owner: `game-rules-architect`; landed 2026-09-13)

> Status: landed in `packages/content/src/schema/**`, with fixtures in `packages/content/src/schema/wave1.test.ts`. The separate-deck legality rule is in `packages/engine/src/deck.ts`, tested in `deck.test.ts`.
>
> - Every shape the wave 1 survey reports can now be represented (§1.12).
> - Every Core card still validates.
> - No card data was populated; curation is `card-data-pipeline`'s.
> - **Data only until the engine lands:** a card whose data uses a field the engine does not enforce yet (marked "data only" below) must not be marked playable.

### 1.1 Several villains in play at once (The Wrecking Crew)

- **`Scenario.multipleVillains?: MultipleVillains`**
  - `villains: ScenarioVillain[]` (at least two, printed order, the first equal to `Scenario.villainCardId`).
  - `encounterDecks: "perVillain"`, `activation: "activeVillainOnly"`, `winCondition: "allVillainsDefeated"`.
- **`ScenarioVillain`**: `{ villainCardId, encounterSetIds, signatureSideSchemeCardId? }`.
- **`SideSchemeCard.signatureOf?: string`**: the printed "Wrecker's Side Scheme.".
- **`Scenario.usesIdentityEncounterSets?: boolean`** (absent = true) and **`Scenario.modularSetCount?: number`** (absent = 1).
- **Source:** The Wrecking Crew insert.
  - "The Active Villain": "only the active villain will activate during the villain phase … Any card effect that refers to 'the villain' only refers to the active villain. Any card that refers to 'the encounter deck' only refers to the active villain's deck."
  - "Prepare Encounter Decks": "Each villain … has its own encounter deck of 15 cards … Note: Nemesis cards and obligations are not used when playing this scenario."
  - "Signature Side Schemes".
  - "Adjustable Difficulty": "The Wrecking Crew does not use other encounter sets".
- **Why the rules are explicit fields.** They are rules the insert states for this scenario, not consequences of having several villains. A later scenario may state different ones, and the validator rejects any value it doesn't know.
- **Ruling, Jan 17, 2026 (ruling 5):** "In The Wrecking Crew scenario, only the active villain's encounter deck can be interacted with." This decides §3.2.

### 1.2 Villain versions A and B are consecutive stages, not faces

- **`VillainStage.stageLabel?: string`**: the printed `"A"`/`"B"`. `stageNumber` is then the position (A = 1, B = 2).
- Every stage of a side is labelled, or none is.
- Wrecking Crew difficulty ranges: standard `[1, 1]`, expert `[2, 2]`.
- **Source:** Wrecking Crew insert, "Adjustable Difficulty": "put each version-A villain into play … expert mode, put each version-B villain into play … For an extreme challenge, start with each version-A villain in play and put each villain's version B under it. When the version A of a villain is defeated, its version B enters play, and the game is won only after all version-B villains are defeated."
- **Not scenario data.** A per-villain mix of versions and the "extreme challenge" are setup choices (§3.15).

### 1.3 Double-sided villain stage cards (Risky Business)

- **Faces.** A `VillainCard` with two `sides` is a deck of double-sided stage cards: `sides[0].stages[i]` and `sides[1].stages[i]` are the two faces of one card, and both must list the same stage numbers.
- **`VillainCard.startingSide?: "A" | "B"`**, absent = `"A"`.
  - For Risky Business, side A is Norman Osborn, per 1A "Contents: Norman Osborn (I) and Norman Osborn (II)".
  - MarvelCDB has it the other way round: it lists Green Goblin as the top-level record and nests Norman Osborn (`02001a`–`02003a`) as the hidden linked card.
- **`VillainStage.dashedStats?: ("atk" | "sch")[]`**, with the matching numeric field held at 0.
  - Kept beside `atk`/`sch` rather than widening them to `PrintedStat`, so existing readers keep compiling. The engine must read it (§3.3).
  - MarvelCDB encodes a printed dash as an absent field. Norman Osborn has no `attack`; Risky Business's Green Goblin has no `scheme`.
- **Sources:**
  - Green Goblin insert, Risky Business "New Rules": "When the Villain Changes Form", "When a Villain Stage is Defeated" ("the next stage … enters play on the same side"), "When Norman Osborn Attacks" ("Norman Osborn does not have an attack power value").
  - RRG 1.8 "Dash (Value)", p. 15.

### 1.4 Double-sided encounter cards (Criminal Enterprise / State of Madness)

- **`EncounterCardFlipSide`** on `EncounterCardCommon.flipSide?`: the face the card flips to (name, subtitle, traits, keywords, text, abilities, image).
- The top-level fields are the face that enters play.
- Back-face ability ids must not repeat front-face ids.
- A back face of a *different* card type is not modeled; no wave 1 card needs one.
- **Sources:**
  - RRG 1.8 "Double-Sided Card" (p. 17).
  - RRG 1.8 "Flip" (p. 20): "The same card type as the previous face, the card retains all attached cards, tucked cards, status cards, and tokens."

### 1.5 Threat values printed as X (Mutagen Cloud 2B)

- **`MainSchemeStage.printedX?: ("startingThreat" | "targetThreat" | "acceleration")[]`.** Each listed field holds `{ base: 0, perPlayer: 0 }`, and the stage's own ability defines X.
- MarvelCDB encodes it as `escalation_threat: -1`.
- **Source:** RRG 1.8 "Non-Numerical Variable" (p. 30): "If the variable is not defined … treat that variable as being equal to 0."

### 1.6 Attachment hosts

New `AttachmentHost` kinds:

| Kind | Printed example |
|---|---|
| `namedVillain` | "Attach to Wrecker." |
| `scheme` | "Attach to a scheme." |
| `villainSideScheme { of: "activeVillain" \| { villainName } }` | Held Hostage |
| `yourIdentity { form? }` | "Attach to your identity card." (All Tied Up, Media Coverage); "Attach to your hero." (Counterspell) |
| `friendlyCharacter` | Honorary Avenger |
| `qualified { category, trait?, withoutTrait?, withoutAttachmentNamed? }` | later packs' trait-qualified hosts |
| `superlative { among, order, measure, …qualifiers }` | Goblin Glider: "the enemy with the highest printed hit points and without another Goblin Glider attached" |

`minionWithHighestPrintedHp` stays, because Core data uses it.

Sources:
- RRG 1.8 "Attach To" (p. 8): legality is checked "when the card would be attached … If such a card cannot remain in its prior state or game area, discard it."
- RRG 1.8 FAQ "Counterspell (#30)" (p. 60): "Because it is unable to meet its condition, simply discard it. (Do not reveal a new encounter card in its place.)"
- RRG 1.8 "Friendly" (p. 21): "cards the players control".
- RRG 1.8 "First Player" (p. 19): ties on an encounter card's target go to the first player.

In a scenario with one villain, "Attach to Green Goblin" (Hysteria) is still `villain`.

### 1.7 Nemesis minion marker

- **`MinionCard.nemesisMinion?: boolean`**, printed as "(Captain America's nemesis minion.)".
- Wave 1 nemesis sets hold other minions too: Hydra Soldier with Baron Zemo, Edison's Giant Robot with Thomas Edison, Frost Giant with Loki, Hydra Mercenary with Taskmaster. Core's "Reveal your set-aside nemesis minion" therefore cannot mean "a minion in the set".
- **Ruling, Jun 25, 2026 (ruling 4):** "Nemesis sets belong to that identity."

### 1.8 Play restrictions (data only)

New `PlayRestrictions` fields:

| Field | Printed example |
|---|---|
| `maxPerRound` | "Max 1 per round." (Avengers Assemble!) |
| `requiresIdentityTrait` | "Play only if your identity has the Avenger trait." (Honorary Avenger, Quincarrier, Inspiring Presence); "Play only if you have the Mystic trait." (The Sorcerer Supreme) |
| `requiresControlledCharacterTrait` | "Play only if you control a Spy character." (Spycraft, Espionage) |

Sources:
- RRG 1.8 "Max, Maximum" (p. 28): "'Max X per [period]' imposes a maximum number of times that copies of that card can be played … If a card with a maximum is canceled, the card is still counted toward the maximum."
- RRG 1.8 "Play Restrictions and Permissions" (p. 33).
- Honorary Avenger errata (RRG 1.8 p. 65) added "Max 1 per character.", which is the existing `maxPerHost`.

### 1.9 An identity's separate deck (the Invocation deck)

**Schema:**
- **`HeroIdentityCard.separateDecks?: IdentitySeparateDeck[]`**, where `IdentitySeparateDeck` is `{ name, cards: { cardId, quantity }[], topCardFaceup, discardPile: "own", whenEmpty: "reshuffleDiscardWithoutPenalty" }`.
- **`PlayerCardCommon.separateDeck?: string`** on each card of that deck, and such a card must have `deckLimit: 0`.
- `Deck.cards` and `StarterDeck.cards` never list separate-deck cards. The identity defines them, and setup builds the deck.

**Sources:**
- RRG 1.8 "Deck" (p. 15): "Certain identities or scenarios may add other decks to the game."
- Doctor Strange rules sheet, "The Invocation Deck": "he begins each game with a special, five-card 'Invocation deck' in addition to his player deck. To create the Invocation deck, shuffle all five of Doctor Strange's Invocation cards together … play with the top card of the Invocation deck faceup at all times … After that card is resolved, it is placed in a special discard pile that belongs to the Invocation deck. If the Invocation deck is ever empty, shuffle the Invocation discard pile back into the Invocation deck. There is no penalty for doing this."

**Legality rule implemented in `validateDeck`:**
- **Listing a separate-deck card is refused (`separate_deck_card`), and it is not counted toward deck size.** It is not part of the player deck: "in addition to his player deck". RRG 1.8 Appendix I (p. 50) counts only the player deck's cards.
- **Separate-deck cards are not required members of the identity set** (`identity_set_mismatch` skips them). Their contents are fixed, and setup adds them.
- **The identity's separate-deck definitions must be buildable from the pool.** Every listed card must exist and be marked for that deck, and every identity-set card marked for a deck must be listed. Otherwise the report is `missing_card_data`, never a guess.
- **`unscriptedCards` includes separate-deck cards**, because setup brings them into the game.
- **Not subject to the deckbuilding unique rule.** Ruling, Mar 19, 2026 (ruling 6): "The deckbuilding uniqueness rule applies only during deck construction. Any unique cards added during Setup … can share titles with cards in player decks." The Invocation cards are not unique in any case.
- **Linked cards stay out of decks**, unchanged. Ruling, Aug 3, 2026 (ruling 4): "Linked cards cannot be included in decks", which matches `linked_card` and RRG 1.8 "Linked (Card Title)" (p. 27).
- **Data note.** MarvelCDB puts the Invocation cards in set `doctor_strange_invocation_deck` with no `deck_limit`. Curation must give them `aspect: "hero:09001a"`, `deckLimit: 0` and `separateDeck: "Invocation"`, and list all five on `09001a`'s `separateDecks`.

### 1.10 Keywords, and the exact wave 1 wording for `parse-text.ts`

- **Earlier landing:** `linked { cardTitle? }` and `teamUp { names? }`.
- **The five keywords the parser doesn't recognize.** No wave 1 card prints Team-Up, Teamwork, Requirement, Find or Discount.
  - The Thor Hero Pack's **"Teamwork" (06032) is an event title**. The parser must not read a card name as the keyword.
- **RRG 1.8 status of those five** (recorded in `keywords.ts`):
  - "Team-Up" (p. 43), "Teamwork (Trait)" (p. 43) and "Requirement (Resources)" (p. 37) have entries.
  - "Find" (p. 19) is an instruction, not a valued keyword.
  - There is no "Discount" entry.

Printed keyword lines in wave 1, verbatim from the raw text with HTML removed. The parser must accept every variant listed.

| Keyword | Printed forms | Cards |
|---|---|---|
| Guard | `Guard. (While this minion is engaged with you, you cannot attack the villain.)` | 02008, 02024, 03029, 07008, 07023, 07037, 07052, 08028 |
| Surge | `Surge` (no period: 07009, 07024) and `Surge.` (07038, 07053) | Escaped Convict ×4 |
| Quickstrike | `Quickstrike. (After this minion engages your hero, it attacks you.)`, and bare `Quickstrike.` | 02038, 03028 |
| Retaliate | `Retaliate 1.` | 07032, 07033 |
| Restricted | `Restricted. (Max 2 restricted cards per player.)`, and bare `Restricted.` | 03009, 06009; 06019 |
| Toughness | `Toughness. (This character enters play with a tough status card.)` | 06029 |
| Uses | `Uses (3 mental counters).`, `Uses (3 physical counters).`, `Uses (3 medical counters).` (09018 is followed by a reminder); `Uses (3 snoop counters). (Enters play with 3 counters. When those are gone, discard this card)` (no closing period); `Uses (3 reflection counters). Interrupt: …` and `Uses (3 energy counters). Hero Resource: …`, each with an ability on the same line | 03034, 06034, 09018, 09019; 08016; 05017, 05024 |

Granted keywords appear inside ability text, not as keyword lines:
- "gains retaliate 1" (03009, 10010);
- "This attack gains overkill." (06005);
- "the attack gains overkill" (07046, 07047);
- "that attack gains overkill" (10003).

`Setup` appears only as a triggered ability ("Setup:" on 03001b and the main schemes' 1A sides), never as a keyword.

### 1.11 Deliberately not schema

These are engine state or setup configuration, not card data:
- the active villain counter;
- infamy and madness counters (ordinary named counters);
- a per-villain choice of version A or B, and the extreme challenge;
- which face of a double-sided card is up;
- the Invocation deck's order and discard pile.

### 1.12 Survey categories, and raw-data problems curation must fix

Survey (`scripts/marvelcdb/survey.ts`, all eight packs) against the schema:

| Survey category | Resolved by |
|---|---|
| "attach rule shape not recognized" (02019, 02033, 02048, 02049, 03025, 09030) | §1.6 kinds; the parser needs updating |
| "record never turned into a card" (02001a–02003a, 02006b, plus the attachments above) | §1.3, §1.4 |
| "villain stage label is not a roman numeral" (07002–07047) | §1.2 |
| "hero card in a set with no identity" and "deck_limit missing" (09032–09036) | §1.9 |
| "unexpected linked card on an environment" (02006a) | §1.4 |
| "no artwork reference" | art policy for reprints (pipeline), not schema |

Raw-data problems. None is a schema issue, and each needs a curation entry citing its source.

- **Pile It On! (07034)** reads "This card cannot leave play while **Wrecker** is in play." The printed card, shown in the Wrecking Crew insert's setup diagram, reads "while **Piledriver** is in play".
- **Black Widow (08001a)** still reads "After you trigger the ability of a Preparation card". The errata (RRG 1.8 p. 66) changed it to "resolve", and MarvelCDB has no `errata` field for it.
- **Synth-Suit (08009)** has the same problem.
  - RRG 1.8 p. 66 errata: "Changed 'trigger' to 'resolve'."
  - Ruling, Feb 28, 2026 (ruling 2): "Both Black Widow and Synth-Suit should say 'resolve'."
- **Preemptive Strike (05014)** is an event carrying `attack: 3` and `thwart: 1`. Events print no stats, so drop them.
- **Electrostatic Armor (10031)** reads "Player under any player's control." It should read "Play under any player's control." (`anyPlayerControl`).
- Text typos to normalize:
  - **Held Hostage (07005)** reads "attacked scheme"; the other copies read "attached scheme".
  - **Held Hostage (07036, 07050)** reads "the active villain side scheme", missing "'s".
  - **Breakout 1A (07001, 07001a)** reads "Wrecher A".
  - **Avengers Assemble! (03015)** has a stray `</i>`.
- **Main scheme A/B sides in wave 1 are consistent**, unlike Hood, Mad Titan's Shadow and Mutant Genesis. The top-level double-sided record's `text` is side B and its `back_text` is side A, matching the `…a`/`…b` pair. Each stage appears as both a combined record and an `a`/`b` pair, so emit it once.
- **Stats.** A printed "—" is an absent field in MarvelCDB; a 0 is `0`.
  - Taskmaster (08026) is ATK 0★ / SCH 0★.
  - Hulk (10001a) is THW 0.
  - Guard minions 02008, 07008, 07023, 07037, 07052 and 08028 have SCH `0`. Check a card image before emitting any of these as 0 rather than "—", as Core's provenance did for the Hulk ally.

---

## 2. Per-pack setup needs

Quantities are MarvelCDB `quantity`.

### 2.1 Hero packs

- **Obligation.** Each identity's obligation is shuffled in at RRG 1.8 Appendix II step 10, after being set aside at step 4 (p. 51).
- **Nemesis set.** Each nemesis set is set aside at step 5.
- **Other setup.** Identity `Setup:` abilities resolve at step 16.

| Pack | Identity | Obligation | Nemesis set (nemesis minion in bold) | Other setup |
|---|---|---|---|---|
| `cap` | Captain America / Steve Rogers (03001a/b) | Man Out of Time (03026) | **Baron Zemo** (03028), Hydra Soldier ×2, Hit Squad (side scheme), Hail Hydra! | Steve Rogers `Setup:` search deck and discard for Captain America's Shield. FAQ "Steve Rogers (#1B)" (p. 59): only the deck and discard are searched. |
| `msm` | Ms. Marvel / Kamala Khan (05001a/b) | Home by Dawn (05025) | **Thomas Edison** (05027), Edison's Giant Robot, Generation Why?, Harvest ×2 | none |
| `thor` | Thor / Odinson (06001a/b) | Odin's Anger (06026) | **Loki** (06028), Frost Giant ×2, Family Feud, Trickster | none |
| `bkw` | Black Widow / Natasha Romanoff (08001a/b) | Burn Notice (08025) | **Taskmaster** (08026), Hydra Mercenary ×2, Killer for Hire, Deadly Shot | none |
| `drs` | Doctor Strange / Stephen Strange (09001a/b) | Physical Toll (09027) | **Baron Mordo** (09028), Open the Dark Dimension, Counterspell ×2, Thoughtcasting | Build the Invocation deck from 09032–09036, shuffled and set beside the identity with the top card faceup (§1.9, §3.5). |
| `hlk` | Hulk / Bruce Banner (10001a/b) | Inner Demons (10025) | **Abomination** (10026), Total Destruction, Clash of the Titans ×3 | none |

### 2.2 Green Goblin scenario pack

- **Scenario rules.** The insert, "How to Use This Pack": the 1A "Contents" name the villain and sets. "Then, follow the standard setup rules."
- **Modular sets.** Any number of modular sets may be used: "include no modular encounter sets for an easier challenge or multiple sets for a greater challenge". The scenario's `modularSetCount` is the printed recommendation (1), and setup must accept any count.

**Risky Business**:
- **Villain.** Norman Osborn I–II (standard) / II–III (expert), double-sided with Green Goblin, starting on Norman.
- **Encounter sets.** Risky Business, Standard (plus Expert in expert mode), and one modular set (recommended: Goblin Gimmicks).
- **Main scheme.** Hostile Takeover (1A/1B) → Corporate Acquisition (2A/2B).
  - 2B completing loses the game.
  - 1B has a **When Completed**.
- **Setup (1A).** "Put the Criminal Enterprise environment into play. Shuffle the encounter deck. Advance to stage 1B."
- **Criminal Enterprise.** It enters with 2[per_hero] infamy counters, and flips with the villain.
- **New rules (insert).**
  - "When the Villain Changes Form"
  - "When a Villain Stage is Defeated"
  - "When Norman Osborn Attacks"
  - "When Green Goblin Schemes"
  - "When Revealed (Green Goblin) / When Revealed (Norman Osborn)"
  - See §3.3, §3.4 and §3.6.
- **FAQ (RRG 1.8):** "Norman Osborn (#1A)" (p. 58), "Green Goblin (#1B)" and "I See You (#30)" (p. 59).

**Mutagen Formula**:
- **Villain.** Green Goblin I–II / II–III, single-sided.
- **Encounter sets.** Mutagen Formula, Standard (plus Expert), and one modular set (recommended: Goblin Gimmicks).
- **Main scheme.** Unleashing the Mutagen (1B has **When Completed**) → Mutagen Cloud (2B acceleration X = the number of Goblin enemies, including Green Goblin).
- **Setup (1A).** "Put a Goblin Thrall minion into play engaged with each player. Shuffle the encounter deck. Advance to stage 1B."
- **Insert, "Goblin Minions Activation Timing."** A Goblin Soldier or Goblin Thrall put into play by its boost during step 2 activates in that step (§3.9).

**Modular sets:**
- Goblin Gimmicks: Goblin Glider ×2, Pumpkin Bombs ×2, Intimidation ×2, Regenerative Healing ×2.
- A Mess of Things: A Mess of Things, Scorpion, Gang-Up, Tail Sweep ×2.
- Power Drain: Power Drain, Electro, Electromagnetic Pulse, Lightning Bolt, Shock Therapy.
- Running Interference: Running Interference, Tombstone, All Tied Up, Media Coverage ×2.

### 2.3 The Wrecking Crew scenario pack (Breakout)

- **Villains.** Wrecker, Thunderball, Piledriver and Bulldozer, all in play at once.
  - Version A for standard, B for expert, or a mix.
  - The "extreme challenge" puts A in play with B under it.
- **Hit points.** Each villain has its own hit point dial ("Prepare Villains and Dials").
- **Encounter decks.** Four villain decks of 15 cards each, built from the villain's set, excluding the villain and its signature side scheme.
- **No other encounter sets.** No Standard, Expert or modular set, and no obligations or nemesis sets (insert).
- **Signature side schemes.**
  - Day of Reckoning (Wrecker), Thunderstruck (Thunderball), Pile It On! (Piledriver), Clear the Road (Bulldozer).
  - Each is placed "directly above its corresponding villain" at setup, by 1A's `Setup:`.
- **Main scheme.** Breakout, a single stage (1A/1B). 1B: "If this stage is completed, the players lose the game."
- **Setup (1A).** "Put the Day of Reckoning, Thunderstruck, Pile It On!, and Clear the Road side schemes into play. Place the active counter on Wrecker. Advance to stage 1B."
- **1B.** "Forced Response: After step one of the villain phase, place 1 threat on each side scheme. Move the active counter to the villain whose scheme has the most threat. (If there is a tie, the first player chooses.)"
- **Errata (RRG 1.8 p. 65).** "I've Been Waiting For This!" (#41): "gains" became "heals". The raw data already has it.

---

## 3. Engine primitive gaps for wave 1 (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names below say where each primitive is needed.

**Priority order:**
- **First, state-shape changes that would force rewriting scripts:** §3.1–§3.5.
- **Then activation and resolution primitives** that many cards share: §3.6–§3.11.
- **Last, the vocabulary tail:** §3.12–§3.15.

**Status (2026-09-13).** §3.1–§3.4 are implemented and tested in `packages/engine`; each section's status note below says what landed, which test file proves it, and which §4 reading it uses. Sections without a status note are not implemented yet.

### 3.1 Several villains, and the active villain

**Rules:**
- The Wrecking Crew insert, "The Active Villain" (quoted in §1.1); plus "When the active villain is defeated, move the active counter to the villain whose side scheme has the most threat. (In case of a tie, the first player decides.) Note: Players may attack any villain or thwart any scheme regardless of which villain is the active villain."
- The same insert, "Multiple Villains and Encounter Decks": "When a villain is defeated, their side scheme is also removed from the game. Any encounter cards from that villain's deck that are in play remain in play. If the players defeat all 4 villains, they win the game!"
- RRG 1.8 "Guard" (p. 21): "that player cannot use cards they control to attack a villain without this keyword … 'The engaged player cannot attack any villain.'" Guard therefore blocks attacks on every villain, not only the active one.
- RRG 1.8 "Villain Defeat" (p. 47) applies to each villain separately.

**State.**
- Replace `GameState.villain: VillainState` with `villains: readonly VillainState[]` (printed order) and `activeVillainId: InstanceId`.
- **Single-villain scenarios** get a list of one, and are otherwise unchanged.
- **`VillainState`** gains `encounterDeckId` (§3.2) and `signatureSideSchemeId: InstanceId | null`.
- **The active counter** is the field, not an entry in `counters`: it is scenario state with its own rules. It is logged as `activeVillainChanged { from, to, reason }`.
- **`GameOutcome`** gains `{ result: "win"; reason: "allVillainsDefeated" }`.

**Resolution.**
- **Two meanings of "the villain."** The 43 non-test reads of `state.villain` split into:
  - "the villain" (active): `TargetRef { kind: "villain" }`, villain phase activation, boost targets, overkill onto "the villain";
  - "a villain" (any undefeated): attack targets in `legalActions`/`actions.ts`, Guard's check in `select.ts`, `TargetCategory "villain"`, stat and keyword lookups per instance.
  - Helpers: `activeVillain(state)` and `villainStageOf(state, instanceId)`.
- **Moving the counter.** New `EffectSpec setActiveVillain { villain: TargetRef }`, used by Breakout 1B, Escaped Convict, Buddy System, Crowbar Toss and I've Been Waiting For This!.
- **Superlative ties.** A superlative villain selector ("the villain whose side scheme has the most/least threat") is §3.12's superlative. On encounter cards, ties are a `PendingChoice` with `authority: "firstPlayerTargets"` (`villain/authority.ts`).
- **Defeating a villain's last stage:**
  - mark it defeated;
  - remove its signature side scheme from the game (it is not "defeated": no When Defeated, no discard);
  - leave its encounter cards in play;
  - if it was active, choose the next active villain as above;
  - win when every villain is defeated.
- **The extreme challenge** is ordinary stage advance, A to B.

**Interactions:**
- **Turn structure.** Villain phase step 2 (`villain/phase.ts` `executeEnemyActivations`) activates `activeVillain(state)`, read at each player's activation, not fixed at the start of the step. The counter can move between two players' activations (Escaped Convict's boost, a treachery surged into step 2), and the insert says only "the active villain will activate". Minions activate as before.
- **Unique rule.** RRG 1.8 "Unique Icon" (p. 46) exempts villains ("A non-villain card …"), so four unique villains and a flipped villain never conflict.
- **`legalActions`** lists every undefeated villain as an attack target unless Guard or a rule (§3.11 `cannotAttack`) forbids it.

**Tests:**
- setup with 4 villains, 4 signature side schemes, and Wrecker active;
- step 2 activates only the active villain once per player, and minions still activate;
- moving the counter between two players' activations changes which villain attacks the second player;
- Guard forbids attacking every villain;
- attacking a non-active villain is legal;
- defeating a non-active villain removes its side scheme from the game and keeps its encounter cards in play;
- defeating the active villain moves the counter, and a tie becomes a first-player choice with `firstPlayerTargets`;
- the win comes only after the last villain;
- extreme A→B;
- every single-villain Core test unchanged;
- replay deep-equal.

### 3.2 An encounter deck per villain, and discard routing

**Rules:**
- The insert, "The Active Villain": "When the villain is dealt a boost card, it is dealt from the active villain's deck. When a player is dealt an encounter card, it is dealt from the active villain's deck."
- The insert, "Multiple Villains and Encounter Decks": "When an encounter card leaves play, it is placed in the discard pile of its corresponding encounter deck. When a villain's encounter deck is empty, shuffle its discard pile back into its encounter deck and place an acceleration token on the main scheme."
- **Ruling, Jan 17, 2026 (ruling 5):** "only the active villain's encounter deck can be interacted with. Playing Cosmic Entity shuffles it into the active villain's encounter deck … [the nemesis minion] once defeated, it is placed in the active villain's encounter discard pile."
- RRG 1.8 "Encounter Deck" (p. 17).

**State.**
- `encounterDecks: Readonly<Record<EncounterDeckId, { deck: InstanceId[]; discard: InstanceId[] }>>` replaces `encounterDeck` / `encounterDiscard`. Single-villain scenarios have one deck.
- `ZoneId` `encounterDeck` / `encounterDiscard` gain `deckId`.
- **Card homes.** Every `CardInstance` gets a `home` saying where "discard" sends it:
  - `{ kind: "encounterDeck"; deckId }`, fixed at setup from `encounterSetIds ∩ ScenarioVillain.encounterSetIds`;
  - `{ kind: "player" }`;
  - `{ kind: "separateDeck"; name }` (§3.5).
  - This one field serves both §3.2 and §3.5.

**Resolution.**
- **The "encounter deck" is resolved in one place.** Every reference (`drawEncounterCard`, boost dealing, `dealEncounterCard`, `revealTopOfEncounterDeck`, `discardEncounterUntil`, `shuffleEncounterDeck`, the `CardSelector` `encounter` zones) resolves through `activeEncounterDeck(state)`.
- **Discards** go to the card's `home` deck.
  - A card with no encounter home (a nemesis card, or an obligation from another scenario's rules) goes to the active villain's discard, per the ruling.
- **An empty deck** reshuffles its own discard and adds an acceleration token to the main scheme.

**Interactions:**
- **`PendingChoice`**: none new.
- **Every existing Core scenario** must still see exactly one deck.
- **Reveal procedure (`resolve/reveal.ts`)**: the card being revealed keeps its home for its discard.

**Open (§4.2, §4.3):**
- Buddy System's "Reveal the top card of *his* deck" names a non-active deck.
- It is not stated whether treacheries and boost cards, which never enter play, use their corresponding discard.

**Tests:**
- dealing, boosting and surging draw from the active deck;
- a defeated minion from Wrecker's deck goes to Wrecker's discard while Thunderball is active;
- a nemesis minion defeated in Breakout goes to the active villain's discard (Jan 17, 2026 ruling 5);
- emptying one deck reshuffles only that deck and adds exactly one acceleration token;
- Core scenarios unchanged.

### 3.3 Villain stage cards with two faces

**Status: landed.** Tests: `packages/engine/src/flip.test.ts` ("§3.3" block).
- `EffectSpec flipCard { target }` covers villains and double-sided encounter cards (§3.4); the spec's `flipVillain` is that effect on a villain. A villain with one side is not flipped.
- "When Revealed (Face Name)" is `Predicate faceNamed { of, name }` rather than `villainFace`: it reads a villain's side or a flipped encounter card's face. `currentName` in `query.ts` is the one reader of the title showing.
- `activateEnemy` and `EffectSpec enemyAttack/enemyScheme` now check stun/confuse **before** anything else (FAQ #1A, p. 58), then initiate the activation even for a "—" stat so a "would attack … instead" interrupt has an event to replace. **§4.4 reading:** an activation nothing replaces is skipped when it applies (`dashedStatSkipsActivation` in `resolve/enemy-activation.ts`, logged as `activationSkipped`): no boost card, no responses, `made` 0. An attack already in progress keeps going for 0 plus boost icons (FAQ #1B).
- Stage advance keeps `side`. The RRG 1.8 "Villain Defeat" (p. 47) different-title branch is not modeled: every stage of one schema side shares its title.

**Rules** (Green Goblin insert, Risky Business "New Rules"):
- "After the villain changes form, all attachment cards, status cards, boost cards, damage, and other game elements associated with the villain remain as they are. Changing form will trigger Green Goblin's 'When Revealed' ability."
- "After a villain stage is defeated, the next stage of the villain deck enters play on the same side as the just defeated stage."
- "If an ability reads 'When Revealed (Green Goblin)', that ability triggers only if the Green Goblin side of the villain is in play."
- RRG 1.8 "Flip" (p. 20): same type, so everything is retained.
- RRG 1.8 "Dash (Value)" (p. 15): "treated as an unmodifiable 0".
- FAQ "Norman Osborn (#1A)" (p. 58): "Because status cards take priority over all other abilities, a stun status card will prevent Norman Osborn's activation."
- FAQ "Green Goblin (#1B)" (p. 59): when the last madness counter is removed by a boost during Green Goblin's attack, "Green Goblin immediate flips to Norman Osborn form. Boost icons from the boost card are then added to Norman Osborn's ATK value of –, which is treated as a value of 0 … Norman Osborn's 'Forced Interrupt' does not trigger, as the attack is already past the point of 'When Norman Osborn would attack...'".

**State.** `VillainState.side` already exists. Log `villainFlipped { instanceId, from, to }`.

**Resolution.**
- **`EffectSpec flipVillain { villain }`**:
  - changes `side` and keeps everything else on the instance;
  - then resolves the new face's When Revealed (not cancellable; RRG 1.8 "When Revealed Abilities", p. 48).
- **An activation in progress continues** with the new face's values (FAQ #1B).
  - This differs from RRG 1.8 "Villain Defeat" (p. 47), where a stage with a different title ends the activation; a flip is not a defeat.
- **Stage advance keeps `side`**, which the current code already does. It carries attachments and statuses only when the new stage's title matches (p. 47), so compare titles instead of assuming Core's same-title villains.
- **Dash stats.** `characterProfile` reads `dashedStats` for villain stages. A dashed stat is 0 for every read, and boost icons still add during an activation (FAQ #1B).
- **"When Revealed (Face Name)"** is a new `Predicate villainFace { villain, name }`.

**Interactions:**
- The stun check stays before any "would attack" interrupt window. `activateEnemy` already does this.
- No unique-rule impact, since villains are exempt.

**Open (§4.4):** whether a villain with a dashed ATK *initiates* an attack at all when nothing replaces it. The Core decision for "—" minions was to skip the activation.

**Tests:**
- a flip retains damage, statuses, attachments and boost cards;
- a flip resolves the new face's When Revealed;
- defeating Green Goblin I enters Green Goblin II;
- defeating Norman I enters Norman II;
- FAQ #1A: stun prevents the activation and the counter placement;
- FAQ #1B: a flip mid-attack deals 0 plus boost icons, and the would-attack interrupt does not fire;
- FAQ "I See You (#30)" (p. 59): an alter-ego player is still attacked;
- the "(Norman Osborn)" When Revealed is skipped while Goblin is up.

### 3.4 Double-sided encounter cards that flip, and state-based conditions

**Status: landed.** Tests: `packages/engine/src/flip.test.ts` ("§3.4" block).
- `CardInstance.flipped`; `encounterFace` / `currentName` in `query.ts` give the face's name, traits, keywords and abilities (`activeAbilityRefs`, `printedKeywordsOf`, `traitsOf`, `named`, `TargetQuery.name`).
- `AbilityTriggerSpec { kind: "stateCheck", when }` with `resolve/state-checks.ts`, called by `runFlow` before every frame and step (not inside `checkDefeats`, which only runs after damage). Last values live in `GameState.stateChecks`. Registries without a state check skip the scan, so Core is unaffected.
- **Edge-triggered, and a first observation only records.** A card entering play or flipping to a face with its condition already true does not fire until the condition has been false once. That is what lets "enters play with N counters" stay a forced response to `cardEntersPlay` (the Hawkeye pattern) without racing the check.
- **§4.1 reading:** the new face's "enter play with N counters" applies on a flip. The engine does not do it by itself; a script adds the counters as a forced response to its own `cardFlipped`, as the test does.
- A double-sided card leaving play for any out-of-play area but the victory display or set-aside area is removed from the game (RRG 1.8 "Double-Sided Card", p. 17), in `leavePlay`. Direct moves that skip `leavePlay` (a boost or treachery discard) do not apply it; no wave 1 double-sided card reaches those paths.

**Rules:**
- Criminal Enterprise: "Criminal Enterprise enter play with 2[per_hero] infamy counters on it. If there are no infamy counters here, flip Norman Osborn and Criminal Enterprise."
- State of Madness: "State of Madness enter play with 2[per_hero] madness counters on it. If there are no madness counters here, flip Green Goblin and State of Madness."
- RRG 1.8 "Flip" (p. 20).
- **Flipping is not revealing.** Rulings Jan 26, 2026 (ruling 4, answer 2): "flipping environments are not revealed from the deck". Also Apr 30, 2026 (ruling 3, answer 3) and Jun 25, 2026 (ruling 4, answer 3): "Environments flip, they are not revealed."

**State.** `CardInstance.flipped: boolean`. A face accessor returns name, traits, keywords and abilities from `flipSide` while flipped; `named` targets and `hasTrait` read the current face. Log `cardFlipped`.

**Resolution.**
- **`EffectSpec flipCard { target }`**: no reveal, no When Revealed, and reveal-cancel responses cannot trigger.
- **Condition-triggered forced abilities.** A trigger kind `{ kind: "stateCheck", when: Predicate }` fires once each time its predicate becomes true.
  - It is checked in the same place defeat checks run, between frames in `resolve/defeat.ts`, so FAQ #1B's mid-attack flip happens immediately.
  - It is edge-triggered, so it cannot loop on a condition that stays true.
  - RRG 1.8 "Uses" (p. 46) is the same shape: "If there are no all-purpose counters on this card, discard this card."
- **"Place 1 infamy counter on Criminal Enterprise. If you cannot, remove 1 madness counter …"** is `addCounters { bind }` plus `if not made`. "Cannot" is true when no card with that face name is in play.

**Open (§4.1):** whether the new face's "enter play with N counters" applies on a flip. Without it, State of Madness flips back immediately.

**Tests:**
- a flip retains attachments and tokens;
- a flipped environment does not fire reveal responses (rulings above);
- the state check fires once when the last counter is removed;
- the state check fires mid-attack in FAQ #1B's order;
- `named` resolves the current face only.

### 3.5 An identity's separate deck as a zone (Invocation)

**Status: landed.** Tests: `packages/engine/src/separate-deck.test.ts`.
- `PlayerState.separateDecks`, `ZoneId separateDeck / separateDiscard`, `CardHome separateDeck`; built from `HeroIdentityCard.separateDecks` and shuffled right after that player's deck (Core identities have `{}`, so Core's RNG sequence is unchanged).
- The top card's `faceup` is kept by `syncSeparateDeckTop` (`ctx.ts`), run by `moveCard` and every shuffle.
- `CardSelector separateDeck { player, name, zones?, top?, filter? }`; destinations `separateDiscard`, `separateDeckTop`, `separateDeckShuffle` follow each card's `home`. `discardZoneFor` routes a separate-deck card to that deck's discard, which covers tucked cards.
- `CardZoneQuery` gains `zone: "separateDeck"`, `separateDeck` and `top`, so `payPrintedCostOf` can name "the top card of the Invocation deck"; `legalActions` offers only that card.
- `EffectSpec resolveSpecials` gains `of: TargetRef` (a card wherever it is); `cards` became optional. No `cardPlayed` is emitted.
- **Reshuffle** is `resolve/separate-decks.ts` `resetEmptySeparateDecks`, called by `runFlow` before every frame: no encounter card, no acceleration token, logged as `separateDeckReset`.
- **§4.9 reading:** the resolving card is in the deck until its own last sentence moves it to the discard pile, so a card that empties the deck is shuffled back in. This conflicts with the analogy to ruling Apr 30, 2026 (3) answer 7 ("reshuffled **before** the currently resolving card enters the discard pile", said of a player deck); flagged.
- Player elimination leaves the separate deck where it is; nothing reads it afterwards.

**Rules:**
- The Doctor Strange rules sheet (§1.9).
- RRG 1.8 "Deck" (p. 15) and "Special" (p. 40): "Special abilities may only be resolved through the explicit instruction of another card ability."
- FAQ "Depowered (#20)" (p. 60): "The abilities on cards in the Invocation deck are merely resolved, not played."
- Contrast "Player Deck" (p. 33): an empty deck deals an encounter card. The Invocation deck has "no penalty".

**State.**
- `PlayerState.separateDecks: Readonly<Record<string, { deck: InstanceId[]; discard: InstanceId[] }>>`.
- `ZoneId { kind: "separateDeck" | "separateDiscard"; playerId; name }`.
- Built at setup, alongside player deck shuffling (Appendix II step 6, p. 51), from `HeroIdentityCard.separateDecks`, shuffled with the game RNG.
- The owner is that player (RRG 1.8 "Ownership and Control", p. 31).
- The top card's `faceup` is kept true whenever `topCardFaceup`, updated on every change to the zone, so clients see it without a rule of their own.

**Resolution:**
- **`CardSelector { kind: "separateDeck", player, name, top? }`**, with destinations `separateDiscard`, `separateDeckTop` and `separateDeckShuffle`.
- **Discard routing.** "Discard" of a card whose `home` is a separate deck goes to that deck's discard (§3.2's `home`). This includes RRG 1.8 "Tuck" (p. 45) discards when a host leaves play.
- **Reshuffle when empty.** Whenever the deck is empty and its discard is not, the discard is immediately shuffled in, with no encounter card and no acceleration token.
- **Spell Mastery and Master of the Mystic Arts** use existing `payPrintedCostOf` over the new selector, then `resolveSpecials`.
  - Resolving a Special is not playing a card: no `cardPlayed` event, so Counterspell, Morphogenetics, Physical Toll and "Max" limits do not see it.
  - The card stays on top of the deck until its own last sentence moves it.
  - Master of the Mystic Arts' "Then, place it back on top of the Invocation deck faceup" moves it from the Invocation discard back to the top.
- **Open the Dark Dimension:**
  - When Revealed: `tuckCards { facedown: true }` from the top of the Invocation deck.
  - When Defeated: `moveCards { to: separateDeckShuffle }`.
- **Natural Talent and Wong** discard the top card.
- **Limits.** "Limit once per phase" is keyed by identity instance and persists across flips. Ruling, Jan 26, 2026 (ruling 6, answer 2): "Limits apply to cards. An identity never leaves play when flipping."

**Interactions:**
- **`legalActions`** offers Spell Mastery only when the top card's cost can be planned (`planCost`).
- **Unique rule**: no effect (§1.9).
- **Player elimination** (RRG 1.8 "Player Elimination", p. 34): the zone leaves with the player, like their deck.

**Tests:**
- setup builds and shuffles the 5-card deck with the top card faceup;
- Spell Mastery pays the printed cost, resolves the Special, and the card lands in the Invocation discard, not the player discard;
- emptying the deck reshuffles with no encounter card dealt;
- Master of the Mystic Arts returns the card to the top faceup;
- a Special is not "played": Counterspell does not trigger;
- Open the Dark Dimension tucks the top card facedown, and its When Defeated shuffles it back;
- the scheme leaving play otherwise sends the tucked card to the Invocation discard;
- replay deep-equal.

### 3.6 Enemy activations: replacement, redirection, suppression and queued attacks

**Status: landed.** Tests: `packages/engine/src/activation-wave1.test.ts`, plus FAQ #1A / #1B in `flip.test.ts`.
- **"Would" replacement** needed no new primitive: the `enemyAttack` / `enemyScheme` event's interrupt window already sits after the status check (moved there in §3.3) and before step 1, and `replaceTriggeringEvent` cancels the event, so no boost card is dealt and nothing responds.
- **Deviation: `enemyActivated` is still logged for a replaced step-2 activation.** It is the villain audit's and the client log's record that the step-2 activation came up (the audit's `step2.villainOnce` would otherwise flag a replaced Norman). The cancelled `triggerEvent` is what marks that no attack was performed.
- `RuleSpec schemeThreatDestination { enemy, scheme: "ownSignatureSideScheme", while? }` (`rules.ts`), read by the scheme procedure's step 3. It falls back to the main scheme when the signature side scheme is not in play.
- `EffectSpec enemyAttack` gains `boost: false`, `targetCharacter` and `after: "currentActivation"`; `enemyScheme` gains `boost` and `after`. `boost: false` sets `noBoost` on the trigger event and procedure frame. It deals no boost card at all, additional ones included, and the audit's `boost.villain` count skips it.
- `after: "currentActivation"` appends to the activation event's `endEffects`, which run after its response window. Several queued activations resolve in the order they were queued; the first player is **not** asked to order them (RRG 1.8 "Activation", p. 6) — not needed in wave 1.
- `excessDealt` is reported by every `dealDamage` event and added to its parent attack's results, measured before tough / "cannot take damage" (ruling, Jan 26, 2026 (3)). It uses the amount after interrupts, so a prevention interrupt lowers it; ruling Mar 6, 2026 (1) says prevention reduces damage *taken*. Flagged; no wave 1 card combines the two.
- `TargetRef villainOfSideScheme { scheme }` and `signatureSideSchemeOf { villain }`.

**Rules and cards:**
- **Norman Osborn's "would" interrupts.**
  - "Forced Interrupt: When Norman Osborn would attack, place 1 infamy counter on Criminal Enterprise instead."
  - The insert: "cards that trigger when the villain attacks do not resolve because no attack activation was performed". The same applies to Green Goblin's "would scheme".
  - "When Norman Osborn would take any amount of damage, remove that many infamy counters from Criminal Enterprise instead."
  - FAQ #1A (p. 58): status cards come first, so a tough status card is used before this replacement.
  - RRG 1.8 "Replacement Effect" (p. 37).
- **Threat redirected to a side scheme.** "When Wrecker schemes, place the threat on his side scheme instead of the main scheme." The four Wrecking Crew villains print it as a constant ★ ability, not a bold trigger.
- **Boost suppression.**
  - "That attack does not get a boost card." (Escaped Convict)
  - "do not give the villain a boost card for this activation" (I See You)
  - Ruling, Feb 28, 2026 (ruling 6): a boost card goes only to an activating villain.
- **A follow-up activation queued behind the current one.**
  - "that villain attacks you after this attack" (Escaped Convict's boost).
  - RRG 1.8 "Activation" (p. 6): "the newly initiated activation resolves after the current activation has finished resolving".
  - Ruling, Feb 28, 2026 (ruling 1, answer 2): "All abilities triggered by an ongoing attack (including Responses and Retaliate) resolve before a newly initiated attack begins."
- **Excess damage placed as threat.**
  - "Excess damage dealt by Thunderball is placed as threat on his corresponding side scheme." (Radioactive Buildup)
  - Ruling, Jan 26, 2026 (ruling 3): "Excess Damage is damage dealt beyond remaining hit points."
- **An attack against a chosen character.**
  - "The enemy with the highest ATK attacks the hero or ally with the highest ATK" (Clash of the Titans).
  - RRG 1.8 "Attacks Against Allies" (p. 10).
  - FAQ "Clash of Titans (#28)" (p. 60): "The ally will take all damage from the undefended attack."
- **"The villain corresponding to the attached side scheme attacks you"** (Held Hostage).

**Model:**
- `enemyAttack` / `enemyScheme` trigger events get a "would" interrupt window at initiation, after the status check and before boost dealing, where `replaceTriggeringEvent` applies. A replaced activation emits no `enemyActivated` and deals no boost.
- A constant `RuleSpec schemeThreatDestination { enemy: TargetQuery, scheme: "ownSignatureSideScheme" }` read by `executeEnemySchemeFrame`.
- `EffectSpec enemyAttack` gains `boost?: false`, `targetCharacter?: TargetRef` and `after?: "currentActivation"`. The last is a queue on the running activation frame, drained when it completes.
- Attack results gain `<bind>.excessDealt`.
- `TargetRef villainOfSideScheme { scheme }`.

**Tests:**
- Norman's replacement: no attack trigger fires, no boost is dealt, and the stun is still consumed first;
- Wrecker's scheme places threat on Day of Reckoning, and "after threat is placed here" responses fire there;
- a no-boost attack deals zero boost cards;
- a queued attack starts only after Retaliate and responses to the first attack;
- excess damage from a defended attack on an ally becomes threat;
- an undefended attack on an ally damages the ally (FAQ).

### 3.7 Indirect damage

**Status: landed.** Tests: `packages/engine/src/indirect-damage.test.ts`.
- `EffectSpec dealIndirectDamage { to: PlayerRef | "group", amount, bind? }`, resolved in `resolve/effects-frame.ts`.
- **Assignment.** Each player gets one `assignIndirectDamage` choice (`authority: "player"`, `caps` per character = remaining hit points). Its options are `<instanceId>#1…#cap`, one damage per selected option, and exactly the assignable amount is selected.
- **What is eligible.** Characters that cannot take the damage are left out. A split with one eligible character, or with every cap reached, is made without asking. Damage nobody can be assigned is ignored.
- `"group"`: the first player divides it among every friendly character (§4.7).
- **Simultaneous resolution** is a new stack frame, `damageGroup` (`resolve/damage-group.ts`):
  1. each member's interrupt window, as a real `dealDamage` event frame marked `group`, so prevention applies per character (ruling, Aug 3, 2026 (2));
  2. every member's damage, then one defeat sweep;
  3. every member's response window with its results. No "attacked" event is produced.
- **Simplification:** with "each player", players assign in player order. The first player is not asked to pick that order, because the assignments are independent and resolve together.
- **Not built:** indirect damage from an enemy attack's step 4 (no wave 1 source).
- **For `packages/cards`:** `dsl/validate.ts` `bindsOf` does not list `dealIndirectDamage`, so a script reading `<bind>.amount` from it would be flagged until a case is added.

**Rule.** RRG 1.8 "Indirect Damage" (p. 24):
- "Indirect damage dealt to a player can be divided as that player chooses among characters under their control."
- "Indirect damage dealt to a group of players … can be divided as the group chooses among friendly characters in play."
- "All indirect damage from a single source is first assigned and then resolved simultaneously."
- "a character cannot be assigned more indirect damage than would cause it to be defeated … A character with a tough status card can be assigned indirect damage up to its remaining hit points."
- "Characters that cannot take damage cannot be assigned indirect damage … that damage is ignored."
- From an enemy attack, it is dealt in step four, and only the defender, or the identity if undefended, "is considered to have been attacked".
- Ruling, Aug 3, 2026 (ruling 2, answer 1): a reduction applies to indirect damage assigned to that character.

**Cards:** Green Goblin (Risky Business) I–II, Pumpkin Bombs, Electro, Lightning Bolt.

**Model.**
- Generalize Core's `assignDamage` into `dealIndirectDamage { to: PlayerRef | "group", amount }`:
  - one `PendingChoice { kind: "assignIndirectDamage", caps }` per player, or one for the group;
  - then one simultaneous window of `dealDamage` events, one per character;
  - no "attacked" event for assignees.
- **"Each player"** resolves in player order (RRG 1.8 "Each Player", p. 17).
- **Authority.** A player's own assignment is `player`. For the group decision, see §4.7.

**Tests:**
- caps at remaining HP;
- a tough character can be assigned up to its remaining HP and all of it is prevented;
- cannot-take-damage characters are excluded;
- damage nobody can take is ignored;
- simultaneous resolution means Responses see every instance.

### 3.8 Scheme values, When Completed, and signature side schemes

**Status: landed.** Tests: `packages/engine/src/scheme-values.test.ts`.
- **Scheme values.** `SchemeValueName` (`acceleration`, `targetThreat`, `startingThreat`) are modifier stat keys. `query.ts` `mainSchemeValue` applies `printedX` as 0, then `setBase`, then modifiers; `startingThreatOf` does the same for side schemes. Every engine reader goes through them: step 1, completion, advance, setup, side schemes entering play, and the villain audit's step-1 check.
- **When Completed.** `AbilityTriggerSpec whenCompleted` resolves before the advance, which is queued as the new `EffectSpec advanceMainScheme`. A completion is not re-detected while that advance is pending. A final stage's completion loses with no When Completed. Scenarios without one advance exactly as before.
- `RuleSpec cannotLeavePlay` (checked in `leavePlay`, logged `leavePlayBlocked`) and `RuleSpec notDefeatedWithoutThreat` (checked where a side scheme reaches 0). `TargetQuery.signatureSideScheme` selects signature side schemes.
- **"Remove all but 3"** needed no primitive: `removeThreat` with `scaled { threat, plus: -3 }`.
- `EffectSpec moveThreat { from, to, amount?, bind? }` is a removal then a placement. **§4.8 is settled** by RRG 1.8 "Move" (p. 30): moved threat is removed from the source and placed on the destination. Every event now reports `forcedResponses` (only when non-zero) for "if that scheme's Forced Response is not triggered".
- **Not routed:** a player side scheme's starting threat (`play-card.ts`). Target threat is only re-checked when threat is placed, so a target-threat modifier leaving play does not complete the scheme by itself.
- **For `packages/client` / `packages/cards`:** `board-model.ts`, `game-over-model.ts` and `cards/src/testing/driver.ts` read the printed `targetThreat`/`startingThreat`; they should read `mainSchemeValue` to match the engine once modifiers exist.

**Rules and cards:**
- **X acceleration.** Mutagen Cloud 2B: "X is equal to the number of Goblin enemies (including Green Goblin) in play."
- **Target threat modifier.** Under Surveillance: "Increase the target threat value of attached scheme by 4."
- **When Completed.**
  - RRG 1.8 "When Completed Abilities" (p. 48): "equivalent to … 'Forced Interrupt: When this scheme is completed...'".
  - Used on non-final stages: Hostile Takeover 1B and Unleashing the Mutagen 1B.
  - RRG 1.8 "Main Scheme" (p. 27): advancing other than by reaching target threat "is not considered completed".
- **Signature side schemes** (insert):
  - "not discarded when they have no threat on them. Instead, these side schemes are removed from the game when their corresponding villain is defeated";
  - plus the printed "This card cannot leave play while [villain] is in play."
  - RRG 1.8 "'Cannot'" (p. 11) is absolute.
  - The insert overrides RRG 1.8 "Defeat" (p. 15), "if a side scheme has no threat on it, it is defeated", per the Golden Rules (p. 4).
- **"Remove all but 3 threat from this scheme."**
- **Moving threat between schemes.** "Move all threat from the side scheme with the least threat to the side scheme with the most threat. If that scheme's 'Forced Response' ability is not triggered this way, this card gains surge." (Tactical Prowess)

**Model:**
- **Scheme stat keys.** `StatModifierSpec` gains `acceleration`, `targetThreat` and `startingThreat` for schemes. `setBase` defines a `printedX` field.
- **Readers of those values.** `villain/phase.ts` `executePlaceThreat`, the completion check and main scheme advance all read modified values, not `stage.acceleration`.
- **Trigger kind `whenCompleted`** resolves before the advance, and never for a final stage's loss.
- **`RuleSpec cannotLeavePlay { target, while }`** (applies to any card) and `RuleSpec notDefeatedWithoutThreat { target }` (the scenario rule, not a card name).
- **`EffectSpec moveThreat { from, to, amount, bind }`**, whose result includes `<bind>.responsesTriggered`.
  - Verify against RRG 1.8 "Move" (p. 30) whether moved threat counts as "placed" (§4.8).

**Tests:**
- X acceleration follows Goblin enemies entering and leaving play;
- +4 target threat delays completion;
- 1B When Completed resolves once, then advances;
- a signature side scheme at 0 threat stays in play;
- it leaves when its villain is defeated, with no When Defeated;
- "remove all but 3" leaves exactly 3.

### 3.9 Boost cards as events

**Status: landed.** Tests: `packages/engine/src/boost.test.ts`.
- **Step order, from RRG 1.8 "Boost" (p. 11):** a boost card is turned faceup, then its "Boost" ability resolves, then its icons are added, then it is discarded.
  - The engine used to discard it *before* its ability; that is fixed.
  - Each card is now its own step on the procedure frame (`BoostInProgress`): faceup, then a `boostCardTurnedFaceup` event (interrupts and responses), then the Boost ability unless cancelled, then icons unless cancelled, then discard.
  - A card its own ability moved (into play) is not discarded, and its icons still count.
- `EventPattern.activation` ("while the villain attacks" / "during a scheme activation") and `EventPattern.eventAtLeast` (numbers the event carries, e.g. `{ boostIcons: 1 }`), so a 0-icon card offers no cancel (FAQ Attacrobatics #6).
- **Effects:**
  - `cancelBoostIcons { bind }`, with `<bind>.amount` = icons cancelled;
  - `cancelBoostAbility { bind }`, only while the turned-faceup windows are open, logged as `boostCancelled`;
  - `atEndOfActivation`, which has `atEndOfAttack`'s timing for attacks and schemes.
- `boostIcons` is a modifier key. `boostIconsFor` (`modifiers.ts`) reads the boost card's own constant ("This card gets +1 boost icon if …") although it is not in play.
- **Needed no primitive:** `putIntoPlay` of self from the boost zone, and step 2 activating a minion that entered during the villain's activation. Both are covered by tests.

**Cards:**
- **Cancelling boost icons.**
  - Preemptive Strike: "When a boost card is turned face up while the villain attacks, cancel all boost icons".
  - Attacrobatics; Foiled!: "during a scheme activation".
  - FAQ "Attacrobatics (#6)" (p. 59): cannot cancel 0 icons.
- **Cancelling a boost ability.** Target Acquired: "After a boost card is turned faceup, … cancel that card's boost ability".
- **Boost card destination.** Goblin Knight and Monster: "After this activation ends, shuffle this card into the encounter deck".
- **A boost that puts its own card into play.**
  - Goblin Soldier and Goblin Thrall: "Put [this] into play engaged with you".
  - The insert, "Goblin Minions Activation Timing": it "will activate against the engaged player" in step 2.
- **A conditional extra icon.** I See You: "This card gets +1 boost icon if …".
- **Boosts that modify the activation.**
  - Taskmaster's boost: "For this activation, the villain gets +1 SCH and +1 ATK for each upgrade you control".
  - Mystical Link's boost: "+3 ATK … unless you place 2 threat on his side scheme".

**Model:**
- **Trigger event `boostCardTurnedFaceup { enemyInstanceId, boostInstanceId, activation: "attack" | "scheme" }`**, with interrupts and responses before the boost ability resolves.
  - Confirm the step order against RRG 1.8 "Attack (Enemy Activation)" (pp. 8–10) and "Boost" (p. 11) before coding.
- **Effects:** `cancelBoostIcons { bind }` (no valid target at 0 icons) and `cancelBoostAbility`.
- **Boost-icon modifier:** a constant on the boost card read when icons are counted.
- **Delayed effect `atEndOfActivation`**, the counterpart of `atEndOfAttack`.
- **`putIntoPlay` of self from the `boost` zone.** Step 2's minion list is already recomputed each pass (`villain/phase.ts`); lock that in with a test.

**Tests:**
- one test per card behavior above;
- the Goblin Thrall boost in step 2 activates the new minion (insert);
- cancelling icons of a 0-icon boost card is not offered (FAQ).

### 3.10 Play, cost and resource restrictions

**Status: landed.** Tests: `packages/engine/src/play-restrictions.test.ts` (one test per restriction, both FAQs).
- **Round counters.** `GameState.playedThisRound` (by title, all players) and `playedByPlayerThisRound` (`<playerId>:<card type>`) are counted in `commitPlay`, so a cancelled card still counts, and reset when the round ends.
- **§1.8 restrictions.** `actions.ts` `playRestrictionFault` enforces `maxPerRound`, `requiresIdentityTrait` and `requiresControlledCharacterTrait` (gained traits count), for `playCard` and for in-hand events offered in a window.
- **Out-of-play text on the card itself.** New constant-ability fields are read from the card's own printed constants wherever it is (`printedConstants`), never from the in-play scan:
  - `paymentOnly` (checked on the paid pool; wilds count as the type);
  - `spendableIn` (hand cards);
  - `playableFrom: ["discard"]`, which `legalActions` also offers;
  - `costModifiers` with `activeIn: "hand"`.
- **Other new fields:** `Predicate paidWithOnly` (fails at 0 paid); `AbilityDefinition.generatesFor`.
- **Cost modifiers.** `CostModifierSpec { delta, appliesTo, host?, while?, activeIn? }` lives on constant abilities (`playCostModifier`), with `Predicate playedThisRound` for "first ally each round". `playRequirement` / `pricePlay` take `deps` and the attach target.
- **Basic power costs.** `basicPowerCosts` on a character's constants; `basicAttack` / `basicThwart` commands gain optional `payment` and `costChoices`, and `legalActions` fills a discard pick in.
- **Deviation:** "resources of different types" is `AbilityCost.distinctResourceTypes`, not `ResourceRequirement.distinctTypes`. Changing the exported requirement shape would break Klaw's cards test and the client's payment overlay.
- **Deviation:** Physical Toll is a constant `costModifiers { delta: +3 }` on the obligation in play plus a forced response that discards it, not a lasting `costIncrease`. A card nobody controls in a player's area speaks for that player.
- **Not done:** `payWindowAbility` does not check `distinctResourceTypes`.

**Cards and rules:**
- **Enforcing §1.8:**
  - `maxPerRound` is counted across all copies by title and all players, and a cancelled card still counts (RRG 1.8 "Max, Maximum", p. 28);
  - `requiresIdentityTrait` and `requiresControlledCharacterTrait` count printed or gained traits (RRG 1.8 "'Gains'", p. 21).
- **Spending only one resource type.**
  - "You can only spend [physical] resources to pay for this card." (Crushing Blow)
  - FAQ "Crushing Blow (#2)" (p. 60): a cost reduced to 0 needs no resources.
- **"If you paid for this card using only [physical] resources"**
  - Hulk Smash, Sub-Orbital Leap, Unstoppable Force, Drop Kick.
  - FAQ "Unstoppable Force (#6)" (p. 60): at cost 0 the condition fails.
- **Generating resources only for a kind of card.**
  - "generate a [wild] resource for an event" (Biokinetic Polymer Suit);
  - "… for a Preparation card" (Black Widow's Gauntlet);
  - "… for an Attack event" (Martial Prowess).
- **"Spend this card only in hero form."** (Limitless Strength)
- **Cost reductions active from hand.**
  - "Reduce the cost to play Hercules by 1 for each minion engaged with you"; the same on Winter Soldier.
  - RRG 1.8 "In Play and Out of Play" (p. 23): out-of-play abilities apply only when they "specifically refer to being used from an out-of-play area".
- **A cost reduction for upgrades on one ally.** "Reduce the cost to play each upgrade on Iron Man by 1" (Iron Man ally).
- **"Reduce the cost of the first ally played each round by 1"** (Steve Rogers, Living Legend). FAQ "Steve Rogers (#1B)" (p. 59): "only applies to the very first ally played each round", whatever the form when it is played.
- **Additional costs.**
  - "The next event you play costs 3 additional resources. Discard this obligation after you play an event." (Physical Toll)
  - "As an additional cost for Wonder Man to attack, you must discard 1 card" (Wonder Man).
- **Play from discard.** "You may play Lockjaw from your discard pile during your turn". This is RRG 1.8 "Play Restrictions and Permissions" (p. 33)'s own example of a permission.
- **"spend 2 resources of different types"** (Red Dagger).

**Model:**
- **Counters for Max and first-each-round.** `GameState.playedThisRound` (by title) and `firstPlayedThisRound` (by player and card type), reset in villain phase step 6.
- **Checks in `actions.ts` pricing/`planCost` and `legalActions`:**
  - the play-restriction checks;
  - `PaymentRestriction { onlyTypes }`;
  - `Predicate paidWithOnly { type }`;
  - `generates.forCard: TargetQuery`;
  - `RuleSpec resourceSpendableWhile { form }`;
  - constant `costModifier { appliesTo: TargetQuery, activeIn?: "hand" }`;
  - `costModifier` with a host filter;
  - lasting `costIncrease { nextCardOf: TargetQuery }`;
  - `AbilityCost` on basic powers;
  - `playFrom: ["discard"]`;
  - `ResourceRequirement.distinctTypes`.

**Tests:** one per restriction, including both FAQ rulings.

### 3.11 New trigger events and rules

**Status: landed.** Tests: `packages/engine/src/triggers-wave1.test.ts`. All four trigger events, the six `RuleSpec` additions and the lasting `blankTextBox` are in. An announcement on an always-taken Core path (`turnEnding`, `surgeResolving`, `abilityResolved`, `minionEngaged`) only goes on the stack when an ability could react to it, so Core's event order and logs are unchanged.

**Trigger events:**
- **`minionEngaged { minionInstanceId, playerId }`**
  - Thor: "After you engage a minion". RRG 1.8 "Engage" (p. 18): entering a player's area engages, and so does an instruction to engage.
  - Ordering: keywords before responses on the same trigger. FAQ "Widow's Bite (#10)" (p. 60) and ruling Jan 17, 2026 (ruling 3, answer 2): "keywords have timing priority over triggered abilities."
- **`turnEnding { playerId }`** as a trigger, not just the log event `turnEnded` in `actions.ts`. Hulk: "Forced Interrupt: When your turn ends, discard your hand."
- **`surgeResolving`** as an interruptible event.
  - Espionage: "When the surge keyword on an encounter card would be resolved".
  - Ruling Aug 3, 2026 (ruling 3): surge "is treated as a When Revealed ability".
- **`abilityResolved { sourceInstanceId, controllerId }`**
  - Black Widow and Synth-Suit errata: "After you resolve the ability of a Preparation card you control". Ruling Feb 28, 2026 (ruling 2).
  - RRG 1.8 "Resolve" (p. 37): "An ability is resolved when it is triggered and one or more of its effects resolve."
- **Initiation of an enemy attack against a player** (Nova: "When an enemy initiates an attack against you").
  - Verify the existing window. FAQ "Nova (#12)" (p. 59): defeating the attacker ends the attack.

**`RuleSpec` additions:**
- `cannotThwart { player }`: "While Baron Zemo is engaged with you, you cannot thwart."
- `cannotReady { target }` and `cannotChangeForm { player }`: All Tied Up.
- `cannotAttack { target }`: Distracting Taunts, "Players cannot attack other villains."
- `threatCannotBeRemoved { by: "thwart" }`: Held Hostage, "by thwarting".
- Lasting `blankTextBox { target, until }`: Edison's Giant Robot. Ruling Apr 30, 2026 (ruling 3, answer 4): an attachment's stat modifier is outside its text box.
- `repeatWhenRevealed { player, times }`: Media Coverage, "Resolve each 'When Revealed' ability that you reveal 1 additional time."

**Tests:** one per event and rule, including ordering against Quickstrike and Espionage drawing when surge resolves.

### 3.12 Selection and value vocabulary

**Status: landed.** Tests: `packages/engine/src/selection-wave1.test.ts`.
- **`TargetRef superlative { among, order, measure, slot?, ties? }`** (`select.ts`). **Deviation:** `measure` is a
  `ValueSpec` evaluated once per candidate with that candidate bound to `slot` (default `"candidate"`), not a fixed
  measure enum. One primitive then covers remaining HP, ATK, printed cost and "the villain *whose side scheme* has
  the most threat", and `among` may be a slot of out-of-play cards (cards in hand), which a query could not reach.
- **Ties.** A ref is resolved without asking anyone, so a tie resolves to **every** tied card (`ties: "all"`, the
  default; `ties: "first"` takes the first in stable order). An effect that needs exactly one breaks the tie itself:
  `bindTargets` the superlative, then `chooseTarget` over `{ inSlot }` — `chooser: firstPlayer` on an encounter card
  carries `firstPlayerTargets` (RRG 1.8 "First Player", p. 19), which is the §3.1 pattern for the active counter.
- **`TargetQuery.identitySetOf`** reads the set icon the card data carries as `aspect: "hero:<identity card id>"`
  (RRG 1.8 "Identity-Specific Card", p. 23). Player cards only: the identity card is not a card of its own set.
- **New `ValueSpec`s:** `distinctCardTypes { cards }`, `printedCost { of }` (0 for a card with no printed cost) and
  `villainStageNumber { of? }` (the printed numeral, `of` absent = the active villain).
- **`EffectSpec discardEncounterCards { count, bind?, forEachDiscarded? }`.** RRG 1.8 "Encounter Deck" (p. 17):
  discarding stops when *this effect* empties the deck and does not continue with the reshuffled deck; a deck already
  empty when the effect begins is reset first, as any draw would. "Each player discards N" therefore resumes from the
  reset deck for the remaining players (RRG 1.8 "Each Player", p. 17), which the test pins.
  - **Deviation:** the reset stays lazy (`drawEncounterCard`), so the acceleration token is placed at the next draw
    from that deck rather than the instant it empties. Engine-wide behaviour since Core, not new here.
  - **Deviation:** `forEachDiscarded` runs its effects once per discarded card in discard order, *after* every
    discard. No wave 1 card reads the deck between two of them.
- **`EffectSpec dealEncounterCard` gains `count`**, and dealing to more than one player asks the first player for the
  order (`ChoicePrompt orderPlayers`, `authority: "firstPlayerOrders"`), dealing one player's whole share before the
  next player's — ruling, Jan 26, 2026 (4) answer 3, "Distribution is AABB or BBAA". One player is dealt to without
  asking, so Core's single-player use is unchanged. Handled in `effects-frame.ts`; `applyEffect` now refuses it.
- **`chooseTarget.count` accepts a `ValueSpec`** ("X enemies"), with `optional` for "up to 3". Targets are distinct
  cards, and a villain is one enemy however many stages its deck has (FAQ "Melee (#30)", p. 59).
- **Added while proving it:** `Predicate refMatches` gained `anywhere`, to ask about a card that is no longer in play
  ("each time a Goblin minion is discarded this way" asks about a card now in a discard pile).

- **Superlatives.** `TargetRef superlative { query, order, measure, ties }` with measures:
  - remaining HP ("the hero with the fewest hit points remaining": Mad Genius; You're Dead Meat);
  - ATK (Clash of the Titans);
  - threat on a villain's side scheme (Get Wrecked!, Buddy System, Crowbar Toss);
  - printed cost among controlled cards or cards in hand (Oversized Hands, Pile Drive, Burn Notice, Thoughtcasting).
  - **Ties:** on an encounter card, the first player (RRG 1.8 "First Player", p. 19; `firstPlayerTargets`). On a player card, the resolving player (`player`).
- **Identity-set filter.** `TargetQuery.identitySetOf: PlayerRef` for "a Ms. Marvel card" (Teen Spirit) and "a Doctor Strange card" (Mystical Studies).
  - Ruling Jun 25, 2026 (ruling 4): nemesis sets belong to the identity, but these filters are over player cards.
- **New `ValueSpec`s:**
  - `distinctCardTypes { cards }` (Trickster, Leading the Charge);
  - `printedCost { of }` (Headbutt, Thoughtcasting);
  - `villainStageNumber` (Death from Above, Wicked Ambitions): the printed numeral, not the index.
- **Discarding from the encounter deck.** `discardEncounterCards { count, bind, forEachDiscarded? }` (Electro, Lightning Bolt, Shock Therapy; Wicked Ambitions' "Each time a Goblin minion is discarded this way, choose …").
  - RRG 1.8 "Encounter Deck" (p. 17): a discard that empties the deck stops.
- **Dealing several cards to each player.**
  - Green Goblin II: "Deal 2 encounter cards to each player".
  - Ruling Jan 26, 2026 (ruling 4, answer 3): "the first player chooses the order players receive cards … Distribution is AABB or BBAA".
  - Model: `dealEncounterCard { player: each, count }` deals all of one player's cards first, in an order the first player chooses (`firstPlayerOrders`).
- **"X enemies" / "up to 3 different enemies".**
  - Shield Toss binds X from its discard cost; Thunderclap chooses up to 3.
  - Existing `chooseTarget` with `min`/`max` and distinct targets.
  - FAQ "Melee (#30)" (p. 59): "different stages of the villain are considered to be the same enemy".

### 3.13 Card movement and placement

**Status: landed.** Tests: `packages/engine/src/movement-wave1.test.ts`.
- **Needed no primitive, now pinned by tests:** Morphogenetics (a response to `cardPlayed` moves the event from the
  discard pile to hand — the printed text is "return that event to your hand", not "instead of discarding it", so the
  discard-then-return order matches the card); Clea (`characterDefeated` is already interruptible, and
  `replaceTriggeringEvent` + `moveCards` to `deckShuffle` shuffles her in); Beat Cop (`moveThreat` already places
  threat on a non-scheme card, and `ValueSpec threat` reads it there); Teamwork (an interrupt to the basic attack's
  `attack` event with `modifyStatUntil { until: "endOfAttack" }`, because the attack reads the profile when it
  applies).
- **An identity's defeat is now an interruptible event** when an ability could react to it (`heard`), so "when
  Captain America would be defeated … instead" has a window; with nothing listening the player is eliminated exactly
  where they were before, so Core is untouched. `EffectSpec setRemainingHitPoints` sets the dial (RRG 1.8 "Hit
  Points", p. 22). **Reading:** it is not a heal — the card does not say "heal" — so it fires no heal event and is
  logged as `hitPointsSet`.
- **`EffectSpec engage { minion, player }`** (RRG 1.8 "Engage", p. 18): it counts as the minion engaging that player
  (`minionEngaged` is announced), and a minion already engaged with that player is left alone.
- **`EffectSpec reorderCards { cards, chooser, to: "encounterDeckTop" }`** with `ChoicePrompt orderCards`; the cards
  go back on the active villain's deck, first card chosen on top (RRG 1.8 "Deck", p. 15).
- **`EffectSpec attach` gains `facedown`**, and `FacedownRole` gains a `"blank"` kind: a facedown card in play has no
  title, traits, keywords or abilities. **Reading:** its card type is left alone, because nothing asks what type a
  facedown attachment is. `TargetRef attachmentsOf { of, filter? }` reads "the cards attached here".
- **`EffectSpec dealDamage` gains `ignoreTough`** (Lightning Strike, errata RRG 1.8 p. 65). **Reading:** the damage is
  taken and the tough status card *stays*, because piercing is the keyword the RRG defines as discarding it (p. 44)
  and "ignores" says nothing about removing it.
- **Per-instance event modifiers** (Embiggen!, Shrink): a new `cardBeingPlayed` trigger event gives "when you play an
  [Attack] event" an interrupt window before the card's own abilities resolve — on the stack only when an ability
  could react to it, so Core's event order is unchanged. `EffectSpec modifyCardEffect { card, damage?, threatRemoved? }`
  creates a `cardEffectBonus` lasting effect on that card, added to **every** instance of damage dealt or threat
  removed by its effects (RRG 1.8 "Event", p. 19; FAQ #10/#11, p. 59). Its duration is the new
  `endOfCardResolution`, so a card returned to hand and replayed in the same phase does not keep the bonus.
  Prevention is not removal, so Shrink does nothing to a prevent effect.
- **Consequential damage is modifiable:** `consequentialAttack` / `consequentialThwart` modifier keys, read by
  `pushConsequentialDamage` (Enraged).

- **Return the played event to hand instead of the discard pile** (Morphogenetics: "return that event to your hand").
  - The event is in the `resolving` zone.
  - Model: a response that moves it before the discard step.
- **Moving a card elsewhere as it is defeated.**
  - "When Clea is defeated, shuffle her into her owner's deck"; `characterDefeated` is already interruptible.
  - "set his hit point dial to 1 instead" (Captain America's Helmet): a replacement on identity defeat.
- **Moving threat onto a non-scheme card.**
  - "move 1 threat from a scheme to here" (Beat Cop, a support): threat on a non-scheme card.
  - The same `moveThreat` as §3.8.
- **"engage that enemy"** (Get Over Here!): `engage { minion, player }`, which also fires `minionEngaged`.
- **Reordering the top of the encounter deck.**
  - "Discard 1 of them and put the others back in any order" (Heimdall).
  - RRG 1.8 "Deck" (p. 15): order changes only when instructed.
  - Model: `reorderCards` with the resolving player's choice.
- **Facedown cards attached to a support.**
  - "attach 1 card from your hand facedown here … add up to 3 cards attached here to your hand" (Bruno Carrelli).
  - Model: attachments with `faceup: false` and no abilities.
- **Damage that ignores tough.**
  - "This damage ignores tough status card if you have the Aerial trait" (Lightning Strike, erratum RRG 1.8 p. 65).
  - Model: `dealDamage.ignoreTough`.
- **Event-instance modifiers.**
  - "increase the amount of damage that event deals by 2" (Embiggen) and the Shrink equivalent.
  - FAQ "Embiggen (#10)" and "Shrink (#11)" (p. 59): each instance of damage or threat removal is modified, and prevention is not removal.
  - RRG 1.8 "Event" (p. 19).
- **Adding an ally's power to a basic power.** "add that ally's matching power to your hero's power for this use" (the Teamwork event).
- **Consequential damage modifier.** "takes +1 consequential damage after it attacks" (Enraged).

### 3.14 Attachment host resolution

**Status: landed.** Tests: `packages/engine/src/attachment-hosts.test.ts`.
- Every §1.6 kind resolves in `attachmentHostCandidates` (`resolve/reveal.ts`), the one place hosts are computed —
  for an encounter card being revealed, for a setup-keyword attachment, and for a player's upgrade (`legal.ts`). It
  is evaluated when the card would be attached and never cached (RRG 1.8 "Attach To", p. 8).
- **`namedVillain` and `villainSideScheme` read the title showing** (`currentName`), so a villain found by name is
  found under its current face, and the signature link (§3.1) supplies "the active villain's side scheme".
- **`yourIdentity`** is the player resolving the card (RRG 1.8 "You, Your"), and an identity not in the named form is
  no host at all, so the card is discarded with **no replacement card revealed** — FAQ "Counterspell (#30)" (p. 60),
  pinned by a test. **`friendlyCharacter`** is every character a player controls (RRG 1.8 "Friendly", p. 21).
- **`qualified` and `superlative`** apply their qualifiers (`trait`, `withoutTrait`, `withoutAttachmentNamed`) before
  ranking. Superlative measures read printed values through `printedProfile` and current ones through
  `characterProfile`, so a villain's printed hit points carry the per player icon and beat a minion's.
- **Ties return every tied card**, and the reveal procedure turns that into the existing `chooseAttachmentTarget`
  choice for the first player (`firstPlayerTargets`; RRG 1.8 "First Player", p. 19).
- **`Predicate isAttached`** is the new primitive behind "If you cannot, this card gains surge" (Goblin Glider): a
  card that fails to attach is discarded but still resolves its When Revealed, which asks whether it attached.

- **Engine support for the §1.6 kinds.** Legal hosts are computed at the moment of attaching (RRG 1.8 "Attach To", p. 8).
  - **No legal host:** "cannot remain in its prior state … discard it". FAQ Counterspell (p. 60): no replacement card is revealed.
  - **"If you cannot, this card gains surge."** (Goblin Glider) is a card ability keyed to the failure, via `<bind>.attached`.
- **Attachments without "attach to" text** attach when their When Revealed resolves. Ruling Feb 20, 2026 (ruling 4). Not needed in wave 1, but it is the same code path.
- **Host choices** use the existing `chooseAttachmentTarget` prompt with `firstPlayerTargets` authority on encounter cards.
- **`villainSideScheme`** needs §3.1's villain-to-scheme link.
- **Tests:**
  - every §1.6 kind;
  - Counterspell on an alter-ego player is discarded;
  - Goblin Glider with no eligible enemy surges;
  - superlative ties become a first-player choice.

### 3.15 Setup

**Status: landed.** Tests: `packages/engine/src/setup-wave1.test.ts`.
- **`VillainSetup.version: "A" | "B" | "extreme"`** is the per-villain difficulty choice, shorthand for the two stage
  indexes (`A` → `[0, 0]`, `B` → `[1, 1]`, `extreme` → `[0, 1]`; §1.2). Each villain chooses its own, so a mixed
  table is legal. Setting it alongside `startStageIndex` / `lastStageIndex` is refused (`invalid_setup`) rather than
  silently resolved, and a version the villain has no stage for is refused by the existing stage check.
- **Behaviour change: identity `Setup:` abilities moved to Appendix II step 16.** They used to resolve in the step-12
  batch, before the opening draw; they now run from a new `playerSetupAbilities` flow step, after the draw (step 14)
  and the mulligan (step 15). That is what makes Steve Rogers' "search your deck and discard pile" meaningful — the
  discard pile holds the mulligan (FAQ "Steve Rogers (#1B)", p. 59, quoted in §2.1). `GameStep` gains that step kind,
  and `player-cards.test.ts`'s T'Challa test now asserts the corrected order (its subject is unchanged).
- **Verified, not rebuilt:** steps 4–5 are skipped by `includeIdentitySets: false` (the scenario's
  `usesIdentityEncounterSets`), step 6 builds each identity's separate decks (§3.5), step 10 gives each
  `ScenarioVillain` its own deck with every card's `home` set (§3.2), and step 12 resolves 1A's `Setup:`, then 1B's
  When Revealed, then each villain's `Setup:` and When Revealed in printed order.
- **Any number of modular sets, including none**, needs nothing from the engine: the encounter deck arrives as one
  list of card ids, so the count is the caller's (`@mc/cards`) composition choice. Pinned by a test so it stays true.

RRG 1.8 Appendix II (p. 51), with scenario overrides:
- **Steps 4–5** are skipped when `usesIdentityEncounterSets === false` (Wrecking Crew insert).
- **Steps 8–9: villains and hit points.** For `multipleVillains`, every villain enters at its chosen version with its own hit points.
  - `GameSetupConfig` gains a per-villain version choice: `"A" | "B" | "extreme"`, where extreme means stage range `[1, 2]`.
- **Step 10: encounter decks.** One deck per `ScenarioVillain`, with homes (§3.2). Villain cards and signature side schemes are excluded, as a Core villain set's villain is.
- **Step 12a:**
  - Breakout: put the four side schemes into play, then `setActiveVillain` Wrecker.
  - Risky Business: put Criminal Enterprise into play. Its "enter play with" counters follow the Hawkeye pattern (docs/phase2-core-set.md §3.9).
  - Mutagen Formula: "Put a Goblin Thrall minion into play engaged with each player", found in the encounter deck (RRG 1.8 "Find", p. 19).
- **Step 12c** resolves each villain's Setup/When Revealed in printed order. No wave 1 villain stage has one, so the order is moot.
- **Step 6** builds identity separate decks (§3.5).
- **Step 16** resolves Steve Rogers' `Setup:`.
- **Modular sets.** Accept any number of modular sets, including 0 (Green Goblin insert).

### 3.16 Already covered: verify, don't rebuild

**Status: landed.** Tests: `packages/engine/src/verify-wave1.test.ts` (the two gaps the review found); everything else
was already proven and was checked rather than rebuilt.
- **Verified where it already lives:** Guard against every villain (`multi-villain.test.ts`); Quickstrike, Retaliate
  (villain-side and granted), Restricted, Toughness, Uses, Surge, Ranged-vs-Retaliate (`keywords.test.ts`,
  `attacks.test.ts`, `e2e.test.ts`); `modifyAttack.overkill` (`attacks.test.ts`); `mustDefendWithAlly`
  (`lasting.test.ts`); `cancelRevealedCard` / `cancelWhenRevealed` / `preventDamage` / `preventThreat`
  (`replacement.test.ts`); `resolveSpecials`, `payPrintedCostOf`, `tuckCards` (`separate-deck.test.ts`,
  `player-cards.test.ts`, `resources.test.ts`); `chooseOne`, `spendResources`, `atEndOfRound`,
  `enemyAttack { against }` (`scenario-flow.test.ts`, `scripting-primitives.test.ts`, `lasting.test.ts`,
  `enemy-actions.test.ts`).
- **Gap found and fixed: searching a deck *and* a discard pile.** `CardSelector.zone` took one zone, so "search your
  deck and discard pile for a Doctor Strange card" (Mystical Studies, For Asgard!, Agent Coulson, Hail Hydra!) could
  only have been scripted as two separate choices. It now accepts several zones, searched as one pool.
- **Gap found and fixed: a stun against an ability that makes several attacks.** FAQ "Dance of Death (#4)" (p. 59):
  the card has no "(attack)" label, "its first sentence … defines each damage-dealing effect … as an individual
  attack", and a stun "will only prevent the first attack. The second and third attack can be performed as normal."
  The engine only consumed a stun for a *labeled* ability (cancelling it whole, the RRG's rule for labels) or a basic
  attack, so an unlabeled multi-attack ability ignored the stun entirely. An `attack` effect now checks the attacker's
  stun when it is initiated (RRG 1.8 "Stun", p. 41), which spends it on the first attack only. The labeled behaviour
  is unchanged, and both are pinned side by side.
  - **For `@mc/cards`:** `dsl/validate.ts` requires every `attack` effect to sit on an "(attack)"-labeled ability.
    Dance of Death is the counter-example, so that check needs an opt-out before the card can be scripted.


- Guard (extend to every villain, §3.1), Quickstrike, Retaliate X (villain, and granted via constants), Restricted, Toughness, Uses (X "type"), Surge, and `modifyAttack.overkill`.
- `mustDefendWithAlly` (Ramming Speed), `cancelRevealedCard` (Spycraft, Grappling Hook, Protective Ward) and `cancelWhenRevealed` (Get Behind Me!).
- `preventDamage` / `preventThreat` (Shield Block, Wiggle Room, Warning, Defensive Stance, Counterintelligence).
  - Ruling Mar 6, 2026 (ruling 1): prevention reduces damage taken, not dealt.
- Searching deck and discard (Worthy, For Asgard!, Agent Coulson, Hail Hydra!) and obligations with "you may flip to alter-ego form".
- `chooseOne`, `spendResources`, `enemyAttack { against }` (Toe to Toe), `resolveSpecials`, `payPrintedCostOf`, `tuckCards`, printed-resource branches (Magic Blast, Baron Mordo) and `atEndOfRound` (Magical Enhancements).
- Dance of Death's three separate attacks. FAQ "Dance of Death (#4)" (p. 59): a stun cancels only the first.

---

## 4. Open questions (for the user or FFG)

1. **Flipped environment counters.**
   - Does State of Madness's (or Criminal Enterprise's) "enter play with 2[per_hero] … counters" apply when the card flips to that face?
   - A flip is not entering play (RRG 1.8 "Enters Play", p. 18). But without counters, the card flips straight back.
   - No ruling found. Proposed: apply them on flip, as the evident design. **Needs confirmation before §3.4 ships.**
2. **Buddy System** reads "Reveal the top card of his deck", naming a non-active villain's deck.
   - Ruling Jan 17, 2026 (ruling 5) says "only the active villain's encounter deck can be interacted with".
   - Card text overrides rules (Golden Rules, p. 4), so the proposal is to let explicit card text name a deck. This conflicts with the ruling's wording, so flag it for FFG.
3. **Treachery and boost card discards.** The insert routes "an encounter card [that] leaves play" to its own deck's discard. Treacheries and boost cards never enter play.
   - Proposed: their home deck.
   - The alternative is the active deck.
4. **An enemy whose ATK is a dash.**
   - Does it initiate an attack when nothing replaces it?
   - The insert's "cannot be increased, decreased, or modified" and RRG 1.8 "Dash" ("unmodifiable 0") conflict with FAQ Green Goblin #1B, where boost icons are added.
   - Proposed: follow the FAQ for an attack already in progress; initiation is unresolved.
5. **Overkill with several villains.** RRG 1.8 "Overkill" (p. 31) deals a defeated minion's excess damage "to the villain". With four villains in play, is that the active villain?
   - A minion has no link to any one villain.
   - Proposed: the active villain, per the insert's "'the villain' only refers to the active villain".
   - The insert speaks of "card effect[s]", and overkill is a keyword, so confirm.
6. **The extreme challenge.**
   - When version A is defeated and B "enters play", is that a same-title stage advance (RRG 1.8 "Villain Defeat", p. 47: attachments and statuses carry over)?
   - Does the villain's side scheme stay, since the villain is not yet defeated?
   - Proposed: yes to both.
7. **The group's indirect damage decision.** Which seat decides "as the group chooses" in a digital game?
   - **Answered (2026-09-13, user decision checked against the RRG).** Indirect damage dealt to a player is divided by that player: one `assignIndirectDamage` choice per player, addressed to that player, with `authority: "player"`. For an "each player" effect, the players resolve in the order the first player picks ("Each Player", p. 17).
   - **Wave 1 never deals indirect damage to "the group".** Every wave 1 source hits "each player" or "you": 02001b, 02002b, 02021, 02034, 02042, 02044.
   - **When a later pack does,** the first player submits the group's division ("First Player", p. 19: "the players as a group are encouraged to work together, but the first player decides").
8. **Moving threat** (Tactical Prowess): does moved threat count as "placed", triggering "After threat is placed here"?
   - **Settled (2026-09-13) by RRG 1.8 "Move" (p. 30):** "If threat is moved off a scheme, the moved threat is considered to be removed from that scheme. If threat is moved to a scheme, the moved threat is considered to be placed on that scheme." Implemented as `EffectSpec moveThreat` (§3.8).
9. **The Invocation deck mid-resolution.** Is the top card still "in the deck" while its Special resolves?
   - Ruling Apr 30, 2026 (ruling 3, answer 7) reshuffles a player deck "before the currently resolving card enters the discard pile" for an event.
   - Proposed: the card is in the deck until its last sentence moves it, then the reshuffle happens.
10. **The active villain in step 2.** Read at each player's activation (proposed), or fixed at the start of step 2?
11. **Saved games.** The `villains` list and `encounterDecks` change `GameState`'s shape. Should old local saves migrate, or be discarded? This is a product call, and replay logs are affected the same way.
