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
| `57001` | She-Hulk | Leader | She-Hulk | SCH:1 ATK:2 HP:16 | not recorded in this source | `synthezoid` |
| `57002` | She-Hulk | Leader | She-Hulk | SCH:1 ATK:3 HP:20 | not recorded in this source | `synthezoid` |
| `57003` | She-Hulk | Leader | She-Hulk | SCH:1 ATK:3 HP:20 | not recorded in this source | `synthezoid` |
| `57004` | She-Hulk | Leader | She-Hulk | SCH:2 ATK:3 HP:24 | not recorded in this source | `synthezoid` |
| `57005a` | Superhero Registration Act | Main Scheme | Registration | - | - | `synthezoid` |
| `57005b` | Enforce the Law | Main Scheme | Registration | - | - | `synthezoid` |
| `57006a` | Pro-Registration Tactics | Main Scheme | Registration | - | - | `synthezoid` |
| `57006b` | Mighty Avengers | Main Scheme | Registration | - | - | `synthezoid` |
| `57007` | Superhuman Strength | Attachment | She-Hulk | ATK:2 | 0 icons + star | `synthezoid` |
| `57008` | Focused Rage | Attachment | She-Hulk | SCH:1 | 0 icons + star | `synthezoid` |
| `57009` | One-Two Punch | Treachery | She-Hulk | - | 2 icons | `synthezoid` |
| `57010` | Ground Stomp | Treachery | She-Hulk | - | 0 icons + star | `synthezoid` |
| `57011` | Gamma Slam | Treachery | She-Hulk | - | 3 icons | `synthezoid` |
| `57012` | Legal Practice | Side Scheme | She-Hulk | - | 3 icons | `synthezoid` |
| `57013` | S.H.I.E.L.D. Operator | Minion | S.H.I.E.L.D. Ops | SCH:2 ATK:2 HP:3 | 2 icons | `synthezoid` |
| `57014` | Strategic Overwatch | Treachery | S.H.I.E.L.D. Ops | - | 0 icons + star | `synthezoid` |
| `57015` | Rapid Response | Treachery | S.H.I.E.L.D. Ops | - | 1 icon | `synthezoid` |
| `57016` | Homeland Security | Side Scheme | S.H.I.E.L.D. Ops | - | 3 icons | `synthezoid` |
| `57017` | Atlas | Minion | Thunderbolts | SCH:1 ATK:2 HP:4 | 0 icons + star | `synthezoid` |
| `57018` | Songbird | Minion | Thunderbolts | SCH:2 ATK:1 HP:3 | 0 icons + star | `synthezoid` |
| `57019` | Penance | Minion | Thunderbolts | SCH:2 ATK:2 HP:4 | 0 icons + star | `synthezoid` |
| `57020` | Justice Like Lightning | Treachery | Thunderbolts | - | 1 icon | `synthezoid` |
| `57021` | The Thunderbolts | Side Scheme | Thunderbolts | - | 2 icons | `synthezoid` |
| `57022` | Taskmaster | Minion | Taskmaster | SCH:1 ATK:1 HP:6 | 3 icons | `synthezoid` |
| `57023` | Taskmaster's Sword | Attachment | Taskmaster | ATK:1 | 1 icon | `synthezoid` |
| `57024` | Taskmaster's Shield | Attachment | Taskmaster | SCH:1 | 1 icon | `synthezoid` |
| `57025` | Mimicked Move | Treachery | Taskmaster | - | 1 icon + star | `synthezoid` |
| `57026` | Taskmaster's Academy | Side Scheme | Taskmaster | - | 2 icons | `synthezoid` |
| `57027` | Jester | Minion | Deadly Duo | SCH:1 ATK:2 HP:3 | 2 icons | `synthezoid` |
| `57028` | Jack O'Lantern | Minion | Deadly Duo | SCH:2 ATK:1 HP:3 | 2 icons | `synthezoid` |
| `57029` | Mad Jack's Platform | Attachment | Deadly Duo | SCH:1 ATK:1 | 0 icons + star | `synthezoid` |
| `57030` | Jester's Yo-Yo | Treachery | Deadly Duo | - | 0 icons + star | `synthezoid` |
| `57031` | Deadly Duo | Side Scheme | Deadly Duo | - | 2 icons | `synthezoid` |
| `57032` | You're Out of Order! | Event | She-Hulk | - | - | `synthezoid` |
| `57033` | She-Hulk Smash | Event | She-Hulk | - | - | `synthezoid` |
| `57034` | Make Me Angry | Upgrade | She-Hulk | - | - | `synthezoid` |
| `57035` | Legal Counsel | Resource | She-Hulk | - | - | `synthezoid` |
| `57036` | Righteous Cause | Treachery | Standard PVP | - | not recorded in this source | `synthezoid` |
| `57037` | Whatever It Takes | Treachery | Standard PVP | - | not recorded in this source | `synthezoid` |
| `57038` | Targeted Strike | Treachery | Standard PVP | - | 0 icons + star | `synthezoid` |
| `57039a` | Choosing Sides | Side Scheme | Standard PVP | - | not recorded in this source | `synthezoid` |
| `57039b` | Now It's Personal | Obligation | Standard PVP | - | not recorded in this source | `synthezoid` |
| `57040` | Vision | Leader | Vision | SCH:1 ATK:1 HP:14 | not recorded in this source | `synthezoid` |
| `57041` | Vision | Leader | Vision | SCH:1 ATK:2 HP:18 | not recorded in this source | `synthezoid` |
| `57042` | Vision | Leader | Vision | SCH:1 ATK:2 HP:18 | not recorded in this source | `synthezoid` |
| `57043` | Vision | Leader | Vision | SCH:2 ATK:2 HP:22 | not recorded in this source | `synthezoid` |
| `57044a` | Superhero Resistance | Main Scheme | Resistance | - | - | `synthezoid` |
| `57044b` | Protect Secret Identities | Main Scheme | Resistance | - | - | `synthezoid` |
| `57045a` | Resistance Tactics | Main Scheme | Resistance | - | - | `synthezoid` |
| `57045b` | Expose Overreach | Main Scheme | Resistance | - | - | `synthezoid` |
| `57046a` | Dense | Attachment | Vision | ATK:1 | not recorded in this source | `synthezoid` |
| `57046b` | Intangible | Attachment | Vision | SCH:1 | not recorded in this source | `synthezoid` |
| `57047` | Solar Gem | Attachment | Vision | SCH:1 | 0 icons + star | `synthezoid` |
| `57048` | Vision's Cape | Attachment | Vision | ATK:1 | 0 icons + star | `synthezoid` |
| `57049` | Mass Increase | Attachment | Vision | - | 2 icons | `synthezoid` |
| `57050` | Density Control | Attachment | Vision | - | 3 icons | `synthezoid` |
| `57051` | Solar Beam | Treachery | Vision | - | 1 icon | `synthezoid` |
| `57052` | Superdense Strike | Treachery | Vision | - | 2 icons | `synthezoid` |
| `57053` | Phase Disruption | Treachery | Vision | - | 2 icons | `synthezoid` |
| `57054` | Just Passing Through | Side Scheme | Vision | - | 3 icons | `synthezoid` |
| `57055` | Patriot | Minion | Young Avengers | SCH:2 ATK:2 HP:4 | 1 icon | `synthezoid` |
| `57056` | Hawkeye | Minion | Young Avengers | SCH:2 ATK:2 HP:3 | 1 icon | `synthezoid` |
| `57057` | Stature | Minion | Young Avengers | SCH:1 ATK:2 HP:5 | 1 icon | `synthezoid` |
| `57058` | Teenage Superheroes | Treachery | Young Avengers | - | 2 icons | `synthezoid` |
| `57059` | Young Avengers | Side Scheme | Young Avengers | - | 2 icons | `synthezoid` |
| `57060` | Speed | Minion | Scarlet Twins | SCH:1 ATK:2 HP:3 | 2 icons | `synthezoid` |
| `57061` | Wiccan | Minion | Scarlet Twins | SCH:2 ATK:1 HP:3 | 2 icons | `synthezoid` |
| `57062` | Superspeed | Treachery | Scarlet Twins | - | 0 icons + star | `synthezoid` |
| `57063` | Spellcasting | Obligation | Scarlet Twins | - | 1 icon | `synthezoid` |
| `57064` | Superpowered Siblings | Side Scheme | Scarlet Twins | - | 2 icons | `synthezoid` |
| `57065` | Moon Knight | Minion | Moon Knight | SCH:2 ATK:2 HP:5 | 2 icons | `synthezoid` |
| `57066` | Crescent Dart | Attachment | Moon Knight | ATK:2 | 1 icon | `synthezoid` |
| `57067` | Fist of Khonshu | Treachery | Moon Knight | - | 0 icons + star | `synthezoid` |
| `57068` | Khonshu's Avatar | Side Scheme | Moon Knight | - | 2 icons | `synthezoid` |
| `57069` | Janus | Minion | Royal Guard | SCH:1 ATK:3 HP:3 | 2 icons | `synthezoid` |
| `57070` | Amir | Minion | Royal Guard | SCH:2 ATK:2 HP:3 | 2 icons | `synthezoid` |
| `57071` | Atlanteans | Treachery | Royal Guard | - | 2 icons | `synthezoid` |
| `57072` | Blood Debt | Obligation | Royal Guard | - | 1 icon | `synthezoid` |
| `57073` | The Royal Guard | Side Scheme | Royal Guard | - | 2 icons | `synthezoid` |
| `57074` | Calculated Risk | Event | Vision | - | - | `synthezoid` |
| `57075` | Synthezoid Strike | Event | Vision | - | - | `synthezoid` |
| `57076` | Phased Out | Event | Vision | - | - | `synthezoid` |
| `57077` | Android Assistance | Resource | Vision | - | - | `synthezoid` |
| `57078` | Righteous Cause | Treachery | Standard PVP | - | not recorded in this source | `synthezoid` |
| `57079` | Whatever It Takes | Treachery | Standard PVP | - | not recorded in this source | `synthezoid` |
| `57080` | Targeted Strike | Treachery | Standard PVP | - | 0 icons + star | `synthezoid` |
| `57081a` | Choosing Sides | Side Scheme | Standard PVP | - | not recorded in this source | `synthezoid` |
| `57081b` | Now It's Personal | Obligation | Standard PVP | - | not recorded in this source | `synthezoid` |

---

## Pack: Synthezoid Smackdown (`synthezoid`)

### Set: She-Hulk

### [57001] She-Hulk
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger. Gamma.*
- **Rules Text**:
  > **Setup**: The enemy team finds a copy of Superhuman Strength and attaches it to She-Hulk.
  > **Forced Response**: After an alter-ego changes to hero form, deal 1 damage to that hero.
- **Image Asset**: `assets/card-art/bundles/cards/57001.jpg` (710×1030 px, 262.5 KB)

### [57002] She-Hulk
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger. Gamma.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. She-Hulk cannot take damage this phase.
  > **Forced Response**: After an alter-ego changes to hero form, deal 1 damage to that hero.
- **Image Asset**: `assets/card-art/bundles/cards/57002.jpg` (710×1030 px, 311.4 KB)

### [57003] She-Hulk
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger. Gamma.*
- **Rules Text**:
  > **Setup**: The enemy team finds a copy of Superhuman Strength and attaches it to She-Hulk.
  > **Forced Response**: After an alter-ego changes to hero form, deal 1 damage to that hero.
- **Image Asset**: `assets/card-art/bundles/cards/57003.png` (710×1030 px, 310.6 KB)

### [57004] She-Hulk
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (4/14)
- **Properties**: Unique, Stage IV
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 24 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger. Gamma.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. She-Hulk cannot take damage this phase.
  > **Forced Response**: After an alter-ego changes to hero form, deal 1 damage to that hero.
- **Image Asset**: `assets/card-art/bundles/cards/57004.jpg` (710×1030 px, 317.2 KB)

### [57007] Superhuman Strength
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (5–6/14, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to She-Hulk.
  > [star] **Forced Interrupt**: When She-Hulk attacks, this attack gains overkill. Discard this card after this attack.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/57007.jpg` (710×1030 px, 305.3 KB)

### [57008] Focused Rage
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (7–8/14, Qty: 2)
- **Stats**: **SCH**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to She-Hulk.
  > She-Hulk gains stalwart.
  > [star] **Forced Response**: After She-Hulk schemes, discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/57008.jpg` (710×1030 px, 272.7 KB)

### [57009] One-Two Punch
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (9–10/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: She-Hulk schemes. Give her a tough status card.
  > **When Revealed (Hero)**: She-Hulk attacks you. Give her a tough status card.
- **Flavor**: *"Don't make this harder than it already is!" —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/57009.png` (710×1030 px, 283.3 KB)

### [57010] Ground Stomp
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (11–12/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Exhaust each character you control. If no character was exhausted this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/57010.jpg` (710×1030 px, 317.1 KB)

### [57011] Gamma Slam
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (13/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the highest-cost ally or support you control. Place threat on the main scheme equal to that card's cost. If no threat is placed on the main scheme this way, this card gains surge.
- **Flavor**: *"You messed with the wrong woman!" —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/57011.png` (710×1030 px, 295.0 KB)

### [57012] Legal Practice
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (14/14)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Threat cannot be removed from this scheme by heroes or allies.
  > **Alter-Ego Response**: After you change form, exhaust your identity → remove 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/57012.png` (1030×710 px, 284.6 KB)

### [57032] You're Out of Order!
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (Set Card, unnumbered)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Rules Text**:
  > **Interrupt**: When any amount of threat would be placed on the main scheme, say "I object!" and prevent 3 of that threat.
- **Image Asset**: `assets/card-art/bundles/cards/57032.jpg` (710×1030 px, 318.1 KB)

### [57033] She-Hulk Smash
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (Set Card, unnumbered)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Your She-Hulk leader attacks the enemy leader. If you spent a [physical] resource to pay for this event, stun the enemy leader.
- **Flavor**: *"That does it! Now I'm mad!" —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/57033.png` (710×1030 px, 319.8 KB)

### [57034] Make Me Angry
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (Set Card, unnumbered)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Rules Text**:
  > Attach to your She-Hulk leader.
  > **Forced Response**: After a hero or leader attacks attached She-Hulk, she attacks that character. Then, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/57034.jpg` (710×1030 px, 344.7 KB)

### [57035] Legal Counsel
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: She-Hulk (Set Card, unnumbered)
- **Stats**: **Resources**: [wild] [wild]
- **Rules Text**:
  > **Hero Response**: After you spend this resource, move 1 threat from the main scheme to your leader's main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/57035.png` (710×1030 px, 358.7 KB)


### Set: Registration

### [57005a] Superhero Registration Act
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Registration (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.

### [57005b] Enforce the Law
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Registration (1/2)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > The enemy leader gains steady.
- **Flavor**: *"This could all be avoided if you'd only obey the law!" —She-Hulk*

### [57006a] Pro-Registration Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Registration (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Iron Man and his Avengers are ordered to apprehend any superpowered individuals who refuse to register with S.H.I.E.L.D. That includes former teammates such as Captain America and Spider-Woman.*

### [57006b] Mighty Avengers
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Registration (2/2)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > While the enemy leader is attacking, it gets +1 ATK (+2 ATK instead if the attack is undefended).
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Iron Man's Avengers believe so strongly in superhero reform that they lead the charge against their former teammates.*


### Set: S.H.I.E.L.D. Ops

### [57013] S.H.I.E.L.D. Operator
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: S.H.I.E.L.D. Ops (1–2/5, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Ops Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Patrol.
  > **When Revealed**: Place 2 threat on the main scheme.
- **Flavor**: *"Unregistered super located at 43rd and Madison. Dispatch unit twelve to intercept."*
- **Image Asset**: `assets/card-art/bundles/cards/57013.jpg` (710×1030 px, 295.5 KB)

### [57014] Strategic Overwatch
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: S.H.I.E.L.D. Ops (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Ops Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give the enemy leader and each minion a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy a tough status card.
- **Flavor**: *"I knew we couldn't trust that guy." —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/57014.png` (710×1030 px, 304.8 KB)

### [57015] Rapid Response
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: S.H.I.E.L.D. Ops (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Ops Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the encounter deck until a minion is discarded. If you are in:
  > • Alter-ego form, place threat on the main scheme equal to that minion's SCH.
  > • Hero form, deal damage to your hero equal to that minion's ATK.
- **Image Asset**: `assets/card-art/bundles/cards/57015.jpg` (710×1030 px, 324.6 KB)

### [57016] Homeland Security
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: S.H.I.E.L.D. Ops (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Ops Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > The first minion revealed each round gains surge.
- **Flavor**: *"Illegal superpowered activity has been detected in this area. Please return to your homes and take shelter!" —S.H.I.E.L.D. officer*
- **Image Asset**: `assets/card-art/bundles/cards/57016.jpg` (1030×710 px, 295.1 KB)


### Set: Thunderbolts

### [57017] Atlas
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Thunderbolts (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Giant. Thunderbolt.*
- **Rules Text**:
  > **When Revealed**: Stun your leader. Otherwise, you are stunned.
  >
  > ---
  >
  > [star] **Boost**: Stun your leader. Otherwise, you are stunned.
- **Flavor**: *"I'm gonna put the hurt on you, little man."*
- **Image Asset**: `assets/card-art/bundles/cards/57017.png` (710×1030 px, 318.0 KB)

### [57018] Songbird
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Thunderbolts (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Thunderbolt.*
- **Rules Text**:
  > **When Revealed**: Confuse your leader. Otherwise, you are confused.
  >
  > ---
  >
  > [star] **Boost**: Confuse your leader. Otherwise, you are confused.
- **Flavor**: *"That worked better than I expected."*
- **Image Asset**: `assets/card-art/bundles/cards/57018.png` (710×1030 px, 338.1 KB)

### [57019] Penance
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Thunderbolts (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > **When Revealed**: Deal 2 damage to your leader. Otherwise, deal 2 damage to a character you control.
  >
  > ---
  >
  > [star] **Boost**: Deal 2 damage to your leader. Otherwise, deal 1 damage to a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/57019.jpg` (710×1030 px, 273.2 KB)

### [57020] Justice Like Lightning
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Thunderbolts (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each minion activates against the player it is engaged with. Otherwise, the enemy leader activates against you. Do not give it a boost card for this activation.
- **Flavor**: *"We're all guilty. This is justice!" —Penance*
- **Image Asset**: `assets/card-art/bundles/cards/57020.jpg` (710×1030 px, 284.8 KB)

### [57021] The Thunderbolts
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Thunderbolts (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > Threat cannot be removed from this scheme while a [[Thunderbolt]] minion is in play.
- **Flavor**: *The government gave supercriminals two options: rot in prison or join the Thunderbolts.*
- **Image Asset**: `assets/card-art/bundles/cards/57021.png` (1030×710 px, 283.3 KB)


### Set: Taskmaster

### [57022] Taskmaster
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Taskmaster (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Thunderbolt.*
- **Rules Text**:
  > Retaliate 1. Toughness. Villainous.
  > **When Revealed**: Taskmaster activates against you.
- **Flavor**: *"I'm going to charge S.H.I.E.L.D. extra for this!"*
- **Image Asset**: `assets/card-art/bundles/cards/57022.png` (710×1030 px, 270.7 KB)

### [57023] Taskmaster's Sword
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Taskmaster (2/5)
- **Properties**: Unique
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Taskmaster. Otherwise, attach to the enemy leader.
  > [star] Attached character's attacks gain piercing.
  > **Hero Action**: Spend [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/57023.jpg` (710×1030 px, 277.7 KB)

### [57024] Taskmaster's Shield
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Taskmaster (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Taskmaster. Otherwise, attach to the enemy leader.
  > **Forced Interrupt**: When attached character would take any amount of damage, reduce that amount by 1.
  > **Hero Action**: Spend [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/57024.png` (710×1030 px, 275.7 KB)

### [57025] Mimicked Move
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Taskmaster (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Taskmaster is in play, he attacks your leader. Otherwise, give the enemy leader a tough status card and a facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy an additional boost card.
- **Image Asset**: `assets/card-art/bundles/cards/57025.jpg` (710×1030 px, 271.0 KB)

### [57026] Taskmaster's Academy
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Taskmaster (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: Give the enemy leader a tough status card and a facedown boost card.
- **Flavor**: *"You think I'm mean? Just wait 'til you're fighting Steve Rogers!" —Taskmaster*
- **Image Asset**: `assets/card-art/bundles/cards/57026.jpg` (1030×710 px, 307.5 KB)


### Set: Deadly Duo

### [57027] Jester
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Deadly Duo (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deadly Duo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > **When Revealed**: Discard the top 3 cards of your deck. Take 1 indirect damage for each different card type discarded this way.
- **Flavor**: *"Ha ha! This is too great! We're being ordered to attack heroes!"*
- **Image Asset**: `assets/card-art/bundles/cards/57027.png` (710×1030 px, 271.5 KB)

### [57028] Jack O'Lantern
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Deadly Duo (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deadly Duo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > **When Revealed**: Discard the top 3 cards of your deck. Place 1 threat on the main scheme for each different card type discarded this way.
- **Flavor**: *"I can't believe we're getting paid for this!"*
- **Image Asset**: `assets/card-art/bundles/cards/57028.png` (710×1030 px, 281.9 KB)

### [57029] Mad Jack's Platform
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Deadly Duo (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Deadly Duo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to a minion of the enemy team's choice. Otherwise, this card gains surge.
  > Attached minion gets +4 hit points and gains stalwart.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to a minion engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/57029.jpg` (710×1030 px, 276.0 KB)

### [57030] Jester's Yo-Yo
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Deadly Duo (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Deadly Duo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the highest-cost card you control. Otherwise, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Discard an upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/57030.png` (710×1030 px, 246.8 KB)

### [57031] Deadly Duo
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Deadly Duo (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Deadly Duo Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: Each player discards the top 8 cards of their deck.
- **Flavor**: *Ordered by S.H.I.E.L.D. to hunt down renegade heroes, Jester and Jack O'Lantern are only too happy to do their part.*
- **Image Asset**: `assets/card-art/bundles/cards/57031.jpg` (1030×710 px, 273.2 KB)


### Set: Standard PVP

### [57036] Righteous Cause
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (1/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy leader schemes. If there is more than 1 player on your team, give the enemy leader an additional boost card for this activation.
- **Flavor**: *"I was a double agent for years. There's not much I won't do for a just cause." —Spider-Woman*

### [57037] Whatever It Takes
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The enemy leader attacks your leader.
  > **When Revealed (Hero)**: The enemy leader attacks you.
- **Flavor**: *"I'm on target. Commence attack." —Captain Marvel*

### [57038] Targeted Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy team searches the top 5 cards of the encounter deck for a card and deals it to you as a facedown encounter card.
  >
  > ---
  >
  > [star] **Boost**: The card gains [boost] for each player on your team.

### [57039a] Choosing Sides
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (5/5)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent.
  > The enemy leader cannot take more than 2 damage from each attack.
  > **Forced Response**: After the last threat is removed from here, the enemy team searches the top 5 cards of the encounter deck for 1 [per_hero] encounter cards and deals one to each player as a facedown encounter card. Flip this card.

### [57039b] Now It's Personal
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the first player.***
  > **Action**: Remove this card from the game → each player on your team chooses 2 of your leader's set-aside player cards and adds them to their hand.

### [57078] Righteous Cause
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (1/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy leader schemes. If there is more than 1 player on your team, give the enemy leader an additional boost card for this activation.
- **Flavor**: *"I was a double agent for years. There's not much I won't do for a just cause." —Spider-Woman*

### [57079] Whatever It Takes
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The enemy leader attacks your leader.
  > **When Revealed (Hero)**: The enemy leader attacks you.
- **Flavor**: *"I'm on target. Commence attack." —Captain Marvel*

### [57080] Targeted Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy team searches the top 5 cards of the encounter deck for a card and deals it to you as a facedown encounter card.
  >
  > ---
  >
  > [star] **Boost**: The card gains [boost] for each player on your team.

### [57081a] Choosing Sides
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (5/5)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent.
  > The enemy leader cannot take more than 2 damage from each attack.
  > **Forced Response**: After the last threat is removed from here, the enemy team searches the top 5 cards of the encounter deck for 1 [per_hero] encounter cards and deals one to each player as a facedown encounter card. Flip this card.

### [57081b] Now It's Personal
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Standard PVP (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the first player.***
  > **Action**: Remove this card from the game → each player on your team chooses 2 of your leader's set-aside player cards and adds them to their hand.


### Set: Vision

### [57040] Vision
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Setup**: The enemy team finds Vision's mass form attachment and attaches it to Vision, Dense side faceup.
  > **Forced Response**: After resolving step 1 of the villain phase, flip Vision's mass form attachment.
- **Image Asset**: `assets/card-art/bundles/cards/57040.jpg` (710×1030 px, 275.6 KB)

### [57041] Vision
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. Vision cannot take damage this phase.
  > **Forced Response**: After resolving step 1 of the villain phase, flip Vision's mass form attachment.
- **Image Asset**: `assets/card-art/bundles/cards/57041.png` (710×1030 px, 274.9 KB)

### [57042] Vision
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Setup**: The enemy team finds Vision's mass form attachment and attaches it to Vision, Dense side faceup.
  > **Forced Response**: After resolving step 1 of the villain phase, flip Vision's mass form attachment.
- **Image Asset**: `assets/card-art/bundles/cards/57042.png` (710×1030 px, 328.2 KB)

### [57043] Vision
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (4/14)
- **Properties**: Unique, Stage IV
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. Vision cannot take damage this phase.
  > **Forced Response**: After resolving step 1 of the villain phase, flip Vision's mass form attachment.
- **Image Asset**: `assets/card-art/bundles/cards/57043.jpg` (710×1030 px, 278.0 KB)

### [57046a] Dense
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (5/14)
- **Properties**: Permanent
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Permanent. Mass form.
- **Flavor**: *Vision controls the molecules of his body to make himself intangible, or so dense that weapons shatter against him.*
- **Image Asset**: `assets/card-art/bundles/cards/57046a.png` (289×419 px, 229.2 KB)

### [57046b] Intangible
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (5/14)
- **Properties**: Permanent
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Permanent. Mass form.
  > **Forced Interrupt**: When Vision would take any amount of damage, reduce that amount by 1.
- **Flavor**: *"Innovation is the ultimate weapon." —Vision*
- **Image Asset**: `assets/card-art/bundles/cards/57046b.png` (289×419 px, 245.0 KB)

### [57047] Solar Gem
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (6/14)
- **Properties**: Unique
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to Vision.
  > Vision gains stalwart.
  > **Hero Response**: After you make a basic attack against Vision, spend [energy] [physical] resources → discard this card and flip Vision's mass form attachment.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/57047.png` (710×1030 px, 321.6 KB)

### [57048] Vision's Cape
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (7/14)
- **Properties**: Unique
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to Vision.
  > Vision gains retaliate 1.
  > **Hero Response**: After you make a basic attack against Vision, spend [energy] [mental] resources → discard this card and flip Vision's mass form attachment.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/57048.png` (710×1030 px, 309.3 KB)

### [57049] Mass Increase
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (8/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to Vision.
  > **Forced Interrupt**: When a character attacks Vision while the Dense attachment is in play, prevent all damage from that attack and stun the attacking character. Discard this card.
- **Flavor**: *"Halt!" —Vision*
- **Image Asset**: `assets/card-art/bundles/cards/57049.jpg` (710×1030 px, 294.1 KB)

### [57050] Density Control
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (9/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Surge. Attach to Vision.
  > **Forced Interrupt**: When Vision activates, if this activation is:
  > • A scheme, flip Vision's mass form attachment to Intangible.
  > • An attack, flip Vision's mass form attachment to Dense.
  > Then, if Vision's mass form attachment flipped, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/57050.png` (710×1030 px, 334.9 KB)

### [57051] Solar Beam
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (10–11/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Vision schemes. If the Intangible attachment is in play, Vision gets +1 SCH for this scheme.
  > **When Revealed (Hero)**: Vision attacks you. If the Dense attachment is in play, Vision gets +1 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/57051.jpg` (710×1030 px, 326.3 KB)

### [57052] Superdense Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (12/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Exhaust a character you control. If the Dense attachment is in play, deal 2 damage to that character. If the Intangible attachment is in play, flip that attachment.
- **Flavor**: *"Please do not resist or I will be required to apply even greater force." —Vision*
- **Image Asset**: `assets/card-art/bundles/cards/57052.jpg` (710×1030 px, 306.7 KB)

### [57053] Phase Disruption
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (13/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy team exhausts an upgrade you control. If the Intangible attachment is in play, discard that upgrade instead. If the Dense attachment is in play, flip that attachment.
- **Flavor**: *"Target neutralized." —Vision*
- **Image Asset**: `assets/card-art/bundles/cards/57053.png` (710×1030 px, 329.2 KB)

### [57054] Just Passing Through
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (14/14)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Vision Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme confuses their identity. Otherwise, they stun their identity.
- **Flavor**: *Vision's phasing power makes him a difficult and unpredictable foe.*
- **Image Asset**: `assets/card-art/bundles/cards/57054.jpg` (1030×710 px, 298.5 KB)

### [57074] Calculated Risk
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (Set Card, unnumbered)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Search the top 5 cards of your leader's encounter deck for an encounter card and deal it to the first player on the enemy team as a facedown encounter card.
- **Flavor**: *"There is no victory without risk." —Vision*
- **Image Asset**: `assets/card-art/bundles/cards/57074.png` (710×1030 px, 350.4 KB)

### [57075] Synthezoid Strike
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (Set Card, unnumbered)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Your Vision leader attacks the enemy leader. If Vision's mass form attachment is:
  > • Dense, Vision gets +1 ATK for this attack and this attack gains piercing.
  > • Intangible, flip it to Dense before resolving this attack.
- **Image Asset**: `assets/card-art/bundles/cards/57075.jpg` (710×1030 px, 324.9 KB)

### [57076] Phased Out
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (Set Card, unnumbered)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Choose an attachment on the enemy leader with the text **"Hero Response"** or **"Hero Interrupt"** and discard it.
- **Flavor**: *"My ability to phase through electronics can disrupt Stark's technology." —Vision*
- **Image Asset**: `assets/card-art/bundles/cards/57076.jpg` (710×1030 px, 270.6 KB)

### [57077] Android Assistance
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Vision (Set Card, unnumbered)
- **Stats**: **Resources**: [wild] [wild]
- **Rules Text**:
  > **Hero Interrupt**: When you spend this resource, flip your Vision leader's mass form attachment.
- **Image Asset**: `assets/card-art/bundles/cards/57077.png` (710×1030 px, 376.8 KB)


### Set: Resistance

### [57044a] Superhero Resistance
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Resistance (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.

### [57044b] Protect Secret Identities
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Resistance (1/2)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > [star] **Forced Response**: After resolving step 1 of the villain phase, each player discards the top 3 cards of their deck.
- **Flavor**: *By giving up the masks, heroes put themselves and their loved ones at risk.*

### [57045a] Resistance Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Resistance (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Captain America and his Avengers are forced to go underground or face arrest for refusing to register with S.H.I.E.L.D. When Iron Man and Captain Marvel start rounding up their superpowered friends, the resistance decides to fight back.*

### [57045b] Expose Overreach
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Resistance (2/2)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Allies enter play exhausted.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *"If we expose S.H.I.E.L.D.'s secret prison to the world, they will lose public support." —Vision*


### Set: Young Avengers

### [57055] Patriot
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Young Avengers (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Young Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Young Avenger.*
- **Rules Text**:
  > Toughness.
  > **When Revealed**: Give the enemy leader a tough status card.
- **Flavor**: *"Don't they know that WE'RE the good guys?"*
- **Image Asset**: `assets/card-art/bundles/cards/57055.png` (710×1030 px, 251.0 KB)

### [57056] Hawkeye
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Young Avengers (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Young Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Young Avenger.*
- **Rules Text**:
  > [star] Hawkeye's attacks gain piercing and ranged.
  > **When Revealed**: Discard an upgrade you control.
- **Flavor**: *"Eat your heart out, Clint!"*
- **Image Asset**: `assets/card-art/bundles/cards/57056.png` (710×1030 px, 277.1 KB)

### [57057] Stature
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Young Avengers (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Young Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Giant. Young Avenger.*
- **Rules Text**:
  > Guard.
  > **When Revealed**: Discard a support you control.
- **Flavor**: *"You shouldn't talk down to a girl who can grow two stories tall!"*
- **Image Asset**: `assets/card-art/bundles/cards/57057.jpg` (710×1030 px, 267.1 KB)

### [57058] Teenage Superheroes
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Young Avengers (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Young Avengers Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve the "**When Revealed**" ability of each minion in play. If no "**When Revealed**" abilities were resolved this way, this card gains surge.
- **Flavor**: *"Young Avengers, assemble!" —Kate Bishop*
- **Image Asset**: `assets/card-art/bundles/cards/57058.jpg` (710×1030 px, 321.0 KB)

### [57059] Young Avengers
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Young Avengers (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Young Avengers Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > The first minion revealed each round gains surge.
- **Flavor**: *The next generation of superheroes hopes to carry on the legacy of their seniors.*
- **Image Asset**: `assets/card-art/bundles/cards/57059.png` (1030×710 px, 314.6 KB)


### Set: Scarlet Twins

### [57060] Speed
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Scarlet Twins (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scarlet Twins Set Icon (printed bottom-right next to deck number)
- **Traits**: *Young Avenger.*
- **Rules Text**:
  > Quickstrike.
  > **When Revealed**: You are stunned. Otherwise, deal 2 damage to your identity.
- **Flavor**: *"Hey! Geriatrics! Let's get a move on."*
- **Image Asset**: `assets/card-art/bundles/cards/57060.png` (710×1030 px, 316.8 KB)

### [57061] Wiccan
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Scarlet Twins (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scarlet Twins Set Icon (printed bottom-right next to deck number)
- **Traits**: *Young Avenger.*
- **Rules Text**:
  > Incite 1.
  > **When Revealed**: You are confused. Otherwise, place 2 threat on the main scheme.
- **Flavor**: *"You picked the wrong kids to mess with."*
- **Image Asset**: `assets/card-art/bundles/cards/57061.jpg` (710×1030 px, 299.1 KB)

### [57062] Superspeed
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Scarlet Twins (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Scarlet Twins Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1 random card from your hand. Take indirect damage equal to its cost.
  >
  > ---
  >
  > [star] **Boost**: Discard 1 card from your hand.
- **Flavor**: *"Didn't see that coming, did you?" Speed*
- **Image Asset**: `assets/card-art/bundles/cards/57062.jpg` (710×1030 px, 309.7 KB)

### [57063] Spellcasting
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Scarlet Twins (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scarlet Twins Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When you play a card, cancel its effects and discard it. Then, discard this card.
- **Flavor**: *"BLINDINGFLASHBLINDINGFLASH." —Wiccan*
- **Image Asset**: `assets/card-art/bundles/cards/57063.png` (710×1030 px, 268.8 KB)

### [57064] Superpowered Siblings
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Scarlet Twins (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scarlet Twins Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: The player who defeated this scheme discards 1 card from their hand.
- **Flavor**: *Wiccan and Speed are following in the footsteps of their superhero parents: Vision and Scarlet Witch.*
- **Image Asset**: `assets/card-art/bundles/cards/57064.jpg` (1030×710 px, 305.8 KB)


### Set: Moon Knight

### [57065] Moon Knight
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Moon Knight (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Moon Knight Set Icon (printed bottom-right next to deck number)
- **Traits**: *Defender. Elite.*
- **Rules Text**:
  > Retaliate 2. Toughness.
  > **When Revealed**: Resolve the **"When Revealed"** ability of the topmost treachery in the encounter discard pile.
- **Flavor**: *"You're in a world of trouble now."*
- **Image Asset**: `assets/card-art/bundles/cards/57065.png` (710×1030 px, 278.2 KB)

### [57066] Crescent Dart
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Moon Knight (2–3/5, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Moon Knight Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Moon Knight. Otherwise, attach to the enemy leader.
  > [star] **Forced Interrupt**: When attached character attacks, this attack gains piercing and ranged. Discard this card after this attack.
- **Image Asset**: `assets/card-art/bundles/cards/57066.png` (710×1030 px, 303.4 KB)

### [57067] Fist of Khonshu
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Moon Knight (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Moon Knight Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Exhaust your identity and deal 2 damage to it.
  >
  > ---
  >
  > [star] **Boost**: Exhaust your identity.
- **Flavor**: *"I am the Fist of Khonshu! I am vengeance!" —Moon Knight*
- **Image Asset**: `assets/card-art/bundles/cards/57067.jpg` (710×1030 px, 247.0 KB)

### [57068] Khonshu's Avatar
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Moon Knight (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Moon Knight Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: Discard cards from the top of the encounter deck until a treachery is discarded. Resolve that card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/57068.jpg` (1030×710 px, 260.6 KB)


### Set: Royal Guard

### [57069] Janus
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Royal Guard (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Royal Guard Set Icon (printed bottom-right next to deck number)
- **Traits**: *Atlantis.*
- **Rules Text**:
  > **When Revealed**: If you have the [[Hunted]] trait, Janus activates against you. Otherwise, discard the top 2 cards of your deck.
- **Flavor**: *"No one escapes the Atlantean royal guard!"*
- **Image Asset**: `assets/card-art/bundles/cards/57069.png` (710×1030 px, 271.5 KB)

### [57070] Amir
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Royal Guard (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Royal Guard Set Icon (printed bottom-right next to deck number)
- **Traits**: *Atlantis.*
- **Rules Text**:
  > **When Revealed**: If you have the [[Hunted]] trait, Amir activates against you. Otherwise, discard the top 2 cards of your deck.
- **Flavor**: *"My lord, Namor, has ordered you brought before him."*
- **Image Asset**: `assets/card-art/bundles/cards/57070.jpg` (710×1030 px, 274.8 KB)

### [57071] Atlanteans
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Royal Guard (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Royal Guard Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top 3 cards of your deck. If you are in:
  > • Alter-ego form, place 1 threat on the main scheme for each different card type discarded this way.
  > • Hero form, take 1 indirect damage for each different card type discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/57071.png` (710×1030 px, 310.7 KB)

### [57072] Blood Debt
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Royal Guard (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Royal Guard Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > You gain the [[Hunted]] trait.
  > **Alter-Ego Action**: Discard the top 8 cards of your deck → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/57072.png` (710×1030 px, 240.6 KB)

### [57073] The Royal Guard
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Synthezoid Smackdown (`synthezoid`)
- **Deck / Set**: Royal Guard (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Royal Guard Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: The enemy team searches the encounter deck and discard pile for a copy of Blood Debt and deals it to the player who defeated this scheme as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/57073.jpg` (1030×710 px, 310.0 KB)


