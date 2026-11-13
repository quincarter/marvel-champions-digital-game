# Lost Traits (`lost-traits-bf`)

An optional house rule by Bluefire (idea: Borja, Digital Discord server; approved by the server's poll, 2026-11): thirteen
official heroes and alter-egos gain one trait. It is a `house-rule` pack (docs/custom-content-packs.md §11.11): no
cards and no abilities, only data. See `CREDITS.md` and `PERMISSION.md`.

| Card                    | Code     | Added trait    |
| ----------------------- | -------- | -------------- |
| Spider-Man (Peter)      | `01001a` | Web-Warrior    |
| Spider-Woman            | `04031a` | Web-Warrior    |
| Winter Soldier          | `54001a` | Avenger        |
| Adam Warlock            | `21031a` | Aerial         |
| Hulk                    | `10001a` | Defender       |
| She-Hulk                | `01019a` | Defender       |
| Valkyrie                | `25001a` | Defender       |
| Pietro Maximoff (alter) | `14001b` | Mutant         |
| Wanda Maximoff (alter)  | `15001b` | Mutant         |
| Black Widow             | `08001a` | Martial Artist |
| Black Panther           | `01040a` | Martial Artist |
| Gamora                  | `18001a` | Martial Artist |
| Psylocke                | `41001a` | Martial Artist |

**In the game.** Installed, the rule is a toggle in Table setup ("House rules"). With it on, the game embeds the pack
(`SessionConfig.packs`, so a save replays without it installed) and the client adds the traits to those cards' records
before the engine starts; every trait check (a card that needs a Web-Warrior, an Aerial count) sees them as printed. The
rebuilt faces show in place of the official pictures only in that game. It counts as an ordinary game for progression,
like the Balanced campaign option.

**Spanish trait names.** The source's `overrides.json` has them (`traits_es`), but the game's card data has no
translated traits yet; the Spanish faces show them.

## Source layout

`pack.json` (with the `houseRule.traitAdditions` list, from the source's `overrides.json` `added`), `CREDITS.md`,
`PERMISSION.md` and `fetch-art.sh` are in git. The pictures (`cards/<lang>/<code>.webp`, one per official face it
rebuilds, filed under that face's code) are not: `.gitignore` leaves them out and the `pack-art-lost-traits-bf` bundle
carries them. For a local build run `sh fetch-art.sh` (it fetches the curated source repository at commit
`a51e50da556ece0b0fe9a75848320416b8794cef` and copies `lost_traits_bf/alt-art/<lang>/` to `cards/<lang>/`).
