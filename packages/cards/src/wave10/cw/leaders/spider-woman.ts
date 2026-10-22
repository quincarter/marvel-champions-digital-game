import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  adjustBoostCount,
  applyRuleUntil,
  attachCard,
  bindTargets,
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  counterLimit,
  countersOn,
  dealEncounterCard,
  defineAbilities,
  discard,
  eachPlayer,
  encounterCards,
  enemyAttack,
  enemyScheme,
  anyIn,
  firstPlayer,
  forcedInterrupt,
  giveStatus,
  giveTough,
  ifThen,
  instead,
  modifyAttack,
  named,
  not,
  on,
  oneCopyOf,
  option,
  preventDamage,
  query,
  removeEachCounterFrom,
  revealCard,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  statusCount,
  stun,
  sum,
  surge,
  theVillain,
  valueAtLeast,
  varAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  you,
} from "../../../dsl/index.js";
import { theCardWithHighestCost } from "../../../wave1/bkw/local.js";

const FINESSE = named("Finesse");
const SKILL = "skill";
const SKILL_COUNTERS = countersOn(FINESSE, SKILL);
/** "A card you control" that has a printed cost: an ally, upgrade or support (an identity prints none). */
const CARDS_YOU_CONTROL = query(["ally", "upgrade", "support"], { controller: "you" });
/** Inconspicuous's pool: the highest-cost of them that can leave play (RRG 1.8 "Permanent", p. 32). */
const HIGHEST_COST_YOU_CONTROL = theCardWithHighestCost(CARDS_YOU_CONTROL, { leavesPlay: true });

/**
 * Setup of stages I and III: "The enemy team finds Finesse and attaches it to Spider-Woman." One Finesse is in the
 * set, so the find has nothing to decide and no prompt is shown (docs/phase7-wave10.md section 3.5); a search shuffles
 * the encounter deck after it (RRG 1.8 "Search", p. 39). Finesse is a permanent card: it never reaches a discard pile.
 */
const spiderWomanSetup = () =>
  setup(
    selectCards("finesse", oneCopyOf(encounterCards(["deck"], query("attachment", { name: "Finesse" })))),
    attachCard(chosen("finesse"), theVillain),
    shuffleEncounterDeck(),
  );

/**
 * "Forced Interrupt: When Spider-Woman attacks, she gets +1 ATK for each skill counter on Finesse for this attack.
 * Remove each skill counter from Finesse." The bonus is the number counted as the interrupt resolves, before the
 * counters go (a lasting `modifyStat` would read Finesse again when the attack is worked out, after the removal).
 * It is the same on every stage.
 */
const spiderWomanForcedInterrupt = () =>
  forcedInterrupt(
    on.enemyAttacks("self"),
    modifyAttack({ atkBonus: SKILL_COUNTERS }),
    removeEachCounterFrom(FINESSE, SKILL),
  );

/**
 * Stages II and IV: "When Revealed: Deal each player an encounter card. Spider-Woman cannot take damage this phase."
 * The stage is revealed when the one before it is defeated, in the player phase, so the lasting effect covers the rest
 * of that phase (the same card text as Captain America's, docs/phase7-wave10.md section 3.7).
 */
const advancedWhenRevealed = () =>
  whenRevealed(
    dealEncounterCard(eachPlayer),
    applyRuleUntil({ kind: "cannotTakeDamage", target: query("villain", { name: "Spider-Woman" }) }, "endOfPhase"),
  );

/**
 * Spider-Woman, the Resistance leader (MC56 p. 3, docs/phase7-wave10.md section 2.5, 3.7, 7.4): a villain in a
 * cooperative game; her four stages 56168 to 56171 (I and II standard, III and IV expert) and her encounter set
 * 56174 to 56179 (set "Spider-Woman").
 *
 * **Finesse (56174)**: Permanent (data). "Max 3 skill counters here" is a counter limit. Its Forced Interrupt hears
 * every treachery revealed by anyone, before the treachery's own When Revealed, so a treachery that reads Finesse
 * (Venom Blast) already counts the counter this reveal placed. Pheromones places a second one itself.
 *
 * **Spider-Woman's Forced Interrupt**: when she attacks (her activation or an attack a card makes her make), +1 ATK
 * for this attack per skill counter, then every skill counter comes off.
 *
 * **Contaminant Immunity (56175)**: attaches to Spider-Woman (+1 SCH, data). A stun or confuse she would be given is
 * replaced by this card's discard and a tough status card (Forced Interrupt, `wouldGainStatus`). Boost: it is revealed.
 *
 * **Venom Blast (56177)**: Hero: Spider-Woman attacks the revealing player; the keywords depend on how many skill
 * counters her Forced Interrupt removes during that attack, which are the counters on Finesse when the attack starts
 * (nothing else changes them between this effect and the interrupt). At least 1: ranged; 2: piercing; 3: overkill.
 *
 * **Inconspicuous (56178)**: the revealing player chooses; the first option needs a card with a printed cost under
 * their control (RRG 1.8 "Choose (Option)", p. 12: an encounter card's option needs a valid target), a tie for the
 * highest is broken by the first player. Boost: one more boost icon per status card on their identity.
 *
 * **Self-propelled Glide (56179)**: an attack's damage to Spider-Woman is reduced by the skill counters on Finesse,
 * to nothing at most (acceleration icon and threat are data).
 *
 * Cards (7):
 * - 56168 Spider-Woman (villain)
 * - 56174 Finesse (attachment)
 * - 56175 Contaminant Immunity (attachment)
 * - 56176 Pheromones (treachery)
 * - 56177 Venom Blast (treachery)
 * - 56178 Inconspicuous (treachery)
 * - 56179 Self-propelled Glide (side_scheme)
 */
export const LEADERS_SPIDER_WOMAN: AbilityRegistry = defineAbilities({
  "56168.setup": spiderWomanSetup(),
  "56168.spider-woman-forced-interrupt": spiderWomanForcedInterrupt(),
  "56169.when-revealed": advancedWhenRevealed(),
  "56169.spider-woman-forced-interrupt": spiderWomanForcedInterrupt(),
  "56170.setup": spiderWomanSetup(),
  "56170.spider-woman-forced-interrupt": spiderWomanForcedInterrupt(),
  "56171.when-revealed": advancedWhenRevealed(),
  "56171.spider-woman-forced-interrupt": spiderWomanForcedInterrupt(),

  "56174.finesse-constant": constant(counterLimit(SKILL, 3)),
  "56174.finesse-forced-interrupt": forcedInterrupt(
    on.encounterCardRevealed(query("treachery")),
    addCounters(SKILL, 1, self),
  ),

  "56175.contaminant-immunity-forced-interrupt": forcedInterrupt(
    on.wouldGainStatus("host", ["stunned", "confused"]),
    { would: true },
    instead(discard(self), giveTough(theVillain)),
  ),
  "56175.boost": boost(revealCard(self, you)),

  "56176.when-revealed": whenRevealed(stun(yourIdentity), confuse(yourIdentity), addCounters(SKILL, 1, FINESSE)),
  "56176.boost": boost(
    giveStatus(yourIdentity, "stunned", { bind: "stunned" }),
    ifThen(not(varAtLeast("stunned.amount")), confuse(yourIdentity)),
  ),

  "56177.when-revealed-alter-ego": whenRevealedAlterEgo(surge()),
  "56177.when-revealed-hero": whenRevealedHero(
    ifThen(
      valueAtLeast(SKILL_COUNTERS, 3),
      enemyAttack(theVillain, { against: you, keywords: ["ranged", "piercing", "overkill"] }),
      ifThen(
        valueAtLeast(SKILL_COUNTERS, 2),
        enemyAttack(theVillain, { against: you, keywords: ["ranged", "piercing"] }),
        ifThen(
          valueAtLeast(SKILL_COUNTERS, 1),
          enemyAttack(theVillain, { against: you, keywords: ["ranged"] }),
          enemyAttack(theVillain, { against: you }),
        ),
      ),
    ),
  ),

  "56178.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Discard the highest-cost card you control",
        { when: anyIn(HIGHEST_COST_YOU_CONTROL) },
        bindTargets("highest", HIGHEST_COST_YOU_CONTROL),
        // No "choose": an encounter card targeting one of several eligible cards; the first player selects
        // (RRG 1.8 "First Player", p. 19).
        chooseTarget("burned", { inSlot: "highest" }, { chooser: firstPlayer }),
        discard(chosen("burned")),
      ),
      option("Spider-Woman schemes", enemyScheme(theVillain)),
    ),
  ),
  "56178.boost": boost(
    adjustBoostCount(
      sum(
        statusCount("stunned", yourIdentity),
        statusCount("confused", yourIdentity),
        statusCount("tough", yourIdentity),
      ),
    ),
  ),

  "56179.self-propelled-glide-forced-interrupt": forcedInterrupt(
    on.damage(query("villain", { name: "Spider-Woman" }), { fromAttack: true }),
    preventDamage(SKILL_COUNTERS),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const LEADERS_SPIDER_WOMAN_SKIPPED: Readonly<Record<string, string>> = {};
