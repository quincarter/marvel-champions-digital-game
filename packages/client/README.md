# `@mc/client`

The player-facing client: a 2D tabletop-style board in the mold of _Sentinels of
the Multiverse_, drawn entirely in **Phaser 4** with **Vite**. There is no DOM UI
framework — Phaser draws every screen, the table and every overlay.

Run it:

```bash
pnpm --filter @mc/client dev
```

## The one rule

**Phaser is a view, never an authority.** No game rules, legality checks or game
state live in this package. The engine's `GameState` is the only truth, every
command leaves through one `dispatch`, and every "is this legal?" answer —
including every "Why illegal?" message — comes from the engine's own
`legalActions`. If you find yourself about to add a number up, ask the engine
for it instead: a client-side sum is how a UI starts disagreeing with the rules.

## Layout

```
src/
  tokens.ts            the design system as data (see "Design source" below)
  settings.ts          reduced motion, text resolution
  session.ts           the app's one host + store
  engine/              the only door to the rules
    host.ts            the async EngineHost interface
    session-core.ts    the engine, driven — shared by both hosts
    worker-host.ts     + engine.worker.ts + protocol.ts (the game)
    local-host.ts      in-thread, same interface (Vitest and debugging)
    acting-player.ts   who the game is waiting on
  store/
    session-store.ts   one store, one dispatch. No Phaser imports.
  view/                plain TypeScript, tested without a canvas
    layout.ts          zone rectangles per form factor
    board-model.ts     everything the Board scene draws
    highlights.ts      what's legal, read off legalActions
    log-lines.ts       the game log, from the GameEvent stream
    villain-walkthrough.ts  the five-step villain phase, replayed from events
    names.ts           names, only ever from @mc/content
  ui/
    theme.ts           tokens → Phaser; the state matrix, implemented once
    widgets.ts         the Mc* layer scenes draw through
  scenes/              thin: they draw a view model and capture input
```

## Why the engine runs in a worker

`legalActions` peaks at ~194 ms in a 4-player Ultron game — about 11 frames at
60 fps. Copying the state to a worker costs about 0.4 ms without the card pool,
which crosses once at startup. So the engine lives on its own thread behind an
async `EngineHost`, the main thread never waits on the rules, and tweens keep
running while a command is applied. Board input is locked while a command is in
flight; the game is turn-based, so that is invisible.

The same async interface is what host- or server-authoritative multiplayer needs
(PLAN.md Phase 5), so a network host can replace the worker without the client
changing shape.

## Design source

Every colour, type role, border weight, opacity step and touch target in
`tokens.ts` is transcribed from `Marvel Champions game screens/Components.dc.html`.
The rules that settle arguments live there too, and the code follows them:

- **One red per screen** — Hero Red marks the single forward action, plus the
  live round chip.
- **Borders, not shadows** — 3px ink = a real object, 2.5px = a control inside
  one, 2px = a detail box, dashed = an unfilled slot. The only shadow in the
  system is the red selection ring.
- **Dim, don't hide** — an illegal choice stays exactly in place at 38% ink,
  because the board must not reflow while the player's hand is already moving.
- **Status owns a button** — stunned greys Attack, confused greys Thwart, tough
  hatches the HP bar.
- **Numbers before prose** — anything recalculated each round is Bangers 17px+;
  long rules text goes to the Inspect overlay, never onto the table.

The mocks' card text is placeholder. Every name, stat and rules text the client
draws comes from `@mc/content` (and from its `current` text, so errata is what
the game plays by).

## Card art

Scans live in the gitignored `assets/card-art/`, found through each card's
`ArtRef` key. They are for personal, non-commercial use and are never committed
(CLAUDE.md). A missing scan falls back to a generated frame — which is currently
every card, since the art pipeline isn't wired yet.

## Debugging a canvas

A canvas has no inspectable DOM. In development the game is on
`window.__mcGame`, which is enough to read `scale.gameSize`, walk a scene's
display list, or fire a widget's `pointerup` directly:

```js
const board = window.__mcGame.scene.getScene("Board");
board.children.list.filter((o) => o.type === "Text").map((o) => o.text);
```

That last trick matters: a WebGL canvas does not always screenshot cleanly right
after a resize, so a stale capture can show the table at the wrong size. Trust
the display list over the picture.
