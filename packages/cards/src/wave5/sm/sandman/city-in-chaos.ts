import { trait } from "@mc/content";
import {
  addAccelerationToken,
  attacksGainKeywords,
  blanksTextBox,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  enemyScheme,
  encounterCards,
  exhaust,
  ifThen,
  inPlay,
  named,
  not,
  option,
  putIntoPlay,
  query,
  selectCards,
  shuffleEncounterDeck,
  spendResources,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const RHINO = named("Rhino");

/**
 * City in Chaos (`sm` 27127–27130, docs/phase7-wave5.md §2.2): the Sandman scenario's other required encounter set
 * (not a recommended modular — the scenario cannot be built without it, so it is scripted here alongside Sandman's
 * own set rather than left for a later modular-set pass). Panic in the Streets, Rhino, Calling in Favors and Now or
 * Never resolve.
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

  // Now or Never (27130) — Peril (data). When Revealed: Choose: place 1 acceleration token on the main scheme, or
  // exhaust a character you control and spend 1 resource of any type. Full text confirmed against the card's own
  // scan (`assets/card-art/bundles/cards/27130.png`) — MarvelCDB's `text`/`real_text` drops the bullets and the
  // second option's closing period (curation correction, `packages/content/scripts/marvelcdb/curation/sm.ts`
  // 27130), but both options are exactly as printed, no third option or further clause. The second option's
  // "exhaust a character you control" is the revealing player's own choice among their own characters (Bitter
  // Rival, `trors` 04136's `chooseTarget`/`exhaust` shape); "spend 1 resource of any type" is `{ generic: 1 }`
  // (Ghost-Spider's Brainstorm, `sm` 27015's own "3 resources of any type" idiom) — an unconditional part of the
  // chosen option, not a branch on whether it was paid, so `spendResources` degrades to spending nothing if the
  // player has nothing to pay with, the same as `chooseTarget` degrades to no character exhausted if none are in
  // play (RRG 1.8 doesn't require a `Choose:` option's own sub-effects each find a legal target/payment to be
  // chosen).
  "27130.when-revealed": whenRevealed(
    chooseOne(
      option("Place 1 acceleration token on the main scheme", addAccelerationToken()),
      option(
        "Exhaust a character you control and spend 1 resource of any type",
        chooseTarget("char", query("character", { controller: "you" })),
        exhaust(chosen("char")),
        spendResources({ generic: 1 }, "paid"),
      ),
    ),
  ),
});
