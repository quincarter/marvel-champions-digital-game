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
| `34001a` | Phoenix | Hero | Phoenix | THW:3 ATK:1 DEF:2 HP:9 | - | `phoenix` |
| `34001b` | Jean Grey | Alter-Ego | Phoenix | HP:9 | - | `phoenix` |
| `34002a` | Phoenix Force | Upgrade | Phoenix | - | - | `phoenix` |
| `34002b` | Phoenix Force | Upgrade | Phoenix | - | - | `phoenix` |
| `34003` | Cyclops | Ally | Phoenix | THW:2 ATK:2 HP:3 | - | `phoenix` |
| `34004` | White Hot Room | Support | Phoenix | - | - | `phoenix` |
| `34005` | Phoenix Suit | Upgrade | Phoenix | - | - | `phoenix` |
| `34006` | Rise from the Ashes | Upgrade | Phoenix | - | - | `phoenix` |
| `34007` | Telekinetic Shield | Upgrade | Phoenix | - | - | `phoenix` |
| `34008` | Mental Paralysis | Upgrade | Phoenix | - | - | `phoenix` |
| `34009` | Mind Control | Upgrade | Phoenix | - | - | `phoenix` |
| `34010` | Telekinetic Attack | Event | Phoenix | - | - | `phoenix` |
| `34011` | Psychic Blast | Event | Phoenix | - | - | `phoenix` |
| `34012` | Telepathic Trickery | Event | Phoenix | - | - | `phoenix` |
| `34013` | Phoenix Firebird | Event | Phoenix | - | - | `phoenix` |
| `34014` | Banshee | Ally | Pack Position: 14 | THW:2 ATK:2 HP:3 | - | `phoenix` |
| `34015` | Marvel Girl | Ally | Pack Position: 15 | THW:2 ATK:1 HP:3 | - | `phoenix` |
| `34016` | Mission Training | Upgrade | Pack Position: 16 | - | - | `phoenix` |
| `34017` | Psychic Manipulation | Event | Pack Position: 17 | - | - | `phoenix` |
| `34018` | Mutant Peacekeepers | Event | Pack Position: 18 | - | - | `phoenix` |
| `34019` | Swift Retribution | Event | Pack Position: 19 | - | - | `phoenix` |
| `34020` | Passion for Justice | Resource | Pack Position: 20 | - | - | `phoenix` |
| `34021` | Storm | Ally | Pack Position: 21 | THW:2 ATK:2 HP:3 | - | `phoenix` |
| `34022` | Cerebro | Support | Pack Position: 22 | - | - | `phoenix` |
| `34023` | Psychic Rapport | Event | Pack Position: 23 | - | - | `phoenix` |
| `34024` | Down Time | Upgrade | Pack Position: 24 | - | - | `phoenix` |
| `34025` | Energy | Resource | Pack Position: 25 | - | - | `phoenix` |
| `34026` | Genius | Resource | Pack Position: 26 | - | - | `phoenix` |
| `34027` | Strength | Resource | Pack Position: 27 | - | - | `phoenix` |
| `34028` | Burning Hunger | Obligation | Phoenix | - | 2 pips | `phoenix` |
| `34029` | Dark Phoenix | Minion | Phoenix Nemesis | SCH:2 ATK:2 HP:12 | 3 pips | `phoenix` |
| `34030` | Consume the World | Side Scheme | Phoenix Nemesis | - | 3 pips | `phoenix` |
| `34031` | Fiery Rage | Treachery | Phoenix Nemesis | - | 2 pips | `phoenix` |
| `34032` | Psychic Assault | Event | Pack Position: 32 | - | - | `phoenix` |
| `34033` | Psychic Misdirection | Event | Pack Position: 33 | - | - | `phoenix` |
| `34034` | Psychic Kicker | Event | Pack Position: 34 | - | - | `phoenix` |
| `34035` | Soul Sisters | Event | Pack Position: 35 | - | - | `phoenix` |

---

## Pack: Phoenix (`phoenix`)

### Set: Phoenix

### [34001a] Phoenix
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 3, **ATK**: 1, **DEF**: 2, **HP**: 9, **Hand Size**: 5
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > *Psionic Bond* — **Hero Resource**: Remove 1 power counter from Phoenix Force → generate a [wild] resource. (Limit once per phase.)
- **Flavor**: *"The Phoenix chose me, but I alone decide who I am!"*
- **Image Asset**: `assets/card-art/bundles/cards/34001a.png` (607×880 px, 143.3 KB)
### [34001b] Jean Grey
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3 [star], **HP**: 9, **Hand Size**: 6
- **Traits**: *Mutant. Psionic.*
- **Rules Text**:
  > **Setup**: Put your Phoenix Force upgrade into play, [[RESTRAINED]] side faceup. Place 4 power counters on it.
  > [star] **Response**: After you make a basic recovery, place 1 power counter on Phoenix Force.
- **Image Asset**: `assets/card-art/bundles/cards/34001b.png` (607×880 px, 146.6 KB)
### [34002a] Phoenix Force
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (1/16)
- **Properties**: Permanent
- **Stats**: **Resources**: [mental]
- **Traits**: *Restrained.*
- **Rules Text**:
  > Permanent.
  > You gain the [[RESTRAINED]] trait.
  > **Forced Response**: After the last power counter is removed from here, flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/34002a.png` (607×880 px, 134.9 KB)
### [34002b] Phoenix Force
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (1/16)
- **Properties**: Permanent
- **Stats**: **Resources**: [physical]
- **Traits**: *Unleashed.*
- **Rules Text**:
  > Permanent.
  > You gain the [[UNLEASHED]] trait.
  > Phoenix gets -2 THW and +2 ATK.
  > **Forced Response**: After a power counter is placed here, if there are 4 or more power counters here, flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/34002b.png` (607×880 px, 139.9 KB)
### [34003] Cyclops — *Scott Summers*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (2/16)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Cyclops enters play, place 2 power counters on Phoenix Force.
  > **Response**: When Cyclops leaves play, remove 2 power counters from Phoenix Force.
- **Image Asset**: `assets/card-art/bundles/cards/34003.png` (607×880 px, 134.0 KB)
### [34004] White Hot Room
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (3/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Location. Phoenix.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust White Hot Room → choose:
  > • Place 1 power counter on Phoenix Force.
  > • Heal 2 damage from Jean Grey.
- **Image Asset**: `assets/card-art/bundles/cards/34004.png` (607×880 px, 110.1 KB)
### [34005] Phoenix Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (4/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Item.*
- **Rules Text**:
  > Phoenix gains the [[AERIAL]] trait.
  > While you have the [[RESTRAINED]] trait, you gain steady.
  > While you have the [[UNLEASHED]] trait, you gain retaliate 1.
- **Image Asset**: `assets/card-art/bundles/cards/34005.png` (607×880 px, 151.6 KB)
### [34006] Rise from the Ashes
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (5/16)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Phoenix.*
- **Rules Text**:
  > **Interrupt**: When you would be defeated, remove this card from the game → ready your identity and restore it to its printed hit point value instead. Remove each power counter from Phoenix Force.
- **Image Asset**: `assets/card-art/bundles/cards/34006.png` (607×880 px, 150.7 KB)
### [34007] Telekinetic Shield
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (6/16)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Psionic.*
- **Rules Text**:
  > Attach to a friendly character.
  > **Forced Interrupt**: When attached character would take damage from an enemy attack, place that damage here instead. Then, if there is at least 5 damage here, discard Telekinetic Shield.
- **Image Asset**: `assets/card-art/bundles/cards/34007.png` (607×880 px, 152.0 KB)
### [34008] Mental Paralysis
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (7/16)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Psionic.*
- **Rules Text**:
  > Hero form only. Attach to a non-[[ELITE]] minion.
  > Attached minion cannot activate.
  > **Forced Response**: After you flip to alter-ego form, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/34008.png` (607×880 px, 142.7 KB)
### [34009] Mind Control
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (8/16)
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Condition. Psionic.*
- **Rules Text**:
  > Attach to a non-[[ELITE]] minion.
  > Take control of attached minion and treat it as a [[CONTROLLED]] ally with a blank text box. Its THW is equal to its printed SCH and it takes 1 consequential damage after it thwarts or attacks.
- **Image Asset**: `assets/card-art/bundles/cards/34009.png` (607×880 px, 149.8 KB)
### [34010] Telekinetic Attack
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (9–10/16, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack. Psionic.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 7 damage to an enemy. If you have the [[UNLEASHED]] trait, this attack deals 2 additional damage and gains overkill.
- **Flavor**: *"Poor fool, you have no idea how hopelessly outmatched you are!" —Phoenix*
- **Image Asset**: `assets/card-art/bundles/cards/34010.png` (607×880 px, 145.7 KB)
### [34011] Psychic Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (11–12/16, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Psionic.*
- **Rules Text**:
  > **Hero Action**: Deal 4 damage to the villain. If you have the [[UNLEASHED]] trait, deal 4 damage to each minion engaged with you.
- **Flavor**: *"We fight on different battlefields. Your strength won't help you in mine." —Phoenix*
- **Image Asset**: `assets/card-art/bundles/cards/34011.png` (607×880 px, 143.2 KB)
### [34012] Telepathic Trickery
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (13–14/16, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Psionic. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 4 threat from a scheme. If you have the [[UNLEASHED]] trait, stun and confuse an enemy.
- **Flavor**: *"They can't see us because I won't let them." —Phoenix*
- **Image Asset**: `assets/card-art/bundles/cards/34012.png` (607×880 px, 134.4 KB)
### [34013] Phoenix Firebird
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (15–16/16, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Phoenix.*
- **Rules Text**:
  > **Hero Action**: Choose:
  > • Remove 1 power counter from Phoenix Force → ready Phoenix.
  > • Place 2 power counters on Phoenix Force.
- **Image Asset**: `assets/card-art/bundles/cards/34013.png` (607×880 px, 119.6 KB)
### [34028] Burning Hunger
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Phoenix Set Icon (printed bottom-right next to deck number)
- **Image Asset**: `assets/card-art/bundles/cards/34028.png` (607×880 px, 144.1 KB)

### Set: Justice

### [34014] Banshee — *Sean Cassidy*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Aerial. X-Men.*
- **Rules Text**:
  > [star] **Response**: After Banshee thwarts, confuse a minion.
- **Flavor**: *"Ye'd best cover yer ears, lads...this is goin' to hurt!"*
- **Image Asset**: `assets/card-art/bundles/cards/34014.png` (607×880 px, 120.1 KB)
### [34015] Marvel Girl — *Rachel Summers*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > [star] **Interrupt**: When Marvel Girl attacks a minion, remove X threat from the main scheme, where X is that minion's printed SCH.
- **Flavor**: *"Whatever it is you're up to, it's over now."*
- **Image Asset**: `assets/card-art/bundles/cards/34015.png` (607×880 px, 128.2 KB)
### [34016] Mission Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Training.*
- **Rules Text**:
  > Attach to an [[X-MEN]] ally. Max 1 [[TRAINING]] upgrade per ally.
  > Attached ally gets +1 THW point and +2 hit points.
- **Image Asset**: `assets/card-art/bundles/cards/34016.png` (607×880 px, 136.7 KB)
### [34017] Psychic Manipulation
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Psionic. Thwart.*
- **Rules Text**:
  > Play only if your identity has the [[PSIONIC]] trait.
  > **Interrupt** *(thwart)*: When the villain schemes, this activation removes threat instead of placing it.
- **Image Asset**: `assets/card-art/bundles/cards/34017.png` (607×880 px, 129.9 KB)
### [34018] Mutant Peacekeepers
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Play only if your identity has the [[X-MEN]] trait.
  > **Hero Action** *(thwart)*: Exhaust your hero and any number of [[X-MEN]] allies → remove X threat from among schemes in play, where X is the total THW of those characters.
- **Image Asset**: `assets/card-art/bundles/cards/34018.png` (607×880 px, 133.2 KB)
### [34019] Swift Retribution
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: The villain schemes. Deal 4 damage to the villain.
- **Flavor**: *"Return what you've taken and I'll let you go. This time. But next time, you won't be so lucky. And I won't be so kind." —Moon Knight*
- **Image Asset**: `assets/card-art/bundles/cards/34019.png` (607×880 px, 129.6 KB)
### [34020] Passion for Justice
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > **Interrupt**: When you spend this card to play a [[THWART]] event, that event removes 1 additional threat.
- **Image Asset**: `assets/card-art/bundles/cards/34020.png` (607×880 px, 130.0 KB)

### Set: Basic

### [34021] Storm — *Ororo Munroe*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Aerial. X-Men.*
- **Rules Text**:
  > Reduce the cost to play Storm by 1 if your identity has the [[MUTANT]] or [[X-MEN]] trait.
  > [star] **Interrupt**: When Storm thwarts a scheme, move 2 threat from that scheme to another scheme.
- **Image Asset**: `assets/card-art/bundles/cards/34021.png` (607×880 px, 148.3 KB)
### [34022] Cerebro
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location. X-Men.*
- **Rules Text**:
  > Play only if your identity has the [[MUTANT]] trait.
  > **Alter-Ego Action**: Exhaust Cerebro → search the top 5 cards of your deck for an [[X-MEN]] ally (search your whole deck instead if you control a [[PSIONIC]] character) and add that ally to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/34022.png` (607×880 px, 134.6 KB)
### [34023] Psychic Rapport
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Rules Text**:
  > Team-Up (Cyclops and Phoenix). Max 1 per deck.
  > **Hero Action**: Ready Cyclops and Phoenix. Choose to either return a Cyclops card from your discard pile to your hand or place 2 power counters on Phoenix Force.
### [34024] Down Time
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your alter-ego gets +2 REC.
- **Flavor**: *"We should do this more often."*
- **Image Asset**: `assets/card-art/bundles/cards/34024.png` (607×880 px, 134.0 KB)
### [34025] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [34026] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [34027] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [34035] Soul Sisters
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 35
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > Team-Up (Phoenix and Storm). Max 1 per deck.
  > **Hero Action**: Ready Phoenix and Storm. Heal 2 damage from each of them.
- **Image Asset**: `assets/card-art/bundles/cards/34035.png` (607×880 px, 141.3 KB)

### Set: Phoenix Nemesis

### [34029] Dark Phoenix
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 2, **HP**: 12
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Phoenix Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cosmic Entity. Elite.*
- **Rules Text**:
  > Steady. Toughness. Villainous.
  > [star] When Dark Phoenix schemes, place that threat on Consume the World, if able.
  > **When Revealed**: Search the encounter deck, discard pile, and set-aside area for Consume the World and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/34029.png` (607×880 px, 135.4 KB)
### [34030] Consume the World
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix Nemesis (2/5)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Phoenix Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Permanent.
  > While there is no threat here, this scheme loses the [amplify] icon.
  > **Forced Response**: After threat is placed here, if there is at least 12 threat here, the players lose the game.
- **Image Asset**: `assets/card-art/bundles/cards/34030.png` (1030×710 px, 300.0 KB)
### [34031] Fiery Rage
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Phoenix Nemesis (3–5/5, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Phoenix Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril.
- **Image Asset**: `assets/card-art/bundles/cards/34031.png` (607×880 px, 129.5 KB)

### Set: Aggression

### [34032] Psychic Assault
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Psionic.*
- **Rules Text**:
  > Play only if your identity has the [[PSIONIC]] trait.
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. Confuse that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/34032.png` (607×880 px, 127.7 KB)

### Set: Protection

### [34033] Psychic Misdirection
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Defense. Psionic.*
- **Rules Text**:
  > Play only if your identity has the [[PSIONIC]] trait.
  > **Hero Interrupt** *(defense)*: When an enemy attacks you, choose a different enemy → damage from that attack is dealt to the chosen enemy instead of you.
- **Image Asset**: `assets/card-art/bundles/cards/34033.png` (607×880 px, 143.8 KB)

### Set: Leadership

### [34034] Psychic Kicker
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Phoenix (`phoenix`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Psionic.*
- **Rules Text**:
  > Play only if your identity has the [[PSIONIC]] trait.
  > **Hero Action**: Ready an ally. That ally gets +2 THW and +2 ATK for its next basic thwart or attack action this phase.
- **Image Asset**: `assets/card-art/bundles/cards/34034.png` (607×880 px, 129.1 KB)

