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
| `58001a` | Wonder Man | Hero | Wonder Man | THW:2 ATK:1 DEF:2 HP:12 | - | `wonder_man` |
| `58001b` | Simon Williams | Alter-Ego | Wonder Man | HP:12 | - | `wonder_man` |
| `58002` | Ionic Physiology | Upgrade | Wonder Man | - | - | `wonder_man` |
| `58003` | Active Altruism | Event | Wonder Man | - | - | `wonder_man` |
| `58004` | Ionic Blast | Event | Wonder Man | - | - | `wonder_man` |
| `58005` | Starstruck | Event | Wonder Man | - | - | `wonder_man` |
| `58006` | Energy Siphon | Resource | Wonder Man | - | - | `wonder_man` |
| `58007` | Wonder Fans | Support | Wonder Man | - | - | `wonder_man` |
| `58008` | Jet Belt | Upgrade | Wonder Man | - | - | `wonder_man` |
| `58009` | Mr. Hollywood | Upgrade | Wonder Man | - | - | `wonder_man` |
| `58010` | Signature Sunglasses | Upgrade | Wonder Man | - | - | `wonder_man` |
| `58011` | "What Are You?" | Upgrade | Wonder Man | - | - | `wonder_man` |
| `58012` | Firebird | Ally | Pack Position: 12 | THW:2 ATK:2 HP:2 | - | `wonder_man` |
| `58013` | Hawkeye | Ally | Pack Position: 13 | THW:1 ATK:1 HP:3 | - | `wonder_man` |
| `58014` | Scarlet Witch | Ally | Pack Position: 14 | THW:2 ATK:2 HP:3 | - | `wonder_man` |
| `58015` | Sentry | Ally | Pack Position: 15 | THW:2 ATK:3 HP:5 | - | `wonder_man` |
| `58016` | Battlefield Benevolence | Event | Pack Position: 16 | - | - | `wonder_man` |
| `58017` | Bombs Away | Event | Pack Position: 17 | - | - | `wonder_man` |
| `58018` | Everywhere All at Once | Event | Pack Position: 18 | - | - | `wonder_man` |
| `58019` | Stronger Together | Event | Pack Position: 19 | - | - | `wonder_man` |
| `58020` | Unified Strike | Event | Pack Position: 20 | - | - | `wonder_man` |
| `58021` | Heroic Conditioning | Upgrade | Pack Position: 21 | - | - | `wonder_man` |
| `58022` | Swordsman | Ally | Pack Position: 22 | THW:2 ATK:2 HP:4 | - | `wonder_man` |
| `58023` | Energy | Resource | Pack Position: 23 | - | - | `wonder_man` |
| `58024` | Jarvis | Support | Pack Position: 24 | - | - | `wonder_man` |
| `58025` | Pacifism | Obligation | Wonder Man | - | 2 pips | `wonder_man` |
| `58026` | Grim Reaper | Minion | Wonder Man Nemesis | SCH:2 ATK:2 HP:3 | 2 pips | `wonder_man` |
| `58027` | Brother vs. Brother | Side Scheme | Wonder Man Nemesis | - | 3 pips | `wonder_man` |
| `58028` | Scythe Strike | Treachery | Wonder Man Nemesis | - | 2 pips | `wonder_man` |
| `58029` | Death Cannot Die | Treachery | Wonder Man Nemesis | - | Star | `wonder_man` |
| `58030` | Caught in the Crossfire | Upgrade | Pack Position: 30 | - | - | `wonder_man` |
| `58031` | Cameo | Support | Pack Position: 31 | - | - | `wonder_man` |
| `58032` | Coordinated Effort | Upgrade | Pack Position: 32 | - | - | `wonder_man` |
| `58033` | Disarming Defense | Event | Pack Position: 33 | - | - | `wonder_man` |
| `58034` | Avengers Compound | Support | Pack Position: 34 | - | - | `wonder_man` |

---

## Pack: Wonder Man (`wonder_man`)

### Set: Wonder Man

### [58001a] Wonder Man
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1 [star], **DEF**: 2, **HP**: 12, **Hand Size**: 5
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > *Power Recycling* — Wonder Man gets +1 ATK for each card tucked under Ionic Physiology.
  > [star] **Forced Response**: After Wonder Man makes a basic attack, discard each card tucked under Ionic Physiology.
- **Image Asset**: `assets/card-art/bundles/cards/58001a.png` (300×426 px, 239.2 KB)
### [58001b] Simon Williams
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 12, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > *Ionic Energy Being* — You may include events with a printed [energy] resource icon from any aspect in your deck.
  > **Setup**: Put Ionic Physiology into play.
- **Image Asset**: `assets/card-art/bundles/cards/58001b.png` (300×426 px, 222.2 KB)
### [58002] Ionic Physiology
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (1/16)
- **Properties**: Permanent
- **Stats**: **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Permanent. Max 3 cards tucked here.
  > **Response**: After you play an event with a printed [energy] resource, tuck that event from your discard pile under this card → heal 1 damage from your identity.
- **Image Asset**: `assets/card-art/bundles/cards/58002.png` (710×1030 px, 343.8 KB)
### [58003] Active Altruism
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (2–4/16, Qty: 3)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 1 threat from a scheme. Remove 2 additional threat from that scheme for each [energy] resource you overpaid for this card (to a maximum of [energy] [energy]).
- **Image Asset**: `assets/card-art/bundles/cards/58003.jpg` (710×1030 px, 300.4 KB)
### [58004] Ionic Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (5–6/16, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. Deal 2 additional damage to that enemy for each [energy] resource you overpaid for this card (to a maximum of [energy] [energy] [energy]).
- **Image Asset**: `assets/card-art/bundles/cards/58004.png` (710×1030 px, 350.8 KB)
### [58005] Starstruck
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (7–9/16, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal damage to an enemy equal to your ATK. If you overpaid for this card with a [energy] resource, stun that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/58005.jpg` (710×1030 px, 332.6 KB)
### [58006] Energy Siphon
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (10–11/16, Qty: 2)
- **Stats**: **Resources**: [energy]
- **Rules Text**:
  > **Hero Interrupt**: When you spend this card, take up to 3 damage → this card generates 1 additional [energy] resource for each damage taken this way.
- **Image Asset**: `assets/card-art/bundles/cards/58006.jpg` (710×1030 px, 360.9 KB)
### [58007] Wonder Fans
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (12/16)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Civilian.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Wonder Fans → choose:
  > • Tuck 1 event with a printed [energy] resource from your discard pile under Ionic Physiology.
  > • Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/58007.png` (710×1030 px, 325.2 KB)
### [58008] Jet Belt
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (13/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > **Hero Resource**: Exhaust Jet Belt → generate a [energy] resource for an event.
  > **Hero Resource**: Exhaust Jet Belt and discard a card tucked under Ionic Physiology → generate a [energy] resource.
- **Image Asset**: `assets/card-art/bundles/cards/58008.png` (710×1030 px, 349.8 KB)
### [58009] Mr. Hollywood
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (14/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Title.*
- **Rules Text**:
  > **Resource**: Generate a [energy] resource to overpay for a card. (Limit once per card.)
- **Flavor**: *"Hey, aren't you one of those guys from Beach Volleyball Bros Part II?" —Kate Bishop*
- **Image Asset**: `assets/card-art/bundles/cards/58009.jpg` (710×1030 px, 333.3 KB)
### [58010] Signature Sunglasses
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (15/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Item.*
- **Rules Text**:
  > **Response**: After you change form, choose:
  > • Tuck an event or resource card with a printed [energy] resource from your discard pile under Ionic Physiology.
  > • Add a card tucked under Ionic Physiology to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/58010.png` (710×1030 px, 299.4 KB)
### [58011] "What Are You?"
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (16/16)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Forced Interrupt**: When Wonder Man would be defeated, instead set his hit point dial to 4 and change him to alter-ego form. You may tuck events with a printed [energy] resource from your discard pile under Ionic Physiology until there are 3 cards tucked there. Remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/58011.jpg` (710×1030 px, 336.4 KB)
### [58025] Pacifism
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wonder Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Simon Williams player.***
  > Wonder Man cannot attack.
  > **Alter-Ego Action**: Exhaust Simon Williams or discard 3 cards tucked under Ionic Physiology → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/58025.png` (710×1030 px, 307.7 KB)

### Set: Justice

### [58012] Firebird — *Bonita Juarez*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 2), **HP**: 2, **Resources**: [energy]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > If you overpaid for Firebird, put 1 rebirth counter on her.
  > **Interrupt**: When Firebird would be defeated by consequential damage, remove 1 rebirth counter from her → heal all damage from her instead.
- **Image Asset**: `assets/card-art/bundles/cards/58012.jpg` (710×1030 px, 334.3 KB)
### [58013] Hawkeye — *Clint Barton*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Avenger. S.H.I.E.L.D.*
- **Rules Text**:
  > Hawkeye enters play with 4 arrow counters on him.
  > **Response**: After an ally makes a basic thwart, remove 1 arrow counter from Hawkeye → deal 2 damage to a minion.
- **Image Asset**: `assets/card-art/bundles/cards/58013.png` (710×1030 px, 321.1 KB)
### [58014] Scarlet Witch — *Wanda Maximoff*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Avenger. Mystic.*
- **Rules Text**:
  > **Forced Response**: After you play Scarlet Witch, discard the top card of the encounter deck. If it is a treachery card, resolve its **"When Revealed"** ability.
- **Image Asset**: `assets/card-art/bundles/cards/58014.jpg` (710×1030 px, 301.2 KB)
### [58015] Sentry — *Robert Reynolds*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 5, **Resources**: [energy]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Forced Response**: After Sentry enters play, search the encounter deck for a side scheme and reveal it. *(Shuffle.)* If no side scheme was revealed this way, place 6 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/58015.png` (710×1030 px, 302.4 KB)
### [58016] Battlefield Benevolence
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Heal 2 damage from an enemy → confuse that enemy.
- **Flavor**: *"Huh? What's the trick?" —Vulture*
- **Image Asset**: `assets/card-art/bundles/cards/58016.png` (710×1030 px, 315.1 KB)
### [58018] Everywhere All at Once
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: -1, **Resources**: [energy]
- **Traits**: *Aerial. Thwart.*
- **Rules Text**:
  > Play only if your identity has the [[Aerial]] trait.
  > **Hero Action** *(thwart)*: Choose X schemes. Remove 2 threat from each chosen scheme (3 threat instead if you overpaid for this card).
- **Image Asset**: `assets/card-art/bundles/cards/58018.jpg` (710×1030 px, 334.2 KB)
### [58021] Heroic Conditioning
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > You get +3 hit points and your hero gets +1 THW.
- **Image Asset**: `assets/card-art/bundles/cards/58021.jpg` (710×1030 px, 326.0 KB)

### Set: Aggression

### [58017] Bombs Away
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Aerial. Tactic.*
- **Rules Text**:
  > **Hero Action**: Exhaust an [[AERIAL]] character you control and choose a player → deal 3 damage to the villain and each minion engaged with that player.
- **Image Asset**: `assets/card-art/bundles/cards/58017.jpg` (710×1030 px, 353.6 KB)
### [58030] Caught in the Crossfire
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a non-[[Elite]] minion. Max 1 per minion.
  > **Interrupt**: When a friendly character attacks, deal 1 damage to attached minion.
- **Image Asset**: `assets/card-art/bundles/cards/58030.jpg` (710×1030 px, 340.3 KB)

### Set: Protection

### [58019] Stronger Together
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Hero Interrupt**: When a character other than your hero would take any amount of damage, if that character shares a [[Trait]] with your hero, reduce that damage by your DEF.
- **Image Asset**: `assets/card-art/bundles/cards/58019.png` (710×1030 px, 304.0 KB)
### [58033] Disarming Defense
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When your hero defends against an attack, it gets +2 DEF for that attack. If you take no damage from that attack, discard an attachment on the attacking enemy with the text "**Hero Action**" or "**Hero Response**".
- **Image Asset**: `assets/card-art/bundles/cards/58033.jpg` (710×1030 px, 371.8 KB)

### Set: Leadership

### [58020] Unified Strike
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Interrupt**: When an ally uses a basic power, exhaust your hero → add your hero's matching power to that ally's power for this use. That ally does not take consequential damage for this use.
- **Image Asset**: `assets/card-art/bundles/cards/58020.png` (710×1030 px, 324.1 KB)
### [58031] Cameo
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 31
- **Rules Text**:
  > Setup. Max 1 per deck.
  > **Setup**: Search your collection for an identity-specific ally for an identity not in this game. Shuffle that ally into your deck. Discard 2 cards from your hand and remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/58031.png` (710×1030 px, 332.2 KB)
### [58032] Coordinated Effort
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to an encounter card in play. Max 1 per encounter card.
  > While paying costs on attached card, any player may help pay those costs.
- **Image Asset**: `assets/card-art/bundles/cards/58032.png` (710×1030 px, 326.7 KB)

### Set: Basic

### [58022] Swordsman — *Jacques Duquesne*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 2 [star] (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Avenger.*
- **Rules Text**:
  > [star] Swordsman's basic attacks gain piercing.
  > **Hero Response**: After a boost card is turned faceup during an undefended attack, declare Swordsman as the defender without exhausting him.
- **Image Asset**: `assets/card-art/bundles/cards/58022.jpg` (710×1030 px, 344.6 KB)
### [58023] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [58024] Jarvis
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 24
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Avenger. Persona.*
- **Rules Text**:
  > **Response**: After an [[Avenger]] hero changes into alter-ego form, exhaust Jarvis → choose:
  > • That identity gets +2 REC until the end of the phase.
  > • Discard a status card from that identity.
- **Image Asset**: `assets/card-art/bundles/cards/58024.jpg` (710×1030 px, 295.8 KB)
### [58034] Avengers Compound
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait. Max 1 per deck.
  > **Action**: Exhaust Avengers Compound → choose: tuck 1 ally from your hand here if there is no ally tucked here, or play the ally tucked here as if it were in your hand.
- **Image Asset**: `assets/card-art/bundles/cards/58034.png` (710×1030 px, 363.0 KB)

### Set: Wonder Man Nemesis

### [58026] Grim Reaper
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wonder Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cyborg.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After Grim Reaper attacks and defeats an ally, deal that ally's controller a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/58026.png` (710×1030 px, 324.0 KB)
### [58027] Brother vs. Brother
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wonder Man Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > As an additional cost to attack Grim Reaper, you must discard 1 card from your hand.
- **Flavor**: *"If only you were my real brother...instead of this monstrosity you've become." —Grim Reaper*
- **Image Asset**: `assets/card-art/bundles/cards/58027.jpg` (1030×710 px, 316.8 KB)
### [58028] Scythe Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wonder Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Grim Reaper is in play, he activates against you. Otherwise, take 2 indirect damage.
- **Flavor**: *"Nothing will get in my way!" —Grim Reaper*
- **Image Asset**: `assets/card-art/bundles/cards/58028.jpg` (710×1030 px, 316.7 KB)
### [58029] Death Cannot Die
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Wonder Man (`wonder_man`)
- **Deck / Set**: Wonder Man Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Wonder Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Grim Reaper activates against you. If Grim Reaper is not in play, find him and reveal him.
  >
  > ---
  >
  > [star] **Boost**: If Grim Reaper is in play, he activates against you *(after this activation)*.
- **Image Asset**: `assets/card-art/bundles/cards/58029.png` (710×1030 px, 267.0 KB)

