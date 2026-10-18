# Marvel Champions Card Reference Database

A complete, generated transcription of the cached MarvelCDB card records in `packages/content/raw/marvelcdb/` (and, for faces MarvelCDB lacks, the scan transcriptions in `packages/content/raw/hallofheroes/`), formatted for AI and rules-engine consumption. Regenerate with `scripts/generate_cards_markdown.py`; do not hand-edit.

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
| `60001a` | Daredevil | Hero | Daredevil | THW:1 ATK:2 DEF:2 HP:10 | - | `fne` |
| `60001b` | Matt Murdock | Alter-Ego | Daredevil | REC:3 HP:10 | - | `fne` |
| `60002` | Acute Tactility | Upgrade | Sense Deck | - | - | `fne` |
| `60003` | Enhanced Olfaction | Upgrade | Sense Deck | - | - | `fne` |
| `60004` | Heightened Hearing | Upgrade | Sense Deck | - | - | `fne` |
| `60005` | Radar Sense | Upgrade | Sense Deck | - | - | `fne` |
| `60006` | Superior Taste | Upgrade | Sense Deck | - | - | `fne` |
| `60007` | Elektra | Ally | Daredevil | THW:1 ATK:2 HP:3 | - | `fne` |
| `60008` | Cross-Examination | Event | Daredevil | - | - | `fne` |
| `60009` | Deposition | Event | Daredevil | - | - | `fne` |
| `60010` | Living Lie Detector | Event | Daredevil | - | - | `fne` |
| `60011` | Raising Hell | Event | Daredevil | - | - | `fne` |
| `60012` | Focus the Senses | Player Side Scheme | Daredevil | - | - | `fne` |
| `60013` | Foggy Nelson | Support | Daredevil | - | - | `fne` |
| `60014` | Karen Page | Support | Daredevil | - | - | `fne` |
| `60015` | Nelson and Murdock | Support | Daredevil | - | - | `fne` |
| `60016` | Sister Maggie | Support | Daredevil | - | - | `fne` |
| `60017` | Daredevil's Billy Club | Upgrade | Daredevil | - | - | `fne` |
| `60018` | The Man Without Fear | Upgrade | Daredevil | - | - | `fne` |
| `60019` | Blindspot | Ally | Pack Position: 19 | THW:2 ATK:2 HP:3 | - | `fne` |
| `60020` | Cloak | Ally | Pack Position: 20 | THW:2 ATK:1 HP:2 | - | `fne` |
| `60021` | Dagger | Ally | Pack Position: 21 | THW:1 ATK:2 HP:3 | - | `fne` |
| `60022` | Ghost Rider | Ally | Pack Position: 22 | THW:1 ATK:2 HP:3 | - | `fne` |
| `60023` | Know Your Enemy | Event | Pack Position: 23 | - | - | `fne` |
| `60024` | De-escalation | Player Side Scheme | Pack Position: 24 | - | - | `fne` |
| `60025` | Chance Encounter | Upgrade | Pack Position: 25 | - | - | `fne` |
| `60026` | Legal Trouble | Upgrade | Pack Position: 26 | - | - | `fne` |
| `60027` | Move in Shadow | Upgrade | Pack Position: 27 | - | - | `fne` |
| `60028` | Stealth Training | Upgrade | Pack Position: 28 | - | - | `fne` |
| `60029` | Stick | Support | Pack Position: 29 | - | - | `fne` |
| `60030` | Contingency Planning | Upgrade | Pack Position: 30 | - | - | `fne` |
| `60031` | Dance with the Devil | Upgrade | Pack Position: 31 | - | - | `fne` |
| `60032` | Sensory Overload | Obligation | Daredevil | - | 2 icons | `fne` |
| `60033` | Bullseye | Minion | Daredevil Nemesis | SCH:1 ATK:3 HP:5 | 3 icons | `fne` |
| `60034` | Deadliest Man Alive | Side Scheme | Daredevil Nemesis | - | 2 icons | `fne` |
| `60035` | Stolen Sai | Attachment | Daredevil Nemesis | ATK:1 | 1 icon + star | `fne` |
| `60036` | Eye on the Target | Treachery | Daredevil Nemesis | - | 2 icons | `fne` |
| `60037a` | Echo | Hero | Echo | THW:2 ATK:2 DEF:2 HP:9 | - | `fne` |
| `60037b` | Maya Lopez | Alter-Ego | Echo | REC:3 HP:9 | - | `fne` |
| `60038` | Innate Reflexes | Upgrade | Pack Position: 38 | - | - | `fne` |
| `60039` | Daredevil | Ally | Echo | THW:2 ATK:2 HP:3 | - | `fne` |
| `60040a` | Photographic Reflexes | Event | Echo | - | - | `fne` |
| `60040b` | Photographic Reflexes | Event | Echo | - | - | `fne` |
| `60040c` | Photographic Reflexes | Event | Echo | - | - | `fne` |
| `60041` | Study the Tape | Event | Echo | - | - | `fne` |
| `60042` | The Rez | Support | Echo | - | - | `fne` |
| `60043` | American Sign Language | Upgrade | Echo | - | - | `fne` |
| `60044` | Choreography | Upgrade | Echo | - | - | `fne` |
| `60045` | Echo's Katana | Upgrade | Echo | - | - | `fne` |
| `60046` | Improvisation | Upgrade | Echo | - | - | `fne` |
| `60047` | Muscle Memory | Upgrade | Echo | - | - | `fne` |
| `60048` | Army of One | Event | Pack Position: 48 | - | - | `fne` |
| `60049` | Get Their Attention | Event | Pack Position: 49 | - | - | `fne` |
| `60050` | In Harm's Way | Event | Pack Position: 50 | - | - | `fne` |
| `60051` | Powerful Punch | Event | Pack Position: 51 | - | - | `fne` |
| `60052` | The Best Offense... | Upgrade | Pack Position: 52 | - | - | `fne` |
| `60053` | Ronin | Upgrade | Pack Position: 53 | - | - | `fne` |
| `60054` | Stand Alone | Upgrade | Pack Position: 54 | - | - | `fne` |
| `60055` | See No Evil, Hear No Evil | Event | Pack Position: 55 | - | - | `fne` |
| `60056` | Superpower Training | Player Side Scheme | Pack Position: 56 | - | - | `fne` |
| `60057` | Energy | Resource | Pack Position: 57 | - | - | `fne` |
| `60058` | Genius | Resource | Pack Position: 58 | - | - | `fne` |
| `60059` | Strength | Resource | Pack Position: 59 | - | - | `fne` |
| `60060` | Raised by the Kingpin | Obligation | Echo | - | 2 icons | `fne` |
| `60061` | Kingpin | Minion | Echo Nemesis | SCH:3 ATK:2 HP:6 | 3 icons | `fne` |
| `60062` | Master Manipulator | Side Scheme | Echo Nemesis | - | 0 icons + star | `fne` |
| `60063` | Kingpin's Henchman | Minion | Echo Nemesis | SCH:1 ATK:2 HP:4 | 1 icon | `fne` |
| `60064` | Pawn of the Kingpin | Treachery | Echo Nemesis | - | 2 icons | `fne` |
| `60065` | Bullseye | Villain | Bullseye | SCH:0 ATK:1 HP:14 | - | `fne` |
| `60066` | Bullseye | Villain | Bullseye | SCH:1 ATK:2 HP:16 | - | `fne` |
| `60067` | Bullseye | Villain | Bullseye | SCH:1 ATK:3 HP:18 | - | `fne` |
| `60068a` | Adamantium-Laced Spine | Attachment | Bullseye | - | not recorded in this source | `fne` |
| `60068b` | Damaged Spine | Attachment | Bullseye | - | not recorded in this source | `fne` |
| `60069` | Raise the Stakes | Attachment | Bullseye | - | 3 icons | `fne` |
| `60070` | Deadly Sai | Attachment | Bullseye | ATK:2 | 2 icons | `fne` |
| `60071` | Incessant Pursuit | Attachment | Bullseye | - | 1 icon | `fne` |
| `60072` | Lady Bullseye | Minion | Bullseye | SCH:2 ATK:1 HP:6 | 3 icons | `fne` |
| `60073` | Deranged Bloodlust | Side Scheme | Bullseye | - | 1 icon + star | `fne` |
| `60074` | Everything is a Weapon | Treachery | Bullseye | - | 1 icon + star | `fne` |
| `60075` | Unerring Desire | Treachery | Bullseye | - | 3 icons + star | `fne` |
| `60076` | Electro | Villain | Electro | SCH:1 ATK:1 HP:15 | - | `fne` |
| `60077` | Electro | Villain | Electro | SCH:1 ATK:2 HP:17 | - | `fne` |
| `60078` | Electro | Villain | Electro | SCH:2 ATK:2 HP:20 | - | `fne` |
| `60079` | Electric Charge | Attachment | Electro | - | not recorded in this source | `fne` |
| `60080` | Drained of Power | Attachment | Electro | - | 2 icons | `fne` |
| `60081` | Whiplash | Minion | Electro | SCH:2 ATK:2 HP:5 | 3 icons | `fne` |
| `60082` | Charging Up | Side Scheme | Electro | - | 3 icons | `fne` |
| `60083` | Chain Lightning | Treachery | Electro | - | 1 icon | `fne` |
| `60084` | Energy Overload | Treachery | Electro | - | 2 icons | `fne` |
| `60085` | Shocking Revelation | Treachery | Electro | - | 2 icons | `fne` |
| `60086` | Hammerhead | Villain | Hammerhead | SCH:2 ATK:1 HP:14 | - | `fne` |
| `60087` | Hammerhead | Villain | Hammerhead | SCH:2 ATK:2 HP:15 | - | `fne` |
| `60088` | Hammerhead | Villain | Hammerhead | SCH:3 ATK:3 HP:16 | - | `fne` |
| `60089` | Energy Gatling Gun | Attachment | Hammerhead | ATK:1 | 2 icons | `fne` |
| `60090` | Hardheaded | Attachment | Hammerhead | SCH:1 | 1 icon + star | `fne` |
| `60091` | Chameleon | Minion | Hammerhead | SCH:1 ATK:1 HP:5 | 3 icons | `fne` |
| `60092` | Maggia Enforcers | Minion | Hammerhead | ATK:2 HP:3 | not recorded in this source | `fne` |
| `60093` | Maggia Underboss | Minion | Hammerhead | SCH:1 ATK:1 HP:4 | 1 icon | `fne` |
| `60094` | Consolidate Power | Side Scheme | Hammerhead | - | 1 icon | `fne` |
| `60095` | Power Struggle | Side Scheme | Hammerhead | - | 1 icon | `fne` |
| `60096` | "Head First!" | Treachery | Hammerhead | - | 2 icons | `fne` |
| `60097` | Purple Man | Villain | Purple Man | SCH:1 ATK:0 HP:13 | - | `fne` |
| `60098` | Purple Man | Villain | Purple Man | SCH:2 ATK:1 HP:15 | - | `fne` |
| `60099` | Purple Man | Villain | Purple Man | SCH:3 ATK:1 HP:17 | - | `fne` |
| `60100` | Converted | Attachment | Purple Man | - | 3 icons + star | `fne` |
| `60101` | Firefighter | Minion | Purple Man | SCH:1 ATK:1 HP:3 | 0 icons + star | `fne` |
| `60102` | Judge | Minion | Purple Man | SCH:3 ATK:0 HP:2 | 2 icons + star | `fne` |
| `60103` | Security Guard | Minion | Purple Man | SCH:0 ATK:2 HP:4 | 1 icon + star | `fne` |
| `60104` | Skater Punk | Minion | Purple Man | SCH:1 ATK:2 HP:2 | 0 icons + star | `fne` |
| `60105` | "Fight." | Obligation | Purple Man | - | 1 icon + star | `fne` |
| `60106` | "Protect." | Obligation | Purple Man | - | 1 icon + star | `fne` |
| `60107` | "Serve." | Obligation | Purple Man | - | 1 icon + star | `fne` |
| `60108` | Power of Suggestion | Side Scheme | Purple Man | - | 3 icons + star | `fne` |
| `60109` | Sway the Masses | Treachery | Purple Man | - | 2 icons + star | `fne` |
| `60110a` | Typhoid Mary | Villain | Typhoid Mary | SCH:2 ATK:1 HP:10 | - | `fne` |
| `60110b` | Bloody Mary | Villain | Typhoid Mary | SCH:1 ATK:2 HP:10 | - | `fne` |
| `60111a` | Typhoid Mary | Villain | Typhoid Mary | SCH:3 ATK:1 HP:13 | - | `fne` |
| `60111b` | Bloody Mary | Villain | Typhoid Mary | SCH:1 ATK:3 HP:13 | - | `fne` |
| `60112` | Disturbed Psyche | Environment | Typhoid Mary | - | - | `fne` |
| `60113a` | Establish Trust | Side Scheme | Typhoid Mary | - | not recorded in this source | `fne` |
| `60113b` | Mary Walker | Attachment | Typhoid Mary | - | not recorded in this source | `fne` |
| `60114` | Telekinesis | Attachment | Typhoid Mary | SCH:2 | 1 icon + star | `fne` |
| `60115` | Psionic Slash | Treachery | Typhoid Mary | - | 0 icons + star | `fne` |
| `60116` | Psi Nova | Treachery | Typhoid Mary | - | 2 icons + star | `fne` |
| `60117` | Assembled Armor | Attachment | Typhoid Mary | ATK:2 | 1 icon + star | `fne` |
| `60118` | Hail of Blades | Treachery | Typhoid Mary | - | 0 icons + star | `fne` |
| `60119` | Scavenged Bulwark | Treachery | Typhoid Mary | - | 2 icons + star | `fne` |
| `60120` | Hand Lookout | Minion | Typhoid Mary | SCH:0 ATK:2 HP:4 | 1 icon + star | `fne` |
| `60121a` | Art Museum Heist | Main Scheme | Art Museum Heist | - | - | `fne` |
| `60121b` | Art Museum Heist | Main Scheme | Art Museum Heist | - | - | `fne` |
| `60122` | Impossible Object | Attachment | Art Museum Heist | THW:1 SCH:1 | 2 icons | `fne` |
| `60123` | Inspiring Pottery | Attachment | Art Museum Heist | THW:1 SCH:1 | 2 icons | `fne` |
| `60124` | Replica Shield | Attachment | Art Museum Heist | THW:1 SCH:1 | 2 icons | `fne` |
| `60125` | Stunning Landscape | Attachment | Art Museum Heist | THW:1 SCH:1 | 2 icons | `fne` |
| `60126` | Art Thief | Minion | Art Museum Heist | SCH:2 ATK:2 HP:3 | 0 icons + star | `fne` |
| `60127` | Tug of War | Treachery | Art Museum Heist | - | 1 icon | `fne` |
| `60128a` | The Getaway | Main Scheme | The Getaway | - | - | `fne` |
| `60128b` | The Getaway | Main Scheme | The Getaway | - | - | `fne` |
| `60129a` | Out Front | Attachment | The Getaway | - | not recorded in this source | `fne` |
| `60129b` | Alongside | Attachment | The Getaway | - | not recorded in this source | `fne` |
| `60130` | Escort Vehicle | Minion | The Getaway | SCH:2 ATK:2 HP:5 | 3 icons | `fne` |
| `60131` | Jackknifed Tanker Truck | Side Scheme | The Getaway | - | 2 icons | `fne` |
| `60132` | Burning Rubber | Treachery | The Getaway | - | 1 icon | `fne` |
| `60133` | Pedestrians | Treachery | The Getaway | - | 1 icon | `fne` |
| `60134a` | Protection Racket | Main Scheme | Protection Racket | - | - | `fne` |
| `60134b` | Battle in the Bodega | Main Scheme | Protection Racket | - | - | `fne` |
| `60135a` | Protection Racket | Main Scheme | Protection Racket | - | - | `fne` |
| `60135b` | Bull in a China Shop | Main Scheme | Protection Racket | - | - | `fne` |
| `60136a` | Protection Racket | Main Scheme | Protection Racket | - | - | `fne` |
| `60136b` | Hung Out to Dry | Main Scheme | Protection Racket | - | - | `fne` |
| `60137a` | Protection Racket | Main Scheme | Protection Racket | - | - | `fne` |
| `60137b` | Pawn Shop Showdown | Main Scheme | Protection Racket | - | - | `fne` |
| `60138a` | Protection Racket | Main Scheme | Protection Racket | - | - | `fne` |
| `60138b` | A Slice of the Pizza Dough | Main Scheme | Protection Racket | - | - | `fne` |
| `60139` | Shop Proprietor | Ally | Protection Racket | THW:1 ATK:1 HP:3 | not recorded in this source | `fne` |
| `60140` | Man-Bull | Minion | Protection Racket | SCH:2 ATK:4 HP:6 | 2 icons + star | `fne` |
| `60141` | Change of Venue | Treachery | Protection Racket | - | 1 icon + star | `fne` |
| `60142a` | The Raft Breakout | Main Scheme | The Raft Breakout | - | - | `fne` |
| `60142b` | The Raft Breakout | Main Scheme | The Raft Breakout | - | - | `fne` |
| `60143` | Master Key | Attachment | The Raft Breakout | - | not recorded in this source | `fne` |
| `60144` | Absorbing Man | Minion | The Raft Breakout | SCH:1 ATK:1 HP:6 | 3 icons | `fne` |
| `60145` | Baron Zemo | Minion | The Raft Breakout | SCH:2 ATK:1 HP:6 | 3 icons | `fne` |
| `60146` | Drang | Minion | The Raft Breakout | SCH:1 ATK:1 HP:6 | 3 icons | `fne` |
| `60147` | Mysterio | Minion | The Raft Breakout | SCH:2 ATK:1 HP:6 | 3 icons | `fne` |
| `60148` | Proxima Midnight | Minion | The Raft Breakout | SCH:1 ATK:2 HP:7 | 3 icons | `fne` |
| `60149` | Rhino | Minion | The Raft Breakout | SCH:1 ATK:3 HP:7 | 3 icons + star | `fne` |
| `60150` | Imprisoned | Obligation | The Raft Breakout | - | 0 icons + star | `fne` |
| `60151a` | Stop the Presses! | Main Scheme | Stop the Presses! | - | - | `fne` |
| `60151b` | Stop the Presses! | Main Scheme | Stop the Presses! | - | - | `fne` |
| `60152` | Daily Bugle | Environment | Stop the Presses! | - | - | `fne` |
| `60153` | Ben Urich | Support | Stop the Presses! | - | not recorded in this source | `fne` |
| `60154` | Betty Brant | Support | Stop the Presses! | - | not recorded in this source | `fne` |
| `60155` | J. Jonah Jameson | Support | Stop the Presses! | - | not recorded in this source | `fne` |
| `60156` | Robbie Robertson | Support | Stop the Presses! | - | not recorded in this source | `fne` |
| `60157` | Exclusive Interview | Side Scheme | Stop the Presses! | - | 1 icon | `fne` |
| `60158` | Breaking News | Treachery | Stop the Presses! | - | 0 icons + star | `fne` |
| `60159a` | Kingpin | Villain | Kingpin | SCH:2 ATK:0 HP:25 | - | `fne` |
| `60159b` | Kingpin | Villain | Kingpin | SCH:2 ATK:2 HP:25 | - | `fne` |
| `60160a` | Kingpin | Villain | Kingpin | SCH:3 ATK:0 HP:28 | - | `fne` |
| `60160b` | Kingpin | Villain | Kingpin | SCH:3 ATK:3 HP:28 | - | `fne` |
| `60161a` | The King's Gambit | Main Scheme | Kingpin | - | - | `fne` |
| `60161b` | The King's Gambit | Main Scheme | Kingpin | - | - | `fne` |
| `60162a` | Endgame | Main Scheme | Kingpin | - | - | `fne` |
| `60162b` | Endgame | Main Scheme | Kingpin | - | - | `fne` |
| `60163a` | Public Support | Environment | Kingpin | - | - | `fne` |
| `60163b` | Public Support | Environment | Kingpin | - | - | `fne` |
| `60164` | Bear Hug | Attachment | Kingpin | - | 2 icons | `fne` |
| `60165` | James Wesley | Attachment | Kingpin | SCH:1 | 0 icons + star | `fne` |
| `60166` | Kingpin's Cane | Attachment | Kingpin | ATK:1 | 1 icon + star | `fne` |
| `60167` | Mountain of Muscle | Attachment | Kingpin | - | 2 icons | `fne` |
| `60168` | Vanessa Fisk | Attachment | Kingpin | SCH:1 | 0 icons + star | `fne` |
| `60169` | Black Cat | Minion | Kingpin | THW:1 SCH:1 ATK:1 HP:6 | 2 icons | `fne` |
| `60170` | Diamondback | Minion | Kingpin | SCH:1 ATK:1 HP:6 | 2 icons + star | `fne` |
| `60171` | Spot | Minion | Kingpin | SCH:2 ATK:2 HP:5 | 3 icons | `fne` |
| `60172` | Stilt-Man | Minion | Kingpin | SCH:1 ATK:1 HP:4 | 3 icons | `fne` |
| `60173` | Kingpin's Influence | Side Scheme | Kingpin | - | 3 icons | `fne` |
| `60174` | Organized Crime | Side Scheme | Kingpin | - | 2 icons | `fne` |
| `60175` | Bag of Tricks | Treachery | Kingpin | - | 0 icons + star | `fne` |
| `60176` | Unrelenting Hate | Treachery | Kingpin | - | 1 icon + star | `fne` |
| `60177` | Mystic Incursion | Environment | Disasters | - | 2 icons | `fne` |
| `60178` | Sinking Ferry | Environment | Disasters | - | 2 icons | `fne` |
| `60179` | Towering Inferno | Environment | Disasters | - | 2 icons | `fne` |
| `60180` | Collapsing Bridge | Side Scheme | Disasters | - | 2 icons | `fne` |
| `60181` | Bystanders in Peril | Treachery | Disasters | - | 1 icon + star | `fne` |
| `60182` | Cop | Minion | Cops | SCH:0 ATK:2 HP:3 | not recorded in this source | `fne` |
| `60183` | Crooked Cop | Minion | Cops | SCH:1 ATK:2 HP:4 | 0 icons + star | `fne` |
| `60184` | Wanted | Obligation | Cops | - | 2 icons | `fne` |
| `60185` | Police Cordon | Side Scheme | Cops | - | 3 icons | `fne` |
| `60186` | Sports Car | Attachment | Drive | ATK:1 | 2 icons | `fne` |
| `60187` | Motorcycle | Attachment | Drive | THW:1 SCH:1 | 1 icon | `fne` |
| `60188` | Utility Van | Attachment | Drive | - | 1 icon | `fne` |
| `60189` | Traffic Jam | Side Scheme | Drive | - | 3 icons | `fne` |
| `60190` | Carjacking | Treachery | Drive | - | 2 icons | `fne` |
| `60191` | Flight Serum | Attachment | The Owl | SCH:1 ATK:1 | not recorded in this source | `fne` |
| `60192` | Mister Fish | Minion | The Owl | SCH:1 ATK:2 HP:4 | 2 icons | `fne` |
| `60193` | The Owl | Minion | The Owl | SCH:3 ATK:2 HP:5 | 0 icons + star | `fne` |
| `60194` | Swoop Down | Treachery | The Owl | - | 3 icons | `fne` |
| `60195` | Cold as Ice | Attachment | Tombstone | SCH:2 | 2 icons | `fne` |
| `60196` | Hard as Marble | Attachment | Tombstone | ATK:2 | 2 icons | `fne` |
| `60197` | Beetle | Minion | Tombstone | SCH:1 ATK:1 HP:5 | 2 icons | `fne` |
| `60198` | Tombstone | Minion | Tombstone | SCH:2 ATK:2 HP:8 | 0 icons + star | `fne` |
| `60199` | Hit List | Side Scheme | Tombstone | - | 3 icons | `fne` |
| `60200` | Ivan Banionis | Minion | Tracksuit Mafia | SCH:0 ATK:2 HP:5 | 2 icons | `fne` |
| `60201` | The Clown | Minion | Tracksuit Mafia | SCH:0 ATK:1 HP:6 | 2 icons | `fne` |
| `60202` | Tracksuit Mafioso | Minion | Tracksuit Mafia | SCH:3 ATK:0 HP:7 | 3 icons | `fne` |
| `60203` | Tracksuit Bro | Minion | Tracksuit Mafia | SCH:1 ATK:2 HP:3 | 2 icons | `fne` |
| `60204` | Tracksuit Mafia | Side Scheme | Tracksuit Mafia | - | 2 icons | `fne` |
| `60205a` | Art Museum Heist | Environment | Campaign | - | - | `fne` |
| `60205b` | Art Museum Heist | Environment | Campaign | - | - | `fne` |
| `60206a` | The Getaway | Environment | Campaign | - | - | `fne` |
| `60206b` | The Getaway | Environment | Campaign | - | - | `fne` |
| `60207a` | Protection Racket | Environment | Campaign | - | - | `fne` |
| `60207b` | Protection Racket | Environment | Campaign | - | - | `fne` |
| `60208a` | The Raft Breakout | Environment | Campaign | - | - | `fne` |
| `60208b` | The Raft Breakout | Environment | Campaign | - | - | `fne` |
| `60209a` | Stop the Presses! | Environment | Campaign | - | - | `fne` |
| `60209b` | Stop the Presses! | Environment | Campaign | - | - | `fne` |
| `60210a` | Typhoid Mary | Ally | Campaign | THW:2 ATK:1 HP:3 | not recorded in this source | `fne` |
| `60210b` | Bloody Mary | Ally | Campaign | THW:1 ATK:2 HP:3 | not recorded in this source | `fne` |

---

## Pack: Fear No Evil (`fne`)

### Set: Daredevil

### [60001a] Daredevil
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > *Superhuman Senses* — **Action**: Play the top card of the [[Sense]] deck as if it were in your hand *(paying its cost)*.
- **Image Asset**: `assets/card-art/bundles/cards/60001a.png` (710×1030 px, 165.0 KB)

### [60001b] Matt Murdock
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Attorney.*
- **Rules Text**:
  > Matt Murdock begins the game with a [[Sense]] deck. *(See rulebook p. 26.)*
  > **Forced Interrupt**: When a [[Sense]] upgrade would leave play, place it on the bottom of the [[Sense]] deck instead.
- **Image Asset**: `assets/card-art/bundles/cards/60001b.png` (710×1030 px, 180.7 KB)

### [60007] Elektra — *Elektra Natchios*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > [star] **Forced Interrupt (Hero)**: When Elektra would take consequential damage, Daredevil takes that damage instead.
- **Flavor**: *"I don't need your protection, Matt."*
- **Image Asset**: `assets/card-art/bundles/cards/60007.png` (710×1030 px, 147.1 KB)

### [60008] Cross-Examination
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (2–3/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. For each upgrade attached to that enemy, you may deal 1 additional damage to it.
- **Flavor**: *"No further questions, punk." —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/60008.png` (710×1030 px, 153.2 KB)

### [60009] Deposition
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (4–5/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Alter-Ego Action** *(thwart)*: You may choose any upgrade from the [[Sense]] deck and play it, ignoring its resource cost. *(Do not shuffle.)* Remove 2 threat from a scheme.
- **Flavor**: *"Tell us everything." —Matt Murdock*
- **Image Asset**: `assets/card-art/bundles/cards/60009.png` (710×1030 px, 147.4 KB)

### [60010] Living Lie Detector
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (6–7/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Action** *(thwart)*: Remove 2 threat from a scheme. For each upgrade attached to that scheme, you may remove 1 additional threat from it.
- **Flavor**: *Thump-Thump     Thump-Thump    Thump-Thump   Thump-Thump  Thump-Thump Thump-Thump*
- **Image Asset**: `assets/card-art/bundles/cards/60010.png` (710×1030 px, 166.1 KB)

### [60011] Raising Hell
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (8/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 2 damage to each enemy for each upgrade attached to that enemy (3 damage instead if Daredevil has the [[Aerial]] trait).
- **Flavor**: *"I cannot see the light. So I will be the light. I am Daredevil, and I am not afraid." —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/60011.png` (710×1030 px, 121.9 KB)

### [60012] Focus the Senses
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 4, **Resources**: [mental]
- **Rules Text**:
  > Threat cannot be removed from this scheme except by Daredevil or Matt Murdock.
  > **When Defeated**: You may move any number of [[Sense]] upgrades in play to other cards they can attach to. Choose any number of upgrades from the [[Sense]] deck and put them into play. *(Do not shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/60012.png` (1030×710 px, 134.4 KB)

### [60013] Foggy Nelson
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attorney. Persona.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Foggy Nelson → remove 2 threat from a scheme.
- **Flavor**: *"Everything's okay now, Matt! Ol' Fog is on it!"*
- **Image Asset**: `assets/card-art/bundles/cards/60013.png` (710×1030 px, 147.5 KB)

### [60014] Karen Page
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Persona.*
- **Rules Text**:
  > **Action**: Exhaust Karen Page → shuffle 1 Daredevil card from your discard pile into your deck. If you are in alter-ego form, draw 1 card.
- **Flavor**: *"What would you boys do without me?"*
- **Image Asset**: `assets/card-art/bundles/cards/60014.png` (710×1030 px, 169.6 KB)

### [60015] Nelson and Murdock
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (12/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > **Response**: After an [[Attorney]] character or support defeats a side scheme, confuse an enemy.
- **Flavor**: *"Let's see them pull off their heist with their vehicle impounded." —Matt Murdock*
- **Image Asset**: `assets/card-art/bundles/cards/60015.png` (710×1030 px, 147.5 KB)

### [60016] Sister Maggie
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > Matt Murdock gets +3 REC.
  > **Response**: After you recover, discard a status card from your identity.
- **Flavor**: *As both a Catholic nun and Matt's mother, Sister Maggie often nurses her son back to health.*
- **Image Asset**: `assets/card-art/bundles/cards/60016.png` (710×1030 px, 159.9 KB)

### [60017] Daredevil's Billy Club
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (14/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Item. Weapon.*
- **Rules Text**:
  > Restricted. Daredevil gets +1 ATK.
  > **Hero Action**: Return this card to your hand *(from play)* → choose:
  > • Deal 1 damage to an enemy.
  > • Daredevil gains the [[Aerial]] trait until the end of the round.
- **Image Asset**: `assets/card-art/bundles/cards/60017.png` (710×1030 px, 157.0 KB)

### [60018] The Man Without Fear
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > **Hero Action**: Exhaust this card and deal 1 damage to Daredeveil → choose:
  > • Choose any upgrade from the [[Sense]] deck and play it, ignoring its resource cost. *(Do not shuffle.)*
  > • Ready Daredevil.
- **Image Asset**: `assets/card-art/bundles/cards/60018.png` (710×1030 px, 126.4 KB)

### [60032] Sensory Overload
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Daredevil Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Matt Murdock player.***
  > **Forced Response**: After a [[Sense]] upgrade enters play, take 1 damage.
  > **Alter-Ego Response**: After you recover, discard this card.
- **Flavor**: *Daredevil's heightened senses make him vulnerable to intense stimuli.*
- **Image Asset**: `assets/card-art/bundles/cards/60032.png` (710×1030 px, 131.2 KB)


### Set: Sense Deck

### [60002] Acute Tactility
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (1/5)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to an enemy or scheme.
  > **Interrupt**: When you defeat attached enemy or remove the last threat from attached scheme, discard this card → ready your identity.
- **Image Asset**: `assets/card-art/bundles/cards/60002.png` (710×1030 px, 148.6 KB)

### [60003] Enhanced Olfaction
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (2/5)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to an enemy or scheme.
  > **Interrupt**: When you defeat attached enemy or remove the last threat from attached scheme, discard this card → reduce the cost of the next card you play this phase by 2.
- **Image Asset**: `assets/card-art/bundles/cards/60003.png` (710×1030 px, 158.7 KB)

### [60004] Heightened Hearing
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (3/5)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to an enemy.
  > **Hero Interrupt** *(defense)*: When attached enemy attacks, discard this card → that enemy gets -3 ATK for that attack. *(You become the target of that attack.)*
- **Image Asset**: `assets/card-art/bundles/cards/60004.png` (710×1030 px, 163.4 KB)

### [60005] Radar Sense
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (4/5)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to an enemy.
  > **Response** *(attack)*: After you attack attached enemy, discard this card → deal 3 damage to that enemy.
- **Flavor**: *The accident that cost Matt his eyesight gave him a new, radar-like sense.*
- **Image Asset**: `assets/card-art/bundles/cards/60005.png` (710×1030 px, 147.8 KB)

### [60006] Superior Taste
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Sense Deck (5/5)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Sense. Superpower.*
- **Rules Text**:
  > Attach to a scheme.
  > **Response** *(thwart)*: After you thwart attached scheme, discard this card → remove 2 threat from that scheme.
- **Image Asset**: `assets/card-art/bundles/cards/60006.png` (710×1030 px, 154.1 KB)


### Set: Justice

### [60019] Blindspot — *Sam Chung*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Genius. Martial Artist.*
- **Rules Text**:
  > [star] **Response**: After Blindspot thwarts, confuse an enemy with an upgrade attached.
- **Flavor**: *"I'm invisible, but I'm still here. Chinatown is where I live and I'm going to protect it."*
- **Image Asset**: `assets/card-art/bundles/cards/60019.png` (710×1030 px, 116.3 KB)

### [60020] Cloak — *Tyrone Johnson*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2, **ATK**: 1, **HP**: 2, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Defender.*
- **Rules Text**:
  > **Action**: Exhaust Cloak and spend [energy] [energy] resources → find Dagger and put her into play.
- **Image Asset**: `assets/card-art/bundles/cards/60020.png` (710×1030 px, 95.5 KB)

### [60021] Dagger — *Tandy Bowen*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 2), **ATK**: 2 [star] (Consequential: 2), **HP**: 3, **Resources**: [energy]
- **Traits**: *Defender.*
- **Rules Text**:
  > Cloak loses each [acceleration] icon.
  > [star] If Cloak is in play, Dagger takes -1 consequential damage after she uses a basic power.
- **Flavor**: *"I'll be the light in your dark, Ty."*
- **Image Asset**: `assets/card-art/bundles/cards/60021.png` (710×1030 px, 120.8 KB)

### [60022] Ghost Rider — *Johnny Blaze*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Midnight Sun.*
- **Rules Text**:
  > [star] **Interrupt**: When Ghost Rider attacks an enemy, spend a [energy] resource ([energy] [energy] resources instead if that enemy is the villain) → confuse that enemy.
- **Flavor**: *"My penance stare reveals all of your past sins!"*
- **Image Asset**: `assets/card-art/bundles/cards/60022.png` (710×1030 px, 145.0 KB)

### [60023] Know Your Enemy
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Cost**: 1 [star], **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > [star] Discount 1 ([[Martial Artist]]).
  > **Hero Action** *(thwart)*: Remove 1 threat from a scheme. Remove 1 threat from a scheme.
- **Flavor**: *"I don't need to see you to know your next move." —Iron Fist*
- **Image Asset**: `assets/card-art/bundles/cards/60023.png` (710×1030 px, 131.0 KB)

### [60024] De-escalation
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 24
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 4, **Resources**: [physical]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Remove an acceleration token from play.
- **Flavor**: *"I can see my house from here!" —Civilian*
- **Image Asset**: `assets/card-art/bundles/cards/60024.png` (1030×710 px, 122.5 KB)

### [60025] Chance Encounter
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to a side scheme. Max 1 per scheme.
  > **Interrupt:** When attached side scheme is defeated, search your deck and discard pile for an ally and add it to your hand. Shuffle your deck.

### [60026] Legal Trouble
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Cost**: 1 [star], **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > [star] Discount 1 ([[Attorney]] or [[Police]]).
  > Attach to a minion. Max 1 per minion.
  > Attached minion gets -2 SCH.
- **Flavor**: *"You got a permit for that?" —Police officer*
- **Image Asset**: `assets/card-art/bundles/cards/60026.png` (710×1030 px, 141.8 KB)

### [60027] Move in Shadow
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Cost**: 2 [star], **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > [star] Discount 1 ([[Martial Artist]] or [[Spy]]).
  > Temporary. Max 1 per player.
  > **Response** *(thwart)*: After you play a card *(including this one)*, remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/60027.png` (710×1030 px, 138.1 KB)

### [60028] Stealth Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Response**: After you thwart and exactly defeat a side scheme, exhaust Stealth Training → stun an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/60028.png` (710×1030 px, 131.5 KB)


### Set: Basic

### [60029] Stick
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 29
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Martial Artist. Persona.*
- **Rules Text**:
  > **Interrupt**: When a friendly [[Martial Artist]] character uses a basic power, choose:
  > • Exhaust Stick → that character gets +1 to that basic power for this use.
  > • That character gets -1 to that basic power for this use. Ready Stick.
- **Image Asset**: `assets/card-art/bundles/cards/60029.png` (710×1030 px, 178.6 KB)

### [60030] Contingency Planning
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Max 1 per player.
  > You may play the upgrade tucked here as if it were in your hand.
  > **Action**: Choose 1 upgrade in your hand that can attach to a minion or side scheme. Tuck that upgrade under here (to a maximum of 1).
- **Image Asset**: `assets/card-art/bundles/cards/60030.png` (710×1030 px, 187.1 KB)

### [60031] Dance with the Devil
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 31
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Dance.*
- **Rules Text**:
  > Team-Up (Daredevil and Elektra). Max 1 per deck.
  > Attach to an enemy.
  > **Hero Action** *(attack)*: Discard this card → deal 3 damage to attached enemy.
- **Image Asset**: `assets/card-art/bundles/cards/60031.png` (710×1030 px, 103.1 KB)

### [60055] See No Evil, Hear No Evil
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 55
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > Team-Up (Daredevil and Echo). Max 1 per deck.
  > **Hero Action** *(attack/thwart)*: Choose 2 of the following (you may choose the same option twice):
  > • Deal 3 damage to an enemy.
  > • Remove 3 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/60055.png` (710×1030 px, 162.3 KB)

### [60056] Superpower Training
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 56
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 3 per hero, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for an identity-specific upgrade and put it into play. *(Shuffle.)*
- **Flavor**: *"Eat light daggers, you purple punk!" —Dagger*
- **Image Asset**: `assets/card-art/bundles/cards/60056.png` (1030×710 px, 140.4 KB)

### [60057] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 57
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/60057.png` (710×1030 px, 157.6 KB)

### [60058] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 58
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/60058.png` (710×1030 px, 178.3 KB)

### [60059] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 59
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/60059.png` (710×1030 px, 173.4 KB)


### Set: Daredevil Nemesis

### [60033] Bullseye
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Daredevil Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin.*
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Discard a [[Persona]] support you control.
  > • Bullseye attacks you *(even in alter-ego form)*.
- **Flavor**: *"In my hands, anything is a deadly weapon!"*
- **Image Asset**: `assets/card-art/bundles/cards/60033.png` (710×1030 px, 125.2 KB)

### [60034] Deadliest Man Alive
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil Nemesis (2/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Daredevil Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **Forced Interrupt**: When Bullseye attacks, give him a facedown boost card.
- **Flavor**: *"C'mon, Hornhead, let's give the people a show!" —Bullseye*
- **Image Asset**: `assets/card-art/bundles/cards/60034.png` (1030×710 px, 137.8 KB)

### [60035] Stolen Sai
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil Nemesis (3/5)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Daredevil Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to the enemy with the highest ATK.
  > [star] Attached character's attacks gain piercing.
  > **Hero Action**: Spend [physical] [physical] resources → choose to either attach this card to Elektra or discard it.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/60035.png` (710×1030 px, 153.5 KB)

### [60036] Eye on the Target
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Daredevil Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Daredevil Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Remove an ally or [[Persona]] support you control from the game.
  > • Bullseye attacks you *(even in alter-ego form)*. If he is not in play, find him and reveal him.
- **Flavor**: *"Catch!" —Bullseye*
- **Image Asset**: `assets/card-art/bundles/cards/60036.png` (710×1030 px, 87.2 KB)


### Set: Echo

### [60037a] Echo
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 9, **Hand Size**: 5
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > *Watch and Learn* — **Response**: After a player plays an aspect or basic event, tuck that event under here from that player's discard pile. Then, if there are more than 3 tucked cards here, discard all but 3 of those cards.
- **Image Asset**: `assets/card-art/bundles/cards/60037a.png` (710×1030 px, 168.6 KB)

### [60037b] Maya Lopez
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > *Practice Makes Perfect* — **Interrupt**: When you change to hero form, search your deck for an aspect or basic event and add it to your hand. *(Shuffle.)*
- **Flavor**: *Maya can recreate any physical movement she sees.*
- **Image Asset**: `assets/card-art/bundles/cards/60037b.png` (710×1030 px, 143.7 KB)

### [60039] Daredevil — *Matt Murdock*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Defender. Martial Artist.*
- **Rules Text**:
  > [star] **Response**: After Daredevil uses a basic power, reduce the cost of the next event you play this round by 1.
- **Flavor**: *"Follow my lead."*
- **Image Asset**: `assets/card-art/bundles/cards/60039.png` (710×1030 px, 133.0 KB)

### [60040a] Photographic Reflexes
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (2–3/15, Qty: 2)
- **Stats**: **Cost**: -1, **Resources**: [energy]
- **Rules Text**:
  > [star] If you are in hero form, you can discard Photographic Reflexes from your hand to play an event tucked under Echo as if it were in your hand. Reduce the cost to play that event by 2. You cannot trigger Echo's *"Watch and Learn"* ability for that event.
- **Image Asset**: `assets/card-art/bundles/cards/60040a.png` (710×1030 px, 141.4 KB)

### [60040b] Photographic Reflexes
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (4–5/15, Qty: 2)
- **Stats**: **Cost**: -1, **Resources**: [mental]
- **Rules Text**:
  > [star] If you are in hero form, you can discard Photographic Reflexes from your hand to play an event tucked under Echo as if it were in your hand. Reduce the cost to play that event by 2. You cannot trigger Echo's *"Watch and Learn"* ability for that event.
- **Image Asset**: `assets/card-art/bundles/cards/60040b.png` (710×1030 px, 140.3 KB)

### [60040c] Photographic Reflexes
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (6–7/15, Qty: 2)
- **Stats**: **Cost**: -1, **Resources**: [physical]
- **Rules Text**:
  > [star] If you are in hero form, you can discard Photographic Reflexes from your hand to play an event tucked under Echo as if it were in your hand. Reduce the cost to play that event by 2. You cannot trigger Echo's *"Watch and Learn"* ability for that event.
- **Image Asset**: `assets/card-art/bundles/cards/60040c.png` (710×1030 px, 102.7 KB)

### [60041] Study the Tape
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (8–9/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Action**: Search any player's discard pile for 1 aspect event, 1 basic event, or 1 copy of Photographic Reflexes and add that card to your hand.
- **Flavor**: *"I watch tape after tape to train for a fight." —Echo*
- **Image Asset**: `assets/card-art/bundles/cards/60041.png` (710×1030 px, 153.3 KB)

### [60042] The Rez
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust The Rez → heal X damage from Maya Lopez, where X is the highest cost among cards tucked under her.
- **Flavor**: *The Rez is not a real reservation or Native nation, but a place for all tribes.*
- **Image Asset**: `assets/card-art/bundles/cards/60042.png` (710×1030 px, 183.0 KB)

### [60043] American Sign Language
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (11/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Resource**: Exhaust this card → generate a [wild] resource for an event being played by any player.
- **Flavor**: *<Need help?>* —Echo
*Translated from ASL.*
- **Image Asset**: `assets/card-art/bundles/cards/60043.png` (710×1030 px, 177.2 KB)

### [60044] Choreography
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (12/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Action**: Exhaust this card → shuffle 1 aspect or basic event from your discard pile into your deck. If you are in alter-ego form, draw 1 card.
- **Flavor**: *Maya uses her physical gifts to express herself in dance.*
- **Image Asset**: `assets/card-art/bundles/cards/60044.png` (710×1030 px, 98.1 KB)

### [60045] Echo's Katana
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Response** *(attack)*: After you play an event, exhaust Echo's Katana → deal damage to an enemy equal to that event's printed cost. This attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/60045.png` (710×1030 px, 162.1 KB)

### [60046] Improvisation
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (14/15)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Response**: After you play an event, if it has the following traits:
  > • [[Attack]] — heal 1 damage from Echo.
  > • [[Defense]] — remove 1 threat from a scheme.
  > • [[Thwart]] — deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/60046.png` (710×1030 px, 162.4 KB)

### [60047] Muscle Memory
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (15/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action**: Exhaust this card → add an event tucked under Echo to your hand.
- **Flavor**: *"I absorb an arsenal of actions, so when I need to, I can perform them with the same precision." —Echo*
- **Image Asset**: `assets/card-art/bundles/cards/60047.png` (710×1030 px, 95.4 KB)

### [60060] Raised by the Kingpin
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Echo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Maya Lopez player.***
  > You cannot deal damage to Kingpin.
  > **When Revealed**: Find Kingpin and put him into play engaged with you.
  > **Response**: After you thwart, place that threat here. If there is 4 or more threat here, remove this card from the game.
- **Flavor**: *Allie Preswick*
- **Image Asset**: `assets/card-art/bundles/cards/60060.png` (710×1030 px, 166.1 KB)


### Set: Protection

### [60038] Innate Reflexes
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 38
- **Stats**: **Cost**: 1
- **Traits**: *Condition.*
- **Rules Text**:
  > Starting. *(You may add this card to your hand before drawing your starting hand.)*
  > Your hero gets +1 DEF.
- **Flavor**: *KTINK!*
- **Image Asset**: `assets/card-art/bundles/cards/60038.png` (710×1030 px, 121.9 KB)

### [60048] Army of One
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 48
- **Stats**: **Cost**: 1 [star], **Resources**: [energy]
- **Rules Text**:
  > [star] Increase the cost to play this card by 1 for each ally you control.
  > **Hero Action**: Ready your hero.
- **Flavor**: *"Two versus one is not a fair fight...for you." —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/60048.png` (710×1030 px, 139.2 KB)

### [60049] Get Their Attention
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 49
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Defense. Thwart.*
- **Rules Text**:
  > **Hero Interrupt** *(defense/thwart)*: When an enemy initiates an attack, remove 3 threat from a scheme.
- **Flavor**: *"I think we made 'em mad."
"What do you mean 'we'?"
—Rocket Raccoon and Gamora*
- **Image Asset**: `assets/card-art/bundles/cards/60049.png` (710×1030 px, 167.2 KB)

### [60050] In Harm's Way
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Cost**: 3 [star], **Resources**: [physical]
- **Traits**: *Attack. Thwart.*
- **Rules Text**:
  > [star] Increase the cost to play this card by 1 for each ally you control.
  > **Hero Action** *(attack/thwart)*: Deal X damage to an enemy and remove X threat from a scheme, where X is your DEF.
- **Image Asset**: `assets/card-art/bundles/cards/60050.png` (710×1030 px, 155.4 KB)

### [60051] Powerful Punch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(attack/defense)*: When an enemy initiates an attack, deal 4 damage to that enemy.
- **Flavor**: *"That was my favorite shirt!" —Luke Cage*
- **Image Asset**: `assets/card-art/bundles/cards/60051.png` (710×1030 px, 148.2 KB)

### [60052] The Best Offense...
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Temporary.
  > Your hero gets +1 DEF.
  > Use your DEF in place of your THW and ATK. *(Ignore any modifiers to your THW and ATK.)*
- **Image Asset**: `assets/card-art/bundles/cards/60052.png` (710×1030 px, 155.7 KB)

### [60053] Ronin
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 53
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Title.*
- **Rules Text**:
  > While you do not control any allies, your hero gets +1 DEF and gains retaliate 1.
- **Flavor**: *"I am Ronin, the samurai with no master." —Ronin*
- **Image Asset**: `assets/card-art/bundles/cards/60053.png` (710×1030 px, 147.4 KB)

### [60054] Stand Alone
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Pack Position: 54
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Interrupt**: When an enemy attacks you *(before any defender is declared)*, if you do not control any allies, exhaust Stand Alone → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/60054.png` (710×1030 px, 112.6 KB)


### Set: Echo Nemesis

### [60061] Kingpin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Echo Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Kingpin would attack the Maya Lopez player, he schemes instead.
  > *(Echo's nemesis minion.)*
- **Flavor**: *"In my own way, I grew to care for you, Maya. I loved you like a daughter. I still do."*
- **Image Asset**: `assets/card-art/bundles/cards/60061.png` (710×1030 px, 143.5 KB)

### [60062] Master Manipulator
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Echo Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Kingpin cannot take damage.
  > **When Revealed**: Find Kingpin and put him into play engaged with you.
  >
  > ---
  >
  > [star] **Boost**: If Kingpin is in play, reveal this scheme.
- **Flavor**: *"If you lay a hand on me, you will regret it." —Kingpin*
- **Image Asset**: `assets/card-art/bundles/cards/60062.png` (1030×710 px, 139.6 KB)

### [60063] Kingpin's Henchman
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Echo Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Guard.
  > Kingpin cannot take damage.
- **Flavor**: *"Mr. Fisk would like a word wit' yous."*
- **Image Asset**: `assets/card-art/bundles/cards/60063.png` (710×1030 px, 100.8 KB)

### [60064] Pawn of the Kingpin
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Echo Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Echo Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: If Kingpin is in play, he schemes. Otherwise, this card gains surge.
  > **When Revealed (Hero)**: Deal damage to a hero equal to your hero's ATK.
- **Flavor**: *Kingpin convinced Echo that it was Daredevil, not Kingpin, who killed her father.*
- **Image Asset**: `assets/card-art/bundles/cards/60064.png` (710×1030 px, 99.1 KB)


### Set: Bullseye

### [60065] Bullseye
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 0 [star], **ATK**: 1 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Underling.*
- **Rules Text**:
  > **When Revealed**: Set aside Adamantium-Laced Spine (68A).
  > [star] **Forced Interrupt**: When Bullseye activates, each of his boost cards gains [boost]. If this activation is an attack, it gains ranged.

### [60066] Bullseye
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1 [star], **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Underling.*
- **Rules Text**:
  > **When Revealed**: Find Adamantium-Laced Spine and attach it to Bullseye.
  > [star] **Forced Interrupt**: When Bullseye activates, each of his boost cards gains [boost]. If this activation is an attack, it gains ranged.

### [60067] Bullseye
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 1 [star], **ATK**: 3 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Underling.*
- **Rules Text**:
  > **When Revealed**: Find Deranged Bloodlust and reveal it.
  > [star] **Forced Interrupt**: When Bullseye activates, each of his boost cards gains [boost]. If this activation is an attack, it gains ranged.

### [60068a] Adamantium-Laced Spine
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (4/14)
- **Properties**: Unique, Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Permanent.
  > **Forced Interrupt**: When Bullseye would take damage, prevent all but 3 of that damage. Place the prevented damage here. Then, if there is 6 or more damage here, flip this card.

### [60068b] Damaged Spine
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (4/14)
- **Properties**: Unique, Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Permanent.
  > [star] **Forced Response**: After Bullseye schemes, remove 3 damage from here. Then, if there is no damage here, flip this card.

### [60069] Raise the Stakes
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (5/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Bullseye.
  > [star] **Forced Interrupt**: When Bullseye attacks, give him 1 additional boost card for this attack. If this attack defeats a friendly character, remove them and this card from the game. Otherwise, shuffle this card into the encounter deck.

### [60070] Deadly Sai
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (6/14)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Bullseye.
  > [star] Bullseye's attacks lose ranged and gain piercing.
  > **Hero Response**: After your hero defends against an attack from Bullseye, spend 2 different resources → discard this card.

### [60071] Incessant Pursuit
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (7–9/14, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to an ally without Incessant Pursuit attached. Otherwise, this card gains surge.
  > **Forced Interrupt**: When the villain would attack you, it attacks attached ally instead and the attack gains overkill. If this attack defeats attached ally, remove them from the game.

### [60072] Lady Bullseye
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (10/14)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Hand.*
- **Rules Text**:
  > Villainous. *(When this minion activates, give it a boost card.)*
  > [star] **Forced Interrupt**: When resolving boost cards during Lady Bullseye's attack, if that attack is undefended, give her 1 additional boost card for this attack.

### [60073] Deranged Bloodlust
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (11/14)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Place additional threat here equal to Bullseye's stage number.
  >
  > ---
  >
  > [star] **Boost**: After this activation, reveal this card.

### [60074] Everything is a Weapon
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (12/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Take 2 indirect damage.
  > **When Revealed (Hero)**: Choose: Either Bullseye activates against you, or remove an ally you control from the game.
  >
  > ---
  >
  > [star] **Boost**: If Bullseye is attacking, give him an additional boost card and this attack gains piercing.

### [60075] Unerring Desire
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Bullseye (13–14/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Bullseye Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose to either give this card to the villain as a facedown boost card, or remove a [[Persona]] support you control from the game.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains overkill.


### Set: Electro

### [60076] Electro
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1 [star], **ATK**: 1, **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Underling.*
- **Rules Text**:
  > **When Revealed**: Find Electric Charge, attach it to Electro, and place 2 [per_hero] charge counters on it.
  > [star] **Forced Response**: After Electro schemes, place 1 charge counter on Electric Charge.

### [60077] Electro
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1 [star], **ATK**: 2, **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Underling.*
- **Rules Text**:
  > **When Revealed**: Find Electric Charge, attach it to Electro, and place 2 [per_hero] charge counters on it.
  > [star] **Forced Response**: After Electro schemes, place 1 charge counter on Electric Charge.

### [60078] Electro
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2 [star], **ATK**: 2, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Criminal. Underling.*
- **Rules Text**:
  > **When Revealed**: Place 3 [per_hero] charge counters on Electric Charge.
  > [star] **Forced Response**: After Electro schemes, place 2 charge counters on Electric Charge.

### [60079] Electric Charge
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (4/14)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Permanent.
  > [star] **Forced Interrupt**: When Electro attacks, remove 1 charge counter from here → give Electro an additional boost card for this attack. This attack gains overkill.
  > **Hero Action**: Spend a [energy] resource or 2 resources of any type → remove 1 charge counter from here.

### [60080] Drained of Power
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (5/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Uses (3 drain counters).
  > **When Revealed**: Attach to your identity and exhaust each upgrade you control.
  > **Forced Interrupt**: When an upgrade you control would ready, you may spend a [energy] resource or 2 resources of any type. If you do, remove 1 drain counter from here *(and ready that upgrade)*. Otherwise, that upgrade does not ready.

### [60081] Whiplash
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (6/14)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **Forced Interrupt**: When Whiplash is attacked, remove 1 charge counter from Electric Charge → discard the top card of the encounter deck. Deal 1 damage to the attacker for each boost icon ([boost]) on the discarded card.
- **Flavor**: *"Shocked to see me?"*

### [60082] Charging Up
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (7–8/14, Qty: 2)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Defeated**: Place 3 charge counters on Electric Charge.
- **Flavor**: *Electro is drawing electricity from the power grid. You need to cut off her supply!*

### [60083] Chain Lightning
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (9–10/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: For each character you control, choose:
  > • Exhaust that character.
  > • Deal 1 damage to that character (3 damage instead if there are any charge counters on Electric Charge). Remove 1 charge counter from Electric Charge.

### [60084] Energy Overload
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (11–12/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If you have no cards with a printed [energy] resource in your hand, this card gains surge. Otherwise, for each card with a printed [energy] resource in your hand, choose:
  > • Discard that card.
  > • Stun a character you control.

### [60085] Shocking Revelation
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Electro (13–14/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Electro Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top card of your deck for each card you control. For each card with a printed [energy] resource discarded this way, choose:
  > • Take 1 indirect damage.
  > • Place 1 charge counter on Electric Charge.


### Set: Hammerhead

### [60086] Hammerhead
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Maggia. Underling.*
- **Rules Text**:
  > [star] **Forced Response**: After Hammerhead attacks and damages a character, stun that character. If that character was already stunned, deal 1 damage to them.
- **Flavor**: *"That's one tough noggin!"—Luke Cage*

### [60087] Hammerhead
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Maggia. Underling.*
- **Rules Text**:
  > Toughness. Retaliate 1.
  > [star] **Forced Response**: After Hammerhead attacks and damages a character, stun that character. If that character was already stunned, deal 1 damage to them.
- **Flavor**: *"That's one tough noggin!"—Luke Cage*

### [60088] Hammerhead
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 3 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Maggia. Underling.*
- **Rules Text**:
  > Toughness. Retaliate 2.
  > [star] **Forced Response**: After Hammerhead attacks and damages a character, stun that character. If that character was already stunned, deal 2 damage to them.
- **Flavor**: *"That's one tough noggin!"—Luke Cage*

### [60089] Energy Gatling Gun
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (4/14)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to Hammerhead.
  > **Forced Response**: After Hammerhead attacks, if the attacked character was not defeated, discard this card → Hammerhead attacks that character again.
- **Flavor**: *"Use the stun setting so's I can talk to 'em after."—Hammerhead*

### [60090] Hardheaded
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (5/14)
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Hammerhead.
  > Hammerhead gains stalwart.
  > **Hero Action**: Spend [energy] [mental] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy a tough status card.

### [60091] Chameleon
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (6/14)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Maggia.*
- **Rules Text**:
  > [star] Chameleon gets +X SCH, where X is the highest THW value among characters in play.
  > **When Revealed**: Chameleon schemes.
- **Flavor**: *"I am invisible because I am the same thing you look at every dreadful, dull day."*

### [60092] Maggia Enforcers
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (7–8/14, Qty: 2)
- **Stats**: **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Maggia.*
- **Rules Text**:
  > Guard.
  > [star] Maggia Enforcers's SCH is equal to the number of [[Maggia]] enemies in play *(including this one)*.
- **Flavor**: *"Before I ran my own gang I was a Maggia enforcer."—Hammerhead*

### [60093] Maggia Underboss
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (9–10/14, Qty: 2)
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Maggia.*
- **Rules Text**:
  > Villainous.
  > [star] **Forced Interrupt**: When Maggia Underboss activates against you, if you are stunned, give it an additional boost card for this activation.
- **Flavor**: *"Where others see weakness, I see opportunity."*

### [60094] Consolidate Power
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (11/14)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After a minion is defeated, give it to the villain as a facedown boost card.
- **Flavor**: *"Welcome to the big time."—Hammerhead*

### [60095] Power Struggle
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (12/14)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Defeat the minion with the fewest remaining hit points in play. Discard cards from the encounter deck until you discard a minion. Reveal that minion.

### [60096] "Head First!"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Hammerhead (13–14/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hammerhead Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: Hammerhead attacks you. If you are stunned, Hammerhead gets +2 ATK for this attack and this attack gains overkill.
- **Flavor**: *"Know how I got to the top?"—Hammerhead*


### Set: Purple Man

### [60097] Purple Man
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (1/15)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1 [star], **ATK**: 0 [star], **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic. Underling.*
- **Rules Text**:
  > Each [[Influenced]] minion gains guard.
  > Each boost card from the Purple Man encounter set gains: "[star] **Boost**: After this activation, deal this card to yourself as a facedown encounter card."

### [60098] Purple Man
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (2/15)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 1 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic. Underling.*
- **Rules Text**:
  > Each [[Influenced]] minion gains guard and villainous.
  > Each boost card from the Purple Man encounter set gains: "[star] **Boost**: After this activation, deal this card to yourself as a facedown encounter card."

### [60099] Purple Man
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (3/15)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3 [star], **ATK**: 1 [star], **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic. Underling.*
- **Rules Text**:
  > Each [[Influenced]] minion gains guard, patrol, and villainous.
  > Each boost card from the Purple Man encounter set gains: "[star] **Boost**: After this activation, deal this card to yourself as a facedown encounter card."

### [60100] Converted
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (4/15)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Treat attached ally as an [[Influenced]] minion with a blank text box. Attached minion's SCH is equal to its base THW and it does not take consequential damage.
  > **When Revealed**: Attach to the highest-cost ally you control and engage it. Otherwise, this card gains surge.

### [60101] Firefighter
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (5–6/15, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Civilian. Influenced.*
- **Rules Text**:
  > Vulnerable. *(Discard this character if it is stunned or confused.)*
  > [star] Firefighter's attacks gain piercing.
  > **When Defeated**: Discard the highest-cost support or upgrade from play.

### [60102] Judge
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (7/15)
- **Stats**: **SCH**: 3, **ATK**: 0, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Civilian. Influenced.*
- **Rules Text**:
  > Vulnerable. *(Discard this character if it is stunned or confused.)*
  > **When Defeated**: Place 3 threat on the main scheme.
- **Flavor**: *"Say one more word about Mr. Killgrave, and I'll hold you in contempt!"*

### [60103] Security Guard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (8/15)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Civilian. Influenced.*
- **Rules Text**:
  > Patrol. Vulnerable. *(Discard this character if it is stunned or confused.)*
  > **When Defeated**: Discard the ally with the highest ATK *(among allies)* in play.
- **Flavor**: *"Suspect is in custody."*

### [60104] Skater Punk
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (9/15)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Civilian. Influenced.*
- **Rules Text**:
  > Vulnerable. *(Discard this character if it is stunned or confused.)*
  > **When Defeated**: Deal 3 damage to the defeating player's identity.
- **Flavor**: *"I'm actually more into post-punk."*

### [60105] "Fight."
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (10/15)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Uses (3 command counters).
  > **Forced Action**: Exhaust this card and remove 1 command counter from it → deal 2 damage to a hero or ally.
- **Flavor**: *"Aren't love and hate just two sides of the same coin?" —Purple Man*

### [60106] "Protect."
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (11/15)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Uses (3 command counters).
  > **Forced Action**: Exhaust this card and remove 1 command counter from it → give the villain a tough status card.
- **Flavor**: *"You are to escort me to...everywhere I go." —Purple Man*

### [60107] "Serve."
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (12/15)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Uses (3 command counters).
  > **Forced Action**: Exhaust this card and remove 1 command counter from it → place 2 threat on the main scheme.
- **Flavor**: *"Clear your schedule. I am now your top priority." —Purple Man*

### [60108] Power of Suggestion
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (13/15)
- **Stats**: **Base Threat**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > [star] Hinder 3 [per_hero].
  > Each minion gains the [[Influenced]] trait.
- **Flavor**: *"Feel my will conquering yours." —Purple Man*

### [60109] Sway the Masses
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Purple Man (14–15/15, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Purple Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose an [[Influenced]] minion from the encounter discard pile and reveal it. Otherwise, this card gains surge.
- **Flavor**: *Nothing is more dangerous than a persuasive man with a loudspeaker.*


### Set: Typhoid Mary

### [60110a] Typhoid Mary
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (1/15)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 10 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Psionic. Underling.*
- **Rules Text**:
  > **Forced Interrupt**: When Typhoid Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 10 [per_hero].
- **Flavor**: *"It's time I tell my story. My life. The way I want to tell it."*

### [60110b] Bloody Mary
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (1/15)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 10 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Psionic. Underling.*
- **Rules Text**:
  > **Forced Interrupt**: When Bloody Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 10 [per_hero].
- **Flavor**: *"I'll never let anyone hurt us again."*

### [60111a] Typhoid Mary
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (2/15)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 3, **ATK**: 1, **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Psionic. Underling.*
- **Rules Text**:
  > Toughness.
  > **Forced Interrupt**: When Typhoid Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 13 [per_hero].
- **Flavor**: *"It's time I tell my story. My life. The way I want to tell it."*

### [60111b] Bloody Mary
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (2/15)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Psionic. Underling.*
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to each identity.
  > **Forced Interrupt**: When Bloody Mary would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points to 13 [per_hero].
- **Flavor**: *"I'll never let anyone hurt us again."*

### [60112] Disturbed Psyche
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (3/15)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Setup.
  > **Setup**: Put the villain into play on a random side *(and reveal it)*.
  > **Forced Interrupt**: When the villain phase ends, flip the villain.
  > **If there are 3 or more tokens here, the players win the game!**

### [60113a] Establish Trust
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (4/15)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 8 [star] per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent. Setup.
  > [star] In expert mode, this card gains hinder 3 [per_hero].
  > **When Defeated**: Place 1 threat token on Disturbed Psyche. Flip this card.
- **Flavor**: *"Mary, it's me. I don't want to fight you." —Matt Murdock*

### [60113b] Mary Walker
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (4/15)
- **Properties**: Unique, Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Traits**: *Persona.*
- **Rules Text**:
  > Attach to the villain. Permanent.
  > [star] Attached villain cannot activate.
  > **Forced Response**: After the villain takes damage or the round ends, deal each player 1 facedown encounter card and flip this card.
- **Flavor**: *"One of us is tender, one of us is not, and one of us takes vengeance."*

### [60114] Telekinesis
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (5/15)
- **Stats**: **SCH**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic. Superpower.*
- **Rules Text**:
  > Attach to the villain.
  > **Hero Action**: Spend [mental] [mental] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: If Typhoid Mary is activating, take 3 indirect damage. Exhaust each character damaged this way.

### [60115] Psionic Slash
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (6–7/15, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If the Mary Walker attachment is in play, flip it and reveal Establish Trust. The villain schemes.
  >
  > ---
  >
  > [star] **Boost**: If Typhoid Mary is activating, deal 3 damage to an ally you control.

### [60116] Psi Nova
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (8/15)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to each character you control. You are stunned.
  >
  > ---
  >
  > [star] **Boost**: If Typhoid Mary is activating, you are stunned.
- **Flavor**: *"ENOUGH!" —Typhoid Mary*

### [60117] Assembled Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (9/15)
- **Stats**: **ATK**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to the villain.
  > **Forced Interrupt**: When the villain would take any amount of damage, place it here instead. Then, if there is 5 or more damage here (8 or more in expert mode), discard this attachment.
  >
  > ---
  >
  > [star] **Boost**: If Bloody Mary is activating, you are confused.

### [60118] Hail of Blades
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (10–11/15, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If the Mary Walker attachment is in play, flip it and reveal Establish Trust. The villain attacks you *(even if you are in alter-ego form)*.
  >
  > ---
  >
  > [star] **Boost**: If Bloody Mary is activating, take 2 damage.

### [60119] Scavenged Bulwark
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (12/15)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Give the villain a tough status card.
  >
  > ---
  >
  > [star] **Boost**: If Bloody Mary is activating, give her a tough status card.
- **Flavor**: *"If we steel ourselves with as much armor as possible...they can't touch us." —Bloody Mary*

### [60120] Hand Lookout
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Typhoid Mary (13–15/15, Qty: 3)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Typhoid Mary Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hand. Ninja.*
- **Rules Text**:
  > Guard. Toughness.
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy an additional boost card.
- **Flavor**: *"Let's all keep an eye out for each other. It's the only way to survive in this city." —Typhoid Mary*


### Set: Art Museum Heist

### [60121a] Art Museum Heist
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Art Museum Heist (1/9)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Art Museum Heist Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen [[Underling]] villain *(see rulebook p. 5)*. Chosen villain's set, Art Museum Heist set, and Standard set. Two modular encounter sets *(Cops and The Owl)*.
  > **Setup**: Find this encounter set's 4 [[Art]] attachments and attach 1 at random to the villain. Shuffle the other 3 into the encounter deck.

### [60121b] Art Museum Heist
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Art Museum Heist (1/9)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +-1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Art Museum Heist Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] X is 1 more than the number of [[Art]] attachments on the villain.
  > **Forced Response**: After an enemy makes an undefended attack against an identity, attach 1 [[Art]] attachment on that identity to the villain.
  > **If this stage is completed, the players lose the game.**

### [60122] Impossible Object
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Art Museum Heist (2/9)
- **Properties**: Unique
- **Stats**: **THW**: 1, **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Art Museum Heist Set Icon (printed bottom-right next to deck number)
- **Traits**: *Art.*
- **Rules Text**:
  > Surge.
  > Attach to the villain.
  > **Forced Response**: After this card attaches to a character, confuse that character.
  > **Hero Action**: Spend a [mental] resource or exhaust your hero → attach this card to your hero.

### [60123] Inspiring Pottery
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Art Museum Heist (3/9)
- **Properties**: Unique
- **Stats**: **THW**: 1, **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Art Museum Heist Set Icon (printed bottom-right next to deck number)
- **Traits**: *Art.*
- **Rules Text**:
  > Surge.
  > Attach to the villain.
  > Attached character gains stalwart.
  > **Hero Action**: Spend a [wild] resource or exhaust your hero → attach this card to your hero.

### [60124] Replica Shield
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Art Museum Heist (4/9)
- **Properties**: Unique
- **Stats**: **THW**: 1, **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Art Museum Heist Set Icon (printed bottom-right next to deck number)
- **Traits**: *Art.*
- **Rules Text**:
  > Surge.
  > Attach to the villain.
  > **Forced Response**: After this card attaches to a character, give that character a tough status card.
  > **Hero Action**: Spend a [physical] resource or exhaust your hero → attach this card to your hero.

### [60125] Stunning Landscape
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Art Museum Heist (5/9)
- **Properties**: Unique
- **Stats**: **THW**: 1, **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Art Museum Heist Set Icon (printed bottom-right next to deck number)
- **Traits**: *Art.*
- **Rules Text**:
  > Surge.
  > Attach to the villain.
  > **Forced Response**: After this card attaches to a character, stun that character.
  > **Hero Action**: Spend a [energy] resource or exhaust your hero → attach this card to your hero.

### [60126] Art Thief
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Art Museum Heist (6–7/9, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Art Museum Heist Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thief.*
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for an [[Art]] attachment and attach it to the villain. If you cannot, move an [[Art]] attachment from an identity to the villain.
  >
  > ---
  >
  > [star] **Boost**: Move an [[Art]] attachment from an identity to the villain.

### [60127] Tug of War
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Art Museum Heist (8–9/9, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Art Museum Heist Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You may spend [physical][physical][physical] resources to move an [[Art]] attachment from the villain to your identity. Otherwise, move an [[Art]] attachment from an identity to the villain and this card gains surge.


### Set: The Getaway

### [60128a] The Getaway
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Getaway (1/8)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Getaway Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen [[Underling]] villain *(see rulebook p. 5)*. Chosen villain's set, The Getaway set, and Standard set. Two modular encounter sets *(Cops and Drive)*.
  > **Setup**: Place 1 speed counter here (2 counters instead in expert mode). Attach the Out Front attachment (129A) to the villain.

### [60128b] The Getaway
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Getaway (1/8)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Getaway Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When the round ends, if there is threat here, do each of the following:
  > 1. Place 1 speed counter here.
  > 2. If Alongside is in play, flip it to Out Front. Otherwise, place 1 additional speed counter here.
  > **If this stage is completed, the players lose the game.**

### [60129a] Out Front
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Getaway (2/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: The Getaway Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent. Attach to the villain.
  > If there is no threat on the main scheme, flip this card.
  > [star] Attached villain's attacks gain ranged.
  > **Forced Interrupt**: When the villain would be dealt any amount of damage, remove that amount of threat from the main scheme instead *(ignoring crisis ([crisis]) icons)*.

### [60129b] Alongside
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Getaway (2/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: The Getaway Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent.
  > **When Revealed**: Each player takes 1 indirect damage. The villain takes 2 [per_hero] damage.
- **Flavor**: *New York City traffic is brutal.*

### [60130] Escort Vehicle
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Getaway (3/8)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Getaway Set Icon (printed bottom-right next to deck number)
- **Traits**: *Vehicle.*
- **Rules Text**:
  > Guard. Patrol.
  > If the number of speed counters on the main scheme is at least:
  > • 3 — This minion gains toughness.
  > • 6 — This minion also gains quickstrike.
  > • 9 — This minion also gains surge.

### [60131] Jackknifed Tanker Truck
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Getaway (4/8)
- **Stats**: **Base Threat**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Getaway Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > [star] Hinder 1 [per_hero].
  > The villain cannot be dealt damage.
- **Flavor**: *"Eat your heart out, Johnny Blaze!" –Echo*

### [60132] Burning Rubber
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Getaway (5–6/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Getaway Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: For each speed counter on the main scheme, choose:
  > • Spend 1 resource of any type.
  > • Place 1 threat on the main scheme.
- **Flavor**: *Skreeeeeee!*

### [60133] Pedestrians
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Getaway (7–8/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Getaway Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: For each speed counter on the main scheme, choose:
  > • Exhaust a character you control.
  > • Take 1 indirect damage.
- **Flavor**: *"Hope you've got your seatbelts on!" –Iron Fist*


### Set: Protection Racket

### [60134a] Protection Racket
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen [[Underling]] villain *(see rulebook p. 5)*. Chosen villain's set, Protection Racket set, and Standard set. Two modular encounter sets *(Disasters and Tracksuit Mafia)*.
  > **Setup**: Each player chooses a single Protection Racket main scheme (at random in expert mode), places it in their play area, and flips it to its 1B side. Set each unused main scheme aside, out of play.

### [60134b] Battle in the Bodega
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (1/9)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 10, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After a character in this play area is attacked, deal 1 damage to the attacker and place 1 threat here. (Limit once per phase in standard mode.)
  > **If any main scheme is completed or any player is eliminated, the players lose the game.**

### [60135a] Protection Racket
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen [[Underling]] villain *(see rulebook p. 5)*. Chosen villain's set, Protection Racket set, and Standard set. Two modular encounter sets *(Disasters and Tracksuit Mafia)*.
  > **Setup**: Each player chooses a single Protection Racket main scheme (at random in expert mode), places it in their play area, and flips it to its 1B side. Set each unused main scheme aside, out of play.

### [60135b] Bull in a China Shop
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (2/9)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 10, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When excess damage is dealt to an ally (in expert mode, an ally or a minion) in this play area, place an equal amount of threat on this scheme.
  > **If any main scheme is completed or any player is eliminated, the players lose the game.**

### [60136a] Protection Racket
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen [[Underling]] villain *(see rulebook p. 5)*. Chosen villain's set, Protection Racket set, and Standard set. Two modular encounter sets *(Disasters and Tracksuit Mafia)*.
  > **Setup**: Each player chooses a single Protection Racket main scheme (at random in expert mode), places it in their play area, and flips it to its 1B side. Set each unused main scheme aside, out of play.

### [60136b] Hung Out to Dry
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (3/9)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 10, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After a character enters play in this play area, deal 1 damage to it and place 1 threat here.
  > **If any main scheme is completed or any player is eliminated, the players lose the game.**
- **Flavor**: *"Calm down. It's on the gentle cycle."
–Jessica Jones*

### [60137a] Protection Racket
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen [[Underling]] villain *(see rulebook p. 5)*. Chosen villain's set, Protection Racket set, and Standard set. Two modular encounter sets *(Disasters and Tracksuit Mafia)*.
  > **Setup**: Each player chooses a single Protection Racket main scheme (at random in expert mode), places it in their play area, and flips it to its 1B side. Set each unused main scheme aside, out of play.

### [60137b] Pawn Shop Showdown
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (4/9)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 10, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Reduce the cost of the first upgrade played into this play area each round by 1.
  > **Forced Response**: After an attachment or upgrade enters play in this play area, place 1 threat here.
  > **If any main scheme is completed or any player is eliminated, the players lose the game.**

### [60138a] Protection Racket
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen [[Underling]] villain *(see rulebook p. 5)*. Chosen villain's set, Protection Racket set, and Standard set. Two modular encounter sets *(Disasters and Tracksuit Mafia)*.
  > **Setup**: Each player chooses a single Protection Racket main scheme (at random in expert mode), places it in their play area, and flips it to its 1B side. Set each unused main scheme aside, out of play.

### [60138b] A Slice of the Pizza Dough
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (5/9)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 10, **Escalation Threat**: +1/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After a character in this play area defeats another character or a side scheme *(in any play area)*, heal 1 damage from the defeating character and place 1 threat here.
  > **If any main scheme is completed or any player is eliminated, the players lose the game.**

### [60139] Shop Proprietor
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (6/9)
- **Stats**: **THW**: 1 (Consequential: 2), **ATK**: 1 (Consequential: 2), **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Traits**: *Civilian.*
- **Rules Text**:
  > **When Revealed**: Put Shop Proprietor into play under your control. This card gains surge.
  > **Forced Interrupt**: When this ally leaves play, place 4 threat on the main scheme in your play area.

### [60140] Man-Bull
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (7/9)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 4 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > [star] **Forced Response**: After Man-Bull attacks, place threat on the main scheme equal to the excess damage dealt by this attack.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, place threat on the main scheme equal to the excess damage dealt by this attack.

### [60141] Change of Venue
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Protection Racket (8–9/9, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Protection Racket Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Swap your main scheme with a random set-aside main scheme. Place the threat from the previous scheme on the new scheme.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.


### Set: The Raft Breakout

### [60142a] The Raft Breakout
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (1/9)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen [[Underling]] villain *(see rulebook p. 5)*. Chosen villain's set, The Raft Breakout set, and Standard set. Two modular encounter sets *(The Owl and Tombstone)*.
  > **Setup**: Attach Master Key to the villain. Each player discards cards from the encounter deck until they discard a [[Prisoner]] minion and reveal that minion.

### [60142b] The Raft Breakout
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (1/9)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 11 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each minion gains: "**When Defeated**: Remove 1 threat from the main scheme (2 threat instead if this minion has the [[Elite]] trait)."
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *"Go forth and wreak havoc!"
–Proxima Midnight*

### [60143] Master Key
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (2/9)
- **Properties**: Unique, Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to the villain.
  > Permanent.
  > [star] **Forced Response**: After the villain schemes against you, deal each of that activation's boost cards that is a minion to yourself as a facedown encounter card.
- **Flavor**: *>Security overridden.
>Door lock disengaged.*

### [60144] Absorbing Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (3/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite. Prisoner.*
- **Rules Text**:
  > Villainous.
  > [star] **Forced Interrupt**: When Absorbing Man attacks you, tuck the top card of your deck under him. Absorbing Man gets +1 ATK for this attack for each different resource type *([energy], [mental], [physical], and [wild])* on cards tucked under him.

### [60145] Baron Zemo
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (4/9)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Hydra. Prisoner.*
- **Rules Text**:
  > Villainous.
  > Treat each ally with threat on it as a [[Deceived]] minion with a blank text box. Its SCH is equal to its base THW and it does not take consequential damage.
  > **When Revealed**: Place 1 threat on an ally without threat on it. It engages its controller.

### [60146] Drang
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (5/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Traits**: *Badoon. Elite. Prisoner.*
- **Rules Text**:
  > Villainous.
  > [star] **Forced Response**: After Drang attacks you, place 1 barrage counter on him. Then, take 1 indirect damage for each barrage counter on Drang.
- **Flavor**: *"Ship, target my coordinates!"*

### [60147] Mysterio
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (6/9)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Elite. Prisoner.*
- **Rules Text**:
  > Villainous.
  > [star] **Forced Response**: After Mysterio attacks you, deal each of that activation's boost cards that is a treachery to yourself as a facedown encounter card.

### [60148] Proxima Midnight
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (7/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Elite. Prisoner.*
- **Rules Text**:
  > Villainous.
  > [star] **Forced Interrupt**: When Proxima Midnight attacks you, choose to either place 1 threat on the main scheme, or Proxima Midnight gets +2 ATK for this attack.

### [60149] Rhino
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (8/9)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite. Prisoner.*
- **Rules Text**:
  > Toughness. Villainous.
  > [star] Rhino's attacks gain overkill.
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy a tough status card.

### [60150] Imprisoned
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Raft Breakout (9/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: The Raft Breakout Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > You cannot thwart, attack, or change to alter-ego form.
  > **Hero Action**: Spend 3 resources of any type or exhaust characters you control with a total THW of 3 or more → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.


### Set: Stop the Presses!

### [60151a] Stop the Presses!
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Stop the Presses! (1/9)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stop the Presses! Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen [[Underling]] villain *(see rulebook p. 5)*. Chosen villain's set, Stop the Presses! set, and Standard set. Two modular encounter sets *(Tombstone and Tracksuit Mafia)*.
  > **Setup**: Put the Daily Bugle environment into play. Each player puts a random [[Daily Bugle]] support from this encounter set into play under their control. Remove each remaining [[Daily Bugle]] support from the game.

### [60151b] Stop the Presses!
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Stop the Presses! (1/9)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stop the Presses! Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After an enemy makes an undefended attack against you, choose:
  > • Place 2 threat here (3 threat instead in expert mode).
  > • Remove 1 stamina counter from a [[Daily Bugle]] support you control.
  > **If a [[Daily Bugle]] support leaves play or this stage is completed, the players lose the game.**

### [60152] Daily Bugle
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Stop the Presses! (2/9)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stop the Presses! Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust a [[Daily Bugle]] support you control → place 1 stamina counter on that support. *(Any player can do this.)*
- **Flavor**: *Under the ownership of J. Jonah Jameson, the Daily Bugle became one of the most-read newspapers in the United States.*

### [60153] Ben Urich
- **Type**: `Support`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Stop the Presses! (3/9)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Stop the Presses! Set Icon (printed bottom-right next to deck number)
- **Traits**: *Daily Bugle. Persona.*
- **Rules Text**:
  > Uses (3 stamina counters).
  > **Action**: Exhaust Ben Urich and remove 1 stamina counter from him → look at the top 2 cards of the encounter deck. You may discard 1 of those cards. *(Put the rest back in the same order.)*

### [60154] Betty Brant
- **Type**: `Support`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Stop the Presses! (4/9)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Stop the Presses! Set Icon (printed bottom-right next to deck number)
- **Traits**: *Daily Bugle. Persona.*
- **Rules Text**:
  > Uses (3 stamina counters).
  > **Interrupt**: When a boost card is turned faceup, exhaust Betty Brant and remove 1 stamina counter from her → cancel that card's boost icons and "**Boost**" ability. Give the activating enemy another boost card for this activation.

### [60155] J. Jonah Jameson
- **Type**: `Support`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Stop the Presses! (5/9)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Stop the Presses! Set Icon (printed bottom-right next to deck number)
- **Traits**: *Daily Bugle. Persona.*
- **Rules Text**:
  > Uses (3 stamina counters).
  > **Action**: Exhaust J. Jonah Jameson, remove 1 stamina counter from him, and deal yourself 1 facedown encounter card → draw 2 cards.

### [60156] Robbie Robertson
- **Type**: `Support`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Stop the Presses! (6/9)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Stop the Presses! Set Icon (printed bottom-right next to deck number)
- **Traits**: *Daily Bugle. Persona.*
- **Rules Text**:
  > Uses (3 stamina counters).
  > **Response**: After a player is dealt a facedown encounter card, exhaust Robbie Robertson and remove 1 stamina counter from him → look at that encounter card. You may discard it and deal that player another facedown encounter card.

### [60157] Exclusive Interview
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Stop the Presses! (7/9)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stop the Presses! Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [[Daily Bugle]] supports cannot ready.
  > **When Revealed**: Exhaust each [[Daily Bugle]] support.
- **Flavor**: *"I'd love for your audience to hear my side of the story. Now, where to begin...?"*

### [60158] Breaking News
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Stop the Presses! (8–9/9, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Stop the Presses! Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Exhaust a [[Daily Bugle]] support *(under any player's control)* and remove 1 stamina counter from it.
  > • Place 2 threat on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a [[Daily Bugle]] support *(under any player's control)*.


### Set: Kingpin

### [60159a] Kingpin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (1/22)
- **Properties**: Unique, Stage A1
- **Stats**: **SCH**: 2, **ATK**: 0 [star], **HP**: 25 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Stalwart.
  > Kingpin cannot be dealt damage or have upgrades attached. *(The players must garner Public Support to face him directly.)*
  > [star] **Forced Interrupt**: When Kingpin would attack you, he schemes instead.

### [60159b] Kingpin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (1/22)
- **Properties**: Unique, Stage A2
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 25 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Martial Artist.*
- **Rules Text**:
  > Steady.
  > [star] **Forced Interrupt**: When Kingpin activates against you, if you are not engaged with a minion, give Kingpin 1 additional boost card for this activation.

### [60160a] Kingpin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (2/22)
- **Properties**: Unique, Stage B1
- **Stats**: **SCH**: 3, **ATK**: 0 [star], **HP**: 28 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Stalwart.
  > Kingpin cannot be dealt damage or have upgrades attached. *(The players must garner Public Support to face him directly.)*
  > [star] **Forced Interrupt**: When Kingpin would attack you, he schemes instead.

### [60160b] Kingpin
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (2/22)
- **Properties**: Unique, Stage B2
- **Stats**: **SCH**: 3 [star], **ATK**: 3 [star], **HP**: 28 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Martial Artist.*
- **Rules Text**:
  > Steady.
  > [star] **Forced Interrupt**: When Kingpin activates against you, if you are not engaged with a minion, give Kingpin 1 additional boost card for this activation and this activation gains overkill if it is an attack.

### [60161a] The King's Gambit
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (3/22)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Kingpin (A1). *(Kingpin (B1) instead for expert mode.)* Kingpin encounter set. Two modular encounter sets *(Tombstone and Tracksuit Mafia)*.
  > **Setup**: Each player reveals their set-aside nemesis minion. Each player whose nemesis minion shares a title with a character in play instead removes their nemesis minion from the game, then finds an [[Underling]] minion that is not in play and reveals it.

### [60161b] The King's Gambit
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (3/22)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 3 per hero, **Target Threat**: 11 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Put Public Support into play, [[Low]] side faceup.
  > **Hero Action**: Remove 5 threat from here *(4 threat instead in expert mode)*. Shuffle the encounter discard pile into the encounter deck, then discard cards from the top of the encounter deck until a minion is discarded and reveal that minion.
  > **If this stage is completed, the players lose the game.**

### [60162a] Endgame
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (4/22)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player finds their nemesis minion and reveals it. Each player whose nemesis minion did not enter play this way finds an [[Underling]] minion that is not in play and reveals it. In expert mode, the first player finds and reveals the Organized Crime side scheme.
- **Flavor**: *"Enough games. I want these do-gooders dealt with. Permanently!" –Kingpin*

### [60162b] Endgame
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (4/22)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each minion gains guard.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *"You so-called heroes have been a thorn in all of our sides for far too long. Together we will destroy you and rule this city!" –Kingpin*

### [60163a] Public Support
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (5/22)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Low.*
- **Rules Text**:
  > **Forced Response**: After a minion is defeated, place 1 support counter here.
  > **Forced Interrupt**: When the villain phase begins, if there are at least 2 [per_hero]+2 support counters here, flip Kingpin and advance the main scheme to stage 2A. Then, flip this card.

### [60163b] Public Support
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (5/22)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *High.*
- **Rules Text**:
  > **Interrupt**: When an enemy would be given a facedown boost card, remove 1 [per_hero] support counters from here instead.
  > **Forced Response**: After a minion is defeated, place 1 support counter here.
- **Flavor**: *"So nice of them to show some gratitude! For once." –Jessica Jones*

### [60164] Bear Hug
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (6/22)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > If Kingpin has the [[Martial Artist]] trait, attach to your hero. Otherwise, this card gains surge.
  > Uses (3 grip counters).
  > You cannot change to alter-ego form.
  > **Forced Interrupt**: When you would thwart or attack, remove 1 grip counter from here instead.

### [60165] James Wesley
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (7/22)
- **Properties**: Unique
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Persona.*
- **Rules Text**:
  > **When Revealed**: Attach to Kingpin and give him a facedown boost card.
  > **Hero Action**: Discard a [[Thwart]] event from your hand → discard James Wesley. Kingpin schemes.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Kingpin.

### [60166] Kingpin's Cane
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (8/22)
- **Properties**: Unique
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > **When Revealed**: Attach to Kingpin. You are stunned.
  > **Forced Response**: After Kingpin attacks and damages a hero, stun that hero. If a hero is stunned this way, discard this card.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. If you were already stunned, take 1 damage.

### [60167] Mountain of Muscle
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (9/22)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > If Kingpin has the [[Martial Artist]] trait, attach to Kingpin. Otherwise, this card gains surge.
  > Kingpin gains retaliate 1.
  > **Forced Interrupt**: When Kingpin would take any amount of damage, place it here instead. Then, if there is 8 or more damage here, discard this card.

### [60168] Vanessa Fisk
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (10/22)
- **Properties**: Unique
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Persona.*
- **Rules Text**:
  > **When Revealed**: Attach to Kingpin. You are confused.
  > **Hero Action**: Discard an [[Attack]] event from your hand → discard Vanessa Fisk. Kingpin attacks you.
  >
  > ---
  >
  > [star] **Boost**: You are confused. If you were already confused, place 1 threat on the main scheme.

### [60169] Black Cat
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (11/22)
- **Properties**: Unique
- **Stats**: **THW**: 1, **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thief. Underling.*
- **Rules Text**:
  > Villainous.
  > While there is 4 threat here, treat Black Cat as an ally that takes 2 consequential damage after she attacks or thwarts.
  > **Hero Action**: Spend a [mental] resource → place 1 threat here. If there is 4 threat here, take control of Black Cat as an ally.

### [60170] Diamondback
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (12/22)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Underling.*
- **Rules Text**:
  > Villainous.
  > [star] **Forced Interrupt**: When Diamondback attacks you, take 1 damage.
  >
  > ---
  >
  > [star] **Boost**: Take 1 damage.

### [60171] Spot
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (13/22)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Underling.*
- **Rules Text**:
  > Enters play with 1 spot counter on him.
  > **Forced Interrupt**: When Spot would be dealt damage from an attack, if there is at least 1 spot counter here, remove 1 spot counter from here and deal that damage to the attacker instead. Otherwise, place 1 spot counter here.

### [60172] Stilt-Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (14/22)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Underling.*
- **Rules Text**:
  > Enters play with 2 stilt counters on him.
  > [star] Stilt-Man gets +1 SCH and +1 ATK for each stilt counter on him.
  > **Forced Interrupt**: When Stilt-Man would take any amount of damage, remove 1 stilt counter from him instead.

### [60173] Kingpin's Influence
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (15/22)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme places 3 threat on their nemesis side scheme. If it is not in play, they find it and reveal it.
- **Flavor**: *Kingpin uses a combination of lies, bribes, and threats to get others to do his bidding.*

### [60174] Organized Crime
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (16/22)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each minion gets +2 hit points.
- **Flavor**: *"We're stronger when we work together." –Kingpin*

### [60175] Bag of Tricks
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (17–19/22, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Reveal a random card from your set-aside nemesis set. If no card is revealed this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Give this character a random card from your set-aside nemesis set as an additional boost card.

### [60176] Unrelenting Hate
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Kingpin (20–22/22, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Kingpin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Your nemesis minion activates against you. If your nemesis minion is not in play, find it and reveal it. If you cannot find it, find an [[Underling]] minion that is not in play and reveal it.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains overkill.


### Set: Disasters

### [60177] Mystic Incursion
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Disasters (1/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Disasters Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Traits**: *Disaster.*
- **Rules Text**:
  > Uses (2 civilian counters).
  > **Hero Action**: Spend [mental][mental] resources or exhaust a hero or ally you control → remove 1 civilian counter from here (2 counters instead if you exhausted a [[Mystic]] character).

### [60178] Sinking Ferry
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Disasters (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Disasters Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Traits**: *Disaster.*
- **Rules Text**:
  > Uses (2 civilian counters).
  > **Hero Action**: Spend [energy][energy] resources or exhaust a hero or ally you control → remove 1 civilian counter from here (2 counters instead if you exhausted an [[Aerial]] character).

### [60179] Towering Inferno
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Disasters (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Disasters Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Traits**: *Disaster.*
- **Rules Text**:
  > Uses (2 civilian counters).
  > **Hero Action**: Spend [physical][physical] resources or exhaust a hero or ally you control → remove 1 civilian counter from here (2 counters instead if you exhausted a character that has a tough status card).

### [60180] Collapsing Bridge
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Disasters (4/5)
- **Stats**: **Base Threat**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Disasters Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > [star] Hinder 2 [per_hero].
  > **Forced Response**: After any amount of threat is removed from Collapsing Bridge, place 1 threat here.

### [60181] Bystanders in Peril
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Disasters (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Disasters Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril.
  > **When Revealed**: Place 1 civilian counter on a [[Disaster]] environment. If no counter was placed this way, search the encounter deck and discard pile for a [[Disaster]] environment and reveal it.
  >
  > ---
  >
  > [star] **Boost**: Place 1 civilian counter on a [[Disaster]] environment.


### Set: Cops

### [60182] Cop
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Cops (1–2/5, Qty: 2)
- **Stats**: **SCH**: 0 [star], **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Cops Set Icon (printed bottom-right next to deck number)
- **Traits**: *Police.*
- **Rules Text**:
  > Quickstrike. Vulnerable.
  > [star] **Forced Interrupt**: When Cop would scheme, it attacks the villain instead.
  > **When Defeated**: Place 2 threat on the main scheme.
- **Flavor**: *"Stop right there!"*

### [60183] Crooked Cop
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Cops (3/5)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Cops Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Police.*
- **Rules Text**:
  > Quickstrike. Vulnerable.
  > **When Defeated**: The defeating player deals themselves 1 facedown encounter card.
  >
  > ---
  >
  > [star] **Boost**: Take 2 indirect damage.

### [60184] Wanted
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Cops (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cops Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Hero Action**: Discard cards from the encounter deck until a [[Police]] minion is discarded and put it into play engaged with you. Discard this card.

### [60185] Police Cordon
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Cops (5/5)
- **Stats**: **Base Threat**: 3 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cops Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] Hinder 1 [per_hero].
  > Each [[Police]] minion gains guard and patrol.
  > **When Revealed**: Search the encounter deck and discard pile for a [[Police]] minion and reveal it.
- **Flavor**: *"Stand back! This is a crime scene." –Police officer*


### Set: Drive

### [60186] Sports Car
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Drive (1/5)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Drive Set Icon (printed bottom-right next to deck number)
- **Traits**: *Vehicle.*
- **Rules Text**:
  > Attach to the enemy with the highest ATK without a [[Vehicle]] attachment. Otherwise, this card gains surge.
  > **Forced Interrupt**: When attached character would take any amount of damage, place it here instead. If there is 4 or more damage here, discard this card.

### [60187] Motorcycle
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Drive (2/5)
- **Stats**: **THW**: 1, **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Drive Set Icon (printed bottom-right next to deck number)
- **Traits**: *Vehicle.*
- **Rules Text**:
  > Attach to the enemy with the highest SCH without a [[Vehicle]] attachment. Otherwise, this card gains surge.
  > **Forced Interrupt**: When attached character would take any amount of damage, place it here instead. If there is 3 or more damage here, discard this card.

### [60188] Utility Van
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Drive (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Drive Set Icon (printed bottom-right next to deck number)
- **Traits**: *Vehicle.*
- **Rules Text**:
  > Attach to the enemy with the fewest remaining hit points without a [[Vehicle]] attachment. Otherwise, this card gains surge.
  > **Forced Interrupt**: When attached character would take any amount of damage, place it here instead. If there is 6 or more damage here, discard this card.

### [60189] Traffic Jam
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Drive (4/5)
- **Stats**: **Base Threat**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Drive Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > [star] Hinder 2 [per_hero].
  > **Forced Interrupt**: When a character with a [[Vehicle]] attachment would:
  > • Add threat to a scheme, that threat is added here instead.
  > • Remove threat from a scheme, that threat is removed from here instead.

### [60190] Carjacking
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Drive (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Drive Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the encounter deck until a [[Vehicle]] attachment is discarded and reveal it. If your identity does not have a [[Vehicle]] attachment, you may spend 3 resources of the same type to attach the discarded attachment to your identity instead.


### Set: The Owl

### [60191] Flight Serum
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Owl (1–2/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: The Owl Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to a non-[[Aerial]] enemy. Otherwise, this card gains surge.
  > Attached enemy gains [[Aerial]].
  > **Hero Action**: Discard an [[Attack]] event from your hand → discard this card.
- **Flavor**: *"We're fighting on my home turf: the sky!" –The Owl*

### [60192] Mister Fish
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Owl (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Owl Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Maggia.*
- **Rules Text**:
  > [star] Mister Fish's attacks gain piercing and ranged.
  > **When Revealed**: Mister Fish engages the player whose identity has the fewest remaining hit points.
- **Flavor**: *"No one laughs at Mister Fish!"*

### [60193] The Owl
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Owl (4/5)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: The Owl Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Criminal.*
- **Rules Text**:
  > Quickstrike.
  > [star] The Owl's attacks gain piercing.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains piercing.

### [60194] Swoop Down
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: The Owl (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Owl Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The villain and each minion engaged with you schemes. Each [[Aerial]] enemy gets +2 SCH for its activation.
  > **When Revealed (Hero)**: The villain and each minion engaged with you attacks you. Each [[Aerial]] enemy gets +2 ATK for its activation.


### Set: Tombstone

### [60195] Cold as Ice
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tombstone (1/5)
- **Stats**: **SCH**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tombstone Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the minion with the highest base hit points and give that minion a tough status card. Otherwise, this card gains surge.
  > [star] **Forced Response**: After attached minion schemes, confuse the first player's identity and discard Cold as Ice.
- **Flavor**: *"I'll get him to talk." –Tombstone*

### [60196] Hard as Marble
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tombstone (2/5)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tombstone Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the minion with the highest base hit points and give that minion a tough status card. Otherwise, this card gains surge.
  > [star] **Forced Response**: After attached minion attacks, stun the attacked character and discard Hard as Marble.

### [60197] Beetle
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tombstone (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tombstone Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Criminal.*
- **Rules Text**:
  > Villainous.
  > **When Revealed**: Search the encounter deck and discard pile for an attachment that can attach to a minion and attach it to Beetle.

### [60198] Tombstone
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tombstone (4/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Tombstone Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Quickstrike.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card.
- **Flavor**: *"End of the day, this is what I love: a great fight!"*

### [60199] Hit List
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tombstone (5/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tombstone Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After the villain phase begins, deal 3 indirect damage to the first player. For each ally defeated this way, remove 1 [per_hero] threat from Hit List.


### Set: Tracksuit Mafia

### [60200] Ivan Banionis
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tracksuit Mafia (1/7)
- **Properties**: Unique
- **Stats**: **SCH**: 0 [star], **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tracksuit Mafia Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Tracksuit.*
- **Rules Text**:
  > Teamwork ([[Tracksuit]]).
  > **When Revealed**: Place 1 acceleration token here.
  > [star] **Forced Response**: After Ivan Banionis schemes, place 1 acceleration token here.

### [60201] The Clown
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tracksuit Mafia (2/7)
- **Properties**: Unique
- **Stats**: **SCH**: 0 [star], **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tracksuit Mafia Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Tracksuit.*
- **Rules Text**:
  > Teamwork ([[Tracksuit]]). Villainous.
  > [star] **Forced Response**: After The Clown schemes, give him 1 facedown boost card.
- **Flavor**: *"..."*

### [60202] Tracksuit Mafioso
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tracksuit Mafia (3/7)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 0, **HP**: 7
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tracksuit Mafia Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Tracksuit.*
- **Rules Text**:
  > Retaliate 2. Teamwork ([[Tracksuit]]). Vulnerable.
  > **When Defeated**: Tuck this card under the Tracksuit Mafia side scheme. Otherwise, stun and confuse the character that defeated Tracksuit Mafioso.

### [60203] Tracksuit Bro
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tracksuit Mafia (4–6/7, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tracksuit Mafia Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Tracksuit.*
- **Rules Text**:
  > Teamwork ([[Tracksuit]]). Vulnerable.
  > **When Defeated**: Tuck this card under the Tracksuit Mafia side scheme. Otherwise, shuffle this card into the encounter deck.
- **Flavor**: *"Bro."*

### [60204] Tracksuit Mafia
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Tracksuit Mafia (7/7)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tracksuit Mafia Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the top of the encounter deck until a [[Tracksuit]] minion is discarded and tuck that minion here.
  > **Forced Response**: After a player reveals a [[Tracksuit]] minion from the encounter deck, that player reveals 1 minion tucked here.


### Set: Campaign

### [60205a] Art Museum Heist
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (1/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Completed.*
- **Rules Text**:
  > **Setup**: Give each identity a tough status card.
- **Flavor**: *You draw inspiration from the works of art you secured against theft.*

### [60205b] Art Museum Heist
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (1/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Failed.*
- **Rules Text**:
  > **Setup**: Each player chooses to stun or confuse their identity (in expert mode, do both instead).
- **Flavor**: *You are demoralized by your failure to prevent the museum art theft.*

### [60206a] The Getaway
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (2/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Completed.*
- **Rules Text**:
  > **Setup**: After resolving mulligans, each player may search their deck and discard pile for an upgrade and add it to their hand. In expert mode, each player who did so discards 1 card from their hand.
- **Flavor**: *The bank provides you a generous reward as thanks for returning the stolen money.*

### [60206b] The Getaway
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (2/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Failed.*
- **Rules Text**:
  > In expert mode, attachments cannot be discarded from play during the first round.
  > **Setup**: Each player searches the encounter deck for an attachment and reveals it. Deal a facedown encounter card to each player who could not.
- **Flavor**: *Your enemies have put their ill-gotten gains towards improving their armaments.*

### [60207a] Protection Racket
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (3/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Completed.*
- **Rules Text**:
  > **Setup**: After resolving mulligans, each player may search their deck and discard pile for a support and add it to their hand. In expert mode, each player who did so discards 1 card from their hand.
- **Flavor**: *You stood up for the neighborhood businesses, giving the community the courage to rally around you.*

### [60207b] Protection Racket
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (3/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Failed.*
- **Rules Text**:
  > **Setup**: Each player chooses and discards 1 card from their hand (in expert mode, 2 cards instead).
- **Flavor**: *Threats against the neighborhood businesses have left the community too frightened to help you.*

### [60208a] The Raft Breakout
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (4/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Completed.*
- **Rules Text**:
  > **Setup**: After resolving mulligans, each player may search their deck and discard pile for an ally and add it to their hand. In expert mode, each player who did so discards 1 card from their hand.
- **Flavor**: *Your work in securing the Raft has freed up other heroes to help you take down the next villain.*

### [60208b] The Raft Breakout
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (4/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Failed.*
- **Rules Text**:
  > **Setup**: Shuffle each minion in The Raft Breakout encounter set into the encounter deck (in expert mode, deal 1 of those minions at random to each player as a facedown encounter card before shuffling in the rest).
- **Flavor**: *Many dangerous fugitives are on the loose thanks to your failure at the Raft.*

### [60209a] Stop the Presses!
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (5/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Completed.*
- **Rules Text**:
  > **Setup**: Each player puts 1 [[Daily Bugle]] support *(that has not been removed from the campaign)* into play from the Stop the Presses! encounter set.
- **Flavor**: *J. Jonah Jameson has promised the help of his Daily Bugle staff in gratitude for protecting his newspaper. You don't expect it to last.*

### [60209b] Stop the Presses!
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (5/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Failed.*
- **Rules Text**:
  > **Setup**: Deal each player 1 facedown encounter card (in expert mode, 2 encounter cards instead).
- **Flavor**: *Following the ransacking of the Daily Bugle offices, every media outlet in the city is too scared to help in your efforts to stop the crime wave, and you suspect some are even working with the criminals.*

### [60210a] Typhoid Mary — *Mary Walker*
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (6/6)
- **Properties**: Unique
- **Stats**: **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Psionic.*
- **Rules Text**:
  > Setup. Victory -1.
  > [star] **Forced Response**: After you reveal a minion, remove all damage from here and flip this card.

### [60210b] Bloody Mary — *Mary Walker*
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: Fear No Evil (`fne`)
- **Deck / Set**: Campaign (6/6)
- **Properties**: Unique
- **Stats**: **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Psionic.*
- **Rules Text**:
  > Victory -1.
  > [star] **Forced Response**: After you reveal a side scheme, remove all damage from here and flip this card.


