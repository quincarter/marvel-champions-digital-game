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
| `36001a` | Storm | Hero | Storm | THW:1 ATK:2 DEF:1 HP:10 | - | `storm` |
| `36001b` | Ororo Munroe | Alter-Ego | Storm | REC:3 HP:10 | - | `storm` |
| `36002` | Clear Skies | Support | Weather Deck | - | - | `storm` |
| `36003` | Hurricane | Support | Weather Deck | - | - | `storm` |
| `36004` | Thunderstorm | Support | Weather Deck | - | - | `storm` |
| `36005` | Blizzard | Support | Weather Deck | - | - | `storm` |
| `36006` | Storm's Crown | Upgrade | Storm | - | - | `storm` |
| `36007` | Storm's Cape | Upgrade | Storm | - | - | `storm` |
| `36008` | Ororo's Garden | Support | Storm | - | - | `storm` |
| `36009` | Weather Goddess | Event | Storm | - | - | `storm` |
| `36010` | Torrential Rain | Event | Storm | - | - | `storm` |
| `36011` | Lightning Bolt | Event | Storm | - | - | `storm` |
| `36012` | Flash Freeze | Event | Storm | - | - | `storm` |
| `36013` | Blast of Wind | Event | Storm | - | - | `storm` |
| `36014` | Havok | Ally | Pack Position: 14 | THW:1 ATK:2 HP:3 | - | `storm` |
| `36015` | Mirage | Ally | Pack Position: 15 | THW:2 ATK:1 HP:2 | - | `storm` |
| `36016` | Gentle | Ally | Pack Position: 16 | THW:1 ATK:3 HP:3 | - | `storm` |
| `36017` | Pixie | Ally | Pack Position: 17 | THW:1 ATK:2 HP:2 | - | `storm` |
| `36018` | Uncanny X-Men | Support | Pack Position: 18 | - | - | `storm` |
| `36019` | Leadership Skill | Upgrade | Pack Position: 19 | - | - | `storm` |
| `36020` | "To Me, My X-Men!" | Event | Pack Position: 20 | - | - | `storm` |
| `36021` | Effective Leadership | Resource | Pack Position: 21 | - | - | `storm` |
| `36022` | Forge | Ally | Pack Position: 22 | THW:1 ATK:1 HP:2 | - | `storm` |
| `36023` | The X-Jet | Support | Pack Position: 23 | - | - | `storm` |
| `36024` | Utopia | Support | Pack Position: 24 | - | - | `storm` |
| `36025` | X-Mansion | Support | Pack Position: 25 | - | - | `storm` |
| `36026` | Endurance | Upgrade | Pack Position: 26 | - | - | `storm` |
| `36027` | Energy | Resource | Pack Position: 27 | - | - | `storm` |
| `36028` | Genius | Resource | Pack Position: 28 | - | - | `storm` |
| `36029` | Strength | Resource | Pack Position: 29 | - | - | `storm` |
| `36030` | Claustrophobia | Obligation | Storm | - | 2 icons | `storm` |
| `36031` | Callisto | Minion | Storm Nemesis | SCH:1 ATK:3 HP:5 | 3 icons | `storm` |
| `36032` | Leader of the Morlocks | Side Scheme | Storm Nemesis | - | 3 icons | `storm` |
| `36033` | Switchblade | Attachment | Storm Nemesis | ATK:2 | 2 icons | `storm` |
| `36034` | Knife Fight | Treachery | Storm Nemesis | - | 2 icons | `storm` |
| `36035` | Hangar Bay | Support | Pack Position: 35 | - | - | `storm` |
| `36036` | The Shadow King | Minion | Shadow King | SCH:3 ATK:3 HP:6 | 3 icons | `storm` |
| `36037` | Ruler of the Astral Plane | Side Scheme | Shadow King | - | 0 icons + star | `storm` |
| `36038` | Possessed | Attachment | Shadow King | - | 2 icons | `storm` |
| `36039` | Astral Attack | Treachery | Shadow King | - | 0 icons + star | `storm` |

---

## Pack: Storm (`storm`)

### Set: Storm

### [36001a] Storm
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 1, **HP**: 10, **Hand Size**: 5
- **Traits**: *X-Men.*
- **Rules Text**:
  > *Weather Control* — **Action**: Swap your [[WEATHER]] support in play with a support of your choice from the [[WEATHER]] deck. Resolve the "**Special**" ability on your [[WEATHER]] support in play. (Limit once per round).
- **Image Asset**: `assets/card-art/bundles/cards/36001a.png` (607×880 px, 148.9 KB)

### [36001b] Ororo Munroe
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > Ororo Munroe begins the game with a [[WEATHER]] deck. (See insert.)
  > *"I feel a storm coming..."* — **Setup**: Choose a support from the [[WEATHER]] deck and put it into play.
- **Image Asset**: `assets/card-art/bundles/cards/36001b.png` (607×880 px, 166.1 KB)

### [36006] Storm's Crown
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Item.*
- **Rules Text**:
  > Storm gets +1 THW.
  > **Hero Resource**: Exhaust Storm's Crown → generate the printed resource on your [[WEATHER]] support.
- **Image Asset**: `assets/card-art/bundles/cards/36006.png` (607×880 px, 134.8 KB)

### [36007] Storm's Cape
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Item.*
- **Rules Text**:
  > Storm gets +1 DEF and gains the [[AERIAL]] trait.
  > **Hero Response**: After you resolve the  "**Special**" ability on your [[WEATHER]] support, exhaust Storm's Cape → ready Storm.
- **Image Asset**: `assets/card-art/bundles/cards/36007.png` (607×880 px, 131.5 KB)

### [36008] Ororo's Garden
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Ororo's Garden → heal 2 damage from your identity.
- **Image Asset**: `assets/card-art/bundles/cards/36008.png` (607×880 px, 143.4 KB)

### [36009] Weather Goddess
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (4–6/15, Qty: 3)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**:  Swap your [[WEATHER]] support in play with a support of your choice from the [[WEATHER]] deck. Resolve the "**Special**" ability on your [[WEATHER]] support in play.
- **Image Asset**: `assets/card-art/bundles/cards/36009.png` (607×880 px, 147.1 KB)

### [36010] Torrential Rain
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (7–9/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from among schemes in play. If Hurricane is in play, resolve its "**Special**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/36010.png` (607×880 px, 157.8 KB)

### [36011] Lightning Bolt
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (10–11/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 8 damage to an enemy. If Thunderstorm is in play, resolve its "**Special**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/36011.png` (607×880 px, 135.5 KB)

### [36012] Flash Freeze
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (12–13/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Defense. Superpower.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When the villain attacks you, the villain and each minion engaged with you get -3 ATK while attacking you this phase. If Blizzard is in play, resolve its "**Special**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/36012.png` (607×880 px, 137.8 KB)

### [36013] Blast of Wind
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (14–15/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Choose a player → deal 3 damage to the villain and each minion engaged with that player. Resolve the "**Special**" ability of your [[WEATHER]] support.
- **Image Asset**: `assets/card-art/bundles/cards/36013.png` (607×880 px, 150.3 KB)

### [36030] Claustrophobia
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Storm Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Ororo Munroe player.***
  > Flip to alter-ego form. You cannot change to hero form.
  > **Alter-Ego Action:** Exhaust Ororo Munroe → remove Claustrophobia from the game.
- **Errata (FFG)**:
  > Changed “change forms” to “change to hero form”. (RRG 1.6)
- **Image Asset**: `assets/card-art/bundles/cards/36030.png` (607×880 px, 136.4 KB)


### Set: Weather Deck

### [36002] Clear Skies
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Weather Deck (1/4)
- **Properties**: Permanent
- **Stats**: **Resources**: [wild]
- **Traits**: *Weather.*
- **Rules Text**:
  > Permanent.
  > Each character gains stalwart.
  > **Special**: Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/36002.png` (607×880 px, 128.2 KB)

### [36003] Hurricane
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Weather Deck (2/4)
- **Properties**: Permanent
- **Stats**: **Resources**: [physical]
- **Traits**: *Weather.*
- **Rules Text**:
  > Permanent.
  > Each character gains retaliate 1.
  > **Special**: Remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/36003.png` (607×880 px, 145.8 KB)

### [36004] Thunderstorm
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Weather Deck (3/4)
- **Properties**: Permanent
- **Stats**: **Resources**: [energy]
- **Traits**: *Weather.*
- **Rules Text**:
  > Permanent.
  > Each character gets +1 ATK.
  > **Special**: Deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/36004.png` (607×880 px, 136.4 KB)

### [36005] Blizzard
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Storm (`storm`)
- **Deck / Set**: Weather Deck (4/4)
- **Properties**: Permanent
- **Stats**: **Resources**: [mental]
- **Traits**: *Weather.*
- **Rules Text**:
  > Permanent.
  > Each character gets -1 ATK.
  > **Special**: Choose a non-[[ELITE]] minion → until the end of the round, treat that minion's text box as if it were blank *(except for **TRAITS***).
- **Image Asset**: `assets/card-art/bundles/cards/36005.png` (607×880 px, 168.1 KB)


### Set: Leadership

### [36014] Havok — *Alex Summers*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 [star], **HP**: 3, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Havok attacks, discard the top card of the encounter deck. For each boost icon ([boost]) discarded this way, Havok gets +1 ATK for this attack and takes +1 consequential damage ([cost]).
- **Image Asset**: `assets/card-art/bundles/cards/36014.png` (607×880 px, 135.1 KB)

### [36015] Mirage — *Dani Moonstar*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > **Response**: After Mirage enters play, choose an enemy whose SCH is less than Mirage's THW → stun that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/36015.png` (607×880 px, 127.6 KB)

### [36016] Gentle — *Nezhno Abidemi*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 3 [star] (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > [star] Gentle takes +1 consequential damage ([cost]) after he attacks the villain.
- **Image Asset**: `assets/card-art/bundles/cards/36016.png` (607×880 px, 140.7 KB)

### [36017] Pixie — *Megan Gwynn*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 2), **HP**: 2, **Resources**: [energy]
- **Traits**: *Aerial. X-Men.*
- **Rules Text**:
  > **Response**: After you play Pixie from your hand, add an [[X-MEN]] ally from your discard pile to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/36017.png` (607×880 px, 135.1 KB)

### [36018] Uncanny X-Men
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Team.*
- **Rules Text**:
  > Play under any player's control. Max 1 [[TEAM]] card per player.
  > Each of your [[X-MEN]] allies gets +1 hit point. If each of your characters has the [[X-MEN]] trait, each of your [[X-MEN]] allies costs 1 fewer resource to play.
- **Image Asset**: `assets/card-art/bundles/cards/36018.png` (607×880 px, 153.8 KB)

### [36019] Leadership Skill
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Uses (3 leadership counters). Max 1 per player.
  > **Interrupt**: When an ally makes a basic thwart or basic attack action, remove 1 leadership counter from here → that ally gets +1 THW and +1 ATK for that action.
- **Image Asset**: `assets/card-art/bundles/cards/36019.png` (607×880 px, 141.1 KB)

### [36020] "To Me, My X-Men!"
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Play only if your identity has the [[X-MEN]] trait.
  > **Hero Action**: Search the top 5 cards of your deck for an [[X-MEN]] ally and put it into play. If that ally is still in play at the end of the phase, add it to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/36020.png` (607×880 px, 154.9 KB)

### [36021] Effective Leadership
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > **Interrupt**: When you spend this card to play an ally, that ally gets +1 THW and +1 ATK until the end of the phase.


### Set: Basic

### [36022] Forge
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Forge enters play, search your deck and discard pile for an [[X-MEN]] or [[X-FORCE]] support and add it to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/36022.png` (607×880 px, 135.1 KB)

### [36023] The X-Jet
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Vehicle. X-Men.*
- **Rules Text**:
  > **Resource**: Exhaust The X-Jet → generate a [wild] resource for a player whose identity has the [[X-MEN]] trait.

### [36024] Utopia
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 24
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Location. X-Men.*
- **Rules Text**:
  > If each of your allies has the [[X-MEN]] trait, increase your ally limit by 1.
  > **Response:** After an [[X-MEN]] ally enters play, exhaust Utopia → ready an [[X-MEN]] character.

### [36025] X-Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 25
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Location. X-Men.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust X-Mansion → heal 1 damage from a [[MUTANT]] or [[X-MEN]] character. Any player whose alter-ego has the [[MUTANT]] trait may trigger this ability.

### [36026] Endurance
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > You get +3 hit points.
- **Image Asset**: `assets/card-art/bundles/cards/36026.png` (607×880 px, 118.5 KB)

### [36027] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [36028] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [36029] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.


### Set: Storm Nemesis

### [36031] Callisto
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Storm Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Morlock.*
- **Rules Text**:
  > Quickstrike.
  > **Forced Interrupt**: When a Knife Fight treachery is revealed, give Callisto a tough status card.
- **Flavor**: *"I'm going to ruin that pretty face of yours!"*
- **Image Asset**: `assets/card-art/bundles/cards/36031.png` (607×880 px, 138.2 KB)

### [36032] Leader of the Morlocks
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Storm Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme searches the encounter deck, discard pile, and set-aside area for Knife Fight and reveals it.
- **Flavor**: *Callisto protects the Morlocks, but she won't let anyone question her authority.*
- **Image Asset**: `assets/card-art/bundles/cards/36032.png` (880×607 px, 218.3 KB)

### [36033] Switchblade
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm Nemesis (3/5)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Storm Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the minion with the highest printed ATK. Otherwise, this card gains surge.
  > [star] Attached minion's attacks gain piercing.
- **Image Asset**: `assets/card-art/bundles/cards/36033.png` (607×880 px, 122.7 KB)

### [36034] Knife Fight
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Storm (`storm`)
- **Deck / Set**: Storm Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Storm Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: Choose an enemy with the highest ATK → take damage equal to its ATK. Deal damage to that enemy equal to your ATK.
- **Image Asset**: `assets/card-art/bundles/cards/36034.png` (607×880 px, 138.1 KB)


### Set: Protection

### [36035] Hangar Bay
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Storm (`storm`)
- **Deck / Set**: Pack Position: 35
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After an ally defends against an attack and is not defeated, exhaust this card → ready that ally.
- **Image Asset**: `assets/card-art/bundles/cards/36035.png` (607×880 px, 131.1 KB)


### Set: Shadow King

### [36036] The Shadow King
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Storm (`storm`)
- **Deck / Set**: Shadow King (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 3, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Shadow King Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Psionic.*
- **Rules Text**:
  > While a [[Controlled]] minion is in play, The Shadow King cannot take damage.
  > **When Revealed**: Search the encounter deck and discard pile for a copy of the Possessed attachment and reveal it. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/36036.png` (607×880 px, 141.5 KB)

### [36037] Ruler of the Astral Plane
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Storm (`storm`)
- **Deck / Set**: Shadow King (2/5)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Shadow King Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Discard 1 copy of Possessed from play.
  >
  > ---
  >
  > [star] **Boost**: If you are engaged with a [[Controlled]] minion, reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/36037.png` (880×607 px, 195.1 KB)

### [36038] Possessed
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Storm (`storm`)
- **Deck / Set**: Shadow King (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Shadow King Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Treat attached ally as a [[Controlled]] minion with a blank text box. Attached minion's SCH is equal to its printed THW and it does not take consequential damage.
  > **When Revealed**: Attach to the ally with the lowest THW without Possessed attached. Attached ally engages its controller. If you cannot, this card gains surge.
- **Errata (FFG)**:
  > Added “Attached ally engages its controller.” (RRG 1.6)
- **Image Asset**: `assets/card-art/bundles/cards/36038.png` (607×880 px, 148.8 KB)

### [36039] Astral Attack
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Storm (`storm`)
- **Deck / Set**: Shadow King (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Shadow King Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[Controlled]] minion activates against you. If there are no [[Controlled]] minions in play, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Shuffle each Shadow King card from the discard pile into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/36039.png` (607×880 px, 141.2 KB)


