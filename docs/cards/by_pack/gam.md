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
| `18001a` | Gamora | Hero | Gamora | THW:2 ATK:2 DEF:2 HP:10 | - | `gam` |
| `18001b` | Gamora | Alter-Ego | Gamora | REC:3 HP:10 | - | `gam` |
| `18002` | Nebula | Ally | Gamora | THW:2 ATK:2 HP:2 | - | `gam` |
| `18003` | Acrobatic Move | Event | Gamora | - | - | `gam` |
| `18004` | Crosscounter | Event | Gamora | - | - | `gam` |
| `18005` | Set the Pace | Event | Gamora | - | - | `gam` |
| `18006` | Decisive Blow | Event | Gamora | - | - | `gam` |
| `18007` | Forward Momentum | Event | Gamora | - | - | `gam` |
| `18008` | Conditioning Room | Support | Gamora | - | - | `gam` |
| `18009` | Keen Instincts | Upgrade | Gamora | - | - | `gam` |
| `18010` | Gamora's Sword | Upgrade | Gamora | - | - | `gam` |
| `18011` | Angela | Ally | Pack Position: 11 | THW:0 ATK:2 HP:3 | - | `gam` |
| `18012` | Clobber | Event | Pack Position: 12 | - | - | `gam` |
| `18013` | Plan of Attack | Event | Pack Position: 13 | - | - | `gam` |
| `18014` | Uppercut | Event | Pack Position: 14 | - | - | `gam` |
| `18015` | First Hit | Event | Pack Position: 15 | - | - | `gam` |
| `18016` | Impede | Event | Pack Position: 16 | - | - | `gam` |
| `18017` | Combat Training | Upgrade | Pack Position: 17 | - | - | `gam` |
| `18018` | Godslayer | Upgrade | Pack Position: 18 | - | - | `gam` |
| `18019` | Drax | Ally | Pack Position: 19 | THW:1 ATK:3 HP:4 | - | `gam` |
| `18020` | Hit and Run | Event | Pack Position: 20 | - | - | `gam` |
| `18021` | Energy | Resource | Pack Position: 21 | - | - | `gam` |
| `18022` | Genius | Resource | Pack Position: 22 | - | - | `gam` |
| `18023` | Strength | Resource | Pack Position: 23 | - | - | `gam` |
| `18024` | Unfulfilled Destiny | Obligation | Gamora | - | 2 icons | `gam` |
| `18025` | Sibling Rivalry | Side Scheme | Gamora Nemesis | - | 3 icons | `gam` |
| `18026` | Nebula | Minion | Gamora Nemesis | SCH:1 ATK:2 HP:5 | 3 icons | `gam` |
| `18027` | In a Bind | Attachment | Gamora Nemesis | - | 1 icon | `gam` |
| `18028` | Waylay | Treachery | Gamora Nemesis | - | 2 icons | `gam` |
| `18029` | Pivotal Moment | Event | Pack Position: 29 | - | - | `gam` |
| `18030` | Comms Implant | Upgrade | Pack Position: 30 | - | - | `gam` |
| `18031` | True Grit | Event | Pack Position: 31 | - | - | `gam` |
| `18032` | Enhanced Reflexes | Upgrade | Pack Position: 32 | - | - | `gam` |

---

## Pack: Gamora (`gam`)

### Set: Gamora

### [18001a] Gamora
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *Guardian.*
- **Rules Text**:
  > *Finesse* — **Response**: After you play an [[attack]] event, remove 1 threat from a scheme. (Limit once per phase.)
  > *Precision* — **Response**: After you play a [[thwart]] event, deal 1 damage to an enemy. (Limit once per phase.)
- **Image Asset**: `assets/card-art/bundles/cards/18001a.png` (300×418 px, 230.1 KB)

### [18001b] Gamora
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Outlaw.*
- **Rules Text**:
  > *Skilled Tactician* — You may include up to 6 [[attack]] and/or [[thwart]] events in your deck from aspects other than your chosen aspect.
  > **Action**: Look at the top card of your deck. If that card is an [[attack]] or [[thwart]] event, draw it. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/18001b.png` (300×418 px, 223.7 KB)

### [18002] Nebula
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Response**: After Nebula enters play, search your deck for an [[attack]] or [[thwart]] event and add it to your hand. Shuffle your deck.
- **Flavor**: *"This will be a fast fight."*
- **Image Asset**: `assets/card-art/bundles/cards/18002.png` (728×1044 px, 193.5 KB)

### [18003] Acrobatic Move
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (2–3/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to an enemy.
- **Flavor**: *"If you really knew me as well as you thought you did, you would not have attacked me." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/18003.png` (730×1043 px, 182.9 KB)

### [18004] Crosscounter
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (4–5/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack. Defense. Thwart.*
- **Rules Text**:
  > **Hero Interrupt** *(attack/defense/thwart)*: When you would take any amount of damage, prevent 3 of that damage. Deal 1 damage to an enemy. Remove 1 threat from a scheme.
- **Flavor**: *"That decision will be your last!" —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/18004.png` (729×1044 px, 179.9 KB)

### [18005] Set the Pace
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (6–7/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 1 threat from a scheme.
- **Flavor**: *"They don't realize it's over." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/18005.png` (731×1044 px, 175.5 KB)

### [18006] Decisive Blow
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (8–9/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy (7 damage instead if you have played a [[thwart]] event this turn).
- **Flavor**: *"Thanos built me for one purpose: to kill. He'll soon realize that was a poor decision." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/18006.png` (728×1045 px, 184.7 KB)

### [18007] Forward Momentum
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (10–11/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme (5 threat instead if you have played an [[attack]] event this turn).
- **Flavor**: *"This isn't going to go well for you." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/18007.png` (728×1044 px, 172.7 KB)

### [18008] Conditioning Room
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (12/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Conditioning Room → return the bottommost [[attack]] or [[thwart]] event from your discard pile to your hand. Heal 1 damage from Gamora.
- **Flavor**: *"I'm always prepared." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/18008.png` (730×1046 px, 182.8 KB)

### [18009] Keen Instincts
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (13–14/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Resource**: Exhaust Keen Instincts → generate a [wild] resource for an [[attack]] or [[thwart]] event.
- **Flavor**: *"Take your chances with me. You won't regret it." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/18009.png` (731×1044 px, 182.8 KB)

### [18010] Gamora's Sword
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted. *(Max 2 restricted cards per player).*
  > **Response**: After you play an [[attack]] event, deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/18010.png` (728×1043 px, 191.0 KB)

### [18024] Unfulfilled Destiny
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gamora Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Gamora player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust your alter-ego → remove Unfulfilled Destiny from the game.
  > • Choose and discard 2 events from your hand. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/18024.png` (710×1035 px, 254.2 KB)


### Set: Aggression

### [18011] Angela — *Aldrif Odinsdottir*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 0 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Asgard. Guardian.*
- **Rules Text**:
  > **Forced Response**: After Angela enters play under your control, search the top 10 cards of the encounter deck for a minion and put it into play engaged with you. Shuffle the encounter deck. If a minion was not put into play this way, discard Angela.
- **Image Asset**: `assets/card-art/bundles/cards/18011.png` (894×1277 px, 173.0 KB)

### [18012] Clobber
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 12
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. If this is the first card you have played this round, return this card to your hand.
- **Flavor**: *"If I have to hit you again, you'll stay down. For good." —Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/18012.png` (731×1043 px, 178.1 KB)

### [18013] Plan of Attack
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Action**: Search the top 4 cards of your deck (top 7 cards instead if you are in alter-ego form) for an [[attack]] event and add that card to your hand. Shuffle your deck.
- **Flavor**: *"No, I have a plan. Attack." —Star-Lord*
- **Image Asset**: `assets/card-art/bundles/cards/18013.png` (728×1044 px, 164.5 KB)

### [18014] Uppercut
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy.
- **Flavor**: *SMACK!*

### [18017] Combat Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 ATK.
- **Flavor**: *"Tony! She did it again!" —Janet Van Dyne*

### [18018] Godslayer
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Interrupt**: When your hero makes a basic attack against a unique enemy ([unique]), exhaust Godslayer → your hero gets +2 ATK for that attack.
- **Image Asset**: `assets/card-art/bundles/cards/18018.png` (729×1046 px, 176.1 KB)


### Set: Protection

### [18015] First Hit
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to the villain.
  > **Hero Interrupt** *(attack)*: When a minion initiates an attack, deal 2 damage to that minion.
- **Image Asset**: `assets/card-art/bundles/cards/18015.png` (731×1046 px, 185.5 KB)

### [18031] True Grit
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Response** *(thwart)*: After your hero defends against an enemy attack, remove threat from a scheme equal to your hero's THW.
- **Flavor**: *"Just remember, I didn't start this!" —Luke Cage*
- **Image Asset**: `assets/card-art/bundles/cards/18031.png` (732×1044 px, 165.6 KB)


### Set: Justice

### [18016] Impede
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from the main scheme. If this is the first card you have played this round, return this card to your hand.
- **Flavor**: *"First, you'll have to go through me." —Star-Lord*
- **Image Asset**: `assets/card-art/bundles/cards/18016.png` (731×1044 px, 184.3 KB)

### [18029] Pivotal Moment
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 29
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to the villain (5 damage instead if there is no threat on the main scheme).
- **Flavor**: *"This isn't quite what I had in mind... but I'll take it!" —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/18029.png` (724×1038 px, 191.1 KB)


### Set: Basic

### [18019] Drax
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Guardian.*
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait.
  > Drax cannot attack minions.
- **Flavor**: *"Behold, this battle has raised my spirits greatly!"*
- **Image Asset**: `assets/card-art/bundles/cards/18019.png` (247×350 px, 47.1 KB)

### [18020] Hit and Run
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > **Hero Action** *(attack/thwart)*: Deal 2 damage to an enemy. Remove 2 threat from a scheme.
- **Flavor**: *"You know, Lady Gamora, even when we first met—while I was beating you to death—I thought to myself, 'I bet she and I could be friends.'" —Angela*
- **Image Asset**: `assets/card-art/bundles/cards/18020.png` (730×1046 px, 184.0 KB)

### [18021] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [18022] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [18023] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [18032] Enhanced Reflexes
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Uses (3 energy counters). **Hero Resource:** Exhaust Enhanced Reflexes and remove 1 energy counter from it → generate a [energy] resource.


### Set: Gamora Nemesis

### [18025] Sibling Rivalry
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora Nemesis (1/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gamora Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Players other than Gamora cannot remove threat from Sibling Rivalry
  > **Forced Response**: After the villain phase begins, deal 1 facedown encounter card to Gamora.
- **Flavor**: *"One day, sister, our father will see that I am far more worthy than you." —Nebula*
- **Image Asset**: `assets/card-art/bundles/cards/18025.png` (1048×725 px, 173.9 KB)

### [18026] Nebula
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gamora Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Scoundrel.*
- **Rules Text**:
  > Retaliate 2.
  > **Forced Interrupt**: When this minion would enter play, discard the Nebula ally from play.
  > *(Gamora's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/18026.png` (712×1025 px, 172.4 KB)

### [18027] In a Bind
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gamora Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to Gamora.
  > Treat Gamora's printed text box as if it were blank *(except for [[traits]])*).
  > **Hero Action**: Choose and discard an [[attack]] event from your hand and deal 1 damage to Gamora → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/18027.png` (704×1036 px, 191.8 KB)

### [18028] Waylay
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Gamora Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gamora Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Stun and confuse Gamora. If Gamora is already stunned or confused, this card gains surge.
- **Flavor**: *"You won't be father's favorite for much longer, dear sister." —Nebula*
- **Image Asset**: `assets/card-art/bundles/cards/18028.png` (731×1046 px, 197.9 KB)


### Set: Leadership

### [18030] Comms Implant
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Gamora (`gam`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Attach to a [[guardian]] ally. Max 1 per ally.
  > Attached ally gets +1 THW and +1 hit point.
- **Flavor**: *"So... you come here often?" —Peter Quill*
- **Image Asset**: `assets/card-art/bundles/cards/18030.png` (730×1045 px, 185.9 KB)


