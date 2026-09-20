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
| `54001a` | Winter Soldier | Hero | Winter Soldier | THW:2 ATK:2 DEF:2 HP:11 | - | `winter` |
| `54001b` | Bucky Barnes | Alter-Ego | Winter Soldier | REC:3 HP:11 | - | `winter` |
| `54002` | Cybernetic Arm | Upgrade | Winter Soldier | - | - | `winter` |
| `54003` | Black Widow | Ally | Winter Soldier | THW:2 ATK:2 HP:3 | - | `winter` |
| `54004` | Arm Block | Event | Winter Soldier | - | - | `winter` |
| `54005` | Metal Punch | Event | Winter Soldier | - | - | `winter` |
| `54006` | Electrical Discharge | Event | Winter Soldier | - | - | `winter` |
| `54007` | Safe House #30 | Support | Winter Soldier | - | - | `winter` |
| `54008` | Silent Infiltration | Upgrade | Winter Soldier | - | - | `winter` |
| `54009` | Winter Armor | Upgrade | Winter Soldier | - | - | `winter` |
| `54010` | Winter Mask | Upgrade | Winter Soldier | - | - | `winter` |
| `54011` | Winter Rifle | Upgrade | Winter Soldier | - | - | `winter` |
| `54012` | Captain America | Ally | Pack Position: 12 | THW:2 ATK:2 HP:3 | - | `winter` |
| `54013` | Deathlok | Ally | Pack Position: 13 | THW:2 ATK:1 HP:3 | - | `winter` |
| `54014` | Firepower | Event | Pack Position: 14 | - | - | `winter` |
| `54015` | One by One | Event | Pack Position: 15 | - | - | `winter` |
| `54016` | Spoiling for a Fight | Event | Pack Position: 16 | - | - | `winter` |
| `54017` | Aggressive Stance | Upgrade | Pack Position: 17 | - | - | `winter` |
| `54018` | Bambino | Upgrade | Pack Position: 18 | - | - | `winter` |
| `54019` | Man on the Wall | Upgrade | Pack Position: 19 | - | - | `winter` |
| `54020` | S.H.I.E.L.D. Sidearm | Upgrade | Pack Position: 20 | - | - | `winter` |
| `54021` | Nick Fury, Sr. | Ally | Pack Position: 21 | THW:2 ATK:2 HP:3 | - | `winter` |
| `54022` | Super-Soldiers | Event | Pack Position: 22 | - | - | `winter` |
| `54023` | Winter, Widow, Soldier, Spy | Event | Pack Position: 23 | - | - | `winter` |
| `54024` | Energy | Resource | Pack Position: 24 | - | - | `winter` |
| `54025` | Genius | Resource | Pack Position: 25 | - | - | `winter` |
| `54026` | Strength | Resource | Pack Position: 26 | - | - | `winter` |
| `54027` | Red Room Programming | Obligation | Winter Soldier | - | 2 icons | `winter` |
| `54028` | Crossbones | Minion | Winter Soldier Nemesis | SCH:2 ATK:2 HP:5 | 3 icons | `winter` |
| `54029` | Hydra Hit Squad | Side Scheme | Winter Soldier Nemesis | - | 3 icons | `winter` |
| `54030` | High-Tech Armament | Attachment | Winter Soldier Nemesis | ATK:1 | 2 icons | `winter` |
| `54031` | Hydra Mercenary | Minion | Winter Soldier Nemesis | SCH:0 ATK:1 HP:3 | 1 icon | `winter` |
| `54032` | White Widow | Ally | Pack Position: 32 | THW:2 ATK:1 HP:3 | - | `winter` |
| `54033` | S.H.I.E.L.D. Deputy | Upgrade | Pack Position: 33 | - | - | `winter` |
| `54034` | Blizzard | Minion | Whiteout | SCH:1 ATK:2 HP:16 | 4 icons | `winter` |
| `54035` | Encased in Ice | Attachment | Whiteout | - | 1 icon | `winter` |
| `54036` | Slippery Conditions | Side Scheme | Whiteout | - | 3 icons | `winter` |
| `54037` | Whiteout | Treachery | Whiteout | - | 1 icon + star | `winter` |

---

## Pack: Winter Soldier (`winter`)

### Set: Winter Soldier

### [54001a] Winter Soldier
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 11, **Hand Size**: 5
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > *Lethal Protector* — **Response**: After you attack and defeat an enemy, remove 2 threat from a scheme.
- **Flavor**: *"The Red Room trained me to do terrible things. I use those skills to safeguard others now."*
- **Image Asset**: `assets/card-art/bundles/cards/54001a.png` (300×426 px, 244.9 KB)

### [54001b] Bucky Barnes
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 11, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > *Cybernetically Enhanced* — **Action**: Spend 1 resource of any type → search your deck and discard pile for Cybernetic Arm and put it into play. *(Shuffle.)*
- **Flavor**: *"Not bad for a ninety-nine-year-old veteran."*
- **Image Asset**: `assets/card-art/bundles/cards/54001b.png` (300×426 px, 244.3 KB)

### [54002] Cybernetic Arm
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > **Resource**: Exhaust Cybernetic Arm → generate a [wild] resource for an [[Attack]] event. That event deals 1 additional damage.
- **Flavor**: *"Bucky was a skilled fighter before the arm. With it, he's downright scary." —Steve Rogers*
- **Image Asset**: `assets/card-art/bundles/cards/54002.jpg` (710×1030 px, 340.6 KB)

### [54003] Black Widow — *Natasha Romanoff*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Response**: After you play Black Widow from your hand, return an [[Attack]] event from your discard pile to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/54003.png` (710×1030 px, 278.6 KB)

### [54004] Arm Block
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (3–4/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Attack. Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(attack/defense)*: When an enemy attacks, deal 3 damage to it. If you exhausted Cybernetic Arm to pay for this event, prevent all damage from that enemy's attack.
- **Image Asset**: `assets/card-art/bundles/cards/54004.jpg` (710×1030 px, 362.2 KB)

### [54005] Metal Punch
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (5–7/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 7 damage to en enemy. If you exhausted Cybernetic Arm to pay for this event, this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/54005.png` (710×1030 px, 331.1 KB)

### [54006] Electrical Discharge
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (8–9/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If you paid for this event using a [energy] resource, stun that enemy.
- **Flavor**: *"They'd be just as shocked if you showed them your high school photo." —Black Widow*
- **Image Asset**: `assets/card-art/bundles/cards/54006.png` (710×1030 px, 361.1 KB)

### [54007] Safe House #30
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Safe House #30 → search the encounter deck for a minion and put it into play engaged with you. *(Shuffle.)* Then, draw 1 card.
- **Flavor**: *"You'll never guess who moved in next door." —Bucky Barnes*
- **Image Asset**: `assets/card-art/bundles/cards/54007.jpg` (710×1030 px, 365.6 KB)

### [54008] Silent Infiltration
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (11–12/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Preparation.*
- **Rules Text**:
  > **Hero Response**: After you attack and defeat an enemy, discard this card → ready your hero and confuse an enemy.
- **Flavor**: *"They'll never know what hit 'em." —Winter Soldier*
- **Image Asset**: `assets/card-art/bundles/cards/54008.jpg` (710×1030 px, 304.8 KB)

### [54009] Winter Armor
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Armor.*
- **Rules Text**:
  > You get +3 hit points and gain steady.
- **Flavor**: *"The arm may be bulletproof, but the rest of me is still flesh and blood." —Winter Soldier*
- **Image Asset**: `assets/card-art/bundles/cards/54009.png` (710×1030 px, 345.0 KB)

### [54010] Winter Mask
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (14/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > You gain the [[Spy]] trait.
  > **Hero Response**: After you attack and defeat an enemy, exhaust Winter Mask → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/54010.jpg` (710×1030 px, 377.4 KB)

### [54011] Winter Rifle
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Interrupt**: When Winter Soldier makes a basic attack, exhaust Winter Rifle → Winter Soldier gets +2 ATK for this attack. This attack gains piercing and ranged.
- **Image Asset**: `assets/card-art/bundles/cards/54011.png` (710×1030 px, 355.9 KB)

### [54027] Red Room Programming
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Winter Soldier Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Bucky Barnes player.***
  > You may flip to your alter-ego form. Choose:
  > • Exhaust Bucky Barnes → remove this card from the game.
  > • Discard the highest printed cost card from your hand and take indirect damage equal to its cost. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/54027.png` (710×1030 px, 315.2 KB)


### Set: Aggression

### [54012] Captain America — *Steve Rogers*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > Toughness.
  > **Response**: After Captain America enters play, ready a [[S.H.I.E.L.D.]] character.
- **Flavor**: *"On your feet, soldier!"*
- **Image Asset**: `assets/card-art/bundles/cards/54012.png` (710×1030 px, 331.6 KB)

### [54013] Deathlok — *Henry Hayes*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Cyborg. S.H.I.E.L.D.*
- **Rules Text**:
  > **Response**: After Deathlok enters play, search your deck and discard pile for a copy of S.H.I.E.L.D. Sidearm and attach it to him. *(Shuffle.)*
- **Flavor**: *"My body is infused with high-tech, mind-controlled weaponry."*
- **Image Asset**: `assets/card-art/bundles/cards/54013.jpg` (710×1030 px, 294.0 KB)

### [54014] Firepower
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust up to 3 [[Weapon]] upgrades you control → for each weapon upgrade exhausted this way, choose an enemy and deal 3 damage to it. This attack gains ranged.
- **Image Asset**: `assets/card-art/bundles/cards/54014.png` (710×1030 px, 342.0 KB)

### [54015] One by One
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to an enemy. If this attack defeats that enemy, deal 2 damage to an enemy.
- **Flavor**: *"Lots of tricks up these sleeves, ladies and gentlemen." —Moon Girl*

### [54016] Spoiling for a Fight
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Hero Action**: Discard cards from the top of the encounter deck until you discard a minion. Put that minion into play engaged with you → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/54016.jpg` (710×1030 px, 380.7 KB)

### [54017] Aggressive Stance
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Preparation.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Response**: After you engage a minion, discard this card → search your deck for an [[Attack]] event and add it to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/54017.png` (710×1030 px, 383.6 KB)

### [54018] Bambino
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to a [[S.H.I.E.L.D.]] character. While attached to an identity, this card gains restricted. Uses (3 ammo counters).
  > **Interrupt**: When attached character makes a basic attack, remove 1 ammo counter from here → this attack deals 3 additional damage and gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/54018.png` (710×1030 px, 402.6 KB)

### [54019] Man on the Wall
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > Play only if your identity has the [[Soldier]] trait.
  > **Hero Action**: Exhaust Man on the Wall → reduce the cost of the next card you play this phase by 1 for each minion engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/54019.jpg` (710×1030 px, 303.3 KB)

### [54020] S.H.I.E.L.D. Sidearm
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to a [[S.H.I.E.L.D.]] character. Limit 1 per character. Uses (3 ammo counters).
  > **Interrupt**: When attached character makes a basic attack, exhaust S.H.I.E.L.D. Sidearm and remove 1 ammo counter from it → deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/54020.jpg` (710×1030 px, 342.6 KB)


### Set: Basic

### [54021] Nick Fury, Sr.
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > **Forced Response**: After Nick Fury, Sr. enters play, choose one: Remove 3 threat from a scheme, draw 2 cards, or give a [[S.H.I.E.L.D.]] character a tough status card. At the end of the round, if Nick Fury, Sr. is still in play, discard him.

### [54022] Super-Soldiers
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > Team-Up (Captain America and Winter Soldier). Max 1 per deck.
  > **Hero Action** *(attack)*: Deal 6 damage to an enemy. Give Captain America and Winter Soldier each a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/54022.png` (710×1030 px, 360.0 KB)

### [54023] Winter, Widow, Soldier, Spy
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > Team-Up (Black Widow and Winter Soldier). Max 1 per deck.
  > **Hero Action** *(attack)*: Put a [[Preparation]] upgrade from your discard pile into play. Deal 4 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/54023.jpg` (710×1030 px, 341.9 KB)

### [54024] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [54025] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [54026] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [54033] S.H.I.E.L.D. Deputy
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Title.*
- **Rules Text**:
  > Play only if your identity has the [[S.H.I.E.L.D.]] trait.
  > Attach to a friendly character.
  > Attached character gets +1 hit point and gains the [[S.H.I.E.L.D.]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/54033.png` (710×1030 px, 302.9 KB)


### Set: Winter Soldier Nemesis

### [54028] Crossbones
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Winter Soldier Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Hydra.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After Crossbones attacks and defeats an ally, place 2 threat on the main scheme.
  > *(Winter Soldier's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/54028.png` (710×1030 px, 271.5 KB)

### [54029] Hydra Hit Squad
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier Nemesis (2/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Winter Soldier Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[Hydra]] minion gets +1 ATK and +2 hit points.
  > **When Defeated**: The player who defeated this scheme searches the encounter deck and discard pile for a [[Hydra]] minion and reveals it. *(Shuffle.)*
- **Flavor**: *Crossbones commands his own team of hand-picked Hydra goons.*
- **Image Asset**: `assets/card-art/bundles/cards/54029.jpg` (1030×710 px, 377.5 KB)

### [54030] High-Tech Armament
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier Nemesis (3/5)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Winter Soldier Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to Crossbones. Otherwise, attach to the villain.
  > **Forced Response**: After you attach High-Tech Armament to an enemy, that enemy activates against you.
  > **Hero Action**: Exhaust a character you control → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/54030.png` (710×1030 px, 272.3 KB)

### [54031] Hydra Mercenary
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Winter Soldier Nemesis (4–5/5, Qty: 2)
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Winter Soldier Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
- **Flavor**: *"What is Hydra doing here?" —Carol Danvers*
- **Image Asset**: `assets/card-art/bundles/cards/54031.jpg` (710×1030 px, 350.4 KB)


### Set: Protection

### [54032] White Widow — *Yelena Belova*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Pack Position: 32
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Response**: After you resolve the ability of a [[Preparation]] card you control, heal damage from White Widow equal to that card's printed resource cost.
- **Flavor**: *"Surprise."*
- **Image Asset**: `assets/card-art/bundles/cards/54032.jpg` (710×1030 px, 348.8 KB)


### Set: Whiteout

### [54034] Blizzard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Whiteout (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 16
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Whiteout Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Thunderbolt.*
- **Rules Text**:
  > Villainous. Victory 1.
  > [star] **Forced Response**: After Blizzard attacks a character, search the encounter deck and discard pile for Encased in Ice and attach it to that character. *(Shuffle.)* Otherwise, stun the attacked character.
- **Image Asset**: `assets/card-art/bundles/cards/54034.jpg` (710×1030 px, 343.5 KB)

### [54035] Encased in Ice
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Whiteout (2–3/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Whiteout Set Icon (printed bottom-right next to deck number)
- **Traits**: *Ice.*
- **Rules Text**:
  > Attach to your identity.
  > Attached character cannot attack enemies other than this card.
  > Any player can attack this card as if it were a minion. If there is 3 or more damage here, move all but 3 damage here to attached character and discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/54035.png` (710×1030 px, 319.3 KB)

### [54036] Slippery Conditions
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Whiteout (4/6)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Whiteout Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **Forced Response**: After an ally enters play, exhaust it.
- **Flavor**: *"Watch your step!" —Blizzard*
- **Image Asset**: `assets/card-art/bundles/cards/54036.png` (1030×710 px, 313.0 KB)

### [54037] Whiteout
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Winter Soldier (`winter`)
- **Deck / Set**: Whiteout (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Whiteout Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find Blizzard and reveal him. *(If he is already in play, he engages you.)* Blizzard activates against you. If no enemy activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. If you were already stunned, take 1 damage.
- **Image Asset**: `assets/card-art/bundles/cards/54037.jpg` (710×1030 px, 348.8 KB)


