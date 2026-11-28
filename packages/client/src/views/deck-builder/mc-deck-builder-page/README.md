# mc-deck-builder-page

The deck builder, the page. It only composes: the header, the identity step (a hero picker, then "Start from" for a hero with a
precon) or the builder itself. The builder is the chosen identity and either the wide layout's three columns (the aspect /
filter / chart rail, the card pool, "Your deck" on an ink ground) or a narrow layout's tab strip with one tab's body and the
pinned Save bar. Every part is an element in `components/deck-builder/`; shared `@mc/ui` elements are defined by the ui entry.

```
mc-deck-builder-page
  mc-builder-header                         title + Back (+ a ghost title the scene measures for the dark mode toggle)
  mc-identity-picker > mc-identity-tile     New deck, step one
  mc-start-from                             New deck, step two (a hero with a precon)
  mc-identity-row                           the chosen identity ("Read card")
  wide:   rail-left   mc-aspect-picker, mc-type-filters, mc-quick-filters (folded away), mc-pack-sort, mc-deck-charts
          mid         mc-pool-search, mc-quick-filters, mc-show-toggles, mc-pool-list > mc-windowed-list > mc-pool-cell / mc-pool-row
          rail-right  mc-deck-name, mc-legality-lines, mc-rewards-strip, mc-builder-tabs, mc-deck-list | mc-games-panel,
                      mc-builder-actions, mc-builder-save-bar
  narrow: mc-builder-tabs, then the Pool body (search, filters or the Filters chip, the pool list), the Deck body
          (aspects, name, legality, rewards, stacked charts, deck list, actions) over the pinned mc-builder-save-bar,
          or the From your games body
  mc-tip-plate                              the open aspect tip, over everything
```

| Property    | Type                      | Notes                                                                                         |
| ----------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `model`     | `DeckBuilderPageModel`    | everything shown, already computed and translated by the scene's view models                  |
| `layout`    | `wide`, `narrow`, `phone` | which layout the scene says is current                                                        |
| `titleDrop` | number                    | px the header drops, and `titleMax` how long its title may run, to clear the dark mode toggle |

| Event                                                                     | Detail                                                                                                   |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `mc-deck-builder`                                                         | `DeckBuilderEventDetail` (`components/deck-builder/shared/deck-builder-events.types.ts`), from the parts |
| `mc-window`                                                               | the pool list's built cards changed (not a press)                                                        |
| `mc-deck-builder-rendered`                                                | the page drew: the focus stops may have changed                                                          |
| `mc-card-hover`, `mc-card-hover-end`, `mc-card-inspect`, `mc-image-error` | from the card pictures                                                                                   |

The scene mounts it with `mountElement`, reads its focus stops through `focusStopsOf`, and uses `CardEvents` for the hover
popover and Inspect. Helpers for the scene: `scrollers()` (every list that scrolls, by name), `mainScroller`, `poolList`,
`headerElement`.
