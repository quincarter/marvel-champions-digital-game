# mc-lobby-button-row

One to three `mc-lobby-button`s across a row, equal widths. Used wherever the lobby models a `LobbyButtonRow` (the Epic organizer's
fewer / more tables, a table's paired controls, the Competitive 1v1 / 2v2 choice).

```text
<mc-lobby-button-row .row=${row}></mc-lobby-button-row>
```

| Property | Type             | Notes                          |
| -------- | ---------------- | ------------------------------ |
| `row`    | `LobbyButtonRow` | empty: the element is `hidden` |

Events: none of its own. Each button's `mc-pressed` bubbles up to the section's `FeatureRelay<LobbyEvent>`.

Custom property: `--mc-lobby-row-gap` (8px).
