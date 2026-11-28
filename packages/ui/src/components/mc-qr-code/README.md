# mc-qr-code

A QR code drawn as one SVG path with a four-module quiet zone. It encodes nothing: give it the modules.

## Usage

```ts
html`<mc-qr-code label="Receive link" .rows=${["1010", "0101", "1010", "0101"]} style="--qr-size: 180px"></mc-qr-code>`;
```

## Properties

| Name    | Type       | Meaning                                  |
| ------- | ---------- | ---------------------------------------- |
| `rows`  | `string[]` | One string per row: "1" dark, "0" light. |
| `label` | string     | What the code is, as assistive text.     |

Size it with `--qr-size` (220px, never wider than its box).

## Events

None.

## Slots

None.
