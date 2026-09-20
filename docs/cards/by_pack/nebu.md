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
| `22001a` | Nebula | Hero | Nebula | THW:2 ATK:2 DEF:2 HP:9 | - | `nebu` |
| `22001b` | Nebula | Alter-Ego | Nebula | HP:9 | - | `nebu` |
| `22002` | Gamora | Ally | Nebula | THW:2 ATK:2 HP:3 | - | `nebu` |
| `22003` | Nebula's Ship | Support | Nebula | - | - | `nebu` |
| `22004` | Cutthroat Ambition | Upgrade | Nebula | - | - | `nebu` |
| `22005` | Evasive Maneuvering | Upgrade | Nebula | - | - | `nebu` |
| `22006` | Unyielding Persistence | Upgrade | Nebula | - | - | `nebu` |
| `22007` | Weapons Master | Upgrade | Nebula | - | - | `nebu` |
| `22008` | Wide Stance | Upgrade | Nebula | - | - | `nebu` |
| `22009` | Combat Ready | Event | Nebula | - | - | `nebu` |
| `22010` | Lethal Intent | Event | Nebula | - | - | `nebu` |
| `22011` | Eros | Ally | Pack Position: 11 | THW:2 ATK:1 HP:2 | - | `nebu` |
| `22012` | Wraith | Ally | Pack Position: 12 | THW:1 ATK:3 HP:3 | - | `nebu` |
| `22013` | Venom | Ally | Pack Position: 13 | THW:2 ATK:3 HP:4 | - | `nebu` |
| `22014` | Justice Served | Upgrade | Pack Position: 14 | - | - | `nebu` |
| `22015` | One Way or Another | Event | Pack Position: 15 | - | - | `nebu` |
| `22016` | Determination | Resource | Pack Position: 16 | - | - | `nebu` |
| `22017` | The Power of Justice | Resource | Pack Position: 17 | - | - | `nebu` |
| `22018` | Brains Over Brawn | Event | Pack Position: 18 | - | - | `nebu` |
| `22019` | Heroic Intuition | Upgrade | Pack Position: 19 | - | - | `nebu` |
| `22020` | Cosmo | Ally | Pack Position: 20 | THW:1 ATK:1 HP:2 | - | `nebu` |
| `22021` | Knowhere | Support | Pack Position: 21 | - | - | `nebu` |
| `22022` | Daughters of Thanos | Event | Pack Position: 22 | - | - | `nebu` |
| `22023` | First Aid | Event | Pack Position: 23 | - | - | `nebu` |
| `22024` | Energy | Resource | Pack Position: 24 | - | - | `nebu` |
| `22025` | Genius | Resource | Pack Position: 25 | - | - | `nebu` |
| `22026` | Strength | Resource | Pack Position: 26 | - | - | `nebu` |
| `22027` | Inferiority Complex | Obligation | Nebula | - | 2 pips | `nebu` |
| `22028` | Gamora | Minion | Nebula Nemesis | SCH:2 ATK:2 HP:6 | 3 pips | `nebu` |
| `22029` | Self-Preservation | Side Scheme | Nebula Nemesis | - | 2 pips | `nebu` |
| `22030` | Lethal Weapon | Attachment | Nebula Nemesis | - | 2 pips | `nebu` |
| `22031` | Old Rivals | Treachery | Nebula Nemesis | - | 1 pips | `nebu` |
| `22032` | Energy Spear | Upgrade | Pack Position: 32 | - | - | `nebu` |
| `22033` | Guardians of the Galaxy | Support | Pack Position: 33 | - | - | `nebu` |
| `22034` | Defensive Training | Support | Pack Position: 34 | - | - | `nebu` |
| `22035` | Honorary Guardian | Upgrade | Pack Position: 35 | - | - | `nebu` |

---

## Pack: Nebula (`nebu`)

### Set: Nebula

### [22001a] Nebula
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 9, **Hand Size**: 5
- **Traits**: *Guardian.*
- **Rules Text**:
  > *Combat Protocols* - **Forced Response**: After your turn begins, resolve the "Special" ability on each [[technique]] upgrade you control, then discard each [[technique]] upgrade resolved this way.
- **Image Asset**: `assets/card-art/bundles/cards/22001a.png` (300×418 px, 195.9 KB)
### [22001b] Nebula
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Outlaw.*
- **Rules Text**:
  > *Cybernetic Upgrades* - **Response**: After you play a [[technique]] upgrade, draw 2 cards. (Limit once per round.)
- **Flavor**: *"Thanos built me for one purpose: To kill. In time, he will regret that."*
- **Image Asset**: `assets/card-art/bundles/cards/22001b.png` (300×418 px, 226.4 KB)
### [22002] Gamora
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Response:** After you play Gamora, choose a [[technique]] upgrade you control, then resolve its "Special" ability.
- **Flavor**: *"Thanos trained us both for the same purpose."*
- **Image Asset**: `assets/card-art/bundles/cards/22002.png` (729×1045 px, 169.5 KB)
### [22003] Nebula's Ship
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (2/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Vehicle.*
- **Rules Text**:
  > **Resource**: Exhaust Nebula's Ship → generate a [wild] resource.
- **Flavor**: *"I liked it better when I was the one targeting your ship." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/22003.png` (730×1045 px, 167.5 KB)
### [22004] Cutthroat Ambition
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (3–4/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Technique.*
- **Rules Text**:
  > While Nebula is in hero form, her attacks gain piercing and overkill.
  > **Special** *(thwart)*: Remove 3 threat from a scheme.
- **Flavor**: *"I am every bit the warrior you are!" —Nebula*
- **Image Asset**: `assets/card-art/bundles/cards/22004.png` (729×1044 px, 172.0 KB)
### [22005] Evasive Maneuvering
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (5/15)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Technique.*
- **Rules Text**:
  > While in hero form, Nebula ignores the guard keyword, the patrol keyword, and the crisis icon.
  > **Special** : Choose to either stun or confuse an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/22005.png` (729×1044 px, 184.9 KB)
### [22006] Unyielding Persistence
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (6/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Technique.*
- **Rules Text**:
  > While in hero form, Nebula gets +1 THW, +1 ATK, and gains stalwart.
  > **Special** : Give Nebula a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/22006.png` (728×1044 px, 173.5 KB)
### [22007] Weapons Master
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (7–8/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Technique.*
- **Rules Text**:
  > While in hero form, Nebula gains retaliate 1.
  > **Special** *(attack)*: Deal 4 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/22007.png` (728×1044 px, 168.1 KB)
### [22008] Wide Stance
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (9–10/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Technique.*
- **Rules Text**:
  > While Nebula is in hero form, reduce the amount of damage she takes from each attack by 1.
  > **Special** : Look at the top 3 cards of the encounter deck. Discard 1 and put the others back in any order.
- **Image Asset**: `assets/card-art/bundles/cards/22008.png` (728×1045 px, 176.9 KB)
### [22009] Combat Ready
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (11–12/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Alter-Ego Action**: Choose one:
  > Shuffle up to 2 [[technique]] upgrades from your discard pile into your deck.
  > Discard cards from the top of your deck until you discard a [[technique]] upgrade. Put that upgrade into play, then resolve its "Special" ability.
- **Image Asset**: `assets/card-art/bundles/cards/22009.png` (728×1041 px, 167.2 KB)
### [22010] Lethal Intent
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (13–15/15, Qty: 3)
- **Stats**: **Cost**: -1, **Resources**: [mental]
- **Rules Text**:
  > **Hero Action**: Choose up to X [[technique]] upgrades you control. Resolve each of their "Special" abilities (in the order of your choice).
- **Flavor**: *"The Guardians were wise to fear me, and even smarter to hire me on." —Nebula*
- **Image Asset**: `assets/card-art/bundles/cards/22010.png` (729×1044 px, 177.5 KB)
### [22027] Inferiority Complex
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to Nebula player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust your alter-ego → remove Inferiority Complex from the game.
  > • Choose and discard 2 [[Technique]] upgrades you control. If no upgrade was discarded this way, this card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/22027.png` (728×1041 px, 277.1 KB)

### Set: Justice

### [22011] Eros
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Response:** After you play Eros from your hand, confuse a minion for each [mental] resource you used to pay for him.
- **Flavor**: *"This will not be easy, but we will save this universe...we will guard this galaxy."*
- **Image Asset**: `assets/card-art/bundles/cards/22011.png` (729×1045 px, 169.3 KB)
### [22012] Wraith — *Zak-Del*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 3, **Resources**: [physical]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Hero Interrupt:** When a boost card is turned faceup, exhaust Wraith and deal 1 damage to him → cancel that card's "Boost" effect.
- **Flavor**: *"Do not despair: Destiny makes slaves of us all."*
- **Image Asset**: `assets/card-art/bundles/cards/22012.png` (728×1045 px, 171.1 KB)
### [22013] Venom — *Flash Thompson*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 2), **ATK**: 3 (Consequential: 2), **HP**: 4, **Resources**: [energy]
- **Traits**: *Guardian.*
- **Rules Text**:
  > While there is no threat on the main scheme, reduce all consequential damage Venom takes by 1.
- **Flavor**: *"So much for doing this the easy way."*
- **Image Asset**: `assets/card-art/bundles/cards/22013.png` (728×1045 px, 161.9 KB)
### [22014] Justice Served
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Hero Response**: After you thwart and remove the last threat from a scheme, discard Justice Served → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/22014.png` (729×1045 px, 166.6 KB)
### [22015] One Way or Another
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > Max 1 per round.
  > **Hero Action**: Search the encounter deck for a side scheme. Reveal that side scheme → draw 3 cards (shuffle the encounter deck).
- **Image Asset**: `assets/card-art/bundles/cards/22015.png` (729×1044 px, 176.9 KB)
### [22016] Determination
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, remove 1 threat from the main scheme.
### [22017] The Power of Justice
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Justice *(yellow)* card.
### [22018] Brains Over Brawn
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Response** *(attack)*: After your hero makes a basic thwart, deal damage to an enemy equal to your hero's THW.
- **Flavor**: *Despite his incredible strength, Spider-Man often triumphs by outwitting his foes.*
- **Image Asset**: `assets/card-art/bundles/cards/22018.png` (728×1045 px, 176.1 KB)
### [22019] Heroic Intuition
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 THW.

### Set: Basic

### [22020] Cosmo
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Interrupt**: When Cosmo attacks or thwarts, name a card type, then discard the top card of a player deck or the encounter deck. If that card is of the named type, Cosmo does not take consequential damage for this use.
### [22021] Knowhere
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait.
  > Increase your ally limit by 1.
  > **Response**: After a player plays a [[guardian]] ally, exhaust Knowhere → that player draws 1 card.
### [22022] Daughters of Thanos
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Rules Text**:
  > Team-Up (Gamora and Nebula). Max 1 per deck.
  > **Hero Action**: Draw 3 cards.
- **Flavor**: *"Thanos pitted us against each other as children, but now we are sisters. United at last." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/22022.png` (727×1045 px, 150.7 KB)
### [22023] First Aid
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Heal 2 damage from any character.
- **Flavor**: *"Does it still qualify as first aid if it's your second day in the hospital?" —Clint Barton*
### [22024] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [22025] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [22026] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [22035] Honorary Guardian
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 35
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Title.*
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait.
  > Attach to a friendly character. Max 1 per character.
  > Attached character gets +1 hit point and gains the [[guardian]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/22035.png` (727×1046 px, 194.1 KB)

### Set: Nebula Nemesis

### [22028] Gamora
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nebula Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Outlaw.*
- **Rules Text**:
  > **Forced Interrupt**: When this minion would enter play, discard the Gamora ally from play.
  > [star] **Forced Response**: After Gamora attacks and damages you, choose and discard an upgrade you control.
  > *(Nebula's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/22028.png` (729×1045 px, 179.4 KB)
### [22029] Self-Preservation
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nebula Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Nebula gets -1 THW, -1 ATK, and -1 DEF.
  > Gamora gets +1 ATK and her attacks gain piercing.
- **Flavor**: *"We both did what we had to in order to survive. Why won't you let it go?" —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/22029.png` (1042×728 px, 171.8 KB)
### [22030] Lethal Weapon
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nebula Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Gamora. If you cannot, attach to the villain.
  > **Hero Action:** Discard an upgrade you control → discard this attachment.
- **Flavor**: *"There's only one 'Most Dangerous Woman in the Galaxy', and that's me!" —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/22030.png` (718×1036 px, 173.6 KB)
### [22031] Old Rivals
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Nebula Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nebula Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Gamora attacks you. If the Gamora hero or ally is in play, she attacks you *(resolve her ATK against you without exhausting her)*. If no attack was made this way, this card gains surge.
- **Flavor**: *"This was a mistake." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/22031.png` (735×1044 px, 157.8 KB)

### Set: Aggression

### [22032] Energy Spear
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to a [[guardian]] ally. Max 1 per ally.
  > Attached ally gets +2 ATK and gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/22032.png` (728×1044 px, 177.1 KB)

### Set: Leadership

### [22033] Guardians of the Galaxy
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Team.*
- **Rules Text**:
  > Play under any player's control. Max 1 [[team]] card per player.
  > If each of your characters has the [[guardian]] trait, this card gains: "**Response**: After you play an upgrade on an ally, draw 1 card."
- **Image Asset**: `assets/card-art/bundles/cards/22033.png` (729×1045 px, 181.6 KB)

### Set: Protection

### [22034] Defensive Training
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Nebula (`nebu`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Max 2 per deck. Uses (2 training counters).
  > **Alter-Ego Action**: Exhaust this card and remove 1 training counter from this → choose a Protection (green) event in your discard pile and shuffle it into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/22034.png` (728×1045 px, 204.7 KB)

