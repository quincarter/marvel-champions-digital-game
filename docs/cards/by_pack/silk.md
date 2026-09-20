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
| `52001a` | Silk | Hero | Silk | THW:1 ATK:2 DEF:3 HP:10 | - | `silk` |
| `52001b` | Cindy Moon | Alter-Ego | Silk | HP:10 | - | `silk` |
| `52002` | Smooth as Silk | Event | Silk | - | - | `silk` |
| `52003` | Swinging Silk Kick | Event | Silk | - | - | `silk` |
| `52004` | Wallcrawl | Event | Silk | - | - | `silk` |
| `52005` | Get the Scoop | Player Side Scheme | Silk | - | - | `silk` |
| `52006` | Albert Moon | Support | Silk | - | - | `silk` |
| `52007` | J. Jonah Jameson | Support | Silk | - | - | `silk` |
| `52008` | Eidetic Memory | Upgrade | Silk | - | - | `silk` |
| `52009` | Organic Webbing | Upgrade | Silk | - | - | `silk` |
| `52010` | Outwit | Upgrade | Silk | - | - | `silk` |
| `52011` | Spider Claws | Upgrade | Silk | - | - | `silk` |
| `52012` | Spider Reflexes | Upgrade | Silk | - | - | `silk` |
| `52013` | Scarlet Spider | Ally | Pack Position: 13 | THW:1 ATK:1 HP:5 | - | `silk` |
| `52014` | Spider-Byte | Ally | Pack Position: 14 | THW:2 ATK:1 HP:2 | - | `silk` |
| `52015` | Not Today! | Event | Pack Position: 15 | - | - | `silk` |
| `52016` | "Stop Hitting Yourself" | Event | Pack Position: 16 | - | - | `silk` |
| `52017` | Dr. Sinclair | Support | Pack Position: 17 | - | - | `silk` |
| `52018` | Energy Shield | Upgrade | Pack Position: 18 | - | - | `silk` |
| `52019` | Ready for a Fight | Upgrade | Pack Position: 19 | - | - | `silk` |
| `52020` | Stun Gun | Upgrade | Pack Position: 20 | - | - | `silk` |
| `52021` | Madame Web | Ally | Pack Position: 21 | THW:2 ATK:1 HP:2 | - | `silk` |
| `52022` | Spider-Man | Ally | Pack Position: 22 | THW:2 ATK:2 HP:3 | - | `silk` |
| `52023` | Across the Spider-Verse | Event | Pack Position: 23 | - | - | `silk` |
| `52024` | Investigative Journalism | Event | Pack Position: 24 | - | - | `silk` |
| `52025` | Energy | Resource | Pack Position: 25 | - | - | `silk` |
| `52026` | Genius | Resource | Pack Position: 26 | - | - | `silk` |
| `52027` | Strength | Resource | Pack Position: 27 | - | - | `silk` |
| `52028` | Silk Sense Overload | Obligation | Silk | - | 2 pips | `silk` |
| `52029` | Morlun | Minion | Silk Nemesis | SCH:1 ATK:1 HP:5 | 3 pips | `silk` |
| `52030` | The Great Hunt | Side Scheme | Silk Nemesis | - | 2 pips | `silk` |
| `52031` | Hunting the Spider-Bride | Treachery | Silk Nemesis | - | 1 pips | `silk` |
| `52032` | Spider-Man 2099 | Ally | Pack Position: 32 | THW:2 ATK:2 HP:3 | - | `silk` |
| `52033` | Spider-Woman | Ally | Pack Position: 33 | THW:1 ATK:2 HP:3 | - | `silk` |
| `52034` | Quick Quip | Event | Pack Position: 34 | - | - | `silk` |
| `52035` | Atlas | Minion | Growing Strong | SCH:0 ATK:3 HP:18 | 4 pips | `silk` |
| `52036` | Grow Invulnerable | Side Scheme | Growing Strong | - | 3 pips | `silk` |
| `52037` | Growing Strong | Treachery | Growing Strong | - | 1 pips | `silk` |
| `52038` | Titanic Proportions | Treachery | Growing Strong | - | 1 pips | `silk` |

---

## Pack: Silk (`silk`)

### Set: Silk

### [52001a] Silk
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 3, **HP**: 10, **Hand Size**: 5
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > If there are more than 4 tucked cards here, discard all but 4 of those cards.
  > *Silk Sense* — **Response**: After you defeat a minion or side scheme, or resolve a treachery card, tuck that card under here from the encounter discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/52001a.png` (300×426 px, 254.1 KB)
### [52001b] Cindy Moon
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Genius.*
- **Rules Text**:
  > If there are more than 4 tucked cards here, discard all but 4 of those cards.
  > **Action**: Discard a card tucked here → draw 2 cards. (Limit once per round.)
- **Flavor**: *"Something about this story doesn't add up."*
- **Image Asset**: `assets/card-art/bundles/cards/52001b.png` (300×426 px, 243.9 KB)
### [52002] Smooth as Silk
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (1–2/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Hero Action**: Choose an enemy or scheme in play → discard cards from the top of the encounter deck until a card from the same encounter set as the chosen card is discarded. Tuck that discarded card under Silk.
- **Image Asset**: `assets/card-art/bundles/cards/52002.png` (710×1030 px, 352.0 KB)
### [52003] Swinging Silk Kick
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (3–5/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Aerial. Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 7 damage to an enemy. You may discard a card tucked under Silk from the same encounter set as that enemy. If you do, this attack deals 2 additional damage and gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/52003.jpg` (710×1030 px, 359.9 KB)
### [52004] Wallcrawl
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (6–7/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 2 threat from a scheme. Choose a scheme. You may discard a card tucked under Silk from the same encounter set as the chosen scheme to remove 3 threat from the chosen scheme.
- **Image Asset**: `assets/card-art/bundles/cards/52004.png` (710×1030 px, 369.3 KB)
### [52005] Get the Scoop
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (8/15)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 4, **Resources**: [wild]
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust your identity → remove 2 threat from here. Any player may trigger this ability.
  > **When Defeated**: The Cindy Moon player looks at the top 2 cards of the encounter deck and tucks 1 of those cards under their identity.
- **Image Asset**: `assets/card-art/bundles/cards/52005.jpg` (1030×710 px, 346.7 KB)
### [52006] Albert Moon
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Albert Moon → choose:
  > • Tuck the top card of the encounter deck under Cindy Moon.
  > • Heal 1 damage from Cindy Moon for each card tucked under her.
- **Image Asset**: `assets/card-art/bundles/cards/52006.jpg` (710×1030 px, 372.7 KB)
### [52007] J. Jonah Jameson
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust this card → search your deck and discard pile for Get the Scoop and put it into play.
  > **Action**: Exhaust this card → remove 2 threat from a side scheme.
- **Flavor**: *"I like you, Analog."*
- **Image Asset**: `assets/card-art/bundles/cards/52007.png` (710×1030 px, 364.0 KB)
### [52008] Eidetic Memory
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (11/15)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Interrupt**: When you reveal a card from the same encounter set as a card tucked under your identity, exhaust Eidetic Memory → swap those cards. Reveal the card that had been tucked under Silk instead.
- **Image Asset**: `assets/card-art/bundles/cards/52008.png` (710×1030 px, 372.6 KB)
### [52009] Organic Webbing
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (12/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Silk gets +1 THW.
  > **Hero Action**: Exhaust Organic Webbing and discard a card tucked under Silk → ready Silk. She gains the [[Aerial]] trait until the end of the round.
- **Image Asset**: `assets/card-art/bundles/cards/52009.jpg` (710×1030 px, 297.4 KB)
### [52010] Outwit
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (13/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When Silk makes a basic thwart, exhaust Outwit → for this thwart she gets +1 THW for each card tucked under her from the same encounter set as the thwarted scheme.
- **Image Asset**: `assets/card-art/bundles/cards/52010.png` (710×1030 px, 369.1 KB)
### [52011] Spider Claws
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (14/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > **Hero Interrupt**: When Silk makes a basic attack, exhaust Spider Claws → for this attack she gets +1 ATK for each card tucked under her from the same encounter set as the attacked enemy. This attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/52011.jpg` (710×1030 px, 302.8 KB)
### [52012] Spider Reflexes
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (15/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When Silk defends, exhaust Spider Reflexes → for this attack she gets +1 DEF for each card tucked under her from the same encounter set as the attacking enemy. After this attack, tuck the top card of the encounter discard pile under Silk.
- **Image Asset**: `assets/card-art/bundles/cards/52012.jpg` (710×1030 px, 365.0 KB)
### [52028] Silk Sense Overload
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Silk Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Cindy Moon player.***
  > **Forced Interrupt**: When a card would be tucked under your identity by a player card effect, tuck it under here instead. Then, if there are 2 tucked cards here, you may discard this card (remove it from the game instead if there are 3 or more tucked cards here).
- **Image Asset**: `assets/card-art/bundles/cards/52028.jpg` (710×1030 px, 357.8 KB)

### Set: Protection

### [52013] Scarlet Spider — *Ben Reilly*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 2), **ATK**: 1 (Consequential: 2), **HP**: 5, **Resources**: [physical]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > **Interrupt**: When another [[Web-Warrior]] character would take any amount of damage, Scarlet Spider takes that damage instead.
- **Flavor**: *"Roses are red, spiders are two,
One comes in scarlet, the other in blue!"*
- **Image Asset**: `assets/card-art/bundles/cards/52013.png` (710×1030 px, 365.4 KB)
### [52014] Spider-Byte — *Margo Kess*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > Reduce the cost to play Spider-Byte by 1 for each [[Tech]] card you control.
- **Flavor**: *"I'm just your friendly virtual reality webslinger!"*
- **Image Asset**: `assets/card-art/bundles/cards/52014.jpg` (710×1030 px, 354.0 KB)
### [52015] Not Today!
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When your hero defends against an attack, it gets +2 DEF for that attack. If you take no damage from that attack, remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/52015.png` (710×1030 px, 354.0 KB)
### [52016] "Stop Hitting Yourself"
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Response** *(attack)*: After you defend against an enemy attack and take no damage, deal damage to that enemy equal to your DEF for that attack.
- **Image Asset**: `assets/card-art/bundles/cards/52016.png` (710×1030 px, 352.5 KB)
### [52017] Dr. Sinclair
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Persona. Therapist.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Dr. Sinclair and spend a [mental] resource → heal damage from your alter-ego equal to your REC. You may discard 1 status card from your identity. Any player may trigger this ability.
- **Image Asset**: `assets/card-art/bundles/cards/52017.jpg` (710×1030 px, 367.8 KB)
### [52018] Energy Shield
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Attach to a character. Max 1 per character.
  > **Interrupt**: When attached character would take any amount of damage, spend X [energy] resources → prevent X of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/52018.jpg` (710×1030 px, 374.3 KB)
### [52019] Ready for a Fight
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Preparation.*
- **Rules Text**:
  > Requirement ([physical]). Max 1 per player.
  > **Interrupt**: When an enemy would scheme, discard Ready for a Fight → change to hero form. That enemy attacks you instead.
- **Image Asset**: `assets/card-art/bundles/cards/52019.png` (710×1030 px, 371.8 KB)
### [52020] Stun Gun
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted. Uses (2 charge counters).
  > **Hero Action**: Exhaust Stun Gun and remove 1 or 2 charge counters from it → if you removed:
  > • 1 charge counter, stun a minion.
  > • 2 charge counters, stun the villain.
- **Image Asset**: `assets/card-art/bundles/cards/52020.png` (710×1030 px, 292.1 KB)

### Set: Basic

### [52021] Madame Web — *Julia Carpenter*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > **Response**: After Madame Web enters play, look at the top X cards of the encounter deck, where X is the number of [[Web-Warrior]] cards you control. You may discard 1 card looked at this way and put the rest back in any order.
- **Image Asset**: `assets/card-art/bundles/cards/52021.jpg` (710×1030 px, 370.8 KB)
### [52022] Spider-Man — *Peter Parker*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > Requirement ([energy] [mental] [physical]). *(While paying for this card, spend the listed resources.)*
  > **Response**: After Spider-Man attacks or thwarts, choose another [[Web-Warrior]] character → ready that character.
- **Flavor**: *"See, Miles, that's how you do it."*
### [52023] Across the Spider-Verse
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Action**: Exhaust a [[Web-Warrior]] card you control → search your discard pile for a [[Web-Warrior]] ally and put it into play, then choose a player. That player may spend 3 resources of any type to repeat this ability.
### [52024] Investigative Journalism
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Skill.*
- **Rules Text**:
  > Team-Up (Cindy Moon and Peter Parker). Max 1 per deck.
  > **Alter-Ego Interrupt**: When an enemy would scheme, cancel that activation and confuse that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/52024.jpg` (710×1030 px, 347.7 KB)
### [52025] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [52026] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [52027] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### Set: Silk Nemesis

### [52029] Morlun
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Silk Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Inheritor.*
- **Rules Text**:
  > [star] Morlun gets +1 SCH and +1 ATK for each encounter card tucked under each identity.
  > **When Defeated**: Discard each copy of Hunting the Spider-Bride tucked under each identity.
- **Image Asset**: `assets/card-art/bundles/cards/52029.png` (710×1030 px, 317.7 KB)
### [52030] The Great Hunt
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk Nemesis (2/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Silk Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place 1 additional threat here for each card tucked under each identity.
- **Flavor**: *"There you are. The spinner at the center of the web. It's time. The Great Hunt begins." —Morlun*
- **Image Asset**: `assets/card-art/bundles/cards/52030.jpg` (1030×710 px, 305.2 KB)
### [52031] Hunting the Spider-Bride
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Silk (`silk`)
- **Deck / Set**: Silk Nemesis (3–5/5, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Silk Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: If you have 4 cards tucked under your identity, discard 1 of those cards at random. Tuck this card under your identity.
  > **Forced Response**: After a player card effect discards this card from under an identity, that identity takes 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/52031.png` (710×1030 px, 345.3 KB)

### Set: Leadership

### [52032] Spider-Man 2099 — *Miguel O'Hara*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 32
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Aerial. Web-Warrior.*
- **Rules Text**:
  > [star] **Response**: After Spider-Man 2099 uses a basic power, return a [[Web-Warrior]] ally in play to its owner's hand.
- **Flavor**: *"That's me: the Spider-Man of tomorrow, here to save today!"*
- **Image Asset**: `assets/card-art/bundles/cards/52032.png` (710×1030 px, 293.8 KB)

### Set: Aggression

### [52033] Spider-Woman — *Jessica Drew*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 33
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Web-Warrior.*
- **Rules Text**:
  > **Response**: After a [[Web-Warrior]] ally *(including this one)* enters play, deal 1 damage to an enemy.
- **Flavor**: *"Everyone should see what's about to happen next!"*
- **Image Asset**: `assets/card-art/bundles/cards/52033.jpg` (710×1030 px, 339.6 KB)

### Set: Justice

### [52034] Quick Quip
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Silk (`silk`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > Requirement ([mental]).
  > **Hero Action**: Deal 1 damage to a [[Web-Warrior]] character you control → place a total of 2 confused status cards on up to 2 enemies.
- **Flavor**: *"We got more tentacles than a sushi bar!" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/52034.png` (710×1030 px, 364.0 KB)

### Set: Growing Strong

### [52035] Atlas
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Silk (`silk`)
- **Deck / Set**: Growing Strong (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 3, **HP**: 18 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Growing Strong Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Thunderbolt.*
- **Rules Text**:
  > Villainous. Victory 1.
  > [star] Atlas gets +2 hit points for each growth counter on him.
  > **Forced Response**: After the villain phase ends, place 1 growth counter on Atlas.
- **Image Asset**: `assets/card-art/bundles/cards/52035.jpg` (710×1030 px, 351.3 KB)
### [52036] Grow Invulnerable
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Silk (`silk`)
- **Deck / Set**: Growing Strong (2/6)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Growing Strong Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Place 1 additional threat here for each growth counter on Atlas.
  > **If Atlas has 10 or more growth counters on him, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/52036.jpg` (1030×710 px, 347.4 KB)
### [52037] Growing Strong
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Silk (`silk`)
- **Deck / Set**: Growing Strong (3–4/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Growing Strong Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find Atlas and reveal him. *(If he is already in play, he engages you.)* Atlas activates against you. If no enemy activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/52037.png` (710×1030 px, 384.7 KB)
### [52038] Titanic Proportions
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Silk (`silk`)
- **Deck / Set**: Growing Strong (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Growing Strong Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The players as a group take X indirect damage, where X is the number of growth counters on Atlas. If X is less than 3, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If Atlas is in play, place 1 growth counter on him.
- **Image Asset**: `assets/card-art/bundles/cards/52038.png` (710×1030 px, 368.9 KB)

