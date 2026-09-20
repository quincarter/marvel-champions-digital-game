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
| `09001a` | Doctor Strange | Hero | Doctor Strange | THW:2 ATK:1 DEF:2 HP:10 | - | `drs` |
| `09001b` | Stephen Strange | Alter-Ego | Doctor Strange | REC:3 HP:10 | - | `drs` |
| `09002` | Wong | Ally | Doctor Strange | THW:1 ATK:2 HP:3 | - | `drs` |
| `09003` | Astral Projection | Event | Doctor Strange | - | - | `drs` |
| `09004` | Magic Blast | Event | Doctor Strange | - | - | `drs` |
| `09005` | Master of the Mystic Arts | Event | Doctor Strange | - | - | `drs` |
| `09006` | Mystical Studies | Event | Doctor Strange | - | - | `drs` |
| `09007` | Protective Ward | Event | Doctor Strange | - | - | `drs` |
| `09008` | Sanctum Sanctorum | Support | Doctor Strange | - | - | `drs` |
| `09009` | Cloak of Levitation | Upgrade | Doctor Strange | - | - | `drs` |
| `09010` | Magical Enhancements | Upgrade | Doctor Strange | - | - | `drs` |
| `09011` | The Eye of Agamotto | Upgrade | Doctor Strange | - | - | `drs` |
| `09012` | Brother Voodoo | Ally | Pack Position: 12 | THW:2 ATK:1 HP:3 | - | `drs` |
| `09013` | Clea | Ally | Pack Position: 13 | THW:1 ATK:1 HP:2 | - | `drs` |
| `09014` | Iron Fist | Ally | Pack Position: 14 | THW:1 ATK:2 HP:3 | - | `drs` |
| `09015` | Desperate Defense | Event | Pack Position: 15 | - | - | `drs` |
| `09016` | Momentum Shift | Event | Pack Position: 16 | - | - | `drs` |
| `09017` | The Power of Protection | Resource | Pack Position: 17 | - | - | `drs` |
| `09018` | Med Team | Support | Pack Position: 18 | - | - | `drs` |
| `09019` | The Night Nurse | Support | Pack Position: 19 | - | - | `drs` |
| `09020` | Unflappable | Upgrade | Pack Position: 20 | - | - | `drs` |
| `09021` | Warning | Event | Pack Position: 21 | - | - | `drs` |
| `09022` | Energy | Resource | Pack Position: 22 | - | - | `drs` |
| `09023` | Genius | Resource | Pack Position: 23 | - | - | `drs` |
| `09024` | Strength | Resource | Pack Position: 24 | - | - | `drs` |
| `09025` | Avengers Mansion | Support | Pack Position: 25 | - | - | `drs` |
| `09026` | The Sorcerer Supreme | Upgrade | Pack Position: 26 | - | - | `drs` |
| `09027` | Physical Toll | Obligation | Doctor Strange | - | 2 icons | `drs` |
| `09028` | Baron Mordo | Minion | Doctor Strange Nemesis | SCH:2 ATK:2 HP:5 | 2 icons | `drs` |
| `09029` | Open the Dark Dimension | Side Scheme | Doctor Strange Nemesis | - | 3 icons | `drs` |
| `09030` | Counterspell | Attachment | Doctor Strange Nemesis | - | 1 icon | `drs` |
| `09031` | Thoughtcasting | Treachery | Doctor Strange Nemesis | - | 1 icon | `drs` |
| `09032` | Crimson Bands of Cyttorak | Event | Invocation | - | - | `drs` |
| `09033` | Images of Ikonn | Event | Invocation | - | - | `drs` |
| `09034` | Seven Rings of Raggadorr | Event | Invocation | - | - | `drs` |
| `09035` | Vapors of Valtorr | Event | Invocation | - | - | `drs` |
| `09036` | Winds of Watoomb | Event | Invocation | - | - | `drs` |
| `09037` | Skilled Strike | Event | Pack Position: 37 | - | - | `drs` |
| `09038` | Foiled! | Event | Pack Position: 38 | - | - | `drs` |
| `09039` | Iron Man | Ally | Pack Position: 39 | THW:2 ATK:2 HP:3 | - | `drs` |

---

## Pack: Doctor Strange (`drs`)

### Set: Doctor Strange

### [09001a] Doctor Strange
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *Avenger. Mystic.*
- **Rules Text**:
  > *Spell Mastery* — **Action**: Exhaust Doctor Strange and pay the cost of the top card of the [[Invocation]] deck → resolve the "**Special**" ability on that card.
- **Flavor**: *"By the Hoary Hosts of Hoggoth!"*
- **Image Asset**: `assets/card-art/bundles/cards/09001a.png` (300×418 px, 222.5 KB)

### [09001b] Stephen Strange
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Mystic.*
- **Rules Text**:
  > Stephen Strange begins the game with an [[Invocation]] deck. (See insert.)
  > *Natural Talent* — **Action**: Discard the top card of the [[Invocation]] deck. (Limit once per phase.)
- **Image Asset**: `assets/card-art/bundles/cards/09001b.png` (300×418 px, 219.1 KB)

### [09002] Wong
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Mystic.*
- **Rules Text**:
  > **Action**: Exhaust Wong → choose to either heal 1 damage from your identity or discard the top card of the [[Invocation]] deck.
- **Flavor**: *"The oath I swore to protect my master overrides all other directives."*
- **Image Asset**: `assets/card-art/bundles/cards/09002.png` (300×419 px, 41.7 KB)

### [09003] Astral Projection
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (2–3/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Spell. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Choose a scheme → remove 3 threat from that scheme and look at the top card of the encounter deck. For each boost icon on that card, remove 1 additional threat from the chosen scheme.
- **Image Asset**: `assets/card-art/bundles/cards/09003.png` (300×419 px, 38.8 KB)

### [09004] Magic Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (4–5/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Spell.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy and discard the top card of your deck. If that card's printed resource has:
  > [physical] - Stun that enemy.
  > [energy] - Deal 2 damage to that enemy.
  > [mental] - Confuse that enemy.
  > [wild] - All of the above.
- **Image Asset**: `assets/card-art/bundles/cards/09004.png` (300×419 px, 38.1 KB)

### [09005] Master of the Mystic Arts
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (6–7/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Hero Action**: Pay the printed cost of the top card of the [[Invocation]] deck → resolve its "**Special**" ability. Then, place it back on top of the [[Invocation]] deck faceup.
- **Flavor**: *"Nothing is impossible for the Sorcerer Supreme!" —Doctor Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09005.png` (300×418 px, 257.5 KB)

### [09006] Mystical Studies
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (8/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Rules Text**:
  > **Alter-Ego Action**: Search your deck and discard pile for a Doctor Strange card and add it to your hand. Shuffle your deck.
- **Flavor**: *"I believe observation and knowledge must precede action." —Doctor Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09006.png` (300×419 px, 36.1 KB)

### [09007] Protective Ward
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (9–10/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Spell.*
- **Rules Text**:
  > **Hero Interrupt**: When a treachery is revealed from the encounter deck, cancel all of its effects and discard it.
- **Flavor**: *"This is one of the first spells I learned." —Doctor Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09007.png` (300×419 px, 37.9 KB)

### [09008] Sanctum Sanctorum
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Sanctum Sanctorum → shuffle a [[Spell]] card from your discard pile into your deck and draw 1 card.
- **Flavor**: *"A bit ostentatious for Bleecker Street." —Zelma Stanton*
- **Image Asset**: `assets/card-art/bundles/cards/09008.png` (300×419 px, 42.2 KB)

### [09009] Cloak of Levitation
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (12/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Artifact. Item.*
- **Rules Text**:
  > You gain the [[Aerial]] trait.
  > **Hero Action**: Exhaust Cloak of Levitation → ready Doctor Strange.
- **Flavor**: *"If you're gonna call yourself 'The Sorcerer Supreme', then you really should have a flying cloak." —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/09009.png` (300×419 px, 40.4 KB)

### [09010] Magical Enhancements
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (13–14/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition. Spell.*
- **Rules Text**:
  > Play under any player's control.
  > Your hero gets +1 THW, +1 ATK, and +1 DEF.
  > **Forced Interrupt**: When the round ends, discard Magical Enhancements.
- **Image Asset**: `assets/card-art/bundles/cards/09010.png` (300×419 px, 38.7 KB)

### [09011] The Eye of Agamotto
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Artifact. Item.*
- **Rules Text**:
  > **Hero Resource**: Exhaust The Eye of Agamotto → generate a [wild] resource.
- **Flavor**: *"The Eye of Agamotto will reveal the truth." —Doctor Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09011.png` (300×419 px, 44.3 KB)

### [09027] Physical Toll
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Doctor Strange Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Stephen Strange player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Stephen Strange → remove Physical Toll from the game.
  > • The next event you play costs 3 additional resources. Discard this obligation after you play an event.
- **Image Asset**: `assets/card-art/bundles/cards/09027.png` (300×418 px, 214.4 KB)


### Set: Protection

### [09012] Brother Voodoo — *Jericho Drumm*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Avenger. Mystic.*
- **Rules Text**:
  > **Response**: After Brother Voodoo enters play, search the top 5 cards of your deck for an event card and add it to your hand. Shuffle your deck.
- **Flavor**: *"My name is Jericho Drumm. They call me Brother Voodoo."*
- **Image Asset**: `assets/card-art/bundles/cards/09012.png` (300×419 px, 44.5 KB)

### [09013] Clea
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [physical]
- **Traits**: *Mystic.*
- **Rules Text**:
  > **Interrupt**: When Clea is defeated, shuffle her into her owner's deck.
- **Flavor**: *"I come from what you call the Dark Dimension. I don't frighten easily."*
- **Image Asset**: `assets/card-art/bundles/cards/09013.png` (300×419 px, 38.3 KB)

### [09014] Iron Fist — *Danny Rand*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Defender.*
- **Rules Text**:
  > Iron Fist enters play with 2 mystic counters on him.
  > **Interrupt**: When Iron Fist attacks an enemy, remove 1 mystic counter from him → stun that enemy and deal 1 damage to it.
- **Errata (FFG)**:
  > Changed “Response” to “Interrupt”. (RRG 1.4)
- **Image Asset**: `assets/card-art/bundles/cards/09014.png` (300×418 px, 236.5 KB)

### [09015] Desperate Defense
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When your hero defends against an attack, it gets +2 DEF for that attack. If you take no damage from that attack, ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/09015.png` (300×419 px, 41.2 KB)

### [09016] Momentum Shift
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Heal 2 damage from your hero → deal 2 damage to an enemy.
- **Flavor**: *"Have a seat!" —Colleen Wing*
- **Image Asset**: `assets/card-art/bundles/cards/09016.png` (300×419 px, 36.3 KB)

### [09017] The Power of Protection
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Protection *(green)* card.

### [09018] Med Team
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 medical counters). *(Enters play with 3 counters. When those are gone, discard this card.)*
  > **Action**: Exhaust Med Team and remove 1 medical counter from it → heal 2 damage from a friendly character.

### [09019] The Night Nurse
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > Uses (3 medical counters).
  > **Action**: Exhaust The Night Nurse and remove 1 medical counter from her → heal 1 damage from a hero and discard 1 status card from it.
- **Image Asset**: `assets/card-art/bundles/cards/09019.png` (300×418 px, 230.6 KB)

### [09020] Unflappable
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Response**: After you defend against an attack and take no damage, exhaust Unflappable → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/09020.png` (300×419 px, 36.8 KB)


### Set: Basic

### [09021] Warning
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Interrupt**: When a hero would take any amount of damage, reduce that amount by 1.
- **Errata (FFG)**:
  > Removed “(defense)” and the Defense trait. (RRG 1.4)
- **Flavor**: *"Incoming!" —Iron Man*
- **Image Asset**: `assets/card-art/bundles/cards/09021.png` (300×419 px, 28.3 KB)

### [09022] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [09023] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [09024] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [09025] Avengers Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Avengers Mansion → choose a player. That player draws 1 card.
- **Flavor**: *"Did you remember to turn off the stove?" —Janet Van Dyne*

### [09026] The Sorcerer Supreme
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 26
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Title.*
- **Rules Text**:
  > Play only if you have the [[Mystic]] trait.
  > You get +1 hand size while in hero form.
- **Flavor**: *"The mantle of Sorcerer Supreme was bestowed upon me by the Ancient One." —Stephen Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09026.png` (300×419 px, 42.7 KB)


### Set: Doctor Strange Nemesis

### [09028] Baron Mordo
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Doctor Strange Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Mystic.*
- **Rules Text**:
  > **Forced Interrupt**: When Baron Mordo attacks you, discard the top card of your deck. If that card's printed resource has:
  > [physical] - You are stunned.
  > [energy] - Take 2 damage.
  > [mental] - You are confused.
  > [wild] - All of the above.
- **Image Asset**: `assets/card-art/bundles/cards/09028.png` (300×418 px, 233.9 KB)

### [09029] Open the Dark Dimension
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange Nemesis (2/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Doctor Strange Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place the top card of the [[Invocation]] deck facedown under this scheme.
  > **When Defeated**: Shuffle the [[Invocation]] card under here into the [[Invocation]] deck.
- **Image Asset**: `assets/card-art/bundles/cards/09029.png` (419×300 px, 42.1 KB)

### [09030] Counterspell
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange Nemesis (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Doctor Strange Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition. Spell.*
- **Rules Text**:
  > Attach to your hero.
  > **Forced Interrupt**: When you play an event, cancel its effects and discard it. Then, discard this card.
- **Flavor**: *"I should have been made Sorcerer Supreme, Strange. Not you!" —Baron Mordo.*
- **Image Asset**: `assets/card-art/bundles/cards/09030.png` (300×419 px, 35.0 KB)

### [09031] Thoughtcasting
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Doctor Strange Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Doctor Strange Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard a card from your hand with the highest cost. Place threat on the main scheme equal to the printed cost of that card.
  > **When Revealed (Hero)**: Discard a card from your hand with the highest cost. Take damage equal to the printed cost of that card.
- **Image Asset**: `assets/card-art/bundles/cards/09031.png` (300×419 px, 39.8 KB)


### Set: Invocation

### [09032] Crimson Bands of Cyttorak
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Invocation (1/5)
- **Stats**: **Cost**: 2
- **Traits**: *Invocation.*
- **Rules Text**:
  > **Special**: Stun an enemy and deal 7 damage to it. Place this card in the [[Invocation]] deck discard pile.
- **Flavor**: *"That should hold him for a spell." —Doctor Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09032.png` (300×418 px, 207.4 KB)

### [09033] Images of Ikonn
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Invocation (2/5)
- **Stats**: **Cost**: 1
- **Traits**: *Invocation.*
- **Rules Text**:
  > **Special**: Confuse the villain and remove 4 threat from a scheme. Place this card in the [[Invocation]] deck discard pile.
- **Flavor**: *"You see only what I want you to see." —Doctor Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09033.png` (300×419 px, 42.2 KB)

### [09034] Seven Rings of Raggadorr
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Invocation (3/5)
- **Stats**: **Cost**: 1
- **Traits**: *Invocation.*
- **Rules Text**:
  > **Special**: Give up to 3 characters each a tough status card. Place this card in the [[Invocation]] deck discard pile.
- **Flavor**: *"Let the Rings of Raggadorr shield you from harm!" —Doctor Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09034.png` (300×419 px, 41.7 KB)

### [09035] Vapors of Valtorr
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Invocation (4/5)
- **Stats**: **Cost**: 0
- **Traits**: *Invocation.*
- **Rules Text**:
  > **Special**: Choose a status card in play. Replace that status card with a different status card. Place this card in the [[Invocation]] deck discard pile.
- **Flavor**: *"By the Vapors of Valtorr, be transformed!" —Doctor Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09035.png` (300×419 px, 38.0 KB)

### [09036] Winds of Watoomb
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Invocation (5/5)
- **Stats**: **Cost**: 0
- **Traits**: *Invocation.*
- **Rules Text**:
  > **Special**: Draw 3 cards. Place this card in the [[Invocation]] deck discard pile.
- **Flavor**: *"By the blessed Vishanti!" —Doctor Strange*
- **Image Asset**: `assets/card-art/bundles/cards/09036.png` (300×418 px, 225.1 KB)


### Set: Aggression

### [09037] Skilled Strike
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 37
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Interrupt**: When your hero makes a basic attack, it gets +2 ATK for that attack.
- **Flavor**: *"You have much to learn." —Karnak*
- **Image Asset**: `assets/card-art/bundles/cards/09037.png` (300×419 px, 34.2 KB)


### Set: Justice

### [09038] Foiled!
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 38
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Interrupt**: When a boost card is turned faceup during a scheme activation, cancel its boost icons.
- **Flavor**: *"Not this time, Kingpin!" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/09038.png` (300×419 px, 32.5 KB)


### Set: Leadership

### [09039] Iron Man — *Tony Stark*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Doctor Strange (`drs`)
- **Deck / Set**: Pack Position: 39
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Reduce the cost to play each upgrade on Iron Man by 1.
- **Flavor**: *"I've got an idea for how to make this suit even better."*
- **Image Asset**: `assets/card-art/bundles/cards/09039.png` (300×419 px, 37.2 KB)


