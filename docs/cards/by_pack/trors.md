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
| `04001a` | Hawkeye | Hero | Hawkeye | THW:1 ATK:2 DEF:1 HP:9 | - | `trors` |
| `04001b` | Clint Barton | Alter-Ego | Hawkeye | HP:9 | - | `trors` |
| `04002` | Hawkeye's Bow | Upgrade | Hawkeye | - | - | `trors` |
| `04003` | Hawkeye's Quiver | Upgrade | Hawkeye | - | - | `trors` |
| `04004` | Mockingbird | Ally | Hawkeye | THW:2 ATK:2 HP:3 | - | `trors` |
| `04005` | Sonic Arrow | Event | Hawkeye | - | - | `trors` |
| `04006` | Explosive Arrow | Event | Hawkeye | - | - | `trors` |
| `04007` | Electric Arrow | Event | Hawkeye | - | - | `trors` |
| `04008` | Cable Arrow | Event | Hawkeye | - | - | `trors` |
| `04009` | Vibranium Arrow | Event | Hawkeye | - | - | `trors` |
| `04010` | Expert Marksman | Upgrade | Hawkeye | - | - | `trors` |
| `04011` | Hawkeye | Ally | Pack Position: 11 | THW:1 ATK:2 HP:2 | - | `trors` |
| `04012` | Black Knight | Ally | Pack Position: 12 | THW:1 ATK:2 HP:3 | - | `trors` |
| `04013` | Goliath | Ally | Pack Position: 13 | THW:2 ATK:1 HP:4 | - | `trors` |
| `04014` | U.S. Agent | Ally | Pack Position: 14 | THW:1 ATK:1 HP:5 | - | `trors` |
| `04015` | Sky Cycle | Upgrade | Pack Position: 15 | - | - | `trors` |
| `04016` | Team Training | Support | Pack Position: 16 | - | - | `trors` |
| `04017` | Ready for Action | Event | Pack Position: 17 | - | - | `trors` |
| `04018` | Lead from the Front | Event | Pack Position: 18 | - | - | `trors` |
| `04019` | The Power of Leadership | Resource | Pack Position: 19 | - | - | `trors` |
| `04020` | War Machine | Ally | Pack Position: 20 | THW:2 ATK:2 HP:3 | - | `trors` |
| `04021` | Avengers Tower | Support | Pack Position: 21 | - | - | `trors` |
| `04022` | Earth's Mightiest Heroes | Event | Pack Position: 22 | - | - | `trors` |
| `04023` | Energy | Resource | Pack Position: 23 | - | - | `trors` |
| `04024` | Genius | Resource | Pack Position: 24 | - | - | `trors` |
| `04025` | Strength | Resource | Pack Position: 25 | - | - | `trors` |
| `04026` | Criminal Past | Obligation | Hawkeye | - | 2 pips | `trors` |
| `04027` | Crossfire | Minion | Hawkeye Nemesis | SCH:1 ATK:2 HP:4 | Star | `trors` |
| `04028` | Marked for Death | Side Scheme | Hawkeye Nemesis | - | 3 pips | `trors` |
| `04029` | Crossfire's Rifle | Attachment | Hawkeye Nemesis | ATK:2 | 2 pips | `trors` |
| `04030` | Sniper Shot | Treachery | Hawkeye Nemesis | - | 1 pips | `trors` |
| `04031a` | Spider-Woman | Hero | Spider-Woman | THW:1 ATK:1 DEF:1 HP:11 | - | `trors` |
| `04031b` | Jessica Drew | Alter-Ego | Spider-Woman | HP:11 | - | `trors` |
| `04032` | Captain Marvel | Ally | Spider-Woman | THW:2 ATK:2 HP:3 | - | `trors` |
| `04033` | Finesse | Upgrade | Spider-Woman | - | - | `trors` |
| `04034` | Jessica Drew's Apartment | Support | Spider-Woman | - | - | `trors` |
| `04035` | Venom Blast | Event | Spider-Woman | - | - | `trors` |
| `04036` | Pheromones | Event | Spider-Woman | - | - | `trors` |
| `04037` | Contaminant Immunity | Event | Spider-Woman | - | - | `trors` |
| `04038` | Inconspicuous | Event | Spider-Woman | - | - | `trors` |
| `04039` | Self-Propelled Glide | Event | Spider-Woman | - | - | `trors` |
| `04040` | Spider-Girl | Ally | Pack Position: 40 | THW:1 ATK:2 HP:2 | - | `trors` |
| `04041` | Combat Training | Upgrade | Pack Position: 41 | - | - | `trors` |
| `04042` | Tac Team | Support | Pack Position: 42 | - | - | `trors` |
| `04043` | Press the Advantage | Event | Pack Position: 43 | - | - | `trors` |
| `04044` | Piercing Strike | Event | Pack Position: 44 | - | - | `trors` |
| `04045` | Spider-Man | Ally | Pack Position: 45 | THW:2 ATK:2 HP:4 | - | `trors` |
| `04046` | Heroic Intuition | Upgrade | Pack Position: 46 | - | - | `trors` |
| `04047` | Skilled Investigator | Upgrade | Pack Position: 47 | - | - | `trors` |
| `04048` | Interrogation Room | Support | Pack Position: 48 | - | - | `trors` |
| `04049` | Clear the Area | Event | Pack Position: 49 | - | - | `trors` |
| `04050` | Energy | Resource | Pack Position: 50 | - | - | `trors` |
| `04051` | Genius | Resource | Pack Position: 51 | - | - | `trors` |
| `04052` | Strength | Resource | Pack Position: 52 | - | - | `trors` |
| `04053` | Uncertain Loyalties | Obligation | Spider-Woman | - | 2 pips | `trors` |
| `04054` | The Viper | Minion | Spider-Woman Nemesis | SCH:2 ATK:2 HP:5 | 3 pips | `trors` |
| `04055` | The Viper's Ambition | Side Scheme | Spider-Woman Nemesis | - | 2 pips | `trors` |
| `04056` | Hydra Regular | Minion | Spider-Woman Nemesis | SCH:1 ATK:2 HP:2 | 2 pips | `trors` |
| `04057` | Hail Hydra! | Treachery | Spider-Woman Nemesis | - | 2 pips | `trors` |
| `04058` | Crossbones | Villain | Crossbones | SCH:1 ATK:1 HP:12 | - | `trors` |
| `04059` | Crossbones | Villain | Crossbones | SCH:2 ATK:2 HP:14 | - | `trors` |
| `04060` | Crossbones | Villain | Crossbones | SCH:2 ATK:3 HP:16 | - | `trors` |
| `04061` | Attack on Mount Athena | Main Scheme | Crossbones | - | - | `trors` |
| `04061a` | Attack on Mount Athena | Main Scheme | Crossbones | - | - | `trors` |
| `04061b` | Attack on Mount Athena | Main Scheme | Crossbones | - | - | `trors` |
| `04062` | The Infinity Stone | Main Scheme | Crossbones | - | - | `trors` |
| `04062a` | The Infinity Stone. | Main Scheme | Crossbones | - | - | `trors` |
| `04062b` | The Infinity Stone | Main Scheme | Crossbones | - | - | `trors` |
| `04063` | The Getaway | Main Scheme | Crossbones | - | - | `trors` |
| `04063a` | The Getaway | Main Scheme | Crossbones | - | - | `trors` |
| `04063b` | The Getaway | Main Scheme | Crossbones | - | - | `trors` |
| `04064` | Crossbones' Machine Gun | Attachment | Crossbones | ATK:0 | 3 pips | `trors` |
| `04065` | Crossbones' Armor | Attachment | Crossbones | SCH:1 ATK:1 | 3 pips | `trors` |
| `04066` | Hydra Bomber | Minion | Crossbones | SCH:1 ATK:1 HP:2 | 1 pips | `trors` |
| `04067` | Full Auto | Treachery | Crossbones | - | 2 pips | `trors` |
| `04068` | Hard as Nails | Treachery | Crossbones | - | Star | `trors` |
| `04069` | Raid the Armory | Treachery | Crossbones | - | 1 pips | `trors` |
| `04070` | Crossbones' Assault | Side Scheme | Crossbones | - | 2 pips | `trors` |
| `04071` | Cornered Staff | Side Scheme | Crossbones | - | 2 pips | `trors` |
| `04072` | Laser Rifle | Attachment | Experimental Weapons | ATK:1 | 2 pips | `trors` |
| `04073` | Energy Shield | Attachment | Experimental Weapons | - | 2 pips | `trors` |
| `04074` | Power Gauntlets | Attachment | Experimental Weapons | ATK:0 | 2 pips | `trors` |
| `04075` | Exo-Suit | Attachment | Experimental Weapons | SCH:1 ATK:1 | 2 pips | `trors` |
| `04076` | Absorbing Man | Villain | Absorbing Man | SCH:1 ATK:2 HP:14 | - | `trors` |
| `04077` | Absorbing Man | Villain | Absorbing Man | SCH:2 ATK:2 HP:15 | - | `trors` |
| `04078` | Absorbing Man | Villain | Absorbing Man | SCH:2 ATK:3 HP:16 | - | `trors` |
| `04079` | None Shall Pass | Main Scheme | Absorbing Man | - | - | `trors` |
| `04079a` | None Shall Pass | Main Scheme | Absorbing Man | - | - | `trors` |
| `04079b` | None Shall Pass | Main Scheme | Absorbing Man | - | - | `trors` |
| `04080` | Dense Forest | Environment | Absorbing Man | - | Star | `trors` |
| `04081` | Snowy Hillside | Environment | Absorbing Man | - | Star | `trors` |
| `04082` | Rocky Outcrop | Environment | Absorbing Man | - | Star | `trors` |
| `04083` | Abandoned Facility | Environment | Absorbing Man | - | Star | `trors` |
| `04084` | Ball and Chain | Attachment | Absorbing Man | SCH:1 ATK:1 | Star | `trors` |
| `04085` | Stall Tactics | Treachery | Absorbing Man | - | Star | `trors` |
| `04086` | Swinging Stone | Treachery | Absorbing Man | - | 1 pips | `trors` |
| `04087` | Steel Kick | Treachery | Absorbing Man | - | 2 pips | `trors` |
| `04088` | Piercing Thorns | Treachery | Absorbing Man | - | 1 pips | `trors` |
| `04089` | Omni-Morph Duplication | Treachery | Absorbing Man | - | 1 pips | `trors` |
| `04090` | Icy Grip | Treachery | Absorbing Man | - | 2 pips | `trors` |
| `04091` | Avalanche! | Side Scheme | Absorbing Man | - | 3 pips | `trors` |
| `04092` | Super Absorbing Power | Side Scheme | Absorbing Man | - | Star | `trors` |
| `04093` | Taskmaster | Villain | Taskmaster | SCH:1 ATK:2 HP:13 | - | `trors` |
| `04094` | Taskmaster | Villain | Taskmaster | SCH:2 ATK:2 HP:16 | - | `trors` |
| `04095` | Taskmaster | Villain | Taskmaster | SCH:3 ATK:3 HP:17 | - | `trors` |
| `04096` | Hunting Down Heroes | Main Scheme | Taskmaster | - | - | `trors` |
| `04096a` | Hunting Down Heroes | Main Scheme | Taskmaster | - | - | `trors` |
| `04096b` | Hunting Down Heroes | Main Scheme | Taskmaster | - | - | `trors` |
| `04097` | Moon Knight | Ally | Taskmaster | THW:2 ATK:2 HP:3 | - | `trors` |
| `04098` | Shang-Chi | Ally | Taskmaster | THW:2 ATK:2 HP:3 | - | `trors` |
| `10098` | Shang-Chi | Ally | Taskmaster | THW:2 ATK:2 HP:3 | - | `trors` |
| `04099` | White Tiger | Ally | Taskmaster | THW:3 ATK:1 HP:3 | - | `trors` |
| `04100` | Elektra | Ally | Taskmaster | THW:1 ATK:3 HP:3 | - | `trors` |
| `04101` | Hydra Hunter | Minion | Taskmaster | SCH:2 ATK:2 HP:3 | Star | `trors` |
| `04102` | Taskmaster's Sword | Attachment | Taskmaster | ATK:1 | 3 pips | `trors` |
| `04103` | Taskmaster's Shield | Attachment | Taskmaster | - | 3 pips | `trors` |
| `04104` | Photographic Reflexes | Attachment | Taskmaster | - | 2 pips | `trors` |
| `04105` | Mimicry | Treachery | Taskmaster | - | 1 pips | `trors` |
| `04106` | Hunted by Hydra | Treachery | Taskmaster | - | 1 pips | `trors` |
| `04107` | Captured by Hydra | Side Scheme | Taskmaster | - | 2 pips | `trors` |
| `04108` | Taskmaster's Training Camp | Side Scheme | Taskmaster | - | 3 pips | `trors` |
| `04109` | Zola | Villain | Zola | SCH:2 ATK:1 HP:12 | - | `trors` |
| `04110` | Zola | Villain | Zola | SCH:2 ATK:2 HP:14 | - | `trors` |
| `04111` | Zola | Villain | Zola | SCH:3 ATK:2 HP:16 | - | `trors` |
| `04112` | The Island of Dr. Zola | Main Scheme | Zola | - | - | `trors` |
| `04112a` | The Island of Dr. Zola | Main Scheme | Zola | - | - | `trors` |
| `04112b` | The Island of Dr. Zola | Main Scheme | Zola | - | - | `trors` |
| `04113` | The Mad Doctor | Main Scheme | Zola | - | - | `trors` |
| `04113a` | The Mad Doctor | Main Scheme | Zola | - | - | `trors` |
| `04113b` | The Mad Doctor | Main Scheme | Zola | - | - | `trors` |
| `04114` | Ultimate Bio-Servant | Minion | Zola | SCH:1 ATK:1 HP:4 | Star | `trors` |
| `04115` | Zola's Mutate | Minion | Zola | SCH:1 ATK:2 HP:5 | Star | `trors` |
| `04116` | Berserk Mutate | Minion | Zola | SCH:0 ATK:2 HP:3 | Star | `trors` |
| `04117` | Defensive Programming | Attachment | Zola | - | 1 pips | `trors` |
| `04118` | Pain Inhibitors | Attachment | Zola | - | 1 pips | `trors` |
| `04119` | Neurological Implants | Attachment | Zola | SCH:2 ATK:2 | 1 pips | `trors` |
| `04120` | Mind Ray | Treachery | Zola | - | 2 pips | `trors` |
| `04121` | Technological Enhancements | Treachery | Zola | - | Star | `trors` |
| `04122` | Hydra Prison | Side Scheme | Zola | - | - | `trors` |
| `04123` | Test Subjects | Side Scheme | Zola | - | 2 pips | `trors` |
| `04124` | Zola's Experiments | Side Scheme | Zola | - | 3 pips | `trors` |
| `04125` | Red Skull | Villain | Red Skull | SCH:2 ATK:0 HP:12 | - | `trors` |
| `04126` | Red Skull | Villain | Red Skull | SCH:3 ATK:1 HP:16 | - | `trors` |
| `04127` | Red Skull | Villain | Red Skull | SCH:3 ATK:2 HP:20 | - | `trors` |
| `04128` | The Rise of the Red Skull | Main Scheme | Red Skull | - | - | `trors` |
| `04128a` | The Rise of Red Skull | Main Scheme | Red Skull | - | - | `trors` |
| `04128b` | The Rise of Red Skull | Main Scheme | Red Skull | - | - | `trors` |
| `04129` | New World Hydra | Main Scheme | Red Skull | - | - | `trors` |
| `04129a` | New World Hydra | Main Scheme | Red Skull | - | - | `trors` |
| `04129b` | New World Hydra | Main Scheme | Red Skull | - | - | `trors` |
| `04130` | The Sleeper | Minion | Red Skull | SCH:1 ATK:3 HP:5 | 1 pips | `trors` |
| `04131` | Hydra Exo-Soldier | Minion | Red Skull | SCH:2 ATK:2 HP:5 | Star | `trors` |
| `04132` | Red Skull's Luger | Attachment | Red Skull | SCH:1 ATK:1 | Star | `trors` |
| `04133` | Red Skull's Right Hook | Attachment | Red Skull | - | 3 pips | `trors` |
| `04134` | Master Strategist | Attachment | Red Skull | - | 2 pips | `trors` |
| `04135` | Twisted Reality | Attachment | Red Skull | - | 2 pips | `trors` |
| `04136` | Bitter Rival | Treachery | Red Skull | - | Star | `trors` |
| `04137` | Spreading Lies | Treachery | Red Skull | - | 1 pips | `trors` |
| `04138` | Infinite Power | Treachery | Red Skull | - | 2 pips | `trors` |
| `04139` | The Red House | Side Scheme | Red Skull | - | - | `trors` |
| `04140` | The Sleeper Awakened | Side Scheme | Red Skull | - | - | `trors` |
| `04141` | Prison Camps | Side Scheme | Red Skull | - | - | `trors` |
| `04142` | Censor the Past | Side Scheme | Red Skull | - | - | `trors` |
| `04143` | Hydra Reinforcements | Side Scheme | Red Skull | - | - | `trors` |
| `04144` | Mass Chaos | Side Scheme | Red Skull | - | - | `trors` |
| `04145` | Hydra Flame-Soldier | Minion | Hydra Assault | SCH:1 ATK:1 HP:4 | Star | `trors` |
| `04146` | Hydra Jet-Trooper | Minion | Hydra Assault | SCH:0 ATK:2 HP:3 | Star | `trors` |
| `04147` | Hail Hydra! | Treachery | Hydra Assault | - | 2 pips | `trors` |
| `04148` | Combat Knife | Attachment | Weapon Master | ATK:1 | 1 pips | `trors` |
| `04149` | Hydra Sidearm | Attachment | Weapon Master | ATK:1 | 2 pips | `trors` |
| `04150` | Weapon Master | Treachery | Weapon Master | - | 1 pips | `trors` |
| `04151` | Concussion Grenade | Treachery | Weapon Master | - | 1 pips | `trors` |
| `04152` | Hydra Regular | Minion | Hydra Patrol | SCH:1 ATK:2 HP:2 | 2 pips | `trors` |
| `04153` | Hydra Soldier | Minion | Hydra Patrol | SCH:1 ATK:2 HP:4 | 1 pips | `trors` |
| `04154` | Hydra Patrol | Side Scheme | Hydra Patrol | - | 2 pips | `trors` |
| `04155` | Adrenal Stims | Upgrade | Hydra Campaign | - | - | `trors` |
| `04156` | Tactical Scanner | Upgrade | Hydra Campaign | - | - | `trors` |
| `04157` | Emergency Teleporter | Upgrade | Hydra Campaign | - | - | `trors` |
| `04158` | Laser Cannon | Upgrade | Hydra Campaign | - | - | `trors` |
| `04159a` | Basic Thwart Upgrade | Upgrade | Hydra Campaign | - | - | `trors` |
| `04159b` | Improved Thwart Upgrade | Upgrade | Hydra Campaign | - | - | `trors` |
| `04160a` | Basic Attack Upgrade | Upgrade | Hydra Campaign | - | - | `trors` |
| `04160b` | Improved Attack Upgrade | Upgrade | Hydra Campaign | - | - | `trors` |
| `04161a` | Basic Defense Upgrade | Upgrade | Hydra Campaign | - | - | `trors` |
| `04161b` | Improved Defense Upgrade | Upgrade | Hydra Campaign | - | - | `trors` |
| `04162a` | Basic Recovery Upgrade | Upgrade | Hydra Campaign | - | - | `trors` |
| `04162b` | Improved Recovery Upgrade | Upgrade | Hydra Campaign | - | - | `trors` |
| `04163` | Zola's Algorithm | Obligation | Expert Campaign | - | - | `trors` |
| `04164` | Medical Emergency | Obligation | Expert Campaign | - | - | `trors` |
| `04165` | Martial Law | Obligation | Expert Campaign | - | - | `trors` |
| `04166` | Anti-Hero Propaganda | Obligation | Expert Campaign | - | - | `trors` |

---

## Pack: The Rise of Red Skull (`trors`)

### Set: Hawkeye

### [04001a] Hawkeye
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 1, **HP**: 9, **Hand Size**: 5
- **Traits**: *Avenger.*
- **Rules Text**:
  > "Quick Draw" — **Action**: Exhaust Hawkeye → ready Hawkeye's bow.
- **Flavor**: *"I may not be the mightiest Avenger, but I'm definitely the coolest."*
- **Image Asset**: `assets/card-art/bundles/cards/04001a.png` (300×418 px, 238.5 KB)
### [04001b] Clint Barton
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Weapon of Choice — **Action**: Spend 1 resource of any type → search your deck and discard pile for Hawkeye's Bow and add it to your hand. Shuffle your deck. (Limit once per phase).
- **Image Asset**: `assets/card-art/bundles/cards/04001b.png` (300×419 px, 38.4 KB)
### [04002] Hawkeye's Bow
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted.
  > Your hero gets +1 ATK and each of your [[Arrow]] attacks gain ranged.
- **Image Asset**: `assets/card-art/bundles/cards/04002.png` (300×419 px, 38.0 KB)
### [04003] Hawkeye's Quiver
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Item.*
- **Rules Text**:
  > You may play [[Arrow]] events attached to this card as if they were in your hand.
  > **Hero Action**: Exhaust Hawkeye's Quiver → search the top 5 cards of your deck for an [[Arrow]] event and attach it faceup to this card.
- **Image Asset**: `assets/card-art/bundles/cards/04003.png` (300×419 px, 40.7 KB)
### [04004] Mockingbird — *Bobbi Morse*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Avenger. S.H.I.E.L.D.*
- **Rules Text**:
  > **Interrupt**: When the villain initiates an attack against you, spend 1 resource of any type and return Mockingbird to your hand → prevent all damage from this attack.
- **Flavor**: *"Is that all you got?"*
- **Image Asset**: `assets/card-art/bundles/cards/04004.png` (300×419 px, 37.8 KB)
### [04005] Sonic Arrow
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (4–5/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Arrow. Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust Hawkeye's Bow → confuse an enemy and deal 3 damage to it (5 damage instead if it is already confused)
- **Flavor**: *EEEEEEEEEEEEEEEEEE!!!*
- **Image Asset**: `assets/card-art/bundles/cards/04005.png` (300×419 px, 34.6 KB)
### [04006] Explosive Arrow
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (6–7/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Arrow.*
- **Rules Text**:
  > **Hero Action**: Exhaust Hawkeye's Bow and choose a player → deal 3 damage to the villain and each minion engaged with that player.
- **Flavor**: *"Anyone ever tell you how your eyes sparkle when you're angry?" —Clint Barton*
- **Image Asset**: `assets/card-art/bundles/cards/04006.png` (300×419 px, 40.1 KB)
### [04007] Electric Arrow
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (8–9/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Arrow. Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust Hawkeye's Bow → stun an enemy and deal 3 damage to it (5 damage instead if it is already stunned).
- **Flavor**: *"Hail Hawkeye!" —Clint Barton*
- **Image Asset**: `assets/card-art/bundles/cards/04007.png` (300×419 px, 36.9 KB)
### [04008] Cable Arrow
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (10–11/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Arrow. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Exhaust Hawkeye's Bow → remove 3 threat from a scheme, ignoring any crisis icons in play.
- **Flavor**: *"It's a great way to get around." —Clint Barton*
- **Image Asset**: `assets/card-art/bundles/cards/04008.png` (300×419 px, 36.1 KB)
### [04009] Vibranium Arrow
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (12–13/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Arrow. Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust Hawkeye's Bow → deal 6 damage to an enemy. This attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/04009.png` (300×419 px, 41.3 KB)
### [04010] Expert Marksman
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (14–15/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Resource**: Exhaust Expert Marksman → generate a [wild] resource for an [[Arrow]] event.
- **Flavor**: *"When you fight alongside gods and monsters, it's not enough to be great; you have to the best." —Clint Barton*
- **Image Asset**: `assets/card-art/bundles/cards/04010.png` (300×419 px, 37.5 KB)
### [04026] Criminal Past
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hawkeye Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Clint Barton Player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Clint Barton → remove this card from the game.
  > • Discard Hawkeye's Bow from play. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/04026.png` (300×419 px, 33.4 KB)

### Set: Leadership

### [04011] Hawkeye — *Kate Bishop*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [physical]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Action**: Exhaust this ally and discard 1 card from your hand → deal X damage to an enemy, where X is the number of printed resources on that card.
- **Flavor**: *"You see I', literally pointing arrows at your, right?."*
- **Image Asset**: `assets/card-art/bundles/cards/04011.png` (300×419 px, 38.4 KB)
### [04012] Black Knight — *Dane Whitman*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Avenger.*
- **Rules Text**:
  > [star] Black Knight's basic attack gains piercing.
- **Flavor**: *"As long as the Black Blade blazes darkly in my hand, I must fight on."*
- **Image Asset**: `assets/card-art/bundles/cards/04012.png` (300×419 px, 38.7 KB)
### [04013] Goliath — *Bill Foster*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 2), **HP**: 4, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Action**: Goliath gets +4 ATK until the end of the phase. At the end of the phase, discard Goliath. (Max once per phase.)
- **Flavor**: *"Sometimes being a gentleman means holding the door, and the rest of the building."*
- **Image Asset**: `assets/card-art/bundles/cards/04013.png` (300×419 px, 39.2 KB)
### [04014] U.S. Agent — *John Walker*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 5, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Retaliate 1.
- **Flavor**: *"Cap isn't the only soldier who loves his country."*
- **Image Asset**: `assets/card-art/bundles/cards/04014.png` (300×419 px, 33.8 KB)
### [04015] Sky Cycle
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Vehicle.*
- **Rules Text**:
  > Attach to an [[Avenger]] ally. Max 1 per ally.
  > Attached ally gains [[Aerial]].
  > **Action**: Exhaust Sky Cycle → ready attached ally.
- **Image Asset**: `assets/card-art/bundles/cards/04015.png` (300×419 px, 39.0 KB)
### [04016] Team Training
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Each ally you control gets +1 hit point.
- **Flavor**: *"We mostly just wait for Cap to yell 'Avengers Assemble' and attack in the same direction as him" —Clint Barton*
- **Image Asset**: `assets/card-art/bundles/cards/04016.png` (300×419 px, 36.4 KB)
### [04017] Ready for Action
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Give an ally you control a tough status card.
- **Flavor**: *"Try that again. I dare you." —Jessica Drew*
- **Image Asset**: `assets/card-art/bundles/cards/04017.png` (300×419 px, 32.7 KB)
### [04018] Lead from the Front
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Choose a player. Each character that player controls gets +1 THW and +1 ATK until the end of the phase.
- **Flavor**: *"Let's go everyone!" —Carol Danvers*
### [04019] The Power of Leadership
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Leadership *(blue)* card.

### Set: Basic

### [04020] War Machine — *James Rhodes*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Avenger. S.H.I.E.L.D.*
- **Rules Text**:
  > Toughness. *(This character enters play with a tough status card.)*
  > [star] War Machine's basic attack gains ranged. *(Ranged attacks ignore retaliate.)*
- **Image Asset**: `assets/card-art/bundles/cards/04020.png` (300×419 px, 37.8 KB)
### [04021] Avengers Tower
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > If each of your allies has the [[Avenger]] trait, increase your ally limit by 1.
  > **Action:** Exhaust Avengers Tower → reduce the cost of the next [[Avenger]] ally played this phase by 1.
### [04022] Earth's Mightiest Heroes
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Hero Action**: Exhaust an [[avenger]] character you control → ready another [[avenger]] character you control.
- **Flavor**: *"We come together to fight what can't be fought alone." —Luke Cage*
- **Image Asset**: `assets/card-art/bundles/cards/04022.png` (300×419 px, 41.3 KB)
### [04023] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [04024] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [04025] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [04050] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [04051] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [04052] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### Set: Hawkeye Nemesis

### [04027] Crossfire
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hawkeye Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mercenary.*
- **Rules Text**:
  > Quickstrike.
  > Crossfire's attacks gain piercing.
  >
  > ---
  >
  > [star] **Boost**: If this boost resolves during an attack, the attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/04027.png` (300×419 px, 40.9 KB)
### [04028] Marked for Death
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye Nemesis (2/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hawkeye Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: The Clint Barton player searches their hand, deck, discard pile, and play area for Mockingbird and places her faceup beneath this card. When this scheme is defeated, return Mockingbird to her owner's hand.
- **Image Asset**: `assets/card-art/bundles/cards/04028.png` (419×300 px, 43.1 KB)
### [04029] Crossfire's Rifle
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye Nemesis (3/5)
- **Properties**: Unique
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hawkeye Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Crossfire. Otherwise, attach to the villain.
  > [star] When attached enemy attacks, the attack gains ranged.
  > **Hero Action**: Exhaust your hero and spend a [wild] resource → discard Crossfire's Rifle.
- **Image Asset**: `assets/card-art/bundles/cards/04029.png` (300×419 px, 38.6 KB)
### [04030] Sniper Shot
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hawkeye Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hawkeye Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Place 3 threat on the main scheme.
  > **When Revealed (Hero)**: Deal 3 damage to your hero.
- **Flavor**: *"I like to let them run a little before taking the shot." —Crossfire*
- **Image Asset**: `assets/card-art/bundles/cards/04030.png` (300×419 px, 34.5 KB)

### Set: Spider-Woman

### [04031a] Spider-Woman
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 1, **HP**: 11, **Hand Size**: 5
- **Traits**: *Avenger. Spy.*
- **Rules Text**:
  > "Superhuman Agility" — **Interrupt**: When you play an aspect card, Spider-Woman gets +1 THW, +1 ATK, and +1 DEF until the end of the round. (limit once per round for each aspect.)
- **Image Asset**: `assets/card-art/bundles/cards/04031a.png` (300×418 px, 227.2 KB)
### [04031b] Jessica Drew
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 11, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > Double Agent — Choose two aspects instead of one during deck-building. You must include an equal number of cards from those aspects in your deck.
  > **Action:**: Look at the top card of any deck. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/04031b.png` (300×418 px, 217.6 KB)
### [04032] Captain Marvel — *Carol Danvers*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After Captain Marvel uses a basic power, draw 1 card.
- **Flavor**: *"I gotta hand it to you, kid. This is one of the more impressive messes I've ever seen."*
- **Image Asset**: `assets/card-art/bundles/cards/04032.png` (300×419 px, 36.0 KB)
### [04033] Finesse
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (2–3/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Hero Resource**: Exhaust Finesse → generate a [wild] resource for an aspect card.
- **Flavor**: *"You don't yell'Avengers Assemble' every time we leave the house." —Jessica Drew*
- **Image Asset**: `assets/card-art/bundles/cards/04033.png` (300×419 px, 30.2 KB)
### [04034] Jessica Drew's Apartment
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (4/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Jessica Drew's Apartment → search the top 5 cards of your deck for an aspect card and add it to your hand. Shuffle your deck.
- **Image Asset**: `assets/card-art/bundles/cards/04034.png` (300×419 px, 39.2 KB)
### [04035] Venom Blast
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (5–6/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy.
- **Flavor**: *"She hit me with her venom blast when she thought I was a Skrull. Hurt for a week." —Wolverine*
- **Image Asset**: `assets/card-art/bundles/cards/04035.png` (300×419 px, 41.9 KB)
### [04036] Pheromones
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (7–8/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Stun and confuse an enemy.
- **Flavor**: *"Warn me before you use that power again, okay?" —Peter Parker*
- **Image Asset**: `assets/card-art/bundles/cards/04036.png` (300×419 px, 38.6 KB)
### [04037] Contaminant Immunity
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (9–10/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Heal 3 damage from Spider-Woman and give her a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/04037.png` (300×419 px, 33.7 KB)
### [04038] Inconspicuous
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (11–12/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Skill. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove a total of 3 threat from among schemes in play.
- **Flavor**: *"Now all I gotta do is Spy-der Woman my way inside." —Jessica Drew*
- **Image Asset**: `assets/card-art/bundles/cards/04038.png` (300×419 px, 38.0 KB)
### [04039] Self-Propelled Glide
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (13–15/15, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Ready Spider-Woman. She gains [[aerial]] until the end of the round.
- **Flavor**: *"People always think I can fly. I can't But I do glide really well." —Jessica Drew*
- **Image Asset**: `assets/card-art/bundles/cards/04039.png` (300×419 px, 37.9 KB)
### [04053] Uncertain Loyalties
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Woman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Jessica Drew Player.***
  > • Exhaust Jessica Drew → remove Uncertain Loyalties from the game.
  > • Place 3 threat on the main scheme. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/04053.png` (300×419 px, 38.5 KB)

### Set: Aggression

### [04040] Spider-Girl — *Anya Corazon*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 40
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After you play Spider-Girl from your hand, stun and confuse a minion.
- **Flavor**: *"Alright you bunch of losers. Who wants a piece of me?."*
- **Image Asset**: `assets/card-art/bundles/cards/04040.png` (300×419 px, 37.1 KB)
### [04041] Combat Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 41
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 ATK.
- **Flavor**: *"Tony! She did it again!" —Janet Van Dyne*
### [04042] Tac Team
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 42
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 attack counters). *(Enters play with 3 counters. When those are gone, discard this card)*
  > **Action**: Exhaust Tac Team and remove 1 attack counter from it → deal 2 damage to an enemy.
### [04043] Press the Advantage
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 43
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to an enemy. If that enemy is stunned or confused, draw 1 card.
- **Flavor**: *"You are in Wakanda now!" —T'Challa*
- **Image Asset**: `assets/card-art/bundles/cards/04043.png` (300×419 px, 37.5 KB)
### [04044] Piercing Strike
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 44
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. This attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/04044.png` (300×419 px, 35.9 KB)

### Set: Justice

### [04045] Spider-Man — *Peter Parker*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 45
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 4, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After you play Spider-Man from your hand, remove 3 [per_hero] threat from a side scheme.
- **Flavor**: *"Seriously, what is it with New York? Would it kill you to invade Denver once?."*
- **Image Asset**: `assets/card-art/bundles/cards/04045.png` (300×419 px, 40.5 KB)
### [04046] Heroic Intuition
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 46
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 THW.
### [04047] Skilled Investigator
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 47
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Hero Response**: After a side scheme is defeated, exhaust Skilled Investigator → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/04047.png` (300×419 px, 40.0 KB)
### [04048] Interrogation Room
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 48
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After you defeat a minion, exhaust Interrogation Room → remove 1 threat from a scheme.
- **Flavor**: *"Oh, she's sorry! Let me get the keys and call you a car service!" —Misty Knight*
### [04049] Clear the Area
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Pack Position: 49
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 2 threat from a scheme. If this removes the last threat on that scheme, draw 1 card.
- **Flavor**: *"Don't be scared, honey. Just think about how jealous the other kids will be when you tell them how Iron Man rescued you." —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/04049.png` (300×419 px, 38.7 KB)

### Set: Spider-Woman Nemesis

### [04054] The Viper
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Woman Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Hydra.*
- **Rules Text**:
  > While the Viper is engaged with you, your hand size is reduced by 1.
  > (Spider-Woman's nemesis minion.)
- **Flavor**: *"It's time for you to come home, Jessica."*
- **Image Asset**: `assets/card-art/bundles/cards/04054.png` (300×419 px, 40.3 KB)
### [04055] The Viper's Ambition
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman Nemesis (2/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Woman Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place an additional 1[per_hero] threat here.
- **Flavor**: *The Viper has given everything to Hydra in return for the promise of power.*
- **Image Asset**: `assets/card-art/bundles/cards/04055.png` (419×300 px, 36.2 KB)
### [04056] Hydra Regular
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Woman Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Incite 1. (When this card is revealed, place 1 threat on the main scheme.)
- **Flavor**: *"When you consider what kind of person would join a terrorist organization bent on world domination, it's easy to see why Hydra's troops don't impress." —Jessica Drew*
- **Image Asset**: `assets/card-art/bundles/cards/04056.png` (300×419 px, 42.0 KB)
### [04057] Hail Hydra!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Spider-Woman Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Woman Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[Hydra]] minion engaged with a hero attacks that hero. Each player who was not attacked this way searches the encounter deck and discard pile for a [[Hydra]] minion and puts it into play engaged with them. Shuffle the encounter deck if it was searched.
- **Image Asset**: `assets/card-art/bundles/cards/04057.png` (300×419 px, 49.4 KB)

### Set: Crossbones

### [04058] Crossbones
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (1/19)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Mercenary.*
- **Rules Text**:
  > [star] While Crossbones has a [[Weapon]] attachment, his attacks gain piercing. *(Discard any tough status cards from the target before dealing damage.)*
- **Flavor**: *"I consider myself a craftsman. I specialize in destruction and terror."*
- **Image Asset**: `assets/card-art/bundles/cards/04058.png` (300×419 px, 42.0 KB)
### [04059] Crossbones
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (2/19)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Mercenary.*
- **Rules Text**:
  > [star] While Crossbones has a [[Weapon]] attachment, his attacks gain piercing.
  > **When Revealed**: Search the encounter deck and discard pile for Crossbone's Machine Gun and attach it to Crossbones. Shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/04059.png` (300×419 px, 44.0 KB)
### [04060] Crossbones
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (3/19)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Mercenary.*
- **Rules Text**:
  > [star] While Crossbones has a [[Weapon]] attachment, his attacks gain piercing.
  > **When Revealed**: Reveal the top card of the Experimental Weapons deck.
- **Flavor**: *"Those super-powered types might have more strength, but none of them have my style."*
- **Image Asset**: `assets/card-art/bundles/cards/04060.png` (300×419 px, 43.6 KB)
### [04061] Attack on Mount Athena
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (4/19)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 3 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Crossbones is leading an army of Hydra soldiers in a direct assault on the Project P.E.G.A.S.U.S. facility in the Adirondack Mountains.*
- **Image Asset**: `assets/card-art/bundles/cards/04061.png` (419×300 px, 33.5 KB)
### [04061a] Attack on Mount Athena
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (4/19)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Crossbones (I) and Crossbones (II). Crossbones, Experimental Weapons, and Standard Encounter sets. Three modular sets *(Hydra Assault, Weapon Master, and Legions of Hydra).*
  > **Setup**: Create the Experimental Weapons deck and set it next to the main scheme deck. *(see rulebook page 5.)*
### [04061b] Attack on Mount Athena
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (4/19)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 3 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Crossbones is leading an army of Hydra soldiers in a direct assault on the Project P.E.G.A.S.U.S. facility in the Adirondack Mountains.*
### [04062] The Infinity Stone
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (5/19)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Reveal the top card of the Experimental Weapons deck.
- **Image Asset**: `assets/card-art/bundles/cards/04062.png` (419×300 px, 30.3 KB)
### [04062a] The Infinity Stone.
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (5/19)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Inside the Project P.E.G.A.S.U.S. facility, S.H.I.E.L.D. agents fight desperately to prevent Hydra from obtaining the Reality Stone stored within.*
### [04062b] The Infinity Stone
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (5/19)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Reveal the top card of the Experimental Weapons deck.
### [04063] The Getaway
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (6/19)
- **Properties**: Stage 3, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Reveal the top card of the Experimental Weapons deck.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/04063.png` (419×300 px, 31.0 KB)
### [04063a] The Getaway
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (6/19)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Hydra has seized the Infinity Stone, and Crossbones orders their withdrawal. You must stop them before they escape!*
### [04063b] The Getaway
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (6/19)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Reveal the top card of the Experimental Weapons deck.
  > **If this stage is completed, the players lose the game.**
### [04064] Crossbones' Machine Gun
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (7/19)
- **Properties**: Unique
- **Stats**: **ATK**: 0 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Crossbones. Uses (2[per_hero] ammo counters).
  > [star] **Forced Interrupt**: When Crossbones attacks you, remove 1 ammo counter from this card and discard the top card of the encounter deck → take indirect damage equal to the number of boost icons on the discarded card.
- **Image Asset**: `assets/card-art/bundles/cards/04064.png` (300×419 px, 41.4 KB)
### [04065] Crossbones' Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (8/19)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Crossbones.
  > **Forced Interrupt**: When Crossbones would take any amount of damage, place it here instead. If there is 5 or more damage here, discard Crossbones' Armor.
- **Flavor**: *"Bask in the glow, babe." —Crossbones*
- **Image Asset**: `assets/card-art/bundles/cards/04065.png` (300×419 px, 41.3 KB)
### [04066] Hydra Bomber
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (9–10/19, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > **When Revealed**: Choose to either take 2 damage or place 1 threat on the main scheme.
- **Flavor**: *"I know that if you cut off one head, two more will take its place. But what if it blows up instead?" —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/04066.png` (300×419 px, 36.0 KB)
### [04067] Full Auto
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (11–12/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Surge.
  > **When Revealed (Hero)**: Discard X cards from the top of the encounter deck, where X is Crossbones' ATK. Take 1 indirect damage for each boost icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/04067.png` (300×419 px, 40.9 KB)
### [04068] Hard as Nails
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (13–14/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give the villain a tough status card. If you cannot, heal 3 damage from it instead.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card. If you cannot, heal 3 damage from it instead.
- **Image Asset**: `assets/card-art/bundles/cards/04068.png` (300×419 px, 39.1 KB)
### [04069] Raid the Armory
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (15–16/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1. *(When this card is revealed place 1 threat on the main scheme.)*
  > **When Revealed**: Discard cards from the top of the encounter deck until a [[Weapon]] attachment is discarded. Reveal that card.
- **Image Asset**: `assets/card-art/bundles/cards/04069.png` (300×419 px, 36.4 KB)
### [04070] Crossbones' Assault
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (17–18/19, Qty: 2)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Crossbones activates against the player who defeated this scheme.
- **Flavor**: *Crossbones is a heartless killer, but he's not a psychopath. His assault on P.E.G.A.S.U.S. is ruthless and efficient.*
- **Image Asset**: `assets/card-art/bundles/cards/04070.png` (419×300 px, 33.1 KB)
### [04071] Cornered Staff
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Crossbones (19/19)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Crossbones Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Discard 1[per_hero] cards from the top of the encounter deck. Place 1 additional threat here for each boost icon discarded this way.
- **Flavor**: *Hydra is rounding up P.E.G.A.S.U.S. staff to hold as hostages.*
- **Image Asset**: `assets/card-art/bundles/cards/04071.png` (419×300 px, 38.5 KB)

### Set: Experimental Weapons

### [04072] Laser Rifle
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Experimental Weapons (1/4)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Experimental Weapons Set Icon (printed bottom-right next to deck number)
- **Traits**: *Experimental. Weapon.*
- **Rules Text**:
  > Attach to the Villain.
  > [star] **Forced Interrupt**: When attached villain attacks, the attack gains ranged.
  > **Hero Action**: Spend [energy][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/04072.png` (300×419 px, 32.3 KB)
### [04073] Energy Shield
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Experimental Weapons (2/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Experimental Weapons Set Icon (printed bottom-right next to deck number)
- **Traits**: *Experimental. Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > Attached villain gains retaliate 1.
  > **Hero Action**: Spend [energy][mental] resources → discard this card.
- **Flavor**: *"You're never going to convince Cap that an energy shield is as good as his old frisbee." —Carol Danvers*
- **Image Asset**: `assets/card-art/bundles/cards/04073.png` (300×419 px, 39.3 KB)
### [04074] Power Gauntlets
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Experimental Weapons (3/4)
- **Stats**: **ATK**: 0 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Experimental Weapons Set Icon (printed bottom-right next to deck number)
- **Traits**: *Experimental. Weapon.*
- **Rules Text**:
  > Attach to the Villain.
  > [star] **Forced Response**: After the attached villain attacks and damages you, discard 1 card from your hand.
  > **Hero Action**: Spend [mental][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/04074.png` (300×419 px, 37.9 KB)
### [04075] Exo-Suit
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Experimental Weapons (4/4)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Experimental Weapons Set Icon (printed bottom-right next to deck number)
- **Traits**: *Experimental. Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > **Hero Action**: Spend [energy][mental][physical] resources → discard this card.
- **Flavor**: *"I never should have shared my tech with S.H.I.E.L.D." —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/04075.png` (300×419 px, 38.0 KB)

### Set: Absorbing Man

### [04076] Absorbing Man
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (1/25)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > Absorbing Man gains the trait of each environment in play.
- **Flavor**: *"You know I beat Thor once? Picture that: Crusher Creel standing over the God of Thunder, and you think you scare me?"*
- **Image Asset**: `assets/card-art/bundles/cards/04076.png` (300×419 px, 39.1 KB)
### [04077] Absorbing Man
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (2/25)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > Absorbing Man gains the trait of each environment in play.
  > **When Revealed**: If Super Absorbing Power is in play, deal 1 encounter card to each player. Otherwise, search the encounter deck and discard pile for Super Absorbing Power and reveal it. Shuffle the encounter deck if it was searched this way.
- **Image Asset**: `assets/card-art/bundles/cards/04077.png` (300×419 px, 42.8 KB)
### [04078] Absorbing Man
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (3/25)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2 [star], **ATK**: 3 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > Absorbing Man gains the trait of each environment in play.
  > [star] **Forced Response**: After Absorbing Man activates against you, if he has the:
  > • [[Ice]] or [[Stone]] trait, place 1 threat on the main scheme.
  > • [[Metal]] or [[Wood]] trait, take 1 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/04078.png` (300×419 px, 40.7 KB)
### [04079] None Shall Pass
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (4/25)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, place 1 delay counter here.
  > **Forced Interrupt**: When an environment enters play, discard each other environment card in play.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/04079.png` (419×300 px, 40.4 KB)
### [04079a] None Shall Pass
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (4/25)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Absorbing Man (I) and Absorbing Man (II). Absorbing Man and Standard encounter sets. One modular encounter set *(Hydra Patrol).*
  > **Setup**: Discard cards from the encounter deck until an environment is discarded. Put that card into play and shuffle the encounter discard pile into the encounter deck.
### [04079b] None Shall Pass
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (4/25)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, place 1 delay counter here.
  > **Forced Interrupt**: When an environment enters play, discard each other environment card in play.
  > **If this stage is completed, the players lose the game.**
### [04080] Dense Forest
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (5/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wood.*
- **Rules Text**:
  > Surge.
  > **Forced Response**: After Absorbing Man makes an undefended attack against you, take 1 indirect damage (2 indirect damage instead if there are 5 or more delay counters on the main scheme).
  >
  > ---
  >
  > [star] **Boost**: Put this card into play.
- **Image Asset**: `assets/card-art/bundles/cards/04080.png` (300×419 px, 42.5 KB)
### [04081] Snowy Hillside
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (6/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Ice.*
- **Rules Text**:
  > Surge.
  > **Forced Response**: After Absorbing Man makes an undefended attack against you, place 1 threat on the main scheme (2 threat instead if there are 5 or more delay counters on the main scheme).
  >
  > ---
  >
  > [star] **Boost**: Put this card into play.
- **Image Asset**: `assets/card-art/bundles/cards/04081.png` (300×419 px, 36.5 KB)
### [04082] Rocky Outcrop
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (7/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Stone.*
- **Rules Text**:
  > Surge.
  > **Forced Response**: After Absorbing Man makes an undefended attack against you, heal 1 damage from him (2 damage instead if there are 5 or more delay counters on the main scheme).
  >
  > ---
  >
  > [star] **Boost**: Put this card into play.
- **Image Asset**: `assets/card-art/bundles/cards/04082.png` (300×419 px, 39.2 KB)
### [04083] Abandoned Facility
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (8/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Metal.*
- **Rules Text**:
  > Surge.
  > **Forced Response**: After Absorbing Man makes an undefended attack against you, discard 1 resource icon from your hand (2 resources instead if there are 5 or more delay counters on the main scheme).
  >
  > ---
  >
  > [star] **Boost**: Put this card into play.
- **Image Asset**: `assets/card-art/bundles/cards/04083.png` (300×419 px, 38.8 KB)
### [04084] Ball and Chain
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (9/25)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Absorbing Man.
  > **Hero Action**: Spend a [physical] resource → shuffle this card into the encounter deck.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/04084.png` (300×419 px, 39.9 KB)
### [04085] Stall Tactics
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (10–11/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 1 threat on the main scheme for every 2 delay counters on the main scheme. If no threat was placed this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If there are 5 or more delay counters on the main scheme, take 1 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/04085.png` (300×419 px, 42.4 KB)
### [04086] Swinging Stone
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (12–13/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Absorbing Man schemes. If Absorbing Man has the [[Stone]] trait, he gets +1 SCH for this activation.
  > **When Revealed (Hero)**: Absorbing Man attacks you. If Absorbing Man has the [[Stone]] trait, he gets +1 ATK for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/04086.png` (300×419 px, 42.0 KB)
### [04087] Steel Kick
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (14–15/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Place 2 threat on the main scheme (3 threat instead if Absorbing Man has the [[Metal]] trait.)
  > **When Revealed (Hero)**: Take 3 indirect damage (4 indirect damage instead if Absorbing Man has the [[Metal]] trait.)
- **Image Asset**: `assets/card-art/bundles/cards/04087.png` (300×419 px, 41.9 KB)
### [04088] Piercing Thorns
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (16–17/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1 card at random from your hand. If Absorbing Man has the [[Wood]] trait, discard 1 card you control.
  >
  > ---
  >
  > [star] **Boost**: If Absorbing Man has the [[Stone]] or [[Wood]] trait, you are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/04088.png` (300×419 px, 34.9 KB)
### [04089] Omni-Morph Duplication
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (18–20/25, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Absorbing Man has the:
  > - [[Ice]] trait, exhaust your identity.
  > - [[Metal]] trait, give Absorbing Man a tough status card and heal 1 damage from him.
  > - [[Stone]] trait, give Absorbing Man 1 facedown boost card.
  > - [[Wood]] trait, discard 1 card at random from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/04089.png` (300×419 px, 39.3 KB)
### [04090] Icy Grip
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (21–22/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are stunned. If Absorbing Man has the [[Ice]] trait, take 2 indirect damage.
  >
  > ---
  >
  > [star] **Boost**: If Absorbing Man has the [[Ice]] or [[Metal]] trait, give him a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/04090.png` (300×419 px, 38.5 KB)
### [04091] Avalanche!
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (23–24/25, Qty: 2)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Each Player must choose to either spend a [energy] resource or take 2 indirect damage (3 indirect damage instead if there are 5 or more delay counters on the main scheme.)
- **Image Asset**: `assets/card-art/bundles/cards/04091.png` (419×300 px, 36.5 KB)
### [04092] Super Absorbing Power
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Absorbing Man (25/25)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Absorbing Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Absorbing Man gains the [[Ice]], [[Metal]], [[Stone]], and [[Wood]] traits.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Flavor**: *Creel has the ability to absorb the properties of multiple elements at once, but it requires intense concentration.*
- **Image Asset**: `assets/card-art/bundles/cards/04092.png` (419×300 px, 37.3 KB)

### Set: Taskmaster

### [04093] Taskmaster
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (1/23)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Mercenary.*
- **Rules Text**:
  > **Forced Response**: After a player changes to hero form, they discard the top card of the encounter deck and take damage equal to the number of boost icons on that card.
- **Flavor**: *"There's nothing you can do that I can't do better."*
- **Image Asset**: `assets/card-art/bundles/cards/04093.png` (300×419 px, 39.5 KB)
### [04094] Taskmaster
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (2/23)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Mercenary.*
- **Rules Text**:
  > **When Revealed**: Deal each player an encounter card.
  > **Forced Response**: After a player changes to hero form, they discard the top card of the encounter deck and take damage equal to the number of boost icons on that card.
- **Image Asset**: `assets/card-art/bundles/cards/04094.png` (300×419 px, 41.6 KB)
### [04095] Taskmaster
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (3/23)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 3, **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Mercenary.*
- **Rules Text**:
  > **When Revealed**: Deal each player an encounter card.
  > **Forced Response**: After a player changes to hero form, they discard the top card of the encounter deck and take damage equal to the number of boost icons on that card.
- **Image Asset**: `assets/card-art/bundles/cards/04095.png` (300×419 px, 41.6 KB)
### [04096] Hunting Down Heroes
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (4/23)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, each player in hero form must choose to either place 1 threat here or take 1 damage.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *The notorious Taskmaster has been appointed by Hydra's chief of police. His top priority is hunting down the outlaw heroes.*
- **Image Asset**: `assets/card-art/bundles/cards/04096.png` (419×300 px, 41.0 KB)
### [04096a] Hunting Down Heroes
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (4/23)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Taskmaster (I) and Taskmaster (II). Taskmaster, Hydra Patrol, and Standard encounter sets. One modular encounter set *(Weapon Master).*
  > **Setup**: Set each [[Captive]] ally aside out of play. Search the encounter deck for Hydra Patrol and put it into play. Shuffle the encounter deck.
### [04096b] Hunting Down Heroes
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (4/23)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, each player in hero form must choose to either place 1 threat here or take 1 damage.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *The notorious Taskmaster has been appointed by Hydra's chief of police. His top priority is hunting down the outlaw heroes.*
### [04097] Moon Knight — *Marc Spector*
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (5/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Captive. Hero for Hire.*
- **Rules Text**:
  > **Response**: After you play Moon Knight from your hand, spend a [wild] resource → draw 2 cards.
- **Flavor**: *"Hydra took over so fast, I wasn't sure they were real."*
- **Image Asset**: `assets/card-art/bundles/cards/04097.png` (300×419 px, 37.4 KB)
### [04098] Shang-Chi
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (6/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Captive. Hero for Hire.*
- **Rules Text**:
  > **Response**: After you play Shang-Chi from your hand, spend a [energy] resource → stun an enemy.
- **Flavor**: *"A Hydra strike team raided my house while I was meditating. I showed them out, but there were two more teams waiting outside."*
- **Image Asset**: `assets/card-art/bundles/cards/04098.png` (710×1030 px, 395.8 KB)
### [10098] Shang-Chi
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (6/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Captive. Hero for Hire.*
- **Rules Text**:
  > **Response:** After you play Shang-Chi from your hand, spend a [energy] resource → stun an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/10098.png` (300×419 px, 41.7 KB)
### [04099] White Tiger — *Angela Del Toro*
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (7/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 3 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Captive. Hero for Hire.*
- **Rules Text**:
  > **Response**: After you play White Tiger from your hand, spend [mental] resource → remove 3 threat from a scheme.
- **Flavor**: *"After Hydra took over and outlawed superheroes, a neighbor called the new chief of police to report me."*
- **Image Asset**: `assets/card-art/bundles/cards/04099.png` (300×419 px, 41.0 KB)
### [04100] Elektra
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (8/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Captive. Hero for Hire.*
- **Rules Text**:
  > **Response**: After you play Elektra from your hand, spend a [physical] resource → deal 3 damage to an enemy.
- **Flavor**: *"I got caught when I tried to help some civilians escape a Hydra Patrol. Turns out the civilians were Hydra agents running a sting operation."*
- **Image Asset**: `assets/card-art/bundles/cards/04100.png` (300×419 px, 39.6 KB)
### [04101] Hydra Hunter
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (9–10/23, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > [star] Hydra's Hunter's attacks gain piercing and ranged.
  >
  > ---
  >
  > [star] **Boost**: If you are in hero form, take 1 damage. Otherwise place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/04101.png` (300×419 px, 40.5 KB)
### [04102] Taskmaster's Sword
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (11/23)
- **Properties**: Unique
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Taskmaster.
  > [star] Taskmaster's attacks gain piercing.
  > **Hero Action**: Exhaust your hero and spend [mental][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/04102.png` (300×419 px, 39.9 KB)
### [04103] Taskmaster's Shield
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (12/23)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Weapon.*
- **Rules Text**:
  > Attach to Taskmaster.
  > Taskmaster gains retaliate 1.
  > **Hero Action**: Exhaust your hero and spend [mental][physical] resources → discard this card.
- **Flavor**: *"I learned this move from Captain America." —Taskmaster*
- **Image Asset**: `assets/card-art/bundles/cards/04103.png` (300×419 px, 37.8 KB)
### [04104] Photographic Reflexes
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (13–14/23, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to Taskmaster.
  > **Forced Interrupt**: when a player attacks Taskmaster, prevent all damage that would be dealt to Taskmaster and deal an equal amount of damage to that player's identity instead. Then, discard Photographic Reflexes. (Max once per attack.)
- **Image Asset**: `assets/card-art/bundles/cards/04104.png` (300×419 px, 44.1 KB)
### [04105] Mimicry
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (15–16/23, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard the top 5 cards of your deck. If a [[Thwart]] card was discarded this way, Taskmaster schemes.
  > **When Revealed (Hero)**: Discard the top 5 cards of your deck. If an [[Attack]] card was discarded this way, Taskmaster attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/04105.png` (300×419 px, 43.8 KB)
### [04106] Hunted by Hydra
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (17–18/23, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1. *(When this card is revealed place 1 threat on the main scheme.)*
  > **When Revealed**: Each player in hero form takes 1 damage and discards 1 card at random from their hand.
- **Flavor**: *"It's a bad time to be a hero." —Bucky Barnes*
- **Image Asset**: `assets/card-art/bundles/cards/04106.png` (300×419 px, 41.3 KB)
### [04107] Captured by Hydra
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (19–22/23, Qty: 4)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place 1 random set-aside [[Captive]] ally facedown beneath this scheme. When this scheme is defeated, the player who defeated it takes that ally into their hand and removes this scheme from the game.
- **Image Asset**: `assets/card-art/bundles/cards/04107.png` (419×300 px, 36.5 KB)
### [04108] Taskmaster's Training Camp
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Taskmaster (23/23)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Taskmaster Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **Forced Response**: After a minion enters play, give it a tough status card.
- **Flavor**: *Taskmaster only accepts the best troops into his police force. before a Hydra soldier can enlist, they must survive his training camp.*
- **Image Asset**: `assets/card-art/bundles/cards/04108.png` (1030×710 px, 397.9 KB)

### Set: Zola

### [04109] Zola
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (1/31)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Traits**: *Android. Hydra.*
- **Rules Text**:
  > Retaliate 1.
- **Flavor**: *"My mutate program will transform these pathetic creatures into Hydra's elite shock-troops!"*
- **Image Asset**: `assets/card-art/bundles/cards/04109.png` (300×419 px, 34.9 KB)
### [04110] Zola
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (2/31)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Traits**: *Android. Hydra.*
- **Rules Text**:
  > Retaliate 1.
  > **When Revealed**: Search the encounter deck and discard pile for the Test Subjects side scheme and reveal it.
  > (Shuffle the encounter deck.)
- **Image Asset**: `assets/card-art/bundles/cards/04110.png` (300×419 px, 38.5 KB)
### [04111] Zola
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (3/31)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Traits**: *Android. Hydra.*
- **Rules Text**:
  > Retaliate 1.
  > **When Revealed**: Each player searches the encounter deck and discard pile for a minion and reveals it. (Shuffle the encounter deck.)
- **Image Asset**: `assets/card-art/bundles/cards/04111.png` (300×419 px, 38.2 KB)
### [04112] The Island of Dr. Zola
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (4/31)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, place 1 test counter here. Then, if there are 3 or more test counters here, discard cards from the top of the encounter deck until a minion is discarded. Put that minion into play engaged with the first player and remove 3 test counters from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/04112.png` (419×300 px, 45.4 KB)
### [04112a] The Island of Dr. Zola
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (4/31)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Zola (I) and Zola (II). Zola and Standard encounter sets. One modular encounter set *(Under Attack)*
  > **Setup**: Search the encounter deck for Hydra Prison and reveal it. Each player searches the encounter deck for a copy of Ultimate Bio-Servant and puts it into play engaged with them. Shuffle the encounter deck.
### [04112b] The Island of Dr. Zola
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (4/31)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, place 1 test counter here. Then, if there are 3 or more test counters here, discard cards from the top of the encounter deck until a minion is discarded. Put that minion into play engaged with the first player and remove 3 test counters from this scheme.
### [04113] The Mad Doctor
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (5/31)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step 1 of the villain phase, place 1 test counter here. Then, if there are 3 or more test counters here, discard cards from the top of the encounter deck until a minion is discarded. Put that minion into play engaged with the first player and remove 3 test counters from this scheme.
  > **If this scheme is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/04113.png` (419×300 px, 41.2 KB)
### [04113a] The Mad Doctor
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (5/31)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player searches the encounter deck and discard pile for a minion and reveals it. Shuffle the encounter deck.
- **Flavor**: *Zola's mutates attack you with blind obedience and savage fury. It's up to you to put an end to this nightmare before the mad doctor unleashes them upon the world!*
### [04113b] The Mad Doctor
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (5/31)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step 1 of the villain phase, place 1 test counter here. Then, if there are 3 or more test counters here, discard cards from the top of the encounter deck until a minion is discarded. Put that minion into play engaged with the first player and remove 3 test counters from this scheme.
  > **If this scheme is completed, the players lose the game.**
### [04114] Ultimate Bio-Servant
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (6–9/31, Qty: 4)
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Mutate.*
- **Rules Text**:
  > Toughness.
  > [star] Ultimate Bio-Servant gets +1 ATK for each attachment on it.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/04114.png` (300×419 px, 36.3 KB)
### [04115] Zola's Mutate
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (10–12/31, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Mutate.*
- **Rules Text**:
  > **When Revealed**: Discard cards from the top of the encounter deck until a [[Tech]] attachment is discarded. Attach that card to Zola's Mutate.
  >
  > ---
  >
  > [star] **Boost**: Shuffle Zola's Mutate into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/04115.png` (300×419 px, 39.2 KB)
### [04116] Berserk Mutate
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (13–15/31, Qty: 3)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra. Mutate.*
- **Rules Text**:
  > Quickstrike.
  >
  > ---
  >
  > [star] **Boost**: Place 1 test counter on the main scheme. For each test counter on the main scheme, Zola gets +1 SCH and +1 ATK for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/04116.png` (300×419 px, 40.8 KB)
### [04117] Defensive Programming
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (16–18/31, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to the minion with the most remaining hit points without another copy of Defensive Programming attached. If you cannot, this card gains surge.
  > Attached minion gets +2 hit points and gains guard.
- **Image Asset**: `assets/card-art/bundles/cards/04117.png` (300×419 px, 42.3 KB)
### [04118] Pain Inhibitors
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (19–20/31, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to the minion with the most remaining hit points without another copy of Pain Inhibitors attached. If you cannot, this card gains surge.
  > Attached minion gets +2 hit points and gains retaliate 1.
- **Image Asset**: `assets/card-art/bundles/cards/04118.png` (300×419 px, 38.8 KB)
### [04119] Neurological Implants
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (21–22/31, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to the minion with the most remaining hit points without another copy of Neurological Implants attached. If you cannot, this card gains surge.
  > Attached minion gets +2 hit points.
- **Image Asset**: `assets/card-art/bundles/cards/04119.png` (300×419 px, 41.7 KB)
### [04120] Mind Ray
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (23–25/31, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Zola schemes. You are confused.
  > **When Revealed (Hero)**: Zola attacks you. You are stunned.
- **Flavor**: *"You thought Zola defenseless? You arrogant fool!" —Arnim Zola*
- **Image Asset**: `assets/card-art/bundles/cards/04120.png` (300×419 px, 39.9 KB)
### [04121] Technological Enhancements
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (26–27/31, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1.
  > **When Revealed**: Place 1 test counter on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: Place 1 test counter on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/04121.png` (300×419 px, 37.0 KB)
### [04122] Hydra Prison
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (28/31)
- **Stats**: **Base Threat**: 1
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player searches their deck, discard pile and hand for a hero-specific ally and places it facedown beneath this scheme. Place X threat on this scheme where X is the total cost of all allies beneath it. Each player shuffles their deck.
  > **When Defeated**: remove this scheme from the game and return each ally beneath it to its owner's hand.
- **Image Asset**: `assets/card-art/bundles/cards/04122.png` (419×300 px, 42.0 KB)
### [04123] Test Subjects
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (29–30/31, Qty: 2)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: The first player discards cards from the top of the encounter deck until they discard a minion. Reveal that minion.
- **Flavor**: *It is a fate worse than death.*
- **Image Asset**: `assets/card-art/bundles/cards/04123.png` (419×300 px, 35.5 KB)
### [04124] Zola's Experiments
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Zola (31/31)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zola Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Response**: After a minion enters play, attach the topmost [[Tech]] attachment in the encounter discard pile to that minion.
- **Flavor**: *The mad doctor never grows tired of experimenting on his victims.*
- **Image Asset**: `assets/card-art/bundles/cards/04124.png` (419×300 px, 38.4 KB)

### Set: Red Skull

### [04125] Red Skull
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (1/28)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 0 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > [star] Red Skull gets +1 ATK for each side scheme in play.
- **Flavor**: *"Freedom is only for the one who rules! All others must be slaves!"*
- **Image Asset**: `assets/card-art/bundles/cards/04125.png` (300×419 px, 33.9 KB)
### [04126] Red Skull
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (2/28)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 3, **ATK**: 1 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > [star] Red Skull gets +1 ATK for each side scheme in play.
  > **When Revealed**: Deal each player an encounter card.
- **Flavor**: *"No one will stand in the way of my plans!"*
- **Image Asset**: `assets/card-art/bundles/cards/04126.png` (300×419 px, 35.8 KB)
### [04127] Red Skull
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (3/28)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > [star] Red Skull gets +1 ATK for each side scheme in play.
  > **When Revealed**: Deal each player an encounter card.
- **Flavor**: *"The world will bow to Red Skull!"*
- **Image Asset**: `assets/card-art/bundles/cards/04127.png` (300×419 px, 35.6 KB)
### [04128] The Rise of the Red Skull
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (4/28)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, reveal the top of the side-scheme deck and put it into play.
- **Flavor**: *Red Skull plans to conquer the world with the power of the Reality Stone. He uses his strategic genius to keep you busy while he works towards his goal.*
- **Image Asset**: `assets/card-art/bundles/cards/04128.png` (419×300 px, 35.2 KB)
### [04128a] The Rise of Red Skull
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (4/28)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Red Skull (I) and Red Skull (II). Red Skull and Standard encounter sets. Two modular encounter sets *(Hydra Assault and Hydra Patrol).*
  > **Setup**: Put the Red House into play. Shuffle every other side scheme into the side-scheme deck and set it next to the encounter deck (see insert).
  > Set The Sleeper aside, out of play.
### [04128b] The Rise of Red Skull
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (4/28)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, reveal the top of the side-scheme deck and put it into play.
- **Flavor**: *Red Skull plans to conquer the world with the power of the Reality Stone. He uses his strategic genius to keep you busy while he works towards his goal.*
### [04129] New World Hydra
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (5/28)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 11 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, reveal the top card of the side-scheme deck and put it into play.
  > **If this scheme is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/04129.png` (419×300 px, 33.3 KB)
### [04129a] New World Hydra
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (5/28)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Reveal the top card of the side-scheme deck and put it into play.
- **Flavor**: *The Red Skull is one step closer to unlocking the full power of the Infinity Stone. You need to stop him before he does, and all reality is bent to his evil will.*
### [04129b] New World Hydra
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (5/28)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 11 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, reveal the top card of the side-scheme deck and put it into play.
  > **If this scheme is completed, the players lose the game.**
### [04130] The Sleeper
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (6/28)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Hydra. Robot.*
- **Rules Text**:
  > Guard. Retaliate 1. Toughness.
  > **When Revealed**: The Sleeper engages the first player.
  > **When Defeated**: Remove The Sleeper from the game.
- **Image Asset**: `assets/card-art/bundles/cards/04130.png` (300×419 px, 37.8 KB)
### [04131] Hydra Exo-Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (7–9/28, Qty: 3)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Toughness.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card and another boost card.
- **Flavor**: *"Careful, team. These guys pack a punch!" —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/04131.png` (300×419 px, 38.6 KB)
### [04132] Red Skull's Luger
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (10/28)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Red Skull.
  > [star] Red Skull's attacks gain piercing and ranged.
  > **Hero Action**: Spend [energy] [mental] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach to Red Skull.
- **Image Asset**: `assets/card-art/bundles/cards/04132.png` (300×419 px, 34.8 KB)
### [04133] Red Skull's Right Hook
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (11–12/28, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > Attach to Red Skull.
  > Red Skull gains retaliate 1.
  > **Hero Action**: Spend [energy][mental][physical] resources → discard this card.
- **Flavor**: *"I am your superior in every way!" —Red Skull*
- **Image Asset**: `assets/card-art/bundles/cards/04133.png` (300×419 px, 38.4 KB)
### [04134] Master Strategist
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (13–14/28, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > Attach to Red Skull.
  > [star] **Forced Interrupt**: When Red Skull activates, give him an additional boost card for each side scheme in play. Then, discard this card. (Max once per activation.)
- **Flavor**: *"In chess, the only piece that truly matters is the King, and that's me." —Red Skull*
- **Image Asset**: `assets/card-art/bundles/cards/04134.png` (300×419 px, 37.7 KB)
### [04135] Twisted Reality
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (15–16/28, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Incite 1.
  > Attach to a side scheme.
  > **Forced Interrupt**: When attached side scheme is defeated, deal the first player an encounter card.
- **Flavor**: *The Infinity Stone gives Red Skull the power to bend reality to his will.*
- **Image Asset**: `assets/card-art/bundles/cards/04135.png` (300×419 px, 40.1 KB)
### [04136] Bitter Rival
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (17–18/28, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Exhaust a character you control for each side scheme in play.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a character you control.
- **Flavor**: *"This is the end for you, Herr Captain!" —Red Skull*
- **Image Asset**: `assets/card-art/bundles/cards/04136.png` (300×419 px, 36.3 KB)
### [04137] Spreading Lies
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (19–20/28, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 2 threat on each scheme in play.
  >
  > ---
  >
  > [star] **Boost**: Give Red Skull a tough status card.
- **Flavor**: *"With my great and unmatched cunning, Hydra will reign supreme!" —Red Skull*
- **Image Asset**: `assets/card-art/bundles/cards/04137.png` (300×419 px, 37.8 KB)
### [04138] Infinite Power
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (21–22/28, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Give Red Skull a tough status card. Red Skull schemes.
  > **When Revealed (Hero)**: Give Red Skull a tough status card. Red Skull attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/04138.png` (300×419 px, 36.2 KB)
### [04139] The Red House
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (23/28)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Red Skull cannot take damage.
  > **Interrupt**: When a character thwarts this side scheme, they may use their ATK instead of their THW.
- **Flavor**: *Red Skull built his fortress over the White House as a symbol of Hydra's conquest over America.*
- **Image Asset**: `assets/card-art/bundles/cards/04139.png` (1030×710 px, 364.1 KB)
### [04140] The Sleeper Awakened
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (24/28)
- **Stats**: **Base Threat**: 0
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > This scheme cannot leave play while The Sleeper is in play.
  > **When Revealed**: Put The Sleeper into play engaged with the first player. When The Sleeper is defeated, remove this card from the game.
- **Flavor**: *Rising from the Potomac River, The Sleeper has awakened to answer Red Skull's summons.*
- **Image Asset**: `assets/card-art/bundles/cards/04140.png` (419×300 px, 37.0 KB)
### [04141] Prison Camps
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (25/28)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme searches their deck and discard pile for an ally, puts it into play, and shuffles their deck.
- **Flavor**: *Under Hydra's rule, families are separated and incarcerated without due process.*
- **Image Asset**: `assets/card-art/bundles/cards/04141.png` (419×300 px, 37.5 KB)
### [04142] Censor the Past
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (26/28)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Each player chooses up to 3 cards in their discard pile and shuffles them into their deck.
- **Flavor**: *Hydra controls all media outlets and uses propaganda to turn the masses against the heroes of the past.*
- **Image Asset**: `assets/card-art/bundles/cards/04142.png` (419×300 px, 37.2 KB)
### [04143] Hydra Reinforcements
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (27/28)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme discards a non-**Elite** minion.
- **Flavor**: *What Hydra lacks in skill, they make up for with sheer numbers.*
- **Image Asset**: `assets/card-art/bundles/cards/04143.png` (419×300 px, 39.6 KB)
### [04144] Mass Chaos
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Red Skull (28/28)
- **Stats**: **Base Threat**: 0
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Red Skull Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Each player discards the top 5 cards of their deck and places 1 threat here for each different type of resource icon ([energy],[mental],[physical], or [wild]) they discarded this way.
- **Flavor**: *Red Skull creates catastrophes across the country to keep his enemies busy.*
- **Image Asset**: `assets/card-art/bundles/cards/04144.png` (419×300 px, 42.8 KB)

### Set: Hydra Assault

### [04145] Hydra Flame-Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Assault (1–3/6, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hydra Assault Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > [star] **Forced Response**: After Hydra Flame-Soldier makes an undefended attack against you, discard a support you control.
  >
  > ---
  >
  > [star] **Boost**: If this card resolves during an undefended attack, discard a support you control.
- **Image Asset**: `assets/card-art/bundles/cards/04145.png` (300×419 px, 40.9 KB)
### [04146] Hydra Jet-Trooper
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Assault (4–5/6, Qty: 2)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hydra Assault Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Quickstrike.
  >
  > ---
  >
  > [star] **Boost**: If you are in hero form, the villain attacks you after this activation. Do not deal any boost cards for that attack.
- **Image Asset**: `assets/card-art/bundles/cards/04146.png` (300×419 px, 41.3 KB)
### [04147] Hail Hydra!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Assault (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hydra Assault Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[Hydra]] minion engaged with a hero attacks that hero. Each player who was not attacked this way searches the encounter deck and discard pile for a [[Hydra]] minion and puts it into play engaged with them. Shuffle the encounter deck if it was searched.
- **Image Asset**: `assets/card-art/bundles/cards/04147.png` (300×419 px, 46.9 KB)

### Set: Weapon Master

### [04148] Combat Knife
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Weapon Master (1/5)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Weapon Master Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > [star] Attached villain's attacks gain piercing.
  > **Hero Action**: Spend [mental][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/04148.png` (300×419 px, 33.0 KB)
### [04149] Hydra Sidearm
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Weapon Master (2/5)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Weapon Master Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to the Villain.
  > [star] **Forced Interrupt**: When attached villain attacks, the attack gains ranged.
  > **Hero Action**: Spend [mental][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/04149.png` (300×419 px, 35.8 KB)
### [04150] Weapon Master
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Weapon Master (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Weapon Master Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Reveled (Alter-Ego)**: The villain schemes. If they have a [[Weapon]] attachment, this card gains surge.
  > **When Reveled (Hero)**: the villain attacks you. If they have a [[Weapon]] attachment, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/04150.png` (710×1030 px, 372.9 KB)
### [04151] Concussion Grenade
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Weapon Master (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Weapon Master Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: You are confused. Place 1 threat on the main scheme (2 threat instead if you were already confused).
  > **When Revealed (Hero)**: You are stunned. Deal 1 damage to your hero (2 instead if you were already stunned).
- **Image Asset**: `assets/card-art/bundles/cards/04151.png` (300×419 px, 38.5 KB)

### Set: Hydra Patrol

### [04152] Hydra Regular
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Patrol (1–2/6, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hydra Patrol Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Incite 1. *(When this card is revealed, place 1 threat on the main scheme.)*
- **Flavor**: *"When you consider the kind of person would join a terrorist organization bent on world domination, it's easy to see why Hydra's troops don't impress." —Jessica Drew*
- **Image Asset**: `assets/card-art/bundles/cards/04152.png` (300×419 px, 39.0 KB)
### [04153] Hydra Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Patrol (3–5/6, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hydra Patrol Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Guard.*(While this minion is engaged with you, you cannot attack the villain.)*
  > **When Defeated**: Deal the engaged player an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/04153.png` (300×419 px, 39.6 KB)
### [04154] Hydra Patrol
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Patrol (6/6)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hydra Patrol Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: Each player searches the encounter deck and discard pile for a [[Hydra]] minion and puts it into play engaged with them. Shuffle the encounter deck.
- **Flavor**: *Hydra Soldiers perform routine patrols to maintain control of their territory.*
- **Image Asset**: `assets/card-art/bundles/cards/04154.png` (419×300 px, 39.4 KB)

### Set: Hydra Campaign

### [04155] Adrenal Stims
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Setup.
  > **Hero Action:** Discard this card and remove it from the campaign log → ready your hero and heal 5 damage from them.
- **Image Asset**: `assets/card-art/bundles/cards/04155.png` (300×419 px, 41.9 KB)
### [04156] Tactical Scanner
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Setup.
  > **Hero Action:** Discard this card and remove it from the campaign log → draw 5 cards.
- **Image Asset**: `assets/card-art/bundles/cards/04156.png` (300×419 px, 34.7 KB)
### [04157] Emergency Teleporter
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Setup.
  > **Hero Action:** Discard this card and remove it from the campaign log → search your deck and discard pile for an ally, put it into play, and give it a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/04157.png` (300×419 px, 40.0 KB)
### [04158] Laser Cannon
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Setup.
  > **Hero Action:** Discard this card and remove it from the campaign log → deal 5 damage to the villain and each enemy engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/04158.png` (300×419 px, 38.9 KB)
### [04159a] Basic Thwart Upgrade
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent. Setup.
  > You get +2 hit points.
  > Your hero gets +1 THW.
- **Image Asset**: `assets/card-art/bundles/cards/04159a.png` (300×419 px, 35.4 KB)
### [04159b] Improved Thwart Upgrade
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent. Setup.
  > You get +2 hit points.
  > Your hero gets +1 THW.
  > **Response:** After you defeat a side scheme, exhaust this card → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/04159b.png` (300×419 px, 37.0 KB)
### [04160a] Basic Attack Upgrade
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent. Setup.
  > You get +1 hit points.
  > Your hero gets +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/04160a.png` (300×419 px, 38.7 KB)
### [04160b] Improved Attack Upgrade
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent. Setup.
  > You get +1 hit points.
  > Your hero gets +1 ATK.
  > **Hero Response:** After you defeat a minion, exhaust this card → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/04160b.png` (300×419 px, 40.8 KB)
### [04161a] Basic Defense Upgrade
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent. Setup.
  > You get +3 hit points.
  > Your hero gets +1 DEF.
- **Image Asset**: `assets/card-art/bundles/cards/04161a.png` (300×419 px, 37.5 KB)
### [04161b] Improved Defense Upgrade
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent. Setup.
  > You get +3 hit points.
  > Your hero gets +1 DEF.
  > **Hero Response:** After you defend against an attack, exhaust this card → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/04161b.png` (300×419 px, 40.2 KB)
### [04162a] Basic Recovery Upgrade
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent. Setup.
  > You get +4 hit points.
  > Your alter-ego gets +1 REC.
- **Image Asset**: `assets/card-art/bundles/cards/04162a.png` (300×419 px, 39.9 KB)
### [04162b] Improved Recovery Upgrade
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Hydra Campaign (Set Card, unnumbered)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hydra Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent. Setup.
  > You get +4 hit points.
  > Your alter-ego gets +1 REC.
  > **Response:** After you use your REC, exhaust this card → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/04162b.png` (300×419 px, 41.5 KB)

### Set: Expert Campaign

### [04163] Zola's Algorithm
- **Type**: `Obligation`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Expert Campaign (1–4/7, Qty: 4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Expert Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Alter-Ego Action** Exhaust your alter-ego and spend a [mental] resource → discard this card.
- **Flavor**: *"A beautiful parasite growing inside the world's most secure computer systems." —Arnim Zola*
- **Image Asset**: `assets/card-art/bundles/cards/04163.png` (300×419 px, 34.3 KB)
### [04164] Medical Emergency
- **Type**: `Obligation`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Expert Campaign (2–5/7, Qty: 4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Expert Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response:** At the end of your turn, take 1 damage if you are in hero form.
  > **Alter-Ego Action:** Discard the top 5 cards of your deck and spend a [physical] resource → discard this card.
- **Flavor**: *"This is going to need sutures." —Stephen Strange*
- **Image Asset**: `assets/card-art/bundles/cards/04164.png` (300×419 px, 37.7 KB)
### [04165] Martial Law
- **Type**: `Obligation`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Expert Campaign (3–6/7, Qty: 4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Expert Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Your hand size is reduced by 1.
  > **Alter-Ego Action:** Deal yourself an encounter card and spend a [energy] resource → discard this card.
- **Flavor**: *"Pull him aside for questioning." —Hydra Soldier*
- **Image Asset**: `assets/card-art/bundles/cards/04165.png` (300×419 px, 36.2 KB)
### [04166] Anti-Hero Propaganda
- **Type**: `Obligation`
- **Faction / Aspect**: Campaign
- **Pack**: The Rise of Red Skull (`trors`)
- **Deck / Set**: Expert Campaign (4–7/7, Qty: 4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Expert Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Your hero gets -1 THW, -1 ATK, and -1 DEF.
  > **Alter-Ego Action:** Take 2 damage and spend a [wild] resource → discard this card.
- **Flavor**: *"These dissenters breed conflict. They are your true enemies." —Hydra News Media*
- **Image Asset**: `assets/card-art/bundles/cards/04166.png` (300×419 px, 37.5 KB)

