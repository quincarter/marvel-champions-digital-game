# Moving a screen branch onto the shared kit

Five branches built overlapping components with different APIs. This kit has one canonical component per concept; this
note says, per branch, how its callers map onto it so a branch can be rebased mechanically. Take the kit files
(`packages/ui/src/**`, `sheet-builder.ts`) from the kit side on any conflict, then apply the renames below to the
branch's own screens.

Branches: **lobby** (`feature/lit-panels-room-lobby`), **lists-b** (`feature/lit-panels-phase4-lists-b`, Extras and
friends), **lists-a** (`feature/lit-panels-phase4-lists-a`, Past games, Stats, Trophies), **modstore**
(`feature/lit-panels-phase4-modstore`). The Title branch has no overlap and needs nothing. The client files other than
`sheet-builder.ts` (`sheet-top-bar.ts`, `sheet-glyphs.ts` `alignRight` / `idsNow`, `popup-sheet.ts`, `matchup-sheet.ts`)
are not part of the kit and stay with their branch.

## The canonical components

| Element             | Is                                                                                      | Sheet node       | Builder method                          |
| ------------------- | --------------------------------------------------------------------------------------- | ---------------- | --------------------------------------- |
| `mc-picture-tile`   | A picture and nothing else: src, missing word or letter, fit, focus, frame, ground, dim | `pictureTile`    | `pictureTile(rect, options)`            |
| `mc-picture-card`   | A captioned card built from `mc-picture-tile`: chip, title, detail                      | `pictureCard`    | `pictureCard(rect, model, options?)`    |
| `mc-media-row`      | A framed row built from `mc-picture-tile`: picture, heading, meta, summary, foot, badge | `mediaRow`       | `mediaRow(key, rect, row)`              |
| `mc-list-row`       | Round badge, title, detail line (no picture)                                            | `listRow`        | `listRow(rect, model, key?)`            |
| `mc-section-header` | Heading, rule (in line or underlined), count, level, fold chevron                       | `sectionHeader`  | `sectionHeader(rect, label, options?)`  |
| `mc-empty-state`    | Message, optional detail, size, align                                                   | `emptyState`     | `emptyState(at, message, options?)`     |
| `mc-search-field`   | Real input: debounced `mc-search`, IME-safe, Enter/Escape, clear, pad focus             | `search`         | `search(rect, options)`                 |
| `mc-tab-rail`       | Tabs with roles, badges, disabled reasons; `selected` id or per-tab flag                | `tabRail`        | `tabRail(rect, tabs, options?)`         |
| `mc-filter-chip`    | Toggle chip on `mc-button`: "✓ label" chosen, "label 3" unchosen                        | (inside the bar) |                                         |
| `mc-filter-bar`     | Chips + optional sort + optional filter-sheet button; wrapping or packed layout         | `filterBar`      | `filterBar(key, rect, chips, options?)` |
| `mc-article`        | Natively scrolling reading text                                                         | `article`        | `article(rect, options)`                |

Shared types: `shared/tab-rail.types.ts` (`TabRailTab`), `shared/filter.types.ts` (`FilterChip`, `FilterSort`,
`FilterBarModel`), `shared/picture.types.ts` (`PictureFit`, `PictureFocus`, `PictureGround`). Component types:
`McPictureCardModel`, `McListRowModel`, `McArticleModel` / `McArticleBlock`, `McSearchDetail` / `McSearchFocusDetail`,
`SectionHeaderLevel`, `PictureErrorDetail`.

Also in the kit: `SheetButton.aria` (builder `button({ aria })`), `SheetImage.dim` (builder `image({ dim })`),
`SheetBuilder.scrollFit`, `McSheet.elementOf` finding chips inside `mc-filter-bar` and tab cells inside `mc-tab-rail`,
and `svg.part { pointer-events: none }`.

Two points that apply to every branch:

- **`mc-picture-tile` `focus` is the property `subject`** (`{ x, y }`): `focus` is `HTMLElement.focus`, so it cannot be a
  property. The sheet node and the builder option keep the name `focus`. The `focus-x` / `focus-y` attributes are gone.
- **`mc-picture-tile` is only the picture.** The lists-b captioned tile is now `mc-picture-card`; the card is a
  composition over the tile. A screen that wants a caption on a plain tile lays text or a card next to it.

## lobby

| Old                                                                           | New                                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `mc-section-header` `label`, `size` (px, default 17), `rule`                  | unchanged (still the default look)                                                                                        |
| node `sectionHeader` `{ rect, label, size, key }`                             | unchanged; new optional `count`, `level`, `rule`, `underline`, `open`                                                     |
| `b.sectionHeader(rect, label, { size, key })`                                 | unchanged                                                                                                                 |
| `mc-tab-rail` `tabs` (with `selected`, `disabled`, `badge`), `prefix`, `size` | unchanged; new rail-level `selected` id                                                                                   |
| node `tabRail` `{ rect, tabs, prefix, size, key }`                            | unchanged; new optional `selected`                                                                                        |
| `b.tabRail(rect, tabs, { prefix, size, key })`                                | unchanged; new option `selected`. A `size` of 12 or less now grows on desktop (as lists-b did); leave `size` out for none |
| `TabRailTab.disabled?: string \| true`                                        | `string \| boolean` (`false` is the same as absent)                                                                       |
| `mc-picture-tile` `focusX` / `focusY` (or `focus-x` / `focus-y`)              | `subject = { x, y }`                                                                                                      |
| `mc-picture-tile` `src`, `missing`, `fit`, `frame`, events                    | unchanged (`mc-image-load`, `mc-image-error` `{ src }`); new `ground`, `dim`, `letter`                                    |
| node `pictureTile` `{ src, missing, fit, focus, frame, hover, retry, key }`   | unchanged; new optional `ground`, `dim`                                                                                   |
| `b.pictureTile(rect, { ... })`                                                | unchanged; new options `ground`, `dim`                                                                                    |
| `b.scrollFit`, `SheetButton.aria`                                             | unchanged                                                                                                                 |
| `shared/tab-rail.types.ts` `TabRailTab`                                       | unchanged                                                                                                                 |

Nothing else changes for the lobby.

## lists-b

| Old                                                                                         | New                                                                                        |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `mc-tab-rail` `McTabRailTab { id, label, disabled? }`                                       | `TabRailTab` (`@mc/ui`); `disabled` may be a string reason; `selected` rail prop kept      |
| `McTabRailTab` import                                                                       | `TabRailTab`                                                                               |
| `mc-tab-rail` `size` default 9                                                              | default 0 (the button own size): pass `size` explicitly where 9 was relied on              |
| `mc-tab-rail` cells directly in the shadow root                                             | each cell is in a `.cell` wrapper (a badge sits on it); `mc-button[data-key]` is unchanged |
| node `tabRail` `{ rect, tabs, selected, size, prefix, key }`                                | unchanged                                                                                  |
| `b.tabRail(rect, { tabs, selected, size, prefix, key })`                                    | `b.tabRail(rect, tabs, { selected, size, prefix, key })` (tabs is now the second argument) |
| `mc-picture-tile` `model: McPictureTileModel` (captioned tile)                              | `mc-picture-card` `model: McPictureCardModel` (same fields)                                |
| `McPictureTileModel`                                                                        | `McPictureCardModel`                                                                       |
| node `pictureTile` `{ rect, model, key }`                                                   | node `pictureCard` `{ rect, model, key }`                                                  |
| `b.pictureTile(rect, model, key?)`                                                          | `b.pictureCard(rect, model, { key })`                                                      |
| `mc-list-row` `model: McListRowModel`                                                       | unchanged (`McListRowModel` unchanged)                                                     |
| node `listRow`, `b.listRow(rect, model, key?)`                                              | unchanged                                                                                  |
| `mc-empty-state` `text`, `size`                                                             | `message`, `size` (`text` is renamed `message`)                                            |
| node `emptyState` `{ x, y, text, size }`                                                    | `{ x, y, message, size }` (new optional `width`, `height`, `detail`, `align`, `key`)       |
| `b.emptyState(x, y, text, size = 14)`                                                       | `b.emptyState({ x, y }, message, { size })`                                                |
| `mc-search-field`, node `search`, `b.search(rect, options)`, `mc-search`, `mc-search-focus` | unchanged; new optional `escape-clears`, and `focus()` now focuses the input               |
| `mc-article`, node `article`, `b.article(rect, options)`, `McArticleModel`                  | unchanged                                                                                  |
| `SheetImage.dim`, `b.image({ dim })`                                                        | unchanged                                                                                  |
| picture tile that fell back to the faint initial when its picture failed                    | `mc-picture-card` does this too (a failed load now shows the initial)                      |

`sheet-top-bar.ts` and the `sheet-glyphs.ts` changes are client-only and stay in the branch.

## lists-a

| Old                                                                                                   | New                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `mc-section-header` `heading`                                                                         | `label`                                                                                                                                |
| `mc-section-header` `size="large" \| "small"`                                                         | `level="large" \| "small"`; `size` is now the heading px size (was `--mc-section-size` / `titleSize`)                                  |
| `mc-section-header` `open="true" \| "false"` (string)                                                 | `open` boolean property (true, false, or undefined for a plain heading)                                                                |
| `mc-section-header` always underlined, count at the right                                             | add `underline` (the lobby look, rule in line, is the default)                                                                         |
| node `section-header` `{ heading, count, size, open, titleSize }`                                     | node `sectionHeader` `{ label, count, level: size, open, size: titleSize, underline: true }`                                           |
| `b.sectionHeader(rect, { heading, count, size, open, titleSize, key })`                               | `b.sectionHeader(rect, heading, { count, level: size, open, size: titleSize, underline: true, key })`                                  |
| `SectionHeaderSize`                                                                                   | `SectionHeaderLevel`                                                                                                                   |
| `mc-empty-state` `message`, `detail`                                                                  | unchanged; it was centered, so add `align="center"` (default is `start`); default size is 14 not 11                                    |
| node `empty` `{ rect, message, detail, key }`                                                         | node `emptyState` `{ x, y, width, height, message, detail, align: "center", key }`                                                     |
| `b.empty(rect, message, detail?)`                                                                     | `b.emptyState(rect, message, { detail, align: "center" })` (a rect works as `at`)                                                      |
| `mc-picture-tile` `cover`                                                                             | `fit="cover"` (the default); the lists-a default of fit-whole is now `fit="contain"`                                                   |
| `mc-picture-tile` `framed`                                                                            | `frame` (px; 1.5 for the old thin frame, 2 default, 0 none); the old 60% ink tone is full ink                                          |
| `mc-picture-tile` `subject { x, y }`                                                                  | `subject { x, y }` (unchanged)                                                                                                         |
| `mc-picture-tile` parchment ground                                                                    | `ground="parchment"` (default ground is now spent ink)                                                                                 |
| `PictureFocusPoint`                                                                                   | `PictureFocus`                                                                                                                         |
| `mc-search-field` `value`, `placeholder`, `clear-label`, `debounce`, `mc-search { value, immediate }` | unchanged                                                                                                                              |
| `mc-search-field` Escape clears a filled field, then leaves                                           | set `escape-clears` (default Escape only leaves and keeps the text); `clearLabel` default is "" (pass it)                              |
| `mc-search-field` `type="search"`, 44px min height, absolute clear button                             | text input in a flex row; the host height sets the field height                                                                        |
| `mc-filter-chip` `label`, `count`, `selected`, `disabled`, `value`                                    | same props; `count` reads "label 3" (not "(3)") and a chosen chip reads "✓ label"; `count-always` shows the count on a chosen chip too |
| `mc-filter-chip` `mc-activate { key: value }`                                                         | unchanged                                                                                                                              |
| `mc-filter-bar` `model = { chips, sort, sheetLabel }`                                                 | properties `chips`, `sort`, `sheetLabel` (`sheet-label`) directly; there is no `model`                                                 |
| `FilterChipModel { key, label, count, selected, disabled }`                                           | `FilterChip { id, label, count, selected, disabled }` (`key` is renamed `id`)                                                          |
| `mc-filter { key }`                                                                                   | `mc-activate { key: prefix + id, id }`; set `prefix=""` to keep the raw key in `detail.key`                                            |
| `mc-sort { value }`, `mc-filter-sheet`                                                                | unchanged                                                                                                                              |
| `FilterBarModel`, `FilterSort`                                                                        | `FilterBarModel` now also carries `prefix`, `rows`, `rowHeight`, `gap`; `FilterSort` unchanged                                         |
| the sheet button was a `span role=button`                                                             | an `mc-button` (kind `secondary`, `data-key="filter-sheet"`)                                                                           |
| no sheet node for the bar                                                                             | node `filterBar` / `b.filterBar(key, rect, chips, { sort, sheetLabel })`                                                               |

## modstore

| Old                                                                                                                  | New                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mc-filter-chip` `label`, `count`, `selected`, `mark`, `size`, event `mc-press`                                      | same props; the event is now `mc-activate { key: value }` (the bar still re-raises `mc-activate { key, id }`); new `disabled`, `count-always`, `value`                          |
| `mc-filter-bar` `chips: FilterChip[]`, `prefix`, `rows`, `row-height`, `gap`, `elementOf`, `mc-activate { key, id }` | unchanged; `rows` default is 0 (wrap, no limit) instead of 2, and `row-height` default 0 (chip minimum 44) instead of 40: pass `rows: 2, rowHeight: 40` to keep the packed look |
| `FilterChip { id, label, count, selected, width, mark }` in `shared/filter-bar.types.ts`                             | same shape in `shared/filter.types.ts` (`width` is now optional; new optional `disabled`)                                                                                       |
| `b.filterBar(key, rect, chips, { prefix, rows, rowHeight })`                                                         | unchanged; new options `sort`, `sheetLabel`, `gap`                                                                                                                              |
| node `filterBar` `{ key, rect, chips, prefix, rows, rowHeight }`                                                     | unchanged (it is now `FilterBarModel` plus `key` and `rect`)                                                                                                                    |
| `mc-media-row` and node `mediaRow`, `b.mediaRow(key, rect, row)`                                                     | unchanged; the picture is an `mc-picture-tile` (`subject` set from `focus-y`)                                                                                                   |
| `mc-picture-tile` `letter`                                                                                           | unchanged (now also reachable from `mc-media-row` as before)                                                                                                                    |
| `mc-search-field`, node `search`, `b.search`                                                                         | unchanged                                                                                                                                                                       |
| `McSheet.elementOf` finding bar chips and rail cells; `svg.part { pointer-events: none }`                            | unchanged                                                                                                                                                                       |
| `mc-article`                                                                                                         | unchanged                                                                                                                                                                       |
| `mc-picture-tile` `focusX` / `focusY` (when set directly)                                                            | `subject = { x, y }`                                                                                                                                                            |
| `mc-media-row` and `mc-list-row`                                                                                     | stay two components: the media row has a picture, the list row a round badge                                                                                                    |

## Checklist for a rebase

1. Take `packages/ui/**` and `sheet-builder.ts` (and its test) from the kit; keep the branch own screens and tests.
2. Apply the table for the branch above to every `b.*` call, node literal and element use in its screens.
3. Search the screens for the removed names: `McTabRailTab`, `McPictureTileModel`, `PictureFocusPoint`,
   `SectionHeaderSize`, `FilterChipModel`, `kind: "section-header"`, `kind: "empty"`, `.heading=`, `.text=` on an
   empty state, `mc-filter` listeners, `b.empty(`.
4. Run `pnpm --filter @mc/ui test`, `tsc` in `packages/ui` and `packages/client`, `oxlint` and `oxfmt --check`.
