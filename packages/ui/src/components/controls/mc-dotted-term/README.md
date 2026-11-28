# mc-dotted-term

A word in running text that has a definition: a dotted rule under it, a tap target past the line, and a hover event for a mouse.

## Usage

```ts
html`Every villain phase it adds
  <mc-dotted-term label="threat" data-stop="term:threat" .action=${"threat"}></mc-dotted-term>.`;
```

It is inline. Press controls take no keyboard focus: the focus route presses it (`click()`); a tap is a press and release on it, never the lift that ends a swipe (`shared/tap.ts`).

## Properties

| Name        | Type    | Meaning                               |
| ----------- | ------- | ------------------------------------- |
| `label`     | string  | The word as it reads in the sentence. |
| `data-stop` | string  | Its focus stop's key (`term:<id>`).   |
| `action`    | unknown | What a tap raises.                    |

## Events

- `mc-pressed` (bubbles, composed): `{ action, hold }`.
- `mc-term-hover` (bubbles, composed): `{ over: boolean }`, from a mouse only; a finger raises none.

## Slots

None.
