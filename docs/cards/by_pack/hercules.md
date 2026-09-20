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
| `59001a` | Hercules | Hero | Hercules | THW:1 ATK:3 DEF:2 HP:14 | - | `hercules` |
| `59001b` | Hercules | Alter-Ego | Hercules | HP:14 | - | `hercules` |
| `59002` | Defeat the Hydra | Attachment | Labor Deck | - | - | `hercules` |
| `59003` | Embody Pathos | Attachment | Labor Deck | - | - | `hercules` |
| `59004` | Protect Humanity | Obligation | Labor Deck | - | - | `hercules` |
| `59005` | Nemean Lion Skin | Upgrade | Gift Deck | - | - | `hercules` |
| `59006` | Shield of Perseus | Upgrade | Gift Deck | - | - | `hercules` |
| `59007` | Sword of Peleus | Upgrade | Gift Deck | - | - | `hercules` |
| `59008` | Amadeus Cho | Ally | Hercules | THW:1 ATK:1 HP:2 | - | `hercules` |
| `59009` | The Gift of Battle | Event | Hercules | - | - | `hercules` |
| `59010` | Son of Zeus | Event | Hercules | - | - | `hercules` |
| `59011` | Wisdom of Athena | Event | Hercules | - | - | `hercules` |
| `59012` | Olympus | Support | Hercules | - | - | `hercules` |
| `59013` | Gauntlets of Hercules | Upgrade | Hercules | - | - | `hercules` |
| `59014` | Golden Mace | Upgrade | Hercules | - | - | `hercules` |
| `59015` | Herc's Helm | Upgrade | Hercules | - | - | `hercules` |
| `59016` | Lion of Olympus | Upgrade | Hercules | - | - | `hercules` |
| `59017` | Prince of Power | Upgrade | Hercules | - | - | `hercules` |
| `59018` | Deathcry | Ally | Pack Position: 18 | THW:1 ATK:3 HP:4 | - | `hercules` |
| `59019` | Namora | Ally | Pack Position: 19 | THW:2 ATK:2 HP:4 | - | `hercules` |
| `59020` | Thor | Ally | Pack Position: 20 | THW:3 ATK:3 HP:4 | - | `hercules` |
| `59021` | Teamwork | Event | Pack Position: 21 | - | - | `hercules` |
| `59022` | Call for Backup | Player Side Scheme | Pack Position: 22 | - | - | `hercules` |
| `59023` | Recruitment Drive | Support | Pack Position: 23 | - | - | `hercules` |
| `59024` | "Avenge Me!" | Upgrade | Pack Position: 24 | - | - | `hercules` |
| `59025` | Gilgamesh | Ally | Pack Position: 25 | THW:2 ATK:3 HP:6 | - | `hercules` |
| `59026` | Ancient Rivalry | Event | Pack Position: 26 | - | - | `hercules` |
| `59027` | Limitless Stamina | Event | Pack Position: 27 | - | - | `hercules` |
| `59028` | Evaluate Threat | Player Side Scheme | Pack Position: 28 | - | - | `hercules` |
| `59029` | Energy | Resource | Pack Position: 29 | - | - | `hercules` |
| `59030` | Genius | Resource | Pack Position: 30 | - | - | `hercules` |
| `59031` | Strength | Resource | Pack Position: 31 | - | - | `hercules` |
| `59032` | Avengers Compound | Support | Pack Position: 32 | - | - | `hercules` |
| `59033` | Helicarrier | Support | Pack Position: 33 | - | - | `hercules` |
| `59034` | Quincarrier | Support | Pack Position: 34 | - | - | `hercules` |
| `59035` | Appeal to Athena | Obligation | Hercules | - | 2 pips | `hercules` |
| `59036` | Ares | Minion | Hercules Nemesis | SCH:0 ATK:3 HP:5 | 2 pips | `hercules` |
| `59037` | Lernean Hydra | Minion | Hercules Nemesis | SCH:0 ATK:2 HP:6 | 1 pips | `hercules` |
| `59038` | Olympic Feud | Side Scheme | Hercules Nemesis | - | 3 pips | `hercules` |
| `59039` | Ares's Axe | Attachment | Hercules Nemesis | ATK:2 | 2 pips | `hercules` |
| `59040` | God of War | Treachery | Hercules Nemesis | - | 3 pips | `hercules` |
| `59041` | All Versus All | Side Scheme | All Versus All | - | 2 pips | `hercules` |
| `59042` | Hecate | Minion | All Versus All | SCH:2 ATK:0 HP:4 | 2 pips | `hercules` |
| `59043` | Kyknos | Minion | All Versus All | SCH:0 ATK:3 HP:7 | 3 pips | `hercules` |
| `59044` | Bewitched Officer | Minion | All Versus All | SCH:1 ATK:3 HP:5 | 2 pips | `hercules` |
| `59045` | Roving Mobs | Side Scheme | All Versus All | - | 2 pips | `hercules` |

---

## Pack: Hercules (`hercules`)

### Set: Hercules

### [59001a] Hercules
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 3, **DEF**: 2, **HP**: 14, **Hand Size**: 4
- **Traits**: *Avenger. Olympus.*
- **Rules Text**:
  > *Atonement* — **Response**: After a [[labor]] card is added to the victory display, put the top card of the [[gift]] deck into play. Ready Hercules. You may flip to alter-ego form. (Limit once per phase.)
- **Image Asset**: `assets/card-art/bundles/cards/59001a.png` (300×425 px, 243.9 KB)
### [59001b] Hercules
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 14, **Hand Size**: 6
- **Traits**: *Olympus.*
- **Rules Text**:
  > Hercules begins the game with a [[labor]] deck and a [[gift]] deck. *(See insert.)*
  > *New Labors of Hercules* — **Action**: If there is no [[labor]] card in play, reveal the top card of the [[labor]] deck.
- **Image Asset**: `assets/card-art/bundles/cards/59001b.png` (300×425 px, 238.3 KB)
### [59008] Amadeus Cho
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Genius.*
- **Rules Text**:
  > **Forced Interrupt**: When a minion would attack you, it attacks Amadeus Cho instead.
  > **Action**: Exhaust Amadeus Cho → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/59008.jpg` (710×1030 px, 326.8 KB)
### [59009] The Gift of Battle
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (2–4/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > Reduce the cost to play this card by 1 for each [[Gift]] card you control.
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy.
- **Flavor**: *"As Hercules has said countless times: have at thee!" —Hercules*
- **Image Asset**: `assets/card-art/bundles/cards/59009.png` (710×1030 px, 346.2 KB)
### [59010] Son of Zeus
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (5–6/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Olympus.*
- **Rules Text**:
  > **Hero Action**: Ready Hercules. If you control at least:
  > • 1 [[Gift]] card, ready an identity-specific upgrade you control.
  > • 2 [[Gift]] cards, gain a tough status card.
  > • 3 [[Gift]] cards, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/59010.jpg` (710×1030 px, 349.0 KB)
### [59011] Wisdom of Athena
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (7–8/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Reduce the cost to play this card by 1 for each [[Gift]] card you control.
  > **Hero Action** *(thwart)*: Remove 4 threat from a scheme.
- **Flavor**: *"Zounds! Is that you, oh sister of mine?" —Hercules*
- **Image Asset**: `assets/card-art/bundles/cards/59011.png` (710×1030 px, 331.2 KB)
### [59012] Olympus
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Location. Olympus.*
- **Rules Text**:
  > **Resource**: Exhaust Olympus → generate a [wild] resource for each [[Gift]] card you control.
- **Flavor**: *Although Olympus's influence may have waned since the Hellenistic period, the celebrating has not.*
- **Image Asset**: `assets/card-art/bundles/cards/59012.png` (710×1030 px, 372.0 KB)
### [59013] Gauntlets of Hercules
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Armor. Olympus.*
- **Rules Text**:
  > **Hero Interrupt**: When Hercules defends against an attack, exhaust Gauntlets of Hercules → Hercules gains retaliate 1 for that attack for each [[Gift]] card you control.
- **Image Asset**: `assets/card-art/bundles/cards/59013.jpg` (710×1030 px, 348.4 KB)
### [59014] Golden Mace
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Olympus. Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Interrupt**: When Hercules makes a basic attack, exhaust Golden Mace → Hercules gets +1 ATK for this attack for each [[Gift]] card you control. This attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/59014.png` (710×1030 px, 334.8 KB)
### [59015] Herc's Helm
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (12/15)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Armor. Olympus.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When the villain attacks, exhaust Herc's Helm → reduce the amount of damage this attack deals by 1.
- **Image Asset**: `assets/card-art/bundles/cards/59015.jpg` (710×1030 px, 325.3 KB)
### [59016] Lion of Olympus
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (13–14/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Olympus.*
- **Rules Text**:
  > Temporary. *(Discard this card at the end of the round.)*
  > Your hero gets +1 THW, +1 ATK, and +1 DEF.
- **Flavor**: *Like the mighty lions native to ancient Greece, the ferocity of Hercules is incredible.*
- **Image Asset**: `assets/card-art/bundles/cards/59016.jpg` (710×1030 px, 341.3 KB)
### [59017] Prince of Power
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Olympus. Title.*
- **Rules Text**:
  > **Hero Response**: After Hercules attacks and defeats an enemy, exhaust Prince of Power → heal 1 damage from Hercules for each point of excess damage dealt to that enemy by that attack.
- **Image Asset**: `assets/card-art/bundles/cards/59017.png` (710×1030 px, 368.5 KB)
### [59035] Appeal to Athena
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hercules Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Hercules player.***
  > When counting [[Gift]] cards you control, you are considered to control none.
  > **Alter-Ego Action**: Exhaust Hercules or spend [mental] [mental] → remove this obligation from the game.
- **Image Asset**: `assets/card-art/bundles/cards/59035.png` (710×1030 px, 352.1 KB)

### Set: Labor Deck

### [59002] Defeat the Hydra
- **Type**: `Attachment`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Labor Deck (1/3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Labor Deck Set Icon (printed bottom-right next to deck number)
- **Traits**: *Labor.*
- **Rules Text**:
  > Victory 0.
  > Attached minion gets +6 hit points and gains the [[Elite]] trait. Attached minion cannot take damage except from Hercules's attacks.
  > **When Revealed**: Find a non-[[Elite]] minion with at least 6 printed hit points. Reveal it, heal all damage from it, and attach this card to it.
- **Image Asset**: `assets/card-art/bundles/cards/59002.jpg` (710×1030 px, 326.7 KB)
### [59003] Embody Pathos
- **Type**: `Attachment`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Labor Deck (2/3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Labor Deck Set Icon (printed bottom-right next to deck number)
- **Traits**: *Labor.*
- **Rules Text**:
  > Victory 0.
  > Attached side scheme gains assault. Threat cannot be removed from attached scheme except by Hercules's thwarts.
  > **When Revealed**: Find an encounter side scheme that is not in play and reveal it, treating each [per_hero] on it as 1, and attach this card to it. Place 6 additional threat on it.
- **Image Asset**: `assets/card-art/bundles/cards/59003.png` (710×1030 px, 341.3 KB)
### [59004] Protect Humanity
- **Type**: `Obligation`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Labor Deck (3/3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Labor Deck Set Icon (printed bottom-right next to deck number)
- **Traits**: *Labor.*
- **Rules Text**:
  > Uses (3 labor counters). Victory 0.
  > **When Revealed**: Find Amadeus Cho and put him into play.
  > **Forced Interrupt**: When the villain would attack Hercules, choose 1 of your allies. The villain attacks that ally instead. After that attack resolves, if Hercules defended, remove 1 labor counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/59004.jpg` (710×1030 px, 369.3 KB)

### Set: Gift Deck

### [59005] Nemean Lion Skin
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Gift Deck (1/3)
- **Properties**: Unique, Permanent
- **Traits**: *Artifact. Gift.*
- **Rules Text**:
  > Permanent.
  > Hercules gets +2 hit points and gains steady.
  > **Response**: After this card enters play, draw 4 cards.
- **Image Asset**: `assets/card-art/bundles/cards/59005.png` (710×1030 px, 353.6 KB)
### [59006] Shield of Perseus
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Gift Deck (2/3)
- **Properties**: Unique, Permanent
- **Traits**: *Artifact. Gift.*
- **Rules Text**:
  > Permanent.
  > Hercules gets +1 hit point and gains retaliate 1.
  > **Response**: After this card enters play, draw 4 cards.
- **Image Asset**: `assets/card-art/bundles/cards/59006.png` (710×1030 px, 343.6 KB)
### [59007] Sword of Peleus
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Gift Deck (3/3)
- **Properties**: Unique, Permanent
- **Traits**: *Artifact. Gift. Weapon.*
- **Rules Text**:
  > Permanent. Restricted.
  > Hercules gets +1 hit point and his basic attacks gain piercing.
  > **Response**: After this card enters play, draw 4 cards.
- **Image Asset**: `assets/card-art/bundles/cards/59007.jpg` (710×1030 px, 343.3 KB)

### Set: Leadership

### [59018] Deathcry — *Sharra Neramani*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 3 [star] (Consequential: 2), **HP**: 4, **Resources**: [physical]
- **Traits**: *Avenger.*
- **Rules Text**:
  > [star] **Hero Interrupt**: When Deathcry makes a basic attack, deal your hero 1 damage → Deathcry takes -1 consequential damage ([cost]) for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/59018.png` (710×1030 px, 346.1 KB)
### [59019] Namora — *Aquaria Neptunia*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 1), **HP**: 4 [star], **Resources**: [physical]
- **Traits**: *Agent of Atlas. Atlantis.*
- **Rules Text**:
  > [star] Namora gets +1 hit point for each other ally you control.
- **Flavor**: *"I've heard she can beat Captain Marvel in an arm wrestling contest." —Gorilla-Man*
- **Image Asset**: `assets/card-art/bundles/cards/59019.jpg` (710×1030 px, 325.4 KB)
### [59020] Thor — *Odinson*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 3 [star] (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 4, **Resources**: [energy]
- **Traits**: *Asgard. Avenger.*
- **Rules Text**:
  > [star] **Forced Response**: After Thor makes a basic thwart, discard cards from the top of the encounter deck until you discard a minion. Put that minion into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/59020.jpg` (710×1030 px, 262.8 KB)
### [59021] Teamwork
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Interrupt** When you use your basic thwart power *(THW)* or basic attack power *(ATK)*, exhaust an ally you control → add that ally's matching power to your hero's power for this use.
### [59022] Call for Backup
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Leadership
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 3 per hero, **Resources**: [mental]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for an ally and put it into play. *(Shuffle.)*
- **Flavor**: *"I already regret this." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/59022.png` (1030×710 px, 265.2 KB)
### [59023] Recruitment Drive
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Rules Text**:
  > Alter-ego form only.
  > **Action**: Discard Recruitment Drive and choose a player → reduce the resource cost of the next ally that player plays this phase to 0.
- **Image Asset**: `assets/card-art/bundles/cards/59023.jpg` (710×1030 px, 294.3 KB)
### [59024] "Avenge Me!"
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > Attach to an ally. Max 1 per ally.
  > **Interrupt**: When attached ally is defeated, draw 2 cards.
- **Image Asset**: `assets/card-art/bundles/cards/59024.png` (710×1030 px, 271.8 KB)

### Set: Basic

### [59025] Gilgamesh
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 25
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 3 (Consequential: 2), **HP**: 6, **Resources**: [physical]
- **Traits**: *Eternal.*
- **Rules Text**:
  > As an additional cost to play this card, if you do not have the [[Eternal]] trait, confuse your identity.
- **Flavor**: *Having lived for around a million years, even Gilgamesh had once forgotten who he was.*
- **Image Asset**: `assets/card-art/bundles/cards/59025.jpg` (710×1030 px, 338.8 KB)
### [59026] Ancient Rivalry
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Asgard. Olympus.*
- **Rules Text**:
  > Team-Up (Hercules and Thor). Max 1 per deck.
  > **Hero Action**: Search your discard pile for an identity-specific upgrade and add it to your hand. Ready Hercules and Thor.
- **Image Asset**: `assets/card-art/bundles/cards/59026.jpg` (710×1030 px, 349.0 KB)
### [59027] Limitless Stamina
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Play only if your identity has at least 14 printed hit points.
  > **Hero Action**: Ready your hero.
- **Flavor**: *"What, you think this fight is almost over?! That was just warm-up practice." —Thor*
### [59028] Evaluate Threat
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 28
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 2 per hero, **Resources**: [mental]
- **Rules Text**:
  > Victory 0.
  > Play only if your identity has the [[Avenger]] or [[S.H.I.E.L.D.]] trait.
  > **When Defeated**: Each player may search their deck and discard pile for an [[Avenger]] or [[S.H.I.E.L.D.]] card and add it to their hand. *(Shuffle.)* Reduce the cost to play each of those cards by 2 until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/59028.png` (1030×710 px, 307.9 KB)
### [59029] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [59030] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [59031] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [59032] Avengers Compound
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait. Max 1 per deck.
  > **Action**: Exhaust Avengers Compound → choose: tuck 1 ally from your hand here if there is no ally tucked here, or play the ally tucked here as if it were in your hand.
### [59033] Helicarrier
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Helicarrier → choose a player. Reduce the resource cost of the next card that player plays this phase by 1.
- **Flavor**: *"A flying aircraft carrier? You're kidding, right?" —Jennifer Walters*
### [59034] Quincarrier
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Pack Position: 34
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Avenger. Vehicle.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > **Resource**: Exhaust Quincarrier → generate a [wild] resource.
- **Flavor**: *"Too bad we could only get one of these." —Hawkeye*

### Set: Hercules Nemesis

### [59036] Ares
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 0 [star], **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hercules Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Olympus.*
- **Rules Text**:
  > Retaliate 1.
  > [star] **Forced Response**: After Ares schemes, deal yourself 1 facedown encounter card.
  > *(Hercules's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/59036.png` (710×1030 px, 310.0 KB)
### [59037] Lernean Hydra
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hercules Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature. Hydra.*
- **Rules Text**:
  > **Forced Response**: After a character you control attacks and damages Lernean Hydra, choose:
  > • Spend a [physical] resource.
  > • Lernean Hydra heals 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/59037.jpg` (710×1030 px, 319.5 KB)
### [59038] Olympic Feud
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules Nemesis (3/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hercules Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place 1 additional threat here for each [[Olympus]] card in play.
- **Flavor**: *Hercules has twice thwarted attempts to overthrow Olympus orchestrated by his uncle Pluto and half-brother Ares.*
- **Image Asset**: `assets/card-art/bundles/cards/59038.jpg` (1030×710 px, 319.9 KB)
### [59039] Ares's Axe
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules Nemesis (4/5)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hercules Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Ares. Otherwise, attach to the villain.
  > [star] **Forced Response**: After attached enemy attacks, if no friendly character took damage from this attack, discard this card.
- **Flavor**: *From kukri to Shi'ar sniper rifles, Ares wields every weapon with equal malice toward all.*
- **Image Asset**: `assets/card-art/bundles/cards/59039.png` (710×1030 px, 259.5 KB)
### [59040] God of War
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: Hercules Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hercules Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each minion attacks the player it is engaged with *(even if that player is in alter-ego form)*. If no minion activates this way, discard cards from the top of the encounter deck until a minion is discarded and reveal that minion.
- **Image Asset**: `assets/card-art/bundles/cards/59040.jpg` (710×1030 px, 258.3 KB)

### Set: All Versus All

### [59041] All Versus All
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: All Versus All (1/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: All Versus All Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 2[per_hero].
  > **Forced Response**: After a character is defeated, place 2 threat on this scheme.
  > **When Defeated**: Set All Versus All aside.
- **Image Asset**: `assets/card-art/bundles/cards/59041.png` (1030×710 px, 267.5 KB)
### [59042] Hecate
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: All Versus All (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 0 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: All Versus All Set Icon (printed bottom-right next to deck number)
- **Traits**: *Olympus.*
- **Rules Text**:
  > **When Revealed/Defeated**: Find the All Versus All side scheme and reveal it.
  > [star] **Forced Response**: After Hecate activates, place 2 threat on the All Versus All side scheme.
- **Flavor**: *"Those who once adored you have turned on you."*
- **Image Asset**: `assets/card-art/bundles/cards/59042.png` (710×1030 px, 287.9 KB)
### [59043] Kyknos
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: All Versus All (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 0 [star], **ATK**: 3 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: All Versus All Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Olympus.*
- **Rules Text**:
  > Retaliate 1. Toughness. Victory 0.
  > [star] **Forced Response**: After Kyknos activates, place 2 threat on the All Versus All side scheme. Otherwise, place 1 threat on the main scheme.
- **Flavor**: *"The penalty of death shall be meted out by Kyknos, the son of Ares."*
- **Image Asset**: `assets/card-art/bundles/cards/59043.jpg` (710×1030 px, 333.2 KB)
### [59044] Bewitched Officer
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: All Versus All (4/5)
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: All Versus All Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Dragon. Enthralled.*
- **Rules Text**:
  > Retaliate 1.
  > [star] Bewitched Officer's attacks gain piercing and ranged.
- **Flavor**: *"Hey, pull over!"*
- **Image Asset**: `assets/card-art/bundles/cards/59044.png` (710×1030 px, 319.3 KB)
### [59045] Roving Mobs
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Hercules (`hercules`)
- **Deck / Set**: All Versus All (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: All Versus All Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Find the All Versus All side scheme and reveal it.
- **Flavor**: *Nowhere is safe under the wargospel of All Versus All.*
- **Image Asset**: `assets/card-art/bundles/cards/59045.jpg` (1030×710 px, 323.0 KB)

