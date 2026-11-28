# mc-decks-sheet-header

The title and the line under it on the "Pick a deck" sheet: the hero's name in the display face (one line, cut with an
ellipsis) and the subtitle ("3 decks. Pick the one this seat plays.", two lines at most). Words only; no events, no stops.

```html
<mc-decks-sheet-header heading="Spider-Man" subtitle="3 decks. Pick the one this seat plays."></mc-decks-sheet-header>
```

| Property   | Type   | Notes                         |
| ---------- | ------ | ----------------------------- |
| `heading`  | string | the title, already translated |
| `subtitle` | string | empty for none                |
