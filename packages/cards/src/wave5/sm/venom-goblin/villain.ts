import {
  chooseOne,
  dealEncounterCard,
  defineAbilities,
  each,
  eachPlayer,
  forcedResponse,
  on,
  option,
  placeThreat,
  query,
  resolveSpecialsOf,
  whenRevealed,
} from "../../../dsl/index.js";
import { moveToLeastThreatScheme } from "./main-scheme.js";

/**
 * Where the glider counter is *now*, read before the Forced Response's own `moveToLeastThreatScheme` moves it on —
 * this is `moveToLeastThreatScheme`'s `from` (the scheme the counter starts the response on).
 */
const SCHEME_WITH_GLIDER = each(query("mainScheme", { hasCounter: "glider" }));
/**
 * The main scheme with the glider counter, read *after* it moves — the villain's own text always names the
 * counter's destination, never the scheme it started on. Since `moveToLeastThreatScheme` moves the counter before
 * this query runs (both are separate effects in the same ordered list), `SCHEME_WITH_GLIDER` also correctly reads
 * the new location here; kept as its own alias for clarity at each call site below. `resolveSpecialsOf` with no
 * `player` falls back to `context.controllerId`, which `on.enemyActivates(theVillain, { againstYou: true })`'s
 * `usesAttackedPlayer` has already set to the player Venom Goblin activated against, so "you" inside each Manhattan
 * Special (Midtown's "take 2 indirect damage", Upper's "discard 1 card from your hand") resolves to that same
 * player without naming it again here (`effects-frame.ts`'s `executeResolveSpecials` doc comment).
 */
const GLIDER_SCHEME = SCHEME_WITH_GLIDER;
const resolveGliderSpecial = () => resolveSpecialsOf(GLIDER_SCHEME);

/** "After Venom Goblin activates against you" — his attack on a hero-form player or his scheme on an alter-ego one
 * (RRG 1.8 "Activation", p. 6; docs/phase7-wave5.md §4.1 Q67). `{ categories: ["villain"] }`: the sole villain in
 * this scenario, the `hood.ts`/`ebony-maw.ts`/`tower-defense.ts` precedent for `on.enemyActivates`'s `Who`, which
 * takes `"self" | "host" | TargetQuery` and not a `named(...)` `TargetRef`. */
const activatesAgainstYou = () => on.enemyActivates({ categories: ["villain"] }, { againstYou: true });

export const VENOM_GOBLIN_VILLAIN = defineAbilities({
  // Venom Goblin (I) (27113, Steady is data) — Infest the City: [star] Forced Response: After Venom Goblin activates
  // against you, move the glider counter to the main scheme with the least threat. Choose to either place 2 threat
  // on that scheme or resolve its "Special" ability. "[star] Forced Response" is registered under `-constant`
  // (`sm/venom/villain.ts`'s own precedent for a named Forced Response with no other id to hang it on).
  "27113.venom-goblin-constant": forcedResponse(
    activatesAgainstYou(),
    ...moveToLeastThreatScheme(SCHEME_WITH_GLIDER, "glider"),
    chooseOne(
      option("Place 2 threat on that scheme", placeThreat(2, GLIDER_SCHEME)),
      option('Resolve its "Special" ability', resolveGliderSpecial()),
    ),
  ),

  // Venom Goblin (II) (27114, Steady/Toughness are data) — When Revealed: Deal 2 facedown encounter cards to each
  // player. Claim the Throne — [star] Forced Response: After Venom Goblin activates against you, move the glider
  // counter to the main scheme with the least threat. Resolve its "Special" ability.
  "27114.when-revealed": whenRevealed(dealEncounterCard(eachPlayer), dealEncounterCard(eachPlayer)),
  "27114.venom-goblin-constant": forcedResponse(
    activatesAgainstYou(),
    ...moveToLeastThreatScheme(SCHEME_WITH_GLIDER, "glider"),
    resolveGliderSpecial(),
  ),

  // Venom Goblin (III) (27115, Retaliate 1/Stalwart/Toughness are data) — When Revealed: Deal 3 facedown encounter
  // cards to each player. Reign of Terror — [star] Forced Response: After Venom Goblin activates against you, move
  // the glider counter to the main scheme with the least threat. Place 1 threat on that scheme and resolve its
  // "Special" ability.
  "27115.when-revealed": whenRevealed(
    dealEncounterCard(eachPlayer),
    dealEncounterCard(eachPlayer),
    dealEncounterCard(eachPlayer),
  ),
  "27115.venom-goblin-constant": forcedResponse(
    activatesAgainstYou(),
    ...moveToLeastThreatScheme(SCHEME_WITH_GLIDER, "glider"),
    placeThreat(1, GLIDER_SCHEME),
    resolveGliderSpecial(),
  ),
});
