# music/

The game's soundtrack. It is laid out the same way as [`art/`](../art/README.md):
the folder a track sits in says where it plays, so **adding a file to the right
folder is all it should take**. Formats: `mp3`, `ogg`, `m4a`.

> The client does not play music yet. This is the layout the audio code is to
> glob when it lands; until then these folders only hold the files.

| Put it in                 | Named                 | Plays                                                                                                            |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `title/`                  | anything              | Title screen and menus                                                                                           |
| `gameplay/`               | anything              | During a game, whenever nothing more specific below has a track. `default-in-battle.mp3` is the current fallback |
| `scenarios/<scenarioId>/` | `battle.<ext>`        | During a game against that scenario, instead of `gameplay/`                                                      |
| `scenarios/<scenarioId>/` | `villain-wins.<ext>`  | Game Over, when the players lose to it or concede                                                                |
| `scenarios/<scenarioId>/` | `villain-loses.<ext>` | Game Over, when the players beat it                                                                              |
| `campaigns/<campaignId>/` | `battle.<ext>`        | During any game of that campaign whose scenario has no `battle` track of its own                                 |
| `campaigns/<campaignId>/` | `interlude.<ext>`     | Between a campaign's scenarios (campaign log, upgrades)                                                          |
| `packs/<packCode>/`       | `battle.<ext>`        | During any scenario from that pack with no scenario or campaign track                                            |
| `packs/<packCode>/`       | `villain-wins.<ext>`  | Game Over, when the players lose or concede in any scenario of that pack with no `villain-wins` of its own       |
| `packs/<packCode>/`       | `villain-loses.<ext>` | Game Over, when the players win any scenario of that pack with no `villain-loses` of its own                     |
| `outcomes/`               | `defeat.<ext>`        | Game Over for any loss or concession with no track of its own                                                    |
| `outcomes/`               | `victory.<ext>`       | Game Over for any win with no track of its own                                                                   |

**Which track wins during a game**, most specific first:
`scenarios/<scenarioId>/battle` → `campaigns/<campaignId>/battle` →
`packs/<packCode>/battle` → `gameplay/`.

**Which track plays at Game Over**, most specific first:
`scenarios/<scenarioId>/villain-wins` (or `-loses`) → `packs/<packCode>/villain-wins` (or `-loses`) →
`outcomes/defeat` (or `victory`).

`<scenarioId>` is the content package's `Scenario.id` (`rhino`, `klaw`,
`ultron`, `risky-business`, `mutagen-formula`, `breakout`), `<campaignId>` is
`Campaign.id`, and `<packCode>` is `Pack.code` (`core`, `twc`, ...) — the same
ids `art/` uses, so a scenario's art and music folders share a name. A new
scenario needs only a new folder here.

**Several tracks for one slot:** add a suffix — `battle.mp3`, `battle-2.mp3`,
`battle-3.ogg` — and one is picked at random (a playlist for a long game).
Everything in `title/` and `gameplay/` is already treated that way.

The `.gitkeep` files are only there so git keeps the empty folders; leave them
or delete them once a folder has a track in it.

Keep tracks compressed (the two here are about 4 MB each): every track that
ships is carried by the desktop and mobile builds.
