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
| `29001a` | Ironheart | Hero | Ironheart | THW:1 ATK:2 DEF:3 HP:10 | - | `ironheart` |
| `29001b` | Riri Williams | Alter-Ego | Ironheart | REC:3 HP:10 | - | `ironheart` |
| `29002a` | Ironheart | Hero | Ironheart | THW:2 ATK:2 DEF:3 HP:10 | - | `ironheart` |
| `29002b` | Riri Williams | Alter-Ego | Ironheart | REC:3 HP:10 | - | `ironheart` |
| `29003a` | Ironheart | Hero | Ironheart | THW:3 ATK:2 DEF:3 HP:10 | - | `ironheart` |
| `29003b` | Riri Williams | Alter-Ego | Ironheart | REC:3 HP:10 | - | `ironheart` |
| `29004` | Brawn | Ally | Ironheart | THW:2 ATK:3 HP:3 | - | `ironheart` |
| `29005` | Fly Over | Event | Ironheart | - | - | `ironheart` |
| `29006` | Photon Beam | Event | Ironheart | - | - | `ironheart` |
| `29007` | New and Improved | Event | Ironheart | - | - | `ironheart` |
| `29008` | Sector Scan | Event | Ironheart | - | - | `ironheart` |
| `29009` | Stroke of Genius | Resource | Ironheart | - | - | `ironheart` |
| `29010` | Ronnie Williams | Support | Ironheart | - | - | `ironheart` |
| `29011` | Tony Stark A.I. | Support | Ironheart | - | - | `ironheart` |
| `29012` | Photon Blasters | Upgrade | Ironheart | - | - | `ironheart` |
| `29013` | Propulsion Jets | Upgrade | Ironheart | - | - | `ironheart` |
| `29014` | Cloud 9 | Ally | Pack Position: 14 | THW:1 ATK:1 HP:3 | - | `ironheart` |
| `29015` | Falcon | Ally | Pack Position: 15 | THW:1 ATK:2 HP:3 | - | `ironheart` |
| `29016` | Patriot | Ally | Pack Position: 16 | THW:2 ATK:1 HP:4 | - | `ironheart` |
| `29017` | Go All Out | Event | Pack Position: 17 | - | - | `ironheart` |
| `29018` | Push Ahead | Event | Pack Position: 18 | - | - | `ironheart` |
| `29019` | Morale Boost | Event | Pack Position: 19 | - | - | `ironheart` |
| `29020` | R&D Facility | Support | Pack Position: 20 | - | - | `ironheart` |
| `29021` | The Power of Leadership | Resource | Pack Position: 21 | - | - | `ironheart` |
| `29022` | Agent 13 | Ally | Pack Position: 22 | THW:2 ATK:1 HP:4 | - | `ironheart` |
| `29023` | Snowguard | Ally | Pack Position: 23 | THW:0 ATK:0 HP:3 | - | `ironheart` |
| `29024` | Vivian | Ally | Pack Position: 24 | THW:2 ATK:1 HP:2 | - | `ironheart` |
| `29025` | "Go for Champions!" | Event | Pack Position: 25 | - | - | `ironheart` |
| `29026` | Helicarrier | Support | Pack Position: 26 | - | - | `ironheart` |
| `29027` | Ingenuity | Upgrade | Pack Position: 27 | - | - | `ironheart` |
| `29028` | A Minor Setback | Obligation | Ironheart | - | 2 icons | `ironheart` |
| `29029` | Rule by Force | Side Scheme | Ironheart Nemesis | - | 2 icons | `ironheart` |
| `29030` | Lucia von Bardas | Minion | Ironheart Nemesis | SCH:2 ATK:1 HP:4 | 3 icons | `ironheart` |
| `29031` | Cyborg Tech | Attachment | Ironheart Nemesis | - | 0 icons + star | `ironheart` |
| `29032` | Political Retribution | Treachery | Ironheart Nemesis | - | 1 icon | `ironheart` |
| `29033` | Bombshell | Ally | Pack Position: 33 | THW:2 ATK:3 HP:3 | - | `ironheart` |
| `29034` | Wasp | Ally | Pack Position: 34 | THW:2 ATK:1 HP:3 | - | `ironheart` |
| `29035` | Pinpoint | Ally | Pack Position: 35 | THW:1 ATK:2 HP:2 | - | `ironheart` |
| `29036` | Feedback Loop | Side Scheme | Zzzax | - | 3 icons | `ironheart` |
| `29037` | Zzzax | Minion | Zzzax | SCH:2 ATK:2 HP:4 | 0 icons + star | `ironheart` |
| `29038` | Haywire | Attachment | Zzzax | - | 1 icon | `ironheart` |
| `29039` | Air Static | Environment | Zzzax | - | 2 icons | `ironheart` |
| `29040` | Zzzap! | Treachery | Zzzax | - | 1 icon | `ironheart` |

---

## Pack: Ironheart (`ironheart`)

### Set: Ironheart

### [29001a] Ironheart
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (Identity Card)
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 3, **HP**: 10, **Hand Size**: 4
- **Traits**: *Champion. Version 1.*
- **Rules Text**:
  > *Level Up!* — **Action**: Remove 6 progress counters from Ironheart → ready her and swap her with [[Version 2]] Ironheart.
- **Flavor**: *"Time to try this untested bit of business..."*
- **Image Asset**: `assets/card-art/bundles/cards/29001a.png` (300×418 px, 195.0 KB)

### [29001b] Riri Williams
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Genius.*
- **Rules Text**:
  > Begin the game with this card. Set your other identities aside. *(See insert.)*
  > *Child Prodigy* — **Action**: Spend a [mental] resource → place 1 progress counter on Riri Williams. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/29001b.png` (300×418 px, 198.4 KB)

### [29002a] Ironheart
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 3, **HP**: 10, **Hand Size**: 5
- **Traits**: *Aerial. Champion. Version 2.*
- **Rules Text**:
  > *Level Up!* — **Action**: Remove 6 progress counters from Ironheart → ready her, give her a tough status card, and swap her with [[Version 3]] Ironheart.
- **Flavor**: *"It's Ironheart, bro."*

### [29002b] Riri Williams
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Genius.*
- **Rules Text**:
  > *Child Prodigy* — **Action**: Spend a [mental] resource or 2 resources of any type → place 1 progress counter on Riri Williams. (Limit once per round.)
- **Flavor**: *"Just let me finish this up, then I'll eat and frolic and do whatever."*

### [29003a] Ironheart
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 3, **ATK**: 2, **DEF**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Aerial. Champion. Version 3.*
- **Rules Text**:
  > *Maximum Efficiency* — **Hero Action**: Remove 1 progress counter from Ironheart → deal 2 damage to an enemy.
- **Flavor**: *"Oh, you wanna play, villain person? Let's play."*

### [29003b] Riri Williams
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Genius.*
- **Rules Text**:
  > *Child Prodigy* — **Action**: Spend 1 resource of any type → place 1 progress counter on Riri Williams. (Limit once per round.)
- **Flavor**: *"I can build something lighter, faster, stronger."*

### [29004] Brawn — *Amadeus Cho*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Champion. Gamma.*
- **Rules Text**:
  > While Brawn is exhausted, he gains: "**Resource**: Generate a [mental] resource. (Limit once per phase.)"
- **Flavor**: *"No, I'm not Banner. I'm better."*
- **Image Asset**: `assets/card-art/bundles/cards/29004.png` (710×1030 px, 380.6 KB)

### [29005] Fly Over
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (2–3/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme and place 1 progress counter on Ironheart (2 progress counters instead if this thwart removes the last threat from that scheme).
- **Flavor**: *VRROOOSSHH!*
- **Image Asset**: `assets/card-art/bundles/cards/29005.png` (710×1030 px, 398.4 KB)

### [29006] Photon Beam
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (4–6/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy and place 1 progress counter on Ironheart (2 progress counters instead if this attack defeats that enemy).
- **Flavor**: *FSHHAAMMM!*
- **Image Asset**: `assets/card-art/bundles/cards/29006.png` (710×1030 px, 390.6 KB)

### [29007] New and Improved
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (7–8/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action**: Choose X different options, where X is equal to Ironheart's [[version]] number:
  > • Search your deck for an Ironheart card and add it to your hand. *(Shuffle.)*
  > • Give Ironheart a tough status card.
  > • Ready Ironheart.
- **Image Asset**: `assets/card-art/bundles/cards/29007.png` (710×1030 px, 377.1 KB)

### [29008] Sector Scan
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (9/15)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Rules Text**:
  > Reduce the cost to play Sector Scan by X, where X is equal to Ironheart's [[version]] number.
  > **Hero Action**: Until the end of the round, you may look at the top card of the encounter deck at any time.
- **Image Asset**: `assets/card-art/bundles/cards/29008.png` (710×1030 px, 373.2 KB)

### [29009] Stroke of Genius
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (10–11/15, Qty: 2)
- **Stats**: **Resources**: [mental]
- **Rules Text**:
  > **Response**: After you spend this card, place 1 progress counter on your identity and draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/29009.png` (710×1030 px, 404.3 KB)

### [29010] Ronnie Williams
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (12/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Ronnie Williams → choose:
  > • Heal 2 damage from Riri Williams.
  > • Place 1 progress counter on Riri Williams.
- **Image Asset**: `assets/card-art/bundles/cards/29010.png` (710×1030 px, 303.2 KB)

### [29011] Tony Stark A.I.
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Action**: Exhaust Tony Stark A.I. → look at the top 2 cards of your deck. Add 1 to your hand and discard the other.
- **Flavor**: *"I downloaded my fabulous self into a digital frame in case my body was ever... you know, not working anymore."*
- **Image Asset**: `assets/card-art/bundles/cards/29011.png` (710×1030 px, 418.3 KB)

### [29012] Photon Blasters
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (14/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > You get +2 hit points.
  > **Hero Action**: Exhaust Photon Blasters → deal damage to an enemy equal to Ironheart's [[Version]] number.
- **Image Asset**: `assets/card-art/bundles/cards/29012.png` (710×1030 px, 388.9 KB)

### [29013] Propulsion Jets
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (15/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Tech.*
- **Rules Text**:
  > You get +2 hit points.
  > **Hero Action**: Exhaust Propulsion Jets → remove threat from a scheme equal to Ironheart's [[Version]] number.
- **Image Asset**: `assets/card-art/bundles/cards/29013.png` (710×1030 px, 404.0 KB)

### [29028] A Minor Setback
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ironheart Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Give to the Riri Williams player.**
  > Remove 1 progress counter from your identity, then discard this card. If no progress counter was removed this way, deal yourself 1 facedown encounter card, then shuffle this card into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/29028.png` (710×1030 px, 336.3 KB)


### Set: Leadership

### [29014] Cloud 9 — *Abby Boylen*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Aerial. Champion.*
- **Rules Text**:
  > **Hero Action**: Exhaust Cloud 9 → choose a player. Until the end of the phase, each [[Aerial]] character that player controls gets +1 THW.
- **Flavor**: *"I'm only here 'cause I wanna fly!"*
- **Image Asset**: `assets/card-art/bundles/cards/29014.png` (710×1030 px, 401.5 KB)

### [29015] Falcon — *Joaquin Torres*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Aerial. Champion.*
- **Rules Text**:
  > **Hero Response**: After Falcon attacks or thwarts, spend a [energy] resource → ready another [[champion]] character you control.
- **Flavor**: *"Hey, uh, it's Joaquín. I'm here to rescue you. And, uh, good thing, right?"*
- **Image Asset**: `assets/card-art/bundles/cards/29015.png` (710×1030 px, 375.8 KB)

### [29016] Patriot — *Rayshaun Lucas*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Champion.*
- **Rules Text**:
  > **Hero Response**: After Patriot enters play, choose a [[champion]] character → that character gets +1 to each of its basic powers until the end of the round.
- **Flavor**: *"I'm surrounded by those who risk their lives for principles most people take for granted."*
- **Image Asset**: `assets/card-art/bundles/cards/29016.png` (710×1030 px, 411.9 KB)

### [29017] Go All Out
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > Requirement ([energy]). *(While paying for this card, spend the listed resources.)*
  > **Hero Action** *(attack)*: Exhaust your hero → deal damage to an enemy equal to the total of your hero's THW, ATK, and DEF values.
- **Image Asset**: `assets/card-art/bundles/cards/29017.png` (710×1030 px, 401.5 KB)

### [29018] Push Ahead
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Requirement ([mental]). *(While paying for this card, spend the listed resources.)*
  > **Hero Action** *(thwart)*: Exhaust your hero → remove threat from a scheme equal to the total of your hero's THW, ATK, and DEF values.
- **Image Asset**: `assets/card-art/bundles/cards/29018.png` (710×1030 px, 384.2 KB)

### [29019] Morale Boost
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > **Hero Action**: Choose a hero. Until the end of the round, that hero gets +1 THW, +1 ATK, and +1 DEF
- **Flavor**: *"This is a stand I need to take. This time, no compromises." —Sam Wilson*

### [29020] R&D Facility
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > Requirement ([mental][mental]). Uses (3 research counters).
  > **Hero Action**: Exhaust R&D Facility and remove 1 research counter from it → choose a friendly character in play. That character gets +1 THW and +1 ATK until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/29020.png` (710×1030 px, 398.3 KB)

### [29021] The Power of Leadership
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Leadership *(blue)* card.


### Set: Basic

### [29022] Agent 13 — *Sharon Carter*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > [star] **Response**: After Agent 13 attacks or thwarts, choose a [[S.H.I.E.L.D.]] support → ready that support.
- **Flavor**: *"I bear the scars of the past all over me. But there's more to me than that. I'm better now. Stronger. Wiser."*

### [29023] Snowguard — *Amka Aliyak*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 0 (Consequential: 1), **ATK**: 0 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Champion.*
- **Rules Text**:
  > **Response**: After Snowguard enters play, place up to 3 shift counters here. While the shift counters here are equal to (X), she gets:
  > (1) +3 ATK and her attacks gain overkill.
  > (2) +3 THW and gains the [[Aerial]] trait.
  > (3) +5 hit points and gains retaliate 1.
- **Image Asset**: `assets/card-art/bundles/cards/29023.png` (710×1030 px, 356.2 KB)

### [29024] Vivian
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 24
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Aerial. Android. Champion.*
- **Rules Text**:
  > **Hero Response**: After Vivian enters play, choose an attachment, non-[[Elite]] minion, or non-permanent side scheme. Until the end of the round, treat that card's printed text box as if it were blank (except for [[Traits]]).
- **Image Asset**: `assets/card-art/bundles/cards/29024.png` (710×1030 px, 343.6 KB)

### [29025] "Go for Champions!"
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Cost**: 3, **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > Play only if your identity has the [[Champion]] trait.
  > **Hero Action**: Remove "Go for Champions!" from the game → Each [[champion]] character in play cannot take damage until the end of the round.
- **Errata (FFG)**:
  > Added “Remove ‘Go for Champions!’ from the game →”. (RRG 1.5)
- **Image Asset**: `assets/card-art/bundles/cards/29025.png` (710×1030 px, 369.2 KB)

### [29026] Helicarrier
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Helicarrier → choose a player. Reduce the resource cost of the next card that player plays this phase by 1.
- **Flavor**: *"A flying aircraft carrier? You're kidding, right?" —Jennifer Walters*

### [29027] Ingenuity
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play only if your identity has the [[Genius]] trait. Max 1 per player.
  > **Resource**: Exhaust Ingenuity → generate a [mental] resource.
- **Image Asset**: `assets/card-art/bundles/cards/29027.png` (710×1030 px, 344.5 KB)


### Set: Ironheart Nemesis

### [29029] Rule by Force
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart Nemesis (1/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ironheart Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > While Lucia von Bardas is in play, this card gains a hazard icon ([hazard]). While Lucia von Bardas is not in play, this card gains an acceleration icon ([acceleration]).
- **Flavor**: *Lucia von Bardas has taken control of Latveria and will stop at nothing to prove the country's might once and for all.*
- **Image Asset**: `assets/card-art/bundles/cards/29029.png` (1030×710 px, 341.3 KB)

### [29030] Lucia von Bardas
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ironheart Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Cyborg. Elite.*
- **Rules Text**:
  > While Lucia von Bardas has tough status card, she gets +1 SCH and +1 ATK.
  > **Forced Response**: After the villain phase ends, give Lucia von Bardas a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/29030.png` (710×1030 px, 325.3 KB)

### [29031] Cyborg Tech
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Ironheart Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to the minion with the most traits. If you cannot, this card gains surge.
  > Attached minion gets +3 hit points and gains retaliate 1.
  >
  > ---
  >
  > [star] **Boost**: Deal this card to yourself as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/29031.png` (710×1030 px, 381.6 KB)

### [29032] Political Retribution
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Ironheart Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ironheart Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Lucia von Bardas is in play, she schemes. If Rule by Force is in play, place 3 threat on it. If neither is in play, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/29032.png` (710×1030 px, 377.3 KB)


### Set: Aggression

### [29033] Bombshell — *Lana Baumgartner*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 33
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 3 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Champion.*
- **Rules Text**:
  > Play only if your identity has the [[Champion]] trait.
  > [star] Divide damage from Bombshell's attack among each enemy as evenly as possible.
- **Image Asset**: `assets/card-art/bundles/cards/29033.png` (710×1030 px, 387.6 KB)


### Set: Justice

### [29034] Wasp — *Nadia Van Dyne*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 34
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Champion.*
- **Rules Text**:
  > Play only if your identity has the [[Champion]] trait.
  > Wasp ignores the guard keyword, patrol keyword, and crisis icon ([crisis]).
- **Flavor**: *"Gotta find me first!"*
- **Image Asset**: `assets/card-art/bundles/cards/29034.png` (710×1030 px, 395.7 KB)


### Set: Protection

### [29035] Pinpoint — *Qureshi Gupta*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Pack Position: 35
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 2), **HP**: 2, **Resources**: [mental]
- **Traits**: *Champion.*
- **Rules Text**:
  > Play only if your identity has the [[Champion]] trait.
  > **Hero Interrupt**: When a player card would be placed into a discard pile from play, exhaust Pinpoint → shuffle that card into its owner's deck instead.
- **Image Asset**: `assets/card-art/bundles/cards/29035.png` (710×1030 px, 364.0 KB)


### Set: Zzzax

### [29036] Feedback Loop
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Zzzax (1/7)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zzzax Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Each player must place threat here equal to the total number [energy] resources in their hand and on cards they control
- **Flavor**: *Zzzax controls the city's power supply and is causing havoc within the system!*
- **Image Asset**: `assets/card-art/bundles/cards/29036.png` (1030×710 px, 362.8 KB)

### [29037] Zzzax
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Zzzax (2/7)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Zzzax Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] Zzzax gets +X ATK and +X hit points, where X is equal to the total number of [energy] resources on cards the engaged player controls.
  >
  > ---
  >
  > [star] **Boost**: If you have at least [energy] [energy] resources in your hand, put Zzzax into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/29037.png` (710×1030 px, 414.4 KB)

### [29038] Haywire
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Zzzax (3–4/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zzzax Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity.
  > Treat the printed resource of each card in your hand as if it were [energy].
  > **Hero Action**: Choose to either discard a card you control with a printed [energy] resource or take 2 indirect damage → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/29038.png` (710×1030 px, 397.5 KB)

### [29039] Air Static
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Zzzax (5/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zzzax Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > **Forced Interrupt**: When the villain phase begins, deal 2 indirect damage to each player with a [energy] resource in their hand and/or on a card they control.
  > **Hero Action**: Choose to either discard a card you control with a printed [energy] resource or take 2 indirect damage → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/29039.png` (710×1030 px, 412.3 KB)

### [29040] Zzzap!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Ironheart (`ironheart`)
- **Deck / Set**: Zzzax (6–7/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zzzax Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Take indirect damage equal to the total number of [energy] resources in your hand. If your identity was dealt 1 or fewer damage this way, this card gains surge.
- **Flavor**: *"Me Zzzax! You zzzap!"*
- **Image Asset**: `assets/card-art/bundles/cards/29040.png` (710×1030 px, 363.3 KB)


