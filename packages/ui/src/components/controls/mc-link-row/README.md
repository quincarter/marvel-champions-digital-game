# mc-link-row

A card-fill row that is itself a control and leads somewhere: a heading, a line under it, a lead slot and a trailing mark.

## Usage

```ts
html`<mc-link-row
  heading="Rules & glossary"
  detail="Every rule, in words"
  data-stop="reference"
  .action=${"reference"}
></mc-link-row>`;
```

Press controls take no keyboard focus: the screen's focus route presses them (`click()`). A tap is a press and release on the row with nothing scrolled between (`shared/tap.ts`). Size it with `--row-height` (64px) and `--heading-size` (15px).

## Properties

| Name         | Type    | Meaning                                |
| ------------ | ------- | -------------------------------------- |
| `heading`    | string  | The row's title.                       |
| `detail`     | string  | The line under it.                     |
| `emphasis`   | boolean | The recommended row: a yellow outline. |
| `data-stop`  | string  | Its focus stop's key.                  |
| `action`     | unknown | What a tap raises.                     |
| `holdAction` | unknown | What a hold or Inspect raises.         |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`.

## Slots

- `(default)`: under the heading and detail, for richer words (an aspect chip and its tagline).
- `lead`: at the left, before the words (an index badge, a chip).
- `trail`: at the right; a quiet "▸" shows while it is empty.
