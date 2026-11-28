# mc-continue-bar

The How to play hub's one red forward action: "Continue learning ▸".

## Usage

```ts
html`<mc-continue-bar label="Continue learning ▸" ?starting=${starting}></mc-continue-bar>`;
```

An `mc-button` and the focus stop `continue-learning`. While `starting` it is dimmed and a press does nothing.

## Properties

| Name       | Type    | Meaning                                 |
| ---------- | ------- | --------------------------------------- |
| `label`    | string  | The button's words, already translated. |
| `starting` | boolean | The tutorial game is being made.        |

## Events

`mc-learn` (bubbles, composed): `{ type: "continue" }`.

## Slots

None.
