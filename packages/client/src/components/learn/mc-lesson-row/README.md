# mc-lesson-row

One of the tutorial's five lessons on the How to play hub: an index badge, the title, and a ✓ DONE, a NEXT stamp or a quiet "▸".

## Usage

```ts
html`<mc-lesson-row
  .model=${{ id: "how-to-win", index: 1, title: "How to win", done: false, recommended: true, doneLabel: "✓ Done", nextLabel: "NEXT" }}
></mc-lesson-row>`;
```

The row is a focus stop `lesson:<id>` (an `mc-link-row` inside). The recommended row has a heavy yellow outline as well as the stamp, and a done row has a ✓ in its badge as well as the word, so no state rests on colour alone.

## Properties

| Name    | Type           | Meaning                      |
| ------- | -------------- | ---------------------------- |
| `model` | LessonRowModel | The row, already translated. |

## Events

`mc-pressed` (bubbles, composed): `{ action: { type: "lesson", id }, hold: false }`. The hub's section turns it into `mc-learn`.

## Slots

None.
