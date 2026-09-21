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
| `46001a` | Iceman | Hero | Iceman | THW:1 ATK:2 DEF:2 HP:11 | - | `iceman` |
| `46001b` | Bobby Drake | Alter-Ego | Iceman | REC:4 HP:11 | - | `iceman` |
| `46002` | Frostbite | Upgrade | Frostbite | - | - | `iceman` |
| `46003` | Snow Clone | Ally | Iceman | ATK:2 HP:2 | - | `iceman` |
| `46004` | Power Belt | Upgrade | Iceman | - | - | `iceman` |
| `46005` | Cryokinetic Perception | Upgrade | Iceman | - | - | `iceman` |
| `46006` | Ice Slide | Upgrade | Iceman | - | - | `iceman` |
| `46007` | Frozen Solid | Upgrade | Iceman | - | - | `iceman` |
| `46008` | Ice Wall | Support | Iceman | - | - | `iceman` |
| `46009` | Arctic Attack | Event | Iceman | - | - | `iceman` |
| `46010` | Ice Blast | Event | Iceman | - | - | `iceman` |
| `46011` | Chill Out! | Event | Iceman | - | - | `iceman` |
| `46012` | Shark-Girl | Ally | Pack Position: 12 | THW:0 ATK:2 HP:2 | - | `iceman` |
| `46013` | Glob | Ally | Pack Position: 13 | THW:2 ATK:2 HP:3 | - | `iceman` |
| `46014` | Suppressing Fire | Upgrade | Pack Position: 14 | - | - | `iceman` |
| `46015` | Surprise Move | Event | Pack Position: 15 | - | - | `iceman` |
| `46016` | Take That! | Event | Pack Position: 16 | - | - | `iceman` |
| `46017` | Looking for Trouble | Event | Pack Position: 17 | - | - | `iceman` |
| `46018` | Keep Up the Pressure | Player Side Scheme | Pack Position: 18 | - | - | `iceman` |
| `46019` | Shadowcat | Ally | Pack Position: 19 | THW:2 ATK:1 HP:3 | - | `iceman` |
| `46020` | Beak | Ally | Pack Position: 20 | THW:1 ATK:1 HP:2 | - | `iceman` |
| `46021` | Team-Building Exercise | Support | Pack Position: 21 | - | - | `iceman` |
| `46022` | Recuperation | Event | Pack Position: 22 | - | - | `iceman` |
| `46023` | The Power in All of Us | Resource | Pack Position: 23 | - | - | `iceman` |
| `46024` | Hot-Headed | Obligation | Iceman | - | 2 icons | `iceman` |
| `46025` | Pyro | Minion | Iceman Nemesis | SCH:1 ATK:3 HP:4 | 3 icons | `iceman` |
| `46026` | Playing with Fire | Side Scheme | Iceman Nemesis | - | 3 icons | `iceman` |
| `46027` | Pyro's Flamethrower | Attachment | Iceman Nemesis | ATK:0 | 2 icons | `iceman` |
| `46028` | Burn! | Treachery | Iceman Nemesis | - | 0 icons + star | `iceman` |
| `46029` | Sauron | Minion | Sauron | SCH:2 ATK:2 HP:6 | 0 icons + star | `iceman` |
| `46030` | Sauron Lives! | Side Scheme | Sauron | - | 3 icons | `iceman` |
| `46031` | Life Drain | Attachment | Sauron | - | 2 icons | `iceman` |
| `46032` | The Eye of Sauron | Treachery | Sauron | - | 1 icon | `iceman` |

---

## Pack: Iceman (`iceman`)

### Set: Iceman

### [46001a] Iceman
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 2, **HP**: 11, **Hand Size**: 5
- **Traits**: *Ice. X-Men.*
- **Rules Text**:
  > *"Freeze!"* — **Interrupt**: When Iceman makes a basic attack or defense against an enemy, attach a set-aside copy of Frostbite to that enemy.
- **Flavor**: *"Here comes the coolest hero on the team!"*
- **Image Asset**: `assets/card-art/bundles/cards/46001a.png` (300×426 px, 198.4 KB)

### [46001b] Bobby Drake
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 11, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > Bobby Drake begins the game with 6 Frostbite upgrades set aside.
  > *Cool Off* — **Response**: After you change to this form, shuffle 1 [[Ice]] card from your discard pile into your deck for each copy of Frostbite in play.
- **Image Asset**: `assets/card-art/bundles/cards/46001b.png` (300×426 px, 199.7 KB)

### [46003] Snow Clone
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (1–2/15, Qty: 2)
- **Stats**: **Cost**: 2, **ATK**: 2 [star] (Consequential: 1), **HP**: 2, **Resources**: [physical]
- **Traits**: *Ice. X-Men.*
- **Rules Text**:
  > Cannot have upgrades attached.
  > [star] Snow Clone takes -1 consequential damage ([cost]) after it attacks an enemy with Frostbite attached.
- **Flavor**: *"You could say he's got an icy demeanor." —Iceman*
- **Image Asset**: `assets/card-art/bundles/cards/46003.png` (710×1030 px, 325.2 KB)

### [46004] Power Belt
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (3/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > You get +3 hit points.
  > **Hero Resource**: Exhaust Power Belt → generate a [wild] resource for an [[Ice]] card.
- **Flavor**: *Beast made this high-tech belt to help Iceman better control his powers.*
- **Image Asset**: `assets/card-art/bundles/cards/46004.jpg` (710×1030 px, 334.3 KB)

### [46005] Cryokinetic Perception
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (4/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Response**: After you resolve your *"Freeze!"* ability, exhaust this card → draw 1 card. If that card has an [[Ice]] trait, ready Iceman.
- **Flavor**: *"Anyone remember when I used to throw snowballs at Magneto?" —Iceman*
- **Image Asset**: `assets/card-art/bundles/cards/46005.png` (710×1030 px, 368.9 KB)

### [46006] Ice Slide
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (5/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Ice. Superpower.*
- **Rules Text**:
  > Iceman gets +1 THW, +1 ATK, and +1 DEF, and gains the [[Aerial]] trait.
  > **Forced Response**: After you change to alter-ego form, shuffle this card into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/46006.png` (710×1030 px, 360.1 KB)

### [46007] Frozen Solid
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (6–7/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Condition. Ice.*
- **Rules Text**:
  > Hero form only. Attach to an enemy. Max 1 per enemy.
  > **Forced Interrupt**: When attached enemy would activate, discard Frozen Solid instead. Then, attach a set-aside copy of Frostbite to that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/46007.jpg` (710×1030 px, 358.5 KB)

### [46008] Ice Wall
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (8/15)
- **Stats**: **Cost**: 4, **Resources**: [physical]
- **Traits**: *Ice.*
- **Rules Text**:
  > **Forced Interrupt**: When an identity would take any amount of damage from an enemy attack, place that damage here instead. Then, if there is at least 8 damage here, discard this card and attach a set-aside copy of Frostbite to the enemy that just attacked.
- **Image Asset**: `assets/card-art/bundles/cards/46008.jpg` (710×1030 px, 394.9 KB)

### [46009] Arctic Attack
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (9–10/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Ice. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Choose:
  > • Deal 4 damage to an enemy and attach a set-aside copy of Frostbite to it.
  > • Deal 6 damage to an enemy with Frostbite attached.
- **Image Asset**: `assets/card-art/bundles/cards/46009.png` (710×1030 px, 326.0 KB)

### [46010] Ice Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (11–12/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Ice. Superpower.*
- **Rules Text**:
  > **Hero Action**: Choose a player. Attach a set-aside copy of Frostbite to the villain and each minion engaged with that player. Deal 3 damage to each enemy with a copy of Frostbite attached.
- **Flavor**: *"Time to put these guys on ice." —Iceman*
- **Image Asset**: `assets/card-art/bundles/cards/46010.jpg` (710×1030 px, 371.3 KB)

### [46011] Chill Out!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (13–15/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Ice. Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. Attach a set-aside copy of Frostbite to an enemy.
- **Flavor**: *"Seriously, dude. I'm all out of ice puns." —Iceman*
- **Image Asset**: `assets/card-art/bundles/cards/46011.png` (710×1030 px, 331.2 KB)

### [46024] Hot-Headed
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iceman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Bobby Drake player.***
  > **Forced Response**: After you attach a Frostbite upgrade to an enemy, take 1 damage.
  > **Alter-Ego Response**: After you make a basic recovery, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/46024.png` (710×1030 px, 339.2 KB)


### Set: Frostbite

### [46002] Frostbite
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Frostbite (1–6/6, Qty: 6)
- **Properties**: Permanent
- **Traits**: *Condition. Ice.*
- **Rules Text**:
  > Permanent.
  > Attached enemy gets -1 SCH and -1 ATK.
  > **Forced Response**: After attached enemy activates or leaves play, set this card aside.
- **Image Asset**: `assets/card-art/bundles/cards/46002.jpg` (710×1030 px, 334.1 KB)


### Set: Aggression

### [46012] Shark-Girl — *Iara Dos Santos*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 0 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > [star] While Shark-Girl is attacking an enemy, she gets +1 ATK for each upgrade attached to that enemy.
- **Flavor**: *The only thing scarier than a ravenous teenager is one who can turn into a shark.*
- **Image Asset**: `assets/card-art/bundles/cards/46012.png` (710×1030 px, 370.5 KB)

### [46013] Glob — *Robert Herman*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Play only if your identity has the [[X-Men]] trait.
  > **Response**: After Glob enters play, deal 2 damage to an enemy with an upgrade attached.
- **Image Asset**: `assets/card-art/bundles/cards/46013.jpg` (710×1030 px, 293.7 KB)

### [46014] Suppressing Fire
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a minion. Max 1 per minion.
  > **Hero Interrupt**: When you attack and defeat attached minion, heal 2 damage from your hero.
- **Image Asset**: `assets/card-art/bundles/cards/46014.png` (710×1030 px, 336.7 KB)

### [46015] Surprise Move
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Interrupt**: When you make a basic attack against an enemy with an upgrade attached, you get +2 ATK for this attack. If this attack defeats that enemy, ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/46015.jpg` (710×1030 px, 298.3 KB)

### [46016] Take That!
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 7 damage to an enemy with an upgrade attached.
- **Flavor**: *"And don't come back!" —Magik*
- **Image Asset**: `assets/card-art/bundles/cards/46016.jpg` (710×1030 px, 352.2 KB)

### [46017] Looking for Trouble
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Discard cards from the top of the encounter deck until you discard a minion. Put that minion into play engaged with you → remove 3 threat from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/46017.png` (710×1030 px, 309.4 KB)

### [46018] Keep Up the Pressure
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Aggression
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 2 per hero, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for an [[Attack]] event and add it to their hand. *(Shuffle.)* Until the end of the phase, each [[Attack]] event deals 1 additional damage.
- **Image Asset**: `assets/card-art/bundles/cards/46018.png` (1030×710 px, 355.0 KB)


### Set: Basic

### [46019] Shadowcat — *Kitty Pryde*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Play only if your identity has the [[X-Men]] trait.
  > **Response**: After you play Shadowcat from your hand, choose a side scheme in play → that scheme loses each [acceleration], [amplify], [crisis], and [hazard] icon until the end of the round.
- **Image Asset**: `assets/card-art/bundles/cards/46019.jpg` (710×1030 px, 383.0 KB)

### [46020] Beak — *Barnell Bohusk*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After you play Beak from your hand, remove 1 threat from a scheme for each [[X-Men]] ally you control.
- **Flavor**: *"I'm not really strong and I don't shoot death-rays, but I am good at making friends."*
- **Image Asset**: `assets/card-art/bundles/cards/46020.jpg` (710×1030 px, 352.7 KB)

### [46021] Team-Building Exercise
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Hero Action**: Exhaust Team-Building Exercise → play a card from your hand that shares a trait with your hero, reducing its resource cost by 1.
- **Flavor**: *"This is why we practice, people!" —Phoenix*
- **Image Asset**: `assets/card-art/bundles/cards/46021.png` (710×1030 px, 327.2 KB)

### [46022] Recuperation
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Rules Text**:
  > **Alter-Ego Action**: Heal damage from your alter-ego equal to your REC.
- **Flavor**: *"You'll be fine." —Dr. Rao*
- **Image Asset**: `assets/card-art/bundles/cards/46022.png` (710×1030 px, 332.3 KB)

### [46023] The Power in All of Us
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates when paying for a Basic (gray) card.
- **Image Asset**: `assets/card-art/bundles/cards/46023.jpg` (710×1030 px, 325.2 KB)


### Set: Iceman Nemesis

### [46025] Pyro
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iceman Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Quickstrike.
  > [star] Pyro's attacks deal indirect damage.
- **Flavor**: *"You think those ice sculptures can stop me?!"*
- **Image Asset**: `assets/card-art/bundles/cards/46025.jpg` (710×1030 px, 284.2 KB)

### [46026] Playing with Fire
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman Nemesis (2/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iceman Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme discards the top 3 cards of their deck and takes 1 indirect damage for each resource icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/46026.jpg` (1030×710 px, 303.2 KB)

### [46027] Pyro's Flamethrower
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman Nemesis (3/5)
- **Stats**: **ATK**: 0 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iceman Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Pyro. Otherwise, this card gains surge.
  > [star] **Forced Interrupt**: When Pyro attacks you, discard the top card of your deck. Pyro gets +1 ATK for this attack for each resource icon on that card.
- **Image Asset**: `assets/card-art/bundles/cards/46027.png` (710×1030 px, 289.6 KB)

### [46028] Burn!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Iceman Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Iceman Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top 2 cards of your deck (3 cards instead if Pyro is in play). Take 1 indirect damage for each resource icon discarded this way.
  >
  > ---
  >
  > [star] **Boost**: Discard the top card of your deck. This card gets +1 boost icon ([boost]) for each resource icon on that card.
- **Image Asset**: `assets/card-art/bundles/cards/46028.png` (710×1030 px, 350.3 KB)


### Set: Sauron

### [46029] Sauron
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Sauron (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sauron Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for the Life Drain attachment and reveal it.
  >
  > ---
  >
  > [star] **Boost**: Heal 3 damage from the activating enemy and give it a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/46029.jpg` (710×1030 px, 300.4 KB)

### [46030] Sauron Lives!
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Sauron (2/6)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sauron Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme searches the encounter deck and discard pile for Sauron and deals him to themself as a facedown encounter card.
- **Flavor**: *When Dr. Lykos absorbs mutant energy, he transforms into the terrifying Sauron!*
- **Image Asset**: `assets/card-art/bundles/cards/46030.png` (1030×710 px, 298.5 KB)

### [46031] Life Drain
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Sauron (3/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sauron Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to the minion with the highest printed hit points. It activates against you. If no minion activated this way, this card gains surge.
  > [star] **Forced Interrupt**: When attached enemy attacks you, take 2 damage and give the attacking enemy a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/46031.jpg` (710×1030 px, 319.3 KB)

### [46032] The Eye of Sauron
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Iceman (`iceman`)
- **Deck / Set**: Sauron (4–6/6, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sauron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top 2 cards of your deck (top 3 cards instead if Sauron is in play). For each resource icon discarded this way, do the following:
  > [energy] — Place 1 threat on the main scheme.
  > [mental] — Discard 1 card from your hand.
  > [physical] — Deal 1 damage to your identity.
  > [wild] — Exhaust a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/46032.jpg` (710×1030 px, 307.5 KB)


