# @mc/content

Card data schema for Marvel Champions: Digital Edition. This package defines
*shape*, not data — no real card database ships here yet (that's later
ingestion work). See `src/schema/schema.test.ts` for hand-typed fixtures
covering every card type.

## Shape

- `schema/ids.ts` — branded string ids (`CardId`, `SetCode`, `CycleId`, `EncounterSetId`, `ScenarioId`, `CampaignId`, `AbilityId`, `ArtRef`) so foreign keys can't be swapped by accident.
- `schema/common.ts` — `ScalingValue` (`base + perPlayer * playerCount`, for anything printed with a per-player qualifier), `ResourceIconCounts`, `CardText` (printed vs. current), `ErrataStatus`, and the open-ended `Trait` type.
- `schema/keywords.ts` — a closed `KeywordInstance` union covering every keyword on the Hall of Heroes keyword list (cited in the file header), with structured parameters (`Retaliate 2`, `Uses (4 web)`, `Hinder 1`, `Teamwork` + shared trait, etc.) instead of free text.
- `schema/aspects.ts` — the core aspects plus a template-literal `HeroAspect` for identity-locked signature cards.
- `schema/abilities.ts` — `AbilityReference`: an opaque `AbilityId` + trigger classification (`action` / `response` / `interrupt` / `forced_response` / `forced_interrupt` / `when_revealed` / `constant` / `setup` / `boost_effect`) the engine can index before `ability-scripting-engineer` writes real behavior.
- `schema/sets.ts` — `Cycle`, `Pack`, `EncounterSet` (modular/nemesis sets shared across products), `Scenario`, `Campaign`.
- `schema/cards/` — one interface per card type, unioned as `AnyCard`.
- `schema/validation.ts` — hand-written guards behind `validateCard()`; no external validation dependency.

## Rules-shape decisions worth knowing

- **Hero identity** is one record with `hero` and `alterEgo` faces. `hp` lives on the identity (damage persists across a flip); traits, hand size, and ATK/THW/DEF (hero) or REC (alter-ego) live on the face.
- **Allies** always carry `consequentialDamage: { attack, thwart }` — the small numbers printed beside the icons.
- **Villains and minions** have `atk` and `sch` (scheme), not THW. Villain `stages` are the printed I/II/III numerals; standard vs. expert is a scenario-level choice of which stages to use, not a card property.
- **Main scheme stages** have `startingThreat`, `targetThreat`, and `acceleration` (all `ScalingValue`) plus `icons`. **Side schemes** have only `startingThreat` — they're defeated when thwarted to 0.
- **Boost icons** are a required field on every encounter-deck card (minion, attachment, treachery, obligation, environment, side scheme) because the encounter deck *is* the boost deck. There is no "boost card" type. A boost-star effect is an ability with `trigger: "boost_effect"`.
- **Card art** is an `ArtRef` lookup key only — never bytes, never a URL — per `CLAUDE.md`'s IP boundary.

## Versioning

Every card carries `setCode` + `cycleId` and an optional `errata: ErrataStatus`
(current errata/taboo version tag plus a history trail). Rules text is never
overwritten in place: `CardText = { printed, current }` keeps the original print
and the currently-legal wording side by side.

## What ingestion (a later task) produces

Real `AnyCard[]` data per cycle/pack, sourced from the Hall of Heroes index and
cross-checked against a second source, plus `EncounterSet` / `Scenario` /
`Campaign` records wiring cards into playable scenarios.
