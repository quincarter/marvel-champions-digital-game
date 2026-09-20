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
| `03001a` | Captain America | Hero | Captain America | THW:2 ATK:2 DEF:2 HP:11 | - | `cap` |
| `03001b` | Steve Rogers | Alter-Ego | Captain America | HP:11 | - | `cap` |
| `03002` | Agent 13 | Ally | Captain America | THW:2 ATK:1 HP:3 | - | `cap` |
| `03003` | Fearless Determination | Event | Captain America | - | - | `cap` |
| `03004` | Heroic Strike | Event | Captain America | - | - | `cap` |
| `03005` | Shield Block | Event | Captain America | - | - | `cap` |
| `03006` | Shield Toss | Event | Captain America | - | - | `cap` |
| `03007` | Steve's Apartment | Support | Captain America | - | - | `cap` |
| `03008` | Captain America's Helmet | Upgrade | Captain America | - | - | `cap` |
| `03009` | Captain America's Shield | Upgrade | Captain America | - | - | `cap` |
| `03010` | Super-Soldier Serum | Upgrade | Captain America | - | - | `cap` |
| `03011` | Falcon | Ally | Pack Position: 11 | THW:2 ATK:2 HP:3 | - | `cap` |
| `03012` | Hawkeye | Ally | Pack Position: 12 | THW:1 ATK:1 HP:3 | - | `cap` |
| `03013` | Squirrel Girl | Ally | Pack Position: 13 | THW:1 ATK:1 HP:2 | - | `cap` |
| `03014` | Wonder Man | Ally | Pack Position: 14 | THW:1 ATK:3 HP:3 | - | `cap` |
| `03015` | Avengers Assemble! | Event | Pack Position: 15 | - | - | `cap` |
| `03016` | Make the Call | Event | Pack Position: 16 | - | - | `cap` |
| `03017` | Strength In Numbers | Event | Pack Position: 17 | - | - | `cap` |
| `03018` | The Power of Leadership | Resource | Pack Position: 18 | - | - | `cap` |
| `03019` | Quinjet | Support | Pack Position: 19 | - | - | `cap` |
| `03020` | Mockingbird | Ally | Pack Position: 20 | THW:1 ATK:1 HP:3 | - | `cap` |
| `03021` | Energy | Resource | Pack Position: 21 | - | - | `cap` |
| `03022` | Genius | Resource | Pack Position: 22 | - | - | `cap` |
| `03023` | Strength | Resource | Pack Position: 23 | - | - | `cap` |
| `03024` | Avengers Tower | Support | Pack Position: 24 | - | - | `cap` |
| `03025` | Honorary Avenger | Upgrade | Pack Position: 25 | - | - | `cap` |
| `03026` | Man Out of Time | Obligation | Captain America | - | 2 pips | `cap` |
| `03027` | Hit Squad | Side Scheme | Captain America Nemesis | - | 3 pips | `cap` |
| `03028` | Baron Zemo | Minion | Captain America Nemesis | SCH:1 ATK:3 HP:5 | 2 pips | `cap` |
| `03029` | Hydra Soldier | Minion | Captain America Nemesis | SCH:1 ATK:2 HP:4 | 1 pips | `cap` |
| `03030` | Hail Hydra! | Treachery | Captain America Nemesis | - | - | `cap` |
| `03031` | Enraged | Upgrade | Pack Position: 31 | - | - | `cap` |
| `03032` | Followed | Upgrade | Pack Position: 32 | - | - | `cap` |
| `03033` | Expert Defense | Event | Pack Position: 33 | - | - | `cap` |
| `03034` | Enhanced Awareness | Upgrade | Pack Position: 34 | - | - | `cap` |

---

## Pack: Captain America (`cap`)

### Set: Captain America

### [03001a] Captain America
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 11, **Hand Size**: 5
- **Traits**: *Avenger. Soldier.*
- **Rules Text**:
  > "I Can Do This All Day!" — **Action**: Discard 1 card from your hand → ready Captain America. (Limit once per round.)
- **Flavor**: *"My duty to my country comes first, no matter the cost!"*
- **Image Asset**: `assets/card-art/bundles/cards/03001a.png` (300×419 px, 43.9 KB)
### [03001b] Steve Rogers
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 11, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > Living Legend — Reduce the cost of the first ally played each round by 1.
  > **Setup**: Search your deck and discard pile for the Captain America's Shield upgrade and add it to your hand. Shuffle your deck.
- **Image Asset**: `assets/card-art/bundles/cards/03001b.png` (300×419 px, 38.4 KB)
### [03002] Agent 13 — *Sharon Carter*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > **Response**: After Agent 13 enters play, remove 2 threat from a scheme.
- **Flavor**: *"Cap, you said we'd fight as a team! I want to come with you!"*
- **Image Asset**: `assets/card-art/bundles/cards/03002.png` (300×419 px, 39.1 KB)
### [03003] Fearless Determination
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (2–3/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Captain America gets +1 THW until the end of the phase. Draw 1 card.
- **Flavor**: *"No one dies on my watch." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/03003.png` (300×419 px, 41.3 KB)
### [03004] Heroic Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (4–6/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 6 damage to an enemy. If you paid for this card using a [physical] resource, stun that enemy.
- **Flavor**: *"No, you move." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/03004.png` (300×419 px, 42.9 KB)
### [03005] Shield Block
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (7–8/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Interrupt** *(defense)*: When you would take any amount of damage, exhaust Captain America's Shield → prevent all of that damage.
- **Flavor**: *"Is that all you've got?" —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/03005.png` (300×419 px, 36.3 KB)
### [03006] Shield Toss
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (9–10/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Discard X cards from your hand, then return Captain America's Shield from play to your hand → deal 4 damage to X enemies.
- **Flavor**: *"Sharon! Duck!" —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/03006.png` (300×419 px, 38.5 KB)
### [03007] Steve's Apartment
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Steve's Apartment → draw 1 card and heal 1 damage from Steve Rogers.
- **Flavor**: *Even Captain America needs a place to get away and rest.*
- **Image Asset**: `assets/card-art/bundles/cards/03007.png` (300×419 px, 43.3 KB)
### [03008] Captain America's Helmet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (12/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Armor.*
- **Rules Text**:
  > **Interrupt**: When Captain America would be defeated, set his hit point dial to 1 instead. Then, discard this card.
- **Flavor**: *"A soldier, even a super-soldier, is only as strong as his ideals." —Steve Rogers*
- **Image Asset**: `assets/card-art/bundles/cards/03008.png` (300×419 px, 43.7 KB)
### [03009] Captain America's Shield
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Item.*
- **Rules Text**:
  > Restricted. *(Max 2 restricted cards per player.)*
  > Captain America gets +1 DEF and gains retaliate 1.
- **Flavor**: *"This shield is a symbol of freedom." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/03009.png` (300×419 px, 35.7 KB)
### [03010] Super-Soldier Serum
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (14–15/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Item.*
- **Rules Text**:
  > **Resource**: Exhaust Super-Soldier Serum → generate a [physical] resource.
- **Flavor**: *"The serum gave Cap his super-strength. But his heart, his unrelenting determination — those were Steve's long before he picked up the shield." —Sharon Carter*
- **Image Asset**: `assets/card-art/bundles/cards/03010.png` (300×419 px, 36.6 KB)
### [03026] Man Out of Time
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Steve Rogers player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Steve Rogers → remove Man Out of Time from the game.
  > • Discard half of the cards in your hand, rounded down. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/03026.png` (300×419 px, 39.8 KB)

### Set: Leadership

### [03011] Falcon — *Sam Wilson*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Response**: After Falcon enters play, look at the top 3 cards of the encounter deck. For each treachery looked at this way, remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/03011.png` (300×419 px, 39.0 KB)
### [03012] Hawkeye — *Clint Barton*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Hawkeye enters play with 4 arrow counters on him.
  > **Response**: After a minion enters play, remove 1 arrow counter from Hawkeye → deal 2 damage to that minion.
### [03013] Squirrel Girl — *Doreen Green*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After Squirrel Girl enters play, deal 1 damage to each enemy.
- **Flavor**: *"Come on squirrels, let's get 'im!"*
- **Image Asset**: `assets/card-art/bundles/cards/03013.png` (300×419 px, 35.7 KB)
### [03014] Wonder Man — *Simon Williams*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 3 [star] (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Avenger.*
- **Rules Text**:
  > [star] As an additional cost for Wonder Man to attack, you must discard 1 card from your hand.
- **Flavor**: *"It's time for a reckoning!"*
- **Image Asset**: `assets/card-art/bundles/cards/03014.png` (300×419 px, 36.7 KB)
### [03015] Avengers Assemble!
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 4, **Resources**: [energy]
- **Rules Text**:
  > Max 1 per round.
  > **Hero Action**: Ready each [[Avenger]] character you control. Until the end of the phase, each [[Avenger]] character in play gets +1 THW and +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/03015.png` (300×419 px, 41.0 KB)
### [03016] Make the Call
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Pay the printed cost of an ally in any player's discard pile → put that ally into play under your control.
- **Flavor**: *"This is a code red! All hands on deck!" —Maria Hill*
### [03017] Strength In Numbers
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > **Action**: Exhaust any number of allies you control → draw 1 card for each ally exhausted this way.
- **Flavor**: *"Good thing I brought friends." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/03017.png` (300×419 px, 39.4 KB)
### [03018] The Power of Leadership
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Leadership *(blue)* card.
### [03019] Quinjet
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Avenger. Vehicle.*
- **Rules Text**:
  > **Response:** After your turn begins, place 1 time counter on Quinjet.
  > **Action:** Put an [[Avenger]] ally from your hand into play with printed cost equal to or less than the number of time counters on Quinjet. Then, discard Quinjet.
- **Image Asset**: `assets/card-art/bundles/cards/03019.png` (300×419 px, 36.8 KB)

### Set: Basic

### [03020] Mockingbird — *Bobbi Morse*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Response**: After Mockingbird enters play, stun an enemy.
### [03021] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [03022] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [03023] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [03024] Avengers Tower
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 24
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > If each of your allies has the [[Avenger]] trait, increase your ally limit by 1.
  > **Action:** Exhaust Avengers Tower → reduce the cost of the next [[Avenger]] ally played this phase by 1.
- **Image Asset**: `assets/card-art/bundles/cards/03024.png` (300×419 px, 31.0 KB)
### [03025] Honorary Avenger
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > Max 1 per character.
  > Attach to a friendly character.
  > Attached character gets +1 hit point and gains the [[Avenger]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/03025.png` (300×419 px, 38.6 KB)
### [03034] Enhanced Awareness
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Uses (3 mental counters).
  > **Hero Resource**: Exhaust Enhanced Awareness and remove 1 mental counter from it → generate a [mental] resource.
- **Image Asset**: `assets/card-art/bundles/cards/03034.png` (300×419 px, 35.4 KB)

### Set: Captain America Nemesis

### [03027] Hit Squad
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America Nemesis (1/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain America Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: In player order, each player discards the top card of the encounter deck and takes 1 damage for each boost icon discarded this way.
- **Flavor**: *Baron Zemo leads a Hydra taskforce into the city to hunt down Avengers.*
- **Image Asset**: `assets/card-art/bundles/cards/03027.png` (419×300 px, 38.4 KB)
### [03028] Baron Zemo
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain America Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Elite.*
- **Rules Text**:
  > Quickstrike.
  > While Baron Zemo is engaged with you, you cannot thwart.
  > *(Captain America's nemesis minion.)*
- **Flavor**: *"To avenge my father, Captain America must die."*
- **Image Asset**: `assets/card-art/bundles/cards/03028.png` (300×419 px, 40.7 KB)
### [03029] Hydra Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain America Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
  > **When Defeated**: Deal the engaged player an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/03029.png` (300×419 px, 39.6 KB)
### [03030] Hail Hydra!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Captain America Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Captain America Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[Hydra]] minion engaged with a hero attacks that hero. Each player who was not attacked this way searches the encounter deck and discard pile for a [[Hydra]] minion and puts it into play engaged with them. Shuffle the encounter deck if it was searched.
- **Image Asset**: `assets/card-art/bundles/cards/03030.png` (300×419 px, 47.3 KB)

### Set: Aggression

### [03031] Enraged
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to an ally. Max 1 per ally.
  > Attached ally gets +2 ATK and takes +1 consequential damage after it attacks.
- **Flavor**: *"Should I be worried about him?" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/03031.png` (300×419 px, 39.3 KB)

### Set: Justice

### [03032] Followed
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > Attach to a side scheme. Max 1 per scheme.
  > **Interrupt**: When attached scheme is defeated, deal 4 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/03032.png` (300×419 px, 43.2 KB)

### Set: Protection

### [03033] Expert Defense
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Captain America (`cap`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When your hero defends against an attack, it gets +3 DEF for that attack.
- **Flavor**: *"Do these guys ever run out of ammo!" —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/03033.png` (300×419 px, 34.2 KB)

