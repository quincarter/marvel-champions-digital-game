# GMW Fixes (`gmw-fixes-gg`)

Gideon's Gaming's fixes for The Galaxy's Most Wanted, rebuilt as full English and Spanish cards by Bluefire. It is a
`house-rule` pack (docs/custom-content-packs.md §11.11) with `houseRule.enablesMode: "balanced"`: no cards, no abilities
and no trait changes. See `CREDITS.md` and `PERMISSION.md`.

**In the game.** The rules are the game's own Balanced option (issue #609, `@mc/cards`' `gmw-balanced.ts`), already
scripted and gated on the run's `modes.campaign.balanced`. The pack is what offers it:

- With the pack installed, starting a Galaxy's Most Wanted campaign asks Normal or Rebalance first; without it, the run
  starts as printed (Normal).
- In a Balanced game, the pack's rebuilt faces replace the old edited scans for the cards the Balanced option changes
  (each toggle's cards only with that toggle on). Interception Imminent 1A's "no Kree Supremacy" version is not rebuilt,
  so it keeps its edited scan; Take What Is Mine 2A (text unchanged) shows its rebuilt face in every Balanced game.
- A run signed Balanced before (or after) the pack is removed keeps its flag and plays its Balanced rules; it shows the
  old edited scans when the pack is not installed.

## Source layout

`pack.json`, `CREDITS.md`, `PERMISSION.md` and `fetch-art.sh` are in git. The pictures (`cards/<lang>/<code>.webp`, one
per official face, filed under that face's code: `16073a`, `16107b`) are not: `.gitignore` leaves them out and the
`pack-art-gmw-fixes-gg` bundle carries them. For a local build run `sh fetch-art.sh` (it fetches the curated source
repository at commit `a51e50da556ece0b0fe9a75848320416b8794cef` and copies `gmw_fixes_gg/alt-art/<lang>/` to
`cards/<lang>/`). The source's `overrides.json` (each face's fixed text, EN/ES) is not carried: the game's own Balanced
text (`BALANCED_TEXT`) is what Inspect shows.
