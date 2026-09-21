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
| `30001a` | Spider-Ham | Hero | Spider-Ham | THW:2 ATK:1 DEF:1 HP:12 | - | `spiderham` |
| `30001b` | Peter Porker | Alter-Ego | Spider-Ham | REC:5 HP:12 | - | `spiderham` |
| `30002` | Captain Americat | Ally | Spider-Ham | THW:2 ATK:2 HP:3 | - | `spiderham` |
| `30003` | Ham It Up | Event | Spider-Ham | - | - | `spiderham` |
| `30004` | Hogwashed | Event | Spider-Ham | - | - | `spiderham` |
| `30005` | "I Don't Think So!" | Event | Spider-Ham | - | - | `spiderham` |
| `30006` | Petulant Pig | Event | Spider-Ham | - | - | `spiderham` |
| `30007` | Swinging Web Pig | Event | Spider-Ham | - | - | `spiderham` |
| `30008` | The Daily Beagle | Support | Spider-Ham | - | - | `spiderham` |
| `30009` | Cartoon Physics | Upgrade | Spider-Ham | - | - | `spiderham` |
| `30010` | Huge Wooden Hammer | Upgrade | Spider-Ham | - | - | `spiderham` |
| `30011` | Organic Webbing | Upgrade | Spider-Ham | - | - | `spiderham` |
| `30012` | Lady Spider | Ally | Pack Position: 12 | THW:2 ATK:2 HP:4 | - | `spiderham` |
| `30013` | Spider-Man | Ally | Pack Position: 13 | THW:1 ATK:1 HP:3 | - | `spiderham` |
| `30014` | Even the Odds | Event | Pack Position: 14 | - | - | `spiderham` |
| `30015` | Great Responsibility | Event | Pack Position: 15 | - | - | `spiderham` |
| `30016` | Making an Entrance | Event | Pack Position: 16 | - | - | `spiderham` |
| `30017` | One Way or Another | Event | Pack Position: 17 | - | - | `spiderham` |
| `30018` | Followed | Upgrade | Pack Position: 18 | - | - | `spiderham` |
| `30019` | Overwatch | Upgrade | Pack Position: 19 | - | - | `spiderham` |
| `30020` | Scarlet Spider | Ally | Pack Position: 20 | THW:1 ATK:2 HP:4 | - | `spiderham` |
| `30021` | SP//dr | Ally | Pack Position: 21 | THW:2 ATK:1 HP:2 | - | `spiderham` |
| `30022` | Team-Building Exercise | Support | Pack Position: 22 | - | - | `spiderham` |
| `30023` | Web of Life and Destiny | Support | Pack Position: 23 | - | - | `spiderham` |
| `30024` | "I Really Want a Hot Dog!" | Obligation | Spider-Ham | - | 2 icons | `spiderham` |
| `30025` | Nefarious Trap | Side Scheme | Spider-Ham Nemesis | - | 2 icons | `spiderham` |
| `30026` | The Green Gobbler | Minion | Spider-Ham Nemesis | SCH:1 ATK:2 HP:4 | 3 icons | `spiderham` |
| `30027` | Gobbler Glider | Attachment | Spider-Ham Nemesis | SCH:1 ATK:1 | 2 icons | `spiderham` |
| `30028` | "Feast on This!" | Treachery | Spider-Ham Nemesis | - | 1 icon | `spiderham` |
| `30029` | Warrior of the Great Web | Upgrade | Pack Position: 29 | - | - | `spiderham` |
| `30030` | Hunting the Spider-Totems | Side Scheme | The Inheritors | - | 3 icons | `spiderham` |
| `30031` | Bora | Minion | The Inheritors | SCH:3 ATK:1 HP:5 | 2 icons | `spiderham` |
| `30032` | Brix | Minion | The Inheritors | SCH:1 ATK:2 HP:5 | 2 icons | `spiderham` |
| `30033` | Daemos | Minion | The Inheritors | SCH:1 ATK:3 HP:6 | 2 icons | `spiderham` |
| `30034` | Jennix | Minion | The Inheritors | SCH:2 ATK:2 HP:6 | 2 icons | `spiderham` |
| `30035` | Karn | Minion | The Inheritors | SCH:1 ATK:3 HP:5 | 2 icons | `spiderham` |
| `30036` | Morlun | Minion | The Inheritors | SCH:2 ATK:2 HP:5 | 2 icons | `spiderham` |
| `30037` | Solus | Minion | The Inheritors | SCH:2 ATK:3 HP:7 | 3 icons | `spiderham` |
| `30038` | Verna | Minion | The Inheritors | SCH:1 ATK:1 HP:6 | 2 icons | `spiderham` |

---

## Pack: Spider-Ham (`spiderham`)

### Set: Spider-Ham

### [30001a] Spider-Ham
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1, **DEF**: 1, **HP**: 12, **Hand Size**: 5
- **Traits**: *Cartoon. Web-Warrior.*
- **Rules Text**:
  > Each toon counter on Spider-Ham can be spent as if it were a [wild] resource.
  > *Spider-Nonsense* — **Response**: After Spider-Ham takes any amount of damage, place 1 toon counter on him.
- **Image Asset**: `assets/card-art/bundles/cards/30001a.png` (710×1030 px, 385.7 KB)

### [30001b] Peter Porker
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 5, **HP**: 12, **Hand Size**: 6
- **Traits**: *Cartoon. Civilian.*
- **Rules Text**:
  > *Cartoon Power* — **Response**: After you make a basic recovery, place 1 toon counter on Peter Porker.
- **Flavor**: *"You ever feel as if someone else is in control, like you're just a character in a game?"*
- **Image Asset**: `assets/card-art/bundles/cards/30001b.png` (710×1030 px, 417.4 KB)

### [30002] Captain Americat — *Steve Mouser*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Cartoon.*
- **Rules Text**:
  > **Response**: After Captain Americat enters play, give someone a high five. Place 1 toon counter on your identity and shuffle 1 Spider-Ham card from your discard pile into your deck.
- **Flavor**: *"I fight in purr-suit of justice and freedom!"*
- **Image Asset**: `assets/card-art/bundles/cards/30002.png` (607×880 px, 142.0 KB)

### [30003] Ham It Up
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (2–3/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Cartoon. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 1 threat from a scheme for each toon counter on Spider-Ham.
- **Flavor**: *"Looks like pigs CAN fly!" —Spider-Ham*
- **Image Asset**: `assets/card-art/bundles/cards/30003.png` (607×880 px, 147.2 KB)

### [30004] Hogwashed
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (4/15)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Cartoon.*
- **Rules Text**:
  > **Hero Action**: Remove 1 toon counter from Spider-Ham → loudly read this card's flavor text. Choose to either deal 5 damage to a minion or remove 5 threat from a side scheme.
- **Flavor**: *POW! BAM! WHACK! SMACK! BOINK!*
- **Image Asset**: `assets/card-art/bundles/cards/30004.png` (607×880 px, 134.8 KB)

### [30005] "I Don't Think So!"
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (5/15)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Cartoon.*
- **Rules Text**:
  > **Hero Interrupt**: When you reveal a card from the encounter deck, remove 1 toon counter from Spider-Ham → say "I don't think so!" in your best Spider-Ham voice. Cancel the effects of that card and discard it.
- **Image Asset**: `assets/card-art/bundles/cards/30005.png` (607×880 px, 153.2 KB)

### [30006] Petulant Pig
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (6–7/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Cartoon.*
- **Rules Text**:
  > **Hero Action**: Stick your tongue out at the villain. The villain attacks you. Draw 3 cards.
- **Flavor**: *"THBBPTHBPT!" —Spider-Ham*
- **Image Asset**: `assets/card-art/bundles/cards/30006.png` (607×880 px, 129.1 KB)

### [30007] Swinging Web Pig
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (8–10/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Cartoon. Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 6 damage to an enemy. Confuse that enemy.
- **Flavor**: *"Am I a pig with the proportionate strength and agility of a spider? Or a spider with the physical limitations of a pig?" —Peter Porker*
- **Image Asset**: `assets/card-art/bundles/cards/30007.png` (607×880 px, 150.2 KB)

### [30008] The Daily Beagle
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Cartoon. Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust The Daily Beagle → place 1 toon counter on Peter Porker.
- **Flavor**: *"J. Jonah Jackal here with today's trusted, trademarked televised tirade—a tantrum tinged by a towering 'told you!'" —J. Jonah Jackal*
- **Image Asset**: `assets/card-art/bundles/cards/30008.png` (607×880 px, 170.7 KB)

### [30009] Cartoon Physics
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (12–13/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Cartoon. Superpower.*
- **Rules Text**:
  > **Interrupt**: When your identity would take any amount of damage, discard this card → wiggle your body and prevent all but 1 of that damage.
- **Flavor**: *"Barely felt a thing…" —Spider-Ham*
- **Image Asset**: `assets/card-art/bundles/cards/30009.png` (607×880 px, 140.5 KB)

### [30010] Huge Wooden Hammer
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (14/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Cartoon. Weapon.*
- **Rules Text**:
  > Spider-Ham gets +1 ATK.
  > **Hero Interrupt**: When Spider-Ham makes a basic attack, exhaust Huge Wooden Hammer and remove 1 toon counter from Spider-Ham → Spider-Ham gets +2 ATK for that attack. That attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/30010.png` (607×880 px, 143.2 KB)

### [30011] Organic Webbing
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (15/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Cartoon. Superpower.*
- **Rules Text**:
  > Spider-Ham gets +1 THW.
  > **Hero Action**: Exhaust Organic Webbing and remove 1 toon counter from Spider-Ham → ready Spider-Ham. He gains the [[Aerial]] trait until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/30011.png` (607×880 px, 145.4 KB)

### [30024] "I Really Want a Hot Dog!"
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Ham Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Give to the Peter Porker player.**
  > You may flip to alter-ego form. Choose:
  > • Exhaust Peter Porker and remove 1 toon counter from him → remove "I Really Want a Hot Dog!" from the game.
  > • You are stunned. If you are already stunned, this card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/30024.png` (607×880 px, 156.6 KB)


### Set: Justice

### [30012] Lady Spider — *May Reilly*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 2), **ATK**: 2 (Consequential: 2), **HP**: 4, **Resources**: [mental]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > [star] **Response**: After Lady Spider thwarts and removes threat from a scheme, if you control another [[Web-Warrior]] card, remove an equal amount of threat from a different scheme.
- **Flavor**: *"Let no one cage you."*
- **Image Asset**: `assets/card-art/bundles/cards/30012.png` (607×880 px, 142.4 KB)

### [30013] Spider-Man — *Pavitr Prabhakar*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > **Response**: After Spider-Man enters play, remove 1 threat from a scheme for each [[Web-Warrior]] card you control (including Spider-Man).
- **Flavor**: *"Villains from Ham's future. Gigantic robots now. Worlds in the Web are becoming entangled."*
- **Image Asset**: `assets/card-art/bundles/cards/30013.png` (607×880 px, 127.5 KB)

### [30014] Even the Odds
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Requirement ([energy]).
  > **Hero Action** *(thwart)*: Remove 1 [per_hero] threat from each side scheme. Deal 1 damage to the villain for each side scheme defeated this way.
- **Image Asset**: `assets/card-art/bundles/cards/30014.png` (607×880 px, 154.2 KB)

### [30015] Great Responsibility
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Hero Interrupt**: When any amount of threat would be placed on a scheme, you take it as damage instead.

### [30016] Making an Entrance
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt:** When your hero makes a basic thwart, it gets +2 THW for that thwart. After that thwart ends, if your hero removed all threat from a scheme that way, heal 2 damage from your hero.

### [30017] One Way or Another
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > Max 1 per round.
  > **Hero Action**: Search the encounter deck for a side scheme. Reveal that side scheme → draw 3 cards (shuffle the encounter deck).

### [30018] Followed
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > Attach to a side scheme. Max 1 per scheme.
  > **Interrupt**: When attached scheme is defeated, deal 4 damage to an enemy.
- **Errata (FFG)**:
  > Changed “Response” to “Interrupt”. (RRG 1.3)

### [30019] Overwatch
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > Attach to a scheme. Max 1 per scheme.
  > **Hero Interrupt**: When any amount of threat is removed from attached scheme by a thwart, discard this card → remove an equal amount of threat from a different scheme.
- **Image Asset**: `assets/card-art/bundles/cards/30019.png` (607×880 px, 148.8 KB)


### Set: Basic

### [30020] Scarlet Spider — *Kaine*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 4, **Resources**: [mental]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > Play only if you control a [[Web-Warrior]] card.
  > **Interrupt**: When you would reveal an encounter card, name a card type, then look at that card. If that card is of the named type, deal 1 damage to Scarlet Spider and draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/30020.png` (607×880 px, 153.6 KB)

### [30021] SP//dr — *Peni Parker*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > Play only if you control a [[Web-Warrior]] card.
  > **When Defeated**: Add SP//dr to your hand if she was defeated by taking excess consequential damage.
- **Image Asset**: `assets/card-art/bundles/cards/30021.png` (607×880 px, 146.9 KB)

### [30022] Team-Building Exercise
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Hero Action**: Exhaust Team-Building Exercise → play a card from your hand that shares a trait with your hero, reducing its resource cost by 1.

### [30023] Web of Life and Destiny
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Location. Web-Warrior.*
- **Rules Text**:
  > Ignore this card's resource cost if your identity has the [[Web-Warrior]] trait.
  > **Response**: After a [[Web-Warrior]] ally leaves play, choose a player → that player draws 1 card.

### [30029] Warrior of the Great Web
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Title.*
- **Rules Text**:
  > Attach to a character with "Spider" in its title. Max 1 per character.
  > Attached character gains the [[Web-Warrior]] trait.
  > **Response**: After a [[Web-Warrior]] ally leaves play, attached character gets +1 ATK until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/30029.png` (607×880 px, 158.1 KB)


### Set: Spider-Ham Nemesis

### [30025] Nefarious Trap
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham Nemesis (1/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Ham Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: The Green Gobbler attacks the player who defeated this scheme. If The Green Gobbler is not in play, search the encounter deck and discard pile for him and put him into play engaged with the player who defeated this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/30025.png` (880×607 px, 221.7 KB)

### [30026] The Green Gobbler
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Ham Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cartoon. Criminal.*
- **Rules Text**:
  > **Forced Response**: After The Green Gobbler engages you, discard all counters from each card you control.
  > *(Spider-Ham's nemesis minion.)*
- **Flavor**: *"I'll succeed by any means necessary, even if I must resort to fowl play!" —The Green Gobbler*
- **Image Asset**: `assets/card-art/bundles/cards/30026.png` (607×880 px, 154.1 KB)

### [30027] Gobbler Glider
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham Nemesis (3/5)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Ham Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > Attach to The Green Gobbler. If you cannot, attach to a minion.
  > Attached minion gains the [[Aerial]] trait.
- **Flavor**: *"Once I'm finished, I'll be at the top of the pecking order." —The Green Gobbler*
- **Image Asset**: `assets/card-art/bundles/cards/30027.png` (607×880 px, 143.5 KB)

### [30028] "Feast on This!"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: Spider-Ham Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Ham Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Take 2 damage. You are confused. If you already confused, this card gains surge.
- **Flavor**: *"I hope you left room for some pumpkin DIE!" —The Green Gobbler*
- **Image Asset**: `assets/card-art/bundles/cards/30028.png` (607×880 px, 141.3 KB)


### Set: The Inheritors

### [30030] Hunting the Spider-Totems
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: The Inheritors (1/9)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Inheritors Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When the villain phase begins, discard the top 3 cards of the encounter deck. Put each [[Inheritor]] minion discarded this way into play engaged with a player who controls a [[Web-Warrior]] character, if able. Otherwise, put each [[Inheritor]] minion discarded this way into play engaged with the first player.
- **Flavor**: *"there is no 'mission'. This is what we do—we hunt the spiders. It's our way." —Karn*
- **Image Asset**: `assets/card-art/bundles/cards/30030.png` (880×607 px, 233.9 KB)

### [30031] Bora
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: The Inheritors (2/9)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Inheritors Set Icon (printed bottom-right next to deck number)
- **Traits**: *Inheritor.*
- **Rules Text**:
  > Each [[Inheritor]] minion gains 1 acceleration icon ([acceleration]).
  > **When Revealed**: If a [[Web-Warrior]] character is in play, place 1 threat on each scheme.
- **Flavor**: *"My dear brothers, let us devour them together!"*
- **Image Asset**: `assets/card-art/bundles/cards/30031.png` (607×880 px, 136.8 KB)

### [30032] Brix
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: The Inheritors (3/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Inheritors Set Icon (printed bottom-right next to deck number)
- **Traits**: *Inheritor.*
- **Rules Text**:
  > Each [[Inheritor]] minion gains patrol.
  > **When Revealed**: If a [[Web-Warrior]] character is in play, place 2 threat on the main scheme.
- **Flavor**: *"In a twist of irony, the Web of Life and Destiny has brought us to this very moment. Your last moment."*
- **Image Asset**: `assets/card-art/bundles/cards/30032.png` (607×880 px, 140.5 KB)

### [30033] Daemos
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: The Inheritors (4/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Inheritors Set Icon (printed bottom-right next to deck number)
- **Traits**: *Inheritor.*
- **Rules Text**:
  > Each [[Inheritor]] minion gains stalwart.
  > **When Revealed**: If a [[Web-Warrior]] character is in play, stun a character you control.
- **Flavor**: *"I am Daemos, son of Solus. One of the Inheritors of All Creation. And you… are a mote. A speck. A bit of dust in the wind."*
- **Image Asset**: `assets/card-art/bundles/cards/30033.png` (607×880 px, 130.5 KB)

### [30034] Jennix
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: The Inheritors (5/9)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Inheritors Set Icon (printed bottom-right next to deck number)
- **Traits**: *Inheritor.*
- **Rules Text**:
  > Each [[Inheritor]] minion gains guard.
  > **When Revealed**: If a [[Web-Warrior]] character is in play, give Jennix a tough status card.
- **Flavor**: *"I prefer to make them struggle. I love the taste of adrenaline."*
- **Image Asset**: `assets/card-art/bundles/cards/30034.png` (607×880 px, 129.4 KB)

### [30035] Karn
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: The Inheritors (6/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Inheritors Set Icon (printed bottom-right next to deck number)
- **Traits**: *Inheritor.*
- **Rules Text**:
  > Each [[Inheritor]] minion's attacks gain overkill and piercing.
  > **When Revealed**: If a [[Web-Warrior]] character is in play, discard an upgrade or support you control.
- **Flavor**: *"You'll make a filling meal."*
- **Image Asset**: `assets/card-art/bundles/cards/30035.png` (607×880 px, 125.1 KB)

### [30036] Morlun
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: The Inheritors (7/9)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Inheritors Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Inheritor.*
- **Rules Text**:
  > Each [[Inheritor]] minion gets +1 ATK.
  > **When Revealed**: If a [[Web-Warrior]] character is in play, take 2 damage.
- **Flavor**: *"Mm. Never savored a life force so sweet."*
- **Image Asset**: `assets/card-art/bundles/cards/30036.png` (607×880 px, 124.9 KB)

### [30037] Solus
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: The Inheritors (8/9)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Inheritors Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Inheritor.*
- **Rules Text**:
  > Each [[Inheritor]] minion gains villainous.
  > **When Revealed**: If a [[Web-Warrior]] character is in play, give Solus 1 facedown boost card.
- **Flavor**: *"I am Solus. I herald the death of you all."*
- **Image Asset**: `assets/card-art/bundles/cards/30037.png` (607×880 px, 139.8 KB)

### [30038] Verna
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Spider-Ham (`spiderham`)
- **Deck / Set**: The Inheritors (9/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Inheritors Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Inheritor.*
- **Rules Text**:
  > Each [[Inheritor]] minion gains retaliate 1.
  > **When Revealed**: If a [[Web-Warrior]] character is in play, deal 1 damage to each character you control.
- **Flavor**: *"I will feast on your bones!"*
- **Image Asset**: `assets/card-art/bundles/cards/30038.png` (607×880 px, 123.0 KB)


