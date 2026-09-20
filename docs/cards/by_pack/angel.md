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
| `42001a` | Angel | Hero | Angel | THW:2 ATK:1 DEF:2 HP:12 | - | `angel` |
| `42001b` | Warren Worthington III | Alter-Ego | Angel | HP:12 | - | `angel` |
| `42001c` | Archangel | Hero | Angel | THW:0 ATK:2 DEF:3 HP:12 | - | `angel` |
| `42002` | Psylocke | Ally | Angel | THW:1 ATK:1 HP:3 | - | `angel` |
| `42003` | Adaptive Plumage | Event | Angel | - | - | `angel` |
| `42004` | Aerial Agility | Event | Angel | - | - | `angel` |
| `42005` | Metamorphosis | Event | Angel | - | - | `angel` |
| `42006` | Natural Flight | Event | Angel | - | - | `angel` |
| `42007` | Razor Dive | Event | Angel | - | - | `angel` |
| `42008` | Avian Anatomy | Resource | Angel | - | - | `angel` |
| `42009` | Worthington Industries | Support | Angel | - | - | `angel` |
| `42010` | Techno-Organic Wings | Upgrade | Angel | - | - | `angel` |
| `42011` | Elixir | Ally | Pack Position: 11 | THW:1 ATK:1 HP:3 | - | `angel` |
| `42012` | Siryn | Ally | Pack Position: 12 | THW:2 ATK:2 HP:3 | - | `angel` |
| `42013` | Warpath | Ally | Pack Position: 13 | THW:2 ATK:2 HP:4 | - | `angel` |
| `42014` | Aerial Intervention | Event | Pack Position: 14 | - | - | `angel` |
| `42015` | Ever Vigilant | Event | Pack Position: 15 | - | - | `angel` |
| `42016` | Taunt | Event | Pack Position: 16 | - | - | `angel` |
| `42017` | Render Medical Aid | Player Side Scheme | Pack Position: 17 | - | - | `angel` |
| `42018` | Angel's Aerie | Support | Pack Position: 18 | - | - | `angel` |
| `42019` | Containment Strategy | Upgrade | Pack Position: 19 | - | - | `angel` |
| `42020` | Cannonball | Ally | Pack Position: 20 | THW:2 ATK:2 HP:2 | - | `angel` |
| `42021` | Soaring Hearts | Event | Pack Position: 21 | - | - | `angel` |
| `42022` | The Power of Flight | Resource | Pack Position: 22 | - | - | `angel` |
| `42023` | Soaring Acrobatics | Upgrade | Pack Position: 23 | - | - | `angel` |
| `42024` | Apocalyptic Influence | Obligation | Angel | - | 2 pips | `angel` |
| `42025` | Harpoon | Minion | Angel Nemesis | SCH:1 ATK:1 HP:6 | 2 pips | `angel` |
| `42026` | Hook, Line, and Sinker | Side Scheme | Angel Nemesis | - | 3 pips | `angel` |
| `42027` | Harpoon's Harpoon | Attachment | Angel Nemesis | ATK:1 | 2 pips | `angel` |
| `42028` | Spear Shot | Treachery | Angel Nemesis | - | Star | `angel` |
| `42029` | Bombs Away | Event | Pack Position: 29 | - | - | `angel` |
| `42030` | Eyes in the Sky | Upgrade | Pack Position: 30 | - | - | `angel` |
| `42031` | Flying Formation | Event | Pack Position: 31 | - | - | `angel` |
| `42032` | X-Force Recruit | Upgrade | Pack Position: 32 | - | - | `angel` |

---

## Pack: Angel (`angel`)

### Set: Angel

### [42001a] Angel
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1, **DEF**: 2, **HP**: 12, **Hand Size**: 5
- **Traits**: *Aerial. X-Force.*
- **Rules Text**:
  > *Angel of Life* — **Response**: After you play an [[AERIAL]] event, draw 1 card. (Limit once per phase.)
- **Flavor**: *"I never feel freer than when I'm flying!"*
- **Image Asset**: `assets/card-art/bundles/cards/42001a.png` (300×418 px, 71.2 KB)
### [42001b] Warren Worthington III
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 12, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > *Regrowth* — **Action**: Heal 1 damage from Warren Worthington III. (Limit once per round.)
- **Flavor**: *"I have to keep my wings bound—to hide who I am—to live in this society."*
- **Image Asset**: `assets/card-art/bundles/cards/42001b.png` (300×418 px, 76.7 KB)
### [42001c] Archangel
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 0, **ATK**: 2, **DEF**: 3, **HP**: 12, **Hand Size**: 5
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Aerial. X-Force.*
- **Rules Text**:
  > *Angel of Death* — **Response**: After you play an [[AERIAL]] event, deal damage to an enemy equal to that event's printed cost. (Limit once per phase.)
- **Image Asset**: `assets/card-art/bundles/cards/42001c.png` (600×430 px, 433.3 KB)
### [42002] Psylocke — *Betsy Braddock*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Psionic. X-Force.*
- **Rules Text**:
  > [star] **Hero Response**: After Psylocke attacks, if you are:
  > • Angel, heal 1 damage from Psylocke.
  > • Archangel, ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/42002.png` (710×1030 px, 316.4 KB)
### [42003] Adaptive Plumage
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (2–3/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Aerial. Attack. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: If you are Angel, remove 3 threat from a scheme and confuse an enemy.
  > **Hero Action** *(attack)*: If you are Archangel, deal 4 damage to an enemy and stun it.
- **Image Asset**: `assets/card-art/bundles/cards/42003.png` (710×1030 px, 326.0 KB)
### [42004] Aerial Agility
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (4–5/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Aerial. Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When an enemy attacks, if you are:
  > • Angel, ignore each boost icon ([boost]) and each "Boost" ability for this attack.
  > • Archangel, give your hero a tough status card and gain retaliate 1 for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/42004.png` (710×1030 px, 405.0 KB)
### [42005] Metamorphosis
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (6–7/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Aerial.*
- **Rules Text**:
  > **Action**: Change form. Then, if you are:
  > • Warren Worthington III, draw 1 card.
  > • Angel, remove 2 threat from a scheme.
  > • Archangel, deal 3 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/42005.png` (710×1030 px, 325.2 KB)
### [42006] Natural Flight
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (8–9/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Aerial. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 4 threat from a scheme. If you are Angel, this thwart ignores the crisis icon ([crisis]) and the patrol keyword.
- **Flavor**: *"Just relax and enjoy the flight." —Angel*
- **Image Asset**: `assets/card-art/bundles/cards/42006.png` (710×1030 px, 307.9 KB)
### [42007] Razor Dive
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (10–11/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Aerial. Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 6 damage to an enemy. If you are Archangel, this attack gains overkill and piercing.
- **Flavor**: *Apocalypse replaced Angel's natural wings with razor-sharp, techno-organic ones.*
- **Image Asset**: `assets/card-art/bundles/cards/42007.png` (710×1030 px, 315.7 KB)
### [42008] Avian Anatomy
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (12–13/15, Qty: 2)
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > **Response**: After you spend this card to pay for an [[AERIAL]] event, return that event to your hand after resolving its effects.
- **Image Asset**: `assets/card-art/bundles/cards/42008.png` (710×1030 px, 302.7 KB)
### [42009] Worthington Industries
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (14/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Action**: Exhaust Worthington Industries → shuffle 1 [[AERIAL]] card from your discard pile into your deck. If you are in alter-ego form, draw 1 card.
- **Flavor**: *As CEO, Warren has the vast resources of the family-owned Worthington Industries at his disposal.*
- **Image Asset**: `assets/card-art/bundles/cards/42009.png` (710×1030 px, 331.8 KB)
### [42010] Techno-Organic Wings
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (15/15)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Superpower. Tech.*
- **Rules Text**:
  > **Hero Action**: Exhaust Techno-Organic Wings → if you are:
  > • Angel, ready your hero.
  > • Archangel, reduce the cost of the next [[AERIAL]] event card you play from your hand this phase by 2.
- **Image Asset**: `assets/card-art/bundles/cards/42010.png` (710×1030 px, 351.5 KB)
### [42024] Apocalyptic Influence
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Angel Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > ***Give to the Warren Worthington III player.***
  > **When Revealed**: If you are in Archangel form, place 2 threat on the main scheme. Otherwise, change to Archangel form.
  > **Alter-Ego Action**: Deal the first player 1 encounter card → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/42024.png` (710×1030 px, 311.5 KB)

### Set: Protection

### [42011] Elixir — *Josh Foley*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 [star] (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *X-Force.*
- **Rules Text**:
  > Play only if your identity has the [[X-Force]] or [[X-Men]] trait.
  > [star] **Response**: After Elixir attacks or thwarts, heal 1 damage from another friendly character.
- **Image Asset**: `assets/card-art/bundles/cards/42011.png` (710×1030 px, 285.7 KB)
### [42012] Siryn — *Theresa Cassidy*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Aerial. X-Force.*
- **Rules Text**:
  > [star] **Response**: After Siryn attacks, stun a minion.
- **Flavor**: *"EEEEEEEEEEEEEEEEEEEEEEEE!"*
- **Image Asset**: `assets/card-art/bundles/cards/42012.png` (710×1030 px, 310.6 KB)
### [42013] Warpath — *James Proudstar*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 1), **HP**: 4, **Resources**: [energy]
- **Traits**: *Aerial. X-Force.*
- **Rules Text**:
  > Toughness.
  > **Hero Response**: After Warpath defends against an attack, play an event with a "**Hero Action**" ability from your hand *(paying its cost)*.
- **Image Asset**: `assets/card-art/bundles/cards/42013.png` (710×1030 px, 320.6 KB)
### [42014] Aerial Intervention
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Aerial.*
- **Rules Text**:
  > **Interrupt**: When a character would take any amount of damage from an attack, exhaust an [[AERIAL]] character you control → prevent up to 3 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/42014.png` (710×1030 px, 330.9 KB)
### [42015] Ever Vigilant
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Aerial. Skill.*
- **Rules Text**:
  > Play only if your identity has the [[aerial]] trait.
  > **Hero Action**: Ready your hero and remove 2 threat from the main scheme.
- **Flavor**: *"I do everything like a hawk." —Archangel*
- **Image Asset**: `assets/card-art/bundles/cards/42015.png` (710×1030 px, 309.5 KB)
### [42016] Taunt
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: The villain attacks you. Other characters cannot defend against this attack. Draw 3 cards.
- **Flavor**: *"Hey! Fido! Who let you off your leash?" —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/42016.png` (710×1030 px, 313.5 KB)
### [42017] Render Medical Aid
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Protection
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 3 per hero, **Resources**: [mental]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player heals a total of 5 damage from among characters they control.
- **Flavor**: *"Get the critical cases back to the mansion for treatment." —Beast*
- **Image Asset**: `assets/card-art/bundles/cards/42017.png` (1030×710 px, 278.6 KB)
### [42018] Angel's Aerie
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Response**: After you defend against an attack, place 1 fatigue counter here.
  > **Alter-Ego Action**: Remove each fatigue counter from here → heal 1 damage from your identity for each fatigue counter removed this way.
- **Image Asset**: `assets/card-art/bundles/cards/42018.png` (710×1030 px, 282.6 KB)
### [42019] Containment Strategy
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a non-permanent side scheme. Max 1 per side scheme.
  > **Response**: After a hero defends against an attack, remove 1 threat from attached scheme (2 threat instead if that hero took no damage from that attack).
- **Image Asset**: `assets/card-art/bundles/cards/42019.png` (710×1030 px, 382.5 KB)

### Set: Basic

### [42020] Cannonball — *Sam Guthrie*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 2), **HP**: 2, **Resources**: [physical]
- **Traits**: *Aerial. X-Force.*
- **Rules Text**:
  > **Interrupt**: When Cannonball would take any amount of consequential damage, reduce that amount by X, where X is the number of [[AERIAL]] cards in your hand.
- **Flavor**: *"Best get outta my way when Ah'm blastin'!"*
- **Image Asset**: `assets/card-art/bundles/cards/42020.png` (710×1030 px, 316.6 KB)
### [42021] Soaring Hearts
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Aerial. Psionic.*
- **Rules Text**:
  > Team-Up (Angel and Psylocke). Max 1 per deck.
  > **Hero Action**: Search your discard pile for an identity-specific event and add it to your hand. Ready Angel and Psylocke.
- **Image Asset**: `assets/card-art/bundles/cards/42021.png` (600×836 px, 150.0 KB)
### [42022] The Power of Flight
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [energy]
- **Rules Text**:
  > Double the number of resources this card generates while paying for an [[AERIAL]] card.
- **Image Asset**: `assets/card-art/bundles/cards/42022.png` (710×1030 px, 358.1 KB)
### [42023] Soaring Acrobatics
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Hero Interrupt**: When an [[AERIAL]] character you control uses a basic power, exhaust Soaring Acrobatics → that character gets +1 to that power for this use.
- **Image Asset**: `assets/card-art/bundles/cards/42023.png` (710×1030 px, 344.2 KB)
### [42032] X-Force Recruit
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > Play only if your identity has the [[X-FORCE]] trait.
  > Attach to a friendly character. Max 1 per character.
  > Attached character gets +1 hit point and gains the [[X-FORCE]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/42032.png` (710×1030 px, 368.6 KB)

### Set: Angel Nemesis

### [42025] Harpoon
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Angel Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > [star] Harpoon gets +1 ATK while attacking a character with the [[AERIAL]] trait.
  > **When Revealed**: Discard cards from the top of your deck until you discard an event. Take indirect damage equal to that event's printed cost.
- **Image Asset**: `assets/card-art/bundles/cards/42025.png` (710×1030 px, 318.0 KB)
### [42026] Hook, Line, and Sinker
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Angel Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each attack from a [[BRUTE]] enemy deals indirect damage.
  > **Forced Response**: After a friendly character takes any amount of indirect damage, exhaust that character.
- **Flavor**: *"I'm gonna bag me a bird." —Harpoon*
- **Image Asset**: `assets/card-art/bundles/cards/42026.png` (1030×710 px, 322.3 KB)
### [42027] Harpoon's Harpoon
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel Nemesis (3/5)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Angel Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to Harpoon. If Harpoon is not in play, search the encounter deck and discard pile for him, reveal him, and attach this card to him. If you cannot, this card gains surge.
  > [star] **Forced Response:** After Harpoon attacks you, take 2 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/42027.png` (710×1030 px, 315.0 KB)
### [42028] Spear Shot
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Angel (`angel`)
- **Deck / Set**: Angel Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Angel Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Discard cards from the top of your deck until you discard an event. Take indirect damage equal to that event's printed cost. If that event has the [[AERIAL]] trait, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Take 2 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/42028.png` (710×1030 px, 338.9 KB)

### Set: Aggression

### [42029] Bombs Away
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Aerial. Tactic.*
- **Rules Text**:
  > **Hero Action**: Exhaust an [[AERIAL]] character you control and choose a player → deal 3 damage to the villain and each minion engaged with that player.
- **Image Asset**: `assets/card-art/bundles/cards/42029.png` (710×1030 px, 355.8 KB)

### Set: Justice

### [42030] Eyes in the Sky
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Aerial. Preparation.*
- **Rules Text**:
  > **Hero Interrupt**: When you reveal a non-[[ELITE]] minion, exhaust an [[AERIAL]] character you control and discard this card → cancel the effects of that card and discard it. Then, reveal another card from the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/42030.png` (710×1030 px, 349.9 KB)

### Set: Leadership

### [42031] Flying Formation
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Angel (`angel`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Aerial. Tactic.*
- **Rules Text**:
  > Alliance. *(The players can pay this card's costs as a group.)*
  > **Hero Action**: Ready up to 3 [[AERIAL]] characters.
- **Flavor**: *"Bobby, form up on me!" —Archangel*
- **Image Asset**: `assets/card-art/bundles/cards/42031.png` (710×1030 px, 367.2 KB)

