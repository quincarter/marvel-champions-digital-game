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
| `32001a` | Colossus | Hero | Colossus | THW:1 ATK:2 DEF:2 HP:14 | - | `mut_gen` |
| `32001b` | Piotr Rasputin | Alter-Ego | Colossus | REC:4 HP:14 | - | `mut_gen` |
| `32002` | Shadowcat | Ally | Colossus | THW:2 ATK:2 HP:3 | - | `mut_gen` |
| `32003` | Piotr's Studio | Support | Colossus | - | - | `mut_gen` |
| `32004` | Iron Will | Upgrade | Colossus | - | - | `mut_gen` |
| `32005` | Titanium Muscles | Upgrade | Colossus | - | - | `mut_gen` |
| `32006` | Organic Steel | Upgrade | Colossus | - | - | `mut_gen` |
| `32007` | Made of Rage | Event | Colossus | - | - | `mut_gen` |
| `32008` | Steel Fist | Event | Colossus | - | - | `mut_gen` |
| `32009` | Bulletproof Protector | Event | Colossus | - | - | `mut_gen` |
| `32010` | Armor Up | Event | Colossus | - | - | `mut_gen` |
| `32011` | Nightcrawler | Ally | Pack Position: 11 | THW:2 ATK:2 HP:2 | - | `mut_gen` |
| `32012` | Polaris | Ally | Pack Position: 12 | THW:1 ATK:2 HP:3 | - | `mut_gen` |
| `32013` | Protective Training | Upgrade | Pack Position: 13 | - | - | `mut_gen` |
| `32014` | Powerful Punch | Event | Pack Position: 14 | - | - | `mut_gen` |
| `32015` | Bait and Switch | Event | Pack Position: 15 | - | - | `mut_gen` |
| `32016` | Perseverance | Event | Pack Position: 16 | - | - | `mut_gen` |
| `32017` | Mutant Protectors | Event | Pack Position: 17 | - | - | `mut_gen` |
| `32018` | Defensive Energy | Resource | Pack Position: 18 | - | - | `mut_gen` |
| `32019` | Professor X | Ally | Pack Position: 19 | THW:3 ATK:0 HP:3 | - | `mut_gen` |
| `32020` | The X-Jet | Support | Pack Position: 20 | - | - | `mut_gen` |
| `32021` | Shadow and Steel | Event | Pack Position: 21 | - | - | `mut_gen` |
| `32022` | Energy | Resource | Pack Position: 22 | - | - | `mut_gen` |
| `32023` | Genius | Resource | Pack Position: 23 | - | - | `mut_gen` |
| `32024` | Strength | Resource | Pack Position: 24 | - | - | `mut_gen` |
| `32025` | Homesick | Obligation | Colossus | - | 2 icons | `mut_gen` |
| `32026` | Juggernaut | Minion | Colossus Nemesis | SCH:1 ATK:4 HP:8 | 2 icons + star | `mut_gen` |
| `32027` | Rampaging Juggernaut | Side Scheme | Colossus Nemesis | - | 3 icons | `mut_gen` |
| `32028` | Unstoppable | Attachment | Colossus Nemesis | ATK:2 | 2 icons | `mut_gen` |
| `32029` | Slammed | Treachery | Colossus Nemesis | - | 2 icons + star | `mut_gen` |
| `32030a` | Shadowcat | Hero | Shadowcat | THW:2 ATK:2 DEF:2 HP:9 | - | `mut_gen` |
| `32030b` | Kitty Pryde | Alter-Ego | Shadowcat | REC:3 HP:9 | - | `mut_gen` |
| `32031a` | Solid | Upgrade | Shadowcat | - | - | `mut_gen` |
| `32031b` | Phased | Upgrade | Shadowcat | - | - | `mut_gen` |
| `32032` | Lockheed | Ally | Shadowcat | THW:1 ATK:1 HP:2 | - | `mut_gen` |
| `32033` | Kitty's Room | Support | Shadowcat | - | - | `mut_gen` |
| `32034` | Acute Control | Upgrade | Shadowcat | - | - | `mut_gen` |
| `32035` | Intangible Interference | Upgrade | Shadowcat | - | - | `mut_gen` |
| `32036` | Phased and Confused | Upgrade | Shadowcat | - | - | `mut_gen` |
| `32037` | Shadowcat Surprise | Event | Shadowcat | - | - | `mut_gen` |
| `32038` | Phase Strike | Event | Shadowcat | - | - | `mut_gen` |
| `32039` | Airwalk | Event | Shadowcat | - | - | `mut_gen` |
| `32040` | Quick Shift | Event | Shadowcat | - | - | `mut_gen` |
| `32041` | Wolverine | Ally | Pack Position: 41 | THW:1 ATK:3 HP:4 | - | `mut_gen` |
| `32042` | Magik | Ally | Pack Position: 42 | THW:1 ATK:2 HP:3 | - | `mut_gen` |
| `32043` | Attack Training | Upgrade | Pack Position: 43 | - | - | `mut_gen` |
| `32044` | Gatekeeper | Upgrade | Pack Position: 44 | - | - | `mut_gen` |
| `32045` | Team Strike | Event | Pack Position: 45 | - | - | `mut_gen` |
| `32046` | Toe to Toe | Event | Pack Position: 46 | - | - | `mut_gen` |
| `32047` | Aggressive Energy | Resource | Pack Position: 47 | - | - | `mut_gen` |
| `32048` | Colossus | Ally | Pack Position: 48 | THW:1 ATK:3 HP:3 | - | `mut_gen` |
| `32049` | X-Mansion | Support | Pack Position: 49 | - | - | `mut_gen` |
| `32050` | Shadow and Steel | Event | Pack Position: 50 | - | - | `mut_gen` |
| `32051` | Ready to Rumble | Upgrade | Pack Position: 51 | - | - | `mut_gen` |
| `32052` | Energy | Resource | Pack Position: 52 | - | - | `mut_gen` |
| `32053` | Genius | Resource | Pack Position: 53 | - | - | `mut_gen` |
| `32054` | Strength | Resource | Pack Position: 54 | - | - | `mut_gen` |
| `32055` | Permanently Phased | Obligation | Shadowcat | - | 2 icons | `mut_gen` |
| `32056` | White Queen | Minion | Shadowcat Nemesis | SCH:1 ATK:1 HP:5 | 1 icon + star | `mut_gen` |
| `32057` | The Hellfire Club | Side Scheme | Shadowcat Nemesis | - | 3 icons | `mut_gen` |
| `32058` | Hellfire Pawn | Minion | Shadowcat Nemesis | SCH:1 ATK:2 HP:3 | 0 icons + star | `mut_gen` |
| `32059` | Telepathic Restraint | Attachment | Shadowcat Nemesis | - | 2 icons | `mut_gen` |
| `32060` | Sabretooth | Villain | Sabretooth | SCH:1 ATK:2 HP:13 | - | `mut_gen` |
| `32061` | Sabretooth | Villain | Sabretooth | SCH:2 ATK:2 HP:15 | - | `mut_gen` |
| `32062` | Sabretooth | Villain | Sabretooth | SCH:2 ATK:3 HP:18 | - | `mut_gen` |
| `32063` | Stalked by Sabretooth | Main Scheme | Sabretooth | - | - | `mut_gen` |
| `32063a` | Stalked by Sabretooth | Main Scheme | Sabretooth | - | - | `mut_gen` |
| `32063b` | Stalked by Sabretooth | Main Scheme | Sabretooth | - | - | `mut_gen` |
| `32064` | The Injured Senator | Main Scheme | Sabretooth | - | - | `mut_gen` |
| `32064a` | The Injured Senator | Main Scheme | Sabretooth | - | - | `mut_gen` |
| `32064b` | The Injured Senator | Main Scheme | Sabretooth | - | - | `mut_gen` |
| `32065a` | Find the Senator | Side Scheme | Sabretooth | - | not recorded in this source | `mut_gen` |
| `32065b` | Protect the Senator | Environment | Sabretooth | - | - | `mut_gen` |
| `32066` | Robert Kelly | Ally | Sabretooth | HP:9 | not recorded in this source | `mut_gen` |
| `32067` | Adamantium Claws | Attachment | Sabretooth | ATK:1 | 0 icons + star | `mut_gen` |
| `32068` | Animal Ferocity | Attachment | Sabretooth | - | 0 icons + star | `mut_gen` |
| `32069` | Sabretooth Strikes | Treachery | Sabretooth | - | 0 icons + star | `mut_gen` |
| `32070` | Unrelenting Savage | Treachery | Sabretooth | - | 1 icon | `mut_gen` |
| `32071` | Medical Emergency | Side Scheme | Sabretooth | - | 2 icons | `mut_gen` |
| `32072` | Feral Rage | Side Scheme | Sabretooth | - | 3 icons | `mut_gen` |
| `32073` | Avalanche | Minion | Brotherhood | SCH:1 ATK:3 HP:5 | 1 icon + star | `mut_gen` |
| `32074` | Blob | Minion | Brotherhood | SCH:1 ATK:2 HP:6 | 2 icons | `mut_gen` |
| `32075` | Pyro | Minion | Brotherhood | SCH:2 ATK:0 HP:4 | 2 icons | `mut_gen` |
| `32076` | Toad | Minion | Brotherhood | SCH:2 ATK:2 HP:3 | 1 icon + star | `mut_gen` |
| `32077` | Homo Superior | Attachment | Brotherhood | - | 1 icon + star | `mut_gen` |
| `32078` | Mutant Terrorists | Treachery | Brotherhood | - | 2 icons | `mut_gen` |
| `32079` | The Brotherhood | Side Scheme | Brotherhood | - | 3 icons | `mut_gen` |
| `32080` | Mystique | Minion | Mystique | HP:9 | 3 icons | `mut_gen` |
| `32081` | Metamorphic Mayhem | Side Scheme | Mystique | - | 3 icons | `mut_gen` |
| `32082` | Infiltration | Treachery | Mystique | - | 1 icon | `mut_gen` |
| `32083` | Shapeshifter Surprise | Treachery | Mystique | - | 2 icons | `mut_gen` |
| `32084` | Sentinel | Villain | Project Wideawake | SCH:2 ATK:2 HP:16 | - | `mut_gen` |
| `32085` | Sentinel | Villain | Project Wideawake | SCH:2 ATK:3 HP:18 | - | `mut_gen` |
| `32086` | Sentinel | Villain | Project Wideawake | SCH:3 ATK:3 HP:22 | - | `mut_gen` |
| `32087` | Night of the Sentinels | Main Scheme | Project Wideawake | - | - | `mut_gen` |
| `32087a` | Night of the Sentinels | Main Scheme | Project Wideawake | - | - | `mut_gen` |
| `32087b` | Night of the Sentinels | Main Scheme | Project Wideawake | - | - | `mut_gen` |
| `32088a` | Mutants at the Mall | Side Scheme | Project Wideawake | - | not recorded in this source | `mut_gen` |
| `32088b` | Jubilee | Ally | Project Wideawake | THW:1 ATK:1 HP:3 | not recorded in this source | `mut_gen` |
| `32089` | Rictor | Ally | Project Wideawake | THW:1 ATK:1 HP:3 | not recorded in this source | `mut_gen` |
| `32090` | Boom Boom | Ally | Project Wideawake | THW:1 ATK:1 HP:3 | not recorded in this source | `mut_gen` |
| `32091` | Cannonball | Ally | Project Wideawake | THW:1 ATK:2 HP:3 | not recorded in this source | `mut_gen` |
| `32092` | Wolfsbane | Ally | Project Wideawake | THW:1 ATK:2 HP:3 | not recorded in this source | `mut_gen` |
| `32093` | Sentinel Mark IV | Minion | Project Wideawake | SCH:2 ATK:2 HP:4 | 0 icons + star | `mut_gen` |
| `32094` | Gauntlet Beam | Attachment | Project Wideawake | ATK:1 | 1 icon + star | `mut_gen` |
| `32095` | Learning A.I. | Attachment | Project Wideawake | SCH:1 | 0 icons + star | `mut_gen` |
| `32096` | Adaptive Armor | Attachment | Project Wideawake | - | 0 icons + star | `mut_gen` |
| `32097` | Self-Repair | Treachery | Project Wideawake | - | 0 icons + star | `mut_gen` |
| `32098` | Mutant Detected | Treachery | Project Wideawake | - | 2 icons | `mut_gen` |
| `32099` | Warn the Others | Obligation | Project Wideawake | - | 2 icons | `mut_gen` |
| `32100` | Abduction Protocols | Side Scheme | Project Wideawake | - | 2 icons | `mut_gen` |
| `32101` | Sentinel Mark II | Minion | Zero Tolerance | SCH:1 ATK:2 HP:2 | 1 icon | `mut_gen` |
| `32102` | Sentinel Mark III | Minion | Zero Tolerance | SCH:2 ATK:3 HP:3 | 0 icons + star | `mut_gen` |
| `32103` | Energy Barrier | Attachment | Zero Tolerance | ATK:2 | 1 icon | `mut_gen` |
| `32104` | Operation Zero Tolerance | Side Scheme | Zero Tolerance | - | 3 icons | `mut_gen` |
| `32105` | Sentinel Mark V | Minion | Sentinels | SCH:1 ATK:3 HP:5 | 2 icons | `mut_gen` |
| `32106` | Sentinel Mark VI | Minion | Sentinels | SCH:2 ATK:2 HP:6 | 0 icons + star | `mut_gen` |
| `32107` | Targeted for Elimination | Attachment | Sentinels | - | 2 icons | `mut_gen` |
| `32108` | Relentless Robots | Side Scheme | Sentinels | - | 3 icons | `mut_gen` |
| `32109` | Master Mold | Villain | Master Mold | SCH:1 ATK:2 HP:12 | - | `mut_gen` |
| `32110` | Master Mold | Villain | Master Mold | SCH:2 ATK:3 HP:14 | - | `mut_gen` |
| `32111` | Master Mold | Villain | Master Mold | SCH:3 ATK:4 HP:16 | - | `mut_gen` |
| `32112` | The Sentinel Factory | Main Scheme | Master Mold | - | - | `mut_gen` |
| `32112a` | The Sentinel Factory | Main Scheme | Master Mold | - | - | `mut_gen` |
| `32112b` | The Sentinel Factory | Main Scheme | Master Mold | - | - | `mut_gen` |
| `32113` | Master Mold's Agenda | Main Scheme | Master Mold | - | - | `mut_gen` |
| `32113a` | Master Mold's Agenda | Main Scheme | Master Mold | - | - | `mut_gen` |
| `32113b` | Master Mold's Agenda | Main Scheme | Master Mold | - | - | `mut_gen` |
| `32114` | Sentinel Mark VIII | Minion | Master Mold | SCH:3 ATK:3 HP:8 | 2 icons | `mut_gen` |
| `32115` | Unit Upgrade | Attachment | Master Mold | SCH:1 ATK:1 | 0 icons + star | `mut_gen` |
| `32116` | Stun Beam | Attachment | Master Mold | ATK:1 | 2 icons | `mut_gen` |
| `32117` | Master Mold's Children | Treachery | Master Mold | - | 1 icon | `mut_gen` |
| `32118` | Shields Up | Treachery | Master Mold | - | 0 icons + star | `mut_gen` |
| `32119` | Intruder Alert! | Side Scheme | Master Mold | - | 3 icons | `mut_gen` |
| `32120` | Insert Virus Program | Side Scheme | Master Mold | - | 2 icons | `mut_gen` |
| `32121a` | Avalanche | Villain | Mansion Attack | SCH:2 ATK:3 HP:15 | - | `mut_gen` |
| `32121b` | Avalanche | Villain | Mansion Attack | SCH:2 ATK:4 HP:18 | - | `mut_gen` |
| `32122a` | Blob | Villain | Mansion Attack | SCH:1 ATK:2 HP:16 | - | `mut_gen` |
| `32122b` | Blob | Villain | Mansion Attack | SCH:2 ATK:2 HP:19 | - | `mut_gen` |
| `32123a` | Pyro | Villain | Mansion Attack | SCH:2 ATK:0 HP:14 | - | `mut_gen` |
| `32123b` | Pyro | Villain | Mansion Attack | SCH:2 ATK:1 HP:17 | - | `mut_gen` |
| `32124a` | Toad | Villain | Mansion Attack | SCH:2 ATK:2 HP:13 | - | `mut_gen` |
| `32124b` | Toad | Villain | Mansion Attack | SCH:3 ATK:2 HP:16 | - | `mut_gen` |
| `32125` | The Brotherhood Strikes! | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32125a` | The Brotherhood Strikes! | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32125b` | The Brotherhood Strikes! | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32126` | The Atrium | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32126a` | The Atrium | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32126b` | The Atrium | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32127` | The Cafeteria | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32127a` | The Cafeteria | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32127b` | The Cafeteria | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32128` | The Basketball Court | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32128a` | The Basketball Court | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32128b` | The Basketball Court | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32129` | The Courtyard | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32129a` | The Courtyard | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32129b` | The Courtyard | Main Scheme | Mansion Attack | - | - | `mut_gen` |
| `32130` | Save the School | Environment | Mansion Attack | - | - | `mut_gen` |
| `32131` | Brotherhood Beatdown | Treachery | Mansion Attack | - | 2 icons | `mut_gen` |
| `32132` | Ground Swell | Treachery | Mansion Attack | - | 1 icon + star | `mut_gen` |
| `32133` | Immovable | Treachery | Mansion Attack | - | 1 icon + star | `mut_gen` |
| `32134` | Pyromaniac | Treachery | Mansion Attack | - | 1 icon + star | `mut_gen` |
| `32135` | Hopping Mad | Treachery | Mansion Attack | - | 1 icon + star | `mut_gen` |
| `32136` | Protect the Students | Side Scheme | Mansion Attack | - | 2 icons | `mut_gen` |
| `32137` | Under Siege | Side Scheme | Mansion Attack | - | 3 icons | `mut_gen` |
| `32138` | Magneto | Villain | Magneto | SCH:2 ATK:2 HP:18 | - | `mut_gen` |
| `32139` | Magneto | Villain | Magneto | SCH:2 ATK:3 HP:20 | - | `mut_gen` |
| `32140` | Magneto | Villain | Magneto | SCH:3 ATK:3 HP:22 | - | `mut_gen` |
| `32141` | Asteroid M | Main Scheme | Magneto | - | - | `mut_gen` |
| `32141a` | Asteroid M | Main Scheme | Magneto | - | - | `mut_gen` |
| `32141b` | Asteroid M | Main Scheme | Magneto | - | - | `mut_gen` |
| `32142` | Factory Online | Main Scheme | Magneto | - | - | `mut_gen` |
| `32142a` | Factory Online | Main Scheme | Magneto | - | - | `mut_gen` |
| `32142b` | Factory Online | Main Scheme | Magneto | - | - | `mut_gen` |
| `32143` | The Rule of Magnus | Main Scheme | Magneto | - | - | `mut_gen` |
| `32143a` | The Rule of Magnus | Main Scheme | Magneto | - | - | `mut_gen` |
| `32143b` | The Rule of Magnus | Main Scheme | Magneto | - | - | `mut_gen` |
| `32144a` | Boarding Party | Side Scheme | Magneto | - | not recorded in this source | `mut_gen` |
| `32144b` | Sabotage Master Mold | Side Scheme | Magneto | - | not recorded in this source | `mut_gen` |
| `32145a` | Orbital Decay | Side Scheme | Magneto | - | not recorded in this source | `mut_gen` |
| `32145b` | Physical Strain | Attachment | Magneto | - | not recorded in this source | `mut_gen` |
| `32146` | M-Type Sentinel | Minion | Magneto | SCH:2 ATK:2 HP:5 | 0 icons + star | `mut_gen` |
| `32147` | Magneto's Helmet | Attachment | Magneto | SCH:1 | 3 icons | `mut_gen` |
| `32148` | Magneto's Armor | Attachment | Magneto | ATK:1 | 3 icons | `mut_gen` |
| `32149` | Magnetic Bubble | Attachment | Magneto | - | 2 icons | `mut_gen` |
| `32150` | Wrapped in Metal | Attachment | Magneto | - | 2 icons | `mut_gen` |
| `32151` | Master of Magnetism | Treachery | Magneto | - | 2 icons | `mut_gen` |
| `32152` | Electric Shock | Treachery | Magneto | - | 2 icons | `mut_gen` |
| `32153` | Electromagnetic Blast | Treachery | Magneto | - | 0 icons + star | `mut_gen` |
| `32154` | Metal Shards | Treachery | Magneto | - | 0 icons + star | `mut_gen` |
| `32155` | Magnetic Missile | Treachery | Magneto | - | 1 icon | `mut_gen` |
| `32156` | Magnetic Mayhem | Side Scheme | Magneto | - | 4 icons | `mut_gen` |
| `32157` | Magnetically Sealed | Side Scheme | Magneto | - | 0 icons + star | `mut_gen` |
| `32158` | Seized! | Side Scheme | Magneto | - | 3 icons | `mut_gen` |
| `32159` | Fabian Cortez | Minion | Acolytes | SCH:1 ATK:1 HP:4 | 3 icons | `mut_gen` |
| `32160` | Amelia Voght | Minion | Acolytes | SCH:2 ATK:1 HP:5 | 2 icons | `mut_gen` |
| `32161` | Senyaka | Minion | Acolytes | SCH:1 ATK:3 HP:3 | 3 icons | `mut_gen` |
| `32162` | Delgado | Minion | Acolytes | SCH:1 ATK:2 HP:6 | 2 icons | `mut_gen` |
| `32163` | Unuscione | Minion | Acolytes | SCH:2 ATK:2 HP:4 | 2 icons | `mut_gen` |
| `32164` | Zeal for the Cause | Treachery | Acolytes | - | 1 icon | `mut_gen` |
| `32165` | The Acolytes | Side Scheme | Acolytes | - | 0 icons + star | `mut_gen` |
| `32166` | Nimrod | Minion | Future Past | SCH:2 ATK:3 HP:9 | 3 icons | `mut_gen` |
| `32167` | Bastion | Minion | Future Past | SCH:2 ATK:2 HP:10 | 0 icons + star | `mut_gen` |
| `32168` | Nimrod's Portal | Side Scheme | Future Past | - | 3 icons | `mut_gen` |
| `32169` | Bastion's Machinations | Side Scheme | Future Past | - | 3 icons | `mut_gen` |
| `32170` | Nano-Sentinel Tech | Attachment | Future Past | - | 2 icons | `mut_gen` |
| `32171a` | Frightened Police | Side Scheme | Mutant Genesis Campaign | - | 3 icons | `mut_gen` |
| `32171b` | Metro P.D. | Support | Mutant Genesis Campaign | - | not recorded in this source | `mut_gen` |
| `32172a` | Enemy of My Enemy | Side Scheme | Mutant Genesis Campaign | - | not recorded in this source | `mut_gen` |
| `32172b` | Magneto | Ally | Mutant Genesis Campaign | THW:2 ATK:3 HP:5 | not recorded in this source | `mut_gen` |
| `32173a` | Find the Prisoners | Side Scheme | Mutant Genesis Campaign | - | 3 icons | `mut_gen` |
| `32173b` | Rescue Captives | Environment | Mutant Genesis Campaign | - | 2 icons | `mut_gen` |
| `32174a` | Surprise Attack | Side Scheme | Mutant Genesis Campaign | - | 3 icons | `mut_gen` |
| `32174b` | Reactive Defense | Obligation | Mutant Genesis Campaign | - | 2 icons | `mut_gen` |
| `32175a` | Magneto's Fortress | Side Scheme | Mutant Genesis Campaign | - | 3 icons | `mut_gen` |
| `32175b` | Magneto's Power | Attachment | Mutant Genesis Campaign | SCH:1 ATK:1 | not recorded in this source | `mut_gen` |
| `32176` | Coup de Grâce | Upgrade | Brawler | - | not recorded in this source | `mut_gen` |
| `32177` | Swagger | Upgrade | Brawler | - | not recorded in this source | `mut_gen` |
| `32178` | Brazen Defense | Upgrade | Brawler | - | not recorded in this source | `mut_gen` |
| `32179` | Ferocious Attack | Upgrade | Brawler | - | not recorded in this source | `mut_gen` |
| `32180` | War Cry | Upgrade | Brawler | - | not recorded in this source | `mut_gen` |
| `32181` | Coup de Grâce | Upgrade | Commander | - | not recorded in this source | `mut_gen` |
| `32182` | Compassion | Upgrade | Commander | - | not recorded in this source | `mut_gen` |
| `32183` | Group Assault | Upgrade | Commander | - | not recorded in this source | `mut_gen` |
| `32184` | Shock and Awe | Upgrade | Commander | - | not recorded in this source | `mut_gen` |
| `32185` | Improvisation | Upgrade | Commander | - | not recorded in this source | `mut_gen` |
| `32186` | Swagger | Upgrade | Defender | - | not recorded in this source | `mut_gen` |
| `32187` | Surprise! | Upgrade | Defender | - | not recorded in this source | `mut_gen` |
| `32188` | Heroic Intervention | Upgrade | Defender | - | not recorded in this source | `mut_gen` |
| `32189` | Determined Defense | Upgrade | Defender | - | not recorded in this source | `mut_gen` |
| `32190` | Bodyguard | Upgrade | Defender | - | not recorded in this source | `mut_gen` |
| `32191` | Surprise! | Upgrade | Peacekeeper | - | not recorded in this source | `mut_gen` |
| `32192` | Compassion | Upgrade | Peacekeeper | - | not recorded in this source | `mut_gen` |
| `32193` | Rescue Operation | Upgrade | Peacekeeper | - | not recorded in this source | `mut_gen` |
| `32194` | Mentorship | Upgrade | Peacekeeper | - | not recorded in this source | `mut_gen` |
| `32195` | Fortitude | Upgrade | Peacekeeper | - | not recorded in this source | `mut_gen` |

---

## Pack: Mutant Genesis (`mut_gen`)

### Set: Colossus

### [32001a] Colossus
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 1, **ATK**: 2, **DEF**: 2, **HP**: 14, **Hand Size**: 4
- **Traits**: *X-Men.*
- **Rules Text**:
  > Colossus can have 1 additional tough status card.
  > *Steel Skin* - **Response**: After you change to this form, give Colossus a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/32001a.png` (607×880 px, 152.6 KB)

### [32001b] Piotr Rasputin
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 14, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > **Setup**: Search your deck for a copy of Organic Steel and add it to your hand.
  > *Aspiring Artist* - **Response**: After you change to this form, shuffle a Colossus card from your discard pile into your deck.
- **Image Asset**: `assets/card-art/bundles/cards/32001b.png` (607×880 px, 145.8 KB)

### [32002] Shadowcat — *Kitty Pryde*
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Shadowcat ignores the guard and patrol keywords, and any crisis icons ([crisis]) in play.
- **Image Asset**: `assets/card-art/bundles/cards/32002.png` (607×880 px, 126.8 KB)

### [32003] Piotr's Studio
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (2/15)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Piotr's Studio → discard cards from your deck until you discard a Colossus card. Add that card to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/32003.png` (607×880 px, 137.4 KB)

### [32004] Iron Will
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (3/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Colossus gets +1 THW.
  > **Response**: After a tough status card is discarded from Colossus, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/32004.png` (607×880 px, 133.5 KB)

### [32005] Titanium Muscles
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (4/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Colossus gets +1 ATK.
  > **Hero Resource**: Exhaust this card → generate a [physical] resource for each tough status card on Colossus.
- **Image Asset**: `assets/card-art/bundles/cards/32005.png` (607×880 px, 140.0 KB)

### [32006] Organic Steel
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (5–6/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > Uses (2 steel counters).
  > **Hero Response**: After a tough status card is discarded from Colossus, exhaust this card and remove 1 steel counter from it → give Colossus a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/32006.png` (607×880 px, 143.7 KB)

### [32007] Made of Rage
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (7–8/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Interrupt**: When you make a basic attack, discard a tough status card from your hero → you get +6 ATK for that attack. That attack gains overkill.
- **Image Asset**: `assets/card-art/bundles/cards/32007.png` (607×880 px, 143.4 KB)

### [32008] Steel Fist
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (9–11/15, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action**: Deal 5 damage to an enemy. You may discard a tough status card from your hero to stun and confuse that enemy.
- **Errata (FFG)**:
  > Replaced cost arrow with “to”. (RRG 1.5)
- **Image Asset**: `assets/card-art/bundles/cards/32008.png` (607×880 px, 146.2 KB)

### [32009] Bulletproof Protector
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (12–13/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Action**: Discard a tough status card from your hero → choose:
  > • Give your hero 2 tough status cards.
  > • Ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/32009.png` (607×880 px, 141.3 KB)

### [32010] Armor Up
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (14–15/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Alter-Ego Interrupt**: When the villain would activate, change to hero form.
- **Errata (FFG)**:
  > Added “would”. (RRG 1.5)
- **Image Asset**: `assets/card-art/bundles/cards/32010.png` (607×880 px, 141.4 KB)

### [32025] Homesick
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Colossus Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Piotr Rasputin player.***
  > You may flip to alter-ego form. Choose:
  > • Exhaust Piotr Rasputin → remove Homesick from the game.
  > • Discard this card and each tough status card from your identity. If you discarded no tough status cards this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/32025.png` (607×880 px, 139.3 KB)


### Set: Protection

### [32011] Nightcrawler — *Kurt Wagner*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 11
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Interrupt**: When an [[X-MEN]] character would take any amount of damage from an enemy attack, spend a [energy] resource and return Nightcrawler to your hand → prevent all of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/32011.png` (607×880 px, 128.1 KB)

### [32012] Polaris — *Lorna Dane*
- **Type**: `Ally`
- **Faction / Aspect**: Protection
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *X-Men.*
- **Rules Text**:
  > **Response**: After Polaris enters play, give an [[X-MEN]] character a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/32012.png` (607×880 px, 131.7 KB)

### [32013] Protective Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Protection
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 13
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Training.*
- **Rules Text**:
  > Attach to an [[X-MEN]] ally. Max 1 [[Training]] upgrade per ally.
  > Attached ally gets +3 hit points.
- **Image Asset**: `assets/card-art/bundles/cards/32013.png` (607×880 px, 147.0 KB)

### [32014] Powerful Punch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Defense.*
- **Rules Text**:
  > **Hero Interrupt** *(attack/defense)*: When an enemy initiates an attack, deal 4 damage to that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/32014.png` (607×880 px, 121.8 KB)

### [32015] Bait and Switch
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: The villain attacks you. Remove 4 threat from the main scheme.
- **Flavor**: *"You didn't really think I'd let you get away with that, did you?" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/32015.png` (607×880 px, 131.7 KB)

### [32016] Perseverance
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Response**: After you change form, give your hero a tough status card.
- **Flavor**: *"You do know the front door is unlocked, right?" —Spider-Man*
- **Image Asset**: `assets/card-art/bundles/cards/32016.png` (607×880 px, 120.9 KB)

### [32017] Mutant Protectors
- **Type**: `Event`
- **Faction / Aspect**: Protection
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 17
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Defense.*
- **Rules Text**:
  > Play only if your identity has the [[X-MEN]] trait.
  > **Hero Interrupt** *(defense)*: When an enemy attacks, put an [[X-MEN]] ally into play from your hand. Exhaust it and declare it the defender for this attack.
- **Image Asset**: `assets/card-art/bundles/cards/32017.png` (607×880 px, 133.1 KB)

### [32018] Defensive Energy
- **Type**: `Resource`
- **Faction / Aspect**: Protection
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 18
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > **Hero Interrupt**: When you spend this card to play a [[Defense]] event, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/32018.png` (607×880 px, 120.9 KB)


### Set: Basic

### [32019] Professor X — *Charles Xavier*
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 3 (Consequential: 1), **ATK**: 0 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *Psionic. X-Men.*
- **Rules Text**:
  > **Forced Response**: After Professor X enters play, choose one: confuse the villain, stun a minion, or ready an [[X-MEN]] character. At the end of the round, if Professor X is still in play, discard him.
- **Image Asset**: `assets/card-art/bundles/cards/32019.png` (607×880 px, 147.1 KB)

### [32020] The X-Jet
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Vehicle. X-Men.*
- **Rules Text**:
  > **Resource**: Exhaust The X-Jet → generate a [wild] resource for a player whose identity has the [[X-MEN]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/32020.png` (607×880 px, 126.4 KB)

### [32021] Shadow and Steel
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 21
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Defense.*
- **Rules Text**:
  > Team-Up (Colossus and Shadowcat).
  > Max 1 per deck.
  > **Hero Interrupt** *(attack/defense)*: When an enemy attacks, prevent all damage from that attack and deal 4 damage to the attacking enemy.
- **Image Asset**: `assets/card-art/bundles/cards/32021.png` (607×880 px, 144.1 KB)

### [32022] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 22
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/32022.png` (607×880 px, 125.8 KB)

### [32023] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 23
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/32023.png` (607×880 px, 126.9 KB)

### [32024] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/32024.png` (607×880 px, 133.9 KB)

### [32048] Colossus
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 48
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 2), **HP**: 3, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > Reduce the cost to play Colossus by 1 if your identity has the [[MUTANT]] or [[X-MEN]] trait.
  > Toughness.
- **Image Asset**: `assets/card-art/bundles/cards/32048.png` (607×880 px, 136.1 KB)

### [32049] X-Mansion
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 49
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Location. X-Men.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust X-Mansion → heal 1 damage from a [[MUTANT]] or [[X-MEN]] character. Any player whose alter-ego has the [[MUTANT]] trait may trigger this ability.
- **Image Asset**: `assets/card-art/bundles/cards/32049.png` (607×880 px, 156.0 KB)

### [32050] Shadow and Steel
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Defense.*
- **Rules Text**:
  > Team-Up (Colossus and Shadowcat).
  > Max 1 per deck.
  > **Hero Interrupt** *(attack/defense)*: When an enemy attacks, prevent all damage from that attack and deal 4 damage to the attacking enemy.

### [32051] Ready to Rumble
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Hero Response**: After you change form, discard this card → ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/32051.png` (607×880 px, 143.0 KB)

### [32052] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.

### [32053] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 53
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.

### [32054] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 54
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.


### Set: Colossus Nemesis

### [32026] Juggernaut
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 4, **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Colossus Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brute. Elite.*
- **Rules Text**:
  > Stalwart. Toughness.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, that attack gains overkill and piercing.
- **Flavor**: *"Nothing can stop the Juggernaut!"*
- **Image Asset**: `assets/card-art/bundles/cards/32026.png` (607×880 px, 127.9 KB)

### [32027] Rampaging Juggernaut
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Colossus Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Discard each tough status card from each friendly character. Place 2 threat here for each tough status card discarded this way.
- **Flavor**: *Juggernaut possesses the power of Cyttorak, but it also drives him mad.*
- **Image Asset**: `assets/card-art/bundles/cards/32027.png` (1030×710 px, 333.5 KB)

### [32028] Unstoppable
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus Nemesis (3–4/5, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Colossus Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to the enemy with the highest printed ATK without a copy of Unstoppable attached. Otherwise, this card gains surge.
  > [star] **Forced Interrupt**: When attached enemy attacks, the attack gains overkill and piercing. At the end of this attack, discard Unstoppable.
- **Image Asset**: `assets/card-art/bundles/cards/32028.png` (607×880 px, 148.6 KB)

### [32029] Slammed
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Colossus Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Colossus Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are stunned. If you are already stunned, take 2 damage.
  >
  > ---
  >
  > [star] **Boost**: Reveal this card.
- **Flavor**: *"Don't you know who I am?" —Juggernaut*
- **Image Asset**: `assets/card-art/bundles/cards/32029.png` (607×880 px, 133.2 KB)


### Set: Shadowcat

### [32030a] Shadowcat
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 2, **DEF**: 2, **HP**: 9, **Hand Size**: 5
- **Traits**: *X-Men.*
- **Rules Text**:
  > *Selective Intangibility* - While you are in Phased mass form, Shadowcat ignores the guard and patrol keywords, and any crisis icons ([crisis]) in play.
- **Image Asset**: `assets/card-art/bundles/cards/32030a.png` (607×880 px, 147.4 KB)

### [32030b] Kitty Pryde
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *Mutant.*
- **Rules Text**:
  > **Setup**: Put your mass form upgrade into play, Solid side faceup.
  > *Phase Control* - **Action**: Flip your mass form upgrade. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/32030b.png` (607×880 px, 148.0 KB)

### [32031a] Solid
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (1/16)
- **Properties**: Permanent
- **Stats**: **Resources**: [physical]
- **Rules Text**:
  > Mass form. Permanent.
  > **Hero Resource**: Exhaust this card → generate a [physical] resource for an [[attack]] or [[defense]] event.
  > **Response**: After you attack or defend in Solid mass form, flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/32031a.png` (607×880 px, 135.9 KB)

### [32031b] Phased
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (1/16)
- **Properties**: Permanent
- **Stats**: **Resources**: [mental]
- **Rules Text**:
  > Mass form. Permanent.
  > While Shadowcat is defending, she cannot take damage.
  > **Forced Response**: After you attack or defend in Phased mass form, flip this card.
- **Image Asset**: `assets/card-art/bundles/cards/32031b.png` (607×880 px, 140.7 KB)

### [32032] Lockheed
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (2/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [wild]
- **Traits**: *Dragon. X-Men.*
- **Rules Text**:
  > **Response**: After Lockheed enters play, if you are in:
  > • Solid mass form, deal 2 damage to an enemy.
  > • Phased mass form, remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32032.png` (607×880 px, 129.8 KB)

### [32033] Kitty's Room
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (3/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Location.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Kitty's Room → if you are in:
  > • Solid mass form, heal 2 damage from Kitty Pryde.
  > • Phased mass form, draw 1 card.
- **Image Asset**: `assets/card-art/bundles/cards/32033.png` (607×880 px, 147.4 KB)

### [32034] Acute Control
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (4/16)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Response**: After you ignore the guard or patrol keyword on a minion, exhaust Acute Control → deal 2 damage to that minion.
- **Image Asset**: `assets/card-art/bundles/cards/32034.png` (607×880 px, 171.2 KB)

### [32035] Intangible Interference
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (5/16)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower.*
- **Rules Text**:
  > **Hero Response**: After you ignore the crisis icon ([crisis]) on a scheme, exhaust Intangible Interference → remove 2 threat from that scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32035.png` (607×880 px, 144.6 KB)

### [32036] Phased and Confused
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (6–7/16, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Hero form only. Attach to an enemy. Max 1 per enemy.
  > **Forced Interrupt**: When attached enemy would attack, discard this card instead. Then, confuse that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/32036.png` (607×880 px, 136.7 KB)

### [32037] Shadowcat Surprise
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (8–10/16, Qty: 3)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 3 damage to an enemy. Ready your hero.
- **Image Asset**: `assets/card-art/bundles/cards/32037.png` (607×880 px, 130.5 KB)

### [32038] Phase Strike
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (11–12/16, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *Attack. Superpower.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 6 damage to an enemy. If you are in Phased mass form, you may discard an attachment with the text "**Hero Action**" or "**Hero Response**" from that enemy.
- **Image Asset**: `assets/card-art/bundles/cards/32038.png` (607×880 px, 144.0 KB)

### [32039] Airwalk
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (13–14/16, Qty: 2)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Superpower. Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 2 threat from a scheme (4 threat instead if you are in Phased mass form).
- **Image Asset**: `assets/card-art/bundles/cards/32039.png` (607×880 px, 137.3 KB)

### [32040] Quick Shift
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (15–16/16, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Defense. Superpower.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When an enemy attacks, if you are in:
  > • Solid mass form, change to Phased mass form.
  > • Phased mass form, draw 2 cards.
- **Image Asset**: `assets/card-art/bundles/cards/32040.png` (607×880 px, 132.3 KB)

### [32055] Permanently Phased
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Shadowcat Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Kitty Pryde player.***
  > Flip your mass form upgrade to Phased. You cannot attack, defend or change mass form.
  > **Alter-Ego Action**: Exhaust Kitty Pryde → remove Permanently Phased from the game.
- **Image Asset**: `assets/card-art/bundles/cards/32055.png` (607×880 px, 140.7 KB)


### Set: Aggression

### [32041] Wolverine — *Logan*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 41
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 1 (Consequential: 1), **ATK**: 3 [star] (Consequential: 2), **HP**: 4, **Resources**: [physical]
- **Traits**: *X-Men.*
- **Rules Text**:
  > [star] Wolverine's attacks gain piercing.
  > **Response**: After your turn begins, heal 1 damage from Wolverine.
- **Image Asset**: `assets/card-art/bundles/cards/32041.png` (607×880 px, 139.2 KB)

### [32042] Magik — *Illyana Rasputin*
- **Type**: `Ally`
- **Faction / Aspect**: Aggression
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 42
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *Mystic. X-Men.*
- **Rules Text**:
  > **Response**: After you play Magik from your hand, spend a [mental] resource → choose a non-[[Elite]] minion engaged with an [[X-MEN]] hero. Shuffle that minion into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/32042.png` (607×880 px, 134.7 KB)

### [32043] Attack Training
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 43
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Training.*
- **Rules Text**:
  > Attach to an [[X-MEN]] ally. Max 1 [[Training]] upgrade per ally.
  > Attached ally gets +1 ATK and +2 hit points.
- **Image Asset**: `assets/card-art/bundles/cards/32043.png` (607×880 px, 137.3 KB)

### [32044] Gatekeeper
- **Type**: `Upgrade`
- **Faction / Aspect**: Aggression
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 44
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to a minion.
  > Attached minion gets +2 hit points and gains patrol.
  > **Interrupt**: When attached minion is defeated, remove 4 threat from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32044.png` (607×880 px, 116.9 KB)

### [32045] Team Strike
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 45
- **Stats**: **Cost**: 1, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > Play only if your identity has the [[X-MEN]] trait.
  > **Hero Action** *(attack)*: Exhaust your hero and any number of [[X-MEN]] allies → deal X damage among enemies in play, where X is the total ATK of the characters you exhausted this way.
- **Image Asset**: `assets/card-art/bundles/cards/32045.png` (607×880 px, 136.3 KB)

### [32046] Toe to Toe
- **Type**: `Event`
- **Faction / Aspect**: Aggression
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 46
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Choose an enemy. That enemy attacks you. Deal 5 damage to that enemy.
- **Flavor**: *"How about a taste of your own medicine?" —Captain Marvel*
- **Image Asset**: `assets/card-art/bundles/cards/32046.png` (607×880 px, 131.0 KB)

### [32047] Aggressive Energy
- **Type**: `Resource`
- **Faction / Aspect**: Aggression
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Pack Position: 47
- **Stats**: **Resources**: [wild]
- **Rules Text**:
  > Max 2 per deck.
  > **Hero Interrupt**: When you spend this card to play a [[Attack]] event, that event deals 1 additional damage.
- **Image Asset**: `assets/card-art/bundles/cards/32047.png` (607×880 px, 138.3 KB)


### Set: Shadowcat Nemesis

### [32056] White Queen
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Shadowcat Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Psionic.*
- **Rules Text**:
  > Villainous.
  > While White Queen is engaged with you, you are confused. *(Shadowcat's nemesis minion.)*
  >
  > ---
  >
  > [star] **Boost**: You are confused.
- **Image Asset**: `assets/card-art/bundles/cards/32056.png` (607×880 px, 130.6 KB)

### [32057] The Hellfire Club
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat Nemesis (2/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Shadowcat Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme searches the encounter deck, discard pile, and set-aside area for a copy of the Hellfire Pawn minion and puts it into play engaged with them. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/32057.png` (1030×710 px, 336.0 KB)

### [32058] Hellfire Pawn
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Shadowcat Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Hellfire.*
- **Rules Text**:
  > Guard. Patrol. Surge.
  >
  > ---
  >
  > [star] **Boost**: Put Hellfire Pawn into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/32058.png` (607×880 px, 122.3 KB)

### [32059] Telepathic Restraint
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Shadowcat Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Shadowcat Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your identity.
  > While Telepathic Restraint is attached to your identity, you are stunned.
  > **Action**: Spend [mental] [mental] resources → discard this card.
- **Flavor**: *"Be a dear and don't move... or talk. That's better." —White Queen*
- **Image Asset**: `assets/card-art/bundles/cards/32059.png` (607×880 px, 133.8 KB)


### Set: Sabretooth

### [32060] Sabretooth
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (1/17)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1 [star], **ATK**: 2 [star], **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > [star] **Forced Response**: After Sabretooth activates against you, discard the top card of the encounter deck. Heal damage from Sabretooth equal to the number of boost icons ([boost]) discarded this way.
- **Flavor**: *"I'll rip yer guts out!"*
- **Image Asset**: `assets/card-art/bundles/cards/32060.png` (607×880 px, 148.1 KB)

### [32061] Sabretooth
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (2/17)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Response**: After Sabretooth activates against you, discard the top card of the encounter deck. Heal damage from Sabretooth equal to the number of boost icons ([boost]) discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/32061.png` (607×880 px, 150.8 KB)

### [32062] Sabretooth
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (3/17)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 2 [star], **ATK**: 3 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Retaliate 1. Toughness.
  > [star] **Forced Response**: After Sabretooth activates against you, discard the top card of the encounter deck. Heal damage from Sabretooth equal to the number of boost icons ([boost]) discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/32062.png` (607×880 px, 147.2 KB)

### [32063] Stalked by Sabretooth
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (4/17)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0 per hero, **Escalation Threat**: +1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step 1 of the villain phase, deal 2 damage to Robert Kelly (3 damage instead if there is at least 6 [per_hero] threat here).
  > While Robert Kelly is attached to Find the Senator, treat his text box as if it were blank.
  > **If Robert Kelly leaves play, the players lose the game.**
- **Reverse Side**
  > **Contents:** Sabretooth (I) and Sabretooth (II). *(Sabretooth (II) and Sabretooth (III) for expert mode.)* Sabretooth and Standard sets. Two modular sets (*Brotherhood* and *Mystique*).
  > **Setup:** Put the Find the Senator side scheme into play. Attach the Robert Kelly to it. While attached to Find the Senator, Robert Kelly is in play but under no player's control.
- **Image Asset**: `assets/card-art/bundles/cards/32063.png` (1030×710 px, 351.0 KB)

### [32063a] Stalked by Sabretooth
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (4/17)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Sabretooth (I) and Sabretooth (II). *(Sabretooth (II) and Sabretooth (III) for expert mode.)* Sabretooth and Standard sets. Two modular sets (*Brotherhood* and *Mystique*).
  > **Setup**: Put the Find the Senator side scheme into play. Attach the Robert Kelly to it. While attached to Find the Senator, Robert Kelly is in play but under no player's control.
- **Image Asset**: `assets/card-art/bundles/cards/32063a.png` (1030×710 px, 351.0 KB)

### [32063b] Stalked by Sabretooth
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (4/17)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0 per hero, **Escalation Threat**: +1 [star] per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > [star] **Forced Response**: After resolving step 1 of the villain phase, deal 2 damage to Robert Kelly (3 damage instead if there is at least 6 [per_hero] threat here).
  > While Robert Kelly is attached to Find the Senator, treat his text box as if it were blank.
  > **If Robert Kelly leaves play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/32063b.png` (1030×710 px, 336.0 KB)

### [32064] The Injured Senator
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (5/17)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Completed**: Defeat Robert Kelly.
  > **If Robert Kelly leaves play, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Deal each player a facedown encounter card.
  - **Back Flavor**: *Sabretooth has wounded Senator Kelly and continues to hound him!*
- **Flavor**: *Get Robert Kelly to safety before Sabretooth finishes the job.*
- **Image Asset**: `assets/card-art/bundles/cards/32064.jpg` (1030×710 px, 301.9 KB)

### [32064a] The Injured Senator
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (5/17)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal each player a facedown encounter card.
- **Flavor**: *Sabretooth has wounded Senator Kelly and continues to hound him!*
- **Image Asset**: `assets/card-art/bundles/cards/32064a.png` (1030×710 px, 301.9 KB)

### [32064b] The Injured Senator
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (5/17)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 9 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Completed**: Defeat Robert Kelly.
  > **If Robert Kelly leaves play, the players lose the game.**
- **Flavor**: *Get Robert Kelly to safety before Sabretooth finishes the job.*
- **Image Asset**: `assets/card-art/bundles/cards/32064b.png` (1030×710 px, 271.5 KB)

### [32065a] Find the Senator
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (6/17)
- **Stats**: **Base Threat**: 5 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Robert Kelly cannot be healed by player card effects and cannot have upgrades attached.
  > **When Defeated**: The first player detaches Robert Kelly from this scheme and takes control of him. Advance to main scheme 2A. Flip this card and place it next the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32065a.png` (1030×710 px, 296.8 KB)

### [32065b] Protect the Senator
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (6/17)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mission.*
- **Rules Text**:
  > Robert Kelly cannot be healed by player card effects and cannot have upgrades attached.
  > **Hero Response**: After your hero defends against an attack from Sabretooth, spend 2 resources of any type → ready your hero. Only the player who controls Robert Kelly can trigger this ability.
- **Image Asset**: `assets/card-art/bundles/cards/32065b.png` (607×880 px, 140.7 KB)

### [32066] Robert Kelly
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (7/17)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **HP**: 9
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Senator.*
- **Rules Text**:
  > The first player controls Robert Kelly. He does not count against your ally limit and cannot have player cards attached.
  > **Forced Interrupt**: When an enemy resolves an undefended attack against you, deal the damage to Robert Kelly.
- **Image Asset**: `assets/card-art/bundles/cards/32066.png` (607×880 px, 143.6 KB)

### [32067] Adamantium Claws
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (8/17)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Sabretooth.
  > [star] Sabretooth's attacks gain piercing.
  > **Hero Action**: Spend [energy] [mental] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Sabretooth.
- **Image Asset**: `assets/card-art/bundles/cards/32067.png` (607×880 px, 129.7 KB)

### [32068] Animal Ferocity
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (9/17)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Sabretooth.
  > Sabretooth gains stalwart. (This character cannot be stunned or confused.)
  > **Hero Action**: Spend [energy] [mental] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Sabretooth.
- **Image Asset**: `assets/card-art/bundles/cards/32068.png` (607×880 px, 144.9 KB)

### [32069] Sabretooth Strikes
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (10–11/17, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to Robert Kelly. You may exhaust your hero to prevent this.
  >
  > ---
  >
  > [star] **Boost**: If this attack defeats an ally, place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32069.png` (607×880 px, 120.1 KB)

### [32070] Unrelenting Savage
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (12–14/17, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter_Ego)**: Sabretooth schemes. If he has no sustained damage, he gets +1 SCH for this activation.
  > **When Revealed (Hero)**: Sabretooth attacks you. If he has no sustained damage, he gets +1 ATK for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/32070.png` (607×880 px, 132.0 KB)

### [32071] Medical Emergency
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (15–16/17, Qty: 2)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 2 [per_hero].
  > Victory 1.
  > **When Defeated**: Heal 2 damage from Robert Kelly.
- **Image Asset**: `assets/card-art/bundles/cards/32071.png` (1030×710 px, 281.5 KB)

### [32072] Feral Rage
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sabretooth (17/17)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sabretooth Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: Sabretooth attacks the player who defeated this scheme (even if that player is in alter-ego form).
- **Flavor**: *Sabretooth has worked himself into a frenzy in his hunt for Kelly. You need to draw his attention away from the Senator!*
- **Image Asset**: `assets/card-art/bundles/cards/32072.png` (1030×710 px, 273.9 KB)


### Set: Brotherhood

### [32073] Avalanche
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brotherhood (1/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Brotherhood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > [star] **Forced Response**: After Avalanche attacks you, exhaust a character you control.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/32073.png` (607×880 px, 125.0 KB)

### [32074] Blob
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brotherhood (2/8)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brotherhood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Guard.
  > [star] **Forced Response**: After Blob attacks and damages a character, stun that character.
- **Flavor**: *Nothing moves the Blob!*
- **Image Asset**: `assets/card-art/bundles/cards/32074.png` (607×880 px, 124.4 KB)

### [32075] Pyro
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brotherhood (3/8)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 0 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brotherhood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > [star] **Forced Response**: After Pyro attacks you, discard the top 2 cards of your deck. Take 1 indirect damage for each printed resource icon discarded this way.
- **Flavor**: *I always play with fire. And I never get burned!*
- **Image Asset**: `assets/card-art/bundles/cards/32075.png` (607×880 px, 138.5 KB)

### [32076] Toad
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brotherhood (4/8)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Brotherhood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > [star] **Forced Response**: After Toad attacks and damages a character you control, discard 1 random card from your hand.
  >
  > ---
  >
  > [star] **Boost**: Discard 1 random card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/32076.png` (607×880 px, 131.7 KB)

### [32077] Homo Superior
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brotherhood (5–6/8, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Brotherhood Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to a minion and give it a tough status card. Otherwise, this card gains surge.
  > Attached minion gets +5 hit points.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to a minion and give it a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/32077.png` (607×880 px, 125.2 KB)

### [32078] Mutant Terrorists
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brotherhood (7/8)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brotherhood Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for The Brotherhood side scheme and reveal it. *(Shuffle.)* If it did not enter play this way, discard cards from the top of the encounter deck until a [[Brotherhood of Mutants]] minion is discarded and reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/32078.png` (607×880 px, 147.7 KB)

### [32079] The Brotherhood
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brotherhood (8/8)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Brotherhood Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 2 [per_hero].
  > Each [[Brotherhood of Mutants]] minion gains quickstrike.
- **Flavor**: *Magneto assembled the Brotherhood of Mutants to enact his plan for mutant dominance.*
- **Image Asset**: `assets/card-art/bundles/cards/32079.png` (1030×710 px, 300.6 KB)


### Set: Mystique

### [32080] Mystique
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mystique (1/5)
- **Properties**: Unique
- **Stats**: **HP**: 9
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mystique Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants. Elite.*
- **Rules Text**:
  > Toughness.
  > Players cannot attack the villain.
  > [star] Mystique's SCH is equal to the villain's SCH, and her ATK is equal to the villain's ATK.
- **Flavor**: *I am not a woman to be trifled with!*
- **Image Asset**: `assets/card-art/bundles/cards/32080.png` (607×880 px, 126.3 KB)

### [32081] Metamorphic Mayhem
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mystique (2/5)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mystique Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme shuffles each [[Shapeshifter]] card from the encounter discard pile into their deck.
- **Flavor**: *Mystique's shapeshifting makes her all manner of trouble.*
- **Image Asset**: `assets/card-art/bundles/cards/32081.png` (1030×710 px, 258.6 KB)

### [32082] Infiltration
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mystique (3–4/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mystique Set Icon (printed bottom-right next to deck number)
- **Traits**: *Shapeshifter.*
- **Rules Text**:
  > **When Revealed**: Shuffle this card into your deck. This card gains surge.
  > **Forced Response**: After this card enters your hand, discard an ally or support you control. *(You may discard this card from your hand at the end of the player phase like any other card.)*
- **Image Asset**: `assets/card-art/bundles/cards/32082.png` (607×880 px, 140.4 KB)

### [32083] Shapeshifter Surprise
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mystique (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mystique Set Icon (printed bottom-right next to deck number)
- **Traits**: *Shapeshifter.*
- **Rules Text**:
  > **When Revealed**: Shuffle this card into your deck. This card gains surge.
  > **Forced Response**: After this card enters your hand, Mystique activates against you. Otherwise, search the encounter deck and discard pile for Mystique an reveal her.
- **Image Asset**: `assets/card-art/bundles/cards/32083.png` (607×880 px, 157.0 KB)


### Set: Project Wideawake

### [32084] Sentinel
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (1/24)
- **Properties**: Stage I
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Toughness.
  > **When Revealed**: The first player searches the encounter deck and discard pile for a copy of the Abduction Protocols side scheme and reveals it. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/32084.png` (607×880 px, 138.1 KB)

### [32085] Sentinel
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (2/24)
- **Properties**: Stage II
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Steady. Toughness.
  > **When Revealed**: The first player searches the encounter deck and discard pile for a copy of the Abduction Protocols side scheme and reveals it. *(Shuffle.)* Deal each other player a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/32085.png` (607×880 px, 139.4 KB)

### [32086] Sentinel
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (3/24)
- **Properties**: Stage III
- **Stats**: **SCH**: 3, **ATK**: 3, **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Stalwart. Toughness.
  > **When Revealed**: The first player searches the encounter deck and discard pile for a copy of the Abduction Protocols side scheme and reveals it. *(Shuffle.)* Deal each other player a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/32086.png` (607×880 px, 134.3 KB)

### [32087] Night of the Sentinels
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (4/24)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Operation Zero Tolerance gains permanent.
  > **Forced Response**: After threat is placed here, if there is at least 5 [per_hero] threat here, the first player places the top card of their deck facedown under Operation Zero Tolerance. Then, remove 5 [per_hero] threat from this scheme.
- **Reverse Side**
  > **Contents:** Sentinel (I) and Sentinel (II). *(Sentinel (II) and Sentinel (III) for expert mode.)* Project Wideawake, Zero Tolerance, and Standard sets. One modular set (*Sentinels*).
  > **Setup:** Set each [[Captive]] ally aside. Reveal the Operation Zero Tolerance and Mutants at the Mall side schemes.
- **Image Asset**: `assets/card-art/bundles/cards/32087.png` (1030×710 px, 298.2 KB)

### [32087a] Night of the Sentinels
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (4/24)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Sentinel (I) and Sentinel (II). *(Sentinel (II) and Sentinel (III) for expert mode.)* Project Wideawake, Zero Tolerance, and Standard sets. One modular set (*Sentinels*).
  > **Setup**: Set each [[Captive]] ally aside. Reveal the Operation Zero Tolerance and Mutants at the Mall side schemes.
- **Image Asset**: `assets/card-art/bundles/cards/32087a.png` (1030×710 px, 298.2 KB)

### [32087b] Night of the Sentinels
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (4/24)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Operation Zero Tolerance gains permanent.
  > **Forced Response**: After threat is placed here, if there is at least 5 [per_hero] threat here, the first player places the top card of their deck facedown under Operation Zero Tolerance. Then, remove 5 [per_hero] threat from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32087b.png` (1030×710 px, 314.1 KB)

### [32088a] Mutants at the Mall
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (5/24)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: The first player searches the encounter deck and discard pile for a [[Sentinel]] minion and reveals it. Flip this card and put Jubilee into play, discarding any other version of Jubilee from play.
- **Image Asset**: `assets/card-art/bundles/cards/32088a.png` (1030×710 px, 290.7 KB)

### [32088b] Jubilee — *Jubilation Lee*
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (5/24)
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *X-Men.*
- **Rules Text**:
  > Victory -1.
  > The first player controls Jubilee. She does not count against your ally limit.
  > **Action**: Exhaust Jubilee and spend a [energy] resource → deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/32088b.png` (607×880 px, 148.1 KB)

### [32089] Rictor — *Julio Richter*
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (6/24)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Captive. X-Men.*
- **Rules Text**:
  > [star] **Response**: After Rictor attacks, deal 1 damage to the villain and each minion engaged with you.
- **Flavor**: *"Man...have you got one weird life ahead of you."*
- **Image Asset**: `assets/card-art/bundles/cards/32089.png` (607×880 px, 143.6 KB)

### [32090] Boom Boom — *Tabitha Smith*
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (7/24)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 1 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Captive. X-Men.*
- **Rules Text**:
  > [star] **Response**: After Boom Boom attacks an enemy, place 1 bomb counter on it. At the end of the player phase, remove all bomb counters from play and deal 2 damage to each enemy for each bomb counter removed from it this way.
- **Image Asset**: `assets/card-art/bundles/cards/32090.png` (607×880 px, 150.6 KB)

### [32091] Cannonball — *Sam Guthrie*
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (8/24)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Captive. X-Men.*
- **Rules Text**:
  > [star] Cannonball takes -1 consequential damage after he attacks and defeats a minion.
- **Flavor**: *"Ah'm pretty much invulnerable when Ah'm blastin'."*
- **Image Asset**: `assets/card-art/bundles/cards/32091.png` (607×880 px, 134.4 KB)

### [32092] Wolfsbane — *Rahne Sinclair*
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (9/24)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Captive. X-Men.*
- **Rules Text**:
  > [star] Wolfbane's attacks gain piercing.
- **Flavor**: *"I dinna ken why ye're doin' this. But if'n ye hurt my friends, then yuir in fer a world o' hurt!"*
- **Image Asset**: `assets/card-art/bundles/cards/32092.png` (607×880 px, 140.2 KB)

### [32093] Sentinel Mark IV
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (10–11/24, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Guard. Patrol.
  >
  > ---
  >
  > [star] **Boost**: Put Sentinel Mark IV into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/32093.png` (607×880 px, 135.2 KB)

### [32094] Gauntlet Beam
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (12–13/24, Qty: 2)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel. Tech.*
- **Rules Text**:
  > Attach to the villain.
  > [star] The villain's attacks gain piercing and ranged.
  > **Hero Action**: Spend [physical] [physical] [physical] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Exhaust your identity.
- **Image Asset**: `assets/card-art/bundles/cards/32094.png` (607×880 px, 133.3 KB)

### [32095] Learning A.I.
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (14/24)
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel. Tech.*
- **Rules Text**:
  > Attach to the villain.
  > The villain gains retaliate 1.
  > **Hero Action**: Spend [mental] [mental] [mental] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to the villain.
- **Image Asset**: `assets/card-art/bundles/cards/32095.png` (607×880 px, 123.5 KB)

### [32096] Adaptive Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (15/24)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel. Tech.*
- **Rules Text**:
  > Attach to the villain.
  > The villain gets +8 hit points.
  > **Hero Action**: Spend [energy] [energy] [energy] resources → discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to the villain.
- **Image Asset**: `assets/card-art/bundles/cards/32096.png` (607×880 px, 126.6 KB)

### [32097] Self-Repair
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (16/24)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Discard each status card from the villain. Give the villain a tough status card and heal 5 damage from it.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/32097.png` (607×880 px, 117.0 KB)

### [32098] Mutant Detected
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (17–18/24, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Place the top card of your deck facedown under Operation Zero Tolerance.
  > • The villain and each minion engaged with you attacks you *(even if you are in alter-ego form)*.
- **Image Asset**: `assets/card-art/bundles/cards/32098.png` (607×880 px, 147.3 KB)

### [32099] Warn the Others
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (19–20/24, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After your turn ends, place this card facedown under Operation Zero Tolerance.
  > **Alter-Ego Action**: Exhaust your identity → discard this card.
- **Flavor**: *"If we don't get to our friends first, they'll be captured for sure!" —Iceman*
- **Image Asset**: `assets/card-art/bundles/cards/32099.png` (607×880 px, 149.1 KB)

### [32100] Abduction Protocols
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Project Wideawake (21–24/24, Qty: 4)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Project Wideawake Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 2 [per_hero]. Victory 2.
  > **When Defeated**: The player who defeated this scheme takes 1 random set-aside [[Captive]] ally and puts it into play under their control.
- **Image Asset**: `assets/card-art/bundles/cards/32100.png` (1030×710 px, 301.2 KB)


### Set: Zero Tolerance

### [32101] Sentinel Mark II
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Zero Tolerance (1–2/7, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zero Tolerance Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > **When Revealed**: If Operation Zero Tolerance is in play, Sentinel Mark II gains surge. Otherwise, search the encounter deck and discard pile for the Operation Zero Tolerance side scheme and reveal it. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/32101.png` (607×880 px, 133.9 KB)

### [32102] Sentinel Mark III
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Zero Tolerance (3–4/7, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Zero Tolerance Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Toughness.
  > **When Revealed**: Search the encounter deck and discard pile for the Energy Barrier attachment and attach it to this minion.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. If you are already stunned, take 2 damage.
- **Image Asset**: `assets/card-art/bundles/cards/32102.png` (607×880 px, 134.4 KB)

### [32103] Energy Barrier
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Zero Tolerance (5–6/7, Qty: 2)
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zero Tolerance Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel. Tech.*
- **Rules Text**:
  > Attach to a [[Sentinel]] minion without Energy Barrier attached and give it a tough status card. Otherwise, this card gains surge.
  > [star] **Forced Response**: After attached minion attacks, give it a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/32103.png` (607×880 px, 138.4 KB)

### [32104] Operation Zero Tolerance
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Zero Tolerance (7/7)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Zero Tolerance Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After an enemy attacks and defeats an ally, place that ally facedown under this scheme.
  > **If there are X facedown cards under this scheme, the players lose the game. X is 3 more than the number of players.**
- **Image Asset**: `assets/card-art/bundles/cards/32104.png` (1030×710 px, 279.1 KB)


### Set: Sentinels

### [32105] Sentinel Mark V
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sentinels (1–2/7, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 3, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sentinels Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > **When Revealed**: If Targeted for Elimination is attached to your identity, Sentinel Mark V attacks you *(even if you are in alter-ego form). Otherwise, search the encounter deck and discard pile for the Targeted for Elimination attachment and reveal it.*
- **Image Asset**: `assets/card-art/bundles/cards/32105.png` (607×880 px, 142.5 KB)

### [32106] Sentinel Mark VI
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sentinels (3–4/7, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Sentinels Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Quickstrike.
  >
  > ---
  >
  > [star] **Boost**: If Targeted for Elimination is attached to an identity, deal this card to that player as a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/32106.png` (607×880 px, 126.1 KB)

### [32107] Targeted for Elimination
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sentinels (5–6/7, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sentinels Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity if a copy of Targeted for Elimination is not attached to you. Otherwise, this card gains surge.
  > While you are engaged with a [[Sentinel]] minion, you cannot change from hero form to alter-ego form.
  > **Action**: Exhaust your identity → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/32107.png` (607×880 px, 128.7 KB)

### [32108] Relentless Robots
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Sentinels (7/7)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Sentinels Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Each player engaged with a [[Sentinel]] minion cannot thwart this scheme.
- **Flavor**: *Sentinels were constructed solely for hunting mutants. They do not tire. They do not stop until they capture their target.*
- **Image Asset**: `assets/card-art/bundles/cards/32108.png` (1030×710 px, 276.9 KB)


### Set: Master Mold

### [32109] Master Mold
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (1/18)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 1 [star], **ATK**: 2, **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Stalwart. Toughness.
  > [star] **Forced Interrupt**: When Master Mold schemes against you, discard cards from the encounter deck until a [[Sentinel]] minion is discarded. Put that minion into play engaged with you. Do not give Master Mold a boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/32109.png` (607×880 px, 142.4 KB)

### [32110] Master Mold
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (2/18)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2 [star], **ATK**: 3, **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Stalwart. Toughness.
  > [star] **Forced Interrupt**: When Master Mold schemes against you, discard cards from the encounter deck until a [[Sentinel]] minion is discarded. Put that minion into play engaged with you. Do not give Master Mold a boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/32110.png` (607×880 px, 142.7 KB)

### [32111] Master Mold
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (3/18)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3 [star], **ATK**: 4, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Stalwart. Toughness.
  > [star] **Forced Interrupt**: When Master Mold schemes against you, discard cards from the encounter deck until a [[Sentinel]] minion is discarded. Put that minion into play engaged with you. Do not give Master Mold a boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/32111.png` (607×880 px, 141.8 KB)

### [32112] The Sentinel Factory
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (4/18)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[Sentinel]] minion gains guard.
  > **When Revealed**: Each player discards cards from the encounter deck until they discard a [[Sentinel]] minion, then puts it into play engaged with them.
- **Reverse Side**
  > **Contents:** Master Mold (I) and Master Mold (II). *(Master Mold (II) and Master Mold (III) for expert mode.)* Master Mold, Sentinels, and Standard sets. One modular set (*Zero Tolerance*).
  > **Setup:** Put the Magneto Ally (172B) into play under the first player's control.
- **Image Asset**: `assets/card-art/bundles/cards/32112.jpg` (1030×710 px, 339.4 KB)

### [32112a] The Sentinel Factory
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (4/18)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Master Mold (I) and Master Mold (II). *(Master Mold (II) and Master Mold (III) for expert mode.)* Master Mold, Sentinels, and Standard sets. One modular set (*Zero Tolerance*).
  > **Setup**: Put the Magneto Ally (172B) into play under the first player's control.
- **Image Asset**: `assets/card-art/bundles/cards/32112a.png` (1030×710 px, 339.4 KB)

### [32112b] The Sentinel Factory
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (4/18)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[Sentinel]] minion gains guard.
  > **When Revealed**: Each player discards cards from the encounter deck until they discard a [[Sentinel]] minion, then puts it into play engaged with them.
- **Image Asset**: `assets/card-art/bundles/cards/32112b.png` (1030×710 px, 300.9 KB)

### [32113] Master Mold's Agenda
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (5/18)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[Sentinel]] minion gains guard.
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Shuffle the encounter discard pile into the encounter deck. Each player discards cards from the encounter deck until they discard a [[Sentinel]] minion, then puts it into play engaged with them.
- **Flavor**: *Master Mold's programming has backfired! Recognizing that mutants come from humans, the giant Sentinel is programming its 'offspring' to subdue everyone on Earth!*
- **Image Asset**: `assets/card-art/bundles/cards/32113.png` (880×607 px, 215.7 KB)

### [32113a] Master Mold's Agenda
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (5/18)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Shuffle the encounter discard pile into the encounter deck. Each player discards cards from the encounter deck until they discard a [[Sentinel]] minion, then puts it into play engaged with them.
- **Image Asset**: `assets/card-art/bundles/cards/32113a.png` (880×607 px, 215.7 KB)

### [32113b] Master Mold's Agenda
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (5/18)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 8 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[Sentinel]] minion gains guard.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Master Mold's programming has backfired! Recognizing that mutants come from humans, the giant Sentinel is programming its 'offspring' to subdue everyone on Earth!*
- **Image Asset**: `assets/card-art/bundles/cards/32113b.png` (880×607 px, 215.6 KB)

### [32114] Sentinel Mark VIII
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (6–7/18, Qty: 2)
- **Stats**: **SCH**: 3, **ATK**: 3, **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > **Forced Response**: After this minion engages you, attach the topmost [[Sentinel]] attachment from the discard pile to this minion.
- **Flavor**: *"They've upgraded their armor!" —Cyclops*
- **Image Asset**: `assets/card-art/bundles/cards/32114.png` (607×880 px, 128.5 KB)

### [32115] Unit Upgrade
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (8–9/18, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel. Tech.*
- **Rules Text**:
  > Attach to a [[Sentinel]] minion. Otherwise, this card gains surge.
  > Attached minion gets +2 hit points and gains retaliate 1.
  >
  > ---
  >
  > [star] **Boost**: Attach to a [[Sentinel]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/32115.png` (607×880 px, 138.1 KB)

### [32116] Stun Beam
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (10–11/18, Qty: 2)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel. Tech.*
- **Rules Text**:
  > Attach to a [[Sentinel]] minion without Stun Beam attached. Otherwise, this card gains surge.
  > [star] **Forced Response**: After attached minion attacks and damages a character, stun that character.
- **Image Asset**: `assets/card-art/bundles/cards/32116.png` (607×880 px, 138.8 KB)

### [32117] Master Mold's Children
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (12–13/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Each minion engaged with you schemes. If you are not engaged with a minion, Master Mold schemes.
  > **When Revealed (Hero)**: Each minion engaged with you attacks you. If you are not engaged with a minion, Master Mold attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/32117.png` (607×880 px, 132.8 KB)

### [32118] Shields Up
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (14–15/18, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Give each [[Sentinel]] minion engaged with you a tough status card. Otherwise, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Give the villain a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/32118.png` (607×880 px, 124.4 KB)

### [32119] Intruder Alert!
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (16/18)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme discards cards from the encounter deck until they discard a [[Sentinel]] minion, then puts it into play engaged with them.
- **Image Asset**: `assets/card-art/bundles/cards/32119.png` (880×607 px, 208.3 KB)

### [32120] Insert Virus Program
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Master Mold (17–18/18, Qty: 2)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Master Mold Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 2 [per_hero]. Victory 1.
  > **When Defeated**: Deal 2 damage to each [[Sentinel]] enemy.
- **Flavor**: *If you can insert a computer virus into Master Mold's mainframe, you can weaken it from the inside.*
- **Image Asset**: `assets/card-art/bundles/cards/32120.png` (880×607 px, 206.4 KB)


### Set: Mansion Attack

### [32121a] Avalanche
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (1/25)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 15 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Toughness. Victory 2.
  > [star] **Forced Response**: After Avalanche attacks you, exhaust an ally you control.
- **Flavor**: *"Come out and fight, or I'll bring the whole building down!"*
- **Image Asset**: `assets/card-art/bundles/cards/32121a.png` (607×880 px, 149.6 KB)

### [32121b] Avalanche
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (1/25)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 4 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Toughness. Victory 2.
  > [star] **Forced Response**: After Avalanche attacks you, exhaust an ally you control.
- **Flavor**: *"Come out and fight, or I'll bring the whole building down!"*
- **Image Asset**: `assets/card-art/bundles/cards/32121b.png` (607×880 px, 153.7 KB)

### [32122a] Blob
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (2/25)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Toughness. Victory 2.
  > [star] **Forced Response**: After Blob attacks and damages a character, stun that character.
- **Flavor**: *"First I'm going to crush you! Then I'm going to raid your fridge!"*
- **Image Asset**: `assets/card-art/bundles/cards/32122a.png` (607×880 px, 142.6 KB)

### [32122b] Blob
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (2/25)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 19 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Toughness. Victory 2.
  > [star] **Forced Response**: After Blob attacks and damages a character, stun that character.
- **Flavor**: *"First I'm going to crush you! Then I'm going to raid your fridge!"*
- **Image Asset**: `assets/card-art/bundles/cards/32122b.png` (607×880 px, 144.4 KB)

### [32123a] Pyro
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (3/25)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 0 [star], **HP**: 14 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Toughness. Victory 2.
  > [star] **Forced Response**: After Pyro attacks you, discard the top 2 cards of your deck. Take 1 indirect damage for each printed resource icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/32123a.png` (607×880 px, 146.2 KB)

### [32123b] Pyro
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (3/25)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 17 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Toughness. Victory 2.
  > [star] **Forced Response**: After Pyro attacks you, discard the top 2 cards of your deck. Take 1 indirect damage for each printed resource icon discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/32123b.png` (607×880 px, 136.6 KB)

### [32124a] Toad
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (4/25)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Toughness. Victory 2.
  > [star] **Forced Response**: After Toad attacks and damages a character you control, discard 1 random card from your hand.
- **Flavor**: *"You X-Men think you're so much better than me! I'll show you!"*
- **Image Asset**: `assets/card-art/bundles/cards/32124a.png` (607×880 px, 157.1 KB)

### [32124b] Toad
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (4/25)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 3, **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Toughness. Victory 2.
  > [star] **Forced Response**: After Toad attacks and damages a character you control, discard 1 random card from your hand.
- **Flavor**: *"You X-Men think you're so much better than me! I'll show you!"*
- **Image Asset**: `assets/card-art/bundles/cards/32124b.png` (607×880 px, 151.5 KB)

### [32125] The Brotherhood Strikes!
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (5/25)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal each player a facedown encounter card. Advance to the next card in the main scheme deck. Add this card to the victory display.
- **Reverse Side**
  > **Contents:** Avalanche (A), Blob (A), Pyro (A), and Toad (A). *(Use their (B) sides for expert mode.)* Mansion Attack, Brotherhood, and Standard sets. One modular set (*Mystique*).
  > **Setup:** Put the Save the School environment into play. Shuffle all copies of main scheme 2A and stack them under this scheme. Shuffle the villains together *(without looking)* to create the villain deck. The top card of this deck is in play.
- **Flavor**: *The Xavier Institute is under attack by the Brotherhood of Mutants!*
- **Image Asset**: `assets/card-art/bundles/cards/32125.png` (880×607 px, 234.9 KB)

### [32125a] The Brotherhood Strikes!
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (5/25)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Avalanche (A), Blob (A), Pyro (A), and Toad (A). *(Use their (B) sides for expert mode.)* Mansion Attack, Brotherhood, and Standard sets. One modular set (*Mystique*).
  > **Setup**: Put the Save the School environment into play. Shuffle all copies of main scheme 2A and stack them under this scheme. Shuffle the villains together *(without looking)* to create the villain deck. The top card of this deck is in play.
- **Image Asset**: `assets/card-art/bundles/cards/32125a.png` (880×607 px, 234.9 KB)

### [32125b] The Brotherhood Strikes!
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (5/25)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 0 per hero, **Target Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal each player a facedown encounter card. Advance to the next card in the main scheme deck. Add this card to the victory display.
- **Flavor**: *The Xavier Institute is under attack by the Brotherhood of Mutants!*
- **Image Asset**: `assets/card-art/bundles/cards/32125b.png` (880×607 px, 222.5 KB)

### [32126] The Atrium
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (6/25)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each character gains steady.
  > **When Completed**: Add this scheme to the victory display. Advance to the next card in the main scheme deck.
  >  **If there are 3 main schemes in the victory display, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Flip this card.
  - **Back Flavor**: *The Brotherhood strike in unison, focusing their attack on...*
- **Image Asset**: `assets/card-art/bundles/cards/32126.png` (880×607 px, 194.9 KB)

### [32126a] The Atrium
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (6/25)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Flip this card.
- **Flavor**: *The Brotherhood strike in unison, focusing their attack on...*
- **Image Asset**: `assets/card-art/bundles/cards/32126a.png` (880×607 px, 194.9 KB)

### [32126b] The Atrium
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (6/25)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each character gains steady.
  > **When Completed**: Add this scheme to the victory display. Advance to the next card in the main scheme deck.
  >  **If there are 3 main schemes in the victory display, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/32126b.png` (880×607 px, 215.4 KB)

### [32127] The Cafeteria
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (7/25)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each character gains retaliate 1.
  > **When Completed**: Add this scheme to the victory display. Advance to the next card in the main scheme deck.
  >  **If there are 3 main schemes in the victory display, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Flip this card.
  - **Back Flavor**: *The Brotherhood strike in unison, focusing their attack on...*
- **Image Asset**: `assets/card-art/bundles/cards/32127.jpg` (880×607 px, 194.9 KB)

### [32127a] The Cafeteria
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (7/25)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Flip this card.
- **Flavor**: *The Brotherhood strike in unison, focusing their attack on...*
- **Image Asset**: `assets/card-art/bundles/cards/32127a.png` (880×607 px, 194.9 KB)

### [32127b] The Cafeteria
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (7/25)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each character gains retaliate 1.
  > **When Completed**: Add this scheme to the victory display. Advance to the next card in the main scheme deck.
  >  **If there are 3 main schemes in the victory display, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/32127b.png` (880×607 px, 217.2 KB)

### [32128] The Basketball Court
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (8/25)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each ally and minion gains toughness.
  > **When Completed**: Add this scheme to the victory display. Advance to the next card in the main scheme deck.
  >  **If there are 3 main schemes in the victory display, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Flip this card.
  - **Back Flavor**: *The Brotherhood strike in unison, focusing their attack on...*
- **Image Asset**: `assets/card-art/bundles/cards/32128.jpg` (880×607 px, 194.9 KB)

### [32128a] The Basketball Court
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (8/25)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Flip this card.
- **Flavor**: *The Brotherhood strike in unison, focusing their attack on...*
- **Image Asset**: `assets/card-art/bundles/cards/32128a.png` (880×607 px, 194.9 KB)

### [32128b] The Basketball Court
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (8/25)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each ally and minion gains toughness.
  > **When Completed**: Add this scheme to the victory display. Advance to the next card in the main scheme deck.
  >  **If there are 3 main schemes in the victory display, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/32128b.png` (880×607 px, 228.9 KB)

### [32129] The Courtyard
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (9/25)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each character gains +1 ATK.
  > **When Completed**: Add this scheme to the victory display. Advance to the next card in the main scheme deck.
  >  **If there are 3 main schemes in the victory display, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Flip this card.
  - **Back Flavor**: *The Brotherhood strike in unison, focusing their attack on...*
- **Image Asset**: `assets/card-art/bundles/cards/32129.png` (880×607 px, 194.9 KB)

### [32129a] The Courtyard
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (9/25)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Flip this card.
- **Flavor**: *The Brotherhood strike in unison, focusing their attack on...*
- **Image Asset**: `assets/card-art/bundles/cards/32129a.png` (880×607 px, 194.9 KB)

### [32129b] The Courtyard
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (9/25)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each character gains +1 ATK.
  > **When Completed**: Add this scheme to the victory display. Advance to the next card in the main scheme deck.
  >  **If there are 3 main schemes in the victory display, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/32129b.png` (880×607 px, 222.9 KB)

### [32130] Save the School
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (10/25)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After the villain is defeated, if there are X villains in the victory display, the players win the game. (See rulebook, page 15.) Otherwise, deal each player an encounter card and reveal the next villain. If a minion with the same title as the new villain is engaged with a player, discard that minion and the villain activates against that player.
- **Image Asset**: `assets/card-art/bundles/cards/32130.png` (607×880 px, 151.7 KB)

### [32131] Brotherhood Beatdown
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (11–13/25, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: For each of the following enemies in play:
  > - Avalanche, exhaust your identity.
  > - Blob, you are stunned.
  > - Pyro, take 2 indirect damage.
  > - Toad, discard 1 random card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/32131.png` (607×880 px, 136.3 KB)

### [32132] Ground Swell
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (14–15/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Avalanche activates against you. If he is not in play, search the encounter deck and discard pile for the Avalanche minion and reveal him.
  >
  > ---
  >
  > [star] **Boost**: If the villain is Avalanche, give him an additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/32132.png` (607×880 px, 147.8 KB)

### [32133] Immovable
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (16–17/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Blob activates against you. If he is not in play, search the encounter deck and discard pile for the Blob minion and reveal him.
  >
  > ---
  >
  > [star] **Boost**: If the villain is Blob, give him an additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/32133.png` (607×880 px, 140.9 KB)

### [32134] Pyromaniac
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (18–19/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Pyro activates against you. If he is not in play, search the encounter deck and discard pile for the Pyro minion and reveal him.
  >
  > ---
  >
  > [star] **Boost**: If the villain is Pyro, give him an additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/32134.png` (607×880 px, 131.3 KB)

### [32135] Hopping Mad
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (20–21/25, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Toad activates against you. If he is not in play, search the encounter deck and discard pile for the Toad minion and reveal him.
  >
  > ---
  >
  > [star] **Boost**: If the villain is Toad, give him an additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/32135.png` (607×880 px, 136.0 KB)

### [32136] Protect the Students
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (22–23/25, Qty: 2)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 2 [per_hero].
  > **When Defeated**: The player who defeated this scheme searches their deck and discard pile for an ally and adds it to their hand.
- **Image Asset**: `assets/card-art/bundles/cards/32136.png` (880×607 px, 206.4 KB)

### [32137] Under Siege
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mansion Attack (24–25/25, Qty: 2)
- **Stats**: **Base Threat**: 0 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mansion Attack Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place 3 threat on this scheme for each [[Brotherhood of Mutants]] character in play.
- **Image Asset**: `assets/card-art/bundles/cards/32137.png` (880×607 px, 210.3 KB)


### Set: Magneto

### [32138] Magneto
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (1/30)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Steady. Toughness.
  > [star] **Forced Response**: After Magneto attacks you, place 1 magnet counter on the main scheme.
- **Flavor**: *"To oppose the Master of Magnetism is to invite your own destruction!"*
- **Image Asset**: `assets/card-art/bundles/cards/32138.png` (607×880 px, 142.6 KB)

### [32139] Magneto
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (2/30)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 3 [star], **HP**: 20 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Steady. Toughness.
  > **When Revealed**: Deal each player a facedown encounter card.
  > [star] **Forced Response**: After Magneto attacks you, place 1 magnet counter on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32139.png` (607×880 px, 144.6 KB)

### [32140] Magneto
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (3/30)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 3 [star], **HP**: 22 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Steady. Toughness.
  > **When Revealed**: Deal each player a facedown encounter card.
  > [star] **Forced Response**: After Magneto attacks you, place 1 magnet counter on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32140.png` (607×880 px, 144.3 KB)

### [32141] Asteroid M
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (4/30)
- **Properties**: Stage 1, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After you place a magnet counter on this scheme, if there are at least 3 magnet counters here, discard cards from the encounter deck until a [[Magnetic]] card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.
- **Reverse Side**
  > **Contents:** Magneto (I) and Magneto (II). *(Magneto (II) and Magneto (III) for expert mode.)* Magneto and Standard sets. One modular set (*Acolytes*).
  > **Setup:** Set the Orbital Decay side scheme aside. Reveal the Boarding Party side scheme.
  - **Back Flavor**: *Magneto floats above the Earth in his orbital sanctuary.*
- **Image Asset**: `assets/card-art/bundles/cards/32141.jpg` (880×607 px, 181.0 KB)

### [32141a] Asteroid M
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (4/30)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Magneto (I) and Magneto (II). *(Magneto (II) and Magneto (III) for expert mode.)* Magneto and Standard sets. One modular set (*Acolytes*).
  > **Setup**: Set the Orbital Decay side scheme aside. Reveal the Boarding Party side scheme.
- **Flavor**: *Magneto floats above the Earth in his orbital sanctuary.*
- **Image Asset**: `assets/card-art/bundles/cards/32141a.png` (880×607 px, 181.0 KB)

### [32141b] Asteroid M
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (4/30)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 5 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After you place a magnet counter on this scheme, if there are at least 3 magnet counters here, discard cards from the encounter deck until a [[Magnetic]] card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32141b.png` (880×607 px, 206.2 KB)

### [32142] Factory Online
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (5/30)
- **Properties**: Stage 2, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After you place a magnet counter on this scheme, if there are at least 3 magnet counters here, discard cards from the encounter deck until a [[Magnetic]] card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.
- **Reverse Side**
  > **When Revealed**: Place 1 magnet counter here. If Sabotage Master Mold is not in the victory display, the first player searches the encounter deck and discard pile for a copy of the M-Type Sentinel minion and reveals it.
- **Image Asset**: `assets/card-art/bundles/cards/32142.jpg` (880×607 px, 193.4 KB)

### [32142a] Factory Online
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (5/30)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 1 magnet counter here. If Sabotage Master Mold is not in the victory display, the first player searches the encounter deck and discard pile for a copy of the M-Type Sentinel minion and reveals it.
- **Image Asset**: `assets/card-art/bundles/cards/32142a.png` (880×607 px, 193.4 KB)

### [32142b] Factory Online
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (5/30)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 6 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After you place a magnet counter on this scheme, if there are at least 3 magnet counters here, discard cards from the encounter deck until a [[Magnetic]] card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32142b.png` (880×607 px, 216.9 KB)

### [32143] The Rule of Magnus
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (6/30)
- **Properties**: Stage 3, Double-Sided
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After you place a magnet counter on this scheme, if there are at least 3 magnet counters here, discard cards from the encounter deck until a [[Magnetic]] card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.
  > **If this stage is completed, the players lose the game.**
- **Reverse Side**
  > **When Revealed**: Place 2 magnet counters here. If Physical Strain is not attached to Magneto, the first player searches the encounter deck and discard pile for a [[Magnetic]] attachement and reveals it.
- **Image Asset**: `assets/card-art/bundles/cards/32143.png` (880×607 px, 177.5 KB)

### [32143a] The Rule of Magnus
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (6/30)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Place 2 magnet counters here. If Physical Strain is not attached to Magneto, the first player searches the encounter deck and discard pile for a [[Magnetic]] attachment and reveals it.
- **Image Asset**: `assets/card-art/bundles/cards/32143a.png` (880×607 px, 177.5 KB)

### [32143b] The Rule of Magnus
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (6/30)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Response**: After you place a magnet counter on this scheme, if there are at least 3 magnet counters here, discard cards from the encounter deck until a [[Magnetic]] card is discarded. Reveal that card, then remove 3 magnet counters from this scheme.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/32143b.png` (880×607 px, 212.4 KB)

### [32144a] Boarding Party
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (7/30)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Magneto cannot have more than 6 [per_hero] sustained damage.
  > **When Defeated**: Flip this card and reveal Sabotage Master Mold.
- **Flavor**: *To stop Magneto's nefarious plan, you must first board Asteroid M.*
- **Image Asset**: `assets/card-art/bundles/cards/32144a.png` (880×607 px, 198.0 KB)

### [32144b] Sabotage Master Mold
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (7/30)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Magneto cannot have more than 12 [per_hero] sustained damage.
  > **When Defeated**: Reveal the set-aside Orbital Decay side scheme. Add this card to the victory display.
- **Flavor**: *Master Mold has been reprogrammed. You must take it offline before it can create human-hunting Sentinels!*
- **Image Asset**: `assets/card-art/bundles/cards/32144b.png` (880×607 px, 231.3 KB)

### [32145a] Orbital Decay
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (8/30)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Magneto cannot have more than 18 [per_hero] sustained damage.
  > **When Defeated**: Flip this card and reveal Physical Strain.
- **Flavor**: *Magneto is an indomitable foe. The only way to ensure his defeat is to destroy his asteroid bas by crashing it to Earth.*
- **Image Asset**: `assets/card-art/bundles/cards/32145a.png` (880×607 px, 189.1 KB)

### [32145b] Physical Strain
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (8/30)
- **Properties**: Permanent
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Magneto.
  > Permanent.
  > Magneto loses steady.
- **Flavor**: *As Asteroid M begins its uncontrolled plummet, Magneto uses his power to hold it together even as he fights with you!.*
- **Image Asset**: `assets/card-art/bundles/cards/32145b.png` (607×880 px, 126.7 KB)

### [32146] M-Type Sentinel
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (9–12/30, Qty: 4)
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel.*
- **Rules Text**:
  > Guard.
  > **When Defeated**: Give Magneto a tough status card.
  >
  > ---
  >
  > [star] **Boost**: Give Magneto a tough status card and a facedown boost card.
- **Image Asset**: `assets/card-art/bundles/cards/32146.png` (607×880 px, 119.4 KB)

### [32147] Magneto's Helmet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (13/30)
- **Properties**: Unique
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Magnetic.*
- **Rules Text**:
  > Attach to Magneto.
  > Magneto cannot be confused.
  > **Hero Response**: After your hero makes a basic attack against Magneto, spend [energy] [mental] [physical] resources → discard this card.
- **Flavor**: *Magneto designed his helmet to protect him from Xavier's telepathic powers.*
- **Image Asset**: `assets/card-art/bundles/cards/32147.png` (607×880 px, 123.4 KB)

### [32148] Magneto's Armor
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (14/30)
- **Properties**: Unique
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Armor. Magnetic.*
- **Rules Text**:
  > Attach to Magneto.
  > Magneto cannot be stunned.
  > **Hero Response**: After your hero makes a basic attack against Magneto, spend [energy] [mental] [physical] resources → discard this card.
- **Flavor**: *Magneto's armor is strong enough to survive a direct blast from a Sentinel's gauntlet beam.*
- **Image Asset**: `assets/card-art/bundles/cards/32148.png` (607×880 px, 125.8 KB)

### [32149] Magnetic Bubble
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (15/30)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Magnetic.*
- **Rules Text**:
  > Attach to Magneto.
  > Magneto gains retaliate 1.
  > **Forced Interrupt**: When Magneto would take any amount of damage, place it here instead. Then, if there is 8 or more damage here, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/32149.png` (607×880 px, 139.8 KB)

### [32150] Wrapped in Metal
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (16/30)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Magnetic.*
- **Rules Text**:
  > Attach to your identity. Max 1 per identity.
  > Attached identity cannot thwart, attack, defend, or recover.
  > **Action**: Exhaust your identity and spend a [physical] resource → discard this card.
- **Flavor**: *"Well, this sucks." —Archangel*
- **Image Asset**: `assets/card-art/bundles/cards/32150.png` (607×880 px, 147.7 KB)

### [32151] Master of Magnetism
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (17–19/30, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Take the topmost [[Magnetic]] card in the encounter discard pile and give it to Magneto as a facedown boost card. Magneto activates against you.
- **Flavor**: *"Neither your powers nor all your skills can save you from my wrath!" —Magneto*
- **Image Asset**: `assets/card-art/bundles/cards/32151.png` (607×880 px, 154.4 KB)

### [32152] Electric Shock
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (20–21/30, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Magnetic.*
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: You are confused. Place 1 threat on the main scheme for each magnet counter on it.
  > **When Revealed (Hero)**: You are stunned. Take 1 damage for each magnet counter on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32152.png` (607×880 px, 151.9 KB)

### [32153] Electromagnetic Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (22–23/30, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Magnetic.*
- **Rules Text**:
  > **When Revealed**: Exhaust each upgrade and support you control. Place 1 counter on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: Exhaust your identity.
- **Image Asset**: `assets/card-art/bundles/cards/32153.png` (607×880 px, 138.0 KB)

### [32154] Metal Shards
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (24–25/30, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Magnetic.*
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to each character you control. Place 1 magnet counter on the main scheme.
  >
  > ---
  >
  > [star] **Boost**: If this is an attack that defeats an ally, place 1 magnet counter on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32154.png` (607×880 px, 141.9 KB)

### [32155] Magnetic Missile
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (26–27/30, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
- **Traits**: *Magnetic.*
- **Rules Text**:
  > Surge.
  > **When Revealed**: Defeat a [[Sentinel]] minion in play. Then, take 5 damage. You may discard X cards from your hand to prevent X of that damage.
- **Flavor**: *"I should have seen that coming!" —Cyclops*
- **Image Asset**: `assets/card-art/bundles/cards/32155.png` (607×880 px, 143.1 KB)

### [32156] Magnetic Mayhem
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (28/30)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Magnetic.*
- **Rules Text**:
  > **When Defeated**: The player who defeated this scheme discards the top 4 cards of the encounter deck. That player places 1 magnet counter on the main scheme for each [[Magnetic]] card discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/32156.png` (880×607 px, 215.5 KB)

### [32157] Magnetically Sealed
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (29/30)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Traits**: *Magnetic.*
- **Rules Text**:
  > **When Revealed**: Place 2 additional threat here for each ally in play.
  >
  > ---
  >
  > [star] **Boost**: Exhaust each ally you control.
- **Image Asset**: `assets/card-art/bundles/cards/32157.png` (880×607 px, 185.3 KB)

### [32158] Seized!
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Magneto (30/30)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Magneto Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *Magnetic.*
- **Rules Text**:
  > **When Revealed**: Each player places the top 6 cards of their deck facedown under here.
  > **When Defeated**: Magneto activates against the player who defeated this scheme. *(Discard cards under here.)*
- **Image Asset**: `assets/card-art/bundles/cards/32158.png` (880×607 px, 191.4 KB)


### Set: Acolytes

### [32159] Fabian Cortez
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Acolytes (1/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Acolytes Set Icon (printed bottom-right next to deck number)
- **Traits**: *Acolyte. Elite.*
- **Rules Text**:
  > Teamwork ([[ACOLYTE]]). Villainous.
  > **When Defeated**: The player who defeated Fabian Cortez discards cards from the encounter deck until an [[ACOLYTE]] minion is discarded, then puts that minion into play engaged them.
- **Image Asset**: `assets/card-art/bundles/cards/32159.png` (607×880 px, 128.3 KB)

### [32160] Amelia Voght
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Acolytes (2/7)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Acolytes Set Icon (printed bottom-right next to deck number)
- **Traits**: *Acolyte.*
- **Rules Text**:
  > Stalwart. Teamwork ([[ACOLYTE]]).
  > **When Defeated**: The player who defeated Amelia Voght is confused. If they are already confused, place 2 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32160.png` (607×880 px, 132.8 KB)

### [32161] Senyaka
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Acolytes (3/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Acolytes Set Icon (printed bottom-right next to deck number)
- **Traits**: *Acolyte.*
- **Rules Text**:
  > Teamwork ([[ACOLYTE]]).
  > [star] Senyaka's attacks gain piercing.
  > **When Defeated**: The player who defeated Senyaka is stunned. If they are already stunned, they take 3 damage.
- **Image Asset**: `assets/card-art/bundles/cards/32161.png` (607×880 px, 133.5 KB)

### [32162] Delgado
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Acolytes (4/7)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Acolytes Set Icon (printed bottom-right next to deck number)
- **Traits**: *Acolyte.*
- **Rules Text**:
  > Retaliate 1. Teamwork ([[ACOLYTE]]).
  > **When Defeated**: Discard each stunned and confused card from the villain and give it a facedown boost card.
- **Image Asset**: `assets/card-art/bundles/cards/32162.png` (607×880 px, 122.3 KB)

### [32163] Unuscione
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Acolytes (5/7)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Acolytes Set Icon (printed bottom-right next to deck number)
- **Traits**: *Acolyte.*
- **Rules Text**:
  > Teamwork ([[ACOLYTE]]). Toughness.
  > **When Defeated**: Give the villain a tough status card. If the villain already has a tough status card, heal 4 damage from it.
- **Image Asset**: `assets/card-art/bundles/cards/32163.png` (607×880 px, 127.7 KB)

### [32164] Zeal for the Cause
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Acolytes (6/7)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Acolytes Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Resolve the "When Defeated" ability of each [[Acolyte]] minion engaged with you. If you are not engaged with an [[Acolyte]] minion, discard cards from the encounter deck until a minion is discarded, then reveal it.
- **Image Asset**: `assets/card-art/bundles/cards/32164.png` (607×880 px, 140.6 KB)

### [32165] The Acolytes
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Acolytes (7/7)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Acolytes Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Each [[Acolyte]] minion gains guard.
  >
  > ---
  >
  > [star] **Boost**: Shuffle each [[Acolyte]] minion from the discard pile into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/32165.png` (880×607 px, 198.4 KB)


### Set: Future Past

### [32166] Nimrod
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Future Past (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 3, **HP**: 9
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Future Past Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Sentinel.*
- **Rules Text**:
  > Stalwart. Victory 1.
  > Nimrod cannot take more than 3 damage each phase.
- **Flavor**: *"I have returned."*
- **Image Asset**: `assets/card-art/bundles/cards/32166.png` (607×880 px, 125.6 KB)

### [32167] Bastion
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Future Past (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 10
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 0 (the boost area shows a star instead of pips)
  - **Boost Star**: Yes (`[star]` icon triggers the **Boost:** ability printed in the Rules Text below)
  - **Encounter Set Emblem**: Future Past Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Sentinel.*
- **Rules Text**:
  > Toughness. Villainous. Victory 1.
  >
  > ---
  >
  > [star] **Boost**: Deal this card to yourself as a facedown encounter card.
- **Flavor**: *"To ensure the future of humanity, I will destroy mutantkind."*
- **Image Asset**: `assets/card-art/bundles/cards/32167.png` (607×880 px, 128.0 KB)

### [32168] Nimrod's Portal
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Future Past (3/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Future Past Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Victory 1.
  > **When Defeated**: In player order, each player discards the top 2 cards of the encounter deck and takes indirect damage equal to the number of boost icons ([boost]) discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/32168.png` (880×607 px, 208.6 KB)

### [32169] Bastion's Machinations
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Future Past (4/5)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Future Past Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Victory 1.
  > **When Revealed**: Each player places the top 9 cards of their deck facedown under here.
- **Flavor**: *Bastion manipulates current events to bring about the future from which he came.*
- **Image Asset**: `assets/card-art/bundles/cards/32169.png` (880×607 px, 185.6 KB)

### [32170] Nano-Sentinel Tech
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Future Past (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Future Past Set Icon (printed bottom-right next to deck number)
- **Traits**: *Sentinel. Tech.*
- **Rules Text**:
  > Victory 1.
  > Attached minion gets +4 hit points and gains the [[Sentinel]] trait.
  > **When Revealed**: Search the encounter deck, discard pile, and set-aside area for your nemesis minion. Put it into play engaged with you and attach this card to it.
- **Image Asset**: `assets/card-art/bundles/cards/32170.png` (607×880 px, 133.8 KB)


### Set: Mutant Genesis Campaign

### [32171a] Frightened Police
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (1/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: Shuffle the top card of the Future Past deck into the encounter deck. Flip this card and put Metro P.D. into play.
- **Flavor**: *In the midst of the chaos, the police have confused the X-Men with the enemy.*
- **Image Asset**: `assets/card-art/bundles/cards/32171a.png` (880×607 px, 217.1 KB)

### [32171b] Metro P.D.
- **Type**: `Support`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (1/5)
- **Properties**: Permanent
- **Stats**: **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Persona.*
- **Rules Text**:
  > Permanent.
  > The first player controls Metro P.D.
  > **Action**: Exhaust Metro P.D. → choose to either deal 1 damage to an enemy or remove 1 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/32171b.png` (607×880 px, 144.7 KB)

### [32172a] Enemy of My Enemy
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (2/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Defeated**: Shuffle the top card of the Future Past deck into the encounter deck. Flip this card and put Magneto into play under the first player's control.
- **Flavor**: *Magneto also fights to protect vulnerable mutants from the Sentinels.*
- **Image Asset**: `assets/card-art/bundles/cards/32172a.png` (880×607 px, 208.5 KB)

### [32172b] Magneto — *Erik Lehnsherr*
- **Type**: `Ally`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (2/5)
- **Properties**: Unique
- **Stats**: **THW**: 2 (Consequential: 1), **ATK**: 3 [star] (Consequential: 1), **HP**: 5, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Brotherhood of Mutants.*
- **Rules Text**:
  > Victory 1.
  > The first player controls Magneto. He does not count against your ally limit.
  > [star] **Response**: After Magneto attacks and defeats a [[SENTINEL]] minion, heal 1 damage from Magneto.
- **Image Asset**: `assets/card-art/bundles/cards/32172b.png` (607×880 px, 126.5 KB)

### [32173a] Find the Prisoners
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (3/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player searches their deck for an ally and places it facedown under here.
  > **When Defeated**: Shuffle the top card of the Future Past deck into the encounter deck. Flip this card and reveal Rescue Captives. *(Keep facedown cards under Rescue Captives.)*
- **Image Asset**: `assets/card-art/bundles/cards/32173a.png` (880×607 px, 226.2 KB)

### [32173b] Rescue Captives
- **Type**: `Environment`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (3/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Mission.*
- **Rules Text**:
  > **Response**: After you defeat a [[Sentinel]] minion, spend 1 resource of any type → choose a facedown ally under this card and put it into play under your control. *(Any player may trigger this ability.)*
- **Flavor**: *The mutants seized by the Sentinels have been located inside Master Mold's facility.*
- **Image Asset**: `assets/card-art/bundles/cards/32173b.png` (607×880 px, 138.0 KB)

### [32174a] Surprise Attack
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (4/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Defeated**: Shuffle the top card of the Future Past deck into the encounter deck. The player who defeated this scheme flips this card and puts Reactivate Defenses into their play area.
- **Image Asset**: `assets/card-art/bundles/cards/32174a.png` (880×607 px, 207.5 KB)

### [32174b] Reactive Defense
- **Type**: `Obligation`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Alter-Ego Action**: Spend [energy] [mental] [physical] resources → deal 5 damage to each enemy in play. Remove this card from the game.
- **Flavor**: *The Brotherhood's surprise attack caught you off-guard, but if you can activate the X-Mansion's defense systems, you can turn the tide of battle.*
- **Image Asset**: `assets/card-art/bundles/cards/32174b.png` (607×880 px, 146.3 KB)

### [32175a] Magneto's Fortress
- **Type**: `Side Scheme`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (5/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **When Defeated**: Shuffle the top card of the Future Past deck into the encounter deck. Flip this card.
- **Flavor**: *Magneto has fortified his asteroid sanctuary in anticipation of your assault.*
- **Image Asset**: `assets/card-art/bundles/cards/32175a.png` (880×607 px, 213.7 KB)

### [32175b] Magneto's Power
- **Type**: `Attachment`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Mutant Genesis Campaign (5/5)
- **Properties**: Permanent
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Mutant Genesis Campaign Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Magneto.
  > Permanent.
- **Flavor**: *"Mine is the power to destroy. And to reshape the world in my image!" —Magneto*
- **Image Asset**: `assets/card-art/bundles/cards/32175b.png` (607×880 px, 121.8 KB)


### Set: Brawler

### [32176] Coup de Grâce
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brawler (1/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Brawler Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When you attack, this attack deals 3 additional damage and gains overkill. Remove this card from the game and the campaign pool.
- **Flavor**: *"Tally-ho!" —Nightcrawler*
- **Image Asset**: `assets/card-art/bundles/cards/32176.png` (607×880 px, 135.8 KB)

### [32177] Swagger
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brawler (2/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Brawler Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you make a basic defense, you get +3 DEF. Ready your hero. Remove this card from the game and the campaign pool.
- **Flavor**: *"Go ahead, bub. Make our day!" —Wolverine*
- **Image Asset**: `assets/card-art/bundles/cards/32177.png` (607×880 px, 134.2 KB)

### [32178] Brazen Defense
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brawler (3/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Brawler Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt** *(attack/defense)*: When an enemy attacks, spend 1 resource of any type → prevent 3 damage from this attack and deal 3 damage to that enemy. Remove this card from the game and the campaign pool.
- **Image Asset**: `assets/card-art/bundles/cards/32178.png` (607×880 px, 154.7 KB)

### [32179] Ferocious Attack
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brawler (4/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Brawler Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Spend 3 resources of any type → deal 6 damage to an enemy and ready your hero. Remove this card from the game and the campaign pool.
- **Image Asset**: `assets/card-art/bundles/cards/32179.png` (607×880 px, 154.9 KB)

### [32180] War Cry
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Brawler (5/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Brawler Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Resource**: Generate [wild][wild] resources for an [[Attack]] or [[Defense]] event. Gain a tough status card. Remove this card from the game and the campaign pool.
- **Flavor**: *"Rrrrrrraaaaargh!" —Wolverine*
- **Image Asset**: `assets/card-art/bundles/cards/32180.png` (607×880 px, 154.3 KB)


### Set: Commander

### [32181] Coup de Grâce
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Commander (1/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Commander Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt**: When you attack, this attack deals 3 additional damage and gains overkill. Remove this card from the game and the campaign pool.
- **Flavor**: *"Tally-ho!" —Nightcrawler*
- **Image Asset**: `assets/card-art/bundles/cards/32181.png` (607×880 px, 125.6 KB)

### [32182] Compassion
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Commander (2/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Commander Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Alter-Ego Response**: After you recover, heal 3 damage from among characters you control and draw 1 card. Remove this card from the game and the campaign pool.
- **Flavor**: *"We've all been there, son." —Cyclops*
- **Image Asset**: `assets/card-art/bundles/cards/32182.png` (607×880 px, 148.8 KB)

### [32183] Group Assault
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Commander (3/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Commander Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill. Tactic.*
- **Rules Text**:
  > **Hero Action**: Until the end of the phase, prevent all consequential damage each ally would take from attacking. Remove this card from the game and the campaign pool.
- **Image Asset**: `assets/card-art/bundles/cards/32183.png` (607×880 px, 153.9 KB)

### [32184] Shock and Awe
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Commander (4/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Commander Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill. Tactic.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Spend 3 resources of any type → deal 6 damage to an enemy and ready each ally you control. Remove this card from the game and the campaign pool.
- **Image Asset**: `assets/card-art/bundles/cards/32184.png` (607×880 px, 147.6 KB)

### [32185] Improvisation
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Commander (5/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Commander Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Resource**: Generate [wild][wild] resources for an [[Attack]] or [[Tactic]] event. Ready an ally and heal 2 damage from it. Remove this card from the game and the campaign pool.
- **Image Asset**: `assets/card-art/bundles/cards/32185.png` (607×880 px, 143.2 KB)


### Set: Defender

### [32186] Swagger
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Defender (1/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Defender Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt** *(defense)*: When you make a basic defense, you get +3 DEF. Ready your hero. Remove this card from the game and the campaign pool.
- **Flavor**: *"Go ahead, bub. Make our day!" —Wolverine*
- **Image Asset**: `assets/card-art/bundles/cards/32186.png` (607×880 px, 141.1 KB)

### [32187] Surprise!
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Defender (2/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Defender Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Reponse**: After you thwart, remove 3 threat from among schemes in play. Confuse an enemy. Remove this card from the game and the campaign pool.
- **Flavor**: *"Guten Tag!" —Nightcrawler*
- **Image Asset**: `assets/card-art/bundles/cards/32187.png` (607×880 px, 140.0 KB)

### [32188] Heroic Intervention
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Defender (3/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Defender Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Spend 3 resources of any type → remove 5 threat from among schemes in play. You gain a tough status card. Remove this card from the game and the campaign pool.
- **Image Asset**: `assets/card-art/bundles/cards/32188.png` (607×880 px, 154.9 KB)

### [32189] Determined Defense
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Defender (4/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Defender Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Interrupt** *(defense/thwart)*: When you defend against an attack, spend 2 resources of any type → that attack removes threat from the main scheme instead of dealing damage. Remove this card from the game and the campaign pool.
- **Image Asset**: `assets/card-art/bundles/cards/32189.png` (607×880 px, 165.7 KB)

### [32190] Bodyguard
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Defender (5/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Defender Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Resource**: Generate [wild][wild] resources for a [[Defense]] or [[Thwart]] event. Draw 1 card. Remove this card from the game and the campaign pool.
- **Flavor**: *"Back off." —Cyclops*
- **Image Asset**: `assets/card-art/bundles/cards/32190.png` (607×880 px, 142.9 KB)


### Set: Peacekeeper

### [32191] Surprise!
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Peacekeeper (1/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Peacekeeper Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Reponse**: After you thwart, remove 3 threat from among schemes in play. Confuse an enemy. Remove this card from the game and the campaign pool.
- **Flavor**: *"Guten Tag!" —Nightcrawler*
- **Image Asset**: `assets/card-art/bundles/cards/32191.png` (607×880 px, 133.8 KB)

### [32192] Compassion
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Peacekeeper (2/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Peacekeeper Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Alter-Ego Response**: After you recover, heal 3 damage from among characters you control and draw 1 card. Remove this card from the game and the campaign pool.
- **Flavor**: *"We've all been there, son." —Cyclops*
- **Image Asset**: `assets/card-art/bundles/cards/32192.png` (607×880 px, 144.0 KB)

### [32193] Rescue Operation
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Peacekeeper (3/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Peacekeeper Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill. Tactic.*
- **Rules Text**:
  > **Hero Action**: Until the end of the phase, prevent all consequential damage each ally would take from thwarting. Remove this card from the game and the campaign pool.
- **Image Asset**: `assets/card-art/bundles/cards/32193.png` (607×880 px, 150.2 KB)

### [32194] Mentorship
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Peacekeeper (4/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Peacekeeper Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill. Tactic.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Spend 3 resources of any type → remove 5 threat from among schemes in play. Ready each ally you control. Remove this card from the game and the campaign pool.
- **Image Asset**: `assets/card-art/bundles/cards/32194.png` (607×880 px, 143.9 KB)

### [32195] Fortitude
- **Type**: `Upgrade`
- **Faction / Aspect**: Campaign
- **Pack**: Mutant Genesis (`mut_gen`)
- **Deck / Set**: Peacekeeper (5/5)
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: not recorded in this source (MarvelCDB omits the field; treat as unknown, not as 0)
  - **Encounter Set Emblem**: Peacekeeper Set Icon (printed bottom-right next to deck number)
- **Traits**: *Skill.*
- **Rules Text**:
  > **Hero Resource**: Generate [wild][wild] resources for a [[Tactic]] or [[Thwart]] event. Stun an enemy. Remove this card from the game and the campaign pool.
- **Flavor**: *"Bozhe moi!" —Colossus*
- **Image Asset**: `assets/card-art/bundles/cards/32195.png` (607×880 px, 156.9 KB)


