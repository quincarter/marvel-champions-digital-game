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
| `41001a` | Psylocke | Hero | Psylocke | THW:1 ATK:1 DEF:2 HP:10 | - | `psylocke` |
| `41001b` | Betsy Braddock | Alter-Ego | Psylocke | REC:3 HP:10 | - | `psylocke` |
| `41002a` | Psi-Knife | Upgrade | Psylocke | - | - | `psylocke` |
| `41002b` | Psi-Katana | Upgrade | Psylocke | - | - | `psylocke` |
| `41003` | Angel | Ally | Psylocke | THW:1 ATK:2 HP:3 | - | `psylocke` |
| `41004` | Flurry of Blades | Event | Psylocke | - | - | `psylocke` |
| `41005` | Mental Detection | Event | Psylocke | - | - | `psylocke` |
| `41006` | Psionic Redirect | Event | Psylocke | - | - | `psylocke` |
| `41007` | Telepathic Suggestion | Event | Psylocke | - | - | `psylocke` |
| `41008` | Training Regimen | Support | Psylocke | - | - | `psylocke` |
| `41009` | Martial Arts Training | Upgrade | Psylocke | - | - | `psylocke` |
| `41010` | Psionic Training | Upgrade | Psylocke | - | - | `psylocke` |
| `41011` | Weapons Training | Upgrade | Psylocke | - | - | `psylocke` |
| `41012` | Captain Britain | Ally | Pack Position: 12 | THW:3 ATK:3 HP:3 | - | `psylocke` |
| `41013` | Cypher | Ally | Pack Position: 13 | THW:1 ATK:1 HP:2 | - | `psylocke` |
| `41014` | Concussive Blow | Event | Pack Position: 14 | - | - | `psylocke` |
| `41015` | Upside the Head | Event | Pack Position: 15 | - | - | `psylocke` |
| `41016` | Lay the Trap | Player Side Scheme | Pack Position: 16 | - | - | `psylocke` |
| `41017` | Float Like a Butterfly | Upgrade | Pack Position: 17 | - | - | `psylocke` |
| `41018` | Pete Wisdom | Ally | Pack Position: 18 | THW:3 ATK:2 HP:3 | - | `psylocke` |
| `41019` | Directed Force | Event | Pack Position: 19 | - | - | `psylocke` |
| `41020` | Soaring Hearts | Event | Pack Position: 20 | - | - | `psylocke` |
| `41021` | The Power of the Mind | Resource | Pack Position: 21 | - | - | `psylocke` |
| `41022` | IPAC | Support | Pack Position: 22 | - | - | `psylocke` |
| `41023` | X-Bunker | Support | Pack Position: 23 | - | - | `psylocke` |
| `41024` | Telepathy | Upgrade | Pack Position: 24 | - | - | `psylocke` |
| `41025` | Body Swapped | Obligation | Psylocke | - | 2 icons | `psylocke` |
| `41026` | Chimera | Minion | Psylocke Nemesis | SCH:1 ATK:1 HP:5 | 3 icons | `psylocke` |
| `41027` | Interdimensional Plunder | Side Scheme | Psylocke Nemesis | - | 3 icons | `psylocke` |
| `41028` | Psionic Illusion | Attachment | Psylocke Nemesis | - | 2 icons | `psylocke` |
| `41029` | Telekinetic Dragon | Treachery | Psylocke Nemesis | - | 0 icons + star | `psylocke` |
| `41030` | Psi-Bow Attack | Event | Pack Position: 30 | - | - | `psylocke` |
| `41031` | Domino | Ally | Pack Position: 31 | THW:1 ATK:2 HP:3 | - | `psylocke` |
| `41032` | Psi-Flail Strike | Event | Pack Position: 32 | - | - | `psylocke` |
| `41033` | Telekinesis | Upgrade | Pack Position: 33 | - | - | `psylocke` |

---

## Pack: Psylocke (`psylocke`)

### Set: Psylocke

### [41001a] Psylocke
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1 [star], **ATK**: 1 [star], **DEF**: 2 [star], **HP**: 10, **Hand Size**: 4
- **Traits**: *Psionic. X-Force.*
- **Rules Text**:
  > [star] *Psi-Energy Control* — **Interrupt**: When you use one of Psylocke's basic powers *(THW, ATK, or DEF)*, flip 1 [[PSI-ENERGY]] upgrade.
- **Image Asset**: `assets/card-art/bundles/cards/41001a.png` (300×418 px, 75.5 KB)

### [41001b] Betsy Braddock
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Mutant. Psionic.*
- **Rules Text**:
  > *Psionic Manifestation* — **Setup**: Put your 2 [[PSI-ENERGY]] upgrades into play, Psi-Knife side faceup.
  > **Action**: Exhaust 1 [[PSI-ENERGY]] upgrade → shuffle 1 [[PSIONIC]] card from your discard pile into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/41001b.png` (300×418 px, 67.7 KB)

### [41002a] Psi-Knife
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (1–2/17, Qty: 2)
- **Properties**: Permanent
- **Stats**: **Resources**: [mental]
- **Traits**: *Psi-Energy. Weapon.*
- **Rules Text**:
  > Permanent.
  > Psylocke gets +1 THW.
  > **Hero Resource**: Exhaust Psi-Knife → generate a [mental] resource. You may flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/41002a.png` (289×419 px, 232.6 KB)

### [41002b] Psi-Katana
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (1–2/17, Qty: 2)
- **Properties**: Permanent
- **Stats**: **Resources**: [physical]
- **Traits**: *Psi-Energy. Weapon.*
- **Rules Text**:
  > Permanent. Restricted.
  > Psylocke gets +1 ATK and her basic attacks gain piercing.
  > **Hero Resource**: Exhaust Psi-Katana → generate a [physical] resource. You may flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/41002b.png` (289×419 px, 247.5 KB)

### [41003] Angel — *Warren Worthington III*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (3/17)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Aerial. X-Force.*
- **Rules Text**:
  > **Response**: After you play Angel from your hand, ready your identity.
- **Flavor**: *"Did someone call for a pick-me-up?"*
- **Image Asset**: `assets/card-art/bundles/cards/41003.png` (710×1030 px, 306.4 KB)

### [41004] Flurry of Blades
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (4–6/17, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Psionic.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to an enemy. For each Psi-Knife you control, choose an enemy and confuse it. For each Psi-Katana you control, choose an enemy and deal 2 damage to it.
- **Image Asset**: `assets/card-art/bundles/cards/41004.png` (710×1030 px, 320.8 KB)

### [41005] Mental Detection
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (7–9/17, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Psionic. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 1 threat from a scheme. For each Psi-Knife you control, remove 2 additional threat from that scheme. For each Psi-Katana you control, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/41005.png` (710×1030 px, 320.8 KB)

### [41006] Psionic Redirect
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (10–11/17, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Defense. Psionic.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you would take any amount of damage from an enemy attack, prevent 2 of that damage. For each Psi-Katana you control, prevent 2 additional damage. For each Psi-Knife you control, confuse that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/41006.png` (710×1030 px, 343.6 KB)

### [41007] Telepathic Suggestion
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (12–13/17, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Psionic.*
- **Rules Text**:
  > **Hero Interrupt**: When you reveal a card from the encounter deck, cancel its "**When Revealed**" effects. For each Psi-Katana you control, choose an enemy and deal 2 damage to it. For each Psi-Knife you control, choose a scheme and remove 1 threat from it.
- **Image Asset**: `assets/card-art/bundles/cards/41007.png` (710×1030 px, 328.6 KB)

### [41008] Training Regimen
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (14/17)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Training.*
- **Rules Text**:
  > **Action**: Exhaust Training Regiment → search your deck for a [[SKILL]] card and add it to your hand. *(Shuffle.)* If you are in hero form, discard 1 card from your hand.
- **Flavor**: *"Practice makes perfect." —Psylocke*
- **Image Asset**: `assets/card-art/bundles/cards/41008.png` (710×1030 px, 371.7 KB)

### [41009] Martial Arts Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (15/17)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Psylocke gets +1 DEF.
  > **Hero Response**: After Psylocke defends against an attack, discard Martial Arts Training → ready Psylocke.
- **Image Asset**: `assets/card-art/bundles/cards/41009.png` (710×1030 px, 299.5 KB)

### [41010] Psionic Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (16/17)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > Psylocke ignores the guard and patrol keywords.
  > **Hero Response**: After Psylocke thwarts, discard Psionic Training → confuse an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/41010.png` (710×1030 px, 375.2 KB)

### [41011] Weapons Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (17/17)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Psylocke gains retaliate 1.
  > **Hero Response**: After Psylocke attacks, discard Weapons Training → ready each [[WEAPON]] upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/41011.png` (710×1030 px, 302.5 KB)

### [41025] Body Swapped
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Psylocke Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Betsy Braddock player.***
  > You cannot flip your Psi-Katana upgrades.
  > **When Revealed**: Flip each of your [[PSI-ENERGY]] upgrades to its Psi-Katana side and exhaust it.
  > **Alter-Ego Action**: Discard 1 [[PSIONIC]] card from your hand → discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/41025.png` (710×1030 px, 319.1 KB)


### Set: Justice

### [41012] Captain Britain — *Brian Braddock*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 3 [star] (Consequential: 2), **ATK**: 3 [star] (Consequential: 2), **HP**: 3, **Resources**: [mental]
- **Traits**: *Aerial. Excalibur.*
- **Rules Text**:
  > [star] Captain Britain takes -1 consequential damage after he thwarts a side scheme or attacks a minion.
- **Flavor**: *"I'll be your champion, now and forever."*
- **Image Asset**: `assets/card-art/bundles/cards/41012.png` (710×1030 px, 282.9 KB)

### [41013] Cypher — *Doug Ramsey*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *X-Force.*
- **Rules Text**:
  > [star] **Response**: After Cypher attacks and damages a confused enemy, draw 1 card.
- **Flavor**: *"Your body language told me everything I needed to know to beat you."*
- **Image Asset**: `assets/card-art/bundles/cards/41013.png` (710×1030 px, 268.0 KB)

### [41014] Concussive Blow
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Confuse an enemy. If you paid for this card using a [physical] resource, deal 3 damage to that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/41014.png` (710×1030 px, 308.2 KB)

### [41015] Upside the Head
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Response**: After your hero makes a basic attack and damages an enemy, confuse that enemy. If that enemy is already confused, stun it instead.
- **Image Asset**: `assets/card-art/bundles/cards/41015.png` (710×1030 px, 285.5 KB)

### [41016] Lay the Trap
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Justice
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 3 per hero, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: The player who defeated this scheme deals 5 [per_hero] damage to the villain.
- **Flavor**: *"You go low, I'll go high."
"I always go low."
"Fine, go high."
"I like going low."
 —Wolverine and Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/41016.png` (1030×710 px, 265.5 KB)

### [41017] Float Like a Butterfly
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control.
  > Max 1 per player.
  > **Interrupt**: When a character you control attacks a confused enemy, increase the amount of damage that attack deals to that enemy by 1.
- **Image Asset**: `assets/card-art/bundles/cards/41017.png` (710×1030 px, 295.7 KB)


### Set: Basic

### [41018] Pete Wisdom
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 3 (Consequential: 2), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *X-Force.*
- **Rules Text**:
  > Play only if your identity has the [[X-FORCE]] trait.
  > **Response**: After you resolve the "**When Revealed**" effects of a treachery card, heal 1 damage from Pete Wisdom.
- **Image Asset**: `assets/card-art/bundles/cards/41018.png` (710×1030 px, 359.3 KB)

### [41019] Directed Force
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When your hero makes an attack that has a keyword *(overkill, piercing, or ranged)*, that attack deals 2 additional damage. (Max 1 per attack.)
- **Image Asset**: `assets/card-art/bundles/cards/41019.png` (710×1030 px, 307.0 KB)

### [41020] Soaring Hearts
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Aerial. Psionic.*
- **Rules Text**:
  > Team-Up (Angel and Psylocke). Max 1 per deck.
  > **Hero Action**: Search your discard pile for an identity-specific event and add it to your hand. Ready Angel and Psylocke.
- **Image Asset**: `assets/card-art/bundles/cards/41020.png` (710×1030 px, 314.4 KB)

### [41021] The Power of the Mind
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [mental]
- **Rules Text**:
  > Double the number of resources this card generates while paying for a [[PSIONIC]] card.
- **Image Asset**: `assets/card-art/bundles/cards/41021.png` (900×1254 px, 170.4 KB)

### [41022] IPAC
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Vehicle. X-Force.*
- **Rules Text**:
  > Play only if your identity has the [[X-FORCE]] trait.
  > **Hero Action**: Exhaust IPAC and deal 1 facedown encounter card to a player → that player draws 2 cards.
- **Image Asset**: `assets/card-art/bundles/cards/41022.png` (710×1030 px, 283.2 KB)

### [41023] X-Bunker
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Location. X-Force.*
- **Rules Text**:
  > **Action**: Exhaust X-Bunker and choose a player whose identity has the [[MUTANT]] trait → that player searches the top X cards of their deck for any card, where X is the number of side schemes in the victory display, and adds that card to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/41023.png` (710×1030 px, 396.3 KB)

### [41024] Telepathy
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Psionic. Superpower.*
- **Rules Text**:
  > Play only if your identity has the [[PSIONIC]] trait. Max 1 per player.
  > **Hero Action** *(thwart)*: Exhaust Telepathy and spend [mental][mental] resources → remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/41024.png` (710×1030 px, 332.8 KB)

### [41033] Telekinesis
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Psionic. Superpower.*
- **Rules Text**:
  > Play only if your hero has the [[PSIONIC]] trait. Max 1 per player.
  > **Hero Action** *(attack)*: Exhaust Telekinesis and spend [mental][mental] resources → deal 3 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/41033.png` (710×1030 px, 312.0 KB)


### Set: Psylocke Nemesis

### [41026] Chimera
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Psylocke Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Psionic.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Chimera activates against you, she gets +X SCH and +X ATK for this activation. X is the number of [mental] resources on cards you control.
- **Image Asset**: `assets/card-art/bundles/cards/41026.png` (710×1030 px, 313.0 KB)

### [41027] Interdimensional Plunder
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke Nemesis (2/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Psylocke Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place 1 threat here for each upgrade in play.
- **Flavor**: *"Of all the dimensions I've pillaged, this is one of the nicer ones." —Chimera*
- **Image Asset**: `assets/card-art/bundles/cards/41027.png` (1030×710 px, 327.9 KB)

### [41028] Psionic Illusion
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Psylocke Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Interrupt**: When you attack an enemy, name a resource type, then discard the top card of your deck. If that card does not have a resource of the named type, change the target of this attack to a friendly character of your choice and discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/41028.png` (710×1030 px, 315.1 KB)

### [41029] Telekinetic Dragon
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Psylocke Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Psylocke Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Take X indirect damage, where X is the number of [mental] resources on cards you control. If X is 0, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Choose to either spend a [mental] resource or confuse your identity.
- **Image Asset**: `assets/card-art/bundles/cards/41029.png` (710×1030 px, 314.5 KB)


### Set: Aggression

### [41030] Psi-Bow Attack
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Psionic.*
- **Rules Text**:
  > Play only if your hero has the [[PSIONIC]] trait.
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. This attack gains ranged.
- **Image Asset**: `assets/card-art/bundles/cards/41030.png` (710×1030 px, 297.1 KB)


### Set: Leadership

### [41031] Domino — *Neena Thurman*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 31
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Posse. X-Force.*
- **Rules Text**:
  > [star] **Response**: After you use one of Domino's basic powers, swap a card in your hand with the top card of your deck.
- **Flavor**: *"Do you feel lucky, punk?"*
- **Image Asset**: `assets/card-art/bundles/cards/41031.png` (710×1030 px, 301.3 KB)


### Set: Protection

### [41032] Psi-Flail Strike
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Psylocke (`psylocke`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Psionic.*
- **Rules Text**:
  > Play only if your hero has the [[PSIONIC]] trait.
  > **Hero Response** *(attack)*: After you defend against an enemy attack, deal 3 damage to that enemy and stun it.
- **Image Asset**: `assets/card-art/bundles/cards/41032.png` (710×1030 px, 318.3 KB)


