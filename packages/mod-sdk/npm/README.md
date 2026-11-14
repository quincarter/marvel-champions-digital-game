# {{name}}

The mod SDK for [Marvel Champions Digital](https://github.com/quincarter/marvel-champions-digital-game) content
packs, version {{version}}: the pack schema, the ability DSL the game's own cards are written in, and the `mc-pack`
tool that validates, builds, tests and imports packs. It carries the game's rules engine, so `mc-pack test` plays
real headless games.

This is a fan-made, non-commercial project. Marvel Champions, its card text, artwork and characters are the property
of Fantasy Flight Games and Marvel.

## Install

```sh
npm install --save-dev {{name}}@{{version}}
```

The SDK is versioned with the game: a pack built with SDK {{version}} runs on app {{version}} and later. Every game
release also carries this package as a tarball, which installs the same way (`npm install --save-dev ./<file>.tgz`).

## A pack's source folder

```
pack.json              id, version, kind, name, authors, description, license, requires.app
cards/                 one card record per file: x.<pack-id>.<nn>[a|b].json
cards/<lang>/          optional card pictures: <card code>.webp
abilities/index.ts     default export: the pack's abilities, written with the DSL
decks/                 optional: one starter deck per file (a hero pack's precon)
art/                   images
CREDITS.md             who made the pack and its art
PERMISSION.md          the creator's permission for the store to distribute it
```

`abilities/index.ts` is TypeScript and needs no build step: `mc-pack` loads it directly.

```ts
import { definePackAbilities, heroAction, attackAnEnemy } from "{{name}}";

export default definePackAbilities({
  "x.my-hero.03.big-punch-action": heroAction({ label: "attack" }, attackAnEnemy(6)),
});
```

An ability id is `<card code>.<slug>`. `definePackAbilities` checks every definition and throws on the first problem.

## `mc-pack`

```sh
npx mc-pack validate .                 # check the pack; exit 1 with the problems listed
npx mc-pack validate . --allow-unscripted   # pass while only unscripted abilities remain
npx mc-pack build . --out build        # write the built pack, pack.json and <id>-<version>.zip
npx mc-pack test .                     # 3 headless games of each deck against Rhino
npx mc-pack test . --games 10 --scenario klaw
npx mc-pack import-marvelcdb ./community-pack --out ./my-pack --id my-pack
```

Exit codes: 0 success, 1 the pack has a problem, 2 a usage error. Validation lists real problems first and the
abilities that are not scripted yet as their own group.

`test` plays each deck in `decks/` with the game's greedy headless player and fails on an engine error, a game that
does not end (stuck), a prompt left open, or a game log that does not replay to the same state.

## Entry points

- `{{name}}`: the DSL builders, `definePackAbilities`, `validatePack`, `splitIssues`, `cardPoolWithPack`,
  `gameDepsWithPack`, `packObligation`.
- `{{name}}/build`: `buildPack`, `loadPackSource`, `assemblePack`, `zipPack` (Node).
- `{{name}}/testing`: `smokeTestPack` and the headless driver `playToOutcome`, for a pack's own tests (Node).
- `{{name}}/import`: `importMarvelCdbPack` (Node).

## License

AGPL-3.0-or-later, like the game. A pack's own data and art are under the pack's own license.
