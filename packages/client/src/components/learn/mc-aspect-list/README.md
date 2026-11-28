# mc-aspect-list

ASPECTS on the How to play hub: its label over the four playable aspects.

## Usage

```ts
html`<mc-aspect-list heading="ASPECTS" .aspects=${aspects}></mc-aspect-list>`;
```

It draws nothing while it has no aspects. Each row is an `mc-aspect-row` (a focus stop `aspect:<aspect>`).

## Properties

| Name      | Type             | Meaning                      |
| --------- | ---------------- | ---------------------------- |
| `heading` | string           | ASPECTS, already translated. |
| `aspects` | AspectRowModel[] | The rows.                    |

## Events

`mc-learn` (bubbles, composed): `{ type: "aspect", aspect }`.

## Slots

None.
