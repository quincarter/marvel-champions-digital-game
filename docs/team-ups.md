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

| Pair                          | Card (ids)                          | Packs                   | Folder                      | Pictures |
| ----------------------------- | ----------------------------------- | ----------------------- | --------------------------- | -------- |
| Ant-Man and Wasp              | Swarm Tactics (12020, 13020)        | `ant`, `wsp`            | `ant-man-wasp`              | in       |
| Quicksilver and Scarlet Witch | Order and Chaos (14018, 15018)      | `qsv`, `scw`            | `quicksilver-scarlet-witch` | in       |
| Groot and Rocket Raccoon      | Flora and Fauna (16020, 16048)      | `gmw`                   | `groot-rocket-raccoon`      | in       |
| Gamora and Nebula             | Daughters of Thanos (22022)         | `nebu`                  | `gamora-nebula`             | in       |
| Iron Man and War Machine      | Two Against the World (23024)       | `warm`                  | `iron-man-war-machine`      | in       |
| Gwen Stacy and Miles Morales  | Young Love (27019, 27050)           | `sm`                    | `gwen-stacy-miles-morales`  | in       |
| Colossus and Shadowcat        | Shadow and Steel (32021, 32050)     | `mut_gen`               | `colossus-shadowcat`        | in       |
| Cyclops and Phoenix           | Psychic Rapport (33023, 34023)      | `cyclops`, `phoenix`    | `cyclops-phoenix`           | in       |
| Phoenix and Storm             | Soul Sisters (34035)                | `phoenix`               | `phoenix-storm`             | in       |
| Colossus and Wolverine        | Fastball Special (35023)            | `wolv`                  | `colossus-wolverine`        | in       |
| Gambit and Rogue              | Beauty and the Thief (37019, 38020) | `gambit`, `rogue`       | `gambit-rogue`              | in       |
| Angel and Psylocke            | Soaring Hearts (41020, 42021)       | `psylocke`, `angel`     | `angel-psylocke`            | in       |
| Cable and Deadpool            | Frenemies (40026, 44031)            | `next_evol`, `deadpool` | `cable-deadpool`            | in       |
| Jubilee and Wolverine         | Unlikely Duo (47022)                | `jubilee`               | `jubilee-wolverine`         | in       |

A pair needs no registration of its own: the engine and the client read the `teamUp` keyword from the card data, so a
pair is playable as soon as its card is scripted and its packs are in the playable pool
(`packages/cards/src/playable/index.ts`). Wave 7 (cycle 7) made Angel and Psylocke and Cable and Deadpool playable, and
wave 8 (cycle 8) made Jubilee and Wolverine playable.

## In later packs (card data only)

Each of these goes on the "Content to add" list of the wave PR that makes its pack playable; the wave definition of
done (`wave-definition-of-done.md` §5) has the box. All five cards were read on their scans (2026-10-10): the printed
Team-Up line names both characters exactly as the `teamUp` keyword's `names` carry them.

| Pair                                           | Card (ids)                          | Pack     | Cycle | Folder the client looks for                  | Pictures                                                                                                           |
| ---------------------------------------------- | ----------------------------------- | -------- | ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Black Panther/T'Challa and Black Panther/Shuri | Heart of the Panther (51025)        | `bp`     | 9     | `black-panther-shuri-black-panther-t-challa` | pending: `_pending/black-panther-shuri-tchalla/splash.webp` (splash only; the folder name does not match the slug) |
| Cindy Moon and Peter Parker                    | Investigative Journalism (52024)    | `silk`   | 9     | `cindy-moon-peter-parker`                    | pending: `_pending/silk-spider-man/splash.webp` (splash only; the folder name does not match the slug)             |
| Captain America and Winter Soldier             | Super-Soldiers (54022)              | `winter` | 9     | `captain-america-winter-soldier`             | pending: `_pending/captain-america-winter-soldier/` holds the splash and the badge (owner, 2026-10-10)             |
| Black Widow and Winter Soldier                 | Winter, Widow, Soldier, Spy (54023) | `winter` | 9     | `black-widow-winter-soldier`                 | pending: `_pending/black-widow-winter-soldier/{splash,badge}.webp` (folder name matches)                           |
| Maria Hill and Nick Fury                       | Super Spies (50024)                 | `aos`    | 9     | `maria-hill-nick-fury`                       | pending: `_pending/maria-hill-nick-fury/` holds the splash and the badge (owner, 2026-10-10)                       |

A pending folder is never read (a leading `_` marks a holding area). When a pair's pictures are moved up they go in the
folder named in the fifth column, which is computed from the `teamUp` names (`teamUpSlug`), so the two pending folders
whose names differ (`black-panther-shuri-tchalla`, `silk-spider-man`) must be renamed on the way up, and a badge made
for each of the three splash-only pairs. Captain America and Black Widow are playable already, so both Winter Soldier
pairs wait only on `winter`.
