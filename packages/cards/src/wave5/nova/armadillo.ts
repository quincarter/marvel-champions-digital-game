import {
  after,
  anyNumberOfToughStatusCards,
  attachCard,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  each,
  encounterCards,
  enemyAttack,
  enemyScheme,
  firstPlayer,
  forcedResponse,
  gets,
  giveTough,
  hasStatus,
  host,
  ifThen,
  isAttached,
  made,
  named,
  not,
  putIntoPlay,
  query,
  rule,
  self,
  shuffleEncounterDeck,
  surge,
  theVillain,
  varAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";

/** "Each enemy with a tough status card" (28031's own two forms). */
const EACH_TOUGH_ENEMY = each(query("enemy", { hasStatus: "tough" }));
/** Armadillo by name, whether or not he is currently in play (28032's own "give Armadillo … a tough status card"). */
const ARMADILLO_BY_NAME = named("Armadillo");

/**
 * Armadillo (`nova` 28028–28032, docs/phase7-wave5.md §2.2): the Armadillo modular set — Armored Assault (side
 * scheme), Armadillo (unique elite minion), Rollin', Rollin' (attachment), Tough and Tumble (form-split
 * treachery), Tough It Out (treachery). Every card revolves around tough status cards stacking on Armadillo past
 * the normal one-card limit (`anyNumberOfToughStatusCards`, `packages/engine/src/rules.ts`'s own `statusLimit`
 * rule written for this exact card).
 */
export const ARMADILLO = defineAbilities({
  // Armored Assault (28028, side scheme; startingThreat 0/3, boost icons are data) — Each enemy with a tough
  // status card gets +3 ATK. Active for as long as the side scheme is in play (the ordinary constant-ability
  // lifetime), not just while Armadillo himself is; a second enemy carrying a tough card (Tough It Out gives the
  // villain one too) also gets the bonus.
  "28028.armored-assault-constant": constant(gets("atk", 3, query("enemy", { hasStatus: "tough" }))),

  // Armadillo (28029, minion; Toughness keyword is data) — Armadillo can have any number of tough status cards
  // (RRG 1.8 "Status Card", p. 41: normally one of each). [star] Forced Response: after Armadillo activates
  // against you (attacks or schemes, docs/phase7-wave5.md §4.1 Q67), give him a tough status card.
  "28029.armadillo-constant": constant(anyNumberOfToughStatusCards({ self: true })),
  "28029.armadillo-forced-response": forcedResponse(
    after.enemyActivates("self", { againstYou: true }),
    giveTough(self),
  ),

  // Rollin', Rollin' (28030, attachment; ATK+2, attachesTo Armadillo (namedCard) are data) — the engine's implicit
  // attach already handles "Attach to Armadillo"; this is only the fallback the printed text adds: "If Armadillo
  // is not in play, search the encounter deck and discard pile for Armadillo, put him into play, engaged with
  // you, and attach this card to him. (Shuffle.)" — the same "search for a specific host, then attach" shape as
  // `wave4/hood/ransacked-armory.ts`'s `searchForAHostIfUnattached`, narrowed from "a minion" to "Armadillo" by
  // name since this card always wants that one card, not any minion. [star] While Armadillo has a tough status
  // card, characters cannot defend against his attacks (`RuleSpec cannotDefend`, docs/phase7-wave4.md §3.31, the
  // same shape as Tracking Display's own worked example, `sm` 27152 — here scoped to the attached host, not the
  // villain, and gated on `host`'s own tough status).
  "28030.rollin-rollin-constant": whenRevealed(
    ifThen(not(isAttached(self)), [
      chooseCards("host", encounterCards(["deck", "discard"], query("minion", { name: "Armadillo" })), {
        min: 1,
        max: 1,
        chooser: firstPlayer,
      }),
      putIntoPlay(chosen("host"), you),
      attachCard(self, chosen("host")),
      shuffleEncounterDeck(),
    ]),
  ),
  "28030.rollin-rollin-constant-2": constant(
    rule({
      kind: "cannotDefend",
      target: query("character"),
      attacker: query("minion", { hostOfSelf: true }),
      while: hasStatus(host, "tough"),
    }),
  ),

  // Tough and Tumble (28031, treachery; boost icons are data) — When Revealed (Alter-Ego): each enemy with a
  // tough status card schemes. If no enemy activated this way, this card gains surge. When Revealed (Hero): each
  // enemy with a tough status card attacks you. Same "if no enemy activated this way" fallback either form
  // (`made`/`<bind>.made`, the same "activation actually happened" read `core/scenarios/klaw.ts`'s Masters of
  // Mayhem uses).
  "28031.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(EACH_TOUGH_ENEMY, { bind: "act" }),
    ifThen(not(made("act")), surge()),
  ),
  "28031.when-revealed-hero": whenRevealedHero(
    enemyAttack(EACH_TOUGH_ENEMY, { against: you, bind: "act" }),
    ifThen(not(made("act")), surge()),
  ),

  // Tough It Out (28032, treachery, quantity 2; boost icons are data) — When Revealed: give Armadillo and the
  // villain each a tough status card. If 1 or fewer tough status cards were given this way, this card gains
  // surge. Two separate `giveTough` calls (Armadillo by name, the villain by ref) sharing one bind, whose
  // `.amount` sums across both (`wave4/hood/wrecking-crew.ts`'s Magic Muscle own precedent for reading a
  // `giveTough` bind's count) — a character already holding a tough card takes none, so "1 or fewer" covers both
  // "gave nobody" and "only one of the two took one".
  "28032.when-revealed": whenRevealed(
    giveTough(ARMADILLO_BY_NAME, { bind: "given" }),
    giveTough(theVillain, { bind: "given" }),
    ifThen(not(varAtLeast("given.amount", 2)), surge()),
  ),
});
