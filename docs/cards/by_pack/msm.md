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
| `05001a` | Ms. Marvel | Hero | Ms. Marvel | THW:1 ATK:1 DEF:1 HP:10 | - | `msm` |
| `05001b` | Kamala Khan | Alter-Ego | Ms. Marvel | REC:5 HP:10 | - | `msm` |
| `05002` | Red Dagger | Ally | Ms. Marvel | THW:2 ATK:2 HP:3 | - | `msm` |
| `05003` | Big Hands | Event | Ms. Marvel | - | - | `msm` |
| `05004` | Sneak By | Event | Ms. Marvel | - | - | `msm` |
| `05005` | Wiggle Room | Event | Ms. Marvel | - | - | `msm` |
| `05006` | Aamir Khan | Support | Ms. Marvel | - | - | `msm` |
| `05007` | Bruno Carrelli | Support | Ms. Marvel | - | - | `msm` |
| `05008` | Nakia Bahadir | Support | Ms. Marvel | - | - | `msm` |
| `05009` | Biokinetic Polymer Suit | Upgrade | Ms. Marvel | - | - | `msm` |
| `05010` | Embiggen! | Upgrade | Ms. Marvel | - | - | `msm` |
| `05011` | Shrink | Upgrade | Ms. Marvel | - | - | `msm` |
| `05012` | Nova | Ally | Pack Position: 12 | THW:1 ATK:2 HP:3 | - | `msm` |
| `05013` | Get Behind Me! | Event | Pack Position: 13 | - | - | `msm` |
| `05014` | Preemptive Strike | Event | Pack Position: 14 | THW:1 ATK:3 | - | `msm` |
| `05015` | Tackle | Event | Pack Position: 15 | - | - | `msm` |
| `05016` | The Power of Protection | Resource | Pack Position: 16 | - | - | `msm` |
| `05017` | Energy Barrier | Upgrade | Pack Position: 17 | - | - | `msm` |
| `05018` | Lockjaw | Ally | Pack Position: 18 | THW:2 ATK:2 HP:4 | - | `msm` |
| `05019` | Energy | Resource | Pack Position: 19 | - | - | `msm` |
| `05020` | Genius | Resource | Pack Position: 20 | - | - | `msm` |
| `05021` | Strength | Resource | Pack Position: 21 | - | - | `msm` |
| `05022` | Avengers Mansion | Support | Pack Position: 22 | - | - | `msm` |
| `05023` | Endurance | Upgrade | Pack Position: 23 | - | - | `msm` |
| `05024` | Enhanced Reflexes | Upgrade | Pack Position: 24 | - | - | `msm` |
| `05025` | Home by Dawn | Obligation | Ms. Marvel | - | 2 icons | `msm` |
| `05026` | Generation Why? | Side Scheme | Ms. Marvel Nemesis | - | 3 icons | `msm` |
| `05027` | Thomas Edison | Minion | Ms. Marvel Nemesis | SCH:3 ATK:1 HP:3 | 2 icons | `msm` |
| `05028` | Edison's Giant Robot | Minion | Ms. Marvel Nemesis | SCH:1 ATK:2 HP:8 | 1 icon | `msm` |
| `05029` | Harvest | Treachery | Ms. Marvel Nemesis | - | not recorded in this source | `msm` |
| `05030` | Melee | Event | Pack Position: 30 | - | - | `msm` |
| `05031` | Concussive Blow | Event | Pack Position: 31 | - | - | `msm` |
| `05032` | Morale Boost | Event | Pack Position: 32 | - | - | `msm` |
| `05033` | Down Time | Upgrade | Pack Position: 33 | - | - | `msm` |

---

## Pack: Ms. Marvel (`msm`)

### Set: Ms. Marvel

### [05001a] Ms. Marvel
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 1, **HP**: 10, **Hand Size**: 5
- **Traits**: *Champion. Inhuman.*
- **Rules Text**:
  > "Morphogenetics" — **Response**: After you play an [[Attack]], [[Thwart]], or [[Defense]] event, exhaust Ms. Marvel → return that event to your hand.
- **Flavor**: *"You can call me Ms. Marvel. And if you cooperate, I won't throw you again."*
- **Image Asset**: `assets/card-art/bundles/cards/05001a.png` (300×419 px, 44.7 KB)

### [05001b] Kamala Khan
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 5, **HP**: 10, **Hand Size**: 6
- **Traits**: *Inhuman.*
- **Rules Text**:
  > Teen Spirit — **Action**: Discard cards from the top of your deck until you discard a Ms. Marvel card, then add that card to your hand. (Limit once per round.)
- **Flavor**: *"I want to be beautiful and awesome and butt-kicking and less complicated"*
- **Image Asset**: `assets/card-art/bundles/cards/05001b.png` (300×419 px, 44.6 KB)

### [05002] Red Dagger
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Champion.*
- **Rules Text**:
  > **Interrupt**: When Red Dagger is defeated, spend 2 resources of different types → deal 2 damage to an enemy and return Red Dagger to your hand.
- **Flavor**: *"Karachi is my home. I patrol these neighborhoods."*
- **Image Asset**: `assets/card-art/bundles/cards/05002.png` (300×419 px, 43.9 KB)

### [05003] Big Hands
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (2–4/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy.
- **Flavor**: *"This hand thing... is getting out of hand..." —Ms. Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/05003.png` (300×419 px, 34.3 KB)

### [05004] Sneak By
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (5–7/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme.
- **Flavor**: *"This is my whole life in one garbage metaphor." —Kamala Khan*
- **Image Asset**: `assets/card-art/bundles/cards/05004.png` (300×419 px, 36.2 KB)

### [05005] Wiggle Room
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (8–9/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Defense. Superpower.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you would take any amount of damage, prevent 3 of that damage. Draw 1 card.
- **Flavor**: *"Since we're just getting to know each other, a little FYI: I don't like being taken by surprise!" —Ms. Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/05005.png` (300×419 px, 40.1 KB)

### [05006] Aamir Khan
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Aamir Khan → place 1 card from your discard pile on the bottom of your deck, then draw 1 card.
- **Flavor**: *"Are you okay? I mean, aside from being in the worst trouble of your life?"*
- **Image Asset**: `assets/card-art/bundles/cards/05006.png` (300×419 px, 38.1 KB)

### [05007] Bruno Carrelli
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Bruno Carrelli → attach 1 card from your hand facedown here.
  > **Action**: Exhaust Bruno Carrelli → add up to 3 cards attached here to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/05007.png` (300×419 px, 44.0 KB)

### [05008] Nakia Bahadir
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (12/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Nakia Bahadir → reduce the cost of the next card you play this phase by 1.
- **Flavor**: *"You're too sweet, squishy muffin. You give people way too much credit." —Nakia Bahadir*
- **Image Asset**: `assets/card-art/bundles/cards/05008.png` (300×419 px, 44.8 KB)

### [05009] Biokinetic Polymer Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor.*
- **Rules Text**:
  > **Hero Resource**: Exhaust Biokinetic Polymer Suit → generate a [wild] resource for an event.
- **Flavor**: *"What about that polymer you were working on for the scholarship? The super snot?" —Kamala Khan*
- **Image Asset**: `assets/card-art/bundles/cards/05009.png` (300×419 px, 39.7 KB)

### [05010] Embiggen!
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (14/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Condition. Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When you play an [[Attack]] event, exhaust Embiggen! → increase the amount of damage that event deals by 2.
- **Flavor**: *"EMBIGGEN!" —Ms. Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/05010.png` (300×419 px, 40.6 KB)

### [05011] Shrink
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (15/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Condition. Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When you play a [[Thwart]] event, exhaust Shrink → increase the amount of threat that event removes by 2.
- **Flavor**: *"Shrink, shrink, shrink!" —Ms. Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/05011.png` (300×419 px, 38.5 KB)

### [05025] Home by Dawn
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ms. Marvel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > ***Give to the Kamala Khan player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Kamala Khan → remove Home by Dawn from the game.
  > • Discard 1 [[Persona]] support you control. If no support was discarded this way, this card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/05025.png` (300×419 px, 42.3 KB)


### Set: Protection

### [05012] Nova — *Sam Alexander*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Champion.*
- **Rules Text**:
  > **Interrupt**: When an enemy initiates an attack against you, spend a [energy] resource → deal 2 damage to that enemy.
- **Flavor**: *"I guess mom was wrong. All those years of playing video games did pay off!"*
- **Image Asset**: `assets/card-art/bundles/cards/05012.png` (300×419 px, 39.2 KB)

### [05013] Get Behind Me!
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Interrupt**: When a treachery card is revealed from the encounter deck, cancel its "**When Revealed**" effects. The villain attacks you instead.
- **Flavor**: *"Ahem! Stand aside, citizens!" —Ms. Marvel*

### [05014] Preemptive Strike
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 1, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 1), **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When a boost card is turned face up while the villain attacks, cancel all boost icons ([boost]) on that card. Then deal 1 damage to the villain for each boost icon cancelled this way.
- **Image Asset**: `assets/card-art/bundles/cards/05014.png` (300×419 px, 40.0 KB)

### [05015] Tackle
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Stun an enemy. If you paid for this card using a [physical] resource, deal 3 damage to that enemy.
- **Flavor**: *That's gonna hurt in the morning.*
- **Image Asset**: `assets/card-art/bundles/cards/05015.png` (300×419 px, 37.4 KB)

### [05016] The Power of Protection
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Protection *(green)* card.

### [05017] Energy Barrier
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Uses (3 reflection counters). **Interrupt:** When you would take any amount of damage, remove 1 reflection counter from here → prevent 1 of that damage and deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/05017.png` (300×419 px, 37.8 KB)


### Set: Basic

### [05018] Lockjaw
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 2), **HP**: 4, **Resources**: [physical]
- **Traits**: *Inhuman.*
- **Rules Text**:
  > You may play Lockjaw from your discard pile during your turn (paying his resource cost).
- **Flavor**: *"Uhhh... hold on, Bruno. I think my new dog just teleported into my room." —Kamala Khan*
- **Image Asset**: `assets/card-art/bundles/cards/05018.png` (300×419 px, 37.5 KB)

### [05019] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [05020] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [05021] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [05022] Avengers Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Avengers Mansion → choose a player. That player draws 1 card.
- **Flavor**: *"Did you remember to turn off the stove?" —Janet Van Dyne*

### [05023] Endurance
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > You get +3 hit points.
- **Image Asset**: `assets/card-art/bundles/cards/05023.png` (300×419 px, 37.4 KB)

### [05024] Enhanced Reflexes
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Uses (3 energy counters). **Hero Resource:** Exhaust Enhanced Reflexes and remove 1 energy counter from it → generate a [energy] resource.
- **Image Asset**: `assets/card-art/bundles/cards/05024.png` (300×419 px, 37.6 KB)

### [05033] Down Time
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your alter-ego gets +2 REC.
- **Flavor**: *"We should do this more often."*
- **Image Asset**: `assets/card-art/bundles/cards/05033.png` (300×419 px, 34.6 KB)


### Set: Ms. Marvel Nemesis

### [05026] Generation Why?
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel Nemesis (1/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ms. Marvel Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Discard the top card of each player's deck for each ally and [[Persona]] support in play.
- **Flavor**: *The Inventor has convinced the youth of Jersey City that they should serve as human batteries for his experiments*
- **Image Asset**: `assets/card-art/bundles/cards/05026.png` (300×419 px, 36.8 KB)

### [05027] Thomas Edison
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ms. Marvel Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Bird. Genius.*
- **Rules Text**:
  > Thomas Edison cannot take damage while you are engaged with another minion.
  > *(Ms. Marvel's nemesis minion.)*
- **Flavor**: *"I AM NOT A BIRD!"*
- **Image Asset**: `assets/card-art/bundles/cards/05027.png` (300×419 px, 38.3 KB)

### [05028] Edison's Giant Robot
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel Nemesis (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ms. Marvel Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Robot.*
- **Rules Text**:
  > Edison's Giant Robot cannot take damage.
  > **Hero Action:** Spend a [mental] resource → until the end of the phase, treat this card's printed text box as if it were blank.
- **Image Asset**: `assets/card-art/bundles/cards/05028.png` (300×419 px, 39.5 KB)

### [05029] Harvest
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Ms. Marvel Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Ms. Marvel Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Exhaust each [[Persona]] support in play. For each support exhaust this way, the villain heals 1 damage. If no [[Persona]] support was exhausted this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/05029.png` (300×419 px, 39.0 KB)


### Set: Aggression

### [05030] Melee
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. Deal 3 damage to another enemy.
- **Image Asset**: `assets/card-art/bundles/cards/05030.png` (300×419 px, 34.5 KB)


### Set: Justice

### [05031] Concussive Blow
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Confuse an enemy. If you paid for this card using a [physical] resource, deal 3 damage to that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/05031.png` (300×419 px, 32.9 KB)


### Set: Leadership

### [05032] Morale Boost
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Ms. Marvel (`msm`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > **Hero Action**: Choose a hero. Until the end of the round, that hero gets +1 THW, +1 ATK, and +1 DEF
- **Flavor**: *"This is a stand I need to take. This time, no compromises." —Sam Wilson*
- **Image Asset**: `assets/card-art/bundles/cards/05032.png` (300×419 px, 34.3 KB)


