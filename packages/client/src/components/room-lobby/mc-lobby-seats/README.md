# mc-lobby-seats

The standard room lobby's seats panel, built to `LobbySeatsModel` (`room-lobby.types.ts`). One framed panel with an optional
heading and a native scrolling list that holds, in order: the host's hint, "Set up the table" and the seat-count stepper; the
table plan (or a guest's `note`); the start result; the seat rows (or `noSeats`); the people.

```ts
html`<mc-lobby-seats .model=${model} @mc-room-lobby=${(e) => act(e.detail)}></mc-lobby-seats>`;
```

| Property   | Type                        | Notes                                                                        |
| ---------- | --------------------------- | ---------------------------------------------------------------------------- |
| `model`    | `LobbySeatsModel \| null`   | all words translated; pictures leased `PictureSource`s                       |
| `scroller` | getter, `HTMLElement\|null` | the `list:seats` element (`data-key`): the pad's stick and the kept position |

Events: `mc-room-lobby` (`LobbyEvent`, composed): a section-level `FeatureRelay<LobbyEvent>` turns each inner `mc-lobby-button`
press into it (`setup`, `seat-count`, `dismiss-result`, `seat`, `seat-play`, `seat-give`, `seat-answer`, `seat-deck`,
`mod-store`, `blocked`). Card pictures raise `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect`.

Composed of `mc-lobby-seat-count` (over `@mc/ui`'s `mc-stepper`), `mc-lobby-plan`, `mc-lobby-result`, `mc-lobby-seat-row`
and `mc-lobby-people`, each in its own folder here. Needs the `@mc/ui` entry defined (`mc-stepper`, `mc-picture-tile`,
`mc-section-heading`, `mc-button`).
