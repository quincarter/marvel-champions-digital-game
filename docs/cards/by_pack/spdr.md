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
| `31001a` | SP//dr Suit | Hero | SP//dr | THW:2 ATK:2 DEF:2 HP:14 | - | `spdr` |
| `31001b` | SP//dr Suit | Support | SP//dr | - | - | `spdr` |
| `31003` | VEN#m | Ally | SP//dr | THW:1 ATK:1 HP:3 | - | `spdr` |
| `31004` | All Systems Go! | Event | SP//dr | - | - | `spdr` |
| `31005` | Rapid Deployment | Event | SP//dr | - | - | `spdr` |
| `31006` | Web-Trap | Event | SP//dr | - | - | `spdr` |
| `31007` | Aunt May & Uncle Ben | Support | SP//dr | - | - | `spdr` |
| `31008` | Ejection Protocol | Support | SP//dr | - | - | `spdr` |
| `31009` | SP//dr Command | Support | SP//dr | - | - | `spdr` |
| `31010` | Host Spider | Upgrade | SP//dr | - | - | `spdr` |
| `31011` | Psychic Link | Upgrade | SP//dr | - | - | `spdr` |
| `31012` | Speed-Metal Alloy | Upgrade | SP//dr | - | - | `spdr` |
| `31013` | Web-Fluid Compressor | Upgrade | SP//dr | - | - | `spdr` |
| `31014` | Daredevil | Ally | Pack Position: 14 | THW:2 ATK:1 HP:3 | - | `spdr` |
| `31015` | Spider-Man Noir | Ally | Pack Position: 15 | THW:-1 ATK:-1 HP:3 | - | `spdr` |
| `31016` | Repurpose | Event | Pack Position: 16 | - | - | `spdr` |
| `31017` | Thwip Thwip! | Event | Pack Position: 17 | - | - | `spdr` |
| `31018` | Energy Barrier | Upgrade | Pack Position: 18 | - | - | `spdr` |
| `31019` | Forcefield Generator | Upgrade | Pack Position: 19 | - | - | `spdr` |
| `31020` | Spider-Tingle | Upgrade | Pack Position: 20 | - | - | `spdr` |
| `31021` | Spider-Ham | Ally | Pack Position: 21 | THW:2 ATK:2 HP:3 | - | `spdr` |
| `31022` | Spider-Man | Ally | Pack Position: 22 | THW:1 ATK:2 HP:2 | - | `spdr` |
| `31023` | Limitless Stamina | Event | Pack Position: 23 | - | - | `spdr` |
| `31024` | Unshakable | Upgrade | Pack Position: 24 | - | - | `spdr` |
| `31025` | Inherited Burden | Obligation | SP//dr | - | 2 icons | `spdr` |
| `31026` | Giant Monster Attack | Side Scheme | SP//dr Nemesis | - | 3 icons | `spdr` |
| `31027` | M.O.R.B.I.U.S. | Minion | SP//dr Nemesis | SCH:2 ATK:2 HP:6 | 2 icons | `spdr` |
| `31028` | Energy Drain | Treachery | SP//dr Nemesis | - | 1 icon | `spdr` |
| `31029` | Clarity of Purpose | Upgrade | Pack Position: 29 | - | - | `spdr` |
| `31030` | Grand Larceny | Side Scheme | Iron Spider's Sinister Six | - | 3 icons | `spdr` |
| `31031` | Bombshell | Minion | Iron Spider's Sinister Six | SCH:2 ATK:3 HP:4 | 0 icons + star | `spdr` |
| `31032` | Electro | Minion | Iron Spider's Sinister Six | SCH:1 ATK:2 HP:3 | 1 icon | `spdr` |
| `31033` | Hobgoblin | Minion | Iron Spider's Sinister Six | SCH:2 ATK:2 HP:5 | 2 icons | `spdr` |
| `31034` | Iron Spider | Minion | Iron Spider's Sinister Six | SCH:2 ATK:2 HP:6 | 3 icons | `spdr` |
| `31035` | Sandman | Minion | Iron Spider's Sinister Six | SCH:1 ATK:1 HP:7 | 1 icon + star | `spdr` |
| `31036` | Spot | Minion | Iron Spider's Sinister Six | SCH:1 ATK:1 HP:4 | 0 icons + star | `spdr` |
| `31037` | Surge in Crime | Environment | Iron Spider's Sinister Six | - | 2 icons | `spdr` |

---

## Pack: SP//dr (`spdr`)

### Set: SP//dr

### [31001a] SP//dr Suit
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 14, **Hand Size**: 3
- **Traits**: *Active. Web-Warrior.*
- **Rules Text**:
  > *Sync Ratio* — **Resource**: Exhaust an [[Interface]] upgrade you control → generate that upgrade's resources.
- **Flavor**: *"We're called SP//dr, and we protect the city."*
- **Image Asset**: `assets/card-art/bundles/cards/31001a.png` (710×1030 px, 393.7 KB)

### [31001b] SP//dr Suit
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (1/17)
- **Properties**: Unique, Permanent
- **Traits**: *Inactive. Tech.*
- **Rules Text**:
  > Permanent. This card's printed text box cannot be treated as if it were blank.
  > *Return to Base* — **Forced Interrupt**: When you flip to this side, flip SP//dr to Peni Parker. Detach Peni Parker from here, moving all counters on this card and cards attached to this card to her.
- **Errata (FFG)**:
  > Counters and attachments now move to Peni Parker, instead of the reverse. (RRG 1.6)
- **Image Asset**: `assets/card-art/bundles/cards/31001b.png` (710×1030 px, 440.6 KB)

### [31003] VEN#m — *Addy Brock*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (3/17)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 [star] (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Rules Text**:
  > [star] VEN#m gets +1 THW and +1 ATK for each sym counter on her.
  > **Hero Response**: After VEN#m enters play, place 1 sym counter on her for each resource generated by SP//dr Suit's *"Sync Ratio"* ability to pay for her.
- **Image Asset**: `assets/card-art/bundles/cards/31003.png` (607×880 px, 153.5 KB)

### [31004] All Systems Go!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (4–6/17, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > **Hero Action**: Choose:
  > • Ready each [[Interface]] upgrade you control.
  > • Search your deck and discard pile for an [[Interface]] upgrade and add it to your hand. (Shuffle.)
- **Image Asset**: `assets/card-art/bundles/cards/31004.png` (607×880 px, 137.0 KB)

### [31005] Rapid Deployment
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (7–8/17, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. If you paid for this card using a resource generated by SP//dr Suit's *"Sync Ratio"* ability, remove 3 threat from a scheme.
- **Flavor**: *"We'll protect this city, no matter what." —SP//dr*
- **Image Asset**: `assets/card-art/bundles/cards/31005.png` (607×880 px, 146.0 KB)

### [31006] Web-Trap
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (9–10/17, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy. If you paid for this card using a resource generated by SP//dr Suit's *"Sync Ratio"* ability, stun that enemy.
- **Flavor**: *"May wanted SP//dr to be better, to be the best we could. That's why she developed these web-traps!"*
- **Image Asset**: `assets/card-art/bundles/cards/31006.png` (607×880 px, 146.9 KB)

### [31007] Aunt May & Uncle Ben
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (11/17)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Action**: Exhaust Aunt May & Uncle Ben and discard the top 2 cards of your deck (top 3 cards instead if you are in alter-ego form) → add each SP//dr card discarded this way to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/31007.png` (607×880 px, 154.8 KB)

### [31008] Ejection Protocol
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (12/17)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Discard Ejection Protocol → exhaust each [[Interface]] upgrade you control, set your hit point dial to 6, give your identity a tough status card, and flip to alter-ego form.
- **Flavor**: *"Warning! Incoming threat!"*
- **Image Asset**: `assets/card-art/bundles/cards/31008.png` (607×880 px, 130.8 KB)

### [31009] SP//dr Command
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (13/17)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Hero Action**: Exhaust SP//dr Command and an [[Interface]] upgrade → draw 1 card.
  > **Hero Action**: Exhaust SP//dr Command, choose and discard 1 card from your hand → ready an [[Interface]] upgrade.
- **Flavor**: *"Peni, listen to our orders very carefully."*
- **Image Asset**: `assets/card-art/bundles/cards/31009.png` (607×880 px, 153.9 KB)

### [31010] Host Spider
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (14/17)
- **Stats**: **Cost**: 3, **Resources**: [wild]
- **Traits**: *Interface. Spider.*
- **Rules Text**:
  > **Hero Action**: Exhaust Host Spider → ready SP//dr Suit.
- **Flavor**: *"He trusts you… so will I." —Peni Parker*
- **Image Asset**: `assets/card-art/bundles/cards/31010.png` (607×880 px, 135.5 KB)

### [31011] Psychic Link
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (15/17)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Interface. Tech.*
- **Rules Text**:
  > **Hero Interrupt**: When SP//dr Suit makes a basic thwart, exhaust Psychic Link → it gets +2 THW for that thwart.
- **Flavor**: *"Can we listen to music? It helps us focus." —Peni Parker*
- **Image Asset**: `assets/card-art/bundles/cards/31011.png` (607×880 px, 146.1 KB)

### [31012] Speed-Metal Alloy
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (16/17)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Interface. Tech.*
- **Rules Text**:
  > **Hero Interrupt**: When SP//dr Suit defends against an attack, exhaust Speed-Metal Alloy → it gets +2 DEF for that defense.
- **Flavor**: *"I thought you said it was a suit—this is speed-metal!" —Spider-Ham*
- **Image Asset**: `assets/card-art/bundles/cards/31012.png` (607×880 px, 138.4 KB)

### [31013] Web-Fluid Compressor
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (17/17)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Interface. Tech.*
- **Rules Text**:
  > **Hero Interrupt**: When SP/dr Suit makes a basic attack, exhaust Web-Fluid Compressor → it gets +2 ATK for that attack.
- **Flavor**: *"Progress takes patience. That's why we have to keep working on it." —Aunt May*
- **Image Asset**: `assets/card-art/bundles/cards/31013.png` (607×880 px, 167.5 KB)

### [31025] Inherited Burden
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: SP//dr Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Peni Parker player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Peni Parker → remove Inherited Burden from the game.
  > • Choose and discard 1 [[Interface]] upgrade you control. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/31025.png` (607×880 px, 154.0 KB)


### Set: Protection

### [31014] Daredevil
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Rules Text**:
  > **Response**: After Daredevil defends against an attack, move 1 damage from him to the attacking enemy.
- **Flavor**: *"Quiet breaks, shatters down, so the city reaches out. Listening… Waiting… Another station for a signal, and we're all some kind of noise. Be the good kind, Peni."*
- **Image Asset**: `assets/card-art/bundles/cards/31014.png` (607×880 px, 137.0 KB)

### [31015] Spider-Man Noir
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: -1 (Consequential: 1), **ATK**: -1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > X is equal to the number of facedown cards attached to Spider-Man Noir.
  > **Response**: After you resolve a treachery, if you control another [[Web-Warrior]] card, attach that treachery facedown here (to a maximum of 3).
- **Image Asset**: `assets/card-art/bundles/cards/31015.png` (607×880 px, 137.9 KB)

### [31016] Repurpose
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action**: Discard a [[Tech]] upgrade you control → ready your hero and choose THW, ATK, or DEF. Until the end of the round, your hero gets +X to the chosen power, where X is equal to that upgrade's printed cost.
- **Image Asset**: `assets/card-art/bundles/cards/31016.png` (607×880 px, 135.4 KB)

### [31017] Thwip Thwip!
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Deal 1 damage to a [[Web-Warrior]] character you control → place a total of 2 stun status cards on up to 2 enemies.
- **Flavor**: *"You now have the entire afternoon to reconsider your life choices. You're welcome." —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/31017.png` (607×880 px, 128.6 KB)

### [31018] Energy Barrier
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Uses (3 reflection counters). **Interrupt:** When you would take any amount of damage, remove 1 reflection counter from here → prevent 1 of that damage and deal 1 damage to an enemy.

### [31019] Forcefield Generator
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Tech.*
- **Rules Text**:
  > Uses (6 energy counters). Max 1 per player.
  > **Forced Interrupt**: When you would take any amount of damage, remove that many energy counters from here. For each energy counter removed this way, prevent 1 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/31019.png` (607×880 px, 142.2 KB)

### [31020] Spider-Tingle
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Interrupt**: When you would reveal an encounter card, deal 1 damage to a [[Web-Warrior]] character you control → if that card is a treachery, cancel its **"When Revealed"** effects and discard Spider-Tingle.
- **Image Asset**: `assets/card-art/bundles/cards/31020.png` (607×880 px, 143.9 KB)


### Set: Basic

### [31021] Spider-Ham — *Peter Porker*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 [star], **ATK**: 2 [star], **HP**: 3, **Resources**: [physical]
- **Traits**: *Cartoon. Web-Warrior.*
- **Rules Text**:
  > Play only if you control a [[Web-Warrior]] card.
  > [star] **Forced Response**: After Spider-Ham attacks or thwarts, discard the top card of the encounter deck. For each boost icon ([boost]) discarded this way, deal 1 damage to Spider-Ham.
- **Image Asset**: `assets/card-art/bundles/cards/31021.png` (607×880 px, 129.9 KB)

### [31022] Spider-Man — *Otto Octavius*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 2), **HP**: 2, **Resources**: [mental]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > Play only if you control a [[Web-Warrior]] card.
  > **Response**: After you play Spider-Man from your hand, ready an upgrade you control. If that upgrade has the [[Tech]] trait, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/31022.png` (607×880 px, 145.6 KB)

### [31023] Limitless Stamina
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Play only if your identity has at least 14 printed hit points.
  > **Hero Action**: Ready your hero.
- **Flavor**: *"What, you think this fight is almost over?! That was just warm-up practice." —Thor*
- **Image Asset**: `assets/card-art/bundles/cards/31023.png` (607×880 px, 132.8 KB)

### [31024] Unshakable
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Condition. Superpower.*
- **Rules Text**:
  > Play only if your identity has at least 14 printed hit points.
  > Your identity gains steady.
- **Image Asset**: `assets/card-art/bundles/cards/31024.png` (607×880 px, 141.4 KB)


### Set: SP//dr Nemesis

### [31026] Giant Monster Attack
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr Nemesis (1/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: SP//dr Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > As an additional cost to thwart this scheme, you must spend a [energy] resource.
- **Flavor**: *M.O.R.B.I.U.S. is laying siege to the city, wreaking havoc and siphoning energy from its power grid.*
- **Image Asset**: `assets/card-art/bundles/cards/31026.png` (880×607 px, 207.1 KB)

### [31027] M.O.R.B.I.U.S.
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr Nemesis (2/5)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: SP//dr Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature.*
- **Rules Text**:
  > **Forced Response**: After the engaged hero generates any number of resources, deal an equal amount of damage to that hero.
  > *(SP//dr's nemesis minion.)*
- **Flavor**: *"This is a threat unlike any you've faced before!" —Uncle Ben*
- **Image Asset**: `assets/card-art/bundles/cards/31027.png` (607×880 px, 148.8 KB)

### [31028] Energy Drain
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: SP//dr Nemesis (3–5/5, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: SP//dr Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Choose to either spend [energy][energy] resources or exhaust your identity.
  > **When Revealed (Hero)**: Choose to either spend [energy][energy] or take 3 damage.
- **Image Asset**: `assets/card-art/bundles/cards/31028.png` (607×880 px, 144.2 KB)


### Set: Leadership

### [31029] Clarity of Purpose
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to a friendly character. Max 1 per character.
  > **Hero Resource**: Exhaust this card and deal 1 damage to attached character → generate a [wild] resource.
- **Image Asset**: `assets/card-art/bundles/cards/31029.png` (607×880 px, 151.4 KB)


### Set: Iron Spider's Sinister Six

### [31030] Grand Larceny
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Iron Spider's Sinister Six (1/8)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Spider's Sinister Six Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Threat cannot be removed from this scheme while a [[Criminal]] minion is in play.
- **Flavor**: *The Iron Spider's Sinister Six are on an crime spree, robbing every business they come across.*
- **Image Asset**: `assets/card-art/bundles/cards/31030.png` (880×607 px, 202.5 KB)

### [31031] Bombshell
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Iron Spider's Sinister Six (2/8)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Iron Spider's Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] Divide damage from Bombshell's attack among each character the attacked player controls as evenly as possible.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 indirect damage to each player. Exhaust each character damaged this way.
- **Image Asset**: `assets/card-art/bundles/cards/31031.png` (607×880 px, 130.7 KB)

### [31032] Electro
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Iron Spider's Sinister Six (3/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Spider's Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] Electro gets +1 hit point for each [energy] resource attached to her.
  > [star] **Forced Response**: After Electro engages you or activates against you, choose 1 card from your hand with a printed [energy] resource and attach it to her.
- **Image Asset**: `assets/card-art/bundles/cards/31032.png` (607×880 px, 137.5 KB)

### [31033] Hobgoblin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Iron Spider's Sinister Six (4/8)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Spider's Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Hobgoblin would attack you, discard cards from the top of the encounter deck equal to Hobgoblin's ATK instead. Take 1 indirect damage for each boost icon ([boost]) discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/31033.png` (607×880 px, 142.7 KB)

### [31034] Iron Spider
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Iron Spider's Sinister Six (5/8)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Spider's Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Elite.*
- **Rules Text**:
  > Guard. Patrol. Retaliate 1. Toughness.
  > [star] Iron Spider's attacks gain overkill.
- **Flavor**: *"Don't make me whoop you."*
- **Image Asset**: `assets/card-art/bundles/cards/31034.png` (607×880 px, 127.7 KB)

### [31035] Sandman
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Iron Spider's Sinister Six (6/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Iron Spider's Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **Forced Response**: After Sandman takes any amount of damage from an attack, discard the top 7 cards of the encounter deck.
  >
  > ---
  >
  > [star] **Boost**: Discard the top 7 cards of the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/31035.png` (607×880 px, 134.4 KB)

### [31036] Spot
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Iron Spider's Sinister Six (7/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Iron Spider's Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Defeated**: If Spot was defeated without excess damage, shuffle him into the encounter deck.
  >
  > ---
  >
  > [star] **Boost**: Put this minion into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/31036.png` (607×880 px, 119.3 KB)

### [31037] Surge in Crime
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: SP//dr (`spdr`)
- **Deck / Set**: Iron Spider's Sinister Six (8/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Spider's Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > Each [[Criminal]] minion gains surge.
  > **Hero Action**: If there are no [[Criminal]] minions in play, spend 2 resources of any type → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/31037.png` (607×880 px, 137.6 KB)


