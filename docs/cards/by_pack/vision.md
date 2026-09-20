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
| `26001a` | Vision | Hero | Vision | THW:2 ATK:0 DEF:0 HP:11 | - | `vision` |
| `26001b` | Vision | Alter-Ego | Vision | HP:11 | - | `vision` |
| `26002` | Intangible | Upgrade | Vision | - | - | `vision` |
| `26003` | Vivian | Ally | Vision | THW:1 ATK:1 HP:2 | - | `vision` |
| `26004` | 616 Hickory Branch Lane | Support | Vision | - | - | `vision` |
| `26005` | Solar Gem | Upgrade | Vision | - | - | `vision` |
| `26006` | Vision's Cape | Upgrade | Vision | - | - | `vision` |
| `26007` | Density Control | Upgrade | Vision | - | - | `vision` |
| `26008` | Solar Beam | Event | Vision | - | - | `vision` |
| `26009` | Superdense Strike | Event | Vision | - | - | `vision` |
| `26010` | Just Passing Through | Event | Vision | - | - | `vision` |
| `26011` | Phase Disruption | Event | Vision | - | - | `vision` |
| `26012` | Mass Increase | Event | Vision | - | - | `vision` |
| `26013` | Jocasta | Ally | Pack Position: 13 | THW:2 ATK:1 HP:3 | - | `vision` |
| `26014` | Protector | Ally | Pack Position: 14 | THW:1 ATK:3 HP:3 | - | `vision` |
| `26015` | Victor Mancha | Ally | Pack Position: 15 | THW:0 ATK:0 HP:4 | - | `vision` |
| `26016` | Flow Like Water | Upgrade | Pack Position: 16 | - | - | `vision` |
| `26017` | Indomitable | Upgrade | Pack Position: 17 | - | - | `vision` |
| `26018` | Defiance | Event | Pack Position: 18 | - | - | `vision` |
| `26019` | Side Step | Event | Pack Position: 19 | - | - | `vision` |
| `26020` | Get Behind Me! | Event | Pack Position: 20 | - | - | `vision` |
| `26021` | Preservation | Resource | Pack Position: 21 | - | - | `vision` |
| `26022` | Machine Man | Ally | Pack Position: 22 | THW:1 ATK:1 HP:3 | - | `vision` |
| `26023` | Avengers Mansion | Support | Pack Position: 23 | - | - | `vision` |
| `26024` | Reboot | Event | Pack Position: 24 | - | - | `vision` |
| `26025` | Energy | Resource | Pack Position: 25 | - | - | `vision` |
| `26026` | Genius | Resource | Pack Position: 26 | - | - | `vision` |
| `26027` | Strength | Resource | Pack Position: 27 | - | - | `vision` |
| `26028` | Corrupted Programming | Obligation | Vision | - | 2 pips | `vision` |
| `26029` | Ultron | Minion | Vision Nemesis | SCH:2 ATK:2 HP:6 | 2 pips | `vision` |
| `26030` | Ultron Unleashed | Side Scheme | Vision Nemesis | - | 3 pips | `vision` |
| `26031` | Ultron Drones | Environment | Vision Nemesis | - | - | `vision` |
| `26032` | Relentless Android | Treachery | Vision Nemesis | - | 2 pips | `vision` |
| `26033` | Assault Training | Support | Pack Position: 33 | - | - | `vision` |
| `26034` | Chance Encounter | Upgrade | Pack Position: 34 | - | - | `vision` |
| `26035` | Joining Forces | Event | Pack Position: 35 | - | - | `vision` |
| `26036` | Meditation | Event | Pack Position: 36 | - | - | `vision` |

---

## Pack: Vision (`vision`)

### Set: Vision

### [26001a] Vision
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 0, **DEF**: 0, **HP**: 11, **Hand Size**: 5
- **Traits**: *Android. Avenger.*
- **Rules Text**:
  > *Density Manipulation* - **Action:** Change mass form by flipping your mass form upgrade over. (Limit once per round.)
- **Flavor**: *"Odd that some say I am less than human, when in truth I am far superior."*
- **Image Asset**: `assets/card-art/bundles/cards/26001a.png` (400×558 px, 367.3 KB)
### [26001b] Vision
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 11, **Hand Size**: 5
- **Traits**: *Android.*
- **Rules Text**:
  > While you are in Dense mass form, you get +2 REC.
  > While you are in Intangible mass form, you get +1 hand size.
  > **Setup:** Put your mass form upgrade into play, Intangible side faceup.
- **Image Asset**: `assets/card-art/bundles/cards/26001b.png` (400×558 px, 348.3 KB)
### [26002] Intangible
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (1/16)
- **Properties**: Permanent, Double-Sided
- **Stats**: **Cost**: 0
- **Rules Text**:
  > Mass form. Permanent.
  > Vision cannot attack or defend.
  > Reduce the amount of damage Vision takes from each attack by 2.
- **Image Asset**: `assets/card-art/bundles/cards/26002.png` (300×435 px, 60.7 KB)
### [26003] Vivian
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (2/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Android. Champion.*
- **Rules Text**:
  > While you are in Intangible mass form, Vivian gets +2 THW.
  > While you are in Dense mass form, Vivian gets +2 ATK.
- **Flavor**: *"I love you, daddy."*
- **Image Asset**: `assets/card-art/bundles/cards/26003.png` (300×435 px, 57.3 KB)
### [26004] 616 Hickory Branch Lane
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (3/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action:** Exhaust this card → search your deck and discard pile for an [[Android]] ally and add it to your hand. *(Shuffle.)*
- **Flavor**: *"I stand forever at the crossroads of mind and heart." —Vision*
- **Image Asset**: `assets/card-art/bundles/cards/26004.png` (300×435 px, 61.6 KB)
### [26005] Solar Gem
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (4/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Item.*
- **Rules Text**:
  > Vision gains the [[Aerial]] trait.
  > **Resource:** Exhaust Solar Gem → generate a [wild] resource.
- **Flavor**: *The gem on Vision's brow absorbs solar energy, which his body converts into power by a process similar to photosynthesis.*
- **Image Asset**: `assets/card-art/bundles/cards/26005.png` (300×435 px, 57.7 KB)
### [26006] Vision's Cape
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (5/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Item.*
- **Rules Text**:
  > While you are in Dense mass form, you gain retaliate 1.
  > While you are in Intangible mass form, you gain stalwart.
- **Flavor**: *Vision's density control extends to his uniform and cape.*
- **Image Asset**: `assets/card-art/bundles/cards/26006.png` (300×435 px, 56.2 KB)
### [26007] Density Control
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (6–7/16, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Response:** After you change mass form, discard this card → add a Vision event from your discard pile to your hand.
- **Flavor**: *"Would it kill you to use the door?" —Hawkeye*
- **Image Asset**: `assets/card-art/bundles/cards/26007.png` (300×435 px, 56.5 KB)
### [26008] Solar Beam
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (8–10/16, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(attack)*: If Vision is in Dense mass form, deal 7 damage to an enemy.
  > **Hero Action** *(thwart)*: If Vision is in Intangible mass form, remove 5 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/26008.png` (300×435 px, 59.7 KB)
### [26009] Superdense Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (11–12/16, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > Play only if Vision is in Dense mass form.
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy. This attack gains piercing.
- **Flavor**: *"I have made the calculations, and there is no outcome in which you win this fight." —Vision*
- **Image Asset**: `assets/card-art/bundles/cards/26009.png` (300×435 px, 65.3 KB)
### [26010] Just Passing Through
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (13–14/16, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > Play only if Vision is in Intangible mass form.
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme, ignoring the patrol keyword and the crisis icon ([crisis]).
- **Image Asset**: `assets/card-art/bundles/cards/26010.png` (300×435 px, 55.7 KB)
### [26011] Phase Disruption
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (15/16)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Play only if Vision is in Intangible mass form.
  > **Hero Action:** Confuse an enemy. Choose an attachment on that enemy with the text "**Hero Action**" or "**Hero Response**" and discard that attachment.
- **Image Asset**: `assets/card-art/bundles/cards/26011.png` (300×435 px, 61.8 KB)
### [26012] Mass Increase
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (16/16)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Defense. Superpower.*
- **Rules Text**:
  > Play only if Vision is in Dense mass form.
  > **Hero Interrupt** *(defense)*: When Vision defends, prevent all damage from that attack. Stun the attacking enemy after that attack resolves.
- **Image Asset**: `assets/card-art/bundles/cards/26012.png` (300×435 px, 66.1 KB)
### [26028] Corrupted Programming
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Vision player.***
  > Treat your mass form upgrade's text box as if it were blank, except for keywords.
  > **Alter-Ego Action:** Exhaust your identity → remove Corrupted Programming from the game.
- **Image Asset**: `assets/card-art/bundles/cards/26028.png` (300×435 px, 56.3 KB)

### Set: Protection

### [26013] Jocasta
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Android. Avenger.*
- **Rules Text**:
  > You may play the event attached to Jocasta as if it were in your hand.
  > **Response:** After Jocasta enters play, choose a [[Defense]] event in your discard pile and attach it to her facedown.
- **Image Asset**: `assets/card-art/bundles/cards/26013.png` (300×435 px, 56.8 KB)
### [26014] Protector — *Alexis*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 3, **Resources**: [physical]
- **Traits**: *Android. Avenger.*
- **Rules Text**:
  > **Interrupt:** When Protector would take any amount of damage, spend a [mental] resource → reduce that amount by 1. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/26014.png` (300×435 px, 54.5 KB)
### [26015] Victor Mancha
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 0 (Consequential: 1), **ATK**: 0 (Consequential: 1), **HP**: 4, **Resources**: [energy]
- **Traits**: *Android. Avenger.*
- **Rules Text**:
  > Reduce the amount of damage Victor Mancha takes from each attack by 1.
- **Flavor**: *"You wanna kill me? You better do it quick..."*
- **Image Asset**: `assets/card-art/bundles/cards/26015.png` (300×435 px, 52.2 KB)
### [26016] Flow Like Water
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Response:** After you play a [[Defense]] card, deal 1 damage to the attacking enemy.
- **Image Asset**: `assets/card-art/bundles/cards/26016.png` (300×435 px, 58.4 KB)
### [26017] Indomitable
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Response**: After your hero defends, discard indomitable → ready your hero.
- **Flavor**: *"We have no choice. So we fight — and we win. There are no other options." —Captain America*
### [26018] Defiance
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When a boost card on an enemy attacking you would be turned faceup, discard it instead.
- **Flavor**: *"No." —Shang-Chi*
- **Image Asset**: `assets/card-art/bundles/cards/26018.png` (300×435 px, 51.7 KB)
### [26019] Side Step
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you would take any amount of damage, prevent 3 of that damage. If you paid for this card using [energy] resource, deal 1 damage to that enemy.
- **Flavor**: *"Missed me!" —Wasp*
### [26020] Get Behind Me!
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Hero Interrupt**: When a treachery card is revealed from the encounter deck, cancel its "**When Revealed**" effects. The villain attacks you instead.
- **Flavor**: *"Ahem! Stand aside, citizens!" —Ms. Marvel*
### [26021] Preservation
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, heal 1 damage from your hero.

### Set: Basic

### [26022] Machine Man — *Aaron Stack*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Android.*
- **Rules Text**:
  > **Interrupt:** When Machine Man attacks or thwarts, spend up to 3 resources of any type → Machine Man gets +1 THW and +1 ATK for this use for each resource spent this way.
- **Flavor**: *"Here comes heavy metal!"*
- **Image Asset**: `assets/card-art/bundles/cards/26022.png` (300×435 px, 61.4 KB)
### [26023] Avengers Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Avengers Mansion → choose a player. That player draws 1 card.
- **Flavor**: *"Did you remember to turn off the stove?" —Janet Van Dyne*
### [26024] Reboot
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Rules Text**:
  > **Action:** Ready a friendly [[Android]] character and heal 1 damage from it.
- **Flavor**: *"Uh, have you tried turning the power off and back on?" —Ironheart*
- **Image Asset**: `assets/card-art/bundles/cards/26024.png` (300×435 px, 53.8 KB)
### [26025] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [26026] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [26027] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [26036] Meditation
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 36
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Alter-Ego Action:** Exhaust your alter-ego → play a card from your hand, reducing its resource cost by 3.
- **Flavor**: *"Enlightenment comes with practice." —Moondragon*
- **Image Asset**: `assets/card-art/bundles/cards/26036.png` (300×435 px, 48.8 KB)

### Set: Vision Nemesis

### [26029] Ultron
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Android. Elite.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Interrupt**: When Ultron attacks you, if Ultron Drones is in play, put the top card of your deck into play facedown, engaged with you as a [[Drone]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/26029.png` (300×435 px, 62.4 KB)
### [26030] Ultron Unleashed
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision Nemesis (2/5)
- **Stats**: **Base Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed:** Search the encounter deck, discard pile, and set-aside area for Ultron Drones and put it into play. Shuffle the encounter deck. Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/26030.png` (435×300 px, 57.4 KB)
### [26031] Ultron Drones
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Vision Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each facedown [[Drone]] minion engaged with a player has a base SCH of 1, base ATK of 1, and a base hit points of 1.
  > **Forced Response**: After a facedown [[Drone]] minion is defeated, place that card in its owner's discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/26031.png` (300×435 px, 59.3 KB)
### [26032] Relentless Android
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Vision (`vision`)
- **Deck / Set**: Vision Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** If Ultron Drones is in play, put the top 2 cards of your deck into play facedown, engaged with you as [[Drone]] minions. Otherwise, discard 2 random cards from your hand.
- **Flavor**: *"Innovation is the ultimate weapon." —Ultron*
- **Image Asset**: `assets/card-art/bundles/cards/26032.png` (300×435 px, 63.1 KB)

### Set: Aggression

### [26033] Assault Training
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Max 2 per deck. Uses (2 training counters)
  > **Alter-Ego Action:** Exhaust this card and remove 1 training counter from it → choose an Aggression *(red)* event in your discard pile and shuffle it into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/26033.png` (300×435 px, 64.3 KB)

### Set: Justice

### [26034] Chance Encounter
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to a side scheme. Max 1 per scheme.
  > **Interrupt:** When attached side scheme is defeated, search your deck and discard pile for an ally and add it to your hand. Shuffle your deck.
- **Image Asset**: `assets/card-art/bundles/cards/26034.png` (300×435 px, 56.9 KB)

### Set: Leadership

### [26035] Joining Forces
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Vision (`vision`)
- **Deck / Set**: Pack Position: 35
- **Stats**: **Cost**: 4, **Resources**: [energy]
- **Rules Text**:
  > Alliance. *(The players can pay this card's costs as a group.)*
  > **Hero Action:** As a group, the players put a total of 1 [[Avenger]] ally and 1 [[Guardian]] ally into play from their hand(s).
- **Image Asset**: `assets/card-art/bundles/cards/26035.png` (300×435 px, 63.4 KB)

