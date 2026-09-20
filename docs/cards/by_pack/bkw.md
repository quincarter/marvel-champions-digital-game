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
| `08001a` | Black Widow | Hero | Black Widow | THW:2 ATK:2 DEF:2 HP:9 | - | `bkw` |
| `08001b` | Natasha Romanoff | Alter-Ego | Black Widow | HP:9 | - | `bkw` |
| `08002` | Winter Soldier | Ally | Black Widow | THW:2 ATK:2 HP:4 | - | `bkw` |
| `08003` | Covert Ops | Event | Black Widow | - | - | `bkw` |
| `08004` | Dance of Death | Event | Black Widow | - | - | `bkw` |
| `08005` | Safe House #29 | Support | Black Widow | - | - | `bkw` |
| `08006` | Attacrobatics | Upgrade | Black Widow | - | - | `bkw` |
| `08007` | Black Widow's Gauntlet | Upgrade | Black Widow | - | - | `bkw` |
| `08008` | Grappling Hook | Upgrade | Black Widow | - | - | `bkw` |
| `08009` | Synth-Suit | Upgrade | Black Widow | - | - | `bkw` |
| `08010` | Widow's Bite | Upgrade | Black Widow | - | - | `bkw` |
| `08011` | Agent Coulson | Ally | Pack Position: 11 | THW:2 ATK:1 HP:3 | - | `bkw` |
| `08012` | Quake | Ally | Pack Position: 12 | THW:1 ATK:2 HP:2 | - | `bkw` |
| `08013` | Stealth Strike | Event | Pack Position: 13 | - | - | `bkw` |
| `08014` | The Power of Justice | Resource | Pack Position: 14 | - | - | `bkw` |
| `08015` | Interrogation Room | Support | Pack Position: 15 | - | - | `bkw` |
| `08016` | Surveillance Team | Support | Pack Position: 16 | - | - | `bkw` |
| `08017` | Counterintelligence | Upgrade | Pack Position: 17 | - | - | `bkw` |
| `08018` | Spycraft | Upgrade | Pack Position: 18 | - | - | `bkw` |
| `08019` | Nick Fury | Ally | Pack Position: 19 | THW:2 ATK:2 HP:3 | - | `bkw` |
| `08020` | Energy | Resource | Pack Position: 20 | - | - | `bkw` |
| `08021` | Genius | Resource | Pack Position: 21 | - | - | `bkw` |
| `08022` | Strength | Resource | Pack Position: 22 | - | - | `bkw` |
| `08023` | Quincarrier | Support | Pack Position: 23 | - | - | `bkw` |
| `08024` | Target Acquired | Upgrade | Pack Position: 24 | - | - | `bkw` |
| `08025` | Burn Notice | Obligation | Black Widow | - | 2 pips | `bkw` |
| `08026` | Taskmaster | Minion | Black Widow Nemesis | SCH:0 ATK:0 HP:4 | Star | `bkw` |
| `08027` | Killer for Hire | Side Scheme | Black Widow Nemesis | - | 3 pips | `bkw` |
| `08028` | Hydra Mercenary | Minion | Black Widow Nemesis | SCH:0 ATK:1 HP:3 | 1 pips | `bkw` |
| `08029` | Deadly Shot | Treachery | Black Widow Nemesis | - | 1 pips | `bkw` |
| `08030` | Counterattack | Upgrade | Pack Position: 30 | - | - | `bkw` |
| `08031` | Rapid Response | Upgrade | Pack Position: 31 | - | - | `bkw` |
| `08032` | Defensive Stance | Upgrade | Pack Position: 32 | - | - | `bkw` |
| `08033` | Espionage | Upgrade | Pack Position: 33 | - | - | `bkw` |

---

## Pack: Black Widow (`bkw`)

### Set: Black Widow

### [08001a] Black Widow
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 9, **Hand Size**: 5
- **Traits**: *Avenger. Spy.*
- **Rules Text**:
  > "Widowmaker" — **Response**: After you trigger the ability of a [[Preparation]] card you control, deal 1 damage to an enemy.
- **Flavor**: *"My name is Madame Natasha. But you can call me Black Widow!"*
- **Image Asset**: `assets/card-art/bundles/cards/08001a.png` (300×418 px, 210.7 KB)
### [08001b] Natasha Romanoff
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > Mission Prep — **Response**: After you play a [[Preparation]] card, draw 1 card. (Limit once per phase.)
- **Flavor**: *"This is my mission and I will succeed."*
- **Image Asset**: `assets/card-art/bundles/cards/08001b.png` (300×418 px, 201.8 KB)
### [08002] Winter Soldier — *Bucky Barnes*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 4, **Resources**: [wild]
- **Traits**: *Avenger. Spy.*
- **Rules Text**:
  > Reduce the cost to play Winter Soldier by 1 for each [[Preparation]] card you control.
- **Flavor**: *"You shot at Natasha. That was your last act on Earth, pal."*
- **Image Asset**: `assets/card-art/bundles/cards/08002.png` (300×419 px, 35.1 KB)
### [08003] Covert Ops
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (2–3/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Action** *(thwart)*: Remove 4 threat from a scheme. Confuse the villain.
- **Flavor**: *"It's all about calculating how willfully blind a person is going to be. And then exploiting that." —Natasha Romanoff*
- **Image Asset**: `assets/card-art/bundles/cards/08003.png` (300×419 px, 35.7 KB)
### [08004] Dance of Death
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (4–5/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action**: Make the following 3 attacks in order:
  > - Deal 1 damage to an enemy.
  > - Deal 2 damage to an enemy.
  > - Deal 3 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/08004.png` (300×419 px, 35.4 KB)
### [08005] Safe House #29
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (6/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Safe House #29 and choose a [[Preparation]] card in your discard pile → add that card to your hand.
- **Flavor**: *"We should be safe here." —Black Widow*
- **Image Asset**: `assets/card-art/bundles/cards/08005.png` (300×419 px, 41.6 KB)
### [08006] Attacrobatics
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (7–8/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack. Preparation. Skill.*
- **Rules Text**:
  > **Hero Interrupt** *(attack)*: When a boost card is turned faceup, discard Attacrobatics → cancel the boost icons on that card. Deal 1 damage to the villain for each boost icon canceled this way.
- **Image Asset**: `assets/card-art/bundles/cards/08006.png` (300×419 px, 45.1 KB)
### [08007] Black Widow's Gauntlet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (9–10/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tech.*
- **Rules Text**:
  > **Resource**: Exhaust Black Widow's Gauntlet → generate a [wild] resource for a [[Preparation]] card.
- **Flavor**: *"Not only are they lethal, but they look good, too." —Black Widow*
- **Image Asset**: `assets/card-art/bundles/cards/08007.png` (300×419 px, 36.8 KB)
### [08008] Grappling Hook
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (11–12/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Preparation. Tech.*
- **Rules Text**:
  > **Hero Interrupt**: When you reveal a treachery, discard Grappling Hook → cancel the effects of that treachery and discard it.
- **Flavor**: *"Bozhe moi!" —Black Widow*
- **Image Asset**: `assets/card-art/bundles/cards/08008.png` (300×419 px, 40.9 KB)
### [08009] Synth-Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Black Widow gets +1 DEF.
  > **Hero Response**: After you trigger the ability of a [[Preparation]] card you control, exhaust Synth-Suit → ready Black Widow.
- **Image Asset**: `assets/card-art/bundles/cards/08009.png` (300×419 px, 32.6 KB)
### [08010] Widow's Bite
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (14–15/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Preparation. Tech.*
- **Rules Text**:
  > **Hero Response** *(attack)*: After a minion enters play, discard Widow's Bite → deal 2 damage to that minion and stun it.
- **Flavor**: *"Nighty night." —Black Widow*
- **Image Asset**: `assets/card-art/bundles/cards/08010.png` (300×419 px, 40.0 KB)
### [08025] Burn Notice
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Natasha Romanoff player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Natasha Romanoff → remove this card from the game.
  > • Discard the [[Preparation]] card you control with the highest cost. If you cannot, this card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/08025.png` (300×419 px, 40.4 KB)

### Set: Justice

### [08011] Agent Coulson
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Response**: After Agent Coulson enters play, search your deck and discard pile for a [[Preparation]] card and add it to your hand. Shuffle your deck.
- **Flavor**: *"I'm a guy with a plan."*
- **Image Asset**: `assets/card-art/bundles/cards/08011.png` (300×419 px, 36.6 KB)
### [08012] Quake — *Daisy Johnson*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Avenger. S.H.I.E.L.D.*
- **Rules Text**:
  > **Response**: After a minion schemes, exhaust Quake → deal 2 damage to that minion.
- **Flavor**: *"I will bring this building down around you!"*
- **Image Asset**: `assets/card-art/bundles/cards/08012.png` (300×419 px, 40.3 KB)
### [08013] Stealth Strike
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If that enemy is defeated by this attack, remove 2 threat from a scheme.
- **Flavor**: *"They'll never know what hit them." —Black Widow*
- **Image Asset**: `assets/card-art/bundles/cards/08013.png` (300×419 px, 34.5 KB)
### [08014] The Power of Justice
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Justice *(yellow)* card.
### [08015] Interrogation Room
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After you defeat a minion, exhaust Interrogation Room → remove 1 threat from a scheme.
- **Flavor**: *"Oh, she's sorry! Let me get the keys and call you a car service!" —Misty Knight*
### [08016] Surveillance Team
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 snoop counters). *(Enters play with 3 counters. When those are gone, discard this card)*
  > **Action**: Exhaust Surveillance Team and remove 1 snoop counter from it → remove 1 threat from a scheme.
### [08017] Counterintelligence
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Preparation. Skill.*
- **Rules Text**:
  > Max 1 per player.
  > **Interrupt**: When any amount of threat would be placed on the main scheme, discard Counterintelligence → prevent 3 of that threat.
- **Image Asset**: `assets/card-art/bundles/cards/08017.png` (300×419 px, 34.9 KB)
### [08018] Spycraft
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Preparation. Skill.*
- **Rules Text**:
  > Play only if you control a [[Spy]] character.
  > **Interrupt**: When you reveal an encounter card, discard Spycraft → cancel the effects of that card and discard it. Then, reveal another card from the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/08018.png` (300×419 px, 32.2 KB)

### Set: Basic

### [08019] Nick Fury
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Forced Response**: After Nick Fury enters play, choose one: remove 2 threat from a scheme, draw 3 cards, or deal 4 damage to an enemy. At the end of the round, if Nick Fury is still in play, discard him.
### [08020] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [08021] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [08022] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [08023] Quincarrier
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Avenger. Vehicle.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > **Resource**: Exhaust Quincarrier → generate a [wild] resource.
- **Flavor**: *"Too bad we could only get one of these." —Hawkeye*
- **Image Asset**: `assets/card-art/bundles/cards/08023.png` (300×419 px, 35.8 KB)
### [08024] Target Acquired
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Preparation. Skill.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Response**: After a boost card is turned faceup, discard Target Acquired → cancel that card's boost ability.
- **Image Asset**: `assets/card-art/bundles/cards/08024.png` (300×419 px, 33.2 KB)
### [08033] Espionage
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Preparation. Skill.*
- **Rules Text**:
  > Play only if you control a [[Spy]] character.
  > **Interrupt**: When the surge keyword on an encounter card would be resolved, discard Espionage → draw 2 cards.
- **Image Asset**: `assets/card-art/bundles/cards/08033.png` (300×419 px, 31.3 KB)

### Set: Black Widow Nemesis

### [08026] Taskmaster
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 0 [star], **ATK**: 0 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Black Widow Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Elite.*
- **Rules Text**:
  > [star] Taskmaster gets +1 SCH and +1 ATK for each upgrade you control.
  > *(Black Widow's nemesis minion.)*
  >
  > ---
  > [star] **Boost**: For this activation, the villain gets +1 SCH and +1 ATK for each upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/08026.png` (300×419 px, 39.0 KB)
### [08027] Killer for Hire
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow Nemesis (2/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place an additional 1[per_hero] threat here.
- **Image Asset**: `assets/card-art/bundles/cards/08027.png` (419×300 px, 34.2 KB)
### [08028] Hydra Mercenary
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
- **Flavor**: *"What is Hydra doing here?" —Carol Danvers*
- **Image Asset**: `assets/card-art/bundles/cards/08028.png` (300×419 px, 37.1 KB)
### [08029] Deadly Shot
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Black Widow Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard an upgrade you control and place 1 threat on the main scheme.
  > **When Revealed (Hero)**: Discard an upgrade you control and take 1 damage.
- **Image Asset**: `assets/card-art/bundles/cards/08029.png` (300×419 px, 38.6 KB)

### Set: Aggression

### [08030] Counterattack
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Preparation. Tactic.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Response** *(attack)*: After you take damage from an enemy attack, discard Counterattack → deal an equal amount of damage to that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/08030.png` (300×419 px, 40.8 KB)

### Set: Leadership

### [08031] Rapid Response
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Preparation. Tactic.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Response**: After an ally you control is defeated, discard Rapid Response → put that ally into play from your discard pile and deal 1 damage to it.
- **Image Asset**: `assets/card-art/bundles/cards/08031.png` (300×419 px, 41.6 KB)

### Set: Protection

### [08032] Defensive Stance
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Black Widow (`bkw`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Preparation. Tactic.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Interrupt**: When you would take any amount of damage, discard Defensive Stance → prevent 3 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/08032.png` (300×419 px, 38.5 KB)

