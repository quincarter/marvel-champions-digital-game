# mc-lobby-seat-row

One seat of the room lobby: the hero picture (a "?" frame until a deck), the tag, the deck lines or "No deck yet", who holds it
(a filled dot while connected, a hollow one otherwise, always with the words), "requested by me", a boxed "Different build", a
column of buttons (the seat's action, Play, Give to...) and, below, the open Give list, a deck the host turned down (boxed,
headed, marked "!"), a Mod Store link per missing mod, the deck button, and each request with Approve and Deny. My own seat has
the heavier frame. Also used by the Epic tables and the Competitive team card.

```ts
html`<mc-lobby-seat-row .model=${row}></mc-lobby-seat-row>`;
```

| Property | Type                        | Notes                                                                                   |
| -------- | --------------------------- | --------------------------------------------------------------------------------------- |
| `model`  | `LobbySeatRowModel \| null` | the hero picture is a leased `PictureSource`; every button is a full `LobbyButtonModel` |

Events: each button raises `mc-pressed` with its command (`seat`, `seat-play`, `seat-give`, `seat-answer`, `seat-deck`,
`mod-store`, or `blocked`); this element's own `FeatureRelay` turns it into the one `mc-room-lobby` event. The picture raises
`mc-card-hover`, `mc-card-hover-end` and `mc-card-inspect` (`watchCard`). Stops are the model's (`LOBBY_STOP.seat(id)` and
the rest). Needs `mc-picture-tile` (`import "@mc/ui"`).
