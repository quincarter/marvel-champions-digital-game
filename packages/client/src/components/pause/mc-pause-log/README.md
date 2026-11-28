# mc-pause-log

A heading over a parchment box of log lines, newest first: "Jump to a moment" beside the Rules reference, or the Full game log taking the pane. Lines Undo can get back to are pressable.

## Usage

```ts
html`<mc-pause-log .input=${model.jump}></mc-pause-log>`;
```

## Properties

| Name    | Type            | Meaning                                             |
| ------- | --------------- | --------------------------------------------------- |
| `input` | `PauseLogInput` | The heading, an optional note, the lines, the hint. |

`scroller` (getter): the box's scrolling element.

## Events

`mc-pause` (bubbles, composed): `{ type: "moment", id }`.

## Slots

None. Focus stops: `moment:<id>` for each undoable line.
