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
| `40001a` | Cable | Hero | Cable | THW:2 ATK:2 DEF:2 HP:12 | - | `next_evol` |
| `40001b` | Nathan Summers | Alter-Ego | Cable | REC:4 HP:12 | - | `next_evol` |
| `40002` | Bodyslide | Event | Cable | - | - | `next_evol` |
| `40003` | Mind Scan | Event | Cable | - | - | `next_evol` |
| `40004` | Precognition | Event | Cable | - | - | `next_evol` |
| `40005` | Telekinetic Blast | Event | Cable | - | - | `next_evol` |
| `40006` | Technovirus Purge | Player Side Scheme | Cable | - | - | `next_evol` |
| `40007` | Graymalkin | Support | Cable | - | - | `next_evol` |
| `40008` | Professor | Support | Cable | - | - | `next_evol` |
| `40009` | Askani'son | Upgrade | Cable | - | - | `next_evol` |
| `40010` | Forced Amnesia | Upgrade | Cable | - | - | `next_evol` |
| `40011` | Plasma Rifle | Upgrade | Cable | - | - | `next_evol` |
| `40012` | Telekinetic Force Field | Upgrade | Cable | - | - | `next_evol` |
| `40013` | Temporal Leap | Upgrade | Cable | - | - | `next_evol` |
| `40014` | Caliban | Ally | Pack Position: 14 | THW:1 ATK:2 HP:3 | - | `next_evol` |
| `40015` | Fantomex | Ally | Pack Position: 15 | THW:1 ATK:1 HP:3 | - | `next_evol` |
| `40016` | Sunspot | Ally | Pack Position: 16 | THW:1 ATK:2 HP:2 | - | `next_evol` |
| `40017` | Mission Planning | Event | Pack Position: 17 | - | - | `next_evol` |
| `40018` | Call for Backup | Player Side Scheme | Pack Position: 18 | - | - | `next_evol` |
| `40019` | Lock and Load | Player Side Scheme | Pack Position: 19 | - | - | `next_evol` |
| `40020` | Establish Perimeter | Player Side Scheme | Pack Position: 20 | - | - | `next_evol` |
| `40021` | E.V.A. | Support | Pack Position: 21 | - | - | `next_evol` |
| `40022` | Uncanny X-Force | Support | Pack Position: 22 | - | - | `next_evol` |
| `40023` | Mission Leader | Upgrade | Pack Position: 23 | - | - | `next_evol` |
| `40024` | Deadpool | Ally | Pack Position: 24 | THW:2 ATK:2 HP:3 | - | `next_evol` |
| `40025` | Deathlok | Ally | Pack Position: 25 | THW:2 ATK:2 HP:3 | - | `next_evol` |
| `40026` | Frenemies | Event | Pack Position: 26 | - | - | `next_evol` |
| `40027` | Build Support | Player Side Scheme | Pack Position: 27 | - | - | `next_evol` |
| `40028` | The Power of the Mind | Resource | Pack Position: 28 | - | - | `next_evol` |
| `40029` | Psimitar | Upgrade | Pack Position: 29 | - | - | `next_evol` |
| `40030` | Sidearm | Upgrade | Pack Position: 30 | - | - | `next_evol` |
| `40031` | Technovirus Resurgence | Obligation | Cable | - | 2 icons | `next_evol` |
| `40032` | Stryfe | Minion | Cable Nemesis | SCH:2 ATK:2 HP:5 | 3 icons | `next_evol` |
| `40033` | Back to the Future | Side Scheme | Cable Nemesis | - | 2 icons | `next_evol` |
| `40034` | Telekinetic Force Field | Attachment | Cable Nemesis | - | 1 icon + star | `next_evol` |
| `40035` | Mind Scan | Treachery | Cable Nemesis | - | 0 icons + star | `next_evol` |
| `40036` | Telekinetic Blast | Treachery | Cable Nemesis | - | 0 icons + star | `next_evol` |
| `40037a` | Domino | Hero | Domino | THW:1 ATK:2 DEF:3 HP:9 | - | `next_evol` |
| `40037b` | Neena Thurman | Alter-Ego | Domino | REC:3 HP:9 | - | `next_evol` |
| `40038` | Diamondback | Ally | Domino | THW:1 ATK:1 HP:2 | - | `next_evol` |
| `40039` | Outlaw | Ally | Domino | THW:1 ATK:1 HP:3 | - | `next_evol` |
| `40040` | A Good Workout | Event | Domino | - | - | `next_evol` |
| `40041` | Luck Be a Lady | Event | Domino | - | - | `next_evol` |
| `40042` | Right Place, Right Time | Event | Domino | - | - | `next_evol` |
| `40043` | Jackpot! | Resource | Domino | - | - | `next_evol` |
| `40044` | Pip the Pug | Support | Domino | - | - | `next_evol` |
| `40045` | The Painted Lady | Support | Domino | - | - | `next_evol` |
| `40046` | Domino's Pistol | Upgrade | Domino | - | - | `next_evol` |
| `40047` | Lucky and Good | Upgrade | Domino | - | - | `next_evol` |
| `40048` | Lucky Break | Upgrade | Domino | - | - | `next_evol` |
| `40049` | Probability Field | Upgrade | Domino | - | - | `next_evol` |
| `40050` | Feral | Ally | Pack Position: 50 | THW:2 ATK:2 HP:3 | - | `next_evol` |
| `40051` | Wolfsbane | Ally | Pack Position: 51 | THW:2 ATK:1 HP:3 | - | `next_evol` |
| `40052` | Even the Odds | Event | Pack Position: 52 | - | - | `next_evol` |
| `40053` | Team Investigation | Event | Pack Position: 53 | - | - | `next_evol` |
| `40054` | Take Out the Guards | Player Side Scheme | Pack Position: 54 | - | - | `next_evol` |
| `40055` | Overwatch | Upgrade | Pack Position: 55 | - | - | `next_evol` |
| `40056` | Atlas Bear | Ally | Pack Position: 56 | THW:1 ATK:1 HP:3 | - | `next_evol` |
| `40057` | White Fox | Ally | Pack Position: 57 | THW:1 ATK:1 HP:3 | - | `next_evol` |
| `40058` | The Posse | Event | Pack Position: 58 | - | - | `next_evol` |
| `40059` | Superpower Training | Player Side Scheme | Pack Position: 59 | - | - | `next_evol` |
| `40060` | Digging Deep | Resource | Pack Position: 60 | - | - | `next_evol` |
| `40061` | Energy | Resource | Pack Position: 61 | - | - | `next_evol` |
| `40062` | Genius | Resource | Pack Position: 62 | - | - | `next_evol` |
| `40063` | Strength | Resource | Pack Position: 63 | - | - | `next_evol` |
| `40064` | Sharpshooter | Upgrade | Pack Position: 64 | - | - | `next_evol` |
| `40065` | Memories of Armageddon | Obligation | Domino | - | 2 icons | `next_evol` |
| `40066` | Topaz | Minion | Domino Nemesis | SCH:1 ATK:2 HP:3 | 3 icons | `next_evol` |
| `40067` | Not My Lucky Day | Side Scheme | Domino Nemesis | - | 2 icons | `next_evol` |
| `40068` | Prototype | Minion | Domino Nemesis | SCH:2 ATK:2 HP:1 | 2 icons | `next_evol` |
| `40069` | Superpower Feedback | Attachment | Domino Nemesis | - | 1 icon | `next_evol` |
| `40070a` | Arclight | Villain | Marauders | SCH:1 ATK:1 HP:10 | - | `next_evol` |
| `40070b` | Arclight | Villain | Marauders | SCH:2 ATK:2 HP:13 | - | `next_evol` |
| `40071a` | Blockbuster | Villain | Marauders | SCH:0 ATK:2 HP:11 | - | `next_evol` |
| `40071b` | Blockbuster | Villain | Marauders | SCH:1 ATK:3 HP:14 | - | `next_evol` |
| `40072a` | Chimera | Villain | Marauders | SCH:1 ATK:1 HP:11 | - | `next_evol` |
| `40072b` | Chimera | Villain | Marauders | SCH:2 ATK:2 HP:14 | - | `next_evol` |
| `40073a` | Greycrow | Villain | Marauders | SCH:1 ATK:1 HP:9 | - | `next_evol` |
| `40073b` | Greycrow | Villain | Marauders | SCH:2 ATK:2 HP:12 | - | `next_evol` |
| `40074a` | Harpoon | Villain | Marauders | SCH:0 ATK:2 HP:10 | - | `next_evol` |
| `40074b` | Harpoon | Villain | Marauders | SCH:1 ATK:3 HP:13 | - | `next_evol` |
| `40075a` | Riptide | Villain | Marauders | SCH:1 ATK:1 HP:9 | - | `next_evol` |
| `40075b` | Riptide | Villain | Marauders | SCH:2 ATK:2 HP:12 | - | `next_evol` |
| `40076a` | Vertigo | Villain | Marauders | SCH:2 ATK:0 HP:9 | - | `next_evol` |
| `40076b` | Vertigo | Villain | Marauders | SCH:3 ATK:1 HP:12 | - | `next_evol` |
| `40077` | Knock, Knock | Main Scheme | Morlock Siege | - | - | `next_evol` |
| `40077a` | Knock, Knock | Main Scheme | Morlock Siege | - | - | `next_evol` |
| `40077b` | Knock, Knock | Main Scheme | Morlock Siege | - | - | `next_evol` |
| `40078` | Mutant Massacre | Main Scheme | Morlock Siege | - | - | `next_evol` |
| `40078a` | Mutant Massacre | Main Scheme | Morlock Siege | - | - | `next_evol` |
| `40078b` | Mutant Massacre | Main Scheme | Morlock Siege | - | - | `next_evol` |
| `40079` | Morlock | Ally | Morlock Siege | THW:1 ATK:1 HP:5 | not recorded in this source | `next_evol` |
| `40080` | Hide! | Treachery | Morlock Siege | - | 0 icons + star | `next_evol` |
| `40081a` | Routed | Environment | Morlock Siege | - | - | `next_evol` |
| `40081b` | Routed | Environment | Morlock Siege | - | - | `next_evol` |
| `40082` | Bolstered by Wrath | Attachment | Morlock Siege | SCH:1 ATK:1 | 1 icon + star | `next_evol` |
| `40083` | Pushed to the Limit | Attachment | Morlock Siege | ATK:1 | 3 icons | `next_evol` |
| `40084` | By Any Means | Side Scheme | Morlock Siege | - | 3 icons | `next_evol` |
| `40085` | In the Midst of Chaos | Side Scheme | Morlock Siege | - | 1 icon | `next_evol` |
| `40086` | Maraudin' Ain't Easy | Side Scheme | Morlock Siege | - | 2 icons | `next_evol` |
| `40087` | Territorial Control | Side Scheme | Morlock Siege | - | 2 icons | `next_evol` |
| `40088` | Back in Action | Treachery | Morlock Siege | - | 1 icon + star | `next_evol` |
| `40089` | Seek the Weak | Treachery | Morlock Siege | - | 1 icon + star | `next_evol` |
| `40090` | Heavy Armament | Attachment | Military Grade | ATK:2 | 3 icons | `next_evol` |
| `40091` | Titanium Exoskeleton | Attachment | Military Grade | - | 2 icons | `next_evol` |
| `40092` | Inhibitor Collar | Attachment | Military Grade | ATK:-1 | 1 icon | `next_evol` |
| `40093` | The Senator's Support | Side Scheme | Military Grade | - | 2 icons | `next_evol` |
| `40094` | Arclight | Minion | Mutant Slayers | SCH:1 ATK:1 HP:5 | 1 icon | `next_evol` |
| `40095` | Blockbuster | Minion | Mutant Slayers | SCH:0 ATK:2 HP:5 | 2 icons | `next_evol` |
| `40096` | Chimera | Minion | Mutant Slayers | SCH:1 ATK:1 HP:5 | 3 icons | `next_evol` |
| `40097` | Greycrow | Minion | Mutant Slayers | SCH:1 ATK:1 HP:4 | 3 icons | `next_evol` |
| `40098` | Harpoon | Minion | Mutant Slayers | SCH:0 ATK:2 HP:5 | 1 icon | `next_evol` |
| `40099` | Riptide | Minion | Mutant Slayers | SCH:1 ATK:1 HP:4 | 1 icon | `next_evol` |
| `40100` | Vertigo | Minion | Mutant Slayers | SCH:1 ATK:0 HP:4 | 2 icons | `next_evol` |
| `40101` | Mutant Slayers | Side Scheme | Mutant Slayers | - | 2 icons | `next_evol` |
| `40102` | Bound by Business | Treachery | Mutant Slayers | - | 1 icon | `next_evol` |
| `40103` | Gotta Get Away | Main Scheme | On the Run | - | - | `next_evol` |
| `40103a` | Gotta Get Away | Main Scheme | On the Run | - | - | `next_evol` |
| `40103b` | Gotta Get Away | Main Scheme | On the Run | - | - | `next_evol` |
| `40104` | Escaping with Hope | Main Scheme | On the Run | - | - | `next_evol` |
| `40104a` | Escaping with Hope | Main Scheme | On the Run | - | - | `next_evol` |
| `40104b` | Escaping with Hope | Main Scheme | On the Run | - | - | `next_evol` |
| `40105a` | Hope's Captor | Attachment | On the Run | - | not recorded in this source | `next_evol` |
| `40105b` | Hope's Captor | Attachment | On the Run | SCH:1 ATK:1 | not recorded in this source | `next_evol` |
| `40106` | Hidden in the Clutter | Attachment | On the Run | - | 2 icons | `next_evol` |
| `40107` | Favored Weapon | Attachment | On the Run | ATK:1 | not recorded in this source | `next_evol` |
| `40108` | Bushwhack | Side Scheme | On the Run | - | 3 icons | `next_evol` |
| `40109` | Pure Force | Side Scheme | On the Run | - | 3 icons | `next_evol` |
| `40110` | Dizzying Deeds | Treachery | On the Run | - | 2 icons | `next_evol` |
| `40111` | Tag Team | Treachery | On the Run | - | 2 icons | `next_evol` |
| `40112` | Gorgeous George | Minion | Nasty Boys | SCH:1 ATK:2 HP:4 | 1 icon + star | `next_evol` |
| `40113` | Hairbag | Minion | Nasty Boys | SCH:1 ATK:2 HP:3 | 2 icons + star | `next_evol` |
| `40114` | Ramrod | Minion | Nasty Boys | SCH:1 ATK:2 HP:4 | 1 icon + star | `next_evol` |
| `40115` | Ruckus | Minion | Nasty Boys | SCH:2 ATK:1 HP:3 | 1 icon + star | `next_evol` |
| `40116` | Slab | Minion | Nasty Boys | SCH:1 ATK:1 HP:5 | 2 icons | `next_evol` |
| `40117` | Get Nasty | Side Scheme | Nasty Boys | - | 3 icons | `next_evol` |
| `40118` | Juggernaut | Villain | Juggernaut | SCH:1 ATK:2 HP:18 | - | `next_evol` |
| `40119` | Juggernaut | Villain | Juggernaut | SCH:1 ATK:3 HP:21 | - | `next_evol` |
| `40120` | Juggernaut | Villain | Juggernaut | SCH:2 ATK:4 HP:25 | - | `next_evol` |
| `40121` | The Unstoppable Juggernaut | Main Scheme | Juggernaut | - | - | `next_evol` |
| `40121a` | The Unstoppable Juggernaut | Main Scheme | Juggernaut | - | - | `next_evol` |
| `40121b` | The Unstoppable Juggernaut | Main Scheme | Juggernaut | - | - | `next_evol` |
| `40122a` | Juggernaut's Helmet | Attachment | Juggernaut | - | not recorded in this source | `next_evol` |
| `40122b` | Juggernaut Exposed | Attachment | Juggernaut | - | not recorded in this source | `next_evol` |
| `40123` | Head of Steam | Attachment | Juggernaut | - | 3 icons | `next_evol` |
| `40124` | Building Momentum | Side Scheme | Juggernaut | - | 2 icons | `next_evol` |
| `40125` | Breakthrough | Treachery | Juggernaut | - | 2 icons | `next_evol` |
| `40126` | Flatten | Treachery | Juggernaut | - | 1 icon + star | `next_evol` |
| `40127` | Ground Pound | Treachery | Juggernaut | - | 1 icon + star | `next_evol` |
| `40128` | Trample | Treachery | Juggernaut | - | 1 icon + star | `next_evol` |
| `40129` | Cyttorak's Exemplar | Treachery | Juggernaut | - | 3 icons | `next_evol` |
| `40130` | Hope Summers | Ally | Hope Summers | HP:3 | not recorded in this source | `next_evol` |
| `40131` | Captive Hope | Side Scheme | Hope Summers | - | 3 icons | `next_evol` |
| `40132` | Black Tom Cassidy | Minion | Black Tom Cassidy | SCH:1 ATK:1 HP:6 | 3 icons | `next_evol` |
| `40133` | Creeping Willow | Minion | Black Tom Cassidy | SCH:0 ATK:1 HP:3 | 1 icon + star | `next_evol` |
| `40134` | Making Green | Side Scheme | Black Tom Cassidy | - | 2 icons | `next_evol` |
| `40135` | A Sound Thrashing | Treachery | Black Tom Cassidy | - | 3 icons | `next_evol` |
| `40136` | Mister Sinister | Villain | Mister Sinister | SCH:2 ATK:1 HP:14 | - | `next_evol` |
| `40137` | Mister Sinister | Villain | Mister Sinister | SCH:2 ATK:2 HP:17 | - | `next_evol` |
| `40138` | Mister Sinister | Villain | Mister Sinister | SCH:3 ATK:2 HP:21 | - | `next_evol` |
| `40139` | Sinister Intent | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40139a` | Sinister Intent | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40139b` | Sinister Intent | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40140` | Taking Off | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40140a` | Taking Off | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40140b` | Taking Off | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40141` | Bulking Up | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40141a` | Bulking Up | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40141b` | Bulking Up | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40142` | Focusing In | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40142a` | Focusing In | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40142b` | Focusing In | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40143` | Sinister Ends | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40143a` | Sinister Ends | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40143b` | Sinister Ends | Main Scheme | Mister Sinister | - | - | `next_evol` |
| `40144` | Sinister Disguise | Attachment | Mister Sinister | - | 2 icons | `next_evol` |
| `40145` | Sinister Soldier | Minion | Mister Sinister | SCH:1 ATK:1 HP:5 | 0 icons + star | `next_evol` |
| `40146` | Teleported Away | Side Scheme | Mister Sinister | - | 2 icons | `next_evol` |
| `40147` | Genetic Mastery | Treachery | Mister Sinister | - | 2 icons | `next_evol` |
| `40148` | Molecular Control | Treachery | Mister Sinister | - | 1 icon + star | `next_evol` |
| `40149` | Sinister Schemes | Treachery | Mister Sinister | - | 1 icon + star | `next_evol` |
| `40150` | Sinister Strike | Treachery | Mister Sinister | - | 1 icon + star | `next_evol` |
| `40151` | Flight | Attachment | Flight | ATK:1 | not recorded in this source | `next_evol` |
| `40152` | Aerial Bombardment | Attachment | Flight | - | 2 icons | `next_evol` |
| `40153` | Out of Reach | Attachment | Flight | - | 2 icons | `next_evol` |
| `40154` | High Ground | Attachment | Flight | - | 1 icon + star | `next_evol` |
| `40155` | Super Strength | Attachment | Super Strength | ATK:1 | not recorded in this source | `next_evol` |
| `40156` | Impervious | Attachment | Super Strength | - | 2 icons | `next_evol` |
| `40157` | Thrown Object | Attachment | Super Strength | ATK:3 | 3 icons | `next_evol` |
| `40158` | "I'll Take That" | Treachery | Super Strength | - | 2 icons | `next_evol` |
| `40159` | Telepathy | Attachment | Telepathy | SCH:1 | not recorded in this source | `next_evol` |
| `40160` | Manufactured Drama | Obligation | Telepathy | - | 2 icons | `next_evol` |
| `40161` | Sowing Discord | Obligation | Telepathy | - | 2 icons | `next_evol` |
| `40162` | One Step Ahead | Treachery | Telepathy | - | 1 icon + star | `next_evol` |
| `40163` | Stryfe | Villain | Stryfe | SCH:1 ATK:0 HP:15 | - | `next_evol` |
| `40164` | Stryfe | Villain | Stryfe | SCH:1 ATK:1 HP:17 | - | `next_evol` |
| `40165` | Stryfe | Villain | Stryfe | SCH:2 ATK:1 HP:20 | - | `next_evol` |
| `40166` | Uncontrollable Power | Main Scheme | Stryfe | - | - | `next_evol` |
| `40166a` | Uncontrollable Power | Main Scheme | Stryfe | - | - | `next_evol` |
| `40166b` | Uncontrollable Power | Main Scheme | Stryfe | - | - | `next_evol` |
| `40167` | Left to Your Fate | Main Scheme | Stryfe | - | - | `next_evol` |
| `40167a` | Left to Your Fate | Main Scheme | Stryfe | - | - | `next_evol` |
| `40167b` | Left to Your Fate | Main Scheme | Stryfe | - | - | `next_evol` |
| `40168a` | Stryfe's Grasp | Side Scheme | Stryfe | - | not recorded in this source | `next_evol` |
| `40168b` | Living Bomb | Side Scheme | Stryfe | - | not recorded in this source | `next_evol` |
| `40169` | Mental Transferal | Attachment | Stryfe | - | 2 icons | `next_evol` |
| `40170` | Mind Alteration | Attachment | Stryfe | - | 2 icons | `next_evol` |
| `40171` | Mind Trap | Attachment | Stryfe | - | 2 icons | `next_evol` |
| `40172` | Psionic Amnesia | Attachment | Stryfe | - | 2 icons | `next_evol` |
| `40173` | Psychic Inertia | Attachment | Stryfe | SCH:-1 ATK:-1 | 1 icon | `next_evol` |
| `40174` | Zero | Minion | Stryfe | SCH:1 ATK:1 HP:4 | 1 icon | `next_evol` |
| `40175` | Cerebral Erasure | Side Scheme | Stryfe | - | 2 icons | `next_evol` |
| `40176` | Telepathic Camouflage | Side Scheme | Stryfe | - | 3 icons | `next_evol` |
| `40177` | Psionic Surge | Treachery | Stryfe | - | 2 icons | `next_evol` |
| `40178` | Psychic Override | Treachery | Stryfe | - | 1 icon + star | `next_evol` |
| `40179` | Telekinetic Wave | Treachery | Stryfe | - | 1 icon + star | `next_evol` |
| `40180` | Strobe | Minion | Extreme Measures | SCH:2 ATK:2 HP:4 | 2 icons | `next_evol` |
| `40181` | Tempo | Minion | Extreme Measures | SCH:1 ATK:1 HP:5 | not recorded in this source | `next_evol` |
| `40182` | Thumbelina | Minion | Extreme Measures | SCH:1 ATK:1 HP:3 | 1 icon | `next_evol` |
| `40183` | Wildside | Minion | Extreme Measures | SCH:0 ATK:3 HP:5 | 3 icons | `next_evol` |
| `40184` | Extreme Measures | Side Scheme | Extreme Measures | - | 1 icon | `next_evol` |
| `40185` | Dragoness | Minion | Mutant Insurrection | SCH:1 ATK:1 HP:3 | 2 icons | `next_evol` |
| `40186` | Forearm | Minion | Mutant Insurrection | SCH:0 ATK:4 HP:6 | 4 icons | `next_evol` |
| `40187` | Reaper | Minion | Mutant Insurrection | SCH:1 ATK:2 HP:4 | 2 icons | `next_evol` |
| `40188` | Samurai | Minion | Mutant Insurrection | SCH:1 ATK:2 HP:5 | 2 icons | `next_evol` |
| `40189` | Mutant Insurrection | Side Scheme | Mutant Insurrection | - | 2 icons | `next_evol` |
| `40190a` | Assemble the Team | Player Side Scheme | Next Evolution Campaign | - | not recorded in this source | `next_evol` |
| `40190b` | Team Assembled | Environment | Next Evolution Campaign | - | - | `next_evol` |
| `40191a` | Establish Safehouse | Player Side Scheme | Next Evolution Campaign | - | not recorded in this source | `next_evol` |
| `40191b` | Safehouse Established | Environment | Next Evolution Campaign | - | - | `next_evol` |
| `40192a` | Gear Up | Player Side Scheme | Next Evolution Campaign | - | not recorded in this source | `next_evol` |
| `40192b` | Geared Up | Environment | Next Evolution Campaign | - | - | `next_evol` |
| `40193a` | Mission Prep | Player Side Scheme | Next Evolution Campaign | - | not recorded in this source | `next_evol` |
| `40193b` | Mission Prepped | Environment | Next Evolution Campaign | - | - | `next_evol` |
| `40194a` | Practice Maneuvers | Player Side Scheme | Next Evolution Campaign | - | not recorded in this source | `next_evol` |
| `40194b` | Practiced Maneuvers | Environment | Next Evolution Campaign | - | - | `next_evol` |
| `40195a` | Prepare Defenses | Player Side Scheme | Next Evolution Campaign | - | not recorded in this source | `next_evol` |
| `40195b` | Prepared Defenses | Environment | Next Evolution Campaign | - | - | `next_evol` |
| `40196` | Pouches | Resource | Next Evolution Campaign | - | not recorded in this source | `next_evol` |
| `40197` | Safehouse | Support | Next Evolution Campaign | - | not recorded in this source | `next_evol` |
| `40198` | Lady Mastermind | Minion | Next Evolution Campaign | SCH:1 ATK:1 HP:3 | 2 icons + star | `next_evol` |
| `40199` | Malice | Minion | Next Evolution Campaign | SCH:1 ATK:1 HP:1 | 3 icons | `next_evol` |
| `40200` | Scrambler | Minion | Next Evolution Campaign | SCH:1 ATK:1 HP:3 | 3 icons | `next_evol` |
| `40201` | Vanisher | Minion | Next Evolution Campaign | SCH:1 ATK:1 HP:3 | 2 icons + star | `next_evol` |
| `40202` | Under Pressure | Side Scheme | Next Evolution Campaign | - | 2 icons + star | `next_evol` |
| `40203` | Overburdened | Treachery | Next Evolution Campaign | - | 1 icon + star | `next_evol` |
| `40204` | Hope Summers | Ally | Pack Position: 204 | THW:2 ATK:2 HP:3 | - | `next_evol` |

---

## Pack: NeXt Evolution (`next_evol`)

### Set: Cable

### [40001a] Cable
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 12, **Hand Size**: 5
- **Traits**: *Soldier. X-Force.*
- **Rules Text**:
  > **Response**: After Cable defeats a side scheme, ready him. (Limit once per phase.)
- **Flavor**: *"The battle may be won, but the war is far from over."*
- **Image Asset**: `assets/card-art/bundles/cards/40001a.png` (300×418 px, 236.1 KB)

### [40001b] Nathan Summers
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 12, **Hand Size**: 6
- **Traits**: *Mutant. Soldier.*
- **Rules Text**:
  > You may include player side schemes from any aspect in your deck.
  > Soldier X — **Setup**: Search your deck and discard pile for a player side scheme and put it into play. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/40001b.png` (300×418 px, 219.3 KB)

### [40002] Bodyslide
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (1/15)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Action**: Change form. Each other player may change to the form you are in.
- **Image Asset**: `assets/card-art/bundles/cards/40002.png` (710×1030 px, 356.4 KB)

### [40003] Mind Scan
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (2–4/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Psionic. Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. Remove 1 additional threat from that scheme for each side scheme in the victory display.
- **Image Asset**: `assets/card-art/bundles/cards/40003.png` (710×1030 px, 321.1 KB)

### [40004] Precognition
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (5/15)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Psionic. Superpower.*
- **Rules Text**:
  > **Hero Action**: Look at the top X cards of the encounter deck, where X is the number of side schemes in the victory display. You may discard 1 of those cards. Put the rest back in any order.
- **Image Asset**: `assets/card-art/bundles/cards/40004.png` (710×1030 px, 301.8 KB)

### [40005] Telekinetic Blast
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (6–7/15, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Psionic. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 6 damage to an enemy. Deal 1 additional damage to that enemy for each side scheme in the victory display.
- **Image Asset**: `assets/card-art/bundles/cards/40005.png` (710×1030 px, 317.3 KB)

### [40006] Technovirus Purge
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (8/15)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 5, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > Characters other than Cable cannot remove threat from Technovirus Purge.
  > While Technovirus Purge is in the victory display, Nathan Summers and Cable gain the [[PSIONIC]] trait and Cable gets +1 THW, +1 ATK, and +1 DEF.
- **Image Asset**: `assets/card-art/bundles/cards/40006.png` (1030×710 px, 299.4 KB)

### [40007] Graymalkin
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > **Response**: After a side scheme is defeated, ready Graymalkin.
  > **Resource**: Exhaust Graymalkin → generate a [energy] resource.
- **Flavor**: *Cable's orbital base is operated by the sentient A.I. known as Professor.*
- **Image Asset**: `assets/card-art/bundles/cards/40007.png` (710×1030 px, 373.5 KB)

### [40008] Professor
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Persona. Tech.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Professor → choose to either draw 1 card or search your deck and discard pile for a player side scheme and add it to your hand. *(Shuffle.)*
- **Flavor**: *"I'm sorry, Wade. I'm afraid I can't do that."*
- **Image Asset**: `assets/card-art/bundles/cards/40008.png` (710×1030 px, 397.9 KB)

### [40009] Askani'son
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (11/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Title.*
- **Rules Text**:
  > **Hero Response** *(thwart)*: After you defend against an enemy attack, exhaust Askani'son and spend a [energy] resource → remove threat from a scheme equal to your hero's THW.
- **Image Asset**: `assets/card-art/bundles/cards/40009.png` (710×1030 px, 398.3 KB)

### [40010] Forced Amnesia
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (12/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Psionic. Superpower.*
- **Rules Text**:
  > **Hero Response**: After a *(non-permanent)* side scheme is defeated, add Forced Amnesia and that side scheme to the victory display.
- **Image Asset**: `assets/card-art/bundles/cards/40010.png` (710×1030 px, 330.6 KB)

### [40011] Plasma Rifle
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (13/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Action** *(attack)*: Exhaust Plasma Rifle and spend a [energy] resource → deal 1 damage to an enemy for each side scheme in the victory display (to a maximum of 4). This attack gains ranged.
- **Image Asset**: `assets/card-art/bundles/cards/40011.png` (710×1030 px, 375.3 KB)

### [40012] Telekinetic Force Field
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (14/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Psionic. Superpower.*
- **Rules Text**:
  > Hero form only
  > **Hero Interrupt**: When a friendly character would take any amount of damage, discard Telekinetic Force Field → prevent all of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/40012.png` (710×1030 px, 315.2 KB)

### [40013] Temporal Leap
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (15/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Interrupt**: When the main scheme would be completed, remove this card from the game and put a side scheme from the victory display into play → move 4 threat from the main scheme to that side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40013.png` (710×1030 px, 336.0 KB)

### [40031] Technovirus Resurgence
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cable Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > ***Give to the Nathan Summers player.***
  > **When Revealed**: Search your deck, discard pile, hand, and victory display for Technovirus Purge and put it into play. *(Shuffle.)* Attach this card to Technovirus Purge. If you cannot, discard this card and deal yourself 1 facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/40031.png` (710×1030 px, 327.7 KB)


### Set: Leadership

### [40014] Caliban
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 14
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Psionic. X-Force.*
- **Rules Text**:
  > **Response**: After Caliban enters play, discard cards from the top of your deck until an [[X-FACTOR]], [[X-FORCE]], or [[X-MEN]] ally is discarded. Add that ally to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/40014.png` (710×1030 px, 309.0 KB)

### [40015] Fantomex — *Charlie Cluster-7*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 15
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Psionic. X-Force.*
- **Rules Text**:
  > **Response**: After Fantomex enters play, search your deck and discard pile for E.V.A. and put it into play. *(Shuffle.)*
- **Flavor**: *"E.V.A. is more than a vehicle. She's my partner. She's my mutation."*
- **Image Asset**: `assets/card-art/bundles/cards/40015.png` (710×1030 px, 299.8 KB)

### [40016] Sunspot — *Bobby Da Costa*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 16
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Aerial. X-Force.*
- **Rules Text**:
  > **Response**: After you play Sunspot from your hand, choose a player → deal 1 damage to the villain and each minion engaged with the chosen player for each [energy] resource used to pay for Sunspot.
- **Image Asset**: `assets/card-art/bundles/cards/40016.png` (710×1030 px, 301.3 KB)

### [40017] Mission Planning
- **Type**: `Event`
- **Faction / Aspect**: Leadership
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Rules Text**:
  > Play only if there is a side scheme in the victory display.
  > **Hero Action**: Until the end of the phase, allies you control do not take consequential damage.
- **Image Asset**: `assets/card-art/bundles/cards/40017.png` (710×1030 px, 303.8 KB)

### [40018] Call for Backup
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Leadership
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 3 per hero, **Resources**: [mental]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for an ally and put it into play. *(Shuffle.)*
- **Flavor**: *"Blue team, rendezvous at my location!" —Bishop*
- **Image Asset**: `assets/card-art/bundles/cards/40018.png` (1030×710 px, 337.9 KB)

### [40021] E.V.A.
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Traits**: *Vehicle.*
- **Rules Text**:
  > If Fantomex is not in play, discard E.V.A.
  > **Action**: Exhaust E.V.A. → choose:
  > • Remove 1 threat from a scheme.
  > • Deal 1 damage to an enemy.
  > • Heal 1 damage from Fantomex.
- **Image Asset**: `assets/card-art/bundles/cards/40021.png` (710×1030 px, 311.9 KB)

### [40022] Uncanny X-Force
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Team.*
- **Rules Text**:
  > Play under any player's control. Max 1 [[TEAM]] card per player.
  > If each of your characters has the [[X-FORCE]] trait, each ally you control gets +1 THW and takes -1 consequential damage ([cost]) after thwarting a side scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40022.png` (710×1030 px, 323.5 KB)

### [40023] Mission Leader
- **Type**: `Upgrade`
- **Faction / Aspect**: Leadership
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > Reduce the cost to play Mission Leader by 1 if your identity has the [[SOLDIER]] trait.
  > **Hero Response**: After a side scheme is defeated, exhaust Mission Leader → each player draws 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/40023.png` (710×1030 px, 304.1 KB)


### Set: Aggression

### [40019] Lock and Load
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Aggression
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 2 per hero, **Resources**: [physical]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for a [[WEAPON]] upgrade with a cost of 3 or less and put it into play. *(Shuffle.)*
- **Flavor**: *"We'll need guns. Lots of guns." —Cable*
- **Image Asset**: `assets/card-art/bundles/cards/40019.png` (1030×710 px, 301.3 KB)


### Set: Protection

### [40020] Establish Perimeter
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Protection
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 2 per hero, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Give each identity a tough status card.
- **Flavor**: *"Don't worry, kids. They won't get through me!" —Armor*
- **Image Asset**: `assets/card-art/bundles/cards/40020.png` (1030×710 px, 356.2 KB)


### Set: Basic

### [40024] Deadpool — *Wade Wilson*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 24
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Mercenary. X-Force.*
- **Rules Text**:
  > **Forced Interrupt**: When Deadpool would be defeated by consequential damage, heal 3 damage from him instead. Add an acceleration token to the main scheme.
- **Flavor**: *"...Cable? Not interested. I stream everything."*
- **Image Asset**: `assets/card-art/bundles/cards/40024.png` (710×1030 px, 362.5 KB)

### [40025] Deathlok — *Unit L17*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 25
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *Cyborg. X-Force.*
- **Rules Text**:
  > **Hero Response**: After Deathlok enters play, choose an upgrade in any player's discard pile with a cost of 1 or less that can be attached to Deathlok. Attach that upgrade to Deathlok.
- **Image Asset**: `assets/card-art/bundles/cards/40025.png` (710×1030 px, 370.5 KB)

### [40026] Frenemies
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Team-Up (Cable and Deadpool). Max 1 per deck.
  > **Hero Action** *(thwart)*: Deal 1 damage each to Cable and Deadpool. Remove 3 threat from a scheme and 3 threat from a different scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40026.png` (710×1030 px, 367.7 KB)

### [40027] Build Support
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 27
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 3 per hero, **Resources**: [mental]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for a support with a cost of 3 or less and put it into play. *(Shuffle.)*
- **Flavor**: *"I've got just the thing." —Forge*
- **Image Asset**: `assets/card-art/bundles/cards/40027.png` (1030×710 px, 340.0 KB)

### [40028] The Power of the Mind
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Resources**: [mental]
- **Rules Text**:
  > Double the number of resources this card generates while paying for a [[PSIONIC]] card.
- **Image Asset**: `assets/card-art/bundles/cards/40028.png` (710×1030 px, 317.8 KB)

### [40029] Psimitar
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 29
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Psionic. Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Response** *(attack)*: After you play another [[PSIONIC]] card, exhaust Psimitar → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/40029.png` (710×1030 px, 352.3 KB)

### [40030] Sidearm
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 30
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to an ally. Max 1 per ally.
  > Attached ally gets +1 ATK and its attacks gain ranged.
- **Flavor**: *"That gun is not nearly as dangerous as the man who wields it." —Cable*
- **Image Asset**: `assets/card-art/bundles/cards/40030.png` (710×1030 px, 286.8 KB)

### [40056] Atlas Bear — *Shoon'kwa*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 56
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Posse. Wakanda.*
- **Rules Text**:
  > **Action**: Exhaust Atlas Bear → look at the top card of a player deck. If that card is an event, you may deal 1 damage to Atlas Bear to add that card to its owner's hand.
- **Image Asset**: `assets/card-art/bundles/cards/40056.png` (710×1030 px, 294.5 KB)

### [40057] White Fox — *Ami Han*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 57
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Posse.*
- **Rules Text**:
  > **Response**: After White Fox is discarded from the top of your deck, put her into play under your control.
- **Flavor**: *"I am the last of my kind. I am the last kumiho!"*
- **Image Asset**: `assets/card-art/bundles/cards/40057.png` (710×1030 px, 294.9 KB)

### [40058] The Posse
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 58
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Posse.*
- **Rules Text**:
  > Max 1 per deck.
  > Play only if you control at least 3 characters with the [[POSSE]] trait.
  > **Hero Action**: Heal 1 damage from each [[POSSE]] character and ready them.
- **Image Asset**: `assets/card-art/bundles/cards/40058.png` (710×1030 px, 381.3 KB)

### [40059] Superpower Training
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 59
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Base Threat**: 3 per hero, **Resources**: [energy]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may search their deck and discard pile for an identity-specific upgrade and put it into play. *(Shuffle.)*
- **Flavor**: *"Class is in session." —Charles Xavier*
- **Image Asset**: `assets/card-art/bundles/cards/40059.png` (1030×710 px, 284.4 KB)

### [40060] Digging Deep
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 60
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > **Response**: After this card is discarded from the top of your deck, add it to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/40060.png` (710×1030 px, 379.3 KB)

### [40061] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 61
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [40062] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 62
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [40063] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 63
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.

### [40064] Sharpshooter
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 64
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Skill.*
- **Rules Text**:
  > Max 1 per player. **Hero Interrupt**: When you make a ranged attack, discard the top card of your deck → this attack deals 1 additional damage for each resource icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/40064.png` (710×1030 px, 307.1 KB)

### [40204] Hope Summers
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 204
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *X-Force.*
- **Rules Text**:
  > Hope Summers gains each [[TRAIT]] on your identity.
  > **Response**: After you play Hope Summers from your hand, search your deck for a [[SUPERPOWER]] card and add it to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/40204.png` (710×1030 px, 323.8 KB)


### Set: Cable Nemesis

### [40032] Stryfe
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cable Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front. Psionic.*
- **Rules Text**:
  > Villainous.
  > **Forced Interrupt**: When a player plays a [[PSIONIC]] event, cancel the effects of that event and deal 1 damage to Stryfe.
- **Flavor**: *"Regardless of who is the clone, Cable, it is my power that is superior!"*
- **Image Asset**: `assets/card-art/bundles/cards/40032.png` (710×1030 px, 372.7 KB)

### [40033] Back to the Future
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable Nemesis (2/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cable Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > The Cable player cannot remove threat from schemes other than Back to the Future. Other players cannot remove threat from Back to the Future.
  > The Cable player cannot damage enemies not engaged with them. Other players cannot damage minions engaged with the Cable player.
- **Image Asset**: `assets/card-art/bundles/cards/40033.png` (1030×710 px, 331.6 KB)

### [40034] Telekinetic Force Field
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Cable Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic.*
- **Rules Text**:
  > Attach to Stryfe. Otherwise, attach to the villain.
  > **Forced Interrupt**: When attached character would take any amount of damage, prevent that damage. If 2 or more damage was prevented this way, discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to the activating enemy.
- **Image Asset**: `assets/card-art/bundles/cards/40034.png` (710×1030 px, 331.8 KB)

### [40035] Mind Scan
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable Nemesis (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Cable Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic.*
- **Rules Text**:
  > **When Revealed**: Place 2 threat on the main scheme. Place 1 additional threat on the main scheme for each side scheme in the victory display.
  >
  > ---
  >
  > [star] **Boost**: You are confused.
- **Image Asset**: `assets/card-art/bundles/cards/40035.png` (710×1030 px, 391.8 KB)

### [40036] Telekinetic Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Cable Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Cable Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic.*
- **Rules Text**:
  > **When Revealed**: Take 2 damage. Take 1 additional damage for each side scheme in the victory display.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/40036.png` (710×1030 px, 402.1 KB)


### Set: Domino

### [40037a] Domino
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 3, **HP**: 9, **Hand Size**: 5
- **Traits**: *Posse. X-Force.*
- **Rules Text**:
  > When counting resources on cards discarded from the top of the deck, count each printed [wild] icon twice.
  > **Action**: Choose a card in your hand. Swap that card with the top card of your deck. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/40037a.png` (300×418 px, 234.5 KB)

### [40037b] Neena Thurman
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > **Action**: Choose a card in your hand. Swap that card with the top card of your discard pile. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/40037b.png` (300×418 px, 212.3 KB)

### [40038] Diamondback — *Rachel Leighton*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Posse.*
- **Rules Text**:
  > **Action**: Exhaust Diamondback, deal 1 damage to her, and discard the top card of your deck → deal 1 damage to each enemy for each resource icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/40038.png` (710×1030 px, 311.5 KB)

### [40039] Outlaw — *Inez Temple*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Outlaw. Posse.*
- **Rules Text**:
  > Toughness.
  > [star] **Interrupt**: When Outlaw attacks, discard the top card of your deck → Outlaw gets +1 ATK for this attack for each resource icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/40039.png` (710×1030 px, 365.3 KB)

### [40040] A Good Workout
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (3–4/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy and discard the top card of your deck. For each resource icon discarded this way, deal 1 additional damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/40040.png` (710×1030 px, 312.6 KB)

### [40041] Luck Be a Lady
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (5/15)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Discard the top card of your deck and count the resources on it. For each resource counted this way, if it is a:
  > [energy] - Heal 2 damage from a character.
  > [mental] - Remove 2 threat from a scheme.
  > [physical] - Deal 3 damage to an enemy.
  > [wild] - Choose 1 of the above.
- **Image Asset**: `assets/card-art/bundles/cards/40041.png` (710×1030 px, 310.1 KB)

### [40042] Right Place, Right Time
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (6–7/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme and discard the top card of your deck. For each resource icon discarded this way, remove 1 additional threat from that scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40042.png` (710×1030 px, 305.0 KB)

### [40043] Jackpot!
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (8/15)
- **Stats**: **Resources**: [energy] [physical] [mental]
- **Rules Text**:
  > **Response**: After this card is discarded from the top of your deck, shuffle it back into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/40043.png` (710×1030 px, 380.4 KB)

### [40044] Pip the Pug
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (9/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Creature.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Pip the Pug → put 1 Domino or [[POSSE]] card from your discard pile on top of your deck.
- **Flavor**: *"Did you just piddle on me, you nasty little sausage!" —Domino*
- **Image Asset**: `assets/card-art/bundles/cards/40044.png` (710×1030 px, 293.1 KB)

### [40045] The Painted Lady
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (10/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Vehicle.*
- **Rules Text**:
  > **Response**: After you discard a card from the top of the deck, attach that card facedown here (to a maximum of 3).
  > **Alter-Ego Action**: Exhaust The Painted Lady → add 1 card attached here to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/40045.png` (710×1030 px, 323.0 KB)

### [40046] Domino's Pistol
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (11–12/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Weapon.*
- **Rules Text**:
  > Restricted.
  > **Hero Action** *(attack)*: Exhaust Domino's Pistol, choose an enemy, and discard the top card of your deck → deal 1 damage to that enemy for each resource icon discarded this way. This attack gains ranged.
- **Image Asset**: `assets/card-art/bundles/cards/40046.png` (710×1030 px, 363.9 KB)

### [40047] Lucky and Good
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (13/15)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When a boost card is turned faceup during an attack against you, exhaust Lucky and Good → cancel that card's boost icons and "**Boost**" ability. Give the attacking enemy another boost card for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40047.png` (710×1030 px, 332.7 KB)

### [40048] Lucky Break
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (14/15)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When you reveal an encounter card, discard Lucky Break → cancel the effects of that card and discard it. Reveal another card from the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/40048.png` (710×1030 px, 300.1 KB)

### [40049] Probability Field
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (15/15)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Interrupt**: When you use a basic power, discard the top card of your deck → you get +1 to that power for this use for each resource icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/40049.png` (710×1030 px, 318.0 KB)

### [40065] Memories of Armageddon
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Domino Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Neena Thurman player.***
  > Treat your identity's printed text box as if it were blank *(except for [[TRAITS]])*.
  > **Alter-Ego Action**: Exhaust your identity → discard Memories of Armageddon.
- **Flavor**: *As a child, Neena was used as a lab rat in the super-soldier program known as Project Armageddon.*
- **Image Asset**: `assets/card-art/bundles/cards/40065.png` (710×1030 px, 296.0 KB)


### Set: Justice

### [40050] Feral — *Maria Callasantos*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 50
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *X-Force.*
- **Rules Text**:
  > [star] **Response**: After Feral thwarts, discard the top card of your deck. For each resource icon discarded this way, deal 1 damage to the villain.
- **Flavor**: *"I have caught the prey's scent."*
- **Image Asset**: `assets/card-art/bundles/cards/40050.png` (710×1030 px, 308.3 KB)

### [40051] Wolfsbane — *Rahne Sinclair*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 51
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 [star] (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *X-Force.*
- **Rules Text**:
  > [star] **Response**: After Wolfsbane thwarts, name a card type, then discard the top card of your deck. If that card is of the named type, you may add it to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/40051.png` (710×1030 px, 314.7 KB)

### [40052] Even the Odds
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > Requirement ([energy]).
  > **Hero Action** *(thwart)*: Remove 1 [per_hero] threat from each side scheme. Deal 1 damage to the villain for each side scheme defeated this way.
- **Image Asset**: `assets/card-art/bundles/cards/40052.png` (710×1030 px, 308.6 KB)

### [40053] Team Investigation
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 53
- **Stats**: **Cost**: 2 per hero, **Resources**: [mental]
- **Rules Text**:
  > Alliance. *(The players can pay this card's costs as a group.)*
  > **Hero Action**: Remove 3 [per_hero] threat from a side scheme.
- **Flavor**: *"If I may coin a phrase, many minds make light work." —Beast*
- **Image Asset**: `assets/card-art/bundles/cards/40053.png` (710×1030 px, 289.8 KB)

### [40054] Take Out the Guards
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Justice
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 54
- **Properties**: Unique
- **Stats**: **Cost**: 0, **Base Threat**: 4 per hero, **Resources**: [mental]
- **Rules Text**:
  > Victory 0.
  > **When Defeated**: Each player may discard 1 non-[[ELITE]] minion from play.
- **Flavor**: *"Nighty night, bub." —Wolverine*
- **Image Asset**: `assets/card-art/bundles/cards/40054.png` (1030×710 px, 269.2 KB)

### [40055] Overwatch
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Pack Position: 55
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Rules Text**:
  > Attach to a scheme. Max 1 per scheme.
  > **Hero Interrupt**: When any amount of threat is removed from attached scheme by a thwart, discard this card → remove an equal amount of threat from a different scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40055.png` (710×1030 px, 304.6 KB)


### Set: Domino Nemesis

### [40066] Topaz
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Domino Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant.*
- **Rules Text**:
  > **When Revealed**: Search the encounter deck, discard pile, and set aside area for 1 copy of Superpower Feedback and attach it to your identity. *(Shuffle.)*
  > *(Domino's nemesis minion.)*
- **Flavor**: *Topaz is able to affect other mutants' abilities, either amplifying them or nullifying them.*
- **Image Asset**: `assets/card-art/bundles/cards/40066.png` (710×1030 px, 369.2 KB)

### [40067] Not My Lucky Day
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino Nemesis (2/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Domino Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Each player must either take 1 damage or place 2 threat here.
- **Flavor**: *Domino is having a terrible, horrible, no good, very bad day.*
- **Image Asset**: `assets/card-art/bundles/cards/40067.png` (1030×710 px, 350.3 KB)

### [40068] Prototype
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino Nemesis (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Domino Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant.*
- **Rules Text**:
  > [star] Prototype gets +1 hit points for each luck counter on him.
  > **When Revealed**: Place luck counters on Prototype equal to the amount of damage your identity has sustained.
- **Flavor**: *Domino's good luck is Prototype's misfortune, and her suffering strengthens him.*
- **Image Asset**: `assets/card-art/bundles/cards/40068.png` (710×1030 px, 301.4 KB)

### [40069] Superpower Feedback
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Domino Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Domino Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your identity.
  > **Forced Response**: After you resolve an ability on your identity or an identity-specific card, take 1 damage.
  > **Alter-Ego Action**: Discard 1 identity-specific card from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40069.png` (710×1030 px, 315.0 KB)


### Set: Marauders

### [40070a] Arclight
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (1/7)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 10 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Arclight attacks you or an ally you control, choose:
  > • Confuse a character you control.
  > • Arclight gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40070a.png` (289×419 px, 239.6 KB)

### [40070b] Arclight
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (1/7)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Arclight attacks you or an ally you control, choose:
  > • Confuse the character you control with the highest THW.
  > • Arclight gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40070b.png` (289×419 px, 242.4 KB)

### [40071a] Blockbuster
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (2/7)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 0, **ATK**: 2 [star], **HP**: 11 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Blockbuster attacks you or an ally you control, choose:
  > • Give Blockbuster a tough status card.
  > • Blockbuster gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40071a.png` (289×419 px, 242.0 KB)

### [40071b] Blockbuster
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (2/7)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Blockbuster attacks you or an ally you control, choose:
  > • Give Blockbuster a tough status card.
  > • Blockbuster gets +2 ATK for this attack and this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/40071b.png` (289×419 px, 243.3 KB)

### [40072a] Chimera
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (3/7)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 11 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Psionic.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Chimera attacks you or an ally you control, choose:
  > • Spend a [mental] resource.
  > • Chimera gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40072a.png` (289×419 px, 249.5 KB)

### [40072b] Chimera
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (3/7)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Psionic.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Chimera attacks you or an ally you control, choose:
  > • Spend [mental][mental] resources.
  > • Chimera gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40072b.png` (289×419 px, 249.4 KB)

### [40073a] Greycrow
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (4/7)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Mercenary.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Greycrow attacks you or an ally you control, choose:
  > • Discard the highest-cost card you control.
  > • Greycrow gets +X ATK for this attack, where X is the printed cost of the highest-cost card you control.
- **Image Asset**: `assets/card-art/bundles/cards/40073a.png` (289×419 px, 247.8 KB)

### [40073b] Greycrow
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (4/7)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Mercenary.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Greycrow attacks you or an ally you control, choose:
  > • Discard each card you control with the highest cost.
  > • Greycrow gets +X ATK for this attack, where X is the printed cost of the highest-cost card you control.
- **Image Asset**: `assets/card-art/bundles/cards/40073b.png` (289×419 px, 245.6 KB)

### [40074a] Harpoon
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (5/7)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 0, **ATK**: 2 [star], **HP**: 10 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Harpoon attacks you or an ally you control, choose:
  > • Take 2 indirect damage.
  > • Give Harpoon 1 additional facedown boost card for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40074a.png` (289×419 px, 232.3 KB)

### [40074b] Harpoon
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (5/7)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Harpoon attacks you or an ally you control, choose:
  > • Take 3 indirect damage.
  > • Give Harpoon 1 additional facedown boost card for this attack. This attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/40074b.png` (289×419 px, 238.3 KB)

### [40075a] Riptide
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (6/7)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Marauder.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Riptide attacks you or an ally you control, choose:
  > • Place 2 threat on the main scheme and 1 threat on each side scheme.
  > • Riptide gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40075a.png` (289×419 px, 244.4 KB)

### [40075b] Riptide
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (6/7)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Marauder.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Riptide attacks you or an ally you control, choose:
  > • Place 3 threat on the main scheme and 1 threat on each side scheme.
  > • Riptide gets +2 ATK for this attack and this attack gains ranged and piercing.
- **Image Asset**: `assets/card-art/bundles/cards/40075b.png` (289×419 px, 247.1 KB)

### [40076a] Vertigo
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (7/7)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 0 [star], **HP**: 9 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Mutate.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Vertigo attacks you or an ally you control, choose:
  > • Stun a character you control.
  > • Vertigo gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40076a.png` (289×419 px, 244.7 KB)

### [40076b] Vertigo
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Marauders (7/7)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 3, **ATK**: 1 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Marauders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Mutate.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Vertigo attacks you or an ally you control, choose:
  > • Stun the character you control with the highest ATK.
  > • Vertigo gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40076b.png` (289×419 px, 245.9 KB)


### Set: Morlock Siege

### [40077] Knock, Knock
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (1/19)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, place 1 knock counter here. If there are at least 3 knock counters here, advance to stage 2A.
  > **If there are 3 villains under Routed, the players win the game.**
- **Reverse Side**
  > **Contents**: Marauders on side A *(side B for expert mode)*. Morlock Siege and Standard encounter sets. Two modular encounter sets *(Military Grade and Mutant Slayers)*.
  > **Setup**: Put the Routed environment into play. Set the Hide! treachery and each Morlock ally aside. Shuffle the villains together *(without looking)* to create the villain deck. The top card of this deck is in play.
- **Image Asset**: `assets/card-art/bundles/cards/40077.jpg` (1030×710 px, 290.5 KB)

### [40077a] Knock, Knock
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (1/19)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Marauders on side A *(side B for expert mode)*. Morlock Siege and Standard encounter sets. Two modular encounter sets *(Military Grade and Mutant Slayers)*.
  > **Setup**: Put the Routed environment into play. Set the Hide! treachery and each Morlock ally aside. Shuffle the villains together *(without looking)* to create the villain deck. The top card of this deck is in play.
- **Image Asset**: `assets/card-art/bundles/cards/40077a.png` (1030×710 px, 290.5 KB)

### [40077b] Knock, Knock
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (1/19)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, place 1 knock counter here. If there are at least 3 knock counters here, advance to stage 2A.
  > **If there are 3 villains under Routed, the players win the game.**
- **Image Asset**: `assets/card-art/bundles/cards/40077b.png` (1030×710 px, 359.6 KB)

### [40078] Mutant Massacre
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (2/19)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Action**: Exhaust a [[MORLOCK]] ally → shuffle Hide! from the encounter discard pile into the encounter deck.
  > **If there are 3 villains under Routed, the players win the game.
  > If this stage is completed or there are no Morlock allies in play, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Each player puts 1 set-aside Morlock ally into play under their control (2 set-aside Morlock allies instead if this is a single-player game). Shuffle the Hide! treachery into the encounter deck. If the previous stage was advanced by knock counters, give each Morlock ally a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/40078.jpg` (1030×710 px, 288.4 KB)

### [40078a] Mutant Massacre
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (2/19)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player puts 1 set-aside Morlock ally into play under their control (2 set-aside Morlock allies instead if this is a single-player game). Shuffle the Hide! treachery into the encounter deck. If the previous stage was advanced by knock counters, give each Morlock ally a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/40078a.png` (1030×710 px, 288.4 KB)

### [40078b] Mutant Massacre
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (2/19)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Action**: Exhaust a [[MORLOCK]] ally → shuffle Hide! from the encounter discard pile into the encounter deck.
  > **If there are 3 villains under Routed, the players win the game.
  > If this stage is completed or there are no Morlock allies in play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/40078b.png` (1030×710 px, 312.0 KB)

### [40079] Morlock
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (3–6/19, Qty: 4)
- **Stats**: **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 5, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Traits**: *Morlock. Mutant.*
- **Rules Text**:
  > Victory -1.
  > Does not count against your ally limit. Card abilities cannot remove this ally from play.
  > **Forced Interrupt**: When an enemy attacks you, it attacks a Morlock you control instead.
- **Image Asset**: `assets/card-art/bundles/cards/40079.png` (710×1030 px, 306.4 KB)

### [40080] Hide!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (7/19)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Give 1 [[MORLOCK]] ally a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Give 1 [[MORLOCK]] ally a tough status card. Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/40080.png` (710×1030 px, 301.1 KB)

### [40081a] Routed
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (8/19)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Standard Mode Only.**
  > Cards under here are not in play.
  > **Forced Response**: After the villain is defeated, put it under here. Discard each minion that shares a title with the top villain of the villain deck. *(That villain is in play.)* The villain activates against each player in player order.
- **Image Asset**: `assets/card-art/bundles/cards/40081a.png` (289×419 px, 234.4 KB)

### [40081b] Routed
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (8/19)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Expert Mode Only.**
  > Cards under here are not in play. The villain gains retaliate 1 for each card under here.
  > **Forced Response**: After the villain is defeated, put it under here. Discard each minion that shares a title with the top villain of the villain deck. *(That villain is in play.)* The villain activates against each player in player order.
- **Image Asset**: `assets/card-art/bundles/cards/40081b.png` (289×419 px, 232.7 KB)

### [40082] Bolstered by Wrath
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (9/19)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the villain.
  > **Hero Action**: Exhaust a character you control and spend X resources of any type, where X is the number of villains under Routed → discard this card.
  >
  > ---
  >
  > [star] **Boost**: This card gets +X boost icons ([boost]), where X is the number of villains under Routed.
- **Image Asset**: `assets/card-art/bundles/cards/40082.png` (710×1030 px, 329.3 KB)

### [40083] Pushed to the Limit
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (10/19)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the villain.
  > While there is exactly 1 villain under Routed, attached villain gains steady.
  > While there are exactly 2 villains under Routed, attached villain gains stalwart.
  > **Hero Action**: Attached villain attacks you → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40083.png` (710×1030 px, 287.9 KB)

### [40084] By Any Means
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (11/19)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Place 1 [per_hero] additional threat here for each villain under Routed.
- **Image Asset**: `assets/card-art/bundles/cards/40084.png` (1030×710 px, 321.7 KB)

### [40085] In the Midst of Chaos
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (12/19)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place 1 [per_hero] additional threat here for each villain under Routed.
- **Image Asset**: `assets/card-art/bundles/cards/40085.png` (1030×710 px, 297.8 KB)

### [40086] Maraudin' Ain't Easy
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (13/19)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Place 1 [per_hero] additional threat here for each villain under Routed.
- **Image Asset**: `assets/card-art/bundles/cards/40086.png` (1030×710 px, 302.4 KB)

### [40087] Territorial Control
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (14/19)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Assault. *(Basic thwarts against this scheme use ATK instead of THW.)*
  > **When Revealed**: Place 1 [per_hero] additional threat here for each villain under Routed.
- **Image Asset**: `assets/card-art/bundles/cards/40087.png` (1030×710 px, 300.0 KB)

### [40088] Back in Action
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (15–16/19, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give the villain a tough status card. Place threat on the main scheme equal to the number of villains under Routed.
  >
  > ---
  >
  > [star] **Boost**: If you control a Morlock ally, choose to either deal 1 damage to it or spend 1 resource of any type.
- **Image Asset**: `assets/card-art/bundles/cards/40088.png` (710×1030 px, 315.2 KB)

### [40089] Seek the Weak
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Morlock Siege (17–19/19, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Morlock Siege Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: The villain attacks you. If there is at least 1 villain under Routed, this attack gains overkill.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/40089.png` (710×1030 px, 303.3 KB)


### Set: Military Grade

### [40090] Heavy Armament
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Military Grade (1/5)
- **Stats**: **ATK**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Military Grade Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to the enemy with the highest ATK.
  > Attached enemy gains retaliate 2.
  > **Hero Response**: After you attack the attached enemy, spend 2 resources of the same type → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40090.png` (710×1030 px, 304.5 KB)

### [40091] Titanium Exoskeleton
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Military Grade (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Military Grade Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to the enemy with the fewest remaining hit points.
  > Attached enemy cannot take more than 2 damage from a single attack.
  > **Hero Action**: Choose to either spend 3 resources of any type or remove a confused or stunned status card from attached enemy → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40091.png` (710×1030 px, 325.7 KB)

### [40092] Inhibitor Collar
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Military Grade (3–4/5, Qty: 2)
- **Stats**: **ATK**: -1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Military Grade Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to your identity.
  > Treat your identity's printed text box as if it were blank *(except for traits)*.
  > **Action**: Choose to either exhaust a character you control or take 3 damage → discard this card. Any player can do this.
- **Errata (FFG)**:
  > Changed reminder text to rules text. (RRG 1.6)
- **Image Asset**: `assets/card-art/bundles/cards/40092.png` (710×1030 px, 311.1 KB)

### [40093] The Senator's Support
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Military Grade (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Military Grade Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: The first player discard cards from the top of the encounter deck until an attachment is discarded and reveals that card.
- **Flavor**: *This kind of hardware isn't found on the black market. Someone high up in the U. S. government must be supplying it.*
- **Image Asset**: `assets/card-art/bundles/cards/40093.png` (1030×710 px, 288.0 KB)


### Set: Mutant Slayers

### [40094] Arclight
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Slayers (1/10)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Slayers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > Retaliate 1.
  > [star] **Forced Interrupt**: When Arclight attacks you or an ally you control, choose:
  > • Confuse a character you control.
  > • Arclight gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40094.png` (710×1030 px, 289.9 KB)

### [40095] Blockbuster
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Slayers (2/10)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Slayers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > Guard.
  > [star] **Forced Interrupt**: When Blockbuster attacks you or an ally you control, choose:
  > • Give Blockbuster a tough status card.
  > • Blockbuster gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40095.png` (710×1030 px, 332.0 KB)

### [40096] Chimera
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Slayers (3/10)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Slayers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Psionic.*
- **Rules Text**:
  > Patrol.
  > [star] **Forced Interrupt**: When Chimera attacks you or an ally you control, choose:
  > • Spend a [mental] resource.
  > • Chimera gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40096.png` (710×1030 px, 340.3 KB)

### [40097] Greycrow
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Slayers (4/10)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Slayers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Mercenary.*
- **Rules Text**:
  > Retaliate 1.
  > [star] **Forced Interrupt**: When Greycrow attacks you or an ally you control, choose:
  > • Discard the highest-cost card you control.
  > • Greycrow gets +X ATK for this attack, where X is the printed cost of the highest-cost card you control.
- **Image Asset**: `assets/card-art/bundles/cards/40097.png` (710×1030 px, 336.6 KB)

### [40098] Harpoon
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Slayers (5/10)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Slayers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Marauder.*
- **Rules Text**:
  > Guard.
  > [star] **Forced Interrupt**: When Harpoon attacks you or an ally you control, choose:
  > • Take 2 indirect damage.
  > • Harpoon gets +2 ATK for this attack and this attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/40098.png` (710×1030 px, 301.5 KB)

### [40099] Riptide
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Slayers (6/10)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Slayers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Assassin. Marauder.*
- **Rules Text**:
  > Patrol.
  > [star] **Forced Interrupt**: When Riptide attacks you or an ally you control, choose:
  > • Place 2 threat on the main scheme and 1 threat on each side scheme.
  > • Riptide gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40099.png` (710×1030 px, 314.8 KB)

### [40100] Vertigo
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Slayers (7/10)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 0 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Slayers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder. Mutate.*
- **Rules Text**:
  > Guard.
  > [star] **Forced Interrupt**: When Vertigo attacks you or an ally you control, choose:
  > • Stun a character you control.
  > • Vertigo gets +2 ATK for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40100.png` (710×1030 px, 310.2 KB)

### [40101] Mutant Slayers
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Slayers (8/10)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Slayers Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[MARAUDER]] minion gains quickstrike.
  > **When Revealed**: Place 1 additional threat here for each character in play with 1 or more of the following traits: [[MUTANT]], [[X-FACTOR]], [[X-FORCE]], or [[X-MEN]].
- **Image Asset**: `assets/card-art/bundles/cards/40101.png` (1030×710 px, 300.7 KB)

### [40102] Bound by Business
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Slayers (9–10/10, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Slayers Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the encounter deck until a [[MARAUDER]] minion that does not share a title with a card in play is discarded. Put that minion into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/40102.png` (710×1030 px, 312.1 KB)


### Set: On the Run

### [40103] Gotta Get Away
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (1/11)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[MARAUDER]] minion gains steady.
  > **When Revealed**: Each player searches the encounter deck for a [[MARAUDER]] minion and puts it into play engaged with them. *(Shuffle.)*
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**
  > **Contents**: Marauders on side A *(side B for expert mode)*. On the Run, Mutant Slayers, and Standard encounter sets. Two modular encounter sets *(Military Grade and Nasty Boys)*.
  > **Setup**: Put 1 random [[MARAUDER]] villain into play. Remove the minion with the same title as the villain, along with each other villain, from the game. Attach the Hope's Captor attachment to the villain, [[CONFIDENT]] side up.
- **Image Asset**: `assets/card-art/bundles/cards/40103.png` (1030×710 px, 301.7 KB)

### [40103a] Gotta Get Away
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (1/11)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Marauders on side A *(side B for expert mode)*. On the Run, Mutant Slayers, and Standard encounter sets. Two modular encounter sets *(Military Grade and Nasty Boys)*.
  > **Setup**: Put 1 random [[MARAUDER]] villain into play. Remove the minion with the same title as the villain, along with each other villain, from the game. Attach the Hope's Captor attachment to the villain, [[CONFIDENT]] side up.
- **Image Asset**: `assets/card-art/bundles/cards/40103a.png` (1030×710 px, 301.7 KB)

### [40103b] Gotta Get Away
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (1/11)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[MARAUDER]] minion gains steady.
  > **When Revealed**: Each player searches the encounter deck for a [[MARAUDER]] minion and puts it into play engaged with them. *(Shuffle.)*
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/40103b.png` (1030×710 px, 306.8 KB)

### [40104] Escaping with Hope
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (2/11)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[MARAUDER]] minion gains guard and steady. In expert mode, the villain gains steady.
  > **If the villain is defeated, the players win the game.**
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Each player searches the encounter deck and discard pile for a [[MARAUDER]] minion and puts that minion into play engaged with them. *(Shuffle.)* Give each [[MARAUDER]] enemy a tough status card.
  - **Back Flavor**: *Having taken a pounding, the Marauders redouble their efforts to escape with their captive.*
- **Image Asset**: `assets/card-art/bundles/cards/40104.jpg` (1030×710 px, 343.5 KB)

### [40104a] Escaping with Hope
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (2/11)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player searches the encounter deck and discard pile for a [[MARAUDER]] minion and puts that minion into play engaged with them. *(Shuffle.)* Give each [[MARAUDER]] enemy a tough status card.
- **Flavor**: *Having taken a pounding, the Marauders redouble their efforts to escape with their captive.*
- **Image Asset**: `assets/card-art/bundles/cards/40104a.png` (1030×710 px, 343.5 KB)

### [40104b] Escaping with Hope
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (2/11)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[MARAUDER]] minion gains guard and steady. In expert mode, the villain gains steady.
  > **If the villain is defeated, the players win the game.**
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/40104b.png` (1030×710 px, 265.4 KB)

### [40105a] Hope's Captor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (3/11)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Traits**: *Confident.*
- **Rules Text**:
  > Permanent.
  > [star] **Forced Interrupt**: When the villain would attack you, if a [[MARAUDER]] minion is engaged with you, the villain schemes instead.
  > **Forced Interrupt**: When the villain would be defeated, reset attached villain's hit points to its printed hit point value instead. Flip this card and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/40105a.png` (289×419 px, 235.2 KB)

### [40105b] Hope's Captor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (3/11)
- **Properties**: Permanent
- **Stats**: **SCH**: 1, **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Traits**: *Desperate.*
- **Rules Text**:
  > Permanent.
  > The villain gets +6 [per_hero] hit points.
  > **When Revealed**: Advance the main scheme to stage 2A. This effect cannot be canceled.
  > [star] **Forced Interrupt**: When the villain would attack you, if a [[MARAUDER]] minion is engaged with you, the villain schemes instead.
- **Image Asset**: `assets/card-art/bundles/cards/40105b.png` (289×419 px, 235.0 KB)

### [40106] Hidden in the Clutter
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (4–5/11, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the enemy with the fewest remaining hit points.
  > **Forced Interrupt**: When any amount of damage would be dealt to attached enemy, place it here instead. If there is at least 3 damage here, attached enemy attacks the player who dealt the damage just placed here. Then, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40106.png` (710×1030 px, 326.9 KB)

### [40107] Favored Weapon
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (6/11)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Greycrow or Harpoon. Otherwise, attach to the [[MARAUDER]] enemy with the lowest ATK.
  > [star] Attached enemy's attacks gain overkill, piercing, and ranged.
  > **Hero Response**: After your hero defends against an attack from attached enemy and takes no damage → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40107.png` (710×1030 px, 315.0 KB)

### [40108] Bushwhack
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (7/11)
- **Stats**: **Base Threat**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme searches the encounter deck and discard pile for a [[MARAUDER]] minion and puts that minion into play engaged with them. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/40108.png` (1030×710 px, 297.7 KB)

### [40109] Pure Force
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (8/11)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > While Blockbuster is in play, this scheme gains the crisis icon ([crisis]).
  > While Chimera is in play, this scheme gains the amplify icon ([amplify]).
- **Image Asset**: `assets/card-art/bundles/cards/40109.png` (1030×710 px, 274.4 KB)

### [40110] Dizzying Deeds
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (9/11)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Exhaust a character you control. If the following enemies are in play:
  > • Arclight — Stun a character you control.
  > • Riptide — Take 3 indirect damage.
  > • Vertigo — Confuse a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/40110.png` (710×1030 px, 309.6 KB)

### [40111] Tag Team
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: On the Run (10–11/11, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: On the Run Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Each [[MARAUDER]] minion engaged with you activates against you.
  > • Discard 7 cards from the top of the encounter deck. Put the topmost [[MARAUDER]] minion in the encounter discard pile into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/40111.png` (710×1030 px, 313.4 KB)


### Set: Nasty Boys

### [40112] Gorgeous George
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Nasty Boys (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Nasty Boys Set Icon (printed bottom-right next to deck number)
- **Traits**: *Nasty Boy.*
- **Rules Text**:
  > Teamwork ([[NASTY BOY]]).
  > [star] **Forced Interrupt**: When Gorgeous George attacks you, exhaust a character you control.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/40112.png` (710×1030 px, 292.5 KB)

### [40113] Hairbag
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Nasty Boys (2/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Nasty Boys Set Icon (printed bottom-right next to deck number)
- **Traits**: *Nasty Boy.*
- **Rules Text**:
  > Surge. Teamwork ([[NASTY BOY]]).
  >
  > ---
  >
  > [star] **Boost**: After this activation, shuffle Hairbag into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/40113.png` (710×1030 px, 277.7 KB)

### [40114] Ramrod
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Nasty Boys (3/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Nasty Boys Set Icon (printed bottom-right next to deck number)
- **Traits**: *Nasty Boy.*
- **Rules Text**:
  > Retaliate 1. Teamwork ([[NASTY BOY]]).
  > [star] Ramrod's attacks gain piercing.
  >
  > ---
  >
  > [star] **Boost**: If the villain is attacking, this attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/40114.png` (710×1030 px, 288.5 KB)

### [40115] Ruckus
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Nasty Boys (4/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Nasty Boys Set Icon (printed bottom-right next to deck number)
- **Traits**: *Nasty Boy.*
- **Rules Text**:
  > Teamwork ([[NASTY BOY]]).
  > **When Revealed**: Stun each character you control.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/40115.png` (710×1030 px, 292.8 KB)

### [40116] Slab
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Nasty Boys (5/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nasty Boys Set Icon (printed bottom-right next to deck number)
- **Traits**: *Nasty Boy.*
- **Rules Text**:
  > Teamwork ([[NASTY BOY]]). Toughness.
  > [star] **Forced Interrupt**: When Slab attacks, place 1 growth counter on him. Slab gets +1 ATK for each growth counter on him for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/40116.png` (710×1030 px, 289.9 KB)

### [40117] Get Nasty
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Nasty Boys (6/6)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nasty Boys Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each minion gets +1 ATK.
  > **When Revealed**: Place 1 threat here for each minion in play (2 threat instead for each [[NASTY BOY]]). Search the encounter deck and discard pile for a [[NASTY BOY]] minion and reveal it. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/40117.png` (1030×710 px, 301.6 KB)


### Set: Juggernaut

### [40118] Juggernaut
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (1/18)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > [star] Juggernaut gets +1 ATK for each momentum counter here.
  > **When Revealed**: Place 1 momentum counter here. Give Juggernaut a tough status card.
- **Flavor**: *"Ain't nothin'—ain't nobody—can beat me!"*
- **Image Asset**: `assets/card-art/bundles/cards/40118.png` (710×1030 px, 350.7 KB)

### [40119] Juggernaut
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (2/18)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 21 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > [star] Juggernaut gets +1 ATK for each momentum counter here.
  > **When Revealed**: Place 1 momentum counter here. If Juggernaut Exposed is in play, flip it. Otherwise, give Juggernaut a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/40119.png` (710×1030 px, 358.9 KB)

### [40120] Juggernaut
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (3/18)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 4 [star], **HP**: 25 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute.*
- **Rules Text**:
  > [star] Juggernaut gets +1 ATK for each momentum counter here.
  > **When Revealed**: Search the encounter deck and discard pile for Head of Steam and reveal it. *(Shuffle.)* If Juggernaut Exposed is in play, flip it. Otherwise, give Juggernaut a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/40120.png` (710×1030 px, 368.1 KB)

### [40121] The Unstoppable Juggernaut
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (4/18)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 [star] per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Interrupt**: When this scheme would be completed, instead do each of the following:
  > 1. Remove all threat from here.
  > 2. If Juggernaut Exposed is in play, flip it.
  > 3. Place 1 momentum counter on Juggernaut.
  > 4. Juggernaut attacks each player in player order *(even if they are in alter-ego form)*.
- **Reverse Side**
  > **Contents**: Juggernaut (I) and Juggernaut (II) *(Juggernaut (II) and Juggernaut (III) instead for expert mode)*. Juggernaut, Hope Summers, and Standard encounter sets. One modular encounter set *(Black Tom Cassidy)*.
  > **Setup**: Attach Juggernaut's Helmet to Juggernaut. Put Home Summers into play under the first player's control.
- **Image Asset**: `assets/card-art/bundles/cards/40121.png` (1030×710 px, 379.9 KB)

### [40121a] The Unstoppable Juggernaut
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (4/18)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Juggernaut (I) and Juggernaut (II) *(Juggernaut (II) and Juggernaut (III) instead for expert mode)*. Juggernaut, Hope Summers, and Standard encounter sets. One modular encounter set *(Black Tom Cassidy)*.
  > **Setup**: Attach Juggernaut's Helmet to Juggernaut. Put Home Summers into play under the first player's control.
- **Image Asset**: `assets/card-art/bundles/cards/40121a.png` (1030×710 px, 379.9 KB)

### [40121b] The Unstoppable Juggernaut
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (4/18)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 [star] per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Interrupt**: When this scheme would be completed, instead do each of the following:
  > 1. Remove all threat from here.
  > 2. If Juggernaut Exposed is in play, flip it.
  > 3. Place 1 momentum counter on Juggernaut.
  > 4. Juggernaut attacks each player in player order *(even if they are in alter-ego form)*.
- **Image Asset**: `assets/card-art/bundles/cards/40121b.png` (1030×710 px, 364.4 KB)

### [40122a] Juggernaut's Helmet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (5/18)
- **Properties**: Unique, Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Permanent. Attach to Juggernaut.
  > Juggernaut gains stalwart and his attacks gain overkill.
  > **Hero Action**: Spend 3 resources of the same type → remove each momentum counter from Juggernaut. Flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/40122a.png` (289×419 px, 240.8 KB)

### [40122b] Juggernaut Exposed
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (5/18)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent. Attach to Juggernaut.
  > Juggernaut takes 1 additional damage from each card with a printed [mental] resource.
  > [star] **Forced Response**: After Juggernaut schemes, place 1 momentum counter on Juggernaut. Flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/40122b.png` (289×419 px, 248.0 KB)

### [40123] Head of Steam
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (6/18)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Juggernaut gains retaliate X, where X is the number of momentum counters on Juggernaut.
  > **When Revealed**: Attach Head of Steam to Juggernaut and place 1 momentum counter on him.
  > **Hero Response**: After Juggernaut attacks you, spend 1 resource for each damage dealt by that attack → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40123.png` (710×1030 px, 325.8 KB)

### [40124] Building Momentum
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (7/18)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Hero Response**: After you defend against an attack from Juggernaut, remove 1 threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40124.png` (1030×710 px, 287.3 KB)

### [40125] Breakthrough
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (8–9/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Take damage equal to Juggernaut's ATK.
  > • Discard the highest-cost upgrade or support you control.
- **Flavor**: *"Oh, yeah!" —Juggernaut*
- **Image Asset**: `assets/card-art/bundles/cards/40125.png` (710×1030 px, 287.3 KB)

### [40126] Flatten
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (10–11/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose to either take damage equal to Juggernaut's ATK or place 1 momentum counter on him.
  >
  > ---
  >
  > [star] **Boost**: Give Juggernaut a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/40126.png` (710×1030 px, 329.8 KB)

### [40127] Ground Pound
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (12–13/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The players as a group take indirect damage equal to Juggernaut's ATK.
  >
  > ---
  >
  > [star] **Boost**: Take 1 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/40127.png` (710×1030 px, 297.5 KB)

### [40128] Trample
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (14–15/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Take 2 indirect damage.
  > **When Revealed (Hero)**: Juggernaut attacks the ally with the fewest remaining hit points.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to an ally you control.
- **Image Asset**: `assets/card-art/bundles/cards/40128.png` (710×1030 px, 327.4 KB)

### [40129] Cyttorak's Exemplar
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Juggernaut (16–18/18, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Juggernaut Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, this card gains incite 1.
  > **When Revealed**: If Juggernaut Exposed is in play, flip it and place 1 momentum counter on Juggernaut. Otherwise, place threat on the main scheme equal to Juggernaut's ATK.
- **Image Asset**: `assets/card-art/bundles/cards/40129.png` (710×1030 px, 291.3 KB)


### Set: Hope Summers

### [40130] Hope Summers
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Hope Summers (1/2)
- **Properties**: Unique
- **Stats**: **HP**: 3, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Hope Summers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic. X-Force. X-Men.*
- **Rules Text**:
  > Setup. The first player controls Hope Summers. Hope Summers does not count against your ally limit.
  > [star] Hope Summer's base THW and base ATK are equal to the THW and ATK of your hero.
  > **If Hope Summers leaves play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/40130.png` (710×1030 px, 328.6 KB)

### [40131] Captive Hope
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Hope Summers (2/2)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hope Summers Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hope Summers cannot ready.
  > **When Revealed**: Exhaust Hope Summers.
- **Flavor**: *"Alright, alright. I know the deal," Hope grumbles to her captor. "This isn't my first time being captured, you know."*
- **Image Asset**: `assets/card-art/bundles/cards/40131.png` (1030×710 px, 357.4 KB)


### Set: Black Tom Cassidy

### [40132] Black Tom Cassidy
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Black Tom Cassidy (1/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Tom Cassidy Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal. Elite.*
- **Rules Text**:
  > Villainous.
  > Black Tom Cassidy cannot take damage while Creeping Willow is in play.
  > **When Revealed**: Search the encounter deck and discard pile for 1 copy of Creeping Willow and put it into play engaged with you. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/40132.png` (710×1030 px, 327.5 KB)

### [40133] Creeping Willow
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Black Tom Cassidy (2–5/7, Qty: 4)
- **Stats**: **SCH**: 0, **ATK**: 1 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Black Tom Cassidy Set Icon (printed bottom-right next to deck number)
- **Traits**: *Wood.*
- **Rules Text**:
  > Guard. Quickstrike.
  > [star] **Forced Response**: After Creeping Willow attacks and damages a character, stun that character.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/40133.png` (710×1030 px, 278.8 KB)

### [40134] Making Green
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Black Tom Cassidy (6/7)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Tom Cassidy Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 2 [per_hero].
  > Each copy of Creeping Willow gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/40134.png` (1030×710 px, 255.4 KB)

### [40135] A Sound Thrashing
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Black Tom Cassidy (7/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Tom Cassidy Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each copy of Creeping Willow attacks the player it is engaged with *(even if that player is in alter-ego form)*. If you were not attacked this way, search the encounter deck and discard pile for a copy of Creeping Willow and reveal it. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/40135.png` (710×1030 px, 286.6 KB)


### Set: Mister Sinister

### [40136] Mister Sinister
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (1/17)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Traits**: *Genius.*
- **Rules Text**:
  > **Forced Response**: After a status card is placed on Mister Sinister, place 1 threat on the main scheme.
- **Flavor**: *"Visionary, savior, madman. It doesn't matter. I am SINISTER."*
- **Image Asset**: `assets/card-art/bundles/cards/40136.png` (710×1030 px, 319.1 KB)

### [40137] Mister Sinister
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (2/17)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Traits**: *Genius.*
- **Rules Text**:
  > **When Revealed**: Place 1 [per_hero] threat on the main scheme (2 [per_hero] threat instead if Mister Sinister has fewer than 2 [[SUPERPOWER]] attachments).
  > **Forced Response**: After a status card is placed on Mister Sinister, place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40137.png` (710×1030 px, 333.3 KB)

### [40138] Mister Sinister
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (3/17)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2, **HP**: 21 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Traits**: *Genius.*
- **Rules Text**:
  > **When Revealed**: Place 2 [per_hero] threat on the main scheme (3 [per_hero] threat instead if Mister Sinister has fewer than 2 [[SUPERPOWER]] attachments).
  > **Forced Response**: After a status card is placed on Mister Sinister, place 3 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40138.png` (710×1030 px, 327.3 KB)

### [40139] Sinister Intent
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (4/17)
- **Properties**: Stage 1
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Remove 1 random stage 2 from the game. Then advance to a random stage 2A.
- **Reverse Side**
  > **Contents**: Mister Sinister (I) and Mister Sinister (II) *(Mister Sinister (II) and Mister Sinister (III) instead for expert mode)*. Mister Sinister, Flight, Super Strength, Telepathy, Hope Summers, and Standard encounter sets. One modular encounter set *(Nasty Boys)*.
  > **Setup**: Set aside the Flight, Super Strength, and Telepathy encounter sets. Put Hope Summers into play under the first player's control.
- **Flavor**: *The secret laboratory hidden deep below the abandoned orphanage is filled with vats containing innocent mutants, subjects of Sinister's experiments.*

### [40139a] Sinister Intent
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (4/17)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Mister Sinister (I) and Mister Sinister (II) *(Mister Sinister (II) and Mister Sinister (III) instead for expert mode)*. Mister Sinister, Flight, Super Strength, Telepathy, Hope Summers, and Standard encounter sets. One modular encounter set *(Nasty Boys)*.
  > **Setup**: Set aside the Flight, Super Strength, and Telepathy encounter sets. Put Hope Summers into play under the first player's control.
- **Image Asset**: `assets/card-art/bundles/cards/40139a.png` (419×289 px, 242.2 KB)

### [40139b] Sinister Intent
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (4/17)
- **Properties**: Stage 1B
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Remove 1 random stage 2 from the game. Then advance to a random stage 2A.
- **Flavor**: *The secret laboratory hidden deep below the abandoned orphanage is filled with vats containing innocent mutants, subjects of Sinister's experiments.*
- **Image Asset**: `assets/card-art/bundles/cards/40139b.png` (419×289 px, 244.9 KB)

### [40140] Taking Off
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (5/17)
- **Properties**: Stage 2
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Attach the Flight attachment to Mister Sinister and shuffle the rest of the Flight encounter set into the encounter deck.
  > **When Completed**: Advance to the other stage 2A. If you cannot, advance to stage 3A.
- **Reverse Side**
  - **Back Flavor**: *Mister Sinister sets about incorporating another mutant's DNA into his own genome.*

### [40140a] Taking Off
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (5/17)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Mister Sinister sets about incorporating another mutant's DNA into his own genome.*
- **Image Asset**: `assets/card-art/bundles/cards/40140a.png` (419×289 px, 214.2 KB)

### [40140b] Taking Off
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (5/17)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Attach the Flight attachment to Mister Sinister and shuffle the rest of the Flight encounter set into the encounter deck.
  > **When Completed**: Advance to the other stage 2A. If you cannot, advance to stage 3A.
- **Image Asset**: `assets/card-art/bundles/cards/40140b.png` (419×289 px, 240.3 KB)

### [40141] Bulking Up
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (6/17)
- **Properties**: Stage 2
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Attach the Super Strength attachment to Mister Sinister and shuffle the rest of the Super Strength encounter set into the encounter deck.
  > **When Completed**: Advance to the other stage 2A. If you cannot, advance to stage 3A.
- **Reverse Side**
  - **Back Flavor**: *Mister Sinister sets about incorporating another mutant's DNA into his own genome.*

### [40141a] Bulking Up
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (6/17)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Mister Sinister sets about incorporating another mutant's DNA into his own genome.*
- **Image Asset**: `assets/card-art/bundles/cards/40141a.png` (419×289 px, 214.2 KB)

### [40141b] Bulking Up
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (6/17)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Attach the Super Strength attachment to Mister Sinister and shuffle the rest of the Super Strength encounter set into the encounter deck.
  > **When Completed**: Advance to the other stage 2A. If you cannot, advance to stage 3A.
- **Image Asset**: `assets/card-art/bundles/cards/40141b.png` (419×289 px, 239.8 KB)

### [40142] Focusing In
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (7/17)
- **Properties**: Stage 2
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Attach the Telepathy attachment to Mister Sinister and shuffle the rest of the Telepathy encounter set into the encounter deck.
  > **When Completed**: Advance to the other stage 2A. If you cannot, advance to stage 3A.
- **Reverse Side**
  - **Back Flavor**: *Mister Sinister sets about incorporating another mutant's DNA into his own genome.*

### [40142a] Focusing In
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (7/17)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Mister Sinister sets about incorporating another mutant's DNA into his own genome.*
- **Image Asset**: `assets/card-art/bundles/cards/40142a.png` (419×289 px, 214.2 KB)

### [40142b] Focusing In
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (7/17)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Attach the Telepathy attachment to Mister Sinister and shuffle the rest of the Telepathy encounter set into the encounter deck.
  > **When Completed**: Advance to the other stage 2A. If you cannot, advance to stage 3A.
- **Image Asset**: `assets/card-art/bundles/cards/40142b.png` (419×289 px, 240.9 KB)

### [40143] Sinister Ends
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (8/17)
- **Properties**: Stage 3
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When Mister Sinister attacks, he attacks Hope Summers instead. *(Other characters may defend the attack.)*
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Deal each player 1 facedown encounter card.
  - **Back Flavor**: *"Gaze upon my power and despair!" Sinister cackles. "Once I add Hope's mutation into my genetic code, I will be capable of mimicking any mutant's powers, and thus will have attained perfection!"*
- **Flavor**: *"I should thank you," Sinister sneers. "You've done what my bumbling flunkies could not: You brought me Hope."*

### [40143a] Sinister Ends
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (8/17)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal each player 1 facedown encounter card.
- **Flavor**: *"Gaze upon my power and despair!" Sinister cackles. "Once I add Hope's mutation into my genetic code, I will be capable of mimicking any mutant's powers, and thus will have attained perfection!"*
- **Image Asset**: `assets/card-art/bundles/cards/40143a.png` (419×289 px, 238.4 KB)

### [40143b] Sinister Ends
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (8/17)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When Mister Sinister attacks, he attacks Hope Summers instead. *(Other characters may defend the attack.)*
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *"I should thank you," Sinister sneers. "You've done what my bumbling flunkies could not: You brought me Hope."*
- **Image Asset**: `assets/card-art/bundles/cards/40143b.png` (419×289 px, 250.0 KB)

### [40144] Sinister Disguise
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (9/17)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Minister Sinister.
  > **Forced Interrupt**: When a player would deal damage to Minister Sinister, that player may spend [mental][mental] resources. If they do not, they deal that damage to the friendly character with the fewest remaining hit points instead. Discard this card *(whether the resources were spent or not)*.
- **Image Asset**: `assets/card-art/bundles/cards/40144.png` (710×1030 px, 392.0 KB)

### [40145] Sinister Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (10–11/17, Qty: 2)
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Traits**: *Clone.*
- **Rules Text**:
  > [star] Sinister Soldier gets +1 SCH and +1 ATK for each [[SUPERPOWER]] attachment on Minister Sinister.
  >
  > ---
  >
  > [star] **Boost**: For this activation, Mister Sinister gets +1 SCH and +1 ATK for each [[SUPERPOWER]] attachment on him.
- **Image Asset**: `assets/card-art/bundles/cards/40145.png` (710×1030 px, 306.7 KB)

### [40146] Teleported Away
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (12/17)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > Mister Sinister cannot take damage.
  > **Forced Interrupt**: When Mister Sinister would attack, he schemes instead.
- **Image Asset**: `assets/card-art/bundles/cards/40146.png` (1030×710 px, 314.8 KB)

### [40147] Genetic Mastery
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (13–14/17, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Mister Sinister has the following traits:
  > • [[AERIAL]] — Take 2 indirect damage.
  > • [[BRUTE]] — Exhaust your identity.
  > • [[PSIONIC]] — Place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40147.png` (710×1030 px, 309.9 KB)

### [40148] Molecular Control
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (15/17)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give Mister Sinister a tough status card. If he has the [[BRUTE]] trait, he heals 4 damage.
  >
  > ---
  >
  > [star] **Boost**: Give Mister Sinister a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/40148.png` (710×1030 px, 301.8 KB)

### [40149] Sinister Schemes
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (16/17)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Mister Sinister schemes. If he has the [[PSIONIC]] trait, you are confused.
  >
  > ---
  >
  > [star] **Boost**: You are confused.
- **Image Asset**: `assets/card-art/bundles/cards/40149.png` (710×1030 px, 318.2 KB)

### [40150] Sinister Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mister Sinister (17/17)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mister Sinister Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: Mister Sinister attacks you. If he has the [[AERIAL]] trait, you are stunned.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/40150.png` (710×1030 px, 312.8 KB)


### Set: Flight

### [40151] Flight
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Flight (1/5)
- **Properties**: Permanent
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Flight Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Setup. Attach to the villain.
  > Permanent.
  > Attached villain gains the [[AERIAL]] trait.
  > [star] Attached villain's attacks gain overkill.
- **Image Asset**: `assets/card-art/bundles/cards/40151.png` (710×1030 px, 290.3 KB)

### [40152] Aerial Bombardment
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Flight (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Flight Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the villain.
  > [star] Attached villain gets +1 ATK and ignores the retaliate keyword while attacking a non-[[AERIAL]] character.
  > **Hero Action**: Exhaust your hero and spend [mental][mental] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40152.png` (710×1030 px, 298.7 KB)

### [40153] Out of Reach
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Flight (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Flight Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the villain.
  > The villain cannot take damage unless the attacker or attack has the [[AERIAL]] trait, or the attack has ranged.
  > **Hero Action**: Exhaust your hero and spend [energy][energy] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40153.png` (710×1030 px, 297.1 KB)

### [40154] High Ground
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Flight (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Flight Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard each tough status card from each friendly character. The players as a group take 2 indirect damage (4 indirect damage instead if the villain has the [[BRUTE]] trait).
  >
  > ---
  >
  > [star] **Boost**: If the villain is attacking, this attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/40154.png` (710×1030 px, 290.2 KB)


### Set: Super Strength

### [40155] Super Strength
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Super Strength (1/5)
- **Properties**: Permanent
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Super Strength Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Setup. Attach to the villain.
  > Permanent.
  > Attached villain gains the [[BRUTE]] trait and steady. *(Steady characters require 2 status cards of the same type to be stunned or confused.)*
- **Image Asset**: `assets/card-art/bundles/cards/40155.png` (710×1030 px, 314.5 KB)

### [40156] Impervious
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Super Strength (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Super Strength Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the villain.
  > Reduce the amount of damage attached villain takes from each attack by 1.
  > **Hero Action**: Spend [physical][physical] resources → give the villain a tough status card and discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40156.png` (710×1030 px, 315.5 KB)

### [40157] Thrown Object
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Super Strength (3/5)
- **Stats**: **ATK**: 3 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Super Strength Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to the villain.
  > [star] Attached villain's attacks gain ranged.
  > [star] **Forced Response**: After the villain attacks, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40157.png` (710×1030 px, 290.4 KB)

### [40158] "I'll Take That"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Super Strength (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Super Strength Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the upgrade you control with the lowest cost (highest cost instead if the villain has the [[PSIONIC]] trait). If no upgrade was discarded this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/40158.png` (710×1030 px, 354.4 KB)


### Set: Telepathy

### [40159] Telepathy
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Telepathy (1/5)
- **Properties**: Permanent
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Telepathy Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Setup. Attach to the villain.
  > Permanent.
  > Attached villain gains the [[PSIONIC]] trait and retaliate 1. *(After this character is attacked, deal 1 damage to the attacking character.)*
- **Image Asset**: `assets/card-art/bundles/cards/40159.png` (710×1030 px, 280.6 KB)

### [40160] Manufactured Drama
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Telepathy (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Telepathy Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Supports you control cannot ready.
  > **When Revealed**: Exhaust each support you control. If no supports were exhausted this way, this card gains surge.
  > **Alter-Ego Action**: Exhaust your identity and discard 1 card from the top of your deck for each support you control → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40160.png` (710×1030 px, 316.8 KB)

### [40161] Sowing Discord
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Telepathy (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Telepathy Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Allies you control cannot ready.
  > **When Revealed**: Exhaust each ally you control. If no allies were exhausted this way, this card gains surge.
  > **Alter-Ego Action**: Spend [mental][mental] resources → discard this card.
- **Flavor**: *"I dare you to call me 'Peaches' again!" —Domino*
- **Image Asset**: `assets/card-art/bundles/cards/40161.png` (710×1030 px, 308.2 KB)

### [40162] One Step Ahead
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Telepathy (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Telepathy Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1 random card from your hand (2 random cards instead if the villain has the [[AERIAL]] trait).
  >
  > ---
  >
  > [star] **Boost**: If the villain is attacking, this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/40162.png` (710×1030 px, 306.0 KB)


### Set: Stryfe

### [40163] Stryfe
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (1/21)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 0 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front. Psionic.*
- **Rules Text**:
  > [star] While Stryfe is attacking you, he gets +X ATK, where X is the number of cards of the most common type in your hand.
- **Flavor**: *"Kneel before your superior!"*
- **Image Asset**: `assets/card-art/bundles/cards/40163.png` (710×1030 px, 359.5 KB)

### [40164] Stryfe
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (2/21)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front. Psionic.*
- **Rules Text**:
  > [star] While Stryfe is attacking you, he gets +X ATK, where X is the number of cards of the most common type in your hand.
  > **When Revealed**: Each player discards cards from the top of the encounter deck until a [[PSIONIC]] attachment is discarded and reveals that card.
- **Image Asset**: `assets/card-art/bundles/cards/40164.png` (710×1030 px, 305.0 KB)

### [40165] Stryfe
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (3/21)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front. Psionic.*
- **Rules Text**:
  > [star] While Stryfe is attacking you, he gets +X ATK, where X is the number of cards of the most common type in your hand.
  > **Forced Response**: After you attack Stryfe, take X damage, where X is the number of cards of the most common type in your hand.
- **Image Asset**: `assets/card-art/bundles/cards/40165.png` (710×1030 px, 368.3 KB)

### [40166] Uncontrollable Power
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (4/21)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +0 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, each player places X threat here, where X is the number of cards of the most common type in their hand. Each player may discard 1 card from their hand before calculating the value of X.
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**
  > **Contents**: Stryfe (I) and Stryfe (II) *(Stryfe (II) and Stryfe (III) instead for expert mode)*. Stryfe, Hope Summers, and Standard encounter sets. Two modular encounter sets *(Extreme Measures and Mutant Insurrection)*.
  > **Setup**: Put Hope Summers into play under the first player's control. Reveal Stryfe's Grasp.
- **Flavor**: *Hope tries to mimic Stryfe's abilities, but is quickly overwhelmed by the power.*
- **Image Asset**: `assets/card-art/bundles/cards/40166.png` (1030×710 px, 294.7 KB)

### [40166a] Uncontrollable Power
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (4/21)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Stryfe (I) and Stryfe (II) *(Stryfe (II) and Stryfe (III) instead for expert mode)*. Stryfe, Hope Summers, and Standard encounter sets. Two modular encounter sets *(Extreme Measures and Mutant Insurrection)*.
  > **Setup**: Put Hope Summers into play under the first player's control. Reveal Stryfe's Grasp.
- **Image Asset**: `assets/card-art/bundles/cards/40166a.png` (1030×710 px, 294.7 KB)

### [40166b] Uncontrollable Power
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (4/21)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +0 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step one of the villain phase, each player places X threat here, where X is the number of cards of the most common type in their hand. Each player may discard 1 card from their hand before calculating the value of X.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Hope tries to mimic Stryfe's abilities, but is quickly overwhelmed by the power.*
- **Image Asset**: `assets/card-art/bundles/cards/40166b.png` (1030×710 px, 311.5 KB)

### [40167] Left to Your Fate
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (5/21)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 0, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Stryfe gains stalwart.
  > Each identity gets +2 hand size. Increase the resource cost to play each player card by 1.
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**
  - **Back Flavor**: *Hope breaks free from Stryfe's grasp, but she struggles to contain his powerful psionic energies.
"I will leave Hope to finish the job of killing you all," Stryfe laughs. "I have work to do bringing about the Apocalypse!"*
- **Flavor**: *Stryfe is attempting to escape into the past. Who knows what havoc he will wreak?*
- **Image Asset**: `assets/card-art/bundles/cards/40167.jpg` (1030×710 px, 320.1 KB)

### [40167a] Left to Your Fate
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (5/21)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Hope breaks free from Stryfe's grasp, but she struggles to contain his powerful psionic energies.
"I will leave Hope to finish the job of killing you all," Stryfe laughs. "I have work to do bringing about the Apocalypse!"*
- **Image Asset**: `assets/card-art/bundles/cards/40167a.png` (1030×710 px, 320.1 KB)

### [40167b] Left to Your Fate
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (5/21)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Stryfe gains stalwart.
  > Each identity gets +2 hand size. Increase the resource cost to play each player card by 1.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Stryfe is attempting to escape into the past. Who knows what havoc he will wreak?*
- **Image Asset**: `assets/card-art/bundles/cards/40167b.png` (1030×710 px, 380.5 KB)

### [40168a] Stryfe's Grasp
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (6/21)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Permanent. Hinder 6 [per_hero].
  > Hope Summers can attack only Stryfe and can thwart only this scheme.
  > **Forced Response**: After Stryfe is defeated or the last threat is removed from this scheme, flip this card and reveal Living Bomb. Place any threat here on Living Bomb.
- **Image Asset**: `assets/card-art/bundles/cards/40168a.png` (419×289 px, 254.0 KB)

### [40168b] Living Bomb
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (6/21)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Victory 1.
  > Stryfe cannot be defeated.
  > **When Revealed**: Advance the main scheme to stage 2A. This effect cannot be canceled.
- **Flavor**: *Mimicking Stryfe's power is too much for Hope to control and threatens to overwhelm her...with explosive results!*
- **Image Asset**: `assets/card-art/bundles/cards/40168b.png` (419×289 px, 254.2 KB)

### [40169] Mental Transferal
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (7/21)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition. Psionic.*
- **Rules Text**:
  > If Stryfe's Grasp is in play, attach to Hope Summers. Otherwise, attach to your identity.
  > **Forced Response**: After Stryfe takes any amount of damage, attached character takes an equal amount of damage. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40169.png` (710×1030 px, 394.5 KB)

### [40170] Mind Alteration
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (8/21)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition. Psionic.*
- **Rules Text**:
  > Attach to your identify.
  > **Forced Response**: After you play an event or upgrade, take 1 damage.
  > **Response**: After you recover, spend a [mental] resource → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40170.png` (710×1030 px, 347.5 KB)

### [40171] Mind Trap
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (9/21)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition. Psionic.*
- **Rules Text**:
  > Attach to your identify.
  > Your allies, upgrades, and supports enter play exhausted.
  > **Alter-Ego Action**: Exhaust 3 cards you control → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40171.png` (710×1030 px, 326.7 KB)

### [40172] Psionic Amnesia
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (10/21)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition. Psionic.*
- **Rules Text**:
  > Attach to your identify.
  > Increase the resource cost of each ally and support you play by 2.
  > **Response**: After you play an ally or support, exhaust your identity → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/40172.png` (710×1030 px, 321.6 KB)

### [40173] Psychic Inertia
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (11–12/21, Qty: 2)
- **Stats**: **SCH**: -1, **ATK**: -1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition. Psionic.*
- **Rules Text**:
  > Attach to your identify.
  > **Hero Action**: If your hero attacked and thwarted this phase → discard this card.
- **Flavor**: *"It is...as if...something...is holding...Caliban back!" —Caliban*
- **Image Asset**: `assets/card-art/bundles/cards/40173.png` (710×1030 px, 410.1 KB)

### [40174] Zero
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (13/21)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front.*
- **Rules Text**:
  > Guard. Patrol. Toughness.
  > **When Defeated**: If the player who defeated Zero does not have at least 3 cards of the same type in their hand, shuffle Zero into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/40174.png` (710×1030 px, 323.6 KB)

### [40175] Cerebral Erasure
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (14/21)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Return an upgrade or support you control to its owner's hand.
  > **When Defeated**: The player who defeated this scheme returns an upgrade or support they control to its owner's hand.
- **Image Asset**: `assets/card-art/bundles/cards/40175.png` (1030×710 px, 335.5 KB)

### [40176] Telepathic Camouflage
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (15/21)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Each player places X threat here, where X is the number of cards of the most common type in their hand.
- **Image Asset**: `assets/card-art/bundles/cards/40176.png` (1030×710 px, 311.8 KB)

### [40177] Psionic Surge
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (16/21)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top X cards of the encounter deck, where X is the number of cards of the most common type in your hand. Deal each [[PSIONIC]] card discarded this way to yourself as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/40177.png` (710×1030 px, 342.1 KB)

### [40178] Psychic Override
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (17–18/21, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic.*
- **Rules Text**:
  > **When Revealed**: Choose a card type, then discard each card from your hand that is not of that type. Draw up to your hand size. Place 1 threat on the main scheme for each card of the chosen type in your hand.
  >
  > ---
  >
  > [star] **Boost**: Discard 1 card from your hand. Then, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/40178.png` (710×1030 px, 341.6 KB)

### [40179] Telekinetic Wave
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Stryfe (19–21/21, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Stryfe Set Icon (printed bottom-right next to deck number)
- **Traits**: *Psionic.*
- **Rules Text**:
  > **When Revealed**: Return an upgrade or support you control to your hand. Stryfe activates against you.
  >
  > ---
  >
  > [star] **Boost**: If you have at least 3 cards in your hand that share a type, place 3 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/40179.png` (710×1030 px, 322.3 KB)


### Set: Extreme Measures

### [40180] Strobe
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Extreme Measures (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Extreme Measures Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front.*
- **Rules Text**:
  > Patrol.
  > **When Revealed**: Choose:
  > • Stun each character you control.
  > • Deal 1 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/40180.png` (710×1030 px, 337.9 KB)

### [40181] Tempo
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Extreme Measures (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Extreme Measures Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front.*
- **Rules Text**:
  > While Tempo is engaged with you, you get +1 hand size.
  > [star] **Forced Response**: After Tempo activates against you, discard cards from the top of your deck equal to twice the number of cards in your hand.
- **Image Asset**: `assets/card-art/bundles/cards/40181.png` (710×1030 px, 302.3 KB)

### [40182] Thumbelina
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Extreme Measures (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Extreme Measures Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front.*
- **Rules Text**:
  > Reduce the amount of damage Thumbelina takes from each attack by 1 unless the attacker has the [[TINY]] trait.
  > **When Revealed**: Return the highest-cost upgrade you control to its owner's hand.
- **Image Asset**: `assets/card-art/bundles/cards/40182.png` (710×1030 px, 370.9 KB)

### [40183] Wildside
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Extreme Measures (4/5)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Extreme Measures Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front.*
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Wildside attacks you.
  > • Return the highest-cost support you control to its owner's hand.
- **Image Asset**: `assets/card-art/bundles/cards/40183.png` (710×1030 px, 294.1 KB)

### [40184] Extreme Measures
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Extreme Measures (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Extreme Measures Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 2 [per_hero].
  > **Forced Response**: After a player card enters play, its controller takes indirect damage equal to that card's printed cost.
- **Image Asset**: `assets/card-art/bundles/cards/40184.png` (1030×710 px, 347.5 KB)


### Set: Mutant Insurrection

### [40185] Dragoness
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Insurrection (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Insurrection Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Dragoness activates against you, she gets +X SCH and +X ATK for that activation, where X is the number of [energy] resources in your hand.
- **Image Asset**: `assets/card-art/bundles/cards/40185.png` (710×1030 px, 359.7 KB)

### [40186] Forearm
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Insurrection (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 4 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Insurrection Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front.*
- **Rules Text**:
  > [star] **Forced Response**: After Forearm attacks you, discard X cards from the top of your deck, where X is the number of [physical] resources in your hand.
- **Flavor**: *"They call me Forearm because I give good back rubs."*
- **Image Asset**: `assets/card-art/bundles/cards/40186.png` (710×1030 px, 291.2 KB)

### [40187] Reaper
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Insurrection (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Insurrection Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Reaper attacks you, if you have at least:
  > • [mental][mental] resources in your hand, stun your identity.
  > • [mental][mental][mental][mental] resources in your hand, exhaust your identity.
- **Image Asset**: `assets/card-art/bundles/cards/40187.png` (710×1030 px, 294.1 KB)

### [40188] Samurai
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Insurrection (4/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Insurrection Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mutant Liberation Front.*
- **Rules Text**:
  > [star] **Forced Response**: After Samarai attacks you, place 1 charge counter here. Choose:
  > • Take damage equal to the number of charge counters on Samurai.
  > • Discard 1 card you control with printed cost equal to or greater than the number of charge counters on Samurai.
- **Image Asset**: `assets/card-art/bundles/cards/40188.png` (710×1030 px, 355.3 KB)

### [40189] Mutant Insurrection
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Mutant Insurrection (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Insurrection Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Assault. *(Basic thwarts against this scheme use ATK instead of THW.)*
  > Each minion gains toughness.
  > **When Revealed**: Place 2 additional threat here for each [[MUTANT LIBERATION FRONT]] character in play. If no additional threat was placed this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/40189.png` (1030×710 px, 323.8 KB)


### Set: Next Evolution Campaign

### [40190a] Assemble the Team
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (1/17)
- **Properties**: Unique
- **Stats**: **Base Threat**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > This scheme does not count against the player side scheme limit.
  > **When Defeated**: Flip this card and put Team Assembled into play.
  > *(The ability on Team Assembled allows each player to play an ally from their deck for free.)*
- **Image Asset**: `assets/card-art/bundles/cards/40190a.png` (419×289 px, 250.5 KB)

### [40190b] Team Assembled
- **Type**: `Environment`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (1/17)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Enters play with 1 assembly counter on it.
  > **Action**: Remove 1 assembly counter from here → each player may search their deck and discard pile for an ally with a printed cost of 3 or less and put it into play. *(Any player can do this.)*
- **Image Asset**: `assets/card-art/bundles/cards/40190b.png` (289×419 px, 247.2 KB)

### [40191a] Establish Safehouse
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (2/17)
- **Properties**: Unique
- **Stats**: **Base Threat**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > This scheme does not count against the player side scheme limit.
  > **When Defeated**: Flip this card and put Safehouse Established into play.
  > *(The ability on Safehouse Established gains the players the Safehouse support card.)*
- **Image Asset**: `assets/card-art/bundles/cards/40191a.png` (419×289 px, 251.5 KB)

### [40191b] Safehouse Established
- **Type**: `Environment`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (2/17)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Enters play with 1 safehouse counter on it.
  > **Action**: Remove 1 safehouse counter from here → the first player puts the Safehouse support into play under their control. *(Safehouse is a campaign card.)*
- **Image Asset**: `assets/card-art/bundles/cards/40191b.png` (289×419 px, 245.7 KB)

### [40192a] Gear Up
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (3/17)
- **Properties**: Unique
- **Stats**: **Base Threat**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > This scheme does not count against the player side scheme limit.
  > **When Defeated**: Flip this card and put Geared Up into play.
  > *(The ability on Geared Up gains each player a Pouches resource card.)*
- **Image Asset**: `assets/card-art/bundles/cards/40192a.png` (419×289 px, 245.5 KB)

### [40192b] Geared Up
- **Type**: `Environment`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (3/17)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Enters play with 1 pouch counter on it.
  > **Action**: Remove 1 pouch counter from here → each player shuffles 1 copy of the Pouches resource card into their deck. *(Pouches is a campaign card.)*
- **Image Asset**: `assets/card-art/bundles/cards/40192b.png` (289×419 px, 240.3 KB)

### [40193a] Mission Prep
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (4/17)
- **Properties**: Unique
- **Stats**: **Base Threat**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > This scheme does not count against the player side scheme limit.
  > **When Defeated**: Flip this card and put Mission Prepped into play.
  > *(The ability on Mission Prepped allows each player to play an upgrade from their deck for free.)*
- **Image Asset**: `assets/card-art/bundles/cards/40193a.png` (419×289 px, 239.6 KB)

### [40193b] Mission Prepped
- **Type**: `Environment`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (4/17)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Enters play with 1 prep counter on it.
  > **Action**: Remove 1 prep counter from here → each player searches their deck and discard pile for 1 upgrade with a printed cost of 2 or less and puts it into play. *(Any player can do this.)*
- **Image Asset**: `assets/card-art/bundles/cards/40193b.png` (289×419 px, 237.5 KB)

### [40194a] Practice Maneuvers
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (5/17)
- **Properties**: Unique
- **Stats**: **Base Threat**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > This scheme does not count against the player side scheme limit.
  > **When Defeated**: Flip this card and put Practiced Maneuvers into play.
  > *(The ability on Practiced Maneuvers provides the players a permanent discount on high-cost event cards.)*
- **Image Asset**: `assets/card-art/bundles/cards/40194a.png` (419×289 px, 251.3 KB)

### [40194b] Practiced Maneuvers
- **Type**: `Environment`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (5/17)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Reduce the cost to play each event with a printed cost of 3 or more by 1.
- **Flavor**: *"Last one through the course does the laundry for a month!" —Sunspot*
- **Image Asset**: `assets/card-art/bundles/cards/40194b.png` (289×419 px, 239.8 KB)

### [40195a] Prepare Defenses
- **Type**: `Player Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (6/17)
- **Properties**: Unique
- **Stats**: **Base Threat**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > This scheme does not count against the player side scheme limit.
  > **When Defeated**: Flip this card and put Prepared Defenses into play.
  > *(The ability on Prepared Defenses gains each player a permanent +1 DEF and retaliate 1.)*
- **Image Asset**: `assets/card-art/bundles/cards/40195a.png` (419×289 px, 250.8 KB)

### [40195b] Prepared Defenses
- **Type**: `Environment`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (6/17)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each hero gets +1 DEF and gains retaliate 1.
- **Flavor**: *"We've got incoming!"
"They can each my high-velocity diamond shards."
— Rockslide and Bling!*
- **Image Asset**: `assets/card-art/bundles/cards/40195b.png` (289×419 px, 240.2 KB)

### [40196] Pouches
- **Type**: `Resource`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (7–10/17, Qty: 4)
- **Stats**: **Resources**: [wild] [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Flavor**: *"I can never remember where I put anything." —Deadpool*
- **Image Asset**: `assets/card-art/bundles/cards/40196.png` (710×1030 px, 297.1 KB)

### [40197] Safehouse
- **Type**: `Support`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (11/17)
- **Stats**: **Cost**: 4, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Choose:
  > • Heal 2 damage from your identity.
  > • Draw 1 card.
  > Any player may trigger this ability. (Limit once per round per player.)
- **Image Asset**: `assets/card-art/bundles/cards/40197.png` (710×1030 px, 302.8 KB)

### [40198] Lady Mastermind
- **Type**: `Minion`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (12/17)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder.*
- **Rules Text**:
  > Surge.
  > **When Revealed**: Take X damage, where X is the printed cost of the event in your hand with the highest cost.
  >
  > ---
  >
  > [star] **Boost**: Discard an event from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/40198.png` (710×1030 px, 351.8 KB)

### [40199] Malice
- **Type**: `Minion`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (13/17)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder.*
- **Rules Text**:
  > Surge.
  > **When Defeated**: Attach Malice to the non-[[PSIONIC]] ally with the highest cost. Attached ally engages its controller. Threat attached ally as a [[POSSESSED]] minion with a blank text box *(except for [[TRAITS]])*. Attached minion's SCH is equal to its THW and it does not take consequential damage.
- **Image Asset**: `assets/card-art/bundles/cards/40199.png` (710×1030 px, 315.0 KB)

### [40200] Scrambler
- **Type**: `Minion`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (14/17)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder.*
- **Rules Text**:
  > Surge.
  > **When Revealed**: Discard an upgrade you control.
- **Flavor**: *"Not so tough with your powers turned off, are you?"*
- **Image Asset**: `assets/card-art/bundles/cards/40200.png` (710×1030 px, 298.9 KB)

### [40201] Vanisher
- **Type**: `Minion`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (15/17)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Marauder.*
- **Rules Text**:
  > Surge.
  > **When Revealed**: Return the support you control with the highest cost to your hand.
  >
  > ---
  >
  > [star] **Boost**: Return the support you control with the highest cost to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/40201.png` (710×1030 px, 355.7 KB)

### [40202] Under Pressure
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (16/17)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Surge.
  >
  > ---
  >
  > [star] **Boost**: Give the villain 1 additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/40202.png` (1030×710 px, 283.9 KB)

### [40203] Overburdened
- **Type**: `Treachery`
- **Faction / Aspect**: Campaign
- **Pack**: NeXt Evolution (`next_evol`)
- **Deck / Set**: Next Evolution Campaign (17/17)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Next Evolution Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Choose to either discard 1 resource card from your hand or take 2 damage.
  >
  > ---
  >
  > [star] **Boost**: Choose to either discard 1 resource card from your hand or take 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/40203.png` (710×1030 px, 289.2 KB)


