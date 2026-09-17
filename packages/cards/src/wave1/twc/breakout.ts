import {
  after,
  allOf,
  chosen,
  constant,
  defineAbilities,
  duringVillainPhaseStepOne,
  each,
  encounterSetAside,
  eventSource,
  firstPlayer,
  forcedResponse,
  ifThen,
  named,
  not,
  placeThreat,
  putIntoPlay,
  query,
  refMatches,
  selectCards,
  setActiveVillain,
  setup,
} from "../../dsl/index.js";
import { pickVillainBy, pickedVillain } from "./local.js";

/**
 * Breakout (07001a/07001b), The Wrecking Crew's main scheme (docs/phase7-wave1.md §2.3, §3.1).
 *
 * `07001a.breakout-constant` has no `notesForScripting` and no mechanical text of its own — the printed 1A face is
 * "Scenario Contents: …" (flavor/setup instructions, not a card ability) plus the separate `07001a.setup` ref
 * below. Scripted as an empty `constant()` so coverage stays exact without inventing behavior the card doesn't have.
 */
export const BREAKOUT = defineAbilities({
  "07001a.breakout-constant": constant(),

  // Breakout 1A — Setup: Put the Day of Reckoning, Thunderstruck, Pile It On!, and Clear the Road side schemes into
  // play. Place the active counter on Wrecker. Advance to stage 1B (implicit — the engine always continues onto the
  // B side, `klaw.ts`/`rhino.ts`/`ultron.ts` convention). Mirrors the identical `BREAKOUT_SETUP` fixture proven in
  // `packages/engine/src/multi-villain.test.ts`.
  "07001a.setup": setup(
    selectCards("signature", encounterSetAside()),
    putIntoPlay(chosen("signature"), firstPlayer),
    setActiveVillain(named("Wrecker")),
  ),

  // Breakout 1B — [star] Forced Response: After step one of the villain phase, place 1 threat on each side scheme.
  // Move the active counter to the villain whose scheme has the most threat. (If there is a tie, the first player
  // chooses.) The `duringVillainPhaseStepOne` + "no source card" guard is the `ultron.ts` "Assault on NORAD"
  // convention (`01138b.assault-on-norad-forced-response`): step one's own threat placement has no source card, so
  // it (and only it) passes the guard — this ability's own `placeThreat` below is sourced from Breakout itself and
  // does not retrigger it.
  "07001b.breakout-forced-response": forcedResponse(
    after.threatPlaced("self"),
    ifThen(
      allOf(duringVillainPhaseStepOne, not(refMatches(eventSource, {}))),
      [placeThreat(1, each(query("sideScheme"))), ...pickVillainBy("highest", firstPlayer), setActiveVillain(pickedVillain)],
    ),
  ),
});
