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
| `27001a` | Ghost-Spider | Hero | Ghost-Spider | THW:1 ATK:2 DEF:3 HP:10 | - | `sm` |
| `27001b` | Gwen Stacy | Alter-Ego | Ghost-Spider | REC:3 HP:10 | - | `sm` |
| `27002` | Ghost Kick | Event | Ghost-Spider | - | - | `sm` |
| `27003` | Parental Guidance | Event | Ghost-Spider | - | - | `sm` |
| `27004` | Phantom Flip | Event | Ghost-Spider | - | - | `sm` |
| `27005` | Pirouette and Punch | Event | Ghost-Spider | - | - | `sm` |
| `27006` | Web Binding | Event | Ghost-Spider | - | - | `sm` |
| `27007` | George Stacy | Support | Ghost-Spider | - | - | `sm` |
| `27008` | Ticket to the Multiverse | Upgrade | Ghost-Spider | - | - | `sm` |
| `27009` | Web-Bracelet | Upgrade | Ghost-Spider | - | - | `sm` |
| `27010` | Silk | Ally | Pack Position: 10 | THW:1 ATK:1 HP:2 | - | `sm` |
| `27011` | Spider-Man | Ally | Pack Position: 11 | THW:1 ATK:2 HP:3 | - | `sm` |
| `27012` | Spider-UK | Ally | Pack Position: 12 | THW:1 ATK:2 HP:5 | - | `sm` |
| `27013` | Bait and Switch | Event | Pack Position: 13 | - | - | `sm` |
| `27014` | Jump Flip | Event | Pack Position: 14 | - | - | `sm` |
| `27015` | Return the Favor | Event | Pack Position: 15 | - | - | `sm` |
| `27016` | What Doesn't Kill Me | Event | Pack Position: 16 | - | - | `sm` |
| `27017` | Spider-Man | Ally | Pack Position: 17 | THW:2 ATK:1 HP:3 | - | `sm` |
| `27018` | Across the Spider-Verse | Event | Pack Position: 18 | - | - | `sm` |
| `27019` | Young Love | Event | Pack Position: 19 | - | - | `sm` |
| `27020` | Energy | Resource | Pack Position: 20 | - | - | `sm` |
| `27021` | Genius | Resource | Pack Position: 21 | - | - | `sm` |
| `27022` | Strength | Resource | Pack Position: 22 | - | - | `sm` |
| `27023` | Web of Life and Destiny | Support | Pack Position: 23 | - | - | `sm` |
| `27024` | Plan B | Upgrade | Pack Position: 24 | - | - | `sm` |
| `27025` | Worried Father | Obligation | Ghost-Spider | - | 2 icons | `sm` |
| `27026` | Regenerative Research | Side Scheme | Ghost-Spider Nemesis | - | 3 icons | `sm` |
| `27027` | The Lizard | Minion | Ghost-Spider Nemesis | SCH:1 ATK:3 HP:5 | 2 icons | `sm` |
| `27028` | Experimental Injection | Attachment | Ghost-Spider Nemesis | - | not recorded in this source | `sm` |
| `27029` | In Cold Blood | Treachery | Ghost-Spider Nemesis | - | 1 icon | `sm` |
| `27030a` | Spider-Man | Hero | Spider-Man - Miles Morales | THW:2 ATK:2 DEF:2 HP:9 | - | `sm` |
| `27030b` | Miles Morales | Alter-Ego | Spider-Man - Miles Morales | REC:4 HP:9 | - | `sm` |
| `27031` | Arachnobatics | Event | Spider-Man - Miles Morales | - | - | `sm` |
| `27032` | Double Life | Event | Spider-Man - Miles Morales | - | - | `sm` |
| `27033` | Swing In | Event | Spider-Man - Miles Morales | - | - | `sm` |
| `27034` | Web-Shot | Event | Spider-Man - Miles Morales | - | - | `sm` |
| `27035` | Ganke Lee | Support | Spider-Man - Miles Morales | - | - | `sm` |
| `27036` | Jefferson Davis | Support | Spider-Man - Miles Morales | - | - | `sm` |
| `27037` | Power Within | Upgrade | Spider-Man - Miles Morales | - | - | `sm` |
| `27038` | Defense Mechanism | Upgrade | Spider-Man - Miles Morales | - | - | `sm` |
| `27039` | Web-Shooter | Upgrade | Spider-Man - Miles Morales | - | - | `sm` |
| `27040` | Monica Chang | Ally | Pack Position: 40 | THW:1 ATK:1 HP:2 | - | `sm` |
| `27041` | Spider-Woman | Ally | Pack Position: 41 | THW:1 ATK:2 HP:3 | - | `sm` |
| `27042` | Homeland Intervention | Event | Pack Position: 42 | - | - | `sm` |
| `27043` | Global Logistics | Event | Pack Position: 43 | - | - | `sm` |
| `27044` | Field Agent | Support | Pack Position: 44 | - | - | `sm` |
| `27045` | Surveillance Team | Support | Pack Position: 45 | - | - | `sm` |
| `27046` | Agent 13 | Ally | Pack Position: 46 | THW:2 ATK:1 HP:4 | - | `sm` |
| `27047` | Dum Dum Dugan | Ally | Pack Position: 47 | THW:3 ATK:3 HP:5 | - | `sm` |
| `27048` | Ghost-Spider | Ally | Pack Position: 48 | THW:1 ATK:2 HP:3 | - | `sm` |
| `27049` | Spider-Man | Ally | Pack Position: 49 | THW:2 ATK:2 HP:3 | - | `sm` |
| `27050` | Young Love | Event | Pack Position: 50 | - | - | `sm` |
| `27051` | Energy | Resource | Pack Position: 51 | - | - | `sm` |
| `27052` | Genius | Resource | Pack Position: 52 | - | - | `sm` |
| `27053` | Strength | Resource | Pack Position: 53 | - | - | `sm` |
| `27054` | Government Liaison | Support | Pack Position: 54 | - | - | `sm` |
| `27055` | Sky-Destroyer | Support | Pack Position: 55 | - | - | `sm` |
| `27056` | Keeping Secrets | Obligation | Spider-Man - Miles Morales | - | 2 icons | `sm` |
| `27057` | Tracking Prey | Side Scheme | Spider-Man - Morales Nemesis | - | 3 icons | `sm` |
| `27058` | Prowler | Minion | Spider-Man - Morales Nemesis | SCH:1 ATK:2 HP:5 | 2 icons | `sm` |
| `27059` | Razor Claws | Attachment | Spider-Man - Morales Nemesis | ATK:2 | 2 icons | `sm` |
| `27060` | Slice and Dice | Treachery | Spider-Man - Morales Nemesis | - | 1 icon | `sm` |
| `27061` | Sandman | Villain | Sandman | SCH:1 ATK:2 HP:16 | - | `sm` |
| `27062` | Sandman | Villain | Sandman | SCH:1 ATK:3 HP:18 | - | `sm` |
| `27063` | Sandman | Villain | Sandman | SCH:1 ATK:3 HP:19 | - | `sm` |
| `27064` | Hapless Pedestrians | Main Scheme | Sandman | - | - | `sm` |
| `27064a` | Hapless Pedestrians | Main Scheme | Sandman | - | - | `sm` |
| `27064b` | Hapless Pedestrians | Main Scheme | Sandman | - | - | `sm` |
| `27065` | City Streets | Environment | Sandman | - | - | `sm` |
| `27066` | Sand Form | Attachment | Sandman | - | 0 icons + star | `sm` |
| `27067` | Sand Clone | Minion | Sandman | SCH:1 ATK:-1 HP:3 | not recorded in this source | `sm` |
| `27068` | Dirt Trap | Side Scheme | Sandman | - | 3 icons | `sm` |
| `27069` | Tidal Sands | Side Scheme | Sandman | - | 2 icons | `sm` |
| `27070` | Sandslide | Treachery | Sandman | - | 0 icons + star | `sm` |
| `27071` | Sand Storm | Treachery | Sandman | - | 2 icons | `sm` |
| `27072` | Sand Smash | Treachery | Sandman | - | 1 icon | `sm` |
| `27073` | Venom | Villain | Venom | SCH:1 ATK:2 HP:17 | - | `sm` |
| `27074` | Venom | Villain | Venom | SCH:2 ATK:2 HP:18 | - | `sm` |
| `27075` | Venom | Villain | Venom | SCH:2 ATK:3 HP:20 | - | `sm` |
| `27076a` | "Leave Us Alone!" | Main Scheme | Venom | - | - | `sm` |
| `27076b` | "Leave Us Alone!" | Main Scheme | Venom | - | - | `sm` |
| `27077a` | Bell Tower | Environment | Venom | - | - | `sm` |
| `27077b` | Bell Tower | Environment | Venom | - | - | `sm` |
| `27078` | "Now We're Angry!" | Attachment | Venom | ATK:1 | 0 icons + star | `sm` |
| `27079` | Guard the Bell Tower | Side Scheme | Venom | - | 2 icons | `sm` |
| `27080` | Lashing Out | Side Scheme | Venom | - | 1 icon + star | `sm` |
| `27081` | Tooth and Nail | Side Scheme | Venom | - | 2 icons + star | `sm` |
| `27082` | Biting Retort | Treachery | Venom | - | 1 icon + star | `sm` |
| `27083` | For Whom the Bell Tolls | Treachery | Venom | - | 0 icons + star | `sm` |
| `27084` | Mysterio | Villain | Mysterio | SCH:2 ATK:1 HP:15 | - | `sm` |
| `27085` | Mysterio | Villain | Mysterio | SCH:2 ATK:2 HP:17 | - | `sm` |
| `27086` | Mysterio | Villain | Mysterio | SCH:2 ATK:2 HP:16 | - | `sm` |
| `27087` | Maze of Mirrors | Main Scheme | Mysterio | - | - | `sm` |
| `27087a` | Maze of Mirrors | Main Scheme | Mysterio | - | - | `sm` |
| `27087b` | Maze of Mirrors | Main Scheme | Mysterio | - | - | `sm` |
| `27088` | Edge of Reality | Main Scheme | Mysterio | - | - | `sm` |
| `27088a` | Edge of Reality | Main Scheme | Mysterio | - | - | `sm` |
| `27088b` | Edge of Reality | Main Scheme | Mysterio | - | - | `sm` |
| `27089` | Humongous Hallucination | Attachment | Mysterio | - | 3 icons | `sm` |
| `27090` | Masterful Mirage | Attachment | Mysterio | - | 1 icon + star | `sm` |
| `27091` | Shifting Apparition | Minion | Mysterio | SCH:1 ATK:1 HP:1 | 1 icon | `sm` |
| `27092` | Déjà Vu | Treachery | Mysterio | - | 0 icons + star | `sm` |
| `27093` | Fearmonger | Treachery | Mysterio | - | 0 icons + star | `sm` |
| `27094` | Doctor Octopus | Villain | The Sinister Six | SCH:2 ATK:2 HP:8 | - | `sm` |
| `27095` | Electro | Villain | The Sinister Six | SCH:2 ATK:1 HP:8 | - | `sm` |
| `27096` | Hobgoblin | Villain | The Sinister Six | SCH:2 ATK:1 HP:9 | - | `sm` |
| `27097` | Kraven the Hunter | Villain | The Sinister Six | SCH:1 ATK:2 HP:9 | - | `sm` |
| `27098` | Scorpion | Villain | The Sinister Six | SCH:0 ATK:3 HP:10 | - | `sm` |
| `27099` | Vulture | Villain | The Sinister Six | SCH:1 ATK:2 HP:7 | - | `sm` |
| `27100` | Sinister Synchonization | Main Scheme | The Sinister Six | - | - | `sm` |
| `27100a` | Sinister Synchronization | Main Scheme | The Sinister Six | - | - | `sm` |
| `27100b` | Sinister Synchronization | Main Scheme | The Sinister Six | - | - | `sm` |
| `27101a` | Sinister Beatdown | Main Scheme | The Sinister Six | - | - | `sm` |
| `27101b` | Sinister Beatdown | Main Scheme | The Sinister Six | - | - | `sm` |
| `27102a` | Light at the End | Side Scheme | The Sinister Six | - | not recorded in this source | `sm` |
| `27102b` | Light at the End | Side Scheme | The Sinister Six | - | not recorded in this source | `sm` |
| `27103` | Heightened Morale | Attachment | The Sinister Six | ATK:-1 | not recorded in this source | `sm` |
| `27104` | Taunting Presence | Attachment | The Sinister Six | - | 2 icons | `sm` |
| `27105` | Team Leader | Attachment | The Sinister Six | - | 1 icon | `sm` |
| `27106` | Take One for the Team | Attachment | The Sinister Six | - | 1 icon | `sm` |
| `27107` | Brute Force Barricade | Side Scheme | The Sinister Six | - | 2 icons + star | `sm` |
| `27108` | Frequent Flyers | Treachery | The Sinister Six | - | 3 icons | `sm` |
| `27109` | High Fashion | Treachery | The Sinister Six | - | 3 icons | `sm` |
| `27110` | Robotic Enhancements | Treachery | The Sinister Six | - | 3 icons | `sm` |
| `27111` | Partnership of Pain | Treachery | The Sinister Six | - | 2 icons | `sm` |
| `27112` | Surprise! | Treachery | The Sinister Six | - | 1 icon | `sm` |
| `27113` | Venom Goblin | Villain | Venom Goblin | SCH:2 ATK:2 HP:16 | - | `sm` |
| `27114` | Venom Goblin | Villain | Venom Goblin | SCH:2 ATK:3 HP:18 | - | `sm` |
| `27115` | Venom Goblin | Villain | Venom Goblin | SCH:3 ATK:3 HP:21 | - | `sm` |
| `27116a` | Skies Over New York | Main Scheme | Venom Goblin | - | - | `sm` |
| `27116b` | Skies Over New York | Environment | Venom Goblin | - | - | `sm` |
| `27117a` | Lower Manhattan | Main Scheme | Venom Goblin | - | - | `sm` |
| `27117b` | Lower Manhattan | Environment | Venom Goblin | - | - | `sm` |
| `27118a` | Midtown Manhattan | Main Scheme | Venom Goblin | - | - | `sm` |
| `27118b` | Midtown Manhattan | Environment | Venom Goblin | - | - | `sm` |
| `27119a` | Upper Manhattan | Main Scheme | Venom Goblin | - | - | `sm` |
| `27119b` | Upper Manhattan | Environment | Venom Goblin | - | - | `sm` |
| `27120` | We Are One | Attachment | Venom Goblin | SCH:3 ATK:3 | 3 icons | `sm` |
| `27121` | Symbiotic Berserker | Minion | Venom Goblin | SCH:0 ATK:3 HP:5 | 0 icons + star | `sm` |
| `27122` | Symbiotic Monstrosity | Minion | Venom Goblin | SCH:2 ATK:2 HP:6 | 3 icons + star | `sm` |
| `27123` | Symbiotic Thrall | Minion | Venom Goblin | SCH:1 ATK:2 HP:4 | 0 icons + star | `sm` |
| `27124` | Festering Mass | Side Scheme | Venom Goblin | - | 0 icons + star | `sm` |
| `27125` | Joy Ride | Side Scheme | Venom Goblin | - | 2 icons | `sm` |
| `27126` | Spreading Panic | Treachery | Venom Goblin | - | 0 icons + star | `sm` |
| `27127` | Panic in the Streets | Side Scheme | City in Chaos | - | 2 icons | `sm` |
| `27128` | Rhino | Minion | City in Chaos | SCH:0 ATK:3 HP:8 | 3 icons | `sm` |
| `27129` | Calling in Favors | Treachery | City in Chaos | - | 2 icons | `sm` |
| `27130` | Now or Never | Treachery | City in Chaos | - | 1 icon | `sm` |
| `27131` | Common Criminal | Minion | Down to Earth | SCH:0 ATK:1 HP:3 | 1 icon | `sm` |
| `27132` | Friends and Family | Obligation | Down to Earth | - | 3 icons | `sm` |
| `27133` | Volunteer Work | Side Scheme | Down to Earth | - | 2 icons | `sm` |
| `27134` | "Threat or Menace?" | Treachery | Down to Earth | - | not recorded in this source | `sm` |
| `27135` | Loose Ends | Treachery | Down to Earth | - | not recorded in this source | `sm` |
| `27136` | Advanced Glider | Attachment | Goblin Gear | - | 3 icons | `sm` |
| `27137` | Concussive Bombs | Attachment | Goblin Gear | ATK:1 | 2 icons | `sm` |
| `27138` | Incendiary Bombs | Attachment | Goblin Gear | ATK:1 | 1 icon | `sm` |
| `27139` | Smoke Bombs | Attachment | Goblin Gear | ATK:1 | 1 icon | `sm` |
| `27140` | Limitless Supply | Side Scheme | Goblin Gear | - | 3 icons | `sm` |
| `27141` | Remote Navigation | Treachery | Goblin Gear | - | 0 icons + star | `sm` |
| `27142` | Life-Size Decoy | Minion | Guerrilla Tactics | SCH:0 ATK:0 HP:5 | 0 icons + star | `sm` |
| `27143` | Coordinated Effort | Side Scheme | Guerrilla Tactics | - | 1 icon + star | `sm` |
| `27144` | Hidden in Shadow | Side Scheme | Guerrilla Tactics | - | 1 icon + star | `sm` |
| `27145` | Teamwork Makes the Dream Work | Side Scheme | Guerrilla Tactics | - | 2 icons + star | `sm` |
| `27146` | From Every Direction | Treachery | Guerrilla Tactics | - | not recorded in this source | `sm` |
| `27147` | Arm Cannon | Attachment | Osborn Tech | - | 3 icons | `sm` |
| `27148` | Ionic Boots | Attachment | Osborn Tech | - | 3 icons | `sm` |
| `27149` | Kinetic Armor | Attachment | Osborn Tech | - | 3 icons | `sm` |
| `27150` | Neocarbon Scales | Attachment | Osborn Tech | - | 3 icons | `sm` |
| `27151` | Spiked Gauntlet | Attachment | Osborn Tech | ATK:1 | 3 icons | `sm` |
| `27152` | Tracking Display | Attachment | Osborn Tech | - | 3 icons | `sm` |
| `27153` | Induced Panic | Attachment | Personal Nightmare | - | 1 icon | `sm` |
| `27154` | Evil Doppelgänger | Minion | Personal Nightmare | SCH:1 ATK:1 HP:5 | 2 icons + star | `sm` |
| `27155` | Fool's Paradise | Side Scheme | Personal Nightmare | - | 3 icons | `sm` |
| `27156` | Weakness from Within | Side Scheme | Personal Nightmare | - | 2 icons | `sm` |
| `27157` | Deepest Fears | Treachery | Personal Nightmare | - | not recorded in this source | `sm` |
| `27158` | Doctor Octopus | Minion | Sinister Assault | SCH:2 ATK:2 HP:6 | 3 icons | `sm` |
| `27159` | Electro | Minion | Sinister Assault | SCH:2 ATK:1 HP:6 | 3 icons | `sm` |
| `27160` | Hobgoblin | Minion | Sinister Assault | SCH:1 ATK:2 HP:6 | 3 icons | `sm` |
| `27161` | Kraven the Hunter | Minion | Sinister Assault | SCH:1 ATK:2 HP:6 | 3 icons | `sm` |
| `27162` | Scorpion | Minion | Sinister Assault | SCH:1 ATK:3 HP:6 | 3 icons | `sm` |
| `27163` | Vulture | Minion | Sinister Assault | SCH:1 ATK:1 HP:6 | 3 icons | `sm` |
| `27164` | Improvised Weapons | Attachment | Symbiotic Strength | - | 1 icon | `sm` |
| `27165` | Violent Tendencies | Attachment | Symbiotic Strength | - | 2 icons | `sm` |
| `27166` | Webbed Up | Attachment | Symbiotic Strength | - | 0 icons + star | `sm` |
| `27167` | Enraged Symbiote | Minion | Symbiotic Strength | SCH:1 ATK:2 HP:2 | 0 icons + star | `sm` |
| `27168` | Swinging Assault | Treachery | Symbiotic Strength | - | 2 icons | `sm` |
| `27169` | Unstable Sentience | Treachery | Symbiotic Strength | - | 0 icons + star | `sm` |
| `27170` | Delusion of Collusion | Attachment | Whispers of Paranoia | - | 1 icon + star | `sm` |
| `27171` | Manipulated Mind | Attachment | Whispers of Paranoia | - | 2 icons | `sm` |
| `27172` | Old Grudge | Attachment | Whispers of Paranoia | - | 2 icons + star | `sm` |
| `27173` | Analysis Paralysis | Side Scheme | Whispers of Paranoia | - | 3 icons | `sm` |
| `27174a` | Public Outcry | Environment | Bad Publicity | - | - | `sm` |
| `27174b` | Public Outcry | Environment | Bad Publicity | - | - | `sm` |
| `27175` | Smear Campaign | Treachery | Bad Publicity | - | 3 icons | `sm` |
| `27176` | Back Alley Burglary | Side Scheme | Community Service | - | 3 icons | `sm` |
| `27177` | Cat in a Tree | Side Scheme | Community Service | - | 3 icons | `sm` |
| `27178` | Henchmen Heist | Side Scheme | Community Service | - | 3 icons | `sm` |
| `27179` | Off the Rails | Side Scheme | Community Service | - | 3 icons | `sm` |
| `27180` | Rubble Rescue | Side Scheme | Community Service | - | 3 icons | `sm` |
| `27181` | Snitches Get Stitches | Attachment | Snitches get Stitches | - | 3 icons | `sm` |
| `27182a` | Compact Darts | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27182b` | Compact Darts | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27183a` | Impact-Dampening Suit | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27183b` | Impact-Dampening Suit | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27184a` | Laser Goggles | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27184b` | Laser Goggles | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27185a` | Propulsion Gauntlet | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27185b` | Propulsion Gauntlet | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27186a` | Retinal Display | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27186b` | Retinal Display | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27187a` | Shock Knuckles | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27187b` | Shock Knuckles | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27188a` | Wave Bracers | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27188b` | Wave Bracers | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27189a` | Wrist Navigator | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27189b` | Wrist Navigator | Upgrade | Shield Tech | - | not recorded in this source | `sm` |
| `27190` | Venom | Ally | Pack Position: 190 | THW:2 ATK:3 HP:6 | - | `sm` |
| `27191` | Symbiote Suit | Upgrade | Pack Position: 191 | - | - | `sm` |

---

## Pack: Sinister Motives (`sm`)

### Set: Ghost-Spider

### [27001a] Ghost-Spider
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 3, **HP**: 10, **Hand Size**: 5
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > *Dizzying Reflexes* - **Response:** After you resolve an "**Interrupt**" or "**Response**" ability on an event, ready Ghost-Spider. (Limit once per phase.)
- **Flavor**: *"So I'm fighting a monster. Not the worst way for a teenage girl to spend her Friday evening."*
- **Image Asset**: `assets/card-art/bundles/cards/27001a.png` (300×418 px, 227.6 KB)

### [27001b] Gwen Stacy
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > **Action:** Choose to either shuffle Ticket to the Multiverse from your discard pile into your deck or ready George Stacy. (Limit once per round.)
- **Flavor**: *"Time for the drum solo!"*
- **Image Asset**: `assets/card-art/bundles/cards/27001b.png` (300×418 px, 238.7 KB)

### [27002] Ghost Kick
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (1–3/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Response** *(attack)*: After Ghost-Spider uses a basic power, deal 6 damage to an enemy. (Max 1 per basic power use.)
- **Flavor**: *"I thought you'd at least TRY to put a fight."-Ghost-Spider*
- **Image Asset**: `assets/card-art/bundles/cards/27002.png` (778×1095 px, 256.3 KB)

### [27003] Parental Guidance
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (4/15)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Alter-Ego Action**:
  > - If George Stacy is in play, attach 1 event from your hand or discard pile facedown to George Stacy.
  > - If George Stacy is not in play, search your deck and discard pile for him and add him to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/27003.png` (806×1105 px, 266.7 KB)

### [27004] Phantom Flip
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (5–7/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Response** *(thwart)*: After Ghost-Spider uses a basic power, remove 5 threat from a scheme. (Max 1 per basic power use.)
- **Flavor**: *"Life is most in-focus when the world is upside down."-Gwen Stacy*
- **Image Asset**: `assets/card-art/bundles/cards/27004.png` (788×1083 px, 269.9 KB)

### [27005] Pirouette and Punch
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (8–9/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When a card is revealed from the encounter deck, deal damage to the villain equal to 1 more than the boost icons *([boost])* on that card. Cancel that card's "**When Revealed**" effects.
- **Image Asset**: `assets/card-art/bundles/cards/27005.png` (816×1103 px, 243.3 KB)

### [27006] Web Binding
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (10–11/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Requirement ([mental]). *(While paying for this card, spend the listed resources.)*
  > **Hero Interrupt**: When an enemy would activate, cancel that activation. If a minion's activation was cancelled this way, deal 4 damage to that minion.
- **Image Asset**: `assets/card-art/bundles/cards/27006.png` (784×1085 px, 267.9 KB)

### [27007] George Stacy
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (12/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Persona.*
- **Rules Text**:
  > Events attached to George Stacy may be played as if they were in your hand.
  > **Action**: Exhaust George Stacy → attach 1 event from your hand facedown here (to a maximum of 3).
- **Flavor**: *"Trust me, Ghost-Spider is not the problem."*
- **Image Asset**: `assets/card-art/bundles/cards/27007.png` (820×1079 px, 287.1 KB)

### [27008] Ticket to the Multiverse
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (13/15)
- **Stats**: **Cost**: 3, **Resources**: [wild] [wild]
- **Traits**: *Item.*
- **Rules Text**:
  > **Action**: Remove Ticket to the Multiverse from the game → discard your hand, shuffle your discard pile into your deck, draw up to your hand size, and ready each Ghost-Spider card you control.
- **Image Asset**: `assets/card-art/bundles/cards/27008.png` (814×1105 px, 264.3 KB)

### [27009] Web-Bracelet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (14–15/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > **Hero Response**: After you resolve an "**Interrupt**" or "**Response**" ability on an event, exhaust Web-Bracelet → draw 1 card. (Max 1 per event.)
- **Flavor**: *"These should come in handy."-Gwen Stacy*
- **Image Asset**: `assets/card-art/bundles/cards/27009.png` (794×1085 px, 270.8 KB)

### [27025] Worried Father
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ghost-Spider Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Give to the Gwen Stacy player.**
  > Search your deck, hand, discard pile, and play area for George Stacy and attach him facedown to this card.
  > **Alter-Ego Action**: Exhaust Gwen Stacy and remove this obligation from the game → add George Stacy to your hand.
- **Errata (FFG)**:
  > Attaches George Stacy to itself instead of setting him aside and attaching to him. (RRG 1.6)
- **Image Asset**: `assets/card-art/bundles/cards/27025.png` (768×1101 px, 273.8 KB)


### Set: Protection

### [27010] Silk — *Cindy Moon*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 10
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > **Response**: After you play Silk from your hand, if you control another [[Web-Warrior]] card, search the encounter deck for a treachery and discard it. *(Shuffle.)*
- **Flavor**: *"Maybe I am getting the hang of this superhero stuff."*
- **Image Asset**: `assets/card-art/bundles/cards/27010.png` (780×1093 px, 259.6 KB)

### [27011] Spider-Man — *Miles Morales*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > **Response**: After you play Spider-Man from your hand, stun and confuse an enemy if you control at least 3 [[Web-Warrior]] cards.
- **Flavor**: *"Brooklyn doesn't like being run. We're wild like that."*
- **Image Asset**: `assets/card-art/bundles/cards/27011.png` (806×1089 px, 274.9 KB)

### [27012] Spider-UK — *Billy Braddock*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 2), **HP**: 5, **Resources**: [physical]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > **Interrupt**: When Spider-UK defends against an attack, deal damage to the attacking enemy equal to the number of [[Web-Warrior]] cards you control.
- **Flavor**: *"People need protection and help, and we're the only ones who can do it."*
- **Image Asset**: `assets/card-art/bundles/cards/27012.png` (1171×1619 px, 350.7 KB)

### [27013] Bait and Switch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: The villain attacks you. Remove 4 threat from the main scheme.
- **Flavor**: *"You didn't really think I'd let you get away with that, did you?" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/27013.png` (760×1099 px, 284.5 KB)

### [27014] Jump Flip
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you would take any amount of damage, prevent 2 of that damage. If you paid for this card using a [energy] resource, remove 2 threat from the main scheme.
- **Flavor**: *"Up high! Down low! Aww, too slow."-Ghost-Spider*
- **Image Asset**: `assets/card-art/bundles/cards/27014.png` (768×1101 px, 278.9 KB)

### [27015] Return the Favor
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Discard cards from the top of the encounter deck until you discard a treachery. Reveal that treachery → deal 5 damage to the villain.
- **Image Asset**: `assets/card-art/bundles/cards/27015.png` (772×1085 px, 281.2 KB)

### [27016] What Doesn't Kill Me
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Rules Text**:
  > Requirement ([physical]) *(While paying for this card, spend the listed resources.)*
  > **Hero Action**: Heal 2 damage from your hero → ready your hero.
- **Flavor**: *"When I get outta here, you're gonna get it!"*
- **Image Asset**: `assets/card-art/bundles/cards/27016.png` (792×1079 px, 280.2 KB)


### Set: Basic

### [27017] Spider-Man — *Hobie Brown*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > Play only if you control a [[Web-Warrior]] card.
  > **Interrupt**: When Spider-Man leaves play, discard the top 3 cards of the encounter deck. Deal damage to the villain equal to the number of boost icons *([boost])* discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/27017.png` (788×1077 px, 273.3 KB)

### [27018] Across the Spider-Verse
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Action**: Exhaust a [[Web-Warrior]] card you control → search your discard pile for a [[Web-Warrior]] ally and put it into play, then choose a player. That player may spend 3 resources of any type to repeat this ability.
- **Image Asset**: `assets/card-art/bundles/cards/27018.png` (772×1091 px, 270.4 KB)

### [27019] Young Love
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Rules Text**:
  > Team-Up (Gwen Stacy and Miles Morales). Max 1 per deck.
  > **Alter-Ego Action**: Heal 3 damage each from Gwen Stacy and Miles Morales.
- **Image Asset**: `assets/card-art/bundles/cards/27019.png` (800×1081 px, 234.2 KB)

### [27020] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/27020.png` (808×1099 px, 253.2 KB)

### [27021] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/27021.png` (800×1089 px, 262.8 KB)

### [27022] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/27022.png` (780×1079 px, 263.9 KB)

### [27023] Web of Life and Destiny
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Location. Web-Warrior.*
- **Rules Text**:
  > Ignore this card's resource cost if your identity has the [[Web-Warrior]] trait.
  > **Response**: After a [[Web-Warrior]] ally leaves play, choose a player → that player draws 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/27023.png` (804×1107 px, 271.3 KB)

### [27024] Plan B
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Hero Action**: Exhaust Plan B and discard 1 random card from your hand → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/27024.png` (798×1105 px, 264.7 KB)

### [27046] Agent 13 — *Sharon Carter*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 46
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > [star] **Response**: After Agent 13 attacks or thwarts, choose a [[S.H.I.E.L.D.]] support → ready that support.
- **Flavor**: *"I bear the scars of the past all over me. But there's more to me than that. I'm better now. Stronger. Wiser."*
- **Image Asset**: `assets/card-art/bundles/cards/27046.png` (724×1045 px, 171.1 KB)

### [27047] Dum Dum Dugan
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 47
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 3 (Consequential: 3), **ATK**: 3 (Consequential: 2), **HP**: 5, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > **Interrupt**: When you use one of Dum Dum Dugan's basic powers, exhaust up to 3 [[S.H.I.E.L.D.]] cards you control. For each card exhausted this way, Dum Dum Dugan gets +1 to that power for this use.
- **Image Asset**: `assets/card-art/bundles/cards/27047.png` (724×1046 px, 186.9 KB)

### [27048] Ghost-Spider — *Gwen Stacy*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 48
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > Play only if you control a [[Web-Warrior]] card.
  > **Interrupt**: When Ghost-Spider leaves play, search your deck for an identity-specific event and add it to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/27048.png` (726×1035 px, 274.1 KB)

### [27049] Spider-Man — *Peter Parker*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 49
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Web-Warrior.*
- **Rules Text**:
  > Requirement ([energy] [mental] [physical]). *(While paying for this card, spend the listed resources.)*
  > **Response**: After Spider-Man attacks or thwarts, choose another [[Web-Warrior]] character → ready that character.
- **Flavor**: *"See, Miles, that's how you do it."*
- **Image Asset**: `assets/card-art/bundles/cards/27049.png` (727×1043 px, 190.0 KB)

### [27050] Young Love
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Rules Text**:
  > Team-Up (Gwen Stacy and Miles Morales). Max 1 per deck.
  > **Alter-Ego Action**: Heal 3 damage each from Gwen Stacy and Miles Morales.

### [27051] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [27052] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [27053] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 53
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [27054] Government Liaison
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 54
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Persona. S.H.I.E.L.D.*
- **Rules Text**:
  > **Hero Action**: Exhaust Government Liaison → play a [[S.H.I.E.L.D.]] card from your hand, reducing its resource cost by 1.
- **Flavor**: *"I'll have my people contact your people."*
- **Image Asset**: `assets/card-art/bundles/cards/27054.png` (725×1043 px, 159.6 KB)

### [27055] Sky-Destroyer
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 55
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D. Vehicle.*
- **Rules Text**:
  > **Response**: After you play a [[S.H.I.E.L.D.]] card, exhaust Sky-Destroyer → deal 2 damage to an enemy.
- **Flavor**: *"It's not often we deploy a Sky-Destroyer. But when we do, that's how you know the situation is about to get serious." —Nick Fury*
- **Image Asset**: `assets/card-art/bundles/cards/27055.png` (725×1047 px, 175.5 KB)

### [27190] Venom — *Eddie Brock*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 190
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 6, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Symbiote.*
- **Rules Text**:
  > **Response**: After you reveal an encounter card, deal 1 damage to Venom → deal damage to an enemy equal to the number of icons *([star] and [boost])* in that card's boost area.
- **Image Asset**: `assets/card-art/bundles/cards/27190.png` (726×1044 px, 174.8 KB)

### [27191] Symbiote Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 191
- **Stats**: **Cost**: 4, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Symbiote.*
- **Rules Text**:
  > Max 1 per deck.
  > Your identity gets +1 to each of its basic powers, +1 hand size, and +10 hit points.
- **Image Asset**: `assets/card-art/bundles/cards/27191.png` (725×1043 px, 171.4 KB)


### Set: Ghost-Spider Nemesis

### [27026] Regenerative Research
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider Nemesis (1/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ghost-Spider Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When the villain phase begins, heal 1 damage from each enemy.
- **Flavor**: *Peter Parker's research into the healing properties of lizard DNA has backfired, turning him and all those who come in contact with his serum into reptilian monstrosities!*
- **Image Asset**: `assets/card-art/bundles/cards/27026.png` (1148×795 px, 243.3 KB)

### [27027] The Lizard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ghost-Spider Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Creature.*
- **Rules Text**:
  > **Forced Interrupt**: When the villain phase begins, heal 1 damage from The Lizard.
  > *(Ghost-Spider's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/27027.png` (725×1044 px, 166.2 KB)

### [27028] Experimental Injection
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Ghost-Spider Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the minion with the most remaining hit points. If you cannot, this card gains surge.
  > Attached minion gains the [[Creature]] trait and gets +4 hit points.
- **Flavor**: *"RAAARRRRRRR!!!"*
- **Image Asset**: `assets/card-art/bundles/cards/27028.png` (723×1044 px, 157.1 KB)

### [27029] In Cold Blood
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Ghost-Spider Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ghost-Spider Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The Lizard attacks you. You cannot play events until after that attack resolves. If no attack was made this way, this card gains surge.
- **Flavor**: *"Fresh meat..." —The Lizard*
- **Image Asset**: `assets/card-art/bundles/cards/27029.png` (724×1044 px, 159.7 KB)


### Set: Spider-Man - Miles Morales

### [27030a] Spider-Man
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 9, **Hand Size**: 5
- **Traits**: *Champion. Web-Warrior.*
- **Rules Text**:
  > *Venom Blast* - **Special**: Deal 2 damage to an enemy. Stun that enemy.
  > *Spider Camouflage* - **Special**: Give Spider-Man a tough status card. Confuse an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/27030a.png` (300×418 px, 233.5 KB)

### [27030b] Miles Morales
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 9, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > **Response**: After you change to this form, shuffle 1 Spider-Man card from your discard pile into your deck.
- **Flavor**: *"Once you've leaped from skyscrapers and fought off bad guys, everything else is a chore."*
- **Image Asset**: `assets/card-art/bundles/cards/27030b.png` (300×418 px, 205.9 KB)

### [27031] Arachnobatics
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (1–2/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to an enemy. If that enemy has a stun status card, deal 3 additional damage to it. If that enemy has a confuse status card, deal 3 additional damage to it.
- **Flavor**: *"I'm not above adding insult into injury." —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/27031.png` (742×1061 px, 274.1 KB)

### [27032] Double Life
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (3–4/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Rules Text**:
  > Max 1 per round.
  > **Action**: Change your form. If you paid for this card using a [physical] resource, ready your identity.
- **Flavor**: *"I didn't ask for this power, this...responsibility. But I won't let it go to waste." —Miles Morales*
- **Image Asset**: `assets/card-art/bundles/cards/27032.png` (720×1036 px, 271.0 KB)

### [27033] Swing In
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (5–6/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 4 threat from a scheme. If you paid for this card using a [mental] resource, resolve Spider-Man's *"Spider Camouflage"* ability.
- **Flavor**: *"I can see that you're not happy to see me... or not see me?" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/27033.png` (720×1038 px, 196.7 KB)

### [27034] Web-Shot
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (7–9/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If you paid for this card using a [energy] resource, resolve Spider-Man's *"Venom Blast"* ability.
- **Flavor**: *"If that doesn't hold you, I know something that will." —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/27034.png` (722×1044 px, 194.4 KB)

### [27035] Ganke Lee
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Action**: Exhaust Ganke Lee → draw 1 card. If you are in hero form, choose and discard 1 card from your hand.
- **Flavor**: *"I'm the man in the chair."*
- **Image Asset**: `assets/card-art/bundles/cards/27035.png` (724×1042 px, 167.8 KB)

### [27036] Jefferson Davis
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Persona. S.H.I.E.L.D.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Jefferson Davis → remove 1 threat from the scheme with the least threat.
- **Flavor**: *"I'm not proud of my past, but I don't regret it either. It brought me where I am today."*
- **Image Asset**: `assets/card-art/bundles/cards/27036.png` (725×1044 px, 165.6 KB)

### [27037] Power Within
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (12/15)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Response**: After your hero uses a basic power, discard Power Within → resolve Spider-Man's *"Venom Blast"* ability.
- **Image Asset**: `assets/card-art/bundles/cards/27037.png` (724×1044 px, 170.8 KB)

### [27038] Defense Mechanism
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (13/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Response**: After your hero uses a basic power, discard Defense Mechanism → resolve Spider-Man's *"Spider Camouflage"* ability.
- **Image Asset**: `assets/card-art/bundles/cards/27038.png` (723×1043 px, 170.8 KB)

### [27039] Web-Shooter
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (14–15/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Uses (3 web counters). *(Enters play with 3 counters. When those are gone, discard this card)*
  > **Hero Resource**: Exhaust Web-Shooter and remove 1 web counter from it → generate a [wild] resource.
- **Image Asset**: `assets/card-art/bundles/cards/27039.png` (724×1043 px, 163.7 KB)

### [27056] Keeping Secrets
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Miles Morales (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man - Miles Morales Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Give to the Miles Morales player.**
  > You may flip to alter-ego form. Choose:
  > • Exhaust Miles Morales → remove Keeping Secrets from the game.
  > • Discard Ganke Lee and Jefferson Davis from play. If neither was discarded this way, this card gains surge. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/27056.png` (725×1031 px, 166.3 KB)


### Set: Justice

### [27040] Monica Chang
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 40
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > **Response**: After Monica Chang enters play, search your deck, hand and discard pile for a copy of Surveillance Team support and put it into play. Place 1 snoop counter on each Surveillance Team you control.
- **Image Asset**: `assets/card-art/bundles/cards/27040.png` (726×1044 px, 182.3 KB)

### [27041] Spider-Woman — *Jessica Drew*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 41
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 2), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Web-Warrior.*
- **Rules Text**:
  > Reduce the cost to play Spider-Woman by 1 for each confused enemy in play.
- **Flavor**: *"You're the A-team? Really? How far down the list do you think they were when they settled on you guys?"*
- **Image Asset**: `assets/card-art/bundles/cards/27041.png` (721×1032 px, 278.0 KB)

### [27042] Homeland Intervention
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 42
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D. Tactic.*
- **Rules Text**:
  > **Action**: Exhaust up to 3 [[S.H.I.E.L.D.]] cards you control and choose a scheme → remove 2 threat from that scheme for each card exhausted this way.
- **Flavor**: *"This is now the jurisdiction of the Strategic Homeland Intervention, Enforcement, and Logistics Division!"*
- **Image Asset**: `assets/card-art/bundles/cards/27042.png` (725×1043 px, 184.1 KB)

### [27043] Global Logistics
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 43
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Tactic.*
- **Rules Text**:
  > **Action**: Exhaust 1 [[S.H.I.E.L.D.]] card you control → look at the top 4 cards of a player deck or the encounter deck. Discard any number of those, and put the others on the top and/or bottom of that deck in any order.
- **Image Asset**: `assets/card-art/bundles/cards/27043.png` (725×1043 px, 167.0 KB)

### [27044] Field Agent
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 44
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Persona. S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 backup counters).
  > **Hero Interrupt**: When a [[S.H.I.E.L.D.]] ally would take any amount of consequential damage, exhaust Field Agent and remove 1 backup counter from it → prevent 1 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/27044.png` (724×1043 px, 169.4 KB)

### [27045] Surveillance Team
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Pack Position: 45
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 snoop counters). *(Enters play with 3 counters. When those are gone, discard this card)*
  > **Action**: Exhaust Surveillance Team and remove 1 snoop counter from it → remove 1 threat from a scheme.


### Set: Spider-Man - Morales Nemesis

### [27057] Tracking Prey
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Morales Nemesis (1/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man - Morales Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: If you are in alter-ego form, place 1 acceleration token here.
- **Flavor**: *Prowler is on the hunt and won't stop until he corners his prey.*
- **Image Asset**: `assets/card-art/bundles/cards/27057.png` (1047×721 px, 177.5 KB)

### [27058] Prowler
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Morales Nemesis (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man - Morales Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Stalwart.
  > **When Revealed**: If you are in alter-ego form, give Prowler a tough status card.
  > *(Spider-Man's nemesis minion)*
- **Flavor**: *"I'll give ya one piece of advice: Don't let me find you."*
- **Image Asset**: `assets/card-art/bundles/cards/27058.png` (719×1037 px, 251.4 KB)

### [27059] Razor Claws
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Morales Nemesis (3/5)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man - Morales Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to the minion with the highest printed hit points. If you cannot, this card gains surge.
  > [star] Attached minion's attacks gain piercing.
- **Flavor**: *Claws designed to shred steel.*
- **Image Asset**: `assets/card-art/bundles/cards/27059.png` (724×1043 px, 181.8 KB)

### [27060] Slice and Dice
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Spider-Man - Morales Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man - Morales Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Prowler attacks the player with the fewest remaining hit points *(even if that player is in alter-ego form)*. If that attack defeats a character or not attack was made this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/27060.png` (725×1043 px, 191.0 KB)


### Set: Sandman

### [27061] Sandman
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (1/18)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > *Sand Blast* — [star] **Forced Interrupt**: When Sandman attacks you, that attack deals indirect damage. If your identity takes any amount of damage from that attack, resolve the "*Surging Sands*" ability on City Streets.
- **Image Asset**: `assets/card-art/bundles/cards/27061.png` (723×1041 px, 201.8 KB)

### [27062] Sandman
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (2/18)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: Resolve the "*Surging Sands*" ability on City Streets.
  > *Sand Blast* — [star] **Forced Interrupt**: When Sandman attacks you, that attack deals indirect damage. If your identity takes any amount of damage from that attack, resolve the "*Surging Sands*" ability on City Streets.
- **Image Asset**: `assets/card-art/bundles/cards/27062.png` (724×1043 px, 199.8 KB)

### [27063] Sandman
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (3/18)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 19 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: Place 1 sand counter on City Streets. Resolve its "*Surging Sands*" ability.
  > *Sand Wave* — [star] **Forced Interrupt**: When Sandman attacks you, that attack gains overkill. If your identity takes any amount of damage from that attack, resolve the "*Surging Sands*" ability on City Streets.
- **Image Asset**: `assets/card-art/bundles/cards/27063.png` (725×1043 px, 200.0 KB)

### [27064] Hapless Pedestrians
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (4/18)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After an acceleration token is placed on this scheme, deal 3 indirect damage to the first player.
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**
  > **Contents**: Sandman (I) and Sandman (II). *(Sandman (II) and Sandman (III) instead for expert mode.)* Sandman, City in Chaos, and Standard encounter sets. One modular encounter set *(Down to Earth)*.
  > **Setup**: Search the encounter deck for the City Streets environment and put it into play. Place 4 sand counters on it.
- **Image Asset**: `assets/card-art/bundles/cards/27064.jpg` (1044×722 px, 163.7 KB)

### [27064a] Hapless Pedestrians
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (4/18)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Sandman (I) and Sandman (II). *(Sandman (II) and Sandman (III) instead for expert mode.)* Sandman, City in Chaos, and Standard encounter sets. One modular encounter set *(Down to Earth)*.
  > **Setup**: Search the encounter deck for the City Streets environment and put it into play. Place 4 sand counters on it.
- **Image Asset**: `assets/card-art/bundles/cards/27064a.png` (1044×722 px, 163.7 KB)

### [27064b] Hapless Pedestrians
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (4/18)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After an acceleration token is placed on this scheme, deal 3 indirect damage to the first player.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/27064b.png` (1043×720 px, 178.9 KB)

### [27065] City Streets
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (5/18)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location.*
- **Rules Text**:
  > *Surging Sands* — **Special**: Place 1 sand counter here. Discard cards from the top of the encounter deck equal to the number of sand counters here.
  > **Hero Action**: Exhaust a character you control → remove sand counters from here equal to that character's ATK. (Limit once per round per player.)
- **Image Asset**: `assets/card-art/bundles/cards/27065.png` (725×1043 px, 203.0 KB)

### [27066] Sand Form
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (6–7/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Sandman.
  > **Forced Interrupt**: When you would deal any amount of damage to Sandman, discard Sand Form instead → resolve the "*Surging Sands*" ability on City Streets.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/27066.png` (697×1024 px, 186.0 KB)

### [27067] Sand Clone
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (8–11/18, Qty: 4)
- **Stats**: **SCH**: 1, **ATK**: -1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > X is equal to the number of sand counters on City Streets.
  > **When Defeated**: Resolve the "*Surging Sands*" ability on City Streets.
- **Flavor**: *"If you wanna get to me, you gotta go through... ME!" —Sandman*
- **Image Asset**: `assets/card-art/bundles/cards/27067.png` (724×1043 px, 186.6 KB)

### [27068] Dirt Trap
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (12–13/18, Qty: 2)
- **Stats**: **Base Threat**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: Resolve the "*Surging Sands*" ability on City Streets. Resolve it again.
- **Flavor**: *A beige billow floods the streets around you. Everywhere you turn, Sandman awaits.*
- **Image Asset**: `assets/card-art/bundles/cards/27068.png` (1048×721 px, 193.5 KB)

### [27069] Tidal Sands
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (14/18)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place X additional threat here, where X is equal to the number of sand counters on City Streets.
- **Image Asset**: `assets/card-art/bundles/cards/27069.png` (1044×720 px, 166.6 KB)

### [27070] Sandslide
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (15/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 2 sand counters on City Streets, then resolve its "*Surging Sands*" ability. If at least 1 Sandman card was discarded this way, you are stunned.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/27070.png` (725×1044 px, 195.2 KB)

### [27071] Sand Storm
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (16/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal X indirect damage among players *(divided as you choose)*, where X is equal to the number of sand counters on City Streets. If there are no sand counters on City Streets, place 3 sand counters on it and shuffle this card into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/27071.png` (725×1044 px, 198.9 KB)

### [27072] Sand Smash
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sandman (17–18/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sandman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Resolve the "*Surging Sands*" ability on City Streets. This card gains surge.
  > **When Revealed (Hero)**: Sandman attacks you with +1 ATK.
- **Flavor**: *"I will bury you!"*
- **Image Asset**: `assets/card-art/bundles/cards/27072.png` (725×1043 px, 198.4 KB)


### Set: Venom

### [27073] Venom
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Traits**: *Symbiote.*
- **Rules Text**:
  > Toughness. (This character enters play with a tough status card.)
  > *Vengeance* — **Forced Response**: After you or an ally you control attacks and damages Venom, place 1 facedown boost card on your identity.
- **Errata (FFG)**:
  > Changed “you attack and damage Venom with a card you control” to “you or an ally you control attacks and damages Venom”. (RRG 1.6)
- **Image Asset**: `assets/card-art/bundles/cards/27073.png` (722×1042 px, 185.0 KB)

### [27074] Venom
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Traits**: *Symbiote.*
- **Rules Text**:
  > Toughness. Steady.
  > **When Revealed**: Search the encounter deck and discard pile for the Tooth and Nail side scheme and put it into play. *(Shuffle.)*
  > *Vengeance* — **Forced Response**: After you or an ally you control attacks and damages Venom, place 1 facedown boost card on your identity.
- **Errata (FFG)**:
  > Changed “you attack and damage Venom with a card you control” to “you or an ally you control attacks and damages Venom”. (RRG 1.6)
- **Image Asset**: `assets/card-art/bundles/cards/27074.png` (721×1043 px, 190.3 KB)

### [27075] Venom
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Traits**: *Symbiote.*
- **Rules Text**:
  > Retaliate 1. Steady. Toughness.
  > **When Revealed**: Place 2 facedown boost cards on each identity.
  > *Retribution* — **Forced Response**: After you or an ally you control attacks and damages Venom, place 1 facedown boost card on your identity (2 facedown boost cards instead if this is the first attack this turn).
- **Errata (FFG)**:
  > Changed “you attack and damage Venom with a card you control” to “you or an ally you control attacks and damages Venom”. (RRG 1.6)
- **Image Asset**: `assets/card-art/bundles/cards/27075.png` (724×1042 px, 194.7 KB)

### [27076a] "Leave Us Alone!"
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (4/14)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Venom (I) and Venom (II). *(Venom (II) and Venom (III) instead for expert mode.)* Venom, Symbiotic Strength, and Standard encounter sets. One modular encounter set *(Down to Earth.)*
  > **Setup**: Put the Bell Tower environment into play, [[QUIET]] side faceup.
- **Image Asset**: `assets/card-art/bundles/cards/27076a.png` (1039×706 px, 160.9 KB)

### [27076b] "Leave Us Alone!"
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (4/14)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When Venom activates against you, move each facedown boost card from your identity to Venom.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/27076b.png` (1045×721 px, 181.9 KB)

### [27077a] Bell Tower
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (5/14)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Quiet.*
- **Rules Text**:
  > If there are at least 3 [per_hero] chime counters here, flip this card.
  > **Interrupt: ** When any amount of damage would be dealt to Venom by an attack, (you may) place that many chime counters here instead.
- **Image Asset**: `assets/card-art/bundles/cards/27077a.png` (718×1029 px, 308.6 KB)

### [27077b] Bell Tower
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (5/14)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Ringing.*
- **Rules Text**:
  > Increase all damage Venom takes by 1.
  > If there are no chime counters here, flip this card.
  > **Forced Interrupt**: When Venom's attack would deal any amount of damage to an identity, remove that many chime counters from here. For each chime counter removed this way, prevent 1 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/27077b.png` (722×1040 px, 172.9 KB)

### [27078] "Now We're Angry!"
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (6–7/14, Qty: 2)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Venom.
  > Uses (2 rage counters).
  > [star] Venom's attacks gain overkill.
  > **Forced Response**: After Venom takes any amount of damage from an attack, remove 1 rage counter from here.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/27078.png` (725×1043 px, 180.1 KB)

### [27079] Guard the Bell Tower
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (8/14)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Treat the Bell Tower's printed text box as if it were blank *(except for [[TRAITS]])*.
  > **When Revealed**: Remove each chime counter from the Bell Tower and flip it to its [[QUIET]] side.
- **Image Asset**: `assets/card-art/bundles/cards/27079.png` (1041×721 px, 164.2 KB)

### [27080] Lashing Out
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (9/14)
- **Stats**: **Base Threat**: 9
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Response**: After Venom takes any amount of damage from an attack, remove an equal amount of threat from here.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, take 2 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/27080.png` (1047×720 px, 163.9 KB)

### [27081] Tooth and Nail
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (10/14)
- **Stats**: **Base Threat**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **Response**: After Venom takes any amount of damage from an attack, remove an equal amount of threat from here.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/27081.png` (1047×721 px, 164.0 KB)

### [27082] Biting Retort
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (11–12/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Venom activates against you. Each boost card turned faceup during that activation gets +1 boost icon [boost].
  >
  > ---
  >
  > [star] **Boost**: Remove 1 chime counter from the Bell tower.
- **Image Asset**: `assets/card-art/bundles/cards/27082.png` (710×1033 px, 157.0 KB)

### [27083] For Whom the Bell Tolls
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom (13–14/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Remove 2 chime counters from the Bell Tower. If the Bell Tower is on its [[quiet]] side, take 1 damage. If it is on its [[ringing]] side, remove 1 threat from the main scheme.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/27083.png` (723×1043 px, 195.0 KB)


### Set: Mysterio

### [27084] Mysterio
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (1/16)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2 [star], **ATK**: 1 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > *Seeds of Fear* — [star] **Forced Response**: After you resolve a boost card during Mysterio's activation, place that card in your discard pile if it has the [[illusion]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/27084.png` (723×1043 px, 182.5 KB)

### [27085] Mysterio
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (2/16)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: In player order, shuffle the top card of the encounter deck into each player's deck.
  > *Creeping Fear* — [star] **Forced Response**: After you resolve a boost card during Mysterio's activation, place that card on the bottom of your deck if it has the [[illusion]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/27085.png` (721×1043 px, 191.0 KB)

### [27086] Mysterio
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (3/16)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: Discard the top 5 cards of each player's deck.
  > *Bound by Fear* — [star] **Forced Response**: After you resolve a boost card during Mysterio's activation, place that card on the top of your deck if it has the [[illusion]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/27086.png` (724×1039 px, 185.1 KB)

### [27087] Maze of Mirrors
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (4/16)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When you would draw or discard an encounter card from your deck, deal it to yourself as a facedown encounter card → draw 1 card.
- **Reverse Side**
  > **Contents**: Mysterio (I) and Mysterio (II). *(Mysterio (II) and Mysterio (III) instead for expert mode.)* Mysterio, Personal Nightmare, and Standard encounter sets. One modular encounter set *(Whispers of Paranoia.)*
  > **Setup**: Put a shifting Apparition minion into play engaged with each player. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/27087.png` (1044×712 px, 255.4 KB)

### [27087a] Maze of Mirrors
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (4/16)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Mysterio (I) and Mysterio (II). *(Mysterio (II) and Mysterio (III) instead for expert mode.)* Mysterio, Personal Nightmare, and Standard encounter sets. One modular encounter set *(Whispers of Paranoia.)*
  > **Setup**: Put a shifting Apparition minion into play engaged with each player. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/27087a.png` (1044×712 px, 255.4 KB)

### [27087b] Maze of Mirrors
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (4/16)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When you would draw or discard an encounter card from your deck, deal it to yourself as a facedown encounter card → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/27087b.png` (1039×711 px, 275.4 KB)

### [27088] Edge of Reality
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (5/16)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 3 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When you would draw or discard an encounter card from your deck, deal it to yourself as a facedown encounter card → draw 1 card.
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: In player order, shuffle the top 2 cards of the encoutner deck into each player's deck.
- **Image Asset**: `assets/card-art/bundles/cards/27088.png` (1040×717 px, 253.5 KB)

### [27088a] Edge of Reality
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (5/16)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: In player order, shuffle the top 2 cards of the encounter deck into each player's deck.
- **Image Asset**: `assets/card-art/bundles/cards/27088a.png` (1040×717 px, 253.5 KB)

### [27088b] Edge of Reality
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (5/16)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 3 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When you would draw or discard an encounter card from your deck, deal it to yourself as a facedown encounter card → draw 1 card.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/27088b.png` (1035×712 px, 285.6 KB)

### [27089] Humongous Hallucination
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (6/16)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > Attach to Mysterio.
  > **Hero Action: ** Spend 1 resource of any type and shuffle the top 2 cards of the encounter deck into your deck → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27089.png` (724×1043 px, 174.1 KB)

### [27090] Masterful Mirage
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (7–8/16, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > Attach to Mysterio.
  > **Forced Interrupt** When you would deal any amount of damage to Mysterio, discard the top 4 cards of your deck instead. Discard this card.
  >
  > ---
  >
  > [star] **Boost**: Give Mysterio 1 additional boost card this activation.
- **Image Asset**: `assets/card-art/bundles/cards/27090.png` (725×1043 px, 174.5 KB)

### [27091] Shifting Apparition
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (9–12/16, Qty: 4)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > Guard. *(While this minion is engaged with you, you cannot attack the villain.)*
  > **When Defeated**: If this minion was defeated with excess damage, the defeating player shuffles the top card of the encounter deck into their deck.
- **Image Asset**: `assets/card-art/bundles/cards/27091.png` (725×1040 px, 176.6 KB)

### [27092] Déjà Vu
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (13–14/16, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. *(While you are resolving this card, other players cannot help you.)*
  > **When Revealed**: Choose to either take 1 damage or place 1 threat on the main scheme. Shuffle Déjà Vu into any player's deck.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/27092.png` (724×1043 px, 172.9 KB)

### [27093] Fearmonger
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Mysterio (15–16/16, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mysterio Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Discard your hand. Draw up to your hand size.
  >
  > ---
  >
  > [star] **Boost**: Choose to either spend [mental][mental] resources or deal this card to yourself as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/27093.png` (725×1033 px, 283.9 KB)


### Set: The Sinister Six

### [27094] Doctor Octopus
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (1/25)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Activation Order 1*
- **Rules Text**:
  > [star] **Forced Response**: After Doctor Octopus attacks and damages you, place 1 threat on each scheme. Move the active counter to the next villain in the activation order.
  > **When Defeated**: Remove 4 threat from a side scheme (7 threat instead if no other villain is in play). Set this villain aside.
- **Image Asset**: `assets/card-art/bundles/cards/27094.png` (723×1042 px, 201.3 KB)

### [27095] Electro
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (2/25)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Activation Order 2*
- **Rules Text**:
  > [star] **Forced Response**: After Electro attacks and damages you, discard the top 7 cards of your deck. Move the active counter to the next villain in the activation order.
  > **When Defeated**: Remove 4 threat from a side scheme (7 threat instead if no other villain is in play). Set this villain aside.
- **Image Asset**: `assets/card-art/bundles/cards/27095.png` (722×1042 px, 205.4 KB)

### [27096] Hobgoblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (3/25)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 9
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Activation Order 3*
- **Rules Text**:
  > [star] **Forced Response**: After Hobgoblin attacks and damages you, take 2 indirect damage. Move the active counter to the next villain in the activation order.
  > **When Defeated**: Remove 4 threat from a side scheme (7 threat instead if no other villain is in play). Set this villain aside.
- **Image Asset**: `assets/card-art/bundles/cards/27096.png` (723×1041 px, 198.8 KB)

### [27097] Kraven the Hunter
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (4/25)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 9
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Activation Order 4*
- **Rules Text**:
  > [star] **Forced Response**: After Kraven the Hunter attacks and damages you, choose and discard 1 support or upgrade you control. Move the active counter to the next villain in the activation order.
  > **When Defeated**: Remove 4 threat from a side scheme (7 threat instead if no other villain is in play). Set this villain aside.
- **Image Asset**: `assets/card-art/bundles/cards/27097.png` (710×1030 px, 428.2 KB)

### [27098] Scorpion
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (5/25)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 0, **ATK**: 3 [star], **HP**: 10
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Activation Order 5*
- **Rules Text**:
  > [star] **Forced Response**: After Scorpion attacks and damages you, stun a character you control. Move the active counter to the next villain in the activation order.
  > **When Defeated**: Remove 4 threat from a side scheme (7 threat instead if no other villain is in play). Set this villain aside.
- **Image Asset**: `assets/card-art/bundles/cards/27098.png` (710×1030 px, 396.0 KB)

### [27099] Vulture
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (6/25)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Activation Order 6*
- **Rules Text**:
  > [star] **Forced Response**: After Vulture attacks and damages you, choose and discard 1 card from your hand. Move the active counter to the next villain in the activation order.
  > **When Defeated**: Remove 4 threat from a side scheme (7 threat instead if no other villain is in play). Set this villain aside.
- **Image Asset**: `assets/card-art/bundles/cards/27099.png` (710×1030 px, 400.0 KB)

### [27100] Sinister Synchonization
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (7/25)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Ambush! — **Special**: Choose a set-aside villain at random, put that villain into play, and place the active counter on it. (In expert mode, place 2 threat on Light at the End).
  > **Forced Interrupt**: When a villain would activate, if no villain is in play, resolve this card's "*Ambush!*" ability. Continue that activation.
- **Reverse Side**
  > **Contents**: Doctor Octopus, Electro, Hobgoblin, Kraven the Hunter, Scorpion, and Vulture. The Sinister Six, Guerrila tactics, and Standard encounter sets.
  > **Setup**: Choose X villains at random, where X is 1 more than the number of players. Put those villains into play, place the active counter on the villain with the lowest activation order value, and set the other villains aside. Put the Light at the End side scheme into play, [[trap!]] side faceup.
- **Image Asset**: `assets/card-art/bundles/cards/27100.jpg` (1044×720 px, 189.2 KB)

### [27100a] Sinister Synchronization
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (7/25)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Doctor Octopus, Electro, Hobgoblin, Kraven the Hunter, Scorpion, and Vulture. The Sinister Six, Guerrilla Tactics, and Standard encounter sets.
  > **Setup**: Choose X villains at random, where X is 1 more than the number of players. Put those villains into play, place the active counter on the villain with the lowest activation order value, and set the other villains aside. Put the Light at the End side scheme into play, [[trap!]] side faceup.
- **Image Asset**: `assets/card-art/bundles/cards/27100a.png` (1044×720 px, 189.2 KB)

### [27100b] Sinister Synchronization
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (7/25)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Ambush! — **Special**: Choose a set-aside villain at random, put that villain into play, and place the active counter on it. (In expert mode, place 2 threat on Light at the End).
  > **Forced Interrupt**: When a villain would activate, if no villain is in play, resolve this card's "*Ambush!*" ability. Continue that activation.
- **Image Asset**: `assets/card-art/bundles/cards/27100b.png` (1044×719 px, 197.8 KB)

### [27101a] Sinister Beatdown
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (8/25)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose a set-aside villain at random, put that villain into play, and place the active counter on it *(even if another villain has the counter)*. If no villain was put into play this way or this is expert mode, deal the first player 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/27101a.png` (1047×720 px, 176.4 KB)

### [27101b] Sinister Beatdown
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (8/25)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 3 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > *Ambush!* — **Special**: Choose a set-aside villain at random, put that villain into play, and place the active counter on it. (In expert mode, place 2 threat on Light at the End).
  > **Forced Interrupt** When a villain would activate, if no villain is in play, resolve this card's "*Ambush!*" ability. Continue that activation.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/27101b.png` (1044×718 px, 202.6 KB)

### [27102a] Light at the End
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (9/25)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 10
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Trap!*
- **Rules Text**:
  > Permanent. Hinder 10 [per_hero].
  > The players cannot win unless they escape.
  > **Forced Interrupt**: When the last threat is removed from this scheme, resolve the "*Ambush!*" ability on the main scheme. Flip this card. *(The players can escape on the other side.)*

### [27102b] Light at the End
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (9/25)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Chase!*
- **Rules Text**:
  > Permanent. Hinder 10 [per_hero].
  > The players cannot win unless they escape.
  > **Forced Interrupt**: When the last threat is removed from this scheme, the players escape and win the game.

### [27103] Heightened Morale
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (10–11/25, Qty: 2)
- **Stats**: **ATK**: -1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the villain with the highest activation order value. If you cannot, resolve the "*Ambush!*" ability on the main scheme, then attach this card to the active villain.
  > X is equal to the number of villains in play.
- **Image Asset**: `assets/card-art/bundles/cards/27103.png` (723×1043 px, 192.4 KB)

### [27104] Taunting Presence
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (12–13/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the villain with the most remaining hit points. If you cannot, resolve the Ambush! Ability on the main scheme, then attach this card to the active villain.
- **Image Asset**: `assets/card-art/bundles/cards/27104.png` (724×1042 px, 189.5 KB)

### [27105] Team Leader
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (14/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Traits**: *Title.*
- **Rules Text**:
  > Attach to the villain with the lowest activation order value. If you cannot, resolve the Ambush! Ability on the main scheme, then attach this card to the active villain.
- **Image Asset**: `assets/card-art/bundles/cards/27105.png` (725×1043 px, 186.4 KB)

### [27106] Take One for the Team
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (15/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the villain with the highest ATK. If you cannot, resolve the Ambush! Ability on the main scheme, then attach this card to the active villain.
  > You cannot attack villains who do not have an attached copy of Take One for the Team.
- **Image Asset**: `assets/card-art/bundles/cards/27106.png` (725×1043 px, 187.9 KB)

### [27107] Brute Force Barricade
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (16/25)
- **Stats**: **Base Threat**: 9
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Victory 1. *(When defeated, add this card to the victory display.)*
  > Threat cannot be removed from other side schemes.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/27107.png` (1046×720 px, 183.5 KB)

### [27108] Frequent Flyers
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (17/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, this card gains incite 1 and cannot be canceled.
  > **When Revealed**: Put the set-aside Hobgoblin and Vulture into play. If Hobgoblin is already in play, take 2 indirect damage. If Vulture is already in play, discard 1 card at random from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/27108.png` (725×1042 px, 209.3 KB)

### [27109] High Fashion
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (18/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, this card gains incite 1 and cannot be canceled.
  > **When Revealed**: Put the set-aside Electro and Kraven the Hunter into play. If Electro is already in play, discard the highest-cost card you control. If Kraven the Hunter is already in play, discard the lowest-cost card you control.
- **Image Asset**: `assets/card-art/bundles/cards/27109.png` (725×1042 px, 196.8 KB)

### [27110] Robotic Enhancements
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (19/25)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, this card gains incite 1 and cannot be canceled.
  > **When Revealed**: Put the set-aside Doctor Octopus and Scorpion into play. If Doctor Octopus is already in play, confuse a character you control. If Scorpion is already in play, stun a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/27110.png` (721×1043 px, 213.7 KB)

### [27111] Partnership of Pain
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (20–22/25, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego): ** The Villain with the lowest activation order value schemes with +X SCH where X is equal to the total SCH of all other villains in play.
  > ** When Revealed (Hero): ** The villain with the highest activation order value attacks you with +X ATK, where X is equal to the total ATK of all other villains in play.
- **Image Asset**: `assets/card-art/bundles/cards/27111.png` (723×1040 px, 202.4 KB)

### [27112] Surprise!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: The Sinister Six (23–25/25, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Sinister Six Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, this card gains surge and cannot be canceled.
  > **When Revealed**:Resolve the Ambush! Ability on the main scheme. If no villain was put into play this way, place 3 threat on Light at the End.
- **Image Asset**: `assets/card-art/bundles/cards/27112.png` (725×1041 px, 185.6 KB)


### Set: Venom Goblin

### [27113] Venom Goblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (1/19)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin. Symbiote.*
- **Rules Text**:
  > Steady.
  > *Infest the City* — [star] **Forced Response**: After Venom Goblin activates against you, move the glider counter to the main scheme with the least threat. Choose to either place 2 threat on that scheme or resolve its "**Special**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/27113.png` (723×1042 px, 196.3 KB)

### [27114] Venom Goblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (2/19)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 3 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin. Symbiote.*
- **Rules Text**:
  > Steady. Toughness.
  > **When Revealed**: Deal 2 facedown encounter cards to each player.
  > *Claim the Throne* — [star] **Forced Response**: After Venom Goblin activates against you, move the glider counter to the main scheme with the least threat. Resolve its "**Special**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/27114.png` (724×1042 px, 194.8 KB)

### [27115] Venom Goblin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (3/19)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3 [star], **ATK**: 3 [star], **HP**: 21 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Goblin. Symbiote.*
- **Rules Text**:
  > Retaliate 1. Stalwart. Toughness.
  > **When Revealed**: Deal 3 facedown encounter cards to each player.
  > *Reign of Terror* — [star] **Forced Response**: After Venom Goblin activates against you, move the glider counter to the main scheme with the least threat. Place 1 threat on that scheme and resolve its "**Special**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/27115.png` (723×1044 px, 199.3 KB)

### [27116a] Skies Over New York
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (4/19)
- **Properties**: Stage A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Venom Goblin (I) and Venom Goblin (II) *(Venom Goblin (II) and Venom Goblin (III) for expert mode.)* Venom Goblin, Symbiotic Strength, and Standard encounter sets. One modular encounter set *(Goblin Gear)*.
  > **Setup**: Put the Lower Manhattan, Midtown Manhattan, and Upper Manhattan main schemes into play. Place the glider counter on Midtown Manhattan. Flip this card and set it aside.
- **Image Asset**: `assets/card-art/bundles/cards/27116a.png` (1022×713 px, 178.2 KB)

### [27116b] Skies Over New York
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (4/19)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Player cards that affect the main scheme can apply to any main scheme.
  > encounter cards that affect the main scheme only apply to the scheme with the glider counter (including the placing of acceleration tokens).
  > Each main scheme accumulates threat each round according to its acceleration value and any acceleration tokens on that scheme
- **Image Asset**: `assets/card-art/bundles/cards/27116b.png` (717×1039 px, 288.7 KB)

### [27117a] Lower Manhattan
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (5/19)
- **Properties**: Stage B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 11 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Special**: Place 1 threat on each scheme. If a [[symbiote]] environment is in play, place 1 additional threat on this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/27117a.png` (1036×719 px, 168.6 KB)

### [27117b] Lower Manhattan
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (5/19)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Symbiote.*
- **Rules Text**:
  > **When Revealed**: Move the glider counter and each acceleration token from here to the main scheme with the least threat.
  > **If there are at least 2 [[symbiote]] environments in play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/27117b.png` (721×1041 px, 195.2 KB)

### [27118a] Midtown Manhattan
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (6/19)
- **Properties**: Stage C
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Special**: Take 2 indirect damage. If a [[symbiote]] environment is in play, take 1 additional indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/27118a.png` (1046×719 px, 178.8 KB)

### [27118b] Midtown Manhattan
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (6/19)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Symbiote.*
- **Rules Text**:
  > **When Revealed**: Move the glider counter and each acceleration token from here to the main scheme with the least threat.
  > **If there are at least 2 [[symbiote]] environments in play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/27118b.png` (723×1041 px, 197.4 KB)

### [27119a] Upper Manhattan
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (7/19)
- **Properties**: Stage D
- **Stats**: **Base Threat**: 0, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Special**: Discard 1 card from your hand. If a [[symbiote]] environment is in play, discard the top 4 cards of your deck.
- **Image Asset**: `assets/card-art/bundles/cards/27119a.png` (1046×718 px, 169.8 KB)

### [27119b] Upper Manhattan
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (7/19)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Symbiote.*
- **Rules Text**:
  > **When Revealed**: Move the glider counter and each acceleration token from here to the main scheme with the least threat.
  > **If there are at least 2 [[symbiote]] environments in play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/27119b.png` (723×1039 px, 193.3 KB)

### [27120] We Are One
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (8/19)
- **Stats**: **SCH**: 3, **ATK**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to Venom Goblin.
  > **Hero Action**: Spend [energy][mental][physical] printed resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27120.png` (717×1040 px, 271.8 KB)

### [27121] Symbiotic Berserker
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (9–10/19, Qty: 2)
- **Stats**: **SCH**: 0, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Symbiote.*
- **Rules Text**:
  > [star] While a [[symbiote]] environment is in play, Symbiotic Berserker gains quickstrike.
  >
  > ---
  >
  > [star] **Boost**: Move the glider counter to the main scheme with the most threat. Place 1 threat on that scheme.
- **Image Asset**: `assets/card-art/bundles/cards/27121.png` (723×1043 px, 197.2 KB)

### [27122] Symbiotic Monstrosity
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (11/19)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Symbiote.*
- **Rules Text**:
  > Retaliate 1. Steady. Toughness.
  > [star] While a [[symbiote]] environment is in play, Symbiotic Monstrosity gets +3 hit points.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, this attack deals indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/27122.png` (723×1042 px, 197.0 KB)

### [27123] Symbiotic Thrall
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (12–15/19, Qty: 4)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Symbiote.*
- **Rules Text**:
  > Guard.
  > While a [[symbiote]] environment is in play, Symbiotic Thrall gains patrol.
  >
  > ---
  >
  > [star] **Boost**: Place 1 threat on each main scheme without the glider counter.
- **Image Asset**: `assets/card-art/bundles/cards/27123.png` (724×1042 px, 177.6 KB)

### [27124] Festering Mass
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (16/19)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > While there are no other [[symbiote]] environments in play, this card is considered a [[symbiote]] environment.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/27124.png` (1043×720 px, 173.2 KB)

### [27125] Joy Ride
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (17/19)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 2 [per_hero].
  > **When Revealed**: Move the glider token to the main scheme with the most threat. Resolve that scheme's "**Special**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/27125.png` (1047×720 px, 173.2 KB)

### [27126] Spreading Panic
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Venom Goblin (18–19/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Venom Goblin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Resolve the "**Special**" ability of the scheme with the glider counter.
  >
  > ---
  >
  > [star] **Boost**: Resolve the "**Special**" ability of the scheme with the glider counter.
- **Image Asset**: `assets/card-art/bundles/cards/27126.png` (721×1042 px, 189.0 KB)


### Set: City in Chaos

### [27127] Panic in the Streets
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: City in Chaos (1/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: City in Chaos Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Treat the printed text box of each [[location]] support and each [[persona]] support as if it were blank *(except for [[traits]])*.
- **Image Asset**: `assets/card-art/bundles/cards/27127.png` (1033×701 px, 158.5 KB)

### [27128] Rhino
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: City in Chaos (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 3 [star], **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: City in Chaos Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Elite.*
- **Rules Text**:
  > Steady. (Steady characters require 2 status cards of the same type to be stunned or confused.)
  > [star] Rhino's attack gain overkill and piercing
- **Image Asset**: `assets/card-art/bundles/cards/27128.png` (724×1031 px, 265.1 KB)

### [27129] Calling in Favors
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: City in Chaos (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: City in Chaos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Rhino schemes with +2 SCH. If Rhino is not in play, search the encounter deck and discard pile for the Rhino minion and put him into play engaged with you. (shuffle.)
- **Image Asset**: `assets/card-art/bundles/cards/27129.png` (725×1043 px, 185.7 KB)

### [27130] Now or Never
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: City in Chaos (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: City in Chaos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. (While you are resolving this card, other players cannot help you.)
  > ** When Revealed: ** Choose:
  > Place 1 acceleration token on the main scheme.
  > Exhaust a character you control and spend 1 resource of any type
- **Image Asset**: `assets/card-art/bundles/cards/27130.png` (725×1043 px, 198.1 KB)


### Set: Down to Earth

### [27131] Common Criminal
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Down to Earth (1–3/7, Qty: 3)
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Down to Earth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Surge.
  > ** Alter-ego Action: ** Spend a [physical] resource → deal 3 damage to Common Criminal. If this minion is defeated this way, choose to either draw 1 card or remove 3 threat from a side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/27131.png` (720×1043 px, 187.0 KB)

### [27132] Friends and Family
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Down to Earth (4/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Down to Earth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > While in hero form, increase the resource cost of each event you play by 1.
  > ** Alter-Ego Action: ** Discard 1 identity specific card from your hand → discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/27132.png` (720×1036 px, 290.5 KB)

### [27133] Volunteer Work
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Down to Earth (5/7)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Down to Earth Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > You cannot thwart this scheme.
  > **Alter-Ego Action**: Spend 2 resources of any type → remove threat from this scheme equal to your alter-ego's REC. If your identity has the [[civilian]] trait, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/27133.png` (1044×722 px, 168.3 KB)

### [27134] "Threat or Menace?"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Down to Earth (6/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Down to Earth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You may change form. If you are in hero form, place 2 threat on the main scheme. If you are alter-ego form, you cannot change form during your next turn.
- **Image Asset**: `assets/card-art/bundles/cards/27134.png` (725×1043 px, 190.3 KB)

### [27135] Loose Ends
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Down to Earth (7/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Down to Earth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Search the encounter deck, discard pile, set-aside area, and removed-from-game area for a copy of your obligation, then reveal it. During that reveal, if you change to alter-ego form, discard 1 random card from your hand. If your obligation was not revealed this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/27135.png` (725×1041 px, 194.4 KB)


### Set: Goblin Gear

### [27136] Advanced Glider
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Goblin Gear (1/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Goblin Gear Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Attach to the villain.
  > **Forced Response**: After attached villain activates against you, it activates against you again. (Limit once per round per player).
  > **Hero Action**: Discard any number of [[attack]] cards from your hand with a combined resource cost of 3 or more → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27136.png` (724×1044 px, 194.8 KB)

### [27137] Concussive Bombs
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Goblin Gear (2/6)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Goblin Gear Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > Uses (2 bomb counters.)
  > [star] **Forced Response: ** After the villain attacks you, remove 1 bomb counter from here → exhaust 1 upgrade and 1 support you control.
- **Image Asset**: `assets/card-art/bundles/cards/27137.png` (725×1042 px, 186.0 KB)

### [27138] Incendiary Bombs
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Goblin Gear (3/6)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Goblin Gear Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > Uses (2 bomb counters.)
  > [star] **Forced Response: ** After the villain attacks you, remove 1 bomb counter from here → take 2 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/27138.png` (725×1044 px, 179.0 KB)

### [27139] Smoke Bombs
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Goblin Gear (4/6)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Goblin Gear Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > Uses (2 bomb counters.)
  > [star] **Forced Response: ** After the villain attacks you, remove 1 bomb counter from here → discard 1 event from your hand with the lowest cost.
- **Image Asset**: `assets/card-art/bundles/cards/27139.png` (725×1043 px, 194.9 KB)

### [27140] Limitless Supply
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Goblin Gear (5/6)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Goblin Gear Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Each [[Tech]] attachment gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/27140.png` (1047×719 px, 172.7 KB)

### [27141] Remote Navigation
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Goblin Gear (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Goblin Gear Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Advanced Glider is in play, the villain activates against you. If it is not in play, search the encounter deck and discard pile for Advance Glider and reveal it.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 2 additional boost cards for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/27141.png` (724×1042 px, 182.5 KB)


### Set: Guerrilla Tactics

### [27142] Life-Size Decoy
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Guerrilla Tactics (1–2/7, Qty: 2)
- **Stats**: **SCH**: 0, **ATK**: 0, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Guerrilla Tactics Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, Life-size Decoy gains toughness.
  > The engaged player cannot thwart side schemes.
  >
  > ---
  >
  > [star] **Boost**: Put this minion into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/27142.png` (726×1043 px, 181.1 KB)

### [27143] Coordinated Effort
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Guerrilla Tactics (3/7)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Guerrilla Tactics Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each enemy gains 1 acceleration icon ([acceleration]).
  >
  > ---
  >
  > [star] **Boost**: Place 1 threat on each scheme. (In expert mode, place 1 additional threat on the main scheme.)
- **Image Asset**: `assets/card-art/bundles/cards/27143.png` (1047×720 px, 168.8 KB)

### [27144] Hidden in Shadow
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Guerrilla Tactics (4/7)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Guerrilla Tactics Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each enemy gains 1 hazard icon ([hazard]).
  >
  > ---
  >
  > [star] **Boost**: Deal 1 indirect damage to each player. (In expert mode, deal 1 addition indirect damage to the first player.)
- **Image Asset**: `assets/card-art/bundles/cards/27144.png` (1039×715 px, 231.0 KB)

### [27145] Teamwork Makes the Dream Work
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Guerrilla Tactics (5/7)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Guerrilla Tactics Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each enemy gets +1 SCH and +1 ATK.
  >
  > ---
  >
  > [star] **Boost**: In expert mode, this card gets +2 boost icons [boost][boost] for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/27145.png` (1047×721 px, 171.9 KB)

### [27146] From Every Direction
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Guerrilla Tactics (6–7/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Guerrilla Tactics Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, this card gains surge.
  > **When Revealed**: Place 1 threat on the main scheme for each enemy in play.
- **Image Asset**: `assets/card-art/bundles/cards/27146.png` (725×1044 px, 152.9 KB)


### Set: Osborn Tech

### [27147] Arm Cannon
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Osborn Tech (1/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Osborn Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Surge.
  > Attach to the villain.
  > [star] Attached villain's attacks gain overkill and piercing.
  > **Hero Action**: Discard the highest-cost upgrade you control → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27147.png` (725×1044 px, 183.7 KB)

### [27148] Ionic Boots
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Osborn Tech (2/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Osborn Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Surge.
  > Attach to the villain.
  > [star] **Forced Response**: After attached villain attacks and damages your identity, place 2 threat on the main scheme.
  > **Hero Action**: Spend [energy] [mental][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27148.png` (725×1047 px, 201.0 KB)

### [27149] Kinetic Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Osborn Tech (3/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Osborn Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Surge.
  > Attach to the villain.
  > Attached villain gains retaliate 1.
  > **Hero Action**: Take 3 indirect damage → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27149.png` (725×1042 px, 162.8 KB)

### [27150] Neocarbon Scales
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Osborn Tech (4/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Osborn Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Surge.
  > Attach to the villain.
  > Reduce the amount of damage attached villain takes from each attack by 1.
  > **Hero Action**: Give the villain a tough status card and 1 facedown boost card → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27150.png` (725×1043 px, 185.5 KB)

### [27151] Spiked Gauntlet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Osborn Tech (5/6)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Osborn Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Surge.
  > Attach to the villain.
  > **Hero Action**: The villain attacks you. After that attack ends, if your identity took no damage from that attack, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27151.png` (724×1042 px, 183.8 KB)

### [27152] Tracking Display
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Osborn Tech (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Osborn Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Surge .
  > Attach to the villain.
  > [star] Each character cannot defend against attached villain's attacks.
  > **Hero Action**: Exhaust a character you control and discard 1 random card from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27152.png` (724×1042 px, 195.6 KB)


### Set: Personal Nightmare

### [27153] Induced Panic
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Personal Nightmare (1/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Personal Nightmare Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > Attach to your identity.
  > You cannot resolve triggered abilities in your hero's printed text box. (Triggered abilities are ones with ** bold ** timing triggers.) /n ** Alter-Ego Action: ** Discard 1 identity-specific card at random from your hand →discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27153.png` (723×1041 px, 186.3 KB)

### [27154] Evil Doppelgänger
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Personal Nightmare (2–3/7, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Personal Nightmare Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > Evil Doppelgänger gets +X SCH and +X ATK, where X is equal to the number of identity-specific cards in the engaged player's hand.
  >
  > ---
  >
  > [star] **Boost**: Draw 3 cards. Discard 3 random cards from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/27154.png` (724×1044 px, 189.5 KB)

### [27155] Fool's Paradise
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Personal Nightmare (4/7)
- **Stats**: **Base Threat**: 6 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Personal Nightmare Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme), Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase), Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Victory  1. *(When defeated, add this card to the victory display.)*
  > Each identity gets +2 hand size.
- **Image Asset**: `assets/card-art/bundles/cards/27155.png` (1047×721 px, 179.6 KB)

### [27156] Weakness from Within
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Personal Nightmare (5/7)
- **Stats**: **Base Threat**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Personal Nightmare Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place 1 additional threat here for each card in your hand.
- **Image Asset**: `assets/card-art/bundles/cards/27156.png` (1047×720 px, 192.4 KB)

### [27157] Deepest Fears
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Personal Nightmare (6–7/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Personal Nightmare Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. (While you are resolving this card, other players cannot help you.)
  > **When Revealed**: Discard cards from the top of your deck equal to the number of cards in your hand. If at least 1 identity-specific card was discarded this way, place 1 threat on the main scheme. If not identity-specific card was discarded this way, take 1 damage.
- **Image Asset**: `assets/card-art/bundles/cards/27157.png` (724×1044 px, 196.3 KB)


### Set: Sinister Assault

### [27158] Doctor Octopus
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sinister Assault (1/6)
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sinister Assault Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Genius.*
- **Rules Text**:
  > Incite 2. Villainous.
  > [star] **Forced Response**: After Doctor Octopus activates against you, place 1 threat on each scheme.
- **Image Asset**: `assets/card-art/bundles/cards/27158.png` (723×1043 px, 190.5 KB)

### [27159] Electro
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sinister Assault (2/6)
- **Stats**: **SCH**: 2 [star], **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sinister Assault Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Elite.*
- **Rules Text**:
  > Retaliate 1. Villainous.
  > [star] **Forced Response**: After Electro engages you or activates against you, discard cards from the top of your deck until you discard a [energy] or [wild] resource.
- **Image Asset**: `assets/card-art/bundles/cards/27159.png` (727×1045 px, 176.9 KB)

### [27160] Hobgoblin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sinister Assault (3/6)
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sinister Assault Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Elite.*
- **Rules Text**:
  > Patrol. Villainous.
  > [star] **Forced Response**: After Hobgoblin attacks you, take 2 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/27160.png` (725×1044 px, 174.9 KB)

### [27161] Kraven the Hunter
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sinister Assault (4/6)
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sinister Assault Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite.*
- **Rules Text**:
  > Steady. Villainous.
  > [star] **Forced Response**: After Kraven the Hunter attacks and damages a character you control, discard 1 upgrade or support you control.
- **Image Asset**: `assets/card-art/bundles/cards/27161.png` (725×1044 px, 190.0 KB)

### [27162] Scorpion
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sinister Assault (5/6)
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sinister Assault Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite.*
- **Rules Text**:
  > Toughness. Villainous.
  > [star] **Forced Response**: After Scorpion attacks and damages a character, stun that character. If it is already stunned, deal 2 damage to it.
- **Image Asset**: `assets/card-art/bundles/cards/27162.png` (725×1044 px, 181.8 KB)

### [27163] Vulture
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Sinister Assault (6/6)
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sinister Assault Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Elite.*
- **Rules Text**:
  > Quickstrike. Villainous.
  > [star] **Forced Response**: After Vulture activates against you, discard 1 random card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/27163.png` (722×1043 px, 172.1 KB)


### Set: Symbiotic Strength

### [27164] Improvised Weapons
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Symbiotic Strength (1/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Symbiotic Strength Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Attach to the villain.
  > **Hero Action**: Spend [mental][physical][energy] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27164.png` (725×1043 px, 157.4 KB)

### [27165] Violent Tendencies
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Symbiotic Strength (2/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Symbiotic Strength Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the villain.
  > **Forced Response**: After attached villain takes any amount of damage from an attack, give attached villain 1 facedown boost card. If that attack dealt 3 or more damage to attached villain, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27165.png` (724×1043 px, 156.9 KB)

### [27166] Webbed Up
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Symbiotic Strength (3/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Symbiotic Strength Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Interrupt** When your hero would attack, discard Webbed Up instead. Then you are stunned.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. If you are already stunned, take 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/27166.png` (723×1044 px, 186.2 KB)

### [27167] Enraged Symbiote
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Symbiotic Strength (4–6/9, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Symbiotic Strength Set Icon (printed bottom-right next to deck number)
- **Traits**: *Symbiote.*
- **Rules Text**:
  > Guard. Patrol. (While this minion is engaged with you, you cannot thwart the main scheme.)
  >
  > ---
  >
  > [star] **Boost**: Put enraged Symbiote into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/27167.png` (725×1043 px, 185.9 KB)

### [27168] Swinging Assault
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Symbiotic Strength (7–8/9, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Symbiotic Strength Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ** When Revealed (Alter-Ego): ** Change to hero form. The villain attacks you.
  > **When Revealed (Hero): ** The villain attacks you. Give the villain 1 additional boost card for that activation.
- **Image Asset**: `assets/card-art/bundles/cards/27168.png` (721×1038 px, 279.7 KB)

### [27169] Unstable Sentience
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Symbiotic Strength (9/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Symbiotic Strength Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Give the villain 1 facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, this card gets +2 boost icons ([boost][boost]) for this attack and this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/27169.png` (724×1043 px, 172.2 KB)


### Set: Whispers of Paranoia

### [27170] Delusion of Collusion
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Whispers of Paranoia (1–2/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Whispers of Paranoia Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > Attach to your identity.
  > You cannot ready allies or [[persona]] supports you control
  > ** Alter-Ego Action: ** Discard an ally or [[persona]] support you control → discard this card.
  >
  > ---
  >
  > [star] **Boost**: If any ally is defeated by this attack, take indirect damage equal to that ally's printed cost.
- **Image Asset**: `assets/card-art/bundles/cards/27170.png` (725×1043 px, 190.3 KB)

### [27171] Manipulated Mind
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Whispers of Paranoia (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Whispers of Paranoia Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > Treat attached ally as a minion with a blank text box (except for [[traits]]). Attach minion's SCH is equal to its printed THW and it does not take consequential damage.
  > **When Revealed**: Attach to the ally you control with the lowest cost. Attached ally engages its controller. Otherwise, this card gains surge.
- **Errata (FFG)**:
  > Added “Attached ally engages its controller.” (RRG 1.5)
- **Image Asset**: `assets/card-art/bundles/cards/27171.png` (725×1043 px, 192.8 KB)

### [27172] Old Grudge
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Whispers of Paranoia (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Whispers of Paranoia Set Icon (printed bottom-right next to deck number)
- **Traits**: *Illusion.*
- **Rules Text**:
  > Attached minion gets +1 hit point.
  > **When Revealed**: Search the encounter deck, discard pile, and set-aside area for your nemesis minion, then reveal that minion. Attach Old Grudge to it. (Shuffle.)
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/27172.png` (725×1043 px, 204.9 KB)

### [27173] Analysis Paralysis
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Whispers of Paranoia (5/5)
- **Stats**: **Base Threat**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Whispers of Paranoia Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Search the encounter deck, discard pile, and set-aside area for your nemesis side scheme, then reveal it. Place X additional threat here, where X is equal to the amount of threat on that side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/27173.png` (1047×721 px, 168.2 KB)


### Set: Bad Publicity

### [27174a] Public Outcry
- **Type**: `Environment`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Bad Publicity (1/2)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Bad Publicity Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Standard Mode Only.*
- **Rules Text**:
  > ***Standard Mode Only.***
  > Victory 1. Uses (2 [per_hero] notoriety counters).
  > **Response**: After a minion or side scheme is defeated, remove 1 notoriety counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/27174a.png` (721×1030 px, 280.5 KB)

### [27174b] Public Outcry
- **Type**: `Environment`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Bad Publicity (1/2)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Bad Publicity Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Expert Mode Only.*
- **Rules Text**:
  > ***Expert Mode Only.***
  > Victory 1. Uses (3 [per_hero] notoriety counters).
  > **Response**: After a minion or side scheme is defeated, remove 1 notoriety counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/27174b.png` (723×1040 px, 182.3 KB)

### [27175] Smear Campaign
- **Type**: `Treachery`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Bad Publicity (2/2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bad Publicity Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, this card gains surge.
  > **When Revealed**: If Public Outcry is in play, place 2 notoriety counters on it, then remove this card from the game. If Public Outcry is not in play, place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/27175.png` (726×1043 px, 191.5 KB)


### Set: Community Service

### [27176] Back Alley Burglary
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Community Service (1/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Community Service Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > Victory 1. *(When defeated, add this to the victory display.)*
  > **Forced Response**: After you thwart this scheme, choose to either spend a [physical] resource or discard 1 random card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/27176.png` (1044×722 px, 188.3 KB)

### [27177] Cat in a Tree
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Community Service (2/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Community Service Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > Victory 1. *(When defeated, add this to the victory display.)*
  > As an additional cost to thwart this scheme, take 2 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/27177.png` (1043×717 px, 268.3 KB)

### [27178] Henchmen Heist
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Community Service (3/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Community Service Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > Victory 1. *(When defeated, add this to the victory display.)*
  > **Forced Response**: After any amount of threat is removed from this scheme, place an equal amount of threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/27178.png` (1044×721 px, 172.0 KB)

### [27179] Off the Rails
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Community Service (4/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Community Service Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > Victory 1. *(When defeated, add this to the victory display.)*
  > **Forced Interrupt**: When the villain phase begins, place 1 speed counter here. If there are at least 2 speed counters here, remove this card from the game and discard the top 3 cards of each player's deck.
- **Image Asset**: `assets/card-art/bundles/cards/27179.png` (1030×722 px, 165.3 KB)

### [27180] Rubble Rescue
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Community Service (5/5)
- **Stats**: **Base Threat**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Community Service Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > Victory 1. *(When defeated, add this to the victory display.)*
  > **Interrupt**: When a character makes a basic thwart against this side scheme, *(they may)* use their ATK instead of their THW.
- **Image Asset**: `assets/card-art/bundles/cards/27180.png` (1047×723 px, 185.8 KB)


### Set: Snitches get Stitches

### [27181] Snitches Get Stitches
- **Type**: `Attachment`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Snitches get Stitches (1/1)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Snitches get Stitches Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Victory -1.
  > Attach to Venom (Eddie Brock). If you cannot this card gains surge.
  > **Forced Interrupt**: When a villain attacks, it attacks Venom. If that attack defeats Venom, add Venom and this card to the victory display.
  > **Action**: Exhaust Venom and spend 2 resources of the same type → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/27181.png` (724×1044 px, 194.4 KB)


### Set: Shield Tech

### [27182a] Compact Darts
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (1/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Setup. Permanent.
  > **Hero Response**: After your hero attacks, remove 1 dart counter from here → deal 1 damage to an enemy.
  > **Alter-Ego Action**: Spend 1 resource of any type → place 3 dart counters here. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/27182a.png` (725×1043 px, 178.9 KB)

### [27182b] Compact Darts
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (1/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enhanced. S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Permanent.
  > **Hero Response**: After your hero attacks, remove 1 dart counter from here → deal 1 damage to up to 2 different enemies.
  > **Alter-Ego Action**: Spend 1 resource of any type → place 3 dart counters here. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/27182b.png` (725×1045 px, 180.1 KB)

### [27183a] Impact-Dampening Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (2/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Setup. Permanent.
  > Your identity gets +2 hit points.
  > **Hero Interrupt**: When the villain phase begins, spend 1 resource of any type → until the end of the phase, reduce the amount of damage your hero takes from each enemy attack by 1.
- **Image Asset**: `assets/card-art/bundles/cards/27183a.png` (724×1044 px, 170.9 KB)

### [27183b] Impact-Dampening Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (2/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enhanced. S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Permanent.
  > Your identity gets +3 hit points.
  > **Hero Interrupt**: When your hero would take any amount of damage from an enemy attack, discard the top card of your deck → prevent 1 of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/27183b.png` (723×1043 px, 161.2 KB)

### [27184a] Laser Goggles
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (3/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Setup. Permanent.
  > Your hero gets -1 THW.
  > Your hero gets +1 ATK, and your hero's basic attacks gain overkill.
- **Image Asset**: `assets/card-art/bundles/cards/27184a.png` (725×1041 px, 166.5 KB)

### [27184b] Laser Goggles
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (3/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enhanced. S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Permanent.
  > Your hero gets -1 THW.
  > Your hero gets +2 ATK, and your hero's basic attacks gain overkill and piercing.
- **Image Asset**: `assets/card-art/bundles/cards/27184b.png` (725×1044 px, 174.7 KB)

### [27185a] Propulsion Gauntlet
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (4/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Setup. Permanent.
  > **Hero Action**: Exhaust Propulsion Gauntlet and take 2 indirect damage → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/27185a.png` (725×1042 px, 191.2 KB)

### [27185b] Propulsion Gauntlet
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (4/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enhanced. S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Permanent.
  > **Hero Action**: Exhaust Propulsion Gauntlet and take 2 indirect damage → ready your hero. Your hero gets +1 THW, +1 ATK, and +1 DEF until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/27185b.png` (725×1043 px, 198.1 KB)

### [27186a] Retinal Display
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (5/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Setup. Permanent.
  > Your hero's basic thwart power *(THW)* can only remove threat from the scheme with the most threat.
  > Your hero gets +1 THW, and your hero's basic thwarts ignore the crisis icon *([crisis])*.
- **Image Asset**: `assets/card-art/bundles/cards/27186a.png` (714×1039 px, 157.2 KB)

### [27186b] Retinal Display
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (5/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enhanced. S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Permanent.
  > Your hero's basic thwart power *(THW)* can only remove threat from the scheme with the most threat.
  > Your hero gets +2 THW, and your hero's basic thwarts ignore the crisis icon *([crisis])* and the patrol keyword.
- **Image Asset**: `assets/card-art/bundles/cards/27186b.png` (722×1031 px, 251.0 KB)

### [27187a] Shock Knuckles
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (6/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Setup. Permanent.
  > **Hero Response**: After your hero makes a basic attack against an enemy, discard the top card of the encounter deck. If no boost icons *([boost])* were discarded this way, stun that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/27187a.png` (726×1044 px, 184.4 KB)

### [27187b] Shock Knuckles
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (6/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enhanced. S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Permanent.
  > Your hero gets +1 ATK.
  > **Hero Response**: After your hero makes a basic attack against an enemy, discard the top card of the encounter deck. If 1 or fewer boost icons *([boost])* were discarded this way, stun that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/27187b.png` (724×1044 px, 182.9 KB)

### [27188a] Wave Bracers
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (7/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Setup. Permanent.
  > Your hero gets -1 ATK.
  > Your hero gets +1 DEF, and gains retaliate 1 and steady.
- **Image Asset**: `assets/card-art/bundles/cards/27188a.png` (721×1042 px, 271.7 KB)

### [27188b] Wave Bracers
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (7/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enhanced. S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Permanent.
  > Your hero gets -1 ATK.
  > Your hero gets +2 DEF, and gains retaliate 1 and stalwart.
- **Image Asset**: `assets/card-art/bundles/cards/27188b.png` (724×1044 px, 170.2 KB)

### [27189a] Wrist Navigator
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (8/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Setup. Permanent.
  > **Forced Response**: After a minion or side scheme enters play, attach Wrist Navigator to it.
  > **Interrupt**: When the attached card is defeated, draw 1 card. *(Return this card to your play area.)*
- **Image Asset**: `assets/card-art/bundles/cards/27189a.png` (725×1043 px, 181.2 KB)

### [27189b] Wrist Navigator
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Sinister Motives (`sm`)
- **Deck / Set**: Shield Tech (8/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Shield Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Enhanced. S.H.I.E.L.D. Tech.*
- **Rules Text**:
  > Permanent.
  > **Forced Response**: After a minion or side scheme enters play, attach Wrist Navigator to it.
  > **Interrupt**: When the attached card is defeated, draw 2 cards, then discard 1 card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/27189b.png` (722×1044 px, 174.0 KB)


