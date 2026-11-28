# mc-step-ticks

A strip of equal ticks, the first few filled in caution yellow: where the player is in a run of steps.

## Usage

```ts
html`<mc-step-ticks count="5" filled="1" label="Lesson 1 of 5"></mc-step-ticks>`;
```

Size it with `--ticks-width` (140px) and `--ticks-height` (10px). The state is also the `aria-label`, so it never rests on colour alone.

## Properties

| Name     | Type   | Meaning                                  |
| -------- | ------ | ---------------------------------------- |
| `count`  | number | How many ticks.                          |
| `filled` | number | How many are filled, from the first.     |
| `label`  | string | The strip's accessible name, translated. |

## Events

None.

## Slots

None.
