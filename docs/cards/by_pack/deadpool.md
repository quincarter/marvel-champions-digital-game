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
| `44001a` | Deadpool | Hero | Deadpool | THW:2 ATK:2 DEF:1 HP:9 | - | `deadpool` |
| `44001b` | Wade Wilson | Alter-Ego | Deadpool | HP:9 | - | `deadpool` |
| `44002` | Cable | Ally | Deadpool | THW:1 ATK:2 HP:3 | - | `deadpool` |
| `44003` | Exhausting Personality | Event | Deadpool | - | - | `deadpool` |
| `44004` | Maximum Effort | Event | Deadpool | - | - | `deadpool` |
| `44005` | Metaknowledge | Event | Deadpool | - | - | `deadpool` |
| `44006` | "Yoo-Hoo!" | Event | Deadpool | - | - | `deadpool` |
| `44007` | Montage | Resource | Deadpool | - | - | `deadpool` |
| `44008` | Chimichanga Truck | Support | Deadpool | - | - | `deadpool` |
| `44009` | Armed to the Teeth | Upgrade | Deadpool | - | - | `deadpool` |
| `44010` | Deadpool's Katana | Upgrade | Deadpool | - | - | `deadpool` |
| `44011` | It Ain't Over... | Upgrade | Deadpool | - | - | `deadpool` |
| `44012` | This Card is Fire | Event | Deadpool | - | - | `deadpool` |
| `44013` | Dogpool | Ally | Pack Position: 13 | THW:0 ATK:1 HP:4 | - | `deadpool` |
| `44014` | Headpool | Ally | Pack Position: 14 | THW:2 ATK:1 HP:1 | - | `deadpool` |
| `44015` | Kidpool | Ally | Pack Position: 15 | THW:1 ATK:2 HP:2 | - | `deadpool` |
| `44016` | Lady Deadpool | Ally | Pack Position: 16 | THW:2 ATK:2 HP:3 | - | `deadpool` |
| `44017` | Barely a Scratch | Event | Pack Position: 17 | - | - | `deadpool` |
| `44018` | Cutupper | Event | Pack Position: 18 | - | - | `deadpool` |
| `44019` | Da Bomb | Event | Pack Position: 19 | - | - | `deadpool` |
| `44020` | Get Rage-y | Event | Pack Position: 20 | - | - | `deadpool` |
| `44021` | "I Got This" | Event | Pack Position: 21 | - | - | `deadpool` |
| `44022` | Not my Responsibility | Event | Pack Position: 22 | - | - | `deadpool` |
| `44023` | 'Pool Inspection | Event | Pack Position: 23 | - | - | `deadpool` |
| `44024` | Live Dangerously | Player Side Scheme | Pack Position: 24 | - | - | `deadpool` |
| `44025` | Self Confidence | Resource | Pack Position: 25 | - | - | `deadpool` |
| `44026` | Self Control | Resource | Pack Position: 26 | - | - | `deadpool` |
| `44027` | Self Preservation | Resource | Pack Position: 27 | - | - | `deadpool` |
| `44028` | Git Gud | Upgrade | Pack Position: 28 | - | - | `deadpool` |
| `44029` | Healing Factor | Upgrade | Pack Position: 29 | - | - | `deadpool` |
| `44030` | Stick-To-Itiveness | Upgrade | Pack Position: 30 | - | - | `deadpool` |
| `44031` | Frenemies | Event | Pack Position: 31 | - | - | `deadpool` |
| `44032` | The Merc with the Mouth | Obligation | Deadpool | - | 2 pips | `deadpool` |
| `44033` | Butler | Minion | Deadpool Nemesis | SCH:2 ATK:1 HP:3 | Star | `deadpool` |
| `44034` | Involuntary Procedures | Side Scheme | Deadpool Nemesis | - | 3 pips | `deadpool` |
| `44035` | Tabula Rasa 16 | Attachment | Deadpool Nemesis | - | Star | `deadpool` |
| `44036` | Mutated Soldier | Minion | Deadpool Nemesis | SCH:1 ATK:2 HP:5 | 2 pips | `deadpool` |
| `44037` | Crisis of Infinite Deadpools | Treachery | Dreadpool | - | 2 pips | `deadpool` |
| `44038` | Dreadpool | Minion | Dreadpool | SCH:2 ATK:2 HP:3 | 3 pips | `deadpool` |
| `44039` | Dreadful Deeds | Side Scheme | Dreadpool | - | 3 pips | `deadpool` |
| `44040` | Anti-Regeneration Ray | Attachment | Dreadpool | ATK:1 | 1 pips | `deadpool` |
| `44041` | 'Pool-ized | Attachment | Dreadpool | - | 2 pips | `deadpool` |
| `44042` | Metacidal Tendencies | Treachery | Dreadpool | - | 2 pips | `deadpool` |
| `44043` | Bob, Agent of Hydra | Ally | Pack Position: 43 | THW:1 ATK:1 HP:2 | - | `deadpool` |
| `44044` | Negasonic Teenage Warhead | Ally | Pack Position: 44 | THW:2 ATK:2 HP:4 | - | `deadpool` |
| `44045` | Pandapool | Ally | Pack Position: 45 | THW:0 ATK:3 HP:4 | - | `deadpool` |
| `44046` | Break Time | Event | Pack Position: 46 | - | - | `deadpool` |
| `44047` | Get in Front of Me! | Event | Pack Position: 47 | - | - | `deadpool` |
| `44048` | Mulligan | Event | Pack Position: 48 | - | - | `deadpool` |
| `44049` | Deadpool Corps Ship | Support | Pack Position: 49 | - | - | `deadpool` |
| `44050` | Plot Convenience | Support | Pack Position: 50 | - | - | `deadpool` |
| `44051` | Ambush | Upgrade | Pack Position: 51 | - | - | `deadpool` |
| `44052` | Bazooka | Upgrade | Pack Position: 52 | - | - | `deadpool` |
| `44053` | Blackout | Upgrade | Pack Position: 53 | - | - | `deadpool` |
| `44054` | Distraction | Upgrade | Pack Position: 54 | - | - | `deadpool` |
| `44055` | Laser Swords | Upgrade | Pack Position: 55 | - | - | `deadpool` |
| `44056` | Rock, Paper, Scissors | Upgrade | Pack Position: 56 | - | - | `deadpool` |
| `44057` | Tic-Tac-Toe | Upgrade | Pack Position: 57 | - | - | `deadpool` |
| `44058` | War | Upgrade | Pack Position: 58 | - | - | `deadpool` |

---

## Pack: Deadpool (`deadpool`)

### Set: Deadpool

### [44001a] Deadpool
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 1, **HP**: 9, **Hand Size**: 5
- **Traits**: *Deadpool Corps. X-Force.*
- **Rules Text**:
  > *The Regeneratin' Degenerate* — **Forced Interrupt**: When you would be defeated, instead set your hit point dial to 1, change to alter-ego form, and add 1 acceleration token to the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/44001a.png` (300×426 px, 196.7 KB)
### [44001b] Wade Wilson
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 8, **HP**: 9, **Hand Size**: 6
- **Traits**: *Mercenary. Mutant.*
- **Rules Text**:
  > *Break the Fourth Wall* — **Action**: Discard a card from your hand → search your deck for a Deadpool event and add it to your hand. (Limit once per round.)
- **Flavor**: *"Sometimes I'm a mutant, sometimes I'm not. Depends on who you ask."*
- **Image Asset**: `assets/card-art/bundles/cards/44001b.png` (300×426 px, 179.5 KB)
### [44002] Cable — *Nathan Summers*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Psionic. X-Force.*
- **Rules Text**:
  > [star] Cable gets +1 THW and +1 ATK for each acceleration token on the main scheme (to a maximum of +3 THW and +3 ATK.)
- **Flavor**: *"Wade, you are my best bud!"*
- **Image Asset**: `assets/card-art/bundles/cards/44002.png` (710×1030 px, 284.5 KB)
### [44003] Exhausting Personality
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (2/15)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Hero Action**: Choose:
  > • Place 1 acceleration token on the main scheme → stun and confuse the villain.
  > • Exhaust a player's identity → that player draws 1 card for each acceleration token on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/44003.png` (710×1030 px, 310.3 KB)
### [44004] Maximum Effort
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (3–4/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Take any amount of damage up to your remaining hit points → deal an equal amount of damage to an enemy.
- **Flavor**: *"This is gonna hurt me as much as it hurts you." —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44004.png` (710×1030 px, 321.5 KB)
### [44005] Metaknowledge
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (5/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Hero Interrupt**: When an encounter card is revealed, cancel all of its effects and discard it. Take 1 damage for each icon ([star] and [boost]) in that card's boost area.
- **Flavor**: *"It says here I defeat you with a wedgie." —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44005.png` (710×1030 px, 313.7 KB)
### [44006] "Yoo-Hoo!"
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (6–7/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Take any amount of damage up to your remaining hit points → remove an equal amount of threat from a scheme.
- **Flavor**: *"You boys mind me dropping in?" —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44006.png` (710×1030 px, 365.8 KB)
### [44007] Montage
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (8/15)
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > This card generates 1 additional [wild] resource for each acceleration token on the main scheme (to a maximum of 3 additional resources).
- **Image Asset**: `assets/card-art/bundles/cards/44007.png` (710×1030 px, 334.3 KB)
### [44008] Chimichanga Truck
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (9/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Response**: After an identity makes a basic recovery, exhaust Chimichanga Truck → ready that identity.
- **Flavor**: *"Did someone say, 'Chimichanga'? Nevermind. That was just the sound of my skull and brains healing." —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44008.png` (710×1030 px, 385.2 KB)
### [44009] Armed to the Teeth
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (10/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Rules Text**:
  > **Response**: After you play Armed to the Teeth, search your collection for 1 [[WEAPON]] upgrade from any aspect and attach it facedown here.
  > **Action**: Exhaust Armed to the Teeth → swap the card attached here with a [[WEAPON]] upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/44009.png` (710×1030 px, 307.1 KB)
### [44010] Deadpool's Katana
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (11–12/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Action** *(attack)*: Exhaust Deadpool's Katana and take 1 damage → deal 2 damage to an enemy. This attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/44010.png` (710×1030 px, 312.8 KB)
### [44011] It Ain't Over...
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (13/15)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the main scheme.
  > Increase the target threat value of attached scheme by 2 for each acceleration token on it.
- **Flavor**: *"I've got you right where I want you." —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44011.png` (710×1030 px, 309.5 KB)
### [44012] This Card is Fire
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (14–15/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Forced Response**: After your turn ends, if this card is in your hand, take 1 damage.
  > **Hero Action** *(attack)*: Deal X damage to an enemy. X is the amount of damage you have sustained.
- **Image Asset**: `assets/card-art/bundles/cards/44012.png` (710×1030 px, 328.6 KB)
### [44032] The Merc with the Mouth
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deadpool Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Wade Wilson player.***
  > Exhaust each ally you control. Allies you control cannot ready. Other players cannot resolve player card abilities during your turn.
  > **Forced Response**: After the player phase ends, if you have not talked this phase, discard this card.
- **Flavor**: *"Was it something I said?" —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44032.png` (710×1030 px, 318.2 KB)

### Set: 'Pool

### [44013] Dogpool — *Wilson*
- **Type**: `Ally`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 0, **ATK**: 1, **HP**: 4, **Resources**: [physical]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Deadpool Corps.*
- **Rules Text**:
  > Retaliate 1. Toughness.
  > **When Defeated**: Deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/44013.png` (710×1030 px, 357.5 KB)
### [44014] Headpool — *Wade "Shorty" Wilson*
- **Type**: `Ally`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2, **ATK**: 1 [star], **HP**: 1, **Resources**: [physical]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Deadpool Corps. Zombie.*
- **Rules Text**:
  > [star] **Response**: After Headpool attacks and damages a minion, that minion attacks another enemy of your choice.
- **Image Asset**: `assets/card-art/bundles/cards/44014.png` (710×1030 px, 366.2 KB)
### [44015] Kidpool — *Wade "Tito" Wilson*
- **Type**: `Ally`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1, **ATK**: 2 [star], **HP**: 2, **Resources**: [physical]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Deadpool Corps.*
- **Rules Text**:
  > [star] Kidpool's attacks gain piercing.
- **Flavor**: *"Congratulations on having me in your deck."*
- **Image Asset**: `assets/card-art/bundles/cards/44015.png` (710×1030 px, 356.4 KB)
### [44016] Lady Deadpool — *Wanda Wilson*
- **Type**: `Ally`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2, **ATK**: 2, **HP**: 3, **Resources**: [physical]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Deadpool Corps.*
- **Rules Text**:
  > **When Defeated**: Defeat a non-[[ELITE]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/44016.png` (710×1030 px, 294.5 KB)
### [44017] Barely a Scratch
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you would take any amount of damage from an attack, prevent 1 of that damage for each [crisis], [acceleration], [amplify], and [hazard] in play.
- **Image Asset**: `assets/card-art/bundles/cards/44017.png` (710×1030 px, 313.4 KB)
### [44018] Cutupper
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy. Stun that enemy.
- **Flavor**: *SQUEAK!*
- **Image Asset**: `assets/card-art/bundles/cards/44018.png` (710×1030 px, 392.6 KB)
### [44019] Da Bomb
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 6, **Resources**: [physical]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Action**: Deal 10 damage to the villain. Deal 1 damage to each enemy and hero for each [crisis], [acceleration], [amplify], and [hazard] in play.
- **Image Asset**: `assets/card-art/bundles/cards/44019.png` (710×1030 px, 349.9 KB)
### [44020] Get Rage-y
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > Max 1 per deck.
  > **Action**: Ready an ally. That ally gets +1 ATK until the end of the phase.
- **Flavor**: *"You call that a pull-up?" —Sergeant Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44020.png` (710×1030 px, 331.3 KB)
### [44021] "I Got This"
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > **Hero Action**: If the following icons are on 1 or more cards in play:
  > [crisis] — Deal 3 damage to an enemy.
  > [acceleration] — Remove 2 threat from a scheme.
  > [amplify] — Ready an ally you control.
  > [hazard] — Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/44021.png` (710×1030 px, 301.6 KB)
### [44022] Not my Responsibility
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > Max 1 per deck.
  > **Interrupt**: When any amount of threat would be placed on a scheme, you or your ally takes it as damage instead.
- **Image Asset**: `assets/card-art/bundles/cards/44022.png` (710×1030 px, 351.4 KB)
### [44023] 'Pool Inspection
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 6, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Action** *(thwart)*: Remove 5 threat from the main scheme, ignoring the crisis icon ([crisis]). Remove 1 threat from each scheme for each [crisis], [acceleration], [amplify], and [hazard] in play.
- **Flavor**: *"This pool is a disaster!" —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44023.png` (710×1030 px, 317.3 KB)
### [44024] Live Dangerously
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 24
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 3 per hero, **Resources**: [energy]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme), Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase), Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round), Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Victory 0.
  > Each identity gets +2 hand size.
- **Flavor**: *"♫ Nothing can cause me pain! Not even an oncoming tr...♪" —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44024.png` (1030×710 px, 274.5 KB)
### [44025] Self Confidence
- **Type**: `Resource`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [physical]
- **Rules Text**:
  > Max 1 per deck.
  > Double the number of resources this card generates if your identity has sustained less than 5 damage (triple the resources instead if you have sustained no damage).
- **Image Asset**: `assets/card-art/bundles/cards/44025.png` (710×1030 px, 304.7 KB)
### [44026] Self Control
- **Type**: `Resource`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [mental]
- **Rules Text**:
  > Max 1 per deck.
  > Double the number of resources this card generates if your identity has sustained less than 5 damage (triple the resources instead if you have sustained no damage).
- **Image Asset**: `assets/card-art/bundles/cards/44026.png` (710×1030 px, 333.3 KB)
### [44027] Self Preservation
- **Type**: `Resource`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [energy]
- **Rules Text**:
  > Max 1 per deck.
  > Double the number of resources this card generates if your identity has sustained less than 5 damage (triple the resources instead if you have sustained no damage).
- **Image Asset**: `assets/card-art/bundles/cards/44027.png` (710×1030 px, 420.9 KB)
### [44028] Git Gud
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 28
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Rules Text**:
  > Reduce the cost to play Git Gud by 2 if you did not win your previous game of *Marvel Champions*.
  > **Forced Interrupt**: When a player would be defeated, they set their hit point dial to 1 and change to alter-ego form instead. Remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/44028.png` (710×1030 px, 376.5 KB)
### [44029] Healing Factor
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After the player phase begins, exhaust Healing Factor → heal 2 damage from your identity.
- **Flavor**: *"Now I'm the best at whatever it is Wolverine does." —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44029.png` (710×1030 px, 367.3 KB)
### [44030] Stick-To-Itiveness
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Action**: Spend a [physical] resource and exhaust this card → ready your hero.
- **Flavor**: *"Acquiesce? I don't know the meaning of the word." —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44030.png` (710×1030 px, 341.2 KB)
### [44043] Bob, Agent of Hydra — *Bob Dobalina*
- **Type**: `Ally`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 43
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1, **ATK**: 1, **HP**: 2, **Resources**: [physical]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Hydra.*
- **Rules Text**:
  > **Response**: After Bob, Agent of Hydra enters play, deal 2 damage to an enemy or remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/44043.png` (710×1030 px, 351.7 KB)
### [44044] Negasonic Teenage Warhead — *Ellie Phimister*
- **Type**: `Ally`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 44
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2, **ATK**: 2, **HP**: 4, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Psionic. X-Force.*
- **Rules Text**:
  > **Interrupt**: When a treachery is revealed, deal 2 damage to Negasonic Teenage Warhead → cancel that treachery's "**When Revealed**" effects.
- **Image Asset**: `assets/card-art/bundles/cards/44044.png` (710×1030 px, 303.5 KB)
### [44045] Pandapool
- **Type**: `Ally`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 45
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 0, **ATK**: 3, **HP**: 4, **Resources**: [physical]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Deadpool Corps.*
- **Rules Text**:
  > Toughness.
- **Flavor**: *What's black and white and red all over?*
- **Image Asset**: `assets/card-art/bundles/cards/44045.png` (710×1030 px, 271.6 KB)
### [44046] Break Time
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 46
- **Stats**: **Cost**: 3 per hero, **Resources**: [energy]
- **Rules Text**:
  > Alliance. Max 1 per deck.
  > **Alter-Ego Action**: Take a group break. Leave the table. Read a comic book. When you come back to the game, heal 1 damage from each identity for every minute you were away from the game.
- **Image Asset**: `assets/card-art/bundles/cards/44046.png` (710×1030 px, 382.0 KB)
### [44047] Get in Front of Me!
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 47
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Interrupt**: When a treachery card is revealed from the encounter deck, cancel its **"When Revealed"** effects. The villain attacks you instead. If an ally or another hero defends this attack, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/44047.png` (710×1030 px, 400.3 KB)
### [44048] Mulligan
- **Type**: `Event`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 48
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Rules Text**:
  > You cannot play this card if you have played another card this phase.
  > **Action**: Discard your hand. Draw a new hand. *(Draw up to your hand size.)*
- **Flavor**: *"This hand could be so much better!" —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/44048.png` (710×1030 px, 349.2 KB)
### [44049] Deadpool Corps Ship
- **Type**: `Support`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 49
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Vehicle.*
- **Rules Text**:
  > **Action**: Exhaust Deadpool Corps Ship and deal yourself 1 facedown encounter card → put a 'Pool ally into play from your hand.
- **Flavor**: *This spaceship serves as the Deadpool Corps' mobile base of operations.*
- **Image Asset**: `assets/card-art/bundles/cards/44049.png` (710×1030 px, 310.2 KB)
### [44050] Plot Convenience
- **Type**: `Support`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 50
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Exhaust Plot Convenience → choose:
  > • Attach 1 aspect card from your hand facedown here (to a maximum of 3).
  > • Add 1 card attached facedown here to your hand.
  > Any player may trigger this ability.
- **Image Asset**: `assets/card-art/bundles/cards/44050.png` (710×1030 px, 331.9 KB)
### [44051] Ambush
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a side scheme. Max 1 per side scheme.
  > **Interrupt**: When attached side scheme is defeated, discard a non-[[ELITE]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/44051.png` (710×1030 px, 308.6 KB)
### [44052] Bazooka
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted. Max 2 per deck.
  > **Hero Action** *(attack)*: Discard Bazooka → deal 1 damage to an enemy for each [crisis], [acceleration], [amplify], and [hazard] in play. This attack gains ranged.
- **Image Asset**: `assets/card-art/bundles/cards/44052.png` (710×1030 px, 325.5 KB)
### [44053] Blackout
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 53
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Metagame.*
- **Rules Text**:
  > **Hero Action**: Spend 1 resource of any type → move 1 threat from a scheme to an empty space above that matches the spent resource. If all spaces above are filled, discard this card and confuse the villain.
- **Image Asset**: `assets/card-art/bundles/cards/44053.png` (710×1030 px, 388.2 KB)
### [44054] Distraction
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 54
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Attach to a non-[[ELITE]] minion. Max 1 per minion.
  > Attached minion cannot activate.
- **Image Asset**: `assets/card-art/bundles/cards/44054.png` (710×1030 px, 317.4 KB)
### [44055] Laser Swords
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 55
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Counts as 2 restricted cards. Max 1 per deck.
  > Your hero gets +1 ATK for each [crisis], [acceleration], [amplify], and [hazard] in play (to a maximum of +4 ATK).
- **Flavor**: *"Fwoom, Ksh! Fwoom, Kssssh!" —Kidpool*
- **Image Asset**: `assets/card-art/bundles/cards/44055.png` (710×1030 px, 328.8 KB)
### [44056] Rock, Paper, Scissors
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 56
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Metagame.*
- **Rules Text**:
  > **Hero Action**: Exhaust this card, choose 1 card in your hand, and discard the top card of your deck → using the diagram above, if a printed resource on the chosen card beats *(points to)* a printed resource on the discarded card, add the discarded card to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/44056.png` (710×1030 px, 408.8 KB)
### [44057] Tic-Tac-Toe
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 57
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Metagame.*
- **Rules Text**:
  > **Hero Action**: Spend 1 resource of any type → move 1 damage from a character to an empty space above matching the spent resource. If there are 3 damage tokens in a line, deal all damage on this card to an enemy and discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/44057.png` (710×1030 px, 393.6 KB)
### [44058] War
- **Type**: `Upgrade`
- **Faction / Aspect**: 'Pool
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 58
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Metagame.*
- **Rules Text**:
  > **Hero Action**: Exhaust War → discard the top card of the encounter deck. Take 1 damage for each icon ([star] and [boost]) in the boost area of that card. Discard the top card of your deck. Deal damage to an enemy equal to that card's cost.
- **Image Asset**: `assets/card-art/bundles/cards/44058.png` (710×1030 px, 318.0 KB)

### Set: Basic

### [44031] Frenemies
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Team-Up (Cable and Deadpool). Max 1 per deck.
  > **Hero Action** *(thwart)*: Deal 1 damage each to Cable and Deadpool. Remove 3 threat from a scheme and 3 threat from a different scheme.
- **Image Asset**: `assets/card-art/bundles/cards/44031.png` (710×1030 px, 308.7 KB)

### Set: Deadpool Nemesis

### [44033] Butler
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Deadpool Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Scientist.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Butler schemes, place that threat on Involuntary Procedures, if able.
  > *(Deadpool's nemesis minion.)*
  >
  > ---
  >
  > [star] **Boost**: You are confused.
- **Image Asset**: `assets/card-art/bundles/cards/44033.png` (710×1030 px, 276.4 KB)
### [44034] Involuntary Procedures
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool Nemesis (2/5)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deadpool Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **Forced Response**: After Deadpool takes any amount of damage, place 1 threat here. Then, if there is 10 or more threat here, remove this card from the game.
- **Flavor**: *Butler seeks to cure his sister's cancer using Deadpool's regenerative abilities.*
- **Image Asset**: `assets/card-art/bundles/cards/44034.png` (1030×710 px, 339.3 KB)
### [44035] Tabula Rasa 16
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Deadpool Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity.
  > Treat your identity's printed text box as blank *(except for [[TRAITS]])*.
  > **Alter-Ego Action**: Spend [mental][mental] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach Tabula Rasa 16 to your identity.
- **Flavor**: *Butler used this drug to erase Deadpool's memory of Butler's medical experiments.*
- **Image Asset**: `assets/card-art/bundles/cards/44035.png` (710×1030 px, 313.4 KB)
### [44036] Mutated Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Deadpool Nemesis (4–5/5, Qty: 2)
- **Stats**: **SCH**: 1 [star], **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deadpool Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutate. Soldier.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Response**: After Mutated Soldier activates, heal all damage from it.
- **Flavor**: *Butler funded his research by developing super soldiers for foreign governments.*
- **Image Asset**: `assets/card-art/bundles/cards/44036.png` (710×1030 px, 299.9 KB)

### Set: Dreadpool

### [44037] Crisis of Infinite Deadpools
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Dreadpool (1/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dreadpool Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Reveal the set-aside Dreadpool minion and Dreadful Deeds side scheme. Shuffle the rest of the set-aside Dreadpool encounter set into the encounter deck. Remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/44037.png` (710×1030 px, 345.0 KB)
### [44038] Dreadpool
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Dreadpool (2/7)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dreadpool Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Elite.*
- **Rules Text**:
  > Dreadpool engages the first player.
  > **When Defeated**: Deal Dreadpool to the player who defeated him as a facedown encounter card.
- **Flavor**: *"What I do...I do for the cause. But I still feel bad about it...usually."*
- **Image Asset**: `assets/card-art/bundles/cards/44038.png` (710×1030 px, 372.1 KB)
### [44039] Dreadful Deeds
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Dreadpool (3/7)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dreadpool Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Place 2 threat here for each player who controls 1 or more 'Pool (pink) cards.
- **Flavor**: *Dreadpool believes the only way to end his suffering is to kill every being in all of the multiverse.*
- **Image Asset**: `assets/card-art/bundles/cards/44039.png` (1030×710 px, 314.2 KB)
### [44040] Anti-Regeneration Ray
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Dreadpool (4/7)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dreadpool Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Dreadpool. Otherwise, attach to the villain.
  > **Forced Interrupt**: When attached character attacks a non-villain character, treat the attacked character's text box as if it were blank (except for [[TRAITS]]) until the end of the attack.
  > **Hero Action**: Spend [energy][mental][physical] resources → attach this card to your identity.
- **Image Asset**: `assets/card-art/bundles/cards/44040.png` (710×1030 px, 317.7 KB)
### [44041] 'Pool-ized
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Dreadpool (5–6/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dreadpool Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Treat attached ally as a [['POOL]] minion with a blank text box. Attached minion's SCH is equal to its printed THW and it does not take consequential damage.
  > **When Revealed**: Attach to the ally with the highest cost without 'Pool-ized attached. Attached ally engages its controller. Otherwise, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/44041.png` (710×1030 px, 311.6 KB)
### [44042] Metacidal Tendencies
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Deadpool (`deadpool`)
- **Deck / Set**: Dreadpool (7/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dreadpool Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal 2 damage to each [[DEADPOOL CORPS]] character (3 damage instead if Dreadpool is in play). If no damage was dealt this way, place 1 acceleration token on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/44042.png` (710×1030 px, 323.2 KB)

