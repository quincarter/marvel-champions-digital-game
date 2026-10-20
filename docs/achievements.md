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

## Data the client must record

Most families read the existing `mc-saves` / `mc-campaigns` rows (outcome, scenario, heroes, difficulty, players,
round). Counts the rows don't hold yet: a game's loss reason (players defeated or scheme completed), heroes defeated
during a game, and a hero's hit points at the win. Those come from the engine's game log at game end, so the save row
gains a small summary; older saves simply don't count toward those achievements.

## Decided

- **Points (owner, 2026-10-20: A).** Achievement points add to the same champion points total that unlocks spend; rank
  reads lifetime points. Exception: the funny "for trying" achievements (losses, heroes defeated, round-1 losses) give
  no champion points. Each unlocks a silly content pack instead, such as a joke Extras picture, a card-back or
  board skin, a funny title or banner line, or a sound sting, so losing still earns something to laugh at.

## Open for the owner

- The names: every title above is a placeholder, and so are the funny packs' contents.
