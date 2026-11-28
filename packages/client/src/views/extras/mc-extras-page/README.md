# mc-extras-page

The whole Extras screen as one element that only composes: `mc-top-bar` (`@mc/ui`), `mc-extras-doors`, `mc-extras-tabs`, then the tab's body: `mc-extras-shelf` (a grid of picture tiles) or, for Music, `mc-extras-player` over `mc-extras-tracks`. The doors sit beside the rail on a wide screen and over it when `stackDoors`.

The scene (`scenes/extras.ts`) mounts it with `mountElement`, sets `model` (`ExtrasPageModel`, built by `scenes/extras/page-model.ts`) and `progress`, listens for `mc-extras`, reads the focus stops with `focusStopsOf` and the card hover events with `CardEvents`.

## Properties

| Name       | Type                           | Meaning                                       |
| ---------- | ------------------------------ | --------------------------------------------- |
| `model`    | `ExtrasPageModel`              | Everything it shows (words are translated).   |
| `progress` | `() => PlayerProgress` or null | The Music player's clock.                     |

## Events

`mc-extras` (`ExtrasEventDetail`: `back`, `door`, `tab`, `tile`, `player`, `volume`, `volume-step`). Stops: `back`, `trophies`, `credits`, `tab:<id>`, the player's `shuffle` / `next` / `pause` / `volume-down` / `volume-up`, `tile:<id>`.
