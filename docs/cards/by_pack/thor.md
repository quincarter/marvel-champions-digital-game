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
| `06001a` | Thor | Hero | Thor | THW:1 ATK:2 DEF:2 HP:14 | - | `thor` |
| `06001b` | Odinson | Alter-Ego | Thor | REC:4 HP:14 | - | `thor` |
| `06002` | Lady Sif | Ally | Thor | THW:2 ATK:2 HP:3 | - | `thor` |
| `06003` | Defender of the Nine Realms | Event | Thor | - | - | `thor` |
| `06004` | For Asgard! | Event | Thor | - | - | `thor` |
| `06005` | Hammer Throw | Event | Thor | - | - | `thor` |
| `06006` | Lightning Strike | Event | Thor | - | - | `thor` |
| `06007` | Asgard | Support | Thor | - | - | `thor` |
| `06008` | God of Thunder | Upgrade | Thor | - | - | `thor` |
| `06009` | Mjolnir | Upgrade | Thor | - | - | `thor` |
| `06010` | Thor's Helmet | Upgrade | Thor | - | - | `thor` |
| `06011` | Hercules | Ally | Pack Position: 11 | THW:1 ATK:3 HP:4 | - | `thor` |
| `06012` | Valkyrie | Ally | Pack Position: 12 | THW:1 ATK:2 HP:3 | - | `thor` |
| `06013` | Chase Them Down | Event | Pack Position: 13 | - | - | `thor` |
| `06014` | Get Over Here! | Event | Pack Position: 14 | - | - | `thor` |
| `06015` | Mean Swing | Event | Pack Position: 15 | - | - | `thor` |
| `06016` | The Power of Aggression | Resource | Pack Position: 16 | - | - | `thor` |
| `06017` | Hall of Heroes | Support | Pack Position: 17 | - | - | `thor` |
| `06018` | Battle Fury | Upgrade | Pack Position: 18 | - | - | `thor` |
| `06019` | Jarnbjorn | Upgrade | Pack Position: 19 | - | - | `thor` |
| `06020` | Heimdall | Ally | Pack Position: 20 | THW:2 ATK:3 HP:4 | - | `thor` |
| `06021` | Invulnerability | Event | Pack Position: 21 | - | - | `thor` |
| `06022` | Energy | Resource | Pack Position: 22 | - | - | `thor` |
| `06023` | Genius | Resource | Pack Position: 23 | - | - | `thor` |
| `06024` | Strength | Resource | Pack Position: 24 | - | - | `thor` |
| `06025` | Avengers Mansion | Support | Pack Position: 25 | - | - | `thor` |
| `06026` | Odin's Anger | Obligation | Thor | - | 2 icons | `thor` |
| `06027` | Family Feud | Side Scheme | Thor Nemesis | - | 3 icons | `thor` |
| `06028` | Loki | Minion | Thor Nemesis | SCH:2 ATK:2 HP:4 | 3 icons | `thor` |
| `06029` | Frost Giant | Minion | Thor Nemesis | SCH:1 ATK:3 HP:4 | 1 icon + star | `thor` |
| `06030` | Trickster | Treachery | Thor Nemesis | - | 1 icon | `thor` |
| `06031` | Under Surveillance | Upgrade | Pack Position: 31 | - | - | `thor` |
| `06032` | Teamwork | Event | Pack Position: 32 | - | - | `thor` |
| `06033` | Second Wind | Event | Pack Position: 33 | - | - | `thor` |
| `06034` | Enhanced Physique | Upgrade | Pack Position: 34 | - | - | `thor` |

---

## Pack: Thor (`thor`)

### Set: Thor

### [06001a] Thor
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 2, **HP**: 14, **Hand Size**: 4
- **Traits**: *Asgard. Avenger.*
- **Rules Text**:
  > "Have at thee!" — **Response**: After you engage a minion, draw 2 cards. (Limit once per phase.)
- **Flavor**: *"Now you face the mightiest Avenger of all"*
- **Image Asset**: `assets/card-art/bundles/cards/06001a.png` (300×419 px, 42.1 KB)

### [06001b] Odinson
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 14, **Hand Size**: 5
- **Traits**: *Asgard.*
- **Rules Text**:
  > Worthy — **Action**: Search your deck and discard pile for the Mjolnir upgrade and add it to your hand. Shuffle your deck. (Limit once per round).
- **Image Asset**: `assets/card-art/bundles/cards/06001b.png` (300×419 px, 38.5 KB)

### [06002] Lady Sif
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Asgard.*
- **Rules Text**:
  > **Response**: After Lady Sif enters play, ready Thor or Odinson.
- **Flavor**: *"Where my Beloved sallies forth—let his Lady Sif be at his side!"*
- **Image Asset**: `assets/card-art/bundles/cards/06002.png` (300×419 px, 36.7 KB)

### [06003] Defender of the Nine Realms
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (2–4/15, Qty: 3)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Discard cards from the top of the encounter deck until you discard a minion. Put that minion into play engaged with you → remove 3 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/06003.png` (300×419 px, 41.3 KB)

### [06004] For Asgard!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (5/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Rules Text**:
  > **Alter-Ego Action**: Search your deck and discard pile for a card with the [[Asgard]] trait and add it to your hand. Shuffle your deck.
- **Flavor**: *"For honor! For glory! For Asgard!" —Thor*
- **Image Asset**: `assets/card-art/bundles/cards/06004.png` (300×419 px, 40.7 KB)

### [06005] Hammer Throw
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (6–8/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust Mjolnir → deal 8 damage to an enemy and return Mjolnir to your hand. This attack gains overkill.
- **Flavor**: *"Now, Mjolnir! Strike true" —Thor*
- **Image Asset**: `assets/card-art/bundles/cards/06005.png` (300×419 px, 38.6 KB)

### [06006] Lightning Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (9–10/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Spend X [energy] resources → deal X damage to the villain and each minion engaged with you. This damage ignores tough status card if you have the [[Aerial]] trait.
- **Errata (FFG)**:
  > Changed “attack” to “damage”. (RRG 1.3)
- **Flavor**: *"I say thee, nay!" —Thor*
- **Image Asset**: `assets/card-art/bundles/cards/06006.png` (300×419 px, 39.0 KB)

### [06007] Asgard
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Asgard. Location.*
- **Rules Text**:
  > You get +1 hand size.
- **Flavor**: *It is from the shining city of Asgard that Odin watches over the Nine Realms, and it was here that Thor was raised a prince.*
- **Image Asset**: `assets/card-art/bundles/cards/06007.png` (300×419 px, 36.6 KB)

### [06008] God of Thunder
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (12–13/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Asgard. Title.*
- **Rules Text**:
  > **Hero Resource**: Exhaust God of Thunder → generate a [energy] resource.
- **Flavor**: *"I am the God of Thunder, lord of the savage Lightning. The vary skies must tremble when speaks the Mighty Thor!" —Thor*
- **Image Asset**: `assets/card-art/bundles/cards/06008.png` (300×419 px, 37.7 KB)

### [06009] Mjolnir
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (14/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Asgard. Weapon.*
- **Rules Text**:
  > Restricted. *(Max 2 restricted cards per player.)*
  > Thor gets +1 ATK and gains the [[Aerial]] trait.
- **Flavor**: *Whosoever holds this hammer, if he be worthy, shall possess the power of Thor.*
- **Image Asset**: `assets/card-art/bundles/cards/06009.png` (300×419 px, 35.8 KB)

### [06010] Thor's Helmet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Asgard. Armor.*
- **Rules Text**:
  > You get +5 hit points.
- **Flavor**: *"Brothers and sisters — prepare yourselves. Today we go to WAR!" —Thor*
- **Image Asset**: `assets/card-art/bundles/cards/06010.png` (300×419 px, 33.8 KB)

### [06026] Odin's Anger
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thor Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Odinson player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Odinson → remove Odin's Anger from the game.
  > • Discard Mjolnir from your hand or from play. You are stunned. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/06026.png` (300×419 px, 40.9 KB)


### Set: Aggression

### [06011] Hercules
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 6, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Avenger. Olympus.*
- **Rules Text**:
  > Reduce the cost to play Hercules by 1 for each minion engaged with you.
- **Flavor**: *Whatever Thor can do, Hercules can accomplish more mightily!*
- **Image Asset**: `assets/card-art/bundles/cards/06011.png` (300×419 px, 37.3 KB)

### [06012] Valkyrie
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Asgard. Avenger.*
- **Rules Text**:
  > **Response:** After Valkyrie enters play, deal 2 damage to a minion (3 damage instead if you paid for this card using a [energy] resource).
- **Flavor**: *I am Valkyrie, shieldmaiden of Asgard.*
- **Image Asset**: `assets/card-art/bundles/cards/06012.png` (300×419 px, 40.3 KB)

### [06013] Chase Them Down
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Response** *(thwart)*: After your hero attacks and defeats an enemy, remove 2 threat from a scheme.
- **Flavor**: *"Kamala, we don't have a theme song. Please stop humming one..." —Captain Marvel*

### [06014] Get Over Here!
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 1 damage to a minion. If you have the [[Aerial]] trait, engage that enemy.
- **Flavor**: *"I would have words with thee!" —Thor*
- **Image Asset**: `assets/card-art/bundles/cards/06014.png` (300×419 px, 39.8 KB)

### [06015] Mean Swing
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When your hero makes a basic attack, exhaust a [[Weapon]] upgrade on your hero → your hero gets +3 ATK for this attack.
- **Flavor**: *POW!*
- **Image Asset**: `assets/card-art/bundles/cards/06015.png` (300×419 px, 41.1 KB)

### [06016] The Power of Aggression
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Aggression *(red)* card.

### [06017] Hall of Heroes
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Asgard. Location.*
- **Rules Text**:
  > **Response:** After you defeat a minion, place 1 glory counter here.
  > **Alter-Ego Action:** Exhaust Hall of Heroes and remove 3 glory counters from it → draw 3 cards.
- **Image Asset**: `assets/card-art/bundles/cards/06017.png` (300×419 px, 44.4 KB)

### [06018] Battle Fury
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control.
  > Max 1 per player.
  > **Response:** After your hero attacks and defeats a minion, deal 1 damage to your hero and discard Battle Fury → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/06018.png` (300×419 px, 45.3 KB)

### [06019] Jarnbjorn
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Asgard. Weapon.*
- **Rules Text**:
  > Restricted.
  > **Response:** After your hero attacks an enemy, spend a [physical] resource → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/06019.png` (300×419 px, 39.6 KB)


### Set: Basic

### [06020] Heimdall
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 4, **Resources**: [mental]
- **Traits**: *Asgard.*
- **Rules Text**:
  > **Response:** After Heimdall enters play, look at the top 3 cards of the encounter deck. Discard 1 of them and put the others back in any order.
- **Flavor**: *"You wish to know what I see?"*
- **Image Asset**: `assets/card-art/bundles/cards/06020.png` (300×419 px, 39.0 KB)

### [06021] Invulnerability
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Give your hero a tough status card.
- **Flavor**: *"It's unbreakable skin, man. Don't you know who I am?" —Luke Cage*
- **Image Asset**: `assets/card-art/bundles/cards/06021.png` (300×419 px, 33.7 KB)

### [06022] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [06023] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [06024] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [06025] Avengers Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Avengers Mansion → choose a player. That player draws 1 card.
- **Flavor**: *"Did you remember to turn off the stove?" —Janet Van Dyne*

### [06034] Enhanced Physique
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Uses (3 physical counters).
  > **Hero Resource**: Exhaust Enhanced Physique and remove 1 physical counter from it → generate a [physical] resource.
- **Image Asset**: `assets/card-art/bundles/cards/06034.png` (300×419 px, 34.2 KB)


### Set: Thor Nemesis

### [06027] Family Feud
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor Nemesis (1/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thor Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place 1 additional threat here for each [[Asgard]] card in play.
- **Flavor**: *Ever the trickster, Loki can't resist the opportunity to frustrate his brother, Thor.*
- **Image Asset**: `assets/card-art/bundles/cards/06027.png` (419×300 px, 35.3 KB)

### [06028] Loki
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thor Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard.*
- **Rules Text**:
  > **Forced Interrupt**: When Loki would be defeated, discard the top card of the encounter deck. If that card is a treachery, heal all damage from Loki instead.
  > *(Thor's nemesis minion.)*
- **Errata (FFG)**:
  > Changed “Interrupt” to “Forced Interrupt”. (RRG 1.2)
- **Flavor**: *"You seem disappointed, brother. That's good."*
- **Image Asset**: `assets/card-art/bundles/cards/06028.png` (300×419 px, 39.6 KB)

### [06029] Frost Giant
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Thor Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Giant.*
- **Rules Text**:
  > Toughness. *(This character enters play with a tough status card.)*
  >
  > ---
  > [star] **Boost**: If the villain is attacking and this attack deals damage to a character, stun that character.
- **Image Asset**: `assets/card-art/bundles/cards/06029.png` (300×419 px, 41.1 KB)

### [06030] Trickster
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Thor (`thor`)
- **Deck / Set**: Thor Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thor Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top 3 cards of your deck. Place 1 threat on the main scheme for each different card type discarded this way.
- **Flavor**: *"How many times are you going to fall for that!" —Loki*
- **Image Asset**: `assets/card-art/bundles/cards/06030.png` (300×419 px, 38.5 KB)


### Set: Justice

### [06031] Under Surveillance
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the main scheme. Max 1 per scheme.
  > Increase the target threat value of attached scheme by 4.
- **Image Asset**: `assets/card-art/bundles/cards/06031.png` (300×419 px, 30.5 KB)


### Set: Leadership

### [06032] Teamwork
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Interrupt** When you use your basic thwart power *(THW)* or basic attack power *(ATK)*, exhaust an ally you control → add that ally's matching power to your hero's power for this use.
- **Image Asset**: `assets/card-art/bundles/cards/06032.png` (300×419 px, 40.1 KB)


### Set: Protection

### [06033] Second Wind
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Thor (`thor`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Heal 4 damage from an identity (5 damage instead if you paid for this card using a [mental] resource).
- **Image Asset**: `assets/card-art/bundles/cards/06033.png` (300×419 px, 37.4 KB)


