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
| `07001` | Breakout | Main Scheme | Wrecking Crew | - | - | `twc` |
| `07001a` | Breakout | Main Scheme | Wrecking Crew | - | - | `twc` |
| `07001b` | Breakout | Main Scheme | Wrecking Crew | - | - | `twc` |
| `07002` | Wrecker | Villain | Wrecker | SCH:2 ATK:2 HP:14 | - | `twc` |
| `07003` | Wrecker | Villain | Wrecker | SCH:3 ATK:3 HP:18 | - | `twc` |
| `07004` | Day of Reckoning | Side Scheme | Wrecker | - | - | `twc` |
| `07005` | Held Hostage | Attachment | Wrecker | - | 1 pips | `twc` |
| `07006` | Magic Crowbar | Attachment | Wrecker | ATK:1 | 3 pips | `twc` |
| `07007` | Wrecker's Command | Attachment | Wrecker | SCH:1 | 1 pips | `twc` |
| `07008` | Corrupt Prison Guard | Minion | Wrecker | SCH:0 ATK:2 HP:3 | - | `twc` |
| `07009` | Escaped Convict | Minion | Wrecker | SCH:1 ATK:1 HP:2 | Star | `twc` |
| `07010` | Buddy System | Treachery | Wrecker | - | Star | `twc` |
| `07011` | Chaos In the Prison | Treachery | Wrecker | - | Star | `twc` |
| `07012` | Crowbar Toss | Treachery | Wrecker | - | 1 pips | `twc` |
| `07013` | Get Wrecked! | Treachery | Wrecker | - | 1 pips | `twc` |
| `07014` | I've Been Waiting For This! | Treachery | Wrecker | - | Star | `twc` |
| `07015` | Mystical Link | Treachery | Wrecker | - | Star | `twc` |
| `07016` | You're Dead Meat! | Treachery | Wrecker | - | 2 pips | `twc` |
| `07017` | Thunderball | Villain | Thunderball | SCH:3 ATK:1 HP:13 | - | `twc` |
| `07018` | Thunderball | Villain | Thunderball | SCH:3 ATK:2 HP:16 | - | `twc` |
| `07019` | Thunderstruck | Side Scheme | Thunderball | - | - | `twc` |
| `07020` | Ball and Chain | Attachment | Thunderball | ATK:1 | 3 pips | `twc` |
| `07021` | Held Hostage | Attachment | Thunderball | - | 1 pips | `twc` |
| `07022` | Radioactive Buildup | Attachment | Thunderball | ATK:3 | 3 pips | `twc` |
| `07023` | Corrupt Prison Guard | Minion | Thunderball | SCH:0 ATK:2 HP:3 | - | `twc` |
| `07024` | Escaped Convict | Minion | Thunderball | SCH:1 ATK:1 HP:2 | Star | `twc` |
| `07025` | Buddy System | Treachery | Thunderball | - | Star | `twc` |
| `07026` | Chaos In the Prison | Treachery | Thunderball | - | Star | `twc` |
| `07027` | Energy Projectiles | Treachery | Thunderball | - | Star | `twc` |
| `07028` | Get Wrecked! | Treachery | Thunderball | - | 1 pips | `twc` |
| `07029` | I've Been Waiting For This! | Treachery | Thunderball | - | Star | `twc` |
| `07030` | Lightning Blast | Treachery | Thunderball | - | 2 pips | `twc` |
| `07031` | Tactical Prowess | Treachery | Thunderball | - | 2 pips | `twc` |
| `07032` | Piledriver | Villain | Piledriver | SCH:2 ATK:2 HP:11 | - | `twc` |
| `07033` | Piledriver | Villain | Piledriver | SCH:2 ATK:3 HP:14 | - | `twc` |
| `07034` | Pile It On! | Side Scheme | Piledriver | - | - | `twc` |
| `07035` | Distracting Taunts | Attachment | Piledriver | - | 2 pips | `twc` |
| `07036` | Held Hostage | Attachment | Piledriver | - | 1 pips | `twc` |
| `07037` | Corrupt Prison Guard | Minion | Piledriver | SCH:0 ATK:2 HP:3 | - | `twc` |
| `07038` | Escaped Convict | Minion | Piledriver | SCH:1 ATK:1 HP:2 | Star | `twc` |
| `07039` | Buddy System | Treachery | Piledriver | - | Star | `twc` |
| `07040` | Get Wrecked! | Treachery | Piledriver | - | 1 pips | `twc` |
| `07041` | I've Been Waiting For This! | Treachery | Piledriver | - | Star | `twc` |
| `07042` | Oversized Hands | Treachery | Piledriver | - | Star | `twc` |
| `07043` | Escape Plan | Treachery | Piledriver | - | Star | `twc` |
| `07044` | Pummel | Treachery | Piledriver | - | 2 pips | `twc` |
| `07045` | Uncanny Resilience | Treachery | Piledriver | - | Star | `twc` |
| `07046` | Bulldozer | Villain | Bulldozer | SCH:1 ATK:3 HP:12 | - | `twc` |
| `07047` | Bulldozer | Villain | Bulldozer | SCH:2 ATK:3 HP:15 | - | `twc` |
| `07048` | Clear the Road | Side Scheme | Bulldozer | - | - | `twc` |
| `07049` | Bulldozer's Helmet | Attachment | Bulldozer | ATK:1 | 3 pips | `twc` |
| `07050` | Held Hostage | Attachment | Bulldozer | - | 1 pips | `twc` |
| `07051` | Ramming Speed | Attachment | Bulldozer | ATK:2 | 2 pips | `twc` |
| `07052` | Corrupt Prison Guard | Minion | Bulldozer | SCH:0 ATK:2 HP:3 | - | `twc` |
| `07053` | Escaped Convict | Minion | Bulldozer | SCH:1 ATK:1 HP:2 | Star | `twc` |
| `07054` | Buddy System | Treachery | Bulldozer | - | Star | `twc` |
| `07055` | Bull Rush | Treachery | Bulldozer | - | 1 pips | `twc` |
| `07056` | Chaos In the Prison | Treachery | Bulldozer | - | Star | `twc` |
| `07057` | Get Wrecked! | Treachery | Bulldozer | - | 1 pips | `twc` |
| `07058` | Headbutt | Treachery | Bulldozer | - | 1 pips | `twc` |
| `07059` | Leading the Charge | Treachery | Bulldozer | - | 2 pips | `twc` |

---

## Pack: The Wrecking Crew (`twc`)

### Set: Wrecking Crew

### [07001] Breakout
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecking Crew (1/1)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 6 per hero, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After step one of the villain phase, place 1 threat on each side scheme. Move the active counter to the villain whose scheme has the most threat. *(If there is a tie, the first player chooses.)*
  > **If this stage is completed, the players lose the game**
- **Image Asset**: `assets/card-art/bundles/cards/07001.png` (419×300 px, 44.7 KB)
### [07001a] Breakout
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecking Crew (1/1)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Scenario Contents**: Wrecker A, Thunderball A, Piledriver A, and Bulldozer A as villains. *(Version B for increased difficulty.)* Wrecker, Thunderball, Piledriver, and Bulldozer encounter decks.
  > **Setup**: Put the Day of Reckoning, Thunderstruck, Pile It On!, and Clear the Road side schemes into play. Place the active counter on Wrecker. Advance to stage 1B.
### [07001b] Breakout
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecking Crew (1/1)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 6 per hero, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After step one of the villain phase, place 1 threat on each side scheme. Move the active counter to the villain whose scheme has the most threat. *(If there is a tie, the first player chooses.)*
  > **If this stage is completed, the players lose the game**

### Set: Wrecker

### [07002] Wrecker
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (1/18)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wrecking Crew.*
- **Rules Text**:
  > [star] When Wrecker schemes, place the threat on his side scheme instead of the main scheme.
  > [star] While Wrecker is attacking, he gets +2 ATK if the attack is undefended.
- **Image Asset**: `assets/card-art/bundles/cards/07002.png` (300×419 px, 38.3 KB)
### [07003] Wrecker
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (2/18)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 3 [star], **ATK**: 3 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wrecking Crew.*
- **Rules Text**:
  > [star] When Wrecker schemes, place the threat on his side scheme instead of the main scheme.
  > [star] While Wrecker is attacking, he gets +2 ATK if the attack is undefended.
- **Image Asset**: `assets/card-art/bundles/cards/07003.png` (300×419 px, 38.2 KB)
### [07004] Day of Reckoning
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (3/18)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Wrecker's Side Scheme.**
  > This card cannot leave play while Wrecker is in play.
  > Hard Hitter — **Forced Response**: After threat is placed here, if there is 10 or more threat here, deal 2 damage to each friendly character. Remove all but 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07004.png` (419×300 px, 37.3 KB)
### [07005] Held Hostage
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (4/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the active villain's side scheme.
  > Threat cannot be removed from attacked scheme by thwarting.
  > **Hero Action**: The villain corresponding to the attached side scheme attacks you. Then discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07005.png` (300×419 px, 41.7 KB)
### [07006] Magic Crowbar
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (5/18)
- **Properties**: Unique
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to Wrecker.
  > [star] **Forced Response**: After Wrecker attacks, place 1 threat on the side scheme with the least threat.
  > **Hero Action**: Exhaust your hero and discard 1 card at random from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07006.png` (300×419 px, 38.0 KB)
### [07007] Wrecker's Command
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (6/18)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to Wrecker.
  > [star] **Forced Response**: After Wrecker schemes, place 1 threat on each other villain's side scheme.
  > **Hero Action**: Spend [physical] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07007.png` (300×419 px, 41.3 KB)
### [07008] Corrupt Prison Guard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (7/18)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Traits**: *Traitor.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
- **Image Asset**: `assets/card-art/bundles/cards/07008.png` (300×419 px, 36.5 KB)
### [07009] Escaped Convict
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (8/18)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Surge
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain whose side scheme has the least threat. If you are in hero form, that villain attacks you after this attack. That attack does not get a boost card.
- **Image Asset**: `assets/card-art/bundles/cards/07009.png` (300×419 px, 38.2 KB)
### [07010] Buddy System
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (9/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose the villain whose side scheme has the least threat. Reveal the top card of his deck (top 2 cards instead if he is the only villain in play).
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain whose side scheme has the least threat.
- **Image Asset**: `assets/card-art/bundles/cards/07010.png` (300×419 px, 42.3 KB)
### [07011] Chaos In the Prison
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (10/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose to either discard an upgrade you control or place 1 threat on the active villain's side scheme for each upgrade you control. If you do not control any upgrades, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If this attack is undefended, discard an upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/07011.png` (300×419 px, 44.7 KB)
### [07012] Crowbar Toss
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (11–12/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Wrecker schemes. Then, move the active villain counter to the villain whose side scheme has the least threat.
  > **When Revealed (Hero)**: Wrecker attacks you. Then, move the active villain counter to the villain whose side scheme has the least threat.
- **Image Asset**: `assets/card-art/bundles/cards/07012.png` (300×419 px, 39.3 KB)
### [07013] Get Wrecked!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (13/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The villain whose side scheme has the most threat schemes.
  > **When Revealed (Hero)**: The villain whose side scheme has the least threat attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/07013.png` (300×419 px, 39.5 KB)
### [07014] I've Been Waiting For This!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (14/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The active villain heals 3 hit points. Give that villain a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain with the least threat on his side scheme. That villain schemes.
- **Image Asset**: `assets/card-art/bundles/cards/07014.png` (300×419 px, 37.2 KB)
### [07015] Mystical Link
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (15–16/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 2 threat on each side scheme.
  > [star] **Boost**: Wrecker gets +3 ATK for this activation unless you place 2 threat on his side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07015.png` (300×419 px, 40.5 KB)
### [07016] You're Dead Meat!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Wrecker (17–18/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecker Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to the hero or ally with the fewest remaining hit points. If that character is defeated this way, place 3 threat on Wrecker's side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07016.png` (300×419 px, 35.8 KB)

### Set: Thunderball

### [07017] Thunderball
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (1/18)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 3 [star], **ATK**: 1 [star], **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wrecking Crew.*
- **Rules Text**:
  > [star] When Thunderball schemes, place the threat on his side scheme instead of the main scheme.
  > [star] **Forced Response**: After Thunderball attacks you, deal 1 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/07017.png` (300×419 px, 41.4 KB)
### [07018] Thunderball
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (2/18)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 3 [star], **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wrecking Crew.*
- **Rules Text**:
  > [star] When Thunderball schemes, place the threat on his side scheme instead of the main scheme.
  > [star] **Forced Response**: After Thunderball attacks you, deal 1 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/07018.png` (300×419 px, 41.4 KB)
### [07019] Thunderstruck
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (3/18)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Thunderball's Side Scheme.**
  > This card cannot leave play while Thunderball is in play.
  > Gamma Blast — **Forced Response**: After threat is placed here, if there is 10 or more threat here, stun each friendly character. Remove all but 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07019.png` (419×300 px, 38.6 KB)
### [07020] Ball and Chain
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (4/18)
- **Properties**: Unique
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Thunderball.
  > [star] **Forced Response**: After Thunderball attacks, place 1 threat on the main scheme.
  > **Hero Action**: Exhaust your hero and discard 1 card at random from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07020.png` (300×419 px, 35.4 KB)
### [07021] Held Hostage
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (5/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the active villain's side scheme.
  > Threat cannot be removed from attached scheme by thwarting.
  > **Hero Action**: The villain corresponding to the attached side scheme attacks you. Then, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07021.png` (300×419 px, 40.8 KB)
### [07022] Radioactive Buildup
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (6/18)
- **Stats**: **ATK**: 3 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Thunderball.
  > Excess damage dealt by Thunderball is placed as threat on his corresponding side scheme.
  > [star] **Forced Response**: After Thunderball attacks, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07022.png` (300×419 px, 42.4 KB)
### [07023] Corrupt Prison Guard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (7/18)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Traits**: *Traitor.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
- **Image Asset**: `assets/card-art/bundles/cards/07023.png` (300×419 px, 35.8 KB)
### [07024] Escaped Convict
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (8/18)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Surge
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain whose side scheme has the least threat. If you are in hero form, that villain attacks you after this attack. That attack does not get a boost card.
- **Image Asset**: `assets/card-art/bundles/cards/07024.png` (300×419 px, 37.7 KB)
### [07025] Buddy System
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (9/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose the villain whose side scheme has the least threat. Reveal the top card of his deck (top 2 cards instead if he is the only villain in play).
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain whose side scheme has the least threat.
- **Image Asset**: `assets/card-art/bundles/cards/07025.png` (300×419 px, 41.8 KB)
### [07026] Chaos In the Prison
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (10/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose to either discard an upgrade you control or place 1 threat on the active villain's side scheme for each upgrade you control. If you do not control any upgrades, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If this attack is undefended, discard an upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/07026.png` (300×419 px, 44.1 KB)
### [07027] Energy Projectiles
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (11–12/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to each friendly character you control.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to the defending character.
- **Image Asset**: `assets/card-art/bundles/cards/07027.png` (300×419 px, 36.8 KB)
### [07028] Get Wrecked!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (13/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The villain whose side scheme has the most threat schemes.
  > **When Revealed (Hero)**: The villain whose side scheme has the least threat attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/07028.png` (300×419 px, 38.6 KB)
### [07029] I've Been Waiting For This!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (14/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The active villain heals 3 hit points. Give that villain a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain with the least threat on his side scheme. That villain schemes.
- **Image Asset**: `assets/card-art/bundles/cards/07029.png` (300×419 px, 36.4 KB)
### [07030] Lightning Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (15–16/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Place 3 threat on the side scheme with the most threat.
  > **When Revealed (Hero)**: Thunderball attacks you. If this attack is undefended, place 3 threat on Thunderball's side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07030.png` (300×419 px, 36.6 KB)
### [07031] Tactical Prowess
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Thunderball (17–18/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderball Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Move all threat from the side scheme with the least threat to the side scheme with the most threat. If that scheme's "**Forced Response**" ability is not triggered this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/07031.png` (300×419 px, 39.1 KB)

### Set: Piledriver

### [07032] Piledriver
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (1/18)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2 [star], **ATK**: 2, **HP**: 11 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wrecking Crew.*
- **Rules Text**:
  > Retaliate 1.
  > [star] When Piledriver schemes, place the threat on his side scheme instead of the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07032.png` (300×419 px, 37.0 KB)
### [07033] Piledriver
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (2/18)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2 [star], **ATK**: 3, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wrecking Crew.*
- **Rules Text**:
  > Retaliate 1.
  > [star] When Piledriver schemes, place the threat on his side scheme instead of the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07033.png` (300×419 px, 37.0 KB)
### [07034] Pile It On!
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (3/18)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Piledriver's Side Scheme.**
  > This card cannot leave play while Wrecker is in play.
  > Pile Drive — **Forced Response**: After threat is placed here, if there is 10 or more threat here, each player discards the upgrade or support they control with the highest cost. Remove all but 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07034.png` (419×300 px, 39.8 KB)
### [07035] Distracting Taunts
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (4–5/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to Piledriver.
  > Piledriver gets +3 hit points. Players cannot attack other villains.
  > **Response**: After your hero attacks Piledriver, spend [physical] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07035.png` (300×419 px, 34.0 KB)
### [07036] Held Hostage
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (6/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the active villain side scheme.
  > Threat cannot be removed from attached scheme by thwarting.
  > **Hero Action**: The villain corresponding to the attached side scheme attacks you. Then, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07036.png` (300×419 px, 41.7 KB)
### [07037] Corrupt Prison Guard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (7/18)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Traits**: *Traitor.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
- **Image Asset**: `assets/card-art/bundles/cards/07037.png` (300×419 px, 36.4 KB)
### [07038] Escaped Convict
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (8/18)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Surge.
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain whose side scheme has the least threat. If you are in hero form, that villain attacks you after this attack. That attack does not get a boost card.
- **Image Asset**: `assets/card-art/bundles/cards/07038.png` (300×419 px, 38.2 KB)
### [07039] Buddy System
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (9/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose the villain whose side scheme has the least threat. Reveal the top card of his deck (top 2 cards instead if he is the only villain in play).
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain whose side scheme has the least threat.
- **Image Asset**: `assets/card-art/bundles/cards/07039.png` (300×419 px, 42.8 KB)
### [07040] Get Wrecked!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (10/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The villain whose side scheme has the most threat schemes.
  > **When Revealed (Hero)**: The villain whose side scheme has the least threat attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/07040.png` (300×419 px, 39.7 KB)
### [07041] I've Been Waiting For This!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (11/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The active villain heals 3 hit points. Give that villain a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain with the least threat on his side scheme. That villain schemes.
- **Image Asset**: `assets/card-art/bundles/cards/07041.png` (300×419 px, 37.5 KB)
### [07042] Oversized Hands
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (12–13/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the support you control with the highest cost. If no support was discarded this way, place 2 threat on the active villain's scheme.
  >
  > ---
  >
  > [star] **Boost**: Discard a support you control.
- **Image Asset**: `assets/card-art/bundles/cards/07042.png` (300×419 px, 46.7 KB)
### [07043] Escape Plan
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (14–15/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are confused. If you are already confused, Piledriver schemes.
  >
  > ---
  >
  > [star] **Boost**: Give the active villain a tough status card. If they already have a tough status card, place 2 threat on their scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07043.png` (300×419 px, 42.1 KB)
### [07044] Pummel
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (16–17/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Piledriver schemes. If Piledriver is tough, he gets +2 SCH for this activation.
  > **When Revealed (Hero)**: Piledriver attacks you. If Piledriver is tough, he gets +2 ATK for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/07044.png` (300×419 px, 40.7 KB)
### [07045] Uncanny Resilience
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Piledriver (18/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Piledriver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Remove each stunned and confused status card from each villain. If no status cards were removed, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: You are confused.
- **Image Asset**: `assets/card-art/bundles/cards/07045.png` (300×419 px, 36.7 KB)

### Set: Bulldozer

### [07046] Bulldozer
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (1/18)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1 [star], **ATK**: 3 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wrecking Crew.*
- **Rules Text**:
  > [star] When Bulldozer schemes, place the threat on his side scheme instead of the main scheme.
  > [star] **Forced Interrupt**: When Bulldozer attacks, the attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/07046.png` (300×419 px, 38.1 KB)
### [07047] Bulldozer
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (2/18)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2 [star], **ATK**: 3 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wrecking Crew.*
- **Rules Text**:
  > [star] When Bulldozer schemes, place the threat on his side scheme instead of the main scheme.
  > [star] **Forced Interrupt**: When Bulldozer attacks, the attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/07047.png` (300×419 px, 38.1 KB)
### [07048] Clear the Road
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (3/18)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Bulldozer's Side Scheme.**
  > This card cannot leave play while Bulldozer is in play.
  > Charge! — **Forced Response**: After threat is placed here, if there is 10 or more threat here, each player must discard the top 10 cards of their deck. Remove all but 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/07048.png` (419×300 px, 42.7 KB)
### [07049] Bulldozer's Helmet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (4/18)
- **Properties**: Unique
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Bulldozer.
  > [star] **Forced Response**: After Bulldozer attacks you, discard 1 card from the top of your deck for each point of damage dealt by this attack.
  > **Hero Action**: Exhaust your hero and discard 1 card at random from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07049.png` (300×419 px, 40.8 KB)
### [07050] Held Hostage
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (5/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the active villain side scheme.
  > Threat cannot be removed from attached scheme by thwarting.
  > **Hero Action**: The villain corresponding to the attached side scheme attacks you. Then, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07050.png` (300×419 px, 40.6 KB)
### [07051] Ramming Speed
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (6–7/18, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Bulldozer.
  > [star] **Forced Interrupt**: When Bulldozer attacks you, you must defend against Bulldozer's attacks with an ally you control, if able.
  > [star] **Forced Response**: After Bulldozer attacks you, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/07051.png` (300×419 px, 39.1 KB)
### [07052] Corrupt Prison Guard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (8/18)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Traitor.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
- **Image Asset**: `assets/card-art/bundles/cards/07052.png` (300×419 px, 35.7 KB)
### [07053] Escaped Convict
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (9/18)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Surge.
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain whose side scheme has the least threat. If you are in hero form, that villain attacks you after this attack. That attack does not get a boost card.
- **Image Asset**: `assets/card-art/bundles/cards/07053.png` (300×419 px, 37.7 KB)
### [07054] Buddy System
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (10/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose the villain whose side scheme has the least threat. Reveal the top card of his deck (top 2 cards instead if he is the only villain in play).
  >
  > ---
  >
  > [star] **Boost**: Move the active counter to the villain whose side scheme has the least threat.
- **Image Asset**: `assets/card-art/bundles/cards/07054.png` (300×419 px, 42.1 KB)
### [07055] Bull Rush
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (11–12/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Bulldozer schemes. Discard the top card of your deck for each threat placed by this activation.
  > **When Revealed (Hero)**: Bulldozer attacks you. Discard the top card of your deck for each damage dealt by this attack.
- **Image Asset**: `assets/card-art/bundles/cards/07055.png` (300×419 px, 43.6 KB)
### [07056] Chaos In the Prison
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (13/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose to either discard an upgrade you control or place 1 threat on the active villain's side scheme for each upgrade you control. If you do not control any upgrades, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If this attack is undefended, discard an upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/07056.png` (300×419 px, 44.0 KB)
### [07057] Get Wrecked!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (14/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The villain whose side scheme has the most threat schemes.
  > **When Revealed (Hero)**: The villain whose side scheme has the least threat attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/07057.png` (300×419 px, 38.8 KB)
### [07058] Headbutt
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (15–16/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1 card at random from your hand. If you are in hero form, take damage equal to that card's printed cost. If you are in alter-ego form, place threat on Bulldozer's side scheme equal to that card's printed cost.
- **Image Asset**: `assets/card-art/bundles/cards/07058.png` (300×419 px, 40.9 KB)
### [07059] Leading the Charge
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Wrecking Crew (`twc`)
- **Deck / Set**: Bulldozer (17–18/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bulldozer Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top X cards of your deck, where X is Bulldozer's ATK. Place 1 threat on Bulldozer's side scheme for each different card type discarded this way
- **Image Asset**: `assets/card-art/bundles/cards/07059.png` (300×419 px, 39.2 KB)

