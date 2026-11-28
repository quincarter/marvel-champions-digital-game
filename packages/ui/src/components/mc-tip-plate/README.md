# mc-tip-plate

A short tip on a plate, placed beside what it explains: below the anchor, above where there is no room, clamped inside the
viewport (`tipPlacement` in `shared/tip-placement.ts`). It takes the press on it, so a tap shuts it and presses nothing beneath.

```html
<div style="position: relative">
  <mc-tip-plate text="Leadership: ..."></mc-tip-plate>
</div>
```

| Property   | Attribute | Type      | Meaning                                              |
| ---------- | --------- | --------- | ---------------------------------------------------- |
| `text`     | `text`    | string    | The tip's words (translated)                         |
| `anchor`   |           | `TipRect` | What it explains, in the offset parent's coordinates |
| `viewport` |           | `TipRect` | The box to stay inside                               |

Events: `mc-tip-dismiss` (a tap on the plate). Placement is set on the host's own `left`, `top` and `width`.
