# Definition of done: a Phase 7 content wave

A wave is one release cycle, in release order: its campaign box, its hero packs and any scenario packs. Now that
campaigns are in the game, **a wave that ships a campaign box is not done until that box's campaign is playable.**
Wave 3 shipped its cards in #30 and The Galaxy's Most Wanted campaign separately in #35; from wave 4 on, both land in
the wave's own PR.

Every box below is checked by the main session itself (tests read, board clicked through), not on an agent's report.

## 1. Spec

- [ ] `docs/phase7-wave<N>.md`: sources, schema decisions, per-pack setup needs, engine primitives with a status each,
      open questions, and what it asks of each agent. The model is `docs/phase7-wave3.md`.
- [ ] Every open question is either answered by the user (recorded in the spec's §4) or has a flagged, implemented
      default the user has seen.

## 2. Card data

- [ ] Every pack in the wave is emitted to `packages/content/src/data/<pack>/`, including the box's campaign cards,
      with each curation correction cited.
- [ ] `WAVE<N>_*` content exports, and `PLAYABLE_CARDS` includes the wave.
- [ ] A precon for every hero, legal under `validateDeck` and `requiredIdentitySet`.

## 3. Scripting

- [ ] Every pack's refs registered, and every registered ref named in a test in its pack folder (the coverage
      guard). Check this by diffing registered ids against test names, not by the agent's claim.
- [ ] No `KNOWN_SKIPPED` entry without a written reason. Campaign cards are scripted in this wave (step 6), so
      "campaign mode deferred" is no longer a valid reason.
- [ ] Recurring mechanics are built as reusable vocabulary, never per card.

## 4. Rules QA

- [ ] `docs/phase7-wave<N>-qa.md`: each pack audited against its card text, the RRG and FFG rulings; 2-player and
      expert games played; every finding fixed or taken to the user.

### 4b. Custom decks (added 2026-09-26)

Precon e2e games only prove a card in the deck it ships in. Players build their own decks and import them from
MarvelCDB, so each wave also proves its cards outside their precon. What each piece depends on, when it runs and
what it costs: [custom-deck-testing.md](custom-deck-testing.md).

- [ ] **Cards in another hero's deck.** Every new aspect and basic card is played through the engine from a Core
      hero's deck, so a script that quietly assumes its precon hero ("your hero" meaning that one identity) fails.
- [ ] **The wave's deckbuilding rules.** Every new identity-specific rule (a kit that can't mix with another, an
      unsupported-identity gate, a new aspect count) has a `validateDeck` test for an illegal custom deck, asserting
      the problem and its player-readable message.
- [ ] **Deck builder start state.** For each new identity, `requiredIdentitySet` returns exactly its precon's
      signature cards, so a new deck in the builder opens with the right cards.
- [ ] **A real MarvelCDB decklist per new hero.** A saved copy of one public decklist (the MarvelCDB JSON, as a test
      fixture) imports with `from-marvelcdb-json`, is legal, and plays a seeded greedy game to an outcome that replays
      deep-equal. Reprinted cards (`duplicate_of_code`) have to resolve to our card ids.
- [ ] **Seen in the browser** (with step 5): one new hero's deck imported on the Decks screen, seated on Title, and a
      round played.

## 5. Standalone play in the client (once for the wave)

- [ ] `@mc/cards` `playable/` and the client's `pool.ts` include the wave; `POOL_VERSION` bumped once.
- [ ] Hero and scenario art in place (out of `_pending`).
- [ ] Team-Up pictures for each pair the wave makes playable (`art/teamups/<pair>/splash.*` and `badge.*`), asked for
      on the wave PR's "Content to add" list; `docs/team-ups.md` lists every pair, its pack and its folder.
- [ ] Every new mechanic that needs input has a board interaction (taps on scheme/environment abilities, choices,
      counters, new zones), and every new log line reads correctly.
- [ ] Seen in the browser: Title offers every new precon and scenario, and every new scenario starts with a new hero.
- [ ] **Guided mode covers every new mechanic** (`docs/guided-mode.md` §3.14, added 2026-09-29). For each mechanic a
      player can't learn from the Core lessons (a sub-deck like Doctor Strange's Invocation deck, Team-Up, a new zone,
      a scenario environment) and each card whose wording is easy to misread: glossary entries with cites, a
      `situation:<mechanic>` opportunistic tip, a one-line "How this works" note in Inspect for tricky wording, and, for
      a hero-defining mechanic, a Try-it lesson in the How to play hub. A new aspect (e.g. 'Pool) gets its aspect lesson.
      The box's "New in this box" page lists every new entry: each carries an `introducedIn` tag, and a new box needs
      its row in `BOXES`. A new rule that Core cards already use gets `appliesToCore` too.

## 6. The box's campaign

The per-box checklist is PLAN.md Phase 7 "Campaign mode" C2 and [campaign-client-per-box.md](campaign-client-per-box.md).

- [ ] `packages/cards/src/campaigns/<box>.ts`: a `CampaignDefinition` from the rulebook, registered in `index.ts`,
      with the `@mc/content` `Campaign` record (replacing any synthetic gate test such as `mts.gate.test.ts`).
- [ ] Campaign cards scripted, and available only inside campaign mode, never in standard play.
- [ ] Expert campaign rules.
- [ ] QA: a full campaign played end to end, a lost-and-retried scenario proving the log survives, and a permanent
      removal proving it sticks across the retry (`<box>.qa.test.ts`).
- [ ] Client: the design pass where `campaign-client-per-box.md` §3 says the box needs one, the story file
      (`campaign/stories/<box>.ts` plus its `STORIES` entry), and the comic reader's artboards.
- [ ] Seen in the browser: the box on the Saga shelf, a run signed, issue #1 briefed, played and folded back into the
      run.
- [ ] PLAN.md C3's row for the box reads ✅.

## 7. Progression

- [ ] An `UNLOCK_WAVES` row for the wave (`progression/unlocks.ts`): what opens it, the box's cast, and which villain
      unlocks each other hero; `unlocks.test.ts` passes.
- [ ] `docs/progression.md`'s wave table updated.

## 8. Shipping

- [ ] `pnpm check` green and the PR's CI green.
- [ ] Changie fragments for each landed step.
- [ ] **A wave is a minor release** (0.x.0): it carries at least one `Added` fragment so the release job's
      `changie next auto` bumps the minor version, not the patch. Check `changie next auto` before merging.
- [ ] PLAN.md Phase 7 says the wave is done; the PR's boxes are all ticked.
