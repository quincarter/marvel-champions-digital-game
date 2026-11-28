# mc-segments

A strip of segment cells on an ink ground, equal in width. It holds no state: each cell is a focus stop and raises its own `mc-pressed`.

## Usage

```ts
html`<mc-segments
  look="tile"
  .options=${[{ stop: "guide:guide-level:full", label: "Full", detail: "Every step", selected: true, action: "full" }]}
></mc-segments>`;
```

## Properties

| Name      | Type                | Meaning               |
| --------- | ------------------- | --------------------- |
| `options` | `McSegmentOption[]` | The cells.            |
| `look`    | `cell` / `tile`     | Passed to every cell. |

## Events

`mc-pressed` from a cell (bubbles, composed): `{ action, hold }`.

## Slots

None.
