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
| `33001a` | Cyclops | Hero | Cyclops | THW:2 ATK:1 DEF:2 HP:10 | - | `cyclops` |
| `33001b` | Scott Summers | Alter-Ego | Cyclops | REC:3 HP:10 | - | `cyclops` |
| `33002` | Phoenix | Ally | Cyclops | THW:2 ATK:2 HP:3 | - | `cyclops` |
| `33003` | Ruby Quartz Visor | Upgrade | Cyclops | - | - | `cyclops` |
| `33004` | Field Commander | Upgrade | Cyclops | - | - | `cyclops` |
| `33005` | Exploit Weakness | Upgrade | Cyclops | - | - | `cyclops` |
| `33006` | Practiced Defense | Upgrade | Cyclops | - | - | `cyclops` |
| `33007` | Priority Target | Upgrade | Cyclops | - | - | `cyclops` |
| `33008` | Full Blast | Event | Cyclops | - | - | `cyclops` |
| `33009` | Ricochet Beam | Event | Cyclops | - | - | `cyclops` |
| `33010` | Tactical Brilliance | Event | Cyclops | - | - | `cyclops` |
| `33011` | Beast | Ally | Pack Position: 11 | THW:2 ATK:2 HP:3 | - | `cyclops` |
| `33012` | Dust | Ally | Pack Position: 12 | THW:1 ATK:1 HP:3 | - | `cyclops` |
| `33013` | Rockslide | Ally | Pack Position: 13 | THW:1 ATK:3 HP:6 | - | `cyclops` |
| `33014` | Blindfold | Ally | Pack Position: 14 | THW:2 ATK:0 HP:2 | - | `cyclops` |
| `33015` | Danger Room Training | Upgrade | Pack Position: 15 | - | - | `cyclops` |
| `33016` | Coordinated Attack | Upgrade | Pack Position: 16 | - | - | `cyclops` |
| `33017` | Teamwork | Event | Pack Position: 17 | - | - | `cyclops` |
| `33018` | Effective Leadership | Resource | Pack Position: 18 | - | - | `cyclops` |
| `33019` | Angel | Ally | Pack Position: 19 | THW:1 ATK:2 HP:3 | - | `cyclops` |
| `33020` | Utopia | Support | Pack Position: 20 | - | - | `cyclops` |
| `33021` | Danger Room | Support | Pack Position: 21 | - | - | `cyclops` |
| `33022` | Game Time | Event | Pack Position: 22 | - | - | `cyclops` |
| `33023` | Psychic Rapport | Event | Pack Position: 23 | - | - | `cyclops` |
| `33024` | Energy | Resource | Pack Position: 24 | - | - | `cyclops` |
| `33025` | Genius | Resource | Pack Position: 25 | - | - | `cyclops` |
| `33026` | Strength | Resource | Pack Position: 26 | - | - | `cyclops` |
| `33027` | Lost Visor | Obligation | Cyclops | - | 2 icons | `cyclops` |
| `33028` | Mister Sinister | Minion | Cyclops Nemesis | SCH:1 ATK:1 HP:6 | 2 icons + star | `cyclops` |
| `33029` | Genetic Manipulation | Side Scheme | Cyclops Nemesis | - | 3 icons | `cyclops` |
| `33030` | Gene Therapy | Attachment | Cyclops Nemesis | ATK:2 | 2 icons | `cyclops` |
| `33031` | Concussive Force | Treachery | Cyclops Nemesis | - | 2 icons | `cyclops` |
| `33032` | Marked | Upgrade | Pack Position: 32 | - | - | `cyclops` |
| `33033` | Befuddle | Upgrade | Pack Position: 33 | - | - | `cyclops` |
| `33034` | Pinned Down | Upgrade | Pack Position: 34 | - | - | `cyclops` |
| `33035` | Honorary X-Men | Upgrade | Pack Position: 35 | - | - | `cyclops` |

---

## Pack: Cyclops (`cyclops`)

### Set: Cyclops

### [33001a] Cyclops
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *X-Men.*
- **Rules Text**:
  > *Optic Blast* - **Action** *(attack)*: Spend one resource of any type → deal 3 damage to an enemy with an upgrade attached. (Limit once per round).
- **Image Asset**: `assets/card-art/bundles/cards/33001a.png` (607×880 px, 137.9 KB)

### [33001b] Scott Summers
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > You may include [[X-MEN]] allies from any aspect in your deck.
  > *Constant Training* - **Action**: Search your deck for a [[TACTIC]] upgrade and add it to your hand. (Limit once per round).
- **Image Asset**: `assets/card-art/bundles/cards/33001b.png` (607×880 px, 132.6 KB)

### [33002] Phoenix — *Jean Grey*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > **Response**: After Phoenix enters play, choose a Cyclops card in your discard pile and add it to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/33002.png` (607×880 px, 137.1 KB)

### [33003] Ruby Quartz Visor
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Item.*
- **Rules Text**:
  > **Hero Resource**: Exhaust this card → generate a [energy] resource for your *"Optic Blast"* ability. That attack gains piercing and ranged.
- **Image Asset**: `assets/card-art/bundles/cards/33003.png` (607×880 px, 123.1 KB)

### [33004] Field Commander
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > You take the first turn during the player phase. *(When your turn is done, play proceeds in player order, starting with the first player. You do not take another turn.)*
  > Each Cyclops upgrade attached to a minion loses the temporary keyword.
- **Image Asset**: `assets/card-art/bundles/cards/33004.png` (607×880 px, 142.8 KB)

### [33005] Exploit Weakness
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (4–5/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to an enemy. Max 1 per enemy.
  > Temporary.
  > Increase the amount of damage attached enemy takes from each attack by 1.
- **Image Asset**: `assets/card-art/bundles/cards/33005.png` (607×880 px, 143.7 KB)

### [33006] Practiced Defense
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (6–7/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to an enemy. Max 1 per enemy.
  > Temporary.
  > Attached enemy gets -1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/33006.png` (607×880 px, 134.7 KB)

### [33007] Priority Target
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (8–9/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to an enemy. Max 1 per enemy.
  > Temporary.
  > **Interrupt**: When attached enemy is defeated, the player who defeated it draws 2 cards.
- **Image Asset**: `assets/card-art/bundles/cards/33007.png` (607×880 px, 141.9 KB)

### [33008] Full Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (10/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When you use your *"Optic Blast"* ability, exhaust Cyclops → this attack deals 8 additional damage and gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/33008.png` (607×880 px, 139.0 KB)

### [33009] Ricochet Beam
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (11–12/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. Deal 3 damage to an enemy with an upgrade attached.
- **Image Asset**: `assets/card-art/bundles/cards/33009.png` (607×880 px, 133.8 KB)

### [33010] Tactical Brilliance
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (13–15/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. Choose a [[TACTIC]] card in your discard pile and add it to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/33010.png` (607×880 px, 148.4 KB)

### [33027] Lost Visor
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cyclops Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Scott Summers player.***
  > Search your hand, deck, discard pile, and play area for Ruby Quartz Visor and place it facedown under this card.
  > Cyclops cannot attack.
  > **Alter-Ego Action**: Exhaust Scott Summers → add Ruby Quartz Visor to your hand and remove Lost Visor from the game.
- **Image Asset**: `assets/card-art/bundles/cards/33027.png` (607×880 px, 152.7 KB)


### Set: Leadership

### [33011] Beast — *Hank McCoy*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Genius. X-Men.*
- **Rules Text**:
  > **Response**: After Beast enters play, search your deck and discard pile for a resource card and add it to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/33011.png` (607×880 px, 133.8 KB)

### [33015] Danger Room Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Training.*
- **Rules Text**:
  > Attach to an [[X-MEN]] ally. Max 1 [[TRAINING]] upgrade per ally.
  > Attached ally gets +1 THW, +1 ATK, and +1 hit point.
- **Image Asset**: `assets/card-art/bundles/cards/33015.png` (607×880 px, 153.8 KB)

### [33016] Coordinated Attack
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a minion. Max 1 per minion.
  > Each ally takes -1 consequential damage ([cost]) when attacking attached minion.
- **Image Asset**: `assets/card-art/bundles/cards/33016.png` (607×880 px, 146.0 KB)

### [33017] Teamwork
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Interrupt** When you use your basic thwart power *(THW)* or basic attack power *(ATK)*, exhaust an ally you control → add that ally's matching power to your hero's power for this use.
- **Image Asset**: `assets/card-art/bundles/cards/33017.png` (607×880 px, 137.9 KB)

### [33018] Effective Leadership
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > **Interrupt**: When you spend this card to play an ally, that ally gets +1 THW and +1 ATK until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/33018.png` (607×880 px, 132.8 KB)


### Set: Aggression

### [33012] Dust — *Sooraya Qadir*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > [star] **Interrupt**: When Dust attacks a minion, she attacks each minion in play. Dust takes +1 consequential damage ([cost]) after this attack.
- **Image Asset**: `assets/card-art/bundles/cards/33012.png` (607×880 px, 131.9 KB)

### [33032] Marked
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a minion. Max 1 per minion.
  > Attacks against attached minion gain overkill.
- **Image Asset**: `assets/card-art/bundles/cards/33032.png` (607×880 px, 117.1 KB)


### Set: Protection

### [33013] Rockslide — *Santo Vaccarro*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 6, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Retaliate 1.
- **Image Asset**: `assets/card-art/bundles/cards/33013.png` (607×880 px, 127.4 KB)

### [33034] Pinned Down
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a minion. Max 1 per minion.
  > Attached minion gets -2 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/33034.png` (607×880 px, 134.5 KB)


### Set: Justice

### [33014] Blindfold — *Ruth Aldine*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 0 (Consequential: 1), **HP**: 2, **Resources**: [physical]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > **Response**: After Blindfold enters play, look at the top 5 cards of the encounter deck. Discard 1 of those cards and put the rest back in the same order.
- **Image Asset**: `assets/card-art/bundles/cards/33014.png` (607×880 px, 129.1 KB)

### [33033] Befuddle
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a minion. Max 1 per minion.
  > **Interrupt**: When a character makes a basic attack against attached minion, that character uses their THW instead of their ATK.
- **Image Asset**: `assets/card-art/bundles/cards/33033.png` (607×880 px, 129.7 KB)


### Set: Basic

### [33019] Angel — *Warren Worthington III*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Aerial. X-Men.*
- **Rules Text**:
  > Reduce the cost to play Angel by 1 if your identity has the [[MUTANT]] or [[X-MEN]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/33019.png` (607×880 px, 158.3 KB)

### [33020] Utopia
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Location. X-Men.*
- **Rules Text**:
  > If each of your allies has the [[X-MEN]] trait, increase your ally limit by 1.
  > **Response:** After an [[X-MEN]] ally enters play, exhaust Utopia → ready an [[X-MEN]] character.
- **Image Asset**: `assets/card-art/bundles/cards/33020.png` (607×880 px, 127.2 KB)

### [33021] Danger Room
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Location. X-Men.*
- **Rules Text**:
  > **Alter-Ego Response**: After an [[X-MEN]] ally enters play, exhaust Danger Room → search your deck and discard pile for a [[TRAINING]] upgrade and attach it to that ally. Any player whose alter-ego has the [[MUTANT]] trait may trigger this ability.
- **Image Asset**: `assets/card-art/bundles/cards/33021.png` (607×880 px, 152.6 KB)

### [33022] Game Time
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Choose an ally with a [[TRAINING]] upgrade attached → ready that ally and heal 1 damage from it.
- **Image Asset**: `assets/card-art/bundles/cards/33022.png` (607×880 px, 151.0 KB)

### [33023] Psychic Rapport
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Rules Text**:
  > Team-Up (Cyclops and Phoenix). Max 1 per deck.
  > **Hero Action**: Ready Cyclops and Phoenix. Choose to either return a Cyclops card from your discard pile to your hand or place 2 power counters on Phoenix Force.
- **Image Asset**: `assets/card-art/bundles/cards/33023.png` (607×880 px, 148.1 KB)

### [33024] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [33025] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [33026] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [33035] Honorary X-Men
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Pack Position: 35
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > Play only if your identity has the [[X-MEN]] trait.
  > Attach to a friendly character. Max 1 per character.
  > Attached character gets +1 hit point and gains the [[X-MEN]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/33035.png` (607×880 px, 157.4 KB)


### Set: Cyclops Nemesis

### [33028] Mister Sinister
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Cyclops Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Marauder.*
- **Rules Text**:
  > Stalwart. Toughness. Villainous.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. If you are already stunned, take 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/33028.png` (607×880 px, 126.1 KB)

### [33029] Genetic Manipulation
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cyclops Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Defeated**: Search the encounter deck and discard pile for Gene Therapy and reveal it. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/33029.png` (880×607 px, 192.2 KB)

### [33030] Gene Therapy
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops Nemesis (3–4/5, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cyclops Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the enemy with the lowest printed ATK without a copy of Gene Therapy attached. Otherwise, this card gains surge.
  > [star] **Forced Interrupt**: When attached enemy attacks, the attack gains overkill and piercing. At the end of this attack, discard Gene Therapy.
- **Image Asset**: `assets/card-art/bundles/cards/33030.png` (607×880 px, 147.7 KB)

### [33031] Concussive Force
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Cyclops (`cyclops`)
- **Deck / Set**: Cyclops Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cyclops Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: If Mister Sinister is in play, he schemes. Otherwise, place 2 threat on the main scheme.
  > **When Revealed (Hero)**: If Mister Sinister is in play, he attacks you. Otherwise, take 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/33031.png` (607×880 px, 121.0 KB)


