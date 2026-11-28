# mc-side-story-page

The side-story reader's chrome as one element that only composes: the shared `mc-reader` frame (`@mc/ui`) holding the shared `mc-top-bar`, `mc-side-story-stage` (the reading area and its page line) and `mc-side-story-actions`. The comic picture itself is drawn in the canvas (its camera pans animate every frame) and shown through the reading area: `readingArea` is the box the scene measures and leaves a hole at.

The scene (`scenes/side-story-reader.ts`) mounts it with `mountElement`, sets `model` (`SideStoryPageModel`), listens for `mc-side-story` and reads the focus stops with `focusStopsOf`.

## Properties

| Name    | Type                 | Meaning                                     |
| ------- | -------------------- | ------------------------------------------- |
| `model` | `SideStoryPageModel` | Everything it shows (words are translated). |

## Events

`mc-side-story` (`SideStoryEventDetail`: `close`, `next`, `back`). Stops: `back`, `next`, `close`.
