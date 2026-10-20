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
  defineAbilities,
  dealIndirectDamage,
  discard,
  each,
  exists,
  firstPlayer,
  forcedInterrupt,
  giveTough,
  modifyAttack,
  on,
  option,
  placeThreat,
  printedCostOf,
  query,
  self,
  spendResources,
  statOf,
  stun,
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
 * Owner decision 2026-10-20 (A), revising Q8 (docs/phase7-wave7.md section 4.1): RRG 1.8 "Choose (Option)" (p. 12) and
 * the February 28, 2026 Spell Blast ruling bar an encounter card's option only when it needs a target and has no valid
 * one. Chimera's spend is offered to a player who cannot pay it (they pay what they can). A target is valid only if the
 * ability can affect it (RRG 1.8 "Target", p. 42), so Arclight's and Vertigo's status card needs a character that can
 * take it (`canTakeStatus`, as a target filter), Blockbuster's tough card needs him not to hold one, and Greycrow's
 * discard needs a card to target. The B faces name "the character you control with the highest THW/ATK": the highest is
 * found among every character the player controls, the first player breaks a tie, and the option is barred if none of
 * the tied characters can take the card (the next highest is not used instead).
 */
const ATTACKS_YOU = () => on.enemyAttacks("self", { againstYou: true });
const PLUS_2_ATK = "gets +2 ATK for this attack";

/** "Give Blockbuster a tough status card": barred while he holds one (he is the only target and cannot be affected, RRG p. 42). */
const GIVE_TOUGH = "Give Blockbuster a tough status card";

/** "The highest-cost card you control": allies, upgrades and supports (the cards a player controls that print a cost). */
const YOUR_COSTED_CARDS = query(["ally", "upgrade", "support"], { controller: "you" });
const highestCost = (ties: "all" | "first") =>
  superlative("highest", each(YOUR_COSTED_CARDS), printedCostOf(chosen("candidate")), { ties });
/** X: the printed cost of the highest-cost card you control, read when the option resolves (0 with none). */
const HIGHEST_PRINTED_COST = printedCostOf(highestCost("first"));

/**
 * A character you control that a status card can be given to. A target is valid only if the ability can affect it (RRG
 * 1.8 "Target", p. 42; "Status Cards", p. 41): not a stalwart one, nor one holding that status already. With none, the
 * engine bars the option (`optionLacksValidTarget`, RRG p. 12).
 */
const ABLE = (status: "confused" | "stunned") => query("character", { controller: "you", ...canTakeStatus(status) });
/** The characters you control tied for the highest `stat`, bound before the choice so each option can read them. */
const bindHighest = (stat: "thw" | "atk") =>
  bindTargets(
    "highest",
    superlative("highest", each(query("character", { controller: "you" })), statOf(chosen("candidate"), stat)),
  );
const ABLE_HIGHEST = (status: "confused" | "stunned") =>
  query("character", { controller: "you", inSlot: "highest", ...canTakeStatus(status) });

export const MARAUDERS: AbilityRegistry = defineAbilities({
  // Arclight
  "40070a.arclight-forced-interrupt": forcedInterrupt(
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
  "40070b.arclight-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    bindHighest("thw"),
    chooseOne(
      option(
        "Confuse the character you control with the highest THW",
        // The slot is bound before the choice, so the gate reads it; the engine cannot see a target in a bound slot.
        { when: exists(ABLE_HIGHEST("confused")) },
        chooseTarget("target", ABLE_HIGHEST("confused"), { chooser: firstPlayer }),
        confuse(chosen("target")),
      ),
      option(`Arclight ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),

  // Vertigo
  "40076a.vertigo-forced-interrupt": forcedInterrupt(
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
  "40076b.vertigo-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    bindHighest("atk"),
    chooseOne(
      option(
        "Stun the character you control with the highest ATK",
        { when: exists(ABLE_HIGHEST("stunned")) },
        chooseTarget("target", ABLE_HIGHEST("stunned"), { chooser: firstPlayer }),
        stun(chosen("target")),
      ),
      option(`Vertigo ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),

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
      option("Spend a [mental] resource", spendResources({ mental: 1 }, "spent")),
      option(`Chimera ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),
  "40072b.chimera-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option("Spend [mental][mental] resources", spendResources({ mental: 2 }, "spent")),
      option(`Chimera ${PLUS_2_ATK}`, modifyAttack({ atkBonus: 2 })),
    ),
  ),

  // Greycrow. A tie for the highest cost is the first player's pick (A); B discards every tied card.
  "40073a.greycrow-forced-interrupt": forcedInterrupt(
    ATTACKS_YOU(),
    chooseOne(
      option(
        "Discard the highest-cost card you control",
        { when: exists(YOUR_COSTED_CARDS) },
        bindTargets("highest", highestCost("all")),
        chooseTarget("pick", { inSlot: "highest" }, { chooser: firstPlayer }),
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
