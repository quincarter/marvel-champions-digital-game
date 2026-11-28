# mc-stats-list

One tab's blocks as a natively scrolling column; each tab keeps its own place.

## Usage

```ts
html`<mc-stats-list .blocks=${blocks} scroll-key="heroes"></mc-stats-list>`;
```

## Properties

| Name         | Type                    | Meaning                |
| ------------ | ----------------------- | ---------------------- |
| `blocks`     | StatsBlock[] (property) | The blocks in order.   |
| `scroll-key` | string                  | The tab's scroll name. |

## Events

`mc-player-stats` (bubbles, composed): `StatsEventDetail`.

## Slots

None.
