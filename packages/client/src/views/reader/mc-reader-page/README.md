# mc-reader-page

The Extras reader as one element that only composes: the ink `mc-top-bar`, then the shared `mc-reader` frame (`@mc/ui`) with the contents (`mc-reader-contents`: `mc-search-hits` over the section rows), the open section (`mc-reader-text`: tools row and `mc-article`) and the PREV / NEXT foot (`mc-reader-nav`). A phone shows the contents and the section one at a time.

The scene (`scenes/extras-reader.ts`) mounts it with `mountElement`, sets `model` (`ReaderPageModel`, built by `scenes/extras-reader/page-model.ts`), listens for `mc-reader` and reads the focus stops with `focusStopsOf`.

## Properties

| Name    | Type              | Meaning                                  |
| ------- | ----------------- | ---------------------------------------- |
| `model` | `ReaderPageModel` | Everything it shows (words are translated). |

## Events

`mc-reader` (`ReaderEventDetail`: `back`, `toc`, `contents`, `prev`, `next`, `pdf`, `search`, `search-focus`).

Stops: `back`, `search`, `toc:<index>`, `pdf:<n>`, `contents`, `prev`, `next`.
