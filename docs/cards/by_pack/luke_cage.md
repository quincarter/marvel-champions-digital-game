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
| `62001a` | Luke Cage | Hero | Luke Cage | THW:2 ATK:2 DEF:1 HP:10 | - | `luke_cage` |
| `62001b` | Luke Cage | Alter-Ego | Luke Cage | HP:10 | - | `luke_cage` |
| `62002` | Jessica Jones | Ally | Luke Cage | THW:1 ATK:2 HP:3 | - | `luke_cage` |
| `62003` | Harlem's Hero | Event | Luke Cage | - | - | `luke_cage` |
| `62004` | Knuckle Sandwich | Event | Luke Cage | - | - | `luke_cage` |
| `62005` | "Stand with Me!" | Event | Luke Cage | - | - | `luke_cage` |
| `62006` | "Sweet Christmas!" | Event | Luke Cage | - | - | `luke_cage` |
| `62007` | Fogwell's Gym | Support | Luke Cage | - | - | `luke_cage` |
| `62008` | Burstein Process | Upgrade | Luke Cage | - | - | `luke_cage` |
| `62009` | Cruisin' for a Bruisin' | Upgrade | Luke Cage | - | - | `luke_cage` |
| `62010` | Metal Bracer | Upgrade | Luke Cage | - | - | `luke_cage` |
| `62011` | Power Man | Upgrade | Luke Cage | - | - | `luke_cage` |
| `62012` | Iron Fist | Ally | Pack Position: 12 | THW:1 ATK:2 HP:3 | - | `luke_cage` |
| `62013` | Misty Knight | Ally | Pack Position: 13 | THW:1 ATK:1 HP:2 | - | `luke_cage` |
| `62014` | Valkyrie | Ally | Pack Position: 14 | THW:1 ATK:2 HP:3 | - | `luke_cage` |
| `62015` | Take a Stand | Event | Pack Position: 15 | - | - | `luke_cage` |
| `62016` | Innovation | Resource | Pack Position: 16 | - | - | `luke_cage` |
| `62017` | The Power of Leadership | Resource | Pack Position: 17 | - | - | `luke_cage` |
| `62018` | Defensive Formation | Support | Pack Position: 18 | - | - | `luke_cage` |
| `62019` | Righteous Purpose | Support | Pack Position: 19 | - | - | `luke_cage` |
| `62020` | Hulk | Ally | Pack Position: 20 | ATK:2 HP:5 | - | `luke_cage` |
| `62021` | She-Hulk | Ally | Pack Position: 21 | THW:2 ATK:2 HP:3 | - | `luke_cage` |
| `62022` | Dynamic Duo | Event | Pack Position: 22 | - | - | `luke_cage` |
| `62023` | Power Man and Iron Fist | Event | Pack Position: 23 | - | - | `luke_cage` |
| `62024` | Unbreakable Bond | Event | Pack Position: 24 | - | - | `luke_cage` |
| `62025` | Energy | Resource | Pack Position: 25 | - | - | `luke_cage` |
| `62026` | Genius | Resource | Pack Position: 26 | - | - | `luke_cage` |
| `62027` | Strength | Resource | Pack Position: 27 | - | - | `luke_cage` |
| `62028` | Internal Injury | Obligation | Luke Cage | - | 2 pips | `luke_cage` |
| `62029` | Cottonmouth | Minion | Luke Cage Nemesis | SCH:2 ATK:1 HP:5 | Star | `luke_cage` |
| `62030` | Venomous Whispers | Side Scheme | Luke Cage Nemesis | - | 2 pips | `luke_cage` |
| `62031` | Augmented Jaws | Attachment | Luke Cage Nemesis | ATK:1 | 2 pips | `luke_cage` |
| `62032` | Asp | Minion | Luke Cage Nemesis | SCH:1 ATK:2 HP:4 | 2 pips | `luke_cage` |
| `62033` | Sidewinder | Minion | Luke Cage Nemesis | SCH:1 ATK:2 HP:3 | 2 pips | `luke_cage` |
| `62034` | Size Advantage | Event | Pack Position: 34 | - | - | `luke_cage` |
| `62035` | Observe | Event | Pack Position: 35 | - | - | `luke_cage` |
| `62036` | Toughen Up | Upgrade | Pack Position: 36 | - | - | `luke_cage` |
| `62037` | Black Belt | Upgrade | Pack Position: 37 | - | - | `luke_cage` |

---

## Pack: Luke Cage (`luke_cage`)

### Set: Luke Cage

### [62001a] Luke Cage
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 1, **HP**: 10, **Hand Size**: 5
- **Traits**: *Defender.*
- **Rules Text**:
  > *Unbreakable Skin* — Luke Cage can have any number of tough status cards. Attacks against Luke Cage lose piercing.
  > **Forced Response**: After a tough status card is discarded from Luke Cage, he takes 1 unpreventable damage *(ignoring tough)*.
- **Image Asset**: `assets/card-art/bundles/cards/62001a.png` (300×419 px, 239.3 KB)
### [62001b] Luke Cage
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 10, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > *Unbreakable Skin* — Luke Cage can have any number of tough status cards. Attacks against Luke Cage lose piercing.
  > **Action**: Search your deck and discard pile for the Burstein Process upgrade and add it to your hand. (Limit once per phase.)
- **Image Asset**: `assets/card-art/bundles/cards/62001b.png` (300×419 px, 218.5 KB)
### [62002] Jessica Jones
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Defender.*
- **Rules Text**:
  > [star] Jessica Jones gets +1 THW for each tough status card on your identity (to a maximum of +4 THW).
- **Flavor**: *"I'm here, and I'm not going anywhere."*
- **Image Asset**: `assets/card-art/bundles/cards/62002.png` (300×419 px, 208.6 KB)
### [62003] Harlem's Hero
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (2–3/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action**: Give Luke Cage a tough status card. For each tough status card on Luke Cage, choose a character you control and ready it.
- **Flavor**: *"It ain't just me. I've got family to back me up." —Luke Cage*
### [62004] Knuckle Sandwich
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (4/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. You may discard a tough status card from Luke Cage to return this event to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/62004.png` (300×419 px, 259.1 KB)
### [62005] "Stand with Me!"
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (5–6/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Give Luke Cage a tough status card. Remove 1 threat from a scheme for each tough status card on Luke Cage (to a maximum of 5).
- **Flavor**: *"This is the greatest city in the world. I will not allow it to fall into chaos." —Luke Cage*
- **Image Asset**: `assets/card-art/bundles/cards/62005.png` (300×419 px, 228.4 KB)
### [62006] "Sweet Christmas!"
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (7–8/15, Qty: 2)
- **Stats**: **Cost**: 5, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > [star] Reduce the cost to play this card by 1 for each tough status card on Luke Cage.
  > **Hero Action** *(attack)*: Deal 5 damage to the villain and each minion engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/62006.png` (300×419 px, 234.4 KB)
### [62007] Fogwell's Gym
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Response**: After a tough status card is discarded from a [[Defender]] character, exhaust Fogwell's gym → ready that character.
- **Flavor**: *"Busted a lot of punching bags at this old place, and they never kicked me out." —Luke Cage*
### [62008] Burstein Process
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Burstein Process → give Luke Cage a tough status card (2 tough status cards instead if he has none).
- **Flavor**: *"I got skin like steel and muscles to match." —Luke Cage*
### [62009] Cruisin' for a Bruisin'
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (11–12/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to a minion. Max 1 per minion.
  > Attacks against attached minion deal 2 additional damage and gain overkill.
  > **Response**: After you play this card, engage attached minion.
### [62010] Metal Bracer
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (13–14/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor. Item.*
- **Rules Text**:
  > Luke Cage gets retaliate 1.
  > **Hero Interrupt**: When any amount of damage would be dealt to Luke Cage, exhaust Metal Bracer → reduce that damage by 1.
### [62011] Power Man
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > **Hero Response**: After a tough status card is discarded from Luke Cage, exhaust Power Man → draw a card.
- **Flavor**: *"Tremble before the power of Power Man! That sounded weird. Luke Cage. Tremble before Luke Cage." —Luke Cage*
- **Image Asset**: `assets/card-art/bundles/cards/62011.png` (300×419 px, 250.6 KB)
### [62028] Internal Injury
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Luke Cage Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Luke Cage player.***
  > **Forced Response**: After the player phase ends, take 3 unpreventable damage *(ignoring tough status cards)*.
  > **Alter-Ego Response**: After you recover, remove Internal Injury from the game.

### Set: Leadership

### [62012] Iron Fist — *Danny Rand*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > **Interrupt**: When Iron Fist defends against an enemy attack, prevent damage from that attack equal to Iron Fist's ATK.
- **Flavor**: *"I've forgotten more about fighting than you'll ever know." —Iron Fist*
### [62013] Misty Knight
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > Toughness.
  > [star] Misty Knight gets +2 ATK and +2 THW while she has a tough status card.
- **Flavor**: *"Come on, hoeroes. We've got to help save this city."*
- **Image Asset**: `assets/card-art/bundles/cards/62013.png` (300×419 px, 254.5 KB)
### [62014] Valkyrie — *Brunnhilde*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Asgard. Defender.*
- **Rules Text**:
  > Toughness.
  > **Interrupt**: When another ally would be defeated, discard Valkyrie *(from play)* → instead heal that ally until they have 1 hit point remaining.
### [62015] Take a Stand
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Response**: After your hero defends, each ally you control gets +1 THW and +1 ATK until the end of the player phase.
- **Flavor**: *"It takes a lot more than that to keep me down." —Luke Cage*
- **Image Asset**: `assets/card-art/bundles/cards/62015.png` (300×419 px, 232.8 KB)
### [62016] Innovation
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, heal 1 damage from an ally you control.
### [62017] The Power of Leadership
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Leadership *(blue)* card.
### [62018] Defensive Formation
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Uses (3 block counters).
  > **Action**: Exhaust this card and remove 1 block counter from it → give a [[Defender]] ally a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/62018.png` (300×419 px, 276.3 KB)
### [62019] Righteous Purpose
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Maxim.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Each character you control that has exactly 1 hit point remaining gets +2 THW and +2 ATK.
- **Flavor**: *"No more running." —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/62019.png` (300×419 px, 272.7 KB)

### Set: Basic

### [62020] Hulk — *Bruce Banner*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 4, **ATK**: 2 (Consequential: 2), **HP**: 5, **Resources**: [physical]
- **Traits**: *Defender. Gamma.*
- **Rules Text**:
  > Hulk gets +1 ATK for each rage counter here.
  > **Response**: After the villain attacks you, place 1 rage counter here.
### [62021] She-Hulk — *Jennifer Walters*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 2), **HP**: 3, **Resources**: [mental]
- **Traits**: *Defender. Gamma.*
- **Rules Text**:
  > Toughness.
  > **Response**: After She-Hulk enters play, give your identity a tough status card.
- **Flavor**: *"You interrupted my workout."*
### [62022] Dynamic Duo
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Rules Text**:
  > **Action**: Search your deck and discard pile for a Team-Up card and an ally named by that card's Team-Up keyword. Add those cards to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/62022.png` (300×419 px, 248.6 KB)
### [62023] Power Man and Iron Fist
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > Team-Up *(Iron Fist and Luke Cage)*. Max 1 per deck.
  > **Hero Action** *(attack)*: Deal 2 damage to an enemy and give a tough status card to a character.
### [62024] Unbreakable Bond
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Team-Up *(Jessica Jones and Luke Cage)*. Max 1 per deck.
  > **Hero Action**: *(thwart)*: Remove 3 threat from a scheme. Heal a total of 3 damage from among Jessica Jones and Luke Cage.
### [62025] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [62026] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [62027] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [62037] Black Belt
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 37
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > Play only if any player controls a [[Martial Artist]] card.
  > Attach to a friendly character. Max 1 per character.
  > Attached character gets +1 hit point and gains the [[Martial Artist]] trait.

### Set: Luke Cage Nemesis

### [62029] Cottonmouth
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Luke Cage Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Serpent Society.*
- **Rules Text**:
  > [star] **Forced Response**: After Cottonmouth attacks, he attacks the same character 2 additional times. (Limit once per phase.)
  > *(Luke Cage's nemesis minion.)*
  >
  > ---
  >
  > [star] **Boost**: Deal this card to the Luke Cage player as a facedown encounter card.
### [62030] Venomous Whispers
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage Nemesis (2/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Luke Cage Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[Serpent Society]] minion cannot be attacked.
  > **When Defeated**: The defeating player discards cards from the top of the encounter deck until a [[Serpent Society]] minion is discarded and reveals that minion.
  >
  > ---
  >
  > [star] **Boost**: You are confused.
### [62031] Augmented Jaws
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage Nemesis (3/5)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Luke Cage Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Cottonmouth. Otherwise, attach to the villain.
  > [star] **Forced Interrupt**: When attached enemy attacks a character, discard each tough status card from that character.
  > **Hero Action**: Spend [mental] [mental] resources → discard this card.
### [62032] Asp
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage Nemesis (4/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Luke Cage Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Serpent Society.*
- **Rules Text**:
  > [star] **Forced Response**: After Asp schemes against you, you are stunned.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Flavor**: *"You deserve a taste of venom!"*
### [62033] Sidewinder
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Luke Cage Nemesis (5/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Luke Cage Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Serpent Society.*
- **Rules Text**:
  > Quickstrike.
  > **Forced Interrupt**: When Sidewinder is attacked, discard the top card of the encounter deck. If the discarded card has a "**Boost**" ability, deal Sidewinder to the attacking player as a facedown encounter card.

### Set: Aggression

### [62034] Size Advantage
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy (6 damage instead if you have the [[Giant]] trait or more remaining hit points than that enemy).
- **Flavor**: *"Puny runt!" —Hulk*

### Set: Justice

### [62035] Observe
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 35
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: The villain schemes. Give your hero a tough status card.
- **Flavor**: *"There are other ways to see." —Daredevil*

### Set: Protection

### [62036] Toughen Up
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Luke Cage (`luke_cage`)
- **Deck / Set**: Pack Position: 36
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Response**: After you recover, if your remaining hit points are equal to or greater than your base hit points, exhaust Toughen Up → give your identity a tough status card.

