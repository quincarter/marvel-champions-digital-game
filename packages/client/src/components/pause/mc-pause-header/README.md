# mc-pause-header

"Paused", the status line, a Civil War game's scenario sheet and the adjusted note. On the phone it ends in the boxed ✕.

## Usage

```ts
html`<mc-pause-header .input=${model.header} mode="phone"></mc-pause-header>`;
```

## Properties

| Name    | Type               | Meaning              |
| ------- | ------------------ | -------------------- |
| `input` | `PauseHeaderInput` | What it shows.       |
| `mode`  | `wide` / `phone`   | The phone has the ✕. |

## Events

`mc-pause` (bubbles, composed): `{ type: "menu", id: "close" }`.

## Slots

None. Focus stop: `close`.
