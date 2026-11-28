# mc-extras-viewer-page

One hero's or villain's file, or one piece of artwork, as one element that only composes: the shared `mc-top-bar`, the picture (`mc-viewer-slide`) and the file's words (`mc-viewer-text`), side by side on a wide screen and stacked on a narrow one.

The scene (`scenes/extras-viewer.ts`) keeps its press shield, scrim and entrance and exit motion, mounts the page with `mountElement`, sets `model` (`ViewerPageModel`), listens for `mc-viewer` and reads the focus stops with `focusStopsOf`.

## Properties

| Name    | Type              | Meaning                                     |
| ------- | ----------------- | ------------------------------------------- |
| `model` | `ViewerPageModel` | Everything it shows (words are translated). |

## Events

`mc-viewer` (`ViewerEventDetail`: `close`, `step`, `promo`); `mc-image-error` from the picture. Stops: `prev`, `next`, `promo`, `close`.
