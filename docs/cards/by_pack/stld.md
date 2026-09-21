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
| `17001a` | Star-Lord | Hero | Star-Lord | THW:2 ATK:2 DEF:1 HP:10 | - | `stld` |
| `17001b` | Peter Quill | Alter-Ego | Star-Lord | REC:3 HP:10 | - | `stld` |
| `17002` | Nova Prime | Ally | Star-Lord | THW:2 ATK:3 HP:3 | - | `stld` |
| `17003` | Daring Escape | Event | Star-Lord | - | - | `stld` |
| `17004` | Gutsy Move | Event | Star-Lord | - | - | `stld` |
| `17005` | Sliding Shot | Event | Star-Lord | - | - | `stld` |
| `17006` | Bad Boy | Support | Star-Lord | - | - | `stld` |
| `17007` | Element Gun | Upgrade | Star-Lord | - | - | `stld` |
| `17008` | Jet Boots | Upgrade | Star-Lord | - | - | `stld` |
| `17009` | Leader of the Guardians | Upgrade | Star-Lord | - | - | `stld` |
| `17010` | Star-Lord's Helmet | Upgrade | Star-Lord | - | - | `stld` |
| `17011` | Adam Warlock | Ally | Pack Position: 11 | THW:1 ATK:1 HP:3 | - | `stld` |
| `17012` | Beta Ray Bill | Ally | Pack Position: 12 | THW:1 ATK:3 HP:4 | - | `stld` |
| `17013` | Yondu | Ally | Pack Position: 13 | THW:2 ATK:1 HP:2 | - | `stld` |
| `17014` | Air Supremacy | Event | Pack Position: 14 | - | - | `stld` |
| `17015` | Blaze of Glory | Event | Pack Position: 15 | - | - | `stld` |
| `17016` | Get Ready | Event | Pack Position: 16 | - | - | `stld` |
| `17017` | Target Practice | Support | Pack Position: 17 | - | - | `stld` |
| `17018` | The Power of Leadership | Resource | Pack Position: 18 | - | - | `stld` |
| `17019` | Laser Blaster | Upgrade | Pack Position: 19 | - | - | `stld` |
| `17020` | Cosmo | Ally | Pack Position: 20 | THW:1 ATK:1 HP:2 | - | `stld` |
| `17021` | C.I.T.T. | Support | Pack Position: 21 | - | - | `stld` |
| `17022` | Knowhere | Support | Pack Position: 22 | - | - | `stld` |
| `17023` | Pulse Grenade | Upgrade | Pack Position: 23 | - | - | `stld` |
| `17024` | Banishment | Obligation | Star-Lord | - | 2 icons | `stld` |
| `17025` | Budding Crime Syndicate | Side Scheme | Star-Lord Nemesis | - | 3 icons | `stld` |
| `17026` | Mister Knife | Minion | Star-Lord Nemesis | SCH:2 ATK:2 HP:6 | 2 icons | `stld` |
| `17027` | Spartoi Cunning | Treachery | Star-Lord Nemesis | - | 1 icon | `stld` |
| `17028` | Dive Bomb | Event | Pack Position: 28 | - | - | `stld` |
| `17029` | Agile Flight | Event | Pack Position: 29 | - | - | `stld` |
| `17030` | Ever Vigilant | Event | Pack Position: 30 | - | - | `stld` |
| `17031` | Enhanced Awareness | Upgrade | Pack Position: 31 | - | - | `stld` |

---

## Pack: Star-Lord (`stld`)

### Set: Star-Lord

### [17001a] Star-Lord
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 1, **HP**: 10, **Hand Size**: 5
- **Traits**: *Guardian.*
- **Rules Text**:
  > Each ally you control gains the [[guardian]] trait.
  > "What could go wrong?" — **Interrupt:** When you play a card from your hand, deal yourself 1 facedown encounter card → reduce the cost to play that card by 3. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/17001a.png` (300×418 px, 223.6 KB)

### [17001b] Peter Quill
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Outlaw.*
- **Rules Text**:
  > **Setup:** Search your deck and discard pile for a copy of the Element Gun upgrade and add it to your hand.
  > Smooth Talker — **Action:** Choose a card in your hand. Swap that card with the top card of your deck. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/17001b.png` (300×418 px, 234.7 KB)

### [17002] Nova Prime — *Richard Rider*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Aerial. Nova Corps.*
- **Rules Text**:
  > **Response:** After you play Nova Prime from your hand, defeat a non-[[elite]] minion.
- **Flavor**: *"This is for Nova Corps!" —Nova Prime*
- **Image Asset**: `assets/card-art/bundles/cards/17002.png` (729×1040 px, 177.4 KB)

### [17003] Daring Escape
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (2–4/15, Qty: 3)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Hero Action** Deal yourself 1 facedown encounter card → ready your hero and draw 1 card.
- **Flavor**: *"Okay, not to brag, but that was probably the bravest thing that any one of us has ever done." —Star-Lord*
- **Image Asset**: `assets/card-art/bundles/cards/17003.png` (729×1041 px, 196.7 KB)

### [17004] Gutsy Move
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (5–6/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 2 threat from a scheme. Remove 2 additional threat from that scheme for each facedown encounter card in front of you.
- **Image Asset**: `assets/card-art/bundles/cards/17004.png` (729×1041 px, 169.8 KB)

### [17005] Sliding Shot
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (7–9/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > Play only if you control an Element Gun.
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy. Deal 2 additional damage to that enemy for each facedown encounter card in front of you.
- **Image Asset**: `assets/card-art/bundles/cards/17005.png` (727×1044 px, 187.1 KB)

### [17006] Bad Boy
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Vehicle.*
- **Rules Text**:
  > **Hero Interrupt** When you would take any amount of damage from the villain's attack, discard this card → prevent all of that damage. Change to alter-ego form and draw 2 cards.
- **Flavor**: *"Ridin' in style!" —Peter Quill*
- **Image Asset**: `assets/card-art/bundles/cards/17006.png` (729×1040 px, 295.9 KB)

### [17007] Element Gun
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (11–12/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Action** *(attack)*: Exhaust Element Gun and spend 1 resource of any type → deal 3 damage to an enemy. This attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/17007.png` (727×1041 px, 172.8 KB)

### [17008] Jet Boots
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (13/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Star-Lord gains the [[aerial]] trait.
  > **Hero Interrupt**: When Star-Lord would take any amount of damage, exhaust Jet Boots → prevent 1 of that damage for each facedown encounter card in front of you.
- **Image Asset**: `assets/card-art/bundles/cards/17008.png` (729×1041 px, 189.3 KB)

### [17009] Leader of the Guardians
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (14/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Title.*
- **Rules Text**:
  > Each [[guardian]] character you control gets +1 THW.
- **Flavor**: *"I know we all hate each other and we all tried to kill one another. But from now on, and until the job is done, we're Guardians." —Peter Quill*
- **Image Asset**: `assets/card-art/bundles/cards/17009.png` (729×1041 px, 183.5 KB)

### [17010] Star-Lord's Helmet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > While you are in hero form, you get +1 hand size for each facedown encounter card in front of you (to a maximum of +3 hand size)
- **Flavor**: *"You can't see that I'm judging you, but I'm judging you." —Star-Lord*
- **Image Asset**: `assets/card-art/bundles/cards/17010.png` (729×1042 px, 184.9 KB)

### [17024] Banishment
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Star-Lord Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Peter Quill player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Peter Quill → remove Banishment from the game.
  > • Discard an Element Gun from play. If you cannot, place 3 threat on the main scheme. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/17024.png` (728×1043 px, 172.2 KB)


### Set: Leadership

### [17011] Adam Warlock
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Aerial. Mystic.*
- **Rules Text**:
  > **Response**: After Adam Warlock attacks or thwarts, discard 1 card at random from your hand. If that card's printed resource has:
  > [physical] – Remove 3 threat from a scheme.
  > [energy] – Heal 3 damage from an identity.
  > [mental] – Deal 3 damage to an enemy.
  > [wild] – Choose one of the above.
- **Image Asset**: `assets/card-art/bundles/cards/17011.png` (729×1043 px, 183.9 KB)

### [17012] Beta Ray Bill
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Asgard.*
- **Rules Text**:
  > **Response:** After Beta Ray Bill attacks and defeats a minion, remove 2 threat from the main scheme.
- **Flavor**: *"I may not be a native son of the realm eternal, but the power in my hammer comes from Odin himself. So I fight for Asgard, on this day and all tomorrows!"*
- **Image Asset**: `assets/card-art/bundles/cards/17012.png` (728×1040 px, 187.2 KB)

### [17013] Yondu
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 1 [star], **HP**: 2, **Resources**: [energy]
- **Traits**: *Guardian.*
- **Rules Text**:
  > [star] Yondu's attacks gain ranged.*Ranged attacks ignore retaliate.)*
- **Flavor**: *"Don't need no one. I do what I want, when I want, how I want." —Yondu*
- **Image Asset**: `assets/card-art/bundles/cards/17013.png` (729×1040 px, 168.6 KB)

### [17014] Air Supremacy
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Aerial. Tactic.*
- **Rules Text**:
  > **Hero Action**: Choose up to X enemies, where X is equal to the number of [[aerial]] characters you control → deal 3 damage to each chosen enemy.
- **Image Asset**: `assets/card-art/bundles/cards/17014.png` (729×1041 px, 189.6 KB)

### [17015] Blaze of Glory
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Rules Text**:
  > Max 1 per round.
  > **Hero Action**: Each [[guardian]] character gets +2 THW and +2 ATK this phase. At the end of the phase, deal 1 damage to each [[guardian]] character.
- **Image Asset**: `assets/card-art/bundles/cards/17015.png` (730×1040 px, 180.2 KB)

### [17016] Get Ready
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > **Action**: Ready an ally.
- **Flavor**: *"We train hard every day so that when the time comes, we'll be ready." —Steve Rogers*

### [17017] Target Practice
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Interrupt**: When an ally with a [[weapon]] attachment upgrade makes an attack, discard Target Practice → that ally gets +2 ATK for that attack.
- **Flavor**: *"Man, too easy." —Star-Lord*
- **Image Asset**: `assets/card-art/bundles/cards/17017.png` (729×1041 px, 184.5 KB)

### [17018] The Power of Leadership
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Leadership *(blue)* card.

### [17019] Laser Blaster
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to a [[guardian]] ally. Max 1 per ally.
  > Attached ally gets +1 ATK and its attacks gain overkill.
- **Flavor**: *"I'll make short work of you." —Nebula*
- **Image Asset**: `assets/card-art/bundles/cards/17019.png` (728×1042 px, 138.1 KB)


### Set: Basic

### [17020] Cosmo
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Interrupt**: When Cosmo attacks or thwarts, name a card type, then discard the top card of a player deck or the encounter deck. If that card is of the named type, Cosmo does not take consequential damage for this use.
- **Errata (FFG)**:
  > Changed “a deck” to “a player deck or the encounter deck”. Removed reminder text. (RRG 1.5)
- **Image Asset**: `assets/card-art/bundles/cards/17020.png` (728×1044 px, 190.7 KB)

### [17021] C.I.T.T.
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Vehicle.*
- **Rules Text**:
  > **Hero Action**: Exhaust C.I.T.T. and spend 2 resources of any type → ready a [[guardian]] character.
- **Flavor**: *"I don't know, I kind of like calling it the Cool Interstellar Travel Travelship." —Peter Quill*
- **Image Asset**: `assets/card-art/bundles/cards/17021.png` (730×1045 px, 166.7 KB)

### [17022] Knowhere
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait.
  > Increase your ally limit by 1.
  > **Response**: After a player plays a [[guardian]] ally, exhaust Knowhere → that player draws 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/17022.png` (729×1042 px, 185.4 KB)

### [17023] Pulse Grenade
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Weapon.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Discard Pulse Grenade and choose an enemy → discard the top 2 cards of the encounter deck. Deal 1 damage to the chosen enemy for each boost icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/17023.png` (728×1041 px, 169.8 KB)

### [17031] Enhanced Awareness
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Uses (3 mental counters).
  > **Hero Resource**: Exhaust Enhanced Awareness and remove 1 mental counter from it → generate a [mental] resource.


### Set: Star-Lord Nemesis

### [17025] Budding Crime Syndicate
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord Nemesis (1/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Star-Lord Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 2 [per_hero]. *(When revealed, place 2 [per_hero] threat here.)*
- **Flavor**: *"In your tiny head, the line between a criminal enterprise and an empire is thin. In reality, nobody cares. All they care about is who holds the gun." —J'son*
- **Image Asset**: `assets/card-art/bundles/cards/17025.png` (1048×725 px, 148.4 KB)

### [17026] Mister Knife
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Star-Lord Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Elite.*
- **Rules Text**:
  > Retaliate 1.
  > The first treachery the engaged player reveals each villain phase gains surge.
  > *(Star-Lord's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/17026.png` (729×1040 px, 171.9 KB)

### [17027] Spartoi Cunning
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Star-Lord Nemesis (3–5/5, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Star-Lord Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1 card at random from your hand, take 1 damage, and place 1 threat on the main scheme.
- **Flavor**: *"How can you expect to win when the entire galaxy is against you?" —J'son*
- **Image Asset**: `assets/card-art/bundles/cards/17027.png` (728×1041 px, 168.1 KB)


### Set: Aggression

### [17028] Dive Bomb
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Cost**: 4, **Resources**: [physical]
- **Traits**: *Aerial. Attack.*
- **Rules Text**:
  > Play only if your identity has the [[aerial]] trait.
  > **Hero Action** *(attack)*: Deal 7 damage to an enemy. Deal 1 damage to each other enemy.
- **Image Asset**: `assets/card-art/bundles/cards/17028.png` (729×1042 px, 168.0 KB)


### Set: Justice

### [17029] Agile Flight
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Aerial. Thwart.*
- **Rules Text**:
  > Play only if your identity has the [[aerial]] trait.
  > **Hero Action** *(thwart)*: Remove a total of up to 5 threat from among schemes (as you choose).
- **Image Asset**: `assets/card-art/bundles/cards/17029.png` (729×1042 px, 288.4 KB)


### Set: Protection

### [17030] Ever Vigilant
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Star-Lord (`stld`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Aerial. Skill.*
- **Rules Text**:
  > Play only if your identity has the [[aerial]] trait.
  > **Hero Action**: Ready your hero and remove 2 threat from the main scheme.
- **Flavor**: *"I feel like I've got the whole weight of the world on my shoulders." —Captain Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/17030.png` (729×1044 px, 164.5 KB)


