# mc-pause-rules

The Rules reference section of Pause's paper pane: a title, what it is filtered to, and a grid of keyword and status cards for what is on the table.

## Usage

```ts
html`<mc-pause-rules .input=${model.rules}></mc-pause-rules>`;
```

## Properties

| Name    | Type              | Meaning                                                           |
| ------- | ----------------- | ----------------------------------------------------------------- |
| `input` | `PauseRulesInput` | The title, the filter line, the cards, and the line for no cards. |

## Events

`mc-pause` (bubbles, composed): `{ type: "keyword", id }`. The card hover events of a card's name bubble up as they are.

## Slots

None. Focus stops: `keyword:<id>`.
