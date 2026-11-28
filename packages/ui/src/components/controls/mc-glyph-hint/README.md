# mc-glyph-hint

The key or pad glyph of a control, hung on it while a keyboard or pad is the input in use. It only draws a `ControlGlyph`
the client built (`dom/control-glyphs.ts`); with none (touch, a mouse) it draws nothing. One element for every screen's
controls: the Set up the table Back and Deal buttons, and the Seats header, footer and Title controls can share it.

## Usage

```ts
html`<div class="ctl" style="position:relative; --mc-label-shift:${glyphLabelShift(glyph)}px">
  <mc-chip label="Deal it out"></mc-chip>
  <mc-glyph-hint .glyph=${glyph}></mc-glyph-hint>
</div>`;
```

A control that makes room for an inside glyph reads `--mc-label-shift` (`mc-chip` does): `glyphLabelShift(glyph)` is the px.

## Properties

| Name    | Type                      | Meaning                                                                           |
| ------- | ------------------------- | --------------------------------------------------------------------------------- |
| `glyph` | `ControlGlyph` (property) | What to draw: specs, height, ground, openness, still, place.                      |
| `place` | `inside` / `left`         | Reflected from the glyph: inside the control at its left, or outside to its left. |

## Events

None.

## Slots

None.
