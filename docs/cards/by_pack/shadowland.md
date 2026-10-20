# Marvel Champions Card Reference Database

A complete, generated transcription of the cached MarvelCDB card records in `packages/content/raw/marvelcdb/` (and, for faces MarvelCDB lacks, the scan transcriptions in `packages/content/raw/hallofheroes/`), formatted for AI and rules-engine consumption. Regenerate with `scripts/generate_cards_markdown.py`; do not hand-edit.

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
| `65003a` | The Streets Below | Environment | Shadows in the Night | - | - | `shadowland` |
| `65003b` | Atop the Tenshu | Environment | Shadows in the Night | - | - | `shadowland` |
| `65004a` | The Streets Below | Environment | Shadows in the Night | - | - | `shadowland` |
| `65004b` | Atop the Tenshu | Environment | Shadows in the Night | - | - | `shadowland` |
| `65005` | Black Tarantula | Minion | Shadows in the Night | SCH:2 ATK:2 HP:5 | 3 icons | `shadowland` |
| `65008` | Strategic Positioning | Side Scheme | Shadows in the Night | - | 2 icons | `shadowland` |
| `65010` | Chaos in Hell's Kitchen | Treachery | Shadows in the Night | - | 0 icons + star | `shadowland` |
| `65011` | Moonlit Silhouette | Treachery | Shadows in the Night | - | not recorded in this source | `shadowland` |
| `65012a` | Archpriestess | Villain | Dark Protégé | SCH:2 ATK:1 HP:15 | - | `shadowland` |
| `65013a` | Daredevil | Villain | Dark Protégé | SCH:1 ATK:2 HP:15 | - | `shadowland` |
| `65014a` | Elektra | Villain | Dark Protégé | SCH:1 ATK:2 HP:15 | - | `shadowland` |
| `65015a` | Gorgon | Villain | Dark Protégé | SCH:1 ATK:2 HP:15 | - | `shadowland` |
| `65016a` | Lady Bullseye | Villain | Dark Protégé | SCH:2 ATK:1 HP:15 | - | `shadowland` |
| `65017a` | White Tiger | Villain | Dark Protégé | SCH:1 ATK:0 HP:15 | - | `shadowland` |
| `65018` | Art of the Kill | Attachment | Dark Protégé | - | 1 icon | `shadowland` |
| `65019` | Krahllak's Blessing | Attachment | Dark Protégé | - | 1 icon | `shadowland` |
| `65026` | Darkness Within | Treachery | Dark Protégé | - | 1 icon + star | `shadowland` |
| `65027` | Embraced by Darkness | Treachery | Dark Protégé | - | 1 icon + star | `shadowland` |
| `65028` | Black Mountain | Minion | Ninja Swarm | SCH:2 ATK:2 HP:5 | 0 icons + star | `shadowland` |
| `65030` | Bo Staff Ninja | Minion | Ninja Swarm | SCH:1 ATK:1 HP:2 | 2 icons | `shadowland` |
| `65032` | Katana Ninja | Minion | Ninja Swarm | SCH:1 ATK:1 HP:2 | 1 icon | `shadowland` |
| `65035` | Dancing Shadows | Side Scheme | Ninja Swarm | - | 0 icons + star | `shadowland` |
| `65036` | Countless Numbers | Treachery | Ninja Swarm | - | 1 icon + star | `shadowland` |
| `65037` | Shifting Corridors | Villain | Shadow Labyrinth | SCH:0 ATK:0 HP:0 | - | `shadowland` |
| `65041` | Lord Deathstrike | Minion | Shadow Labyrinth | SCH:2 ATK:2 HP:5 | 0 icons + star | `shadowland` |
| `65042` | Dead End | Side Scheme | Shadow Labyrinth | - | 3 icons | `shadowland` |
| `65044` | No Time to Think! | Treachery | Shadow Labyrinth | - | 1 icon + star | `shadowland` |
| `65045` | Sudden Shift | Treachery | Shadow Labyrinth | - | 2 icons + star | `shadowland` |
| `65046` | Nervous Jitters | Attachment | Deadly Contraptions | - | 1 icon | `shadowland` |
| `65047` | Iron Monk | Minion | Deadly Contraptions | SCH:2 ATK:1 HP:4 | 2 icons | `shadowland` |
| `65048` | Hall of Punishment | Side Scheme | Deadly Contraptions | - | 0 icons + star | `shadowland` |
| `65049` | Path of a Thousand Cuts | Side Scheme | Deadly Contraptions | - | 0 icons + star | `shadowland` |
| `65050` | Blinding Powder | Treachery | Deadly Contraptions | - | not recorded in this source | `shadowland` |
| `65051` | Caltrops | Treachery | Deadly Contraptions | - | 1 icon | `shadowland` |
| `65057` | Krahllak | Villain | Heart of Shadow | SCH:2 ATK:3 HP:18 | - | `shadowland` |
| `65064` | Mark of the Wicked | Attachment | Heart of Shadow | ATK:2 | 3 icons | `shadowland` |
| `65065` | Pull of Power | Attachment | Heart of Shadow | THW:2 | 2 icons | `shadowland` |
| `65067` | Hellbride | Minion | Heart of Shadow | SCH:1 ATK:3 HP:7 | 3 icons | `shadowland` |
| `65069` | Snakeroot Elders | Minion | Heart of Shadow | SCH:1 ATK:2 HP:8 | 3 icons | `shadowland` |
| `65070` | Veil of Nightmares | Side Scheme | Heart of Shadow | - | 2 icons | `shadowland` |
| `65071` | Submit or Suffer | Treachery | Heart of Shadow | - | 0 icons + star | `shadowland` |
| `65072a` | Creeping Corruption | Upgrade | Black Flower | - | not recorded in this source | `shadowland` |
| `65072b` | Creeping Corruption | Upgrade | Black Flower | - | not recorded in this source | `shadowland` |

---

## Pack: Shadowland (`shadowland`)

### Set: Shadows in the Night

### [65003a] The Streets Below
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadows in the Night (3/13)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Shadows in the Night Set Icon (printed bottom-right next to deck number)
- **Traits**: *Villain Position.*
- **Rules Text**:
  > If both positions are the same:
  > • Each character gets +1 ATK.
  > If the positions are different:
  > • Reduce the amount of damage each character takes from each attack by 1.
  > • Threat cannot be removed from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/65003a.png` (300×426 px, 27.9 KB)

### [65003b] Atop the Tenshu
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadows in the Night (3/13)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Shadows in the Night Set Icon (printed bottom-right next to deck number)
- **Traits**: *Villain Position.*
- **Rules Text**:
  > If both positions are the same:
  > • Each character gets +1 ATK.
  > If the positions are different:
  > • Reduce the amount of damage each character takes from each attack by 1.
  > • Threat cannot be removed from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/65003b.png` (300×426 px, 28.4 KB)

### [65004a] The Streets Below
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadows in the Night (4/13)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Shadows in the Night Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hero Position.*
- **Rules Text**:
  > **First Player Action**: Resolve one of the effects below, then flip this card:
  > • Place 3 threat on the main scheme and stun your identity.
  > • Spend [physical][physical] resources.
  > • Spend 1 resource of any type and exhaust an [[Aerial]] character you control.
- **Image Asset**: `assets/card-art/bundles/cards/65004a.png` (300×426 px, 27.8 KB)

### [65004b] Atop the Tenshu
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadows in the Night (4/13)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Shadows in the Night Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hero Position.*
- **Rules Text**:
  > **First Player Action**: Resolve one of the effects below, then flip this card:
  > • Deal 3 damage to your identity.
  > • Spend [energy][energy] resources.
  > • Discard an ally or upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/65004b.png` (300×426 px, 27.1 KB)

### [65005] Black Tarantula
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadows in the Night (5/13)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Shadows in the Night Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Hand.*
- **Rules Text**:
  > Guard.
  > **When Revealed**: Change the villain's position if it has not changed this phase. If the villain's position is Atop the Tenshu, Black Tarantula attacks you; otherwise, give the villain and Black Tarantula each a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/65005.png` (300×426 px, 26.8 KB)

### [65008] Strategic Positioning
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadows in the Night (8/13)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Shadows in the Night Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > While the villain's position is The Streets Below, this scheme gains 1 acceleration icon ([acceleration]).
  > While the villain's position is Atop the Tenshu, this scheme gains 1 hazard icon ([hazard]).
- **Flavor**: *Under Shadowland, the Hand rules the streets.*
- **Image Asset**: `assets/card-art/bundles/cards/65008.png` (426×300 px, 29.3 KB)

### [65010] Chaos in Hell's Kitchen
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadows in the Night (10–11/13, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Shadows in the Night Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Change the villain's position if it has not changed this phase. If the villain's position is Atop the Tenshu, place 2 threat on the main scheme; otherwise, take 2 damage.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/65010.png` (300×426 px, 29.3 KB)

### [65011] Moonlit Silhouette
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadows in the Night (12–13/13, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shadows in the Night Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Change the villain's position if it has not changed this phase. You are confused.
  > **When Revealed (Hero)**: If the villain's position is Atop the Tenshu, the villain schemes; otherwise, the villain attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/65011.png` (300×426 px, 24.2 KB)


### Set: Dark Protégé

### [65012a] Archpriestess
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (1/16)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand.*
- **Rules Text**:
  > [star] **Forced Response**: After Archpriestess attacks you, give a minion a tough status card. If no tough status card was placed this way, discard the top 3 cards of the encounter deck, then deal 1 minion discarded this way to yourself as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/65012a.png` (300×426 px, 27.2 KB)

### [65013a] Daredevil
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (2/16)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand. Possessed.*
- **Rules Text**:
  > **Forced Response**: After you or an ally you control attacks Daredevil, choose: Either discard 1 random card from your hand, or Daredevil attacks you. (Limit once per round per player.)
- **Flavor**: *"Hell's Kitchen is now under the protection of the Hand!"*
- **Image Asset**: `assets/card-art/bundles/cards/65013a.png` (300×426 px, 28.5 KB)

### [65014a] Elektra
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (3/16)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand. Possessed.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Elektra attacks you, discard the top card of your deck. If that card's printed cost is an odd number, Elektra gets +1 ATK for this attack; otherwise, this attack gains overkill and piercing.
- **Flavor**: *"The Hand guides me, and death follows."*
- **Image Asset**: `assets/card-art/bundles/cards/65014a.png` (300×426 px, 30.0 KB)

### [65015a] Gorgon
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (4/16)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Gorgon attacks you, choose:
  > • Spend a [physical] resource.
  > • Stun your identity.
  > • Take 2 indirect damage.
- **Flavor**: *"I've died and been born again. There is nothing I fear."*
- **Image Asset**: `assets/card-art/bundles/cards/65015a.png` (300×426 px, 26.3 KB)

### [65016a] Lady Bullseye
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (5/16)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand.*
- **Rules Text**:
  > [star] **Forced Response**: After Lady Bullseye attacks you, if that attack was undefended, take 1 indirect damage; otherwise, place 1 threat on the main scheme.
- **Flavor**: *"I plan to take my time with you."*
- **Image Asset**: `assets/card-art/bundles/cards/65016a.png` (300×426 px, 26.8 KB)

### [65017a] White Tiger
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (6/16)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 0 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand. Possessed.*
- **Rules Text**:
  > [star] **Forced Response**: After White Tiger attacks you, she attacks you again with +1 ATK. (Limit once per round per player.)
- **Flavor**: *"Civilization will fall into chaos and darkness, and we who walk the left-hand path will kneel before the Beast!"*
- **Image Asset**: `assets/card-art/bundles/cards/65017a.png` (300×426 px, 28.0 KB)

### [65018] Art of the Kill
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (7/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Linked (Elektra, Lady Bullseye, or White Tiger).
  > Attach to your identity.
  > **Forced Interrupt**: When an enemy attacks you, it gets +1 ATK for that attack. If that attack defeats a character, place 1 threat on the main scheme.
  > **Alter-Ego Action**: Spend [energy][mental][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/65018.png` (300×426 px, 28.8 KB)

### [65019] Krahllak's Blessing
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (8/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition. Spell.*
- **Rules Text**:
  > Linked (Archpriestess, Daredevil, or Gorgon).
  > Attach to the villain.
  > **Forced Interrupt**: When attached villain would take any amount of damage from a character, reduce that amount by 3. Attached villain attacks that character. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/65019.png` (300×426 px, 29.6 KB)

### [65026] Darkness Within
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (15/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Linked (Archpriestess, Gorgon, or Lady Bullseye).
  > **When Revealed**: Change to hero form. The villain attacks you.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/65026.png` (300×426 px, 20.6 KB)

### [65027] Embraced by Darkness
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Dark Protégé (16/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Dark Protégé Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Linked (Daredevil, Elektra, or White Tiger).
  > **When Revealed**: The villain schemes. If 2 or less threat was placed on the main scheme this way, discard the top 3 cards of the encounter deck.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/65027.png` (300×426 px, 23.1 KB)


### Set: Ninja Swarm

### [65028] Black Mountain
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Ninja Swarm (1/9)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Ninja Swarm Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Hand. Ninja.*
- **Rules Text**:
  > Guard.
  > While Black Mountain is engaged with you, each other [[Ninja]] minion engaged with you cannot be attacked.
  >
  > ---
  >
  > [star] **Boost**: If an ally is defending against this attack, reveal this minion.
- **Image Asset**: `assets/card-art/bundles/cards/65028.png` (300×426 px, 28.2 KB)

### [65030] Bo Staff Ninja
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Ninja Swarm (3/9)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ninja Swarm Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand. Ninja.*
- **Rules Text**:
  > Teamwork ([[Ninja]]). Toughness.
  > **When Defeated**: The defeating player discards the top 2 cards of the encounter deck and reveals the first minion with the teamwork keyword discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/65030.png` (300×426 px, 29.0 KB)

### [65032] Katana Ninja
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Ninja Swarm (5/9)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ninja Swarm Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand. Ninja.*
- **Rules Text**:
  > Guard. Teamwork ([[Ninja]]).
  > **When Defeated**: The defeating player discards the top 2 cards of the encounter deck and reveals the first minion with the teamwork keyword discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/65032.png` (300×426 px, 24.9 KB)

### [65035] Dancing Shadows
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Ninja Swarm (8/9)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Ninja Swarm Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[Ninja]] minion gets +1 hit point.
  > Threat cannot be removed from this scheme while at least 1 [[Ninja]] minion is in play.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/65035.png` (426×300 px, 26.5 KB)

### [65036] Countless Numbers
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Ninja Swarm (9/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Ninja Swarm Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Shuffle each [[Ninja]] minion in the encounter discard pile into the encounter deck.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/65036.png` (300×426 px, 26.2 KB)


### Set: Shadow Labyrinth

### [65037] Shifting Corridors
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadow Labyrinth (1/11)
- **Properties**: Stage A
- **Stats**: **SCH**: 0 [star], **ATK**: 0 [star], **HP**: 0
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Shadow Labyrinth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location.*
- **Rules Text**:
  > Stalwart.
  > [star] **Forced Interrupt**: When Shifting Corridors would activate against you, instead remove 1 passage counter from here and reveal the top card of the trap deck.
  > **If the last passage counter is removed from here, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/65037.png` (300×426 px, 27.6 KB)

### [65041] Lord Deathstrike
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadow Labyrinth (5/11)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Shadow Labyrinth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand.*
- **Rules Text**:
  > Patrol.
  > **When Revealed**: If Shifting Corridors is in play, shuffle the top 2 cards of the encounter deck into the trap deck; otherwise, reveal the top card of the trap deck.
  >
  > ---
  >
  > [star] **Boost**: Put this minion into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/65041.png` (300×426 px, 24.2 KB)

### [65042] Dead End
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadow Labyrinth (6/11)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Shadow Labyrinth Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Assault. *(Basic thwarts against this scheme use ATK instead of THW.)*
  > **When Revealed**: If Shifting Corridors is in play, remove 1 passage counter from it; otherwise, place 1 [per_hero] threat here.
- **Image Asset**: `assets/card-art/bundles/cards/65042.png` (426×300 px, 25.6 KB)

### [65044] No Time to Think!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadow Labyrinth (8–9/11, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Shadow Labyrinth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. *(While you are resolving this card, other players cannot help you.)*
  > **When Revealed**: The villain activates against you.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, this card gains [boost][boost] and this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/65044.png` (300×426 px, 23.0 KB)

### [65045] Sudden Shift
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Shadow Labyrinth (10–11/11, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Shadow Labyrinth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Shuffle the trap discard pile and the top 3 cards of the encounter deck into the trap deck. Reveal the top card of the trap deck.
  >
  > ---
  >
  > [star] **Boost**: Shuffle the trap discard pile and the top 2 cards of the encounter deck into the trap deck.
- **Image Asset**: `assets/card-art/bundles/cards/65045.png` (300×426 px, 22.0 KB)


### Set: Deadly Contraptions

### [65046] Nervous Jitters
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Deadly Contraptions (1/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deadly Contraptions Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Interrupt**: When you choose the "*Avoid*" effect or the "*Disarm*" effect on a [[Trap!]] card, name an encounter card type, then discard the top card of the encounter deck. If the card discarded this way was not of the named type, take 4 indirect damage and discard this attachment.
- **Image Asset**: `assets/card-art/bundles/cards/65046.png` (300×426 px, 29.8 KB)

### [65047] Iron Monk
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Deadly Contraptions (2/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deadly Contraptions Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand. Mystic.*
- **Rules Text**:
  > Patrol. Toughness.
  > While Iron Monk is engaged with you, you cannot choose the "*Avoid*" effect on [[Trap!]] cards.
- **Flavor**: *"Your only path is through me. Let us begin."*
- **Image Asset**: `assets/card-art/bundles/cards/65047.png` (300×426 px, 27.3 KB)

### [65048] Hall of Punishment
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Deadly Contraptions (3/6)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Deadly Contraptions Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **Forced Interrupt**: When you choose the "*Trip*" effect on a [[Trap!]] card, discard the top 3 cards of your deck.
  >
  > ---
  >
  > [star] **Boost**: Place 1 threat on the main scheme for each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/65048.png` (426×300 px, 24.4 KB)

### [65049] Path of a Thousand Cuts
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Deadly Contraptions (4/6)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Deadly Contraptions Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When you choose the "*Avoid*" effect or the "*Trip*" effect on a [[Trap!]] card, take 2 indirect damage.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to each character you control.
- **Flavor**: *Every step is a test of resilience.*
- **Image Asset**: `assets/card-art/bundles/cards/65049.png` (426×300 px, 25.2 KB)

### [65050] Blinding Powder
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Deadly Contraptions (5/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Deadly Contraptions Set Icon (printed bottom-right next to deck number)
- **Traits**: *Trap!*
- **Rules Text**:
  > **When Revealed**: Choose:
  > • *Avoid* — Discard a [[Thwart]] event from your hand.
  > • *Disarm* — Discard 2 cards at random from your hand, then give a character you control a tough status card.
  > • *Trip* — Deal 2 damage to your identity and confuse it.
- **Image Asset**: `assets/card-art/bundles/cards/65050.png` (300×426 px, 18.8 KB)

### [65051] Caltrops
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Deadly Contraptions (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deadly Contraptions Set Icon (printed bottom-right next to deck number)
- **Traits**: *Trap!*
- **Rules Text**:
  > **When Revealed**: Choose:
  > • *Avoid* — Discard a [[Defense]] event from your hand.
  > • *Disarm* — Discard 1 identity-specific card from your hand, then deal 2 damage to an enemy.
  > • *Trip* — Deal 2 damage to your identity and stun it.
- **Image Asset**: `assets/card-art/bundles/cards/65051.png` (300×426 px, 21.5 KB)


### Set: Heart of Shadow

### [65057] Krahllak
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Heart of Shadow (1/17)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Heart of Shadow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Demon. Hand.*
- **Rules Text**:
  > Steady.
  > [star] **Interrupt**: When Krahllak attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, Krahllak gets -3 ATK for this attack.
- **Flavor**: *"There is only the Beast!"*
- **Image Asset**: `assets/card-art/bundles/cards/65057.png` (300×426 px, 25.0 KB)

### [65064] Mark of the Wicked
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Heart of Shadow (8/17)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heart of Shadow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spell.*
- **Rules Text**:
  > **When Revealed**: You may attach this card to your identity. If you do not, take 4 damage, stun your identity, remove 1 corruption counter from your Creeping Corruption, and discard this card.
  > [star] **Forced Response**: After attached hero makes a basic attack, place 1 corruption counter on your Creeping Corruption.
- **Image Asset**: `assets/card-art/bundles/cards/65064.png` (300×426 px, 32.7 KB)

### [65065] Pull of Power
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Heart of Shadow (9/17)
- **Stats**: **THW**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heart of Shadow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spell.*
- **Rules Text**:
  > **When Revealed**: You may attach this card to your identity. If you do not, take 4 damage, confuse your identity, remove 1 corruption counter from your Creeping Corruption, and discard this card.
  > [star] **Forced Response**: After attached hero makes a basic thwart, place 1 corruption counter on your Creeping Corruption.
- **Image Asset**: `assets/card-art/bundles/cards/65065.png` (300×426 px, 32.3 KB)

### [65067] Hellbride
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Heart of Shadow (11/17)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heart of Shadow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Demon. Hand.*
- **Rules Text**:
  > **When Defeated**: The defeating player places 2 corruption counters on their Creeping Corruption, then heals 6 damage from their identity.
  > **Hero Action**: If Hellbride has 2 or fewer remaining hit points, exhaust your hero → discard Hellbride. Remove 1 corruption counter from your Creeping Corruption.
- **Image Asset**: `assets/card-art/bundles/cards/65067.png` (300×426 px, 33.2 KB)

### [65069] Snakeroot Elders
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Heart of Shadow (13/17)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heart of Shadow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand. Mystic. Ninja.*
- **Rules Text**:
  > While there is at least 1 corruption counter here, Snakeroot Elders gains guard and patrol.
  > **When Revealed**: You may place 1 corruption counter on your Creeping Corruption. If you do not, place 1 corruption counter here.
- **Image Asset**: `assets/card-art/bundles/cards/65069.png` (300×426 px, 32.9 KB)

### [65070] Veil of Nightmares
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Heart of Shadow (14–15/17, Qty: 2)
- **Stats**: **Base Threat**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heart of Shadow Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **Hero Action**: Place 1 corruption counter on your Creeping Corruption → remove 5 threat from this scheme.
- **Flavor**: *Krahllak's dark magic can tap into a person's deepest fears.*
- **Image Asset**: `assets/card-art/bundles/cards/65070.png` (426×300 px, 23.7 KB)

### [65071] Submit or Suffer
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Heart of Shadow (16–17/17, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Heart of Shadow Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose: Either place 1 corruption counter on your Creeping Corruption, or remove 1 corruption counter from your Creeping Corruption and Krahllak attacks you.
  >
  > ---
  >
  > [star] **Boost**: Choose: Either place 1 corruption counter on your Creeping Corruption, or stun your identity.
- **Image Asset**: `assets/card-art/bundles/cards/65071.png` (300×426 px, 27.7 KB)


### Set: Black Flower

### [65072a] Creeping Corruption
- **Type**: `Upgrade`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Black Flower (1/1)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Black Flower Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent. Setup. Max 1 per player.
  > If there are at least 5 corruption counters here, remove each of them from here and flip this card.
  > **Action**: Exhaust Creeping Corruption and place 1 corruption counter here → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/65072a.png` (300×426 px, 21.8 KB)

### [65072b] Creeping Corruption
- **Type**: `Upgrade`
- **Faction / Aspect**: Encounter
- **Pack**: Shadowland (`shadowland`)
- **Deck / Set**: Black Flower (1/1)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Black Flower Set Icon (printed bottom-right next to deck number)
- **Traits**: *Overpowering.*
- **Rules Text**:
  > Permanent. Max 1 per player.
  > **If there are at least 5 corruption counters here, you are defeated.**
  > **Action**: Exhaust Creeping Corruption and place 1 corruption counter here → draw 2 cards, then discard 1 card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/65072b.png` (300×426 px, 22.8 KB)


