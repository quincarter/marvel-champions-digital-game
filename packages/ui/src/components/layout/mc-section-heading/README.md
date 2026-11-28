# mc-section-heading

A section's Bangers heading with its rule running on, an optional label at the right end and a slot for a control.

## Usage

```ts
html`<mc-section-heading label="Modular sets" right="1 CHOSEN"><mc-chip label="Random"></mc-chip></mc-section-heading>`;
```

## Properties

| Name | Type | Meaning |
| --- | --- | --- |
| `label` | string | The heading. |
| `right` | string | The label at the right end. |
| `onink` | boolean | Paper words and rule on an ink ground. |
| `stacked` | boolean | The right label drops under the heading. |

## Events

None.

## Slots

- `(default)`: A control at the end of the row.
