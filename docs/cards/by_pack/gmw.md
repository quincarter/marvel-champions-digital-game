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
| `16001a` | Groot | Hero | Groot | THW:1 ATK:2 DEF:3 HP:10 | - | `gmw` |
| `16001b` | Groot | Alter-Ego | Groot | HP:10 | - | `gmw` |
| `16002` | Fruition | Event | Groot | - | - | `gmw` |
| `16003` | "I am Groot" | Event | Groot | - | - | `gmw` |
| `16004` | "I. AM. GROOT!" | Event | Groot | - | - | `gmw` |
| `16005` | Root Stomp | Event | Groot | - | - | `gmw` |
| `16006` | "We Are Groot" | Event | Groot | - | - | `gmw` |
| `16007` | Fertile Ground | Support | Groot | - | - | `gmw` |
| `16008` | Entangling Vines | Upgrade | Groot | - | - | `gmw` |
| `16009` | Lashing Vines | Upgrade | Groot | - | - | `gmw` |
| `16010` | Vine Shield | Upgrade | Groot | - | - | `gmw` |
| `16011` | Vine Spikes | Upgrade | Groot | - | - | `gmw` |
| `16012` | Starhawk | Ally | Pack Position: 12 | THW:1 ATK:2 HP:3 | - | `gmw` |
| `16013` | Desperate Defense | Event | Pack Position: 13 | - | - | `gmw` |
| `16014` | Fighting Fit | Event | Pack Position: 14 | - | - | `gmw` |
| `16015` | The Power of Protection | Resource | Pack Position: 15 | - | - | `gmw` |
| `16016` | Dauntless | Upgrade | Pack Position: 16 | - | - | `gmw` |
| `16017` | Hard to Ignore | Upgrade | Pack Position: 17 | - | - | `gmw` |
| `16018` | Indomitable | Upgrade | Pack Position: 18 | - | - | `gmw` |
| `16019` | Rocket Raccoon | Ally | Pack Position: 19 | THW:2 ATK:1 HP:3 | - | `gmw` |
| `16020` | Flora and Fauna | Event | Pack Position: 20 | - | - | `gmw` |
| `16021` | Energy | Resource | Pack Position: 21 | - | - | `gmw` |
| `16022` | Genius | Resource | Pack Position: 22 | - | - | `gmw` |
| `16023` | Strength | Resource | Pack Position: 23 | - | - | `gmw` |
| `16024` | Deft Focus | Upgrade | Pack Position: 24 | - | - | `gmw` |
| `16025` | Wilt | Obligation | Groot | - | 2 pips | `gmw` |
| `16026` | Blazing Inferno | Side Scheme | Groot Nemesis | - | 2 pips | `gmw` |
| `16027` | Furnax | Minion | Groot Nemesis | SCH:2 ATK:2 HP:6 | 3 pips | `gmw` |
| `16028` | Fan the Flames | Treachery | Groot Nemesis | - | 1 pips | `gmw` |
| `16029a` | Rocket Raccoon | Hero | Rocket Raccoon | THW:2 ATK:1 DEF:1 HP:9 | - | `gmw` |
| `16029b` | Rocket Raccoon | Alter-Ego | Rocket Raccoon | HP:9 | - | `gmw` |
| `16030` | I've Got a Plan | Event | Rocket Raccoon | - | - | `gmw` |
| `16031` | Reload | Event | Rocket Raccoon | - | - | `gmw` |
| `16032` | Schadenfreude | Event | Rocket Raccoon | - | - | `gmw` |
| `16033` | Salvage | Resource | Rocket Raccoon | - | - | `gmw` |
| `16034` | Battery Pack | Upgrade | Rocket Raccoon | - | - | `gmw` |
| `16035` | Cybernetic Skeleton | Upgrade | Rocket Raccoon | - | - | `gmw` |
| `16036` | Particle Cannon | Upgrade | Rocket Raccoon | - | - | `gmw` |
| `16037` | Rocket Launcher | Upgrade | Rocket Raccoon | - | - | `gmw` |
| `16038` | Rocket's Pistol | Upgrade | Rocket Raccoon | - | - | `gmw` |
| `16039` | Thruster Boots | Upgrade | Rocket Raccoon | - | - | `gmw` |
| `16040` | Bug | Ally | Pack Position: 40 | THW:1 ATK:1 HP:2 | - | `gmw` |
| `16041` | Chase Them Down | Event | Pack Position: 41 | - | - | `gmw` |
| `16042` | Into the Fray | Event | Pack Position: 42 | - | - | `gmw` |
| `16043` | Looking for Trouble | Event | Pack Position: 43 | - | - | `gmw` |
| `16044` | Relentless Assault | Event | Pack Position: 44 | - | - | `gmw` |
| `16045` | Follow Through | Upgrade | Pack Position: 45 | - | - | `gmw` |
| `16046` | Hand Cannon | Upgrade | Pack Position: 46 | - | - | `gmw` |
| `16047` | Groot | Ally | Pack Position: 47 | THW:1 ATK:2 HP:6 | - | `gmw` |
| `16048` | Flora and Fauna | Event | Pack Position: 48 | - | - | `gmw` |
| `16049` | Energy | Resource | Pack Position: 49 | - | - | `gmw` |
| `16050` | Genius | Resource | Pack Position: 50 | - | - | `gmw` |
| `16051` | Strength | Resource | Pack Position: 51 | - | - | `gmw` |
| `16052` | Booster Boots | Upgrade | Pack Position: 52 | - | - | `gmw` |
| `16053` | Crisis on Halfworld | Obligation | Rocket Raccoon | - | 2 pips | `gmw` |
| `16054` | Vendetta | Side Scheme | Rocket Raccoon Nemesis | - | 2 pips | `gmw` |
| `16055` | Blackjack O'Hare | Minion | Rocket Raccoon Nemesis | SCH:1 ATK:1 HP:3 | 3 pips | `gmw` |
| `16056` | Blackjack's Bazooka | Attachment | Rocket Raccoon Nemesis | - | 2 pips | `gmw` |
| `16057` | Planetary Invasion | Treachery | Rocket Raccoon Nemesis | - | 1 pips | `gmw` |
| `16058` | Drang | Villain | Brotherhood Of Badoon | SCH:1 ATK:2 HP:13 | - | `gmw` |
| `16059` | Drang | Villain | Brotherhood Of Badoon | SCH:2 ATK:3 HP:14 | - | `gmw` |
| `16060` | Drang | Villain | Brotherhood Of Badoon | SCH:3 ATK:3 HP:18 | - | `gmw` |
| `16061a` | Terrestrial Invasion | Main Scheme | Brotherhood Of Badoon | - | - | `gmw` |
| `16061b` | Terrestrial Invasion | Main Scheme | Brotherhood Of Badoon | - | - | `gmw` |
| `16062a` | Protect the Planet | Main Scheme | Brotherhood Of Badoon | - | - | `gmw` |
| `16062b` | Protect the Planet | Main Scheme | Brotherhood Of Badoon | - | - | `gmw` |
| `16063` | Badoon Ship | Environment | Brotherhood Of Badoon | - | - | `gmw` |
| `16064` | Drang's Spear | Attachment | Brotherhood Of Badoon | - | 3 pips | `gmw` |
| `16065` | Badoon Engineer | Minion | Brotherhood Of Badoon | SCH:2 ATK:1 HP:3 | Star | `gmw` |
| `16066` | Blockade | Side Scheme | Brotherhood Of Badoon | - | 1 pips | `gmw` |
| `16067` | Bombardment | Side Scheme | Brotherhood Of Badoon | - | 2 pips | `gmw` |
| `16068` | Oppressive Armada | Side Scheme | Brotherhood Of Badoon | - | 1 pips | `gmw` |
| `16069` | Spatial Positioning | Side Scheme | Brotherhood Of Badoon | - | 3 pips | `gmw` |
| `16070` | Collector | Villain | Infiltrate the Museum | SCH:2 ATK:1 HP:13 | - | `gmw` |
| `16071` | Collector | Villain | Infiltrate the Museum | SCH:3 ATK:2 HP:14 | - | `gmw` |
| `16072` | Collector | Villain | Infiltrate the Museum | SCH:4 ATK:3 HP:18 | - | `gmw` |
| `16073a` | The Grand Collection | Main Scheme | Infiltrate the Museum | - | - | `gmw` |
| `16073b` | The Grand Collection | Main Scheme | Infiltrate the Museum | - | - | `gmw` |
| `16074` | Biogram Image | Attachment | Infiltrate the Museum | - | 1 pips | `gmw` |
| `16075` | Monarch Starstalker | Minion | Infiltrate the Museum | SCH:2 ATK:2 HP:7 | 3 pips | `gmw` |
| `16076` | Inconspicuous Box | Treachery | Infiltrate the Museum | - | Star | `gmw` |
| `16077` | View the Cosmos | Treachery | Infiltrate the Museum | - | 2 pips | `gmw` |
| `16078` | Stay Awhile | Treachery | Infiltrate the Museum | - | 1 pips | `gmw` |
| `16079` | Caught Off Guard | Treachery | Infiltrate the Museum | - | 1 pips | `gmw` |
| `16080a` | Collector | Villain | Escape the Museum | SCH:1 ATK:1 HP:8 | - | `gmw` |
| `16080b` | Collector | Villain | Escape the Museum | SCH:0 ATK:0 HP:0 | - | `gmw` |
| `16081a` | Collector | Villain | Escape the Museum | SCH:2 ATK:2 HP:10 | - | `gmw` |
| `16081b` | Collector | Villain | Escape the Museum | SCH:2 ATK:2 HP:0 | - | `gmw` |
| `16082a` | The Missing Milano | Main Scheme | Escape the Museum | - | - | `gmw` |
| `16082b` | The Missing Milano | Main Scheme | Escape the Museum | - | - | `gmw` |
| `16083a` | Lost in the Museum | Main Scheme | Escape the Museum | - | - | `gmw` |
| `16083b` | Lost in the Museum | Main Scheme | Escape the Museum | - | - | `gmw` |
| `16084a` | The Great Escape | Main Scheme | Escape the Museum | - | - | `gmw` |
| `16084b` | The Great Escape | Main Scheme | Escape the Museum | - | - | `gmw` |
| `16085a` | Library Labyrinth | Environment | Escape the Museum | - | - | `gmw` |
| `16085b` | Museum Ship | Environment | Escape the Museum | - | - | `gmw` |
| `16086` | "I Have You Now!" | Treachery | Escape the Museum | - | 1 pips | `gmw` |
| `16087` | Impossible Geometry | Treachery | Escape the Museum | - | 1 pips | `gmw` |
| `16088` | Nebula | Villain | Nebula | SCH:1 ATK:2 HP:14 | - | `gmw` |
| `16089` | Nebula | Villain | Nebula | SCH:2 ATK:2 HP:17 | - | `gmw` |
| `16090` | Nebula | Villain | Nebula | SCH:2 ATK:3 HP:20 | - | `gmw` |
| `16091a` | The Art of Evasion | Main Scheme | Nebula | - | - | `gmw` |
| `16091b` | The Art of Evasion | Main Scheme | Nebula | - | - | `gmw` |
| `16092a` | Warp Drive Initiated | Main Scheme | Nebula | - | - | `gmw` |
| `16092b` | Warp Drive Initiated | Main Scheme | Nebula | - | - | `gmw` |
| `16093` | Nebula's Ship | Environment | Nebula | - | - | `gmw` |
| `16094` | Cutthroat Ambition | Attachment | Nebula | - | Star | `gmw` |
| `16095` | Evasive Maneuvering | Attachment | Nebula | - | Star | `gmw` |
| `16096` | Unyielding Persistence | Attachment | Nebula | - | Star | `gmw` |
| `16097` | Weapon Mastery | Attachment | Nebula | - | Star | `gmw` |
| `16098` | Wide Stance | Attachment | Nebula | - | Star | `gmw` |
| `16099` | Lethal Intent | Side Scheme | Nebula | - | - | `gmw` |
| `16100` | Barrel Roll | Treachery | Nebula | - | 1 pips | `gmw` |
| `16101` | Combat Ready | Treachery | Nebula | - | 2 pips | `gmw` |
| `16102` | Ruthless | Treachery | Nebula | - | 2 pips | `gmw` |
| `16103` | Ronan the Accuser | Villain | Ronan the Accuser | SCH:2 ATK:2 HP:14 | - | `gmw` |
| `16104` | Ronan the Accuser | Villain | Ronan the Accuser | SCH:2 ATK:3 HP:18 | - | `gmw` |
| `16105` | Ronan the Accuser | Villain | Ronan the Accuser | SCH:3 ATK:4 HP:25 | - | `gmw` |
| `16106a` | Interception Imminent | Main Scheme | Ronan the Accuser | - | - | `gmw` |
| `16106b` | Interception Imminent | Main Scheme | Ronan the Accuser | - | - | `gmw` |
| `16107a` | "Take What Is Mine" | Main Scheme | Ronan the Accuser | - | - | `gmw` |
| `16107b` | "Take What Is Mine" | Main Scheme | Ronan the Accuser | - | - | `gmw` |
| `16108` | Kree Command Ship | Environment | Ronan the Accuser | - | - | `gmw` |
| `16109` | Universal Weapon | Attachment | Ronan the Accuser | - | Star | `gmw` |
| `16110` | Fanaticism | Attachment | Ronan the Accuser | ATK:1 | 2 pips | `gmw` |
| `16111` | Cut the Power | Side Scheme | Ronan the Accuser | - | Star | `gmw` |
| `16112` | Pincer Maneuver | Side Scheme | Ronan the Accuser | - | 3 pips | `gmw` |
| `16113` | Superior Tactics | Side Scheme | Ronan the Accuser | - | 2 pips | `gmw` |
| `16114` | Single-Minded Fury | Treachery | Ronan the Accuser | - | Star | `gmw` |
| `16115` | Kree Physiology | Treachery | Ronan the Accuser | - | 1 pips | `gmw` |
| `16116` | "You Stand Accused!" | Treachery | Ronan the Accuser | - | 1 pips | `gmw` |
| `16117` | Badoon Assassin | Minion | Band of Badoon | SCH:1 ATK:1 HP:1 | Star | `gmw` |
| `16118` | Badoon Grunt | Minion | Band of Badoon | SCH:2 ATK:2 HP:2 | Star | `gmw` |
| `16119` | Badoon Lieutenant | Minion | Band of Badoon | SCH:2 ATK:2 HP:6 | 1 pips | `gmw` |
| `16120` | Badoon Sentry | Minion | Band of Badoon | SCH:1 ATK:1 HP:5 | 1 pips | `gmw` |
| `16121` | Badoon Warlord | Minion | Band of Badoon | SCH:1 ATK:3 HP:4 | Star | `gmw` |
| `16122` | Cloak of Hercules | Attachment | Galactic Artifacts | - | 2 pips | `gmw` |
| `16123` | Obedience Potion | Attachment | Galactic Artifacts | - | 2 pips | `gmw` |
| `16124` | The Beyonder's Blazer | Attachment | Galactic Artifacts | - | 3 pips | `gmw` |
| `16125` | The Poison | Attachment | Galactic Artifacts | - | 2 pips | `gmw` |
| `16126` | Vandarian Power Stone | Attachment | Galactic Artifacts | - | 1 pips | `gmw` |
| `16127` | Hujahdarian Monarch Egg | Side Scheme | Galactic Artifacts | - | 1 pips | `gmw` |
| `16128` | Magical Teapot | Side Scheme | Galactic Artifacts | - | 1 pips | `gmw` |
| `16129` | Philosopher's Stone | Side Scheme | Galactic Artifacts | - | 1 pips | `gmw` |
| `16130` | Crystal Ball | Side Scheme | Galactic Artifacts | - | 1 pips | `gmw` |
| `16131` | Kree Combat Armor | Attachment | Kree Militants | - | 2 pips | `gmw` |
| `16132` | Kree Commando | Minion | Kree Militants | SCH:1 ATK:2 HP:6 | 2 pips | `gmw` |
| `16133` | Kree Lieutenant | Minion | Kree Militants | SCH:2 ATK:1 HP:7 | Star | `gmw` |
| `16134` | Kree Private | Minion | Kree Militants | SCH:1 ATK:1 HP:5 | 1 pips | `gmw` |
| `16135` | Psionic Ghost | Minion | Menagerie Medley | SCH:2 ATK:2 HP:4 | Star | `gmw` |
| `16136` | Servant Bot | Minion | Menagerie Medley | SCH:1 ATK:1 HP:3 | - | `gmw` |
| `16137` | Starshark | Minion | Menagerie Medley | SCH:1 ATK:3 HP:7 | Star | `gmw` |
| `16138` | Pirate Commander | Minion | Space Pirates | SCH:2 ATK:2 HP:6 | 1 pips | `gmw` |
| `16139` | Pirate Lackey | Minion | Space Pirates | SCH:1 ATK:2 HP:3 | 1 pips | `gmw` |
| `16140` | Sound the Alarms | Side Scheme | Space Pirates | - | Star | `gmw` |
| `16141` | Honor Among Thieves | Treachery | Space Pirates | - | 2 pips | `gmw` |
| `16142` | Milano | Support | Ship Command | - | - | `gmw` |
| `16143` | Rogue Vessel | Environment | Ship Command | - | 2 pips | `gmw` |
| `16144` | Cannonade | Side Scheme | Ship Command | - | 2 pips | `gmw` |
| `16145` | Blind Side | Treachery | Ship Command | - | 1 pips | `gmw` |
| `16146` | Hull Breach | Treachery | Ship Command | - | 2 pips | `gmw` |
| `16147` | Power Siphon | Treachery | Ship Command | - | 1 pips | `gmw` |
| `16148` | Special Delivery | Treachery | Ship Command | - | - | `gmw` |
| `16149` | Power Stone | Attachment | Power Stone | - | - | `gmw` |
| `16150` | Brainstorm | Event | The Market | - | - | `gmw` |
| `16151` | By Any Means | Event | The Market | - | - | `gmw` |
| `16152` | Contingency Plan | Event | The Market | - | - | `gmw` |
| `16153` | In Defiance | Event | The Market | - | - | `gmw` |
| `16154` | Calculate the Odds | Event | The Market | - | - | `gmw` |
| `16155` | Creative Solution | Event | The Market | - | - | `gmw` |
| `16156` | Grapple | Event | The Market | - | - | `gmw` |
| `16157` | Wing It | Event | The Market | - | - | `gmw` |
| `16158` | Close Call | Event | The Market | - | - | `gmw` |
| `16159` | Defy Danger | Event | The Market | - | - | `gmw` |
| `16160` | In Harm's Way | Event | The Market | - | - | `gmw` |
| `16161` | Take the Fight to Them | Event | The Market | - | - | `gmw` |
| `16162` | Armor Plating | Upgrade | The Market | - | - | `gmw` |
| `16163` | Heavy Cannon | Upgrade | The Market | - | - | `gmw` |
| `16164` | Hyper Thrusters | Upgrade | The Market | - | - | `gmw` |
| `16165` | Reactor Core | Upgrade | The Market | - | - | `gmw` |
| `16166` | Ardent Resolve | Event | The Market | - | - | `gmw` |
| `16167` | Onrush | Event | The Market | - | - | `gmw` |
| `16168` | Safeguard | Event | The Market | - | - | `gmw` |
| `16169` | Sure Gamble | Event | The Market | - | - | `gmw` |
| `16170` | Cargo Hold | Upgrade | The Market | - | - | `gmw` |
| `16171` | Mounted Laser | Upgrade | The Market | - | - | `gmw` |
| `16172` | Navigation Column | Upgrade | The Market | - | - | `gmw` |
| `16173` | Targeting Screen | Upgrade | The Market | - | - | `gmw` |
| `16174` | Grand Strategy | Event | The Market | - | - | `gmw` |
| `16175` | Power Unleashed | Event | The Market | - | - | `gmw` |
| `16176` | Tried and True | Event | The Market | - | - | `gmw` |
| `16177` | Triple Threat | Event | The Market | - | - | `gmw` |
| `16178a` | Badoon Blitz | Side Scheme | Challenge | - | - | `gmw` |
| `16178b` | Badoon Blitz | Side Scheme | Challenge | - | - | `gmw` |
| `16179a` | Gallery of Splendor | Side Scheme | Challenge | - | - | `gmw` |
| `16179b` | Gallery of Splendor | Side Scheme | Challenge | - | - | `gmw` |
| `16180a` | "There is No Escape" | Side Scheme | Challenge | - | - | `gmw` |
| `16180b` | "There is No Escape" | Side Scheme | Challenge | - | - | `gmw` |
| `16181a` | Guerrilla Tactics | Side Scheme | Challenge | - | - | `gmw` |
| `16181b` | Guerrilla Tactics | Side Scheme | Challenge | - | - | `gmw` |
| `16182a` | Kree Supremacy | Side Scheme | Challenge | - | - | `gmw` |
| `16182b` | Kree Supremacy | Side Scheme | Challenge | - | - | `gmw` |
| `16183` | Badoon Headhunter | Minion | Badoon Headhunter | SCH:1 ATK:1 HP:7 | Star | `gmw` |
| `16184` | On the Hunt | Treachery | Badoon Headhunter | - | 1 pips | `gmw` |
| `16185` | Dead to Rights | Treachery | Badoon Headhunter | - | 1 pips | `gmw` |
| `16186` | Headhunter's Henchman | Minion | Badoon Headhunter | SCH:1 ATK:2 HP:8 | 3 pips | `gmw` |
| `16187` | Fugitive Recovery | Side Scheme | Badoon Headhunter | - | 3 pips | `gmw` |

---

## Pack: The Galaxy's Most Wanted (`gmw`)

### Set: Groot

### [16001a] Groot
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 3, **HP**: 10, **Hand Size**: 5
- **Traits**: *Guardian.*
- **Rules Text**:
  > *Flora Colossus* — **Forced Interrupt**: When Groot would take any amount of damage, remove that many growth counters from him. For each growth counter removed this way, prevent 1 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/16001a.png` (300×418 px, 260.3 KB)
### [16001b] Groot
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 10, **Hand Size**: 6
- **Traits**: *Outlaw.*
- **Rules Text**:
  > *Growth Spurt* — **Action**: Place 2 growth counters on Groot (to a maximum of 10). (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/16001b.png` (300×418 px, 239.9 KB)
### [16002] Fruition
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (1–2/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Action**: Place 2 growth counters on Groot (to a maximum of 10).
- **Flavor**: *"I am Groot..." —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16002.png` (729×1045 px, 161.5 KB)
### [16003] "I am Groot"
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (3–4/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove threat from a scheme equal to the number of growth counters on Groot.
- **Flavor**: *"I am Groot!!!" —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16003.png` (730×1044 px, 179.3 KB)
### [16004] "I. AM. GROOT!"
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (5–6/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal damage to an enemy equal to the number of growth counters on Groot.
- **Flavor**: *"I. AM. GROOT!" —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16004.png` (730×1042 px, 193.8 KB)
### [16005] Root Stomp
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (7–9/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy. If this attack defeats that enemy, place 1 growth counter on Groot (to a maximum of 10).
- **Flavor**: *"I. Am. Groot." —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16005.png` (730×1042 px, 178.7 KB)
### [16006] "We Are Groot"
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (10/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Remove up to 4 growth counters from Groot → choose that many friendly characters. Give each of those characters a tough status card.
- **Flavor**: *"We Are Groot." —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16006.png` (730×1042 px, 190.3 KB)
### [16007] Fertile Ground
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (11/15)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Fertile Ground → place 1 growth counter on Groot (to a maximum of 10) and draw 1 card.
- **Flavor**: *"I...am... Groot." —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16007.png` (729×1045 px, 182.9 KB)
### [16008] Entangling Vines
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (12/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When Groot makes a basic thwart, remove 1 growth counter from him and exhaust Entangling Vines → Groot gets +2 THW for that thwart.
- **Flavor**: *"I am. GROOT!" —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16008.png` (729×1042 px, 194.6 KB)
### [16009] Lashing Vines
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (13/15)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Response**: After Groot uses a basic power, remove 2 growth counters from him and exhaust Lashing Vines → ready Groot.
- **Flavor**: *"I AM. Groot." —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16009.png` (730×1046 px, 192.9 KB)
### [16010] Vine Shield
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (14/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When Groot defends against an attack, remove 1 growth counter from him and exhaust Vine Shield → Groot gets +3 DEF for that attack.
- **Flavor**: *"I am Groot?" —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16010.png` (731×1046 px, 194.9 KB)
### [16011] Vine Spikes
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (15/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When Groot makes a basic attack, remove 1 growth counter from him and exhaust Vine Spikes → Groot gets +2 ATK for that attack.
- **Flavor**: *"We get it, you're Groot." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/16011.png` (729×1042 px, 194.8 KB)
### [16025] Wilt
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Groot Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Groot player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust your alter-ego → remove Wilt from the game.
  > • Remove 3 growth counters from Groot. If no growth counters were removed this way, this card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/16025.png` (730×1045 px, 182.6 KB)

### Set: Protection

### [16012] Starhawk — *Stakar Ogord*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 2), **HP**: 3, **Resources**: [physical]
- **Traits**: *Aerial. Guardian.*
- **Rules Text**:
  > **Interrupt**: When Starhawk takes damage exactly equal to his remaining hit points, return him to your hand.
- **Flavor**: *"I am one who knows."*
- **Image Asset**: `assets/card-art/bundles/cards/16012.png` (729×1045 px, 170.8 KB)
### [16013] Desperate Defense
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When your hero defends against an attack, it gets +2 DEF for that attack. If you take no damage from that attack, ready your hero.
### [16014] Fighting Fit
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to the villain (5 damage instead if your hero's remaining hit points are equal to or greater than your hero's starting hit points).
- **Flavor**: *"Prepare yourself, simpleton" —Drax*
- **Image Asset**: `assets/card-art/bundles/cards/16014.png` (730×1043 px, 181.3 KB)
### [16015] The Power of Protection
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Protection *(green)* card.
### [16016] Dauntless
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control.
  > Max 1 per player.
  > While your hero's remaining hit points are equal to or greater than your hero's starting hit points, your hero gains retaliate 1.
- **Image Asset**: `assets/card-art/bundles/cards/16016.png` (729×1046 px, 170.8 KB)
### [16017] Hard to Ignore
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Response**: After your hero defends against an attack and takes no damage, exhaust Hard to Ignore → remove 1 threat from the main scheme.
- **Flavor**: *"I will die before I yield!" —Drax*
- **Image Asset**: `assets/card-art/bundles/cards/16017.png` (730×1046 px, 194.1 KB)
### [16018] Indomitable
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Response**: After your hero defends, discard indomitable → ready your hero.
- **Flavor**: *"We have no choice. So we fight — and we win. There are no other options." —Captain America*

### Set: Basic

### [16019] Rocket Raccoon
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Guardian.*
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait.
  > **Interrupt**: When Rocket Raccoon attacks a minion, he gets +3 ATK for that attack. That attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/16019.png` (729×1046 px, 170.5 KB)
### [16020] Flora and Fauna
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Rules Text**:
  > Team-Up (Groot and Rocket Raccoon).
  > Max 1 per deck
  > **Hero Action**: Place 2 growth counters on Groot (to a maximum of 10) and ready him, or place 2 charge counters on a Rocket Raccoon upgrade and ready that upgrade.
- **Image Asset**: `assets/card-art/bundles/cards/16020.png` (730×1046 px, 178.5 KB)
### [16021] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [16022] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [16023] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [16024] Deft Focus
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Action**: Exhaust Deft Focus → reduce the resource cost of the next [[superpower]] card you play this turn by 1.
- **Image Asset**: `assets/card-art/bundles/cards/16024.png` (729×1045 px, 179.5 KB)
### [16047] Groot
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 47
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 2), **HP**: 6, **Resources**: [wild]
- **Traits**: *Guardian.*
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait.
  > **Response**: After Groot defends against an attack, heal 2 damage from him.
- **Flavor**: *"I am Groot!"*
- **Image Asset**: `assets/card-art/bundles/cards/16047.png` (730×1042 px, 178.7 KB)
### [16048] Flora and Fauna
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 48
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Rules Text**:
  > Team-Up (Groot and Rocket Raccoon).
  > Max 1 per deck
  > **Hero Action**: Place 2 growth counters on Groot (to a maximum of 10) and ready him, or place 2 charge counters on a Rocket Raccoon upgrade and ready that upgrade.
### [16049] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 49
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [16050] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [16051] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [16052] Booster Boots
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Play only if your identity has the [[guardian]] trait. Max 1 per player.
  > **Hero Interrupt**: When you would take any amount of damage from an attack, exhaust Booster Boots and discard the top card of your deck → prevent 1 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/16052.png` (730×1043 px, 179.6 KB)

### Set: Groot Nemesis

### [16026] Blazing Inferno
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot Nemesis (1/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Groot Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After the villain phase begins, deal 2 indirect damage to each player.
- **Flavor**: *Furnax rampage across Groot's homeworld, Planet X, bringing death and destruction to everything it touches.*
- **Image Asset**: `assets/card-art/bundles/cards/16026.png` (1046×727 px, 162.7 KB)
### [16027] Furnax
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Groot Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Leviatron.*
- **Rules Text**:
  > [star] **Forced Response**: After Furnax activates, deal 2 indirect damage to each player.
  > *(Groot's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/16027.png` (727×1045 px, 167.4 KB)
### [16028] Fan the Flames
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Groot Nemesis (3–5/5, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Groot Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Take 2 indirect damage. If Blazing Inferno is in play, take 1 additional indirect damage. If Furnax is in play, take 1 additional indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/16028.png` (713×1037 px, 166.4 KB)

### Set: Rocket Raccoon

### [16029a] Rocket Raccoon
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1, **DEF**: 1, **HP**: 9, **Hand Size**: 5
- **Traits**: *Guardian.*
- **Rules Text**:
  > *"Murdered You!"* — **Response**: After you deal excess damage to an enemy, draw 1 card.
- **Flavor**: *"That's it! You can attack me, you can call me names, but NO ONE touches my blaster!"*
- **Image Asset**: `assets/card-art/bundles/cards/16029a.png` (300×418 px, 232.6 KB)
### [16029b] Rocket Raccoon
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Genius. Outlaw.*
- **Rules Text**:
  > *Tinkering* — **Action**: Choose and discard a [[tech]] upgrade you control → draw 2 cards. (Limit once per round.)
- **Flavor**: *"Ain't nothin' like me, 'cept me."*
- **Image Asset**: `assets/card-art/bundles/cards/16029b.png` (728×1045 px, 190.3 KB)
### [16030] I've Got a Plan
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (1–2/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Response**: After you make a basic thwart (using your THW), ready Rocket Raccoon. Rocket Raccoon gets +1 THW while in hero form until the end of the phase.
- **Flavor**: *"No, I thought it'd be funny! Was it funny?" —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/16030.png` (729×1046 px, 191.7 KB)
### [16031] Reload
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (3–4/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action**: Ready each [[tech]] upgrade you control.
- **Flavor**: *"Me? I don't really care about people. I spend most of my time shooting at them." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/16031.png` (715×1046 px, 292.8 KB)
### [16032] Schadenfreude
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (5/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Rules Text**:
  > **Hero Action**: Until the end of the turn, heal 2 damage from Rocket Raccoon each time you deal any amount of damage to an enemy.
- **Flavor**: *"I live for the simple things... like how much this is gonna hurt." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/16032.png` (730×1043 px, 191.2 KB)
### [16033] Salvage
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (6–7/15, Qty: 2)
- **Stats**: **Resources**: [mental] [wild]
- **Rules Text**:
  > **Response**: After you spend this card, put a [[tech]] upgrade from your discard pile on top of your deck.
- **Image Asset**: `assets/card-art/bundles/cards/16033.png` (730×1045 px, 173.9 KB)
### [16034] Battery Pack
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (8–9/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Enters play with 2 charge counters on it.
  > **Action**: Exhaust Battery Pack → move a charge counter from this card to another [[tech]] upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/16034.png` (729×1042 px, 188.7 KB)
### [16035] Cybernetic Skeleton
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (10/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tech.*
- **Rules Text**:
  > You get +3 hit points.
  > While in hero form, Rocket Raccoon gets +1 ATK.
- **Flavor**: *"Yeah, yeah, look at the freak while you can." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/16035.png` (731×1042 px, 177.4 KB)
### [16036] Particle Cannon
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (11/15)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted. Enters play with 2 charge counters on it.
  > **Hero Action** *(attack)*: Exhaust Particle Cannon and remove 1 charge counter from it → deal 4 damage to an enemy. This attack gains overkill and ranged.
- **Image Asset**: `assets/card-art/bundles/cards/16036.png` (730×1043 px, 189.8 KB)
### [16037] Rocket Launcher
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (12/15)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted. Enters play with 2 charge counters on it.
  > **Hero Action**: Exhaust Rocket Launcher and remove 1 charge counter from it → choose a player. Deal 2 damage to the villain and each minion engaged with that player.
- **Image Asset**: `assets/card-art/bundles/cards/16037.png` (730×1043 px, 201.3 KB)
### [16038] Rocket's Pistol
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (13–14/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted. Enters play with 3 charge counters on it.
  > **Hero Action** *(attack)*: Exhaust Rocket's Pistol and remove 1 charge counter from it → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/16038.png` (730×1045 px, 183.7 KB)
### [16039] Thruster Boots
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (15/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > While in hero form, Rocket Raccoon gets +1 THW and gains the [[aerial]] trait.
- **Flavor**: *"Even from up here, I can tell that you're the ugliest human I've ever seen. And I hang out with Peter Quill." —Rocket Raccoon*
- **Image Asset**: `assets/card-art/bundles/cards/16039.png` (728×1045 px, 193.2 KB)
### [16053] Crisis on Halfworld
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rocket Raccoon Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Rocket Raccoon player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust your alter-ego → remove Crisis on Halfworld from the game.
  > • Discard the highest cost upgrade you control. If no upgrade was discarded this way, this card gains surge. Discard this obligation
- **Image Asset**: `assets/card-art/bundles/cards/16053.png` (730×1042 px, 180.1 KB)

### Set: Aggression

### [16040] Bug
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 40
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Hero Response**: After your hero makes a basic attack, heal 1 damage from Bug.
- **Flavor**: *"Whoopee! We're a *tik* team again! There ain't no way they can *tik* stop us now!"*
- **Image Asset**: `assets/card-art/bundles/cards/16040.png` (722×1035 px, 169.2 KB)
### [16041] Chase Them Down
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 41
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Response** *(thwart)*: After your hero attacks and defeats an enemy, remove 2 threat from a scheme.
- **Flavor**: *"Kamala, we don't have a theme song. Please stop humming one..." —Captain Marvel*
### [16042] Into the Fray
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 42
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 6 damage to a minion. For each point of excess damage dealt by this attack, remove 1 threat from the main scheme.
### [16043] Looking for Trouble
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 43
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Discard cards from the top of the encounter deck until you discard a minion. Put that minion into play engaged with you → remove 3 threat from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16043.png` (728×1045 px, 193.0 KB)
### [16044] Relentless Assault
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 44
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to a minion. If you paid for this card using a [physical] resource, this attack gains overkill. *(Excess damage from this attack is dealt to the villain.)*
### [16045] Follow Through
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 45
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When your hero's attack deals any amount of excess damage, increase that amount by 1.
- **Flavor**: *"That's a little excessive..."*
- **Image Asset**: `assets/card-art/bundles/cards/16045.png` (730×1042 px, 180.3 KB)
### [16046] Hand Cannon
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Pack Position: 46
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted. Uses (3 charge counters).
  > **Hero Interrupt**: When your hero makes a basic attack, exhaust Hand Cannon and remove 1 charge counter from it → your hero gets +2 ATK for that attack. That attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/16046.png` (731×1045 px, 171.9 KB)

### Set: Rocket Raccoon Nemesis

### [16054] Vendetta
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon Nemesis (1/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rocket Raccoon Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Flavor**: *"I know you hate that word. But hey, if it looks like a duck, quacks like a duck, and walks like a duck... it's a raccoon!" —Blackjack O'Hare*
- **Image Asset**: `assets/card-art/bundles/cards/16054.png` (1046×727 px, 157.6 KB)
### [16055] Blackjack O'Hare
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rocket Raccoon Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Quickstrike.
  > Villainous. (When this minion activates, give it a boost card.)
  > *(Rocket Raccoon's nemesis minion.)*
- **Flavor**: *Hahahahahahahahahahahahahaha!*
- **Image Asset**: `assets/card-art/bundles/cards/16055.png` (727×1045 px, 185.4 KB)
### [16056] Blackjack's Bazooka
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rocket Raccoon Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to Blackjack O'Hare, if able. If you cannot, attach to the villain.
  > **Hero Action**: Spend [mental][mental][mental] resources → Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/16056.png` (730×1043 px, 176.1 KB)
### [16057] Planetary Invasion
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Rocket Raccoon Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rocket Raccoon Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the top of the encounter deck until you discard a minion. Reveal that minion, then give it a tough status card.
- **Flavor**: *"What're you gonna do about it?!" —Blackjack O'Hare*
- **Image Asset**: `assets/card-art/bundles/cards/16057.png` (729×1043 px, 192.2 KB)

### Set: Brotherhood Of Badoon

### [16058] Drang
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (1/13)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1 [star], **ATK**: 2, **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > [star] **Forced Response**: After Drang schemes, resolve the Badoon Ship's *"Charge Up"* ability.
- **Flavor**: *<b><i>"Surrender to the might of the badoon!"</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16058.png` (729×1045 px, 182.1 KB)
### [16059] Drang
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (2/13)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 3, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > **When Revealed**: If Drang's Spear is in play, give Drang 1 facedown boost card; otherwise, search the encounter deck and discard pile for Drang's Spear, reveal it, and shuffle the encounter deck.
  > [star] **Forced Response**: After Drang schemes, resolve the Badoon Ship's *"Charge Up"* ability.
- **Image Asset**: `assets/card-art/bundles/cards/16059.png` (730×1043 px, 203.1 KB)
### [16060] Drang
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (3/13)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3 [star], **ATK**: 3, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > **When Revealed**: Discard the top 4[per_hero] cards of the encounter deck. Each time a minion is discarded this way, put it into play engaged with the player who is engaged with the fewest minions.
  > [star] **Forced Response**: After Drang activates, resolve the Badoon Ship's *"Charge Up"* ability.
- **Image Asset**: `assets/card-art/bundles/cards/16060.png` (727×1046 px, 198.6 KB)
### [16061a] Terrestrial Invasion
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (4/13)
- **Properties**: Stage 1A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Drang (I) and Drang (II). (Drang (II) and Drang(III) instead for expert mode.) Brotherhood of Badoon, Ship Command, and Standard encounter sets. One modular encounter set (Band of Badoon).
  > **Setup**: Put the Badoon Ship environment and the Milano support into play.
- **Flavor**: *<i>Drang's overwhelming forces have mounted a surprise attack against Earth!</i>*
- **Image Asset**: `assets/card-art/bundles/cards/16061a.png` (1049×726 px, 157.4 KB)
### [16061b] Terrestrial Invasion
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (4/13)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, resolve the Badoon Ship's *"Charge Up"* ability.
  > **First Player Action**: Exhaust the Milano → remove 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16061b.png` (1045×726 px, 169.0 KB)
### [16062a] Protect the Planet
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (5/13)
- **Properties**: Stage 2A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve the Badoon Ship's *"Charge Up"* ability.
- **Flavor**: *<i>The Badoon have punctured through Earth's defenses! Beat them back before it's too late.</i>*
- **Image Asset**: `assets/card-art/bundles/cards/16062a.png` (1046×727 px, 145.3 KB)
### [16062b] Protect the Planet
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (5/13)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 4 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, resolve the Badoon Ship's *"Charge Up"* ability.
  > **First Player Action**: Exhaust the Milano → choose to either remove 3 threat from this scheme or deal 3 damage to a minion.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/16062b.png` (1047×724 px, 191.8 KB)
### [16063] Badoon Ship
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (6/13)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Vehicle.*
- **Rules Text**:
  > *Charge Up* — **Special**: Place 1 barrage counter here. Then, if there are 4 or more barrage counters here, deal 2 indirect damage to each player and remove all barrage counters from here.
- **Flavor**: *<b><i>The Brotherhood of Badoon's ship is charging its cannons for a devastating attack against the heroes on the ground below.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16063.png` (730×1045 px, 184.3 KB)
### [16064] Drang's Spear
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (7/13)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Drang.
  > Drang gains stalwart. (He cannot be stunned or confused.)
  > **Hero Action**: Spend [mental][physical][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/16064.png` (408×603 px, 79.5 KB)
### [16065] Badoon Engineer
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (8–9/13, Qty: 2)
- **Stats**: **SCH**: 2 [star], **ATK**: 1 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > [star] **Forced Response**: After Badoon Engineer engages you or activates against you, resolve the Badoon Ship's *"Charge Up"* ability.
  >
  > ---
  >
  > [star] **Boost**: Resolve the Badoon Ship's *"Charge Up"* ability.
- **Image Asset**: `assets/card-art/bundles/cards/16065.png` (730×1045 px, 179.8 KB)
### [16066] Blockade
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (10/13)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 2[per_hero]. *(When revealed, place 2[per_hero] threat here.)*
  > **First Player Action**: Exhaust the Milano → remove 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16066.png` (1048×727 px, 165.7 KB)
### [16067] Bombardment
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (11/13)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After resolving step one of the villain phase, resolve the Badoon Ship's *"Charge Up"* ability.
  > **First Player Action**: Exhaust the Milano → remove 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16067.png` (1048×726 px, 162.3 KB)
### [16068] Oppressive Armada
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (12/13)
- **Stats**: **Base Threat**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 3[per_hero]. *When revealed, place 3[per_hero] threat here.)*
  > **First Player Action**: Exhaust the Milano → remove 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16068.png` (1049×726 px, 145.0 KB)
### [16069] Spatial Positioning
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Brotherhood Of Badoon (13/13)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brotherhood Of Badoon Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **First Player Action**: Exhaust the Milano → remove 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16069.png` (1049×726 px, 152.1 KB)

### Set: Infiltrate the Museum

### [16070] Collector
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (1/13)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elder.*
- **Rules Text**:
  > **Forced Interrupt**: When a card *(player or encounter)* would be placed into a discard pile from play, put it faceup into The Collection instead.
- **Flavor**: *<b><i>"I have a display case ready and waiting for our newest acquisitions!"</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16070.png` (730×1046 px, 186.4 KB)
### [16071] Collector
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (2/13)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 3, **ATK**: 2, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elder.*
- **Rules Text**:
  > **When Revealed**: In player order, each player must choose to either put the top card of their deck faceup into The Collection or take 3 damage.
  > **Forced Interrupt**: When a card *(player or encounter)* would be placed into a discard pile from play, put it faceup into The Collection instead.
- **Image Asset**: `assets/card-art/bundles/cards/16071.png` (730×1048 px, 189.1 KB)
### [16072] Collector
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (3/13)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 4, **ATK**: 3, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elder.*
- **Rules Text**:
  > **When Revealed**: Put the top card of each player's deck faceup into The Collection. Place 1 threat on the main scheme for each card in The Collection.
  > **Forced Interrupt**: When a card would be placed into a discard pile from play, put it faceup into The Collection instead, then place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16072.png` (730×1051 px, 189.3 KB)
### [16073a] The Grand Collection
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (4/13)
- **Properties**: Stage 1A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Collector (I) and Collector (II). *(Collector (II) and Collector (III) instead for expert mode.)* Infiltrate the Museum, Galactic Artifacts, and Standard encounter sets. One modular encounter set *(Menagerie Medley).*
  > **Setup**: Create "The Collection" game area *(see insert for details).* Put the top card of each player's deck faceup into The Collection.
- **Image Asset**: `assets/card-art/bundles/cards/16073a.png` (1049×731 px, 167.3 KB)
### [16073b] The Grand Collection
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (4/13)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 4 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Hero Action**: Choose to either exhaust your hero or spend 2 resources of any type → discard 1 card from The Collection *(to its owner's discard pile).* (Limit once per round per player.)
  > **If there are at least 5[per_hero] cards in The Collection or if this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/16073b.png` (1025×725 px, 168.1 KB)
### [16074] Biogram Image
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (5/13)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > Attach to Collector.
  > **Forced Interrupt**: When Collector would take any amount of damage, put this card faceup into The Collection → prevent all of that damage, then place threat on the main scheme equal to the amount prevented this way.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/16074.png` (730×1039 px, 201.3 KB)
### [16075] Monarch Starstalker
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (6/13)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Bounty Hunter.*
- **Rules Text**:
  > Villainous. *(When this minion activates, give it a boost card.)*
- **Flavor**: *<b>"No one can hide from me."</b>*
- **Image Asset**: `assets/card-art/bundles/cards/16075.png` (727×1053 px, 181.9 KB)
### [16076] Inconspicuous Box
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (7–8/13, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Put the lowest cost card you control faceup into The Collection. If you cannot, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If there are 3[per_hero] or fewer cards in The Collection, put the top card of your deck faceup into The Collection.
- **Image Asset**: `assets/card-art/bundles/cards/16076.png` (730×1048 px, 182.8 KB)
### [16077] View the Cosmos
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (9–10/13, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose one:
  > - Put the highest cost card from your hand faceup into The Collection.
  > - Discard the highest cost card from your hand, then place threat on the main scheme equal to its printed cost.
- **Image Asset**: `assets/card-art/bundles/cards/16077.png` (730×1045 px, 196.2 KB)
### [16078] Stay Awhile
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (11–12/13, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Choose to either spend [physical][physical] resources or put the top card of your deck faceup into The Collection.
  > **When Revealed (Hero)**: Collector attacks you with +1 ATK. If you take any amount of damage from that attack, put the top card of your deck faceup into The Collection.
- **Image Asset**: `assets/card-art/bundles/cards/16078.png` (729×1040 px, 180.4 KB)
### [16079] Caught Off Guard
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Infiltrate the Museum (13/13)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infiltrate the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard an upgrade or support you control. If no cards were discarded this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/16079.png` (729×1046 px, 184.5 KB)

### Set: Escape the Museum

### [16080a] Collector
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (1/12)
- **Properties**: Unique, Stage A1
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 8 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elder.*
- **Rules Text**:
  > [star] Collector gets +X SCH and +X ATK, where X is equal to the main scheme's current stage number.
  > **Forced Interrupt**: When Collector would be defeated, remove 3[per_hero] threat from the main scheme and flip this card instead.
- **Image Asset**: `assets/card-art/bundles/cards/16080a.png` (729×1043 px, 196.3 KB)
### [16080b] Collector
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (1/12)
- **Properties**: Unique, Stage A2
- **Stats**: **SCH**: 0, **ATK**: 0, **HP**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elder. Wounded.*
- **Rules Text**:
  > Collector cannot be defeated.
  > **Forced Interrupt**: When the round ends, flip this card, then set Collector's hit point dial to his printed hit points.
- **Flavor**: *<b>"You're more wily than I gave you credit for. No matter. Let's try again."</b>*
- **Image Asset**: `assets/card-art/bundles/cards/16080b.png` (728×1045 px, 194.9 KB)
### [16081a] Collector
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (2/12)
- **Properties**: Unique, Stage B1
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 10 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elder.*
- **Rules Text**:
  > [star] Collector gets +X SCH and +X ATK, where X is equal to the main scheme's current stage number.
  > **Forced Interrupt**: When Collector would be defeated, remove 3[per_hero] threat from the main scheme and flip this card instead.
- **Image Asset**: `assets/card-art/bundles/cards/16081a.png` (728×1041 px, 198.0 KB)
### [16081b] Collector
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (2/12)
- **Properties**: Unique, Stage B2
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elder. Wounded.*
- **Rules Text**:
  > Collector cannot be defeated.
  > **Forced Interrupt**: When the round ends, flip this card, then set Collector's hit point dial to his printed hit points.
- **Flavor**: *<b>"You're more wily than I gave you credit for. No matter. Let's try again."</b>*
- **Image Asset**: `assets/card-art/bundles/cards/16081b.png` (727×1046 px, 196.2 KB)
### [16082a] The Missing Milano
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (3/12)
- **Properties**: Stage 1A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Collector (A1) *(Collector (B1) instead for expert mode.)* Escape the Museum, Galactic Artifacts, Ship Command, and Standard encounter sets. One modular encounter set *(Menagerie Medley).*
  > **Setup**: Put the Library Labyrinth environment into play. Set aside the Ship Command modular encounter set.
- **Image Asset**: `assets/card-art/bundles/cards/16082a.png` (1050×731 px, 166.3 KB)
### [16082b] The Missing Milano
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (3/12)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 7 per hero, **Target Threat**: 11 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When the last threat is removed from this scheme, advance to stage 2A *(the players win by advancing).*
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *<b><i>You've been trapped inside the Collector's museum. Before you can escape, you must first find the Milano.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16082b.png` (1042×726 px, 158.9 KB)
### [16083a] Lost in the Museum
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (4/12)
- **Properties**: Stage 2A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Put the set-aside Milano support from the Ship Command encounter set into play under the first player's control.
- **Flavor**: *<b><i>The Milano is being held in a massive container. You try to pry open the side, but ultimately resolve to smashing the glass as hard as you can.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16083a.png` (1049×728 px, 150.2 KB)
### [16083b] Lost in the Museum
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (4/12)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 11 per hero, **Target Threat**: 15 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When the last threat is removed from this scheme, advance to stage 3A *(the players win by advancing).*
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *<b><i>Now that you've broken the Milano out of its cage, use it to find the front door!</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16083b.png` (1024×726 px, 176.7 KB)
### [16084a] The Great Escape
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (5/12)
- **Properties**: Stage 3A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Flip Library Labyrinth. Place 1 acceleration token on the main scheme. Shuffle the remaining cards from the set-aside Ship Command encounter set into the encounter deck.
- **Flavor**: *<b><i>You've found the exit! As the Milano bursts into space and readies its thrusters, you see the Museum Ship's cannons beginning to charge.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16084a.png` (1047×731 px, 165.8 KB)
### [16084b] The Great Escape
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (5/12)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 8 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **First Player Action**: Exhaust the Milano → remove 3 threat from here.
  > **If there is no threat here, the players win the game.**
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *<b><i>Almost clear! Outrun the Museum Ship's cannons to make your final escape!</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16084b.png` (1043×738 px, 190.1 KB)
### [16085a] Library Labyrinth
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (6/12)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location.*
- **Rules Text**:
  > "*This way?*" — **Hero Action**: Deal yourself 1 facedown encounter card → remove 5 threat from the main scheme. (Limit once per round per player.)
- **Flavor**: *The Collector's museum is a maze of miscellaneous trinkets from every culture and hapless creatures from every star system.*
- **Image Asset**: `assets/card-art/bundles/cards/16085a.png` (730×1042 px, 183.2 KB)
### [16085b] Museum Ship
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (6/12)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Vehicle.*
- **Rules Text**:
  > "*Hold on to your butts!*" — **Forced Interrupt**: When the villain phase begins, choose one:
  > • Exhaust the Milano → assign 2[per_hero] indirect damage among players.
  > • Assign 3[per_hero] indirect damage among players.
- **Image Asset**: `assets/card-art/bundles/cards/16085b.png` (725×1044 px, 168.1 KB)
### [16086] "I Have You Now!"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (7–9/12, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Exhaust your identity. Collector schemes.
  > **When Revealed (Hero)**: You are stunned. Collector attacks you.
  >
  > ---
  >
  > [star] **Boost**: Give Collector a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/16086.png` (731×1045 px, 187.0 KB)
### [16087] Impossible Geometry
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Escape the Museum (10–12/12, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Escape the Museum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1. *(When revealed, place 1 threat on the main scheme.)*
  > **When Revealed**: You are confused. If you are already confused, choose and discard 1 card you control.
- **Flavor**: *"I… am… Groot???" —Groot*
- **Image Asset**: `assets/card-art/bundles/cards/16087.png` (730×1046 px, 187.0 KB)

### Set: Nebula

### [16088] Nebula
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (1/22)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1 [star], **ATK**: 2 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > The first [[Technique]] attachment revealed each round gains surge.
  > [star] **Forced Interrupt**: When Nebula initiates an activation against you, resolve the "**Special**" ability on each [[Technique]] attachment in play, then discard each of those attachments.
- **Image Asset**: `assets/card-art/bundles/cards/16088.png` (729×1044 px, 184.3 KB)
### [16089] Nebula
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (2/22)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > The first [[Technique]] attachment revealed each round gains surge.
  > [star] **Forced Interrupt**: When Nebula initiates an activation against you, resolve the "**Special**" ability on each [[Technique]] attachment in play, then choose and discard 1 of those attachments.
- **Image Asset**: `assets/card-art/bundles/cards/16089.png` (729×1046 px, 184.9 KB)
### [16090] Nebula
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (3/22)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2 [star], **ATK**: 3 [star], **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > The first [[Technique]] attachment revealed each round gains surge.
  > [star] **Forced Interrupt**: When Nebula initiates an activation against you, resolve the "**Special**" ability on each [[Technique]] attachment in play. You may then remove the top card of your deck from the game to choose and discard 1 of those attachments.
- **Image Asset**: `assets/card-art/bundles/cards/16090.png` (730×1042 px, 186.7 KB)
### [16091a] The Art of Evasion
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (4/22)
- **Properties**: Stage 1A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Nebula (I) and Nebula (II). *(Nebula (II) and Nebula (III) instead for expert mode.)* Nebula, Power Stone, Ship Command, and Standard encounter sets. One modular encounter set *(Space Pirates).*
  > **Setup**: Put the Nebula's Ship environment and the Milano support into play. Attach the Power Stone to Nebula. Discard the top 2[per_hero] cards of the encounter deck, then attach each [[Technique]] attachment discarded this way to Nebula.
- **Image Asset**: `assets/card-art/bundles/cards/16091a.png` (1049×726 px, 172.3 KB)
### [16091b] The Art of Evasion
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (4/22)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +-1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > X is equal to the number of evasion counters on Nebula's Ship.
- **Flavor**: *<b><i>You've tracked Nebula's location but she's trying desperately to get away. This may be your only chance to take the Power Stone from her.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16091b.png` (1047×726 px, 164.0 KB)
### [16092a] Warp Drive Initiated
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (5/22)
- **Properties**: Stage 2A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 2 evasion counters on Nebula's Ship. For each evasion counter on Nebula's Ship, discard the top 2 cards of each player deck and the encounter deck.
- **Flavor**: *<b><i>With expert precision, Nebula's Ship pitches and yaws, outmaneuvering the Milano and putting Nebula just far enough away that she might have a chance to escape.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16092a.png` (1049×727 px, 164.7 KB)
### [16092b] Warp Drive Initiated
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (5/22)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 3 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +-1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > X is equal to the number of evasion counters on Nebula's Ship.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *<b><i>Nebula's engines are primed and ready. Take them out before she warp jumps!</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16092b.png` (1048×727 px, 181.6 KB)
### [16093] Nebula's Ship
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (6/22)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Vehicle.*
- **Rules Text**:
  > **Forced Interrupt**: When the villain phase begins, place 1 evasion counter here.
  > *Shoot the Thrusters!* - **First Player Action**: Exhaust the Milano and spend up to 2 resources of any type → remove 1 evasion counter from here for each resource spent this way.
- **Image Asset**: `assets/card-art/bundles/cards/16093.png` (730×1042 px, 178.4 KB)
### [16094] Cutthroat Ambition
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (7–8/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Technique.*
- **Rules Text**:
  > Attach to Nebula.
  > Nebula cannot take more than 5 damage from a single attack.
  > **Special**: Place 1 threat on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, attach this card to Nebula and resolve its **"Special"** ability.
- **Image Asset**: `assets/card-art/bundles/cards/16094.png` (729×1047 px, 179.1 KB)
### [16095] Evasive Maneuvering
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (9/22)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Technique.*
- **Rules Text**:
  > Attach to Nebula.
  > Nebula gains stalwart.
  > **Special**: You are stunned. If you are already stunned, give Nebula 1 facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, attach this card to Nebula and resolve its **"Special"** ability.
- **Image Asset**: `assets/card-art/bundles/cards/16095.png` (727×1044 px, 182.9 KB)
### [16096] Unyielding Persistence
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (10/22)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Technique.*
- **Rules Text**:
  > Attach to Nebula.
  > Nebula gains stalwart.
  > **Special**: Give Nebula a tough status card. If Nebula already has a tough status card, give Nebula 1 facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, attach this card to Nebula and resolve its **"Special"** ability.
- **Image Asset**: `assets/card-art/bundles/cards/16096.png` (730×1045 px, 195.9 KB)
### [16097] Weapon Mastery
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (11–12/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Technique.*
- **Rules Text**:
  > Attach to Nebula.
  > Nebula gains retaliate 1.
  > **Special**: Take 1 damage.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, attach this card to Nebula and resolve its **"Special"** ability.
- **Image Asset**: `assets/card-art/bundles/cards/16097.png` (730×1045 px, 171.7 KB)
### [16098] Wide Stance
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (13–14/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Traits**: *Technique.*
- **Rules Text**:
  > Attach to Nebula.
  > Reduce the amount of damage Nebula takes from each attack by 1.
  > **Special**: Discard 1 card at random from your hand.
  >
  > ---
  >
  > [star] **Boost**: After this activation ends, attach this card to Nebula and resolve its **"Special"** ability.
- **Image Asset**: `assets/card-art/bundles/cards/16098.png` (730×1043 px, 169.2 KB)
### [16099] Lethal Intent
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (15–16/22, Qty: 2)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Discard cards from the top of the encounter deck until a [[Technique]] attachment is discarded. Reveal that card.
- **Image Asset**: `assets/card-art/bundles/cards/16099.png` (1050×725 px, 158.6 KB)
### [16100] Barrel Roll
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (17–18/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1. Surge.
  > **When Revealed**: Place 1 evasion counter on Nebula's Ship.
  >
  > ---
  >
  > [star] **Boost**: Place 1 evasion counter on Nebula's Ship.
- **Image Asset**: `assets/card-art/bundles/cards/16100.png` (729×1042 px, 167.5 KB)
### [16101] Combat Ready
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (19–20/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the top of the encounter deck until a [[Technique]] attachment is discarded. Reveal that card, then resolve its **"Special"** ability.
- **Flavor**: *"I'll never be finished until I've gotten what I want." —Nebula*
- **Image Asset**: `assets/card-art/bundles/cards/16101.png` (729×1044 px, 188.9 KB)
### [16102] Ruthless
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Nebula (21–22/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nebula Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Nebula schemes. If threat is placed by this activation, place 1 evasion counter on Nebula's Ship.
  > **When Revealed (Hero)**: Nebula attacks you. If damage is dealt by this activation, place 1 evasion counter on Nebula's Ship.
- **Image Asset**: `assets/card-art/bundles/cards/16102.png` (733×1046 px, 198.2 KB)

### Set: Ronan the Accuser

### [16103] Ronan the Accuser
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (1/20)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Traits**: *Accuser Corps. Kree.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Interrupt**: When Ronan the Accuser activates against you, give him 1 additional boost card if you control the Power Stone.
- **Flavor**: *<b><i>"There is no discussion, no debate. You are guilty."</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16103.png` (729×1044 px, 186.7 KB)
### [16104] Ronan the Accuser
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (2/20)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 3 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Traits**: *Accuser Corps. Kree.*
- **Rules Text**:
  > Toughness.
  > **When Revealed**: Search the encounter deck and discard pile for the Cut the Power side scheme and reveal it. *(Shuffle.)*
  > [star] **Forced Interrupt**: When Ronan the Accuser activates against you, give him 1 additional boost card if you control the Power Stone.
- **Image Asset**: `assets/card-art/bundles/cards/16104.png` (730×1045 px, 188.8 KB)
### [16105] Ronan the Accuser
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (3/20)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3 [star], **ATK**: 4 [star], **HP**: 25 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Traits**: *Accuser Corps. Kree.*
- **Rules Text**:
  > Retaliate 1. Toughness.
  > **When Revealed**: Search the encounter deck and discard pile for the Superior Tactics side scheme and reveal it. *(Shuffle.)*
  > [star] **Forced Interrupt**: When Ronan the Accuser activates against you, give him 1 additional boost card if you control the Power Stone.
- **Image Asset**: `assets/card-art/bundles/cards/16105.png` (731×1046 px, 193.0 KB)
### [16106a] Interception Imminent
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (4/20)
- **Properties**: Stage 1A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Ronan the Accuser (I) and Ronan the Accuser (II). *(Ronan the Accuser (II) and Ronan the Accuser (III) instead for expert mode.)* Ronan the Accuser, Power Stone, Ship Command, and Standard encounter sets. One modular encounter set *(Kree Militants).*
  > **Setup**: Put the Kree Command Ship environment and the Milano support into play. Attach the Universal Weapon to Ronan the Accuser. Attach the Power Stone to the first player.
- **Image Asset**: `assets/card-art/bundles/cards/16106a.png` (1034×723 px, 176.3 KB)
### [16106b] Interception Imminent
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (4/20)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **First Player Action**: Exhaust the Milano → remove 3 threat from this scheme.
- **Flavor**: *<b><i>Ronan the Accuser's forces have ambushed the Milano, aiming to steal the Power Stone. With some quick wit and expert piloting, you may be able to halt their advance.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16106b.png` (1048×726 px, 160.8 KB)
### [16107a] "Take What Is Mine"
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (5/20)
- **Properties**: Stage 2A
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Attach the Power Stone to Ronan the Accuser. If it is already attached to him, give him 1 facedown boost card.
- **Flavor**: *<b><i>Ronan the Accuser's ship has docked with yours. Boarding the Milano, he makes one strike of his Universal Weapon to knock you off your feet. Before you're able to recover, he grabs the Power Stone.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16107a.png` (1041×727 px, 165.7 KB)
### [16107b] "Take What Is Mine"
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (5/20)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > While the Power Stone is attached to Ronan the Accuser, threat cannot be removed from this scheme.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *<b><i>Ronan the Accuser holds the Power Stone! Wrest it from his control before it's too late.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16107b.png` (1047×726 px, 173.1 KB)
### [16108] Kree Command Ship
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (6/20)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Aerial. Vehicle.*
- **Rules Text**:
  > **First Player Interrupt**: When a treachery card is revealed from the encounter deck, exhaust the Milano and spend 1 resource of any type → cancel that card's "When Revealed" effects.
- **Image Asset**: `assets/card-art/bundles/cards/16108.png` (731×1043 px, 168.1 KB)
### [16109] Universal Weapon
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (7/20)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Ronan the Accuser.
  > Ronan the Accuser gains stalwart.
  > **Hero Action**: Take 2 damage and deal yourself 1 facedown encounter card → shuffle Universal Weapon into the encounter deck.
  >
  > ---
  >
  > [star] **Boost**: Attach Universal Weapon to Ronan the Accuser.
- **Image Asset**: `assets/card-art/bundles/cards/16109.png` (730×1045 px, 185.9 KB)
### [16110] Fanaticism
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (8–9/20, Qty: 2)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Surge.
  > Attach to Ronan the Accuser. Uses (1 fury counter, plus 1[per_hero] additional fury counters).
  > [star] **Forced Interrupt**: When Ronan the Accuser attacks you, that attack gains overkill and piercing. At the end of that attack, remove 1 fury counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/16110.png` (729×1044 px, 178.4 KB)
### [16111] Cut the Power
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (10/20)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > [star] **Boost**: Choose to either exhaust the Milano or place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16111.png` (1049×727 px, 158.8 KB)
### [16112] Pincer Maneuver
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (11–12/20, Qty: 2)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 2[per_hero] *(When revealed, place 2[per_hero] threat here.)*.
  > **First Player Action**: Exhaust the Milano → remove 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16112.png` (1049×726 px, 184.9 KB)
### [16113] Superior Tactics
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (13/20)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > The Power Stone cannot be unattached from Ronan the Accuser.
  > **When Revealed**: Attach the Power Stone to Ronan the Accuser. If it is already attached to him, place 1[per_hero] threat here.
- **Flavor**: *<b><i>Ronan the Accuser's advanced Kree training and fanatical determination make him an opponent like no other.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16113.png` (1049×726 px, 188.6 KB)
### [16114] Single-Minded Fury
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (14–15/20, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Ronan the Accuser attacks the player who controls the Power Stone *(even if that player is in alter-ego form).* If no attack was made this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Attach the Power Stone to Ronan the Accuser.
- **Image Asset**: `assets/card-art/bundles/cards/16114.png` (730×1042 px, 160.3 KB)
### [16115] Kree Physiology
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (16–17/20, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Give Ronan the Accuser a tough status card. If he already has a tough status card, take 1 damage.
- **Flavor**: *"Kneel before me!" —Ronan the Accuser*
- **Image Asset**: `assets/card-art/bundles/cards/16115.png` (730×1044 px, 190.9 KB)
### [16116] "You Stand Accused!"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ronan the Accuser (18–20/20, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Ronan the Accuser Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Ronan the Accuser schemes with +1 SCH.
  > **When Revealed (Hero)**: Ronan the Accuser attacks you with +1 ATK.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/16116.png` (730×1042 px, 199.5 KB)

### Set: Band of Badoon

### [16117] Badoon Assassin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Band of Badoon (1–2/10, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Band of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > **Forced Response**: After Badoon Assassin engages your hero, it attacks you with +2 ATK.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, this attack gains overkill, piercing, and ranged.
- **Image Asset**: `assets/card-art/bundles/cards/16117.png` (729×1042 px, 175.3 KB)
### [16118] Badoon Grunt
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Band of Badoon (3–5/10, Qty: 3)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Band of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > **Forced Response**: After Badoon Grunt engages you, if there are no other minions engaged with you, deal yourself 1 facedown encounter card.
  >
  > ---
  >
  > [star] **Boost**: Put Badoon Grunt into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/16118.png` (730×1044 px, 192.4 KB)
### [16119] Badoon Lieutenant
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Band of Badoon (6/10)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Band of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > Patrol. *(While this minion is engaged with you, you cannot thwart the main scheme.)*
  >
  > ---
  >
  > [star] **Boost**: If this activation is a scheme, this card gets +2 boost icons ([boost][boost]) for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/16119.png` (729×1046 px, 185.6 KB)
### [16120] Badoon Sentry
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Band of Badoon (7–8/10, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Band of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > Retaliate 1.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card. If the villain already has a tough status card, this card gets +2 boost icons ([boost][boost]) for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/16120.png` (731×1043 px, 194.2 KB)
### [16121] Badoon Warlord
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Band of Badoon (9–10/10, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Band of Badoon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > [star] Badoon Warlord's attacks gain overkill.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, this card gets +2 boost icons ([boost][boost]) for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/16121.png` (732×1046 px, 177.6 KB)

### Set: Galactic Artifacts

### [16122] Cloak of Hercules
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Galactic Artifacts (1/9)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Galactic Artifacts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Artifact.*
- **Rules Text**:
  > Attach to the enemy with the lowest ATK.
  > **Hero Action**: Spend [physical][physical][physical] resources → discard this card.
- **Flavor**: *<b><i>The cloak of the fabled hero Hercules. Those fortunate enough to don this mantle are granted unimaginable strength.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16122.png` (730×1046 px, 162.7 KB)
### [16123] Obedience Potion
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Galactic Artifacts (2/9)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Galactic Artifacts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Artifact.*
- **Rules Text**:
  > Attach to your identity.
  > Attached character gets -1 THW, -1 ATK, and -1 DEF.
  > **Hero Action**: Take 1 damage and spend [mental][mental] resources → discard this card. Any player can do this.
- **Image Asset**: `assets/card-art/bundles/cards/16123.png` (730×1044 px, 175.1 KB)
### [16124] The Beyonder's Blazer
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Galactic Artifacts (3/9)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Galactic Artifacts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Artifact.*
- **Rules Text**:
  > Attach to the enemy with the highest SCH.
  > **Hero Action**: Place 2 threat on the main scheme and spend 2 resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/16124.png` (730×1047 px, 155.1 KB)
### [16125] The Poison
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Galactic Artifacts (4/9)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Galactic Artifacts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Artifact.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Interrupt**: When your turn begins, place 1 poison counter here, the take 1 damage for each poison counter here.
  > **Hero Action**: Spend 3 resources of different types → discard this card. Any player can do this.
- **Flavor**: *<b><i>The deadliest toxin in the galaxy.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16125.png` (729×1046 px, 173.1 KB)
### [16126] Vandarian Power Stone
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Galactic Artifacts (5/9)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Galactic Artifacts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Artifact.*
- **Rules Text**:
  > Attach to the enemy with the lowest SCH.
  > **Hero Action**: Spend [energy][energy][energy] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/16126.png` (730×1043 px, 161.7 KB)
### [16127] Hujahdarian Monarch Egg
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Galactic Artifacts (6/9)
- **Properties**: Unique
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Galactic Artifacts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 2[per_hero]. Victory 0.
  > **When Defeated**: The player who defeated this scheme may ready their identity.
- **Image Asset**: `assets/card-art/bundles/cards/16127.png` (1050×727 px, 148.1 KB)
### [16128] Magical Teapot
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Galactic Artifacts (7/9)
- **Properties**: Unique
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Galactic Artifacts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 2[per_hero]. Victory 0.
  > **When Defeated**: The player who defeated this scheme may heal 4 damage from their identity.
- **Image Asset**: `assets/card-art/bundles/cards/16128.png` (1050×725 px, 142.8 KB)
### [16129] Philosopher's Stone
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Galactic Artifacts (8/9)
- **Properties**: Unique
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Galactic Artifacts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 2[per_hero]. Victory 0.
  > **When Defeated**: The player who defeated this scheme may draw 2 cards.
- **Image Asset**: `assets/card-art/bundles/cards/16129.png` (1038×706 px, 162.4 KB)
### [16130] Crystal Ball
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Galactic Artifacts (9/9)
- **Properties**: Unique
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Galactic Artifacts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 2[per_hero]. Victory 0.
  > **When Defeated**: The player who defeated this scheme may play a card from their hand, reducing its resources cost by 3.
- **Image Asset**: `assets/card-art/bundles/cards/16130.png` (1050×727 px, 172.0 KB)

### Set: Kree Militants

### [16131] Kree Combat Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Kree Militants (1/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kree Militants Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to the enemy with the highest ATK.
  > Reduce the amount of damage attached character takes from each attack by 1.
  > **Hero Action**: Spend 3 resources of the same type → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/16131.png` (731×1044 px, 174.4 KB)
### [16132] Kree Commando
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Kree Militants (2–4/9, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Kree Militants Set Icon (printed bottom-right next to deck number)
- **Traits**: *Kree. Soldier.*
- **Rules Text**:
  > Patrol. *(While this minion is engaged with you, you cannot thwart the main scheme.)*
  >
  > ---
  >
  > [star] **Boost**: If this is an attack, this attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/16132.png` (730×1044 px, 183.1 KB)
### [16133] Kree Lieutenant
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Kree Militants (5–6/9, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Kree Militants Set Icon (printed bottom-right next to deck number)
- **Traits**: *Kree. Soldier.*
- **Rules Text**:
  > Guard. Stalwart. *(This character cannot be stunned or confused.)*
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, this card gets +3 boost icons ([boost][boost][boost]) for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/16133.png` (731×1042 px, 191.6 KB)
### [16134] Kree Private
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Kree Militants (7–9/9, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Kree Militants Set Icon (printed bottom-right next to deck number)
- **Traits**: *Kree. Soldier.*
- **Rules Text**:
  > Quickstrike. *(After this minion engages your hero, it attacks you.)*
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/16134.png` (729×1044 px, 186.1 KB)

### Set: Menagerie Medley

### [16135] Psionic Ghost
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Menagerie Medley (1–4/9, Qty: 4)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Menagerie Medley Set Icon (printed bottom-right next to deck number)
- **Traits**: *Ghost.*
- **Rules Text**:
  > **When Revealed**: You are confused. If you are already confused, take 1 damage.
  >
  > ---
  >
  > [star] **Boost**: Put Psionic Ghost into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/16135.png` (728×1045 px, 154.8 KB)
### [16136] Servant Bot
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Menagerie Medley (5–7/9, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Menagerie Medley Set Icon (printed bottom-right next to deck number)
- **Traits**: *Robot.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
  > Patrol. *(While this minion is engaged with you, you cannot thwart the main scheme.)*
- **Flavor**: *<b><i>"FIND. THE. INTRUDERS."</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16136.png` (729×1043 px, 190.4 KB)
### [16137] Starshark
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Menagerie Medley (8–9/9, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Menagerie Medley Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature. Elite.*
- **Rules Text**:
  > Quickstrike.
  > [star] Starshark's attacks deal indirect damage.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/16137.png` (730×1043 px, 159.5 KB)

### Set: Space Pirates

### [16138] Pirate Commander
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Space Pirates (1/8)
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Space Pirates Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After this minion attacks and damages you, remove 1 card at random in your hand from the game.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/16138.png` (721×1038 px, 181.5 KB)
### [16139] Pirate Lackey
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Space Pirates (2–5/8, Qty: 4)
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Space Pirates Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After this minion attacks and damages you, remove the top card of your deck from the game.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/16139.png` (730×1043 px, 177.0 KB)
### [16140] Sound the Alarms
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Space Pirates (6/8)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Space Pirates Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each enemy gets +1 ATK.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/16140.png` (1048×725 px, 154.4 KB)
### [16141] Honor Among Thieves
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Space Pirates (7–8/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Space Pirates Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the top of the encounter deck until a [[Criminal]] minion is discarded. Reveal that minion, then give that minion a tough status card and the villain 1 facedown boost card.
- **Flavor**: *<b><i>A family that steals together stays together.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/16141.png` (729×1042 px, 187.4 KB)

### Set: Ship Command

### [16142] Milano
- **Type**: `Support`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ship Command (1/7)
- **Properties**: Unique, Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Ship Command Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Vehicle.*
- **Rules Text**:
  > Permanent. Setup.
  > The first player controls the Milano.
  > *Piloting* - **Resource**: Exhaust the Milano → generate a [wild] resource for any player.
- **Image Asset**: `assets/card-art/bundles/cards/16142.png` (729×1042 px, 173.7 KB)
### [16143] Rogue Vessel
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ship Command (2/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ship Command Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Vehicle.*
- **Rules Text**:
  > Surge.
  > **Forced Interrupt**: When the villain phase ends, deal 1 damage to each player.
  > **First Player Action**: Exhaust the Milano and spend 2 resources of any type → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/16143.png` (728×1045 px, 166.7 KB)
### [16144] Cannonade
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ship Command (3/7)
- **Stats**: **Base Threat**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ship Command Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 3[per_hero] *(When revealed, place 3[per_hero] threat here.)*.
  > **First Player Action**: Exhaust the Milano → remove 3 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16144.png` (1047×727 px, 165.1 KB)
### [16145] Blind Side
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ship Command (4/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ship Command Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. *(While you are resolving this card, other players cannot help you.)*
  > **When Revealed**: Choose one:
  > -Exhaust the Milano.
  > -Spend [physical][physical] resources.
  > - Stun the first player.
- **Image Asset**: `assets/card-art/bundles/cards/16145.png` (707×1044 px, 169.6 KB)
### [16146] Hull Breach
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ship Command (5/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ship Command Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. *(While you are resolving this card, other players cannot help you.)*
  > **When Revealed**: Choose one:
  > -Exhaust the Milano.
  > -Spend [mental][mental] resources.
  > - Deal 3 damage to the first player.
- **Image Asset**: `assets/card-art/bundles/cards/16146.png` (730×1044 px, 172.3 KB)
### [16147] Power Siphon
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ship Command (6/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ship Command Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. *(While you are resolving this card, other players cannot help you.)*
  > **When Revealed**: Choose one:
  > -Exhaust the Milano.
  > -Spend [energy][energy] resources.
  > - Discard 1 card at random from the first player's hand.
- **Image Asset**: `assets/card-art/bundles/cards/16147.png` (730×1042 px, 173.3 KB)
### [16148] Special Delivery
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Ship Command (7/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Ship Command Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: You may exhaust the Milano. If you do not, the villain schemes with +1 SCH.
  > **When Revealed (Hero)**: You may exhaust the Milano. If you do not, the villain attacks you with +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/16148.png` (730×1044 px, 168.8 KB)

### Set: Power Stone

### [16149] Power Stone
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Power Stone (1/1)
- **Properties**: Unique, Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Power Stone Set Icon (printed bottom-right next to deck number)
- **Traits**: *Infinity Stone.*
- **Rules Text**:
  > Setup. Attach to the villain.
  > Permanent.
  > **Forced Response**: After a hero or villain deals 3 or more damage to attached character with a single attack, attach Power Stone to the attacking hero or villain.
- **Image Asset**: `assets/card-art/bundles/cards/16149.png` (730×1045 px, 170.5 KB)

### Set: The Market

### [16150] Brainstorm
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (1/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thwart.*
- **Rules Text**:
  > Unit Cost 1.
  > **Hero Action** *(thwart)*: Name a card type, then look at the top card of your deck. If that card is of named type, remove 3 threat from the main scheme. Place that card on the top or bottom of your deck, then draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16150.png` (729×1046 px, 183.1 KB)
### [16151] By Any Means
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (2/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Attack.*
- **Rules Text**:
  > Unit Cost 1.
  > **Hero Action** *(attack)*: Place 2 threat on the main scheme. Deal 3 damage to the villain. Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16151.png` (729×1045 px, 186.4 KB)
### [16152] Contingency Plan
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (3/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Attack.*
- **Rules Text**:
  > Unit Cost 1.
  > **Hero Action** *(attack)*: Discard the top 4 cards of your deck. For each different resource type discarded this way, deal 1 damage to an enemy. Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16152.png` (730×1046 px, 190.8 KB)
### [16153] In Defiance
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (4/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 1.
  > **Hero Interrupt**: When an identity would take any amount of damage from an attack, prevent 2 of that damage. Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16153.png` (730×1044 px, 188.2 KB)
### [16154] Calculate the Odds
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (5/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 2.
  > **Hero Action**: Draw 1 card and choose a player. That player may draw 1 card, then choose and discard 1 card from their hand.
- **Image Asset**: `assets/card-art/bundles/cards/16154.png` (728×1040 px, 172.0 KB)
### [16155] Creative Solution
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (6/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 2.
  > **Hero Action**: Draw 1 card and remove a status card from any character. If the status card type removed this way was:
  > - Tough - Deal 3 damage to an enemy.
  > - Stun - Remove 3 threat from a scheme.
  > - Confuse - Heal 3 damage from an identity.
- **Image Asset**: `assets/card-art/bundles/cards/16155.png` (730×1042 px, 181.8 KB)
### [16156] Grapple
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (7/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 2.
  > **Hero Action**: Deal 1 damage to an enemy and stun it. Stun your hero. Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16156.png` (731×1046 px, 174.4 KB)
### [16157] Wing It
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (8/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 2.
  > **Hero Action**: Deal 1 damage to an enemy and confuse it. Confuse your hero. Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16157.png` (729×1045 px, 161.6 KB)
### [16158] Close Call
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (9/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 3.
  > **Hero Interrupt**: When a boost card is turned faceup, cancel that card's **"Boost"** ability and all of its boost icons *(*[boost]*)*, then discard it. Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16158.png` (728×1045 px, 191.8 KB)
### [16159] Defy Danger
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (10/28)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Attack.*
- **Rules Text**:
  > Unit Cost 3.
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy and discard the top card of the encounter deck? Take 1 damage for each boost icon *(*[boost]*)* discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/16159.png` (729×1045 px, 182.6 KB)
### [16160] In Harm's Way
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (11/28)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thwart.*
- **Rules Text**:
  > Unit Cost 3.
  > **Hero Action** *(thwart)*: Take 2 damage. Remove 5 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16160.png` (730×1045 px, 157.9 KB)
### [16161] Take the Fight to Them
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (12/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 3.
  > **Hero Action**: Look at the top 2[per_hero] cards of the encounter deck. Discard any number of those, then place the rest on the top and/or bottom of the encounter deck in any order. Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16161.png` (730×1043 px, 179.9 KB)
### [16162] Armor Plating
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (13/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Milano Mod.*
- **Rules Text**:
  > Unit Cost 4.
  > **Hero Interrupt**: When an identity would take any amount of damage, exhaust Armor Plating → prevent 1 of that damage (2 of that damage instead if you control the Milano).
- **Image Asset**: `assets/card-art/bundles/cards/16162.png` (730×1043 px, 171.9 KB)
### [16163] Heavy Cannon
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (14/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Milano Mod. Weapon.*
- **Rules Text**:
  > Unit Cost 4.
  > **Hero Action**: Exhaust Heavy Cannon → deal 1 damage to each enemy. If you control the Milano, deal 1 additional damage to the villain.
- **Image Asset**: `assets/card-art/bundles/cards/16163.png` (726×1046 px, 174.2 KB)
### [16164] Hyper Thrusters
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (15/28)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Milano Mod. Tech.*
- **Rules Text**:
  > Unit Cost 4.
  > **Hero Action**: Exhaust Hyper Thrusters → remove 1 threat from each scheme. If you control the Milano, remove 1 additional threat from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/16164.png` (730×1043 px, 165.5 KB)
### [16165] Reactor Core
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (16/28)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Milano Mod. Tech.*
- **Rules Text**:
  > Unit Cost 4.
  > **Hero Action**: Exhaust Reactor Core and discard the top 2 cards of your deck (the top card instead if you control the Milano) → reduce the resource cost of the next event you play this turn by 1.
- **Image Asset**: `assets/card-art/bundles/cards/16165.png` (730×1043 px, 179.0 KB)
### [16166] Ardent Resolve
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (17/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 5.
  > **Hero Action**: Ready a friendly character. Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16166.png` (729×1045 px, 158.5 KB)
### [16167] Onrush
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (18/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 5.
  > **Hero Interrupt**: When a card is revealed from the encounter deck, cancel the effects of that card and discard it.
- **Image Asset**: `assets/card-art/bundles/cards/16167.png` (729×1046 px, 178.0 KB)
### [16168] Safeguard
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (19/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 5.
  > **Hero Action**: Give up to 2 friendly characters each a tough status card. Draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16168.png` (730×1045 px, 162.2 KB)
### [16169] Sure Gamble
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (20/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 5.
  > **Hero Action**: Reduce the resource cost of the next card played this phase by 3.
- **Image Asset**: `assets/card-art/bundles/cards/16169.png` (730×1045 px, 172.8 KB)
### [16170] Cargo Hold
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (21/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Milano Mod.*
- **Rules Text**:
  > Unit Cost 6.
  > **Hero Action**: Exhaust Cargo Hold → heal 1 damage from a friendly character. If you control the Milano, heal 1 damage from your identity.
- **Image Asset**: `assets/card-art/bundles/cards/16170.png` (747×1046 px, 193.1 KB)
### [16171] Mounted Laser
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (22/28)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Milano Mod. Weapon.*
- **Rules Text**:
  > Unit Cost 6.
  > **Hero Action**: Exhaust Mounted Laser → deal 2 damage to an enemy (3 damage instead if you control the Milano).
- **Image Asset**: `assets/card-art/bundles/cards/16171.png` (730×1042 px, 176.4 KB)
### [16172] Navigation Column
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (23/28)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Milano Mod. Tech.*
- **Rules Text**:
  > Unit Cost 6.
  > **Hero Action**: Exhaust Navigation Column, choose and discard 1 card from your hand (discard the top card of your deck instead if you control the Milano) → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16172.png` (728×1044 px, 199.2 KB)
### [16173] Targeting Screen
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (24/28)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Traits**: *Milano Mod. Tech.*
- **Rules Text**:
  > Unit Cost 6.
  > **Hero Action**: Exhaust Targeting Screen → remove 2 threat from a scheme (3 threat instead if you control the Milano).
- **Image Asset**: `assets/card-art/bundles/cards/16173.png` (729×1046 px, 180.5 KB)
### [16174] Grand Strategy
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (25/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 7.
  > **Hero Action**: Draw up to your maximum hand size. Remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/16174.png` (730×1045 px, 157.9 KB)
### [16175] Power Unleashed
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (26/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 7.
  > **Hero Action**: Deal 5 damage to the villain and remove 5 threat from the main scheme. Remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/16175.png` (730×1045 px, 185.6 KB)
### [16176] Tried and True
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (27/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 7.
  > **Hero Action**: Choose a player. That player may add up to 3 cards from their discard pile to their hand. Remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/16176.png` (730×1043 px, 171.2 KB)
### [16177] Triple Threat
- **Type**: `Event`
- **Faction / Aspect**: Campaign
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: The Market (28/28)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Market Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Unit Cost 7.
  > **Hero Action**: Ready up to 3 characters. Remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/16177.png` (730×1045 px, 172.4 KB)

### Set: Challenge

### [16178a] Badoon Blitz
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (1/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Standard Mode Only.**
  > Hinder 3[per_hero]. *(When revealed, place 3[per_hero] threat here.)*
  > Victory 1. *(When defeated, add this card to the victory display.)*
  > **When Defeated**: Each player may draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/16178a.png` (1049×726 px, 171.4 KB)
### [16178b] Badoon Blitz
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (1/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Expert Mode Only.**
  > Hinder 4[per_hero]. Victory 1.
  > **When Defeated**: Each player must choose and discard 1 card from their hand.
- **Image Asset**: `assets/card-art/bundles/cards/16178b.png` (1035×704 px, 157.7 KB)
### [16179a] Gallery of Splendor
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (2/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Standard Mode Only.**
  > Hinder 3[per_hero]. Victory 1.
  > **When Defeated**: Place the top card of each player's deck faceup into the Collection.
- **Image Asset**: `assets/card-art/bundles/cards/16179a.png` (1050×724 px, 177.7 KB)
### [16179b] Gallery of Splendor
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (2/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **Expert Mode Only.**
  > Hinder 4[per_hero]. Victory 1.
  > **When Defeated**: Each player must place 1 card at random from their hand faceup into The Collection.
- **Image Asset**: `assets/card-art/bundles/cards/16179b.png` (1048×725 px, 169.7 KB)
### [16180a] "There is No Escape"
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (3/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Standard Mode Only.**
  > Hinder 3[per_hero]. Victory 1.
  > **When Defeated**: Deal 1 damage to each player.
- **Image Asset**: `assets/card-art/bundles/cards/16180a.png` (1045×725 px, 155.1 KB)
### [16180b] "There is No Escape"
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (3/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **Expert Mode Only.**
  > Hinder 4[per_hero]. Victory 1.
  > **When Defeated**: Deal 2 damage to each player.
- **Image Asset**: `assets/card-art/bundles/cards/16180b.png` (1047×725 px, 155.9 KB)
### [16181a] Guerrilla Tactics
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (4/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Standard Mode Only.**
  > Hinder 3[per_hero]. Victory 1.
  > **When Defeated**: Place 2 evasion counters on Nebula's Ship.
- **Image Asset**: `assets/card-art/bundles/cards/16181a.png` (1046×726 px, 167.3 KB)
### [16181b] Guerrilla Tactics
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (4/5)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase), Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Expert Mode Only.**
  > Hinder 4[per_hero]. Victory 1.
  > **When Defeated**: Place 3 evasion counters on Nebula's Ship.
- **Image Asset**: `assets/card-art/bundles/cards/16181b.png` (1048×726 px, 165.8 KB)
### [16182a] Kree Supremacy
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (5/5)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **Standard Mode Only.**
  > Hinder 3[per_hero]. Victory 1.
- **Image Asset**: `assets/card-art/bundles/cards/16182a.png` (1042×725 px, 161.1 KB)
### [16182b] Kree Supremacy
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Challenge (5/5)
- **Stats**: **Base Threat**: 7
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Challenge Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase), Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round), Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **Expert Mode Only.**
  > Hinder 4[per_hero]. Victory 1.
- **Image Asset**: `assets/card-art/bundles/cards/16182b.png` (1044×726 px, 164.4 KB)

### Set: Badoon Headhunter

### [16183] Badoon Headhunter
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Badoon Headhunter (1/5)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Badoon Headhunter Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > Victory 2. *(When defeated, add this card to the victory display.)*
  > Villainous. *(When this minion activates, give it a boost card.)*
  >
  > ---
  >
  > [star] **Boost**: Put Badoon Headhunter into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/16183.png` (730×1043 px, 183.3 KB)
### [16184] On the Hunt
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Badoon Headhunter (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Badoon Headhunter Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Choose to either take 2 damage or discard 1 card at random from your hand.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/16184.png` (730×1046 px, 175.7 KB)
### [16185] Dead to Rights
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Badoon Headhunter (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Badoon Headhunter Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Exhaust your identity. If you cannot, place 2 threat on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/16185.png` (730×1050 px, 182.4 KB)
### [16186] Headhunter's Henchman
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Badoon Headhunter (4/5)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Badoon Headhunter Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon.*
- **Rules Text**:
  > Surge. Patrol. *(While this minion is engaged with you, you cannot thwart the main scheme.)*
- **Image Asset**: `assets/card-art/bundles/cards/16186.png` (730×1045 px, 157.0 KB)
### [16187] Fugitive Recovery
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Galaxy's Most Wanted (`gmw`)
- **Deck / Set**: Badoon Headhunter (5/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Badoon Headhunter Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Surge.
  > Hinder 3[per_hero]. *(When revealed, place 3[per_hero] threat here.)*
- **Image Asset**: `assets/card-art/bundles/cards/16187.png` (1049×726 px, 159.8 KB)

