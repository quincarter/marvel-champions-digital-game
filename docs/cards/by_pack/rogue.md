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
| `38001a` | Rogue | Hero | Rogue | THW:2 ATK:2 DEF:2 HP:11 | - | `rogue` |
| `38001b` | Anna Marie | Alter-Ego | Rogue | REC:3 HP:11 | - | `rogue` |
| `38002` | Touched | Upgrade | Rogue | - | - | `rogue` |
| `38003` | Gambit | Ally | Rogue | THW:2 ATK:2 HP:3 | - | `rogue` |
| `38004` | Rogue's Jacket | Upgrade | Rogue | - | - | `rogue` |
| `38005` | Goin' Rogue | Event | Rogue | - | - | `rogue` |
| `38006` | Southern Cross | Event | Rogue | - | - | `rogue` |
| `38007` | Energy Transfer | Event | Rogue | - | - | `rogue` |
| `38008` | Bulletproof Belle | Event | Rogue | - | - | `rogue` |
| `38009` | Superpower Adaptation | Event | Rogue | - | - | `rogue` |
| `38010` | Iceman | Ally | Pack Position: 10 | THW:1 ATK:2 HP:3 | - | `rogue` |
| `38011` | Karma | Ally | Pack Position: 11 | THW:0 ATK:0 HP:1 | - | `rogue` |
| `38012` | Armor | Ally | Pack Position: 12 | THW:1 ATK:1 HP:2 | - | `rogue` |
| `38013` | Unflappable | Upgrade | Pack Position: 13 | - | - | `rogue` |
| `38014` | Judoka Skill | Upgrade | Pack Position: 14 | - | - | `rogue` |
| `38015` | Preemptive Strike | Event | Pack Position: 15 | - | - | `rogue` |
| `38016` | Not Today! | Event | Pack Position: 16 | - | - | `rogue` |
| `38017` | Defensive Energy | Resource | Pack Position: 17 | - | - | `rogue` |
| `38018` | Moira MacTaggert | Support | Pack Position: 18 | - | - | `rogue` |
| `38019` | X-Gene | Upgrade | Pack Position: 19 | - | - | `rogue` |
| `38020` | Beauty and the Thief | Event | Pack Position: 20 | - | - | `rogue` |
| `38021` | Energy | Resource | Pack Position: 21 | - | - | `rogue` |
| `38022` | Genius | Resource | Pack Position: 22 | - | - | `rogue` |
| `38023` | Strength | Resource | Pack Position: 23 | - | - | `rogue` |
| `38024` | Deadly Touch | Obligation | Rogue | - | 2 icons | `rogue` |
| `38025` | Mystique | Minion | Rogue Nemesis | SCH:1 ATK:1 HP:6 | 3 icons | `rogue` |
| `38026` | Mystique's Manipulations | Side Scheme | Rogue Nemesis | - | 2 icons | `rogue` |
| `38027` | Misled | Treachery | Rogue Nemesis | - | 1 icon | `rogue` |
| `38028` | Med Lab | Support | Pack Position: 28 | - | - | `rogue` |
| `38029` | Donald Pierce | Minion | Reavers | SCH:1 ATK:1 HP:6 | 3 icons | `rogue` |
| `38030` | Skullbuster | Minion | Reavers | SCH:2 ATK:2 HP:5 | 2 icons | `rogue` |
| `38031` | Bonebreaker | Minion | Reavers | SCH:1 ATK:3 HP:5 | 2 icons | `rogue` |
| `38032` | Wade Cole | Minion | Reavers | SCH:1 ATK:2 HP:3 | 1 icon | `rogue` |
| `38033` | Murray Reese | Minion | Reavers | SCH:1 ATK:2 HP:3 | 1 icon | `rogue` |
| `38034` | The Reavers | Side Scheme | Reavers | - | 3 icons | `rogue` |
| `38035` | Cybernetic Enhancements | Attachment | Reavers | ATK:1 | 2 icons | `rogue` |

---

## Pack: Rogue (`rogue`)

### Set: Rogue

### [38001a] Rogue
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 11, **Hand Size**: 5
- **Traits**: *X-Men.*
- **Rules Text**:
  > *Skin Contact* − **Action**: Attach Touched to another character. You gain each of the attached character's [[TRAITS]] until the end of the round. (Limit once per round.)
  > **Forced Response**: After the player phase begins, find Touched and set it aside.
- **Image Asset**: `assets/card-art/bundles/cards/38001a.png` (300×418 px, 198.2 KB)

### [38001b] Anna Marie
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 11, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > **Setup**: Set your Touched upgrade aside.
  > *Withdrawn* − **Forced Response**: After you change to this form, set Touched aside.
- **Flavor**: *"You couldn't live mah life."*
- **Image Asset**: `assets/card-art/bundles/cards/38001b.png` (300×418 px, 179.7 KB)

### [38002] Touched
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (1/16)
- **Stats**: **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > If Touched is attached to a:
  > Minion − Rogue's attacks gain overkill.
  > Villain − Rogue gains retaliate 1.
  > Ally − Rogue gains the [[AERIAL]] trait.
  > Hero − Rogue gains stalwart.
- **Image Asset**: `assets/card-art/bundles/cards/38002.png` (710×1030 px, 289.7 KB)

### [38003] Gambit — *Remy LeBeau*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (2/16)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Gambit enters play with 3 charge counters on him.
  > [star] **Interrupt**: When Gambit attacks, remove 1 charge counter from him → deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/38003.png` (710×1030 px, 337.9 KB)

### [38004] Rogue's Jacket
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (3/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Item.*
- **Rules Text**:
  > While Touched is attached to a friendly character, Rogue gets +1 THW.
  > While Touched is attached to a enemy character, Rogue gets +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/38004.png` (710×1030 px, 327.5 KB)

### [38005] Goin' Rogue
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (4–6/16, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. If Rogue has:
  > • [[AERIAL]], remove 2 additional threat.
  > • Retaliate, confuse an enemy.
  > • Stalwart, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/38005.png` (710×1030 px, 290.7 KB)

### [38006] Southern Cross
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (7–9/16, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 6 damage to an enemy. If Rogue has:
  > • [[AERIAL]], this attack deals 2 additional damage.
  > • Retaliate, stun that enemy.
  > • Stalwart, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/38006.png` (710×1030 px, 325.4 KB)

### [38007] Energy Transfer
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (10–11/16, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Attach Touched to a character other than Rogue and deal 2 damage to that character → heal 2 damage from Rogue and ready her. You gain each of the attached character's [[TRAITS]] until the end of the round.
- **Image Asset**: `assets/card-art/bundles/cards/38007.png` (710×1030 px, 315.1 KB)

### [38008] Bulletproof Belle
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (12–13/16, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Defense. Superpower.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When an enemy with Touched attached to it attacks, prevent all damage from that attack and gain a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/38008.png` (710×1030 px, 336.7 KB)

### [38009] Superpower Adaptation
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (14–16/16, Qty: 3)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: If Touched is attached to a friendly character, search its owner's discard pile for an event that belong's to the same classification as that character *(identity-specific, aspect, or basic)* → add that event to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/38009.png` (710×1030 px, 407.4 KB)

### [38024] Deadly Touch
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rogue Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Anna Marie player***
  > • If Touched is attached to a friendly character, deal 2 damage to that character. Discard this card.
  > • If Touched is not attached to a friendly character, place 2 threat on the main scheme. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/38024.png` (710×1030 px, 357.7 KB)


### Set: Protection

### [38010] Iceman — *Bobby Drake*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 10
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Iceman enters play with 3 freeze counters on him.
  > **Response**: After a minion enters play, remove 1 freeze counter from Iceman → stun that minion.
- **Image Asset**: `assets/card-art/bundles/cards/38010.png` (710×1030 px, 344.8 KB)

### [38011] Karma — *Xi'an Coy Manh*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 0 (Consequential: 1), **ATK**: 0 (Consequential: 1), **HP**: 1, **Resources**: [energy]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > **Response**: After you play Karma from your hand, choose a non-[[ELITE]] minion. While Karma is in play, take control of that minion and treat it as a [[CONTROLLED]] ally with a blank text box. Its THW is equal to its printed SCH and it takes 2 consequential damage after it thwarts or attacks.
- **Image Asset**: `assets/card-art/bundles/cards/38011.png` (710×1030 px, 307.2 KB)

### [38012] Armor — *Hisako Ichiki*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Play only if your identity has the [[X-MEN]] trait.
  > Toughness.
- **Flavor**: *"Good luck getting through my impenetrable psionic exoskeleton."*
- **Image Asset**: `assets/card-art/bundles/cards/38012.png` (710×1030 px, 356.1 KB)

### [38013] Unflappable
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Response**: After you defend against an attack and take no damage, exhaust Unflappable → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/38013.png` (710×1030 px, 330.3 KB)

### [38014] Judoka Skill
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Uses (3 judo counters). Max 1 per player.
  > **Interrupt**: When you defend against an enemy attack, remove 1 judo counter from here → that enemy gets -2 ATK for that attack.
- **Image Asset**: `assets/card-art/bundles/cards/38014.png` (710×1030 px, 302.0 KB)

### [38015] Preemptive Strike
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When a boost card is turned face up while the villain attacks, cancel all boost icons ([boost]) on that card. Then deal 1 damage to the villain for each boost icon cancelled this way.
- **Image Asset**: `assets/card-art/bundles/cards/38015.png` (710×1030 px, 294.7 KB)

### [38016] Not Today!
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When your hero defends against an attack, it gets +2 DEF for that attack. If you take no damage from that attack, remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/38016.png` (710×1030 px, 314.4 KB)

### [38017] Defensive Energy
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > **Hero Interrupt**: When you spend this card to play a [[Defense]] event, draw 1 card.


### Set: Basic

### [38018] Moira MacTaggert
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > Play only if your identity has the [[MUTANT]] trait.
  > **Response**: After a [[MUTANT]] alter-ego changes into hero form, exhaust Moira MacTaggert → that hero's controller draws 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/38018.png` (710×1030 px, 315.5 KB)

### [38019] X-Gene
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Rules Text**:
  > Play only if your identity has the [[MUTANT]] trait. Max 1 per player
  > **Resource**: Exhaust X-Gene → generate a [wild] resource for an identity-specific event.
- **Image Asset**: `assets/card-art/bundles/cards/38019.png` (710×1030 px, 327.1 KB)

### [38020] Beauty and the Thief
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > Team-Up (Gambit and Rogue). Max 1 per deck.
  > **Hero Action** *(attack/thwart)*: Deal 4 damage to an enemy. Remove 4 threat from a scheme.

### [38021] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [38022] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [38023] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.


### Set: Rogue Nemesis

### [38025] Mystique
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rogue Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants. Elite.*
- **Rules Text**:
  > Toughness. Villainous.
  > **Forced Response**: After Mystique engages you, search the encounter deck, discard pile, and set-aside area for a copy of the Misled treachery and shuffle it into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/38025.png` (710×1030 px, 284.7 KB)

### [38026] Mystique's Manipulations
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rogue Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Shapeshifter.*
- **Rules Text**:
  > **When Defeated**: Search the encounter deck and discard pile for a copy of the Misled treachery and shuffle it into your deck.
- **Flavor**: *While she knows Mystique can't be trusted, Rogue still finds it hard to reject the woman who raised her.*
- **Image Asset**: `assets/card-art/bundles/cards/38026.png` (1030×710 px, 290.6 KB)

### [38027] Misled
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Rogue Nemesis (3–5/5, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rogue Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Shapeshifter.*
- **Rules Text**:
  > **When Revealed**: Shuffle this card into your deck. This card gains surge.
  > **Forced Response**: After this card enters your hand, place 2 threat on the main scheme. *(You may discard this card from your hand at the end of the player phase like any other card.)*
- **Image Asset**: `assets/card-art/bundles/cards/38027.png` (710×1030 px, 282.5 KB)


### Set: Leadership

### [38028] Med Lab
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After an ally is defeated by consequential damage, exhaust Med Lab → place it here. (Limit 1 ally at a time.)
  > **Alter-Ego Action**: Exhaust Med Lab → play the ally here as if it was in your hand. It enters play exhausted.
- **Image Asset**: `assets/card-art/bundles/cards/38028.png` (710×1030 px, 268.8 KB)


### Set: Reavers

### [38029] Donald Pierce
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Reavers (1/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Reavers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Reaver.*
- **Rules Text**:
  > Teamwork ([[REAVER]]). Villainous.
  > **Forced Response**: After Donald Pierce engages you, reveal the topmost [[REAVER]] minion from the discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/38029.png` (710×1030 px, 251.1 KB)

### [38030] Skullbuster
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Reavers (2/8)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Reavers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Reaver.*
- **Rules Text**:
  > Teamwork ([[REAVER]]). Toughness.
  > **Forced Response**: After Skullbuster engages you, place 1 threat on the main scheme for each [[REAVER]] minion engaged with you.
- **Flavor**: *"Who you gonna call?"*
- **Image Asset**: `assets/card-art/bundles/cards/38030.png` (710×1030 px, 285.2 KB)

### [38031] Bonebreaker
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Reavers (3/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Reavers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Reaver.*
- **Rules Text**:
  > Teamwork ([[REAVER]]). Toughness.
  > **Forced Response**: After Bonebreaker engages you, take 1 indirect damage for each [[REAVER]] minion engaged with you.
- **Errata (FFG)**:
  > Changed “Forced Interrupt” to “Forced Response”. (RRG 1.5)
- **Flavor**: *"Bonebreaker's ready!"*
- **Image Asset**: `assets/card-art/bundles/cards/38031.png` (710×1030 px, 339.4 KB)

### [38032] Wade Cole
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Reavers (4/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Reavers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Reaver.*
- **Rules Text**:
  > Teamwork ([[REAVER]]).
  > **When Revealed**: Search the encounter deck and discard pile for a copy of the Cybernetic Enhancements attachment and attach it to Wade Cole. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/38032.png` (710×1030 px, 281.1 KB)

### [38033] Murray Reese
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Reavers (5/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Reavers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Reaver.*
- **Rules Text**:
  > Teamwork ([[REAVER]]).
  > **When Revealed**: Search the encounter deck and discard pile for a copy of the Cybernetic Enhancements attachment and attach it to Murray Reese. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/38033.png` (710×1030 px, 261.8 KB)

### [38034] The Reavers
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Reavers (6/8)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Reavers Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme discards cards from the encounter deck until a [[REAVER]] minion is discarded, then reveals that minion.
- **Image Asset**: `assets/card-art/bundles/cards/38034.png` (1030×710 px, 349.1 KB)

### [38035] Cybernetic Enhancements
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Rogue (`rogue`)
- **Deck / Set**: Reavers (7–8/8, Qty: 2)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Reavers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to a minion. Otherwise, this card gains surge.
  > Attached minion cannot take damage.
  > [star] **Forced Response**: After attached minion attacks, discard Cybernetic Enhancements.
- **Image Asset**: `assets/card-art/bundles/cards/38035.png` (710×1030 px, 312.0 KB)


