import type { AbilityRegistry } from "@mc/engine";

/**
 * Physical Toll (09027), Doctor Strange's obligation. **Recorded skip — not scripted.**
 *
 * Printed text: "Give to the Stephen Strange player. You may flip to alter-ego form. Choose: • Exhaust Stephen
 * Strange → remove Physical Toll from the game. • The next event you play costs 3 additional resources. Discard
 * this obligation after you play an event."
 *
 * The "exhaust to remove" branch is the ordinary shape every other wave 1 obligation uses (`../../core/
 * obligations.js`'s `obligation()` helper). The alternative branch is not: choosing it does **not** discard the
 * obligation immediately (unlike Core's shared shape, where the alternative's effects and `discardThisObligation`
 * both resolve at once) — the card stays in the alter-ego player's play area (RRG "Obligation": a revealed
 * obligation enters play, `packages/engine/src/resolve/reveal.ts` `case "obligation"`), keeps applying its +3 cost
 * increase to every event that player would play, until the *next* event they play, at which point it discards
 * itself.
 *
 * docs/phase7-wave1.md §3.10's own "Deviation" note names the intended shape — "a constant `costModifiers { delta:
 * +3 }` on the obligation in play plus a forced response that discards it, not a lasting `costIncrease`" — but that
 * shape needs a `constant`-triggered `AbilityDefinition` for this printed card, and the content data
 * (`packages/content/src/data/drs/cards.ts`) lists exactly **one** ability ref for 09027
 * (`abilityId("09027.obligation")`). `AbilityDefinition.trigger` is a single `AbilityTriggerSpec`
 * (`packages/engine/src/abilities.ts`), so one ref cannot be both the `whenRevealed` that resolves the choice *and*
 * a separate always-on `constant` cost modifier the way Followed's two-ref split
 * (`packages/cards/src/wave1/cap/pack-cards.ts`, `03032.followed-constant` + `03032.followed-interrupt`) or
 * Hawkeye's "enters play with N counters" ref (`packages/cards/src/core/aspects/leadership.ts`, `01066.hawkeye-constant`)
 * manage with two ids on one printed card.
 *
 * The other engine primitive this could use instead — `EffectSpec.reduceNextCardCost` / the `costReduction`
 * lasting effect (`packages/engine/src/lasting.ts`) — only supports `duration: "phase" | "round"`
 * (`packages/engine/src/spec.ts`), consumed early if a matching card is played first. The printed card has no
 * round/phase bound at all ("the next event you play", however long that takes), so bounding it to the current
 * round would silently stop applying the extra cost (and never discard the obligation) if the player simply
 * doesn't play an event that round — a wrong answer a real player would notice, not an unimplemented one.
 *
 * **What's missing:** a lasting/constant cost modifier with no time-based duration at all — active for as long as
 * its source card instance remains in play, consumed (and its source discarded) the moment a matching card is
 * played, rather than at a fixed phase/round boundary. Closest existing primitives: `LastingEffectBody.costReduction`
 * (`packages/engine/src/lasting.ts`, needs an "indefinite, consumed-only" `LastingDuration` variant) or a
 * `constant`-kind `costModifiers` read directly off an out-of-hand in-play card the way `printedConstants`
 * (`packages/engine/src/actions.ts`) already reads a card's own constant text "wherever it is" for other fields —
 * either would need `game-rules-architect` to extend `LastingDuration`/`printedConstants` (or the content schema to
 * add a second ability ref for this one card) rather than a `@mc/cards`-side workaround.
 *
 * Left out of `DRS_ABILITIES`; `09027.obligation` is therefore unresolved in `coverage.test.ts`, the correct,
 * honest state until the primitive lands (docs/phase7-wave1-scripting.md §4).
 */
export const DRS_OBLIGATION: AbilityRegistry = {};
