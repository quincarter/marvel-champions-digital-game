# FFG rulings received directly

Answers the owner received from FFG's rules specialist by email, for questions the Rules Reference and the published
rulings did not settle. They rank as FFG rulings issued after RRG v1.8 (tier 3 in CLAUDE.md's authority order): FFG
calls them preliminary until a Rules Reference update includes them, and a later rules update wins over them. Cite one
by its date and card, and link the spec question it settles.

Add each new answer as its own section, newest first: the date, the card and its text, the question as sent, the
answer, and what in the game follows it.

## 2026-11: Public Support (60163b, High), full removal only

- **Source:** email from Alex Werner, FFG rules specialist, answering the owner's question of 2026-10-20.
- **Card:** Public Support (High), Fear No Evil: "Interrupt: When an enemy would be given a facedown boost card,
  remove 1[per_hero] support counters from here instead."
- **Question:** with fewer than 1[per_hero] support counters on Public Support, can the Interrupt still replace the
  give (removing what is there), or only when the full number can be removed?
- **Answer:** only when the full 1[per_hero] counters can be removed. The full effect must resolve for the replacement
  to happen; with fewer counters the boost card is given as normal. FFG added that they will consider updating the
  Rules Reference's Replacement Effects section to clarify this, which suggests it is meant as the general rule for
  replacement effects, not a reading of this card alone (the email does not say so outright).
- **In the game:** `packages/cards/src/wave11/fne/scenarios/kingpin.ts` (`60163b.public-support-interrupt`) is offered
  only while Public Support has at least 1[per_hero] counters. Settles spec question 207 in
  `docs/phase7-wave11-scenarios.md` §4.1 (it replaced a provisional partial-removal reading); issue #829.
