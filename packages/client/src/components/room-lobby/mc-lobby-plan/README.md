# mc-lobby-plan

"The table" of the room lobby: the heading, a facts line ("Expert difficulty · Heroic 2") and the villain and each modular
set as a picture with its name. A picture with a `cardId` is a card picture: the mouse over it raises the card hover and a
hold or right-click raises Inspect (`watchCard`, through `CardWatchController`).

```ts
html`<mc-lobby-plan .model=${{ heading, facts, items, noSets }}></mc-lobby-plan>`;
```

| Property | Type                     | Notes                                                                         |
| -------- | ------------------------ | ----------------------------------------------------------------------------- |
| `model`  | `LobbyPlanModel \| null` | pictures are leased `PictureSource`s the scene resolved; words are translated |

Events: `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect` (composed; the scene's `CardEvents` hears them). It has no
press. Needs `mc-section-heading` and `mc-picture-tile` (`import "@mc/ui"`).
