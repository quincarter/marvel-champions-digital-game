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
| `24001` | The Hood | Villain | The Hood | SCH:1 ATK:1 HP:14 | - | `hood` |
| `24002` | The Hood | Villain | The Hood | SCH:2 ATK:1 HP:16 | - | `hood` |
| `24003` | The Hood | Villain | The Hood | SCH:3 ATK:2 HP:18 | - | `hood` |
| `24004` | Making Connections | Main Scheme | The Hood | - | - | `hood` |
| `24004a` | Making Connections | Main Scheme | The Hood | - | - | `hood` |
| `24004b` | Making Connections | Main Scheme | The Hood | - | - | `hood` |
| `24005` | Promised Prosperity | Main Scheme | The Hood | - | - | `hood` |
| `24005a` | Promised Prosperity | Main Scheme | The Hood | - | - | `hood` |
| `24005b` | Promised Prosperity | Main Scheme | The Hood | - | - | `hood` |
| `24006` | Crime State | Main Scheme | The Hood | - | - | `hood` |
| `24006a` | Crime State | Main Scheme | The Hood | - | - | `hood` |
| `24006b` | Crime State | Main Scheme | The Hood | - | - | `hood` |
| `24007` | Established Dominance | Attachment | The Hood | - | 2 icons | `hood` |
| `24008` | The Hood's Mantle | Attachment | The Hood | - | not recorded in this source | `hood` |
| `24009` | The Hood's Pistol | Attachment | The Hood | SCH:1 ATK:1 | 0 icons + star | `hood` |
| `24010` | Madame Masque | Minion | The Hood | SCH:1 ATK:2 HP:4 | 3 icons | `hood` |
| `24011` | Unbridled Ambition | Side Scheme | The Hood | - | 2 icons | `hood` |
| `24012` | Field Recruitment | Treachery | The Hood | - | 1 icon + star | `hood` |
| `24013` | Upper Hand | Treachery | The Hood | - | 1 icon | `hood` |
| `24014` | Beast Mode | Side Scheme | Beasty Boys | - | 3 icons | `hood` |
| `24015` | Griffin | Minion | Beasty Boys | SCH:1 ATK:3 HP:7 | 2 icons | `hood` |
| `24016` | Mandrill | Minion | Beasty Boys | SCH:2 ATK:2 HP:6 | 2 icons | `hood` |
| `24017` | Double Trouble | Treachery | Beasty Boys | - | 0 icons + star | `hood` |
| `24018` | Brothers Grimm | Minion | Brothers Grimm | SCH:1 ATK:1 HP:8 | 1 icon + star | `hood` |
| `24019` | Blackbird Pellets | Attachment | Brothers Grimm | - | not recorded in this source | `hood` |
| `24020` | Corrosive Egg Bomb | Attachment | Brothers Grimm | - | 1 icon | `hood` |
| `24021` | Paralytic Stardust | Attachment | Brothers Grimm | - | 2 icons | `hood` |
| `24022` | Unbreakable Thread | Attachment | Brothers Grimm | - | 3 icons | `hood` |
| `24023` | Out for Blood | Side Scheme | Crossfire's Crew | - | 0 icons + star | `hood` |
| `24024` | Controller | Minion | Crossfire's Crew | SCH:2 ATK:1 HP:5 | 2 icons | `hood` |
| `24025` | Corruptor | Minion | Crossfire's Crew | SCH:1 ATK:2 HP:4 | 1 icon + star | `hood` |
| `24026` | Crossfire | Minion | Crossfire's Crew | SCH:2 ATK:2 HP:4 | 3 icons | `hood` |
| `24027` | Mister Fear | Minion | Crossfire's Crew | SCH:1 ATK:1 HP:5 | 1 icon + star | `hood` |
| `24028` | Caught in the Crossfire | Treachery | Crossfire's Crew | - | 1 icon | `hood` |
| `24029` | Cruel Intentions | Treachery | Expert II | - | 1 icon + star | `hood` |
| `24030` | Ruination | Treachery | Expert II | - | 4 icons | `hood` |
| `24031` | Seek and Destroy | Treachery | Expert II | - | 3 icons | `hood` |
| `24032` | Slug It Out | Treachery | Expert II | - | 0 icons + star | `hood` |
| `24033` | Self-Experimentation | Side Scheme | Mister Hyde | - | 2 icons | `hood` |
| `24034` | Calvin Zabo | Minion | Mister Hyde | SCH:3 ATK:1 HP:4 | 1 icon | `hood` |
| `24035` | Mister Hyde | Minion | Mister Hyde | SCH:1 ATK:3 HP:10 | 3 icons | `hood` |
| `24036` | Hyde Formula | Treachery | Mister Hyde | - | 1 icon | `hood` |
| `24037` | Flamethrower | Attachment | Ransacked Armory | ATK:3 | 2 icons | `hood` |
| `24038` | Holoshield Generator | Attachment | Ransacked Armory | - | 1 icon | `hood` |
| `24039` | Jetpack | Attachment | Ransacked Armory | - | 1 icon | `hood` |
| `24040` | Tech Gauntlets | Attachment | Ransacked Armory | ATK:1 | 2 icons | `hood` |
| `24041` | Armored Guard | Minion | Ransacked Armory | SCH:0 ATK:1 HP:3 | 1 icon | `hood` |
| `24042` | Crime Pays | Side Scheme | Sinister Syndicate | - | 3 icons | `hood` |
| `24043` | Beetle | Minion | Sinister Syndicate | SCH:1 ATK:2 HP:4 | 0 icons + star | `hood` |
| `24044` | Boomerang | Minion | Sinister Syndicate | SCH:2 ATK:1 HP:5 | 1 icon + star | `hood` |
| `24045` | Shocker | Minion | Sinister Syndicate | SCH:1 ATK:2 HP:5 | 0 icons + star | `hood` |
| `24046` | Speed Demon | Minion | Sinister Syndicate | SCH:1 ATK:2 HP:3 | 0 icons + star | `hood` |
| `24047` | White Rabbit | Minion | Sinister Syndicate | SCH:2 ATK:2 HP:3 | 1 icon + star | `hood` |
| `24048` | Sinister Onslaught | Treachery | Sinister Syndicate | - | not recorded in this source | `hood` |
| `24049` | Formidable Foe | Environment | Standard II | - | - | `hood` |
| `24049a` | Formidable Foe | Environment | Standard II | - | - | `hood` |
| `24049b` | Formidable Foe | Environment | Standard II | - | - | `hood` |
| `24050` | Dark Dealings | Treachery | Standard II | - | 1 icon + star | `hood` |
| `24051` | Mob Mentality | Treachery | Standard II | - | 2 icons | `hood` |
| `24052` | Overwhelming Force | Treachery | Standard II | - | 2 icons + star | `hood` |
| `24053` | Shadow of the Past | Treachery | Standard II | - | 2 icons | `hood` |
| `24054` | Total Annihilation | Treachery | Standard II | - | 1 icon + star | `hood` |
| `24055` | Feisty Heist | Side Scheme | State of Emergency | - | 3 icons | `hood` |
| `24056` | Disaster at the Docks | Side Scheme | State of Emergency | - | 2 icons | `hood` |
| `24057` | Offshore Inferno | Side Scheme | State of Emergency | - | 2 icons | `hood` |
| `24058` | Hot Pursuit | Side Scheme | State of Emergency | - | 3 icons | `hood` |
| `24059` | Citywide Crisis | Treachery | State of Emergency | - | 0 icons + star | `hood` |
| `24060` | Back-Alley Enclave | Environment | Streets of Mayhem | - | 2 icons | `hood` |
| `24061` | Secret Lair | Environment | Streets of Mayhem | - | 2 icons | `hood` |
| `24062` | Sewer Tunnels | Environment | Streets of Mayhem | - | 2 icons | `hood` |
| `24063` | Warehouse District | Environment | Streets of Mayhem | - | 2 icons | `hood` |
| `24064` | Top Talent | Side Scheme | Wrecking Crew | - | 2 icons | `hood` |
| `24065` | Wrecker | Minion | Wrecking Crew | SCH:2 ATK:2 HP:8 | 3 icons | `hood` |
| `24066` | Bulldozer | Minion | Wrecking Crew | SCH:1 ATK:3 HP:7 | 2 icons | `hood` |
| `24067` | Piledriver | Minion | Wrecking Crew | SCH:2 ATK:2 HP:6 | 2 icons | `hood` |
| `24068` | Thunderball | Minion | Wrecking Crew | SCH:3 ATK:1 HP:7 | 3 icons | `hood` |
| `24069` | Combined Effort | Treachery | Wrecking Crew | - | 1 icon + star | `hood` |
| `24070` | Magic Muscle | Treachery | Wrecking Crew | - | 2 icons | `hood` |

---

## Pack: The Hood (`hood`)

### Set: The Hood

### [24001] The Hood
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (1/16)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > *Foul Play* - **Special**: Discard the top card of the encounter deck. If that card does not belong to The Hood encounter set, deal it to yourself as a facedown encounter card.
- **Flavor**: *"If you're not with me, you're on your own"*
- **Image Asset**: `assets/card-art/bundles/cards/24001.png` (300×435 px, 60.2 KB)

### [24002] The Hood
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (2/16)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck.
  > *Foul Play* - **Special**: Discard the top 2 cards of the encounter deck. Deal the first card discarded this way that does not belong to The Hood encounter set to yourself as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/24002.png` (300×435 px, 61.6 KB)

### [24003] The Hood
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (3/16)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck.
  > *Foul Play* - **Special**: Discard the top 2 cards of the encounter deck. Deal each card discarded this way that does not belong to The Hood encounter set to yourself as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/24003.png` (300×435 px, 61.5 KB)

### [24004] Making Connections
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (4/16)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Each player must resolve The Hood's "Foul Play" ability in player order.
- **Reverse Side**: Making Connections
  > **Contents:** The Hood (I) and The Hood (II). *(The Hood (II) and The Hood(III) instead for expert mode.)* The Hood and Standard encounter sets.
  > **Setup:** Choose 7 modular encounter sets and set them aside (you may choose randomly). Choose 1 of those sets at random, then shuffle it intro the encounter deck.
- **Flavor**: *The Hood is recruiting an army, convincing various villains that they are stronger together than they are apart.*
- **Image Asset**: `assets/card-art/bundles/cards/24004.jpg` (435×300 px, 53.8 KB)

### [24004a] Making Connections
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (4/16)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: The Hood (I) and The Hood (II). *(The Hood (II) and The Hood(III) instead for expert mode.)* The Hood and Standard encounter sets.
  > **Setup**: Choose 7 modular encounter sets and set them aside (you may choose randomly). Choose 1 of those sets at random, then shuffle it intro the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/24004a.png` (435×300 px, 53.8 KB)

### [24004b] Making Connections
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (4/16)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player must resolve The Hood's "Foul Play" ability in player order.
- **Flavor**: *The Hood is recruiting an army, convincing various villains that they are stronger together than they are apart.*
- **Image Asset**: `assets/card-art/bundles/cards/24004b.png` (435×300 px, 55.9 KB)

### [24005] Promised Prosperity
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (5/16)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Each player must resolve The Hood's "Foul Play" ability in player order. For each player who was not dealt at least 1 facedown encounter card this way, place 2 threat here.
- **Reverse Side**: Promised Prosperity
  > **When Revealed:** Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck. Place 1 acceleration token on the main scheme.
  - **Back Flavor**: *Through hard work, determination, and a lot of illegal activity, the Hood has expanded his empire, gathering a formidable force that threatens the safety of every citizen in New York City.*
- **Image Asset**: `assets/card-art/bundles/cards/24005.png` (435×300 px, 53.8 KB)

### [24005a] Promised Prosperity
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (5/16)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck. Place 1 acceleration token on the main scheme.
- **Flavor**: *Through hard work, determination, and a lot of illegal activity, the Hood has expanded his empire, gathering a formidable force that threatens the safety of every citizen in New York City.*
- **Image Asset**: `assets/card-art/bundles/cards/24005a.png` (435×300 px, 53.8 KB)

### [24005b] Promised Prosperity
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (5/16)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player must resolve The Hood's "Foul Play" ability in player order. For each player who was not dealt at least 1 facedown encounter card this way, place 2 threat here.
- **Image Asset**: `assets/card-art/bundles/cards/24005b.png` (435×300 px, 58.5 KB)

### [24006] Crime State
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (6/16)
- **Properties**: Stage 3, Double-Sided
- **Stats**: **Base Threat**: 3 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, each player must resolve The Hood's *"Foul Play"* ability in player order.
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**: Crime State
  > **When Revealed:** Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck. Place 1 acceleration token on the main scheme. Each player must resolve The Hood's "Foul Play" ability in player order.
  - **Back Flavor**: *With a legion of villains at his side, the Hood has established a domain of depravity that even the strongest heroes would be wise to fear.*
- **Image Asset**: `assets/card-art/bundles/cards/24006.png` (435×300 px, 54.2 KB)

### [24006a] Crime State
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (6/16)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck. Place 1 acceleration token on the main scheme. Each player must resolve The Hood's "Foul Play" ability in player order.
- **Flavor**: *With a legion of villains at his side, the Hood has established a domain of depravity that even the strongest heroes would be wise to fear.*
- **Image Asset**: `assets/card-art/bundles/cards/24006a.png` (435×300 px, 54.2 KB)

### [24006b] Crime State
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (6/16)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 3 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, each player must resolve The Hood's *"Foul Play"* ability in player order.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/24006b.png` (435×300 px, 59.5 KB)

### [24007] Established Dominance
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (7/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity.
  > **Forced Response**: After The Hood activates against you, resolve his "Foul Play" ability
  > **Alter-Ego Action**: Exhaust your identity and place 2 threat on the main scheme → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/24007.png` (300×435 px, 57.7 KB)

### [24008] The Hood's Mantle
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (8/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to The Hood.
  > The Hood gains retaliate 1 and steady. *(Steady characters require 2 status cards of the same type to be stunned or confused.)*
  > **Hero Action**: Spend [energy][mental][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/24008.png` (300×435 px, 54.6 KB)

### [24009] The Hood's Pistol
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (9–10/16, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to The Hood.
  > **Hero Action**: Spend [mental][physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/24009.png` (300×435 px, 52.2 KB)

### [24010] Madame Masque
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (11/16)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Masters of Evil.*
- **Rules Text**:
  > Guard.
  > **When Revealed**: Resolve The Hood's "Foul Play" ability.
  > **When Defeated**: The defeating player must resolve The Hood's "Foul Play" ability.
- **Image Asset**: `assets/card-art/bundles/cards/24010.png` (300×435 px, 61.1 KB)

### [24011] Unbridled Ambition
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (12/16)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 2 [per_hero]. *(When revealed, place 2 [per_hero] threat here.)*
  > **Forced Interrupt**: When the villain phase begins, each player must resolve The Hood's "Foul Play" ability in player order.
- **Image Asset**: `assets/card-art/bundles/cards/24011.png` (435×300 px, 57.3 KB)

### [24012] Field Recruitment
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (13/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck. Resolve The Hood's *"Foul Play"* ability. Remove this card from the game.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, resolve The Hood's "Foul Play" ability.
- **Image Asset**: `assets/card-art/bundles/cards/24012.png` (300×435 px, 65.7 KB)

### [24013] Upper Hand
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: The Hood (14–16/16, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Hood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The Hood schemes. Resolve The Hood's "Foul Play" ability.
  > **When Revealed (Hero)**: The Hood attacks you. Resolve The Hood's "Foul Play" ability.
- **Image Asset**: `assets/card-art/bundles/cards/24013.png` (300×435 px, 60.0 KB)


### Set: Beasty Boys

### [24014] Beast Mode
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Beasty Boys (1/4)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Beasty Boys Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When a stunned or confused friendly character would take any amount of damage, increase that amount by 1.
- **Flavor**: *"The only good superhero is a dead one." —Griffin*
- **Image Asset**: `assets/card-art/bundles/cards/24014.png` (435×300 px, 56.2 KB)

### [24015] Griffin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Beasty Boys (2/4)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Beasty Boys Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Masters of Evil.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After Griffin attacks and damages a character, stun that character.
  > **When Defeated**: If there is a stunned friendly character in play, shuffle Griffin into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/24015.png` (300×435 px, 58.3 KB)

### [24016] Mandrill
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Beasty Boys (3/4)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Beasty Boys Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Crossfire's Crew.*
- **Rules Text**:
  > Mandrill gains retaliate X, where X is equal to the number of confused characters *(friendly or enemy)* in play.
  > **When Revealed**: Confuse each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/24016.png` (300×435 px, 61.6 KB)

### [24017] Double Trouble
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Beasty Boys (4/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Beasty Boys Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Stun a character you control. Confuse a character you control.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/24017.png` (300×435 px, 58.2 KB)


### Set: Brothers Grimm

### [24018] Brothers Grimm
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Brothers Grimm (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Brothers Grimm Set Icon (printed bottom-right next to deck number)
- **Traits**: *Masters of Evil. Mystic.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Brothers Grimm activates against you, discard cards from the top of the encounter deck until an attachment is discarded. Reveal that card.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, put Brothers Grimm into play engaged with the first player.
- **Image Asset**: `assets/card-art/bundles/cards/24018.png` (300×435 px, 65.5 KB)

### [24019] Blackbird Pellets
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Brothers Grimm (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Brothers Grimm Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to a [[Mystic]] minion. If you cannot, attach to the villain.
  > [star] **Forced Response**: After attached enemy activates against you, discard this card → discard 1 card at random from your hand and deal yourself 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/24019.png` (300×435 px, 62.2 KB)

### [24020] Corrosive Egg Bomb
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Brothers Grimm (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brothers Grimm Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to a [[Mystic]] minion. If you cannot, attach to the villain.
  > [star] **Forced Response**: After attached enemy activates against you, discard this card → take 3 indirect damage and deal yourself 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/24020.png` (300×435 px, 61.2 KB)

### [24021] Paralytic Stardust
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Brothers Grimm (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brothers Grimm Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to a [[Mystic]] minion. If you cannot, attach to the villain.
  > [star] **Forced Response**: After attached enemy activates against you, discard this card → stun your identity and deal yourself 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/24021.png` (300×435 px, 61.1 KB)

### [24022] Unbreakable Thread
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Brothers Grimm (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brothers Grimm Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to a [[Mystic]] minion. If you cannot, attach to the villain.
  > [star] **Forced Response**: After attached enemy activates against you, discard this card → choose and discard 1 ally, support, or upgrade you control and deal yourself 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/24022.png` (300×435 px, 63.5 KB)


### Set: Crossfire's Crew

### [24023] Out for Blood
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Crossfire's Crew (1/6)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Crossfire's Crew Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to the friendly character with the fewest remaining hit points. If that character is defeated this way, repeat this effect.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/24023.png` (435×300 px, 58.3 KB)

### [24024] Controller
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Crossfire's Crew (2/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossfire's Crew Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Crossfire's Crew.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Controller's attack would deal any amount of damage to a character, increase that amount by that character's ATK.
- **Flavor**: *"No one avoids wearing my diabolical discs!"*
- **Image Asset**: `assets/card-art/bundles/cards/24024.png` (300×435 px, 56.9 KB)

### [24025] Corruptor
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Crossfire's Crew (3/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Crossfire's Crew Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Crossfire's Crew.*
- **Rules Text**:
  > **When Revealed**: Exhaust each ally you control. Place 1 threat on the main scheme for each ally exhausted this way.
  >
  > ---
  >
  > [star] **Boost**: Choose and exhaust a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/24025.png` (300×435 px, 57.3 KB)

### [24026] Crossfire
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Crossfire's Crew (4/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossfire's Crew Set Icon (printed bottom-right next to deck number)
- **Traits**: *Crossfire's Crew. Masters of Evil.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Interrupt**: When Crossfire attacks, he attacks the friendly character with the fewest remaining hit points. That attack gains overkill and ranged.
- **Image Asset**: `assets/card-art/bundles/cards/24026.png` (300×435 px, 57.9 KB)

### [24027] Mister Fear
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Crossfire's Crew (5/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Crossfire's Crew Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Crossfire's Crew.*
- **Rules Text**:
  > As an additional cost for the engaged player to ready a hero or ally they control, the player must spend a [mental] resource.
  >
  > ---
  >
  > [star] **Boost**: Discard cards from the top of your deck until you discard an ally.
- **Image Asset**: `assets/card-art/bundles/cards/24027.png` (300×435 px, 58.4 KB)

### [24028] Caught in the Crossfire
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Crossfire's Crew (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossfire's Crew Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the top of the encounter deck until a [[Crossfire's Crew]] minion is discarded. Reveal that minion. Take indirect damage equal to the number of [[Crossfire's Crew]] minions in play.
- **Image Asset**: `assets/card-art/bundles/cards/24028.png` (300×435 px, 58.4 KB)


### Set: Expert II

### [24029] Cruel Intentions
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Expert II (1/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Expert II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. Surge.
  > **When Revealed**: Deal each player 1 facedown encounter card. Give the villain 1 facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: Deal yourself 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/24029.png` (300×435 px, 56.4 KB)

### [24030] Ruination
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Expert II (2/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Expert II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1. Peril.
  > **When Revealed**: Discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that card. Place 2 threat on each scheme in play.
- **Image Asset**: `assets/card-art/bundles/cards/24030.png` (300×435 px, 62.5 KB)

### [24031] Seek and Destroy
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Expert II (3/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Expert II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1. Peril.
  > **When Revealed**: Search the encounter deck, discard pile, and set-aside area for your nemesis minion and put it into play engaged with you. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/24031.png` (300×435 px, 53.4 KB)

### [24032] Slug It Out
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Expert II (4/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Expert II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. Surge.
  > **When Revealed**: Exhaust your identity. Take 2 damage.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to each character you control. Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/24032.png` (300×435 px, 56.7 KB)


### Set: Mister Hyde

### [24033] Self-Experimentation
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Mister Hyde (1/4)
- **Stats**: **Base Threat**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mister Hyde Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for Mister Hyde and reveal him. *(Shuffle.)*
  > **Forced Interrupt**: When a [[Brute]] enemy would take any amount of damage, remove that much threat from this scheme instead.
- **Image Asset**: `assets/card-art/bundles/cards/24033.png` (435×300 px, 58.7 KB)

### [24034] Calvin Zabo
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Mister Hyde (2/4)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mister Hyde Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Masters of Evil.*
- **Rules Text**:
  > **When Revealed**: If Mister Hyde is in play, discard this card → Mister Hyde attacks you with +2 ATK. That attack gains overkill.
  > **When Defeated**: Search the encounter deck and discard pile for Mister Hyde and put him into play engaged with the player who was engaged with Calvin Zabo.
- **Image Asset**: `assets/card-art/bundles/cards/24034.png` (300×435 px, 66.4 KB)

### [24035] Mister Hyde
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Mister Hyde (3/4)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 10
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mister Hyde Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite. Masters of Evil.*
- **Rules Text**:
  > **When Revealed**: If Calvin Zabo is engaged with a player, discard Calvin Zabo → Mister Hyde engages that player. Give Mister Hyde a tough status card and deal 1 damage to each hero and ally in play.
- **Flavor**: *"I became what I always wanted."*
- **Image Asset**: `assets/card-art/bundles/cards/24035.png` (300×435 px, 60.0 KB)

### [24036] Hyde Formula
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Mister Hyde (4/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mister Hyde Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Calvin Zabo is in play, he schemes with +3 SCH, then he takes 4 damage. If Mister Hyde is in play, give him a tough status card and he attacks you *(even if you are in alter-ego form)*. If neither is in play, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/24036.png` (300×435 px, 59.7 KB)


### Set: Ransacked Armory

### [24037] Flamethrower
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Ransacked Armory (1/7)
- **Stats**: **ATK**: 3 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ransacked Armory Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to the minion with the most remaining hit points. If you cannot, search the encounter deck and discard pile for a minion, put it into play engaged with you, and attach this card to it. *(Shuffle.)*
  > [star] Attached minion's attacks deal indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/24037.png` (300×435 px, 64.4 KB)

### [24038] Holoshield Generator
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Ransacked Armory (2/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ransacked Armory Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Attach to the minion with the most remaining hit points. If you cannot, search the encounter deck and discard pile for a minion, put it into play engaged with you, and attach this card to it. *(Shuffle.)*
  > Attached minion gets +4 hit points and gains retaliate 2.
- **Image Asset**: `assets/card-art/bundles/cards/24038.png` (300×435 px, 62.7 KB)

### [24039] Jetpack
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Ransacked Armory (3/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ransacked Armory Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Attach to the minion with the most remaining hit points. If you cannot, this card gains surge.
  > **Forced Interrupt**: When attached minion would take any amount of damage from an attack, discard the top card of the encounter deck. Reduce damage from that attack by the number of boost icons ([boost]) discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/24039.png` (300×435 px, 63.5 KB)

### [24040] Tech Gauntlets
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Ransacked Armory (4–5/7, Qty: 2)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ransacked Armory Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to the minion with the most remaining hit points. If you cannot, this card gains surge.
  > Attach minion gets +3 hit points.
  > [star] Attached minion's attacks gain overkill.
- **Image Asset**: `assets/card-art/bundles/cards/24040.png` (300×435 px, 61.5 KB)

### [24041] Armored Guard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Ransacked Armory (6–7/7, Qty: 2)
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ransacked Armory Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mercenary.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
  > Toughness. *(This character enters play with a tough status card.)*
- **Image Asset**: `assets/card-art/bundles/cards/24041.png` (300×435 px, 61.9 KB)


### Set: Sinister Syndicate

### [24042] Crime Pays
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Sinister Syndicate (1/7)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sinister Syndicate Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Search the encounter deck for a [[Criminal]] minion and put it into play engaged with you. *(Shuffle.)* If no minion was put into play this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/24042.png` (435×300 px, 59.3 KB)

### [24043] Beetle
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Sinister Syndicate (2/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sinister Syndicate Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] **Forced Response**: After Beetle attacks and damages you, discard the lowest-cost upgrade you control.
  >
  > ---
  >
  > [star] **Boost**: Choose and discard an upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/24043.png` (300×435 px, 54.4 KB)

### [24044] Boomerang
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Sinister Syndicate (3/7)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sinister Syndicate Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Masters of Evil.*
- **Rules Text**:
  > [star] **Forced Response**: After Boomerang attacks you, deal 1 damage to each ally you control.
  >
  > ---
  >
  > [star] **Boost**: Deal 2 damage to an ally you control.
- **Image Asset**: `assets/card-art/bundles/cards/24044.png` (300×435 px, 57.7 KB)

### [24045] Shocker
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Sinister Syndicate (4/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sinister Syndicate Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Masters of Evil.*
- **Rules Text**:
  > **Forced Response**: After Shocker is attacked, stun the attacking character.
  >
  > ---
  >
  > [star] **Boost**: Stun the character you control with the highest ATK value.
- **Image Asset**: `assets/card-art/bundles/cards/24045.png` (300×435 px, 59.7 KB)

### [24046] Speed Demon
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Sinister Syndicate (5/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sinister Syndicate Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **Forced Interrupt**: When a character attacks Speed Demon, Speed Demon attacks that character. *(Resolve Speed Demon's attack first.)*
  >
  > ---
  >
  > [star] **Boost**: Discard the lowest-cost support you control.
- **Image Asset**: `assets/card-art/bundles/cards/24046.png` (300×435 px, 63.2 KB)

### [24047] White Rabbit
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Sinister Syndicate (6/7)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sinister Syndicate Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When White Rabbit attacks you, discard 1 card at random from your hand.
  >
  > ---
  >
  > [star] **Boost**: Choose and discard 1 identity-specific card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/24047.png` (300×435 px, 59.6 KB)

### [24048] Sinister Onslaught
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Sinister Syndicate (7/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Sinister Syndicate Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Each [[Criminal]] enemy in play schemes. If no enemy schemed this way, this card gains surge.
  > **When Revealed (Hero)**: Each [[Criminal]] enemy in play attacks you. If no enemy attacked this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/24048.png` (300×435 px, 66.1 KB)


### Set: Standard II

### [24049] Formidable Foe
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Standard II (1/8)
- **Properties**: Permanent, Double-Sided
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Standard II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Standard Mode Only.***
  > Permanent. Setup.
  > The villain gains steady. *(Steady characters require 2 status cards of the same type to be stunned or confused.)*
- **Reverse Side**: Formidable Foe
  > ***Expert Mode Only.***
  > Permanent. Setup.
  > Each enemy gains steady. *(Steady characters require 2 status cards of the same type to be stunned or confused.)*
- **Image Asset**: `assets/card-art/bundles/cards/24049.jpg` (300×435 px, 61.0 KB)

### [24049a] Formidable Foe
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Standard II (1/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Standard II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Standard Mode Only.***
  > Permanent. Setup.
  > The villain gains steady. *(Steady characters require 2 status cards of the same type to be stunned or confused.)*
- **Image Asset**: `assets/card-art/bundles/cards/24049a.png` (300×435 px, 61.0 KB)

### [24049b] Formidable Foe
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Standard II (1/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Standard II Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > ***Expert Mode Only.***
  > Permanent. Setup.
  > Each enemy gains steady. *(Steady characters require 2 status cards of the same type to be stunned or confused.)*
- **Image Asset**: `assets/card-art/bundles/cards/24049b.png` (300×435 px, 61.0 KB)

### [24050] Dark Dealings
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Standard II (2–3/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Standard II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The villain schemes with +1 SCH.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/24050.png` (300×435 px, 55.1 KB)

### [24051] Mob Mentality
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Standard II (4/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Standard II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard the top 7 cards from the encounter deck. Put the first minion discarded this way into play engaged with you.
  > **When Revealed (Hero)**: The villain and each minion engaged with you attacks you. This card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/24051.png` (300×435 px, 59.8 KB)

### [24052] Overwhelming Force
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Standard II (5/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Standard II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the highest-cost upgrade or support you control. If no card was discarded this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/24052.png` (300×435 px, 63.1 KB)

### [24053] Shadow of the Past
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Standard II (6/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Standard II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Reveal your set-aside nemesis minion and put it into play engaged with you. Reveal your set-aside nemesis side scheme and put it into play. Shuffle the rest of your set-aside nemesis encounter set into the encounter deck. If your nemesis minion does not enter the game this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/24053.png` (300×435 px, 62.2 KB)

### [24054] Total Annihilation
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Standard II (7–8/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Standard II Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed (Hero)**: The villain attacks you. That attack gains overkill.
  >
  > ---
  >
  > [star] **Boost**: If the villain is attacking, this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/24054.png` (300×435 px, 55.8 KB)


### Set: State of Emergency

### [24055] Feisty Heist
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: State of Emergency (1/6)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: State of Emergency Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Discard the highest-cost card from your hand.
- **Flavor**: *The villains have somehow identified an unmarked van transporting priceless artifacts.*
- **Image Asset**: `assets/card-art/bundles/cards/24055.png` (435×300 px, 54.1 KB)

### [24056] Disaster at the Docks
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: State of Emergency (2/6)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: State of Emergency Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Take 3 indirect damage.
- **Flavor**: *A container ship has run ashore and is now sitting on the dock of the bay.*
- **Image Asset**: `assets/card-art/bundles/cards/24056.png` (435×300 px, 57.9 KB)

### [24057] Offshore Inferno
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: State of Emergency (3/6)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: State of Emergency Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Discard the lowest-cost card you control.
- **Flavor**: *A raging fire has engulfed a coastal oil rig, trapping much of the crew.*
- **Image Asset**: `assets/card-art/bundles/cards/24057.png` (435×300 px, 51.3 KB)

### [24058] Hot Pursuit
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: State of Emergency (4/6)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: State of Emergency Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Discard cards from the top of the encounter deck until a minion is discard. Put that minion into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/24058.png` (435×300 px, 57.5 KB)

### [24059] Citywide Crisis
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: State of Emergency (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: State of Emergency Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve each "**When Revealed**" ability on each side scheme in play. If no "**When Revealed**" ability was resolved this way, place 2 threat on each scheme.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/24059.png` (300×435 px, 60.9 KB)


### Set: Streets of Mayhem

### [24060] Back-Alley Enclave
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Streets of Mayhem (1/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Streets of Mayhem Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Setting.*
- **Rules Text**:
  > Surge.**When Revealed**: Discard each other [[Setting]] environment in play.
  > Each character in play gets +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/24060.png` (300×435 px, 53.3 KB)

### [24061] Secret Lair
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Streets of Mayhem (2/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Streets of Mayhem Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Setting.*
- **Rules Text**:
  > Surge.**When Revealed**: Discard each other [[Setting]] environment in play.
  > Each enemy in play gains 1 acceleration icon ([acceleration]).
  > Each hero and ally in play gets +1 THW.
- **Image Asset**: `assets/card-art/bundles/cards/24061.png` (300×435 px, 57.1 KB)

### [24062] Sewer Tunnels
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Streets of Mayhem (3/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Streets of Mayhem Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Setting.*
- **Rules Text**:
  > Surge.**When Revealed**: Discard each other [[Setting]] environment in play.
  > Each character in play gains retaliate 1.
- **Image Asset**: `assets/card-art/bundles/cards/24062.png` (300×435 px, 54.9 KB)

### [24063] Warehouse District
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Streets of Mayhem (4/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Streets of Mayhem Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Setting.*
- **Rules Text**:
  > Surge.**When Revealed**: Discard each other [[Setting]] environment in play.
  > Each character in play gains steady. *(Steady characters require 2 status cards of the same type to be stunned or confused.)*
- **Image Asset**: `assets/card-art/bundles/cards/24063.png` (300×435 px, 57.8 KB)


### Set: Wrecking Crew

### [24064] Top Talent
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Wrecking Crew (1/7)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 2 [per_hero]. *(When revealed, place 2 [per_hero] threat here.)*
  > The villain and each [[Elite]] minion gain retaliate 1.
- **Flavor**: *The Wrecking Crew is on a rampage, using their magically-powered muscles to cause chaos and destruction.*
- **Image Asset**: `assets/card-art/bundles/cards/24064.png` (435×300 px, 54.7 KB)

### [24065] Wrecker
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Wrecking Crew (2/7)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite.*
- **Rules Text**:
  > Villainous. *(When this minion activates, give it a boost card.)*
  > [star] While Wrecker is attacking, he gets +2 ATK if the attack is undefended.
- **Flavor**: *"You're just dead meat waitin' tp be tenderized!"*
- **Image Asset**: `assets/card-art/bundles/cards/24065.png` (300×435 px, 55.5 KB)

### [24066] Bulldozer
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Wrecking Crew (3/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite.*
- **Rules Text**:
  > Villainous. *(When this minion activates, give it a boost card.)*
  > [star] Bulldozer's attacks gain overkill.
- **Flavor**: *"Nothing stands in the path of the Bulldozer!"*
- **Image Asset**: `assets/card-art/bundles/cards/24066.png` (300×435 px, 55.7 KB)

### [24067] Piledriver
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Wrecking Crew (4/7)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite.*
- **Rules Text**:
  > Retaliate 1.
  > Villainous. *(When this minion activates, give it a boost card.)*
- **Flavor**: *"These fists were made for crushin'... and that's just what they'll do."*
- **Image Asset**: `assets/card-art/bundles/cards/24067.png` (300×435 px, 51.9 KB)

### [24068] Thunderball
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Wrecking Crew (5/7)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 1 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite.*
- **Rules Text**:
  > Villainous. *(When this minion activates, give it a boost card.)*
  > [star] **Forced Response**: After Thunderball attacks you, deal 1 damage to each character you control.
- **Flavor**: *"Bring it on! It's wrecking time!"*
- **Image Asset**: `assets/card-art/bundles/cards/24068.png` (300×435 px, 60.4 KB)

### [24069] Combined Effort
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Wrecking Crew (6/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[Elite]] minion in play activates against the player it is engaged with. If no minion activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: For each [[Elite]] minion in play, this card gets +1 boost icon ([boost]) for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/24069.png` (300×435 px, 63.1 KB)

### [24070] Magic Muscle
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Hood (`hood`)
- **Deck / Set**: Wrecking Crew (7/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wrecking Crew Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give each [[Brute]] enemy in play a tough status card. If no tough status card was given this way, discard cards from the top of the encounter deck until a [[Brute]] minion is discarded and reveal that minion.
- **Flavor**: *"Hey, stop, that tickles."*
- **Image Asset**: `assets/card-art/bundles/cards/24070.png` (300×435 px, 60.7 KB)


