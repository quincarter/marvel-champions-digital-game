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
| `49001a` | Magneto | Hero | Magneto | THW:2 ATK:2 DEF:2 HP:10 | - | `magneto` |
| `49001b` | Erik Lehnsherr | Alter-Ego | Magneto | HP:10 | - | `magneto` |
| `49002` | Asteroid M | Support | Magneto | - | - | `magneto` |
| `49003` | Magneto's Helmet | Upgrade | Magneto | - | - | `magneto` |
| `49004` | Magneto's Armor | Upgrade | Magneto | - | - | `magneto` |
| `49005` | Magneto's Cape | Upgrade | Magneto | - | - | `magneto` |
| `49006` | Magnetic Bubble | Upgrade | Magneto | - | - | `magneto` |
| `49007` | Wrapped in Metal | Upgrade | Magneto | - | - | `magneto` |
| `49008` | Electromagnetic Blast | Event | Magneto | - | - | `magneto` |
| `49009` | Metal Shards | Event | Magneto | - | - | `magneto` |
| `49010` | Magnetic Missile | Event | Magneto | - | - | `magneto` |
| `49011` | Master of Magnetism | Resource | Magneto | - | - | `magneto` |
| `49012` | M | Ally | Pack Position: 12 | THW:2 ATK:3 HP:4 | - | `magneto` |
| `49013` | Kid Omega | Ally | Pack Position: 13 | THW:2 ATK:2 HP:2 | - | `magneto` |
| `49014` | Phoenix | Ally | Pack Position: 14 | THW:2 ATK:1 HP:3 | - | `magneto` |
| `49015` | Cyclops | Ally | Pack Position: 15 | THW:2 ATK:2 HP:2 | - | `magneto` |
| `49016` | Won't Stay Down | Support | Pack Position: 16 | - | - | `magneto` |
| `49017` | Squared Off | Event | Pack Position: 17 | - | - | `magneto` |
| `49018` | Noble Sacrifice | Event | Pack Position: 18 | - | - | `magneto` |
| `49019` | "You Got This!" | Event | Pack Position: 19 | - | - | `magneto` |
| `49020` | New Recruits | Player Side Scheme | Pack Position: 20 | - | - | `magneto` |
| `49021` | White Queen | Ally | Pack Position: 21 | THW:2 ATK:1 HP:3 | - | `magneto` |
| `49022` | Face the Past | Event | Pack Position: 22 | - | - | `magneto` |
| `49023` | Deft Focus | Upgrade | Pack Position: 23 | - | - | `magneto` |
| `49024` | Energy | Resource | Pack Position: 24 | - | - | `magneto` |
| `49025` | Genius | Resource | Pack Position: 25 | - | - | `magneto` |
| `49026` | Strength | Resource | Pack Position: 26 | - | - | `magneto` |
| `49027` | Old Grievances | Obligation | Magneto | - | 2 pips | `magneto` |
| `49028` | Exodus | Minion | Magneto Nemesis | SCH:2 ATK:2 HP:6 | 3 pips | `magneto` |
| `49029` | Martyr for Mutants | Side Scheme | Magneto Nemesis | - | 3 pips | `magneto` |
| `49030` | Fabian Cortez | Minion | Magneto Nemesis | SCH:2 ATK:2 HP:4 | Star | `magneto` |
| `49031` | Frenzy | Minion | Magneto Nemesis | SCH:2 ATK:2 HP:4 | Star | `magneto` |
| `49032` | Angry Acolyte | Treachery | Magneto Nemesis | - | 2 pips | `magneto` |
| `49033` | Surge | Ally | Pack Position: 33 | THW:2 ATK:2 HP:2 | - | `magneto` |
| `49034` | Anole | Ally | Pack Position: 34 | THW:2 ATK:2 HP:2 | - | `magneto` |
| `49035` | Bling! | Ally | Pack Position: 35 | THW:2 ATK:2 HP:2 | - | `magneto` |
| `49036` | Indra | Ally | Pack Position: 36 | THW:2 ATK:2 HP:2 | - | `magneto` |
| `49037` | Children of the Atom | Support | Pack Position: 37 | - | - | `magneto` |
| `49038` | Sebastian Shaw | Minion | Hellfire | SCH:1 ATK:2 HP:5 | 3 pips | `magneto` |
| `49039` | Selene | Minion | Hellfire | SCH:1 ATK:1 HP:4 | Star | `magneto` |
| `49040` | Hellfire Pawn | Minion | Hellfire | SCH:1 ATK:2 HP:3 | Star | `magneto` |
| `49041` | The Inner Circle | Side Scheme | Hellfire | - | 2 pips | `magneto` |
| `49042` | Power and Decadence | Treachery | Hellfire | - | Star | `magneto` |

---

## Pack: Magneto (`magneto`)

### Set: Magneto

### [49001a] Magneto
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *X-Men.*
- **Rules Text**:
  > *Magnetic Pull* — **Action**: Discard cards from the top of your deck until a [[Magnetic]] card is discarded → add that card to your hand. (Limit once per round.)
- **Flavor**: *"I do not need to defend my decisions."*
- **Image Asset**: `assets/card-art/bundles/cards/49001a.png` (300×426 px, 201.1 KB)
### [49001b] Erik Lehnsherr
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > *Survivor* — **Response**: After you change to this form, shuffle the top 3 cards of your discard pile into your deck.
- **Flavor**: *"All that I've endured, and everything I've done, it was all to preserve mutantkind."*
- **Image Asset**: `assets/card-art/bundles/cards/49001b.png` (300×426 px, 197.1 KB)
### [49002] Asteroid M
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Location. Magnetic.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Asteroid M → shuffle the topmost [[Magnetic]] card in your discard pile into your deck and heal 1 damage from your identity.
- **Flavor**: *"It took considerable effort to rebuild my home. Let's not destroy it again." —Magneto*
- **Image Asset**: `assets/card-art/bundles/cards/49002.png` (710×1030 px, 337.5 KB)
### [49003] Magneto's Helmet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Armor. Magnetic.*
- **Rules Text**:
  > Magneto gains steady.
  > **Resource**: Exhaust Magneto's Helmet → generate a [wild] resource for a [[Magnetic]] card.
- **Flavor**: *Magneto's helmet protects him from telepathic attacks.*
- **Image Asset**: `assets/card-art/bundles/cards/49003.jpg` (710×1030 px, 268.2 KB)
### [49004] Magneto's Armor
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Armor. Magnetic.*
- **Rules Text**:
  > **Response**: After you resolve your *"Magnetic Pull"* ability, if you discarded at least 1 of the following resource icons:
  > [mental] — Magneto gets +1 THW this round.
  > [physical] — Magneto gets +1 ATK this round.
  > [energy] — Magneto gets +1 DEF this round.
- **Image Asset**: `assets/card-art/bundles/cards/49004.png` (710×1030 px, 394.5 KB)
### [49005] Magneto's Cape
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (4/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Armor. Magnetic.*
- **Rules Text**:
  > Magneto gains the [[Aerial]] trait.
  > **Response**: After you resolve your *"Magnetic Pull"* ability, exhaust Magneto's Cape → ready Magneto.
- **Image Asset**: `assets/card-art/bundles/cards/49005.jpg` (710×1030 px, 340.6 KB)
### [49006] Magnetic Bubble
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (5/15)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Magnetic. Superpower.*
- **Rules Text**:
  > Magneto gains retaliate 1.
  > **Forced Interrupt**: When you would take any amount of damage, place it here. Then, if there is at least 6 damage here, discard Magnetic Bubble.
- **Image Asset**: `assets/card-art/bundles/cards/49006.jpg` (710×1030 px, 369.4 KB)
### [49007] Wrapped in Metal
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (6–7/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Magnetic.*
- **Rules Text**:
  > Hero form only. Attach to a non-[[ELITE]] minion.
  > Attached minion cannot activate. Treat its printed text box as if it were blank.
- **Flavor**: *"Your power is no match for the Master of Magnetism!"—Magneto*
- **Image Asset**: `assets/card-art/bundles/cards/49007.png` (710×1030 px, 353.1 KB)
### [49008] Electromagnetic Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (8–9/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Magnetic. Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. If this removes the last threat from that scheme, you may discard an attachment with the text **"Hero Action"** or **"Hero Response."**
- **Image Asset**: `assets/card-art/bundles/cards/49008.png` (710×1030 px, 359.7 KB)
### [49009] Metal Shards
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (10–11/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack. Magnetic. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 7 damage to an enemy. If this attack defeats that enemy, gain a tough status card.
- **Flavor**: *"The way to defend mutants is to defeat our enemies." —Magneto*
- **Image Asset**: `assets/card-art/bundles/cards/49009.jpg` (710×1030 px, 358.9 KB)
### [49010] Magnetic Missile
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (12–13/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Magnetic. Superpower.*
- **Rules Text**:
  > **Hero Action**: Discard a minion with Wrapped in Metal attached → deal 5 damage to an enemy and stun it.
- **Flavor**: *"I have heard your threats, and here is my reply."—Magneto*
- **Image Asset**: `assets/card-art/bundles/cards/49010.png` (710×1030 px, 358.2 KB)
### [49011] Master of Magnetism
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (14–15/15, Qty: 2)
- **Stats**: **Resources**: [energy] [mental]
- **Traits**: *Magnetic.*
- **Flavor**: *Magneto's power renders conventional firearms useless against him.*
- **Image Asset**: `assets/card-art/bundles/cards/49011.jpg` (710×1030 px, 354.1 KB)
### [49027] Old Grievances
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Erik Lehnsherr player.***
  > **Forced Response**: After you use your *"Magnetic Pull"* ability, take 1 damage for each card discarded by it.
  > **Alter-Ego Action**: Exhaust Erik Lehnsherr → discard Old Grievances.
- **Image Asset**: `assets/card-art/bundles/cards/49027.jpg` (710×1030 px, 355.8 KB)

### Set: Leadership

### [49012] M — *Monet St. Croix*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 4, **Resources**: [physical]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > **Response**: After M enters play, defeat a minion with fewer remaining hit points than M.
- **Flavor**: *"I don't mind being a bull in a china shop."*
- **Image Asset**: `assets/card-art/bundles/cards/49012.jpg` (710×1030 px, 272.2 KB)
### [49013] Kid Omega — *Quentin Quire*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > **Response**: After Kid Omega enters play, choose:
  > • Spend a [energy] resource → deal 1 damage to each enemy.
  > • Spend a [mental] resource → remove 1 threat from each scheme.
- **Image Asset**: `assets/card-art/bundles/cards/49013.png` (710×1030 px, 329.6 KB)
### [49014] Phoenix — *Jean Grey*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > **Response**: After Phoenix enters play, choose an [[X-Men]] ally → ready that ally and heal 1 damage from it.
- **Flavor**: *"Joining the X-Men means joining a family. It means you're never truly alone."*
- **Image Asset**: `assets/card-art/bundles/cards/49014.jpg` (710×1030 px, 356.6 KB)
### [49015] Cyclops — *Scott Summers*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Cyclops enters play, choose an enemy. Until the end of the phase, increase the amount of damage that enemy takes from each attack by 1.
- **Flavor**: *"To me, my X-Men!"*
- **Image Asset**: `assets/card-art/bundles/cards/49015.png` (710×1030 px, 324.4 KB)
### [49016] Won't Stay Down
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play only if your identity has the [[X-Force]] or [[X-Men]] trait. Max 1 per player.
  > **Alter-Ego Action**: Discard this card → return an [[X-Force]] or [[X-Men]] ally from your discard pile to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/49016.png` (710×1030 px, 353.4 KB)
### [49017] Squared Off
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Discard cards from the encounter deck until you discard a minion. Put that minion into play engaged with you → play an ally from your hand, reducing its cost by 3.
- **Flavor**: *"Let's do this." —M*
- **Image Asset**: `assets/card-art/bundles/cards/49017.jpg` (710×1030 px, 360.3 KB)
### [49018] Noble Sacrifice
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Discard an ally you control → heal damage from your hero equal to that ally's printed hit points and give your hero a tough status card.
- **Flavor**: *"Don't wait for me. Go!" —X-23*
- **Image Asset**: `assets/card-art/bundles/cards/49018.jpg` (710×1030 px, 364.2 KB)
### [49019] "You Got This!"
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Response**: After you exhaust your hero to make a basic thwart or attack, discard an ally you control → add that ally's matching power to your hero's power for this use. Ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/49019.png` (710×1030 px, 295.8 KB)
### [49020] New Recruits
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Leadership
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 2 per hero, **Resources**: [mental]
- **Rules Text**:
  > Victory 0.
  > Play only if your identity has the [[X-Men]] trait.
  > **When Defeated**: Each player chooses 1 set-aside [[New]] ally and adds it to their hand.
- **Flavor**: *The dream of every student at Xavier's school is to join the X-Men.*
- **Image Asset**: `assets/card-art/bundles/cards/49020.png` (1030×710 px, 342.3 KB)

### Set: Basic

### [49021] White Queen — *Emma Frost*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > Play only if your identity has the [[X-Force]] or [[X-Men]] trait.
  > **Response**: After White Queen enters play, discard a status card from a character.
- **Flavor**: *"Oh darling, I hardly need psionic powers to manipulate you."*
- **Image Asset**: `assets/card-art/bundles/cards/49021.jpg` (710×1030 px, 364.7 KB)
### [49022] Face the Past
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Action**: Search the encounter deck, discard pile, and set-aside area for your nemesis minion and reveal it → ready your hero and draw 3 cards. You cannot attack the villain this phase. Remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/49022.jpg` (710×1030 px, 335.8 KB)
### [49023] Deft Focus
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Action**: Exhaust Deft Focus → reduce the resource cost of the next [[superpower]] card you play this turn by 1.
- **Image Asset**: `assets/card-art/bundles/cards/49023.png` (710×1030 px, 303.6 KB)
### [49024] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [49025] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [49026] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [49033] Surge — *Noriko Ashida*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 33
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *New. X-Men.*
- **Rules Text**:
  > Linked (New Recruits).
  > If you have the [[Mutant]] or [[X-Men]] trait, Surge gets +1 ATK and does not count against your ally limit.
- **Flavor**: *"Touch my friends and you get 10,000 volts!"*
- **Image Asset**: `assets/card-art/bundles/cards/49033.jpg` (710×1030 px, 316.8 KB)
### [49034] Anole — *Victor Borkowski*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 34
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *New. X-Men.*
- **Rules Text**:
  > Linked (New Recruits).
  > If you have the [[Mutant]] or [[X-Men]] trait, Anole gets +1 THW and does not count against your ally limit.
- **Flavor**: *"It's hard to be a kid when you look like a monster."*
- **Image Asset**: `assets/card-art/bundles/cards/49034.png` (710×1030 px, 313.1 KB)
### [49035] Bling! — *Roxanne Washington*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 35
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *New. X-Men.*
- **Rules Text**:
  > Linked (New Recruits).
  > If you have the [[Mutant]] or [[X-Men]] trait, Bling! gains toughness and does not count against your ally limit.
- **Flavor**: *"This school sucks!"*
- **Image Asset**: `assets/card-art/bundles/cards/49035.jpg` (710×1030 px, 367.7 KB)
### [49036] Indra — *Paras Gavaskar*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 36
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *New. X-Men.*
- **Rules Text**:
  > Linked (New Recruits).
  > If you have the [[Mutant]] or [[X-Men]] trait, Indra gets +2 hit points and does not count against your ally limit.
- **Flavor**: *"I have seen atrocities done to mutants. No more!"*
- **Image Asset**: `assets/card-art/bundles/cards/49036.jpg` (710×1030 px, 349.0 KB)
### [49037] Children of the Atom
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Pack Position: 37
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Each [[X-Factor]], [[X-Force]], and [[X-Men]] character you control gains the [[X-Factor]], [[X-Force]], and [[X-Men]] traits.
- **Image Asset**: `assets/card-art/bundles/cards/49037.png` (710×1030 px, 377.8 KB)

### Set: Magneto Nemesis

### [49028] Exodus
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Acolyte. Elite. Psionic.*
- **Rules Text**:
  > Steady. Toughness. Villainous.
  > [star] **Forced Response**: After Exodus attacks you, discard cards from the top of your deck equal to his total ATK.
  > *(Magneto's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/49028.jpg` (710×1030 px, 371.0 KB)
### [49029] Martyr for Mutants
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto Nemesis (2/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Defeated**: The defeating player discards the top 9 cards of their deck.
- **Flavor**: *Magneto's former Acolytes felt betrayed by their leader's change of heart about mutant and human coexistence.*
- **Image Asset**: `assets/card-art/bundles/cards/49029.png` (1030×710 px, 372.1 KB)
### [49030] Fabian Cortez
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto Nemesis (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Magneto Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Acolyte.*
- **Rules Text**:
  > Guard.
  > **When Defeated**: The defeating player discards the top 4 cards of their deck.
  >
  > ---
  >
  > [star] **Boost**: Discard the top 4 cards of your deck.
- **Image Asset**: `assets/card-art/bundles/cards/49030.jpg` (710×1030 px, 347.9 KB)
### [49031] Frenzy
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto Nemesis (4/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Magneto Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Acolyte.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After Frenzy attacks you, discard the top 2 cards of your deck.
  >
  > ---
  >
  > [star] **Boost**: Discard the top 4 cards of your deck.
- **Image Asset**: `assets/card-art/bundles/cards/49031.png` (710×1030 px, 290.6 KB)
### [49032] Angry Acolyte
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Magneto Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[Acolyte]] minion engaged with a player activates against that player. If no minion activates this way, discard cards from the top of the encounter deck until an [[Acolyte]] minion is discarded. Reveal that minion.
- **Image Asset**: `assets/card-art/bundles/cards/49032.png` (710×1030 px, 309.3 KB)

### Set: Hellfire

### [49038] Sebastian Shaw
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Hellfire (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hellfire Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hellfire.*
- **Rules Text**:
  > Toughness. Villainous.
  > **Forced Response**: After Sebastian Shaw is attacked, give him a facedown boost card. He cannot be attacked again this phase.
- **Flavor**: *"Never raise a hand to your betters, serf!"*
- **Image Asset**: `assets/card-art/bundles/cards/49038.png` (710×1030 px, 332.8 KB)
### [49039] Selene
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Hellfire (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hellfire Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hellfire.*
- **Rules Text**:
  > Quickstrike. Villainous.
  > Allies cannot attack Selene
  >
  > ---
  >
  > [star] **Boost**: Discard an ally you control.
- **Flavor**: *"Foolish child! Countless thousands have gone to the fire in my name."*
- **Image Asset**: `assets/card-art/bundles/cards/49039.jpg` (710×1030 px, 308.5 KB)
### [49040] Hellfire Pawn
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Hellfire (3/5)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hellfire Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hellfire.*
- **Rules Text**:
  > Guard. Patrol. Surge.
  > *(While a minion with the patrol keyword is engaged with you, you cannot thwart the main scheme.)*
  >
  > ---
  >
  > [star] **Boost**: Put Hellfire Pawn into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/49040.png` (710×1030 px, 276.0 KB)
### [49041] The Inner Circle
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Hellfire (4/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hellfire Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Place 2 additional threat here for each [[Hellfire]] card in play.
- **Flavor**: *The inner circle of the Hellfire Club uses its wealth and power to plot the course of mutant affairs in secret.*
- **Image Asset**: `assets/card-art/bundles/cards/49041.jpg` (1030×710 px, 292.0 KB)
### [49042] Power and Decadence
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Magneto (`magneto`)
- **Deck / Set**: Hellfire (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hellfire Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give the villain a tough status card. Give this card to that villain as a facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: After this activation, the activating enemy activates against you again. Do not give it a boost card for that activation.
- **Image Asset**: `assets/card-art/bundles/cards/49042.jpg` (710×1030 px, 301.4 KB)

