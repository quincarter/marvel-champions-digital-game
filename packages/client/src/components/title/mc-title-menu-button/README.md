# mc-title-menu-button

One Title menu row: an `mc-button` with a platform mark, a count badge, a small tag and a press glyph hung over it.

| Property | Meaning                                                                      |
| -------- | ---------------------------------------------------------------------------- |
| `row`    | `TitleMenuRow`: key, label, skin, width, tall, disabled, wrap, badge, tag... |

The inner `mc-button` carries `data-stop` (the row key), so the focus route presses it with `click()`. Events: `mc-press`
from the button. Slots: none.
