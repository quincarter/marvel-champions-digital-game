import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  bindTargets,
  canTakeStatus,
  chooseOne,
  hasStatus,
  not,
  chooseTarget,
  chosen,
  confuse,
  constant,
  countOf,
  defineAbilities,
  dealIndirectDamage,
  discard,
  discardEncounterUntil,
  each,
  exists,
  firstPlayer,
  forcedInterrupt,
  gainsKeyword,
  giveTough,
  modifyAttack,
  notMatching,
  on,
  option,
  placeThreat,
  printedCostOf,
  putIntoPlay,
  query,
  self,
  sharesTitleWith,
  spendResources,
  stun,
  superlative,
  theMainScheme,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/**
 * The Mutant Slayers modular set (40094-40102): the seven Marauder minions, the Mutant Slayers side scheme and Bound by
 * Business. Each minion prints the same "[star] Forced Interrupt: When X attacks you or an ally you control, choose: ..."
 * as its villain's A face (`marauders.ts`, the worked example; helpers restated here because that module does not export
 * them). `againstYou` reads the attacked player, so an attack on an ally is chosen by the ally's controller (RRG 1.8
 * "Attacks Against Allies", p. 10; owner decision Q5 = A), and `you` in the options is that player. Owner decision
 * 2026-10-20 (A), revising Q8: an option is barred only when it needs a target and has no valid one (RRG 1.8 p. 12), so
 * Chimera's spend is still offered; a status card needs a character that can take it and Blockbuster must not hold a
 * tough card (a target is valid only if the ability can affect it, RRG 1.8 "Target", p. 42).
 *
 * A minion draws no boost card (only the villain and villainous minions do), so nothing here adds a boost card:
 * Harpoon's second option is "+2 ATK and piercing" (it has no extra-boost-card option as the villain does).
 */
const ATTACKS_YOU = () => on.enemyAttacks("self", { againstYou: true });
const PLUS_2_ATK = "gets +2 ATK for this attack";

/** "The highest-cost card you control": allies, upgrades and supports (the cards a player controls that print a cost). */
const YOUR_COSTED_CARDS = query(["ally", "upgrade", "support"], { controller: "you" });
const highestCost = superlative("highest", each(YOUR_COSTED_CARDS), printedCostOf(chosen("candidate")), {
  ties: "all",
});
/** X: the printed cost of the highest-cost card you control, read when the option resolves (0 with none). */
const HIGHEST_PRINTED_COST = printedCostOf(
  superlative("highest", each(YOUR_COSTED_CARDS), printedCostOf(chosen("candidate")), { ties: "first" }),
);
/**
 * A character you control that a status card can be given to. A target is valid only if the ability can affect it (RRG
 * 1.8 "Target", p. 42; "Status Cards", p. 41): not a stalwart one, nor one holding that status already. With none, the
 * engine bars the option (`optionLacksValidTarget`, RRG p. 12).
 */
const ABLE = (status: "confused" | "stunned") => query("character", { controller: "you", ...canTakeStatus(status) });

const MARAUDER_MINIONS = query("minion", { trait: trait("MARAUDER") });
/** "Each character in play with 1 or more of the following traits": a character with two of them counts once. */
const SLAYER_TARGETS = query("character", {
  anyTrait: [trait("MUTANT"), trait("X-FACTOR"), trait("X-FORCE"), trait("X-MEN")],
});
/** Every card in play (what "a card in play" means in Bound by Business: players' cards and the encounter's). */
const CARDS_IN_PLAY = query(["hero", "alterEgo", "ally", "upgrade", "support", "minion", "villain", "attachment"]);

export const MUTANT_SLAYERS: AbilityRegistry = defineAbilities({
  // Arclight
  "40094.arclight-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Confuse a character you control",
        // No "choose": an encounter card targeting one of several eligible cards; the first player selects
        // (RRG 1.8 "First Player", p. 19).
        chooseTarget("target", ABLE("confused"), { chooser: firstPlayer }),
        confuse(chosen("target")),
      ),
      option(`Arclight ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),

  // Blockbuster: offered only if he holds no tough status card (nothing is placed on a holder).
  "40095.blockbuster-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option("Give Blockbuster a tough status card", { when: not(hasStatus(self, "tough")) }, giveTough(self)),
      option(`Blockbuster ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),

  // Chimera. A wild resource counts as [mental] (the engine's spend pricing).
  "40096.chimera-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option("Spend a [mental] resource", spendResources({ mental: 1 }, "spent")),
      option(`Chimera ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),

  // Greycrow. A tie for the highest cost is the first player's pick.
  "40097.greycrow-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Discard the highest-cost card you control",
        { when: exists(YOUR_COSTED_CARDS) },
        bindTargets("highest", highestCost),
        chooseTarget("pick", { inSlot: "highest" }, { chooser: firstPlayer }),
        discard(chosen("pick")),
      ),
      option("Greycrow gets +X ATK for this attack", modifyAttack({ atkBonus: HIGHEST_PRINTED_COST })),
    ),
  ),

  // Harpoon. Indirect damage can always be taken, so neither option is gated.
  "40098.harpoon-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option("Take 2 indirect damage", dealIndirectDamage(you, 2)),
      option(
        `Harpoon ${PLUS_2_ATK} and this attack gains piercing`,
        modifyAttack({ atkBonus: 2, keywords: ["piercing"] }),
      ),
    ),
  ),

  // Riptide. Threat can always be placed on the main scheme, so neither option is gated.
  "40099.riptide-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Place 2 threat on the main scheme and 1 threat on each side scheme",
        placeThreat(2, theMainScheme),
        placeThreat(1, each(query("sideScheme"))),
      ),
      option(`Riptide ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),

  // Vertigo
  "40100.vertigo-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Stun a character you control",
        chooseTarget("target", ABLE("stunned"), { chooser: firstPlayer }),
        stun(chosen("target")),
      ),
      option(`Vertigo ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),

  // Mutant Slayers (side scheme): Each MARAUDER minion gains quickstrike (the engine runs a revealed minion's
  // quickstrike after its When Revealed, RRG 1.8 p. 36; the owner's answer 30B, 2026-10-12).
  "40101.mutant-slayers-constant": constant(gainsKeyword({ name: "quickstrike" }, MARAUDER_MINIONS)),
  // When Revealed: Place 1 additional threat here for each character in play with a listed trait.
  "40101.when-revealed": whenRevealed(placeThreat(countOf(SLAYER_TARGETS), self)),

  // Bound by Business: Discard cards from the encounter deck until a MARAUDER minion that does not share a title with a
  // card in play is discarded. Put that minion into play engaged with you. (If the deck runs out nothing is found and
  // nothing is put into play.)
  "40102.when-revealed": whenRevealed(
    discardEncounterUntil(
      query("minion", { trait: trait("MARAUDER"), ...notMatching(sharesTitleWith(each(CARDS_IN_PLAY))) }),
      "found",
    ),
    putIntoPlay(chosen("found"), you),
  ),
});
