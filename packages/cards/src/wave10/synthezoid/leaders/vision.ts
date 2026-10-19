import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  applyRuleUntil,
  attachCard,
  boost,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  dealEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  encounterCards,
  enemyAttack,
  enemyScheme,
  eventKindIs,
  eventSource,
  exhaust,
  exists,
  faceNamed,
  firstPlayer,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  giveStatus,
  identityOf,
  ifElse,
  ifThen,
  modifyAttack,
  not,
  on,
  oneCopyOf,
  preventDamage,
  query,
  heroResponse,
  revealCard,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  stun,
  theVillain,
  varAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../../dsl/index.js";

const HOST_VILLAIN = query("villain", { hostOfSelf: true });
/** The two faces of the one double-sided attachment, each by the title showing now (`TargetQuery.name` reads it). */
const DENSE = query("attachment", { name: "Dense" });
const INTANGIBLE = query("attachment", { name: "Intangible" });
/**
 * "Vision's mass form attachment" (M2): "Mass form." on 57046a/b is a label, not the `form` keyword (curation
 * `labelSentences`), so the attachment is named by its two face titles.
 */
const MASS_FORM = query("attachment", { anyOf: [{ name: "Dense" }, { name: "Intangible" }] });
const MASS_FORM_ATTACHMENT = each(MASS_FORM);

/**
 * Setup (stages I and III): "The enemy team finds Vision's mass form attachment and attaches it to Vision, Dense side
 * faceup." One copy exists, in the encounter deck on its Dense face (RRG 1.8 "Find", p. 19; "Search", p. 39: the deck
 * is shuffled after).
 */
const visionSetup = () =>
  setup(
    selectCards("mass", oneCopyOf(encounterCards(["deck"], MASS_FORM))),
    attachCard(chosen("mass"), theVillain),
    shuffleEncounterDeck(),
  );

/** When Revealed (stages II and IV): "Deal each player an encounter card. Vision cannot take damage this phase." */
const visionWhenRevealed = () =>
  whenRevealed(
    dealEncounterCard(eachPlayer),
    applyRuleUntil({ kind: "cannotTakeDamage", target: { self: true } }, "endOfPhase"),
  );

/**
 * Every stage: "Forced Response: After resolving step 1 of the villain phase, flip Vision's mass form attachment."
 * The same window as Public Outrage 56122b. A flip turns the card to its other face in place (RRG 1.8 "Flip", p. 20):
 * it keeps its host, stays permanent and is not turned facedown.
 */
const visionForcedResponse = () => forcedResponse(on.villainStepResolved(), flipCard(MASS_FORM_ATTACHMENT));

/** "If the [Dense / Intangible] attachment is in play": the current face carries that title. */
const faceIs = (name: "Dense" | "Intangible") => faceNamed(MASS_FORM_ATTACHMENT, name);

/**
 * Density Control: "If this activation is a [scheme], flip Vision's mass form attachment to [Intangible]." The flip
 * happens only from the other face; "then, if the attachment flipped, discard this card" reads the face that results,
 * so an attachment already on the named face (or one a rule stops from flipping) leaves the card in play.
 */
const densityFlip = (
  activation: "enemyScheme" | "enemyAttack",
  from: "Dense" | "Intangible",
  to: "Dense" | "Intangible",
) =>
  ifThen(eventKindIs(activation), [
    ifThen(faceIs(from), [flipCard(MASS_FORM_ATTACHMENT), ifThen(faceIs(to), discard(self))]),
  ]);

/** Solar Gem / Vision's Cape: "After you make a basic attack against Vision, spend [two types] → discard, flip". */
const basicAttackOnVision = () => after.attacks(query("identity"), { basic: true, byYou: true, target: HOST_VILLAIN });

/**
 * Vision, the Synthezoid Smackdown resistance leader (MC57 p. 7; docs/phase7-synthezoid.md sections 2.2, 7.2): stages
 * 57040 to 57043, one VillainCard whose stages I and II are the standard game and III and IV the expert one. Hit
 * points, ATK, SCH and Steady are data.
 *
 * **Dense / Intangible (57046a/b)**: one permanent double-sided attachment (M2 to M5). Dense prints +1 ATK. Intangible
 * prints a Forced Interrupt: damage Vision would take is reduced by 1 (an interrupt, so a tough status card is used
 * first, RRG 1.8 "Damage", p. 14; as Thanos's Armor).
 *
 * **Solar Gem (57047)** and **Vision's Cape (57048)**: unique attachments; the Hero Response is any player's (a card
 * nobody controls, RRG 1.8 "Ability", p. 4), "you" the player who made the basic attack. **Mass Increase (57049)**:
 * while Dense is in play, a character attacking Vision deals no damage and is stunned. **Density Control (57050)**:
 * flips the attachment as above. Its "-constant" ref is the line the parser split off the interrupt ("Then, if ...
 * discard this card"), scripted inside the interrupt, so the ref is empty.
 *
 * **Solar Beam (57051)**, **Superdense Strike (57052)**, **Phase Disruption (57053)**: the target of an encounter
 * treachery with no printed "choose" is the first player's to pick (RRG 1.8 "First Player", p. 19). A target is valid
 * if at least one effect can affect it (RRG 1.8 "Target", p. 43): Strike's damage (Dense) and Disruption's discard
 * (Intangible) reach exhausted cards, so only the other face limits the choice to ready ones.
 *
 * **Just Passing Through (57054)**: When Defeated: the defeating player confuses their identity; "otherwise" (it was
 * not given: already confused) they stun it (RRG 1.8 "Otherwise", p. 31).
 *
 * Cards (10):
 * - 57040 Vision (villain)
 * - 57046a Dense (attachment)
 * - 57047 Solar Gem (attachment)
 * - 57048 Vision's Cape (attachment)
 * - 57049 Mass Increase (attachment)
 * - 57050 Density Control (attachment)
 * - 57051 Solar Beam (treachery)
 * - 57052 Superdense Strike (treachery)
 * - 57053 Phase Disruption (treachery)
 * - 57054 Just Passing Through (side_scheme)
 */
export const SYNTHEZOID_LEADERS_VISION: AbilityRegistry = defineAbilities({
  "57040.setup": visionSetup(),
  "57040.vision-forced-response": visionForcedResponse(),
  "57041.when-revealed": visionWhenRevealed(),
  "57041.vision-forced-response": visionForcedResponse(),
  "57042.setup": visionSetup(),
  "57042.vision-forced-response": visionForcedResponse(),
  "57043.when-revealed": visionWhenRevealed(),
  "57043.vision-forced-response": visionForcedResponse(),

  // Intangible: "Forced Interrupt: When Vision would take any amount of damage, reduce that amount by 1."
  "57046b.intangible-forced-interrupt": forcedInterrupt(when.damage("host"), preventDamage(1)),

  // Solar Gem: "Vision gains stalwart. Hero Response: After you make a basic attack against Vision, spend [energy]
  // [physical] resources -> discard this card and flip Vision's mass form attachment. [star] Boost: Reveal this card."
  "57047.solar-gem-constant": constant(gainsKeyword({ name: "stalwart" }, HOST_VILLAIN)),
  "57047.solar-gem-response": heroResponse(
    basicAttackOnVision(),
    { cost: spend({ energy: 1, physical: 1 }) },
    discard(self),
    flipCard(MASS_FORM_ATTACHMENT),
  ),
  "57047.boost": boost(revealCard(self)),

  // Vision's Cape: the same with [energy] [mental] and retaliate 1.
  "57048.visions-cape-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, HOST_VILLAIN)),
  "57048.visions-cape-response": heroResponse(
    basicAttackOnVision(),
    { cost: spend({ energy: 1, mental: 1 }) },
    discard(self),
    flipCard(MASS_FORM_ATTACHMENT),
  ),
  "57048.boost": boost(revealCard(self)),

  // Mass Increase: "When a character attacks Vision while the Dense attachment is in play, prevent all damage from that
  // attack and stun the attacking character. Discard this card."
  "57049.mass-increase-forced-interrupt": forcedInterrupt(
    on.attacks(query("character"), { target: HOST_VILLAIN }),
    { while: faceIs("Dense") },
    modifyAttack({ preventAllDamage: true }),
    stun(eventSource),
    discard(self),
  ),

  // Density Control: "Forced Interrupt: When Vision activates, if this activation is a scheme, flip the attachment to
  // Intangible; an attack, to Dense. Then, if it flipped, discard this card."
  "57050.density-control-forced-interrupt": forcedInterrupt(
    on.enemyActivates("host"),
    densityFlip("enemyScheme", "Dense", "Intangible"),
    densityFlip("enemyAttack", "Intangible", "Dense"),
  ),
  "57050.density-control-constant": constant(),

  // Solar Beam: "Vision schemes. If the Intangible attachment is in play, Vision gets +1 SCH for this scheme." /
  // "Vision attacks you. If the Dense attachment is in play, Vision gets +1 ATK for this attack."
  // The face is read after "when Vision activates" interrupts (Density Control 57050 flips it), as the SCH / ATK is
  // set: an engine extension (tier 5) built on the order of FFG ruling #147, Feb 15 2024 (Weapon Master / Crossbones'
  // Machine Gun); RRG 1.8 "Interrupt", "Activation".
  "57051.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(theVillain, { schBonus: ifElse(exists(INTANGIBLE), 1, 0), bonusAfterInterrupts: true }),
  ),
  "57051.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, atkBonus: ifElse(exists(DENSE), 1, 0), bonusAfterInterrupts: true }),
  ),

  // Superdense Strike
  "57052.when-revealed": whenRevealed(
    // RRG 1.8 "Target" p. 43: valid if at least one effect can affect it. Dense adds damage, which reaches an
    // exhausted character; with Intangible up exhaust is the only effect, so only a ready one qualifies.
    ifThen(
      exists(DENSE),
      chooseTarget("struck", query("character", { controller: "you" }), { chooser: firstPlayer }),
      chooseTarget("struck", query("character", { controller: "you", exhausted: false }), { chooser: firstPlayer }),
    ),
    exhaust(chosen("struck")),
    ifThen(exists(DENSE), dealDamage(2, chosen("struck"))),
    ifThen(exists(INTANGIBLE), flipCard(each(INTANGIBLE))),
  ),

  // Phase Disruption
  "57053.when-revealed": whenRevealed(
    // Intangible discards instead, which can affect an exhausted upgrade; under Dense only exhaust applies.
    ifThen(
      exists(INTANGIBLE),
      chooseTarget("disrupted", query("upgrade", { controller: "you" }), { chooser: firstPlayer }),
      chooseTarget("disrupted", query("upgrade", { controller: "you", exhausted: false }), { chooser: firstPlayer }),
    ),
    ifThen(exists(INTANGIBLE), discard(chosen("disrupted")), exhaust(chosen("disrupted"))),
    ifThen(exists(DENSE), flipCard(each(DENSE))),
  ),

  // Just Passing Through
  "57054.when-defeated": whenDefeated(
    giveStatus(identityOf(defeatingPlayer), "confused", { bind: "confused" }),
    ifThen(not(varAtLeast("confused.amount", 1)), stun(identityOf(defeatingPlayer))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const SYNTHEZOID_LEADERS_VISION_SKIPPED: Readonly<Record<string, string>> = {};
