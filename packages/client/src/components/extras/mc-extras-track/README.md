# mc-extras-track

One song of the Music tab: a badge row (`mc-list-row`: the play or stop mark, the title, where it plays or what opens it) that is itself the press control, on the `McPress` base from `@mc/ui`. A tap, or the focus route pressing it, raises `mc-pressed` with its `action`; `mc-extras-tracks` relays that as `mc-extras`.

## Properties

| Name        | Type                | Meaning                           |
| ----------- | ------------------- | --------------------------------- |
| `model`     | `McListRowModel`    | The badge row to draw.            |
| `data-stop` | string              | Its focus stop key (`tile:<id>`). |
| `action`    | `ExtrasEventDetail` | What a tap raises (a `tile`).     |

## Events

`mc-pressed` (`PressDetail`).
