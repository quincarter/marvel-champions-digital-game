# Wave 9 handoff (cycle 9, Agents of S.H.I.E.L.D.)

For any session picking up the Wave 9 PR, local or cloud. The PR body has the checklist; this page carries how to
resume, the scope, and anything decided along the way. Rules for running agents are the same as earlier waves
([phase7-wave5-handoff.md](phase7-wave5-handoff.md) "Rules for agents" and "Lessons from review",
[phase7-wave8-handoff.md](phase7-wave8-handoff.md)) and CLAUDE.md "How to split work across agents". Started
2026-10-09.

## Resuming

- **Branch:** `feature/wave-9`, off `main` at 1a7290af (v0.18.0, #107; Wave 8 is #103, merged
  2026-10-09). Everything finished and verified is pushed there; each verified commit goes up as it lands.
- **Read first:** the PR checklist, this page, then `docs/phase7-wave9-sources.md`, `docs/phase7-wave9-data-survey.md`
  and `docs/phase7-wave9.md` once they exist.
- **Definition of done:** [wave-definition-of-done.md](wave-definition-of-done.md), including §4b (custom decks) and
  Guided mode coverage in §5. The wave ships the MC50 Agents of S.H.I.E.L.D. campaign in the same PR.
- **Order of work** (as waves 5 to 8): sources doc and data survey → spec (`game-rules-architect`, in passes: the box
  and campaign first, then the hero packs, then Trickster Takeover) → schema changes and `aos` / `tt` emitted →
  engine primitives one at a time (one engine agent at a time) → scripting per hero / per scenario (≤ 3 agents, one
  small task each) → rules QA → custom decks → client wiring and Guided mode → campaign → progression → shipping.
- **Push often (owner, 2026-10-09).** Usage is short, so every verified piece is pushed at once and the PR's top
  section and working notes are updated with it, so any session can resume from GitHub alone.

## The push hook is removed on this branch (owner, 2026-10-09)

The owner asked for the e2e pre-push hook to be off until the client step is in place. `.githooks/pre-push` is deleted
on this branch (its last version is on `main` at 1a7290af); `.githooks/e2e-gate.sh`, `pre-commit` and `commit-msg` are
untouched, so `pnpm e2e:verify` still runs the whole suite on demand. `pnpm check` runs before every push that changes
`packages/`.

**The hook must be re-added before the wave ships.** Restore it (`git checkout origin/main -- .githooks/pre-push`)
when the client step (definition of done §5) starts landing, so those pushes and the merge go up with the whole
Playwright suite passed. This PR must not merge with the file missing, or `main` loses its gate.

## Rules policy (owner, 2026-10-07, carried over)

Where an official FFG ruling says a card's printed wording gives a result the designers did not intend, the intended
behavior is built, and the spec's §4.1 row cites the ruling by its date heading with the RRG page it clarifies.
Where a ruling and the RRG disagree with no statement of intent, the conflict goes to the owner as a short
multiple-choice question with a recommended default. Known bugs are fixed in the wave, not left as expected-fail
tests.

## Scope

RRG 1.8 Appendix VI, "Limited Environment" (p. 71): "**9.** The _Agents of S.H.I.E.L.D._ campaign expansion, the
_Black Panther Hero Pack_, the _Silk Hero Pack_, the _Falcon Hero Pack_, and the _Winter Soldier Hero Pack_." Our id is
`cycleId("cycle9")`; the four emitted packs' `Cycle` records should be renamed "Agents of S.H.I.E.L.D." when the wave
is emitted. The owner also asked for the Loki scenario pack, **Trickster Takeover** (`tt`, released August 15, 2025
per its Hall of Heroes page), to ship with this wave, as MojoMania shipped with wave 6.

Counts are top-level records in the raw MarvelCDB cache (fetched 2026-09-13), counted by script on 2026-10-09.

| Pack     | Product                      | Type          | Raw cards | Card data today              |
| -------- | ---------------------------- | ------------- | --------- | ---------------------------- |
| `aos`    | Agents of S.H.I.E.L.D., MC50 | Campaign box  | 195       | not emitted (raw cache only) |
| `bp`     | Black Panther (Shuri)        | Hero pack     | 42        | data only (`DATA_ONLY_*`)    |
| `silk`   | Silk                         | Hero pack     | 38        | data only                    |
| `falcon` | Falcon                       | Hero pack     | 42        | data only                    |
| `winter` | Winter Soldier               | Hero pack     | 37        | data only                    |
| `tt`     | Trickster Takeover           | Scenario pack | 66        | not emitted (raw cache only) |

420 cards in all.

**The box (MC50):** heroes Maria Hill (50001a) and Nick Fury (50034a); five scenarios with villains Black Widow,
Batroc, M.O.D.O.K., Citizen V (the Thunderbolts) and Baron Zemo; nine evidence cards (three each of means, motive and
opportunity, a card type the schema does not have yet). Encounter sets in the raw data: Black Widow, Batroc, M.O.D.O.K.,
Thunderbolts, Baron Zemo, A.I.M. Abduction, A.I.M. Science, Batroc's Brigade, Scientist Supreme, Gravitational Pull,
Hard Sound, Pale Little Spider, Power of the Atom, Supersonic, The Leaper, S.H.I.E.L.D., S.H.I.E.L.D. Executive Board,
Executive Board Evidence, plus the two nemesis sets. New keyword per Hall of Heroes: Vulnerable. Rulebook:
`docs/campaign-modes/mc50_rulebook-web.pdf`. The RRG has Agents of S.H.I.E.L.D. FAQ and errata sections
(`mc_rulesreference_v18_compressed.md` lines ~4698 and ~5124).

**Hero packs:** each brings one hero, a nemesis set and one modular set: `bp` Extreme Risk, `silk` Growing Strong,
`falcon` Techno, `winter` Whiteout. `bp` and `silk` carry player side schemes.

**Trickster Takeover:** two scenarios. Enchantress (three stages, main schemes Prime Real Estate and Sovereign
Sorceress) and Loki, God of Lies (the God of Lies villain plus four Loki / Fading Figment double-sided villains, main
schemes Worlds Collide and Mischief and Mayhem; single-table and epic multiplayer per Hall of Heroes), and the
Trickster Magic modular set. FFG rulings that name it: February 28, 2026 (3), March 19, 2026 (2), June 25, 2026 (5),
and the Enchantress entries near line 534 of the rulings file.

Already in the repo:

- Raw MarvelCDB caches: `packages/content/raw/marvelcdb/{aos,bp,silk,falcon,winter,tt}.json`.
- Hero art folders waiting, to be checked by the data survey: `art/heroes/_pending/{50001a-maria-hill,50034a-nick-fury}/`.
- Carried over from earlier waves: a box's scenario obligations are emitted with `encounterSetIds: []` unless the
  normalizer fix made for `mut_gen` / `mojo` is applied to them too; a full re-emit drifts in unrelated fields (image
  extensions, core's sets and `maxPerHost`), so emit pack by pack. Card art is WebP q72 via
  `mise run card-art-compress`, committed once, never in CI.

## Release

`main` is at v0.18.0 (2026-10-09). Wave 9 is a minor release (v0.19.0 unless something else ships first); check
`changie next auto` before merging.

## Tools on this machine

`pdftoppm` is not installed, so the Read tool cannot open PDF pages. Render a page with PyMuPDF instead and read the
PNG: `python3 -c "import pymupdf; d=pymupdf.open('<pdf>'); d[<page-1>].get_pixmap(dpi=130).save('<scratchpad>/p.png')"`.

## Evidence combinations (campaign log, read 2026-10-09)

The log sheet is `docs/campaign-modes/log-sheets/mc50_agents_of_shield_campaign_log.pdf` (the owner re-sent the same
sheet and the same rulebook on 2026-10-09; both were already in the repo). Its "Evidence Combinations" grid, read by
the main session from a PyMuPDF render, by icon color. Means: orange (folder), blue (phone), pink (card). Motive:
green (dollar), black (handshake), yellow (flame). Opportunity: purple (ID badge), red (map pin), blue (shield).
The three lists hold 9 rows each and together cover all 27 combinations exactly once (checked by listing them), so a
means, motive and opportunity always name exactly one board member. Mapping each color to its evidence card
(50185 to 50193) is still to do, from the card scans.

| Means  | Motive | Opportunity | Board member               |
| ------ | ------ | ----------- | -------------------------- |
| orange | green  | purple      | Chief Medical Officer      |
| orange | green  | red         | Chief Medical Officer      |
| orange | black  | purple      | Chief Medical Officer      |
| orange | black  | blue        | Chief Medical Officer      |
| orange | yellow | red         | Chief Medical Officer      |
| blue   | green  | purple      | Chief Medical Officer      |
| blue   | green  | red         | Chief Medical Officer      |
| blue   | black  | purple      | Chief Medical Officer      |
| pink   | green  | purple      | Chief Medical Officer      |
| orange | black  | red         | Chief Surveillance Officer |
| blue   | green  | blue        | Chief Surveillance Officer |
| blue   | black  | red         | Chief Surveillance Officer |
| blue   | black  | blue        | Chief Surveillance Officer |
| blue   | yellow | purple      | Chief Surveillance Officer |
| blue   | yellow | red         | Chief Surveillance Officer |
| pink   | black  | red         | Chief Surveillance Officer |
| pink   | black  | blue        | Chief Surveillance Officer |
| pink   | yellow | red         | Chief Surveillance Officer |
| orange | green  | blue        | Chief Tactical Officer     |
| orange | yellow | purple      | Chief Tactical Officer     |
| orange | yellow | blue        | Chief Tactical Officer     |
| blue   | yellow | blue        | Chief Tactical Officer     |
| pink   | green  | red         | Chief Tactical Officer     |
| pink   | green  | blue        | Chief Tactical Officer     |
| pink   | black  | purple      | Chief Tactical Officer     |
| pink   | yellow | purple      | Chief Tactical Officer     |
| pink   | yellow | blue        | Chief Tactical Officer     |

The sheet also records: each player's identity and remaining hit points; remaining secret counters per board member
for scenarios 1 to 4; scenario 1 minions and side schemes in play; scenario 2 rescued captives; scenario 3 Adaptoid
environments (Flying, Psionic, Sarah Garza, Strong upgrades); scenario 4 surviving Thunderbolts.

## Trickster Takeover reference cards (owner's photos, 2026-10-09)

Two unnumbered rules cards with no MarvelCDB record, in `docs/campaign-modes/mc55-reference-cards/`. Transcribed by
the main session from the photos (checked).

**Shatter the Illusion** (`shatter-the-illusion.png`): "When a Fading Figment is revealed, follow these steps to
shatter Loki's illusion: 1. Remove each shatter counter from Fading Figment, then deal damage to Loki, God of Lies
equal to the number of shatter counters removed this way. 2. Swap the Fading Figment in play with a random set-aside
villain, AVATAR OF LOKI side faceup, then set the hit point dial of that AVATAR OF LOKI villain to its printed hit point
value. 3. Deal each player 1 facedown encounter card."

**Epic Multiplayer Reminder** (`epic-multiplayer-reminder.png`): "Group Pods: A pod is a collection of groups. It is
recommended that each pod not exceed 12 to 16 players, or roughly 3 to 4 groups within the same pod. Per Group Icon:
If on a card in a group's game area, the [per group] icon next to a value multiplies that value by the number of
groups that began the scenario in that pod. Playing in Separate Game Areas: Each player group is in its own game
area. Unless explicitly stated, players, cards, and components in one game area cannot affect another game area.
Cross-Group Communication: Cross-group communication is allowed and highly encouraged!"

So in Single Group Mode the per-group multiplier is 1 (one group began the scenario).

## Epic Multiplayer (owner, 2026-10-09)

Decision: wave 9 supports **Single Group Mode only** for Loki, God of Lies. Epic Multiplayer Mode is planned for the
multiplayer phase, and this wave builds whatever engine and DSL groundwork it can so that phase adds groups and pods
without reshaping the cards: at the least, the per-group value reads a group count from game state (1 in a single
group), and every God of Lies script is written against "this group" rather than assuming one table. To do:
`docs/epic-multiplayer-plan.md` (by `multiplayer-netcode-engineer`, from insert pp. on Epic Multiplayer in
`docs/campaign-modes/markdown/mc55_trickster_takeover.md` and the Epic Multiplayer Reminder card above), a pointer to
it from PLAN.md's multiplayer phase, and the groundwork primitives in spec pass 4 (Trickster Takeover).

## Trickster Takeover promo art (owner, 2026-10-09)

Two 700x620 FFG promo pictures, each with a "© 2025 MARVEL" line at the bottom left, in `art/packs/tt/`:
`cover.png` (Loki enthroned, split with Enchantress casting) and `promo-dance.png` (Enchantress dipping Loki). Planned
use at the client step: `cover.png` as the pack's shelf header on Scenario select (`art/README.md`, `packs/<packCode>/
cover.<ext>`; it would be the first pack cover), and `promo-dance.png` as a win or intro picture for one of the two
scenarios. They are too small and too wide to be the villain portraits, so those are still asked for.
