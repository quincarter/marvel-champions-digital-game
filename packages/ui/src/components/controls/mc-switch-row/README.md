# mc-switch-row

A settings row on an ink ground: a title over a line of detail, and a switch that says its state in words. The whole row is the control.

## Usage

```ts
html`<mc-switch-row
  data-stop="table:sound"
  title-text="Sound"
  detail="Music and effects."
  state="ON"
  ?on=${true}
  .action=${"sound"}
></mc-switch-row>`;
```

## Properties

| Name          | Type    | Meaning                                 |
| ------------- | ------- | --------------------------------------- |
| `title-text`  | string  | The title, already translated.          |
| `detail`      | string  | The line under it.                      |
| `state`       | string  | The switch's word (ON, OFF, Open, "—"). |
| `on`          | boolean | The switch is on.                       |
| `unavailable` | boolean | Dimmed, in place; a tap does nothing.   |
| `data-stop`   | string  | Its focus stop's key.                   |
| `action`      | unknown | What a tap raises.                      |

## Events

`mc-pressed` (bubbles, composed): `{ action, hold }`.

## Slots

None.
