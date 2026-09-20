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
| `28001a` | Nova | Hero | Nova | THW:1 ATK:1 DEF:2 HP:10 | - | `nova` |
| `28001b` | Sam Alexander | Alter-Ego | Nova | REC:3 HP:10 | - | `nova` |
| `28002` | Ms. Marvel | Ally | Nova | THW:1 ATK:1 HP:3 | - | `nova` |
| `28003` | Forcefield Projection | Event | Nova | - | - | `nova` |
| `28004` | Lightspeed Flight | Event | Nova | - | - | `nova` |
| `28005` | Pot Shot | Event | Nova | - | - | `nova` |
| `28006` | Unleash Nova Force | Event | Nova | - | - | `nova` |
| `28007` | Connection to the Worldmind | Resource | Nova | - | - | `nova` |
| `28008` | Jesse Alexander | Support | Nova | - | - | `nova` |
| `28009` | Supernova Helmet | Upgrade | Nova | - | - | `nova` |
| `28010` | The Locust | Ally | Pack Position: 10 | THW:1 ATK:1 HP:2 | - | `nova` |
| `28011` | Chase Them Down | Event | Pack Position: 11 | - | - | `nova` |
| `28012` | Pitchback | Event | Pack Position: 12 | - | - | `nova` |
| `28013` | No Quarter | Event | Pack Position: 13 | - | - | `nova` |
| `28014` | One by One | Event | Pack Position: 14 | - | - | `nova` |
| `28015` | The Power of Aggression | Resource | Pack Position: 15 | - | - | `nova` |
| `28016` | Fluid Motion | Upgrade | Pack Position: 16 | - | - | `nova` |
| `28017` | Honed Technique | Upgrade | Pack Position: 17 | - | - | `nova` |
| `28018` | Moon Girl | Ally | Pack Position: 18 | THW:2 ATK:2 HP:3 | - | `nova` |
| `28019` | Everyday Hero | Resource | Pack Position: 19 | - | - | `nova` |
| `28020` | Champions Mobile Bunker | Support | Pack Position: 20 | - | - | `nova` |
| `28021` | Weight of the World | Obligation | Nova | - | 2 icons | `nova` |
| `28022` | "Bring the War!" | Side Scheme | Nova Nemesis | - | 2 icons | `nova` |
| `28023` | Warbringer | Minion | Nova Nemesis | SCH:1 ATK:3 HP:5 | 3 icons | `nova` |
| `28024` | War Delivery | Treachery | Nova Nemesis | - | 1 icon + star | `nova` |
| `28025` | "The War's Been Brought" | Treachery | Nova Nemesis | - | not recorded in this source | `nova` |
| `28026` | Yaw and Roll | Event | Pack Position: 26 | - | - | `nova` |
| `28027` | Height Advantage | Upgrade | Pack Position: 27 | - | - | `nova` |
| `28028` | Armored Assault | Side Scheme | Armadillo | - | 2 icons | `nova` |
| `28029` | Armadillo | Minion | Armadillo | SCH:1 ATK:2 HP:8 | 3 icons | `nova` |
| `28030` | Rollin', Rollin' | Attachment | Armadillo | ATK:2 | 2 icons | `nova` |
| `28031` | Tough and Tumble | Treachery | Armadillo | - | 1 icon | `nova` |
| `28032` | Tough It Out | Treachery | Armadillo | - | not recorded in this source | `nova` |

---

## Pack: Nova (`nova`)

### Set: Nova

### [28001a] Nova
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *Champion.*
- **Rules Text**:
  > **Response**: After you use one of Nova's basic powers (THW, ATK, or DEF), ready Supernova Helmet.
- **Flavor**: *"You guys haven't heard of Nova? I beat up the Hulk! I'm a double-secret probationary Avenger!"*
- **Image Asset**: `assets/card-art/bundles/cards/28001a.png` (350×488 px, 296.0 KB)

### [28001b] Sam Alexander
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > **Alter-Ego Action**: Spend 1 resource of any type → search your deck and discard pile for Supernova Helmet. Add it to your hand (put it into play instead if you paid for this ability using a [wild] resource).
- **Image Asset**: `assets/card-art/bundles/cards/28001b.png` (350×488 px, 286.9 KB)

### [28002] Ms. Marvel — *Kamala Khan*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Champion. Inhuman.*
- **Rules Text**:
  > **Hero Response**: After you play an event, exhaust Ms. Marvel and deal 1 damage to her → return that event to your hand from your discard pile.
- **Errata (FFG)**:
  > Added “from your discard pile”. (RRG 1.5)
- **Flavor**: *"I'll do what you ask. With honor, commitment, courage, and all that other stuff."*
- **Image Asset**: `assets/card-art/bundles/cards/28002.png` (710×1030 px, 410.7 KB)

### [28003] Forcefield Projection
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (2–3/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When a friendly character would take any amount of damage from an attack, prevent 3 of that damage. If you paid for this card using a [wild] resource, deal 3 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/28003.png` (710×1030 px, 373.6 KB)

### [28004] Lightspeed Flight
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (4–6/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > Double the number of [wild] resources generated while paying for this card.
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme.
- **Flavor**: *"Amazing. It's everything dad talked about. The speed. The power. It's like being a human rocket!" —Nova*
- **Image Asset**: `assets/card-art/bundles/cards/28004.png` (710×1030 px, 404.0 KB)

### [28005] Pot Shot
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (7–9/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > Double the number of [wild] resources generated while paying for this card.
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy.
- **Flavor**: *"That never gets old." —Nova*
- **Image Asset**: `assets/card-art/bundles/cards/28005.png` (710×1030 px, 392.0 KB)

### [28006] Unleash Nova Force
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (10–11/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Max 1 per round.
  > **Hero Action**: Until the end of the round, each time Nova defeats an enemy or removes the last threat from a scheme, ready Nova and draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/28006.png` (710×1030 px, 378.0 KB)

### [28007] Connection to the Worldmind
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (12–13/15, Qty: 2)
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Connection to the Worldmind does not count toward your hand size.
- **Image Asset**: `assets/card-art/bundles/cards/28007.png` (710×1030 px, 471.6 KB)

### [28008] Jesse Alexander
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (14/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Jesse Alexander → shuffle 1 copy of Connection to the Worldmind from your discard pile into your deck. Draw 1 card.
- **Flavor**: *"I wasn't always there, but I always believed in you."*
- **Image Asset**: `assets/card-art/bundles/cards/28008.png` (710×1030 px, 394.9 KB)

### [28009] Supernova Helmet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor.*
- **Rules Text**:
  > Nova gains the [[Aerial]] trait.
  > **Hero Resource**: Exhaust Supernova Helmet → generate a [wild] resource.
- **Flavor**: *"The helmet can hear what I'm thinking and that makes it do... stuff." —Sam Alexander*
- **Image Asset**: `assets/card-art/bundles/cards/28009.png` (710×1030 px, 379.9 KB)

### [28021] Weight of the World
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nova Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Give to the Sam Alexander player.**
  > While this card is in play, Supernova Helmet cannot ready.
  > **Alter-Ego Action**: Exhaust Sam Alexander → remove this obligation from the game.
- **Image Asset**: `assets/card-art/bundles/cards/28021.png` (710×1030 px, 328.9 KB)


### Set: Aggression

### [28010] The Locust — *Fernanda Rodriguez*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 10
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Champion.*
- **Rules Text**:
  > Play only if your identity has the [[champion]] trait.
  > **Hero Response**: After The Locust enters play, add 1 Aggression (red) event from your discard pile to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/28010.png` (710×1030 px, 380.7 KB)

### [28011] Chase Them Down
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 11
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Response** *(thwart)*: After your hero attacks and defeats an enemy, remove 2 threat from a scheme.
- **Flavor**: *"Kamala, we don't have a theme song. Please stop humming one..." —Captain Marvel*

### [28012] Pitchback
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 12
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Aerial. Attack.*
- **Rules Text**:
  > Play only if your identity has the [[Aerial]] trait.
  > **Hero Response** *(attack)*: After your hero attacks, deal 4 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/28012.png` (710×1030 px, 314.8 KB)

### [28013] No Quarter
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > Requirement ([physical]).
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. For each point of excess damage dealt to that enemy by this attack, discard the top card of your deck and add each Aggression (red) card discarded this way to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/28013.png` (710×1030 px, 388.7 KB)

### [28014] One by One
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to an enemy. If this attack defeats that enemy, deal 2 damage to an enemy.
- **Flavor**: *"Lots of tricks up these sleeves, ladies and gentlemen." —Moon Girl*
- **Image Asset**: `assets/card-art/bundles/cards/28014.png` (710×1030 px, 389.0 KB)

### [28015] The Power of Aggression
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Aggression *(red)* card.

### [28016] Fluid Motion
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Response**: After you play an [[Attack]] event, exhaust this card → your hero gets +1 ATK until the end of the phase. (Max 1 per [[Attack]] event.)
- **Image Asset**: `assets/card-art/bundles/cards/28016.png` (710×1030 px, 409.8 KB)

### [28017] Honed Technique
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > Requirement ([mental][mental]). Max 1 per player.
  > **Interrupt**: When you play an Aggression [[Attack]] event, if you paid for that event using a [mental] resource, increase the amount of damage that event deals by its printed cost.
- **Image Asset**: `assets/card-art/bundles/cards/28017.png` (710×1030 px, 369.2 KB)


### Set: Basic

### [28018] Moon Girl — *Lunella Lafayette*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 2), **HP**: 3, **Resources**: [mental]
- **Traits**: *Champion. Genius.*
- **Rules Text**:
  > Play only if your identity has the [[champion]] or [[genius]] trait.
  > **Response**: After you play Moon Girl from your hand, draw 1 card for each [mental] resource used to pay for her.
- **Image Asset**: `assets/card-art/bundles/cards/28018.png` (710×1030 px, 395.5 KB)

### [28019] Everyday Hero
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > While your identity has the [[Civilian]] trait, this card can be spent for any player and gains the text: "**Response**: After you spend this card for a player, heal 1 damage from that player's identity."
- **Image Asset**: `assets/card-art/bundles/cards/28019.png` (710×1030 px, 447.6 KB)

### [28020] Champions Mobile Bunker
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Champion. Vehicle.*
- **Rules Text**:
  > **Hero Action**: Exhaust Champions Mobile Bunker → choose an identity with the [[champion]] trait. The player who controls that identity may draw 2 cards, then discard 2 cards from their hand.
- **Image Asset**: `assets/card-art/bundles/cards/28020.png` (710×1030 px, 353.4 KB)


### Set: Nova Nemesis

### [28022] "Bring the War!"
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova Nemesis (1/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nova Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Image Asset**: `assets/card-art/bundles/cards/28022.png` (1030×710 px, 384.7 KB)

### [28023] Warbringer
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nova Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Chitauri.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Warbringer attacks you, he gets +1 ATK for that attack for each card with a printed [wild] resource in your hand. That attack gains overkill.
  > *(Nova's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/28023.png` (710×1030 px, 391.9 KB)

### [28024] War Delivery
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova Nemesis (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Nova Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You may spend a [wild] resource. If you do not, the villain and Warbringer each attack you *(even if you are in alter-ego form)*.
  >
  > ---
  >
  > [star] **Boost**: Place 1 threat on the main scheme for each card with a printed [wild] resource in your hand.
- **Image Asset**: `assets/card-art/bundles/cards/28024.png` (710×1030 px, 375.6 KB)

### [28025] "The War's Been Brought"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Nova Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Nova Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Discard X cards from the top of the encounter deck, where X is equal to the total number of printed [wild] resources on cards in your hand, cards under your control, and cards in your discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/28025.png` (710×1030 px, 428.7 KB)


### Set: Justice

### [28026] Yaw and Roll
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Aerial. Thwart.*
- **Rules Text**:
  > Play only if your identity has the [[Aerial]] trait.
  > **Hero Response** *(thwart)*: After your hero thwarts, remove 3 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/28026.png` (710×1030 px, 347.1 KB)


### Set: Protection

### [28027] Height Advantage
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Nova (`nova`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Aerial. Tactic.*
- **Rules Text**:
  > While your identity has the [[Aerial]] trait, reduce the amount of damage you take from each enemy attack by 1.
  > **Forced Interrupt**: When your turn begins, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/28027.png` (710×1030 px, 375.5 KB)


### Set: Armadillo

### [28028] Armored Assault
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Armadillo (1/6)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Armadillo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each enemy with a tough status card gets +3 ATK.
- **Flavor**: *Armadillo is barreling through the city, steamrolling everything in his path.*
- **Image Asset**: `assets/card-art/bundles/cards/28028.png` (1030×710 px, 350.6 KB)

### [28029] Armadillo
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Armadillo (2/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 2 [star], **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Armadillo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite.*
- **Rules Text**:
  > Toughness.
  > Armadillo can have any number of tough status cards.
  > [star] **Forced Response**: After Armadillo activates against you, give him a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/28029.png` (710×1030 px, 330.7 KB)

### [28030] Rollin', Rollin'
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Armadillo (3/6)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Armadillo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Armadillo. If Armadillo is not in play, search the encounter deck and discard pile for Armadillo, put him into play, engaged with you, and attach this card to him. *(Shuffle.)*
  > [star] While Armadillo has a tough status card, characters cannot defend against his attacks.
- **Image Asset**: `assets/card-art/bundles/cards/28030.png` (710×1030 px, 399.1 KB)

### [28031] Tough and Tumble
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Armadillo (4/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Armadillo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Each enemy with a tough status card schemes. If no enemy activated this way, this card gains surge.
  > **When Revealed (Hero)**:  Each enemy with a tough status card attacks you. If no enemy activated this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/28031.png` (710×1030 px, 398.1 KB)

### [28032] Tough It Out
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Nova (`nova`)
- **Deck / Set**: Armadillo (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Armadillo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give Armadillo and the villain each a tough status card. If 1 or fewer tough status cards were given this way, this card gains surge.
- **Flavor**: *"Don't hit too hard. Might break your hand." —Armadillo*
- **Image Asset**: `assets/card-art/bundles/cards/28032.png` (710×1030 px, 383.3 KB)


