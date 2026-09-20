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
| `53001a` | Falcon | Hero | Falcon | THW:2 ATK:2 DEF:2 HP:10 | - | `falcon` |
| `53001b` | Sam Wilson | Alter-Ego | Falcon | REC:3 HP:10 | - | `falcon` |
| `53002` | Redwing | Ally | Falcon | THW:1 ATK:1 HP:2 | - | `falcon` |
| `53003` | Bird of Prey | Event | Falcon | - | - | `falcon` |
| `53004` | Bird's-Eye View | Event | Falcon | - | - | `falcon` |
| `53005` | Up, Up, and Away | Event | Falcon | - | - | `falcon` |
| `53006` | Falcon's Flock | Support | Falcon | - | - | `falcon` |
| `53007` | Soup Kitchen | Support | Falcon | - | - | `falcon` |
| `53008` | Aerial Evacuation | Upgrade | Falcon | - | - | `falcon` |
| `53009` | Aerial Recon | Upgrade | Falcon | - | - | `falcon` |
| `53010` | Battlefield Awareness | Upgrade | Falcon | - | - | `falcon` |
| `53011` | Draw Their Fire | Upgrade | Falcon | - | - | `falcon` |
| `53012` | Talon Line | Upgrade | Falcon | - | - | `falcon` |
| `53013` | Vibranium Microweave | Upgrade | Falcon | - | - | `falcon` |
| `53014` | Adam Warlock | Ally | Pack Position: 14 | THW:1 ATK:1 HP:3 | - | `falcon` |
| `53015` | Aero | Ally | Pack Position: 15 | THW:1 ATK:1 HP:3 | - | `falcon` |
| `53016` | Cloud 9 | Ally | Pack Position: 16 | THW:1 ATK:1 HP:3 | - | `falcon` |
| `53017` | Hugin & Munin | Ally | Pack Position: 17 | THW:1 ATK:1 HP:2 | - | `falcon` |
| `53018` | Spectrum | Ally | Pack Position: 18 | THW:1 ATK:1 HP:3 | - | `falcon` |
| `53019` | Strength in Diversity | Event | Pack Position: 19 | - | - | `falcon` |
| `53020` | Flight Squadron | Support | Pack Position: 20 | - | - | `falcon` |
| `53021` | Resource Reserve | Support | Pack Position: 21 | - | - | `falcon` |
| `53022` | The Triskelion | Support | Pack Position: 22 | - | - | `falcon` |
| `53023` | Captain America | Upgrade | Pack Position: 23 | - | - | `falcon` |
| `53024` | Wingman | Upgrade | Pack Position: 24 | - | - | `falcon` |
| `53025` | Energy | Resource | Pack Position: 25 | - | - | `falcon` |
| `53026` | Genius | Resource | Pack Position: 26 | - | - | `falcon` |
| `53027` | Strength | Resource | Pack Position: 27 | - | - | `falcon` |
| `53028` | The Power of Flight | Resource | Pack Position: 28 | - | - | `falcon` |
| `53029` | Harlem's Protector | Obligation | Falcon | - | 2 icons | `falcon` |
| `53030` | Viper | Minion | Falcon Nemesis | SCH:2 ATK:2 HP:5 | 2 icons | `falcon` |
| `53031` | Serpent Solutions | Side Scheme | Falcon Nemesis | - | 1 icon | `falcon` |
| `53032` | Serpent Soldier | Minion | Falcon Nemesis | SCH:1 ATK:2 HP:3 | 0 icons + star | `falcon` |
| `53033` | Adder-tisement | Treachery | Falcon Nemesis | - | 1 icon | `falcon` |
| `53034` | Captain America's Shield | Upgrade | Pack Position: 34 | - | - | `falcon` |
| `53035` | Winter Soldier | Ally | Pack Position: 35 | THW:1 ATK:2 HP:3 | - | `falcon` |
| `53036` | Misty Knight | Ally | Pack Position: 36 | THW:1 ATK:1 HP:3 | - | `falcon` |
| `53037` | Ops Room | Support | Pack Position: 37 | - | - | `falcon` |
| `53038` | Fixer | Minion | Techno | SCH:2 ATK:1 HP:15 | 4 icons | `falcon` |
| `53039` | Jet Pack | Attachment | Techno | - | 1 icon | `falcon` |
| `53040` | Tech-Pac | Attachment | Techno | SCH:1 ATK:1 | 3 icons | `falcon` |
| `53041` | Technological Innovation | Side Scheme | Techno | - | 2 icons | `falcon` |
| `53042` | Techno | Treachery | Techno | - | 1 icon + star | `falcon` |

---

## Pack: Falcon (`falcon`)

### Set: Falcon

### [53001a] Falcon
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > During the player phase, play with the top card of the encounter deck faceup.
  > *Eagle-Eyed* — **Response**: After you play an [[Aerial]] card, discard the top card of the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/53001a.png` (300×426 px, 245.9 KB)

### [53001b] Sam Wilson
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > *Birds of a Feather* — **Action**: Discard 1 card from your hand → search your deck and discard pile for a [[Bird]] card and add it to your hand. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/53001b.png` (300×426 px, 251.1 KB)

### [53002] Redwing
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Aerial. Avenger. Bird.*
- **Rules Text**:
  > **Hero Action**: Exhaust Redwing, return him to your hand, and discard the top card of the encounter deck → choose to either deal X damage to an enemy or remove X threat from a scheme. X is the number of icons ([star] and [boost]) in the discarded card's boost area.
- **Image Asset**: `assets/card-art/bundles/cards/53002.jpg` (710×1030 px, 305.3 KB)

### [53003] Bird of Prey
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (2–3/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Aerial. Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. You may discard the top card of the encounter deck to deal 1 additional damage to that enemy for each icon ([star] and [boost]) in the discarded card's boost area.
- **Image Asset**: `assets/card-art/bundles/cards/53003.png` (710×1030 px, 327.5 KB)

### [53004] Bird's-Eye View
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (4–5/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Aerial. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. You may discard the top card of the encounter deck to remove 1 additional threat from that scheme for each icon ([star] and [boost]) in the discarded card's boost area.
- **Image Asset**: `assets/card-art/bundles/cards/53004.jpg` (710×1030 px, 374.6 KB)

### [53005] Up, Up, and Away
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (6–7/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Aerial. Defense.*
- **Rules Text**:
  > **Hero Response** *(defense)*: After an attacking enemy is given a facedown boost card, look at that card and the top card of the encounter deck. You may swap those cards. Draw 1 card for each printed icon ([star] and [boost]) in the *(current)* boost card's boost area.
- **Image Asset**: `assets/card-art/bundles/cards/53005.png` (710×1030 px, 365.2 KB)

### [53006] Falcon's Flock
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (8/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Aerial. Bird.*
- **Rules Text**:
  > Uses (5 bird counters).
  > **Resource**: Remove 1 bird counter from here → generate a [energy] resource for an [[Aerial]] card. (Limit once per card.)
- **Flavor**: *"Have you heard the word?" —Falcon*
- **Image Asset**: `assets/card-art/bundles/cards/53006.png` (710×1030 px, 350.8 KB)

### [53007] Soup Kitchen
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (9/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Sam Wilson and Soup Kitchen → heal damage from Sam Wilson equal to his REC and reduce the cost of the next ally or support played this phase by 2.
- **Flavor**: *In following his parents' examples of service, Sam sets an example for others.*
- **Image Asset**: `assets/card-art/bundles/cards/53007.jpg` (710×1030 px, 362.7 KB)

### [53008] Aerial Evacuation
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (10/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Aerial. Preparation.*
- **Rules Text**:
  > **Hero Interrupt**: When another friendly character would be dealt any amount of damage, discard Aerial Evacuation → prevent all of that damage and change to alter-ego form. If that character is a hero, they also change to alter-ego form.
- **Image Asset**: `assets/card-art/bundles/cards/53008.jpg` (710×1030 px, 344.0 KB)

### [53009] Aerial Recon
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (11/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Aerial. Tactic.*
- **Rules Text**:
  > **Hero Action**: Exhaust Aerial Recon and deal a player 1 facedown encounter card → place 1 recon counter here.
  > **Interrupt**: When a player would be dealt an encounter card, remove 1 recon counter from here instead.
- **Image Asset**: `assets/card-art/bundles/cards/53009.png` (710×1030 px, 372.1 KB)

### [53010] Battlefield Awareness
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (12/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Aerial. Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When Falcon uses a basic power, exhaust Battlefield Awareness and discard the top card of the encounter deck → Falcon gets +1 to that power for this use for each icon ([star] and [boost]) in the discarded card's boost area.
- **Image Asset**: `assets/card-art/bundles/cards/53010.jpg` (710×1030 px, 395.6 KB)

### [53011] Draw Their Fire
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (13/15)
- **Stats**: **Cost**: 1 per hero, **Resources**: [energy]
- **Traits**: *Aerial. Preparation.*
- **Rules Text**:
  > **Hero Response**: After the villain phase begins, discard Draw Their Fire → Falcon does not exhaust to defend until the end of the phase.
- **Flavor**: *"Now, I can do this all day!" —Falcon*
- **Image Asset**: `assets/card-art/bundles/cards/53011.png` (710×1030 px, 375.3 KB)

### [53012] Talon Line
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (14/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Item.*
- **Rules Text**:
  > **Hero Response**: After you resolve Falcon's *"Eagle-Eyed"* ability, discard Talon Line → for each icon in the discarded card's boost area, choose 1:
  > • Ready a character you control.
  > • Stun an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/53012.png` (710×1030 px, 333.9 KB)

### [53013] Vibranium Microweave
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (15/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tech. Wakanda.*
- **Rules Text**:
  > Falcon gets +1 DEF.
  > **Hero Interrupt**: When Falcon would take any amount of damage, exhaust Vibranium Microweave → prevent 1 of that damage and deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/53013.jpg` (710×1030 px, 359.7 KB)

### [53029] Harlem's Protector
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Falcon Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > ***Give to the Sam Wilson player.***
  > Uses (3 emergency counters). Victory 0.
  > **Alter-Ego Action**: Spend 1 resource of any type → remove 1 emergency counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/53029.jpg` (710×1030 px, 354.4 KB)


### Set: Leadership

### [53014] Adam Warlock
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Aerial. Mystic.*
- **Rules Text**:
  > **Response**: After Adam Warlock attacks or thwarts, discard 1 card at random from your hand. If that card's printed resource has:
  > [physical] – Remove 3 threat from a scheme.
  > [energy] – Heal 3 damage from an identity.
  > [mental] – Deal 3 damage to an enemy.
  > [wild] – Choose one of the above.

### [53015] Aero
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Aerial. Agent of Atlas.*
- **Rules Text**:
  > **Hero Action**: Exhaust Aero → choose a player. Until the end of the phase, each [[Aerial]] character that player controls gets +1 ATK.
- **Flavor**: *"I sense trouble on the wind."*
- **Image Asset**: `assets/card-art/bundles/cards/53015.jpg` (710×1030 px, 298.6 KB)

### [53016] Cloud 9 — *Abby Boylen*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Aerial. Champion.*
- **Rules Text**:
  > **Hero Action**: Exhaust Cloud 9 → choose a player. Until the end of the phase, each [[Aerial]] character that player controls gets +1 THW.
- **Flavor**: *"I'm only here 'cause I wanna fly!"*

### [53017] Hugin & Munin
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Aerial. Asgard. Bird.*
- **Rules Text**:
  > **Response**: After Hugin & Munin enter play, search the top 10 cards of the encounter deck for a minion and put it into play engaged with you → ready 1 character you control for each icon ([star] and [boost]) in that minion's boost area.
- **Image Asset**: `assets/card-art/bundles/cards/53017.png` (710×1030 px, 339.5 KB)

### [53018] Spectrum — *Monica Rambeau*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Response**: After you play Spectrum, tuck 1 card used to pay for her under her. If that card's printed resource has:
  > [mental] – Spectrum gets +2 THW.
  > [physical] – Spectrum gets +2 ATK.
  > [energy] – Spectrum gets +2 hit points.
  > [wild] – All of the above.
- **Image Asset**: `assets/card-art/bundles/cards/53018.png` (710×1030 px, 295.3 KB)

### [53019] Strength in Diversity
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 2 per hero, **Resources**: [wild]
- **Rules Text**:
  > Alliance.
  > **Hero Action**: For each different [[Trait]] on friendly characters in play, choose:
  > • Remove 1 threat from a scheme.
  > • Deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/53019.jpg` (710×1030 px, 348.2 KB)

### [53020] Flight Squadron
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Team.*
- **Rules Text**:
  > Play only if your identity has the [[Aerial]] trait. Max 1 [[TEAM]] card per player.
  > If each of your allies has the [[Aerial]] trait, increase your ally limit by 1 and this card gains: "**Response**: After you play an [[Aerial]] card, exhaust this card → ready an ally you control."
- **Image Asset**: `assets/card-art/bundles/cards/53020.jpg` (710×1030 px, 373.8 KB)

### [53021] Resource Reserve
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Location.*
- **Rules Text**:
  > Max 1 per player.
  > Any player may spend the resource card tucked here as if it were in their hand.
  > **Action**: Exhaust Resource Reserve → tuck 1 resource card from your hand under here (to a maximum of 1).
- **Image Asset**: `assets/card-art/bundles/cards/53021.png` (710×1030 px, 352.5 KB)

### [53022] The Triskelion
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > Increase your ally limit by 1. *(This allows you to control more than 3 allies.)*
- **Flavor**: *"Think they made it tall enough?" —She-Hulk*

### [53023] Captain America
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > Play only if you are the Bucky Barnes or Sam Wilson player.
  > **Hero Action**: Exhaust Captain America and spend a [physical] resource → find Captain America's Shield and add it to your hand. If it leaves play this way, deal 4 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/53023.jpg` (710×1030 px, 388.0 KB)

### [53024] Wingman
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Title.*
- **Rules Text**:
  > Attach to an [[Aerial]] ally. Max 1 per ally.
  > **Interrupt**: When another [[Aerial]] ally would take any amount of consequential damage, exhaust attached ally → prevent 1 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/53024.png` (710×1030 px, 386.3 KB)

### [53034] Captain America's Shield
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 34
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Item.*
- **Rules Text**:
  > Linked (Captain America upgrade). Restricted.
  > Your hero gets +1 DEF and gains retaliate 1.
- **Flavor**: *"This shield is a symbol of freedom." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/53034.jpg` (710×1030 px, 308.3 KB)


### Set: Basic

### [53025] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [53026] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [53027] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [53028] The Power of Flight
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Resources**: [energy]
- **Rules Text**:
  > Double the number of resources this card generates while paying for an [[AERIAL]] card.
- **Image Asset**: `assets/card-art/bundles/cards/53028.png` (710×1030 px, 326.4 KB)


### Set: Falcon Nemesis

### [53030] Viper
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Falcon Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Serpent Society.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After Viper activates, discard the top 5 cards of the encounter deck.
  > *(Falcon's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/53030.png` (710×1030 px, 346.5 KB)

### [53031] Serpent Solutions
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon Nemesis (2/5)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Falcon Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After a [[Serpent Society]] minion is discarded from the top of the encounter deck, deal that minion to the first player as a facedown encounter card.
- **Flavor**: *"When you've got problems, you need Serpent Solutions." —Viper*
- **Image Asset**: `assets/card-art/bundles/cards/53031.jpg` (1030×710 px, 353.0 KB)

### [53032] Serpent Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Falcon Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Serpent Society.*
- **Rules Text**:
  > Quickstrike.
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy an additional boost card.
- **Image Asset**: `assets/card-art/bundles/cards/53032.jpg` (710×1030 px, 283.2 KB)

### [53033] Adder-tisement
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Falcon Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Falcon Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Shuffle each [[Serpent Society]] minion from the encounter discard pile into the encounter deck.
- **Flavor**: *When Viper took over the Serpent Society, he used his experience as an ad man to rebrand the group as "Serpent Solutions."*
- **Image Asset**: `assets/card-art/bundles/cards/53033.png` (710×1030 px, 311.6 KB)


### Set: Aggression

### [53035] Winter Soldier — *Bucky Barnes*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 35
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > **Response**: After Winter Soldier attacks and defeats an enemy, remove 2 threat from a scheme.
- **Flavor**: *"As long as I'm alive, you'll never fight alone."*
- **Image Asset**: `assets/card-art/bundles/cards/53035.png` (710×1030 px, 293.2 KB)


### Set: Justice

### [53036] Misty Knight
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 36
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 [star] (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Hero for Hire.*
- **Rules Text**:
  > [star] **Interrupt**: When Misty Knight thwarts, look at the top 2 cards of the encounter deck and discard 1 of those cards. Misty Knight gets +1 THW for this thwart for each icon ([star] and [boost]) in the discarded card's boost area.
- **Image Asset**: `assets/card-art/bundles/cards/53036.png` (710×1030 px, 311.8 KB)


### Set: Protection

### [53037] Ops Room
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Pack Position: 37
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 alert counters).
  > **Interrupt**: When a friendly character would take any amount of damage while defending, remove 1 alert counter from here → prevent 1 of that damage and remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/53037.jpg` (710×1030 px, 291.3 KB)


### Set: Techno

### [53038] Fixer
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Techno (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 15
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Techno Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Genius. Thunderbolt.*
- **Rules Text**:
  > Villainous. Victory 1.
  > **Forced Interrupt**: When a non-scenario-specific [[Tech]] attachment would be attached to the villain, attach it to Fixer instead. Text on that card that refers to "the villain" refers to Fixer instead.
- **Image Asset**: `assets/card-art/bundles/cards/53038.jpg` (710×1030 px, 331.5 KB)

### [53039] Jet Pack
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Techno (2/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Techno Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to Fixer. Otherwise, attach to the villain.
  > Attached enemy gains [[Aerial]].
  > **Forced Interrupt**: When attached character would take 3 or more damage, prevent all of that damage and discard Jet Pack.
- **Flavor**: *Vrrrrrooooooom!*
- **Image Asset**: `assets/card-art/bundles/cards/53039.png` (710×1030 px, 282.0 KB)

### [53040] Tech-Pac
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Techno (3/6)
- **Stats**: **SCH**: 1, **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Techno Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to Fixer. Otherwise, attach to the villain.
  > [star] Attached enemy gets +1 ATK for each other [[Tech]] attachment it has.
  > **Hero Action**: Exhaust any number of characters you control with a combined THW greater than attached enemy's SCH → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/53040.jpg` (710×1030 px, 306.3 KB)

### [53041] Technological Innovation
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Techno (4/6)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Techno Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for a [[Tech]] attachment and reveal it. Place 1 additional threat here for each [[Tech]] card in play.
- **Flavor**: *"I'll turn their technology against them!" —Fixer*
- **Image Asset**: `assets/card-art/bundles/cards/53041.png` (1030×710 px, 293.4 KB)

### [53042] Techno
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Falcon (`falcon`)
- **Deck / Set**: Techno (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Techno Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find Fixer and reveal him. *(If he is already in play, he engages you.)* Fixer activates against you. If no enemy activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/53042.png` (710×1030 px, 286.3 KB)


