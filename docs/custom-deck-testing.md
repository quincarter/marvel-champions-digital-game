# Custom-deck testing

Precon e2e games only prove a card in the deck it ships in. Players also build their own decks in the app and import
them from MarvelCDB, so each wave proves its cards outside their precon too. The per-wave checklist is
[wave-definition-of-done.md](wave-definition-of-done.md) §4b; this page says what each piece depends on and when it
runs. Decided 2026-09-26.

## The pieces

| Piece                                                                                                                                                                                                  | Needs the wave's cards scripted?                     | When                                                              | Effort                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Importer: reprint codes.** MarvelCDB gives a reprinted card its own code (`duplicate_of_code` names the original); it has to resolve to our card id.                                                 | No, card data only                                   | Once, before any decklist fixture                                 | One small `card-data-pipeline` task in `packages/content/src/import/`. The catalog already builds the reprint map (`packages/content/src/data/catalog-codes.ts`).                                                                             |
| **Illegal-deck tests.** Each new identity-specific deckbuilding rule (e.g. Miles Morales's and Peter Parker's kits never mix, MC27 p. 21), each unsupported-identity gate, and the aspect rules.       | No                                                   | Early in the wave, once the card data is emitted                  | Small, tests only. A kit-mix rule is usually enforced already: `validateDeck`'s `other_identity_card` check covers any identity-specific card in another hero's deck (`packages/engine/src/deck.ts`, RRG 1.8 "Identity-Specific Card" p. 23). |
| **Deck builder start state.** `requiredIdentitySet` returns exactly each new identity's precon signature cards.                                                                                        | No                                                   | With the illegal-deck tests                                       | Tiny: one assertion per identity.                                                                                                                                                                                                             |
| **Cards in another hero's deck.** Every new aspect and basic card played through the engine from a Core hero's deck, so a script that assumes its precon hero fails.                                   | Yes, per card                                        | As each hero finishes, in the same task as that hero's precon e2e | Medium once, then cheap: a reusable helper ("seat card X in a Core hero's deck, get it to hand, play it"), then one loop per hero.                                                                                                            |
| **One real MarvelCDB decklist per new hero.** A saved public decklist (MarvelCDB JSON, as a test fixture) imports, is legal, and plays a seeded greedy game (`playToOutcome`) that replays deep-equal. | Yes: setup refuses a deck with unscripted cards      | End of the wave (step 4), once every hero is scripted             | Medium. Finding decklists that use only cards in the pool is the hard part, since many public decks use later packs. Fetching them from marvelcdb.com is confirmed with the user first.                                                       |
| **Random-deck coverage.** Seeded random legal decks from the whole playable pool, greedy games solo and 2-player, no stuck prompt, no uncaught error, deep-equal replay.                               | Only for the cards it uses; it skips unscripted ones | Any time; a backfill task in PLAN.md Phase 6, not per wave        | Largest. The generator and harness are one medium task (`playToOutcome` and `validateDeck` exist). Triage is the real cost: expect a batch of interaction bugs, each needing a ruling check and a fix, so budget it as a small QA wave.       |

## Wave 5 status

Tracked in PR #64, step 4b.

| Piece                                         | Status                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Importer: reprint codes                       | Done (`2a85be15`)                                                                  |
| Illegal-deck tests + deck builder start state | Done (`c767bfe9`), one test file for all six new identities                        |
| Cards in another hero's deck                  | Running with Miles Morales's precon e2e (builds the helper), then each hero pack's |
| One real MarvelCDB decklist per new hero      | Step 4                                                                             |
| Random-deck coverage                          | After wave 5 merges (PLAN.md Phase 6 backfill)                                     |

## Earlier waves (Core–wave 4)

Measured 2026-09-27: 29 heroes, 30 precons, 511 aspect and basic player cards, every one scripted.

| Piece                                                           | State                                                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Importer: reprint codes                                         | Done for the whole pool (`2a85be15`)                                                                                                                                        |
| Precon legality + deck builder start state                      | Every playable precon is checked against the whole pool in `packages/cards/src/playable-precon-legality.test.ts` (legal, `requiredIdentitySet` matches, nothing unscripted) |
| Special deckbuilding rules (Spider-Woman, Gamora, Adam Warlock) | Covered by their own engine tests (`wave2.test.ts`, `off-aspect-allowance.test.ts`, `max-copies-per-title.test.ts`)                                                         |
| Cards in another hero's deck                                    | Done 2026-10-01 (PR #88): a `cross-hero.test.ts` per pack, plus `core/aspects/cross-hero.test.ts` for Core cards from a different Core hero                                 |
| One real MarvelCDB decklist per hero                            | Done 2026-10-01 (PR #88): 29 fixtures run by `packages/cards/src/playable/marvelcdb-decklists.test.ts`                                                                      |
| Random-deck coverage                                            | Done 2026-10-01 (PR #88): `packages/cards/src/playable/random-decks.test.ts`, 12 seeds by default, `MC_RANDOM_DECK_SEEDS=N` for a soak                                      |

## Decklists to use

Real MarvelCDB decklists the user picked for a hero's custom-deck work (the "one real MarvelCDB decklist per hero"
fixture, cross-hero tests). Check the pool against the list again when you pick it up.

| Hero           | Decklist                                                                                                                          | Pool coverage (2026-09-27, per the user)      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Doctor Strange | [Tough Enough: Heroic Ally Swarm 1.0](https://marvelcdb.com/decklist/view/1771/doctor-strange-tough-enough-heroic-ally-swarm-1.0) | Every card is in the pool; use this one first |
| Doctor Strange | [Invoke the Fourth Wall: Break the Game 1.0](https://marvelcdb.com/decklist/view/34506/invoke-the-fourth-wall-break-the-game-1.0) | Tested 2026-10-08 (see below)                 |

### Tested: "Invoke the Fourth Wall: Break the Game"

**Done 2026-10-08** in `packages/cards/src/wave8/doctor-strange-pool-deck.qa.test.ts` (fixture
`packages/cards/src/wave8/fixtures/decklists/doctor-strange-invoke-the-fourth-wall.json`). The deck imports and is
legal, each of the author's four lines plays as printed, and it does not loop: Doctor Strange resolves at most three
Invocations a turn (Spell Mastery, Cloak of Levitation, Stick-To-Itiveness), Wong is used twice (one Get Rage-y),
and Mulligan is once per phase. One interpretation is pinned and open with the owner: a resource card that generates
3 counts as 3 resources spent for Machine Man. The original brief follows.

The user wants game-breaking-deck tests around
[this Doctor Strange deck](https://marvelcdb.com/decklist/view/34506/invoke-the-fourth-wall-break-the-game-1.0)
(asked 2026-10-01): the deck reportedly loops or otherwise breaks the game. It needs 7 packs: Doctor Strange, Wasp,
Vision, Ironheart, Deadpool, Core Set (Black Widow) and Age of Apocalypse (Scarlet Witch). Deadpool and Age of
Apocalypse are not in the playable pool yet. When both land, in the wave that adds the second of them:

1. Save `GET https://marvelcdb.com/api/public/decklist/34506.json` unmodified as a fixture next to Doctor Strange's
   other custom-deck tests, and import it with `parseMarvelCdbDeckJsonText` against the playable pool.
2. Work out the combo from the deck's description and write tests that play it through the engine: that it does what
   the rules allow (cite the RRG and any ruling), and that a repeatable loop cannot hang the engine or the greedy
   driver. RRG 1.8 has no general infinite-loop rule (checked 2026-10-01), so check the rulings file for one first.
3. Run the usual seeded greedy game to an outcome with a deep-equal replay.
