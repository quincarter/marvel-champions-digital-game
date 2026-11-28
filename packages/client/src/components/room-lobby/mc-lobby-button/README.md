# mc-lobby-button

The one button every part of the room lobby presses with. It wraps `mc-button` and takes a typed `command` (a `LobbyEvent`).
A tap raises `mc-pressed` `{ action: command, hold: false }`; the section's `FeatureRelay<LobbyEvent>` turns it into the lobby's
one `mc-room-lobby` event.

```html
<mc-lobby-button
  stop="seat:s1"
  label="Leave"
  kind="secondary"
  .command=${{ type: "seat", seat: "s1", action: "leave" }}
></mc-lobby-button>
```

Or from a model: `el.model = { stop, label, kind, command, enabled, reason, selected, aria, display }` (`LobbyButtonModel`).

| Property   | Type                                     | Notes                                                              |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `command`  | `LobbyEvent \| null`                     | what a tap raises                                                  |
| `label`    | `string`                                 | translated                                                         |
| `kind`     | `primary \| secondary \| quiet \| onInk` |                                                                    |
| `selected` | `boolean`                                | on / chosen                                                        |
| `enabled`  | `boolean`                                | default true; false dims it                                        |
| `reason`   | `string`                                 | with `enabled` false, a press raises `{ type: "blocked", reason }` |
| `stop`     | `string`                                 | the `data-stop` key (on the inner `mc-button`)                     |
| `aria`     | `string`                                 | accessible name when the label is a symbol                         |
| `display`  | `boolean`                                | a Bangers label                                                    |

**Armed-press rule.** The host carries `data-meaning` (the command, its target, its look, its words and whether it is on) and
`data-meaning-stop`. When the same stop's meaning changes between two renders, the scene calls `cancelPressesWithin` on it, so a
finger already down on "Ask" does not press "Leave". `commandKeyOf` and `meaningOf` are in `mc-lobby-button.types.ts`.

Custom properties: `--mc-lobby-button-height` (44px), `--mc-lobby-button-size` (12px; 22px for `display`).
