# Marvel Champions Card Reference Database

This document is an authoritative, complete card database generated directly from the game card assets and metadata. It is formatted specifically for AI and rules engine consumption.

## Rules & Symbol Legend

### 1. Bottom-Right Encounter Logos
- **Boost Icons (Pips)**: In the lower-right corner of Villain, Minion, Treachery, and Attachment cards, there are triangular boost icons (0 to 4). When the card is flipped face-down as a Boost Card during a Villain attack or scheme activation, each boost icon adds +1 to the Villain's ATK or SCH.
- **Boost Star (`[star]`)**: An icon in the boost area indicating that drawing this card triggers a special **Boost Ability** printed in the card's text box.
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
- **HP**: Hit Points (health pool; may be fixed or multiplied *per hero*).
- **`[star]`**: Asterisk/Star indicating a dynamic or variable stat governed by card text.
- **`[mental]` / `[physical]` / `[energy]` / `[wild]`**: Resource icons used to pay card costs.

## Quick Index

| Code | Name | Type | Deck / Set | Stats | Boost | Pack |
|---|---|---|---|---|---|---|
| `02001a` | Norman Osborn | Villain | Risky Business | SCH:2 HP:14 | - | `gob` |
| `02001b` | Green Goblin | Villain | Risky Business | ATK:3 HP:14 | - | `gob` |
| `02002a` | Norman Osborn | Villain | Risky Business | SCH:2 HP:18 | - | `gob` |
| `02002b` | Green Goblin | Villain | Risky Business | ATK:4 HP:18 | - | `gob` |
| `02003a` | Norman Osborn | Villain | Risky Business | SCH:3 HP:22 | - | `gob` |
| `02003b` | Green Goblin | Villain | Risky Business | ATK:4 HP:22 | - | `gob` |
| `02004` | Hostile Takeover | Main Scheme | Risky Business | - | - | `gob` |
| `02004a` | Hostile Takeover | Main Scheme | Risky Business | - | - | `gob` |
| `02004b` | Hostile Takeover | Main Scheme | Risky Business | - | - | `gob` |
| `02005` | Corporate Acquisition | Main Scheme | Risky Business | - | - | `gob` |
| `02005a` | Corporate Acquisition | Main Scheme | Risky Business | - | - | `gob` |
| `02005b` | Corporate Acquisition | Main Scheme | Risky Business | - | - | `gob` |
| `02006a` | Criminal Enterprise | Environment | Risky Business | - | - | `gob` |
| `02006b` | State of Madness | Environment | Risky Business | - | - | `gob` |
| `02007` | Hired Gun | Minion | Risky Business | SCH:2 ATK:2 HP:3 | 2 pips | `gob` |
| `02008` | Private Security Specialist | Minion | Risky Business | SCH:0 ATK:1 HP:4 | 1 pips | `gob` |
| `02009` | Collapsing Bridge | Side Scheme | Risky Business | - | Star | `gob` |
| `02010` | Oscorp Manufacturing | Side Scheme | Risky Business | - | 3 pips | `gob` |
| `02011` | Payoff | Side Scheme | Risky Business | - | 1 pips | `gob` |
| `02012` | All in a Day's Work | Treachery | Risky Business | - | Star | `gob` |
| `02013` | Mad Genius | Treachery | Risky Business | - | 1 pips | `gob` |
| `02014` | Green Goblin | Villain | Mutagen Formula | SCH:1 ATK:2 HP:16 | - | `gob` |
| `02015` | Green Goblin | Villain | Mutagen Formula | SCH:2 ATK:2 HP:18 | - | `gob` |
| `02016` | Green Goblin | Villain | Mutagen Formula | SCH:2 ATK:3 HP:20 | - | `gob` |
| `02017` | Unleashing the Mutagen | Main Scheme | Mutagen Formula | - | - | `gob` |
| `02017a` | Unleashing the Mutagen | Main Scheme | Mutagen Formula | - | - | `gob` |
| `02017b` | Unleashing the Mutagen | Main Scheme | Mutagen Formula | - | - | `gob` |
| `02018` | Mutagen Cloud | Main Scheme | Mutagen Formula | - | - | `gob` |
| `02018a` | Mutagen Cloud | Main Scheme | Mutagen Formula | - | - | `gob` |
| `02018b` | Mutagen Cloud | Main Scheme | Mutagen Formula | - | - | `gob` |
| `02019` | Goblin Glider | Attachment | Mutagen Formula | ATK:1 | 3 pips | `gob` |
| `02020` | Hysteria | Attachment | Mutagen Formula | - | 1 pips | `gob` |
| `02021` | Pumpkin Bombs | Attachment | Mutagen Formula | - | 2 pips | `gob` |
| `02022` | Goblin Knight | Minion | Mutagen Formula | SCH:2 ATK:2 HP:7 | 2 pips | `gob` |
| `02023` | Goblin Soldier | Minion | Mutagen Formula | SCH:1 ATK:1 HP:5 | Star | `gob` |
| `02024` | Goblin Thrall | Minion | Mutagen Formula | SCH:1 ATK:1 HP:3 | Star | `gob` |
| `02025` | Monster | Minion | Mutagen Formula | SCH:1 ATK:3 HP:6 | 2 pips | `gob` |
| `02026` | Goblin Reinforcements | Side Scheme | Mutagen Formula | - | 2 pips | `gob` |
| `02027` | Goblin Nation | Side Scheme | Mutagen Formula | - | Star | `gob` |
| `02028` | Overrun | Side Scheme | Mutagen Formula | - | 1 pips | `gob` |
| `02029` | Death from Above | Treachery | Mutagen Formula | - | 1 pips | `gob` |
| `02030` | I See You | Treachery | Mutagen Formula | - | 1 pips | `gob` |
| `02031` | Overconfidence | Treachery | Mutagen Formula | - | 1 pips | `gob` |
| `02032` | Wicked Ambitions | Treachery | Mutagen Formula | - | 1 pips | `gob` |
| `02033` | Goblin Glider | Attachment | Goblin Gimmicks | ATK:1 | 3 pips | `gob` |
| `02034` | Pumpkin Bombs | Attachment | Goblin Gimmicks | - | 2 pips | `gob` |
| `02035` | Intimidation | Treachery | Goblin Gimmicks | - | 1 pips | `gob` |
| `02036` | Regenerative Healing | Treachery | Goblin Gimmicks | - | Star | `gob` |
| `02037` | A Mess of Things | Side Scheme | A Mess of Things | - | 2 pips | `gob` |
| `02038` | Scorpion | Minion | A Mess of Things | SCH:3 ATK:3 HP:7 | 2 pips | `gob` |
| `02039` | Gang-Up | Treachery | A Mess of Things | - | 1 pips | `gob` |
| `02040` | Tail Sweep | Treachery | A Mess of Things | - | Star | `gob` |
| `02041` | Power Drain | Side Scheme | Power Drain | - | 3 pips | `gob` |
| `02042` | Electro | Minion | Power Drain | SCH:2 ATK:2 HP:6 | 2 pips | `gob` |
| `02043` | Electromagnetic Pulse | Treachery | Power Drain | - | 2 pips | `gob` |
| `02044` | Lightning Bolt | Treachery | Power Drain | - | 1 pips | `gob` |
| `02045` | Shock Therapy | Treachery | Power Drain | - | 1 pips | `gob` |
| `02046` | Running Interference | Side Scheme | Running Interference | - | 1 pips | `gob` |
| `02047` | Tombstone | Minion | Running Interference | SCH:2 ATK:3 HP:9 | 2 pips | `gob` |
| `02048` | All Tied Up | Attachment | Running Interference | - | - | `gob` |
| `02049` | Media Coverage | Attachment | Running Interference | - | 1 pips | `gob` |

---

## Pack: The Green Goblin (`gob`)

### Set: Risky Business

### [02001a] Norman Osborn
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (1/24)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Traits**: *Businessman. Genius.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Norman Osborn would attack, place 1 infamy counter on Criminal Enterprise instead.
  > **Forced Interrupt**: When Norman Osborn would take any amount of damage, remove that many infamy counters from Criminal Enterprise instead.
- **Image Asset**: `assets/card-art/bundles/cards/02001a.png` (300×419 px, 39.3 KB)
### [02001b] Green Goblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (1/24)
- **Properties**: Unique, Stage I
- **Stats**: **ATK**: 3, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin.*
- **Rules Text**:
  > **When Revealed**: Deal 3 indirect damage to each player in hero form.
  > [star] **Forced Interrupt**: When Green Goblin would scheme, remove 1 madness counter from State of Madness instead.
- **Image Asset**: `assets/card-art/bundles/cards/02001b.png` (300×419 px, 38.5 KB)
### [02002a] Norman Osborn
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (2/24)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Traits**: *Businessman. Genius.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Norman Osborn would attack, place 2 infamy counter on Criminal Enterprise instead.
  > **Forced Interrupt**: When Norman Osborn would take any amount of damage, remove that many infamy counters from Criminal Enterprise instead.
### [02002b] Green Goblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (2/24)
- **Properties**: Unique, Stage II
- **Stats**: **ATK**: 4, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin.*
- **Rules Text**:
  > **When Revealed**: Deal 3 indirect damage to each player.
  > [star] **Forced Interrupt**: When Green Goblin would scheme, remove 1 madness counter from State of Madness instead.
- **Image Asset**: `assets/card-art/bundles/cards/02002b.png` (300×419 px, 38.2 KB)
### [02003a] Norman Osborn
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (3/24)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Traits**: *Businessman. Genius.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Norman Osborn would attack, place 3 infamy counter on Criminal Enterprise instead.
  > **Forced Interrupt**: When Norman Osborn would take any amount of damage, remove that many infamy counters from Criminal Enterprise instead.
### [02003b] Green Goblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (3/24)
- **Properties**: Unique, Stage III
- **Stats**: **ATK**: 4, **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin.*
- **Rules Text**:
  > **When Revealed**: Deal 4 damage to each player.
  > [star] **Forced Interrupt**: When Green Goblin would scheme, remove 2 madness counters from State of Madness instead.
- **Image Asset**: `assets/card-art/bundles/cards/02003b.png` (300×419 px, 38.1 KB)
### [02004] Hostile Takeover
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (4/24)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Completed**: Place 1[per_hero] infamy counters on Criminal Enterprise. Then discard 1 card from each player's deck for each infamy counter on Criminal Enterprise.
- **Flavor**: *Norman Osborn holds a board meeting planning to take over a branch of Stark Industries.*
- **Image Asset**: `assets/card-art/bundles/cards/02004.png` (1030×710 px, 352.7 KB)
### [02004a] Hostile Takeover
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (4/24)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Norman Osborn (I) and Norman Osborn (II). *(Norman Osborn (II) and Norman Osborn (III) instead for expert mode.)* Risky Business and Standard encounter sets. One modular encounter set *(recommended: Goblin Gimmicks)*.
  > **Setup**: Put the Criminal Enterprise environment into play. Shuffle the encounter deck. Advance to stage 1B.
- **Image Asset**: `assets/card-art/bundles/cards/02004a.png` (1030×710 px, 352.7 KB)
### [02004b] Hostile Takeover
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (4/24)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Completed**: Place 1[per_hero] infamy counters on Criminal Enterprise. Then discard 1 card from each player's deck for each infamy counter on Criminal Enterprise.
- **Flavor**: *Norman Osborn holds a board meeting planning to take over a branch of Stark Industries.*
- **Image Asset**: `assets/card-art/bundles/cards/02004b.png` (419×300 px, 37.3 KB)
### [02005] Corporate Acquisition
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (5/24)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *If Norman Osborn succeeds, nothing will stand in the way of his technological domination.*
- **Image Asset**: `assets/card-art/bundles/cards/02005.jpg` (419×300 px, 31.4 KB)
### [02005a] Corporate Acquisition
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (5/24)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Advance to stage 2B.
- **Flavor**: *With a branch of Stark Industries under his control, Norman Osborn will gain access to deadly technologies and quadruple the manufacturing capabilities of Oscorp.*
- **Image Asset**: `assets/card-art/bundles/cards/02005a.jpg` (419×300 px, 31.4 KB)
### [02005b] Corporate Acquisition
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (5/24)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *If Norman Osborn succeeds, nothing will stand in the way of his technological domination.*
- **Image Asset**: `assets/card-art/bundles/cards/02005b.png` (419×300 px, 38.5 KB)
### [02006a] Criminal Enterprise
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (6/24)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Criminal Enterprise enter play with 2[per_hero] infamy counters on it. If there are no infamy counters here, flip Norman Osborn and Criminal Enterprise.
- **Flavor**: *"Business. Is. Good."*
- **Image Asset**: `assets/card-art/bundles/cards/02006a.png` (300×419 px, 36.6 KB)
### [02006b] State of Madness
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (6/24)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > State of Madness enter play with 2[per_hero] madness counters on it. If there are no madness counters here, flip Green Goblin and State of Madness.
- **Flavor**: *"Fool! Your power is nothing compared to mine! Your strength is nothing, your intellect is NOTHING!" —Green Goblin*
- **Image Asset**: `assets/card-art/bundles/cards/02006b.png` (300×419 px, 39.6 KB)
### [02007] Hired Gun
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (7–9/24, Qty: 3)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: Choose to either give the villain 1 facedown boost card or place 2 infamy counters on Criminal Enterprise.
  > [star] **Boost**: Place 1 infamy counter on Criminal Enterprise. If you cannot, remove 1 madness counter from State of Madness.
- **Image Asset**: `assets/card-art/bundles/cards/02007.png` (300×419 px, 41.6 KB)
### [02008] Private Security Specialist
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (10–13/24, Qty: 4)
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mercenary.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
  > [star] **Boost**: Place 1 infamy counter on Criminal Enterprise. If you cannot, remove 1 madness counter from State of Madness.
- **Image Asset**: `assets/card-art/bundles/cards/02008.png` (300×419 px, 38.4 KB)
### [02009] Collapsing Bridge
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (14/24)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > [star] **Boost**: Place 1 infamy counter on Criminal Enterprise. If you cannot, remove 1 madness counter from State of Madness.
- **Image Asset**: `assets/card-art/bundles/cards/02009.png` (419×300 px, 38.3 KB)
### [02010] Oscorp Manufacturing
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (15–16/24, Qty: 2)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed (Norman Osborn)**: Place an additional 1[per_hero] threat here.
- **Flavor**: *Despite objections from shareholders, Oscorp now exclusively produces military-grade weaponry.*
- **Image Asset**: `assets/card-art/bundles/cards/02010.png` (419×300 px, 38.4 KB)
### [02011] Payoff
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (17–18/24, Qty: 2)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > [star] **Boost**: Place 1 infamy counter on Criminal Enterprise. If you cannot, remove 1 madness counter from State of Madness.
- **Image Asset**: `assets/card-art/bundles/cards/02011.png` (419×300 px, 32.1 KB)
### [02012] All in a Day's Work
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (19–22/24, Qty: 4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 2 infamy counters on Criminal Enterprise. If you cannot, remove 2 madness counters from State of Madness.
  > [star] **Boost**: Place 1 infamy counter on Criminal Enterprise. If you cannot, remove 1 madness counter from State of Madness.
- **Image Asset**: `assets/card-art/bundles/cards/02012.png` (300×419 px, 37.1 KB)
### [02013] Mad Genius
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Risky Business (23–24/24, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Risky Business Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Green Goblin)**: Green Goblin attacks the hero with the fewest hit points remaining. If no attack was made this way, this card gains surge.
  > **When Revealed (Norman Osborn)**: Discard the top card of your deck for each infamy counter on Criminal Enterprise.
- **Image Asset**: `assets/card-art/bundles/cards/02013.png` (300×419 px, 41.4 KB)

### Set: Mutagen Formula

### [02014] Green Goblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (1/31)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin.*
- **Rules Text**:
  > [star] **Forced Response**: After Green Goblin attacks and damages you, place 1 threat on the main scheme.
- **Flavor**: *"Did you expect the Green Goblin to let you live?!"*
- **Image Asset**: `assets/card-art/bundles/cards/02014.png` (300×419 px, 38.3 KB)
### [02015] Green Goblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (2/31)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin.*
- **Rules Text**:
  > **When Revealed**: Deal 2 encounter cards to each player.
  > [star] **Forced Response**: After Green Goblin attacks and damages you, place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/02015.png` (300×419 px, 40.0 KB)
### [02016] Green Goblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (3/31)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin.*
- **Rules Text**:
  > **When Revealed**: Deal 3 encounter cards to each player.
  > [star] **Forced Response**: After Green Goblin attacks and damages you, place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/02016.png` (300×419 px, 40.1 KB)
### [02017] Unleashing the Mutagen
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (4/31)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Completed**: In player order, each player not engaged with a [[Goblin]] minion must discard 3 cards from the encounter deck and put the first [[Goblin]] minion they discarded this way into play engaged with them.
- **Flavor**: *Green Goblin has released a toxic mutagen gas on New York City.*
- **Image Asset**: `assets/card-art/bundles/cards/02017.jpg` (419×300 px, 32.8 KB)
### [02017a] Unleashing the Mutagen
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (4/31)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Green Goblin (I) and Green Goblin (II). *(Green Goblin (II) and Green Goblin (III) instead for expert mode.)* Mutagen Formula and Standard encounter sets. One modular encounter set *(recommended: Goblin Gimmicks)*.
  > **Setup**: Put a Goblin Thrall minion into play engaged with each player. Shuffle the encounter deck. Advance to stage 1B.
- **Image Asset**: `assets/card-art/bundles/cards/02017a.jpg` (419×300 px, 32.8 KB)
### [02017b] Unleashing the Mutagen
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (4/31)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Completed**: In player order, each player not engaged with a [[Goblin]] minion must discard 3 cards from the encounter deck and put the first [[Goblin]] minion they discarded this way into play engaged with them.
- **Flavor**: *Green Goblin has released a toxic mutagen gas on New York City.*
- **Image Asset**: `assets/card-art/bundles/cards/02017b.png` (419×300 px, 42.1 KB)
### [02018] Mutagen Cloud
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (5/31)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 4 per hero, **Target Threat**: 11 per hero, **Escalation Threat**: +-1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > X is equal to the number of [[Goblin]] enemies (including Green Goblin) in play.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *The goblin creatures serve Green Goblin's every command. Stop Green Goblin before his monstrous militia overruns the city!*
- **Image Asset**: `assets/card-art/bundles/cards/02018.jpg` (419×300 px, 30.7 KB)
### [02018a] Mutagen Cloud
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (5/31)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Advance to stage 2B.
- **Flavor**: *As the cloud engulfs the city, those unfortunate enough to be caught in the vapors begin to shiver and shift, mutating into hideous goblin creatures.*
- **Image Asset**: `assets/card-art/bundles/cards/02018a.png` (419×300 px, 30.7 KB)
### [02018b] Mutagen Cloud
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (5/31)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 4 per hero, **Target Threat**: 11 per hero, **Escalation Threat**: +-1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > X is equal to the number of [[Goblin]] enemies (including Green Goblin) in play.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *The goblin creatures serve Green Goblin's every command. Stop Green Goblin before his monstrous militia overruns the city!*
- **Image Asset**: `assets/card-art/bundles/cards/02018b.png` (419×300 px, 39.2 KB)
### [02019] Goblin Glider
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (6/31)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Vehicle.*
- **Rules Text**:
  > Attach to the enemy with the highest printed hit points and without another Goblin Glider attached. If you cannot, this card gains surge.
  > **Hero Action**: Spend [energy] [energy] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/02019.png` (300×419 px, 39.2 KB)
### [02020] Hysteria
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (7/31)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Green Goblin.
  > [star] **Forced Interrupt**: When Green Goblin schemes or attacks, give him 1 additional boost card for that activation.
  > **Hero Action**: Spend [mental] [mental] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/02020.png` (300×419 px, 39.9 KB)
### [02021] Pumpkin Bombs
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (8/31)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > [star] **Forced Response**: After the villain attacks you, discard Pumpkin Bombs and take 2 indirect damage.
  > **Hero Action**: Spend [physical] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/02021.png` (300×419 px, 42.5 KB)
### [02022] Goblin Knight
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (9/31)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Goblin.*
- **Rules Text**:
  > [star] **Forced Response**: After Goblin Knight attacks you, discard 1 card from the encounter deck. If that card is a [[Goblin]] minion, put it into play engaged with you.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, shuffle this card into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/02022.png` (300×419 px, 46.0 KB)
### [02023] Goblin Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (10–13/31, Qty: 4)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin.*
- **Rules Text**:
  > **When Defeated**: Deal 1 damage to the engaged player.
  >
  > ---
  >
  > [star] **Boost**: Put Goblin Soldier into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/02023.png` (300×419 px, 41.0 KB)
### [02024] Goblin Thrall
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (14–19/31, Qty: 6)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
  >
  > ---
  >
  > [star] **Boost**: Put Goblin Thrall into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/02024.png` (300×419 px, 41.8 KB)
### [02025] Monster
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (20/31)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Goblin.*
- **Rules Text**:
  > **When Revealed**: You are stunned. If you are already stunned, take 2 damage.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, shuffle this card into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/02025.png` (300×419 px, 41.8 KB)
### [02026] Goblin Reinforcements
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (21–22/31, Qty: 2)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place 1 additional threat here for each [[Goblin]] minion in play.
- **Flavor**: *Using the mutagen formula and advanced combat training, Green Goblin has created an elite force of goblin commandos.*
- **Image Asset**: `assets/card-art/bundles/cards/02026.png` (419×300 px, 36.3 KB)
### [02027] Goblin Nation
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (23/31)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[Goblin]] enemy *(including Green Goblin)* gets +1 ATK.
  >
  > ---
  >
  > [star] **Boost**: Put Goblin Nation into play.
- **Flavor**: *"We are not a gang. We are so much more. We're family. An empire! A pantheon! And I? I am the Goblin King!" —Green Goblin*
- **Image Asset**: `assets/card-art/bundles/cards/02027.png` (419×300 px, 40.0 KB)
### [02028] Overrun
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (24–25/31, Qty: 2)
- **Stats**: **Base Threat**: 1 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: In player order, each player must discard 2 cards from the encounter deck and put each [[Goblin]] minion they discarded this way into play engaged with them.
- **Image Asset**: `assets/card-art/bundles/cards/02028.png` (419×300 px, 37.2 KB)
### [02029] Death from Above
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (26–27/31, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Green Goblin schemes with +X SCH, where X is equal to the villain's stage number.
  > **When Revealed (Hero)**: Green Goblin attacks with +X ATK, where X is equal to the villain's stage number.
- **Image Asset**: `assets/card-art/bundles/cards/02029.png` (300×419 px, 43.7 KB)
### [02030] I See You
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (28/31)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Green Goblin attack you. If you are in alter-ego form, do not give the villain a boost card for this activation.
  >
  > ---
  >
  > [star] **Boost**: This card gets +1 boost icon ([boost]) if at least one [[Goblin]] minion is engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/02030.png` (300×419 px, 40.5 KB)
### [02031] Overconfidence
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (29/31)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Green Goblin schemes. If at least 3 threat was placed by this activation, this card gains surge.
  > **When Revealed (Hero)**: Green Goblin attacks you. If at least 3 damage was placed by this activation, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/02031.png` (300×419 px, 42.6 KB)
### [02032] Wicked Ambitions
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Mutagen Formula (30–31/31, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutagen Formula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard X cards from the encounter deck, where X is equal to double the villain's stage number. Each time a [[Goblin]] minion is discarded this way, choose to either take 3 damage or put that minion into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/02032.png` (300×419 px, 35.3 KB)

### Set: Goblin Gimmicks

### [02033] Goblin Glider
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Goblin Gimmicks (1–2/8, Qty: 2)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Goblin Gimmicks Set Icon (printed bottom-right next to deck number)
- **Traits**: *Vehicle.*
- **Rules Text**:
  > Attach to the enemy with the highest printed hit points and without another Goblin Glider attached. If you cannot, this card gains surge.
  > **Hero Action**: Spend [energy] [energy] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/02033.png` (300×419 px, 39.1 KB)
### [02034] Pumpkin Bombs
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Goblin Gimmicks (3–4/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Goblin Gimmicks Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > [star] **Forced Response**: After the villain attacks you, discard Pumpkin Bombs and take 2 indirect damage.
  > **Hero Action**: Spend [physical] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/02034.png` (300×419 px, 42.4 KB)
### [02035] Intimidation
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Goblin Gimmicks (5–6/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Goblin Gimmicks Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose to either spend 2 resources of any type or give the villain 1 facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/02035.png` (300×419 px, 39.5 KB)
### [02036] Regenerative Healing
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Goblin Gimmicks (7–8/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Goblin Gimmicks Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The villain heals X damage, where X is equal to double the villain's stage number. If no damage was healed this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: The villain heals 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/02036.png` (300×419 px, 41.3 KB)

### Set: A Mess of Things

### [02037] A Mess of Things
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: A Mess of Things (1/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: A Mess of Things Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place 2 additional threat here for each stunned friendly character.
- **Flavor**: *Scorpion tears through the business district, causing as much mayhem as possible.*
- **Image Asset**: `assets/card-art/bundles/cards/02037.png` (419×300 px, 41.1 KB)
### [02038] Scorpion
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: A Mess of Things (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 3 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: A Mess of Things Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Quickstrike. *(After this minion engages your hero, it attacks you.)*
  > [star] **Forced Response**: After Scorpion attacks and damages a character, stun that character.
- **Flavor**: *"I'll crush you, Spider-Man!"*
- **Image Asset**: `assets/card-art/bundles/cards/02038.png` (300×419 px, 38.4 KB)
### [02039] Gang-Up
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: A Mess of Things (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: A Mess of Things Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: The villain and each minion engaged with you attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/02039.png` (300×419 px, 37.6 KB)
### [02040] Tail Sweep
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: A Mess of Things (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: A Mess of Things Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Scorpion attacks your hero. If no attack was made this way, you are stunned.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/02040.png` (300×419 px, 36.3 KB)

### Set: Power Drain

### [02041] Power Drain
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Power Drain (1/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Power Drain Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Discard 2 cards from the encounter deck. Each player must choose and discard 1 resource of any type from their hand for each boost icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/02041.png` (419×300 px, 38.5 KB)
### [02042] Electro
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Power Drain (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Power Drain Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] **Forced Response**: After Electro attacks you, discard 1 card from the encounter deck. Take 1 indirect damage for each boost icon discarded this way.
  >
  > ---
  >
  > [star] **Boost**: Discard 3 cards from the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/02042.png` (300×419 px, 42.2 KB)
### [02043] Electromagnetic Pulse
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Power Drain (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Power Drain Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 7 cards from the encounter deck. If Electro was discarded this way, put him into play engaged with you. If Electro was not discarded this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Discard 3 cards from the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/02043.png` (300×419 px, 43.0 KB)
### [02044] Lightning Bolt
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Power Drain (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Power Drain Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 2 cards from the encounter deck. Take 1 indirect damage for each boost icon discarded this way.
  >
  > ---
  >
  > [star] **Boost**: Discard 3 cards from the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/02044.png` (300×419 px, 37.4 KB)
### [02045] Shock Therapy
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Power Drain (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Power Drain Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1[per_hero] cards from the encounter deck. The villain heals 1 damage for each boost icon discarded this way.
  >
  > ---
  >
  > [star] **Boost**: Discard 3 cards from the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/02045.png` (300×419 px, 41.1 KB)

### Set: Running Interference

### [02046] Running Interference
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Running Interference (1/5)
- **Stats**: **Base Threat**: 1 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Running Interference Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Each player must choose to either spend [mental] [physical] resources or place 2 threat here.
- **Image Asset**: `assets/card-art/bundles/cards/02046.png` (419×300 px, 33.1 KB)
### [02047] Tombstone
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Running Interference (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 9
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Running Interference Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] **Forced Response**: After Tombstone attacks and damages you, discard a [mental] or a [physical] resource from your hand, if able.
- **Image Asset**: `assets/card-art/bundles/cards/02047.png` (300×419 px, 34.7 KB)
### [02048] All Tied Up
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Running Interference (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Running Interference Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity card.
  > Attached character cannot ready or change form.
  > **Action**: Spend [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/02048.png` (300×419 px, 37.4 KB)
### [02049] Media Coverage
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Green Goblin (`gob`)
- **Deck / Set**: Running Interference (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Running Interference Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity card.
  > Resolve each "**When Revealed**" ability that you reveal 1 additional time.
  > **Alter-Ego Action**: Spend a [mental] resource → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/02049.png` (300×419 px, 32.8 KB)

