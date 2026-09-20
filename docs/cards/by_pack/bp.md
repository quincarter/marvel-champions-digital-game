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
| `51001a` | Black Panther | Hero | Black Panther | THW:2 ATK:1 DEF:2 HP:11 | - | `bp` |
| `51001b` | Shuri | Alter-Ego | Black Panther | HP:11 | - | `bp` |
| `51002` | T'Challa | Ally | Black Panther | THW:2 ATK:2 HP:3 | - | `bp` |
| `51003` | Clawed Strike | Event | Black Panther | - | - | `bp` |
| `51004` | On the Prowl | Event | Black Panther | - | - | `bp` |
| `51005` | Wakanda Forever! | Event | Black Panther | - | - | `bp` |
| `51006` | Vibranium | Resource | Black Panther | - | - | `bp` |
| `51007` | The Elephant's Trunk | Support | Black Panther | - | - | `bp` |
| `51008` | Queen Ramonda | Support | Black Panther | - | - | `bp` |
| `51009` | Aja-Adanna | Upgrade | Black Panther | - | - | `bp` |
| `51010` | Kimoyo Beads | Upgrade | Black Panther | - | - | `bp` |
| `51011` | Panther Claws | Upgrade | Black Panther | - | - | `bp` |
| `51012` | Spider Bites | Upgrade | Black Panther | - | - | `bp` |
| `51013` | Vibranium Suit | Upgrade | Black Panther | - | - | `bp` |
| `51014` | Manifold | Ally | Pack Position: 14 | THW:2 ATK:1 HP:2 | - | `bp` |
| `51015` | Infiltration | Event | Pack Position: 15 | - | - | `bp` |
| `51016` | Going Undercover | Player Side Scheme | Pack Position: 16 | - | - | `bp` |
| `51017` | Show of Empathy | Player Side Scheme | Pack Position: 17 | - | - | `bp` |
| `51018` | The Raft | Support | Pack Position: 18 | - | - | `bp` |
| `51019` | Invisibility Gear | Upgrade | Pack Position: 19 | - | - | `bp` |
| `51020` | Sonic Rifle | Upgrade | Pack Position: 20 | - | - | `bp` |
| `51021` | Sting Operation | Upgrade | Pack Position: 21 | - | - | `bp` |
| `51022` | Aneka | Ally | Pack Position: 22 | THW:1 ATK:2 HP:3 | - | `bp` |
| `51023` | Ayo | Ally | Pack Position: 23 | THW:1 ATK:2 HP:3 | - | `bp` |
| `51024` | Okoye | Ally | Pack Position: 24 | THW:2 ATK:2 HP:3 | - | `bp` |
| `51025` | Heart of the Panther | Event | Pack Position: 25 | - | - | `bp` |
| `51026` | Build Support | Player Side Scheme | Pack Position: 26 | - | - | `bp` |
| `51027` | Energy | Resource | Pack Position: 27 | - | - | `bp` |
| `51028` | Genius | Resource | Pack Position: 28 | - | - | `bp` |
| `51029` | Strength | Resource | Pack Position: 29 | - | - | `bp` |
| `51030` | Dora Milaje | Support | Pack Position: 30 | - | - | `bp` |
| `51031` | T'Challa's Shadow | Obligation | Black Panther | - | 2 pips | `bp` |
| `51032` | Klaw | Minion | Black Panther | SCH:2 ATK:0 HP:6 | 3 pips | `bp` |
| `51033` | Manipulated M.U.S.I.C. | Side Scheme | Black Panther | - | 2 pips | `bp` |
| `51034` | M.U.S.I.C. | Minion | Black Panther | SCH:0 ATK:0 HP:1 | 1 pips | `bp` |
| `51035` | The Scream | Treachery | Black Panther | - | Star | `bp` |
| `51036` | Redemption | Upgrade | Pack Position: 36 | - | - | `bp` |
| `51037` | White Wolf | Ally | Pack Position: 37 | THW:2 ATK:2 HP:3 | - | `bp` |
| `51038` | Target Spotter | Support | Pack Position: 38 | - | - | `bp` |
| `51039` | Joystick | Minion | Extreme Risk | SCH:1 ATK:1 HP:17 | 4 pips | `bp` |
| `51040` | Energy Truncheon | Attachment | Extreme Risk | ATK:1 | 2 pips | `bp` |
| `51041` | Playing for Keeps | Side Scheme | Extreme Risk | - | 2 pips | `bp` |
| `51042` | Extreme Risk | Treachery | Extreme Risk | - | 2 pips | `bp` |

---

## Pack: Black Panther (`bp`)

### Set: Black Panther (Shuri)

### [51001a] Black Panther
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2 [star], **ATK**: 1 [star], **DEF**: 2 [star], **HP**: 11, **Hand Size**: 5
- **Traits**: *Wakanda.*
- **Rules Text**:
  > [star] **Response**: After Black Panther uses a basic power, resolve the "**Special**" ability on 1 [[Black Panther]] upgrade you control.
- **Flavor**: *"I will not rest in the defense of my homeland."*
- **Image Asset**: `assets/card-art/bundles/cards/51001a.png` (300×425 px, 243.9 KB)
### [51001b] Shuri
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 11, **Hand Size**: 6
- **Traits**: *Genius. Wakanda.*
- **Rules Text**:
  > *Inventor* — **Action**: Exhaust Shuri → search your deck for a [[Black Panther]] or [[Tech]] upgrade and play it, reducing its resource cost by 2. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/51001b.png` (300×425 px, 188.3 KB)
### [51002] T'Challa
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Genius. Wakanda.*
- **Rules Text**:
  > [star] **Hero Response**: After T'Challa uses a basic power, resolve the "**Special**" ability on 1 [[Black Panther]] upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/51002.png` (710×1030 px, 343.0 KB)
### [51003] Clawed Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (2–3/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. Resolve the "**Special**" ability on 1 [[Black Panther]] upgrade you control.
- **Flavor**: *"You've face the muscle of Wakanda...now face its claws!" —Black Panther*
- **Image Asset**: `assets/card-art/bundles/cards/51003.jpg` (710×1030 px, 342.2 KB)
### [51004] On the Prowl
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (4–5/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. Resolve the "**Special**" ability on 1 [[Black Panther]] upgrade you control.
- **Flavor**: *"The jungle holds untold dangers." —Black Panther*
- **Image Asset**: `assets/card-art/bundles/cards/51004.png` (710×1030 px, 336.0 KB)
### [51005] Wakanda Forever!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (6/15)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Resolve the "**Special**" ability on each [[Black Panther]] upgrade you control in any order.
- **Flavor**: *"It is more than a battlecry. It is a promise." —Black Panther*
- **Image Asset**: `assets/card-art/bundles/cards/51005.jpg` (710×1030 px, 323.6 KB)
### [51006] Vibranium
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (7–8/15, Qty: 2)
- **Stats**: **Resources**: [wild] [wild]
- **Flavor**: *"Since the time of Bashenga, we've controlled our destiny as few other nations have." —T'Challa*
- **Image Asset**: `assets/card-art/bundles/cards/51006.jpg` (710×1030 px, 391.0 KB)
### [51007] The Elephant's Trunk
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Persona. Wakanda.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust The Elephant's Trunk and up to 2 other [[Wakanda]] allies and/or supports you control → draw 1 card for each card exhausted this way *(including this one)*.
- **Flavor**: *This council seeks answers to Wakanda's problems.*
- **Image Asset**: `assets/card-art/bundles/cards/51007.png` (710×1030 px, 360.8 KB)
### [51008] Queen Ramonda
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Persona. Wakanda.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Queen Ramonda → heal damage from an alter-ego with the [[Wakanda]] trait equal to that alter-ego's REC.
- **Flavor**: *"I have never known you to leave a problem unsolved, my daughter."*
- **Image Asset**: `assets/card-art/bundles/cards/51008.png` (710×1030 px, 319.0 KB)
### [51009] Aja-Adanna
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Exhaust Aja-Adanna → shuffle 1 identity-specific card from your discard pile into your deck.
- **Flavor**: *Shuri is known as the keeper of Wakandan memory.*
- **Image Asset**: `assets/card-art/bundles/cards/51009.jpg` (710×1030 px, 354.0 KB)
### [51010] Kimoyo Beads
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (12/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Black Panther. Tech.*
- **Rules Text**:
  > **Special** *(thwart)*: Remove 1 threat from a scheme. You may discard this card to confuse an enemy.
- **Flavor**: *"I see you." —Black Panther*
- **Image Asset**: `assets/card-art/bundles/cards/51010.png` (710×1030 px, 340.0 KB)
### [51011] Panther Claws
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (13/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Black Panther. Weapon.*
- **Rules Text**:
  > **Special** *(attack)*: Deal 2 damage to an enemy. You may discard this card to deal 3 additional damage to that enemy. If you do, this attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/51011.jpg` (710×1030 px, 351.2 KB)
### [51012] Spider Bites
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (14/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Black Panther. Tech.*
- **Rules Text**:
  > **Special**: Choose a player. Deal 1 damage to the villain and each minion engaged with that player. You may discard this card to stun each of those enemies.
- **Image Asset**: `assets/card-art/bundles/cards/51012.jpg` (710×1030 px, 356.0 KB)
### [51013] Vibranium Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (15/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Armor. Black Panther.*
- **Rules Text**:
  > **Special** *(attack)*: Move 1 damage from your hero to an enemy. You may discard this card to give your hero a tough status card.
- **Flavor**: *"It's a 'mantle,' not a catsuit, than you very much." —Black Panther*
- **Image Asset**: `assets/card-art/bundles/cards/51013.png` (710×1030 px, 332.6 KB)
### [51031] T'Challa's Shadow
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Panther (Shuri) Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Shuri player.***
  > Uses (4 doubt counters). Victory 0.
  > Increase the resource cost of each card you play by 1.
  > **Forced Response**: After you thwart, attack, or defend, remove 1 doubt counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/51031.png` (710×1030 px, 356.6 KB)

### Set: Justice

### [51014] Manifold — *Eden Fesi*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Avenger. Wakanda.*
- **Rules Text**:
  > **Response**: After Manifold enters play, choose a player. That player searches their deck and discard pile for a player side scheme and adds it to their hand.
- **Flavor**: *"I ask the universe to fold itself so that I can travel to any place with a single step."*
- **Image Asset**: `assets/card-art/bundles/cards/51014.jpg` (710×1030 px, 287.6 KB)
### [51015] Infiltration
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Choose a number from 1 to 5. Discard that many cards from the top of the encounter deck → remote 1 threat from a scheme for each card discarded this way. Put 1 minion discarded this way into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/51015.png` (710×1030 px, 318.8 KB)
### [51016] Going Undercover
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Justice
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 4, **Resources**: [physical]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: The defeating player looks at the top 5 cards of the encounter deck. They may add 1 non-scenario-specific card from among those to the victory display, then place the rest on the top and/or bottom of the encounter deck in any order.
- **Image Asset**: `assets/card-art/bundles/cards/51016.png` (1030×710 px, 333.3 KB)
### [51017] Show of Empathy
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Justice
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 6, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > **Forced Interrupt**: When threat is removed from this scheme, place that threat on a non-[[Elite]] minion. If that minion has threat on it equal to or greater than its remaining hit points, add Show of Empathy to the victory display and attach 1 set-aside copy of Redemption to that minion.
- **Image Asset**: `assets/card-art/bundles/cards/51017.jpg` (1030×710 px, 346.6 KB)
### [51018] The Raft
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > **Response**: After a minion leaves play, tuck it under here from the encounter discard pile → remove threat from a scheme equal to the tucked minion's printed SCH. If there are at least 4 minions here, deal 1 random minion here to any player as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/51018.jpg` (710×1030 px, 346.6 KB)
### [51019] Invisibility Gear
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Interrupt**: When an enemy would attack you, discard Invisibility Gear → that enemy schemes instead.
- **Flavor**: *"Now you see me, now you don't." —Phil Coulson*
- **Image Asset**: `assets/card-art/bundles/cards/51019.png` (710×1030 px, 303.3 KB)
### [51020] Sonic Rifle
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted. Uses (2 charge counters).
  > **Hero Action**: Exhaust Sonic Rifle and remove 1 charge counter from it → confuse an enemy (deal 3 damage to that enemy instead if it is already confused).
### [51021] Sting Operation
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Preparation. Tactic.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After a non-[[Elite]] minion schemes, discard Sting Operation → discard that minion.
- **Flavor**: *"And I would have gotten way with it, too!" —Mister Rasputin*
- **Image Asset**: `assets/card-art/bundles/cards/51021.jpg` (710×1030 px, 355.2 KB)
### [51036] Redemption
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 36
- **Stats**: **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Linked (Show of Empathy). Victory 0.
  > Take control of attached minion and treat it as a [[Redeemed]] ally with a blank text box. Its THW is equal to its printed SCH and it takes 1 consequential damage after it thwarts or attacks.
- **Image Asset**: `assets/card-art/bundles/cards/51036.jpg` (710×1030 px, 355.4 KB)

### Set: Basic

### [51022] Aneka
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Dora Milaje. Wakanda.*
- **Rules Text**:
  > [star] **Response**: After Aneka uses a basic power, resolve the "**Special**" ability on another [[Dora Milaje]] ally.
  > **Special**: Remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/51022.jpg` (710×1030 px, 359.7 KB)
### [51023] Ayo
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Dora Milaje. Wakanda.*
- **Rules Text**:
  > [star] **Response**: After Ayo uses a basic power, resolve the "**Special**" ability on another [[Dora Milaje]] ally.
  > **Special**: Deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/51023.png` (710×1030 px, 366.8 KB)
### [51024] Okoye
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 24
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Dora Milaje. Wakanda.*
- **Rules Text**:
  > [star] **Response**: After Okoye uses a basic power, resolve the "**Special**" ability on another [[Dora Milaje]] ally.
  > **Special**: Choose a [[Wakanda]] hero or ally. They get +1 THW and +1 ATK until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/51024.jpg` (710×1030 px, 358.1 KB)
### [51025] Heart of the Panther
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Wakanda.*
- **Rules Text**:
  > Team-Up (Black Panther/T'Challa and Black Panther/Shuri). Max 1 per deck.
  > **Hero Action**: Search your deck and discard pile for a [[Black Panther]] upgrade and put it into play. Resolve the "**Special**" ability on up to 4 [[Black Panther]] upgrades you control in any order.
- **Image Asset**: `assets/card-art/bundles/cards/51025.png` (710×1030 px, 362.3 KB)
### [51026] Build Support
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Basic
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 26
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 3 per hero, **Resources**: [mental]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for a support with a cost of 3 or less and put it into play. *(Shuffle.)*
- **Flavor**: *"I've got just the thing." —Forge*
- **Image Asset**: `assets/card-art/bundles/cards/51026.png` (1030×710 px, 341.3 KB)
### [51027] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [51028] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [51029] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [51030] Dora Milaje
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 30
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [wild]
- **Traits**: *Wakanda.*
- **Rules Text**:
  > Ignore this card's resource cost if your identity has the [[Wakanda]] trait.
  > **Action**: Exhaust Dora Milaje → resolve the "**Special**" ability on 1 [[Dora Milaje]] ally and heal 1 damage from that ally.
- **Image Asset**: `assets/card-art/bundles/cards/51030.jpg` (710×1030 px, 373.8 KB)

### Set: Black Panther (Shuri) Nemesis

### [51032] Klaw
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 0 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Panther (Shuri) Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Masters of Evil.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Klaw attacks, give him 1 boost card for this activation.
  > *(Black Panther's nemesis minion.)*
- **Flavor**: *"Once my sweet music plays...the world will be mine!"*
- **Image Asset**: `assets/card-art/bundles/cards/51032.png` (710×1030 px, 362.9 KB)
### [51033] Manipulated M.U.S.I.C.
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) Nemesis (2/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Panther (Shuri) Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Find M.U.S.I.C. and put her into play engaged with you.
  > **When Defeated**: Discard M.U.S.I.C. from play.
- **Flavor**: *Klaw aims to use the powers of the girl he calls M.U.S.I.C. to mind-control the world.*
- **Image Asset**: `assets/card-art/bundles/cards/51033.jpg` (1030×710 px, 366.2 KB)
### [51034] M.U.S.I.C.
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) Nemesis (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 0, **HP**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Panther (Shuri) Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Captive.*
- **Rules Text**:
  > **When Revealed**: Find Manipulated M.U.S.I.C. and put it into play.
  > **When Defeated**: Move all threat from Manipulated M.U.S.I.C. to the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/51034.png` (710×1030 px, 354.0 KB)
### [51035] The Scream
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Black Panther (Shuri) Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Black Panther (Shuri) Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Stun each character you control. Deal 1 damage to each of those characters that was already stunned.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. If you were already stunned, take 1 damage.
- **Image Asset**: `assets/card-art/bundles/cards/51035.jpg` (710×1030 px, 300.3 KB)

### Set: Leadership

### [51037] White Wolf — *Hunter*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 37
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 2 [star], **HP**: 3, **Resources**: [physical]
- **Traits**: *Wakanda.*
- **Rules Text**:
  > [star] **Forced Response**: After White Wolf attacks, place 1 threat on the main scheme.
- **Flavor**: *As a member of Wakanda's secret police, the Hatut Zeraze, the White Wolf is willing to use extreme methods to defend his adopted home nation.*
- **Image Asset**: `assets/card-art/bundles/cards/51037.png` (710×1030 px, 388.2 KB)

### Set: Aggression

### [51038] Target Spotter
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Pack Position: 38
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Persona. S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (2 target counters).
  > **Interrupt**: When a minion would engage a player, remove 1 target counter from here → that minion cannot activate until the end of the phase. Engage that minion.
- **Image Asset**: `assets/card-art/bundles/cards/51038.png` (710×1030 px, 353.8 KB)

### Set: Extreme Risk

### [51039] Joystick
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Extreme Risk (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 17
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Extreme Risk Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Thunderbolt.*
- **Rules Text**:
  > Villainous. Victory 1.
  > [star] **Forced Interrupt**: When Joystick activates against you, choose:
  > • Give her 1 additional boost card for this activation and draw 1 card.
  > • Give her a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/51039.jpg` (710×1030 px, 350.8 KB)
### [51040] Energy Truncheon
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Extreme Risk (2–3/6, Qty: 2)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Extreme Risk Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to Joystick. Otherwise, attach to the villain.
  > [star] Attached enemy's attacks gain piercing.
  > **Hero Action**: Attached enemy attacks you. After this attack, discard this card and draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/51040.png` (710×1030 px, 311.6 KB)
### [51041] Playing for Keeps
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Extreme Risk (4/6)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Extreme Risk Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each identity gets +1 hand size.
  > **Forced Interrupt**: When an enemy activates, give it 1 boost card for that activation *(in addition to any other boost cards it gets)*.
- **Flavor**: *"Try keepin' up." —Joystick*
- **Image Asset**: `assets/card-art/bundles/cards/51041.jpg` (1030×710 px, 378.2 KB)
### [51042] Extreme Risk
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Black Panther (`bp`)
- **Deck / Set**: Extreme Risk (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Extreme Risk Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find Joystick and reveal her. *(If she is already in play, she engages you.)* Joystick activates against you. If no enemy  activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: You may give the activating enemy an additional boost card. If you do, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/51042.jpg` (710×1030 px, 405.2 KB)

