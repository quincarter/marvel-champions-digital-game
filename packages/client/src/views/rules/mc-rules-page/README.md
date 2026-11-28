# mc-rules-page

The Rules reference as one element that only composes, in the shared `mc-reader` frame (`@mc/ui`, no contents pane): `mc-top-bar` and `mc-rules-scope` (Back, title, scope toggle), `mc-rules-tabs` and, on the Glossary, the `mc-search-field`, then the tab's body: `mc-rules-glossary`, `mc-rules-villain-phase` or `mc-rules-card-list`.

The scene (`scenes/rules.ts`) keeps its press shield, scrim and entrance and exit motion, mounts the page with `mountElement`, sets `model` (`RulesPageModel`, built by `scenes/rules/page-model.ts`), listens for `mc-rules`, reads the focus stops with `focusStopsOf` and the card hover events with `CardEvents`.

## Properties

| Name    | Type             | Meaning                                     |
| ------- | ---------------- | ------------------------------------------- |
| `model` | `RulesPageModel` | Everything it shows (words are translated). |

## Events

`mc-rules` (`RulesEventDetail`: `back`, `scope`, `tab`, `search`, `search-focus`, `card`, `origin`); `mc-image-error` from a scan. Stops: `back`, `scope:*`, `tab:*`, `search`, `row:entry:*`, `row:step:*`, `row:card:*`.
