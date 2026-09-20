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
| `13001a` | Wasp | Hero | Wasp | THW:1 ATK:1 DEF:2 HP:11 | - | `wsp` |
| `13001b` | Nadia Van Dyne | Alter-Ego | Wasp | REC:3 HP:11 | - | `wsp` |
| `13001c` | Wasp | Hero | Wasp | THW:2 ATK:2 DEF:3 HP:11 | - | `wsp` |
| `13002` | Ant-Man | Ally | Wasp | THW:2 ATK:2 HP:3 | - | `wsp` |
| `13003` | Giant Help | Event | Wasp | - | - | `wsp` |
| `13004` | Pinpoint Strike | Event | Wasp | - | - | `wsp` |
| `13005` | Rapid Growth | Event | Wasp | - | - | `wsp` |
| `13006` | Wasp Sting | Event | Wasp | - | - | `wsp` |
| `13007` | Pym Particles | Resource | Wasp | - | - | `wsp` |
| `13008` | Red Room Training | Upgrade | Wasp | - | - | `wsp` |
| `13009` | Bio-Synthetic Wings | Upgrade | Wasp | - | - | `wsp` |
| `13010` | Wasp's Helmet | Upgrade | Wasp | - | - | `wsp` |
| `13011` | Thor | Ally | Pack Position: 11 | THW:1 ATK:2 HP:4 | - | `wsp` |
| `13012` | Wasp | Ally | Pack Position: 12 | THW:1 ATK:3 HP:0 | - | `wsp` |
| `13013` | Into the Fray | Event | Pack Position: 13 | - | - | `wsp` |
| `13014` | Surprise Attack | Event | Pack Position: 14 | - | - | `wsp` |
| `13015` | The Power of Aggression | Resource | Pack Position: 15 | - | - | `wsp` |
| `13016` | Boot Camp | Support | Pack Position: 16 | - | - | `wsp` |
| `13017` | Lie in Wait | Upgrade | Pack Position: 17 | - | - | `wsp` |
| `13018` | Ironheart | Ally | Pack Position: 18 | THW:1 ATK:1 HP:2 | - | `wsp` |
| `13019` | Spider-Man | Ally | Pack Position: 19 | THW:1 ATK:2 HP:3 | - | `wsp` |
| `13020` | Swarm Tactics | Event | Pack Position: 20 | - | - | `wsp` |
| `13021` | Energy | Resource | Pack Position: 21 | - | - | `wsp` |
| `13022` | Genius | Resource | Pack Position: 22 | - | - | `wsp` |
| `13023` | Strength | Resource | Pack Position: 23 | - | - | `wsp` |
| `13024` | The Power in All of Us | Resource | Pack Position: 24 | - | - | `wsp` |
| `13025` | Quincarrier | Support | Pack Position: 25 | - | - | `wsp` |
| `13026` | Red Dreams | Obligation | Wasp | - | 2 icons | `wsp` |
| `13027` | Mother's Orders | Side Scheme | Wasp Nemesis | - | 3 icons | `wsp` |
| `13028` | Beetle | Minion | Wasp Nemesis | SCH:1 ATK:1 HP:4 | 2 icons | `wsp` |
| `13029` | Beetle Armor MK IV | Attachment | Wasp Nemesis | - | 2 icons | `wsp` |
| `13030` | Beetle Mania | Treachery | Wasp Nemesis | - | 1 icon | `wsp` |
| `13031` | Running Interference | Event | Pack Position: 31 | - | - | `wsp` |
| `13032` | All for One | Event | Pack Position: 32 | - | - | `wsp` |
| `13033` | Perseverance | Event | Pack Position: 33 | - | - | `wsp` |
| `13034` | Athletic Conditioning | Event | Pack Position: 34 | - | - | `wsp` |

---

## Pack: Wasp (`wsp`)

### Set: Wasp

### [13001a] Wasp
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 2, **HP**: 11, **Hand Size**: 5
- **Traits**: *Avenger. Tiny.*
- **Rules Text**:
  > *Small but Mighty* — **Response:** After Wasp *(or an event you play)* defeats a minion or side scheme, deal 1 damage to the villain.
- **Flavor**: *"You should learn to play nice!"*
- **Image Asset**: `assets/card-art/bundles/cards/13001a.png` (300×419 px, 42.4 KB)

### [13001b] Nadia Van Dyne
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 11, **Hand Size**: 6
- **Traits**: *Genius.*
- **Rules Text**:
  > *G.I.R.L.* — **Action:** Shuffle up to 2 cards with a printed [mental] resource from your discard pile into your deck. (Limit once per round.)
- **Flavor**: *"G.I.R.L. is dedicated to finding brilliant women who will not only save the world, but change it."*
- **Image Asset**: `assets/card-art/bundles/cards/13001b.png` (300×419 px, 41.4 KB)

### [13001c] Wasp
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2 [star], **ATK**: 2 [star], **DEF**: 3, **HP**: 11, **Hand Size**: 5
- **Traits**: *Avenger. Giant.*
- **Rules Text**:
  > [star] Threat you remove using your basic thwart power (THW) can be divided among schemes as you choose.
  > [star] Damage you deal using your basic attack power (ATK) can be divided among enemies as you choose.
- **Flavor**: *"Aww, you're all so tiny and cute."*
- **Image Asset**: `assets/card-art/bundles/cards/13001c.png` (418×599 px, 415.7 KB)

### [13002] Ant-Man — *Scott Lang*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Avenger.*
- **Rules Text**:
  > While you are in [[Giant]] hero form, Ant-Man gains the [[Giant]] trait and gets +1 ATK.
  > While you are in [[Tiny]] hero form, Ant-Man gains the [[Tiny]] trait and gets +1 THW.
- **Image Asset**: `assets/card-art/bundles/cards/13002.png` (300×419 px, 39.2 KB)

### [13003] Giant Help
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (2–3/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme (remove a total of 4 threat divided among schemes as you choose instead if you are in [[Giant]] hero form).
- **Flavor**: *"Glad to be of service!" —Wasp*
- **Image Asset**: `assets/card-art/bundles/cards/13003.png` (300×419 px, 36.5 KB)

### [13004] Pinpoint Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (4–6/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 7 damage to an enemy. If you are in [[Tiny]] hero form, this attack deals 1 additional damage to that enemy and gains overkill.
- **Flavor**: *"You're going to want to ice that in the morning." —Wasp*
- **Image Asset**: `assets/card-art/bundles/cards/13004.png` (300×419 px, 38.7 KB)

### [13005] Rapid Growth
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (7–8/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Giant. Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When you use one of your hero's basic powers (THW, ATK, or DEF), change to your [[Giant]] hero form and get +2 to that power for this use.
- **Flavor**: *"Bet you didn't expect to see that." —Wasp*
- **Image Asset**: `assets/card-art/bundles/cards/13005.png` (300×419 px, 40.5 KB)

### [13006] Wasp Sting
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (9–10/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: If you are in [[Giant]] hero form, deal a total of 4 damage divided among enemies you choose.
  > **Hero Action** *(attack)*: If you are in [[Tiny]] hero form, deal 5 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/13006.png` (300×419 px, 38.3 KB)

### [13007] Pym Particles
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (11–12/15, Qty: 2)
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > **Hero Response**: After you spend this card, heal 2 damage from your hero if you are in [[Giant]] hero form or draw 1 card if you are in [[Tiny]] hero form.
- **Image Asset**: `assets/card-art/bundles/cards/13007.png` (300×419 px, 39.4 KB)

### [13008] Red Room Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (13/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > While you are in [[Giant]] hero form, you gain retaliate 1.
  > While you are in [[Tiny]] hero form, your basic attacks gain piercing. *(Discard any tough status cards from the target before dealing damage.)*
- **Image Asset**: `assets/card-art/bundles/cards/13008.png` (300×419 px, 40.9 KB)

### [13009] Bio-Synthetic Wings
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (14/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Wasp gains the [[Aerial]] trait.
  > **Interrupt:** When you would take any amount of damage, if you are in [[Tiny]] hero form, exhaust Bio-Synthetic Wings → prevent 1 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/13009.png` (300×419 px, 42.4 KB)

### [13010] Wasp's Helmet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > While you are in [[Giant]] hero form, you get +1 THW.
  > While you are in [[Tiny]] hero form, you get +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/13010.png` (300×419 px, 32.8 KB)

### [13026] Red Dreams
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wasp Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Nadia Van Dyne player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Nadia Van Dyne → remove Red Dreams from the game.
  > • Discard each card with a printed [mental] resource from your hand and take 1 damage. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/13026.png` (300×419 px, 33.3 KB)


### Set: Aggression

### [13011] Thor — *Jane Foster*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 4, **Resources**: [energy]
- **Traits**: *Asgard. Avenger.*
- **Rules Text**:
  > **Response:** After you play Thor from your hand, deal 2 damage to the villain (3 damage instead if you paid for this card using a [physical] resource).
- **Flavor**: *"You wanna eat my hammer? Then by all means, take a big bite!"*
- **Image Asset**: `assets/card-art/bundles/cards/13011.png` (300×419 px, 43.3 KB)

### [13012] Wasp — *Janet Van Dyne*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 0, **Resources**: [mental]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > Wasp gets +1 hit point for each pym counter on her.
  > **Interrupt:** When Wasp enters play, place 1 pym counter on her (to a maximum of 3) for each [energy] resource you overpaid for Wasp's cost.
- **Image Asset**: `assets/card-art/bundles/cards/13012.png` (300×419 px, 42.7 KB)

### [13013] Into the Fray
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 6 damage to a minion. For each point of excess damage dealt by this attack, remove 1 threat from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/13013.png` (300×419 px, 39.4 KB)

### [13014] Surprise Attack
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Response** *(attack)*: After you change form, deal 3 damage to an enemy (4 damage instead if you paid for this card using [physical] resource).
- **Image Asset**: `assets/card-art/bundles/cards/13014.png` (300×419 px, 35.3 KB)

### [13015] The Power of Aggression
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Aggression *(red)* card.

### [13016] Boot Camp
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Each ally you control gets +1 ATK.
- **Flavor**: *"YOU CALL THAT A PUSHUP! MY GRANDMOTHER DOES BETTER PUSHUPS!"*
- **Image Asset**: `assets/card-art/bundles/cards/13016.png` (300×419 px, 35.0 KB)

### [13017] Lie in Wait
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Preparation.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Response** *(attack)*: After a minion engages you, discard Lie in Wait → deal 3 damage to that minion.
- **Image Asset**: `assets/card-art/bundles/cards/13017.png` (300×419 px, 43.0 KB)


### Set: Basic

### [13018] Ironheart
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Champion.*
- **Rules Text**:
  > **Response**: After you play Ironheart from your hand, draw 1 card.
- **Flavor**: *"I'm totally going to be like Tony Stark! Except for that weird facial hair."*
- **Image Asset**: `assets/card-art/bundles/cards/13018.png` (300×419 px, 35.8 KB)

### [13019] Spider-Man — *Miles Morales*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Champion.*
- **Rules Text**:
  > **Response:** After you play Spider-Man from your hand, choose THW or ATK. Spider-Man gets +2 to the chosen power until the end of the phase.
- **Flavor**: *"I'm needed. And just like that, none of the rest of it matters."*
- **Image Asset**: `assets/card-art/bundles/cards/13019.png` (300×419 px, 40.6 KB)

### [13020] Swarm Tactics
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Team-Up (Ant-Man and Wasp). Max 1 per deck.
  > **Hero Action:** Change to your other hero form. Ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/13020.png` (300×419 px, 37.5 KB)

### [13021] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [13022] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [13023] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [13024] The Power in All of Us
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates when paying for a Basic (gray) card.
- **Image Asset**: `assets/card-art/bundles/cards/13024.png` (300×419 px, 39.5 KB)

### [13025] Quincarrier
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 25
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Avenger. Vehicle.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > **Resource**: Exhaust Quincarrier → generate a [wild] resource.
- **Flavor**: *"Too bad we could only get one of these." —Hawkeye*

### [13034] Athletic Conditioning
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 34
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Hero Action**: Discard 1 stun or confuse status card from your hero.
- **Flavor**: *"Don't worry, the ringing in your ears will go away... eventually." —Nadia Van Dyne*
- **Image Asset**: `assets/card-art/bundles/cards/13034.png` (300×419 px, 35.0 KB)


### Set: Wasp Nemesis

### [13027] Mother's Orders
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp Nemesis (1/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wasp Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > As an additional cost for each hero to make a basic attack, that hero must spend 1 of any resource.
- **Flavor**: *Mother has sent one of her most devious henchmen after Wasp, hoping to recapture the Red Room escapee.*
- **Image Asset**: `assets/card-art/bundles/cards/13027.png` (419×300 px, 37.5 KB)

### [13028] Beetle
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp Nemesis (2/5)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wasp Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Guard.
  > **Forced Interrupt**: When Beetle is defeated, choose to either spend a [physical] resource or shuffle Beetle into the encounter deck.
  > *(Wasp's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/13028.png` (300×419 px, 40.5 KB)

### [13029] Beetle Armor MK IV
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp Nemesis (3/5)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wasp Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to Beetle, if able. If you cannot, attach to the villain.
  > Attached Character gets +4 hit points.
- **Flavor**: *"Ugh, why can't I ever find anything around here?" —Janice Lincoln*
- **Image Asset**: `assets/card-art/bundles/cards/13029.png` (300×419 px, 40.6 KB)

### [13030] Beetle Mania
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Wasp Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Wasp Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: Beetle attacks you with +1 ATK. If no attack was made this way, this card gains surge.
- **Flavor**: *"I was waiting for this moment to arise." —Beetle*
- **Image Asset**: `assets/card-art/bundles/cards/13030.png` (300×419 px, 41.0 KB)


### Set: Justice

### [13031] Running Interference
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > **Hero Action** *(thwart)*: Remove 2 threat from the main scheme. Remove X additional threat from the main scheme (to a maximum of 3), where X is equal to the villain's stage number.
- **Image Asset**: `assets/card-art/bundles/cards/13031.png` (300×419 px, 33.4 KB)


### Set: Leadership

### [13032] All for One
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy and exhaust any number of [[Avenger]] characters you control. Deal 1 additional damage to that enemy for each character exhausted this way.
- **Image Asset**: `assets/card-art/bundles/cards/13032.png` (300×419 px, 36.0 KB)


### Set: Protection

### [13033] Perseverance
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Wasp (`wsp`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Response**: After you change form, give your hero a tough status card.
- **Flavor**: *"You do know the front door is unlocked, right?" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/13033.png` (300×419 px, 38.4 KB)


