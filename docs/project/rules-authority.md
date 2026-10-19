# Rules authority

How this game decides what the rules are, which source wins when two disagree, and where every source lives.

## Order of authority

When sources disagree, the higher one wins:

1. **The latest Rules Reference Guide (RRG), v1.8 (July 2026)**, for general rules and timing.
2. **Current official errata**, for individual cards.
3. **FFG rulings issued after RRG v1.8**, unless a later rules update contradicts them.
4. **Older FFG rulings**, where they agree with v1.8. Where v1.8 contradicts one, v1.8 wins. FFG treats rulings sent
   through its contact form as preliminary until a Rules Reference update includes them.
5. **The engine's own call**, only where no official source answers the question.

Community sites such as Hall of Heroes and MarvelCDB point into this material, but they are never an authority on
their own. When a community writeup disagrees with the RRG or an FFG ruling, the RRG or the ruling wins, and an
implementation is checked against the primary source before it is trusted.

## Resolving a conflict

- **The higher source wins, every time.** A card behaves the way the highest source that answers the question says.
- **Conflicts are written down, not picked silently.** Where sources disagree, the code that implements the winner
  carries a comment naming both sources and why one wins, so the next person to read it sees the conflict too.
- **Rulings are cited by date.** A ruling is cited by its date heading in Hall of Heroes' transcription, next to the
  RRG page it clarifies (for example "FFG ruling, January 17, 2026; RRG v1.8 p. 12").
- **Engine calls are decisions, not guesses.** When no official source answers a question, it goes to the maintainer
  as a short multiple-choice question with a recommended default. The answer is recorded in that wave's spec
  (its §4.1 decisions table, in [`docs/`](..)) and in the pull request that implements it, and the code cites it.
- **A newer source can overturn an older call.** When a new RRG, errata or ruling answers something the engine had to
  decide, the official answer replaces the engine's call and the tests tied to it are updated.
- **Rulings are tested.** A ruling the game follows gets a regression test beside the card or engine module it
  affects, so a later change can't quietly undo it.

## Where the sources are

### Rules Reference Guide

The current RRG is in this repository: [`mc_rulesreference_v18_compressed.pdf`](../../mc_rulesreference_v18_compressed.pdf)
(v1.8, July 2026). Rules citations in the code and the docs use its page numbers.

Hall of Heroes hosts every version:

| Version                       | Link                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1.8 (July 2026), current** | [mc_rulesreference_v18_compressed.pdf](https://hallofheroeslcg.com/wp-content/uploads/2026/07/mc_rulesreference_v18_compressed.pdf)         |
| v1.7 (December 2025)          | [mc_rulesreference_v17-compressed.pdf](https://hallofheroeslcg.com/wp-content/uploads/2025/12/mc_rulesreference_v17-compressed.pdf)         |
| v1.6 (July 2024)              | [mc_rulesreference_v16_compressed.pdf](https://hallofheroeslcg.com/wp-content/uploads/2024/07/mc_rulesreference_v16_compressed.pdf)         |
| v1.5 (May 2023)               | [mc_rulesreference_v15-compressed.pdf](https://hallofheroeslcg.com/wp-content/uploads/2023/05/mc_rulesreference_v15-compressed.pdf)         |
| v1.4.2 (undated)              | [mc_rulesreference_v14_2_compressed_1.pdf](https://hallofheroeslcg.com/wp-content/uploads/2021/05/mc_rulesreference_v14_2_compressed_1.pdf) |
| v1.4 (April 2021)             | [mc_rulesreference_v14.pdf](https://hallofheroeslcg.com/wp-content/uploads/2021/04/mc_rulesreference_v14.pdf)                               |
| v1.3                          | [mc_rulesreference_v13.pdf](https://hallofheroeslcg.com/wp-content/uploads/2020/04/mc_rulesreference_v13.pdf)                               |
| v1.2                          | [mc_rulesreference_v12.pdf](https://hallofheroeslcg.com/wp-content/uploads/2020/04/mc_rulesreference_v12.pdf)                               |
| v1.1                          | [mc_rulesreference_v11.pdf](https://hallofheroeslcg.com/wp-content/uploads/2020/04/mc_rulesreference_v11.pdf)                               |
| v1.0                          | [marvelrrg10.pdf](https://hallofheroeslcg.com/wp-content/uploads/2020/09/marvelrrg10.pdf)                                                   |

What changed between versions is in Hall of Heroes'
[RRG changelog](https://hallofheroeslcg.com/marvel-champions-ffg-rrg-changelog/). The
[Learn to Play](https://hallofheroeslcg.com/wp-content/uploads/2019/12/l2p.pdf) booklet teaches the basics but is
not a rules authority where the RRG says otherwise.

### FFG rulings

FFG's Game Rules Specialist answers rules questions; Hall of Heroes transcribes the answers.

- **Since RRG v1.7 (December 17, 2025 onward):**
  [Latest FFG Rulings (post-RRG 1.7 & 1.8)](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/). A copy
  through August 13, 2026 is in this repository:
  [`marvel-champions-rulings-post-rrg-1-7.md`](../../marvel-champions-rulings-post-rrg-1-7.md).
- **RRG v1.6 era (July 2024 to December 2025):**
  [Latest FFG Rulings (post-RRG 1.6)](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/)
- **RRG v1.5 era:** [Latest FFG Rulings (post-RRG 1.5)](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/)
- **Before RRG v1.5:** [Latest FFG Rulings (pre-RRG 1.5)](https://hallofheroeslcg.com/latest-ffg-rulings/) and the
  [RRG 1.0 to 1.4 rulings and errata](https://hallofheroeslcg.com/official-ffg-rulings/)
- **Overturned rulings:** [Legacy Rulings](https://hallofheroeslcg.com/marvel-champions-lcg-legacy-rulings/), rulings
  a later ruling or RRG replaced. These are kept for history and are not followed.

### Errata, keywords and taboo

- **Errata:** FFG's errata is in the rulings pages above (the RRG 1.0 to 1.4 page carries the early errata). Hall of
  Heroes' [Errata Pack](https://hallofheroeslcg.com/errata-pack/) shows the corrected cards; it is a community
  reference built from official changes, not an official document.
- **Keywords:** Hall of Heroes'
  [Keyword and Mechanic List](https://hallofheroeslcg.com/marvel-champions-lcg-keyword-list/) collects every
  keyword's definition by the product that introduced it. The RRG's own definitions win where they differ.
- **Taboo:** the [Unofficial Taboo list](https://hallofheroeslcg.com/marvel-champions-lcg-unofficial-taboo-list/) is a
  community list, not FFG's, so it isn't part of this order: the game plays cards as FFG printed them, with FFG's
  errata.

### Everything else

[`hallofheroes-llms.txt`](../../hallofheroes-llms.txt) indexes Hall of Heroes' pages: each hero pack and box (release
dates, rules inserts, campaign logs, starter decks), the card database's
[browse page](https://hallofheroeslcg.com/browse/), and the rulings pages above. Per-product rules inserts aren't in
this repository yet.

_Marvel Champions: The Card Game_, its rules and its card text belong to Fantasy Flight Games and Marvel. Hall of
Heroes is a fan site; thanks to it for keeping every version and ruling in one place.
