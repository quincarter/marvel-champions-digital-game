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
| `47001a` | Jubilee | Hero | Jubilee | THW:1 ATK:1 DEF:2 HP:9 | - | `jubilee` |
| `47001b` | Jubilation Lee | Alter-Ego | Jubilee | HP:9 | - | `jubilee` |
| `47002` | Wolverine | Ally | Jubilee | THW:1 ATK:3 HP:4 | - | `jubilee` |
| `47003` | Shopping Spree | Player Side Scheme | Jubilee | - | - | `jubilee` |
| `47004` | Jubilee's Coat | Upgrade | Jubilee | - | - | `jubilee` |
| `47005` | Jubilee's Sunglasses | Upgrade | Jubilee | - | - | `jubilee` |
| `47006` | Blinding Flash | Event | Jubilee | - | - | `jubilee` |
| `47007a` | Firecracker | Event | Jubilee | - | - | `jubilee` |
| `47007b` | Firecracker | Event | Jubilee | - | - | `jubilee` |
| `47007c` | Firecracker | Event | Jubilee | - | - | `jubilee` |
| `47008a` | Flash of Light | Event | Jubilee | - | - | `jubilee` |
| `47008b` | Flash of Light | Event | Jubilee | - | - | `jubilee` |
| `47008c` | Flash of Light | Event | Jubilee | - | - | `jubilee` |
| `47009` | Grande Finale | Event | Jubilee | - | - | `jubilee` |
| `47010a` | Plasmoid Energy | Resource | Jubilee | - | - | `jubilee` |
| `47010b` | Plasmoid Energy | Resource | Jubilee | - | - | `jubilee` |
| `47010c` | Plasmoid Energy | Resource | Jubilee | - | - | `jubilee` |
| `47011` | Chamber | Ally | Pack Position: 11 | THW:2 ATK:2 HP:3 | - | `jubilee` |
| `47012` | Husk | Ally | Pack Position: 12 | THW:2 ATK:2 HP:3 | - | `jubilee` |
| `47013` | Disguise | Upgrade | Pack Position: 13 | - | - | `jubilee` |
| `47014` | Waylay | Event | Pack Position: 14 | - | - | `jubilee` |
| `47015` | Three Steps Ahead | Event | Pack Position: 15 | - | - | `jubilee` |
| `47016` | Generation X | Player Side Scheme | Pack Position: 16 | - | - | `jubilee` |
| `47017` | The Power of Justice | Resource | Pack Position: 17 | - | - | `jubilee` |
| `47018` | Synch | Ally | Pack Position: 18 | THW:1 ATK:1 HP:3 | - | `jubilee` |
| `47019` | Cell Phone | Upgrade | Pack Position: 19 | - | - | `jubilee` |
| `47020` | X-Gene | Upgrade | Pack Position: 20 | - | - | `jubilee` |
| `47021` | Multitalented | Event | Pack Position: 21 | - | - | `jubilee` |
| `47022` | Unlikely Duo | Event | Pack Position: 22 | - | - | `jubilee` |
| `47023` | Grounded | Obligation | Jubilee | - | 2 pips | `jubilee` |
| `47024` | Nanny | Minion | Jubilee Nemesis | SCH:2 ATK:1 HP:4 | 2 pips | `jubilee` |
| `47025` | Naughty Children | Side Scheme | Jubilee Nemesis | - | 2 pips | `jubilee` |
| `47026` | Battle Suit | Attachment | Jubilee Nemesis | ATK:1 | 2 pips | `jubilee` |
| `47027` | "Lost" Child | Attachment | Jubilee Nemesis | SCH:-1 | 1 pips | `jubilee` |
| `47028` | Mutant Mayhem | Event | Pack Position: 28 | - | - | `jubilee` |
| `47029` | Serve and Protect | Event | Pack Position: 29 | - | - | `jubilee` |
| `47030` | Arcade | Minion | Arcade | SCH:2 ATK:2 HP:3 | 3 pips | `jubilee` |
| `47031` | Welcome to Murderworld | Side Scheme | Arcade | - | 2 pips | `jubilee` |
| `47032` | Arcade's Funhouse | Side Scheme | Arcade | - | 2 pips | `jubilee` |
| `47033` | Hall of Mirrors | Side Scheme | Arcade | - | 2 pips | `jubilee` |
| `47034` | Elaborate Trap | Treachery | Arcade | - | 1 pips | `jubilee` |

---

## Pack: Jubilee (`jubilee`)

### Set: Jubilee

### [47001a] Jubilee
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 2, **HP**: 9, **Hand Size**: 5
- **Traits**: *X-Men.*
- **Rules Text**:
  > *"Like, totally!"* — **Resource**: Exhaust Jubilee → generate a [wild] resource.
- **Flavor**: *"You should know I get torqued when people ignore me!"*
- **Image Asset**: `assets/card-art/bundles/cards/47001a.png` (300×426 px, 185.4 KB)
### [47001b] Jubilation Lee
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > *Mall Rat* — **Action**: Search your deck for the Shopping Spree player side scheme and put it into play. (Limit once per phase.)
- **Flavor**: *"This place was sooo much cooler when I lived here!"*
- **Image Asset**: `assets/card-art/bundles/cards/47001b.png` (300×426 px, 191.5 KB)
### [47002] Wolverine — *Logan*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 3 [star] (Consequential: 2), **HP**: 4, **Resources**: [wild]
- **Traits**: *X-Men.*
- **Rules Text**:
  > [star] Wolverine's attacks gain piercing.
  > **Response**: After you change to alter-ego form, heal 3 damage from Wolverine.
- **Flavor**: *"Pipe down, squirt. We ain't here on holiday!"*
- **Image Asset**: `assets/card-art/bundles/cards/47002.png` (600×852 px, 199.2 KB)
### [47003] Shopping Spree
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 2, **Resources**: [wild]
- **Rules Text**:
  > Threat cannot be removed from this scheme by heroes or allies.
  > **Alter-Ego Action**: Exhaust your identity → remove 1 threat from here. Any player may trigger this ability.
  > **When Defeated**: The player who defeated this scheme searches their deck and discard pile for an [[Item]] card and puts it into play.
- **Image Asset**: `assets/card-art/bundles/cards/47003.jpg` (852×600 px, 199.8 KB)
### [47004] Jubilee's Coat
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Item.*
- **Rules Text**:
  > Jubilee gets +1 THW.
  > **Hero Response** *(thwart)*: After you play a [[Thwart]] event, exhaust Jubilee's Coat and choose a scheme → remove 1 threat from that scheme for each different resource type used to pay for that event.
- **Image Asset**: `assets/card-art/bundles/cards/47004.png` (600×852 px, 218.9 KB)
### [47005] Jubilee's Sunglasses
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (4/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Item.*
- **Rules Text**:
  > Jubilee gets +1 ATK.
  > **Hero Response** *(attack)*: After you play an [[Attack]] event, exhaust Jubilee's Sunglasses and choose an enemy → deal 1 damage to that enemy for each different resource type used to pay for that event.
- **Image Asset**: `assets/card-art/bundles/cards/47005.jpg` (600×852 px, 177.8 KB)
### [47006] Blinding Flash
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (5/15)
- **Stats**: **Cost**: 3, **Resources**: [wild]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Choose X enemies, where X is the number of different resource types *([energy], [mental], [physical], and [wild])* used to pay for this event. Stun and confuse each chosen enemy.
- **Image Asset**: `assets/card-art/bundles/cards/47006.jpg` (600×852 px, 178.4 KB)
### [47007a] Firecracker
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (6/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If you paid for this card using 2 different resource types, stun that enemy.
- **Flavor**: *"Where do they find all these henchmen? Must be a discount store somewhere." —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/47007a.png` (289×419 px, 249.3 KB)
### [47007b] Firecracker
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (7/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If you paid for this card using 2 different resource types, stun that enemy.
- **Flavor**: *"Where do they find all these henchmen? Must be a discount store somewhere." —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/47007b.png` (289×419 px, 249.6 KB)
### [47007c] Firecracker
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (8/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If you paid for this card using 2 different resource types, stun that enemy.
- **Flavor**: *"Where do they find all these henchmen? Must be a discount store somewhere." —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/47007c.png` (289×419 px, 248.3 KB)
### [47008a] Flash of Light
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (9/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. If you paid for this card using 2 different resource types, confuse an enemy.
- **Flavor**: *"That's enough for me, folks. I'm out!" —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/47008a.png` (289×419 px, 242.1 KB)
### [47008b] Flash of Light
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (10/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. If you paid for this card using 2 different resource types, confuse an enemy.
- **Flavor**: *"That's enough for me, folks. I'm out!" —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/47008b.png` (289×419 px, 241.0 KB)
### [47008c] Flash of Light
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (11/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. If you paid for this card using 2 different resource types, confuse an enemy.
- **Flavor**: *"That's enough for me, folks. I'm out!" —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/47008c.png` (289×419 px, 246.8 KB)
### [47009] Grande Finale
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (12/15)
- **Stats**: **Cost**: 3, **Resources**: [wild]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to an enemy. For each different resource type *([energy], [mental], [physical], and [wild])* you used to pay for this card, choose an enemy and deal 2 damage to it.
- **Image Asset**: `assets/card-art/bundles/cards/47009.jpg` (710×1030 px, 386.9 KB)
### [47010a] Plasmoid Energy
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (13/15)
- **Stats**: **Resources**: [energy] [mental]
- **Flavor**: *"Cover your eyes, team! It's about to get lit!" —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/47010a.png` (289×419 px, 253.7 KB)
### [47010b] Plasmoid Energy
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (14/15)
- **Stats**: **Resources**: [energy] [physical]
- **Flavor**: *"Cover your eyes, team! It's about to get lit!" —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/47010b.png` (289×419 px, 255.5 KB)
### [47010c] Plasmoid Energy
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (15/15)
- **Stats**: **Resources**: [physical] [mental]
- **Flavor**: *"Cover your eyes, team! It's about to get lit!" —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/47010c.png` (289×419 px, 251.4 KB)
### [47023] Grounded
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jubilee Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Jubilation Lee player.***
  > As an additional cost to change to hero form during your turn, you must spend 2 resources of the same type.
  > **When Revealed**: Change to alter-ego form.
  > **Response**: After you play a Jubilee event, remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/47023.png` (710×1030 px, 292.1 KB)

### Set: Justice

### [47011] Chamber — *Jono Starsmore*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > [star] Chamber takes -1 consequential damage ([cost]) after he attacks a confused enemy.
- **Flavor**: *"Don't worry about me, luv — I've got this."*
- **Image Asset**: `assets/card-art/bundles/cards/47011.jpg` (600×852 px, 188.0 KB)
### [47012] Husk — *Paige Guthrie*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > [star] **Interrupt**: When Husk uses a basic power, spend up to 3 resources → if you spent at least 1:
  > [energy] — Husk gets +1 to that power for this use.
  > [mental] — Heal 1 damage from Husk.
  > [physical] — Ready Husk after this use.
- **Image Asset**: `assets/card-art/bundles/cards/47012.jpg` (600×852 px, 206.5 KB)
### [47013] Disguise
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Item.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Action** *(thwart)*: Exhaust Disguise and your identity → remove 2 threat from a scheme.
- **Flavor**: *"The name's 'Patch.' Just 'Patch.'" —Wolverine*
- **Image Asset**: `assets/card-art/bundles/cards/47013.png` (600×852 px, 193.2 KB)
### [47014] Waylay
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Response** *(attack)*: After your hero thwarts, deal 4 damage to an enemy (7 damage instead if that thwart removed the last threat from a scheme).
- **Flavor**: *"You hurt self-friends! No you will pay!" —Warlock*
- **Image Asset**: `assets/card-art/bundles/cards/47014.jpg` (600×852 px, 226.8 KB)
### [47015] Three Steps Ahead
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: For each different resource type *([energy], [mental], [physical], and [wild])* you used to pay for this card, choose a scheme and remove 2 threat from it.
- **Flavor**: *"You should be proud, Rogue—me and Glob worked this out ahead of time!" —Anole*
- **Image Asset**: `assets/card-art/bundles/cards/47015.png` (600×852 px, 212.8 KB)
### [47016] Generation X
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Justice
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 3 per hero, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > Each [[X-Men]] character gets +1 THW while making a basic thwart against this scheme.
  > **When Defeated**: Each player may search their deck and discard pile for an identity-specific event and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/47016.png` (852×600 px, 199.8 KB)
### [47017] The Power of Justice
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Justice *(yellow)* card.
- **Image Asset**: `assets/card-art/bundles/cards/47017.jpg` (710×1030 px, 301.9 KB)

### Set: Basic

### [47018] Synch — *Everett Thomas*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Play only if your identity has the [[X-Men]] trait.
  > **Interrupt**: When you use a basic power, exhaust Synch → you get +1 to that power for this use.
- **Image Asset**: `assets/card-art/bundles/cards/47018.jpg` (710×1030 px, 334.9 KB)
### [47019] Cell Phone
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Item.*
- **Rules Text**:
  > Uses (3 charge counters).
  > **Action**: Exhaust Cell Phone, remove 1 charge counter from here, and choose a player → that player makes a basic attack or thwart with a character they control. That character gets +1 THW and +1 ATK for this use.
- **Image Asset**: `assets/card-art/bundles/cards/47019.png` (710×1030 px, 308.6 KB)
### [47020] X-Gene
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Rules Text**:
  > Play only if your identity has the [[MUTANT]] trait. Max 1 per player
  > **Resource**: Exhaust X-Gene → generate a [wild] resource for an identity-specific event.
### [47021] Multitalented
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > **Hero Action** *(attack/thwart)*: If you paid for this event using at least 1:
  > [physical] — Deal 2 damage to an enemy.
  > [mental] — Remove 2 threat from a scheme.
  > [energy] — Heal 2 damage from your identity.
- **Image Asset**: `assets/card-art/bundles/cards/47021.jpg` (600×852 px, 196.0 KB)
### [47022] Unlikely Duo
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Attack.*
- **Rules Text**:
  > Team-Up (Jubilee and Wolverine). Max 1 per deck.
  > **Hero Action** *(attack)*: Confuse an enemy. Deal 4 damage to a confused enemy.
- **Image Asset**: `assets/card-art/bundles/cards/47022.jpg` (600×852 px, 170.7 KB)

### Set: Jubilee Nemesis

### [47024] Nanny
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jubilee Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Response**: After Nanny attacks you, if you control 1 or more allies, search the encounter deck, discard pile, and set-aside area for 1 copy of "Lost" Child and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/47024.jpg` (710×1030 px, 318.1 KB)
### [47025] Naughty Children
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee Nemesis (2/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jubilee Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Place 1 threat here for each different resource type *([energy], [mental], [physical], and [wild])* on cards in your hand.
- **Flavor**: *Nanny trods all over the line between "rescuing" and "kidnapping."*
- **Image Asset**: `assets/card-art/bundles/cards/47025.png` (1030×710 px, 315.7 KB)
### [47026] Battle Suit
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee Nemesis (3/5)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jubilee Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to the minion with the fewest remaining hit points. Otherwise, this card gains surge.
  > Attached minion gets +3 hit points and gains the [[Aerial]] trait.
- **Flavor**: *Nanny's battle suit design belies its true capabilities.*
- **Image Asset**: `assets/card-art/bundles/cards/47026.png` (710×1030 px, 332.4 KB)
### [47027] "Lost" Child
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Jubilee Nemesis (4–5/5, Qty: 2)
- **Stats**: **SCH**: -1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jubilee Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Treat attached ally as a [[Regressed]] minion with a blank text box. Attached minion's SCH is equal to its printed THW and it does not take consequential damage.
  > **When Revealed**: Attach to the ally with the highest cost without "Lost" Child attached. Attached ally engages its controller. Otherwise, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/47027.jpg` (710×1030 px, 302.0 KB)

### Set: Leadership

### [47028] Mutant Mayhem
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Rules Text**:
  > Alliance.
  > **Hero Action**: Choose an [[X-Force]] ally and an [[X-Men]] ally and return them to their owners' hands → those players play those allies, ignoring their resource costs.
- **Image Asset**: `assets/card-art/bundles/cards/47028.jpg` (710×1030 px, 314.1 KB)

### Set: Protection

### [47029] Serve and Protect
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Rules Text**:
  > Alliance.
  > **Hero Interrupt**: When any amount of threat would be placed on the main scheme, exhaust an [[X-Force]] character and an [[X-Men]] character → prevent that threat and give each of those characters a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/47029.png` (710×1030 px, 369.4 KB)

### Set: Arcade

### [47030] Arcade
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Arcade (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Arcade Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin.*
- **Rules Text**:
  > Arcade cannot take damage while a [[Trap!]] side scheme is in play.
  > **When Revealed**: Discard cards from the top of the encounter deck until a [[Trap!]] side scheme is discarded and reveal it.
- **Flavor**: *"I'm so glad my mercenaries convinced you to come!"*
- **Image Asset**: `assets/card-art/bundles/cards/47030.jpg` (710×1030 px, 294.7 KB)
### [47031] Welcome to Murderworld
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Arcade (2/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Arcade Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Trap!*
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: The player who defeated this side scheme takes 2 damage.
- **Flavor**: *"These rides are killer!" —Arcade*
- **Image Asset**: `assets/card-art/bundles/cards/47031.png` (1030×710 px, 301.3 KB)
### [47032] Arcade's Funhouse
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Arcade (3/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Arcade Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Trap!*
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: The player who defeated this side scheme is stunned. If they were already stunned, they discard an ally or upgrade they control.
- **Image Asset**: `assets/card-art/bundles/cards/47032.png` (1030×710 px, 327.9 KB)
### [47033] Hall of Mirrors
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Arcade (4/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Arcade Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Traits**: *Trap!*
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: The player who defeated this side scheme is confused. If they were already confused, place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/47033.jpg` (1030×710 px, 326.0 KB)
### [47034] Elaborate Trap
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Jubilee (`jubilee`)
- **Deck / Set**: Arcade (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Arcade Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve the "**When Defeated**" ability on each [[Trap!]] side scheme as if you defeated it. If no abilities were resolved this way, discard cards from the top of the encounter deck until a [[Trap!]] side scheme is discarded and reveal it.
- **Flavor**: *"Because overkill is underrated." —Arcade*
- **Image Asset**: `assets/card-art/bundles/cards/47034.png` (710×1030 px, 316.0 KB)

