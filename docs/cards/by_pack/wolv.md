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
| `35001a` | Wolverine | Hero | Wolverine | THW:2 ATK:2 DEF:2 HP:10 | - | `wolv` |
| `35001b` | Logan | Alter-Ego | Wolverine | HP:10 | - | `wolv` |
| `35002` | Wolverine's Claws | Upgrade | Wolverine | - | - | `wolv` |
| `35003` | Jubilee | Ally | Wolverine | THW:1 ATK:1 HP:2 | - | `wolv` |
| `35004` | Adamantium Skeleton | Upgrade | Wolverine | - | - | `wolv` |
| `35005` | Berserker Frenzy | Upgrade | Wolverine | - | - | `wolv` |
| `35006` | "I Got Better" | Upgrade | Wolverine | - | - | `wolv` |
| `35007` | Logan's Cabin | Support | Wolverine | - | - | `wolv` |
| `35008` | Berserker Barrage | Event | Wolverine | - | - | `wolv` |
| `35009` | Slice and Dice | Event | Wolverine | - | - | `wolv` |
| `35010` | Lunging Strike | Event | Wolverine | - | - | `wolv` |
| `35011` | Track by Scent | Event | Wolverine | - | - | `wolv` |
| `35012` | Regenerative Healing | Event | Wolverine | - | - | `wolv` |
| `35013` | Psylocke | Ally | Pack Position: 13 | THW:2 ATK:1 HP:3 | - | `wolv` |
| `35014` | Sunfire | Ally | Pack Position: 14 | THW:1 ATK:2 HP:2 | - | `wolv` |
| `35015` | Battle Fury | Upgrade | Pack Position: 15 | - | - | `wolv` |
| `35016` | Warrior Skill | Upgrade | Pack Position: 16 | - | - | `wolv` |
| `35017` | Outta My Way! | Event | Pack Position: 17 | - | - | `wolv` |
| `35018` | Precision Strike | Event | Pack Position: 18 | - | - | `wolv` |
| `35019` | Mean Swing | Event | Pack Position: 19 | - | - | `wolv` |
| `35020` | Aggressive Energy | Resource | Pack Position: 20 | - | - | `wolv` |
| `35021` | Colossus | Ally | Pack Position: 21 | THW:1 ATK:3 HP:3 | - | `wolv` |
| `35022` | Weapon X | Support | Pack Position: 22 | - | - | `wolv` |
| `35023` | Fastball Special | Event | Pack Position: 23 | - | - | `wolv` |
| `35024` | Energy | Resource | Pack Position: 24 | - | - | `wolv` |
| `35025` | Genius | Resource | Pack Position: 25 | - | - | `wolv` |
| `35026` | Strength | Resource | Pack Position: 26 | - | - | `wolv` |
| `35027` | Past Demons | Obligation | Wolverine | - | 2 pips | `wolv` |
| `35028` | Omega Red | Minion | Wolverine Nemesis | SCH:1 ATK:2 HP:8 | 3 pips | `wolv` |
| `35029` | The Carbonadium Synthesizer | Side Scheme | Wolverine Nemesis | - | 3 pips | `wolv` |
| `35030` | Death Factor | Attachment | Wolverine Nemesis | - | 2 pips | `wolv` |
| `35031` | Tentacle Strike | Treachery | Wolverine Nemesis | - | Star | `wolv` |
| `35032` | Command Center | Support | Pack Position: 32 | - | - | `wolv` |
| `35033` | Longshot | Ally | Pack Position: 33 | THW:2 ATK:2 HP:3 | - | `wolv` |
| `35034` | Lady Deathstrike | Minion | Deathstrike | SCH:1 ATK:2 HP:6 | 3 pips | `wolv` |
| `35035` | Seeking Vengeance | Side Scheme | Deathstrike | - | 3 pips | `wolv` |
| `35036` | Adamantium Upgrades | Attachment | Deathstrike | ATK:2 | 2 pips | `wolv` |
| `35037` | Hack 'n' Slash | Treachery | Deathstrike | - | Star | `wolv` |

---

## Pack: Wolverine (`wolv`)

### Set: Wolverine

### [35001a] Wolverine
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *X-Men.*
- **Rules Text**:
  > *Healing Factor* - **Response**: After the player phase begins, heal 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/35001a.png` (607×880 px, 132.9 KB)
### [35001b] Logan
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 6, **HP**: 10, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > *Snikt!* - **Setup**: Put Wolverine's Claws into play.
- **Image Asset**: `assets/card-art/bundles/cards/35001b.png` (607×880 px, 145.2 KB)
### [35002] Wolverine's Claws
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (1/16)
- **Properties**: Unique, Permanent
- **Stats**: **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Permanent.
  > **Hero Action**: Exhaust Wolverine's Claws, choose en [[ATTACK]] event in your hand, and take damage equal to its printed cost → play that event, ignoring its resource cost. That attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/35002.png` (607×880 px, 158.2 KB)
### [35003] Jubilee — *Jubilation Lee*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (2/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Jubilee enters play, choose an enemy. Until the end of the phase, while Wolverine or Jubilee is making a basic attack against that enemy, they get +2 ATK for that attack.
- **Image Asset**: `assets/card-art/bundles/cards/35003.png` (607×880 px, 142.4 KB)
### [35004] Adamantium Skeleton
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (3/16)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Rules Text**:
  > You get +4 hit points.
  > Wolverine gets +1 ATK and his basic attacks gain piercing.
- **Image Asset**: `assets/card-art/bundles/cards/35004.png` (607×880 px, 153.9 KB)
### [35005] Berserker Frenzy
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (4/16)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Hero Response**: After Wolverine takes any amount of damage from an enemy attack, draw 1 card.
  > **Forced Response**: After you flip to alter-ego form, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/35005.png` (607×880 px, 147.5 KB)
### [35006] "I Got Better"
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (5/16)
- **Stats**: **Cost**: 4, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Interrupt**: When you would be defeated by an enemy attack, instead set your hit point dial to 5, ready your identity, and discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/35006.png` (607×880 px, 138.9 KB)
### [35007] Logan's Cabin
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (6/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Logan's Cabin → shuffle 1 Wolverine card from you discard pile into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/35007.png` (607×880 px, 146.9 KB)
### [35008] Berserker Barrage
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (7–8/16, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If this attack defeats an enemy, you may take 2 damage to repeat this ability.
- **Image Asset**: `assets/card-art/bundles/cards/35008.png` (607×880 px, 161.3 KB)
### [35009] Slice and Dice
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (9–10/16, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action**: Make the following 2 attacks in order:
  > • Deal 3 damage to an enemy.
  > • Deal 3 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/35009.png` (607×880 px, 142.1 KB)
### [35010] Lunging Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (11–12/16, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 8 damage to an enemy. If you exhausted Wolverine's Claws to play this card, this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/35010.png` (607×880 px, 131.8 KB)
### [35011] Track by Scent
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (13–14/16, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. If this removes the last threat from that scheme, draw 2 cards.
- **Image Asset**: `assets/card-art/bundles/cards/35011.png` (607×880 px, 149.8 KB)
### [35012] Regenerative Healing
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (15–16/16, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Action**: Choose:
  > • Heal 4 damage from your identity.
  > • Discard each stunned and confused status card from your identity.
- **Image Asset**: `assets/card-art/bundles/cards/35012.png` (607×880 px, 137.7 KB)
### [35027] Past Demons
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wolverine Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Logan player***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Logan → remove Past Demons from the game.
  > • You are stunned and confused. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/35027.png` (607×880 px, 139.4 KB)

### Set: Aggression

### [35013] Psylocke — *Betsy Braddock*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > Psylocke enters play with 2 psionic counters on her.
  > [star] **Interrupt**: When Psylocke attacks an enemy, remove 1 psionic counter from her → confuse that enemy and deal 1 damage to it.
- **Image Asset**: `assets/card-art/bundles/cards/35013.png` (607×880 px, 137.5 KB)
### [35014] Sunfire — *Shiro Yoshida*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After you play Sunfire from your hand, spend a [energy] resource → choose an attachment with the text "**Hero Action**" or "**Hero Response**" and discard it.
- **Image Asset**: `assets/card-art/bundles/cards/35014.png` (607×880 px, 118.3 KB)
### [35015] Battle Fury
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control.
  > Max 1 per player.
  > **Response:** After your hero attacks and defeats a minion, deal 1 damage to your hero and discard Battle Fury → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/35015.png` (607×880 px, 152.5 KB)
### [35016] Warrior Skill
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > Uses (3 warrior counters). Max 1 per player.
  > **Interrupt**: When your hero attacks, remove 1 counter from here → that attack deals 1 additional damage.
- **Image Asset**: `assets/card-art/bundles/cards/35016.png` (607×880 px, 142.7 KB)
### [35017] Outta My Way!
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy (5 damage instead if that enemy has the guard or patrol keyword).
- **Image Asset**: `assets/card-art/bundles/cards/35017.png` (607×880 px, 136.0 KB)
### [35018] Precision Strike
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to an enemy. If this attack defeats that enemy, heal 2 damage from your hero.
- **Image Asset**: `assets/card-art/bundles/cards/35018.png` (607×880 px, 129.8 KB)
### [35019] Mean Swing
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When your hero makes a basic attack, exhaust a [[Weapon]] upgrade on your hero → your hero gets +3 ATK for this attack.
- **Flavor**: *SLASH!*
- **Image Asset**: `assets/card-art/bundles/cards/35019.png` (607×880 px, 131.2 KB)
### [35020] Aggressive Energy
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > **Hero Interrupt**: When you spend this card to play a [[Attack]] event, that event deals 1 additional damage.

### Set: Basic

### [35021] Colossus
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 3, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Reduce the cost to play Colossus by 1 if your identity has the [[MUTANT]] or [[X-MEN]] trait.
  > Toughness.
### [35022] Weapon X
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Play only if your identity has the [[MUTANT]] trait.
  > **Alter-Ego Action**: Exhaust Weapon X and take 1 damage → discard cards from your deck until you discard an identity-specific card, then add that card to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/35022.png` (607×880 px, 160.2 KB)
### [35023] Fastball Special
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Aerial. Attack.*
- **Rules Text**:
  > Team-Up (Colossus and Wolverine). Max 1 per deck.
  > **Hero Action** *(attack)*: Deal X damage to an enemy, where X is the total ATK of Colossus and Wolverine. This attack gains overkill and piercing.
- **Image Asset**: `assets/card-art/bundles/cards/35023.png` (607×880 px, 130.9 KB)
### [35024] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [35025] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [35026] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [35033] Longshot
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 33
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Play only if your identity has the [[X-MEN]] trait.
  > [star] **Response**: After Longshot attacks a non-[[ELITE]] minion, discard the top card of the encounter deck. If that card has a star icon ([star]) in the boost area, defeat the attacked minion.
- **Image Asset**: `assets/card-art/bundles/cards/35033.png` (607×880 px, 140.1 KB)

### Set: Wolverine Nemesis

### [35028] Omega Red
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine Nemesis (1/5)
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wolverine Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite.*
- **Rules Text**:
  > Retaliate 1. Steady.
  > [star] **Forced Interrupt**: When Omega Red attacks you, deal 1 damage to each character you control.
- **Flavor**: *My death factor will drain the life from your body!*
- **Image Asset**: `assets/card-art/bundles/cards/35028.png` (607×880 px, 140.8 KB)
### [35029] The Carbonadium Synthesizer
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine Nemesis (2/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wolverine Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > While the Carbonadium Synthesizer is in play, Omega Red cannot be defeated.
- **Flavor**: *Omega Red needs the Carbonadium Synthesizer to prevent his death factor from killing him.*
- **Image Asset**: `assets/card-art/bundles/cards/35029.png` (880×607 px, 197.8 KB)
### [35030] Death Factor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine Nemesis (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wolverine Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity.
  > **Forced Response:** After your turn ends, take 1 damage.
  > **Alter-Ego Interrupt:** When you make a basic recovery, discard this card instead of healing damage.
- **Image Asset**: `assets/card-art/bundles/cards/35030.png` (607×880 px, 148.2 KB)
### [35031] Tentacle Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Wolverine Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Wolverine Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are stunned. Take 1 damage (4 damage instead if you are already stunned).
  >
  > ---
  >
  > [star] **Boost**: You are stunned. Take 1 damage (4 damage instead if you are already stunned).
- **Image Asset**: `assets/card-art/bundles/cards/35031.png` (607×880 px, 147.3 KB)

### Set: Justice

### [35032] Command Center
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After an ally thwarts and defeats a side scheme, exhaust Command Center → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/35032.png` (607×880 px, 136.2 KB)

### Set: Deathstrike

### [35034] Lady Deathstrike
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Deathstrike (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deathstrike Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Reaver.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After Lady Deathstrike attacks and damages a character, that character's owner discards 1 random card from their hand.
- **Flavor**: *"This time I will carve your heart from your chest!"*
- **Image Asset**: `assets/card-art/bundles/cards/35034.png` (607×880 px, 121.7 KB)
### [35035] Seeking Vengeance
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Deathstrike (2/6)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deathstrike Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: If Lady Deathstrike is in play, she activates against you. Otherwise, search the encounter deck and discard pile for Lady Deathstrike and put her into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/35035.png` (880×607 px, 184.3 KB)
### [35036] Adamantium Upgrades
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Deathstrike (3–4/6, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deathstrike Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to an enemy without a copy of Adamantium Upgrades attached. Otherwise, this card gains surge.
  > [star] Attached enemy's attacks gain piercing.
  > **Hero Action**: Spend [energy] [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/35036.png` (607×880 px, 131.9 KB)
### [35037] Hack 'n' Slash
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Wolverine (`wolv`)
- **Deck / Set**: Deathstrike (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Deathstrike Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1 random card from your hand and take damage equal to the number of printed resources on it.
  >
  > ---
  >
  > [star] **Boost**: Discard 1 random card from your hand and take damage equal to the number of printed resources on it.
- **Image Asset**: `assets/card-art/bundles/cards/35037.png` (607×880 px, 123.0 KB)

