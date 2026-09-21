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
| `12001a` | Ant-Man | Hero | Ant-Man | THW:2 ATK:2 DEF:2 HP:12 | - | `ant` |
| `12001b` | Scott Lang | Alter-Ego | Ant-Man | REC:3 HP:12 | - | `ant` |
| `12001c` | Ant-Man | Hero | Ant-Man | THW:1 ATK:3 DEF:3 HP:12 | - | `ant` |
| `12002` | Wasp | Ally | Ant-Man | THW:2 ATK:2 HP:3 | - | `ant` |
| `12003` | Giant Stomp | Event | Ant-Man | - | - | `ant` |
| `12004` | Hive Mind | Event | Ant-Man | - | - | `ant` |
| `12005` | Resize | Event | Ant-Man | - | - | `ant` |
| `12006` | Pym Particles | Resource | Ant-Man | - | - | `ant` |
| `12007` | Army of Ants | Support | Ant-Man | - | - | `ant` |
| `12008` | Ant-Man's Helmet | Upgrade | Ant-Man | - | - | `ant` |
| `12009` | Giant Strength | Upgrade | Ant-Man | - | - | `ant` |
| `12010` | Wrist Gauntlets | Upgrade | Ant-Man | - | - | `ant` |
| `12011` | Ant-Man | Ally | Pack Position: 11 | THW:2 ATK:2 HP:0 | - | `ant` |
| `12012` | Giant-Man | Ally | Pack Position: 12 | THW:2 ATK:2 HP:4 | - | `ant` |
| `12013` | Ronin | Ally | Pack Position: 13 | THW:1 ATK:2 HP:3 | - | `ant` |
| `12014` | Stinger | Ally | Pack Position: 14 | THW:1 ATK:1 HP:2 | - | `ant` |
| `12015` | Call for Aid | Event | Pack Position: 15 | - | - | `ant` |
| `12016` | Moxie | Event | Pack Position: 16 | - | - | `ant` |
| `12017` | Power Gloves | Upgrade | Pack Position: 17 | - | - | `ant` |
| `12018` | Reinforced Suit | Upgrade | Pack Position: 18 | - | - | `ant` |
| `12019` | First Aid | Event | Pack Position: 19 | - | - | `ant` |
| `12020` | Swarm Tactics | Event | Pack Position: 20 | - | - | `ant` |
| `12021` | Energy | Resource | Pack Position: 21 | - | - | `ant` |
| `12022` | Genius | Resource | Pack Position: 22 | - | - | `ant` |
| `12023` | Strength | Resource | Pack Position: 23 | - | - | `ant` |
| `12024` | Team-Building Exercise | Support | Pack Position: 24 | - | - | `ant` |
| `12025` | Care for Cassie | Obligation | Ant-Man | - | 2 icons | `ant` |
| `12026` | Tech Theft | Side Scheme | Ant-Man Nemesis | - | 3 icons | `ant` |
| `12027` | Yellowjacket | Minion | Ant-Man Nemesis | SCH:2 ATK:2 HP:4 | 2 icons | `ant` |
| `12028` | Size Increase | Attachment | Ant-Man Nemesis | SCH:2 ATK:2 | not recorded in this source | `ant` |
| `12029` | Yellowjacket's Plan | Treachery | Ant-Man Nemesis | - | 1 icon | `ant` |
| `12030` | Moment of Triumph | Event | Pack Position: 30 | - | - | `ant` |
| `12031` | Lay Down the Law | Event | Pack Position: 31 | - | - | `ant` |
| `12032` | Muster Courage | Event | Pack Position: 32 | - | - | `ant` |
| `12033` | Assess the Situation | Event | Pack Position: 33 | - | - | `ant` |

---

## Pack: Ant-Man (`ant`)

### Set: Ant-Man

### [12001a] Ant-Man
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 12, **Hand Size**: 5
- **Traits**: *Avenger. Tiny.*
- **Rules Text**:
  > *Puny Pest* — **Response:** After you change to this form, remove 1 threat from a scheme.
- **Flavor**: *"Why don't you pick on somebody your own size?"*
- **Image Asset**: `assets/card-art/bundles/cards/12001a.png` (300×419 px, 38.5 KB)

### [12001b] Scott Lang
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 12, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > *Time to Unwind* — **Response:** After you change to this form, heal 1 damage from Scott Lang.
- **Flavor**: *"Being Cassie's hero is all I've ever wanted."*
- **Image Asset**: `assets/card-art/bundles/cards/12001b.png` (300×419 px, 35.1 KB)

### [12001c] Ant-Man
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 3, **DEF**: 3, **HP**: 12, **Hand Size**: 4
- **Traits**: *Avenger. Giant.*
- **Rules Text**:
  > *Giant Nuisance* — **Response:** After you change to this form, deal 1 damage to an enemy.
- **Flavor**: *"Oh Yeah, tiny dude is big now!"*
- **Image Asset**: `assets/card-art/bundles/cards/12001c.png` (300×419 px, 38.5 KB)

### [12002] Wasp — *Nadia Van Dyne*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Hero Response:** After Wasp enters play, deal 2 damage to an enemy if you are in [[Giant]] hero form or remove 2 threat from a scheme if you are in [[Tiny]] hero form.
- **Image Asset**: `assets/card-art/bundles/cards/12002.png` (300×419 px, 40.6 KB)

### [12003] Giant Stomp
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (2–3/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Giant.*
- **Rules Text**:
  > Play only if you are in [[Giant]] hero form.
  > **Hero Action** *(attack)*: Deal 1 damage to each minion. Deal 8 damage to an enemy.
- **Flavor**: *"I'd run if I were you." —Scott Lang*
- **Image Asset**: `assets/card-art/bundles/cards/12003.png` (300×419 px, 42.1 KB)

### [12004] Hive Mind
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (4/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Thwart. Tiny.*
- **Rules Text**:
  > Play only if you are in [[Tiny]] hero form.
  > **Hero Action** *(thwart)*: Remove 2 threat from a scheme. Remove 1 additional threat from that scheme for each Army of Ants support you control.
- **Image Asset**: `assets/card-art/bundles/cards/12004.png` (300×419 px, 39.5 KB)

### [12005] Resize
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (5–6/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action:** Change to your other hero form. Draw 1 card.
- **Flavor**: *"This is awesome!" —Scott Lang*
- **Image Asset**: `assets/card-art/bundles/cards/12005.png` (300×419 px, 38.1 KB)

### [12006] Pym Particles
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (7–8/15, Qty: 2)
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > **Hero Response:** After you spend this card, heal 2 damage from your hero if you are in [[Giant]] hero form or draw 1 card if you are in [[Tiny]] hero form.
- **Image Asset**: `assets/card-art/bundles/cards/12006.png` (300×419 px, 39.8 KB)

### [12007] Army of Ants
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (9–11/15, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Ants. Tiny.*
- **Rules Text**:
  > **Hero Action:** If you are in [[Tiny]] hero form, exhaust Army of Ants → deal 1 damage to an enemy.
- **Flavor**: *"Antvengers Assemble!" —Scott Lang*
- **Image Asset**: `assets/card-art/bundles/cards/12007.png` (300×419 px, 35.6 KB)

### [12008] Ant-Man's Helmet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (12/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > **Hero Response:** After you change to [[Giant]] hero form, heal 2 damage from your hero.
  > **Hero Response:** After you change to [[Tiny]] hero form, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/12008.png` (300×419 px, 37.9 KB)

### [12009] Giant Strength
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (13–14/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition. Giant.*
- **Rules Text**:
  > **Hero Response:** After you change to [[Giant]] hero form, you get +1 ATK until the end of this turn.
- **Flavor**: *"My daughter lost her phone. I thought I'd look under these buildings." —Scott Lang*
- **Image Asset**: `assets/card-art/bundles/cards/12009.png` (300×419 px, 39.1 KB)

### [12010] Wrist Gauntlets
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (15/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > **Hero Action:** If you are in [[Giant]] hero form, exhaust Wrist Gauntlets and spend [physical][physical] resources → stun an enemy.
  > **Hero Action:** If you are in [[Tiny]] hero form, exhaust Wrist Gauntlets and spend [energy][energy] resources → confuse an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/12010.png` (300×419 px, 40.8 KB)

### [12025] Care for Cassie
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ant-Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Scott Lang player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Scott Lang → remove Care for Cassie from the game.
  > • Choose and discard 1 card from your hand. You cannot change form until your next turn ends. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/12025.png` (300×419 px, 38.2 KB)


### Set: Leadership

### [12011] Ant-Man — *Hank Pym*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 0, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Ant-Man gets +1 hit point for each pym counter on him.
  > **Interrupt:** When Ant-Man enters play, place 1 pym counter on him (to a maximum of 4) for each resource you overpaid for Ant-Man's cost.
- **Image Asset**: `assets/card-art/bundles/cards/12011.png` (300×419 px, 40.4 KB)

### [12012] Giant-Man
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Avenger. Giant.*
- **Rules Text**:
  > Giant-Man gets +2 ATK while he has 3 or more remaining hit points.
- **Flavor**: *"Size isn't everything. Unless you're stepping over a bridge."*
- **Image Asset**: `assets/card-art/bundles/cards/12012.png` (300×419 px, 42.5 KB)

### [12013] Ronin
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Ronin gets +1 THW and +1 ATK while an upgrade is attached to them.
- **Flavor**: *"Dunno who's wearing the suit this time, but they can definitely handle themself in a fight." —Spectrum*
- **Image Asset**: `assets/card-art/bundles/cards/12013.png` (300×419 px, 39.9 KB)

### [12014] Stinger — *Cassie Lang*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 1, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > Stinger does not count against your ally limit.
- **Image Asset**: `assets/card-art/bundles/cards/12014.png` (300×419 px, 36.2 KB)

### [12015] Call for Aid
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > **Hero Action:** Discard cards from the top of your deck until you discard an [[Avenger]] ally, then add that ally to your hand.
- **Flavor**: *"You rang?" —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/12015.png` (300×419 px, 37.2 KB)

### [12016] Moxie
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Hero Response:** After you change form, your hero gets +1 THW, +1 ATK, +1 DEF until the end of the round.
- **Flavor**: *"If you mess with one of us, you mess with all of us!" Even if I'm the last one." —Nova*
- **Image Asset**: `assets/card-art/bundles/cards/12016.png` (300×419 px, 31.9 KB)

### [12017] Power Gloves
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to an [[Avenger]] ally. Max 1 per ally.
  > **Response:** After attached ally attacks or thwarts, deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/12017.png` (300×419 px, 36.3 KB)

### [12018] Reinforced Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to an ally. Max 1 per ally.
  > Attached ally gets +2 hit points.
- **Flavor**: *"Remember, it's not just the suit that gives you power, it's how you use it." —Hank Pym*
- **Image Asset**: `assets/card-art/bundles/cards/12018.png` (300×419 px, 38.8 KB)


### Set: Basic

### [12019] First Aid
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Heal 2 damage from any character.
- **Flavor**: *"Does it still qualify as first aid if it's your second day in the hospital?" —Clint Barton*

### [12020] Swarm Tactics
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Team-Up (Ant-Man and Wasp). Max 1 per deck.
  > **Hero Action:** Change to your other hero form. Ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/12020.png` (710×1030 px, 402.6 KB)

### [12021] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [12022] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [12023] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [12024] Team-Building Exercise
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Hero Action**: Exhaust Team-Building Exercise → play a card from your hand that shares a trait with your hero, reducing its resource cost by 1.
- **Image Asset**: `assets/card-art/bundles/cards/12024.png` (300×419 px, 39.3 KB)

### [12033] Assess the Situation
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 33
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Action:** You get +1 hand size until the end of the phase.
- **Flavor**: *"Well, if I run, that's not cool. And if I stay and get tasered, that's not cool either. I'm in a bit of a pickle." —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/12033.png` (300×419 px, 33.0 KB)


### Set: Ant-Man Nemesis

### [12026] Tech Theft
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man Nemesis (1/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ant-Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Treat the printed text box of each [[Tech]] player card as if it were blank.
- **Flavor**: *Yellowjacket has stolen priceless Pym Particle technology.*
- **Image Asset**: `assets/card-art/bundles/cards/12026.png` (419×300 px, 35.9 KB)

### [12027] Yellowjacket
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ant-Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > While you are in [[Giant]] hero form, Yellowjacket gains the [[Giant]] trait and retaliate 1.
  > While you are in [[Tiny]] hero form, Yellowjacket gains the [[Tiny]] trait and gets +1 ATK.
  > (Ant-Man's nemesis minion.)
- **Image Asset**: `assets/card-art/bundles/cards/12027.png` (300×419 px, 44.8 KB)

### [12028] Size Increase
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Ant-Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to Yellowjacket, if able. If you cannot, attach to the villain.
  > Uses (3 counters).
  > [star] **Forced Response:** After attached enemy activates, remove 1 size counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/12028.png` (300×419 px, 42.6 KB)

### [12029] Yellowjacket's Plan
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Ant-Man Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ant-Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Discard cards from the encounter deck until a card from the Ant-Man Nemesis set is discarded this way. Reveal that card.
- **Flavor**: *"You think you can stop the future?!" —Yellowjacket*
- **Image Asset**: `assets/card-art/bundles/cards/12029.png` (300×419 px, 45.6 KB)


### Set: Aggression

### [12030] Moment of Triumph
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Hero Response:** After you attack and defeat an enemy, heal 1 damage from your hero for each point of excess damage dealt to that enemy by that attack.
- **Image Asset**: `assets/card-art/bundles/cards/12030.png` (300×419 px, 36.3 KB)


### Set: Justice

### [12031] Lay Down the Law
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Response** *(thwart)*: After you change form, remove 3 threat from a scheme (4 threat instead if you paid for this card using a [mental] resource).
- **Flavor**: *"Maybe this will teach you!" —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/12031.png` (300×419 px, 39.5 KB)


### Set: Protection

### [12032] Muster Courage
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Ant-Man (`ant`)
- **Deck / Set**: Pack Position: 32
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Rules Text**:
  > Play only if your identity has the [[Avenger]] trait.
  > **Hero Action:** Give up to X friendly characters a tough status card (to a maximum of 3 characters), where X is equal to the villain's stage number.
- **Image Asset**: `assets/card-art/bundles/cards/12032.png` (300×419 px, 41.5 KB)


