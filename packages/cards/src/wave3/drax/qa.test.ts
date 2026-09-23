/**
 * rules-qa-engineer wave 3 pass, `drax` (docs/phase7-wave3-qa.md has the full report).
 */

/**
 * docs/phase7-wave3.md §4 Q12 (open question, no FFG ruling — "the rulings file and the FAQ are silent"): "Is
 * 'that minion attacks another enemy' [Moondragon, 19013] an activation?" `19013.moondragon-action` stays in
 * `KNOWN_SKIPPED` per docs/phase7-wave3-scripting.md §7's own module docblock, and §3.23 in docs/phase7-wave3.md
 * is itself marked "open" — no `EffectSpec`/primitive for "an enemy attacking another enemy" exists in the engine
 * yet, so there is nothing to drive a real command against.
 *
 * This is recorded here, deliberately unimplemented, rather than silently dropped: `pnpm dsl`/`pnpm refs` (checked
 * this pass) confirm no `enemyAttacksEnemy`-shaped `EffectSpec` exists anywhere in `packages/engine/src/spec.ts`.
 * When `game-rules-architect` answers Q12 and builds the primitive, this test should become a real one (replacing
 * the `.skip`), not just get deleted — it is the marker that the question was checked, not ignored.
 */
test.skip("Moondragon (19013): 'that minion attacks another enemy' — no primitive exists yet; §4 Q12 is unanswered (docs/phase7-wave3.md §3.23)", () => {
  // Intentionally empty: nothing to drive until §3.23 lands. See the docblock above.
});
