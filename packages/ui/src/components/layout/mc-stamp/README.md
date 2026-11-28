# mc-stamp

A small capitals tag on a flat fill (WIN, LOSE, NEXT, RECOMMENDED, a lesson chip).

## Usage

```ts
html`<mc-stamp tone="heal" label="Win"></mc-stamp>`;
```

Size it with `--stamp-height` (20px), `--stamp-pad` (8px) and `--stamp-size` (9px, desktop-scaled). The word is the meaning; the tone only the look.

## Properties

| Name    | Type   | Meaning                                                             |
| ------- | ------ | ------------------------------------------------------------------- |
| `label` | string | The word, already translated.                                       |
| `tone`  | string | `heal`, `red`, `caution`, `ink` or `parchment` (default, outlined). |

## Events

None.

## Slots

None.
