import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  activatingEnemy,
  boost,
  chooseTarget,
  chosen,
  dealAsEncounterCard,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  discardFromHand,
  encounterCards,
  enemyActivates,
  exhaust,
  forcedInterrupt,
  giveTough,
  heal,
  host,
  ifThen,
  inPlay,
  moveCards,
  not,
  oneCopyOf,
  placeThreat,
  query,
  searchAndReveal,
  selectCards,
  shuffleEncounterDeck,
  surge,
  theMainScheme,
  topOfDeck,
  totalPrintedResources,
  valueAtLeast,
  varAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  you,
} from "../../dsl/index.js";

type Icon = "energy" | "mental" | "physical" | "wild";
/** Three cards at most are discarded and a card prints at most two icons of a type, so six is the most a type can reach. */
const MOST_ICONS = 6;

/**
 * "For each [icon] discarded this way, <effect>": the effect once per icon of that type on the cards bound as `slot`
 * (a wild icon is only wild, RRG p. 48). The DSL has no counted repeat, so it is one guarded copy per possible icon.
 */
const perIcon = (slot: string, icon: Icon, effect: () => EffectSpec | readonly EffectSpec[]): EffectSpec[] =>
  Array.from({ length: MOST_ICONS }, (_, i) =>
    ifThen(valueAtLeast(totalPrintedResources(chosen(slot), [icon]), i + 1), effect()),
  );

/**
 * Modular encounter set `sauron` (Iceman pack, docs/phase7-wave8.md section 7.2, 3.70).
 *
 * **Sauron (46029)**: When Revealed searches the encounter deck and discard pile for Life Drain, reveals it and shuffles.
 * Boost: heals 3 from the activating enemy and gives it a tough status card (healed first, so a tough card is kept
 * even when there was nothing to heal).
 *
 * **Sauron Lives! (46030)**: 3 threat regardless of players, a crisis icon, 3 boost icons (data). When Defeated: the
 * player who defeated it searches the encounter deck and discard pile for Sauron and deals him to themself facedown.
 * Only those two zones are searched, so a Sauron already in play (or in the victory display) finds nothing.
 *
 * **Life Drain (46031)**: the host (the minion with the highest printed hit points) is data. Its first ref resolves
 * when it is revealed: the host activates against the revealer (an attack in hero form, a scheme in alter-ego form);
 * if no minion activated, the card gains surge. With no minion in play the card is discarded unattached and still
 * gains surge. Forced Interrupt: when the host attacks you, you take 2 damage and it gets a tough status card.
 *
 * **The Eye of Sauron (46032)**: discard the top 2 cards of your deck (3 with Sauron in play), then per resource icon
 * discarded, in the printed order: [energy] threat on the main scheme, [mental] discard from hand, [physical] damage
 * to your identity, [wild] exhaust a character you control. Each icon is its own instruction.
 *
 * Cards (4):
 * - 46029 Sauron (minion)
 * - 46030 Sauron Lives! (side_scheme)
 * - 46031 Life Drain (attachment)
 * - 46032 The Eye of Sauron (treachery)
 */
export const SAURON: AbilityRegistry = defineAbilities({
  "46029.when-revealed": whenRevealed(...searchAndReveal("Life Drain")),
  "46029.boost": boost(heal(3, activatingEnemy), giveTough(activatingEnemy)),

  "46030.when-defeated": whenDefeated(
    selectCards("found", oneCopyOf(encounterCards(["deck", "discard"], { name: "Sauron" }))),
    dealAsEncounterCard(chosen("found"), defeatingPlayer),
    shuffleEncounterDeck(),
  ),

  "46031.life-drain-constant": whenRevealed(
    enemyActivates(host, { against: you, bind: "drained" }),
    ifThen(not(varAtLeast("drained.made")), surge()),
  ),
  "46031.life-drain-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("host", { againstYou: true }),
    dealDamage(2, yourIdentity),
    giveTough(host),
  ),

  "46032.when-revealed": whenRevealed(
    ifThen(
      inPlay("Sauron"),
      moveCards(topOfDeck(3, you), "discard", "eye"),
      moveCards(topOfDeck(2, you), "discard", "eye"),
    ),
    ...perIcon("eye", "energy", () => placeThreat(1, theMainScheme)),
    ...perIcon("eye", "mental", () => discardFromHand(1)),
    ...perIcon("eye", "physical", () => dealDamage(1, yourIdentity)),
    ...perIcon("eye", "wild", () => [
      chooseTarget("tired", query("character", { controller: "you" })),
      exhaust(chosen("tired")),
    ]),
  ),
});

/** Refs left unregistered, each with its reason. */
export const SAURON_SKIPPED: Readonly<Record<string, string>> = {};
