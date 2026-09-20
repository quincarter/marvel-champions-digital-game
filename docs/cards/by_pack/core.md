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
| `01001a` | Spider-Man | Hero | Spider-Man | THW:1 ATK:2 DEF:3 HP:10 | - | `core` |
| `01001b` | Peter Parker | Alter-Ego | Spider-Man | HP:10 | - | `core` |
| `01002` | Black Cat | Ally | Spider-Man | THW:1 ATK:1 HP:2 | - | `core` |
| `01003` | Backflip | Event | Spider-Man | - | - | `core` |
| `01004` | Enhanced Spider-Sense | Event | Spider-Man | - | - | `core` |
| `01005` | Swinging Web Kick | Event | Spider-Man | - | - | `core` |
| `01006` | Aunt May | Support | Spider-Man | - | - | `core` |
| `01007` | Spider-Tracer | Upgrade | Spider-Man | - | - | `core` |
| `01008` | Web-Shooter | Upgrade | Spider-Man | - | - | `core` |
| `01009` | Webbed Up | Upgrade | Spider-Man | - | - | `core` |
| `01010a` | Captain Marvel | Hero | Captain Marvel | THW:2 ATK:2 DEF:1 HP:12 | - | `core` |
| `01010b` | Carol Danvers | Alter-Ego | Captain Marvel | HP:12 | - | `core` |
| `01011` | Spider-Woman | Ally | Captain Marvel | THW:2 ATK:2 HP:2 | - | `core` |
| `01012` | Crisis Interdiction | Event | Captain Marvel | - | - | `core` |
| `01013` | Photonic Blast | Event | Captain Marvel | - | - | `core` |
| `01014` | Energy Absorption | Resource | Captain Marvel | - | - | `core` |
| `01015` | Alpha Flight Station | Support | Captain Marvel | - | - | `core` |
| `01016` | Captain Marvel's Helmet | Upgrade | Captain Marvel | - | - | `core` |
| `01017` | Cosmic Flight | Upgrade | Captain Marvel | - | - | `core` |
| `01018` | Energy Channel | Upgrade | Captain Marvel | - | - | `core` |
| `01019a` | She-Hulk | Hero | She-Hulk | THW:1 ATK:3 DEF:2 HP:15 | - | `core` |
| `01019b` | Jennifer Walters | Alter-Ego | She-Hulk | HP:15 | - | `core` |
| `01020` | Hellcat | Ally | She-Hulk | THW:2 ATK:1 HP:3 | - | `core` |
| `01021` | Gamma Slam | Event | She-Hulk | - | - | `core` |
| `01022` | Ground Stomp | Event | She-Hulk | - | - | `core` |
| `01023` | Legal Practice | Event | She-Hulk | - | - | `core` |
| `01024` | One-Two Punch | Event | She-Hulk | - | - | `core` |
| `01025` | Split Personality | Event | She-Hulk | - | - | `core` |
| `01026` | Superhuman Law Division | Support | She-Hulk | - | - | `core` |
| `01027` | Focused Rage | Upgrade | She-Hulk | - | - | `core` |
| `01028` | Superhuman Strength | Upgrade | She-Hulk | - | - | `core` |
| `01029a` | Iron Man | Hero | Iron Man | THW:2 ATK:1 DEF:1 HP:9 | - | `core` |
| `01029b` | Tony Stark | Alter-Ego | Iron Man | HP:9 | - | `core` |
| `01030` | War Machine | Ally | Iron Man | THW:1 ATK:2 HP:4 | - | `core` |
| `01031` | Repulsor Blast | Event | Iron Man | - | - | `core` |
| `01032` | Supersonic Punch | Event | Iron Man | - | - | `core` |
| `01033` | Pepper Potts | Support | Iron Man | - | - | `core` |
| `01034` | Stark Tower | Support | Iron Man | - | - | `core` |
| `01035` | Arc Reactor | Upgrade | Iron Man | - | - | `core` |
| `01036` | Mark V Armor | Upgrade | Iron Man | - | - | `core` |
| `01037` | Mark V Helmet | Upgrade | Iron Man | - | - | `core` |
| `01038` | Powered Gauntlets | Upgrade | Iron Man | - | - | `core` |
| `01039` | Rocket Boots | Upgrade | Iron Man | - | - | `core` |
| `01040a` | Black Panther | Hero | Black Panther | THW:2 ATK:2 DEF:2 HP:11 | - | `core` |
| `01040b` | T'Challa | Alter-Ego | Black Panther | HP:11 | - | `core` |
| `01041` | Shuri | Ally | Black Panther | THW:1 ATK:1 HP:3 | - | `core` |
| `01042` | Ancestral Knowledge | Event | Black Panther | - | - | `core` |
| `01043a` | Wakanda Forever! | Event | Black Panther | - | - | `core` |
| `01043b` | Wakanda Forever! | Event | Black Panther | - | - | `core` |
| `01043c` | Wakanda Forever! | Event | Black Panther | - | - | `core` |
| `01043d` | Wakanda Forever! | Event | Black Panther | - | - | `core` |
| `01044` | Vibranium | Resource | Black Panther | - | - | `core` |
| `01045` | The Golden City | Support | Black Panther | - | - | `core` |
| `01046` | Energy Daggers | Upgrade | Black Panther | - | - | `core` |
| `01047` | Panther Claws | Upgrade | Black Panther | - | - | `core` |
| `01048` | Tactical Genius | Upgrade | Black Panther | - | - | `core` |
| `01049` | Vibranium Suit | Upgrade | Black Panther | - | - | `core` |
| `01050` | Hulk | Ally | Pack Position: 50 | ATK:3 HP:5 | - | `core` |
| `01051` | Tigra | Ally | Pack Position: 51 | THW:1 ATK:2 HP:3 | - | `core` |
| `01052` | Chase Them Down | Event | Pack Position: 52 | - | - | `core` |
| `01053` | Relentless Assault | Event | Pack Position: 53 | - | - | `core` |
| `01054` | Uppercut | Event | Pack Position: 54 | - | - | `core` |
| `01055` | The Power of Aggression | Resource | Pack Position: 55 | - | - | `core` |
| `01056` | Tac Team | Support | Pack Position: 56 | - | - | `core` |
| `01057` | Combat Training | Upgrade | Pack Position: 57 | - | - | `core` |
| `01058` | Daredevil | Ally | Pack Position: 58 | THW:2 ATK:2 HP:3 | - | `core` |
| `01059` | Jessica Jones | Ally | Pack Position: 59 | THW:1 ATK:2 HP:3 | - | `core` |
| `01060` | For Justice! | Event | Pack Position: 60 | - | - | `core` |
| `01061` | Great Responsibility | Event | Pack Position: 61 | - | - | `core` |
| `01062` | The Power of Justice | Resource | Pack Position: 62 | - | - | `core` |
| `01063` | Interrogation Room | Support | Pack Position: 63 | - | - | `core` |
| `01064` | Surveillance Team | Support | Pack Position: 64 | - | - | `core` |
| `01065` | Heroic Intuition | Upgrade | Pack Position: 65 | - | - | `core` |
| `01066` | Hawkeye | Ally | Pack Position: 66 | THW:1 ATK:1 HP:3 | - | `core` |
| `01067` | Maria Hill | Ally | Pack Position: 67 | THW:2 ATK:1 HP:2 | - | `core` |
| `01068` | Vision | Ally | Pack Position: 68 | THW:1 ATK:2 HP:3 | - | `core` |
| `01069` | Get Ready | Event | Pack Position: 69 | - | - | `core` |
| `01070` | Lead from the Front | Event | Pack Position: 70 | - | - | `core` |
| `01071` | Make the Call | Event | Pack Position: 71 | - | - | `core` |
| `01072` | The Power of Leadership | Resource | Pack Position: 72 | - | - | `core` |
| `01073` | The Triskelion | Support | Pack Position: 73 | - | - | `core` |
| `01074` | Inspired | Upgrade | Pack Position: 74 | - | - | `core` |
| `01075` | Black Widow | Ally | Pack Position: 75 | THW:2 ATK:1 HP:2 | - | `core` |
| `01076` | Luke Cage | Ally | Pack Position: 76 | THW:1 ATK:2 HP:5 | - | `core` |
| `01077` | Counter-Punch | Event | Pack Position: 77 | - | - | `core` |
| `01078` | Get Behind Me! | Event | Pack Position: 78 | - | - | `core` |
| `01079` | The Power of Protection | Resource | Pack Position: 79 | - | - | `core` |
| `01080` | Med Team | Support | Pack Position: 80 | - | - | `core` |
| `01081` | Armored Vest | Upgrade | Pack Position: 81 | - | - | `core` |
| `01082` | Indomitable | Upgrade | Pack Position: 82 | - | - | `core` |
| `01083` | Mockingbird | Ally | Pack Position: 83 | THW:1 ATK:1 HP:3 | - | `core` |
| `01084` | Nick Fury | Ally | Pack Position: 84 | THW:2 ATK:2 HP:3 | - | `core` |
| `01085` | Emergency | Event | Pack Position: 85 | - | - | `core` |
| `01086` | First Aid | Event | Pack Position: 86 | - | - | `core` |
| `01087` | Haymaker | Event | Pack Position: 87 | - | - | `core` |
| `01088` | Energy | Resource | Pack Position: 88 | - | - | `core` |
| `01089` | Genius | Resource | Pack Position: 89 | - | - | `core` |
| `01090` | Strength | Resource | Pack Position: 90 | - | - | `core` |
| `01091` | Avengers Mansion | Support | Pack Position: 91 | - | - | `core` |
| `01092` | Helicarrier | Support | Pack Position: 92 | - | - | `core` |
| `01093` | Tenacity | Upgrade | Pack Position: 93 | - | - | `core` |
| `01094` | Rhino | Villain | Rhino | SCH:1 ATK:2 HP:14 | - | `core` |
| `01095` | Rhino | Villain | Rhino | SCH:1 ATK:3 HP:15 | - | `core` |
| `01096` | Rhino | Villain | Rhino | SCH:1 ATK:4 HP:16 | - | `core` |
| `01097` | The Break-In! | Main Scheme | Rhino | - | - | `core` |
| `01097a` | The Break-In! | Main Scheme | Rhino | - | - | `core` |
| `01097b` | The Break-In! | Main Scheme | Rhino | - | - | `core` |
| `01098` | Armored Rhino Suit | Attachment | Rhino | - | - | `core` |
| `01099` | Charge | Attachment | Rhino | ATK:3 | 2 pips | `core` |
| `01100` | Enhanced Ivory Horn | Attachment | Rhino | ATK:1 | 2 pips | `core` |
| `01101` | Hydra Mercenary | Minion | Rhino | SCH:0 ATK:1 HP:3 | 1 pips | `core` |
| `01102` | Sandman | Minion | Rhino | SCH:2 ATK:3 HP:4 | 2 pips | `core` |
| `01103` | Shocker | Minion | Rhino | SCH:1 ATK:2 HP:3 | 2 pips | `core` |
| `01104` | Hard to Keep Down | Treachery | Rhino | - | - | `core` |
| `01105` | "I'm Tough" | Treachery | Rhino | - | - | `core` |
| `01106` | Stampede | Treachery | Rhino | - | 1 pips | `core` |
| `01107` | Breakin' & Takin' | Side Scheme | Rhino | - | 2 pips | `core` |
| `01108` | Crowd Control | Side Scheme | Rhino | - | 2 pips | `core` |
| `01109` | Bomb Scare | Side Scheme | Bomb Scare | - | 2 pips | `core` |
| `01110` | Hydra Bomber | Minion | Bomb Scare | SCH:1 ATK:1 HP:2 | 1 pips | `core` |
| `01111` | Explosion | Treachery | Bomb Scare | - | 2 pips | `core` |
| `01112` | False Alarm | Treachery | Bomb Scare | - | 1 pips | `core` |
| `01113` | Klaw | Villain | Klaw | SCH:2 ATK:0 HP:12 | - | `core` |
| `01114` | Klaw | Villain | Klaw | SCH:2 ATK:1 HP:18 | - | `core` |
| `01115` | Klaw | Villain | Klaw | SCH:3 ATK:2 HP:22 | - | `core` |
| `01116` | Underground Distribution | Main Scheme | Klaw | - | - | `core` |
| `01116a` | Underground Distribution | Main Scheme | Klaw | - | - | `core` |
| `01116b` | Underground Distribution | Main Scheme | Klaw | - | - | `core` |
| `01117` | Secret Rendezvous | Main Scheme | Klaw | - | - | `core` |
| `01117a` | Secret Rendezvous | Main Scheme | Klaw | - | - | `core` |
| `01117b` | Secret Rendezvous | Main Scheme | Klaw | - | - | `core` |
| `01118` | Sonic Converter | Attachment | Klaw | ATK:1 | 3 pips | `core` |
| `01119` | Solid-Sound Body | Attachment | Klaw | - | 3 pips | `core` |
| `01120` | Armored Guard | Minion | Klaw | SCH:0 ATK:1 HP:3 | 1 pips | `core` |
| `01121` | Weapons Runner | Minion | Klaw | SCH:1 ATK:1 HP:2 | Star | `core` |
| `01122` | Klaw's Vengeance | Treachery | Klaw | - | 1 pips | `core` |
| `01123` | Sonic Boom | Treachery | Klaw | - | Star | `core` |
| `01124` | Sound Manipulation | Treachery | Klaw | - | 2 pips | `core` |
| `01125` | Defense Network | Side Scheme | Klaw | - | 2 pips | `core` |
| `01126` | Illegal Arms Factory | Side Scheme | Klaw | - | 2 pips | `core` |
| `01127` | The "Immortal" Klaw | Side Scheme | Klaw | - | - | `core` |
| `01128` | The Masters of Evil | Side Scheme | Masters of Evil | - | 2 pips | `core` |
| `01129` | Radioactive Man | Minion | Masters of Evil | SCH:1 ATK:1 HP:7 | Star | `core` |
| `01130` | Whirlwind | Minion | Masters of Evil | SCH:1 ATK:2 HP:6 | Star | `core` |
| `01131` | Tiger Shark | Minion | Masters of Evil | SCH:1 ATK:3 HP:6 | Star | `core` |
| `01132` | Melter | Minion | Masters of Evil | SCH:1 ATK:3 HP:5 | Star | `core` |
| `01133` | Masters of Mayhem | Treachery | Masters of Evil | - | 2 pips | `core` |
| `01134` | Ultron | Villain | Ultron | SCH:1 ATK:2 HP:17 | - | `core` |
| `01135` | Ultron | Villain | Ultron | SCH:2 ATK:2 HP:22 | - | `core` |
| `01136` | Ultron | Villain | Ultron | SCH:2 ATK:4 HP:27 | - | `core` |
| `01137` | The Crimson Cowl | Main Scheme | Ultron | SCH:2 ATK:3 | - | `core` |
| `01137a` | The Crimson Cowl | Main Scheme | Ultron | - | - | `core` |
| `01137b` | The Crimson Cowl | Main Scheme | Ultron | - | - | `core` |
| `01138` | Assault on NORAD | Main Scheme | Ultron | - | - | `core` |
| `01138a` | Assault on NORAD | Main Scheme | Ultron | - | - | `core` |
| `01138b` | Assault on NORAD | Main Scheme | Ultron | - | - | `core` |
| `01139` | Countdown to Oblivion | Main Scheme | Ultron | - | - | `core` |
| `01139a` | Countdown to Oblivion | Main Scheme | Ultron | - | - | `core` |
| `01139b` | Countdown to Oblivion | Main Scheme | Ultron | - | - | `core` |
| `01140` | Ultron Drones | Environment | Ultron | - | - | `core` |
| `01141` | Program Transmitter | Attachment | Ultron | SCH:1 | 1 pips | `core` |
| `01142` | Upgraded Drones | Attachment | Ultron | - | - | `core` |
| `01143` | Advanced Ultron Drone | Minion | Ultron | SCH:1 ATK:1 HP:4 | 2 pips | `core` |
| `01144` | Android Efficiency | Treachery | Ultron | - | - | `core` |
| `01144a` | Android Efficiency | Treachery | Ultron | - | Star | `core` |
| `01144b` | Android Efficiency | Treachery | Ultron | - | Star | `core` |
| `01144c` | Android Efficiency | Treachery | Ultron | - | Star | `core` |
| `01145` | Rage of Ultron | Treachery | Ultron | - | 2 pips | `core` |
| `01146` | Repair Sequence | Treachery | Ultron | - | 1 pips | `core` |
| `01147` | Swarm Attack | Treachery | Ultron | - | 1 pips | `core` |
| `01148` | Drone Factory | Side Scheme | Ultron | - | 2 pips | `core` |
| `01149` | Invasive AI | Side Scheme | Ultron | - | 3 pips | `core` |
| `01150` | Ultron's Imperative | Side Scheme | Ultron | - | 3 pips | `core` |
| `01151` | Under Attack | Side Scheme | Under Attack | - | 3 pips | `core` |
| `01152` | Vibranium Armor | Attachment | Under Attack | - | 1 pips | `core` |
| `01153` | Concussion Blasters | Attachment | Under Attack | - | 1 pips | `core` |
| `01154` | Concussive Blast | Treachery | Under Attack | - | Star | `core` |
| `01155` | Affairs of State | Obligation | Black Panther | - | 2 pips | `core` |
| `01156` | Usurp The Throne | Side Scheme | Black Panther Nemesis | - | 3 pips | `core` |
| `01157` | Killmonger | Minion | Black Panther Nemesis | SCH:2 ATK:2 HP:5 | 2 pips | `core` |
| `01158` | Heart-Shaped Herb | Treachery | Black Panther Nemesis | - | 1 pips | `core` |
| `01159` | Ritual Combat | Treachery | Black Panther Nemesis | - | 2 pips | `core` |
| `01160` | Legal Work | Obligation | She-Hulk | - | 2 pips | `core` |
| `01161` | Personal Challenge | Side Scheme | She-Hulk Nemesis | - | 3 pips | `core` |
| `01162` | Titania | Minion | She-Hulk Nemesis | SCH:1 ATK:-1 HP:6 | 2 pips | `core` |
| `01163` | Genetically Enhanced | Attachment | She-Hulk Nemesis | - | 1 pips | `core` |
| `01164` | Titania's Fury | Treachery | She-Hulk Nemesis | - | 1 pips | `core` |
| `01165` | Eviction Notice | Obligation | Spider-Man | - | 2 pips | `core` |
| `01166` | Highway Robbery | Side Scheme | Spider-Man Nemesis | - | 3 pips | `core` |
| `01167` | Vulture | Minion | Spider-Man Nemesis | SCH:1 ATK:3 HP:4 | 2 pips | `core` |
| `01168` | Sweeping Swoop | Treachery | Spider-Man Nemesis | - | Star | `core` |
| `01169` | The Vulture's Plans | Treachery | Spider-Man Nemesis | - | 2 pips | `core` |
| `01170` | Business Problems | Obligation | Iron Man | - | 2 pips | `core` |
| `01171` | Imminent Overload | Side Scheme | Iron Man Nemesis | - | 3 pips | `core` |
| `01172` | Whiplash | Minion | Iron Man Nemesis | SCH:2 ATK:3 HP:4 | 2 pips | `core` |
| `01173` | Electric Whip Attack | Treachery | Iron Man Nemesis | - | Star | `core` |
| `01174` | Electromagnetic Backlash | Treachery | Iron Man Nemesis | - | 2 pips | `core` |
| `01175` | Family Emergency | Obligation | Captain Marvel | - | 2 pips | `core` |
| `01176` | The Psyche-Magnitron | Side Scheme | Captain Marvel Nemesis | - | 3 pips | `core` |
| `01177` | Yon-Rogg | Minion | Captain Marvel Nemesis | SCH:2 ATK:3 HP:5 | 2 pips | `core` |
| `01178` | Kree Manipulator | Treachery | Captain Marvel Nemesis | - | Star | `core` |
| `01179` | Yon-Rogg's Treason | Treachery | Captain Marvel Nemesis | - | 1 pips | `core` |
| `01180` | Legions of Hydra | Side Scheme | Legions of Hydra | - | 3 pips | `core` |
| `01181` | Madame Hydra | Minion | Legions of Hydra | SCH:2 ATK:2 HP:6 | 2 pips | `core` |
| `01182` | Hydra Soldier | Minion | Legions of Hydra | SCH:1 ATK:2 HP:4 | 1 pips | `core` |
| `01183` | The Doomsday Chair | Side Scheme | The Doomsday Chair | - | 3 pips | `core` |
| `01184` | M.O.D.O.K. | Minion | The Doomsday Chair | SCH:2 ATK:2 HP:8 | 2 pips | `core` |
| `01185` | Biomechanical Upgrades | Attachment | The Doomsday Chair | - | 1 pips | `core` |
| `01186` | Advance | Treachery | Standard | - | - | `core` |
| `01187` | Assault | Treachery | Standard | - | - | `core` |
| `01188` | Caught Off Guard | Treachery | Standard | - | 1 pips | `core` |
| `01189` | Gang-Up | Treachery | Standard | - | 1 pips | `core` |
| `01190` | Shadow of the Past | Treachery | Standard | - | 2 pips | `core` |
| `01191` | Exhaustion | Treachery | Expert | - | 2 pips | `core` |
| `01192` | Masterplan | Treachery | Expert | - | 2 pips | `core` |
| `01193` | Under Fire | Treachery | Expert | - | 3 pips | `core` |

---

## Pack: Core Set (`core`)

### Set: Spider-Man

### [01001a] Spider-Man
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 3, **HP**: 10, **Hand Size**: 5
- **Traits**: *Avenger.*
- **Rules Text**:
  > Spider-Sense — **Interrupt**: When the villain initiates an attack against you, draw 1 card.
- **Flavor**: *"Just your friendly neighborhood Spider-Man!"*
- **Image Asset**: `assets/card-art/bundles/cards/01001a.png` (300×419 px, 42.7 KB)
### [01001b] Peter Parker
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Genius.*
- **Rules Text**:
  > Scientist — **Resource**: Generate a [mental] resource. (Limit once per round.)
- **Flavor**: *"Right now, I'd trade the whole Spider-Man bit for a rocking chair and a good book."*
- **Image Asset**: `assets/card-art/bundles/cards/01001b.png` (300×419 px, 41.3 KB)
### [01002] Black Cat — *Felicia Hardy*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1, **HP**: 2, **Resources**: [energy]
- **Traits**: *Hero for Hire.*
- **Rules Text**:
  > **Forced Response**: After you play Black Cat, discard the top 2 cards of your deck. Add each card with a printed [mental] resource discarded this way to your hand.
- **Flavor**: *"I'm not a hero, I'm a thief."*
- **Image Asset**: `assets/card-art/bundles/cards/01002.png` (300×419 px, 37.6 KB)
### [01003] Backflip
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (2–3/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Defense. Skill.*
- **Rules Text**:
  > **Interrupt** *(defense)*: When you would take any amount of damage from an attack, prevent all of that damage.
- **Flavor**: *"Have you been training? 'Cause that almost hit me." —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/01003.png` (300×419 px, 37.6 KB)
### [01004] Enhanced Spider-Sense
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (4–5/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When a treachery card is revealed from the encounter deck, cancel its "**When Revealed**" effects.
- **Flavor**: *"My spider-sense is tingling!" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/01004.png` (300×419 px, 37.3 KB)
### [01005] Swinging Web Kick
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (6–8/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Aerial. Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 8 damage to an enemy.
- **Flavor**: *"Tally-ho!" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/01005.png` (300×419 px, 35.8 KB)
### [01006] Aunt May
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Aunt May → heal 4 damage from Peter Parker.
- **Flavor**: *"Goodness, Peter! You've been so clumsy lately."*
- **Image Asset**: `assets/card-art/bundles/cards/01006.png` (300×419 px, 34.3 KB)
### [01007] Spider-Tracer
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (10–11/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Attach to a minion.
  > **Forced Interrupt**: When attached minion is defeated, remove 3 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/01007.png` (300×419 px, 32.1 KB)
### [01008] Web-Shooter
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (12–13/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Uses (3 web counters). *(Enters play with 3 counters. When those are gone, discard this card)*
  > **Hero Resource**: Exhaust Web-Shooter and remove 1 web counter from it → generate a [wild] resource.
- **Image Asset**: `assets/card-art/bundles/cards/01008.png` (300×419 px, 34.6 KB)
### [01009] Webbed Up
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (14–15/15, Qty: 2)
- **Stats**: **Cost**: 4, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Hero form only. Attach to an enemy. Max 1 per enemy.
  > **Forced Interrupt**: When attached enemy would attack, discard Webbed Up instead. Then, stun that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/01009.png` (300×419 px, 46.5 KB)
### [01165] Eviction Notice
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Peter Parker player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Peter Parker → remove Eviction Notice from the game.
  > • Discard 1 card at random from your hand. This card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/01165.png` (300×419 px, 34.0 KB)

### Set: Captain Marvel

### [01010a] Captain Marvel
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 1, **HP**: 12, **Hand Size**: 5
- **Traits**: *Avenger. Soldier.*
- **Rules Text**:
  > Rechannel — **Action**: Spend a [energy] resource and heal 1 damage from Captain Marvel → draw 1 card. (Limit once per round.)
- **Flavor**: *"I never quit."*
- **Image Asset**: `assets/card-art/bundles/cards/01010a.png` (300×419 px, 37.5 KB)
### [01010b] Carol Danvers
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 12, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > Commander — **Action**: Choose a player to draw 1 card. (Limit once per round.)
- **Flavor**: *"It's my job to protect the Earth and everyone on it."*
- **Image Asset**: `assets/card-art/bundles/cards/01010b.png` (300×419 px, 37.7 KB)
### [01011] Spider-Woman — *Jessica Drew*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Avenger. Spy.*
- **Rules Text**:
  > **Response**: After Spider-Woman enters play, confuse the villain.
- **Flavor**: *"This is what I wanted: helping the innocents by hospitalizing the guilty."*
- **Image Asset**: `assets/card-art/bundles/cards/01011.png` (300×419 px, 41.6 KB)
### [01012] Crisis Interdiction
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (2–4/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 2 threat from a scheme. Then, if you have the [[Aerial]] trait, remove 2 threat from a different scheme.
- **Flavor**: *"This is one of the more impressive messes I've ever seen." —Carol Danvers*
- **Image Asset**: `assets/card-art/bundles/cards/01012.png` (300×419 px, 38.0 KB)
### [01013] Photonic Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (5–7/15, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy. If you paid for this card using a [energy] resource, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/01013.png` (300×419 px, 32.7 KB)
### [01014] Energy Absorption
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (8–9/15, Qty: 2)
- **Stats**: **Resources**: [energy] [energy] [energy]
- **Flavor**: *"That's enough!" —Carol Danvers*
- **Image Asset**: `assets/card-art/bundles/cards/01014.png` (300×419 px, 34.3 KB)
### [01015] Alpha Flight Station
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > **Action**: Exhaust Alpha Flight Station, choose and discard 1 card from your hand → draw 1 card (draw 2 cards instead if you are Carol Danvers).
- **Flavor**: *This low-orbit space station can beam cargo and crew to and from the Triskelion*
- **Image Asset**: `assets/card-art/bundles/cards/01015.png` (300×419 px, 39.9 KB)
### [01016] Captain Marvel's Helmet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Captain Marvel gets +1 DEF (+2 DEF instead if you have the [[Aerial]] trait).
- **Flavor**: *"This is so cool!" —Jessica Drew*
- **Image Asset**: `assets/card-art/bundles/cards/01016.png` (300×419 px, 36.7 KB)
### [01017] Cosmic Flight
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (12–13/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Captain Marvel gains the [[Aerial]] trait.
  > **Hero Interrupt** (*defense*): When Captain Marvel would take damage, discard Cosmic Flight → prevent 3 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/01017.png` (300×419 px, 42.6 KB)
### [01018] Energy Channel
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (14–15/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Spend X [energy] resources → put X energy counters here.
  > **Hero Action** *(attack)*: Discard Energy Channel → deal 2 damage to an enemy (to a maximum of 10) for each energy counter here.
- **Image Asset**: `assets/card-art/bundles/cards/01018.png` (300×419 px, 39.6 KB)
### [01175] Family Emergency
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Carol Danvers player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Carol Danvers → remove Family Emergency from the game.
  > • You are stunned. This card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/01175.png` (300×419 px, 43.4 KB)

### Set: She-Hulk

### [01019a] She-Hulk
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 3, **DEF**: 2, **HP**: 15, **Hand Size**: 4
- **Traits**: *Avenger. Gamma.*
- **Rules Text**:
  > "Do You Even Lift?" — **Response**: After you change to this form, deal 2 damage to an enemy.
- **Flavor**: *"I'm six foot seven and bright green! People are gonna stare no matter how I dress."*
- **Image Asset**: `assets/card-art/bundles/cards/01019a.png` (300×419 px, 39.8 KB)
### [01019b] Jennifer Walters
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 5, **HP**: 15, **Hand Size**: 6
- **Traits**: *Attorney. Gamma.*
- **Rules Text**:
  > "I Object!" — **Interrupt**: When threat would be placed on a scheme, prevent 1 of that threat. (Limit once per round.)
- **Flavor**: *"I can turn into a Hulk anytime I want. But just because you can do something doesn't always mean you should.*
- **Image Asset**: `assets/card-art/bundles/cards/01019b.png` (300×419 px, 43.1 KB)
### [01020] Hellcat — *Patsy Walker*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Action**: Return Hellcat to your hand.
- **Flavor**: *"Turn around gentlemen, and meet —the Hellcat!"*
- **Image Asset**: `assets/card-art/bundles/cards/01020.png` (300×419 px, 36.7 KB)
### [01021] Gamma Slam
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (2/15)
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal X damage to an enemy (to a maximum of 15). X is the amount of damage you have sustained.
- **Flavor**: *"You messed with the wrong woman!" —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/01021.png` (300×419 px, 33.9 KB)
### [01022] Ground Stomp
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (3–4/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Deal 1 damage to each enemy.
- **Flavor**: *"These boots were made for stompin'." —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/01022.png` (300×419 px, 36.7 KB)
### [01023] Legal Practice
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (5–6/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Skill. Thwart.*
- **Rules Text**:
  > **Alter-Ego Action** *(thwart)*: Choose and discard up to 5 cards from your hand → remove 1 threat from a scheme for each card discarded this way.
- **Flavor**: *"That's the first time I've ever seen someone argue their way out of a fight." —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/01023.png` (300×419 px, 40.7 KB)
### [01024] One-Two Punch
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (7–9/15, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Response**: After you make a basic attack *(using your ATK)*, ready She-Hulk.
- **Flavor**: *"I just don't care for men with fresh mouths." —Jennifer Walters*
- **Image Asset**: `assets/card-art/bundles/cards/01024.png` (300×419 px, 37.2 KB)
### [01025] Split Personality
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (10/15)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Rules Text**:
  > **Action**: Change your form *(flip your identity card)*. Then, draw up to your printed hand size.
- **Flavor**: *"I know a thing or two about rage. And that kind of fury... it's not going to pass without taking someone with it." —Jennifer Walters*
- **Image Asset**: `assets/card-art/bundles/cards/01025.png` (300×419 px, 34.5 KB)
### [01026] Superhuman Law Division
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (11/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Superhuman Law Division and spend a [mental] resource → remove 2 threat from a scheme.
- **Flavor**: *"I'll be sending you a bill. My time is valuable these days." —Jennifer Walters*
- **Image Asset**: `assets/card-art/bundles/cards/01026.png` (300×419 px, 40.7 KB)
### [01027] Focused Rage
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (12–13/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action**: Exhaust Focused Rage and take 1 damage → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/01027.png` (300×419 px, 34.5 KB)
### [01028] Superhuman Strength
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (14–15/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > She-Hulk gets +2 ATK.
  > **Forced Response**: After She-Hulk attacks, discard Superhuman Strength → stun the attacked enemy.
- **Image Asset**: `assets/card-art/bundles/cards/01028.png` (300×419 px, 41.7 KB)
### [01160] Legal Work
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: She-Hulk Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Jennifer Walters player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Jennifer Walters → remove Legal Work from the game.
  > • Give the main scheme 1 acceleration token. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/01160.png` (300×419 px, 36.3 KB)

### Set: Iron Man

### [01029a] Iron Man
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1, **DEF**: 1, **HP**: 9, **Hand Size**: 1
- **Traits**: *Avenger.*
- **Rules Text**:
  > You get +1 hand size for each [[Tech]] upgrade you control (to a maximum hand size of 7).
- **Flavor**: *"I am Iron Man."*
- **Image Asset**: `assets/card-art/bundles/cards/01029a.png` (300×419 px, 37.2 KB)
### [01029b] Tony Stark
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Genius.*
- **Rules Text**:
  > Futurist — **Action**: Look at the top 3 cards of your deck. Add 1 to your hand and discard the others. (Limit once per round.)
- **Flavor**: *"I'm obviously not doing this for the money..."*
- **Image Asset**: `assets/card-art/bundles/cards/01029b.png` (300×419 px, 37.8 KB)
### [01030] War Machine — *James Rhodes*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 4, **Resources**: [wild]
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > **Action**: Exhaust War Machine and deal 2 damage to him → deal 1 damage to each enemy.
- **Flavor**: *"Is this a private war —or can anyone join?"*
- **Image Asset**: `assets/card-art/bundles/cards/01030.png` (300×419 px, 36.6 KB)
### [01031] Repulsor Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (2–4/15, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 1 damage to an enemy and discard the top 5 cards of your deck. For each printed [energy] resource discarded this way, deal 2 additional damage to that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/01031.png` (300×419 px, 36.8 KB)
### [01032] Supersonic Punch
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (5–6/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy (8 damage instead if you have the [[Aerial]] trait).
- **Flavor**: *"Nice technique. But if you do it like this... it hurts more." —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/01032.png` (300×419 px, 39.1 KB)
### [01033] Pepper Potts
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (7/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Resource**: Exhaust Pepper Potts → generate the resources of the top card in your discard pile.
- **Flavor**: *"Do your thing. I've got this."*
- **Image Asset**: `assets/card-art/bundles/cards/01033.png` (300×419 px, 32.2 KB)
### [01034] Stark Tower
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (8/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Stark Tower → choose a player. That player returns the topmost [[Tech]] upgrade in their discard pile to their hand.
- **Flavor**: *"I was hoping for something a little bigger. But this will do." —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/01034.png` (300×419 px, 40.3 KB)
### [01035] Arc Reactor
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > **Hero Action**: Exhaust Arc Reactor → ready Iron Man.
- **Flavor**: *"When I put on this armor, I took on more power than any human was ever intended to have... and maybe more responsibility than my heart can truly bear." —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/01035.png` (300×419 px, 39.2 KB)
### [01036] Mark V Armor
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > You get +6 hit points.
- **Flavor**: *"Is that all you've got!" —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/01036.png` (300×419 px, 39.1 KB)
### [01037] Mark V Helmet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Exhaust Mark V Helmet → remove 1 threat from a scheme (from each scheme instead if you have the [[Aerial]] trait).
- **Flavor**: *"Tony, are you sure you want to do that!" —P.E.P.P.E.R.*
- **Image Asset**: `assets/card-art/bundles/cards/01037.png` (300×419 px, 37.7 KB)
### [01038] Powered Gauntlets
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (12–13/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust Powered Gauntlets → deal 1 damage to an enemy (2 damage instead if you have the [[Aerial]] trait).
- **Flavor**: *"Please, let me give you... a hand." —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/01038.png` (300×419 px, 37.0 KB)
### [01039] Rocket Boots
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (14–15/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > You get +1 hit point.
  > **Hero Action**: Exhaust Rocket Boots and spend a [mental] resource → gain the [[Aerial]] trait until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/01039.png` (300×419 px, 36.2 KB)
### [01170] Business Problems
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Tony Stark player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Tony Stark → remove Business Problems from the game.
  > • Exhaust each upgrade you control. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/01170.png` (300×419 px, 35.6 KB)

### Set: Black Panther

### [01040a] Black Panther
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 11, **Hand Size**: 5
- **Traits**: *Avenger. Wakanda.*
- **Rules Text**:
  > Retaliate 1. *(After this character is attacked, deal 1 damage to the attacking character.)*
- **Flavor**: *"To attack me is to attack Wakanda."*
- **Image Asset**: `assets/card-art/bundles/cards/01040a.png` (300×419 px, 44.7 KB)
### [01040b] T'Challa
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 11, **Hand Size**: 6
- **Traits**: *King. Wakanda.*
- **Rules Text**:
  > Foresight — **Setup**: Search your deck for a [[Black Panther]] upgrade and add it to your hand. Shuffle your deck.
- **Image Asset**: `assets/card-art/bundles/cards/01040b.png` (300×419 px, 39.6 KB)
### [01041] Shuri
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Genius. Wakanda.*
- **Rules Text**:
  > **Response**: After Shuri enters play, search your deck for an upgrade and add it to your hand. Shuffle your deck.
- **Flavor**: *"You would be lost without me, brother!"*
- **Image Asset**: `assets/card-art/bundles/cards/01041.png` (300×419 px, 38.8 KB)
### [01042] Ancestral Knowledge
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (2/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Alter-Ego Action**: Choose up to 3 different cards in your discard pile and shuffle them into your deck.
- **Flavor**: *"In Wakanda, we draw strength from the knowledge of our ancestors." —T'Challa*
- **Image Asset**: `assets/card-art/bundles/cards/01042.png` (300×419 px, 40.8 KB)
### [01043a] Wakanda Forever!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (3/15)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Resolve the "**Special**" ability on each [[Black Panther]] upgrade you control in any order. *(Resolving each ability is a step in a sequence.)*
- **Image Asset**: `assets/card-art/bundles/cards/01043a.png` (300×419 px, 37.7 KB)
### [01043b] Wakanda Forever!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (4/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Resolve the "**Special**" ability on each [[Black Panther]] upgrade you control in any order. *(Resolving each ability is a step in a sequence.)*
- **Image Asset**: `assets/card-art/bundles/cards/01043b.png` (300×419 px, 37.7 KB)
### [01043c] Wakanda Forever!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (5/15)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Resolve the "**Special**" ability on each [[Black Panther]] upgrade you control in any order. *(Resolving each ability is a step in a sequence.)*
- **Image Asset**: `assets/card-art/bundles/cards/01043c.png` (300×419 px, 37.7 KB)
### [01043d] Wakanda Forever!
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (6–7/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Resolve the "**Special**" ability on each [[Black Panther]] upgrade you control in any order. *(Resolving each ability is a step in a sequence.)*
- **Image Asset**: `assets/card-art/bundles/cards/01043d.png` (300×419 px, 37.7 KB)
### [01044] Vibranium
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (8–10/15, Qty: 3)
- **Stats**: **Resources**: [wild] [wild]
- **Flavor**: *"Since the time of Bashenga, we've controlled our destiny as few other nations have."*
- **Image Asset**: `assets/card-art/bundles/cards/01044.png` (300×419 px, 39.2 KB)
### [01045] The Golden City
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Location. Wakanda.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust The Golden City → draw 2 cards.
- **Flavor**: *Wakanda's capital city is an unrivaled architectural and technological marvel.*
- **Image Asset**: `assets/card-art/bundles/cards/01045.png` (300×419 px, 37.6 KB)
### [01046] Energy Daggers
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (12/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Black Panther. Weapon.*
- **Rules Text**:
  > **Special**: Choose a player. Deal 1 damage to the villain and to each enemy engaged with that player (2 damage instead if this is the final step of this sequence).
  > *(Play the "Wakanda Forever!" event to use this ability.)*
- **Image Asset**: `assets/card-art/bundles/cards/01046.png` (300×419 px, 37.4 KB)
### [01047] Panther Claws
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (13/15)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Black Panther. Weapon.*
- **Rules Text**:
  > **Special** *(attack)*: Deal 2 damage to an enemy (4 damage instead if this is the final step of this sequence).
  > *(Play the "Wakanda Forever!" event to use this ability.)*
- **Image Asset**: `assets/card-art/bundles/cards/01047.png` (300×419 px, 36.2 KB)
### [01048] Tactical Genius
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (14/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Black Panther. Skill.*
- **Rules Text**:
  > **Special** *(thwart)*: Remove 1 threat from a scheme (2 threat instead if this is the final step of this sequence).
  > *(Play the "Wakanda Forever!" event to use this ability.)*
- **Image Asset**: `assets/card-art/bundles/cards/01048.png` (300×419 px, 42.8 KB)
### [01049] Vibranium Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (15/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Armor. Black Panther.*
- **Rules Text**:
  > **Special** *(attack)*: Move 1 damage from your hero to an enemy (2 damage instead if this is the final step of this sequence).
  > *(Play the "Wakanda Forever!" event to use this ability.)*
- **Image Asset**: `assets/card-art/bundles/cards/01049.png` (300×419 px, 35.4 KB)
### [01155] Affairs of State
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Panther Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the T'Challa player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust T'Challa → remove Affairs of State from the game.
  > • Choose and discard a [[Black Panther]] upgrade you control. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/01155.png` (300×419 px, 37.9 KB)

### Set: Aggression

### [01050] Hulk — *Bruce Banner*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 50
- **Properties**: Unique
- **Stats**: **Cost**: 2, **ATK**: 3 (Consequential: 1), **HP**: 5, **Resources**: [energy]
- **Traits**: *Avenger. Gamma.*
- **Rules Text**:
  > **Forced Response**: After Hulk attacks, discard the top card of your deck. If that card's printed resource has:
  > [physical] - Deal 2 damage to an enemy.
  > [energy] - Deal 1 damage to each character.
  > [mental] - Discard Hulk.
  > [wild] - All of the above.
- **Image Asset**: `assets/card-art/bundles/cards/01050.png` (300×419 px, 40.2 KB)
### [01051] Tigra — *Greer Grant Nelson*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 51
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After Tigra attacks and defeats a minion, heal 1 damage from her.
- **Flavor**: *"Sorry —no autographs."*
- **Image Asset**: `assets/card-art/bundles/cards/01051.png` (300×419 px, 37.4 KB)
### [01052] Chase Them Down
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Response** *(thwart)*: After your hero attacks and defeats an enemy, remove 2 threat from a scheme.
- **Flavor**: *"Kamala, we don't have a theme song. Please stop humming one..." —Captain Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/01052.png` (300×419 px, 38.7 KB)
### [01053] Relentless Assault
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 53
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to a minion. If you paid for this card using a [physical] resource, this attack gains overkill. *(Excess damage from this attack is dealt to the villain.)*
- **Image Asset**: `assets/card-art/bundles/cards/01053.png` (300×419 px, 37.1 KB)
### [01054] Uppercut
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 54
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy.
- **Flavor**: *SMACK!*
- **Image Asset**: `assets/card-art/bundles/cards/01054.png` (300×419 px, 32.8 KB)
### [01055] The Power of Aggression
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 55
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Aggression *(red)* card.
- **Image Asset**: `assets/card-art/bundles/cards/01055.png` (300×419 px, 40.7 KB)
### [01056] Tac Team
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 56
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 attack counters). *(Enters play with 3 counters. When those are gone, discard this card)*
  > **Action**: Exhaust Tac Team and remove 1 attack counter from it → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/01056.png` (300×419 px, 38.0 KB)
### [01057] Combat Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 57
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 ATK.
- **Flavor**: *"Tony! She did it again!" —Janet Van Dyne*
- **Image Asset**: `assets/card-art/bundles/cards/01057.png` (300×419 px, 34.7 KB)

### Set: Justice

### [01058] Daredevil — *Matt Murdock*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 58
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Defender.*
- **Rules Text**:
  > **Response**: After Daredevil thwarts, deal 1 damage to an enemy.
- **Flavor**: *"Sometimes, I think I accomplish more with my fists than with my law firm."*
- **Image Asset**: `assets/card-art/bundles/cards/01058.png` (300×419 px, 37.0 KB)
### [01059] Jessica Jones
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 59
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Defender.*
- **Rules Text**:
  > Jessica Jones gets +1 THW for each side scheme in play.
- **Flavor**: *"I am very good at finding people."*
- **Image Asset**: `assets/card-art/bundles/cards/01059.png` (300×419 px, 34.7 KB)
### [01060] For Justice!
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 60
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme (4 threat instead if you paid for this card using a [mental] resource).
- **Flavor**: *"You lose. And you're going to answer for what you've done." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/01060.png` (300×419 px, 35.6 KB)
### [01061] Great Responsibility
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 61
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Hero Interrupt**: When any amount of threat would be placed on a scheme, you take it as damage instead.
- **Image Asset**: `assets/card-art/bundles/cards/01061.png` (300×419 px, 30.6 KB)
### [01062] The Power of Justice
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 62
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Justice *(yellow)* card.
- **Image Asset**: `assets/card-art/bundles/cards/01062.png` (300×419 px, 40.1 KB)
### [01063] Interrogation Room
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 63
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After you defeat a minion, exhaust Interrogation Room → remove 1 threat from a scheme.
- **Flavor**: *"Oh, she's sorry! Let me get the keys and call you a car service!" —Misty Knight*
- **Image Asset**: `assets/card-art/bundles/cards/01063.png` (300×419 px, 34.5 KB)
### [01064] Surveillance Team
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 64
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 snoop counters). *(Enters play with 3 counters. When those are gone, discard this card)*
  > **Action**: Exhaust Surveillance Team and remove 1 snoop counter from it → remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/01064.png` (300×419 px, 38.0 KB)
### [01065] Heroic Intuition
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 65
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 THW.
- **Image Asset**: `assets/card-art/bundles/cards/01065.png` (300×419 px, 37.0 KB)

### Set: Leadership

### [01066] Hawkeye — *Clint Barton*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 66
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Hawkeye enters play with 4 arrow counters on him.
  > **Response**: After a minion enters play, remove 1 arrow counter from Hawkeye → deal 2 damage to that minion.
- **Image Asset**: `assets/card-art/bundles/cards/01066.png` (300×419 px, 40.1 KB)
### [01067] Maria Hill
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 67
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > **Response**: After Maria Hill enters play, each player draws 1 card.
- **Flavor**: *"Believe it or not, we all want the same thing."*
- **Image Asset**: `assets/card-art/bundles/cards/01067.png` (300×419 px, 35.3 KB)
### [01068] Vision
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 68
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Android. Avenger.*
- **Rules Text**:
  > **Action**: Spend a [energy] resource → choose THW or ATK. Until the end of the phase, Vision gets +2 to the chosen power. (Limit once per round.)
- **Flavor**: *"I will handle this"*
- **Image Asset**: `assets/card-art/bundles/cards/01068.png` (300×419 px, 36.9 KB)
### [01069] Get Ready
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 69
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > **Action**: Ready an ally.
- **Flavor**: *"We train hard every day so that when the time comes, we'll be ready." —Steve Rogers*
- **Image Asset**: `assets/card-art/bundles/cards/01069.png` (300×419 px, 34.9 KB)
### [01070] Lead from the Front
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 70
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Choose a player. Each character that player controls gets +1 THW and +1 ATK until the end of the phase.
- **Flavor**: *"Let's go everyone!" —Carol Danvers*
- **Image Asset**: `assets/card-art/bundles/cards/01070.png` (300×419 px, 38.3 KB)
### [01071] Make the Call
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 71
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Pay the printed cost of an ally in any player's discard pile → put that ally into play under your control.
- **Flavor**: *"This is a code red! All hands on deck!" —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/01071.png` (300×419 px, 37.3 KB)
### [01072] The Power of Leadership
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 72
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Leadership *(blue)* card.
- **Image Asset**: `assets/card-art/bundles/cards/01072.png` (300×419 px, 36.5 KB)
### [01073] The Triskelion
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 73
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > Increase your ally limit by 1. *(This allows you to control more than 3 allies.)*
- **Flavor**: *"Think they made it tall enough?" —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/01073.png` (300×419 px, 37.9 KB)
### [01074] Inspired
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 74
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to an ally. Max 1 per ally.
  > Attached ally gets +1 THW and +1 ATK.
- **Flavor**: *"I'm glad she's on our side." —Star-Lord*
- **Image Asset**: `assets/card-art/bundles/cards/01074.png` (300×419 px, 39.7 KB)

### Set: Protection

### [01075] Black Widow — *Natasha Romanoff*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 75
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Interrupt**: When a card is revealed from the encounter deck, exhaust Black Widow and spend a [mental] resource → cancel the effects of that card and discard it. Then, reveal another card from the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/01075.png` (300×419 px, 39.0 KB)
### [01076] Luke Cage
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 76
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 5, **Resources**: [energy]
- **Traits**: *Defender.*
- **Rules Text**:
  > Toughness. *(This character enters play with a tough status card.)*
- **Flavor**: *"Power Man for hire—Cage speakin'."*
- **Image Asset**: `assets/card-art/bundles/cards/01076.png` (300×419 px, 35.7 KB)
### [01077] Counter-Punch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 77
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Response** *(attack)*: After your hero defends against an enemy attack, deal damage to that enemy equal to your hero's ATK.
- **Flavor**: *"That's what you get!" —Iron Fist*
- **Image Asset**: `assets/card-art/bundles/cards/01077.png` (300×419 px, 35.5 KB)
### [01078] Get Behind Me!
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 78
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Hero Interrupt**: When a treachery card is revealed from the encounter deck, cancel its "**When Revealed**" effects. The villain attacks you instead.
- **Flavor**: *"Ahem! Stand aside, citizens!" —Ms. Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/01078.png` (300×419 px, 36.9 KB)
### [01079] The Power of Protection
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 79
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Protection *(green)* card.
- **Image Asset**: `assets/card-art/bundles/cards/01079.png` (300×419 px, 37.9 KB)
### [01080] Med Team
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 80
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 medical counters). *(Enters play with 3 counters. When those are gone, discard this card.)*
  > **Action**: Exhaust Med Team and remove 1 medical counter from it → heal 2 damage from a friendly character.
- **Image Asset**: `assets/card-art/bundles/cards/01080.png` (300×419 px, 42.8 KB)
### [01081] Armored Vest
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 81
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 DEF.
- **Flavor**: *Life-saving and stylish.*
- **Image Asset**: `assets/card-art/bundles/cards/01081.png` (300×419 px, 33.6 KB)
### [01082] Indomitable
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 82
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Response**: After your hero defends, discard indomitable → ready your hero.
- **Flavor**: *"We have no choice. So we fight — and we win. There are no other options." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/01082.png` (300×419 px, 39.1 KB)

### Set: Basic

### [01083] Mockingbird — *Bobbi Morse*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 83
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Response**: After Mockingbird enters play, stun an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/01083.png` (300×419 px, 34.1 KB)
### [01084] Nick Fury
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 84
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Forced Response**: After Nick Fury enters play, choose one: remove 2 threat from a scheme, draw 3 cards, or deal 4 damage to an enemy. At the end of the round, if Nick Fury is still in play, discard him.
- **Image Asset**: `assets/card-art/bundles/cards/01084.png` (300×419 px, 37.3 KB)
### [01085] Emergency
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 85
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Interrupt** *(thwart)*: When the villain schemes, reduce the amount of threat placed on the scheme by 1.
- **Flavor**: *"CALLING ALL UNITS! CALLING ALL UNITS!"*
- **Image Asset**: `assets/card-art/bundles/cards/01085.png` (300×419 px, 32.5 KB)
### [01086] First Aid
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 86
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Heal 2 damage from any character.
- **Flavor**: *"Does it still qualify as first aid if it's your second day in the hospital?" —Clint Barton*
- **Image Asset**: `assets/card-art/bundles/cards/01086.png` (300×419 px, 28.8 KB)
### [01087] Haymaker
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 87
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy.
- **Flavor**: *WHAM!*
- **Image Asset**: `assets/card-art/bundles/cards/01087.png` (300×419 px, 31.6 KB)
### [01088] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 88
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/01088.png` (300×419 px, 29.1 KB)
### [01089] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 89
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/01089.png` (300×419 px, 35.9 KB)
### [01090] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 90
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/01090.png` (300×419 px, 34.6 KB)
### [01091] Avengers Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 91
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Avengers Mansion → choose a player. That player draws 1 card.
- **Flavor**: *"Did you remember to turn off the stove?" —Janet Van Dyne*
- **Image Asset**: `assets/card-art/bundles/cards/01091.png` (300×419 px, 40.1 KB)
### [01092] Helicarrier
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 92
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Helicarrier → choose a player. Reduce the resource cost of the next card that player plays this phase by 1.
- **Flavor**: *"A flying aircraft carrier? You're kidding, right?" —Jennifer Walters*
- **Image Asset**: `assets/card-art/bundles/cards/01092.png` (300×419 px, 30.6 KB)
### [01093] Tenacity
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Core Set (`core`)
- **Deck / Set**: Pack Position: 93
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > **Hero Action**: Spend a [physical] resource and discard this card → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/01093.png` (300×419 px, 32.9 KB)

### Set: Rhino

### [01094] Rhino
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (1/21)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Criminal.*
- **Flavor**: *"I'm Rhino, I knock things down. That's what I do. That's who I am."*
- **Image Asset**: `assets/card-art/bundles/cards/01094.png` (300×419 px, 32.4 KB)
### [01095] Rhino
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (2/21)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Criminal.*
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for the Breakin' & Takin' side scheme and reveal it. Shuffle the encounter deck.
- **Flavor**: *"Out of my way!"*
- **Image Asset**: `assets/card-art/bundles/cards/01095.png` (300×419 px, 35.9 KB)
### [01096] Rhino
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (3/21)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 1, **ATK**: 4, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Criminal.*
- **Rules Text**:
  > Toughness. *(This character enter play with a tough status card.)*
  > **When Revealed**: Stun each hero.
- **Flavor**: *"You brought this on yourself!"*
- **Image Asset**: `assets/card-art/bundles/cards/01096.png` (300×419 px, 35.2 KB)
### [01097] The Break-In!
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (4/21)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Rhino is trying to smash through the facility wall and steal a shipment of vibranium. You must stop him!*
- **Image Asset**: `assets/card-art/bundles/cards/01097.png` (419×300 px, 36.9 KB)
### [01097a] The Break-In!
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (4/21)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Rhino (I) and Rhino (II). (Rhino (II) and Rhino (III) instead for expert mode.) Rhino and Standard encounter sets. One modular encounter set *(recommended: Bomb Scare)*.
  > **Setup**: Advance to stage 1B.
- **Flavor**: *Rhino is attacking a S.H.I.E.L.D. facility!*
### [01097b] The Break-In!
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (4/21)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Rhino is trying to smash through the facility wall and steal a shipment of vibranium. You must stop him!*
- **Image Asset**: `assets/card-art/bundles/cards/01097b.png` (419×300 px, 35.0 KB)
### [01098] Armored Rhino Suit
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (5/21)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Rhino.
  > **Forced Interrupt**: When any amount of damage would be dealt to Rhino, place it here instead. Then, if there is at least 5 damage here, discard Armored Rhino Suit.
- **Image Asset**: `assets/card-art/bundles/cards/01098.png` (300×419 px, 36.7 KB)
### [01099] Charge
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (6–7/21, Qty: 2)
- **Stats**: **ATK**: 3 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Rhino.
  > [star] **Forced Interrupt**: When Rhino attacks, the attack gains overkill. *(Excess damage to an ally from this attack is dealt to that ally's controller.)* At the end of this attack, discard Charge.
- **Image Asset**: `assets/card-art/bundles/cards/01099.png` (300×419 px, 37.0 KB)
### [01100] Enhanced Ivory Horn
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (8/21)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Rhino.
  > **Hero Action**: Spend [physical] [physical] [physical] resources → discard this card
- **Image Asset**: `assets/card-art/bundles/cards/01100.png` (300×419 px, 40.1 KB)
### [01101] Hydra Mercenary
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (9–10/21, Qty: 2)
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
- **Flavor**: *"What is Hydra doing here?" —Carol Danvers*
- **Image Asset**: `assets/card-art/bundles/cards/01101.png` (300×419 px, 36.5 KB)
### [01102] Sandman
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (11/21)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Elite.*
- **Rules Text**:
  > Toughness. *(This character enters play with a tough status card.)*
- **Flavor**: *"I just wanna get paid!"*
- **Image Asset**: `assets/card-art/bundles/cards/01102.png` (300×419 px, 37.2 KB)
### [01103] Shocker
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (12/21)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to each hero.
- **Flavor**: *"I bet you're shocked to see me!"*
- **Image Asset**: `assets/card-art/bundles/cards/01103.png` (300×419 px, 35.7 KB)
### [01104] Hard to Keep Down
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (13–14/21, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Rhino heals 4 damage. If no damage was healed this way, this card gains surge.
- **Flavor**: *"You think you can stop me? What a joke!" —Rhino*
- **Image Asset**: `assets/card-art/bundles/cards/01104.png` (300×419 px, 37.7 KB)
### [01105] "I'm Tough"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (15–16/21, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give Rhino a tough status card. If Rhino already has a tough status card, this card gains surge.
- **Flavor**: *"Bring it!" —Rhino*
- **Image Asset**: `assets/card-art/bundles/cards/01105.png` (300×419 px, 32.5 KB)
### [01106] Stampede
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (17–19/21, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: Rhino attacks you. If a character is damaged by this attack, that character is stunned.
- **Image Asset**: `assets/card-art/bundles/cards/01106.png` (300×419 px, 37.2 KB)
### [01107] Breakin' & Takin'
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (20/21)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place an additional 1 [per_hero] threat here.
  > *(Hazard Icon: Deal +1 encounter card during the villain phase.)*
- **Flavor**: *Rhino is breaking things and taking them!*
- **Image Asset**: `assets/card-art/bundles/cards/01107.png` (419×300 px, 33.9 KB)
### [01108] Crowd Control
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Rhino (21/21)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Rhino Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > *(Crisis Icon: While this scheme is in play, you cannot remove threat from the main scheme.)*
- **Flavor**: *Panicked civilians crowd the area. It is difficult to confront Rhino without putting them at risk. Get the people to safety!*
- **Image Asset**: `assets/card-art/bundles/cards/01108.png` (419×300 px, 34.2 KB)

### Set: Bomb Scare

### [01109] Bomb Scare
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Bomb Scare (1/6)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bomb Scare Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place an additional 1 [per_hero] threat here.
  > *(Acceleration Icon: Place +1 threat on the main scheme at the start of the villain phase.)*
- **Flavor**: *Reports are out that Hydra agents have planted a bomb in a nearby hotel.*
- **Image Asset**: `assets/card-art/bundles/cards/01109.png` (419×300 px, 38.3 KB)
### [01110] Hydra Bomber
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Bomb Scare (2–3/6, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bomb Scare Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > **When Revealed**: Choose to either take 2 damage or place 1 threat on the main scheme.
- **Flavor**: *"I know that if you cut off one head, two more will take its place. But what if it blows up instead?" —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/01110.png` (300×419 px, 36.4 KB)
### [01111] Explosion
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Bomb Scare (4/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bomb Scare Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Bomb Scare is in play, assign X damage among heroes and allies, where X is the amount of threat on Bomb Scare. If Bomb Scare is not in play, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/01111.png` (300×419 px, 41.7 KB)
### [01112] False Alarm
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Bomb Scare (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bomb Scare Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are confused. If you are already confused, this card gains surge.
- **Flavor**: *"Nothing to see here people!" —Iron Man*
- **Image Asset**: `assets/card-art/bundles/cards/01112.png` (300×419 px, 38.7 KB)

### Set: Klaw

### [01113] Klaw
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (1/21)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 0 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Masters of Evil.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Klaw attacks, give him 1 additional boost card for this activation.
- **Flavor**: *"Come meet your doom!"*
- **Image Asset**: `assets/card-art/bundles/cards/01113.png` (300×419 px, 32.0 KB)
### [01114] Klaw
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (2/21)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Masters of Evil.*
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for The "Immortal" Klaw and reveal it. Shuffle the encounter deck.
  > [star] **Forced Interrupt**: When Klaw attacks, give him 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/01114.png` (300×419 px, 36.6 KB)
### [01115] Klaw
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (3/21)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Masters of Evil.*
- **Rules Text**:
  > Toughness. *(This character enters play with a tough status card.)*
  > [star] **Forced Interrupt**: When Klaw attacks, give him 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/01115.png` (300×419 px, 34.6 KB)
### [01116] Underground Distribution
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (4/21)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the encounter deck until a minion is discarded. Put that minion into play engaged with the first player.
- **Flavor**: *Your investigation reveals that the criminal enterprise is operated by Klaw, an old rival of the Avengers!*
- **Image Asset**: `assets/card-art/bundles/cards/01116.png` (419×300 px, 36.2 KB)
### [01116a] Underground Distribution
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (4/21)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Klaw (I) and Klaw (II). *(Klaw (II) and Klaw (III) instead for expert mode.)* Klaw and Standard encounter sets. One modular encounter set *(recommended: Masters of Evil)*
  > **Setup**: Search the encounter deck for the Defense Network side scheme and reveal it. Shuffle the encounter deck. Advance to stage 1B.
- **Flavor**: *The attack on the S.H.I.E.L.D. facility has been linked to an underground weapons network.*
### [01116b] Underground Distribution
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (4/21)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the encounter deck until a minion is discarded. Put that minion into play engaged with the first player.
- **Flavor**: *Your investigation reveals that the criminal enterprise is operated by Klaw, an old rival of the Avengers!*
- **Image Asset**: `assets/card-art/bundles/cards/01116b.png` (419×300 px, 36.2 KB)
### [01117] Secret Rendezvous
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (5/21)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Klaw is meeting with the Crimson Cowl. Klaw and the mysterious figure dart into the shadows when you confront them, and Klaw's minions move to cover their escape.*
- **Image Asset**: `assets/card-art/bundles/cards/01117.png` (419×300 px, 34.2 KB)
### [01117a] Secret Rendezvous
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (5/21)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the encounter deck until a minion is discarded. Put that minion into play engaged with the first player. Advance to stage 2B
- **Flavor**: *Klaw has found a buyer for his illegal weapons. It's up to you to stop the sale but the meeting is surrounded by Klaw's cronies.*
### [01117b] Secret Rendezvous
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (5/21)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Klaw is meeting with the Crimson Cowl. Klaw and the mysterious figure dart into the shadows when you confront them, and Klaw's minions move to cover their escape.*
### [01118] Sonic Converter
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (6/21)
- **Properties**: Unique
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Klaw.
  > [star] **Forced Response**: After Klaw attacks and damages a character, stun that character.
  > **Hero Action**: Spend [energy] [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/01118.png` (300×419 px, 32.3 KB)
### [01119] Solid-Sound Body
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (7/21)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Klaw.
  > Klaw gains retaliate 1. *(After this character is attacked, deal 1 damage to the attacking character.)*
  > **Hero Action**: Spend [energy] [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/01119.png` (300×419 px, 37.9 KB)
### [01120] Armored Guard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (8–10/21, Qty: 3)
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mercenary.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
  > Toughness. *(This character enters play with a tough status card.)*
- **Image Asset**: `assets/card-art/bundles/cards/01120.png` (300×419 px, 41.6 KB)
### [01121] Weapons Runner
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (11–12/21, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mercenary.*
- **Rules Text**:
  > Surge. *(After this card is revealed, reveal 1 additional encounter card.)*
  >
  > ---
  >
  > [star] **Boost**: Put Weapons Runner into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/01121.png` (300×419 px, 39.8 KB)
### [01122] Klaw's Vengeance
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (13–14/21, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard 1 card at random from your hand.
  > **When Revealed (Hero)**: Klaw attacks you. If this attack deals damage, place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/01122.png` (300×419 px, 41.7 KB)
### [01123] Sonic Boom
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (15–16/21, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Either spend [energy] [mental] [physical] resources or exhaust each character you control.
  >
  > ---
  >
  > [star] **Boost**: If this activation deals damage to you, exhaust your hero.
- **Image Asset**: `assets/card-art/bundles/cards/01123.png` (300×419 px, 38.2 KB)
### [01124] Sound Manipulation
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (17–18/21, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Klaw heals 4 damage. If no damage was healed this way, this card gains surge.
  > **When Revealed (Hero)**: Take 2 damage. Klaw heals 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/01124.png` (300×419 px, 40.1 KB)
### [01125] Defense Network
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (19/21)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Place an additional 1 [per_hero] threat here.
- **Flavor**: *Klaw's criminal enterprise is protected by a gang of hired thugs.*
- **Image Asset**: `assets/card-art/bundles/cards/01125.png` (419×300 px, 37.5 KB)
### [01126] Illegal Arms Factory
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (20/21)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place an additional 1 [per_hero] threat here.
- **Flavor**: *Klaw is supplying villains with advanced weaponry from a clandestine arms facility.*
- **Image Asset**: `assets/card-art/bundles/cards/01126.png` (419×300 px, 35.0 KB)
### [01127] The "Immortal" Klaw
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Klaw (21/21)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Klaw Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Klaw gets +10 hit points. *(When this scheme is defeated, Klaw loses those hit points.)*
- **Flavor**: *Klaw's mastery of sound allows him to restore his solid form through sheer power of will.*
- **Image Asset**: `assets/card-art/bundles/cards/01127.png` (419×300 px, 37.8 KB)

### Set: Masters of Evil

### [01128] The Masters of Evil
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Masters of Evil (1/7)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Masters of Evil Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Discard cards from the encounter deck until a [[Masters of Evil]] minion is discarded. Put that minion into play engaged with the first player.
- **Flavor**: *The Masters of Evil have arrived to attack the heroes!*
- **Image Asset**: `assets/card-art/bundles/cards/01128.png` (419×300 px, 41.1 KB)
### [01129] Radioactive Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Masters of Evil (2/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Masters of Evil Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Masters of Evil.*
- **Rules Text**:
  > [star] **Forced Response**: After Radioactive Man attacks you, discard 1 card at random from your hand.
  >
  > ---
  >
  > [star] **Boost**: Discard 1 card at random from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/01129.png` (300×419 px, 36.7 KB)
### [01130] Whirlwind
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Masters of Evil (3/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Masters of Evil Set Icon (printed bottom-right next to deck number)
- **Traits**: *Masters of Evil.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Whirlwind attacks you, also resolve his attack against each other hero.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to each hero.
- **Image Asset**: `assets/card-art/bundles/cards/01130.png` (300×419 px, 37.3 KB)
### [01131] Tiger Shark
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Masters of Evil (4/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 6, **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Masters of Evil Set Icon (printed bottom-right next to deck number)
- **Traits**: *Masters of Evil.*
- **Rules Text**:
  > [star] **Forced Response**: After Tiger Shark attacks, give him a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/01131.png` (300×419 px, 36.0 KB)
### [01132] Melter
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Masters of Evil (5/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Masters of Evil Set Icon (printed bottom-right next to deck number)
- **Traits**: *Masters of Evil.*
- **Rules Text**:
  > [star] The engaged player must defend against Melter's attacks with an ally they control, if able.
  >
  > ---
  >
  > [star] **Boost**: Exhaust each ally you control.
- **Image Asset**: `assets/card-art/bundles/cards/01132.png` (300×419 px, 36.2 KB)
### [01133] Masters of Mayhem
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Masters of Evil (6–7/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Masters of Evil Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[Masters of Evil]] minion attacks the hero it is engaged with. If no attacks were made this way, search the encounter deck and discard pile for a [[Masters of Evil]] minion and put it into play engaged with you, then shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/01133.png` (300×419 px, 37.8 KB)

### Set: Ultron

### [01134] Ultron
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (1/25)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Traits**: *Android.*
- **Rules Text**:
  > [star] **Forced Response**: After Ultron attacks you, choose to either place 1 threat on the main scheme or put the top card of your deck into play facedown, engaged with you as a [[Drone]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/01134.png` (300×419 px, 39.3 KB)
### [01135] Ultron
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (2/25)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Traits**: *Android.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Ultron attacks you, put the top card of your deck into play facedown, engaged with you as a [[Drone]] minion. Until the end of his attack, Ultron gets +1 ATK for each [[Drone]] minion engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/01135.png` (300×419 px, 41.0 KB)
### [01136] Ultron
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (3/25)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 4, **HP**: 27 per hero, **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Android.*
- **Rules Text**:
  > Each [[Drone]] minion gets +1 ATK and +1 hit point. Ultron cannot take damage while a [[Drone]] minion is in play.
  > **When Revealed**: Search the encounter deck and discard pile for the Ultron's Imperative side scheme and reveal it. Then shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/01136.png` (300×419 px, 41.7 KB)
### [01137] The Crimson Cowl
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (4/25)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **SCH**: 2, **ATK**: 3, **Base Threat**: 0, **Target Threat**: 3 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
- **Flavor**: *Ultron is using the components Klaw delivered in order to build an army of Ultron drones.*
- **Image Asset**: `assets/card-art/bundles/cards/01137.png` (419×300 px, 36.3 KB)
### [01137a] The Crimson Cowl
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (4/25)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Ultron (I) and Ultron (II). *(Ultron (II) and Ultron (III) instead for expert mode.)* Ultron and Standard encounter sets. One modular encounter set *(recommended: Under Attack).*
  > **Setup**: Put the Ultron Drones environment into play. Shuffle the encounter deck. Advanced to stage 1B.
- **Flavor**: *Klaw's mysterious, red-hooded employer is really the genocidal android Ultron.*
### [01137b] The Crimson Cowl
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (4/25)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 3 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
- **Flavor**: *Ultron is using the components Klaw delivered in order to build an army of Ultron drones.*
- **Image Asset**: `assets/card-art/bundles/cards/01137b.png` (419×300 px, 36.0 KB)
### [01138] Assault on NORAD
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (5/25)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After placing threat here during step one of the villain phase, each player must choose to either place 2 threat here or put the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
- **Flavor**: *If Ultron gains control of NORAD, he will have access to the United States' ballistic missile command!*
- **Image Asset**: `assets/card-art/bundles/cards/01138.png` (419×300 px, 42.3 KB)
### [01138a] Assault on NORAD
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (5/25)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion. Advance to stage 2B.
- **Flavor**: *As you pursue Ultron, you receive a distress call from the North American Aerospace Defense Command in Colorado. They are besieged by an army of Ultron drones!*
### [01138b] Assault on NORAD
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (5/25)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After placing threat here during step one of the villain phase, each player must choose to either place 2 threat here or put the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
- **Flavor**: *If Ultron gains control of NORAD, he will have access to the United States' ballistic missile command!*
### [01139] Countdown to Oblivion
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (6/25)
- **Properties**: Stage 3, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 5 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Threat cannot be removed from this scheme.
  > **If this stage is completed, the players lose the game**
- **Flavor**: *It's up to you to save the world from nuclear armageddon!*
- **Image Asset**: `assets/card-art/bundles/cards/01139.png` (419×300 px, 34.7 KB)
### [01139a] Countdown to Oblivion
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (6/25)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion. Advance to stage 3B.
- **Flavor**: *Ultron has seized control of NORAD. It's only a matter of time before he overcomes the command safeguards and launches the nuclear arsenal.*
### [01139b] Countdown to Oblivion
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (6/25)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 0, **Target Threat**: 5 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Threat cannot be removed from this scheme.
  > **If this stage is completed, the players lose the game**
- **Flavor**: *It's up to you to save the world from nuclear armageddon!*
### [01140] Ultron Drones
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (7/25)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each facedown [[Drone]] minion engaged with a player has a base SCH of 1, a base ATK of 1, and a base hit points of 1.
  > **Forced Response**: After a facedown [[Drone]] minion is defeated, place that card in it's owners discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/01140.png` (300×419 px, 39.2 KB)
### [01141] Program Transmitter
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (8/25)
- **Stats**: **SCH**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Attach to Ultron.
  > [star] **Forced Response**: After Ultron schemes, place 1 threat on each side scheme.
  > **Hero Action**: Exhaust your hero and spend [mental] [mental] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/01141.png` (300×419 px, 42.5 KB)
### [01142] Upgraded Drones
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (9–10/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the Ultron Drones environment.
  > Each facedown [[Drone]] minion gets +1 ATK and +1 hit point.
  > **Hero Action**: Spend [energy] [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/01142.png` (300×419 px, 38.8 KB)
### [01143] Advanced Ultron Drone
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (11–13/25, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Traits**: *Drone.*
- **Rules Text**:
  > Guard.
  > **Forced Interrupt**: When Advanced Ultron Drone is defeated, the engaged player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/01143.png` (300×419 px, 42.9 KB)
### [01144] Android Efficiency
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (14–16/25, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/01144.png` (300×419 px, 41.7 KB)
### [01144a] Android Efficiency
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (14/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
  >
  > ---
  >
  > [star] **Boost**: Choose to either spend a [energy] resource or put the top card of the deck into play facedown, engaged with you as a [[Drone]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/01144a.png` (300×419 px, 41.7 KB)
### [01144b] Android Efficiency
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (15/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
  >
  > ---
  >
  > [star] **Boost**: Choose to either spend a [mental] resource or put the top card of the deck into play facedown, engaged with you as a [[Drone]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/01144b.png` (300×419 px, 41.7 KB)
### [01144c] Android Efficiency
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (16/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion.
  >
  > ---
  >
  > [star] **Boost**: Choose to either spend a [physical] resource or put the top card of the deck into play facedown, engaged with you as a [[Drone]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/01144c.png` (300×419 px, 41.7 KB)
### [01145] Rage of Ultron
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (17–18/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Ultron schemes. Discard the top card of your deck for each threat placed this way.
  > **When Revealed (Hero)**: Ultron attacks you. Discard the top card of your deck for each damage dealt by this attack.
- **Image Asset**: `assets/card-art/bundles/cards/01145.png` (300×419 px, 42.8 KB)
### [01146] Repair Sequence
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (19–20/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Ultron heals 2 damage for each [[Drone]] minion engaged with you. If no damage was healed this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Ultron heals 1 damage for each [[Drone]] minion engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/01146.png` (300×419 px, 42.9 KB)
### [01147] Swarm Attack
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (21–22/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[Drone]] minion engaged with your hero attacks. If no attack was made this way, put the top card of your deck into play facedown, engaged with you as a [[Drone]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/01147.png` (300×419 px, 42.9 KB)
### [01148] Drone Factory
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (23/25)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Each player puts the top card of their deck into play facedown, engaged with them as a [[Drone]] minion. Place 1 threat here for each [[Drone]] minion in play.
- **Image Asset**: `assets/card-art/bundles/cards/01148.png` (419×300 px, 38.2 KB)
### [01149] Invasive AI
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (24/25)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Each player discards the top 3 cards of their deck.
- **Flavor**: *Ultron is hacking wireless networks around the world to create a global crisis.*
- **Image Asset**: `assets/card-art/bundles/cards/01149.png` (419×300 px, 36.2 KB)
### [01150] Ultron's Imperative
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Ultron (25/25)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ultron Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: The first player puts the top 2 cards of their deck into play facedown, engaged with them as [[Drone]] minions.
- **Flavor**: *Ultron directs his drone army through hive circuitry.*
- **Image Asset**: `assets/card-art/bundles/cards/01150.png` (419×300 px, 37.8 KB)

### Set: Under Attack

### [01151] Under Attack
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Under Attack (1/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Under Attack Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Each player chooses to either place 2 threat here or deal 3 damage to their hero.
- **Flavor**: *Civilians are under attack. They need your help fast!*
- **Image Asset**: `assets/card-art/bundles/cards/01151.png` (419×300 px, 36.0 KB)
### [01152] Vibranium Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Under Attack (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Under Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to the villain.
  > **Forced Response**: After the villain take damage, give it a tough status card.
  > **Hero Action**: Exhaust your hero and spend [physical] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/01152.png` (300×419 px, 39.7 KB)
### [01153] Concussion Blasters
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Under Attack (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Under Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > The villain gains retaliate 1.
  > **Hero Action**: Exhaust your hero and spend [energy] [energy] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/01153.png` (300×419 px, 36.8 KB)
### [01154] Concussive Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Under Attack (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Under Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to each friendly character.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/01154.png` (300×419 px, 37.6 KB)

### Set: Black Panther Nemesis

### [01156] Usurp The Throne
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther Nemesis (1/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Panther Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Flavor**: *The renegade, Killmonger, is leading a coup to seize control of Wakanda.*
- **Image Asset**: `assets/card-art/bundles/cards/01156.png` (419×300 px, 32.0 KB)
### [01157] Killmonger
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Panther Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Elite. Mercenary.*
- **Rules Text**:
  > Killmonger cannot take damage from [[Black Panther]] upgrades.
- **Flavor**: *"That should be me on the throne!"*
- **Image Asset**: `assets/card-art/bundles/cards/01157.png` (300×419 px, 35.6 KB)
### [01158] Heart-Shaped Herb
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Black Panther Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge *(After this card resolves, reveal 1 additional encounter card)*
  > **When Revealed**: Give the villain and each minion engaged with you a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/01158.png` (300×419 px, 40.8 KB)
### [01159] Ritual Combat
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Black Panther Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Panther Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top card of the encounter deck. Then, choose to either deal X damage to your hero or place X threat on the main scheme. X is 1 more than the number of boost icons on the discarded encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/01159.png` (300×419 px, 46.5 KB)

### Set: She-Hulk Nemesis

### [01161] Personal Challenge
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk Nemesis (1/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: She-Hulk Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Place an additional 1 [per_hero] threat here.
- **Flavor**: *Titania had held a grudge against She-Hulk for years. She won't rest until she settles the score.*
- **Image Asset**: `assets/card-art/bundles/cards/01161.png` (419×300 px, 41.0 KB)
### [01162] Titania
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: -1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: She-Hulk Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite.*
- **Rules Text**:
  > X is equal to Titania's remaining hit points.
- **Flavor**: *"Face it, Greenie. There's only room for one strongest woman... and it ain't you!"*
- **Image Asset**: `assets/card-art/bundles/cards/01162.png` (300×419 px, 36.0 KB)
### [01163] Genetically Enhanced
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: She-Hulk Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the minion with the highest printed hit points. If there are no minions in play, this card gains surge.
  > Attached minion gets +3 hit points.
- **Image Asset**: `assets/card-art/bundles/cards/01163.png` (300×419 px, 41.7 KB)
### [01164] Titania's Fury
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: She-Hulk Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: She-Hulk Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Titania attacks your hero. If Titania did not attack, heal all damage from Titania and this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/01164.png` (300×419 px, 43.7 KB)

### Set: Spider-Man Nemesis

### [01166] Highway Robbery
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man Nemesis (1/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Each player places a random card from their hand facedown here.
  > **When Defeated**: Return each facedown card here to its owner's hand.
- **Image Asset**: `assets/card-art/bundles/cards/01166.png` (419×300 px, 40.2 KB)
### [01167] Vulture
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Quickstrike. *(After this minion engages your hero, it attacks.)*
- **Flavor**: *"I'm faster, strong, and smarter than a hundred men my age!"*
- **Image Asset**: `assets/card-art/bundles/cards/01167.png` (300×419 px, 41.7 KB)
### [01168] Sweeping Swoop
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man Nemesis (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Spider-Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Stun your hero. If Vulture is in play, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If this activation deals damage to a friendly character, stun that character.
- **Image Asset**: `assets/card-art/bundles/cards/01168.png` (300×419 px, 41.6 KB)
### [01169] The Vulture's Plans
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Spider-Man Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1 card at random from each player's hand. Place 1 threat on the main scheme for each different resource type discarded this way.
- **Flavor**: *"Spider-Man will pay for interfering with my plans!" —The Vulture*
- **Image Asset**: `assets/card-art/bundles/cards/01169.png` (300×419 px, 39.2 KB)

### Set: Iron Man Nemesis

### [01171] Imminent Overload
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man Nemesis (1/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Man Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place an additional 1 [per_hero] threat here.
- **Flavor**: *Whiplash has seized control of a power plant, threatening to overload the transformers if his demands are not met.*
- **Image Asset**: `assets/card-art/bundles/cards/01171.png` (419×300 px, 33.3 KB)
### [01172] Whiplash
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Retaliate 1 *(After this character is attacked, deal 1 damage to the attacking character.)*
- **Flavor**: *"You started this, Tony. I will finish it."*
- **Image Asset**: `assets/card-art/bundles/cards/01172.png` (300×419 px, 35.9 KB)
### [01173] Electric Whip Attack
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man Nemesis (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Iron Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose to either deal 1 damage to your hero for each upgrade you control or choose and discard an upgrade you control.
  >
  > ---
  >
  > [star] **Boost**: If the villain is making an undefended attack, choose and discard an upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/01173.png` (300×419 px, 38.1 KB)
### [01174] Electromagnetic Backlash
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Iron Man Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Man Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player discards the top 5 cards of their deck. For each printed [energy] resource a player discards this way, that player takes 1 damage.
- **Flavor**: *Five, four, three, two...*
- **Image Asset**: `assets/card-art/bundles/cards/01174.png` (300×419 px, 38.9 KB)

### Set: Captain Marvel Nemesis

### [01176] The Psyche-Magnitron
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel Nemesis (1/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain Marvel Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place an additional 1[per_hero] threat here.
- **Flavor**: *The Psyche-Magnitron is a Kree device with the power to turn thoughts into reality. In the hands of Yon-Rogg, it would be a devastating weapon.*
- **Image Asset**: `assets/card-art/bundles/cards/01176.png` (419×300 px, 39.3 KB)
### [01177] Yon-Rogg
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain Marvel Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Kree.*
- **Rules Text**:
  > [star] **Forced Response**: After Yon-Rogg attacks, place 1 threat on The Psyche-Magnitron.
- **Flavor**: *"It isn't real power unless they fear you."*
- **Image Asset**: `assets/card-art/bundles/cards/01177.png` (300×419 px, 37.6 KB)
### [01178] Kree Manipulator
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel Nemesis (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Captain Marvel Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge. *(After this card resolves, reveal 1 additional encounter card.)*
  > **When Revealed**: Place 1 threat on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: If the villain is making an undefended attack, place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/01178.png` (300×419 px, 35.2 KB)
### [01179] Yon-Rogg's Treason
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Captain Marvel Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain Marvel Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard each [energy] resource from your hand. If you discarded no cards this way, this card gains surge.
- **Flavor**: *"This world now belongs to the Kree empire!" —Yon-Rogg*
- **Image Asset**: `assets/card-art/bundles/cards/01179.png` (300×419 px, 33.2 KB)

### Set: Legions of Hydra

### [01180] Legions of Hydra
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Legions of Hydra (1–2/6, Qty: 2)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Legions of Hydra Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: If Madame Hydra is not in play, search the encounter deck and discard pile for Madame Hydra and put her into play engaged with you, then shuffle the encounter deck. Place 2 additional threat here for each [[Hydra]] enemy in play.
- **Image Asset**: `assets/card-art/bundles/cards/01180.png` (419×300 px, 42.4 KB)
### [01181] Madame Hydra
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Legions of Hydra (3/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Legions of Hydra Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Hydra.*
- **Rules Text**:
  > Madame Hydra cannot take damage while the Legions of Hydra side scheme is in play.
  > [star] **Forced Response**: After Madame Hydra schemes or attacks, place 2 threat on the Legions of Hydra side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/01181.png` (300×419 px, 43.0 KB)
### [01182] Hydra Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Legions of Hydra (4–6/6, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Legions of Hydra Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hydra.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
  > **When Defeated**: Deal the engaged player an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/01182.png` (300×419 px, 39.9 KB)

### Set: The Doomsday Chair

### [01183] The Doomsday Chair
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: The Doomsday Chair (1–2/6, Qty: 2)
- **Stats**: **Base Threat**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Doomsday Chair Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: If M.O.D.O.K. is not in play, search the encounter deck and discard pile for M.O.D.O.K. and put him into play engaged with you, then shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/01183.png` (419×300 px, 37.9 KB)
### [01184] M.O.D.O.K.
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: The Doomsday Chair (3/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Doomsday Chair Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cyborg. Elite.*
- **Rules Text**:
  > Retaliate 2. *(After this character is attacked, deal 2 damage to the attacking character.)*
- **Flavor**: *"You should have stayed hidden under the rock you crawled out from!"*
- **Image Asset**: `assets/card-art/bundles/cards/01184.png` (300×419 px, 40.2 KB)
### [01185] Biomechanical Upgrades
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: The Doomsday Chair (4–6/6, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Doomsday Chair Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Surge.
  > Attach to the minion with the highest printed hit points and without another Biomechanical Upgrades attached.
  > **Forced Interrupt**: When attached minion would be defeated, heal all damage from it instead, then discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/01185.png` (300×419 px, 39.1 KB)

### Set: Standard

### [01186] Advance
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Standard (1–2/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Standard Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The villain schemes.
- **Flavor**: *"The world will be mine!" —Red Skull*
- **Image Asset**: `assets/card-art/bundles/cards/01186.png` (300×419 px, 29.9 KB)
### [01187] Assault
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Standard (3–4/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Standard Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: The villain attacks you.
- **Flavor**: *"Die!" —Venom*
- **Image Asset**: `assets/card-art/bundles/cards/01187.png` (300×419 px, 34.8 KB)
### [01188] Caught Off Guard
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Standard (5/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Standard Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard an upgrade or support you control. If no cards were discarded this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/01188.png` (300×419 px, 37.8 KB)
### [01189] Gang-Up
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Standard (6/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Standard Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: The villain and each minion engaged with you attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/01189.png` (300×419 px, 37.5 KB)
### [01190] Shadow of the Past
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Standard (7/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Standard Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Reveal your set-aside nemesis minion and put it into play engaged with you. Reveal your set-aside nemesis side scheme and put it into play. Shuffle the rest of your set-aside nemesis encounter set into the encounter deck. If your nemesis minion does not enter the game this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/01190.png` (300×419 px, 42.5 KB)

### Set: Expert

### [01191] Exhaustion
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Expert (1/3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Expert Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Exhaust your identity card.
- **Image Asset**: `assets/card-art/bundles/cards/01191.png` (300×419 px, 33.3 KB)
### [01192] Masterplan
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Expert (2/3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Expert Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 4 threat on each side scheme. If there are no side schemes in play, discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/01192.png` (300×419 px, 35.7 KB)
### [01193] Under Fire
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Core Set (`core`)
- **Deck / Set**: Expert (3/3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Expert Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Reveal the top card of the encounter deck.
- **Flavor**: *"But wait, there's more" —Klaw*
- **Image Asset**: `assets/card-art/bundles/cards/01193.png` (300×419 px, 36.9 KB)

