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
| `23001a` | War Machine | Hero | War Machine | THW:1 ATK:2 DEF:2 HP:10 | - | `warm` |
| `23001b` | James Rhodes | Alter-Ego | War Machine | REC:3 HP:10 | - | `warm` |
| `23002` | Iron Man | Ally | War Machine | THW:2 ATK:2 HP:3 | - | `warm` |
| `23003` | Munitions Bunker | Support | War Machine | - | - | `warm` |
| `23004` | Upgraded Chassis | Upgrade | War Machine | - | - | `warm` |
| `23005` | Gauntlet Gun | Upgrade | War Machine | - | - | `warm` |
| `23006` | Missile Launcher | Upgrade | War Machine | - | - | `warm` |
| `23007` | Shoulder Cannon | Upgrade | War Machine | - | - | `warm` |
| `23008` | Repulsor Beam | Event | War Machine | - | - | `warm` |
| `23009` | Targeted Strike | Event | War Machine | - | - | `warm` |
| `23010` | Scorched Earth | Event | War Machine | - | - | `warm` |
| `23011` | Full Auto | Event | War Machine | - | - | `warm` |
| `23012` | Black Panther | Ally | Pack Position: 12 | THW:2 ATK:2 HP:4 | - | `warm` |
| `23013` | Captain Marvel | Ally | Pack Position: 13 | THW:2 ATK:3 HP:4 | - | `warm` |
| `23014` | Falcon | Ally | Pack Position: 14 | THW:2 ATK:2 HP:3 | - | `warm` |
| `23015` | Goliath | Ally | Pack Position: 15 | THW:2 ATK:1 HP:4 | - | `warm` |
| `23016` | Command Team | Support | Pack Position: 16 | - | - | `warm` |
| `23017` | Sneak Attack | Event | Pack Position: 17 | - | - | `warm` |
| `23018` | Save the Day | Event | Pack Position: 18 | - | - | `warm` |
| `23019` | Go Down Swinging | Event | Pack Position: 19 | - | - | `warm` |
| `23020` | Make the Call | Event | Pack Position: 20 | - | - | `warm` |
| `23021` | Innovation | Resource | Pack Position: 21 | - | - | `warm` |
| `23022` | Mockingbird | Ally | Pack Position: 22 | THW:1 ATK:1 HP:3 | - | `warm` |
| `23023` | Quincarrier | Support | Pack Position: 23 | - | - | `warm` |
| `23024` | Two Against the World | Event | Pack Position: 24 | - | - | `warm` |
| `23025` | Energy | Resource | Pack Position: 25 | - | - | `warm` |
| `23026` | Genius | Resource | Pack Position: 26 | - | - | `warm` |
| `23027` | Strength | Resource | Pack Position: 27 | - | - | `warm` |
| `23028` | Equipment Malfunction | Obligation | War Machine | - | 2 icons | `warm` |
| `23029` | Living Laser | Minion | War Machine Nemesis | SCH:1 ATK:2 HP:4 | 2 icons | `warm` |
| `23030` | Deadly Light Show | Side Scheme | War Machine Nemesis | - | 3 icons | `warm` |
| `23031` | Laser Strike | Treachery | War Machine Nemesis | - | 1 icon + star | `warm` |
| `23032` | As One! | Event | Pack Position: 32 | - | - | `warm` |
| `23033` | Vigilante Training | Support | Pack Position: 33 | - | - | `warm` |
| `23034` | Stand Together | Event | Pack Position: 34 | - | - | `warm` |
| `23035` | Sidearm | Upgrade | Pack Position: 35 | - | - | `warm` |

---

## Pack: War Machine (`warm`)

### Set: War Machine

### [23001a] War Machine
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *Avenger. Soldier.*
- **Rules Text**:
  > *Locked and Loaded* - **Response**: After you change to this form, place 5 ammo counters on War Machine.
- **Flavor**: *"Boom! Looking for this?" —James Rhodes*
- **Image Asset**: `assets/card-art/bundles/cards/23001a.png` (300×418 px, 210.3 KB)

### [23001b] James Rhodes
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > **Action**: Choose a War Machine card in your discard pile and shuffle it into your deck. (Limit once per phase.)
  > **Forced Response**: After you change to this form, discard each ammo counter from your identity.
- **Errata (FFG)**:
  > Added “(Limit once per phase.)” (RRG 1.5)
- **Image Asset**: `assets/card-art/bundles/cards/23001b.png` (300×418 px, 201.9 KB)

### [23002] Iron Man — *Tony Stark*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response:** After Iron Man enters play, search your deck and discard pile for a [[tech]] upgrade and add it to your hand. Shuffle your deck.
- **Flavor**: *"What did you do to my suit, Rhodey?"*
- **Image Asset**: `assets/card-art/bundles/cards/23002.png` (872×1248 px, 335.6 KB)

### [23003] Munitions Bunker
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (2/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Munitions Bunker → Place 2 ammo counters here.
  > **Hero Action**: Exhaust Munitions Bunker → move each ammo counter here to War Machine.
- **Image Asset**: `assets/card-art/bundles/cards/23003.png` (869×1247 px, 361.3 KB)

### [23004] Upgraded Chassis
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (3/15)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > War Machine gains the [[aerial]] trait.
  > **Hero Response**: After you change to hero form, exhaust Upgraded Chassis → give War Machine a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/23004.png` (867×1249 px, 372.1 KB)

### [23005] Gauntlet Gun
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (4–5/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > **Resource**: Exhaust Gauntlet Gun → generate a [wild] resource for a War Machine event and place 1 ammo counter on War Machine.
- **Flavor**: *"Time to see what these babies can do." —James Rhodes*
- **Image Asset**: `assets/card-art/bundles/cards/23005.png` (869×1247 px, 359.0 KB)

### [23006] Missile Launcher
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (6/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust Missile Launcher and remove 1 ammo counter from War Machine → deal 2 damage to an enemy. This attack gains ranged.
- **Image Asset**: `assets/card-art/bundles/cards/23006.png` (876×1248 px, 334.4 KB)

### [23007] Shoulder Cannon
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (7/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust Shoulder Cannon → deal 1 damage to an enemy. You may remove 1 ammo from War Machine to ready shoulder cannon.
- **Flavor**: *RATATATATAT!*
- **Image Asset**: `assets/card-art/bundles/cards/23007.png` (867×1248 px, 346.5 KB)

### [23008] Repulsor Beam
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (8–9/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Remove 1 ammo counter from War Machine → deal 4 damage to an enemy.
- **Flavor**: *"Oh, you want some too?" —James Rhodes*
- **Image Asset**: `assets/card-art/bundles/cards/23008.png` (873×1248 px, 319.5 KB)

### [23009] Targeted Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (10–11/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 1 ammo counter from War Machine → remove 3 threat from a scheme.
- **Flavor**: *"This is the part where you surrender!" —James Rhodes*
- **Image Asset**: `assets/card-art/bundles/cards/23009.png` (872×1248 px, 296.4 KB)

### [23010] Scorched Earth
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (12–13/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Remove 3 ammo counters from War Machine → deal 3 damage to each enemy in play.
- **Flavor**: *"I say we lift off and strafe the site from the air. It's the only way to be sure." —James Rhodes*
- **Image Asset**: `assets/card-art/bundles/cards/23010.png` (869×1248 px, 338.0 KB)

### [23011] Full Auto
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (14–15/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Remove 4 ammo counters from War Machine and choose an enemy → deal 8 damage to that enemy. This attack gains overkill.
- **Flavor**: *"Hey, Tony! Let me see your Mark V do this!" —James Rhodes*
- **Image Asset**: `assets/card-art/bundles/cards/23011.png` (870×1248 px, 352.9 KB)

### [23028] Equipment Malfunction
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: War Machine Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the James Rhodes player.***
  > You may flip to your alter-ego form. Choose:
  > • Exhaust James Rhodes → remove Equipment Malfunction from the game.
  > • Remove all ammo counters from your identity. If 2 or fewer ammo counters were removed this way, this card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/23028.png` (905×1304 px, 365.2 KB)


### Set: Leadership

### [23012] Black Panther — *T'Challa*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 2), **HP**: 4, **Resources**: [mental]
- **Traits**: *Avenger. Wakanda.*
- **Rules Text**:
  > You may play the event attached to Black Panther as if it were in your hand.
  > **Response:** After Black Panther enters play, choose a leadership (blue) event in your discard pile and attach it to him facedown.
- **Image Asset**: `assets/card-art/bundles/cards/23012.png` (867×1247 px, 324.1 KB)

### [23013] Captain Marvel — *Carol Danvers*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 4, **Resources**: [energy]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Response:** After Captain Marvel enters play, discard the top 4 cards of your deck. If you discard a printed [energy] resource, deal 3 damage to an enemy. If you discard more than one printed [energy] resource, also stun that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/23013.png` (882×1247 px, 340.7 KB)

### [23014] Falcon — *Sam Wilson*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Response**: After Falcon enters play, look at the top 3 cards of the encounter deck. For each treachery looked at this way, remove 1 threat from a scheme.

### [23015] Goliath — *Bill Foster*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 2), **HP**: 4, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Action**: Goliath gets +4 ATK until the end of the phase. At the end of the phase, discard Goliath. (Max once per phase.)
- **Flavor**: *"Sometimes being a gentleman means holding the door, and the rest of the building."*

### [23016] Command Team
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 command counters).
  > **Action**: Exhaust Command Team and remove 1 command counter from it → ready an ally.
- **Image Asset**: `assets/card-art/bundles/cards/23016.png` (867×1249 px, 313.5 KB)

### [23017] Sneak Attack
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Action**: Choose an ally in your hand that shares a [[trait]] with your identity → put that ally into play. If that ally is still in play at the end of the phase, discard it.
- **Flavor**: *"Surprise!" —Star-Lord*
- **Image Asset**: `assets/card-art/bundles/cards/23017.png` (863×1247 px, 333.7 KB)

### [23018] Save the Day
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Discard an ally your control → remove threat from a scheme equal to that ally's printed cost.
- **Flavor**: *"There are days, and boy, is this ever one of those days!" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/23018.png` (864×1248 px, 327.7 KB)

### [23019] Go Down Swinging
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Discard an ally your control → deal damage to an enemy equal to that ally's printed cost.
- **Flavor**: *"Spider-Man's banter can get on your nerves, but I tell you what - that kid never quits." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/23019.png` (861×1247 px, 301.8 KB)

### [23020] Make the Call
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Pay the printed cost of an ally in any player's discard pile → put that ally into play under your control.
- **Flavor**: *"This is a code red! All hands on deck!" —Maria Hill*

### [23021] Innovation
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, heal 1 damage from an ally you control.


### Set: Basic

### [23022] Mockingbird — *Bobbi Morse*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Response**: After Mockingbird enters play, stun an enemy.

### [23023] Quincarrier
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Avenger. Vehicle.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > **Resource**: Exhaust Quincarrier → generate a [wild] resource.
- **Flavor**: *"Too bad we could only get one of these." —Hawkeye*

### [23024] Two Against the World
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Rules Text**:
  > Team-Up (Iron Man and War Machine). Max 1 per deck.
  > **Hero Action**: Search your deck for a [[tech]] upgrade and put it into play. Shuffle your deck. Ready Iron Man and War Machine.
- **Image Asset**: `assets/card-art/bundles/cards/23024.png` (867×1247 px, 341.1 KB)

### [23025] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [23026] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [23027] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [23035] Sidearm
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 35
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to an ally. Max 1 per ally.
  > Attached ally gets +1 ATK and its attacks gain ranged.
- **Flavor**: *"Wow! Cool costume, mister!" —Kid*
- **Image Asset**: `assets/card-art/bundles/cards/23035.png` (873×1248 px, 339.6 KB)


### Set: War Machine Nemesis

### [23029] Living Laser
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: War Machine Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Quickstrike.
  > [star] Living Laser's attacks gain piercing.
  > *(War Machine's nemesis minion.)*
- **Flavor**: *"You and Stark - you both have it coming!"*
- **Image Asset**: `assets/card-art/bundles/cards/23029.png` (866×1248 px, 295.5 KB)

### [23030] Deadly Light Show
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine Nemesis (2/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: War Machine Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1 [per_hero]
  > **When Defeated:** Deal 1 damage to each identity.
- **Flavor**: ***Living Laser is attacking a government office. The employees inside need help!***
- **Image Asset**: `assets/card-art/bundles/cards/23030.png` (1798×1248 px, 672.2 KB)

### [23031] Laser Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: War Machine (`warm`)
- **Deck / Set**: War Machine Nemesis (3–5/5, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: War Machine Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard an upgrade you control. If you cannot, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If this resolves during an undefended attack, discard an upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/23031.png` (872×1248 px, 324.1 KB)


### Set: Aggression

### [23032] As One!
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > Alliance.
  > **Hero Action** *(attack)*: Exhaust an [[avenger]] character and a [[guardian]] character → deal X damage to an enemy, where X is the combined ATK of those characters. This attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/23032.png` (867×1247 px, 320.1 KB)


### Set: Justice

### [23033] Vigilante Training
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Max 2 per deck. Uses (2 training counters).
  > **Alter-Ego Action**: Exhaust this card and remove 1 training counter from it → choose a justice (yellow) event in your discard pile and shuffle it into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/23033.png` (861×1247 px, 297.2 KB)


### Set: Protection

### [23034] Stand Together
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: War Machine (`warm`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 4, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Alliance.
  > **Hero Interrupt**: When a friendly character would take any amount of damage from an attack, exhaust an [[avenger]] character and a [[guardian]] character → prevent all of that damage. Deal that much damage to the attacking enemy.
- **Image Asset**: `assets/card-art/bundles/cards/23034.png` (866×1248 px, 328.6 KB)


