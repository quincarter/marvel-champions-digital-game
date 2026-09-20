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
| `25001a` | Valkyrie | Hero | Valkyrie | THW:1 ATK:2 DEF:1 HP:12 | - | `valk` |
| `25001b` | Brunnhilde | Alter-Ego | Valkyrie | HP:12 | - | `valk` |
| `25002` | Death-Glow | Upgrade | Valkyrie | - | - | `valk` |
| `25003` | Annabelle Riggs | Ally | Valkyrie | THW:1 ATK:1 HP:2 | - | `valk` |
| `25004` | Valhalla | Support | Valkyrie | - | - | `valk` |
| `25005` | Valkyrie's Spear | Upgrade | Valkyrie | - | - | `valk` |
| `25006` | Dragonfang | Upgrade | Valkyrie | - | - | `valk` |
| `25007` | Aragorn | Upgrade | Valkyrie | - | - | `valk` |
| `25008` | Flight of the Valkyrior | Upgrade | Valkyrie | - | - | `valk` |
| `25009` | Visit Valhalla | Event | Valkyrie | - | - | `valk` |
| `25010` | Chooser of the Slain | Event | Valkyrie | - | - | `valk` |
| `25011` | Shieldmaiden | Event | Valkyrie | - | - | `valk` |
| `25012` | Have at Thee! | Event | Valkyrie | - | - | `valk` |
| `25013` | Thor | Ally | Pack Position: 13 | THW:1 ATK:3 HP:3 | - | `valk` |
| `25014` | Throg | Ally | Pack Position: 14 | THW:1 ATK:2 HP:2 | - | `valk` |
| `25015` | Angela | Ally | Pack Position: 15 | THW:0 ATK:2 HP:3 | - | `valk` |
| `25016` | Hall of Heroes | Support | Pack Position: 16 | - | - | `valk` |
| `25017` | Combat Training | Upgrade | Pack Position: 17 | - | - | `valk` |
| `25018` | Quick Strike | Event | Pack Position: 18 | - | - | `valk` |
| `25019` | Smash the Problem | Event | Pack Position: 19 | - | - | `valk` |
| `25020` | The Best Defense… | Event | Pack Position: 20 | - | - | `valk` |
| `25021` | Audacity | Resource | Pack Position: 21 | - | - | `valk` |
| `25022` | The Power of Aggression | Resource | Pack Position: 22 | - | - | `valk` |
| `25023` | The Bifrost | Support | Pack Position: 23 | - | - | `valk` |
| `25024` | Godlike Stamina | Event | Pack Position: 24 | - | - | `valk` |
| `25025` | Energy | Resource | Pack Position: 25 | - | - | `valk` |
| `25026` | Genius | Resource | Pack Position: 26 | - | - | `valk` |
| `25027` | Strength | Resource | Pack Position: 27 | - | - | `valk` |
| `25028` | Trouble in Otherworld | Obligation | Valkyrie | - | 2 pips | `valk` |
| `25029` | Enchantress | Minion | Valkyrie Nemesis | SCH:2 ATK:1 HP:5 | 2 pips | `valk` |
| `25030` | Powerful Enchantments | Side Scheme | Valkyrie Nemesis | - | 2 pips | `valk` |
| `25031` | Beguiled | Attachment | Valkyrie Nemesis | - | 1 pips | `valk` |
| `25032` | Seduced | Attachment | Valkyrie Nemesis | - | 2 pips | `valk` |
| `25033` | Problem Solvers | Event | Pack Position: 33 | - | - | `valk` |
| `25034` | Leadership Training | Support | Pack Position: 34 | - | - | `valk` |
| `25035` | Anticipation | Upgrade | Pack Position: 35 | - | - | `valk` |
| `25036` | Cosmic Alliance | Event | Pack Position: 36 | - | - | `valk` |

---

## Pack: Valkyrie (`valk`)

### Set: Valkyrie

### [25001a] Valkyrie
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 1, **HP**: 12, **Hand Size**: 5
- **Traits**: *Asgard. Avenger.*
- **Rules Text**:
  > Death Perception — **Hero Action**: Play the set-aside Death-Glow upgrade as if it were in your hand.
- **Flavor**: *"I am the chooser of the slain."*
- **Image Asset**: `assets/card-art/bundles/cards/25001a.png` (300×418 px, 193.0 KB)
### [25001b] Brunnhilde
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 12, **Hand Size**: 6
- **Traits**: *Asgard.*
- **Rules Text**:
  > **Setup:** Set the Death Glow upgrade aside, out of play.
  > "Not this Day." — **Action**: Detach Death-Glow and set it aside, out of play.
- **Image Asset**: `assets/card-art/bundles/cards/25001b.png` (300×418 px, 213.5 KB)
### [25002] Death-Glow
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (1/16)
- **Stats**: **Cost**: 1
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to an enemy.
  > **Forced Interrupt**: When attached enemy is defeated, set this card aside, out of play. If Valkyrie defeated that enemy, ready her.
- **Image Asset**: `assets/card-art/bundles/cards/25002.png` (728×1043 px, 182.2 KB)
### [25003] Annabelle Riggs
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (2/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Civilian.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Annabelle Riggs → search the top 5 cards of your deck for a Valkyrie card and add it to your hand. Shuffle the rest back into your deck.
- **Flavor**: *"I've got friends on Earth who could use some help."*
- **Image Asset**: `assets/card-art/bundles/cards/25003.png` (730×1044 px, 184.5 KB)
### [25004] Valhalla
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (3/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Asgard. Location.*
- **Rules Text**:
  > **Response**: After Valkyrie attacks and defeats the enemy that has Death-Glow attached, exhaust Valhalla → draw 1 card and heal 1 damage from Valkyrie.
- **Image Asset**: `assets/card-art/bundles/cards/25004.png` (729×1050 px, 195.8 KB)
### [25005] Valkyrie's Spear
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (4/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Asgard. Weapon.*
- **Rules Text**:
  > Restricted.
  > Valkyrie gets +1 DEF (+2 DEF instead while defending against the enemy with Death Glow attached).
- **Image Asset**: `assets/card-art/bundles/cards/25005.png` (730×1044 px, 295.9 KB)
### [25006] Dragonfang
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (5/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Asgard. Weapon.*
- **Rules Text**:
  > Restricted.
  > Valkyrie gets +1 ATK (+2 ATK instead while attacking the enemy with Death-Glow attached).
- **Flavor**: *"Dragonfang strikes swiftly and deep. You might be wise to surrender." —Valkyrie*
- **Image Asset**: `assets/card-art/bundles/cards/25006.png` (729×1043 px, 184.0 KB)
### [25007] Aragorn
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (6/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Asgard. Creature.*
- **Rules Text**:
  > You get +4 hit points and gains the [[aerial]] trait.
- **Flavor**: *"A fearless beast. If by his life or death he can save us all, he will." —Valkyrie*
- **Image Asset**: `assets/card-art/bundles/cards/25007.png` (731×1044 px, 169.1 KB)
### [25008] Flight of the Valkyrior
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (7–8/16, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Rules Text**:
  > **Response**: After the enemy with Death-Glow is defeated, discard Flight of the Valkyrior → remove 5 threat from a scheme.
- **Flavor**: *The Valkyrior carry the spirits of fallen warriors to Valhalla, if they be worthy.*
- **Image Asset**: `assets/card-art/bundles/cards/25008.png` (729×1044 px, 195.5 KB)
### [25009] Visit Valhalla
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (9/16)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > **Alter-Ego Action**: Return a Valkyrie card from your discard pile to your hand.
- **Flavor**: *As One of the Valkyrior, Valkyrie can open a portal to Valhalla whenever she wishes.*
- **Image Asset**: `assets/card-art/bundles/cards/25009.png` (730×1045 px, 175.1 KB)
### [25010] Chooser of the Slain
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (10–11/16, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Hero Action**: Search the encounter deck and discard pile for a minion and put it into play engaged with you → draw 2 cards.
- **Flavor**: *"Your time has come. Die with honor." —Valkyrie*
- **Image Asset**: `assets/card-art/bundles/cards/25010.png` (729×1044 px, 202.3 KB)
### [25011] Shieldmaiden
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (12–13/16, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When the enemy with Death-Glow attached attacks, declare Valkyrie the defender without exhausting her. She gets +2 DEF for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/25011.png` (729×1044 px, 182.5 KB)
### [25012] Have at Thee!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (14–16/16, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action**(attack): Deal 7 damage to an enemy. If that enemy has Death-Glow attached, this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/25012.png` (727×1045 px, 199.6 KB)
### [25028] Trouble in Otherworld
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Valkyrie Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Brunnhilde player.***
  > Valkyrie cannot attack the enemy with Death-Glow attached.
  > **Alter-Ego Action**: Spend [energy][mental] resources → remove Trouble in Otherworld from the game.
- **Image Asset**: `assets/card-art/bundles/cards/25028.png` (728×1042 px, 190.7 KB)

### Set: Aggression

### [25013] Thor — *Odinson*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 3, **Resources**: [energy]
- **Traits**: *Asgard. Avenger.*
- **Rules Text**:
  > Toughness.
  > **Interrupt**: When Thor attacks a minion engaged with a player, spend a [energy] resource → resolve this attack against each minion engaged with that player (in the order of your choice).
- **Image Asset**: `assets/card-art/bundles/cards/25013.png` (718×1044 px, 176.0 KB)
### [25014] Throg — *Puddlegulp*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Asgard. Guardian.*
- **Rules Text**:
  > **Response**: After Throg enters play, give him a tough status card if you are engaged with a minion.
- **Flavor**: *"Ribbit!"*
- **Image Asset**: `assets/card-art/bundles/cards/25014.png` (729×1041 px, 169.9 KB)
### [25015] Angela — *Aldrif Odinsdottir*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 0 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Asgard. Guardian.*
- **Rules Text**:
  > **Forced Response**: After Angela enters play under your control, search the top 10 cards of the encounter deck for a minion and put it into play engaged with you. Shuffle the encounter deck. If a minion was not put into play this way, discard Angela.
### [25016] Hall of Heroes
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Asgard. Location.*
- **Rules Text**:
  > **Response:** After you defeat a minion, place 1 glory counter here.
  > **Alter-Ego Action:** Exhaust Hall of Heroes and remove 3 glory counters from it → draw 3 cards.
### [25017] Combat Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 ATK.
- **Flavor**: *"Tony! She did it again!" —Janet Van Dyne*
### [25018] Quick Strike
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal damage to an enemy equal to your ATK.
- **Flavor**: *"And stay down!" —Power Man*
- **Image Asset**: `assets/card-art/bundles/cards/25018.png` (728×1042 px, 176.4 KB)
### [25019] Smash the Problem
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Exhaust your hero → remove threat from a scheme equal to your hero's ATK.
- **Flavor**: *"Let Mjolnir speak!" —Thor*
- **Image Asset**: `assets/card-art/bundles/cards/25019.png` (727×1045 px, 165.7 KB)
### [25020] The Best Defense…
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When your hero defends against an attack, use its ATK instead of its DEF for this attack.
- **Flavor**: *"I know we're Guardians of the Galaxy, but we prefer shooting to being shot at." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/25020.png` (729×1043 px, 182.9 KB)
### [25021] Audacity
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [wild]
- **Traits**: *Skill.*
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, deal 1 damage to the villain.
### [25022] The Power of Aggression
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Aggression *(red)* card.

### Set: Basic

### [25023] The Bifrost
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Asgard. Location.*
- **Rules Text**:
  > Play only if your identity has the [[asgard]] trait.
  > **Action**: Exhaust The Bifrost → search your deck for an [[asgard]] ally and play it *(paying its cost)*. Shuffle your deck.
- **Image Asset**: `assets/card-art/bundles/cards/25023.png` (729×1044 px, 183.2 KB)
### [25024] Godlike Stamina
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > Play only if your identity has the [[asgard]] trait.
  > **Action**: Heal 2 damage from your identity. You may discard a status card from your identity.
- **Flavor**: *"Showoff." —Jane Foster*
- **Image Asset**: `assets/card-art/bundles/cards/25024.png` (727×1042 px, 179.4 KB)
### [25025] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [25026] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [25027] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [25036] Cosmic Alliance
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 36
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Rules Text**:
  > Alliance. *(The players can pay this card's costs as a group.)*
  > **Hero Action**: Choose an [[avenger]] character and a [[guardian]] character → ready each of those characters.
- **Image Asset**: `assets/card-art/bundles/cards/25036.png` (728×1045 px, 176.8 KB)

### Set: Valkyrie Nemesis

### [25029] Enchantress
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Valkyrie Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Elite.*
- **Rules Text**:
  > **When Revealed**: Search the encounter deck, discard pile, and set-aside area for a copy of Seduced and attach it to your identity. *(Shuffle.)*
- **Flavor**: *"You can't fight what you want."*
- **Image Asset**: `assets/card-art/bundles/cards/25029.png` (729×1045 px, 178.6 KB)
### [25030] Powerful Enchantments
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Valkyrie Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 1[per_hero].
  > Players cannot discard attachments that are attached to friendly characters.
- **Flavor**: *Behind Amora's charm lies a cruel ambition and the power to subdue those in her way.*
- **Image Asset**: `assets/card-art/bundles/cards/25030.png` (1049×725 px, 179.3 KB)
### [25031] Beguiled
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Valkyrie Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Treat attached ally as an [[enthralled]] minion with a blank text box.
  > Attached minion's SCH is equal to its printed THW and it does not take consequential damage.
  > **When Revealed**: Attach to the ally with the highest cost without Beguiled attached. Attached ally engages its controller. Otherwise, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/25031.png` (729×1042 px, 194.1 KB)
### [25032] Seduced
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Valkyrie Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Valkyrie Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity.
  > You cannot make basic attacks or play [[attack]] events.
  > **Alter-Ego Action**: Spend [energy][mental] resources → discard this card.
- **Flavor**: *"You love me, don't you?" —Enchantress*
- **Image Asset**: `assets/card-art/bundles/cards/25032.png` (727×1042 px, 184.7 KB)

### Set: Justice

### [25033] Problem Solvers
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 4, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Alliance.
  > **Hero Action** *(thwart)*: Exhaust an [[avenger]] character and a [[guardian]] character → remove X threat from each scheme, where X is equal to the combined THW of those characters.
- **Image Asset**: `assets/card-art/bundles/cards/25033.png` (728×1045 px, 192.4 KB)

### Set: Leadership

### [25034] Leadership Training
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Max 2 per deck. Uses (2 training counters).
  > **Alter-ego Action**: Exhaust this card and remove 1 training counter from it → choose a leadership (blue) event in you discard pile and shuffle it into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/25034.png` (728×1045 px, 195.1 KB)

### Set: Protection

### [25035] Anticipation
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Valkyrie (`valk`)
- **Deck / Set**: Pack Position: 35
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Preparation.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Interrupt**: When you engage a minion, discard this card → ready your hero.
- **Flavor**: *"Bout time you showed up!" —Hawkeye*
- **Image Asset**: `assets/card-art/bundles/cards/25035.png` (728×1045 px, 192.1 KB)

