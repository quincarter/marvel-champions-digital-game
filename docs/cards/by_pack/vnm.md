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
| `20001a` | Venom | Hero | Venom | THW:1 ATK:2 DEF:2 HP:12 | - | `vnm` |
| `20001b` | Flash Thompson | Alter-Ego | Venom | HP:12 | - | `vnm` |
| `20002` | Behind Enemy Lines | Event | Venom | - | - | `vnm` |
| `20003` | Grasping Tendrils | Event | Venom | - | - | `vnm` |
| `20004` | Locked and Loaded | Event | Venom | - | - | `vnm` |
| `20005` | Run and Gun | Event | Venom | - | - | `vnm` |
| `20006` | Savage Attack | Event | Venom | - | - | `vnm` |
| `20007` | Project Rebirth 2.0 | Support | Venom | - | - | `vnm` |
| `20008` | Multi-Gun | Upgrade | Venom | - | - | `vnm` |
| `20009` | Spider-Sense | Upgrade | Venom | - | - | `vnm` |
| `20010` | Venom's Pistol | Upgrade | Venom | - | - | `vnm` |
| `20011` | Jack Flag | Ally | Pack Position: 11 | THW:2 ATK:1 HP:3 | - | `vnm` |
| `20012` | Scare Tactic | Event | Pack Position: 12 | - | - | `vnm` |
| `20013` | Making an Entrance | Event | Pack Position: 13 | - | - | `vnm` |
| `20014` | The Power of Justice | Resource | Pack Position: 14 | - | - | `vnm` |
| `20015` | Sonic Rifle | Upgrade | Pack Position: 15 | - | - | `vnm` |
| `20016` | Star-Lord | Ally | Pack Position: 16 | THW:2 ATK:2 HP:3 | - | `vnm` |
| `20017` | Energy | Resource | Pack Position: 17 | - | - | `vnm` |
| `20018` | Genius | Resource | Pack Position: 18 | - | - | `vnm` |
| `20019` | Strength | Resource | Pack Position: 19 | - | - | `vnm` |
| `20020` | Resourceful | Upgrade | Pack Position: 20 | - | - | `vnm` |
| `20021` | Side Holster | Upgrade | Pack Position: 21 | - | - | `vnm` |
| `20022` | Plasma Pistol | Upgrade | Pack Position: 22 | - | - | `vnm` |
| `20023` | Struggle for Control | Obligation | Venom | - | 2 pips | `vnm` |
| `20024` | Klyntar Frenzy | Side Scheme | Venom Nemesis | - | 3 pips | `vnm` |
| `20025` | Enraged Symbiote | Minion | Venom Nemesis | SCH:1 ATK:2 HP:2 | Star | `vnm` |
| `20026` | Fusillade | Event | Pack Position: 26 | - | - | `vnm` |
| `20027` | "Welcome Aboard" | Event | Pack Position: 27 | - | - | `vnm` |
| `20028` | Shake it Off | Event | Pack Position: 28 | - | - | `vnm` |
| `20029` | Crew Quarters | Support | Pack Position: 29 | - | - | `vnm` |

---

## Pack: Venom (`vnm`)

### Set: Venom

### [20001a] Venom
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 2, **HP**: 12, **Hand Size**: 5
- **Traits**: *Guardian. Space Knight.*
- **Rules Text**:
  > You can control 1 additional upgrade that has the restricted keyword.
  > *Symbiotic Bond* - **Resource**: Take 1 damage → generate a [wild] resource. (Limit once per phase)
- **Image Asset**: `assets/card-art/bundles/cards/20001a.png` (300×418 px, 226.9 KB)
### [20001b] Flash Thompson
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 12, **Hand Size**: 6
- **Traits**: *Soldier.*
- **Rules Text**:
  > You can control 1 additional upgrade that has the restricted keyword.
  > *Armed and Ready* - **Setup**: Discard cards from the top of your deck until you discard a [[weapon]] upgrade, then add that card to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/20001b.png` (300×418 px, 202.6 KB)
### [20002] Behind Enemy Lines
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (1–2/23, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action:** *(thwart)*: Remove 3 threat from a scheme. If you paid for this card using only [mental] resources, confuse an enemy.
- **Flavor**: *"Yes, sir, I understand. Country first." —Venom*
- **Image Asset**: `assets/card-art/bundles/cards/20002.png` (729×1045 px, 182.6 KB)
### [20003] Grasping Tendrils
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (3–4/23, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When the villain initiates an attack against you, cancel that attack. If you paid for this card using only [physical] resources, stun the villain.
- **Image Asset**: `assets/card-art/bundles/cards/20003.png` (728×1047 px, 172.6 KB)
### [20004] Locked and Loaded
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (5/23)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Action** Search your deck for a [[weapon]] upgrade and add it to your hand. Shuffle your deck.
- **Flavor**: *"I've been looking forward to this!" —Venom*
- **Image Asset**: `assets/card-art/bundles/cards/20004.png` (728×1045 px, 170.6 KB)
### [20005] Run and Gun
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (6–8/23, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action**: Ready Venom and each [[weapon]] upgrade you control.
- **Flavor**: *"So much for doing this the easy way." —Venom*
- **Image Asset**: `assets/card-art/bundles/cards/20005.png` (729×1047 px, 161.5 KB)
### [20006] Savage Attack
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (9–10/23, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy. If you paid for this card using only [energy] resources, this attack gains overkill.
- **Flavor**: *"The rage feeds my symbiote. The rage makes it strong." —Flash Thompson*
- **Image Asset**: `assets/card-art/bundles/cards/20006.png` (728×1045 px, 176.6 KB)
### [20007] Project Rebirth 2.0
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (11/23)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Project Rebirth 2.0 → choose to either draw 1 card or heal 3 damage from Flash Thompson.
- **Flavor**: *"The U.S. government's second super-soldier project, binding symbiotes to talented veterans."*
- **Image Asset**: `assets/card-art/bundles/cards/20007.png` (727×1045 px, 184.6 KB)
### [20008] Multi-Gun
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (12/23)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [wild]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Action**: Exhaust Multi-Gun → choose one of the following:
  > Deal 2 damage to an enemy
  > Choose a player. Deal 1 damage to each minion engaged with that player.
  > Remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/20008.png` (731×1043 px, 195.6 KB)
### [20009] Spider-Sense
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (13/23)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When the villain initiates an attack against you, draw 1 card.
- **Flavor**: *"I feel... tingly." —Venom*
- **Image Asset**: `assets/card-art/bundles/cards/20009.png` (728×1046 px, 164.3 KB)
### [20010] Venom's Pistol
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (14–15/23, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Interrupt**: When you use one of Venom's basic powers, exhaust Venom's Pistol → Venom gets +1 to that power for this use.
- **Image Asset**: `assets/card-art/bundles/cards/20010.png` (728×1045 px, 180.7 KB)
### [20023] Struggle for Control
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom (23/23)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Flash Thompson player.***
  > You may flip to your alter-ego form. Choose:
  > • Exhaust Flash Thompson and take 2 damage → discard this obligation.
  > • Put 1 set-aside copy of Enraged Symbiote into play engaged with the first player. If you cannot, this card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/20023.png` (728×1047 px, 201.0 KB)

### Set: Justice

### [20011] Jack Flag — *Jack Harrison*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Response:** After Jack Flag thwarts, place 1 ammo counter on him.
  > **Hero Action**: Exhaust Jack Flag and remove 1 ammo counter from him → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/20011.png` (728×1045 px, 176.2 KB)
### [20012] Scare Tactic
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 12
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action:** *(attack)*: Deal 3 damage to a confused enemy.
- **Flavor**: *"Boo!"*
- **Image Asset**: `assets/card-art/bundles/cards/20012.png` (728×1047 px, 154.7 KB)
### [20013] Making an Entrance
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt:** When your hero makes a basic thwart, it gets +2 THW for that thwart. After that thwart ends, if your hero removed all threat from a scheme that way, heal 2 damage from your hero.
- **Image Asset**: `assets/card-art/bundles/cards/20013.png` (729×1047 px, 173.6 KB)
### [20014] The Power of Justice
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Justice *(yellow)* card.
### [20015] Sonic Rifle
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted. Uses (2 charge counters).
  > **Hero Action**: Exhaust Sonic Rifle and remove 1 charge counter from it → confuse an enemy (deal 3 damage to that enemy instead if it is already confused).
- **Image Asset**: `assets/card-art/bundles/cards/20015.png` (728×1047 px, 172.0 KB)

### Set: Basic

### [20016] Star-Lord — *Peter Quill*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Guardian.*
- **Rules Text**:
  > [star] Star-Lord's attacks gain ranged.
  > **Forced Response**: After Star-Lord enters play under your control, deal yourself 1 facedown encounter card.
- **Flavor**: *"Gotta risk it to get the biscuit."*
- **Image Asset**: `assets/card-art/bundles/cards/20016.png` (729×1044 px, 181.4 KB)
### [20017] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [20018] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [20019] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [20020] Resourceful
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Resource**: Discard Resourceful → generate a [wild] resource.
- **Flavor**: *"Innovation is the ultimate weapon." —Vision*
### [20021] Side Holster
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Item.*
- **Rules Text**:
  > Play under any player's control.
  > Max 1 per player.
  > You can control 1 additional [[weapon]] upgrade that has the restricted keyword.
- **Image Asset**: `assets/card-art/bundles/cards/20021.png` (727×1045 px, 167.0 KB)
### [20022] Plasma Pistol
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted.
  > Uses (3 charge counters).
  > **Hero Action**: Exhaust Plasma Pistol and remove 1 charge counter from it → deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/20022.png` (728×1045 px, 188.3 KB)
### [20029] Crew Quarters
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Alter-Ego Action**: Exhaust Crew Quarters → heal 1 damage from an alter-ego.
- **Image Asset**: `assets/card-art/bundles/cards/20029.png` (729×1049 px, 197.3 KB)

### Set: Venom Nemesis

### [20024] Klyntar Frenzy
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom Nemesis (1/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Venom Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Threat cannot be removed from this scheme while a [[Symbiote]] enemy is in play.
- **Flavor**: *<b><i>The Venom symbiote is distraught, bonding with everyone it touches and sending them into a destructive rage.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/20024.png` (1049×725 px, 177.2 KB)
### [20025] Enraged Symbiote
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Venom Nemesis (2–5/5, Qty: 4)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Venom Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Symbiote.*
- **Rules Text**:
  > Guard. Patrol. *(While this minion is engaged with you, you cannot thwart the main scheme.)*
  > *(Venom's nemesis minion.)*
  >
  > ---
  >
  > [star] **Boost**: Put Enraged Symbiote into play engaged with you.
- **Flavor**: *"You will kneel before the true Destroyer!"*
- **Image Asset**: `assets/card-art/bundles/cards/20025.png` (729×1045 px, 181.1 KB)

### Set: Aggression

### [20026] Fusillade
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust a [[weapon]] upgrade you control → deal 5 damage to an enemy.
- **Flavor**: *"Give me something to shoot."*
- **Image Asset**: `assets/card-art/bundles/cards/20026.png` (728×1046 px, 168.1 KB)

### Set: Leadership

### [20027] "Welcome Aboard"
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait. Max 1 per round.
  > **Hero Action**: Reduce the resource cost of the next ally played this phase by 2.
- **Flavor**: *"Guardians gather? Group up? Man, I don't know." —Peter Quill*
- **Image Asset**: `assets/card-art/bundles/cards/20027.png` (729×1045 px, 185.7 KB)

### Set: Protection

### [20028] Shake it Off
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Venom (`vnm`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Response**: After a [[guardian]] character takes any amount of damage from an attack, give that character a tough status card.
- **Flavor**: *"Groot, buddy, I get that you can regrow and all but you've gotta be more careful." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/20028.png` (728×1045 px, 201.2 KB)

