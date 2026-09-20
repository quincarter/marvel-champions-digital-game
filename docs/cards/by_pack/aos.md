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
| `50001a` | Maria Hill | Hero | Maria Hill | THW:2 ATK:1 DEF:2 HP:9 | - | `aos` |
| `50001b` | Maria Hill | Alter-Ego | Maria Hill | HP:9 | - | `aos` |
| `50002` | Nick Fury | Ally | Maria Hill | THW:2 ATK:2 HP:3 | - | `aos` |
| `50003` | All-Points Bulletin | Event | Maria Hill | - | - | `aos` |
| `50004` | On the Double | Event | Maria Hill | - | - | `aos` |
| `50005` | Reinforcements | Event | Maria Hill | - | - | `aos` |
| `50006` | The Hard Call | Event | Maria Hill | - | - | `aos` |
| `50007` | Special Funding | Resource | Maria Hill | - | - | `aos` |
| `50008` | Support Staff | Support | Maria Hill | - | - | `aos` |
| `50009` | The Iliad | Support | Maria Hill | - | - | `aos` |
| `50010` | Life Model Decoy | Upgrade | Maria Hill | - | - | `aos` |
| `50011` | S.H.I.E.L.D. Director | Upgrade | Maria Hill | - | - | `aos` |
| `50012` | Victoria Hand | Ally | Pack Position: 12 | THW:2 ATK:1 HP:2 | - | `aos` |
| `50013` | Slingshot | Ally | Pack Position: 13 | THW:2 ATK:2 HP:3 | - | `aos` |
| `50014` | Organizational Support | Resource | Pack Position: 14 | - | - | `aos` |
| `50015` | Agents of S.H.I.E.L.D. | Support | Pack Position: 15 | - | - | `aos` |
| `50016` | Command Team | Support | Pack Position: 16 | - | - | `aos` |
| `50017` | The Circe | Support | Pack Position: 17 | - | - | `aos` |
| `50018` | The Bellerophon | Support | Pack Position: 18 | - | - | `aos` |
| `50019` | The Douglass | Support | Pack Position: 19 | - | - | `aos` |
| `50020` | The Pericles | Support | Pack Position: 20 | - | - | `aos` |
| `50021` | Dum Dum Dugan | Ally | Pack Position: 21 | THW:3 ATK:3 HP:5 | - | `aos` |
| `50022` | Grant Ward | Ally | Pack Position: 22 | THW:2 ATK:2 HP:3 | - | `aos` |
| `50023` | Melinda May | Ally | Pack Position: 23 | THW:2 ATK:2 HP:3 | - | `aos` |
| `50024` | Super Spies | Event | Pack Position: 24 | - | - | `aos` |
| `50025` | Energy | Resource | Pack Position: 25 | - | - | `aos` |
| `50026` | Genius | Resource | Pack Position: 26 | - | - | `aos` |
| `50027` | Strength | Resource | Pack Position: 27 | - | - | `aos` |
| `50028` | Front Organization | Support | Pack Position: 28 | - | - | `aos` |
| `50029` | Press Conference | Obligation | Maria Hill | - | 2 pips | `aos` |
| `50030` | Controller | Minion | Maria Hill Nemesis | SCH:2 ATK:1 HP:6 | 3 pips | `aos` |
| `50031` | Army of the Controlled | Side Scheme | Maria Hill Nemesis | - | 1 pips | `aos` |
| `50032` | Controlled Innocents | Environment | Maria Hill Nemesis | - | - | `aos` |
| `50033` | Diabolical Discs | Treachery | Maria Hill Nemesis | - | 2 pips | `aos` |
| `50034a` | Nick Fury | Hero | Nick Fury | THW:2 ATK:2 DEF:2 HP:10 | - | `aos` |
| `50034b` | Nick Fury | Alter-Ego | Nick Fury | HP:10 | - | `aos` |
| `50035a` | Assault | Upgrade | Nick Fury | - | - | `aos` |
| `50035b` | Stealth | Upgrade | Nick Fury | - | - | `aos` |
| `50036` | Maria Hill | Ally | Nick Fury | THW:2 ATK:1 HP:3 | - | `aos` |
| `50037` | Concentrated Fire | Event | Nick Fury | - | - | `aos` |
| `50038` | Covert Surveillance | Event | Nick Fury | - | - | `aos` |
| `50039` | Spray Fire | Event | Nick Fury | - | - | `aos` |
| `50040` | Fury's Flying Car | Support | Nick Fury | - | - | `aos` |
| `50041` | Safe House #221 | Support | Nick Fury | - | - | `aos` |
| `50042` | EM Shield | Upgrade | Nick Fury | - | - | `aos` |
| `50043` | Eyepatch Camera | Upgrade | Nick Fury | - | - | `aos` |
| `50044` | Fury's Watch | Upgrade | Nick Fury | - | - | `aos` |
| `50045` | Intelligence Analysis | Upgrade | Nick Fury | - | - | `aos` |
| `50046` | Secret Agent | Upgrade | Nick Fury | - | - | `aos` |
| `50047` | Agent Coulson | Ally | Pack Position: 47 | THW:2 ATK:1 HP:3 | - | `aos` |
| `50048` | Quake | Ally | Pack Position: 48 | THW:1 ATK:2 HP:2 | - | `aos` |
| `50049` | Global Logistics | Event | Pack Position: 49 | - | - | `aos` |
| `50050` | Informant | Upgrade | Pack Position: 50 | - | - | `aos` |
| `50051` | Intelligence | Upgrade | Pack Position: 51 | - | - | `aos` |
| `50052` | Prism Dust | Upgrade | Pack Position: 52 | - | - | `aos` |
| `50053` | Under Surveillance | Upgrade | Pack Position: 53 | - | - | `aos` |
| `50054` | Nick Fury, Sr. | Ally | Pack Position: 54 | THW:2 ATK:2 HP:3 | - | `aos` |
| `50055` | Jemma Simmons | Support | Pack Position: 55 | - | - | `aos` |
| `50056` | Leo Fitz | Support | Pack Position: 56 | - | - | `aos` |
| `50057` | Sky-Destroyer | Support | Pack Position: 57 | - | - | `aos` |
| `50058` | Practiced Plan | Upgrade | Pack Position: 58 | - | - | `aos` |
| `50059` | Discovered | Obligation | Nick Fury | - | 2 pips | `aos` |
| `50060` | Orion | Minion | Nick Fury Nemesis | SCH:2 ATK:2 HP:6 | 3 pips | `aos` |
| `50061` | Acquire Infinity Formula | Side Scheme | Nick Fury Nemesis | - | 3 pips | `aos` |
| `50062` | Leviathan Soldier | Minion | Nick Fury Nemesis | SCH:0 ATK:2 HP:4 | 1 pips | `aos` |
| `50063` | Cold Storage | Treachery | Nick Fury Nemesis | - | 1 pips | `aos` |
| `50064` | Black Widow | Villain | Black Widow | SCH:2 ATK:1 HP:13 | - | `aos` |
| `50065` | Black Widow | Villain | Black Widow | SCH:2 ATK:2 HP:16 | - | `aos` |
| `50066` | Black Widow | Villain | Black Widow | SCH:3 ATK:2 HP:13 | - | `aos` |
| `50067a` | The Widow's Web | Main Scheme | Black Widow | - | - | `aos` |
| `50067b` | The Widow's Web | Main Scheme | Black Widow | - | - | `aos` |
| `50068` | Black Widow's Gauntlet | Attachment | Black Widow | ATK:1 | 2 pips | `aos` |
| `50069` | Grappling Hook | Attachment | Black Widow | - | 1 pips | `aos` |
| `50070` | Night Vision Goggles | Attachment | Black Widow | SCH:1 | 3 pips | `aos` |
| `50071` | Stun Net | Attachment | Black Widow | - | 1 pips | `aos` |
| `50072` | A.I.M. Commando | Minion | Black Widow | SCH:1 ATK:2 HP:3 | 1 pips | `aos` |
| `50073` | A.I.M. Grunt | Minion | Black Widow | SCH:1 ATK:1 HP:5 | - | `aos` |
| `50074` | Automated Defenses | Side Scheme | Black Widow | - | 3 pips | `aos` |
| `50075` | Destroy Evidence | Side Scheme | Black Widow | - | 2 pips | `aos` |
| `50076` | Attacrobatics | Treachery | Black Widow | - | 3 pips | `aos` |
| `50077` | Covert Ops | Treachery | Black Widow | - | 2 pips | `aos` |
| `50078` | Dance of Death | Treachery | Black Widow | - | 2 pips | `aos` |
| `50079` | Widow's Bite | Treachery | Black Widow | - | 2 pips | `aos` |
| `50080` | A.I.M. Abductor | Minion | A.I.M. Abduction | SCH:1 ATK:2 HP:4 | 2 pips | `aos` |
| `50081` | Abduct Superhumans | Side Scheme | A.I.M. Abduction | - | 1 pips | `aos` |
| `50082` | Nabbed! | Treachery | A.I.M. Abduction | - | 1 pips | `aos` |
| `50083` | A.I.M. Scientist | Minion | A.I.M. Science | SCH:0 ATK:0 HP:2 | - | `aos` |
| `50084` | A.I.M. Soldier | Minion | A.I.M. Science | SCH:1 ATK:2 HP:3 | 1 pips | `aos` |
| `50085` | Mad Science | Side Scheme | A.I.M. Science | - | 3 pips | `aos` |
| `50086a` | Batroc | Villain | Batroc | SCH:1 ATK:2 HP:8 | - | `aos` |
| `50086b` | Batroc | Villain | Batroc | SCH:2 ATK:2 HP:12 | - | `aos` |
| `50087a` | Infiltrate A.I.M. Island Embassy | Main Scheme | Batroc | - | - | `aos` |
| `50087b` | Infiltrate A.I.M. Island Embassy | Main Scheme | Batroc | - | - | `aos` |
| `50088a` | Locate Missing Person | Main Scheme | Batroc | - | - | `aos` |
| `50088b` | Locate Missing Person | Main Scheme | Batroc | - | - | `aos` |
| `50089a` | Extract Captives | Main Scheme | Batroc | - | - | `aos` |
| `50089b` | Extract Captives | Main Scheme | Batroc | - | - | `aos` |
| `50090a` | Alert Level | Environment | Batroc | - | - | `aos` |
| `50090b` | Alert Level | Environment | Batroc | - | - | `aos` |
| `50091` | Rescued Captive | Ally | Batroc | THW:1 ATK:1 HP:5 | - | `aos` |
| `50092` | Heightened Reflexes | Attachment | Batroc | - | Star | `aos` |
| `50093` | Embassy Guard | Minion | Batroc | SCH:1 ATK:2 HP:3 | 1 pips | `aos` |
| `50094` | Embassy Patrol | Minion | Batroc | SCH:2 ATK:1 HP:3 | 1 pips | `aos` |
| `50095` | Commandeer Security Office | Side Scheme | Batroc | - | 2 pips | `aos` |
| `50096` | Leaping Kick | Treachery | Batroc | - | 2 pips | `aos` |
| `50097` | Security Cameras | Treachery | Batroc | - | 2 pips | `aos` |
| `50098` | Machete | Minion | Batroc's Brigade | SCH:1 ATK:2 HP:3 | 2 pips | `aos` |
| `50099` | Rapido | Minion | Batroc's Brigade | SCH:1 ATK:3 HP:4 | Star | `aos` |
| `50100` | Zaran | Minion | Batroc's Brigade | SCH:1 ATK:1 HP:5 | 2 pips | `aos` |
| `50101` | Batroc's Brigade | Side Scheme | Batroc's Brigade | - | 2 pips | `aos` |
| `50102` | Soldiers of Fortune | Treachery | Batroc's Brigade | - | Star | `aos` |
| `50103a` | M.O.D.O.K. | Villain | M.O.D.O.K | SCH:2 ATK:1 HP:10 | - | `aos` |
| `50103b` | M.O.D.O.K. | Villain | M.O.D.O.K | SCH:3 ATK:1 HP:14 | - | `aos` |
| `50104a` | Upgrading Adaptoids | Main Scheme | M.O.D.O.K | - | - | `aos` |
| `50104b` | Upgrading Adaptoids | Main Scheme | M.O.D.O.K | - | - | `aos` |
| `50105a` | Holding Cell | Environment | M.O.D.O.K | - | - | `aos` |
| `50105b` | Flying Inhuman | Ally | M.O.D.O.K | THW:2 ATK:1 HP:5 | - | `aos` |
| `50106a` | Holding Cell | Environment | M.O.D.O.K | - | - | `aos` |
| `50106b` | Psionic Inhuman | Ally | M.O.D.O.K | THW:1 ATK:1 HP:5 | - | `aos` |
| `50107a` | Holding Cell | Environment | M.O.D.O.K | - | - | `aos` |
| `50107b` | Sarah Garza | Ally | M.O.D.O.K | THW:2 ATK:2 HP:5 | - | `aos` |
| `50108a` | Holding Cell | Environment | M.O.D.O.K | - | - | `aos` |
| `50108b` | Strong Inhuman | Ally | M.O.D.O.K | THW:1 ATK:3 HP:7 | - | `aos` |
| `50109` | Flying Upgrade | Environment | M.O.D.O.K | - | - | `aos` |
| `50110` | Psionic Upgrade | Environment | M.O.D.O.K | - | - | `aos` |
| `50111` | Sarah Garza Upgrade | Environment | M.O.D.O.K | - | - | `aos` |
| `50112` | Strong Upgrade | Environment | M.O.D.O.K | - | - | `aos` |
| `50113` | Adaptoid | Minion | M.O.D.O.K | SCH:1 ATK:1 HP:5 | 2 pips | `aos` |
| `50114` | Automated Mobile Unit | Attachment | M.O.D.O.K | ATK:1 | 2 pips | `aos` |
| `50115` | Focusing Crystal | Attachment | M.O.D.O.K | SCH:1 ATK:1 | 3 pips | `aos` |
| `50116` | Nanobots | Attachment | M.O.D.O.K | - | 2 pips | `aos` |
| `50117` | Psionic Force Field | Attachment | M.O.D.O.K | - | Star | `aos` |
| `50118` | Psionic Machetes | Attachment | M.O.D.O.K | ATK:1 | 1 pips | `aos` |
| `50119` | Reverse Engineering | Attachment | M.O.D.O.K | SCH:-1 ATK:-1 | 2 pips | `aos` |
| `50120` | A.I.M. Jailer | Minion | M.O.D.O.K | SCH:0 ATK:2 HP:4 | 1 pips | `aos` |
| `50121` | Hostage Situation | Side Scheme | M.O.D.O.K | - | 2 pips | `aos` |
| `50122` | Psionic Enhancement | Side Scheme | M.O.D.O.K | - | 1 pips | `aos` |
| `50123` | "It's Alive!" | Treachery | M.O.D.O.K | - | 3 pips | `aos` |
| `50124` | Psionic Blast | Treachery | M.O.D.O.K | - | 2 pips | `aos` |
| `50125` | Scientist Supreme | Minion | Scientist Supreme | SCH:2 ATK:1 HP:6 | 3 pips | `aos` |
| `50126` | Monica Rappaccini | Minion | Scientist Supreme | SCH:3 ATK:1 HP:5 | 2 pips | `aos` |
| `50127` | Diplomatic Immunity | Side Scheme | Scientist Supreme | - | 2 pips | `aos` |
| `50128` | Diplomatic Sanctions | Treachery | Scientist Supreme | - | 2 pips | `aos` |
| `50129a` | Citizen V | Villain | Thunderbolts | SCH:2 ATK:2 HP:12 | - | `aos` |
| `50129b` | Citizen V | Villain | Thunderbolts | SCH:3 ATK:2 HP:16 | - | `aos` |
| `50130a` | Apprehending Rogue Agents | Main Scheme | Thunderbolts | - | - | `aos` |
| `50130b` | Apprehending Rogue Agents | Main Scheme | Thunderbolts | - | - | `aos` |
| `50131a` | Justice, Like Lightning | Environment | Thunderbolts | - | - | `aos` |
| `50131b` | Thunderbolt Backup | Environment | Thunderbolts | - | - | `aos` |
| `50132` | Citizen V's Sword | Attachment | Thunderbolts | SCH:1 ATK:1 | 2 pips | `aos` |
| `50133` | Jolt | Minion | Thunderbolts | SCH:0 ATK:1 HP:5 | 3 pips | `aos` |
| `50134` | Innocent Bystanders | Obligation | Thunderbolts | - | 2 pips | `aos` |
| `50135` | The Coming Storm | Side Scheme | Thunderbolts | - | 2 pips | `aos` |
| `50136` | Rumbling Thunder | Side Scheme | Thunderbolts | - | - | `aos` |
| `50137` | Down but Not Out | Treachery | Thunderbolts | - | 1 pips | `aos` |
| `50138` | Tap In | Treachery | Thunderbolts | - | 1 pips | `aos` |
| `50139` | Moonstone | Minion | Gravitational Pull | SCH:2 ATK:2 HP:16 | 4 pips | `aos` |
| `50140` | Rule the Skies | Side Scheme | Gravitational Pull | - | 2 pips | `aos` |
| `50141` | Gravitational Pull | Treachery | Gravitational Pull | - | 1 pips | `aos` |
| `50142` | Psychological Manipulation | Treachery | Gravitational Pull | - | 1 pips | `aos` |
| `50143` | Songbird | Minion | Hard Sound | SCH:0 ATK:0 HP:16 | 4 pips | `aos` |
| `50144` | Solid Sound Constructs | Attachment | Hard Sound | - | 2 pips | `aos` |
| `50145` | Hard Sound Bindings | Attachment | Hard Sound | - | 1 pips | `aos` |
| `50146` | Sonic Bubble | Side Scheme | Hard Sound | - | 2 pips | `aos` |
| `50147` | Hard Sound | Treachery | Hard Sound | - | 1 pips | `aos` |
| `50148` | Black Widow | Minion | Pale Little Spider | SCH:2 ATK:1 HP:14 | 4 pips | `aos` |
| `50149` | Handspring | Attachment | Pale Little Spider | - | 2 pips | `aos` |
| `50150` | Pride of the Red Room | Side Scheme | Pale Little Spider | - | 1 pips | `aos` |
| `50151` | Pale Little Spider | Treachery | Pale Little Spider | - | 1 pips | `aos` |
| `50152` | Radioactive Man | Minion | Power of the Atom | SCH:1 ATK:2 HP:18 | 4 pips | `aos` |
| `50153` | Radiation Exposure | Attachment | Power of the Atom | SCH:-1 ATK:-1 | 2 pips | `aos` |
| `50154` | Runaway Nuclear Reaction | Side Scheme | Power of the Atom | - | 3 pips | `aos` |
| `50155` | Power of the Atom | Treachery | Power of the Atom | - | Star | `aos` |
| `50156` | MACH-IV | Minion | Supersonic | SCH:1 ATK:2 HP:16 | 4 pips | `aos` |
| `50157` | Blasters | Attachment | Supersonic | ATK:1 | 1 pips | `aos` |
| `50158` | Heat-Seeking Missiles | Attachment | Supersonic | - | 2 pips | `aos` |
| `50159` | Aerial Dogfight | Side Scheme | Supersonic | - | 2 pips | `aos` |
| `50160` | Supersonic | Treachery | Supersonic | - | 1 pips | `aos` |
| `50161` | Batroc | Minion | The Leaper | SCH:1 ATK:2 HP:16 | 4 pips | `aos` |
| `50162` | Coup de Foudre | Side Scheme | The Leaper | - | 2 pips | `aos` |
| `50163` | Batroc the Leaper | Treachery | The Leaper | - | 1 pips | `aos` |
| `50164` | Parcours du Combattant | Treachery | The Leaper | - | 1 pips | `aos` |
| `50165a` | Baron Zemo | Villain | Baron Zemo | SCH:3 ATK:2 HP:12 | - | `aos` |
| `50165b` | Baron Zemo | Villain | Baron Zemo | SCH:3 ATK:2 HP:18 | - | `aos` |
| `50166a` | Baron Zemo | Villain | Baron Zemo | SCH:4 ATK:2 HP:16 | - | `aos` |
| `50166b` | Baron Zemo | Villain | Baron Zemo | SCH:4 ATK:2 HP:18 | - | `aos` |
| `50167a` | Zemo's Manipulations | Main Scheme | Baron Zemo | - | - | `aos` |
| `50167b` | Zemo's Manipulations | Main Scheme | Baron Zemo | - | - | `aos` |
| `50168a` | The Accusation | Main Scheme | Baron Zemo | - | - | `aos` |
| `50168b` | The Accusation | Main Scheme | Baron Zemo | - | - | `aos` |
| `50169a` | Fighting Zemo | Main Scheme | Baron Zemo | - | - | `aos` |
| `50169b` | Fighting Zemo | Main Scheme | Baron Zemo | - | - | `aos` |
| `50170` | Baron Zemo's Sword | Attachment | Baron Zemo | ATK:2 | 2 pips | `aos` |
| `50171` | Reluctant Foe | Attachment | Baron Zemo | - | 3 pips | `aos` |
| `50172` | S.H.I.E.L.D. Agent | Minion | Baron Zemo | SCH:2 ATK:1 HP:3 | 2 pips | `aos` |
| `50173` | Divided Loyalties | Side Scheme | Baron Zemo | - | 3 pips | `aos` |
| `50174` | Undermine Support | Side Scheme | Baron Zemo | - | 2 pips | `aos` |
| `50175` | Battle of Wits | Treachery | Baron Zemo | - | 1 pips | `aos` |
| `50176` | Might Makes Right | Treachery | Baron Zemo | - | 2 pips | `aos` |
| `50177` | The Ends Justify the Means | Treachery | Baron Zemo | - | 1 pips | `aos` |
| `50178` | S.H.I.E.L.D. Trooper | Minion | S.H.I.E.L.D. | SCH:0 ATK:2 HP:4 | 1 pips | `aos` |
| `50179` | Arrest Warrant | Obligation | S.H.I.E.L.D. | - | 2 pips | `aos` |
| `50180` | Disavowed | Side Scheme | S.H.I.E.L.D. | - | 3 pips | `aos` |
| `50181a` | Chief Medical Officer | Environment | S.H.I.E.L.D. Executive Board | - | - | `aos` |
| `50181b` | Medical Officer's Aid | Attachment | S.H.I.E.L.D. Executive Board | ATK:1 | - | `aos` |
| `50182a` | Chief Surveillance Officer | Environment | S.H.I.E.L.D. Executive Board | - | - | `aos` |
| `50182b` | Surveillance Officer's Aid | Attachment | S.H.I.E.L.D. Executive Board | SCH:1 | - | `aos` |
| `50183a` | Chief Tactical Officer | Environment | S.H.I.E.L.D. Executive Board | - | - | `aos` |
| `50183b` | Tactical Officer's Aid | Attachment | S.H.I.E.L.D. Executive Board | ATK:1 | - | `aos` |
| `50184a` | A.I.M. Interference ([energy]) | Treachery | S.H.I.E.L.D. Executive Board | - | 1 pips | `aos` |
| `50184b` | A.I.M. Interference ([mental]) | Treachery | S.H.I.E.L.D. Executive Board | - | 1 pips | `aos` |
| `50184c` | A.I.M. Interference ([physical]) | Treachery | S.H.I.E.L.D. Executive Board | - | 1 pips | `aos` |
| `50185` | Medical Records | Evidence - Means | Executive Board Evidence | - | - | `aos` |
| `50186` | Wiretap | Evidence - Means | Executive Board Evidence | - | - | `aos` |
| `50187` | Security Scanner | Evidence - Means | Executive Board Evidence | - | - | `aos` |
| `50188` | Money | Evidence - Motive | Executive Board Evidence | - | - | `aos` |
| `50189` | Blackmail | Evidence - Motive | Executive Board Evidence | - | - | `aos` |
| `50190` | Ideology | Evidence - Motive | Executive Board Evidence | - | - | `aos` |
| `50191` | Security Clearance | Evidence - Opportunity | Executive Board Evidence | - | - | `aos` |
| `50192` | Travel | Evidence - Opportunity | Executive Board Evidence | - | - | `aos` |
| `50193` | Authority | Evidence - Opportunity | Executive Board Evidence | - | - | `aos` |

---

## Pack: Agents of S.H.I.E.L.D. (`aos`)

### Set: Maria Hill

### [50001a] Maria Hill
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2, **ATK**: 1, **DEF**: 2, **HP**: 9, **Hand Size**: 5
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > Each ally you control gains the [[S.H.I.E.L.D.]] trait.
  > *Reassignment* — **Action**: Move 1 all-purpose counter from a [[S.H.I.E.L.D.]] support to another [[S.H.I.E.L.D.]] support. (Limit once per round.)
- **Image Asset**: `assets/card-art/bundles/cards/50001a.png` (300×426 px, 202.2 KB)
### [50001b] Maria Hill
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 3, **HP**: 9, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > You may include the maximum number of copies of 3 [[S.H.I.E.L.D.]] supports in your deck from aspects other than your chosen aspect.
  > **Action**: Exhaust Maria Hill → search your deck for a [[S.H.I.E.L.D.]] support and add it to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/50001b.png` (300×426 px, 168.2 KB)
### [50002] Nick Fury
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (1/15)
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > [star] **Response**: After Nick Fury uses a basic power, place 1 all-purpose counter on a [[S.H.I.E.L.D.]] support.
- **Flavor**: *"I put my best agent on the case." —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/50002.jpg` (710×1030 px, 327.0 KB)
### [50003] All-Points Bulletin
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (2–3/15, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Tactic.*
- **Rules Text**:
  > **Hero Action**: For each [[S.H.I.E.L.D.]] support you control, choose:
  > • Remove 1 threat from a scheme.
  > • Deal 1 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/50003.png` (710×1030 px, 311.7 KB)
### [50004] On the Double
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (4–5/15, Qty: 2)
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Rules Text**:
  > **Action**: Ready any number of [[S.H.I.E.L.D.]] supports with a combined printed cost of 6 or less.
- **Flavor**: *"I want the suspect in custody yesterday!" —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/50004.jpg` (710×1030 px, 337.2 KB)
### [50005] Reinforcements
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (6–8/15, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Rules Text**:
  > **Action**: Choose any number of [[S.H.I.E.L.D.]] supports with a combined printed cost of 6 or less. Place 1 all-purpose counter on each of those supports.
- **Flavor**: *"We got orders straight from the Director. Move it!" —Dum Dum Dugan*
- **Image Asset**: `assets/card-art/bundles/cards/50005.png` (710×1030 px, 343.2 KB)
### [50006] The Hard Call
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (9/15)
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Rules Text**:
  > **Hero Action**: Discard a [[S.H.I.E.L.D.]] support you control → deal X damage to each enemy, where X is the printed cost of the discarded support.
- **Flavor**: *"Sometimes it just comes down to numbers. More people die if I don't act than if I do." —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/50006.png` (710×1030 px, 324.6 KB)
### [50007] Special Funding
- **Type**: `Resource`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (10–11/15, Qty: 2)
- **Stats**: **Resources**: [physical] [mental]
- **Rules Text**:
  > **Response**: After you spend this card to pay for a [[S.H.I.E.L.D.]] support, place 1 all-purpose counter on that support after it enters play.
- **Image Asset**: `assets/card-art/bundles/cards/50007.jpg` (710×1030 px, 350.2 KB)
### [50008] Support Staff
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (12/15)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Persona. S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 staff counters).
  > **Resource**: Exhaust Support Staff and remove 1 staff counter from it → generate a [wild] resource for a player whose identity has the [[S.H.I.E.L.D.]] trait.
- **Image Asset**: `assets/card-art/bundles/cards/50008.jpg` (710×1030 px, 351.5 KB)
### [50009] The Iliad
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (13/15)
- **Properties**: Unique
- **Stats**: **Cost**: 6, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D. Vehicle.*
- **Rules Text**:
  > Uses (3 mission counters).
  > **Action**: Exhaust The Iliad and remove 1 mission counter from it → choose:
  > • Deal 5 damage to an enemy.
  > • Remove 4 threat from a scheme.
  > • Heal 3 damage from an identity.
- **Image Asset**: `assets/card-art/bundles/cards/50009.png` (710×1030 px, 362.0 KB)
### [50010] Life Model Decoy
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (14/15)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Preparation. Tech.*
- **Rules Text**:
  > **Interrupt**: When an enemy attacks you, discard Life Model Decoy → prevent all damage from that attack.
- **Flavor**: *"When you've got job hazards like I do, it pays to take precautions." —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/50010.jpg` (710×1030 px, 359.0 KB)
### [50011] S.H.I.E.L.D. Director
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (15/15)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [mental]
- **Traits**: *Title.*
- **Rules Text**:
  > **Action**: Exhaust S.H.I.E.L.D. Director → place 1 all-purpose counter on a [[S.H.I.E.L.D.]] support.
- **Flavor**: *"You don't have to agree with my orders. You just have to carry them out." —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/50011.png` (710×1030 px, 374.1 KB)
### [50029] Press Conference
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Maria Hill Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Maria Hill player.***
  > **Forced Response**: After the player phase ends, remove 1 all-purpose counter from each support you control.
  > **Alter-Ego Action**: Exhaust your identity → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/50029.jpg` (710×1030 px, 345.8 KB)

### Set: Leadership

### [50012] Victoria Hand
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 12
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 2, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > **Response**: After Victoria Hand enters play, ready a [[S.H.I.E.L.D.]] support.
- **Flavor**: *"I better get hazard pay for this!"*
- **Image Asset**: `assets/card-art/bundles/cards/50012.png` (710×1030 px, 339.2 KB)
### [50013] Slingshot — *Yo-Yo Rodriguez*
- **Type**: `Ally`
- **Faction / Aspect**: Leadership
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 13
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Action**: Spend a [energy] resource → put Slingshot into play from your hand under any player's control. At the end of the phase, if Slingshot is still in play, return her to your hand.
- **Image Asset**: `assets/card-art/bundles/cards/50013.jpg` (710×1030 px, 357.8 KB)
### [50014] Organizational Support
- **Type**: `Resource`
- **Faction / Aspect**: Leadership
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 14
- **Stats**: **Resources**: [mental]
- **Rules Text**:
  > **Interrupt**: When you spend this card, exhaust up to 3 allies and/or supports you control that share a [[Trait]] with your identity → generate the printed resources on each card exhausted this way.
- **Image Asset**: `assets/card-art/bundles/cards/50014.png` (710×1030 px, 404.2 KB)
### [50015] Agents of S.H.I.E.L.D.
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 15
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Team.*
- **Rules Text**:
  > Play under any player's control. Max 1 [[Team]] card per player.
  > If each of your characters has the [[S.H.I.E.L.D.]] trait, this card gains: "**Interrupt**: When you reveal an encounter card, exhaust this card → cancel the effects of that card and discard it. Then, reveal another card from the encounter deck."
- **Image Asset**: `assets/card-art/bundles/cards/50015.jpg` (710×1030 px, 318.7 KB)
### [50016] Command Team
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 16
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Uses (3 command counters).
  > **Action**: Exhaust Command Team and remove 1 command counter from it → ready an ally.
### [50017] The Circe
- **Type**: `Support`
- **Faction / Aspect**: Leadership
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 17
- **Properties**: Unique
- **Stats**: **Cost**: 6, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Vehicle.*
- **Rules Text**:
  > Uses (2 deploy counters).
  > **Action**: Exhaust The Circe, remove 1 deploy counter from it, and choose a player → that player puts an ally into play from their hand.
- **Image Asset**: `assets/card-art/bundles/cards/50017.png` (710×1030 px, 371.1 KB)

### Set: Aggression

### [50018] The Bellerophon
- **Type**: `Support`
- **Faction / Aspect**: Aggression
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 18
- **Properties**: Unique
- **Stats**: **Cost**: 6, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D. Vehicle.*
- **Rules Text**:
  > Uses (3 missile counters).
  > **Action**: Exhaust The Bellerophon, remove 1 missile counter from it, and choose a player → deal 3 damage to the villain and each minion engaged with that player, discarding all tough status cards from those enemies first.
- **Image Asset**: `assets/card-art/bundles/cards/50018.png` (710×1030 px, 352.1 KB)

### Set: Justice

### [50019] The Douglass
- **Type**: `Support`
- **Faction / Aspect**: Justice
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 19
- **Properties**: Unique
- **Stats**: **Cost**: 6, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Vehicle.*
- **Rules Text**:
  > Uses (3 operation counters).
  > **Action**: Exhaust The Douglass and remove 1 operational counter from it → remove 2 threat from each scheme, ignoring any crisis icons ([crisis]) in play.
- **Image Asset**: `assets/card-art/bundles/cards/50019.jpg` (710×1030 px, 335.4 KB)
### [50047] Agent Coulson
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 47
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > **Response**: After Agent Coulson enters play, search your deck and discard pile for a [[Preparation]] card and add it to your hand. Shuffle your deck.
- **Flavor**: *"I'm a guy with a plan."*
### [50048] Quake — *Daisy Johnson*
- **Type**: `Ally`
- **Faction / Aspect**: Justice
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 48
- **Properties**: Unique
- **Stats**: **Cost**: 2, **THW**: 1 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 2, **Resources**: [energy]
- **Traits**: *Avenger. S.H.I.E.L.D.*
- **Rules Text**:
  > **Response**: After a minion schemes, exhaust Quake → deal 2 damage to that minion.
- **Flavor**: *"I will bring this building down around you!"*
### [50049] Global Logistics
- **Type**: `Event`
- **Faction / Aspect**: Justice
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 49
- **Stats**: **Cost**: 0, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Tactic.*
- **Rules Text**:
  > **Action**: Exhaust 1 [[S.H.I.E.L.D.]] card you control → look at the top 4 cards of a player deck or the encounter deck. Discard any number of those, and put the others on the top and/or bottom of that deck in any order.
### [50050] Informant
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 50
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Preparation.*
- **Rules Text**:
  > Max 1 per player.
  > **Interrupt**: When a minion schemes, discard Informant → this activation removes threat instead of placing it.
- **Flavor**: *"What's that information worth to you, Coulson?" —Taskmaster*
- **Image Asset**: `assets/card-art/bundles/cards/50050.png` (710×1030 px, 279.8 KB)
### [50051] Intelligence
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 51
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Preparation.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After a player is dealt an encounter card, discard Intelligence → look at each encounter card dealt to each player and the top card of the encounter deck. You may swap any number of those cards.
- **Image Asset**: `assets/card-art/bundles/cards/50051.jpg` (710×1030 px, 343.1 KB)
### [50052] Prism Dust
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 52
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Preparation. Tech.*
- **Rules Text**:
  > Max 1 per player.
  > **Hero Response** *(attack)*: After a minion enters play, discard Prism Dust → confuse that minion and deal 2 damage to it.
- **Image Asset**: `assets/card-art/bundles/cards/50052.jpg` (710×1030 px, 357.7 KB)
### [50053] Under Surveillance
- **Type**: `Upgrade`
- **Faction / Aspect**: Justice
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 53
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to the main scheme. Max 1 per scheme.
  > Increase the target threat value of attached scheme by 4.

### Set: Protection

### [50020] The Pericles
- **Type**: `Support`
- **Faction / Aspect**: Protection
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 20
- **Properties**: Unique
- **Stats**: **Cost**: 6, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D. Vehicle.*
- **Rules Text**:
  > Uses (2 supply counters).
  > **Action**: Exhaust The Pericles and remove 1 supply counter from it → give a hero or villain a status card of your choice. Give an ally or minion a status card of your choice.
- **Image Asset**: `assets/card-art/bundles/cards/50020.jpg` (710×1030 px, 339.8 KB)

### Set: Basic

### [50021] Dum Dum Dugan
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 21
- **Properties**: Unique
- **Stats**: **Cost**: 5, **THW**: 3 (Consequential: 3), **ATK**: 3 (Consequential: 2), **HP**: 5, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > **Interrupt**: When you use one of Dum Dum Dugan's basic powers, exhaust up to 3 [[S.H.I.E.L.D.]] cards you control. For each card exhausted this way, Dum Dum Dugan gets +1 to that power for this use.
### [50022] Grant Ward
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 22
- **Properties**: Unique
- **Stats**: **Cost**: 0, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [physical]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > Grant Ward cannot defend.
  > **Forced Response**: After you reveal a treachery, you may spend a [mental] resource. If you do not, take damage equal to Grant Ward's ATK and remove Grant Ward from the game.
- **Image Asset**: `assets/card-art/bundles/cards/50022.png` (710×1030 px, 374.9 KB)
### [50023] Melinda May
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 23
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 [star] (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Spy.*
- **Rules Text**:
  > [star] **Response**: After Melinda May uses a basic power, look at the top card of the encounter deck. You may discard that card.
- **Flavor**: *"Don't call me the Cavalry."*
- **Image Asset**: `assets/card-art/bundles/cards/50023.jpg` (710×1030 px, 332.2 KB)
### [50024] Super Spies
- **Type**: `Event`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 24
- **Stats**: **Cost**: 0, **Resources**: [wild]
- **Rules Text**:
  > Team-Up (Maria Hill and Nick Fury). Max 1 per deck.
  > **Hero Action**: Place a total of 3 all-purpose counters and/or threat tokens on [[S.H.I.E.L.D.]] supports and/or suit form upgrades.
- **Image Asset**: `assets/card-art/bundles/cards/50024.png` (710×1030 px, 352.7 KB)
### [50025] Energy
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 25
- **Stats**: **Resources**: [energy] [energy]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/50025.jpg` (710×1030 px, 319.3 KB)
### [50026] Genius
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 26
- **Stats**: **Resources**: [mental] [mental]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/50026.jpg` (710×1030 px, 363.7 KB)
### [50027] Strength
- **Type**: `Resource`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 27
- **Stats**: **Resources**: [physical] [physical]
- **Rules Text**:
  > Max 1 per deck.
- **Image Asset**: `assets/card-art/bundles/cards/50027.png` (710×1030 px, 359.0 KB)
### [50028] Front Organization
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 28
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Location.*
- **Rules Text**:
  > Play under any player's control. Max 1 per player.
  > **Interrupt**: When an encounter card effect would discard a card you control, discard Front Organization instead of discarding that card.
- **Image Asset**: `assets/card-art/bundles/cards/50028.png` (710×1030 px, 386.3 KB)
### [50054] Nick Fury, Sr.
- **Type**: `Ally`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 54
- **Properties**: Unique
- **Stats**: **Cost**: 4, **THW**: 2 (Consequential: 1), **ATK**: 2 (Consequential: 1), **HP**: 3, **Resources**: [mental]
- **Traits**: *S.H.I.E.L.D. Soldier.*
- **Rules Text**:
  > **Forced Response**: After Nick Fury, Sr. enters play, choose one: Remove 3 threat from a scheme, draw 2 cards, or give a [[S.H.I.E.L.D.]] character a tough status card. At the end of the round, if Nick Fury, Sr. is still in play, discard him.
- **Image Asset**: `assets/card-art/bundles/cards/50054.jpg` (710×1030 px, 382.9 KB)
### [50055] Jemma Simmons
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 55
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Persona. S.H.I.E.L.D.*
- **Rules Text**:
  > Reduce the cost to play Jemma Simmons by 2 if your identity has the [[S.H.I.E.L.D.]] trait.
  > **Resource**: Exhaust Jemma Simmons → generate a [mental] resource for a [[Tech]] card.
- **Image Asset**: `assets/card-art/bundles/cards/50055.png` (710×1030 px, 359.7 KB)
### [50056] Leo Fitz
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 56
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [mental]
- **Traits**: *Persona. S.H.I.E.L.D.*
- **Rules Text**:
  > Reduce the cost to play Leo Fitz by 2 if your identity has the [[S.H.I.E.L.D.]] trait.
  > **Alter-Ego Action**: Exhaust Leo Fitz → search you deck for a [[Tech]] card and add it to your hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50056.png` (710×1030 px, 356.5 KB)
### [50057] Sky-Destroyer
- **Type**: `Support`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 57
- **Properties**: Unique
- **Stats**: **Cost**: 3, **Resources**: [energy]
- **Traits**: *S.H.I.E.L.D. Vehicle.*
- **Rules Text**:
  > **Response**: After you play a [[S.H.I.E.L.D.]] card, exhaust Sky-Destroyer → deal 2 damage to an enemy.
- **Flavor**: *"It's not often we deploy a Sky-Destroyer. But when we do, that's how you know the situation is about to get serious." —Nick Fury*
### [50058] Practiced Plan
- **Type**: `Upgrade`
- **Faction / Aspect**: Basic
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pack Position: 58
- **Stats**: **Cost**: 0, **Resources**: [energy]
- **Traits**: *Preparation.*
- **Rules Text**:
  > Max 1 per player.
  > **Response**: After you discard a [[Preparation]] card you control, discard Practiced Plan → return that card to your hand from your discard pile.
- **Image Asset**: `assets/card-art/bundles/cards/50058.jpg` (710×1030 px, 346.7 KB)

### Set: Maria Hill Nemesis

### [50030] Controller
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Maria Hill Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Psionic.*
- **Rules Text**:
  > [star] **Forced Response**: After Controller activates against you, remove 1 all-purpose counter from a support. If Controlled Innocents is in play, put the top card of your deck into play facedown, engaged with you as a [[Controlled]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/50030.png` (710×1030 px, 271.5 KB)
### [50031] Army of the Controlled
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill Nemesis (2/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Maria Hill Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Find the Controlled Innocents environment and put it into play.
  > **When Defeated**: Discard each [[Controlled]] minion. Place 1 all-purpose counter on a support for each minion discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/50031.jpg` (1030×710 px, 308.3 KB)
### [50032] Controlled Innocents
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill Nemesis (3/5)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Maria Hill Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each facedown [[Controlled]] minion engaged with a player has a base SCH of 1, a base ATK of 1, and a base hit points of 1.
  > **Forced Response**: After a [[Controlled]] minion is defeated, place that card in its owner's discard pile and place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/50032.jpg` (710×1030 px, 308.9 KB)
### [50033] Diabolical Discs
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Maria Hill Nemesis (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Maria Hill Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Remove 1 all-purpose counter from a support. If Controlled Innocents is in play, put the top card of your deck into play facedown, engaged with you as a [[Controlled]] minion.
- **Image Asset**: `assets/card-art/bundles/cards/50033.png` (710×1030 px, 302.7 KB)

### Set: Nick Fury

### [50034a] Nick Fury
- **Type**: `Hero`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (Identity Card)
- **Properties**: Unique
- **Stats**: **THW**: 2 [star], **ATK**: 2, **DEF**: 2, **HP**: 10, **Hand Size**: 5
- **Traits**: *S.H.I.E.L.D. Soldier. Spy.*
- **Rules Text**:
  > [star] *Gather Intel* — **Response**: After Nick Fury makes a basic thwart, place 1 threat on your suit form upgrade.
  > *Break Cover* — **Forced Interrupt**: When you attack, change to Assault suit form.
- **Image Asset**: `assets/card-art/bundles/cards/50034a.png` (300×425 px, 220.5 KB)
### [50034b] Nick Fury
- **Type**: `Alter-Ego`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (Identity Card)
- **Properties**: Unique
- **Stats**: **REC**: 4, **HP**: 10, **Hand Size**: 6
- **Traits**: *S.H.I.E.L.D. Soldier. Spy.*
- **Rules Text**:
  > *Suit Up* — **Setup**: Put your suit form upgrade into play, Assault side faceup.
  > *Infiltrate* — **Action**: Change to Stealth suit form.
- **Image Asset**: `assets/card-art/bundles/cards/50034b.png` (300×425 px, 199.4 KB)
### [50035a] Assault
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (1/16)
- **Properties**: Permanent
- **Stats**: **Resources**: [physical]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Suit form. Permanent.
  > **Interrupt**: When you attack, remove up to 3 threat from here → this attack deals 1 additional damage for each threat removed this way.
- **Image Asset**: `assets/card-art/bundles/cards/50035a.png` (289×419 px, 232.0 KB)
### [50035b] Stealth
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (1/16)
- **Properties**: Permanent
- **Stats**: **Resources**: [mental]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > Suit form. Permanent.
  > **Forced Interrupt (Hero)**: When an enemy would attack you, it schemes instead. Place 1 threat from that activation here instead of on the main scheme if there is 5 or less threat on this card.
- **Image Asset**: `assets/card-art/bundles/cards/50035b.png` (289×419 px, 228.0 KB)
### [50036] Maria Hill
- **Type**: `Ally`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (2/16)
- **Properties**: Unique
- **Stats**: **Cost**: 3, **THW**: 2 [star] (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 3, **Resources**: [wild]
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > [star] **Interrupt**: When Maria Hill thwarts, place the removed threat on your suit form upgrade.
- **Flavor**: *"Now that's how you make an exit!"*
- **Image Asset**: `assets/card-art/bundles/cards/50036.png` (710×1030 px, 346.8 KB)
### [50037] Concentrated Fire
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (3–4/16, Qty: 2)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Deal 4 damage to an enemy. This attack gains ranged. If this attack defeats an enemy, choose:
  > • Place threat on your suit form upgrade equal to that enemy's printed SCH.
  > • Change to Stealth suit form.
- **Image Asset**: `assets/card-art/bundles/cards/50037.jpg` (710×1030 px, 365.6 KB)
### [50038] Covert Surveillance
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (5–7/16, Qty: 3)
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Thwart.*
- **Rules Text**:
  > **Hero Action** *(thwart)*: Remove 2 threat from a scheme. If you are in Stealth suit form, you may place that threat on your suit form upgrade. Otherwise, you may change to Stealth suit form.
- **Image Asset**: `assets/card-art/bundles/cards/50038.jpg` (710×1030 px, 343.9 KB)
### [50039] Spray Fire
- **Type**: `Event`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (8–9/16, Qty: 2)
- **Stats**: **Cost**: 3, **Resources**: [physical]
- **Traits**: *Attack.*
- **Rules Text**:
  > **Hero Action** *(attack)*: Choose a player. Deal 3 damage to the villain and each minion engaged with that player. This attack gains ranged.
- **Flavor**: *"Eat lasers!" —Nick Fury*
- **Image Asset**: `assets/card-art/bundles/cards/50039.png` (710×1030 px, 343.6 KB)
### [50040] Fury's Flying Car
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (10/16)
- **Properties**: Unique
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Aerial. Tech. Vehicle.*
- **Rules Text**:
  > **Hero Action**: Exhaust Fury's Flying Car and remove 1 threat from your suit form upgrade → ready Nick Fury. He gains the [[Aerial]] trait until the end of the round.
- **Flavor**: *"This job has its perks." —Nick Fury*
- **Image Asset**: `assets/card-art/bundles/cards/50040.jpg` (710×1030 px, 372.2 KB)
### [50041] Safe House #221
- **Type**: `Support`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (11/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [mental]
- **Traits**: *Location. S.H.I.E.L.D.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust Safe House #221 → choose:
  > • Heal 2 damage from Nick Fury.
  > • Place 1 threat on your suit form upgrade.
- **Image Asset**: `assets/card-art/bundles/cards/50041.png` (710×1030 px, 351.3 KB)
### [50042] EM Shield
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (12/16)
- **Stats**: **Cost**: 2, **Resources**: [energy]
- **Traits**: *Preparation. Tech.*
- **Rules Text**:
  > **Interrupt** *(defense)*: When you would take any amount of damage from an attack, discard EM Shield → prevent all of that damage.
- **Image Asset**: `assets/card-art/bundles/cards/50042.png` (710×1030 px, 377.0 KB)
### [50043] Eyepatch Camera
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (13/16)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Preparation. Tech.*
- **Rules Text**:
  > **Hero Interrupt**: When any amount of threat would be placed on the main scheme, discard Eyepatch Camera → place up to 3 of that threat on your suit form upgrade instead.
- **Image Asset**: `assets/card-art/bundles/cards/50043.jpg` (710×1030 px, 336.5 KB)
### [50044] Fury's Watch
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (14/16)
- **Properties**: Unique
- **Stats**: **Cost**: 1, **Resources**: [physical]
- **Traits**: *Item. Tech.*
- **Rules Text**:
  > **Resource**: Exhaust Fury's Watch and remove up to 2 threat from your suit form upgrade → generate a [mental] resource for each threat you removed this way.
- **Image Asset**: `assets/card-art/bundles/cards/50044.png` (710×1030 px, 387.7 KB)
### [50045] Intelligence Analysis
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (15/16)
- **Stats**: **Cost**: 0, **Resources**: [mental]
- **Traits**: *Preparation. Skill.*
- **Rules Text**:
  > **Interrupt**: When you reveal a treachery, discard Intelligence Analysis and remove 1 threat from your suit form upgrade → cancel the effects of that treachery and discard it.
- **Image Asset**: `assets/card-art/bundles/cards/50045.jpg` (710×1030 px, 317.1 KB)
### [50046] Secret Agent
- **Type**: `Upgrade`
- **Faction / Aspect**: Hero
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (16/16)
- **Stats**: **Cost**: 2, **Resources**: [physical]
- **Traits**: *Title.*
- **Rules Text**:
  > **Hero Response**: After you resolve the ability of a [[Preparation]] card you control, move 1 threat from a scheme to your suit form upgrade.
- **Flavor**: *"I'm a man who leads a life of danger." —Nick Fury*
- **Image Asset**: `assets/card-art/bundles/cards/50046.jpg` (710×1030 px, 364.8 KB)
### [50059] Discovered
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury (Set Card, unnumbered)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nick Fury Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > ***Give to the Nick Fury player.***
  > **When Revealed**: Change to Assault suit form. If there is no threat on your suit form upgrade, this card gains surge. Otherwise, choose to either take 1 damage for each threat on your suit form upgrade, or remove each threat from your suit form upgrade. In either case, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/50059.png` (710×1030 px, 350.7 KB)

### Set: Nick Fury Nemesis

### [50060] Orion
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury Nemesis (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nick Fury Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Leviathan.*
- **Rules Text**:
  > Toughness.
  > Orion can have any number of tough status cards.
  > **Forced Response**: After Orion takes any amount of damage, give him a tough status card.
  > *(Nick Fury's nemesis minion.)*
- **Image Asset**: `assets/card-art/bundles/cards/50060.png` (710×1030 px, 314.2 KB)
### [50061] Acquire Infinity Formula
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury Nemesis (2/5)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nick Fury Nemesis Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **Forced Response**: After Nick Fury takes any amount of damage, give Orion a tough status card. If Orion is not in play, find him and put him into play engaged with the Nick Fury player.
- **Image Asset**: `assets/card-art/bundles/cards/50061.jpg` (1030×710 px, 334.6 KB)
### [50062] Leviathan Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury Nemesis (3–4/5, Qty: 2)
- **Stats**: **SCH**: 0 [star], **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Nick Fury Nemesis Set Icon (printed bottom-right next to deck number)
- **Traits**: *Leviathan.*
- **Rules Text**:
  > Toughness.
  > [star] **Forced Response**: After Leviathan Soldier schemes, deal 1 damage to the engaged player's identity.
- **Flavor**: *Formerly a secret branch of the KGB, Leviathan has gone independent with their aim of world domination.*
- **Image Asset**: `assets/card-art/bundles/cards/50062.jpg` (710×1030 px, 307.2 KB)
### [50063] Cold Storage
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Nick Fury Nemesis (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Nick Fury Nemesis Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Search the encounter deck and discard pile for a [[Leviathan]] minion and put it into play engaged with you. *(Shuffle.)* Otherwise, take 2 damage.
  >
  > ---
  >
  > [star] **Boost**: Take 1 damage.
- **Image Asset**: `assets/card-art/bundles/cards/50063.png` (710×1030 px, 351.2 KB)

### Set: Black Widow

### [50064] Black Widow
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (1/23)
- **Properties**: Unique, Stage I
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spy.*
- **Rules Text**:
  > **Forced Interrupt**: When a character you control attacks Black Widow, remove 1 threat from the main scheme *(ignoring any crisis icons in play)* → discard the top card of the encounter deck and resolve each "**Preparation**" ability on that card.
- **Image Asset**: `assets/card-art/bundles/cards/50064.jpg` (710×1030 px, 337.3 KB)
### [50065] Black Widow
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (2/23)
- **Properties**: Unique, Stage II
- **Stats**: **SCH**: 2, **ATK**: 2, **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spy.*
- **Rules Text**:
  > **When Revealed**: Place 2[per_hero] threat on the main scheme.
  > **Forced Interrupt**: When a character you control attacks Black Widow, remove 1 threat from the main scheme → discard the top card of the encounter deck and resolve each "**Preparation**" ability on that card.
- **Image Asset**: `assets/card-art/bundles/cards/50065.png` (710×1030 px, 338.7 KB)
### [50066] Black Widow
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (3/23)
- **Properties**: Unique, Stage III
- **Stats**: **SCH**: 3, **ATK**: 2, **HP**: 13 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Spy.*
- **Rules Text**:
  > **When Revealed**: Place 3[per_hero] threat on the main scheme.
  > **Forced Interrupt**: When a character you control attacks Black Widow, remove 1 threat from the main scheme → discard the top card of the encounter deck and resolve each "**Preparation**" ability on that card.
- **Image Asset**: `assets/card-art/bundles/cards/50066.png` (710×1030 px, 337.4 KB)
### [50067a] The Widow's Web
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (4/23)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Black Widow (I) and Black Widow (II). *(Black Widow (II) and Black Widow (III) instead for expert mode.)* Black Widow and Standard encounter sets. Two modular encounter sets *(A.I.M. Abduction and A.I.M. Science)*.
  > **Setup**: Each player searches the encounter deck for a minion and puts it into play engaged with them. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50067a.png` (419×289 px, 228.4 KB)
### [50067b] The Widow's Web
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (4/23)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +-1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > X is Black Widow's stage number.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *You track the missing S.H.I.E.L.D. specialist to a decommissioned stretch of subway tunnel and discover her kidnappers' base of operations.*
- **Image Asset**: `assets/card-art/bundles/cards/50067b.png` (419×289 px, 234.7 KB)
### [50068] Black Widow's Gauntlet
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (5–6/23, Qty: 2)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attack to Black Widow.
  > Black Widow gains retaliate 1.
  > **Hero Response**: After a character you control attacks Black Widow, if no "**Preparation**" ability was resolved, discard this card *(after resolving the retaliate keyword)*.
  >
  > ---
  >
  > **Preparation**: Attach this card to Black Widow.
- **Image Asset**: `assets/card-art/bundles/cards/50068.jpg` (710×1030 px, 373.5 KB)
### [50069] Grappling Hook
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (7/23)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attack to Black Widow.
  > **Forced Interrupt**: When a player plays an event card, cancel its effects and discard it. Then, discard this card.
  >
  > ---
  >
  > **Preparation**: Discard 1 event card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/50069.png` (710×1030 px, 344.2 KB)
### [50070] Night Vision Goggles
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (8/23)
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attack to Black Widow.
  > Each encounter card without a printed "**Preparation**" ability gains "**Preparation**: Prevent all damage from this attack. Then, discard Night Vision Goggles."
  >
  > ---
  >
  > **Preparation**: Attach this card to Black Widow.
- **Image Asset**: `assets/card-art/bundles/cards/50070.jpg` (710×1030 px, 361.0 KB)
### [50071] Stun Net
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (9/23)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Traits**: *Item.*
- **Rules Text**:
  > Attach to your identity.
  > Attached character cannot attack.
  > **Hero Action**: Exhaust a character you control → discard this card. Any player may trigger this ability.
  >
  > ---
  >
  > **Preparation**: After this attack, attach this card to the attacking character.
- **Image Asset**: `assets/card-art/bundles/cards/50071.png` (710×1030 px, 371.3 KB)
### [50072] A.I.M. Commando
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (10–11/23, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Traits**: *A.I.M.*
- **Rules Text**:
  > Quickstrike.
  >
  > ---
  >
  > **Preparation**: After this attack, put this minion into play engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/50072.png` (710×1030 px, 320.8 KB)
### [50073] A.I.M. Grunt
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (12–13/23, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Traits**: *A.I.M.*
- **Rules Text**:
  > Guard.
  >
  > ---
  >
  > **Preparation**: Put this minion into play engaged with you. Then, resolve this attack against A.I.M. Grunt instead.
- **Image Asset**: `assets/card-art/bundles/cards/50073.jpg` (710×1030 px, 285.1 KB)
### [50074] Automated Defenses
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (14/23)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1[per_hero].
  > Each encounter card without a printed "**Preparation**" ability gains "**Preparation**: Deal 1 damage to the attacking character."
- **Image Asset**: `assets/card-art/bundles/cards/50074.png` (1030×710 px, 324.7 KB)
### [50075] Destroy Evidence
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (15/23)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > Hinder 2[per_hero].
  > Each other encounter card gains incite 1. *(When revealed, place 1 threat on the main scheme.)*
- **Image Asset**: `assets/card-art/bundles/cards/50075.jpg` (1030×710 px, 329.0 KB)
### [50076] Attacrobatics
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (16–17/23, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If you are in alter-ego form, change to hero form. Black Widow attacks you. Give her an additional boost card for this attack.
  >
  > ---
  >
  > **Preparation**: Prevent all damage from this attack. In expert mode, deal that much damage to the attacking character.
- **Image Asset**: `assets/card-art/bundles/cards/50076.jpg` (710×1030 px, 352.9 KB)
### [50077] Covert Ops
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (18–19/23, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are confused. Black Widow schemes.
  >
  > ---
  >
  > **Preparation**: Place 1 threat on each scheme.
- **Image Asset**: `assets/card-art/bundles/cards/50077.png` (710×1030 px, 313.9 KB)
### [50078] Dance of Death
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (20–21/23, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Deal 1 damage to a character you control. Deal 2 damage to a second character you control. Deal 3 damage to a third character you control.
  >
  > ---
  >
  > **Preparation**: Deal 1 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/50078.png` (710×1030 px, 343.7 KB)
### [50079] Widow's Bite
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Black Widow (22–23/23, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Black Widow Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: You are stunned. Take 1 damage (2 damage instead if you were already stunned).
  >
  > ---
  >
  > **Preparation**: After this attack, stun the attacking character.
- **Image Asset**: `assets/card-art/bundles/cards/50079.jpg` (710×1030 px, 346.4 KB)

### Set: A.I.M. Abduction

### [50080] A.I.M. Abductor
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: A.I.M. Abduction (1–2/5, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: A.I.M. Abduction Set Icon (printed bottom-right next to deck number)
- **Traits**: *A.I.M.*
- **Rules Text**:
  > **When Revealed**: Tuck the ally you control with the most remaining hit points under Abduct Superhumans. Otherwise, place 2 threat on Abduct Superhumans. If Abduct Superhumans is not in play, find it and put it into play.
- **Image Asset**: `assets/card-art/bundles/cards/50080.jpg` (710×1030 px, 350.2 KB)
### [50081] Abduct Superhumans
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: A.I.M. Abduction (3/5)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: A.I.M. Abduction Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **Forced Interrupt**: When an ally leaves play, tuck it under here and place threat here equal to its cost. Then, place 1 acceleration token here.
  > **When Defeated**: Put each ally tucked here into play under its owner's control.
- **Image Asset**: `assets/card-art/bundles/cards/50081.png` (1030×710 px, 329.6 KB)
### [50082] Nabbed!
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: A.I.M. Abduction (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: A.I.M. Abduction Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If Abduct Superhumans is not in play, find it and put it into play. Discard cards from the top of your deck until an ally is discarded and tuck it under Abduct Superhumans. Place threat equal to that ally's cost and 1 acceleration token on Abduct Superhumans.
- **Image Asset**: `assets/card-art/bundles/cards/50082.png` (710×1030 px, 359.1 KB)

### Set: A.I.M. Science

### [50083] A.I.M. Scientist
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: A.I.M. Science (1/5)
- **Stats**: **SCH**: 0, **ATK**: 0, **HP**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: A.I.M. Science Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *A.I.M.*
- **Rules Text**:
  > Surge. Vulnerable. *(Discard this character if it is stunned or confused.)*
  > While the engaged player is engaged with another minion, A.I.M. Scientist cannot be attacked.
- **Image Asset**: `assets/card-art/bundles/cards/50083.jpg` (710×1030 px, 340.2 KB)
### [50084] A.I.M. Soldier
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: A.I.M. Science (2–4/5, Qty: 3)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: A.I.M. Science Set Icon (printed bottom-right next to deck number)
- **Traits**: *A.I.M.*
- **Rules Text**:
  > Patrol.
  > **When Revealed**: Find A.I.M. Scientist and put it into play engaged with you. *(If it is already in play, it engages you.)* If A.I.M. Scientist did not enter play this way, place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/50084.png` (710×1030 px, 299.8 KB)
### [50085] Mad Science
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: A.I.M. Science (5/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: A.I.M. Science Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Hinder 2[per_hero].
  > Each [[A.I.M.]] minion gains 1 acceleration icon ([acceleration]).
- **Flavor**: *Derogatorily referred to as "beekeepers," members of Advanced Idea Mechanics are brilliant but ruthless, seeking world domination through technological power.*
- **Image Asset**: `assets/card-art/bundles/cards/50085.jpg` (1030×710 px, 320.7 KB)

### Set: Batroc

### [50086a] Batroc
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (1/21)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 8
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Traits**: *Batroc's Brigade. Mercenary.*
- **Rules Text**:
  > [star] **Forced Response**: After Batroc attacks, place 1 threat on Alert Level.
  > **Forced Interrupt**: When Batroc would be defeated, reset his hit points to 8 instead. Then, remove 6 threat from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/50086a.png` (289×419 px, 244.3 KB)
### [50086b] Batroc
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (1/21)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 2, **ATK**: 2 [star], **HP**: 12
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Traits**: *Batroc's Brigade. Mercenary.*
- **Rules Text**:
  > [star] **Forced Response**: After Batroc attacks, place 1 threat on Alert Level.
  > **Forced Interrupt**: When Batroc would be defeated, reset his hit points to 12 instead. Then, remove 6 threat from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/50086b.png` (289×419 px, 242.5 KB)
### [50087a] Infiltrate A.I.M. Island Embassy
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (2/21)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Batroc (A). *(Batroc (B) instead for expert mode.)* Batroc and Standard encounter sets. Two modular encounter sets *(A.I.M. Science and Batrocs's Brigade)*.
  > **Setup**: Set each Rescued Captive ally aside. Put the Alert Level environment into play, [[Low]] side faceup. In expert mode, place 2[per_hero] threat on Alert Level.
- **Image Asset**: `assets/card-art/bundles/cards/50087a.png` (419×289 px, 238.9 KB)
### [50087b] Infiltrate A.I.M. Island Embassy
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (2/21)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 6 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When the last threat is removed from this scheme, advance to stage 2A *(the players win by advancing)*.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *You sneak into the A.I.M. island embassy in search of the abducted S.H.I.E.L.D. specialist Sarah Garza. There you come face to face with the mercenary known as Batroc the Leaper.*
- **Image Asset**: `assets/card-art/bundles/cards/50087b.png` (419×289 px, 256.0 KB)
### [50088a] Locate Missing Person
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (3/21)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Flavor**: *Now that you've penetrated the embassy, you need to locate Garza. You discover several holding cells in the embassy's basement. Hopefully one of them holds the kidnapped tech.*
- **Image Asset**: `assets/card-art/bundles/cards/50088a.png` (419×289 px, 223.4 KB)
### [50088b] Locate Missing Person
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (3/21)
- **Properties**: Stage 2B
- **Stats**: **Base Threat**: 3 per hero, **Target Threat**: 10 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When the last threat is removed from this scheme, put 1 set-aside Rescued Captive ally into play exhausted under any player's control. The players may advance to stage 3A. If they do not advance, place 3[per_hero] threat here. *(The players win by advancing, but will need at least 1 Rescued Captive to survive.)*
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/50088b.png` (419×289 px, 251.6 KB)
### [50089a] Extract Captives
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (4/21)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: If the Alert Level is on its [[High]] side, deal each player 1 facedown encounter card. Otherwise, remove all threat from Alert Level and flip it to its [[High]] side. In either case, in expert mode, place 2[per_hero] threat on Alert Level.
- **Flavor**: *You didn't find Garza, but you did find several other civilian prisoners. You must get them out safely.*
- **Image Asset**: `assets/card-art/bundles/cards/50089a.png` (419×289 px, 238.3 KB)
### [50089b] Extract Captives
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (4/21)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 12 per hero, **Target Threat**: 18 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > In expert mode, each minion gains quickstrike.
  > **Forced Interrupt**: When an enemy attacks, it attacks a Rescued Captive instead.
  > **If there is no threat here, the players win the game.**
  > **If this stage is completed or there are no Rescued Captive allies in play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/50089b.png` (419×289 px, 249.1 KB)
### [50090a] Alert Level
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (5/21)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Traits**: *Low.*
- **Rules Text**:
  > If there is at least 4[per_hero] threat here, remove all threat from here and flip this card.
  > **Forced Response**: After a character is defeated except by consequential damage, place 1 threat here.
  > **Hero Action**: Spend 1 resource of any type → remove 1 threat from here.
- **Image Asset**: `assets/card-art/bundles/cards/50090a.png` (289×419 px, 227.8 KB)
### [50090b] Alert Level
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (5/21)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Traits**: *High.*
- **Rules Text**:
  > Batroc gets +1 SCH and +1 ATK.
  > **If there is at least 4[per_hero] threat here, the players lose the game.**
  > **Forced Response**: After a character is defeated except by consequential damage, place 1 threat here.
  > **Hero Action**: Spend 1 resource of any type → remove 1 threat from here.
- **Image Asset**: `assets/card-art/bundles/cards/50090b.png` (289×419 px, 235.9 KB)
### [50091] Rescued Captive
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (6–9/21, Qty: 4)
- **Stats**: **THW**: 1 (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Traits**: *Civilian.*
- **Rules Text**:
  > Victory -1.
  > Does not count against your ally limit. Card abilities cannot remove this ally from play.
  > **Hero Action**: Exhaust Rescued Captive → remove 1[per_hero] threat from the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/50091.jpg` (710×1030 px, 370.8 KB)
### [50092] Heightened Reflexes
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (10/21)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to Batroc.
  > Uses (4 leap counters).
  > **Forced Interrupt**: When Batroc would take any amount of damage, prevent 2 of that damage and remove 1 leap counter from here.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to Batroc.
- **Image Asset**: `assets/card-art/bundles/cards/50092.jpg` (710×1030 px, 304.1 KB)
### [50093] Embassy Guard
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (11–12/21, Qty: 2)
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Traits**: *A.I.M.*
- **Rules Text**:
  > Guard. Vulnerable. *(Discard this character if it is stunned or confused.)*
  > If Alert Level is on its [[High]] side, this card gains surge.
  > **When Defeated**: Place 1 threat on Alert Level.
- **Image Asset**: `assets/card-art/bundles/cards/50093.png` (710×1030 px, 343.9 KB)
### [50094] Embassy Patrol
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (12–13/21, Qty: 2)
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Traits**: *A.I.M.*
- **Rules Text**:
  > Patrol. Vulnerable. *(Discard this character if it is stunned or confused.)*
  > If Alert Level is on its [[High]] side, this card gains incite 1.
  > **When Defeated**: Place 1 threat on Alert Level.
- **Image Asset**: `assets/card-art/bundles/cards/50094.jpg` (710×1030 px, 331.4 KB)
### [50095] Commandeer Security Office
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (15/21)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: If Alert Level is on its [[High]] side, place 1 acceleration token here.
  > **When Defeated**: Remove 1[per_hero] threat from Alert Level.
- **Image Asset**: `assets/card-art/bundles/cards/50095.png` (1030×710 px, 331.5 KB)
### [50096] Leaping Kick
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (16–17/21, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Batroc schemes.
  > **When Revealed (Hero)**: Batroc attacks the ally with the most remaining hit points. This attack gains overkill. If there were no allies in play, Batroc attacks you.
- **Image Asset**: `assets/card-art/bundles/cards/50096.png` (710×1030 px, 354.0 KB)
### [50097] Security Cameras
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc (18–21/21, Qty: 4)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Batroc Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Remove 1 threat from Alert Level. This card gains surge.
  > **When Revealed (Hero)**: For each character you control, choose to either exhaust that character or place 1 threat on Alert Level (2 threat instead if Alert Level is on its [[High]] side).
- **Image Asset**: `assets/card-art/bundles/cards/50097.jpg` (710×1030 px, 354.3 KB)

### Set: Batroc's Brigade

### [50098] Machete
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc's Brigade (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Batroc's Brigade Set Icon (printed bottom-right next to deck number)
- **Traits**: *Batroc's Brigade. Mercenary.*
- **Rules Text**:
  > Surge. Vulnerable.
  > [star] Machete's attacks gain piercing.
  > **When Defeated**: Shuffle Machete into the encounter deck.
- **Flavor**: *With each Machete's demise, the title passes to another member of the Lopez family.*
- **Image Asset**: `assets/card-art/bundles/cards/50098.jpg` (710×1030 px, 277.1 KB)
### [50099] Rapido
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc's Brigade (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 3 [star], **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Batroc's Brigade Set Icon (printed bottom-right next to deck number)
- **Traits**: *Batroc's Brigade. Mercenary.*
- **Rules Text**:
  > [star] Rapido's attacks gain ranged and deal indirect damage.
  > **When Revealed**: Deal 1 damage to each character you control.
  >
  > ---
  >
  > [star] **Boost**: Deal 1 damage to each character you control.
- **Image Asset**: `assets/card-art/bundles/cards/50099.png` (710×1030 px, 349.0 KB)
### [50100] Zaran
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc's Brigade (3/5)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Batroc's Brigade Set Icon (printed bottom-right next to deck number)
- **Traits**: *Batroc's Brigade. Mercenary.*
- **Rules Text**:
  > [star] Zaran gets +X ATK, where X is the printed resource cost of the card tucked under him.
  > **When Revealed**: Tuck a [[Weapon]] upgrade you control under Zaran. Otherwise, tuck the top card of your deck under Zaran.
- **Image Asset**: `assets/card-art/bundles/cards/50100.jpg` (710×1030 px, 374.0 KB)
### [50101] Batroc's Brigade
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc's Brigade (4/5)
- **Stats**: **Base Threat**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Batroc's Brigade Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each minion gains toughness.
  > **When Revealed**: Give each enemy a tough status card.
  > **Hero Interrupt**: When you reveal a non-[[Elite]] minion, spend 3 resources of any type → cancel the effects of that minion and discard it.
- **Flavor**: *"Money won't buy loyalty, but it helps" —Batroc*
- **Image Asset**: `assets/card-art/bundles/cards/50101.png` (1030×710 px, 323.4 KB)
### [50102] Soldiers of Fortune
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Batroc's Brigade (5/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Batroc's Brigade Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Spend 3 resources of any type.
  > • Find a [[Mercenary]] minion and reveal it. If no minion entered play this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Choose: Either spend 1 resource of any type, or this card gains [boost][boost][boost].
- **Image Asset**: `assets/card-art/bundles/cards/50102.png` (710×1030 px, 352.8 KB)

### Set: M.O.D.O.K

### [50103a] M.O.D.O.K.
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (1/27)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2, **ATK**: 1, **HP**: 10
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Cyborg. Psionic.*
- **Rules Text**:
  > Retaliate 1.
  > **Forced Interrupt**: When M.O.D.O.K. would be defeated, if a Holding Cell is in play, remove 2 lock counters from it and reset M.O.D.O.K.'s hit points to 10 instead. Otherwise, **the players win the game**.
- **Image Asset**: `assets/card-art/bundles/cards/50103a.png` (289×419 px, 253.6 KB)
### [50103b] M.O.D.O.K.
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (1/27)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 3, **ATK**: 1, **HP**: 14
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Cyborg. Psionic.*
- **Rules Text**:
  > Retaliate 2. Steady.
  > **Forced Interrupt**: When M.O.D.O.K. would be defeated, if a Holding Cell is in play, remove 2 lock counters from it and reset M.O.D.O.K.'s hit points to 14 instead. Otherwise, **the players win the game**.
- **Image Asset**: `assets/card-art/bundles/cards/50103b.png` (289×419 px, 254.4 KB)
### [50104a] Upgrading Adaptoids
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (2/27)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: M.O.D.O.K. (A). *(M.O.D.O.K. (B) instead for expert mode.)* M.O.D.O.K. and Standard encounter sets. One modular encounter set *(Scientist Supreme)*.
  > **Setup**: Create the Holding Cell deck *(see rulebook p. 13)*. Put 1 random [[Adaptoid]] environment into play (2 environments instead in expert mode) and set the others aside. Each player searches the encounter deck for a copy of Adaptoid and reveals it.
- **Image Asset**: `assets/card-art/bundles/cards/50104a.png` (419×289 px, 246.6 KB)
### [50104b] Upgrading Adaptoids
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (2/27)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 7 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Forced Interrupt**: When this stage would be completed, put 1 random set-aside [[Adaptoid]] environment into play instead. Then, **if there are no set-aside [[Adaptoid]] environments, the players lose the game**. Otherwise, remove all threat from here and shuffle each Adaptoid minion from the encounter discard pile into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/50104b.png` (419×289 px, 253.3 KB)
### [50105a] Holding Cell
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (3/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Enters play with 2[per_hero] lock counters on it.
  > **Forced Interrupt**: When the last lock counter is removed from here, flip this card and put Flying Inhuman into play under any player's control.
  > **Hero Action**: Spend [energy] [energy] resources or 3 resources of any type → remove 1 lock counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/50105a.png` (289×419 px, 236.6 KB)
### [50105b] Flying Inhuman
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (3/27)
- **Stats**: **THW**: 2 [star] (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 5, **Resources**: [energy]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Inhuman. Rescued.*
- **Rules Text**:
  > Does not count against your ally limit.
  > [star] **Response**: After this ally thwarts, remove 1 threat from another scheme.
  > **Forced Response**: After this card leaves play, flip it and place it on the bottom of the Holding Cell deck.
- **Image Asset**: `assets/card-art/bundles/cards/50105b.png` (289×419 px, 244.5 KB)
### [50106a] Holding Cell
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (4/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Enters play with 2[per_hero] lock counters on it.
  > **Forced Interrupt**: When the last lock counter is removed from here, flip this card and put Psionic Inhuman into play under any player's control.
  > **Hero Action**: Spend [mental] [mental] resources or 3 resources of any type → remove 1 lock counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/50106a.png` (289×419 px, 242.8 KB)
### [50106b] Psionic Inhuman
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (4/27)
- **Stats**: **THW**: 1 [star] (Consequential: 1), **ATK**: 1 (Consequential: 1), **HP**: 5, **Resources**: [mental]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Inhuman. Psionic. Rescued.*
- **Rules Text**:
  > Does not count against your ally limit.
  > [star] **Response**: After this ally thwarts, remove 1 lock counter from a Holding Cell.
  > **Forced Response**: After this card leaves play, flip it and place it on the bottom of the Holding Cell deck.
- **Image Asset**: `assets/card-art/bundles/cards/50106b.png` (289×419 px, 237.9 KB)
### [50107a] Holding Cell
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (5/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Enters play with 2[per_hero] lock counters on it.
  > **Forced Interrupt**: When the last lock counter is removed from here, flip this card and put Sarah Garza into play under any player's control.
  > **Hero Action**: Spend a [wild] resource or 3 resources of any type → remove 1 lock counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/50107a.png` (289×419 px, 243.5 KB)
### [50107b] Sarah Garza
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (5/27)
- **Properties**: Unique
- **Stats**: **THW**: 2 (Consequential: 1), **ATK**: 2 [star] (Consequential: 1), **HP**: 5, **Resources**: [wild]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Inhuman. Rescued. S.H.I.E.L.D.*
- **Rules Text**:
  > Does not count against your ally limit.
  > [star] Sarah Garza's attacks gain overkill and ranged.
  > **Forced Response**: After this card leaves play, flip it and place it on the bottom of the Holding Cell deck.
- **Image Asset**: `assets/card-art/bundles/cards/50107b.png` (289×419 px, 241.2 KB)
### [50108a] Holding Cell
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (6/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Enters play with 2[per_hero] lock counters on it.
  > **Forced Interrupt**: When the last lock counter is removed from here, flip this card and put Strong Inhuman into play under any player's control.
  > **Hero Action**: Spend [physical] [physical] resources or 3 resources of any type → remove 1 lock counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/50108a.png` (289×419 px, 239.0 KB)
### [50108b] Strong Inhuman
- **Type**: `Ally`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (6/27)
- **Stats**: **THW**: 1 (Consequential: 1), **ATK**: 3 (Consequential: 1), **HP**: 7, **Resources**: [physical]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Inhuman. Rescued.*
- **Rules Text**:
  > Toughness.
  > Does not count against your ally limit.
  > **Forced Interrupt**: After this card leaves play, flip it and place it on the bottom of the Holding Cell deck.
- **Image Asset**: `assets/card-art/bundles/cards/50108b.png` (289×419 px, 233.5 KB)
### [50109] Flying Upgrade
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (7/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Adaptoid.*
- **Rules Text**:
  > Each Adaptoid gets +1 SCH, gains incite 1, and gains the [[Aerial]] trait.
- **Flavor**: *"They fly now?"
"They fly now."
—Maria Hill and Nick Fury*
- **Image Asset**: `assets/card-art/bundles/cards/50109.jpg` (710×1030 px, 284.4 KB)
### [50110] Psionic Upgrade
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (8/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Adaptoid.*
- **Rules Text**:
  > Each Adaptoid gains villainous and the [[Psionic]] trait.
- **Flavor**: *"Remember your psionic defense training!" —Maria Hill*
- **Image Asset**: `assets/card-art/bundles/cards/50110.png` (710×1030 px, 329.1 KB)
### [50111] Sarah Garza Upgrade
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (9/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Adaptoid.*
- **Rules Text**:
  > Each Adaptoid gains the [[Elite]] trait.
  > Each Adaptoid gets +1 ATK and its attacks gain overkill and ranged.
- **Flavor**: *"Well, that's just great. These things can control my powers better than I can!" —Sarah Garza*
- **Image Asset**: `assets/card-art/bundles/cards/50111.jpg` (710×1030 px, 346.6 KB)
### [50112] Strong Upgrade
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (10/27)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Adaptoid.*
- **Rules Text**:
  > Each Adaptoid gets +1 ATK, gains toughness, and gains the [[Brute]] trait.
- **Flavor**: *"I don't think we'd like her when she's angry!" —Quake*
- **Image Asset**: `assets/card-art/bundles/cards/50112.jpg` (710×1030 px, 355.5 KB)
### [50113] Adaptoid
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (11–14/27, Qty: 4)
- **Stats**: **SCH**: 1 [star], **ATK**: 1 [star], **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Adaptoid.*
- **Rules Text**:
  > [star] *(Check [[Adaptoid]] environments for modifiers to these values.)*
  > **When Defeated**: Remove 1 all-purpose counter from an environment.
  >
  > ---
  >
  > [star] **Boost**: After this activation, shuffle Adaptoid into the encounter deck.
- **Image Asset**: `assets/card-art/bundles/cards/50113.png` (710×1030 px, 293.4 KB)
### [50114] Automated Mobile Unit
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (15/27)
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to M.O.D.O.K.
  > M.O.D.O.K. gets +5 hit points.
  > **Forced Response**: After M.O.D.O.K.'s hit points are reset, discard this card.
- **Flavor**: *"I will crush you like a bug!" —M.O.D.O.K.*
- **Image Asset**: `assets/card-art/bundles/cards/50114.jpg` (710×1030 px, 353.1 KB)
### [50115] Focusing Crystal
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (16/27)
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > Attach to M.O.D.O.K.
  > **Forced Response**: After M.O.D.O.K.'s hit points are reset, discard this card.
- **Flavor**: *M.O.D.O.K. channels his psionic powers through the crystal on his giant forehead.*
- **Image Asset**: `assets/card-art/bundles/cards/50115.png` (710×1030 px, 356.0 KB)
### [50116] Nanobots
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (17/27)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech.*
- **Rules Text**:
  > Attach to M.O.D.O.K.
  > [star] **Forced Response**: After M.O.D.O.K. activates, heal 1 damage from him.
  > **Forced Response**: After M.O.D.O.K.'s hit points are reset, discard this card.
- **Flavor**: *Microscopic machines keep the Doomsday Chair in working order.*
- **Image Asset**: `assets/card-art/bundles/cards/50116.png` (710×1030 px, 368.6 KB)
### [50117] Psionic Force Field
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (18/27)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to M.O.D.O.K.
  > Attached enemy gains stalwart.
  > **Forced Interrupt**: When attached enemy would take any amount of damage, place it here instead. Then, if there is at least 5 damage here, discard this card.
  >
  > ---
  >
  > [star] **Boost**: Attach this card to the activating enemy.
- **Image Asset**: `assets/card-art/bundles/cards/50117.jpg` (710×1030 px, 384.9 KB)
### [50118] Psionic Machetes
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (19/27)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to M.O.D.O.K.
  > [star] M.O.D.O.K.'s attacks gain piercing.
  > **Forced Response**: After M.O.D.O.K.'s hit points are reset, discard this card.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains piercing.
- **Image Asset**: `assets/card-art/bundles/cards/50118.jpg` (710×1030 px, 351.8 KB)
### [50119] Reverse Engineering
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (20/27)
- **Stats**: **SCH**: -1 [star], **ATK**: -1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to M.O.D.O.K.
  > [star] X is equal to the printed cost of the card tucked here.
  > **When Revealed**: Tuck an upgrade you control under here. Otherwise, tuck the top card of your deck under here.
  > **Forced Response**: After M.O.D.O.K.'s hit points are reset, discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/50119.png` (710×1030 px, 372.1 KB)
### [50120] A.I.M. Jailer
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (21–22/27, Qty: 2)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Traits**: *A.I.M.*
- **Rules Text**:
  > Guard.
  > **When Revealed**: A.I.M. Jailer attacks the [[Rescued]] ally with the fewest remaining hit points. Otherwise, place 1 lock counter on a Holding Cell.
- **Image Asset**: `assets/card-art/bundles/cards/50120.png` (710×1030 px, 346.6 KB)
### [50121] Hostage Situation
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (23/27)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > M.O.D.O.K. cannot take damage.
  > **When Revealed**: Attach 1 [[Rescued]] ally faceup here. Attached ally is under no player's control. *(Attached ally is still in play.)*
  > **When Defeated**: The defeating player takes control of attached ally.
- **Image Asset**: `assets/card-art/bundles/cards/50121.jpg` (1030×710 px, 374.4 KB)
### [50122] Psionic Enhancement
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (24/27)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > Hinder 1[per_hero].
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy an additional boost card.
- **Image Asset**: `assets/card-art/bundles/cards/50122.jpg` (1030×710 px, 341.9 KB)
### [50123] "It's Alive!"
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (25/27)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player searches the encounter deck and discard pile for an [[Adaptoid]] minion and reveals it. *(Shuffle.)* Deal each player who did not engage a minion this way a facedown encounter card.
- **Image Asset**: `assets/card-art/bundles/cards/50123.png` (710×1030 px, 388.7 KB)
### [50124] Psionic Blast
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: M.O.D.O.K (26–27/27, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: M.O.D.O.K Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: You are confused. M.O.D.O.K. schemes.
  > **When Revealed (Hero)**: Take X indirect damage, where X is M.O.D.O.K.'s SCH. Confuse each character that takes damage this way.
- **Image Asset**: `assets/card-art/bundles/cards/50124.jpg` (710×1030 px, 360.2 KB)

### Set: Scientist Supreme

### [50125] Scientist Supreme
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Scientist Supreme (1/5)
- **Properties**: Unique
- **Stats**: **SCH**: 2, **ATK**: 1 [star], **HP**: 6
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scientist Supreme Set Icon (printed bottom-right next to deck number)
- **Traits**: *A.I.M. Genius.*
- **Rules Text**:
  > Victory -1. Villainous. Vulnerable. *(Discard this character if it is stunned or confused.)*
  > [star] Scientist Supreme's attacks gain piercing and ranged.
- **Flavor**: *Equipped with a high-tech suit, the Scientist Supreme wields great power, both physical and political.*
- **Image Asset**: `assets/card-art/bundles/cards/50125.png` (710×1030 px, 356.1 KB)
### [50126] Monica Rappaccini
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Scientist Supreme (2/5)
- **Properties**: Unique
- **Stats**: **SCH**: 3, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scientist Supreme Set Icon (printed bottom-right next to deck number)
- **Traits**: *A.I.M. Genius.*
- **Rules Text**:
  > Victory -1. Villainous. Vulnerable. *(Discard this character if it is stunned or confused.)*
  > While Scientist Supreme is in the victory display, Monica Rappaccini gains villainous.
- **Flavor**: *As second-in-command of A.I.M., Monica has her sights set on the title of Scientist Supreme.*
- **Image Asset**: `assets/card-art/bundles/cards/50126.png` (710×1030 px, 340.1 KB)
### [50127] Diplomatic Immunity
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Scientist Supreme (3/5)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Scientist Supreme Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Place 1 acceleration token here for each [[A.I.M.]] minion in the victory display.
- **Flavor**: *Attacking the leader of a sovereign nation is politically fraught. You will have to handle the Scientist Supreme delicately.*
- **Image Asset**: `assets/card-art/bundles/cards/50127.jpg` (1030×710 px, 320.9 KB)
### [50128] Diplomatic Sanctions
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Scientist Supreme (4–5/5, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Scientist Supreme Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Discard 1 card from your hand for each [[A.I.M.]] minion in the victory display.
  >
  > ---
  >
  > [star] **Boost**: This card gains [boost] for each [[A.I.M.]] minion in the victory display.
- **Image Asset**: `assets/card-art/bundles/cards/50128.jpg` (710×1030 px, 348.2 KB)

### Set: Thunderbolts

### [50129a] Citizen V
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (1/14)
- **Properties**: Unique, Stage A
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 12 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > Citizen V cannot be defeated unless there are at least 1[per_hero] [[Thunderbolt]] minions in the victory display.
  > [star] **Forced Interrupt**: When Citizen V would activate against you during step two of the villain phase, if you are engaged with a [[Thunderbolt]] minion, Citizen V does not activate and heals 4 damage instead.
- **Image Asset**: `assets/card-art/bundles/cards/50129a.png` (289×419 px, 235.6 KB)
### [50129b] Citizen V
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (1/14)
- **Properties**: Unique, Stage B
- **Stats**: **SCH**: 3 [star], **ATK**: 2 [star], **HP**: 16 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > Citizen V cannot be defeated unless there are at least 1[per_hero] [[Thunderbolt]] minions in the victory display.
  > [star] **Forced Interrupt**: When Citizen V would activate against you during step two of the villain phase, if you are engaged with a [[Thunderbolt]] minion, Citizen V does not activate and heals 6 damage instead.
- **Image Asset**: `assets/card-art/bundles/cards/50129b.png` (289×419 px, 230.3 KB)
### [50130a] Apprehending Rogue Agents
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (2/14)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Citizen V (A). *(Citizen V (B) instead for expert mode.)* Thunderbolts and Standard encounter sets.
  > **Setup**: Choose 1 modular set, plus 1[per_hero] additional modular sets, each with an [[Elite]], [[Thunderbolt]] minion. Set each of those minions aside and shuffle the rest of their encounter sets into the encounter deck. Reveal the Justice, Like Lightning environment.
- **Image Asset**: `assets/card-art/bundles/cards/50130a.png` (419×289 px, 238.7 KB)
### [50130b] Apprehending Rogue Agents
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (2/14)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 1 per hero, **Target Threat**: 11 per hero, **Escalation Threat**: +1 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Each [[Thunderbolt]] minion gains guard.
  > **Forced Response**: After a player attacks a [[Thunderbolt]] minion, that minion engages that player.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *"We can do this the easy way, or the fun way." —Citizen V*
- **Image Asset**: `assets/card-art/bundles/cards/50130b.png` (419×289 px, 234.9 KB)
### [50131a] Justice, Like Lightning
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (3/14)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Each player reveals a random set-aside [[Thunderbolt]] minion. Reveal and attach the remaining set-aside [[Thunderbolt]] minion faceup here. In expert mode, give each of these minions a tough status card. Flip this card.
- **Flavor**: *"Justice, like lightning, ever should appear;
To few men ruin, but to all men fear." —Thomas Randolph*
- **Image Asset**: `assets/card-art/bundles/cards/50131a.png` (289×419 px, 239.9 KB)
### [50131b] Thunderbolt Backup
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (3/14)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > *(The minion attached here is in play and can be targeted by attacks and abilities.)*
  > **Forced Interrupt**: When the round ends, attach the [[Thunderbolt]] minion with the most damage here, swapping it with the minion already attached here, if any. Heal 1[per_hero] damage from attached minion. In expert mode, heal 1[per_hero] additional damage from that minion and give it a tough status card.
- **Image Asset**: `assets/card-art/bundles/cards/50131b.png` (289×419 px, 242.8 KB)
### [50132] Citizen V's Sword
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (4/14)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > **When Revealed**: Attach to Citizen V. He activates against you.
  > **Hero Response**: After you attack and damage Citizen V, spend [physical] [physical] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/50132.png` (710×1030 px, 294.9 KB)
### [50133] Jolt
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (5/14)
- **Properties**: Unique
- **Stats**: **SCH**: 0, **ATK**: 1, **HP**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > Villainous.
  > **When Defeated**: Place 3 threat on the main scheme.
  > **Hero Action**: Exhaust your hero → place 1 parley counter on Jolt. If there are 3 or more parley counters here, remove Jolt from the game. *(She is not defeated.)*
- **Image Asset**: `assets/card-art/bundles/cards/50133.jpg` (710×1030 px, 342.0 KB)
### [50134] Innocent Bystanders
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (6–8/14, Qty: 3)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Uses (4 bystander counters).
  > **Forced Response**: After you attack an enemy or an enemy attacks you, either spend 1 resource of any type or place 1 threat on the main scheme (2 threat instead in expert mode). Remove 1 bystander counter from here.
- **Image Asset**: `assets/card-art/bundles/cards/50134.png` (710×1030 px, 364.1 KB)
### [50135] The Coming Storm
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (9/14)
- **Stats**: **Base Threat**: 2 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > **When Revealed**: Each player engages each minion engaged with the player clockwise from them.
- **Flavor**: *"Thunderbolts, let's bring these vigilantes to justice!" —Songbird*
- **Image Asset**: `assets/card-art/bundles/cards/50135.jpg` (1030×710 px, 321.6 KB)
### [50136] Rumbling Thunder
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (10/14)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **When Revealed**: Each player engages each minion engaged with the player clockwise from them.
- **Image Asset**: `assets/card-art/bundles/cards/50136.jpg` (1030×710 px, 282.5 KB)
### [50137] Down but Not Out
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (11–12/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose a random [[Thunderbolt]] minion from the victory display and reveal it. Place damage on that minion until it has 5 hit points remaining. Then, remove this card from the game. If no minion entered play this way, this card gains surge.
- **Image Asset**: `assets/card-art/bundles/cards/50137.png` (710×1030 px, 304.0 KB)
### [50138] Tap In
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Thunderbolts (13–14/14, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Thunderbolts Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Engage the [[Thunderbolt]] minion with the least damage that is not engaged with you. That minion activates against you. If no minion activated this way, Citizen V activates against you.
- **Flavor**: *"Don't worry, Batroc. I got this." —Moonstone*
- **Image Asset**: `assets/card-art/bundles/cards/50138.png` (710×1030 px, 347.7 KB)

### Set: Gravitational Pull

### [50139] Moonstone
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Gravitational Pull (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 2 [star], **HP**: 16
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gravitational Pull Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Elite. Thunderbolt.*
- **Rules Text**:
  > Villainous. Victory 1.
  > [star] **Forced Response**: After Moonstone activates, give her a tough status card.
- **Flavor**: *"Catch!"*
- **Image Asset**: `assets/card-art/bundles/cards/50139.jpg` (710×1030 px, 325.9 KB)
### [50140] Rule the Skies
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Gravitational Pull (2/6)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Gravitational Pull Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Each [[Aerial]] character gets +1 ATK.
  >
  > ---
  >
  > [star] **Boost**: If the activating enemy has the [[Aerial]] trait, give it an additional boost card.
- **Image Asset**: `assets/card-art/bundles/cards/50140.png` (1030×710 px, 338.3 KB)
### [50141] Gravitational Pull
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Gravitational Pull (3–4/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Gravitational Pull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find Moonstone and reveal her. *(If she is already in play, she engages you.)* Moonstone activates against you. If no enemy activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Exhaust a character you control.
- **Image Asset**: `assets/card-art/bundles/cards/50141.jpg` (710×1030 px, 336.7 KB)
### [50142] Psychological Manipulation
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Gravitational Pull (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Gravitational Pull Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Discard an ally or support you control. Otherwise, this card gains surge.
  > **When Revealed (Hero)**: Deal X damage to the friendly character with the fewest remaining hit points, where X is equal to your hero's ATK.
- **Image Asset**: `assets/card-art/bundles/cards/50142.jpg` (710×1030 px, 370.6 KB)

### Set: Hard Sound

### [50143] Songbird
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Hard Sound (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 0 [star], **ATK**: 0 [star], **HP**: 16
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hard Sound Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Elite. Thunderbolt.*
- **Rules Text**:
  > Villainous. Victory 1.
  > [star] **Forced Interrupt**: When Songbird activates, give her 1 additional boost card for this activation.
- **Flavor**: *"Time to face the music!"*
- **Image Asset**: `assets/card-art/bundles/cards/50143.png` (710×1030 px, 334.9 KB)
### [50144] Solid Sound Constructs
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Hard Sound (2/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hard Sound Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Songbird. Otherwise, attach to the villain.
  > Attached enemy loses stalwart.
  > **Forced Interrupt**: When attached enemy would gain a confused or stunned status card, discard this card instead.
- **Image Asset**: `assets/card-art/bundles/cards/50144.jpg` (710×1030 px, 333.9 KB)
### [50145] Hard Sound Bindings
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Hard Sound (3/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hard Sound Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Attach to your identity.
  > **Forced Interrupt**: When you would attack, discard Hard Sound Bindings instead. Then, you are stunned.
  >
  > ---
  >
  > [star] **Boost**: You are stunned. If you were already stunned, give the activating enemy an additional boost card.
- **Image Asset**: `assets/card-art/bundles/cards/50145.png` (710×1030 px, 362.5 KB)
### [50146] Sonic Bubble
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Hard Sound (4/6)
- **Stats**: **Base Threat**: 3 per hero
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Hard Sound Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **Forced Interrupt**: When any amount of damage would be dealt to an enemy, remove an equal amount of threat from here instead.
- **Flavor**: *"Can't touch this!" —Songbird*
- **Image Asset**: `assets/card-art/bundles/cards/50146.png` (1030×710 px, 345.6 KB)
### [50147] Hard Sound
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Hard Sound (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Hard Sound Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find Songbird and reveal her. *(If she is already in play, she engages you.)* Songbird activates against you. If no enemy activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Give the activating enemy an additional boost card.
- **Image Asset**: `assets/card-art/bundles/cards/50147.jpg` (710×1030 px, 278.2 KB)

### Set: Pale Little Spider

### [50148] Black Widow
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pale Little Spider (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 2 [star], **ATK**: 1, **HP**: 14
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Pale Little Spider Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Thunderbolt.*
- **Rules Text**:
  > Retaliate 1. Villainous. Victory 1.
  > [star] **Forced Response**: After Black Widow schemes against you, search the encounter deck and discard pile for a copy of Handspring and attach it to her. *(Shuffle.)* Otherwise, you are confused.
- **Image Asset**: `assets/card-art/bundles/cards/50148.jpg` (710×1030 px, 348.2 KB)
### [50149] Handspring
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pale Little Spider (2–3/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Pale Little Spider Set Icon (printed bottom-right next to deck number)
- **Traits**: *Preparation.*
- **Rules Text**:
  > Attach to Black Widow. Otherwise, attach to the villain.
  > **Forced Interrupt**: When attached enemy would take damage from an attack, deal that damage to the attacking character instead. Discard this card.
- **Flavor**: *"This has been fun." —Black Widow*
- **Image Asset**: `assets/card-art/bundles/cards/50149.png` (710×1030 px, 337.2 KB)
### [50150] Pride of the Red Room
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pale Little Spider (4/6)
- **Stats**: **Base Threat**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Pale Little Spider Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Amplify (`[amplify]`: Adds +1 boost pip to boost cards drawn during activation)
- **Rules Text**:
  > **When Revealed**: Place 1 additional threat here for each [[Preparation]] card in play.
- **Flavor**: *After dominating her cohort in the Red Room, Yelena Belova set out to prove herself the greatest Black Widow.*
- **Image Asset**: `assets/card-art/bundles/cards/50150.jpg` (1030×710 px, 352.6 KB)
### [50151] Pale Little Spider
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Pale Little Spider (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Pale Little Spider Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find Black Widow and reveal her. *(If she is already in play, she engages you.)* Black Widow activates against you. If no enemy activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: You are confused. If you were already confused, place 1 threat on the main scheme.
- **Image Asset**: `assets/card-art/bundles/cards/50151.png` (710×1030 px, 353.7 KB)

### Set: Power of the Atom

### [50152] Radioactive Man
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Power of the Atom (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1 [star], **ATK**: 2 [star], **HP**: 18
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Power of the Atom Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Thunderbolt.*
- **Rules Text**:
  > Villainous. Victory 1.
  > [star] **Forced Response**: After Radioactive Man activates against you, deal 1 damage to each character you control.
- **Flavor**: *"Up and at them!"*
- **Image Asset**: `assets/card-art/bundles/cards/50152.png` (710×1030 px, 320.6 KB)
### [50153] Radiation Exposure
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Power of the Atom (2–3/6, Qty: 2)
- **Stats**: **SCH**: -1, **ATK**: -1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Power of the Atom Set Icon (printed bottom-right next to deck number)
- **Traits**: *Condition.*
- **Rules Text**:
  > Attach to your identity.
  > [star] If attached identity has the [[Gamma]] trait, this attachment gives +1 ATK instead.
  > **Forced Response**: After you recover, discard 1 card from your hand → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/50153.jpg` (710×1030 px, 357.9 KB)
### [50154] Runaway Nuclear Reaction
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Power of the Atom (4/6)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Power of the Atom Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Crisis (`[crisis]`: Prevents threat removal from Main Scheme)
- **Rules Text**:
  > **Forced Response**: After Radioactive Man is dealt any amount of damage, place an equal amount of threat here. Then, if there is 10 or more threat here, deal 10 damage to each character and discard Runaway Nuclear Reaction.
- **Image Asset**: `assets/card-art/bundles/cards/50154.png` (1030×710 px, 353.1 KB)
### [50155] Power of the Atom
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Power of the Atom (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Power of the Atom Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find Radioactive Man and reveal him. *(If he is already in play, he engages you.)* Radioactive Man activates against you. If no enemy activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Take 2 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/50155.jpg` (710×1030 px, 352.2 KB)

### Set: Supersonic

### [50156] MACH-IV
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Supersonic (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2 [star], **HP**: 16
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Supersonic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Aerial. Elite. Thunderbolt.*
- **Rules Text**:
  > Villainous. Victory 1.
  > [star] Each character without the [[Aerial]] trait cannot make basic defenses against MACH-IV's attacks.
- **Flavor**: *"I've got all the weaponry of a fighter jet—and then some."*
- **Image Asset**: `assets/card-art/bundles/cards/50156.jpg` (710×1030 px, 325.9 KB)
### [50157] Blasters
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Supersonic (2/6)
- **Stats**: **ATK**: 1 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Supersonic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to MACH-IV. Otherwise, attach to the enemy with the highest ATK.
  > [star] Attached enemy's attacks gain overkill and ranged.
  > **Hero Response**: After you attack and damage attached enemy, spend [energy] [energy] resources → discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/50157.png` (710×1030 px, 343.2 KB)
### [50158] Heat-Seeking Missiles
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Supersonic (3/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Supersonic Set Icon (printed bottom-right next to deck number)
- **Traits**: *Tech. Weapon.*
- **Rules Text**:
  > Attach to MACH-IV. Otherwise, attach to the villain.
  > Uses (4 missile counters).
  > [star] **Forced Response**: After attached enemy attacks you, remove 1 missile counter from here and take 2 indirect damage.
- **Image Asset**: `assets/card-art/bundles/cards/50158.png` (710×1030 px, 357.8 KB)
### [50159] Aerial Dogfight
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Supersonic (4/6)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Supersonic Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Rules Text**:
  > Hinder 2[per_hero].
  > Reduce the damage each [[Aerial]] character takes from each attack by 2 unless the attacker or attack has the [[Aerial]] trait, or the attack has ranged.
- **Image Asset**: `assets/card-art/bundles/cards/50159.jpg` (1030×710 px, 344.3 KB)
### [50160] Supersonic
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Supersonic (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: Supersonic Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find MACH-IV and reveal him. *(If he is already in play, he engages you.)* MACH-IV activates against you. If no enemy activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: If this activation is an attack, it gains overkill and ranged.
- **Image Asset**: `assets/card-art/bundles/cards/50160.jpg` (710×1030 px, 327.4 KB)

### Set: The Leaper

### [50161] Batroc
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: The Leaper (1/6)
- **Properties**: Unique
- **Stats**: **SCH**: 1, **ATK**: 2, **HP**: 16
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 4 icons (Adds +4 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Leaper Set Icon (printed bottom-right next to deck number)
- **Traits**: *Elite. Thunderbolt.*
- **Rules Text**:
  > Villainous. Victory 1.
  > **Forced Interrupt**: When Batroc engages you, discard 1 card from your hand.
- **Flavor**: *"On se revoit. En garde!"*
- **Image Asset**: `assets/card-art/bundles/cards/50161.png` (710×1030 px, 338.2 KB)
### [50162] Coup de Foudre
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: The Leaper (2/6)
- **Stats**: **Base Threat**: 5
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: The Leaper Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Rules Text**:
  > **Forced Interrupt**: When a minion engages a player, that player discards the top X cards of their deck, where X is the number of boost icons ([boost]) on that minion. Place 1 threat here for each printed [energy] resource discarded this way.
- **Image Asset**: `assets/card-art/bundles/cards/50162.png` (1030×710 px, 366.6 KB)
### [50163] Batroc the Leaper
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: The Leaper (3–4/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: The Leaper Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Find Batroc and reveal him. *(If he is already in play, he engages you.)* Batroc activates against you. If no enemy activated this way, this card gains surge.
  >
  > ---
  >
  > [star] **Boost**: Discard 1 card from your hand.
- **Image Asset**: `assets/card-art/bundles/cards/50163.jpg` (710×1030 px, 353.7 KB)
### [50164] Parcours du Combattant
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: The Leaper (5–6/6, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: The Leaper Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Surge.
  > **When Revealed**: Each player engages each minion engaged with the player clockwise from them.
  >
  > ---
  >
  > [star] **Boost**: After this attack resolves, engage a minion in play that is not engaged with you.
- **Image Asset**: `assets/card-art/bundles/cards/50164.png` (710×1030 px, 313.2 KB)

### Set: Baron Zemo

### [50165a] Baron Zemo
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (1/17)
- **Properties**: Unique, Stage A1
- **Stats**: **SCH**: 3, **ATK**: 2, **HP**: 12
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > **Forced Interrupt**: When Baron Zemo would be defeated, reset his hit points to 12 instead. Remove 3 secret counters from among [[Board Member]] environments.
- **Flavor**: *"Arrest them by order of the Executive Board!"*
- **Image Asset**: `assets/card-art/bundles/cards/50165a.png` (289×419 px, 247.6 KB)
### [50165b] Baron Zemo
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (1/17)
- **Properties**: Unique, Stage A2
- **Stats**: **SCH**: 3 [star], **ATK**: 2 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt. Unmasked.*
- **Rules Text**:
  > [star] **Forced Interrupt**: When Baron Zemo activates against you, either place 1 secret counter on a [[Board Member]] card or give Baron Zemo an additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/50165b.png` (289×419 px, 245.6 KB)
### [50166a] Baron Zemo
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (2/17)
- **Properties**: Unique, Stage B1
- **Stats**: **SCH**: 4, **ATK**: 2, **HP**: 16
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt.*
- **Rules Text**:
  > **Forced Interrupt**: When Baron Zemo would be defeated, reset his hit points to 16 instead. Remove 3 secret counters from among [[Board Member]] environments.
- **Flavor**: *"Arrest them by order of the Executive Board!"*
- **Image Asset**: `assets/card-art/bundles/cards/50166a.png` (289×419 px, 247.7 KB)
### [50166b] Baron Zemo
- **Type**: `Villain`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (2/17)
- **Properties**: Unique, Stage B2
- **Stats**: **SCH**: 4 [star], **ATK**: 2 [star], **HP**: 18 per hero
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Thunderbolt. Unmasked.*
- **Rules Text**:
  > Steady.
  > [star] **Forced Interrupt**: When Baron Zemo activates against you, either place 2 secret counters on a [[Board Member]] card or give Baron Zemo an additional boost card for this activation.
- **Image Asset**: `assets/card-art/bundles/cards/50166b.png` (289×419 px, 247.2 KB)
### [50167a] Zemo's Manipulations
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (3/17)
- **Properties**: Stage 1A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Contents**: Baron Zemo (A1). *(Baron Zemo (B1) instead for expert mode.)* Baron Zemo, S.H.I.E.L.D. Executive Board, Executive Board Evidence, and Standard encounter sets. Two modular encounter sets *(Scientist Supreme and S.H.I.E.L.D.)*.
  > **Setup**: Prepare the evidence *(see rulebook p. 18)*. Put each [[Board Member]] environment into play. If not playing campaign mode, place 2 secret counters on each [[Board Member]] environment.
- **Image Asset**: `assets/card-art/bundles/cards/50167a.png` (419×289 px, 240.5 KB)
### [50167b] Zemo's Manipulations
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (3/17)
- **Properties**: Stage 1B
- **Stats**: **Base Threat**: 2 per hero, **Target Threat**: 12 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Response**: After the player phase ends, the first player may place 2 secret counters on a [[Board Member]] environment that has no secret counters on it to gain 2 cards from the S.H.I.E.L.D. envelope (1 card instead in campaign mode). The players may advance to stage 2A to make their accusation.
  > **If this stage is completed, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/50167b.png` (419×289 px, 252.5 KB)
### [50168a] The Accusation
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (4/17)
- **Properties**: Stage 2A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Make an accusation by guessing a means, a motive, and an opportunity, along with the board member associated with that combination in the campaign log. This board member is the accused. *(See "The Accusation" on p. 19 of the rulebook.)*
- **Flavor**: *You've gathered all the evidence you can. All that remains is to make your accusation.*
- **Image Asset**: `assets/card-art/bundles/cards/50168a.png` (419×289 px, 233.5 KB)
### [50168b] The Accusation
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (4/17)
- **Properties**: Stage 2B
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Do the following:
  > 1. Use the cards in the A.I.M. envelope to identify the mole.
  > 2. For each guess you got wrong, place 1 secret counter on each [[Board Member]] card.
  > 3. If you accused the wrong board member, place 3 secret counters on the accused.
  > 4. Advance to stage 3A.
- **Image Asset**: `assets/card-art/bundles/cards/50168b.png` (419×289 px, 238.8 KB)
### [50169a] Fighting Zemo
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (5/17)
- **Properties**: Stage 3A
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Flip Baron Zemo to his [[Unmasked]] side and reset his hit points to his printed hit point value. Find Baron Zemo's Sword and attach it to him.
- **Flavor**: *You unmask Zemo's deception and expose his associate's identity.*
- **Image Asset**: `assets/card-art/bundles/cards/50169a.png` (419×289 px, 224.0 KB)
### [50169b] Fighting Zemo
- **Type**: `Main Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (5/17)
- **Properties**: Stage 3B
- **Stats**: **Base Threat**: 0, **Target Threat**: 12 per hero, **Escalation Threat**: +2 per hero/round
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Flip the mole to its attachment side and attach it to Baron Zemo. Place 1[per_hero] threat here for each secret counter on each [[Board Member]] attachment.
  > **If this stage is completed, the players lose the game.**
- **Flavor**: *Bring Baron Zemo and his accomplice to justice!*
- **Image Asset**: `assets/card-art/bundles/cards/50169b.png` (419×289 px, 240.5 KB)
### [50170] Baron Zemo's Sword
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (6/17)
- **Properties**: Unique
- **Stats**: **ATK**: 2 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Traits**: *Weapon.*
- **Rules Text**:
  > Attach to Baron Zemo.
  > [star] **Forced Response**: After Baron Zemo attacks and defeats a character, place 1 secret counter on the [[Board Member]] environment with the fewest secret counters.
  > **Hero Action**: Spend [physical] [physical] [physical] or [energy] [energy] [energy] resources → remove 1 secret counter from a [[Board Member]] environment and discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/50170.png` (710×1030 px, 391.8 KB)
### [50171] Reluctant Foe
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (7/17)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Treat attached hero as an [[Elite]] minion with SCH equal to its printed THW. Replace its printed text box with: "Villainous. **When Defeated**: Remove this hero and Reluctant Foe from the game."
  > **When Revealed**: Search your collection for a hero whose title does not match a character in play and put it into play engaged with you. Attach this card to it.
- **Image Asset**: `assets/card-art/bundles/cards/50171.jpg` (710×1030 px, 365.7 KB)
### [50172] S.H.I.E.L.D. Agent
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (8–9/17, Qty: 2)
- **Stats**: **SCH**: 2 [star], **ATK**: 1 [star], **HP**: 3 [star]
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Quickstrike. Vulnerable.
  > [star] **Forced Interrupt**: When S.H.I.E.L.D. Agent activates or is defeated, add 1 secret counter to the [[Board Member]] environment with the fewest secret counters.
- **Image Asset**: `assets/card-art/bundles/cards/50172.jpg` (710×1030 px, 347.0 KB)
### [50173] Divided Loyalties
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (10/17)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1[per_hero].
  > As an additional cost for a player to attack, thwart, or defend with an ally, that player must spend 1 resource of any type.
  > **When Defeated**: Remove 1[per_hero] secret counters from among [[Board Member]] environments.
- **Image Asset**: `assets/card-art/bundles/cards/50173.png` (1030×710 px, 359.0 KB)
### [50174] Undermine Support
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (11/17)
- **Stats**: **Base Threat**: 3
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Hinder 1[per_hero].
  > As an additional cost for a player to ready a support, that player must spend 1 resource of any type.
  > **When Defeated**: Remove 1[per_hero] secret counters from among [[Board Member]] environments.
- **Flavor**: *"S.H.I.E.L.D. takes orders from me now!" —Baron Zemo*
- **Image Asset**: `assets/card-art/bundles/cards/50174.jpg` (1030×710 px, 343.7 KB)
### [50175] Battle of Wits
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (12–13/17, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Baron Zemo schemes. If this activation would place any threat on the main scheme, you may spend X [mental] resources to prevent X of that threat and remove X secret counters from among [[Board Member]] environments.
- **Image Asset**: `assets/card-art/bundles/cards/50175.png` (710×1030 px, 332.8 KB)
### [50176] Might Makes Right
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (14–15/17, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed (Alter-Ego)**: Place 2 secret counters on the [[Board Member]] environment with the fewest secret counters.
  > **When Revealed (Hero)**: Baron Zemo attacks you. If no character takes damage from this attack, remove 3 secret counters from among [[Board Member]] environments.
- **Image Asset**: `assets/card-art/bundles/cards/50176.png` (710×1030 px, 351.4 KB)
### [50177] The Ends Justify the Means
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Baron Zemo (16–17/17, Qty: 2)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: Baron Zemo Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **When Revealed**: Choose:
  > • Baron Zemo defeats the minion with the fewest remaining hit points. Baron Zemo schemes.
  > • Discard an ally or support you control → remove secret counters from among [[Board Member]] environments equal to the discarded card's printed resource cost.
- **Image Asset**: `assets/card-art/bundles/cards/50177.jpg` (710×1030 px, 359.9 KB)

### Set: S.H.I.E.L.D.

### [50178] S.H.I.E.L.D. Trooper
- **Type**: `Minion`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. (1–3/5, Qty: 3)
- **Stats**: **SCH**: 0, **ATK**: 2, **HP**: 4
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Set Icon (printed bottom-right next to deck number)
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Patrol. Vulnerable.
  > **When Defeated**: The engaged player discards 1 [[S.H.I.E.L.D.]] ally or support they control. Otherwise, place 2 threat on the main scheme.
- **Flavor**: *"Just come peacefully and no one gets hurt."*
- **Image Asset**: `assets/card-art/bundles/cards/50178.jpg` (710×1030 px, 350.7 KB)
### [50179] Arrest Warrant
- **Type**: `Obligation`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. (4/5)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 2 icons (Adds +2 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Acceleration (`[acceleration]`: Places +1 additional threat on Main Scheme each round)
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > **Alter-Ego Action**: Exhaust your identity or 1 [[S.H.I.E.L.D.]] card you control → search the encounter deck and discard pile for a [[S.H.I.E.L.D.]] minion and reveal it. *(Shuffle.)* Discard this card.
- **Image Asset**: `assets/card-art/bundles/cards/50179.png` (710×1030 px, 268.3 KB)
### [50180] Disavowed
- **Type**: `Side Scheme`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. (5/5)
- **Stats**: **Base Threat**: 2
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 3 icons (Adds +3 to Villain ATK/SCH during activation)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Set Icon (printed bottom-right next to deck number)
  - **Scheme Icons**: Hazard (`[hazard]`: Deals +1 additional encounter card during Villain Phase)
- **Traits**: *S.H.I.E.L.D.*
- **Rules Text**:
  > Increase the resource cost to play each [[S.H.I.E.L.D.]] card by 1.
  > **When Revealed**: Place 1 threat here for each [[S.H.I.E.L.D.]] card in play.
- **Flavor**: *The S.H.I.E.L.D. Executive Board has disavowed all knowledge of your activities and cut off your resources.*
- **Image Asset**: `assets/card-art/bundles/cards/50180.png` (1030×710 px, 327.9 KB)

### Set: S.H.I.E.L.D. Executive Board

### [50181a] Chief Medical Officer
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. Executive Board (1/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: S.H.I.E.L.D. Executive Board Set Icon (printed bottom-right next to deck number)
- **Traits**: *Board Member.*
- **Rules Text**:
  > Setup.
  > If there are 4 or more secret counters here (3 or more instead in expert mode), flip this card.
  > **Hero Action**: Spend [energy] [energy] resources → remove 1 secret counter from here. Then, heal 1 damage from a friendly character.
- **Image Asset**: `assets/card-art/bundles/cards/50181a.png` (289×419 px, 207.4 KB)
### [50181b] Medical Officer's Aid
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. Executive Board (1/6)
- **Properties**: Permanent
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Executive Board Set Icon (printed bottom-right next to deck number)
- **Traits**: *Board Member.*
- **Rules Text**:
  > Attach to the villain. Permanent.
  > **Forced Response**: After a secret counter is placed here, either heal 2 damage from the villain or deal 1 damage to the friendly character with the fewest remaining hit points.
  > **If there are 3 [[Board Member]] attachments in play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/50181b.png` (289×419 px, 218.0 KB)
### [50182a] Chief Surveillance Officer
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. Executive Board (2/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: S.H.I.E.L.D. Executive Board Set Icon (printed bottom-right next to deck number)
- **Traits**: *Board Member.*
- **Rules Text**:
  > Setup.
  > If there are 4 or more secret counters here (3 or more instead in expert mode), flip this card.
  > **Hero Action**: Spend [mental] [mental] resources → remove 1 secret counter from here. Then, remove 2 threat from a scheme.
- **Image Asset**: `assets/card-art/bundles/cards/50182a.png` (289×419 px, 197.8 KB)
### [50182b] Surveillance Officer's Aid
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. Executive Board (2/6)
- **Properties**: Permanent
- **Stats**: **SCH**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Executive Board Set Icon (printed bottom-right next to deck number)
- **Traits**: *Board Member.*
- **Rules Text**:
  > Attach to the villain. Permanent.
  > **Forced Response**: After a secret counter is placed here, place 2 threat on the main scheme.
  > **If there are 3 [[Board Member]] attachments in play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/50182b.png` (289×419 px, 204.0 KB)
### [50183a] Chief Tactical Officer
- **Type**: `Environment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. Executive Board (3/6)
- **Bottom-Right Encounter Logos**:
  - **Encounter Set Emblem**: S.H.I.E.L.D. Executive Board Set Icon (printed bottom-right next to deck number)
- **Traits**: *Board Member.*
- **Rules Text**:
  > Setup.
  > If there are 4 or more secret counters here (3 or more instead in expert mode), flip this card.
  > **Hero Action**: Spend [physical] [physical] resources → remove 1 secret counter from here. Then, deal 2 damage to an enemy.
- **Image Asset**: `assets/card-art/bundles/cards/50183a.png` (289×419 px, 198.3 KB)
### [50183b] Tactical Officer's Aid
- **Type**: `Attachment`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. Executive Board (3/6)
- **Properties**: Permanent
- **Stats**: **ATK**: 1
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Executive Board Set Icon (printed bottom-right next to deck number)
- **Traits**: *Board Member.*
- **Rules Text**:
  > Attach to the villain. Permanent.
  > **Forced Response**: After a secret counter is placed here, deal 2 damage to a friendly character.
  > **If there are 3 [[Board Member]] attachments in play, the players lose the game.**
- **Image Asset**: `assets/card-art/bundles/cards/50183b.png` (289×419 px, 204.3 KB)
### [50184a] A.I.M. Interference ([energy])
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. Executive Board (4/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Executive Board Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1.
  > **When Revealed**: Place 1 secret counter on each [[Board Member]] card. You may spend X [energy] resources to prevent X of these counters from being placed.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/50184a.png` (289×419 px, 243.2 KB)
### [50184b] A.I.M. Interference ([mental])
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. Executive Board (5/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Executive Board Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1.
  > **When Revealed**: Place 1 secret counter on each [[Board Member]] card. You may spend X [mental] resources to prevent X of these counters from being placed.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/50184b.png` (289×419 px, 244.2 KB)
### [50184c] A.I.M. Interference ([physical])
- **Type**: `Treachery`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: S.H.I.E.L.D. Executive Board (6/6)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: 1 icon (Adds +1 to Villain ATK/SCH during activation)
  - **Boost Star**: Yes (`[star]` icon triggers special Boost Ability)
  - **Encounter Set Emblem**: S.H.I.E.L.D. Executive Board Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > Incite 1.
  > **When Revealed**: Place 1 secret counter on each [[Board Member]] card. You may spend X [physical] resources to prevent X of these counters from being placed.
  >
  > ---
  >
  > [star] **Boost**: Resolve this card's "**When Revealed**" ability.
- **Image Asset**: `assets/card-art/bundles/cards/50184c.png` (289×419 px, 243.8 KB)

### Set: Executive Board Evidence

### [50185] Medical Records
- **Type**: `Evidence - Means`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Executive Board Evidence (1/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Executive Board Evidence Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: Each player may add 1 secret counter to a [[Board Member]] environment to search their collection for a different Protection ally and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for a Protection ally and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50185.png` (710×1030 px, 356.4 KB)
### [50186] Wiretap
- **Type**: `Evidence - Means`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Executive Board Evidence (2/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Executive Board Evidence Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: Each player may add 1 secret counter to a [[Board Member]] environment to search their collection for a different Justice ally and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for a Justice ally and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50186.png` (710×1030 px, 349.8 KB)
### [50187] Security Scanner
- **Type**: `Evidence - Means`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Executive Board Evidence (3/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Executive Board Evidence Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: Each player may add 1 secret counter to a [[Board Member]] environment to search their collection for a different Aggression ally and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for an Aggression ally and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50187.jpg` (710×1030 px, 353.0 KB)
### [50188] Money
- **Type**: `Evidence - Motive`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Executive Board Evidence (4/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Executive Board Evidence Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: Each player may add 1 secret counter to a [[Board Member]] environment to search their collection for a different Protection upgrade and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for a Protection upgrade and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50188.jpg` (710×1030 px, 354.9 KB)
### [50189] Blackmail
- **Type**: `Evidence - Motive`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Executive Board Evidence (5/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Executive Board Evidence Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: Each player may add 1 secret counter to a [[Board Member]] environment to search their collection for a different Justice upgrade and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for a Justice upgrade and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50189.png` (710×1030 px, 333.9 KB)
### [50190] Ideology
- **Type**: `Evidence - Motive`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Executive Board Evidence (6/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Executive Board Evidence Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: Each player may add 1 secret counter to a [[Board Member]] environment to search their collection for a different Aggression upgrade and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for an Aggression upgrade and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50190.jpg` (710×1030 px, 347.7 KB)
### [50191] Security Clearance
- **Type**: `Evidence - Opportunity`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Executive Board Evidence (7/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Executive Board Evidence Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: Each player may add 1 secret counter to a [[Board Member]] environment to search their collection for a different Protection support and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for a Protection support and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50191.png` (710×1030 px, 356.0 KB)
### [50192] Travel
- **Type**: `Evidence - Opportunity`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Executive Board Evidence (8/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Executive Board Evidence Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: Each player may add 1 secret counter to a [[Board Member]] environment to search their collection for a different Justice support and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for a Justice support and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50192.png` (710×1030 px, 349.0 KB)
### [50193] Authority
- **Type**: `Evidence - Opportunity`
- **Faction / Aspect**: Encounter
- **Pack**: Agents of S.H.I.E.L.D. (`aos`)
- **Deck / Set**: Executive Board Evidence (9/9)
- **Bottom-Right Encounter Logos**:
  - **Boost Icons**: None (0)
  - **Encounter Set Emblem**: Executive Board Evidence Set Icon (printed bottom-right next to deck number)
- **Rules Text**:
  > **Setup**: Each player may add 1 secret counter to a [[Board Member]] environment to search their collection for a different Aggresion support and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for an Aggresion support and add it to their hand. *(Shuffle.)*
- **Image Asset**: `assets/card-art/bundles/cards/50193.jpg` (710×1030 px, 353.8 KB)

