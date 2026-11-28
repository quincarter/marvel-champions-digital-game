# Briefing option tile

`<mc-briefing-option-tile>`

The tile the role call, the modular-set call and the easier-start toggle share: a framed paper card with a Bangers name (and aspect chips), a few words and a label at its foot, all one press. A tile that cannot be picked is dimmed, says why in words and takes no press and no stop; a chosen set wears a green stripe; a switched-on toggle wears the red frame.

## Usage

```html
<mc-briefing-option-tile></mc-briefing-option-tile>
```

## Properties

| Name | Kind | What it is |
| ---- | ---- | ---------- |
| `tile` | property | `OptionTileModel`. |

## Events

- `mc-briefing`: when the tile action is a Briefing detail.
- `mc-pressed`: when it is not (a role step the owner handles).

## Files

- `McBriefingOptionTile.ts`: the class
- `mc-briefing-option-tile.ts`: the define file (registers the element once)
- `mc-briefing-option-tile.styles.ts`: the constructible stylesheet
- `mc-briefing-option-tile.types.ts`: the property and event types
- `__tests__/`: the tests
