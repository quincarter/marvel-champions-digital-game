# mc-pause-menu

The menu column's buttons (wide) or the footer's (phone). `foot` items sit at the bottom when there is room and follow the rest when the screen is short; the page scrolls the column, so nothing draws over anything.

## Usage

```ts
html`<mc-pause-menu .items=${model.menu} mode="wide"></mc-pause-menu>`;
```

## Properties

| Name    | Type              | Meaning           |
| ------- | ----------------- | ----------------- |
| `items` | `PauseMenuItem[]` | The buttons.      |
| `mode`  | `wide` / `phone`  | Column or footer. |

## Events

`mc-pause` (bubbles, composed): `{ type: "menu", id }`.

## Slots

None. Focus stops: one per button, named by its id.
