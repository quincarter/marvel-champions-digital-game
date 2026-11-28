# mc-room-give-dialog

"Give <hero> to...": the host's picker for an away or vacated seat. An `mc-dialog` with one `mc-popup-button` per person who
could take the seat (the body scrolls natively) and Cancel in the footer, always on screen.

```html
<mc-room-give-dialog .model="${giveModel}"></mc-room-give-dialog>
```

| Property | Type            | Notes                                          |
| -------- | --------------- | ---------------------------------------------- |
| `model`  | `RoomGiveModel` | heading, the nobody-free words, people, cancel |

| Event            | Detail                                                        |
| ---------------- | ------------------------------------------------------------- |
| `mc-room-dialog` | `{ type: "press", key: "give:<participant id>" \| "cancel" }` |

Stops: `give:<id>` per person, `cancel`. `scroller` is the dialog's body.
