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
| `45001a` | Bishop | Hero | Bishop | THW:2 ATK:2 DEF:1 HP:12 | - | `aoa` |
| `45001b` | Lucas Bishop | Alter-Ego | Bishop | HP:12 | - | `aoa` |
| `45002` | Malcolm | Ally | Bishop | THW:1 ATK:2 HP:3 | - | `aoa` |
| `45003` | Randall | Ally | Bishop | THW:2 ATK:1 HP:3 | - | `aoa` |
| `45004` | Bishop's Rifle | Upgrade | Bishop | - | - | `aoa` |
| `45005` | Bishop's Uniform | Upgrade | Bishop | - | - | `aoa` |
| `45006` | Super-Charged | Upgrade | Bishop | - | - | `aoa` |
| `45007` | Concussive Blast | Event | Bishop | - | - | `aoa` |
| `45008` | Command Authority | Event | Bishop | - | - | `aoa` |
| `45009` | Energy Conversion | Event | Bishop | - | - | `aoa` |
| `45010` | Stored Energy | Resource | Bishop | - | - | `aoa` |
| `45011` | Cable | Ally | Pack Position: 11 | THW:2 ATK:3 HP:3 | - | `aoa` |
| `45012` | X-23 | Ally | Pack Position: 12 | THW:1 ATK:3 HP:3 | - | `aoa` |
| `45013` | Team Training | Support | Pack Position: 13 | - | - | `aoa` |
| `45014` | Advanced Suit | Upgrade | Pack Position: 14 | - | - | `aoa` |
| `45015` | Sidekick | Upgrade | Pack Position: 15 | - | - | `aoa` |
| `45016` | Side-by-Side | Event | Pack Position: 16 | - | - | `aoa` |
| `45017` | Suit Up | Event | Pack Position: 17 | - | - | `aoa` |
| `45018` | Lead from the Front | Event | Pack Position: 18 | - | - | `aoa` |
| `45019` | The Power of Leadership | Resource | Pack Position: 19 | - | - | `aoa` |
| `45020` | Legion | Ally | Pack Position: 20 | THW:1 ATK:1 HP:3 | - | `aoa` |
| `45021` | Marrow | Ally | Pack Position: 21 | THW:1 ATK:2 HP:2 | - | `aoa` |
| `45022` | Energy | Resource | Pack Position: 22 | - | - | `aoa` |
| `45023` | Genius | Resource | Pack Position: 23 | - | - | `aoa` |
| `45024` | Strength | Resource | Pack Position: 24 | - | - | `aoa` |
| `45025` | Fear the Future | Obligation | Bishop | - | 2 pips | `aoa` |
| `45026` | Trevor Fitzroy | Minion | Bishop Nemesis | SCH:2 ATK:3 HP:5 | 3 pips | `aoa` |
| `45027` | Portal Through Time | Side Scheme | Bishop Nemesis | - | 3 pips | `aoa` |
| `45028` | Bantam | Minion | Bishop Nemesis | SCH:2 ATK:2 HP:3 | 2 pips | `aoa` |
| `45029` | Temporal Trickery | Treachery | Bishop Nemesis | - | 2 pips | `aoa` |
| `45030a` | Magik | Hero | Magik | THW:1 ATK:2 DEF:2 HP:10 | - | `aoa` |
| `45030b` | Illyana Rasputin | Alter-Ego | Magik | HP:10 | - | `aoa` |
| `45031` | Colossus | Ally | Magik | THW:2 ATK:2 HP:3 | - | `aoa` |
| `45032` | Limbo | Support | Magik | - | - | `aoa` |
| `45033` | Magik's Crown | Upgrade | Magik | - | - | `aoa` |
| `45034` | Soulsword | Upgrade | Magik | - | - | `aoa` |
| `45035` | Mystical Armor | Upgrade | Magik | - | - | `aoa` |
| `45036` | Scrying | Event | Magik | - | - | `aoa` |
| `45037` | Stepping Disc | Event | Magik | - | - | `aoa` |
| `45038` | Exorcism | Event | Magik | - | - | `aoa` |
| `45039` | Soul Strike | Event | Magik | - | - | `aoa` |
| `45040` | Magic Barrier | Event | Magik | - | - | `aoa` |
| `45041` | Goldballs | Ally | Pack Position: 41 | THW:1 ATK:1 HP:3 | - | `aoa` |
| `45042` | Tempus | Ally | Pack Position: 42 | THW:1 ATK:1 HP:2 | - | `aoa` |
| `45043` | Blood Rage | Upgrade | Pack Position: 43 | - | - | `aoa` |
| `45044` | Test the Defense | Upgrade | Pack Position: 44 | - | - | `aoa` |
| `45045` | Full-Body Charge | Event | Pack Position: 45 | - | - | `aoa` |
| `45046` | Clobber | Event | Pack Position: 46 | - | - | `aoa` |
| `45047` | The Power of Aggression | Resource | Pack Position: 47 | - | - | `aoa` |
| `45048` | Triage | Ally | Pack Position: 48 | THW:1 ATK:1 HP:2 | - | `aoa` |
| `45049` | Stepford Cuckoos | Support | Pack Position: 49 | - | - | `aoa` |
| `45050` | Bloodgem | Upgrade | Pack Position: 50 | - | - | `aoa` |
| `45051` | Basic Spell | Event | Pack Position: 51 | - | - | `aoa` |
| `45052` | Spiritual Meditation | Event | Pack Position: 52 | - | - | `aoa` |
| `45053` | Darkchilde | Obligation | Magik | - | 2 pips | `aoa` |
| `45054` | Belasco | Minion | Magik Nemesis | SCH:1 ATK:1 HP:6 | 3 pips | `aoa` |
| `45055` | Ruler of Limbo | Side Scheme | Magik Nemesis | - | 3 pips | `aoa` |
| `45056` | S'ym | Minion | Magik Nemesis | SCH:2 ATK:2 HP:5 | 2 pips | `aoa` |
| `45057` | Witchfire | Minion | Magik Nemesis | SCH:1 ATK:3 HP:4 | 2 pips | `aoa` |
| `45058` | Battle for Limbo | Treachery | Magik Nemesis | - | Star | `aoa` |
| `45059` | Unus | Villain | Unus | SCH:1 ATK:2 HP:12 | - | `aoa` |
| `45060` | Unus | Villain | Unus | SCH:2 ATK:2 HP:15 | - | `aoa` |
| `45061` | Unus | Villain | Unus | SCH:2 ATK:3 HP:18 | - | `aoa` |
| `45062` | Hunting Gene Traitors | Main Scheme | Unus | - | - | `aoa` |
| `45062a` | Hunting Gene Traitors | Main Scheme | Unus | - | - | `aoa` |
| `45062b` | Hunting Gene Traitors | Main Scheme | Unus | - | - | `aoa` |
| `45063` | Prelate Sidearm | Attachment | Unus | ATK:1 | 3 pips | `aoa` |
| `45064` | Prelate Armor | Attachment | Unus | SCH:1 | 3 pips | `aoa` |
| `45065` | Infinite Hunter | Minion | Unus | SCH:2 ATK:3 HP:4 | Star | `aoa` |
| `45066` | Genetic Experiments | Attachment | Unus | SCH:1 ATK:1 | Star | `aoa` |
| `45067` | Infinite Prelate | Treachery | Unus | - | 2 pips | `aoa` |
| `45068` | Endless Ranks | Side Scheme | Unus | - | 2 pips | `aoa` |
| `45069` | Infinite Soldier | Minion | Infinites | SCH:1 ATK:2 HP:3 | 1 pips | `aoa` |
| `45070` | Culling the Weak | Treachery | Infinites | - | Star | `aoa` |
| `45071` | Gene Pool | Side Scheme | Infinites | - | - | `aoa` |
| `45072` | Hunted | Obligation | Dystopian Nightmare | - | 2 pips | `aoa` |
| `45073` | War-Weary | Treachery | Dystopian Nightmare | - | Star | `aoa` |
| `45074` | Targeted for Extermination | Side Scheme | Dystopian Nightmare | - | 2 pips | `aoa` |
| `45075a` | Pursued by the Past | Environment | Standard III | - | - | `aoa` |
| `45075b` | Pursued by the Past | Environment | Standard III | - | - | `aoa` |
| `45076` | Dark Designs | Treachery | Standard III | - | Star | `aoa` |
| `45077` | Sinister Strike | Treachery | Standard III | - | 1 pips | `aoa` |
| `45078` | Evil Alliance | Treachery | Standard III | - | Star | `aoa` |
| `45079` | Nowhere is Safe | Treachery | Standard III | - | Star | `aoa` |
| `45080` | Drawing Near | Obligation | Standard III | - | 2 pips | `aoa` |
| `45081a` | War | Villain | Four Horsemen | SCH:1 ATK:2 HP:9 | - | `aoa` |
| `45081b` | War | Villain | Four Horsemen | SCH:2 ATK:3 HP:12 | - | `aoa` |
| `45082a` | Famine | Villain | Four Horsemen | SCH:2 ATK:1 HP:9 | - | `aoa` |
| `45082b` | Famine | Villain | Four Horsemen | SCH:3 ATK:2 HP:12 | - | `aoa` |
| `45083a` | Pestilence | Villain | Four Horsemen | SCH:2 ATK:1 HP:9 | - | `aoa` |
| `45083b` | Pestilence | Villain | Four Horsemen | SCH:3 ATK:2 HP:12 | - | `aoa` |
| `45084a` | Death | Villain | Four Horsemen | SCH:1 ATK:2 HP:9 | - | `aoa` |
| `45084b` | Death | Villain | Four Horsemen | SCH:2 ATK:3 HP:12 | - | `aoa` |
| `45085` | The Horsemen of Apocalypse | Main Scheme | Four Horsemen | - | - | `aoa` |
| `45085a` | The Horsemen of Apocalypse | Main Scheme | Four Horsemen | - | - | `aoa` |
| `45085b` | The Horsemen of Apocalypse | Main Scheme | Four Horsemen | - | - | `aoa` |
| `45086` | The Ravages of War | Side Scheme | Four Horsemen | - | 3 pips | `aoa` |
| `45087` | A Time of Famine | Side Scheme | Four Horsemen | - | 3 pips | `aoa` |
| `45088` | Plague and Pestilence | Side Scheme | Four Horsemen | - | 3 pips | `aoa` |
| `45089` | The Specter of Death | Side Scheme | Four Horsemen | - | 3 pips | `aoa` |
| `45090` | Golden Horse | Attachment | Four Horsemen | SCH:1 ATK:1 | 2 pips | `aoa` |
| `45091` | Metal Wings | Attachment | Four Horsemen | SCH:1 ATK:1 | 2 pips | `aoa` |
| `45092` | Horseman of War | Treachery | Four Horsemen | - | Star | `aoa` |
| `45093` | Horseman of Famine | Treachery | Four Horsemen | - | Star | `aoa` |
| `45094` | Horseman of Pestilence | Treachery | Four Horsemen | - | Star | `aoa` |
| `45095` | Horseman of Death | Treachery | Four Horsemen | - | Star | `aoa` |
| `45096` | Rough Riders | Treachery | Four Horsemen | - | 2 pips | `aoa` |
| `45097` | Ahab | Minion | Hounds | SCH:2 ATK:3 HP:5 | 3 pips | `aoa` |
| `45098` | Hound | Minion | Hounds | SCH:1 ATK:2 HP:2 | 1 pips | `aoa` |
| `45099` | Ahab's Energy Spear | Attachment | Hounds | ATK:2 | 2 pips | `aoa` |
| `45100` | Release the Hounds | Side Scheme | Hounds | - | 3 pips | `aoa` |
| `45101a` | Apocalypse | Villain | Apocalypse | SCH:1 ATK:2 HP:8 | - | `aoa` |
| `45101b` | Apocalypse | Villain | Apocalypse | SCH:2 ATK:2 HP:9 | - | `aoa` |
| `45102a` | Apocalypse | Villain | Apocalypse | SCH:2 ATK:3 HP:10 | - | `aoa` |
| `45102b` | Apocalypse | Villain | Apocalypse | SCH:3 ATK:3 HP:11 | - | `aoa` |
| `45103` | The Age of Apocalypse | Main Scheme | Apocalypse | - | - | `aoa` |
| `45103a` | The Age of Apocalypse | Main Scheme | Apocalypse | - | - | `aoa` |
| `45103b` | The Age of Apocalypse | Main Scheme | Apocalypse | - | - | `aoa` |
| `45104a` | Heart of the Empire | Side Scheme | Apocalypse | - | - | `aoa` |
| `45105a` | The Tyrant's Throne | Side Scheme | Apocalypse | - | - | `aoa` |
| `45105b` | No Longer Worthy | Attachment | Apocalypse | - | - | `aoa` |
| `45106` | Cyberpathy | Attachment | Apocalypse | SCH:1 | Star | `aoa` |
| `45107` | Biomorphing | Attachment | Apocalypse | ATK:1 | Star | `aoa` |
| `45108` | Molecular Control | Attachment | Apocalypse | - | Star | `aoa` |
| `45109` | The Fittest | Attachment | Apocalypse | SCH:1 ATK:1 | 2 pips | `aoa` |
| `45110` | Wolf Among Sheep | Treachery | Apocalypse | - | Star | `aoa` |
| `45111` | The Apocalypse Solution | Side Scheme | Apocalypse | - | 3 pips | `aoa` |
| `45112` | Gauntlet | Minion | Dark Riders | SCH:2 ATK:2 HP:5 | 2 pips | `aoa` |
| `45113` | Barrage | Minion | Dark Riders | SCH:1 ATK:2 HP:4 | 1 pips | `aoa` |
| `45114` | Hard-Drive | Minion | Dark Riders | SCH:2 ATK:1 HP:4 | 1 pips | `aoa` |
| `45115` | Tusk | Minion | Dark Riders | SCH:0 ATK:2 HP:6 | Star | `aoa` |
| `45116` | Psynapse | Minion | Dark Riders | SCH:2 ATK:1 HP:3 | Star | `aoa` |
| `45117` | The Dark Riders | Side Scheme | Dark Riders | - | 3 pips | `aoa` |
| `45118` | Dark Beast | Villain | Dark Beast | SCH:2 ATK:2 HP:15 | - | `aoa` |
| `45119` | Dark Beast | Villain | Dark Beast | SCH:2 ATK:2 HP:18 | - | `aoa` |
| `45120` | Dark Beast | Villain | Dark Beast | SCH:3 ATK:2 HP:22 | - | `aoa` |
| `45121` | Dark Beast's Bogus Journey | Main Scheme | Dark Beast | - | - | `aoa` |
| `45121a` | Dark Beast's Bogus Journey | Main Scheme | Dark Beast | - | - | `aoa` |
| `45121b` | Dark Beast's Bogus Journey | Main Scheme | Dark Beast | - | - | `aoa` |
| `45122` | High-Tech Goggles | Attachment | Dark Beast | SCH:1 | Star | `aoa` |
| `45123` | Genetic Enhancement | Attachment | Dark Beast | ATK:1 | Star | `aoa` |
| `45124` | Cruel Experiment | Attachment | Dark Beast | SCH:1 ATK:1 | 2 pips | `aoa` |
| `45125` | Evil Genius | Treachery | Dark Beast | - | 1 pips | `aoa` |
| `45126` | Time-Travel Shenanigans | Side Scheme | Dark Beast | - | 2 pips | `aoa` |
| `45127` | The Savage Land | Environment | Savage Land | - | 3 pips | `aoa` |
| `45128` | Pterosaur | Minion | Savage Land | SCH:0 ATK:3 HP:4 | Star | `aoa` |
| `45129` | Velociraptor | Minion | Savage Land | ATK:1 HP:3 | 1 pips | `aoa` |
| `45130` | Giant Ape | Minion | Savage Land | SCH:1 ATK:2 HP:5 | 2 pips | `aoa` |
| `45131` | Land Out of Time | Treachery | Savage Land | - | 3 pips | `aoa` |
| `45132` | Village Under Attack | Side Scheme | Savage Land | - | 2 pips | `aoa` |
| `45133` | Genosha | Environment | Genosha | - | 3 pips | `aoa` |
| `45134` | Magistrate | Minion | Genosha | SCH:2 ATK:2 HP:3 | Star | `aoa` |
| `45135` | Armored Unibike | Minion | Genosha | SCH:1 ATK:2 HP:4 | 1 pips | `aoa` |
| `45136` | Genoshan Mech | Minion | Genosha | SCH:2 ATK:3 HP:5 | 2 pips | `aoa` |
| `45137` | Escaped Mutant | Attachment | Genosha | - | 3 pips | `aoa` |
| `45138` | Police State | Side Scheme | Genosha | - | 2 pips | `aoa` |
| `45139` | Blue Area of the Moon | Environment | Blue Moon | - | 3 pips | `aoa` |
| `45140` | Gladiator | Minion | Blue Moon | SCH:2 ATK:3 HP:6 | Star | `aoa` |
| `45141` | Oracle | Minion | Blue Moon | SCH:2 ATK:1 HP:3 | 1 pips | `aoa` |
| `45142` | Manta | Minion | Blue Moon | SCH:1 ATK:2 HP:4 | 1 pips | `aoa` |
| `45143` | Earthquake | Minion | Blue Moon | SCH:2 ATK:2 HP:4 | 2 pips | `aoa` |
| `45144` | Warstar | Minion | Blue Moon | SCH:1 ATK:2 HP:5 | 2 pips | `aoa` |
| `45145` | Imperial Guardsman | Attachment | Blue Moon | - | 2 pips | `aoa` |
| `45146` | Trial by Combat | Side Scheme | Blue Moon | - | 2 pips | `aoa` |
| `45147` | En Sabah Nur's Pyramid | Main Scheme | En Sabah Nur | - | - | `aoa` |
| `45147a` | En Sabah Nur's Pyramid | Main Scheme | En Sabah Nur | - | - | `aoa` |
| `45147b` | En Sabah Nur's Pyramid | Main Scheme | En Sabah Nur | - | - | `aoa` |
| `45148` | The Rise of Apocalypse | Main Scheme | En Sabah Nur | - | - | `aoa` |
| `45148a` | The Rise of Apocalypse | Main Scheme | En Sabah Nur | - | - | `aoa` |
| `45148b` | The Rise of Apocalypse | Main Scheme | En Sabah Nur | - | - | `aoa` |
| `45149` | Staggering Strength | Attachment | En Sabah Nur | ATK:2 | Star | `aoa` |
| `45150` | Biomorphic Blast | Treachery | En Sabah Nur | - | Star | `aoa` |
| `45151` | Technological Interface | Treachery | En Sabah Nur | - | Star | `aoa` |
| `45152` | Giant-Sized Despot | Treachery | En Sabah Nur | - | Star | `aoa` |
| `45153` | Source of Power | Side Scheme | En Sabah Nur | - | 3 pips | `aoa` |
| `45154` | Plugged In | Side Scheme | En Sabah Nur | - | 3 pips | `aoa` |
| `45155` | Giant Growth | Side Scheme | En Sabah Nur | - | 3 pips | `aoa` |
| `45156` | Celestial Armor | Attachment | Celestial Tech | SCH:0 | 2 pips | `aoa` |
| `45157` | Celestial Weapon | Attachment | Celestial Tech | ATK:0 | 2 pips | `aoa` |
| `45158` | Celestial Tech | Treachery | Celestial Tech | - | 1 pips | `aoa` |
| `45159` | Ozymandias | Minion | Clan Akkaba | SCH:1 ATK:1 HP:6 | Star | `aoa` |
| `45160` | Scarab | Minion | Clan Akkaba | SCH:1 ATK:3 HP:5 | 3 pips | `aoa` |
| `45161` | Clan Akkaba Zealot | Minion | Clan Akkaba | SCH:2 ATK:2 HP:3 | 2 pips | `aoa` |
| `45162` | Tyrant Worship | Treachery | Clan Akkaba | - | Star | `aoa` |
| `45163` | Ancient Ritual | Side Scheme | Clan Akkaba | - | - | `aoa` |
| `45164` | Agent of Apocalypse | Minion | Age of Apocalypse | SCH:2 ATK:2 HP:3 | Star | `aoa` |
| `45165` | Worldwide Crisis | Treachery | Age of Apocalypse | - | Star | `aoa` |
| `45166a` | Liberate the Seattle Core | Side Scheme | Mission | - | - | `aoa` |
| `45166b` | Liberate the Seattle Core | Side Scheme | Mission | - | - | `aoa` |
| `45167a` | Evacuate Survivors | Side Scheme | Mission | - | - | `aoa` |
| `45167b` | Evacuate Survivors | Side Scheme | Mission | - | - | `aoa` |
| `45168a` | Sabotage the Sea Wall | Side Scheme | Mission | - | - | `aoa` |
| `45168b` | Sabotage the Sea Wall | Side Scheme | Mission | - | - | `aoa` |
| `45169a` | Find Lost Mutants | Side Scheme | Mission | - | - | `aoa` |
| `45169b` | Find Lost Mutants | Side Scheme | Mission | - | - | `aoa` |
| `45170a` | Protect the Professor | Side Scheme | Mission | - | - | `aoa` |
| `45170b` | Protect the Professor | Side Scheme | Mission | - | - | `aoa` |
| `45171a` | Mission Team | Support | Campaign | - | - | `aoa` |
| `45171b` | Mission Team | Support | Campaign | - | - | `aoa` |
| `45172` | Destiny | Ally | Campaign | THW:3 ATK:1 HP:3 | - | `aoa` |
| `45173` | Blink | Ally | Campaign | THW:2 ATK:2 HP:3 | - | `aoa` |
| `45174` | Morph | Ally | Campaign | THW:2 ATK:2 HP:3 | - | `aoa` |
| `45175` | X-Man | Ally | Campaign | THW:1 ATK:3 HP:3 | - | `aoa` |
| `45176` | Desperate Measures | Upgrade | Campaign | - | - | `aoa` |
| `45177` | North American Sea Wall | Side Scheme | Campaign | - | 2 pips | `aoa` |
| `45178` | Panicked Refugees | Obligation | Campaign | - | - | `aoa` |
| `45179a` | Mister Sinister | Minion | Overseer | HP:5 | - | `aoa` |
| `45179b` | Mister Sinister | Minion | Prelates | SCH:1 ATK:1 HP:5 | 3 pips | `aoa` |
| `45180a` | The Shadow King | Minion | Overseer | HP:5 | - | `aoa` |
| `45180b` | The Shadow King | Minion | Prelates | SCH:3 ATK:1 HP:5 | 3 pips | `aoa` |
| `45181a` | Abyss | Minion | Overseer | HP:5 | - | `aoa` |
| `45181b` | Abyss | Minion | Prelates | SCH:2 ATK:2 HP:5 | 3 pips | `aoa` |
| `45182a` | Sugar Man | Minion | Overseer | HP:5 | - | `aoa` |
| `45182b` | Sugar Man | Minion | Prelates | SCH:1 ATK:3 HP:5 | 3 pips | `aoa` |
| `45183a` | Mikhail Rasputin | Minion | Overseer | HP:5 | - | `aoa` |
| `45183b` | Mikhail Rasputin | Minion | Prelates | SCH:2 ATK:2 HP:5 | 3 pips | `aoa` |
| `45184a` | Apocalypse | Villain | En Sabah Nur | SCH:1 ATK:2 HP:16 | - | `aoa` |
| `45184b` | Apocalypse | Villain | En Sabah Nur | SCH:2 ATK:1 HP:16 | - | `aoa` |
| `45184c` | Apocalypse | Villain | En Sabah Nur | SCH:2 ATK:2 HP:16 | - | `aoa` |
| `45185a` | Apocalypse | Villain | En Sabah Nur | SCH:1 ATK:3 HP:20 | - | `aoa` |
| `45185b` | Apocalypse | Villain | En Sabah Nur | SCH:3 ATK:1 HP:20 | - | `aoa` |
| `45185c` | Apocalypse | Villain | En Sabah Nur | SCH:2 ATK:3 HP:20 | - | `aoa` |
| `45186a` | Apocalypse | Villain | En Sabah Nur | SCH:2 ATK:3 HP:24 | - | `aoa` |
| `45186b` | Apocalypse | Villain | En Sabah Nur | SCH:3 ATK:2 HP:24 | - | `aoa` |
| `45186c` | Apocalypse | Villain | En Sabah Nur | SCH:3 ATK:3 HP:24 | - | `aoa` |

---

## Pack: Age of Apocalypse (`aoa`)

### Set: Bishop

### [45001a] Bishop
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 1, **HP**: 12, **Hand Size**: 5
- **Traits**: *Temporal. X-Men.*
- **Rules Text**:
  > *Energy Absorption* — **Response**: After Bishop takes any amount of damage from an attack, discard an equal number of cards from the top of your deck. Add each resource card discarded this way to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/45001a.png` (300×418 px, 219.6 KB)
### [45001b] Lucas Bishop
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 12, **Hand Size**: 6
- **Traits**: *Mutant. Temporal.*
- **Rules Text**:
  > *Temporally Displaced* — **Response**: After you change to this form, add a [[TEMPORAL]] card in your discard pile to your hand.
- **Flavor**: *"When I journeyed to the past to save my future, this was not what I had in mind."*
- **Image Asset**: `assets/card-art/bundles/cards/45001b.png` (300×418 px, 193.9 KB)
### [45002] Malcolm
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Temporal. X-Men.*
- **Rules Text**:
  > **Action**: Discard a resource card from your hand → ready Malcolm. If that card has a printed [physical] icon, heal 1 damage from Malcolm. (Limit once per phase.)
- **Flavor**: *"Multiple contacts. Engaging."*
- **Image Asset**: `assets/card-art/bundles/cards/45002.jpg` (710×1030 px, 383.8 KB)
### [45003] Randall
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Temporal. X-Men.*
- **Rules Text**:
  > **Action**: Discard a resource card from your hand → ready Randall. If that card has a printed [energy] icon, heal 1 damage from Randall. (Limit once per phase.)
- **Flavor**: *"We're with you, boss. All the way."*
- **Image Asset**: `assets/card-art/bundles/cards/45003.png` (710×1030 px, 367.1 KB)
### [45004] Bishop's Rifle
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Temporal. Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Action** *(attack)*: Exhaust Bishop's Rifle and choose an enemy → deal 1 damage to that enemy for each resource card in your hand. This attack gains ranged.
- **Image Asset**: `assets/card-art/bundles/cards/45004.jpg` (710×1030 px, 324.9 KB)
### [45005] Bishop's Uniform
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (4/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Item. Temporal.*
- **Rules Text**:
  > **Response**: After you resolve Bishop's *"Energy Absorption"* ability, exhaust Bishop's Uniform → heal 1 damage from Bishop for each resource card in your hand.
- **Image Asset**: `assets/card-art/bundles/cards/45005.png` (710×1030 px, 334.2 KB)
### [45006] Super-Charged
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (5–6/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Action**: Discard a resource card from your hand → place 1 charge counter here for each resource icon on that card.
  > **Hero Interrupt**: When you make a basic attack, discard Super-Charged → you get +2 ATK for this attack for each charge counter here (to a maximum of +8 ATK).
- **Image Asset**: `assets/card-art/bundles/cards/45006.png` (710×1030 px, 318.0 KB)
### [45007] Concussive Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (7–8/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 6 damage to an enemy. If you paid for this event with a resource card, ready Bishop.
- **Flavor**: *Bishop's power allows him to absorb energy and rechannel it into powerful blasts.*
- **Image Asset**: `assets/card-art/bundles/cards/45007.jpg` (710×1030 px, 314.2 KB)
### [45008] Command Authority
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (9–10/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. If you paid for this event with a resource card, draw 1 card.
- **Flavor**: *"Everyone, on me!" —Bishop*
- **Image Asset**: `assets/card-art/bundles/cards/45008.jpg` (710×1030 px, 308.6 KB)
### [45009] Energy Conversion
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (11–12/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When an enemy attacks, shuffle each resource card in your discard pile into your deck. You cannot take more than 3 damage from this attack.
- **Image Asset**: `assets/card-art/bundles/cards/45009.png` (710×1030 px, 399.8 KB)
### [45010] Stored Energy
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (13–15/15, Qty: 3)
- **Stats**: **Resources**: [energy] [physical]
- **Traits**: *Temporal.*
- **Flavor**: *"The more you hit me, the harder I hit back!" —Bishop*
- **Image Asset**: `assets/card-art/bundles/cards/45010.jpg` (710×1030 px, 313.0 KB)
### [45025] Fear the Future
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bishop Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Lucas Bishop player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Lucas Bishop → remove Fear the Future from the game.
  > • Discard this card and each resource card from your hand. If no resource cards are discarded this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/45025.jpg` (710×1030 px, 376.4 KB)

### Set: Leadership

### [45011] Cable — *Nathan Summers*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 3, **Resources**: [mental]
- **Traits**: *Psionic. X-Force.*
- **Rules Text**:
  > **Response**: After Cable thwarts and defeats a side scheme, draw 1 card.
- **Flavor**: *"I know too much about what the future holds."*
- **Image Asset**: `assets/card-art/bundles/cards/45011.png` (710×1030 px, 321.6 KB)
### [45012] X-23 — *Laura Kinney*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *X-Force.*
- **Rules Text**:
  > **Response**: After X-23 attacks and defeats an enemy, ready her.
- **Flavor**: *"Call me 'Lady-Wolverine' one more time - I dare you!"*
- **Image Asset**: `assets/card-art/bundles/cards/45012.png` (710×1030 px, 288.1 KB)
### [45013] Team Training
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > Each ally you control gets +1 hit point.
- **Flavor**: *"We mostly just wait for Cap to yell 'Avengers Assemble' and attack in the same direction as him" —Clint Barton*
- **Image Asset**: `assets/card-art/bundles/cards/45013.jpg` (710×1030 px, 277.6 KB)
### [45014] Advanced Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Armor. Item.*
- **Rules Text**:
  > Attach to an [[X-FORCE]] or [[X-MEN]] ally. Max 1 per ally.
  > **Response**: After attached ally defeats a minion or side scheme, discard 1 card from your hand → heal 1 damage from attached ally for each resource on that card.
- **Image Asset**: `assets/card-art/bundles/cards/45014.png` (710×1030 px, 279.2 KB)
### [45015] Sidekick
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Title.*
- **Rules Text**:
  > Attach to an identity-specific ally you control. Max 1 per deck.
  > Attached ally gets +2 hit points and is your "sidekick."
  > **Response**: After you make a basic recovery, heal 2 damage from attached ally.
- **Image Asset**: `assets/card-art/bundles/cards/45015.jpg` (710×1030 px, 283.6 KB)
### [45016] Side-by-Side
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Rules Text**:
  > **Hero Action**: Ready your sidekick → ready your hero and choose one:
  > • Heal 1 damage from both characters.
  > • Both characters get +1 THW and +1 ATK until the end of the phase.
- **Image Asset**: `assets/card-art/bundles/cards/45016.jpg` (710×1030 px, 300.8 KB)
### [45017] Suit Up
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Rules Text**:
  > **Alter-Ego Action**: Search your deck and discard pile for an ally and an upgrade that can be attached to that ally. Add them to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/45017.png` (710×1030 px, 294.6 KB)
### [45018] Lead from the Front
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: Choose a player. Each character that player controls gets +1 THW and +1 ATK until the end of the phase.
- **Flavor**: *"Let's go everyone!" —Carol Danvers*
- **Image Asset**: `assets/card-art/bundles/cards/45018.png` (710×1030 px, 320.6 KB)
### [45019] The Power of Leadership
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 19
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Leadership *(blue)* card.
- **Image Asset**: `assets/card-art/bundles/cards/45019.jpg` (710×1030 px, 321.9 KB)

### Set: Basic

### [45020] Legion — *David Haller*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 [star] (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > [star] **Response**: After Legion uses a basic power, discard the top card of your deck. If that card's printed resource has:
  > [energy] — Deal 2 damage to an enemy.
  > [mental] — Remove 2 threat from a scheme.
  > [physical] — Heal 2 damage from Legion.
- **Image Asset**: `assets/card-art/bundles/cards/45020.jpg` (710×1030 px, 315.9 KB)
### [45021] Marrow — *Sarah*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *X-Force.*
- **Rules Text**:
  > Play only if you have the [[X-FORCE]] or [[X-MEN]] trait.
  > **Response**: After Marrow enters play, deal 2 damage to an enemy.
- **Flavor**: *"You won't look so pretty once I get you!"*
- **Image Asset**: `assets/card-art/bundles/cards/45021.png` (710×1030 px, 363.2 KB)
### [45022] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
### [45023] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
### [45024] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
### [45048] Triage — *Christopher Muse*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 48
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Triage enters play, heal 2 damage from an [[X-Men]] character.
- **Flavor**: *"Let me have a look at that."*
- **Image Asset**: `assets/card-art/bundles/cards/45048.png` (710×1030 px, 292.5 KB)
### [45049] Stepford Cuckoos
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 49
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Persona. Psionic.*
- **Rules Text**:
  > Play only if your identity has the [[X-Men]] trait. Uses (3 psi counters).
  > **Interrupt**: When a player reveals a treachery, exhaust Stepford Cuckoos and remove 1 psi counter here → cancel the effects of that card and discard it. That player reveals another encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/45049.jpg` (710×1030 px, 384.2 KB)
### [45050] Bloodgem
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Traits**: *Item.*
- **Rules Text**:
  > Play only if your identity has the [[MYSTIC]] trait. Max 1 per deck.
  > **Resource**: Exhaust Bloodgem and take 2 damage → generate a [wild] resource.
- **Image Asset**: `assets/card-art/bundles/cards/45050.png` (710×1030 px, 299.5 KB)
### [45051] Basic Spell
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Spell.*
- **Rules Text**:
  > Play only if your identity has the [[MYSTIC]] trait.
  > **Hero Action**: Choose one:
  > • Heal 3 damage from an identity.
  > • Remove 3 threat from a scheme.
  > • Deal 3 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/45051.jpg` (710×1030 px, 330.3 KB)
### [45052] Spiritual Meditation
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Spell.*
- **Rules Text**:
  > Play only if your identity has the [[Mystic]] trait.
  > **Action**: Draw 2 cards. Choose and discard 1 card from your hand.
- **Flavor**: *"Every spell, every sigil, every manipulation... you must keep a close eye on everything so it doesn't backfire."*
- **Image Asset**: `assets/card-art/bundles/cards/45052.jpg` (710×1030 px, 302.9 KB)

### Set: Bishop Nemesis

### [45026] Trevor Fitzroy
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bishop Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Temporal.*
- **Rules Text**:
  > Quickstrike.
  > **Forced Response**: After Trevor Fitzroy attacks and defeats an ally, if Portal Through Time is in play, place 2 threat on it. Otherwise, find it and reveal it.
  > *(Bishop's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/45026.jpg` (710×1030 px, 351.0 KB)
### [45027] Portal Through Time
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop Nemesis (2/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bishop Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Interrupt**: When a [[Temporal]] card is revealed, it gains surge. (Limit once per phase.)
- **Flavor**: *Trevor Fitzroy uses his time portals to commit crimes and escape justice.*
- **Image Asset**: `assets/card-art/bundles/cards/45027.png` (1030×710 px, 288.3 KB)
### [45028] Bantam
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop Nemesis (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bishop Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > **When Revealed**: If Portal Through Time is in play, place 2 threat on it. Otherwise, find Portal Through Time and reveal it.
- **Flavor**: *"Time to go, Trevor."*
- **Image Asset**: `assets/card-art/bundles/cards/45028.png` (710×1030 px, 284.7 KB)
### [45029] Temporal Trickery
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Bishop Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Bishop Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Temporal.*
- **Rules Text**:
  > **When Revealed**: Discard a card in your hand with the most printed resource icons. Place 1 threat on each scheme for each resource icon on that card.
- **Flavor**: *"That's why I love time travel no matter how many times I rob this bank, they're always surprised." —Trevor Fitzroy*
- **Image Asset**: `assets/card-art/bundles/cards/45029.jpg` (710×1030 px, 303.1 KB)

### Set: Magik

### [45030a] Magik
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *Mystic. X-Men.*
- **Rules Text**:
  > Play with the top card of your deck faceup.
  > Once per phase, you may play the top card of your deck as if it was in your hand, reducing its resource cost by 1.
- **Flavor**: *"There are no snowflakes in Limbo."*
- **Image Asset**: `assets/card-art/bundles/cards/45030a.png` (300×418 px, 214.2 KB)
### [45030b] Illyana Rasputin
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Mutant. Mystic.*
- **Rules Text**:
  > **Interrupt**: When you change to hero form, choose a [[SPELL]] in your discard pile and put it on top of your deck. (Limit once per phase.)
- **Flavor**: *"I would sell the last piece of my soul for an egg roll right now!"*
- **Image Asset**: `assets/card-art/bundles/cards/45030b.png` (300×418 px, 205.9 KB)
### [45031] Colossus — *Piotr Rasputin*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Toughness.
  > **Interrupt**: When an enemy attacks you, play Colossus from your hand (paying his resource cost) and declare him the defender without exhausting him.
- **Flavor**: *"I will always protect you, little Snowflake."*
- **Image Asset**: `assets/card-art/bundles/cards/45031.jpg` (710×1030 px, 364.9 KB)
### [45032] Limbo
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Dimension.*
- **Rules Text**:
  > **Response**: After the villain phase begins, exhaust Limbo → swap a card in your hand with the top card of your deck.
  > **Action**: Exhaust Limbo → swap a card in your hand with the top card of your deck.
- **Image Asset**: `assets/card-art/bundles/cards/45032.jpg` (710×1030 px, 332.4 KB)
### [45033] Magik's Crown
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Item.*
- **Rules Text**:
  > Magik gains steady.
  > While the top card of your deck has a [mental] or [wild] resource icon, Magik gets +1 THW.
- **Flavor**: *Raised in Limbo, Magik is destined to usurp its rule from the man who brought her there.*
- **Image Asset**: `assets/card-art/bundles/cards/45033.png` (710×1030 px, 372.3 KB)
### [45034] Soulsword
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (4/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted.
  > Magik's basic attacks gain piercing.
  > While the top card of your deck has a [physical] or [wild] resource icon, Magik gets +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/45034.jpg` (710×1030 px, 330.7 KB)
### [45035] Mystical Armor
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (5/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Armor.*
- **Rules Text**:
  > Magik gains retaliate 1.
  > While the top card of your deck has a [energy] or [wild] resource icon, Magik gets +1 DEF.
- **Flavor**: *It's very fashionable in Limbo.*
- **Image Asset**: `assets/card-art/bundles/cards/45035.png` (710×1030 px, 310.9 KB)
### [45036] Scrying
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (6/15)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Spell.*
- **Rules Text**:
  > **Action**: Look at the top 3 cards of your deck. Draw one, discard one, and put one back on top of your deck.
- **Flavor**: *"Yes, I've seen your future. No, I will not tell you."—Magik*
- **Image Asset**: `assets/card-art/bundles/cards/45036.png` (710×1030 px, 312.7 KB)
### [45037] Stepping Disc
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (7–9/15, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Ready your hero. Choose a Magik card in your discard pile not named Stepping Disc and put it on top of your deck.
- **Flavor**: *Magik's teleportation discs can take her anywhere by opening a portal through Limbo.*
- **Image Asset**: `assets/card-art/bundles/cards/45037.jpg` (710×1030 px, 307.0 KB)
### [45038] Exorcism
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (10–11/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Spell. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 4 threat from a scheme. If the top card of your deck has a [mental] or [wild] resource icon, confuse the villain.
- **Flavor**: *"I have purged the evil from within you." —Magik*
- **Image Asset**: `assets/card-art/bundles/cards/45038.jpg` (710×1030 px, 363.2 KB)
### [45039] Soul Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (12–13/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attack. Spell.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. If the top card of your deck has a [physical] or [wild] resource icon, stun that enemy.
- **Flavor**: *"Very well. Feel the bite of my Soulsword!" —Magik*
- **Image Asset**: `assets/card-art/bundles/cards/45039.png` (710×1030 px, 394.2 KB)
### [45040] Magic Barrier
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (14–15/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Defense. Spell.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When an enemy initiates an attack, prevent 3 damage from this attack. If the top card of your deck has a [energy] or [wild] resource icon, deal 3 damage to the attacking enemy.
- **Image Asset**: `assets/card-art/bundles/cards/45040.jpg` (710×1030 px, 364.7 KB)
### [45053] Darkchilde
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magik Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Illyana Rasputin player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Illyana Rasputin → remove Darkchilde from the game.
  > • Deal 1 damage to each character you control. Discard this obligation.
- **Image Asset**: `assets/card-art/bundles/cards/45053.png` (710×1030 px, 310.8 KB)

### Set: Aggression

### [45041] Goldballs — *Fabio Medina*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 41
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > [star] **Interrupt**: When Goldballs attacks, discard up to 3 cards from the top of your deck → Goldballs gets +X ATK for this attack, where X is the number of cards discarded this way.
- **Flavor**: *"I didn't choose the name."*
- **Image Asset**: `assets/card-art/bundles/cards/45041.png` (710×1030 px, 368.5 KB)
### [45042] Tempus — *Eva Bell*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 42
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Play only if your identity has the [[X-MEN]] trait.
  > **Interrupt**: When the villain would scheme, discard Tempus → cancel that activation. Deal yourself 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/45042.png` (710×1030 px, 280.7 KB)
### [45043] Blood Rage
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 43
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After you defeat an enemy with a basic attack, exhaust Blood Rage and take 1 damage → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/45043.jpg` (710×1030 px, 340.6 KB)
### [45044] Test the Defense
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 44
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Skill.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After you play an [[ATTACK]] event, place 1 test counter here. If there are 5 test counters here, discard this card to deal 5 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/45044.png` (710×1030 px, 379.5 KB)
### [45045] Full-Body Charge
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 45
- **Stats**: **Cost**: 4, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 8 damage to an enemy. If your hero's remaining hit points are less than half your hero's starting hit points, this attack gains overkill.
- **Flavor**: *"Coming through, tovarisch!"—Colossus*
- **Image Asset**: `assets/card-art/bundles/cards/45045.jpg` (710×1030 px, 338.3 KB)
### [45046] Clobber
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 46
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. If this is the first card you have played this round, return this card to your hand.
- **Flavor**: *"It feels good to hit ninjas again." —Psylocke*
- **Image Asset**: `assets/card-art/bundles/cards/45046.jpg` (710×1030 px, 393.0 KB)
### [45047] The Power of Aggression
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Pack Position: 47
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > Double the number of resources this card generates while paying for a Aggression *(red)* card.
- **Image Asset**: `assets/card-art/bundles/cards/45047.png` (710×1030 px, 413.5 KB)

### Set: Magik Nemesis

### [45054] Belasco
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magik Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Limbo.*
- **Rules Text**:
  > Villainous.
  > [star] **Forced Response**: After Belasco activates against you, discard the top 3 cards of your deck. If Ruler of Limbo is in play, attach those cards to it facedown.
  > *(Magik's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/45054.jpg` (710×1030 px, 315.3 KB)
### [45055] Ruler of Limbo
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik Nemesis (2/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magik Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Threat cannot be removed from this scheme while Belasco is in play.
  > **When Revealed**: The Illyana Rasputin player finds Limbo and attaches it facedown here. When this scheme is defeated, put Limbo into play under its owner's control.
- **Image Asset**: `assets/card-art/bundles/cards/45055.png` (1030×710 px, 318.9 KB)
### [45056] S'ym
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik Nemesis (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magik Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Limbo.*
- **Rules Text**:
  > Guard.
  > **When Revealed**: If Ruler of Limbo is in play, place 2 threat on it. Otherwise, place 2 threat on the main scheme.
- **Flavor**: *"The boss says he's had enough of your constant meddling."*
- **Image Asset**: `assets/card-art/bundles/cards/45056.png` (710×1030 px, 328.4 KB)
### [45057] Witchfire
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik Nemesis (4/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magik Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Limbo.*
- **Rules Text**:
  > Quickstrike.
  > **Forced Response**: After Witchfire attacks and defeats an ally, place 1 threat on Ruler of Limbo. Otherwise, place 1 threat on the main scheme.
- **Flavor**: *"Limbo is my birthright!"*
- **Image Asset**: `assets/card-art/bundles/cards/45057.jpg` (710×1030 px, 313.8 KB)
### [45058] Battle for Limbo
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Magik Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Magik Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each [[Limbo]] minion in play activates against the player it is engaged with. If no [[Limbo]] minion activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If Ruler of Limbo is in play, place 2 threat on it.
- **Image Asset**: `assets/card-art/bundles/cards/45058.jpg` (710×1030 px, 321.0 KB)

### Set: Unus

### [45059] Unus
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Traits**: *Prelate.*
- **Rules Text**:
  > Toughness.
  > If the amount of threat on Gene Pool is at least:
  > • 3 — Unus gains retaliate 1.
  > • 6 — Unus also gains stalwart.
  > • 9 — Unus also gains a [amplify] icon.
- **Image Asset**: `assets/card-art/bundles/cards/45059.png` (710×1030 px, 361.4 KB)
### [45060] Unus
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Traits**: *Prelate.*
- **Rules Text**:
  > Toughness.
  > If the amount of threat on Gene Pool is at least:
  > • 3 — Unus gains retaliate 1.
  > • 6 — Unus also gains stalwart.
  > • 9 — Unus also gains a [amplify] icon.
- **Image Asset**: `assets/card-art/bundles/cards/45060.png` (710×1030 px, 359.7 KB)
### [45061] Unus
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Traits**: *Prelate.*
- **Rules Text**:
  > Toughness.
  > If the amount of threat on Gene Pool is at least:
  > • 3 — Unus gains retaliate 1.
  > • 6 — Unus also gains stalwart.
  > • 9 — Unus also gains a [amplify] icon.
- **Image Asset**: `assets/card-art/bundles/cards/45061.jpg` (710×1030 px, 307.6 KB)
### [45062] Hunting Gene Traitors
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (4/14)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 11 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, place 1 threat on Gene Pool.
  > **If this scheme is completed, the players lose the game.**
- **Flavor**: *Prelate Unus and his squad of Infinites scour the ruins of the X-Mansion for the enemies of Apocalypse.*
- **Image Asset**: `assets/card-art/bundles/cards/45062.jpg` (1030×710 px, 408.1 KB)
### [45062a] Hunting Gene Traitors
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (4/14)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Unus (I) and Unus (II). *(Unus (II) and Unus (III) instead for expert mode.)* Unus, Infinites, and Standard sets. One modular set *(Dystopian Nightmare)*.
  > **Setup**: Reveal the Gene Pool side scheme. In expert mode, deal each player a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/45062a.png` (1030×710 px, 408.1 KB)
### [45062b] Hunting Gene Traitors
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (4/14)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 11 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, place 1 threat on Gene Pool.
  > **If this scheme is completed, the players lose the game.**
- **Flavor**: *Prelate Unus and his squad of Infinites scour the ruins of the X-Mansion for the enemies of Apocalypse.*
- **Image Asset**: `assets/card-art/bundles/cards/45062b.jpg` (1030×710 px, 361.4 KB)
### [45063] Prelate Sidearm
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (5/14)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Unus.
  > [star] **Forced Response**: After Unus attacks and defeats an ally, place 1 threat on Gene Pool.
  > **Hero Response**: After you make a basic attack against Unus, spend [energy] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/45063.png` (710×1030 px, 255.9 KB)
### [45064] Prelate Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (6/14)
- **Stats**: **SCH**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Unus.
  > [star] **Forced Response**: After Unus schemes, give him a tough status card.
  > **Hero Response**: After you make a basic attack against Unus, spend [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/45064.jpg` (710×1030 px, 358.0 KB)
### [45065] Infinite Hunter
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (7–8/14, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Traits**: *Infinite.*
- **Rules Text**:
  > **When Revealed**: Deal 3 damage to an ally you control.
  >
  > ---
  >
  > [star] **Boost**: Choose to either place 2 threat on Gene Pool, or the activating enemy gets +2 SCH and +2 ATK for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/45065.png` (710×1030 px, 365.4 KB)
### [45066] Genetic Experiments
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (9–10/14, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to an [[Infinite]] minion. Otherwise, this card gains surge.
  > Attached minion gets +2 hit points.
  > **Forced Interrupt**: When attached minion is defeated, place 2 threat on Gene Pool.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to an [[Infinite]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/45066.png` (710×1030 px, 361.3 KB)
### [45067] Infinite Prelate
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (11–12/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Unus activates against you. If the amount of threat on Gene Pool is at least:
  > • 3 — Give Unus a tough status card.
  > • 6 — Heal 3 damage from Unus as well.
  > • 9 — Give Unus an additional boost card for this activation as well.
- **Image Asset**: `assets/card-art/bundles/cards/45067.jpg` (710×1030 px, 347.9 KB)
### [45068] Endless Ranks
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Unus (13–14/14, Qty: 2)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Unus Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Place 3 threat on Gene Pool.
- **Flavor**: *The Infinites live up to their name: no matter how many you defeat, they keep making more.*
- **Image Asset**: `assets/card-art/bundles/cards/45068.jpg` (1030×710 px, 357.7 KB)

### Set: Infinites

### [45069] Infinite Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Infinites (1–5/8, Qty: 5)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Infinites Set Icon (printed bottom-right next to deck number)
- **Traits**: *Infinite.*
- **Rules Text**:
  > Guard.
  > If the amount of threat on Gene Pool is at least:
  > • 3 — This minion gains quickstrike.
  > • 6 — This minion also gains surge.
  > • 9 — This minion also gets +3 hit points.
- **Image Asset**: `assets/card-art/bundles/cards/45069.png` (710×1030 px, 355.8 KB)
### [45070] Culling the Weak
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Infinites (6–7/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Infinites Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 4 threat on Gene Pool.
  >
  > ---
  >
  > [star] **Boost**: Place 2 threat on Gene Pool.
- **Flavor**: *The Infinites were created to enforce the mandate of Apocalypse: the weak must perish.*
- **Image Asset**: `assets/card-art/bundles/cards/45070.jpg` (710×1030 px, 320.9 KB)
### [45071] Gene Pool
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Infinites (8/8)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Infinites Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent. Setup.
  > **Forced Response**: After an ally is defeated by anything other than consequential damage, place 3 threat here.
- **Flavor**: *Apocalypse uses the raw genetic material of his victims to create the Infinites.*
- **Image Asset**: `assets/card-art/bundles/cards/45071.png` (1030×710 px, 354.5 KB)

### Set: Dystopian Nightmare

### [45072] Hunted
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dystopian Nightmare (1–2/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dystopian Nightmare Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **Alter-Ego Action**: Discard a card from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/45072.png` (710×1030 px, 309.5 KB)
### [45073] War-Weary
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dystopian Nightmare (3–4/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Dystopian Nightmare Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are stunned. If you were already stunned, take 2 damage instead.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. If you were already stunned, take 2 damage instead.
- **Image Asset**: `assets/card-art/bundles/cards/45073.jpg` (710×1030 px, 322.3 KB)
### [45074] Targeted for Extermination
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dystopian Nightmare (5–6/6, Qty: 2)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dystopian Nightmare Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme confuses their identity.
- **Flavor**: *The Infinites hunt down those whom their master deems unworthy.*
- **Image Asset**: `assets/card-art/bundles/cards/45074.png` (1030×710 px, 343.3 KB)

### Set: Standard III

### [45075a] Pursued by the Past
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Standard III (1/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Standard III Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent. Setup.
  > **Forced Response**: After you place a pursuit counter here, if the number of counters here is at least 3 more than the number of players, remove each counter here → if your nemesis minion is in play, it activates against you. Otherwise, flip this card over.
- **Image Asset**: `assets/card-art/bundles/cards/45075a.png` (289×419 px, 245.4 KB)
### [45075b] Pursued by the Past
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Standard III (1/8)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Standard III Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent.
  > **Forced Response**: After you flip to this side, find your nemesis minion and reveal it. Search the set-aside area for your nemesis side scheme and reveal it. Shuffle your remaining set-aside nemesis set into the encounter deck. Flip this card over.
- **Image Asset**: `assets/card-art/bundles/cards/45075b.png` (289×419 px, 249.3 KB)
### [45076] Dark Designs
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Standard III (2–3/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Standard III Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 1 pursuit counter on Pursued by the Past. Then, if it has any counters on it, the villain schemes.
  > [star] **Boost**: After this activation resolves, place 1 pursuit counter on Pursued by the Past.
- **Image Asset**: `assets/card-art/bundles/cards/45076.jpg` (710×1030 px, 307.1 KB)
### [45077] Sinister Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Standard III (4–5/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Standard III Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Place 1 pursuit counter on Pursued by the Past. Then, if it has any counters on it, this card gains surge.
  > **When Revealed (Hero)**: Place 1 pursuit counter on Pursued by the Past. Then, if it has any counters on it, the villain attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/45077.png` (710×1030 px, 279.2 KB)
### [45078] Evil Alliance
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Standard III (6/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Standard III Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each nemesis minion in play activates against you. If no minions activated this way, place 3 pursuit counters on Pursued by the Past.
  > [star] **Boost**: After this activation resolves, place 1 pursuit counter on Pursued by the Past.
- **Image Asset**: `assets/card-art/bundles/cards/45078.png` (710×1030 px, 258.0 KB)
### [45079] Nowhere is Safe
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Standard III (7/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Standard III Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 1 pursuit counter on Pursued by the Past. Then, if it has any counters on it, discard an upgrade or support you control.
  >
  > ---
  >
  > [star] **Boost**: After this activation resolves, place 1 pursuit counter on Pursued by the Past.
- **Image Asset**: `assets/card-art/bundles/cards/45079.jpg` (710×1030 px, 289.2 KB)
### [45080] Drawing Near
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Standard III (8/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Standard III Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After your turn begins, discard the top card of your deck. Place 1 pursuit counter on Pursued by the Past for each printed resource icon on that card.
  > **Alter-Ego Action**: Discard an identity-specific card from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/45080.jpg` (710×1030 px, 358.5 KB)

### Set: Four Horsemen

### [45081a] War
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (1/20)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Horsemen.*
- **Rules Text**:
  > [star] **Forced Response**: After War attacks you, if he has at least 1 hit point, discard an upgrade or support you control.
  > **War cannot be defeated while another villain has at least 1 hit point.**
- **Image Asset**: `assets/card-art/bundles/cards/45081a.png` (289×419 px, 243.9 KB)
### [45081b] War
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (1/20)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Horsemen.*
- **Rules Text**:
  > [star] **Forced Response**: After War attacks you, if he has at least 1 hit point, discard an upgrade or support you control.
  > **War cannot be defeated while another villain has at least 1 hit point.**
- **Image Asset**: `assets/card-art/bundles/cards/45081b.png` (289×419 px, 245.8 KB)
### [45082a] Famine
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (2/20)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Horsemen.*
- **Rules Text**:
  > [star] **Forced Response**: After Famine attacks you, if she has at least 1 hit point, discard the top 10 cards of your deck.
  > **Famine cannot be defeated while another villain has at least 1 hit point.**
- **Image Asset**: `assets/card-art/bundles/cards/45082a.png` (289×419 px, 243.9 KB)
### [45082b] Famine
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (2/20)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Horsemen.*
- **Rules Text**:
  > [star] **Forced Response**: After Famine attacks you, if she has at least 1 hit point, discard the top 10 cards of your deck.
  > **Famine cannot be defeated while another villain has at least 1 hit point.**
- **Image Asset**: `assets/card-art/bundles/cards/45082b.png` (289×419 px, 244.5 KB)
### [45083a] Pestilence
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (3/20)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Horsemen.*
- **Rules Text**:
  > [star] **Forced Response**: After Pestilence attacks you, if she has at least 1 hit point, treat your identity's text box as if it were blank *(except for [[Traits]])* until the next villain phase begins.
  > **Pestilence cannot be defeated while another villain has at least 1 hit point.**
- **Image Asset**: `assets/card-art/bundles/cards/45083a.png` (289×419 px, 256.8 KB)
### [45083b] Pestilence
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (3/20)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Horsemen.*
- **Rules Text**:
  > [star] **Forced Response**: After Pestilence attacks you, if she has at least 1 hit point, treat your identity's text box as if it were blank *(except for [[Traits]])* until the next villain phase begins.
  > **Pestilence cannot be defeated while another villain has at least 1 hit point.**
- **Image Asset**: `assets/card-art/bundles/cards/45083b.png` (289×419 px, 249.8 KB)
### [45084a] Death
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (4/20)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Horsemen.*
- **Rules Text**:
  > [star] **Forced Response**: After Death attacks you, if he has at least 1 hit point, deal 1 damage to each character you control.
  > **Death cannot be defeated while another villain has at least 1 hit point.**
- **Image Asset**: `assets/card-art/bundles/cards/45084a.png` (289×419 px, 247.5 KB)
### [45084b] Death
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (4/20)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Horsemen.*
- **Rules Text**:
  > [star] **Forced Response**: After Death attacks you, if he has at least 1 hit point, deal 1 damage to each character you control.
  > **Death cannot be defeated while another villain has at least 1 hit point.**
- **Image Asset**: `assets/card-art/bundles/cards/45084b.png` (289×419 px, 244.8 KB)
### [45085] The Horsemen of Apocalypse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (5/20)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After a villain activates, move the active counter to the next villain.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *The Four Horsemen are the most brutal servants of Apocalypse. They strike in turn, using their powers as a team.*
- **Image Asset**: `assets/card-art/bundles/cards/45085.jpg` (1030×710 px, 414.5 KB)
### [45085a] The Horsemen of Apocalypse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (5/20)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: War (A), Famine (A), Pestilence (A), Death (A), Four Horsemen, Standard, and two modular sets *(Dystopian Nightmare and Hounds)*.
  > **Setup**: Shuffle the four [[Horsemen]] villains, then reveal them in a row from left to right. Place the active counter on the leftmost villain (see rulebook). Each player reveals a random side scheme from the Four Horsemen encounter set.
- **Image Asset**: `assets/card-art/bundles/cards/45085a.jpg` (1030×710 px, 414.5 KB)
### [45085b] The Horsemen of Apocalypse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (5/20)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After a villain activates, move the active counter to the next villain.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *The Four Horsemen are the most brutal servants of Apocalypse. They strike in turn, using their powers as a team.*
- **Image Asset**: `assets/card-art/bundles/cards/45085b.jpg` (1030×710 px, 317.9 KB)
### [45086] The Ravages of War
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (6/20)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme discards an upgrade or support they control.
- **Flavor**: *War uses the shockwaves created by his arms to keep his opponents off balance.*
- **Image Asset**: `assets/card-art/bundles/cards/45086.jpg` (1030×710 px, 368.8 KB)
### [45087] A Time of Famine
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (7/20)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme discards the top 10 cards of their deck.
- **Flavor**: *The mere touch of Famine leaves even the strongest mutant enfeebled.*
- **Image Asset**: `assets/card-art/bundles/cards/45087.png` (1030×710 px, 367.9 KB)
### [45088] Plague and Pestilence
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (8/20)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme treats their identity's text box as if it were blank (except for [[Traits]]) until the next villain phase begins.
- **Flavor**: *Pestilence uses her power to make her enemies sick and helpless.*
- **Image Asset**: `assets/card-art/bundles/cards/45088.png` (1030×710 px, 376.0 KB)
### [45089] The Specter of Death
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (9/20)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme deals 1 damage to each character they control.
- **Flavor**: *The shadow of Death drives fear into the hearts of those he hunts.*
- **Image Asset**: `assets/card-art/bundles/cards/45089.jpg` (1030×710 px, 313.3 KB)
### [45090] Golden Horse
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (10–12/20, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Attach to the villain with the fewest hit points without the [[Aerial]] trait.
  > Attached villain gains the [[Aerial]] trait and is considered to have at least 1 hit point.
  > **Hero Response**: After you attack attached villain, resolve its "**Forced Response**" as if it just attacked you → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/45090.png` (710×1030 px, 338.7 KB)
### [45091] Metal Wings
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (13/20)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Attach to Death and move the active counter to him.
  > Death gains retaliate 1 and is considered to have at least 1 hit point remaining.
  > **Hero Response**: After you attack Death, resolve his "**Forced Response**" as if he just attacked you → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/45091.jpg` (710×1030 px, 333.5 KB)
### [45092] Horseman of War
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (14/20)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Heal 2 damage from War and give him a tough status card. He activates against you.
  >
  > ---
  >
  > [star] **Boost**: After this activation, War activates against you. Do not give War a boost card for that activation.
- **Image Asset**: `assets/card-art/bundles/cards/45092.jpg` (710×1030 px, 305.2 KB)
### [45093] Horseman of Famine
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (15/20)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Heal 2 damage from Famine and give her a tough status card. She activates against you.
  >
  > ---
  >
  > [star] **Boost**: After this activation, Famine activates against you. Do not give Famine a boost card for that activation.
- **Image Asset**: `assets/card-art/bundles/cards/45093.png` (710×1030 px, 332.3 KB)
### [45094] Horseman of Pestilence
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (16/20)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Heal 2 damage from Pestilence and give her a tough status card. She activates against you.
  >
  > ---
  >
  > [star] **Boost**: After this activation, Pestilence activates against you. Do not give Pestilence a boost card for that activation.
- **Image Asset**: `assets/card-art/bundles/cards/45094.jpg` (710×1030 px, 348.3 KB)
### [45095] Horseman of Death
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (17/20)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Heal 2 damage from Death and give him a tough status card. He activates against you.
  >
  > ---
  >
  > [star] **Boost**: After this activation, Death activates against you. Do not give Death a boost card for that activation.
- **Image Asset**: `assets/card-art/bundles/cards/45095.png` (710×1030 px, 330.4 KB)
### [45096] Rough Riders
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Four Horsemen (18–20/20, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Four Horsemen Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve the "**Forced Response**" on the active villain as if it has at least 1 hit point and attacked you. Move the active counter to the next villain and resolve its "**Forced Response**" the same way.
- **Image Asset**: `assets/card-art/bundles/cards/45096.png` (710×1030 px, 325.4 KB)

### Set: Hounds

### [45097] Ahab
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Hounds (1/7)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hounds Set Icon (printed bottom-right next to deck number)
- **Traits**: *Cyborg. Tracker.*
- **Rules Text**:
  > Toughness.
  > **When Revealed**: If Release the Hounds is in play, place 3 threat on it. Otherwise, find the Release the Hounds side scheme and reveal it.
- **Flavor**: *"You cannot hide from me, mutant."*
- **Image Asset**: `assets/card-art/bundles/cards/45097.jpg` (710×1030 px, 353.1 KB)
### [45098] Hound
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Hounds (2–5/7, Qty: 4)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hounds Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tracker.*
- **Rules Text**:
  > Guard.
  > **When Revealed**: If you are in hero form, Hound attacks you. Otherwise, change your identity to hero form.
- **Flavor**: *Ahab's hounds are mutants stripped of free will and forced to hunt their own kind.*
- **Image Asset**: `assets/card-art/bundles/cards/45098.jpg` (710×1030 px, 292.2 KB)
### [45099] Ahab's Energy Spear
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Hounds (6/7)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hounds Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Ahab. Otherwise, attach to the villain.
  > [star] **Forced Interrupt**: When attached enemy attacks you, this attack gains overkill and piercing. At the end of this attack, discard Ahab's Energy Spear.
- **Image Asset**: `assets/card-art/bundles/cards/45099.png` (710×1030 px, 326.2 KB)
### [45100] Release the Hounds
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Hounds (7/7)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hounds Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > The first copy of Hound revealed each phase gains surge.
  > **When Defeated**: The player who defeated this scheme searches the encounter deck and discard pile for a copy of Hound and deals it to themself as a facedown encounter card.
- **Flavor**: *Ahab takes pleasure in hunting mutants with the help of his hounds.*
- **Image Asset**: `assets/card-art/bundles/cards/45100.jpg` (1030×710 px, 325.5 KB)

### Set: Apocalypse

### [45101a] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (1/15)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 8 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant.*
- **Rules Text**:
  > Toughness.
  > **Forced Interrupt**: When the main scheme is completed, remove all threat from it *(ignoring any crisis ([crisis]) icons)*. Flip this card and reveal Apocalypse (II).
- **Flavor**: *"Challenge me and be reminded why Apocalypse reigns supreme."*
- **Image Asset**: `assets/card-art/bundles/cards/45101a.png` (289×419 px, 250.5 KB)
### [45101b] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (1/15)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant.*
- **Rules Text**:
  > Steady. Toughness.
  > **Forced Interrupt**: When the main scheme is completed, remove all threat from it *(ignoring any crisis ([crisis]) icons)*. Remove this card from the game and reveal Apocalypse (III).
- **Flavor**: *"You are foolish to oppose me."*
- **Image Asset**: `assets/card-art/bundles/cards/45101b.png` (289×419 px, 246.9 KB)
### [45102a] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (2/15)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 10 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant.*
- **Rules Text**:
  > Steady. Toughness.
  > **Forced Interrupt**: When the main scheme is completed, remove all threat from it *(ignoring any crisis ([crisis]) icons)*. Flip this card and reveal Apocalypse (IV).
- **Flavor**: *"This world belongs to me and those I deem worthy."*
- **Image Asset**: `assets/card-art/bundles/cards/45102a.png` (289×419 px, 249.7 KB)
### [45102b] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (2/15)
- **Properties**: Unique, Stage IV
- **Stats**: **SCH**: 3, **ATK**: 3 [star], **HP**: 11 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant.*
- **Rules Text**:
  > Stalwart. Toughness.
  > [star] Apocalypse's attacks gain overkill.
  > **Forced Interrupt**: When the main scheme is completed, the players lose the game.
- **Flavor**: *"I will cleanse this world with fire. Only the strong will survive."*
- **Image Asset**: `assets/card-art/bundles/cards/45102b.png` (289×419 px, 243.6 KB)
### [45103] The Age of Apocalypse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (3/15)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: -1 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > X is the numeral in Apocalypse's printed hit point value.
  > **Forced Interrupt**: When Apocalypse would be defeated, discard each attachment from him and heal all damage from him instead. Remove X threat from this scheme *(ignoring any crisis ([crisis]) icons)*.
- **Flavor**: *The time has come for a direct assault on Apocalypse in his towering citadel.*
- **Image Asset**: `assets/card-art/bundles/cards/45103.jpg` (1030×710 px, 375.9 KB)
### [45103a] The Age of Apocalypse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (3/15)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Apocalypse (II) and Apocalypse (III). *(Apocalypse (III) only for expert mode.)* Apocalypse, Prelates, and Standard sets. Two modular sets *(Dark Riders and Infinites)*.
  > **Setup**: Set aside each unused villain card, each [[Prelate]] minion, and The Tyrant's Throne side scheme. Reveal the Heart of the Empire side scheme. The first player reveals a random, set-aside [[Prelate]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/45103a.jpg` (1030×710 px, 375.9 KB)
### [45103b] The Age of Apocalypse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (3/15)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: -1 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > X is the numeral in Apocalypse's printed hit point value.
  > **Forced Interrupt**: When Apocalypse would be defeated, discard each attachment from him and heal all damage from him instead. Remove X threat from this scheme *(ignoring any crisis ([crisis]) icons)*.
- **Flavor**: *The time has come for a direct assault on Apocalypse in his towering citadel.*
- **Image Asset**: `assets/card-art/bundles/cards/45103b.jpg` (1030×710 px, 315.1 KB)
### [45104a] Heart of the Empire
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (4/15)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Threat cannot be removed from this scheme while a [[Prelate]] minion is in play.
  > **When Defeated**: The first player reveals a random set-aside [[Prelate]] minion. Deal each other player an encounter card. Flip this card over.
- **Flavor**: *Before you can challenge Apocalypse, you must fight your way through his tower.*
- **Image Asset**: `assets/card-art/bundles/cards/45104a.png` (419×289 px, 252.8 KB)
### [45105a] The Tyrant's Throne
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (5/15)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Threat cannot be removed from this scheme while a [[Prelate]] minion is in play.
  > **When Defeated**: The first player reveals a random set-aside [[Prelate]] minion. Deal each other player an encounter card. Flip this card over and reveal No Longer Worthy.
- **Image Asset**: `assets/card-art/bundles/cards/45105a.png` (419×289 px, 245.3 KB)
### [45105b] No Longer Worthy
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (5/15)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Apocalypse and heal 5[per_hero] hit points from him. He cannot take damage while a [[Prelate]] minion is in play.
  > Ignore the "**Forced Interrupt**" on the main scheme.
  > **Forced Interrupt**: When Apocalypse is defeated, the players win the game.
- **Image Asset**: `assets/card-art/bundles/cards/45105b.png` (289×419 px, 248.8 KB)
### [45106] Cyberpathy
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (6/15)
- **Stats**: **SCH**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to Apocalypse.
  > [star] **Forced Response**: After Apocalypse schemes, place 1 threat on each side scheme.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Apocalypse.
- **Image Asset**: `assets/card-art/bundles/cards/45106.jpg` (710×1030 px, 381.5 KB)
### [45107] Biomorphing
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (7/15)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to Apocalypse.
  > [star] Apocalypse's attacks gain overkill.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Apocalypse.
- **Image Asset**: `assets/card-art/bundles/cards/45107.png` (710×1030 px, 304.1 KB)
### [45108] Molecular Control
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (8/15)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to Apocalypse.
  > Apocalypse gains retaliate 1 and stalwart.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Apocalypse.
- **Flavor**: *Apocalypse's power to control every molecule in his body makes him an unpredictable foe.*
- **Image Asset**: `assets/card-art/bundles/cards/45108.png` (710×1030 px, 324.1 KB)
### [45109] The Fittest
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (9–10/15, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the minion with the highest printed hit points and give it a tough status card. Otherwise, this card gains surge.
  > Attached enemy gets +5 hit points.
- **Flavor**: *Apocalypse promotes only the strongest and most ruthless mutants to the rank of Prelate.*
- **Image Asset**: `assets/card-art/bundles/cards/45109.jpg` (710×1030 px, 324.5 KB)
### [45110] Wolf Among Sheep
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (11–13/15, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The [[Prelate]] minion activates against you. Otherwise, Apocalypse activates against you.
  >
  > ---
  >
  > [star] **Boost**: Give the [[Prelate]] minion a tough status card. Otherwise, give Apocalypse a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/45110.png` (710×1030 px, 363.7 KB)
### [45111] The Apocalypse Solution
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Apocalypse (14–15/15, Qty: 2)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Apocalypse Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: Discard the top X cards of the encounter deck, where X is the numeral in Apocalypse's printed hit point value.
- **Flavor**: *Apocalypse would rather burn his kingdom to the ground than surrender his rule.*
- **Image Asset**: `assets/card-art/bundles/cards/45111.jpg` (1030×710 px, 321.5 KB)

### Set: Dark Riders

### [45112] Gauntlet
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Riders (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dark Riders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Dark Riders.*
- **Rules Text**:
  > Teamwork ([[Dark Riders]]).
  > [star] **Forced Response**: After Gauntlet attacks you, discard an upgrade you control.
- **Flavor**: *"You want someone gone? You hire the Dark Riders."*
- **Image Asset**: `assets/card-art/bundles/cards/45112.jpg` (710×1030 px, 340.9 KB)
### [45113] Barrage
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Riders (2/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dark Riders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Dark Riders.*
- **Rules Text**:
  > Teamwork ([[Dark Riders]]).
  > [star] **Forced Response**: After Barrage attacks you, deal 1 damage to each character you control.
- **Flavor**: *"Don't expect someone named 'Barrage' to be picky with their targets." —Cyclops*
- **Image Asset**: `assets/card-art/bundles/cards/45113.png` (710×1030 px, 271.7 KB)
### [45114] Hard-Drive
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Riders (3/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dark Riders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Dark Riders.*
- **Rules Text**:
  > Teamwork ([[Dark Riders]]).
  > [star] **Forced Response**: After Hard-Drive attacks you, place 1 threat on each scheme.
- **Flavor**: *"I've finished my scan. Ready to jump."*
- **Image Asset**: `assets/card-art/bundles/cards/45114.jpg` (710×1030 px, 338.7 KB)
### [45115] Tusk
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Riders (4/6)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Dark Riders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Dark Riders.*
- **Rules Text**:
  > Teamwork ([[Dark Riders]]).
  > [star] **Forced Response**: After Tusk attacks you, you are stunned.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/45115.png` (710×1030 px, 345.4 KB)
### [45116] Psynapse
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Riders (5/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Dark Riders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Dark Riders.*
- **Rules Text**:
  > Teamwork ([[Dark Riders]]).
  > [star] **Forced Response**: After Psynapse attacks you, you are confused.
  >
  > ---
  >
  > [star] **Boost**: You are confused.
- **Image Asset**: `assets/card-art/bundles/cards/45116.png` (710×1030 px, 336.7 KB)
### [45117] The Dark Riders
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Riders (6/6)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dark Riders Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1[per_hero].
  > Each [[Dark Riders]] minion gains toughness.
  > **When Revealed**: Discard cards from the encounter deck until a [[Dark Riders]] minion is discarded and reveal it.
- **Flavor**: *Dark Riders live by the axiom: The weak must perish.*
- **Image Asset**: `assets/card-art/bundles/cards/45117.jpg` (1030×710 px, 304.7 KB)

### Set: Dark Beast

### [45118] Dark Beast
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (1/13)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Genius.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Dark Beast attacks you, resolve the "**Special**" ability on the [[Setting]] environment.
  > **When Revealed**: Reveal a random set-aside environment and shuffle the rest of its encounter set into the encounter deck.
- **Flavor**: *"A villain's work is never done!"*
- **Image Asset**: `assets/card-art/bundles/cards/45118.jpg` (710×1030 px, 358.2 KB)
### [45119] Dark Beast
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (2/13)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Genius.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Dark Beast attacks you, resolve the "**Special**" ability on the [[Setting]] environment.
  > **When Revealed**: Reveal a random set-aside environment and shuffle the rest of its encounter set into the encounter deck. Deal each player an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/45119.png` (710×1030 px, 363.3 KB)
### [45120] Dark Beast
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (3/13)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Genius.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Dark Beast attacks you, resolve the "**Special**" ability on the [[Setting]] environment.
  > **When Revealed**: Reveal a random set-aside environment and shuffle the rest of its encounter set into the encounter deck. Deal each player an encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/45120.png` (710×1030 px, 361.9 KB)
### [45121] Dark Beast's Bogus Journey
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (4/13)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Dark Beast activates his time machine to ensure the rise of Apocalypse, but your quick action ruins his calculations. You wrestle for control of the device as it transports you through time and space!*
- **Image Asset**: `assets/card-art/bundles/cards/45121.jpg` (1030×710 px, 343.9 KB)
### [45121a] Dark Beast's Bogus Journey
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (4/13)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Dark Beast (I) and Dark Beast (II). *(Dark Beast (II) and Dark Beast (III) for expert mode.)* Dark Beast, Blue Moon, Genosha, Savage Land, and Standard sets. One modular set *(Dystopian Nightmare)*.
  > **Setup**: Set the Blue Moon, Genosha, and Savage Land sets aside *(including each environment card in those sets)*. In expert mode, reveal the High-Tech Goggles attachment.
- **Image Asset**: `assets/card-art/bundles/cards/45121a.png` (1030×710 px, 343.9 KB)
### [45121b] Dark Beast's Bogus Journey
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (4/13)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Dark Beast activates his time machine to ensure the rise of Apocalypse, but your quick action ruins his calculations. You wrestle for control of the device as it transports you through time and space!*
- **Image Asset**: `assets/card-art/bundles/cards/45121b.jpg` (1030×710 px, 299.9 KB)
### [45122] High-Tech Goggles
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (5/13)
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to Dark Beast.
  > **Hero Action**: Exhaust your hero and resolve the "**Special**" ability on the [[Setting]] environment. → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Dark Beast.
- **Image Asset**: `assets/card-art/bundles/cards/45122.jpg` (710×1030 px, 298.6 KB)
### [45123] Genetic Enhancement
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (6/13)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Dark Beast.
  > **Hero Action**: Exhaust your hero and resolve the "**Special**" ability on the [[Setting]] environment. → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Dark Beast.
- **Image Asset**: `assets/card-art/bundles/cards/45123.png` (710×1030 px, 308.2 KB)
### [45124] Cruel Experiment
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (7–8/13, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attached minion gets +2 hit points and gains guard.
  > **When Revealed**: Discard cards from the top of the encounter deck until you discard a minion. Reveal that minion and attach Cruel Experiment to it.
- **Flavor**: *"I could do this with anesthesia, but what fun would that be?" —Dark Beast*
- **Image Asset**: `assets/card-art/bundles/cards/45124.jpg` (710×1030 px, 325.9 KB)
### [45125] Evil Genius
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (9–11/13, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Dark Beast schemes. Give him a tough status card.
  > **When Revealed (Hero)**: Dark Beast attacks you. Give him an additional boost card for this attacks.
- **Image Asset**: `assets/card-art/bundles/cards/45125.png` (710×1030 px, 354.2 KB)
### [45126] Time-Travel Shenanigans
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Dark Beast (12–13/13, Qty: 2)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dark Beast Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme discards cards from the top of the encounter deck until they discard a card from the same encounter set as the [[Setting]] environment and reveals the just-discarded card.
- **Image Asset**: `assets/card-art/bundles/cards/45126.png` (1030×710 px, 299.7 KB)

### Set: Savage Land

### [45127] The Savage Land
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Savage Land (1/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Savage Land Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Setting.*
- **Rules Text**:
  > Setup.
  > The villain gains retaliate 1.
  > **Special**: Discard the top 3 cards of your deck.
  > **When Revealed**: Discard each other [[Setting]] environment in play.
- **Image Asset**: `assets/card-art/bundles/cards/45127.jpg` (710×1030 px, 299.5 KB)
### [45128] Pterosaur
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Savage Land (2/8)
- **Stats**: **SCH**: 0, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Savage Land Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Creature.*
- **Rules Text**:
  > **When Revealed**: Resolve the "**Special**" ability on the [[Setting]] environment.
  >
  > ---
  >
  > [star] **Boost**: If The Savage Land is in play, deal Pterosaur to yourself as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/45128.jpg` (710×1030 px, 306.2 KB)
### [45129] Velociraptor
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Savage Land (3–4/8, Qty: 2)
- **Stats**: **ATK**: 1 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Savage Land Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Interrupt**: When Velociraptor attacks you, discard the top card of your deck. Velociraptor gets +1 ATK for this attack for each resource icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/45129.png` (710×1030 px, 317.2 KB)
### [45130] Giant Ape
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Savage Land (5–6/8, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Savage Land Set Icon (printed bottom-right next to deck number)
- **Traits**: *Creature.*
- **Rules Text**:
  > Guard.
  > **When Defeated**: The player who defeated Giant Ape resolves the "**Special**" ability on the [[Setting]] environment.
- **Flavor**: *"This is why you don't feed the animals!" —Jubilee*
- **Image Asset**: `assets/card-art/bundles/cards/45130.jpg` (710×1030 px, 287.8 KB)
### [45131] Land Out of Time
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Savage Land (7/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Savage Land Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If the Savage Land is in play, resolve its "**Special**" ability and take 1 indirect damage for each resource icon on the discarded cards. Otherwise, find The Savage Land and reveal it.
- **Flavor**: *The Savage Land is exactly what you'd expect from a prehistoric jungle in the middle of Antarctica.*
- **Image Asset**: `assets/card-art/bundles/cards/45131.png` (710×1030 px, 323.2 KB)
### [45132] Village Under Attack
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Savage Land (8/8)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Savage Land Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: Each player resolves the "**Special**" ability on the [[Setting]] environment.
- **Flavor**: *"We need ta save the village from those dinosaurs! (is something Ah never imagined saying.)" —Rogue*
- **Image Asset**: `assets/card-art/bundles/cards/45132.png` (1030×710 px, 354.6 KB)

### Set: Genosha

### [45133] Genosha
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Genosha (1/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Genosha Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Setting.*
- **Rules Text**:
  > Setup.
  > The villain gains steady.
  > **Special**: Place 1 threat on the main scheme.
  > **When Revealed**: Discard each other [[Setting]] environment in play.
- **Image Asset**: `assets/card-art/bundles/cards/45133.jpg` (710×1030 px, 300.0 KB)
### [45134] Magistrate
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Genosha (2–3/8, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Genosha Set Icon (printed bottom-right next to deck number)
- **Traits**: *Genosha.*
- **Rules Text**:
  > Patrol.
  > **When Defeated**: The defeating player finds Escaped Mutant and attaches it to their identity.
  >
  > ---
  >
  > [star] **Boost**: If Escaped Mutant is attached to your identity, this card gains [boost][boost][boost].
- **Image Asset**: `assets/card-art/bundles/cards/45134.png` (710×1030 px, 298.0 KB)
### [45135] Armored Unibike
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Genosha (4–5/8, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Genosha Set Icon (printed bottom-right next to deck number)
- **Traits**: *Genosha. Vehicle.*
- **Rules Text**:
  > Armored Unibike engages the player with Escaped Mutant attached, if able.
  > [star] **Forced Response**: After Armored Unibike attacks, resolve the "**Special**" ability on the [[Setting]] environment.
- **Flavor**: *"I have the mutant's signal. Moving to intercept."*
- **Image Asset**: `assets/card-art/bundles/cards/45135.jpg` (710×1030 px, 322.4 KB)
### [45136] Genoshan Mech
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Genosha (6/8)
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Genosha Set Icon (printed bottom-right next to deck number)
- **Traits**: *Genosha. Vehicle.*
- **Rules Text**:
  > Guard. Toughness.
  > [star] **Forced Response**: After Genoshan Mech attacks and defeats one of your allies, resolve the "**Special**" ability on the [[Setting]] environment twice.
- **Flavor**: *"Their suits are built to counter our powers." —Storm*
- **Image Asset**: `assets/card-art/bundles/cards/45136.jpg` (710×1030 px, 318.2 KB)
### [45137] Escaped Mutant
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Genosha (7/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Genosha Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity.
  > Each [[Genosha]] minion that engages you gains quickstrike.
  > **Alter-Ego Action**: Resolve the "**Special**" ability on the [[Setting]] environment → discard this card.
- **Flavor**: *Mutants who wish to escape Genosha must find a way to evade the magistrate.*
- **Image Asset**: `assets/card-art/bundles/cards/45137.png` (710×1030 px, 323.0 KB)
### [45138] Police State
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Genosha (8/8)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Genosha Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: The player who defeated this scheme finds the Escaped Mutant attachment and reveals it.
- **Flavor**: *Genosha built its wealth by exploiting its mutant population.*
- **Image Asset**: `assets/card-art/bundles/cards/45138.png` (1030×710 px, 306.1 KB)

### Set: Blue Moon

### [45139] Blue Area of the Moon
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Blue Moon (1/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Blue Moon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location. Setting.*
- **Rules Text**:
  > Setup.
  > Each minion gains guard.
  > **Special**: Deal 1 damage to your identity.
  > **When Revealed**: Discard each other [[Setting]] environment in play.
- **Image Asset**: `assets/card-art/bundles/cards/45139.jpg` (710×1030 px, 298.1 KB)
### [45140] Gladiator
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Blue Moon (2/8)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Blue Moon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Imperial Guard.*
- **Rules Text**:
  > Teamwork ([[Imperial Guard]]).
  > While Trial by Combat is in play, Gladiator cannot take damage.
  >
  > ---
  >
  > [star] **Boost**: If Trial by Combat is in play, deal Gladiator by yourself as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/45140.png` (710×1030 px, 287.1 KB)
### [45141] Oracle
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Blue Moon (3/8)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Blue Moon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Imperial Guard.*
- **Rules Text**:
  > Teamwork ([[Imperial Guard]]).
  > **When Revealed**: You are confused. If you were already confused, resolve the "**Special**" ability on the [[Setting]] environment.
- **Flavor**: *"This is not a fight you can win."*
- **Image Asset**: `assets/card-art/bundles/cards/45141.jpg` (710×1030 px, 304.0 KB)
### [45142] Manta
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Blue Moon (4/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Blue Moon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Imperial Guard.*
- **Rules Text**:
  > Teamwork ([[Imperial Guard]]).
  > **When Revealed**: You are stunned. If you were already stunned, resolve the "**Special**" ability on the [[Setting]] environment.
- **Image Asset**: `assets/card-art/bundles/cards/45142.jpg` (710×1030 px, 263.7 KB)
### [45143] Earthquake
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Blue Moon (5/8)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Blue Moon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Imperial Guard.*
- **Rules Text**:
  > Teamwork ([[Imperial Guard]]).
  > **When Revealed**: Exhaust your identity. If you were already exhausted, resolve the "**Special**" ability on the [[Setting]] environment.
- **Flavor**: *"Let me shake things up!"*
- **Image Asset**: `assets/card-art/bundles/cards/45143.png` (710×1030 px, 311.4 KB)
### [45144] Warstar
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Blue Moon (6/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Blue Moon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Imperial Guard.*
- **Rules Text**:
  > Teamwork ([[Imperial Guard]]).
  > **When Revealed**: Discard the top card of the encounter deck. If that card is an [[Imperial Guard]] minion, reveal it. Otherwise, resolve the "**Special**" ability on the [[Setting]] environment.
- **Image Asset**: `assets/card-art/bundles/cards/45144.jpg` (710×1030 px, 312.3 KB)
### [45145] Imperial Guardsman
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Blue Moon (7/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Blue Moon Set Icon (printed bottom-right next to deck number)
- **Traits**: *Title.*
- **Rules Text**:
  > Attach to a minion. Otherwise, this card gains surge.
  > Attached minion gets +4 hit points and gains the [[Imperial Guard]] trait.
  > **Forced Interrupt**: When attached minion is defeated, resolve the "**Special**" ability on the [[Setting]] environment.
- **Image Asset**: `assets/card-art/bundles/cards/45145.png` (710×1030 px, 313.1 KB)
### [45146] Trial by Combat
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Blue Moon (8/8)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Blue Moon Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1[per_hero].
  > **When Defeated**: Shuffle each [[Imperial Guard]] minion in the encounter discard pile into the encounter deck.
- **Flavor**: *Shi'ar law grants the accused an opportunity to defend themselves, but they must battle the Imperial Guard.*
- **Image Asset**: `assets/card-art/bundles/cards/45146.png` (1030×710 px, 271.4 KB)

### Set: En Sabah Nur

### [45147] En Sabah Nur's Pyramid
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (4/16)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step 1 of the villain phase, place 1 power counter here. If there are at least 4 power counters here, the first player removes 4 of them and discards cards from the top of the encounter deck until a [[Superpower]] card is discarded and reveal it.
- **Flavor**: *Within his high-tech pyramid, Apocalypse prepares for his ascension.*
- **Image Asset**: `assets/card-art/bundles/cards/45147.jpg` (1030×710 px, 338.0 KB)
### [45147a] En Sabah Nur's Pyramid
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (4/16)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Apocalypse (I) and Apocalypse (II). *(Apocalypse (II) and Apocalypse (III) for expert mode.)* En Sabah Nur and Standard sets. Two modular sets *(Celestial Tech and Clan Akkaba)*.
  > **Setup**: Apocalypse begins the game in [[Biomorph]] form. Deal each player a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/45147a.jpg` (1030×710 px, 338.0 KB)
### [45147b] En Sabah Nur's Pyramid
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (4/16)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step 1 of the villain phase, place 1 power counter here. If there are at least 4 power counters here, the first player removes 4 of them and discards cards from the top of the encounter deck until a [[Superpower]] card is discarded and reveal it.
- **Flavor**: *Within his high-tech pyramid, Apocalypse prepares for his ascension.*
- **Image Asset**: `assets/card-art/bundles/cards/45147b.jpg` (1030×710 px, 335.6 KB)
### [45148] The Rise of Apocalypse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (5/16)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step 1 of the villain phase, place 1 power counter here. If there are at least 4 power counters here, the first player removes 4 of them and discards cards from the top of the encounter deck until a [[Superpower]] card is discarded and reveals it.
  > **If this scheme is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/45148.jpg` (1030×710 px, 283.9 KB)
### [45148a] The Rise of Apocalypse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (5/16)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The first player discards cards from the top of the encounter deck until a [[Superpower]] card is discarded and reveals it.
- **Flavor**: *You've seen what the future looks like if Apocalypse's influence is allowed to grow. It's up to you to stop the megalomaniac here and now!*
- **Image Asset**: `assets/card-art/bundles/cards/45148a.jpg` (1030×710 px, 283.9 KB)
### [45148b] The Rise of Apocalypse
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (5/16)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step 1 of the villain phase, place 1 power counter here. If there are at least 4 power counters here, the first player removes 4 of them and discards cards from the top of the encounter deck until a [[Superpower]] card is discarded and reveals it.
  > **If this scheme is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/45148b.jpg` (1030×710 px, 336.4 KB)
### [45149] Staggering Strength
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (6–7/16, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to Apocalypse and change him to [[Giant]] form.
  > [star] **Forced Interrupt**: When Apocalypse attacks you, you are stunned. Discard this card after this activation.
  >
  > ---
  >
  > [star] **Boost**: After this activation, reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/45149.png` (710×1030 px, 401.3 KB)
### [45150] Biomorphic Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (8–9/16, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > **When Revealed**: If Apocalypse is in [[Biomorph]] form, he activates against you. Otherwise, change Apocalypse to [[Biomorph]] form and place 1 power counter on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: After this activation, change Apocalypse to [[Biomorph]] form.
- **Image Asset**: `assets/card-art/bundles/cards/45150.jpg` (710×1030 px, 344.0 KB)
### [45151] Technological Interface
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (10–11/16, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > **When Revealed**: If Apocalypse is in [[Cyberpath]] form, he activates against you. Otherwise, change Apocalypse to [[Cyberpath]] form and place 1 power counter on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: After this activation, change Apocalypse to [[Cyberpath]] form.
- **Image Asset**: `assets/card-art/bundles/cards/45151.png` (710×1030 px, 321.6 KB)
### [45152] Giant-Sized Despot
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (12–13/16, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > **When Revealed**: If Apocalypse is in [[Giant]] form, he activates against you. Otherwise, change Apocalypse to [[Giant]] form and place 1 power counter on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: After this activation, change Apocalypse to [[Giant]] form.
- **Image Asset**: `assets/card-art/bundles/cards/45152.png` (710×1030 px, 327.5 KB)
### [45153] Source of Power
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (14/16)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Superpower.*
- **Rules Text**:
  > **When Defeated**: If Apocalypse is in [[Biomorph]] form, he activates against the player who defeated this scheme. Otherwise, change Apocalypse to [[Biomorph]] form and give him a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/45153.jpg` (1030×710 px, 355.6 KB)
### [45154] Plugged In
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (15/16)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Traits**: *Superpower.*
- **Rules Text**:
  > **When Defeated**: If Apocalypse is in [[Cyberpath]] form, he activates against the player who defeated this scheme. Otherwise, change Apocalypse to [[Cyberpath]] form and give him a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/45154.png` (1030×710 px, 371.2 KB)
### [45155] Giant Growth
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (16/16)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *Superpower.*
- **Rules Text**:
  > **When Defeated**: If Apocalypse is in [[Giant]] form, he activates against the player who defeated this scheme. Otherwise, change Apocalypse to [[Giant]] form and give him a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/45155.jpg` (1030×710 px, 318.6 KB)
### [45184a] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (1/16)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Biomorph.*
- **Rules Text**:
  > [star] Apocalypse's attacks gain overkill.
  > **Forced Response**: After Apocalypse changes to this form, deal 1 indirect damage to each player.
- **Flavor**: *"Now I claim my destiny!"*
- **Image Asset**: `assets/card-art/bundles/cards/45184a.png` (289×419 px, 247.6 KB)
### [45184b] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (1/16)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Cyberpath.*
- **Rules Text**:
  > Retaliate 1.
  > **Forced Response**: After Apocalypse changes to this form, place 1 threat on each scheme in play.
- **Flavor**: *"I have judged you and found you wanting."*
- **Image Asset**: `assets/card-art/bundles/cards/45184b.png` (289×419 px, 252.0 KB)
### [45184c] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (1/16)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Giant.*
- **Rules Text**:
  > Stalwart.
  > **Forced Response**: After Apocalypse changes to this form, heal 1 damage from him.
- **Flavor**: *"I am as far beyond mutants as they are above humans."*
- **Image Asset**: `assets/card-art/bundles/cards/45184c.png` (304×419 px, 259.2 KB)
### [45185a] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (2/16)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Biomorph.*
- **Rules Text**:
  > [star] Apocalypse's attacks gain overkill.
  > **Forced Response**: After Apocalypse changes to this form, deal 2 indirect damage to each player.
- **Flavor**: *"Now I claim my destiny!"*
- **Image Asset**: `assets/card-art/bundles/cards/45185a.png` (289×419 px, 253.1 KB)
### [45185b] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (2/16)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 3, **ATK**: 1, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Cyberpath.*
- **Rules Text**:
  > Retaliate 1.
  > **Forced Response**: After Apocalypse changes to this form, place 2 threat on each scheme in play.
- **Flavor**: *"I have judged you and found you wanting."*
- **Image Asset**: `assets/card-art/bundles/cards/45185b.png` (289×419 px, 253.1 KB)
### [45185c] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (2/16)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Giant.*
- **Rules Text**:
  > Stalwart.
  > **Forced Response**: After Apocalypse changes to this form, heal 2 damage from him.
- **Flavor**: *"I am as far beyond mutants as they are above humans."*
- **Image Asset**: `assets/card-art/bundles/cards/45185c.png` (304×419 px, 260.4 KB)
### [45186a] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (3/16)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 24 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Biomorph.*
- **Rules Text**:
  > [star] Apocalypse's attacks gain overkill.
  > **Forced Response**: After Apocalypse changes to this form, deal 3 indirect damage to each player.
- **Flavor**: *"Now I claim my destiny!"*
- **Image Asset**: `assets/card-art/bundles/cards/45186a.png` (289×419 px, 247.9 KB)
### [45186b] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (3/16)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2, **HP**: 24 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Cyberpath.*
- **Rules Text**:
  > Retaliate 1.
  > **Forced Response**: After Apocalypse changes to this form, place 3 threat on each scheme in play.
- **Flavor**: *"I have judged you and found you wanting."*
- **Image Asset**: `assets/card-art/bundles/cards/45186b.png` (289×419 px, 256.8 KB)
### [45186c] Apocalypse
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: En Sabah Nur (3/16)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 3, **HP**: 24 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: En Sabah Nur Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant. Giant.*
- **Rules Text**:
  > Stalwart.
  > **Forced Response**: After Apocalypse changes to this form, heal 3 damage from him.
- **Flavor**: *"I am as far beyond mutants as they are above humans."*
- **Image Asset**: `assets/card-art/bundles/cards/45186c.png` (304×419 px, 260.0 KB)

### Set: Celestial Tech

### [45156] Celestial Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Celestial Tech (1/4)
- **Stats**: **SCH**: 0 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Celestial Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Celestial.*
- **Rules Text**:
  > Attach to the villain.
  > [star] **Forced Interrupt**: When the villain schemes against you, discard the top card of your deck. If that card's resource has:
  > [energy] — Heal 2 damage from the villain.
  > [mental] — You are confused. Discard this card.
  > [physical] — Give the villain a tough status card.
  > [wild] — Do all of the above.
- **Image Asset**: `assets/card-art/bundles/cards/45156.jpg` (710×1030 px, 375.1 KB)
### [45157] Celestial Weapon
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Celestial Tech (2/4)
- **Stats**: **ATK**: 0 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Celestial Tech Set Icon (printed bottom-right next to deck number)
- **Traits**: *Celestial. Weapon.*
- **Rules Text**:
  > Attach to the villain.
  > [star] **Forced Interrupt**: When the villain attacks you, discard the top card of your deck. If that card's resource has:
  > [energy] — Deal 2 damage to your identity.
  > [mental] — Discard a card from your hand.
  > [physical] — You are stunned. Discard this card.
  > [wild] — Do all of the above.
- **Image Asset**: `assets/card-art/bundles/cards/45157.png` (710×1030 px, 308.6 KB)
### [45158] Celestial Tech
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Celestial Tech (3–4/4, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Celestial Tech Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: For each [[Celestial]] attachment in play, resolve its effect as if the attached villain just schemed against you and attacked you. If there are no [[Celestial]] attachments on the villain, search the encounter deck and discard pile for a [[Celestial]] attachment and reveal it. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/45158.png` (710×1030 px, 321.0 KB)

### Set: Clan Akkaba

### [45159] Ozymandias
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Clan Akkaba (1/7)
- **Stats**: **SCH**: 1 [star], **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Clan Akkaba Set Icon (printed bottom-right next to deck number)
- **Traits**: *Clan Akkaba. Elite.*
- **Rules Text**:
  > Toughness. Villainous.
  > [star] When Ozymandias schemes, place the threat on Ancient Ritual.
  >
  > ---
  >
  > [star] **Boost**: Choose: Either place 3 threat on Ancient Ritual, or this card gains [boost][boost][boost].
- **Image Asset**: `assets/card-art/bundles/cards/45159.jpg` (710×1030 px, 362.2 KB)
### [45160] Scarab
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Clan Akkaba (2/7)
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Clan Akkaba Set Icon (printed bottom-right next to deck number)
- **Traits**: *Clan Akkaba.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After Scarab attacks, place 1 threat on Ancient Ritual (3 threat instead if the attack defeated an ally).
- **Image Asset**: `assets/card-art/bundles/cards/45160.jpg` (710×1030 px, 305.6 KB)
### [45161] Clan Akkaba Zealot
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Clan Akkaba (3–5/7, Qty: 3)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Clan Akkaba Set Icon (printed bottom-right next to deck number)
- **Traits**: *Clan Akkaba.*
- **Rules Text**:
  > Guard.
  > **When Defeated**: Place 2 threat on Ancient Ritual.
  >
  > ---
  >
  > [star] **Boost**: Place 1 threat on Ancient Ritual.
- **Image Asset**: `assets/card-art/bundles/cards/45161.png` (710×1030 px, 374.2 KB)
### [45162] Tyrant Worship
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Clan Akkaba (6/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Clan Akkaba Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 5 threat on Ancient Ritual.
  >
  > ---
  >
  > [star] **Boost**: Choose: Either place 3 threat on Ancient Ritual, or this card gains [boost][boost][boost].
- **Flavor**: *Clan Akkaba has dedicated itself completely to its lord's merciless doctrine.*
- **Image Asset**: `assets/card-art/bundles/cards/45162.png` (710×1030 px, 297.8 KB)
### [45163] Ancient Ritual
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Clan Akkaba (7/7)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Clan Akkaba Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent. Setup.
  > **Forced Response**: After threat is placed here, if there is at least 10 threat here, remove 5 threat from this scheme and deal each player a facedown encounter card.
- **Flavor**: *"Not sure what they're doing, but I'm sure it's not good." —Iceman*
- **Image Asset**: `assets/card-art/bundles/cards/45163.jpg` (1030×710 px, 328.0 KB)

### Set: Age of Apocalypse

### [45164] Agent of Apocalypse
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Age of Apocalypse (1–2/4, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Age of Apocalypse Set Icon (printed bottom-right next to deck number)
- **Traits**: *Clan Akkaba.*
- **Rules Text**:
  > Guard.
  > **When Revealed**: Choose: Either add Agent of Apocalypse to the mission area, or it activates against you.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to an ally at the mission. Give the activating enemy an additional boost card.
- **Image Asset**: `assets/card-art/bundles/cards/45164.png` (710×1030 px, 356.4 KB)
### [45165] Worldwide Crisis
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Age of Apocalypse (3–4/4, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Age of Apocalypse Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose: Either place 3 threat on the [[Mission]] side scheme, or take 1 damage and this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Place 1 threat on the [[Mission]] side scheme. Give the activating enemy an additional boost card.
- **Image Asset**: `assets/card-art/bundles/cards/45165.jpg` (710×1030 px, 326.6 KB)

### Set: Mission

### [45166a] Liberate the Seattle Core
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (1/5)
- **Stats**: **Base Threat**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mission.*
- **Rules Text**:
  > **Forced Response**: After you resolve a mission attempt, place 1 attempt counter here and deal 1 damage to each ally at the mission. If there are 4 attempt counters here, remove Mission Team from the game and flip this card over.
  > **When Defeated**: Shuffle each player card at the mission into its owner's deck. Flip Mission Team and this card over.
- **Image Asset**: `assets/card-art/bundles/cards/45166a.png` (419×289 px, 250.7 KB)
### [45166b] Liberate the Seattle Core
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (1/5)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Finished.*
- **Rules Text**:
  > **Forced Response**: After you flip to this side, remove each card in the mission area from the game and do the following:
  > • If the mission was not defeated, place 2[per_hero] threat on the main scheme.
  > • If the mission was defeated, each player adds 1 copy of the Desperate Measures upgrade to their hand.
- **Image Asset**: `assets/card-art/bundles/cards/45166b.png` (419×289 px, 252.8 KB)
### [45167a] Evacuate Survivors
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (2/5)
- **Stats**: **Base Threat**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mission.*
- **Rules Text**:
  > **Forced Response**: After you resolve a mission attempt, place 1 attempt counter here and deal 1 damage to each ally at the mission. If there are 4 attempt counters here, remove Mission Team from the game and flip this card over.
  > **When Defeated**: Shuffle each player card at the mission into its owner's deck. Flip Mission Team and this card over.
- **Image Asset**: `assets/card-art/bundles/cards/45167a.png` (419×289 px, 263.0 KB)
### [45167b] Evacuate Survivors
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (2/5)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Finished.*
- **Rules Text**:
  > **Forced Response**: After you flip to this side, remove each card in the mission area from the game and do the following:
  > • If the mission was not defeated, deal each player a facedown encounter card.
  > • If the mission was defeated, each player searches their deck and discard pile for 1 card and adds it to their hand.
- **Image Asset**: `assets/card-art/bundles/cards/45167b.png` (419×289 px, 260.1 KB)
### [45168a] Sabotage the Sea Wall
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (3/5)
- **Stats**: **Base Threat**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mission.*
- **Rules Text**:
  > **Forced Response**: After you resolve a mission attempt, place 1 attempt counter here and deal 1 damage to each ally at the mission. If there are 4 attempt counters here, remove Mission Team from the game and flip this card over.
  > **When Defeated**: Shuffle each player card at the mission into its owner's deck. Flip Mission Team and this card over.
- **Image Asset**: `assets/card-art/bundles/cards/45168a.png` (419×289 px, 256.1 KB)
### [45168b] Sabotage the Sea Wall
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (3/5)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Finished.*
- **Rules Text**:
  > **Forced Response**: After you flip to this side, remove each card in the mission area from the game and do the following:
  > • If the mission was not defeated, find North American Sea Wall and reveal it. *(Shuffle.)*
  > • If the mission was defeated, find North American Sea Wall, remove it from the game, and each player deals 3 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/45168b.png` (419×289 px, 251.5 KB)
### [45169a] Find Lost Mutants
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (4/5)
- **Stats**: **Base Threat**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mission.*
- **Rules Text**:
  > **Forced Response**: After you resolve a mission attempt, place 1 attempt counter here and deal 1 damage to each ally at the mission. If there are 4 attempt counters here, remove Mission Team from the game and flip this card over.
  > **When Defeated**: Shuffle each player card at the mission into its owner's deck. Flip Mission Team and this card over.
- **Image Asset**: `assets/card-art/bundles/cards/45169a.png` (419×289 px, 254.8 KB)
### [45169b] Find Lost Mutants
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (4/5)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Finished.*
- **Rules Text**:
  > **Forced Response**: After you flip to this side, remove each card in the mission area from the game and do the following:
  > • If the mission was not defeated, each player discards 1 card from their hand.
  > • If the mission was defeated, each player adds one set-aside campaign ally to their hand.
- **Image Asset**: `assets/card-art/bundles/cards/45169b.png` (419×289 px, 251.2 KB)
### [45170a] Protect the Professor
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (5/5)
- **Stats**: **Base Threat**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mission.*
- **Rules Text**:
  > **Forced Response**: After you resolve a mission attempt, place 1 attempt counter here and deal 1 damage to each ally at the mission. If there are 4 attempt counters here, remove Mission Team from the game and flip this card over.
  > **When Defeated**: Shuffle each player card at the mission into its owner's deck. Flip Mission Team and this card over.
- **Image Asset**: `assets/card-art/bundles/cards/45170a.png` (419×289 px, 255.4 KB)
### [45170b] Protect the Professor
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Mission (5/5)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mission Set Icon (printed bottom-right next to deck number)
- **Traits**: *Finished.*
- **Rules Text**:
  > **Forced Response**: After you flip to this side, remove each card in the mission area from the game and do the following:
  > • If the mission was not defeated, the players lose the game.
  > • If the mission was defeated, each player searches their deck and discard pile for an ally and adds it to their hand.
- **Image Asset**: `assets/card-art/bundles/cards/45170b.png` (419×289 px, 246.6 KB)

### Set: Campaign

### [45171a] Mission Team
- **Type**: `Support`
- **Faction / Aspect**: Campaign
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Campaign (Set Card, unnumbered)
- **Stats**: **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mission.*
- **Rules Text**:
  > Mission Team cannot be discarded and the first player gains control of it.
  > **Action**: Exhaust Mission Team → choose:
  > • Reduce the cost of the next ally played to the mission this phase by 2.
  > • Make a mission attempt.
- **Image Asset**: `assets/card-art/bundles/cards/45171a.png` (289×419 px, 242.9 KB)
### [45171b] Mission Team
- **Type**: `Support`
- **Faction / Aspect**: Campaign
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Campaign (Set Card, unnumbered)
- **Stats**: **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Finished.*
- **Rules Text**:
  > Mission Team cannot be discarded and the first player gains control of it.
  > **Action**: Exhaust Mission Team → choose a player to draw 1 card.
- **Flavor**: *"Another successful mission. Hopefully this time they don't sue for damages!" —Polaris*
- **Image Asset**: `assets/card-art/bundles/cards/45171b.png` (289×419 px, 247.6 KB)
### [45172] Destiny — *Irene Adler*
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Campaign (Set Card, unnumbered)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 3 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Destiny enters your hand, remove 2 threat from the main scheme.
- **Flavor**: *"Outsmarting your opponent is child's play when you know the future."*
- **Image Asset**: `assets/card-art/bundles/cards/45172.jpg` (710×1030 px, 277.0 KB)
### [45173] Blink — *Clarice Ferguson*
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Campaign (Set Card, unnumbered)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Blink enters your hand, deal 2 damage to the villain.
- **Flavor**: *"My name's Blink. Who do you think is faster?"*
- **Image Asset**: `assets/card-art/bundles/cards/45173.png` (710×1030 px, 302.8 KB)
### [45174] Morph — *Kevin Sydney*
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Campaign (Set Card, unnumbered)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Morph enters your hand, confuse the villain.
- **Flavor**: *"What's all the hubbub, bub?"*
- **Image Asset**: `assets/card-art/bundles/cards/45174.jpg` (710×1030 px, 283.5 KB)
### [45175] X-Man — *Nate Grey*
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Campaign (Set Card, unnumbered)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After X-Man enters your hand, give your identity a tough status card.
- **Flavor**: *"The innocent are safe so long as I have anything to say!"*
- **Image Asset**: `assets/card-art/bundles/cards/45175.png` (710×1030 px, 292.1 KB)
### [45176] Desperate Measures
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Campaign (Set Card, unnumbered)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to an ally. Limit 1 per ally.
  > Attached ally gets +1 THW, +1 ATK, +1 hit point, and is considered to have a wild ([wild]) resource icon in addition to its printed resource icon.
- **Flavor**: *"My brother will never stop." —Magik*
- **Image Asset**: `assets/card-art/bundles/cards/45176.png` (710×1030 px, 326.7 KB)
### [45177] North American Sea Wall
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Campaign (1/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 2[per_hero]. Surge. Victory 2.
  > The villain cannot take damage.
  >
  > ---
  >
  > [star] **Boost**: Deal this card to yourself as a facedown encounter card.
- **Flavor**: *Apocalypse's high-tech sea wall protects the eastern frontier of his realm.*
- **Image Asset**: `assets/card-art/bundles/cards/45177.jpg` (1030×710 px, 323.6 KB)
### [45178] Panicked Refugees
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Campaign (2–5/5, Qty: 4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Response**: After this card enters your hand, reveal it. Then, draw 1 card.
  > **Alter-Ego Action**: Exhaust your identity → remove this card from the game.
- **Image Asset**: `assets/card-art/bundles/cards/45178.jpg` (710×1030 px, 315.1 KB)

### Set: Overseer

### [45179a] Mister Sinister
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Overseer (1/5)
- **Properties**: Unique
- **Stats**: **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Overseer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Overseer.*
- **Rules Text**:
  > Victory 5.
  > Cannot take damage while another minion is at the mission.
  > Players cannot assign cards with the same resource icon ([energy], [mental], [physical], or [wild]) to more than one ally each mission attempt.
- **Image Asset**: `assets/card-art/bundles/cards/45179a.png` (289×419 px, 240.9 KB)
### [45180a] The Shadow King
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Overseer (2/5)
- **Properties**: Unique
- **Stats**: **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Overseer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Overseer.*
- **Rules Text**:
  > Victory 5.
  > Cannot take damage while another minion is at the mission.
  > **Mission Response**: After you discard cards, place 2 threat on the [[Mission]] side scheme for each mental resource ([mental]) discarded.
- **Image Asset**: `assets/card-art/bundles/cards/45180a.png` (289×419 px, 238.2 KB)
### [45181a] Abyss
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Overseer (3/5)
- **Properties**: Unique
- **Stats**: **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Overseer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Overseer.*
- **Rules Text**:
  > Victory 5.
  > Cannot take damage while another minion is at the mission.
  > **Mission Response**: After you discard cards, attach each card with a wild resource ([wild]) discarded to Abyss facedown. *(They cannot be used for the mission attempt.)*
- **Image Asset**: `assets/card-art/bundles/cards/45181a.png` (289×419 px, 245.7 KB)
### [45182a] Sugar Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Overseer (4/5)
- **Properties**: Unique
- **Stats**: **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Overseer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Overseer.*
- **Rules Text**:
  > Victory 5.
  > Cannot take damage while another minion is at the mission.
  > **Mission Response**: After you discard cards, heal 3 damage from Sugar Man for each physical resource ([physical]) discarded.
- **Image Asset**: `assets/card-art/bundles/cards/45182a.png` (289×419 px, 247.7 KB)
### [45183a] Mikhail Rasputin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Overseer (5/5)
- **Properties**: Unique
- **Stats**: **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Overseer Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Overseer.*
- **Rules Text**:
  > Victory 5.
  > Cannot take damage while another minion is at the mission.
  > **Mission Response**: After you discard cards, deal 1 damage to an ally at the mission for each energy resource ([energy]) discarded.
- **Image Asset**: `assets/card-art/bundles/cards/45183a.png` (289×419 px, 240.3 KB)

### Set: Prelates

### [45179b] Mister Sinister
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Prelates (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Prelates Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Prelate.*
- **Rules Text**:
  > Retaliate 1. Toughness. Villainous. Victory 3.
  > Mister Sinister engages the first player.
- **Image Asset**: `assets/card-art/bundles/cards/45179b.png` (289×419 px, 239.5 KB)
### [45180b] The Shadow King
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Prelates (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 1 [star], **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Prelates Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Prelate.*
- **Rules Text**:
  > Toughness. Victory 3.
  > Shadow King engages the first player.
  > [star] **Forced Response**: After The Shadow King attacks you, choose an ally you control with the highest THW. Either discard that ally, or place threat on the main scheme equal to its THW.
- **Image Asset**: `assets/card-art/bundles/cards/45180b.png` (289×419 px, 244.0 KB)
### [45181b] Abyss
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Prelates (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Prelates Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Prelate.*
- **Rules Text**:
  > Toughness. Victory 3.
  > Abyss gets +2 hit points for each facedown card attached to him and engages the first player.
  > [star] **Forced Response**: After Abyss activates against you, attach the top card of your deck to him, facedown.
- **Image Asset**: `assets/card-art/bundles/cards/45181b.png` (289×419 px, 253.1 KB)
### [45182b] Sugar Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Prelates (4/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Prelates Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Prelate.*
- **Rules Text**:
  > Toughness. Victory 3.
  > Sugar Man engages the first player.
  > [star] **Forced Interrupt**: When Sugar Man attacks, this attack gains piercing. If this attack defeats a character, heal 5 damage from Sugar Man.
- **Image Asset**: `assets/card-art/bundles/cards/45182b.png` (289×419 px, 246.0 KB)
### [45183b] Mikhail Rasputin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Age of Apocalypse (`aoa`)
- **Deck / Set**: Prelates (5/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Prelates Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Prelate.*
- **Rules Text**:
  > Toughness. Victory 3.
  > Mikhail Rasputin engages the first player.
  > [star] **Forced Interrupt**: When Mikhail Rasputin attacks you, deal 1 damage to your identity.
- **Image Asset**: `assets/card-art/bundles/cards/45183b.png` (289×419 px, 237.6 KB)

