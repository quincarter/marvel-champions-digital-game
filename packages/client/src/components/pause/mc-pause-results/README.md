# mc-pause-results

What Pause's search found, in groups: Settings switches and choices that change in place, and rows that open their page.

## Usage

```ts
html`<mc-pause-results .input=${model.results}></mc-pause-results>`;
```

## Properties

| Name    | Type                | Meaning                           |
| ------- | ------------------- | --------------------------------- |
| `input` | `PauseResultsInput` | The answer, grouped, with a note. |

## Events

`mc-pause` (bubbles, composed): `{ type: "result", id }` or `{ type: "setting", id, value? }`.

## Slots

None. Focus stops: `result:<id>` and `result:<id>:<value>`.
