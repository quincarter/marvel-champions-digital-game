# Progression: unlocks and champion points

**This is a feature of this client, not of Marvel Champions.** Unlocks and champion points are not in the Rules
Reference, the FAQ or any product insert, and they never change how a game plays. Every scenario and hero plays
exactly as printed, whether the player earned it or switched it on. The rules engine (`@mc/engine`) never sees any
of this: progression lives entirely in `@mc/client` (`packages/client/src/progression/`), and it only decides which
precons, scenarios and campaigns the setup screens offer.

The same explanation is in the game, in **Settings ▸ Unlocks ▸ How it works** (`view/progression-guide.ts`). That
screen is built from the constants below, and `progression-guide.test.ts` fails if this document's numbers drift from
them.

## What's always open

- **The Core Set:** all five heroes and all three villains, from the first launch. It has no switch.
- **The player's own decks:** a deck imported from MarvelCDB or built in the deck builder seats whatever hero it's
  for (`Unlocks.deckLock`). Only preconstructed decks are locked, so play unlocks a precon, not the character.

## The unlock path

Content is gated by release wave (`Cycle.id`), in release order (`UNLOCK_WAVES` in `progression/unlocks.ts`). A win
counts at any difficulty, whether it came in a campaign or on its own. An open wave opens its scenarios and its
campaign box; the box's own cast joins at once, and every other hero's precon is the reward for one villain.

| Wave                     | Opens when                              | Heroes                                                                                                                                                      |
| ------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core Set                 | Always                                  | All five, always                                                                                                                                            |
| Wave 1                   | Beat Rhino                              | Captain America (beat Rhino), Ms. Marvel (Klaw), Thor (Ultron), Black Widow (Risky Business), Doctor Strange (Mutagen Formula), Hulk (Breakout)             |
| The Rise of Red Skull    | Beat Rhino                              | Hawkeye and Spider-Woman at once (MC10's cast); Ant-Man (Crossbones), Wasp (Absorbing Man), Quicksilver (Taskmaster), Scarlet Witch (Zola)                  |
| The Galaxy's Most Wanted | Complete The Rise of Red Skull campaign | Groot and Rocket Raccoon at once (MC16's cast); Star-Lord (Brotherhood of Badoon), Gamora (Infiltrate the Museum), Drax (Escape the Museum), Venom (Nebula) |

On the Saga shelf a campaign still follows the shelf's own order (win a volume on Standard to open the next) unless
it was opened by hand. Adding a wave to the app's pool means adding its row to `UNLOCK_WAVES`: `unlocks.test.ts`
fails until every pool wave and every pool hero has a place on the path.

## Champion points

Champion points are a score that makes playing for something worth more than switching it on.

### Earning

Only firsts count, so replaying a villain already beaten earns nothing more.

| Achievement                                      | Points |
| ------------------------------------------------ | ------ |
| First win against a scenario (any difficulty)    | 100    |
| First Expert (or Extreme) win against a scenario | +50    |
| Completing a campaign                            | 500    |
| Completing it as an Expert Campaign              | +250   |

Earned points are never stored. They're derived from the same rows the results history and the Saga shelf read:
`won` saves in `mc-saves` and `won` campaign records in `mc-campaigns` (`progressOf`, `Unlocks.points`).

### Unlocking by hand

A player can unlock something right where they find it locked, or in Settings ▸ Unlocks:

- **Seats:** tapping a locked precon offers to unlock it, then seats it.
- **Scenario select:** a locked scenario's button reads "Unlock · 100 pts".
- **Saga shelf:** a sealed campaign this build can play reads "Unlock · 300 pts", and opens out of the shelf's order.
- **Settings ▸ Unlocks:** a switch for everything, each campaign, each scenario and each hero.

Every one of them goes through the same confirm (`scenes/unlock-confirm.ts`).

| Unlocked by hand  | Cost                         |
| ----------------- | ---------------------------- |
| One hero's precon | 150                          |
| One scenario      | 100                          |
| One campaign      | 300 (its cast comes with it) |

- Points are spent, never borrowed: an unlock the player can't afford is refused (`Unlocks.canAfford`, and
  `unlockByHand` leaves the preferences unchanged), so the total never goes below zero. The confirm says how many
  more points are needed and names the free way in.
- Anything that costs points asks first. The confirm popup gives the cost, says it isn't refunded, and names the
  villain that would unlock it for free.
- Anything already earned by play is free, and so is anything already paid for once.
- Each thing is charged once and never refunded. Switching it off and on again doesn't charge twice.
- The Unlocks header lists where every earned point came from ("First win: Rhino (+100)"), and says "No points yet"
  until the first win.

### Unlock everything: points off

"Unlock everything" is free. It's the way out of progression altogether: every wave, hero, scenario and campaign
opens, nothing is charged, and champion points read "off" while it's on. It still asks first, since it's a manual
unlock. Switching it off goes back to earning and spending points, and anything earned meanwhile stays earned.

What was switched on, and what it cost (`UnlockPrefs.charges`), is saved in `localStorage` under `mc-unlocks`,
stamped with `UNLOCK_PREFS_VERSION`. Clearing the app's saved data resets it; earned points survive in IndexedDB.
Version 2 made "Unlock everything" free, so charges saved before it (when it cost points) are dropped on load.

### Where the player sees it

- **Settings ▸ Unlocks:** the points total, what was earned and spent, the switches, and **How it works**.
- **Settings:** the Unlocks row's summary line leads with the points total.
- **Game over:** a win shows a ribbon with the points it earned and anything it unlocked.

## For development

`?unlock=all` in the URL opens everything for one page load. It is never saved and never charged, and it works
alongside the `?screen=…` dev jumps.
