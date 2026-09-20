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
| `21001a` | Spectrum | Hero | Spectrum | THW:1 ATK:1 DEF:1 HP:11 | - | `mts` |
| `21001b` | Monica Rambeau | Alter-Ego | Spectrum | HP:11 | - | `mts` |
| `21002` | Gamma | Upgrade | Spectrum | - | - | `mts` |
| `21003` | Photon | Upgrade | Spectrum | - | - | `mts` |
| `21004` | Pulsar | Upgrade | Spectrum | - | - | `mts` |
| `21005` | Blue Marvel | Ally | Spectrum | THW:2 ATK:2 HP:3 | - | `mts` |
| `21006` | Energy Duplication | Upgrade | Spectrum | - | - | `mts` |
| `21007` | Gamma Blast | Event | Spectrum | - | - | `mts` |
| `21008` | Photon Speed | Event | Spectrum | - | - | `mts` |
| `21009` | Pulsar Shield | Event | Spectrum | - | - | `mts` |
| `21010` | Speed of Light | Event | Spectrum | - | - | `mts` |
| `21011` | Captain America | Ally | Pack Position: 11 | THW:2 ATK:2 HP:4 | - | `mts` |
| `21012` | Power Man | Ally | Pack Position: 12 | THW:1 ATK:0 HP:3 | - | `mts` |
| `21013` | White Tiger | Ally | Pack Position: 13 | THW:2 ATK:2 HP:2 | - | `mts` |
| `21014` | Kaluu | Ally | Pack Position: 14 | THW:1 ATK:1 HP:2 | - | `mts` |
| `21015` | Mighty Avengers | Support | Pack Position: 15 | - | - | `mts` |
| `21016` | Mass Attack | Event | Pack Position: 16 | - | - | `mts` |
| `21017` | Moxie | Event | Pack Position: 17 | - | - | `mts` |
| `21018` | Band Together | Resource | Pack Position: 18 | - | - | `mts` |
| `21019` | Blade | Ally | Pack Position: 19 | THW:1 ATK:2 HP:3 | - | `mts` |
| `21020` | Avengers Tower | Support | Pack Position: 20 | - | - | `mts` |
| `21021` | Avengers Mansion | Support | Pack Position: 21 | - | - | `mts` |
| `21022` | Ready to Rumble | Upgrade | Pack Position: 22 | - | - | `mts` |
| `21023` | Energy | Resource | Pack Position: 23 | - | - | `mts` |
| `21024` | Genius | Resource | Pack Position: 24 | - | - | `mts` |
| `21025` | Strength | Resource | Pack Position: 25 | - | - | `mts` |
| `21026` | Loss of Control | Obligation | Spectrum | - | 2 pips | `mts` |
| `21027` | Radioactive Man | Minion | Spectrum Nemesis | SCH:1 ATK:1 HP:6 | Star | `mts` |
| `21028` | Reactor Meltdown | Side Scheme | Spectrum Nemesis | - | 3 pips | `mts` |
| `21029` | Sap Power | Attachment | Spectrum Nemesis | - | 2 pips | `mts` |
| `21030` | Radioactive Blast | Treachery | Spectrum Nemesis | - | 1 pips | `mts` |
| `21031a` | Adam Warlock | Hero | Adam Warlock | THW:1 ATK:1 DEF:2 HP:11 | - | `mts` |
| `21031b` | Adam Warlock | Alter-Ego | Adam Warlock | HP:11 | - | `mts` |
| `21032` | Pip the Troll | Ally | Adam Warlock | THW:1 ATK:1 HP:2 | - | `mts` |
| `21033` | Soul World | Support | Adam Warlock | - | - | `mts` |
| `21034` | Karmic Staff | Upgrade | Adam Warlock | - | - | `mts` |
| `21035` | Warlock's Cape | Upgrade | Adam Warlock | - | - | `mts` |
| `21036` | Cosmic Ward | Upgrade | Adam Warlock | - | - | `mts` |
| `21037` | Mystic Senses | Upgrade | Adam Warlock | - | - | `mts` |
| `21038` | Karmic Blast | Event | Adam Warlock | - | - | `mts` |
| `21039` | Cosmic Awareness | Event | Adam Warlock | - | - | `mts` |
| `21040` | Quantum Magic | Event | Adam Warlock | - | - | `mts` |
| `21041` | Marvel Boy | Ally | Pack Position: 41 | THW:0 ATK:2 HP:2 | - | `mts` |
| `21042` | In-Betweener | Event | Pack Position: 42 | - | - | `mts` |
| `21043` | Magic Attack | Event | Pack Position: 43 | - | - | `mts` |
| `21044` | Uppercut | Event | Pack Position: 44 | - | - | `mts` |
| `21045` | Combat Training | Upgrade | Pack Position: 45 | - | - | `mts` |
| `21046` | Audacity | Resource | Pack Position: 46 | - | - | `mts` |
| `21047` | Quasar | Ally | Pack Position: 47 | THW:1 ATK:2 HP:3 | - | `mts` |
| `21048` | Living Tribunal | Event | Pack Position: 48 | - | - | `mts` |
| `21049` | For Justice! | Event | Pack Position: 49 | - | - | `mts` |
| `21050` | Zone of Silence | Event | Pack Position: 50 | - | - | `mts` |
| `21051` | Heroic Intuition | Upgrade | Pack Position: 51 | - | - | `mts` |
| `21052` | Determination | Resource | Pack Position: 52 | - | - | `mts` |
| `21053` | Major Victory | Ally | Pack Position: 53 | THW:1 ATK:1 HP:2 | - | `mts` |
| `21054` | Eternity | Event | Pack Position: 54 | - | - | `mts` |
| `21055` | Summoning Spell | Event | Pack Position: 55 | - | - | `mts` |
| `21056` | Make the Call | Event | Pack Position: 56 | - | - | `mts` |
| `21057` | Inspired | Upgrade | Pack Position: 57 | - | - | `mts` |
| `21058` | Innovation | Resource | Pack Position: 58 | - | - | `mts` |
| `21059` | Charlie-27 | Ally | Pack Position: 59 | THW:1 ATK:1 HP:4 | - | `mts` |
| `21060` | The Gardener | Event | Pack Position: 60 | - | - | `mts` |
| `21061` | Shield Spell | Event | Pack Position: 61 | - | - | `mts` |
| `21062` | Counter-Punch | Event | Pack Position: 62 | - | - | `mts` |
| `21063` | Armored Vest | Upgrade | Pack Position: 63 | - | - | `mts` |
| `21064` | Preservation | Resource | Pack Position: 64 | - | - | `mts` |
| `21065` | Martinex | Ally | Pack Position: 65 | THW:1 ATK:1 HP:4 | - | `mts` |
| `21066` | Regeneration Cycle | Obligation | Adam Warlock | - | 2 pips | `mts` |
| `21067` | The Magus | Minion | Adam Warlock Nemesis | SCH:2 ATK:2 HP:5 | 2 pips | `mts` |
| `21068` | Universal Church of Truth | Side Scheme | Adam Warlock Nemesis | - | Star | `mts` |
| `21069` | Zealot of Truth | Minion | Adam Warlock Nemesis | SCH:1 ATK:2 HP:4 | Star | `mts` |
| `21070` | Cosmic Inquisition | Treachery | Adam Warlock Nemesis | - | 2 pips | `mts` |
| `21071` | Ebony Maw | Villain | Ebony Maw | SCH:2 ATK:1 HP:14 | - | `mts` |
| `21072` | Ebony Maw | Villain | Ebony Maw | SCH:2 ATK:2 HP:18 | - | `mts` |
| `21073` | Ebony Maw | Villain | Ebony Maw | SCH:3 ATK:2 HP:23 | - | `mts` |
| `21074` | Attack on Knowhere | Main Scheme | Ebony Maw | - | - | `mts` |
| `21074a` | Attack on Knowhere | Main Scheme | Ebony Maw | - | - | `mts` |
| `21074b` | Attack on Knowhere | Main Scheme | Ebony Maw | - | - | `mts` |
| `21075` | The Power Stone | Main Scheme | Ebony Maw | - | - | `mts` |
| `21075a` | The Power Stone | Main Scheme | Ebony Maw | - | - | `mts` |
| `21075b` | The Power Stone | Main Scheme | Ebony Maw | - | - | `mts` |
| `21076` | Fireball | Environment | Ebony Maw | - | 2 pips | `mts` |
| `21077` | Manipulation | Environment | Ebony Maw | - | 2 pips | `mts` |
| `21078` | Pacification | Environment | Ebony Maw | - | 2 pips | `mts` |
| `21079` | Rubblestorm | Environment | Ebony Maw | - | 2 pips | `mts` |
| `21080` | Agent of Thanos | Treachery | Ebony Maw | - | 1 pips | `mts` |
| `21081` | Channeling Trance | Treachery | Ebony Maw | - | 1 pips | `mts` |
| `21082` | Abjuration | Attachment | Ebony Maw | - | 3 pips | `mts` |
| `21083` | Restrained | Attachment | Ebony Maw | - | 2 pips | `mts` |
| `21084` | Reactor Overload | Side Scheme | Ebony Maw | - | 3 pips | `mts` |
| `21085` | Black Dwarf | Minion | Black Order | SCH:1 ATK:3 HP:6 | 3 pips | `mts` |
| `21086` | Supergiant | Minion | Black Order | SCH:2 ATK:2 HP:5 | 2 pips | `mts` |
| `21087` | The Black Order | Side Scheme | Black Order | - | 2 pips | `mts` |
| `21088` | Blood to Spare | Treachery | Black Order | - | 1 pips | `mts` |
| `21089` | Black Order Infantry | Minion | Armies of Titan | SCH:1 ATK:2 HP:4 | Star | `mts` |
| `21090` | Outrider | Minion | Armies of Titan | SCH:1 ATK:1 HP:2 | Star | `mts` |
| `21091` | Landing Craft | Side Scheme | Armies of Titan | - | 2 pips | `mts` |
| `21092` | Proxima Midnight | Villain | Tower Defense | SCH:1 ATK:2 HP:9 | - | `mts` |
| `21093` | Proxima Midnight | Villain | Tower Defense | SCH:1 ATK:3 HP:12 | - | `mts` |
| `21094` | Proxima Midnight | Villain | Tower Defense | SCH:2 ATK:3 HP:15 | - | `mts` |
| `21095` | Corvus Glaive | Villain | Tower Defense | SCH:2 ATK:1 HP:8 | - | `mts` |
| `21096` | Corvus Glaive | Villain | Tower Defense | SCH:2 ATK:2 HP:11 | - | `mts` |
| `21097` | Corvus Glaive | Villain | Tower Defense | SCH:3 ATK:2 HP:14 | - | `mts` |
| `21098` | Under Siege | Main Scheme | Tower Defense | - | - | `mts` |
| `21098a` | Under Siege | Main Scheme | Tower Defense | - | - | `mts` |
| `21098b` | Under Siege | Main Scheme | Tower Defense | - | - | `mts` |
| `21099` | The Armies of Thanos | Main Scheme | Tower Defense | - | - | `mts` |
| `21099a` | The Armies of Thanos | Main Scheme | Tower Defense | - | - | `mts` |
| `21099b` | The Armies of Thanos | Main Scheme | Tower Defense | - | - | `mts` |
| `21100` | Avengers Tower | Environment | Tower Defense | - | - | `mts` |
| `21100a` | Avengers Tower | Environment | Tower Defense | - | - | `mts` |
| `21100b` | Avengers Tower | Environment | Tower Defense | - | - | `mts` |
| `21101` | Focused Defense | Attachment | Tower Defense | - | - | `mts` |
| `21102` | Black Order Besieger | Minion | Tower Defense | SCH:1 ATK:2 HP:3 | 1 pips | `mts` |
| `21103` | Proxima's Spear | Attachment | Tower Defense | ATK:1 | 3 pips | `mts` |
| `21104` | Corvus's Glaive | Attachment | Tower Defense | - | 3 pips | `mts` |
| `21105` | Direct Assault | Attachment | Tower Defense | ATK:2 | 2 pips | `mts` |
| `21106` | Proxima's Power | Treachery | Tower Defense | - | Star | `mts` |
| `21107` | Corvus's Cunning | Treachery | Tower Defense | - | Star | `mts` |
| `21108` | Bound by Blood | Treachery | Tower Defense | - | Star | `mts` |
| `21109` | Rain Fire | Treachery | Tower Defense | - | 1 pips | `mts` |
| `21110` | City Under Attack | Side Scheme | Tower Defense | - | 2 pips | `mts` |
| `21111` | Thanos | Villain | Thanos | SCH:1 ATK:2 HP:16 | - | `mts` |
| `21112` | Thanos | Villain | Thanos | SCH:2 ATK:3 HP:23 | - | `mts` |
| `21113` | Thanos | Villain | Thanos | SCH:2 ATK:4 HP:28 | - | `mts` |
| `21114` | The Infinity Stones | Main Scheme | Thanos | - | - | `mts` |
| `21114a` | The Infinity Stones | Main Scheme | Thanos | - | - | `mts` |
| `21114b` | The Infinity Stones | Main Scheme | Thanos | - | - | `mts` |
| `21115` | Balance the Scales | Main Scheme | Thanos | - | - | `mts` |
| `21115a` | Balance the Scales | Main Scheme | Thanos | - | - | `mts` |
| `21115b` | Balance the Scales | Main Scheme | Thanos | - | - | `mts` |
| `21116` | Sanctuary | Side Scheme | Thanos | - | 3 pips | `mts` |
| `21117` | Thanos's Armor | Attachment | Thanos | - | 3 pips | `mts` |
| `21118` | Thanos's Helmet | Attachment | Thanos | - | 3 pips | `mts` |
| `21119` | Master of the Stones | Attachment | Thanos | SCH:1 ATK:1 | 1 pips | `mts` |
| `21120` | Avatar of Death | Treachery | Thanos | - | 1 pips | `mts` |
| `21121` | Deviant Syndrome | Treachery | Thanos | - | Star | `mts` |
| `21122` | "I Am Inevitable" | Treachery | Thanos | - | Star | `mts` |
| `21123` | The Mad Titan | Treachery | Thanos | - | Star | `mts` |
| `21124` | The Titan's Throne | Side Scheme | Thanos | - | 2 pips | `mts` |
| `21125` | Corvus Glaive | Minion | Children of Thanos | SCH:2 ATK:2 HP:4 | Star | `mts` |
| `21126` | Proxima Midnight | Minion | Children of Thanos | SCH:1 ATK:3 HP:5 | Star | `mts` |
| `21127` | Ebony Maw | Minion | Children of Thanos | SCH:1 ATK:1 HP:6 | 1 pips | `mts` |
| `21128` | Tribute | Side Scheme | Children of Thanos | - | 2 pips | `mts` |
| `21129` | Infinity Gauntlet | Attachment | Infinity Gauntlet | SCH:1 ATK:1 | - | `mts` |
| `21130` | Mind Stone | Environment | Infinity Gauntlet | - | 2 pips | `mts` |
| `21131` | Power Stone | Environment | Infinity Gauntlet | - | 3 pips | `mts` |
| `21132` | Reality Stone | Environment | Infinity Gauntlet | - | 3 pips | `mts` |
| `21133` | Soul Stone | Environment | Infinity Gauntlet | - | 1 pips | `mts` |
| `21134` | Space Stone | Environment | Infinity Gauntlet | - | 2 pips | `mts` |
| `21135` | Time Stone | Environment | Infinity Gauntlet | - | 4 pips | `mts` |
| `21136a` | Hela | Villain | Hela | SCH:1 ATK:1 HP:8 | - | `mts` |
| `21136b` | Hela | Villain | Hela | SCH:0 ATK:0 HP:0 | - | `mts` |
| `21137a` | Hela | Villain | Hela | SCH:2 ATK:2 HP:9 | - | `mts` |
| `21137b` | Hela | Villain | Hela | SCH:1 ATK:1 HP:0 | - | `mts` |
| `21138` | Odin's Torment | Main Scheme | Hela | - | - | `mts` |
| `21138a` | Odin's Torment | Main Scheme | Hela | - | - | `mts` |
| `21138b` | Odin's Torment | Main Scheme | Hela | - | - | `mts` |
| `21139a` | Odin | Ally | Hela | THW:2 ATK:3 HP:6 | - | `mts` |
| `21139b` | Odin | Ally | Hela | THW:3 ATK:4 HP:6 | - | `mts` |
| `21140` | Gnipahellir | Side Scheme | Hela | - | 2 pips | `mts` |
| `21141` | Hall of Nastrond | Side Scheme | Hela | - | 4 pips | `mts` |
| `21142` | Gjallerbru | Side Scheme | Hela | - | 3 pips | `mts` |
| `21143` | Garm | Minion | Hela | SCH:1 ATK:2 HP:4 | 2 pips | `mts` |
| `21144` | Skurge | Minion | Hela | SCH:1 ATK:3 HP:5 | 3 pips | `mts` |
| `21145` | Nidhogg | Minion | Hela | SCH:1 ATK:4 HP:6 | 4 pips | `mts` |
| `21146` | Nightsword | Attachment | Hela | ATK:1 | Star | `mts` |
| `21147` | Hela's Crown | Attachment | Hela | SCH:1 | Star | `mts` |
| `21148` | Hela's Cloak | Attachment | Hela | - | Star | `mts` |
| `21149` | Hela's Domain | Treachery | Hela | - | 1 pips | `mts` |
| `21150` | The Queen of Hel | Treachery | Hela | - | 1 pips | `mts` |
| `21151` | The Wastes of Niffleheim | Treachery | Hela | - | Star | `mts` |
| `21152` | Draugr | Minion | Legions of Hel | SCH:1 ATK:1 HP:3 | 1 pips | `mts` |
| `21153` | Fallen Warrior | Attachment | Legions of Hel | - | 2 pips | `mts` |
| `21154` | No Place for the Living | Treachery | Legions of Hel | - | 1 pips | `mts` |
| `21155` | Legions of Hel | Side Scheme | Legions of Hel | - | 2 pips | `mts` |
| `21156` | Laufey | Minion | Frost Giants | SCH:2 ATK:4 HP:6 | 4 pips | `mts` |
| `21157` | Frost Giant | Minion | Frost Giants | SCH:1 ATK:3 HP:4 | 1 pips | `mts` |
| `21158` | Frozen | Attachment | Frost Giants | - | 2 pips | `mts` |
| `21159` | Unnatural Storm | Side Scheme | Frost Giants | - | 2 pips | `mts` |
| `21160` | Loki | Villain | Loki | SCH:2 ATK:2 HP:20 | - | `mts` |
| `21161` | Loki | Villain | Loki | SCH:2 ATK:1 HP:20 | - | `mts` |
| `21162` | Loki | Villain | Loki | SCH:1 ATK:3 HP:20 | - | `mts` |
| `21163` | Loki | Villain | Loki | SCH:3 ATK:1 HP:20 | - | `mts` |
| `21164` | Loki | Villain | Loki | SCH:1 ATK:2 HP:20 | - | `mts` |
| `21165` | All Hail King Loki | Main Scheme | Loki | - | - | `mts` |
| `21165a` | All Hail King Loki | Main Scheme | Loki | - | - | `mts` |
| `21165b` | All Hail King Loki | Main Scheme | Loki | - | - | `mts` |
| `21166` | Casket of Ancient Winters | Side Scheme | Loki | - | 3 pips | `mts` |
| `21167` | War in Asgard | Side Scheme | Loki | - | 1 pips | `mts` |
| `21168` | Madness on Midgard | Side Scheme | Loki | - | 2 pips | `mts` |
| `21169` | Open the Bifrost | Side Scheme | Loki | - | 4 pips | `mts` |
| `21170` | Loki's Staff | Attachment | Loki | ATK:1 | Star | `mts` |
| `21171` | Loki's Crown | Attachment | Loki | SCH:1 | Star | `mts` |
| `21172` | Loki's Cape | Attachment | Loki | - | 2 pips | `mts` |
| `21173` | Master of Illusions | Attachment | Loki | - | 1 pips | `mts` |
| `21174` | Devious Sorcery | Treachery | Loki | - | 2 pips | `mts` |
| `21175` | Infinite Mischief | Treachery | Loki | - | Star | `mts` |
| `21176` | The Trickster | Treachery | Loki | - | Star | `mts` |
| `21177` | Enchantress | Minion | Enchantress | SCH:2 ATK:1 HP:5 | 2 pips | `mts` |
| `21178` | Beguiled | Attachment | Enchantress | - | 1 pips | `mts` |
| `21179` | Seduced | Attachment | Enchantress | - | 2 pips | `mts` |
| `21180a` | Secure the Landing Pad | Side Scheme | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21180b` | Cosmo | Ally | The Mad Titan's Shadow Campaign | THW:2 ATK:2 HP:3 | - | `mts` |
| `21181` | Security Breach | Side Scheme | The Mad Titan's Shadow Campaign | - | 2 pips | `mts` |
| `21182a` | Save the Shawarma Place | Side Scheme | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21182b` | Black Swan | Minion | The Mad Titan's Shadow Campaign | SCH:2 ATK:2 HP:4 | - | `mts` |
| `21183` | Shawarma | Resource | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21184a` | Hack Sanctuary's Computer | Side Scheme | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21184b` | Defensive Protocols | Side Scheme | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21185` | System Shock | Obligation | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21186a` | Find the Norn Stones | Side Scheme | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21186b` | Retrieve Odin's Armor | Side Scheme | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21187a` | Norn Stone | Upgrade | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21187b` | Norn Stone | Upgrade | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21188` | Summoned Back | Treachery | The Mad Titan's Shadow Campaign | - | 3 pips | `mts` |
| `21189a` | Open the Dungeons | Side Scheme | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21189b` | Jormungand | Attachment | The Mad Titan's Shadow Campaign | - | - | `mts` |
| `21190` | Lady Sif | Ally | The Mad Titan's Shadow Campaign | THW:2 ATK:2 HP:3 | - | `mts` |
| `21191` | Fandral | Ally | The Mad Titan's Shadow Campaign | THW:3 ATK:1 HP:3 | - | `mts` |
| `21192` | Hogun | Ally | The Mad Titan's Shadow Campaign | THW:1 ATK:3 HP:3 | - | `mts` |
| `21193` | Volstagg | Ally | The Mad Titan's Shadow Campaign | THW:1 ATK:1 HP:5 | - | `mts` |

---

## Pack: The Mad Titan's Shadow (`mts`)

### Set: Spectrum

### [21001a] Spectrum
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (Identity Card)
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 1, **HP**: 11, **Hand Size**: 5
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > *Energy Transformation* - **Forced Response:** After you change to this form, choose a facedown energy form upgrade → flip that card faceup to change to that energy form.
- **Flavor**: *"The name is Monica, or Spectrum if you're nasty."*
- **Image Asset**: `assets/card-art/bundles/cards/21001a.png` (300×418 px, 218.9 KB)
### [21001b] Monica Rambeau
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 11, **Hand Size**: 6
- **Traits**: *Civilian.*
- **Rules Text**:
  > **Setup:** Put all 3 energy form upgrades into play, facedown.
  > *Power Down* - **Forced Response:** After you change to this form, turn all your energy form upgrades facedown.
- **Image Asset**: `assets/card-art/bundles/cards/21001b.png` (300×418 px, 226.8 KB)
### [21002] Gamma
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (1/19)
- **Properties**: Permanent
- **Stats**: **Resources**: [physical]
- **Rules Text**:
  > Energy form. Permanent.
  > Spectrum gets +2 ATK.
  > **Hero Response:** After you change to this form, deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/21002.png` (729×1044 px, 200.4 KB)
### [21003] Photon
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (2/19)
- **Properties**: Permanent
- **Stats**: **Resources**: [mental]
- **Rules Text**:
  > Energy form. Permanent.
  > Spectrum gets +2 THW.
  > **Hero Response:** After you change to this form, remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21003.png` (730×1043 px, 168.6 KB)
### [21004] Pulsar
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (3/19)
- **Properties**: Permanent
- **Stats**: **Resources**: [energy]
- **Rules Text**:
  > Energy form. Permanent.
  > Spectrum gets +2 DEF.
  > **Hero Response:** After you change to this form, heal 1 damage from Spectrum.
- **Image Asset**: `assets/card-art/bundles/cards/21004.png` (730×1043 px, 179.1 KB)
### [21005] Blue Marvel — *Adam Brashear*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (4/19)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Hero Response:** After Blue Marvel enters play, change energy forms
- **Flavor**: *"I do whatever is right, whenever it needs to be done, and I don't care what anyone thinks."*
- **Image Asset**: `assets/card-art/bundles/cards/21005.png` (730×1042 px, 168.6 KB)
### [21006] Energy Duplication
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (5–6/19, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Resource:** Exhaust Energy Duplication → generate the printed resource on your faceup energy form upgrade.
- **Flavor**: *"I can take the form of any type of energy I want."-Spectrum*
- **Image Asset**: `assets/card-art/bundles/cards/21006.png` (729×1041 px, 182.4 KB)
### [21007] Gamma Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (7–9/19, Qty: 3)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Change to Gamma energy form and deal 7 damage to an enemy. If you were already in Gamma energy form, this attack gains overkill.
- **Flavor**: *"I wouldn't make me angry either." —Spectrum*
- **Image Asset**: `assets/card-art/bundles/cards/21007.png` (730×1044 px, 184.6 KB)
### [21008] Photon Speed
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (10–12/19, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart. Superpower.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Change to Photon energy form and remove 4 threat from a scheme. If you were already in Photon energy form, ignore crisis icon for this thwart.
- **Flavor**: *"Looking for these?" —Spectrum*
- **Image Asset**: `assets/card-art/bundles/cards/21008.png` (729×1040 px, 177.8 KB)
### [21009] Pulsar Shield
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (13–15/19, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Defense. Superpower.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When Spectrum defends, change to Pulsar energy form and ready Spectrum. If you were already in Pulsar energy form, she gains retaliate 1 until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/21009.png` (725×1028 px, 220.3 KB)
### [21010] Speed of Light
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (16–18/19, Qty: 3)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action:** Change energy forms and draw 1 card.
- **Flavor**: *"Be there in a flash." —Spectrum*
- **Image Asset**: `assets/card-art/bundles/cards/21010.png` (729×1036 px, 165.8 KB)
### [21026] Loss of Control
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum (19/19)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spectrum Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Monica Rambeau player.***
  > You cannot change energy forms.
  > **Alter-Ego Action**: Exhaust Monica Rambeau → remove Loss of Control from the game.
- **Image Asset**: `assets/card-art/bundles/cards/21026.png` (730×1043 px, 163.4 KB)

### Set: Leadership

### [21011] Captain America — *Steve Rogers*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 6, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Toughness.
  > Reduce the cost to play Captain America by 1 for each [[avenger]] character you control.
- **Image Asset**: `assets/card-art/bundles/cards/21011.png` (723×1045 px, 159.8 KB)
### [21012] Power Man — *Victor Alvarez*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 0 (Consequential: 2), **HP**: 3, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Power Man enters play with 2 chi counters on him.
  > **Action**: Discard any number of chi counters from Power Man → he gets +2 ATK for each chi counter discarded this way until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/21012.png` (724×1045 px, 166.9 KB)
### [21013] White Tiger — *Ava Ayala*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After you play White Tiger from your hand, draw X cards (to a maximum of three), where X is equal to the villain's stage number. If the villain has no stage number, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/21013.png` (729×1044 px, 182.6 KB)
### [21014] Kaluu
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Avenger. Mystic.*
- **Rules Text**:
  > **Response**: After Kaluu enters play, search the top 5 cards of your deck for an event → add that event to your hand. Shuffle your deck.
- **Image Asset**: `assets/card-art/bundles/cards/21014.png` (729×1044 px, 187.6 KB)
### [21015] Mighty Avengers
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Team.*
- **Rules Text**:
  > Play under any player's control. Max 1 Team per player.
  > If each of your characters has the [[Avenger]] trait, each ally you control gets +1 THW and +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/21015.png` (728×1044 px, 183.8 KB)
### [21016] Mass Attack
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Exhaust 3 allies you control that share a [[Trait]] with your hero → deal X damage to an enemy, where X is the total ATK of those allies and your hero.
- **Flavor**: *"All together now!" —Captain Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/21016.png` (730×1044 px, 164.8 KB)
### [21017] Moxie
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Hero Response:** After you change form, your hero gets +1 THW, +1 ATK, +1 DEF until the end of the round.
- **Flavor**: *"If you mess with one of us, you mess with all of us!" Even if I'm the last one." —Nova*
### [21018] Band Together
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 18
- **Rules Text**:
  > This card generates [wild] for each ally you control (to a maximum of 3)
- **Image Asset**: `assets/card-art/bundles/cards/21018.png` (730×1044 px, 189.7 KB)
### [21053] Major Victory — *Vance Astro*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 53
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *Guardian.*
- **Rules Text**:
  > **Interrupt**: When Major Victory is defeated, choose a friendly Guardian character → ready that character.
- **Image Asset**: `assets/card-art/bundles/cards/21053.png` (730×1044 px, 190.0 KB)
### [21054] Eternity
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 54
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Cosmic Entity.*
- **Rules Text**:
  > **Action**: Shuffle this card into the encounter deck (without looking)
  > **When Revealed**: Draw 1 card and remove this card from the game. This effect cannot be canceled.
- **Image Asset**: `assets/card-art/bundles/cards/21054.png` (729×1044 px, 170.4 KB)
### [21055] Summoning Spell
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 55
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Spell.*
- **Rules Text**:
  > Play only if your identity has the [[Mystic]] trait. Max 1 per deck.
  > **Hero Action**: Discard cards from the top of your deck until you discard an ally → put that ally into play under your control.
- **Image Asset**: `assets/card-art/bundles/cards/21055.png` (730×1045 px, 181.0 KB)
### [21056] Make the Call
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 56
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Rules Text**:
  > **Action**: Pay the printed cost of an ally in any player's discard pile → put that ally into play under your control.
- **Flavor**: *"This is a code red! All hands on deck!" —Maria Hill*
### [21057] Inspired
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 57
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to an ally. Max 1 per ally.
  > Attached ally gets +1 THW and +1 ATK.
- **Flavor**: *"I'm glad she's on our side." —Star-Lord*
### [21058] Innovation
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 58
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, heal 1 damage from an ally you control.
- **Image Asset**: `assets/card-art/bundles/cards/21058.png` (727×1041 px, 194.4 KB)

### Set: Basic

### [21019] Blade — *Eric Brooks*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 1, **THW**: 1 [star], **ATK**: 2 [star], **HP**: 3, **Resources**: [physical]
- **Traits**: *Avenger. Vampire.*
- **Rules Text**:
  > [star] **Forced Response**: After Blade thwarts or attacks, choose to either spend a [physical] resource from your hand or discard Blade.
- **Image Asset**: `assets/card-art/bundles/cards/21019.png` (729×1045 px, 157.4 KB)
### [21020] Avengers Tower
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > If each of your allies has the [[Avenger]] trait, increase your ally limit by 1.
  > **Action:** Exhaust Avengers Tower → reduce the cost of the next [[Avenger]] ally played this phase by 1.
### [21021] Avengers Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 4, **Resources**: [mental]
- **Traits**: *Avenger. Location.*
- **Rules Text**:
  > Max 1 per player.
  > **Action**: Exhaust Avengers Mansion → choose a player. That player draws 1 card.
- **Flavor**: *"Did you remember to turn off the stove?" —Janet Van Dyne*
### [21022] Ready to Rumble
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Hero Response**: After you change form, discard this card → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/21022.png` (729×1045 px, 162.5 KB)
### [21023] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [21024] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [21025] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [21065] Martinex — *T'Naga*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 65
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 4, **Resources**: [energy]
- **Traits**: *Guardian.*
- **Rules Text**:
  > Reduce the cost to play Martinex by 1 if your identity has the [[Guardian]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/21065.png` (730×1045 px, 163.6 KB)

### Set: Spectrum Nemesis

### [21027] Radioactive Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Spectrum Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Genius.*
- **Rules Text**:
  > [star] **Forced Response**: After Radioactive Man activates against you, deal 1 damage to each character you control.
  >
  > ---
  >
  > [star] **Boost**: **Boost**: Deal 1 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/21027.png` (731×1044 px, 174.6 KB)
### [21028] Reactor Meltdown
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spectrum Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: Deal 1 damage to each friendly character in play.
- **Image Asset**: `assets/card-art/bundles/cards/21028.png` (1046×726 px, 184.5 KB)
### [21029] Sap Power
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum Nemesis (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spectrum Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity.
  > **Forced Response**After your turn ends, take 1 damage.
  > **Alter-Ego Action**: Spend [energy][energy] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/21029.png` (729×1044 px, 174.0 KB)
### [21030] Radioactive Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Spectrum Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spectrum Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Place 2 threat on the main scheme.
  > **When Revealed (Hero)**: Take 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/21030.png` (729×1044 px, 166.7 KB)

### Set: Adam Warlock

### [21031a] Adam Warlock
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 2, **HP**: 11, **Hand Size**: 5
- **Traits**: *Guardian. Mystic.*
- **Rules Text**:
  > *Battle Mage* - **Action**: Discard 1 card from your hand. Limit once per phase. If that card is:
  > - Aggression - Deal 2 damage to an enemy.
  > - Justice - Remove 2 threat from a scheme.
  > - Protection - Heal 1 damage from an ally.
  > - Leadership - Give a hero +1 THW, +1 ATK and +1 DEF this round.
- **Image Asset**: `assets/card-art/bundles/cards/21031a.png` (300×418 px, 232.9 KB)
### [21031b] Adam Warlock
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 11, **Hand Size**: 6
- **Traits**: *Mystic.*
- **Rules Text**:
  > *Avatar of Life* - During deck-building, your deck must include an equal number of cards from all 4 aspects. You cannot include more than 1 copy of any non-Adam Warlock card.
  > **Action**: Discard a card from your hand → remove a status card from Adam Warlock.
- **Image Asset**: `assets/card-art/bundles/cards/21031b.png` (300×418 px, 222.7 KB)
### [21032] Pip the Troll
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Mystic.*
- **Rules Text**:
  > Toughness.
  > While Pip the Troll is in your hand, he gains "**Interrupt**: When a player is attacked, spend[energy][mental] resources → put Pip the Troll into play under that player's controller."
- **Image Asset**: `assets/card-art/bundles/cards/21032.png` (730×1044 px, 175.6 KB)
### [21033] Soul World
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Response**: After your deck runs out of cards, place 1 soul counter here.
  > **Alter-Ego Action**: Exhaust Soul World and remove 1 soul counter from it → heal all damage from your identity.
- **Image Asset**: `assets/card-art/bundles/cards/21033.png` (729×1044 px, 184.3 KB)
### [21034] Karmic Staff
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Artifact. Item.*
- **Rules Text**:
  > **Resource**: Exhaust Karmic Staff → generate a [wild] resource
- **Image Asset**: `assets/card-art/bundles/cards/21034.png` (729×1045 px, 171.5 KB)
### [21035] Warlock's Cape
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (4/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Item.*
- **Rules Text**:
  > **Hero Response**: After you resolve Adam Warlock's "Battle Mage" ability, exhaust Warlock's Cape → ready Adam Warlock.
- **Image Asset**: `assets/card-art/bundles/cards/21035.png` (729×1044 px, 169.8 KB)
### [21036] Cosmic Ward
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (5–6/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Spell.*
- **Rules Text**:
  > **Forced Interrupt**: When you reveal a treachery card, cancel its "**When Revealed**" effects and discard it. Then, discard Cosmic Ward
- **Image Asset**: `assets/card-art/bundles/cards/21036.png` (728×1044 px, 173.9 KB)
### [21037] Mystic Senses
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (7–8/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Condition. Superpower.*
- **Rules Text**:
  > **Hero Response**: After you resolve Adam Warlock's "Battle Mage" ability, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/21037.png` (728×1045 px, 168.0 KB)
### [21038] Karmic Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (9–11/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy and discard up to 4 cards from the top of your deck → deal 1 additional damage to that enemy for each different aspect discarded this way (Aggression, Justice, Leadership and Protection)
- **Image Asset**: `assets/card-art/bundles/cards/21038.png` (729×1043 px, 176.8 KB)
### [21039] Cosmic Awareness
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (12–13/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart. Superpower.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme and discard up to 4 cards from the top of your deck → remove 1 additional threat from that scheme for each different aspect discarded this way (Aggression, Justice, Leadership and Protection)
- **Image Asset**: `assets/card-art/bundles/cards/21039.png` (729×1044 px, 177.0 KB)
### [21040] Quantum Magic
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (14–15/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Spell.*
- **Rules Text**:
  > **Action**: Choose a card in your discard pile → add that card to your hand
- **Image Asset**: `assets/card-art/bundles/cards/21040.png` (730×1041 px, 160.6 KB)
### [21066] Regeneration Cycle
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Adam Warlock Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to Adam Warlock player.***
  > You may flip to alter-ego. Choose:
  > • Exhaust your alter-ego → remove this card from the game.
  > • Discard the top 5 cards of your deck. Place 1 threat on the main scheme for each different aspect cards discarded this way. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/21066.png` (729×1044 px, 185.2 KB)

### Set: Aggression

### [21041] Marvel Boy — *Noh-Varr*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 41
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 0 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [physical]
- **Traits**: *Guardian. Kree.*
- **Rules Text**:
  > **Interrupt**: When Marvel Boy attacks, spend a [physics] resource → this attack gains piercing and ranged
- **Image Asset**: `assets/card-art/bundles/cards/21041.png` (728×1043 px, 156.4 KB)
### [21042] In-Betweener
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 42
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Cosmic Entity.*
- **Rules Text**:
  > **Action**: Shuffle this card into the encounter deck (without looking)
  > **When Revealed**: Deal 2 damage to the villain and remove this card from the game. This effect cannot be canceled.
- **Image Asset**: `assets/card-art/bundles/cards/21042.png` (729×1044 px, 162.5 KB)
### [21043] Magic Attack
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 43
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Attack. Spell.*
- **Rules Text**:
  > Play only if your identity has the [[Mystic]] trait. Max 1 per deck.
  > **Hero Action** *(attack)*: Choose an enemy and discard up to 5 cards from the top of your deck → deal 1 damage to that enemy for each card discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/21043.png` (730×1044 px, 170.7 KB)
### [21044] Uppercut
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 44
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy.
- **Flavor**: *SMACK!*
### [21045] Combat Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 45
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 ATK.
- **Flavor**: *"Tony! She did it again!" —Janet Van Dyne*
### [21046] Audacity
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 46
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, deal 1 damage to the villain.
- **Image Asset**: `assets/card-art/bundles/cards/21046.png` (729×1044 px, 177.0 KB)

### Set: Justice

### [21047] Quasar — *Wendell Vaughn*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 47
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Aerial. Guardian.*
- **Rules Text**:
  > **Response**: After Quasar enters play, remove 1 threat from each scheme in play.
- **Image Asset**: `assets/card-art/bundles/cards/21047.png` (730×1042 px, 171.6 KB)
### [21048] Living Tribunal
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 48
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Cosmic Entity.*
- **Rules Text**:
  > **Action**: Shuffle this card into the encounter deck (without looking)
  > **When Revealed**: Remove 2 threat from the main scheme and remove this card from the game. This effect cannot be canceled.
- **Image Asset**: `assets/card-art/bundles/cards/21048.png` (729×1044 px, 169.1 KB)
### [21049] For Justice!
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 49
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme (4 threat instead if you paid for this card using a [mental] resource).
- **Flavor**: *"You lose. And you're going to answer for what you've done." —Captain America*
### [21050] Zone of Silence
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Spell. Thwart.*
- **Rules Text**:
  > Play only if your identity has the [[Mystic]] trait. Max 1 per deck.
  > **Hero Action** *(thwart)*: Choose a scheme and discard up to 4 cards from the top of your deck → remove 1 threat from that scheme for each card discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/21050.png` (729×1044 px, 173.9 KB)
### [21051] Heroic Intuition
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 THW.
### [21052] Determination
- **Type**: `Resource`
- **Faction / Aspect**: Justice
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, remove 1 threat from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21052.png` (728×1043 px, 161.0 KB)

### Set: Protection

### [21059] Charlie-27
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 59
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 4, **Resources**: [physical]
- **Traits**: *Guardian.*
- **Rules Text**:
  > Retaliate 1. Toughness.
- **Image Asset**: `assets/card-art/bundles/cards/21059.png` (730×1044 px, 183.5 KB)
### [21060] The Gardener
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 60
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Cosmic Entity.*
- **Rules Text**:
  > **Action**: Shuffle this card into the encounter deck (without looking)
  > **When Revealed**: Heal 2 damage from your identity and remove this card from the game. This effect cannot be canceled.
- **Image Asset**: `assets/card-art/bundles/cards/21060.png` (730×1041 px, 176.6 KB)
### [21061] Shield Spell
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 61
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Defense. Spell.*
- **Rules Text**:
  > Play only if your identity has the [[Mystic]] trait. Max 1 per deck.
  > **Hero Interrupt** *(defense)*: When you would take any amount of damage from an attack, discard that many cards from the top of your deck → prevent all damage from this attack.
- **Image Asset**: `assets/card-art/bundles/cards/21061.png` (730×1045 px, 193.2 KB)
### [21062] Counter-Punch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 62
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Response** *(attack)*: After your hero defends against an enemy attack, deal damage to that enemy equal to your hero's ATK.
- **Flavor**: *"That's what you get!" —Iron Fist*
### [21063] Armored Vest
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 63
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Armor.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Your hero gets +1 DEF.
- **Flavor**: *Life-saving and stylish.*
### [21064] Preservation
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Pack Position: 64
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, heal 1 damage from your hero.
- **Image Asset**: `assets/card-art/bundles/cards/21064.png` (729×1044 px, 179.0 KB)

### Set: Adam Warlock Nemesis

### [21067] The Magus
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Adam Warlock Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Mystic.*
- **Rules Text**:
  > Quickstrike. Toughness.
  > [star] **Forced Response**: After The Magus activates against you, discard the top 5 cards of your deck.
  > *(Adam Warlock's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/21067.png` (730×1045 px, 179.0 KB)
### [21068] Universal Church of Truth
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Adam Warlock Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Response**: After a player resets their deck, exhaust that player identity and stun it.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/21068.png` (1048×724 px, 173.8 KB)
### [21069] Zealot of Truth
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Adam Warlock Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mystic.*
- **Rules Text**:
  > Threat cannot be removed from the Universal Church of Truth side scheme.
  >
  > ---
  >
  > [star] **Boost**: Put Zealot of Truth into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/21069.png` (730×1043 px, 179.0 KB)
### [21070] Cosmic Inquisition
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Adam Warlock Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Adam Warlock Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 2.
  > **When Revealed**: If the Universal Church of Truth side scheme is in play, discard the top 10 cards of your deck. Otherwise, search the encounter deck, discard pile, and set-aside area for Universal Church of Truth and reveal it. Shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/21070.png` (730×1040 px, 195.7 KB)

### Set: Ebony Maw

### [21071] Ebony Maw
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (1/22)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2 [star], **ATK**: 1 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Mystic.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Ebony Maw activates against you, remove an invocation counter from each [[Spell]] card in your play area.
- **Flavor**: *<b><i>"Your powers are quaint. Let me show you real magic."</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/21071.png` (726×1044 px, 183.4 KB)
### [21072] Ebony Maw
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (2/22)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Mystic.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Ebony Maw activates against you, remove an invocation counter from each [[Spell]] card in your play area.
  > **When Revealed**: Each player discards cards from the top of the encounter deck until they discard a [[Spell]] card and puts that card into play in their play area.
- **Image Asset**: `assets/card-art/bundles/cards/21072.png` (729×1038 px, 187.1 KB)
### [21073] Ebony Maw
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (3/22)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3 [star], **ATK**: 2 [star], **HP**: 23 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Mystic.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Ebony Maw activates against you, remove an invocation counter from each [[Spell]] card in your play area.
  > **When Revealed**: Each player discards cards from the top of the encounter deck until they discard a [[Spell]] card and puts that card into play in their play area.
- **Image Asset**: `assets/card-art/bundles/cards/21073.png` (730×1045 px, 194.3 KB)
### [21074] Attack on Knowhere
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (4/22)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Each player discards cards from the top of the encounter deck until they discard a [[Spell]] card and puts that card into play in their play area. Shuffle the encounter discard pile into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/21074.png` (1047×725 px, 163.1 KB)
### [21074a] Attack on Knowhere
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (4/22)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Ebony Maw (I) and Ebony Maw (II). *(Ebony Maw (II) and Ebony Maw (III) instead for expert mode.)* Ebony Maw and Standard encounter sets. Two modular encounter set *(Armies of Titan and Black Order).*
### [21074b] Attack on Knowhere
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (4/22)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player discards cards from the top of the encounter deck until they discard a [[Spell]] card and puts that card into play in their play area. Shuffle the encounter discard pile into the encounter deck.
### [21075] The Power Stone
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (5/22)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *<b>Ebony Maw uses his powerful magic to occupy you while his agents search for the Power Stone.</b>*
- **Image Asset**: `assets/card-art/bundles/cards/21075.png` (1047×726 px, 153.9 KB)
### [21075a] The Power Stone
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (5/22)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Shuffle the encounter discard pile into the encounter deck. Each player discards cards from the top of the encounter deck until they discard a [[Spell]] card and puts that card into play in their play area.
### [21075b] The Power Stone
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (5/22)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *<b>Ebony Maw uses his powerful magic to occupy you while his agents search for the Power Stone.</b>*
### [21076] Fireball
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (6–7/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spell.*
- **Rules Text**:
  > Surge.
  > Enters play with 4 invocation counters on it.
  > **Forced Response**: After the last invocation counter is removed from Fireball, discard it → deal 4 damage to your identity.
- **Image Asset**: `assets/card-art/bundles/cards/21076.png` (729×1044 px, 174.2 KB)
### [21077] Manipulation
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (8–9/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spell.*
- **Rules Text**:
  > Surge.
  > Enters play with 2 invocation counters on it.
  > **Forced Response**: After the last invocation counter is removed from Manipulation, discard it → discard 1 card at random from your hand. You are confused.
- **Image Asset**: `assets/card-art/bundles/cards/21077.png` (730×1046 px, 173.2 KB)
### [21078] Pacification
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (10–11/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spell.*
- **Rules Text**:
  > Surge.
  > Enters play with 3 invocation counters on it.
  > **Forced Response**: After the last invocation counter is removed from Pacification, discard it → exhaust each upgrade you control. You are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/21078.png` (730×1044 px, 181.0 KB)
### [21079] Rubblestorm
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (12–13/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spell.*
- **Rules Text**:
  > Surge.
  > Enters play with 3 invocation counters on it.
  > **Forced Response**: After the last invocation counter is removed from Rubblestorm, discard it → deal 2 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/21079.png` (729×1045 px, 174.6 KB)
### [21080] Agent of Thanos
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (14–15/22, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Place 1 threat on the main scheme for each [[Spell]] environment in your play area. If you place no threat this way, this card gains surge.
  > **When Revealed (Hero)**: Deal 1 damage to your hero for each [[Spell]] environment in your play area. If you take no damage this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/21080.png` (729×1044 px, 173.1 KB)
### [21081] Channeling Trance
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (16–18/22, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Remove 1 invocation counter from each [[Spell]] environment in your play area. If you have no [[Spell]] environments in your play area, discard cards from the top of the encounter deck until a [[Spell]] environment is discarded. Put that card into play in your play area.
- **Image Asset**: `assets/card-art/bundles/cards/21081.png` (730×1044 px, 180.9 KB)
### [21082] Abjuration
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (19/22)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to Ebony Maw.
  > Prevent all damage to Ebony Maw.
  > **Forced Response**: After Abjuration prevents 2 or more damage from a single attack, discard it.
- **Image Asset**: `assets/card-art/bundles/cards/21082.png` (729×1045 px, 166.7 KB)
### [21083] Restrained
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (20/22)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to a friendly character with the highest ATK and exhaust it.
  > Attached character cannot ready.
  > **Hero Action**: Spend [energy][physical] resources → discard this card.
- **Flavor**: *"Shh. That's enough from you." —Ebony Maw*
- **Image Asset**: `assets/card-art/bundles/cards/21083.png` (728×1042 px, 184.2 KB)
### [21084] Reactor Overload
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Ebony Maw (21–22/22, Qty: 2)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Ebony Maw Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Each player must choose to either take 2 damage or place 2 threat here.
- **Flavor**: *<b><i>The Maw's troops have stormed Knowhere's engine room and set the station to overload.</i></b>*
- **Image Asset**: `assets/card-art/bundles/cards/21084.png` (1046×725 px, 177.1 KB)

### Set: Black Order

### [21085] Black Dwarf
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Black Order (1/4)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Order Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Elite.*
- **Rules Text**:
  > [star] Black Dwarf's attack gain overkill.
- **Image Asset**: `assets/card-art/bundles/cards/21085.png` (729×1045 px, 163.0 KB)
### [21086] Supergiant
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Black Order (2/4)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Order Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Elite.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After supergiant attacks and damages a character, that character is stunned.
- **Image Asset**: `assets/card-art/bundles/cards/21086.png` (730×1044 px, 170.1 KB)
### [21087] The Black Order
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Black Order (3/4)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Order Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > While a [[Black Order]] minion is in play, threat cannot be removed from this side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21087.png` (1049×726 px, 171.6 KB)
### [21088] Blood to Spare
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Black Order (4/4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Order Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each minion engaged with a player activates against that player. Each player who is not engaged with a minion searches the encounter deck and discard pile for a [[Black Order]] minion and puts it into play engaged with them. Shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/21088.png` (730×1045 px, 184.2 KB)

### Set: Armies of Titan

### [21089] Black Order Infantry
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Armies of Titan (1–2/6, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Armies of Titan Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order.*
- **Rules Text**:
  > Guard.
  > **When Defeated**: Give the villain a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/21089.png` (727×1042 px, 169.5 KB)
### [21090] Outrider
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Armies of Titan (3–4/6, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Armies of Titan Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order.*
- **Rules Text**:
  > **When Revealed**: Discard 1 card at random from your hand.
  >
  > ---
  >
  > [star] **Boost**: Discard 1 card at random from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/21090.png` (730×1044 px, 172.0 KB)
### [21091] Landing Craft
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Armies of Titan (5–6/6, Qty: 2)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Armies of Titan Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Discard cards from the top of the encounter deck until a minion is discarded. Put that minion into play engaged with the player who defeated this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21091.png` (1048×726 px, 163.8 KB)

### Set: Tower Defense

### [21092] Proxima Midnight
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (1/27)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Proxima Midnight attacks you, choose to either deal 1 damage to Avenger's Tower, or Proxima Midnight gets +2 ATK for this attack.
  > **Proxima Midnight cannot be defeated while Corvus Glaive has any hit points remaining.**
- **Image Asset**: `assets/card-art/bundles/cards/21092.png` (728×1044 px, 187.6 KB)
### [21093] Proxima Midnight
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (2/27)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Proxima Midnight attacks you, choose to either deal 1 damage to Avenger's Tower, or Proxima Midnight gets +2 ATK for this attack.
  > ** Proxima Midnight cannot be defeated while Corvus Glaive has any hit points remaining **
- **Image Asset**: `assets/card-art/bundles/cards/21093.png` (727×1042 px, 176.6 KB)
### [21094] Proxima Midnight
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (3/27)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Proxima Midnight attacks you, choose to either deal 1 damage to Avenger's Tower, or Proxima Midnight gets +2 ATK for this attack.
  > ** Proxima Midnight cannot be defeated while Corvus Glaive has any hit points remaining **
- **Image Asset**: `assets/card-art/bundles/cards/21094.png` (731×1044 px, 178.8 KB)
### [21095] Corvus Glaive
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (4/27)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 8 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order.*
- **Rules Text**:
  > [star] **Forced Interrupt**: After Corvus Glaive makes an undefended attack, discard the top card of the encounter deck → deal 1 damage to Avenger's Tower for each boost icon ([boost]) on that card.
  > **Corvus Glaive cannot be defeated while Proxima Midnight has any hit points remaining.**
- **Image Asset**: `assets/card-art/bundles/cards/21095.png` (731×1045 px, 187.3 KB)
### [21096] Corvus Glaive
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (5/27)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 11 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order.*
- **Rules Text**:
  > [star] **Forced Interrupt**: After Corvus Glaive makes an undefended attack, discard the top card of the encounter deck → deal 1 damage to Avenger's Tower for each boost icon [[boost]] on that card.
  > ** Corvus Glaive cannot be defeated while Proxima Midnight has any hit points remaining **
- **Image Asset**: `assets/card-art/bundles/cards/21096.png` (730×1036 px, 190.2 KB)
### [21097] Corvus Glaive
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (6/27)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order.*
- **Rules Text**:
  > [star] **Forced Interrupt**: After Corvus Glaive makes an undefended attack, discard the top card of the encounter deck → deal 1 damage to Avenger's Tower for each boost icon [[boost]] on that card.
  > ** Corvus Glaive cannot be defeated while Proxima Midnight has any hit points remaining **
- **Image Asset**: `assets/card-art/bundles/cards/21097.png` (730×1039 px, 187.6 KB)
### [21098] Under Siege
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (7/27)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Proxima Midnight's Scheme.***
  > **Forced Interrupt:** When this stage would be completed, remove all the threat from this stage instead. Then, deal 6[per_hero] damage to Avengers Tower.
- **Image Asset**: `assets/card-art/bundles/cards/21098.png` (1047×728 px, 160.0 KB)
### [21098a] Under Siege
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (7/27)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Proxima Midnight I and II *(stages (II) and (III) instead for expert mode)*. Corvus Glaive I and II *(stages (II) and (III) instead for expert mode)*. Tower Defense and Standard sets. One modular encounter set *(Armies of Titan)*.
  > **Setup**: Reveal stage 2A and put it into play next to this stage so there are two main schemes and two villains in play.
### [21098b] Under Siege
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (7/27)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Proxima Midnight's Scheme.***
  > **Forced Interrupt**: When this stage would be completed, remove all the threat from this stage instead. Then, deal 6[per_hero] damage to Avengers Tower.
### [21099] The Armies of Thanos
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (8/27)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Corvus Glaive's Scheme.***
  > **Forced Interrupt:** When this stage would be completed, remove all the threat from this stage instead. Then, deal each player 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/21099.png` (1046×725 px, 164.6 KB)
### [21099a] The Armies of Thanos
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (8/27)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Put the Avengers Tower environment into play, [[stronghold]] side faceup. Put the Focused Defense attachment into play attached to this stage. Each player searches the encounter deck for a copy of Black Order Besieger and puts it into play engaged with them. Shuffle the encounter deck.
### [21099b] The Armies of Thanos
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (8/27)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Corvus Glaive's Scheme.***
  > **Forced Interrupt**: When this stage would be completed, remove all the threat from this stage instead. Then, deal each player 1 facedown encounter card.
### [21100] Avengers Tower
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (9/27)
- **Properties**: Double-Sided
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Damaged.*
- **Rules Text**:
  > **When Revealed:** Discard each other Avengers Tower from play.
  > **Forced Response:** After damage is placed here, if there is at least 9[per player] damage here, the players lose the game.
- **Image Asset**: `assets/card-art/bundles/cards/21100.png` (727×1043 px, 162.5 KB)
### [21100a] Avengers Tower
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (9/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Stronghold.*
- **Rules Text**:
  > The unique rule does not apply to Avengers Tower.
  > **Forced Response**: After damage is placed here, if there is at least 9[per_hero] damage here, remove all of it. Then flip Avengers Tower over.
### [21100b] Avengers Tower
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (9/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Damaged.*
- **Rules Text**:
  > **When Revealed**: Discard each other Avengers Tower from play.
  > **Forced Response**: After damage is placed here, if there is at least 9[per_hero] damage here, the players lose the game.
### [21101] Focused Defense
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (10/27)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent.
  > The villain who matches the attached scheme is the active villain.
  > **Forced Response**: After the player phase ends, attach this card to the other main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21101.png` (730×1045 px, 162.0 KB)
### [21102] Black Order Besieger
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (11–14/27, Qty: 4)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order.*
- **Rules Text**:
  > **Forced Response**: After Black Order Besieger engages you, choose to either deal 1 damage to Avengers Tower or deal 2 damage to your identity.
- **Image Asset**: `assets/card-art/bundles/cards/21102.png` (729×1045 px, 172.0 KB)
### [21103] Proxima's Spear
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (15/27)
- **Properties**: Unique
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Proxima Midnight.
  > [star] Proxima Midnight's attacks gain overkill and piercing.
  > **Hero Action**: Take 1 damage and spend [energy] [mental] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/21103.png` (730×1045 px, 171.5 KB)
### [21104] Corvus's Glaive
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (16/27)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Corvus Glaive.
  > Corvus Glaive gains retaliate 1.
  > **Hero Action:** Take 1 damage and spend [energy] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/21104.png` (729×1044 px, 167.7 KB)
### [21105] Direct Assault
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (17–18/27, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to the villain who is not the active villain.
  > [star] **Forced Interrupt**: When attached villain attacks, the attack gains ranged. If that attack defeats an ally, deal 3 damage to Avengers Tower. At the end of that attack, discard Direct Assault.
- **Image Asset**: `assets/card-art/bundles/cards/21105.png` (729×1043 px, 180.9 KB)
### [21106] Proxima's Power
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (19–20/27, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Proxima Midnight activates against you.
  >
  > ---
  >
  > [star] **Boost**: Add the other villain's SCH and ATK to this villain's SCH and ATK for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/21106.png` (729×1043 px, 186.1 KB)
### [21107] Corvus's Cunning
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (21–22/27, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Corvus Glaive activates against you.
  >
  > ---
  >
  > [star] **Boost**: Add the other villain's SCH and ATK to this villain's SCH and ATK for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/21107.png` (729×1044 px, 167.7 KB)
### [21108] Bound by Blood
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (23/27)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Heal 2 damage from each villain. Give each villain a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Heal 2 damage from the active villain and give it a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/21108.png` (730×1044 px, 158.7 KB)
### [21109] Rain Fire
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (24–25/27, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal 3 damage to Avengers Tower.
  >
  > ---
  >
  > [star] **Boost**: If damage from this attack defeats an ally, deal 3 damage to Avengers tower
- **Image Asset**: `assets/card-art/bundles/cards/21109.png` (730×1044 px, 173.2 KB)
### [21110] City Under Attack
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Tower Defense (26–27/27, Qty: 2)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tower Defense Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: The player who defeated this scheme draws 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/21110.png` (1045×725 px, 173.9 KB)

### Set: Thanos

### [21111] Thanos
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (1/19)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Titan.*
- **Rules Text**:
  > Stalwart. *(This character cannot be stunned or confused.)*
  > **Forced Response**: After the [[infinity stone]] deck runs out, give Thanos 1 facedown boost card.
- **Image Asset**: `assets/card-art/bundles/cards/21111.png` (730×1041 px, 187.4 KB)
### [21112] Thanos
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (2/19)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 23 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Titan.*
- **Rules Text**:
  > Stalwart. Toughness.
  > **When Revealed**: Search the encounter deck and discard pile for Thanos's Helmet and reveal it. *(Shuffle.)*
  > **Forced Response**: After the [[infinity stone]] deck runs out, give Thanos 1 facedown boost card.
- **Image Asset**: `assets/card-art/bundles/cards/21112.png` (729×1044 px, 190.1 KB)
### [21113] Thanos
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (3/19)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 4, **HP**: 28 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Titan.*
- **Rules Text**:
  > Stalwart. Toughness.
  > **When Revealed**: Search the encounter deck and discard pile for Thanos's Helmet and reveal it. *(Shuffle.)*
  > **Forced Response**: After the [[infinity stone]] deck runs out, give Thanos 1 facedown boost card.
- **Image Asset**: `assets/card-art/bundles/cards/21113.png` (727×1044 px, 189.4 KB)
### [21114] The Infinity Stones
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (4/19)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents:** Thanos I and Thanos II *(Thanos II and Thanos III for expert mode)*. Thanos, Infinity Gaultlet and Standard sets. Two modular sets *(Black Order and Children of Thanos)*. See rules insert for The Infinity Gauntlet rules.
- **Image Asset**: `assets/card-art/bundles/cards/21114.png` (1046×725 px, 168.7 KB)
### [21114a] The Infinity Stones
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (4/19)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Thanos I and Thanos II *(Thanos II and Thanos III for expert mode)*. Thanos, Infinity Gaultlet and Standard sets. Two modular sets *(Black Order and Children of Thanos)*. See rules insert for The Infinity Gauntlet rules.
### [21114b] The Infinity Stones
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (4/19)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Put the top card of the [[infinity stone]] deck into play. Search the encounter deck for the Sanctuary side scheme and reveal it. *(Shuffle the encounter deck.)*
- **Flavor**: *Thanos has gathered all six infinity Stones into the Infinity Gauntlet. He has only to master its power in order to enact his genocidal plan.*
### [21115] Balance the Scales
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (5/19)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed:** Each player shuffles their discard pile into their deck. Each player removes the top half of their deck (rounded down) from the game.
- **Image Asset**: `assets/card-art/bundles/cards/21115.png` (1046×725 px, 158.7 KB)
### [21115a] Balance the Scales
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (5/19)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
### [21115b] Balance the Scales
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (5/19)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player shuffles their discard pile into their deck. Each player removes the top half of their deck (rounded down) from the game.
### [21116] Sanctuary
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (6/19)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1[per_hero]. Victory 1.
  > Thanos cannot take damage from player cards.
  > **When Defeated**: Each player may spend up to 3 [physical] resources from their hand. Deal 2 damage to Thanos for each [physical] resource spent this way. This damage ignores the tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/21116.png` (1016×726 px, 159.1 KB)
### [21117] Thanos's Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (7/19)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Thanos.
  > **Forced Interrupt**: When Thanos would take any amount of damage, reduce that amount by 1.
  > **Hero Response**: After a hero makes a basic attack against Thanos, spend [energy] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/21117.png` (729×1040 px, 171.5 KB)
### [21118] Thanos's Helmet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (8/19)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Thanos.
  > Thanos gains retaliate 1.
  > **Hero Response**: After a hero makes a basic attack against Thanos, spend [mental][physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/21118.png` (729×1044 px, 164.1 KB)
### [21119] Master of the Stones
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (9–10/19, Qty: 2)
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to Thanos. [star] **Forced Interrupt**: When Thanos activates, put the top card of the [[infinity stone]] deck into play. At the end of this activation, discard Master of the Stones.
- **Image Asset**: `assets/card-art/bundles/cards/21119.png` (729×1043 px, 178.1 KB)
### [21120] Avatar of Death
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (11–12/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Thanos schemes.
  > **When Revealed (Hero)**: Thanos attacks you. That attack gains overkill and piercing.
- **Image Asset**: `assets/card-art/bundles/cards/21120.png` (729×1044 px, 182.6 KB)
### [21121] Deviant Syndrome
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (13–14/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1.
  > **When Revealed**: Give Thanos a tough status card. If you cannot, place 2 threat on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: Give Thanos a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/21121.png` (728×1044 px, 162.8 KB)
### [21122] "I Am Inevitable"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (15–16/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**:Give Thanos 1 facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: Discard the top card of the [[infinity stone]] deck. Apply its boost icons ([boost]) for this activation as if it were a boost card.
- **Image Asset**: `assets/card-art/bundles/cards/21122.png` (729×1043 px, 181.6 KB)
### [21123] The Mad Titan
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (17–18/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Put the top card of the infinity stone deck into play.
  >
  > ---
  >
  > [star] **Boost**: If damage from this attack defeats an ally, put the top card of the infinity stone deck into play
- **Image Asset**: `assets/card-art/bundles/cards/21123.png` (729×1044 px, 170.5 KB)
### [21124] The Titan's Throne
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Thanos (19/19)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thanos Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Choose and discard an [[infinity stone]] from play.
- **Image Asset**: `assets/card-art/bundles/cards/21124.png` (1044×730 px, 162.9 KB)

### Set: Children of Thanos

### [21125] Corvus Glaive
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Children of Thanos (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Children of Thanos Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Elite.*
- **Rules Text**:
  > Retaliate 1. Toughness.
  >
  > ---
  >
  > [star] **Boost**: Discard an ally or support you control.
- **Image Asset**: `assets/card-art/bundles/cards/21125.png` (723×1044 px, 164.4 KB)
### [21126] Proxima Midnight
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Children of Thanos (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Children of Thanos Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Elite.*
- **Rules Text**:
  > [star] Proxima Midnight's attacks gain piercing.
  >
  > ---
  >
  > [star] **Boost**: Discard an ally or upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/21126.png` (728×1044 px, 161.9 KB)
### [21127] Ebony Maw
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Children of Thanos (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Children of Thanos Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Elite.*
- **Rules Text**:
  > Villainous. (When this minion activates, give it a boost card.)
  >
  > ---
  >
  > [star] **Boost**: Give this enemy 1 additional boost card
- **Image Asset**: `assets/card-art/bundles/cards/21127.png` (729×1044 px, 176.1 KB)
### [21128] Tribute
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Children of Thanos (4–5/5, Qty: 2)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Children of Thanos Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: Deal the player who defeated this scheme a facedown encounter card
- **Image Asset**: `assets/card-art/bundles/cards/21128.png` (1039×712 px, 157.3 KB)

### Set: Infinity Gauntlet

### [21129] Infinity Gauntlet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Infinity Gauntlet (1/7)
- **Properties**: Unique, Permanent
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Infinity Gauntlet Set Icon (printed bottom-right next to deck number)
- **Traits**: *Artifact. Weapon.*
- **Rules Text**:
  > Permanent. Setup
  > [star] **Forced Response**: After attached villain activates against you, resolve the **Special** ability of each [[infinity stone]] in play. Otherwise, put the top card of the [[infinity stone]] deck into play.
- **Image Asset**: `assets/card-art/bundles/cards/21129.png` (726×1043 px, 167.4 KB)
### [21130] Mind Stone
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Infinity Gauntlet (2/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infinity Gauntlet Set Icon (printed bottom-right next to deck number)
- **Traits**: *Infinity Stone.*
- **Rules Text**:
  > ** Special: ** You are confused. If you were already confused, discard 1 card at random from your hand. Place this card in the [[infinity stone]] deck discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/21130.png` (730×1025 px, 155.7 KB)
### [21131] Power Stone
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Infinity Gauntlet (3/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infinity Gauntlet Set Icon (printed bottom-right next to deck number)
- **Traits**: *Infinity Stone.*
- **Rules Text**:
  > ** Special: ** You are stunned. If you were already stunned, take 3 damage. Place this card in the [[infinity stone]] deck discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/21131.png` (728×1044 px, 156.0 KB)
### [21132] Reality Stone
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Infinity Gauntlet (4/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infinity Gauntlet Set Icon (printed bottom-right next to deck number)
- **Traits**: *Infinity Stone.*
- **Rules Text**:
  > ** Special: ** Discard an ally, upgrade, or support you control. Place this card in the [[infinity stone]] deck discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/21132.png` (722×1043 px, 134.9 KB)
### [21133] Soul Stone
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Infinity Gauntlet (5/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infinity Gauntlet Set Icon (printed bottom-right next to deck number)
- **Traits**: *Infinity Stone.*
- **Rules Text**:
  > ** Special: ** Heal 3 damage from the villain and give it a facedown boost card. Place this card in the [[infinity stone]] deck discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/21133.png` (729×1044 px, 147.3 KB)
### [21134] Space Stone
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Infinity Gauntlet (6/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infinity Gauntlet Set Icon (printed bottom-right next to deck number)
- **Traits**: *Infinity Stone.*
- **Rules Text**:
  > ** Special: ** Discard cards from the top of the encounter deck until a minion is discarded → put that minion into play engaged with your. Place this card in the [[infinity stone]] deck discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/21134.png` (718×1044 px, 165.6 KB)
### [21135] Time Stone
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Infinity Gauntlet (7/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infinity Gauntlet Set Icon (printed bottom-right next to deck number)
- **Traits**: *Infinity Stone.*
- **Rules Text**:
  > ** Special: ** Discard the top 4 cards of your deck and place 1 threat on the main scheme for each different card type discarded this way. Place this card in the [[infinity stone]] deck discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/21135.png` (728×1044 px, 154.2 KB)

### Set: Hela

### [21136a] Hela
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (1/19)
- **Properties**: Unique, Stage A1
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 8 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > [star] Hela gets +1 SCH, +1 ATK and +2[per_hero] hit points for each side scheme in victory display.
  > ** When Hela is defeated, if Odin is not attached to the main scheme, you win the game **
- **Image Asset**: `assets/card-art/bundles/cards/21136a.png` (726×1041 px, 175.3 KB)
### [21136b] Hela
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (1/19)
- **Properties**: Unique, Stage A2
- **Stats**: **SCH**: 0, **ATK**: 0, **HP**: 0
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Wounded.*
- **Rules Text**:
  > Hela cannot be defeated.
  > **Forced Response**: After a side scheme is defeated, flip Hela to her [[mystic]] side.
### [21137a] Hela
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (2/19)
- **Properties**: Unique, Stage B1
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > [star] Hela gets +1 SCH, +1 ATK and +3[per_hero] hit points for each side scheme in victory display.
  > ** When Hela is defeated, if Odin is not attached to the main scheme, you win the game **
- **Image Asset**: `assets/card-art/bundles/cards/21137a.png` (726×1044 px, 174.5 KB)
### [21137b] Hela
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (2/19)
- **Properties**: Unique, Stage B2
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 0
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Wounded.*
- **Rules Text**:
  > Hela cannot be defeated.
  > **Forced Response**: After a side scheme is defeated, flip Hela to her [[mystic]] side.
### [21138] Odin's Torment
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (3/19)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 18 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ** Forced Interrupt: ** When Hela would be defeated, if Odin is attached to this scheme, discard each attachment from Hela and flip her to her [[wounded]] side instead.
  > ** If this scheme is completed, the players lose the game. **
- **Image Asset**: `assets/card-art/bundles/cards/21138.png` (1047×725 px, 166.1 KB)
### [21138a] Odin's Torment
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (3/19)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ** Contents: ** Villain deck Hela A (Hela B instead for expert mode). Hela and standard sets. Two modular encounter sets (Legions of Hel and Frost Giants).
  > ** Setup: ** Attach Odin to the main scheme, [[captive]] side faceup. Reveal Gnipahellir and Garm. Set Gjallerbru, Skurge, Hall of Nastrond, and Nidhogg aside, out of play. Shuffle the encounter deck.
### [21138b] Odin's Torment
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (3/19)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 18 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ** Forced Interrupt: ** When Hela would be defeated, if Odin is attached to this scheme, discard each attachment from Hela and flip her to her [[wounded]] side instead.
  > ** If this scheme is completed, the players lose the game. **
### [21139a] Odin — *All-Father*
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (4/19)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 2 (Consequential: 2), **ATK**: 3 (Consequential: 2), **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Captive.*
- **Rules Text**:
  > While Odin is not attached to the main scheme, he gains: "The first player gains control of Odin. Odin cannot have cards attached and does not count against ally limit."
  > **If Odin leaves play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/21139a.png` (728×1044 px, 178.5 KB)
### [21139b] Odin — *All-Father*
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (4/19)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 3 (Consequential: 2), **ATK**: 4 (Consequential: 2), **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. King.*
- **Rules Text**:
  > The first player gains control of Odin.
  > Odin cannot have encounter cards attached and does not count against the ally limit.
  > **Forced Interrupt**: When Odin leaves play, remove him from the game.
### [21140] Gnipahellir
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (5/19)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 1[per_hero]. Victory 2.
  > ** When Defeated: ** The first player reveals Gjallerbru and Skurg, and puts them into play. Deal each other player 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/21140.png` (1044×725 px, 168.6 KB)
### [21141] Hall of Nastrond
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (6/19)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 1[per_hero]. Victory 4.
  > ** When Defeated: ** The first player detaches Odin from the main scheme and takes control of him. Deal each player 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/21141.png` (1046×725 px, 159.5 KB)
### [21142] Gjallerbru
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (7/19)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1[per_hero]. Victory 3.
  > ** When Defeated: ** The first player reveals Hall of Nastrond and Nidhogg, and puts them into play. Deal each other player 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/21142.png` (1045×725 px, 179.7 KB)
### [21143] Garm
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (8/19)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature. Elite.*
- **Rules Text**:
  > Toughness. Victory 2.
  > Garm engages the first player.
  > ** Threat cannot be removed from Gnipahellir. **
- **Image Asset**: `assets/card-art/bundles/cards/21143.png` (727×1044 px, 168.1 KB)
### [21144] Skurge
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (9/19)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Elite.*
- **Rules Text**:
  > Toughness. Victory 3.
  > Skurge engages the first player.
  > [star] Skurge's attacks gain piercing.
  > **Threat cannot be removed from Gjallerbru.**
- **Image Asset**: `assets/card-art/bundles/cards/21144.png` (729×1043 px, 179.1 KB)
### [21145] Nidhogg
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (10/19)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 4 [star], **HP**: 6 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature. Elite.*
- **Rules Text**:
  > Toughness. Victory 4.
  > Nidhogg engages the first player.
  > [star] Nidhogg's attacks gain overkill.
  > **Threat cannot be removed from Hall of Nastrond.**
- **Image Asset**: `assets/card-art/bundles/cards/21145.png` (729×1044 px, 172.2 KB)
### [21146] Nightsword
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (11/19)
- **Properties**: Unique
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Hela.
  > [star] Hela's attacks gain piercing.
  >
  > ---
  >
  > [star] **Boost**: Attach Nightsword to Hela.
- **Image Asset**: `assets/card-art/bundles/cards/21146.png` (729×1044 px, 165.1 KB)
### [21147] Hela's Crown
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (12/19)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to Hela.
  > [star] **Forced Response: After Hela schemes, give her a facedown boost card.
  >
  > ---
  >
  > [star] Boost**: Attach Hela's Crown to Hela.
- **Image Asset**: `assets/card-art/bundles/cards/21147.png` (729×1044 px, 172.4 KB)
### [21148] Hela's Cloak
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (13/19)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Hela.
  > Hela gains stalwart.
  >
  > ---
  >
  > [star] **Boost**: Attach Hela's Cloak to Hela.
- **Image Asset**: `assets/card-art/bundles/cards/21148.png` (727×1044 px, 181.1 KB)
### [21149] Hela's Domain
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (14–15/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 1 threat on the main scheme. Place 1 additional threat on the main scheme for each side scheme in the victory display.
  >
  > ---
  >
  > [star] **Boost**: If damage from this attach defeats an ally, place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21149.png` (729×1043 px, 160.6 KB)
### [21150] The Queen of Hel
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (16–17/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ** When Revealed (Alter-Ego): ** Hela schemes. Place 1 threat on each side scheme.
  > ** When Revealed (Hero): ** Hela attacks you. Place 1 threat on each side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21150.png` (729×1044 px, 168.1 KB)
### [21151] The Wastes of Niffleheim
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Hela (18–19/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hela Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Take 1 indirect damage. Take 1 additional indirect damage for each side scheme in the victory display.
  >
  > ---
  >
  > [star] **Boost**: This card gains boost icons ([boost]) equal to the number of side schemes in the victory display.
- **Image Asset**: `assets/card-art/bundles/cards/21151.png` (729×1042 px, 184.8 KB)

### Set: Legions of Hel

### [21152] Draugr
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Legions of Hel (1–2/7, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Legions of Hel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Undead.*
- **Rules Text**:
  > Guard.
  > ** When Revealed**: Choose to either take 1 damage or place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21152.png` (729×1044 px, 168.2 KB)
### [21153] Fallen Warrior
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Legions of Hel (3–4/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Legions of Hel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Treat attached ally as an [[Undead]] minion with a blank text box. Attached minions SCH is equal to its printed THW and it does not take consequential damage.
  > **When Revealed**: Discard cards from top of your deck until you discard an ally. Put that ally into play engaged with you with Fallen Warrior attached to it
- **Image Asset**: `assets/card-art/bundles/cards/21153.png` (713×1044 px, 182.6 KB)
### [21154] No Place for the Living
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Legions of Hel (5/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Legions of Hel Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player must choose to either discard the upgrade or support they control with the highest cost, or take damage equal to the total number of upgrades and supports they control.
- **Image Asset**: `assets/card-art/bundles/cards/21154.png` (729×1043 px, 179.5 KB)
### [21155] Legions of Hel
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Legions of Hel (6–7/7, Qty: 2)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Legions of Hel Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Revealed**: Place 2 additional threat here for each [[undead]] minion in play. If there are no [[undead]] minions in play, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/21155.png` (1047×726 px, 180.8 KB)

### Set: Frost Giants

### [21156] Laufey
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Frost Giants (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 4 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Frost Giants Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Giant.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Response**: After Laufey attacks and damages a character, stun that character.
- **Image Asset**: `assets/card-art/bundles/cards/21156.png` (729×1044 px, 172.0 KB)
### [21157] Frost Giant
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Frost Giants (2–3/6, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Frost Giants Set Icon (printed bottom-right next to deck number)
- **Traits**: *Giant.*
- **Rules Text**:
  > Toughness. (This character enters play with a tough status card.)
  >
  > ---
  >
  > [star] **Boost**: If the villain is attacking and this attack deals damage to a character, stun that character.
- **Image Asset**: `assets/card-art/bundles/cards/21157.png` (730×1044 px, 175.1 KB)
### [21158] Frozen
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Frost Giants (4–5/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Frost Giants Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attack to your identity
  > Attached identity cannot ready.
  > **Alter-Ego Action: ** Spend [energy] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/21158.png` (728×1044 px, 161.6 KB)
### [21159] Unnatural Storm
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Frost Giants (6/6)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Frost Giants Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Heroes and allies cannot be readied by player card effects.
  > ** When Revealed**: Exhaust each ally in play.
- **Image Asset**: `assets/card-art/bundles/cards/21159.png` (1049×728 px, 164.0 KB)

### Set: Loki

### [21160] Loki
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (1/21)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > Victory 1.
  > Loki cannot take damage while a side scheme is in play.
  > ** When Defeated: ** Discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21160.png` (727×1044 px, 169.4 KB)
### [21161] Loki
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (2/21)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > Retaliate 1. Victory 1.
  > ** When Defeated: ** Discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21161.png` (729×1044 px, 176.9 KB)
### [21162] Loki
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (3/21)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > Stalwart. Victory 1.
  > ** When Defeated: ** Discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21162.png` (727×1044 px, 179.8 KB)
### [21163] Loki
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (4/21)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 3, **ATK**: 1, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > Stalwart. Victory 1.
  > ** When Defeated: ** Discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21163.png` (728×1045 px, 164.3 KB)
### [21164] Loki
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (5/21)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Mystic.*
- **Rules Text**:
  > Victory 1.
  > [star] Loki's attacks gain piercing.
  > ** When Defeated: ** Discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/21164.png` (728×1042 px, 170.0 KB)
### [21165] All Hail King Loki
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (6/21)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When Loki is defeated, advance to a random set-aside Loki villain.
  > ** If the number of Lokis in the victory display is equal to the victory condition, the players win the game. (See rule insert.) If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/21165.png` (1047×725 px, 162.7 KB)
### [21165a] All Hail King Loki
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (6/21)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Loki, Infinity Gauntlet, and Standard encounter sets. Two modular encounter sets. *(Enchantress and Frost Giants).*
  > **Setup**: Set each copy of the Loki villain aside, out of play. Put the War in Asgard side scheme into play. Shuffle the encounter deck. Reveal 1 set-aside Loki villain at random. Reveal the top card of the [[infinity stone]] deck.
### [21165b] All Hail King Loki
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (6/21)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When Loki is defeated, advance to a random set-aside Loki villain.
  > ** If the number of Lokis in the victory display is equal to the victory condition, the players win the game. (See rule insert.) If this stage is completed, the players lose the game.**
### [21166] Casket of Ancient Winters
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (7/21)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1[per_hero]
  > ** When Defeated: ** Reveal the top card of the [[infinity stone]] deck. Swap Loki with a random set-aside Loki villain.
- **Image Asset**: `assets/card-art/bundles/cards/21166.png` (1049×728 px, 177.5 KB)
### [21167] War in Asgard
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (8/21)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round), Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1[per_hero]
  > ** When Defeated: ** Reveal the top card of the [[infinity stone]] deck. Swap Loki with a random set-aside Loki villain.
- **Image Asset**: `assets/card-art/bundles/cards/21167.png` (1045×726 px, 166.9 KB)
### [21168] Madness on Midgard
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (9/21)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1[per_hero]
  > ** When Defeated: ** Reveal the top card of the [[infinity stone]] deck. Swap Loki with a random set-aside Loki villain.
- **Image Asset**: `assets/card-art/bundles/cards/21168.png` (1047×723 px, 181.2 KB)
### [21169] Open the Bifrost
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (10/21)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 1[per_hero]
  > ** When Defeated: ** Reveal the top card of the [[infinity stone]] deck. Swap Loki with a random set-aside Loki villain.
- **Image Asset**: `assets/card-art/bundles/cards/21169.png` (1045×726 px, 165.5 KB)
### [21170] Loki's Staff
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (11/21)
- **Properties**: Unique
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Loki.
  > ** Hero Response: ** After you make a basic attack against Loki, spend [energy] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attack this card to Loki.
- **Image Asset**: `assets/card-art/bundles/cards/21170.png` (728×1044 px, 165.4 KB)
### [21171] Loki's Crown
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (12/21)
- **Properties**: Unique
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to Loki.
  > ** Hero Response: ** After you make a basic attack against Loki, spend [mental] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Loki.
- **Image Asset**: `assets/card-art/bundles/cards/21171.png` (729×1042 px, 163.7 KB)
### [21172] Loki's Cape
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (13/21)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Loki.
  > **Forced Response**: After Loki is swapped with a set-aside Loki villain, give him a tough status card.
  > ** Hero Response: ** After you make a basic attack against Loki, spend [energy] [mental] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/21172.png` (729×1044 px, 177.9 KB)
### [21173] Master of Illusions
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (14/21)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Loki.
  > **Forced Interrupt**: When Loki would take damage from an attack, discard the top card of the encounter deck. If that card is a treachery, prevent all damage from this attack and discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/21173.png` (729×1044 px, 192.3 KB)
### [21174] Devious Sorcery
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (15–16/21, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ** When Revealed (Alter-Ego): ** You are stunned. If you were already stunned, place 2 threat on the main scheme.
  > ** When Revealed (Hero): ** You are stunned. If you were already stunned, take 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/21174.png` (730×1042 px, 183.9 KB)
### [21175] Infinite Mischief
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (17–18/21, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Shuffle the [[infinity stone]] deck discard pile into the [[infinity stone]] deck and reveal the top card.
  >
  > ---
  >
  > [star] **Boost**: Discard the top card of the [[infinity stone]] deck. Apply it's boost icons [boost] for this activation as if it were a boost card.
- **Image Asset**: `assets/card-art/bundles/cards/21175.png` (729×1044 px, 183.0 KB)
### [21176] The Trickster
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Loki (19–21/21, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Loki Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Swap Loki with a random set-aside Loki villain. Loki activates against you.
  >
  > ---
  >
  > [star] **Boost**: Give Loki an additional boost card and a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/21176.png` (729×1044 px, 148.8 KB)

### Set: Enchantress

### [21177] Enchantress
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Enchantress (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Elite.*
- **Rules Text**:
  > **When Revealed**: Search the encounter deck, discard pile, and set-aside area for a copy of Seduced and attach it to your identity. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/21177.png` (729×1044 px, 166.4 KB)
### [21178] Beguiled
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Enchantress (2–3/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Treat attached ally as an [[Enthralled]] minion with a blank text box. Attached minion's SCH is equal to its printed THW and it does not take consequential damage.
  > **When Revealed**: Attach to the ally with the highest cost without Beguiled attached. Attached ally engages its controller. Otherwise, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/21178.png` (730×1044 px, 188.6 KB)
### [21179] Seduced
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: Enchantress (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Enchantress Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your identity.
  > You cannot make basic attacks or play [[Attack]] events.
  > **Alter-Ego Action**: Spend [energy] [mental] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/21179.png` (728×1044 px, 169.2 KB)

### Set: The Mad Titan's Shadow Campaign

### [21180a] Secure the Landing Pad
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (1/23)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: Flip this card over.
- **Flavor**: *Cosmo and the Knowhere Corps do their best to prevent more Black Order forces from landing on the station, but they need help!*
- **Image Asset**: `assets/card-art/bundles/cards/21180a.png` (1046×725 px, 166.2 KB)
### [21180b] Cosmo
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (1/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Guardian.*
- **Rules Text**:
  > The first player gains control of Cosmo.
  > Cosmo does not count against the ally limit.
  > **Forced Interrupt**: When Cosmo leaves play, remove him from the game.
### [21181] Security Breach
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (2/23)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 2[per_hero]. Victory 2.
  > **When Revealed**: Each player places a random card from their hand facedown here.
  > **When Defeated**: Return each facedown card here to its owner's hand.
- **Image Asset**: `assets/card-art/bundles/cards/21181.png` (1045×725 px, 156.9 KB)
### [21182a] Save the Shawarma Place
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (3/23)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: Each player shuffles 1 copy of Shawarma into their deck. Flip this card over.
- **Flavor**: *Black Order soldiers run rampant through the city around Avengers Tower, threatening the heroes' favorite restaurant.*
- **Image Asset**: `assets/card-art/bundles/cards/21182a.png` (1046×724 px, 171.6 KB)
### [21182b] Black Swan
- **Type**: `Minion`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (3/23)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Black Order. Elite.*
- **Rules Text**:
  > Toughness. Victory 2.
  > Black Swan engages the first player.
  > **Forced Response**: After Black Swan engages you, discard 1 card from your hand.
- **Flavor**: *"Everything dies."*
### [21183] Shawarma
- **Type**: `Resource`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (4–7/23, Qty: 4)
- **Stats**: **Resources**: [energy] [physical] [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Flavor**: *"Have any of you ever tried shawarma?" —Tony Stark*
- **Image Asset**: `assets/card-art/bundles/cards/21183.png` (730×1043 px, 180.0 KB)
### [21184a] Hack Sanctuary's Computer
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (8/23)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: Each player searches their deck and discard pile for 1 card, adds it to their hand, and shuffles their deck. Flip this card over.
- **Flavor**: *In order to defeat Thanos, you must deactivate his ship's many defenses.*
- **Image Asset**: `assets/card-art/bundles/cards/21184a.png` (1046×724 px, 173.3 KB)
### [21184b] Defensive Protocols
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (8/23)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 2[per_hero]. Victory 2.
  > **Forced Interrupt**: When the player phase ends, place 1 crash counter here. If there are 2 crash counters here, each player adds 1 copy of the System Shock obligation card to their hand. Remove this card from the game.
- **Flavor**: *You've accidentally tripped Sanctuary's failsafe program!*
### [21185] System Shock
- **Type**: `Obligation`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (9–12/23, Qty: 4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > You cannot choose to discard this card from your hand.
  > While this card is in your hand, it gains: "**Alter-Ego Action**: Spend a [mental] resource → remove this card from the game."
- **Image Asset**: `assets/card-art/bundles/cards/21185.png` (729×1033 px, 168.3 KB)
### [21186a] Find the Norn Stones
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (13/23)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Threat cannot be removed from this scheme unless Hela has the [[Wounded]] trait.
  > **When Defeated**: Each player puts a copy of the Norn Stone upgrade into play under their control on its setup side. Flip this card over.
- **Image Asset**: `assets/card-art/bundles/cards/21186a.png` (1047×725 px, 167.1 KB)
### [21186b] Retrieve Odin's Armor
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (13/23)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 2[per_hero]. Victory 1.
  > Threat cannot be removed from this scheme unless the first player controls Odin.
  > **When Defeated**: Heal all damage from Odin and flip him to his [[King]] side.
- **Flavor**: *You've rescued Odin, but Hela still holds his armor in a secure vault.*
### [21187a] Norn Stone
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (14–17/23, Qty: 4)
- **Properties**: Permanent
- **Stats**: **Cost**: 0
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Artifact.*
- **Rules Text**:
  > Permanent. Setup.
  > Your hero gets +1 THW, +1 ATK, and +1 DEF.
  > **Hero Action**: Ready your hero. Flip this card over.
- **Image Asset**: `assets/card-art/bundles/cards/21187a.png` (729×1043 px, 164.9 KB)
### [21187b] Norn Stone
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (14–17/23, Qty: 4)
- **Properties**: Permanent
- **Stats**: **Cost**: 0
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Artifact.*
- **Rules Text**:
  > Permanent.
  > Your hero gets +1 THW, +1 ATK, and +1 DEF.
  > **Alter-Ego Action**: Exhaust Norn Stone to heal 1 damage from your identity.
### [21188] Summoned Back
- **Type**: `Treachery`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (18/23)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Peril. Surge.
  > **When Revealed**: Search the encounter deck, discard pile, and set-aside area for your nemesis minion and put it into play engaged with you. Shuffle the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/21188.png` (729×1044 px, 172.6 KB)
### [21189a] Open the Dungeons
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (19/23)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Defeated**: Each player chooses 1 [[Captive]] ally from the campaign set and puts it into play under their control. Flip this card over.
- **Flavor**: *Sif and the Warriors Three have been imprisoned by the usurper, Loki. They would be valuable allies if rescued!*
- **Image Asset**: `assets/card-art/bundles/cards/21189a.png` (1048×725 px, 168.4 KB)
### [21189b] Jormungand
- **Type**: `Attachment`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (19/23)
- **Properties**: Unique
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Dragon.*
- **Rules Text**:
  > Attach to Loki.
  > Loki gets +4[per_hero] hit points.
  > **Forced Interrupt**: When Loki is defeated, remove this card from the game.
### [21190] Lady Sif
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (20/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Captive.*
- **Rules Text**:
  > **Action**: Spend a [physical] resource → ready Lady Sif.
- **Flavor**: *"Was ever a maiden faced with a problem such as this?"*
- **Image Asset**: `assets/card-art/bundles/cards/21190.png` (729×1028 px, 158.1 KB)
### [21191] Fandral
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (21/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 3 [star] (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Captive.*
- **Rules Text**:
  > [star] When Fandral uses his basic THW, ignore any crisis icons ([crisis]) in play.
- **Flavor**: *"Though I hold life most dear, I will answer Loki for what he has done."*
- **Image Asset**: `assets/card-art/bundles/cards/21191.png` (729×1048 px, 161.0 KB)
### [21192] Hogun
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (22/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 1 (Consequential: 1), **ATK**: 3 [star] (Consequential: 2), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Captive.*
- **Rules Text**:
  > [star] Hogun's attacks gain piercing.
- **Flavor**: *"Loki has gone too far this time. He must be ended."*
- **Image Asset**: `assets/card-art/bundles/cards/21192.png` (730×1045 px, 155.0 KB)
### [21193] Volstagg
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: The Mad Titan's Shadow (`mts`)
- **Deck / Set**: The Mad Titan's Shadow Campaign (23/23)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 5, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: The Mad Titan's Shadow Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Asgard. Captive.*
- **Rules Text**:
  > Retaliate 1. *(After this character is attacked, deal 1 damage to the attacking character.)* 
  > Toughness. *(This character enters play with a tough status card.)*
- **Flavor**: *"The mighty Volstagg will right these wrongs!"*
- **Image Asset**: `assets/card-art/bundles/cards/21193.png` (730×1044 px, 175.1 KB)

