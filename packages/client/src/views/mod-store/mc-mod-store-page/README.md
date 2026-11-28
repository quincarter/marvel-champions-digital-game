# mc-mod-store-page

The Mod Store, composed: the header, then either the browse view (beta caption, tabs, offline strip, Update all bar, finders, a grid of pack tiles or Credits) or one pack's page, with the first-run heads-up (`mc-mod-notice`) over the lot while it is open. Only composes: every part is an element in `components/mod-store/`.

In: `size` (`wide` | `phone`) and `model` (`ModStorePageModel`, built by `view/mod-store-page-model.ts`). Out: `mc-mod-store` (`ModStoreEventDetail`), the search box's `mc-search` and `mc-search-focus`, `mc-image-error`, and the card hover and Inspect events of the card pictures. Tests: `__tests__/`.
