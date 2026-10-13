# Wave 10 click-through (C20, "Play it")

Played in the real client (Playwright, dev server, `unlock=all`, seed 20261012, real pointer input; a throwaway driver, deleted). Desktop 1440x900 and phone 390x844. Screenshots are `artifacts/qa/wave10-play-<d|p>-...png` (40 kept). Console and page errors were collected throughout: **none** in any run.

Sizes: **blocker** = stops the player or ships a wrong result; **should fix** = a player will stumble; **polish** = noticed, survivable. No blockers were found.

## What was played

- Iron Man + Tigra: deal, 3 rounds on desktop (the driver then stalled; no Game Over), 3 rounds on phone (halted at F2).
- Captain Marvel + Hulkling (protection starter): 4 rounds, conceded; phone: 4 rounds, lost to the scheme (Game Over seen).
- Captain America + Wonder Man: 4 rounds, conceded; phone 4 rounds (concede not driven).
- Spider-Woman + Hercules: lost in round 4 (Game Over seen); phone 4 rounds (concede not driven).
- Custom (Title "Civil War!"): Spider-Woman leader, stages changed, sets changed, Tigra + Wonder Man, one round. Random and Random-and-blind: one round each, then concede. Save and resume.
- Not reached: a player win (no hero won), so the leader's "loses" picture was not seen; "wins" (leader) and concede pictures were.

## Checked

- OK Title shows "Civil War!" right after Campaign; Scenario select lists Iron Man, Captain Marvel, Captain America, Spider-Woman and the Build-your-own tile under the Civil War chip.
- OK each scenario reaches the first turn with its leader on the board ("LEADER · STAGE I"); each was played with a new hero.
- OK Tigra: Undercover Work found Hunted (d-tigra-06); Hunted's minion pick is a sheet of card faces with area tags, a tap chooses (d-tigra-17, p-tigra-10); the minion then shows a HUNTED tag (d-tigra-27).
- OK Hulkling: Shape-Changer, Hulk Shape and Alien Physiology played; the identity lists the Shapeshift upgrade (d-hulkling-46).
- OK Wonder Man: tucking and overpaying through the payment bar; the identity reads "Ionic Physiology · 2 of 3 tucked" and the card "UNDER 2" (d-wonderman-64, -72); confused shows as a hatched THWART button, not colour alone.
- OK Hercules: New Labors revealed Defeat the Hydra on the Lernean Hydra; the identity reads "Gift cards counted: 0" and "Can't use: a Labor card is in play" (d-hercules-83).
- OK "The enemy team chooses" says so: "ENEMY TEAM'S CHOICE · As first player, you choose for the enemy team" (p. 6 quoted); the defend sheet lists No defense / You defend / ally defends with the damage range each (seen in the run).
- OK Concede: Menu, "Concede? This ends the game for the whole table.", "Yes, concede", then Game Over with the leader picture and Play again / Same seed, same hands / Back to title (d-wonderman-77). A scheme win (phone) shows the leader picture too (p-hulkling-26).
- OK Two seats: "OTHER HEROES" strip names the other hero, "1ST PLAYER", "TURN DONE"; the engaged minion carries "VS TIGRA"; each decision sheet carries the owner's chip (d-cust-21, d-cust-27).
- OK Builder: side, leader (two taps: tile, then "Choose this leader"), stage cards, Read card (Inspect), set tiles, review summary, Continue to heroes; the config the game started with matched the review (resistance-spider-woman, stages 56172b/56173b, three sets).
- OK Random and Random-and-blind both reach Review, Table setup and the board; blind hides stage 2 and the four sets ("Modular sets: 4 hidden", "Hidden modular set" rows); nothing hidden surfaced on the board in the round played (d-blind-20, -23). Game Over offers "New random scenario" for both (d-rand-18, d-blind-36).
- OK Save and resume: Save & quit, Title "Continue", reload, Continue, back on the board in round 2 with the same state (d-save-09).
- OK Definition of done 5: Title and Scenario select offer every new scenario; box page "New in Civil War" opens (hero mechanics, scenario mechanics, two Try-it lessons: Wonder Man, Hercules); the Wonder Man lesson opened on the board (d-dod-07); the Rules reference search finds Hinder X, Steady, Teamwork (Avenger), Quickstrike, Guard, Toughness, Hulkling's Shapeshift upgrades, Hercules' Labor and Gift decks, Tucked cards.
- OK Hero art and leader art show on Seats, the board and Game Over (no generated placeholders seen). Exception: F5.
- OK Music: `music/` has no Civil War tracks (only a `gmw` pack track), so the four leaders fall back; no audio error in any console.
- OK Info: only two Try-it lessons exist; Tigra's Hunted and Hulkling's Shapeshift are read pages.

## Findings

**F1, should fix. Villain recap's CONTINUE does nothing while a response prompt is pending** (d-tigra-23-timeout-stuck). After round 2 the recap sat at "Villain phase complete" with a big red Continue; the player-phase-start response (Tigra's On the Hunt) was already pending behind it. Pressing Continue for two minutes changed nothing; SKIP (top right) opened the prompt. A player will think the game hung. Reproduce: Tigra with Hunted minions engaged, play to the end of round 2. Cause is likely the hidden ChoiceOverlay taking input.

**F2, should fix. Phone "Discard 2 to hand size" with 7 cards** (p-tigra-28). The seven cards are fanned in one row about 30 px apart, so only a sliver of each is tappable and none is readable. The 6-card "Discard any cards?" sheet wraps to 3x2 (fine); at 7 it does not.

**F3, should fix (rules question, not fixed). The same sheet says "SELECT 2-7"** for "discard 2". Hand size 5, hand 7: the RRG discards down to hand size, so the maximum should read 2. Engine or sheet limit, check against the rules reference page on hand size.

**F4, should fix. Scenario select keeps a selection the shelf no longer shows** (d-dod-02). After picking the Civil War chip the right panel still shows Rhino ("Scenario stages I - Rhino", "The Break-In!") and Choose heroes starts Rhino while the shelf lists Civil War tiles.

**F5, polish. "Build your own" tile has a blank beige picture area** (d-dod-02) where every other tile has art. Reads as a missing image.

**F6, polish. Capped set tiles look locked.** At four chosen sets every other set is hatched with a padlock (d-cust-07); the reason is "Four is the most (MC56 p. 4)", not "locked". A padlock elsewhere means unowned content.

**F7, polish. Neither the Continue label nor the Pause status line says what was built.** Label: "Continue - Civil War: Captain America · Hercules / Leadership · round 2" (d-save-08); status: "ROUND 2 · PLAYER PHASE · HERCULES" (d-save-07). A custom game with changed stages and sets reads the same as the ready-made one.

**F8, polish. LOG panel is empty after resume** ("What happens at the table is written here", d-save-09) though the Full game log in Pause holds the history.

**F9, polish. Labor attachment is truncated.** The host minion's label reads "DEFEAT THE HYDRA · HERCULES'S..." (d-hercules-83). The Labor pile is a card back "DECK 2" captioned with the active Labor's name, which reads as if the pile were that card (d-hercules-101).

**F10, polish. Enemy-row and exhausted cards are too small to read at 1440x900.** Minions draw at about 85 px wide, exhausted upgrades turn sideways (d-hulkling-46, d-tigra-27). Stats read; text needs Inspect. No "engaged with" label in a solo game (not needed); the two-seat label "VS TIGRA" is good, but a game with two minions on different heroes was not tried.

**F11, polish. Game Over's "How it went / Where it went wrong" is a large black box with one line** (d-hercules-103, d-wonderman-77, phone p-hulkling-26).

**F12, polish (confirm intent). Blind Table setup shows the deck's type breakdown** (Minions 8, Side schemes 5, Treacheries 17, Attachments 7) for the whole deck, hidden sets included (d-blind-23). The set names are hidden but the mix is a partial reveal.

**F13, polish. Stage Inspect footer overprints** ("CW · 141A/141B/.../199A 199B SET" runs over "UNIQUE · x1 IN SET") and the "Rules and state" panel is empty (d-cust-06). Stage tile summaries cut mid-sentence (d-cust-04).

**F14, polish. The threat bar's 7 reads like a 1** ("0 / 7 THREAT" looks like "0 / 1", d-tigra-04, d-hulkling-27).

**F15, polish. Phone Hunted sheet title is clipped by Cancel** ("...SEARCH FOR AND AT...", p-tigra-10).

**F16, polish (verify). The glossary has no top-ranked entry for Stalwart, Villainous, Permanent, Restricted.** Searching each returns another entry first (Gene Pool, Facedown boost card, Psi-Knife); Stalwart and Retaliate are printed on the leaders (d-tigra-27).

**F17, info. `hulkling-leadership` is not offered on Seats** (only `hulkling-protection`); the other three heroes' second decks were not looked for.

## What did the board not make clear?

- **Which minion is engaged with whom:** clear for two seats ("VS TIGRA" above the minion). Untried: two minions on two heroes.
- **Which facedown cards belong to whom:** a "FACEDOWN n" tile on the right shows a count only, no owner (fine solo, unverified with two seats). Boost cards show "BOOST ?? x1" on the leader.
- **Whose choice under "the enemy team chooses":** clear. The sheet says whose decision it is and quotes the rule; the owner chip shows in two-seat games.
- **What a Labor card is attached to:** shown, but truncated (F9).
- **How many cards are tucked:** clear, twice (identity line and "UNDER n" on the card).
- **Not clear:** the dead Continue (F1), the unreadable phone discard (F2), and what a saved custom game is (F7).

## Fixed here

- Game log read "You was flipped to alter-ego form." after a flip by an effect (seen at d-hulkling-46). `packages/client/src/view/log-lines.ts` now says "You were flipped"; `log-lines.test.ts`, `log-lines-coverage.test.ts` and `log-lines-gaps.test.ts` pass (37 tests). Not committed; needs a changie fragment with the commit.
