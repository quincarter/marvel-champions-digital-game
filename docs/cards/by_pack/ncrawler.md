# Marvel Champions Card Reference Database

A complete, generated transcription of the cached MarvelCDB card records in `packages/content/raw/marvelcdb/`, formatted for AI and rules-engine consumption. Regenerate with `scripts/generate_cards_markdown.py`; do not hand-edit.

**This document is not authoritative.** MarvelCDB is a community database. The authorities on how a card behaves are the Rules Reference Guide (`mc_rulesreference_v18_compressed.pdf`), FFG's rulings and errata (`marvel-champions-rulings-post-rrg-1-7.md`), and the structured card data in `@mc/content`. Where this file and any of those disagree, they win and this file is wrong. Use it to read printed text quickly, not to settle a rules question.

Fields absent from the source are reported as "not recorded in this source" rather than guessed at, so a missing value is never silently rendered as a zero.

## Rules & Symbol Legend

### 1. Bottom-Right Encounter Logos
- **Boost Icons (Pips)**: In the lower-right corner of Villain, Minion, Treachery, and Attachment cards, there are triangular boost icons (0 to 4). When the card is flipped face-down as a Boost Card during a Villain attack or scheme activation, each boost icon adds +1 to the Villain's ATK or SCH.
- **Boost Star (`[star]`)**: An icon in the boost area indicating that drawing this card triggers a special **Boost** ability, printed inline in that card's own rules text. A star is not itself a boost icon (RRG 1.8, "Boost"), so a starred card can also carry 0 or more pips.
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
- **HP**: Hit Points (health pool; may be fixed, *per hero*, or *per group*).
- **`[star]`**: Asterisk/Star indicating a dynamic or variable stat governed by card text.
- **`[mental]` / `[physical]` / `[energy]` / `[wild]`**: Resource icons used to pay card costs.
- **Consequential**: the damage or threat a hero takes for using that stat on an ally.

## Quick Index

| Code | Name | Type | Deck / Set | Stats | Boost | Pack |
|---|---|---|---|---|---|---|
| `48001a` | Nightcrawler | Hero | Nightcrawler | THW:2 ATK:1 DEF:3 HP:9 | - | `ncrawler` |
| `48001b` | Kurt Wagner | Alter-Ego | Nightcrawler | REC:3 HP:9 | - | `ncrawler` |
| `48002` | Daytripper | Ally | Nightcrawler | THW:2 ATK:2 HP:2 | - | `ncrawler` |
| `48003` | Kurt's Chapel | Support | Nightcrawler | - | - | `ncrawler` |
| `48004` | Kurt's Cutlasses | Upgrade | Nightcrawler | - | - | `ncrawler` |
| `48005` | Prehensile Tail | Upgrade | Nightcrawler | - | - | `ncrawler` |
| `48006` | Bamf! | Upgrade | Nightcrawler | - | - | `ncrawler` |
| `48007` | 'Port and Punch | Event | Nightcrawler | - | - | `ncrawler` |
| `48008` | Teleport Drop | Event | Nightcrawler | - | - | `ncrawler` |
| `48009` | Scout Ahead | Event | Nightcrawler | - | - | `ncrawler` |
| `48010` | 'Port Away | Event | Nightcrawler | - | - | `ncrawler` |
| `48011` | Tally Ho! | Event | Nightcrawler | - | - | `ncrawler` |
| `48012` | Rogue | Ally | Pack Position: 12 | THW:2 ATK:2 HP:3 | - | `ncrawler` |
| `48013` | Northstar | Ally | Pack Position: 13 | THW:1 ATK:2 HP:3 | - | `ncrawler` |
| `48014` | Change of Fortune | Upgrade | Pack Position: 14 | - | - | `ncrawler` |
| `48015` | Under Control | Upgrade | Pack Position: 15 | - | - | `ncrawler` |
| `48016` | "Come Get Me, Bub!" | Event | Pack Position: 16 | - | - | `ncrawler` |
| `48017` | Powerful Punch | Event | Pack Position: 17 | - | - | `ncrawler` |
| `48018` | Riposte | Event | Pack Position: 18 | - | - | `ncrawler` |
| `48019` | The Power of Protection | Resource | Pack Position: 19 | - | - | `ncrawler` |
| `48020` | Astonishing X-Men | Player Side Scheme | Pack Position: 20 | - | - | `ncrawler` |
| `48021` | Gambit | Ally | Pack Position: 21 | THW:-1 ATK:-1 HP:3 | - | `ncrawler` |
| `48022` | Moira MacTaggert | Support | Pack Position: 22 | - | - | `ncrawler` |
| `48023` | Energy | Resource | Pack Position: 23 | - | - | `ncrawler` |
| `48024` | Genius | Resource | Pack Position: 24 | - | - | `ncrawler` |
| `48025` | Strength | Resource | Pack Position: 25 | - | - | `ncrawler` |
| `48026` | Crisis of Faith | Obligation | Nightcrawler | - | 2 icons | `ncrawler` |
| `48027` | Azazel | Minion | Nightcrawler Nemesis | SCH:2 ATK:3 HP:3 | 0 icons + star | `ncrawler` |
| `48028` | Brimstone Dimension | Side Scheme | Nightcrawler Nemesis | - | 3 icons | `ncrawler` |
| `48029` | Azazel's Sword | Attachment | Nightcrawler Nemesis | ATK:1 | 2 icons | `ncrawler` |
| `48030` | Brimstone Strike | Treachery | Nightcrawler Nemesis | - | 1 icon | `ncrawler` |
| `48031` | Combine Forces | Event | Pack Position: 31 | - | - | `ncrawler` |
| `48032` | Gunboat Diplomacy | Event | Pack Position: 32 | - | - | `ncrawler` |
| `48033` | The Crazy Gang | Side Scheme | Crazy Gang | - | 2 icons | `ncrawler` |
| `48034` | Queen of Hearts | Minion | Crazy Gang | SCH:0 ATK:1 HP:4 | 3 icons | `ncrawler` |
| `48035` | Jester | Minion | Crazy Gang | SCH:0 ATK:1 HP:5 | 1 icon | `ncrawler` |
| `48036` | Executioner | Minion | Crazy Gang | SCH:0 ATK:2 HP:4 | 2 icons | `ncrawler` |
| `48037` | Tweedledope | Minion | Crazy Gang | SCH:0 ATK:2 HP:6 | 1 icon | `ncrawler` |
| `48038` | "Off with His Head!" | Treachery | Crazy Gang | - | 1 icon | `ncrawler` |

---

## Pack: Nightcrawler (`ncrawler`)

### Set: Nightcrawler

### [48001a] Nightcrawler
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1, **DEF**: 3, **HP**: 9, **Hand Size**: 5
- **Traits**: *X-Men.*
- **Rules Text**:
  > *Rapid Teleportation* — **Action**: Spend 1 resource of any type → return a copy of Bamf! from your discard pile to your hand. (Limit once per phase.)
- **Flavor**: *"Verzeihung! Mind if I cut in?"*
- **Image Asset**: `assets/card-art/bundles/cards/48001a.png` (300×426 px, 252.5 KB)

### [48001b] Kurt Wagner
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > **Action**: Search your deck for a copy of Bamf! and add it to your hand. (Limit once per round.)
- **Flavor**: *"Even in dark times, there is beauty and peace to be found."*
- **Image Asset**: `assets/card-art/bundles/cards/48001b.png` (300×426 px, 251.8 KB)

### [48002] Daytripper — *Amanda Sefton*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Mystic.*
- **Rules Text**:
  > **Response**: After Daytripper enters play, search your deck and discard pile for a copy of Bamf! and attach it to an enemy. Deal 1 damage to each enemy with a copy of Bamf! attached.
- **Image Asset**: `assets/card-art/bundles/cards/48002.jpg` (710×1030 px, 297.3 KB)

### [48003] Kurt's Chapel
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Kurt Wagner gets +1 REC.
  > **Alter-Ego Response**: After you make a basic recovery, exhaust Kurt's Chapel and choose a player → that player draws 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/48003.png` (710×1030 px, 290.0 KB)

### [48004] Kurt's Cutlasses
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Counts as 2 restricted cards.
  > Nightcrawler gets +1 ATK, +1 DEF, and gains retaliate 1.
- **Flavor**: *"I've got two swords: one for each of you!"*
- **Image Asset**: `assets/card-art/bundles/cards/48004.jpg` (710×1030 px, 284.4 KB)

### [48005] Prehensile Tail
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (4/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > You can control 1 additional upgrade that has the restricted keyword.
  > **Resource**: Exhaust Prehensile Tail → generate a [wild] resource for an event.
- **Flavor**: *Nightcrawler's tail allows him to perform attacks others cannot.*
- **Image Asset**: `assets/card-art/bundles/cards/48005.png` (710×1030 px, 318.0 KB)

### [48006] Bamf!
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (5–7/15, Qty: 3)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > Attach to an enemy. Max 1 per enemy.
  > **Hero Interrupt** *(defense)*: When attached enemy attacks, discard this card → declare Nightcrawler as the defender without exhausting him.
- **Image Asset**: `assets/card-art/bundles/cards/48006.png` (710×1030 px, 292.3 KB)

### [48007] 'Port and Punch
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (8–9/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. Deal 3 damage to each enemy with Bamf! attached.
- **Flavor**: *Nightcrawler can engage several enemies at once by teleporting as fast as he can strike.*
- **Image Asset**: `assets/card-art/bundles/cards/48007.jpg` (710×1030 px, 316.0 KB)

### [48008] Teleport Drop
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (10/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Discard a copy of Bamf! from an enemy → deal 8 damage to that enemy and stun it.
- **Flavor**: *"When you look like a demon, it can be tempting to play the part." —Nightcrawler*
- **Image Asset**: `assets/card-art/bundles/cards/48008.jpg` (710×1030 px, 302.7 KB)

### [48009] Scout Ahead
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (11–12/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. You may discard a copy of Bamf! from your hand to remove 3 threat from another scheme.
- **Flavor**: *"One moment, liebchen — let me make sure it's safe." —Nightcrawler*
- **Image Asset**: `assets/card-art/bundles/cards/48009.png` (710×1030 px, 288.5 KB)

### [48010] 'Port Away
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (13/15)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Action**: Discard a copy of Bamf! from your hand → change forms and ready your identity.
- **Flavor**: *"I'll be back!" —Nightcrawler*
- **Image Asset**: `assets/card-art/bundles/cards/48010.jpg` (710×1030 px, 301.8 KB)

### [48011] Tally Ho!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (14–15/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Defense. Superpower.*
- **Rules Text**:
  > **Hero Response** *(defense)*: After Bamf! makes Nightcrawler the defender of an attack, return that copy of Bamf! to your hand. Deal 3 damage to the attacking enemy.
- **Image Asset**: `assets/card-art/bundles/cards/48011.png` (710×1030 px, 321.2 KB)

### [48026] Crisis of Faith
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nightcrawler Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Kurt Wagner player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Kurt Wagner → remove Crisis of Faith from the game.
  > • Discard each [[Attack]] and [[Defense]] event from your hand. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/48026.jpg` (710×1030 px, 333.7 KB)


### Set: Protection

### [48012] Rogue — *Anna Marie*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Action**: Deal 1 damage to another friendly character → until the end of the round, Rogue gains each of that character's [[Traits]] and adds that character's printed THW and ATK to her matching powers. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/48012.png` (710×1030 px, 257.6 KB)

### [48013] Northstar — *Jean-Paul Beaubier*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Interrupt**: When a boost card is turned faceup during an attack, deal 1 damage to Northstar → cancel all boost icons ([boost]) on that card.
- **Flavor**: *"Bad guys aren't so scary when you move faster than they blink."*
- **Image Asset**: `assets/card-art/bundles/cards/48013.jpg` (710×1030 px, 342.8 KB)

### [48014] Change of Fortune
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Response**: After you defeat an enemy during the villain phase, exhaust this card → draw 2 cards.
- **Image Asset**: `assets/card-art/bundles/cards/48014.png` (710×1030 px, 375.3 KB)

### [48015] Under Control
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a minion. Max 1 per minion.
  > **Response**: After a hero defends against attached minion's attack and takes no damage, deal 4 damage to attached minion.
- **Image Asset**: `assets/card-art/bundles/cards/48015.jpg` (710×1030 px, 352.3 KB)

### [48016] "Come Get Me, Bub!"
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Discard cards from the encounter deck until you discard a minion. Put that minion into play engaged with you → heal 3 damage from your identity and give your identity a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/48016.jpg` (710×1030 px, 370.7 KB)

### [48017] Powerful Punch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(attack/defense)*: When an enemy initiates an attack, deal 4 damage to that enemy.

### [48018] Riposte
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When your hero defends against an attack, it gets +2 DEF for that attack. If you take no damage from that attack, deal 3 damage to the attacking enemy.
- **Image Asset**: `assets/card-art/bundles/cards/48018.png` (710×1030 px, 301.0 KB)

### [48019] The Power of Protection
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Protection *(green)* card.
- **Image Asset**: `assets/card-art/bundles/cards/48019.jpg` (710×1030 px, 324.2 KB)

### [48020] Astonishing X-Men
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Protection
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 5, **Resources**: [physical]
- **Rules Text**:
  > Victory 0.
  > **Response**: After an [[X-Men]] character defends against an enemy attack and takes no damage, remove 1 threat from this scheme.
  > **When Defeated**: Stun and confuse each enemy in play.
- **Image Asset**: `assets/card-art/bundles/cards/48020.jpg` (1030×710 px, 373.3 KB)


### Set: Basic

### [48021] Gambit — *Remy LeBeau*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: -1 (Consequential: 1), **ATK**: -1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Thief. X-Men.*
- **Rules Text**:
  > X is the number of boost icons ([boost]) on the card under Gambit.
  > **Response**: After Gambit enters play, look at the top 3 cards of the encounter deck and tuck one under him so that only the boost field is visible.
- **Image Asset**: `assets/card-art/bundles/cards/48021.png` (710×1030 px, 369.2 KB)

### [48022] Moira MacTaggert
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > Play only if your identity has the [[MUTANT]] trait.
  > **Response**: After a [[MUTANT]] alter-ego changes into hero form, exhaust Moira MacTaggert → that hero's controller draws 1 card.

### [48023] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [48024] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [48025] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.


### Set: Nightcrawler Nemesis

### [48027] Azazel
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Nightcrawler Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Neyaphem.*
- **Rules Text**:
  > Quickstrike.
  > Azazel cannot have upgrades attached.
  >
  > ---
  >
  > [star] **Boost**: Deal Azazel to the Kurt Wagner player as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/48027.png` (710×1030 px, 273.4 KB)

### [48028] Brimstone Dimension
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler Nemesis (2/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nightcrawler Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme finds Azazel and deals him to themself as a facedown encounter card.
- **Flavor**: *"All of this could be yours, if you'd only join me!"—Azazel*
- **Image Asset**: `assets/card-art/bundles/cards/48028.png` (1030×710 px, 328.3 KB)

### [48029] Azazel's Sword
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler Nemesis (3/5)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nightcrawler Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Azazel. Otherwise, attach to the villain.
  > [star] Attached enemy's attacks gain piercing.
  > **Hero Response**: After attached enemy attacks you, discard 1 random card from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/48029.jpg` (710×1030 px, 311.9 KB)

### [48030] Brimstone Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Nightcrawler Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nightcrawler Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Find Azazel and reveal him. He schemes.
  > **When Revealed (Hero)**: Find Azazel and reveal him.
- **Flavor**: *Azazel delights in frustrating his opponents by teleporting in and out of combat.*
- **Image Asset**: `assets/card-art/bundles/cards/48030.png` (710×1030 px, 338.0 KB)


### Set: Aggression

### [48031] Combine Forces
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > Alliance.
  > **Hero Action**: Exhaust an [[X-Force]] character and an [[X-Men]] character → defeat a non-[[Elite]] minion.
- **Flavor**: *"Boy, did you ever choose the wrong mutants on the wrong day!"—Cyclops*
- **Image Asset**: `assets/card-art/bundles/cards/48031.jpg` (710×1030 px, 368.7 KB)


### Set: Justice

### [48032] Gunboat Diplomacy
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > Alliance.
  > **Hero Action** *(attack/thwart)*: Exhaust an [[X-Force]] character and an [[X-Men]] character → remove X threat from among schemes in play and deal X damage among enemies in play, where X is the combined THW of the two exhausted characters.
- **Image Asset**: `assets/card-art/bundles/cards/48032.jpg` (710×1030 px, 352.8 KB)


### Set: Crazy Gang

### [48033] The Crazy Gang
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Crazy Gang (1/6)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crazy Gang Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Response**: After a non-[[Elite]] minion schemes against a player, deal that minion to that player as a facedown encounter card. Then, if there is more than 1 player in the game, pass that facedown encounter card to the next player.
- **Image Asset**: `assets/card-art/bundles/cards/48033.png` (1030×710 px, 304.5 KB)

### [48034] Queen of Hearts
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Crazy Gang (2/6)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crazy Gang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Queen.*
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for The Crazy Gang side scheme and reveal it. If it is already in play, deal yourself a facedown encounter card. *(Shuffle.)*
- **Flavor**: *"Off with his head!"*
- **Image Asset**: `assets/card-art/bundles/cards/48034.jpg` (710×1030 px, 285.7 KB)

### [48035] Jester
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Crazy Gang (3/6)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crazy Gang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: You are confused. If you were already confused, discard a support you control.
- **Flavor**: *"I'll kick you in the face with fun!"*
- **Image Asset**: `assets/card-art/bundles/cards/48035.png` (710×1030 px, 330.8 KB)

### [48036] Executioner
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Crazy Gang (4/6)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crazy Gang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: Executioner attacks the friendly character with the fewest remaining hit points. If this attack defeats an ally, remove that ally from the game.
- **Flavor**: *The Queen of Hearts keeps him busy with her catchphrase.*
- **Image Asset**: `assets/card-art/bundles/cards/48036.png` (710×1030 px, 291.1 KB)

### [48037] Tweedledope
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Crazy Gang (5/6)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crazy Gang Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Criminal.*
- **Rules Text**:
  > **When Revealed**: You are stunned. If you were already stunned, discard an upgrade you control.
- **Flavor**: *"Hyuk hyuk hyuk!"*
- **Image Asset**: `assets/card-art/bundles/cards/48037.jpg` (710×1030 px, 276.5 KB)

### [48038] "Off with His Head!"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Nightcrawler (`ncrawler`)
- **Deck / Set**: Crazy Gang (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crazy Gang Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each minion activates against the player it is engaged with. If no minion activates this way, discard cards from the top of the encounter deck until a minion is discarded and reveal that minion.
- **Flavor**: *It's basically all she ever says.*
- **Image Asset**: `assets/card-art/bundles/cards/48038.jpg` (710×1030 px, 302.2 KB)


