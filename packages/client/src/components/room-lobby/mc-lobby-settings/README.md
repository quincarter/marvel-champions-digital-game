# mc-lobby-settings

The online room lobby's Settings panel: groups of rows in one natively scrolling column. Built to `LobbySettingsModel`
(`../room-lobby.types.ts`); every word arrives translated, every press is a typed command the model carries.

```html
<mc-lobby-settings .model="${settings}"></mc-lobby-settings>
```

| Property | Type                         | Notes                                                        |
| -------- | ---------------------------- | ------------------------------------------------------------ |
| `model`  | `LobbySettingsModel \| null` | `loading` set: only that line shows. Null: nothing is drawn. |

| Getter     | Notes                                                                                 |
| ---------- | ------------------------------------------------------------------------------------- |
| `scroller` | the `list:settings` column (the pad's stick scrolls it; the scene keeps its position) |

Rows, by `kind`:

| Kind     | Drawn as                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| `toggle` | `mc-switch-row` (`onpaper`): the host presses it; not `pressable` it is `readonly` (the state, no dead button) |
| `choice` | `mc-press-card` with its detail under it for the host; everyone else sees only the chosen one as plain words   |
| `mode`   | a box of `mc-card-art` pictures, the title and tagline, and the host's Change (`mc-lobby-button`)              |
| `mod`    | the name, the state in a boxed word (Have / Missing, never colour alone) and the Mod Store button when missing |
| `text`   | a plain line, bold when asked                                                                                  |

A group's `heading` is an `mc-section-heading`; the group that leads the list has none.

| Event           | Detail       | Notes                                                                  |
| --------------- | ------------ | ---------------------------------------------------------------------- |
| `mc-room-lobby` | `LobbyEvent` | the model's `command` (`setting`, `mod-store`), through `FeatureRelay` |

Focus stops are the model's own `stop` keys, plus `list:settings`.
