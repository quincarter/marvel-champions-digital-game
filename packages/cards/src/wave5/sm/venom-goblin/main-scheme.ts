import { trait } from "@mc/content";
import {
  addCounters,
  cards,
  chosen,
  constant,
  countOf,
  defineAbilities,
  discardFromHand,
  each,
  endGame,
  exists,
  flipCard,
  ifThen,
  moveCards,
  moveCounters,
  named,
  placeThreat,
  putMainSchemeStageIntoPlay,
  query,
  self,
  setup,
  special,
  stateCheck,
  superlative,
  threatOn,
  topOfDeck,
  valueAtLeast,
  dealIndirectDamage,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const SYMBIOTE = trait("SYMBIOTE");
const SYMBIOTE_ENVIRONMENT = query("environment", { trait: SYMBIOTE });
const symbioteEnvironmentInPlay = exists(SYMBIOTE_ENVIRONMENT);
const toLeastThreatScheme = superlative("lowest", each(query("mainScheme")), threatOn(chosen("candidate")));

/**
 * "When Revealed: Move the glider counter and each acceleration token from here to the main scheme with the least
 * threat. If there are at least 2 [Symbiote] environments in play, the players lose the game." (27117b/27118b/27119b,
 * MC27 p. 17, the p. 67 erratum and FAQ p. 62/MC27 p. 21). One `moveCounters` call with no `counterType` moves every
 * counter self holds — the glider counter and any acceleration tokens alike (`packages/engine/src/effects.ts`
 * `moveCounters`, docs/phase7-wave5.md §3.3/§3.4). The loss condition is a `stateCheck`, not folded into the When
 * Revealed, because it must catch a second [Symbiote] environment entering play by any other route later, not only
 * at the moment this one is revealed (RRG 1.8 "Uses", p. 46's own edge-triggered state check, `dsl/abilities.ts`
 * `stateCheck`'s own doc comment).
 */
const manhattanWhenRevealed = () => whenRevealed(moveCounters(self, toLeastThreatScheme));
const manhattanLossCheck = () => stateCheck(valueAtLeast(countOf(SYMBIOTE_ENVIRONMENT), 2), endGame("loss"));

export const SKIES_OVER_NEW_YORK = defineAbilities({
  // Skies Over New York, A (27116a) — Setup: put Lower/Midtown/Upper Manhattan into play, place the glider counter
  // on Midtown Manhattan, flip this card to its environment face (27116b) and set it aside
  // (`packages/engine/src/glider-main-schemes.test.ts`'s own worked Setup). MC27 p. 17; the p. 67 erratum adds "When
  // a main scheme is completed, flip it to its environment side" to stages B–D (`onCompletion: "flipToOtherFace"`,
  // card data), not scripted here.
  "27116a.setup": setup(
    putMainSchemeStageIntoPlay(2, "Lower Manhattan"),
    putMainSchemeStageIntoPlay(3, "Midtown Manhattan"),
    putMainSchemeStageIntoPlay(4, "Upper Manhattan"),
    addCounters("glider", 1, named("Midtown Manhattan")),
    flipCard(self),
    moveCards(cards(self), "encounterSetAside"),
  ),

  // Skies Over New York, B (27116b, set aside at setup — module docblock) — three printed bullets. The glider rule
  // itself (`mainSchemeMarkedBy("glider")`, docs/phase7-wave5.md §3.3) is a scenario rule with no card in play
  // (`GameSetupConfig.scenarioRuleSpecs`, `wave5/setup.ts`), because this card never re-enters play once set aside;
  // these three refs are the printed bullets' own reminder text and are no-ops here (Bell Tower's own
  // `27077a.bell-tower-constant`/`27077b.bell-tower-constant-2` precedent, `wave5/sm/venom/encounter-set.ts`).
  // Bullet 1 — "Player cards that affect 'the main scheme' can apply to any main scheme": the engine's own default
  // for a player card's "the main scheme" (wave 4's own choice, docs/phase7-wave5.md §3.3's own status note).
  "27116b.skies-over-new-york-constant": constant(),
  // Bullet 2 — "Encounter cards that affect 'the main scheme' only apply to the scheme with the glider counter
  // (including the placing of acceleration tokens)": `mainSchemeMarkedBy("glider")` in `wave5/setup.ts`'s own
  // `SCENARIO_RULE_SPECS` for "venom-goblin".
  "27116b.skies-over-new-york-constant-2": constant(),
  // Bullet 3 — "Each main scheme accumulates threat each round according to its acceleration value and any
  // acceleration tokens on that scheme": the landed default (docs/phase7-wave5.md §3.3/§3.4 — every main scheme
  // gains its own acceleration at step one, and acceleration tokens on any card count toward their own scheme).
  "27116b.skies-over-new-york-constant-3": constant(),

  // Lower Manhattan, A (27117a) — Special: Place 1 threat on each scheme. If a [Symbiote] environment is in play,
  // place 1 additional threat on this scheme.
  "27117a.lower-manhattan-special": special(
    placeThreat(1, each(query("mainScheme"))),
    ifThen(symbioteEnvironmentInPlay, placeThreat(1, self)),
  ),
  // Lower Manhattan, B (27117b) — When Revealed / loss condition (module docblock).
  "27117b.when-revealed": manhattanWhenRevealed(),
  "27117b.lower-manhattan-constant": manhattanLossCheck(),

  // Midtown Manhattan, A (27118a) — Special: Take 2 indirect damage. If a [Symbiote] environment is in play, take 1
  // additional indirect damage. "You" is the player the villain's own "resolve its Special ability" was chosen
  // against (Nebula's Technique attachments' own `special(takeDamage(1, you))` precedent, `wave3/gmw/nebula.ts`).
  "27118a.midtown-manhattan-special": special(
    dealIndirectDamage(you, 2),
    ifThen(symbioteEnvironmentInPlay, dealIndirectDamage(you, 1)),
  ),
  // Midtown Manhattan, B (27118b) — When Revealed / loss condition (module docblock).
  "27118b.when-revealed": manhattanWhenRevealed(),
  "27118b.midtown-manhattan-constant": manhattanLossCheck(),

  // Upper Manhattan, A (27119a) — Special: Discard 1 card from your hand. If a [Symbiote] environment is in play,
  // discard the top 4 cards of your deck.
  "27119a.upper-manhattan-special": special(
    discardFromHand(1, you),
    ifThen(symbioteEnvironmentInPlay, moveCards(topOfDeck(4, you), "discard")),
  ),
  // Upper Manhattan, B (27119b) — When Revealed / loss condition (module docblock).
  "27119b.when-revealed": manhattanWhenRevealed(),
  "27119b.upper-manhattan-constant": manhattanLossCheck(),
});
