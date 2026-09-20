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
| `61001a` | Jessica Jones | Hero | Jessica Jones | THW:3 ATK:2 DEF:1 HP:11 | - | `jj` |
| `61001b` | Jessica Jones | Alter-Ego | Jessica Jones | HP:11 | - | `jj` |
| `61002` | Alias Investigations | Support | Jessica Jones | - | - | `jj` |
| `61003` | Luke Cage | Ally | Jessica Jones | THW:2 ATK:2 HP:3 | - | `jj` |
| `61004` | "Big Mistake" | Event | Jessica Jones | - | - | `jj` |
| `61005` | Breakthrough | Event | Jessica Jones | - | - | `jj` |
| `61006` | Snooping Around | Event | Jessica Jones | - | - | `jj` |
| `61007` | Piecing It All Together | Player Side Scheme | Jessica Jones | - | - | `jj` |
| `61008` | Calling in Favors | Support | Jessica Jones | - | - | `jj` |
| `61009` | 4K Digital Camcorder | Upgrade | Jessica Jones | - | - | `jj` |
| `61010` | Circumstantial Evidence | Upgrade | Jessica Jones | - | - | `jj` |
| `61011` | Leather Jacket | Upgrade | Jessica Jones | - | - | `jj` |
| `61012` | "Now I'm Ticked Off!" | Upgrade | Jessica Jones | - | - | `jj` |
| `61013` | Reluctant Flier | Upgrade | Jessica Jones | - | - | `jj` |
| `61014` | Stakeout | Upgrade | Jessica Jones | - | - | `jj` |
| `61015` | Captain Marvel | Ally | Pack Position: 15 | THW:2 ATK:3 HP:3 | - | `jj` |
| `61016` | Spider-Woman | Ally | Pack Position: 16 | THW:2 ATK:2 HP:3 | - | `jj` |
| `61017` | Squirrel Girl | Ally | Pack Position: 17 | THW:1 ATK:1 HP:2 | - | `jj` |
| `61018` | Lay Down the Law | Event | Pack Position: 18 | - | - | `jj` |
| `61019` | Strategy Session | Event | Pack Position: 19 | - | - | `jj` |
| `61020` | Run Them to Ground | Player Side Scheme | Pack Position: 20 | - | - | `jj` |
| `61021` | Lay the Trap | Player Side Scheme | Pack Position: 21 | - | - | `jj` |
| `61022` | Determination | Resource | Pack Position: 22 | - | - | `jj` |
| `61023` | Grapnel Launcher | Upgrade | Pack Position: 23 | - | - | `jj` |
| `61024` | Entrapment | Upgrade | Pack Position: 24 | - | - | `jj` |
| `61025` | Hellcat | Ally | Pack Position: 25 | THW:2 ATK:2 HP:3 | - | `jj` |
| `61026` | Joys of Life | Event | Pack Position: 26 | - | - | `jj` |
| `61027` | Unbreakable Bond | Event | Pack Position: 27 | - | - | `jj` |
| `61028` | Second Chance | Player Side Scheme | Pack Position: 28 | - | - | `jj` |
| `61029` | Defend Our City | Player Side Scheme | Pack Position: 29 | - | - | `jj` |
| `61030` | Work-Life Balance | Obligation | Jessica Jones | - | 2 pips | `jj` |
| `61031` | Purple Man | Minion | Jessica Jones Nemesis | HP:6 | 3 pips | `jj` |
| `61032` | Indomitable Will | Side Scheme | Jessica Jones Nemesis | - | 1 pips | `jj` |
| `61033a` | Suggestion ([energy]) | Obligation | Jessica Jones Nemesis | - | 2 pips | `jj` |
| `61033b` | Suggestion ([mental]) | Obligation | Jessica Jones Nemesis | - | 2 pips | `jj` |
| `61033c` | Suggestion ([physical]) | Obligation | Jessica Jones Nemesis | - | 2 pips | `jj` |
| `61034` | Innate Aggression | Upgrade | Pack Position: 34 | - | - | `jj` |
| `61035` | Shakedown | Upgrade | Pack Position: 35 | - | - | `jj` |
| `61036` | Innate Perception | Upgrade | Pack Position: 36 | - | - | `jj` |
| `61037` | Innate Inspiration | Upgrade | Pack Position: 37 | - | - | `jj` |
| `61038` | Echo | Ally | Pack Position: 38 | THW:1 ATK:1 HP:3 | - | `jj` |
| `61039` | Lay Low | Player Side Scheme | Pack Position: 39 | - | - | `jj` |
| `61040` | Mitigated Threat | Upgrade | Pack Position: 40 | - | - | `jj` |

---

## Pack: Jessica Jones (`jj`)

### Set: Jessica Jones

### [61001a] Jessica Jones
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 3 [star], **ATK**: 2 [star], **DEF**: 1 [star], **HP**: 11, **Hand Size**: 5
- **Traits**: *Defender.*
- **Rules Text**:
  > [star] *Gather Evidence* — **Response**: After you use a basic power, place 1 evidence counter on Alias Investigations.
- **Flavor**: *"These things rarely end well."*
- **Image Asset**: `assets/card-art/bundles/cards/61001a.png` (300×426 px, 235.3 KB)
### [61001b] Jessica Jones
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 11, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > *Incognito Mode* — **Action**: Change to hero form. You cannot change back to alter-ego form this phase.
  > **Setup**: Put the Alias Investigations support into play.
- **Image Asset**: `assets/card-art/bundles/cards/61001b.png` (300×426 px, 233.7 KB)
### [61002] Alias Investigations
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (1/16)
- **Properties**: Unique, Permanent
- **Stats**: **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Permanent.
  > **Response**: After a side scheme is defeated, exhaust this card → place 2 evidence counters here. Then, you may remove evidence counters from here equal to the villain's remaining hit points to defeat the villain's current stage.
- **Image Asset**: `assets/card-art/bundles/cards/61002.png` (295×419 px, 249.4 KB)
### [61003] Luke Cage
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (2/16)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 2), **HP**: 3, **Resources**: [wild]
- **Traits**: *Defender.*
- **Rules Text**:
  > Toughness.
  > **Action**: Exhaust Luke Cage and deal 1 damage to him → give him a tough status card.
- **Flavor**: *"He may have skin like steel, but he's got a heart of gold." —Jessica Jones*
- **Image Asset**: `assets/card-art/bundles/cards/61003.png` (295×419 px, 241.8 KB)
### [61004] "Big Mistake"
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (3–4/16, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. You may remove 1 evidence counter from Alias Investigations to deal 2 additional damage and for this attack to gain either overkill or piercing.
- **Flavor**: *"You messed with the wrong lady." —Jessica Jones*
- **Image Asset**: `assets/card-art/bundles/cards/61004.png` (295×419 px, 248.0 KB)
### [61005] Breakthrough
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (5/16)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Response**: After an evidence counter is placed on Alias Investigations, ready your identity. Shuffle this card into your deck.
- **Flavor**: *"Tell me more." —Jessica Jones*
- **Image Asset**: `assets/card-art/bundles/cards/61005.png` (295×419 px, 244.1 KB)
### [61006] Snooping Around
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (6–8/16, Qty: 3)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Alter-Ego Action** *(thwart)*: Remove 4 threat from a scheme and place 2 evidence counters on Alias Investigations. Discard the top card of the encounter deck. If that card is a minion or side scheme, reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/61006.png` (295×419 px, 241.3 KB)
### [61007] Piecing It All Together
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (9/16)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 6, **Resources**: [mental]
- **Rules Text**:
  > This scheme does not count against the player side scheme limit.
  > **When Defeated**: The defeating player draws 3 cards.
- **Flavor**: *Sometimes, you take a step back to look at the big picture and it all falls into place.*
### [61008] Calling in Favors
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (10/16)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Alter-Ego Action**: Remove 2 evidence counters from Alias Investigations and exhaust Calling in Favors → search your deck for an ally and play it as if it were in your hand, reducing its resource cost by 2. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/61008.png` (295×419 px, 230.3 KB)
### [61009] 4K Digital Camcorder
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (11/16)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Item.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust this card and choose a non-[[Elite]] minion. Remove X evidence counters from Alias Investigations, where X is equal to 2 less than that minion's remaining hit points → discard that minion.
- **Flavor**: *"...gotcha." —Jessica Jones*
- **Image Asset**: `assets/card-art/bundles/cards/61009.png` (295×419 px, 242.3 KB)
### [61010] Circumstantial Evidence
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (12/16)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Item.*
- **Rules Text**:
  > **Response**: After an enemy is defeated, exhaust Circumstantial Evidence → place 1 evidence counter on Alias Investigations.
- **Flavor**: *"Nice find! That'll come in handy." —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/61010.png` (295×419 px, 253.4 KB)
### [61011] Leather Jacket
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (13/16)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Item.*
- **Rules Text**:
  > Jessica Jones gets +2 DEF.
  > **Response**: After you defend, place 1 evidence counter on Alias Investigations.
- **Flavor**: *"Luke, does she own any jackets that aren't black leather?" —Iron Fist*
- **Image Asset**: `assets/card-art/bundles/cards/61011.png` (295×419 px, 236.7 KB)
### [61012] "Now I'm Ticked Off!"
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (14/16)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Forced Response** *(attack)*: After the villain activates against a player, if you are in alter-ego form, change to hero form. Deal 5 damage to the villain and each minion engaged with that player. Discard this card.
- **Flavor**: *"What did you just say to her?" —Jessica Jones*
### [61013] Reluctant Flier
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (15/16)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Aerial. Preparation.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you would take at least 3 damage from an attack, discard this card → prevent all of that attack's damage. Take 1 damage.
- **Flavor**: *"I think I'm gonna puke." —Jessica Jones*
### [61014] Stakeout
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (16/16)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Action**: If this card is in your play area, attach it to a non-permanent encounter side scheme.
  > **Interrupt**: When a character thwarts attached scheme, that thwart removes 2 additional threat. If that thwart defeats attached scheme, place 2 evidence counters on Alias Investigations.
- **Image Asset**: `assets/card-art/bundles/cards/61014.png` (295×419 px, 260.0 KB)
### [61030] Work-Life Balance
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jessica Jones Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Jessica Jones player.***
  > As an additional cost to change forms, discard 1 card from your hand.
  > **Alter-Ego Action**: Choose:
  > • Remove an ally you control from the game → remove this card from the game.
  > • Confuse your identity → discard this card.

### Set: Justice

### [61015] Captain Marvel — *Carol Danvers*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 3, **Resources**: [energy]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Response**: After Captain Marvel enters play, discard the top 4 cards of your deck. If you discard a printed [energy] resource, remove 2 threat from a scheme. If you discard more than one printed [energy] resource, also confuse an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/61015.png` (295×419 px, 233.5 KB)
### [61016] Spider-Woman — *Mattie Franklin*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 2), **HP**: 3, **Resources**: [physical]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > **Response**: After a character you control thwarts, place 1 limb counter here (to a maximum of 8). You may discard Spider-Woman to deal 1 damage to an enemy for each limb counter here.
### [61017] Squirrel Girl — *Doreen Green*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After you play Squirrel Girl from your hand, place 1 squirrel counter here for each card in your hand (to a maximum of 4).
  > **Action**: Remove 1 squirrel counter from here → remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/61017.png` (295×419 px, 243.4 KB)
### [61018] Lay Down the Law
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Response** *(thwart)*: After you change form, remove 3 threat from a scheme (4 threat instead if you paid for this card using a [mental] resource).
- **Flavor**: *"Maybe this will teach you!" —Captain America*
### [61019] Strategy Session
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Tactic. Thwart.*
- **Rules Text**:
  > **Alter-Ego Action**: Choose a player to search their deck for a player side scheme and add it to their hand.
  > **Hero Action** *(thwart)*: Remove 3 threat from a player side scheme.
- **Flavor**: *"Okay, gang, I've got a plan." —Nova*
- **Image Asset**: `assets/card-art/bundles/cards/61019.png` (295×419 px, 234.1 KB)
### [61020] Run Them to Ground
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 4 per hero, **Resources**: [physical]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Resolve each of the following:
  > • Skip the next villain phase.
  > • Deal each player 1 facedown encounter card *(immediately)*.
  > • The villain cannot take damage until the start of the next *(unskipped)* villain phase.
- **Image Asset**: `assets/card-art/bundles/cards/61020.png` (419×295 px, 242.1 KB)
### [61021] Lay the Trap
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 3 per hero, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: The player who defeated this scheme deals 5[per_hero] damage to the villain.
- **Flavor**: *"You go right, I'll go left."
"I always go right."
"Fine, go left."
"I like going right."
—Daredevil and Iron Fist*
### [61022] Determination
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, remove 1 threat from the main scheme.
### [61023] Grapnel Launcher
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Item.*
- **Rules Text**:
  > Restricted.
  > **Hero Action**: Discard this card → make a basic thwart without exhausting *(even if you are exhausted)*. For this thwart, your hero gets +1 THW and ignores the patrol keyword and any crisis icons *([crisis])* in play.
- **Image Asset**: `assets/card-art/bundles/cards/61023.png` (295×419 px, 240.5 KB)
### [61024] Entrapment
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Preparation.*
- **Rules Text**:
  > Max 1 per player.
  > **Alter-Ego Response** *(attack)*: After the villain schemes, change to hero form and discard this card → deal damage to the villain equal to the amount of threat placed by that activation.
- **Image Asset**: `assets/card-art/bundles/cards/61024.png` (295×419 px, 222.8 KB)
### [61036] Innate Perception
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 36
- **Stats**: **Cost**: 2
- **Traits**: *Condition.*
- **Rules Text**:
  > Starting. *(You may add this card to your hand before drawing your starting hand.)*
  > Your hero gets +1 THW.
- **Flavor**: *WHOOOSH!*

### Set: Basic

### [61025] Hellcat — *Patsy Walker*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 25
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > If your identity has the [[Defender]] trait, this card gains: "**Action**: Put Hellcat into play from your hand. At the end of the phase, discard her."
- **Flavor**: *"Hi Fellas! Well, tootles."*
### [61026] Joys of Life
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > Alliance.
  > **Action**: Choose:
  > • Exhaust a [[Civilian]] alter-ego → ready a hero or ally.
  > • Exhaust a hero or ally → ready a [[Civilian]] alter-ego.
- **Image Asset**: `assets/card-art/bundles/cards/61026.png` (295×419 px, 216.4 KB)
### [61027] Unbreakable Bond
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Team-Up *(Jessica Jones and Luke Cage)*. Max 1 per deck.
  > **Hero Action**: *(thwart)*: Remove 3 threat from a scheme. Heal a total of 3 damage from among Jessica Jones and Luke Cage.
- **Image Asset**: `assets/card-art/bundles/cards/61027.png` (295×419 px, 204.3 KB)
### [61028] Second Chance
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Basic
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 28
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 3 per hero, **Resources**: [mental]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may shuffle all of their identity-specific cards from their discard pile into their deck.
- **Flavor**: *"Let's do what heroes do best: save the day!" —Ms. Marvel*
### [61029] Defend Our City
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Basic
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 29
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 3 per hero, **Resources**: [physical]
- **Rules Text**:
  > [star] Hinder 1[per_hero].
  > Prerequisite ([[Defender]]). Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for a Team-Up card and add it to their hand. Until the end of the phase, reduce the cost to play each Team-Up card by 1.
- **Image Asset**: `assets/card-art/bundles/cards/61029.png` (419×295 px, 232.2 KB)

### Set: Jessica Jones Nemesis

### [61031] Purple Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jessica Jones Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic.*
- **Rules Text**:
  > [star] Purple Man's SCH is equal to the highest SCH or THW among characters in play. His ATK is equal to the highest ATK among characters in play.
- **Flavor**: *Zebediah Killgrave's chemically-modified pheromones influence everybody in close proximity.*
### [61032] Indomitable Will
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jessica Jones Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] Hinder 3[per_hero].
  > **When Revealed**: Place 2 pheromone counters on each Suggestion obligation in play.
  > **Forced Response**: After a Suggestion obligation enters play, place 2 *(additional)* pheromone counters on it.
### [61033a] Suggestion ([energy])
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jessica Jones Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Uses (3 pheromone counters).
  > **Forced Action**: Exhaust this card and remove 1 pheromone counter from it → choose to either play a card that has a printed [energy] resource icon *(paying its costs)* or add 2 threat to the main scheme.
- **Flavor**: *"Do me a favor..." —Purple Man*
### [61033b] Suggestion ([mental])
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones Nemesis (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jessica Jones Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Uses (3 pheromone counters).
  > **Forced Action**: Exhaust this card and remove 1 pheromone counter from it → choose to either play a card that has a printed [mental] resource icon *(paying its costs)* or add 2 threat to the main scheme.
- **Flavor**: *"Simon didn't say so." —Purple Man*
### [61033c] Suggestion ([physical])
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Jessica Jones Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Jessica Jones Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Uses (3 pheromone counters).
  > **Forced Action**: Exhaust this card and remove 1 pheromone counter from it → choose to either play a card that has a printed [physical] resource icon *(paying its costs)* or add 2 threat to the main scheme.
- **Flavor**: *"Nuh-uh-uh." —Purple Man*

### Set: Aggression

### [61034] Innate Aggression
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 2
- **Traits**: *Condition.*
- **Rules Text**:
  > Starting. *(You may add this card to your hand before drawing your starting hand.)*
  > Your hero gets +1 ATK.
- **Flavor**: *SMACK!*
### [61035] Shakedown
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 35
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Response**: After you attack and exactly defeat a minion, exhaust this card → remove threat from a scheme equal to that minion's base SCH.
- **Flavor**: *"I'm not your bro." —Jessica Jones*

### Set: Leadership

### [61037] Innate Inspiration
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 37
- **Stats**: **Cost**: 2
- **Traits**: *Condition.*
- **Rules Text**:
  > Starting. *(You may add this card to your hand before drawing your starting hand.)*
  > Each ally you control gets +1 hit point.
- **Flavor**: *PA-PA_POW!*

### Set: Protection

### [61038] Echo — *Maya Lopez*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 38
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > Reduce the amount of damage Echo takes from each enemy attack by your hero's DEF.
- **Flavor**: *The facepaint Echo applies is in remembrance of her late father's last touch.*
### [61039] Lay Low
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Protection
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 39
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 3 per hero, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may change to alter-ego form. Heal damage from each alter-ego equal to its REC.
- **Flavor**: *"I'm sure the nice old Estonian couple that owns this place won't mind if we crash here for a bit." —Jessica Jones*
### [61040] Mitigated Threat
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Jessica Jones (`jj`)
- **Deck / Set**: Pack Position: 40
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to a card. Attached card loses each [acceleration], [amplify], [crisis], and [hazard] icon.
  > **Forced Response**: At the end of the round, each player may spend 1 resource of any type. If any player does not, discard this card.

