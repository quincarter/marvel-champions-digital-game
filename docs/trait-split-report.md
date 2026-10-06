# Trait split report

Cards whose parsed traits change when a dotted acronym (S.H.I.E.L.D., A.I.M.) stops swallowing the trait after it. Generated from raw/marvelcdb/*.json. 61 rows, 11 packs: aos, bkw, cap, core, falcon, ironheart, silk, sm, trors, warm, winter.

The 18 `aos` rows are not emitted yet (no curation registered), so they change nothing today and take effect when that pack is ingested. The other 43 rows (10 packs: bkw, cap, core, falcon, ironheart, silk, sm, trors, warm, winter) were applied to `packages/content/src/data/*/cards.ts`, trait lines only. Rows include linked alter-ego faces.

| Pack      | Code   | Card                          | Old traits                   | New traits                     |
| --------- | ------ | ----------------------------- | ---------------------------- | ------------------------------ |
| aos       | 50001a | Maria Hill                    | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| aos       | 50001b | Maria Hill                    | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| aos       | 50009  | The Iliad                     | S.H.I.E.L.D. VEHICLE         | S.H.I.E.L.D. / VEHICLE         |
| aos       | 50013  | Slingshot: Yo-Yo Rodriguez    | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| aos       | 50017  | The Circe                     | S.H.I.E.L.D. VEHICLE         | S.H.I.E.L.D. / VEHICLE         |
| aos       | 50018  | The Bellerophon               | S.H.I.E.L.D. VEHICLE         | S.H.I.E.L.D. / VEHICLE         |
| aos       | 50019  | The Douglass                  | S.H.I.E.L.D. VEHICLE         | S.H.I.E.L.D. / VEHICLE         |
| aos       | 50020  | The Pericles                  | S.H.I.E.L.D. VEHICLE         | S.H.I.E.L.D. / VEHICLE         |
| aos       | 50022  | Grant Ward                    | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| aos       | 50023  | Melinda May                   | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| aos       | 50034a | Nick Fury                     | S.H.I.E.L.D. SOLDIER / SPY   | S.H.I.E.L.D. / SOLDIER / SPY   |
| aos       | 50034b | Nick Fury                     | S.H.I.E.L.D. SOLDIER / SPY   | S.H.I.E.L.D. / SOLDIER / SPY   |
| aos       | 50047  | Agent Coulson                 | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| aos       | 50049  | Global Logistics              | S.H.I.E.L.D. TACTIC          | S.H.I.E.L.D. / TACTIC          |
| aos       | 50054  | Nick Fury, Sr.                | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| aos       | 50057  | Sky-Destroyer                 | S.H.I.E.L.D. VEHICLE         | S.H.I.E.L.D. / VEHICLE         |
| aos       | 50125  | Scientist Supreme             | A.I.M. GENIUS                | A.I.M. / GENIUS                |
| aos       | 50126  | Monica Rappaccini             | A.I.M. GENIUS                | A.I.M. / GENIUS                |
| bkw       | 08001b | Natasha Romanoff              | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| bkw       | 08011  | Agent Coulson                 | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| bkw       | 08019  | Nick Fury                     | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| cap       | 03001b | Steve Rogers                  | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| cap       | 03020  | Mockingbird: Bobbi Morse      | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| core      | 01010b | Carol Danvers                 | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| core      | 01030  | War Machine: James Rhodes     | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| core      | 01075  | Black Widow: Natasha Romanoff | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| core      | 01083  | Mockingbird: Bobbi Morse      | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| core      | 01084  | Nick Fury                     | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| falcon    | 53035  | Winter Soldier: Bucky Barnes  | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| ironheart | 29022  | Agent 13: Sharon Carter       | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| silk      | 52033  | Spider-Woman: Jessica Drew    | S.H.I.E.L.D. WEB-WARRIOR     | S.H.I.E.L.D. / WEB-WARRIOR     |
| sm        | 27041  | Spider-Woman: Jessica Drew    | S.H.I.E.L.D. WEB-WARRIOR     | S.H.I.E.L.D. / WEB-WARRIOR     |
| sm        | 27042  | Homeland Intervention         | S.H.I.E.L.D. TACTIC          | S.H.I.E.L.D. / TACTIC          |
| sm        | 27043  | Global Logistics              | S.H.I.E.L.D. TACTIC          | S.H.I.E.L.D. / TACTIC          |
| sm        | 27046  | Agent 13: Sharon Carter       | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| sm        | 27055  | Sky-Destroyer                 | S.H.I.E.L.D. VEHICLE         | S.H.I.E.L.D. / VEHICLE         |
| sm        | 27182a | Compact Darts                 | S.H.I.E.L.D. TECH            | S.H.I.E.L.D. / TECH            |
| sm        | 27182b | Compact Darts                 | ENHANCED / S.H.I.E.L.D. TECH | ENHANCED / S.H.I.E.L.D. / TECH |
| sm        | 27183a | Impact-Dampening Suit         | S.H.I.E.L.D. TECH            | S.H.I.E.L.D. / TECH            |
| sm        | 27183b | Impact-Dampening Suit         | ENHANCED / S.H.I.E.L.D. TECH | ENHANCED / S.H.I.E.L.D. / TECH |
| sm        | 27184a | Laser Goggles                 | S.H.I.E.L.D. TECH            | S.H.I.E.L.D. / TECH            |
| sm        | 27184b | Laser Goggles                 | ENHANCED / S.H.I.E.L.D. TECH | ENHANCED / S.H.I.E.L.D. / TECH |
| sm        | 27185a | Propulsion Gauntlet           | S.H.I.E.L.D. TECH            | S.H.I.E.L.D. / TECH            |
| sm        | 27185b | Propulsion Gauntlet           | ENHANCED / S.H.I.E.L.D. TECH | ENHANCED / S.H.I.E.L.D. / TECH |
| sm        | 27186a | Retinal Display               | S.H.I.E.L.D. TECH            | S.H.I.E.L.D. / TECH            |
| sm        | 27186b | Retinal Display               | ENHANCED / S.H.I.E.L.D. TECH | ENHANCED / S.H.I.E.L.D. / TECH |
| sm        | 27187a | Shock Knuckles                | S.H.I.E.L.D. TECH            | S.H.I.E.L.D. / TECH            |
| sm        | 27187b | Shock Knuckles                | ENHANCED / S.H.I.E.L.D. TECH | ENHANCED / S.H.I.E.L.D. / TECH |
| sm        | 27188a | Wave Bracers                  | S.H.I.E.L.D. TECH            | S.H.I.E.L.D. / TECH            |
| sm        | 27188b | Wave Bracers                  | ENHANCED / S.H.I.E.L.D. TECH | ENHANCED / S.H.I.E.L.D. / TECH |
| sm        | 27189a | Wrist Navigator               | S.H.I.E.L.D. TECH            | S.H.I.E.L.D. / TECH            |
| sm        | 27189b | Wrist Navigator               | ENHANCED / S.H.I.E.L.D. TECH | ENHANCED / S.H.I.E.L.D. / TECH |
| trors     | 04031b | Jessica Drew                  | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| warm      | 23001b | James Rhodes                  | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| warm      | 23022  | Mockingbird: Bobbi Morse      | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| winter    | 54001a | Winter Soldier                | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| winter    | 54001b | Bucky Barnes                  | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| winter    | 54003  | Black Widow: Natasha Romanoff | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
| winter    | 54012  | Captain America: Steve Rogers | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| winter    | 54021  | Nick Fury, Sr.                | S.H.I.E.L.D. SOLDIER         | S.H.I.E.L.D. / SOLDIER         |
| winter    | 54032  | White Widow: Yelena Belova    | S.H.I.E.L.D. SPY             | S.H.I.E.L.D. / SPY             |
