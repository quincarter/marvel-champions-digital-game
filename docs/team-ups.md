# Team-Ups

Every Team-Up pair in the card data, the card that names it, and whether its pictures are in. A Team-Up card can be
played only while both named characters are in play, as an identity or an ally, under any player (RRG 1.8 "Team-Up",
p. 43), and is legal only in a deck whose identity is one of the two.

The client shows a pair's pictures when the pair is in play (added in wave 6, PR #94): the full picture once when the
team-up first happens, and the closeup in a ring on the board while it stays active; clicking the ring lists the
pair's Team-Up cards. Both come from `art/teamups/<pair>/`:

| File           | Shape                  | Shown                                    |
| -------------- | ---------------------- | ---------------------------------------- |
| `splash.<ext>` | tall, the full picture | Once, when the pair first comes together |
| `badge.<ext>`  | roughly square closeup | In the ring while the pair is in play    |

`<pair>` is the two names, each lowercased with anything but letters and digits turned into a hyphen, then sorted and
joined by a hyphen (`gambit-rogue`). A pair with no pictures shows
nothing. The list below is generated from the `teamUp` keyword in `packages/content/src/data/*/cards.ts`:

```bash
grep -rn 'name: "teamUp"' packages/content/src/data/*/cards.ts
```

## Playable now

| Pair                          | Card (ids)                          | Packs                | Folder                      | Pictures |
| ----------------------------- | ----------------------------------- | -------------------- | --------------------------- | -------- |
| Ant-Man and Wasp              | Swarm Tactics (12020, 13020)        | `ant`, `wsp`         | `ant-man-wasp`              | in       |
| Quicksilver and Scarlet Witch | Order and Chaos (14018, 15018)      | `qsv`, `scw`         | `quicksilver-scarlet-witch` | in       |
| Groot and Rocket Raccoon      | Flora and Fauna (16020, 16048)      | `gmw`                | `groot-rocket-raccoon`      | in       |
| Gamora and Nebula             | Daughters of Thanos (22022)         | `nebu`               | `gamora-nebula`             | in       |
| Iron Man and War Machine      | Two Against the World (23024)       | `warm`               | `iron-man-war-machine`      | in       |
| Gwen Stacy and Miles Morales  | Young Love (27019, 27050)           | `sm`                 | `gwen-stacy-miles-morales`  | wanted   |
| Colossus and Shadowcat        | Shadow and Steel (32021, 32050)     | `mut_gen`            | `colossus-shadowcat`        | wanted   |
| Cyclops and Phoenix           | Psychic Rapport (33023, 34023)      | `cyclops`, `phoenix` | `cyclops-phoenix`           | wanted   |
| Phoenix and Storm             | Soul Sisters (34035)                | `phoenix`            | `phoenix-storm`             | wanted   |
| Colossus and Wolverine        | Fastball Special (35023)            | `wolv`               | `colossus-wolverine`        | wanted   |
| Gambit and Rogue              | Beauty and the Thief (37019, 38020) | `gambit`, `rogue`    | `gambit-rogue`              | in       |

## In later packs (card data only)

Each of these goes on the "Content to add" list of the wave PR that makes its pack playable; the wave definition of
done (`wave-definition-of-done.md` §5) has the box.

| Pair                                 | Card (ids)                          | Pack                | Cycle | Folder                                       |
| ------------------------------------ | ----------------------------------- | ------------------- | ----- | -------------------------------------------- |
| Angel and Psylocke                   | Soaring Hearts (41020, 42021)       | `psylocke`, `angel` | 7     | `angel-psylocke`                             |
| Cable and Deadpool                   | Frenemies (44031)                   | `deadpool`          | 7     | `cable-deadpool`                             |
| Jubilee and Wolverine                | Unlikely Duo (47022)                | `jubilee`           | 8     | `jubilee-wolverine`                          |
| Black Panther (T'Challa) and (Shuri) | Heart of the Panther (51025)        | `bp`                | 9     | `black-panther-shuri-black-panther-t-challa` |
| Cindy Moon and Peter Parker          | Investigative Journalism (52024)    | `silk`              | 9     | `cindy-moon-peter-parker`                    |
| Captain America and Winter Soldier   | Super-Soldiers (54022)              | `winter`            | 9     | `captain-america-winter-soldier`             |
| Black Widow and Winter Soldier       | Winter, Widow, Soldier, Spy (54023) | `winter`            | 9     | `black-widow-winter-soldier`                 |

Jubilee and Wolverine needs only the `jubilee` pack; Wolverine is playable already. Captain America and Black Widow
are playable too, so both Winter Soldier pairs wait only on `winter`.
