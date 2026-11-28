# mc-tip-plate

An aspect's tip on an ink plate (name, tagline, one-line tip, caution rule, a link to the lesson) with an arrow toward the
control it explains. Mount it only while the tip is open.

- It fills the screen (`position: fixed; inset: 0`; inside a transformed ancestor, that ancestor) and sits at `z-index: 2000`,
  over the controls. A transparent backdrop takes a tap anywhere outside the plate and raises `mc-tip-close`: the tap lands
  on the backdrop, so nothing underneath is pressed.
- The plate is placed by `tip-placement.ts` (the rules of the client's `dom/aspect-tip-sheet.ts`): centered on the anchor,
  below it, above where there is no room, clamped inside the screen, wider (300px) where there is room. It measures on connect,
  after each render, and on a resize or scroll.
- A parent that makes its own stacking context (`position` with a `z-index`, `contain: paint`) caps how high the plate
  can sit in the draw order, and `contain: paint` also clips it: mount it high.

```html
<mc-tip-plate
  .anchor="${chipElement.infoElement}"
  heading="Justice"
  tagline="Thwarting — keeps threat off the scheme"
  body="Pick it when the villain schemes fast."
  link-label="Aspects ▸"
  link-available
  link-stop="aspect-tip-link"
></mc-tip-plate>
```

| Property         | Type    | Notes                                                   |
| ---------------- | ------- | ------------------------------------------------------- |
| `anchor`         | Element | what the arrow points at; null centers the plate        |
| `heading`        | string  | the aspect's name, translated                           |
| `tagline`        | string  | translated                                              |
| `body`           | string  | translated                                              |
| `link-label`     | string  | "Aspects ▸"                                             |
| `link-reason`    | string  | why a link that is not live is not ("Coming soon")      |
| `link-available` | boolean | the link is a button (a focus stop) and not plain words |
| `link-stop`      | string  | `data-stop` of the live link                            |

| Event          | Notes                                         |
| -------------- | --------------------------------------------- |
| `mc-tip-link`  | a tap, or Enter on its stop, on the live link |
| `mc-tip-close` | a tap on the backdrop                         |
