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
| `14001a` | Quicksilver | Hero | Quicksilver | THW:1 ATK:1 DEF:1 HP:9 | - | `qsv` |
| `14001b` | Pietro Maximoff | Alter-Ego | Quicksilver | REC:3 HP:9 | - | `qsv` |
| `14002` | Scarlet Witch | Ally | Quicksilver | THW:1 ATK:1 HP:3 | - | `qsv` |
| `14003` | Always Be Running | Event | Quicksilver | - | - | `qsv` |
| `14004` | Double Time | Event | Quicksilver | - | - | `qsv` |
| `14005` | Maximum Velocity | Event | Quicksilver | - | - | `qsv` |
| `14006` | Speed Cyclone | Event | Quicksilver | - | - | `qsv` |
| `14007` | Serval Industries | Support | Quicksilver | - | - | `qsv` |
| `14008` | Accelerated Reflex | Upgrade | Quicksilver | - | - | `qsv` |
| `14009` | Friction Resistance | Upgrade | Quicksilver | - | - | `qsv` |
| `14010` | Hyper Perception | Upgrade | Quicksilver | - | - | `qsv` |
| `14011` | Reinforced Sinew | Upgrade | Quicksilver | - | - | `qsv` |
| `14012` | Multiple Man | Ally | Pack Position: 12 | THW:1 ATK:1 HP:2 | - | `qsv` |
| `14013` | Warlock | Ally | Pack Position: 13 | THW:1 ATK:1 HP:3 | - | `qsv` |
| `14014` | Never Back Down | Event | Pack Position: 14 | - | - | `qsv` |
| `14015` | Side Step | Event | Pack Position: 15 | - | - | `qsv` |
| `14016` | Armored Vest | Upgrade | Pack Position: 16 | - | - | `qsv` |
| `14017` | Nerves of Steel | Upgrade | Pack Position: 17 | - | - | `qsv` |
| `14018` | Order and Chaos | Event | Pack Position: 18 | - | - | `qsv` |
| `14019` | Energy | Resource | Pack Position: 19 | - | - | `qsv` |
| `14020` | Genius | Resource | Pack Position: 20 | - | - | `qsv` |
| `14021` | Strength | Resource | Pack Position: 21 | - | - | `qsv` |
| `14022` | Adrenaline Rush | Upgrade | Pack Position: 22 | - | - | `qsv` |
| `14023` | Civic Duty | Upgrade | Pack Position: 23 | - | - | `qsv` |
| `14024` | Need for Speed | Obligation | Quicksilver | - | 2 icons | `qsv` |
| `14025` | Extortion of Seismic Proportion | Side Scheme | Quicksilver Nemesis | - | 3 icons | `qsv` |
| `14026` | Avalanche | Minion | Quicksilver Nemesis | SCH:1 ATK:2 HP:4 | 2 icons | `qsv` |
| `14027` | Vibration Resistance | Attachment | Quicksilver Nemesis | - | 1 icon | `qsv` |
| `14028` | Earthquake | Treachery | Quicksilver Nemesis | - | 0 icons + star | `qsv` |
| `14029` | Brute Force | Upgrade | Pack Position: 29 | - | - | `qsv` |
| `14030` | Sense of Justice | Upgrade | Pack Position: 30 | - | - | `qsv` |
| `14031` | United We Stand | Event | Pack Position: 31 | - | - | `qsv` |
| `14032` | Beat 'Em Up | Event | Pack Position: 32 | - | - | `qsv` |

---

## Pack: Quicksilver (`qsv`)

### Set: Quicksilver

### [14001a] Quicksilver
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 1, **HP**: 9, **Hand Size**: 5
- **Traits**: *Avenger.*
- **Rules Text**:
  > *Super Speed* — **Response:** After you use one of Quicksilver's basic powers *(THW, ATK, or DEF),* ready him. (Limit once per phase.)
- **Flavor**: *"Super speed. Look it up."*
- **Image Asset**: `assets/card-art/bundles/cards/14001a.png` (300×419 px, 45.0 KB)

### [14001b] Pietro Maximoff
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > *Superpowered Siblings* — **Action:** Discard 2 cards from your hand → draw 2 cards (draw 3 cards instead if Wanda Maximoff is in play). (Limit once per round.)

### [14002] Scarlet Witch — *Wanda Maximoff*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Interrupt:** When you use one of Scarlet Witch's basic powers, discard the top card of the encounter deck. For each boost icon discarded this way, Scarlet Witch gets +1 to that power for this use.
- **Image Asset**: `assets/card-art/bundles/cards/14002.png` (300×419 px, 41.1 KB)

### [14003] Always Be Running
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (2–5/15, Qty: 4)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action:** Ready Quicksilver.
- **Flavor**: *"I'm the fastest man on Earth." —Quicksilver*
- **Image Asset**: `assets/card-art/bundles/cards/14003.png` (300×419 px, 37.8 KB)

### [14004] Double Time
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (6–7/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Choose two of the following (you may choose the same option twice):
  > - Deal 2 damage to an enemy.
  > - Remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/14004.png` (300×419 px, 42.5 KB)

### [14005] Maximum Velocity
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (8–9/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Max 1 per phase.
  > **Hero Action:** You get +2 THW, +2 ATK, and +2 DEF until the end of the round.
- **Flavor**: *"Ever been punched at supersonic speed?" —Quicksilver*
- **Image Asset**: `assets/card-art/bundles/cards/14005.png` (300×419 px, 44.0 KB)

### [14006] Speed Cyclone
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (10/15)
- **Stats**: **Cost**: -1, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action:** Stun X Enemies.
- **Flavor**: *"Eat my dust." —Quicksilver*
- **Image Asset**: `assets/card-art/bundles/cards/14006.png` (300×419 px, 33.8 KB)

### [14007] Serval Industries
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location. X-Factor.*
- **Rules Text**:
  > **Alter-Ego Action:** Exhaust Serval Industries → shuffle 2 Quicksilver cards from your discard pile into your deck.
- **Flavor**: *Corporate sponsors of the superhero team known as X-Factor.*
- **Image Asset**: `assets/card-art/bundles/cards/14007.png` (300×419 px, 42.3 KB)

### [14008] Accelerated Reflex
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (12/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Condition. Superpower.*
- **Rules Text**:
  > Quicksilver gets +1 DEF.
- **Flavor**: *"Is that all you got?" —Quicksilver*
- **Image Asset**: `assets/card-art/bundles/cards/14008.png` (300×419 px, 41.4 KB)

### [14009] Friction Resistance
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (13/15)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Condition. Superpower.*
- **Rules Text**:
  > **Hero Response:** After you ready Quicksilver, ready this card.
  > **Resource:** Exhaust Friction Resistance → generate a [physical] resource.
- **Image Asset**: `assets/card-art/bundles/cards/14009.png` (300×419 px, 42.7 KB)

### [14010] Hyper Perception
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (14/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Condition. Superpower.*
- **Rules Text**:
  > Quicksilver gets +1 THW.
- **Flavor**: *"Surely you can do better than that." —Quicksilver*
- **Image Asset**: `assets/card-art/bundles/cards/14010.png` (300×419 px, 37.5 KB)

### [14011] Reinforced Sinew
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (15/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition. Superpower.*
- **Rules Text**:
  > Quicksilver gets +1 ATK.
- **Flavor**: *"The future is written by the winners." —Quicksilver*
- **Image Asset**: `assets/card-art/bundles/cards/14011.png` (300×419 px, 34.7 KB)

### [14024] Need for Speed
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Quicksilver Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Pietro Maximoff player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Pietro Maximoff → remove Need for Speed from the game.
  > • Exhaust your identity. You cannot ready your identity until your next turn ends. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/14024.png` (300×419 px, 40.6 KB)


### Set: Protection

### [14012] Multiple Man
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 12
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *X-Factor.*
- **Rules Text**:
  > **Response**: After Multiple Man enters play, search your deck and hand for a copy of Multiple Man and put it into play. Shuffle your deck if it was searched this way.
- **Flavor**: *"Who wants a sandwich?!"*
- **Image Asset**: `assets/card-art/bundles/cards/14012.png` (300×419 px, 38.6 KB)

### [14013] Warlock
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *X-Factor.*
- **Rules Text**:
  > **Action:** Spend a [mental] resource → heal up to 2 damage from Warlock.
- **Flavor**: *"Self thinks this is a mistake. But then, self is very young and knows very little."*
- **Image Asset**: `assets/card-art/bundles/cards/14013.png` (300×419 px, 39.6 KB)

### [14014] Never Back Down
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you defend against an attack, you get +2 DEF for this attack. If you take no damage from this attack, stun the attacking enemy.
- **Flavor**: *"Champions, charge!" —Ms. Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/14014.png` (300×419 px, 40.9 KB)

### [14015] Side Step
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you would take any amount of damage, prevent 3 of that damage. If you paid for this card using [energy] resource, deal 1 damage to that enemy.
- **Flavor**: *"Missed me!" —Wasp*
- **Image Asset**: `assets/card-art/bundles/cards/14015.png` (300×419 px, 34.5 KB)

### [14016] Armored Vest
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 DEF.
- **Flavor**: *Life-saving and stylish.*

### [14017] Nerves of Steel
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control.
  > Max 1 per player.
  > **Resource**: Exhaust Nerves of Steel → generate a [energy] resource for a [[Defense]] event.
- **Image Asset**: `assets/card-art/bundles/cards/14017.png` (300×419 px, 34.2 KB)


### Set: Basic

### [14018] Order and Chaos
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Rules Text**:
  > Team-Up (Quicksilver and Scarlet Witch). Max 1 per deck.
  > **Hero Interrupt**: When a treachery card is revealed from the encounter deck, cancel its "**When Revealed**" effects, then deal 2 damage to the villain.
- **Image Asset**: `assets/card-art/bundles/cards/14018.png` (300×419 px, 35.0 KB)

### [14019] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [14020] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [14021] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [14022] Adrenaline Rush
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Hero Action**: Discard Adrenaline Rush → your hero gets +1 ATK until the end of the phase.
- **Flavor**: *"Wow, lady! And I thought Gamora was intense." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/14022.png` (300×419 px, 36.0 KB)

### [14023] Civic Duty
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action:** Discard Civic Duty → your hero gets +1 THW until the end of the phase.
- **Flavor**: *"Please stay calm! Everything will be okay!" —Ms. Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/14023.png` (300×419 px, 40.2 KB)

### [14032] Beat 'Em Up
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Deal 1 damage to the villain and each minion engaged with you.
- **Flavor**: *"too easy." —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/14032.png` (300×419 px, 35.6 KB)


### Set: Quicksilver Nemesis

### [14025] Extortion of Seismic Proportion
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver Nemesis (1/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Quicksilver Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Incite 1. *(When revealed, place 1 threat on the main scheme.)*
- **Image Asset**: `assets/card-art/bundles/cards/14025.png` (419×300 px, 36.2 KB)

### [14026] Avalanche
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Quicksilver Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Incite 2. *(When revealed, place 2 threat on the main scheme.)*
  > **When Revealed:** Each player must choose to either take 2 indirect damage or exhaust their identity.
  > *(Quicksilver's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/14026.png` (300×419 px, 44.6 KB)

### [14027] Vibration Resistance
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Quicksilver Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Avalanche, if able. If you cannot, attach to the villain.
  > Reduce the damage attached enemy takes from each attack by 1.
  > **Hero Action**: Exhaust your hero → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/14027.png` (300×419 px, 43.0 KB)

### [14028] Earthquake
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Quicksilver Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Quicksilver Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1. *(When revealed, place 1 threat on the main scheme.)*
  > **When Revealed**: Discard 2 cards from your hand and exhaust your identity.
  >
  > ---
  >
  > [star] **Boost**: Choose to either spend [physical] [physical] resources or exhaust your identity.
- **Image Asset**: `assets/card-art/bundles/cards/14028.png` (300×419 px, 43.5 KB)


### Set: Aggression

### [14029] Brute Force
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > Your hero gets +1 ATK. Your basic attacks gain piercing. *(Discard any tough status cards from the target before dealing damage.)*
  > **Forced Response**: After you make a basic attack, discard Brute Force.
- **Image Asset**: `assets/card-art/bundles/cards/14029.png` (300×419 px, 42.8 KB)


### Set: Justice

### [14030] Sense of Justice
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control.
  > Max 1 per player.
  > **Resource:** Exhaust Sense of Justice → generate a [mental] resource for a [[Thwart]] event.
- **Image Asset**: `assets/card-art/bundles/cards/14030.png` (300×419 px, 34.9 KB)


### Set: Leadership

### [14031] United We Stand
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Quicksilver (`qsv`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > **Hero Action:** Heal 1 damage from up to X friendly characters (to a maximum of 3 characters), where X is equal to the villain's stage number.
- **Image Asset**: `assets/card-art/bundles/cards/14031.png` (300×419 px, 37.0 KB)


