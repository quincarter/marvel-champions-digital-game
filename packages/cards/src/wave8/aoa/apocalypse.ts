import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  attachCard,
  boost,
  constant,
  dealEncounterCard,
  defineAbilities,
  each,
  encounterCards,
  encounterSetAside,
  endGame,
  enemyActivates,
  exists,
  firstPlayer,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  giveTough,
  heal,
  ifThen,
  isAttached,
  moveCards,
  named,
  not,
  on,
  oneCopyOf,
  otherPlayers,
  perHero,
  placeThreat,
  removeThreat,
  theMainScheme,
  threatOn,
  printedHpOf,
  query,
  revealCard,
  rule,
  selectCards,
  self,
  setup,
  surge,
  chosen,
  theVillain,
  whenDefeated,
  whenRevealed,
  you,
  cards,
} from "../../dsl/index.js";

const APOCALYPSE_NAME = named("Apocalypse");
const PRELATE_MINION = query("minion", { trait: trait("PRELATE") });
const HOST_ENEMY = query("enemy", { hostOfSelf: true });
const HOST_MINION = query("minion", { hostOfSelf: true });

/**
 * Scenario set `apocalypse` (Age of Apocalypse, docs/phase7-wave8.md §2.7, §3.18 to §3.22, §3.32) and the Apocalypse
 * villain (four stages on 45101a to 45102b), main scheme 45103a/b. The five Prelates are `prelates.ts`.
 *
 * The Age of Apocalypse 1B: "X is the numeral in Apocalypse's printed hit point value" makes the target threat X
 * per player, which is exactly his printed hit points scaled per player (`printedHpOf`, never modified), so the
 * target is written with that and needs no numeral value. The bare numeral (Remove X threat; discard X cards) does:
 * those lines wait on engine task 25.
 *
 * The chain (Heart of the Empire, The Towering Citadel, The Tyrant's Throne): each locks its threat while a
 * [PRELATE] minion is in play, and its When Defeated has the first player reveal a random set-aside Prelate and deals
 * each other player an encounter card, then moves on. The Tyrant's Throne also heals No Longer Worthy's 5[per_hero]
 * here, after the flip attaches it: the printed "heal" sits in No Longer Worthy's constant ref, which cannot hold a
 * one-time effect.
 *
 * Skipped, see `APOCALYPSE_SKIPPED`: Apocalypse I to III's "reveal the next stage" interrupt (task 24), 1B's
 * "instead" interrupt (task 25) and No Longer Worthy's "ignore" (task 26), and The Apocalypse Solution (task 25).
 *
 * Cards (12):
 * - 45101a Apocalypse (villain)
 * - 45103a The Age of Apocalypse (main_scheme)
 * - 45104a Heart of the Empire (side_scheme)
 * - 45104b The Towering Citadel (side_scheme)
 * - 45105a The Tyrant's Throne (side_scheme)
 * - 45105b No Longer Worthy (attachment)
 * - 45106 Cyberpathy (attachment)
 * - 45107 Biomorphing (attachment)
 * - 45108 Molecular Control (attachment)
 * - 45109 The Fittest (attachment)
 * - 45110 Wolf Among Sheep (treachery)
 * - 45111 The Apocalypse Solution (side_scheme)
 */

/** "The first player reveals a random set-aside [PRELATE] minion." */
const revealRandomPrelate = (): EffectSpec[] => [
  selectCards("prelate", encounterSetAside(PRELATE_MINION, { random: 1 })),
  revealCard(chosen("prelate"), firstPlayer),
];
/** "Threat cannot be removed from this scheme while a [PRELATE] minion is in play." */
const lockedWhilePrelate = () =>
  constant(rule({ kind: "threatCannotBeRemoved", target: { self: true }, while: exists(PRELATE_MINION) }));
/** Dreadpool's form: "[Name] engages the first player" is on each Prelate (`prelates.ts`). */
const attachToApocalypseBoost = () => boost(attachCard(self, APOCALYPSE_NAME));

export const APOCALYPSE: AbilityRegistry = defineAbilities({
  // Apocalypse IV: [star] his attacks gain overkill.
  "45102b.apocalypse-constant": constant(gainsKeyword({ name: "overkill" }, { self: true })),
  // Apocalypse IV: when the main scheme is completed, the players lose the game. (The one-stage scheme deck's final
  // stage loses on completion anyway, RRG p. 27; the interrupt states it with the villain as the cause.)
  "45102b.apocalypse-forced-interrupt": forcedInterrupt(
    on.mainSchemeCompleting(query("mainScheme")),
    endGame("loss", "mainSchemeCompleted"),
  ),

  // The Age of Apocalypse 1B: X is the numeral of his printed hit points; the target is X per player.
  "45103b.the-age-of-apocalypse-constant": constant(
    gets("targetThreat", printedHpOf(theVillain), { self: true }, { setBase: true }),
  ),
  // 1A Setup: unused villain cards, the Prelates and The Tyrant's Throne are set aside (data). Reveal Heart of the
  // Empire; the first player reveals a random set-aside Prelate.
  "45103a.setup": setup(
    selectCards("heart", oneCopyOf(encounterCards(["deck"], { name: "Heart of the Empire" }))),
    revealCard(chosen("heart"), firstPlayer),
    ...revealRandomPrelate(),
  ),

  // Heart of the Empire.
  "45104a.heart-of-the-empire-constant": lockedWhilePrelate(),
  "45104a.when-defeated": whenDefeated(
    ...revealRandomPrelate(),
    dealEncounterCard(otherPlayers(firstPlayer)),
    flipCard(self),
  ),
  // The Towering Citadel.
  "45104b.the-towering-citadel-constant": lockedWhilePrelate(),
  "45104b.when-defeated": whenDefeated(
    ...revealRandomPrelate(),
    dealEncounterCard(otherPlayers(firstPlayer)),
    selectCards("throne", encounterSetAside({ name: "The Tyrant's Throne" })),
    revealCard(chosen("throne"), firstPlayer),
    moveCards(cards(self), "removedFromGame"),
  ),
  // The Tyrant's Throne.
  "45105a.the-tyrants-throne-constant": lockedWhilePrelate(),
  "45105a.when-defeated": whenDefeated(
    ...revealRandomPrelate(),
    dealEncounterCard(otherPlayers(firstPlayer)),
    flipCard(self, { reveal: true }),
    heal(perHero(5), APOCALYPSE_NAME),
  ),

  // No Longer Worthy: he cannot take damage while a Prelate minion is in play.
  "45105b.no-longer-worthy-constant": constant(
    rule({ kind: "cannotTakeDamage", target: query("villain", { name: "Apocalypse" }), while: exists(PRELATE_MINION) }),
  ),
  // Forced Interrupt: when Apocalypse is defeated, the players win the game.
  "45105b.no-longer-worthy-forced-interrupt": forcedInterrupt(on.defeated("host"), endGame("win", "cardAbility")),

  // Cyberpathy: [star] Forced Response: After Apocalypse schemes, place 1 threat on each side scheme.
  "45106.cyberpathy-forced-response": forcedResponse(
    on.enemySchemes("host"),
    placeThreat(1, each(query("sideScheme"))),
  ),
  "45106.boost": attachToApocalypseBoost(),
  // Biomorphing: [star] Apocalypse's attacks gain overkill.
  "45107.biomorphing-constant": constant(gainsKeyword({ name: "overkill" }, HOST_ENEMY)),
  "45107.boost": attachToApocalypseBoost(),
  // Molecular Control: Apocalypse gains retaliate 1 and stalwart.
  "45108.molecular-control-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, HOST_ENEMY),
    gainsKeyword({ name: "stalwart" }, HOST_ENEMY),
  ),
  "45108.boost": attachToApocalypseBoost(),

  // The Fittest: attaches to the minion with the highest printed hit points (data) and gives it a tough status card;
  // otherwise this card gains surge. Attached enemy gets +5 hit points.
  "45109.the-fittest-constant": whenRevealed(
    ifThen(isAttached(self), giveTough(each(HOST_MINION))),
    ifThen(not(isAttached(self)), surge()),
  ),
  "45109.the-fittest-constant-2": constant(gets("hp", 5, HOST_ENEMY)),

  // Wolf Among Sheep: the Prelate minion activates against you; otherwise Apocalypse does.
  "45110.when-revealed": whenRevealed(
    ifThen(
      exists(PRELATE_MINION),
      enemyActivates(each(PRELATE_MINION), { against: you }),
      enemyActivates(theVillain, { against: you }),
    ),
  ),
  "45110.boost": boost(ifThen(exists(PRELATE_MINION), giveTough(each(PRELATE_MINION)), giveTough(theVillain))),
});

/**
 * The three stage interrupts, written but not registered (task 24): "remove all threat from the main scheme (ignoring
 * any crisis icons), flip this card and reveal the next stage". `revealNextVillainStage` is the effect that task adds
 * (spec section 3.18), so it is typed here by hand until the DSL has the builder.
 */
const revealNextStage = { kind: "revealNextVillainStage", villain: theVillain } as unknown as EffectSpec;
const stageInterrupt = () =>
  forcedInterrupt(
    on.mainSchemeCompleting(query("mainScheme")),
    removeThreat(threatOn(theMainScheme), theMainScheme, { ignoreCrisis: true }),
    revealNextStage,
  );
export const APOCALYPSE_UNREGISTERED: AbilityRegistry = defineAbilities({
  "45101a.apocalypse-forced-interrupt": stageInterrupt(),
  "45101b.apocalypse-forced-interrupt": stageInterrupt(),
  "45102a.apocalypse-forced-interrupt": stageInterrupt(),
});

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. */
export const APOCALYPSE_SKIPPED: Readonly<Record<string, string>> = {
  "45101a.apocalypse-forced-interrupt":
    "needs an effect that reveals the villain's next stage without a defeat (task 24, section 3.18)",
  "45101b.apocalypse-forced-interrupt": "same: task 24",
  "45102a.apocalypse-forced-interrupt": "same: task 24",
  "45103b.the-age-of-apocalypse-forced-interrupt":
    "its heal-and-discard 'instead' is composable, but 'Remove X threat' is the bare numeral of his printed hit points, which needs `printedHp { numeral }` (task 25, section 3.19)",
  "45111.when-defeated":
    "'Discard the top X cards of the encounter deck' is the bare numeral of his printed hit points again: task 25 (section 3.19)",
  "45105b.no-longer-worthy-constant-2":
    "'Ignore the Forced Interrupt on the main scheme' needs `RuleSpec ignoreAbilities` (task 26, section 3.21)",
};
