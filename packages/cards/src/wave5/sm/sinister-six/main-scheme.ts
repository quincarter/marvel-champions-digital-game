import {
  activationOrderOf,
  addVillain,
  anyOf,
  chosen,
  defineAbilities,
  dealEncounterCard,
  each,
  encounterSetAside,
  exists,
  firstPlayer,
  forcedInterrupt,
  ifThen,
  inMode,
  named,
  not,
  on,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  resolveSpecialsOf,
  self,
  selectCards,
  setActiveVillain,
  setup,
  special,
  superlative,
  varAtLeast,
  whenRevealed,
} from "../../../dsl/index.js";

/**
 * "Ambush! — Special: Choose a set-aside villain at random, put that villain into play, and place the active counter
 * on it. (In expert mode, place 2 threat on Light at the End)." (Sinister Synchronization 1B / Sinister Beatdown 2B,
 * `sm` 27100b/27101b, identical text on both cards). The parenthetical is unconditional on the mode, not on whether a
 * villain actually entered (docs/phase7-wave5.md §3.11's own `inMode` reading).
 */
const AMBUSH = () =>
  special(
    selectCards("pick", encounterSetAside(query("villain"), { random: 1 })),
    addVillain(chosen("pick"), { bind: "ambush" }),
    setActiveVillain(chosen("ambush")),
    ifThen(inMode("expert"), placeThreat(2, named("Light at the End"))),
  );

/**
 * "Forced Interrupt: When a villain would activate, if no villain is in play, resolve this card's 'Ambush!' ability.
 * Continue that activation." (27100b, 27101b; docs/phase7-wave5.md §3.2's own worked example for `on.enemyActivating`).
 * No `cancelIt()`: an uncancelled interrupt continues the activation by default, against whichever villain Ambush!
 * just put into play (or nobody, if none was set aside — the activation then does nothing, as with no villain today).
 */
const AMBUSH_INTERRUPT = (ambushAbilityId: string) =>
  forcedInterrupt(
    on.enemyActivating(),
    ifThen(not(exists(query("villain"))), resolveSpecialsOf(self, undefined, { abilities: [ambushAbilityId] })),
  );

/**
 * Sinister Synchronization / Sinister Beatdown (`sm` 27100a/27100b/27101a/27101b; MC27 p. 15, docs/phase7-wave5.md
 * §1.5/§3.1/§3.2). The lettered stages' own "If this stage is completed, the players lose the game" is data
 * (`completionLoses`); the win is Light at the End's own card ability (`scenario-cards.ts`), not defeating every
 * villain (`MultipleVillains.winCondition: "cardAbility"`, data).
 */
export const SINISTER_SIX_MAIN_SCHEME = defineAbilities({
  // 1A (27100a) — Setup: choose players+1 villains at random, put them into play, give the lowest activation order
  // the counter, set the rest aside, and put Light at the End into play (its Trap! face, 27102a — the only face that
  // ever starts set aside; both faces are excluded from the shuffled encounter deck, `setup.ts`'s own
  // `SINISTER_SIX_SET_ASIDE`, since a "Permanent" card is "set aside during setup" (RRG 1.8 p. 32), not shuffled in).
  "27100a.setup": setup(
    selectCards("starting", encounterSetAside(query("villain"), { random: perHero(1, 1) })),
    addVillain(chosen("starting")),
    setActiveVillain(superlative("lowest", each(query("villain")), activationOrderOf(chosen("candidate")))),
    selectCards("light", encounterSetAside(query("sideScheme", { name: "Light at the End" }))),
    putIntoPlay(chosen("light"), firstPlayer),
  ),

  // 1B (27100b) — Ambush! Special, and its Forced Interrupt when a villain would activate with none in play.
  "27100b.ambush": AMBUSH(),
  "27100b.sinister-synchronization-forced-interrupt": AMBUSH_INTERRUPT("27100b.ambush"),

  // 2A (27101a) — When Revealed: choose a set-aside villain at random, put it into play, and take the counter (even
  // if another villain already has it — `setActiveVillain` always overrides, so no extra flag is needed). If no
  // villain entered this way, or this is expert mode, deal the first player 1 facedown encounter card.
  "27101a.when-revealed": whenRevealed(
    selectCards("pick", encounterSetAside(query("villain"), { random: 1 })),
    addVillain(chosen("pick"), { bind: "ambush" }),
    setActiveVillain(chosen("ambush")),
    ifThen(anyOf(not(varAtLeast("ambush.count", 1)), inMode("expert")), dealEncounterCard(firstPlayer)),
  ),

  // 2B (27101b) — the same Ambush! Special and Forced Interrupt as 1B, on this stage's own card face.
  "27101b.ambush": AMBUSH(),
  "27101b.sinister-beatdown-constant": AMBUSH_INTERRUPT("27101b.ambush"),
});
