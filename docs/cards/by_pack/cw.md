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
| `56001a` | Tigra | Hero | Tigra | THW:1 ATK:2 DEF:3 HP:10 | - | `cw` |
| `56001b` | Greer Nelson | Alter-Ego | Tigra | REC:3 HP:10 | - | `cw` |
| `56002` | Moon Knight | Ally | Tigra | THW:2 ATK:2 HP:3 | - | `cw` |
| `56003` | Precinct HQ | Support | Tigra | - | - | `cw` |
| `56004` | Cat's Head Amulet | Upgrade | Tigra | - | - | `cw` |
| `56005` | Sharp Claws | Upgrade | Tigra | - | - | `cw` |
| `56006` | Cat-Like Reflexes | Upgrade | Tigra | - | - | `cw` |
| `56007` | Hunted | Upgrade | Tigra | - | - | `cw` |
| `56008` | Tooth and Claw | Event | Tigra | - | - | `cw` |
| `56009` | Feline Senses | Event | Tigra | - | - | `cw` |
| `56010` | Two-Gun Kid | Ally | Pack Position: 10 | THW:1 ATK:2 HP:3 | - | `cw` |
| `56011` | Spider-Girl | Ally | Pack Position: 11 | THW:1 ATK:2 HP:2 | - | `cw` |
| `56012` | Air Cover | Support | Pack Position: 12 | - | - | `cw` |
| `56013` | Aggressive Conditioning | Upgrade | Pack Position: 13 | - | - | `cw` |
| `56014` | Suppressing Fire | Upgrade | Pack Position: 14 | - | - | `cw` |
| `56015` | "Bring It!" | Event | Pack Position: 15 | - | - | `cw` |
| `56016` | Coup de Grâce | Event | Pack Position: 16 | - | - | `cw` |
| `56017` | Savage Strike | Event | Pack Position: 17 | - | - | `cw` |
| `56018` | Audacity | Resource | Pack Position: 18 | - | - | `cw` |
| `56019` | Yellow Jacket | Ally | Pack Position: 19 | THW:2 ATK:2 HP:3 | - | `cw` |
| `56020` | Energy | Resource | Pack Position: 20 | - | - | `cw` |
| `56021` | Genius | Resource | Pack Position: 21 | - | - | `cw` |
| `56022` | Strength | Resource | Pack Position: 22 | - | - | `cw` |
| `56023` | In Too Deep | Obligation | Tigra | - | 2 icons | `cw` |
| `56024` | The Hood | Minion | Tigra Nemesis | SCH:1 ATK:1 HP:4 | 2 icons | `cw` |
| `56025` | Criminal Underworld | Side Scheme | Tigra Nemesis | - | 3 icons | `cw` |
| `56026` | The Hood's Mantle | Attachment | Tigra Nemesis | SCH:1 ATK:1 | 0 icons + star | `cw` |
| `56027` | Madame Masque | Minion | Tigra Nemesis | SCH:2 ATK:1 HP:3 | 0 icons + star | `cw` |
| `56028` | Jigsaw | Minion | Tigra Nemesis | SCH:1 ATK:2 HP:3 | 2 icons | `cw` |
| `56029a` | Hulkling | Hero | Hulkling | THW:1 ATK:1 DEF:1 HP:13 | - | `cw` |
| `56029b` | Teddy Altman | Alter-Ego | Hulkling | REC:4 HP:13 | - | `cw` |
| `56030` | Wiccan | Ally | Hulkling | THW:2 ATK:1 HP:2 | - | `cw` |
| `56031` | Altman Residence | Support | Hulkling | - | - | `cw` |
| `56032` | Winged Shape | Upgrade | Hulkling | - | - | `cw` |
| `56033` | Hulk Shape | Upgrade | Hulkling | - | - | `cw` |
| `56034` | Armored Shape | Upgrade | Hulkling | - | - | `cw` |
| `56035` | Imitation Shape | Upgrade | Hulkling | - | - | `cw` |
| `56036` | Alien Physiology | Upgrade | Hulkling | - | - | `cw` |
| `56037` | Shapeshifter Strike | Event | Hulkling | - | - | `cw` |
| `56038` | Armored Defense | Event | Hulkling | - | - | `cw` |
| `56039` | Impersonation | Event | Hulkling | - | - | `cw` |
| `56040` | Shapeshifter | Event | Hulkling | - | - | `cw` |
| `56041` | Patriot | Ally | Pack Position: 41 | THW:1 ATK:2 HP:3 | - | `cw` |
| `56042` | Brother Voodoo | Ally | Pack Position: 42 | THW:2 ATK:1 HP:3 | - | `cw` |
| `56043` | Hidden Base | Support | Pack Position: 43 | - | - | `cw` |
| `56044` | The Night Nurse | Support | Pack Position: 44 | - | - | `cw` |
| `56045` | Excelsior | Upgrade | Pack Position: 45 | - | - | `cw` |
| `56046` | Defensive Conditioning | Upgrade | Pack Position: 46 | - | - | `cw` |
| `56047` | "I Can Do This All Day" | Event | Pack Position: 47 | - | - | `cw` |
| `56048` | Taunt | Event | Pack Position: 48 | - | - | `cw` |
| `56049` | Tackle | Event | Pack Position: 49 | - | - | `cw` |
| `56050` | Cuts Both Ways | Event | Pack Position: 50 | - | - | `cw` |
| `56051` | Preservation | Resource | Pack Position: 51 | - | - | `cw` |
| `56052` | Iron Lad | Ally | Pack Position: 52 | THW:1 ATK:1 HP:3 | - | `cw` |
| `56053` | Assess the Situation | Event | Pack Position: 53 | - | - | `cw` |
| `56054` | Complicated Lineage | Obligation | Hulkling | - | 2 icons | `cw` |
| `56055` | Super Skrull | Minion | Hulkling Nemesis | SCH:1 ATK:1 HP:5 | 2 icons | `cw` |
| `56056` | Skrull Business | Side Scheme | Hulkling Nemesis | - | 3 icons | `cw` |
| `56057` | Fantastic Powers | Attachment | Hulkling Nemesis | SCH:1 ATK:1 | 2 icons | `cw` |
| `56058` | You're Coming With Me! | Treachery | Hulkling Nemesis | - | 1 icon | `cw` |
| `56059` | Iron Man | Leader | Iron Man | SCH:1 ATK:1 HP:12 | not recorded in this source | `cw` |
| `56060` | Iron Man | Leader | Iron Man | SCH:1 ATK:2 HP:16 | not recorded in this source | `cw` |
| `56061` | Iron Man | Leader | Iron Man | SCH:1 ATK:2 HP:16 | not recorded in this source | `cw` |
| `56062` | Iron Man | Leader | Iron Man | SCH:1 ATK:3 HP:20 | not recorded in this source | `cw` |
| `56063a` | Superhero Registration Act | Main Scheme | Registration | - | - | `cw` |
| `56063b` | Cut Off Support | Main Scheme | Registration | - | - | `cw` |
| `56064a` | Pro-Registration Tactics | Main Scheme | Registration | - | - | `cw` |
| `56064b` | Negative Zone Prison | Main Scheme | Registration | - | - | `cw` |
| `56065` | Powered Gauntlets | Attachment | Iron Man | ATK:1 | 0 icons + star | `cw` |
| `56066` | Rocket Boots | Attachment | Iron Man | ATK:1 | 0 icons + star | `cw` |
| `56067` | Mark V Helmet | Attachment | Iron Man | - | 2 icons | `cw` |
| `56068` | Arc Reactor | Attachment | Iron Man | - | 2 icons | `cw` |
| `56069` | Mark V Armor | Attachment | Iron Man | - | 0 icons + star | `cw` |
| `56070` | Repulsor Blast | Treachery | Iron Man | - | 1 icon | `cw` |
| `56071` | Supersonic Punch | Treachery | Iron Man | - | 2 icons | `cw` |
| `56072` | Stark Tower | Side Scheme | Iron Man | - | 3 icons | `cw` |
| `56073` | Yellow Jacket | Minion | Mighty Avengers | SCH:2 ATK:1 HP:4 | 0 icons + star | `cw` |
| `56074` | Wasp | Minion | Mighty Avengers | SCH:1 ATK:2 HP:3 | 0 icons + star | `cw` |
| `56075` | U.S. Agent | Minion | Mighty Avengers | SCH:1 ATK:2 HP:3 | 0 icons + star | `cw` |
| `56076` | Mighty Avengers | Treachery | Mighty Avengers | - | 2 icons | `cw` |
| `56077` | Earth's Mightiest Heroes | Side Scheme | Mighty Avengers | - | 2 icons | `cw` |
| `56078` | Doc Samson | Minion | The Initiative | SCH:2 ATK:2 HP:4 | 0 icons + star | `cw` |
| `56079` | Hellcat | Minion | The Initiative | SCH:1 ATK:2 HP:3 | 0 icons + star | `cw` |
| `56080` | Drafted | Attachment | The Initiative | - | 1 icon | `cw` |
| `56081` | Mighty Avengers | Treachery | The Initiative | - | 2 icons | `cw` |
| `56082` | The Fifty State Initiative | Side Scheme | The Initiative | - | 2 icons | `cw` |
| `56083` | Maria Hill | Minion | Maria Hill | SCH:2 ATK:2 HP:4 | 2 icons | `cw` |
| `56084` | Life Model Decoy | Attachment | Maria Hill | - | 1 icon | `cw` |
| `56085` | Executive Order | Treachery | Maria Hill | - | 0 icons + star | `cw` |
| `56086` | S.H.I.E.L.D. Helicarrier | Side Scheme | Maria Hill | - | 2 icons | `cw` |
| `56087` | Venom | Minion | Dangerous Recruits | SCH:1 ATK:3 HP:4 | 2 icons | `cw` |
| `56088` | Bullseye | Minion | Dangerous Recruits | SCH:2 ATK:2 HP:3 | 2 icons | `cw` |
| `56089` | Justice Like Lightning | Treachery | Dangerous Recruits | - | 1 icon | `cw` |
| `56090` | Excessive Force | Treachery | Dangerous Recruits | - | 0 icons + star | `cw` |
| `56091` | Dangerous Recruits | Side Scheme | Dangerous Recruits | - | 2 icons | `cw` |
| `56092` | Captain Marvel | Leader | Captain Marvel | SCH:1 ATK:2 HP:14 | not recorded in this source | `cw` |
| `56093` | Captain Marvel | Leader | Captain Marvel | SCH:2 ATK:2 HP:18 | not recorded in this source | `cw` |
| `56094` | Captain Marvel | Leader | Captain Marvel | SCH:2 ATK:2 HP:18 | not recorded in this source | `cw` |
| `56095` | Captain Marvel | Leader | Captain Marvel | SCH:2 ATK:3 HP:22 | not recorded in this source | `cw` |
| `56096a` | Superhero Registration Act | Main Scheme | Registration | - | - | `cw` |
| `56096b` | S.H.I.E.L.D. Recruits | Main Scheme | Registration | - | - | `cw` |
| `56097a` | Pro-Registration Tactics | Main Scheme | Registration | - | - | `cw` |
| `56097b` | Hunting Rebel Heroes | Main Scheme | Registration | - | - | `cw` |
| `56098` | Energy Channel | Attachment | Captain Marvel | - | not recorded in this source | `cw` |
| `56099` | Captain Marvel's Helmet | Attachment | Captain Marvel | SCH:1 | 0 icons + star | `cw` |
| `56100` | Cosmic Flight | Attachment | Captain Marvel | ATK:1 | 0 icons + star | `cw` |
| `56101` | Photonic Blast | Treachery | Captain Marvel | - | 1 icon | `cw` |
| `56102` | Crisis Interdiction | Treachery | Captain Marvel | - | 2 icons | `cw` |
| `56103` | Energy Absorption | Treachery | Captain Marvel | - | 0 icons + star | `cw` |
| `56104` | Alpha Flight Station | Side Scheme | Captain Marvel | - | 3 icons | `cw` |
| `56105` | Cape-Killer | Minion | Cape-Killer | SCH:1 ATK:2 HP:4 | 2 icons | `cw` |
| `56106` | Unregistered Super | Obligation | Cape-Killer | - | 1 icon | `cw` |
| `56107` | Bring Them In | Treachery | Cape-Killer | - | 1 icon | `cw` |
| `56108` | Arrest Order | Side Scheme | Cape-Killer | - | 2 icons | `cw` |
| `56109` | S.H.I.E.L.D. Soldier | Minion | Martial Law | SCH:1 ATK:1 HP:3 | 0 icons + star | `cw` |
| `56110` | Rapid Response | Treachery | Martial Law | - | 1 icon | `cw` |
| `56111` | S.H.I.E.L.D. Patrol | Side Scheme | Martial Law | - | 3 icons | `cw` |
| `56112` | Colleen Wing | Minion | Heroes for Hire | SCH:1 ATK:2 HP:3 | 2 icons | `cw` |
| `56113` | Shang-Chi | Minion | Heroes for Hire | SCH:2 ATK:2 HP:4 | 2 icons | `cw` |
| `56114` | Unregistered Super | Obligation | Heroes for Hire | - | 1 icon | `cw` |
| `56115` | Bounty Hunting | Treachery | Heroes for Hire | - | 1 icon | `cw` |
| `56116` | Heroes for Hire | Side Scheme | Heroes for Hire | - | 2 icons | `cw` |
| `56117` | Paladin | Minion | Paladin | SCH:2 ATK:2 HP:5 | 2 icons | `cw` |
| `56118` | Paladin's Pistol | Attachment | Paladin | ATK:2 | 2 icons | `cw` |
| `56119` | Bounty Hunting | Treachery | Paladin | - | 1 icon | `cw` |
| `56120` | Government Contractor | Side Scheme | Paladin | - | 2 icons | `cw` |
| `56121a` | Superhero Registration Act | Main Scheme | Registration | - | - | `cw` |
| `56121b` | Homeland Security | Main Scheme | Registration | - | - | `cw` |
| `56122a` | Superhero Registration Act | Main Scheme | Registration | - | - | `cw` |
| `56122b` | Public Outrage | Main Scheme | Registration | - | - | `cw` |
| `56123a` | Pro-Registration Tactics | Main Scheme | Registration | - | - | `cw` |
| `56123b` | The Initiative | Main Scheme | Registration | - | - | `cw` |
| `56124a` | Pro-Registration Tactics | Main Scheme | Registration | - | - | `cw` |
| `56124b` | No Going Back | Main Scheme | Registration | - | - | `cw` |
| `56125` | Righteous Cause | Treachery | Standard PVP | - | not recorded in this source | `cw` |
| `56126` | Whatever It Takes | Treachery | Standard PVP | - | not recorded in this source | `cw` |
| `56127` | Targeted Strike | Treachery | Standard PVP | - | 0 icons + star | `cw` |
| `56128a` | Choosing Sides | Side Scheme | Standard PVP | - | not recorded in this source | `cw` |
| `56128b` | Now It's Personal | Obligation | Standard PVP | - | not recorded in this source | `cw` |
| `56129` | The Futurist | Event | Iron Man | - | - | `cw` |
| `56130` | Target Lock | Event | Iron Man | - | - | `cw` |
| `56131` | High-Tech Suit | Upgrade | Iron Man | - | - | `cw` |
| `56132` | Suit Up | Resource | Iron Man | - | - | `cw` |
| `56133` | Provoked Response | Upgrade | Captain Marvel | - | - | `cw` |
| `56134` | You Started This | Event | Captain Marvel | - | - | `cw` |
| `56135` | Alpha Flight Recruit | Upgrade | Captain Marvel | - | - | `cw` |
| `56136` | Raw Power | Resource | Captain Marvel | - | - | `cw` |
| `56137` | Captain America | Leader | Captain America | SCH:1 ATK:2 HP:14 | not recorded in this source | `cw` |
| `56138` | Captain America | Leader | Captain America | SCH:2 ATK:2 HP:18 | not recorded in this source | `cw` |
| `56139` | Captain America | Leader | Captain America | SCH:2 ATK:2 HP:18 | not recorded in this source | `cw` |
| `56140` | Captain America | Leader | Captain America | SCH:2 ATK:3 HP:22 | not recorded in this source | `cw` |
| `56141a` | Superhero Resistance | Main Scheme | Resistance | - | - | `cw` |
| `56141b` | Gathering Support | Main Scheme | Resistance | - | - | `cw` |
| `56142a` | Resistance Tactics | Main Scheme | Resistance | - | - | `cw` |
| `56142b` | Secret Avengers | Main Scheme | Resistance | - | - | `cw` |
| `56143` | Cap's Shield | Attachment | Captain America | - | not recorded in this source | `cw` |
| `56144` | Cap's Helmet | Attachment | Captain America | SCH:1 | 0 icons + star | `cw` |
| `56145` | Super-Soldier Serum | Attachment | Captain America | ATK:2 | 0 icons + star | `cw` |
| `56146` | Shield Block | Treachery | Captain America | - | 3 icons | `cw` |
| `56147` | Shield Toss | Treachery | Captain America | - | 2 icons | `cw` |
| `56148` | Heroic Strike | Treachery | Captain America | - | 1 icon | `cw` |
| `56149` | Fearless Determination | Side Scheme | Captain America | - | 3 icons | `cw` |
| `56150` | Falcon | Minion | New Avengers | SCH:2 ATK:2 HP:3 | 0 icons + star | `cw` |
| `56151` | Hercules | Minion | New Avengers | SCH:1 ATK:3 HP:4 | 0 icons + star | `cw` |
| `56152` | Goliath | Minion | New Avengers | SCH:1 ATK:2 HP:5 | 0 icons + star | `cw` |
| `56153` | Freedom Fighters | Treachery | New Avengers | - | 0 icons + star | `cw` |
| `56154` | New Avengers | Side Scheme | New Avengers | - | 2 icons | `cw` |
| `56155` | Black Panther | Minion | Secret Avengers | SCH:2 ATK:2 HP:4 | 0 icons + star | `cw` |
| `56156` | Spectrum | Minion | Secret Avengers | SCH:2 ATK:2 HP:3 | 0 icons + star | `cw` |
| `56157` | Freedom Fighters | Treachery | Secret Avengers | - | 0 icons + star | `cw` |
| `56158` | Switching Sides | Treachery | Secret Avengers | - | 2 icons | `cw` |
| `56159` | Secret Avengers | Side Scheme | Secret Avengers | - | 2 icons | `cw` |
| `56160` | Namor | Minion | Namor | SCH:1 ATK:1 HP:6 | 3 icons | `cw` |
| `56161` | Neptune's Trident | Attachment | Namor | ATK:1 | 1 icon | `cw` |
| `56162` | Horn of Proteus | Attachment | Namor | SCH:1 | 1 icon | `cw` |
| `56163` | Imperius Rex! | Treachery | Namor | - | 1 icon + star | `cw` |
| `56164` | Ruler of Atlantis | Side Scheme | Namor | - | 2 icons | `cw` |
| `56165` | Atlantean Guard | Minion | Atlanteans | SCH:1 ATK:2 HP:3 | 1 icon | `cw` |
| `56166` | Atlanteans | Treachery | Atlanteans | - | 2 icons | `cw` |
| `56167` | Atlantis Attacks | Side Scheme | Atlanteans | - | 3 icons | `cw` |
| `56168` | Spider-Woman | Leader | Spider Woman | SCH:1 ATK:2 HP:13 | not recorded in this source | `cw` |
| `56169` | Spider-Woman | Leader | Spider Woman | SCH:2 ATK:2 HP:17 | not recorded in this source | `cw` |
| `56170` | Spider-Woman | Leader | Spider Woman | SCH:2 ATK:2 HP:17 | not recorded in this source | `cw` |
| `56171` | Spider-Woman | Leader | Spider Woman | SCH:2 ATK:3 HP:21 | not recorded in this source | `cw` |
| `56172a` | Superhero Resistance | Main Scheme | Resistance | - | - | `cw` |
| `56172b` | Open Rebellion | Main Scheme | Resistance | - | - | `cw` |
| `56173a` | Resistance Tactics | Main Scheme | Resistance | - | - | `cw` |
| `56173b` | Neighborhood Protectors | Main Scheme | Resistance | - | - | `cw` |
| `56174` | Finesse | Attachment | Spider Woman | - | not recorded in this source | `cw` |
| `56175` | Contaminant Immunity | Attachment | Spider Woman | SCH:1 | 0 icons + star | `cw` |
| `56176` | Pheromones | Treachery | Spider Woman | - | 0 icons + star | `cw` |
| `56177` | Venom Blast | Treachery | Spider Woman | - | 1 icon | `cw` |
| `56178` | Inconspicuous | Treachery | Spider Woman | - | 1 icon + star | `cw` |
| `56179` | Self-propelled Glide | Side Scheme | Spider Woman | - | 3 icons | `cw` |
| `56180` | Spider-Man | Minion | Spider-Man | SCH:2 ATK:2 HP:4 | 2 icons | `cw` |
| `56181` | Tangled Up | Attachment | Spider-Man | - | 0 icons + star | `cw` |
| `56182` | Spectacular! | Treachery | Spider-Man | - | 2 icons | `cw` |
| `56183` | Neighborhood Hero | Side Scheme | Spider-Man | - | 2 icons | `cw` |
| `56184` | Luke Cage | Minion | Defenders | SCH:1 ATK:2 HP:4 | 0 icons + star | `cw` |
| `56185` | Jessica Jones | Minion | Defenders | SCH:2 ATK:1 HP:3 | 0 icons + star | `cw` |
| `56186` | Protect the Innocent | Treachery | Defenders | - | 1 icon | `cw` |
| `56187` | Street Defenders | Treachery | Defenders | - | 2 icons | `cw` |
| `56188` | The Defenders | Side Scheme | Defenders | - | 3 icons | `cw` |
| `56189` | Daredevil | Minion | Hell's Kitchen | SCH:2 ATK:2 HP:3 | 0 icons + star | `cw` |
| `56190` | Iron Fist | Minion | Hell's Kitchen | SCH:1 ATK:3 HP:4 | 0 icons + star | `cw` |
| `56191` | Resistance Fighter | Attachment | Hell's Kitchen | SCH:1 ATK:1 | 0 icons + star | `cw` |
| `56192` | Street Defenders | Treachery | Hell's Kitchen | - | 2 icons | `cw` |
| `56193` | Defend Hell's Kitchen | Side Scheme | Hell's Kitchen | - | 2 icons | `cw` |
| `56194` | Cloak | Minion | Cloak & Dagger | SCH:2 ATK:1 HP:4 | 0 icons + star | `cw` |
| `56195` | Dagger | Minion | Cloak & Dagger | SCH:1 ATK:2 HP:3 | 0 icons + star | `cw` |
| `56196` | Darkforce | Attachment | Cloak & Dagger | SCH:1 | 1 icon | `cw` |
| `56197` | Lightforce | Treachery | Cloak & Dagger | - | 2 icons | `cw` |
| `56198` | Cloak and Dagger | Side Scheme | Cloak & Dagger | - | 3 icons | `cw` |
| `56199a` | Superhero Resistance | Main Scheme | Resistance | - | - | `cw` |
| `56199b` | Rallying Call | Main Scheme | Resistance | - | - | `cw` |
| `56200a` | Superhero Resistance | Main Scheme | Resistance | - | - | `cw` |
| `56200b` | Going Underground | Main Scheme | Resistance | - | - | `cw` |
| `56201a` | Resistance Tactics | Main Scheme | Resistance | - | - | `cw` |
| `56201b` | Guerilla Warfare | Main Scheme | Resistance | - | - | `cw` |
| `56202a` | Resistance Tactics | Main Scheme | Resistance | - | - | `cw` |
| `56202b` | Superhero Jailbreak | Main Scheme | Resistance | - | - | `cw` |
| `56203` | Righteous Cause | Treachery | Standard PVP | - | not recorded in this source | `cw` |
| `56204` | Whatever It Takes | Treachery | Standard PVP | - | not recorded in this source | `cw` |
| `56205` | Targeted Strike | Treachery | Standard PVP | - | 0 icons + star | `cw` |
| `56206a` | Choosing Sides | Side Scheme | Standard PVP | - | not recorded in this source | `cw` |
| `56206b` | Now It's Personal | Obligation | Standard PVP | - | not recorded in this source | `cw` |
| `56207` | No, You Move! | Upgrade | Captain America | - | - | `cw` |
| `56208` | Fighting Dirty | Event | Captain America | - | - | `cw` |
| `56209` | Recruited by Cap | Event | Captain America | - | - | `cw` |
| `56210` | The People's Hero | Resource | Captain America | - | - | `cw` |
| `56211` | Double Agent | Event | Spider Woman | - | - | `cw` |
| `56212` | Spider-Blast | Event | Spider Woman | - | - | `cw` |
| `56213` | Hard to Hit | Upgrade | Spider Woman | - | - | `cw` |
| `56214` | Secret Contact | Resource | Spider Woman | - | - | `cw` |

---

## Pack: Civil War (`cw`)

### Set: Tigra

### [56001a] Tigra
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 3, **HP**: 10, **Hand Size**: 5
- **Traits**: *Avenger.*
- **Rules Text**:
  > Each minion with a copy of Hunted attached loses guard.
  > *On the Hunt* — **Response**: After the player phase begins, draw 1 card for each minion engaged with you (to a maximum of 3).
- **Image Asset**: `assets/card-art/bundles/cards/56001a.png` (300×426 px, 255.0 KB)

### [56001b] Greer Nelson
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 10, **Hand Size**: 6
- **Traits**: *Police.*
- **Rules Text**:
  > *Undercover Work* — **Action**: Search your deck and discard pile for a copy of Hunted and add it to your hand. (Limit once per round.)
- **Flavor**: *"You don't have to be an Avenger to protect others."*
- **Image Asset**: `assets/card-art/bundles/cards/56001b.png` (300×426 px, 241.4 KB)

### [56002] Moon Knight — *Marc Spector*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Forced Response**: After Moon Knight enters play, search the encounter deck and discard pile for a minion and put it into play engaged with you. Stun and confuse that minion.
- **Flavor**: *"Hey, Greer, look what I found!"*
- **Image Asset**: `assets/card-art/bundles/cards/56002.png` (710×1030 px, 317.6 KB)

### [56003] Precinct HQ
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Precinct HQ → remove 1 threat from a scheme. Remove 1 additional threat for each minion engaged with you.
- **Flavor**: *"Save your threats, mister. My friends are a lot scarier than yours." —Greer Nelson*
- **Image Asset**: `assets/card-art/bundles/cards/56003.jpg` (710×1030 px, 339.6 KB)

### [56004] Cat's Head Amulet
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (3/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Artifact. Item.*
- **Rules Text**:
  > **Resource**: Exhaust Cat's Head Amulet → generate a [physical] resource for each minion engaged with you (to a maximum of [physical] [physical] [physical]).
- **Flavor**: *Tigra's amulet allows her to change between her feline and human forms.*
- **Image Asset**: `assets/card-art/bundles/cards/56004.png` (710×1030 px, 332.0 KB)

### [56005] Sharp Claws
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (4–5/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Weapon.*
- **Rules Text**:
  > **Interrupt**: When you make a basic attack, exhaust Sharp Claws → Tigra gets +1 ATK for this attack. Choose:
  > • This attack gains overkill.
  > • This attack gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/56005.jpg` (710×1030 px, 283.9 KB)

### [56006] Cat-Like Reflexes
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (6–7/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When you would take any amount of damage, discard Cat-Like Reflexes → prevent 3 of that damage. You may confuse a minion engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/56006.jpg` (710×1030 px, 327.0 KB)

### [56007] Hunted
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (8–10/15, Qty: 3)
- **Stats**: **Cost**: 0 [star], **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > [star] As an additional cost to play this upgrade, search the encounter deck and discard pile for a minion and put it into play engaged with you. Attach Hunted to that minion and stun it.
  > **Interrupt**: When attached minion is defeated, ready Tigra.
- **Image Asset**: `assets/card-art/bundles/cards/56007.png` (710×1030 px, 322.6 KB)

### [56008] Tooth and Claw
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (11–13/15, Qty: 3)
- **Stats**: **Cost**: 4, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > Reduce the cost to play this event by 1 for each minion engaged with you.
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. Deal 4 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/56008.png` (710×1030 px, 249.2 KB)

### [56009] Feline Senses
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (14–15/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 3 threat from a scheme. If this removes the last threat from that scheme, stun a minion.
- **Flavor**: *"It's just instinct. This cat's got to hunt." —Tigra*
- **Image Asset**: `assets/card-art/bundles/cards/56009.jpg` (710×1030 px, 317.7 KB)

### [56023] In Too Deep
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tigra Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Greer Nelson player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Greer Nelson → remove In Too Deep from the game.
  > • Each minion engage3d with you activates against you. If no minions activate this way, In Too Deep gains surge. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56023.png` (710×1030 px, 242.9 KB)


### Set: Aggression

### [56010] Two-Gun Kid — *Matthew Hawk*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 10
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Avenger.*
- **Rules Text**:
  > [star] **Interrupt**: When Two-Gun Kid makes a basic attack, choose 2 enemies instead of 1 and resolve this attack against each of them.
- **Flavor**: *"Alright fellas, say when."*
- **Image Asset**: `assets/card-art/bundles/cards/56010.png` (710×1030 px, 288.0 KB)

### [56011] Spider-Girl — *Anya Corazon*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After you play Spider-Girl from your hand, stun and confuse a minion.
- **Flavor**: *"Alright you bunch of losers. Who wants a piece of me?."*

### [56012] Air Cover
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 12
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Tech.*
- **Rules Text**:
  > Uses (2 fuel counters). Max 1 per player.
  > **Response**: After a minion enters play, exhaust this card and remove 1 fuel counter from it → search your deck and discard pile for a [[Tactic]] upgrade that can be attached to that minion and add it to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/56012.jpg` (710×1030 px, 331.2 KB)

### [56013] Aggressive Conditioning
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > You get +3 hit points and your hero gets +1 ATK.
- **Image Asset**: `assets/card-art/bundles/cards/56013.png` (710×1030 px, 294.2 KB)

### [56014] Suppressing Fire
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > Attach to a minion. Max 1 per minion.
  > **Hero Interrupt**: When you attack and defeat attached minion, heal 2 damage from your hero.
- **Image Asset**: `assets/card-art/bundles/cards/56014.jpg` (710×1030 px, 260.1 KB)

### [56015] "Bring It!"
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > Max 1 per phase.
  > **Hero Action**: Draw 1 card for each minion engaged with you.
- **Flavor**: *"You picked the wrong day, pal!" —Rocket Raccoon*

### [56016] Coup de Grâce
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Defeat a non-[[Elite]] minion with an upgrade attached. Ignore any "**When Defeated**" abilities on that minion.
- **Flavor**: *"I'm putting an end to this – right now!" —Black Knight*
- **Image Asset**: `assets/card-art/bundles/cards/56016.png` (710×1030 px, 320.9 KB)

### [56017] Savage Strike
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When you make a basic attack, you get +6 ATK for this attack. This attack gains piercing.
- **Flavor**: *KRACK!*
- **Image Asset**: `assets/card-art/bundles/cards/56017.jpg` (710×1030 px, 320.0 KB)

### [56018] Audacity
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, deal 1 damage to the villain.


### Set: Basic

### [56019] Yellow Jacket — *Hank Pym*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 2 (Consequential: 2), **HP**: 3, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > Play only if you have the [[Avenger]] trait.
  > **Response**: After Yellow Jacket enters play, search the top 5 cards of your deck for an upgrade and add it to your hand.
- **Flavor**: *"I know what I have to do."*
- **Image Asset**: `assets/card-art/bundles/cards/56019.png` (710×1030 px, 274.7 KB)

### [56020] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 20
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/56020.png` (710×1030 px, 286.2 KB)

### [56021] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/56021.jpg` (710×1030 px, 249.6 KB)

### [56022] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/56022.jpg` (710×1030 px, 377.6 KB)

### [56052] Iron Lad — *Nathaniel Richards*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 52
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 [star] (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > [star] **Interrupt**: When Iron Lad uses a basic power, exhaust another [[Avenger]] ally you control → add that ally's matching power to Iron Lad's power for this use.
- **Flavor**: *"We became Young Avengers for a reason."*
- **Image Asset**: `assets/card-art/bundles/cards/56052.png` (710×1030 px, 330.0 KB)

### [56053] Assess the Situation
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 53
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Action:** You get +1 hand size until the end of the phase.
- **Flavor**: *"Well, if I run, that's not cool. And if I stay and get tasered, that's not cool either. I'm in a bit of a pickle." —Tony Stark*


### Set: Tigra Nemesis

### [56024] The Hood
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tigra Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Steady. Villainous.
  > [star] **Forced Response**: After The Hood attacks, place 1 threat on the Criminal Underworld side scheme.
  > *(Tigra's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/56024.jpg` (710×1030 px, 288.4 KB)

### [56025] Criminal Underworld
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra Nemesis (2/5)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tigra Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Each [[Criminal]] minion cannot take damage.
- **Flavor**: *The Hood has gathered the disparate elements of the criminal underworld together in one unified gang.*
- **Image Asset**: `assets/card-art/bundles/cards/56025.png` (1030×710 px, 290.0 KB)

### [56026] The Hood's Mantle
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra Nemesis (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Tigra Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to The Hood. Otherwise, attach to the villain.
  > **Hero Response**: After you make a basic attack against attached enemy, spend [energy] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach to The Hood. Otherwise, attach to the villain.
- **Image Asset**: `assets/card-art/bundles/cards/56026.png` (710×1030 px, 241.2 KB)

### [56027] Madame Masque
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra Nemesis (4/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Tigra Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > **When Revealed**: Place 2 threat on the Criminal Underwold side scheme. Otherwise, find Criminal Underworld and reveal it.
  >
  > ---
  >
  > [star] **Boost**: Place 2 threat on the Criminal Underworld side scheme. Otherwise, this card gains [boost][boost].
- **Image Asset**: `assets/card-art/bundles/cards/56027.jpg` (710×1030 px, 311.3 KB)

### [56028] Jigsaw
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Tigra Nemesis (5/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Tigra Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Criminal.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Response**: After Jigsaw attacks and damages a character, place 2 threat on the Criminal Underworld side scheme.
- **Flavor**: *"Bad kitty!"*
- **Image Asset**: `assets/card-art/bundles/cards/56028.jpg` (710×1030 px, 304.0 KB)


### Set: Hulkling

### [56029a] Hulkling
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 1, **DEF**: 1, **HP**: 13, **Hand Size**: 5
- **Traits**: *Avenger. Kree. Skrull.*
- **Rules Text**:
  > *Chosen Shape* — **Forced Response**: After a [[Shapeshift]] upgrade enters play under your control, discard each other [[Shapeshift]] upgrade you control and ready Hulkling.
- **Image Asset**: `assets/card-art/bundles/cards/56029a.png` (300×426 px, 266.8 KB)

### [56029b] Teddy Altman
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 13, **Hand Size**: 5
- **Traits**: *Kree. Skrull.*
- **Rules Text**:
  > You cannot have more than 1 [[Shapeshift]] upgrade in play.
  > *Shape-Changer* — **Action**: Search your deck and discard pile for a [[Shapeshift]] upgrade and add it to your hand. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/56029b.png` (300×426 px, 236.0 KB)

### [56030] Wiccan — *William Kaplan*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Avenger. Mystic.*
- **Rules Text**:
  > **Response**: After you play Wiccan from your hand, search your deck and discard pile for an identity-specific event and add it to your hand. *(Shuffle.)*
- **Flavor**: *"Hang on, Teddy! I got your back!"*
- **Image Asset**: `assets/card-art/bundles/cards/56030.jpg` (710×1030 px, 337.8 KB)

### [56031] Altman Residence
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Altman Residence → heal 2 damage from Teddy Altman and shuffle 1 Hulkling card from your discard pile into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/56031.png` (710×1030 px, 350.0 KB)

### [56032] Winged Shape
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (3/15)
- **Stats**: **Cost**: 2, **Resources**: [energy] [mental]
- **Traits**: *Shapeshift.*
- **Rules Text**:
  > Hulkling gets +1 THW, +1 ATK, +1 DEF, and gains the [[Aerial]] trait.
  > **Hero Response**: After you play an event, exhaust Winged Shape → remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/56032.png` (710×1030 px, 368.0 KB)

### [56033] Hulk Shape
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (4/15)
- **Stats**: **Cost**: 2, **Resources**: [physical] [physical]
- **Traits**: *Shapeshift.*
- **Rules Text**:
  > Hulkling gets +2 ATK and +1 DEF.
  > **Hero Response**: After you play an event, exhaust Hulk Shape → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/56033.jpg` (710×1030 px, 301.1 KB)

### [56034] Armored Shape
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (5/15)
- **Stats**: **Cost**: 2, **Resources**: [energy] [physical]
- **Traits**: *Shapeshift.*
- **Rules Text**:
  > Hulkling gets +1 ATK, +2 DEF, and gains retaliate 1.
  > **Hero Response**: After you play an event, exhaust Armored Shape → heal 2 damage from Hulkling.
- **Image Asset**: `assets/card-art/bundles/cards/56034.png` (710×1030 px, 366.8 KB)

### [56035] Imitation Shape
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (6/15)
- **Stats**: **Cost**: 2, **Resources**: [mental] [mental]
- **Traits**: *Shapeshift.*
- **Rules Text**:
  > Hulkling gets +2 THW.
  > **Forced Interrupt**: When an enemy would attack you, it schemes instead.
  > **Hero Response**: After you play an event, exhaust Imitation Shape → draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/56035.jpg` (710×1030 px, 342.5 KB)

### [56036] Alien Physiology
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (7/15)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Resource**: Exhaust Alien Physiology → generate a [wild] resource ([wild] [wild] resources instead if paying for a Hulkling card).
- **Flavor**: *"When I first discovered my powers, I thought I was a mutant. But it turns out I'm an alien!"*
- **Image Asset**: `assets/card-art/bundles/cards/56036.jpg` (710×1030 px, 354.2 KB)

### [56037] Shapeshifter Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (8–10/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 5 damage to an enemy. Ready your [[Shapeshift]] upgrade.
- **Flavor**: *"You don't touch my friends!" —Hulkling*
- **Image Asset**: `assets/card-art/bundles/cards/56037.png` (710×1030 px, 302.5 KB)

### [56038] Armored Defense
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (11–12/15, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Defense. Superpower.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When an enemy attacks, deal damage to it equal to your DEF. After this attack, give Hulkling a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/56038.png` (710×1030 px, 347.5 KB)

### [56039] Impersonation
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (13–14/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 4 threat from a scheme. If this removes the last threat from that scheme, you may change to alter-ego form.
- **Flavor**: *"I'm the Young Avengers' resident shape-changer." —Hulkling*
- **Image Asset**: `assets/card-art/bundles/cards/56039.jpg` (710×1030 px, 344.8 KB)

### [56040] Shapeshifter
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (15/15)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Search your deck and discard pile for a [[Shapeshift]] upgrade and add it to your hand. *(Shuffle.)*
- **Flavor**: *"Didn't see that coming, did you?" —Hulkling*
- **Image Asset**: `assets/card-art/bundles/cards/56040.png` (710×1030 px, 284.1 KB)

### [56054] Complicated Lineage
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hulkling Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Teddy Altman player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Teddy Altman → remove Complicated Lineage from the game.
  > • Discard each [[Shapeshift]] upgrade you control. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56054.png` (710×1030 px, 328.6 KB)


### Set: Protection

### [56041] Patriot — *Elijah Bradley*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 41
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Response**: After you engage a minion, give Patriot a tough status card.
- **Flavor**: *"I'm ready for anything."*
- **Image Asset**: `assets/card-art/bundles/cards/56041.jpg` (710×1030 px, 235.8 KB)

### [56042] Brother Voodoo — *Jericho Drumm*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 42
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 2), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Avenger. Mystic.*
- **Rules Text**:
  > **Response**: After Brother Voodoo enters play, search the top 5 cards of your deck for an event card and add it to your hand. Shuffle your deck.
- **Flavor**: *"My name is Jericho Drumm. They call me Brother Voodoo."*

### [56043] Hidden Base
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 43
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Location.*
- **Rules Text**:
  > Uses (3 stronghold counters).
  > **Alter-Ego Response**: After you change form, exhaust Hidden Base and remove 1 stronghold counter from it → give your identity a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/56043.png` (710×1030 px, 342.9 KB)

### [56044] The Night Nurse
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 44
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Persona.*
- **Rules Text**:
  > Uses (3 medical counters).
  > **Action**: Exhaust The Night Nurse and remove 1 medical counter from her → heal 1 damage from a hero and discard 1 status card from it.

### [56045] Excelsior
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 45
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Kree. Skrull. Weapon.*
- **Rules Text**:
  > Restricted. *(Max 2 restricted cards per player.)*
  > **Response**: After your hero defends against an enemy attack, spend a [energy] resource → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/56045.png` (710×1030 px, 334.1 KB)

### [56046] Defensive Conditioning
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 46
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > You get +3 hit points and your hero gets +1 DEF.
- **Image Asset**: `assets/card-art/bundles/cards/56046.png` (710×1030 px, 328.2 KB)

### [56047] "I Can Do This All Day"
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 47
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When an enemy attacks, declare your hero as the defender without exhausting them.
- **Image Asset**: `assets/card-art/bundles/cards/56047.jpg` (710×1030 px, 348.4 KB)

### [56048] Taunt
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 48
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: The villain attacks you. Other characters cannot defend against this attack. Draw 3 cards.
- **Flavor**: *"Is that all you got?" —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/56048.jpg` (710×1030 px, 264.9 KB)

### [56049] Tackle
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 49
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Stun an enemy. If you paid for this card using a [physical] resource, deal 3 damage to that enemy.
- **Flavor**: *That's gonna hurt in the morning.*

### [56050] Cuts Both Ways
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When an enemy attacks, you gain retaliate 1 until the end of the phase.
- **Flavor**: *"Two can play that game!" —Wiccan*
- **Image Asset**: `assets/card-art/bundles/cards/56050.jpg` (710×1030 px, 276.0 KB)

### [56051] Preservation
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 1 per deck.
  > **Hero Response**: After you spend this card, heal 1 damage from your hero.


### Set: Hulkling Nemesis

### [56055] Super Skrull
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hulkling Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Skrull.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Super Skrull attacks you, discard the top card of your deck. If that card's printed resource has:
  > [energy] – Super Skrull gets +2 ATK for this attack.
  > [mental] – Discard 1 card from your hand.
  > [physical] – Give Super Skrull a tough status card.
  > [wild] – Discard an upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/56055.jpg` (710×1030 px, 287.7 KB)

### [56056] Skrull Business
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling Nemesis (2/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hulkling Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Response**: After any number of cards are discarded from the top of a player's deck, place those cards facedown under this scheme.
- **Flavor**: *Super Skrull was sent to abduct Hulkling after his true heritage was revealed.*
- **Image Asset**: `assets/card-art/bundles/cards/56056.jpg` (1030×710 px, 342.2 KB)

### [56057] Fantastic Powers
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling Nemesis (3/5)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hulkling Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attached minion gets +3 hit points and gains retaliate 1.
  > **When Revealed**: Find Super Skrull. Put him into play engaged with you and attach Fantastic Powers to him. If you are in hero form, Super Skrull attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/56057.png` (710×1030 px, 341.9 KB)

### [56058] You're Coming With Me!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hulkling Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hulkling Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard the top 3 cards of your deck. Place 1 threat on the main scheme for each different resource icon on the discarded cards.
  > **When Revealed (Hero)**: Discard the top 3 cards of your deck. Take 1 damage for each different resource icon on the discarded cards *([energy], [mental], [physical], or [wild])*.
- **Image Asset**: `assets/card-art/bundles/cards/56058.png` (710×1030 px, 292.4 KB)


### Set: Iron Man

### [56059] Iron Man
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1 [star], **ATK**: 1, **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > [star] Iron Man gets +1 SCH for each [[Tech]] attachment on him (to a maximum of +3 SCH).
  > **Setup**: The enemy team searches the encounter deck for an Iron Man attachment and your team reveals it.
- **Image Asset**: `assets/card-art/bundles/cards/56059.jpg` (710×1030 px, 306.0 KB)

### [56060] Iron Man
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 1 [star], **ATK**: 2, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Steady.
  > [star] Iron Man gets +1 SCH for each [[Tech]] attachment on him (to a maximum of +3 SCH).
  > **When Revealed**: Deal each player an encounter card. Iron Man cannot take damage this phase.
- **Image Asset**: `assets/card-art/bundles/cards/56060.jpg` (710×1030 px, 302.3 KB)

### [56061] Iron Man
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 1 [star], **ATK**: 2, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > [star] Iron Man gets +1 SCH for each [[Tech]] attachment on him (to a maximum of +3 SCH).
  > **When Revealed**: The enemy team searches the encounter deck for an Iron Man attachment and your team reveals it.
- **Image Asset**: `assets/card-art/bundles/cards/56061.png` (710×1030 px, 275.3 KB)

### [56062] Iron Man
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (4/14)
- **Properties**: Unique, Stage IV
- **Stats**: **SCH**: 1 [star], **ATK**: 3, **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Steady.
  > [star] Iron Man gets +1 SCH for each [[Tech]] attachment on him (to a maximum of +3 SCH).
  > **When Revealed**: Deal each player an encounter card. Iron Man cannot take damage this phase.
- **Image Asset**: `assets/card-art/bundles/cards/56062.png` (710×1030 px, 322.0 KB)

### [56065] Powered Gauntlets
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (5/14)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to Iron Man.
  > [star] Iron Man's attacks gain ranged.
  > **Hero Response**: After you make a basic attack against Iron Man, spend [energy] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/56065.jpg` (710×1030 px, 300.4 KB)

### [56066] Rocket Boots
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (6/14)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to Iron Man.
  > Iron Man gains the [[Aerial]] trait.
  > **Hero Response**: After you make a basic attack against Iron Man, spend [energy] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/56066.jpg` (710×1030 px, 313.8 KB)

### [56067] Mark V Helmet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (7/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to Iron Man and give him a tough status card.
  > Iron Man gains stalwart.
  > **Hero Response**: After you make a basic attack against Iron Man, spend [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56067.png` (710×1030 px, 294.8 KB)

### [56068] Arc Reactor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (8/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to Iron Man and give him a tough status card.
  > Iron Man gains retaliate 1.
  > **Hero Response**: After you make a basic attack against Iron Man, spend [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56068.png` (710×1030 px, 286.5 KB)

### [56069] Mark V Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (9/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to Iron Man.
  > **Forced Response**: When Iron Man would take any amount of damage, place it here instead. Then, if there is at least 5 damage here, discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/56069.jpg` (710×1030 px, 329.0 KB)

### [56070] Repulsor Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (10–11/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard an upgrade or support you control.
  > **When Revealed (Hero)**: Discard the top 4 cards of your deck. For each printed [energy] and [wild] resource discarded this way, deal 1 damage to your hero.
- **Image Asset**: `assets/card-art/bundles/cards/56070.png` (710×1030 px, 320.0 KB)

### [56071] Supersonic Punch
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (12–13/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Iron Man schemes. If he has a [[Tech]] attachment, you are confused.
  > **When Revealed (Hero)**: Iron Man attacks you. If he has a [[Tech]] attachment, this attack gains piercing.
- **Flavor**: *"That's it. Now I'm mad!" —Iron Man*
- **Image Asset**: `assets/card-art/bundles/cards/56071.jpg` (710×1030 px, 337.7 KB)

### [56072] Stark Tower
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (14/14)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Iron Man Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: The enemy team searches the encounter deck and discard pile for an Iron Man attachment and your team reveals it.
- **Flavor**: *Iron Man's vast wealth gives his Avengers a significant advantage over Captain America's outlaws.*
- **Image Asset**: `assets/card-art/bundles/cards/56072.jpg` (1030×710 px, 330.1 KB)

### [56129] The Futurist
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (Set Card, unnumbered)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Your Iron Man leader schemes. Do not give him a boost card for this activation.
- **Flavor**: *"Steve's thinking is stuck in the past. This is the future, whether he likes it or not." —Iron Man*
- **Image Asset**: `assets/card-art/bundles/cards/56129.jpg` (710×1030 px, 300.4 KB)

### [56130] Target Lock
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (Set Card, unnumbered)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Your Iron Man leader attacks the enemy leader. If you spent a [mental] resource to pay for this event, choose an attachment on the enemy leader with the text "**Hero Response**" or "**Hero Interrupt**" and discard it.
- **Image Asset**: `assets/card-art/bundles/cards/56130.png` (710×1030 px, 280.9 KB)

### [56131] High-Tech Suit
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (Set Card, unnumbered)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Attach to your Iron Man leader. Counts as a [[Tech]] attachment.
  > **Hero Action**: Spend [energy] [mental] resources → discard this card. Any player may trigger this ability.
- **Image Asset**: `assets/card-art/bundles/cards/56131.jpg` (710×1030 px, 337.5 KB)

### [56132] Suit Up
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Iron Man (Set Card, unnumbered)
- **Stats**: **Resources**: [wild] [wild]
- **Rules Text**:
  > **Hero Response**: After you spend this resource, give your Iron Man leader a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/56132.jpg` (710×1030 px, 300.7 KB)


### Set: Registration

### [56063a] Superhero Registration Act
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/56063a.png` (419×289 px, 242.3 KB)

### [56063b] Cut Off Support
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (4/8)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > **Forced Interrupt**: When a player reveals a treachery, place 1 threat here. (Limit once per phase per player.)
- **Flavor**: *"Society will no longer tolerate superheroes who operate outside the law." —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/56063b.png` (419×289 px, 245.0 KB)

### [56064a] Pro-Registration Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Iron Man and his Avengers are ordered to apprehend any superpowered individuals who refuse to register with S.H.I.E.L.D. That includes former teammates such as Captain America and Spider-Woman.*
- **Image Asset**: `assets/card-art/bundles/cards/56064a.png` (419×289 px, 229.5 KB)

### [56064b] Negative Zone Prison
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (8/8)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 [star] per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] Reduce the target threat value of this scheme by 1 for each facedown card under it.
  > **Forced Response**: After an ally is defeated by an enemy attack, place that ally facedown under this scheme.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/56064b.png` (419×289 px, 246.3 KB)

### [56096a] Superhero Registration Act
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/56096a.png` (419×289 px, 241.4 KB)

### [56096b] S.H.I.E.L.D. Recruits
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (1/8)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > **When Revealed**: The enemy team searches the encounter deck for 1 [per_hero] minions and deals one to each player on your team as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/56096b.png` (419×289 px, 246.2 KB)

### [56097a] Pro-Registration Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Iron Man and his Avengers are ordered to apprehend any superpowered individuals who refuse to register with S.H.I.E.L.D. That includes former teammates such as Captain America and Spider-Woman.*
- **Image Asset**: `assets/card-art/bundles/cards/56097a.png` (419×289 px, 231.7 KB)

### [56097b] Hunting Rebel Heroes
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (6/8)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each hero gains the [[Unregistered]] trait.
  > **Forced Response**: After another card is revealed that gives 1 or more heroes the [[Unregistered]] trait, deal 2 damage to each of those heroes.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/56097b.png` (419×289 px, 247.5 KB)

### [56121a] Superhero Registration Act
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/56121a.png` (419×289 px, 242.3 KB)

### [56121b] Homeland Security
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (2/8)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > Each minion gains guard.
- **Flavor**: *With armed S.H.I.E.L.D. units patrolling the streets, crime rates have fallen to record lows.*
- **Image Asset**: `assets/card-art/bundles/cards/56121b.png` (419×289 px, 237.7 KB)

### [56122a] Superhero Registration Act
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/56122a.png` (419×289 px, 242.3 KB)

### [56122b] Public Outrage
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (3/8)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > [star] **Forced Response**: After resolving step 1 of the villain phase, each player discards the top 3 cards of their deck.
- **Flavor**: *"I can't believe Captain America has turned against his country!" —J. Jonah Jameson*
- **Image Asset**: `assets/card-art/bundles/cards/56122b.png` (419×289 px, 246.2 KB)

### [56123a] Pro-Registration Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Iron Man and his Avengers are ordered to apprehend any superpowered individuals who refuse to register with S.H.I.E.L.D. That includes former teammates such as Captain America and Spider-Woman.*
- **Image Asset**: `assets/card-art/bundles/cards/56123a.png` (419×289 px, 229.5 KB)

### [56123b] The Initiative
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (5/8)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy team searches the encounter deck and discard pile for 1 [per_hero] side schemes and deals one to each player on your team as a facedown encounter card.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *"Wait until they see our plans to protect the midwest." —Yellowjacket*
- **Image Asset**: `assets/card-art/bundles/cards/56123b.png` (419×289 px, 244.0 KB)

### [56124a] Pro-Registration Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Iron Man and his Avengers are ordered to apprehend any superpowered individuals who refuse to register with S.H.I.E.L.D. That includes former teammates such as Captain America and Spider-Woman.*
- **Image Asset**: `assets/card-art/bundles/cards/56124a.png` (419×289 px, 229.5 KB)

### [56124b] No Going Back
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Registration (7/8)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Registration Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Allies enter play exhausted.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *"There's no more amnesty for Cap and his renegades. It's gone too far!" —She-Hulk*
- **Image Asset**: `assets/card-art/bundles/cards/56124b.png` (419×289 px, 238.0 KB)


### Set: Mighty Avengers

### [56073] Yellow Jacket
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Mighty Avengers (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mighty Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Toughness.
  > **When Revealed**: Give the enemy leader a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Give the enemy leader a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/56073.png` (710×1030 px, 299.3 KB)

### [56074] Wasp
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Mighty Avengers (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mighty Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > Teamwork ([[Avenger]]).
  > **When Revealed**: Place 1 threat on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: Place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/56074.jpg` (710×1030 px, 337.9 KB)

### [56075] U.S. Agent
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Mighty Avengers (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mighty Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Retaliate 1. Toughness.
  > **When Revealed**: Deal 1 damage to your identity.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to your identity.
- **Image Asset**: `assets/card-art/bundles/cards/56075.png` (710×1030 px, 299.8 KB)

### [56076] Mighty Avengers
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Mighty Avengers (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mighty Avengers Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve the "**When Revealed**" ability of each minion in play. If no "**When Revealed**" abilities were resolved this way, this card gains surge.
- **Flavor**: *"Do us all a favor and stay down!" —Doc Samson*
- **Image Asset**: `assets/card-art/bundles/cards/56076.png` (710×1030 px, 339.4 KB)

### [56077] Earth's Mightiest Heroes
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Mighty Avengers (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mighty Avengers Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > Each [[Avenger]] minion gains the printed keywords of each other [[Avenger]] minion.
- **Flavor**: *"We've got you outnumbered and outgunned." —Iron Man*
- **Image Asset**: `assets/card-art/bundles/cards/56077.jpg` (1030×710 px, 292.6 KB)


### Set: The Initiative

### [56078] Doc Samson
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: The Initiative (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: The Initiative Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger. Gamma.*
- **Rules Text**:
  > Guard.
  > **When Revealed**: You are confused. If you were already confused, place 2 threat on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: You are confused.
- **Image Asset**: `assets/card-art/bundles/cards/56078.jpg` (710×1030 px, 338.5 KB)

### [56079] Hellcat
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: The Initiative (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: The Initiative Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Quickstrike.
  > **When Revealed**: You are stunned. If you were already stunned, take 2 indirect damage.
  >
  > ---
  >
  > [star] **Boost**: You are stunned.
- **Image Asset**: `assets/card-art/bundles/cards/56079.png` (710×1030 px, 322.1 KB)

### [56080] Drafted
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: The Initiative (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Initiative Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attached minion gets +2 hit points and gains the [[Avenger]] trait.
  > **When Revealed**: In competitive mode, the enemy team attaches Drafted to a minion engaged with them and that minion engages you. Otherwise, discard cards from the encounter deck until a minion is discarded. Reveal that minion and attach Drafted to it.
- **Image Asset**: `assets/card-art/bundles/cards/56080.png` (710×1030 px, 350.9 KB)

### [56081] Mighty Avengers
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: The Initiative (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Initiative Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve the "**When Revealed**" ability of each minion in play. If no "**When Revealed**" abilities were resolved this way, this card gains surge.
- **Flavor**: *"Do us all a favor and stay down!" —Doc Samson*
- **Image Asset**: `assets/card-art/bundles/cards/56081.jpg` (710×1030 px, 331.8 KB)

### [56082] The Fifty State Initiative
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: The Initiative (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Initiative Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: Shuffle each [[Avenger]] minion in the encounter discard pile into the encounter deck.
- **Flavor**: *S.H.I.E.L.D. wants each state to have its own government-sponsored super team.*
- **Image Asset**: `assets/card-art/bundles/cards/56082.jpg` (1030×710 px, 327.6 KB)


### Set: Maria Hill

### [56083] Maria Hill
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Maria Hill (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Maria Hill Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. S.H.I.E.L.D.*
- **Rules Text**:
  > Retaliate 2.
  > **When Revealed**: The enemy team searches the encounter deck and discard pile for a copy of Life Model Decoy and attaches it to Maria Hill.
- **Flavor**: *"It's S.H.I.E.L.D.'s mission to protect the world!"*
- **Image Asset**: `assets/card-art/bundles/cards/56083.png` (710×1030 px, 298.5 KB)

### [56084] Life Model Decoy
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Maria Hill (2–3/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Maria Hill Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > The enemy team attaches this card to a minion or their leader. (Limit 1 per character.)
  > Attached character gains stalwart.
  > **Forced Interrupt**: When attached character would take any amount of damage from an attack, prevent that damage and discard this card instead.
- **Image Asset**: `assets/card-art/bundles/cards/56084.jpg` (710×1030 px, 351.1 KB)

### [56085] Executive Order
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Maria Hill (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Maria Hill Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 2 threat on each scheme. If Maria Hill is in play, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If Maria Hill is in play, this card gains [boost][boost][boost].
- **Flavor**: *"Stand down, Captain. You are NOT in command here!" —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/56085.png` (710×1030 px, 291.4 KB)

### [56086] S.H.I.E.L.D. Helicarrier
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Maria Hill (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Maria Hill Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: The player who defeated this scheme deals 1 damager to each character they control and each minion engaged with them.
- **Flavor**: *S.H.I.E.L.D. exerts influence across the world by deploying its helicarriers.*
- **Image Asset**: `assets/card-art/bundles/cards/56086.png` (1030×710 px, 346.0 KB)


### Set: Dangerous Recruits

### [56087] Venom
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Dangerous Recruits (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dangerous Recruits Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > [star] Venom's attacks gain piercing.
  > **When Revealed**: Venom attacks your leader. Otherwise, Venom activates against you.
- **Flavor**: *"Just a bite! We won't kill them!"*
- **Image Asset**: `assets/card-art/bundles/cards/56087.jpg` (710×1030 px, 302.4 KB)

### [56088] Bullseye
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Dangerous Recruits (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dangerous Recruits Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > **When Revealed**: The enemy team discards an attachment from your leader. Otherwise, discard an upgrade you control.
- **Flavor**: *"This is too rich: I'm working for S.H.I.E.L.D. and Daredevil's the outlaw!"*
- **Image Asset**: `assets/card-art/bundles/cards/56088.jpg` (710×1030 px, 331.5 KB)

### [56089] Justice Like Lightning
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Dangerous Recruits (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dangerous Recruits Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each minion activates against the player it is engaged with. Otherwise, the enemy leader activates against you. Do not give it a boost card for this activation.
- **Flavor**: *"We're all guilty. This is justice!" —Penance*
- **Image Asset**: `assets/card-art/bundles/cards/56089.png` (710×1030 px, 336.3 KB)

### [56090] Excessive Force
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Dangerous Recruits (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Dangerous Recruits Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 1 threat on the main scheme for each minion in play. Otherwise, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: The enemy leader attacks your leader *(after this activation)*. Do not give it a boost card for that attack.
- **Image Asset**: `assets/card-art/bundles/cards/56090.jpg` (710×1030 px, 324.9 KB)

### [56091] Dangerous Recruits
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Dangerous Recruits (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Dangerous Recruits Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **Forced Interrupt**: When a minion is defeated, give it to the enemy leader as a facedown boost card.
- **Flavor**: *"They've all been fitted with explosive implants to ensure their compliance." —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/56091.png` (1030×710 px, 299.0 KB)


### Set: Captain Marvel

### [56092] Captain Marvel
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Setup**: The enemy team finds Energy Channel and attaches it to Captain Marvel.
  > **Forced Response**: After Captain Marvel attacks and defeats a character, place 1 energy counter on Energy Channel.
- **Image Asset**: `assets/card-art/bundles/cards/56092.png` (710×1030 px, 307.7 KB)

### [56093] Captain Marvel
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. Captain Marvel cannot take damage this phase.
  > **Forced Response**: After Captain Marvel attacks and defeats a character, place 1 energy counter on Energy Channel.
- **Image Asset**: `assets/card-art/bundles/cards/56093.jpg` (710×1030 px, 316.5 KB)

### [56094] Captain Marvel
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > **Setup**: The enemy team finds Energy Channel and attaches it to Captain Marvel.
  > **Forced Response**: After Captain Marvel attacks and defeats a character, place 1 energy counter on Energy Channel.
- **Image Asset**: `assets/card-art/bundles/cards/56094.png` (710×1030 px, 313.3 KB)

### [56095] Captain Marvel
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (4/14)
- **Properties**: Unique, Stage IV
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. Captain Marvel cannot take damage this phase.
  > **Forced Response**: After Captain Marvel attacks and defeats a character, place 1 energy counter on Energy Channel.
- **Image Asset**: `assets/card-art/bundles/cards/56095.jpg` (710×1030 px, 312.6 KB)

### [56098] Energy Channel
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (5/14)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Permanent.
  > **Forced Response**: After a leader, hero, or ally attacks Captain Marvel, place 1 energy counter here. Then, if there are at least 4 energy counters here, remove all of them → Captain Marvel attacks that character. This attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/56098.png` (710×1030 px, 332.4 KB)

### [56099] Captain Marvel's Helmet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (6/14)
- **Properties**: Unique
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Tech.*
- **Rules Text**:
  > Attach to Captain Marvel.
  > Captain Marvel gains stalwart.
  > **Hero Response**: After you make a basic attack against Captain Marvel, spend 3 resources of the same type → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/56099.jpg` (710×1030 px, 330.9 KB)

### [56100] Cosmic Flight
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (7–8/14, Qty: 2)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to Captain Marvel.
  > **Forced Interrupt**: When Captain Marvel would take more than 3 damage from an attack, reduce that amount to 3. Then, discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/56100.png` (710×1030 px, 307.8 KB)

### [56101] Photonic Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (9–10/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard an ally or support you control.
  > **When Revealed (Hero)**: Captain Marvel attacks you. Place 1 energy counter on Energy Channel.
- **Image Asset**: `assets/card-art/bundles/cards/56101.jpg` (710×1030 px, 304.8 KB)

### [56102] Crisis Interdiction
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (11–12/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Captain Marvel schemes. Place 1 energy counter on Energy Channel.
  > **When Revealed (Hero)**: Place 2 threat on each scheme.
- **Image Asset**: `assets/card-art/bundles/cards/56102.jpg` (710×1030 px, 327.8 KB)

### [56103] Energy Absorption
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (13/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 1 energy counter on Energy Channel. Heal 1 damage from Captain Marvel for each energy counter on Energy Channel.
  >
  > ---
  >
  > [star] **Boost**: Place 1 energy counter on Energy Channel.
- **Image Asset**: `assets/card-art/bundles/cards/56103.png` (710×1030 px, 307.1 KB)

### [56104] Alpha Flight Station
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (14/14)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain Marvel Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Defeated**: Place 3 energy counters on Energy Channel.
- **Flavor**: *"Keep your sensors locked on North America. I want to know the location of Cap's headquarters." —Captain Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/56104.jpg` (1030×710 px, 322.5 KB)

### [56133] Provoked Response
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (Set Card, unnumbered)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Rules Text**:
  > **Forced Interrupt**: When the enemy leader would attack you, it attacks your Captain Marvel leader instead. She cannot take more than 3 damage from this attack. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56133.png` (710×1030 px, 329.2 KB)

### [56134] You Started This
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (Set Card, unnumbered)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Your Captain Marvel leader attacks the enemy leader. If you spent a [energy] resource to pay for this event, confuse the enemy leader.
- **Flavor**: *"You should've known this was coming!" —Captain Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/56134.jpg` (710×1030 px, 351.0 KB)

### [56135] Alpha Flight Recruit
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (Set Card, unnumbered)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Traits**: *Title.*
- **Rules Text**:
  > Attach to an ally.
  > **Response**: After any number of energy counters are placed on your Captain Marvel leader's Energy Channel attachment, heal 1 damage from attached ally.
- **Image Asset**: `assets/card-art/bundles/cards/56135.png` (710×1030 px, 345.2 KB)

### [56136] Raw Power
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain Marvel (Set Card, unnumbered)
- **Stats**: **Resources**: [wild] [wild]
- **Rules Text**:
  > **Hero Response**: After you spend this resource, place 2 energy counters on your Captain Marvel leader's Energy Channel attachment.
- **Image Asset**: `assets/card-art/bundles/cards/56136.png` (710×1030 px, 381.6 KB)


### Set: Cape-Killer

### [56105] Cape-Killer
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Cape-Killer (1–2/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cape-Killer Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Quickstrike.
  > [star] **Forced Interrupt**: When Cape-Killer attacks an identity with the [[Unregistered]] trait, it gets +2 ATK for this attack.
- **Flavor**: *S.H.I.E.L.D. formed an elite unit to confront and capture renegade superheroes.*
- **Image Asset**: `assets/card-art/bundles/cards/56105.png` (710×1030 px, 328.1 KB)

### [56106] Unregistered Super
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Cape-Killer (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cape-Killer Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Your identity gains the [[Unregistered]] trait.
  > **Alter-Ego Action**: Discard an identity-specific card from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56106.png` (710×1030 px, 283.5 KB)

### [56107] Bring Them In
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Cape-Killer (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cape-Killer Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Exhaust each [[Unregistered]] identity. Otherwise, the enemy team searches the encounter deck and discard pile for a copy of Unregistered Super and deals it to you as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/56107.jpg` (710×1030 px, 253.7 KB)

### [56108] Arrest Order
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Cape-Killer (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cape-Killer Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: The defeating player deals the topmost [[S.H.I.E.L.D.]] minion in the encounter discard pile to themself as a facedown encounter card.
- **Flavor**: *"Look what happens when you break the law!" —S.H.I.E.L.D. Officer*
- **Image Asset**: `assets/card-art/bundles/cards/56108.jpg` (1030×710 px, 299.9 KB)


### Set: Martial Law

### [56109] S.H.I.E.L.D. Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Martial Law (1–3/5, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Martial Law Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > **When Revealed**: Put the topmost [[S.H.I.E.L.D.]] minion in the encounter discard pile into play engaged with you.
  >
  > ---
  >
  > [star] **Boost**: Put this minion into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/56109.png` (710×1030 px, 318.1 KB)

### [56110] Rapid Response
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Martial Law (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Martial Law Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard cards from the encounter deck until a minion is discarded. If you are in:
  > • Alter-ego form, place threat on the main scheme equal to that minion's SCH.
  > • Hero form, deal damage to your hero equal to that minion's ATK.
- **Image Asset**: `assets/card-art/bundles/cards/56110.jpg` (710×1030 px, 329.7 KB)

### [56111] S.H.I.E.L.D. Patrol
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Martial Law (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Martial Law Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > Each minion gains guard.
- **Flavor**: *"Stay alert. Cap's Avengers were last seen in this area." —S.H.I.E.L.D. Officer*
- **Image Asset**: `assets/card-art/bundles/cards/56111.png` (1030×710 px, 283.0 KB)


### Set: Heroes for Hire

### [56112] Colleen Wing
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Heroes for Hire (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heroes for Hire Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hero for Hire.*
- **Rules Text**:
  > **When Revealed**: Choose an ally you control (the enemy team chooses instead if you have the [[Unregistered]] trait). Discard that ally.
- **Flavor**: *"I don't like hunting down our friends, but it's better us than the Thunderbolts."*
- **Image Asset**: `assets/card-art/bundles/cards/56112.png` (710×1030 px, 331.1 KB)

### [56113] Shang-Chi
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Heroes for Hire (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heroes for Hire Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hero for Hire.*
- **Rules Text**:
  > **When Revealed**: Choose an upgrade you control (the enemy team chooses instead if you have the [[Unregistered]] trait). Discard that upgrade.
- **Flavor**: *"There is no shame in a righteous cause."*
- **Image Asset**: `assets/card-art/bundles/cards/56113.jpg` (710×1030 px, 322.1 KB)

### [56114] Unregistered Super
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Heroes for Hire (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heroes for Hire Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Your identity gains the [[Unregistered]] trait.
  > **Alter-Ego Action**: Discard an identity-specific card from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56114.png` (710×1030 px, 321.2 KB)

### [56115] Bounty Hunting
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Heroes for Hire (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heroes for Hire Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1 card from your hand (at random if you have the [[Unregistered]] trait). Place 1 threat on the main scheme for each resource icon on that card.
- **Flavor**: *"I'm glad you guys went rogue; it's gonna be a big payday for me." —Paladin*
- **Image Asset**: `assets/card-art/bundles/cards/56115.jpg` (710×1030 px, 324.2 KB)

### [56116] Heroes for Hire
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Heroes for Hire (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Heroes for Hire Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: The enemy team searches the encounter deck and discard pile for a copy of Unregistered Super and deals it to the defeating player as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/56116.jpg` (1030×710 px, 318.0 KB)


### Set: Paladin

### [56117] Paladin
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Paladin (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Paladin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Hero for Hire.*
- **Rules Text**:
  > Quickstrike. Toughness.
  > **When Revealed**: Discard 1 card from your hand (at random if you have the [[Unregistered]] trait).
- **Flavor**: *"I'm not in this for your political agenda. I'm in it for the money."*
- **Image Asset**: `assets/card-art/bundles/cards/56117.png` (710×1030 px, 309.6 KB)

### [56118] Paladin's Pistol
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Paladin (2–3/5, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Paladin Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attack to Paladin. Otherwise, attach to the enemy leader.
  > [star] **Forced Interrupt**: When attached character attacks, this attack gains ranged and overkill. Discard this card after this attack.
- **Image Asset**: `assets/card-art/bundles/cards/56118.png` (710×1030 px, 321.8 KB)

### [56119] Bounty Hunting
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Paladin (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Paladin Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard 1 card from your hand (at random if you have the [[Unregistered]] trait). Place 1 threat on the main scheme for each resource icon on that card.
- **Flavor**: *"I'm glad you guys went rogue; it's gonna be a big payday for me." —Paladin*
- **Image Asset**: `assets/card-art/bundles/cards/56119.jpg` (710×1030 px, 316.5 KB)

### [56120] Government Contractor
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Paladin (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Paladin Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > Each identity gains the [[Unregistered]] trait.
- **Flavor**: *When Captain America took his resistance underground, Iron Man contracted Paladin and the Heroes for Hire to track him down.*
- **Image Asset**: `assets/card-art/bundles/cards/56120.jpg` (1030×710 px, 317.2 KB)


### Set: Standard PVP

### [56125] Righteous Cause
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Standard PVP (1/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy leader schemes. If there is more than 1 player on your team, give the enemy leader an additional boost card for this activation.
- **Flavor**: *"I was a double agent for years. There's not much I won't do for a just cause." —Spider-Woman*
- **Image Asset**: `assets/card-art/bundles/cards/56125.jpg` (710×1030 px, 332.0 KB)

### [56126] Whatever It Takes
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Standard PVP (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The enemy leader attacks your leader.
  > **When Revealed (Hero)**: The enemy leader attacks you.
- **Flavor**: *"I'm on target. Commence attack." —Captain Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/56126.jpg` (710×1030 px, 313.5 KB)

### [56127] Targeted Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
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
- **Image Asset**: `assets/card-art/bundles/cards/56127.png` (710×1030 px, 334.8 KB)

### [56128a] Choosing Sides
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Standard PVP (5/5)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent.
  > The enemy leader cannot take more than 2 damage from each attack.
  > **Forced Response**: After the last threat is removed from here, the enemy team searches the top 5 cards of the encounter deck for 1 [per_hero] encounter cards and deals one to each player as a facedown encounter card. Flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/56128a.png` (419×289 px, 245.4 KB)

### [56128b] Now It's Personal
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Standard PVP (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the first player.***
  > **Action**: Remove this card from the game → each player on your team chooses 2 of your leader's set-aside player cards and adds them to their hand.

### [56203] Righteous Cause
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Standard PVP (1/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy leader schemes. If there is more than 1 player on your team, give the enemy leader an additional boost card for this activation.
- **Flavor**: *"I was a double agent for years. There's not much I won't do for a just cause." —Spider-Woman*
- **Image Asset**: `assets/card-art/bundles/cards/56203.jpg` (710×1030 px, 333.5 KB)

### [56204] Whatever It Takes
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Standard PVP (2/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: The enemy leader attacks your leader.
  > **When Revealed (Hero)**: The enemy leader attacks you.
- **Flavor**: *"I'm on target. Commence attack." —Captain Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/56204.png` (710×1030 px, 311.8 KB)

### [56205] Targeted Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
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
- **Image Asset**: `assets/card-art/bundles/cards/56205.jpg` (710×1030 px, 328.2 KB)

### [56206a] Choosing Sides
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Standard PVP (5/5)
- **Properties**: Permanent
- **Stats**: **Base Threat**: 4 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Permanent.
  > The enemy leader cannot take more than 2 damage from each attack.
  > **Forced Response**: After the last threat is removed from here, the enemy team searches the top 5 cards of the encounter deck for 1 [per_hero] encounter cards and deals one to each player as a facedown encounter card. Flip this card.

### [56206b] Now It's Personal
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Standard PVP (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Standard PVP Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the first player.***
  > **Action**: Remove this card from the game → each player on your team chooses 2 of your leader's set-aside player cards and adds them to their hand.
- **Image Asset**: `assets/card-art/bundles/cards/56206b.png` (289×419 px, 235.7 KB)


### Set: Captain America

### [56137] Captain America
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Setup**: The enemy team finds Cap's Shield and attaches it to Captain America.
  > **Forced Response**: After Cap's Shield is attached to Captain America, give him a tough status card.
- **Flavor**: *"Just because it's the law doesn't mean it's right."*
- **Image Asset**: `assets/card-art/bundles/cards/56137.jpg` (710×1030 px, 337.4 KB)

### [56138] Captain America
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. Captain America cannot take damage this phase.
  > **Forced Response**: After Cap's Shield is attached to Captain America, give him a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/56138.jpg` (710×1030 px, 336.1 KB)

### [56139] Captain America
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Setup**: The enemy team finds Cap's Shield and attaches it to Captain America.
  > **Forced Response**: After Cap's Shield is attached to Captain America, give him a tough status card.
- **Flavor**: *"Just because it's the law doesn't mean it's right."*
- **Image Asset**: `assets/card-art/bundles/cards/56139.png` (710×1030 px, 336.3 KB)

### [56140] Captain America
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (4/14)
- **Properties**: Unique, Stage IV
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. Captain America cannot take damage this phase.
  > **Forced Response**: After Cap's Shield is attached to Captain America, give him a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/56140.jpg` (710×1030 px, 342.0 KB)

### [56143] Cap's Shield
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (5/14)
- **Properties**: Unique, Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Permanent. Attach to Captain America.
  > Attached character gains retaliate 1 and attacks against them lose piercing.
  > **Forced Response**: After a hero or the Captain America leader uses their ATK to attack and damage attached character, attach Cap's Shield to the attacker.
- **Image Asset**: `assets/card-art/bundles/cards/56143.jpg` (710×1030 px, 317.7 KB)

### [56144] Cap's Helmet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (6/14)
- **Properties**: Unique
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor.*
- **Rules Text**:
  > Attach to Captain America.
  > Captain America gains stalwart.
  > **Hero Response**: After you make a basic attack against Captain America, spend 3 resources of the same type → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/56144.png` (710×1030 px, 356.1 KB)

### [56145] Super-Soldier Serum
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (7–8/14, Qty: 2)
- **Stats**: **ATK**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to Captain America.
  > [star] **Forced Interrupt**: When Captain America attacks, this attack gains overkill. At the end of this attack, discard this card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/56145.jpg` (710×1030 px, 301.0 KB)

### [56146] Shield Block
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (9/14)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Cap's Shield is attached to Captain America, give him a tough status card and a facedown boost card. Otherwise, attach Cap's Shield to him and give him a facedown boost card.
- **Flavor**: *"Take your best shot!" —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/56146.jpg` (710×1030 px, 326.4 KB)

### [56147] Shield Toss
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (10–11/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Captain America schemes.
  > **When Revealed (Hero)**: If Cap's Shield is attached to Captain America, deal 2 damage to each character you control. Otherwise, attach Cap's Shield to Captain America.
- **Image Asset**: `assets/card-art/bundles/cards/56147.png` (710×1030 px, 341.4 KB)

### [56148] Heroic Strike
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (12–13/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard an ally or upgrade you control.
  > **When Revealed (Hero)**: Captain America attacks you. If this attack damages a character, stun that character.
- **Image Asset**: `assets/card-art/bundles/cards/56148.png` (710×1030 px, 325.0 KB)

### [56149] Fearless Determination
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (14/14)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Captain America Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Defeated**: Attach Cap's Shield to Captain America. He activates against the player who defeated this scheme.
- **Flavor**: *Captain America's stand against the Superhero Registration Act gives other heroes a figure to rally behind.*
- **Image Asset**: `assets/card-art/bundles/cards/56149.jpg` (1030×710 px, 341.6 KB)

### [56207] No, You Move!
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (Set Card, unnumbered)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Rules Text**:
  > **Forced Interrupt**: When the enemy leader would attack you, attach Cap's Shield to your Captain America leader and resolve this attack against him instead. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56207.png` (710×1030 px, 331.5 KB)

### [56208] Fighting Dirty
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (Set Card, unnumbered)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Your Captain America leader attacks the enemy leader. If you spent a [physical] resource to pay for this event, stun the enemy leader.
- **Flavor**: *"Things are different this time. Now I'm fighting dirty." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/56208.png` (710×1030 px, 344.5 KB)

### [56209] Recruited by Cap
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (Set Card, unnumbered)
- **Stats**: **Cost**: 3, **Resources**: [wild]
- **Rules Text**:
  > Action: Choose a minion engaged with you and choose a player on the enemy team. That minion engages that player.
- **Flavor**: *"We're glad to have you on our side." —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/56209.jpg` (710×1030 px, 345.7 KB)

### [56210] The People's Hero
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Captain America (Set Card, unnumbered)
- **Stats**: **Resources**: [wild] [wild]
- **Rules Text**:
  > **Hero Response**: After you spend this resource, give your Captain America leader a facedown boost card.
- **Image Asset**: `assets/card-art/bundles/cards/56210.png` (710×1030 px, 313.1 KB)


### Set: Resistance

### [56141a] Superhero Resistance
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/56141a.png` (419×289 px, 233.8 KB)

### [56141b] Gathering Support
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (1/8)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > **When Revealed**: The enemy team searches the encounter deck for 1 [per_hero] minions and deals one to each player on your team as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/56141b.png` (419×289 px, 239.3 KB)

### [56142a] Resistance Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Captain America and his Avengers are forced to go underground or face arrest for refusing to register with S.H.I.E.L.D. When Iron Man and Captain Marvel start rounding up their superpowered friends, the resistance decides to fight back.*
- **Image Asset**: `assets/card-art/bundles/cards/56142a.png` (419×289 px, 228.2 KB)

### [56142b] Secret Avengers
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (7/8)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > The enemy leader gets +1 ATK while attacking (+2 ATK instead if the attack is undefended).
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Captain America's Avengers continue to fight crime from their secret hideout.*
- **Image Asset**: `assets/card-art/bundles/cards/56142b.png` (419×289 px, 251.6 KB)

### [56172a] Superhero Resistance
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/56172a.png` (419×289 px, 233.8 KB)

### [56172b] Open Rebellion
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (3/8)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > **Forced Interrupt**: When a player reveals a treachery, place 1 threat here. (Limit once per phase per player.)
- **Flavor**: *"Why don't you chase after the REAL bad guys?" —Hulkling*
- **Image Asset**: `assets/card-art/bundles/cards/56172b.png` (419×289 px, 246.1 KB)

### [56173a] Resistance Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Captain America and his Avengers are forced to go underground or face arrest for refusing to register with S.H.I.E.L.D. When Iron Man and Captain Marvel start rounding up their superpowered friends, the resistance decides to fight back.*
- **Image Asset**: `assets/card-art/bundles/cards/56173a.png` (419×289 px, 228.2 KB)

### [56173b] Neighborhood Protectors
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (5/8)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: The enemy team searches the encounter deck and discard pile for 1 [per_hero] side schemes and deals one to each player on your team as a facedown encounter card.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *"Does anyone else see the irony in outlaw heroes fighting crime?" —Chief of Police*
- **Image Asset**: `assets/card-art/bundles/cards/56173b.png` (419×289 px, 253.6 KB)

### [56199a] Superhero Resistance
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/56199a.png` (419×289 px, 233.8 KB)

### [56199b] Rallying Call
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (2/8)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > Each minion gains guard.
- **Flavor**: *Captain America's public denouncement of the Superhero Registration Act drew many allies to his side.*
- **Image Asset**: `assets/card-art/bundles/cards/56199b.png` (419×289 px, 236.8 KB)

### [56200a] Superhero Resistance
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (Stage 1A)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Chosen leader I and II *(III and IV for expert mode)*. Chosen leader's set, Standard set, and 3–4 modular sets.
  > **Setup**: In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side scheme and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/56200a.png` (419×289 px, 233.8 KB)

### [56200b] Going Underground
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (4/8)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > If there is more than 1 player on your team, this stage gains hinder 2 [per_hero].
  > The enemy leader gains steady.
- **Flavor**: *"I forgot how exhausting it is to be undercover!" —Spider-Woman*
- **Image Asset**: `assets/card-art/bundles/cards/56200b.png` (419×289 px, 241.5 KB)

### [56201a] Resistance Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Captain America and his Avengers are forced to go underground or face arrest for refusing to register with S.H.I.E.L.D. When Iron Man and Captain Marvel start rounding up their superpowered friends, the resistance decides to fight back.*
- **Image Asset**: `assets/card-art/bundles/cards/56201a.png` (419×289 px, 228.2 KB)

### [56201b] Guerilla Warfare
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (6/8)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After a status card is placed on the enemy leader, place 1 threat here.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *The goal of the resistance is to wear S.H.I.E.L.D. down until the Superhero Registration law is overturned.*
- **Image Asset**: `assets/card-art/bundles/cards/56201b.png` (419×289 px, 243.7 KB)

### [56202a] Resistance Tactics
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (Stage 2A)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Captain America and his Avengers are forced to go underground or face arrest for refusing to register with S.H.I.E.L.D. When Iron Man and Captain Marvel start rounding up their superpowered friends, the resistance decides to fight back.*
- **Image Asset**: `assets/card-art/bundles/cards/56202a.png` (419×289 px, 228.2 KB)

### [56202b] Superhero Jailbreak
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Resistance (8/8)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0, **Target Threat**: 9 [star] per hero, **Escalation Threat**: +1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Resistance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step 1 of the villain phase, each player discards the top card of the encounter deck. Each player who discards a minion this way puts it into play engaged with them.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/56202b.png` (419×289 px, 248.3 KB)


### Set: New Avengers

### [56150] Falcon
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: New Avengers (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: New Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > Teamwork ([[Avenger]]).
  > **When Defeated**: Give this card to the enemy leader as a facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: You are confused. If you were already confused, this card gains [boost][boost].
- **Image Asset**: `assets/card-art/bundles/cards/56150.png` (710×1030 px, 263.4 KB)

### [56151] Hercules
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: New Avengers (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: New Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Teamwork ([[Avenger]]).
  > **When Defeated**: Give this card to the enemy leader as a facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. If you were already stunned, this card gains [boost][boost].
- **Image Asset**: `assets/card-art/bundles/cards/56151.jpg` (710×1030 px, 321.4 KB)

### [56152] Goliath
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: New Avengers (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: New Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger. Giant.*
- **Rules Text**:
  > Teamwork ([[Avenger]]).
  > **When Defeated**: Give this card to the enemy leader as a facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: Give the enemy leader a tough status card. If they were already tough, this card gains [boost][boost].
- **Image Asset**: `assets/card-art/bundles/cards/56152.jpg` (710×1030 px, 298.1 KB)

### [56153] Freedom Fighters
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: New Avengers (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: New Avengers Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve the "**Boost**" ability of each minion in play. If no "**Boost**" abilities were resolved this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Resolve the "**Boost**" ability of each minion engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/56153.png` (710×1030 px, 326.5 KB)

### [56154] New Avengers
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: New Avengers (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: New Avengers Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: Shuffle each minion in the encounter discard pile into the encounter deck.
- **Flavor**: *"Tony's team is in for a big surprise!" —Captain America*
- **Image Asset**: `assets/card-art/bundles/cards/56154.jpg` (1030×710 px, 330.7 KB)


### Set: Secret Avengers

### [56155] Black Panther
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Secret Avengers (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Secret Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Teamwork ([[Avenger]]).
  > **When Defeated**: Give this card to the enemy leader as a facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: Exhaust each upgrade you control.
- **Image Asset**: `assets/card-art/bundles/cards/56155.png` (710×1030 px, 295.5 KB)

### [56156] Spectrum
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Secret Avengers (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Secret Avengers Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Avenger.*
- **Rules Text**:
  > Teamwork ([[Avenger]]).
  > **When Defeated**: Give this card to the enemy leader as a facedown boost card.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/56156.png` (710×1030 px, 314.0 KB)

### [56157] Freedom Fighters
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Secret Avengers (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Secret Avengers Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve the "**Boost**" ability of each minion in play. If no "**Boost**" abilities were resolved this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Resolve the "**Boost**" ability of each minion engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/56157.jpg` (710×1030 px, 313.7 KB)

### [56158] Switching Sides
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Secret Avengers (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Secret Avengers Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard an ally you control. In competitive mode, any player on the enmy team may spend resources equal to that ally's cost to put it into play under their control. If no ally left play this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/56158.jpg` (710×1030 px, 310.7 KB)

### [56159] Secret Avengers
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Secret Avengers (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Secret Avengers Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: The enemy team searches the top 5 cards of the encounter deck for a card. Give that card to the enemy leader as a facedown boost card.
- **Image Asset**: `assets/card-art/bundles/cards/56159.png` (1030×710 px, 293.3 KB)


### Set: Namor

### [56160] Namor
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Namor (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Namor Set Icon (printed bottom-right next to deck number)
- **Traits**: *Atlantis. Elite.*
- **Rules Text**:
  > Stalwart. Toughness. Villainous.
  > **When Revealed**: Namor activates against you.
- **Flavor**: *"Once more, the surface-dwellers' war has injured my Atlanteans and the Sub-Mariner must avenge them."*
- **Image Asset**: `assets/card-art/bundles/cards/56160.png` (710×1030 px, 311.9 KB)

### [56161] Neptune's Trident
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Namor (2/5)
- **Properties**: Unique
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Namor Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Namor. Otherwise, attach to the enemy leader.
  > [star] Attached character's attacks gain piercing.
  > **Hero Action**: Spend [energy] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56161.jpg` (710×1030 px, 322.4 KB)

### [56162] Horn of Proteus
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Namor (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Namor Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to Namor. Otherwise, attach to the enemy leader.
  > [star] **Forced Interrupt**: When attached character schemes, give it a tough status card.
  > **Hero Action**: Spend [mental] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56162.jpg` (710×1030 px, 315.2 KB)

### [56163] Imperius Rex!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Namor (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Namor Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Namor is in play, he activates against you. Otherwise, the enemy leader activates against you.
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy an additional boost card.
- **Image Asset**: `assets/card-art/bundles/cards/56163.png` (710×1030 px, 335.4 KB)

### [56164] Ruler of Atlantis
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Namor (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Namor Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > Each [[Atlantis]] minion cannot take damage.
- **Flavor**: *"There is nothing Namor will not dare or do to defend his people." —Namor*
- **Image Asset**: `assets/card-art/bundles/cards/56164.jpg` (1030×710 px, 301.0 KB)


### Set: Atlanteans

### [56165] Atlantean Guard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Atlanteans (1–3/5, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Atlanteans Set Icon (printed bottom-right next to deck number)
- **Traits**: *Atlantis.*
- **Rules Text**:
  > Guard.
  > **When Revealed**: Discard the top 3 cards of your deck.
- **Flavor**: *"For Namor and the glory of Atlantis!"*
- **Image Asset**: `assets/card-art/bundles/cards/56165.png` (710×1030 px, 299.2 KB)

### [56166] Atlanteans
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Atlanteans (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Atlanteans Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard the top 3 cards of your deck. If you are in:
  > • Alter-ego form, place 1 threat on the main scheme for each different card type discarded this way.
  > • Hero form, take 1 indirect damage for each different card type discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/56166.png` (710×1030 px, 329.4 KB)

### [56167] Atlantis Attacks
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Atlanteans (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Atlanteans Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Revealed**: Discard the top 1 [per_hero] cards of your deck. Place 1 acceleration token here for each different card type discarded this way.
- **Flavor**: *The Atlanteans as a people share a deep mistrust of surface-dwellers and enmity for the pollution of their waters.*
- **Image Asset**: `assets/card-art/bundles/cards/56167.jpg` (1030×710 px, 347.7 KB)


### Set: Spider Woman

### [56168] Spider-Woman
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (1/14)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Setup**: The enemy team finds Finesse and attaches it to Spider-Woman.
  > [star] **Forced Interrupt**: When Spider-Woman attacks, she gets +1 ATK for each skill counter on Finesse for this attack. Remove each skill counter from Finesse.
- **Image Asset**: `assets/card-art/bundles/cards/56168.jpg` (710×1030 px, 321.1 KB)

### [56169] Spider-Woman
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (2/14)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. Spider-Woman cannot take damage this phase.
  > [star] **Forced Interrupt**: When Spider-Woman attacks, she gets +1 ATK for each skill counter on Finesse for this attack. Remove each skill counter from Finesse.
- **Image Asset**: `assets/card-art/bundles/cards/56169.png` (710×1030 px, 313.4 KB)

### [56170] Spider-Woman
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (3/14)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > **Setup**: The enemy team finds Finesse and attaches it to Spider-Woman.
  > [star] **Forced Interrupt**: When Spider-Woman attacks, she gets +1 ATK for each skill counter on Finesse for this attack. Remove each skill counter from Finesse.
- **Image Asset**: `assets/card-art/bundles/cards/56170.jpg` (710×1030 px, 323.8 KB)

### [56171] Spider-Woman
- **Type**: `Leader`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (4/14)
- **Properties**: Unique, Stage IV
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 21 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger.*
- **Rules Text**:
  > Steady.
  > **When Revealed**: Deal each player an encounter card. Spider-Woman cannot take damage this phase.
  > [star] **Forced Interrupt**: When Spider-Woman attacks, she gets +1 ATK for each skill counter on Finesse for this attack. Remove each skill counter from Finesse.
- **Image Asset**: `assets/card-art/bundles/cards/56171.png` (710×1030 px, 323.8 KB)

### [56174] Finesse
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (5/14)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Permanent.
  > Max 3 skill counters here.
  > **Forced Interrupt**: When a treachery is revealed, place 1 skill counter here.
- **Image Asset**: `assets/card-art/bundles/cards/56174.png` (710×1030 px, 278.8 KB)

### [56175] Contaminant Immunity
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (6–7/14, Qty: 2)
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
- **Traits**: *Superpower.*
- **Rules Text**:
  > Attach to Spider-Woman.
  > **Forced Interrupt**: When Spider-Woman would be stunned or confused, discard this card instead. Give her a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/56175.jpg` (710×1030 px, 313.3 KB)

### [56176] Pheromones
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (8–9/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are stunned and confused. Place 1 skill counter on Finesse.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. Otherwise, you are confused.
- **Image Asset**: `assets/card-art/bundles/cards/56176.jpg` (710×1030 px, 303.3 KB)

### [56177] Venom Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (10–11/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: This card gains surge.
  > **When Revealed (Hero)**: Spider-Woman attacks you. If this attack removed the following skill counters from Finesse:
  > • At least 1, this attack gains ranged.
  > • At least 2, this attack gains piercing.
  > • At least 3, this attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/56177.png` (710×1030 px, 345.6 KB)

### [56178] Inconspicuous
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (12–13/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Chooose:
  > • Discard the highest-cost card you control
  > • Spider-Woman schemes.
  >
  > ---
  >
  > [star] **Boost**: This card gains [boost] for each status card on your identity.
- **Image Asset**: `assets/card-art/bundles/cards/56178.png` (710×1030 px, 306.5 KB)

### [56179] Self-propelled Glide
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (14/14)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider Woman Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Interrupt**: When Spider-Woman would take damage from an attack, reduce the amount of damage she takes by 1 for each skill counter on Finesse.
- **Flavor**: *"I've made a career out of staying one step ahead of S.H.I.E.L.D." —Spider-Woman*
- **Image Asset**: `assets/card-art/bundles/cards/56179.jpg` (1030×710 px, 314.0 KB)

### [56211] Double Agent
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (Set Card, unnumbered)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Remove 2 threat from the main scheme. Place 2 threat on your leader's main scheme.
- **Flavor**: *"When someone targets one of us, they answer to all of us." —Spider-Woman*
- **Image Asset**: `assets/card-art/bundles/cards/56211.jpg` (710×1030 px, 327.7 KB)

### [56212] Spider-Blast
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (Set Card, unnumbered)
- **Stats**: **Cost**: 2, **Resources**: [wild]
- **Rules Text**:
  > **Action**: Your Spider-Woman leader attacks the enemy leader. If you spent a [mental] resource to pay for this event, confuse the enemy leader.
- **Flavor**: *"From now on Spider-Woman fights back!" —Spider-Woman*
- **Image Asset**: `assets/card-art/bundles/cards/56212.jpg` (710×1030 px, 333.5 KB)

### [56213] Hard to Hit
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (Set Card, unnumbered)
- **Stats**: **Cost**: 1, **Resources**: [wild]
- **Traits**: *Skill.*
- **Rules Text**:
  > Attach to your Spider-Woman leader and give her a tough status card.
  > **Forced Response**: After attached Spider-Woman resolves an attack, place 2 skill counters on her Finesse attachment. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56213.png` (710×1030 px, 377.6 KB)

### [56214] Secret Contact
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider Woman (Set Card, unnumbered)
- **Stats**: **Resources**: [wild] [wild]
- **Rules Text**:
  > **Hero Response**: After you spend this resource, place 2 skill counters on your Spider-Woman leader's Finesse attachment.
- **Image Asset**: `assets/card-art/bundles/cards/56214.jpg` (710×1030 px, 329.2 KB)


### Set: Spider-Man

### [56180] Spider-Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider-Man (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Avenger. Elite.*
- **Rules Text**:
  > **When Revealed**: Spider-Man attacks each character with Tangled Up attached. If no attack was made this way, the enemy team searches the encounter deck and discard pile for a copy of Tangled Up and gives it to you as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/56180.jpg` (710×1030 px, 337.5 KB)

### [56181] Tangled Up
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider-Man (2–3/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Spider-Man Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your leader. Otherwise, attach to your hero.
  > **Forced Interrupt**: When attached character would scheme, thwart, or attack, discard this card instead.
  >
  > ---
  >
  > [star] **Boost**: If the Spider-Man minion is in play, reveal this card.
- **Image Asset**: `assets/card-art/bundles/cards/56181.png` (710×1030 px, 352.4 KB)

### [56182] Spectacular!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider-Man (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 2 threat on the main scheme. In competitive mode, remove 2 threat from your leader's main scheme.
- **Flavor**: *"Friendly neighborhood Spider-Man swinging through!" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/56182.png` (710×1030 px, 326.9 KB)

### [56183] Neighborhood Hero
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Spider-Man (5/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Spider-Man Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: In competitive mode, move 2 threat from your leader's main scheme to this scheme. Otherwise, place 2 [per_hero] threat here.
- **Flavor**: *"This isn't about politics; it's about saving lives!" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/56183.jpg` (1030×710 px, 336.8 KB)


### Set: Defenders

### [56184] Luke Cage
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Defenders (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Defenders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Defender.*
- **Rules Text**:
  > **When Revealed**: Stun your leader. Otherwise, you are stunned.
  >
  > ---
  >
  > [star] **Boost**: Stun your leader. Otherwise, you are stunned.
- **Flavor**: *"You S.H.I.E.L.D. boys better get out of my face."*
- **Image Asset**: `assets/card-art/bundles/cards/56184.png` (710×1030 px, 325.3 KB)

### [56185] Jessica Jones
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Defenders (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Defenders Set Icon (printed bottom-right next to deck number)
- **Traits**: *Defender.*
- **Rules Text**:
  > **When Revealed**: Confuse your leader. Otherwise, you are confused.
  >
  > ---
  >
  > [star] **Boost**: Confuse your leader. Otherwise, you are confused.
- **Flavor**: *"I thought I was done with all this superhero crap."*
- **Image Asset**: `assets/card-art/bundles/cards/56185.jpg` (710×1030 px, 270.8 KB)

### [56186] Protect the Innocent
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Defenders (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Defenders Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give the enemy leader and each minion a tough status card. If the enemy leader was already tough, this card gains surge.
- **Flavor**: *"Since when is it illegal to save lives?" —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/56186.jpg` (710×1030 px, 298.9 KB)

### [56187] Street Defenders
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Defenders (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Defenders Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each minion activates against the player it is engaged with. Otherwise, the enemy leader activates against you. Do not give it a boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/56187.png` (710×1030 px, 328.1 KB)

### [56188] The Defenders
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Defenders (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Defenders Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > Each minion gains guard.
- **Flavor**: *The Defenders were formed to protect people often overlooked by the Avengers.*
- **Image Asset**: `assets/card-art/bundles/cards/56188.png` (1030×710 px, 259.0 KB)


### Set: Hell's Kitchen

### [56189] Daredevil
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hell's Kitchen (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Hell's Kitchen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Defender.*
- **Rules Text**:
  > **When Revealed**: The enemy team exhausts a character you control.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a character you control.
- **Flavor**: *"My respect for the law doesn't blind my sense of right and wrong."*
- **Image Asset**: `assets/card-art/bundles/cards/56189.jpg` (710×1030 px, 312.0 KB)

### [56190] Iron Fist
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hell's Kitchen (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Hell's Kitchen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Defender.*
- **Rules Text**:
  > **When Revealed**: Iron Fist attacks your leader. Otherwise, Iron Fist activates against you.
  >
  > ---
  >
  > [star] **Boost**: The enemy leader attacks your leader *(after this activation)*. Do not give it a boost card for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/56190.png` (710×1030 px, 326.9 KB)

### [56191] Resistance Fighter
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hell's Kitchen (3/5)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Hell's Kitchen Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to a minion of the enemy team's choice. Otherwise, this card gains surge.
  > Attached minion gets +4 hit points and gains stalwart.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to a minion engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/56191.jpg` (710×1030 px, 332.7 KB)

### [56192] Street Defenders
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hell's Kitchen (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hell's Kitchen Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each minion activates against the player it is engaged with. Otherwise, the enemy leader activates against you. Do not give it a boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/56192.jpg` (710×1030 px, 336.1 KB)

### [56193] Defend Hell's Kitchen
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Hell's Kitchen (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hell's Kitchen Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > Threat cannot be removed from this scheme while a [[Defender]] minion is in play.
- **Flavor**: *"Tell S.H.I.E.L.D. to pull back. This city is under our protection." —Daredevil*
- **Image Asset**: `assets/card-art/bundles/cards/56193.png` (1030×710 px, 318.6 KB)


### Set: Cloak & Dagger

### [56194] Cloak
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Cloak & Dagger (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Cloak & Dagger Set Icon (printed bottom-right next to deck number)
- **Traits**: *Defender.*
- **Rules Text**:
  > **When Revealed**: Place 2 threat on a scheme. In competitive mode, remove 2 threat from your leader's main scheme.
  >
  > ---
  >
  > [star] **Boost**: If Dagger is in play, reveal Cloak. Otherwise, place 1 threat on a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/56194.jpg` (710×1030 px, 238.9 KB)

### [56195] Dagger
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Cloak & Dagger (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Cloak & Dagger Set Icon (printed bottom-right next to deck number)
- **Traits**: *Defender.*
- **Rules Text**:
  > **When Revealed**: Heal 2 damage from the enemy leader. Deal 2 damage to a character you control.
  >
  > ---
  >
  > [star] **Boost**: If Cloak is in play, reveal Dagger. Otherwise, deal 1 damage to a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/56195.png` (710×1030 px, 276.3 KB)

### [56196] Darkforce
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Cloak & Dagger (3/5)
- **Stats**: **SCH**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cloak & Dagger Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the enemy leader and give them a tough status card.
  > [star] **Forced Response**: After attached leader schemes and places threat on the main scheme, remove an equal amount of threat from your leader's main scheme. Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/56196.png` (710×1030 px, 294.3 KB)

### [56197] Lightforce
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Cloak & Dagger (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cloak & Dagger Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Heal 3 damage from the enemy leader. Take 3 indirect damage.
- **Flavor**: *"Maybe my daggers will help them see the light!" —Dagger*
- **Image Asset**: `assets/card-art/bundles/cards/56197.jpg` (710×1030 px, 256.3 KB)

### [56198] Cloak and Dagger
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Civil War (`cw`)
- **Deck / Set**: Cloak & Dagger (5/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Cloak & Dagger Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 1 [per_hero].
  > **When Defeated**: Heal 3 damage from the enemy leader and give them a tough status card.
- **Flavor**: *Cloak and Dagger were among the first to join Captain America's superhero resistance.*
- **Image Asset**: `assets/card-art/bundles/cards/56198.jpg` (1030×710 px, 242.1 KB)


