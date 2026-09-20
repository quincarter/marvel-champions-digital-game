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
| `10001a` | Hulk | Hero | Hulk | THW:0 ATK:3 DEF:3 HP:18 | - | `hlk` |
| `10001b` | Bruce Banner | Alter-Ego | Hulk | HP:18 | - | `hlk` |
| `10002` | Crushing Blow | Event | Hulk | - | - | `hlk` |
| `10003` | Hulk Smash | Event | Hulk | - | - | `hlk` |
| `10004` | Sub-Orbital Leap | Event | Hulk | - | - | `hlk` |
| `10005` | Thunderclap | Event | Hulk | - | - | `hlk` |
| `10006` | Unstoppable Force | Event | Hulk | - | - | `hlk` |
| `10007` | Limitless Strength | Resource | Hulk | - | - | `hlk` |
| `10008` | Banner's Laboratory | Support | Hulk | - | - | `hlk` |
| `10009` | Boundless Rage | Upgrade | Hulk | - | - | `hlk` |
| `10010` | Immovable Object | Upgrade | Hulk | - | - | `hlk` |
| `10011` | Brawn | Ally | Pack Position: 11 | THW:1 ATK:1 HP:5 | - | `hlk` |
| `10012` | Sentry | Ally | Pack Position: 12 | THW:2 ATK:3 HP:5 | - | `hlk` |
| `10013` | She-Hulk | Ally | Pack Position: 13 | THW:2 ATK:1 HP:4 | - | `hlk` |
| `10014` | Drop Kick | Event | Pack Position: 14 | - | - | `hlk` |
| `10015` | Toe to Toe | Event | Pack Position: 15 | - | - | `hlk` |
| `10016` | "You'll Pay for That!" | Event | Pack Position: 16 | - | - | `hlk` |
| `10017` | The Power of Aggression | Resource | Pack Position: 17 | - | - | `hlk` |
| `10018` | Martial Prowess | Upgrade | Pack Position: 18 | - | - | `hlk` |
| `10019` | To the Rescue! | Event | Pack Position: 19 | - | - | `hlk` |
| `10020` | Energy | Resource | Pack Position: 20 | - | - | `hlk` |
| `10021` | Genius | Resource | Pack Position: 21 | - | - | `hlk` |
| `10022` | Strength | Resource | Pack Position: 22 | - | - | `hlk` |
| `10023` | Avengers Mansion | Support | Pack Position: 23 | - | - | `hlk` |
| `10024` | Helicarrier | Support | Pack Position: 24 | - | - | `hlk` |
| `10025` | Inner Demons | Obligation | Hulk | - | 3 pips | `hlk` |
| `10026` | Abomination | Minion | Hulk Nemesis | SCH:2 ATK:3 HP:6 | 3 pips | `hlk` |
| `10027` | Total Destruction | Side Scheme | Hulk Nemesis | - | 3 pips | `hlk` |
| `10028` | Clash Of The Titans | Treachery | Hulk Nemesis | - | 3 pips | `hlk` |
| `10029` | Beat Cop | Support | Pack Position: 29 | - | - | `hlk` |
| `10030` | Inspiring Presence | Event | Pack Position: 30 | - | - | `hlk` |
| `10031` | Electrostatic Armor | Upgrade | Pack Position: 31 | - | - | `hlk` |
| `10032` | Resourceful | Upgrade | Pack Position: 32 | - | - | `hlk` |

---

## Pack: Hulk (`hlk`)

### Set: Hulk

### [10001a] Hulk
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 0, **ATK**: 3, **DEF**: 3, **HP**: 18, **Hand Size**: 4
- **Traits**: *Avenger. Gamma.*
- **Rules Text**:
  > "Enraged" — **Forced Interrupt**: When your turn ends, discard your hand.
- **Flavor**: *"Hulk is not sorry. Hulk is Hulk."*
- **Image Asset**: `assets/card-art/bundles/cards/10001a.png` (300×418 px, 241.4 KB)
### [10001b] Bruce Banner
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 18, **Hand Size**: 5
- **Traits**: *Genius. Scientist.*
- **Rules Text**:
  > Experimental Research — **Action**: Draw 1 card. Choose and discard 1 card from your hand. (Limit once per round.)
- **Flavor**: *"Don't make me angry. You wouldn't like me when I'm angry."*
- **Image Asset**: `assets/card-art/bundles/cards/10001b.png` (300×418 px, 224.7 KB)
### [10002] Crushing Blow
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (1–2/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > You can only spend [physical] resources to pay for this card.
  > **Hero Action** *(attack)*: Deal damage to an enemy equal to your ATK.
- **Flavor**: *"Puny monster." —Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/10002.png` (300×419 px, 39.3 KB)
### [10003] Hulk Smash
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (3–4/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When you make a basic attack, you get +10 ATK for that attack. If you paid for this card using only [physical] resources, that attack gains overkill.
- **Flavor**: *"When Hulk smash something, it stay smashed!" —Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/10003.png` (300×418 px, 236.5 KB)
### [10004] Sub-Orbital Leap
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (5–6/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme (5 threat instead if you paid for this card using only [physical] resources).
- **Flavor**: *"Leave Hulk alone!" —Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/10004.png` (300×419 px, 36.4 KB)
### [10005] Thunderclap
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (7–8/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Choose up to 3 different enemies. Deal 3 damage to each of them.
- **Flavor**: *"Are you afraid of Hulk's little wind?" —Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/10005.png` (300×419 px, 30.6 KB)
### [10006] Unstoppable Force
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (9–10/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Rules Text**:
  > **Hero Action**: Ready Hulk. If you paid for this card using only [physical] resources, draw 1 card.
- **Flavor**: *"Nobody stop Hulk!" —Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/10006.png` (300×419 px, 41.4 KB)
### [10007] Limitless Strength
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (11–12/15, Qty: 2)
- **Stats**: **Resources**: [physical] [physical] [physical]
- **Rules Text**:
  > Spend this card only in hero form.
- **Image Asset**: `assets/card-art/bundles/cards/10007.png` (300×419 px, 42.2 KB)
### [10008] Banner's Laboratory
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Bruce Banner gets +2 REC.
  > **Alter-Ego Resource**: Exhaust Banner's Laboratory → generate a [mental] resource.
- **Flavor**: *"The best thing about my lab is that nobody ever bothers me here." —Bruce Banner*
- **Image Asset**: `assets/card-art/bundles/cards/10008.png` (300×419 px, 39.0 KB)
### [10009] Boundless Rage
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (14/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Condition. Gamma.*
- **Rules Text**:
  > Hero form only. Hulk gets +1 ATK.
  > **Forced Response**: After you change form, discard this card.
- **Flavor**: *"The angrier I get, the stronger I get." —Bruce Banner*
- **Image Asset**: `assets/card-art/bundles/cards/10009.png` (300×418 px, 251.7 KB)
### [10010] Immovable Object
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (15/15)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > You get +4 hit points.
  > Hulk gains retaliate 1.
- **Image Asset**: `assets/card-art/bundles/cards/10010.png` (300×419 px, 41.0 KB)
### [10025] Inner Demons
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hulk Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Bruce Banner player.***
  > Change form *(flip your identity)*.
  > • If you are Bruce Banner, discard 2 cards from your hand. Discard this obligation.
  > • If you are Hulk, exhaust your hero. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/10025.png` (300×419 px, 38.7 KB)

### Set: Aggression

### [10011] Brawn
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 5, **Resources**: [mental]
- **Traits**: *Champion. Gamma.*
- **Rules Text**:
  > **Response**: After Brawn attacks, remove 1 threat from a scheme.
- **Flavor**: *"I'm the strongest one there is. And the smartest. That's all the authority I need."*
- **Image Asset**: `assets/card-art/bundles/cards/10011.png` (300×419 px, 38.7 KB)
### [10012] Sentry — *Robert Reynolds*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 5, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Forced Response**: After Sentry enters play under your control, deal yourself 1 encounter card.
- **Flavor**: *"When I use my powers of a million exploding suns, I unleash the Void. He attacks the world every time I try to save it."*
- **Image Asset**: `assets/card-art/bundles/cards/10012.png` (300×419 px, 38.1 KB)
### [10013] She-Hulk — *Jennifer Walters*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 1 [star] (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Avenger. Gamma.*
- **Rules Text**:
  > [star] She-Hulk gets +1 ATK for each damage token here.
- **Flavor**: *"I'd ask your to surrender... but I'm really hoping you'll put up a fight."*
- **Image Asset**: `assets/card-art/bundles/cards/10013.png` (300×419 px, 40.1 KB)
### [10014] Drop Kick
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If you paid for this card using only [physical] resources, stun that enemy and draw 1 card.
- **Flavor**: *"Smashing is what Hulk does best!" —Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/10014.png` (300×419 px, 37.0 KB)
### [10015] Toe to Toe
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Choose an enemy. That enemy attacks you. Deal 5 damage to that enemy.
- **Flavor**: *"How about a taste of your own medicine?" —Captain Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/10015.png` (300×418 px, 231.8 KB)
### [10016] "You'll Pay for That!"
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Response** *(thwart)*: After the villain attacks you, remove 1 threat from a scheme for each damage you took from the attack (to a maximum of 5).
- **Image Asset**: `assets/card-art/bundles/cards/10016.png` (300×419 px, 34.6 KB)
### [10017] The Power of Aggression
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Aggression *(red)* card.
### [10018] Martial Prowess
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control.
  > Max 1 per player.
  > **Resource**: Exhaust Martial Prowess → generate a [physical] resource for an [[Attack]] event.
- **Image Asset**: `assets/card-art/bundles/cards/10018.png` (300×419 px, 30.5 KB)

### Set: Basic

### [10019] To the Rescue!
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/10019.png` (300×419 px, 34.6 KB)
### [10020] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [10021] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [10022] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [10023] Avengers Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Avengers Mansion → choose a player. That player draws 1 card.
- **Flavor**: *"Did you remember to turn off the stove?" —Janet Van Dyne*
### [10024] Helicarrier
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Helicarrier → choose a player. Reduce the resource cost of the next card that player plays this phase by 1.
- **Flavor**: *"A flying aircraft carrier? You're kidding, right?" —Jennifer Walters*
### [10032] Resourceful
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Resource**: Discard Resourceful → generate a [wild] resource.
- **Flavor**: *"Innovation is the ultimate weapon." —Vision*
- **Image Asset**: `assets/card-art/bundles/cards/10032.png` (300×419 px, 34.3 KB)

### Set: Hulk Nemesis

### [10026] Abomination
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hulk Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Gamma.*
- **Rules Text**:
  > [star] **Forced Response**: After Abomination attacks you, discard the top card of your deck. If a [physical] resource was discarded this way, take 2 damage.
- **Flavor**: *"Foolish rabble! Your pitiful display is nothing to my newfound power!"*
- **Image Asset**: `assets/card-art/bundles/cards/10026.png` (300×419 px, 40.6 KB)
### [10027] Total Destruction
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hulk Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Threat cannot be removed from this scheme while Abomination is in play.
- **Image Asset**: `assets/card-art/bundles/cards/10027.png` (419×300 px, 35.3 KB)
### [10028] Clash Of The Titans
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Hulk Nemesis (3–5/5, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hulk Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy with the highest ATK attacks the hero or ally with the highest ATK (first player decides ties.) If no attack was made this way, this card gains surge.
- **Flavor**: *"You are all beneath me!" —Abomination*
- **Image Asset**: `assets/card-art/bundles/cards/10028.png` (300×419 px, 40.1 KB)

### Set: Justice

### [10029] Beat Cop
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Action**: Exhaust Beat Cop → move 1 threat from a scheme to here.
  > **Action**: Exhaust and discard Beat Cop → deal 1 damage to a minion for each threat here.
- **Image Asset**: `assets/card-art/bundles/cards/10029.png` (300×419 px, 37.3 KB)

### Set: Leadership

### [10030] Inspiring Presence
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > **Hero Action**: Heal 1 damage from an ally and ready it.
- **Image Asset**: `assets/card-art/bundles/cards/10030.png` (300×419 px, 38.0 KB)

### Set: Protection

### [10031] Electrostatic Armor
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Hulk (`hlk`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Player under any player's control.
  > Max 1 per player.
  > **Response**: After you defend against an attack, deal 1 damage to the attacking character.
- **Image Asset**: `assets/card-art/bundles/cards/10031.png` (300×419 px, 36.1 KB)

