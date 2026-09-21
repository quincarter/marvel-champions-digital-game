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
| `90001` | Ronan the Accuser | Minion | Kree Fanatic | SCH:3 ATK:3 HP:9 | 0 icons + star | `ron` |
| `90002` | Judge, Jury, Executioner | Side Scheme | Kree Fanatic | - | 0 icons + star | `ron` |
| `90003` | The Accused | Attachment | Kree Fanatic | - | 0 icons + star | `ron` |
| `90004` | Bring the Hammer Down | Treachery | Kree Fanatic | - | 3 icons + star | `ron` |
| `90005` | You Dare Oppose Me? | Treachery | Kree Fanatic | - | 2 icons + star | `ron` |

---

## Pack: Ronan Modular Set (`ron`)

### Set: Kree Fanatic

### [90001] Ronan the Accuser
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Ronan Modular Set (`ron`)
- **Deck / Set**: Kree Fanatic (1/7)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 3, **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kree Fanatic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Accuser Corps. Elite. Kree.*
- **Rules Text**:
  > Toughness.
  > Ronan the Accuser cannot be stunned.
  > **Forced Interrupt**: When the villain phase begins, Ronan the Accuser engages the hero with the fewest remaining hit points.
  >
  > ---
  >
  > [star] **Boost**: Put Ronan the Accuser into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/90001.png` (246×349 px, 118.5 KB)

### [90002] Judge, Jury, Executioner
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Ronan Modular Set (`ron`)
- **Deck / Set**: Kree Fanatic (2/7)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kree Fanatic Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Response**: After a friendly character is defeated by an enemy attack, place 2 threat on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: Put Judge, Jury, Executioner into play.
- **Image Asset**: `assets/card-art/bundles/cards/90002.png` (349×246 px, 115.0 KB)

### [90003] The Accused
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Ronan Modular Set (`ron`)
- **Deck / Set**: Kree Fanatic (3/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kree Fanatic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Interrupt**: When an enemy initiates an attack against the attached identity, that enemy gets +1 ATK for the attack.
  > **Forced Response**: After Ronan the Accuser is defeated, discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach to your identity.
- **Image Asset**: `assets/card-art/bundles/cards/90003.png` (246×349 px, 139.3 KB)

### [90004] Bring the Hammer Down
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Ronan Modular Set (`ron`)
- **Deck / Set**: Kree Fanatic (4–5/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kree Fanatic Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Ronan the Accuser activates against the player he is engaged with. If Ronan the Accuser is not in play, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If this activation defeats a character, deal the first player 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/90004.png` (246×349 px, 129.9 KB)

### [90005] You Dare Oppose Me?
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Ronan Modular Set (`ron`)
- **Deck / Set**: Kree Fanatic (6–7/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kree Fanatic Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top 5 cards of the encounter deck. Each time a card belonging to the Kree Fanatic set is discarded this way, deal that card to yourself as a facedown encounter card.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, that attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/90005.png` (246×349 px, 126.8 KB)


