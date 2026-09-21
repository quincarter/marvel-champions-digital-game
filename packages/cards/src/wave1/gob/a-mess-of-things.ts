import {
  after,
  boost,
  countOf,
  defineAbilities,
  enemyAttack,
  eventTarget,
  forcedResponse,
  ifThen,
  named,
  not,
  placeThreat,
  scaled,
  self,
  stun,
  varAtLeast,
  whenRevealed,
  you,
  yourIdentity,
} from "../../dsl/index.js";

const SCORPION = named("Scorpion");

/**
 * A Mess of Things modular set: A Mess of Things (02037, side scheme), Scorpion (02038, minion), Gang-Up (02039,
 * treachery), Tail Sweep ×2 (02040, treachery).
 */
export const A_MESS_OF_THINGS = defineAbilities({
  // A Mess of Things — When Revealed: Place 2 additional threat here for each stunned friendly character.
  "02037.when-revealed": whenRevealed(
    placeThreat(scaled(countOf({ categories: ["identity", "ally"], hasStatus: "stunned" }), { times: 2 }), self),
  ),

  // Scorpion — Quickstrike (data). [star] Forced Response: After Scorpion attacks and damages a character, stun
  // that character.
  "02038.scorpion-forced-response": forcedResponse(after.enemyAttacks("self", { damages: true }), stun(eventTarget)),

  // Tail Sweep — When Revealed: Scorpion attacks your hero. If no attack was made this way, you are stunned.
  "02040.when-revealed": whenRevealed(
    enemyAttack(SCORPION, { against: you, bind: "sweep" }),
    ifThen(not(varAtLeast("sweep.made")), stun(yourIdentity)),
  ),
  // [star] Boost: You are stunned.
  "02040.boost": boost(stun(yourIdentity)),
});

/** Every A Mess of Things ability is scripted. Kept so `index.ts`'s exports stay uniform across modular sets. */
export const A_MESS_OF_THINGS_SKIPPED = [] as const;
