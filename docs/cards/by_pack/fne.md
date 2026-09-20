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
| `60001a` | Daredevil | Hero | Daredevil | THW:1 ATK:2 DEF:2 HP:10 | - | `fne` |
| `60001b` | Matt Murdock | Alter-Ego | Daredevil | HP:10 | - | `fne` |
| `60002` | Acute Tactility | Upgrade | Sense Deck | - | - | `fne` |
| `60003` | Enhanced Olfaction | Upgrade | Sense Deck | - | - | `fne` |
| `60004` | Heightened Hearing | Upgrade | Sense Deck | - | - | `fne` |
| `60005` | Radar Sense | Upgrade | Sense Deck | - | - | `fne` |
| `60006` | Superior Taste | Upgrade | Sense Deck | - | - | `fne` |
| `60007` | Elektra | Ally | Daredevil | THW:1 ATK:2 HP:3 | - | `fne` |
| `60008` | Cross-Examination | Event | Daredevil | - | - | `fne` |
| `60009` | Deposition | Event | Daredevil | - | - | `fne` |
| `60010` | Living Lie Detector | Event | Daredevil | - | - | `fne` |
| `60011` | Raising Hell | Event | Daredevil | - | - | `fne` |
| `60012` | Focus the Senses | Player Side Scheme | Daredevil | - | - | `fne` |
| `60013` | Foggy Nelson | Support | Daredevil | - | - | `fne` |
| `60014` | Karen Page | Support | Daredevil | - | - | `fne` |
| `60015` | Nelson and Murdock | Support | Daredevil | - | - | `fne` |
| `60016` | Sister Maggie | Support | Daredevil | - | - | `fne` |
| `60017` | Daredevil's Billy Club | Upgrade | Daredevil | - | - | `fne` |
| `60018` | The Man Without Fear | Upgrade | Daredevil | - | - | `fne` |
| `60019` | Blindspot | Ally | Pack Position: 19 | THW:2 ATK:2 HP:3 | - | `fne` |
| `60020` | Cloak | Ally | Pack Position: 20 | THW:2 ATK:1 HP:2 | - | `fne` |
| `60021` | Dagger | Ally | Pack Position: 21 | THW:1 ATK:2 HP:3 | - | `fne` |
| `60022` | Ghost Rider | Ally | Pack Position: 22 | THW:1 ATK:2 HP:3 | - | `fne` |
| `60023` | Know Your Enemy | Event | Pack Position: 23 | - | - | `fne` |
| `60024` | De-escalation | Player Side Scheme | Pack Position: 24 | - | - | `fne` |
| `60025` | Chance Encounter | Upgrade | Pack Position: 25 | - | - | `fne` |
| `60026` | Legal Trouble | Upgrade | Pack Position: 26 | - | - | `fne` |
| `60027` | Move in Shadow | Upgrade | Pack Position: 27 | - | - | `fne` |
| `60028` | Stealth Training | Upgrade | Pack Position: 28 | - | - | `fne` |
| `60029` | Stick | Support | Pack Position: 29 | - | - | `fne` |
| `60030` | Contingency Planning | Upgrade | Pack Position: 30 | - | - | `fne` |
| `60031` | Dance with the Devil | Upgrade | Pack Position: 31 | - | - | `fne` |
| `60032` | Sensory Overload | Obligation | Daredevil | - | 2 pips | `fne` |
| `60033` | Bullseye | Minion | Daredevil Nemesis | SCH:1 ATK:3 HP:5 | 3 pips | `fne` |
| `60034` | Deadliest Man Alive | Side Scheme | Daredevil Nemesis | - | 2 pips | `fne` |
| `60035` | Stolen Sai | Attachment | Daredevil Nemesis | ATK:1 | 1 pips | `fne` |
| `60036` | Eye on the Target | Treachery | Daredevil Nemesis | - | 2 pips | `fne` |
| `60037a` | Echo | Hero | Echo | THW:2 ATK:2 DEF:2 HP:9 | - | `fne` |
| `60037b` | Maya Lopez | Alter-Ego | Echo | HP:9 | - | `fne` |
| `60038` | Innate Reflexes | Upgrade | Pack Position: 38 | - | - | `fne` |
| `60039` | Daredevil | Ally | Echo | THW:2 ATK:2 HP:3 | - | `fne` |
| `60040a` | Photographic Reflexes | Event | Echo | - | - | `fne` |
| `60040b` | Photographic Reflexes | Event | Echo | - | - | `fne` |
| `60040c` | Photographic Reflexes | Event | Echo | - | - | `fne` |
| `60041` | Study the Tape | Event | Echo | - | - | `fne` |
| `60042` | The Rez | Support | Echo | - | - | `fne` |
| `60043` | American Sign Language | Upgrade | Echo | - | - | `fne` |
| `60044` | Choreography | Upgrade | Echo | - | - | `fne` |
| `60045` | Echo's Katana | Upgrade | Echo | - | - | `fne` |
| `60046` | Improvisation | Upgrade | Echo | - | - | `fne` |
| `60047` | Muscle Memory | Upgrade | Echo | - | - | `fne` |
| `60048` | Army of One | Event | Pack Position: 48 | - | - | `fne` |
| `60049` | Get Their Attention | Event | Pack Position: 49 | - | - | `fne` |
| `60050` | In Harm's Way | Event | Pack Position: 50 | - | - | `fne` |
| `60051` | Powerful Punch | Event | Pack Position: 51 | - | - | `fne` |
| `60052` | The Best Offense... | Upgrade | Pack Position: 52 | - | - | `fne` |
| `60053` | Ronin | Upgrade | Pack Position: 53 | - | - | `fne` |
| `60054` | Stand Alone | Upgrade | Pack Position: 54 | - | - | `fne` |
| `60055` | See No Evil, Hear No Evil | Event | Pack Position: 55 | - | - | `fne` |
| `60056` | Superpower Training | Player Side Scheme | Pack Position: 56 | - | - | `fne` |
| `60057` | Energy | Resource | Pack Position: 57 | - | - | `fne` |
| `60058` | Genius | Resource | Pack Position: 58 | - | - | `fne` |
| `60059` | Strength | Resource | Pack Position: 59 | - | - | `fne` |
| `60060` | Raised by the Kingpin | Obligation | Echo | - | 2 pips | `fne` |
| `60061` | Kingpin | Minion | Echo Nemesis | SCH:3 ATK:2 HP:6 | 3 pips | `fne` |
| `60062` | Master Manipulator | Side Scheme | Echo Nemesis | - | Star | `fne` |
| `60063` | Kingpin's Henchman | Minion | Echo Nemesis | SCH:1 ATK:2 HP:4 | 1 pips | `fne` |
| `60064` | Pawn of the Kingpin | Treachery | Echo Nemesis | - | 2 pips | `fne` |

---

## Pack: Fear No Evil (`fne`)

### Set: Daredevil

### [60001a] Daredevil
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > *Superhuman Senses* — **Action**: Play the top card of the [[Sense]] deck as if it were in your hand *(paying its cost)*.
- **Image Asset**: `assets/card-art/bundles/cards/60001a.png` (300×426 px, 252.3 KB)
### [60001b] Matt Murdock
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Attorney.*
- **Rules Text**:
  > Matt Murdock begins the game with a [[Sense]] deck. *(See rulebook p. 26.)*
  > **Forced Interrupt**: When a [[Sense]] upgrade would leave play, place it on the bottom of the [[Sense]] deck instead.
- **Image Asset**: `assets/card-art/bundles/cards/60001b.png` (300×426 px, 226.0 KB)
### [60007] Elektra — *Elektra Natchios*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > [star] **Forced Interrupt (Hero)**: When Elektra would take consequential damage, Daredevil takes that damage instead.
- **Flavor**: *"I don't need your protection, Matt."*
- **Image Asset**: `assets/card-art/bundles/cards/60007.png` (710×1030 px, 326.4 KB)
### [60008] Cross-Examination
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (2–3/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. For each upgrade attached to that enemy, you may deal 1 additional damage to it.
- **Flavor**: *"No further questions, punk." —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/60008.png` (710×1030 px, 332.6 KB)
### [60009] Deposition
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (4–5/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Alter-Ego Action** *(thwart)*: You may choose any upgrade from the [[Sense]] deck and play it, ignoring its resource cost. *(Do not shuffle.)* Remove 2 threat from a scheme.
- **Flavor**: *"Tell us everything." —Matt Murdock*
- **Image Asset**: `assets/card-art/bundles/cards/60009.jpg` (710×1030 px, 322.3 KB)
### [60010] Living Lie Detector
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (6–7/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Action** *(thwart)*: Remove 2 threat from a scheme. For each upgrade attached to that scheme, you may remove 1 additional threat from it.
- **Flavor**: *Thump-Thump     Thump-Thump    Thump-Thump   Thump-Thump  Thump-Thump Thump-Thump*
- **Image Asset**: `assets/card-art/bundles/cards/60010.png` (710×1030 px, 347.4 KB)
### [60011] Raising Hell
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (8/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to each enemy for each upgrade attached to that enemy (3 damage instead if Daredevil has the [[Aerial]] trait).
- **Flavor**: *"I cannot see the light. So I will be the light. I am Daredevil, and I am not afraid." —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/60011.jpg` (710×1030 px, 293.6 KB)
### [60012] Focus the Senses
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 4, **Resources**: [mental]
- **Rules Text**:
  > Threat cannot be removed from this scheme except by Daredevil or Matt Murdock.
  > **When Defeated**: You may move any number of [[Sense]] upgrades in play to other cards they can attach to. Choose any number of upgrades from the [[Sense]] deck and put them into play. *(Do not shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/60012.jpg` (1030×710 px, 283.3 KB)
### [60013] Foggy Nelson
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attorney. Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Foggy Nelson → remove 2 threat from a scheme.
- **Flavor**: *"Everything's okay now, Matt! Ol' Fog is on it!"*
- **Image Asset**: `assets/card-art/bundles/cards/60013.png` (710×1030 px, 319.6 KB)
### [60014] Karen Page
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Action**: Exhaust Karen Page → shuffle 1 Daredevil card from your discard pile into your deck. If you are in alter-ego form, draw 1 card.
- **Flavor**: *"What would you boys do without me?"*
- **Image Asset**: `assets/card-art/bundles/cards/60014.jpg` (710×1030 px, 349.9 KB)
### [60015] Nelson and Murdock
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (12/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > **Response**: After an [[Attorney]] character or support defeats a side scheme, confuse an enemy.
- **Flavor**: *"Let's see them pull off their heist with their vehicle impounded." —Matt Murdock*
- **Image Asset**: `assets/card-art/bundles/cards/60015.png` (710×1030 px, 310.9 KB)
### [60016] Sister Maggie
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > Matt Murdock gets +3 REC.
  > **Response**: After you recover, discard a status card from your identity.
- **Flavor**: *As both a Catholic nun and Matt's mother, Sister Maggie often nurses her son back to health.*
- **Image Asset**: `assets/card-art/bundles/cards/60016.png` (710×1030 px, 332.0 KB)
### [60017] Daredevil's Billy Club
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (14/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Item. Weapon.*
- **Rules Text**:
  > Restricted. Daredevil gets +1 ATK.
  > **Hero Action**: Return this card to your hand *(from play)* → choose:
  > • Deal 1 damage to an enemy.
  > • Daredevil gains the [[Aerial]] trait until the end of the round.
- **Image Asset**: `assets/card-art/bundles/cards/60017.jpg` (710×1030 px, 337.4 KB)
### [60018] The Man Without Fear
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > **Hero Action**: Exhaust this card and deal 1 damage to Daredeveil → choose:
  > • Choose any upgrade from the [[Sense]] deck and play it, ignoring its resource cost. *(Do not shuffle.)*
  > • Ready Daredevil.
- **Image Asset**: `assets/card-art/bundles/cards/60018.jpg` (710×1030 px, 303.9 KB)
### [60032] Sensory Overload
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Daredevil Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Matt Murdock player.***
  > **Forced Response**: After a [[Sense]] upgrade enters play, take 1 damage.
  > **Alter-Ego Response**: After you recover, discard this card.
- **Flavor**: *Daredevil's heightened senses make him vulnerable to intense stimuli.*
- **Image Asset**: `assets/card-art/bundles/cards/60032.png` (710×1030 px, 309.2 KB)

### Set: Sense Deck

### [60002] Acute Tactility
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (1/5)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to an enemy or scheme.
  > **Interrupt**: When you defeat attached enemy or remove the last threat from attached scheme, discard this card → ready your identity.
- **Image Asset**: `assets/card-art/bundles/cards/60002.png` (710×1030 px, 330.5 KB)
### [60003] Enhanced Olfaction
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (2/5)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to an enemy or scheme.
  > **Interrupt**: When you defeat attached enemy or remove the last threat from attached scheme, discard this card → reduce the cost of the next card you play this phase by 2.
- **Image Asset**: `assets/card-art/bundles/cards/60003.jpg` (710×1030 px, 337.6 KB)
### [60004] Heightened Hearing
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (3/5)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to an enemy.
  > **Hero Interrupt** *(defense)*: When attached enemy attacks, discard this card → that enemy gets -3 ATK for that attack. *(You become the target of that attack.)*
- **Image Asset**: `assets/card-art/bundles/cards/60004.png` (710×1030 px, 346.8 KB)
### [60005] Radar Sense
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (4/5)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to an enemy.
  > **Response** *(attack)*: After you attack attached enemy, discard this card → deal 3 damage to that enemy.
- **Flavor**: *The accident that cost Matt his eyesight gave him a new, radar-like sense.*
- **Image Asset**: `assets/card-art/bundles/cards/60005.jpg` (710×1030 px, 341.4 KB)
### [60006] Superior Taste
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (5/5)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to a scheme.
  > **Response** *(thwart)*: After you thwart attached scheme, discard this card → remove 2 threat from that scheme.
- **Image Asset**: `assets/card-art/bundles/cards/60006.jpg` (710×1030 px, 325.7 KB)

### Set: Justice

### [60019] Blindspot — *Sam Chung*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Genius. Martial Artist.*
- **Rules Text**:
  > [star] **Response**: After Blindspot thwarts, confuse an enemy with an upgrade attached.
- **Flavor**: *"I'm invisible, but I'm still here. Chinatown is where I live and I'm going to protect it."*
- **Image Asset**: `assets/card-art/bundles/cards/60019.png` (710×1030 px, 291.8 KB)
### [60020] Cloak — *Tyrone Johnson*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2, **ATK**: 1, **HP**: 2, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Defender.*
- **Rules Text**:
  > **Action**: Exhaust Cloak and spend [energy] [energy] resources → find Dagger and put her into play.
- **Image Asset**: `assets/card-art/bundles/cards/60020.png` (710×1030 px, 243.5 KB)
### [60021] Dagger — *Tandy Bowen*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 2), **ATK**: 2 [star] (Consequential: 2), **HP**: 3, **Resources**: [energy]
- **Traits**: *Defender.*
- **Rules Text**:
  > Cloak loses each [acceleration] icon.
  > [star] If Cloak is in play, Dagger takes -1 consequential damage after she uses a basic power.
- **Flavor**: *"I'll be the light in your dark, Ty."*
- **Image Asset**: `assets/card-art/bundles/cards/60021.jpg` (710×1030 px, 294.5 KB)
### [60022] Ghost Rider — *Johnny Blaze*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Midnight Sun.*
- **Rules Text**:
  > [star] **Interrupt**: When Ghost Rider attacks an enemy, spend a [energy] resource ([energy] [energy] resources instead if that enemy is the villain) → confuse that enemy.
- **Flavor**: *"My penance stare reveals all of your past sins!"*
- **Image Asset**: `assets/card-art/bundles/cards/60022.jpg` (710×1030 px, 337.4 KB)
### [60023] Know Your Enemy
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > [star] Discount 1 ([[Martial Artist]]).
  > **Hero Action** *(thwart)*: Remove 1 threat from a scheme. Remove 1 threat from a scheme.
- **Flavor**: *"I don't need to see you to know your next move." —Iron Fist*
- **Image Asset**: `assets/card-art/bundles/cards/60023.png` (710×1030 px, 298.9 KB)
### [60024] De-escalation
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 24
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 4, **Resources**: [physical]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Remove an acceleration token from play.
- **Flavor**: *"I can see my house from here!" —Civilian*
- **Image Asset**: `assets/card-art/bundles/cards/60024.jpg` (1030×710 px, 284.5 KB)
### [60025] Chance Encounter
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to a side scheme. Max 1 per scheme.
  > **Interrupt:** When attached side scheme is defeated, search your deck and discard pile for an ally and add it to your hand. Shuffle your deck.
### [60026] Legal Trouble
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > [star] Discount 1 ([[Attorney]] or [[Police]]).
  > Attach to a minion. Max 1 per minion.
  > Attached minion gets -2 SCH.
- **Flavor**: *"You got a permit for that?" —Police officer*
- **Image Asset**: `assets/card-art/bundles/cards/60026.png` (710×1030 px, 312.6 KB)
### [60027] Move in Shadow
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > [star] Discount 1 ([[Martial Artist]] or [[Spy]]).
  > Temporary. Max 1 per player.
  > **Response** *(thwart)*: After you play a card *(including this one)*, remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/60027.jpg` (710×1030 px, 316.4 KB)
### [60028] Stealth Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Response**: After you thwart and exactly defeat a side scheme, exhaust Stealth Training → stun an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/60028.jpg` (710×1030 px, 311.9 KB)

### Set: Basic

### [60029] Stick
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 29
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Martial Artist. Persona.*
- **Rules Text**:
  > **Interrupt**: When a friendly [[Martial Artist]] character uses a basic power, choose:
  > • Exhaust Stick → that character gets +1 to that basic power for this use.
  > • That character gets -1 to that basic power for this use. Ready Stick.
- **Image Asset**: `assets/card-art/bundles/cards/60029.png` (710×1030 px, 345.5 KB)
### [60030] Contingency Planning
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Max 1 per player.
  > You may play the upgrade tucked here as if it were in your hand.
  > **Action**: Choose 1 upgrade in your hand that can attach to a minion or side scheme. Tuck that upgrade under here (to a maximum of 1).
- **Image Asset**: `assets/card-art/bundles/cards/60030.jpg` (710×1030 px, 357.3 KB)
### [60031] Dance with the Devil
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Dance.*
- **Rules Text**:
  > Team-Up (Daredevil and Elektra). Max 1 per deck.
  > Attach to an enemy.
  > **Hero Action** *(attack)*: Discard this card → deal 3 damage to attached enemy.
- **Image Asset**: `assets/card-art/bundles/cards/60031.png` (710×1030 px, 261.5 KB)
### [60055] See No Evil, Hear No Evil
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 55
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > Team-Up (Daredevil and Echo). Max 1 per deck.
  > **Hero Action** *(attack/thwart)*: Choose 2 of the following (you may choose the same option twice):
  > • Deal 3 damage to an enemy.
  > • Remove 3 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/60055.jpg` (710×1030 px, 320.8 KB)
### [60056] Superpower Training
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 56
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 3 per hero, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for an identity-specific upgrade and put it into play. *(Shuffle.)*
- **Flavor**: *"Eat light daggers, you purple punk!" —Dagger*
- **Image Asset**: `assets/card-art/bundles/cards/60056.jpg` (1030×710 px, 297.4 KB)
### [60057] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 57
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/60057.png` (710×1030 px, 332.4 KB)
### [60058] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 58
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/60058.png` (710×1030 px, 341.0 KB)
### [60059] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 59
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/60059.jpg` (710×1030 px, 332.0 KB)

### Set: Daredevil Nemesis

### [60033] Bullseye
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Daredevil Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin.*
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Discard a [[Persona]] support you control.
  > • Bullseye attacks you *(even in alter-ego form)*.
- **Flavor**: *"In my hands, anything is a deadly weapon!"*
- **Image Asset**: `assets/card-art/bundles/cards/60033.jpg` (710×1030 px, 294.4 KB)
### [60034] Deadliest Man Alive
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil Nemesis (2/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Daredevil Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **Forced Interrupt**: When Bullseye attacks, give him a facedown boost card.
- **Flavor**: *"C'mon, Hornhead, let's give the people a show!" —Bullseye*
- **Image Asset**: `assets/card-art/bundles/cards/60034.png` (1030×710 px, 306.1 KB)
### [60035] Stolen Sai
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil Nemesis (3/5)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Daredevil Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to the enemy with the highest ATK.
  > [star] Attached character's attacks gain piercing.
  > **Hero Action**: Spend [physical] [physical] resources → choose to either attach this card to Elektra or discard it.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/60035.jpg` (710×1030 px, 324.7 KB)
### [60036] Eye on the Target
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Daredevil Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Remove an ally or [[Persona]] support you control from the game.
  > • Bullseye attacks you *(even in alter-ego form)*. If he is not in play, find him and reveal him.
- **Flavor**: *"Catch!" —Bullseye*
- **Image Asset**: `assets/card-art/bundles/cards/60036.jpg` (710×1030 px, 250.9 KB)

### Set: Echo

### [60037a] Echo
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 9, **Hand Size**: 5
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > *Watch and Learn* — **Response**: After a player plays an aspect or basic event, tuck that event under here from that player's discard pile. Then, if there are more than 3 tucked cards here, discard all but 3 of those cards.
- **Image Asset**: `assets/card-art/bundles/cards/60037a.png` (300×426 px, 231.7 KB)
### [60037b] Maya Lopez
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > *Practice Makes Perfect* — **Interrupt**: When you change to hero form, search your deck for an aspect or basic event and add it to your hand. *(Shuffle.)*
- **Flavor**: *Maya can recreate any physical movement she sees.*
- **Image Asset**: `assets/card-art/bundles/cards/60037b.png` (300×426 px, 196.7 KB)
### [60039] Daredevil — *Matt Murdock*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > [star] **Response**: After Daredevil uses a basic power, reduce the cost of the next event you play this round by 1.
- **Flavor**: *"Follow my lead."*
- **Image Asset**: `assets/card-art/bundles/cards/60039.jpg` (710×1030 px, 298.8 KB)
### [60040a] Photographic Reflexes
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (2–3/15, Qty: 2)
- **Stats**: **Cost**: -1, **Resources**: [energy]
- **Rules Text**:
  > [star] If you are in hero form, you can discard Photographic Reflexes from your hand to play an event tucked under Echo as if it were in your hand. Reduce the cost to play that event by 2. You cannot trigger Echo's *"Watch and Learn"* ability for that event.
- **Image Asset**: `assets/card-art/bundles/cards/60040a.png` (289×419 px, 235.9 KB)
### [60040b] Photographic Reflexes
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (4–5/15, Qty: 2)
- **Stats**: **Cost**: -1, **Resources**: [mental]
- **Rules Text**:
  > [star] If you are in hero form, you can discard Photographic Reflexes from your hand to play an event tucked under Echo as if it were in your hand. Reduce the cost to play that event by 2. You cannot trigger Echo's *"Watch and Learn"* ability for that event.
- **Image Asset**: `assets/card-art/bundles/cards/60040b.png` (289×419 px, 235.2 KB)
### [60040c] Photographic Reflexes
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (6–7/15, Qty: 2)
- **Stats**: **Cost**: -1, **Resources**: [physical]
- **Rules Text**:
  > [star] If you are in hero form, you can discard Photographic Reflexes from your hand to play an event tucked under Echo as if it were in your hand. Reduce the cost to play that event by 2. You cannot trigger Echo's *"Watch and Learn"* ability for that event.
- **Image Asset**: `assets/card-art/bundles/cards/60040c.png` (289×419 px, 237.1 KB)
### [60041] Study the Tape
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (8–9/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Action**: Search any player's discard pile for 1 aspect event, 1 basic event, or 1 copy of Photographic Reflexes and add that card to your hand.
- **Flavor**: *"I watch tape after tape to train for a fight." —Echo*
- **Image Asset**: `assets/card-art/bundles/cards/60041.jpg` (710×1030 px, 317.3 KB)
### [60042] The Rez
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust The Rez → heal X damage from Maya Lopez, where X is the highest cost among cards tucked under her.
- **Flavor**: *The Rez is not a real reservation or Native nation, but a place for all tribes.*
- **Image Asset**: `assets/card-art/bundles/cards/60042.jpg` (710×1030 px, 354.6 KB)
### [60043] American Sign Language
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (11/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Resource**: Exhaust this card → generate a [wild] resource for an event being played by any player.
- **Flavor**: *<Need help?>* —Echo
*Translated from ASL.*
- **Image Asset**: `assets/card-art/bundles/cards/60043.png` (710×1030 px, 355.5 KB)
### [60044] Choreography
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (12/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Action**: Exhaust this card → shuffle 1 aspect or basic event from your discard pile into your deck. If you are in alter-ego form, draw 1 card.
- **Flavor**: *Maya uses her physical gifts to express herself in dance.*
- **Image Asset**: `assets/card-art/bundles/cards/60044.jpg` (710×1030 px, 250.7 KB)
### [60045] Echo's Katana
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Response** *(attack)*: After you play an event, exhaust Echo's Katana → deal damage to an enemy equal to that event's printed cost. This attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/60045.png` (710×1030 px, 343.2 KB)
### [60046] Improvisation
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (14/15)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Response**: After you play an event, if it has the following traits:
  > • [[Attack]] — heal 1 damage from Echo.
  > • [[Defense]] — remove 1 threat from a scheme.
  > • [[Thwart]] — deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/60046.png` (710×1030 px, 280.5 KB)
### [60047] Muscle Memory
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (15/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action**: Exhaust this card → add an event tucked under Echo to your hand.
- **Flavor**: *"I absorb an arsenal of actions, so when I need to, I can perform them with the same precision." —Echo*
- **Image Asset**: `assets/card-art/bundles/cards/60047.jpg` (710×1030 px, 266.5 KB)
### [60060] Raised by the Kingpin
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Echo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Maya Lopez player.***
  > You cannot deal damage to Kingpin.
  > **When Revealed**: Find Kingpin and put him into play engaged with you.
  > **Response**: After you thwart, place that threat here. If there is 4 or more threat here, remove this card from the game.
- **Flavor**: *Allie Preswick*
- **Image Asset**: `assets/card-art/bundles/cards/60060.jpg` (710×1030 px, 329.2 KB)

### Set: Protection

### [60038] Innate Reflexes
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 38
- **Stats**: **Cost**: 1
- **Traits**: *Condition.*
- **Rules Text**:
  > Starting. *(You may add this card to your hand before drawing your starting hand.)*
  > Your hero gets +1 DEF.
- **Flavor**: *KTINK!*
- **Image Asset**: `assets/card-art/bundles/cards/60038.png` (710×1030 px, 289.6 KB)
### [60048] Army of One
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 48
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > [star] Increase the cost to play this card by 1 for each ally you control.
  > **Hero Action**: Ready your hero.
- **Flavor**: *"Two versus one is not a fair fight...for you." —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/60048.jpg` (710×1030 px, 317.8 KB)
### [60049] Get Their Attention
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 49
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Defense. Thwart.*
- **Rules Text**:
  > **Hero Interrupt** *(defense/thwart)*: When an enemy initiates an attack, remove 3 threat from a scheme.
- **Flavor**: *"I think we made 'em mad."
"What do you mean 'we'?"
—Rocket Raccoon and Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/60049.png` (710×1030 px, 349.9 KB)
### [60050] In Harm's Way
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > [star] Increase the cost to play this card by 1 for each ally you control.
  > **Hero Action** *(attack/thwart)*: Deal X damage to an enemy and remove X threat from a scheme, where X is your DEF.
- **Image Asset**: `assets/card-art/bundles/cards/60050.jpg` (710×1030 px, 330.6 KB)
### [60051] Powerful Punch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(attack/defense)*: When an enemy initiates an attack, deal 4 damage to that enemy.
- **Flavor**: *"That was my favorite shirt!" —Luke Cage*
- **Image Asset**: `assets/card-art/bundles/cards/60051.png` (710×1030 px, 314.8 KB)
### [60052] The Best Offense...
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Temporary.
  > Your hero gets +1 DEF.
  > Use your DEF in place of your THW and ATK. *(Ignore any modifiers to your THW and ATK.)*
- **Image Asset**: `assets/card-art/bundles/cards/60052.png` (710×1030 px, 334.0 KB)
### [60053] Ronin
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 53
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Title.*
- **Rules Text**:
  > While you do not control any allies, your hero gets +1 DEF and gains retaliate 1.
- **Flavor**: *"I am Ronin, the samurai with no master." —Ronin*
- **Image Asset**: `assets/card-art/bundles/cards/60053.jpg` (710×1030 px, 314.9 KB)
### [60054] Stand Alone
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 54
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Interrupt**: When an enemy attacks you *(before any defender is declared)*, if you do not control any allies, exhaust Stand Alone → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/60054.png` (710×1030 px, 283.8 KB)

### Set: Echo Nemesis

### [60061] Kingpin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Echo Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Kingpin would attack the Maya Lopez player, he schemes instead.
  > *(Echo's nemesis minion.)*
- **Flavor**: *"In my own way, I grew to care for you, Maya. I loved you like a daughter. I still do."*
- **Image Asset**: `assets/card-art/bundles/cards/60061.png` (710×1030 px, 308.9 KB)
### [60062] Master Manipulator
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Echo Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Kingpin cannot take damage.
  > **When Revealed**: Find Kingpin and put him into play engaged with you.
  >
  > ---
  >
  > [star] **Boost**: If Kingpin is in play, reveal this scheme.
- **Flavor**: *"If you lay a hand on me, you will regret it." —Kingpin*
- **Image Asset**: `assets/card-art/bundles/cards/60062.png` (1030×710 px, 300.2 KB)
### [60063] Kingpin's Henchman
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Echo Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Guard.
  > Kingpin cannot take damage.
- **Flavor**: *"Mr. Fisk would like a word wit' yous."*
- **Image Asset**: `assets/card-art/bundles/cards/60063.jpg` (710×1030 px, 248.8 KB)
### [60064] Pawn of the Kingpin
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Echo Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: If Kingpin is in play, he schemes. Otherwise, this card gains surge.
  > **When Revealed (Hero)**: Deal damage to a hero equal to your hero's ATK.
- **Flavor**: *Kingpin convinced Echo that it was Daredevil, not Kingpin, who killed her father.*
- **Image Asset**: `assets/card-art/bundles/cards/60064.png` (710×1030 px, 269.9 KB)

