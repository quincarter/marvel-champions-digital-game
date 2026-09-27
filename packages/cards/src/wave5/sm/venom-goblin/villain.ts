import { defineAbilities } from "../../../dsl/index.js";

/**
 * Venom Goblin (`sm` 27113–27115, MC27 p. 17): Steady/Toughness/Retaliate keywords are card data. The next agent's
 * work — Infest the City / Claim the Throne / Reign of Terror (each stage's own `[star] Forced Response: After
 * Venom Goblin activates against you, move the glider counter to the main scheme with the least threat …`) and the
 * When Revealeds dealing facedown encounter cards. "Move the glider counter to the main scheme with the least
 * threat" is `main-scheme.ts`'s `moveToLeastThreatScheme(each(query("mainScheme", { hasCounter: "glider" })),
 * "glider")` (the first player breaks a tie), and "resolve its 'Special' ability" is
 * `resolveSpecialsOf(each(query("mainScheme", { hasCounter: "glider" })))` (same file), reading the *new* location
 * of the glider counter after it moves. `main-scheme.ts` in this folder already scripts 27117a–27119a's own Special
 * abilities and 27117b–27119b's own When Revealed/loss check; this villain module only needs to call them.
 */
export const VENOM_GOBLIN_VILLAIN = defineAbilities({});
