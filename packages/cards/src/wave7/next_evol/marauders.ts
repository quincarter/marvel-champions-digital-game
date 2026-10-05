import type { AbilityRegistry } from "@mc/engine";
import {
  bindTargets,
  canPayResources,
  chooseOne,
  chooseTarget,
  chosen,
  defineAbilities,
  dealIndirectDamage,
  discard,
  each,
  exists,
  forcedInterrupt,
  giveTough,
  hasStatus,
  modifyAttack,
  not,
  on,
  option,
  placeThreat,
  printedCostOf,
  query,
  self,
  spendResources,
  superlative,
  theMainScheme,
  you,
} from "../../dsl/index.js";

/**
 * The Marauders set (40070-40076: the seven villains Morlock Siege and On the Run share, both mode faces). Each prints
 * "[star] Forced Interrupt: When [name] attacks you or an ally you control, choose: ...". `againstYou` reads the attacked
 * player, so an attack on an ally is chosen by the ally's controller (RRG 1.8 "Attacks Against Allies", p. 10; owner
 * decision Q5 = A), and `you` in the options is that player.
 *
 * Owner decision Q8 = A (docs/phase7-wave7.md section 4.1): an option is offered only if the player can carry it out in
 * full, otherwise the other option is forced. Chimera's spend and Greycrow's discard are gated by `when`. Harpoon's
 * indirect damage and Riptide's threat can always be carried out (an identity can always take damage; threat can always
 * be placed on the main scheme), so neither is gated, and each +ATK option is always possible.
 *
 * Skipped, for want of a status-room query: Arclight (40070a/b) and Vertigo (40076a/b) give a status card to a character
 * the player controls. Q8 offers that option only when some character can take it (not stalwart, not already holding one,
 * a steady one holding two), which needs the engine's `statusCapacity` in a `TargetQuery` or `Predicate`; neither exists
 * (`hasStatus` cannot be negated in a query and cannot see steady's second card). See `KNOWN_SKIPPED`.
 */
const ATTACKS_YOU = () => on.enemyAttacks("self", { againstYou: true });
const PLUS_2_ATK = "gets +2 ATK for this attack";

/** "Give Blockbuster a tough status card": offered only if he holds none (nothing is placed on a holder, task 16). */
const GIVE_TOUGH = "Give Blockbuster a tough status card";

/** "The highest-cost card you control": allies, upgrades and supports (the cards a player controls that print a cost). */
const YOUR_COSTED_CARDS = query(["ally", "upgrade", "support"], { controller: "you" });
const highestCost = (ties: "all" | "first") =>
  superlative("highest", each(YOUR_COSTED_CARDS), printedCostOf(chosen("candidate")), { ties });
/** X: the printed cost of the highest-cost card you control, read when the option resolves (0 with none). */
const HIGHEST_PRINTED_COST = printedCostOf(highestCost("first"));

export const MARAUDERS: AbilityRegistry = defineAbilities({
  // Blockbuster
  "40071a.blockbuster-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(GIVE_TOUGH, { when: not(hasStatus(self, "tough")) }, giveTough(self)),
      option(`Blockbuster ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),
  "40071b.blockbuster-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(GIVE_TOUGH, { when: not(hasStatus(self, "tough")) }, giveTough(self)),
      option(`Blockbuster ${PLUS_2_ATK} and this attack gains overkill`, modifyAttack({ atkBonus: 2, overkill: true })),
    ),
  ),

  // Chimera. A wild resource counts as [mental] (the engine's spend pricing).
  "40072a.chimera-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Spend a [mental] resource",
        { when: canPayResources({ mental: 1 }) },
        spendResources({ mental: 1 }, "spent"),
      ),
      option(`Chimera ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),
  "40072b.chimera-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Spend [mental][mental] resources",
        { when: canPayResources({ mental: 2 }) },
        spendResources({ mental: 2 }, "spent"),
      ),
      option(`Chimera ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),

  // Greycrow. A tie for the highest cost is the attacked player's pick (A); B discards every tied card.
  "40073a.greycrow-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Discard the highest-cost card you control",
        { when: exists(YOUR_COSTED_CARDS) },
        bindTargets("highest", highestCost("all")),
        chooseTarget("pick", { inSlot: "highest" }),
        discard(chosen("pick")),
      ),
      option("Greycrow gets +X ATK for this attack", modifyAttack({ atkBonus: HIGHEST_PRINTED_COST })),
    ),
  ),
  "40073b.greycrow-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Discard each card you control with the highest cost",
        { when: exists(YOUR_COSTED_CARDS) },
        bindTargets("highest", highestCost("all")),
        discard(chosen("highest")),
      ),
      option("Greycrow gets +X ATK for this attack", modifyAttack({ atkBonus: HIGHEST_PRINTED_COST })),
    ),
  ),

  // Harpoon
  "40074a.harpoon-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option("Take 2 indirect damage", dealIndirectDamage(you, 2)),
      option("Give Harpoon 1 additional facedown boost card", modifyAttack({ extraBoostCards: 1 })),
    ),
  ),
  "40074b.harpoon-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option("Take 3 indirect damage", dealIndirectDamage(you, 3)),
      option(
        "Give Harpoon 1 additional facedown boost card; this attack gains overkill",
        modifyAttack({ extraBoostCards: 1, overkill: true }),
      ),
    ),
  ),

  // Riptide. The threat is fixed (no per-hero icon on the scans), so it is the same in every player count.
  "40075a.riptide-forced-interrupt": forcedInterrupt(
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
  "40075b.riptide-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Place 3 threat on the main scheme and 1 threat on each side scheme",
        placeThreat(3, theMainScheme),
        placeThreat(1, each(query("sideScheme"))),
      ),
      option(
        `Riptide ${PLUS_2_ATK} and this attack gains ranged and piercing`,
        modifyAttack({ atkBonus: 2, keywords: ["ranged", "piercing"] }),
      ),
    ),
  ),
});
