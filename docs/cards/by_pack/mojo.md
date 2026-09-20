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
| `39001a` | MaGog | Villain | Magog | SCH:1 ATK:2 HP:10 | - | `mojo` |
| `39001b` | MaGog | Villain | Magog | SCH:1 ATK:3 HP:10 | - | `mojo` |
| `39002a` | Melee in the Mojo-seum | Main Scheme | Magog | - | - | `mojo` |
| `39002b` | Melee in the Mojo-seum | Main Scheme | Magog | - | - | `mojo` |
| `39003a` | The Champion | Environment | Magog | - | - | `mojo` |
| `39003b` | The Champion | Environment | Magog | - | - | `mojo` |
| `39004a` | The Challengers | Environment | Magog | - | - | `mojo` |
| `39004b` | The Challengers | Environment | Magog | - | - | `mojo` |
| `39005` | Jolt of Adrenaline | Attachment | Magog | - | 0 icons + star | `mojo` |
| `39006` | Surge of Aggression | Attachment | Magog | SCH:1 ATK:1 | 0 icons + star | `mojo` |
| `39007` | Surprise Contender | Minion | Magog | SCH:1 ATK:2 HP:7 | 3 icons | `mojo` |
| `39008` | Pump Up the Crowd | Side Scheme | Magog | - | 3 icons | `mojo` |
| `39009` | Break a Leg | Treachery | Magog | - | 2 icons | `mojo` |
| `39010` | Defend the Title | Treachery | Magog | - | 1 icon | `mojo` |
| `39011` | Stage Fright | Treachery | Magog | - | 0 icons + star | `mojo` |
| `39012a` | Spiral | Villain | Spiral | SCH:1 HP:13 | - | `mojo` |
| `39012b` | Spiral | Villain | Spiral | SCH:1 ATK:1 HP:13 | - | `mojo` |
| `39013a` | Spiral | Villain | Spiral | SCH:2 HP:15 | - | `mojo` |
| `39013b` | Spiral | Villain | Spiral | SCH:2 ATK:2 HP:15 | - | `mojo` |
| `39014a` | Spiral | Villain | Spiral | SCH:2 HP:17 | - | `mojo` |
| `39014b` | Spiral | Villain | Spiral | SCH:2 ATK:3 HP:17 | - | `mojo` |
| `39015a` | Across the Mojoverse | Main Scheme | Spiral | - | - | `mojo` |
| `39015b` | Across the Mojoverse | Main Scheme | Spiral | - | - | `mojo` |
| `39016` | The Search for Spiral | Side Scheme | Spiral | - | not recorded in this source | `mojo` |
| `39017` | Cornered! | Treachery | Spiral | - | not recorded in this source | `mojo` |
| `39018` | Spiral's Swords | Attachment | Spiral | - | 3 icons | `mojo` |
| `39019` | Erratic Teleportation | Treachery | Spiral | - | 1 icon | `mojo` |
| `39020` | The Show Must Go On | Treachery | Spiral | - | 3 icons | `mojo` |
| `39021` | Well-Armed | Treachery | Spiral | - | 1 icon | `mojo` |
| `39022` | Mojo | Villain | Mojo | SCH:2 ATK:1 HP:16 | - | `mojo` |
| `39023` | Mojo | Villain | Mojo | SCH:3 ATK:1 HP:18 | - | `mojo` |
| `39024` | Mojo | Villain | Mojo | SCH:4 ATK:2 HP:25 | - | `mojo` |
| `39025a` | MojoMania | Main Scheme | Mojo | - | - | `mojo` |
| `39025b` | MojoMania | Main Scheme | Mojo | - | - | `mojo` |
| `39026a` | Wheel of Genres | Environment | Mojo | - | - | `mojo` |
| `39026b` | Wheel of Genres | Environment | Mojo | - | - | `mojo` |
| `39027` | Major Domo | Attachment | Mojo | SCH:1 ATK:1 | 3 icons | `mojo` |
| `39028` | Stinger Tail | Attachment | Mojo | ATK:1 | 0 icons + star | `mojo` |
| `39029` | Supporting Actor | Minion | Mojo | SCH:1 ATK:1 HP:6 | 1 icon + star | `mojo` |
| `39030` | Paparazzi | Obligation | Mojo | - | 2 icons | `mojo` |
| `39031` | Undercover Mojo | Side Scheme | Mojo | - | 3 icons | `mojo` |
| `39032` | Curtain Call | Treachery | Mojo | - | 0 icons + star | `mojo` |
| `39033` | Director's Directions | Treachery | Mojo | - | 1 icon | `mojo` |
| `39034` | Top Billing | Treachery | Mojo | - | 0 icons + star | `mojo` |
| `39035` | Dial M for Mojo | Environment | Crime | - | 1 icon | `mojo` |
| `39036` | Build the Case | Obligation | Crime | - | 1 icon | `mojo` |
| `39037` | Crime Scene Investigation | Side Scheme | Crime | - | 2 icons | `mojo` |
| `39038` | Law & Order | Side Scheme | Crime | - | 3 icons | `mojo` |
| `39039` | Dragnet | Side Scheme | Crime | - | 2 icons | `mojo` |
| `39040` | Elementary, My Dear Mojo | Treachery | Crime | - | not recorded in this source | `mojo` |
| `39041` | A Game of Mojo's | Environment | Fantasy | - | 1 icon | `mojo` |
| `39042` | Dragon | Minion | Fantasy | SCH:1 ATK:3 HP:10 | 4 icons | `mojo` |
| `39043` | Goblin | Minion | Fantasy | SCH:2 ATK:1 HP:1 | not recorded in this source | `mojo` |
| `39044` | Troll | Minion | Fantasy | SCH:0 ATK:2 HP:7 | 2 icons | `mojo` |
| `39045` | Fetch Quest | Side Scheme | Fantasy | - | 0 icons + star | `mojo` |
| `39046` | Mana Drain | Treachery | Fantasy | - | 0 icons + star | `mojo` |
| `39047` | The Mojo Files | Environment | Horror | - | 1 icon | `mojo` |
| `39048` | Bandolier of Stakes | Attachment | Horror | - | not recorded in this source | `mojo` |
| `39049` | Cultist | Minion | Horror | SCH:1 ATK:1 HP:4 | 1 icon | `mojo` |
| `39050` | The Kraken | Minion | Horror | SCH:0 ATK:2 HP:6 | 3 icons | `mojo` |
| `39051` | Vampire | Minion | Horror | SCH:2 ATK:2 HP:6 | 2 icons | `mojo` |
| `39052` | Werewolf Pack | Minion | Horror | SCH:1 ATK:3 HP:4 | 2 icons | `mojo` |
| `39053` | Mojo Runner | Environment | Sci-Fi | - | 1 icon | `mojo` |
| `39054` | Avalanche 9.0 | Minion | Sci-Fi | SCH:1 ATK:3 HP:5 | 1 icon + star | `mojo` |
| `39055` | Blob 3.14 | Minion | Sci-Fi | SCH:1 ATK:1 HP:6 | 1 icon + star | `mojo` |
| `39056` | Magneto 2.6 | Minion | Sci-Fi | SCH:1 ATK:1 HP:7 | 3 icons | `mojo` |
| `39057` | Pyro 4.0 | Minion | Sci-Fi | SCH:2 ATK:2 HP:4 | 0 icons + star | `mojo` |
| `39058` | Toad 2.0 | Minion | Sci-Fi | SCH:2 ATK:2 HP:3 | 2 icons | `mojo` |
| `39059` | ICE-Teroid M | Side Scheme | Sci-Fi | - | 3 icons | `mojo` |
| `39060` | Mojo in the Middle | Environment | Sitcom | - | 1 icon | `mojo` |
| `39061` | Family Matters | Obligation | Sitcom | - | 3 icons | `mojo` |
| `39062` | Growing Pains | Obligation | Sitcom | - | not recorded in this source | `mojo` |
| `39063` | The Odd Couple | Obligation | Sitcom | - | 1 icon | `mojo` |
| `39064` | The One with the Breakup | Obligation | Sitcom | - | 2 icons | `mojo` |
| `39065` | Watch Me Play | Obligation | Sitcom | - | 2 icons | `mojo` |
| `39066` | Wild Wild Mojo | Environment | Western | - | 1 icon | `mojo` |
| `39067` | Dead or Alive | Attachment | Western | - | 2 icons | `mojo` |
| `39068` | Card Shark | Minion | Western | SCH:1 ATK:3 HP:7 | 3 icons | `mojo` |
| `39069` | Gunslinger | Minion | Western | SCH:1 ATK:2 HP:3 | 1 icon | `mojo` |
| `39070` | A Game of Cards | Treachery | Western | - | 1 icon | `mojo` |
| `39071` | Longshot | Ally | Longshot | THW:2 ATK:2 HP:3 | not recorded in this source | `mojo` |

---

## Pack: Mojo Mania (`mojo`)

### Set: Magog

### [39001a] MaGog
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (1/12)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 10 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > [star] **Forced Response**: After MaGog attacks and damages a character, place 1 ratings counter on The Champion.
  > **Forced Interrupt**: When MaGog would be defeated, reset his hit points to 10 [per_hero] instead. Place 3 [per_hero] ratings counters on The Challengers and deal each player 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/39001a.png` (607×880 px, 154.1 KB)

### [39001b] MaGog
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (1/12)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 10 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > [star] **Forced Response**: After MaGog attacks and damages a character, place 2 ratings counters on The Champion.
  > **Forced Interrupt**: When MaGog would be defeated, reset his hit points to 10 [per_hero] instead. Place 2 [per_hero] ratings counters on The Challengers and deal each player 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/39001b.png` (607×880 px, 148.5 KB)

### [39002a] Melee in the Mojo-seum
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (2/12)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: MaGog (A) *(MaGog (B) instead for expert mode)*. MaGog and Standard encounter sets. One modular encounter set *(1 random modular set from the* MojoMania *scenario pack)*.
  > **Setup**: Put The Champion environment card and The Challengers environment card into play, each with its [[BOOING CROWD]] side faceup.
- **Image Asset**: `assets/card-art/bundles/cards/39002a.png` (880×607 px, 217.6 KB)

### [39002b] Melee in the Mojo-seum
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (2/12)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 [star] per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > The players cannot win the game unless they wow the crowd as The Challengers.
  > [star] **Forced Interrupt**: When this scheme would be completed, place 2 [per_hero] ratings counters on The Champion and remove all threat from here instead.
- **Flavor**: *Teleported into a bizarre arena, you must fight for the audience's entertainment...and your lives!*
- **Image Asset**: `assets/card-art/bundles/cards/39002b.png` (880×607 px, 216.0 KB)

### [39003a] The Champion
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (3/12)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Traits**: *Booing Crowd.*
- **Rules Text**:
  > If there are at least 5 [per_hero] ratings counters here, flip this environment *(without removing ratings counters)*.
- **Flavor**: *"In this corner, we have your ninety-nine time defending Mojoverse champion, the mighty MaGog!"*
- **Image Asset**: `assets/card-art/bundles/cards/39003a.png` (607×880 px, 134.8 KB)

### [39003b] The Champion
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (3/12)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cheering Crowd.*
- **Rules Text**:
  > Underdogs — **Forced Response**: After The Champion flips to this side, each player draws 1 card.
  > **If there are at least 10 [per_hero] ratings counters here, MaGog wins again and the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/39003b.png` (607×880 px, 140.1 KB)

### [39004a] The Challengers
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (4/12)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Traits**: *Booing Crowd.*
- **Rules Text**:
  > If there are at least 5 [per_hero] ratings counters here, flip this environment *(without removing ratings counters)*.
  > *(The players wow the crowd by placing ratings counters here.)*
- **Flavor**: *"And in this corner, hailing from the tiny, insignificant planet of Earth, we have our challengers!" —Mojo*
- **Image Asset**: `assets/card-art/bundles/cards/39004a.png` (607×880 px, 152.0 KB)

### [39004b] The Challengers
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (4/12)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cheering Crowd.*
- **Rules Text**:
  > Tag Team — **Forced Response**: After The Challengers flips to this side, search the encounter deck and discard pile for Surprise Contender and put it into play engaged with the first player. If it is already in play, give it a tough status card.
  > **If there are at least 10 [per_hero] ratings counters here, you wow the crowd and the players win the game.**
- **Image Asset**: `assets/card-art/bundles/cards/39004b.png` (607×880 px, 161.9 KB)

### [39005] Jolt of Adrenaline
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (5/12)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to MaGog.
  > MaGog gains retaliate 1 and stalwart.
  > **Forced Response**: After MaGog's hit points are reset, place 1 [per_hero] ratings counters on The Challengers and discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/39005.png` (607×880 px, 134.7 KB)

### [39006] Surge of Aggression
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (6/12)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to MaGog.
  > **Forced Response**: After MaGog's hit points are reset, place 1 [per_hero] ratings counters on The Challengers and discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/39006.png` (607×880 px, 146.9 KB)

### [39007] Surprise Contender
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (7/12)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 7 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Traits**: *Clone. Elite.*
- **Rules Text**:
  > Villainous.
  > [star] **Forced Response**: After Surprise Contender attacks and damages a character, place 1 ratings counters on The Champion.
  > **When Defeated**: Place 2 [per_hero] ratings counters on The Challengers.
- **Image Asset**: `assets/card-art/bundles/cards/39007.png` (607×880 px, 136.8 KB)

### [39008] Pump Up the Crowd
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (8/12)
- **Stats**: **Base Threat**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: If The Champion is on its [[Cheering Crowd]] side, place an additional 1 [per_hero] threat here.
  > **When Defeated**: Place 1 [per_hero] ratings counters on The Challengers.
- **Flavor**: *"Do you smell what MaGog is cooking?" —MaGog*
- **Image Asset**: `assets/card-art/bundles/cards/39008.png` (880×607 px, 226.2 KB)

### [39009] Break a Leg
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (9/12)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are stunned. Take 2 damage (4 damage instead there are more ratings counters on The Challengers than on The Champion). You may place any number of ratings counters on The Champion to reduce this damage by 1 for each counter placed this way.
- **Image Asset**: `assets/card-art/bundles/cards/39009.png` (607×880 px, 134.8 KB)

### [39010] Defend the Title
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (10–11/12, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Place 2 ratings counters on The Champion.
  > **When Revealed (Hero)**: MaGog attacks you. If a hero defends against this attacks and takes no damage, place 2 ratings counters on The Challengers.
- **Flavor**: *"Are you not entertained?" —MaGog*
- **Image Asset**: `assets/card-art/bundles/cards/39010.png` (607×880 px, 140.5 KB)

### [39011] Stage Fright
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Magog (12/12)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Magog Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are confused. Place 2 threat on the main scheme (4 threat instead if there are more ratings counters on The Challengers than on The Champion).
  >
  > ---
  >
  > [star] **Boost**: You are confused.
- **Image Asset**: `assets/card-art/bundles/cards/39011.png` (607×880 px, 142.9 KB)


### Set: Spiral

### [39012a] Spiral
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (1/12)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Traits**: *Escaped. Mystic.*
- **Rules Text**:
  > Spiral cannot take damage or be stunned. Threat cannot be removed from the main scheme.
  > [star] **Forced Interrupt**: When Spiral would attack, she schemes instead.
- **Image Asset**: `assets/card-art/bundles/cards/39012a.png` (607×880 px, 141.2 KB)

### [39012b] Spiral
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (1/12)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cornered. Mystic.*
- **Rules Text**:
  > If there are at least 3 [per_hero] teleport counters here, remove all of them and flip Spiral.
  > [star] **Forced Response**: After Spiral activates, place 1 teleport counter here.
- **Image Asset**: `assets/card-art/bundles/cards/39012b.png` (607×880 px, 140.7 KB)

### [39013a] Spiral
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (2/12)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Traits**: *Escaped. Mystic.*
- **Rules Text**:
  > Spiral cannot take damage or be stunned. Threat cannot be removed from the main scheme.
  > [star] **Forced Interrupt**: When Spiral would attack, she schemes instead.
- **Image Asset**: `assets/card-art/bundles/cards/39013a.png` (607×880 px, 140.9 KB)

### [39013b] Spiral
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (2/12)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cornered. Mystic.*
- **Rules Text**:
  > If there are at least 2 [per_hero] teleport counters here, remove all of them and flip Spiral.
  > [star] **Forced Response**: After Spiral activates, place 1 teleport counter here.
- **Image Asset**: `assets/card-art/bundles/cards/39013b.png` (607×880 px, 136.0 KB)

### [39014a] Spiral
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (3/12)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Traits**: *Escaped. Mystic.*
- **Rules Text**:
  > Spiral cannot take damage or be stunned. Threat cannot be removed from the main scheme.
  > [star] **Forced Interrupt**: When Spiral would attack, she schemes instead.
- **Image Asset**: `assets/card-art/bundles/cards/39014a.png` (607×880 px, 134.5 KB)

### [39014b] Spiral
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (3/12)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cornered. Mystic.*
- **Rules Text**:
  > If there are at least 3 [per_hero] teleport counters here, remove all of them and flip Spiral.
  > **When Revealed**: Spiral attacks each player in player order *(even in alter-ego form)*.
  > [star] **Forced Response**: After Spiral activates, place 1 teleport counter here.
- **Image Asset**: `assets/card-art/bundles/cards/39014b.png` (607×880 px, 142.6 KB)

### [39015a] Across the Mojoverse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (4/12)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Spiral (I) and Spiral (II) *(Spiral (II) and Spiral (III) instead for expert mode)*. Spiral and Standard encounter sets. Three modular encounter sets from the MojoMania scenario pack.
  > **Setup**: Put The Search for Spiral side scheme and 1 random [[SHOW]] environment into play. Shuffle each other [[SHOW]] environment together with the Cornered! treachery to create the show deck. *(See rulebook p. 11)*. Flip Spiral to her [[ESCAPED]] side.
- **Image Asset**: `assets/card-art/bundles/cards/39015a.png` (880×607 px, 199.0 KB)

### [39015b] Across the Mojoverse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (4/12)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 15 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When a [[SHOW]] environment would be discarded, place it on the bottom of the show deck instead.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *If you want to return home, you'll need the help of the teleporting sorceress, Spiral. But she will need some convincing.*
- **Image Asset**: `assets/card-art/bundles/cards/39015b.png` (880×607 px, 187.0 KB)

### [39016] The Search for Spiral
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (5/12)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent.
  > **Forced Interrupt**: After the last threat is removed from here, the player who removed that threat reveals the top card of the show deck and places 3 [per_hero] threat here.
  > **Hero Action**: Take 2 damage → remove 3 threat from here.
- **Errata (FFG)**:
  > Added cost arrow. (RRG 1.5)
- **Flavor**: *Spiral is hiding in one of the numerous television programs Mojo is producing.*
- **Image Asset**: `assets/card-art/bundles/cards/39016.png` (880×607 px, 230.0 KB)

### [39017] Cornered!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (6/12)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Flip Spiral to her [[Cornered]] side. *(This will cause her "***When Revealed***" text, if any, to resolve.)* Reveal the top card of the show deck. Shuffle this card into the show deck. This effect cannot be canceled.)
- **Flavor**: *"Why won't you just leave me alone?!?" —Spiral*
- **Image Asset**: `assets/card-art/bundles/cards/39017.png` (607×880 px, 145.9 KB)

### [39018] Spiral's Swords
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (7–8/12, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Spiral.
  > Uses (3 sword counters).
  > [star] Spiral gets +1 ATK for each sword counter on this card.
  > **Hero Action**: If Spiral is on her [[Cornered]] side, spend [physical] [physical] resources → remove 1 sword counter from this card.
- **Flavor**: *"Don't know how she keep from losin' an arm." —Gambit*
- **Image Asset**: `assets/card-art/bundles/cards/39018.png` (607×880 px, 138.8 KB)

### [39019] Erratic Teleportation
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (9–10/12, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: If Spiral is on her [[Cornered]] side, place 1 teleport counter on her. If Spiral is on her [[Escaped]] side, you may spend a [mental] resource to look at the top card of the show deck and put it on the top or bottom of that deck.
- **Image Asset**: `assets/card-art/bundles/cards/39019.png` (607×880 px, 122.0 KB)

### [39020] The Show Must Go On
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (11/12)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player searches the encounter deck and discard pile for a card from the same encounter set as the current [[Show]] environment and deals that card to themself as a facedown encounter card. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/39020.png` (607×880 px, 137.2 KB)

### [39021] Well-Armed
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Spiral (12/12)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spiral Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If a copy of Spiral's Sword is attached to Spiral, she attacks you *(even if you are in alter-ego form)*. Otherwise, search the encounter deck and discard pile for a copy of Spiral's Sword and attach it to her. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/39021.png` (607×880 px, 138.2 KB)


### Set: Mojo

### [39022] Mojo
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (1/16)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spineless.*
- **Rules Text**:
  > **Forced Response (Hero)**: After your turn ends, discard the top 3 cards of the encounter deck. Place 1 threat on your hero for each card discarded this way that does not belong to the Mojo encounter set.
- **Image Asset**: `assets/card-art/bundles/cards/39022.png` (607×880 px, 146.4 KB)

### [39023] Mojo
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (2/16)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 3, **ATK**: 1, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spineless.*
- **Rules Text**:
  > **When Revealed**: Place 2 threat on each friendly character.
  > **Forced Response (Hero)**: After your turn ends, discard the top 4 cards of the encounter deck. Place 1 threat on your hero for each card discarded this way that does not belong to the Mojo encounter set.
- **Image Asset**: `assets/card-art/bundles/cards/39023.png` (607×880 px, 151.7 KB)

### [39024] Mojo
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (3/16)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 4, **ATK**: 2, **HP**: 25 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spineless.*
- **Rules Text**:
  > **When Revealed**: Place 3 threat on each friendly character.
  > **Forced Response (Hero)**: After your turn ends, discard the top 5 cards of the encounter deck. Place 1 threat on your hero for each card discarded this way that does not belong to the Mojo encounter set.
- **Image Asset**: `assets/card-art/bundles/cards/39024.png` (607×880 px, 151.7 KB)

### [39025a] MojoMania
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (4/16)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Mojo (I) and Mojo (II) *(Mojo (II) and Mojo (III) instead for expert mode)*. Mojo and Standard encounter sets.
  > **Setup**: Choose 1 modular set, plus 1 [per_hero] additional modular sets, from the MojoMania scenario pack and set them aside. Put the Wheel of Genres environment into play, [[SPINNING]] side faceup.
- **Image Asset**: `assets/card-art/bundles/cards/39025a.png` (880×607 px, 213.8 KB)

### [39025b] MojoMania
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (4/16)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 10 per hero, **Target Threat**: 25 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose 1 set-aside encounter set at random, reveal its [[SHOW]] environment and shuffle its remaining cards into the encounter deck.
  > **Forced Interrupt**: When a character flips or leaves play, move all threat from that character to this scheme.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/39025b.png` (880×607 px, 228.8 KB)

### [39026a] Wheel of Genres
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (5/16)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spinning.*
- **Rules Text**:
  > **Forced Response**: After the encounter deck resets, **if there are no set-aside modular encounter sets remaining, the players lose the game**. Otherwise, flip this card.
- **Flavor**: *"The ratings are stagnating. Time to shake things up with a crossover episode!" —Mojo*
- **Image Asset**: `assets/card-art/bundles/cards/39026a.png` (607×880 px, 131.5 KB)

### [39026b] Wheel of Genres
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (5/16)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Stopped.*
- **Rules Text**:
  > **Forced Interrupt**: At the start of step three of the villain phase (deal encounter cards), randomly choose 1 set-aside modular set and reveal its [[SHOW]] environment. Shuffle the rest of that modular set and place it on top of the encounter deck. Deal the first player 2 facedown encounter cards and flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/39026b.png` (607×880 px, 138.5 KB)

### [39027] Major Domo
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (6/16)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Persona.*
- **Rules Text**:
  > Attach to Mojo.
  > [star] **Forced Response**: After Mojo attacks, discard cards from the encounter deck equal to the amount of damage dealt by that attack.
  > **Hero Action**: Spend [energy] [mental] [physical] resources → discard this card.
- **Flavor**: *"I live to serve, Your Supreme Spinelessness."*
- **Image Asset**: `assets/card-art/bundles/cards/39027.png` (607×880 px, 148.6 KB)

### [39028] Stinger Tail
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (7/16)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Mojo.
  > Mojo gains retaliate 2.
  > **Forced Interrupt**: When any amount of damage would be dealt to Mojo, place it here instead. Then, if there is at least 5 damage here, discard Stinger Tail.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Mojo.
- **Image Asset**: `assets/card-art/bundles/cards/39028.png` (607×880 px, 147.4 KB)

### [39029] Supporting Actor
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (8–9/16, Qty: 2)
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Robot. Thespian.*
- **Rules Text**:
  > [star] **Forced Response**: After Supporting Actor activates against you, place 2 threat here.
  >
  > ---
  >
  > **Boost**: Place 1 threat on each character you control.
- **Flavor**: *"They're cheaper than real actors." —Mojo*
- **Image Asset**: `assets/card-art/bundles/cards/39029.png` (607×880 px, 131.2 KB)

### [39030] Paparazzi
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (10/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 10.
  > **Action**: Choose to either exhaust a character you control or discard 1 card from your hand → remove 2 threat from here (3 threat instead if you are in alter-ego form).
  > **Forced Interrupt**: When your turn ends, move all threat from here to the main scheme and discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/39030.png` (607×880 px, 146.0 KB)

### [39031] Undercover Mojo
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (11/16)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 2 [per_hero].
  > **Forced Interrupt**: When Mojo would take any amount of damage, remove an equal amount of threat from here instead.
- **Flavor**: *"They'll never recognize me." —Mojo*
- **Image Asset**: `assets/card-art/bundles/cards/39031.png` (880×607 px, 223.8 KB)

### [39032] Curtain Call
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (12–13/16, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Move all threat from the character with the most threat on it to the main scheme. If no threat was moved this way, place 1 threat on each character you control.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/39032.png` (607×880 px, 139.2 KB)

### [39033] Director's Directions
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (14–15/16, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose one:
  > • Spend 2 different resources.
  > • Mojo schemes.
  > • Take 1 damage for each threat on your identity. If you take less than 2 damage this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/39033.png` (607×880 px, 141.7 KB)

### [39034] Top Billing
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Mojo (16/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mojo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Heal 1 damage from each character you control. Place 2 threat on each character you control.
  >
  > ---
  >
  > [star] **Boost**: Place 1 threat on each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/39034.png` (607×880 px, 145.7 KB)


### Set: Crime

### [39035] Dial M for Mojo
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Crime (1/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crime Set Icon (printed bottom-right next to deck number)
- **Traits**: *Setting. Show.*
- **Rules Text**:
  > Each other encounter card gains incite 1.
  > Each friendly character gets +1 THW.
  > **When Revealed**: Discard each other [[Setting]] environment in play. If this card was revealed from the encounter deck, it gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/39035.png` (607×880 px, 143.0 KB)

### [39036] Build the Case
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Crime (2/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crime Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Response**: After a side scheme is defeated, place 1 clue counter here. Then, if there are at least 3 clue counters here, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/39036.png` (607×880 px, 134.4 KB)

### [39037] Crime Scene Investigation
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Crime (3/6)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crime Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1 [per_hero]. *(When revealed, place 1 [per_hero] threat here.)*
  > Threat cannot be removed from other schemes.
  > **Hero Action**: Spend X [mental] resources → remove X threat from this scheme.
- **Flavor**: *"It seems the victim's luck ran out."
"I guess you could say he...lost his mojo." —Detectives Domo and Mojo*
- **Image Asset**: `assets/card-art/bundles/cards/39037.png` (880×607 px, 228.9 KB)

### [39038] Law & Order
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Crime (4/6)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crime Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1 [per_hero]. *(When revealed, place 1 [per_hero] threat here.)*
  > Each friendly character gets -2 ATK.
  > **Hero Action**: Spend X [energy] resources → remove X threat from this scheme.
- **Flavor**: *"I hold both of me in contempt!" —Judge Mojo*
- **Image Asset**: `assets/card-art/bundles/cards/39038.png` (880×607 px, 204.5 KB)

### [39039] Dragnet
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Crime (5/6)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crime Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1 [per_hero]. *(When revealed, place 1 [per_hero] threat here.)*
  > The villain cannot take damage.
  > **Hero Action**: Spend X [physical] resources → remove X threat from this scheme.
- **Flavor**: *"I was never here." —Boss Mojo*
- **Image Asset**: `assets/card-art/bundles/cards/39039.png` (880×607 px, 177.0 KB)

### [39040] Elementary, My Dear Mojo
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Crime (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Crime Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose one:
  > • Move all threat from a side scheme to the main scheme.*(That side scheme is defeated.)*
  > • Discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that card.
- **Image Asset**: `assets/card-art/bundles/cards/39040.png` (607×880 px, 137.0 KB)


### Set: Fantasy

### [39041] A Game of Mojo's
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Fantasy (1/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Fantasy Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Setting. Show.*
- **Rules Text**:
  > Each player gets +1 hand size.
  > **When Revealed**: Discard each other [[Setting]] environment in play. If this card was revealed from the encounter deck, it gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/39041.png` (607×880 px, 133.4 KB)

### [39042] Dragon
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Fantasy (2/6)
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 10 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Fantasy Set Icon (printed bottom-right next to deck number)
- **Traits**: *Dragon. Elite.*
- **Rules Text**:
  > Retaliate 1. Toughness.
  > Double the amount of damage this minion takes from cards with a printed [energy] resource.
  > **When Defeated**: Each player draws 4 cards.
- **Image Asset**: `assets/card-art/bundles/cards/39042.png` (607×880 px, 131.5 KB)

### [39043] Goblin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Fantasy (3/6)
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Fantasy Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin.*
- **Rules Text**:
  > Surge.
  > This minion can only take damage from cards with a printed [physical] resource.
  > **When Defeated**: Remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/39043.png` (607×880 px, 129.9 KB)

### [39044] Troll
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Fantasy (4/6)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Fantasy Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Troll.*
- **Rules Text**:
  > Toughness.
  > This minion takes 1 additional damage from each card with a printed [mental] resource.
  > **When Defeated**: The player who defeated this minion may put 1 ally from their discard pile into play.
- **Image Asset**: `assets/card-art/bundles/cards/39044.png` (607×880 px, 134.3 KB)

### [39045] Fetch Quest
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Fantasy (5/6)
- **Stats**: **Base Threat**: 6 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Fantasy Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Defeated**: In player order, each player may search their deck for a card and play that card, ignoring its resource cost. *(Shuffle.)*
  >
  > ---
  >
  > [star] **Boost**: Put this card into play.
- **Errata (FFG)**:
  > Replaced “for free” with “ignoring its resource cost”. (RRG 1.5)
- **Flavor**: *"Bring me a shrubbery!" —Sir Mojo*
- **Image Asset**: `assets/card-art/bundles/cards/39045.png` (880×607 px, 211.3 KB)

### [39046] Mana Drain
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Fantasy (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Fantasy Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose a non-wild (non-[wild]) resource type, then each player draws 2 cards. Each player must discard each card from their hand with the chosen resource type.
  >
  > ---
  >
  > [star] **Boost**: Discard 1 card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/39046.png` (607×880 px, 128.4 KB)


### Set: Horror

### [39047] The Mojo Files
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Horror (1/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Horror Set Icon (printed bottom-right next to deck number)
- **Traits**: *Setting. Show.*
- **Rules Text**:
  > Each minion gains quickstrike.
  > Each ally takes -1 consequential damage ([cost]) after attacking a minion.
  > **When Revealed**: Discard each other [[Setting]] environment in play. If this card was revealed from the encounter deck, it gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/39047.png` (607×880 px, 134.0 KB)

### [39048] Bandolier of Stakes
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Horror (2/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Horror Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Surge. Uses (3 stake counters).**When Revealed**: You may spend 1 resource of any type to attach this card to your identity. Otherwise, discard this card.
  > **Hero Interrupt**: When your hero makes a basic attack, remove 1 stake counter from here → your hero gets +1 ATK for that attack and that attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/39048.png` (607×880 px, 118.5 KB)

### [39049] Cultist
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Horror (3/6)
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Horror Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mystic.*
- **Rules Text**:
  > [star] **Forced Response**: After Cultist activates against you, search the encounter deck and discard pile for The Kraken and put it into play engaged with you. *(Shuffle.)* Then, discard Cultist.
- **Flavor**: *"Release the kraken!"*
- **Image Asset**: `assets/card-art/bundles/cards/39049.png` (607×880 px, 134.7 KB)

### [39050] The Kraken
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Horror (4/6)
- **Properties**: Unique
- **Stats**: **SCH**: 0 [star], **ATK**: 2 [star], **HP**: 6 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Horror Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature. Elite.*
- **Rules Text**:
  > [star] **Forced Response**: After The Kraken activates, each other character takes 1 damage.
  > **When Defeated**: Each friendly character heals 1 damage.
- **Flavor**: *"Rraaarhh!"*
- **Image Asset**: `assets/card-art/bundles/cards/39050.png` (607×880 px, 136.6 KB)

### [39051] Vampire
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Horror (5/6)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Horror Set Icon (printed bottom-right next to deck number)
- **Traits**: *Vampire.*
- **Rules Text**:
  > Attacks with piercing deal double damage to Vampire.
  > [star] **Forced Response**: After Vampire attacks and damages a character, heal all damage from Vampire. If no damage was healed this way, give Vampire a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/39051.png` (607×880 px, 134.7 KB)

### [39052] Werewolf Pack
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Horror (6/6)
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Horror Set Icon (printed bottom-right next to deck number)
- **Traits**: *Werewolf.*
- **Rules Text**:
  > **When Revealed**: Defeat an ally you control and place it facedown under Werewolf Pack.
  > **Forced Interrupt**: When Werewolf Pack would be defeated, discard an ally from under it instead. Then, heal all damage from Werewolf Pack.
- **Image Asset**: `assets/card-art/bundles/cards/39052.png` (607×880 px, 153.7 KB)


### Set: Sci-Fi

### [39053] Mojo Runner
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sci-Fi (1/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sci-Fi Set Icon (printed bottom-right next to deck number)
- **Traits**: *Setting. Show.*
- **Rules Text**:
  > Each minion and ally gains toughness.
  > **When Revealed**: Discard each other [[Setting]] environment in play. If this card was revealed from the encounter deck, it gains surge.
- **Flavor**: *">Password accepted. Logging you into the server now.
>Welcome to MojoCorp! Your activities will be monitored."*
- **Image Asset**: `assets/card-art/bundles/cards/39053.png` (607×880 px, 142.0 KB)

### [39054] Avalanche 9.0
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sci-Fi (2/7)
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sci-Fi Set Icon (printed bottom-right next to deck number)
- **Traits**: *Program.*
- **Rules Text**:
  > **Forced Response**: After Avalanche 9.0 engages you, exhaust a character you control and deal 1 damage to this character.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a character you control.
- **Flavor**: *">Deallocatting CPU cycles from unidentified process."*
- **Image Asset**: `assets/card-art/bundles/cards/39054.png` (607×880 px, 137.8 KB)

### [39055] Blob 3.14
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sci-Fi (3/7)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sci-Fi Set Icon (printed bottom-right next to deck number)
- **Traits**: *Program.*
- **Rules Text**:
  > Blob 3.14 cannot take more than 2 damage from each attack.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Flavor**: *">Buffering...
>Buffering...
>Buffering..."*
- **Image Asset**: `assets/card-art/bundles/cards/39055.png` (607×880 px, 128.3 KB)

### [39056] Magneto 2.6
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sci-Fi (4/7)
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sci-Fi Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Program.*
- **Rules Text**:
  > Villainous.
  > [star] **Forced Response**: After Magneto 2.6 activates against you, place 1 magnetic counter on him. Then, choose and discard 1 card from your hand for each magnetic counter on Magneto 2.6.
- **Flavor**: *">Reformating infected hard drive."*
- **Image Asset**: `assets/card-art/bundles/cards/39056.png` (607×880 px, 129.9 KB)

### [39057] Pyro 4.0
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sci-Fi (5/7)
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sci-Fi Set Icon (printed bottom-right next to deck number)
- **Traits**: *Program.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Pyro 4.0 attacks you, take 2 indirect damage.
  >
  > ---
  >
  > [star] **Boost**: Take 2 indirect damage.
- **Flavor**: *">Purging unknown program."*
- **Image Asset**: `assets/card-art/bundles/cards/39057.png` (607×880 px, 133.3 KB)

### [39058] Toad 2.0
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sci-Fi (6/7)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sci-Fi Set Icon (printed bottom-right next to deck number)
- **Traits**: *Program.*
- **Rules Text**:
  > **Forced Response**: After Toad 2.0 engages you, place 1 upgrade you control facedown under Toad 2.0.
  > **When Defeated**: Return each card under Toad 2.0 to its owner's hand.
- **Flavor**: *">Quarantining dangerous subroutine."*
- **Image Asset**: `assets/card-art/bundles/cards/39058.png` (607×880 px, 136.2 KB)

### [39059] ICE-Teroid M
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sci-Fi (7/7)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sci-Fi Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each minion gains guard and patrol.
  > **Forced Interrupt**: At the end of the round *(after the first player token is passed)*, the first player searches the encounter deck and discard pile for a minion and puts it into play engaged with them. *(Shuffle.)*
- **Flavor**: *">Invasive programs detected.
>Intrusion Counter Electronics deployed."*
- **Image Asset**: `assets/card-art/bundles/cards/39059.png` (880×607 px, 212.7 KB)


### Set: Sitcom

### [39060] Mojo in the Middle
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sitcom (1/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sitcom Set Icon (printed bottom-right next to deck number)
- **Traits**: *Setting. Show.*
- **Rules Text**:
  > Each obligation gains 1 acceleration icon ([acceleration]).
  > **Response**: After a player discards an obligation, that player draws 1 card.
  > **When Revealed**: Discard each other [[Setting]] environment in play. If this card was revealed from the encounter deck, it gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/39060.png` (607×880 px, 150.8 KB)

### [39061] Family Matters
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sitcom (2/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sitcom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Treat the printed text box of each support you control as if it were blank *(except for [[Traits]])*.
  > **Alter-Ego Action**: Exhaust your identity and each support you control → discard this obligation.
- **Flavor**: *"I'll never be like you!"
"You're my clone!" —X-23 and Wolverine*
- **Image Asset**: `assets/card-art/bundles/cards/39061.png` (607×880 px, 139.3 KB)

### [39062] Growing Pains
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sitcom (3/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Sitcom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Increase the cost to play each of your upgrades by 2.
  > **Alter-Ego Action**: Discard an upgrade you control or discard an upgrade from your hand. If you have more upgrades in your discard pile than in play, discard this obligation.
- **Flavor**: *"It's not my fault!" —Hope Summers*
- **Image Asset**: `assets/card-art/bundles/cards/39062.png` (607×880 px, 138.9 KB)

### [39063] The Odd Couple
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sitcom (4/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sitcom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Reduce your ally limit by 2.
  > **Alter-Ego Action**: Exhaust 2 characters you control → shuffle an ally from your discard pile into your deck and discard this obligation.
- **Flavor**: *"I'll clean it up later." —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/39063.png` (607×880 px, 132.1 KB)

### [39064] The One with the Breakup
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sitcom (5/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sitcom Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Each encounter card gains peril.
  > **Alter-Ego Action**: Discard 3 cards from your hand and choose a player → the chosen player draws 1 card and you discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/39064.png` (607×880 px, 127.2 KB)

### [39065] Watch Me Play
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Sitcom (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sitcom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 3. Peril.
  > **Forced Interrupt**: When you look up a rule, you are confused.
  > **Alter-Ego Action**: Exhaust your identity and discard a confused status card from it → discard this obligation.
- **Flavor**: *"What does 'you' mean again?!" —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/39065.png` (607×880 px, 133.8 KB)


### Set: Western

### [39066] Wild Wild Mojo
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Western (1/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Western Set Icon (printed bottom-right next to deck number)
- **Traits**: *Setting. Show.*
- **Rules Text**:
  > Each enemy attack gains overkill.
  > **Forced Interrupt**: When a character takes damage, increase that damage by 1.
  > **When Revealed**: Discard each other [[Setting]] environment in play. If this card was revealed from the encounter deck, it gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/39066.png` (607×880 px, 142.6 KB)

### [39067] Dead or Alive
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Western (2/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Western Set Icon (printed bottom-right next to deck number)
- **Traits**: *Bounty.*
- **Rules Text**:
  > Attach to the minion with the highest printed hit points. If you cannot, this card gains surge.
  > Attached minion gets +3 [per_hero] hit points.
  > **Forced Interrupt**: When attached minion is defeated, each player adds 1 card from their discard pile to their hand.
- **Image Asset**: `assets/card-art/bundles/cards/39067.png` (607×880 px, 144.1 KB)

### [39068] Card Shark
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Western (3/6)
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Western Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature. Elite.*
- **Rules Text**:
  > [star] **Forced Response**: After Card Shark attacks you, discard the top 3 cards of your deck. Take indirect damage equal to the number of different printed resources types ([energy], [mental], [physical], or [wild]) discarded this way.
- **Flavor**: *All he does is swim and eat and win at cards.*
- **Image Asset**: `assets/card-art/bundles/cards/39068.png` (607×880 px, 133.8 KB)

### [39069] Gunslinger
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Western (4–5/6, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Western Set Icon (printed bottom-right next to deck number)
- **Traits**: *Outlaw.*
- **Rules Text**:
  > Quickstrike.
  > **Forced Interrupt**: When this minion engages you *(before resolving quickstrike)*, you may spend [energy][energy] resources. If you do, deal damage to this minion equal to your hero's ATK.
- **Flavor**: *"Draw!"*
- **Image Asset**: `assets/card-art/bundles/cards/39069.png` (607×880 px, 135.9 KB)

### [39070] A Game of Cards
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Western (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Western Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Draw 5 cards. Choose and discard 5 cards from your hand. For each different printed resource type ([energy], [mental], [physical], or [wild]) discarded this way, discard an upgrade or support you control.
- **Flavor**: *When you play a game of cards, you win or lose...*
- **Image Asset**: `assets/card-art/bundles/cards/39070.png` (607×880 px, 148.6 KB)


### Set: Longshot

### [39071] Longshot
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Mojo Mania (`mojo`)
- **Deck / Set**: Longshot (1/1)
- **Properties**: Unique
- **Stats**: **THW**: 2 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Longshot Set Icon (printed bottom-right next to deck number)
- **Traits**: *X-Men.*
- **Rules Text**:
  > [star] Longshot's attacks gain piercing.
  > Longshot does not count against your ally limit.
  > **When Revealed**: Put Longshot into play under your control. This card gains surge. This effect cannot be canceled.
- **Image Asset**: `assets/card-art/bundles/cards/39071.png` (607×880 px, 133.1 KB)


