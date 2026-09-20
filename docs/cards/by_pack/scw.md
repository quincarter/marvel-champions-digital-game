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
| `15001a` | Scarlet Witch | Hero | Scarlet Witch | THW:2 ATK:1 DEF:2 HP:10 | - | `scw` |
| `15001b` | Wanda Maximoff | Alter-Ego | Scarlet Witch | HP:10 | - | `scw` |
| `15002` | Quicksilver | Ally | Scarlet Witch | THW:1 ATK:2 HP:4 | - | `scw` |
| `15003` | Chaos Magic | Event | Scarlet Witch | - | - | `scw` |
| `15004` | Hex Bolt | Event | Scarlet Witch | - | - | `scw` |
| `15005` | Molecular Decay | Event | Scarlet Witch | - | - | `scw` |
| `15006` | Warp Reality | Event | Scarlet Witch | - | - | `scw` |
| `15007` | Agatha Harkness | Support | Scarlet Witch | - | - | `scw` |
| `15008` | Magic Shield | Upgrade | Scarlet Witch | - | - | `scw` |
| `15009` | Scarlet Witch's Crest | Upgrade | Scarlet Witch | - | - | `scw` |
| `15010` | Speed | Ally | Pack Position: 10 | THW:2 ATK:1 HP:4 | - | `scw` |
| `15011` | Wiccan | Ally | Pack Position: 11 | THW:1 ATK:1 HP:3 | - | `scw` |
| `15012` | Crisis Averted | Event | Pack Position: 12 | - | - | `scw` |
| `15013` | Multitasking | Event | Pack Position: 13 | - | - | `scw` |
| `15014` | Swift Retribution | Event | Pack Position: 14 | - | - | `scw` |
| `15015` | Turn the Tide | Event | Pack Position: 15 | - | - | `scw` |
| `15016` | The Power of Justice | Resource | Pack Position: 16 | - | - | `scw` |
| `15017` | Heroic Intuition | Upgrade | Pack Position: 17 | - | - | `scw` |
| `15018` | Order and Chaos | Event | Pack Position: 18 | - | - | `scw` |
| `15019` | Spiritual Meditation | Event | Pack Position: 19 | - | - | `scw` |
| `15020` | Energy | Resource | Pack Position: 20 | - | - | `scw` |
| `15021` | Genius | Resource | Pack Position: 21 | - | - | `scw` |
| `15022` | Strength | Resource | Pack Position: 22 | - | - | `scw` |
| `15023` | Slipping Sanity | Obligation | Scarlet Witch | - | 3 pips | `scw` |
| `15024` | The Next Evolution | Side Scheme | Scarlet Witch Nemesis | - | 2 pips | `scw` |
| `15025` | Luminous | Minion | Scarlet Witch Nemesis | SCH:2 ATK:2 HP:5 | 2 pips | `scw` |
| `15026` | Magical Suspension | Attachment | Scarlet Witch Nemesis | - | 2 pips | `scw` |
| `15027` | Chaos Manipulation | Treachery | Scarlet Witch Nemesis | - | 2 pips | `scw` |
| `15028` | Browbeat | Event | Pack Position: 28 | - | - | `scw` |
| `15029` | Last Stand | Event | Pack Position: 29 | - | - | `scw` |
| `15030` | Bait and Switch | Event | Pack Position: 30 | - | - | `scw` |
| `15031` | Recuperation | Event | Pack Position: 31 | - | - | `scw` |

---

## Pack: Scarlet Witch (`scw`)

### Set: Scarlet Witch

### [15001a] Scarlet Witch
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *Avenger. Mystic.*
- **Rules Text**:
  > *Chaos Control* — **Interrupt:** When boost icons on an encounter card would be counted, discard the top card of the encounter deck and count the number of boost icons on that card instead. (Limit once per phase.)
- **Image Asset**: `assets/card-art/bundles/cards/15001a.png` (300×418 px, 225.4 KB)
### [15001b] Wanda Maximoff
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Mystic.*
- **Rules Text**:
  > *Superpowered Siblings* — **Action:** Discard 2 cards from your hand → draw 2 cards (draw 3 cards instead if Pietro Maximoff is in play). (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/15001b.png` (300×418 px, 227.1 KB)
### [15002] Quicksilver — *Pietro Maximoff*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 4, **Resources**: [wild]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Action:** Ready Quicksilver. (Limit once per phase.)
- **Flavor**: *"I've warned you never to threaten my sister!"*
- **Image Asset**: `assets/card-art/bundles/cards/15002.png` (726×1041 px, 178.9 KB)
### [15003] Chaos Magic
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (2/15)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Traits**: *Spell. Superpower.*
- **Rules Text**:
  > **Hero Action:** Play a card from your hand, ignoring its resource cost. Discard cards from the top of the encounter deck equal to that card's printed resource cost.
- **Flavor**: *"I will shape the world as I see fit." —Scarlet Witch*
- **Image Asset**: `assets/card-art/bundles/cards/15003.png` (727×1041 px, 187.4 KB)
### [15004] Hex Bolt
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (3–6/15, Qty: 4)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Spell. Superpower.*
- **Rules Text**:
  > **Hero Action**: Discard the top 3 cards of the encounter deck. For each card discarded this way that has boost icons equal to:
  > - 0, deal 2 damage to an enemy.
  > - 1, remove 2 threat from a scheme.
  > - 2, draw 1 card.
  > - 3+, place a status card on a character.
- **Image Asset**: `assets/card-art/bundles/cards/15004.png` (725×1043 px, 165.5 KB)
### [15005] Molecular Decay
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (7–9/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Spell.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy and discard the top 2 cards of the encounter deck. For each boost icon discarded this way, deal 1 additional damage to that enemy.
- **Flavor**: *"There is no defense against the Scarlet Witch!"*
- **Image Asset**: `assets/card-art/bundles/cards/15005.png` (721×1039 px, 165.7 KB)
### [15006] Warp Reality
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (10/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Spell. Superpower.*
- **Rules Text**:
  > **Hero Interrupt:** When an encounter card is revealed from the encounter deck, cancel all of its effects and discard it. Discard cards from the top of the encounter deck equal to the number of boost icons on that card.
- **Image Asset**: `assets/card-art/bundles/cards/15006.png` (728×1041 px, 176.3 KB)
### [15007] Agatha Harkness
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Alter-Ego Action:** Exhaust Agatha Harkness → look at the top 3 cards of your deck. Add 1 of those to your hand and place the rest on the bottom of your deck in any order.
- **Flavor**: *"Don't let your anger get the best of you, Wanda."*
- **Image Asset**: `assets/card-art/bundles/cards/15007.png` (728×1043 px, 194.4 KB)
### [15008] Magic Shield
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (12–14/15, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Spell.*
- **Rules Text**:
  > **Hero Interrupt:** When a friendly character would take any amount of damage, discard Magic Shield → prevent 3 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/15008.png` (728×1044 px, 172.2 KB)
### [15009] Scarlet Witch's Crest
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (15/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Item.*
- **Rules Text**:
  > **Interrupt:** When boost icons on an encounter card are counted, exhaust Scarlet Witch's Crest → increase or decrease the number of boost icons on that card by 1 for this count.
- **Image Asset**: `assets/card-art/bundles/cards/15009.png` (726×1041 px, 164.3 KB)
### [15023] Slipping Sanity
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scarlet Witch Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Wanda Maximoff player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Wanda Maximoff → remove Slipping Sanity from the game.
  > • Discard the top 5 cards of the encounter deck. For each star icon([star]) in the boost area discarded this way, place 1 threat on the main scheme. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/15023.png` (726×1043 px, 175.4 KB)

### Set: Justice

### [15010] Speed — *Thomas Shepherd*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 10
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After Speed thwarts, ready him. (Limit once per round.)
- **Flavor**: *"Hey! Geriatrics! Let's get a move on. The Avengers need us!"*
- **Image Asset**: `assets/card-art/bundles/cards/15010.png` (722×1046 px, 160.9 KB)
### [15011] Wiccan — *William Kaplan*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response:** After Wiccan thwarts, discard the top card of the encounter deck. For each boost icon discarded this way, deal 1 damage to an enemy.
- **Flavor**: *"I'm the child of a witch and an android. I'm their wish come true."*
- **Image Asset**: `assets/card-art/bundles/cards/15011.png` (727×1042 px, 161.5 KB)
### [15012] Crisis Averted
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 12
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 6 threat from the main scheme. If you paid for this card using a [mental] resource, this thwart ignores the crisis icon ([crisis]).
- **Image Asset**: `assets/card-art/bundles/cards/15012.png` (719×1041 px, 167.5 KB)
### [15013] Multitasking
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 2 threat from a scheme. If you paid for this card using a [mental] resource, remove 2 threat from a different scheme.
- **Flavor**: *"A hero isn't the one who always wins. They're the one who always tries." —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/15013.png` (728×1042 px, 177.4 KB)
### [15014] Swift Retribution
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: The villain schemes. Deal 4 damage to the villain.
- **Flavor**: *"Return what you've taken and I'll let you go. This time. But next time, you won't be so lucky. And I won't be so kind." —Moon Knight*
- **Image Asset**: `assets/card-art/bundles/cards/15014.png` (726×1023 px, 265.5 KB)
### [15015] Turn the Tide
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Response** *(attack)*: After your hero thwarts and removes all threat from a scheme, deal 3 damage to an enemy.
- **Flavor**: *"Back, you rabble!" —Scarlet Witch*
- **Image Asset**: `assets/card-art/bundles/cards/15015.png` (727×1043 px, 145.3 KB)
### [15016] The Power of Justice
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Justice *(yellow)* card.
### [15017] Heroic Intuition
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 THW.

### Set: Basic

### [15018] Order and Chaos
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Rules Text**:
  > Team-Up (Quicksilver and Scarlet Witch). Max 1 per deck.
  > **Hero Interrupt**: When a treachery card is revealed from the encounter deck, cancel its "**When Revealed**" effects, then deal 2 damage to the villain.
### [15019] Spiritual Meditation
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Spell.*
- **Rules Text**:
  > Play only if your identity has the [[Mystic]] trait.
  > **Action**: Draw 2 cards. Choose and discard 1 card from your hand.
- **Flavor**: *"Every spell, every sigil, every manipulation... you must keep a close eye on everything so it doesn't backfire."*
- **Image Asset**: `assets/card-art/bundles/cards/15019.png` (729×1044 px, 177.4 KB)
### [15020] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [15021] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [15022] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [15031] Recuperation
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Rules Text**:
  > **Alter-Ego Action**: Heal damage from your alter-ego equal to your REC.
- **Flavor**: *"You look to be feeling better." —Stephen Strange*
- **Image Asset**: `assets/card-art/bundles/cards/15031.png` (729×1044 px, 172.1 KB)

### Set: Scarlet Witch Nemesis

### [15024] The Next Evolution
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch Nemesis (1/4)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scarlet Witch Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Increase the number of boost icons on each encounter card by 1.
- **Flavor**: *"The High Evolutionary intends to build a god fit for the twenty-first century!" —High Evolutionary*
- **Image Asset**: `assets/card-art/bundles/cards/15024.png` (1045×725 px, 150.9 KB)
### [15025] Luminous
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch Nemesis (2/4)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scarlet Witch Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite.*
- **Rules Text**:
  > **Forced Response:** After Luminous activates against you, discard the top card of the encounter deck. If 2 or more boost icons were discarded this way, deal yourself 1 encounter card.
  > *(Scarlet Witch's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/15025.png` (727×1043 px, 182.8 KB)
### [15026] Magical Suspension
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch Nemesis (3/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scarlet Witch Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spell.*
- **Rules Text**:
  > Attach to your identity.
  > . Each card you play costs 1 additional resource.
  > **Hero Action**: Exhaust your hero → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/15026.png` (728×1043 px, 164.1 KB)
### [15027] Chaos Manipulation
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Scarlet Witch Nemesis (4/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scarlet Witch Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for Luminous and put her into play engaged with you. Discard the top card of the encounter deck. If 2 or more boost icons were discarded this way, Luminous activates against you.
- **Image Asset**: `assets/card-art/bundles/cards/15027.png` (728×1041 px, 183.2 KB)

### Set: Aggression

### [15028] Browbeat
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > **Hero Action** *(attack)*: Deal 2 damage to the villain. Deal X additional damage to the villain (to a maximum of 3), where X is equal to the villain's stage number.
- **Image Asset**: `assets/card-art/bundles/cards/15028.png` (729×1045 px, 179.5 KB)

### Set: Leadership

### [15029] Last Stand
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Interrupt**: When an ally you control attacks, it gets +3 ATK for that attack. After that attack resolves, discard that ally.
- **Flavor**: *"Heed, great fiend! Thou shalt not defeat me easily!" —Lady Sif*
- **Image Asset**: `assets/card-art/bundles/cards/15029.png` (727×1042 px, 179.9 KB)

### Set: Protection

### [15030] Bait and Switch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Scarlet Witch (`scw`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: The villain attacks you. Remove 4 threat from the main scheme.
- **Flavor**: *"You didn't really think I'd let you get away with that, did you?" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/15030.png` (730×1045 px, 184.8 KB)

