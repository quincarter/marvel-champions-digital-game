# Release notes in Spanish

A report's Spanish lives in `reports/<version>.json`: each block of `public/releases/<version>/index.html` as a key, with
its inline tags, and its Spanish as the value. The build writes `index.es.html` from the two, so there is no Spanish page
to edit. `src/view/release-report-spanish.test.ts` fails if a block has no Spanish or a key has no block, so changing an
English line means changing its key. The rules below apply to these too.

One `<version>.md` per release, read by the release history page (`view/release-history-notes.ts`). A release with no
file here shows in English, so a missing translation is never an error.

## Shape

```markdown
## The release's headline, in Spanish

One paragraph: the announcement, in Spanish.

![What the image shows, in Spanish](the same https URL as the English image)

## [v0.40.0] - 2026-10-31

### Added

- A changelog line, in Spanish.
```

- The part above `## [v` is the headline, summary and images. The English comes from
  `docs/screenshots/releases/<version>/release-notes-header.md` or `docs/releases/history.json`. Include images only if
  the English has them, with the same URLs in the same order.
- The part from `## [v` down is `.changes/<version>.md`, line for line. Its version, date, `### ` headings and number
  of items stay exactly the same, and the `### ` headings stay in English (`Added`, `Fixed`): the page translates them.
  An item stays on one line.
- `src/view/release-notes-es.test.ts` fails if a file drifts from its English: a different date, section, item count,
  `#123` or `@handle`.

## How to translate

Neutral Latin American Spanish, addressed as `tú`, in plain short sentences. Keep the tone of the English: a person
telling players what changed. No em dashes.

**Stays exactly as written:** version numbers, `#123`, `@handle`, `u/name`, URLs, `` `code` ``, file names, key and
button names (`LB`, `Enter`), numbers, Markdown marks and the ▸ arrows.

**Stays in English, because the game shows it in English:**

- Card, hero, villain, scenario, set, pack and campaign box names: Spider-Man, Rhino, The Rise of Red Skull, Hela.
- Keywords: Guard, Overkill, Retaliate, Toughness, Quickstrike, Surge, Peril, Restricted, Stalwart, Steady, Uses.
- Screen, button and setting names: Settings ▸ More, Your stats, Take Your Seats, Cards left, Trophy Room, Pause,
  New game, Use this art. Give the English label as it is. Add a Spanish gloss in brackets only where a reader
  couldn't follow without one.
- Developer names: engine, DSL, CI, e2e, Vitest, Tauri, Phaser, Worker. Names of code things stay in `code`.

**Game terms:**

| English            | Spanish               | English          | Spanish           |
| ------------------ | --------------------- | ---------------- | ----------------- |
| card               | carta                 | hero / alter-ego | héroe / álter ego |
| deck               | mazo                  | villain          | villano           |
| hand               | mano                  | minion           | esbirro           |
| discard pile       | pila de descartes     | ally             | aliado            |
| encounter deck     | mazo de encuentros    | support          | apoyo             |
| encounter card     | carta de encuentro    | upgrade          | mejora            |
| main scheme        | plan principal        | event            | evento            |
| side scheme        | plan secundario       | resource         | recurso           |
| threat             | amenaza               | obligation       | obligación        |
| thwart             | frustrar              | treachery        | traición          |
| attack / defend    | atacar / defender     | attachment       | vinculada         |
| damage             | daño                  | environment      | entorno           |
| exhaust / ready    | agotar / preparar     | nemesis          | némesis           |
| stunned / confused | aturdido / confundido | boost            | potenciación      |
| round / phase      | ronda / fase          | modular set      | set modular       |
| villain phase      | fase de villano       | scenario         | escenario         |
| hero phase         | fase de héroe         | campaign         | campaña           |
| expert / standard  | experto / estándar    | ruling           | resolución        |
| Rules Reference    | Referencia de Reglas  | errata           | errata            |
| scan               | escaneo               | release          | versión           |
| save               | partida guardada      | report (a bug)   | reportar          |
| phone / tablet     | teléfono / tableta    | controller       | mando             |
| mouse / keyboard   | ratón / teclado       | screenshot       | captura           |
| fix                | corrección            | feature          | función           |

Rewrite a sentence rather than translate it word for word. The translation is ours, not an official one, so use a term
from this table even if a card prints another.
