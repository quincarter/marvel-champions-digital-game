# mc-title-promo

The "Play online" feature panel of the Title: title band, pitch, an "N live" chip and Host / Join buttons.

| Property      | Meaning                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| `input`       | `TitlePromoInput`: variant, title, pitch, live text, button words, availability.   |
| `variant`     | `side` (beside the menu column, tall) or `art` (a caption box over the art panel). |
| `unavailable` | Reflected from `input.available`: the panel dims and its buttons are inert.        |

Host and Join are focus stops (`play-online-host`, `play-online-join`). Events: `mc-press` from each. Slots: none.
