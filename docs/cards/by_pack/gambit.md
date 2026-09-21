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
| `37001a` | Gambit | Hero | Gambit | THW:1 ATK:2 DEF:3 HP:9 | - | `gambit` |
| `37001b` | Remy LeBeau | Alter-Ego | Gambit | REC:3 HP:9 | - | `gambit` |
| `37002` | Rogue | Ally | Gambit | THW:2 ATK:2 HP:3 | - | `gambit` |
| `37003` | The Thieves Guild | Support | Gambit | - | - | `gambit` |
| `37004` | Gambit's Staff | Upgrade | Gambit | - | - | `gambit` |
| `37005` | Gambit's Guild Armor | Upgrade | Gambit | - | - | `gambit` |
| `37006` | Charged Card | Event | Gambit | - | - | `gambit` |
| `37007` | Royal Flush | Event | Gambit | - | - | `gambit` |
| `37008` | Natural Agility | Event | Gambit | - | - | `gambit` |
| `37009` | Creole Charmer | Event | Gambit | - | - | `gambit` |
| `37010` | Molecular Acceleration | Resource | Gambit | - | - | `gambit` |
| `37011` | Bishop | Ally | Pack Position: 11 | THW:2 ATK:0 HP:3 | - | `gambit` |
| `37012` | Dazzler | Ally | Pack Position: 12 | THW:2 ATK:2 HP:3 | - | `gambit` |
| `37013` | Operative Skill | Upgrade | Pack Position: 13 | - | - | `gambit` |
| `37014` | Stealth Strike | Event | Pack Position: 14 | - | - | `gambit` |
| `37015` | Breaking and Entering | Event | Pack Position: 15 | - | - | `gambit` |
| `37016` | Passion for Justice | Resource | Pack Position: 16 | - | - | `gambit` |
| `37017` | Professor X | Ally | Pack Position: 17 | THW:3 ATK:0 HP:3 | - | `gambit` |
| `37018` | X-Mansion | Support | Pack Position: 18 | - | - | `gambit` |
| `37019` | Beauty and the Thief | Event | Pack Position: 19 | - | - | `gambit` |
| `37020` | Hit and Run | Event | Pack Position: 20 | - | - | `gambit` |
| `37021` | Mutant Education | Event | Pack Position: 21 | - | - | `gambit` |
| `37022` | Energy | Resource | Pack Position: 22 | - | - | `gambit` |
| `37023` | Genius | Resource | Pack Position: 23 | - | - | `gambit` |
| `37024` | Strength | Resource | Pack Position: 24 | - | - | `gambit` |
| `37025` | Guild Business | Obligation | Gambit | - | 2 icons | `gambit` |
| `37026` | Belladonna | Minion | Gambit Nemesis | SCH:2 ATK:3 HP:5 | 3 icons | `gambit` |
| `37027` | The Assassins Guild | Side Scheme | Gambit Nemesis | - | 3 icons | `gambit` |
| `37028` | Guild Assassin | Minion | Gambit Nemesis | SCH:1 ATK:2 HP:2 | 2 icons | `gambit` |
| `37029` | Assassination Attempt | Treachery | Gambit Nemesis | - | 1 icon | `gambit` |
| `37030` | War Room | Support | Pack Position: 30 | - | - | `gambit` |
| `37031` | X-Men Instruction | Event | Pack Position: 31 | - | - | `gambit` |
| `37032` | Exodus | Minion | Exodus | SCH:1 ATK:1 HP:6 | 3 icons | `gambit` |
| `37033` | Herald of Avalon | Side Scheme | Exodus | - | 3 icons | `gambit` |
| `37034` | Psionic Shield | Attachment | Exodus | SCH:1 ATK:1 | 2 icons | `gambit` |
| `37035` | Acolyte Frenzy | Treachery | Exodus | - | 0 icons + star | `gambit` |

---

## Pack: Gambit (`gambit`)

### Set: Gambit

### [37001a] Gambit
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 3, **HP**: 9, **Hand Size**: 5
- **Traits**: *Thief. X-Men.*
- **Rules Text**:
  > *Charge de Card* − **Action**: Place 1 charge counter here. (Limit once per round).
  > *Throw de Card* − **Interrupt**: When you play an [[ATTACK]] event, remove up to 3 charge counters from here → that event deal +1 damage for each counter removed.
- **Image Asset**: `assets/card-art/bundles/cards/37001a.png` (300×418 px, 223.1 KB)

### [37001b] Remy LeBeau
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Mutant. Thief.*
- **Rules Text**:
  > *Thief Extraordinaire* − **Action** *(thwart)*: Exhaust Remy LeBeau and look at the top 2 cards of the encounter deck. Discard 1 of those cards → remove threat from a scheme equal to the number of boost icons ([boost]) on that card.
- **Image Asset**: `assets/card-art/bundles/cards/37001b.png` (300×418 px, 178.3 KB)

### [37002] Rogue — *Anna Marie*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Aerial. X-Men.*
- **Rules Text**:
  > Reduce the cost to play Rogue by 1 for each charge counter on your identity.
  > Toughness.
- **Flavor**: *"I can't take that crazy Cajun anywhere!"*
- **Image Asset**: `assets/card-art/bundles/cards/37002.png` (710×1030 px, 296.1 KB)

### [37003] The Thieves Guild
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Guild.*
- **Rules Text**:
  > **Alter-Ego Response**: After you resolve your *"Thief Extraordinaire"* ability, exhaust The Thieves Guild → remove 1 threat from a scheme. If this removes the last threat from that scheme, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/37003.png` (710×1030 px, 329.6 KB)

### [37004] Gambit's Staff
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Item. Weapon.*
- **Rules Text**:
  > **Hero Interrupt**: When an enemy attacks, exhaust Gambit's Staff → deal 1 damage to that enemy.
- **Flavor**: *"You want to fight wit' Gambit, eh?" −Gambit*
- **Image Asset**: `assets/card-art/bundles/cards/37004.png` (710×1030 px, 335.1 KB)

### [37005] Gambit's Guild Armor
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (4/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor. Item.*
- **Rules Text**:
  > **Hero Response**: After Gambit defends against an attack and takes no damage, exhaust Gambit's Guild Armor → ready Gambit.
- **Flavor**: *Members of the Thieves Guild wear custom armor to protect themselves from assassins.*
- **Image Asset**: `assets/card-art/bundles/cards/37005.png` (710×1030 px, 350.9 KB)

### [37006] Charged Card
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (5–7/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. For this attack, If Gambit's *"Throw de Card"* ability removed at least:
  > • 1 counter, this attack gains ranged.
  > • 2 counters, this attack also gains piercing.
  > • 3 counters, this attack also gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/37006.png` (710×1030 px, 307.2 KB)

### [37007] Royal Flush
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (8–9/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Place 1 charge counter on Gambit. Deal 0 damage to an enemy. Deal 0 damage to an enemy. Deal 0 damage to an enemy.
- **Flavor**: *"Cover your eyes, mes amis. Dis hand gon' be fire!" −Gambit*
- **Image Asset**: `assets/card-art/bundles/cards/37007.png` (710×1030 px, 330.5 KB)

### [37008] Natural Agility
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (10–11/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Defense. Superpower.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you defend against an attack, place 1 charge counter on Gambit → for each charge counter on Gambit, you get +1 DEF for that attack.
- **Image Asset**: `assets/card-art/bundles/cards/37008.png` (710×1030 px, 363.6 KB)

### [37009] Creole Charmer
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (12–13/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Alter-Ego Action** *(thwart)*: Remove 3 threat from a scheme. If this removes the last threat from that scheme, confuse the villain.
- **Flavor**: *"How can I be de thief when you de one stole my heart, chére?" −Gambit*
- **Image Asset**: `assets/card-art/bundles/cards/37009.png` (710×1030 px, 324.8 KB)

### [37010] Molecular Acceleration
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (14–15/15, Qty: 2)
- **Stats**: **Resources**: [energy] [physical]
- **Rules Text**:
  > **Hero Interrupt**: When you spend this card, place 1 charge counter on Gambit.
- **Image Asset**: `assets/card-art/bundles/cards/37010.png` (710×1030 px, 335.1 KB)

### [37025] Guild Business
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gambit Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > ***Give to the Remy LeBeau player.***
  > **Alter-Ego Action**: Exhaust Remy LeBeau and spend a [energy] resource → remove Guild Business from the game.
- **Image Asset**: `assets/card-art/bundles/cards/37025.png` (710×1030 px, 314.5 KB)


### Set: Justice

### [37011] Bishop — *Lucas Bishop*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 0 [star] (Consequential: 2), **HP**: 3, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After an enemy attacks you, place 1 energy counter here.
  > [star] **Interrupt**: When Bishop attacks, remove each energy counter from him → for each counter discarded this way, he gets +2 ATK for this attack (to a maximum of +6 ATK).
- **Image Asset**: `assets/card-art/bundles/cards/37011.png` (710×1030 px, 351.5 KB)

### [37012] Dazzler — *Alison Blaire*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Dazzler enters play, confuse an enemy.
- **Flavor**: *"All that noise. This city is a symphony, and I'm her speaker."*
- **Image Asset**: `assets/card-art/bundles/cards/37012.png` (710×1030 px, 348.9 KB)

### [37013] Operative Skill
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Uses (3 operative counters). Max 1 per player.
  > **Interrupt**: When you thwart, remove 1 operative counter from here → that thwart removes 1 additional threat.
- **Image Asset**: `assets/card-art/bundles/cards/37013.png` (710×1030 px, 293.1 KB)

### [37014] Stealth Strike
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If that enemy is defeated by this attack, remove 2 threat from a scheme.
- **Flavor**: *"They'll never know what hit them." —Black Widow*
- **Image Asset**: `assets/card-art/bundles/cards/37014.png` (710×1030 px, 269.0 KB)

### [37015] Breaking and Entering
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Play only if your identity has the [[SPY]] or [[THIEF]] trait.
  > **Action** *(thwart)*: Remove 3 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/37015.png` (710×1030 px, 323.9 KB)

### [37016] Passion for Justice
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > **Interrupt**: When you spend this card to play a [[THWART]] event, that event removes 1 additional threat.


### Set: Basic

### [37017] Professor X — *Charles Xavier*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 3 (Consequential: 1), **ATK**: 0 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > **Forced Response**: After Professor X enters play, choose one: confuse the villain, stun a minion, or ready an [[X-MEN]] character. At the end of the round, if Professor X is still in play, discard him.

### [37018] X-Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Location. X-Men.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust X-Mansion → heal 1 damage from a [[MUTANT]] or [[X-MEN]] character. Any player whose alter-ego has the [[MUTANT]] trait may trigger this ability.

### [37019] Beauty and the Thief
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > Team-Up (Gambit and Rogue). Max 1 per deck.
  > **Hero Action** *(attack/thwart)*: Deal 4 damage to an enemy. Remove 4 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/37019.png` (710×1030 px, 372.4 KB)

### [37020] Hit and Run
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > **Hero Action** *(attack/thwart)*: Deal 2 damage to an enemy. Remove 2 threat from a scheme.
- **Flavor**: *"You'd be surprised how many problems you can solve with a controlled plasma blast" −Havok*
- **Image Asset**: `assets/card-art/bundles/cards/37020.png` (710×1030 px, 305.1 KB)

### [37021] Mutant Education
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > Play only if your identity has the [[MUTANT]] trait.
  > **Alter-Ego Action**: Choose up to 2 identity-specific cards in your discard pile and shuffle them into your deck. If X-Mansion is in play, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/37021.png` (710×1030 px, 320.6 KB)

### [37022] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [37023] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [37024] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [37031] X-Men Instruction
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > Play only if your identity has the [[MUTANT]] trait.
  > **Alter-Ego Action**: Choose up to 2 [[X-MEN]] allies in your discard pile and shuffle them into your deck. If X-Mansion is in play, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/37031.png` (710×1030 px, 311.3 KB)


### Set: Gambit Nemesis

### [37026] Belladonna
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gambit Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Elite.*
- **Rules Text**:
  > Quickstrike. Toughness.
  > [star] **Forced Response**: After Belladonna attacks and defeats a character, place 2 threat on the main scheme.
  > *(Gambit's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/37026.png` (710×1030 px, 295.6 KB)

### [37027] The Assassins Guild
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit Nemesis (2/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gambit Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Response**: After an [[ASSASSIN]] minion attacks and defeats a character, place 2 threat here.
- **Flavor**: *The Assassins Guild has sworn to kill Gambit and the rest of the Thieves Guild.*
- **Image Asset**: `assets/card-art/bundles/cards/37027.png` (1030×710 px, 340.1 KB)

### [37028] Guild Assassin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gambit Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After Guild Assassin attacks and defeats a character, place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/37028.png` (710×1030 px, 288.6 KB)

### [37029] Assassination Attempt
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Gambit Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gambit Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[ASSASSIN]] minion attacks you *(even if you are in alter-ego form)*. If there are no [[ASSASSIN]] minions in play, search the encounter deck and discard pile for an [[ASSASSIN]] minion and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/37029.png` (710×1030 px, 378.7 KB)


### Set: Aggression

### [37030] War Room
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After an ally attacks and defeats a minion, exhaust War Room → remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/37030.png` (710×1030 px, 303.2 KB)


### Set: Exodus

### [37032] Exodus
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Exodus (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Exodus Set Icon (printed bottom-right next to deck number)
- **Traits**: *Acolyte. Elite. Psionic.*
- **Rules Text**:
  > Retaliate 1. Villainous.
  > **When Revealed**: Search the encounter deck and discard pile for the Psionic Shield attachment and attach it to Exodus. *(Shuffle.)*
- **Flavor**: *"I serve proudly in the house and name of Magneto!"*
- **Image Asset**: `assets/card-art/bundles/cards/37032.png` (710×1030 px, 346.6 KB)

### [37033] Herald of Avalon
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Exodus (2/6)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Exodus Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme searches the encounter deck and discard pile for Exodus and reveals him. *(Shuffle.)*
- **Flavor**: *Exodus sees Magneto as the savior of mutantkind and serves as his herald.*
- **Image Asset**: `assets/card-art/bundles/cards/37033.png` (1030×710 px, 317.4 KB)

### [37034] Psionic Shield
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Exodus (3–4/6, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Exodus Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic.*
- **Rules Text**:
  > Attach to a minion. Otherwise, Psionic Shield gains surge.
  > **Forced Interrupt**: When attached minion would leave play, instead heal all damage from that minion. Then, discard this attachment.
- **Errata (FFG)**:
  > Removed “and put it back into play”. (RRG 1.6)
- **Image Asset**: `assets/card-art/bundles/cards/37034.png` (710×1030 px, 306.6 KB)

### [37035] Acolyte Frenzy
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Gambit (`gambit`)
- **Deck / Set**: Exodus (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Exodus Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[ACOLYTE]] minion engaged with you activates against you. If you are not engaged with an [[ACOLYTE]] minion, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: You are stunned and confused.
- **Image Asset**: `assets/card-art/bundles/cards/37035.png` (710×1030 px, 290.5 KB)


