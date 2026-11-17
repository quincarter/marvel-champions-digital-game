## Take It Back, Set It Right

A misclick or a bug no longer has to cost you the game. Undo now reaches past the start of your turn, a draw, a reveal and the villain phase, one move per press, and Settings ▸ Gameplay ▸ Undo past your turn picks Allow, Warn or Off. Pause ▸ Manual adjust corrects the table by hand: damage, threat, counters, statuses, exhausting and readying, discards, a draw and your hero's form. Both came from @sgaon42's request (#791, #793), and a game you change that way stops counting toward stats and achievements. Giant Strength now waits for Giant hero form, thanks to GarethMagis on Discord (#794), and One Way or Another draws only when its search finds a side scheme, thanks to @javgoro's report (#795). Thank you for playing!

**[Read the full v0.49.0 report on the site ↗](https://champions-digital-game.com/releases/v0.49.0/)**: Undo past your turn and its three settings, Manual adjust, how adjusted games stay out of your stats, the fixes and the thank-you wall.

**[Lee el informe completo en español ↗](https://champions-digital-game.com/releases/v0.49.0/index.es.html)**

![The numbers: Undo reaches back to move 1, three Undo choices and three reports answered](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/38b885b998a1334b0051a1f5f47a763af5181759/docs/screenshots/releases/v0.49.0/v0-49-0-release-01-the-numbers.jpg)

![Undo past your turn: the Allow, Warn and Off setting, the same draw on a rewind, and Jump to a moment](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/38b885b998a1334b0051a1f5f47a763af5181759/docs/screenshots/releases/v0.49.0/v0-49-0-release-02-undo-past-your-turn.jpg)

![Manual adjust: the target list on desktop and phone, a hero's adjustments and the warning before the first one](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/38b885b998a1334b0051a1f5f47a763af5181759/docs/screenshots/releases/v0.49.0/v0-49-0-release-03-manual-adjust.jpg)

![Fair stats, either way: Pause marks an adjusted game, and the log names each correction](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/38b885b998a1334b0051a1f5f47a763af5181759/docs/screenshots/releases/v0.49.0/v0-49-0-release-04-fair-stats-either-way.jpg)

![You asked, we fixed: Giant Strength waits for Giant form, reported by GarethMagis, and One Way or Another needs a side scheme, reported by @javgoro](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/38b885b998a1334b0051a1f5f47a763af5181759/docs/screenshots/releases/v0.49.0/v0-49-0-release-05-you-asked-we-fixed.jpg)

![Thank you to @sgaon42, GarethMagis and @javgoro](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/38b885b998a1334b0051a1f5f47a763af5181759/docs/screenshots/releases/v0.49.0/v0-49-0-release-06-thank-you.jpg)

![Code shipped since v0.48.0](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/38b885b998a1334b0051a1f5f47a763af5181759/docs/screenshots/releases/v0.49.0/v0-49-0-release-07-code-shipped.jpg)

---

## [v0.49.0] - 2026-11-17

### Added

- Undo now reaches past the start of your turn, a draw, a reveal or the villain phase, one move at a time. Settings ▸ Gameplay ▸ Undo past your turn picks Allow, Warn (the default: a warning you acknowledge first) or Off. A game where you undo that far no longer counts toward stats or achievements (#791).
- Pause ▸ Manual adjust: correct the table by hand after a bug or a misclick (draw or discard a card, add or remove damage, threat, counters or a status, exhaust or ready a card, flip your hero). An adjusted game no longer counts toward achievements and stats (#791).
- An exported game log, a shared replay and an issue report say when the game was adjusted by hand or undone past a reveal (#791).
- The v0.49.0 release report has its own page on the site, at /releases/v0.49.0/

### Fixed

- Ant-Man's Giant Strength is only offered after changing to Giant hero form, and Ant-Man's Helmet only offers the response that matches the new form (#794).
- The release history e2e specs pick the newest release and report instead of v0.40.0, so a new release no longer breaks them (#802).

### Engine

- A new adjust command carries Manual adjust's table corrections through the game log, so saves, rewinds and replays keep them (#791).

### Special thanks

- @sgaon42 reported #791.
- GarethMagis reported #794 on Discord.
