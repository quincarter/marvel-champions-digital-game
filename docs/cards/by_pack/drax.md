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
| `19001a` | Drax | Hero | Drax | THW:1 ATK:1 DEF:2 HP:14 | - | `drax` |
| `19001b` | Drax | Alter-Ego | Drax | REC:4 HP:14 | - | `drax` |
| `19002` | Mantis | Ally | Drax | THW:2 ATK:1 HP:3 | - | `drax` |
| `19003` | "Fight Me, Coward!" | Event | Drax | - | - | `drax` |
| `19004` | Intimidation | Event | Drax | - | - | `drax` |
| `19005` | Knife Leap | Event | Drax | - | - | `drax` |
| `19006` | Parry | Event | Drax | - | - | `drax` |
| `19007` | Payback | Event | Drax | - | - | `drax` |
| `19008` | Drax's Knife | Upgrade | Drax | - | - | `drax` |
| `19009` | Drax's Other Knife | Upgrade | Drax | - | - | `drax` |
| `19010` | DWI Theet Mastery | Upgrade | Drax | - | - | `drax` |
| `19011` | Too Stubborn to Die | Upgrade | Drax | - | - | `drax` |
| `19012` | Martyr | Ally | Pack Position: 12 | THW:1 ATK:2 HP:3 | - | `drax` |
| `19013` | Moondragon | Ally | Pack Position: 13 | THW:1 ATK:1 HP:2 | - | `drax` |
| `19014` | Counter-Punch | Event | Pack Position: 14 | - | - | `drax` |
| `19015` | Deflection | Event | Pack Position: 15 | - | - | `drax` |
| `19016` | Hard Knocks | Event | Pack Position: 16 | - | - | `drax` |
| `19017` | Leading Blow | Event | Pack Position: 17 | - | - | `drax` |
| `19018` | Subdue | Event | Pack Position: 18 | - | - | `drax` |
| `19019` | Indomitable | Upgrade | Pack Position: 19 | - | - | `drax` |
| `19020` | Gamora | Ally | Pack Position: 20 | THW:1 ATK:2 HP:3 | - | `drax` |
| `19021` | Athletic Conditioning | Event | Pack Position: 21 | - | - | `drax` |
| `19022` | Energy | Resource | Pack Position: 22 | - | - | `drax` |
| `19023` | Genius | Resource | Pack Position: 23 | - | - | `drax` |
| `19024` | Strength | Resource | Pack Position: 24 | - | - | `drax` |
| `19025` | Memories of Another Life | Obligation | Drax | - | not recorded in this source | `drax` |
| `19026` | Cull the Weak | Side Scheme | Drax Nemesis | - | not recorded in this source | `drax` |
| `19027` | Yotat the Destroyer | Minion | Drax Nemesis | SCH:1 ATK:3 HP:5 | not recorded in this source | `drax` |
| `19028` | Challenge Accepted | Attachment | Drax Nemesis | - | not recorded in this source | `drax` |
| `19029` | "I Will Destroy You!" | Treachery | Drax Nemesis | - | not recorded in this source | `drax` |
| `19030` | "Bring It!" | Event | Pack Position: 30 | - | - | `drax` |
| `19031` | "Think Fast!" | Event | Pack Position: 31 | - | - | `drax` |
| `19032` | Regroup | Support | Pack Position: 32 | - | - | `drax` |
| `19033` | Enhanced Physique | Upgrade | Pack Position: 33 | - | - | `drax` |

---

## Pack: Drax (`drax`)

### Set: Drax

### [19001a] Drax
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 2, **HP**: 14, **Hand Size**: 4
- **Traits**: *Guardian.*
- **Rules Text**:
  > Drax gets +1 ATK for each vengeance counter on him.
  > **Response:** After the villain attacks Drax, place 1 vengeance counter here (to a maximum of 3). If you cannot, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/19001a.png` (300×418 px, 214.5 KB)

### [19001b] Drax
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 14, **Hand Size**: 6
- **Traits**: *Outlaw.*
- **Rules Text**:
  > **Forced Response:** After you change to this form, remove all vengeance counters from Drax. Heal 2 damage from him for each vengeance counter removed this way.
- **Image Asset**: `assets/card-art/bundles/cards/19001b.png` (300×418 px, 226.2 KB)

### [19002] Mantis
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (1/25)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 2), **HP**: 3, **Resources**: [wild]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Action:** Exhaust Mantis and deal 1 damage to her → heal 3 damage from an identity.
- **Flavor**: *"Bring harm to this one at your own peril!"*
- **Image Asset**: `assets/card-art/bundles/cards/19002.png` (729×1042 px, 179.4 KB)

### [19003] "Fight Me, Coward!"
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (2–3/25, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > **Hero Action**: Ready your hero and draw 1 card. The villain attacks you.
- **Flavor**: *"Hear me, Thanos! Titan or god, I shall yet obliterate you!" —Drax*
- **Image Asset**: `assets/card-art/bundles/cards/19003.png` (728×1044 px, 323.1 KB)

### [19004] Intimidation
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (4–5/25, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove X threat from a scheme, where X is equal to your ATK.
- **Flavor**: *"Pay close attention because I'm only going to say this once: walk away and you live." —Drax*
- **Image Asset**: `assets/card-art/bundles/cards/19004.png` (728×1040 px, 167.2 KB)

### [19005] Knife Leap
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (6–7/25, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Reduce the cost to play this card by 1 for each vengeance counter on Drax.
  > **Hero Interrupt**: When you make a basic attack, you get +5 ATK for that attack. That attack gains overkill and piercing.
- **Image Asset**: `assets/card-art/bundles/cards/19005.png` (727×1040 px, 174.1 KB)

### [19006] Parry
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (8–9/25, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you would take any amount of damage, prevent X of that damage, where X is equal to double your ATK.
- **Flavor**: *"You are a fool to believe I'd fall to the likes of you!" —Drax*
- **Image Asset**: `assets/card-art/bundles/cards/19006.png` (729×1044 px, 185.6 KB)

### [19007] Payback
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (10–11/25, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Response** *(attack)*: After the villain attacks you, deal X damage to the villain, where X is equal to your ATK.
- **Flavor**: *"Would stabbing it help?" —Drax*
- **Image Asset**: `assets/card-art/bundles/cards/19007.png` (726×1045 px, 182.3 KB)

### [19008] Drax's Knife
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (12/25)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted (Max 2 restricted cards per player.)
  > While in hero form, Drax gets +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/19008.png` (729×1042 px, 176.1 KB)

### [19009] Drax's Other Knife
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (13/25)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted (Max 2 restricted cards per player.)
  > While in hero form, Drax gains retaliate 1.
- **Image Asset**: `assets/card-art/bundles/cards/19009.png` (729×1042 px, 183.4 KB)

### [19010] DWI Theet Mastery
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (14/25)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Response**: After Drax makes a basic attack, draw 1 card.
- **Flavor**: *"I will have my revenge against Thanos!" —Drax*
- **Image Asset**: `assets/card-art/bundles/cards/19010.png` (728×1043 px, 177.4 KB)

### [19011] Too Stubborn to Die
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (15/25)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Hero Interrupt**: When Drax would be defeated, instead set his hit point dial to 4, change him to alter-ego form, and remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/19011.png` (725×1042 px, 170.6 KB)

### [19025] Memories of Another Life
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax (25/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Drax Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Drax player.***
  > You may flip to your alter-ego form. Choose:
  > • Exhaust your alter-ego → remove Memories of Another Life from the game.
  > • You are stunned. If you are already stunned, this card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/19025.png` (728×1045 px, 191.6 KB)


### Set: Protection

### [19012] Martyr — *Phyla-Vell*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Response:** After Martyr takes consequential damage from performing an attack, if that attack defeated an enemy, give her a tough status card.
- **Flavor**: *"You want to learn about pain? I'll teach you!"*
- **Image Asset**: `assets/card-art/bundles/cards/19012.png` (727×1042 px, 185.1 KB)

### [19013] Moondragon — *Heather Douglas*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Action:** Exhaust and discard Moondragon → choose a minion. That minion attacks another enemy of your choice.
- **Flavor**: *"How dare you disturb my meditation?!"*
- **Image Asset**: `assets/card-art/bundles/cards/19013.png` (728×1042 px, 181.2 KB)

### [19014] Counter-Punch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Response** *(attack)*: After your hero defends against an enemy attack, deal damage to that enemy equal to your hero's ATK.
- **Flavor**: *"That's what you get!" —Iron Fist*

### [19015] Deflection
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When an identity would take any amount of damage from an attack, prevent up to 5 of that damage. Discard cards from the top of your deck equal to the amount prevented this way.
- **Image Asset**: `assets/card-art/bundles/cards/19015.png` (728×1042 px, 192.9 KB)

### [19016] Hard Knocks
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If that enemy is defeated by this attack, give your hero a tough status card.
- **Flavor**: *"That'll teach you to underestimate me." —Star-Lord*
- **Image Asset**: `assets/card-art/bundles/cards/19016.png` (728×1042 px, 184.0 KB)

### [19017] Leading Blow
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Interrupt**: When your hero makes a basic attack, discard the top card of the encounter deck → reduce your hero's ATK for that attack by the number of printed boost icons on that card. If that attack still deals damage, ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/19017.png` (727×1043 px, 170.8 KB)

### [19018] Subdue
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > **Hero Interrupt**: When an enemy initiates an attack, that enemy gets -3 ATK for that attack.
- **Flavor**: *"Back, beast!" —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/19018.png` (730×1044 px, 170.6 KB)

### [19019] Indomitable
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Response**: After your hero defends, discard indomitable → ready your hero.
- **Flavor**: *"We have no choice. So we fight — and we win. There are no other options." —Captain America*


### Set: Basic

### [19020] Gamora
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Guardian.*
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait.
  > **Hero Response**: After Gamora attacks or thwarts, discard cards from the top of your deck until you discard an event, then add that card to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/19020.png` (728×1042 px, 183.2 KB)

### [19021] Athletic Conditioning
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Hero Action**: Discard 1 stun or confuse status card from your hero.
- **Flavor**: *"Don't worry, the ringing in your ears will go away... eventually." —Nadia Van Dyne*

### [19022] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [19023] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [19024] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [19033] Enhanced Physique
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Uses (3 physical counters).
  > **Hero Resource**: Exhaust Enhanced Physique and remove 1 physical counter from it → generate a [physical] resource.


### Set: Drax Nemesis

### [19026] Cull the Weak
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax Nemesis (1/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Drax Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each enemy gets +2 ATK
- **Flavor**: *Yotat the Destroyer has made it his mission to rid the galaxy of those he deems inferior.*
- **Image Asset**: `assets/card-art/bundles/cards/19026.png` (1046×723 px, 166.8 KB)

### [19027] Yotat the Destroyer
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Drax Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > Guard. Retaliate 1.
  > *(Drax's nemesis minion)*
- **Flavor**: *"You will kneel before the true Destroyer!"*
- **Image Asset**: `assets/card-art/bundles/cards/19027.png` (728×1042 px, 175.1 KB)

### [19028] Challenge Accepted
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Drax Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > Attach to the enemy with the highest ATK.
  > **Forced Response**: After Drax deals 4 or more damage to attached enemy with a single attack, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/19028.png` (727×1043 px, 194.3 KB)

### [19029] "I Will Destroy You!"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Drax (`drax`)
- **Deck / Set**: Drax Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Drax Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: Yotat the Destroyer attacks you with +1 ATK. If no attack was made this way, the villain attacks you.
- **Flavor**: *"Not if I destroy you first!" —Drax*
- **Image Asset**: `assets/card-art/bundles/cards/19029.png` (729×1042 px, 189.4 KB)


### Set: Aggression

### [19030] "Bring It!"
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > Max 1 per phase.
  > **Hero Action**: Draw 1 card for each minion engaged with you.
- **Flavor**: *"You picked the wrong day, pal!" —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/19030.png` (729×1044 px, 176.9 KB)


### Set: Justice

### [19031] "Think Fast!"
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait.
  > **Hero Action**: Take 1 damage. Confuse the villain.
- **Flavor**: *"Hey, don't be angry at me! I definitely warned you." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/19031.png` (729×1043 px, 174.1 KB)


### Set: Leadership

### [19032] Regroup
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Drax (`drax`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Interrupt**: When an ally is defeated by an enemy attack, return it to its owner's hand instead of discarding it.
  > **Forced Interrupt**: When the round ends, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/19032.png` (729×1042 px, 194.6 KB)


