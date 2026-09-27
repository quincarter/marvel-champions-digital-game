import { trait } from "@mc/content";
import {
  attacksGainKeywords,
  blanksTextBox,
  chosen,
  constant,
  defineAbilities,
  enemyScheme,
  encounterCards,
  ifThen,
  inPlay,
  named,
  not,
  putIntoPlay,
  query,
  selectCards,
  shuffleEncounterDeck,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const RHINO = named("Rhino");

/**
 * City in Chaos (`sm` 27127–27130, docs/phase7-wave5.md §2.2): the Sandman scenario's other required encounter set
 * (not a recommended modular — the scenario cannot be built without it, so it is scripted here alongside Sandman's
 * own set rather than left for a later modular-set pass). Panic in the Streets, Rhino and Calling in Favors resolve.
 *
 * **Now or Never (27130) is not scripted.** Its raw MarvelCDB text is truncated (checked against
 * `packages/content/raw/marvelcdb/sm.json` and `docs/cards_reference.md`, both copies end mid-sentence): "When
 * Revealed: Choose: Place 1 acceleration token on the main scheme. Exhaust a character you control and spend 1
 * resource of any type" — the second option's effect (what exhausting the character and spending the resource
 * actually does) is missing from every source this repo has. This is a `card-data-pipeline` data gap, not an
 * engine gap: implementing only the first, well-formed option would silently drop the choice the card actually
 * offers (worse than leaving it unscripted), so `27130.when-revealed`, `27130.now-or-never-constant` and
 * `27130.now-or-never-constant-2` are left unresolved pending the real card text.
 */
export const CITY_IN_CHAOS = defineAbilities({
  // Panic in the Streets (27127) — Treat the printed text box of each location support and each persona support as
  // if it were blank (except for traits — traits print outside the text box, so nothing extra is needed for them).
  "27127.panic-in-the-streets-constant": constant(
    blanksTextBox(query("support", { trait: trait("LOCATION") })),
    blanksTextBox(query("support", { trait: trait("PERSONA") })),
  ),

  // Rhino (27128) — Steady (data). [star] Rhino's attacks gain overkill and piercing.
  "27128.rhino-constant": constant(attacksGainKeywords(["overkill", "piercing"], { attacker: { self: true } })),

  // Calling in Favors (27129) — When Revealed: Rhino schemes with +2 SCH (a no-op if Rhino isn't in play — there is
  // no legal target — matching the printed order). If Rhino is not in play, search the encounter deck and discard
  // pile for the Rhino minion and put him into play engaged with you, then shuffle the encounter deck
  // (`core/modular/hydra-and-doomsday.ts`'s own `fetchIntoPlay` shape).
  "27129.when-revealed": whenRevealed(
    enemyScheme(RHINO, { schBonus: 2 }),
    ifThen(not(inPlay("Rhino")), [
      selectCards("rhino", encounterCards(["deck", "discard"], { name: "Rhino" })),
      putIntoPlay(chosen("rhino"), you),
      shuffleEncounterDeck(),
    ]),
  ),
});
