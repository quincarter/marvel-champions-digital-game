# mc-round-strip

How to win's EVERY ROUND strip: a label over the round's beats as pills, with an arrow between each.

## Usage

```ts
html`<mc-round-strip label="EVERY ROUND" .steps=${["YOU ACT & DRAW UP", "VILLAIN ACTS"]}></mc-round-strip>`;
```

The first pill is ink, the next Hero Red. A long translation wraps inside its pill (the Spanish "ACTÚAS Y ROBAS HASTA TU TAMAÑO DE MANO" does on a phone).

## Properties

| Name    | Type     | Meaning                                 |
| ------- | -------- | --------------------------------------- |
| `label` | string   | EVERY ROUND, already translated.        |
| `steps` | string[] | The beats' words, in order, translated. |

## Events

None.

## Slots

None.
