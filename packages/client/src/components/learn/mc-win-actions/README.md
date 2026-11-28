# mc-win-actions

The two ways on from How to win: a quiet "Tell me more" and the red "Start the fight".

## Usage

```ts
html`<mc-win-actions tell-label="Tell me more" start-label="Start the fight ▸" ?starting=${starting}></mc-win-actions>`;
```

Both are `mc-button`s and focus stops (`tell-me-more`, `start-the-fight`); a tap, or the route's Enter, raises the event. While `starting` Start is dimmed and not a stop.

## Properties

| Name          | Type    | Meaning                                           |
| ------------- | ------- | ------------------------------------------------- |
| `tell-label`  | string  | Tell me more.                                     |
| `start-label` | string  | Start the fight, or "Suiting up…" while it waits. |
| `starting`    | boolean | The tutorial game is being made.                  |

## Events

`mc-learn` (bubbles, composed): `{ type: "tell-more" }`, `{ type: "start" }`.

## Slots

None.
