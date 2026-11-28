# mc-lobby-people

Who is in the room. Under a section heading, each person is a card (name, a boxed role such as HOST, the device as words beside a
small platform icon, and the seats / build line); with `compact` each is one line (`line`, as the Epic and Competitive panels
show people). No press; used by `mc-lobby-seats`, `mc-lobby-epic` and `mc-lobby-competitive`.

```ts
html`<mc-lobby-people .model=${{ heading: "People", rows, compact: false }}></mc-lobby-people>`;
```

| Property | Type                       | Notes                                                    |
| -------- | -------------------------- | -------------------------------------------------------- |
| `model`  | `LobbyPeopleModel \| null` | every word arrives translated; `platform` picks the icon |

The heading is `mc-section-heading` (`import "@mc/ui"`).
