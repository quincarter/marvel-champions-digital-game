# Achievements, ranks and the Title trophy shelf (draft)

_Owner request, 2026-10-20 (PR #251, client step). Draft for the client step to build; names are placeholders the owner
can swap._

Like [`progression.md`](progression.md), this is a feature of this client, not of Marvel Champions: it never changes
how a game plays, and the rules engine never sees it.

## What exists today

Champion points (`progression.md`, "Champion points") are already a derived score: firsts only (a scenario's first
win, its first Expert win, a campaign, an Expert campaign), never stored, read from the `won` rows in `mc-saves` and
`mc-campaigns`. Points can be spent to unlock content by hand.

## What this adds

1. **Achievements.** A long, attainable list, each one derived from the save history the way champion points are
   (nothing to farm, nothing stored but the game records themselves). Each has a name (often cheeky), a description, a
   progress bar where it counts something, and a points value that feeds the same champion points total.
2. **Rank.** A title earned from the **lifetime** points total (points earned, not the balance left after spending on
   unlocks), shown on the Title screen and in the Trophy Room.
3. **Trophy shelf on the Title.** The rank, the points and a bar to the next rank in a corner badge; earned Extras art
   joins the Title's picture rotation; a rank-up plays a short fanfare the next time the Title shows.
4. **Trophy Room.** One screen off the Title (and Extras) listing every achievement, earned and locked; a locked one
   says how to earn it. Grouped by: wins, boxes and campaigns, heroes, Expert, feats, and the funny ones.

## Ranks (placeholders)

| Rank | Title                   |
| ---- | ----------------------- |
| 1    | Sidekick in Training    |
| 2    | Neighborhood Watch      |
| 3    | Costumed Vigilante      |
| 4    | Street-Level Legend     |
| 5    | Avengers Reserve        |
| 6    | Team Leader             |
| 7    | Living Legend           |
| 8    | Cosmic Powerhouse       |
| 9    | Ultimate Champion (all) |

Thresholds are set so the last rank needs every achievement and every scenario and campaign first; the others are
spread so a new player ranks up within the first few sessions.

## Achievement families (starter list)

- **Battles won (tiered):** 1, 5, 10, 25, 50, 100, 250 wins.
- **Villains:** beat each villain once; beat every villain of a box; beat every villain in the pool.
- **Boxes and campaigns:** complete each campaign; each on Expert; complete every campaign.
- **Heroes:** win with each hero; win with every hero of a box; win with 10 / 25 / all heroes; win with each aspect.
- **Expert and Heroic:** first Expert win; Expert wins against every villain of a box; a Heroic win.
- **Feats:** win with a hero at exactly 1 hit point; win in round 1 or 2; win solo against a box's finale; win a
  four-player game; win with no allies played.
- **The funny ones (losses count too):** lose 10 / 50 / 100 games ("Glutton for Punishment", "Professional Punching
  Bag", "Thanos Sends His Regards"); have heroes defeated 25 / 100 times ("Respawn Pending"); lose to the main scheme
  completing 10 times ("Read the Room"); lose on round 1 ("Speedrun (Wrong Direction)"); win with Hulk at 1 HP
  ("Gamma-Ray Overdose").

- **Team-up stories (earned mini comics):** win with a specific pair seated together to unlock a short story extra.
  First: Thor and She-Hulk together unlocks "Worthy of a Second Date?" (owner, 2026-10-20), the misadventure from Jason
  Aaron's _Avengers_ #11 (2018). The extra is a four-page excerpt (`art/side-stories/thor-she-hulk-badlands-date/`) shown
  with a bibliography (title, issue, year, creators, publisher, link) (owner, 2026-10-20). They are read on their own
  Extras tab, Side Stories, apart from the campaign issues, in the comic reader: panel by panel so the printed
  lettering is readable, each page ending on the whole page (owner, 2026-10-22). A new one is a row in
  `content/side-stories.ts` (its pages and their panel rectangles) and a folder of pages. Every pair with a picture in
  `art/teamups/` also has a trophy (#615; `progression/team-up-trophies.ts`) that opens the picture in Extras ▸ Artwork.

- **Doppelgangers (#615):** beat a villain who shares a hero's name with that hero seated. The pairs are read from the
  cards, so a new box needs no row; a villain drawn per game (Shadowland's Daredevil) is left out, since the save does
  not record the draw. Earning all of them is "Hall of Mirrors".
- **Arch-enemies (#615):** beat a hero's great foe with that hero seated, one row each in `ARCH_ENEMIES`
  (`progression/achievements.ts`). Beating all of them is "Every Score Settled".

- **Earned items already built:** PR #294 (Ultron Drone art, stacked on this branch) adds an earned item, "Drone art",
  toggled under Settings > More > Earned items and for now gated on "win a game against Ultron" read from the save
  history. When the achievements list is built, add a Drone achievement for that win and point the item's unlock in `progression/earned-items.ts` (setting `ultronDroneArt`) at it in place of `scenarioWon ultron` (owner, 2026-10-20). `EARNED_ITEMS` (each with an `ExtrasUnlock` read through `Extras.isOpen`; `earnedItems()` / `applyEarnedItems()` in `progression/progression.ts`; Settings > More "Earned items" via `earnedItemRowInfoOf`) is meant to hold every cosmetic reward, so the funny joke packs and other achievement rewards become earned items too, likely through an achievement kind of `ExtrasUnlock`.

## Unlock popup

Built 2026-10-20 (owner's request): an Xbox-style "Achievement unlocked" popup (`scenes/achievement-toast.ts`, model in
`view/achievement-toast.ts`). A gold trophy badge with the MC monogram pops in, a bar opens out of it with the name and
what it earned, holds, and folds away, with `audio/sfx/achievement-unlocked.mp3` (Universfield's "Level Complete").
Two or more achievements at once stack into one popup ("5 achievements unlocked", their points summed); a tap (or
click) opens it into a list of them all, with Collapse (back to the popup, which then holds its full time again) and
Dismiss; the list grows out of the popup and shrinks back into it, keeps one size and sits in the middle whatever the popup's own settings; Escape or a tap outside the list collapses it, and every screen under it holds its input while it is open.
What opens in Extras uses the same popup on its own beat after the achievements' ("New song earned", or "5 extras in
the vault" stacked), with the Extras sting; it replaced the music button's "New song earned" notice (owner,
2026-10-20). It checks once a second against what the last `refreshUnlocks()` read (`earnedAchievementIds()`), remembers what it
announced in `mc-achievements-seen` (`platform/achievements-seen.ts`; a first run records silently), queues several,
and folds more than four at once into one summary. It takes no input.

Settings ▸ More ▸ Achievements: **Achievement popup** (Off, 3, 5, 8 or 10 s; default 5 s) and **Popup position**
(Title bar, Top, Middle, Bottom; default Title bar), and **Popup size** (Small, Medium, Large; default Small; owner,
2026-10-20). Picking any of them shows a sample.

**How to Play (owner, 2026-10-20):** "Studying Like Doctor Strange" (`feat-how-to-play`, 50 points, with a progress
bar) for finishing every How to Play row: the five basics lessons and each aspect's Try it
(`view/how-to-play-model.ts#howToPlayProgressOf`, read from the guide prefs into `AchievementHistory.howToPlay`). The
popup re-reads achievements whenever the guide prefs change, since a lesson finished changes no save.

**Hero lines and Unlock everything (owner, 2026-10-20):** each hero has a "played" achievement (`played-<identity>`,
10 points) for finishing a game as them, win or lose, named for their line in `progression/hero-quotes.ts` (the owner
chose Captain America's "I can do this all day", Thor's "Another!", Iron Man's "I am Iron Man", She-Hulk's "I object"
and T'Challa's "Wakanda Forever!"; the rest were drafted for the owner to edit). "Sometimes You Gotta Run Before You Can
Walk" (`unlock-everything`, funny family, a joke pack) is earned by turning on Settings ▸ Unlocks' "Unlock everything",
remembered in `mc-unlocked-everything` after it is turned off again.

**I Love You 3000 (owner, 2026-10-20):** `iron-man-thanos`, 100 points, for winning against Thanos with Iron Man's seat
dealing the last damage. The save row's summary now records `finalBlowBy` (the identity of the seat whose card dealt the
villain its last damage, from the game record's last blow); games saved before it don't count.

## Data the client must record

Most families read the existing `mc-saves` / `mc-campaigns` rows (outcome, scenario, heroes, difficulty, players,
round). A finished game's save row also carries a `summary` (`engine/game-summary.ts`, written by `session-core.ts`):
the loss reason (players defeated, scheme completed, conceded), heroes defeated, each winner's identity and hit points
(and whether in hero form), and allies played. Saves from before it simply don't count toward those achievements.

## Decided

- **Points (owner, 2026-10-20: A).** Achievement points add to the same champion points total that unlocks spend; rank
  reads lifetime points. Exception: the funny "for trying" achievements (losses, heroes defeated, round-1 losses) give
  no champion points. Each unlocks a silly content pack instead, such as a joke Extras picture, a card-back or
  board skin, a funny title or banner line, or a sound sting, so losing still earns something to laugh at.

## Open for the owner

- The names: every title above is a placeholder, and so are the funny packs' contents.

## Multiplayer and table feats (#909, 2026-11-21)

Issue #909 plus bluefireF5ran's (GitHub) "Together" and "Feats" lists, all taken in by the owner (2026-11-21). The build
map is [`multiplayer-achievements-plan.md`](multiplayer-achievements-plan.md). Stats pages for Friends, Competitive and
Epic, unlockable themes and seasonal challenges are later issues.

### Ground rules

- A game with Cheats on, and any adjusted game (#791), earns no points, achievements or stats.
- Watchers earn only Front Row Seat. A device that held no seat in a room game earns nothing from it but a Game Night
  Host count.
- A device earns only for the seats it held at the end of the game, plus any it took over. A game played alone has
  every seat mine, so single-player results do not change. Only room rows narrow to my seats.
- A guest's room game counts toward their own hero's stats like a solo game.
- Competitive games are played-only: no scenario firsts, hero win rates or global stats. They earn only the competitive
  achievements. A competitive game played hot seat (this device held both teams) earns none (provisional, owner).

### New achievements

Points follow the existing scale. "Funny" ones give no points and unlock a silly pack.

**Playing together (family `together`)**

| id                        | name                       | pts      | how                                                                             |
| ------------------------- | -------------------------- | -------- | ------------------------------------------------------------------------------- |
| `room-four-players`       | Assemble!                  | 100      | Win a room game with four players.                                              |
| `room-tag-team-10`        | Tag Team                   | 150      | Win 10 room games with the same friend (by online name).                        |
| `room-takeover-away`      | No One Left Behind         | 100      | Win after taking over the seat of a player who stepped away.                    |
| `room-takeover-left`      | I Got This                 | 100      | Win after taking over the seat of a player who left the room.                   |
| `room-chat-50`            | Talk It Out                | 50       | Send 50 chat messages in room games.                                            |
| `room-strict-5`           | Strict Rules Club          | 100      | Win 5 room games played with Strict rules.                                      |
| `together-avenge-me`      | Avenge Me!                 | 50       | Win after one of your heroes was defeated.                                      |
| `together-upgrade-given`  | It's Dangerous to Go Alone | 50       | Play an upgrade onto another player's hero.                                     |
| `together-get-behind-me`  | Get Behind Me!             | 50       | Cancel a treachery revealed for another player.                                 |
| `together-human-shield`   | Human Shield               | 50       | Defend another player three times in one game.                                  |
| `together-combat-medic`   | Combat Medic               | 50       | Heal 6 damage from other players' heroes in one game.                           |
| `together-alliance-paid`  | Assemble the Wallets       | 50       | Play a card two or more players paid for together.                              |
| `together-kill-steal`     | Kill Steal                 | 25       | Defeat a minion engaged with another player.                                    |
| `together-care-package`   | Care Package               | 50       | Make other players draw 5 cards in one game.                                    |
| `together-sticky-fingers` | Sticky Fingers             | 50       | Take a card from another player's deck or discard pile.                         |
| `together-oops`           | Oops, That One's Yours     | 0, funny | Put a minion into play that then attacks another player's hero.                 |
| `together-friendly-fire`  | Friendly Fire              | 0, funny | Defeat a side scheme whose damage lands on a friend's hero who was already low. |

The first six read room data. The rest count in a room game and in a game one person plays at several seats: "another
player" is another seat.

**Epic Multiplayer (family `epic`)**

| id                     | name                 | pts | how                                                    |
| ---------------------- | -------------------- | --- | ------------------------------------------------------ |
| `epic-finished`        | Pod Person           | 50  | Finish an Epic Multiplayer game.                       |
| `epic-loki-final-blow` | Shatter the Illusion | 150 | Your table lands the final blow on the shared Loki.    |
| `epic-mangog-remote`   | Mangog Hunter        | 100 | Defeat Mangog with a remote attack from another table. |
| `epic-door-remote`     | Door Stop            | 100 | Clear a door with a remote thwart from another table.  |
| `epic-three-tables`    | Tables Turned        | 150 | Win an Epic game with three or more tables in the pod. |

**Civil War Competitive (family `competitive`)**

| id                        | name              | pts | how                                                                     |
| ------------------------- | ----------------- | --- | ----------------------------------------------------------------------- |
| `competitive-both-sides`  | Pick a Side       | 50  | Play a game on the Registration side and one on the Resistance side.    |
| `competitive-leader-down` | Leader Down       | 100 | Defeat the enemy leader.                                                |
| `competitive-tie-break`   | Tie-Breaker       | 100 | Win a game the tie-break decided.                                       |
| `competitive-no-you-move` | No, You Move!     | 50  | Have the enemy leader's attack on your team moved onto Captain America. |
| `competitive-veteran`     | Civil War Veteran | 250 | Win 5 games with each of the four leaders.                              |

**Watching and hosting (family `hosting`)**

| id             | name            | pts | how                                                                                         |
| -------------- | --------------- | --- | ------------------------------------------------------------------------------------------- |
| `watch-to-end` | Front Row Seat  | 25  | Watch a friend's live game through to the end.                                              |
| `host-10`      | Game Night Host | 100 | Host 10 finished online games (standard and Epic; Competitive does not count, provisional). |

**Feats (family `feats`)**

| id                       | name                 | pts      | how                                                                              |
| ------------------------ | -------------------- | -------- | -------------------------------------------------------------------------------- |
| `feat-full-health`       | Not a Scratch        | 100      | Win with a hero at full hit points.                                              |
| `feat-over-printed-hp`   | Plenty to Spare      | 100      | Win with a hero above the hit points printed on its card.                        |
| `feat-surrounded`        | Surrounded           | 50       | Have 3 or more minions engaged with one of your heroes at once.                  |
| `feat-clean-sweep`       | Clean Sweep          | 50       | Win with no minions left in play.                                                |
| `feat-case-closed`       | Case Closed          | 50       | Win with no side schemes left in play.                                           |
| `feat-overkill-5`        | Overkill             | 100      | Deal 5 or more damage beyond what an enemy had left in one hit.                  |
| `feat-minions-8`         | Bloodthirsty         | 100      | Defeat 8 or more minions in one game.                                            |
| `feat-trophy-case`       | Trophy Case          | 100      | Finish with 3 or more cards in the victory display.                              |
| `feat-deck-reset-2`      | Deck Goes Brrr       | 50       | Run your deck out and reset it twice in one game.                                |
| `feat-stun-defeat`       | Stop, Drop and Punch | 50       | Stun a minion and defeat it in the same turn.                                    |
| `feat-pacifist`          | Pacifist             | 150      | Win without your heroes defeating a minion.                                      |
| `feat-big-spender`       | Big Spender          | 50       | Pay 6 or more resources for one card.                                            |
| `feat-full-supports`     | Saving It for Later  | 100      | Win with 2 or more of your supports still holding all their uses.                |
| `feat-ally-final-blow`   | Giant Slayer         | 100      | Win with an ally dealing the villain's last damage.                              |
| `feat-tough-as-nails`    | Tough as Nails       | 150      | Win with none of your heroes dropping below half their hit points.               |
| `feat-villain-phase-win` | Come at Me, Bro      | 100      | Win during the villain phase.                                                    |
| `feat-lucky-charm`       | Lucky Charm          | 50       | Have 3 attacks in a row against you where every boost card is blank.             |
| `feat-own-obligation`    | Not Today, Life      | 50       | Remove your own hero's obligation from the game.                                 |
| `chain-reaction`         | Chain Reaction       | 0, funny | Reveal 3 encounter cards in a row, each surging into the next.                   |
| `cursed-boosts`          | Cursed               | 0, funny | Have 2 or more boost cards with 3 or more icons turn up against you in one game. |

### The funny ones and their packs

Four new funny achievements, each with a reward pack id as the older funny ones have: Oops, That One's Yours
(`pack-oops-thats-yours`), Friendly Fire (`pack-friendly-fire`), Chain Reaction (`pack-chain-reaction`) and Cursed
(`pack-cursed`). The pack contents are placeholders for the owner to choose, as the older funny packs are.

### First win with friends (provisional, owner choice A)

A champion points bonus for the first room win at each table size, won while holding a seat: 50 for two seats, 100 for
three, 150 for four, once per size (`POINTS.friendsWin` in `progression/unlocks.ts`, read as `friendsWinTables`). Cheats
and competitive room games do not count, and a game seen as both a host row and a guest row on one synced account
counts once, by its game key. It shows in the points breakdown as "First win with friends: N players".

### Rank rescale (provisional, owner choice A)

The existing thresholds are kept. Ranks 3 to 8 are still fractions of the points that existed before #909
(`LEGACY_MAX_LIFETIME_POINTS`), so nobody drops a rank when the new achievements arrive. The top rank, Ultimate
Champion, needs the new maximum (`MAX_LIFETIME_POINTS`), which now includes every multiplayer achievement and the
friends bonus: it needs everything.

### What they read

- **Summary version 7.** A finished game's `summary` gains per-seat counters (`together`, `feats`, `boosts`, who acted)
  and an `endState` (winners' hit points, minions and side schemes left, victory display, full supports, the phase the
  game ended in, the table that defeated Loki) and `competitive`. The summary backfill replays older games to fill them
  in; a save without a counter earns nothing from it.
- **`roomPlay` on the save row** (`engine/room-play.ts`): role, room and game key, mode, the seats this device held,
  friends, takeovers, chat sent, Strict, Cheats, and Epic or competitive details. Absent on a game played alone.
- **A guest's own finished result row** for a room game, so the guest's device has results to read.
- **The local watch history** (`platform/watch-history.ts`, `mc-watch-history`): the live games this device watched to
  their end, for Front Row Seat. It is local and does not sync.

### Provisional owner calls (2026-11-21)

Bonus A (the friends-win points), rescale A (the rank thresholds above), hot-seat competitive earns none, and Game Night
Host excludes competitive games. All four stand until the owner says otherwise.
