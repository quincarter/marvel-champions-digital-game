# mc-lesson-list

THE BASICS on the How to play hub: its label over the tutorial's five lessons.

## Usage

```ts
html`<mc-lesson-list heading="THE BASICS" .lessons=${lessons}></mc-lesson-list>`;
```

It draws nothing while it has no lessons. Each row is an `mc-lesson-row` (a focus stop `lesson:<id>`).

## Properties

| Name      | Type             | Meaning                         |
| --------- | ---------------- | ------------------------------- |
| `heading` | string           | THE BASICS, already translated. |
| `lessons` | LessonRowModel[] | The rows.                       |

## Events

`mc-learn` (bubbles, composed): `{ type: "lesson", id }`.

## Slots

None.
