# Marvel Champions Card Reference Database

A complete, generated transcription of the cached MarvelCDB card records in `packages/content/raw/marvelcdb/`, formatted for AI and rules-engine consumption. Regenerate with `scripts/generate_cards_markdown.py`; do not hand-edit.

**This document is not authoritative.** MarvelCDB is a community database. The authorities on how a card behaves are the Rules Reference Guide (`mc_rulesreference_v18_compressed.pdf`), FFG's rulings and errata (`marvel-champions-rulings-post-rrg-1-7.md`), and the structured card data in `@mc/content`. Where this file and any of those disagree, they win and this file is wrong. Use it to read printed text quickly, not to settle a rules question.

Fields absent from the source are reported as "not recorded in this source" rather than guessed at, so a missing value is never silently rendered as a zero.

## Rules & Symbol Legend

### 1. Bottom-Right Encounter Logos
- **Boost Icons (Pips)**: In the lower-right corner of Villain, Minion, Treachery, and Attachment cards, there are triangular boost icons (0 to 4). When the card is flipped face-down as a Boost Card during a Villain attack or scheme activation, each boost icon adds +1 to the Villain's ATK or SCH.
- **Boost Star (`[star]`)**: An icon in the boost area indicating that drawing this card triggers a special **Boost** ability, printed inline in that card's own rules text. A star is not itself a boost icon (RRG 1.8, "Boost"), so a starred card can also carry 0 or more pips.
- **Encounter Set Logo**: An emblem printed on the bottom margin next to the deck number indicating which modular set or villain deck the card belongs to (e.g. Rhino horn, Red Skull emblem, Bomb Scare bomb, Standard shield).
- **Scheme Icons**: Main Schemes and Side Schemes feature board-wide status icons:
  - `[crisis]`: Prevents players from removing threat from the Main Scheme.
  - `[hazard]`: Deals +1 additional encounter card during the Villain Phase.
  - `[acceleration]`: Adds +1 threat to the Main Scheme at the start of each round.
  - `[amplify]`: Adds +1 boost pip to boost cards drawn during activation.

### 2. Deck Numbering (e.g. `19/28`)
- Cards in fixed sets (Hero signature decks, Villain encounter decks, Modular sets, Nemesis sets) feature a printed sequence fraction `X/Y`.
- `X` is the card position in that specific set, and `Y` is the total number of cards in that set.
- Example: `19/28` in the Red Skull encounter deck represents card 19 of the 28 cards in Red Skull's deck (specifically *Spreading Lies*).
- Hero kits feature 15 signature cards numbered `1/15` through `15/15`.

### 3. Combat Stats & Icon Tokens
- **THW**: Thwart value (removes threat from schemes).
- **SCH**: Scheme value (villain/minion adds threat to schemes).
- **ATK**: Attack value (deals damage to targets).
- **DEF**: Defense value (reduces incoming villain/minion damage).
- **REC**: Recover value (Alter-Ego heals HP).
- **HP**: Hit Points (health pool; may be fixed, *per hero*, or *per group*).
- **`[star]`**: Asterisk/Star indicating a dynamic or variable stat governed by card text.
- **`[mental]` / `[physical]` / `[energy]` / `[wild]`**: Resource icons used to pay card costs.
- **Consequential**: the damage or threat a hero takes for using that stat on an ally.

## Quick Index

| Code | Name | Type | Deck / Set | Stats | Boost | Pack |
|---|---|---|---|---|---|---|
| `11001` | Kang (The Conqueror) | Villain | Kang | SCH:1 ATK:2 HP:12 | - | `toafk` |
| `11002` | Kang (Immortus) | Villain | Kang | SCH:2 ATK:2 HP:18 | - | `toafk` |
| `11003` | Kang (Iron Lad) | Villain | Kang | SCH:1 ATK:2 HP:18 | - | `toafk` |
| `11004` | Kang (Rama-Tut) | Villain | Kang | SCH:1 ATK:2 HP:18 | - | `toafk` |
| `11005` | Kang (Scarlet Centurion) | Villain | Kang | SCH:0 ATK:3 HP:18 | - | `toafk` |
| `11006` | Kang (The Conqueror) | Villain | Kang | SCH:2 ATK:2 HP:20 | - | `toafk` |
| `11007` | Kang's Arrival | Main Scheme | Kang | - | - | `toafk` |
| `11007a` | Kang's Arrival | Main Scheme | Kang | - | - | `toafk` |
| `11007b` | Kang's Arrival | Main Scheme | Kang | - | - | `toafk` |
| `11008` | The Master of Time | Main Scheme | Kang | - | - | `toafk` |
| `11008a` | The Master of Time | Main Scheme | Kang | - | - | `toafk` |
| `11008b` | The Master of Time | Main Scheme | Kang | - | - | `toafk` |
| `11009` | The Chronopolis | Main Scheme | Kang | - | - | `toafk` |
| `11009a` | The Chronopolis | Main Scheme | Kang | - | - | `toafk` |
| `11009b` | The Chronopolis | Main Scheme | Kang | - | - | `toafk` |
| `11010` | Inexorable Fate | Main Scheme | Kang | - | - | `toafk` |
| `11010a` | Inexorable Fate | Main Scheme | Kang | - | - | `toafk` |
| `11010b` | Inexorable Fate | Main Scheme | Kang | - | - | `toafk` |
| `11011` | The Realm of Rama-Tut | Main Scheme | Kang | - | - | `toafk` |
| `11011a` | The Realm of Rama-Tut | Main Scheme | Kang | - | - | `toafk` |
| `11011b` | The Realm of Rama-Tut | Main Scheme | Kang | - | - | `toafk` |
| `11012` | The Present Future War | Main Scheme | Kang | - | - | `toafk` |
| `11012a` | The Present Future War | Main Scheme | Kang | - | - | `toafk` |
| `11012b` | The Present Future War | Main Scheme | Kang | - | - | `toafk` |
| `11013` | Kang's Wrath | Main Scheme | Kang | - | - | `toafk` |
| `11013a` | Kang's Wrath | Main Scheme | Kang | - | - | `toafk` |
| `11013b` | Kang's Wrath | Main Scheme | Kang | - | - | `toafk` |
| `11014` | Temporal Shield | Attachment | Kang | - | 1 icon | `toafk` |
| `11015` | Future Weapon | Attachment | Kang | ATK:2 | 2 icons | `toafk` |
| `11016` | Frozen in Time | Attachment | Kang | - | 0 icons + star | `toafk` |
| `11017` | Macrobots | Minion | Kang | SCH:1 ATK:2 HP:4 | 0 icons + star | `toafk` |
| `11018` | Weakened | Obligation | Kang | - | 2 icons | `toafk` |
| `11019` | Stolen Memories | Obligation | Kang | - | 2 icons | `toafk` |
| `11020` | Depowered | Obligation | Kang | - | 2 icons | `toafk` |
| `11021` | Time-Travel Hijinks | Obligation | Kang | - | 2 icons | `toafk` |
| `11022` | Corrupted Timestream | Side Scheme | Kang | - | 2 icons | `toafk` |
| `11023` | Kang's Dominion | Side Scheme | Kang | - | 3 icons | `toafk` |
| `11024` | Pinned Down | Side Scheme | Kang | - | 2 icons | `toafk` |
| `11025` | Rampage | Side Scheme | Kang | - | 2 icons | `toafk` |
| `11026` | Energy Blast | Treachery | Kang | - | 1 icon | `toafk` |
| `11027` | Manipulated Timestream | Treachery | Kang | - | 2 icons | `toafk` |
| `11028` | Time-Travel Tactics | Treachery | Kang | - | 1 icon + star | `toafk` |
| `11029` | Past Machinations | Treachery | Kang | - | 3 icons | `toafk` |
| `11030` | Ancient Warrior | Minion | Temporal | SCH:1 ATK:2 HP:2 | 0 icons + star | `toafk` |
| `11031` | Chitauri Soldier | Minion | Temporal | SCH:1 ATK:1 HP:3 | 1 icon | `toafk` |
| `11032` | Tyrannosaurus Rex | Minion | Temporal | SCH:0 ATK:3 HP:6 | 3 icons | `toafk` |
| `11033` | Time Portal | Side Scheme | Temporal | - | 2 icons | `toafk` |
| `11034` | Kang (The Conqueror) | Villain | Expert Kang | SCH:1 ATK:3 HP:15 | - | `toafk` |
| `11035` | Kang (Immortus) | Villain | Expert Kang | SCH:3 ATK:2 HP:22 | - | `toafk` |
| `11036` | Kang (Iron Lad) | Villain | Expert Kang | SCH:2 ATK:3 HP:22 | - | `toafk` |
| `11037` | Kang (Rama-Tut) | Villain | Expert Kang | SCH:2 ATK:3 HP:22 | - | `toafk` |
| `11038` | Kang (Scarlet Centurion) | Villain | Expert Kang | SCH:1 ATK:4 HP:22 | - | `toafk` |
| `11039` | Kang (The Conqueror) | Villain | Expert Kang | SCH:3 ATK:3 HP:25 | - | `toafk` |
| `11040` | Apocryphus | Minion | Anachronauts | SCH:1 ATK:3 HP:4 | 0 icons + star | `toafk` |
| `11041` | Deathunt 9000 | Minion | Anachronauts | SCH:1 ATK:1 HP:6 | 0 icons + star | `toafk` |
| `11042` | Sir Raston | Minion | Anachronauts | SCH:1 ATK:2 HP:6 | 0 icons + star | `toafk` |
| `11043` | Terminatrix | Minion | Anachronauts | SCH:2 ATK:2 HP:5 | 0 icons + star | `toafk` |
| `11044` | Wildrun | Minion | Anachronauts | SCH:1 ATK:2 HP:5 | 0 icons + star | `toafk` |
| `11045` | The Anachronauts | Side Scheme | Anachronauts | - | 3 icons | `toafk` |
| `11046` | Kang's Chosen | Treachery | Anachronauts | - | 2 icons | `toafk` |
| `11047` | Kang (Master of Time) | Minion | Master of Time | SCH:1 ATK:1 HP:6 | 2 icons | `toafk` |
| `11048` | Time-Displaced Soldier | Minion | Master of Time | SCH:1 ATK:2 HP:3 | 0 icons + star | `toafk` |
| `11049` | Fear of Kang | Obligation | Master of Time | - | 2 icons | `toafk` |
| `11050` | Light of Centuries Sphere | Side Scheme | Master of Time | - | 3 icons | `toafk` |
| `11051` | Ancient Grudge | Treachery | Master of Time | - | 1 icon | `toafk` |

---

## Pack: The Once and Future Kang (`toafk`)

### Set: Kang

### [11001] Kang (The Conqueror)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (1/43)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness
  > [star] **Forced Interrupt**: When Kang attacks you, either place 1 threat on the main scheme, or he gets +2 ATK for this attack.
  > **When Defeated**: Advance the main scheme to stage 2 at the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/11001.png` (710×1030 px, 384.6 KB)

### [11002] Kang (Immortus)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (2/43)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 18
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness.
  > This villain cannot take damage while a minion is in play.
  > **When Defeated**: Remove the Chronopolis from the game. At the end of the phase, join another game area.
- **Image Asset**: `assets/card-art/bundles/cards/11002.png` (710×1030 px, 380.2 KB)

### [11003] Kang (Iron Lad)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (3/43)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 18
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Retaliate 1. Toughness.
  > **When Defeated**: Remove Inexorable Fate from the game. At the end of the phase, join another game area.
- **Image Asset**: `assets/card-art/bundles/cards/11003.png` (710×1030 px, 358.1 KB)

### [11004] Kang (Rama-Tut)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (4/43)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 18
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness.
  > [star] This villain gets +1 ATK for each obligation in play.
  > **When Defeated**: Remove the Realm of Rama-Tut from the game. At the end of the phase, join another game area.
- **Image Asset**: `assets/card-art/bundles/cards/11004.png` (710×1030 px, 390.5 KB)

### [11005] Kang (Scarlet Centurion)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (5/43)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 0, **ATK**: 3 [star], **HP**: 18
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness.
  > [star] This villain's attack gains piercing.
  > **When Defeated**: Remove The Present Future War from the game. At the end of the phase, join another game area.
- **Image Asset**: `assets/card-art/bundles/cards/11005.png` (710×1030 px, 359.4 KB)

### [11006] Kang (The Conqueror)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (6/43)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Interrupt**: When Kang attacks you, either place 1 threat on the main scheme, or he gets +2 ATK for this attack.
  > **When Defeated**: The players win the game.
- **Image Asset**: `assets/card-art/bundles/cards/11006.png` (710×1030 px, 395.1 KB)

### [11007] Kang's Arrival
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (7/43)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Deal each player an encounter card.
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**: Kang's Arrival
  > **Contents:** Kang (I), each Kang (II), and Kang (III). Kang and Standard encounter sets. One modular encounter set *(Temporal).*
  > **Setup:** Set each Kang (II), Kang (III), and Kang's Dominion side scheme aside. remove each player's obligation cards from the game. Shuffle the encounter deck.
- **Flavor**: *Kang believes that by defeating Earth's mightiest heroes, the rest of the planet will submit to his rule.*
- **Image Asset**: `assets/card-art/bundles/cards/11007.jpg` (1030×710 px, 350.2 KB)

### [11007a] Kang's Arrival
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (7/43)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Kang (I), each Kang (II), and Kang (III). Kang and Standard encounter sets. One modular encounter set *(Temporal).*
  > **Setup**: Set each Kang (II), Kang (III), and Kang's Dominion side scheme aside. remove each player's obligation cards from the game. Shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/11007a.png` (1030×710 px, 350.2 KB)

### [11007b] Kang's Arrival
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (7/43)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal each player an encounter card.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Kang believes that by defeating Earth's mightiest heroes, the rest of the planet will submit to his rule.*

### [11008] The Master of Time
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (8/43)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 0
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt:** When an acceleration token would be placed on another scheme, place it here instead.
  > **Players cannot join this game area unless there are no other game areas remaining. When all the players have joined this game area, advanced to stage 4A.**
- **Reverse Side**: The Master of Time
  > **When Revealed:** Place 1 acceleration token here for each side scheme in play, then discard each side scheme. Each player reveals a random stage 3A in turn oder. Remove any unused stage 3 schemes from the game.
  - **Back Flavor**: *Kang reels back, but saves himself by separating the heroes through time and space.*
- **Image Asset**: `assets/card-art/bundles/cards/11008.jpg` (1030×710 px, 358.1 KB)

### [11008a] The Master of Time
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (8/43)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 1 acceleration token here for each side scheme in play, then discard each side scheme. Each player reveals a random stage 3A in turn oder. Remove any unused stage 3 schemes from the game.
- **Flavor**: *Kang reels back, but saves himself by separating the heroes through time and space.*
- **Image Asset**: `assets/card-art/bundles/cards/11008a.png` (1030×710 px, 358.1 KB)

### [11008b] The Master of Time
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (8/43)
- **Properties**: Stage 2B
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When an acceleration token would be placed on another scheme, place it here instead.
  > **Players cannot join this game area unless there are no other game areas remaining. When all the players have joined this game area, advanced to stage 4A.**

### [11009] The Chronopolis
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (9/43)
- **Properties**: Stage 3, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 9, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response:** After this stage is complete, place 1 set-aside Kang's Dominion facedown under stage 4A. At the end of the phase, remove Kang (Immortus) and this stage from the game and combine your game area with another game area.
  > **If all the players at this stage are defeated, this stage is complete.**
- **Reverse Side**: The Chronopolis
  > **When Revealed:** Create your own game area and place this scheme in it. Add Kang (Immortus) to the game area and deal yourself an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/11009.png` (1030×710 px, 311.1 KB)

### [11009a] The Chronopolis
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (9/43)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Create your own game area and place this scheme in it. Add Kang (Immortus) to the game area and deal yourself an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/11009a.png` (1030×710 px, 311.1 KB)

### [11009b] The Chronopolis
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (9/43)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After this stage is complete, place 1 set-aside Kang's Dominion facedown under stage 4A. At the end of the phase, remove Kang (Immortus) and this stage from the game and combine your game area with another game area.
  > **If all the players at this stage are defeated, this stage is complete.**

### [11010] Inexorable Fate
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (10/43)
- **Properties**: Stage 3, Double-Sided
- **Stats**: **Base Threat**: 1, **Target Threat**: 9, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response:** After this stage is completed, place 1 set-aside Kang's Dominion facedown under stage 4A. At the end of the phase, remove Kang (Iron Lad) and this stage from the game and combine your game area with another game area.
  > **If all the players at the stage are defeated, this stage is completed.**
- **Reverse Side**: Inexorable Fate
  > **When Revealed:** Create your own game area and place this scheme in it. Add Kang (Iron Lad) to the game area and deal yourself an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/11010.jpg` (1030×710 px, 323.1 KB)

### [11010a] Inexorable Fate
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (10/43)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Create your own game area and place this scheme in it. Add Kang (Iron Lad) to the game area and deal yourself an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/11010a.png` (1030×710 px, 323.1 KB)

### [11010b] Inexorable Fate
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (10/43)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 1, **Target Threat**: 9, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After this stage is completed, place 1 set-aside Kang's Dominion facedown under stage 4A. At the end of the phase, remove Kang (Iron Lad) and this stage from the game and combine your game area with another game area.
  > **If all the players at the stage are defeated, this stage is completed.**
- **Image Asset**: `assets/card-art/bundles/cards/11010b.png` (1030×710 px, 387.3 KB)

### [11011] The Realm of Rama-Tut
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (11/43)
- **Properties**: Stage 3, Double-Sided
- **Stats**: **Base Threat**: 1, **Target Threat**: 9, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response:** After this stage is completed, place 1 set-aside Kang's Dominion facedown under stage 4A. At the end of the phase, remove Kang (Rama-Tut) and this stage from the game and combine your game area with another game area.
  > **If all the players at this stage are defeated, this stage is completed.**
- **Reverse Side**: The Realm of Rama-Tut
  > **When Revealed:** Create your own game area and place this scheme in it. Add Kang (Rama-Tut) to the game area and deal yourself an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/11011.png` (1030×710 px, 310.6 KB)

### [11011a] The Realm of Rama-Tut
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (11/43)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Create your own game area and place this scheme in it. Add Kang (Rama-Tut) to the game area and deal yourself an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/11011a.png` (1030×710 px, 310.6 KB)

### [11011b] The Realm of Rama-Tut
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (11/43)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 1, **Target Threat**: 9, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After this stage is completed, place 1 set-aside Kang's Dominion facedown under stage 4A. At the end of the phase, remove Kang (Rama-Tut) and this stage from the game and combine your game area with another game area.
  > **If all the players at this stage are defeated, this stage is completed.**
- **Image Asset**: `assets/card-art/bundles/cards/11011b.png` (1030×710 px, 370.0 KB)

### [11012] The Present Future War
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (12/43)
- **Properties**: Stage 3, Double-Sided
- **Stats**: **Base Threat**: 2, **Target Threat**: 9, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response:** After this stage is completed, place 1 set-aside Kang's Dominion facedown under stage 4A. At the end of the phase, remove Kang (Scarlet Centurion) and this stage from the game and combine your game area with another game area.
  > **If all the players at this stage are defeated, this stage is completed.**
- **Reverse Side**: The Present Future War
  > **When Revealed:** Create your own game area and place this scheme in it. Add Kang (Scarlet Centurion) to the game area and deal yourself an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/11012.png` (1030×710 px, 361.2 KB)

### [11012a] The Present Future War
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (12/43)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Create your own game area and place this scheme in it. Add Kang (Scarlet Centurion) to the game area and deal yourself an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/11012a.png` (1030×710 px, 361.2 KB)

### [11012b] The Present Future War
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (12/43)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 2, **Target Threat**: 9, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After this stage is completed, place 1 set-aside Kang's Dominion facedown under stage 4A. At the end of the phase, remove Kang (Scarlet Centurion) and this stage from the game and combine your game area with another game area.
  > **If all the players at this stage are defeated, this stage is completed.**
- **Image Asset**: `assets/card-art/bundles/cards/11012b.png` (1030×710 px, 428.0 KB)

### [11013] Kang's Wrath
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (13/43)
- **Properties**: Stage 4, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Each player searches the encounter deck, discard pile, and set-aside area for their nemesis minion and puts it into play engaged with them. Shuffle the encounter deck.
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**: Kang's Wrath
  > **When Revealed:** Reveal Kang (III) and add him to the game area. Reveal each face down Kang's Dominion under this stage.
  - **Back Flavor**: *You used your enemy's technology to reunite in the present day, just in time to counter Kang's assault on Earth.*
- **Image Asset**: `assets/card-art/bundles/cards/11013.jpg` (1030×710 px, 358.2 KB)

### [11013a] Kang's Wrath
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (13/43)
- **Properties**: Stage 4A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Reveal Kang (III) and add him to the game area. Reveal each face down Kang's Dominion under this stage.
- **Flavor**: *You used your enemy's technology to reunite in the present day, just in time to counter Kang's assault on Earth.*
- **Image Asset**: `assets/card-art/bundles/cards/11013a.png` (1030×710 px, 358.2 KB)

### [11013b] Kang's Wrath
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (13/43)
- **Properties**: Stage 4B
- **Stats**: **Base Threat**: 0, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player searches the encounter deck, discard pile, and set-aside area for their nemesis minion and puts it into play engaged with them. Shuffle the encounter deck.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/11013b.png` (1030×710 px, 335.3 KB)

### [11014] Temporal Shield
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (14–15/43, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to Kang.
  > **Forced Interrupt**: When Kang is attacked, discard Temporal Shield → prevent all damage from this attack and deal 1 damage to the attacker. (Max 1 per attack.)
- **Flavor**: *"Put away your childish weapons! They are no more than toys to me!" —Kang*
- **Image Asset**: `assets/card-art/bundles/cards/11014.png` (710×1030 px, 384.5 KB)

### [11015] Future Weapon
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (16–17/43, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to Kang.
  > [star] **Forced Interrupt**: When Kang attacks, the attack gains overkill. If this attack damages a hero, that hero is stunned. After this attack, discard Future Weapon.
- **Flavor**: *"Like myself, you know that combat means something, and honor more~" —Kang*
- **Image Asset**: `assets/card-art/bundles/cards/11015.png` (710×1030 px, 410.1 KB)

### [11016] Frozen in Time
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (18/43)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Interrupt**: When attached character would ready, discard this card instead.
  >
  > ---
  >
  > [star] **Boost**: Attach to your identity.
- **Image Asset**: `assets/card-art/bundles/cards/11016.png` (710×1030 px, 374.9 KB)

### [11017] Macrobots
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (19–21/43, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Robot. Temporal.*
- **Rules Text**:
  > Guard. Retaliate 1.
  >
  > ---
  >
  > [star] **Boost**: Give Kang a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/11017.png` (710×1030 px, 359.1 KB)

### [11018] Weakened
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (22–23/43, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > **Forced Response**: After you use a basic hero power, take 1 damage.
  > **Alter-Ego Action**: Discard a [physical] resource from your hand → discard this obligation.
- **Flavor**: *"History is made! Made by the deeds of the strong! The brave! And destiny is forged!" —Kang*
- **Image Asset**: `assets/card-art/bundles/cards/11018.png` (710×1030 px, 390.1 KB)

### [11019] Stolen Memories
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (24–25/43, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > **When Revealed**: Place the top 8 cards of your deck facedown under this card.
  > **Alter-Ego Action**: Discard a [mental] resource from your hand → discard this obligation. *(Discard each facedown card under this obligation.)*
- **Image Asset**: `assets/card-art/bundles/cards/11019.png` (710×1030 px, 345.0 KB)

### [11020] Depowered
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (26–27/43, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > You cannot play hero-specific cards.
  > **Alter-Ego Action**: Discard a hero-specific card from your hand → discard this obligation.
- **Flavor**: *"Greater men than you have trembled at my name. Lesser men have fainted at its mention!" —Kang*
- **Image Asset**: `assets/card-art/bundles/cards/11020.png` (710×1030 px, 392.4 KB)

### [11021] Time-Travel Hijinks
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (28–29/43, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > **When Revealed**: Discard the highest-cost card you control, then place it facedown under this card.
  > **Alter-Ego Action**: Discard a [energy] resource from your hand → discard this obligation.*(Discard each facedown card under this obligation.)*
- **Image Asset**: `assets/card-art/bundles/cards/11021.png` (710×1030 px, 344.6 KB)

### [11022] Corrupted Timestream
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (30/43)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Players cannot trigger "**Alter-Ego Action**" abilities on obligations.
  > **When Revealed**: Each player must either discard 1 random card from hand, or place 2 threat here.
- **Image Asset**: `assets/card-art/bundles/cards/11022.png` (1030×710 px, 389.3 KB)

### [11023] Kang's Dominion
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (31–34/43, Qty: 4)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Kang cannot take damage.
  > **When Defeated**: Deal the player who defeated this scheme an encounter card.
- **Flavor**: *"The future belongs to Kang! To Kang!" —Kang*
- **Image Asset**: `assets/card-art/bundles/cards/11023.png` (1030×710 px, 310.6 KB)

### [11024] Pinned Down
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (35/43)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Place 2 threat here for each obligation in play.
- **Image Asset**: `assets/card-art/bundles/cards/11024.png` (1030×710 px, 355.9 KB)

### [11025] Rampage
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (36–37/43, Qty: 2)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Discard cards from the top of the encounter deck until a minion is discarded. Put that minion into play engaged with the player who defeated this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/11025.png` (1030×710 px, 369.3 KB)

### [11026] Energy Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (38–39/43, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard an ally or support you control. If you cannot, this card gains surge.
  > **When Revealed (Hero)**: Kang attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/11026.png` (710×1030 px, 364.2 KB)

### [11027] Manipulated Timestream
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (40/43)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard each event from your hand. If no events are discarded this way, this card gains surge.
- **Flavor**: *"It is the conquerors who change the world." —Kang*
- **Image Asset**: `assets/card-art/bundles/cards/11027.png` (710×1030 px, 307.7 KB)

### [11028] Time-Travel Tactics
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (41–42/43, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Each player takes 1 indirect damage for each obligation in their play area.
  >
  > ---
  >
  > [star] **Boost**: This card gains [boost] for each obligation in your play area.
- **Image Asset**: `assets/card-art/bundles/cards/11028.png` (710×1030 px, 373.7 KB)

### [11029] Past Machinations
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Kang (43/43)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1. *(Place 1 threat on the main scheme when this card is revealed.)*
  > **When Revealed**: Each player searches the encounter deck and discard pile for a different obligation and reveals it.
  > Shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/11029.png` (710×1030 px, 398.5 KB)


### Set: Temporal

### [11030] Ancient Warrior
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Temporal (1–3/7, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Temporal Set Icon (printed bottom-right next to deck number)
- **Traits**: *Soldier. Temporal.*
- **Rules Text**:
  > Quickstrike.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/11030.png` (710×1030 px, 350.9 KB)

### [11031] Chitauri Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Temporal (4–5/7, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Temporal Set Icon (printed bottom-right next to deck number)
- **Traits**: *Soldier. Temporal.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Chitauri Soldier attacks you, discard the top card of the encounter deck → take indirect damage equal to the number of boost icons on that card.
- **Image Asset**: `assets/card-art/bundles/cards/11031.png` (710×1030 px, 351.2 KB)

### [11032] Tyrannosaurus Rex
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Temporal (6/7)
- **Stats**: **SCH**: 0, **ATK**: 3 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Temporal Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature. Temporal.*
- **Rules Text**:
  > Toughness.
  > [star] Tyrannosaurus Rex's attacks gain piercing.
- **Image Asset**: `assets/card-art/bundles/cards/11032.png` (710×1030 px, 358.9 KB)

### [11033] Time Portal
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Temporal (7/7)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Temporal Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **Forced Interrupt**: When this scheme is defeated, shuffle it into the encounter deck instead of discarding it.
- **Image Asset**: `assets/card-art/bundles/cards/11033.png` (1030×710 px, 336.0 KB)


### Set: Expert Kang

### [11034] Kang (The Conqueror)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Expert Kang (1/6)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Expert Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Interrupt**: When Kang attacks you, either place 1 threat on the main scheme, or he gets +2 ATK for this attack.
  > **When Defeated**: Advance the main scheme to stage 2 at the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/11034.png` (710×1030 px, 369.0 KB)

### [11035] Kang (Immortus)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Expert Kang (2/6)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 3, **ATK**: 2, **HP**: 22
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Expert Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness.
  > This villain cannot take damage while a minion is in play.
  > **When Defeated**: Remove The Chronopolis from the game. At the end of the phase, join another game area.
- **Image Asset**: `assets/card-art/bundles/cards/11035.png` (710×1030 px, 382.4 KB)

### [11036] Kang (Iron Lad)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Expert Kang (3/6)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 22
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Expert Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Retaliate 1. Toughness.
  > **When Defeated**: Remove Inexorable Fate from the game. At the end of the phase, join another game area.
- **Image Asset**: `assets/card-art/bundles/cards/11036.png` (710×1030 px, 360.4 KB)

### [11037] Kang (Rama-Tut)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Expert Kang (4/6)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 22
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Expert Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness.
  > [star] This villain gets +1 ATK for each obligation in play.
  > **When Defeated**: Remove The Realm of Rama-Tut from the game. At the end of the phase, join another game area.
- **Image Asset**: `assets/card-art/bundles/cards/11037.png` (710×1030 px, 415.0 KB)

### [11038] Kang (Scarlet Centurion)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Expert Kang (5/6)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 4 [star], **HP**: 22
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Expert Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness.
  > [star] This villain's attacks gain piercing.
  > **When Defeated**: Remove The Present Future War from the game. At the end of the phase, join another game area.
- **Image Asset**: `assets/card-art/bundles/cards/11038.png` (710×1030 px, 360.0 KB)

### [11039] Kang (The Conqueror)
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Expert Kang (6/6)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 3 [star], **HP**: 25 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Expert Kang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Interrupt**: When Kang attacks you, either place 1 threat on the main scheme, or he gets +2 ATK for this attack.
  > **When Defeated**: The players win the game.
- **Image Asset**: `assets/card-art/bundles/cards/11039.png` (710×1030 px, 393.4 KB)


### Set: Anachronauts

### [11040] Apocryphus
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Anachronauts (1/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Anachronauts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Temporal.*
- **Rules Text**:
  > **When Revealed**: Discard an ally or support you control.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a character you control. Give this enemy another boost card.
- **Image Asset**: `assets/card-art/bundles/cards/11040.png` (710×1030 px, 366.2 KB)

### [11041] Deathunt 9000
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Anachronauts (2/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Anachronauts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Temporal.*
- **Rules Text**:
  > Toughness. Villainous. *(When this minion activates, give it a boost card.)*
  >
  > ---
  >
  > [star] **Boost**: Give this enemy a tough status card and another boost card.
- **Image Asset**: `assets/card-art/bundles/cards/11041.png` (710×1030 px, 372.5 KB)

### [11042] Sir Raston
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Anachronauts (3/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Anachronauts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Temporal.*
- **Rules Text**:
  > Guard. Retaliate 1.
  >
  > ---
  >
  > [star] **Boost**: Take 1 damage. Give this enemy another boost card.
- **Image Asset**: `assets/card-art/bundles/cards/11042.png` (710×1030 px, 345.6 KB)

### [11043] Terminatrix
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Anachronauts (4/9)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Anachronauts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Temporal.*
- **Rules Text**:
  > Quickstrike.
  > [star] Terminatrix's attacks gain piercing.
  >
  > ---
  >
  > [star] **Boost**: Give this enemy 2 more boost cards.
- **Image Asset**: `assets/card-art/bundles/cards/11043.png` (710×1030 px, 372.1 KB)

### [11044] Wildrun
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Anachronauts (5/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Anachronauts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Temporal.*
- **Rules Text**:
  > **When Revealed**: Discard 1 random card from your hand.
  >
  > ---
  >
  > [star] **Boost**: Discard 1 random card from your hand. Give this enemy another boost card.
- **Image Asset**: `assets/card-art/bundles/cards/11044.png` (710×1030 px, 356.6 KB)

### [11045] The Anachronauts
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Anachronauts (6–7/9, Qty: 2)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Anachronauts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: Shuffle each [[Temporal]] card in the encounter discard pile into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/11045.png` (710×1030 px, 380.2 KB)

### [11046] Kang's Chosen
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Anachronauts (8–9/9, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Anachronauts Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1. *(When revealed, place 1 threat on the main scheme.)*
  > **When Revealed**: Discard cards from the top of the encounter deck until a [[Temporal]] minion is discarded. Reveal that minion.
- **Image Asset**: `assets/card-art/bundles/cards/11046.png` (710×1030 px, 343.3 KB)


### Set: Master of Time

### [11047] Kang (Master of Time)
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Master of Time (1/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Master of Time Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Temporal.*
- **Rules Text**:
  > Toughness. Villainous. *(When this minion activates, give it a boost card.)*
  > Kang (Master of Time) gets +1 SCH and +1 ATK for each obligation in your play area.
- **Image Asset**: `assets/card-art/bundles/cards/11047.png` (710×1030 px, 367.6 KB)

### [11048] Time-Displaced Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Master of Time (2–3/8, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Master of Time Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Temporal.*
- **Rules Text**:
  > Incite 1. Surge.
  >
  > ---
  >
  > [star] **Boost**: Deal yourself 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/11048.png` (710×1030 px, 324.6 KB)

### [11049] Fear of Kang
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Master of Time (4–5/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Master of Time Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > You cannot attack Kang.
  > **Alter-Ego Action**: Discard a random card from your hand → discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/11049.png` (710×1030 px, 309.6 KB)

### [11050] Light of Centuries Sphere
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Master of Time (6/8)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Master of Time Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: Discard cards from the top of the encounter deck until a minion is discarded. Put that minion into play engaged with the player who defeated this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/11050.png` (1030×710 px, 313.6 KB)

### [11051] Ancient Grudge
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Once and Future Kang (`toafk`)
- **Deck / Set**: Master of Time (7–8/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Master of Time Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Kang (Master of Time) activates against you. If Kang (Master of Time) is not in play, search the encounter deck and discard pile for Kang (Master of Time) and put him into play engaged with you. Shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/11051.png` (710×1030 px, 329.0 KB)


