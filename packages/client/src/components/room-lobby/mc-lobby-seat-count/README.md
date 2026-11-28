# mc-lobby-seat-count

The host's "Seats: 3" control of the room lobby: `@mc/ui`'s `mc-stepper` with the count in the middle chip and the model's
"−" and "+" `mc-lobby-button`s slotted into its `prev` and `next` arrow slots (the stepper's slots were added for this).

```ts
<mc-lobby-seat-count .model=${{ label: "Seats: 3", less, more, hint }}></mc-lobby-seat-count>
```

| Property | Type                          | Notes                                                                     |
| -------- | ----------------------------- | ------------------------------------------------------------------------- |
| `model`  | `LobbySeatCountModel \| null` | `less` / `more` are full button models (stop `seats:less` / `seats:more`) |

Events: a press on a button raises `mc-pressed` with its `command` (`{ type: "seat-count", to }`), or `blocked` with its
reason when it is off and has one; the section's `FeatureRelay` turns it into `mc-room-lobby`. Requires `mc-stepper`
(`import "@mc/ui"`).
