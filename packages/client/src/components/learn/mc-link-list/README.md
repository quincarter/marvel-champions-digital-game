# mc-link-list

A labelled run of rows that lead somewhere: REFERENCE and NEW IN EACH BOX on the How to play hub.

## Usage

```ts
html`<mc-link-list
  heading="REFERENCE"
  .rows=${[{ stop: "reference", heading: "Rules & glossary", detail: "Every keyword", action: { type: "reference" } }]}
></mc-link-list>`;
```

Each row is an `mc-link-row` with the focus stop and the `mc-learn` event it names. It draws nothing while it has no rows. `columns="2"` lays the rows in two equal columns (`--column-gap`, 24px).

## Properties

| Name      | Type          | Meaning                                          |
| --------- | ------------- | ------------------------------------------------ |
| `heading` | string        | The label, already translated.                   |
| `rows`    | LinkListRow[] | The rows: `stop`, `heading`, `detail`, `action`. |
| `columns` | number        | How many equal columns (1).                      |

## Events

`mc-learn` (bubbles, composed): each row's own `action`.

## Slots

None.
