# Marvel Champions Card Reference Database

This document is an authoritative, complete card database generated directly from the game card assets and metadata. It is formatted specifically for AI and rules engine consumption.

## Rules & Symbol Legend

### 1. Bottom-Right Encounter Logos
- **Boost Icons (Pips)**: In the lower-right corner of Villain, Minion, Treachery, and Attachment cards, there are triangular boost icons (0 to 4). When the card is flipped face-down as a Boost Card during a Villain attack or scheme activation, each boost icon adds +1 to the Villain's ATK or SCH.
- **Boost Star (`[star]`)**: An icon in the boost area indicating that drawing this card triggers a special **Boost Ability** printed in the card's text box.
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
- **HP**: Hit Points (health pool; may be fixed or multiplied *per hero*).
- **`[star]`**: Asterisk/Star indicating a dynamic or variable stat governed by card text.
- **`[mental]` / `[physical]` / `[energy]` / `[wild]`**: Resource icons used to pay card costs.

## Quick Index

| Code | Name | Type | Deck / Set | Stats | Boost | Pack |
|---|---|---|---|---|---|---|
| `55001` | Enchantress | Villain | Enchantress | SCH:2 ATK:1 HP:15 | - | `tt` |
| `55002` | Enchantress | Villain | Enchantress | SCH:2 ATK:2 HP:16 | - | `tt` |
| `55003` | Enchantress | Villain | Enchantress | SCH:3 ATK:2 HP:18 | - | `tt` |
| `55004a` | Prime Real Estate | Main Scheme | Enchantress | - | - | `tt` |
| `55004b` | Prime Real Estate | Main Scheme | Enchantress | - | - | `tt` |
| `55005a` | Sovereign Sorceress | Main Scheme | Enchantress | - | - | `tt` |
| `55005b` | Sovereign Sorceress | Main Scheme | Enchantress | - | - | `tt` |
| `55006` | Future of Despair | Side Scheme | Enchantress | - | 3 pips | `tt` |
| `55007a` | Hypnotic Gaze | Attachment | Enchantress | - | - | `tt` |
| `55007b` | Trance of Envy | Attachment | Enchantress | - | - | `tt` |
| `55008a` | Hypnotic Gaze | Attachment | Enchantress | - | - | `tt` |
| `55008b` | Trance of Greed | Attachment | Enchantress | - | - | `tt` |
| `55009a` | Hypnotic Gaze | Attachment | Enchantress | - | - | `tt` |
| `55009b` | Trance of Pride | Attachment | Enchantress | - | - | `tt` |
| `55010a` | Hypnotic Gaze | Attachment | Enchantress | - | - | `tt` |
| `55010b` | Trance of Sloth | Attachment | Enchantress | - | - | `tt` |
| `55011a` | Hypnotic Gaze | Attachment | Enchantress | - | - | `tt` |
| `55011b` | Trance of Wrath | Attachment | Enchantress | - | - | `tt` |
| `55012` | Alluring Call | Attachment | Enchantress | - | Star | `tt` |
| `55013` | Kiss of Temptation | Attachment | Enchantress | - | Star | `tt` |
| `55014` | Love Concoction | Attachment | Enchantress | - | Star | `tt` |
| `55015` | Seduced | Attachment | Enchantress | - | 2 pips | `tt` |
| `55016` | Crown of the Enchantress | Attachment | Enchantress | - | 3 pips | `tt` |
| `55017` | Enthralled Lackey | Minion | Enchantress | SCH:2 ATK:1 HP:3 | 1 pips | `tt` |
| `55018` | Enthralled Brute | Minion | Enchantress | SCH:1 ATK:2 HP:4 | 1 pips | `tt` |
| `55019` | Sindr | Minion | Enchantress | SCH:1 ATK:4 HP:6 | 3 pips | `tt` |
| `55020` | Ulik | Minion | Enchantress | SCH:0 ATK:3 HP:5 | 2 pips | `tt` |
| `55021` | Law of Attraction | Side Scheme | Enchantress | - | 1 pips | `tt` |
| `55022` | Spellbound | Side Scheme | Enchantress | - | 1 pips | `tt` |
| `55023` | "Do My Bidding" | Treachery | Enchantress | - | 3 pips | `tt` |
| `55024` | Magical Restraints | Treachery | Enchantress | - | 2 pips | `tt` |
| `55025` | Spell Blast | Treachery | Enchantress | - | 2 pips | `tt` |
| `55026` | Spell Shards | Treachery | Enchantress | - | 1 pips | `tt` |
| `55027a` | Loki, God of Lies | Villain | God of Lies | HP:20 | - | `tt` |
| `55027b` | Loki, God of Lies | Villain | God of Lies | HP:20 | - | `tt` |
| `55028a` | Worlds Collide | Main Scheme | God of Lies | - | - | `tt` |
| `55028b` | Worlds Collide | Main Scheme | God of Lies | - | - | `tt` |
| `55029a` | Loki the Rascal | Villain | God of Lies | SCH:1 ATK:1 HP:15 | - | `tt` |
| `55029b` | Fading Figment | Villain | God of Lies | HP:99 | - | `tt` |
| `55030a` | Loki the Miscreant | Villain | God of Lies | SCH:1 ATK:2 HP:15 | - | `tt` |
| `55030b` | Fading Figment | Villain | God of Lies | HP:99 | - | `tt` |
| `55031a` | Loki the Knave | Villain | God of Lies | SCH:2 ATK:1 HP:15 | - | `tt` |
| `55031b` | Fading Figment | Villain | God of Lies | HP:99 | - | `tt` |
| `55032a` | Loki the Wretch | Villain | God of Lies | SCH:1 ATK:1 HP:15 | - | `tt` |
| `55032b` | Fading Figment | Villain | God of Lies | HP:99 | - | `tt` |
| `55033a` | Mischief and Mayhem | Main Scheme | God of Lies | - | - | `tt` |
| `55033b` | Mischief and Mayhem | Main Scheme | God of Lies | - | - | `tt` |
| `55034a` | Intense Focus | Attachment | God of Lies | SCH:1 ATK:1 | - | `tt` |
| `55034b` | Total Focus | Attachment | God of Lies | SCH:1 ATK:1 | - | `tt` |
| `55035` | Wrapped in Chains | Attachment | God of Lies | - | 1 pips | `tt` |
| `55036` | Dark Scepter | Attachment | God of Lies | ATK:1 | 2 pips | `tt` |
| `55037` | Draugr Buddy | Minion | God of Lies | SCH:0 ATK:1 HP:2 | 1 pips | `tt` |
| `55038` | Grendell | Minion | God of Lies | SCH:1 ATK:1 HP:6 | 2 pips | `tt` |
| `55039` | Malekith | Minion | God of Lies | SCH:2 ATK:2 HP:5 | 3 pips | `tt` |
| `55040` | Minotaur | Minion | God of Lies | SCH:2 ATK:2 HP:4 | 2 pips | `tt` |
| `55041` | The Mangog | Minion | God of Lies | SCH:3 ATK:4 HP:10 | 3 pips | `tt` |
| `55042` | Fenris Wolf | Minion | God of Lies | SCH:1 ATK:2 HP:7 | 3 pips | `tt` |
| `55043` | Hraesvelgr | Minion | God of Lies | SCH:2 ATK:2 HP:7 | 3 pips | `tt` |
| `55044` | Laufey | Minion | God of Lies | SCH:2 ATK:3 HP:7 | 3 pips | `tt` |
| `55045` | Aura of Stasis | Side Scheme | God of Lies | - | 1 pips | `tt` |
| `55046` | Door Between Worlds | Side Scheme | God of Lies | - | 3 pips | `tt` |
| `55047` | Lofty Goals | Side Scheme | God of Lies | - | Star | `tt` |
| `55048` | New Jotunheim | Side Scheme | God of Lies | - | 3 pips | `tt` |
| `55049` | Dark Arts | Treachery | God of Lies | - | Star | `tt` |
| `55050` | Dirty Trick | Treachery | God of Lies | - | Star | `tt` |
| `55051` | Stories and Lies | Treachery | God of Lies | - | 2 pips | `tt` |
| `55052` | Domineering Force | Environment | God of Lies | - | - | `tt` |
| `55053` | Feigned Retreat | Environment | God of Lies | - | - | `tt` |
| `55054` | Mounting Resistance | Environment | God of Lies | - | - | `tt` |
| `55055` | Unified Front | Environment | God of Lies | - | - | `tt` |
| `55056` | Absorbing Man | Minion | Trickster Magic | SCH:2 ATK:1 HP:7 | 2 pips | `tt` |
| `55057` | Titania | Minion | Trickster Magic | SCH:1 ATK:3 HP:8 | 3 pips | `tt` |
| `55058` | Whirlwind | Minion | Trickster Magic | SCH:2 ATK:1 HP:6 | 1 pips | `tt` |
| `55059` | Zzzax | Minion | Trickster Magic | SCH:1 ATK:2 HP:6 | 2 pips | `tt` |
| `55060` | The Trickster Tango | Side Scheme | Trickster Magic | - | 1 pips | `tt` |
| `55061` | Puppet Master | Side Scheme | Trickster Magic | - | 1 pips | `tt` |
| `55062` | Love Triangle | Attachment | Trickster Magic | - | 1 pips | `tt` |
| `55063` | Absorbing Man | Ally | Trickster Magic | THW:1 ATK:1 HP:3 | - | `tt` |
| `55064` | Titania | Ally | Trickster Magic | THW:2 ATK:3 HP:5 | - | `tt` |
| `55065` | Whirlwind | Ally | Trickster Magic | THW:1 ATK:0 HP:3 | - | `tt` |
| `55066` | Zzzax | Ally | Trickster Magic | THW:3 ATK:1 HP:4 | - | `tt` |

---

## Pack: Trickster Takeover (`tt`)

### Set: Enchantress

### [55001] Enchantress
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (1/32)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > [star] **Forced Response**: After Enchantress attacks you, place 1 charm counter on the [[Enchantment]] card in your play area.
- **Image Asset**: `assets/card-art/bundles/cards/55001.png` (710×1030 px, 345.5 KB)
### [55002] Enchantress
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (2/32)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > Steady. Toughness.
  > **When Revealed**: In standard mode, put the set-aside Future of Despair into play, then place an additional 3[per_hero] threat on it.
  > [star] **Forced Response**: After Enchantress attacks you, place 1 charm counter on the [[Enchantment]] card in your play area.
- **Image Asset**: `assets/card-art/bundles/cards/55002.png` (710×1030 px, 368.8 KB)
### [55003] Enchantress
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (3/32)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > Steady. Toughness.
  > **When Revealed**: Put the set-aside Future of Despair into play, then place an additional 4[per_hero] threat on it.
  > [star] **Forced Response**: After Enchantress attacks you, place 1 charm counter on the [[Enchantment]] card in your play area.
- **Image Asset**: `assets/card-art/bundles/cards/55003.jpg` (710×1030 px, 369.0 KB)
### [55004a] Prime Real Estate
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (4/32)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Enchantress (I) and Enchantress (II). *(Enchantress (II) and Enchantress (III) instead for expert mode.)* Enchantress and Standard encounter sets. One modular set *(Trickster Magic)*.
  > **Setup**: Set the Future of Despair side scheme aside. Attach a random Hypnotic Gaze to each identity *(players cannot look at the reverse sides)*. Set each remaining Hypnotic Gaze aside.
- **Image Asset**: `assets/card-art/bundles/cards/55004a.png` (419×289 px, 251.6 KB)
### [55004b] Prime Real Estate
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (4/32)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When a charm counter would be placed on the [[Enchantment]] card in your play area, if your identity has the [[Enthralled]] trait, place 1 threat here instead.
- **Flavor**: *Enchantress sets out to conquer South America by turning all who oppose her into her enthralled lackeys.*
- **Image Asset**: `assets/card-art/bundles/cards/55004b.png` (419×289 px, 252.7 KB)
### [55005a] Sovereign Sorceress
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (5/32)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If the Crown of the Enchantress attachment is in play, stun each identity. Otherwise, search the encounter deck and discard pile for Crown of the Enchantress and reveal it. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/55005a.png` (419×289 px, 249.8 KB)
### [55005b] Sovereign Sorceress
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (5/32)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When a charm counter would be placed on the [[Enchantment]] card in your play area, if your identity has the [[Enthralled]] trait, place 1 threat here instead.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/55005b.png` (419×289 px, 261.7 KB)
### [55006] Future of Despair
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (6/32)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Enchantress gains stalwart and cannot take damage.
  > **When Revealed**: Place 1 charm counter on each [[Enchantment]] card in play.
- **Image Asset**: `assets/card-art/bundles/cards/55006.jpg` (1030×710 px, 363.3 KB)
### [55007a] Hypnotic Gaze
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Defiant]] trait.
  > If there are 5 or more charm counters here, remove each charm counter from here and flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/55007a.png` (289×419 px, 230.4 KB)
### [55007b] Trance of Envy
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (7/32)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Enthralled]] trait.
  > **When Revealed**: Discard a card you control. Otherwise, discard the top 8 cards of your deck.
  > **Forced Action**: Exhaust this card → give Enchantress a facedown boost card. Ready your identity.
- **Image Asset**: `assets/card-art/bundles/cards/55007b.png` (289×419 px, 252.0 KB)
### [55008a] Hypnotic Gaze
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Defiant]] trait.
  > If there are 5 or more charm counters here, remove each charm counter from here and flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/55008a.png` (289×419 px, 230.4 KB)
### [55008b] Trance of Greed
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (8/32)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Enthralled]] trait.
  > **When Revealed**: You are confused. Otherwise, take 2 damage.
  > **Forced Action**: Exhaust this card → draw 1 card, then play that card *(paying its cost)*. If you cannot, take 1 damage.
- **Image Asset**: `assets/card-art/bundles/cards/55008b.png` (289×419 px, 260.1 KB)
### [55009a] Hypnotic Gaze
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Defiant]] trait.
  > If there are 5 or more charm counters here, remove each charm counter from here and flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/55009a.png` (289×419 px, 230.4 KB)
### [55009b] Trance of Pride
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (9/32)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Enthralled]] trait.
  > **When Revealed**: Exhaust your identity. Otherwise, discard 1 card at random from your hand.
  > **Forced Action**: Exhaust this card → place 1 threat on the main scheme. Remove 2 threat from a side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/55009b.png` (289×419 px, 247.2 KB)
### [55010a] Hypnotic Gaze
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Defiant]] trait.
  > If there are 5 or more charm counters here, remove each charm counter from here and flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/55010a.png` (289×419 px, 230.4 KB)
### [55010b] Trance of Sloth
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (10/32)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Enthralled]] trait.
  > **When Revealed**: You are stunned. Otherwise, place 2 threat on the main scheme.
  > **Forced Action**: Exhaust this card → heal 1 damage from Enchantress. Draw 1 card, then discard 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/55010b.png` (289×419 px, 245.0 KB)
### [55011a] Hypnotic Gaze
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Defiant]] trait.
  > If there are 5 or more charm counters here, remove each charm counter from here and flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/55011a.png` (289×419 px, 230.4 KB)
### [55011b] Trance of Wrath
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (11/32)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enchantment.*
- **Rules Text**:
  > Permanent.
  > Your identity gains the [[Enthralled]] trait.
  > **When Revealed**: Search the top 5 cards of the encounter deck for a card and reveal it. *(Shuffle.)*
  > **Forced Action**: Exhaust this card → take 1 indirect damage. Deal 2 damage to a minion.
- **Image Asset**: `assets/card-art/bundles/cards/55011b.png` (289×419 px, 253.9 KB)
### [55012] Alluring Call
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (12/32)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temptation.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Action**: Exhaust this card → place 1 charm counter on the [[Enchantment]] card in your play area. Play a card from your hand, reducing its resource cost by 1.
  > **Alter-Ego Action**: Exhaust this card → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/55012.jpg` (710×1030 px, 363.4 KB)
### [55013] Kiss of Temptation
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (13/32)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temptation.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Action**: Exhaust this card → place 1 charm counter on the [[Enchantment]] card in your play area. Draw 1 card, then discard 1 card from your hand.
  > **Alter-Ego Action**: Exhaust this card → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/55013.png` (710×1030 px, 362.0 KB)
### [55014] Love Concoction
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (14/32)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Temptation.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Action**: Exhaust this card → place 1 charm counter on the [[Enchantment]] card in your play area. Ready your identity.
  > **Alter-Ego Action**: Exhaust this card → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/55014.jpg` (710×1030 px, 349.8 KB)
### [55015] Seduced
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (15/32)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your identity.
  > You cannot make basic attacks or play [[Attack]] events.
  > **Alter-Ego Action**: Spend [energy] [mental] resources → discard this card.
- **Flavor**: *"You love me, don't you?" —Enchantress*
- **Image Asset**: `assets/card-art/bundles/cards/55015.png` (710×1030 px, 342.5 KB)
### [55016] Crown of the Enchantress
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (16/32)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to Enchantress.
  > In expert mode, Enchantress gains stalwart.
  > [star] **Forced Response**: After Enchantress schemes against you, place 1 charm counter on the [[Enchantment]] card in your play area.
  > **Hero Action**: Each player exhausts their identity and takes 1 damage → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/55016.png` (710×1030 px, 331.9 KB)
### [55017] Enthralled Lackey
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (17–18/32, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enthralled.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After this minion attacks you, place 1 charm counter on the [[Enchantment]] card in your play area.
  >
  > ---
  >
  > [star] **Boost**: Choose to either place 1 charm counter on the [[Enchantment]] card in your play area or confuse your identity.
- **Image Asset**: `assets/card-art/bundles/cards/55017.jpg` (710×1030 px, 353.8 KB)
### [55018] Enthralled Brute
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (19–20/32, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Enthralled.*
- **Rules Text**:
  > Guard.
  > [star] While this minion is engaged with a player whose identity has the [[Enthralled]] trait, this minion gets +3 hit points.
  >
  > ---
  >
  > [star] **Boost**: Choose to either place 1 charm counter on the [[Enchantment]] card in your play area or exhaust your identity.
- **Image Asset**: `assets/card-art/bundles/cards/55018.jpg` (710×1030 px, 375.6 KB)
### [55019] Sindr
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (21/32)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 4 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Giant.*
- **Rules Text**:
  > [star] Sindr's attacks deal indirect damage.
  > **When Revealed**: If your identity has the [[Defiant]] trait, Sindr activates against you. If your identity has the [[Enthralled]] trait, give Sindr a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/55019.png` (710×1030 px, 359.2 KB)
### [55020] Ulik
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (22/32)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Troll.*
- **Rules Text**:
  > In expert mode, Ulik gains toughness.
  > **Forced Response**: After a player deals any amount of damage to Enchantress, Ulik attacks that player.
  > **When Defeated**: Enchantress attacks the player who defeated Ulik and gets +1 ATK for that attack.
- **Image Asset**: `assets/card-art/bundles/cards/55020.png` (710×1030 px, 350.5 KB)
### [55021] Law of Attraction
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (23–24/32, Qty: 2)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Discard cards from the top of the encounter deck until an [[Enthralled]] minion is discarded. Reveal that minion.
  >
  > ---
  >
  > [star] **Boost**: Place 1 charm counter on the [[Enchantment]] card in your play area.
- **Image Asset**: `assets/card-art/bundles/cards/55021.jpg` (1030×710 px, 352.3 KB)
### [55022] Spellbound
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (25–26/32, Qty: 2)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Each player whose identity has the [[Defiant]] trait places 1 charm counter on the [[Enchantment]] card in their play area. Each player whose identity has the [[Enthralled]] trait discards a card they control.
- **Image Asset**: `assets/card-art/bundles/cards/55022.jpg` (1030×710 px, 319.4 KB)
### [55023] "Do My Bidding"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (27/32)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If your identity has the [[Defiant]] trait, choose one. If your identity has the [[Enthralled]] trait, do both in any order:
  > • Search the encounter deck and discard pile for a minion and reveal it. *(Shuffle.)*
  > • Search the encounter deck and discard pile for a side scheme and reveal it. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/55023.png` (710×1030 px, 383.7 KB)
### [55024] Magical Restraints
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (28–29/32, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If your identity has the [[Defiant]] trait, choose one. If your identity has the [[Enthralled]] trait, do both in any order:
  > • You are stunned. Place 1 charm counter on the [[Enchantment]] card in your play area.
  > • You are confused. Place 1 charm counter on the [[Enchantment]] card in your play area.
- **Image Asset**: `assets/card-art/bundles/cards/55024.jpg` (710×1030 px, 350.9 KB)
### [55025] Spell Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (30–31/32, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If your identity has the [[Defiant]] trait, choose one. If your identity has the [[Enthralled]] trait, do both in any order:
  > • Enchantress schemes (with +1 SCH in expert mode).
  > • Enchantress attacks you (with +1 ATK in expert mode).
- **Image Asset**: `assets/card-art/bundles/cards/55025.png` (710×1030 px, 339.6 KB)
### [55026] Spell Shards
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Enchantress (32/32)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Take 3 indirect damage. If your identity took any amount of damage this way, place 1 charm counter on the [[Enchantment]] card in your play area.
  >
  > ---
  >
  > [star] **Boost**: Place 1 charm counter on the [[Enchantment]] card in your play area.
- **Image Asset**: `assets/card-art/bundles/cards/55026.png` (710×1030 px, 355.6 KB)

### Set: God of Lies

### [55027a] Loki, God of Lies
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (1/34)
- **Properties**: Unique, Stage 1
- **Stats**: **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > If Loki, God of Lies has 10[per_hero] or fewer remaining hit points, flip this card.
- **Flavor**: *"Kneel."*
- **Image Asset**: `assets/card-art/bundles/cards/55027a.png` (289×419 px, 237.0 KB)
### [55027b] Loki, God of Lies
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (1/34)
- **Properties**: Unique, Stage 2
- **Stats**: **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > **When Revealed**: Each group in standard mode attaches their set-aside Intense Focus to the [[Avatar of Loki]] villain in their game area. Each group in expert mode flips their Intense Focus attachment to its Total Focus side.
  > **If Loki, God of Lies is defeated, all players in all groups win the game.**
- **Image Asset**: `assets/card-art/bundles/cards/55027b.png` (289×419 px, 251.8 KB)
### [55028a] Worlds Collide
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (2/34)
- **Properties**: Stage A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Loki, God of Lies (1). God of Lies and Standard encounter sets. One modular encounter set *(Trickster Magic)*.
  > **Setup**: Create a separate game area for each player group *(see page 9 of rules insert)*. Each group follows the instructions on Mischief and Mayhem (1A).
- **Image Asset**: `assets/card-art/bundles/cards/55028a.png` (419×289 px, 247.8 KB)
### [55028b] Worlds Collide
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (2/34)
- **Properties**: Stage B
- **Stats**: **Target Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [per_hero] icon on Loki, God of Lies counts the total number of players in all game areas.
  > Each [per_group] icon on this scheme counts the total number of groups in all pods.
  > Cards cannot affect this scheme or Loki, God of Lies, unless they refer to those cards by title.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/55028b.png` (419×289 px, 251.4 KB)
### [55029a] Loki the Rascal
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (3/34)
- **Properties**: Stage A1
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avatar of Loki.*
- **Rules Text**:
  > [star] **Forced Response**: After you resolve a boost card during Loki the Rascal's activation, if that card is a treachery, either deal it to yourself as a facedown encounter card or spend 1 resource of any type.
  > **Forced Interrupt**: When this villain would be defeated, place 5[per_hero] shatter counters here and flip this card instead.
- **Image Asset**: `assets/card-art/bundles/cards/55029a.png` (289×419 px, 265.8 KB)
### [55029b] Fading Figment
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (3/34)
- **Properties**: Unique, Stage A2
- **Stats**: **HP**: 99
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > **When Revealed**: Shatter the illusion *(see the set-aside Shatter the Illusion card)*. Choose a group in your pod, then place synergy counters on their Unified Front environment equal to the number of players in their group.
- **Image Asset**: `assets/card-art/bundles/cards/55029b.png` (289×419 px, 259.6 KB)
### [55030a] Loki the Miscreant
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (4/34)
- **Properties**: Stage B1
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avatar of Loki.*
- **Rules Text**:
  > **Forced Response**: After you resolve a treachery, place 1 threat on the main scheme and 1 threat on a side scheme.
  > **Forced Interrupt**: When this villain would be defeated, place 5[per_hero] shatter counters here and flip this card instead.
- **Image Asset**: `assets/card-art/bundles/cards/55030a.png` (289×419 px, 263.2 KB)
### [55030b] Fading Figment
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (4/34)
- **Properties**: Unique, Stage B2
- **Stats**: **HP**: 99
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > **When Revealed**: Shatter the illusion *(see the set-aside Shatter the Illusion card)*. Choose a group in your pod, then place synergy counters on their Mounting Resistance environment equal to the number of players in their group.
- **Image Asset**: `assets/card-art/bundles/cards/55030b.png` (289×419 px, 268.1 KB)
### [55031a] Loki the Knave
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (5/34)
- **Properties**: Stage C1
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avatar of Loki.*
- **Rules Text**:
  > **Forced Response**: After you resolve a treachery, deal 1 damage to your identity and 1 damage to an ally you control.
  > **Forced Interrupt**: When this villain would be defeated, place 5[per_hero] shatter counters here and flip this card instead.
- **Image Asset**: `assets/card-art/bundles/cards/55031a.png` (289×419 px, 261.1 KB)
### [55031b] Fading Figment
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (5/34)
- **Properties**: Unique, Stage C2
- **Stats**: **HP**: 99
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > **When Revealed**: Shatter the illusion *(see the set-aside Shatter the Illusion card)*. Choose a group in your pod, then place synergy counters on their Domineering Force environment equal to the number of players in their group.
- **Image Asset**: `assets/card-art/bundles/cards/55031b.png` (289×419 px, 266.0 KB)
### [55032a] Loki the Wretch
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (6/34)
- **Properties**: Stage D1
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avatar of Loki.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Loki the Wretch activates against you, discard the top card of the encounter deck. If a treachery was discarded this way, Loki the Wretch gets +1 SCH and +1 ATK for this activation.
  > **Forced Interrupt**: When this villain would be defeated, place 5[per_hero] shatter counters here and flip this card instead.
- **Image Asset**: `assets/card-art/bundles/cards/55032a.png` (289×419 px, 263.8 KB)
### [55032b] Fading Figment
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (6/34)
- **Properties**: Unique, Stage D2
- **Stats**: **HP**: 99
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > **When Revealed**: Shatter the illusion *(see the set-aside Shatter the Illusion card)*. Choose a group in your pod, then place synergy counters on their Feigned Retreat environment equal to the number of players in their group.
- **Image Asset**: `assets/card-art/bundles/cards/55032b.png` (289×419 px, 259.9 KB)
### [55033a] Mischief and Mayhem
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (7/34)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: After resolving Worlds Collide (A), do the following:
  > 1. Put a random [[Avatar of Loki]] villain into play. Set each other [[Avatar of Loki]] villain and the Shatter the Illusion card aside.
  > 2. Put each [[Synergy]] environment into play.
  > 3. In standard mode, set the Intense Focus attachment aside. In expert mode, attach it to the [[Avatar of Loki]] villain in play.
- **Image Asset**: `assets/card-art/bundles/cards/55033a.png` (419×289 px, 251.4 KB)
### [55033b] Mischief and Mayhem
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (7/34)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When this scheme would be completed, remove all threat from here and place 1 threat on Worlds Collide instead.
  > **Forced Interrupt**: When an identity would be defeated, change that identity's form to alter-ego, set its hit point dial to 1, and place 1 threat on Worlds Collide instead.
- **Image Asset**: `assets/card-art/bundles/cards/55033b.png` (419×289 px, 253.7 KB)
### [55034a] Intense Focus
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (8/34)
- **Properties**: Permanent
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent.
  > The [[Avatar of Loki]] villain gets +2[per_hero] hit points and gains steady.
  > **When Revealed**: In standard mode, discard the top 2[per_hero] cards of the encounter deck and the top 5 cards of each player deck.
- **Image Asset**: `assets/card-art/bundles/cards/55034a.png` (289×419 px, 244.0 KB)
### [55034b] Total Focus
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (8/34)
- **Properties**: Permanent
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent.
  > The [[Avatar of Loki]] villain gets +3[per_hero] hit points and gains steady.
  > **When Revealed**: Discard the top 2[per_hero] cards of the encounter deck and the top 5 cards of each player deck. Find Dark Scepter and reveal it. If Dark Scepter did not enter play this way, give the [[Avatar of Loki]] villain a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/55034b.png` (289×419 px, 239.3 KB)
### [55035] Wrapped in Chains
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (9/34)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your identiy.
  > Attached identity cannot ready.
  > **When Revealed**: Exhaust your identity.
  > **Hero Action**: Spend 2 resources of the same type → discard this card. Place 1 shatter counter on the [[Avatar of Loki]] villain.
- **Image Asset**: `assets/card-art/bundles/cards/55035.jpg` (710×1030 px, 332.3 KB)
### [55036] Dark Scepter
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (10/34)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Weapon.*
- **Rules Text**:
  > Attach to the [[Avatar of Loki]] villain.
  > The [[Avatar of Loki]] villain gains stalwart.
  > Treacheries cannot be canceled.
  > **Hero Response**: After you resolve a treachery, spend 2 resources of the same type → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/55036.jpg` (710×1030 px, 324.3 KB)
### [55037] Draugr Buddy
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (11–12/34, Qty: 2)
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Undead.*
- **Rules Text**:
  > Guard.
  > **When Defeated**: The defeating player discards the top card of the encounter deck. If that card is a treachery, deal Draugr Buddy to that player as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/55037.png` (710×1030 px, 338.6 KB)
### [55038] Grendell
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (13/34)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Dark Elf.*
- **Rules Text**:
  > Guard.
  > [star] **Forced Interrupt**: When Grendell attacks, discard the top 3 cards of the encounter deck. For each treachery discarded this way, Grendell gets +1 ATK for this attack.
  > **When Defeated**: Place 3 shatter counters on the [[Avatar of Loki]] villain.
- **Image Asset**: `assets/card-art/bundles/cards/55038.png` (710×1030 px, 297.8 KB)
### [55039] Malekith
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (14/34)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Dark Elf.*
- **Rules Text**:
  > Retaliate 1.
  > [star] **Forced Response**: After Malekith attacks you, discard the top card of the encounter deck. If that card is a treachery, deal it to yourself as a facedown encounter card.
  > **When Defeated**: Place 2 shatter counters on the [[Avatar of Loki]] villain.
- **Image Asset**: `assets/card-art/bundles/cards/55039.jpg` (710×1030 px, 365.6 KB)
### [55040] Minotaur
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (15/34)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Creature.*
- **Rules Text**:
  > Toughness.
  > **When Revealed**: If there are 5 or more treacheries in the encounter discard pile, Minotaur activates against you.
  > **When Defeated**: Place 2 shatter counters on the [[Avatar of Loki]] villain.
- **Image Asset**: `assets/card-art/bundles/cards/55040.png` (710×1030 px, 337.6 KB)
### [55041] The Mangog
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (16/34)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 4, **HP**: 10
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Creature. Elite.*
- **Rules Text**:
  > Victory 1.
  > Any player in your pod can attack The Mangog as if it were in their game area.
  > **When Defeated**: Each group in your pod places 3 shatter counters on their [[Avatar of Loki]] villain and 1 synergy counter on one of their [[Synergy]] environments.
- **Image Asset**: `assets/card-art/bundles/cards/55041.jpg` (710×1030 px, 374.0 KB)
### [55042] Fenris Wolf
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (17/34)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature. Elite.*
- **Rules Text**:
  > Guard. Patrol.
  >
  > **When Defeated**: Place 3 shatter counters on the [[Avatar of Loki]] villain. Choose a group in your pod, then place 1 synergy counter on their Mounting Resistance environment.
- **Image Asset**: `assets/card-art/bundles/cards/55042.jpg` (710×1030 px, 336.7 KB)
### [55043] Hraesvelgr
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (18/34)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature. Elite.*
- **Rules Text**:
  > **When Revealed**: Discard the top 3 cards of the encounter deck. If a treachery was discarded this way, take 2 indirect damage.
  > **When Defeated**: Place 3 shatter counters on the [[Avatar of Loki]] villain. Choose a group in your pod, then place 1 synergy counter on their Domineering Force environment.
- **Image Asset**: `assets/card-art/bundles/cards/55043.png` (710×1030 px, 344.5 KB)
### [55044] Laufey
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (19/34)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Giant.*
- **Rules Text**:
  > **Forced Response**: After a character attacks Laufey, discard the top card of the encounter deck. If that card is a treachery, stun the attacker.
  > **When Defeated**: Place 3 shatter counters on the [[Avatar of Loki]] villain. Choose a group in your pod, then place 1 synergy counter on their Unified Front environment.
- **Image Asset**: `assets/card-art/bundles/cards/55044.jpg` (710×1030 px, 357.8 KB)
### [55045] Aura of Stasis
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (20/34)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Discard the top 2 cards of the encounter deck (top 3 cards instead in expert mode). If a treachery was discarded this way, exhaust your identity.
- **Image Asset**: `assets/card-art/bundles/cards/55045.png` (1030×710 px, 323.0 KB)
### [55046] Door Between Worlds
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (21/34)
- **Stats**: **Base Threat**: 7 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme), Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase), Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Victory 1.
  > Any player in your pod can thwart Door Between Worlds as if it were in their game area.
  > **When Defeated**: Each group in your pod places 3 shatter counters on their [[Avatar of Loki]] villain and 1 synergy counter on one of their [[Synergy]] environments.
- **Image Asset**: `assets/card-art/bundles/cards/55046.png` (1030×710 px, 373.5 KB)
### [55047] Lofty Goals
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (22–23/34, Qty: 2)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Place 2 shatter counters on the [[Avatar of Loki]] villain.
  >
  > ---
  >
  > [star] **Boost**: Take 1 indirect damage for each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/55047.jpg` (1030×710 px, 339.3 KB)
### [55048] New Jotunheim
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (24/34)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Place 3 shatter counters on the [[Avatar of Loki]] villain. Choose a group in your pod, then place 1 synergy counter on their Feigned Retreat environment.
- **Image Asset**: `assets/card-art/bundles/cards/55048.jpg` (1030×710 px, 341.5 KB)
### [55049] Dark Arts
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (25–26/34, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, this card gains incite 1.
  > **When Revealed**: Search the encounter discard pile for a minion and reveal it. Otherwise, place 3 threat on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: Place 1 threat on the main scheme for each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/55049.png` (710×1030 px, 324.9 KB)
### [55050] Dirty Trick
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (27/34)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Remove 1 shatter counter from the [[Avatar of Loki]] villain. Take 2 damage (3 damage instead in expert mode).
  >
  > ---
  >
  > [star] **Boost**: Take 1 indirect damage for each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/55050.jpg` (710×1030 px, 340.8 KB)
### [55051] Stories and Lies
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (28–30/34, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Swap the [[Avatar of Loki]] villain in play with a random set-aside [[Avatar of Loki]] villain. Then:
  > • If Loki the Knave or Loki the Miscreant is in play, he schemes (with +1 SCH in expert mode).
  > • If Loki the Rascal or Loki the Wretch is in play, he attacks you (with +1 ATK in expert mode).
- **Image Asset**: `assets/card-art/bundles/cards/55051.png` (710×1030 px, 282.1 KB)
### [55052] Domineering Force
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (31/34)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Synergy.*
- **Rules Text**:
  > Permanent.
  > Max 1[per_hero] synergy counters here.
  > **Interrupt**: When a friendly character attacks, remove 1 synergy counter from here → that attack deals 4 additional damage.
- **Image Asset**: `assets/card-art/bundles/cards/55052.png` (710×1030 px, 305.5 KB)
### [55053] Feigned Retreat
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (32/34)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Synergy.*
- **Rules Text**:
  > Permanent.
  > Max 1[per_hero] synergy counters here.
  > **Interrupt**: When an identity would take any amount of damage, remove 1 synergy counter from here → prevent 4 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/55053.jpg` (710×1030 px, 358.7 KB)
### [55054] Mounting Resistance
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (33/34)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Synergy.*
- **Rules Text**:
  > Permanent.
  > Max 1[per_hero] synergy counters here.
  > **Interrupt**: When a friendly character thwarts, remove 1 synergy counter from here → that thwart removes 4 additional threat.
- **Image Asset**: `assets/card-art/bundles/cards/55054.png` (710×1030 px, 362.4 KB)
### [55055] Unified Front
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: God of Lies (34/34)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: God of Lies Set Icon (printed bottom-right next to deck number)
- **Traits**: *Synergy.*
- **Rules Text**:
  > Permanent.
  > Max 1[per_hero] synergy counters here.
  > **Resource**: Remove 1 synergy counter from here → generate [wild] [wild] resources.
- **Image Asset**: `assets/card-art/bundles/cards/55055.jpg` (710×1030 px, 356.4 KB)

### Set: Trickster Magic

### [55056] Absorbing Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (1/11)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Trickster Magic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite. Enthralled.*
- **Rules Text**:
  > Guard. Victory 1.
  > [star] While Absorbing Man is engaged with you, he gets +X ATK, where X is the printed cost of the highest-cost card you control.
  > **When Defeated**: The player who defeated this minion puts the set-aside Absorbing Man ally into play under their control.
- **Image Asset**: `assets/card-art/bundles/cards/55056.jpg` (710×1030 px, 361.8 KB)
### [55057] Titania
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (2/11)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Trickster Magic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite. Enthralled.*
- **Rules Text**:
  > Steady. Victory 1.
  > [star] Titania's attacks gain overkill.
  > **When Defeated**: The player who defeated this minion puts the set-aside Titania ally into play under their control.
- **Image Asset**: `assets/card-art/bundles/cards/55057.png` (710×1030 px, 353.5 KB)
### [55058] Whirlwind
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (3/11)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Trickster Magic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Enthralled.*
- **Rules Text**:
  > Quickstrike. Victory 1.
  > [star] **Forced Response**: After Whirlwind attacks you, take 1 indirect damage for each side scheme in play.
  > **When Defeated**: The player who defeated this minion puts the set-aside Whirlwind ally into play under their control.
- **Image Asset**: `assets/card-art/bundles/cards/55058.png` (710×1030 px, 364.5 KB)
### [55059] Zzzax
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (4/11)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Trickster Magic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Enthralled.*
- **Rules Text**:
  > Retaliate 1. Victory 1.
  > **When Revealed**: Discard the top 4 cards of your deck. For each printed [energy] resource discarded this way, take 1 indirect damage.
  > **When Defeated**: The player who defeated this minion puts the set-aside Zzzax ally into play under their control.
- **Image Asset**: `assets/card-art/bundles/cards/55059.jpg` (710×1030 px, 368.1 KB)
### [55060] The Trickster Tango
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (5/11)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Trickster Magic Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > The villain gains stalwart. *(They cannot be stunned or confused.)*
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/55060.jpg` (1030×710 px, 344.1 KB)
### [55061] Puppet Master
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (6/11)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Trickster Magic Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > In expert mode, this scheme gains hinder 1[per_hero].
  > Allies cannot thwart this scheme or defend against the villain's attacks.
- **Image Asset**: `assets/card-art/bundles/cards/55061.png` (1030×710 px, 333.6 KB)
### [55062] Love Triangle
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (7/11)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Trickster Magic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to an ally you control. Otherwise, this card gains surge.
  > Attached ally cannot attack the villain or defend against the villain's attacks.
  > **Alter-Ego Action**: Exhaust attached ally and spend a [mental] resource → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/55062.png` (710×1030 px, 372.0 KB)
### [55063] Absorbing Man — *Carl Creel*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (8/11)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 2), **ATK**: 1 [star] (Consequential: 2), **HP**: 3, **Resources**: [wild]
- **Traits**: *Defiant.*
- **Rules Text**:
  > Linked (Absorbing Man minion). Victory 0. Does not count against your ally limit.
  > [star] **Interrupt**: When Absorbing Man attacks or thwarts, exhaust an upgrade or support you control. Absorbing Man gets +X to that power for this use, where X is that card's printed cost (to a maximum of +3).
- **Image Asset**: `assets/card-art/bundles/cards/55063.jpg` (710×1030 px, 389.9 KB)
### [55064] Titania — *Mary MacPherran*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (9/11)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 3 [star] (Consequential: 2), **HP**: 5, **Resources**: [wild]
- **Traits**: *Defiant.*
- **Rules Text**:
  > Linked (Titania minion). Victory 0. Does not count against your ally limit.
  > [star] Titania's attacks gain overkill and piercing.
- **Image Asset**: `assets/card-art/bundles/cards/55064.png` (710×1030 px, 362.8 KB)
### [55065] Whirlwind — *David Cannon*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (10/11)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 0 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Defiant.*
- **Rules Text**:
  > Linked (Whirlwind minion). Victory 0. Does not count against your ally limit.
  > [star] **Interrupt**: When Whirlwind attacks, remove 1 threat from each scheme in play. For each threat removed this way, Whirlwind gets +1 ATK for that attack.
- **Image Asset**: `assets/card-art/bundles/cards/55065.jpg` (710×1030 px, 379.2 KB)
### [55066] Zzzax
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Trickster Takeover (`tt`)
- **Deck / Set**: Trickster Magic (11/11)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 3 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 4, **Resources**: [wild]
- **Traits**: *Defiant.*
- **Rules Text**:
  > Linked (Zzzax minion). Victory 0. Does not count against your ally limit.
  > **Response**: After Zzzax enters play, search the top 5 cards of your deck for a card with a printed [energy] resource and add it to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/55066.jpg` (710×1030 px, 387.1 KB)

