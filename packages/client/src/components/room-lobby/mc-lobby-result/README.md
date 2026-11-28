# mc-lobby-result

The start result of the room lobby: what the host's Start said when the game did not start. A boxed headline with a "!" mark,
a line per refused seat, and Dismiss. Used by `mc-lobby-seats` and the Competitive panel.

```ts
html`<mc-lobby-result .model=${{ headline, lines, dismiss }}></mc-lobby-result>`;
```

| Property | Type                            | Notes                                       |
| -------- | ------------------------------- | ------------------------------------------- |
| `model`  | `LobbyStartResultModel \| null` | null draws nothing; words arrive translated |

Events: Dismiss is an `mc-lobby-button`, so it raises `mc-pressed` with the model's `dismiss.command`; the owning section's
`FeatureRelay` turns it into `mc-room-lobby`. The box has `role="alert"`.
